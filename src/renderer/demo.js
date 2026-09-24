// Jeu de données de démonstration : une petite société de cybersécurité, créée il y a CINQ ans.
//
// 10.14.0 — Skander : « simuler une entreprise qui est là depuis cinq ans, afin de charger les écrans
// et les tableaux partout, et voir ce qui casse quand c'est trop rempli ». Treize mois ne montraient
// jamais une liste de trois cents factures, un exercice clôturé, un salarié parti, un client qui ne
// commande plus depuis deux ans, ni la pagination de quoi que ce soit. L'histoire est en deux étages :
// les treize derniers mois restent écrits à la main, pièce par pièce, parce que c'est là que vivent
// tous les cas de figure qu'on veut montrer (retards aux trois niveaux, acompte et solde, avoirs,
// devise étrangère, contrats) ; les quatre années d'avant sont ENGENDRÉES, par un tirage fixe (le
// même jeu à chaque chargement), avec des volumes qui grandissent comme une entreprise qui démarre.
// Toutes les dates sont relatives à aujourd'hui pour que l'accueil, les relances, les contrats et la
// comptabilité soient toujours « vivants ». Fonctionne dans le navigateur (window.SkanDemo) et dans
// Node (npm test), comme core.js.
//
// Ce que la démo montre : douze factures mensuelles d'un contrat (avec retenue à la source et
// attestations reçues ou non), un contrat trimestriel, un contrat suspendu, un projet en acompte + solde,
// une facture annulée par un avoir, un avoir partiel, une facture partiellement payée, trois factures en
// retard aux trois niveaux de relance (avec relances déjà envoyées), un client étranger facturé en anglais
// et en euros, des devis acceptés / refusés / en attente / expirés / brouillon, un brouillon de facture,
// des modèles et des textes prédéfinis.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.SkanDemo = factory(root.SkanCore);
})(typeof self !== 'undefined' ? self : this, function (C) {

  // Champs société remplis seulement s'ils sont vides : la démo complète ce qui manque sans jamais
  // écraser ce que l'utilisateur a déjà saisi (nom, logo, cachet, thème…).
  const DEMO_COMPANY = {
    name: 'DÉMO — Société de services SUARL', matricule: '1234567X/A/M/000', rc: 'B01234562024', capital: '1 000 DT',
    address: '08 Rue de l\'Université, Manar 1\n2092 Tunis', tagline: 'Cybersécurité · Infrastructure · Services informatiques',
    phone: '+216 55 123 456', email: 'contact@exemple.tn', website: 'www.exemple.tn',
    bank: 'BIAT — Agence El Manar', rib: '00 006 0000123456789 01'
  };

  function buildDemoData(currentCompany, todayIso) {
    const T = todayIso || C.today();
    const d = C.migrateData(null);
    d.company = { ...d.company, ...JSON.parse(JSON.stringify(currentCompany || {})) };
    // Est-ce que l'utilisateur avait déjà une identité, ou est-ce que l'exemple la lui invente ?
    // La raison sociale dit si l'identité est ENTIÈREMENT empruntée — mais pas si elle l'est en
    // partie, et c'était le trou : l'assistant invite explicitement à laisser le matricule fiscal
    // et le RIB vides (« si tu ne l'as pas encore, laisse vide »). L'exemple les remplissait alors
    // avec les siens, `demo` restait faux puisque le nom était là, et plus rien ne les enlevait —
    // ni la sortie de l'exemple, ni « Tout effacer », ni les contrôles de conformité, qui ne
    // regardent que la PRÉSENCE. Un faux matricule fiscal sur une vraie facture est une pièce
    // non conforme, et l'application affirmait en vert que la fiche était en règle.
    // On note donc ce qui a été EMPRUNTÉ, champ par champ, pour pouvoir le rendre.
    const avaitUneSociete = !!(d.company.name || '').trim();
    const empruntes = [];
    Object.keys(DEMO_COMPANY).forEach(k => { if (!d.company[k]) { d.company[k] = DEMO_COMPANY[k]; empruntes.push(k); } });
    d.company.demoFields = empruntes;
    const co = d.company;
    const daysAgo = n => C.addDays(T, -n);
    const mo = (n, day) => C.addMonths(T, -n, day);   // n mois en arrière, au jour demandé
    const ts = iso => new Date(iso + 'T09:00:00').getTime();
    // Un tirage FIXE (mulberry32) : le même exemple à chaque chargement, donc les mêmes écrans, les
    // mêmes numéros et les mêmes totaux — un exemple qui change à chaque fois ne se décrit pas, et
    // un test qui le lit ne peut rien affirmer.
    let graine = 20210924;
    const alea = () => { graine |= 0; graine = graine + 0x6D2B79F5 | 0; let x = Math.imul(graine ^ graine >>> 15, 1 | graine); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
    const entre = (a, b) => a + Math.floor(alea() * (b - a + 1));
    const parmi = liste => liste[Math.floor(alea() * liste.length)];
    // L'histoire commence il y a soixante mois ; les treize derniers sont écrits à la main plus bas.
    const HIST_DEBUT = 59, HIST_FIN = 14;

    // ---------- clients ----------
    const mk = (name, matricule, address, phone, email, withholdingRate, extra) =>
      ({ id: C.uid(), name, contact: '', matricule, address, phone, email, notes: '', withholdingRate: withholdingRate == null ? '' : withholdingRate, ...(extra || {}) });
    d.clients = [
      mk('Clinique Les Jasmins', '1234567A/M/000', 'Avenue Habib Bourguiba\n2080 Ariana', '+216 71 700 100', 'direction@clinique-jasmins.tn', 1.5,
        { contact: 'Dr Leïla Mansour, directrice', notes: 'Contrat de maintenance mensuel, facturé le 1er du mois. Prévenir 48 h avant toute intervention sur le réseau.' }),
      mk('Pharmacie Centrale El Menzah', '2345678B/A/000', '12 rue Ibn Khaldoun\n1004 El Menzah', '+216 71 234 567', 'pharmacie.menzah@gmail.com'),
      mk('Cabinet Ben Salah Avocats', '3456789C/P/000', 'Immeuble Le Palmier, Lac 2\n1053 Tunis', '+216 71 960 200', 'contact@bensalah-avocats.tn', 1.5,
        { contact: 'Me Sonia Ben Salah', notes: 'Applique la retenue à la source (1,5 %) : demander l\'attestation à chaque règlement.' }),
      mk('Lemon Beach Hammamet', '4567890D/A/000', 'Zone touristique\n8050 Hammamet', '+216 72 280 300', 'hello@lemonbeach.tn', '',
        { contact: 'M. Sami Gharbi, directeur', notes: 'Règle souvent en retard : un appel est plus efficace qu\'un email.' }),
      mk('Restaurant Dar El Jeld', '5678901E/A/000', '5 rue Dar El Jeld, Médina\n1006 Tunis', '+216 71 560 916', 'reservation@dareljeld.tn'),
      mk('Mohamed Trabelsi', 'CIN 09876543', 'Résidence Les Oliviers, Bloc B\n2092 El Manar', '+216 98 765 432', 'm.trabelsi@outlook.com', 0),
      mk('Nova Digital Ltd', 'GB 123 4567 89', '20 Eastbourne Terrace\nLondon W2 6LG, United Kingdom', '+44 20 7946 0958', 'ops@novadigital.co.uk', 0,
        { contact: 'James Whitfield, CTO', lang: 'en', currency: 'EUR', notes: 'Client étranger : documents en anglais, facturation en euros. Export de services facturé sans TVA — À VÉRIFIER avec le comptable.' }),
      mk('École Internationale Les Lauriers', '6789012F/A/000', 'Rue du Lac Léman, Les Berges du Lac\n1053 Tunis', '+216 71 861 400', 'admin@leslauriers.tn', 1.5, { contact: 'M. Karim Hached, intendant' })
    ];
    // Cinq ans de clients : ceux d'aujourd'hui, et tous ceux d'avant — dont certains ne commandent
    // plus depuis longtemps (c'est ce qui remplit la liste, et c'est ce qui la rend vraie).
    const MF = () => `${String(entre(1000000, 1999999))}${'ABCDEFGHJKLMNPQRSTVWXYZ'[entre(0, 22)]}/A/M/000`;
    const plus = [
      ['Société Tunisienne de Distribution SA', 'Zone industrielle Charguia 2\n2035 Tunis', 1.5, 'M. Hatem Chebbi, DSI'],
      ['Clinique El Amen Nabeul', 'Avenue Habib Thameur\n8000 Nabeul', 1.5, 'Mme Sarra Jaziri, direction'],
      ['Pharmacie Ennasr', '14 avenue Hédi Nouira, Ennasr 2\n2037 Ariana', '', ''],
      ['Cabinet d\'architecture Ben Ammar', '3 rue du Lac Turkana, Les Berges du Lac\n1053 Tunis', '', 'M. Walid Ben Ammar'],
      ['Sfax Ingénierie SARL', 'Route de Tunis km 3\n3027 Sfax', '', 'M. Anis Frikha'],
      ['Transports Chaabane SARL', 'Zone logistique Radès\n2040 Radès', '', ''],
      ['Laboratoire d\'analyses Dr Kallel', '22 rue d\'Alger\n1000 Tunis', 1.5, 'Dr Imen Kallel'],
      ['Assurances Maghreb — Agence Menzah', 'Centre Zenith, El Menzah 6\n2091 Ariana', 1.5, 'M. Riadh Sassi'],
      ['Groupe scolaire Ibn Rochd', 'Rue Ibn Rochd\n2080 Ariana', 1.5, 'Mme Nadia Ferchichi, économe'],
      ['Hôtel Royal Sousse', 'Boulevard du 14 Janvier\n4051 Sousse', 1.5, 'M. Karim Ayari, directeur technique'],
      ['Carthage Tours', '45 avenue Habib Bourguiba\n2016 Carthage', '', ''],
      ['Imprimerie Nouvelle El Mourouj', 'Zone artisanale El Mourouj 5\n2074 Ben Arous', '', ''],
      ['Boulangerie Moderne Ariana', '6 rue de la République\n2080 Ariana', '', ''],
      ['Auto-école El Kheir', '18 avenue de la Liberté\n1002 Tunis', '', ''],
      ['Centre médical Les Oliviers', 'Résidence Les Oliviers\n2092 El Manar', 1.5, 'Dr Hichem Baccar'],
      ['Amen Plast SARL', 'Zone industrielle\n5020 Monastir', '', 'M. Mounir Gharsallah'],
      ['Menuiserie Aluminium Béja', 'Route de Tunis\n9000 Béja', '', ''],
      ['Cabinet d\'expertise comptable Jlassi', 'Immeuble Carthage, Montplaisir\n1073 Tunis', '', 'M. Fathi Jlassi'],
      ['Restaurant La Marina Gammarth', 'Port de Gammarth\n2078 La Marsa', '', ''],
      ['Garage Ben Youssef Automobiles', 'Route de la Marsa km 8\n2046 Sidi Daoud', '', ''],
      ['Parapharmacie Lac 2', 'Rue du Lac Biwa, Lac 2\n1053 Tunis', '', ''],
      ['Wino Digital SUARL', 'Technopôle El Ghazala\n2088 Ariana', '', 'Mme Yosra Ben Salem'],
      ['Association Enfance et Avenir', '9 rue de Palestine\n1002 Tunis', '', ''],
      ['Clinique dentaire Dr Mzoughi', '31 avenue de Carthage\n1000 Tunis', '', 'Dr Amel Mzoughi'],
      ['Société Oléicole du Sahel', 'Route de Monastir\n4011 Sousse', 1.5, 'M. Slim Ben Hmida'],
      ['Sami Ben Youssef', 'Cité Ennasr 1\n2037 Ariana', 0, ''],
      ['Rania Chaouch', 'Rue des Jasmins, La Soukra\n2036 Ariana', 0, '']
    ].map(([nom, adresse, rs, contact], i) => {
      const particulier = rs === 0;
      const slug = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 18);
      return mk(nom, particulier ? `CIN ${entre(10000000, 19999999)}` : MF(), adresse, `+216 ${entre(20, 99)} ${entre(100, 999)} ${entre(100, 999)}`,
        particulier ? `${slug}@gmail.com` : `contact@${slug}.tn`, rs === '' ? '' : rs, contact ? { contact } : {});
    });
    d.clients.push(...plus);
    const cl = d.clients;
    // Les clients de l'histoire : ceux d'avant la fenêtre écrite à la main, et quelques anciens
    // d'aujourd'hui (la pharmacie, le cabinet d'avocats et l'hôtel sont clients depuis longtemps).
    const anciens = [1, 2, 3, 5].concat(plus.map((_, i) => 8 + i));

    // ---------- catalogue ----------
    // `unitCost` : ce que la prestation coûte réellement. Zéro quand on ne vend que du temps —
    // la marge affichée est alors le prix de vente, et c'est écrit dans la bulle d'aide.
    // `stock` : [quantité de départ, coût unitaire, seuil d'alerte, emplacement]. Seule la marchandise
    // est suivie — une prestation n'a pas de stock.
    const cat = (label, description, unitPrice, vatRate, unit, unitCost, stock, warranty) => ({
      id: C.uid(), label, description, unitPrice, vatRate, unit, unitCost: unitCost || 0,
      tracked: !!stock, initialQty: stock ? stock[0] : 0, initialCost: stock ? stock[1] : 0,
      minStock: stock ? stock[2] : 0, location: stock ? stock[3] : '', initialDate: stock ? (stock[4] || mo(13, 1)) : '',
      serialized: !!warranty, warrantyMonths: warranty || 0
    });
    d.catalog = [
      cat('Audit de sécurité réseau', 'Cartographie du réseau, scan de vulnérabilités, revue de configuration, rapport et plan d\'action', 1200, 19, 'forfait'),
      cat('Test d\'intrusion applicatif', 'Test en boîte grise sur une application web, rapport détaillé avec preuves et recommandations', 2500, 19, 'forfait'),
      cat('Installation et configuration pare-feu', 'Mise en place d\'un pare-feu (matériel fourni séparément), règles, VPN, journalisation', 850, 19, 'u'),
      cat('Sauvegarde externalisée', 'Sauvegarde chiffrée automatique avec vérification mensuelle de restauration', 90, 19, 'mois', 28),
      cat('Maintenance et supervision', 'Surveillance des équipements, mises à jour de sécurité, intervention sous 24 h', 250, 19, 'mois'),
      cat('Formation sensibilisation cybersécurité', 'Session pour les équipes : hameçonnage, mots de passe, bonnes pratiques', 150, 7, 'h'),
      cat('Installation poste de travail', 'Préparation, sécurisation et mise en réseau d\'un poste', 120, 19, 'u'),
      cat('Déplacement hors Grand Tunis', 'Frais de déplacement', 60, 19, 'u', 25),
      // Suivi en stock depuis la création de l'entreprise : quinze licences en réserve au départ,
      // réapprovisionnées au fil des ventes (l'histoire engendrée plus bas tient le compte).
      cat('Antivirus / EDR (licence 1 an)', 'Déploiement et licence annuelle par poste', 95, 19, 'poste', 52, [15, 48, 10, 'Armoire licences', mo(60, 1)]),
      cat('Hébergement et supervision serveur', 'Serveur virtuel supervisé, mises à jour et sauvegardes incluses', 180, 19, 'mois', 65),
      cat('Mise en conformité protection des données', 'Registre des traitements, procédures, déclaration à l\'INPDP', 1800, 19, 'forfait'),
      // Ajoutés en fin de liste : les indices k[0]…k[10] sont utilisés partout ci-dessous, les décaler
      // changerait toutes les pièces du jeu de démonstration.
      cat('Pare-feu UTM', 'Boîtier UTM avec licence de sécurité 1 an', 1650, 19, 'u', 1200, [2, 1200, 1, 'Réserve — étagère A'], 36),
      cat('Poste de travail complet', 'Unité centrale, écran 24\", clavier et souris, système installé', 1150, 19, 'u', 850, [3, 850, 4, 'Réserve — étagère B'], 24)
    ];
    const k = d.catalog;
    const line = (item, qty, price, unit) => ({ label: item.label, description: item.description, qty, unit: unit || item.unit, unitPrice: price != null ? price : item.unitPrice, unitCost: item.unitCost || '', vatRate: item.vatRate });

    // ---------- contrats ----------
    const recClinique = { id: C.uid(), clientId: cl[0].id, subject: 'Maintenance et supervision — {mois}', reference: '', lines: [line(k[4], 1), line(k[3], 1)], discountRate: 0, withholdingRate: 1.5,
      notes: 'Contrat annuel, facturation mensuelle à terme échu.', every: 'month', day: 1, nextDate: mo(0, 1), lastIssued: mo(1, 1), active: true, createdAt: ts(mo(12, 1)), lang: 'fr', currency: co.currency, exchangeRate: '' };
    const recEcole = { id: C.uid(), clientId: cl[7].id, subject: 'Hébergement et sauvegarde — trimestre {mois}', reference: '', lines: [line(k[9], 3), line(k[3], 3)], discountRate: 0, withholdingRate: 1.5,
      notes: 'Facturation trimestrielle d\'avance.', every: 'quarter', day: 15, nextDate: C.addMonths(mo(1, 15), 3, 15), lastIssued: mo(1, 15), active: true, createdAt: ts(mo(10, 15)), lang: 'fr', currency: co.currency, exchangeRate: '' };
    const recRestaurant = { id: C.uid(), clientId: cl[4].id, subject: 'Supervision et sauvegarde — {mois}', reference: '', lines: [line(k[4], 1), line(k[3], 1)], discountRate: 0, withholdingRate: 0,
      notes: 'Contrat suspendu : facture en retard de paiement.', every: 'month', day: 5, nextDate: C.addMonths(daysAgo(55), 1, 5), lastIssued: daysAgo(55), active: false, createdAt: ts(mo(4, 5)), lang: 'fr', currency: co.currency, exchangeRate: '' };
    d.recurring = [recClinique, recEcole, recRestaurant];

    // ---------- affaires (3.4.0) ----------
    // Deux cas volontairement différents : une affaire avec ses achats en face (marge exacte),
    // et une affaire sans achat (marge estimée à partir du coût de revient du catalogue).
    const prjLauriers = { id: C.uid(), name: 'Salle informatique — École Les Lauriers', clientId: cl[7].id, status: 'terminée',
      startDate: mo(2, 12), endDate: mo(2, 28), notes: 'Fourniture et installation de douze postes et d\'un pare-feu. Matériel acheté chez Tunisie Matériel Informatique.' };
    const prjLemon = { id: C.uid(), name: 'Réseau Wi-Fi — Lemon Beach', clientId: cl[3].id, status: 'en cours',
      startDate: mo(6, 9), endDate: '', notes: 'Bornes Wi-Fi fournies par l\'hôtel : aucun achat de notre côté, la marge est donc celle de la prestation. La facture du pare-feu reste impayée depuis près de trois mois.' };
    d.projects = [prjLauriers, prjLemon];

    // ---------- documents ----------
    // Chaque spécification : type, client (index), date, statut, objet, lignes (ou fonction des documents déjà créés),
    // remise, notes, paiements [{ after: jours après la date, amount: 'all' | 'half' | nombre, method, reference }],
    // emails [{ date, kind }] (les relances deviennent aussi des entrées « reminders »), certificate (attestation RS reçue).
    const specs = [];
    const add = (key, s) => specs.push({ key, ...s });
    const E = (date, kind) => ({ date, kind });
    const pay = (after, amount, method, reference) => ({ after, amount, method: method || 'virement', reference: reference || '' });
    const vir = (date) => `VIR ${date.slice(0, 4)}${date.slice(5, 7)}-${date.slice(8, 10)}`;

    // Clinique : audit initial (devis accepté → facture payée), puis douze factures mensuelles
    add('q-clin-audit', { type: 'devis', client: 0, date: mo(12, 8), status: 'accepté', subject: 'Sécurisation du réseau de la clinique',
      lines: [line(k[0], 1), line(k[2], 2), line(k[5], 3)], discountRate: 5, notes: 'Matériel pare-feu facturé séparément après validation du devis.', emails: [E(mo(12, 8), 'devis')] });
    add('f-clin-audit', { type: 'facture', client: 0, date: mo(11, 20), status: 'envoyée', subject: 'Sécurisation du réseau de la clinique', fromQuote: 'q-clin-audit', reference: 'BC 118',
      lines: [line(k[0], 1), line(k[2], 2), line(k[5], 3)], discountRate: 5, notes: 'Rapport d\'audit remis le jour de la facturation.', payments: [pay(28, 'all')], certificate: true, emails: [E(mo(11, 20), 'facture')] });
    const delays = { 12: 21, 11: 19, 10: 33, 9: 25, 8: 28, 7: 17, 6: 36, 5: 22, 4: 30, 3: 24, 2: 27 };
    for (let i = 12; i >= 1; i--) {
      const date = mo(i, 1);
      add('f-clin-m' + i, { type: 'facture', client: 0, date, status: 'envoyée', subject: 'Maintenance et supervision — ' + C.monthLabel(date), recurringId: recClinique.id,
        lines: [line(k[4], 1), line(k[3], 1)], notes: recClinique.notes, payments: i >= 2 ? [pay(delays[i], 'all')] : [], certificate: i >= 4, emails: [E(date, 'facture')] });
    }
    // Formation de rentrée, facturée il y a trois jours
    add('f-clin-formation', { type: 'facture', client: 0, date: daysAgo(3), status: 'envoyée', subject: 'Formation sensibilisation — session de rentrée', lines: [line(k[5], 4)], emails: [E(daysAgo(3), 'facture')] });

    // École : contrat trimestriel (quatre factures, la dernière sans attestation)
    [[10, 14, true], [7, 20, true], [4, 12, true], [1, 10, false]].forEach(([m, after, cert], i) => {
      const date = mo(m, 15);
      add('f-ecole-q' + (i + 1), { type: 'facture', client: 7, date, status: 'envoyée', subject: `Hébergement et sauvegarde — ${C.monthLabel(date)} à ${C.monthLabel(C.addMonths(date, 2, 1))}`, recurringId: recEcole.id,
        lines: [line(k[9], 3), line(k[3], 3)], notes: recEcole.notes, payments: [pay(after, 'all')], certificate: cert, emails: [E(date, 'facture')] });
    });

    // Restaurant : devis refusé, puis un contrat mensuel (une facture établie en double et annulée par avoir), suspendu après un impayé
    add('q-rest-wifi', { type: 'devis', client: 4, date: mo(8, 12), status: 'refusé', subject: 'Refonte du réseau Wi-Fi et supervision', lines: [line(k[0], 1), line(k[4], 12), line(k[7], 2)], discountRate: 10, emails: [E(mo(8, 12), 'devis')] });
    add('f-rest-m1', { type: 'facture', client: 4, date: mo(4, 5), status: 'envoyée', subject: 'Supervision et sauvegarde — ' + C.monthLabel(mo(4, 5)), recurringId: recRestaurant.id, lines: [line(k[4], 1), line(k[3], 1)], payments: [pay(20, 'all', 'cheque', 'CHQ 0045871')] });
    add('f-rest-double', { type: 'facture', client: 4, date: mo(4, 5), seq: 1, status: 'envoyée', subject: 'Supervision et sauvegarde — ' + C.monthLabel(mo(4, 5)), recurringId: recRestaurant.id, lines: [line(k[4], 1), line(k[3], 1)] });
    add('a-rest-double', { type: 'avoir', client: 4, date: mo(4, 6), status: 'émis', creditOf: 'f-rest-double', creditReason: 'Facture établie en double', applyStamp: true, lines: [line(k[4], 1), line(k[3], 1)] });
    add('f-rest-m2', { type: 'facture', client: 4, date: mo(3, 5), status: 'envoyée', subject: 'Supervision et sauvegarde — ' + C.monthLabel(mo(3, 5)), recurringId: recRestaurant.id, lines: [line(k[4], 1), line(k[3], 1)], payments: [pay(34, 'all', 'cheque', 'CHQ 0045902')] });
    add('f-rest-m3', { type: 'facture', client: 4, date: daysAgo(55), status: 'envoyée', subject: 'Supervision et sauvegarde — ' + C.monthLabel(daysAgo(55)), recurringId: recRestaurant.id,
      lines: [line(k[4], 1), line(k[3], 1), line(k[8], 5)], notes: 'Antivirus déployé sur les 5 postes de la caisse et du bureau.', emails: [E(daysAgo(55), 'facture'), E(daysAgo(10), 'relance1')],
      phone: [{ date: daysAgo(4), level: 2, note: 'Le gérant annonce un virement après le week-end.' }], remindAfter: C.addDays(T, 6) });
    add('q-rest-postes', { type: 'devis', client: 4, date: daysAgo(50), status: 'envoyé', subject: 'Renouvellement des postes de la caisse', lines: [line(k[6], 4), line(k[8], 4)], emails: [E(daysAgo(50), 'devis')] });

    // Particulier : petite facture payée en espèces, devis en attente, brouillon du jour
    add('f-trab-poste', { type: 'facture', client: 5, date: mo(7, 22), status: 'envoyée', subject: 'Installation et sécurisation d\'un poste', lines: [line(k[6], 1), line(k[8], 1)], payments: [pay(3, 'all', 'especes')] });
    // Devis accepté (bon pour accord reçu) mais pas encore facturé : il remonte dans « À faire »
    add('q-trab-maison', { type: 'devis', client: 5, date: daysAgo(10), status: 'accepté', subject: 'Sécurisation du réseau domestique', lines: [line(k[6], 2, 100), line(k[3], 12, 60)], notes: 'Tarif particulier.', emails: [E(daysAgo(10), 'devis')] });
    add('f-trab-brouillon', { type: 'facture', client: 5, date: T, status: 'brouillon', subject: 'Dépannage et nettoyage d\'un poste',
      lines: [{ label: 'Dépannage et nettoyage d\'un poste', description: 'Suppression des logiciels indésirables, mises à jour, vérification de la sauvegarde', qty: 1, unit: 'u', unitPrice: 90, vatRate: 19 }] });

    // Cabinet d'avocats : test d'intrusion (payé, attestation reçue), mise en conformité (payée à moitié), devis brouillon
    add('q-cab-pentest', { type: 'devis', client: 2, date: mo(6, 2), status: 'accepté', subject: 'Test d\'intrusion du portail clients', lines: [line(k[1], 1), line(k[5], 2)], emails: [E(mo(6, 2), 'devis')] });
    add('f-cab-pentest', { type: 'facture', client: 2, date: mo(5, 6), status: 'envoyée', subject: 'Test d\'intrusion du portail clients', fromQuote: 'q-cab-pentest', lines: [line(k[1], 1), line(k[5], 2)],
      notes: 'Rapport remis le jour de la facturation. Contre-test inclus dans les 30 jours.', payments: [pay(31, 'all', 'cheque', 'CHQ 1120034')], certificate: true, emails: [E(mo(5, 6), 'facture')] });
    add('q-cab-inpdp', { type: 'devis', client: 2, date: daysAgo(34), status: 'accepté', subject: 'Mise en conformité protection des données', lines: [line(k[10], 1), line(k[5], 2)], emails: [E(daysAgo(34), 'devis')] });
    add('f-cab-inpdp', { type: 'facture', client: 2, date: daysAgo(20), dueDate: daysAgo(-6), status: 'envoyée', subject: 'Mise en conformité protection des données', fromQuote: 'q-cab-inpdp',
      lines: [line(k[10], 1), line(k[5], 2)], notes: 'Acompte de 50 % à la commande, solde à la remise du registre des traitements.', payments: [pay(12, 'half')], emails: [E(daysAgo(20), 'facture')] });
    add('q-cab-formation', { type: 'devis', client: 2, date: daysAgo(2), status: 'brouillon', subject: 'Formation des nouveaux collaborateurs', lines: [line(k[5], 6)] });

    // Hôtel : projet Wi-Fi en acompte + solde (payés), une facture très en retard, un devis en attente
    add('q-lemon-wifi', { project: prjLemon, type: 'devis', client: 3, date: mo(6, 9), status: 'accepté', subject: 'Refonte du réseau Wi-Fi de l\'hôtel', lines: [line(k[0], 1), line(k[2], 1), line(k[9], 12), line(k[7], 2)], discountRate: 10,
      notes: 'Intervention hors saison. Bornes Wi-Fi fournies par l\'hôtel.', emails: [E(mo(6, 9), 'devis')] });
    add('f-lemon-acompte', { project: prjLemon, type: 'facture', client: 3, date: mo(6, 16), status: 'envoyée', subject: 'Acompte 30 % — Refonte du réseau Wi-Fi de l\'hôtel', fromQuote: 'q-lemon-wifi', deposit: { quote: 'q-lemon-wifi', percent: 30 },
      lines: b => C.depositLines(b['q-lemon-wifi'], 30, co), payments: [pay(12, 'all')], emails: [E(mo(6, 16), 'facture')] });
    add('f-lemon-solde', { project: prjLemon, type: 'facture', client: 3, date: mo(4, 25), status: 'envoyée', subject: 'Solde — Refonte du réseau Wi-Fi de l\'hôtel', fromQuote: 'q-lemon-wifi', settles: { quote: 'q-lemon-wifi', deposits: ['f-lemon-acompte'] },
      lines: b => C.settlementLines(b['q-lemon-wifi'], [b['f-lemon-acompte']]), discountRate: 10, payments: [pay(41, 'all', 'traite', 'Traite à 30 jours')], emails: [E(mo(4, 25), 'facture')] });
    add('f-lemon-parefeu', { project: prjLemon, type: 'facture', client: 3, date: daysAgo(82), status: 'envoyée', subject: 'Installation pare-feu et sensibilisation', lines: [line(k[2], 1), line(k[5], 3), line(k[7], 1)],
      notes: 'Merci de régler avant l\'échéance.', emails: [E(daysAgo(82), 'facture'), E(daysAgo(47), 'relance1'), E(daysAgo(30), 'relance2')] });
    add('q-lemon-audit', { type: 'devis', client: 3, date: daysAgo(5), status: 'envoyé', subject: 'Audit annuel et test d\'intrusion', lines: [line(k[0], 1), line(k[1], 1)], discountRate: 15, notes: 'Remise fidélité 15 %.', emails: [E(daysAgo(5), 'devis')] });

    // Pharmacie : contrat annuel payé (avec un avoir partiel), une facture en cours
    add('q-pharm-annuel', { type: 'devis', client: 1, date: mo(3, 4), status: 'accepté', subject: 'Sauvegarde et maintenance annuelle', lines: [line(k[3], 12), line(k[4], 12), line(k[6], 3)], notes: 'Engagement 12 mois, règlement annuel d\'avance.', emails: [E(mo(3, 4), 'devis')] });
    add('f-pharm-annuel', { type: 'facture', client: 1, date: mo(3, 11), status: 'envoyée', subject: 'Sauvegarde et maintenance annuelle', fromQuote: 'q-pharm-annuel', lines: [line(k[3], 12), line(k[4], 12), line(k[6], 3)],
      notes: 'Engagement 12 mois, règlement annuel d\'avance.', payments: [pay(30, 'all')], emails: [E(mo(3, 11), 'facture')] });
    add('a-pharm-geste', { type: 'avoir', client: 1, date: mo(3, 20), status: 'émis', creditOf: 'f-pharm-annuel', creditReason: 'Geste commercial : intervention tardive', lines: [line(k[3], 1)], emails: [E(mo(3, 20), 'avoir')] });
    add('f-pharm-postes', { type: 'facture', client: 1, date: daysAgo(38), status: 'envoyée', subject: 'Antivirus et poste d\'accueil', lines: [line(k[8], 4), line(k[6], 1)], emails: [E(daysAgo(38), 'facture')] }); // 8 jours de retard : rappel amical

    // Client étranger : documents en anglais, en euros, sans TVA ni timbre (export de services — À VÉRIFIER)
    const en = (label, description, qty, unit, unitPrice) => ({ label, description, qty, unit, unitPrice, vatRate: 0 });
    const novaNotes = 'Services exported outside Tunisia: VAT not applicable. Bank charges are borne by the client.';
    add('q-nova-pentest', { type: 'devis', client: 6, date: mo(3, 2), status: 'accepté', subject: 'Web application penetration test', lang: 'en', currency: 'EUR', exchangeRate: 3.35,
      lines: [en('Web application penetration test (grey box)', 'Authenticated testing of the customer portal, detailed report with evidence and remediation plan', 1, 'package', 800), en('Security awareness workshop', '3-hour remote session for the team', 1, 'session', 300)], notes: novaNotes, emails: [E(mo(3, 2), 'devis')] });
    add('f-nova-pentest', { type: 'facture', client: 6, date: mo(2, 9), status: 'envoyée', subject: 'Web application penetration test', fromQuote: 'q-nova-pentest', reference: 'PO-4471', lang: 'en', currency: 'EUR', exchangeRate: 3.35, applyStamp: false,
      lines: b => JSON.parse(JSON.stringify(b['q-nova-pentest'].lines)), notes: novaNotes, payments: [pay(22, 'all', 'virement', 'SWIFT NOVA-2211')], emails: [E(mo(2, 9), 'facture')] });
    add('q-nova-review', { type: 'devis', client: 6, date: daysAgo(5), status: 'envoyé', subject: 'Annual security review', lang: 'en', currency: 'EUR', exchangeRate: 3.35,
      lines: [en('External vulnerability assessment', 'Quarterly scans of the public perimeter with executive summary', 1, 'package', 450), en('Phishing simulation campaign', 'One campaign, results and awareness report', 1, 'campaign', 350)], notes: novaNotes, emails: [E(daysAgo(5), 'devis')] });

    // ---------- les quatre pièces sans valeur comptable (2.6.0) ----------
    // Une de chaque, rattachée à une affaire existante, pour montrer le chemin
    // devis → proforma / bon de commande → bon de livraison → facture.
    add('pro-lauriers', { project: prjLauriers, type: 'proforma', client: 7, date: mo(2, 12), status: 'envoyée', subject: 'Équipement de la salle informatique',
      reference: 'Dossier subvention 2026',
      lines: [line(k[2], 12), line(k[6], 1)],
      notes: 'Document établi à la demande de l\'établissement pour son dossier de financement. Une facture définitive sera émise à la commande.' });
    add('bc-lauriers', { project: prjLauriers, type: 'commande', client: 7, date: mo(2, 20), status: 'livrée', subject: 'Équipement de la salle informatique',
      reference: 'BC client n° 2026-114', fromDoc: 'pro-lauriers',
      lines: b => JSON.parse(JSON.stringify(b['pro-lauriers'].lines)),
      notes: 'Bon de commande signé par l\'intendant le jour même.' });
    add('bl-lauriers', { project: prjLauriers, type: 'livraison', client: 7, date: mo(2, 26), status: 'signé', subject: 'Équipement de la salle informatique',
      fromDoc: 'bc-lauriers',
      lines: b => JSON.parse(JSON.stringify(b['bc-lauriers'].lines)),
      notes: 'Livré et installé sur place. Bon signé par M. Hached à la réception.' });
    // La facture qui clôt la chaîne : c'est elle qui donne sa marge à l'affaire, en face de l'achat FA-2026-1187.
    add('f-lauriers-salle', { project: prjLauriers, type: 'facture', client: 7, date: mo(2, 28), status: 'envoyée', subject: 'Équipement de la salle informatique',
      reference: 'BC client n° 2026-114',
      lines: [line(k[12], 12), line(k[11], 1), line(k[2], 1), line(k[6], 12)],
      notes: 'Matériel livré et installé le 26. Bon de livraison signé par M. Hached.', payments: [pay(26, 'all')], certificate: true, emails: [E(mo(2, 28), 'facture')] });
    add('ctr-clinique', { type: 'contrat', client: 0, date: mo(12, 5), status: 'signé', subject: 'Maintenance et supervision du système d\'information',
      lines: [line(k[4], 1), line(k[3], 1)],
      clauses: { duree: 'Le présent contrat est conclu pour une durée de douze (12) mois à compter du premier jour du mois suivant sa signature.',
        paiement: 'Les prestations sont facturées mensuellement, le 1er de chaque mois, et payables à trente (30) jours date de facture.' },
      notes: 'Contrat signé par les deux parties. Il est facturé par le contrat récurrent « Maintenance mensuelle ».' });

    // ---------- les quatre années d'avant (10.14.0) ----------
    // Engendrées, mois par mois, avec des volumes qui grandissent : trois pièces par mois la première
    // année, huit la quatrième. Tout ce qui est ancien est RÉGLÉ (une entreprise de cinq ans a
    // encaissé ses factures de 2022) : les retards et les relances vivent dans la fenêtre écrite à la
    // main. Les licences antivirus sortent du stock ; leurs achats sont posés plus bas, au rythme
    // des ventes (`ventesLicences`).
    const ventesLicences = [];      // [{ age, date, qty }] — pour réapprovisionner le stock en face
    const prestations = [
      () => ({ sujet: 'Audit de sécurité réseau', lignes: [line(k[0], 1), line(k[5], entre(1, 3))], devis: true }),
      () => ({ sujet: 'Test d\'intrusion applicatif', lignes: [line(k[1], 1)], devis: true }),
      () => ({ sujet: 'Installation d\'un pare-feu', lignes: [line(k[2], 1), line(k[7], entre(0, 2) || 1)], devis: true }),
      () => ({ sujet: 'Maintenance et supervision', lignes: [line(k[4], entre(1, 3))], devis: false }),
      () => ({ sujet: 'Sauvegarde externalisée', lignes: [line(k[3], entre(3, 12))], devis: false }),
      () => ({ sujet: 'Formation sensibilisation', lignes: [line(k[5], entre(2, 6))], devis: true }),
      () => ({ sujet: 'Installation de postes de travail', lignes: [line(k[6], entre(2, 8))], devis: false }),
      () => ({ sujet: 'Hébergement et supervision serveur', lignes: [line(k[9], entre(3, 6))], devis: false }),
      () => ({ sujet: 'Mise en conformité protection des données', lignes: [line(k[10], 1), line(k[5], 2)], devis: true })
    ];
    const modes = ['virement', 'virement', 'virement', 'virement', 'cheque', 'cheque', 'especes'];
    let avoirsFaits = 0;
    for (let m = HIST_DEBUT; m >= HIST_FIN; m--) {
      const age = HIST_DEBUT - m;                      // 0 le premier mois, 45 le dernier
      const n = age < 12 ? entre(2, 4) : age < 24 ? entre(4, 6) : age < 36 ? entre(5, 7) : entre(7, 9);
      // Les clients d'un mois : les premiers mois n'en ont que quelques-uns, puis le cercle s'élargit.
      const cercle = anciens.slice(0, Math.min(anciens.length, 5 + Math.floor(age * 0.7)));
      for (let i = 0; i < n; i++) {
        const client = parmi(cercle);
        const jour = entre(2, 24);
        const date = mo(m, jour);
        const tirage = alea();
        let p;
        if (tirage < 0.14) {
          const qty = entre(2, 5);
          p = { sujet: 'Licences antivirus et déploiement', lignes: [line(k[8], qty), line(k[6], Math.min(qty, 3))], devis: false };
          ventesLicences.push({ age, date, qty });
        } else p = parmi(prestations)();
        const cle = `h-${m}-${i}`;
        const rs = Number(cl[client].withholdingRate) > 0;
        const regle = [pay(entre(8, 48), 'all', client === 5 || cl[client].matricule.startsWith('CIN') ? 'especes' : parmi(modes))];
        if (p.devis) {
          const jq = Math.max(1, jour - entre(4, 12));
          add(cle + '-q', { type: 'devis', client, date: mo(m, jq), status: 'accepté', subject: p.sujet, lines: p.lignes, emails: [E(mo(m, jq), 'devis')] });
          add(cle, { type: 'facture', client, date, status: 'envoyée', subject: p.sujet, fromQuote: cle + '-q', lines: p.lignes, payments: regle, certificate: rs, emails: [E(date, 'facture')] });
        } else {
          add(cle, { type: 'facture', client, date, status: 'envoyée', subject: p.sujet, lines: p.lignes, payments: regle, certificate: rs, emails: [E(date, 'facture')] });
        }
        // Quelques avoirs au fil des ans : un geste commercial, une ligne facturée en trop.
        if (i === 0 && [9, 21, 30, 40].includes(age) && avoirsFaits < 4) {
          avoirsFaits++;
          add(cle + '-a', { type: 'avoir', client, date: mo(m, Math.min(28, jour + 3)), status: 'émis', creditOf: cle,
            creditReason: age % 2 ? 'Geste commercial' : 'Ligne facturée en trop', lines: [JSON.parse(JSON.stringify(p.lignes[0]))].map(l => ({ ...l, qty: 1 })) });
        }
      }
      // Un devis refusé de temps en temps : un devis sur trois ne se signe pas.
      if (age >= 4 && age % 2 === 0) {
        const client = parmi(cercle), p = parmi(prestations)(), jq = entre(3, 25);
        add(`h-${m}-r`, { type: 'devis', client, date: mo(m, jq), status: 'refusé', subject: p.sujet, lines: p.lignes, emails: [E(mo(m, jq), 'devis')] });
      }
    }

    // Création dans l'ordre chronologique : numéros continus par type et par année, dépendances (acompte → solde, facture → avoir) résolues
    specs.sort((a, b) => a.date.localeCompare(b.date) || (a.seq || 0) - (b.seq || 0));
    const byKey = {};
    specs.forEach((s, i) => {
      const client = cl[s.client];
      const draft = s.status === 'brouillon';
      const doc = {
        id: C.uid(), type: s.type, number: '', date: s.date, dueDate: s.dueDate || (s.type === 'avoir' ? undefined : C.addDays(s.date, s.type === 'devis' ? co.quoteValidityDays : co.paymentTermsDays)),
        clientId: client.id, subject: s.subject || '', reference: s.reference || '', lines: typeof s.lines === 'function' ? s.lines(byKey) : JSON.parse(JSON.stringify(s.lines)),
        discountRate: s.discountRate || 0, applyStamp: s.applyStamp != null ? s.applyStamp : s.type === 'facture', status: s.status, notes: s.notes || '', payments: [],
        withholdingRate: s.type === 'devis' ? 0 : (s.withholdingRate != null ? s.withholdingRate : (Number(client.withholdingRate) || 0)),
        createdAt: ts(s.date) + i, lang: s.lang || client.lang || 'fr', currency: s.currency || client.currency || co.currency, exchangeRate: s.exchangeRate || ''
      };
      if (s.type === 'avoir') { const inv = byKey[s.creditOf]; doc.creditOf = inv.id; doc.creditOfNumber = inv.number; doc.creditReason = s.creditReason || ''; doc.subject = `Avoir sur facture ${inv.number}`; doc.withholdingRate = inv.withholdingRate; if (s.applyStamp == null) doc.applyStamp = false; }
      if (s.fromQuote) { const q = byKey[s.fromQuote]; doc.fromQuoteId = q.id; doc.fromQuoteNumber = q.number; }
      if (s.deposit) { const q = byKey[s.deposit.quote]; doc.deposit = { percent: s.deposit.percent, quoteId: q.id, quoteNumber: q.number }; }
      if (s.settles) { const q = byKey[s.settles.quote]; doc.settles = { quoteId: q.id, quoteNumber: q.number, depositIds: s.settles.deposits.map(x => byKey[x].id) }; }
      if (s.recurringId) doc.recurringId = s.recurringId;
      if (s.project) doc.projectId = s.project.id;
      if (s.fromDoc) { const src = byKey[s.fromDoc]; doc.fromDocId = src.id; doc.fromDocType = src.type; doc.fromDocNumber = src.number; }
      if (s.type === 'contrat') doc.clauses = { ...C.DEFAULT_CLAUSES, ...(s.clauses || {}) };
      if (s.type === 'livraison') doc.hidePrices = s.hidePrices !== false;
      if (['commande', 'livraison', 'contrat'].includes(s.type)) { doc.withholdingRate = 0; doc.applyStamp = false; doc.dueDate = ''; }
      if (s.certificate) doc.withholdingCertificate = true;
      if (!draft || s.type === 'devis' || C.EXTRA_TYPES.includes(s.type)) doc.number = C.nextNumber(d, s.type, s.date);
      if (s.emails && s.emails.length) {
        doc.emails = s.emails.map(e => ({ date: e.date, to: client.email, kind: e.kind, subject: C.emailFor(e.kind, doc, client, co, { jours: doc.dueDate ? Math.max(0, C.daysBetween(doc.dueDate, e.date)) : 0 }).subject }));
        const rem = doc.emails.filter(e => /^relance\d$/.test(e.kind)).map(e => ({ date: e.date, level: Number(e.kind.slice(-1)), channel: 'email' }));
        if (rem.length) doc.reminders = rem;
      }
      // Relances notées à la main (téléphone) et report éventuel : le client a annoncé une date
      if (s.phone) { doc.reminders = (doc.reminders || []).concat(s.phone.map(p => ({ date: p.date, level: p.level, channel: 'tel', note: p.note }))).sort((a, b) => a.date.localeCompare(b.date)); }
      if (s.remindAfter) doc.remindAfter = s.remindAfter;
      byKey[s.key] = doc; s.doc = doc; d.documents.push(doc);
    });
    // Paiements après création de tous les documents : le reste à payer tient compte des avoirs
    specs.forEach(s => (s.payments || []).forEach(p => {
      const b = C.invoiceBalance(s.doc, d, co);
      const amount = p.amount === 'all' ? b.remaining : p.amount === 'half' ? C.round3(b.remaining / 2) : p.amount;
      if (!(amount > 0)) return;
      const date = C.addDays(s.doc.date, p.after);
      s.doc.payments.push({ id: C.uid(), date, amount: C.round3(amount), method: p.method, reference: p.reference || (p.method === 'virement' ? vir(date) : ''), note: '' });
    }));

    // ---------- fournisseurs et achats (3.0.0) ----------
    // Assez pour montrer les trois destinations de ligne, une retenue opérée, un impayé en retard,
    // une dépense sans facture et un justificatif manquant.
    const sup = (name, matricule, o) => ({ id: C.uid(), name, matricule, contact: '', address: '', phone: '', email: '', rib: '', bank: '', notes: '', paymentTermsDays: 30, withholdingRate: '', ...(o || {}) });
    d.suppliers = [
      sup('Tunisie Matériel Informatique', '7890123G/A/000', { contact: 'M. Anis Khelifi', phone: '+216 71 800 900', email: 'commercial@tunisiemateriel.tn', paymentTermsDays: 30, bank: 'Amen Bank', rib: '00 012 0000987654321 49' }),
      sup('Cabinet Comptable Ben Youssef', '8901234H/P/000', { contact: 'M. Nabil Ben Youssef', email: 'contact@bycompta.tn', paymentTermsDays: 15, withholdingRate: 3,
        notes: 'Prestataire : retenue à la source de 3 % à opérer, et attestation à lui remettre. À VÉRIFIER avec lui chaque année.' }),
      sup('STEG', '', { paymentTermsDays: 0, notes: 'Facture bimestrielle. Prélèvement automatique.' }),
      sup('Agence Immobilière Le Lac', '9012345I/A/000', { contact: 'Mme Rim Abassi', paymentTermsDays: 5, notes: 'Loyer du bureau, payable le 5 de chaque mois.' })
    ];
    const sp = d.suppliers;
    const bline = (label, qty, unitPrice, vatRate, destination, deductible) =>
      ({ label, qty, unit: 'u', unitPrice, vatRate: vatRate == null ? 19 : vatRate, destination: destination || 'charge', deductible: deductible !== false });
    const buy = (o) => {
      const p = {
        id: C.uid(), kind: 'facture', supplierId: '', number: '', date: T, dueDate: '', subject: '', category: '',
        notes: '', fees: 0, withholdingRate: 0, lines: [], payments: [], attachments: [], createdAt: ts(o.date || T), ...o
      };
      p.payments = (o.payments || []).map(x => ({ id: C.uid(), date: x.date, amount: x.amount === 'all' ? C.purchaseTotals(p, co).netToPay : x.amount, method: x.method || 'virement', reference: x.reference || (x.method === 'virement' || !x.method ? vir(x.date) : ''), note: '' }));
      return p;
    };
    // Une pièce de la démo se retrouve par son NUMÉRO, jamais par son indice (10.1.0).
    // `d.purchases[1]` liait la fiche d'un bien à la deuxième pièce de la liste : insérer un achat
    // plus haut la faisait désigner la mauvaise, l'ordinateur portable repartait « à immobiliser »,
    // et seul un parcours réel le voyait. C'est le piège déjà écrit pour le catalogue (« tout
    // nouvel article s'ajoute à la fin », 4.0.0) — retiré ici, au lieu d'être contourné.
    const achatParNumero = n => d.purchases.find(p => p.number === n);
    d.purchases = [
      // matériel revendu à l'École : rattaché à l'affaire, c'est ce qui rend sa marge exacte
      buy({ projectId: prjLauriers.id, supplierId: sp[0].id, number: 'FA-2026-1187', date: mo(2, 18), dueDate: C.addDays(mo(2, 18), 30), category: 'Achats de marchandises',
        subject: 'Postes de travail pour l\'École Les Lauriers', fees: 1,
        // Marchandise destinée à la revente : elle entre en stock et n'est une charge qu'au moment
        // où elle est vendue (coût des marchandises vendues, 4.0.0).
        lines: [bline('Poste de travail complet', 12, 850, 19, 'stock'), bline('Pare-feu UTM', 1, 1200, 19, 'stock')],
        payments: [{ date: C.addDays(mo(2, 18), 28), amount: 'all' }] }),
      // UN ACHAT EN EUROS (10.1.0), parce que c'est le cas où l'application se trompait le plus
      // cher et le plus silencieusement. Une licence annuelle achetée à l'étranger : la facture est
      // en euros, la comptabilité en dinars, et le taux du jour voyage AVEC la pièce.
      buy({ supplierId: sp[0].id, number: 'INV-2026-77120', date: mo(4, 6), dueDate: C.addDays(mo(4, 6), 30),
        category: 'Logiciels et abonnements', subject: 'Licences antivirus — renouvellement annuel',
        currency: 'EUR', exchangeRate: 3.38, fees: 0,
        lines: [bline('Licence antivirus 25 postes (12 mois)', 1, 940, 19)],
        payments: [{ date: C.addDays(mo(4, 6), 20), amount: 'all' }],
        notes: 'Facture en euros. Le taux retenu est celui du jour de la facture — À VÉRIFIER avec le comptable : quel cours retenir.' }),
      // immobilisation : reprise par le module 3.4.0
      buy({ supplierId: sp[0].id, number: 'FA-2026-0940', date: mo(7, 9), dueDate: C.addDays(mo(7, 9), 30), category: 'Petit équipement',
        subject: 'Ordinateur portable de l\'entreprise', fees: 1,
        lines: [bline('Ordinateur portable 16 Go', 1, 2600, 19, 'immobilisation')],
        payments: [{ date: C.addDays(mo(7, 9), 12), amount: 'all', method: 'cheque', reference: 'CHQ 4451' }],
        notes: 'Reste dans l\'entreprise : à amortir. À VÉRIFIER avec le comptable : durée d\'amortissement.' }),
      // prestataire avec retenue à la source opérée, attestation pas encore remise
      buy({ supplierId: sp[1].id, number: 'H-2026-034', date: daysAgo(6), dueDate: C.addDays(T, 9), category: 'Honoraires (comptable, avocat)',
        subject: 'Honoraires comptables du trimestre', withholdingRate: 3, fees: 1,
        lines: [bline('Tenue de comptabilité et déclarations', 1, 900, 19)] }),
      // loyer en retard : alimente « À payer » et le panneau À faire
      buy({ supplierId: sp[3].id, number: 'LOC-2026-08', date: mo(2, 5), dueDate: mo(2, 10), category: 'Loyer et charges locatives',
        subject: 'Loyer du bureau', lines: [bline('Loyer mensuel du bureau', 1, 1100, 19)] }),
      buy({ supplierId: sp[3].id, number: 'LOC-2026-09', date: mo(1, 5), dueDate: mo(1, 10), category: 'Loyer et charges locatives',
        subject: 'Loyer du bureau', lines: [bline('Loyer mensuel du bureau', 1, 1100, 19)],
        payments: [{ date: mo(1, 12), amount: 500 }] }),
      // électricité : TVA à 19 %, payée
      buy({ supplierId: sp[2].id, number: 'STEG-884512', date: mo(1, 20), dueDate: C.addDays(mo(1, 20), 10), category: 'Électricité, eau, gaz',
        subject: 'Électricité juillet-août', lines: [bline('Consommation bimestrielle', 1, 340, 19)],
        payments: [{ date: C.addDays(mo(1, 20), 8), amount: 'all', method: 'especes' }] }),
      // dépense sans facture détaillée, TVA non déductible (carburant véhicule de tourisme — À VÉRIFIER)
      buy({ kind: 'depense', supplierId: sp[0].id, number: '', date: daysAgo(12), category: 'Carburant et déplacements',
        subject: 'Carburant du mois', lines: [bline('Carburant', 1, 180, 19, 'charge', false)],
        payments: [{ date: daysAgo(12), amount: 'all', method: 'especes' }],
        notes: 'TVA non déductible sur les véhicules de tourisme — À VÉRIFIER avec le comptable.' }),
      buy({ kind: 'depense', supplierId: sp[0].id, number: '', date: daysAgo(4), category: 'Fournitures de bureau',
        subject: 'Papeterie et consommables', lines: [bline('Fournitures diverses', 1, 96, 19)],
        payments: [{ date: daysAgo(4), amount: 'all', method: 'carte' }] }),
      // immobilisation SANS fiche : elle attend dans « À immobiliser » et remonte dans « À faire »
      buy({ supplierId: sp[0].id, number: 'FA-2026-1402', date: daysAgo(18), dueDate: C.addDays(daysAgo(18), 30), category: 'Petit équipement',
        subject: 'Imprimante multifonction du bureau', fees: 1,
        lines: [bline('Imprimante multifonction couleur', 1, 1450, 19, 'immobilisation')],
        notes: 'À immobiliser : durée d\'amortissement à confirmer avec le comptable.' }),
      // ---------- les pièces qui se RATTACHENT à une facture (10.2.0) ----------
      // Un acompte versé à la commande : l'argent est sorti, mais ce n'est pas encore une charge —
      // c'est une avance sur un fournisseur, qui se solde le jour de sa facture.
      buy({ kind: 'acompte', supplierId: sp[0].id, number: 'ACPT-2026-11', date: daysAgo(30), dueDate: daysAgo(30),
        category: 'Petit équipement', subject: 'Acompte à la commande de l\'imprimante',
        lines: [bline('Acompte 30 % à la commande', 1, 500, 19)],
        payments: [{ date: daysAgo(30), amount: 'all' }] }),
      // Un avoir déjà imputé : le bailleur a fait un geste sur un loyer resté impayé.
      buy({ kind: 'avoir', supplierId: sp[3].id, number: 'AV-2026-0233', date: mo(1, 28),
        category: 'Loyer et charges locatives', subject: 'Geste commercial sur le loyer',
        lines: [bline('Remise exceptionnelle', 1, 200, 19)] }),
      // Un avoir qui n'a pas encore trouvé sa facture : un crédit qu'on a chez ce fournisseur, et
      // que « À faire » rappelle tant qu'il n'est rattaché à rien.
      buy({ kind: 'avoir', supplierId: sp[0].id, number: 'AV-2026-0221', date: daysAgo(9),
        category: 'Achats de marchandises', subject: 'Rabais de fin d\'année',
        lines: [bline('Rabais commercial', 1, 300, 19)],
        notes: 'À déduire de la prochaine facture de ce fournisseur.' })
    ];
    // Le rattachement se pose APRÈS : une pièce se retrouve par son numéro, jamais par son indice.
    achatParNumero('ACPT-2026-11').achatLie = achatParNumero('FA-2026-1402').id;
    achatParNumero('AV-2026-0233').achatLie = achatParNumero('LOC-2026-08').id;
    // ---------- les achats des quatre années d'avant (10.14.0) ----------
    // Le loyer chaque mois, l'électricité tous les deux mois, l'internet, le carburant, le comptable
    // chaque trimestre (avec sa retenue, attestation remise), et le stock de licences qu'on
    // réapprovisionne quand il baisse. Tout est réglé : ce qui reste à payer vit dans la fenêtre.
    const supTT = sup('Tunisie Telecom', '0001234T/A/M/000', { paymentTermsDays: 15, notes: 'Fibre du bureau, prélevée chaque mois.' });
    const supAgil = sup('Station Agil El Manar', '', { paymentTermsDays: 0, notes: 'Carburant de la camionnette.' });
    d.suppliers.push(supTT, supAgil);
    const aa = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
    let stockLicences = 15;                           // le stock de départ, posé au catalogue
    let numTMI = 100;
    const acheterLicences = (date, qty, cout) => {
      numTMI++;
      d.purchases.push(buy({ supplierId: sp[0].id, number: `TMI-${date.slice(0, 4)}-${numTMI}`, date, dueDate: C.addDays(date, 30),
        category: 'Achats de marchandises', subject: 'Licences antivirus pour la revente', fees: 1,
        lines: [bline('Antivirus / EDR (licence 1 an)', qty, cout, 19, 'stock')],
        payments: [{ date: C.addDays(date, entre(10, 28)), amount: 'all' }] }));
      stockLicences += qty;
    };
    for (let m = HIST_DEBUT; m >= HIST_FIN; m--) {
      const age = HIST_DEBUT - m;
      const ref = mo(m, 1), y = ref.slice(0, 4), mm = ref.slice(5, 7);
      const loyer = age < 24 ? 950 : 1100;
      d.purchases.push(buy({ supplierId: sp[3].id, number: `QL-${aa(y, mm)}`, date: mo(m, 5), dueDate: mo(m, 10), category: 'Loyer et charges locatives',
        subject: 'Loyer du bureau', lines: [bline('Loyer mensuel du bureau', 1, loyer, 19)], payments: [{ date: mo(m, entre(6, 9)), amount: 'all' }] }));
      d.purchases.push(buy({ supplierId: supTT.id, number: `TT-${aa(y, mm)}`, date: mo(m, 12), dueDate: mo(m, 27), category: 'Téléphone et internet',
        subject: 'Fibre et téléphone du bureau', lines: [bline('Abonnement fibre professionnelle', 1, age < 30 ? 79 : 99, 19)], payments: [{ date: mo(m, 27), amount: 'all' }] }));
      if (age % 2 === 1) d.purchases.push(buy({ supplierId: sp[2].id, number: `STEG-${700000 + age * 373}`, date: mo(m, 20), dueDate: mo(m, 28), category: 'Électricité, eau, gaz',
        subject: 'Électricité du bimestre', lines: [bline('Consommation bimestrielle', 1, entre(210, 360), 19)], payments: [{ date: mo(m, 26), amount: 'all', method: 'especes' }] }));
      if (age >= 14) d.purchases.push(buy({ kind: 'depense', supplierId: supAgil.id, number: '', date: mo(m, entre(8, 26)), category: 'Carburant et déplacements',
        subject: 'Carburant du mois', lines: [bline('Carburant', 1, entre(130, 210), 19, 'charge', false)], payments: [{ date: mo(m, 27), amount: 'all', method: 'especes' }],
        notes: 'TVA non déductible sur les véhicules de tourisme — À VÉRIFIER avec le comptable.' }));
      if (age % 3 === 2) {
        const q = Math.floor((Number(mm) - 1) / 3) + 1;
        d.purchases.push(buy({ supplierId: sp[1].id, number: `H-${y}-${String(10 + q)}`, date: mo(m, 15), dueDate: mo(m, 30), category: 'Honoraires (comptable, avocat)',
          subject: 'Honoraires comptables du trimestre', withholdingRate: 3, fees: 1, withholdingCertificate: true,
          lines: [bline('Tenue de comptabilité et déclarations', 1, age < 24 ? 750 : 900, 19)], payments: [{ date: mo(m, 25), amount: 'all' }] }));
      }
      // Le stock suit les ventes : on rachète AVANT la vente qui le ferait passer sous le seuil.
      ventesLicences.filter(v => v.age === age).sort((a, b) => a.date.localeCompare(b.date)).forEach(v => {
        if (stockLicences - v.qty < 10) acheterLicences(C.addDays(v.date, -3) < mo(m, 1) ? mo(m, 1) : C.addDays(v.date, -3), 25, age < 24 ? 48 : 52);
        stockLicences -= v.qty;
      });
    }
    // Au seuil de la fenêtre écrite à la main, la réserve compte ce qu'elle comptait avant : une
    // quarantaine de licences (les ventes des treize derniers mois en sortent une dizaine).
    if (stockLicences < 40) acheterLicences(mo(HIST_FIN, 22), 40 - stockLicences, 52);

    d.expenseCategories = [];

    // ---------- paie (5.0.0) ----------
    // Deux salariés : un technicien à temps plein depuis deux ans, et une assistante embauchée en
    // cours d'année. Les bulletins remontent jusqu'au mois dernier, le dernier n'étant pas encore payé.
    // Le technicien est là depuis plus de quatre ans ; un second technicien est parti il y a dix
    // mois (sa fiche reste : son nom vit sur ses bulletins, qui ne se réécrivent pas) ; l'assistante
    // est arrivée au printemps.
    const empTech = { id: C.uid(), name: 'Ahmed Ben Salah', cin: '09123456', cnss: '112233-44',
      position: 'Technicien systèmes et réseaux', contract: 'cdi', hireDate: mo(50, 1), endDate: '',
      grossSalary: 1850, headOfFamily: true, children: 2, method: 'virement', iban: '', notes: '' };
    const empAssist = { id: C.uid(), name: 'Ines Gharbi', cin: '11223344', cnss: '556677-88',
      position: 'Assistante administrative', contract: 'cdd', hireDate: mo(3, 1), endDate: '',
      grossSalary: 900, headOfFamily: false, children: 0, method: 'virement', iban: '', notes: 'CDD d\'un an, renouvelable.' };
    const empYassine = { id: C.uid(), name: 'Yassine Trabelsi', cin: '08765432', cnss: '223344-55',
      position: 'Technicien helpdesk', contract: 'cdi', hireDate: mo(34, 1), endDate: C.addDays(mo(9, 1), -1),
      grossSalary: 1250, headOfFamily: false, children: 0, method: 'virement', iban: '', notes: 'Parti de lui-même, rejoint une banque. Solde de tout compte remis.' };
    d.employees = [empTech, empAssist, empYassine];
    // Le salaire d'un mois passé est celui de CE mois-là : une augmentation ne réécrit pas un bulletin.
    const brutDuMois = (e, back) => e === empTech ? (back > 36 ? 1400 : back > 24 ? 1600 : back > 12 ? 1750 : e.grossSalary)
      : e === empYassine ? (back > 22 ? 1100 : e.grossSalary) : e.grossSalary;
    const payCfg = C.payrollSettings(d);
    d.payslips = [];
    // Du mois d'embauche jusqu'au mois dernier inclus.
    for (let back = HIST_DEBUT; back >= 1; back--) {
      const ref = mo(back, 1);
      const y = Number(ref.slice(0, 4)), m = Number(ref.slice(5, 7));
      [empTech, empAssist, empYassine].forEach(e => {
        if (e.hireDate > C.addDays(ref, 27)) return;                  // pas encore embauché ce mois-là
        if (e.endDate && e.endDate < ref) return;                     // déjà parti
        // Une prime de rendement en fin d'année, une absence isolée : de quoi montrer les deux cas.
        const bonuses = ((back === 2 || (m === 12 && back > 12)) && e === empTech) ? [{ label: 'Prime de rendement', amount: 400, taxable: true }] : [];
        const absentDays = (back === 2 && e === empAssist) ? 2 : 0;
        const input = { gross: brutDuMois(e, back), workedDays: 26, absentDays, bonuses, deductions: [] };
        d.payslips.push({
          id: C.uid(), employeeId: e.id, year: y, month: m, ...input,
          computed: C.computePayslip(e, input, payCfg),
          // Le dernier bulletin n'est pas encore réglé : c'est ce qui alimente « À faire ».
          paidDate: back === 1 ? '' : C.addDays(ref, 31),
          // Pas de compte précisé : les salaires tombent sur le compte par défaut, comme dans la vraie vie.
          accountId: '', method: 'virement', reference: '', issuedAt: C.addDays(ref, 27)
        });
      });
    }

    // ---------- congés, absences et avances (5.1.0) ----------
    // Un congé annuel pris, un arrêt maladie, une absence sans solde à cheval sur deux mois, et une
    // avance en cours de remboursement : de quoi montrer les quatre comportements.
    d.leaves = [
      { id: C.uid(), employeeId: empTech.id, kind: 'conges', from: mo(4, 6), to: mo(4, 10),
        paid: null, note: 'Congé annuel' },
      { id: C.uid(), employeeId: empTech.id, kind: 'maladie', from: daysAgo(48), to: daysAgo(46),
        paid: null, note: 'Certificat médical de trois jours' },
      { id: C.uid(), employeeId: empAssist.id, kind: 'sans-solde', from: C.addDays(mo(2, 1), -2), to: mo(2, 2),
        paid: null, note: 'Absence sans solde' }
    ];
    // Les congés d'été du technicien, chaque année : un registre de cinq ans n'est pas vide.
    for (let an = 1; an <= 4; an++) {
      const ete = C.addMonths(T, -12 * an, 1).slice(0, 4) + '-08-04';
      if (ete < empTech.hireDate || ete >= mo(13, 1)) continue;
      d.leaves.push({ id: C.uid(), employeeId: empTech.id, kind: 'conges', from: ete, to: C.addDays(ete, 9), paid: null, note: 'Congé d\'été' });
    }
    d.advances = [
      { id: C.uid(), employeeId: empAssist.id, date: mo(3, 12), amount: 600, monthly: 200,
        note: 'Avance remboursée en trois mois' }
    ];
    // Les bulletins déjà établis reprennent ces éléments : on les recalcule une fois les listes posées.
    d.payslips.forEach(sl => {
      const e = d.employees.find(x => x.id === sl.employeeId);
      const input = C.payslipInputFor(d, e, sl.year, sl.month);
      // On garde les primes saisies plus haut et le brut DU MOIS (une augmentation ne réécrit pas un
      // bulletin passé), on reprend absences et avances.
      const merged = { ...input, gross: input.prorata ? input.gross : sl.gross, bonuses: sl.bonuses || [] };
      Object.assign(sl, merged, { computed: C.computePayslip(e, merged, payCfg) });
    });

    // ---------- numéros de série (4.1.0) ----------
    // Les deux articles matériel sont suivis unité par unité. Trois cas montrés : des unités encore en
    // stock, des unités livrées sous garantie, et une garantie qui se termine bientôt.
    const kPare = d.catalog[11], kPoste = d.catalog[12];
    const ser = (item, num, o) => ({ id: C.uid(), itemId: item.id, serial: num, status: 'stock',
      inDate: mo(13, 1), inPurchaseId: '', clientId: '', outDate: '', outDocId: '',
      warrantyMonths: item.warrantyMonths, notes: '', ...(o || {}) });
    const factEcole = byKey['f-lauriers-salle'];
    d.serials = [
      // stock de départ
      ser(kPare, 'UTM-2025-0041'),
      ser(kPare, 'UTM-2025-0042'),
      ser(kPoste, 'PC-2025-0117'),
      ser(kPoste, 'PC-2025-0118'),
      ser(kPoste, 'PC-2025-0119'),
      // entrés par la facture d'achat FA-2026-1187, puis livrés à l'École
      ser(kPare, 'UTM-2026-0210', { inDate: mo(2, 18), inPurchaseId: achatParNumero('FA-2026-1187').id, status: 'vendu', outDate: factEcole.date, outDocId: factEcole.id, clientId: cl[7].id })
    ];
    for (let i = 1; i <= 12; i++) {
      d.serials.push(ser(kPoste, 'PC-2026-' + String(300 + i), { inDate: mo(2, 18), inPurchaseId: achatParNumero('FA-2026-1187').id,
        status: 'vendu', outDate: factEcole.date, outDocId: factEcole.id, clientId: cl[7].id }));
    }
    // Une unité livrée il y a presque deux ans : sa garantie de 24 mois se termine dans quelques semaines.
    d.serials.push(ser(kPoste, 'PC-2024-0088', { inDate: mo(26, 3), status: 'vendu',
      outDate: C.addMonths(daysAgo(-40), -24, Number(daysAgo(-40).slice(8, 10))), outDocId: '', clientId: cl[0].id,
      notes: 'Livré avant la mise en service de SkanFact.' }));

    // ---------- immobilisations (3.5.0) ----------
    // Le portable acheté plus haut, immobilisé comme il se doit ; une camionnette plus ancienne, encore
    // en cours d'amortissement ; et un serveur revendu cette année, pour montrer une plus-value.
    const immoLaptop = achatParNumero('FA-2026-0940');       // ligne « Ordinateur portable »
    d.assets = [
      { id: C.uid(), label: 'Ordinateur portable 16 Go', category: 'informatique', date: immoLaptop.date,
        amount: 2600, residual: 0, years: 3, supplierId: sp[0].id, purchaseId: immoLaptop.id, lineIndex: 0,
        notes: 'À VÉRIFIER avec le comptable : durée retenue de trois ans.' },
      { id: C.uid(), label: 'Camionnette utilitaire', category: 'transport', date: mo(30, 15),
        amount: 38000, residual: 4000, years: 5, supplierId: '', purchaseId: '', lineIndex: null,
        notes: 'Achetée avant la mise en service de SkanFact : saisie à la main.' },
      { id: C.uid(), label: 'Serveur de sauvegarde', category: 'informatique', date: mo(40, 1),
        amount: 9000, residual: 0, years: 4, supplierId: sp[0].id, purchaseId: '', lineIndex: null,
        disposal: { date: mo(3, 20), amount: 2400, reason: 'Revendu à un confrère' },
        notes: 'Remplacé par l\'hébergement externalisé.' },
      { id: C.uid(), label: 'Mobilier du bureau', category: 'mobilier', date: mo(22, 3),
        amount: 6400, residual: 0, years: 10, supplierId: '', purchaseId: '', lineIndex: null, notes: '' },
      // Les biens de la création : un premier portable entièrement amorti, et la climatisation.
      { id: C.uid(), label: 'Premier ordinateur portable', category: 'informatique', date: mo(58, 10),
        amount: 2300, residual: 0, years: 3, supplierId: sp[0].id, purchaseId: '', lineIndex: null,
        notes: 'Amorti en entier : il sert encore de poste de secours.' },
      { id: C.uid(), label: 'Climatisation du bureau', category: 'agencement', date: mo(57, 20),
        amount: 3200, residual: 0, years: 8, supplierId: '', purchaseId: '', lineIndex: null, notes: '' }
    ];

    // ---------- trésorerie (3.3.0) ----------
    // Un compte bancaire et une caisse, avec un solde de départ il y a un an et quelques
    // mouvements qui n'ont ni facture ni achat : salaires, impôts, frais bancaires.
    // Les comptes s'ouvrent avec l'entreprise, il y a cinq ans : le capital déposé à la banque, un
    // fonds de caisse.
    const accBank = { id: C.uid(), name: 'BIAT — compte courant', kind: 'banque', bank: 'BIAT', rib: '00 006 0000123456789 01',
      opening: 6000, openingDate: mo(60, 1), isDefault: true, statementBalance: '', notes: '' };
    const accCash = { id: C.uid(), name: 'Caisse espèces', kind: 'caisse', bank: '', rib: '',
      opening: 300, openingDate: mo(60, 1), isDefault: false, statementBalance: '', notes: 'Petites dépenses du bureau.' };
    d.accounts = [accBank, accCash];
    const mv = (kind, monthsAgo, day, amount, label, acc) => ({
      id: C.uid(), date: mo(monthsAgo, day), kind, amount, label,
      accountId: (acc || accBank).id, method: kind === 'salaire' ? 'virement' : 'autre', reference: ''
    });
    d.movements = [];
    // Depuis la 5.0.0, les salaires sortent tout seuls des bulletins réglés : en saisir aussi ici les
    // compterait deux fois, et SkanFact le signalerait dans « À faire ». On ne garde que ce qui n'a
    // ni facture, ni achat, ni bulletin.
    for (let i = HIST_DEBUT; i >= 1; i--) {
      d.movements.push(mv('banque', i, 5, i > 30 ? 12 : 18, 'Frais de tenue de compte'));
    }
    d.movements.push(mv('impot', 4, 25, 2400, 'Acompte provisionnel'));
    d.movements.push(mv('apport', 13, 3, 5000, 'Apport en compte courant'));
    // Les impôts des années passées : trois acomptes provisionnels par an, qui grandissent avec l'activité.
    for (let an = 1; an <= 4; an++) {
      [[6, 25], [9, 25], [12, 25]].forEach(([mois, jour], k) => {
        const date = `${C.addMonths(T, -12 * an, 1).slice(0, 4)}-${String(mois).padStart(2, '0')}-${jour}`;
        if (date < mo(HIST_DEBUT - 12, 1) || date >= mo(13, 1)) return;
        d.movements.push({ id: C.uid(), date, kind: 'impot', amount: 500 + 350 * (5 - an) + 100 * k, label: 'Acompte provisionnel',
          accountId: accBank.id, method: 'virement', reference: '' });
      });
    }
    d.movements.push(mv('autre-sortie', 2, 14, 120, 'Fournitures diverses', accCash));
    // 8.9.0 : la déclaration mensuelle se PAIE. Chaque mois écoulé, le net de TVA (timbres et retenues
    // opérées compris) sort de la banque le 28 du mois suivant, sur le compte « TVA à payer » — c'est
    // ce que montre un mouvement libre qui porte sa contrepartie. Sans ces paiements, le 4365 de
    // l'exemple grossirait pour toujours, et le premier comptable à qui on le montre demanderait
    // pourquoi la société ne paie jamais sa TVA.
    const annees = [...new Set(d.documents.map(x => (x.date || '').slice(0, 4)).filter(Boolean))].sort();
    annees.forEach(y => C.vatChain(d, d.company, y).forEach(m => {
      const net = C.round3(m.toPay + m.stamps + m.withheldOnBuys);
      const [yy, mm] = m.month.split('-').map(Number);
      const echeance = C.addMonths(`${m.month}-01`, 1, 28);
      if (net <= 0 || echeance >= T) return;
      d.movements.push({ id: C.uid(), date: echeance, kind: 'impot', amount: net, label: `TVA, timbres et retenues de ${C.MONTHS_FR[mm - 1]} ${yy}`,
        accountId: accBank.id, method: 'virement', reference: `TVA ${m.month}`, compte: '4365' });
    }));
    // 8.9.0 : une opération diverse saisie à la main — ce que le comptable demande en premier.
    // La prime d'assurance du local, avancée par le gérant : une charge qui n'a ni facture
    // fournisseur enregistrée ni sortie de banque, donc invisible sans OD.
    d.ecrituresOD = [];
    d.ecrituresOD.push({ id: C.uid(), date: mo(3, 15), piece: C.odPiece(d, mo(3, 15)), journal: 'OD',
      label: 'Assurance annuelle du local, avancée par le gérant',
      lignes: [{ compte: '616', label: 'Prime d\'assurance multirisque', debit: 840, credit: 0 },
               { compte: '4421', label: 'Avance du gérant en compte courant', debit: 0, credit: 840 }] });
    // Quelques encaissements déjà pointés sur le relevé, pour que le rapprochement ait du sens
    // 10.14.0 — sur cinq ans, tout ce qui a plus de deux mois est pointé : une entreprise qui a
    // cinq ans rapproche sa banque chaque mois, et c'est ce qui laisse à l'onglet Rapprochement le
    // seul travail récent à faire.
    const pointeAvant = mo(2, 1);
    d.documents.forEach((doc, i) => (doc.payments || []).forEach(p => { if (i % 3 === 0 || p.date < pointeAvant) p.reconciled = true; }));
    d.purchases.forEach(pu => (pu.payments || []).forEach(p => { if (p.date < pointeAvant) p.reconciled = true; }));
    d.movements.forEach(m => { if (m.date < pointeAvant) m.reconciled = true; });
    d.payslips.forEach(sl => { if (sl.paidDate && sl.paidDate < pointeAvant) sl.reconciled = true; });

    // ---------- modèles et textes prédéfinis ----------
    d.templates = [
      { id: C.uid(), name: 'Audit standard', type: 'devis', subject: 'Audit de sécurité et plan d\'action', lines: [line(k[0], 1), line(k[5], 2), line(k[7], 1)], discountRate: 0, notes: 'Rapport remis sous 10 jours ouvrés après l\'intervention.' },
      { id: C.uid(), name: 'Formation sensibilisation (demi-journée)', type: 'devis', subject: 'Formation sensibilisation cybersécurité', lines: [line(k[5], 3)], discountRate: 0, notes: 'Jusqu\'à 12 participants. Support de cours remis à chaque participant.' },
      { id: C.uid(), name: 'Maintenance mensuelle', type: 'facture', subject: 'Maintenance et supervision', lines: [line(k[4], 1), line(k[3], 1)], discountRate: 0, notes: 'Facturation mensuelle à terme échu.' }
    ];
    d.snippets = [
      { id: C.uid(), name: 'Garantie', text: 'Prestations garanties 3 mois. Toute intervention hors périmètre fera l\'objet d\'un devis complémentaire.' },
      { id: C.uid(), name: 'Acompte', text: 'Un acompte de 30 % est demandé à la commande, le solde à la livraison.' },
      { id: C.uid(), name: 'Confidentialité', text: 'Les informations recueillies pendant la mission restent strictement confidentielles et ne sont communiquées à aucun tiers.' }
    ];
    // Le jeu d'exemple se DÉCLARE (7.0.0). Sans cette marque, rien ne le distingue de vraies données :
    // l'application ne pouvait ni le dire à l'écran, ni proposer d'en sortir, ni empêcher sa fausse
    // identité de servir à une vraie facture. Le cas qui fait mal : charger l'exemple avant d'avoir
    // rempli sa fiche société (c'est ce que fait un débutant), puis se mettre à travailler pour de
    // vrai — le nom « DÉMO — Société de services SUARL », un matricule inventé et un RIB qui n'existe
    // pas s'impriment alors sur chaque facture, et le client vire l'argent dans le vide.
    // ---------- ce qu'une entreprise de cinq ans a déjà fait (10.14.0) ----------
    // Ses déclarations CNSS sont déposées, sauf la dernière (elle attend dans « À faire ») ; sa
    // déclaration d'employeur de l'an dernier aussi.
    const soc = C.socialDue(d, T);
    const aGarder = soc.filter(x => x.kind === 'cnss').slice(-1).map(x => x.id);
    soc.filter(x => !aGarder.includes(x.id)).forEach(x => d.socialFilings.push({ id: x.id, filedAt: C.addDays(x.dueDate, -3), label: x.label }));
    // Et ses mois sont CLÔTURÉS, au fil de l'eau, jusqu'à il y a quatre mois : un mois déclaré ne
    // bouge plus. Les trois derniers restent ouverts — c'est là que se fait le travail en cours, et
    // « À faire » en réclame la clôture le moment venu.
    const clotureJusquA = C.addDays(mo(3, 1), -1);
    for (let back = HIST_DEBUT; back >= 4; back--) {
      const fin = C.addDays(mo(back - 1, 1), -1);
      if (fin > clotureJusquA) break;
      C.closePeriod(d, fin, { todayIso: T, at: ts(C.addDays(fin, 12)), by: '', reason: '' });
    }
    d.demo = true;
    d.company.demo = !avaitUneSociete;   // l'identité vient-elle de l'exemple, ou est-elle la sienne ?
    return C.migrateData(d);
  }

  return { buildDemoData, DEMO_COMPANY };
});
