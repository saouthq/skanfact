'use strict';
// ============================================================================================
// La vérité comptable (10.14.0) — deux chemins, un chiffre, sur cinq ans d'exemple
//
// Chaque invariant compare deux chiffres que l'application calcule par DEUX chemins différents,
// et qui doivent être égaux au millime : la banque du grand livre et celle de la Trésorerie, la
// TVA du journal et celle de la déclaration, le 411 et le lettrage, le 425 et les salaires dus.
// Un test qui ne regarde qu'un chemin grave ce qu'il calcule ; deux chemins qui divergent
// désignent le défaut. C'est ainsi qu'ont été trouvés, le même jour, la TVA d'un acompte
// fournisseur déduite deux fois et l'avance sur salaire qui ne sortait jamais de la banque — deux
// défauts que chacun de leurs tests « à un chemin » laissait passer.
//
// Les données sont l'exemple de cinq ans : il porte ce qu'aucun jeu minimal ne porte (10.12.0,
// « un exemple complet est un test »). Et l'invariant se vérifie MOIS PAR MOIS pour la TVA :
// une erreur qui se compense sur l'année ne se voit que dans un mois (10.14.0, 215g).
module.exports = ({ t, assert }) => {
const core = require('../../src/renderer/core.js');
const demo = require('../../src/renderer/demo.js');

const CO = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', matricule: '1234567A', stampFee: 1 };
const r3 = x => Math.round(x * 1000) / 1000;
const T = core.today();
let cache = null;
const exemple = () => cache || (cache = core.migrateData(demo.buildDemoData(CO, T)));

// Renvoie la liste des écarts, jamais un booléen : quand il tombe, le test DIT où.
function ecarts(data) {
  const co = data.company, acc = core.chartAccounts(data), out = [];
  const ecart = (nom, a, b) => { if (Math.abs(r3(a) - r3(b)) > 0.002) out.push(`${nom} : ${r3(a)} ≠ ${r3(b)}`); };
  const solde = (bg, pref) => r3(bg.rows.filter(r => r.account.startsWith(pref)).reduce((s, r) => s + r.solde, 0));
  const annees = [...new Set([...(data.documents || []), ...(data.purchases || [])].map(x => (x.date || '').slice(0, 4)).filter(Boolean))].sort();
  annees.forEach(y => {
    const per = { from: `${y}-01-01`, to: y === T.slice(0, 4) ? T : `${y}-12-31` };
    // Chaque pièce équilibrée, aucun montant négatif, rien d'absorbé au-delà de l'arrondi.
    const pieces = {};
    core.journalEntries(data, co, per).forEach(e => {
      const k = `${e.journal}|${e.piece}|${e.date}|${e.docId || ''}|${e.source}`;
      const p = pieces[k] = pieces[k] || { d: 0, c: 0 };
      p.d += e.debit; p.c += e.credit;
      if (e.debit < 0 || e.credit < 0) out.push(`${y} montant négatif ${k}`);
      if (e.ecartAbsorbe) out.push(`${y} écart absorbé ${k}`);
    });
    Object.keys(pieces).forEach(k => { if (Math.abs(pieces[k].d - pieces[k].c) > 0.0015) out.push(`${y} pièce déséquilibrée ${k}`); });
    const bg = core.balanceGenerale(data, co, per);
    if (!bg.equilibree) out.push(`${y} balance déséquilibrée`);
    // La banque et la caisse du grand livre sont celles de la Trésorerie.
    const banques = (data.accounts || []).filter(a => a.kind !== 'caisse'), caisses = (data.accounts || []).filter(a => a.kind === 'caisse');
    ecart(`${y} banque (532) / Trésorerie`, solde(bg, acc.banque), banques.reduce((s, a) => s + core.accountBalance(data, co, a.id, per.to).balance, 0));
    ecart(`${y} caisse (54) / Trésorerie`, solde(bg, acc.caisse), caisses.reduce((s, a) => s + core.accountBalance(data, co, a.id, per.to).balance, 0));
    // TVA et chiffre d'affaires, mois par mois : l'écriture et la déclaration.
    for (let m = 1; m <= 12; m++) {
      const mm = `${y}-${String(m).padStart(2, '0')}`;
      if (mm > T.slice(0, 7)) break;
      const pm = { from: `${mm}-01`, to: `${mm}-${new Date(Date.UTC(+y, m, 0)).getUTCDate()}` };
      const E = core.journalEntries(data, co, pm, { sections: ['ventes', 'achats'] });
      const vr = core.vatReturn(data, co, pm);
      const mouv = (compte, sens) => r3(E.filter(e => e.account === compte).reduce((s, e) => s + sens * (e.debit - e.credit), 0));
      ecart(`${mm} TVA collectée`, mouv(acc.tvaCollectee, -1), vr.collected);
      ecart(`${mm} TVA déductible`, mouv(acc.tvaDeductible, 1), vr.deductible);
      ecart(`${mm} TVA déductible par taux`, Object.values(vr.byRate).reduce((s, x) => s + x.deductible, 0), vr.deductible);
      ecart(`${mm} chiffre d'affaires HT`, -r3(E.filter(e => e.account.startsWith('70')).reduce((s, e) => s + e.debit - e.credit, 0)), vr.salesHT);
      ecart(`${mm} timbre déclaré / 4368`, mouv(acc.timbre, -1), vr.stamps);
      // La page Marges et les Statistiques disent le même chiffre d'affaires, mois par mois (10.14.0).
      const st = core.salesTotals(data, co, pm.from, pm.to).ht;
      ecart(`${mm} marges par client / statistiques`, core.marginBy(data, co, pm.from, pm.to, 'client', 0).reduce((s, r) => s + r.revenue, 0), st);
      ecart(`${mm} marges par prestation / statistiques`, core.marginBy(data, co, pm.from, pm.to, 'item', 0).reduce((s, r) => s + r.revenue, 0), st);
    }
    // Le paquet du comptable annonce, mois par mois, ce que dit la CHAÎNE des déclarations :
    // un mois isolé ignore le crédit reporté (3.1.0), et le paquet de mars disait 286,729 DT à
    // décaisser là où la chaîne dit 52,079.
    const chaine = core.vatChain(data, co, +y);
    chaine.forEach((c, i) => {
      if (c.month > T.slice(0, 7)) return;
      const ch = core.packPlan(data, co, core.packPeriod(+y, i + 1), {}).manifest.chiffres;
      ecart(`${c.month} paquet : TVA à décaisser / chaîne`, ch.tvaADecaisser, c.toPay);
      ecart(`${c.month} paquet : crédit reporté / chaîne`, ch.creditTva, c.carryOut);
      ecart(`${c.month} paquet : TVA collectée / déclaration`, ch.tvaCollectee, c.collected);
      ecart(`${c.month} paquet : TVA déductible / déclaration`, ch.tvaDeductible, c.deductible);
      ecart(`${c.month} paquet : chiffre d'affaires / déclaration`, ch.ca, c.salesHT);
    });
    // Les états financiers tombent juste, et leur résultat est celui de la balance.
    const ef = core.etatsFinanciers(data, co, y, per.to);
    if (!ef.equilibre) out.push(`${y} bilan déséquilibré`);
    ecart(`${y} résultat`, ef.resultat, -solde(bg, '7') - solde(bg, '6'));
    // En cours d'exercice, les états attendent deux écritures d'inventaire (la dotation, la variation
    // du stock) que le résultat simplifié compte déjà : l'écran refait ce calcul, il doit tomber juste
    // (10.14.0) — et le stock « sur l'étagère » qu'il annonce est celui de la page Stock.
    [`${y}-03-31`, `${y}-06-30`, `${y}-09-30`, per.to].filter(d => d <= per.to && d < `${y}-12-31`).forEach(d => {
      const e2 = core.etatsFinanciers(data, co, y, d);
      const sr = core.simpleResult(data, co, { from: `${y}-01-01`, to: d }).resultat;
      ecart(`${d} états − dotation + variation de stock / résultat simplifié`, e2.resultat - e2.dotationEnAttente + e2.variationStockEnAttente, sr);
      const stocks = (e2.actif.find(g => g.titre === 'Stocks') || { total: 0 }).total;
      ecart(`${d} stock du bilan + variation en attente / page Stock`, stocks + e2.variationStockEnAttente, core.stockTotals(data, d).value);
    });
    // Le seuil de rentabilité dit le même résultat que l'onglet TVA (10.14.0) : il comptait ses
    // propres mouvements — une échéance d'emprunt entière en charge fixe — et oubliait les autres.
    ecart(`${y} seuil de rentabilité / résultat simplifié`, core.breakEven(data, co, per).result, core.simpleResult(data, co, per).resultat);
    // La paie des écritures est celle des bulletins, la CNSS des quatre trimestres et la déclaration
    // d'employeur aussi ; les crédits du 4321 et du 4531 se lisent HORS à-nouveaux (ce qu'on devait
    // au 1er janvier n'est pas une retenue de l'année).
    const Ey = core.journalEntries(data, co, per).filter(e => e.source !== 'anouveau');
    const mv = (compte, f) => r3(Ey.filter(e => e.account === compte).reduce((s, e) => s + f(e), 0));
    const ps = core.payrollSummary(data, +y);
    ecart(`${y} salaires bruts (640) / bulletins`, mv(acc.salairesBruts, e => e.debit - e.credit), ps.gross);
    ecart(`${y} charges patronales (645) / bulletins`, mv(acc.chargesPatronales, e => e.debit - e.credit), ps.cnssEmployer + ps.accident);
    ecart(`${y} TFP et FOPROLOS (661) / bulletins`, mv(acc.taxesSalaires, e => e.debit - e.credit), ps.tfp + ps.foprolos);
    ecart(`${y} IRPP retenu (4321) / bulletins`, mv(acc.irpp, e => e.credit), ps.irpp + ps.css);
    ecart(`${y} CNSS (4531) / bulletins`, mv(acc.cnss, e => e.credit), ps.cnssEmployee + ps.cnssEmployer + ps.accident);
    ecart(`${y} CNSS des quatre trimestres / bulletins`, [1, 2, 3, 4].reduce((s, q) => s + core.cnssDeclaration(data, +y, q).total, 0), ps.cnssEmployee + ps.cnssEmployer + ps.accident);
    const ea = core.employerAnnual(data, +y, co);
    ecart(`${y} déclaration d'employeur : bruts / bulletins`, ea.gross, ps.gross);
    // Le timbre et la retenue opérée : ce que les pièces portent, ce que l'État attend.
    // Un avoir qui porte un timbre le rend (la case est sur la pièce) : il vient en moins.
    const timbres = (data.documents || []).filter(d => (d.type === 'facture' || d.type === 'avoir') && d.number && d.status !== 'brouillon' && d.status !== 'annulée' && d.date >= per.from && d.date <= per.to)
      .reduce((s, d) => s + (d.type === 'avoir' ? -1 : 1) * core.toBase(d, core.computeTotals(d, co).stamp || 0, co), 0);
    ecart(`${y} timbre (4368) / factures émises`, mv(acc.timbre, e => (e.source === 'declaration' ? 0 : e.credit - e.debit)), timbres);   // la déclaration du mois le solde
    ecart(`${y} retenue opérée (4352) / déclaration d'employeur`, r3(core.journalEntries(data, co, per, { sections: ['achats'] })
      .filter(e => e.account === acc.rsOperee).reduce((s, e) => s + e.credit - e.debit, 0)), (ea.held || []).reduce((s, x) => s + x.amount, 0));
    // Les immobilisations d'un exercice terminé sont celles du tableau.
    if (per.to === `${y}-12-31` && per.to < T) {
      const at = core.assetTotals(data, +y);
      ecart(`${y} immobilisations (22)`, solde(bg, acc.immobilisations), at.grossActif);
      ecart(`${y} amortissements (28)`, -solde(bg, acc.amortissements), at.cumulActif);
      ecart(`${y} dotations (681) / annuités du tableau`, mv(acc.dotations, e => e.debit - e.credit), at.annuity);
      // Le stock du bilan est celui de la page Stock, et le résultat des écritures est le résultat
      // simplifié de l'onglet TVA — deux calculs que rien ne reliait (10.14.0).
      ecart(`${y} stock (37) / page Stock`, solde(bg, acc.stocks), core.stockTotals(data, per.to).value);
      ecart(`${y} résultat des états / résultat simplifié`, ef.resultat, core.simpleResult(data, co, per).resultat);
      // Les douze mois font l'année : l'amortissement de février comptait deux jours de trop sur
      // l'écran (le « 31 février »), et vingt-huit jours sur le paquet (10.14.0). Un millime par mois
      // d'arrondi, pas plus.
      let depM = 0, resM = 0;
      for (let m = 1; m <= 12; m++) { const r = core.simpleResult(data, co, core.packPeriod(+y, m)); depM += r.depreciation; resM += r.resultat; }
      const an = core.simpleResult(data, co, per);
      if (Math.abs(r3(depM) - an.depreciation) > 0.012) out.push(`${y} amortissements : douze mois ${r3(depM)} ≠ année ${an.depreciation}`);
      if (Math.abs(r3(resM) - an.resultat) > 0.012) out.push(`${y} résultat : douze mois ${r3(resM)} ≠ année ${an.resultat}`);
    }
    // Les à-nouveaux de l'exercice suivant sont les soldes de bilan de celui-ci.
    if (`${+y + 1}-01-01` <= T) {
      const an = {};
      core.journalEntries(data, co, { from: `${+y + 1}-01-01`, to: `${+y + 1}-01-01` }, { sections: ['anouveaux'] })
        .forEach(e => { an[e.account] = r3((an[e.account] || 0) + e.debit - e.credit); });
      const fin = core.balanceGenerale(data, co, { from: `${y}-01-01`, to: `${y}-12-31` });
      fin.rows.filter(r => !/^[67]/.test(r.account) && r.account !== acc.resultat).forEach(r => ecart(`${+y + 1} à-nouveau ${r.account}`, an[r.account] || 0, r.solde));
    }
  });
  // Aujourd'hui : les tiers et le personnel.
  const bgT = core.balanceGenerale(data, co, { from: `${T.slice(0, 4)}-01-01`, to: T });
  const lc = core.lettrage(data, co, 'clients'), lf = core.lettrage(data, co, 'fournisseurs');
  ecart('411 / lettrage clients', solde(bgT, acc.clients), lc.reste);
  ecart('401 / lettrage fournisseurs', -solde(bgT, acc.fournisseurs), lf.reste);
  ecart('restes des factures / lettrage clients', (data.documents || [])
    .filter(d => d.type === 'facture' && d.number && d.status !== 'brouillon')
    .reduce((s, d) => s + core.toBase(d, core.invoiceBalance(d, data, co).remaining, co), 0), lc.reste);
  // Le 425 : les nets des bulletins pas encore réglés, moins ce qui reste à rembourser des avances.
  const netsDus = (data.payslips || []).filter(s => !s.paidDate || s.paidDate > T).reduce((s, sl) => s + ((sl.computed || {}).net || 0), 0);
  const avances = (data.employees || []).reduce((s, e) => s + core.advanceBalance(data, e.id), 0);
  ecart('425 / salaires dus − avances', -solde(bgT, acc.personnel), netsDus - avances);
  return out;
}

t('10.14.0 : sur cinq ans d\'exemple, chaque chiffre calculé par deux chemins est le même', () => {
  const e = ecarts(exemple());
  assert.deepStrictEqual(e, [], `${e.length} écart(s) :\n  ${e.slice(0, 20).join('\n  ')}`);
});

t('10.14.0 : l\'exemple paie ce qu\'il doit à l\'État — ni CNSS, ni IRPP, ni TFP ne s\'empilent cinq ans', () => {
  const data = exemple(), co = data.company, acc = core.chartAccounts(data);
  const bg = core.balanceGenerale(data, co, { from: `${T.slice(0, 4)}-01-01`, to: T });
  const solde = c => -r3(bg.rows.filter(r => r.account === c).reduce((s, r) => s + r.solde, 0));
  // Ce qui reste dû ne dépasse pas deux périodes : le dernier trimestre de CNSS (il attend dans
  // « À faire ») et les deux derniers mois d'IRPP et de TFP, pas encore échus. Avant la 10.14.0 :
  // 30 232 DT de CNSS et 12 730 d'IRPP, cinq ans jamais versés.
  const mois = {};
  (data.payslips || []).forEach(sl => { const k = `${sl.year}-${sl.month}`, c = sl.computed || {};
    const x = mois[k] || (mois[k] = { irpp: 0, tfp: 0 }); x.irpp += (c.irpp || 0) + (c.css || 0); x.tfp += (c.tfp || 0) + (c.foprolos || 0); });
  const maxMois = f => Math.max(0, ...Object.values(mois).map(f));
  const annees = [...new Set((data.payslips || []).map(sl => Number(sl.year)))];
  const maxTrim = Math.max(0, ...annees.flatMap(y => [1, 2, 3, 4].map(q => core.cnssDeclaration(data, y, q).total)));
  assert.ok(maxTrim > 0 && maxMois(x => x.irpp) > 0, 'l\'exemple n\'a plus de paie : ce test ne prouve rien');
  assert.ok(solde(acc.cnss) <= 2 * maxTrim + 0.001, `la CNSS due (${solde(acc.cnss)}) s'empile : l'exemple ne paie pas ses cotisations`);
  assert.ok(solde(acc.irpp) <= 2 * maxMois(x => x.irpp) + 0.001, `l'IRPP dû (${solde(acc.irpp)}) s'empile : l'exemple ne le reverse pas`);
  assert.ok(solde(acc.tfpFoprolos) <= 2 * maxMois(x => x.tfp) + 0.001, `la TFP due (${solde(acc.tfpFoprolos)}) s'empile : l'exemple ne la reverse pas`);
});

t('10.14.0 : l\'exemple a pointé tout ce qui a plus de deux mois — ses paiements de cotisations et son avance compris', () => {
  // Une entreprise de cinq ans rapproche sa banque chaque mois. Les paiements de CNSS, d'IRPP et
  // l'avance versée, ajoutés à l'exemple en 10.14.0, étaient restés hors du pointage : la
  // Trésorerie affichait 36 028 DT « non pointé » sur un compte tenu depuis cinq ans.
  const data = exemple();
  const limite = core.addDays(core.addMonths(T, -2, 1), -1);
  const vieux = core.cashMovements(data, data.company, { from: '2000-01-01', to: limite }).filter(m => !m.reconciled);
  assert.deepStrictEqual(vieux.map(m => `${m.date} ${m.label}`), [], 'des mouvements de plus de deux mois ne sont pas pointés dans l\'exemple');
});

t('10.14.0 : une avance sur salaire sort de la banque le jour où on la verse, et le 425 la reprend', () => {
  // Calculé à la main : un salarié à 1 000 de net, une avance de 300 remboursée 100 par mois.
  const d = core.migrateData({
    ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: CO,
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 5000, openingDate: '2026-01-01', isDefault: true }],
    employees: [{ id: 'e', name: 'Salma', hireDate: '2025-01-01', grossSalary: 1200 }],
    advances: [{ id: 'av', employeeId: 'e', date: '2026-03-05', amount: 300, monthly: 100, accountId: 'b', method: 'virement' }],
    payslips: [{ id: 's3', employeeId: 'e', year: 2026, month: 3, deductions: [{ label: 'Remboursement d\'avance', amount: 100, advanceId: 'av' }], computed: { gross: 1200, net: 900, otherDeductions: 100, cnssEmployee: 0, cnssEmployer: 0, accident: 0, irpp: 200, css: 0 }, paidDate: '2026-03-31', accountId: 'b' }]
  });
  const mv = core.cashMovements(d, CO, { from: '2026-03-01', to: '2026-03-31' }, 'b');
  const av = mv.find(m => m.advanceId === 'av');
  assert.ok(av, 'l\'avance ne sort pas de la banque dans la Trésorerie');
  assert.strictEqual(av.amount, -300);
  assert.strictEqual(core.accountBalance(d, CO, 'b', '2026-03-31').balance, 5000 - 300 - 900);
  const E = core.journalEntries(d, CO, { from: '2026-03-01', to: '2026-03-31' }, { sections: ['paie'] });
  const acc = core.chartAccounts(d);
  const s = compte => r3(E.filter(e => e.account === compte).reduce((x, e) => x + e.debit - e.credit, 0));
  // 425 : − (900 + 100) au bulletin, + 900 au paiement, + 300 à l'avance = + 200, soit ce qui reste
  // à rembourser (300 − 100). La banque : − 900 − 300.
  assert.strictEqual(s(acc.personnel), 200, 'le 425 ne reprend pas l\'avance versée');
  assert.strictEqual(s(acc.banque), -1200, 'l\'avance ne sort pas de la banque dans les écritures');
  assert.strictEqual(r3(s(acc.personnel)), r3(core.advanceBalance(d, 'e')), 'le 425 n\'est pas l\'avance qui reste due');
});

