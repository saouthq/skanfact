// Textes d'aide : les bulles « i » de l'interface et les articles de la rubrique Aide.
// Séparé de app.js pour que les explications se relisent et se corrigent facilement.
// Ton : tutoiement, phrases courtes, pas de jargon sans définition. Tout ce qui touche à la
// fiscalité tunisienne est marqué « À VÉRIFIER avec ton comptable ».
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkanGuide = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ---------- bulles « i » ----------
  // clé → { t: titre, d: explication (HTML simple : <b>, <br>, <em>) }
  const INFO = {
    // — société —
    'co.name': { t: 'Raison sociale', d: 'Le nom officiel de ton entreprise, exactement comme sur ton registre de commerce (avec la forme juridique : SUARL, SARL, SA…). C\'est ce nom qui apparaît en haut de tous tes documents et qui engage juridiquement.' },
    'co.matricule': { t: 'Matricule fiscal', d: 'Ton identifiant auprès de l\'administration fiscale, obligatoire sur toute facture. En Tunisie il ressemble à <b>1234567X/A/M/000</b>. Une facture sans matricule peut être refusée par le client ou par le fisc. <em>À VÉRIFIER avec ton comptable : le format complet à écrire.</em>' },
    'co.rc': { t: 'Registre de commerce (RC)', d: 'Le numéro que tu as reçu en immatriculant ton entreprise au registre national des entreprises. Il s\'affiche dans le petit texte en bas de tes documents. Ce n\'est pas obligatoire partout, mais ça fait sérieux et beaucoup de clients le demandent.' },
    'co.capital': { t: 'Capital social', d: 'La somme que les associés ont apportée à la création de la société (par exemple « 1 000 DT »). Elle figure dans les mentions légales en bas des documents. Une entreprise individuelle n\'a pas de capital : laisse vide.' },
    'co.address': { t: 'Adresse', d: 'L\'adresse du siège social, celle qui est déclarée. Écris-la sur plusieurs lignes (rue, puis code postal et ville) : elle sera reproduite telle quelle sur les documents.' },
    'co.tagline': { t: 'Slogan', d: 'Une ligne courte sous ton nom qui dit ce que tu fais, par exemple « Cybersécurité · Infrastructure · Services informatiques ». Optionnel, mais utile quand un client reçoit ton devis sans te connaître.' },
    'co.logo': { t: 'Logo', d: 'Une image PNG, JPG ou SVG (1 Mo maximum) affichée en haut à gauche de tes documents. Préfère un fond transparent ou blanc. Sans logo, seul ton nom s\'affiche : c\'est propre aussi.' },
    'co.stampImage': { t: 'Cachet / signature', d: 'La photo de ton cachet d\'entreprise ou de ta signature. Elle se place dans la case « Cachet et signature » en bas des documents, ce qui t\'évite d\'imprimer, signer, scanner. Astuce : signe sur une feuille blanche, photographie-la en plein jour, recadre.' },
    'co.colors': { t: 'Couleurs', d: 'La couleur principale est celle du texte des titres, la couleur d\'accent teinte les bandeaux, les totaux et les cadres. Elles ne changent que les documents PDF, pas l\'interface. Reste sur des couleurs claires : un document trop coloré fait moins professionnel.' },
    // — apparence —
    'ap.theme': { t: 'Thème', d: 'L\'apparence de l\'application : clair, sombre, ou comme le réglage de ton Mac. Les documents PDF restent toujours clairs, quel que soit le thème.' },
    'ap.defaultLang': { t: 'Langue des documents par défaut', d: 'La langue utilisée pour les nouveaux devis et factures. Tu peux toujours la changer document par document, ou la fixer par client (utile pour un client étranger).' },
    // — paiement —
    'pay.bank': { t: 'Banque et RIB', d: 'Ton RIB (Relevé d\'Identité Bancaire) s\'affiche sur les factures, dans le bloc « Règlement ». C\'est ce que ton client copie pour faire le virement : vérifie-le deux fois, une erreur ici, c\'est un paiement qui n\'arrive jamais.' },
    'pay.terms': { t: 'Conditions de paiement', d: 'La phrase imprimée sur chaque facture pour dire comment et quand te payer. Exemple : « Paiement par virement bancaire à réception de la facture. » Être explicite réduit les retards.' },
    // — documents —
    'doc.stampFee': { t: 'Timbre fiscal', d: 'Une taxe fixe que l\'État tunisien ajoute à chaque facture, indépendamment du montant (1 DT au moment où ces lignes sont écrites). Elle s\'ajoute après la TVA. Elle ne s\'applique pas aux devis. <em>À VÉRIFIER avec ton comptable : le montant en vigueur et les cas d\'exonération.</em>' },
    'doc.quoteValidity': { t: 'Validité des devis', d: 'Le nombre de jours pendant lesquels ton prix reste garanti. Au-delà, tu es libre de refaire un devis à un autre prix. 30 jours est l\'usage. La date calculée s\'imprime sur le devis.' },
    'doc.paymentDays': { t: 'Délai de paiement', d: 'Le nombre de jours dont ton client dispose pour payer, à partir de la date de facture. Il sert à calculer l\'échéance imprimée sur la facture, et c\'est lui qui déclenche le passage en « en retard » dans l\'application.' },
    'doc.withholdingDefault': { t: 'Retenue à la source par défaut', d: 'Le taux appliqué automatiquement aux nouvelles factures. Laisse « Aucune » si la plupart de tes clients sont des particuliers, et règle le taux client par client pour les sociétés et les administrations. <em>À VÉRIFIER avec ton comptable.</em>' },
    'doc.currency': { t: 'Devise', d: 'La monnaie de ton entreprise, celle de ta comptabilité (DT pour le dinar tunisien). Les statistiques et le journal des ventes sont toujours exprimés dans cette monnaie, même quand tu factures un client en euros.' },
    'doc.openAfterExport': { t: 'Ouvrir le PDF après export', d: 'Quand c\'est coché, le PDF s\'ouvre dans l\'Aperçu dès qu\'il est enregistré, pour que tu le relises. Décoche si tu exportes beaucoup de documents à la suite.' },
    'doc.quoteTerms': { t: 'Conditions des devis', d: 'Le texte imprimé en bas de chaque devis, sous la validité. Il sert à expliquer comment le client accepte : « retournez-le daté et signé avec la mention Bon pour accord ». Un devis signé est la meilleure preuve en cas de litige.' },
    'doc.footer': { t: 'Pied de page des documents', d: 'La ligne discrète en bas de chaque page. Elle sert aux mentions légales : nom, matricule fiscal, RC et capital y sont ajoutés automatiquement.' },
    'doc.en': { t: 'Textes en anglais', d: 'Utilisés à la place des textes français quand un document est en anglais (Langue du document = English). Pense à traduire aussi tes conditions de paiement.' },
    // — emails —
    'mail.client': { t: 'Envoi des emails', d: 'Sur Mac, SkanFact peut ouvrir <b>Mail</b> avec le destinataire, l\'objet, le texte et le PDF déjà joint : tu relis et tu cliques sur Envoyer. Si tu utilises Gmail dans le navigateur ou Outlook, choisis « Autre messagerie » : le message s\'ouvre dans ta messagerie par défaut et le PDF s\'affiche dans le Finder pour que tu le glisses dedans.' },
    'mail.templates': { t: 'Modèles d\'email', d: 'Les textes préparés pour chaque situation. Les mots entre accolades sont remplacés automatiquement : <b>{numero}</b>, <b>{client}</b>, <b>{objet}</b>, <b>{montant}</b>, <b>{echeance}</b>, <b>{jours}</b>, <b>{societe}</b>, <b>{reference}</b>. Tu peux tout réécrire à ta façon : c\'est ta voix, pas la mienne.' },
    // — mises à jour / sécurité / données —
    'upd.token': { t: 'Token GitHub', d: 'SkanFact se met à jour toute seule en allant chercher les nouvelles versions sur GitHub. Comme le dépôt est privé, il faut une clé d\'accès en lecture (le « token »). Elle est enregistrée uniquement sur cet ordinateur, jamais envoyée ailleurs.' },
    'sec.password': { t: 'Mot de passe', d: 'Il chiffre le fichier de données et toutes ses sauvegardes sur le disque (AES-256). Il protège contre un ordinateur perdu ou volé : sans le mot de passe, les fichiers sont illisibles, <b>y compris pour toi</b>. Il n\'existe aucune récupération : note-le ailleurs.' },
    'data.backups': { t: 'Sauvegardes', d: 'Chaque jour, l\'état de tes données au premier enregistrement de la journée est copié dans un dossier <b>backups</b> (30 jours conservés). Pour revenir en arrière après une fausse manipulation : Importer, puis choisis le fichier du jour voulu.' },
    'data.external': { t: 'Copie externe', d: 'Le geste le plus important de ta gestion. Choisis un dossier dans iCloud Drive, sur une clé USB ou un disque réseau : à chaque enregistrement, tes données et leurs sauvegardes y sont recopiées. Si ton Mac tombe en panne demain, ta comptabilité existe ailleurs.' },
    'data.demo': { t: 'Jeu de démonstration', d: 'Remplace tes données par treize mois d\'activité fictive : clients, devis, factures, relances, contrats. Parfait pour explorer sans rien casser. Tes paramètres société sont conservés et une sauvegarde est prise avant.' },
    'data.wipe': { t: 'Tout effacer', d: 'Supprime tous les clients, prestations et documents, y compris les factures émises. Utile après avoir joué avec la démo, avant de saisir tes vraies données. Une sauvegarde est prise avant, mais réfléchis quand même à deux fois.' },
    // — éditeur de document —
    'ed.client': { t: 'Client', d: 'Clique et <b>tape les premières lettres</b> : la liste se filtre sur le nom, la personne à contacter, l\'email, le téléphone et le matricule fiscal. Les flèches puis Entrée choisissent au clavier. « + Nouveau client » crée la fiche sans quitter le document. Son adresse, son matricule fiscal, sa langue, sa devise et son taux de retenue à la source sont ensuite repris automatiquement.' },
    'ed.date': { t: 'Date du document', d: 'La date qui s\'imprime et qui compte pour ta comptabilité : une facture datée du 31 janvier appartient à janvier, même émise le 2 février. C\'est aussi elle qui détermine l\'année du numéro (FAC-2026-001).<br>Écris-la comme tu veux (12/03/2026, 12-3-26, ou même 12032026), ou clique sur l\'icône calendrier. Les flèches <b>↑</b> et <b>↓</b> avancent ou reculent d\'un jour. Une date qui n\'existe pas, comme le 31 février, est refusée.' },
    'ed.due': { t: 'Échéance', d: 'La date limite de paiement, calculée à partir de ton délai par défaut. Passé ce jour et si la facture n\'est pas soldée, elle bascule automatiquement « en retard » et apparaît dans les Relances. Dans le calendrier, les boutons <b>+7 j</b>, <b>+15 j</b> et <b>+30 j</b> repoussent l\'échéance en un clic.' },
    'ed.validUntil': { t: 'Valable jusqu\'au', d: 'La date après laquelle ton prix n\'est plus garanti. Elle s\'imprime sur le devis. C\'est un argument utile : un client hésitant se décide plus vite quand une date est écrite. Dans le calendrier, <b>+7 j</b>, <b>+15 j</b> et <b>+30 j</b> allongent la validité en un clic.' },
    'ed.subject': { t: 'Objet', d: 'Une phrase qui résume la prestation, par exemple « Audit de sécurité du réseau ». Elle s\'affiche en grand sur le document et sert à retrouver le document plus tard dans la recherche.' },
    'ed.reference': { t: 'Référence', d: 'Le numéro de commande ou de marché que ton client t\'a donné (« BC 118 »). Beaucoup de sociétés et d\'administrations refusent de payer une facture qui ne rappelle pas leur référence.' },
    'ed.lang': { t: 'Langue du document', d: 'Français ou anglais. Tout le document change : titres, colonnes, conditions, et même le montant écrit en toutes lettres.' },
    'ed.docCurrency': { t: 'Devise du document', d: 'La monnaie dans laquelle tu factures ce client. Pour une devise étrangère, indique le taux de change : ta comptabilité reste tenue en dinars, convertie à ce taux.' },
    'ed.rate': { t: 'Taux de change', d: 'Combien vaut <b>une unité</b> de la devise étrangère en dinars le jour de la facture (par exemple 1 EUR = 3,4 DT). Le taux s\'imprime sur le document et sert à convertir le montant dans ton journal des ventes.' },
    'ed.statusQuote': { t: 'Statut du devis', d: '<b>Brouillon</b> : en préparation. <b>Envoyé</b> : chez le client, en attente de réponse. <b>Accepté</b> : il a dit oui (passe tout seul à accepté quand tu convertis en facture). <b>Refusé</b> : c\'est non, et c\'est une information utile pour ton taux de conversion.' },
    'ed.statusInvoice': { t: 'Statut de la facture', d: 'Tu ne le saisis jamais : il se déduit de la réalité. Tant qu\'aucun paiement n\'est enregistré, la facture est « envoyée », puis « en retard » après l\'échéance ; un paiement partiel la rend « partiellement payée », le solde la rend « payée ». Un avoir total la rend « annulée ».' },
    'ed.draftNumber': { t: 'Numéro attribué à l\'émission', d: 'Un brouillon de facture n\'a pas de numéro. Le numéro définitif n\'est donné qu\'au clic sur « Émettre ». C\'est ce qui garantit une numérotation continue, sans trou : tu peux préparer et jeter autant de brouillons que tu veux.' },
    'ed.discount': { t: 'Remise globale', d: 'Un pourcentage retiré du total HT, avant la TVA. Elle s\'affiche en clair sur le document, ce que les clients apprécient. Pour une remise sur une seule ligne, baisse plutôt son prix unitaire.' },
    'ed.withholding': { t: 'Retenue à la source', d: 'Une partie du montant que ton client garde et verse directement au fisc à ta place. Tu ne reçois donc que le « net à payer ». Ce n\'est pas une perte : tu récupères cette somme sur ton impôt, à condition d\'avoir <b>l\'attestation de retenue</b> que ton client doit te remettre. <em>À VÉRIFIER avec ton comptable : les taux et la base de calcul.</em>' },
    'ed.applyStamp': { t: 'Timbre fiscal sur ce document', d: 'Coché par défaut sur les factures. Décoche si ce document n\'y est pas soumis. Les avoirs n\'en portent pas, sauf si tu coches la case. <em>À VÉRIFIER avec ton comptable.</em>' },
    'ed.unit': { t: 'Unité', d: 'Ce que tu comptes dans la colonne Qté : des heures, des jours, des mois, des unités, un forfait… Elle s\'imprime à côté de la quantité sur le document (« 3 j », « 12 mois ») et rend le prix compréhensible. Si ton métier a une unité que la liste ne propose pas, choisis <b>Autre…</b> et écris-la : elle restera proposée ensuite. Laisse sur « — » si l\'unité n\'apporte rien.' },
    // — fiche d'un contrat récurrent —
    'contrat.fiche': { t: 'Fiche du contrat', d: 'Tout ce que fait ce contrat : ce qu\'il facturera à la prochaine échéance, ce qu\'il a déjà facturé, et la liste des factures qu\'il a produites. Un contrat ne s\'envoie pas au client : c\'est une règle interne qui fabrique des brouillons de facture à date fixe. Ce sont ces factures que ton client reçoit.' },
    'contrat.apercu': { t: 'Aperçu de la prochaine facture', d: 'Exactement ce que ton client recevra à la prochaine échéance, mois résolu compris. Si quelque chose ne va pas ici, clique sur « Modifier » : la facture n\'est pas encore créée, rien n\'est figé.' },
    'contrat.montant': { t: 'Montant par facture', d: 'Ce que le contrat facture à chaque échéance, hors taxes puis toutes taxes comprises. Multiplie-le par le nombre d\'échéances de l\'année pour connaître ce que ce client te rapporte de façon sûre.' },
    'contrat.next': { t: 'Prochaine facture', d: 'La date de la prochaine échéance. Quand elle est atteinte, SkanFact prépare un <b>brouillon</b> de facture et te le signale sur l\'accueil : rien n\'est émis dans ton dos, tu relis puis tu émets.' },
    'contrat.total': { t: 'Facturé depuis le début', d: 'La somme hors taxes de toutes les factures émises par ce contrat, avoirs déduits. Les brouillons pas encore émis n\'y sont pas comptés : tant qu\'une facture n\'est pas émise, elle n\'existe pas comptablement.' },
    'contrat.lignes': { t: 'Les lignes du contrat', d: 'Elles sont recopiées telles quelles dans chaque facture générée. <b>{mois}</b> écrit dedans est remplacé par le mois facturé, et <b>{annee}</b> par l\'année : « Maintenance — {mois} » devient « Maintenance — octobre 2026 ».' },
    'contrat.factures': { t: 'Factures générées', d: 'Toutes les factures nées de ce contrat, brouillons compris. Clique sur une ligne pour l\'ouvrir. Depuis une de ces factures, un lien ramène ici.' },
    'ed.lines': { t: 'Les lignes du document', d: 'Une ligne par prestation. La <b>désignation</b> est le titre, la <b>description</b> le détail (facultative, elle rassure le client). <b>Qté</b> multiplie le prix unitaire : 3 heures, 12 mois, 1 forfait. Prends les prestations que tu factures souvent depuis le catalogue, tu gagneras du temps.' },
    'ed.vat': { t: 'TVA', d: 'La taxe que tu collectes pour l\'État et que tu lui reverses. Les taux tunisiens sont 0, 7, 13 et 19 %. Le taux dépend de la nature de la prestation, pas de ton choix. <em>À VÉRIFIER avec ton comptable : le taux qui s\'applique à chacun de tes services.</em>' },
    'ed.notes': { t: 'Notes', d: 'Un texte libre imprimé sur le document : délai d\'intervention, matériel non inclus, conditions particulières. Enregistre les phrases que tu réutilises en « textes prédéfinis » (page Catalogue) pour les insérer en un clic.' },
    'ed.preview': { t: 'Aperçu', d: 'Exactement ce que ton client recevra. Il se met à jour pendant que tu tapes. Le compteur indique si le document tient sur une page : au-delà, les marges se resserrent automatiquement.' },
    'ed.issue': { t: 'Émettre', d: 'Le moment où le document devient officiel : il reçoit son numéro définitif et n\'est plus modifiable. C\'est une règle comptable, pas un caprice du logiciel : une facture émise ne se corrige que par un <b>avoir</b>.' },
    'ed.locked': { t: 'Document verrouillé', d: 'Cette facture est émise : son numéro est définitif et son contenu ne bouge plus. Pour corriger une erreur, crée un avoir (total ou partiel). Tant qu\'aucun paiement ni avoir n\'existe, un déverrouillage de secours reste possible dans le menu « Plus ».' },
    'ed.payments': { t: 'Paiements', d: 'Enregistre chaque encaissement avec sa date, son montant et son mode. Plusieurs paiements partiels sont possibles. C\'est ce qui fait vivre ton « reste à encaisser », tes relances et ton délai moyen de paiement.' },
    'ed.credit': { t: 'Avoir', d: 'Le document qui annule tout ou partie d\'une facture déjà émise : erreur de montant, prestation non rendue, geste commercial. Il porte son propre numéro (AVO-…) et se déduit de ton chiffre d\'affaires.' },
    'ed.deposit': { t: 'Facture d\'acompte', d: 'Une facture d\'un pourcentage du devis, émise avant de commencer le travail. Elle sécurise ta trésorerie sur les gros chantiers. La facture de solde déduira automatiquement ce qui a déjà été facturé.' },
    'ed.settle': { t: 'Facture de solde', d: 'La facture finale d\'un projet : elle reprend toutes les lignes du devis et retranche les acomptes déjà facturés. Ton client voit le détail complet et ne paie que ce qui reste.' },
    'ed.convert': { t: 'Convertir en facture', d: 'Crée un brouillon de facture reprenant le devis à l\'identique, et marque le devis « accepté ». Rien n\'est définitif tant que tu n\'as pas cliqué sur « Émettre ».' },
    'ed.template': { t: 'Modèles de documents', d: 'Une prestation type que tu vends souvent, enregistrée avec ses lignes, son objet et ses notes. Un nouveau devis identique se crée alors en deux clics.' },
    'ed.recurring': { t: 'Rendre récurrent', d: 'Transforme cette facture en contrat : SkanFact te proposera automatiquement la même facture chaque mois, trimestre ou année.' },
    // — listes et pages —
    'list.filters': { t: 'Filtres', d: 'La recherche porte sur le numéro, le nom du client et l\'objet. Combine-la avec le statut pour retrouver, par exemple, toutes les factures en retard d\'un client. Dès qu\'un filtre est actif, le nombre de lignes retenues s\'affiche à droite avec un bouton « Réinitialiser les filtres ». Sur une grande liste, l\'année en cours est présélectionnée : c\'est indiqué à côté des filtres, et le bouton Réinitialiser te rend l\'historique complet.' },
    'dash.caMonth': { t: 'CA du mois', d: 'Chiffre d\'affaires <b>hors taxes</b> facturé depuis le 1er du mois, avoirs déduits. C\'est ce que tu as vendu, pas ce que tu as encaissé : une facture compte ici dès son émission, même impayée.' },
    'dash.caYear': { t: 'CA de l\'année', d: 'Le total hors taxes facturé depuis le 1er janvier. C\'est le chiffre que ton comptable te demandera et qui sert de base à tes déclarations.' },
    'dash.open': { t: 'Reste à encaisser', d: 'L\'argent facturé qui n\'est pas encore arrivé sur ton compte. Quand ce nombre grossit alors que ton chiffre d\'affaires est bon, c\'est un signal : tu vends bien, mais tu es payé mal. Va voir les Relances.' },
    'dash.quotes': { t: 'Devis en attente', d: 'Le montant des devis envoyés dont le client n\'a pas encore décidé. C\'est ta réserve de travail potentiel. Un devis sans réponse depuis deux semaines mérite un appel.' },
    'dash.chart': { t: 'Activité des 12 derniers mois', d: 'En vert, ce que tu as facturé chaque mois (hors taxes, avoirs déduits). En bleu, ce que tu as réellement encaissé. L\'écart entre les deux courbes, c\'est ton décalage de trésorerie.' },
    'dash.conversion': { t: 'Devis → facture', d: 'Sur cent devis tranchés, combien ont été acceptés. En dessous de 30 %, tes prix ou ta cible posent question. Au-dessus de 80 %, tu es peut-être trop bon marché.' },
    'dash.delay': { t: 'Délai moyen de paiement', d: 'Le nombre de jours écoulés en moyenne entre la date de tes factures et leur paiement complet. Compare-le à ton délai annoncé : s\'il est deux fois plus long, tes conditions ne sont pas respectées.' },
    'dash.top': { t: 'Top clients', d: 'Tes plus gros clients de l\'année. Si le premier pèse plus de la moitié de ton chiffre d\'affaires, ton entreprise est fragile : sa perte te mettrait en difficulté. Cherche à diversifier.' },
    'rel.levels': { t: 'Niveaux de relance', d: 'SkanFact choisit le ton selon le retard : <b>rappel</b> courtois jusqu\'à 15 jours (« sauf erreur de notre part »), <b>relance</b> ferme jusqu\'à 45 jours, <b>dernière relance</b> au-delà, qui annonce le recouvrement. Les trois textes sont modifiables.' },
    'rel.soon': { t: 'Échéances proches', d: 'Les factures qui arrivent à échéance dans les sept jours. Un message amical avant l\'échéance évite souvent la relance après.' },
    'contrat.form': { t: 'Contrat récurrent', d: 'Décris une fois la facture qui revient (client, lignes, période, jour du mois) et SkanFact te la proposera à chaque échéance. Elle arrive en <b>brouillon</b> : tu la relis, tu ajustes si besoin, tu émets. Rien n\'est envoyé sans toi.' },
    'compta.vat': { t: 'TVA par taux', d: 'La base hors taxes et la TVA collectée, ventilées par taux, pour la période choisie. C\'est ce tableau que ton comptable utilise pour ta déclaration mensuelle. <em>À VÉRIFIER avec lui avant tout dépôt.</em>' },
    'compta.journal': { t: 'Journal des ventes', d: 'La liste chronologique de toutes tes factures et avoirs émis sur la période. C\'est le document de base de ta comptabilité : exporte-le en CSV pour ton comptable, avec les PDF de la période si besoin.' },
    'compta.payments': { t: 'Encaissements', d: 'Les paiements reçus pendant la période, quelle que soit la date des factures concernées. À rapprocher de ton relevé bancaire pour vérifier que rien ne manque.' },
    'compta.rs': { t: 'Attestations de retenue à la source', d: 'Chaque client qui te retient une somme doit te remettre une attestation. Sans elle, tu ne peux pas déduire cette somme de ton impôt : c\'est de l\'argent perdu. Réclame-les, et coche ici quand elles arrivent.' },
    'cat.catalog': { t: 'Catalogue de prestations', d: 'Tes services avec leur prix et leur TVA, prêts à insérer dans un devis. Y mettre tes prestations habituelles t\'évite de retaper les descriptions et t\'empêche de te tromper de prix.' },
    'todo': { t: 'À faire', d: 'Ce que SkanFact a repéré et qui demande une action de ta part : factures en retard, fiche société incomplète, contrats à générer, devis acceptés pas encore facturés, devis expirés ou sans réponse, attestations de retenue à réclamer, échéances de la semaine, brouillons oubliés. Si cette liste est vide, ta gestion est à jour. Clique sur le titre « À faire » pour replier le panneau : il reste alors une ligne de résumé, et ton choix est conservé au prochain démarrage.' },
    'ed.history': { t: 'Historique', d: 'Tout ce qui est arrivé à ce document : création, émission, envois par email, relances (email et téléphone), paiements reçus, avoirs. Sur un devis, les factures qui en sont tirées ; sur une facture, le devis d\'origine — chaque ligne est cliquable. Rien à saisir : c\'est reconstitué à partir de ce que tu as déjà enregistré.' },
    'rel.snooze': { t: 'Relances reportées', d: 'Quand un client t\'annonce une date de paiement, reporte la relance : la facture descend en bas de la liste jusqu\'à cette date. Elle reste comptée dans ton « reste à encaisser » — on ne cache jamais un impayé.' },
    'rel.quotes': { t: 'Devis sans réponse', d: 'Les devis envoyés il y a plus de dix jours dont le client n\'a rien dit. Un rappel poli ne dérange personne et débloque souvent une décision qui traînait.' },
    'compta.comptable': { t: 'Envoyer au comptable', d: 'Prépare un email pour ton comptable avec le journal des ventes de la période en pièce jointe (CSV lisible dans Excel). Tu relis le message et tu envoies. À faire une fois par mois, après avoir pointé tes encaissements.' },
    'cl.contact': { t: 'Personne à contacter', d: 'Le nom de ton interlocuteur chez ce client, avec sa fonction si tu veux. Il apparaît sur les documents sous la raison sociale : ta facture arrive directement sur le bon bureau au lieu de traîner à l\'accueil.' },
    'cl.page': { t: 'Fiche client', d: 'Tout ce que tu sais de ce client : ce qu\'il t\'a rapporté, ce qu\'il te doit, son délai de paiement habituel, son taux d\'acceptation de devis et l\'historique de ses documents. Regarde-la avant de le rappeler ou de lui faire une remise.' },
    'cl.due': { t: 'Reste à payer', d: 'Le total des factures de ce client non soldées, avoirs et paiements partiels déduits. Un client dont ce chiffre grossit mois après mois mérite une discussion avant la prochaine commande.' },
    'list.sort': { t: 'Trier la liste', d: 'Les titres de colonne marqués « ⇅ » se cliquent pour trier, une deuxième fois pour inverser. Une flèche pleine montre la colonne qui commande le tri. Sur les listes de <b>devis</b> et de <b>factures</b>, le pied du tableau totalise toute la sélection, pas seulement la page affichée : combine avec les filtres pour obtenir, par exemple, le total facturé à un client sur une année.' },
    'list.page': { t: 'Pages', d: 'Les listes longues sont découpées en pages pour rester lisibles et rapides. « Lignes par page » garde ton choix d\'une fois sur l\'autre, sur cet ordinateur : 25, 50, 100, ou « Tout » pour tout afficher d\'un coup. Le compteur de gauche indique ce que tu vois et le total. Les totaux du tableau et les exports CSV portent toujours sur la sélection entière, jamais sur la seule page affichée.' },
    'list.year': { t: 'Année', d: 'La liste s\'ouvre sur l\'année en cours dès qu\'elle contient beaucoup de documents. Passe sur « Toutes les années » pour chercher un document ancien.' },
    'cat.snippets': { t: 'Textes prédéfinis', d: 'Les paragraphes que tu réutilises : garantie, confidentialité, modalités d\'acompte. Un clic les insère dans les notes d\'un document.' }
  };

  // ---------- articles de la rubrique Aide ----------
  // { id, title, sub, body: HTML }
  const ARTICLES = [
    {
      id: 'demarrer', title: 'Démarrer : les cinq premières minutes', sub: 'Ce qu\'il faut régler avant ton premier devis',
      body: `
<p>SkanFact fonctionne entièrement sur ton ordinateur. Rien n'est envoyé sur Internet, personne d'autre ne voit tes données. En contrepartie, <b>c'est toi qui es responsable de tes sauvegardes</b> : on y revient plus bas.</p>
<p>Au tout premier démarrage, un assistant t'a demandé ta raison sociale, ton activité et tes règles de facturation. Si tu l'as passé, ou si tu veux corriger une réponse, tout se retrouve dans <b>Paramètres</b>.</p>
<h3>1. Renseigne ton entreprise</h3>
<p>Va dans <b>Paramètres → Société</b> et remplis au minimum : raison sociale, matricule fiscal, adresse, téléphone et email. Ces informations s'impriment sur chaque document. Une facture sans matricule fiscal n'est pas conforme.</p>
<h3>2. Ajoute ton RIB</h3>
<p>Dans <b>Paramètres → Société</b>, bloc <b>Coordonnées bancaires</b>. C'est ce que ton client copiera pour te virer l'argent. Relis-le caractère par caractère.</p>
<h3>3. Choisis tes délais</h3>
<p>Dans <b>Paramètres → Documents</b> : validité des devis (30 jours est l'usage) et délai de paiement (30 jours aussi, souvent). Ces deux nombres calculent les dates imprimées sur tes documents.</p>
<h3>4. Mets en place la copie externe</h3>
<p><b>Paramètres → Sécurité et données → Choisir un dossier</b>, puis sélectionne un dossier dans iCloud Drive ou sur une clé USB. À chaque enregistrement, tout est recopié là-bas. Fais-le maintenant, pas « plus tard ».</p>
<h3>5. Explore avec la démo</h3>
<p><b>Paramètres → Sécurité et données → Charger le jeu de démonstration</b> remplit l'application de treize mois d'activité fictive. Clique partout, casse tout, ça n'a aucune importance. Quand tu es prêt pour tes vraies données : <b>Tout effacer</b>.</p>`
    },
    {
      id: 'devis', title: 'Le devis : proposer un prix', sub: 'Comment il se prépare, s\'envoie et se transforme',
      body: `
<p>Un devis est une <b>proposition de prix</b>. Il n'engage rien tant que le client ne l'a pas accepté, mais une fois accepté, il t'engage sur le prix et le contenu. Écris-le avec soin.</p>
<h3>Ce qui fait un bon devis</h3>
<ul>
  <li><b>Un objet clair</b> : « Audit de sécurité du réseau », pas « Prestation ».</li>
  <li><b>Des descriptions</b> sous chaque ligne. Le client compare des offres : celui qui explique ce qu'il fait gagne souvent, même un peu plus cher.</li>
  <li><b>Une date de validité</b>. Elle protège ton prix et pousse à la décision.</li>
  <li><b>Des conditions</b> : ce qui est inclus, ce qui ne l'est pas, le délai d'intervention. Toute ambiguïté se paiera plus tard.</li>
</ul>
<h3>Le cycle de vie</h3>
<p>Un devis est d'abord un <b>brouillon</b>. Quand tu l'envoies (bouton « Envoyer par email »), il passe <b>envoyé</b>. Ensuite il devient <b>accepté</b> ou <b>refusé</b>. Marque toujours les refus : c'est ce qui rend ton taux de conversion honnête, et ce chiffre te dit si tes prix sont justes.</p>
<h3>Quand le client dit oui</h3>
<p>Trois chemins, selon le chantier :</p>
<ul>
  <li><b>Convertir en facture</b> : le plus simple, pour une prestation courte.</li>
  <li><b>Facture d'acompte</b> puis <b>facture de solde</b> : pour un projet long ou coûteux. Tu encaisses une partie avant de commencer.</li>
  <li><b>Rendre récurrent</b> : si la prestation revient chaque mois.</li>
</ul>
<p>Demande le devis signé avec la mention « Bon pour accord ». En cas de désaccord, c'est la seule pièce qui compte.</p>`
    },
    {
      id: 'facture', title: 'La facture et la règle de la numérotation', sub: 'Pourquoi une facture émise ne se modifie plus',
      body: `
<p>La facture est un <b>document comptable</b>. Une fois émise, elle existe aux yeux de l'administration, même si tu la regrettes. D'où la règle que SkanFact applique strictement.</p>
<h3>Brouillon puis émission</h3>
<p>Tant que ta facture est un <b>brouillon</b>, elle n'a pas de numéro et tu peux tout changer, ou la supprimer. Au clic sur <b>Émettre</b>, elle reçoit son numéro définitif (FAC-2026-001, FAC-2026-002…) et se verrouille.</p>
<p>C'est pour ça que le numéro n'est pas donné plus tôt : si les brouillons étaient numérotés, en supprimer un créerait un trou dans la série. Or une numérotation <b>continue, sans trou et dans l'ordre des dates</b> est exactement ce qu'un contrôleur vérifie.</p>
<h3>Je me suis trompé, que faire ?</h3>
<ul>
  <li><b>Tu n'as encore rien envoyé</b> et aucun paiement n'est enregistré : menu « Plus ▾ » → « Modifier malgré l'émission ». À réserver aux vraies erreurs repérées tout de suite.</li>
  <li><b>Le client a la facture</b> : établis un <b>avoir</b>. C'est la seule façon propre. Voir l'article suivant.</li>
</ul>
<h3>Ce qui doit figurer sur une facture</h3>
<p>Ton nom et ton matricule fiscal, ceux du client, la date, le numéro, le détail des prestations, le montant hors taxes, la TVA par taux, le timbre fiscal, et le total à payer. SkanFact s'en occupe, mais vérifie que le matricule de ton client est bien saisi dans sa fiche. <em>À VÉRIFIER avec ton comptable : les mentions obligatoires dans ta situation.</em></p>`
    },
    {
      id: 'avoir', title: 'L\'avoir : corriger proprement', sub: 'Annuler tout ou partie d\'une facture émise',
      body: `
<p>Un <b>avoir</b> est une facture négative. Il annule tout ou partie d'une facture déjà émise et porte son propre numéro (AVO-2026-001). C'est le seul moyen conforme de corriger.</p>
<h3>Quand en faire un</h3>
<ul>
  <li>Erreur de montant, de quantité ou de taux de TVA sur une facture envoyée.</li>
  <li>Prestation finalement non réalisée, ou partiellement.</li>
  <li>Geste commercial après coup (retard d'intervention, incident).</li>
  <li>Facture établie en double.</li>
</ul>
<h3>Comment</h3>
<p>Ouvre la facture concernée, clique sur <b>Créer un avoir</b>. Les lignes sont reprises : garde tout pour une annulation totale, supprime ou ajuste pour un avoir partiel. Indique le <b>motif</b>, il s'imprime sur le document : c'est ce que ton comptable et le fisc liront.</p>
<h3>Ce que ça change</h3>
<p>L'avoir se déduit du reste à payer de la facture et de ton chiffre d'affaires. Si tu annules la totalité, la facture passe automatiquement « annulée ». Le numéro de la facture d'origine, lui, reste consommé pour toujours : c'est normal et c'est voulu.</p>
<p><em>À VÉRIFIER avec ton comptable : le traitement du timbre fiscal sur un avoir. Par défaut, SkanFact n'en met pas.</em></p>`
    },
    {
      id: 'paiements', title: 'Se faire payer', sub: 'Encaissements, retards et relances',
      body: `
<p>Facturer n'est pas être payé. La différence entre les deux, c'est ta trésorerie, et c'est ce qui tue la plupart des jeunes entreprises.</p>
<h3>Enregistre chaque encaissement</h3>
<p>Ouvre la facture, <b>Enregistrer un paiement</b> : date, montant, mode (virement, chèque, espèces, traite), référence. Plusieurs paiements partiels sont possibles. Le statut se met à jour tout seul et le « reste à encaisser » de l'accueil suit.</p>
<p>Prends l'habitude de le faire en même temps que tu consultes ton compte bancaire, une fois par semaine. Dix minutes qui t'évitent de réclamer une somme déjà reçue, la pire des maladresses.</p>
<h3>Les relances</h3>
<p>Dès qu'une facture dépasse son échéance, elle apparaît dans <b>Relances</b>, avec le nombre de jours de retard et le niveau conseillé :</p>
<ul>
  <li><b>Rappel</b> (jusqu'à 15 jours) : courtois, il suppose un oubli. C'est le cas neuf fois sur dix.</li>
  <li><b>Relance</b> (16 à 45 jours) : ferme, il demande une date de paiement.</li>
  <li><b>Dernière relance</b> (au-delà) : il annonce le recouvrement.</li>
</ul>
<p>Le bouton « Relancer par email » ouvre le message déjà rédigé, avec la facture jointe. L'historique des relances est conservé par facture.</p>
<h3>Trois habitudes qui changent tout</h3>
<ul>
  <li><b>Envoie la facture le jour même</b> de la prestation. Chaque jour de retard d'envoi est un jour de retard de paiement.</li>
  <li><b>Demande un acompte</b> sur les gros montants. Un client qui a déjà payé 30 % ne disparaît pas.</li>
  <li><b>Relance sans gêne.</b> Réclamer ce qu'on te doit n'est ni agressif ni honteux, c'est ton travail.</li>
</ul>`
    },
    {
      id: 'fiscal', title: 'TVA, timbre fiscal et retenue à la source', sub: 'Les trois choses qui surprennent quand on débute',
      body: `
<p><em>Cet article explique des mécanismes généraux. Ta situation précise dépend de ton régime et de ton activité : <b>fais valider chaque point par ton comptable</b>.</em></p>
<h3>La TVA</h3>
<p>La TVA n'est pas à toi. Tu l'ajoutes au prix, ton client te la paie, et tu la reverses à l'État. En contrepartie, tu récupères la TVA que tu as payée sur tes propres achats professionnels.</p>
<p>Les taux tunisiens sont <b>0, 7, 13 et 19 %</b>. Le taux dépend de la nature de la prestation, pas de ton choix. Si tu te trompes de taux, c'est toi qui paies la différence.</p>
<p><b>Le piège du débutant :</b> considérer la TVA encaissée comme du revenu et la dépenser. Au moment de la déclaration, l'argent n'est plus là. Mets-la de côté mentalement, voire sur un autre compte.</p>
<h3>Le timbre fiscal</h3>
<p>Une taxe fixe par facture (1 DT à ce jour), ajoutée après la TVA, quel que soit le montant. Elle ne s'applique pas aux devis. SkanFact l'ajoute automatiquement aux factures ; tu peux la décocher document par document.</p>
<h3>La retenue à la source</h3>
<p>C'est celle qui surprend le plus. Certains clients — sociétés, administrations — ne te versent pas la totalité : ils gardent un pourcentage et le reversent au fisc <b>en ton nom</b>. Sur une facture de 1 190 DT toutes taxes avec 1,5 % de retenue, tu reçois 1 173,15 DT.</p>
<p><b>Ce n'est pas une perte</b>, à une condition : ton client doit te remettre une <b>attestation de retenue à la source</b>. Elle prouve que cet argent a été versé pour toi et te permet de le déduire de ton impôt. Sans attestation, tu paies deux fois.</p>
<p>SkanFact suit ces attestations : <b>Comptabilité → Retenues à la source</b> liste celles que tu n'as pas encore reçues. Réclame-les, elles ne viennent pas toutes seules.</p>
<p>Règle le taux dans la fiche de chaque client : il s'appliquera à toutes ses factures. <em>À VÉRIFIER avec ton comptable : les taux applicables à ton activité et la base de calcul.</em></p>`
    },
    {
      id: 'acompte', title: 'Acompte et solde', sub: 'Faire financer le chantier par le chantier',
      body: `
<p>Sur un projet long, attendre la fin pour facturer, c'est avancer l'argent à ton client. Voici la méthode.</p>
<h3>Le déroulé</h3>
<ol>
  <li>Tu fais un <b>devis</b> complet, avec toutes les lignes.</li>
  <li>Le client accepte. Depuis le devis, clique sur <b>Facture d'acompte</b> et indique un pourcentage (30 % est courant).</li>
  <li>SkanFact crée une facture d'acompte, ventilée par taux de TVA. Tu l'émets, tu l'envoies, tu encaisses, tu commences le travail.</li>
  <li>À la fin, depuis le même devis, clique sur <b>Facture de solde</b>. Elle reprend toutes les lignes du devis et <b>déduit automatiquement</b> l'acompte déjà facturé.</li>
</ol>
<h3>Pourquoi c'est propre</h3>
<p>Ton client voit sur la facture finale le détail complet de la prestation et la ligne « Acompte déjà facturé » en négatif. Aucune ambiguïté sur ce qui reste dû. Et la somme des deux factures égale exactement le devis, TVA comprise.</p>
<p>Sur un très gros projet, rien n'empêche plusieurs acomptes : le solde les déduira tous.</p>`
    },
    {
      id: 'contrats', title: 'Les contrats récurrents', sub: 'La facturation qui se fait toute seule',
      body: `
<p>Si tu factures la même chose chaque mois — maintenance, hébergement, abonnement — ne la ressaisis pas. Crée un <b>contrat</b>.</p>
<h3>Mise en place</h3>
<p>Deux chemins : <b>Contrats → Nouveau contrat</b>, ou depuis une facture existante, menu « Plus ▾ » → « Rendre récurrent ». Tu décris le client, les lignes, la période (mensuelle, trimestrielle, annuelle) et le jour du mois.</p>
<p>Dans l'objet, écris <b>{mois}</b> à l'endroit où tu veux le mois facturé : « Maintenance et supervision — {mois} » deviendra « Maintenance et supervision — septembre 2026 ».</p>
<h3>Chaque échéance</h3>
<p>À la date prévue, une bannière apparaît sur l'accueil : « 1 facture récurrente à générer ». Un clic crée le <b>brouillon</b>. Tu le relis, tu ajustes si le mois a été particulier, tu émets.</p>
<p>Rien n'est jamais émis ni envoyé sans toi. C'est volontaire : une facture partie toute seule avec une erreur est plus coûteuse que trente secondes de relecture.</p>
<h3>Suspendre</h3>
<p>Un client qui arrête, ou une pause : bouton <b>Suspendre</b>. Le contrat reste, il ne propose plus rien. « Reprendre » le réactive.</p>
<p>Un dernier conseil de gestion : les contrats récurrents sont ce qu'il y a de plus précieux dans une jeune entreprise. Un revenu prévisible te permet de dire non aux mauvais clients.</p>`
    },
    {
      id: 'etranger', title: 'Facturer à l\'étranger', sub: 'Langue, devise et taux de change',
      body: `
<p>SkanFact gère les clients hors de Tunisie sans logiciel supplémentaire.</p>
<h3>Dans la fiche du client</h3>
<p>Règle <b>Langue des documents</b> sur English et <b>Devise</b> sur EUR, USD ou une autre. Tous ses nouveaux documents naîtront avec ces réglages.</p>
<h3>Sur le document</h3>
<p>Le document change entièrement de langue : Invoice, Billed to, Amount due, et le montant en toutes lettres en anglais. Pour une devise étrangère, un champ <b>taux de change</b> apparaît : indique combien vaut une unité en dinars le jour de la facture (1 EUR = 3,4 DT par exemple).</p>
<h3>Ce que fait le taux</h3>
<p>Il s'imprime sur le document et sert à convertir le montant dans ton <b>journal des ventes</b> et tes statistiques, qui restent tenus en dinars. Ta comptabilité reste donc cohérente même si tu factures en trois monnaies.</p>
<p>Les montants en devise étrangère s'affichent avec deux décimales, le dinar avec trois : c'est l'usage.</p>
<p><em>À VÉRIFIER avec ton comptable : la TVA sur une prestation exportée, le taux de change à retenir officiellement, et les obligations de rapatriement des devises.</em></p>`
    },
    {
      id: 'compta', title: 'Ta comptabilité mois par mois', sub: 'Ce que tu donnes à ton comptable',
      body: `
<p>La page <b>Comptabilité</b> rassemble ce dont ton comptable a besoin. Choisis une année et un mois en haut à droite.</p>
<h3>Les quatre chiffres du haut</h3>
<p>Chiffre d'affaires hors taxes de la période, TVA collectée, encaissements de la période, et reste à encaisser toutes périodes confondues.</p>
<p>Attention à ne pas confondre les deux premiers avec le troisième : tu déclares ce que tu as <b>facturé</b>, tu vis de ce que tu as <b>encaissé</b>.</p>
<h3>TVA par taux</h3>
<p>Le tableau de base de ta déclaration mensuelle : la base hors taxes et la TVA pour chaque taux. Les timbres fiscaux et les retenues subies sont rappelés en dessous.</p>
<h3>Journal des ventes</h3>
<p>Toutes tes factures et avoirs de la période, dans l'ordre. Deux boutons : <b>exporter en CSV</b> (s'ouvre dans Excel ou Numbers) et <b>exporter tous les PDF de la période</b> dans un dossier. C'est exactement ce qu'un comptable demande chaque mois.</p>
<h3>Ta routine</h3>
<ul>
  <li><b>Chaque semaine</b> : pointe ton relevé bancaire et enregistre les paiements reçus. Regarde les relances.</li>
  <li><b>Début de mois</b> : génère les factures des contrats, envoie-les, puis exporte le journal du mois écoulé et les PDF pour ton comptable.</li>
  <li><b>Chaque trimestre</b> : réclame les attestations de retenue à la source manquantes.</li>
  <li><b>Chaque année</b> : vérifie que la numérotation repart à 001 en janvier (c'est automatique) et archive une copie complète de tes données.</li>
</ul>`
    },
    {
      id: 'donnees', title: 'Tes données : sauvegarder et protéger', sub: 'Le sujet le plus ennuyeux et le plus important',
      body: `
<p>Tes données vivent dans un fichier unique sur ton ordinateur. Son chemin exact est affiché dans <b>Paramètres → Sécurité et données</b>.</p>
<h3>Les trois filets de sécurité</h3>
<ul>
  <li><b>La sauvegarde quotidienne</b> : chaque jour, l'état de tes données au premier enregistrement est copié dans un dossier <b>backups</b>. Trente jours sont conservés. Une fausse manipulation aujourd'hui se répare en revenant à hier.</li>
  <li><b>La copie externe</b> : le dossier que tu as choisi (iCloud Drive, clé USB, disque réseau) reçoit une copie à chaque enregistrement. C'est ce qui te sauve si l'ordinateur est perdu, volé ou noyé.</li>
  <li><b>L'export</b> : un fichier unique que tu peux ranger où tu veux. Fais-en un avant chaque grande manipulation.</li>
</ul>
<h3>Restaurer</h3>
<p>Clique sur <b>Importer</b> et choisis un fichier du dossier backups (ils sont datés). Une sauvegarde de l'état actuel est prise avant, donc même une restauration ratée se rattrape.</p>
<h3>Le mot de passe</h3>
<p><b>Paramètres → Sécurité</b> chiffre le fichier et toutes ses sauvegardes. Il sera demandé à chaque ouverture. Utile si ton ordinateur voyage.</p>
<p>Un avertissement sérieux : <b>il n'existe aucune récupération</b>. Ni moi, ni personne ne peut relire tes données sans ce mot de passe. Note-le dans un gestionnaire de mots de passe ou sur un papier rangé ailleurs que dans le sac de l'ordinateur.</p>`
    },
    {
      id: 'gestion', title: 'Bien gérer sa première entreprise', sub: 'Les réflexes qui évitent les mauvaises surprises',
      body: `
<p>Ces conseils ne sont pas du logiciel, mais ils comptent plus que n'importe quel bouton.</p>
<h3>Sépare ton argent</h3>
<p>Un compte bancaire pour l'entreprise, un autre pour toi. Verse-toi une somme régulière plutôt que de piocher. Sans cette séparation, tu ne sauras jamais si ton entreprise gagne de l'argent.</p>
<h3>Ce qui est encaissé n'est pas à toi</h3>
<p>Sur 1 190 DT encaissés, 190 DT sont de la TVA qui appartient à l'État, et une partie du reste financera ton impôt et tes charges. Le réflexe qui sauve : mettre de côté environ un tiers de chaque encaissement, et n'y toucher que pour les déclarations. <em>Le pourcentage exact dépend de ton régime : demande-le à ton comptable.</em></p>
<h3>Écris tout</h3>
<p>Un devis pour chaque accord, même avec un ami, même pour 200 DT. Les litiges ne viennent presque jamais de la mauvaise foi, mais de deux souvenirs différents de la même conversation.</p>
<h3>Regarde trois chiffres chaque mois</h3>
<ul>
  <li>Ton <b>chiffre d'affaires facturé</b> : est-ce que je vends assez ?</li>
  <li>Ton <b>reste à encaisser</b> : est-ce que je suis payé ?</li>
  <li>Ton <b>délai moyen de paiement</b> : est-ce que mes conditions sont respectées ?</li>
</ul>
<p>Les trois sont sur l'accueil. Un chiffre d'affaires qui monte avec un reste à encaisser qui monte plus vite, c'est une entreprise qui va dans le mur en croyant réussir.</p>
<h3>Surveille ta dépendance</h3>
<p>Si un seul client fait plus de la moitié de ton chiffre d'affaires, sa perte te met en danger. Le tableau « Top clients » sur l'accueil te le montre. Cherche à diversifier avant d'y être contraint.</p>
<h3>Garde un comptable</h3>
<p>SkanFact prépare, organise et exporte. Il ne remplace pas un professionnel qui connaît ta situation et la réglementation en vigueur. Les mentions « À VÉRIFIER » de cette aide sont là pour ça.</p>`
    },
    {
      id: 'partager', title: 'Installer SkanFact pour quelqu\'un d\'autre', sub: 'Chaque entreprise, son ordinateur, ses données',
      body: `
<p>SkanFact n'est pas réservé à une entreprise en particulier. Au premier démarrage, il demande la raison sociale, le matricule fiscal, l'activité et les règles de facturation, puis il se comporte comme le logiciel de <b>cette</b> entreprise-là.</p>
<h3>Comment ça marche</h3>
<ul>
  <li><b>Un ordinateur, une entreprise.</b> Les données vivent dans un fichier local ; deux personnes sur deux machines ne se voient pas et ne se gênent pas.</li>
  <li><b>Aucune donnée partagée.</b> Rien ne transite par Internet. Ce que fait l'un reste chez l'un.</li>
  <li><b>Numérotation indépendante.</b> Chaque installation a ses propres séries DEV, FAC et AVO, qui repartent à 001 chaque janvier.</li>
</ul>
<h3>Pour installer chez un proche</h3>
<ol>
  <li>Télécharge le fichier d'installation depuis la page des versions (menu <b>Aide → Toutes les versions</b>) : le <code>.dmg</code> pour un Mac, le <code>.exe</code> pour Windows.</li>
  <li>Sur Mac, ouvre le <code>.dmg</code> et glisse SkanFact dans Applications. À la première ouverture, macOS demande confirmation parce que l'application n'est pas signée par Apple : clic droit sur l'icône puis <b>Ouvrir</b>.</li>
  <li>Au premier lancement, l'assistant se déroule : raison sociale, matricule, activité, règles de facturation, RIB, dossier de sauvegarde.</li>
  <li>Pour que les mises à jour automatiques fonctionnent, il faut coller un <b>token d'accès</b> dans Paramètres → Mises à jour (le dépôt est privé). Sans token, l'application marche parfaitement, mais il faudra réinstaller à la main pour changer de version.</li>
</ol>
<h3>Ce qu'il faut leur dire</h3>
<p>Trois choses suffisent pour bien démarrer :</p>
<ul>
  <li>Mettre en place la <b>copie externe</b> tout de suite (iCloud Drive ou clé USB).</li>
  <li>Une facture, une fois émise, ne se modifie plus : on corrige par un <b>avoir</b>.</li>
  <li>Les petits <b>i</b> à côté des champs expliquent tout, et cette rubrique Aide répond au reste.</li>
</ul>
<p class="small muted">Chaque activité a ses taux de TVA et ses obligations. Ce que dit cette aide vaut pour le cas général : c'est le comptable de chacun qui tranche pour son entreprise.</p>`
    },
    {
      id: 'vocabulaire', title: 'Le vocabulaire', sub: 'Les mots qu\'on emploie sans les expliquer',
      body: `
<dl class="gloss">
  <dt>HT (hors taxes)</dt><dd>Le prix avant la TVA. C'est ce qui constitue ton chiffre d'affaires et ton revenu réel.</dd>
  <dt>TTC (toutes taxes comprises)</dt><dd>Le prix TVA et timbre inclus. C'est ce que le client paie.</dd>
  <dt>TVA</dt><dd>Taxe que tu collectes pour l'État et que tu lui reverses. Elle transite par toi, elle ne t'appartient pas.</dd>
  <dt>Timbre fiscal</dt><dd>Taxe fixe par facture (1 DT à ce jour), ajoutée après la TVA.</dd>
  <dt>Retenue à la source</dt><dd>Part du montant que ton client verse au fisc à ta place. Tu la récupères sur ton impôt, avec l'attestation.</dd>
  <dt>Net à payer</dt><dd>Ce que le client te verse réellement : TTC moins la retenue à la source.</dd>
  <dt>Échéance</dt><dd>Date limite de paiement. Au-delà, la facture est en retard.</dd>
  <dt>Avoir</dt><dd>Facture négative qui annule tout ou partie d'une facture émise.</dd>
  <dt>Acompte</dt><dd>Partie du prix facturée et encaissée avant la prestation.</dd>
  <dt>Solde</dt><dd>Ce qui reste à facturer après les acomptes.</dd>
  <dt>Brouillon</dt><dd>Document en préparation, sans numéro, modifiable et supprimable.</dd>
  <dt>Émettre</dt><dd>Rendre un document officiel : numéro définitif, plus de modification possible.</dd>
  <dt>Journal des ventes</dt><dd>Liste chronologique de toutes tes factures et avoirs sur une période.</dd>
  <dt>Trésorerie</dt><dd>L'argent réellement disponible sur ton compte. Différent du chiffre d'affaires.</dd>
  <dt>Matricule fiscal</dt><dd>Ton identifiant fiscal, obligatoire sur les factures.</dd>
  <dt>RC</dt><dd>Registre de commerce : le numéro d'immatriculation de ton entreprise.</dd>
</dl>`
    },
    {
      id: 'raccourcis', title: 'Raccourcis clavier', sub: 'Aller plus vite au clavier',
      body: `
<table class="keys">
  <tr><th>Rechercher partout</th><td><kbd>⌘</kbd> <kbd>K</kbd></td></tr>
  <tr><th>Nouveau devis</th><td><kbd>⌘</kbd> <kbd>N</kbd></td></tr>
  <tr><th>Nouvelle facture</th><td><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>N</kbd></td></tr>
  <tr><th>Enregistrer</th><td><kbd>⌘</kbd> <kbd>S</kbd></td></tr>
  <tr><th>Exporter en PDF</th><td><kbd>⌘</kbd> <kbd>P</kbd></td></tr>
  <tr><th>Accueil, Devis, Factures, Clients, Catalogue</th><td><kbd>⌘</kbd> <kbd>1</kbd> à <kbd>5</kbd></td></tr>
  <tr><th>Comptabilité</th><td><kbd>⌘</kbd> <kbd>6</kbd></td></tr>
  <tr><th>Verrouiller l'application</th><td><kbd>⌘</kbd> <kbd>L</kbd></td></tr>
  <tr><th>Valider une fenêtre</th><td><kbd>Entrée</kbd></td></tr>
  <tr><th>Fermer une fenêtre</th><td><kbd>Échap</kbd></td></tr>
</table>
<p class="small muted">Sur Windows, remplace <kbd>⌘</kbd> par <kbd>Ctrl</kbd>.</p>`
    }
  ];

  return { INFO, ARTICLES };
});
