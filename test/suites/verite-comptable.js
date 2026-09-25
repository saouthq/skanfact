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
    // Les immobilisations d'un exercice terminé sont celles du tableau.
    if (per.to === `${y}-12-31` && per.to < T) {
      const at = core.assetTotals(data, +y);
      ecart(`${y} immobilisations (22)`, solde(bg, acc.immobilisations), at.grossActif);
      ecart(`${y} amortissements (28)`, -solde(bg, acc.amortissements), at.cumulActif);
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
};