t('10.14.0 : un salaire payé et une avance versée se pointent au rapprochement', () => {
  const app = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'renderer', 'app.js'), 'utf8');
  const debut = app.indexOf('const porteur = id => {');
  const bloc = app.slice(debut, app.indexOf('return hit;', debut));
  assert.ok(debut > 0 && bloc.length < 1500, 'tranche du porteur introuvable');
  // Les identifiants que `cashMovements` fabrique : chacun doit retrouver son porteur.
  const core2 = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'renderer', 'core.js'), 'utf8');
  const cm = core2.slice(core2.indexOf('function cashMovements('), core2.indexOf('function accountBalance('));
  const prefixes = [...cm.matchAll(/id: '([a-z]+-)' \+/g)].map(m => m[1]);
  assert.ok(prefixes.includes('pay-') && prefixes.includes('av-'), 'les préfixes des mouvements déduits ont changé');
  prefixes.forEach(p => assert.ok(bloc.includes(`'${p}'`), `un mouvement « ${p}… » ne se pointe pas : sa case accepte le clic et ne fait rien`));
});

// ---------- 10.14.0 : ce qu'un achat coûte, et le stock du bilan ----------
const base0 = extra => core.migrateData({ ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: CO, ...extra });
const soldeDe = (E, compte) => r3(E.filter(e => e.account === compte).reduce((x, e) => x + e.debit - e.credit, 0));

