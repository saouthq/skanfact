// Jeu de données de démonstration : une petite société de cybersécurité sur treize mois d'activité.
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

  // Champs société remplis seulement s'ils sont vides (la démo ne touche pas au nom, logo, cachet, thème…)
  const DEMO_COMPANY = { phone: '+216 55 123 456', email: 'contact@skancyber.tn', website: 'www.skancyber.tn', bank: 'BIAT — Agence El Manar', rib: '08 006 0000123456789 12', rc: 'B01234562024', capital: '1 000 DT' };

  function buildDemoData(currentCompany, todayIso) {
    const T = todayIso || C.today();
    const d = C.migrateData(null);
    d.company = { ...d.company, ...JSON.parse(JSON.stringify(currentCompany || {})) };
    Object.keys(DEMO_COMPANY).forEach(k => { if (!d.company[k]) d.company[k] = DEMO_COMPANY[k]; });
    const co = d.company;
    const daysAgo = n => C.addDays(T, -n);
    const mo = (n, day) => C.addMonths(T, -n, day);   // n mois en arrière, au jour demandé
    const ts = iso => new Date(iso + 'T09:00:00').getTime();

    // ---------- clients ----------
    const mk = (name, matricule, address, phone, email, withholdingRate, extra) =>
      ({ id: C.uid(), name, matricule, address, phone, email, notes: '', withholdingRate: withholdingRate == null ? '' : withholdingRate, ...(extra || {}) });
    d.clients = [
      mk('Clinique Les Jasmins', '1234567A/M/000', 'Avenue Habib Bourguiba\n2080 Ariana', '+216 71 700 100', 'direction@clinique-jasmins.tn', 1.5,
        { notes: 'Contact : Dr Leïla Mansour (directrice). Contrat de maintenance mensuel, facturé le 1er du mois.' }),
      mk('Pharmacie Centrale El Menzah', '2345678B/A/000', '12 rue Ibn Khaldoun\n1004 El Menzah', '+216 71 234 567', 'pharmacie.menzah@gmail.com'),
      mk('Cabinet Ben Salah Avocats', '3456789C/P/000', 'Immeuble Le Palmier, Lac 2\n1053 Tunis', '+216 71 960 200', 'contact@bensalah-avocats.tn', 1.5,
        { notes: 'Contact : Me Sonia Ben Salah. Applique la retenue à la source (1,5 %) : demander l\'attestation à chaque règlement.' }),
      mk('Lemon Beach Hammamet', '4567890D/A/000', 'Zone touristique\n8050 Hammamet', '+216 72 280 300', 'hello@lemonbeach.tn', '',
        { notes: 'Règle souvent en retard : relancer par téléphone (M. Sami Gharbi, directeur).' }),
      mk('Restaurant Dar El Jeld', '5678901E/A/000', '5 rue Dar El Jeld, Médina\n1006 Tunis', '+216 71 560 916', 'reservation@dareljeld.tn'),
      mk('Mohamed Trabelsi', 'CIN 09876543', 'Résidence Les Oliviers, Bloc B\n2092 El Manar', '+216 98 765 432', 'm.trabelsi@outlook.com', 0),
      mk('Nova Digital Ltd', 'GB 123 4567 89', '20 Eastbourne Terrace\nLondon W2 6LG, United Kingdom', '+44 20 7946 0958', 'ops@novadigital.co.uk', 0,
        { lang: 'en', currency: 'EUR', notes: 'Client étranger : documents en anglais, facturation en euros. Export de services facturé sans TVA — À VÉRIFIER avec le comptable.' }),
      mk('École Internationale Les Lauriers', '6789012F/A/000', 'Rue du Lac Léman, Les Berges du Lac\n1053 Tunis', '+216 71 861 400', 'admin@leslauriers.tn', 1.5)
    ];
    const cl = d.clients;

    // ---------- catalogue ----------
    const cat = (label, description, unitPrice, vatRate, unit) => ({ id: C.uid(), label, description, unitPrice, vatRate, unit });
    d.catalog = [
      cat('Audit de sécurité réseau', 'Cartographie du réseau, scan de vulnérabilités, revue de configuration, rapport et plan d\'action', 1200, 19, 'forfait'),
      cat('Test d\'intrusion applicatif', 'Test en boîte grise sur une application web, rapport détaillé avec preuves et recommandations', 2500, 19, 'forfait'),
      cat('Installation et configuration pare-feu', 'Mise en place d\'un pare-feu (matériel fourni séparément), règles, VPN, journalisation', 850, 19, 'u'),
      cat('Sauvegarde externalisée', 'Sauvegarde chiffrée automatique avec vérification mensuelle de restauration', 90, 19, 'mois'),
      cat('Maintenance et supervision', 'Surveillance des équipements, mises à jour de sécurité, intervention sous 24 h', 250, 19, 'mois'),
      cat('Formation sensibilisation cybersécurité', 'Session pour les équipes : hameçonnage, mots de passe, bonnes pratiques', 150, 7, 'h'),
      cat('Installation poste de travail', 'Préparation, sécurisation et mise en réseau d\'un poste', 120, 19, 'u'),
      cat('Déplacement hors Grand Tunis', 'Frais de déplacement', 60, 19, 'u'),
      cat('Antivirus / EDR (licence 1 an)', 'Déploiement et licence annuelle par poste', 95, 19, 'poste'),
      cat('Hébergement et supervision serveur', 'Serveur virtuel supervisé, mises à jour et sauvegardes incluses', 180, 19, 'mois'),
      cat('Mise en conformité protection des données', 'Registre des traitements, procédures, déclaration à l\'INPDP', 1800, 19, 'forfait')
    ];
    const k = d.catalog;
    const line = (item, qty, price, unit) => ({ label: item.label, description: item.description, qty, unit: unit || item.unit, unitPrice: price != null ? price : item.unitPrice, vatRate: item.vatRate });

    // ---------- contrats ----------
    const recClinique = { id: C.uid(), clientId: cl[0].id, subject: 'Maintenance et supervision — {mois}', reference: '', lines: [line(k[4], 1), line(k[3], 1)], discountRate: 0, withholdingRate: 1.5,
      notes: 'Contrat annuel, facturation mensuelle à terme échu.', every: 'month', day: 1, nextDate: mo(0, 1), lastIssued: mo(1, 1), active: true, createdAt: ts(mo(12, 1)), lang: 'fr', currency: co.currency, exchangeRate: '' };
    const recEcole = { id: C.uid(), clientId: cl[7].id, subject: 'Hébergement et sauvegarde — trimestre {mois}', reference: '', lines: [line(k[9], 3), line(k[3], 3)], discountRate: 0, withholdingRate: 1.5,
      notes: 'Facturation trimestrielle d\'avance.', every: 'quarter', day: 15, nextDate: C.addMonths(mo(1, 15), 3, 15), lastIssued: mo(1, 15), active: true, createdAt: ts(mo(10, 15)), lang: 'fr', currency: co.currency, exchangeRate: '' };
    const recRestaurant = { id: C.uid(), clientId: cl[4].id, subject: 'Supervision et sauvegarde — {mois}', reference: '', lines: [line(k[4], 1), line(k[3], 1)], discountRate: 0, withholdingRate: 0,
      notes: 'Contrat suspendu : facture en retard de paiement.', every: 'month', day: 5, nextDate: C.addMonths(daysAgo(55), 1, 5), lastIssued: daysAgo(55), active: false, createdAt: ts(mo(4, 5)), lang: 'fr', currency: co.currency, exchangeRate: '' };
    d.recurring = [recClinique, recEcole, recRestaurant];

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
      lines: [line(k[4], 1), line(k[3], 1), line(k[8], 5)], notes: 'Antivirus déployé sur les 5 postes de la caisse et du bureau.', emails: [E(daysAgo(55), 'facture'), E(daysAgo(10), 'relance1')] });
    add('q-rest-postes', { type: 'devis', client: 4, date: daysAgo(50), status: 'envoyé', subject: 'Renouvellement des postes de la caisse', lines: [line(k[6], 4), line(k[8], 4)], emails: [E(daysAgo(50), 'devis')] });

    // Particulier : petite facture payée en espèces, devis en attente, brouillon du jour
    add('f-trab-poste', { type: 'facture', client: 5, date: mo(7, 22), status: 'envoyée', subject: 'Installation et sécurisation d\'un poste', lines: [line(k[6], 1), line(k[8], 1)], payments: [pay(3, 'all', 'especes')] });
    add('q-trab-maison', { type: 'devis', client: 5, date: daysAgo(10), status: 'envoyé', subject: 'Sécurisation du réseau domestique', lines: [line(k[6], 2, 100), line(k[3], 12, 60)], notes: 'Tarif particulier.', emails: [E(daysAgo(10), 'devis')] });
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
    add('q-lemon-wifi', { type: 'devis', client: 3, date: mo(6, 9), status: 'accepté', subject: 'Refonte du réseau Wi-Fi de l\'hôtel', lines: [line(k[0], 1), line(k[2], 1), line(k[9], 12), line(k[7], 2)], discountRate: 10,
      notes: 'Intervention hors saison. Bornes Wi-Fi fournies par l\'hôtel.', emails: [E(mo(6, 9), 'devis')] });
    add('f-lemon-acompte', { type: 'facture', client: 3, date: mo(6, 16), status: 'envoyée', subject: 'Acompte 30 % — Refonte du réseau Wi-Fi de l\'hôtel', fromQuote: 'q-lemon-wifi', deposit: { quote: 'q-lemon-wifi', percent: 30 },
      lines: b => C.depositLines(b['q-lemon-wifi'], 30, co), payments: [pay(12, 'all')], emails: [E(mo(6, 16), 'facture')] });
    add('f-lemon-solde', { type: 'facture', client: 3, date: mo(4, 25), status: 'envoyée', subject: 'Solde — Refonte du réseau Wi-Fi de l\'hôtel', fromQuote: 'q-lemon-wifi', settles: { quote: 'q-lemon-wifi', deposits: ['f-lemon-acompte'] },
      lines: b => C.settlementLines(b['q-lemon-wifi'], [b['f-lemon-acompte']]), discountRate: 10, payments: [pay(41, 'all', 'traite', 'Traite à 30 jours')], emails: [E(mo(4, 25), 'facture')] });
    add('f-lemon-parefeu', { type: 'facture', client: 3, date: daysAgo(82), status: 'envoyée', subject: 'Installation pare-feu et sensibilisation', lines: [line(k[2], 1), line(k[5], 3), line(k[7], 1)],
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
      if (s.certificate) doc.withholdingCertificate = true;
      if (!draft || s.type === 'devis') doc.number = C.nextNumber(d, s.type, s.date);
      if (s.emails && s.emails.length) {
        doc.emails = s.emails.map(e => ({ date: e.date, to: client.email, kind: e.kind, subject: C.emailFor(e.kind, doc, client, co, { jours: doc.dueDate ? Math.max(0, C.daysBetween(doc.dueDate, e.date)) : 0 }).subject }));
        const rem = doc.emails.filter(e => /^relance\d$/.test(e.kind)).map(e => ({ date: e.date, level: Number(e.kind.slice(-1)) }));
        if (rem.length) doc.reminders = rem;
      }
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
    return C.migrateData(d);
  }

  return { buildDemoData, DEMO_COMPANY };
});
