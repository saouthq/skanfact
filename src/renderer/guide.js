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
    'co.name': { t: 'Raison sociale', d: 'Le nom officiel de ton entreprise, exactement comme sur ton registre de commerce (avec la forme juridique : SUARL, SARL, SA…). C\'est ce nom qui apparaît en haut de tous tes documents et qui engage juridiquement.', a: 'demarrer' },
    'co.matricule': { t: 'Matricule fiscal', d: 'Ton identifiant auprès de l\'administration fiscale, obligatoire sur toute facture. En Tunisie il ressemble à <b>1234567X/A/M/000</b>. Une facture sans matricule peut être refusée par le client ou par le fisc. <em>À VÉRIFIER avec ton comptable : le format complet à écrire.</em>', a: 'fiscal' },
    'co.taxRegime': { t: 'Régime fiscal', d: 'C\'est lui qui décide si tu factures la TVA — <b>pas ton métier</b>.<br><br><b>Réel</b> : tu factures la TVA, tu la déclares chaque mois et tu déduis celle de tes achats. C\'est le cas le plus courant.<br><b>Forfaitaire</b> : tu ne factures pas de TVA et tu ne la déduis pas.<br><b>Exonéré</b> : ton activité est exonérée de TVA.<br><br>Dans les deux derniers cas, la <b>colonne TVA disparaît</b> de tes documents et la mention légale s\'imprime à sa place — une facture sans TVA et sans mention est incomplète. Le taux des nouvelles lignes passe alors à 0 % et ne se modifie plus.<br><br><em>À VÉRIFIER avec ton comptable : le régime dépend de ton chiffre d\'affaires et de ta forme juridique, et la mention exacte de l\'article invoqué.</em>', a: 'fiscal' },
    'co.rc': { t: 'Registre de commerce (RC)', d: 'Le numéro que tu as reçu en immatriculant ton entreprise au registre national des entreprises. Il s\'affiche dans le petit texte en bas de tes documents. Ce n\'est pas obligatoire partout, mais ça fait sérieux et beaucoup de clients le demandent.' },
    'co.capital': { t: 'Capital social', d: 'La somme que les associés ont apportée à la création de la société (par exemple « 1 000 DT »). Elle figure dans les mentions légales en bas des documents. Une entreprise individuelle n\'a pas de capital : laisse vide.' },
    'co.address': { t: 'Adresse', d: 'L\'adresse du siège social, celle qui est déclarée. Écris-la sur plusieurs lignes (rue, puis code postal et ville) : elle sera reproduite telle quelle sur les documents.' },
    'co.tagline': { t: 'Slogan', d: 'Une ligne courte sous ton nom qui dit ce que tu fais, par exemple « Cybersécurité · Infrastructure · Services informatiques ». Optionnel, mais utile quand un client reçoit ton devis sans te connaître.' },
    'co.logo': { t: 'Logo', d: 'Une image PNG, JPG ou SVG (1 Mo maximum) affichée en haut à gauche de tes documents. Préfère un fond transparent ou blanc. Sans logo, seul ton nom s\'affiche : c\'est propre aussi.' },
    'co.stampImage': { t: 'Cachet / signature', d: 'La photo de ton cachet d\'entreprise ou de ta signature. Elle se place dans la case « Cachet et signature » en bas des documents, ce qui t\'évite d\'imprimer, signer, scanner. Astuce : signe sur une feuille blanche, photographie-la en plein jour, recadre.' },
    'co.colors': { t: 'Couleurs', d: 'La couleur principale est celle du texte des titres, la couleur d\'accent teinte les bandeaux, les totaux et les cadres. Elles ne changent que les documents PDF, pas l\'interface. Reste sur des couleurs claires : un document trop coloré fait moins professionnel.' },
    // — apparence —
    'ap.theme': { t: 'Thème', d: 'L\'apparence de l\'application : clair, sombre, ou comme le réglage de ton ordinateur. Les documents PDF restent toujours clairs, quel que soit le thème.' },
    'ap.defaultLang': { t: 'Langue des documents par défaut', d: 'La langue utilisée pour les nouveaux devis et factures. Tu peux toujours la changer document par document, ou la fixer par client (utile pour un client étranger).' },
    // — paiement —
    'pay.bank': { t: 'Banque et RIB', d: 'Ton RIB (Relevé d\'Identité Bancaire) s\'affiche sur les factures, dans le bloc « Règlement ». C\'est ce que ton client copie pour faire le virement : vérifie-le deux fois, une erreur ici, c\'est un paiement qui n\'arrive jamais.', a: 'paiements' },
    'pay.terms': { t: 'Conditions de paiement', d: 'La phrase imprimée sur chaque facture pour dire COMMENT te payer. Exemple : « Paiement par virement bancaire. » La date limite, elle, s\'imprime toute seule d\'après ton délai de paiement (« À régler avant le … ») : ne la répète pas ici, sinon les deux finissent par se contredire — « à réception » sur une facture à trente jours, c\'est le client qui choisit lequel il lit.' },
    // — documents —
    'doc.defaultVat': { t: 'TVA des nouvelles lignes', d: 'Le taux proposé chaque fois que tu ajoutes une ligne à la main dans un devis, une facture ou un article du catalogue. L\'assistant l\'a réglé d\'après le métier que tu as déclaré ; tu peux toujours changer le taux ligne par ligne. Si ton activité est exonérée, mets <b>0 %</b> ici une fois pour toutes. <em>À VÉRIFIER avec ton comptable : le taux qui s\'applique à chacune de tes prestations.</em>', a: 'fiscal' },
    'doc.stampFee': { t: 'Timbre fiscal', d: 'Une taxe fixe que l\'État tunisien ajoute à chaque facture, indépendamment du montant (1 DT au moment où ces lignes sont écrites). Elle s\'ajoute après la TVA. Elle ne s\'applique pas aux devis. <em>À VÉRIFIER avec ton comptable : le montant en vigueur et les cas d\'exonération.</em>', a: 'fiscal' },
    'doc.quoteValidity': { t: 'Validité des devis', d: 'Le nombre de jours pendant lesquels ton prix reste garanti. Au-delà, tu es libre de refaire un devis à un autre prix. 30 jours est l\'usage. La date calculée s\'imprime sur le devis.' },
    'doc.paymentDays': { t: 'Délai de paiement', d: 'Le nombre de jours dont ton client dispose pour payer, à partir de la date de facture. Il sert à calculer l\'échéance imprimée sur la facture, et c\'est lui qui déclenche le passage en « en retard » dans l\'application.' },
    'doc.withholdingThreshold': { t: 'Seuil de retenue à la source', d: 'En dessous de ce montant TTC, l\'application te <b>prévient</b> si une facture porte quand même une retenue — elle ne refuse jamais, et elle ne retire jamais la retenue toute seule. <b>0 = pas de seuil</b>, et c\'est la valeur livrée : tant que ton comptable ne t\'a pas donné le chiffre, SkanFact n\'en invente pas un. <em>À VÉRIFIER avec ton comptable.</em>', a: 'fiscal' },
    'doc.withholdingDefault': { t: 'Retenue à la source par défaut', d: 'Le taux appliqué automatiquement aux nouvelles factures. Laisse « Aucune » si la plupart de tes clients sont des particuliers, et règle le taux client par client pour les sociétés et les administrations. Les taux proposés sont ceux qu\'on rencontre le plus ; « Autre taux… » accepte n\'importe quel autre. <em>À VÉRIFIER avec ton comptable.</em>', a: 'fiscal' },
    'doc.currency': { t: 'Devise', d: 'La monnaie de ton entreprise, celle de ta comptabilité (DT pour le dinar tunisien). Les statistiques et le journal des ventes sont toujours exprimés dans cette monnaie, même quand tu factures un client en euros.' },
    'doc.openAfterExport': { t: 'Ouvrir le PDF après export', d: 'Quand c\'est coché, le PDF s\'ouvre dans l\'Aperçu dès qu\'il est enregistré, pour que tu le relises. Décoche si tu exportes beaucoup de documents à la suite.' },
    'doc.quoteTerms': { t: 'Conditions des devis', d: 'Le texte imprimé en bas de chaque devis, sous la validité. Il sert à expliquer comment le client accepte : « retournez-le daté et signé avec la mention Bon pour accord ». Un devis signé est la meilleure preuve en cas de litige.' },
    'doc.footer': { t: 'Pied de page des documents', d: 'La ligne discrète en bas de chaque page. Elle sert aux mentions légales : nom, matricule fiscal, RC et capital y sont ajoutés automatiquement.' },
    'doc.en': { t: 'Textes en anglais', d: 'Utilisés à la place des textes français quand un document est en anglais (Langue du document = English). Pense à traduire aussi tes conditions de paiement.' },
    // — emails —
    'pay.rib': { t: 'RIB', d: 'Les 20 chiffres d\'un compte bancaire tunisien : la banque (2), l\'agence (3), le numéro de compte (13) et la clé (2). La clé permet de vérifier les dix-huit autres : SkanFact la contrôle pendant que tu tapes, et une faute de frappe se voit tout de suite — avant de partir imprimée sur une facture. Un IBAN (TN59 suivi des 20 chiffres, ou celui d\'un compte à l\'étranger) est accepté aussi. C\'est un avertissement, jamais un refus.' },
    'mail.client': { t: 'Envoi des emails', d: 'Sur Mac, SkanFact peut ouvrir <b>Mail</b> avec le destinataire, l\'objet, le texte et le PDF déjà joint : tu relis et tu cliques sur Envoyer. Si tu utilises Gmail dans le navigateur ou Outlook, choisis « Autre messagerie » : le message s\'ouvre dans ta messagerie par défaut et le PDF s\'affiche dans le Finder pour que tu le glisses dedans. Sous Windows, c\'est toujours ce second chemin : le PDF s\'affiche dans l\'Explorateur.' },
    'mail.templates': { t: 'Modèles d\'email', d: 'Les textes préparés pour chaque situation. Les mots entre accolades sont remplacés automatiquement : <b>{numero}</b>, <b>{client}</b>, <b>{objet}</b>, <b>{montant}</b>, <b>{echeance}</b>, <b>{jours}</b>, <b>{societe}</b>, <b>{reference}</b>. Tu peux tout réécrire à ta façon : c\'est ta voix, pas la mienne.' },
    // — mises à jour / sécurité / données —
    'upd.token': { t: 'Jeton d\'accès', d: 'SkanFact télécharge ses mises à jour depuis GitHub. Quand le dépôt est <b>privé</b>, GitHub ne répond à personne sans clé de lecture : c\'est ce jeton. Il est enregistré uniquement sur cet ordinateur et n\'est envoyé à personne d\'autre qu\'à GitHub.<br>Quand le dépôt est <b>public</b> — c\'est le cas depuis septembre 2026 — il n\'y a rien à saisir, et ce champ ne s\'affiche pas. S\'il reste un jeton de l\'époque privée, le bouton le retire.<br>Et quand le <b>relais de mise à jour</b> est en place, il n\'y a jamais rien à saisir dans aucun des deux cas : c\'est lui qui détient l\'accès.' },
    'upd.beta': { t: 'Versions d\'essai', d: 'Deux canaux, une seule application. <b>Désactivé</b> : tu reçois les versions terminées, celles que tout le monde installe. <b>Activé</b> : tu reçois en plus les versions d\'essai (leur numéro finit par <code>-beta</code>, la ligne dit laquelle est en cours), qui servent à vérifier une nouveauté avant de la donner aux autres — elles peuvent contenir des défauts, c\'est leur raison d\'être.<br>Une bêta s\'installe par-dessus SkanFact et travaille sur les <b>mêmes données</b> : une sauvegarde « avant-beta » est prise au moment où tu l\'actives. Désactiver te ramène au canal normal ; si tu tournes sur une bêta, SkanFact la remplacera par la prochaine version stable. Sur l\'ordinateur qui tient la vraie comptabilité, laisse désactivé.', a: 'partager' },
    'sec.password': { t: 'Mot de passe', d: 'Il chiffre le fichier de données et toutes ses sauvegardes sur le disque (AES-256). Il protège contre un ordinateur perdu ou volé : sans le mot de passe, les fichiers sont illisibles, <b>y compris pour toi</b>. Il n\'existe aucune récupération : note-le ailleurs.' },
    'data.backups': { t: 'Sauvegardes', d: 'Chaque jour, l\'état de tes données au premier enregistrement de la journée est copié dans un dossier <b>backups</b> (30 jours conservés). Pour revenir en arrière après une fausse manipulation : Importer, puis choisis le fichier du jour voulu.', a: 'donnees' },
    'data.external': { t: 'Copie externe', d: 'Le geste le plus important de ta gestion. Choisis un dossier dans iCloud Drive ou OneDrive, sur une clé USB ou un disque réseau : à chaque enregistrement, tes données et leurs sauvegardes y sont recopiées. Si ton ordinateur tombe en panne demain, ta comptabilité existe ailleurs.' },
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
    'ed.withholding': { t: 'Retenue à la source', d: 'Une partie du montant que ton client garde et verse directement au fisc à ta place. Tu ne reçois donc que le « net à payer ». Ce n\'est pas une perte : tu récupères cette somme sur ton impôt, à condition d\'avoir <b>l\'attestation de retenue</b> que ton client doit te remettre. Le taux se choisit dans la liste ; s\'il n\'y figure pas, <b>« Autre taux… »</b> te laisse le saisir, et il rejoint ensuite tes propositions. <em>À VÉRIFIER avec ton comptable : le taux qui s\'applique à ta prestation et la base de calcul.</em>' },
    'ed.depositAmount': { t: 'Acompte en montant', d: 'Un acompte se négocie souvent en dinars (« 5 000 à la commande ») plutôt qu\'en pourcentage. Saisis le montant TTC que tu veux encaisser : SkanFact le convertit en pourcentage du devis, parce que c\'est ainsi que la facture de solde saura quoi déduire. Le total réellement obtenu s\'affiche juste en dessous — il peut différer de quelques millimes à cause des arrondis de TVA et du timbre fiscal.', a: 'acompte' },
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
    'ed.preview': { t: 'Aperçu', d: 'Exactement ce que ton client recevra. Il se met à jour pendant que tu tapes. Le compteur indique le nombre de pages : si le document dépasse d\'un peu, les marges se resserrent toutes seules pour le ramener sur une page — mais seulement quand ça en fait vraiment gagner une.<br><br>Au-delà, le document est découpé en <b>vraies pages A4</b> : chacune porte le pied de page avec tes mentions légales et son numéro (« page 2 sur 3 »), les pages suivantes rappellent en tête le document et le client, et l\'en-tête des colonnes revient sur chaque page qui porte des lignes. Une facture de trente lignes se lit donc comme celle d\'un grand logiciel.<br><br>Cette colonne montre la page à la moitié de sa taille : pour <b>lire</b> le document, clique <b>Agrandir</b> (ou <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>A</kbd>) — il s\'ouvre sur toute la fenêtre, avec un zoom. Le bouton <b>Aperçu</b>, à côté, masque la colonne quand tu veux saisir sur toute la largeur.' },
    'ed.issue': { t: 'Émettre', d: 'Le moment où le document devient officiel : il reçoit son numéro définitif et n\'est plus modifiable. C\'est une règle comptable, pas un caprice du logiciel : une facture émise ne se corrige que par un <b>avoir</b>.', a: 'facture' },
    'ed.locked': { t: 'Document verrouillé', d: 'Cette facture est émise : son numéro est définitif et son contenu ne bouge plus. Pour corriger une erreur, crée un avoir (total ou partiel). Tant qu\'aucun paiement ni avoir n\'existe, un déverrouillage de secours reste possible dans le menu « Plus ».', a: 'facture' },
    'ed.payments': { t: 'Paiements', d: 'Enregistre chaque encaissement avec sa date, son montant et son mode. Plusieurs paiements partiels sont possibles. C\'est ce qui fait vivre ton « reste à encaisser », tes relances et ton délai moyen de paiement.' },
    'ed.credit': { t: 'Avoir', d: 'Le document qui annule tout ou partie d\'une facture déjà émise : erreur de montant, prestation non rendue, geste commercial. Il porte son propre numéro (AVO-…) et se déduit de ton chiffre d\'affaires.', a: 'avoir' },
    'ed.tropPercu': { t: 'Trop-perçu', d: 'Ton client a versé plus que ce que cette facture lui demande — le plus souvent parce qu\'un avoir a suivi son paiement. Cette somme <b>lui appartient</b> : rends-la-lui, ou déduis-la de sa prochaine facture. SkanFact n\'enregistre pas encore un remboursement rattaché à la facture : note la sortie d\'argent dans Trésorerie, et le trop-perçu restera affiché ici. À VÉRIFIER avec ton comptable pour l\'écriture du remboursement.', a: 'avoir' },
    'ed.deposit': { t: 'Facture d\'acompte', d: 'Une facture d\'un pourcentage du devis, émise avant de commencer le travail. Elle sécurise ta trésorerie sur les gros chantiers. La facture de solde déduira automatiquement ce qui a déjà été facturé.' },
    'ed.settle': { t: 'Facture de solde', d: 'La facture finale d\'un projet : elle reprend toutes les lignes du devis et retranche les acomptes déjà facturés. Ton client voit le détail complet et ne paie que ce qui reste.' },
    'ed.convert': { t: 'Convertir en facture', d: 'Crée un brouillon de facture reprenant le devis à l\'identique, et marque le devis « accepté ». Rien n\'est définitif tant que tu n\'as pas cliqué sur « Émettre ».' },
    'ed.template': { t: 'Modèles de documents', d: 'Une prestation type que tu vends souvent, enregistrée avec ses lignes, son objet et ses notes. Un nouveau devis identique se crée alors en deux clics.' },
    'ed.recurring': { t: 'Rendre récurrent', d: 'Transforme cette facture en contrat : SkanFact te proposera automatiquement la même facture chaque mois, trimestre ou année.' },
    // — listes et pages —
    'list.filters': { t: 'Filtres', d: 'La recherche porte sur le numéro, le nom du client et l\'objet. Combine-la avec le statut pour retrouver, par exemple, toutes les factures en retard d\'un client. Dès qu\'un filtre est actif, le nombre de lignes retenues s\'affiche à droite avec un bouton « Réinitialiser les filtres ». Sur une grande liste, l\'année en cours est présélectionnée : c\'est indiqué à côté des filtres, et le bouton Réinitialiser te rend l\'historique complet. Passe sur « Toutes les années » pour chercher un document ancien.' },
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
    'autres.livraison': { a: 'pieces', t: 'Bon de livraison', d: 'La pièce qui accompagne la marchandise et se fait signer à la réception. C\'est ta preuve d\'avoir livré : sans elle, un client de mauvaise foi peut contester. Par défaut les prix y sont masqués. C\'est ce bon qui <b>sort les articles du stock</b> : une facture tirée d\'un bon de livraison ne les sort donc pas une seconde fois.' },
    'autres.contrat': { t: 'Contrat de prestation', d: 'Le vrai document que ton client signe : objet, durée, reconduction, préavis, conditions de paiement, confidentialité, litiges. À ne pas confondre avec les <b>contrats récurrents</b> de la barre latérale, qui ne font que fabriquer des brouillons de facture chaque mois. Les deux vont ensemble : on signe le contrat, puis on crée le contrat récurrent qui le facture.' },
    'tre.accounts': { t: 'Comptes de trésorerie', d: 'Ton compte bancaire, ta caisse espèces, et autant d\'autres que nécessaire. Chacun a son solde de départ et son solde courant. C\'est la seule chose que tu saisis : tout le reste — encaissements clients, règlements fournisseurs — remonte automatiquement de ce que tu as déjà enregistré.' },
    'tre.kind': { t: 'Type de compte', d: '<b>Compte bancaire</b> pour un compte courant, <b>Caisse</b> pour l\'argent liquide que tu gardes au bureau. La distinction sert à la lecture : une caisse ne se rapproche pas d\'un relevé.' },
    'tre.opening': { t: 'Solde de départ', d: 'Le solde du compte le jour où tu commences à le suivre dans SkanFact — recopie-le de ton relevé. Tout ce que tu saisis après s\'y ajoute. Si tu te trompes, tout le reste sera décalé du même montant : c\'est le seul chiffre à vérifier deux fois.' },
    'tre.openingDate': { t: 'Date du solde de départ', d: 'Le jour auquel correspond ce solde. Les mouvements antérieurs à cette date ne sont pas comptés : ils sont déjà dedans.' },
    'tre.default': { t: 'Compte par défaut', d: 'Le compte sur lequel tombent les paiements pour lesquels tu n\'as rien précisé — et tous ceux saisis avant que tu aies un deuxième compte. Il en faut toujours un : si tu décoches celui-ci, un autre le devient.' },
    'treso.compteDuPaiement': { t: 'Compte', d: 'Le compte de trésorerie sur lequel cet argent tombe vraiment. Un règlement en espèces n\'arrive pas sur ton compte bancaire : si tu ne le dis pas ici, ton rapprochement ne tombera jamais juste. Le champ n\'apparaît qu\'à partir de deux comptes ; avec un seul, il n\'y a pas de choix à faire.' },
    'tre.total': { t: 'Disponible aujourd\'hui', d: 'La somme des soldes de tous tes comptes, calculée à partir de leur solde de départ et de tous les mouvements enregistrés depuis. C\'est ce que tu as <b>vraiment</b>, pas ce qu\'on te doit.' },
    'tre.projected': { t: 'Solde projeté', d: 'Ce qu\'il restera dans 30 jours si toutes les échéances connues tombent à leur date : les factures clients ouvertes rentrent, les achats à régler sortent. Aucune estimation, aucune moyenne — uniquement ce qui est déjà engagé.' },
    'tre.shortfall': { t: 'Trou de trésorerie', d: 'La date à laquelle ton solde passerait sous zéro si rien ne bouge. C\'est <b>l\'alerte la plus importante de l\'application</b> : une entreprise rentable peut mourir d\'un trou de trésorerie. Un trou anticipé se négocie avec la banque ou avec un fournisseur ; un trou constaté se subit.' },
    'tre.forecast': { t: 'Horizon de prévision', d: '30 jours pour le pilotage au quotidien, 90 jours pour voir venir. Au-delà, il y a trop d\'inconnu pour que le chiffre veuille dire quelque chose.' },
    'tre.curve': { t: 'Courbe du solde', d: 'Chaque point est une échéance : facture qui rentre, achat qui sort, facture de contrat récurrent. La ligne pointillée rouge est le zéro. Si la courbe passe dessous, la date du creux est signalée en haut de la page.' },
    'tre.events': { t: 'Le détail des échéances', d: 'Toutes les échéances de la période, dans l\'ordre, avec le solde après chacune. Clique une ligne pour ouvrir la pièce. Les factures et achats <b>déjà échus</b> sont ramenés à aujourd\'hui : se dire qu\'ils rentreront « à leur date » quand cette date est passée, c\'est se mentir.' },
    'tre.moves': { t: 'Mouvements', d: 'Tout ce qui est entré et sorti de tes comptes sur l\'exercice choisi, quelle que soit l\'origine. Les encaissements viennent des factures, les règlements des achats : ils se modifient sur la pièce d\'origine (bouton ✎ à côté du paiement), y compris leur compte. Seuls les <b>mouvements libres</b> (salaires, impôts, apports, frais bancaires) se saisissent et se modifient ici.' },
    'tre.moveKind': { t: 'Nature du mouvement', d: 'Elle donne le sens : les natures marquées ↓ sortent de ton compte, celles marquées ↑ y entrent. Tu saisis toujours un montant positif, SkanFact applique le signe — impossible de se tromper.' },
    'tre.reco': { t: 'Rapprochement bancaire', d: 'Comparer ce que dit ta banque avec ce que dit SkanFact. Tu coches les mouvements que tu retrouves sur ton relevé ; ce qui reste décoché est soit en cours de traitement, soit oublié, soit une erreur de saisie. À faire une fois par mois, c\'est ce qui garantit que tes chiffres sont vrais.' },
    'tre.gap': { t: 'Écart avec le relevé', d: 'Le solde pointé (départ + mouvements cochés) doit tomber exactement sur le solde de ton relevé. S\'il y a un écart, c\'est qu\'une opération manque d\'un côté ou de l\'autre : un prélèvement non saisi, un chèque compté deux fois, un montant mal recopié.' },
    'tre.pending': { t: 'Pas encore pointés', d: 'Les mouvements que SkanFact connaît et que tu n\'as pas encore retrouvés sur ton relevé. Un chèque mis à l\'encaissement met quelques jours : c\'est normal qu\'il reste ici. Un mouvement qui traîne depuis des semaines, en revanche, mérite un coup d\'œil.<br><br>Coché par erreur ? Le bandeau <b>« Annuler »</b> le rend tout de suite, et le panneau <b>« Déjà pointés »</b>, juste en dessous, permet de le décocher même des semaines plus tard.' },
    'mg.projects': { t: 'Affaires', d: 'Une affaire, c\'est un chantier, un projet, un client suivi dans le temps : tu y rattaches les devis, les factures <b>et</b> les achats qui le concernent. C\'est le seul endroit de l\'application où la marge est <b>exacte</b>, parce qu\'elle compare ce que tu as réellement facturé à ce que tu as réellement payé. Ailleurs, le coût est estimé à partir du catalogue.' },
    'mg.analysis': { t: 'Où est la marge', d: 'La même année de ventes, vue par client ou par prestation. On y découvre souvent que le plus gros client n\'est pas le plus rentable, et qu\'une prestation qu\'on croyait secondaire rapporte plus que le reste. Le coût vient du <b>coût de revient</b> saisi au catalogue : sans lui, la marge affichée est celle du prix de vente, donc fausse.' },
    'mg.total': { t: 'Marge totale', d: 'Ce qui reste du chiffre d\'affaires une fois retiré le coût de ce que tu as vendu. Ce n\'est <b>pas</b> ton bénéfice : il faut encore payer le loyer, les abonnements, les salaires et l\'impôt. Le bénéfice se lit sur l\'onglet « Seuil de rentabilité » et, en fin d\'année, dans le bilan de ton comptable.' },
    'rec.what': { t: 'Contrats récurrents de ce client', d: 'Les abonnements, maintenances et forfaits que tu factures à ce client à intervalle régulier. SkanFact prépare le <b>brouillon</b> de facture à chaque échéance — il ne l\'envoie jamais tout seul. Clique une ligne pour ouvrir le contrat : ses lignes, sa prochaine échéance, et les factures qu\'il a déjà produites.', a: 'facture' },
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
    'soc.due': { t: 'Déclarations à déposer', d: 'Les déclarations sociales dont l\'échéance approche ou est passée. <b>SkanFact ne dépose rien</b> et ne se connecte à aucune administration : il prépare le tableau et te rappelle la date. « Marquer déposée » sert uniquement à faire taire le rappel une fois que tu l\'as fait. <em>À VÉRIFIER avec ton comptable : les dates et les modalités de dépôt.</em>' },
    'soc.cnss': { t: 'Déclaration CNSS trimestrielle', d: 'Le tableau à recopier ou à envoyer : un salarié par ligne, avec son assiette, la part retenue sur son salaire, la part à ta charge et l\'accident du travail. <b>Le total est ce que tu dois verser à la CNSS</b>, les deux parts confondues. Échéance usuelle : le 15 du mois suivant la fin du trimestre — <em>à VÉRIFIER.</em>', a: 'declarations' },
    'soc.annual': { t: 'Déclaration annuelle d\'employeur', d: 'Le récapitulatif de ce que tu as versé et retenu dans l\'année. Attention : elle porte sur <b>deux choses distinctes</b> qu\'on confond souvent — les salaires de tes employés d\'une part, et les retenues à la source que tu as pratiquées sur des <b>fournisseurs</b> (honoraires, loyers) d\'autre part. Les deux figurent sur le même formulaire.' },
    'soc.held': { t: 'Retenues sur fournisseurs', d: 'Quand tu paies un prestataire soumis à retenue à la source, tu gardes une part et tu la reverses au Trésor à sa place. Tu dois lui en remettre une <b>attestation</b>, sinon il ne peut pas la déduire de son propre impôt — et il te la réclamera. Les attestations manquantes sont signalées ici et dans « À faire ».' },
    'hr.leaveKind': { t: 'Nature de l\'absence', d: '<b>Congé payé</b> entame le compteur annuel sans réduire le salaire. <b>Arrêt maladie</b>, <b>maternité</b> et <b>autorisation</b> ne réduisent pas le salaire non plus et n\'entament pas le compteur. <b>Sans solde</b> et <b>injustifiée</b> réduisent le brut au prorata des jours. <em>À VÉRIFIER avec ton comptable : le traitement d\'un arrêt maladie dépend de sa durée et de la prise en charge CNSS.</em>' },
    'hr.paid': { t: 'Effet sur le salaire', d: 'Chaque nature d\'absence a son comportement habituel, mais tu peux le forcer au cas par cas : une autorisation exceptionnelle retenue sur salaire, un arrêt maladie maintenu en totalité. Laisse « selon la nature » dans le doute.' },
    'hr.balance': { t: 'Compteur de congés', d: 'Les jours <b>acquis</b> se calculent au prorata des mois travaillés dans l\'année : un salarié arrivé en juillet n\'a pas droit à une année entière. On en retire les congés payés <b>pris</b> — les arrêts maladie et les absences sans solde n\'entament pas ce compteur. Un solde négatif n\'est pas interdit, mais il faut le savoir.' },
    'hr.perYear': { t: 'Congés payés par an', d: 'Le droit annuel en jours ouvrables. Le code du travail tunisien fixe un minimum, et la convention collective de ton secteur prévoit souvent davantage. <em>À VÉRIFIER avec ton comptable : c\'est la convention qui s\'applique, pas le minimum légal, dès qu\'elle est plus favorable.</em>' },
    'hr.advance': { t: 'Avance sur salaire', d: 'Une somme prêtée au salarié, remboursée par retenues sur ses prochains bulletins. La retenue se pose toute seule mois après mois jusqu\'à extinction, et la dernière échéance ne prend que ce qui reste. Ce qui est remboursé se lit sur les bulletins eux-mêmes, pas sur un compteur à part : supprimer une avance ne défait donc pas les retenues déjà passées.' },
    'hr.monthly': { t: 'Retenue mensuelle', d: 'Ce qui sera retiré de chaque bulletin jusqu\'au remboursement. Reste raisonnable : une retenue trop lourde met le salarié en difficulté et finit par se retourner contre toi. <em>À VÉRIFIER : la loi encadre la part du salaire qui peut être retenue ou saisie.</em>' },
    'hr.register': { t: 'Registre du personnel', d: 'La liste que l\'inspection du travail peut demander : qui a travaillé chez toi, à quel poste, sous quel contrat, entre quelles dates. Les salariés partis y figurent aussi — c\'est le but. <em>À VÉRIFIER : la forme exacte du registre et son mode de tenue relèvent du code du travail.</em>' },
    'hr.doc': { t: 'Documents du personnel', d: 'L\'<b>attestation de travail</b> prouve qu\'une personne travaille chez toi aujourd\'hui : banque, bailleur, administration la demandent. Le <b>certificat de travail</b> se remet à la fin du contrat et n\'indique que les dates et l\'emploi — rien d\'autre, c\'est la règle. Le <b>solde de tout compte</b> récapitule ce qui reste dû au départ. <em>À VÉRIFIER : les indemnités de fin de contrat dépendent du motif de la rupture et de la convention collective.</em>' },
    'hr.withSalary': { t: 'Mentionner le salaire', d: 'Une attestation destinée à une banque ou à un bailleur doit souvent porter le salaire ; une attestation simple n\'a pas à le faire. Par défaut, SkanFact ne l\'écrit pas : c\'est une information personnelle du salarié.' },
    'pay.employees': { t: 'Salariés', d: 'La fiche de chaque personne que tu emploies : identité, matricule CNSS, type de contrat, salaire brut mensuel, situation familiale. C\'est à partir d\'elle que les bulletins se calculent — et c\'est elle qu\'il faut tenir à jour quand un salaire change ou qu\'un enfant naît.' },
    'pay.cnss': { t: 'Matricule CNSS du salarié', d: 'Le numéro d\'affiliation du salarié à la Caisse nationale de sécurité sociale. Il figure sur son bulletin et sur les déclarations trimestrielles. Si le salarié n\'en a pas encore, c\'est à toi de l\'affilier — <em>à VÉRIFIER avec ton comptable, l\'affiliation a un délai légal.</em>' },
    'pay.cnssEmployerId': { t: 'Matricule CNSS employeur', d: 'Ton numéro d\'affiliation en tant qu\'employeur. Il s\'imprime sur les bulletins de paie. Tu ne l\'as que si tu as déjà déclaré au moins un salarié.' },
    'pay.contract': { t: 'Type de contrat', d: '<b>CDI</b> sans durée fixée, <b>CDD</b> pour une durée déterminée, <b>SIVP</b> et <b>Karama</b> pour les dispositifs d\'aide à l\'emploi des jeunes diplômés, qui ont leurs propres règles de cotisation. <em>À VÉRIFIER avec ton comptable : SIVP et Karama peuvent être exonérés de certaines charges, ce que SkanFact ne devine pas — ajuste alors les taux du bulletin.</em>' },
    'pay.endDate': { t: 'Date de sortie', d: 'Le jour où le salarié quitte l\'entreprise. Une fois renseignée, il ne remonte plus dans les bulletins à établir, mais son historique reste intact. <b>On ne supprime jamais un salarié qui a été payé</b> : on renseigne sa sortie.' },
    'pay.gross': { t: 'Salaire brut', d: 'Le salaire <b>avant</b> toute retenue : c\'est ce qui figure au contrat, pas ce que le salarié touche. Les cotisations et l\'impôt s\'en déduisent pour donner le net ; les charges patronales s\'y ajoutent pour donner ce que ça te coûte.' },
    'pay.family': { t: 'Chef de famille', d: 'Statut fiscal qui donne droit à une déduction annuelle sur le revenu imposable. En Tunisie il concerne généralement l\'époux, ou le parent qui a la charge des enfants. <em>À VÉRIFIER avec ton comptable : les conditions exactes et le montant de la déduction.</em>' },
    'pay.children': { t: 'Enfants à charge', d: 'Chaque enfant à charge donne droit à une déduction annuelle supplémentaire, dans la limite d\'un nombre fixé par la loi. Le montant et la limite se règlent dans l\'onglet Barèmes. <em>À VÉRIFIER avec ton comptable.</em>' },
    'pay.workedDays': { t: 'Jours ouvrables du mois', d: 'La base servant à calculer une absence au prorata. Vingt-six jours correspond à la semaine de six jours couramment retenue en Tunisie ; mets-en vingt-deux si tu es sur cinq jours. Cela ne change rien tant qu\'il n\'y a aucune absence.' },
    'pay.absent': { t: 'Jours d\'absence non payés', d: 'Absence sans solde, au prorata des jours ouvrables : deux jours sur vingt-six retirent deux vingt-sixièmes du brut. Ne compte pas ici les congés payés ni les arrêts maladie indemnisés — ils ne réduisent pas le salaire. <em>À VÉRIFIER avec ton comptable.</em>' },
    'pay.bonus': { t: 'Primes et indemnités', d: 'Ce qui s\'ajoute au salaire ce mois-ci : prime de rendement, treizième mois, indemnité de transport. Une prime <b>imposable</b> entre dans l\'assiette des cotisations et de l\'impôt ; une prime non imposable (panier, transport, dans certaines limites) n\'y entre pas. <em>À VÉRIFIER avec ton comptable : ce qui est exonéré et jusqu\'à quel montant.</em>' },
    'pay.deduction': { t: 'Retenues', d: 'Ce qui se retire du net après calcul : avance sur salaire, prêt remboursé, saisie sur salaire. Ces retenues ne touchent ni les cotisations ni l\'impôt — elles ne font que réduire ce que le salarié reçoit.' },
    'pay.irpp': { t: 'Impôt sur le revenu (IRPP)', d: 'Retenu à la source sur chaque bulletin, et reversé par toi au Trésor. Il se calcule sur un revenu <b>annuel</b> imposable — salaire moins cotisations, moins frais professionnels, moins déductions familiales — auquel s\'applique un barème progressif ; le résultat est divisé par douze. <em>À VÉRIFIER avec ton comptable : le barème change à chaque loi de finances.</em>' },
    'pay.employerCost': { t: 'Coût pour l\'employeur', d: 'Ce qu\'un salarié coûte réellement : le brut <b>plus</b> les charges patronales. C\'est ce chiffre — pas le net, pas même le brut — qui entre dans ton résultat et dans ton seuil de rentabilité. Un salarié à 1 500 DT brut coûte facilement 1 760 DT.' },
    'pay.cnssTotal': { t: 'CNSS à reverser', d: 'La somme des parts salarié (retenues sur les bulletins) et employeur (à ta charge), plus l\'accident du travail. Elle se déclare et se paie trimestriellement à la CNSS. <em>À VÉRIFIER avec ton comptable : dates et modalités de dépôt.</em>' },
    'pay.rates': { t: 'Barèmes', d: '<b>Aucun taux n\'est écrit en dur dans SkanFact.</b> Tout ce que tu vois sur cette page sert au calcul, et rien d\'autre. Les valeurs livrées sont celles couramment appliquées en Tunisie au moment où cette version a été écrite — elles changent à chaque loi de finances. Corrige-les ici dès qu\'un taux bouge : les bulletins déjà établis gardent leur propre calcul et ne sont pas réécrits.' },
    'pay.cnssEmployee': { t: 'CNSS part salarié', d: 'Le pourcentage du brut retenu sur le bulletin du salarié. Régime général non agricole en Tunisie : 9,18 % — <em>à VÉRIFIER avec ton comptable, le taux dépend du régime.</em>' },
    'pay.cnssEmployerRate': { t: 'CNSS part employeur', d: 'Le pourcentage du brut à ta charge, en plus du salaire. Régime général non agricole : 16,57 % — <em>à VÉRIFIER avec ton comptable.</em> C\'est la principale raison pour laquelle un salarié coûte bien plus que son brut.' },
    'pay.accident': { t: 'Accident du travail', d: 'Cotisation patronale dont le taux dépend du risque de ton activité : quelques dixièmes de pour cent pour un bureau, bien davantage pour un chantier. <em>À VÉRIFIER avec ton comptable : le taux qui s\'applique à ton secteur.</em>' },
    'pay.solidarity': { t: 'Contribution sociale de solidarité', d: 'Un prélèvement qui s\'ajoute à l\'impôt sur le revenu, exprimé en points sur la même base imposable. <em>À VÉRIFIER avec ton comptable : son taux et son existence dépendent de la loi de finances en vigueur.</em>' },
    'pay.pro': { t: 'Frais professionnels', d: 'Un abattement forfaitaire appliqué au salaire avant l\'impôt, censé couvrir les frais liés au travail. En Tunisie : 10 % du salaire après cotisations, plafonné à un montant annuel. <em>À VÉRIFIER avec ton comptable.</em>' },
    'pay.proCap': { t: 'Plafond des frais professionnels', d: 'Le montant annuel maximum de l\'abattement, quel que soit le salaire. Au-delà d\'un certain brut, l\'abattement ne suit donc plus. <em>À VÉRIFIER avec ton comptable.</em>' },
    'pay.brackets': { t: 'Barème progressif', d: 'L\'impôt se calcule par tranches : chaque tranche n\'est taxée qu\'à son taux, et seulement sur la part du revenu qui la traverse. Gagner un dinar de plus ne fait donc jamais perdre d\'argent. La dernière tranche doit rester ouverte (« au-delà ») : c\'est elle qui s\'applique aux revenus les plus élevés. <em>À VÉRIFIER avec ton comptable : les tranches changent à chaque loi de finances.</em>' },
    'pay.paid': { t: 'Payé le', d: 'La date à laquelle tu as réellement versé le net. Renseignée, elle fait apparaître la sortie d\'argent dans ta trésorerie, toute seule. <b>Ne saisis alors pas en plus un mouvement libre « Salaires »</b> : il compterait deux fois, et SkanFact te le signalera dans « À faire ».' },
    'ocr.photo': { t: 'Lire une photo', d: 'Photographier la facture du fournisseur au lieu de la saisir. Ce bouton n\'apparaît que si tu as activé la lecture dans les Paramètres : l\'image part alors sur internet, revient lue, et SkanFact te propose un formulaire à valider — rien n\'entre dans tes données sans toi. Pour simplement <b>joindre</b> la photo ou le PDF comme justificatif, c\'est « Joindre un justificatif… », hors ligne et sans rien envoyer.' },
    'ocr.key': { t: 'Lecture de factures', d: 'La seule fonction de SkanFact qui envoie une de tes pièces sur Internet, et elle est <b>désactivée par défaut</b>. Une fois activée, seule l\'<b>image</b> de la facture est envoyée, au moment où tu cliques : ni tes clients, ni tes chiffres, ni ta comptabilité. La clé reste sur cet ordinateur, dans un fichier à part, jamais dans tes données ni tes sauvegardes. Chaque lecture coûte quelques centimes, facturés par le fournisseur de la clé.' },
    'ocr.model': { t: 'Modèle de lecture', d: 'Le modèle d\'intelligence artificielle qui lit l\'image. Celui proposé par défaut lit bien les photos de factures ; ne le change que si ton fournisseur de clé t\'indique autre chose.' },
    'ocr.supplier': { t: 'Fournisseur reconnu', d: 'SkanFact compare ce qu\'il a lu à tes fournisseurs existants — par matricule fiscal d\'abord, par nom ensuite. S\'il ne trouve personne, il te le dit et te propose de créer la fiche : <b>il ne crée jamais un fournisseur tout seul</b>, sinon ta liste se remplirait de doublons.' },
    'ser.serialized': { t: 'Suivi par numéro de série', d: 'Pour du matériel identifiable et garanti : un serveur, un ordinateur, un pare-feu. Chaque unité est alors suivie <b>nommément</b> — tu sais laquelle est chez quel client, depuis quand, et jusqu\'à quand elle est garantie. Inutile pour des consommables interchangeables : on ne suit pas des câbles un par un.' },
    'ser.warranty': { t: 'Durée de garantie', d: 'La durée annoncée par le constructeur ou celle que tu accordes toi-même. Elle court à partir de la <b>livraison</b>, pas de ton achat : c\'est la date qui compte pour le client. Choisis « Aucune » si le matériel n\'est pas garanti.' },
    'ser.inDate': { t: 'Date d\'entrée', d: 'Le jour où l\'unité est arrivée chez toi. Sert à savoir ce qui dort depuis longtemps en réserve, et à retrouver la facture d\'achat correspondante.' },
    'ser.outDate': { t: 'Date de sortie', d: 'Le jour où l\'unité est partie chez le client. C\'est elle qui fait démarrer la garantie. Vider cette date remet l\'unité en stock.' },
    'ser.status': { t: 'État de l\'unité', d: '<b>En stock</b> : chez toi, disponible. <b>Chez le client</b> : livrée, garantie en cours. <b>Retourné</b> : revenu chez toi, à examiner. <b>Hors service</b> : ni vendable ni réparable, mais on garde la trace.' },
    'ser.list': { t: 'Numéros de série', d: 'Toutes les unités que tu as suivies, en stock comme chez les clients. Tu saisis les numéros à l\'entrée (bouton « + Entrée de numéros », un numéro par ligne, collage accepté), et tu les attribues à la sortie depuis la facture ou le bon de livraison — menu « Plus ▾ » → « Numéros de série livrés ».' },
    'ser.gap': { t: 'Écart entre les numéros et le stock', d: 'Le stock compté en quantité et le stock compté en numéros doivent dire la même chose. Quand ils divergent, c\'est qu\'un numéro n\'a pas été saisi à l\'entrée, ou pas attribué à la sortie. Ce n\'est pas grave en soi — mais tant que l\'écart dure, tu ne peux pas répondre à « où est passée cette machine ? ».' },
    'ser.fleet': { t: 'Parc installé', d: 'Ce que ce client a chez lui, livré par toi, avec l\'état de sa garantie. C\'est la question qu\'on te posera au téléphone quand quelque chose tombera en panne — et c\'est aussi la liste de ce que tu pourras lui proposer de remplacer ou de couvrir par un contrat.' },
    'ser.ending': { t: 'Garanties qui se terminent', d: 'Une fin de garantie n\'est pas une mauvaise nouvelle : c\'est le moment naturel de proposer un contrat de maintenance, et le client n\'y pense presque jamais tout seul. Appeler deux mois avant vaut mieux qu\'expliquer après la panne que ce n\'est plus couvert.' },
    'stk.tracked': { t: 'Suivi en stock', d: 'À cocher pour de la <b>marchandise</b> : quelque chose qu\'on achète, qu\'on range, et qu\'on ressort à la vente. Pas pour une prestation — du conseil ou des heures de travail n\'ont pas de stock. Une fois coché, SkanFact compte tout seul à partir de tes achats et de tes ventes : tu n\'as plus rien à saisir.' },
    'stk.cogs': { t: 'Coût des marchandises vendues', d: 'Ce que t\'ont coûté les marchandises effectivement <b>sorties</b> du stock sur la période, valorisées au coût moyen pondéré. C\'est la vraie charge : acheter de la marchandise ne coûte rien tant qu\'elle est sur l\'étagère — c\'est de l\'argent transformé en stock, pas dépensé. La vendre, en revanche, coûte ce qu\'elle a coûté. C\'est ce que les comptables appellent la variation de stock.' },
    'immo.attente': { t: 'Ligne en immobilisation', d: 'Un bien qui sert plusieurs années ne se déduit pas d\'un coup : il s\'amortit. Tant que sa <b>fiche</b> n\'existe pas — famille, durée, date de mise en service — SkanFact ne sait pas sur combien d\'années l\'étaler, donc ce montant n\'est déduit <b>nulle part</b> : ni en charge, ni en amortissement. La TVA, elle, reste déductible dès l\'achat. Crée la fiche depuis Immobilisations → À créer. <em>À VÉRIFIER avec ton comptable : le seuil à partir duquel un achat s\'immobilise et la durée de chaque famille.</em>', a: 'immobilisations' },
    'stk.orphan': { t: 'Ligne « stock » sans article suivi', d: 'Pour qu\'un achat entre en stock, sa ligne doit être <b>rattachée</b> à un article du catalogue coché « Suivi en stock ». Tape le début de son nom dans la désignation : le catalogue se propose, et choisir suffit — inutile de recopier l\'orthographe exacte. Si l\'article n\'existe pas encore, la liste propose de le créer. Tant que la ligne n\'est rattachée à rien, la marchandise est bien achetée et sa TVA bien déductible, mais elle n\'apparaît nulle part dans le stock — et au moment de la vendre, le stock passera en négatif.' },
    'stk.initial': { t: 'Stock de départ', d: 'Ce que tu as en rayon aujourd\'hui, avant que SkanFact ne commence à compter. Compte-le une fois, saisis-le, et les achats et ventes s\'y ajouteront automatiquement. Si tu te trompes, tout le reste sera décalé de la même quantité.' },
    'stk.initialCost': { t: 'Coût unitaire du départ', d: 'Ce que t\'a coûté, en moyenne, une unité de ce stock de départ. Il sert de base au coût moyen pondéré. Dans le doute, reprends le prix de ta dernière facture d\'achat.' },
    'stk.min': { t: 'Seuil d\'alerte', d: 'La quantité en dessous de laquelle il faut recommander. Mets-y de quoi tenir le temps que ton fournisseur livre : si une commande met deux semaines et que tu en vends deux par semaine, le seuil est de quatre. En dessous, l\'article remonte dans les alertes.' },
    'stk.value': { t: 'Valeur du stock', d: 'Ce que ta marchandise t\'a coûté, au coût moyen pondéré — pas ce qu\'elle rapportera vendue. C\'est le chiffre qu\'attend ton comptable à la clôture, et c\'est de l\'argent immobilisé : du stock, c\'est de la trésorerie qui dort sur une étagère.' },
    'stk.cmp': { t: 'Coût moyen pondéré', d: 'À chaque entrée, le coût unitaire moyen est recalculé sur l\'ensemble du stock. Si tu as 5 disques à 200 DT et que tu en achètes 10 à 230, le coût moyen devient 220 DT. Les sorties partent à ce coût-là, et ne le changent pas. <em>À VÉRIFIER avec ton comptable : la méthode de valorisation retenue pour tes comptes annuels.</em>', a: 'stock' },
    'stk.negative': { t: 'Stock négatif', d: 'Tu as vendu plus que tu n\'as acheté : c\'est physiquement impossible, donc il manque une entrée. Un achat non saisi, une quantité mal recopiée, ou un stock de départ oublié. <b>Corrige la pièce en cause plutôt que d\'ajuster</b> — un ajustement cacherait l\'erreur sans la réparer, et fausserait ta TVA déductible.' },
    'stk.state': { t: 'État du stock', d: 'Ce que SkanFact déduit de tes pièces : aucune saisie de ta part. Une ligne d\'achat en destination « stock » fait une entrée, une facture ou un bon de livraison fait une sortie. Les brouillons, devis, proformas et bons de commande ne bougent rien : rien n\'a encore quitté l\'entrepôt.' },
    'stk.moves': { t: 'Mouvements', d: 'Le détail de tout ce qui est entré et sorti sur l\'exercice choisi, avec le stock restant après chaque ligne. Clique une ligne pour ouvrir la pièce d\'origine. Une facture tirée d\'un bon de livraison ne sort rien une seconde fois : c\'est le bon de livraison qui fait foi.' },
    'stk.moveKind': { t: 'Nature du mouvement', d: '<b>Casse ou perte</b> pour de la marchandise abîmée, volée ou offerte. <b>Inventaire</b> pour aligner le stock sur un comptage. <b>Ajustement</b> pour le reste. Les entrées d\'achat et les sorties de vente ne se saisissent jamais ici : elles remontent toutes seules.' },
    'stk.adjustQty': { t: 'Quantité du mouvement', d: 'Négative pour sortir de la marchandise (−2 pour deux disques cassés), positive pour en faire rentrer. SkanFact t\'annonce le stock obtenu avant d\'enregistrer.' },
    'stk.inventory': { t: 'Inventaire physique', d: 'Compter ce qu\'il y a vraiment en rayon et le comparer à ce que dit l\'application. À faire au moins une fois par an, à la clôture — c\'est une obligation comptable. Un écart n\'est pas une faute : c\'est de la casse non déclarée, une sortie oubliée ou une erreur de saisie. L\'important est de le voir et de le tracer.' },
    'stk.alerts': { t: 'Alertes de stock', d: 'D\'abord l\'impossible — les stocks négatifs, qui signalent une pièce manquante — puis ce qui est en rupture ou sous le seuil. Un stock négatif se corrige en retrouvant l\'achat oublié, pas en ajustant.' },
    'immo.class': { t: 'Famille du bien', d: 'Elle sert à proposer une durée d\'amortissement usuelle et à regrouper tes biens dans le tableau. Change la durée si ton comptable en retient une autre : c\'est lui qui décide, la famille n\'impose rien. <em>À VÉRIFIER avec ton comptable.</em>' },
    'immo.date': { t: 'Mise en service', d: 'Le jour où le bien a commencé à servir — pas forcément celui de la facture. C\'est cette date qui déclenche l\'amortissement, et la première année n\'est amortie qu\'au prorata du temps d\'utilisation.' },
    'immo.amount': { t: 'Valeur d\'acquisition HT', d: 'Le prix payé hors taxes, frais d\'installation et de transport compris s\'ils étaient nécessaires pour que le bien fonctionne. La TVA n\'en fait pas partie : elle se récupère à part, dans ta déclaration. <em>À VÉRIFIER avec ton comptable : ce qui entre dans la valeur d\'acquisition.</em>' },
    'immo.years': { t: 'Durée d\'amortissement', d: 'Le nombre d\'années sur lesquelles tu étales la déduction. Trois ans pour un ordinateur, cinq pour un véhicule, dix pour du mobilier — ce sont des usages, pas des règles absolues, et l\'administration peut avoir son avis. <em>À VÉRIFIER avec ton comptable.</em>' },
    'immo.residual': { t: 'Valeur résiduelle', d: 'Ce que le bien vaudra encore à la fin de la durée, si tu comptes le revendre. On n\'amortit que la différence. Laisse zéro dans le doute : c\'est le cas le plus courant, et le plus simple.' },
    'immo.gross': { t: 'Valeur d\'acquisition totale', d: 'La somme des prix d\'achat de tous les biens encore à l\'actif à la fin de l\'exercice. Elle ne bouge pas avec le temps : c\'est l\'amortissement cumulé qui grandit en face.' },
    'immo.annuity': { t: 'Dotation de l\'exercice', d: 'La part de tes immobilisations que tu déduis cette année. C\'est une <b>charge</b> — elle est déjà retirée du résultat simplifié et comptée dans tes charges fixes au seuil de rentabilité — mais c\'est une charge qui ne sort pas d\'argent de ta banque : tu as payé le bien une fois, tu le déduis en plusieurs fois.' },
    'immo.nbv': { t: 'Valeur nette comptable', d: 'Ce que le bien vaut encore dans tes comptes : valeur d\'achat moins tout ce qui a déjà été amorti. Ce n\'est pas sa valeur de revente — un ordinateur amorti à zéro peut encore se vendre, et une voiture peut valoir moins que sa VNC. C\'est elle qu\'on compare au prix obtenu le jour où tu le sors.', a: 'immobilisations' },
    'immo.table': { t: 'Tableau des amortissements', d: 'Le document que ton comptable te demandera à chaque clôture : un bien par ligne, avec sa valeur, ce qui était déjà amorti au 1er janvier, la dotation de l\'année et ce qu\'il en reste au 31 décembre. Le bouton « Exporter (CSV) » le lui envoie tel quel.' },
    'immo.waiting': { t: 'À immobiliser', d: 'Les lignes d\'achat que tu as marquées « immobilisation » et qui n\'ont pas encore de fiche. SkanFact ne les crée pas tout seul : la durée d\'amortissement est une décision. Tant qu\'une ligne reste ici, elle n\'est déduite <b>nulle part</b> — ni en charge, ni en amortissement.' },
    'immo.disposal': { t: 'Sortie du patrimoine', d: 'Un bien vendu, mis au rebut ou volé quitte l\'actif. On l\'amortit jusqu\'au jour de la sortie, puis on compare le prix obtenu à sa valeur nette comptable : au-dessus c\'est une plus-value, en dessous une moins-value. <em>À VÉRIFIER avec ton comptable : une plus-value de cession est en principe imposable.</em>' },
    'immo.disposalPrice': { t: 'Prix de cession HT', d: 'Ce que tu as réellement obtenu, hors taxes. Zéro pour un bien mis au rebut ou volé : la totalité de la valeur nette comptable part alors en moins-value.' },
    'immo.plan': { t: 'Plan d\'amortissement', d: 'Le détail année par année, de la mise en service à la fin de la durée. La première et la dernière année sont partielles, au prorata des jours : c\'est pour ça qu\'un bien amorti sur trois ans apparaît sur quatre exercices. La dernière annuité absorbe les arrondis pour que la valeur nette comptable tombe exactement à zéro.' },
    'data.dossiers': { t: 'Dossiers', d: 'Un dossier = une entreprise. Chacun a ses clients, ses documents, ses achats, sa numérotation et ses sauvegardes, et ils ne se mélangent jamais. Utile quand une même personne gère deux sociétés : tu passes de l\'une à l\'autre en un clic, l\'application se recharge sur le bon dossier. Retirer un dossier de la liste ne supprime pas ses fichiers.<br><br>Tu n\'as pas besoin de revenir ici pour changer d\'entreprise : <b>clique sur le nom en haut de la barre de gauche</b>, la liste s\'ouvre là. Le nom du dossier suit celui de ta société tant que tu ne l\'as pas renommé toi-même.' },
    'data.shared': { t: 'Partager à deux', d: '<b>Partager ce dossier</b> prend l\'entreprise que tu as sous les yeux — avec tout ce qu\'elle contient — et la pose dans iCloud Drive, OneDrive, un disque réseau ou une clé USB. <b>Rejoindre</b> sert sur le second ordinateur : il ouvre ce dossier-là, sans rien créer. Les deux postes l\'ouvrent ensuite tour à tour. SkanFact <b>ne laisse jamais l\'un écraser le travail de l\'autre</b> : si vous avez modifié tous les deux, il fusionne pièce par pièce et te dit ce qui a changé. Le seul cas qu\'il ne peut pas trancher est deux factures émises en même temps sous le même numéro : il t\'alerte, à vous de corriger. Lis l\'article « Travailler à deux » avant de vous lancer.' },
    'data.device': { t: 'Nom de ce poste', d: 'Il sert à te dire qui a enregistré en dernier sur un dossier partagé (« les modifications du PC du bureau ont été reprises »). Il part aussi dans le signal de présence que l\'application envoie à SkanFact toutes les quatre heures, avec la version et le système — jamais une pièce, un client ni un montant. Choisis un nom qui ne te gêne pas, comme « PC du bureau ».' },
    'compta.buyJournal': { t: 'Journal des achats', d: 'La liste chronologique de tout ce que tu as acheté sur la période — factures fournisseurs et dépenses. C\'est le symétrique exact du journal des ventes, et la seconde moitié de ce que ton comptable attend chaque mois.' },
    'compta.deductible': { t: 'TVA déductible', d: 'La part de la TVA payée à tes fournisseurs que tu as le droit de récupérer. Elle vient en déduction de la TVA que tu as facturée à tes clients : tu ne reverses que la différence. Si un chiffre est en gras, c\'est qu\'une partie de la TVA payée n\'est pas récupérable (case décochée sur la ligne d\'achat).' },
    'compta.buyNet': { t: 'Total réglé ou dû', d: 'Le net à payer de toutes les pièces de la période, que tu les aies déjà réglées ou non. Pour savoir ce qui reste à sortir de ton compte, regarde le panneau « À payer » de la page Achats.' },
    'compta.decaissements': { t: 'Règlements fournisseurs', d: 'L\'argent <b>réellement sorti</b> sur la période, règlement par règlement — le jumeau des « Encaissements » de l\'onglet Ventes. À ne pas confondre avec le journal juste au-dessus : celui-là liste les <b>factures</b> reçues (à leur date de facture), celui-ci les <b>paiements</b> (à leur date de paiement). Une facture de janvier réglée en mars apparaît donc dans le journal de janvier et dans les règlements de mars. Chaque ligne ouvre sa pièce, et l\'export est exactement le fichier <code>reglements-fournisseurs.csv</code> que ton comptable reçoit dans le paquet du mois.', a: 'compta' },
    'compta.byCategory': { t: 'Où part ton argent', d: 'Tes achats regroupés par catégorie de charge, du plus gros au plus petit. C\'est le classement le plus utile de toute la comptabilité : il montre en dix secondes ce qui pèse vraiment, et c\'est souvent une surprise.' },
    'compta.vatReturn': { t: 'Déclaration de TVA', d: 'La soustraction centrale : <b>TVA collectée</b> sur tes ventes moins <b>TVA déductible</b> sur tes achats. Si le résultat est positif, tu reverses la différence à l\'État ; s\'il est négatif, tu as un <b>crédit de TVA</b> qui se reporte sur la période suivante. Ce calcul est l\'arithmétique exacte de tes données, <em>pas une déclaration officielle : à faire valider par ton comptable avant tout dépôt.</em>' },
    'compta.carry': { t: 'Crédit de TVA reporté', d: 'Le crédit de la période précédente, repris automatiquement. Un mois où tu achètes beaucoup (du stock, du matériel) génère souvent plus de TVA déductible que collectée : la différence n\'est pas perdue, elle vient en déduction des mois suivants.' },
    'compta.carryIn': { t: 'Crédit venu de l\'année précédente', d: 'Si ta dernière déclaration de l\'année passée se terminait par un crédit de TVA, saisis-le ici : il viendra en déduction de janvier. SkanFact ne peut pas le deviner s\'il n\'a pas les données de l\'année précédente.' },
    'compta.vatMonths': { t: 'Mois par mois', d: 'Chaque mois de l\'année avec sa collectée, sa déductible, le crédit repris du mois d\'avant et ce qu\'il restait à payer. Le total en bas n\'est pas la somme des lignes : un crédit reporté ne se compte qu\'une fois.' },
    'compta.result': { t: 'Résultat simplifié', d: 'Tes ventes hors taxes moins tes charges hors taxes. Les achats partis en stock ou en immobilisation n\'y sont pas comptés : ils ne sont pas consommés. <em>Ce n\'est pas ton résultat comptable</em> — il manque les amortissements, la variation de stock, les salaires et les provisions. C\'est un ordre de grandeur pour savoir où tu en es entre deux bilans.' },
    'compta.fiscal': { t: 'Calendrier fiscal', d: 'Un pense-bête des déclarations qui reviennent, que tu règles toi-même : active celles qui te concernent et ajuste le jour limite. Les échéances proches remontent aussi dans « À faire » sur l\'accueil. <em>À VÉRIFIER avec ton comptable :</em> les dates, la périodicité et les déclarations applicables dépendent de ta forme juridique, de ton régime et de la présence de salariés.<br><br><b>« Marquer déposée »</b> pointe UNE échéance, pas la règle : la TVA d\'octobre cesse de crier, celle de novembre reste réclamée. Tu peux annuler tout de suite si tu t\'es trompé. SkanFact ne dépose rien et ne se connecte à aucune administration — c\'est un pense-bête, pas un accusé de réception.' },
    'cab.appaire': { t: 'Appairer ton cabinet', d: 'Ton comptable exporte depuis SkanFact Cabinet un petit fichier d\'appairage qui contient sa <b>clé publique</b>. Tu l\'importes ici, une fois. À partir de là, chaque paquet mensuel est chiffré <b>pour lui</b> : lui seul peut l\'ouvrir, et tu n\'as aucun mot de passe à inventer, à transmettre ni à retenir. Le fichier ne contient rien de secret : une clé publique ne permet que de chiffrer à destination de quelqu\'un, jamais de lire ce qu\'il reçoit.' },
    'cab.empreinte': { t: 'Empreinte de la clé', d: 'Vingt caractères calculés à partir de la clé de ton cabinet. <b>Lis-les-lui au téléphone la première fois</b> et demande-lui s\'ils correspondent aux siens. C\'est la seule façon d\'être sûr que la clé que tu as reçue est bien la sienne, et pas celle de quelqu\'un qui se serait glissé entre vous. Cinq minutes une fois pour toutes.' },
    'cab.pourcabinet': { t: 'Chiffré pour ton cabinet', d: 'Le paquet est verrouillé avec la clé de ton comptable : lui seul peut l\'ouvrir, même si le fichier traîne dans une boîte mail ou sur une clé USB perdue. Chaque paquet utilise une clé de chiffrement différente, si bien que deux envois du même mois ne produisent jamais deux fichiers identiques. Le nom de ton entreprise et le mois restent lisibles sans déchiffrer, pour qu\'un paquet mal rangé reste identifiable.' },
    'cab.paquet': { t: 'Le paquet du mois', d: 'Un seul fichier qui contient tout ce que ton comptable attend pour ce mois : les journaux en CSV (ventes, achats, encaissements, règlements, trésorerie), la TVA, le PDF de chaque facture et avoir émis, les justificatifs d\'achat que tu as joints, les bulletins de paie, et la déclaration CNSS si le trimestre se termine ce mois-là. Plus une page de garde qui résume le mois et dit ce qui manque. Le fichier s\'ouvre avec n\'importe quel outil de décompression : ton comptable n\'a rien à installer.' },
    'cab.manques': { t: 'Ce qui manque', d: 'Les points que ton comptable te réclamerait : une facture restée en brouillon, un achat sans justificatif (il ne pourra pas en récupérer la TVA), un mouvement non pointé, un bulletin manquant, une attestation de retenue non remise. <b>Ils n\'empêchent pas l\'envoi</b> : ils sont écrits sur la page de garde, pour qu\'il sache quoi te demander. Un dossier dont on connaît les trous vaut mieux qu\'un dossier qu\'on croit complet.' },
    'cab.envoyer': { t: 'Fabriquer le paquet', d: 'La fabrication prend quelques dizaines de secondes : chaque facture est redessinée en PDF, un par un. Le fichier est ensuite enregistré là où tu veux, puis tu peux l\'envoyer par mail depuis l\'app. Si un justificatif a disparu du disque, le paquet part quand même sans lui et le manifeste dit lequel manque — un fichier introuvable ne doit pas bloquer tout un envoi.' },
    'cab.motdepasse': { t: 'Protéger par mot de passe', d: 'Le paquet contient tes factures, tes achats et tes bulletins de paie : des informations qu\'on ne laisse pas traîner dans une boîte mail. Avec un mot de passe, le contenu est chiffré (AES-256) et illisible sans lui. <b>Transmets-le par un autre canal que le fichier</b> — par téléphone, pas dans le même message. L\'entête du paquet reste lisible sans le mot de passe (ton nom et le mois), pour que ton comptable sache de quoi il s\'agit avant de l\'ouvrir.' },
    'cab.historique': { t: 'Ce qui a déjà été envoyé', d: 'Chaque paquet fabriqué, avec sa date, son état (définitif si le mois était clôturé, provisoire sinon) et son <b>empreinte</b>. L\'empreinte est la carte d\'identité du fichier : si ton comptable calcule la même, le paquet qu\'il a reçu est exactement celui que tu as envoyé, à l\'octet près. C\'est ce qui permet de prouver que rien n\'a été modifié en route.' },
    'cab.questions': { a: 'cabinet', t: 'Les questions de ton comptable', d: 'Quand ton comptable révise ton mois, il tombe sur des choses qu\'il ne peut pas deviner : un justificatif absent, un virement sans facture, un compte d\'attente qui ne se solde pas. Il t\'envoie alors un fichier <code>.skanask</code>, et chaque question vient se poser <b>en face de la pièce qu\'elle vise</b> — tu la vois en ouvrant la facture, pas dans une liste que personne n\'ouvre. <b>Aucun de tes chiffres ne change :</b> une question est une demande, jamais une écriture — ton comptable n\'écrit rien chez toi. Tes réponses repartent toutes seules <b>dans ton prochain paquet</b> : il n\'y a rien d\'autre à envoyer. Une question restée sans réponse après deux paquets remonte en rouge : tant qu\'elle est en l\'air, ton comptable ne peut pas arrêter ton mois.' },
    'lic.etat': { t: 'Ta licence', d: 'SkanFact se vend, donc il y a une licence — mais elle est faite pour ne jamais te gêner. <b>Hors ligne :</b> la clé est vérifiée sur ton ordinateur, et l\'application fonctionne sans internet. Elle n\'est présentée qu\'aux services de SkanFact — les mises à jour, et la vérification qu\'elle n\'a pas été révoquée —, jamais à un tiers. <b>Aucune donnée en otage :</b> même expirée, tu peux lire, imprimer, exporter tes documents et envoyer le paquet à ton comptable — seule la création de nouvelles pièces attend le renouvellement. Si ton comptable utilise SkanFact Cabinet et t\'a remis son fichier d\'appairage, son empreinte part avec ta demande et te donne droit à la remise de parrainage.' },
    'ecr.rs': { a: 'achats', t: 'Opérée ou subie ?', d: 'Deux mots voisins pour deux choses opposées. <b>Opérée</b> : tu as retenu une part du montant en payant un fournisseur (honoraires, loyer) — cette somme, tu la dois au Trésor à sa place, et tu remets une attestation au fournisseur. <b>Subie</b> : un client a retenu une part de TA facture — cette somme, tu la récupères sur ton impôt, à condition qu\'il te remette son attestation. <em>À VÉRIFIER avec ton comptable : les taux et les cas où la retenue s\'applique.</em>' },
    'pay.tfp': { t: 'TFP et FOPROLOS', d: 'Deux taxes <b>patronales</b> sur la masse salariale, en plus de la CNSS : la <b>taxe de formation professionnelle</b> (2 % en général, 1 % pour les industries manufacturières) et le <b>FOPROLOS</b> (1 %, fonds de promotion du logement pour les salariés). Elles se déclarent chaque mois avec la TVA, n\'apparaissent jamais sur le net du salarié, et entrent dans le coût employeur. <em>À VÉRIFIER avec ton comptable : les taux et ton secteur.</em>', a: 'paie' },
    'pay.foprolos': { t: 'FOPROLOS', d: 'Le fonds de promotion du logement pour les salariés : 1 % de la masse salariale, à la charge de l\'employeur, déclaré chaque mois. <em>À VÉRIFIER avec ton comptable.</em>', a: 'paie' },
    'tre.etat': { t: 'État de rapprochement', d: 'La présentation classique, celle que ton comptable joint au dossier : on part du solde du <b>relevé</b>, on ajoute les encaissements que tu as enregistrés et que la banque n\'a pas encore crédités, on retire les paiements que tu as enregistrés et qu\'elle n\'a pas encore débités — et l\'on doit retomber sur le solde de SkanFact. S\'il reste un écart, une pièce manque d\'un côté. Il se remplit à partir du solde de relevé saisi au-dessus et des mouvements pointés en dessous.', a: 'tresorerie' },
    'etats.quoi': { t: 'États financiers', d: 'Le <b>bilan</b> (ce que l\'entreprise possède et ce qu\'elle doit, à une date) et l\'<b>état de résultat</b> (ce qu\'elle a gagné et dépensé sur l\'exercice), déduits de la balance. C\'est une présentation d\'ensemble, pas la liasse fiscale : celle-ci suit un modèle officiel (NCT 01) que ton comptable établit à partir de ces chiffres, avec les retraitements qu\'il juge nécessaires. Ce qui est garanti ici : actif = passif, et le résultat du bilan est celui de l\'état de résultat. <em>À VÉRIFIER avec ton comptable.</em>', a: 'compta' },
    'etats.bilan': { t: 'Le bilan', d: 'À gauche, l\'<b>actif</b> : les immobilisations (valeur brute moins amortissements), les stocks, ce que les clients te doivent, la trésorerie. À droite, le <b>passif</b> : les capitaux propres et résultats reportés, ce que tu dois aux fournisseurs, à l\'État, au personnel, aux associés, et le résultat de l\'exercice. Les deux totaux sont égaux par construction — c\'est la partie double, vue de loin.', a: 'compta' },
    'etats.resultat': { t: 'L\'état de résultat', d: 'Les produits (classe 7 : ventes, prestations, cessions) moins les charges (classe 6 : achats, services, salaires et charges sociales, taxes, dotations aux amortissements). Le résultat est positif quand c\'est un bénéfice. La dotation aux amortissements de l\'exercice en cours ne s\'écrit qu\'au 31 décembre : jusque-là, le « résultat simplifié » de l\'onglet TVA la compte, celui-ci pas encore — la page le dit.', a: 'compta' },
    'ecr.an': { t: 'À-nouveaux', d: 'La pièce du 1er janvier qui rouvre l\'exercice : chaque compte de bilan (banque, clients, fournisseurs, TVA, immobilisations, capitaux…) repart avec son solde de la veille, et le net des charges et produits de tout ce qui précède est porté au compte de résultat des exercices antérieurs. C\'est ainsi que les charges et les produits repartent de zéro. Elle est déduite de tes écritures, jamais saisie.', a: 'compta' },
    'ecr.numero': { t: 'Le numéro dans le livre-journal', d: 'Chaque pièce porte un numéro <b>continu</b> dans l\'exercice : 1, 2, 3… sans trou. C\'est ce que le livre-journal coté et paraphé exige, et ce que ton comptable appelle « l\'écriture dans le journal ». Les écritures étant déduites de tes pièces, le numéro l\'est aussi : une facture datée en arrière dans un mois <b>ouvert</b> décale les numéros suivants. C\'est exactement pour ça qu\'on <b>clôture</b> les mois envoyés : sur un mois clos, plus rien ne bouge, donc plus aucun numéro.', a: 'compta' },
    'ecr.od': { t: 'Opération diverse', d: 'La seule écriture que tu écris toi-même. Tout ce qui a une facture, un achat, un règlement ou un bulletin produit déjà ses écritures ; l\'opération diverse sert au reste — un loyer sans facture, une charge avancée par le gérant, une régularisation demandée par ton comptable. Une ligne au débit, une ligne au crédit (ou plus), pour le même total : tant que l\'écriture ne tombe pas juste, elle ne s\'enregistre pas. Le numéro de pièce (OD-2026-001…) est pris à l\'enregistrement. <em>À VÉRIFIER avec ton comptable</em> pour le choix des comptes — il te dictera souvent l\'écriture entière.', a: 'compta' },
    'ecr.central': { t: 'Journal centralisateur', d: 'Le récapitulatif mensuel : pour chaque mois de l\'exercice et chaque journal (ventes, achats, banque, caisse, paie, opérations diverses, à-nouveaux), le total au débit et au crédit et le nombre de pièces. C\'est ce que reprend le livre-journal coté et paraphé au tribunal, et le premier contrôle d\'ensemble : les deux totaux d\'une ligne sont toujours égaux.', a: 'compta' },
    'tre.compte': { t: 'Contrepartie comptable', d: 'Le compte que ce mouvement touche en face de la banque ou de la caisse, dans les écritures. La nature du mouvement décide par défaut : des frais bancaires vont au 627, un apport au compte courant d\'associé, un salaire au compte du personnel. Choisis un compte précis quand la nature ne suffit pas : la TVA du mois réglée en « impôt » va au <b>4365 TVA à payer</b>, pas à l\'acompte provisionnel. « À ventiler » (471) laisse ton comptable trancher — c\'est ce que fait un cabinet devant un mouvement qu\'il ne sait pas ranger.', a: 'compta' },
    'bal.lettrage': { t: 'Lettrage', d: 'Rapprocher chaque règlement de sa facture, pour savoir ce qui reste ouvert. Dans SkanFact les paiements sont déjà rattachés à leurs pièces : le lettrage n\'est donc pas une saisie, c\'est une lecture. Une facture soldée et ses règlements portent la même <b>lettre</b> — son numéro — dans le livre-journal et le grand livre ; ce qui reste ouvert est listé tiers par tiers, avec son reste. Le total des restes clients doit être le solde du compte Clients : c\'est le contrôle que ton comptable fait avant de clôturer.', a: 'compta' },
    'gl.quoi': { t: 'Grand livre', d: 'Le « mouvement de compte » que ton comptable demande : pour chaque compte (Clients, Banque, Ventes, TVA collectée…), la liste de tout ce qui l\'a touché sur la période, dans l\'ordre, avec le solde qui avance ligne après ligne. Là où la page Écritures range par pièce, le grand livre range par compte — c\'est ainsi qu\'on répond à « combien me doit ce client ? » ou « qu\'est-ce qui est passé sur la banque en mai ? ». Choisis un compte, ou tape un début de numéro : « 4 » donne tous les tiers. <em>À VÉRIFIER avec ton comptable :</em> les numéros de compte sont ceux du plan réglé dans SkanFact.', a: 'compta' },
    'gl.solde': { t: 'Le solde qui avance', d: 'Chaque ligne ajoute son débit et retire son crédit au solde de la ligne d\'avant. En tête, le <b>solde d\'ouverture</b> reprend tout ce qui précède la période : pour les comptes de bilan (clients, fournisseurs, banque, TVA, immobilisations), depuis toujours ; pour les charges et les produits, depuis le 1er janvier seulement — ils repartent de zéro à chaque exercice, et ce qu\'ils portaient avant est reporté au compte de résultat. Un solde positif est débiteur, un solde négatif est créditeur.', a: 'compta' },
    'bal.quoi': { t: 'La balance', d: 'Tous les comptes sur une seule page, avec pour chacun le solde à l\'ouverture de la période, les mouvements au débit et au crédit, et le solde à la fin. C\'est le <b>premier document</b> qu\'un cabinet tire pour contrôler un dossier : si les trois paires de totaux (ouverture, mouvements, soldes) sont égales, la comptabilité tient debout ; sinon il manque quelque chose. Le grand livre donne ensuite le détail d\'un compte qui surprend.', a: 'compta' },
    'bal.aux': { t: 'Balance auxiliaire', d: 'La même chose, mais tiers par tiers : ce que chaque client te devait à l\'ouverture, ce que tu lui as facturé, ce qu\'il a payé, ce qu\'il te doit encore — et le symétrique pour chaque fournisseur. Le total de la balance auxiliaire clients doit être égal au compte Clients de la balance générale. Avec les <b>sous-comptes par tiers</b> (411001, 411002…) activés dans le plan de comptes, chaque ligne porte son numéro, comme dans le logiciel de ton comptable.', a: 'compta' },
    'plan.aux': { t: 'Un sous-compte par tiers', d: 'Tous les cabinets tiennent leurs clients et leurs fournisseurs en sous-comptes : 411001 pour le premier client, 411002 pour le deuxième, 401001 pour le premier fournisseur… C\'est ce qui rend possible une balance auxiliaire et un lettrage. Le code d\'un tiers est <b>figé sur sa fiche</b> la première fois qu\'il est calculé : supprimer un client ne renumérote jamais les autres, sinon le 411004 de ton comptable désignerait quelqu\'un d\'autre le mois suivant. Décocher revient au compte collectif (411, 401) sans rien perdre.', a: 'compta' },
    'ecr.quoi': { t: 'Écritures comptables', d: 'Tes pièces traduites dans la langue de ton comptable : chaque facture, chaque achat, chaque règlement et chaque bulletin devient un jeu d\'écritures en <b>partie double</b> — autant au débit qu\'au crédit. C\'est exactement ce qu\'il retape aujourd\'hui à la main dans son logiciel ; ici, c\'est un fichier qu\'il importe. Le contrôle affiché en haut vérifie que chaque pièce tombe juste : sinon son logiciel refuserait le fichier. <b>Les numéros de compte ne sont pas une vérité :</b> ceux proposés suivent l\'usage du plan comptable tunisien, mais chaque cabinet a les siens. Demande-lui les bons et modifie-les dans « Plan de comptes ». <em>À VÉRIFIER avec ton comptable.</em>', a: 'compta' },
    'lic.offre': { t: 'Ton offre', d: 'La clé porte l\'offre choisie à l\'achat, et un client ne peut pas se la changer. <b>Indépendant</b> : devis, factures, relances, contrats récurrents, TVA, dossier du comptable. <b>Entreprise</b> : tout, plus Achats, Stock, Immobilisations, Trésorerie et marges, Paie, et le dossier partagé à deux. En Indépendant, ces modules restent <b>lisibles</b> — ce qui y existe déjà est à toi — seule la création de nouvelles pièces y attend l\'offre Entreprise. Pendant l\'essai, tout est ouvert.', a: 'licence' },
    'lic.empreinteCle': { t: 'L\'empreinte de ta clé', d: 'Une suite de 32 caractères <b>calculée à partir de ta clé</b>. Ce n\'est pas la clé : on ne peut pas remonter de l\'empreinte à la clé, et la montrer ne donne rien à personne. Elle sert à <b>parler d\'une licence sans la donner</b> : c\'est elle qu\'on colle sur <b>skanfact.tn/verifier</b> pour savoir si une licence est valable, expirée ou révoquée, et c\'est elle qu\'on cite en écrivant au support. La clé, elle, ne se colle nulle part sur internet : elle reste sur ton ordinateur.', a: 'licence' },
    'lic.editeur': { t: 'Tes clés de signature', d: 'Ce panneau n\'existe que sur l\'ordinateur de l\'éditeur de SkanFact. La clé <b>privée</b> signe les licences vendues : elle reste ici, hors des données, des sauvegardes et du paquet du comptable, et une copie mise à l\'abri est la seule assurance contre un disque qui lâche. La clé <b>publique</b> est embarquée dans l\'application de tout le monde pour reconnaître cette signature — elle n\'a rien de secret.', a: 'licence' },
    'lic.console': { t: 'Les ventes de la console', d: 'La console (api.skanfact.tn) vend : elle signe la clé, note la vente, envoie le mail au paiement. La <b>facture</b>, elle, vit ici, dans ta comptabilité. Ce bloc liste les ventes de la console qui n\'ont pas encore de facture : un clic crée un <b>brouillon</b> par vente — le numéro se prend à l\'émission, comme pour toute facture, et il est rendu à la console pour qu\'elle sache que c\'est fait. Une licence vendue par la console se renouvelle et se révoque <b>dans la console</b>, pas ici.', a: 'licence' },
    'lic.liste': { t: 'Les licences émises', d: 'Chaque licence vendue depuis cette application : à qui, quelle offre, jusqu\'à quand, et la facture qui l\'a portée. « À renouveler » se lit trente jours avant la fin, et remonte dans « À faire » sur l\'accueil. Renouveler crée une nouvelle clé et une nouvelle facture ; l\'ancienne clé reste valable jusqu\'à sa date.' },
    'lic.type': { t: 'Entreprise ou cabinet', d: 'Une licence d\'<b>entreprise</b> s\'installe dans SkanFact : elle porte une offre et le matricule fiscal du client. Une licence de <b>cabinet comptable</b> s\'installe dans SkanFact Cabinet : elle ne porte ni offre ni matricule, mais l\'<b>empreinte</b> du cabinet et un <b>quota de dossiers</b> hors SkanFact — on vend des dossiers, jamais des postes. Chaque application refuse la clé de l\'autre : le type les sépare.' },
    'lic.quota': { t: 'Les dossiers couverts', d: 'Combien de dossiers <b>hors SkanFact</b> cette licence autorise le cabinet à tenir, <b>en plus des trois gratuits</b>. Les dossiers de ses clients qui utilisent SkanFact ne comptent jamais, quel que soit leur nombre. Au-delà du quota, seule la <b>validation</b> d\'une écriture attend — lire, importer, saisir, exporter restent ouverts. Un cabinet de soixante clients dont cinquante sont sur SkanFact et dix ailleurs a besoin de sept dossiers.' },
    'lic.chgquota': { t: 'Changer le quota en cours de route', d: 'Le cabinet a pris des clients : on augmente le nombre de dossiers <b>sans repartir d\'une année pleine</b>. La date de fin ne bouge pas, et seule la différence de prix est facturée, au prorata des jours restants. Une clé neuve est signée — le quota est inscrit dedans, il ne se modifie pas à distance — et l\'ancienne continue de marcher jusqu\'à ce que le cabinet colle la nouvelle.' },
    'lic.client': { t: 'Le client de la licence', d: 'La clé est émise au nom de ce client et attachée à son <b>matricule fiscal</b> : elle ne s\'activera pas sur le dossier d\'une autre société. Renseigne le matricule sur sa fiche avant d\'émettre — sans matricule, la clé s\'active partout.' },
    'lic.duree': { t: 'La durée', d: 'Un mois de licence est un mois du calendrier : « 1 an » à partir d\'aujourd\'hui finit le même jour l\'an prochain. « À vie » ne porte aucune date de fin. « Jusqu\'à une date précise » sert à aligner une licence sur un exercice ou une fin de contrat.' },
    'lic.prestation': { t: 'La ligne de la facture', d: 'Facultatif : la prestation de ton catalogue qui décrit cette licence — son libellé et son prix HT remplissent la facture, et la marge se calcule comme pour toute vente. Sans prestation choisie, la ligne s\'écrit toute seule avec l\'offre et la durée, au prix saisi ci-dessous.' },
    'lic.prix': { t: 'Le prix HT', d: 'Ce que la facture réclamera, hors taxes. La TVA, le timbre fiscal et l\'éventuelle remise de parrainage s\'ajoutent sur la facture comme pour toute vente. Zéro est accepté : une licence offerte se facture quand même, à zéro, pour laisser une trace — le timbre reste coché sur le brouillon, à retirer si ton comptable le confirme (À VÉRIFIER : timbre dû sur une facture à zéro).' },
    'lic.parrain': { t: 'Le parrainage d\'un cabinet', d: 'Un client amené par un cabinet qui utilise SkanFact Cabinet a droit à une remise la <b>première année</b>, et le cabinet ne touche aucune commission. L\'empreinte du cabinet est gardée dans la clé, comme preuve ; la remise se pose sur la facture, en pourcentage. Au renouvellement, l\'empreinte reste et la remise repart à zéro : à toi de la remettre si tu l\'accordes encore.' },
    'lic.empreinte': { t: 'L\'empreinte du cabinet', d: 'Les vingt caractères que le comptable lit dans <b>SkanFact Cabinet → Réglages</b>, groupés par quatre (chiffres et lettres A à F seulement). C\'est la preuve du parrainage : elle voyage dans la clé de licence et reste attachée au client. <b>Vérifier</b> contrôle la forme — une empreinte mal recopiée ne désigne aucun cabinet, et la remise ne serait rattachable à personne — puis dit si ce cabinet a déjà parrainé quelqu\'un chez toi. Ce que SkanFact ne peut PAS vérifier d\'ici : que ce cabinet existe. Il faudrait sa clé publique, et tu ne l\'as pas. Pour la première licence d\'un cabinet inconnu, fais-toi relire l\'empreinte à voix haute.' },
    'lic.revoquer': { t: 'Révoquer une licence', d: 'À faire quand un client se rétracte ou qu\'on le rembourse. Trois choses se passent, et il faut les distinguer. <b>Dans tes livres</b> : la licence sort des actives et ne réclame plus de renouvellement, avec le motif et la date. <b>En comptabilité</b> : une facture émise se corrige par un <b>avoir</b>, jamais par une suppression — l\'application te le propose. <b>Chez le client</b> : la clé <b>continue de fonctionner</b> jusqu\'à sa date de fin. SkanFact vérifie les licences hors ligne, sans aucun serveur : c\'est ce qui permet à tes clients de travailler sans connexion et à l\'application de leur survivre, et c\'est pour ça que rien ne peut désactiver une clé à distance. Demande au client de la retirer.' },
    // Cette bulle portait « lic.offre » depuis la 8.2.0, c'est-à-dire la MÊME clé que celle qui
    // explique au client ce que son offre lui donne, vingt lignes plus haut. Un objet littéral ne
    // se plaint pas d'une clé en double : la seconde écrase la première en silence, et le test qui
    // exige que chaque clé posée dans l'interface existe ici passait — la clé existait, seul son
    // texte n'était plus le bon. Un client qui cliquait la bulle « Offre » de ses Paramètres lisait
    // donc une explication de facturation au prorata écrite pour l'éditeur. C'est le lint (9.1.0)
    // qui l'a vu, à sa première passe.
    'lic.chgoffre': { t: 'Changer d\'offre en cours de route', d: 'Passer d\'Indépendant à Entreprise sans repartir d\'une année pleine : <b>la date de fin ne bouge pas</b>, et seule la différence de prix est facturée, au prorata des jours restants. Une clé neuve est signée — l\'offre est inscrite à l\'intérieur, elle ne peut pas se modifier à distance — et l\'ancienne continue de marcher jusqu\'à ce que le client colle la nouvelle. Refaire payer une année entière au sixième mois est le meilleur moyen de faire refuser la montée en gamme.' },
    'lic.matricule': { t: 'Corriger le matricule d\'une clé', d: 'Le matricule fiscal voyage <b>dans</b> la clé signée : si le client corrige sa fiche société, ou si le matricule avait été mal saisi, sa clé est refusée du jour au lendemain — alors qu\'il a bien fait. On en signe une neuve avec le bon matricule, même offre, même date de fin, et <b>sans rien refacturer</b> : cette licence est déjà payée. La facture d\'origine reste attachée à la ligne remplacée.' },
    'clot.etat': { t: 'Période clôturée', d: 'La date jusqu\'à laquelle tout est figé. Aucune pièce datée avant elle ne peut plus être créée, modifiée ou supprimée — ni facture, ni achat, ni paiement, ni bulletin. C\'est cette promesse qui permet à ton comptable de travailler sur un dossier qui ne bouge plus dans son dos. Tant que rien n\'est clôturé, une saisie d\'aujourd\'hui peut changer la TVA d\'un mois déjà déclaré, sans que personne ne s\'en aperçoive.' },
    'clot.cloturer': { t: 'Clôturer un mois', d: 'À faire une fois que le mois est terminé et que tu as tout saisi : les factures émises, les achats reçus, les paiements, les bulletins. L\'application te montre d\'abord ce qui mériterait d\'être réglé (un brouillon oublié, un achat sans justificatif, un mouvement non pointé) — mais elle ne t\'empêche jamais de clôturer : ces points sont là pour que tu les voies. Les mois se clôturent dans l\'ordre, du plus ancien au plus récent. Le mois en cours ne se clôture pas : il lui reste des pièces à venir.' },
    'clot.rouvrir': { t: 'Rouvrir une période', d: 'Quand une pièce a été oubliée dans un mois déjà clôturé. Ce n\'est pas interdit, c\'est encadré : tu écris un motif, et la réouverture s\'inscrit dans le journal. <b>Préviens ton comptable</b> avant de le faire : les chiffres qu\'il a reçus vont changer, et s\'il a déjà déclaré la TVA du mois, une correction sera peut-être nécessaire. <em>À VÉRIFIER avec lui</em> selon ce qui a déjà été déposé.' },
    'clot.cabinet': { t: 'La clôture de ton comptable', d: 'Quand ton comptable a fini un exercice, il t\'envoie un fichier <code>.skanclose</code>. Il porte les <b>à-nouveaux officiels</b> — les soldes qui ouvrent l\'année suivante — et tes états financiers, lisibles dans n\'importe quel navigateur. Le reprendre <b>verrouille</b> l\'exercice chez toi : c\'est ce qui garantit que ton bilan et le sien disent la même chose. L\'application vérifie la <b>signature</b> du cabinet ; si elle manque, elle le dit en toutes lettres au lieu de faire comme si de rien n\'était — chiffrer dit « seul lui peut lire », seule une signature dit « ça vient de lui ».' },
    'clot.journal': { t: 'Journal des clôtures', d: 'Chaque clôture et chaque réouverture, avec sa date, le poste qui l\'a faite et le motif. C\'est la ligne qu\'on relit le jour où un chiffre a changé après un envoi : elle dit quand, qui et pourquoi. Rien ne s\'efface de ce journal.' },
    'cl.notes': { t: 'Notes internes', d: 'Ce qu\'il faut se rappeler et qui ne s\'imprime nulle part : l\'interlocuteur à appeler, les délais réels, les conditions négociées, la façon de travailler. Enregistré tout seul au fil de la frappe.' },
    'sup.terms': { t: 'Délai de paiement accordé', d: 'Le nombre de jours que ce fournisseur t\'accorde pour le régler. Il se reporte automatiquement sur l\'échéance de chaque achat que tu enregistres chez lui. Laisse vide si tu paies comptant.' },
    'sup.withholding': { t: 'Retenue à la source à opérer', d: 'Quand tu paies certains prestataires (comptable, avocat, consultant), la loi te demande de <b>retenir</b> un pourcentage et de le reverser toi-même au fisc. Tu paies moins au fournisseur, et tu lui remets une attestation. Qui doit retenir et à quel taux : <em>À VÉRIFIER avec ton comptable.</em> Laisse « Aucune » dans le doute — et si son taux n\'est pas dans la liste, « Autre taux… » te laisse le saisir.' },
    'sup.total': { t: 'Acheté HT', d: 'Le total hors taxes de tout ce que tu as acheté chez ce fournisseur depuis le début, toutes années confondues.' },
    'sup.due': { t: 'Reste à payer', d: 'Ce que tu dois encore à ce fournisseur, tous achats confondus. La part en retard est signalée : c\'est elle qui abîme une relation commerciale.' },
    'buy.payables': { t: 'À payer', d: 'Le pendant des relances, côté sortant : ce que tu dois, à qui, pour quand. Les pièces en retard sont en tête et signalées en orange. Clique sur le titre pour replier le panneau ; ton choix est conservé.' },
    'buy.head': { t: 'La pièce du fournisseur', d: 'Contrairement à tes propres factures, tu ne maîtrises ni le numéro ni la date : ce sont ceux écrits sur la facture que le fournisseur t\'a remise. Recopie-les tels quels, c\'est ce qui permettra à ton comptable de retrouver la pièce.' },
    'buy.supplier': { t: 'Fournisseur', d: 'Chez qui tu as acheté. Son délai de paiement et son taux de retenue se reportent automatiquement sur cet achat. « + Nouveau fournisseur » crée la fiche sans quitter la saisie.' },
    'buy.number': { t: 'Numéro de la facture', d: 'Le numéro écrit sur la facture du fournisseur, pas un numéro à toi. C\'est la référence que ton comptable utilisera. Pour une dépense sans facture (ticket de caisse, reçu), mets ce que tu as, ou laisse vide.' },
    'buy.kind': { t: 'La nature de la pièce', d: '<b>Facture d\'achat</b> : une vraie facture d\'un fournisseur, avec un numéro et de la TVA récupérable. <b>Dépense</b> : tout ce qui n\'a pas de facture détaillée — carburant, restaurant, frais bancaires, abonnement. <b>Avoir fournisseur</b> : ce que le fournisseur te rend — un retour, un rabais, une erreur de facturation ; saisis les montants en POSITIF, l\'application les compte en moins toute seule. <b>Acompte versé</b> : l\'argent payé d\'avance à la commande ; ce n\'est pas encore une charge, c\'est une avance qui se soldera le jour de la facture.' },
    'rv.date': { t: 'La date du relevé', d: 'Le relevé montre ce qui est encore ouvert À CETTE DATE. En la reculant, tu retrouves la situation telle qu\'elle était — utile quand un client conteste un envoi de la semaine dernière. Un règlement encaissé après cette date n\'y figure pas.' },
    'buy.lie': { t: 'La facture concernée', d: 'Rattache cet avoir ou cet acompte à la facture qu\'il diminue : le reste à payer de cette facture baisse d\'autant, et la comptabilité solde l\'avance toute seule. Tu peux laisser vide si la facture n\'est pas encore arrivée — « À faire » te le rappellera. Les deux pièces doivent être dans la même devise.' },
    'buy.date': { t: 'Date de la pièce', d: 'La date écrite sur la facture du fournisseur, pas la date du jour où tu la saisis. C\'est elle qui détermine le mois de déclaration de la TVA déductible.' },
    'buy.due': { t: 'Échéance de paiement', d: 'Quand tu dois payer. Elle se calcule à partir du délai accordé par le fournisseur, et se modifie librement. C\'est ce qui alimente le panneau « À payer » et les alertes de l\'accueil.' },
    'buy.category': { t: 'Catégorie de charge', d: 'À quoi sert cette dépense : loyer, carburant, sous-traitance, honoraires… Elle sert à savoir où part ton argent. Une liste de départ est fournie ; « + Nouvelle catégorie » en ajoute une qui restera proposée ensuite. Le rattachement comptable exact relève du plan comptable : <em>À VÉRIFIER avec ton comptable.</em>' },
    'buy.subject': { t: 'Objet', d: 'À quoi se rapporte cet achat, dans tes mots. « Disques durs pour la Clinique » vaut mieux que « matériel » : dans six mois, c\'est ce qui te permettra de retrouver la pièce et, plus tard, de calculer ta marge sur une affaire.' },
    'buy.lines': { t: 'Lignes de l\'achat', d: 'Recopie au minimum le total hors taxes et son taux de TVA : c\'est ce qui permet de récupérer la TVA. Détaille ligne par ligne quand la facture mélange plusieurs taux, plusieurs destinations, ou des articles que tu revendras.' },
    'buy.destination': { a: 'achats', t: 'Destination de la ligne', d: 'Ce que devient ce que tu achètes. <b>Charge</b> : consommé tout de suite (fournitures, loyer, carburant). <b>Stock</b> : marchandise achetée pour être revendue — elle sortira à la vente. <b>Immobilisation</b> : matériel qui reste dans l\'entreprise plus d\'un an (ordinateur, climatiseur, véhicule) et qui s\'amortit. Ce choix décide de ce qui se passe ensuite : une ligne <b>stock</b> entre en stock à la date de l\'achat et en sort à la vente ; une ligne <b>immobilisation</b> apparaît dans Immobilisations → À immobiliser et attend que tu fixes sa durée — tant qu\'elle attend, elle n\'est déduite nulle part.' },
    'buy.deductible': { t: 'TVA déductible', d: 'Coché par défaut : la TVA que tu as payée est récupérable sur ta déclaration. Décoche pour les cas où la loi l\'interdit — voiture de tourisme, cadeaux, frais de réception. Quels cas exactement : <em>À VÉRIFIER avec ton comptable.</em>' },
    'buy.fees': { t: 'Timbre et frais', d: 'Le timbre fiscal que ton fournisseur a facturé, et les frais annexes non soumis à TVA (port, assurance). Ils s\'ajoutent au total à payer mais ne donnent droit à aucune récupération de TVA.' },
    'buy.withholding': { t: 'Retenue à la source opérée', d: 'Le pourcentage que tu retiens en payant ce prestataire, et que tu reverses toi-même au fisc. Tu lui paies le net, et tu lui dois une attestation. Proposé automatiquement d\'après sa fiche fournisseur. Un taux absent de la liste se saisit avec « Autre taux… ». <em>À VÉRIFIER avec ton comptable.</em>' },
    'buy.currency': { t: 'Devise de la facture', d: 'La monnaie dans laquelle ton fournisseur a écrit sa facture. Une licence achetée en euros se saisit <strong>en euros</strong> : tu tapes ce qui est imprimé sur la pièce, sans rien convertir de tête. SkanFact convertit tout seul pour la TVA déductible, tes charges, ton stock et les écritures du comptable — et il t\'annonce le montant obtenu sous les totaux.', a: 'achats' },
    'buy.rate': { t: 'Taux de change', d: 'Combien vaut <strong>une unité</strong> de la devise de la facture en monnaie de ta comptabilité : 1 EUR = 3,4 TND, par exemple. Prends celui du jour de la facture (celui de ta banque ou de la BCT) — c\'est lui qui fera foi. <strong>Obligatoire</strong> dès que la devise diffère de la tienne : sans lui, toute ta comptabilité compterait 1 euro = 1 dinar, et rien à l\'écran ne le montrerait. <em>À VÉRIFIER avec ton comptable : quel cours retenir.</em>', a: 'achats' },
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
    'todo': { t: 'À faire', d: 'Tout ce que SkanFact a repéré dans tes données et qui demande une <b>décision de ta part</b> : de l\'argent à récupérer, une échéance qui approche, une pièce manquante, un chiffre qui ne colle pas. Rien n\'est saisi ici : chaque ligne est déduite de ce que tu as déjà enregistré, et disparaît d\'elle-même quand la chose est faite.<br><br>La liste est triée <b>du plus urgent au moins urgent</b>. Une ligne en rouge coûte de l\'argent ou une pénalité si tu ne fais rien ; en orange, elle peut attendre quelques jours. Seules les cinq premières sont affichées — « Voir les autres » déplie le reste.<br><br>Chaque ligne porte un bouton qui ouvre exactement les pièces concernées. Clique le titre « À faire » pour replier le panneau : il reste une ligne de résumé, et ton choix est gardé au prochain démarrage.', a: 'demarrer' },
    'ed.history': { t: 'Historique', d: 'Tout ce qui est arrivé à ce document : création, émission, envois par email, relances (email et téléphone), paiements reçus, avoirs. Sur un devis, les factures qui en sont tirées ; sur une facture, le devis d\'origine — chaque ligne est cliquable. Rien à saisir : c\'est reconstitué à partir de ce que tu as déjà enregistré.' },
    'rel.snooze': { t: 'Relances reportées', d: 'Quand un client t\'annonce une date de paiement, reporte la relance : la facture descend en bas de la liste jusqu\'à cette date. Elle reste comptée dans ton « reste à encaisser » — on ne cache jamais un impayé.' },
    'rel.quotes': { t: 'Devis sans réponse', d: 'Les devis envoyés il y a plus de dix jours dont le client n\'a rien dit. Un rappel poli ne dérange personne et débloque souvent une décision qui traînait.' },
    'compta.comptable': { t: 'Envoyer au comptable', d: 'Prépare un email pour ton comptable avec le journal des ventes de la période en pièce jointe (CSV lisible dans Excel). Tu relis le message et tu envoies. À faire une fois par mois, après avoir pointé tes encaissements.' },
    'cl.contact': { t: 'Personne à contacter', d: 'Le nom de ton interlocuteur chez ce client, avec sa fonction si tu veux. Il apparaît sur les documents sous la raison sociale : ta facture arrive directement sur le bon bureau au lieu de traîner à l\'accueil.' },
    'client.stampExempt': { t: 'Exonéré de timbre fiscal', d: 'Coche si ce client est exonéré du timbre fiscal (exportateur total, secteur public, régime particulier…). Le timbre sera <b>décoché d\'office</b> sur ses nouvelles factures ; tu peux toujours le remettre pièce par pièce, la case du timbre reste là. Les factures <b>déjà émises</b> ne bougent pas : leur timbre est gelé à l\'émission. <b>À VÉRIFIER avec ton comptable</b> — l\'exonération dépend du régime du client et de la nature de l\'opération, pas de son secteur seul.' },
    'cl.page': { t: 'Fiche client', d: 'Tout ce que tu sais de ce client : ce qu\'il t\'a rapporté, ce qu\'il te doit, son délai de paiement habituel, son taux d\'acceptation de devis et l\'historique de ses documents. Regarde-la avant de le rappeler ou de lui faire une remise.' },
    'cl.due': { t: 'Reste à payer', d: 'Le total des factures de ce client non soldées, avoirs et paiements partiels déduits. Un client dont ce chiffre grossit mois après mois mérite une discussion avant la prochaine commande.' },
    'list.sort': { t: 'Trier la liste', d: 'Les titres de colonne marqués « ⇅ » se cliquent pour trier, une deuxième fois pour inverser. Une flèche pleine montre la colonne qui commande le tri. Sur les listes de <b>devis</b> et de <b>factures</b>, le pied du tableau totalise toute la sélection, pas seulement la page affichée : combine avec les filtres pour obtenir, par exemple, le total facturé à un client sur une année.' },
    'list.page': { t: 'Pages', d: 'Les listes longues sont découpées en pages pour rester lisibles et rapides. « Lignes par page » garde ton choix d\'une fois sur l\'autre, sur cet ordinateur : 25, 50, 100, ou « Tout » pour tout afficher d\'un coup. Le compteur de gauche indique ce que tu vois et le total. Les totaux du tableau et les exports CSV portent toujours sur la sélection entière, jamais sur la seule page affichée.' },
    'cat.snippets': { t: 'Textes prédéfinis', d: 'Les paragraphes que tu réutilises : garantie, confidentialité, modalités d\'acompte. Un clic les insère dans les notes d\'un document.' }
  };

  // ---------- articles de la rubrique Aide ----------
  // { id, title, sub, body: HTML }
  const ARTICLES = [
    {
      id: 'demarrer', title: 'Démarrer : tes premiers pas', sub: 'Les sept étapes du panneau d\'accueil, expliquées',
      body: `
<p>SkanFact fonctionne entièrement sur ton ordinateur : tes documents, tes clients et tes chiffres n'en sortent pas, et personne d'autre ne les voit. Il ne se connecte à Internet que pour chercher ses mises à jour et vérifier ta licence — il envoie alors ta clé, le nom et le système de l'ordinateur, et sa version : jamais une donnée de ta gestion. En contrepartie, <b>c'est toi qui es responsable de tes sauvegardes</b> : on y revient plus bas.</p>
<p>Au tout premier démarrage, un assistant t'a demandé ta raison sociale, ton activité, ce dont tu as besoin et tes règles de facturation. <b>Il se rejoue</b>, prérempli avec tes réponses actuelles : le bouton « Revoir l'assistant de démarrage… » est en tête de <b>Paramètres → Mon entreprise</b>, et la recherche (<kbd>⌘</kbd> <kbd>K</kbd>) le trouve en tapant « assistant ». Le rejouer ne touche aucune de tes pièces.</p>
<p>L'accueil affiche un panneau <b>« Tes premiers pas »</b> tant que tout n'est pas fait. Chaque ligne y porte son bouton, et son état est <b>déduit de tes données</b> — rien à cocher soi-même. Voici ces sept étapes, dans l'ordre, avec ce qu'il faut savoir pour chacune.</p>
<h3>1. Compléter ta fiche société</h3>
<p><b>Paramètres → Mon entreprise</b>, au minimum : raison sociale, matricule fiscal, adresse, téléphone, email. Ces informations s'impriment en haut de chaque document — une facture sans matricule fiscal n'est pas conforme. Ajoute ton <b>RIB</b> dans le même écran, bloc <b>Coordonnées bancaires</b> : c'est ce que ton client copiera pour te virer l'argent, relis-le caractère par caractère. Et vérifie tes délais dans <b>Paramètres → Documents</b> : validité des devis et délai de paiement (30 jours est l'usage pour les deux) calculent les dates imprimées.</p>
<h3>2. Enregistrer ton premier client</h3>
<p>Tu n'es pas obligé de commencer par là : le sélecteur de client, dans le devis, porte un bouton <b>« + Nouveau client »</b>. Le matricule fiscal du client est utile dès qu'il s'agit d'une entreprise ; une retenue à la source propre à ce client se règle sur sa fiche, une fois pour toutes.</p>
<h3>3. Remplir ton catalogue</h3>
<p>Le catalogue sert à insérer une prestation dans un devis <b>en un clic</b>, sans retaper le libellé, le prix ni le taux de TVA. Si tu as choisi ton métier dans l'assistant, il t'en a déjà proposé quelques-unes : ajuste les prix.</p>
<h3>4. Faire ton premier devis</h3>
<p>Un devis annonce un prix avant de travailler. Il prend son numéro dès le premier enregistrement, et reste modifiable. Voir <a href="#/aide/devis">Le devis : proposer un prix</a>.</p>
<h3>5. L'envoyer à ton client</h3>
<p>Le bouton <b>Email</b> prépare le message avec le PDF joint, et fait passer le devis en « envoyé ». Si tu l'envoies autrement — WhatsApp, impression, main propre — l'application te demande après l'export si elle doit le marquer envoyé : réponds oui, sinon elle ne le relancera jamais et ne le comptera pas dans tes statistiques.</p>
<h3>6. Transformer un devis accepté en facture</h3>
<p>Quand le client dit oui, passe le devis en « accepté » : le bouton <b>Facturer ce devis</b> devient le bouton vert de l'écran, et il existe aussi sur chaque ligne de la liste. La facture reprend tout, sans ressaisie. Voir <a href="#/aide/facture">La facture : réclamer ton argent</a>.</p>
<h3>7. Mettre tes données à l'abri</h3>
<p><b>Paramètres → Données et sécurité → Choisir un dossier</b>, puis un dossier dans iCloud Drive (Mac), OneDrive (Windows) ou sur une clé USB. À chaque enregistrement, tout y est recopié. Fais-le maintenant, pas « plus tard » : c'est la seule étape dont l'oubli coûte tout. Le même écran liste tes sauvegardes et sait <b>revenir en arrière</b>.</p>
<h3>Explore avec l'exemple</h3>
<p>Sur l'accueil, le bouton <b>Voir un exemple rempli</b> charge treize mois d'activité fictive. Clique partout, casse tout, ça n'a aucune importance : <b>tes données sont mises de côté avant</b>, et un bandeau orange reste affiché sur chaque page tant que l'exemple est chargé.</p>
<p>Pour en sortir, ce même bandeau porte <b>Repartir de mes données</b> : il te rend exactement ce que tu avais. N'utilise pas « Tout effacer » pour ça — ce bouton-là efface pour de bon, il ne restaure rien.</p>
<h3>Et si tu veux revoir les questions du départ</h3>
<p>L'assistant se rejoue à tout moment : <b>Paramètres → Mon entreprise → Revoir l'assistant de démarrage…</b>. Tes réponses actuelles y sont déjà inscrites, et aucune de tes pièces n'est touchée.</p>`
    },
    {
      id: 'devis', title: 'Le devis : proposer un prix', sub: 'Comment il se prépare, s\'envoie et se transforme',
      body: `
<p class="small muted">Le <b>Catalogue</b> a trois onglets : <b>Prestations</b> (ce que tu vends, avec son prix), <b>Modèles de documents</b> (un devis type qu'on réutilise), <b>Textes prédéfinis</b> (les paragraphes qu'on recopie sans arrêt).</p>
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
<p>Règle le taux dans la fiche de chaque client : il s'appliquera à toutes ses factures. Les taux proposés (0,5 · 1 · 1,5 · 2,5 · 3 · 5 · 10 · 15 · 20 · 25 %) sont ceux qu'on rencontre le plus souvent ; ils dépendent de la nature de la prestation, du régime de ton client et de la loi de finances de l'année. Si celui qu'on t'applique n'est pas dans la liste, choisis <b>« Autre taux… »</b> et tape-le : il restera proposé ensuite. <em>À VÉRIFIER avec ton comptable : SkanFact ne devine aucun taux, il applique celui que tu poses.</em></p>`
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
<h3>Les neuf onglets</h3>
<p><b>Ventes</b> et <b>Achats</b> : les journaux de la période, à exporter ou à envoyer. <b>TVA à payer</b> : la soustraction du mois. <b>Écritures</b> : les mêmes pièces traduites en comptabilité, prêtes pour le logiciel de ton comptable. <b>Grand livre</b> : les mêmes écritures rangées par compte, avec le solde qui avance. <b>Balance</b> : tous les comptes sur une page, et les tiers un par un. <b>Calendrier fiscal</b> : ce qu'il faut déposer et quand. <b>Clôtures</b> : fermer un mois pour qu'il ne bouge plus. <b>Cabinet</b> : fabriquer et envoyer le paquet mensuel.</p>

<h3>Onglet TVA : la soustraction qui compte</h3>
<p>L'onglet <b>TVA à payer</b> fait le calcul complet : la TVA que tu as <b>collectée</b> sur tes ventes, moins celle que tu as <b>payée</b> sur tes achats. Tu ne reverses que la différence.</p>
<p>Si la différence est négative — un mois où tu as beaucoup acheté — tu as un <b>crédit de TVA</b>. Il n'est pas perdu : il vient en déduction du mois suivant, automatiquement. Le tableau « mois par mois » montre cet enchaînement, c'est pour ça que le total ne se lit pas ligne par ligne.</p>
<p>Ces chiffres sont l'arithmétique exacte de ce que tu as saisi. Ce ne sont pas une déclaration officielle : <em>fais-les valider par ton comptable avant tout dépôt.</em></p>
<h3>Onglet Calendrier fiscal</h3>
<p>Un pense-bête des déclarations qui reviennent. Active celles qui te concernent, ajuste le jour limite, et les échéances proches remonteront dans « À faire » sur l'accueil. <em>À VÉRIFIER avec ton comptable :</em> les dates, la périodicité et les déclarations applicables dépendent de ta forme juridique, de ton régime fiscal et de la présence de salariés.</p>
<h3>Onglet Écritures : le livre-journal que ton comptable importe</h3>
<p>Les mêmes pièces, traduites en comptabilité à partie double — débit d'un côté, crédit de l'autre, à l'équilibre sur chaque pièce. Le fichier s'importe directement dans son logiciel : il n'a plus rien à retaper. <em>À VÉRIFIER : les numéros de compte proposés suivent l'usage tunisien, mais chaque cabinet a les siens — ils se modifient dans « Plan de comptes… ».</em> Voir <a href="#/aide/cabinet">Envoyer à ton comptable</a>.</p>
<p>Depuis la 8.9.0, c'est un vrai <b>livre-journal</b> : chaque pièce porte un numéro continu dans l'exercice (clôture les mois envoyés pour que leurs numéros ne bougent plus), et tout ce qui touche l'argent y est — les mouvements libres de la Trésorerie (frais bancaires, apports, impôts payés, avec leur contrepartie), le paiement des bulletins, les soldes de départ des comptes, et la <b>déclaration mensuelle</b> passée en écriture à la fin de chaque mois écoulé (la TVA collectée soldée contre la déductible, le net à payer au 4365 avec les timbres et les retenues opérées). Le <b>journal centralisateur</b> résume l'exercice mois par mois et journal par journal. Et ce qui n'a ni facture, ni achat, ni règlement se saisit en <b>opération diverse</b> : deux lignes au moins, autant au débit qu'au crédit, sinon rien ne s'enregistre. Le <b>lettrage</b>, dans l'onglet Balance, liste ce qui reste ouvert tiers par tiers.</p>
<h3>Onglets Grand livre et Balance : ce que ton comptable regarde en premier</h3>
<p>Depuis la 8.8.0, les écritures se lisent aussi <b>par compte</b>. Le <b>grand livre</b> — le « mouvement de compte » — montre, pour un compte donné, chaque ligne qui l'a touché et le solde qui avance ; en tête, le solde d'ouverture reprend tout ce qui précède la période (les charges et les produits repartent de zéro au 1er janvier, et ce qu'ils portaient avant est reporté au compte de résultat). La <b>balance</b> met tous les comptes sur une page : ouverture, mouvements, soldes, et des totaux qui doivent tomber juste — c'est le contrôle qu'un cabinet fait avant tout autre. Ses deux autres vues, <b>auxiliaire clients</b> et <b>auxiliaire fournisseurs</b>, disent qui doit quoi, tiers par tiers.</p>
<p>Dans « Plan de comptes… », la case <b>un sous-compte par client et par fournisseur</b> donne à chaque tiers son numéro (411001, 401001…), comme les cabinets les tiennent ; le code est figé sur la fiche et ne change plus. Le plan comptable tunisien complet y est consultable, pour nommer un compte — il n'impose rien. La balance du mois part aussi dans le paquet du cabinet. <em>À VÉRIFIER avec ton comptable.</em></p>
<h3>Onglet États financiers : le bilan et l'état de résultat</h3>
<p>Depuis la 9.0.0, l'exercice se lit en entier. Au 1er janvier, une pièce d'<b>à-nouveaux</b> rouvre chaque compte de bilan avec son solde de la veille et porte le passé au compte de résultat des exercices antérieurs. Au 31 décembre, la <b>dotation aux amortissements</b> de chaque bien s'écrit (681 / 28), et une cession sort le bien de l'actif. La paie porte la TFP et le FOPROLOS. Et l'onglet <b>États financiers</b> déduit de la balance un <b>bilan</b> (actif = passif) et un <b>état de résultat</b> (produits − charges) : une présentation d'ensemble, pas la liasse fiscale, que ton comptable établit à partir de ces chiffres. Dans la Trésorerie, l'<b>état de rapprochement</b> présente ton relevé face à SkanFact comme il le joint au dossier.</p>
<h3>Onglet Clôtures : fermer un mois</h3>
<p>Clôturer un mois le fige : plus aucune écriture ne peut le changer sans que tu le décides et que tu dises pourquoi. C'est ce qui garantit qu'un chiffre déjà déclaré ne bouge plus dans ton dos. Voir <a href="#/aide/cloture">Clôturer un mois</a>.</p>
<h3>Onglet Cabinet : le paquet du mois</h3>
<p>Un seul fichier qui contient tout ce que ton comptable attend pour le mois : les PDF des pièces, les journaux, les justificatifs d'achat et une page de garde qui dit ce qui manque. Voir <a href="#/aide/cabinet">Envoyer à ton comptable</a>.</p>
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
<p>Quatre onglets, une pièce chacun : <b>Proformas</b>, <b>Bons de commande</b>, <b>Bons de livraison</b>, <b>Contrats à signer</b>.</p>
<p>À côté du devis et de la facture, SkanFact sait établir quatre autres pièces. Elles sont réunies dans <b>Proforma, bons et contrats</b>. Aucune n'a de valeur comptable : elles n'entrent ni dans ton chiffre d'affaires, ni dans ta TVA, ni dans le journal des ventes. Elles servent à documenter ce qui se passe autour de la vente.</p>
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
<p>Les fichiers sont <b>copiés</b> à côté de tes données : si tu déplaces ou supprimes l'original, la pièce reste attachée au document. Attention à un point : elles ne sont <b>pas</b> dans les sauvegardes quotidiennes, qui ne contiennent qu'un fichier texte. Elles sont en revanche dans la <b>copie externe</b> (Paramètres → Données et sécurité). Si tu joins des documents importants, configure cette copie.</p>`
    },
    {
      id: 'tresorerie', title: 'La trésorerie', sub: 'La seule question qui compte vraiment',
      body: `
<p>Quatre onglets : <b>Où j'en suis</b> (tes soldes réels), <b>Ce qui arrive</b> (la courbe des trente prochains jours), <b>Mouvements</b>, <b>Rapprochement</b> (pointer ton relevé).</p>
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
<p>Quatre onglets : <b>Affaires</b> (un chantier, un projet), <b>Où est la marge</b> (par client, par prestation), <b>Contrats</b> (ce que rapporte chaque abonnement), <b>Seuil de rentabilité</b>.</p>
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
      id: 'stock', title: 'Tenir son stock sans y passer ses soirées', sub: 'Suivi automatique, coût moyen, inventaire',
      body: `
<p>Cinq onglets : <b>État du stock</b>, <b>Mouvements</b>, <b>Numéros de série</b>, <b>Inventaire</b>, <b>Alertes</b>.</p>
<p>Si tu ne vends que des prestations — du temps, du conseil — cette page ne te servira à rien : passe ton chemin. Si tu achètes de la marchandise pour la revendre, elle t'évitera deux ennuis classiques : promettre ce que tu n'as pas, et ne pas savoir combien d'argent dort sur tes étagères.</p>
<h3>Le principe : tu ne saisis rien</h3>
<p>SkanFact ne te demande pas de tenir un cahier de stock. Il <b>déduit</b> les mouvements de ce que tu saisis déjà :</p>
<ul>
  <li>Une ligne de <b>facture d'achat</b> en destination « stock » fait une <b>entrée</b>.</li>
  <li>Une <b>facture</b> ou un <b>bon de livraison</b> fait une <b>sortie</b>.</li>
  <li>Un <b>avoir</b> remet la marchandise en stock.</li>
</ul>
<p>Ce qui ne bouge rien : les devis, les proformas, les bons de commande et les brouillons. Rien n'a encore quitté l'entrepôt. Et une facture tirée d'un bon de livraison ne sort pas une seconde fois : c'est le bon de livraison qui fait foi.</p>
<p>Tu ne saisis à la main que trois choses : ce que tu as en rayon au départ, la casse, et les corrections d'inventaire.</p>
<h3>Mettre un article sous suivi</h3>
<p><b>Catalogue → Modifier</b> une prestation → coche <b>« Suivi en stock »</b>. Trois champs apparaissent :</p>
<ul>
  <li>Le <b>stock de départ</b> et son coût unitaire : ce que tu as aujourd'hui, avant que SkanFact ne commence à compter. Compte-le une fois, sérieusement — tout le reste en dépend.</li>
  <li>Le <b>seuil d'alerte</b> : la quantité en dessous de laquelle il faut recommander. Mets-y de quoi tenir le temps que ton fournisseur livre.</li>
  <li>L'<b>emplacement</b>, pour le retrouver.</li>
</ul>
<p>Un piège à connaître : pour qu'un achat entre en stock, sa ligne doit porter le <b>même libellé</b> que l'article du catalogue. L'éditeur d'achat te prévient quand une ligne « stock » ne correspond à rien de suivi. Le plus simple est d'insérer l'article depuis le catalogue plutôt que de retaper son nom.</p>
<h3>Le coût moyen pondéré</h3>
<p>Tu achètes rarement deux fois au même prix. Pour savoir ce que vaut ton stock, SkanFact recalcule un <b>coût moyen</b> à chaque entrée : 5 disques à 200 DT plus 10 à 230 DT font 15 disques à 220 DT. Les sorties partent à ce coût-là et ne le changent pas.</p>
<p>C'est la méthode la plus simple à tenir et la plus courante. <em>À VÉRIFIER avec ton comptable : la méthode de valorisation retenue pour tes comptes annuels.</em></p>
<h3>Le stock négatif</h3>
<p>C'est l'alerte qui compte. Un stock négatif veut dire que tu as vendu plus que tu n'as acheté — physiquement impossible. Il manque donc une entrée : une facture d'achat non saisie, une quantité mal recopiée, un stock de départ oublié.</p>
<p><b>Corrige la pièce en cause, n'ajuste pas.</b> Un ajustement ferait disparaître l'alerte sans réparer quoi que ce soit — et si c'est une facture d'achat qui manque, tu perds aussi sa TVA déductible, ce qui coûte de l'argent pour de bon.</p>
<h3>L'inventaire</h3>
<p>Au moins une fois par an, à la clôture, on compte ce qu'il y a vraiment en rayon. C'est une obligation comptable, et c'est aussi le seul moment où l'on découvre ce qui s'est perdu.</p>
<p>Onglet <b>Inventaire</b> : tu tapes ce que tu as compté en face de chaque article, SkanFact affiche l'écart et ce qu'il représente en argent. Rien n'est modifié tant que tu ne cliques pas sur « Enregistrer les écarts » — et quand tu le fais, chaque correction devient un mouvement daté et traçable, pas une modification silencieuse.</p>
<p>Un écart n'est pas une faute : c'est de la casse non déclarée, une sortie oubliée, une erreur de saisie. L'important est de le voir et de le noter.</p>
<h3>Ce que ça change dans tes chiffres</h3>
<p>C'est le point le plus important de cette version, et le moins visible. Avant, acheter 10 000 DT de marchandise apparaissait comme une charge : ton résultat du mois plongeait, puis remontait quand tu la vendais. C'était faux dans les deux sens.</p>
<p>Maintenant, l'achat entre en <b>stock</b> — de l'argent transformé, pas dépensé — et la charge apparaît au moment de la <b>vente</b>, au coût moyen de ce qui est sorti. C'est ce qu'on appelle le <b>coût des marchandises vendues</b>, et tu le vois :</p>
<ul>
  <li>dans <b>Comptabilité → Résultat simplifié</b>, en face du chiffre d'affaires ;</li>
  <li>dans <b>Marges → Seuil de rentabilité</b>, rangé dans les charges variables — pas de vente, pas de coût.</li>
</ul>
<h3>Ce que cette page ne fait pas</h3>
<p>Pas de numéros de série, pas de lots ni de dates de péremption, pas de dépôts multiples, pas de réservation sur commande. Pas de FIFO ni de LIFO non plus : un seul coût moyen. Ce sont des besoins d'entreprises plus grandes ; si l'un d'eux devient nécessaire, il se rajoutera.</p>`
    },
    {
      id: 'paie', title: 'Payer quelqu\'un', sub: 'Bulletins, cotisations, et ce que ça coûte vraiment',
      body: `
<p>Sept onglets : <b>Bulletins</b>, <b>Salariés</b>, <b>Congés et absences</b>, <b>Avances</b>, <b>Déclarations</b>, <b>Registre</b>, <b>Barèmes</b>.</p>
<p>Embaucher, c'est le moment où la gestion cesse d'être un confort. Un bulletin faux se voit, se conteste, et se paie. Cette page calcule les bulletins — mais elle ne remplace pas ton comptable, et la première chose à faire est de lui montrer les trois premiers.</p>
<h3>Aucun taux n'est écrit en dur</h3>
<p>C'est le point le plus important. Tout ce qui sert au calcul — CNSS, impôt, contribution de solidarité, frais professionnels, déductions familiales, tranches du barème — se lit dans l'onglet <b>Barèmes</b>, et rien ne se calcule ailleurs.</p>
<p>Les valeurs livrées sont celles couramment appliquées en Tunisie au moment où cette version a été écrite. <b>Elles changent à chaque loi de finances.</b> Quand un taux bouge, tu le corriges ici, et les nouveaux bulletins en tiennent compte. Les bulletins déjà établis, eux, gardent leur propre calcul : un barème modifié ne réécrit jamais un bulletin déjà remis à un salarié.</p>
<h3>Le chemin d'un mois</h3>
<ol>
  <li>Tu crées la <b>fiche</b> de chaque salarié : identité, matricule CNSS, contrat, brut mensuel, situation familiale.</li>
  <li>Chaque mois, un bouton établit <b>tous les bulletins manquants</b> d'un coup, au brut de chaque fiche.</li>
  <li>Tu ouvres ceux qui ont une particularité : une prime, une retenue, des jours d'absence.</li>
  <li>Tu exportes le <b>PDF</b>, tu le remets, et tu marques le bulletin <b>payé</b> le jour du virement.</li>
</ol>
<p>Un salarié actif sans bulletin remonte dans « À faire » : c'est un oubli, pas un choix.</p>
<h3>Comment le net se calcule</h3>
<p>Du brut, on retire d'abord la <b>CNSS part salarié</b>. Sur ce qui reste, on calcule l'<b>impôt sur le revenu</b> — mais sur une base annuelle : le salaire de douze mois, moins les cotisations, moins un abattement pour frais professionnels, moins les déductions de chef de famille et d'enfants à charge. Le barème progressif s'applique à ce total, et le résultat est divisé par douze.</p>
<p>Le barème est <b>progressif par tranches</b> : chaque tranche n'est taxée qu'à son taux, et seulement sur la part du revenu qui la traverse. Gagner un dinar de plus ne fait jamais perdre d'argent — c'est le malentendu le plus répandu sur l'impôt.</p>
<h3>Ce qu'un salarié coûte vraiment</h3>
<p>Ni son net, ni même son brut. Il faut ajouter les <b>charges patronales</b> : CNSS employeur et accident du travail. Un salarié à 1 500 DT brut en coûte facilement 1 760.</p>
<p>C'est ce <b>coût employeur</b> qui entre dans ton résultat simplifié et dans tes charges fixes au seuil de rentabilité. Et les salaires sont des charges fixes au sens le plus strict : ils tombent le mois où tu ne vends rien.</p>
<h3>Primes, retenues, absences</h3>
<ul>
  <li>Une prime <b>imposable</b> entre dans l'assiette des cotisations et de l'impôt. Une prime non imposable (panier, transport, dans certaines limites) n'y entre pas. <em>À VÉRIFIER avec ton comptable : ce qui est exonéré et jusqu'à quel montant.</em></li>
  <li>Une <b>retenue</b> (avance sur salaire, prêt) se retire du net, sans toucher aux cotisations ni à l'impôt.</li>
  <li>Une <b>absence non payée</b> réduit le brut au prorata des jours ouvrables. Les congés payés et les arrêts indemnisés ne se saisissent pas ici : ils ne réduisent pas le salaire.</li>
</ul>
<h3>Le piège du double compte</h3>
<p>Un bulletin marqué payé <b>sort l'argent tout seul</b> dans la trésorerie, exactement comme un paiement client y entre. Ne saisis donc pas en plus un mouvement libre « Salaires » : il compterait deux fois, et ta trésorerie serait fausse du montant de tes salaires. Si les deux existent, SkanFact te le signale dans « À faire ».</p>
<h3>Ce que cette page ne fait pas</h3>
<p>Pas de congés payés ni de soldes d'absence, pas d'attestations de travail, pas de déclaration CNSS automatique, pas de registre du personnel. Pas non plus de gestion des régimes particuliers : un contrat SIVP ou Karama peut être exonéré de certaines charges, et SkanFact ne le devine pas — tu ajustes alors les taux du bulletin concerné.</p>
<p>Et surtout : <b>elle ne remplace pas un comptable.</b> Les bulletins portent une mention imprimée qui le rappelle. Fais-les valider avant de les remettre, et refais le contrôle chaque fois qu'une loi de finances passe.</p>`
    },
    {
      id: 'conges', title: 'Congés, absences et papiers du personnel', sub: 'Compteurs, avances, attestations',
      body: `
<p>La paie de la 5.0.0 savait calculer un bulletin. Restait la question de tous les jours : d'où viennent les jours d'absence, et d'où vient la retenue d'une avance ? La réponse est la même que partout ailleurs dans SkanFact : tu le saisis une fois, au moment où ça arrive, et le bulletin du mois le reprend tout seul.</p>
<h3>Les congés</h3>
<p>Le droit annuel se règle dans <b>Paie → Barèmes</b> (18 jours ouvrables par défaut) et s'acquiert <b>au prorata des mois travaillés</b> : quelqu'un arrivé en juillet n'a pas droit à une année entière.</p>
<p>Tu enregistres chaque absence avec sa nature :</p>
<ul>
  <li><b>Congé payé</b> — entame le compteur, ne réduit pas le salaire.</li>
  <li><b>Arrêt maladie</b>, <b>maternité</b>, <b>autorisation</b> — ne réduisent ni le salaire ni le compteur.</li>
  <li><b>Sans solde</b> et <b>injustifiée</b> — réduisent le brut au prorata des jours ouvrables.</li>
</ul>
<p>Tu peux forcer le comportement au cas par cas : une autorisation exceptionnelle retenue, un arrêt maintenu en totalité. <em>À VÉRIFIER avec ton comptable : le traitement d'un arrêt maladie dépend de sa durée et de la prise en charge CNSS.</em></p>
<p>Une absence à cheval sur deux mois se répartit toute seule entre les deux bulletins — trois jours en avril, deux en mai. C'est exactement le genre de détail qu'on rate en comptant à la main.</p>
<h3>Le solde négatif</h3>
<p>Si quelqu'un prend plus de jours qu'il n'en a acquis, le solde passe en rouge. Ce n'est pas interdit — beaucoup d'entreprises avancent des congés — mais il faut le savoir, surtout au moment d'un départ : les jours pris en trop se retiennent du solde de tout compte.</p>
<h3>Les avances sur salaire</h3>
<p>Tu saisis la somme prêtée et la retenue mensuelle. SkanFact te dit en combien de mois ce sera remboursé, et quelle part du net la retenue représente — il t'avertit si elle dépasse le tiers, parce qu'une retenue trop lourde met le salarié en difficulté et finit par se retourner contre toi. <em>À VÉRIFIER : la loi encadre la part du salaire qui peut être retenue.</em></p>
<p>La retenue se pose ensuite sur chaque bulletin établi, jusqu'à extinction, et la dernière échéance ne prend que ce qui reste.</p>
<p>Un point important : <b>ce qui est remboursé se lit sur les bulletins eux-mêmes</b>, pas sur un compteur à part. Supprimer une avance ne défait donc pas les retenues déjà passées — c'est voulu, un bulletin remis ne se réécrit pas.</p>
<h3>Les trois documents qu'on te demandera</h3>
<ul>
  <li><b>Attestation de travail</b> — prouve qu'une personne travaille chez toi <em>aujourd'hui</em>. Une banque ou un bailleur la demande. Le salaire n'y figure que si tu coches la case : c'est une information personnelle.</li>
  <li><b>Certificat de travail</b> — se remet à la fin du contrat. Il n'indique que les dates et l'emploi occupé, rien d'autre : ni le motif du départ, ni une appréciation. C'est la règle, et elle protège tout le monde.</li>
  <li><b>Solde de tout compte</b> — récapitule ce qui reste dû au départ. SkanFact propose l'indemnité de congés non pris, calculée sur le dernier salaire ; le reste est à toi. <em>À VÉRIFIER : les indemnités de fin de contrat dépendent du motif de la rupture et de la convention collective — fais relire le document avant signature.</em></li>
</ul>
<p>Les trois sortent en PDF, au même format que tes factures, prêts à signer.</p>
<h3>Le registre du personnel</h3>
<p>La liste que l'inspection du travail peut demander : qui a travaillé chez toi, à quel poste, sous quel contrat, entre quelles dates. Les salariés partis y figurent aussi — c'est le but. Exportable en CSV. <em>À VÉRIFIER : la forme exacte du registre relève du code du travail.</em></p>
<h3>Ce que ça ne fait pas</h3>
<p>Pas de demande de congé à valider, pas de planning d'équipe, pas de pointage. Pas de calcul d'indemnité de licenciement non plus : ce calcul dépend de l'ancienneté, du motif et de la convention, et se fait avec un comptable ou un juriste, pas dans un tableau.</p>`
    },
    {
      id: 'cabinet', title: 'Envoyer le mois à ton comptable', sub: 'Un fichier, complet, vérifiable',
      body: `
<p>Ce que la plupart des petites entreprises envoient à leur comptable, c'est un mail par-ci, une photo par-là, un classeur en fin d'année. Le comptable passe son temps à réclamer. SkanFact fabrique à la place <b>un fichier unique par mois</b>, qui contient tout, et qui dit lui-même ce qui lui manque.</p>

<h3>Ce qu'il y a dedans</h3>
<ul>
<li><b>Une page de garde</b> en PDF : le mois en chiffres, ce que contient le paquet, et la liste de ce qui manque.</li>
<li><b>Les journaux en CSV</b> — ventes, achats, encaissements, règlements fournisseurs, trésorerie — que ton comptable ouvre dans Excel ou importe dans son logiciel.</li>
<li><b>La TVA du mois</b>, avec le crédit reporté du mois précédent.</li>
<li><b>Le PDF de chaque facture et de chaque avoir émis</b> : le justificatif, pas seulement la ligne du tableau.</li>
<li><b>Les justificatifs d'achat</b> que tu as joints à tes achats. Sans eux, il ne peut pas récupérer ta TVA.</li>
<li><b>Les bulletins de paie</b> du mois, et la déclaration CNSS quand le trimestre se termine.</li>
<li><b>Les écritures comptables</b> en partie double (<code>journaux/ecritures.csv</code>) : ton comptable les importe au lieu de retaper tes pièces une par une.</li>
<li><b>Un manifeste</b> qui liste chaque fichier avec son empreinte.</li>
</ul>
<p>Le fichier porte l'extension <code>.skanpack</code>, mais c'est une archive ordinaire : ton comptable peut la renommer en <code>.zip</code> et l'ouvrir avec le Finder ou l'Explorateur, sans rien installer. Rien ne l'enferme dans SkanFact.</p>

<h3>Provisoire ou définitif</h3>
<p>Un paquet n'est <b>définitif</b> que si le mois a été clôturé (voir « Clôturer un mois »). Sinon il part marqué <b>provisoire</b>, en toutes lettres sur la page de garde : ton comptable sait que les chiffres peuvent encore bouger. Tu peux envoyer un provisoire en cours de mois si ton comptable le demande — mais l'envoi qui compte est celui d'après la clôture.</p>

<h3>Le mot de passe</h3>
<p>Le paquet contient tes factures, tes achats et les salaires de tes employés. Ce n'est pas ce qu'on laisse traîner dans une boîte mail. Coche « Protéger par un mot de passe » : le contenu devient illisible sans lui.</p>
<p><b>Transmets le mot de passe par un autre canal que le fichier</b> — par téléphone, par message, mais pas dans le mail qui contient la pièce jointe : sinon la protection ne sert à rien. Le nom de ton entreprise et le mois restent lisibles sans mot de passe, pour que ton comptable sache de quoi il s'agit avant de l'ouvrir.</p>

<h3>L'empreinte, et à quoi elle sert</h3>
<p>Chaque fichier du paquet a une empreinte : une suite de caractères calculée à partir de son contenu. Change un seul octet, l'empreinte change du tout au tout. Elle sert le jour où quelqu'un se demande si le fichier reçu est bien celui qui a été envoyé — un mail qui tronque une pièce jointe, une clé USB abîmée, un doute. Si les deux empreintes se ressemblent, le paquet est intact.</p>

<h3>Si un justificatif a disparu</h3>
<p>Si une photo jointe à un achat n'est plus sur le disque, le paquet part quand même <b>sans elle</b>, et le manifeste dit laquelle manque. Un fichier introuvable ne doit pas bloquer tout un envoi : mieux vaut un dossier à 99 % avec le trou signalé qu'un envoi qui échoue.</p>

<h3>Les écritures : ce qui lui fait vraiment gagner du temps</h3>
<p>Un comptable passe l'essentiel de son temps sur un petit dossier à <b>retaper</b> : chaque facture, chaque achat, chaque règlement, dans son logiciel. L'onglet <b>Comptabilité → Écritures</b> fait ce travail à sa place. Chaque pièce y devient un jeu d'écritures en <b>partie double</b> — autant au débit qu'au crédit — et le fichier est joint au paquet.</p>
<p>Une chose à savoir : <b>les numéros de compte proposés ne sont qu'une proposition.</b> Ils suivent l'usage du plan comptable tunisien, mais chaque cabinet a ses habitudes. Demande-lui les siens la première fois et saisis-les dans « Plan de comptes » : tu ne le feras qu'une fois, et tous tes envois suivants seront directement à son format. <em>À VÉRIFIER avec ton comptable.</em></p>
<p>Le contrôle affiché en haut de la page vérifie que chaque pièce <b>tombe juste</b> (débit = crédit). Si ce n'est pas le cas, ne l'envoie pas : son logiciel refuserait le fichier, et il t'appellerait.</p>

<h3>La routine</h3>
<p>Une fois par mois, quand tout est saisi : clôture le mois, va dans <b>Comptabilité → Cabinet</b>, vérifie ce qui manque, fabrique le paquet, envoie-le. Dix minutes, et ton comptable a tout.</p>`
    },
    {
      id: 'cloture', title: 'Clôturer un mois', sub: 'Promettre à ton comptable que le passé ne bougera plus',
      body: `
<p>Voici ce qui se passe sans clôture. Tu déclares la TVA de mars. Trois semaines plus tard, tu retrouves une facture d'achat de mars au fond d'un tiroir et tu la saisis à sa vraie date. La TVA de mars vient de changer. Ton comptable a déclaré l'ancien chiffre, personne ne le sait, et vous le découvrirez peut-être des années plus tard.</p>
<p><b>Clôturer un mois, c'est le figer.</b> Après ça, aucune pièce datée de ce mois ne peut plus être créée, modifiée ou supprimée : ni facture, ni achat, ni paiement, ni mouvement de trésorerie, ni bulletin de paie. C'est ce qui permet de dire à ton comptable « voilà mars, il est complet, il ne bougera plus ».</p>

<h3>Quand clôturer</h3>
<p>Une fois le mois terminé <b>et</b> tout saisi : tes factures émises, les achats reçus, les paiements encaissés et versés, les bulletins établis. En pratique, une à deux semaines après la fin du mois — le temps que les dernières factures d'achat arrivent. SkanFact te le rappelle dans « À faire » dès qu'un mois terminé depuis dix jours n'est toujours pas clôturé.</p>
<p>Les mois se clôturent <b>dans l'ordre</b>, du plus ancien au plus récent. Le mois en cours ne se clôture jamais : il lui reste des pièces à venir.</p>

<h3>Ce que SkanFact vérifie avant</h3>
<p>Au moment de clôturer, l'application te montre ce qui mériterait d'être réglé : une facture restée en brouillon (elle n'a pas de numéro et n'apparaît dans aucun journal), un achat sans justificatif (ton comptable ne pourra pas en récupérer la TVA), un mouvement de trésorerie non pointé, un bulletin de paie manquant, un stock négatif.</p>
<p><b>Rien de tout cela ne t'empêche de clôturer.</b> Ces points sont là pour que tu les voies, pas pour te bloquer. Un mois clôturé avec deux justificatifs manquants signalés vaut mieux qu'un mois jamais clôturé parce que l'application faisait la difficile.</p>

<h3>Et si j'ai oublié quelque chose ?</h3>
<p>Deux façons de t'en sortir, et la première est presque toujours la bonne :</p>
<ul>
<li><b>Sans toucher au passé.</b> Une facture client à corriger ? Un avoir, daté d'aujourd'hui — c'est de toute façon la seule façon correcte de corriger une facture émise. Une facture d'achat oubliée ? Saisis-la à la date d'aujourd'hui et signale-le à ton comptable, il saura la rattacher au bon exercice.</li>
<li><b>En rouvrant la période.</b> Comptabilité → Clôtures → Rouvrir. Il faut écrire un motif, et la réouverture s'inscrit dans le journal. <b>Préviens ton comptable avant</b> : les chiffres qu'il a reçus vont changer, et s'il a déjà déposé la déclaration du mois, il devra peut-être la corriger. <em>À VÉRIFIER avec lui</em> selon ce qui a déjà été déposé.</li>
</ul>

<h3>Le journal des clôtures</h3>
<p>Chaque clôture et chaque réouverture y figure, avec sa date, l'ordinateur qui l'a faite et le motif. C'est la ligne qu'on relit le jour où un chiffre a bougé après un envoi. Rien ne s'en efface.</p>

<h3>Si vous êtes deux sur le même dossier</h3>
<p>La clôture est une donnée comme une autre : elle voyage avec le dossier partagé. Si ton associé clôture mars sur son poste, ton poste le verra à la prochaine synchronisation et refusera lui aussi les pièces de mars. Mettez-vous d'accord sur qui clôture — comme pour l'émission des factures.</p>`
    },
    {
      id: 'declarations', title: 'Les déclarations sociales', sub: 'CNSS trimestrielle, déclaration d\'employeur',
      body: `
<p>Employer quelqu'un crée deux obligations qui reviennent : la <b>déclaration CNSS</b>, tous les trimestres, et la <b>déclaration annuelle d'employeur</b>, une fois par an. Aucune des deux ne se rappelle à toi : la CNSS ne relance pas, elle pénalise.</p>
<p>SkanFact <b>ne dépose rien</b> et ne se connecte à aucune administration. Il prépare le tableau, te rappelle la date, et te laisse recopier ou envoyer. C'est volontaire : une application qui déposerait à ta place devrait être maintenue à chaque changement de formulaire, et se tromperait un jour sans que tu le saches.</p>
<h3>La CNSS, tous les trimestres</h3>
<p>Onglet <b>Paie → Déclarations</b>, choisis le trimestre. Un salarié par ligne, avec :</p>
<ul>
  <li>son <b>assiette</b> — le brut soumis à cotisation sur les trois mois ;</li>
  <li>la <b>part salarié</b>, déjà retenue sur ses bulletins ;</li>
  <li>la <b>part employeur</b> et l'<b>accident du travail</b>, à ta charge.</li>
</ul>
<p>Le <b>total est ce que tu verses à la CNSS</b>, les deux parts confondues. Un matricule CNSS manquant sur une fiche est signalé en rouge : la déclaration ne peut pas partir sans lui.</p>
<p>Échéance usuelle : le 15 du mois suivant la fin du trimestre. <em>À VÉRIFIER avec ton comptable.</em></p>
<h3>La déclaration annuelle d'employeur</h3>
<p>Elle porte sur <b>deux choses distinctes</b>, et c'est la source de confusion la plus fréquente :</p>
<ol>
  <li>Les <b>salaires</b> que tu as versés : brut annuel, CNSS retenue, impôt retenu, net versé, par salarié.</li>
  <li>Les <b>retenues à la source pratiquées sur des fournisseurs</b> — honoraires d'un comptable, d'un avocat, loyers. Tu as gardé une part de leur facture et tu la reverses au Trésor à leur place.</li>
</ol>
<p>Pour cette seconde partie, tu dois remettre à chaque fournisseur une <b>attestation de retenue</b>, sinon il ne peut pas la déduire de son propre impôt — et il te la réclamera. Les attestations manquantes sont comptées ici et rappelées dans « À faire ».</p>
<h3>Le rappel</h3>
<p>Dès qu'un salarié existe, l'échéance CNSS s'allume toute seule dans ton <a href="#/compta">calendrier fiscal</a>, et les déclarations dues remontent dans « À faire » sur l'accueil — en rouge si l'échéance est passée.</p>
<p>Quand tu as déposé, clique <b>« Marquer déposée »</b>. Ça ne fait rien d'autre que faire taire le rappel : c'est un pense-bête, pas un accusé de réception.</p>
<h3>Ce qu'il faut savoir</h3>
<p>Ces chiffres sont l'arithmétique exacte de tes bulletins, pas une déclaration officielle. La forme du formulaire, les dates, les modalités de dépôt et les éventuelles exonérations (contrats SIVP, Karama) relèvent de ton comptable. <em>Fais-lui vérifier les premières déclarations, comme les premiers bulletins.</em></p>`
    },
    {
      id: 'lecture', title: 'Photographier une facture au lieu de la saisir', sub: 'Ce que ça envoie, ce que ça coûte, ce que ça ne fait pas',
      body: `
<p><b>Depuis la 8.7.0, cette fonction est en pause.</b> Elle n'a de sens qu'avec une application sur téléphone pour prendre la photo, et celle-ci n'existe pas encore : le réglage n'apparaît plus dans les Paramètres, et aucune image ne part de ton ordinateur. Joindre une photo ou un PDF comme justificatif d'un achat reste possible, hors ligne, depuis le bouton « Joindre un justificatif… » de l'écran d'achat. Le reste de cet article décrit ce que la fonction fera le jour où elle reviendra.</p>
<p>Saisir une facture fournisseur prend deux minutes. En saisir trente en fin de mois prend une soirée. SkanFact peut lire la photo à ta place et te proposer la saisie toute faite — mais cette fonction est la <b>seule</b> de l'application qui envoie une de tes pièces sur Internet, alors elle mérite trois minutes de lecture avant de l'activer.</p>
<h3>Par défaut, elle est éteinte</h3>
<p>Tant qu'aucune clé n'est enregistrée, <b>aucune pièce ne quitte ton ordinateur</b>. Le bouton « Depuis une photo… » de l'écran d'achat fonctionne quand même : il joint la photo à l'achat comme justificatif, et tu saisis à la main. C'est le fonctionnement normal, hors ligne, et il n'expire jamais.</p>
<h3>Ce qui part, si tu l'actives</h3>
<ul>
  <li><b>L'image de la facture</b>, et rien d'autre. Pas tes clients, pas tes chiffres, pas ta comptabilité, pas ton fichier de données.</li>
  <li><b>Au moment où tu cliques</b>, pas avant, pas en arrière-plan. SkanFact te demande confirmation à chaque facture, en te disant le nom du fichier et sa taille.</li>
</ul>
<p>Note quand même que la facture d'un fournisseur porte son nom, son matricule et des montants : si un achat est confidentiel, saisis-le à la main.</p>
<h3>Ce que ça coûte</h3>
<p>Il faut une <b>clé d'API</b>, que tu crées toi-même sur <code>console.anthropic.com</code> et que tu recharges comme un compte prépayé. Chaque facture lue coûte quelques centimes. La clé est stockée sur cet ordinateur, dans un fichier séparé de tes données — elle n'entre jamais dans une sauvegarde ni dans un dossier partagé.</p>
<p><b>Paramètres → Données et sécurité → Lecture de factures d'achat</b> pour l'activer, la changer, ou l'effacer d'un clic.</p>
<h3>L'application ne remplit jamais toute seule</h3>
<p>C'est la règle qui ne bougera pas. Ce qui a été lu s'affiche dans une fenêtre de vérification :</p>
<ul>
  <li>Le <b>fournisseur</b> est reconnu par son matricule fiscal, à défaut par son nom. S'il est inconnu, SkanFact te le dit et te propose de créer la fiche — il ne la crée jamais tout seul, sinon ta liste se remplirait de doublons.</li>
  <li>Le <b>total des lignes</b> est comparé au total imprimé sur la pièce. S'il y a un écart, il est affiché en rouge : c'est presque toujours une ligne mal lue.</li>
  <li>Un <b>numéro de facture manquant</b> est signalé : sans lui, la TVA n'est pas déductible.</li>
  <li>Les lignes arrivent toutes en destination <b>« charge »</b>. Si c'est de la marchandise ou du matériel, c'est à toi de le dire : une erreur de lecture sur une quantité fausserait tout ton stock.</li>
</ul>
<p>Tu valides, l'écran d'achat s'ouvre pré-rempli, et tu peux encore tout changer avant d'enregistrer. La photo est jointe comme justificatif dans tous les cas.</p>
<h3>Quand ça ne marche pas</h3>
<p>Pas d'internet, clé épuisée, photo floue : SkanFact te le dit en clair et te propose de joindre la photo et de saisir à la main. Rien n'est jamais perdu, et l'achat n'est jamais enregistré à moitié.</p>
<h3>Conseils de photo</h3>
<p>À plat, bien éclairé, la facture entière dans le cadre, sans ombre portée. Un PDF est encore mieux qu'une photo quand le fournisseur en envoie un. Au-delà de 10 Mo, le service refuse l'image : règle ton téléphone sur une qualité moyenne, c'est largement suffisant pour du texte.</p>`
    },
    {
      id: 'series', title: 'Savoir qui a quoi : numéros de série et garanties', sub: 'Parc client, fin de garantie, occasion de vente',
      body: `
<p>Le stock te dit <em>combien</em> il t'en reste. Les numéros de série te disent <em>lesquels</em>, et surtout <b>où ils sont</b>. Pour du matériel garanti, c'est la différence entre « je vais regarder dans mes factures » et « votre serveur est chez vous depuis mars 2024, il est garanti jusqu'en mars 2027 ».</p>
<h3>Quels articles suivre</h3>
<p>Du matériel identifiable et garanti : serveur, ordinateur, pare-feu, imprimante. Pas des consommables : on ne suit pas des câbles un par un.</p>
<p><b>Catalogue → Modifier</b> un article déjà suivi en stock → coche <b>« Suivre chaque unité par son numéro de série »</b>, et indique la durée de garantie que tu accordes.</p>
<h3>Le cycle d'une unité</h3>
<ol>
  <li><b>Entrée.</b> Page Stock → onglet <b>Numéros de série</b> → « + Entrée de numéros ». Un numéro par ligne : tu peux les coller depuis le bon de livraison de ton fournisseur. Les doublons sont refusés.</li>
  <li><b>Sortie.</b> Depuis la facture ou le bon de livraison, menu <b>« Plus ▾ » → « Numéros de série livrés »</b>. Tu coches les unités effectivement parties. Leur garantie démarre à la date du document.</li>
  <li><b>Après.</b> Elles apparaissent dans le <b>parc</b> du client, sur sa fiche, et dans la page <b>Garanties</b>.</li>
</ol>
<p>Si tu décoches une unité, elle revient en stock : rien n'est irréversible.</p>
<h3>La garantie court de la livraison</h3>
<p>Pas de ton achat. C'est la date qui compte pour le client, et c'est celle-là que SkanFact retient. Une unité encore en stock n'a donc pas de garantie en cours : elle n'est chez personne.</p>
<h3>Les deux comptes doivent concorder</h3>
<p>Le stock en quantité et le stock en numéros racontent la même histoire. Quand ils divergent — trois en stock, un seul numéro disponible — c'est qu'un numéro n'a pas été saisi à l'entrée, ou pas attribué à la sortie. SkanFact le signale en tête de l'onglet.</p>
<p>Ce n'est pas grave pour tes chiffres : la comptabilité s'appuie sur les quantités, pas sur les numéros. Mais tant que l'écart dure, tu ne peux pas répondre à « où est passée cette machine ? ».</p>
<h3>La page Garanties : la partie qui rapporte</h3>
<p>Elle liste ce qui arrive à échéance dans les 30, 60, 90, 180 ou 365 prochains jours, et ce qui est déjà hors garantie.</p>
<p>Une fin de garantie n'est pas une mauvaise nouvelle, c'est une <b>occasion</b> : c'est le moment naturel de proposer un contrat de maintenance, et le client n'y pense presque jamais tout seul. Le bouton « Proposer un contrat » ouvre directement un devis à son nom.</p>
<p>Appeler deux mois avant vaut beaucoup mieux qu'expliquer, après la panne, que ce n'est plus couvert. Les fins de garantie qui approchent remontent aussi dans « À faire » sur l'accueil.</p>
<h3>Ce que cette page ne fait pas</h3>
<p>Pas de gestion de retours SAV, pas d'historique d'interventions par machine, pas de contrat rattaché à une unité précise. Si le besoin vient, il se rajoutera — pour l'instant, savoir <b>qui a quoi et jusqu'à quand</b> couvre l'essentiel.</p>`
    },
    {
      id: 'immobilisations', title: 'Ce que tu gardes : les immobilisations', sub: 'Amortissement, valeur nette comptable, cession',
      body: `
<p>Trois onglets : <b>Tableau des amortissements</b>, <b>À immobiliser</b> (les lignes d'achat qui attendent leur fiche), <b>Sorties et cessions</b>.</p>
<p>Une rame de papier se consomme : c'est une charge, tu la déduis en entier l'année où tu l'achètes. Un ordinateur reste : tu le déduis un peu chaque année, pendant sa durée d'usage. C'est tout l'objet de cette page, et ce n'est pas une subtilité de comptable — c'est ce qui fait qu'une année où tu investis beaucoup ne ruine pas ton résultat, et qu'une année où tu n'investis rien ne le gonfle pas artificiellement.</p>
<h3>Ce qui est une immobilisation</h3>
<p>Un bien durable qui reste dans l'entreprise et lui sert plusieurs années : ordinateur, serveur, véhicule, mobilier, outillage, agencement du local, logiciel acheté. En dessous d'un certain montant, l'usage est de passer directement en charge — <em>à VÉRIFIER avec ton comptable, ce seuil dépend de la réglementation en vigueur.</em></p>
<h3>Le chemin normal</h3>
<ol>
  <li>Tu saisis la facture du fournisseur dans <b>Achats</b> et tu mets la ligne concernée en destination <b>« immobilisation »</b>.</li>
  <li>Elle apparaît dans l'onglet <b>« À immobiliser »</b> de cette page, avec un compteur dans la barre latérale.</li>
  <li>Tu cliques « Créer la fiche », tu choisis la famille et la durée, et le plan d'amortissement se calcule.</li>
</ol>
<p>SkanFact ne crée jamais la fiche tout seul, et c'est volontaire : la durée d'amortissement est une <b>décision</b>, pas une donnée qu'on lit sur une facture. Mais attention — <b>tant qu'une ligne reste en attente, elle n'est déduite nulle part</b> : ni en charge (elle est en immobilisation), ni en amortissement (il n'y a pas de plan). C'est la raison du compteur.</p>
<h3>Comment le calcul est fait</h3>
<p>Amortissement <b>linéaire</b> : la valeur est divisée par le nombre d'années, à parts égales. Avec une nuance qui surprend souvent : la première année est réduite au <b>prorata des jours</b> d'utilisation. Un ordinateur de 2 400 DT amorti sur trois ans mais mis en service le 1er juillet ne donne pas 800 DT la première année, mais 400 — et il reste 400 DT à amortir sur un quatrième exercice. C'est pour ça qu'un bien « sur trois ans » apparaît sur quatre lignes.</p>
<p>La dernière annuité absorbe les arrondis, pour que la valeur nette comptable tombe exactement à zéro et pas à trois millimes près.</p>
<h3>La valeur nette comptable</h3>
<p>C'est ce que le bien vaut encore <b>dans tes comptes</b> : prix d'achat moins tout ce qui a déjà été amorti. Deux malentendus fréquents :</p>
<ul>
  <li>Ce n'est pas sa valeur de revente. Un ordinateur amorti à zéro se vend encore ; une voiture peut valoir moins que sa VNC.</li>
  <li>Ce n'est pas de l'argent. La dotation est une charge qui ne sort rien de ta banque — tu as payé une fois, tu déduis plusieurs fois. C'est pour ça que ton résultat et ta trésorerie ne racontent jamais tout à fait la même histoire.</li>
</ul>
<h3>Quand le bien s'en va</h3>
<p>Vendu, mis au rebut, volé : depuis la fiche du bien, bouton « Sortir du patrimoine ». SkanFact amortit jusqu'au jour de la sortie, puis compare le prix obtenu à la valeur nette comptable de ce jour-là. Au-dessus, c'est une <b>plus-value</b> ; en dessous, une <b>moins-value</b>. Pour un bien mis au rebut, mets zéro : toute la VNC restante part en moins-value.</p>
<p><em>À VÉRIFIER avec ton comptable : une plus-value de cession est en principe imposable, une moins-value déductible, et il existe des régimes particuliers.</em></p>
<h3>Ce que ça change ailleurs dans l'app</h3>
<ul>
  <li><b>Comptabilité → Résultat simplifié</b> : la dotation de l'année est retirée du résultat. Sans elle, l'année d'un gros investissement paraissait excellente.</li>
  <li><b>Marges → Seuil de rentabilité</b> : la dotation compte parmi tes charges fixes. Elle tombe que tu vendes ou non.</li>
  <li><b>Trésorerie</b> : rien. C'est normal — un amortissement ne sort aucun argent.</li>
</ul>
<h3>Ce que cette page ne fait pas</h3>
<p>Pas d'amortissement dégressif, pas de composants, pas de réévaluation, pas de crédit-bail. Ce sont des cas qui se traitent avec un comptable, pas dans un tableau. Et le tableau produit ici est un <b>outil de suivi</b> : c'est ton comptable qui établit les comptes annuels.</p>`
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
<h3>L'avoir et l'acompte</h3>
<p>Un <b>avoir fournisseur</b> est ce que ton fournisseur te rend : une marchandise retournée, un rabais accordé après coup, une erreur sur sa facture. Saisis-le comme une facture ordinaire, en choisissant « Avoir fournisseur » dans le champ Nature, et <b>tape les montants en positif</b> — c'est l'application qui les compte en moins, partout où il faut.</p>
<p>Le plus simple est de le créer depuis la facture concernée : ouvre-la, clique « Actions », puis « Saisir un avoir sur cette pièce ». Il arrive déjà rattaché, et le reste à payer de la facture baisse d'autant. Si l'avoir arrive sans facture en face — un rabais de fin d'année, par exemple — laisse le rattachement vide : c'est un crédit que tu as chez ce fournisseur, la page Achats le montre « à imputer » et « À faire » te le rappelle jusqu'à ce que tu le déduises d'une facture.</p>
<p>Un <b>acompte versé</b> est l'argent que tu paies à la commande, avant d'avoir reçu la facture. Ce n'est pas encore une charge : c'est une avance, de l'argent que ton fournisseur te doit en marchandise ou en travail. Rattache-le à la facture quand elle arrive, et l'application solde l'avance toute seule.</p>
<p><em>Le compte d'avances proposé (409) et le traitement de la TVA sur un acompte : À VÉRIFIER avec ton comptable.</em></p>
<h3>La destination de chaque ligne</h3>
<p>C'est le champ qui a l'air le moins utile aujourd'hui et qui comptera le plus demain. Trois choix :</p>
<ul>
  <li><b>Charge</b> : consommé tout de suite. Fournitures, loyer, carburant, sous-traitance. C'est le cas le plus fréquent.</li>
  <li><b>Stock</b> : de la marchandise achetée pour être revendue. Elle sortira du stock quand tu la vendras.</li>
  <li><b>Immobilisation</b> : du matériel qui reste dans l'entreprise plus d'un an — ordinateur, climatiseur, véhicule, mobilier. Il ne se déduit pas d'un coup : il s'amortit sur plusieurs années.</li>
</ul>
<p>Ce champ est lu par le <b>stock</b> et par les <b>immobilisations</b> : une ligne « stock » entre en stock à la date de l'achat, une ligne « immobilisation » attend sa fiche dans Immobilisations → À immobiliser. Une ligne mal rangée, c'est une déduction qui n'arrive jamais.</p>
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
      id: 'licence', title: 'La licence', sub: 'Ce qu\'elle bloque, et surtout ce qu\'elle ne bloque pas',
      body: `
<p>SkanFact est un logiciel payant. Sa licence a été écrite en partant d'une question simple : <b>qu'est-ce qui serait insupportable à la place de l'utilisateur ?</b> Les réponses ont donné trois règles.</p>

<h3>1. Aucune connexion</h3>
<p>Ta clé est vérifiée <b>sur ton ordinateur</b>, avec une signature électronique. Elle n'est présentée qu'aux services de SkanFact — les mises à jour, et la vérification qu'elle n'a pas été révoquée —, il n'y a aucun compte à créer, et SkanFact fonctionne dans un chantier sans réseau comme dans un bureau. Si le fournisseur de SkanFact disparaissait demain, ton application continuerait de fonctionner jusqu'à la fin de ta licence.</p>

<h3>2. Jamais tes données en otage</h3>
<p>Une licence expirée <b>ne ferme rien de ce que tu as déjà</b>. Tu peux toujours :</p>
<ul>
<li>ouvrir, lire et imprimer tous tes documents ;</li>
<li>exporter tes données, tes journaux, tes PDF ;</li>
<li>fabriquer et envoyer le paquet mensuel à ton comptable ;</li>
<li>faire tes sauvegardes.</li>
</ul>
<p>Seule la <b>création de nouvelles pièces</b> attend le renouvellement. C'est une limite commerciale, pas un chantage : tes factures sont à toi, dans un fichier lisible, sur ton disque.</p>

<h3>3. Un essai complet</h3>
<p>Les 30 premiers jours sont complets, sans rien à saisir. L'application te prévient une semaine avant la fin, dans la barre de gauche.</p>

<h3>Deux offres</h3>
<p>La clé porte l'offre choisie à l'achat. <b>Indépendant</b> couvre ce qu'il faut pour facturer seul : devis, factures, avoirs, relances, contrats récurrents, TVA et timbre, clôture, dossier mensuel du comptable. <b>Entreprise</b> ajoute Achats et fournisseurs, Stock, Immobilisations, Trésorerie et marges, Paie, et le dossier partagé à deux.</p>
<p>En Indépendant, ces modules ne disparaissent pas : ils portent un cadenas dans le menu, tout ce qui y existe reste <b>lisible, imprimable et exportable</b>, et seule la création de nouvelles pièces y attend l'offre Entreprise. Pendant l'essai, tout est ouvert — c'est la seule façon de savoir de quelle offre tu as besoin.</p>
<p>La clé est aussi attachée à ton <b>matricule fiscal</b> : émise pour ton entreprise, elle ne s'active pas sur le dossier d'une autre.</p>

<h3>Demander ou renouveler</h3>
<p><b>Paramètres → L'application → Licence → Demander une licence</b> prépare le message avec tout ce qu'il faut : ta raison sociale, ton matricule, et — si ton comptable t'a remis son fichier d'appairage — l'empreinte de son cabinet. <b>Un client envoyé par un cabinet qui utilise SkanFact Cabinet a droit à une remise.</b> Tu reçois une clé qui commence par <code>SKAN1.</code>, tu la colles, c'est fini.</p>
<p>Si la clé est refusée, c'est presque toujours qu'elle a été copiée incomplètement : reprends-la depuis le <code>S</code> de <code>SKAN1.</code> jusqu'au tout dernier caractère, sans espace ni retour à la ligne oublié.</p>

<h3>Changer d'ordinateur</h3>
<p>La même clé fonctionne sur ton nouvel ordinateur : colle-la, et c'est tout. Elle est liée à ton entreprise, pas à une machine.</p>`
    },
    {
      id: 'donnees', title: 'Tes données : sauvegarder et protéger', sub: 'Le sujet le plus ennuyeux et le plus important',
      body: `
<p>Tes données vivent dans un fichier unique sur ton ordinateur. Son chemin exact est affiché dans <b>Paramètres → Données et sécurité</b>.</p>
<p class="small muted">Les Paramètres ont cinq onglets : <b>Mon entreprise</b> (ce qui s'imprime en haut de tes documents, ton régime fiscal, ton RIB), <b>Documents</b> (délais, taxes, logo et couleurs, textes imprimés), <b>Envois</b> (messagerie, comptable, modèles de messages, appairage du cabinet), <b>Données et sécurité</b> (cette page : dossiers, sauvegardes, mot de passe) et <b>L'application</b> (thème, modules affichés, mises à jour, licence, dépannage).</p>
<p class="small muted">Tu ne sais pas dans quel onglet un réglage a été rangé ? <b>Ne cherche pas : tape son nom</b> dans le champ de recherche, en haut à droite de la page des Paramètres. Il répond sur les soixante réglages, onglet par onglet, et t'emmène directement dessus.</p>
<h3>Les trois filets de sécurité</h3>
<ul>
  <li><b>La sauvegarde quotidienne</b> : chaque jour, l'état de tes données au premier enregistrement est copié dans un dossier <b>backups</b>. Trente jours sont conservés. Une fausse manipulation aujourd'hui se répare en revenant à hier.</li>
  <li><b>La copie externe</b> : le dossier que tu as choisi (iCloud Drive, OneDrive, clé USB, disque réseau) reçoit une copie à chaque enregistrement. C'est ce qui te sauve si l'ordinateur est perdu, volé ou noyé.</li>
  <li><b>L'export</b> : un fichier unique que tu peux ranger où tu veux. Fais-en un avant chaque grande manipulation.</li>
</ul>
<h3>Restaurer</h3>
<p>Clique sur <b>Importer</b> et choisis un fichier du dossier backups (ils sont datés). Une sauvegarde de l'état actuel est prise avant, donc même une restauration ratée se rattrape.</p>
<h3>Le mot de passe</h3>
<p><b>Paramètres → Données et sécurité → Mot de passe</b> chiffre le fichier et toutes ses sauvegardes. Il sera demandé à chaque ouverture. Utile si ton ordinateur voyage.</p>
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
<p>C'est le rôle des <b>dossiers</b> (Paramètres → Données et sécurité). Tu crées un dossier par entreprise et tu passes de l'un à l'autre en un clic. Rien de commun entre eux, pas même les paramètres.</p>
<h3>Cas 2 — deux personnes, une entreprise</h3>
<p>Deux ordinateurs travaillent sur la même société. Là, il faut un <b>dossier partagé</b> : un dossier posé dans iCloud Drive, OneDrive, un disque réseau ou une clé USB, que les deux postes ouvrent.</p>
<h3>Comment on s'y prend, dans l'ordre</h3>
<p><b>Tu as déjà saisi ton entreprise ?</b> Alors tu la partages telle quelle — il n'y a rien à ressaisir et rien à recréer.</p>
<ol>
  <li><b>Sur ton ordinateur</b>, ouvre l'entreprise à partager, puis Paramètres → Données et sécurité → <b>Partager ce dossier à deux…</b> (c'est aussi dans le menu en haut de la barre de gauche, sous le nom de l'entreprise). Choisis l'emplacement que vous voyez tous les deux. SkanFact y <b>copie</b> tout : la copie d'origine reste sur ton disque, au cas où.</li>
  <li><b>Sur le second ordinateur</b>, installe SkanFact, puis <b>Rejoindre un dossier déjà partagé…</b> et désigne le dossier que le premier vient d'y poser (son nom commence par « SkanFact- »). Rien n'est créé : il ouvre celui-là. Pas d'assistant de première utilisation, pas de nom d'entreprise à retaper.</li>
  <li>Attendez que la synchronisation soit finie (iCloud et OneDrive affichent une petite icône pendant l'envoi) avant d'ouvrir de l'autre côté.</li>
</ol>
<p>Si le dossier est protégé par un mot de passe, il sera demandé au second poste : c'est le même que chez toi, et il n'est écrit nulle part — il faut se le dire de vive voix.</p>
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
  <li><b>Donnez un nom clair à chaque poste</b> (Paramètres → Données et sécurité → Ce poste) : les messages diront « les modifications du PC du bureau ont été reprises » plutôt qu'un nom technique.</li>
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
  <li><b>Aucune donnée partagée.</b> Les pièces ne passent par aucun serveur : ce que fait l'un reste chez l'un.</li>
  <li><b>Numérotation indépendante.</b> Chaque installation a ses propres séries DEV, FAC et AVO, qui repartent à 001 chaque janvier.</li>
</ul>
<h3>Pour installer chez un proche</h3>
<ol>
  <li>Télécharge le fichier d'installation depuis la page des versions (menu <b>Aide → Toutes les versions</b>) : le <code>.dmg</code> pour un Mac, le <code>.exe</code> pour Windows.</li>
  <li>Sur Mac, ouvre le <code>.dmg</code> et glisse SkanFact dans Applications. À la première ouverture, macOS demande confirmation parce que l'application n'est pas signée par Apple : clic droit sur l'icône puis <b>Ouvrir</b>.</li>
  <li>Au premier lancement, l'assistant se déroule : raison sociale, matricule, activité, règles de facturation, RIB, dossier de sauvegarde.</li>
  <li>Les mises à jour arrivent toutes seules, sans rien à configurer : SkanFact cherche toutes les quatre heures, télécharge en arrière-plan et te propose de redémarrer quand la nouvelle version est prête. <span class="small muted">(Il fallait autrefois coller un jeton d'accès : ce n'est plus le cas depuis que le dépôt est public.)</span></li>
</ol>
<h3>Les versions bêta</h3>
<p>Il existe <b>deux canaux</b> de mise à jour. Le canal <b>normal</b> est celui de tout le monde : il ne propose que les versions terminées. Le canal <b>bêta</b>, l'interrupteur « Versions d'essai » dans Paramètres → L'application → Mises à jour, ajoute les versions d'essai — leur numéro finit par <code>-beta</code>, et la ligne dit laquelle est en cours — qui servent à vérifier une nouveauté avant de la livrer aux autres.</p>
<p>Une bêta peut contenir des défauts : c'est exactement ce à quoi elle sert. Elle s'installe par-dessus SkanFact et travaille sur les mêmes données, donc une sauvegarde <code>avant-beta</code> est prise au moment où tu l'actives, et le mot <b>bêta</b> reste affiché en haut à gauche tant que tu tournes dessus. Sur l'ordinateur qui tient la vraie comptabilité — le tien, celui de ta famille — laisse l'interrupteur désactivé.</p>
<h3>Ce qu'il faut leur dire</h3>
<p>Trois choses suffisent pour bien démarrer :</p>
<ul>
  <li>Mettre en place la <b>copie externe</b> tout de suite (iCloud Drive, OneDrive ou clé USB).</li>
  <li>Une facture, une fois émise, ne se modifie plus : on corrige par un <b>avoir</b>.</li>
  <li>Les petits <b>i</b> à côté des champs expliquent tout, et cette rubrique Aide répond au reste.</li>
</ul>
<p class="small muted">Chaque activité a ses taux de TVA et ses obligations. Ce que dit cette aide vaut pour le cas général : c'est le comptable de chacun qui tranche pour son entreprise.</p>`
    },
    {
      id: 'support', title: 'Si quelque chose ne va pas', sub: 'Ce qu\'il faut faire, et ce qu\'il faut envoyer',
      body: `
<h3>L'application ne répond plus</h3>
<p>Depuis la version 6.6.0, SkanFact <b>se surveille lui-même</b> : toutes les trois secondes, il vérifie que son interface répond encore. Si elle reste muette une douzaine de secondes, il note dans son journal <b>où le programme s'est arrêté</b>, interrompt ce qui tourne en boucle, et te propose de recharger.</p>
<p>Pourquoi c'est important : un gel ne laisse normalement <b>aucune trace</b>. Rien ne plante, aucune erreur n'apparaît, les journaux restent vides — et la personne devant l'écran n'a rien à envoyer pour qu'on l'aide. C'est exactement ce qui est arrivé avec la version 5.1.0. Maintenant, un gel devient un rapport.</p>
<p>Réponds <b>Recharger l'application</b> : tes données enregistrées ne risquent rien. Ce qui était en cours de saisie et jamais enregistré est perdu — il l'était déjà de toute façon.</p>

<h3>Signaler un problème</h3>
<p><b>Aide → Signaler un problème</b> prépare le message. Décris ce que tu faisais : c'est le seul élément qu'on ne peut pas deviner, et c'est celui qui permet de reproduire le problème — donc de le corriger.</p>
<p>Le message emporte la version, ton système, et le journal technique. <b>Il ne contient aucune donnée de ton entreprise</b> : ni nom de client, ni montant, ni document. Le bouton « Voir le journal » te le montre avant.</p>

<h3>Avant d'appeler à l'aide</h3>
<ul>
<li><b>Note la version</b> (en bas de la barre de gauche) et ce que tu faisais exactement.</li>
<li><b>Fais une sauvegarde</b> (Paramètres → Données et sécurité) : ça ne coûte rien et ça protège tout.</li>
<li>Si l'application refuse de démarrer, tes données sont toujours là : le fichier et les sauvegardes vivent dans le dossier indiqué dans Paramètres → Données et sécurité.</li>
</ul>

<h3>Ce qui n'est jamais perdu</h3>
<p>Tes données sont un fichier sur ton disque, plus une sauvegarde par jour pendant 30 jours, plus les sauvegardes nommées que tu as prises. Même une application cassée ne les emporte pas : réinstaller SkanFact les retrouve telles quelles.</p>`
    },
    {
      id: 'vocabulaire', title: 'Le vocabulaire', sub: 'Les mots qu\'on emploie sans les expliquer',
      // Ce glossaire s'était arrêté à la 2.0 : seize mots de vente, et pas un seul des quinze
      // modules ajoutés depuis. Quelqu'un qui butait sur « VNC », « assiette », « prorata » ou
      // « partie double » le consultait, ne trouvait rien, et concluait que le glossaire ne sert
      // à rien. Un mot affiché quelque part dans l'application se définit ici.
      body: `
<p class="small muted">Les mots de gestion qu'on emploie sans les expliquer, dans l'ordre où tu les
rencontres. Si un mot affiché dans l'application manque ici, c'est un défaut : signale-le.</p>
<h3>Vendre et facturer</h3>
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
  <dt>Proforma</dt><dd>Une facture « pour la forme » : elle a l'apparence d'une facture mais n'en est pas une. Elle sert à obtenir un accord, un financement ou un dédouanement. Elle ne compte ni dans ton chiffre d'affaires ni dans ta TVA.</dd>
  <dt>Bon de livraison</dt><dd>La pièce qui accompagne la marchandise et que le client signe à la réception. Elle prouve la livraison ; la facture, elle, réclame l'argent.</dd>
</dl>

<h3>Acheter</h3>
<dl class="gloss">
  <dt>TVA déductible</dt><dd>La TVA que tu as payée à tes fournisseurs. Tu la retranches de la TVA que tu as collectée sur tes ventes : tu ne verses à l'État que la différence.</dd>
  <dt>TVA collectée</dt><dd>La TVA que tes clients t'ont payée. Elle ne t'appartient pas : tu la gardes le temps de la reverser.</dd>
  <dt>Crédit de TVA</dt><dd>Quand tu as payé plus de TVA que tu n'en as collecté (un gros achat, un mois creux). Il ne se perd pas : il se reporte sur le mois suivant.</dd>
  <dt>Destination d'une ligne</dt><dd>Ce que devient ce que tu achètes : une <b>charge</b> (consommé tout de suite), du <b>stock</b> (revendu plus tard), ou une <b>immobilisation</b> (gardé plusieurs années). Le choix change où la dépense apparaît dans tes comptes.</dd>
  <dt>Échéancier fournisseur</dt><dd>Ce que tu dois, et quand. L'équivalent de tes relances, vu de l'autre côté.</dd>
</dl>

<h3>Stock</h3>
<dl class="gloss">
  <dt>Coût moyen pondéré</dt><dd>Le prix de revient moyen d'un article, recalculé à chaque entrée. Cinq disques à 200 DT plus dix à 230 donnent un coût moyen de 220 DT. Les sorties partent à ce coût-là.</dd>
  <dt>Coût des marchandises vendues</dt><dd>Ce que les articles sortis t'ont coûté. C'est <b>ça</b>, la charge — pas l'achat lui-même : acheter de la marchandise, c'est transformer de l'argent en stock, pas le dépenser.</dd>
  <dt>Inventaire</dt><dd>Le comptage réel, rayon par rayon, comparé à ce que l'application croit avoir. L'écart se saisit, il ne se devine pas.</dd>
  <dt>Numéro de série</dt><dd>L'identifiant unique d'une unité précise. Il permet de savoir qui a quoi, depuis quand, et jusqu'à quand c'est garanti.</dd>
</dl>

<h3>Ce que tu gardes</h3>
<dl class="gloss">
  <dt>Immobilisation</dt><dd>Un bien qui reste dans l'entreprise plusieurs années : ordinateur, véhicule, mobilier, machine. Il ne se déduit pas d'un coup, mais année après année.</dd>
  <dt>Amortissement</dt><dd>La part de la valeur d'un bien que tu déduis chaque année, sur sa durée d'usage. Une camionnette à 60 000 DT sur 5 ans, c'est 12 000 DT par an.</dd>
  <dt>Dotation</dt><dd>Le montant amorti sur une période précise. C'est la ligne qui part en charge dans tes comptes.</dd>
  <dt>VNC (valeur nette comptable)</dt><dd>Ce que le bien vaut encore dans tes comptes : sa valeur d'achat moins tout ce qui a déjà été amorti. Ce n'est <b>pas</b> son prix de revente.</dd>
  <dt>Prorata temporis</dt><dd>Au prorata du temps. Un bien mis en service le 1<sup>er</sup> octobre ne s'amortit que trois mois la première année, pas douze.</dd>
  <dt>Base 360</dt><dd>Convention de calcul qui compte chaque mois pour 30 jours et l'année pour 360. Elle simplifie les proratas, et c'est l'usage. <em>À VÉRIFIER avec ton comptable.</em></dd>
  <dt>Exercice</dt><dd>L'année comptable de l'entreprise. En général l'année civile, du 1<sup>er</sup> janvier au 31 décembre.</dd>
  <dt>Plus ou moins-value de cession</dt><dd>La différence entre le prix auquel tu vends un bien et sa VNC du jour. Au-dessus, c'est un gain ; en dessous, une perte.</dd>
</dl>

<h3>Savoir si tu gagnes de l'argent</h3>
<dl class="gloss">
  <dt>Marge</dt><dd>Ce qui reste d'une vente une fois retiré ce qu'elle t'a coûté. Un chiffre d'affaires élevé avec une marge nulle ne nourrit personne.</dd>
  <dt>Affaire</dt><dd>Un chantier, une mission, un projet : tout ce qui rassemble des ventes et des achats qui vont ensemble. C'est le seul endroit où la marge est <b>exacte</b>, parce qu'elle compare des factures réelles à des achats réels.</dd>
  <dt>Charge fixe</dt><dd>Ce que tu paies que tu vendes ou non : loyer, salaires, assurances, abonnements.</dd>
  <dt>Charge variable</dt><dd>Ce qui augmente avec les ventes : marchandises, sous-traitance, matières.</dd>
  <dt>Marge sur coûts variables</dt><dd>Ce qui reste de chaque dinar vendu une fois payées les charges variables. C'est elle qui doit couvrir les charges fixes.</dd>
  <dt>Seuil de rentabilité</dt><dd>Le chiffre d'affaires à partir duquel tu commences à gagner de l'argent. En dessous, tu travailles à perte. <em>À VÉRIFIER avec ton comptable : le classement fixe/variable de tes charges.</em></dd>
  <dt>Prévision de trésorerie</dt><dd>Ce qui va entrer et sortir dans les semaines à venir, d'après les échéances déjà engagées. Ce n'est pas une promesse : un client peut payer en retard.</dd>
  <dt>Rapprochement bancaire</dt><dd>Pointer un à un les mouvements de ton relevé avec ceux de l'application, pour vérifier qu'aucun ne manque.</dd>
</dl>

<h3>Payer quelqu'un</h3>
<dl class="gloss">
  <dt>Brut</dt><dd>Le salaire avant toute retenue. C'est ce qui figure sur le contrat.</dd>
  <dt>Net</dt><dd>Ce que le salarié reçoit réellement, une fois retirées les cotisations et l'impôt.</dd>
  <dt>Coût employeur</dt><dd>Ce que le salarié te coûte vraiment : son brut plus les cotisations à ta charge. C'est ce chiffre-là qui entre dans ton résultat, ni le brut ni le net.</dd>
  <dt>Assiette</dt><dd>La part du salaire sur laquelle se calcule une cotisation. Elle n'est pas toujours égale au brut : certaines primes en sortent, certaines cotisations sont plafonnées. <em>À VÉRIFIER avec ton comptable.</em></dd>
  <dt>CNSS</dt><dd>Caisse nationale de sécurité sociale. Chaque salaire lui donne lieu à une part retenue sur le salarié et une part à ta charge.</dd>
  <dt>IRPP</dt><dd>Impôt sur le revenu des personnes physiques, retenu sur le salaire et reversé par toi. Il se calcule par tranches, chacune sur la part du revenu qui la traverse.</dd>
  <dt>Déclaration d'employeur</dt><dd>Le formulaire annuel qui récapitule <b>deux choses distinctes</b> : les salaires versés, et les retenues à la source pratiquées sur des fournisseurs (honoraires, loyers).</dd>
  <dt>Solde de tout compte</dt><dd>Le décompte remis au départ d'un salarié : dernier salaire, congés non pris, indemnités.</dd>
</dl>

<h3>Ton comptable</h3>
<dl class="gloss">
  <dt>Écriture comptable</dt><dd>La traduction d'une pièce dans la langue de ton comptable. Chaque facture, achat ou bulletin en produit plusieurs.</dd>
  <dt>Partie double</dt><dd>La règle qui veut que toute écriture s'inscrive deux fois, pour le même montant : une fois au débit, une fois au crédit. Si les deux totaux ne sont pas égaux, il manque quelque chose.</dd>
  <dt>Débit / Crédit</dt><dd>Les deux colonnes. Elles ne veulent pas dire « moins » et « plus » : leur sens dépend du compte. Un montant négatif change de colonne, il ne garde jamais son signe.</dd>
  <dt>Plan de comptes</dt><dd>La liste des numéros de compte utilisés. <b>Ceux proposés ne sont pas une vérité</b> : chaque cabinet a les siens, demande-lui et modifie-les.</dd>
  <dt>Grand livre</dt><dd>Les écritures rangées par compte : pour chaque compte, ses mouvements un à un et le solde qui avance. C'est le « mouvement de compte » que ton comptable demande.</dd>
  <dt>Livre-journal</dt><dd>Toutes les écritures de l'exercice, dans l'ordre, chaque pièce avec un numéro continu. C'est le livre que la loi demande de tenir, coté et paraphé.</dd>
  <dt>Opération diverse (OD)</dt><dd>Une écriture saisie à la main, pour ce qui n'a ni facture, ni achat, ni règlement. Elle n'entre qu'équilibrée.</dd>
  <dt>Journal centralisateur</dt><dd>Le récapitulatif mois par mois et journal par journal des totaux au débit et au crédit.</dd>
  <dt>Lettrage</dt><dd>Le rapprochement d'un règlement et de sa facture. Une pièce soldée porte sa lettre ; ce qui reste ouvert est ce que le client doit encore, ou ce que tu dois encore.</dd>
  <dt>À-nouveau</dt><dd>L'écriture qui rouvre un exercice avec les soldes de bilan de la veille. Les charges et les produits n'en ont pas : ils repartent de zéro.</dd>
  <dt>Bilan</dt><dd>La photographie à une date : ce que l'entreprise possède (actif) face à ce qu'elle doit et ce qui lui appartient (passif). Les deux totaux sont égaux.</dd>
  <dt>État de résultat</dt><dd>Le film de l'exercice : les produits moins les charges. Positif, c'est un bénéfice.</dd>
  <dt>État de rapprochement</dt><dd>Le tableau qui part du solde du relevé bancaire, ajoute ce que la banque n'a pas encore crédité, retire ce qu'elle n'a pas encore débité, et retombe sur le solde comptable.</dd>
  <dt>TFP</dt><dd>La taxe de formation professionnelle : une taxe patronale sur la masse salariale, 2 % en général.</dd>
  <dt>FOPROLOS</dt><dd>Le fonds de promotion du logement pour les salariés : 1 % de la masse salariale, à la charge de l'employeur.</dd>
  <dt>Balance</dt><dd>Tous les comptes sur une page — solde d'ouverture, mouvements, solde de fin — avec des totaux qui doivent être égaux au débit et au crédit. Le premier contrôle d'un cabinet.</dd>
  <dt>Solde d'ouverture</dt><dd>Ce qu'un compte portait la veille du premier jour de la période. Les comptes de bilan le gardent d'une année sur l'autre ; les charges et les produits repartent de zéro au 1er janvier.</dd>
  <dt>Compte auxiliaire</dt><dd>Un sous-compte par tiers : 411001 pour un client, 401001 pour un fournisseur. La balance auxiliaire les liste un par un, avec ce que chacun doit ou est dû.</dd>
  <dt>Clôturer une période</dt><dd>Déclarer qu'un mois ne bougera plus, parce que tu l'as transmis. L'application refuse ensuite toute écriture à ces dates, sauf réouverture motivée.</dd>
  <dt>Paquet mensuel</dt><dd>Le fichier unique que tu envoies à ton comptable : tous les PDF du mois, les journaux, et une empreinte de chaque pièce pour qu'il puisse vérifier que rien n'a bougé en route.</dd>
  <dt>Provisoire / définitif</dt><dd>Un paquet est <b>définitif</b> quand le mois était clôturé au moment de l'envoi : les chiffres ne bougeront plus. <b>Provisoire</b>, ils peuvent encore changer — ce n'est pas un défaut, c'est une information pour ton comptable.</dd>
  <dt>Empreinte</dt><dd>Une suite de caractères calculée à partir d'un fichier. Deux fichiers identiques donnent la même ; un octet change, elle change entièrement. C'est ce qui prouve qu'une pièce reçue est bien celle qui a été envoyée.</dd>
</dl>`
    },
    {
      id: 'raccourcis', title: 'Raccourcis clavier', sub: 'Aller plus vite au clavier',
      body: `
<p>Les deux premiers sont ceux qui servent tous les jours : l'un ouvre cette aide, l'autre cherche n'importe quoi — un client, une facture, une prestation, un écran.</p>
<table class="keys">
  <tr><th>Ouvrir l'aide</th><td><kbd>⌘</kbd> <kbd>?</kbd></td></tr>
  <tr><th>Rechercher partout</th><td><kbd>⌘</kbd> <kbd>K</kbd></td></tr>
  <tr><th>Revenir à l'écran précédent</th><td><kbd>⌘</kbd> <kbd>[</kbd></td></tr>
  <tr><th>Nouveau devis</th><td><kbd>⌘</kbd> <kbd>N</kbd></td></tr>
  <tr><th>Nouvelle facture</th><td><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>N</kbd></td></tr>
  <tr><th>Enregistrer</th><td><kbd>⌘</kbd> <kbd>S</kbd></td></tr>
  <tr><th>Exporter en PDF</th><td><kbd>⌘</kbd> <kbd>P</kbd></td></tr>
  <tr><th>Voir le document en grand</th><td><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>A</kbd></td></tr>
  <tr><th>Réglages</th><td><kbd>⌘</kbd> <kbd>,</kbd></td></tr>
  <tr><th>Accueil, Devis, Factures, Clients, Catalogue</th><td><kbd>⌘</kbd> <kbd>1</kbd> à <kbd>5</kbd></td></tr>
  <tr><th>Comptabilité</th><td><kbd>⌘</kbd> <kbd>6</kbd></td></tr>
  <tr><th>Achats et dépenses</th><td><kbd>⌘</kbd> <kbd>7</kbd></td></tr>
  <tr><th>Trésorerie</th><td><kbd>⌘</kbd> <kbd>8</kbd></td></tr>
  <tr><th>Marges et rentabilité</th><td><kbd>⌘</kbd> <kbd>9</kbd></td></tr>
  <tr><th>Verrouiller l'application</th><td><kbd>⌘</kbd> <kbd>L</kbd></td></tr>
  <tr><th>Valider une fenêtre</th><td><kbd>Entrée</kbd></td></tr>
  <tr><th>Fermer une fenêtre</th><td><kbd>Échap</kbd></td></tr>
</table>
<p class="small muted">Tu n'as rien à retenir : le champ <b>Rechercher…</b> en haut de la barre de gauche fait la même chose que <kbd>⌘</kbd> <kbd>K</kbd>, et chaque raccourci est écrit à côté de sa commande dans les menus de l'application.</p>`
    }
  ];

  // ---------- l'Aide, refondue (7.23.0) ----------
  //
  // Trente-deux titres dans une liste plate, et un pavé de prose à droite : ce n'était pas une
  // aide, c'était un livre. Quelqu'un qui cherche « pourquoi ma TVA ne tombe pas juste » ne sait
  // pas si la réponse est dans « Se faire payer », « Ta comptabilité mois par mois » ou « Tes
  // achats et ta TVA déductible ». On choisit un TERRITOIRE avant de choisir un titre.
  //
  // Chaque article appartient à un thème et un seul : un test le vérifie, et vérifie aussi qu'il
  // n'en manque aucun. Une liste écrite à la main dérive au premier article ajouté.
  // `icon` : le dessin du thème (tracé SVG 24×24, même langage que les icônes de la barre latérale).
  // La COULEUR, elle, ne vit pas ici mais dans style.css, sous `[data-theme="<id>"]` : une couleur
  // écrite dans le JavaScript ne sait pas se retourner en mode sombre. Un test vérifie que chaque
  // thème d'ici a bien sa règle là-bas — sinon un huitième thème naîtrait gris parmi sept colorés.
  const THEMES = [
    { id: 'commencer', label: 'Commencer', sub: 'Le vocabulaire, les premiers gestes, et par où prendre le sujet.',
      icon: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
      articles: ['demarrer', 'gestion', 'vocabulaire', 'raccourcis'] },
    { id: 'vendre', label: 'Vendre et facturer', sub: 'Du devis à la facture, et tout ce qui se glisse entre les deux.',
      icon: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h4"/>',
      articles: ['devis', 'facture', 'avoir', 'acompte', 'contrats', 'etranger', 'pieces'] },
    { id: 'encaisser', label: 'Encaisser', sub: 'Être payé, relancer sans se fâcher, et savoir ce qu\'il reste en caisse.',
      icon: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/>',
      articles: ['paiements', 'tresorerie'] },
    { id: 'acheter', label: 'Acheter, stocker, équiper', sub: 'L\'argent qui sort, ce qui dort sur l\'étagère, et ce que tu gardes.',
      icon: '<path d="M3 8l9-4 9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4"/><path d="M12 12v8"/>',
      articles: ['achats', 'stock', 'series', 'immobilisations', 'lecture'] },
    { id: 'declarer', label: 'Déclarer et clôturer', sub: 'La TVA, le mois qu\'on ferme, et le dossier qu\'on envoie au comptable.',
      icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
      articles: ['fiscal', 'compta', 'cloture', 'declarations', 'cabinet'] },
    { id: 'equipe', label: 'Ton équipe', sub: 'Payer quelqu\'un, et les papiers qui vont avec.',
      icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5"/><path d="M16.5 5a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.8c2.4.8 4 2.5 4 5.2"/>',
      articles: ['paie', 'conges'] },
    { id: 'piloter', label: 'Piloter et protéger', sub: 'Gagnes-tu de l\'argent, et que se passe-t-il si l\'ordinateur lâche.',
      icon: '<path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/><path d="M3 21h18"/>',
      articles: ['marges', 'statistiques', 'donnees', 'deux', 'partager', 'licence', 'support'] }
  ];

  // Le geste qui suit la lecture. Six liens vers l'application dans 99 Ko de texte : chaque article
  // finissait par un point, c'est-à-dire par un cul-de-sac. On lit une explication pour FAIRE
  // quelque chose — le bouton est la moitié qui manquait.
  // `hash` doit désigner une vraie route : un test le vérifie contre core.PAGES.
  const GESTES = {
    demarrer: { label: 'Ouvrir les Paramètres', hash: '#/parametres' },
    gestion: { label: 'Aller à l\'accueil', hash: '#/dashboard' },
    devis: { label: 'Voir mes devis', hash: '#/devis' },
    facture: { label: 'Voir mes factures', hash: '#/factures' },
    avoir: { label: 'Voir mes factures', hash: '#/factures' },
    acompte: { label: 'Voir mes devis', hash: '#/devis' },
    contrats: { label: 'Voir mes contrats', hash: '#/contrats' },
    etranger: { label: 'Voir mes devis', hash: '#/devis' },
    pieces: { label: 'Proforma, bons et contrats', hash: '#/autres' },
    paiements: { label: 'Voir les relances', hash: '#/relances' },
    tresorerie: { label: 'Ouvrir la trésorerie', hash: '#/tresorerie' },
    achats: { label: 'Voir mes achats', hash: '#/achats' },
    stock: { label: 'Ouvrir le stock', hash: '#/stock' },
    series: { label: 'Voir les garanties', hash: '#/garanties' },
    immobilisations: { label: 'Voir mes immobilisations', hash: '#/immos' },
    lecture: { label: 'Saisir un achat', hash: '#/achats' },
    fiscal: { label: 'Ouvrir la comptabilité', hash: '#/compta' },
    compta: { label: 'Ouvrir la comptabilité', hash: '#/compta' },
    cloture: { label: 'Aller aux clôtures', hash: '#/compta' },
    declarations: { label: 'Ouvrir la paie', hash: '#/paie' },
    cabinet: { label: 'Préparer le paquet du mois', hash: '#/compta' },
    paie: { label: 'Ouvrir la paie', hash: '#/paie' },
    conges: { label: 'Ouvrir la paie', hash: '#/paie' },
    marges: { label: 'Voir mes marges', hash: '#/marges' },
    statistiques: { label: 'Voir mes statistiques', hash: '#/stats' },
    donnees: { label: 'Données et sécurité', hash: '#/parametres' },
    deux: { label: 'Ouvrir les Paramètres', hash: '#/parametres' },
    partager: { label: 'Ouvrir les Paramètres', hash: '#/parametres' },
    licence: { label: 'Voir ma licence', hash: '#/parametres' }
    // `vocabulaire`, `raccourcis` et `support` n'ont volontairement pas de geste : on ne renvoie
    // nulle part depuis un glossaire, et « Signaler un problème » a déjà son propre bouton.
  };

  // L'aide s'ouvre LÀ OÙ L'ON EST. Le « ? » de chaque page ouvre l'article de cette page, au lieu
  // de déposer quelqu'un en haut d'une liste de trente-deux titres. Un test vérifie que chaque
  // page de l'application a son entrée et que chaque cible existe.
  const PAR_PAGE = {
    dashboard: 'demarrer', devis: 'devis', factures: 'facture', doc: 'facture',
    relances: 'paiements', autres: 'pieces', contrats: 'contrats', contrat: 'contrats',
    clients: 'gestion', client: 'gestion', catalogue: 'gestion',
    achats: 'achats', achat: 'achats', fournisseurs: 'achats', fournisseur: 'achats',
    tresorerie: 'tresorerie', marges: 'marges', affaire: 'marges',
    paie: 'paie', salarie: 'conges', stock: 'stock', article: 'stock', garanties: 'series',
    immos: 'immobilisations', immo: 'immobilisations', stats: 'statistiques',
    compta: 'compta', parametres: 'donnees', modules: 'gestion', licences: 'licence'
  };

  // Le thème d'un article, et ses voisins : « article suivant » évite de repasser par la liste.
  const themeOf = id => THEMES.find(t => t.articles.includes(id)) || null;

  return { INFO, ARTICLES, THEMES, GESTES, PAR_PAGE, themeOf };
});