t('10.14.0 : la TVA non déductible fait partie du coût — la voiture s\'amortit TTC, la réception coûte TTC', () => {
  // Calculé à la main : voiture 50 000 HT, TVA 19 % non récupérable → 59 500 au 22 ; réception
  // 180 HT, TVA non récupérable → 214,2 au 606. Rien au 4366, 59 714,2 dus au fournisseur.
  const d = base0({
    suppliers: [{ id: 's', name: 'Auto Tunis' }],
    purchases: [{ id: 'p', kind: 'facture', supplierId: 's', number: 'AT-1', date: '2026-02-10', payments: [], createdAt: 1, lines: [
      { label: 'Voiture de tourisme', qty: 1, unitPrice: 50000, vatRate: 19, deductible: false, destination: 'immobilisation' },
      { label: 'Réception', qty: 1, unitPrice: 180, vatRate: 19, deductible: false, destination: 'charge' }] }]
  });
  const acc = core.chartAccounts(d);
  const E = core.journalEntries(d, CO, { from: '2026-02-01', to: '2026-02-28' }, { sections: ['achats'] });
  assert.strictEqual(soldeDe(E, acc.immobilisations), 59500, 'la TVA non récupérable d\'une voiture partait en charge au lieu d\'entrer dans son coût');
  assert.strictEqual(soldeDe(E, acc.charges), 214.2);
  assert.strictEqual(soldeDe(E, acc.tvaDeductible), 0);
  assert.strictEqual(core.assetsToCreate(d)[0].amount, 59500, 'la fiche proposée ne vaut pas ce que le 22 porte');
  const r = core.simpleResult(d, CO, { from: '2026-02-01', to: '2026-02-28' });
  assert.strictEqual(r.charges, 214.2, 'le résultat simplifié oubliait la TVA non récupérable');
  assert.strictEqual(r.immo, 59500);
});

