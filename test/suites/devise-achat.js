// La devise d'un achat (10.1.0).
//
// POURQUOI CES TESTS SONT COMPORTEMENTAUX, ET PAS STATIQUES.
//
// Le défaut corrigé ici est un défaut de COUVERTURE : `purchaseTotals` rendait des montants sans
// devise, et une douzaine d'agrégateurs les additionnaient tels quels. Un test qui relirait la
// source pour vérifier que chacun appelle bien `.base` serait fragile (une forme, pas une règle —
// 7.16.0) et surtout facile à satisfaire par accident. On prend donc l'autre bout : UN achat en
// euros, un taux connu, et chaque agrégateur interrogé pour de vrai. Un agrégateur qu'on oublierait
// de convertir demain fait tomber sa ligne, nommément.
//
// Le jeu est construit pour que la conversion se VOIE : 1 000 € à 3,4 donne 3 400 DT, un chiffre
// qu'aucun arrondi ne peut produire par hasard depuis 1 000 (règle 9.6.1 : les DONNÉES d'un test
// comptent autant que sa forme).

module.exports = ({ t, assert }) => {
  const core = require('../../src/renderer/core.js');
  // `entrySet` vit dans compta.js depuis la 9.6.1 et n'est pas réexporté par core.js.
  const K = require('../../src/renderer/compta.js');

  const TAUX = 3.4;
  const société = { ...core.DEFAULT_DATA.company, name: 'Test', currency: 'DT', stampFee: 1, regime: 'reel' };

  // Un achat de 1 000 € HT, TVA 19 % (190 €), entièrement déductible, en destination « charge ».
  const achatEuro = (extra) => ({
    id: 'p1', kind: 'facture', supplierId: 's1', number: 'F-EU-1', date: '2026-03-10', dueDate: '2026-04-10',
    category: 'Logiciels', currency: 'EUR', exchangeRate: TAUX, fees: 0, withholdingRate: 0,
    lines: [{ label: 'Licence annuelle', qty: 1, unitPrice: 1000, vatRate: 19, destination: 'charge', deductible: true }],
    payments: [], attachments: [], ...(extra || {})
  });

  const jeu = (achat) => {
    const d = JSON.parse(JSON.stringify(core.DEFAULT_DATA));
    d.company = société;
    d.suppliers = [{ id: 's1', name: 'Fournisseur EU', matricule: '' }];
    d.purchases = [achat || achatEuro()];
    return d;
  };
  const PERIODE = { from: '2026-03-01', to: '2026-03-31' };

  t('10.1.0 : les montants natifs sont ceux de la facture, `base` ceux de la comptabilité', () => {
    const t1 = core.purchaseTotals(achatEuro(), société);
    // Ce que le fournisseur a écrit : on ne le touche pas, c'est ce que l'écran de la pièce affiche.
    assert.strictEqual(t1.totalHT, 1000);
    assert.strictEqual(t1.totalVAT, 190);
    assert.strictEqual(t1.netToPay, 1190);
    assert.strictEqual(t1.currency, 'EUR');
    assert.strictEqual(t1.rate, TAUX);
    // Ce qui entre en comptabilité. Calculé à la main, jamais recopié de la sortie (règle 7.0.1).
    assert.strictEqual(t1.base.totalHT, 3400);
    assert.strictEqual(t1.base.totalVAT, 646);          // 190 × 3,4
    assert.strictEqual(t1.base.deductibleVAT, 646);
    assert.strictEqual(t1.base.netToPay, 4046);         // 1 190 × 3,4
    assert.strictEqual(t1.base.byDestination.charge, 3400);
    assert.strictEqual(t1.base.vatByRate[19].deductible, 646);
  });

  t('10.1.0 : un achat dans la devise de la société n\'est pas touché', () => {
    // Le cas de TOUS les achats d'avant la 10.1.0, et de l'immense majorité de ceux d'après : `base`
    // doit être identique aux montants natifs, sinon la mise à jour changerait des chiffres déjà
    // déclarés. C'est la moitié du test qui protège l'existant.
    const local = achatEuro({ currency: 'DT', exchangeRate: 1 });
    const t1 = core.purchaseTotals(local, société);
    assert.deepStrictEqual(
      [t1.base.totalHT, t1.base.totalVAT, t1.base.netToPay, t1.base.byDestination.charge],
      [t1.totalHT, t1.totalVAT, t1.netToPay, t1.byDestination.charge]
    );
    // Et sans devise du tout (une pièce qui n'aurait pas traversé la migration) : même chose.
    const nu = achatEuro({ currency: undefined, exchangeRate: undefined });
    const t2 = core.purchaseTotals(nu, société);
    assert.strictEqual(t2.base.netToPay, t2.netToPay);
  });

  t('10.1.0 : la migration pose la devise de la société et un taux de 1, sans rien changer', () => {
    const d = JSON.parse(JSON.stringify(core.DEFAULT_DATA));
    d.company = société;
    d.purchases = [{ id: 'x', kind: 'facture', supplierId: '', date: '2025-01-05', lines: [{ label: 'a', qty: 1, unitPrice: 100, vatRate: 19 }], payments: [] }];
    const m = core.migrateData(d);
    assert.strictEqual(m.purchases[0].currency, 'DT');
    assert.strictEqual(m.purchases[0].exchangeRate, 1);
    assert.strictEqual(core.purchaseTotals(m.purchases[0], société).base.totalHT, 100);
  });

  // ------------------------------------------------------------------ chaque agrégateur, un par un
  t('10.1.0 : la TVA déductible de la déclaration est convertie', () => {
    const v = core.vatReturn(jeu(), société, PERIODE, 0);
    assert.strictEqual(v.deductible, 646, 'vatReturn doit déclarer 646 DT, pas 190');
    assert.strictEqual(v.byRate[19].deductible, 646);
  });

  t('10.1.0 : le journal des achats part en dinars et NOMME la devise d\'origine', () => {
    const j = core.purchaseJournal(jeu(), société, PERIODE);
    assert.strictEqual(j.length, 1);
    assert.strictEqual(j[0].ht, 3400);
    assert.strictEqual(j[0].deductible, 646);
    assert.strictEqual(j[0].net, 4046);
    // La devise est NOMMÉE : un chiffre converti dont on ne sait plus d'où il vient ne se vérifie
    // plus contre la facture papier (règle des agrégats, 3.1.0 / 7.0.1).
    assert.strictEqual(j[0].currency, 'EUR');
    assert.strictEqual(j[0].rate, TAUX);
  });

  t('10.1.0 : le résultat et le seuil de rentabilité comptent la charge convertie', () => {
    const r = core.simpleResult(jeu(), société, PERIODE);
    assert.strictEqual(r.charges, 3400, 'simpleResult doit porter 3 400 DT de charges');
    const b = core.breakEven(jeu(), société, PERIODE);
    assert.strictEqual(b.variable + b.fixed, 3400, 'breakEven doit porter 3 400 DT');
  });

  t('10.1.0 : les écritures comptables portent les montants en dinars et restent équilibrées', () => {
    const e = core.journalEntries(jeu(), société, PERIODE, { sections: ['achats'] });
    const debit = core.round3(e.reduce((s, x) => s + (Number(x.debit) || 0), 0));
    const credit = core.round3(e.reduce((s, x) => s + (Number(x.credit) || 0), 0));
    assert.strictEqual(debit, 4046, 'le débit doit valoir 3 400 + 646');
    assert.strictEqual(credit, 4046, 'le fournisseur est crédité du net converti');
    assert.strictEqual(debit, credit, 'une pièce reste équilibrée');
    // Et on regarde LA LIGNE, pas seulement les totaux. `entrySet.done()` absorbe l'écart sur la
    // dernière ligne : avec le défaut (le fournisseur crédité du montant natif), les totaux
    // tombaient juste QUAND MÊME, et cette assertion-là était la seule à ne pas pouvoir échouer.
    // C'est la preuve par réintroduction qui l'a dit, et c'est ce qui a fait naître `ecartAbsorbe`.
    const fourn = e.find(x => x.role === 'fournisseurs');
    assert.ok(fourn, 'la pièce doit porter une ligne fournisseur');
    assert.strictEqual(fourn.credit, 4046, 'le fournisseur est crédité de 4 046 DT, pas de 1 190');
    assert.ok(!e.some(x => x.ecartAbsorbe), 'aucun écart ne doit avoir été absorbé : ' + (e.find(x => x.ecartAbsorbe) || {}).ecartAbsorbe);
  });

  t('10.1.0 : ce qu\'on doit au fournisseur est converti, et sa devise est nommée', () => {
    const d = jeu();
    const l = core.payablesList(d, société, '2026-03-15');
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].remaining, 4046);
    assert.strictEqual(l[0].total, 4046);
    assert.strictEqual(l[0].currency, 'EUR');
    const s = core.supplierSummary(d, société, 's1', '2026-03-15');
    assert.strictEqual(s.ht, 3400);
    assert.strictEqual(s.remaining, 4046);
  });

  t('10.1.0 : un règlement partiel en euros sort de la caisse en dinars', () => {
    const d = jeu(achatEuro({ payments: [{ id: 'y1', date: '2026-03-20', amount: 500, method: 'virement' }] }));
    const p = core.supplierPayments(d, société, PERIODE);
    assert.strictEqual(p.length, 1);
    assert.strictEqual(p[0].amount, 1700, '500 € réglés font 1 700 DT qui sortent vraiment du compte');
    assert.strictEqual(p[0].currency, 'EUR');
    // Ce qui reste dû suit la même règle.
    assert.strictEqual(core.payablesList(d, société, '2026-03-25')[0].remaining, core.round3((1190 - 500) * TAUX));
  });

  t('10.1.0 : la retenue à la source opérée se reverse en dinars', () => {
    const d = jeu(achatEuro({ withholdingRate: 10 }));
    const w = core.withholdingsToIssue(d, société);
    assert.strictEqual(w.length, 1);
    assert.strictEqual(w[0].amount, core.round3(1190 * 0.10 * TAUX), 'la retenue part au Trésor en dinars');
    const a = core.employerAnnual(d, 2026, société);   // (data, year, company) — pas (data, company, year)
    assert.strictEqual(a.held[0].amount, w[0].amount, 'la déclaration d\'employeur dit le même chiffre');
  });

  t('10.1.0 : le stock entre au coût CONVERTI, sinon la marge est fausse avec lui', () => {
    const d = jeu(achatEuro({ lines: [{ label: 'Disque', qty: 2, unitPrice: 120, vatRate: 19, destination: 'stock', deductible: true }] }));
    d.catalog = [{ id: 'k1', label: 'Disque', unitPrice: 800, vatRate: 19, tracked: true, unitCost: 0 }];
    const st = core.stockOf(d, 'k1');
    // 120 € l'unité, soit 408 DT : c'est cette valeur qui entre dans le coût moyen pondéré, donc
    // dans la valeur du stock au bilan ET dans le coût des ventes.
    assert.strictEqual(st.qty, 2);
    assert.strictEqual(st.cmp, core.round3(120 * TAUX), 'le coût moyen pondéré est en dinars');
    assert.strictEqual(st.value, core.round3(2 * 120 * TAUX), 'la valeur du stock au bilan suit');
  });

  t('10.1.0 : la marge d\'une affaire retranche le coût converti', () => {
    const d = jeu(achatEuro({ projectId: 'pr1' }));
    d.projects = [{ id: 'pr1', name: 'Affaire EU', clientId: '', status: 'en cours', startDate: '2026-01-01' }];
    const m = core.projectMargin(d, société, 'pr1');
    assert.strictEqual(m.cost, 3400, 'un achat en euros coûte 3 400 DT à l\'affaire, pas 1 000');
  });

  t('10.1.0 : un achat en devise SANS taux se signale dans « À faire »', () => {
    // Le repli à 1 de `rateOf` évite un écran cassé, mais il fait compter 1 EUR = 1 DT. C'est le
    // seul champ dont l'oubli change des chiffres AILLEURS sans rien afficher ici (règle 7.0.1) —
    // d'où la ligne, séparée de celle des ventes parce que le geste qui la règle est ailleurs.
    const d = jeu(achatEuro({ exchangeRate: '' }));
    assert.ok(core.missingRate(d.purchases[0], société), 'missingRate doit voir un achat sans taux');
    const todo = core.todoList(d, société, '2026-03-15');
    const ligne = todo.find(x => x.id === 'taux-achat');
    assert.ok(ligne, '« À faire » doit porter la ligne des achats sans taux');
    assert.strictEqual(ligne.level, 'danger');
    assert.ok(/déductible/.test(ligne.detail), 'elle doit dire ce qui est faux : ' + ligne.detail);
    assert.strictEqual(ligne.route, '#/achats', 'elle mène aux achats, pas aux factures');
    // Et elle N'EXISTE PAS quand le taux est là : une ligne rouge permanente cesse d'être lue.
    assert.ok(!core.todoList(jeu(), société, '2026-03-15').some(x => x.id === 'taux-achat'));
  });

  t('10.1.0 : l\'absorbeur d\'arrondis DIT ce qu\'il avale au-delà d\'un arrondi', () => {
    // Il existe depuis la 6.3.0 pour les quelques millimes que laisse une TVA calculée ligne par
    // ligne. Il avalait N'IMPORTE QUEL écart, et rendait une pièce équilibrée, plausible et fausse.
    // Les DEUX sens comptent : sans le premier, on marquerait tous les arrondis légitimes et la
    // marque cesserait d'être lue ; sans le second, un trou de 2 856 DT resterait invisible.
    const arrondi = K.entrySet({ date: '2026-01-01', journal: 'VT', piece: 'F1' });
    arrondi.debit('411', 'client', 1190.001);
    arrondi.credit('706', 'vente', 1000);
    arrondi.credit('4367', 'tva', 190);
    const la = arrondi.done();
    assert.ok(!la.some(l => l.ecartAbsorbe), 'un millime d\'arrondi ne se signale pas');
    assert.strictEqual(core.round3(la.reduce((s, l) => s + l.debit, 0)), core.round3(la.reduce((s, l) => s + l.credit, 0)));

    const trou = K.entrySet({ date: '2026-01-01', journal: 'AC', piece: 'F2' });
    trou.debit('606', 'charge', 3400);
    trou.debit('4366', 'tva', 646);
    trou.credit('401', 'fournisseur', 1190);       // le défaut de devise, exactement
    const lb = trou.done();
    assert.strictEqual(lb[0].ecartAbsorbe, 2856, 'un vrai trou se signale, avec son montant');
    // …et la pièce reste équilibrée : une pièce déséquilibrée ne s'importe nulle part.
    assert.strictEqual(core.round3(lb.reduce((s, l) => s + l.debit, 0)), core.round3(lb.reduce((s, l) => s + l.credit, 0)));
  });

  t('10.1.0 : aucune écriture du jeu de démonstration ne porte d\'écart absorbé', () => {
    // Le contrôle qui donne sa valeur au marqueur : sur 24 mois de données réalistes, il doit rester
    // muet. S'il parle un jour, c'est un appelant qui s'est trompé de montant — pas un arrondi.
    const demo = require('../../src/renderer/demo.js');
    const d = core.migrateData(demo.buildDemoData(société, '2026-09-21'));
    const e = core.journalEntries(d, d.company, { from: '2025-01-01', to: '2026-12-31' }, {});
    const fautives = e.filter(x => x.ecartAbsorbe);
    assert.strictEqual(fautives.length, 0,
      fautives.length + ' écriture(s) avec un écart absorbé, p.ex. ' + JSON.stringify(fautives[0] || {}).slice(0, 200));
  });

  t('10.1.0 : le paquet du comptable emporte les montants convertis', () => {
    const plan = core.packPlan(jeu(), société, core.packPeriod(2026, 3));
    const achats = plan.entries.find(e => e.path === 'journaux/achats.csv');
    assert.ok(achats, 'le journal des achats doit être dans le paquet');
    assert.ok(achats.text.includes('3400') || achats.text.includes('3 400') || /3400,000|3400\.000/.test(achats.text),
      'le CSV doit porter 3 400, pas 1 000 : ' + achats.text.split('\n')[1]);
    // L'équilibre du paquet ne dépend pas de la devise.
    assert.ok(Math.abs(plan.balance.debit - plan.balance.credit) < 0.005, 'le paquet reste équilibré');
  });
  // Rapport QA du 23/09/2026 (E-08) — les deux agrégateurs que la 10.1.0 n'avait pas interrogés.
  // Une facture Adobe de 1 190 € TTC sortait de la prévision pour 1 190 DT au lieu de 4 046 : le trou
  // annoncé était sous-estimé de 2 856 dinars, sur la page qui répond à « aurai-je de quoi payer ? ».
  t('Rapport QA E-08 : la prévision de trésorerie sort un achat en devise CONVERTI', () => {
    const f = core.cashForecast(jeu(), société, 90, '2026-03-15');
    const ev = f.events.find(e => e.kind === 'fournisseur');
    assert.ok(ev, 'l\'achat ouvert doit être dans la prévision');
    assert.strictEqual(ev.amount, -4046, `la sortie doit valoir 1 190 € × 3,4 = −4 046 DT, pas ${ev.amount}`);
    assert.strictEqual(f.outflow, -4046, 'le total à décaisser porte le montant converti');
  });

  // Le même oubli, un écran plus loin : le lettrage se confronte au solde du 401 — en dinars depuis
  // la 10.1.0 — et additionnait le reste en euros.
  t('Rapport QA E-08 : le lettrage fournisseurs compte un achat en devise dans la monnaie du 401', () => {
    const l = core.lettrage(jeu(), société, 'fournisseurs', '2026-03-15');
    const r = (l.rows || l).find(x => x.tiersId === 's1');
    assert.ok(r, 'le fournisseur doit avoir sa ligne de lettrage');
    assert.strictEqual(r.reste, 4046, `le reste ouvert doit valoir 4 046 DT, pas ${r.reste}`);
    assert.strictEqual(r.ouverts[0].montant, 4046);
    assert.strictEqual(r.ouverts[0].regle, 0, 'rien n\'a été payé');
    // Réglé : ce qui a été PAYÉ, converti — pas « montant − reste », qui compterait un avoir deux fois.
    const payé = core.lettrage(jeu(achatEuro({ payments: [{ id: 'y1', date: '2026-03-20', amount: 500, method: 'virement' }] })), société, 'fournisseurs', '2026-03-25');
    const rp = (payé.rows || payé).find(x => x.tiersId === 's1');
    assert.strictEqual(rp.ouverts[0].regle, 1700, '500 € réglés à 3,4 = 1 700 DT');
    assert.strictEqual(rp.reste, 2346, '4 046 − 1 700');
  });
};
