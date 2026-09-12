// SkanFact Cabinet — les textes d'aide : les bulles « i » et les articles de la rubrique Aide.
//
// Même principe que src/renderer/guide.js côté entreprise, et pour la même raison : un comptable qui
// découvre l'application ne doit jamais avoir à deviner ce qu'un champ attend. Un test vérifie que
// chaque clé posée dans l'interface existe ici — et l'inverse, pour qu'aucun texte ne meure oublié.
//
// Ton : tutoiement (c'est l'utilisateur de l'application, pas son client), phrases courtes. Tout ce
// qui touche à la fiscalité porte « À VÉRIFIER ».
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CabGuide = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const INFO = {
    // — le cabinet —
    'cab.name': { t: 'Nom du cabinet', d: 'Le nom sous lequel tes clients te connaissent. Il apparaît en bas des relances que tu envoies et dans le fichier d\'appairage que tu leur remets. Écris-le comme sur ton papier à en-tête.' },
    'cab.email': { t: 'Email du cabinet', d: 'L\'adresse à laquelle tes clients te répondent. Elle est écrite dans le fichier d\'appairage : c\'est aussi comme ça qu\'ils savent que le fichier vient bien de toi.' },
    'cab.phone': { t: 'Téléphone du cabinet', d: 'Facultatif. Utile si tu veux qu\'il apparaisse dans tes messages de relance : en Tunisie, un client rappelle plus souvent qu\'il ne répond à un mail.' },
    'cab.relanceDay': { t: 'Jour de relance', d: 'Le jour du mois où tu fais ta tournée de relances. À partir de cette date, l\'application met en tête de « À faire » les clients qui n\'ont pas encore envoyé leurs mois clôturés. Le 10 est l\'usage : les clients ont eu le temps de finir le mois précédent. Entre 1 et 28.' },
    'cab.fingerprint': { t: 'Empreinte de ton cabinet', d: 'Cinq groupes de quatre caractères calculés à partir de ta clé publique. Elle identifie ton cabinet de façon unique. Quand un client importe ton fichier d\'appairage, son SkanFact lui montre cette empreinte : s\'il te la lit au téléphone et qu\'elle correspond, c\'est bien à toi qu\'il enverra ses paquets — et à personne d\'autre.' },
    'cab.pairing': { t: 'Fichier d\'appairage', d: 'Un petit fichier <b>.skanpair</b> à envoyer à chaque client (par mail, il ne contient rien de secret : seulement ta clé <b>publique</b>). Il l\'importe une fois dans <b>Paramètres → Cabinet comptable</b> de son SkanFact. À partir de là, tous ses paquets sont chiffrés pour toi seul, et il n\'a plus aucun mot de passe à te communiquer.' },

    // — un dossier —
    'd.name': { t: 'Nom du client', d: 'La raison sociale, comme sur son registre de commerce. Si le client t\'envoie des paquets, ce nom se met à jour tout seul d\'après ce qu\'il a saisi dans son SkanFact : c\'est lui qui fait foi.' },
    'd.matricule': { t: 'Matricule fiscal', d: 'C\'est <b>lui</b> qui identifie un dossier, pas le nom : un nom se corrige, change de forme juridique, et deux clients peuvent s\'appeler pareil. En Tunisie il ressemble à <b>1234567X/A/M/000</b>. Saisis-le dès la création : le jour où ce client passera à SkanFact, ses paquets tomberont dans ce dossier-ci au lieu d\'en créer un second.' },
    'd.email': { t: 'Email du client', d: 'L\'adresse à laquelle partent tes relances. Sans elle, le bouton « Écrire » ouvre quand même le message, mais tu devras taper le destinataire à la main.' },
    'd.phone': { t: 'Téléphone du client', d: 'Avec l\'indicatif si tu veux appeler ou écrire sur WhatsApp depuis l\'application (<b>+216 …</b>). C\'est souvent le seul moyen d\'obtenir une réponse rapide.' },
    'd.contact': { t: 'Interlocuteur', d: 'La personne que tu appelles vraiment : le gérant, la secrétaire, le comptable interne. Utile quand la société a un nom et que la personne en a un autre.' },
    'd.note': { t: 'Note interne', d: 'Ce que tu veux te rappeler sur ce dossier : particularités, accords, historique. Cette note ne quitte jamais ton ordinateur et n\'est jamais envoyée au client.' },
    'd.archived': { t: 'Dossier archivé', d: 'Un client parti ou en sommeil. Il disparaît des listes et n\'est plus réclamé, mais ses paquets restent consultables : coche « Voir les dossiers archivés » pour le retrouver. Préfère toujours l\'archivage à la suppression.' },
    'd.manual': { t: 'Client hors SkanFact', d: 'Un dossier que tu as créé toi-même, pour un client qui n\'utilise pas encore SkanFact. Il compte dans ton portefeuille mais rien ne lui est réclamé : on ne réclame pas des paquets à quelqu\'un qui n\'a pas l\'application. Le jour où il t\'enverra son premier paquet, le dossier deviendra un dossier ordinaire tout seul.' },
    'd.from': { t: 'Début de mission', d: 'Le premier mois que tu attends de ce client, au format <b>2026-01</b>. Laisse vide si tu veux partir du premier paquet reçu. Renseigne-le quand tu <b>reprends un dossier en cours d\'année</b> : sans cette date, les mois antérieurs ne te seraient jamais réclamés, et tu t\'en apercevrais au bilan.' },
    'd.regime': { t: 'Régime fiscal', d: 'Le régime d\'imposition du client. Il ne change pas ce que l\'application attend de lui (un client tient sa comptabilité tous les mois quoi qu\'il arrive) mais il te rappelle ce que tu dois déposer pour lui. <em>À VÉRIFIER avec le dossier fiscal du client.</em>' },
    'd.tvaPeriod': { t: 'Périodicité de la TVA', d: 'Mensuelle, trimestrielle, ou non assujetti. Sert de pense-bête pour tes déclarations. <em>À VÉRIFIER : la périodicité dépend du régime et du chiffre d\'affaires.</em>' },
    'd.fees': { t: 'Honoraires mensuels', d: 'Ce que ce dossier te rapporte chaque mois, en dinars. Facultatif, et strictement privé : ça ne sert qu\'à totaliser ton portefeuille sur la page Dossiers. SkanFact Cabinet ne facture rien et n\'envoie rien à personne.' },
    'd.liste': { t: 'Coller une liste de clients', d: 'Une ligne par client. Tu peux copier une colonne entière depuis Excel ou Numbers et la coller ici. Si tu veux donner plus qu\'un nom, sépare les colonnes par un point-virgule, dans cet ordre : <b>nom ; matricule ; email ; téléphone</b>. Seul le nom est obligatoire, et l\'ordre des trois autres n\'a pas d\'importance : un email et un numéro de téléphone se reconnaissent tout seuls. Les doublons (même matricule, ou même nom) sont ignorés et signalés.' },

    // — les paquets —
    'p.definitif': { t: 'Définitif ou provisoire', d: 'Un paquet est <b>définitif</b> quand le client a clôturé son mois : il ne peut plus modifier ni supprimer une pièce de cette période sans rouvrir le mois, avec un motif écrit. Un paquet <b>provisoire</b> se lit, mais ses chiffres peuvent encore bouger : ne déclare pas dessus.' },
    'p.integrity': { t: 'Pièces vérifiées', d: 'Chaque paquet porte un manifeste avec l\'empreinte de chacun de ses fichiers. À l\'import, SkanFact les recalcule toutes et compare. « 7 pièces vérifiées, intactes » veut dire exactement ça : ce que tu as reçu est mot pour mot ce qui a été envoyé.' },
    'p.delete': { t: 'Supprimer un paquet', d: 'À réserver à un paquet arrivé par erreur (mauvais client, essai). Le fichier est effacé de ton disque et le mois redevient « manquant » pour ce client. Une sauvegarde est prise juste avant, au cas où.' },
    'p.extract': { t: 'Extraire les pièces', d: 'Écrit tout le contenu du paquet dans un dossier de ton choix : la page de garde, les journaux CSV, les factures PDF, les justificatifs. C\'est ce qu\'on fait pour travailler dans son logiciel de production, ou pour rendre ses pièces à un client qui part.' },

    // — relances —
    'r.via': { t: 'Moyen de relance', d: 'Comment tu l\'as relancé. C\'est ce qui te permet, la semaine suivante, de savoir qui a déjà été appelé et qui n\'a reçu qu\'un mail. Un client relancé trois fois par mail sans réponse se relance au téléphone.' },
    'r.history': { t: 'Historique des relances', d: 'Chaque relance est enregistrée avec sa date, son moyen et les mois réclamés. Sans cette trace, le lundi suivant tu ne sais plus qui tu as relancé — et tu relances deux fois les mêmes en oubliant les autres.' },
    'r.group': { t: 'Relance groupée', d: 'Prépare un message par client en retard, l\'un après l\'autre, sans revenir à la liste entre chaque. Douze retardataires : douze messages, un seul geste. Rien ne part sans que tu cliques sur « Envoyer » dans ta messagerie.' },

    // — filets —
    'b.daily': { t: 'Sauvegarde quotidienne', d: 'Chaque jour, avant la première modification, SkanFact met de côté le fichier tel qu\'il était. Tu peux donc revenir à « hier matin » après une fausse manœuvre. Trente jours sont conservés, plus les sauvegardes nommées (avant un import, avant une suppression).' },
    'b.external': { t: 'Copie vers un autre support', d: 'Un dossier sur une clé USB, un disque externe ou iCloud Drive. À chaque enregistrement, SkanFact y recopie ta base, tes sauvegardes <b>et tes paquets</b>. C\'est ce qui te sauve quand l\'ordinateur lui-même disparaît — vol, panne de disque, dégât des eaux.' },
    'b.recovery': { t: 'Clé de secours', d: 'Le fichier le plus important que tu produiras avec cette application. Il contient la clé qui <b>ouvre les paquets de tes clients</b>. Sans elle et sans ton ordinateur, aucun paquet déjà reçu ne pourra plus jamais être ouvert, et tes clients devront tous réimporter un nouvel appairage. Range-la ailleurs que sur ce Mac : clé USB dans un tiroir, coffre, chez ton associé.' },
    'b.password': { t: 'Mot de passe du cabinet', d: 'Il chiffre tout ce que tes clients t\'envoient. Personne ne peut le récupérer, pas même nous : c\'est ce qui garantit qu\'un portable volé n\'emporte pas soixante comptabilités. Change-le si tu penses qu\'il a été vu, ou quand un collaborateur s\'en va.' },
    'b.restore': { t: 'Restaurer une sauvegarde', d: 'Remplace l\'état actuel par celui de la sauvegarde choisie. L\'application te dit d\'abord ce que la sauvegarde contient et ce que tu as maintenant, pour que tu voies ce que tu perdrais. Une sauvegarde de l\'état actuel est prise juste avant : une restauration n\'est jamais un aller simple.' },
    'b.where': { t: 'Où sont mes données', d: 'Tout vit dans un seul dossier sur cet ordinateur : la base chiffrée, les sauvegardes, et les paquets rangés par client et par année. Tu peux l\'ouvrir dans le Finder, le copier sur un disque, le sauvegarder avec Time Machine.' }
  };

  // Les articles de la rubrique Aide. Ils vivent ici plutôt que dans app.js pour se relire et se
  // corriger sans toucher au code — et parce qu'un texte faux dans l'aide coûte plus cher qu'un bug :
  // le comptable y croit.
  const ARTICLES = [
    {
      id: 'demarrer', t: 'En trois gestes', d: `
      <ol class="small" style="line-height:1.9">
        <li><b>Une fois :</b> renseigne ton cabinet dans Réglages, enregistre le fichier d'appairage (<code>.skanpair</code>) et envoie-le à chacun de tes clients.</li>
        <li><b>Chaque mois :</b> ton client clôture son mois puis t'envoie un paquet (<code>.skanpack</code>). Tu le glisses sur la fenêtre, ou tu le double-cliques dans le Finder.</li>
        <li><b>Le jour que tu as choisi</b> (le 10 par défaut, réglable dans Réglages) : la page Dossiers met en tête ceux qui n'ont rien envoyé. Un clic sur « Relancer » prépare le message, et la relance est enregistrée.</li>
      </ol>
      <p class="small">Tes clients qui n'utilisent pas encore SkanFact ont leur place ici aussi : <b>Nouveau dossier client</b> les fait entrer dans ton portefeuille. Rien ne leur est réclamé tant qu'ils n'ont pas commencé.</p>` },
    {
      id: 'paquet', t: 'Ce que contient un paquet', d: `
      <p class="small">La page de garde (un PDF qui résume le mois et liste ce qui manque), les journaux au format CSV (ventes, achats, encaissements, règlements fournisseurs, trésorerie), les factures et avoirs en PDF, les bulletins de paie, et les justificatifs que ton client a joints à ses achats.</p>
      <p class="small"><b>Et surtout <code>journaux/ecritures.csv</code></b> : les pièces du mois déjà transformées en écritures en partie double, à importer dans ton logiciel au lieu de les ressaisir. Si les numéros de compte ne sont pas les tiens, donne-les à ton client une fois : il les saisit dans son SkanFact et tous ses envois suivants sont à ton format.</p>
      <p class="small">Un <b>manifeste</b> porte l'empreinte de chaque fichier. À l'import, SkanFact les recalcule toutes : c'est ce qui te permet d'affirmer que ce que tu as reçu est exactement ce qui a été envoyé.</p>
      <p class="small">Les paquets sont rangés sur ton disque par <b>client</b>, puis par <b>année</b>. Tu peux les retrouver dans le Finder sans ouvrir l'application, et rendre à un client ses pièces en copiant un dossier.</p>` },
    {
      id: 'definitif', t: 'Définitif ou provisoire', d: `
      <p class="small">Un paquet n'est <b>définitif</b> que si le client a clôturé son mois : après une clôture, il ne peut plus ni modifier ni supprimer une pièce de cette période sans rouvrir le mois, avec un motif écrit.</p>
      <p class="small">Un paquet <b>provisoire</b> se lit, mais ses chiffres peuvent encore bouger. Si tu reçois deux fois le même mois, SkanFact te le dit — et te prévient si le remplacé était définitif.</p>` },
    {
      id: 'filets', t: 'Ne rien perdre', d: `
      <p class="small">Trois filets, et ils ne font pas la même chose :</p>
      <ul class="small" style="line-height:1.8">
        <li><b>La sauvegarde quotidienne</b> te protège de <i>toi</i> : une suppression de trop, un import raté. Elle est automatique, trente jours.</li>
        <li><b>La copie vers un autre support</b> te protège de <i>l'ordinateur</i> : panne, vol, incendie. Elle emporte la base, les sauvegardes et les paquets. Choisis une clé USB ou un dossier iCloud dans Réglages.</li>
        <li><b>La clé de secours</b> te protège de la <i>perte totale</i>. Elle contient la clé qui ouvre les paquets de tes clients. Sans elle et sans ce Mac, aucun paquet déjà reçu ne se rouvre — jamais. Range-la ailleurs.</li>
      </ul>
      <p class="small">Ton mot de passe, lui, ne se récupère pas. C'est voulu : c'est ce qui fait qu'un portable volé n'emporte pas soixante comptabilités. Note-le quelque part de sûr le jour où tu le choisis.</p>` },
    {
      id: 'limites', t: 'Ce que cette application ne fait pas', d: `
      <p class="small">Elle <b>ne modifie jamais</b> la comptabilité de tes clients et ne leur renvoie rien. Une correction se demande au client, qui la saisit chez lui : sinon deux versions des mêmes comptes coexistent, et plus personne ne sait laquelle fait foi.</p>
      <p class="small">Elle ne dépose aucune déclaration et ne se connecte à aucune administration. Elle ne facture pas tes honoraires. Elle n'envoie aucun mail toute seule : elle prépare le texte, ta messagerie l'envoie.</p>
      <p class="small">Elle ne gère pas encore plusieurs collaborateurs sur le même cabinet : un poste, un mot de passe, une personne.</p>` },
    {
      id: 'maj', t: 'Les mises à jour', d: `
      <p class="small">SkanFact Cabinet vérifie au démarrage s'il existe une version plus récente, la télécharge et te propose de l'installer : <b>Réglages → Mises à jour</b>. Sur Mac, l'application se ferme, se remplace toute seule et se relance — une dizaine de secondes.</p>
      <p class="small">L'application et celle de tes clients portent le <b>même numéro de version</b> : si un client dit « je suis en 6.8.0 » et que tu es en 6.8.0, vous parlez bien de la même chose.</p>` }
  ];

  return { INFO, ARTICLES };
});