t('10.14.0 : un bien payé en devise se propose en dinars, au montant que le 22 porte', () => {
  const d = base0({
    suppliers: [{ id: 's', name: 'Fournisseur Lyon' }],
    purchases: [{ id: 'p', kind: 'facture', supplierId: 's', number: 'L-9', date: '2026-02-10', currency: 'EUR', exchangeRate: 3.4, payments: [], createdAt: 1,
      lines: [{ label: 'Machine', qty: 1, unitPrice: 1000, vatRate: 0, destination: 'immobilisation' }] }]
  });
  const E = core.journalEntries(d, CO, { from: '2026-02-01', to: '2026-02-28' }, { sections: ['achats'] });
  assert.strictEqual(soldeDe(E, core.chartAccounts(d).immobilisations), 3400);
  assert.strictEqual(core.assetsToCreate(d)[0].amount, 3400, 'la fiche proposait 1 000 « dinars » pour une machine payée 1 000 euros');
});

t('10.14.0 : un acompte ne s\'ajoute pas à sa facture — ni dans la marge d\'une affaire, ni dans « Acheté HT »', () => {
  const d = base0({
    suppliers: [{ id: 's', name: 'Bois du Sahel' }],
    projects: [{ id: 'aff', name: 'Chantier', clientId: '' }],
    purchases: [
      { id: 'a', kind: 'acompte', supplierId: 's', number: 'AC-1', date: '2026-02-01', projectId: 'aff', achatLie: 'f', payments: [], createdAt: 1, lines: [{ label: 'Acompte bois', qty: 1, unitPrice: 300, vatRate: 19, destination: 'charge' }] },
      { id: 'f', kind: 'facture', supplierId: 's', number: 'F-1', date: '2026-02-20', projectId: 'aff', payments: [], createdAt: 2, lines: [{ label: 'Bois', qty: 1, unitPrice: 1000, vatRate: 19, destination: 'charge' }] }]
  });
  assert.strictEqual(core.projectMargin(d, CO, 'aff').cost, 1000, 'le chantier payait deux fois l\'acompte');
  assert.strictEqual(core.supplierSummary(d, CO, 's', '2026-03-01').ht, 1000);
});

