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
    'u.essai': { t: 'Versions d\'essai', d: 'Activé, ce poste reçoit les versions d\'essai de SkanFact Cabinet <b>avant</b> tous les autres cabinets. Elles peuvent contenir des défauts : c\'est à ça qu\'elles servent. Une sauvegarde « avant-beta » est prise au moment où tu l\'actives, et désactiver te ramène au canal normal à la prochaine version stable. La ligne dit quelle version d\'essai est en cours, telle qu\'elle est publiée.' },
    'cab.name': { t: 'Nom du cabinet', d: 'Le nom sous lequel tes clients te connaissent. Il apparaît en bas des relances que tu envoies et dans le fichier d\'appairage que tu leur remets. Écris-le comme sur ton papier à en-tête.' },
    'cab.email': { t: 'Email du cabinet', d: 'L\'adresse à laquelle tes clients te répondent. Elle est écrite dans le fichier d\'appairage : c\'est aussi comme ça qu\'ils savent que le fichier vient bien de toi.' },
    'cab.phone': { t: 'Téléphone du cabinet', d: 'Facultatif. Utile si tu veux qu\'il apparaisse dans tes messages de relance : en Tunisie, un client rappelle plus souvent qu\'il ne répond à un mail.' },
    'cab.relanceDay': { t: 'Jour de relance', d: 'Le jour du mois où tu fais ta tournée de relances. À partir de cette date, l\'application met en tête de « À faire » les clients qui n\'ont pas encore envoyé leurs mois clôturés. Le 10 est l\'usage : les clients ont eu le temps de finir le mois précédent. Entre 1 et 28.' },
    'cab.fingerprint': { t: 'Empreinte de ton cabinet', d: 'Cinq groupes de quatre caractères calculés à partir de ta clé publique. Elle identifie ton cabinet de façon unique. Quand un client importe ton fichier d\'appairage, son SkanFact lui montre cette empreinte : s\'il te la lit au téléphone et qu\'elle correspond, c\'est bien à toi qu\'il enverra ses paquets — et à personne d\'autre.' },
    'cab.signature': { t: 'Empreinte de ta signature', d: 'Tes fichiers de clôture et de questions partent <b>signés</b>. La première fois qu\'un client en reçoit un, son SkanFact retient cette signature ; ensuite il refuse un envoi signé par une autre clé, ou pas signé du tout. C\'est ce qui lui prouve que le fichier vient bien de toi — personne ne peut fabriquer ta signature sans la clé de ton cabinet. Elle suit ta clé : tous tes postes signent pareil, et elle ne change que si tu changes de clé.' },
    'cab.pairing': { t: 'Fichier d\'appairage', d: 'Un petit fichier <b>.skanpair</b> à envoyer à chaque client (par mail, il ne contient rien de secret : seulement ta clé <b>publique</b>). Il l\'importe une fois dans <b>Paramètres → Envois → Ton cabinet comptable</b> de son SkanFact. À partir de là, tous ses paquets sont chiffrés pour toi seul, et il n\'a plus aucun mot de passe à te communiquer. « Remettre le fichier à mes clients… » l\'enregistre, puis prépare le message qui l\'envoie : tes clients en copie cachée, et ce qu\'ils doivent faire.' },

    // — un dossier —
    'd.name': { t: 'Nom du client', d: 'La raison sociale, comme sur son registre de commerce. Si le client t\'envoie des paquets, ce nom se met à jour tout seul d\'après ce qu\'il a saisi dans son SkanFact : c\'est lui qui fait foi.' },
    'd.matricule': { t: 'Matricule fiscal', d: 'C\'est <b>lui</b> qui identifie un dossier, pas le nom : un nom se corrige, change de forme juridique, et deux clients peuvent s\'appeler pareil. En Tunisie il ressemble à <b>1234567X/A/M/000</b>. Saisis-le dès la création : le jour où ce client passera à SkanFact, ses paquets tomberont dans ce dossier-ci au lieu d\'en créer un second.' },
    'd.email': { t: 'Email du client', d: 'L\'adresse à laquelle partent tes relances. Sans elle, le bouton « Écrire » ouvre quand même le message, mais tu devras taper le destinataire à la main.' },
    'd.phone': { t: 'Téléphone du client', d: 'Avec l\'indicatif si tu veux appeler ou écrire sur WhatsApp depuis l\'application (<b>+216 …</b>). C\'est souvent le seul moyen d\'obtenir une réponse rapide.' },
    'd.contact': { t: 'Interlocuteur', d: 'La personne que tu appelles vraiment : le gérant, la secrétaire, le comptable interne. Utile quand la société a un nom et que la personne en a un autre.' },
    'd.note': { t: 'Note interne', d: 'Ce que tu veux te rappeler sur ce dossier : particularités, accords, historique. Cette note ne quitte jamais ton ordinateur et n\'est jamais envoyée au client.' },
    'd.archived': { t: 'Dossier archivé', d: 'Un client parti ou en sommeil. Il disparaît des listes et n\'est plus réclamé, mais ses paquets restent consultables : coche « Voir les dossiers archivés » pour le retrouver. Préfère toujours l\'archivage à la suppression.' },
    'd.manual': { t: 'Client hors SkanFact', d: 'Un dossier que tu as créé toi-même, pour un client qui n\'utilise pas encore SkanFact. Il compte dans ton portefeuille mais rien ne lui est réclamé : on ne réclame pas des paquets à quelqu\'un qui n\'a pas l\'application. Sa comptabilité se tient ici, à la main : onglet <b>Comptabilité</b> de sa fiche, « Commencer le livre ». Le jour où il t\'enverra son premier paquet, le dossier deviendra un dossier ordinaire tout seul.' },
    'd.from': { t: 'Début de mission', d: 'Le premier mois que tu attends de ce client, au format <b>2026-01</b>. Laisse vide si tu veux partir du premier paquet reçu. Renseigne-le quand tu <b>reprends un dossier en cours d\'année</b> : sans cette date, les mois antérieurs ne te seraient jamais réclamés, et tu t\'en apercevrais au bilan.' },
    'd.regime': { t: 'Régime fiscal', d: 'Le régime d\'imposition du client. Il ne change pas ce que l\'application attend de lui (un client tient sa comptabilité tous les mois quoi qu\'il arrive) mais il te rappelle ce que tu dois déposer pour lui. <em>À VÉRIFIER avec le dossier fiscal du client.</em>' },
    'd.tvaPeriod': { t: 'Périodicité de la TVA', d: 'Mensuelle, trimestrielle, ou non assujetti. Sert de pense-bête pour tes déclarations. <em>À VÉRIFIER : la périodicité dépend du régime et du chiffre d\'affaires.</em>' },
    'd.fees': { t: 'Honoraires mensuels', d: 'Ce que ce dossier te rapporte chaque mois, en dinars. Facultatif, et strictement privé : ça ne sert qu\'à totaliser ton portefeuille sur la page Dossiers. SkanFact Cabinet ne facture rien et n\'envoie rien à personne.' },
    'd.ca': { t: 'Le chiffre d\'affaires du client', d: 'Il vient des paquets eux-mêmes : depuis la 6.2.1, chaque paquet porte les chiffres du mois (chiffre d\'affaires, TVA collectée et déductible, TVA à décaisser, encaissements). Tu les lis donc <b>sans ouvrir un seul CSV</b>. Les douze mois de l\'année sont toujours dessinés et ceux que tu n\'as pas reçus restent vides : un graphique réduit aux trois mois reçus n\'apprend rien. Un paquet plus ancien que la 6.2.1 ne porte pas de chiffres — la case reste vide, elle n\'affiche jamais zéro.' },
    'd.liste': { t: 'Coller une liste de clients', d: 'Une ligne par client. Tu peux copier une colonne entière depuis Excel ou Numbers et la coller ici. Si tu veux donner plus qu\'un nom, sépare les colonnes par un point-virgule, dans cet ordre : <b>nom ; matricule ; email ; téléphone</b>. Seul le nom est obligatoire, et l\'ordre des trois autres n\'a pas d\'importance : un email et un numéro de téléphone se reconnaissent tout seuls. Les doublons (même matricule, ou même nom) sont ignorés et signalés.' },

    // — les paquets —
    'p.definitif': { t: 'Définitif ou provisoire', d: 'Un paquet est <b>définitif</b> quand le client a clôturé son mois : il ne peut plus modifier ni supprimer une pièce de cette période sans rouvrir le mois, avec un motif écrit. Un paquet <b>provisoire</b> se lit, mais ses chiffres peuvent encore bouger : ne déclare pas dessus.' },
    'p.moisTenus': { t: 'Les mois d\'un client tenu au cabinet', d: 'Ce client n\'envoie aucun paquet : ses mois se lisent dans le <b>livre</b> que tu tiens pour lui, du premier mois de l\'exercice à celui qui vient de finir. Un mois est <b>à saisir</b> tant qu\'il n\'a aucune écriture, <b>saisi</b> puis <b>déclaré</b> quand sa déclaration est marquée déposée — le même état que dans la page Production. Clique un mois pour le saisir ou ouvrir sa déclaration.' },
    // Les livres lus dans les paquets (9.1.0).
    'lv.compta': { t: 'La comptabilité de ce client', d: 'Le <b>livre</b> que tu tiens pour ce client, exercice par exercice : saisie, livre-journal, grand livre, balance, lettrage, déclaration, banque, immobilisations, paie, révision, clôture et liasse.<br><br>Il se crée de deux façons. Pour un client sur SkanFact, <b>à partir des paquets reçus</b> : ses écritures arrivent déjà écrites, avec le même moteur que son application, au millime près. Pour un client <b>hors SkanFact</b>, ou repris d\'un autre logiciel, en posant son exercice et sa balance d\'ouverture : tout se saisit ensuite ici.<br><br>Le Cabinet ne modifie jamais rien chez le client. Les mois qui manquent sur la période sont nommés en tête : un livre incomplet qui ne le dirait pas serait un livre faux.' },
    'lv.ouverture': { t: 'Ce que « ouverture » veut dire ici', d: 'L\'<b>ouverture</b> d\'une période, c\'est ce que chaque compte portait la veille de son premier jour. Sur le <b>livre</b> du dossier, elle se calcule : la balance d\'ouverture reprise (Réglages du dossier → « Reprendre ») plus les mouvements de l\'exercice antérieurs à la période affichée. Sur l\'exercice entier elle est donc nulle par construction — c\'est la pièce d\'à-nouveau qui porte les soldes reportés.<br><br>Quand les écritures sont <b>lues dans les paquets</b> (pas encore de livre), il n\'y a aucune ouverture : les soldes sont ceux des mouvements reçus, pas ceux du compte depuis sa création.' },
    'lv.relire': { t: 'Ce que « Relire les paquets reçus » fait', d: 'Un geste <b>sûr</b>. Il relit les paquets du client et : <b>ajoute</b> les écritures qui manquent au livre, <b>remplace</b> les brouillards d\'un mois que le client a renvoyé, et <b>ne touche jamais</b> une écriture validée — si le client a changé une pièce que tu as déjà validée, l\'écart t\'est montré et c\'est toi qui tranches. Ton travail (saisies, validations, lettrages) n\'est pas en jeu.' },
    'rg.regimes': { t: 'Les régimes et leurs échéances', d: 'Ce que chaque régime <b>dépose</b>, et quand. Le champ « Régime fiscal » existe sur la fiche d\'un client depuis longtemps ; jusqu\'ici personne ne le lisait, et le calendrier réclamait une TVA mensuelle à tout le monde — <b>y compris à un forfaitaire qui n\'en dépose pas</b>. Tant que tu ne déclares aucun régime, rien ne change : c\'est le comportement d\'avant, et il ne se modifie pas tout seul. Dès que tu en déclares un, les dossiers qui le portent suivent SES règles : périodicité de TVA, CNSS ou non, et les échéances annuelles que tu écris toi-même (<code>nom@JJ-MM</code>). <em>À VÉRIFIER : aucune de ces périodicités ni aucune de ces dates n\'est écrite dans SkanFact. Ce sont les tiennes.</em>' },
    'li.liasse': { a: 'liasse', t: 'La liasse', d: 'Le bilan et l\'état de résultat en <b>rubriques</b>, déduits de la balance — jamais saisis. Chaque rubrique s\'ouvre sur les comptes qui l\'ont remplie : un chiffre qu\'on ne peut pas ouvrir se croit ou ne se croit pas, et sur une liasse c\'est le pire des deux. Une rubrique qu\'aucun compte n\'a remplie vaut « — » avec sa raison, jamais 0 : un zéro se recopie sur un formulaire. Et ce qu\'<b>aucune</b> rubrique ne capte est montré en rouge : une liasse qui perd un compte en silence est une liasse fausse. <em>À VÉRIFIER : la présentation exacte du système comptable des entreprises n\'est validée par personne ici. Confronte-la à ce que le portail attend.</em>' },
    'li.taux': { t: 'Le taux d\'impôt', d: 'Il n\'existe <b>nulle part</b> dans SkanFact, et ce n\'est pas un oubli : il dépend de la forme juridique, du secteur et de la loi de finances de l\'année — trois choses qu\'un logiciel écrit aujourd\'hui ne peut pas suivre. Tu le saisis ici, en pourcentage, et l\'impôt se calcule sur la base imposable. <b>Laisse le champ vide</b> et l\'impôt vaut « — » avec sa raison : c\'est le bon état tant que tu n\'as pas tranché. <em>À VÉRIFIER avec ton client.</em>' },
    'li.fiscal': { a: 'liasse', t: 'Le résultat fiscal et l\'impôt', d: 'Résultat comptable, <b>plus</b> les réintégrations, <b>moins</b> les déductions et les reports : c\'est la base imposable. Ce qui se réintègre et ce qui se déduit dépend du <b>droit</b> — rien n\'est proposé, chaque ligne se saisit et s\'explique. Le <b>taux d\'impôt n\'existe nulle part dans SkanFact</b> : il dépend de la forme juridique, du secteur et de la loi de finances de l\'année. Tant qu\'il n\'est pas saisi, l\'impôt vaut « — ». Le minimum d\'impôt n\'est pas calculé non plus : un chiffre inventé sur une déclaration coûte plus cher qu\'une case vide. <em>À VÉRIFIER.</em>' },
    'li.employeur': { t: 'La déclaration annuelle d\'employeur', d: 'Elle porte <b>deux choses distinctes</b> qu\'on confond : les <b>salaires versés</b>, et les <b>retenues à la source</b> pratiquées sur des fournisseurs (honoraires, loyers). Les deux figurent sur le même formulaire. Le Cabinet ne donne ici que les <b>masses</b> lues dans le livre : le détail par bénéficiaire demande les bulletins de paie, qu\'il ne reçoit pas. Ces masses se confrontent à l\'état nominatif que ton client tient dans SkanFact.' },
    'li.modele': { a: 'liasse', t: 'Le modèle de liasse', d: 'Quelle rubrique capte quel compte. Le préfixe le plus <b>long</b> gagne, parmi les rubriques du bon <b>sens de solde</b> : le 44 débiteur est une créance sur l\'État, le même 44 créditeur est une dette envers lui — les deux rubriques existent et portent le même préfixe. « Les deux » sert à ce qui garde sa rubrique quel que soit son sens : un résultat reporté peut être une perte, un compte de ventes peut finir débiteur ; le montant s\'y lit alors en négatif. « En moins » marque ce qui se retranche de son état : les amortissements à l\'actif, les charges au résultat. Tant que tu n\'écris rien, le modèle proposé sert ; dès que tu en écris un, il le remplace <b>entièrement</b>.' },
    'rv.dossier': { t: 'Le dossier de révision', d: 'Ton dossier de travail sur une période — un mois pour arrêter une TVA, l\'exercice pour arrêter un bilan. Il réunit quatre choses : les <b>feuilles maîtresses</b> par cycle, les comptes que tu as <b>signés</b>, tes <b>notes de revue</b>, et le <b>questionnaire</b> de fin d\'exercice. Rien n\'y est obligatoire et rien n\'y bloque : les contrôles nomment ce qui manque, tu arrêtes quand tu décides. Une période arrêtée passe à « révisée » dans le tableau de production, et se rouvre à tout moment.' },
    'rv.feuilles': { a: 'revision', t: 'Les feuilles maîtresses', d: 'Un cycle, une feuille : chaque compte avec son ouverture, ses mouvements, son solde et sa <b>variation</b> — c\'est elle qui désigne ce qu\'il faut regarder. Seules les écritures <b>validées</b> y entrent : on ne révise pas un brouillard, qui par définition n\'est pas encore un fait, et les contrôles te disent combien en restent. Les sept cycles proposés rattachent un compte par son préfixe, et <em>aucun rattachement n\'est une vérité comptable</em> : si ton cabinet range autrement, écris tes cycles dans Réglages → Comptabilité.' },
    'rv.hors': { t: 'Les comptes hors cycle', d: 'Ceux qu\'aucun cycle ne réclame. On les MONTRE plutôt que de les perdre : un compte hors cycle est très exactement celui qu\'une révision doit voir. S\'ils sont nombreux, c\'est que ta table de cycles ne couvre pas ton plan — elle se complète dans les Réglages.' },
    'rv.notes': { t: 'Les notes de revue', d: 'Ce qu\'il reste à vérifier, écrit par toi ou par ton superviseur, avec son auteur et sa date. Elles <b>restent au cabinet</b> : elles ne partent jamais chez le client. Une note « levée » est réglée ; les notes ouvertes sont signalées avant d\'arrêter la révision, sans jamais la bloquer.' },
    'rv.questionnaire': { t: 'Le questionnaire de fin d\'exercice', d: 'Les questions que ton cabinet pose sur <b>chaque</b> dossier avant de clôturer — engagements hors bilan, litiges en cours, contrats de leasing, événements postérieurs. Il part <b>vide</b> : ce sont tes questions, pas les nôtres. Écris-le une fois dans Réglages → Comptabilité, et pose-le d\'un clic sur chaque exercice.' },
    'qf.piece': { a: 'revision', t: 'La pièce visée', d: 'Le numéro de la facture ou de l\'achat tel que ton client l\'a écrit (<code>FAC-2026-014</code>). C\'est lui qui fait afficher la question <b>en face de la pièce</b> chez ton client : sans numéro, elle ne s\'affiche que dans sa liste de questions. Laisse vide pour une question qui ne vise aucune pièce.' },
    'qf.compte': { a: 'revision', t: 'Le compte', d: 'Le compte sur lequel tu es tombé sur la question (<code>471</code>, <code>411</code>). Il te sert à toi : la question se range sur la feuille maîtresse de ce compte, et elle se retrouve quand tu y reviens. Ton client, lui, voit la pièce et la question.' },
    'qf.objet': { a: 'revision', t: 'L\'objet', d: 'Trois ou quatre mots qui titrent la question (« Justificatif absent », « Virement sans facture »). C\'est ce que ton client lit en premier dans sa liste ; la question elle-même dit le détail.' },
    'qf.attendu': { a: 'revision', t: 'Ce que tu attends', d: 'Une explication, une pièce, ou une correction de sa part. Ton client le lit à côté de la question : il sait tout de suite s\'il doit écrire une phrase ou joindre un justificatif sur la pièce.' },
    'qf.texte': { a: 'revision', t: 'La question', d: 'Écris-la comme tu la dirais au téléphone, avec le montant ou la date qui la rend précise. Elle part dans le prochain fichier de questions ; la réponse revient toute seule dans son paquet suivant. <b>Rien de ce que tu écris ici ne touche à ses chiffres</b> : une question est une demande, jamais une écriture.' },
    'rv.questions': { a: 'revision', t: 'Les questions posées au client', d: 'Une question naît d\'une <b>ligne</b> : elle porte le compte et la pièce sur lesquels elle est née, et c\'est ce qui lui permet de s\'afficher chez le client <b>en face de cette pièce</b> — pas dans une liste que personne n\'ouvre. Sa réponse revient toute seule dans son prochain paquet. Une question partie dans deux paquets sans réponse remonte en rouge des deux côtés : c\'est le moment de décrocher le téléphone.' },
    'rv.envoi': { a: 'revision', t: 'Envoyer les questions', d: 'Un fichier <code>.skanask</code> : un ZIP ordinaire, signé par ton cabinet et scellé par un mot de passe si tu le souhaites. Le client l\'importe dans SkanFact, et chaque question va se poser en face de sa pièce. <b>Tu n\'écris rien chez lui</b> : une question est une demande, jamais une écriture. Les questions déjà closes ou répondues ne repartent pas.' },
    'rv.reglages': { t: 'Ta méthode de révision', d: 'Les <b>cycles</b> rattachent un compte à sa feuille maîtresse par préfixe (le plus long gagne). Tant que tu n\'en écris aucun, les sept proposés servent ; dès que tu en écris, les tiens les remplacent — jamais un mélange des deux, qui donnerait un rattachement que personne n\'a décidé. Le <b>questionnaire</b> de fin d\'exercice s\'écrit ici une fois pour tous tes dossiers.' },
    'cl.produits': { t: 'Les dossiers de clôture produits', d: 'Chaque fichier <code>.skanclose</code> produit pour ce client, avec sa date, l\'endroit où il a été enregistré, et s\'il était scellé par un mot de passe. « Ouvrir le dossier » le retrouve dans l\'explorateur de fichiers — un fichier qu\'on ne retrouve pas est un fichier qu\'on ne peut pas envoyer. C\'est aussi ce qui répond à « lesquels de mes clients ont reçu le leur ? ».' },
    'cl.historique': { t: 'Clôtures et réouvertures', d: 'Toute la suite, dans l\'ordre : chaque clôture et chaque réouverture avec sa date, qui l\'a faite, et le <b>motif</b> donné. C\'est la seule trace qui explique, des mois plus tard, pourquoi un chiffre a changé après que le client a reçu ses états — et c\'est ce qu\'un contrôleur demande en premier.' },
    'lv.aux': { t: 'La balance auxiliaire', d: 'Le détail d\'un <b>compte collectif</b> — Clients (411…) ou Fournisseurs (401…) — tiers par tiers : ce que chacun doit encore, ou ce qu\'on lui doit. Elle ne prend que les lignes de ce collectif ; les lignes de TVA, de produit ou de charge d\'une même pièce n\'y entrent pas, sinon chaque client solderait à zéro par construction.<br><br>Le contrôle qui compte : son total <b>est</b> le solde du collectif dans la balance générale. Si les deux diffèrent, l\'écran dit d\'où vient l\'écart. Les collectifs sont ceux que le plan du dossier désigne par leur rôle.' },
    'p.integrity': { t: 'Pièces vérifiées', d: 'Chaque paquet porte un manifeste avec l\'empreinte de chacun de ses fichiers. À l\'import, SkanFact les recalcule toutes et compare. « 7 pièces vérifiées, intactes » veut dire exactement ça : ce que tu as reçu est mot pour mot ce qui a été envoyé. Le compte va dans les deux sens : un fichier présent que le manifeste n\'annonce pas n\'y entre jamais, il est signalé à part.' },
    'p.intrus': { t: 'Fichier non annoncé', d: 'Le manifeste liste chacun des fichiers du paquet avec son empreinte. Un fichier qui se trouve dans le paquet <b>sans y figurer</b> n\'a été comparé à rien : il ne compte pas dans les « pièces vérifiées », il porte un « ? » dans la liste, et SkanFact te pose une question avant de l\'ouvrir. Un paquet fabriqué par SkanFact n\'en contient jamais — si tu en vois un, demande à ton client d\'où il vient avant de le lancer.' },
    'p.actions': { t: 'Ce qu\'on peut faire d\'un mois reçu', d: 'Le bouton <b>Actions</b> de chaque ligne l\'ouvre : voir les pièces une par une, <b>extraire</b> tout le contenu dans un dossier de ton choix (pour ton logiciel de production, ou pour rendre ses pièces à un client qui part), montrer le fichier reçu, <b>accuser réception</b> pour que le client sache que c\'est arrivé, passer à ses écritures, ou <b>supprimer</b> un paquet arrivé par erreur — le mois redeviendra manquant.' },
    'p.arret': { t: 'Arrêter un rangement', d: 'Vingt paquets d\'un mois chargé, c\'est une vingtaine de secondes : chacun est ouvert, vérifié pièce par pièce, puis copié. Tu peux arrêter à tout moment — l\'arrêt prend effet <b>à la fin du paquet en cours</b>, jamais au milieu d\'une copie. Les paquets déjà rangés le restent pour de bon ; les autres n\'ont pas été touchés et se redéposent quand tu veux.' },

    // — échéances —
    'ec.dates': { t: 'D\'où viennent ces dates', d: 'Elles sont calculées à partir de la <b>périodicité de TVA</b> que tu donnes à chaque client, et des jours que tu règles dans Réglages. Ce qui fait la différence avec un calendrier papier : chaque échéance compte les clients dont tu <b>n\'as pas encore le mois</b>. <em>À VÉRIFIER : les délais réels dépendent de la forme juridique, du régime et de la loi de finances de l\'année.</em>' },
    'ec.depot': { t: 'Marquer une échéance déposée', d: 'Un <b>pense-bête</b>, rien de plus : SkanFact ne dépose rien à ta place et ne se connecte à aucune administration. Le pointage porte sur <b>cette échéance-là</b> — la TVA d\'avril cesse de te réclamer, celle de mai reste due. Tu peux le défaire à tout moment, sur la carte ou avec le « Annuler » qui s\'affiche juste après.' },
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
    'r.page': { t: 'Les relances', d: 'Les clients dont il te manque un mois, avec le message <b>déjà écrit</b> : les mois manquants sont nommés dedans — un message qui nomme les mois fait bouger, « envoie-moi tes documents » non. SkanFact Cabinet prépare le texte, ta messagerie l\'envoie, et la relance est <b>enregistrée</b> pour que tu saches, lundi, qui tu as déjà relancé.' },
    'r.group': { t: 'Relance groupée', d: 'Prépare un message par client en retard, l\'un après l\'autre, sans revenir à la liste entre chaque. Douze retardataires : douze messages, un seul geste. Rien ne part sans que tu cliques sur « Envoyer » dans ta messagerie.' },

    // — filets —
    'b.daily': { t: 'Sauvegarde quotidienne', d: 'Chaque jour, avant la première modification, SkanFact met de côté le fichier tel qu\'il était. Tu peux donc revenir à « hier matin » après une fausse manœuvre. Trente jours sont conservés, plus les sauvegardes nommées (avant un import, avant une suppression).' },
    'b.external': { t: 'Copie vers un autre support', d: 'Un dossier sur une clé USB, un disque externe, iCloud Drive ou OneDrive. À chaque enregistrement, SkanFact y recopie ta base, tes sauvegardes <b>et tes paquets</b>. C\'est ce qui te sauve quand l\'ordinateur lui-même disparaît — vol, panne de disque, dégât des eaux.' },
    'b.recovery': { t: 'Clé de secours', d: 'Le fichier le plus important que tu produiras avec cette application. Il contient la clé qui <b>ouvre les paquets de tes clients</b>. Sans elle et sans ton ordinateur, aucun paquet déjà reçu ne pourra plus jamais être ouvert, et tes clients devront tous réimporter un nouvel appairage. Range-la ailleurs que sur cet ordinateur : clé USB dans un tiroir, coffre, chez ton associé.' },
    'b.password': { t: 'Mot de passe du cabinet', d: 'Il chiffre tout ce que tes clients t\'envoient. Personne ne peut le récupérer, pas même nous : c\'est ce qui garantit qu\'un portable volé n\'emporte pas soixante comptabilités. Change-le si tu penses qu\'il a été vu, ou quand un collaborateur s\'en va.' },
    'b.restore': { t: 'Restaurer une sauvegarde', d: 'Remplace l\'état actuel par celui de la sauvegarde choisie. L\'application te dit d\'abord ce que la sauvegarde contient et ce que tu as maintenant, pour que tu voies ce que tu perdrais. Une sauvegarde de l\'état actuel est prise juste avant : une restauration n\'est jamais un aller simple.' },
    'b.inbox': { t: 'Boîte de réception', d: 'Le dossier où tu ranges les paquets que tes clients t\'envoient — celui où ta messagerie enregistre les pièces jointes, un dossier partagé, une clé USB. SkanFact le regarde à l\'ouverture et te dit ce qui est arrivé. <b>Il n\'importe jamais tout seul</b> : il propose, tu cliques. Et il n\'efface rien — ce sont les pièces de tes clients, pas les siennes. « Ignorer » ne fait que cesser de te les proposer.' },
    'b.where': { t: 'Où sont mes données', d: 'Tout vit dans un seul dossier sur cet ordinateur : la base chiffrée, les sauvegardes, et les paquets rangés par client et par année. Tu peux l\'ouvrir dans ton gestionnaire de fichiers, le copier sur un disque, l\'inclure dans ta sauvegarde habituelle (Time Machine sur Mac, Historique des fichiers sur Windows).' },
    // — l'équipe (9.9.0) —
    'eq.equipe': { t: 'Travailler à plusieurs', d: 'Tant que tu es <b>seul</b>, tu n\'as rien à déclarer ici : rien n\'est restreint et la piste d\'audit porte le nom de cet ordinateur. Dès que vous êtes plusieurs, déclare chacun : son nom apparaîtra alors sur chaque écriture qu\'il valide, et c\'est la seule chose qu\'un contrôle vient lire. Trois rôles, qui se contiennent l\'un l\'autre — <b>Saisie</b> écrit au brouillard, <b>Validation</b> valide et déclare, <b>Supervision</b> clôture et gère l\'équipe. Une identité <b>déclarée</b>, pas un mot de passe : celui du cabinet ouvre déjà toute la base, donc un second par personne ne protégerait rien de plus. Ce que les rôles apportent, c\'est de savoir qui a fait quoi, et d\'éviter qu\'une écriture soit validée par quelqu\'un dont ce n\'est pas le travail.' },
    'eq.nom': { t: 'Son nom', d: 'Tel qu\'il apparaîtra sur chaque écriture que cette personne valide : c\'est ce qu\'un contrôle vient lire dans la piste d\'audit. Deux personnes du même nom ne se distingueraient pas, et le Cabinet le refuse. Le <b>premier</b> déclaré devient le nom de cet ordinateur : commence par toi.' },
    'eq.role': { t: 'Son rôle', d: 'Trois rôles, qui se contiennent l\'un l\'autre : <b>Saisie</b> écrit au brouillard, importe et rapproche ; <b>Saisie et validation</b> valide aussi, lettre et déclare ; <b>Supervision</b> fait tout, plus la clôture d\'un exercice et la gestion de l\'équipe. Un droit posé sur un dossier précis, dans sa fiche, l\'emporte sur ce rôle. Tant qu\'aucun superviseur n\'existe, chacun peut gérer l\'équipe — pour que personne ne ferme la porte derrière lui.' },
    'eq.droits': { t: 'Les droits sur ce dossier', d: 'Un droit posé ici l\'emporte sur le rôle général : quelqu\'un qui valide partout peut n\'être que saisisseur sur ce client-là, et l\'inverse est vrai aussi. C\'est aussi ce qui <b>confie</b> un dossier à quelqu\'un : son « À faire » ne montre que les dossiers où un droit a été posé pour lui. Laisser vide ne lui interdit rien — il retombe simplement sur son rôle général.' },
    'eq.production': { t: 'Le tableau de production', d: 'Par client et par mois : <b>reçu → saisi → révisé → déclaré</b>, qui et depuis quand. Tout est <b>lu</b> — les paquets reçus, les écritures du livre, les déclarations pointées — jamais coché à la main : une liste d\'états qu\'on coche est fausse le jour où quelqu\'un oublie de cocher. « Révisé » affiche « — » tant que le dossier de révision n\'existe pas : ne pas savoir n\'est pas « non ».' },
    'eq.fusion': { t: 'Réunir deux postes', d: 'Pour le cas où deux ordinateurs ont travaillé sur le même exercice <b>sans se voir</b> : une clé USB, un dossier réseau coupé, quelqu\'un qui a travaillé chez lui. On réunit les deux livres, et trois règles ne bougent pas : une écriture <b>validée</b> ne se fusionne jamais (elle existe ou pas, et celle de l\'autre poste n\'est jamais perdue), un numéro déjà pris est <b>signalé</b> et jamais réattribué, et un brouillard présent des deux côtés est <b>gardé deux fois</b> plutôt que tranché à ta place. Quand les deux postes voient le même fichier, tu n\'as rien à faire : l\'application s\'en aperçoit toute seule à l\'enregistrement.' },

    // — la licence du cabinet (9.4.0) —
    'lic.cab': { t: 'La licence de ton cabinet', d: 'SkanFact Cabinet est <b>gratuit</b> pour tous les dossiers dont le client utilise SkanFact, quel que soit leur nombre, plus <b>trois dossiers hors SkanFact</b>. Au-delà, il faut une licence. On vend des <b>dossiers</b>, jamais des postes : installe l\'application sur autant d\'ordinateurs que tu veux, c\'est le même cabinet. Et ce qui peut attendre une licence, c\'est <b>la validation d\'une écriture</b> — jamais lire, jamais importer un paquet, jamais exporter, jamais relancer un client. Tes pièces ne sont jamais prises en otage.' },
    'lic.comptes': { t: 'Ce qui est compté, et pourquoi', d: 'Chaque dossier est nommé avec sa raison, pour que le chiffre s\'explique tout seul. Ne comptent <b>pas</b> : un dossier archivé, un dossier sans écriture validée depuis douze mois, un client sur SkanFact, et un client dont la licence payée a expiré il y a moins de douze mois (la grâce — on ne te fait pas payer pour un retard qui n\'est pas le tien). Un paquet fabriqué avant la 9.4.0 ne dit pas si son client a une licence : dans le doute, le dossier <b>ne compte pas</b>.' },
    'lic.empreinteCle': { t: 'L\'empreinte de ta licence', d: 'Ne pas confondre avec <b>l\'empreinte de ton cabinet</b> (cinq groupes de quatre), celle que tu dictes à tes clients. Celle-ci fait 32 caractères et se calcule à partir de ta <b>clé</b> : elle sert à parler d\'une licence sans la donner. C\'est elle qu\'on colle sur <b>skanfact.tn/verifier</b> pour savoir si une licence est valable, expirée ou révoquée, et qu\'on cite en écrivant au support. On ne peut pas remonter de l\'empreinte à la clé ; la clé, elle, ne se colle nulle part sur internet.' },
    'lic.cle': { t: 'Coller ta clé', d: 'La clé t\'est envoyée par mail après paiement. Elle est attachée à l\'<b>empreinte de ton cabinet</b> — celle que tu dictes à tes clients — donc elle te suit quand tu changes d\'ordinateur, à condition d\'avoir repris ton cabinet par ta clé de secours. Un cabinet recréé à neuf a une autre empreinte, et la clé ne vaudra plus rien : reprends, ne recrée pas.' },

    // — la saisie (9.3.0) —
    'sa.journal': { t: 'Le journal', d: 'Où ranger cette pièce : ventes, achats, banque, caisse, paie, opérations diverses. C\'est lui qui décide dans quel journal l\'écriture apparaîtra et, plus tard, ce que le centralisateur totalise. Tu modifies la liste des journaux dans le plan du dossier — aucun n\'est imposé.' },
    'sa.date': { t: 'La date', d: 'Tape vite : « 4 » (le 4 du mois en cours), « 4/3 », « 04/03/26 », « 04/03/2026 », ou même « 040326 » au pavé numérique. Une date qui n\'existe pas — un 30 février — laisse le champ en rouge plutôt que de choisir un jour voisin à ta place. C\'est la date de la pièce, pas celle du jour où tu la saisis.' },
    'sa.piece': { t: 'Le numéro de pièce', d: 'La référence du document que tu as sous les yeux : le numéro de la facture, du reçu, du bordereau. Ce n\'est <b>pas</b> le numéro d\'écriture — celui-là est attribué tout seul à la validation, et il est continu. Une pièce peut rester vide, mais tu t\'en mordras les doigts au premier contrôle.' },
    'sa.libelle': { t: 'Le libellé', d: 'Ce que tu liras dans six mois en cherchant cette pièce. « Facture Trabelsi » vaut mieux que « facture ». Chaque ligne peut porter le sien ; sans ça, elle reprend celui de la pièce.' },
    'sa.brouillard': { t: 'Le brouillard', d: 'Tout ce que tu saisis arrive ici : sans numéro, modifiable, supprimable. Un brouillard <b>n\'entre ni dans la balance ni dans le grand livre</b> — ce n\'est pas encore de la comptabilité. Valider, c\'est lui donner son numéro et renoncer à le modifier : après, il se contre-passe.' },
    'sa.touches': { t: 'Les touches', d: 'Elles sont réglables exprès. Une grille de saisie ne s\'apprend pas, elle se reprend : si ton ancien logiciel soldait avec une autre touche, mets-la ici plutôt que de changer tes réflexes. Écris-les comme « F2 », « Enter », « Control+Enter ».' },
    'sa.journalDefaut': { t: 'Journal proposé à l\'ouverture', d: 'Celui qui est déjà choisi quand tu ouvres la grille. Laisse vide pour reprendre le dernier journal utilisé <b>sur ce client</b> — c\'est presque toujours le bon, parce qu\'on saisit un journal entier d\'affilée.' },
    'sa.dateComplete': { t: 'Date complète ou jour seul', d: 'Décoché, tu ne tapes que le jour et le mois vient de la pièce précédente : c\'est plus rapide quand on saisit un mois entier. Coché, la date complète est écrite dans le champ après chaque saisie, ce qui évite de se tromper de mois en fin de journée. Les deux acceptent les mêmes frappes.' },
    'sa.validerLot': { t: 'Valider tout le journal du mois', d: 'Ajoute un bouton qui valide d\'un coup toutes les pièces en brouillard d\'un journal sur le mois affiché. Chaque pièce est contrôlée <b>une par une</b> : une pièce refusée au milieu de cinquante ne consomme aucun numéro et ne bloque pas les autres — elle est nommée, et les quarante-neuf autres passent. Décoche si tu préfères valider pièce par pièce.' },
    // Une touche se règle en sachant ce que le GESTE fait. « Solder la pièce » ne le dit pas tout seul.
    'sa.kSuivante': { t: 'Descendre d\'une ligne', d: 'La touche qui passe au champ suivant, puis à la ligne suivante quand on est au bout. C\'est la touche qu\'on frappe le plus dans une journée : garde celle de tes doigts.' },
    'sa.kSolder': { t: 'Solder la pièce', d: 'Écrit dans la case où tu es le montant qui rend la pièce équilibrée — le débit moins le crédit, en changeant de colonne si besoin. C\'est ce qui évite de calculer la contrepartie de tête sur une facture à six lignes de TVA.' },
    'sa.kRecopier': { t: 'Recopier la ligne du dessus', d: 'Reprend le compte, le tiers et le libellé de la ligne précédente. Utile sur un relevé bancaire où trente lignes se suivent avec le même compte.' },
    // La banque (9.5.0). Le rapprochement se comprend en deux phrases ; sans elles, les quatre
    // niveaux ressemblent à du jargon, et le comptable clique sur « Rapprocher automatiquement »
    // sans savoir ce que le logiciel s'autorise à décider tout seul.
    'bq.niveaux': { a: 'banque', t: 'Les quatre états d\'une ligne', d: '<b>Rapproché</b> : une écriture du compte, et une seule, porte ce montant à quelques jours près — c\'est le seul état que le rapprochement automatique pose lui-même, et il se défait d\'un clic. <b>Probable</b> : plusieurs écritures conviennent, mais le libellé en désigne une ; on te la propose, on ne la pose pas. <b>À confirmer</b> : plusieurs conviennent et rien ne les départage. <b>Sans réponse</b> : le livre ne porte rien en face — c\'est souvent une écriture qui reste à faire. <b>Une ambiguïté n\'est jamais « rapproché »</b> : un rapprochement faux est pire qu\'un rapprochement absent, parce qu\'il ferme la question.' },
    'bq.releve': { a: 'banque', t: 'Le relevé', d: 'Le fichier tel que la banque l\'exporte, ligne par ligne, avec le signe de la banque : ce qui entre est positif, ce qui sort est négatif. Il n\'entre que s\'il se boucle — solde de début, plus les mouvements, égale solde de fin. Un relevé auquel il manque des lignes serait rapproché à moitié, et personne ne saurait dire pourquoi trois mois plus tard.' },
    'bq.suspens': { a: 'banque', t: 'Les suspens', d: 'Ce qui reste, des <b>deux côtés</b> : les lignes de la banque sans écriture en face, et les écritures sans ligne de banque. Un chèque émis fin mars et encaissé en avril vit ici — ce n\'est pas une erreur, c\'est exactement ce qui explique la différence entre le solde du relevé et celui du compte. Regarder un seul côté laisserait passer le cas le plus courant.' },
    'bq.lettrageAuto': { t: 'Lettrer automatiquement', d: 'Relie une facture et son règlement quand ils se soldent <b>exactement</b> et qu\'un seul candidat convient — la référence tranche quand plusieurs règlements portent le même montant. Un règlement partiel reste ouvert : c\'est très exactement ce que « ce client me doit-il encore quelque chose ? » veut savoir, et une lettre posée dessus affirmerait que la facture est payée.' },
    // La déclaration (9.6.0). Trois bulles, et la première est la plus importante : elle dit ce
    // que cette application ne fera JAMAIS.
    'dc.etat': { t: 'L\'état du mois', d: '<b>Reçu</b> : le paquet du client est arrivé. <b>Saisi</b> : au moins une écriture est validée sur ce mois. <b>Déclaré</b> et <b>payé</b> : deux pense-bêtes que tu pointes toi-même — SkanFact <b>ne dépose rien</b> et ne se connecte à aucune administration. Les deux se dé-pointent : ce qui se coche par erreur se décoche.' },
    'dc.cases': { a: 'declaration', t: 'Les cases', d: 'Chaque chiffre est <b>déduit des écritures validées</b> du mois, jamais saisi : un chiffre saisi à côté d\'un livre finit toujours par le contredire. Clique sur « n écritures » pour voir les pièces qui font la case — un chiffre qu\'on ne peut pas ouvrir se croit ou ne se croit pas. Une case marquée « — » est une case dont la <b>règle n\'est pas connue</b> : elle vaut <b>null</b>, jamais zéro, parce qu\'un zéro se recopierait sur le formulaire. Sa raison est à côté, et <b>À VÉRIFIER</b> avec ton cabinet.' },
    'dc.suite': { a: 'declaration', t: 'Les étapes du mois', d: 'Quatre gestes, dans cet ordre, et le bouton en couleur est toujours <b>le suivant</b>. <b>Préparer</b> fige les cases du mois dans le livre (on peut recalculer tant que rien n\'est déposé). L\'<b>écriture du mois</b> solde la TVA collectée contre la déductible et porte le net au compte « à décaisser », timbre et retenues opérées compris : elle arrive au dernier jour du mois et <b>en brouillard</b>, c\'est toi qui la valides. <b>Déposée</b> et <b>payée</b> sont des pense-bêtes — SkanFact ne dépose rien — et se dé-pointent. Le <b>règlement</b>, lui, vient du relevé bancaire quand le dossier en a un : pointer « payée » ne l\'écrit pas, sinon il serait compté deux fois.' },
    // 9.8.0 — la clôture d'exercice
    'cl.etat': { t: 'Clôturer un exercice', d: 'Clôturer, c\'est <b>arrêter de bouger</b> : après, plus aucune écriture de l\'exercice ne change. Rouvrir reste possible et exige un <b>motif</b> — c\'est la seule trace qui expliquera, dans six mois, pourquoi un chiffre a changé après que le client a reçu ses états. Tu peux ouvrir l\'exercice suivant <b>avant</b> d\'avoir fini celui-ci : les à-nouveaux s\'y posent en brouillard et se refont tant qu\'ils ne sont pas validés.' },
    'cl.controles': { a: 'exercice', t: 'Les six contrôles', d: 'Ils <b>nomment, ils ne bloquent jamais</b> : un exercice clos avec trois manques signalés vaut mieux qu\'un exercice jamais clos parce que l\'application faisait la difficile. Chacun dit un <b>geste</b>, pas un constat — « valide-les », « ventile-la », « prépare-les ». Le dernier, l\'équilibre de la balance, est le seul qui soit vraiment grave : il veut dire qu\'une pièce est passée hors de la porte d\'écriture.' },
    'cl.etats': { a: 'exercice', t: 'Les états financiers', d: 'Bilan et état de résultat, <b>déduits de la balance</b>, rubrique par rubrique. Ce qui est garanti : actif = passif au millime, et le résultat du bilan est le même que celui de l\'état de résultat. Ce qui ne l\'est pas : la présentation exacte <b>NCT 01</b> — ce n\'est pas la liasse fiscale, et l\'écran le dit plutôt que de le laisser croire.' },
    'cl.sig': { t: 'Soldes intermédiaires et ratios', d: 'Chaque solde porte <b>sa formule</b> à côté de lui : un chiffre de gestion qu\'on ne sait pas refaire ne se discute pas avec un client. Un ratio dont le dénominateur est nul affiche « — », jamais 0 % — c\'est la même règle que les cases fiscales inconnues. Les rubriques retenues sont celles de l\'usage : <b>À VÉRIFIER</b>.' },
    'cl.anouveaux': { t: 'Les à-nouveaux', d: 'Ce que l\'exercice suivant reprend : les comptes de <b>bilan</b> avec leur solde, et le <b>net</b> des comptes de gestion porté au compte de résultat. Ils se calculent sur les écritures <b>réelles</b> de l\'exercice plus son ouverture — jamais sur les à-nouveaux précédents, ce qui compterait le passé deux fois. Une écriture d\'inventaire marquée « s\'extourne » repart aussi, en miroir, au 1er janvier : l\'originale, elle, reste dans son exercice avec son numéro.' },
    // 9.7.0 — les immobilisations et l'inventaire de fin d'exercice
    'im.etat': { t: 'Les immobilisations du dossier', d: 'Le <b>dossier permanent</b> des biens : ce que l\'entreprise garde et amortit. Pour un client qui n\'a pas SkanFact, c\'est le seul endroit où son plan d\'amortissement existe — personne d\'autre ne le lui calcule. Une fiche n\'est <b>jamais créée toute seule</b> : la durée d\'amortissement est une décision, pas une donnée lue dans un fichier. Le taux dégressif, la bascule au linéaire et la reprise des subventions sont <b>À VÉRIFIER</b> : la bulle de la colonne « Méthode » dit pourquoi, et la fiche le rappelle au moment où on les choisit.' },
    'im.tableau': { a: 'immobilisations', t: 'Le tableau de l\'exercice', d: 'Une ligne par bien : la valeur d\'acquisition, ce qui était déjà amorti au 1er janvier, la <b>dotation de l\'exercice</b>, le cumul et la valeur nette comptable. Les totaux portent sur tous les biens actifs, pas sur ce qui est affiché. « Écrite » veut dire que la dotation de cette année est déjà passée en écriture : la repasser la compterait deux fois, et le bouton s\'éteint.' },
    'im.verifier': { t: 'La méthode, et ce qui reste À VÉRIFIER', d: 'Le <b>taux dégressif</b> se saisit sur la fiche : il dépend de la durée et du régime, et l\'application n\'écrit pas en dur une règle de droit que personne n\'a confirmée. La <b>bascule au linéaire</b> est décochée par défaut, pour la même raison. La <b>reprise de subvention</b> suit ici le rythme de l\'amortissement — c\'est un calcul, pas une règle fiscale. L\'amortissement <b>dérogatoire</b> n\'existe pas : personne ne l\'a demandé, et le format du livre ne lui réserve rien. Tout cela est <b>À VÉRIFIER</b>.' },
    'pa.mois': { t: 'Le mois de paie', d: 'La paie se tient mois par mois : les bulletins, puis l\'écriture qui les porte. Un bulletin garde une <b>copie</b> de son calcul — changer un barème plus tard ne réécrit jamais un bulletin déjà remis à un salarié.' },
    'pa.bulletins': { t: 'Les bulletins du mois', d: 'Un bulletin par salarié : brut, retenues salariales (CNSS, IRPP, contribution de solidarité), net à payer, et le <b>coût employeur</b> — c\'est lui qui entre dans le résultat, jamais le net ni le brut seul. L\'écriture de paie se passe en brouillard une fois les bulletins établis, et chaque bulletin retient celle qui le porte : la repasser compterait la paie deux fois.' },
    'pa.salaries': { a: 'paie', t: 'Les salariés du dossier', d: 'La fiche minimale pour établir un bulletin : nom, date d\'embauche et brut mensuel. Le numéro CNSS n\'est pas obligatoire pour calculer, mais la déclaration trimestrielle le demande — l\'écran le signale sans bloquer. Un salarié qui part ne s\'efface pas : on note sa sortie, et son nom reste sur les bulletins déjà établis.' },
    'pa.cnss': { a: 'paie', t: 'La déclaration CNSS du trimestre', d: 'Un salarié par ligne, son assiette et les deux parts, à recopier sur le portail. <b>SkanFact Cabinet ne dépose rien</b> et ne se connecte à aucune administration : c\'est un pense-bête et un tableau, pas un accusé de réception. <b>À VÉRIFIER</b> — la date d\'échéance et la forme exacte du dépôt dépendent du régime.' },
    'pa.masse': { a: 'paie', t: 'La masse salariale de l\'exercice', d: 'Ce que la paie coûte réellement sur l\'année : le brut versé, ce qui a été retenu au salarié, le net qui est sorti, et les charges patronales (CNSS employeur, accident du travail, TFP, FOPROLOS). Le total est le <b>coût employeur</b>, celui qui entre dans le résultat et dans le seuil de rentabilité.' },
    'iv.etat': { t: 'L\'inventaire de fin d\'exercice', d: 'Inventaire <b>intermittent</b> : on compte ce qui reste au dernier jour, on le valorise, et la différence avec ce que portent les comptes devient une écriture. C\'est ce qu\'on fait pour un dossier sans logiciel de stock — un client sur SkanFact, lui, tient déjà le sien et l\'envoie dans son paquet.' },
    'iv.lignes': { t: 'Ce qui a été compté', d: 'Une ligne par référence : quantité × coût unitaire. Elles se <b>collent depuis un tableur</b> — deux cents références saisies une par une dans un formulaire, personne ne le ferait. Le détail reste dans le livre : un total de stock qu\'on ne peut pas ouvrir se croit ou ne se croit pas.' },
    'iv.variation': { a: 'immobilisations', t: 'La variation de stock', d: 'Ce que le compte de stock portait à l\'ouverture, contre ce que tu viens de compter. Le stock <b>augmente</b> → on débite le stock, on crédite la variation (c\'est une charge en moins) ; il <b>diminue</b> → l\'inverse. Une variation nulle ne produit aucune écriture : une pièce à zéro dans un journal n\'apprend rien. L\'écriture arrive en <b>brouillard</b>, à la date de l\'inventaire.' },
    'bq.agee': { t: 'La balance âgée', d: 'Ce qui reste dû, rangé par ancienneté de l\'échéance : pas encore échu, puis 30, 60, 90 jours et au-delà. C\'est la liste d\'appels du lundi matin. Les tranches sont celles de l\'usage — <b>À VÉRIFIER</b> avec ton cabinet, elles ne sont pas une règle.' },
    'sa.kDupliquer': { t: 'Dupliquer la pièce', d: 'Rouvre une pièce identique à celle qu\'on vient d\'enregistrer, date comprise, prête à être retouchée. C\'est le geste des abonnements et des loyers saisis à la main.' },
    'sa.kValider': { t: 'Enregistrer et valider', d: 'Enregistre la pièce <b>et</b> lui donne son numéro définitif, en un seul geste. Attention : une écriture validée ne se modifie plus — elle se contre-passe. Garde une touche à deux doigts (Control+Enter) plutôt qu\'une touche simple.' },
    'sa.guides': { t: 'Guides d\'écritures', d: 'Un modèle de pièce : un journal, des comptes, et d\'où vient chaque montant. « Achat avec TVA 19 % » pose le 607 au débit, la TVA au débit, le fournisseur au crédit — tu tapes le montant, le reste se remplit. Un guide <b>préremplit, il n\'écrit pas</b> : après le clic, tout est encore modifiable et rien n\'est enregistré. Les guides sont communs à tous tes dossiers ; un dossier peut avoir les siens en plus.' },
    'sa.guideLigne': { t: 'D\'où vient le montant d\'une ligne', d: '<b>Montant fixe</b> : toujours la même somme (un loyer). <b>Taux</b> : un pourcentage du montant que tu tapes (la TVA). <b>Base</b> : le montant que tu tapes, tel quel. <b>Solde</b> : ce qu\'il manque pour que la pièce tombe juste — une seule ligne peut le porter. Une ligne sans rien reste à zéro : tu la tapes.' },
    'sa.abonnements': { t: 'Abonnements', d: 'Un guide plus une périodicité : le loyer de chaque mois, l\'assurance de chaque trimestre. « Générer » crée ce qui manque jusqu\'à aujourd\'hui, <b>en brouillard</b> — jamais validé d\'office : une écriture que personne n\'a regardée ne doit pas engager ta signature. Relancer la génération ne double rien, les mois déjà faits sont retenus.' },
    'sa.correspondance': { t: 'Correspondance des comptes', d: 'Le plan de ton client n\'est pas le tien. Cette table traduit ses numéros vers les tiens <b>à l\'import et à l\'export</b>, jamais en réécrivant une écriture déjà validée : celle-ci porte le compte sous lequel tu l\'as validée, et c\'est lui qui fait foi. La règle la plus précise gagne — 411001 avant 411. Coche « préfixe » pour traduire toute une famille en gardant la fin : 411 → 3411 transforme 411002 en 3411002.' },
    'sa.extourne': { t: 'Extourner', d: 'Créer l\'écriture miroir <b>au 1er du mois suivant</b>. C\'est le geste des charges à payer et des produits à recevoir : on provisionne en fin de mois, on annule au début du suivant. À ne pas confondre avec la contre-passation, qui corrige une erreur à la date du jour et marque l\'écriture d\'origine comme annulée — ici, l\'écriture d\'origine reste intacte, avec son numéro et dans son mois. À VÉRIFIER avec tes usages : certains cabinets extournent au dernier jour du mois suivant.' },

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
        <li><b>Une fois :</b> renseigne ton cabinet dans Réglages, puis remets le fichier d'appairage (<code>.skanpair</code>) à tes clients : « Remettre le fichier à mes clients… » l'enregistre et prépare le message — tes clients qui ont une adresse en copie cachée, ce qu'ils doivent faire, et l'empreinte à vérifier. Tu n'as plus qu'à joindre le fichier.</li>
        <li><b>Chaque mois :</b> ton client clôture son mois puis t'envoie un paquet (<code>.skanpack</code>). Tu le glisses sur la fenêtre, ou tu le double-cliques dans ton gestionnaire de fichiers.</li>
        <li><b>Le jour que tu as choisi</b> (le 10 par défaut, réglable dans Réglages) : la page Dossiers met en tête ceux qui n'ont rien envoyé. Un clic sur « Relancer » prépare le message, et la relance est enregistrée.</li>
      </ol>
      <p class="small">Tes clients qui n'utilisent pas encore SkanFact ont leur place ici aussi : « Nouveau client… » les fait entrer dans ton portefeuille. Rien ne leur est réclamé tant qu'ils n'ont pas commencé — et le message du fichier d'appairage leur dit de ne pas en tenir compte.</p>
      <p class="small">Deux réglages attendent le moment où ils servent, et « Tes premiers pas » les rappellent sans jamais les réclamer : <b>ton équipe</b>, si tu n'es pas seul (qui saisit, qui valide — seul, rien n'est restreint), et <b>ta grille de saisie</b>, pour reprendre les touches de ton logiciel actuel (telle quelle, elle marche déjà).</p>` },
    {
      id: 'saisir', t: 'Saisir au kilomètre',
      s: 'Le brouillard, la validation, et ce qui ne se modifie plus', couleur: 'th-declarer', geste: { label: 'Voir mes dossiers', hash: '#/' },
      icon: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/><path d="M17 17l2 2 4-4"/>', d: `
      <p class="small">La grille vit dans la fiche d'un client, onglet <b>Comptabilité → Saisie</b>. Elle est faite pour le clavier : la souris n'est jamais obligatoire.</p>
      <ul class="small" style="line-height:1.9">
        <li><b>Entrée</b> descend d'une ligne, et en ajoute une quand tu es sur la dernière.</li>
        <li><b>Tab</b> sur le crédit de la dernière ligne <b>solde la pièce</b> : ce qui manque se pose tout seul.</li>
        <li><b>F2</b> recopie la cellule du dessus, <b>F4</b> duplique la pièce entière, <b>Ctrl+Entrée</b> enregistre et valide.</li>
        <li>Le compte se cherche <b>par numéro ou par nom</b> pendant que tu tapes : « 411 » ou « client », « interets » trouve « Intérêts ».</li>
      </ul>
      <p class="small">Toutes ces touches se changent dans <b>Réglages → Comptabilité</b>. Elles ne sont qu'une proposition : reprends celles de ton ancien logiciel plutôt que de changer tes réflexes.</p>
      <h3>Brouillard, puis validation</h3>
      <p class="small">Ce que tu saisis arrive en <b>brouillard</b> : sans numéro, modifiable, supprimable — et il n'entre ni dans la balance ni dans le grand livre. <b>Valider</b> attribue le numéro, continu, par ordre de validation. Après, l'écriture ne se modifie plus : elle se <b>contre-passe</b> (une écriture miroir à la date du jour) ou s'<b>extourne</b> (une écriture miroir au 1er du mois suivant, pour les charges à payer).</p>
      <p class="small">Ce n'est pas une sévérité inutile : une comptabilité qu'on peut réécrire après coup ne prouve plus rien. C'est aussi pour ça que <b>valider un lot ne refuse jamais en bloc</b> — ce qui tombe juste est validé, ce qui ne tombe pas juste t'est nommé et reste en brouillard, sans trouer la numérotation.</p>
      <h3>Ce qui fait gagner du temps</h3>
      <p class="small">Un <b>guide</b> est un modèle de pièce (journal, comptes, d'où vient chaque montant). Un <b>abonnement</b> est un guide plus une périodicité : le loyer de chaque mois. Les deux <b>proposent</b> — l'abonnement génère en brouillard, jamais une écriture validée que personne n'a regardée. Ils se règlent dans Réglages → Comptabilité, et les abonnements sur la fiche du client.</p>
      <p class="small">Tu peux glisser un <b>justificatif</b> sur une écriture : le fichier est copié dans le dossier du client, jamais simplement pointé — celui qui est sur ton Bureau aura disparu bien avant l'écriture qu'il justifie.</p>` },
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
      s: 'Un mois clôturé ne bougera plus, un mois provisoire peut encore changer', couleur: 'th-encaisser', geste: { label: 'Voir les échéances', hash: '#/echeances' },
      icon: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>', d: `
      <p class="small">Un paquet n'est <b>définitif</b> que si le client a clôturé son mois : après une clôture, il ne peut plus ni modifier ni supprimer une pièce de cette période sans rouvrir le mois, avec un motif écrit.</p>
      <p class="small">Un paquet <b>provisoire</b> se lit, mais ses chiffres peuvent encore bouger. Si tu reçois deux fois le même mois, SkanFact te le dit — et te prévient si le remplacé était définitif.</p>` },
    {
      id: 'tenue', t: 'Le manuel de tenue',
      s: 'Le mois, le trimestre, l\'année — et ce que SkanFact ne fera jamais à ta place',
      couleur: 'th-declarer', geste: { label: 'Voir mes dossiers', hash: '#/' },
      icon: '<path d="M4 4h11l5 5v11H4z"/><path d="M15 4v5h5"/><path d="M8 13h8M8 17h5"/>', d: `
      <p class="lead">La boucle d'un dossier, dans l'ordre. Chaque étape a son écran, et aucune ne se saute :
      celle qu'on saute est celle qui fait tomber les chiffres du mois suivant.</p>
      <h3 class="eyebrow">Chaque mois</h3>
      <ol class="small" style="line-height:1.9">
        <li><b>Recevoir</b> — le paquet du client arrive dans la boîte de réception, ou se glisse sur la fenêtre.
          Un client hors SkanFact n'envoie rien : sa saisie se fait à la main, à l'étape suivante — la première
          fois, <b>Comptabilité → Commencer le livre</b> pose son exercice et sa balance d'ouverture.</li>
        <li><b>Saisir</b> — <b>Comptabilité → Saisie</b>, au clavier. Ce qui vient d'un paquet est déjà là ; le reste
          se tape au kilomètre. Tout arrive au <b>brouillard</b>, qui ne porte aucun numéro.</li>
        <li><b>Rapprocher</b> — <b>Banque</b> : le relevé entre, l'automatique ne pose QUE ce qui est certain, et
          l'écriture manquante s'écrit depuis la ligne. L'écart de suspens doit tomber à zéro.</li>
        <li><b>Lettrer</b> — ce qui reste ouvert sur un tiers, c'est ce qu'il doit encore.</li>
        <li><b>Valider</b> — la validation numérote et fige. Une validée ne se modifie plus : elle se contre-passe,
          à la date du jour.</li>
        <li><b>Déclarer</b> — <b>Déclaration</b> : les chiffres à recopier sur le portail, avec leurs pièces derrière.
          « Déposée » et « payée » sont des <b>pense-bêtes</b> : SkanFact ne dépose rien et ne se connecte à
          aucune administration.</li>
        <li><b>Réviser</b> — <b>Révision</b> : les feuilles maîtresses par cycle, les comptes signés, et les
          <b>questions</b> qui partent chez le client et reviennent avec leurs réponses dans son paquet suivant.</li>
      </ol>
      <h3 class="eyebrow">La paie, pour les dossiers qui n'ont pas SkanFact</h3>
      <p class="small"><b>Comptabilité → Paie</b>. Les salariés se déclarent une fois ; chaque mois, un bulletin par
      salarié — brut, absences, primes, retenues — et le net se recalcule pendant la frappe. Un bulletin garde une
      <b>copie</b> de son calcul : changer un barème l'an prochain ne réécrira jamais un bulletin déjà remis.</p>
      <p class="small">Une fois les bulletins établis, <b>l'écriture de paie du mois</b> passe en brouillard au dernier
      jour du mois, et chaque bulletin retient celle qui le porte — la repasser compterait la paie deux fois, et le
      bouton s'éteint en le disant. La <b>déclaration CNSS</b> du trimestre s'affiche à côté, un salarié par ligne,
      à recopier sur le portail. <em>À VÉRIFIER : les barèmes, les taux et la date d'échéance dépendent de la loi de
      finances et du régime.</em></p>
      <p class="small">Un client qui utilise SkanFact, lui, tient sa paie chez lui : ses bulletins arrivent déjà
      écrits dans son paquet mensuel.</p>
      <h3 class="eyebrow">À la fin de l'exercice</h3>
      <ol class="small" style="line-height:1.9">
        <li><b>Immobilisations</b> : les dotations de l'année passent en brouillard au 31/12. Un bien dont la
          dotation est écrite ne se modifie plus sans contre-passation.</li>
        <li><b>Inventaire</b> : le stock compté entre, et sa variation s'écrit — dans le bon sens.</li>
        <li><b>Exercice</b> : les six contrôles nomment ce qui manque sans bloquer, puis la clôture fige tout.
          Une réouverture exige un motif : c'est la seule trace qui expliquera un chiffre qui a changé.</li>
        <li><b>Ouvrir N+1</b> : les à-nouveaux entrent en brouillard sur l'exercice suivant, et se refont tant
          qu'ils ne sont pas validés.</li>
        <li><b>Liasse</b> : le bilan et l'état de résultat en rubriques, le résultat fiscal, la déclaration
          d'employeur. <em>À VÉRIFIER : les rubriques suivent l'usage, et aucun taux d'impôt n'est écrit dans
          l'application.</em></li>
        <li><b>Le dossier pour le client</b> : un <code>.skanclose</code> signé, avec ses à-nouveaux officiels et
          ses états. C'est lui qui garantit que son bilan et le tien ne divergent jamais.</li>
      </ol>
      <h3 class="eyebrow">Ce que SkanFact ne fera jamais</h3>
      <ul class="small" style="line-height:1.9">
        <li><b>Écrire chez ton client.</b> Jamais. Une question est une demande, pas une écriture.</li>
        <li><b>Déposer à ta place.</b> Aucune connexion à une administration, dans aucune version.</li>
        <li><b>Inventer un taux ou une règle de droit.</b> Ce qu'il ne sait pas, il l'écrit « — » avec sa raison,
          et t'attend.</li>
      </ul>` },
    // 10.12.0 (U-08) — sept écrans de comptabilité n'avaient AUCUN article : « rapprochement » ne
    // trouvait rien dans l'Aide. Un article par écran, dans l'ordre du mois du manuel ci-dessus, et
    // chacun finit par son geste. `ecran` désigne l'écran d'un DOSSIER : l'Aide mène à celui du
    // dossier ouvert en dernier, ou fait choisir le dossier quand aucun ne l'a été.
    {
      id: 'banque', t: 'La banque et le rapprochement',
      s: 'Ce que l\'automatique pose, ce qu\'il te laisse, et l\'écart qui doit tomber à zéro', couleur: 'th-encaisser',
      geste: { label: 'Ouvrir la Banque', ecran: 'banque' },
      icon: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8"/><path d="M3 20h18"/>', d: `
      <p class="small"><b>Importer un relevé…</b> lit le fichier que la banque exporte. Les colonnes se reconnaissent à leur nom ;
      celles d'une banque qui nomme les siennes autrement s'associent à la main, avant l'import. Tu saisis aussi les
      <b>soldes de début et de fin</b> du relevé papier : un relevé dont les lignes ne mènent pas de l'un à l'autre est
      refusé avec son écart — il manque des lignes, et un rapprochement à moitié ne s'explique plus trois mois après.
      Le même fichier ne s'importe pas deux fois.</p>
      <p class="small">Les montants gardent le signe de la <b>banque</b> — ce qui entre est positif, ce qui sort négatif —
      pour se relire à côté du relevé papier.</p>
      <h3>Ce que l'automatique pose, et ce qu'il te laisse</h3>
      <p class="small"><b>Rapprocher automatiquement</b> ne pose que ce qui est <b>certain</b> : une seule écriture du
      compte porte ce montant, à quelques jours près. Deux candidats, jamais — la ligne devient « probable » et te les
      montre tous. Un rapprochement faux est pire qu'un rapprochement absent : il ferme la question.</p>
      <p class="small">L'écriture manquante s'écrit <b>depuis la ligne</b> du relevé. Sa contrepartie vient de ta table
      libellé → compte, qui part vide et se remplit un libellé à la fois (le motif le plus long gagne). Sans règle, la
      contrepartie reste vide et l'enregistrement le refuse : ranger le doute au 471 ferait disparaître la question sans
      qu'elle ait été posée. Une écriture rapprochée ne se modifie ni ne se supprime — défais d'abord le rapprochement.</p>
      <h3>Les suspens</h3>
      <p class="small">Ils se comptent des <b>deux côtés</b> : les lignes de la banque sans écriture, et les écritures sans
      ligne — le chèque émis que personne n'a encore encaissé. L'écart se calcule avec le solde de fin du relevé et le
      solde du livre à la même date : il doit tomber à zéro.</p>
      <p class="small">Le rapprochement n'est pas le <b>lettrage</b> : l'un relie la banque au livre, l'autre relie un
      règlement à la facture qu'il paie. Deux questions, deux écrans.</p>` },
    {
      id: 'declaration', t: 'La déclaration du mois',
      s: 'Les chiffres à recopier sur le portail, avec leurs pièces derrière', couleur: 'th-declarer',
      geste: { label: 'Ouvrir la Déclaration', ecran: 'declaration' },
      icon: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>', d: `
      <p class="small">L'écran s'ouvre sur le <b>dernier mois saisi</b> : c'est celui qu'on vient déclarer.
      <b>Préparer la déclaration</b> calcule chaque case depuis le livre — la TVA collectée et la déductible, le crédit
      reporté (lu sur son compte, jamais dans un champ), les retenues à la source, le timbre — et chaque chiffre s'ouvre
      sur ses pièces. Le détail par taux demande un sous-compte de TVA par taux : quand le dossier n'en a qu'un, l'écran
      le dit plutôt que de tout ranger à 19 %.</p>
      <p class="small">Une case dont la règle n'est pas connue (TFP, FOPROLOS, TCL, acomptes) vaut <b>« — » avec sa
      raison</b>, jamais 0 : un zéro se recopie sur un formulaire, un « — » se demande. Le jour où le plan du dossier
      porte le compte, la case se calcule.</p>
      <h3>Déposée, puis payée</h3>
      <p class="small">L'écriture de déclaration passe en <b>brouillard</b> au dernier jour du mois, et ne compte pas dans
      ce qu'elle déclare. « Déposée » puis « payée » sont deux <b>pense-bêtes</b>, dans cet ordre, qui se défont :
      SkanFact ne dépose rien et ne se connecte à aucune administration. Une déclaration déposée ne se refait pas en
      silence — deux chiffres pour un même dépôt, et plus personne ne saurait lequel est parti.</p>
      <p class="small">Les contrôles nomment ce qui manque, ils ne bloquent pas : un mois déclaré avec deux manques
      signalés vaut mieux qu'un mois jamais déclaré. <em>À VÉRIFIER : les cases et les échéances dépendent du régime de
      ton client.</em></p>` },
    {
      id: 'revision', t: 'La révision et les questions',
      s: 'Les feuilles maîtresses, les comptes signés, et ce qui remonte chez le client', couleur: 'th-piloter',
      geste: { label: 'Ouvrir la Révision', ecran: 'revision' },
      icon: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/><path d="M8.5 11l1.8 1.8 3.2-3.3"/>', d: `
      <p class="small">Les <b>feuilles maîtresses</b> rangent les comptes du dossier par cycle — ventes, achats,
      trésorerie, personnel… — selon leur préfixe, le plus long gagnant. Ce rattachement n'est qu'une proposition : la
      table que tu écris dans <b>Réglages → Comptabilité</b> la remplace entièrement. Elles ne lisent que les écritures
      <b>validées</b> : on ne révise pas un brouillard.</p>
      <p class="small">Tu <b>signes</b> un compte revu, et le bouton t'amène au cycle suivant. Les notes de revue gardent
      ce que tu as vu ; le questionnaire de fin d'exercice part <b>vide</b> — c'est ta méthode, SkanFact ne l'écrit pas
      à ta place. <b>Arrêter la révision</b> ne bloque jamais : les contrôles nomment d'abord ce qui reste.</p>
      <h3>Les questions au client</h3>
      <p class="small">Une question naît d'une <b>ligne</b> — un compte, une écriture, une pièce — et s'affiche chez ton
      client <b>en face de cette pièce</b>. <b>Envoyer les questions au client…</b> écrit un fichier <code>.skanask</code>
      signé — scellé par un mot de passe si tu le veux — que ton client importe ; ses réponses reviennent dans son paquet
      suivant, sans rien à envoyer à part. Sans réponse après deux paquets, la question se signale. Une question déjà
      partie se <b>ferme</b>, elle ne s'efface pas : ton client l'a sous les yeux.</p>
      <p class="small">Une question n'est jamais une écriture. Le Cabinet n'écrit pas chez ton client : il lui demande.</p>` },
    {
      id: 'paie', t: 'La paie d\'un client',
      s: 'Les salariés, les bulletins, l\'écriture du mois et la CNSS du trimestre', couleur: 'th-equipe',
      geste: { label: 'Ouvrir la Paie', ecran: 'paie' },
      icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 11h5M18.5 8.5v5"/>', d: `
      <p class="small">Pour les dossiers qui <b>n'ont pas SkanFact</b> : un client qui l'utilise tient sa paie chez lui,
      et ses bulletins arrivent déjà écrits dans son paquet mensuel.</p>
      <p class="small"><b>Déclarer un salarié…</b> une fois. Un numéro CNSS manquant est signalé, jamais bloquant : il
      empêche de déclarer, pas de calculer. Chaque mois, <b>Établir un bulletin…</b> — brut, absences, primes,
      retenues — et le net se recalcule pendant la frappe. Un brut négatif est refusé : la pièce serait équilibrée,
      colonnes inversées, et plausible au milieu de cent autres.</p>
      <p class="small">Un bulletin garde une <b>copie</b> de son calcul, taux compris : changer un barème l'an prochain
      ne réécrira jamais un bulletin déjà remis. Un salarié qui part devient inactif, jamais effacé — son nom vit sur ses
      bulletins.</p>
      <h3>L'écriture et la CNSS</h3>
      <p class="small"><b>Passer l'écriture de paie</b> la pose en brouillard au dernier jour du mois, équilibrée ; chaque
      bulletin retient celle qui le porte, et le bouton s'éteint en le disant — la repasser compterait la paie deux fois.
      Un bulletin dont l'écriture est passée ne se modifie plus : on contre-passe, puis on refait.</p>
      <p class="small">La <b>déclaration CNSS</b> du trimestre s'affiche à côté, un salarié par ligne, à recopier sur le
      portail — celle du quatrième trimestre tombe en janvier. <em>À VÉRIFIER : les barèmes, les taux et les échéances
      dépendent de la loi de finances.</em></p>` },
    {
      id: 'immobilisations', t: 'Les immobilisations et l\'inventaire',
      s: 'Le plan d\'amortissement, les dotations au 31 décembre, et le stock compté', couleur: 'th-acheter',
      geste: { label: 'Ouvrir les Immobilisations', ecran: 'immobilisations' },
      icon: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>', d: `
      <p class="small"><b>Ajouter un bien…</b> : sa valeur, sa date de mise en service, sa durée et son mode. Le plan
      d'amortissement se lit <b>pendant la saisie</b>. Le mode dégressif demande son coefficient : il n'est écrit nulle
      part dans SkanFact, et un dégressif sans coefficient est refusé en le nommant. La bascule au linéaire est une case,
      décochée. <em>À VÉRIFIER : les durées et le coefficient relèvent du droit.</em></p>
      <p class="small">Une acquisition venue d'un paquet remonte <b>sans fiche</b> : l'écran propose de la créer, jamais
      d'office — la durée est une décision.</p>
      <p class="small"><b>Passer les écritures d'inventaire</b> pose les dotations de l'exercice en brouillard au
      31 décembre ; chaque bien retient son écriture, et le bouton s'éteint quand tout est passé. Un bien dont la dotation
      est écrite ne change plus de valeur — contre-passe d'abord — mais se renomme librement.</p>
      <p class="small">Une <b>cession</b> ou une mise au rebut écrit la sortie d'actif : les amortissements repris, la
      valeur nette en charge. Le prix, lui, n'est jamais inventé : il arrive par la facture ou le relevé.</p>
      <h3>L'inventaire</h3>
      <p class="small"><b>Saisir l'inventaire…</b> accepte une liste collée depuis un tableur. La variation de stock
      s'écrit dans le bon sens ; une variation nulle n'écrit rien. Un inventaire sans ligne ne dit pas que le stock est
      vide : il dit que rien n'a été compté.</p>` },
    {
      id: 'exercice', t: 'La clôture de l\'exercice',
      s: 'Six contrôles, une clôture définitive, les à-nouveaux et le dossier pour le client', couleur: 'th-commencer',
      geste: { label: 'Ouvrir l\'Exercice', ecran: 'exercice' },
      icon: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', d: `
      <p class="small">Les <b>contrôles</b> nomment ce qui reste — un brouillard, une déclaration non préparée, une
      dotation non passée — sans bloquer. <b>Clôturer l'exercice…</b> fige tout. Une réouverture exige un <b>motif</b>,
      gardé dans l'historique : c'est la seule trace qui expliquera un chiffre qui a changé après son envoi.</p>
      <p class="small"><b>Ouvrir l'exercice suivant</b> pose les à-nouveaux en brouillard, calculés sur les écritures
      réelles et l'ouverture — jamais sur les à-nouveaux précédents, sinon le passé compterait deux fois. Ils se refont
      tant qu'ils ne sont pas validés. Une charge à payer se prépare par l'extourne, posée au 1er janvier.</p>
      <p class="small">L'écran porte aussi les <b>états financiers</b>, les soldes intermédiaires — chacun avec sa
      formule, pour que tu puisses le refaire — et les ratios, qui valent « — » quand ils n'ont pas de dénominateur.</p>
      <h3>Le dossier pour le client</h3>
      <p class="small"><b>Le dossier pour le client…</b> écrit un fichier <code>.skanclose</code> signé, avec les
      à-nouveaux officiels et les états. Ton client l'importe dans son SkanFact, son exercice se verrouille, et son
      bilan et le tien ne peuvent plus diverger.</p>` },
    {
      id: 'liasse', t: 'La liasse et l\'annuel',
      s: 'Le bilan et le résultat en rubriques, le résultat fiscal, la déclaration d\'employeur', couleur: 'th-vendre',
      geste: { label: 'Ouvrir la Liasse', ecran: 'liasse' },
      icon: '<path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6"/><path d="M8 14h8M8 17h5"/>', d: `
      <p class="small">Les rubriques se <b>déduisent de la balance</b>, jamais saisies, et chaque montant s'ouvre sur les
      comptes qui l'ont rempli. Les rubriques vides sont masquées ; la case les rend, avec leur raison. Ce qu'aucune
      rubrique ne capte est montré : une liasse qui perd un compte en silence est une liasse fausse.</p>
      <p class="small"><b>Ajuster le modèle de rubriques…</b> ouvre la table qui décide quelle rubrique capte quel compte :
      le préfixe le plus long gagne, parmi les rubriques du bon sens de solde. Dès que tu écris la tienne, elle remplace
      entièrement celle proposée.</p>
      <p class="small">Le <b>résultat fiscal</b> part du résultat comptable, ajoute les réintégrations et retire les
      déductions que tu saisis. Aucun taux d'impôt n'est écrit dans SkanFact : tant que tu ne le saisis pas, l'impôt vaut
      « — ». La <b>déclaration annuelle d'employeur</b> donne les masses lues dans le livre — salaires et retenues à la
      source —, pas le détail par bénéficiaire.</p>
      <p class="small"><em>À VÉRIFIER : la présentation exacte n'est validée par personne ici. Confronte-la à ce que le
      portail attend avant de la déposer.</em></p>` },
    {
      id: 'filets', t: 'Ne rien perdre',
      s: 'Trois filets, et ce que chacun protège', couleur: 'th-piloter', geste: { label: 'Ouvrir les sauvegardes', hash: '#/reglages', panneau: 'pan-backup' },
      icon: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/>', d: `
      <p class="small">Trois filets, et ils ne font pas la même chose :</p>
      <ul class="small" style="line-height:1.8">
        <li><b>La sauvegarde quotidienne</b> te protège de <i>toi</i> : une suppression de trop, un import raté. Elle est automatique, trente jours.</li>
        <li><b>La copie vers un autre support</b> te protège de <i>l'ordinateur</i> : panne, vol, incendie. Elle emporte la base, les sauvegardes et les paquets. Choisis une clé USB ou un dossier synchronisé (iCloud Drive, OneDrive) dans Réglages.</li>
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
        <li><b>Si tu as ton dossier de copie</b> (la clé USB, le disque externe ou le dossier synchronisé — iCloud Drive, OneDrive — choisi dans Réglages → Données et sécurité) : désigne-le. Il contient <code>cabinet-data.json</code>, tes sauvegardes <b>et tes paquets</b>. Tout revient d'un coup.</li>
        <li><b>Si tu n'as que le fichier</b> <code>cabinet-data.json</code> (ou une sauvegarde) : désigne-le. Tes dossiers et ta clé reviennent. Pour les pièces déjà reçues, recopie ensuite le dossier <code>paquets</code> dans le dossier de l'application (Réglages → Données et sécurité → Sauvegardes, « Ouvrir le dossier ») : SkanFact les retrouve tout seul à l'ouverture suivante.</li>
        <li><b>Si tu n'as que ta clé de secours</b> (<code>.skanrecover</code>) : crée un cabinet ici, l'application te réclamera ce fichier aussitôt. Ton empreinte redevient la tienne et tes clients n'ont rien à refaire — mais tes dossiers et tes paquets, eux, ne reviennent pas.</li>
      </ul>
      <p class="small">Dans tous les cas, le mot de passe demandé est celui de <b>l'autre</b> ordinateur : c'est lui qui chiffre le fichier, il n'a pas changé. Et vérifie l'empreinte affichée à la fin : si elle n'est pas celle que tes clients connaissent, tu as repris le mauvais fichier.</p>
      <p class="small">Deux choses ne suivent pas : le <b>dossier de copie</b> (il désignait un support branché sur l'autre poste — rechoisis-en un tout de suite) et la <b>boîte de réception</b>. L'ancien ordinateur, lui, garde tout : rien n'y est effacé ni déplacé.</p>` },
    {
      id: 'licence', t: 'La licence de ton cabinet',
      s: 'Ce qui est compté, ce qui reste toujours ouvert', couleur: 'th-piloter', geste: { label: 'Ouvrir la licence', hash: '#/reglages', panneau: 'pan-licence' },
      icon: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', d: `
      <p class="small">On vend des <b>dossiers</b>, jamais des postes : installe l'application sur autant d'ordinateurs que ton cabinet en compte. Les dossiers de tes clients <b>sur SkanFact</b> sont gratuits, et <b>trois dossiers hors SkanFact</b> aussi. Au-delà, chaque dossier que tu tiens toi-même se compte.</p>
      <p class="small">Le panneau <b>Réglages → Mon cabinet → Licence</b> nomme chaque dossier compté et dit pourquoi les autres ne le sont pas. Un chiffre qui décide d'une facture doit pouvoir s'expliquer.</p>
      <h3>Ce qui ne se ferme jamais</h3>
      <p class="small">Quand le quota est dépassé, seule la <b>validation</b> d'écritures s'arrête. Lire, importer un paquet, saisir en brouillard, exporter, relancer : tout reste ouvert. Archiver un dossier que tu ne suis plus rend la main tout de suite.</p>
      <h3>Ce qui profite au cabinet</h3>
      <p class="small">Un client dont la licence SkanFact a été <b>payée</b> ne compte pas pendant douze mois après sa fin : tu ne paies pas parce que ton client a oublié de renouveler. Un paquet trop ancien pour dire si son client a une licence ne compte pas non plus : le doute profite au cabinet.</p>
      <p class="small">La clé de licence porte l'<b>empreinte de ton cabinet</b> : une clé émise pour un autre cabinet, ou celle d'un de tes clients, est refusée en nommant les deux empreintes.</p>` },
    {
      id: 'equipe', t: 'Travailler à plusieurs',
      s: 'Les collaborateurs, leurs droits, et deux postes qui se rejoignent', couleur: 'th-equipe', geste: { label: 'Ouvrir l\'équipe', hash: '#/reglages', panneau: 'pan-equipe' },
      icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>', d: `
      <p class="small">Tant que personne n'est déclaré, <b>rien n'est restreint</b> : un cabinet d'une personne n'a rien à régler. Le premier collaborateur que tu déclares devient l'identité de ce poste, et la piste d'audit porte son nom sur chaque écriture validée.</p>
      <p class="small">Un <b>saisisseur</b> saisit en brouillard et ne valide pas ; le refus nomme qui peut. Aucune lecture n'est jamais fermée. Retirer un collaborateur ne l'efface pas : son nom reste sur ce qu'il a validé.</p>
      <h3>Deux postes, un cabinet</h3>
      <p class="small">Un second poste reprend le cabinet par sa <b>copie externe</b>. Si les deux ont travaillé sur le même livre, la fusion garde <b>toutes</b> les écritures validées des deux côtés et signale un numéro pris deux fois, sans jamais le réattribuer.</p>
      <p class="small">Il n'y a pas de mot de passe par personne : celui du cabinet ouvre déjà toute la base. Les rôles apportent l'<b>attribution</b> (qui a validé) et les <b>droits</b> (qui peut valider), pas un secret de plus.</p>` },
    {
      id: 'limites', t: 'Ce que cette application ne fait pas',
      s: 'Ce qu\'elle ne fera pas — et pourquoi c\'est volontaire', couleur: 'th-equipe', geste: null,
      icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>', d: `
      <p class="small">Elle <b>ne modifie jamais</b> la comptabilité de tes clients et ne leur renvoie rien. Une correction se demande au client, qui la saisit chez lui : sinon deux versions des mêmes comptes coexistent, et plus personne ne sait laquelle fait foi.</p>
      <p class="small">Elle ne dépose aucune déclaration et ne se connecte à aucune administration. Elle ne facture pas tes honoraires. Elle n'envoie aucun mail toute seule : elle prépare le texte, ta messagerie l'envoie.</p>
      <p class="small">Elle ne donne pas un mot de passe à chaque collaborateur. Les collaborateurs se <b>déclarent</b> (Réglages → Mon cabinet) : leurs droits et la piste d'audit portent leur nom. Mais le mot de passe du cabinet ouvre déjà toute la base — un second, par personne, ne protégerait rien de plus.</p>` },
    {
      id: 'maj', t: 'Les mises à jour',
      s: 'Comment elles arrivent, et où les déclencher', couleur: 'th-piloter', geste: { label: 'Ouvrir les mises à jour', hash: '#/reglages', panneau: 'pan-maj' },
      icon: '<path d="M12 3v12"/><path d="M7.5 11L12 15.5 16.5 11"/><path d="M4 19h16"/>', d: `
      <p class="small">SkanFact Cabinet vérifie au démarrage s'il existe une version plus récente, la télécharge et te propose de l'installer : <b>Réglages → L'application → Mises à jour</b>. Sur Mac, l'application se ferme, se remplace toute seule et se relance — une dizaine de secondes.</p>
      <p class="small">L'application et celle de tes clients portent le <b>même numéro de version</b> : si un client dit « je suis en 6.8.0 » et que tu es en 6.8.0, vous parlez bien de la même chose.</p>` }
  ];

  // 10.13.0 — CHAQUE bulle mène à l'article qui la développe. Seize sur cent dix-huit le faisaient :
  // les autres s'arrêtaient à leur dernière phrase, avec une question plus précise et nulle part où
  // aller. Le champ `a` d'une bulle décide quand il existe ; sinon la famille de sa clé (`sa.` la
  // saisie, `bq.` la banque…). La règle la plus précise vient en premier. Un test exige que chaque
  // bulle trouve un article qui existe, et que chaque règle serve au moins une fois.
  const ARTICLE_PAR_CLE = [
    [/^u\./, 'maj'],
    [/^cab\./, 'demarrer'],
    [/^d\.(regime|tvaPeriod)$/, 'declaration'],
    [/^d\.(manual|from)$/, 'tenue'],
    [/^d\./, 'demarrer'],
    [/^p\.definitif$/, 'definitif'],
    [/^p\.moisTenus$/, 'tenue'],
    [/^p\./, 'paquet'],
    [/^lv\.ouverture$/, 'exercice'],
    [/^lv\.relire$/, 'paquet'],
    [/^lv\./, 'tenue'],
    [/^rg\./, 'declaration'],
    [/^li\./, 'liasse'],
    [/^rv\./, 'revision'],
    [/^cl\./, 'exercice'],
    [/^ec\./, 'definitif'],
    [/^e\./, 'travail'],
    [/^r\./, 'demarrer'],
    [/^b\.reprise$/, 'demenager'],
    [/^b\./, 'filets'],
    [/^eq\./, 'equipe'],
    [/^lic\./, 'licence'],
    [/^sa\./, 'saisir'],
    [/^bq\./, 'banque'],
    [/^dc\./, 'declaration'],
    [/^(im|iv)\./, 'immobilisations'],
    [/^pa\./, 'paie']
  ];
  const articleDe = cle => {
    const x = INFO[cle];
    if (!x) return null;
    if (x.a) return x.a;
    const r = ARTICLE_PAR_CLE.find(([m]) => m.test(cle));
    return r ? r[1] : null;
  };

  return { INFO, ARTICLES, ARTICLE_PAR_CLE, articleDe };
});
