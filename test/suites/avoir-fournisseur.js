// L'avoir fournisseur, l'acompte versé et le relevé de compte client (10.2.0).
//
// POURQUOI CES TESTS SONT COMPORTEMENTAUX.
//
// Comme pour la devise (10.1.0), le défaut d'origine est un défaut de COUVERTURE : le SENS d'une
// pièce doit se propager dans une douzaine d'agrégateurs. La parade retenue est de le porter dans
// `t.base` — le montant natif reste positif, c'est ce que le fournisseur a écrit — pour qu'aucun
// agrégateur n'ait à s'en souvenir. Un test de source vérifierait une forme ; celui-ci vérifie la
// RÈGLE, en posant un avoir de 1 000 et en interrogeant chaque agrégateur pour de vrai.
//
// Les données sont choisies pour discriminer (règle 9.6.1) : la facture fait 2 000 HT, l'avoir
// 1 000, l'acompte 500. Aucune somme ne peut tomber juste par hasard, et le sens se voit au signe.

module.exports = ({ t, assert }) => {
  const core = require('../../src/renderer/core.js');
  const K = require('../../src/renderer/compta.js');

  const société = { ...core.DEFAULT_DATA.company, name: 'Test', currency: 'DT', stampFee: 1, regime: 'reel' };
  const ligne = (label, pu, dest) => ({ label, qty: 1, unit: 'u', unitPrice: pu, vatRate: 19, destination: dest || 'charge', deductible: true });
  const pièce = (o) => ({
    id: o.id, kind: o.kind || 'facture', supplierId: 's1', number: o.number || '', date: o.date || '2026-03-10',
    dueDate: o.dueDate || '', subject: o.subject || '', category: o.category || 'Fournitures de bureau', notes: '',
    currency: o.currency || 'DT', exchangeRate: o.exchangeRate || 1, fees: o.fees || 0, withholdingRate: 0,
    achatLie: o.achatLie || '', lines: o.lines || [], payments: o.payments || [], attachments: []
  });

  // La facture : 2 000 HT + 380 TVA = 2 380. L'avoir : 1 000 HT + 190 = 1 190, imputé dessus.
  // L'acompte : 500 HT + 95 = 595, versé et réglé, imputé lui aussi.
  const jeu = (extra) => {
    const d = core.migrateData({
      ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: société,
      suppliers: [{ id: 's1', name: 'Fournisseur Test', matricule: '1111111A/M/000', paymentTermsDays: 30 }],
      clients: [], documents: [],
      purchases: [
        pièce({ id: 'FAC', number: 'F-100', date: '2026-03-10', dueDate: '2026-04-10', lines: [ligne('Matériel', 2000)] }),
        pièce({ id: 'AVO', kind: 'avoir', number: 'A-9', date: '2026-03-20', achatLie: 'FAC', lines: [ligne('Retour partiel', 1000)] }),
        pièce({ id: 'ACO', kind: 'acompte', number: 'AC-1', date: '2026-03-01', achatLie: 'FAC', lines: [ligne('Acompte à la commande', 500)],
          payments: [{ id: 'x1', date: '2026-03-01', amount: 595, method: 'virement', accountId: '', reference: '', note: '' }] }),
        ...(extra || [])
      ],
      ...(extra && extra.data ? extra.data : {})
    });
    return d;
  };

  t('10.2.0 : un avoir se saisit en positif et compte en négatif', () => {
    const d = jeu();
    const av = d.purchases.find(p => p.id === 'AVO');
    const t1 = core.purchaseTotals(av, société);
    // Le natif est ce que le fournisseur a écrit sur son avoir : 1 000 HT, 190 de TVA.
    assert.strictEqual(t1.totalHT, 1000, 'le montant natif reste positif');
    assert.strictEqual(t1.totalVAT, 190);
    assert.strictEqual(t1.sens, -1, 'le sens de la pièce est porté par les totaux');
    // `base` porte l'effet comptable, et c'est lui que tout ce qui agrège lit.
    assert.strictEqual(t1.base.totalHT, -1000, 'base porte le signe');
    assert.strictEqual(t1.base.deductibleVAT, -190);
    assert.strictEqual(t1.base.netToPay, -1190);
    assert.strictEqual(t1.base.byDestination.charge, -1000);
    // Une facture ordinaire n'a pas changé de sens.
    const fa = core.purchaseTotals(d.purchases.find(p => p.id === 'FAC'), société);
    assert.strictEqual(fa.sens, 1);
    assert.strictEqual(fa.base.totalHT, 2000);
  });

  t('10.2.0 : l\'avoir et l\'acompte diminuent la facture qu\'ils visent', () => {
    const d = jeu();
    const fac = d.purchases.find(p => p.id === 'FAC');
    // 2 380 − 1 190 (avoir) − 595 (acompte) = 595
    const b = core.purchaseBalance(fac, société, d);
    assert.strictEqual(b.impute, 1785, 'les deux pièces rattachées sont déduites');
    assert.strictEqual(b.remaining, 595);
    assert.strictEqual(b.liees.length, 2);
    // Sans `data`, rien n'est déduit : c'est ce que veut l'écran d'une pièce isolée, et c'est ce qui
    // garde compatibles les appels d'avant la 10.2.0.
    assert.strictEqual(core.purchaseBalance(fac, société).remaining, 2380);
    // Un avoir IMPUTÉ ne vaut plus rien tout seul : le compter en plus ferait payer deux fois moins.
    assert.strictEqual(core.purchaseBalance(d.purchases.find(p => p.id === 'AVO'), société, d).remaining, 0);
  });

  t('10.2.0 : un avoir libre est un crédit chez le fournisseur', () => {
    const d = jeu([pièce({ id: 'LIB', kind: 'avoir', number: 'A-10', date: '2026-04-02', lines: [ligne('Rabais de fin d\'année', 300)] })]);
    const lib = d.purchases.find(p => p.id === 'LIB');
    assert.strictEqual(core.purchaseBalance(lib, société, d).remaining, -357, 'le fournisseur nous doit 357');
    assert.strictEqual(core.purchaseStatus(lib, société, '2026-05-01', d), 'à imputer');
    assert.strictEqual(core.purchaseStatus(d.purchases.find(p => p.id === 'AVO'), société, '2026-05-01', d), 'imputé');
    // Un avoir n'est jamais une dette : il ne se règle pas, il s'impute. Le cas qui le prouve n'est
    // pas l'avoir ordinaire (son reste est négatif, donc il tombe de lui-même) mais celui que le
    // fournisseur a REMBOURSÉ après l'avoir imputé : son reste redevient positif, et sans le
    // garde-fou il réapparaîtrait dans l'échéancier comme une dette qu'on n'a pas.
    d.purchases.find(p => p.id === 'AVO').payments = [{ id: 'z', date: '2026-04-01', amount: 1190, method: 'virement', accountId: '', reference: '', note: '' }];
    assert.strictEqual(core.purchaseBalance(d.purchases.find(p => p.id === 'AVO'), société, d).remaining, 0,
      'un avoir imputé ne redevient pas une dette parce qu\'il a aussi été remboursé');
    const pay = core.payablesList(d, société, '2026-05-01');
    assert.ok(!pay.some(x => x.id === 'LIB' || x.id === 'AVO'), 'aucun avoir dans l\'échéancier');
    assert.ok(pay.some(x => x.id === 'FAC'), 'la facture, elle, y est');
    assert.strictEqual(pay.find(x => x.id === 'FAC').remaining, 595, 'et pour son reste réel');
    // La fiche du fournisseur, elle, compte le crédit : sinon on paierait une facture qu'un avoir
    // couvrait déjà.
    const s = core.supplierSummary(d, société, 's1', '2026-05-01');
    assert.strictEqual(s.remaining, 238, '595 dus moins 357 d\'avoir libre');
  });

  t('10.2.0 : les écritures d\'un avoir changent de colonne, pas de signe', () => {
    const d = jeu();
    const acc = core.chartAccounts(d);
    const e = core.journalEntries(d, société, { from: '2026-01-01', to: '2026-12-31' }, {});
    assert.ok(e.every(x => x.debit >= 0 && x.credit >= 0), 'aucun débit ni crédit négatif');
    assert.ok(!e.some(x => x.ecartAbsorbe), 'aucune pièce ne laisse d\'écart absorbé');
    const avo = e.filter(x => x.docId === 'AVO');
    const chAvo = avo.find(x => x.account === acc.charges);
    assert.ok(chAvo && chAvo.credit === 1000 && !chAvo.debit, 'la charge est CRÉDITÉE de 1 000');
    const fouAvo = avo.find(x => x.account.startsWith(acc.fournisseurs));
    assert.ok(fouAvo && fouAvo.debit === 1190 && !fouAvo.credit, 'le fournisseur est DÉBITÉ de 1 190');
    // L'acompte ne touche aucune charge : c'est une avance, pas une consommation.
    const aco = e.filter(x => x.docId === 'ACO' && x.source === 'achat');
    assert.ok(aco.some(x => x.account === acc.avancesFournisseurs && x.debit === 500), 'l\'acompte débite les avances');
    assert.ok(!aco.some(x => x.account === acc.charges), 'et ne débite aucune charge');
    // L'imputation solde l'avance le jour de la facture : sans elle, le 409 resterait débiteur pour
    // toujours et le 401 le serait d'autant — deux comptes faux qui s'annulent au bilan.
    const imp = e.filter(x => x.docId === 'FAC' && x.journal === 'OD');
    assert.strictEqual(imp.length, 3, 'l\'imputation reprend ce que l\'acompte avait posé, TVA comprise');
    assert.ok(imp.some(x => x.account === acc.avancesFournisseurs && x.credit === 500), 'elle crédite les avances du HT');
    assert.ok(imp.some(x => x.account === acc.tvaDeductible && x.credit === 95), 'et rend la TVA déjà déduite');
    assert.ok(imp.some(x => x.account.startsWith(acc.fournisseurs) && x.debit === 595), 'et débite le fournisseur du TTC');
    // Le 409 revient à zéro, le 4366 ne déduit la TVA qu'une fois, et le 401 porte ce qui reste dû.
    const bal = core.balanceGenerale(d, société, { from: '2026-01-01', to: '2026-12-31' }, {});
    const av409 = bal.rows.find(r => r.account === acc.avancesFournisseurs);
    assert.ok(!av409 || Math.abs(av409.solde) < 0.0005, 'les avances sont soldées');
    assert.strictEqual(bal.rows.find(r => r.account === acc.tvaDeductible).solde, 190,
      'la TVA déductible est celle des 1 000 réellement consommés, pas 380 + 95 − 190');
    assert.strictEqual(core.round3(-bal.rows.find(r => r.account === acc.fournisseurs).solde), 595,
      'le fournisseur porte exactement le reste dû calculé par purchaseBalance');
  });

  t('10.2.0 : un avoir fournisseur SORT la marchandise du stock', () => {
    const d = jeu();
    d.catalog = [{ id: 'art', label: 'Clavier', unit: 'u', unitPrice: 60, unitCost: 40, vatRate: 19, tracked: true, minStock: 0, initialQty: 0, initialCost: 0, serialized: false, warrantyMonths: 0 }];
    d.purchases = [
      pièce({ id: 'ST1', number: 'F-ST', date: '2026-02-01', lines: [{ ...ligne('Clavier', 40, 'stock'), qty: 10, itemId: 'art' }] }),
      pièce({ id: 'ST2', kind: 'avoir', number: 'A-ST', date: '2026-02-15', achatLie: 'ST1', lines: [{ ...ligne('Clavier', 40, 'stock'), qty: 3, itemId: 'art' }] }),
      // Un acompte n'est pas de la marchandise, quelle que soit la destination de ses lignes.
      pièce({ id: 'ST3', kind: 'acompte', number: 'AC-ST', date: '2026-02-20', lines: [{ ...ligne('Clavier', 40, 'stock'), qty: 5, itemId: 'art' }] })
    ];
    const mv = core.stockMovements(d, 'art', '2026-12-31');
    assert.strictEqual(mv.filter(m => m.docId === 'ST1')[0].qty, 10);
    assert.strictEqual(mv.filter(m => m.docId === 'ST2')[0].qty, -3, 'l\'avoir renvoie trois claviers au fournisseur');
    assert.ok(!mv.some(m => m.docId === 'ST3'), 'un acompte n\'entre dans aucun stock');
    assert.strictEqual(core.stockOf(d, 'art', '2026-12-31').qty, 7);
  });

  t('10.2.0 : la TVA, la charge et le seuil suivent le sens de la pièce', () => {
    const d = jeu();
    // TVA déductible du mois : 380 (facture) − 190 (avoir) + 95 (acompte) = 285.
    const tva = core.vatReturn(d, société, '2026-03');
    assert.strictEqual(tva.deductible, 285, 'l\'avoir vient en moins de la TVA déductible');
    // Charge de la période : 2 000 − 1 000 = 1 000. L'acompte n'est PAS une charge.
    const r = core.simpleResult(d, société, { from: '2026-01-01', to: '2026-12-31' });
    assert.strictEqual(r.charges, 1000, 'l\'acompte n\'entre pas dans les charges, l\'avoir les réduit');
    const be = core.breakEven(d, société, { from: '2026-01-01', to: '2026-12-31' });
    assert.ok(be.variable + be.fixed === 1000, 'le seuil de rentabilité voit la même charge');
  });

  t('10.2.0 : un règlement sur un avoir est une entrée d\'argent', () => {
    // Le fournisseur rembourse au lieu de déduire : l'argent ENTRE.
    const d = jeu([pièce({ id: 'REM', kind: 'avoir', number: 'A-REM', date: '2026-04-05',
      lines: [ligne('Remboursement', 200)],
      payments: [{ id: 'y1', date: '2026-04-10', amount: 238, method: 'virement', accountId: '', reference: '', note: '' }] })]);
    const rows = core.supplierPayments(d, société, { from: '2026-01-01', to: '2026-12-31' });
    const rem = rows.find(x => x.purchaseId === 'REM');
    assert.strictEqual(rem.amount, -238, 'un remboursement porte un montant négatif');
    assert.strictEqual(rows.find(x => x.purchaseId === 'ACO').amount, 595, 'un acompte payé reste une sortie');
    // Et l'écriture change de colonne toute seule : la banque est DÉBITÉE.
    const acc = core.chartAccounts(d);
    const e = core.journalEntries(d, société, { from: '2026-01-01', to: '2026-12-31' }, {});
    const l = e.filter(x => x.docId === 'REM' && x.source === 'règlement');
    assert.ok(l.some(x => x.account === acc.banque && x.debit === 238), 'la banque reçoit');
    assert.ok(l.some(x => x.account.startsWith(acc.fournisseurs) && x.credit === 238), 'le fournisseur est crédité');
    assert.ok(l.every(x => x.debit >= 0 && x.credit >= 0));
  });

  t('10.2.0 : un avoir n\'est pas le doublon d\'une facture de même numéro', () => {
    const d = jeu();
    const av = { ...d.purchases.find(p => p.id === 'AVO'), id: 'neuf', number: 'F-100' };
    assert.strictEqual(core.achatDoublon(d, av), null, 'deux séries différentes chez le même fournisseur');
    const fa = { ...d.purchases.find(p => p.id === 'FAC'), id: 'neuf2' };
    assert.ok(core.achatDoublon(d, fa), 'une facture de même numéro reste un doublon');
  });

  t('10.2.0 : « À faire » nomme les pièces qui ne viennent en déduction de rien', () => {
    const d = jeu();
    assert.ok(!core.todoList(d, société, '2026-05-01').some(x => x.id === 'achat-impute'),
      'tout est rattaché : rien à signaler');
    const d2 = jeu([pièce({ id: 'LIB', kind: 'avoir', number: 'A-10', date: '2026-04-02', lines: [ligne('Rabais', 300)] })]);
    const ligneTodo = core.todoList(d2, société, '2026-05-01').find(x => x.id === 'achat-impute');
    assert.ok(ligneTodo, 'un avoir libre remonte');
    assert.strictEqual(ligneTodo.count, 1);
    assert.strictEqual(ligneTodo.route, '#/achats');
  });

  // ---------- le relevé de compte client ----------
  const jeuVentes = () => {
    const d = core.migrateData({
      ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: société,
      clients: [{ id: 'c1', name: 'Clinique <Les Oliviers>', matricule: '2222222B/M/000', address: 'Tunis', email: 'a@b.tn' }],
      documents: [
        // Ouverte et échue : 1 000 HT + 190 + 1 de timbre = 1 191
        { id: 'F1', type: 'facture', number: 'FAC-2026-001', clientId: 'c1', date: '2026-01-10', dueDate: '2026-02-10',
          status: 'envoyée', currency: 'DT', exchangeRate: 1, stampFee: 1, discountRate: 0, withholdingRate: 0,
          lines: [{ label: 'Prestation', qty: 1, unit: 'u', unitPrice: 1000, vatRate: 19 }], payments: [], subject: 'Janvier' },
        // Ouverte, partiellement réglée : 2 000 HT → 2 381, 1 000 payés → reste 1 381
        { id: 'F2', type: 'facture', number: 'FAC-2026-002', clientId: 'c1', date: '2026-03-01', dueDate: '2026-12-01',
          status: 'envoyée', currency: 'DT', exchangeRate: 1, stampFee: 1, discountRate: 0, withholdingRate: 0,
          lines: [{ label: 'Prestation', qty: 1, unit: 'u', unitPrice: 2000, vatRate: 19 }],
          payments: [{ id: 'p', date: '2026-03-20', amount: 1000, method: 'virement' }], subject: 'Mars' },
        // Soldée : elle n'a rien à faire sur un relevé de ce qui reste dû.
        { id: 'F3', type: 'facture', number: 'FAC-2026-003', clientId: 'c1', date: '2026-02-01', dueDate: '2026-03-01',
          status: 'envoyée', currency: 'DT', exchangeRate: 1, stampFee: 1, discountRate: 0, withholdingRate: 0,
          lines: [{ label: 'Prestation', qty: 1, unit: 'u', unitPrice: 100, vatRate: 19 }],
          payments: [{ id: 'q', date: '2026-02-05', amount: 120, method: 'especes' }], subject: 'Février' },
        // Un avoir LIBRE : un crédit que le client peut encore employer.
        { id: 'A1', type: 'avoir', number: 'AVO-2026-001', clientId: 'c1', date: '2026-04-01', status: 'émis',
          currency: 'DT', exchangeRate: 1, stampFee: 0, discountRate: 0, withholdingRate: 0, creditOf: '',
          lines: [{ label: 'Geste commercial', qty: 1, unit: 'u', unitPrice: 100, vatRate: 19 }], payments: [], subject: 'Geste' }
      ]
    });
    return d;
  };

  t('10.2.0 : le relevé de compte ne porte que ce qui est encore ouvert', () => {
    const d = jeuVentes();
    const r = core.releveClient(d, 'c1', société, { date: '2026-06-30' });
    const nums = r.lignes.map(l => l.number);
    assert.deepStrictEqual(nums, ['FAC-2026-001', 'FAC-2026-002', 'AVO-2026-001'], 'les ouvertes, dans l\'ordre du temps');
    assert.ok(!nums.includes('FAC-2026-003'), 'une facture soldée n\'a rien à faire sur un relevé');
    assert.strictEqual(r.lignes[0].reste, 1191);
    assert.strictEqual(r.lignes[1].reste, 1381);
    assert.strictEqual(r.lignes[1].regle, 1000, 'le déjà-réglé se lit');
    assert.strictEqual(r.lignes[2].reste, -119, 'un avoir libre vient en moins');
    assert.strictEqual(r.total, core.round3(1191 + 1381 - 119));
    // Échu / à échoir : le client veut savoir ce qui est en retard, pas seulement le total.
    assert.strictEqual(r.echu, 1191, 'seule la première est échue au 30 juin');
    assert.strictEqual(core.round3(r.echu + r.aVenir), r.total);
    assert.ok(r.plusAncien > 100);
  });

  t('10.2.0 : le relevé est arrêté à une date, et un avoir rattaché ne compte pas deux fois', () => {
    const d = jeuVentes();
    // Au 15 janvier, la facture de mars n'existe pas encore et celle de janvier n'est pas échue.
    const tot = core.releveClient(d, 'c1', société, { date: '2026-01-15' });
    assert.strictEqual(tot.lignes.length, 1);
    assert.strictEqual(tot.echu, 0, 'échéance au 10 février : rien n\'est échu le 15 janvier');
    // Un avoir RATTACHÉ est déjà dans le reste dû de sa facture : le remontrer ferait un relevé
    // deux fois trop favorable.
    d.documents.find(x => x.id === 'A1').creditOf = 'F1';
    const r2 = core.releveClient(d, 'c1', société, { date: '2026-06-30' });
    assert.ok(!r2.lignes.some(l => l.number === 'AVO-2026-001'), 'l\'avoir rattaché ne fait pas de ligne');
    assert.strictEqual(r2.lignes.find(l => l.number === 'FAC-2026-001').reste, core.round3(1191 - 119));
    assert.strictEqual(r2.total, core.round3(1191 - 119 + 1381), 'et le total ne le compte qu\'une fois');
  });

  t('10.2.0 : le relevé imprimé porte son total et échappe ce qu\'il affiche', () => {
    const d = jeuVentes();
    const r = core.releveClient(d, 'c1', société, { date: '2026-06-30' });
    const html = core.releveHtml(r, { ...société, rib: '07 012 000', bank: 'Amen' }, {});
    assert.ok(html.includes('Relevé de compte'));
    assert.ok(html.includes('Clinique &lt;Les Oliviers&gt;'), 'le nom du client est échappé');
    assert.ok(!html.includes('<Les Oliviers>'));
    assert.ok(html.includes('FAC-2026-001') && html.includes('AVO-2026-001'));
    assert.ok(html.includes('Total dû au'));
    assert.ok(html.includes('07 012 000'), 'le RIB n\'apparaît que quand il reste quelque chose à payer');
    // Un compte soldé le DIT, il ne rend pas un tableau vide.
    const vide = core.releveHtml(core.releveClient(d, 'inconnu', société, {}), société, {});
    assert.ok(vide.includes('le compte est soldé'));
    assert.ok(!vide.includes('07 012 000'), 'et ne réclame aucun virement');
  });

  t('10.2.0 : un avoir fournisseur en devise se convertit ET change de sens', () => {
    const d = jeu([pièce({ id: 'EUR', kind: 'avoir', number: 'A-EUR', date: '2026-05-02',
      currency: 'EUR', exchangeRate: 3.4, lines: [ligne('Retour licence', 100)] })]);
    const t1 = core.purchaseTotals(d.purchases.find(p => p.id === 'EUR'), société);
    assert.strictEqual(t1.totalHT, 100, 'le natif est celui de l\'avoir du fournisseur');
    assert.strictEqual(t1.base.totalHT, -340, 'converti ET retourné');
    // Et l'écriture reste équilibrée, sans écart absorbé.
    const e = core.journalEntries(d, société, { from: '2026-05-01', to: '2026-05-31' }, {});
    const av = e.filter(x => x.docId === 'EUR');
    assert.ok(av.length >= 2 && av.every(x => x.debit >= 0 && x.credit >= 0));
    assert.strictEqual(core.round3(av.reduce((s, x) => s + x.debit, 0)), core.round3(av.reduce((s, x) => s + x.credit, 0)));
    assert.ok(!av.some(x => x.ecartAbsorbe));
    // L'absorbeur de la 10.1.0 reste armé : une pièce vraiment déséquilibrée le DIT.
    const set = K.entrySet({ date: '2026-05-02', journal: 'AC', piece: 'X' });
    set.debit('606', 'a', 100); set.credit('401', 'b', 90);
    assert.ok(set.done().some(x => x.ecartAbsorbe), 'dix dinars d\'écart ne s\'avalent pas en silence');
  });
};