t('10.14.0 : le 31 décembre, l\'inventaire porte le stock au bilan, et 607 + 603 font le coût des sorties', () => {
  // Calculé à la main : un stock de départ de 10 à 5 (50), un achat de 20 à 6 (120), une vente de
  // 15 au coût moyen 5,667 (85,005). Au 31/12 il reste 15 pour 84,995. Le départ entre en
  // ouverture (37 / report), la variation vaut 84,995 − 50 = 34,995 (37 au débit, 603 au crédit),
  // et 607 + 603 = 120 − 34,995 = 85,005 : exactement le coût de la vente.
  const d = base0({
    clients: [{ id: 'c', name: 'Client' }], suppliers: [{ id: 's', name: 'Grossiste' }],
    catalog: [{ id: 'k', label: 'Vis', tracked: true, initialQty: 10, initialCost: 5, initialDate: '2024-06-01' }],
    purchases: [{ id: 'p', kind: 'facture', supplierId: 's', number: 'G-1', date: '2024-07-01', payments: [], createdAt: 1, lines: [{ label: 'Vis', itemId: 'k', qty: 20, unitPrice: 6, vatRate: 19, destination: 'stock' }] }],
    documents: [{ id: 'v', type: 'facture', number: 'FAC-2024-001', status: 'envoyée', date: '2024-09-01', dueDate: '2024-10-01', clientId: 'c', payments: [], createdAt: 1, lines: [{ label: 'Vis', itemId: 'k', qty: 15, unitPrice: 10, vatRate: 19 }] }]
  });
  const acc = core.chartAccounts(d);
  const E = core.journalEntries(d, CO, { from: '2024-01-01', to: '2024-12-31' });
  assert.strictEqual(soldeDe(E, acc.stocks), 84.995, 'le bilan n\'a pas le stock du 31 décembre');
  assert.strictEqual(soldeDe(E, acc.variationStocks), -34.995);
  assert.strictEqual(r3(soldeDe(E, acc.achatsStock) + soldeDe(E, acc.variationStocks)), 85.005);
  assert.strictEqual(soldeDe(E, acc.reportANouveau), -50, 'le stock de départ n\'est pas une recette de l\'année : il entre contre le report');
  const per = { from: '2024-01-01', to: '2024-12-31' };
  assert.strictEqual(core.etatsFinanciers(d, CO, '2024', per.to).resultat, core.simpleResult(d, CO, per).resultat);
  // Avant le 31 décembre, rien : c'est une écriture d'inventaire, comme la dotation.
  assert.strictEqual(core.journalEntries(d, CO, { from: '2024-01-01', to: '2024-12-31' }, { todayIso: '2024-12-31', sections: ['inventaire'] }).length, 0);
});

t('10.14.0 : une marchandise à TVA non récupérable entre au stock à son coût TTC, comme au 607', () => {
  const d = base0({
    suppliers: [{ id: 's', name: 'Grossiste' }],
    catalog: [{ id: 'k', label: 'Vis', tracked: true }],
    purchases: [{ id: 'p', kind: 'facture', supplierId: 's', number: 'G-2', date: '2026-02-01', payments: [], createdAt: 1, lines: [{ label: 'Vis', itemId: 'k', qty: 10, unitPrice: 5, vatRate: 19, deductible: false, destination: 'stock' }] }]
  });
  const E = core.journalEntries(d, CO, { from: '2026-02-01', to: '2026-02-28' }, { sections: ['achats'] });
  assert.strictEqual(soldeDe(E, core.chartAccounts(d).achatsStock), 59.5);
  assert.strictEqual(core.stockOf(d, 'k', '2026-02-28').value, 59.5);
});

t('10.14.0 : des frais bancaires payés par un mouvement comptent dans le résultat simplifié', () => {
  const d = base0({
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 1000, openingDate: '2026-01-01', isDefault: true }],
    movements: [{ id: 'm', date: '2026-02-15', kind: 'banque', amount: 30, accountId: 'b', label: 'Frais de tenue de compte' }]
  });
  const r = core.simpleResult(d, CO, { from: '2026-02-01', to: '2026-02-28' });
  assert.strictEqual(r.autres, 30);
  assert.strictEqual(r.resultat, -30, 'le « résultat avant impôt » ignorait les frais bancaires');
});

