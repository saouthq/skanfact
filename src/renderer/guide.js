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
    'ed.statusExtra': { t: 'Statut', d: 'Ces pièces n\'ont pas de valeur comptable : tu choisis librement leur statut et tu peux les modifier après coup, contrairement à une facture émise. Le numéro, lui, est attribué au premier enregistrement et ne change plus.' },
    'ed.stampProforma': { t: 'Timbre sur une proforma', d: 'Par défaut, pas de timbre : une proforma n\'est pas une facture et ne déclenche pas le droit de timbre. Coche si tu veux que le montant annoncé soit exactement celui de la future facture, timbre compris. <em>À VÉRIFIER avec ton comptable.</em>' },
    'ed.hidePrices': { t: 'Masquer les prix', d: 'Un bon de livraison accompagne la marchandise : il sert à vérifier ce qui est livré, pas à annoncer un prix. Le livreur, le magasinier ou le transporteur n\'ont pas à connaître tes tarifs. Décoche seulement si ton client demande un bon valorisé.' },
    'ed.clauses': { t: 'Clauses du contrat', d: 'Les articles qui s\'impriment sur le contrat, numérotés dans l\'ordre. Vide un champ pour retirer la clause correspondante. Les textes proposés sont des formulations courantes en prestation de services : <em>fais-les relire par un juriste ou ton comptable</em> avant ta première signature — ce n\'est pas un conseil juridique.' },
    'ed.attachments': { t: 'Pièces jointes', d: 'Tout ce qui justifie ce document : le devis signé scanné, le bon de commande du client, un contrat rendu signé, une photo du chantier. Les fichiers sont <b>copiés</b> à côté de tes données — si tu déplaces ou supprimes l\'original, la pièce reste attachée. Elles ne sont pas dans les sauvegardes quotidiennes (qui ne contiennent qu\'un fichier texte) mais bien dans la copie externe : une raison de plus de la configurer.' },
    'autres.proforma': { t: 'Facture proforma', d: 'Un document qui annonce un prix ferme <b>sans être une facture</b> : pas de numéro de facture, pas de TVA déclarée, aucune écriture comptable. Les administrations, les banques et les dossiers de financement la réclament souvent avant d\'engager la dépense. Quand la commande est confirmée, tu la transformes en vraie facture en un clic.' },
    'autres.commande': { t: 'Bon de commande', d: 'La pièce qui enregistre ce que le client a commandé, avant que tu livres ou que tu factures. Elle protège les deux parties : elle fixe par écrit ce qui a été demandé, en quelle quantité et à quel prix. Fais-la signer quand le montant est important.' },
    'autres.livraison': { t: 'Bon de livraison', d: 'La pièce qui accompagne la marchandise et se fait signer à la réception. C\'est ta preuve d\'avoir livré : sans elle, un client de mauvaise foi peut contester. Par défaut les prix y sont masqués. À partir de la version 4.0, c\'est ce bon qui sortira les articles du stock.' },
    'autres.contrat': { t: 'Contrat de prestation', d: 'Le vrai document que ton client signe : objet, durée, reconduction, préavis, conditions de paiement, confidentialité, litiges. À ne pas confondre avec les <b>contrats récurrents</b> de la barre latérale, qui ne font que fabriquer des brouillons de facture chaque mois. Les deux vont ensemble : on signe le contrat, puis on crée le contrat récurrent qui le facture.' },
    'tre.accounts': { t: 'Comptes de trésorerie', d: 'Ton compte bancaire, ta caisse espèces, et autant d\'autres que nécessaire. Chacun a son solde de départ et son solde courant. C\'est la seule chose que tu saisis : tout le reste — encaissements clients, règlements fournisseurs — remonte automatiquement de ce que tu as déjà enregistré.' },
    'tre.kind': { t: 'Type de compte', d: '<b>Compte bancaire</b> pour un compte courant, <b>Caisse</b> pour l\'argent liquide que tu gardes au bureau. La distinction sert à la lecture : une caisse ne se rapproche pas d\'un relevé.' },
    'tre.opening': { t: 'Solde de départ', d: 'Le solde du compte le jour où tu commences à le suivre dans SkanFact — recopie-le de ton relevé. Tout ce que tu saisis après s\'y ajoute. Si tu te trompes, tout le reste sera décalé du même montant : c\'est le seul chiffre à vérifier deux fois.' },
    'tre.openingDate': { t: 'Date du solde de départ', d: 'Le jour auquel correspond ce solde. Les mouvements antérieurs à cette date ne sont pas comptés : ils sont déjà dedans.' },
    'tre.default': { t: 'Compte par défaut', d: 'Le compte sur lequel tombent les paiements pour lesquels tu n\'as rien précisé. Il en faut toujours un : si tu décoches celui-ci, un autre le devient.' },
    'tre.total': { t: 'Disponible aujourd\'hui', d: 'La somme des soldes de tous tes comptes, calculée à partir de leur solde de départ et de tous les mouvements enregistrés depuis. C\'est ce que tu as <b>vraiment</b>, pas ce qu\'on te doit.' },
    'tre.projected': { t: 'Solde projeté', d: 'Ce qu\'il restera dans 30 jours si toutes les échéances connues tombent à leur date : les factures clients ouvertes rentrent, les achats à régler sortent. Aucune estimation, aucune moyenne — uniquement ce qui est déjà engagé.' },
    'tre.shortfall': { t: 'Trou de trésorerie', d: 'La date à laquelle ton solde passerait sous zéro si rien ne bouge. C\'est <b>l\'alerte la plus importante de l\'application</b> : une entreprise rentable peut mourir d\'un trou de trésorerie. Un trou anticipé se négocie avec la banque ou avec un fournisseur ; un trou constaté se subit.' },
    'tre.forecast': { t: 'Horizon de prévision', d: '30 jours pour le pilotage au quotidien, 90 jours pour voir venir. Au-delà, il y a trop d\'inconnu pour que le chiffre veuille dire quelque chose.' },
    'tre.curve': { t: 'Courbe du solde', d: 'Chaque point est une échéance : facture qui rentre, achat qui sort, facture de contrat récurrent. La ligne pointillée rouge est le zéro. Si la courbe passe dessous, la date du creux est signalée en haut de la page.' },
    'tre.events': { t: 'Le détail des échéances', d: 'Toutes les échéances de la période, dans l\'ordre, avec le solde après chacune. Clique une ligne pour ouvrir la pièce. Les factures et achats <b>déjà échus</b> sont ramenés à aujourd\'hui : se dire qu\'ils rentreront « à leur date » quand cette date est passée, c\'est se mentir.' },
    'tre.moves': { t: 'Mouvements', d: 'Tout ce qui est entré et sorti de tes comptes cette année, quelle que soit l\'origine. Les encaissements viennent des factures, les règlements des achats : ils se modifient là-bas. Seuls les <b>mouvements libres</b> (salaires, impôts, apports, frais bancaires) se saisissent et se modifient ici.' },
    'tre.moveKind': { t: 'Nature du mouvement', d: 'Elle donne le sens : les natures marquées ↓ sortent de ton compte, celles marquées ↑ y entrent. Tu saisis toujours un montant positif, SkanFact applique le signe — impossible de se tromper.' },
    'tre.reco': { t: 'Rapprochement bancaire', d: 'Comparer ce que dit ta banque avec ce que dit SkanFact. Tu coches les mouvements que tu retrouves sur ton relevé ; ce qui reste décoché est soit en cours de traitement, soit oublié, soit une erreur de saisie. À faire une fois par mois, c\'est ce qui garantit que tes chiffres sont vrais.' },
    'tre.gap': { t: 'Écart avec le relevé', d: 'Le solde pointé (départ + mouvements cochés) doit tomber exactement sur le solde de ton relevé. S\'il y a un écart, c\'est qu\'une opération manque d\'un côté ou de l\'autre : un prélèvement non saisi, un chèque compté deux fois, un montant mal recopié.' },
    'tre.pending': { t: 'Pas encore pointés', d: 'Les mouvements que SkanFact connaît et que tu n\'as pas encore retrouvés sur ton relevé. Un chèque mis à l\'encaissement met quelques jours : c\'est normal qu\'il reste ici. Un mouvement qui traîne depuis des semaines, en revanche, mérite un coup d\'œil.' },
    'mg.projects': { t: 'Affaires', d: 'Une affaire, c\'est un chantier, un projet, un client suivi dans le temps : tu y rattaches les devis, les factures <b>et</b> les achats qui le concernent. C\'est le seul endroit de l\'application où la marge est <b>exacte</b>, parce qu\'elle compare ce que tu as réellement facturé à ce que tu as réellement payé. Ailleurs, le coût est estimé à partir du catalogue.' },
    'mg.analysis': { t: 'Où est la marge', d: 'La même année de ventes, vue par client ou par prestation. On y découvre souvent que le plus gros client n\'est pas le plus rentable, et qu\'une prestation qu\'on croyait secondaire rapporte plus que le reste. Le coût vient du <b>coût de revient</b> saisi au catalogue : sans lui, la marge affichée est celle du prix de vente, donc fausse.' },
    'mg.total': { t: 'Marge totale', d: 'Ce qui reste du chiffre d\'affaires une fois retiré le coût de ce que tu as vendu. Ce n\'est <b>pas</b> ton bénéfice : il faut encore payer le loyer, les abonnements, les salaires et l\'impôt. Le bénéfice se lit sur l\'onglet « Seuil de rentabilité » et, en fin d\'année, dans le bilan de ton comptable.' },
    'mg.contracts': { t: 'Rentabilité des contrats', d: 'Ce que chaque contrat récurrent a rapporté depuis sa première facture, et ce qu\'il rapporte en moyenne par mois. Un petit contrat qui tourne depuis deux ans vaut souvent mieux qu\'une grosse affaire ponctuelle : il est prévisible et ne demande pas de vendre à nouveau.' },
    'mg.breakeven': { t: 'Seuil de rentabilité', d: 'Le chiffre d\'affaires minimum qu\'il te faut pour couvrir tes charges fixes — le point à partir duquel tu commences à gagner de l\'argent. En dessous, tu travailles à perte même si chaque vente est rentable prise isolément. <em>À VÉRIFIER avec ton comptable : le classement fixe/variable de tes charges.</em>' },
    'mg.variable': { t: 'Charges variables', d: 'Celles qui suivent les ventes : marchandises, sous-traitance, matériel acheté pour un chantier précis. Si tu ne vends rien, elles n\'existent pas. Les achats classés « stock » ou « immobilisation » n\'en font pas partie : ce ne sont pas des charges de la période.' },
    'mg.fixed': { t: 'Charges fixes', d: 'Celles qui tombent que tu vendes ou non : loyer, assurance, abonnements, salaires, remboursement d\'emprunt. Ce sont elles qu\'il faut couvrir avant de gagner quoi que ce soit. Tu choisis toi-même, juste en dessous, quelles catégories sont fixes.' },
    'mg.classify': { t: 'Classer tes charges', d: 'Coche les catégories de dépense qui tombent quoi qu\'il arrive. Le classement change le seuil de rentabilité, pas tes chiffres comptables : rien n\'est modifié dans tes achats. Il dépend de ton activité — <em>à faire valider par ton comptable.</em>' },
    'mg.projectRevenue': { t: 'Vendu sur l\'affaire', d: 'Le total hors taxes des factures émises pour cette affaire, avoirs déduits. Les devis en attente sont comptés à part : tant qu\'ils ne sont pas acceptés et facturés, ce n\'est pas de l\'argent.' },
    'mg.projectMargin': { t: 'Marge de l\'affaire', d: 'Vendu moins acheté, sur les pièces réellement rattachées à cette affaire. C\'est le chiffre le plus fiable de l\'application, à une condition : que tu aies bien rattaché tous les achats. Un achat oublié fait croire que l\'affaire rapporte plus qu\'en vrai.' },
    'mg.projectCash': { t: 'En caisse sur l\'affaire', d: 'Ce que l\'affaire a vraiment rapporté à ce jour : encaissé moins payé. Une affaire peut être très rentable et n\'avoir encore rien rapporté, parce que le client n\'a pas payé alors que les fournisseurs, eux, sont réglés. C\'est exactement comme ça qu\'on se retrouve à court d\'argent en gagnant de l\'argent.' },
    'ed.project': { t: 'Affaire', d: 'Rattache ce document à un chantier ou à un projet, pour comparer plus tard ce qu\'il a rapporté à ce qu\'il a coûté. Facultatif : une vente simple n\'a pas besoin d\'affaire. Utile dès qu\'il y a des achats en face.' },
    'ed.margin': { t: 'Marge estimée', d: 'Ce qu\'il resterait de ce document une fois retiré le <b>coût de revient</b> de chaque ligne (celui du catalogue, ou celui recopié sur la ligne). C\'est une estimation : elle ne tient pas compte du loyer, des salaires ni des frais généraux. Pour une marge exacte, rattache ce document à une <b>affaire</b> et rattaches-y aussi les achats correspondants.' },
    'buy.project': { t: 'Affaire', d: 'Rattache cet achat au chantier pour lequel tu l\'as fait. C\'est ce rattachement qui rend la marge exacte : sans lui, l\'affaire semblera plus rentable qu\'elle ne l\'est.' },
    'cat.cost': { t: 'Coût de revient HT', d: 'Ce que cette prestation ou cet article te coûte : prix d\'achat de la marchandise, sous-traitance, matériel. Facultatif, mais c\'est lui qui permet de calculer la marge sur les ventes qui ne sont pas rattachées à une affaire. Pour une prestation où tu ne vends que ton temps, laisse 0 : la marge affichée sera alors le prix de vente.' },
    'data.dossiers': { t: 'Dossiers', d: 'Un dossier = une entreprise. Chacun a ses clients, ses documents, ses achats, sa numérotation et ses sauvegardes, et ils ne se mélangent jamais. Utile quand une même personne gère deux sociétés : tu passes de l\'une à l\'autre en un clic, l\'application se recharge sur le bon dossier. Retirer un dossier de la liste ne supprime pas ses fichiers.' },
    'data.shared': { t: 'Dossier partagé', d: 'Un dossier placé dans iCloud Drive, OneDrive, un disque réseau ou une clé USB, que deux ordinateurs ouvrent tour à tour. SkanFact <b>ne laisse jamais l\'un écraser le travail de l\'autre</b> : si vous avez modifié tous les deux, il fusionne pièce par pièce et te dit ce qui a changé. Le seul cas qu\'il ne peut pas trancher est deux factures émises en même temps sous le même numéro : il t\'alerte, à vous de corriger. Lis l\'article « Travailler à deux » avant de vous lancer.' },
    'data.device': { t: 'Nom de ce poste', d: 'Il sert uniquement à te dire qui a enregistré en dernier sur un dossier partagé (« les modifications du PC du bureau ont été reprises »). Il ne quitte jamais tes données et n\'identifie personne.' },
    'compta.buyJournal': { t: 'Journal des achats', d: 'La liste chronologique de tout ce que tu as acheté sur la période — factures fournisseurs et dépenses. C\'est le symétrique exact du journal des ventes, et la seconde moitié de ce que ton comptable attend chaque mois.' },
    'compta.deductible': { t: 'TVA déductible', d: 'La part de la TVA payée à tes fournisseurs que tu as le droit de récupérer. Elle vient en déduction de la TVA que tu as facturée à tes clients : tu ne reverses que la différence. Si un chiffre est en gras, c\'est qu\'une partie de la TVA payée n\'est pas récupérable (case décochée sur la ligne d\'achat).' },
    'compta.buyNet': { t: 'Total réglé ou dû', d: 'Le net à payer de toutes les pièces de la période, que tu les aies déjà réglées ou non. Pour savoir ce qui reste à sortir de ton compte, regarde le panneau « À payer » de la page Achats.' },
    'compta.byCategory': { t: 'Où part ton argent', d: 'Tes achats regroupés par catégorie de charge, du plus gros au plus petit. C\'est le classement le plus utile de toute la comptabilité : il montre en dix secondes ce qui pèse vraiment, et c\'est souvent une surprise.' },
    'compta.vatReturn': { t: 'Déclaration de TVA', d: 'La soustraction centrale : <b>TVA collectée</b> sur tes ventes moins <b>TVA déductible</b> sur tes achats. Si le résultat est positif, tu reverses la différence à l\'État ; s\'il est négatif, tu as un <b>crédit de TVA</b> qui se reporte sur la période suivante. Ce calcul est l\'arithmétique exacte de tes données, <em>pas une déclaration officielle : à faire valider par ton comptable avant tout dépôt.</em>' },
    'compta.carry': { t: 'Crédit de TVA reporté', d: 'Le crédit de la période précédente, repris automatiquement. Un mois où tu achètes beaucoup (du stock, du matériel) génère souvent plus de TVA déductible que collectée : la différence n\'est pas perdue, elle vient en déduction des mois suivants.' },
    'compta.carryIn': { t: 'Crédit venu de l\'année précédente', d: 'Si ta dernière déclaration de l\'année passée se terminait par un crédit de TVA, saisis-le ici : il viendra en déduction de janvier. SkanFact ne peut pas le deviner s\'il n\'a pas les données de l\'année précédente.' },
    'compta.vatMonths': { t: 'Mois par mois', d: 'Chaque mois de l\'année avec sa collectée, sa déductible, le crédit repris du mois d\'avant et ce qu\'il restait à payer. Le total en bas n\'est pas la somme des lignes : un crédit reporté ne se compte qu\'une fois.' },
    'compta.result': { t: 'Résultat simplifié', d: 'Tes ventes hors taxes moins tes charges hors taxes. Les achats partis en stock ou en immobilisation n\'y sont pas comptés : ils ne sont pas consommés. <em>Ce n\'est pas ton résultat comptable</em> — il manque les amortissements, la variation de stock, les salaires et les provisions. C\'est un ordre de grandeur pour savoir où tu en es entre deux bilans.' },
    'compta.fiscal': { t: 'Calendrier fiscal', d: 'Un pense-bête des déclarations qui reviennent, que tu règles toi-même : active celles qui te concernent et ajuste le jour limite. Les échéances proches remontent aussi dans « À faire » sur l\'accueil. <em>À VÉRIFIER avec ton comptable :</em> les dates, la périodicité et les déclarations applicables dépendent de ta forme juridique, de ton régime et de la présence de salariés.' },
    'cl.notes': { t: 'Notes internes', d: 'Ce qu\'il faut se rappeler et qui ne s\'imprime nulle part : l\'interlocuteur à appeler, les délais réels, les conditions négociées, la façon de travailler. Enregistré tout seul au fil de la frappe.' },
    'sup.terms': { t: 'Délai de paiement accordé', d: 'Le nombre de jours que ce fournisseur t\'accorde pour le régler. Il se reporte automatiquement sur l\'échéance de chaque achat que tu enregistres chez lui. Laisse vide si tu paies comptant.' },
    'sup.withholding': { t: 'Retenue à la source à opérer', d: 'Quand tu paies certains prestataires (comptable, avocat, consultant), la loi te demande de <b>retenir</b> un pourcentage et de le reverser toi-même au fisc. Tu paies moins au fournisseur, et tu lui remets une attestation. Qui doit retenir et à quel taux : <em>À VÉRIFIER avec ton comptable.</em> Laisse « Aucune » dans le doute.' },
    'sup.total': { t: 'Acheté HT', d: 'Le total hors taxes de tout ce que tu as acheté chez ce fournisseur depuis le début, toutes années confondues.' },
    'sup.due': { t: 'Reste à payer', d: 'Ce que tu dois encore à ce fournisseur, tous achats confondus. La part en retard est signalée : c\'est elle qui abîme une relation commerciale.' },
    'buy.payables': { t: 'À payer', d: 'Le pendant des relances, côté sortant : ce que tu dois, à qui, pour quand. Les pièces en retard sont en tête et signalées en orange. Clique sur le titre pour replier le panneau ; ton choix est conservé.' },
    'buy.head': { t: 'La pièce du fournisseur', d: 'Contrairement à tes propres factures, tu ne maîtrises ni le numéro ni la date : ce sont ceux écrits sur la facture que le fournisseur t\'a remise. Recopie-les tels quels, c\'est ce qui permettra à ton comptable de retrouver la pièce.' },
    'buy.supplier': { t: 'Fournisseur', d: 'Chez qui tu as acheté. Son délai de paiement et son taux de retenue se reportent automatiquement sur cet achat. « + Nouveau fournisseur » crée la fiche sans quitter la saisie.' },
    'buy.number': { t: 'Numéro de la facture', d: 'Le numéro écrit sur la facture du fournisseur, pas un numéro à toi. C\'est la référence que ton comptable utilisera. Pour une dépense sans facture (ticket de caisse, reçu), mets ce que tu as, ou laisse vide.' },
    'buy.kind': { t: 'Facture d\'achat ou dépense', d: '<b>Facture d\'achat</b> : une vraie facture d\'un fournisseur, avec un numéro et de la TVA récupérable. <b>Dépense</b> : tout ce qui n\'a pas de facture détaillée — carburant, restaurant, frais bancaires, abonnement. La saisie est la même, le classement change.' },
    'buy.date': { t: 'Date de la pièce', d: 'La date écrite sur la facture du fournisseur, pas la date du jour où tu la saisis. C\'est elle qui détermine le mois de déclaration de la TVA déductible.' },
    'buy.due': { t: 'Échéance de paiement', d: 'Quand tu dois payer. Elle se calcule à partir du délai accordé par le fournisseur, et se modifie librement. C\'est ce qui alimente le panneau « À payer » et les alertes de l\'accueil.' },
    'buy.category': { t: 'Catégorie de charge', d: 'À quoi sert cette dépense : loyer, carburant, sous-traitance, honoraires… Elle sert à savoir où part ton argent. Une liste de départ est fournie ; « + Nouvelle catégorie » en ajoute une qui restera proposée ensuite. Le rattachement comptable exact relève du plan comptable : <em>À VÉRIFIER avec ton comptable.</em>' },
    'buy.subject': { t: 'Objet', d: 'À quoi se rapporte cet achat, dans tes mots. « Disques durs pour la Clinique » vaut mieux que « matériel » : dans six mois, c\'est ce qui te permettra de retrouver la pièce et, plus tard, de calculer ta marge sur une affaire.' },
    'buy.lines': { t: 'Lignes de l\'achat', d: 'Recopie au minimum le total hors taxes et son taux de TVA : c\'est ce qui permet de récupérer la TVA. Détaille ligne par ligne quand la facture mélange plusieurs taux, plusieurs destinations, ou des articles que tu revendras.' },
    'buy.destination': { t: 'Destination de la ligne', d: 'Ce que devient ce que tu achètes. <b>Charge</b> : consommé tout de suite (fournitures, loyer, carburant). <b>Stock</b> : marchandise achetée pour être revendue — elle sortira à la vente. <b>Immobilisation</b> : matériel qui reste dans l\'entreprise plus d\'un an (ordinateur, climatiseur, véhicule) et qui s\'amortit. Ce choix est posé dès maintenant pour que les modules stock et immobilisations n\'aient pas à te faire tout ressaisir.' },
    'buy.deductible': { t: 'TVA déductible', d: 'Coché par défaut : la TVA que tu as payée est récupérable sur ta déclaration. Décoche pour les cas où la loi l\'interdit — voiture de tourisme, cadeaux, frais de réception. Quels cas exactement : <em>À VÉRIFIER avec ton comptable.</em>' },
    'buy.fees': { t: 'Timbre et frais', d: 'Le timbre fiscal que ton fournisseur a facturé, et les frais annexes non soumis à TVA (port, assurance). Ils s\'ajoutent au total à payer mais ne donnent droit à aucune récupération de TVA.' },
    'buy.withholding': { t: 'Retenue à la source opérée', d: 'Le pourcentage que tu retiens en payant ce prestataire, et que tu reverses toi-même au fisc. Tu lui paies le net, et tu lui dois une attestation. Proposé automatiquement d\'après sa fiche fournisseur. <em>À VÉRIFIER avec ton comptable.</em>' },
    'buy.payments': { t: 'Règlements', d: 'Ce que tu as déjà versé sur cet achat. Le statut (« à payer », « partiel », « payée », « retard ») en découle : il ne se saisit jamais à la main, exactement comme pour tes factures de vente.' },
    'buy.certificate': { t: 'Attestation remise', d: 'Coche quand tu as remis au fournisseur l\'attestation de la retenue que tu lui as prélevée. Sans elle, il ne peut pas la déduire de son propre impôt : c\'est une obligation de ta part, et la source de bien des fâcheries.' },
    'stat.ca': { t: 'Chiffre d\'affaires HT', d: 'Le total hors taxes de tes factures émises sur la période, avoirs déduits. Les brouillons et les factures annulées n\'y sont jamais comptés. La flèche compare avec la même période de l\'an dernier : c\'est la seule comparaison qui a du sens, parce qu\'elle neutralise la saisonnalité.' },
    'stat.count': { t: 'Factures émises', d: 'Le nombre de factures numérotées sur la période. Beaucoup de factures pour peu de chiffre d\'affaires, c\'est du temps administratif : pense à regrouper ou à passer en contrat récurrent.' },
    'stat.avg': { t: 'Panier moyen', d: 'Ton chiffre d\'affaires divisé par le nombre de factures. Le faire monter demande moins d\'efforts que de trouver de nouveaux clients : propose une prestation complémentaire, ou un forfait annuel plutôt qu\'une intervention.' },
    'stat.vat': { t: 'TVA collectée', d: 'La TVA facturée à tes clients sur la période, avoirs déduits. Ce n\'est pas ton argent : tu la reverses à l\'État, moins la TVA que tu as toi-même payée sur tes achats. Le détail par taux est dans Comptabilité. <em>À VÉRIFIER avec ton comptable.</em>' },
    'stat.objectif': { t: 'Objectif annuel', d: 'Le chiffre d\'affaires HT que tu veux atteindre sur l\'année. La barre montre où tu en es, le petit trait vertical où tu devrais en être aujourd\'hui si tu avançais régulièrement. Se fixer un objectif chiffré change la façon dont on prospecte. Il se règle dans Paramètres → Documents.' },
    'stat.chart': { t: 'Chiffre d\'affaires mois par mois', d: 'Chaque mois de la période en couleur, le même mois de l\'année précédente en gris derrière. Les creux qui reviennent chaque année sont ta saisonnalité : c\'est là qu\'il faut prospecter à l\'avance, pas quand le trou est déjà là.' },
    'stat.funnel': { t: 'Issue des devis', d: 'Ce que sont devenus les devis émis sur la période. Le taux d\'acceptation ne compte que les devis tranchés (acceptés ou refusés) : les devis encore en attente ne le font pas baisser. Beaucoup d\'expirés sans réponse veut souvent dire qu\'il manque une relance, pas que tes prix sont trop hauts.' },
    'stat.aging': { t: 'Âge des impayés', d: 'Ce qui reste dû aujourd\'hui, rangé par ancienneté du retard — toutes périodes confondues, parce qu\'un impayé de l\'an dernier reste un impayé. Au-delà de 90 jours, les chances de récupérer baissent fortement : passe à l\'écrit et garde une trace.' },
    'stat.items': { t: 'Prestations les plus vendues', d: 'Tes lignes de facture regroupées par libellé, sur la période. Utilise les mêmes libellés d\'un devis à l\'autre (le catalogue est là pour ça) pour que ce classement soit juste. Les lignes de déduction d\'acompte n\'y figurent pas : ce ne sont pas des ventes.' },
    'stat.clients': { t: 'Meilleurs clients', d: 'Tes plus gros clients de la période, hors taxes. Si le premier pèse plus de la moitié de ton chiffre d\'affaires, ton entreprise est fragile : sa perte, ou simplement son retard de paiement, te mettrait en difficulté.' },
    'stat.mouvement': { t: 'Mouvement des clients', d: '<b>Nouveaux</b> : ceux dont la toute première facture tombe dans la période. <b>Endormis</b> : ceux qui ont déjà travaillé avec toi mais dont plus rien n\'est sorti depuis longtemps — c\'est le fichier le plus rentable à rappeler, ils te connaissent déjà. Le seuil se règle dans Paramètres → Documents.' },
    'stat.payeurs': { t: 'Qui paie vite, qui paie tard', d: 'Le délai moyen entre la date de facture et le dernier paiement, client par client, sur les factures soldées. Un client systématiquement au-delà de ton délai annoncé mérite un acompte à la commande plutôt qu\'une relance tous les mois.' },
    'stat.target': { t: 'Objectif de chiffre d\'affaires', d: 'Le montant hors taxes que tu veux facturer sur une année entière. Il n\'apparaît que dans la page Statistiques, jamais sur un document. Laisse 0 si tu n\'en veux pas.' },
    'stat.dormant': { t: 'Client endormi', d: 'Le nombre de jours de silence au-delà duquel un ancien client est signalé comme endormi dans les statistiques. 180 jours (six mois) convient à la plupart des activités ; descends-le si tes clients reviennent normalement tous les mois.' },
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
<p>Le bouton <b>Envoyer au comptable</b> prépare l'email avec les journaux cochés en pièces jointes : ventes, achats, encaissements et règlements fournisseurs, un fichier par journal.</p>
<h3>Journal des achats</h3>
<p>Le symétrique, dans l'onglet <b>Achats</b> : tout ce que tu as acheté sur la période, avec la part de TVA récupérable. Le classement « où part ton argent » regroupe tes charges par catégorie, du plus gros au plus petit — c'est souvent une surprise.</p>
<h3>Onglet TVA : la soustraction qui compte</h3>
<p>Depuis la version 3.1, la page a quatre onglets. Celui qui s'appelle <b>TVA à payer</b> fait enfin le calcul complet : la TVA que tu as <b>collectée</b> sur tes ventes, moins celle que tu as <b>payée</b> sur tes achats. Tu ne reverses que la différence.</p>
<p>Si la différence est négative — un mois où tu as beaucoup acheté — tu as un <b>crédit de TVA</b>. Il n'est pas perdu : il vient en déduction du mois suivant, automatiquement. Le tableau « mois par mois » montre cet enchaînement, c'est pour ça que le total ne se lit pas ligne par ligne.</p>
<p>Ces chiffres sont l'arithmétique exacte de ce que tu as saisi. Ce ne sont pas une déclaration officielle : <em>fais-les valider par ton comptable avant tout dépôt.</em></p>
<h3>Onglet Calendrier fiscal</h3>
<p>Un pense-bête des déclarations qui reviennent. Active celles qui te concernent, ajuste le jour limite, et les échéances proches remonteront dans « À faire » sur l'accueil. <em>À VÉRIFIER avec ton comptable :</em> les dates, la périodicité et les déclarations applicables dépendent de ta forme juridique, de ton régime fiscal et de la présence de salariés.</p>
<h3>Ta routine</h3>
<ul>
  <li><b>Chaque semaine</b> : pointe ton relevé bancaire et enregistre les paiements reçus. Regarde les relances.</li>
  <li><b>Début de mois</b> : génère les factures des contrats, envoie-les, puis exporte le journal du mois écoulé et les PDF pour ton comptable.</li>
  <li><b>Chaque trimestre</b> : réclame les attestations de retenue à la source manquantes.</li>
  <li><b>Chaque année</b> : vérifie que la numérotation repart à 001 en janvier (c'est automatique) et archive une copie complète de tes données.</li>
</ul>`
    },
    {
      id: 'pieces', title: 'Proforma, bons et contrat', sub: 'Les pièces qui entourent la facture',
      body: `
<p>À côté du devis et de la facture, SkanFact sait établir quatre autres pièces. Elles sont réunies dans <b>Autres documents</b>. Aucune n'a de valeur comptable : elles n'entrent ni dans ton chiffre d'affaires, ni dans ta TVA, ni dans le journal des ventes. Elles servent à documenter ce qui se passe autour de la vente.</p>
<h3>La facture proforma (PRO-)</h3>
<p>Elle annonce un prix ferme <b>sans être une facture</b>. Les administrations, les banques et les dossiers de financement la réclament souvent avant d'engager la dépense. Elle porte la mention « document sans valeur comptable » et, par défaut, pas de timbre fiscal — on ne paie pas de droit de timbre sur un document qui n'est pas une facture. <em>À VÉRIFIER avec ton comptable.</em></p>
<p>Quand la commande est confirmée, le menu <b>Transformer</b> en fait une vraie facture, avec son numéro FAC.</p>
<h3>Le bon de commande (BC-)</h3>
<p>Il enregistre ce que le client a commandé, avant que tu livres ou que tu factures. Il protège les deux parties : il fixe par écrit ce qui a été demandé, en quelle quantité et à quel prix. Fais-le signer dès que le montant compte.</p>
<h3>Le bon de livraison (BL-)</h3>
<p>Il accompagne la marchandise et se fait signer à la réception. C'est ta preuve d'avoir livré : sans lui, un client de mauvaise foi peut contester. Par défaut <b>les prix y sont masqués</b> — le livreur, le magasinier ou le transporteur n'ont pas à connaître tes tarifs. Une case à cocher les rétablit si ton client demande un bon valorisé.</p>
<h3>Le contrat de prestation (CTR-)</h3>
<p>Le vrai document que ton client signe : objet, durée, reconduction, préavis, conditions de paiement, confidentialité, litiges. Les sept clauses sont préremplies avec des formulations courantes et se modifient toutes. <b>Fais-les relire par un juriste ou ton comptable avant ta première signature</b> : ce sont des exemples, pas un conseil juridique.</p>
<p>Ne le confonds pas avec les <b>contrats récurrents</b> de la barre latérale, qui ne font que fabriquer un brouillon de facture chaque mois. Les deux vont ensemble : on signe le contrat, puis on crée le contrat récurrent qui le facture.</p>
<h3>Le chemin complet</h3>
<p>Le menu <b>Transformer</b>, en haut de chaque document, reprend tout ce qu'on peut en tirer. La chaîne habituelle pour une vente de marchandise :</p>
<ul>
  <li><b>Devis</b> — tu proposes un prix</li>
  <li><b>Bon de commande</b> — le client commande</li>
  <li><b>Bon de livraison</b> — tu livres, il signe</li>
  <li><b>Facture</b> — tu factures ce qui a été livré</li>
</ul>
<p>Chaque pièce garde le lien vers celle dont elle vient : l'historique du document le montre dans les deux sens, et chaque ligne est cliquable. Rien n'est jamais créé sans ton accord : une transformation produit toujours un <b>brouillon</b> que tu relis.</p>
<h3>Les numéros</h3>
<p>Chaque type a sa propre suite, qui repart à 001 en janvier : <b>PRO-2026-001</b>, <b>BC-2026-001</b>, <b>BL-2026-001</b>, <b>CTR-2026-001</b>. Le numéro est attribué au premier enregistrement. Contrairement à une facture, ces pièces restent modifiables ensuite : elles n'engagent rien fiscalement.</p>
<h3>Les pièces jointes</h3>
<p>Sur n'importe quel document — devis, facture, bon, contrat — un panneau <b>Pièces jointes</b> permet d'attacher des fichiers : le devis signé scanné, le bon de commande du client, un contrat rendu signé, la photo d'un chantier.</p>
<p>Les fichiers sont <b>copiés</b> à côté de tes données : si tu déplaces ou supprimes l'original, la pièce reste attachée au document. Attention à un point : elles ne sont <b>pas</b> dans les sauvegardes quotidiennes, qui ne contiennent qu'un fichier texte. Elles sont en revanche dans la <b>copie externe</b> (Paramètres → Sécurité et données). Si tu joins des documents importants, configure cette copie.</p>`
    },
    {
      id: 'tresorerie', title: 'La trésorerie', sub: 'La seule question qui compte vraiment',
      body: `
<p>Une entreprise peut être <b>rentable et mourir quand même</b>. C'est même la cause de faillite la plus fréquente des petites entreprises en bonne santé : les clients paient à soixante jours, les fournisseurs et les salaires n'attendent pas trente. L'argent existe, il n'est simplement pas là au bon moment.</p>
<p>La page Trésorerie répond à cette question-là, et à aucune autre : <b>est-ce que j'aurai de quoi payer le mois prochain ?</b></p>
<h3>Ce que tu saisis, et ce qui se fait tout seul</h3>
<p>Tu saisis <b>une seule chose</b> : tes comptes, avec leur solde de départ. Recopie-le de ton relevé au jour où tu commences. C'est le seul chiffre à vérifier deux fois — s'il est faux, tout le reste sera décalé du même montant.</p>
<p>Le reste remonte automatiquement. Chaque paiement client que tu enregistres sur une facture, chaque règlement fournisseur sur un achat : ce sont déjà des mouvements de trésorerie, tu ne les ressaisis jamais.</p>
<p>Restent les <b>mouvements libres</b>, ceux qui n'ont ni facture ni achat : salaires, impôts, frais bancaires, échéance d'emprunt, apport, retrait. Ceux-là se saisissent dans l'onglet Mouvements. Tu tapes toujours un montant positif ; la nature choisie donne le sens.</p>
<h3>« Ce qui arrive » : la prévision</h3>
<p>SkanFact prend ton solde d'aujourd'hui et y applique, date par date, tout ce qui est <b>déjà engagé</b> : les factures clients ouvertes à leur échéance, les achats à régler à la leur, les factures que tes contrats récurrents vont produire.</p>
<p>Aucune estimation, aucune moyenne, aucune projection statistique. Ce que tu vois est ce qui est certain — si tout le monde paie à la date prévue.</p>
<p>Deux détails qui changent tout :</p>
<ul>
  <li>Une facture <b>déjà échue</b> est ramenée à aujourd'hui, pas laissée à sa date passée. Se dire qu'elle rentrera « le 15 du mois dernier » n'a aucun sens.</li>
  <li>Les <b>échéances fiscales</b> sont listées mais pas chiffrées : SkanFact connaît la date, pas le montant. Pense à les provisionner toi-même.</li>
</ul>
<h3>Le trou de trésorerie</h3>
<p>Si la courbe passe sous zéro, la date est affichée en rouge en haut de la page, et l'alerte remonte dans « À faire » sur l'accueil. <b>C'est l'information la plus importante de toute l'application.</b></p>
<p>Regarde bien : il arrive souvent que le solde soit positif au début, positif à la fin, et négatif au milieu. C'est exactement le piège — en ne regardant que le total, tu ne le vois pas.</p>
<p>Un trou <b>anticipé</b> se règle : tu relances tes impayés, tu décales un règlement fournisseur en le prévenant, tu demandes une facilité à ta banque. Un trou <b>constaté</b> se subit : chèque rejeté, frais, et une conversation désagréable avec ton banquier. Toute la valeur de cette page est dans ces trois semaines d'avance.</p>
<h3>Le rapprochement bancaire</h3>
<p>Une fois par mois, prends ton relevé et coche dans SkanFact tout ce que tu y retrouves. Recopie ensuite le solde final du relevé : SkanFact te dit s'il y a un écart.</p>
<p>Un écart veut toujours dire qu'une opération manque d'un côté ou de l'autre — un prélèvement que tu n'as pas saisi, un chèque compté deux fois, un montant mal recopié. C'est fastidieux, et c'est <b>la seule chose qui garantit que tes chiffres sont vrais</b>. Sans rapprochement, ta trésorerie n'est qu'une opinion.</p>
<p>Ce qui reste décoché n'est pas forcément une erreur : un chèque mis à l'encaissement met quelques jours à apparaître. En revanche, un mouvement qui traîne depuis des semaines mérite un coup d'œil.</p>
<h3>Ce que cette page ne fait pas</h3>
<p>Elle ne se connecte pas à ta banque. Aucune synchronisation automatique, aucun identifiant bancaire demandé nulle part — et c'est volontaire : SkanFact n'a rien à faire avec tes accès bancaires.</p>
<p>Elle ne devine pas non plus l'avenir. Un client qui ne paiera jamais apparaît comme une rentrée prévue. C'est à toi de savoir lesquels de tes impayés sont vraiment perdus.</p>`
    },
    {
      id: 'marges', title: 'Gagnes-tu vraiment de l\'argent ?', sub: 'Marge, affaires et seuil de rentabilité',
      body: `
<p>Le chiffre d'affaires ne dit rien. Deux entreprises qui facturent 200 000 DT par an peuvent, l'une vivre très bien, l'autre déposer le bilan. Ce qui compte, c'est ce qu'il <b>reste</b> une fois payé ce que tu as fallu acheter pour vendre. La page <b>Marges</b> est là pour ça.</p>
<h3>D'où vient le coût ?</h3>
<p>SkanFact connaît tes ventes : elles sont dans tes factures. Il ne peut pas deviner ce qu'elles t'ont coûté. Tu as donc deux façons de le lui dire, et elles ne se valent pas.</p>
<ul>
  <li><b>Le coût de revient du catalogue</b> (Catalogue → Modifier une prestation → « Coût de revient HT »). C'est une <b>estimation</b> : elle sert à tout ce que tu vends de façon répétitive. Une licence antivirus achetée 52 DT et revendue 95 DT, c'est simple et c'est toujours vrai.</li>
  <li><b>L'affaire</b>. Tu crées une affaire (« Salle informatique — École Les Lauriers »), tu y rattaches les devis, les factures <b>et</b> les factures d'achat qui la concernent. Là, il n'y a plus d'estimation : SkanFact compare de l'argent réellement facturé à de l'argent réellement dépensé. <b>C'est le seul chiffre exact de l'application.</b></li>
</ul>
<p>Le petit signe <b>≈</b> à côté d'un taux veut dire : « toutes les lignes n'ont pas de coût connu, cette marge est optimiste ». Tant qu'il est là, prends le chiffre comme un ordre de grandeur.</p>
<h3>Créer une affaire</h3>
<p>Depuis la page <b>Marges</b>, bouton « + Nouvelle affaire ». Ou directement depuis un devis, une facture ou un achat : le champ <b>Affaire</b> propose « + Nouvelle affaire ».</p>
<p>Ça vaut le coup dès qu'un chantier mélange de la fourniture et de la prestation, ou dès qu'il s'étale sur plusieurs factures. Pour une vente simple, ne t'embête pas.</p>
<p>Le piège est toujours le même : <b>un achat oublié fait croire que l'affaire rapporte plus qu'en vrai</b>. Prends l'habitude de choisir l'affaire au moment où tu saisis la facture du fournisseur, pas trois mois après.</p>
<h3>« En caisse » : rentable n'est pas payé</h3>
<p>Sur chaque affaire, tu vois deux chiffres différents, et c'est voulu :</p>
<ul>
  <li>La <b>marge</b> : ce que l'affaire rapportera, une fois tout le monde payé.</li>
  <li>L'<b>en caisse</b> : ce qu'elle a rapporté <em>à ce jour</em> — encaissé moins payé.</li>
</ul>
<p>Une affaire peut afficher 35 % de marge et un « en caisse » négatif : tu as réglé tes fournisseurs, ton client ne t'a pas encore payé. C'est exactement comme ça qu'on manque d'argent tout en gagnant de l'argent. La page <b>Trésorerie</b> raconte la suite de cette histoire.</p>
<h3>Où est la marge</h3>
<p>Cet onglet reprend une année entière de ventes et la découpe par client ou par prestation. Deux découvertes reviennent presque toujours :</p>
<ul>
  <li>Le plus gros client n'est pas le plus rentable. Il est souvent celui qui a négocié le plus.</li>
  <li>Une prestation qu'on traite comme secondaire rapporte, en proportion, davantage que le cœur de métier.</li>
</ul>
<p>Ce n'est pas une raison pour abandonner quoi que ce soit du jour au lendemain — mais c'est une raison pour savoir où mettre ton temps, et qui augmenter en premier l'année prochaine.</p>
<h3>Le seuil de rentabilité</h3>
<p>C'est le chiffre d'affaires minimum qu'il te faut pour couvrir tes charges fixes. En dessous, tu travailles à perte, même si chaque vente prise isolément est rentable.</p>
<p>Le calcul sépare tes dépenses en deux :</p>
<ul>
  <li>Les <b>variables</b> suivent les ventes : marchandises, sous-traitance, matériel acheté pour un chantier précis. Si tu ne vends rien, elles n'existent pas.</li>
  <li>Les <b>fixes</b> tombent quoi qu'il arrive : loyer, assurance, abonnements, salaires, remboursement d'emprunt.</li>
</ul>
<p>C'est toi qui décides, en bas de la page, quelles catégories de dépense sont fixes — parce que ça dépend de ton activité. <em>À VÉRIFIER avec ton comptable :</em> ce classement n'a aucun effet sur ta comptabilité ni sur tes déclarations, il ne sert qu'à ce calcul.</p>
<p>SkanFact te donne ensuite le montant à l'année, au mois et au jour ouvré. Le chiffre par jour est celui qui parle : savoir qu'il te faut 340 DT par jour rien que pour rentrer dans tes frais change la façon dont tu regardes une journée passée à autre chose.</p>
<h3>Ce que cette page ne dit pas</h3>
<p>Elle ne calcule pas ton bénéfice fiscal. Elle ignore les amortissements, les variations de stock, les provisions et l'impôt. Les achats classés « stock » ou « immobilisation » sont d'ailleurs exclus des charges de la période : ils ne sont pas consommés. Le vrai résultat, c'est ton comptable qui l'établit en fin d'année.</p>
<p>Elle ne compte pas non plus <b>ton</b> salaire si tu ne t'en verses pas. Une activité qui dégage 20 000 DT de marge sur l'année en te faisant travailler tous les week-ends n'est pas rentable : elle est juste mal payée.</p>`
    },
    {
      id: 'statistiques', title: 'Lire tes statistiques', sub: 'Ce que les chiffres disent, et ce qu\'ils ne disent pas',
      body: `
<p>La page <b>Statistiques</b> ne sert pas à ta déclaration — ça, c'est Comptabilité. Elle sert à décider : où mettre ton énergie le mois prochain.</p>
<h3>Choisir la période</h3>
<p>En haut à droite : une année entière, un trimestre ou un mois. Tout ce qui est affiché en dessous suit ce choix, sauf l'âge des impayés (qui regarde toujours ce qui reste dû aujourd'hui, quelle que soit la date des factures).</p>
<h3>La comparaison à l'an dernier</h3>
<p>La petite flèche à côté de chaque chiffre le compare à la <b>même période l'année précédente</b>, jamais au mois d'avant. Comparer janvier à décembre ne veut rien dire : décembre est presque toujours plus chargé. Comparer janvier à janvier, oui.</p>
<p>Sur le graphique, les barres grises derrière sont l'année précédente. Les creux qui reviennent au même moment chaque année, c'est ta saisonnalité : le bon moment pour prospecter, c'est deux mois avant le creux, pas pendant.</p>
<h3>L'objectif</h3>
<p>Donne-toi un chiffre d'affaires annuel dans <b>Paramètres → Documents</b>. La barre montre où tu en es ; le petit trait vertical montre où tu devrais en être aujourd'hui si tu avançais régulièrement. En dessous, SkanFact te dit combien il reste à facturer par mois pour y arriver. C'est ce chiffre-là qui fait décrocher le téléphone.</p>
<h3>L'issue des devis</h3>
<p>Le taux d'acceptation ne compte que les devis <b>tranchés</b> : un devis encore en attente ne le fait pas baisser. Si beaucoup de devis expirent sans réponse, le problème est rarement le prix — c'est qu'il a manqué une relance. La page Relances te les liste.</p>
<h3>L'âge des impayés</h3>
<p>C'est le tableau le plus important de la page. Un impayé de moins de 30 jours se règle par un rappel ; au-delà de 90 jours, les chances de récupérer baissent fortement et il faut passer à l'écrit, en gardant une trace. Regarde-le une fois par semaine.</p>
<h3>Tes clients</h3>
<p>Deux signaux à surveiller. D'abord la <b>concentration</b> : si ton premier client pèse plus de la moitié de ton chiffre d'affaires, son départ — ou simplement son retard de paiement — te met en difficulté. Ensuite les <b>clients endormis</b> : des gens qui t'ont déjà fait confiance et dont plus rien ne sort. Les rappeler coûte moins cher que de trouver un inconnu.</p>
<h3>Ce que ces chiffres ne disent pas</h3>
<p>Ils portent sur ce que tu as <b>facturé</b>, pas sur ce que tu as <b>gagné</b> : tes achats et tes charges n'y sont pas encore. Un mois record en facturation peut être un mauvais mois en trésorerie si personne ne paie. Garde toujours un œil sur le « reste à encaisser ».</p>`
    },
    {
      id: 'achats', title: 'Tes achats et ta TVA déductible', sub: 'L\'autre moitié de ta comptabilité',
      body: `
<p>Jusqu'à la version 3.0, SkanFact ne connaissait que ton argent qui rentre. Il connaît maintenant celui qui sort. C'est la brique qui manquait sous tout le reste : sans les achats, impossible de récupérer ta TVA, de connaître ta marge réelle, ni de savoir ce que tu auras sur ton compte le mois prochain.</p>
<h3>Fournisseur, facture d'achat, dépense</h3>
<p>Un <b>fournisseur</b> est une fiche, comme un client : raison sociale, matricule, contact, RIB, et le <b>délai de paiement</b> qu'il t'accorde. Ce délai se reporte tout seul sur chaque achat que tu saisis chez lui.</p>
<p>Une <b>facture d'achat</b> est une vraie facture, avec un numéro et de la TVA. Attention : <b>le numéro et la date sont les siens, pas les tiens</b>. Recopie-les exactement tels qu'ils sont écrits sur le papier — c'est la référence que ton comptable utilisera pour retrouver la pièce.</p>
<p>Une <b>dépense</b> est tout ce qui n'a pas de facture détaillée : carburant, restaurant, frais bancaires, abonnement. La saisie est la même, en plus court.</p>
<h3>La destination de chaque ligne</h3>
<p>C'est le champ qui a l'air le moins utile aujourd'hui et qui comptera le plus demain. Trois choix :</p>
<ul>
  <li><b>Charge</b> : consommé tout de suite. Fournitures, loyer, carburant, sous-traitance. C'est le cas le plus fréquent.</li>
  <li><b>Stock</b> : de la marchandise achetée pour être revendue. Elle sortira du stock quand tu la vendras.</li>
  <li><b>Immobilisation</b> : du matériel qui reste dans l'entreprise plus d'un an — ordinateur, climatiseur, véhicule, mobilier. Il ne se déduit pas d'un coup : il s'amortit sur plusieurs années.</li>
</ul>
<p>Les modules stock et immobilisations liront ce champ. Le renseigner dès maintenant t'évitera de ressaisir un an d'historique quand ils arriveront.</p>
<h3>La TVA déductible</h3>
<p>La TVA que tu as payée à tes fournisseurs se <b>déduit</b> de celle que tu as facturée à tes clients. Tu ne reverses à l'État que la différence. C'est pour ça qu'il faut tout saisir : chaque facture d'achat oubliée, c'est de la TVA payée deux fois.</p>
<p>Trois conditions, et elles sont strictes : il faut une <b>facture en bonne et due forme</b> (pas un ticket), au nom de <b>ton entreprise</b> avec son matricule, et une dépense <b>professionnelle</b>. La case « déductible » est cochée par défaut ; décoche-la pour les cas où la loi l'interdit — voiture de tourisme, cadeaux, frais de réception. <em>Quels cas exactement, et à quelles conditions : À VÉRIFIER avec ton comptable.</em></p>
<h3>La retenue à la source, dans l'autre sens</h3>
<p>Tu connais déjà la retenue que <b>tes clients</b> te prélèvent. Il existe la symétrique : quand tu paies certains prestataires — comptable, avocat, consultant — c'est <b>toi</b> qui dois retenir un pourcentage et le reverser au fisc à leur place.</p>
<p>Concrètement : tu paies moins que le montant de sa facture, et tu lui remets une <b>attestation</b> qui prouve que tu as versé la différence au Trésor. Sans cette attestation, il ne peut pas la déduire de son propre impôt — et il te la réclamera. Le panneau « À faire » de l'accueil te rappelle celles que tu dois.</p>
<p><em>Qui doit retenir, sur quelles prestations et à quel taux : À VÉRIFIER avec ton comptable avant d'appliquer quoi que ce soit.</em> Dans le doute, laisse « Aucune ».</p>
<h3>Le justificatif</h3>
<p>Chaque achat accepte une pièce jointe. Photographie ou scanne la facture du fournisseur et joins-la. Sans justificatif, en cas de contrôle, ni la charge ni la TVA ne sont admises : la dépense existe dans tes comptes mais pas aux yeux du fisc.</p>
<h3>Le panneau « À payer »</h3>
<p>En haut de la page Achats : ce que tu dois, à qui, pour quand. C'est l'exact pendant de la page Relances, mais côté sortant. Les retards sont en tête et en orange.</p>
<p>Regarde-le en même temps que ton « reste à encaisser » : si tu dois 4 000 DT la semaine prochaine et qu'on te doit 6 000 DT sans date, tu as un problème de trésorerie même si ton entreprise est rentable. C'est la première cause de faillite des petites entreprises en bonne santé.</p>
<h3>Ta routine, complétée</h3>
<ul>
  <li><b>À réception de chaque facture fournisseur</b> : saisis-la tout de suite et joins la photo. Cinq minutes maintenant valent une soirée entière en fin de trimestre.</li>
  <li><b>Chaque semaine</b> : pointe ton relevé bancaire dans les deux sens — encaissements clients et règlements fournisseurs.</li>
  <li><b>Chaque mois</b> : vérifie que rien ne traîne dans « À payer », et remets les attestations de retenue que tu dois.</li>
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
      id: 'deux', title: 'Travailler à deux sur la même entreprise', sub: 'Dossier partagé : ce qui marche, et ce qui ne se répare pas',
      body: `
<p>Deux cas différents, souvent confondus. Regarde lequel est le tien.</p>
<h3>Cas 1 — une personne, deux entreprises</h3>
<p>Quelqu'un gère deux sociétés sur le même ordinateur. Chacune a ses clients, sa numérotation, sa TVA : elles ne doivent <b>jamais</b> se mélanger.</p>
<p>C'est le rôle des <b>dossiers</b> (Paramètres → Sécurité et données). Tu crées un dossier par entreprise et tu passes de l'un à l'autre en un clic. Rien de commun entre eux, pas même les paramètres.</p>
<h3>Cas 2 — deux personnes, une entreprise</h3>
<p>Deux ordinateurs travaillent sur la même société. Là, il faut un <b>dossier partagé</b> : un dossier posé dans iCloud Drive, OneDrive, un disque réseau ou une clé USB, que les deux postes ouvrent.</p>
<h3>Ce qui se passe quand vous modifiez en même temps</h3>
<p>C'est la vraie question, et voici la réponse exacte.</p>
<p>SkanFact numérote chaque enregistrement. Avant d'écrire, il relit le fichier partagé. Si le numéro a changé, c'est que l'autre poste a enregistré entre-temps : <b>il refuse d'écraser</b>. Il prend sa version, la compare à la tienne, et fusionne :</p>
<ul>
  <li><b>Vous avez travaillé sur des pièces différentes</b> — le cas normal. Les deux travaux sont réunis, personne ne perd rien, tu vois passer un message discret.</li>
  <li><b>Vous avez modifié la même pièce</b> — rare. SkanFact garde la version du fichier enregistré en dernier, te dit laquelle, et <b>conserve l'autre</b> au lieu de la jeter. Rien n'est détruit sans trace.</li>
  <li><b>Une pièce supprimée d'un côté</b> — elle ne ressuscite pas. La suppression est mémorisée exprès pour ça.</li>
  <li><b>La numérotation</b> — les compteurs ne redescendent jamais : SkanFact garde toujours le plus haut des deux.</li>
</ul>
<h3>Le seul cas qui ne se répare pas tout seul</h3>
<p>Si vous êtes <b>tous les deux hors ligne</b> et que vous <b>émettez chacun une facture</b>, vous sortirez tous les deux le numéro suivant. Aucun logiciel au monde ne peut deviner lequel garder : deux factures portent le même numéro, et ce n'est pas légal.</p>
<p>SkanFact vous alerte en gros à la fusion, en nommant les pièces concernées. La correction est celle de toute facture émise par erreur : un <b>avoir</b> sur l'une, puis on la réémet avec un nouveau numéro.</p>
<p>Pour que ça n'arrive jamais, une seule règle à tenir entre vous : <b>une seule personne émet les factures</b>. L'autre prépare des devis et des brouillons autant qu'il veut — un brouillon n'a pas de numéro, il ne peut donc pas entrer en conflit.</p>
<h3>La bonne façon de travailler à deux</h3>
<ul>
  <li><b>Ouvrez à tour de rôle</b> quand c'est possible. Fermez SkanFact quand vous avez fini : le fichier part se synchroniser tout de suite.</li>
  <li><b>Attendez la synchronisation</b> avant d'ouvrir de l'autre côté. iCloud et OneDrive mettent parfois une minute ; l'icône du dossier le montre.</li>
  <li><b>Une seule personne émet</b> les factures et les avoirs.</li>
  <li><b>Donnez un nom clair à chaque poste</b> (Paramètres → Ce poste) : les messages diront « les modifications du PC du bureau ont été reprises » plutôt qu'un nom technique.</li>
  <li><b>Ne mettez pas le dossier partagé sur une clé USB</b> que vous débranchez à chaud. Un service de synchronisation fait le travail bien mieux.</li>
</ul>
<h3>Ce que SkanFact ne fait pas</h3>
<p>Ce n'est pas un logiciel en ligne. Il n'y a pas de serveur, pas de compte, pas de synchronisation en temps réel : les deux postes ne se voient pas, ils se passent un fichier. C'est volontaire — tes données restent chez toi, et l'application marche sans internet.</p>
<p>La conséquence : vous ne verrez pas le travail de l'autre <b>pendant</b> qu'il le fait, seulement une fois qu'il a enregistré et que la synchronisation est passée. Si vous avez besoin de travailler vraiment en même temps, à plusieurs, toute la journée, il faudra un vrai logiciel en ligne — et ce n'est pas ce que SkanFact cherche à être.</p>
<h3>Et les sauvegardes ?</h3>
<p>Chaque dossier garde les siennes, trente jours, dans son propre emplacement. Sur un dossier partagé, les sauvegardes du jour sont celles du poste qui a enregistré. Garde en plus une <b>copie externe</b> sur un autre support : un dossier synchronisé qui se corrompt, ça existe.</p>`
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
