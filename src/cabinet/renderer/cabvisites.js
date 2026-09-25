// Les visites guidées de SkanFact CABINET — le CONTENU (10.14.0).
//
// Skander, le 24/09/2026, après la visite guidée de l'application entreprise : « commence par faire
// ce qu'on vient de faire dans le dernier lot sur l'app cabinet », puis : « oublie pas le onboarding
// aussi, et fais le même système : la démo avant l'écran de démarrage ».
//
// Le MOTEUR est celui de l'application entreprise (`src/renderer/visite.js`), chargé tel quel : le
// projecteur, la bulle, les chapitres, l'étape « liste » qui explique chaque bouton d'une zone, et
// l'algorithme qui dit ce que fait un contrôle (`Visite.expliqueur`). Ce fichier n'apporte que ce qui
// est propre au Cabinet : ses pages, ses écrans de comptabilité, ses boutons, ses gestes. Un second
// moteur aurait divergé du premier au premier réglage (7.29.0).
//
// Trois familles, comme côté entreprise, et l'Aide n'en remplace aucune :
//   - la DÉCOUVERTE : le grand tour, sur les six dossiers de l'exemple — un client à jour, un en retard,
//     un qui n'envoie que du provisoire, un endormi, un dont on rapproche la banque et révise l'exercice,
//     un hors SkanFact dont on tient tout (paie et biens compris) ;
//   - les ÉCRANS : chaque page et chacun des quatorze écrans de la comptabilité d'un dossier, bloc par
//     bloc, chaque bouton nommé et expliqué ;
//   - les GESTES : pour de vrai, guidé clic par clic — nommer son cabinet, ajouter ses clients, remettre
//     le fichier d'appairage, enregistrer sa clé de secours, recevoir un paquet, saisir une pièce…
//
// Règles d'écriture, tenues par des tests (`test/suites/cabvisites.js`) : une cible se désigne par ce
// qu'elle EST, jamais par son rang ni par sa couleur ; une étape « faire » porte son `essai` ; ce qu'une
// visite cite « entre guillemets » existe dans l'application ; le texte tutoie et dit le POURQUOI.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../../renderer/visite.js'));
  else root.CabVisites = factory(root.Visite);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  // Les familles de « Me guider ». `couleur` : un des sept domaines de la feuille partagée (`th-<nom>`),
  // les mêmes que ceux de l'Aide du Cabinet — la visite, la carte et l'article parlent la même langue.
  const THEMES = [
    { id: 'demarrer', titre: 'Pour commencer', sous: 'Découvrir sur l\'exemple, puis poser ton cabinet', aide: 'demarrer', couleur: 'commencer' },
    { id: 'portefeuille', titre: 'Le portefeuille', sous: 'Tes clients, leurs mois, ce qui manque, les relances', aide: 'travail', couleur: 'vendre',
      icone: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' },
    { id: 'recevoir', titre: 'Les clients sur SkanFact', sous: 'Leurs paquets, leurs questions, ta clôture', aide: 'paquet', couleur: 'encaisser',
      icone: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>' },
    { id: 'saisir', titre: 'Tenir le livre', sous: 'La saisie, la banque, la paie, les biens', aide: 'saisir', couleur: 'acheter',
      icone: '<path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 13h8M8 17h5"/>' },
    { id: 'declarer', titre: 'Déclarer et clôturer', sous: 'La TVA du mois, la révision, l\'exercice, la liasse', aide: 'declaration', couleur: 'declarer' },
    { id: 'cabinet', titre: 'Ton cabinet et tes données', sous: 'Sauvegardes, clé de secours, équipe, licence, mises à jour', aide: 'filets', couleur: 'piloter',
      icone: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M9.2 12.2l2 2 3.6-3.8"/>' },
    { id: 'pages', titre: 'Chaque écran, bouton par bouton', sous: 'À quoi il sert, et ce que fait chacun de ses boutons', aide: null, couleur: 'commencer' }
  ];

  // Les quatorze écrans de la comptabilité d'un dossier. La liste de l'application
  // (`ONGLETS_COMPTA`, app.js) et celle-ci sont confrontées par un test : un quinzième écran naîtrait
  // sinon sans visite.
  const ECRANS = ['saisie', 'banque', 'paie', 'immobilisations', 'inventaire', 'journal', 'grand-livre', 'balance',
    'lettrage', 'recherche', 'declaration', 'revision', 'exercice', 'liasse'];
  // La couleur de la visite d'une page : celle de son domaine.
  const COULEUR_PAGE = {
    dossiers: 'vendre', relances: 'encaisser', echeances: 'declarer', ecritures: 'declarer', production: 'piloter',
    reglages: 'piloter', aide: 'commencer', guide: 'commencer', dossier: 'vendre', 'dossier-paquets': 'encaisser', compta: 'declarer',
    'compta-saisie': 'acheter', 'compta-banque': 'encaisser', 'compta-paie': 'equipe', 'compta-immobilisations': 'acheter',
    'compta-inventaire': 'acheter', 'compta-journal': 'declarer', 'compta-grand-livre': 'declarer', 'compta-balance': 'declarer',
    'compta-lettrage': 'encaisser', 'compta-recherche': 'piloter', 'compta-declaration': 'declarer', 'compta-revision': 'declarer',
    'compta-exercice': 'declarer', 'compta-liasse': 'declarer'
  };
  const iconeDe = v => { const t = v && THEMES.find(x => x.id === (v.theme || v.id)); return (t && t.icone) || ''; };
  const couleurDe = v => {
    if (!v) return '';
    if (v.couleur) return v.couleur;
    if (v.type === 'page' && COULEUR_PAGE[v.route]) return COULEUR_PAGE[v.route];
    const t = THEMES.find(x => x.id === v.theme);
    return (t && t.couleur) || '';
  };

  // La CLÉ d'un écran, lue dans l'adresse : `#/dossier/<id>/comptabilite/banque` → « compta-banque ».
  // C'est elle qui choisit la visite de la page, la bande « Première fois sur cette page ? » et les
  // explications propres à un écran (un même bouton ne fait pas la même chose partout).
  function cleDePage(hash) {
    const p = String(hash == null ? ((typeof location !== 'undefined' && location.hash) || '') : hash).replace(/^#\/?/, '').split('/');
    const r = p[0] || 'dossiers';
    if (r !== 'dossier') return r;
    const o = decodeURIComponent(p[2] || 'suivi');
    if (o === 'comptabilite') return p[3] ? 'compta-' + decodeURIComponent(p[3]) : 'compta';
    return o === 'paquets' ? 'dossier-paquets' : 'dossier';
  }

  // ========================================================================== CE QUE CHAQUE ÉCRAN EST
  // `dossier` : l'écran vit DANS un dossier — la visite s'ouvre sur celui qu'on regarde, sinon sur le
  // dossier de l'exemple qui le montre rempli (`livre` : un dossier qui a son livre).
  const PAGES = {
    dossiers: { titre: 'Les dossiers', resume: 'Ton portefeuille : chaque client, son dernier mois, ce qui manque.',
      texte: '<p>La page où le Cabinet s\'ouvre. Chaque client sur une ligne : le dernier mois reçu ou saisi, son chiffre d\'affaires, ce qui manque — et la dernière relance quand il y en a eu une (une colonne vide se masque).</p><p>Au-dessus, les chiffres du portefeuille et <b>« À faire »</b> : ce qui attend un geste de ta part, du plus urgent au moins urgent.</p>' },
    relances: { titre: 'Les relances', resume: 'Les clients qui te doivent un mois, et le mail tout prêt.',
      texte: '<p>Les clients sur SkanFact qui ne t\'ont pas envoyé un mois terminé, ou seulement du provisoire. Pour chacun, <b>le mail est prêt</b> : tu relis, tu envoies.</p><p>Une relance faite ailleurs (un appel) se note aussi : l\'historique dit qui a été relancé, et quand.</p>' },
    echeances: { titre: 'Les échéances', resume: 'Les dates fiscales du mois, et qui n\'a pas ses pièces avant.',
      texte: '<p>Un calendrier, tu en as déjà un. Ce que personne ne fait pour toi : <b>nommer les clients dont tu n\'as pas les pièces</b> avant chaque échéance — TVA, CNSS, déclarations annuelles.</p><p>Tu pointes chaque dépôt : c\'est un pense-bête, SkanFact ne dépose rien.</p>' },
    ecritures: { titre: 'L\'export d\'écritures', resume: 'Les écritures de plusieurs clients, en un fichier pour ton logiciel.',
      texte: '<p>Tu choisis une période : les écritures de tous les paquets reçus sont regroupées, <b>dans le format de ton logiciel</b>, en un seul fichier.</p><p>Un paquet illisible ne fait pas échouer l\'export : il part sans lui, et le manque est nommé.</p>' },
    production: { titre: 'La production', resume: 'Où en est chaque dossier, mois par mois : reçu, saisi, révisé, déclaré.',
      texte: '<p>Le tableau de bord du cabinet : pour chaque dossier et chaque mois, l\'étape atteinte. Filtré par collaborateur, c\'est <b>ton « À faire » personnel</b>.</p>' },
    reglages: { titre: 'Les réglages', resume: 'Ton cabinet, ta comptabilité, tes données, l\'application.',
      texte: '<p>Quatre onglets : <b>ton cabinet</b> (nom, fichier d\'appairage, équipe, licence), <b>la comptabilité</b> (la grille, les guides, la liasse), <b>tes données</b> (sauvegardes, clé de secours) et <b>l\'application</b> (thème, mises à jour).</p><p>La recherche en haut trouve un réglage par son nom, même dans un autre onglet.</p>' },
    aide: { titre: 'L\'Aide', resume: 'Chaque sujet expliqué en détail, avec son geste.',
      texte: '<p>Les articles qui expliquent le métier du Cabinet : les paquets, la tenue, la banque, la déclaration, la révision, la clôture. <b>Chaque article finit par son geste</b>, qui t\'emmène au bon écran.</p>' },
    guide: { titre: 'Me guider', resume: 'Toutes les visites guidées, et où tu en es.',
      texte: '<p>La découverte sur l\'exemple, les gestes guidés clic par clic, et la visite de chaque écran. Ce que tu as déjà fait est coché.</p>' },
    dossier: { titre: 'La fiche d\'un dossier', resume: 'Un client : ses mois, ses relances, sa comptabilité, ses paquets.', dossier: 'client',
      texte: '<p>Tout ce qui concerne un client, en trois onglets : <b>Suivi</b> (ses douze mois, ses relances, ta note), <b>Comptabilité</b> (son livre) et <b>Paquets</b> (ce qu\'il t\'a envoyé).</p><p>En haut, qui il est, et l\'état du dossier en une phrase.</p>' },
    'dossier-paquets': { titre: 'Les paquets d\'un client', resume: 'Chaque paquet reçu, vérifié pièce par pièce.', dossier: 'skanfact',
      texte: '<p>Chaque mois reçu : définitif ou provisoire, son chiffre d\'affaires, et le verdict de la vérification — <b>chaque pièce comparée à son empreinte</b>. Un paquet s\'ouvre pour lire ses journaux et ses justificatifs.</p>' },
    compta: { titre: 'La comptabilité d\'un dossier', resume: 'Le livre du client, rangé en trois groupes.', dossier: 'livre',
      texte: '<p>Quatorze écrans, rangés dans l\'ordre du mois : <b>Saisir</b> (la grille, la banque, la paie, les biens), <b>Consulter</b> (journal, grand livre, balance, lettrage) et <b>Déclarer et clôturer</b>.</p><p>Chaque dossier rouvre sur l\'écran où tu l\'as laissé.</p>' },
    'compta-saisie': { titre: 'La saisie', resume: 'La grille où l\'on tape les pièces, au clavier.', dossier: 'hors',
      texte: '<p>La grille de saisie : une pièce, ses lignes, et le solde qui se calcule pendant la frappe. <b>Tout se fait au clavier</b> — Entrée descend, Tab solde la pièce.</p><p>Une pièce s\'enregistre en <b>brouillard</b> (elle se corrige), puis se <b>valide</b> : elle reçoit son numéro et ne se modifie plus.</p>' },
    'compta-banque': { titre: 'La banque', resume: 'Le relevé importé, et chaque ligne rapprochée de son écriture.', dossier: 'skanfact',
      texte: '<p>Tu importes le relevé de la banque, puis chaque ligne trouve l\'écriture qui lui répond. <b>L\'automatique ne pose que le certain</b> ; une ambiguïté t\'est proposée, jamais tranchée à ta place.</p><p>Ce qui reste — les suspens — doit expliquer tout l\'écart entre la banque et le livre.</p>' },
    'compta-paie': { titre: 'La paie', resume: 'Les salariés du client, leurs bulletins, l\'écriture du mois.', dossier: 'hors',
      texte: '<p>Les salariés d\'un client que tu tiens, leurs bulletins mois par mois, et <b>l\'écriture de paie</b> passée en brouillard au dernier jour du mois.</p><p>Les taux (CNSS, IRPP) sont des barèmes réglables, jamais écrits en dur.</p>' },
    'compta-immobilisations': { titre: 'Les immobilisations', resume: 'Les biens du client, leur plan, leurs dotations.', dossier: 'hors',
      texte: '<p>Ce que le client garde plusieurs années, et son <b>plan d\'amortissement</b>. Les dotations se passent en fin d\'exercice ; une cession sort le bien du bilan.</p>' },
    'compta-inventaire': { titre: 'L\'inventaire', resume: 'Le stock compté en fin d\'exercice, et sa variation.', dossier: 'hors',
      texte: '<p>Le stock compté à la clôture, collé depuis un tableur si tu veux. La <b>variation de stock</b> s\'écrit toute seule, dans le bon sens.</p>' },
    'compta-journal': { titre: 'Le livre-journal', resume: 'Chaque pièce, dans l\'ordre, avec son numéro.', dossier: 'livre',
      texte: '<p>Toutes les pièces du livre, datées et numérotées. Le numéro naît à la <b>validation</b> et ne bouge plus ; un brouillard n\'en a pas encore.</p>' },
    'compta-grand-livre': { titre: 'Le grand livre', resume: 'Chaque compte, ses mouvements, son solde.', dossier: 'livre',
      texte: '<p>Chaque compte replié sur sa ligne — mouvements, débit, crédit, solde. <b>Un compte s\'ouvre d\'un clic</b> sur ses écritures, avec le solde qui avance.</p>' },
    'compta-balance': { titre: 'La balance', resume: 'Un compte par ligne, et les totaux qui tombent juste.', dossier: 'livre',
      texte: '<p>La balance générale, et les auxiliaires clients et fournisseurs. Le premier contrôle d\'un comptable : <b>les totaux tombent juste</b>, et l\'auxiliaire égale son collectif.</p>' },
    'compta-lettrage': { titre: 'Le lettrage', resume: 'Quelle facture est réglée par quel paiement, et ce qui reste ouvert.', dossier: 'livre',
      texte: '<p>Les factures encore ouvertes, client par client et fournisseur par fournisseur. Le lettrage ne relie que ce qui se solde <b>exactement</b> : un règlement partiel reste ouvert.</p>' },
    'compta-recherche': { titre: 'La recherche', resume: 'Retrouver une écriture par son montant, son compte ou son libellé.', dossier: 'livre',
      texte: '<p>Tape un montant, un compte, un mot du libellé : <b>les pièces entières</b> qui correspondent s\'affichent, jamais une ligne coupée de sa pièce.</p>' },
    'compta-declaration': { titre: 'La déclaration', resume: 'Les cases de la TVA du mois, tirées du livre.', dossier: 'skanfact',
      texte: '<p>Les chiffres que tu recopies sur le portail : TVA collectée, déductible, retenues, timbre. Une case dont la règle n\'est pas connue vaut <b>« — »</b> avec sa raison, jamais zéro.</p><p>Quatre gestes dans l\'ordre : préparer, écrire, déposée, payée — SkanFact ne dépose rien.</p>' },
    'compta-revision': { titre: 'La révision', resume: 'Les cycles, les comptes à revoir, les questions au client.', dossier: 'skanfact',
      texte: '<p>Ton dossier de travail : chaque cycle (trésorerie, ventes, achats…) et ses comptes, que tu signes un par un. Une question au client <b>naît sur une ligne</b>, et s\'affiche chez lui en face de la pièce.</p>' },
    'compta-exercice': { titre: 'L\'exercice', resume: 'Les contrôles avant clôture, la clôture, les à-nouveaux.', dossier: 'skanfact',
      texte: '<p>Les contrôles qui nomment ce qui manque (sans jamais bloquer), les soldes intermédiaires de gestion, puis la <b>clôture</b> : définitive, tracée, et le fichier qui part chez le client.</p>' },
    'compta-liasse': { titre: 'La liasse', resume: 'Les états financiers, rubrique par rubrique.', dossier: 'skanfact',
      texte: '<p>Le bilan et l\'état de résultat, déduits de la balance selon un <b>modèle de rubriques que tu ajustes</b>. Ce qu\'aucune rubrique ne capte est montré, jamais perdu.</p>' }
  };

  // Les blocs de l'écran que la visite d'une page nomme — les plus précis d'abord.
  const ZONES = [
    { sel: '#demo-banner', titre: 'Des dossiers d\'exemple', texte: 'Ils sont fictifs : rien de ce que tu fais dessus ne compte. Ils disparaissent au premier vrai paquet, ou d\'un clic.' },
    { sel: '#guide-band', titre: 'La visite de cet écran', texte: 'Proposée les trois premières fois que tu l\'ouvres. Tu la retrouves ensuite dans « Me guider ».' },
    { sel: '.premiers-pas', titre: 'Tes premiers pas', texte: 'L\'ordre des choses pour démarrer le Cabinet. Chaque étape se coche <b>toute seule</b> quand c\'est fait.' },
    { sel: '.page-head', titre: 'Le haut de l\'écran', texte: 'Le titre dit où tu es. À droite, les gestes de la page : <b>un seul est vert</b>, c\'est l\'étape suivante.' },
    { sel: '#d-tabs', titre: 'Les trois onglets du dossier', texte: 'Suivi, Comptabilité, Paquets : l\'onglet vit dans l\'adresse, « ← » revient dessus.' },
    { sel: '#c-groupes', titre: 'Les trois groupes', texte: 'Saisir, Consulter, Déclarer et clôturer : l\'ordre du mois. Le chiffre sur un groupe dit ce qui y attend une décision.' },
    { sel: '.tabs', titre: 'Les onglets', texte: 'L\'écran se range en onglets. Je vais te les ouvrir un par un ; « Passer au chapitre suivant » en saute un.' },
    { sel: '.filters', titre: 'Retrouver une ligne', texte: 'La recherche lit le nom, le matricule et le téléphone pendant que tu tapes ; « n sur N » dit combien de lignes tu gardes.' },
    { sel: '.pager', titre: 'Les pages de la liste', texte: 'La liste se découpe en pages. Les totaux portent toujours sur <b>toute</b> la sélection.' },
    { sel: '.panel.todo', titre: 'À faire', texte: 'Ce qui attend un geste, du plus urgent au moins urgent. Chaque ligne a son bouton, qui dit où il mène.' },
    { sel: '.stats', titre: 'Les chiffres', texte: 'Chaque carte résume une liste : un clic l\'ouvre.' },
    { sel: '.help-search', titre: 'Chercher', texte: 'Tape un mot ou une question : la recherche lit le contenu, pas seulement les titres.' },
    { sel: '.scroll-x, table', titre: 'La liste', texte: 'Une ligne s\'ouvre d\'un clic. Les en-têtes marqués ⇅ trient la colonne ; « Actions » au bout de la ligne rassemble les autres gestes, chacun avec sa phrase.' },
    { sel: '.warn-box', titre: 'À savoir avant d\'agir', texte: 'Un avertissement se lit avant le geste, jamais après.' },
    { sel: '.banner', titre: 'À savoir', texte: '' }
  ];

  // ========================================================================== LES ONGLETS
  const ONGLETS = {
    'dossier:suivi': 'Les douze mois de l\'année, dans le sens du temps : reçu, provisoire, manquant, hors mission. Ses relances et ta note.',
    'dossier:comptabilite': 'Son livre : la saisie, la banque, la paie, les biens, les journaux, la déclaration, la révision et la clôture.',
    'dossier:paquets': 'Chaque paquet reçu, vérifié pièce par pièce, et le chiffre d\'affaires mois par mois.',
    suivi: 'Les douze mois du client, ses relances, ta note.', comptabilite: 'Son livre, en quatorze écrans.', paquets: 'Les paquets qu\'il t\'a envoyés.',
    saisie: 'La grille où l\'on tape les pièces au clavier, le brouillard et la validation.',
    banque: 'Le relevé importé, et chaque ligne rapprochée de son écriture.',
    paie: 'Les salariés du client et leurs bulletins, et l\'écriture de paie du mois.',
    immobilisations: 'Les biens du client, leur plan d\'amortissement, leurs dotations.',
    inventaire: 'Le stock compté à la clôture, et sa variation.',
    journal: 'Chaque pièce dans l\'ordre, avec son numéro.',
    'grand-livre': 'Chaque compte, ses mouvements, son solde.',
    balance: 'Un compte par ligne ; les auxiliaires clients et fournisseurs.',
    lettrage: 'Les factures encore ouvertes, et ce qui les solde.',
    recherche: 'Retrouver une écriture par son montant, son compte, son libellé.',
    declaration: 'Les cases de la TVA du mois, et les quatre gestes dans l\'ordre.',
    revision: 'Les cycles, les comptes à signer, les questions au client.',
    exercice: 'Les contrôles avant clôture, les soldes de gestion, la clôture.',
    liasse: 'Les états financiers, rubrique par rubrique.',
    'reglages:cabinet': 'Ton cabinet : son nom, le fichier à remettre à tes clients, les régimes, l\'équipe, la licence.',
    'reglages:compta': 'La comptabilité : les touches de la grille, les guides d\'écritures, la correspondance des comptes, la révision, la liasse.',
    'reglages:donnees': 'Tes données : la boîte de réception, les sauvegardes, la copie externe, la clé de secours, le mot de passe.',
    'reglages:app': 'L\'application : le thème, les mises à jour, le dépannage, l\'exemple.'
  };

  // ========================================================================== CE QUE FAIT CHAQUE BOUTON
  const B = [];
  const b = (cle, texte, o) => { B.push(Object.assign(/^#[\w-]+$/.test(cle) ? { id: cle.slice(1) } : { sel: cle }, { texte }, o || {})); };

  // ---------- partout ----------
  b('#back', 'Revient à l\'écran d\'où tu viens — il est nommé sur le bouton.', { nom: 'Retour' });
  b('#reset-f', 'Efface la recherche et les filtres : toute la liste revient.');
  b('#pg-prev, #pg-next, [data-pg]', 'Passe à la page précédente ou suivante de la liste.', { nom: 'Page précédente / suivante', cle: 'pager' });
  b('#pg-size', 'Combien de lignes tu vois à la fois. Les totaux portent toujours sur toute la sélection.', { nom: 'Lignes par page' });
  b('[data-sort]', 'Un clic trie la liste par cette colonne ; un second clic inverse l\'ordre.', { nom: 'Les en-têtes ⇅', cle: 'tri' });
  b('[data-rowmenu]', null, { rowmenu: true, nom: 'Actions', cle: 'rowmenu' });
  b('#gb-go', 'Lance la visite de cet écran : chaque bloc, chaque bouton, en une ou deux minutes.');
  b('#gb-non', 'Ne propose plus la visite de cet écran. Elle reste dans « Me guider ».');
  // 10.14.0 — « Annuler » ET « Fermer » portent ces attributs : « sans rien garder » était faux sur le
  // « Fermer » de « Le fichier est prêt » (le fichier est enregistré). L'explication dit ce qui est vrai
  // des deux, et le bouton garde SON nom — une explication fausse est pire qu'absente.
  b('[data-dismiss], [data-close]', 'Ferme la fenêtre. Ce qui est déjà enregistré le reste ; si tu viens de taper quelque chose, le Cabinet demande avant de le jeter.', { cle: 'fermer' });
  b('#no', 'Ferme sans rien faire.', { nom: 'Annuler', cle: 'non' });
  b('#ok', 'Valide ce que la fenêtre propose.', { nom: 'Valider', cle: 'ok' });
  b('.modal .modal-actions .btn-danger', 'Supprime, après confirmation. Le Cabinet dit d\'abord ce qui y est rattaché.', { nom: 'Supprimer', cle: 'supprimer' });
  b('.modal .modal-actions .btn-primary', 'Valide ce que tu viens de saisir dans la fenêtre.', { nom: 'Valider', cle: 'valider' });
  b('.collapse-h', 'Replie ou déplie cette section ; le choix est retenu.', { nom: 'Replier', cle: 'replier' });
  b('.sidebar nav a', 'Ouvre cette page du Cabinet. Le chiffre à côté dit ce qui y attend.', { nom: 'Le menu', cle: 'menu' });
  b('#upd-pill', 'Une mise à jour est prête ou en cours : ouvre le panneau des mises à jour.');
  b('#lic-banner', 'Où en est la licence de ton cabinet : ouvre le panneau qui compte les dossiers.');

  // ---------- les dossiers ----------
  b('#new-d', 'Ajoute un client, même s\'il n\'utilise pas encore SkanFact : il entre dans ton portefeuille, et rien ne lui est réclamé tant qu\'il n\'a pas commencé.');
  // Les boutons des états vides d'une PAGE : ils vivent dans une barre `.modal-actions` sans être dans
  // une fenêtre, et la famille « Valide ce que tu viens de saisir dans la fenêtre » leur répondait
  // (10.14.0). Chacun dit son propre geste.
  b('#nd', 'Ajoute tes clients : un par un, ou toute la liste collée depuis ton tableur. Leurs échéances apparaissent ici dès qu\'ils envoient un paquet ou que tu tiens leur livre.');
  b('#rl-nd', 'Ajoute tes clients : un par un, ou toute la liste collée depuis ton tableur. Ceux à qui il manque un mois arrivent ensuite ici, la relance déjà écrite.');
  b('#rl-imp', 'Importe un paquet reçu par mail (.skanpack) : le client entre dans ton portefeuille avec ses mois.');
  b('#ech-livre', 'Ouvre la comptabilité d\'un client que tu tiens toi-même : dès que son livre existe, ses déclarations entrent dans le calendrier.');
  b('#ech-pair', 'Enregistre le fichier à remettre à tes clients et prépare le message qui l\'envoie : quand ils l\'importent dans SkanFact, leurs paquets arrivent chez toi, et leurs échéances ici.');
  b('#lv-ecrire', 'Écrit au client qu\'aucun paquet n\'est arrivé : le mail est prêt, tu le relis avant qu\'il parte.');
  b('#rv-relire', 'Relit le fichier avec les colonnes que tu viens d\'associer : les lignes lues s\'affichent avant que rien n\'entre.');
  b('#s-rec-in', 'Restaure une clé de secours enregistrée ailleurs : les paquets qu\'elle ouvre redeviennent lisibles sur ce poste.');
  b('#imp', 'Importe un paquet reçu par mail (.skanpack). Tu peux aussi le glisser sur la fenêtre, ou le double-cliquer.');
  b('#demo-on', 'Charge six dossiers fictifs, pour voir chaque situation remplie. Ils disparaissent au premier vrai paquet.');
  b('#demo-off', 'Quitte l\'exemple : ses dossiers partent, tes vrais dossiers ne bougent pas.');
  b('#dz-retour', 'Ramène au portefeuille : le dossier qu\'on regardait n\'existe plus.');
  b('#demo-visite', 'Lance la découverte guidée sur les dossiers de l\'exemple.');
  b('#q', 'Tape un nom, un matricule, un téléphone : la liste se réduit pendant la frappe.', { nom: 'Chercher' });
  b('#arch', 'Montre aussi les clients archivés (partis) : ils ne sont plus relancés.', { nom: 'Archivés' });
  b('#onlysf', 'Ne garde que les clients qui t\'envoient leurs paquets depuis SkanFact.', { nom: 'Sur SkanFact seulement' });
  b('#par-urgence', 'Remet la liste dans l\'ordre de l\'urgence : les retards d\'abord.');
  b('#csv', 'Enregistre la liste affichée dans un fichier que ton tableur ouvre.', { nom: 'Exporter en CSV' });
  b('#col-tout', 'Affiche les colonnes vides que la liste masquait pour laisser la place aux autres.');
  b('#col-vides', 'Masque les colonnes qui n\'ont aucune valeur : les autres gagnent la place.');
  b('#todo-toggle', 'Replie ou déplie « À faire ». Le choix est retenu.', { nom: 'À faire' });
  b('#todo-plus', 'Montre les autres lignes de « À faire », ou les replie.');
  b('[data-todo]', 'T\'emmène là où ce qui attend se règle — le bouton dit où.', { nom: 'Le geste d\'une ligne', cle: 'todo' });
  b('[data-pf]', 'Ouvre la liste que cette carte résume.', { nom: 'Une carte du portefeuille', cle: 'carte' });
  b('#inbox-go', 'Importe les paquets arrivés dans ta boîte de réception.');
  b('#inbox-skip', 'Laisse ces paquets pour plus tard : ils restent dans la boîte.');
  b('#rec-banniere', 'Enregistre ta clé de secours : sans elle, perdre cet ordinateur rend les paquets reçus illisibles pour toujours.');
  b('[data-pas]', 'T\'emmène là où cette étape se fait.', { nom: 'Le geste d\'une étape', cle: 'pas' });
  b('[data-pas-guide]', 'Je te montre où cliquer pour cette étape, clic par clic.', { nom: 'Me guider', cle: 'pas-guide' });

  // ---------- la fiche d'un dossier ----------
  b('#edit', 'Modifie la fiche du client : son nom, son matricule, ses coordonnées, ses honoraires.');
  b('#d-tabs button', null, { onglet: true });
  b('#note-rel', 'Note une relance faite ailleurs (un appel, un message) : l\'historique la garde.');
  b('[data-m]', 'Ce mois-là : reçu, provisoire, manquant ou hors mission. Un mois manquant porte le geste qui le réclame.', { nom: 'Un mois', cle: 'mois' });
  b('#lv-relire', 'Crée le livre de ce client à partir des paquets reçus : ses écritures arrivent déjà écrites.');
  b('#lv-relire2', 'Relit les paquets reçus pour mettre le livre à jour.');
  b('#lv-saisir', 'Ouvre la saisie de ce dossier.');
  b('#lv-relancer', 'Prépare la relance de ce client pour les mois qui manquent.');
  b('#lv-reprendre', 'Reprend l\'ouverture de l\'exercice : les soldes de départ d\'un client qui arrive au cabinet.');
  b('#lv-brouillard', 'Montre aussi les pièces en brouillard, pas encore validées.', { nom: 'Brouillard' });
  b('#c-groupes button', 'Ouvre ce groupe d\'écrans : Saisir, Consulter, ou Déclarer et clôturer.', { nom: 'Les groupes', cle: 'groupe' });
  b('#c-tabs button', null, { onglet: true });

  // ---------- la saisie ----------
  b('#sa-ajouter', 'Ajoute une ligne à la pièce. Au clavier, Entrée sur la dernière ligne le fait aussi.');
  b('#sa-ok', 'Enregistre la pièce en brouillard : elle se corrige encore, et n\'a pas de numéro.');
  b('#sa-okvalider', 'Enregistre et valide : la pièce reçoit son numéro et ne se modifie plus (elle se contre-passe).');
  b('#sa-vider', 'Efface la pièce en cours pour repartir d\'une grille vide.');
  b('#sa-joindre', 'Joint un justificatif à la pièce : le fichier est copié dans le dossier.');
  b('#sa-guide', 'Préremplit la pièce avec un guide d\'écriture (un loyer, un salaire…).', { nom: 'Guide' });
  b('[data-sup]', 'Retire cette ligne de la pièce en cours.', { nom: 'Retirer la ligne', cle: 'sup-ligne' });
  b('#ab-new', 'Crée un abonnement : une pièce qui revient chaque mois (un loyer), générée en brouillard.');
  b('#ab-gen', 'Génère en brouillard les pièces des abonnements arrivés à échéance.');
  b('#ab-guides', 'Ouvre les guides d\'écritures dans les Réglages : un abonnement s\'appuie sur un guide, écrit une fois pour tous tes dossiers.');

  // ---------- la banque ----------
  b('#bq-import', 'Importe le relevé de la banque (CSV). Tu vérifies les colonnes et les soldes avant qu\'il entre.');
  b('#bq-auto', 'Rapproche automatiquement ce qui est certain. Une ambiguïté t\'est proposée, jamais tranchée.');
  b('#bq-releve', 'Choisis le relevé à regarder.', { nom: 'Relevé' });
  b('#bq-filtre', 'Filtre les lignes du relevé : à rapprocher, rapprochées, toutes.', { nom: 'Filtre' });

  // ---------- la déclaration ----------
  b('#dc-preparer', 'Fige les cases du mois dans le livre. Tant que rien n\'est déposé, tu peux recalculer.');
  b('#dc-ecriture', 'Passe l\'écriture de TVA du mois en brouillard, au dernier jour du mois.');
  b('#dc-deposee', 'Note que la déclaration est déposée — un pense-bête : le Cabinet ne dépose rien.');
  b('#dc-payee', 'Note que la TVA est payée. Le règlement, lui, vient du relevé bancaire.');
  b('#dc-pieces', 'Ouvre les pièces qui font ce chiffre.');
  b('#dc-csv', 'Enregistre les cases de la déclaration dans un fichier.');
  b('#dc-mois', 'Le mois déclaré.', { nom: 'Mois' });

  // ---------- la révision, l'exercice, la liasse ----------
  b('#rv-poser', 'Pose les questions de ton questionnaire de fin d\'exercice à ce client.');
  b('#rv-arreter', 'Arrête la révision de la période (ou la rouvre) : les contrôles nomment ce qui manque, sans bloquer.');
  b('#rv-envoyer', 'Écrit le fichier des questions à envoyer au client : elles s\'affichent chez lui en face de la pièce.');
  b('#rv-question', 'Pose une question au client sur une pièce.');
  b('#cl-cloturer', 'Clôture l\'exercice, après les contrôles : c\'est définitif et tracé.');
  b('#cl-rouvrir', 'Rouvre un exercice clôturé. Un motif est demandé : c\'est la trace qui explique pourquoi un chiffre a changé.');
  b('#cl-fichier', 'Enregistre le fichier de clôture à remettre au client.');
  b('#cl-suivant', 'Ouvre l\'exercice suivant : les à-nouveaux se calculent sur les écritures réelles.');
  b('#li-modele', 'Ajuste le modèle de rubriques de la liasse : ce qui va dans chaque case.');
  b('#li-csv', 'Enregistre la liasse dans un fichier.');

  // ---------- paie, biens, inventaire ----------
  b('#pa-bulletin, #pa-bulletin2', 'Établit le bulletin d\'un salarié pour le mois choisi.', { nom: 'Bulletin', cle: 'bulletin' });
  b('#pa-salarie, #pa-salarie2', 'Déclare un salarié : son contrat, son salaire, son numéro CNSS.', { nom: 'Salarié', cle: 'salarie' });
  b('#pa-ecrire', 'Passe l\'écriture de paie du mois en brouillard.');
  b('#pa-mois', 'Le mois de paie affiché.', { nom: 'Mois' });
  b('#im-neuf, #im-neuf2', 'Ajoute un bien : sa valeur, sa mise en service, sa durée.', { nom: 'Ajouter un bien', cle: 'bien' });
  b('#im-ecrire', 'Passe les dotations de l\'exercice en brouillard, au dernier jour.');
  b('#im-csv', 'Enregistre le tableau des immobilisations dans un fichier.');
  b('#iv-saisir, #iv-saisir2', 'Saisit ou reprend l\'inventaire de fin d\'exercice.', { nom: 'Inventaire', cle: 'inventaire' });
  b('#iv-ecrire', 'Passe l\'écriture de variation de stock.');

  // ---------- les pages du portefeuille ----------
  b('[data-rel]', 'Écrit la relance de ce client : le mail est prêt, tu le relis.', { nom: 'Écrire', cle: 'relancer' });
  b('#rl-all', 'Coche ou décoche tous les clients affichés.', { nom: 'Tout cocher' });
  b('#rl-tout', 'Relance tous les clients cochés, d\'un geste.');
  b('#e-go', 'Fabrique le fichier des écritures de la période, pour tous les paquets reçus.');
  b('#e-from, #e-to', 'Le début et la fin de la période exportée.', { nom: 'Période', cle: 'periode' });
  b('#pr-collab', 'Ne montre que les dossiers confiés à ce collaborateur.', { nom: 'Collaborateur' });
  b('#pr-vers-dossiers', 'Revient à la liste des dossiers.');

  // ---------- les réglages ----------
  b('#set-tabs button', null, { onglet: true });
  b('#set-q', 'Tape le nom d\'un réglage : la recherche dit dans quel onglet il est rangé.', { nom: 'Chercher un réglage' });
  b('#c-save', 'Enregistre les informations de ton cabinet.');
  b('#c-pair', 'Enregistre le fichier d\'appairage, puis prépare le message qui l\'envoie à tes clients : il ne contient rien de secret.');
  b('#ap-ecrire', 'Ouvre ta messagerie avec le message tout prêt : tes clients en copie cachée, ce qu\'ils doivent faire, et l\'empreinte à vérifier.');
  b('#ap-montrer', 'Montre le fichier dans son dossier, pour le glisser dans le message.');
  b('#c-copier-emp, #w-copier-emp, #lic-copier-emp', 'Copie l\'empreinte de ton cabinet, pour la dicter ou l\'envoyer.', { nom: 'Copier', cle: 'copier-emp' });
  b('#eq-add', 'Déclare un collaborateur et son rôle : qui saisit, qui valide.');
  b('#lic-ask', 'Prépare le mail de demande de licence, avec l\'empreinte de ton cabinet.');
  b('#lic-save', 'Enregistre la clé de licence collée.');
  b('#lic-clear', 'Retire la clé de licence de ce poste.');
  b('#b-now', 'Prend une sauvegarde tout de suite, en plus de celle du matin.');
  b('#b-ext', 'Choisit le dossier où tout est recopié hors de cet ordinateur : clé USB, disque, iCloud ou OneDrive.');
  b('#b-ext-off', 'Arrête la copie externe. Ce qui est déjà copié reste là-bas.');
  b('#b-mirror', 'Recopie tout de suite vers la copie externe.');
  b('#b-open', 'Montre le dossier des sauvegardes dans l\'explorateur de fichiers.');
  b('#s-rec', 'Enregistre la clé de secours : un fichier protégé par son propre mot de passe, à ranger ailleurs que sur cet ordinateur.');
  b('#s-pw', 'Change le mot de passe du cabinet : les sauvegardes et les livres sont rechiffrés.');
  b('#s-lock', 'Verrouille le Cabinet tout de suite : le mot de passe sera redemandé.');
  b('#s-support', 'Prépare un mail avec le journal de l\'application, pour signaler un problème.');
  b('#s-idee', 'Propose une amélioration : ce que tu aimerais faire, et comment tu fais aujourd\'hui.');
  b('#r-demo-on', 'Charge les six dossiers de l\'exemple.');
  b('#r-demo-off', 'Efface les dossiers de l\'exemple.');
  b('#i-pick', 'Choisit le dossier où tu ranges les paquets reçus : le Cabinet y regarde à chaque retour.');
  b('#i-off', 'Arrête de surveiller la boîte de réception.');
  b('[data-restore]', 'Restaure cette sauvegarde, après t\'avoir dit ce que tu perdrais. L\'état actuel est mis de côté d\'abord.', { nom: 'Restaurer', cle: 'restaurer' });

  // ---------- l'aide et le guide ----------
  b('#aide-q, #guide-q', 'Tape un mot ou une question : la recherche lit le contenu.', { nom: 'Chercher' });
  b('#aide-effacer', 'Efface la recherche.');
  b('[data-visite]', 'Lance cette visite guidée.', { nom: 'Lancer la visite', cle: 'visite' });
  b('#g-prochain, #g-reprendre', 'Lance le prochain geste guidé, ou reprend la visite laissée en pause.', { nom: 'Prochaine visite', cle: 'prochain' });
  b('#g-aide', 'Ouvre l\'Aide, pour lire le détail d\'un sujet.');
  b('#guide-proposer', 'Propose la visite d\'un écran la première fois que tu l\'ouvres.', { nom: 'Proposer les visites' });

  // Les champs sans bulle « i » : par leur nom ou leur identifiant (`#…`).
  const CHAMPS = {
    '#f-name': 'Le nom du client, tel qu\'il s\'écrit sur ses papiers.',
    '#f-mat': 'Son matricule fiscal : c\'est lui qui identifie le dossier.',
    '#f-email': 'L\'adresse où partent tes relances.',
    '#f-phone': 'Le téléphone, pour appeler depuis la fiche.',
    '#f-contact': 'La personne qui suit le dossier chez le client.',
    '#f-note': 'Ce qu\'il faut se rappeler de ce client. Jamais envoyé.',
    '#c-name': 'Le nom de ton cabinet : il signe tes relances et le fichier que tes clients importent.',
    '#c-email': 'L\'adresse de ton cabinet.',
    '#c-phone': 'Le téléphone de ton cabinet.',
    '#w-name': 'Le nom de ton cabinet : il signe tes relances et le fichier que tes clients importent.',
    '#w-email': 'L\'adresse de ton cabinet.',
    '#w-phone': 'Le téléphone de ton cabinet.',
    '#w-clients': 'Colle ta liste de clients, un par ligne : nom ; matricule ; email ; téléphone.',
    '#sa-date': 'La date de la pièce : tape le jour seul, ou la date entière.',
    '#sa-journal': 'Le journal de la pièce : achats, ventes, banque, opérations diverses…',
    '#sa-piece': 'La référence de la pièce (le numéro de la facture, du chèque).',
    '#sa-libelle': 'Ce que dit la pièce, en quelques mots : il se reporte sur chaque ligne.',
    '#lv-q': 'Tape un numéro de pièce, un compte, un montant : les pièces entières qui correspondent restent.',
    '#re-q': 'Tape un montant, un compte, un mot du libellé.',
    '#note-rel': 'Ta note sur ce client.'
  };

  const MENUS = {
    dossiers: 'Ouvrir la fiche, écrire la relance, noter une relance, modifier ou archiver le client.',
    relances: 'Ouvrir la fiche, noter une relance faite ailleurs, voir l\'historique.',
    'dossier-paquets': 'Ouvrir le paquet, lire ses journaux et ses justificatifs, le montrer dans le dossier, le retirer.',
    'compta-saisie': 'Modifier, valider, joindre un justificatif, supprimer un brouillard.',
    'compta-journal': 'Ouvrir la pièce, joindre un justificatif, contre-passer, extourner.',
    'compta-banque': 'Choisir ou voir l\'écriture en face, écrire l\'écriture manquante, défaire le rapprochement.',
    'compta-revision': 'Signer le compte, le remettre à revoir, poser une question.',
    'compta-immobilisations': 'Modifier le bien, le céder, voir son plan.',
    'compta-paie': 'Modifier le bulletin, voir son calcul, le supprimer.',
    reglages: 'Restaurer, montrer, supprimer une sauvegarde.'
  };

  // Les familles de champs propres au Cabinet, reconnues à leur forme.
  const familles = (el, lab) => {
    if (el.matches('.sa-compte, input[data-k="compte"]')) return { cle: 'compte', nom: lab || 'Compte', texte: 'Le numéro de compte : tape les premiers chiffres, le nom du compte s\'affiche à côté.' };
    if (el.matches('.sa-montant, input[data-k="debit"], input[data-k="credit"]')) return { cle: 'montant', nom: lab || 'Montant', texte: 'Le montant, au débit ou au crédit. Tab solde la pièce sur la dernière ligne.' };
    if (el.matches('input[data-k="libelle"]')) return { cle: 'libelle-ligne', nom: lab || 'Libellé', texte: 'Le libellé de la ligne ; vide, il reprend celui de la pièce.' };
    return null;
  };
  const route = () => cleDePage();
  const expliquer = M.expliqueur({ B, ONGLETS, CHAMPS, MENUS, route, familles,
    guide: () => (typeof window !== 'undefined' && window.CabGuide) || null });
  const zone = M.zoneur(ZONES);

  // ========================================================================== LES VISITES
  // `ctx` : ce que l'application prête — son état, le moteur, et de quoi désigner un dossier.
  //   ctx.state()            l'état du cabinet (sans la clé privée)
  //   ctx.dossier(sorte)     l'identifiant d'un dossier à montrer : 'skanfact' (un client qui envoie ses
  //                          paquets), 'hors' (un client tenu au cabinet), 'livre' (un dossier qui a son
  //                          livre), 'client' (n'importe lequel) — celui qu'on regarde d'abord, sinon celui
  //                          de l'exemple ; ou null
  //   ctx.estExemple()       l'exemple est-il chargé ?
  //   ctx.cleSecours()       true / false / null (on ne sait pas encore)
  //   ctx.copieExterne()     une copie hors de l'ordinateur est-elle posée ?
  function parcours(ctx) {
    const S = () => ctx.state() || {};
    const aucuneFenetre = () => !document.querySelector('#modal-root .modal');
    const reels = () => (S().dossiers || []).filter(d => !d.demo);
    const paquets = () => reels().reduce((n, d) => n + (d.packs || []).length, 0);
    const onglet = (barre, cle) => () => ctx.Visite.ouvrirOnglet(barre, cle);
    // L'adresse d'un écran dans un dossier : celui qu'on regarde s'il convient, sinon celui de l'exemple.
    const dans = (sorte, suite) => () => { const id = ctx.dossier(sorte); return id ? '#/dossier/' + encodeURIComponent(id) + '/' + suite : null; };
    const DOSSIER_MANQUE = {
      skanfact: { texte: 'Il faut un client qui t\'envoie ses paquets : importe son premier paquet, ou charge l\'exemple (Réglages → L\'application).', visite: 'recevoir-paquet' },
      hors: { texte: 'Il faut un client dont tu tiens le livre : crée un dossier et son livre, ou charge l\'exemple.', visite: 'ajouter-client' },
      livre: { texte: 'Il faut un dossier qui a son livre : crée le livre d\'un client, ou charge l\'exemple.', visite: 'ajouter-client' },
      client: { texte: 'Il faut au moins un client dans ton portefeuille.', visite: 'ajouter-client' }
    };

    const L = [];
    const visite = v => { L.push(v); return v; };

    // ======================================================================= LA DÉCOUVERTE
    // Le grand tour, sur l'exemple : six dossiers qui montrent chaque situation remplie. Le compte des
    // chapitres n'est écrit dans aucune bulle : il se lit dans l'en-tête, calculé.
    const beji = sous => dans('skanfact', sous);
    // Le garage de l'exemple tient DEUX exercices (10.14.0) : le précédent, clos — rouvert une fois
    // avec son motif, puis reclos —, et le courant, ouvert par ses à-nouveaux. L'exercice vit dans
    // l'adresse (`…/comptabilite/<écran>/<année>`) : chaque étape dit lequel elle montre, au lieu de
    // dépendre de celui que la page avait en mémoire. Aucune année n'est écrite ici : elles se lisent
    // dans le résumé des index (`ctx.exercices`), sans ouvrir un livre.
    const anneeDuGarage = clos => {
      const l = (typeof ctx.exercices === 'function' ? ctx.exercices('hors') : []).filter(e => !!e.clos === !!clos).map(e => String(e.annee)).sort();
      return l.length ? l[l.length - 1] : '';
    };
    const garageEn = (clos, suite) => () => {
      const id = ctx.dossier('hors');
      if (!id) return null;
      const a = anneeDuGarage(clos);
      return '#/dossier/' + encodeURIComponent(id) + '/' + suite + (a ? '/' + a : '');
    };
    const garage = sous => garageEn(false, sous);
    const garageDeuxExercices = () => !!anneeDuGarage(true) && !!anneeDuGarage(false);
    // Déplie une section repliée quand la page l'a posée (le livre se lit de façon asynchrone) ;
    // l'étape attend la promesse, bornée par le moteur.
    const ouvrirPli = sel => () => new Promise(res => {
      const limite = Date.now() + 2200;
      const essayer = () => {
        const d = typeof document !== 'undefined' ? document.querySelector(sel) : null;
        if (d) { if (d.tagName === 'DETAILS' && !d.open) d.open = true; res(true); return; }
        if (Date.now() >= limite) { res(false); return; }
        setTimeout(essayer, 60);
      };
      essayer();
    });
    visite({
      id: 'decouvrir', theme: 'demarrer', type: 'decouverte', exemple: true, duree: '10 min',
      titre: 'Découvrir le Cabinet avec l\'exemple',
      resume: 'Le grand tour sur six dossiers fictifs : chaque écran rempli, du portefeuille à la liasse, sans rien risquer.',
      mots: ['visite', 'decouvrir', 'commencer', 'exemple', 'tour', 'debutant', 'demo'],
      suite: ['nommer-cabinet', 'ajouter-client', 'page-dossiers'],
      bravo: 'Tu as fait le tour !',
      conclusion: '<p>Tu as vu le Cabinet rempli, du portefeuille à la liasse. Retiens : <b>le menu</b> à gauche, <kbd>Ctrl</kbd> <kbd>K</kbd> pour tout trouver — un client, un écran, un réglage — et <b>« Me guider »</b> dans le menu : chaque écran y a sa visite, bouton par bouton.</p><p>Les dossiers de l\'exemple restent tant que tu veux ; ils s\'effacent au premier vrai paquet reçu, ou d\'un clic.</p>',
      actions: () => [{ id: 'poser-cabinet', label: 'Poser mon cabinet', principal: true },
        { id: 'rester', label: 'Continuer à explorer l\'exemple', detail: 'Les dossiers fictifs restent jusqu\'à ce que tu les effaces' }],
      etapes: [
        // — Bienvenue
        { chapitre: 'Bienvenue', couleur: 'commencer', page: '#/dossiers', titre: 'Bienvenue dans l\'exemple',
          texte: '<p>Voici <b>six dossiers fictifs</b> : un client à jour, un en retard, un qui n\'envoie que du provisoire, un endormi, un dont tu rapproches la banque et révises l\'exercice — et un client hors SkanFact dont tu tiens toute la comptabilité, paie et biens compris.</p><p>Je te fais faire le tour, chapitre par chapitre. <b>« Passer au chapitre suivant »</b> saute ce qui ne te concerne pas ; la croix met en pause, tu reprendras depuis « Me guider ».</p>' },
        { page: '#/dossiers', cible: '#demo-banner', cote: 'dessous', titre: 'Des dossiers d\'exemple',
          texte: 'Ce bandeau le rappelle tant que l\'exemple est là. Rien de ce que tu fais dessus ne compte, et tes vrais dossiers ne sont jamais touchés. <b>« Quitter l\'exemple »</b> les retire d\'un clic.' },
        { page: '#/dossiers', cible: '.sidebar nav', cote: 'droite', titre: 'Le menu',
          texte: 'Les dossiers, les relances, les échéances, l\'export d\'écritures, la production, les réglages — et <b>« Me guider »</b>. Au clavier, <kbd>Ctrl</kbd> <kbd>K</kbd> trouve un client, un écran ou un réglage de n\'importe où.' },
        // — Le portefeuille
        { chapitre: 'Le portefeuille', couleur: 'vendre', page: '#/dossiers', cible: '#view .stats', cote: 'dessous', titre: 'Les chiffres du portefeuille',
          texte: 'Combien de clients, combien sur SkanFact, combien sont à jour, combien sont en retard. <b>Chaque carte s\'ouvre</b> sur la liste qu\'elle résume.' },
        { page: '#/dossiers', cible: '.panel.todo', cote: 'dessous', titre: 'À faire',
          texte: 'Ce qui attend un geste de ta part, <b>du plus urgent au moins urgent</b> : un mois qui manque, une échéance proche, une question sans réponse. Chaque ligne a son bouton, qui dit où il mène.' },
        { page: '#/dossiers', cible: ['#view table.list', '#view .scroll-x'], zone: ['#view table.list', '#view .scroll-x'], cote: 'dessus', titre: 'Un client par ligne',
          texte: 'Le dernier mois reçu, son chiffre d\'affaires, ce qui manque — et la dernière relance quand il y en a eu une (une colonne vide se masque). La pastille de couleur dit l\'état — sa légende est sous le tableau. <b>Une ligne ouvre la fiche</b> du client.' },
        { page: '#/dossiers', cible: '#imp', cote: 'dessous', titre: 'Recevoir un paquet',
          texte: 'Chaque mois, un client sur SkanFact t\'envoie son paquet. <b>« Importer un paquet… »</b>, ou tu le glisses simplement sur la fenêtre : il est vérifié pièce par pièce, et rangé dans son dossier.' },
        // — Un client sur SkanFact
        { chapitre: 'Un client sur SkanFact', couleur: 'encaisser', page: beji('suivi'), cible: '#d-tabs', cote: 'dessous', titre: 'La fiche d\'un client',
          texte: 'Trois onglets : <b>Suivi</b> (ses douze mois, ses relances, ta note), <b>Comptabilité</b> (son livre) et <b>Paquets</b>. L\'onglet vit dans l\'adresse : « ← » revient dessus.' },
        { page: beji('suivi'), cible: ['#view .mois-annee', '#view .panel'], cote: 'dessous', titre: 'Ses douze mois',
          texte: 'L\'année dans le sens du temps : reçu, provisoire, manquant. <b>Un mois manquant porte le geste qui le réclame</b> — la relance part sur ce mois-là.' },
        { page: beji('paquets'), cible: ['#view table.list', '#view .panel'], cote: 'dessus', titre: 'Ses paquets',
          texte: 'Chaque paquet reçu, avec le verdict de la vérification : <b>chaque pièce comparée à son empreinte</b>. Un paquet s\'ouvre pour lire ses journaux et ses justificatifs.' },
        { page: beji('comptabilite/journal'), cible: '#c-groupes', cote: 'dessous', titre: 'Son livre, en trois groupes',
          texte: 'Ses écritures arrivent <b>déjà écrites</b>, depuis ses paquets. Trois groupes dans l\'ordre du mois : <b>Saisir</b>, <b>Consulter</b>, <b>Déclarer et clôturer</b>. Le chiffre sur un groupe dit ce qui y attend une décision.' },
        { page: beji('comptabilite/journal'), cible: ['#view table.list', '#c-livres .panel'], cote: 'dessus', titre: 'Le livre-journal',
          texte: 'Chaque pièce, datée et numérotée. Le numéro naît à la <b>validation</b> et ne bouge plus ; une validée ne se modifie jamais : elle se contre-passe.' },
        { page: beji('comptabilite/balance'), cible: ['#view table.list', '#c-livres .panel'], cote: 'dessus', titre: 'La balance',
          texte: 'Un compte par ligne, et les totaux qui tombent juste. L\'auxiliaire clients se confronte à son collectif : <b>les deux doivent dire la même chose</b>.' },
        { page: beji('comptabilite/banque'), cible: ['#bq-auto', '#c-livres .panel'], cote: 'dessous', titre: 'La banque',
          texte: 'Le relevé importé, et chaque ligne rapprochée de son écriture. <b>L\'automatique ne pose que le certain</b> ; une ambiguïté t\'est proposée, jamais tranchée.' },
        { page: beji('comptabilite/revision'), cible: ['#c-livres .panel'], cote: 'dessus', titre: 'La révision',
          texte: 'Chaque cycle et ses comptes, que tu signes un par un. Une question au client <b>naît sur une ligne</b> — et s\'affiche chez lui, dans SkanFact, en face de la pièce. Sa réponse revient dans son paquet suivant.' },
        // — Un client que tu tiens
        { chapitre: 'Un client que tu tiens', couleur: 'acheter', page: garage('comptabilite/saisie'), cible: ['#sa-tete', '#c-livres .panel'], cote: 'dessous', titre: 'La saisie',
          texte: 'Pour un client hors SkanFact, tu saisis ici. <b>Tout se fait au clavier</b> : la date (le jour seul suffit), le journal, puis les lignes — Entrée descend, Tab solde la pièce.' },
        { page: garage('comptabilite/saisie'), cible: ['#sa-ok', '#sa-okvalider'], cote: 'dessus', titre: 'Brouillard, puis validation',
          texte: '<b>« Enregistrer en brouillard »</b> : la pièce se corrige encore. <b>« Enregistrer et valider »</b> : elle reçoit son numéro et ne se modifie plus.' },
        { page: garage('comptabilite/paie'), cible: ['#c-livres .panel'], cote: 'dessus', titre: 'Sa paie',
          texte: 'Ses salariés, leurs bulletins mois par mois, et l\'écriture de paie passée <b>en brouillard</b> au dernier jour du mois. Les taux sont des barèmes réglables.' },
        { page: garage('comptabilite/immobilisations'), cible: ['#c-livres .panel'], cote: 'dessus', titre: 'Ses biens',
          texte: 'Ce qu\'il garde plusieurs années, et leur plan d\'amortissement. Les dotations se passent en fin d\'exercice, en brouillard.' },
        // — Déclarer et clôturer
        { chapitre: 'Déclarer et clôturer', couleur: 'declarer', page: beji('comptabilite/declaration'), cible: ['#dc-suite', '#c-livres .panel'], cote: 'dessous', titre: 'La déclaration du mois',
          texte: 'Les cases que tu recopies sur le portail. Une case dont la règle n\'est pas connue vaut <b>« — »</b>, jamais zéro. Puis quatre gestes dans l\'ordre, et le bouton en couleur est toujours le suivant.' },
        { page: beji('comptabilite/exercice'), cible: ['#cl-cloturer', '#c-livres .panel'], cote: 'dessus', titre: 'La clôture de l\'exercice',
          texte: 'Les contrôles nomment ce qui manque <b>sans jamais bloquer</b>. Puis la clôture : définitive, tracée, et le fichier qui part chez le client — son bilan et le tien disent alors la même chose.' },
        { page: beji('comptabilite/liasse'), cible: ['#c-livres .panel'], cote: 'dessus', titre: 'La liasse',
          texte: 'Le bilan et l\'état de résultat, rubrique par rubrique, selon un modèle que <b>tu ajustes</b>. Ce qu\'aucune rubrique ne capte est montré, jamais perdu.' },
        // — D'un exercice à l'autre (10.14.0) : le garage tient deux exercices, et c'est là qu'on VOIT
        // ce que la clôture fige, ce qu'une réouverture laisse comme trace, et ce qui passe à l'année
        // suivante. Sauté si le livre n'a pas (encore) ses deux exercices.
        { chapitre: 'D\'un exercice à l\'autre', couleur: 'equipe', si: garageDeuxExercices, page: garageEn(true, 'comptabilite/exercice'),
          cible: ['#cl-clos', '#c-livres .panel'], cote: 'dessous', titre: 'Un exercice clos',
          texte: 'Le garage a deux exercices, et celui de l\'an dernier est <b>clos</b> : plus rien n\'y bouge, aucun écran n\'y écrit plus. Tout s\'y lit encore — son journal, sa balance, ses états.' },
        { si: garageDeuxExercices, page: garageEn(true, 'comptabilite/exercice'), avant: ouvrirPli('#cl-historique'),
          cible: '#cl-historique', cote: 'dessous', titre: 'Rouvert, avec son motif',
          texte: 'Un prélèvement de décembre, vu sur le relevé de janvier <b>après</b> la clôture. Pour le passer, il a fallu rouvrir l\'exercice — et <b>une réouverture exige un motif</b> : c\'est la seule trace qui expliquera pourquoi un chiffre a changé après coup. Puis il a été clos à nouveau.' },
        { si: garageDeuxExercices, page: garageEn(true, 'comptabilite/exercice'), avant: ouvrirPli('#cl-sec-an'),
          cible: '#cl-sec-an', cote: 'dessus', titre: 'Ce qu\'il laisse au suivant',
          texte: 'Les <b>à-nouveaux</b> : chaque compte de bilan avec son solde de clôture, et le résultat de l\'année. Le bouton qui ouvre l\'année suivante les pose en une seule pièce — et le registre suit : les biens encore là, avec leur plan d\'amortissement, et les salariés encore présents.' },
        { si: garageDeuxExercices, page: garageEn(false, 'comptabilite/journal'),
          cible: ['#c-livres table.list tbody tr', '#c-livres .panel'], cote: 'dessous', titre: 'Les à-nouveaux reçus',
          texte: 'L\'exercice suivant commence par cette pièce, au 1<sup>er</sup> janvier : journal <b>AN</b>, <b>validée</b>, numéro 1. Ce que l\'an dernier a laissé, sans une ligne ressaisie.' },
        { si: garageDeuxExercices, page: garageEn(false, 'comptabilite/immobilisations'),
          cible: ['#c-livres [data-repris]', '#c-livres .panel'], cote: 'dessous', titre: 'Le registre a suivi',
          texte: 'Ce bien vient de l\'exercice précédent : son <b>cumul au 1<sup>er</sup> janvier</b> reprend là où il s\'était arrêté, et sa dotation de l\'année continue le même plan. Dans la paie, le salarié repris porte la même marque — ses bulletins, eux, restent dans leur mois.' },
        // — Tout le portefeuille
        { chapitre: 'Tout le portefeuille', couleur: 'encaisser', page: '#/relances', cible: ['#view table.list', '#view .panel'], cote: 'dessus', titre: 'Les relances',
          texte: 'Qui te doit un mois, et le mail tout prêt pour chacun. <b>« Écrire »</b> ouvre le mail ; tu relis, tu envoies. Tu peux aussi relancer plusieurs clients d\'un coup.' },
        { page: '#/echeances', cible: ['#view .panel'], cote: 'dessus', titre: 'Les échéances',
          texte: 'Chaque date fiscale, et <b>les clients dont tu n\'as pas les pièces</b> avant elle. Tu pointes le dépôt : un pense-bête.' },
        { page: '#/ecritures', cible: ['#view .panel'], cote: 'dessus', titre: 'L\'export d\'écritures',
          texte: 'Les écritures de tous les paquets d\'une période, <b>en un seul fichier</b>, pour ton logiciel.' },
        { page: '#/production', cible: ['#view table.list', '#view .panel'], cote: 'dessus', titre: 'La production',
          texte: 'Chaque dossier, chaque mois : reçu, saisi, révisé, déclaré. Filtrée par collaborateur, c\'est <b>son « À faire »</b>.' },
        // — Ton cabinet
        { chapitre: 'Ton cabinet', couleur: 'piloter', page: '#/reglages', avant: onglet('#set-tabs', 'cabinet'), cible: '#pan-appairage', cote: 'dessus', titre: 'Le fichier à remettre',
          texte: 'Chaque client l\'importe <b>une fois</b> dans son SkanFact : ses paquets sont ensuite chiffrés pour toi seul. Il ne contient rien de secret — un mail suffit.' },
        { page: '#/reglages', avant: onglet('#set-tabs', 'donnees'), cible: '#pan-secu', cote: 'dessus', titre: 'La clé de secours',
          texte: 'Sans elle, si cet ordinateur disparaît, <b>aucun paquet déjà reçu ne pourra plus être ouvert</b>. Un fichier protégé par son propre mot de passe, à ranger ailleurs.' },
        { page: '#/reglages', avant: onglet('#set-tabs', 'donnees'), cible: '#pan-backup', cote: 'dessus', titre: 'Les sauvegardes',
          texte: 'Une chaque matin, trente jours gardés, et la <b>copie externe</b> vers une clé USB, un disque, iCloud ou OneDrive : c\'est elle qui te sauve si l\'ordinateur disparaît.' },
        { page: '#/reglages', avant: onglet('#set-tabs', 'app'), cible: '#pan-maj', cote: 'dessus', titre: 'Les mises à jour',
          texte: 'Le Cabinet se met à jour tout seul, en arrière-plan, et <b>n\'installe rien sans ton accord</b>. Tes dossiers ne bougent pas.' },
        { chapitre: 'Pour la suite', couleur: 'commencer', page: '#/dossiers', cible: '.sidebar nav a[data-route="guide"]', cote: 'droite', titre: 'Me guider, toujours là',
          texte: 'Chaque écran a sa visite, <b>bouton par bouton</b>, et chaque geste se fait guidé, clic par clic : nommer ton cabinet, ajouter tes clients, remettre le fichier d\'appairage, saisir une pièce, déclarer, restaurer une sauvegarde.' },
        { page: '#/dossiers', cible: '.sidebar nav a[data-route="aide"]', cote: 'droite', titre: 'L\'Aide',
          texte: 'Pour comprendre plus en détail : les paquets, la tenue, la banque, la déclaration, la révision, la clôture. Chaque petit <b>i</b> explique le mot à côté, et mène à son article.' }
      ]
    });

    // ======================================================================= LES PREMIERS PAS
    visite({
      id: 'premiers-pas', theme: 'demarrer', type: 'faire', duree: '2 min', page: '#/dossiers',
      titre: 'Démarrer mon cabinet',
      resume: 'Tes premiers pas, dans l\'ordre : ton cabinet, tes clients, le fichier à leur remettre, tes filets.',
      mots: ['premiers pas', 'demarrer', 'commencer', 'installer', 'mon cabinet'],
      suite: ['nommer-cabinet', 'ajouter-client', 'appairage'],
      bravo: 'Te voilà prêt',
      conclusion: 'Chaque étape de « Tes premiers pas » a son bouton, et sa visite guidée dans « Me guider ». Elles se cochent toutes seules quand c\'est fait.',
      etapes: [
        { page: '#/dossiers', titre: 'Ton cabinet', texte: '<p>Ici, c\'est <b>ton</b> cabinet : tout ce que tu fais compte.</p><p>Je te montre l\'ordre des choses. Pour chaque étape, une visite te guide <b>clic par clic</b>.</p>' },
        { page: '#/dossiers', cible: '.premiers-pas', cote: 'dessous', titre: 'Tes premiers pas',
          texte: 'L\'ordre à suivre : ton cabinet, tes clients, le fichier à leur remettre, ta clé de secours, ta copie externe — puis ton premier paquet ou ton premier livre. <b>Chaque étape se coche toute seule</b> quand c\'est fait.' },
        { page: '#/dossiers', cible: '.premiers-pas .encours [data-pas]', cote: 'gauche', facultatif: true, faire: 'clic', titre: 'Le bouton de chaque étape',
          texte: 'Il t\'emmène au bon endroit. <b>« Me guider »</b>, juste à côté, t\'y emmène en te montrant où cliquer.',
          action: 'Clique sur le bouton de l\'étape en cours.', essai: { clic: true } }
      ]
    });

    // ======================================================================= LES GESTES GUIDÉS
    visite({
      id: 'nommer-cabinet', theme: 'demarrer', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Nommer mon cabinet',
      resume: 'Le nom, l\'adresse et le téléphone qui signent tes relances et le fichier de tes clients.',
      mots: ['nom', 'cabinet', 'coordonnees', 'email', 'telephone'],
      suite: ['ajouter-client', 'appairage'],
      bravo: 'Ton cabinet a son nom',
      conclusion: 'Il signe désormais tes relances et le fichier d\'appairage que tes clients importent.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'cabinet'), cible: '#c-name', cote: 'droite', faire: 'valeur', bouton: 'Suivant',
          titre: 'Le nom du cabinet', texte: 'Tel qu\'il doit apparaître en bas de tes relances.', action: 'Tape le nom de ton cabinet.', essai: { taper: 'Cabinet Essai' } },
        { page: '#/reglages', cible: '#c-email', cote: 'droite', titre: 'Son adresse', facultatif: true,
          texte: 'Tes clients répondent à cette adresse ; elle entre dans le fichier d\'appairage.' },
        { page: '#/reglages', cible: '#c-save', cote: 'dessus', faire: 'clic',
          titre: 'Enregistrer', texte: 'Une modification ne compte qu\'une fois enregistrée.', action: 'Clique sur <b>« Enregistrer mon cabinet »</b>.', essai: { clic: true } }
      ]
    });

    let clientsAvant = 0;
    visite({
      id: 'ajouter-client', theme: 'portefeuille', type: 'faire', duree: '1 min', page: '#/dossiers',
      titre: 'Ajouter un client',
      resume: 'Un client dans ton portefeuille, même s\'il n\'utilise pas encore SkanFact.',
      mots: ['client', 'ajouter', 'nouveau', 'dossier', 'creer'],
      suite: ['appairage', 'page-dossier'],
      mesure: () => reels().length, but: n0 => reels().length > n0 && aucuneFenetre(),
      bravo: 'Ton client est dans le portefeuille',
      conclusion: 'Rien ne lui est réclamé tant qu\'il n\'a pas commencé. S\'il utilise SkanFact, remets-lui le fichier d\'appairage ; sinon, crée son livre et saisis.',
      etapes: [
        { page: '#/dossiers', cible: '#new-d', cote: 'dessous', faire: 'clic', avant: () => { clientsAvant = reels().length; },
          titre: 'Nouveau client', texte: 'Tu peux aussi coller toute une liste depuis un tableur, au premier lancement.', action: 'Clique sur <b>« Nouveau client… »</b>.', essai: { clic: true } },
        { page: '#/dossiers', cible: '#f-name', cote: 'droite', faire: 'valeur', bouton: 'Suivant',
          titre: 'Son nom', texte: 'Tel qu\'il s\'écrit sur ses papiers, forme juridique comprise.', action: 'Tape le nom du client.', essai: { taper: 'Client Essai SARL' } },
        { page: '#/dossiers', cible: '#f-mat', cote: 'droite', titre: 'Son matricule', facultatif: true,
          texte: 'C\'est lui qui identifie le dossier : son premier paquet arrivera dans CE dossier, et pas dans un second.' },
        { page: '#/dossiers', cible: '#modal-root #ok', cote: 'dessus', faire: 'clic', fait: () => reels().length > clientsAvant && aucuneFenetre(),
          titre: 'Créer', texte: 'La fiche s\'ouvre juste après.', action: 'Clique sur <b>« Créer le dossier »</b>.', essai: { clic: true } }
      ]
    });

    let pairAvant = '';
    visite({
      id: 'appairage', theme: 'demarrer', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Remettre le fichier d\'appairage à mes clients',
      resume: 'Le fichier que chaque client importe une fois : ses paquets sont ensuite chiffrés pour toi seul.',
      mots: ['appairage', 'fichier', 'skanpair', 'empreinte', 'relier', 'client'],
      suite: ['cle-secours', 'recevoir-paquet'],
      si: () => !!String((S().cabinet || {}).name || '').trim(),
      manque: { texte: 'Il faut d\'abord nommer ton cabinet : le nom entre dans le fichier.', visite: 'nommer-cabinet' },
      bravo: 'Le fichier est prêt',
      conclusion: 'Joins le fichier au message avant de l\'envoyer : il ne contient rien de secret. S\'ils te lisent au téléphone l\'empreinte qu\'ils voient, et qu\'elle correspond, c\'est bien à toi qu\'ils envoient.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'cabinet'), cible: '#pan-appairage', cote: 'dessus', titre: 'Le fichier et l\'empreinte',
          texte: 'L\'<b>empreinte</b> est courte exprès : elle se dicte au téléphone. C\'est elle qui prouve à ton client que le fichier vient de toi.' },
        { page: '#/reglages', cible: '#c-pair', cote: 'dessus', faire: 'clic', avant: () => { pairAvant = (S().cabinet || {}).pairingExportedAt || ''; },
          fait: () => ((S().cabinet || {}).pairingExportedAt || '') !== pairAvant,
          titre: 'Enregistrer le fichier', texte: 'Choisis où l\'enregistrer : le message qui l\'envoie se prépare juste après.', action: 'Clique sur <b>« Remettre le fichier à mes clients… »</b>, puis choisis un endroit.', essai: { clic: true } },
        // Le geste ouvre une fenêtre : la dernière étape la MONTRE (on ne termine pas par-dessus ce
        // qu'on vient d'ouvrir) et ne clique rien — écrire à soixante clients ne se joue pas « pour voir ».
        { page: '#/reglages', cible: '#modal-root #ap-ecrire', cote: 'dessus', titre: 'Le message tout prêt',
          texte: '<b>« Écrire à mes clients… »</b> ouvre ta messagerie : tes clients qui ont une adresse sont en <b>copie cachée</b>, et le message leur dit où importer le fichier et quelle empreinte vérifier. Il ne te reste qu\'à joindre le fichier, montré dans son dossier.' }
      ]
    });

    visite({
      id: 'cle-secours', theme: 'cabinet', type: 'faire', duree: '2 min', page: '#/reglages',
      titre: 'Enregistrer ma clé de secours',
      resume: 'Le fichier qui rouvre tes paquets si cet ordinateur disparaît.',
      mots: ['cle', 'secours', 'perdre', 'recuperer', 'ordinateur', 'securite'],
      suite: ['copie-externe', 'changer-ordinateur'],
      bravo: 'Ta clé de secours est enregistrée',
      conclusion: 'Range-la ailleurs que sur cet ordinateur — une clé USB, un coffre, un autre poste — avec son mot de passe noté à part.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'donnees'), cible: '#pan-secu', cote: 'dessus', titre: 'Pourquoi elle compte',
          texte: 'La clé du cabinet ouvre les paquets de tes clients. Elle vit sur cet ordinateur : <b>perdu, il emporterait tout</b>, et personne — ni nous — ne pourrait rouvrir un paquet déjà reçu.' },
        { page: '#/reglages', cible: '#s-rec', cote: 'dessus', faire: 'clic', fait: () => ctx.cleSecours() === true,
          titre: 'Enregistrer la clé', texte: 'Le Cabinet te demande un mot de passe propre à la clé, puis où l\'enregistrer.', action: 'Clique sur <b>« Enregistrer ma clé de secours… »</b> et suis la fenêtre.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'copie-externe', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Mettre mon cabinet à l\'abri',
      resume: 'Une copie automatique hors de cet ordinateur, à chaque enregistrement.',
      mots: ['copie', 'externe', 'usb', 'icloud', 'onedrive', 'sauvegarde', 'abri'],
      suite: ['sauvegardes', 'cle-secours'],
      bravo: 'Ton cabinet est à l\'abri',
      conclusion: 'La base, les livres, les sauvegardes et les paquets y sont recopiés à chaque enregistrement.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'donnees'), cible: '#pan-backup', cote: 'dessus', titre: 'Les sauvegardes',
          texte: 'Une chaque matin, trente jours gardés — <b>sur cet ordinateur</b>. S\'il disparaît, elles disparaissent avec lui : c\'est la copie externe qui les sauve.' },
        { page: '#/reglages', cible: '#b-ext', cote: 'dessus', faire: 'clic', fait: () => !!ctx.copieExterne(),
          titre: 'Choisir le dossier', texte: 'Une clé USB, un disque, ou un dossier synchronisé (iCloud, OneDrive).', action: 'Clique sur <b>« Choisir un dossier de copie… »</b> et choisis un dossier.', essai: { clic: true } }
      ]
    });

    let paquetsAvant = 0;
    visite({
      id: 'recevoir-paquet', theme: 'recevoir', type: 'faire', duree: '1 min', page: '#/dossiers',
      titre: 'Recevoir le paquet d\'un client',
      resume: 'Le fichier du mois qu\'un client t\'envoie depuis SkanFact : vérifié, rangé, prêt à lire.',
      mots: ['paquet', 'skanpack', 'importer', 'recevoir', 'mail', 'glisser'],
      suite: ['page-dossier-paquets', 'page-compta-journal'],
      bravo: 'Le paquet est rangé',
      conclusion: 'Il est vérifié pièce par pièce, rangé dans le dossier du client, et ses écritures sont prêtes pour son livre.',
      etapes: [
        { page: '#/dossiers', titre: 'D\'où vient un paquet', texte: '<p>Ton client importe une fois ton <b>fichier d\'appairage</b> ; chaque mois, il fabrique son paquet dans SkanFact et te l\'envoie par mail.</p><p>Tu enregistres la pièce jointe, puis tu l\'importes ici — ou tu la glisses simplement sur la fenêtre.</p>' },
        { page: '#/dossiers', cible: '#imp', cote: 'dessous', faire: 'clic', avant: () => { paquetsAvant = paquets(); },
          fait: () => paquets() > paquetsAvant && aucuneFenetre(),
          titre: 'Importer', texte: 'Tu peux en choisir plusieurs d\'un coup.', action: 'Clique sur <b>« Importer un paquet… »</b> et choisis le fichier reçu.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'saisir-piece', theme: 'saisir', type: 'faire', duree: '2 min',
      page: dans('hors', 'comptabilite/saisie'),
      titre: 'Saisir une pièce',
      resume: 'Une pièce tapée au clavier : la date, le journal, les lignes, le solde, puis le brouillard.',
      mots: ['saisir', 'saisie', 'ecriture', 'piece', 'clavier', 'grille', 'brouillard'],
      si: () => !!ctx.dossier('hors'), manque: DOSSIER_MANQUE.hors,
      suite: ['page-compta-saisie', 'page-compta-journal'],
      bravo: 'Ta pièce est enregistrée',
      conclusion: 'Elle est en brouillard : elle se corrige encore. Tu la valideras seule, ou par lot avec les autres — elle recevra alors son numéro.',
      etapes: [
        { page: dans('hors', 'comptabilite/saisie'), cible: '#sa-date', cote: 'droite', faire: 'valeur', bouton: 'Suivant',
          titre: 'La date', texte: 'Le jour seul suffit : le mois et l\'année viennent de l\'exercice.', action: 'Tape le jour de la pièce, puis Entrée.', essai: { taper: '15' } },
        { page: dans('hors', 'comptabilite/saisie'), cible: '#sa-journal', cote: 'droite', titre: 'Le journal',
          texte: 'Achats, ventes, banque, opérations diverses : le journal range la pièce. Le Cabinet propose celui que tu as utilisé en dernier.' },
        { page: dans('hors', 'comptabilite/saisie'), cible: '#sa-libelle', cote: 'droite', faire: 'valeur', bouton: 'Suivant',
          titre: 'Le libellé', texte: 'Ce que dit la pièce : il se reporte sur chaque ligne.', action: 'Tape le libellé, puis Entrée pour descendre aux lignes.', essai: { taper: 'Loyer du mois' } },
        { page: dans('hors', 'comptabilite/saisie'), cible: ['#sa-lignes', '#c-livres .panel'], cote: 'dessus', titre: 'Les lignes',
          texte: 'Un compte (tape ses premiers chiffres), un montant au débit ou au crédit. <b>Tab sur la dernière ligne solde la pièce</b> : le Cabinet pose l\'écart dans la bonne colonne.' },
        { page: dans('hors', 'comptabilite/saisie'), cible: '#sa-ok', cote: 'dessus', faire: 'clic',
          titre: 'Enregistrer en brouillard', texte: 'Le bouton reste éteint tant que la pièce ne tombe pas juste — et il dit pourquoi.', action: 'Clique sur <b>« Enregistrer en brouillard »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'relancer', theme: 'portefeuille', type: 'faire', duree: '1 min', page: '#/relances',
      titre: 'Relancer un client',
      resume: 'Le mail qui réclame les mois manquants, tout prêt.',
      mots: ['relancer', 'relance', 'retard', 'mail', 'manquant'],
      bravo: 'Ta relance est prête',
      conclusion: 'Le mail s\'ouvre dans ta messagerie : tu le relis et tu l\'envoies. La relance est notée dans l\'historique du client.',
      suite: ['page-relances'],
      etapes: [
        { page: '#/relances', cible: ['#view table.list', '#view .panel'], cote: 'dessus', titre: 'Qui te doit un mois',
          texte: 'Chaque client qui ne t\'a pas envoyé un mois terminé, ou seulement du provisoire. Le mois en cours n\'est jamais réclamé.' },
        { page: '#/relances', cible: '#view [data-rel]', cote: 'gauche', faire: 'clic', facultatif: true,
          titre: 'Écrire', texte: 'Le mail nomme les mois qui manquent — l\'intervalle, au-delà de trois.', action: 'Clique sur <b>« Écrire »</b> au bout d\'une ligne.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'declarer-tva', theme: 'declarer', type: 'faire', duree: '2 min',
      sansGeste: 'Passer la déclaration écrit une pièce dans le livre : on la décide, on ne la fait pas pour voir.',
      page: dans('livre', 'comptabilite/declaration'),
      titre: 'Déclarer la TVA du mois',
      resume: 'Les cases du mois, l\'écriture, puis les deux pense-bêtes : déposée, payée.',
      mots: ['tva', 'declaration', 'declarer', 'mois', 'deposer', 'mensuelle'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['page-compta-declaration', 'page-echeances'],
      bravo: 'Tu connais la déclaration',
      conclusion: 'Le Cabinet ne dépose rien : tu recopies les cases sur le portail, puis tu pointes « déposée » et « payée » — deux pense-bêtes qui se défont.',
      etapes: [
        { page: dans('livre', 'comptabilite/declaration'), cible: ['#view table.list', '#c-livres .panel'], cote: 'dessus', titre: 'Les cases',
          texte: 'Tirées du livre du mois. Une case dont la règle n\'est pas connue vaut <b>« — »</b> avec sa raison : un zéro se recopie, un « — » se demande.' },
        { page: dans('livre', 'comptabilite/declaration'), cible: ['#dc-suite', '#dc-preparer'], cote: 'dessous', titre: 'Les quatre gestes',
          texte: '<b>Préparer</b> fige les cases ; <b>l\'écriture</b> solde la TVA du mois, en brouillard ; <b>déposée</b> et <b>payée</b> sont des pense-bêtes. Le bouton en couleur est toujours le suivant.' }
      ]
    });

    visite({
      id: 'rapprocher', theme: 'saisir', type: 'faire', duree: '2 min',
      page: dans('livre', 'comptabilite/banque'),
      titre: 'Rapprocher la banque',
      resume: 'Le relevé importé, et chaque ligne rapprochée de son écriture.',
      mots: ['banque', 'releve', 'rapprochement', 'rapprocher', 'suspens'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['page-compta-banque', 'page-compta-lettrage'],
      bravo: 'Tu sais rapprocher',
      conclusion: 'Ce qui reste non rapproché — les suspens — doit expliquer tout l\'écart entre la banque et le livre. Sinon, il manque une écriture.',
      etapes: [
        { page: dans('livre', 'comptabilite/banque'), cible: '#bq-import', cote: 'dessous', titre: 'Importer le relevé',
          texte: 'Un CSV de la banque, quelle qu\'elle soit : tu vérifies les colonnes et tu saisis les deux soldes du relevé papier. <b>Un relevé qui ne se boucle pas n\'entre pas</b>, et le refus dit l\'écart.' },
        { page: dans('livre', 'comptabilite/banque'), cible: '#bq-auto', cote: 'dessous', faire: 'clic', facultatif: true,
          titre: 'Rapprocher automatiquement', texte: 'Seul le <b>certain</b> se pose : un seul candidat au bon montant, à quelques jours. Une ambiguïté reste proposée.', action: 'Clique sur <b>« Rapprocher automatiquement »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'questions-client', theme: 'recevoir', type: 'faire', duree: '2 min',
      sansGeste: 'Envoyer les questions écrit un fichier destiné au client : un geste qui sort du Cabinet ne se joue pas pour essayer.',
      page: dans('skanfact', 'comptabilite/revision'),
      titre: 'Poser une question à un client',
      resume: 'Une question née sur une ligne du livre, qui s\'affiche chez lui en face de la pièce.',
      mots: ['question', 'questions', 'client', 'revision', 'demander', 'piece', 'justificatif'],
      si: () => !!ctx.dossier('skanfact'), manque: DOSSIER_MANQUE.skanfact,
      suite: ['page-compta-revision', 'recevoir-paquet'],
      bravo: 'Tu sais questionner un client',
      conclusion: 'Ta question part dans un fichier signé ; elle s\'affiche dans son SkanFact, sur la pièce qu\'elle vise. Sa réponse revient dans son paquet suivant — sans un appel.',
      etapes: [
        { page: dans('skanfact', 'comptabilite/revision'), cible: ['#c-livres .panel'], cote: 'dessus', titre: 'Sur une ligne',
          texte: 'Dans la révision, chaque compte a son menu <b>« Actions »</b> : « Poser une question » part de là, avec le compte, l\'écriture et la pièce. C\'est ce qui la fait apparaître chez le client en face de la bonne pièce.' },
        { page: dans('skanfact', 'comptabilite/revision'), cible: ['#rv-envoyer', '#rv-poser', '#c-livres .panel'], cote: 'dessous', titre: 'L\'envoi',
          texte: 'Les questions partent dans un fichier que tu lui envoies. Une question déjà partie se <b>ferme</b>, elle ne s\'efface pas : il l\'a sous les yeux.' }
      ]
    });

    visite({
      id: 'cloturer', theme: 'declarer', type: 'faire', duree: '2 min',
      sansGeste: 'Clôturer fige un exercice : un geste irréversible ne se fait jamais par réflexe, dans une visite.',
      page: dans('livre', 'comptabilite/exercice'),
      titre: 'Clôturer un exercice',
      resume: 'Les contrôles, la clôture, et le fichier qui part chez le client.',
      mots: ['cloture', 'cloturer', 'exercice', 'a-nouveaux', 'fin annee', 'bilan'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['page-compta-exercice', 'page-compta-liasse'],
      bravo: 'Tu connais la clôture',
      conclusion: 'La clôture est définitive et tracée. Une réouverture exige un motif : c\'est la seule trace qui explique pourquoi un chiffre a changé.',
      etapes: [
        { page: dans('livre', 'comptabilite/exercice'), cible: ['#c-livres .panel'], cote: 'dessus', titre: 'Les contrôles',
          texte: 'Ils nomment ce qui manque — un brouillard non validé, une banque non rapprochée, des dotations non passées — <b>sans jamais bloquer</b>.' },
        { page: dans('livre', 'comptabilite/exercice'), cible: ['#cl-cloturer', '#c-livres .panel'], cote: 'dessus', titre: 'Clôturer',
          texte: 'Un récapitulatif d\'abord, puis la clôture. Le fichier de clôture part chez le client : <b>ses à-nouveaux et les tiens</b> sont alors les mêmes.' }
      ]
    });

    // ======================================================================= LES GESTES TECHNIQUES
    visite({
      id: 'sauvegardes', theme: 'cabinet', type: 'faire', duree: '2 min', page: '#/reglages',
      titre: 'Revenir à une sauvegarde',
      resume: 'Les sauvegardes du cabinet, et comment en restaurer une sans rien perdre.',
      mots: ['sauvegarde', 'restaurer', 'revenir', 'annuler', 'perdu', 'erreur'],
      suite: ['copie-externe', 'cle-secours'],
      bravo: 'Tu sais revenir en arrière',
      conclusion: 'Avant de restaurer, le Cabinet te dit ce que tu perdrais, et met l\'état actuel de côté : une restauration n\'est jamais un pari.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'donnees'), cible: '#pan-backup', cote: 'dessus', titre: 'Tes sauvegardes',
          texte: 'Une <b>chaque matin</b> (l\'état du début de journée), et une avant chaque geste risqué : un import, une suppression. Trente jours gardés.' },
        { page: '#/reglages', cible: '#b-now', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Sauvegarder maintenant', texte: 'Avant une grosse saisie, par exemple.', action: 'Clique sur <b>« Sauvegarder maintenant »</b>.', essai: { clic: true } },
        { page: '#/reglages', cible: ['#pan-backup table.list', '#pan-backup'], cote: 'dessus', titre: 'Restaurer',
          texte: 'Au bout d\'une ligne, <b>« Restaurer »</b> : le Cabinet dit d\'abord ce que la sauvegarde contient et ce que tu perdrais, puis met l\'état actuel de côté avant d\'écraser.' }
      ]
    });

    visite({
      id: 'changer-ordinateur', theme: 'cabinet', type: 'faire', duree: '2 min', page: '#/reglages',
      sansGeste: 'Reprendre un cabinet remplace celui du poste : un geste qu\'on ne joue pas pour essayer.',
      titre: 'Changer d\'ordinateur',
      resume: 'Reprendre ton cabinet sur un poste neuf, avec la même empreinte.',
      mots: ['ordinateur', 'nouveau', 'demenager', 'changer', 'poste', 'reprendre'],
      suite: ['cle-secours', 'copie-externe'],
      bravo: 'Tu sais déménager',
      conclusion: 'Sur le poste neuf, l\'écran d\'ouverture propose « J\'ai déjà un cabinet sur un autre ordinateur… » : il reprend la copie externe et la clé de secours, avec la MÊME empreinte — tes clients n\'ont rien à refaire.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'donnees'), cible: '#pan-secu', cote: 'dessus', titre: 'Ce qu\'il faut emporter',
          texte: 'Deux choses : ta <b>copie externe</b> (la base, les livres, les paquets) et ta <b>clé de secours</b> (la clé qui ouvre les paquets). Sans la seconde, un poste neuf fabriquerait une autre empreinte, et tes clients seraient refusés.' },
        { page: '#/reglages', cible: '#pan-backup', cote: 'dessus', titre: 'La copie externe',
          texte: 'Branche-la sur le poste neuf : l\'écran d\'ouverture la reprend.' }
      ]
    });

    visite({
      id: 'mises-a-jour', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Installer une mise à jour',
      resume: 'Comment le Cabinet se met à jour, et ce que tu décides.',
      mots: ['mise a jour', 'version', 'installer', 'nouveau', 'maj', 'beta', 'essai'],
      suite: ['sauvegardes'],
      bravo: 'Tu sais te mettre à jour',
      conclusion: 'Une version prête se propose une fois par jour au plus ; « Plus tard » te laisse finir ton travail. Tes dossiers ne bougent pas.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'app'), cible: '#pan-maj', cote: 'dessus', titre: 'Les mises à jour',
          texte: 'Le Cabinet cherche tout seul, télécharge en arrière-plan, et <b>n\'installe rien sans ton accord</b>. Tu peux aussi chercher toi-même, ici.' },
        { page: '#/reglages', avant: onglet('#set-tabs', 'app'), cible: '#u-check', cote: 'dessous', faire: 'clic', facultatif: true,
          titre: 'Chercher maintenant', texte: 'Le Cabinet demande la dernière version ; il ne l\'installera pas sans toi.',
          action: 'Clique sur le bouton de recherche.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'licence', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      sansGeste: 'Demander une licence compose un mail : un geste qui sort du Cabinet.',
      titre: 'Comprendre ma licence',
      resume: 'Ce qui est gratuit, ce qui est compté, et comment demander une licence.',
      mots: ['licence', 'prix', 'payer', 'gratuit', 'quota', 'dossiers', 'acheter'],
      suite: ['equipe'],
      bravo: 'Tu connais ta licence',
      conclusion: 'Rien ne se ferme jamais sur tes données : sans licence, seule la validation au-delà du quota attend. Lire, importer, saisir et exporter restent toujours ouverts.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'cabinet'), cible: '#pan-licence', cote: 'dessus', titre: 'Ce qui est compté',
          texte: 'Les dossiers dont le client est sur SkanFact sont <b>gratuits</b>, ainsi que trois dossiers hors SkanFact. Au-delà, une licence. Le panneau nomme chaque dossier compté, et pourquoi.' }
      ]
    });

    visite({
      id: 'equipe', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Travailler à plusieurs',
      resume: 'Tes collaborateurs, leur rôle, et le cabinet sur plusieurs postes.',
      mots: ['equipe', 'collaborateur', 'role', 'plusieurs', 'poste', 'saisisseur', 'superviseur'],
      suite: ['licence', 'page-production'],
      bravo: 'Ton équipe peut travailler',
      conclusion: 'Chaque écriture validée porte le nom de qui l\'a validée. Un saisisseur saisit et ne valide pas ; aucune lecture n\'est jamais fermée.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'cabinet'), cible: '#pan-equipe', cote: 'dessus', titre: 'L\'équipe',
          texte: 'Tant que personne n\'est déclaré, <b>rien n\'est restreint</b>. Le premier collaborateur déclaré devient l\'identité de ce poste.' },
        { page: '#/reglages', cible: '#eq-add', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Déclarer un collaborateur', texte: 'Son nom et son rôle : saisie, validation, supervision.', action: 'Clique sur <b>« Ajouter un collaborateur… »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'boite-reception', theme: 'recevoir', type: 'faire', duree: '1 min', page: '#/reglages',
      sansGeste: 'Choisir la boîte ouvre le sélecteur de dossiers du système, hors du Cabinet.',
      titre: 'Ranger les paquets reçus d\'un seul endroit',
      resume: 'Le dossier où tu enregistres les pièces jointes : le Cabinet y regarde tout seul.',
      mots: ['boite', 'reception', 'dossier', 'surveiller', 'paquets', 'mail'],
      suite: ['recevoir-paquet'],
      bravo: 'Ta boîte de réception est posée',
      conclusion: 'À chaque retour sur la fenêtre, le Cabinet regarde ce dossier et te propose les paquets arrivés. Il n\'importe jamais tout seul.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'donnees'), cible: '#pan-inbox', cote: 'dessus', titre: 'La boîte de réception',
          texte: 'Tu enregistres les pièces jointes de tes clients dans un dossier ; le Cabinet le surveille et te <b>propose</b> les paquets nouveaux.' }
      ]
    });

    visite({
      id: 'exporter-ecritures', theme: 'recevoir', type: 'faire', duree: '1 min', page: '#/ecritures',
      titre: 'Exporter les écritures vers mon logiciel',
      resume: 'Les écritures de tous les paquets d\'une période, en un seul fichier.',
      mots: ['export', 'ecritures', 'logiciel', 'fichier', 'csv', 'regrouper'],
      suite: ['page-ecritures'],
      bravo: 'Tu sais exporter',
      conclusion: 'Un paquet illisible ne fait pas échouer l\'export : il part sans lui, et le manque est nommé.',
      etapes: [
        { page: '#/ecritures', cible: ['#view .panel'], cote: 'dessus', titre: 'La période',
          texte: 'Choisis le début et la fin : les écritures de tous les paquets reçus sur la période sont regroupées.' },
        { page: '#/ecritures', cible: '#e-go', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Exporter', texte: 'Le fichier s\'enregistre où tu veux.', action: 'Clique sur <b>« Exporter les écritures… »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'depannage', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      sansGeste: 'Signaler un problème compose un mail avec le journal : un geste qui sort du Cabinet.',
      titre: 'Signaler un problème',
      resume: 'Le journal de l\'application, joint à un mail prêt à envoyer.',
      mots: ['probleme', 'bug', 'panne', 'signaler', 'aide', 'support', 'idee'],
      suite: ['mises-a-jour'],
      bravo: 'Tu sais où demander de l\'aide',
      conclusion: 'Le mail part de ta messagerie, relu par toi. Rien d\'autre que le journal technique n\'y est joint — aucun chiffre de tes clients.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'app'), cible: '#pan-support', cote: 'dessus', titre: 'Aide et dépannage',
          texte: '<b>« Signaler un problème… »</b> prépare un mail avec le journal de l\'application ; <b>« Proposer une amélioration… »</b> demande ce que tu aimerais faire, et comment tu fais aujourd\'hui.' }
      ]
    });

    // ======================================================================= LE MÉTIER, GESTE PAR GESTE
    // 10.14.0 — le même niveau de guidage que l'app entreprise (Skander : « il manque encore beaucoup
    // de parcours ») : chaque métier du Cabinet a son geste guidé — la fiche d'un client, la saisie au
    // quotidien, la paie, les biens, l'inventaire, le lettrage, la recherche, la révision, la liasse,
    // l'exercice suivant, les échéances, et chaque réglage de la tenue. Les gestes qui ouvrent une
    // fenêtre qu'on peut refermer sont facultatifs : la visite ne prétend pas qu'ils ont eu lieu.
    visite({
      id: 'fiche-client', theme: 'portefeuille', type: 'faire', duree: '1 min',
      page: dans('client', 'suivi'),
      titre: 'Tenir la fiche d\'un client',
      resume: 'Ses coordonnées, sa note, ses mois, et les relances faites par téléphone.',
      mots: ['fiche', 'client', 'modifier', 'note', 'coordonnees', 'telephone', 'relance'],
      si: () => !!ctx.dossier('client'), manque: DOSSIER_MANQUE.client,
      suite: ['relancer', 'page-dossier'],
      bravo: 'Tu connais la fiche',
      conclusion: 'Ce qui est noté sur la fiche — un email, un téléphone, une relance faite ailleurs — sert aux relances suivantes : le mail se prépare avec, et l\'historique ne ment pas.',
      etapes: [
        { page: dans('client', 'suivi'), cible: '#edit', cote: 'gauche', titre: 'Modifier la fiche',
          texte: 'Nom, matricule, email, téléphone, régime, honoraires. Tant qu\'aucun paquet n\'est arrivé, <b>corriger le matricule corrige l\'identifiant</b> : son premier paquet arrivera ici.' },
        { page: dans('client', 'suivi'), cible: ['#view .mois-annee', '#view .panel'], cote: 'dessous', titre: 'Ses douze mois',
          texte: 'Reçu, provisoire, manquant, hors mission. Un mois manquant porte son geste : la relance part sur ce mois-là.' },
        { page: dans('client', 'suivi'), cible: '#note-rel', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Une relance faite ailleurs', texte: 'Un appel, un message : noté ici, il compte dans l\'historique comme une relance par mail.',
          action: 'Clique sur <b>« Noter une relance faite ailleurs… »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'valider-lot', theme: 'saisir', type: 'faire', duree: '1 min',
      sansGeste: 'Valider donne un numéro définitif : une validée ne se défait plus, elle se contre-passe.',
      page: dans('hors', 'comptabilite/saisie'),
      titre: 'Valider le brouillard',
      resume: 'Les pièces en brouillard reçoivent leur numéro — une par une, ou par lot.',
      mots: ['valider', 'lot', 'brouillard', 'numero', 'definitif'],
      si: () => !!ctx.dossier('hors'), manque: DOSSIER_MANQUE.hors,
      suite: ['contre-passer', 'page-compta-journal'],
      bravo: 'Tu sais valider',
      conclusion: 'Une pièce refusée au milieu d\'un lot ne consomme aucun numéro, et elle est nommée avec son motif : la suite des numéros reste 1, 2, 3… sans trou.',
      etapes: [
        { page: dans('hors', 'comptabilite/saisie'), cible: ['#sa-okvalider', '#sa-ok'], cote: 'dessus', titre: 'Valider en enregistrant',
          texte: '<b>« Enregistrer et valider »</b> donne son numéro à la pièce qu\'on vient de taper. Le numéro naît à la validation, et ne bouge plus.' },
        { page: dans('hors', 'comptabilite/saisie'), cible: ['[data-lot-journal]', '[data-lot-mois]', '#c-livres .panel'], cote: 'dessus', titre: 'Valider par lot',
          texte: 'Sous le brouillard, un bouton par journal et par mois : il valide <b>toutes les pièces justes</b> d\'un coup. Celles qui ne tombent pas juste restent en brouillard, et le compte rendu dit pourquoi.' }
      ]
    });

    visite({
      id: 'contre-passer', theme: 'saisir', type: 'faire', duree: '1 min',
      page: dans('livre', 'comptabilite/journal'),
      titre: 'Corriger une écriture validée',
      resume: 'Une validée ne se modifie jamais : elle se contre-passe, ou s\'extourne au mois suivant.',
      mots: ['corriger', 'contre-passer', 'contrepasser', 'extourner', 'extourne', 'erreur', 'annuler'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['saisir-piece', 'page-compta-journal'],
      bravo: 'Tu sais corriger',
      conclusion: 'La contre-passation est datée du jour où tu corriges, jamais de l\'écriture d\'origine : un mois déjà déclaré ne change pas en silence. L\'extourne, elle, tombe le 1er du mois suivant.',
      etapes: [
        { page: dans('livre', 'comptabilite/journal'), cible: ['#view table.list', '#c-livres .panel'], cote: 'dessus', titre: 'Le livre-journal',
          texte: 'Chaque pièce validée porte son numéro. Au bout de sa ligne, le menu <b>« Actions »</b>.' },
        { page: dans('livre', 'comptabilite/journal'), cible: '#view table.list [data-rowmenu]', cote: 'gauche', faire: 'clic', titre: 'Contre-passer ou extourner',
          action: 'Ouvre le menu d\'une pièce : rien ne change tant que tu n\'y choisis rien.', essai: { clic: true },
          texte: '<b>Contre-passer</b> écrit la pièce miroir aujourd\'hui : l\'originale et son miroir s\'annulent. <b>Extourner</b> la reprend au 1er du mois suivant : c\'est le geste d\'une charge à payer. Dans les deux cas, l\'originale reste, avec son numéro.' },
        { page: dans('livre', 'comptabilite/journal'), cible: '.row-menu', cote: 'gauche', titre: 'Choisir, ou refermer',
          texte: 'Une pièce <b>validée</b> propose de contre-passer ou d\'extourner ; un <b>brouillard</b> se modifie ou se supprime. Un clic à côté referme le menu sans rien changer.' }
      ]
    });

    visite({
      id: 'abonnement', theme: 'saisir', type: 'faire', duree: '1 min',
      page: dans('hors', 'comptabilite/saisie'),
      titre: 'Programmer une écriture qui revient',
      resume: 'Un loyer, un abonnement : écrit une fois, généré chaque mois en brouillard.',
      mots: ['abonnement', 'loyer', 'mensuel', 'recurrent', 'revient', 'chaque mois', 'guide'],
      si: () => !!ctx.dossier('hors'), manque: DOSSIER_MANQUE.hors,
      suite: ['guide-saisie', 'valider-lot'],
      bravo: 'Tu sais programmer un abonnement',
      conclusion: 'Chaque mois dû arrive en brouillard, jamais validé d\'office : une écriture que personne n\'a regardée n\'engage pas ta signature. Générer deux fois ne double rien.',
      etapes: [
        { page: dans('hors', 'comptabilite/saisie'), cible: ['#ab-new', '#ab-guides'], cote: 'dessus', titre: 'Les abonnements',
          texte: 'Un abonnement part d\'un <b>guide d\'écritures</b> (le loyer : 613 au débit, la banque au crédit) et d\'un montant. Tu dis depuis quand, et jusqu\'à quand.' },
        { page: dans('hors', 'comptabilite/saisie'), cible: ['#ab-gen', '#ab-new'], cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Générer ce qui manque', texte: 'Les mois dus arrivent en brouillard, datés : tu les relis, puis tu valides.',
          action: 'Clique sur le bouton, puis relis le brouillard.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'guide-saisie', theme: 'saisir', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Écrire un guide de saisie',
      resume: 'Une pièce type (le loyer, la paie, un achat courant) qui se remplit d\'un montant.',
      mots: ['guide', 'modele', 'saisie', 'type', 'raccourci', 'ecriture'],
      suite: ['abonnement', 'saisir-piece'],
      bravo: 'Tu sais écrire un guide',
      conclusion: 'Dans la grille de saisie, « Partir d\'un guide » remplit la pièce : les comptes, les taux, le sens. Un guide écrit ici sert à tous tes dossiers ; un dossier peut avoir le sien.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'compta'), cible: '#pan-guides', cote: 'dessus', titre: 'Les guides du cabinet',
          texte: 'Une pièce type par geste courant. Les taux viennent du guide, <b>jamais du code</b> : c\'est toi qui les écris.' },
        { page: '#/reglages', cible: '#sr-guide-new', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Nouveau guide', texte: 'Un nom, un journal, et ses lignes : un compte, un sens, une part du montant.',
          action: 'Clique sur <b>« Nouveau guide… »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'justificatif', theme: 'saisir', type: 'faire', duree: '1 min',
      page: dans('hors', 'comptabilite/saisie'),
      titre: 'Joindre un justificatif à une pièce',
      resume: 'Le scan de la facture, copié dans le dossier du client et rattaché à l\'écriture.',
      mots: ['justificatif', 'piece jointe', 'scan', 'facture', 'joindre', 'pdf'],
      si: () => !!ctx.dossier('hors'), manque: DOSSIER_MANQUE.hors,
      suite: ['saisir-piece'],
      bravo: 'Tu sais joindre un justificatif',
      conclusion: 'Le fichier est COPIÉ dans le dossier du client : il suit le dossier quand tu changes d\'ordinateur. Une validée peut encore recevoir son justificatif — ça ne change aucun chiffre.',
      etapes: [
        { page: dans('hors', 'comptabilite/saisie'), cible: '#sa-joindre', cote: 'gauche', faire: 'clic', facultatif: true,
          titre: 'Joindre', texte: 'Pendant la saisie de la pièce, avant ou après avoir tapé ses lignes.',
          action: 'Clique sur <b>« Joindre un justificatif… »</b> et choisis le fichier.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'lettrer', theme: 'saisir', type: 'faire', duree: '1 min',
      page: dans('livre', 'comptabilite/lettrage'),
      titre: 'Lettrer les comptes de tiers',
      resume: 'Relier chaque facture à son règlement : ce qui reste ouvert est ce qui est dû.',
      mots: ['lettrage', 'lettrer', 'tiers', 'client', 'fournisseur', 'du', 'reste'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['rapprocher', 'page-compta-lettrage'],
      bravo: 'Tu sais lettrer',
      conclusion: 'Le lettrage automatique ne relie que ce qui se solde exactement, et quand un seul candidat convient : un lettrage généreux affirmerait qu\'une facture est payée.',
      etapes: [
        { page: dans('livre', 'comptabilite/lettrage'), cible: ['#view table.list', '#c-livres .panel'], cote: 'dessus', titre: 'Ce qui reste ouvert',
          texte: 'Par tiers : les factures, les règlements, et <b>ce qui reste</b>. Le reste ouvert d\'un client doit être le solde de son compte.' },
        { page: dans('livre', 'comptabilite/lettrage'), cible: '#lv-auto', cote: 'dessous', faire: 'clic', facultatif: true,
          titre: 'Lettrer automatiquement', texte: 'Seul ce qui se solde au millime, sans ambiguïté.',
          action: 'Clique sur <b>« Lettrer automatiquement »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'chercher', theme: 'saisir', type: 'faire', duree: '1 min',
      page: dans('livre', 'comptabilite/recherche'),
      titre: 'Retrouver une écriture',
      resume: 'Par un montant, un libellé, un numéro de pièce ou un compte.',
      mots: ['chercher', 'recherche', 'retrouver', 'montant', 'trouver', 'ecriture'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['contre-passer', 'page-compta-recherche'],
      bravo: 'Tu sais chercher',
      conclusion: 'La recherche rend des pièces ENTIÈRES : jamais une ligne coupée de son équilibre. Au clavier, Ctrl K trouve aussi un client ou un écran.',
      etapes: [
        { page: dans('livre', 'comptabilite/recherche'), cible: '#re-q', cote: 'dessous', faire: 'valeur', bouton: 'Suivant',
          titre: 'Ce que tu cherches', texte: 'Un montant (1 200 ou 1200,000), un mot du libellé, un numéro de pièce.',
          action: 'Tape ce que tu cherches.', essai: { taper: 'loyer' } },
        { page: dans('livre', 'comptabilite/recherche'), cible: ['#re-journal', '#re-statut'], cote: 'dessous', titre: 'Resserrer',
          texte: 'Un journal, ou seulement les brouillards, ou seulement les validées.' }
      ]
    });

    visite({
      id: 'lire-grand-livre', theme: 'saisir', type: 'faire', duree: '1 min',
      page: dans('livre', 'comptabilite/grand-livre'),
      titre: 'Lire un compte dans le grand livre',
      resume: 'Chaque compte replié sur son solde, et ses mouvements à un clic.',
      mots: ['grand livre', 'compte', 'solde', 'mouvement', 'detail'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['verifier-balance', 'page-compta-grand-livre'],
      bravo: 'Tu sais lire un compte',
      conclusion: 'Le solde progressif finit toujours sur le total du compte : c\'est ce qu\'on compare au relevé, à la balance ou au tableau d\'amortissement.',
      etapes: [
        { page: dans('livre', 'comptabilite/grand-livre'), cible: ['#view .gl-compte', '#c-livres .panel'], cote: 'dessus', titre: 'Un compte par ligne',
          texte: 'Chaque compte montre son nombre de mouvements, son débit, son crédit et son solde, sans rien déplier.' },
        { page: dans('livre', 'comptabilite/grand-livre'), cible: '#view .gl-compte summary', cote: 'dessous', faire: 'clic',
          titre: 'Ouvre un compte', texte: 'Ses mouvements, un par ligne, avec le solde qui avance au fil des dates.',
          action: 'Clique sur la ligne d\'un compte.', essai: { clic: true } },
        { page: dans('livre', 'comptabilite/grand-livre'), cible: '#lv-compte', cote: 'dessous', titre: 'Un seul compte',
          texte: 'Choisis un compte dans la liste : il s\'ouvre seul, et l\'export ne porte que sur lui.' }
      ]
    });

    visite({
      id: 'verifier-balance', theme: 'saisir', type: 'faire', duree: '1 min',
      page: dans('livre', 'comptabilite/balance'),
      titre: 'Vérifier la balance',
      resume: 'Les totaux qui tombent juste, puis le détail des clients et des fournisseurs.',
      mots: ['balance', 'auxiliaire', 'equilibre', 'totaux', 'client', 'fournisseur'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['lettrer', 'page-compta-balance'],
      bravo: 'Tu sais vérifier une balance',
      conclusion: 'Une balance auxiliaire ne somme que les comptes collectifs, et son total se confronte au 411 ou au 401 de la balance générale : c\'est ce que dit la phrase au-dessus du tableau.',
      etapes: [
        { page: dans('livre', 'comptabilite/balance'), cible: ['#view table.list', '#c-livres .panel'], cote: 'dessus', titre: 'Les totaux qui tombent juste',
          texte: 'Les mouvements et les soldes — et l\'ouverture, quand l\'exercice en porte une : débit et crédit tombent juste sur chaque paire. La phrase verte au-dessus le dit.' },
        { page: dans('livre', 'comptabilite/balance'), cible: '#lv-aux', cote: 'dessous', faire: 'clic',
          titre: 'La balance auxiliaire', texte: 'Un tiers par ligne, au lieu d\'un compte par ligne.',
          action: 'Clique sur <b>« Balance auxiliaire »</b>.', essai: { clic: true } },
        { page: dans('livre', 'comptabilite/balance'), cible: ['#lv-verdict', '#lv-aux-role'], cote: 'dessous', titre: 'Le contrôle',
          texte: 'Le total des tiers comparé au solde du compte collectif : s\'il diffère, une écriture porte le mauvais tiers.' }
      ]
    });

    visite({
      id: 'suivre-production', theme: 'portefeuille', type: 'faire', duree: '1 min', page: '#/production',
      titre: 'Suivre la production du cabinet',
      resume: 'Qui en est où : les mois saisis, déclarés, révisés, pour chaque dossier.',
      mots: ['production', 'avancement', 'saisie', 'collaborateur', 'retard', 'mois'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['equipe', 'page-production'],
      bravo: 'Tu suis la production',
      conclusion: 'Le tableau lit les livres, pas les paquets : un dossier apparaît dès que sa comptabilité est ouverte, qu\'il soit sur SkanFact ou tenu au cabinet.',
      etapes: [
        { page: '#/production', cible: ['#view .warn-box', '#view .ok-box'], cote: 'dessous', titre: 'Ce qui attend',
          texte: 'Le nombre de mois reçus, ou tenus au cabinet, qui ne sont pas encore saisis.' },
        { page: '#/production', cible: ['#view .panel:has(table.prod)', '#view table.list'], cote: 'dessous', titre: 'Un dossier par ligne, un mois par colonne',
          texte: 'Chaque case dit l\'étape du mois — la légende, sous le tableau, dit chaque signe ; survole une case pour lire le détail. « À saisir » compte ce qui reste.' },
        { page: '#/production', cible: ['#pr-mois', '#pr-collab'], cote: 'dessous', titre: 'Resserrer',
          texte: 'Six, douze ou vingt-quatre mois ; et, si ton équipe est déclarée, les dossiers confiés à une personne.' },
        { page: '#/production', cible: '#view tr[data-id]', cote: 'dessous', faire: 'clic',
          titre: 'Ouvre un dossier', texte: 'La ligne mène à sa fiche.',
          action: 'Clique sur la ligne d\'un client.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'lire-paquet', theme: 'recevoir', type: 'faire', duree: '1 min',
      page: dans('skanfact', 'paquets'),
      titre: 'Relire un paquet reçu',
      resume: 'Ce que le client a envoyé, vérifié à la réception, et ce qu\'il y manque.',
      mots: ['paquet', 'recu', 'integrite', 'verifie', 'fichier', 'mois', 'skanpack'],
      si: () => !!ctx.dossier('skanfact'), manque: DOSSIER_MANQUE.skanfact,
      suite: ['saisir-piece', 'page-dossier-paquets'],
      bravo: 'Tu sais relire un paquet',
      conclusion: 'Un paquet provisoire reste ouvert chez le client ; un paquet définitif porte un mois clôturé. Reçu deux fois, le mois le plus récent remplace l\'autre, et l\'écran le dit.',
      etapes: [
        { page: dans('skanfact', 'paquets'), cible: 'section[data-onglet="paquets"] table.list', cote: 'dessus', titre: 'Un mois par ligne',
          texte: 'Définitif ou provisoire, le chiffre d\'affaires, la TVA à décaisser ; « Vérifiées » : chaque fichier comparé à son empreinte ; « Signalé » : ce que le paquet dit lui-même qu\'il manque (une pièce sans justificatif, un brouillon).' },
        { page: dans('skanfact', 'paquets'), cible: 'section[data-onglet="paquets"] [data-rowmenu]', cote: 'dessous', faire: 'clic',
          titre: 'Ses gestes', texte: 'Ouvrir un fichier du paquet, le montrer sur le disque, ou le retirer.',
          action: 'Ouvre le menu d\'un paquet.', essai: { clic: true } },
        { page: dans('skanfact', 'paquets'), cible: '.row-menu', cote: 'gauche', titre: 'Le menu du paquet',
          texte: 'Chaque geste porte sa phrase. <b>Supprimer</b>, en bas et en rouge, fait redevenir le mois manquant : c\'est le seul qui détruit, et il demande avant.' }
      ]
    });

    visite({
      id: 'paie-cabinet', theme: 'saisir', type: 'faire', duree: '2 min',
      page: dans('hors', 'comptabilite/paie'),
      titre: 'Faire la paie d\'un client',
      resume: 'Ses salariés, les bulletins du mois, puis l\'écriture de paie en brouillard.',
      mots: ['paie', 'salaire', 'bulletin', 'salarie', 'cnss', 'irpp', 'employe'],
      si: () => !!ctx.dossier('hors'), manque: DOSSIER_MANQUE.hors,
      suite: ['cnss', 'page-compta-paie'],
      bravo: 'Tu sais faire la paie',
      conclusion: 'Un bulletin garde une copie de son calcul : changer un barème ne réécrit jamais un bulletin déjà remis. Une fois l\'écriture passée, un bulletin ne se modifie plus — on contre-passe, puis on refait.',
      etapes: [
        { page: dans('hors', 'comptabilite/paie'), cible: '#pa-mois', cote: 'dessous', titre: 'Le mois',
          texte: 'La page s\'ouvre sur le dernier mois qui a des bulletins. Un salarié sans bulletin ce mois-là est nommé.' },
        { page: dans('hors', 'comptabilite/paie'), cible: ['#pa-salarie', '#pa-salarie2'], cote: 'dessous', titre: 'Les salariés',
          texte: 'Son nom, son numéro CNSS (signalé s\'il manque, jamais bloquant), son poste, son brut.' },
        { page: dans('hors', 'comptabilite/paie'), cible: ['#pa-bulletin', '#pa-bulletin2'], cote: 'dessous', titre: 'Les bulletins',
          texte: 'Le net se recalcule pendant la frappe. Un brut négatif est refusé en nommant le champ.' },
        { page: dans('hors', 'comptabilite/paie'), cible: '#pa-ecrire', cote: 'dessous', faire: 'clic', facultatif: true,
          titre: 'Passer l\'écriture de paie', texte: 'En brouillard, au dernier jour du mois. Le bouton s\'éteint une fois passée, et dit pourquoi.',
          action: 'Clique sur <b>« Passer l\'écriture de paie »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'cnss', theme: 'declarer', type: 'faire', duree: '1 min',
      sansGeste: 'La CNSS du trimestre est une déclaration : on la prépare au bon trimestre, pas pour voir.',
      page: dans('hors', 'comptabilite/paie'),
      titre: 'Préparer la CNSS du trimestre',
      resume: 'La déclaration trimestrielle des salaires, tirée des bulletins.',
      mots: ['cnss', 'trimestre', 'declaration sociale', 'salaires', 'employeur'],
      si: () => !!ctx.dossier('hors'), manque: DOSSIER_MANQUE.hors,
      suite: ['paie-cabinet', 'page-echeances'],
      bravo: 'Tu connais la CNSS',
      conclusion: 'Le Cabinet ne dépose rien : il prépare les montants, un salarié par ligne. Un trimestre se déclare une fois TERMINÉ.',
      etapes: [
        { page: dans('hors', 'comptabilite/paie'), cible: ['#pa-trim', '#c-livres .panel'], cote: 'dessous', titre: 'Le trimestre',
          texte: 'Choisis le trimestre : l\'assiette et les cotisations de chaque salarié, et l\'échéance au 15 du mois qui suit.' }
      ]
    });

    visite({
      id: 'biens', theme: 'saisir', type: 'faire', duree: '1 min',
      page: dans('hors', 'comptabilite/immobilisations'),
      titre: 'Ajouter un bien et ses dotations',
      resume: 'Un bien que le client garde plusieurs années : son plan, puis ses dotations en fin d\'exercice.',
      mots: ['immobilisation', 'bien', 'amortissement', 'dotation', 'vnc', 'cession', 'materiel'],
      si: () => !!ctx.dossier('hors'), manque: DOSSIER_MANQUE.hors,
      suite: ['inventaire', 'cloturer'],
      bravo: 'Tu sais tenir les biens',
      conclusion: 'Un dégressif sans taux est refusé en nommant le taux : aucun coefficient n\'est écrit dans le code. Une cession sort l\'actif ; son prix arrive par la facture ou le relevé.',
      etapes: [
        { page: dans('hors', 'comptabilite/immobilisations'), cible: ['#im-neuf', '#im-neuf2'], cote: 'dessous', titre: 'Ajouter un bien',
          texte: 'Sa valeur, sa mise en service, sa durée, sa méthode : le plan s\'affiche pendant la saisie.' },
        { page: dans('hors', 'comptabilite/immobilisations'), cible: '#im-ecrire', cote: 'dessous', faire: 'clic', facultatif: true,
          titre: 'Les écritures d\'inventaire', texte: 'Les dotations de l\'exercice, en brouillard au 31 décembre. Elles se réclament au dernier mois ; le bouton les prépare plus tôt si tu veux.',
          action: 'Clique sur le bouton des écritures d\'inventaire.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'inventaire', theme: 'saisir', type: 'faire', duree: '1 min',
      page: dans('hors', 'comptabilite/inventaire'),
      titre: 'Saisir l\'inventaire de fin d\'année',
      resume: 'Le stock compté, collé depuis un tableur, et la variation écrite dans le bon sens.',
      mots: ['inventaire', 'stock', 'variation', 'compter', 'fin annee'],
      si: () => !!ctx.dossier('hors'), manque: DOSSIER_MANQUE.hors,
      suite: ['biens', 'cloturer'],
      bravo: 'Tu sais saisir l\'inventaire',
      conclusion: 'Un inventaire sans ligne ne dit pas que le stock est vide : il dit que rien n\'a été compté. Une variation nulle ne produit aucune écriture.',
      etapes: [
        { page: dans('hors', 'comptabilite/inventaire'), cible: ['#iv-saisir', '#iv-saisir2'], cote: 'dessous', titre: 'Saisir l\'inventaire',
          texte: 'Colle les lignes depuis un tableur : référence, désignation, quantité, coût. Une cellule illisible est refusée en nommant la ligne.' },
        { page: dans('hors', 'comptabilite/inventaire'), cible: '#iv-ecrire', cote: 'dessous', faire: 'clic', facultatif: true,
          titre: 'Écrire la variation de stock', texte: 'En brouillard, dans le bon sens : un stock qui baisse est une charge.',
          action: 'Clique sur <b>« Écrire la variation de stock »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'reviser', theme: 'declarer', type: 'faire', duree: '2 min',
      page: dans('livre', 'comptabilite/revision'),
      titre: 'Réviser un dossier',
      resume: 'Cycle par cycle, compte par compte : signer, noter, questionner, puis arrêter.',
      mots: ['revision', 'reviser', 'cycle', 'signer', 'feuille maitresse', 'note de revue'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['questions-client', 'cloturer'],
      bravo: 'Tu sais réviser',
      conclusion: 'Une feuille maîtresse ne lit que les validées : on ne révise pas un brouillard. Les contrôles nomment ce qui manque avant d\'arrêter, sans jamais bloquer.',
      etapes: [
        { page: dans('livre', 'comptabilite/revision'), cible: ['#c-livres .panel'], cote: 'dessus', titre: 'Les cycles',
          texte: 'Trésorerie, ventes, achats, personnel, fiscal… Chaque cycle compte ses comptes signés. <b>Un cycle s\'ouvre</b> sur sa feuille maîtresse.' },
        { page: dans('livre', 'comptabilite/revision'), cible: ['#rv-arreter', '#c-livres .panel'], cote: 'dessous', titre: 'Arrêter la révision',
          texte: 'La période révisée se fige ; elle se rouvre si un chiffre bouge.' },
        { page: dans('livre', 'comptabilite/revision'), cible: '#rv-note', cote: 'dessous', faire: 'clic', titre: 'Noter et questionner',
          texte: '<b>« Note de revue… »</b> garde ce que tu as vu ; <b>« Poser une question… »</b> part chez le client, sur la pièce.',
          action: 'Ouvre la <b>« Note de revue… »</b> : tu peux la refermer sans rien écrire.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'liasse', theme: 'declarer', type: 'faire', duree: '2 min',
      page: dans('livre', 'comptabilite/liasse'),
      titre: 'Établir la liasse',
      resume: 'Le bilan et le résultat rubrique par rubrique, les retraitements, et l\'impôt.',
      mots: ['liasse', 'bilan', 'resultat', 'rubrique', 'impot', 'retraitement', 'fiscal'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['cloturer', 'page-compta-liasse'],
      bravo: 'Tu sais établir la liasse',
      conclusion: 'Aucun taux d\'impôt n\'est écrit dans le Cabinet : tant qu\'il n\'est pas saisi, l\'impôt vaut « — » avec sa raison. Ce qu\'aucune rubrique ne capte est montré, jamais perdu. À VÉRIFIER avec ton modèle.',
      etapes: [
        { page: dans('livre', 'comptabilite/liasse'), cible: ['#li-rt-add', '#c-livres .panel'], cote: 'dessous', titre: 'Les retraitements',
          texte: 'Réintégrations et déductions : un montant toujours positif, dont la NATURE dit le sens.' },
        { page: dans('livre', 'comptabilite/liasse'), cible: ['#li-taux', '#c-livres .panel'], cote: 'dessous', titre: 'Le taux d\'impôt',
          texte: 'Celui de ton client, selon sa forme et son secteur. Vide, l\'impôt n\'est pas calculé.' },
        { page: dans('livre', 'comptabilite/liasse'), cible: '#li-modele', cote: 'dessous', faire: 'clic', titre: 'Le modèle de rubriques',
          texte: 'Chaque rubrique dit quels comptes elle prend, et dans quel sens. <b>Ta table remplace la nôtre</b>, entièrement.',
          action: 'Ouvre le modèle : tu peux le refermer sans rien changer.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'exercice-suivant', theme: 'declarer', type: 'faire', duree: '1 min',
      sansGeste: 'Ouvrir l\'exercice suivant écrit ses à-nouveaux : on le décide à la clôture, pas pour voir.',
      page: dans('livre', 'comptabilite/exercice'),
      titre: 'Ouvrir l\'exercice suivant',
      resume: 'Les à-nouveaux en brouillard, pour saisir janvier sans attendre la clôture.',
      mots: ['exercice suivant', 'a-nouveaux', 'nouvel exercice', 'janvier', 'ouvrir', 'report'],
      si: () => !!ctx.dossier('livre'), manque: DOSSIER_MANQUE.livre,
      suite: ['cloturer', 'envoyer-cloture'],
      bravo: 'Tu sais ouvrir l\'exercice suivant',
      conclusion: 'Les à-nouveaux se refont tant qu\'ils ne sont pas validés : un exercice qui bouge encore change son report. Une extourne déjà validée n\'est jamais reposée.',
      etapes: [
        { page: dans('livre', 'comptabilite/exercice'), cible: ['#cl-suivant', '#c-livres .panel'], cote: 'dessous', titre: 'Ouvrir l\'année d\'après',
          texte: 'Les soldes des comptes de bilan passent en à-nouveaux, en brouillard dans le livre suivant ; le résultat va au report à nouveau. Tu relis, puis tu valides.' }
      ]
    });

    visite({
      id: 'envoyer-cloture', theme: 'recevoir', type: 'faire', duree: '1 min',
      sansGeste: 'Le dossier de clôture est un fichier signé destiné au client : il ne se fabrique pas pour essayer.',
      page: dans('skanfact', 'comptabilite/exercice'),
      titre: 'Envoyer la clôture au client',
      resume: 'Le fichier signé qui verrouille son exercice et lui donne tes à-nouveaux.',
      mots: ['cloture', 'fichier', 'client', 'envoyer', 'skanclose', 'verrouiller', 'bilan'],
      si: () => !!ctx.dossier('skanfact'), manque: DOSSIER_MANQUE.skanfact,
      suite: ['cloturer', 'questions-client'],
      bravo: 'Tu sais envoyer la clôture',
      conclusion: 'Le fichier est signé par ton cabinet : ton client retient cette signature la première fois, puis refuse un envoi qui en porterait une autre. Son bilan et le tien disent alors la même chose.',
      etapes: [
        { page: dans('skanfact', 'comptabilite/exercice'), cible: ['#cl-fichier', '#c-livres .panel'], cote: 'dessous', titre: 'Le dossier pour le client',
          texte: 'Les états en HTML et en PDF, le résultat, et la signature. <b>Le fichier s\'écrit sur ton disque</b> : c\'est toi qui l\'envoies.' }
      ]
    });

    visite({
      id: 'echeance-deposee', theme: 'declarer', type: 'faire', duree: '1 min', page: '#/echeances',
      titre: 'Pointer une échéance déposée',
      resume: 'Un pense-bête par échéance : il fait taire CE mois-là, jamais la règle.',
      mots: ['echeance', 'deposee', 'pointer', 'pense-bete', 'date fiscale', 'tva', 'cnss'],
      suite: ['declarer-tva', 'relancer'],
      bravo: 'Tu sais pointer une échéance',
      conclusion: 'Le Cabinet ne dépose rien et ne se connecte à aucune administration : « Marquer déposée » est un pense-bête, qui se défait pendant huit secondes.',
      etapes: [
        { page: '#/echeances', cible: ['#view .panel'], cote: 'dessus', titre: 'Chaque date fiscale',
          texte: 'Et les clients dont tu n\'as pas les pièces avant elle. Le bouton de relance du bandeau part sur ceux-là, pas sur tout le portefeuille.' },
        { page: '#/echeances', cible: ['#view [data-depot]', '#view .panel'], cote: 'gauche', faire: 'clic', facultatif: true,
          titre: 'Marquer déposée', texte: 'La carte passe en vert ; l\'échéance du mois suivant, elle, reste réclamée.',
          action: 'Clique sur <b>« Marquer déposée »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'grille-saisie', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Régler la grille de saisie',
      resume: 'Les touches, le journal proposé, la date : ce qui s\'apprend par les doigts se règle.',
      mots: ['touches', 'clavier', 'grille', 'saisie', 'raccourci', 'journal', 'reglage'],
      suite: ['saisir-piece', 'guide-saisie'],
      bravo: 'Ta grille est réglée',
      conclusion: 'Une touche se règle en appuyant dessus, pas en l\'écrivant. Échap rend la main.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'compta'), cible: '#pan-saisie', cote: 'dessus', titre: 'La grille',
          texte: 'Champ suivant, ligne suivante, solder, recopier la ligne du dessus, enregistrer et valider : <b>chaque touche se choisit</b>, comme dans ton logiciel d\'avant.' },
        { page: '#/reglages', cible: '#sr-save', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Enregistrer', texte: 'La grille suit ces touches dans tous les dossiers.',
          action: 'Clique sur <b>« Enregistrer la grille de saisie »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'regimes', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Déclarer les régimes de mes clients',
      resume: 'Ce que chaque régime dépose, et quand : les échéances suivent.',
      mots: ['regime', 'forfaitaire', 'reel', 'echeances', 'tva', 'periodicite'],
      suite: ['echeance-deposee', 'fiche-client'],
      bravo: 'Tes régimes sont déclarés',
      conclusion: 'Tant qu\'aucun régime n\'est déclaré, le calendrier traite tous tes clients pareil. SkanFact n\'écrit aucune règle de droit : les périodicités et les dates sont les tiennes. À VÉRIFIER.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'compta'), cible: '#pan-regimes', cote: 'dessus', titre: 'Les régimes et leurs échéances',
          texte: 'Un régime dit ce qu\'il dépose (TVA mensuelle ou non, CNSS) ; la fiche du client dit son régime.' },
        { page: '#/reglages', cible: ['#sr-reg-base', '#sr-reg-add'], cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Partir des régimes proposés', texte: 'Trois régimes à relire et corriger, jamais une vérité.',
          action: 'Clique sur <b>« Partir des trois régimes proposés »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'methode-revision', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Écrire ma méthode de révision',
      resume: 'Tes cycles, tes rattachements de comptes, et ton questionnaire de fin d\'exercice.',
      mots: ['methode', 'revision', 'cycles', 'questionnaire', 'fin exercice'],
      suite: ['reviser'],
      bravo: 'Ta méthode est écrite',
      conclusion: 'Le questionnaire part vide : ta méthode t\'appartient. Ta table des cycles remplace les sept proposés, entièrement — jamais un mélange.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'compta'), cible: '#pan-questionnaire', cote: 'dessus', titre: 'La méthode',
          texte: 'Les sept cycles proposés se rattachent par préfixe de compte ; ajoute les tiens, et les questions que tu poses à chaque clôture.' },
        { page: '#/reglages', cible: '#sr-quest-save', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Enregistrer', texte: 'Elle sert à tous tes dossiers.', action: 'Clique sur <b>« Enregistrer ma méthode »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'correspondance', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Traduire les comptes de mes clients',
      resume: 'Un compte du client vers le tien, à l\'import comme à l\'export.',
      mots: ['correspondance', 'compte', 'plan comptable', 'traduire', 'import', 'export'],
      suite: ['recevoir-paquet', 'exporter-ecritures'],
      bravo: 'Ta correspondance est posée',
      conclusion: 'La correspondance la plus précise gagne (411001 avant 411). Elle traduit à l\'import et à l\'export, jamais en réécrivant une écriture validée.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'compta'), cible: '#pan-comptes', cote: 'dessus', titre: 'La correspondance',
          texte: 'Si ton plan diffère de celui des paquets : 4367 vers 4366, par exemple.' },
        { page: '#/reglages', cible: '#sr-corr-save', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Enregistrer', texte: 'Elle s\'applique aux prochains imports.', action: 'Clique sur <b>« Enregistrer la correspondance »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'mot-de-passe', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Changer le mot de passe du cabinet',
      resume: 'Le mot de passe qui chiffre ta base, tes livres et tes sauvegardes.',
      mots: ['mot de passe', 'changer', 'securite', 'chiffrement', 'verrouiller'],
      suite: ['cle-secours', 'sauvegardes'],
      bravo: 'Tu sais changer ton mot de passe',
      conclusion: 'L\'ancien mot de passe est redemandé, et TOUT ce qu\'il protégeait est rechiffré : la base, les livres, les sauvegardes. Personne — ni nous — ne peut le récupérer : note-le.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'donnees'), cible: '#pan-secu', cote: 'dessus', titre: 'La sécurité',
          texte: 'Le fichier du cabinet est chiffré avec ce mot de passe : sans lui, personne ne lit les comptabilités de tes clients.' },
        { page: '#/reglages', cible: '#s-pw', cote: 'dessus', faire: 'clic', facultatif: true,
          titre: 'Changer le mot de passe', texte: 'L\'ancien, puis le nouveau deux fois.', action: 'Clique sur <b>« Changer le mot de passe… »</b>.', essai: { clic: true } }
      ]
    });

    visite({
      id: 'apparence', theme: 'cabinet', type: 'faire', duree: '1 min', page: '#/reglages',
      titre: 'Choisir l\'apparence',
      resume: 'Clair, sombre, ou comme ton ordinateur.',
      mots: ['apparence', 'theme', 'sombre', 'clair', 'nuit', 'couleur'],
      suite: ['mises-a-jour'],
      bravo: 'Ton apparence est choisie',
      conclusion: 'Elle s\'applique tout de suite, avant d\'être enregistrée : on choisit une apparence en la voyant.',
      etapes: [
        { page: '#/reglages', avant: onglet('#set-tabs', 'app'), cible: '#pan-theme', cote: 'dessous', titre: 'L\'apparence',
          texte: 'Trois cartes avec leur miniature. <b>« Comme le système »</b> suit ton ordinateur, et bascule avec lui le soir.' },
        { page: '#/reglages', avant: onglet('#set-tabs', 'app'), cible: '#pan-theme .theme-op:not(.on)', cote: 'dessous', faire: 'clic',
          titre: 'Essaie-en une', texte: 'Elle s\'applique à l\'instant ; reclique sur l\'ancienne pour revenir.',
          action: 'Clique sur une autre carte.', essai: { clic: true } }
      ]
    });

    // ======================================================================= CHAQUE ÉCRAN
    // La visite d'un écran se LIT sur l'écran (`Visite.etapesDeLaVue`) : l'en-tête, les onglets, les
    // blocs, et chaque bouton de chacun, expliqué par `expliquer`. Un écran qui gagne un bouton demain
    // est couvert d'office — et un bouton sans explication fait tomber l'instrument de couverture.
    Object.keys(PAGES).forEach(k => {
      const P = PAGES[k];
      const sorte = P.dossier;
      const suite = k === 'dossier' ? 'suivi' : k === 'dossier-paquets' ? 'paquets' : k === 'compta' ? 'comptabilite' : k.startsWith('compta-') ? 'comptabilite/' + k.slice(7) : '';
      const ouvrir = sorte ? () => (cleDePage() === k ? location.hash : dans(sorte, suite)()) : '#/' + k;
      visite({
        id: 'page-' + k, theme: 'pages', type: 'page', route: k, duree: '2 min', titre: P.titre, resume: P.resume,
        mots: [k, P.titre.toLowerCase()], suite: [],
        si: sorte ? () => !!(cleDePage() === k || ctx.dossier(sorte)) : null,
        manque: sorte ? DOSSIER_MANQUE[sorte] : null,
        bravo: 'Tu connais cet écran',
        conclusion: 'Chaque bouton a son explication. Tu retrouveras cette visite dans « Me guider », et le détail dans l\'Aide.',
        etapes: [
          { page: ouvrir, titre: P.titre, texte: P.texte },
          { page: ouvrir, titre: P.titre, deplier: () => ctx.Visite.etapesDeLaVue({ onglets: true }) }
        ]
      });
    });

    return L;
  }

  return { THEMES, ECRANS, PAGES, COULEUR_PAGE, ZONES, ONGLETS, BOUTONS: B, CHAMPS, MENUS, cleDePage,
    expliquer, zone, parcours, libelleDe: M.libelleDe, couleurDe, iconeDe };
});