t('10.14.0 : la remise d\'une facture de solde ne s\'applique pas deux fois, et l\'acompte compte dans les marges', () => {
  // Calculé à la main : un acompte de 300 facturé en janvier ; en mars la facture de solde porte une
  // prestation de 1 000 remisée à 10 % et la déduction de l'acompte (300, sans remise). Net HT du
  // solde : 1 000 − 100 − 300 = 600. Chiffre d'affaires des deux factures : 900, et la prestation
  // s'est vendue 900 (1 000 moins la remise) — pas 857,1 (600 ÷ 700 appliqué aux 1 000).
  const doc = (id, date, lines, extra) => ({ id, type: 'facture', number: 'FAC-2026-' + id, status: 'envoyée', date, dueDate: date, clientId: 'c', payments: [], createdAt: 1, lines, ...extra });
  const d = base0({ clients: [{ id: 'c', name: 'Hôtel' }], documents: [
    doc('001', '2026-01-10', [{ label: 'Acompte de 30 % sur le devis', qty: 1, unitPrice: 300, vatRate: 19, noDiscount: true }]),
    doc('002', '2026-03-10', [{ label: 'Rénovation', qty: 1, unitPrice: 1000, vatRate: 19 }, { label: 'Acompte déjà facturé', qty: 1, unitPrice: -300, vatRate: 19, noDiscount: true }], { discountRate: 10 })] });
  const somme = (from, to, dim) => r3(core.marginBy(d, CO, from, to, dim, 0).reduce((s, r) => s + r.revenue, 0));
  assert.strictEqual(core.documentMargin(d.documents[1], d, CO).revenue, 900, 'la remise était appliquée une seconde fois sur la facture de solde');
  assert.strictEqual(somme('2026-01-01', '2026-03-31', 'client'), 900);
  assert.strictEqual(somme('2026-01-01', '2026-03-31', 'item'), 900);
  assert.strictEqual(somme('2026-01-01', '2026-01-31', 'client'), 300, 'l\'acompte de janvier n\'était dans aucune marge');
  const janvier = core.marginBy(d, CO, '2026-01-01', '2026-01-31', 'item', 0);
  assert.deepStrictEqual(janvier.map(r => [r.label, r.revenue, r.rate, r.complete]), [['Acomptes facturés (repris au solde)', 300, null, true]]);
  // Sur la période entière, l'acompte et sa reprise s'annulent : aucune ligne à zéro.
  assert.ok(!core.marginBy(d, CO, '2026-01-01', '2026-03-31', 'item', 0).some(r => r.acomptes));
});

t('10.14.0 : février s\'amortit comme les autres mois, et la Comptabilité arrête un mois à son vrai dernier jour', () => {
  // Calculé à la main : 3 600 DT sur cinq ans, mis en service le 1er janvier 2025 = 720 par an,
  // 60 par mois en base 360. Lu au 28 février, février en donnait 56 et mars 64 ; lu au
  // « 31 février » (l'écran), février en donnait 60 et mars 64 — deux jours comptés deux fois.
  const d = base0({ assets: [{ id: 'a', label: 'Machine', date: '2025-01-01', amount: 3600, years: 5, residual: 0, classId: 'materiel' }] });
  const mois = m => core.simpleResult(d, CO, core.packPeriod(2025, m)).depreciation;
  assert.strictEqual(mois(1), 60);
  assert.strictEqual(mois(2), 60, 'février ne compte que vingt-huit jours d\'amortissement');
  assert.strictEqual(mois(3), 60, 'mars rattrape les jours que février n\'a pas comptés');
  assert.strictEqual(r3([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].reduce((s, m) => s + mois(m), 0)), 720);
  // L'écran : sa période d'un mois se lit sur le vrai calendrier (la jouer, pas la relire).
  const app = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'renderer', 'app.js'), 'utf8');
  const debut = app.indexOf('const period = () => comptaState.month');
  const src = app.slice(debut, app.indexOf(';\n', debut) + 1);
  assert.ok(debut > 0 && src.length < 400, 'tranche de la période de la Comptabilité introuvable');
  const vm = require('vm');
  // Rendu dans un autre contexte : l'objet se relit en JSON, sinon son prototype diffère.
  const jouer = (year, month) => JSON.parse(JSON.stringify(vm.runInNewContext(`${src} period()`, { comptaState: { year, month }, C: core })));
  assert.deepStrictEqual(jouer('2025', '09'), { from: '2025-09-01', to: '2025-09-30' }, 'les états étaient « arrêtés au 31/09/2025 »');
  assert.deepStrictEqual(jouer('2024', '02'), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepStrictEqual(jouer('2025', ''), { from: '2025-01-01', to: '2025-12-31' });
});

