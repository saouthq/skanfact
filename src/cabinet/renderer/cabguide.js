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
    'cab.pairing': { t: 'Fichier d\'appairage', d: 'Un petit fichier <b>.skanpair</b> à envoyer à chaque client (par mail, il ne contient rien de secret : seulement ta clé <b>publique</b>). Il l\'importe une fois dans <b>Paramètres → Envois → Ton cabinet comptable</b> de son SkanFact. À partir de là, tous ses paquets sont chiffrés pour toi seul, et il n\'a plus aucun mot de passe à te communiquer.' },

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
    'd.ca': { t: 'Le chiffre d\'affaires du client', d: 'Il vient des paquets eux-mêmes : depuis la 6.2.1, chaque paquet porte les chiffres du mois (chiffre d\'affaires, TVA collectée et déductible, TVA à décaisser, encaissements). Tu les lis donc <b>sans ouvrir un seul CSV</b>. Les douze mois de l\'année sont toujours dessinés et ceux que tu n\'as pas reçus restent vides : un graphique réduit aux trois mois reçus n\'apprend rien. Un paquet plus ancien que la 6.2.1 ne porte pas de chiffres — la case reste vide, elle n\'affiche jamais zéro.' },
    'd.liste': { t: 'Coller une liste de clients', d: 'Une ligne par client. Tu peux copier une colonne entière depuis Excel ou Numbers et la coller ici. Si tu veux donner plus qu\'un nom, sépare les colonnes par un point-virgule, dans cet ordre : <b>nom ; matricule ; email ; téléphone</b>. Seul le nom est obligatoire, et l\'ordre des trois autres n\'a pas d\'importance : un email et un numéro de téléphone se reconnaissent tout seuls. Les doublons (même matricule, ou même nom) sont ignorés et signalés.' },

    // — les paquets —
    'p.definitif': { t: 'Définitif ou provisoire', d: 'Un paquet est <b>définitif</b> quand le client a clôturé son mois : il ne peut plus modifier ni supprimer une pièce de cette période sans rouvrir le mois, avec un motif écrit. Un paquet <b>provisoire</b> se lit, mais ses chiffres peuvent encore bouger : ne déclare pas dessus.' },
    // Les livres lus dans les paquets (9.1.0).
    'lv.compta': { t: 'La comptabilité de ce client', d: 'Les écritures que ton client a produites, lues dans les paquets qu\'il t\'a envoyés. Livre-journal, grand livre, balance et lettrage — <b>les mêmes calculs que dans son application</b>, au millime près : c\'est le même moteur des deux côtés, et un test le vérifie à chaque version.<br><br>Ce que le Cabinet ne fait <b>pas</b> encore ici : tenir son propre livre. Il lit, il ne saisit rien et ne modifie rien chez le client. Les mois qui manquent sur la période sont nommés en tête : un livre incomplet qui ne le dirait pas serait un livre faux.' },
    'lv.ouverture': { t: 'Pourquoi il n\'y a pas d\'à-nouveau', d: 'Ces écritures viennent des paquets mensuels, un mois à la fois. Il n\'y a donc <b>aucun solde d\'ouverture</b> : le grand livre part de zéro au premier mois reçu, et ses soldes sont ceux des mouvements de la période, pas ceux du compte depuis sa création.<br><br>C\'est une lecture, pas une comptabilité tenue. La reprise d\'ouverture arrivera avec le livre propre à chaque dossier.' },
    'p.integrity': { t: 'Pièces vérifiées', d: 'Chaque paquet porte un manifeste avec l\'empreinte de chacun de ses fichiers. À l\'import, SkanFact les recalcule toutes et compare. « 7 pièces vérifiées, intactes » veut dire exactement ça : ce que tu as reçu est mot pour mot ce qui a été envoyé. Le compte va dans les deux sens : un fichier présent que le manifeste n\'annonce pas n\'y entre jamais, il est signalé à part.' },
    'p.intrus': { t: 'Fichier non annoncé', d: 'Le manifeste liste chacun des fichiers du paquet avec son empreinte. Un fichier qui se trouve dans le paquet <b>sans y figurer</b> n\'a été comparé à rien : il ne compte pas dans les « pièces vérifiées », il porte un « ? » dans la liste, et SkanFact te pose une question avant de l\'ouvrir. Un paquet fabriqué par SkanFact n\'en contient jamais — si tu en vois un, demande à ton client d\'où il vient avant de le lancer.' },
    'p.delete': { t: 'Supprimer un paquet', d: 'À réserver à un paquet arrivé par erreur (mauvais client, essai). Le fichier est effacé de ton disque et le mois redevient « manquant » pour ce client. Une sauvegarde est prise juste avant, au cas où.' },
    'p.extract': { t: 'Extraire les pièces', d: 'Écrit tout le contenu du paquet dans un dossier de ton choix : la page de garde, les journaux CSV, les factures PDF, les justificatifs. C\'est ce qu\'on fait pour travailler dans son logiciel de production, ou pour rendre ses pièces à un client qui part.' },
    'p.arret': { t: 'Arrêter un rangement', d: 'Vingt paquets d\'un mois chargé, c\'est une vingtaine de secondes : chacun est ouvert, vérifié pièce par pièce, puis copié. Tu peux arrêter à tout moment — l\'arrêt prend effet <b>à la fin du paquet en cours</b>, jamais au milieu d\'une copie. Les paquets déjà rangés le restent pour de bon ; les autres n\'ont pas été touchés et se redéposent quand tu veux.' },

    // — échéances —
    'ec.dates': { t: 'D\'où viennent ces dates', d: 'Elles sont calculées à partir de la <b>périodicité de TVA</b> que tu donnes à chaque client, et des jours que tu règles dans Réglages. Ce qui fait la différence avec un calendrier papier : chaque échéance compte les clients dont tu <b>n\'as pas encore le mois</b>. <em>À VÉRIFIER : les délais réels dépendent de la forme juridique, du régime et de la loi de finances de l\'année.</em>' },
    'ec.passees': { t: 'Les échéances passées', d: 'SkanFact ne sait pas ce que tu as réellement déposé — il ne se connecte à aucune administration et ne déposera jamais rien à ta place. Cette liste sert à repérer un mois qu\'on n\'a jamais pu déclarer faute de pièces, et qui traîne depuis.' },
    'ec.jours': { t: 'Jours de dépôt', d: 'Le jour du mois suivant où la déclaration est attendue. Les valeurs proposées suivent la pratique courante en Tunisie (TVA le 28, CNSS le 15) mais <b>ne font pas foi</b> : elles changent selon la forme juridique et le régime. <em>À VÉRIFIER auprès de ton Ordre ou de ta recette des finances.</em>' },

    // — écritures regroupées —
    'e.import': { t: 'À quoi sert ce fichier', d: 'C\'est le fichier que tu importes dans ton logiciel de production, à la place de la ressaisie. Il rassemble les écritures en partie double de <b>tous</b> tes clients sur la période choisie, avec le nom du client, son matricule et le mois devant chaque ligne. Les colonnes sont celles que tes clients ont produites : date, journal, pièce, compte, tiers, libellé, débit, crédit, devise.' },
    'e.periode': { t: 'La période', d: 'Un seul mois pour l\'import mensuel habituel, ou un intervalle pour rattraper un retard ou sortir un exercice entier. Seuls les mois où au moins un paquet est arrivé sont proposés : on ne propose pas d\'exporter le néant.' },
    'e.provisoire': { t: 'Paquets provisoires dans l\'export', d: 'Un paquet <b>provisoire</b> vient d\'un mois que le client n\'a pas clôturé : ses chiffres peuvent encore changer. Il est quand même exporté — tu en as souvent besoin pour travailler — mais ne déclare pas dessus, et redemande le paquet définitif avant de déposer.' },
    'e.manquants': { t: 'Les clients qui n\'ont rien envoyé', d: 'Ils ne figurent pas dans le fichier, forcément. La liste est là pour que tu saches ce qui manque <b>avant</b> d\'importer dans ton logiciel, plutôt que de t\'en apercevoir en rapprochant les comptes.' },

    // — relances —
    'r.via': { t: 'Moyen de relance', d: 'Comment tu l\'as relancé. C\'est ce qui te permet, la semaine suivante, de savoir qui a déjà été appelé et qui n\'a reçu qu\'un mail. Un client relancé trois fois par mail sans réponse se relance au téléphone.' },
    'r.history': { t: 'Historique des relances', d: 'Chaque relance est enregistrée avec sa date, son moyen et les mois réclamés. Sans cette trace, le lundi suivant tu ne sais plus qui tu as relancé — et tu relances deux fois les mêmes en oubliant les autres.' },
    'r.group': { t: 'Relance groupée', d: 'Prépare un message par client en retard, l\'un après l\'autre, sans revenir à la liste entre chaque. Douze retardataires : douze messages, un seul geste. Rien ne part sans que tu cliques sur « Envoyer » dans ta messagerie.' },

    // — filets —
    'b.daily': { t: 'Sauvegarde quotidienne', d: 'Chaque jour, avant la première modification, SkanFact met de côté le fichier tel qu\'il était. Tu peux donc revenir à « hier matin » après une fausse manœuvre. Trente jours sont conservés, plus les sauvegardes nommées (avant un import, avant une suppression).' },
    'b.external': { t: 'Copie vers un autre support', d: 'Un dossier sur une clé USB, un disque externe ou iCloud Drive. À chaque enregistrement, SkanFact y recopie ta base, tes sauvegardes <b>et tes paquets</b>. C\'est ce qui te sauve quand l\'ordinateur lui-même disparaît — vol, panne de disque, dégât des eaux.' },
    'b.recovery': { t: 'Clé de secours', d: 'Le fichier le plus important que tu produiras avec cette application. Il contient la clé qui <b>ouvre les paquets de tes clients</b>. Sans elle et sans ton ordinateur, aucun paquet déjà reçu ne pourra plus jamais être ouvert, et tes clients devront tous réimporter un nouvel appairage. Range-la ailleurs que sur cet ordinateur : clé USB dans un tiroir, coffre, chez ton associé.' },
    'b.password': { t: 'Mot de passe du cabinet', d: 'Il chiffre tout ce que tes clients t\'envoient. Personne ne peut le récupérer, pas même nous : c\'est ce qui garantit qu\'un portable volé n\'emporte pas soixante comptabilités. Change-le si tu penses qu\'il a été vu, ou quand un collaborateur s\'en va.' },
    'b.restore': { t: 'Restaurer une sauvegarde', d: 'Remplace l\'état actuel par celui de la sauvegarde choisie. L\'application te dit d\'abord ce que la sauvegarde contient et ce que tu as maintenant, pour que tu voies ce que tu perdrais. Une sauvegarde de l\'état actuel est prise juste avant : une restauration n\'est jamais un aller simple.' },
    'b.inbox': { t: 'Boîte de réception', d: 'Le dossier où tu ranges les paquets que tes clients t\'envoient — celui où ta messagerie enregistre les pièces jointes, un dossier partagé, une clé USB. SkanFact le regarde à l\'ouverture et te dit ce qui est arrivé. <b>Il n\'importe jamais tout seul</b> : il propose, tu cliques. Et il n\'efface rien — ce sont les pièces de tes clients, pas les siennes. « Ignorer » ne fait que cesser de te les proposer.' },
    'b.where': { t: 'Où sont mes données', d: 'Tout vit dans un seul dossier sur cet ordinateur : la base chiffrée, les sauvegardes, et les paquets rangés par client et par année. Tu peux l\'ouvrir dans ton gestionnaire de fichiers, le copier sur un disque, l\'inclure dans ta sauvegarde habituelle (Time Machine sur Mac, Historique des fichiers sur Windows).' },
    'b.reprise': { t: 'Reprendre un cabinet existant', d: 'À faire quand tu changes d\'ordinateur ou que tu réinstalles l\'application. Ton cabinet, c\'est <b>trois</b> choses : tes dossiers, tes paquets, et <b>la clé</b> qui les ouvre. Reprendre le dossier de ta copie de sauvegarde les rapporte tous les trois d\'un coup. Ce qu\'il ne faut surtout pas faire, c\'est créer un cabinet neuf : il aurait une <b>nouvelle empreinte</b>, et les paquets que tes clients t\'enverraient ensuite seraient refusés — « adressé à un autre cabinet ». Le mot de passe demandé est celui de l\'autre ordinateur : c\'est lui qui chiffre le fichier, il n\'a pas changé.' }
  };

  // Les articles de la rubrique Aide. Ils vivent ici plutôt que dans app.js pour se relire et se
  // corriger sans toucher au code — et parce qu'un texte faux dans l'aide coûte plus cher qu'un bug :
  // le comptable y croit.
  //
  // Depuis la 7.28.0, chaque article porte aussi de quoi se PRÉSENTER : un sous-titre (`s`), un
  // dessin (`icon`), une couleur (`couleur` — une classe `th-…` définie dans la feuille partagée,
  // parce qu'une couleur écrite ici ne saurait pas se retourner en mode sombre) et le geste qui
  // suit la lecture (`geste`). L'aide du cabinet était une seule page où les huit articles se
  // suivaient, dépliés, sans recherche et sans un seul lien vers l'application : on lisait un
  // livre. `geste: null` est délibéré sur « Ce que cette application ne fait pas » — on ne renvoie
  // nulle part depuis une liste de limites.
  const ARTICLES = [
    {
      id: 'demarrer', t: 'En trois gestes',
      s: 'Ce qu\'il faut faire une fois, et ce qui revient chaque mois', couleur: 'th-commencer', geste: { label: 'Voir mes dossiers', hash: '#/' },
      icon: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>', d: `
      <ol class="small" style="line-height:1.9">
        <li><b>Une fois :</b> renseigne ton cabinet dans Réglages, enregistre le fichier d'appairage (<code>.skanpair</code>) et envoie-le à chacun de tes clients.</li>
        <li><b>Chaque mois :</b> ton client clôture son mois puis t'envoie un paquet (<code>.skanpack</code>). Tu le glisses sur la fenêtre, ou tu le double-cliques dans ton gestionnaire de fichiers.</li>
        <li><b>Le jour que tu as choisi</b> (le 10 par défaut, réglable dans Réglages) : la page Dossiers met en tête ceux qui n'ont rien envoyé. Un clic sur « Relancer » prépare le message, et la relance est enregistrée.</li>
      </ol>
      <p class="small">Tes clients qui n'utilisent pas encore SkanFact ont leur place ici aussi : <b>Nouveau dossier client</b> les fait entrer dans ton portefeuille. Rien ne leur est réclamé tant qu'ils n'ont pas commencé.</p>` },
    {
      id: 'paquet', t: 'Ce que contient un paquet',
      s: 'Ce que ton client t\'envoie, et ce que tu peux en affirmer', couleur: 'th-vendre', geste: { label: 'Voir mes dossiers', hash: '#/' },
      icon: '<path d="M3 8l9-4 9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4"/><path d="M12 12v8"/>', d: `
      <p class="small">La page de garde (un PDF qui résume le mois et liste ce qui manque), les journaux au format CSV (ventes, achats, encaissements, règlements fournisseurs, trésorerie), les factures et avoirs en PDF, les bulletins de paie, et les justificatifs que ton client a joints à ses achats.</p>
      <p class="small"><b>Et surtout <code>journaux/ecritures.csv</code></b> : les pièces du mois déjà transformées en écritures en partie double, à importer dans ton logiciel au lieu de les ressaisir. Si les numéros de compte ne sont pas les tiens, donne-les à ton client une fois : il les saisit dans son SkanFact et tous ses envois suivants sont à ton format.</p>
      <p class="small">Un <b>manifeste</b> porte l'empreinte de chaque fichier. À l'import, SkanFact les recalcule toutes : c'est ce qui te permet d'affirmer que ce que tu as reçu est exactement ce qui a été envoyé.</p>
      <p class="small">Le compte va dans les <b>deux sens</b>. Un fichier présent dans le paquet que le manifeste n'annonce pas est signalé à part (« non annoncé ») : il n'entre jamais dans les pièces vérifiées, il porte un « ? » dans la liste, et l'application te pose une question avant de l'ouvrir. Un paquet fabriqué par SkanFact n'en contient jamais.</p>
      <p class="small">Les paquets sont rangés sur ton disque par <b>client</b>, puis par <b>année</b>. Tu peux les retrouver dans ton gestionnaire de fichiers sans ouvrir l'application, et rendre à un client ses pièces en copiant un dossier.</p>
      <p class="small">Tu peux en déposer <b>vingt d'un coup</b> : l'application les range l'un après l'autre en te disant où elle en est, et tu peux arrêter en cours de route. L'arrêt attend la fin du paquet en cours — ce qui est rangé l'est pour de bon, le reste se redépose plus tard.</p>` },
    {
      id: 'travail', t: 'Ce que tu fais des paquets reçus',
      s: 'Échéances et écritures : les deux pages qui s\'en nourrissent', couleur: 'th-declarer', geste: { label: 'Ouvrir l\'export d\'écritures', hash: '#/ecritures' },
      icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>', d: `
      <p class="small">Deux pages vivent de ce que tes clients t'envoient :</p>
      <ul class="small" style="line-height:1.8">
        <li><b>Échéances</b> rattache chaque date de dépôt aux clients dont tu n'as <i>pas</i> les pièces. Un calendrier papier te donne la date ; celui-ci te donne la date <b>et</b> la liste de ceux qu'il faut relancer avant. Les jours proposés suivent l'usage tunisien et se règlent dans Réglages — <b>À VÉRIFIER</b>, ils dépendent de la forme juridique et du régime.</li>
        <li><b>Écritures</b> sort en un seul fichier CSV les écritures en partie double de <b>tous</b> tes clients sur le mois (ou l'année), avec le client, son matricule et le mois devant chaque ligne. C'est ce fichier que tu importes dans ton logiciel, au lieu de ressaisir.</li>
      </ul>
      <p class="small">Si les numéros de compte proposés ne sont pas les tiens, donne-les une fois à ton client : il les saisit dans son SkanFact (Comptabilité → Écritures → Plan comptable) et tous ses envois suivants arrivent à ton format.</p>` },
    {
      id: 'definitif', t: 'Définitif ou provisoire',
      s: 'Un mois clôturé ne bougera plus ; un mois provisoire, si', couleur: 'th-encaisser', geste: { label: 'Voir les échéances', hash: '#/echeances' },
      icon: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>', d: `
      <p class="small">Un paquet n'est <b>définitif</b> que si le client a clôturé son mois : après une clôture, il ne peut plus ni modifier ni supprimer une pièce de cette période sans rouvrir le mois, avec un motif écrit.</p>
      <p class="small">Un paquet <b>provisoire</b> se lit, mais ses chiffres peuvent encore bouger. Si tu reçois deux fois le même mois, SkanFact te le dit — et te prévient si le remplacé était définitif.</p>` },
    {
      id: 'filets', t: 'Ne rien perdre',
      s: 'Trois filets, et ce que chacun protège', couleur: 'th-piloter', geste: { label: 'Ouvrir les sauvegardes', hash: '#/reglages', panneau: 'pan-backup' },
      icon: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/>', d: `
      <p class="small">Trois filets, et ils ne font pas la même chose :</p>
      <ul class="small" style="line-height:1.8">
        <li><b>La sauvegarde quotidienne</b> te protège de <i>toi</i> : une suppression de trop, un import raté. Elle est automatique, trente jours.</li>
        <li><b>La copie vers un autre support</b> te protège de <i>l'ordinateur</i> : panne, vol, incendie. Elle emporte la base, les sauvegardes et les paquets. Choisis une clé USB ou un dossier iCloud dans Réglages.</li>
        <li><b>La clé de secours</b> te protège de la <i>perte totale</i>. Elle contient la clé qui ouvre les paquets de tes clients. Sans elle et sans cet ordinateur, aucun paquet déjà reçu ne se rouvre — jamais. Range-la ailleurs.</li>
      </ul>
      <p class="small">Ton mot de passe, lui, ne se récupère pas. C'est voulu : c'est ce qui fait qu'un portable volé n'emporte pas soixante comptabilités. Note-le quelque part de sûr le jour où tu le choisis.</p>
      <p class="small">Et un quatrième filet, invisible celui-là : si l'application se bloque, elle s'en aperçoit toute seule, note dans son journal technique <b>où</b> le programme s'était arrêté, puis redémarre et te le dit. Tu reviens sur l'écran du mot de passe : c'est normal, rien n'est perdu. Si cela se reproduit, envoie le rapport par <em>Aide → Signaler un problème</em> — c'est ce qui permet de corriger.</p>` },
    {
      id: 'demenager', t: 'Changer d\'ordinateur',
      s: 'Reprendre ton cabinet ailleurs, avec la MÊME empreinte', couleur: 'th-acheter', geste: { label: 'Ouvrir la sécurité', hash: '#/reglages', panneau: 'pan-secu' },
      icon: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>', d: `
      <p class="small">Ton cabinet, c'est <b>trois</b> choses : tes dossiers, tes paquets, et <b>la clé</b> qui les ouvre. La clé compte autant que le reste : c'est elle qui porte ton <b>empreinte</b>, celle que tes clients ont enregistrée dans leur SkanFact.</p>
      <p class="small"><b>Ce qu'il ne faut pas faire :</b> installer l'application sur le nouveau poste et créer un cabinet. Il aurait une clé neuve, donc une empreinte neuve — et tous les paquets que tes clients t'enverraient ensuite seraient refusés : « adressé à un autre cabinet ». Rien ne serait perdu, mais plus rien n'arriverait.</p>
      <p class="small"><b>Ce qu'il faut faire :</b> sur l'écran de mot de passe du nouveau poste, clique sur <b>« J'ai déjà un cabinet sur un autre ordinateur… »</b> avant tout le reste.</p>
      <ul class="small" style="line-height:1.8">
        <li><b>Si tu as ton dossier de copie</b> (la clé USB, le disque externe ou le dossier iCloud choisi dans Réglages → Données et sécurité) : désigne-le. Il contient <code>cabinet-data.json</code>, tes sauvegardes <b>et tes paquets</b>. Tout revient d'un coup.</li>
        <li><b>Si tu n'as que le fichier</b> <code>cabinet-data.json</code> (ou une sauvegarde) : désigne-le. Tes dossiers et ta clé reviennent. Pour les pièces déjà reçues, recopie ensuite le dossier <code>paquets</code> dans le dossier de l'application (Réglages → Données et sécurité → Sauvegardes, « Ouvrir le dossier ») : SkanFact les retrouve tout seul à l'ouverture suivante.</li>
        <li><b>Si tu n'as que ta clé de secours</b> (<code>.skanrecover</code>) : crée un cabinet ici, l'application te réclamera ce fichier aussitôt. Ton empreinte redevient la tienne et tes clients n'ont rien à refaire — mais tes dossiers et tes paquets, eux, ne reviennent pas.</li>
      </ul>
      <p class="small">Dans tous les cas, le mot de passe demandé est celui de <b>l'autre</b> ordinateur : c'est lui qui chiffre le fichier, il n'a pas changé. Et vérifie l'empreinte affichée à la fin : si elle n'est pas celle que tes clients connaissent, tu as repris le mauvais fichier.</p>
      <p class="small">Deux choses ne suivent pas : le <b>dossier de copie</b> (il désignait un support branché sur l'autre poste — rechoisis-en un tout de suite) et la <b>boîte de réception</b>. L'ancien ordinateur, lui, garde tout : rien n'y est effacé ni déplacé.</p>` },
    {
      id: 'limites', t: 'Ce que cette application ne fait pas',
      s: 'Ce qu\'elle ne fera pas — et pourquoi c\'est volontaire', couleur: 'th-equipe', geste: null,
      icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>', d: `
      <p class="small">Elle <b>ne modifie jamais</b> la comptabilité de tes clients et ne leur renvoie rien. Une correction se demande au client, qui la saisit chez lui : sinon deux versions des mêmes comptes coexistent, et plus personne ne sait laquelle fait foi.</p>
      <p class="small">Elle ne dépose aucune déclaration et ne se connecte à aucune administration. Elle ne facture pas tes honoraires. Elle n'envoie aucun mail toute seule : elle prépare le texte, ta messagerie l'envoie.</p>
      <p class="small">Elle ne gère pas encore plusieurs collaborateurs sur le même cabinet : un poste, un mot de passe, une personne.</p>` },
    {
      id: 'maj', t: 'Les mises à jour',
      s: 'Comment elles arrivent, et où les déclencher', couleur: 'th-piloter', geste: { label: 'Ouvrir les mises à jour', hash: '#/reglages', panneau: 'pan-maj' },
      icon: '<path d="M12 3v12"/><path d="M7.5 11L12 15.5 16.5 11"/><path d="M4 19h16"/>', d: `
      <p class="small">SkanFact Cabinet vérifie au démarrage s'il existe une version plus récente, la télécharge et te propose de l'installer : <b>Réglages → L'application → Mises à jour</b>. Sur Mac, l'application se ferme, se remplace toute seule et se relance — une dizaine de secondes.</p>
      <p class="small">L'application et celle de tes clients portent le <b>même numéro de version</b> : si un client dit « je suis en 6.8.0 » et que tu es en 6.8.0, vous parlez bien de la même chose.</p>` }
  ];

  return { INFO, ARTICLES };
});