t('10.14.0 : un mois qui a changé depuis son paquet le DIT — et le vert passe sur « Refaire le paquet »', () => {
  // Un achat de 180 HT au 606, envoyé au comptable ; puis on corrige : la TVA n'était pas
  // récupérable. Le 606 passe de 180 à 214,2, le 4366 de 34,2 à 0 : deux comptes ont bougé,
  // calculés à la main, et rien d'autre.
  const achat = deductible => base0({ suppliers: [{ id: 's', name: 'Traiteur' }], purchases: [{ id: 'p', kind: 'facture', supplierId: 's', number: 'T-1', date: '2026-02-10', payments: [], createdAt: 1,
    lines: [{ label: 'Réception', qty: 1, unitPrice: 180, vatRate: 19, deductible, destination: 'charge' }] }] });
  const per = core.packPeriod(2026, 2);
  const avant = core.packPlan(achat(true), CO, per, {}).sceau;
  const apres = core.packPlan(achat(false), CO, per, {}).sceau;
  const acc = core.chartAccounts(achat(true));
  assert.deepStrictEqual(core.ecartsSceau(avant, avant), [], 'un mois inchangé se dit changé');
  const ch = core.ecartsSceau(avant, apres);
  assert.deepStrictEqual(ch.map(x => x.account), [acc.charges, acc.tvaDeductible].sort());
  assert.deepStrictEqual(ch.find(x => x.account === acc.charges), { account: acc.charges, avant: [180, 0], maintenant: [214.2, 0] });
  // Un compte dont seul le CRÉDIT bouge (le fournisseur, sur un avoir) se dit aussi : les données
  // ci-dessus ne changent que des débits, elles ne pouvaient pas le voir.
  assert.deepStrictEqual(core.ecartsSceau({ 401: [0, 100] }, { 401: [0, 120] }).map(x => x.account), ['401'], 'un crédit qui bouge ne se voit pas');
  assert.deepStrictEqual(core.ecartsSceau({ 401: [0, 100] }, {}).map(x => x.account), ['401'], 'un compte qui disparaît ne se voit pas');
  // L'écran : l'étape suivante se JOUE, avec un paquet dont le sceau est l'ancien.
  const app = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'renderer', 'app.js'), 'utf8');
  const debut = app.indexOf('const change = sent.length');
  const fin = app.indexOf(";\n", app.indexOf('const suivante = ', debut)) + 1;
  const src = app.slice(debut, fin);
  assert.ok(debut > 0 && src.length < 400 && !src.includes('innerHTML'), 'tranche de l\'étape suivante du paquet introuvable');
  const jouer = sceau => require('vm').runInNewContext(`${src} suivante`, { sent: [{ at: 1, sceau }], plan: { sceau: apres }, C: core, moisVide: false, enAttente: [], nonParties: [] });
  assert.strictEqual(jouer(avant), 'refaire', 'le paquet envoyé ne dit plus les écritures du mois, et l\'écran propose de l\'envoyer');
  assert.strictEqual(jouer(apres), 'envoyer');
  assert.strictEqual(jouer(undefined), 'envoyer', 'un paquet d\'avant la 10.14.0 n\'a pas de sceau : on ne peut rien en dire');
  // Le compte de fichiers annoncé est celui que le processus principal écrit : les fichiers du
  // plan, plus ceux qu'il ajoute lui-même, NOMMÉS dans sa source (« 16 » annoncés, 17 écrits).
  const main = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'main.js'), 'utf8');
  const build = main.slice(main.indexOf("ipcMain.handle('pack:build'"), main.indexOf('const zip = zipBuffer(files', main.indexOf("ipcMain.handle('pack:build'")));
  const ajoutes = [...build.matchAll(/files\.(?:push|unshift)\(\{ name: '([^']+)'/g)].map(m => m[1]);
  assert.deepStrictEqual(ajoutes.sort(), ['00-page-de-garde.pdf', 'manifeste.json', 'signature.json'], 'le paquet gagne un fichier : l\'annonce doit le compter');
  assert.ok(new RegExp(`plan\\.entries\\.length \\+ ${ajoutes.length}, 'fichier'`).test(app), 'l\'écran n\'annonce pas le nombre de fichiers que le paquet contient');
  // Le paquet fabriqué emporte son sceau.
  assert.ok(/sceau: plan\.sceau/.test(app.slice(app.indexOf('data.packs = (data.packs || []).concat'), app.indexOf('save(true)', app.indexOf('data.packs = (data.packs || []).concat')))), 'le paquet fabriqué ne garde pas le résumé de ses écritures');
});

// Le numéro d'une pièce au Cabinet est celui du client, et il ne bouge pas quand on la cherche :
// INVENTAIRE-2025 était « n° 272 » chez le client, « 41 » dans le journal du Cabinet et « 1 » dès
// qu'on le cherchait. On JOUE la tranche de l'écran (vm), sur le paquet de décembre de l'exemple,
// avec les numéros du client puis sans (un vieux paquet) : dans les deux cas, chercher ne renumérote pas.
t('10.14.0 : le Cabinet montre le numéro de pièce du client, et une recherche ne le change pas', () => {
  const fs = require('fs'), path = require('path');
  const KC = require('../../src/renderer/compta.js');
  const cab = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'cabinet', 'renderer', 'app.js'), 'utf8');
  const debut = cab.indexOf('const duJournal = lignes.filter');
  const fin = cab.indexOf('\n', cab.indexOf('lj.pieces.forEach(p => {', debut)) + 1;
  const src = cab.slice(debut, fin);
  assert.ok(debut > 0 && src.length < 2000 && !src.includes('innerHTML'), 'tranche du livre-journal du Cabinet introuvable');
  const commis = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'cabinet', 'exemple-paquets.json'), 'utf8'));
  const dec = commis.mois.find(m => m.mois.endsWith('-12'));
  const lignes = KC.entreesDepuisCsv(dec.fichiers.find(f => f.chemin === 'journaux/ecritures.csv').texte);
  const inv = lignes.find(l => /^INVENTAIRE-/.test(l.piece));
  assert.ok(inv && inv.numero > 1, 'le paquet de décembre de l\'exemple doit porter l\'inventaire et son numéro');
  const jouer = (ls, q) => require('vm').runInNewContext(`${src} lj`, { lignes: ls, s: { journal: '' }, q, KC });
  const numeroDe = (lj, piece) => (lj.pieces.find(p => p.piece === piece) || {}).numero;
  // Avec les numéros du client : ce sont les siens, cherchés ou non.
  assert.strictEqual(numeroDe(jouer(lignes, ''), inv.piece), inv.numero, 'le journal du Cabinet n\'affiche pas le numéro du client');
  assert.strictEqual(numeroDe(jouer(lignes, 'inventaire'), inv.piece), inv.numero, 'chercher la pièce change son numéro');
  // Sans numéro (paquet d'avant la 10.12.0) : recompté sur la période, et la recherche garde ce compte.
  const vieux = lignes.map(l => ({ ...l, numero: 0 }));
  const n = numeroDe(jouer(vieux, ''), inv.piece);
  assert.ok(n > 1, 'l\'inventaire du 31 décembre n\'est pas la première pièce du mois');
  assert.strictEqual(numeroDe(jouer(vieux, 'inventaire'), inv.piece), n, 'la recherche renumérote un vieux paquet');
});
// Un salaire payé par un mouvement, sans bulletin, est une CHARGE (10.14.0). Il était écrit « 425 au
// débit » — le règlement d'un bulletin qui n'existe pas : le salaire n'entrait dans aucune charge, le
// résultat de l'onglet TVA, les états et le paquet du comptable le montraient trop beau, et le 425
// restait débiteur pour toujours. Avec un bulletin ce mois-là ou le précédent, le mouvement règle le 425.
t('10.14.0 : un salaire payé par un mouvement sans bulletin est une charge (640), avec un bulletin il règle le 425', () => {
  const avec = slips => base0({
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 0, openingDate: '2026-01-01', isDefault: true }],
    employees: slips.length ? [{ id: 'e', name: 'Salma', hireDate: '2025-01-01', grossSalary: 1000 }] : [],
    payslips: slips.map(([y, m]) => ({ id: `s${y}${m}`, employeeId: 'e', year: y, month: m, deductions: [], paidDate: '',
      computed: { gross: 1000, net: 900, otherDeductions: 0, cnssEmployee: 0, cnssEmployer: 0, accident: 0, irpp: 100, css: 0 } })),
    movements: [{ id: 'm', date: '2026-03-25', kind: 'salaire', amount: 900, accountId: 'b' }]
  });
  const mars = { from: '2026-03-01', to: '2026-03-31' };
  const compte = d => core.journalEntries(d, CO, mars, { sections: ['tresorerie'] }).find(e => e.debit > 0).account;
  const acc = core.chartAccounts(avec([]));
  assert.strictEqual(compte(avec([])), acc.salairesBruts, 'sans bulletin, le salaire n\'entre dans aucune charge');
  assert.strictEqual(core.simpleResult(avec([]), CO, mars).resultat, -900, 'le résultat oublie le salaire payé');
  assert.strictEqual(compte(avec([[2026, 3]])), acc.personnel, 'avec le bulletin du mois, le mouvement le règle');
  assert.strictEqual(compte(avec([[2026, 2]])), acc.personnel, 'le salaire de février se paie souvent en mars');
  assert.strictEqual(compte(avec([[2026, 1]])), acc.salairesBruts, 'un bulletin de janvier ne fait pas d\'un paiement de mars un règlement');
  // Et un mouvement qui porte sa contrepartie la garde.
  const d = avec([]); d.movements[0].compte = '4531';
  assert.strictEqual(compte(d), '4531');
});

// Le seuil de rentabilité et son « Résultat » (10.14.0). Calculé à la main : ventes 10 000 HT ;
// loyer 1 200 (fixe) ; marchandises 4 000 (variable) ; salaire payé sans bulletin 1 850, intérêts
// 120 au 651 et frais bancaires 30 (fixes) ; une échéance d'emprunt de 1 000 (capital : PAS une
// charge) ; la camionnette de 30 000 sur cinq ans, cédée le 30 juin 2026 pour 16 000 — six mois de
// dotation (3 000, fixe) et une plus-value de 1 000 (16 000 − 15 000 de VNC), qui ne se répète pas.
// Fixes : 1 200 + 3 000 + 1 850 + 120 + 30 = 6 200. Résultat : 10 000 − 4 000 − 6 200 + 1 000 = 800.
// Avant : l'échéance entière en charge fixe, rien des intérêts ni de la cession — « Perte 1 080 ».
t('10.14.0 : le seuil de rentabilité dit le résultat de l\'onglet TVA — une échéance d\'emprunt n\'est pas une charge', () => {
  const d = base0({
    clients: [{ id: 'c', name: 'Client' }], suppliers: [{ id: 's', name: 'Fournisseur' }],
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 0, openingDate: '2026-01-01', isDefault: true }],
    documents: [{ id: 'v', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', date: '2026-03-01', dueDate: '2026-03-31', clientId: 'c', payments: [], createdAt: 1,
      lines: [{ label: 'Prestation', qty: 1, unitPrice: 10000, vatRate: 19 }] }],
    purchases: [
      { id: 'l', kind: 'facture', supplierId: 's', number: 'L1', date: '2026-03-01', category: 'Loyer et charges locatives', payments: [], createdAt: 1, lines: [{ label: 'Loyer', qty: 1, unitPrice: 1200, vatRate: 19, destination: 'charge' }] },
      { id: 'm', kind: 'facture', supplierId: 's', number: 'M1', date: '2026-03-02', category: 'Achats de marchandises', payments: [], createdAt: 1, lines: [{ label: 'Bois', qty: 1, unitPrice: 4000, vatRate: 19, destination: 'charge' }] }],
    assets: [{ id: 'a', label: 'Camionnette', amount: 30000, residual: 0, years: 5, date: '2024-01-01', category: 'transport', disposal: { date: '2026-06-30', amount: 16000, reason: 'Revendue' } }],
    movements: [
      { id: 'sal', date: '2026-03-25', kind: 'salaire', amount: 1850, accountId: 'b' },
      { id: 'int', date: '2026-04-10', kind: 'autre-sortie', amount: 120, accountId: 'b', compte: '651', label: 'Intérêts' },
      { id: 'fb', date: '2026-04-30', kind: 'banque', amount: 30, accountId: 'b' },
      { id: 'emp', date: '2026-04-10', kind: 'emprunt', amount: 1000, accountId: 'b' },
      { id: 'ces', date: '2026-06-30', kind: 'autre-entree', amount: 16000, accountId: 'b', compte: '775', label: 'Vente camionnette' }]
  });
  const per = { from: '2026-01-01', to: '2026-12-31' };
  const b = core.breakEven(d, CO, per);
  assert.strictEqual(b.revenue, 10000);
  assert.strictEqual(b.variable, 4000);
  assert.strictEqual(b.fixed, 6200, 'les charges fixes comptent le capital d\'un emprunt, ou oublient les intérêts, le salaire ou la dotation');
  assert.strictEqual(b.exceptionnel, -1000, 'la plus-value de cession');
  assert.strictEqual(b.result, 800);
  assert.strictEqual(core.simpleResult(d, CO, per).resultat, 800, 'deux résultats pour la même année');
  assert.strictEqual(b.breakEven, r3(6200 / 0.6), 'la cession déplace le seuil');
});
};
