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
function ecarts(data, opts) {
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
    const chaine = core.vatChain(data, co, y, 12);
    for (let m = 1; m <= 12; m++) {
      const mm = `${y}-${String(m).padStart(2, '0')}`;
      if (mm > T.slice(0, 7)) break;
      const pm = { from: `${mm}-01`, to: `${mm}-${new Date(Date.UTC(+y, m, 0)).getUTCDate()}` };
      // Le crédit de TVA que la déclaration reporte est celui que le 4366 porte à la fin du mois — y
      // compris d'une année sur l'autre (10.14.0) : le crédit de décembre se perdait en janvier.
      if (pm.to < T) ecart(`${mm} crédit de TVA : 4366 / déclaration`, solde(core.balanceGenerale(data, co, { from: `${y}-01-01`, to: pm.to }), acc.tvaDeductible), chaine[m - 1].carryOut);
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
      // Le « top » des Statistiques, pris en entier, fait aussi le chiffre d'affaires : il comptait les
      // prestations avant la remise globale de leur facture (10.14.0).
      ecart(`${mm} top des prestations / statistiques`, core.topItems(data, co, pm.from, pm.to, 1e9).reduce((s, r) => s + r.ht, 0), st);
      ecart(`${mm} top des clients / statistiques`, core.topClients(data, co, pm.from, pm.to, 1e9).reduce((s, r) => s + r.ht, 0), st);
    }
    // Le paquet du comptable annonce, mois par mois, ce que dit la CHAÎNE des déclarations :
    // un mois isolé ignore le crédit reporté (3.1.0), et le paquet de mars disait 286,729 DT à
    // décaisser là où la chaîne dit 52,079.
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
    // La retenue naît au RÈGLEMENT (10.14.0) : c'est la section des règlements qui la crédite.
    ecart(`${y} retenue opérée (4352) / déclaration d'employeur`, r3(core.journalEntries(data, co, per, { sections: ['achats', 'reglements'] })
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
  // Les restes des factures, moins les avoirs LIBRES (une somme due au client, 10.14.0), plus la
  // retenue que les clients garderont encore pour l'État en payant : le 411 porte le BRUT jusqu'à
  // l'encaissement (10.14.0), la retenue subie naît au règlement.
  ecart('restes des factures − avoirs libres + retenues à subir / lettrage clients', (data.documents || [])
    .filter(d => d.type === 'facture' && d.number && d.status !== 'brouillon')
    .reduce((s, d) => s + core.toBase(d, core.invoiceBalance(d, data, co).remaining, co), 0)
    - (data.documents || []).filter(d => d.type === 'avoir' && !d.creditOf && d.number && d.status !== 'brouillon' && d.status !== 'annulée')
      .reduce((s, d) => s + core.toBase(d, core.computeTotals(d, co).netToPay, co), 0)
    + (data.documents || []).reduce((s, d) => s + core.retenueASubir(d, data, co), 0), lc.reste);
  // Le 425 : les nets des bulletins pas encore réglés, moins ce qui reste à rembourser des avances.
  const netsDus = (data.payslips || []).filter(s => !s.paidDate || s.paidDate > T).reduce((s, sl) => s + ((sl.computed || {}).net || 0), 0);
  const avances = (data.employees || []).reduce((s, e) => s + core.advanceBalance(data, e.id), 0);
  ecart('425 / salaires dus − avances', -solde(bgT, acc.personnel), netsDus - avances);
  // La prévision de trésorerie part du disponible et projette TOUT ce qui est engagé : chaque
  // facture ouverte (l'âge des impayés), chaque achat à régler (« À payer »), chaque salaire dû. La
  // paie non versée en manquait (10.14.0) : 2 005 DT absents du « Solde projeté à 30 jours ».
  const fc = core.cashForecast(data, co, 3650, T);
  const somme = k => fc.events.filter(e => e.kind === k).reduce((s, e) => s + e.amount, 0);
  ecart('prévision : départ / disponible', fc.start, core.cashPosition(data, co, T).total);
  ecart('prévision : factures / âge des impayés', somme('client'), core.agedReceivables(data, co, T).total);
  ecart('prévision : achats / à payer', -somme('fournisseur'), core.payablesList(data, co, T).reduce((s, p) => s + p.remaining, 0));
  ecart('prévision : salaires / nets dus', -somme('salaire') - fc.events.filter(e => e.kind === 'saisi' && e.source === 'paie').reduce((s, e) => s + e.amount, 0), netsDus);
  ecart('âge des impayés / restes des factures', core.agedReceivables(data, co, T).total, (data.documents || [])
    .filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée')
    .reduce((s, d) => s + Math.max(0, core.toBase(d, core.invoiceBalance(d, data, co).remaining, co)), 0));
  // Chaque client : sa fiche, son relevé et son compte auxiliaire disent le même solde ; chaque
  // fournisseur : son compte auxiliaire et le reste de ses pièces.
  const perT = { from: `${T.slice(0, 4)}-01-01`, to: T };
  const bac = core.balanceAuxiliaire(data, co, perT, 'clients'), baf = core.balanceAuxiliaire(data, co, perT, 'fournisseurs');
  (data.clients || []).forEach(c => {
    const aux = (bac.rows.find(r => r.tiersId === c.id) || { solde: 0 }).solde;
    // Le relevé dit ce que le client VERSERA ; son compte porte en plus la retenue qu'il gardera pour
    // l'État en payant (10.14.0). Les deux se disent à part, et leur somme est le compte.
    const rel = core.releveClient(data, c.id, co, { date: T }), fic = core.clientSummary(data, co, c.id);
    ecart(`client ${c.name} : compte / relevé + retenue à subir`, aux, r3(rel.total + rel.rsASubir));
    ecart(`client ${c.name} : fiche / relevé`, fic.net, rel.total);
    ecart(`client ${c.name} : fiche / compte`, r3(fic.net + fic.rsASubir), aux);
  });
  (data.suppliers || []).forEach(f => {
    const aux = -(baf.rows.find(r => r.tiersId === f.id) || { solde: 0 }).solde;
    // Le compte porte le BRUT (10.14.0) : ce qu'on versera au fournisseur, plus la retenue que les
    // règlements à venir garderont pour l'État.
    ecart(`fournisseur ${f.name} : compte / pièces`, aux, (data.purchases || []).filter(p => p.supplierId === f.id)
      .reduce((s, p) => s + core.toBase(p, core.purchaseBalance(p, co, data).remaining, co) + core.retenueAOperer(p, co, data), 0));
    // Sa fiche dit le même montant que son compte : le net à verser et la retenue à opérer, côte à
    // côte (10.14.0) ; un trop-payé est un crédit, comme un avoir libre.
    const fiche = core.supplierSummary(data, co, f.id, T);
    ecart(`fournisseur ${f.name} : fiche / compte`, r3(fiche.remaining + fiche.rsAOperer), aux);
  });
  // Le graphique de l'accueil, mois par mois sur cinq ans : le facturé est le chiffre d'affaires, et
  // l'encaissé ce que la Trésorerie voit entrer des clients (remboursements d'un trop-perçu déduits).
  core.monthlySeries(data, co, T, 60).forEach(x => {
    const y = +x.month.slice(0, 4), m = +x.month.slice(5, 7);
    const pm = { from: `${x.month}-01`, to: `${x.month}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}` };
    ecart(`${x.month} accueil : facturé / chiffre d'affaires`, x.invoiced, core.salesTotals(data, co, pm.from, pm.to).ht);
    ecart(`${x.month} accueil : encaissé / Trésorerie`, x.collected, core.cashMovements(data, co, pm, null).filter(v => v.source === 'vente').reduce((s, v) => s + v.amount, 0));
  });
  // Chaque affaire : son chiffre d'affaires est celui de ses écritures, son encaissé et son payé ceux
  // de la Trésorerie.
  const tout = { from: '2000-01-01', to: '2999-12-31' };
  const mvTout = core.cashMovements(data, co, tout, null);
  const ventes = core.journalEntries(data, co, { from: '2000-01-01', to: T }, { sections: ['ventes'] });
  (data.projects || []).forEach(p => {
    const pm = core.projectMargin(data, co, p.id), ids = new Set(pm.sales.map(d => d.id)), achats = new Set(pm.buys.map(b => b.id));
    ecart(`affaire ${p.name} : CA / écritures`, pm.revenue, -ventes.filter(e => ids.has(e.docId) && e.account.startsWith('70')).reduce((s, e) => s + e.debit - e.credit, 0));
    ecart(`affaire ${p.name} : encaissé / Trésorerie`, pm.collected, mvTout.filter(v => v.source === 'vente' && ids.has(v.docId)).reduce((s, v) => s + v.amount, 0));
    ecart(`affaire ${p.name} : payé / Trésorerie`, pm.paid, -mvTout.filter(v => v.source === 'achat' && achats.has(v.purchaseId)).reduce((s, v) => s + v.amount, 0));
  });
  // Le stock de chaque article est la somme de ses mouvements.
  core.stockList(data, T).forEach(x => ecart(`stock ${x.label} : quantité / mouvements`, x.qty,
    core.stockMovements(data, x.itemId).filter(v => v.date <= T).reduce((s, v) => s + v.qty, 0)));
  // Et le Cabinet, qui reçoit ce client par ses paquets, doit dire la même chose.
  if (!(opts && opts.sansCabinet)) out.push(...parite(data).ecarts);
  return out;
}

// Le même client, lu par les DEUX applications (10.14.0) : chaque mois part au Cabinet par le vrai
// paquet (packPlan → entreesDepuisCsv → importerPaquet), et chaque case de la déclaration, chaque
// compte, chaque groupe des états et la liasse bâtis au Cabinet sont confrontés à l'app entreprise.
// C'est ainsi qu'a été trouvé le crédit de TVA de décembre perdu en janvier. `ecarts` l'appelle sur
// chaque jeu synthétique : un scénario ajouté à cette suite est aussi un scénario du Cabinet.
function parite(d) {
  const K = require('../../src/renderer/compta.js');
  const co = d.company, out = [];
  const ec = (quoi, a, b) => { if (Math.abs(r3((a || 0) - (b || 0))) > 0.0005) out.push(`Cabinet — ${quoi} : entreprise ${a} ≠ cabinet ${b}`); };
  const dates = [...(d.documents || []).filter(x => x.status !== 'brouillon'), ...(d.purchases || []), ...(d.movements || []), ...(d.payslips || [])].map(x => String(x.date || x.paidDate || '').slice(0, 4));
  const annees = [...new Set(dates.filter(y => /^\d{4}$/.test(y)))].sort();
  let mois = 0;
  annees.forEach(y => {
    const dernier = y === T.slice(0, 4) ? Number(T.slice(5, 7)) - 1 : 12;
    if (dernier < 1 || y > T.slice(0, 4)) return;
    const livre = K.livreVide('MF:X', Number(y));
    for (let m = 1; m <= dernier; m++) {
      const per = core.packPeriod(Number(y), m);
      const f = core.packPlan(d, co, per, {}).entries.find(x => x.path === 'journaux/ecritures.csv');
      const r = K.importerPaquet(livre, per.from.slice(0, 7), K.piecesDepuisLignes(K.entreesDepuisCsv(f.text)), true, 'test', 1000 + m);
      if (r.nonValidees.length) out.push(`Cabinet — ${y}-${m} : ${r.nonValidees.length} pièce(s) non validée(s) : ${JSON.stringify(r.nonValidees).slice(0, 200)}`);
    }
    core.vatChain(d, co, y, dernier).forEach(v => {
      const dm = K.declarationMensuelle(livre, v.month, {});
      const c = dm.cases;
      mois++;
      // 10.14.0 — la déclaration que le client a passée couvre le mois : le Cabinet ne doit jamais y
      // proposer un complément (il écrirait une TVA de plus) ni la dire incomplète.
      if (dm.ecritureExistante && dm.complement.length) out.push(`Cabinet — ${v.month} : un complément de déclaration proposé sur un mois que le client a déclaré en entier (${JSON.stringify(dm.complement)})`);
      dm.controles.filter(x => !x.ok && x.id !== 'attente' && x.id !== 'brouillard').forEach(x => out.push(`Cabinet — ${v.month} : contrôle « ${x.id} » en échec sur un mois tenu par le client : ${x.detail}`));
      ec(v.month + ' TVA collectée', v.collected, c.tvaCollectee.montant);
      ec(v.month + ' TVA déductible', v.deductible, c.tvaDeductible.montant);
      ec(v.month + ' crédit reporté', v.carryIn, c.creditReporte.montant);
      ec(v.month + ' net à payer', v.toPay, c.netAPayer.montant);
      ec(v.month + ' crédit à reporter', v.carryOut, c.creditAReporter.montant);
      ec(v.month + ' timbre', v.stamps, c.timbre.montant);
      ec(v.month + ' retenues opérées', v.withheldOnBuys, c.retenuesOperees.montant);
      ec(v.month + ' retenues subies', v.withheldBySale, c.retenuesSubies.montant);
    });
    const au = core.packPeriod(Number(y), dernier).to;
    const lignes = K.lignesDuLivre(livre, { du: `${y}-01-01`, au });
    const sol = rows => Object.fromEntries(rows.filter(x => Math.abs(x.solde) > 0.0005).map(x => [x.account, r3(x.solde)]));
    const a = sol(core.balanceGenerale(d, co, { from: `${y}-01-01`, to: au }).rows);
    const b = sol(K.balanceDepuisLignes(lignes, K.soldesDepuisOuverture(livre), () => '').rows);
    [...new Set([...Object.keys(a), ...Object.keys(b)])].forEach(k => ec(`${y} solde ${k}`, a[k], b[k]));
    const ef = core.etatsFinanciers(d, co, y, au), eg = K.etatsDepuisLignes(lignes, K.soldesDepuisOuverture(livre), {});
    ec(y + ' résultat', ef.resultat, eg.resultat);
    ef.actif.concat(ef.passif).forEach((g, i) => ec(`${y} « ${g.titre} »`, g.total, eg.actif.concat(eg.passif)[i].total));
    const li = K.liasseDepuisLignes(lignes, K.soldesDepuisOuverture(livre), {});
    if (li.orphelins.length || !li.equilibre || !li.coherent) out.push(`Cabinet — ${y} liasse : ${JSON.stringify(li.orphelins)}`);
  });
  return { ecarts: out, mois };
}

t('10.14.0 : sur cinq ans d\'exemple, chaque chiffre calculé par deux chemins est le même', () => {
  const e = ecarts(exemple(), { sansCabinet: true });   // la parité de l'exemple a son test à elle
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

t('10.14.0 : la prévision de trésorerie compte les salaires dus et ce qui est saisi pour plus tard — une fois chacun', () => {
  // Calculé à la main. Aujourd'hui : 10 juin 2026. Compte : 5 000 DT au 1er juin.
  //  - bulletin de mai, net 1 200, pas payé → sortie « aujourd'hui » (déjà dû) ;
  //  - bulletin d'avril, net 900, payé le 20 juin (daté dans le futur) → sortie le 20, une seule fois ;
  //  - loyer saisi en mouvement libre pour le 3 juillet, 700 → sortie le 3 juillet ;
  //  - facture de 1 000 HT + 19 % + 1 de timbre = 1 191, dont 191 réglés le 15 juin (futur) →
  //    le reste, 1 000, attendu à l'échéance du 30 juin, et les 191 le 15 : 1 191 en tout, pas 1 000.
  const T0 = '2026-06-10';
  const data = core.migrateData({
    company: { ...CO },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 5000, openingDate: '2026-06-01', isDefault: true }],
    employees: [{ id: 'e', name: 'Sami', gross: 1500 }],
    payslips: [
      { id: 's5', employeeId: 'e', year: 2026, month: 5, computed: { net: 1200 } },
      { id: 's4', employeeId: 'e', year: 2026, month: 4, paidDate: '2026-06-20', accountId: 'b', computed: { net: 900 } }
    ],
    movements: [{ id: 'm', date: '2026-07-03', kind: 'autre-sortie', amount: 700, accountId: 'b', label: 'Loyer' }],
    clients: [{ id: 'c', name: 'Alpha' }],
    documents: [{ id: 'f', type: 'facture', number: 'FAC-2026-001', clientId: 'c', date: '2026-06-01', dueDate: '2026-06-30', status: 'envoyée', stampDuty: true,
      lines: [{ label: 'Audit', qty: 1, unitPrice: 1000, vatRate: 19 }], payments: [{ id: 'p', date: '2026-06-15', amount: 191, accountId: 'b' }] }]
  });
  const f = core.cashForecast(data, data.company, 60, T0);
  assert.strictEqual(f.start, 5000, 'rien de daté après aujourd\'hui n\'entre dans le disponible');
  const par = k => f.events.filter(e => e.kind === k).map(e => [e.date, e.amount]);
  assert.deepStrictEqual(par('salaire'), [[T0, -1200]], 'le bulletin de mai, dû et pas payé, sort aujourd\'hui ; celui d\'avril n\'est pas compté deux fois');
  assert.deepStrictEqual(par('saisi').sort(), [['2026-06-15', 191], ['2026-06-20', -900], ['2026-07-03', -700]], 'ce qui est saisi pour plus tard sort ou entre à sa date');
  assert.deepStrictEqual(par('client'), [['2026-06-30', 1000]], 'la facture n\'attend plus que son reste');
  assert.strictEqual(f.end, 5000 - 1200 + 191 - 900 - 700 + 1000);
});
t('10.14.0 : la fiche d\'un fournisseur dit ce qu\'on lui doit NET — un trop-payé est un crédit, comme un avoir libre', () => {
  // Calculé à la main, TVA à 0 pour des montants ronds :
  //  - facture A de 1 000, payée 1 100 → on a payé 100 de trop : un crédit chez lui ;
  //  - facture B de 500, rien payé → 500 dus ;
  //  - avoir libre de 50 → un crédit de 50.
  // Dû 500, à récupérer 150, net 350 — ce que dit son compte 401. La fiche disait 450 : elle
  // comptait l'avoir libre et oubliait le trop-payé, deux crédits de même nature.
  const ligne = m => [{ label: 'Fournitures', qty: 1, unitPrice: m, vatRate: 0, destination: 'charge' }];
  const data = core.migrateData({
    company: { ...CO },
    suppliers: [{ id: 'f', name: 'Bureau Plus' }],
    purchases: [
      { id: 'a', kind: 'facture', supplierId: 'f', number: 'A-1', date: '2026-03-01', lines: ligne(1000), payments: [{ id: 'pa', date: '2026-03-10', amount: 1100 }] },
      { id: 'b', kind: 'facture', supplierId: 'f', number: 'B-1', date: '2026-04-01', lines: ligne(500), payments: [] },
      { id: 'c', kind: 'avoir', supplierId: 'f', number: 'AV-1', date: '2026-04-15', lines: ligne(50), payments: [] }
    ]
  });
  const s = core.supplierSummary(data, data.company, 'f', '2026-06-10');
  assert.strictEqual(s.due, 500, 'ce qui reste dû sur ses factures');
  assert.strictEqual(s.aRecuperer, 150, 'le trop-payé (100) et l\'avoir libre (50)');
  assert.strictEqual(s.remaining, 350, 'la fiche dit le même net que le compte du fournisseur');
  const aux = core.balanceAuxiliaire(data, data.company, { from: '2026-01-01', to: '2026-06-10' }, 'fournisseurs');
  assert.strictEqual(-(aux.rows.find(r => r.tiersId === 'f') || { solde: 0 }).solde, 350, 'le compte auxiliaire, calculé à la main');
});
t('10.14.0 : une colonne qui porte une classe la reçoit sur ses cellules — dans chaque liste', () => {
  // Le matricule d'un fournisseur passait sur deux lignes à 1440 px : la colonne déclarait `cls: 'mf'`
  // (la règle qui garde le matricule sur une ligne quand la place le permet), et la liste des
  // fournisseurs ne posait pas la classe sur ses cellules. Chaque dessin de `cols` la pose.
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  const nus = app.match(/cols\.map\(\(?c(?:, i)?\)? => `<td class="\$\{c\.r \? 'r nw' : ''\}">/g) || [];
  assert.deepStrictEqual(nus, [], `${nus.length} liste(s) dessinent leurs colonnes sans leur classe`);
  assert.ok((app.match(/\$\{c\.cls \? ' ' \+ c\.cls : ''\}/g) || []).length >= 8, 'la forme qui pose la classe est celle des listes');
});
t('10.14.0 : un achat d\'un mois clôturé s\'ouvre fermé, et le dit avant qu\'on tape — le jumeau de la pièce de vente', () => {
  // Vu à la souris sur l'exemple : une dépense de juillet 2025 (clôturé) s'ouvrait modifiable ; on
  // corrigeait l'objet, « Enregistrer » ouvrait la fenêtre de clôture, et la saisie était perdue.
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  const i = app.indexOf('routes.achat = (parts) => {');
  const zone = app.slice(i, app.indexOf('\n  // ---------- Autres documents', i));
  assert.ok(i > 0 && zone.length > 5000 && zone.length < 60000, `tranche inattendue (${zone.length})`);
  assert.ok(/const clos = !!stored && !!stored\.date && C\.isClosedDate\(data, stored\.date\)/.test(zone), 'l\'éditeur d\'achat ne sait pas qu\'une pièce est close');
  assert.ok(/\$\{clos \? '' : `<button class="btn \$\{isNew \? 'btn-primary' : ''\}" id="save">/.test(zone), '« Enregistrer » reste proposé sur une pièce close');
  assert.ok(/\$\{clos \? '' : '<button id="del" class="danger">/.test(zone), '« Supprimer » reste proposé sur une pièce close');
  assert.ok(/id="clos-banner"/.test(zone) && /id="buy-clos-avoir"/.test(zone), 'la pièce close ne dit pas pourquoi, ni comment la corriger');
  assert.ok(/if \(clos\) \$\$\('#b-head input:not\(\[type=hidden\]\), #b-head select, #b-head textarea, #b-notes'\)\.forEach\(el => \{ el\.disabled = true; \}\)/.test(zone), 'l\'en-tête d\'une pièce close reste modifiable');
  assert.ok(/if \(clos\) \$\$\('input, select', body\)\.forEach\(el => \{ el\.disabled = true; \}\)/.test(zone), 'les lignes d\'une pièce close restent modifiables');
  // Le règlement, lui, reste possible : il est daté d'aujourd'hui, dans un mois ouvert.
  assert.ok(/\$\{!isNew && C\.purchaseBalance\(stored, company\(\), data\)\.remaining > 0\.0005 \? '<button class="btn btn-primary" id="pay">/.test(zone), 'le règlement d\'une pièce close ne doit pas disparaître');
});
t('10.14.0 : la pièce d\'achat dit ce que coûte chaque destination — la TVA qu\'on ne récupère pas comprise', () => {
  // Calculé à la main : un plein de carburant de 139 HT à 19 %, TVA non déductible : 26,410 de TVA
  // qu'on ne récupère pas, donc une charge de 165,410 — ce que comptent le résultat et le 606.
  const p = { kind: 'depense', date: '2026-07-13', lines: [{ label: 'Carburant', qty: 1, unitPrice: 139, vatRate: 19, destination: 'charge', deductible: false }] };
  const tt = core.purchaseTotals(p, CO);
  assert.strictEqual(tt.byDestination.charge, 139, 'le HT de la destination');
  assert.strictEqual(tt.nonDeductibleParDestination.charge, 26.41, 'la TVA non récupérable, en devise de la pièce');
  assert.strictEqual(r3(tt.byDestination.charge + tt.nonDeductibleParDestination.charge), core.coutAchat(tt), 'ce que dit la pièce est ce que compte le résultat');
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  assert.ok(/\$\{lab\} \$\{C\.money\(C\.round3\(t\.byDestination\[k\] \+ \(nd\[k\] \|\| 0\)\), cur\)\}/.test(app), 'la pièce annonce le HT seul sous le nom de la destination');
  assert.ok(/const dest = p\.kind === 'acompte' \? \[\] :/.test(app), 'un acompte annonce une destination, sous la phrase qui dit qu\'il n\'en est pas une');
});
t('10.14.0 : un avoir fournisseur reprend les lignes de la pièce qu\'il corrige — sa TVA non récupérable comprise', () => {
  // Le jumeau de l'avoir de vente (`creditDraftFrom`, qui copie les lignes depuis toujours). Sans
  // ça, l'avoir sur un carburant à TVA non déductible partait d'une ligne à 19 % déductible : il
  // retirait de la TVA récupérable une TVA qu'on n'avait jamais récupérée.
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  const i = app.indexOf('routes.achat = (parts) => {');
  const zone = app.slice(i, i + 5000);
  assert.ok(/if \(p\.kind === 'avoir'\) \{\s*p\.lines = deepCopy\(vise\.lines \|\| \[\]\)/.test(zone), 'l\'avoir fournisseur ne reprend pas les lignes de sa pièce');
  assert.ok(/p\.projectId = vise\.projectId \|\| ''/.test(zone), 'l\'avoir ne reste pas dans l\'affaire de sa pièce');
  // Et ce que ça change, calculé à la main : un avoir de 139 HT sur un carburant non déductible
  // retire 0 de TVA déductible — pas 26,410.
  const av = { kind: 'avoir', date: '2026-09-25', lines: [{ label: 'Carburant', qty: 1, unitPrice: 139, vatRate: 19, destination: 'charge', deductible: false }] };
  assert.strictEqual(core.purchaseTotals(av, CO).base.deductibleVAT, 0);
});
t('10.14.0 : le fournisseur qui rend de l\'argent — l\'argent ENTRE, dans la Trésorerie comme au grand livre', () => {
  // Calculé à la main. Banque 1 000 au 1er janvier.
  //  - facture A de 1 000, payée 1 100 le 10 mars, le fournisseur rend les 100 le 20 mars
  //    (un règlement NÉGATIF sur A) ;
  //  - avoir libre de 50, que le fournisseur rembourse le 20 avril (un règlement sur l'avoir).
  // Banque : 1 000 − 1 100 + 100 + 50 = 50. Le fournisseur ne doit plus rien, on ne lui doit rien.
  // La Trésorerie sortait le remboursement de l'avoir du compte (−50) quand le journal l'y faisait
  // entrer : 950 d'un côté, 1 050 de l'autre, sur le même compte.
  const ligne = m => [{ label: 'Fournitures', qty: 1, unitPrice: m, vatRate: 0, destination: 'charge' }];
  const data = core.migrateData({
    company: { ...CO },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 1000, openingDate: '2026-01-01', isDefault: true }],
    suppliers: [{ id: 'f', name: 'Bureau Plus' }],
    purchases: [
      { id: 'a', kind: 'facture', supplierId: 'f', number: 'A-1', date: '2026-03-01', lines: ligne(1000),
        payments: [{ id: 'pa', date: '2026-03-10', amount: 1100, accountId: 'b' }, { id: 'ra', date: '2026-03-20', amount: -100, accountId: 'b' }] },
      { id: 'c', kind: 'avoir', supplierId: 'f', number: 'AV-1', date: '2026-04-15', lines: ligne(50),
        payments: [{ id: 'rc', date: '2026-04-20', amount: 50, accountId: 'b' }] }
    ]
  });
  const co = data.company;
  const mv = core.cashMovements(data, co, { from: '2026-01-01', to: '2026-12-31' }, null).map(m => [m.date, m.kind, m.amount]);
  assert.deepStrictEqual(mv.sort(), [['2026-03-10', 'decaissement', -1100], ['2026-03-20', 'encaissement', 100], ['2026-04-20', 'encaissement', 50]]);
  assert.strictEqual(core.accountBalance(data, co, 'b', '2026-12-31').balance, 50);
  assert.ok(core.estRemboursementAchat(data.purchases[0], data.purchases[0].payments[1]) && core.estRemboursementAchat(data.purchases[1], data.purchases[1].payments[0]), 'les deux gestes sont des remboursements');
  assert.ok(!core.estRemboursementAchat(data.purchases[0], data.purchases[0].payments[0]), 'un règlement ordinaire n\'en est pas un');
  assert.strictEqual(core.supplierSummary(data, co, 'f', '2026-12-31').remaining, 0, 'rien de dû, rien à récupérer');
  // Et les deux chemins de chaque chiffre disent la même chose.
  const e = ecarts(data);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : « Remboursement reçu » range le signe — positif sur un avoir, négatif sur une facture payée en trop', () => {
  // Le montant se tape en positif, comme sur le virement reçu. Rangé tel quel sur une facture, il
  // devenait un SECOND règlement : le trop-payé doublait au lieu de revenir à zéro.
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  const i = app.indexOf('function supplierPaymentForm(p, done, pay, recu)');
  const zone = app.slice(i, app.indexOf('\n  routes.achat = ', i));
  assert.ok(i > 0 && zone.length > 2000 && zone.length < 9000, `tranche inattendue (${zone.length})`);
  assert.ok(/const rend = r0 \? C\.estRemboursementAchat\(p, r0\) : !!recu;/.test(zone), 'la fenêtre ne sait pas qu\'elle reçoit un remboursement');
  const m = zone.match(/const signe = ([^;]+);/);
  assert.ok(m, 'le signe du remboursement n\'est pas posé');
  const signe = (rend, kind) => require('vm').runInNewContext(m[1], { rend, p: { kind } });
  assert.deepStrictEqual([signe(true, 'facture'), signe(true, 'avoir'), signe(false, 'facture'), signe(false, 'avoir')], [-1, 1, 1, 1]);
  assert.ok(/amount: C\.round3\(signe \* Number\(v\.amount\)\)/.test(zone), 'le montant rangé ignore le signe');
  // Le geste existe là où le crédit se lit : l'en-tête et le panneau des règlements.
  assert.ok(/remaining < -0\.0005 \? '<button class="btn btn-primary" id="recu">/.test(app), 'aucun bouton « Remboursement reçu… » sur un achat qui porte un crédit');
  assert.ok(/\$\('#recu'\)\.onclick = \(\) => supplierPaymentForm\(purchaseById\(p\.id\), \(\) => render\(\), null, true\)/.test(app), '« Remboursement reçu… » n\'ouvre pas la fenêtre du remboursement');
});
t('10.14.0 : un avoir REMBOURSÉ n\'est plus à imputer, et rattaché quand même il ne déduit que ce qui n\'a pas été rendu', () => {
  // Calculé à la main. Facture F de 1 000, avoir A de 300 que le fournisseur rembourse.
  //  - A remboursé en entier, libre : statut « remboursé », rien à rattacher, pas de ligne « À faire ».
  //  - A rattaché quand même à F : le 401 porte F 1 000 au crédit, A 300 au débit, le remboursement
  //    300 au crédit → 1 000 dû. F doit rester due de 1 000 ; la déduire de 300 la faisait passer pour
  //    réglée à 700 pendant que le compte du fournisseur disait 1 000.
  //  - Remboursement partiel de 100 : F rattachée doit 1 000 − (300 − 100) = 800, comme le 401.
  const ligne = m => [{ label: 'Fournitures', qty: 1, unitPrice: m, vatRate: 0, destination: 'charge' }];
  const faire = (rendu, lie) => core.migrateData({
    company: { ...CO },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 5000, openingDate: '2026-01-01', isDefault: true }],
    suppliers: [{ id: 'f', name: 'Bureau Plus' }],
    purchases: [
      { id: 'F', kind: 'facture', supplierId: 'f', number: 'F-1', date: '2026-03-01', lines: ligne(1000), payments: [] },
      { id: 'A', kind: 'avoir', supplierId: 'f', number: 'AV-1', date: '2026-03-05', lines: ligne(300), achatLie: lie ? 'F' : '',
        payments: rendu ? [{ id: 'r', date: '2026-03-10', amount: rendu, accountId: 'b' }] : [] }
    ]
  });
  const libre = faire(300, false), co = libre.company;
  const A = libre.purchases.find(p => p.id === 'A');
  assert.strictEqual(core.purchaseStatus(A, co, '2026-03-20', libre), 'remboursé');
  assert.ok(!core.aRattacherAchat(A, co, libre), 'un avoir remboursé n\'a plus rien à déduire');
  assert.ok(!core.todoList(libre, co, '2026-03-20').some(x => x.id === 'achat-impute'), '« À faire » ne réclame pas son rattachement');
  assert.strictEqual(core.purchaseStatus(faire(0, false).purchases[1], co, '2026-03-20', faire(0, false)), 'à imputer', 'un avoir non remboursé reste à imputer');
  assert.ok(core.aRattacherAchat(faire(100, false).purchases[1], co, faire(100, false)), 'un avoir remboursé en partie porte encore un crédit');
  const lieTout = faire(300, true), liePart = faire(100, true);
  assert.strictEqual(core.purchaseBalance(lieTout.purchases[0], co, lieTout).remaining, 1000);
  assert.strictEqual(core.purchaseBalance(liePart.purchases[0], co, liePart).remaining, 800);
  [libre, lieTout, liePart].forEach(d => { const e = ecarts(d); assert.deepStrictEqual(e, [], e.join('\n')); });
});
t('10.14.0 : le lettrage des clients compte ce qu\'on leur doit — un avoir libre et un trop-perçu, comme le 411', () => {
  // Calculé à la main. Client A : facture de 1 000 HT + 190 de TVA + 1 de timbre = 1 191, retenue de
  // 1,5 % sur 1 190 = 17,850 → 1 173,150 à encaisser ; 800 reçus → 373,150 à encaisser encore. Le
  // 411 porte le BRUT (10.14.0) : en versant 800, le client a gardé 17,850 × 800 / 1 173,150 =
  // 12,172 de retenue, donc le compte dit 1 191 − 800 − 12,172 = 378,828 — les 373,150 qu'il versera
  // et les 5,678 qu'il gardera encore pour l'État. Client EUR :
  // 500 € + le timbre (1 DT = 0,294 €) = 500,294 €, 200 reçus → 300,294 € × 3,4 = 1 021,000 DT.
  // Client Libre : un avoir libre de 100 HT + 19 = 119 qu'on lui doit. Le 411 : 378,828 + 1 021 − 119
  // − 30 = 1 250,828. Le lettrage disait 1 394,150 : il ignorait l'avoir libre, et tout trop-perçu — le
  // jumeau exact du défaut fournisseur corrigé en 10.2.0, jamais porté côté clients.
  const data = core.migrateData({
    company: { ...CO, regime: 'reel' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 20000, openingDate: '2025-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client A', withholdingRate: 1.5 }, { id: 'e', name: 'Client EUR' }, { id: 'l', name: 'Client Libre' }, { id: 't', name: 'Client Trop' }],
    documents: [
      { id: 'd1', type: 'facture', number: 'FAC-2025-001', status: 'envoyée', clientId: 'c', date: '2025-03-10', dueDate: '2025-04-10', withholdingRate: 1.5,
        lines: [{ label: 'Service', qty: 1, unitPrice: 1000, vatRate: 19 }], payments: [{ id: 'q', date: '2025-03-20', amount: 800, accountId: 'b' }] },
      { id: 'd3', type: 'facture', number: 'FAC-2025-002', status: 'envoyée', clientId: 'e', date: '2025-08-05', currency: 'EUR', exchangeRate: 3.4, dueDate: '2025-09-05',
        lines: [{ label: 'Service', qty: 1, unitPrice: 500, vatRate: 0 }], payments: [{ id: 'w', date: '2025-08-20', amount: 200, accountId: 'b' }] },
      { id: 'a1', type: 'avoir', number: 'AVO-2025-001', status: 'émis', clientId: 'l', date: '2025-06-10', lines: [{ label: 'Geste commercial', qty: 1, unitPrice: 100, vatRate: 19 }] },
      // Un trop-perçu : 100 + 19 + 1 = 120 dus, 150 reçus → 30 à rendre.
      { id: 'd4', type: 'facture', number: 'FAC-2025-003', status: 'envoyée', clientId: 't', date: '2025-09-01', dueDate: '2025-09-30',
        lines: [{ label: 'Service', qty: 1, unitPrice: 100, vatRate: 19 }], payments: [{ id: 'v', date: '2025-09-05', amount: 150, accountId: 'b' }] }
    ]
  });
  const l = core.lettrage(data, data.company, 'clients', '2025-12-31');
  assert.strictEqual(l.reste, r3(378.828 + 1021 - 119 - 30));
  const ouverts = Object.fromEntries(l.rows.flatMap(r => r.ouverts.map(o => [o.piece, o.reste])));
  assert.strictEqual(ouverts['AVO-2025-001'], -119, 'l\'avoir libre est une pièce ouverte, au crédit du client');
  assert.strictEqual(ouverts['FAC-2025-003'], -30, 'le trop-perçu aussi');
  const e = ecarts(data);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : un article revenu à zéro ne vaut plus rien, et le coût des sorties est celui que le bilan retranche', () => {
  // Calculé à la main. Moteur : 3 achetés à 700, 1 consommé, 4 vendus — le stock tombe à −2 (un achat
  // manque) —, puis les 2 arrivent à 750 : il n'en reste AUCUN. Les cinq moteurs achetés (2 100 +
  // 1 500 = 3 600) sont tous sortis. Vis : 3 à 1 et 7 à 1,1 = 10,700, toutes sorties. Coût des
  // sorties de l'année : 3 610,700 ; stock au 31 décembre : 0. L'article gardait 100 DT pour zéro
  // pièce (l'entrée qui comble un manque s'ajoutait à une valeur négative), et le coût des sorties
  // ne comptait que 3 510,700.
  const L = (label, itemId, qty, pu) => ({ label, itemId, qty, unit: 'u', unitPrice: pu, vatRate: 19, destination: 'stock', deductible: true });
  const F = (id, n, date, lignes) => ({ id, type: 'facture', number: n, status: 'envoyée', clientId: 'c', date, dueDate: date, lines: lignes, payments: [] });
  const data = core.migrateData({
    company: { ...CO, regime: 'reel' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 20000, openingDate: '2025-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client A' }], suppliers: [{ id: 'f', name: 'Grossiste' }],
    catalog: [{ id: 'a', label: 'Vis', unitPrice: 1, tracked: true, unit: 'u' }, { id: 'm', label: 'Moteur', unitPrice: 900, tracked: true, unit: 'u' }],
    purchases: [
      { id: 'p1', kind: 'facture', supplierId: 'f', number: 'G-1', date: '2025-01-10', lines: [L('Vis', 'a', 3, 1), L('Moteur', 'm', 3, 700)], payments: [] },
      { id: 'p2', kind: 'facture', supplierId: 'f', number: 'G-2', date: '2025-02-10', lines: [L('Vis', 'a', 7, 1.1)], payments: [] },
      { id: 'p3', kind: 'facture', supplierId: 'f', number: 'G-3', date: '2025-06-10', lines: [L('Moteur', 'm', 2, 750)], payments: [] }
    ],
    stockAdjustments: [
      { id: 's1', itemId: 'a', date: '2025-03-01', qty: -1, kind: 'casse', note: '' },
      { id: 's2', itemId: 'm', date: '2025-04-01', qty: -1, kind: 'consommation', note: '' }
    ],
    documents: [
      F('d1', 'FAC-2025-001', '2025-03-05', [{ label: 'Vis', itemId: 'a', qty: 9, unitPrice: 2, vatRate: 19 }]),
      F('d2', 'FAC-2025-002', '2025-05-05', [{ label: 'Moteur', itemId: 'm', qty: 4, unitPrice: 900, vatRate: 19 }])
    ]
  });
  const m = core.stockOf(data, 'm', '2025-12-31');
  assert.strictEqual(m.qty, 0);
  assert.strictEqual(m.value, 0, 'zéro moteur ne vaut rien');
  assert.strictEqual(core.costOfGoodsSold(data, { from: '2025-01-01', to: '2025-12-31' }), 3610.7);
  const e = ecarts(data);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : un retour de marchandise — chez le fournisseur ou d\'un client — laisse le coût des sorties égal à ce que le bilan retranche', () => {
  // Deux chemins, un chiffre : le coût des sorties que compte le résultat simplifié, et celui que les
  // états financiers déduisent du stock (achats + stock d'ouverture − stock de clôture). Un retour
  // client rentrait au coût moyen AVANT sa propre entrée mais s'affichait (et se comptait) au coût
  // moyen d'APRÈS : 0,476 DT d'écart sur ce jeu, sans qu'aucun des deux écrans ne paraisse faux.
  const L = (qty, pu) => ({ label: 'Écran 24 pouces', itemId: 'it', qty, unit: 'u', unitPrice: pu, vatRate: 19, destination: 'stock', deductible: true });
  const V = (qty) => [{ label: 'Écran 24 pouces', itemId: 'it', qty, unitPrice: 400, vatRate: 19 }];
  const data = core.migrateData({
    company: { ...CO, regime: 'reel' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 20000, openingDate: '2025-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client A' }], suppliers: [{ id: 'f', name: 'Grossiste' }],
    catalog: [{ id: 'it', label: 'Écran 24 pouces', unitPrice: 400, tracked: true, unit: 'u', initialQty: 2, initialCost: 240, initialDate: '2025-01-01' }],
    purchases: [
      { id: 'p1', kind: 'facture', supplierId: 'f', number: 'G-1', date: '2025-02-01', lines: [L(10, 250)], payments: [] },
      { id: 'p2', kind: 'avoir', supplierId: 'f', number: 'GA-1', date: '2025-04-05', achatLie: 'p1', lines: [L(2, 250)], payments: [] }
    ],
    documents: [
      { id: 'd1', type: 'facture', number: 'FAC-2025-001', status: 'envoyée', clientId: 'c', date: '2025-03-10', dueDate: '2025-04-10', lines: V(4), payments: [] },
      { id: 'a1', type: 'avoir', number: 'AVO-2025-001', status: 'émis', clientId: 'c', date: '2025-05-10', creditOf: 'd1', lines: V(1) },
      { id: 'd2', type: 'facture', number: 'FAC-2025-002', status: 'envoyée', clientId: 'c', date: '2025-07-05', dueDate: '2025-08-05', lines: V(3), payments: [] }
    ]
  });
  const e = ecarts(data);
  assert.deepStrictEqual(e, [], e.join('\n'));
  // Le coût affiché sur la ligne d'un retour est celui qui a servi à le valoriser.
  const retour = core.stockOf(data, 'it', '2025-12-31').moves.find(x => x.source === 'avoir');
  assert.strictEqual(retour.unitApplied, 248.333, 'le retour client rentre au coût moyen du moment, et le dit');
});
t('10.14.0 : l\'encaissé d\'une affaire est l\'argent reçu — un avoir diminue ce qu\'on attend, il n\'entre pas en caisse', () => {
  // Calculé à la main. Facture de 1 000 € (taux 3,4, sans TVA) : 500 € reçus = 1 700 DT ; un avoir de
  // 100 € la diminue. Sous-traitant : 500 DT payés 600, 100 rendus ; un avoir de 50 remboursé. Chiffre
  // d'affaires : 900 € × 3,4 = 3 060 ; encaissé 1 700 (l'avoir n'est pas de l'argent reçu — la fiche
  // disait 2 040) ; payé 600 − 100 − 50 = 450 ; rapporté en caisse 1 700 − 450 = 1 250.
  const L = (label, pu) => ({ label, qty: 1, unit: 'u', unitPrice: pu, vatRate: 0, destination: 'charge', deductible: true });
  const data = core.migrateData({
    company: { ...CO, regime: 'reel' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 20000, openingDate: '2025-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client EUR' }], suppliers: [{ id: 'f', name: 'Sous-traitant' }],
    projects: [{ id: 'pr', name: 'Chantier', clientId: 'c', status: 'en cours' }],
    documents: [
      { id: 'd1', type: 'facture', number: 'FAC-2025-001', status: 'envoyée', clientId: 'c', projectId: 'pr', date: '2025-03-10', dueDate: '2025-04-10', currency: 'EUR', exchangeRate: 3.4,
        lines: [{ label: 'Travaux', qty: 1, unitPrice: 1000, vatRate: 0 }], payments: [{ id: 'q', date: '2025-03-20', amount: 500, accountId: 'b' }] },
      { id: 'a1', type: 'avoir', number: 'AVO-2025-001', status: 'émis', clientId: 'c', projectId: 'pr', date: '2025-04-10', creditOf: 'd1', currency: 'EUR', exchangeRate: 3.4,
        lines: [{ label: 'Remise', qty: 1, unitPrice: 100, vatRate: 0 }] }
    ],
    purchases: [
      { id: 'p1', kind: 'facture', supplierId: 'f', projectId: 'pr', number: 'S-1', date: '2025-03-01', lines: [L('Sous-traitance', 500)],
        payments: [{ id: 'x', date: '2025-03-05', amount: 600, accountId: 'b' }, { id: 'x2', date: '2025-03-25', amount: -100, accountId: 'b' }] },
      { id: 'p2', kind: 'avoir', supplierId: 'f', projectId: 'pr', number: 'SA-1', date: '2025-04-01', lines: [L('Rabais', 50)],
        payments: [{ id: 'y', date: '2025-04-15', amount: 50, accountId: 'b' }] }
    ]
  });
  const pm = core.projectMargin(data, data.company, 'pr');
  assert.deepStrictEqual([pm.revenue, pm.collected, pm.paid, pm.cash], [3060, 1700, 450, 1250]);
  const e = ecarts(data);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : un avoir libre ne dit pas « vient en déduction de la facture . » — il dit qu\'il n\'est rattaché à rien', () => {
  // Vu à la souris : l'aperçu d'un avoir sans facture imprimait « Cet avoir vient en déduction de la
  // facture . » — une phrase à trou, sur une pièce légale envoyée au client.
  const ligne = [{ label: 'Geste commercial', qty: 1, unitPrice: 200, vatRate: 19 }];
  const libre = core.documentHtml({ type: 'avoir', number: 'AVO-2026-009', status: 'émis', date: '2026-09-25', lines: ligne }, { name: 'C' }, CO);
  assert.ok(!/déduction de la facture\s*[.—]/.test(libre), 'phrase à trou sur un avoir libre');
  assert.ok(/rattaché à aucune facture/.test(libre), 'l\'avoir libre ne dit pas ce qu\'il est');
  const lie = core.documentHtml({ type: 'avoir', number: 'AVO-2026-010', status: 'émis', date: '2026-09-25', creditOfNumber: 'FAC-2026-001', lines: ligne }, { name: 'C' }, CO);
  assert.ok(/déduction de la facture FAC-2026-001/.test(lie));
  const en = core.documentHtml({ type: 'avoir', lang: 'en', number: 'AVO-2026-011', status: 'émis', date: '2026-09-25', lines: ligne }, { name: 'C' }, CO);
  assert.ok(/not attached to any invoice/.test(en) && !/deducted from invoice\s*\./.test(en));
  // Et le rattachement défait défait le numéro imprimé, dans l'éditeur comme à l'enregistrement.
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  assert.ok(/clientCombo\.setValue\(inv\.clientId, true\); \} \} else doc\.creditOfNumber = '';/.test(app), 'détacher la facture laisse son numéro sur l\'avoir');
  assert.ok(/if \(isAv\) \{ const inv = doc\.creditOf \? docById\(doc\.creditOf\) : null; doc\.creditOfNumber = inv \? inv\.number : ''; \}/.test(app), 'l\'enregistrement garde un numéro de facture détachée');
});
t('10.14.0 : un crédit de TVA laissé en décembre se reporte sur janvier — calculé, et saisi seulement pour la première année', () => {
  // L'exemple laissait 316,160 DT de crédit en décembre 2021 : janvier 2022 réclamait 314,830 DT au
  // lieu de reporter un crédit de 1,330, et le 4366 gardait les 316,160 pour toujours — cinq ans de
  // suite, pendant que le Cabinet, qui lit le 4366, disait l'inverse pour le même mois.
  const L = (label, pu, taux) => ({ label, qty: 1, unit: 'u', unitPrice: pu, vatRate: taux, destination: 'charge', deductible: true });
  const data = core.migrateData({
    company: { ...CO, regime: 'reel' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 20000, openingDate: '2024-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client' }], suppliers: [{ id: 'f', name: 'Fournisseur' }],
    vatCarryIn: { 2024: 50, 2025: 999 },
    documents: [
      { id: 'd1', type: 'facture', number: 'FAC-2024-001', status: 'envoyée', clientId: 'c', date: '2024-12-10', dueDate: '2025-01-10', applyStamp: false, lines: [{ label: 'Travaux', qty: 1, unitPrice: 1000, vatRate: 19 }] },
      { id: 'd2', type: 'facture', number: 'FAC-2025-001', status: 'envoyée', clientId: 'c', date: '2025-01-10', dueDate: '2025-02-10', applyStamp: false, lines: [{ label: 'Travaux', qty: 1, unitPrice: 1000, vatRate: 19 }] },
      // Un brouillon oublié, daté d'avant : il ne déclare rien, il ne fait donc pas de 2023 la
      // première année connue — sinon le crédit saisi pour 2024 serait ignoré au profit de zéro.
      { id: 'd0', type: 'facture', status: 'brouillon', clientId: 'c', date: '2023-06-01', applyStamp: false, lines: [{ label: 'Essai', qty: 1, unitPrice: 10, vatRate: 19 }] }
    ],
    purchases: [{ id: 'p1', kind: 'facture', supplierId: 'f', number: 'S-1', date: '2024-12-05', lines: [L('Matériel', 2000, 19)] }]
  });
  // Calculé à la main. Décembre 2024 : collectée 190, déductible 380, report saisi de 2024 : 50 en
  // janvier — il n'a rien trouvé à imputer avant décembre, donc décembre : 190 − 380 − 50 = − 240,
  // crédit de 240. Janvier 2025 : 190 − 0 − 240 = − 50, crédit de 50 — et le 999 saisi pour 2025
  // n'est PAS repris : SkanFact connaît 2024, le report se calcule.
  const r = core.reportTvaDebut(data, data.company, '2025');
  assert.deepStrictEqual([r.montant, r.source, r.saisi], [240, 'calcule', 999]);
  assert.strictEqual(core.reportTvaDebut(data, data.company, '2024').montant, 50, 'la première année garde son report saisi');
  const jan = core.vatChain(data, data.company, '2025', 1)[0];
  assert.deepStrictEqual([jan.carryIn, jan.toPay, jan.carryOut], [240, 0, 50]);
  // Le 4366 ne porte que ce que la déclaration reporte : l'ouverture saisie de 2025 n'est plus
  // écrite en plus des à-nouveaux (elle doublerait le crédit).
  const bg = core.balanceGenerale(data, data.company, { from: '2025-01-01', to: '2025-01-31' });
  assert.strictEqual(r3(bg.rows.filter(x => x.account.startsWith('4366')).reduce((s, x) => s + x.solde, 0)), 50);
  const e = ecarts(data);
  assert.deepStrictEqual(e, [], e.join('\n'));
  // Et le compte ouvert le 1er janvier 2024 ne porte rien au 31 décembre 2023 (le brouillon de 2023
  // fait entrer cette année dans l'audit) : la Trésorerie comptait son solde de départ avant sa date.
  assert.strictEqual(core.accountBalance(data, data.company, 'b', '2023-12-31').balance, 0);
  assert.strictEqual(core.accountBalance(data, data.company, 'b', '2024-01-01').balance, 20000);
});
t('10.14.0 : les cinq ans de l\'exemple, envoyés au Cabinet par le vrai paquet, disent les mêmes chiffres des deux côtés', () => {
  // Deux applications, un seul client : la déclaration du Cabinet (qui lit le 4366) et celle de
  // l'app entreprise (qui enchaîne ses mois) doivent dire la même TVA, le même report, les mêmes
  // retenues, chaque mois ; et la balance, les états et la liasse bâtis au Cabinet depuis les
  // paquets doivent être ceux de l'entreprise, compte par compte.
  const d = core.migrateData(require('../../src/renderer/demo.js').buildDemoData(core.DEFAULT_COMPANY, T));
  assert.ok(new Set(d.documents.map(x => String(x.date || '').slice(0, 4)).filter(Boolean)).size >= 5, 'l\'exemple a maigri');
  const p = parite(d);
  assert.ok(p.mois >= 50, `seulement ${p.mois} mois comparés`);
  assert.deepStrictEqual(p.ecarts, [], p.ecarts.join('\n'));
});
t('10.14.0 : le Cabinet reconnaît la déclaration d\'un mois en crédit ou de timbre seul — et une autoliquidation reste de la TVA du mois', () => {
  // Chaque facture de l'exemple porte un timbre, donc chaque déclaration touchait le 4365 : c'est la
  // seule forme que le Cabinet reconnaissait. Un mois en crédit (4367 soldé contre 4366) ou un mois
  // de timbre seul (4368 contre 4365) passait pour de l'activité, et effaçait la case qu'il déclare.
  const K = require('../../src/renderer/compta.js');
  const l = K.livreVide('MF:T', 2025);
  const poser = (date, journal, piece, lignes) => { const e = K.ajouterEcriture(l, { date, journal, piece, libelle: piece, lignes }, 'moi', 1); K.validerEcriture(l, e.id, 'moi', 2); return e; };
  // Mars : une vente à 190 de TVA, un achat à 380 — un crédit de 190 ; la déclaration du client
  // solde 190 de collectée contre la déductible, sans rien à décaisser.
  poser('2025-03-10', 'VT', 'FAC-1', [{ compte: '411', debit: 1190 }, { compte: '706', credit: 1000 }, { compte: '4367', credit: 190 }]);
  poser('2025-03-12', 'AC', 'ACH-1', [{ compte: '607', debit: 2000 }, { compte: '4366', debit: 380 }, { compte: '401', credit: 2380 }]);
  poser('2025-03-31', 'OD', 'TVA-2025-03', [{ compte: '4367', debit: 190 }, { compte: '4366', credit: 190 }]);
  const mars = K.declarationMensuelle(l, '2025-03');
  assert.deepStrictEqual([mars.cases.tvaCollectee.montant, mars.cases.tvaDeductible.montant, mars.cases.creditAReporter.montant], [190, 380, 190]);
  assert.ok(mars.ecritureExistante, 'la déclaration du mois en crédit n\'est pas reconnue : le bouton proposerait d\'en passer une seconde');
  // Avril : une vente exonérée avec son timbre ; la déclaration ne solde que le timbre.
  poser('2025-04-08', 'VT', 'FAC-2', [{ compte: '411', debit: 501 }, { compte: '706', credit: 500 }, { compte: '4368', credit: 1 }]);
  poser('2025-04-30', 'OD', 'TVA-2025-04', [{ compte: '4368', debit: 1 }, { compte: '4365', credit: 1 }]);
  assert.strictEqual(K.declarationMensuelle(l, '2025-04').cases.timbre.montant, 1, 'le timbre d\'un mois sans TVA tombe à zéro');
  // Mai : une autoliquidation (4366 / 4367), datée de sa facture — c'est de la TVA du mois, des deux côtés.
  poser('2025-05-14', 'OD', 'AUTO-1', [{ compte: '4366', debit: 57 }, { compte: '4367', credit: 57 }]);
  // … et la facture d'un prestataire étranger, autoliquidée dans sa propre pièce, reçue le 31 : elle
  // porte la collectée ET la déductible au dernier jour, mais aussi une charge et le fournisseur.
  poser('2025-05-31', 'AC', 'ETR-1', [{ compte: '604', debit: 100 }, { compte: '4366', debit: 19 }, { compte: '401', credit: 100 }, { compte: '4367', credit: 19 }]);
  const mai = K.declarationMensuelle(l, '2025-05');
  assert.deepStrictEqual([mai.cases.tvaCollectee.montant, mai.cases.tvaDeductible.montant], [76, 76], 'une autoliquidation prise pour une déclaration');
});
t('10.14.0 : un avoir resté en dinars sur une facture en euros la diminue de sa contre-valeur, pas de 300 €', () => {
  // « Nouvel avoir » part en dinars : rattaché à une facture de 1 000 €, un avoir de 300 DT en
  // retranchait 300 € (≈ 1 005 DT). La facture annonçait 200 € de reste, le 411 l'équivalent de 410 €.
  const data = core.migrateData({
    company: { ...CO, regime: 'reel' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 20000, openingDate: '2025-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client EUR' }],
    documents: [
      { id: 'd1', type: 'facture', number: 'FAC-2025-001', status: 'envoyée', clientId: 'c', date: '2025-03-10', dueDate: '2025-04-10', currency: 'EUR', exchangeRate: 3.35, applyStamp: false,
        lines: [{ label: 'Travaux', qty: 1, unitPrice: 1000, vatRate: 0 }], payments: [{ id: 'q', date: '2025-03-20', amount: 500, accountId: 'b' }] },
      { id: 'a1', type: 'avoir', number: 'AVO-2025-001', status: 'émis', clientId: 'c', date: '2025-04-10', creditOf: 'd1', currency: 'DT',
        lines: [{ label: 'Remise', qty: 1, unitPrice: 300, vatRate: 0 }] }
    ]
  });
  // À la main : 300 DT / 3,35 = 89,552 € ; 1 000 − 89,552 − 500 = 410,448 € ; × 3,35 = 1 375,001 DT.
  const b = core.invoiceBalance(data.documents[0], data, data.company);
  assert.strictEqual(b.credited, 89.552);
  assert.strictEqual(b.remaining, 410.448);
  const e = ecarts(data);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : un avoir fournisseur resté en dinars sur un achat en euros le diminue de sa contre-valeur', () => {
  // Le jumeau côté achats (la preuve du correctif restait VERTE : aucun test ne le portait). L'éditeur
  // refuse désormais deux devises (10.2.0), mais une pièce d'avant, ou importée, peut l'être : 340 DT
  // retranchaient 340 € d'une facture de 1 000 €, et « À payer » disait 660 € au lieu de 900.
  const L = (label, pu) => ({ label, qty: 1, unit: 'u', unitPrice: pu, vatRate: 0, destination: 'charge', deductible: true });
  const data = core.migrateData({
    company: { ...CO, regime: 'reel' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 20000, openingDate: '2025-01-01', isDefault: true }],
    suppliers: [{ id: 'f', name: 'Fournisseur EUR' }],
    purchases: [
      { id: 'p1', kind: 'facture', supplierId: 'f', number: 'S-1', date: '2025-03-01', currency: 'EUR', exchangeRate: 3.4, lines: [L('Matière', 1000)] },
      { id: 'p2', kind: 'avoir', supplierId: 'f', number: 'SA-1', date: '2025-04-01', currency: 'DT', achatLie: 'p1', lines: [L('Rabais', 340)] }
    ]
  });
  // À la main : 340 DT / 3,4 = 100 € ; 1 000 − 100 = 900 € ; × 3,4 = 3 060 DT au 401.
  const b = core.purchaseBalance(data.purchases[0], data.company, data);
  assert.strictEqual(b.remaining, 900);
  const ent = core.journalEntries(data, data.company, { from: '2025-01-01', to: '2025-12-31' });
  const solde = pref => Math.round(ent.filter(x => String(x.account).startsWith(pref)).reduce((s, x) => s + (x.debit || 0) - (x.credit || 0), 0) * 1000) / 1000;
  assert.strictEqual(solde('401'), -3060);
  const e = ecarts(data);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : un avoir ou un acompte à un autre taux que sa pièce règle le tiers au taux de la pièce — l\'écart va au change', () => {
  // Facture 1 000 € à 3,35, avoir de 300 € saisi à 3,40 : le client ne doit plus rien en euros, mais
  // le 411 gardait 15 DT (300 × 0,05). Côté achats, avoir de 100 € à 3,40 sur une facture à 3,35
  // (perte de 5) et acompte de 200 € payé à 3,30 (gain de 10).
  const L = (label, pu) => ({ label, qty: 1, unit: 'u', unitPrice: pu, vatRate: 0, destination: 'charge', deductible: true });
  const data = core.migrateData({
    company: { ...CO, regime: 'reel' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 20000, openingDate: '2025-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client EUR' }], suppliers: [{ id: 'f', name: 'Fournisseur EUR' }],
    documents: [
      { id: 'd1', type: 'facture', number: 'FAC-2025-001', status: 'envoyée', clientId: 'c', date: '2025-03-10', dueDate: '2025-04-10', currency: 'EUR', exchangeRate: 3.35, applyStamp: false,
        lines: [{ label: 'Travaux', qty: 1, unitPrice: 1000, vatRate: 0 }], payments: [{ id: 'q', date: '2025-03-20', amount: 700, accountId: 'b' }] },
      { id: 'a1', type: 'avoir', number: 'AVO-2025-001', status: 'émis', clientId: 'c', date: '2025-04-10', creditOf: 'd1', currency: 'EUR', exchangeRate: 3.4,
        lines: [{ label: 'Remise', qty: 1, unitPrice: 300, vatRate: 0 }] }
    ],
    purchases: [
      { id: 'ac', kind: 'acompte', supplierId: 'f', number: 'AC-1', date: '2025-02-01', currency: 'EUR', exchangeRate: 3.3, achatLie: 'p1', lines: [L('Acompte', 200)],
        payments: [{ id: 'z', date: '2025-02-01', amount: 200, accountId: 'b' }] },
      { id: 'p1', kind: 'facture', supplierId: 'f', number: 'S-1', date: '2025-03-01', currency: 'EUR', exchangeRate: 3.35, lines: [L('Matière', 500)],
        payments: [{ id: 'x', date: '2025-03-05', amount: 200, accountId: 'b' }] },
      { id: 'p2', kind: 'avoir', supplierId: 'f', number: 'SA-1', date: '2025-04-01', currency: 'EUR', exchangeRate: 3.4, achatLie: 'p1', lines: [L('Rabais', 100)] }
    ]
  });
  const ent = core.journalEntries(data, data.company, { from: '2025-01-01', to: '2025-12-31' });
  const solde = pref => Math.round(ent.filter(x => String(x.account).startsWith(pref)).reduce((s, x) => s + (x.debit || 0) - (x.credit || 0), 0) * 1000) / 1000;
  assert.strictEqual(solde('411'), 0, 'le client ne doit plus rien : son compte non plus');
  assert.strictEqual(solde('401'), 0, 'le fournisseur est réglé : son compte aussi');
  assert.strictEqual(solde('755'), -25, 'gains de change : 15 (avoir client) + 10 (acompte)');
  assert.strictEqual(solde('655'), 5, 'perte de change : 5 (avoir fournisseur)');
  const r = core.simpleResult(data, data.company, { from: '2025-01-01', to: '2025-12-31' });
  assert.strictEqual(r.change, 20);
  const e = ecarts(data);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : chaque ligne du lettrage s\'additionne — Montant − Avoirs − Réglé = Reste, sur cinq ans', () => {
  // Un trop-perçu s'affichait « 3 685 − 3 685 = −1 005 » : l'avoir faisait la différence sans colonne.
  const d = core.migrateData(require('../../src/renderer/demo.js').buildDemoData(core.DEFAULT_COMPANY, T));
  let lignes = 0;
  ['clients', 'fournisseurs'].forEach(role => core.lettrage(d, d.company, role).rows.forEach(r => r.ouverts.forEach(o => {
    lignes++;
    assert.ok(Math.abs(r3(o.montant - o.avoirs - o.regle) - o.reste) < 0.0005, `${role} ${o.piece} : ${o.montant} − ${o.avoirs} − ${o.regle} ≠ ${o.reste}`);
  })));
  assert.ok(lignes >= 8, 'l\'exemple doit porter des lignes ouvertes des deux côtés');
  // Des données qui discriminent : l'exemple porte des avoirs et acomptes imputés, et un avoir
  // fournisseur ouvert (montant négatif).
  const tous = ['clients', 'fournisseurs'].flatMap(role => core.lettrage(d, d.company, role).rows.flatMap(r => r.ouverts));
  assert.ok(tous.some(o => o.avoirs > 0) && tous.some(o => o.montant < 0), 'l\'exemple ne porte plus ce que la colonne doit montrer');
  // Et le cas vu à la souris : facture 1 000, avoir 300 émis APRÈS le paiement complet.
  const tp = core.migrateData({
    company: { ...CO, regime: 'reel' }, clients: [{ id: 'c', name: 'Client' }],
    documents: [
      { id: 'f', type: 'facture', number: 'FAC-2025-001', status: 'envoyée', clientId: 'c', date: '2025-03-10', dueDate: '2025-04-10', applyStamp: false,
        lines: [{ label: 'Audit', qty: 1, unitPrice: 1000, vatRate: 0 }], payments: [{ id: 'q', date: '2025-03-20', amount: 1000 }] },
      { id: 'a', type: 'avoir', number: 'AVO-2025-001', status: 'émis', clientId: 'c', date: '2025-04-10', creditOf: 'f', lines: [{ label: 'Remise', qty: 1, unitPrice: 300, vatRate: 0 }] }
    ]
  });
  const ligne = core.lettrage(tp, tp.company, 'clients', '2025-12-31').rows[0].ouverts[0];
  assert.deepStrictEqual([ligne.montant, ligne.avoirs, ligne.regle, ligne.reste], [1000, 300, 1000, -300]);
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  assert.ok(/'Avoirs' : 'Avoirs et acomptes'/.test(app) && /o\.avoirs \? C\.money\(o\.avoirs\)/.test(app), 'la colonne des avoirs manque à l\'écran du lettrage');
});
t('10.14.0 : un avoir rattaché prend la devise et le taux de sa facture, et ne les laisse plus changer', () => {
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  assert.ok(/const roDevise = ro \|\| \(isAv && doc\.creditOf \?/.test(app), 'la devise d\'un avoir rattaché reste modifiable');
  assert.ok(/<select name="currency" \$\{roDevise\}>/.test(app) && /name="exchangeRate"[^>]*\$\{roDevise\}>/.test(app));
  // Dans les données ET à l'écran, à chaque changement de l'en-tête.
  assert.ok(/doc\.currency = docCur\(inv\); doc\.exchangeRate = inv\.exchangeRate \|\| '';\s*sel\.value = doc\.currency; taux\.value = doc\.exchangeRate;/.test(app), 'l\'avoir ne suit pas la devise de sa facture');
  // Un avoir enregistré avant se réaligne à l'enregistrement, sans être rangé du même geste.
  assert.ok(/docCur\(inv\) !== docCur\(doc\) \|\| String\(inv\.exchangeRate \|\| ''\) !== String\(doc\.exchangeRate \|\| ''\)\)\) \{\s*head\.onchange\(\{\}\);\s*return refus\(/.test(app));
});
t('10.14.0 : un écran du Cabinet lu au processus principal se relit quand le livre bouge — et une lecture ratée ne boucle pas', () => {
  // Trouvé en validant à la souris l'écriture de déclaration de septembre : la page gardait
  // « 1 pièce en brouillard » et « le 4367 porte encore 190 » sur un mois devenu juste, et une
  // vente saisie dans la grille n'entrait dans la TVA collectée qu'au changement de dossier. La
  // parade existait (T-24) sur trois écrans ; les trois autres ne l'avaient jamais reçue.
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../src/cabinet/renderer/app.js'), 'utf8')
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const corps = nom => {
    const i = src.search(new RegExp(`\\n  (async )?function ${nom}\\(`));
    assert.ok(i > 0, `${nom} introuvable`);
    const j = src.slice(i + 10).search(/\n  (async )?function /);
    return src.slice(i, j < 0 ? undefined : i + 10 + j);
  };
  // La règle se JOUE : l'empreinte change quand une trace s'ajoute (valider) ou une écriture (saisir).
  const m = corps('revDuLivre');
  const rev = require('vm').runInNewContext(`${m}; revDuLivre`);
  const l = { audit: [{}], ecritures: [{}] };
  const r0 = rev(l);
  l.audit.push({}); const r1 = rev(l);
  l.ecritures.push({}); const r2 = rev(l);
  assert.ok(r0 !== r1 && r1 !== r2, 'l\'empreinte du livre ne bouge pas avec lui');
  assert.strictEqual(rev(null), '0:0');
  const ecrans = [['brancherDeclaration', 'chargerDeclaration', 'vueDeclaration', 'decl'],
    ['brancherImmobilisations', 'chargerImmobilisations', 'vueImmobilisations', 'immo'],
    ['brancherInventaire', 'chargerInventaire', 'vueInventaire', 'inv'],
    ['brancherCloture', 'chargerCloture', 'vueCloture', 'cloture'],
    ['brancherLiasse', 'chargerLiasse', 'vueLiasse', 'liasse'],
    ['brancherRevision', 'chargerRevision', 'vueRevision', 'revision']];
  ecrans.forEach(([br, ch, vue, cle]) => {
    const b = corps(br);
    const tete = b.slice(0, b.indexOf(`${ch}(root, dossier); return; }`) + 40);
    assert.ok(new RegExp(`s\\.${cle}Rev !== rev`).test(tete) && /const rev = (revDuLivre\(s\.livre\)|`\$\{\(s\.livre\.audit)/.test(tete),
      `${br} ne se relit pas quand le livre bouge`);
    assert.ok(new RegExp(`if \\(s\\.${cle}\\.erreur\\) return;`).test(b), `${br} branche un écran qui n'a pas pu être lu`);
    const c = corps(ch);
    assert.ok(/catch \(e\) \{ s\.\w+ = \{ erreur: plainError\(e\)/.test(c), `${ch} remet l'écran à « vide » sur une erreur : il se redemanderait en boucle`);
    assert.ok(new RegExp(`lectureRatee\\(\\w+\\.erreur, '${cle}'\\)`).test(corps(vue)), `${vue} ne dit pas qu'il n'a pas pu être lu`);
  });
  // Le geste qui retente remet à vide CE que l'écran a lu, et redessine.
  assert.ok(/\$\$\('\[data-relire-ecran\]', el\)\.forEach\(b => \{ b\.onclick = \(\) => \{ s\[b\.dataset\.relireEcran\] = null; drawLivres\(root, dossier\); \}; \}\);/.test(corps('drawLivres')));
});
// 10.14.0 — ce que l'exemple de cinq ans ne porte pas. Mesuré sur l'exemple : aucune facture sans
// timbre, aucun mouvement « retrait », « emprunt », « prêt » ni « autre entrée », aucun mouvement de
// stock saisi à la main, aucun remboursement d'un trop-perçu, aucune mise au rebut. Un invariant qui
// ne rencontre jamais un cas ne le prouve pas (10.0.0) : ce scénario les pose TOUS sur deux
// exercices, et `ecarts` le confronte aux deux chemins de l'app entreprise ET au Cabinet, mois par
// mois, par le vrai paquet.
function scenarioComplet() {
  const d = base0({
    company: { ...CO, regime: 'reel' },
    accounts: [
      { id: 'b', name: 'Banque', kind: 'banque', opening: 5000, openingDate: '2025-01-01', isDefault: true },
      { id: 'k', name: 'Caisse', kind: 'caisse', opening: 300, openingDate: '2025-01-01' }],
    clients: [{ id: 'c1', name: 'Hôtel du Lac' }, { id: 'c2', name: 'Clinique Salama', stampExempt: true }, { id: 'c3', name: 'Société Étrangère' }],
    suppliers: [{ id: 's1', name: 'Bois du Sahel' }, { id: 's2', name: 'Machines Europe' }],
    catalog: [
      { id: 'bois', label: 'Planche de chêne', unitPrice: 40, unitCost: 20, vatRate: 19, unit: 'pièce', tracked: true, initialQty: 50, initialCost: 20, initialDate: '2025-01-01' },
      { id: 'vis', label: 'Boîte de vis', unitPrice: 3, unitCost: 0.5, vatRate: 19, unit: 'boîte', tracked: true, initialQty: 0 }],
    documents: [],
    purchases: [
      { id: 'p1', kind: 'facture', supplierId: 's1', number: 'BS-1', date: '2025-01-20', createdAt: 1, lines: [{ label: 'Planche de chêne', itemId: 'bois', qty: 30, unit: 'pièce', unitPrice: 22, vatRate: 19, destination: 'stock', deductible: true }], payments: [] },
      { id: 'p2', kind: 'facture', supplierId: 's1', number: 'LOY-4', date: '2025-04-10', createdAt: 1, withholdingRate: 10, category: 'Loyer et charges locatives', lines: [{ label: 'Loyer d\'avril', qty: 1, unitPrice: 800, vatRate: 19, destination: 'charge', deductible: true }], payments: [] },
      { id: 'p3', kind: 'facture', supplierId: 's2', number: 'ME-77', date: '2025-08-01', createdAt: 1, currency: 'EUR', exchangeRate: 3.35, lines: [{ label: 'Scie à format', qty: 1, unitPrice: 5000, vatRate: 19, destination: 'immobilisation', deductible: true }], payments: [] },
      { id: 'p4', kind: 'facture', supplierId: 's1', number: 'BS-9', date: '2026-01-15', createdAt: 1, lines: [{ label: 'Boîte de vis', itemId: 'vis', qty: 100, unit: 'boîte', unitPrice: 0.5, vatRate: 19, destination: 'stock', deductible: true }], payments: [] },
      { id: 'p5', kind: 'facture', supplierId: 's1', number: 'REP-3', date: '2026-05-20', createdAt: 1, lines: [{ label: 'Réception clients', qty: 1, unitPrice: 180, vatRate: 19, destination: 'charge', deductible: false }], payments: [] }],
    stockAdjustments: [
      { id: 'sa1', itemId: 'bois', date: '2025-06-30', qty: -2, source: 'casse', note: 'Planches fendues', createdAt: 1 },
      { id: 'sa2', itemId: 'bois', date: '2025-11-30', qty: 1, source: 'inventaire', note: 'Recompté', createdAt: 1 },
      { id: 'sa3', itemId: 'vis', date: '2026-03-10', qty: -20, source: 'consommation', note: 'Chantier', createdAt: 1 },
      { id: 'sa4', itemId: 'bois', date: '2026-05-05', qty: -1, source: 'ajustement', note: 'Erreur de saisie', createdAt: 1 }],
    assets: [
      { id: 'a1', label: 'Camionnette', category: 'transport', date: '2023-01-01', amount: 20000, residual: 0, years: 5, disposal: { date: '2026-06-30', amount: 9000, reason: 'Revendue' } },
      { id: 'a2', label: 'Ordinateur', category: 'informatique', date: '2024-03-01', amount: 3000, residual: 0, years: 3, disposal: { date: '2025-11-15', amount: 0, reason: 'Mis au rebut' } },
      { id: 'a3', label: 'Scie à format', category: 'materiel', date: '2025-08-01', amount: 16750, residual: 0, years: 5, purchaseId: 'p3' }],
    employees: [{ id: 'e', name: 'Karim Ben Ali', cnss: '112233-44', contract: 'cdi', hireDate: '2024-01-01', endDate: '', grossSalary: 1200, headOfFamily: true, children: 1 }],
    advances: [{ id: 'av', employeeId: 'e', date: '2026-02-10', amount: 600, monthly: 200, accountId: 'b', note: 'Avance' }],
    movements: [
      { id: 'm1', date: '2025-01-05', kind: 'apport', amount: 3000, accountId: 'b', label: 'Apport du gérant' },
      { id: 'm2', date: '2025-02-01', kind: 'pret', amount: 10000, accountId: 'b', label: 'Prêt BIAT' },
      { id: 'm3', date: '2025-03-20', kind: 'impot', amount: 150, accountId: 'b', label: 'Taxe municipale' },
      { id: 'm4', date: '2025-07-07', kind: 'autre-sortie', amount: 50, accountId: 'k', label: 'Divers' },
      { id: 'm5', date: '2025-12-20', kind: 'retrait', amount: 2000, accountId: 'b', label: 'Retrait du gérant' },
      { id: 'm6', date: '2026-03-10', kind: 'emprunt', amount: 500, accountId: 'b', label: 'Échéance BIAT' },
      { id: 'm7', date: '2026-06-30', kind: 'autre-entree', amount: 9000, accountId: 'b', compte: '775', label: 'Vente camionnette' },
      { id: 'm8', date: '2025-06-30', kind: 'banque', amount: 12, accountId: 'b', label: 'Frais' },
      { id: 'm9', date: '2026-04-15', kind: 'autre-entree', amount: 80, accountId: 'k', label: 'Chute vendue' },
      { id: 'm10', date: '2025-09-01', kind: 'virement', amount: 500, accountId: 'b', versAccountId: 'k', label: '' },
      { id: 'm11', date: '2026-06-10', kind: 'virement', amount: 300, accountId: 'k', versAccountId: 'b', label: 'Recette déposée' }],
    ecrituresOD: [{ id: 'od1', date: '2025-12-31', piece: 'OD-2025-001', label: 'Assurance à payer', lignes: [
      { compte: '616', label: 'Assurance', debit: 150, credit: 0 }, { compte: '408', label: 'Assurance à payer', debit: 0, credit: 150 }] }]
  });
  const co = d.company;
  const doc = o => ({ status: 'envoyée', payments: [], createdAt: 1, issuedTs: 1, ...o });
  const L = (label, qty, unitPrice, extra) => ({ label, qty, unitPrice, vatRate: 19, ...(extra || {}) });
  const q = doc({ id: 'q', type: 'devis', number: 'DEV-2025-001', status: 'accepté', clientId: 'c1', date: '2025-06-01', lines: [L('Cuisine sur mesure', 1, 10000)] });
  const fa = doc({ id: 'fa', type: 'facture', number: 'FAC-2025-004', clientId: 'c1', date: '2025-06-05', dueDate: '2025-06-05', fromQuoteId: 'q', deposit: { quoteId: 'q', percent: 30 }, lines: core.depositLines(q, 30, co) });
  d.documents.push(
    doc({ id: 'f1', type: 'facture', number: 'FAC-2025-001', clientId: 'c1', date: '2025-02-10', dueDate: '2025-03-10', lines: [L('Planche de chêne', 10, 40, { itemId: 'bois' })] }),
    doc({ id: 'f2', type: 'facture', number: 'FAC-2025-002', clientId: 'c2', date: '2025-03-15', dueDate: '2025-03-15', applyStamp: false, lines: [L('Mobilier de salle d\'attente', 1, 1000)] }),
    doc({ id: 'f3', type: 'facture', number: 'FAC-2025-003', clientId: 'c1', date: '2025-05-05', dueDate: '2025-06-05', withholdingRate: 1.5, lines: [L('Portes', 4, 1250)] }),
    q, fa,
    doc({ id: 'fs', type: 'facture', number: 'FAC-2025-005', clientId: 'c1', date: '2025-09-10', dueDate: '2025-10-10', fromQuoteId: 'q', lines: core.settlementLines(q, [fa]) }),
    doc({ id: 'f4', type: 'facture', number: 'FAC-2026-001', clientId: 'c1', date: '2026-02-01', dueDate: '2026-02-28', lines: [L('Étagère', 1, 100)] }),
    doc({ id: 'av1', type: 'avoir', number: 'AVO-2026-001', status: 'émis', clientId: 'c1', date: '2026-03-01', creditOf: 'f1', lines: [L('Planche de chêne', 2, 40, { itemId: 'bois' })] }),
    doc({ id: 'f5', type: 'facture', number: 'FAC-2026-002', clientId: 'c3', date: '2026-04-10', dueDate: '2026-05-10', currency: 'EUR', exchangeRate: 3.3, lang: 'en', lines: [L('Consulting', 1, 1000, { vatRate: 0 })] }),
    doc({ id: 'f6', type: 'facture', number: 'FAC-2026-003', clientId: 'c2', date: '2026-07-01', dueDate: '2026-07-31', applyStamp: false, lines: [L('Banque d\'accueil', 1, 2400)] }));
  const net = id => core.computeTotals(d.documents.find(x => x.id === id), co).netToPay;
  const payer = (id, date, amount, accountId) => d.documents.find(x => x.id === id).payments.push({ id: `${id}-${date}`, date, amount, accountId: accountId || 'b' });
  payer('f1', '2025-03-01', net('f1'));
  payer('f2', '2025-03-20', net('f2'), 'k');
  payer('f3', '2025-06-01', net('f3'));
  payer('fa', '2025-06-06', net('fa'));
  payer('fs', '2025-10-01', net('fs'));
  payer('f4', '2026-02-10', 150);                 // trop payé de 30
  payer('f4', '2026-02-20', -30);                 // et remboursé
  payer('f5', '2026-05-02', net('f5'));           // en euros, à 3,4 le jour du règlement (facture à 3,3)
  d.documents.find(x => x.id === 'f5').payments[0].exchangeRate = 3.4;
  const netA = id => core.purchaseTotals(d.purchases.find(x => x.id === id), co).netToPay;
  const regler = (id, date, amount, accountId) => d.purchases.find(x => x.id === id).payments.push({ id: `${id}-${date}`, date, amount, accountId: accountId || 'b' });
  regler('p1', '2025-02-01', netA('p1'));
  regler('p2', '2025-04-15', netA('p2'));
  regler('p3', '2025-08-20', netA('p3'));
  d.purchases.find(x => x.id === 'p3').payments[0].exchangeRate = 3.3;   // réglé à 3,3 (achat à 3,35)
  regler('p5', '2026-05-25', netA('p5'), 'k');
  // La paie : chaque mois de 2025 et de 2026 jusqu'à juillet, payée le 3 du mois suivant ; l'avance
  // de février 2026 se rembourse par les bulletins, par la même porte que l'application.
  const e = d.employees[0], cfg = core.payrollSettings(d);
  for (let y = 2025; y <= 2026; y++) for (let m = 1; m <= (y === 2025 ? 12 : 7); m++) {
    const input = { ...core.payslipInputFor(d, e, y, m), gross: 1200, workedDays: 26 };
    const suiv = m === 12 ? `${y + 1}-01-03` : `${y}-${String(m + 1).padStart(2, '0')}-03`;
    d.payslips.push({ id: `sl${y}${m}`, employeeId: 'e', year: y, month: m, ...input, computed: core.computePayslip(e, input, cfg),
      paidDate: y === 2026 && m === 7 ? '' : suiv, accountId: 'b', method: 'virement' });
  }
  return d;
}
t('10.14.0 : tout ce que l\'exemple ne porte pas — timbre exonéré, tous les mouvements, casse, rebut, remboursement, avance, devise, OD — dit les mêmes chiffres par deux chemins et au Cabinet', () => {
  const d = scenarioComplet();
  // Le scénario pose bien ce qu'il dit poser : un test dont les données ne discriminent pas ne
  // prouve rien (10.0.0).
  assert.strictEqual(core.computeTotals(d.documents.find(x => x.id === 'f2'), d.company).stamp, 0, 'la facture sans timbre en porte un');
  assert.ok(d.payslips.some(s => (s.deductions || []).some(x => x.advanceId === 'av')), 'aucun bulletin ne rembourse l\'avance');
  assert.strictEqual(core.invoiceBalance(d.documents.find(x => x.id === 'f4'), d, d.company).remaining, 0, 'le trop-perçu remboursé laisse la facture soldée');
  const e = ecarts(d);
  assert.deepStrictEqual(e, [], `${e.length} écart(s) :\n  ${e.slice(0, 30).join('\n  ')}`);
});
t('10.14.0 : un virement de la banque vers la caisse sort de l\'une, entre dans l\'autre — une écriture 54 / 532, aucun effet sur le résultat', () => {
  // Il n'existait aucun geste pour alimenter la caisse : « Retrait » passe au compte courant de
  // l'associé (4421) — le gérant devait l'argent, et la caisse ne recevait rien.
  const d = scenarioComplet(), co = d.company;
  const sept = { from: '2025-09-01', to: '2025-09-01' };
  const lignes = core.cashMovements(d, co, sept, null).filter(m => m.movementId === 'm10').sort((a, b) => a.amount - b.amount);
  assert.deepStrictEqual(lignes.map(m => [m.accountId, m.amount, m.label]), [['b', -500, 'Virement vers Caisse'], ['k', 500, 'Virement depuis Banque']]);
  const E = core.journalEntries(d, co, sept, { sections: ['tresorerie'] }).filter(e => e.docId === 'm10');
  assert.deepStrictEqual(E.map(e => [e.journal, e.account, e.debit, e.credit]), [['BQ', '54', 500, 0], ['BQ', '532', 0, 500]], 'la caisse au débit, la banque au crédit');
  assert.ok(E.every(e => e.label === 'Virement vers Caisse'), 'le comptable lit la nature au lieu du compte qui reçoit');
  // Le résultat de l'année et le compte de l'associé ne voient rien passer.
  const sans = scenarioComplet(); sans.movements = sans.movements.filter(m => m.kind !== 'virement');
  const an = { from: '2025-01-01', to: '2025-12-31' };
  assert.strictEqual(core.simpleResult(d, co, an).resultat, core.simpleResult(sans, co, an).resultat);
  assert.strictEqual(core.breakEven(d, co, an).result, core.breakEven(sans, co, an).result);
  const assoc = x => r3(core.journalEntries(x, co, an).filter(e => e.account === '4421').reduce((t, e) => t + e.debit - e.credit, 0));
  assert.strictEqual(assoc(d), assoc(sans), 'un virement passe au compte de l\'associé');
  // Chaque côté se pointe sur SON relevé.
  d.movements.find(m => m.id === 'm10').reconciledVers = true;
  const cote = compte => core.cashMovements(d, co, sept, compte).find(m => m.movementId === 'm10');
  const dep = cote('b'), arr = cote('k');
  assert.strictEqual(dep.reconciled, false, 'pointer la caisse a pointé la banque');
  assert.strictEqual(arr.reconciled, true);
  // Un virement dont le compte d'arrivée a disparu n'est qu'une sortie, que le comptable verra au 471.
  const orphelin = scenarioComplet(); orphelin.movements.find(m => m.id === 'm10').versAccountId = 'disparu';
  assert.deepStrictEqual(core.cashMovements(orphelin, co, sept, null).filter(m => m.movementId === 'm10').map(m => m.amount), [-500]);
  assert.deepStrictEqual(core.journalEntries(orphelin, co, sept, { sections: ['tresorerie'] }).filter(e => e.docId === 'm10').map(e => e.account), ['471', '532']);
  const e = ecarts(orphelin);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : les mouvements d\'un compte supprimé basculent sur le compte par défaut — dans la Trésorerie comme au grand livre', () => {
  // La fenêtre de suppression le promettait ; la Trésorerie gardait l'identifiant disparu, et ces
  // lignes ne tombaient plus dans aucun compte, pendant que les écritures les passaient au compte
  // par défaut : la banque de la page et celle du grand livre divergeaient.
  const d = scenarioComplet(), co = d.company;
  d.accounts.push({ id: 'b2', name: 'Seconde banque', kind: 'banque', opening: 0, openingDate: '2025-01-01' });
  d.documents.find(x => x.id === 'f3').payments.forEach(p => { p.accountId = 'b2'; });
  d.movements.push({ id: 'm12', date: '2025-10-10', kind: 'banque', amount: 7, accountId: 'b2', label: 'Frais' });
  const avant = core.cashPosition(d, co, '2026-08-31').total;
  d.accounts = d.accounts.filter(a => a.id !== 'b2');
  assert.strictEqual(core.cashPosition(d, co, '2026-08-31').total, avant, 'le disponible perd l\'argent du compte supprimé');
  const e = ecarts(d, { sansCabinet: true });
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : le formulaire d\'un mouvement propose le virement entre comptes, et l\'arrivée se pointe sur son propre drapeau', () => {
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  const f = app.slice(app.indexOf('function movementForm('), app.indexOf('routes.tresorerie = '));
  assert.ok(f.length > 2000 && f.length < 9000, 'tranche du formulaire inattendue');
  // La nature n'est proposée qu'avec deux comptes : on ne propose pas un geste qui sera refusé.
  assert.ok(/\.filter\(\(\[v\]\) => v !== 'virement' \|\| data\.accounts\.length > 1 \|\| m\.kind === 'virement'\)/.test(f));
  // Le compte qui reçoit prend la place de la contrepartie : rien ne pousse le formulaire.
  assert.ok(/id="mf-cp" \$\{m\.kind === 'virement' \? 'hidden' : ''\}/.test(f) && /id="mf-vers" \$\{m\.kind === 'virement' \? '' : 'hidden'\}/.test(f));
  assert.ok(/\$\('#mf-cp', root\)\.hidden = vir; \$\('#mf-vers', root\)\.hidden = !vir;/.test(f), 'changer de nature n\'échange pas les deux champs');
  assert.ok(/kindSel\.addEventListener\('change', accorder\);/.test(f) && /texteCompte\.data = vir \? 'Depuis le compte ' : 'Compte ';/.test(f), 'le compte d\'un virement ne dit pas qu\'il est celui du départ');
  // Un virement sans compte d'arrivée, ou vers lui-même, est refusé en montrant le champ.
  assert.ok(/if \(v\.kind === 'virement' && !v\.versAccountId\) return refus\(/.test(f));
  assert.ok(/if \(v\.kind === 'virement' && v\.versAccountId === v\.accountId\) return refus\(/.test(f));
  // Pointer l'arrivée écrit `reconciledVers`, jamais le drapeau du départ.
  const p2 = app.slice(app.indexOf('const porteur = id => {'), app.indexOf('$$(\'[data-rec]\').forEach'));
  assert.ok(/id\.endsWith\('~vers'\)/.test(p2) && /set reconciled\(x\) \{ mv\.reconciledVers = x; \}/.test(p2), 'l\'arrivée d\'un virement ne se pointe pas');
});
t('10.14.0 : un règlement en devise passe à la banque au taux du jour — le tiers se solde au taux de sa pièce, l\'écart au change', () => {
  // Calculé à la main. Facture de 1 000 € (sans TVA ni timbre) émise à 3,300 : le client doit
  // 3 300 DT. Il paie 1 000 € un mois plus tard, à 3,400 : la banque reçoit 3 400 DT — 100 DT de
  // gain de change (755). Un achat de 500 € à 3,350 (1 675 DT dus) réglé à 3,300 : 1 650 DT sortent
  // de la banque — 25 DT de gain. SkanFact convertissait le règlement au taux de la PIÈCE : la banque
  // disait 3 300 et 1 675, et le relevé ne tombait jamais juste.
  const d = base0({
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 0, openingDate: '2026-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client Europe' }], suppliers: [{ id: 's', name: 'Fournisseur Europe' }],
    documents: [{ id: 'f', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', clientId: 'c', date: '2026-03-01', dueDate: '2026-03-31',
      currency: 'EUR', exchangeRate: 3.3, applyStamp: false, createdAt: 1, lines: [{ label: 'Étude', qty: 1, unitPrice: 1000, vatRate: 0 }],
      payments: [{ id: 'pf', date: '2026-04-02', amount: 1000, accountId: 'b', exchangeRate: 3.4 }] }],
    purchases: [{ id: 'a', kind: 'facture', supplierId: 's', number: 'EU-1', date: '2026-03-05', currency: 'EUR', exchangeRate: 3.35, createdAt: 1,
      lines: [{ label: 'Licence', qty: 1, unitPrice: 500, vatRate: 0, destination: 'charge' }],
      payments: [{ id: 'pa', date: '2026-04-10', amount: 500, accountId: 'b', exchangeRate: 3.3 }] }]
  });
  const co = d.company, avril = { from: '2026-04-01', to: '2026-04-30' };
  const mv = core.cashMovements(d, co, avril, null);
  assert.deepStrictEqual(mv.map(m => [m.source, m.amount]).sort(), [['achat', -1650], ['vente', 3400]], 'la banque bouge du taux de la pièce');
  const E = core.journalEntries(d, co, avril);
  const solde = c => r3(E.filter(e => e.account === c).reduce((t, e) => t + e.debit - e.credit, 0));
  assert.strictEqual(solde('532'), 1750);
  assert.strictEqual(solde('411'), -3300, 'le client n\'est pas soldé au taux de sa facture');
  assert.strictEqual(solde('401'), 1675, 'le fournisseur n\'est pas soldé au taux de sa pièce');
  assert.strictEqual(solde('755'), -125, 'les deux gains de change');
  assert.strictEqual(solde('655'), 0);
  // Le client et le fournisseur sont soldés — ni reste, ni trop-perçu.
  assert.strictEqual(core.invoiceBalance(d.documents[0], d, co).remaining, 0);
  assert.strictEqual(core.purchaseBalance(d.purchases[0], co, d).remaining, 0);
  // Le résultat simplifié compte le gain, comme les états.
  const an = { from: '2026-01-01', to: '2026-12-31' };
  assert.strictEqual(core.simpleResult(d, co, an).resultat, r3(3300 - 1675 + 125));
  // À l'inverse : payé à un taux PLUS BAS que la facture, c'est une perte (655).
  d.documents[0].payments[0].exchangeRate = 3.2;
  assert.strictEqual(r3(core.journalEntries(d, co, avril).filter(e => e.account === '655').reduce((t, e) => t + e.debit - e.credit, 0)), 100);
  // Sans taux saisi, le règlement prend celui de la pièce : rien ne change pour ce qui existait.
  delete d.documents[0].payments[0].exchangeRate;
  assert.strictEqual(core.cashMovements(d, co, avril, null).find(m => m.source === 'vente').amount, 3300);
  const e = ecarts(d);
  assert.deepStrictEqual(e, [], e.join('\n'));
  // Un REMBOURSEMENT au client à un autre taux : rendre 100 € à 3,400 coûte 340 DT à la banque,
  // le client n'est crédité que de 330 (le taux de sa facture) — 10 DT de perte de change.
  d.documents[0].payments[0].exchangeRate = 3.3;
  d.documents[0].payments.push({ id: 'pr', date: '2026-04-20', amount: -100, accountId: 'b', exchangeRate: 3.4 });
  assert.strictEqual(core.cashMovements(d, co, avril, null).find(m => m.id === 'pr').amount, -340, 'le remboursement ne sort pas au taux du jour');
  const E2 = core.journalEntries(d, co, avril);
  assert.strictEqual(r3(E2.filter(e2 => e2.account === '655').reduce((t, e2) => t + e2.debit - e2.credit, 0)), 10, 'rendre plus de dinars que la pièce n\'en porte n\'est pas une perte');
  assert.strictEqual(core.invoiceBalance(d.documents[0], d, co).remaining, 100, 'le reste suit la devise de la pièce');
  const e2 = ecarts(d);
  assert.deepStrictEqual(e2, [], e2.join('\n'));
});
// Ce que ni l'exemple de cinq ans ni le premier scénario ne portent (10.14.0) : la TVA à 13 %, des
// achats à 7, 13 et 0 %, une remise globale sur trois taux, une facture tirée d'un bon de livraison,
// une facture que son avoir annule, une facture MARQUÉE annulée, un avoir libre. L'exemple n'a aucune
// ligne à 13 % et aucune facture annulée : un défaut qui ne vit que là passait tous les invariants.
function scenarioTaux() {
  const d = base0({
    company: { ...CO, taxRegime: 'reel' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 10000, openingDate: '2026-01-01', isDefault: true }],
    clients: [{ id: 'c1', name: 'Hôtel du Lac' }], suppliers: [{ id: 's1', name: 'Grossiste Nord' }],
    catalog: [{ id: 'art', label: 'Lampe', unitPrice: 100, unitCost: 50, vatRate: 19, unit: 'pièce', tracked: true, initialQty: 10, initialCost: 50, initialDate: '2026-01-01' }],
    documents: [], purchases: [
      { id: 'P1', kind: 'facture', supplierId: 's1', number: 'GN-1', date: '2026-02-15', createdAt: 1, fees: 1, payments: [], lines: [
        { label: 'Fournitures', qty: 1, unitPrice: 1000, vatRate: 7, destination: 'charge', deductible: true },
        { label: 'Transport', qty: 1, unitPrice: 500, vatRate: 13, destination: 'charge', deductible: true },
        { label: 'Frais de dossier', qty: 1, unitPrice: 300, vatRate: 0, destination: 'charge', deductible: true }] },
      { id: 'P2', kind: 'facture', supplierId: 's1', number: 'GN-2', date: '2026-03-20', createdAt: 1, payments: [], lines: [
        { label: 'Lampe', itemId: 'art', qty: 5, unit: 'pièce', unitPrice: 60, vatRate: 7, destination: 'stock', deductible: true }] }]
  });
  const doc = o => ({ status: 'envoyée', payments: [], createdAt: 1, issuedTs: 1, ...o });
  const lampe = { label: 'Lampe', itemId: 'art', qty: 3, unitPrice: 100, vatRate: 19 };
  d.documents.push(
    doc({ id: 'F1', type: 'facture', number: 'FAC-2026-001', clientId: 'c1', date: '2026-02-10', dueDate: '2026-03-10', discountRate: 10, lines: [
      { label: 'Mobilier', qty: 1, unitPrice: 1000, vatRate: 19 }, { label: 'Transport', qty: 1, unitPrice: 500, vatRate: 13 }, { label: 'Livres', qty: 1, unitPrice: 200, vatRate: 7 }] }),
    doc({ id: 'L1', type: 'livraison', number: 'BL-2026-001', status: 'livré', clientId: 'c1', date: '2026-03-01', lines: [{ ...lampe }] }),
    doc({ id: 'F2', type: 'facture', number: 'FAC-2026-002', clientId: 'c1', date: '2026-03-05', dueDate: '2026-04-05', fromDocType: 'livraison', fromDocId: 'L1', fromDocNumber: 'BL-2026-001', lines: [{ ...lampe }] }),
    doc({ id: 'F3', type: 'facture', number: 'FAC-2026-003', clientId: 'c1', date: '2026-04-01', dueDate: '2026-05-01', applyStamp: false, lines: [{ label: 'Étude', qty: 1, unitPrice: 1000, vatRate: 19 }] }),
    doc({ id: 'AV1', type: 'avoir', number: 'AVO-2026-001', status: 'émis', clientId: 'c1', date: '2026-04-10', creditOf: 'F3', lines: [{ label: 'Étude', qty: 1, unitPrice: 1000, vatRate: 19 }] }),
    doc({ id: 'F4', type: 'facture', number: 'FAC-2026-004', status: 'annulée', clientId: 'c1', date: '2026-05-01', dueDate: '2026-06-01', lines: [{ label: 'Jamais partie', qty: 1, unitPrice: 700, vatRate: 19 }] }),
    doc({ id: 'AV2', type: 'avoir', number: 'AVO-2026-002', status: 'émis', clientId: 'c1', date: '2026-06-01', lines: [{ label: 'Geste commercial', qty: 1, unitPrice: 200, vatRate: 19 }] }));
  d.documents[0].payments.push({ id: 'pF1', date: '2026-02-20', amount: 1773.1, accountId: 'b' });
  d.purchases[0].payments.push({ id: 'pP1', date: '2026-02-28', amount: 1936, accountId: 'b' });
  return core.migrateData(d);
}
t('10.14.0 : les taux à 13 et 7 %, la remise sur trois taux, la facture d\'un bon de livraison, l\'annulée et les avoirs — calculés à la main', () => {
  const d = scenarioTaux(), co = d.company, an = { from: '2026-01-01', to: '2026-12-31' };
  // F1 : 1 700 HT remisés de 10 % = 1 530 ; TVA 900 × 19 % + 450 × 13 % + 180 × 7 % = 171 + 58,5 +
  // 12,6 = 242,1 ; timbre 1 → 1 773,1.
  const t1 = core.computeTotals(d.documents.find(x => x.id === 'F1'), co);
  assert.deepStrictEqual([t1.netHT, t1.totalVAT, t1.netToPay], [1530, 242.1, 1773.1]);
  assert.deepStrictEqual([t1.vatByRate[13].base, t1.vatByRate[13].vat, t1.vatByRate[7].vat], [450, 58.5, 12.6], 'la remise ne se répartit pas sur chaque taux');
  // P1 : 1 800 HT, TVA 70 + 65 = 135, timbre du fournisseur 1 → 1 936.
  const tp = core.purchaseTotals(d.purchases.find(x => x.id === 'P1'), co);
  assert.deepStrictEqual([tp.totalHT, tp.totalVAT, tp.deductibleVAT, tp.netToPay], [1800, 135, 135, 1936]);
  // Le chiffre d'affaires : 1 530 + 300 + 1 000 − 1 000 − 200 = 1 630 ; la facture ANNULÉE n'y est pas.
  const st = core.salesTotals(d, co, an.from, an.to);
  assert.deepStrictEqual([st.ht, st.vat], [1630, 261.1], 'la facture annulée compte dans le chiffre d\'affaires');
  // La TVA par taux, sur l'année : collectée 190 à 19 % (171 + 57 + 190 − 190 − 38), 58,5 à 13 %,
  // 12,6 à 7 % ; déductible 91 à 7 % (70 + 21), 65 à 13 %.
  const v = core.vatReturn(d, co, an);
  assert.deepStrictEqual([v.byRate[19].collected, v.byRate[13].collected, v.byRate[7].collected, v.byRate[7].deductible, v.byRate[13].deductible, v.deductible], [190, 58.5, 12.6, 91, 65, 156]);
  // Le mois de février se déclare seul : 242,1 − 135 = 107,1 ; juin laisse un crédit de 38 (l'avoir libre).
  const ch = core.vatChain(d, co, 2026);
  assert.strictEqual(ch.find(m => (m.month || m.key) === '2026-02').toPay, 107.1);
  // Le stock : la facture tirée du bon de livraison ne sort PAS une seconde fois — 10 − 3 + 5 = 12,
  // valeur 350 + 300 = 650 ; coût des ventes 3 × 50 = 150.
  const so = core.stockOf(d, 'art', '2026-12-31');
  assert.deepStrictEqual([so.qty, so.value], [12, 650], 'la facture du bon de livraison sort le stock une seconde fois');
  assert.strictEqual(core.costOfGoodsSold(d, co, an), 150);
  // Les tiers : le client doit F2 (300 + 57 + 1 = 358) moins l'avoir libre (238) = 120 ; la facture
  // que son avoir annule ne doit rien, la facture annulée non plus ; le fournisseur attend GN-2 (321).
  const E = core.journalEntries(d, co, an);
  const solde = c => r3(E.filter(e => e.account === c).reduce((x, e) => x + e.debit - e.credit, 0));
  assert.strictEqual(solde('411'), 120);
  assert.strictEqual(solde('401'), -321);
  assert.strictEqual(solde('532'), r3(10000 + 1773.1 - 1936));
  assert.strictEqual(core.invoiceBalance(d.documents.find(x => x.id === 'F4'), d, co).remaining, 0, 'une facture annulée doit encore quelque chose');
  assert.strictEqual(core.effectiveStatus(d.documents.find(x => x.id === 'F3'), d, co), 'annulée');
  assert.ok(!E.some(e => e.docId === 'F4'), 'la facture annulée a des écritures');
  const e = ecarts(d);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : la page d\'une facture annulée ne réclame rien, et se rétablit d\'un bouton', () => {
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  // « Reste à payer 633,370 DT » en orange sur une facture que le client ne doit pas : la carte dit 0,
  // ni orange ni vert, et pourquoi.
  assert.ok(/: b\.annulee\s*\n\s*\? `<div><div class="k-label">Reste à payer<\/div><div class="v">\$\{C\.money\(0, cur\)\}/.test(app), 'la carte d\'une annulée ne dit pas 0 sans couleur');
  // Le bandeau dit qu'elle est annulée, pas « émise » avec un déverrouillage de secours.
  assert.ok(/isInv && doc\.status === 'annulée' \? `<div class="banner info lock-banner" id="annulee-banner">/.test(app) && /id="lock-uncancel">Rétablir la facture<\/button>/.test(app));
  assert.ok(/const canUnlock = locked && isInv && bal && !bal\.paid && !bal\.credits\.length && doc\.status !== 'annulée';/.test(app), 'une facture annulée propose « Modifier quand même »');
  // La clôture passe AVANT la question (7.6.0).
  const z = app.slice(app.indexOf("if ($('#cancel-inv')) $('#cancel-inv').onclick"), app.indexOf("if ($('#uncancel'))"));
  const iC = z.indexOf('closedBlock('), iQ = z.indexOf('confirmDialog(');
  assert.ok(z.length > 100 && z.length < 900 && iC > 0 && iQ > 0 && iC < iQ, 'la question passe avant la clôture');
});
t('10.14.0 : la fenêtre d\'un règlement en devise demande le taux du jour, et dit AVANT d\'enregistrer ce qui passe à la banque', () => {
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  const vm = require('vm');
  const champ = app.slice(app.indexOf('function champTauxReglement('), app.indexOf('function brancherTauxReglement('));
  const branche = app.slice(app.indexOf('function brancherTauxReglement('), app.indexOf('function paymentForm('));
  assert.ok(champ.length > 200 && champ.length < 1500 && branche.length > 600 && branche.length < 3000, 'tranches inattendues');
  // Le champ n'existe que sur une pièce en devise, et propose le taux de la pièce.
  const co = { currency: 'DT' };
  const ctx = { company: () => co, h: x => String(x), lbl: x => x, field: (l, n, v) => `[${l}|${n}|${v}]` };
  const c = (piece, pay) => vm.runInNewContext(`${champ} champTauxReglement(piece, pay, 'k')`, { ...ctx, piece, pay });
  assert.strictEqual(c({ currency: 'DT' }, null), '', 'le champ apparaît sur une pièce en dinars');
  assert.ok(c({ currency: 'EUR', exchangeRate: 3.3 }, null).includes('|exchangeRate|3.3]'), 'le taux proposé n\'est pas celui de la pièce');
  assert.ok(c({ currency: 'EUR', exchangeRate: 3.3 }, { exchangeRate: 3.45 }).includes('|3.45]'), 'le taux d\'un règlement déjà saisi n\'est pas repris');
  // L'annonce, jouée : calculée à la main. 1 000 € reçus à 3,400 sur une facture à 3,300.
  const el = v => ({ value: v, ecoute: [], addEventListener(ev, f) { this.ecoute.push(f); }, textContent: '', innerHTML: '' });
  const jouer = (a, t, entre, verbe) => {
    const root = { '#rg-change': el(''), '[name=amount]': el(a), '[name=exchangeRate]': el(t) };
    vm.runInNewContext(`${branche} brancherTauxReglement(root, piece, entre, verbe)`, { $: (s, r) => r[s], C: core, company: () => co, root, piece: { currency: 'EUR', exchangeRate: 3.3 }, entre, verbe });
    const z = root['#rg-change'];
    return { z, root, texte: () => (z.innerHTML || z.textContent).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ') };
  };
  let r = jouer('1000', '3.4', true, 'Reçu');
  assert.ok(r.texte().includes(core.money(3400, 'DT').replace(/\s+/g, ' ')) && /gain de change de/.test(r.texte()) && r.texte().includes('755'), r.texte());
  assert.ok(r.texte().includes(core.money(100, 'DT').replace(/\s+/g, ' ')), 'l\'écart annoncé n\'est pas celui calculé à la main : ' + r.texte());
  // Payer un fournisseur à un taux plus haut que sa pièce : une perte.
  r = jouer('1000', '3.4', false, 'Payé');
  assert.ok(/perte de change de/.test(r.texte()) && r.texte().includes('655'), r.texte());
  // Même taux : aucun écart, et c'est dit.
  assert.ok(/aucun écart de change/.test(jouer('1000', '3.3', true, 'Reçu').texte()));
  // L'annonce suit la frappe (9.4.2) : taper un autre taux la recalcule.
  r = jouer('1000', '3.3', true, 'Reçu');
  r.root['[name=exchangeRate]'].value = '3.2';
  r.root['[name=exchangeRate]'].ecoute.forEach(f => f());
  assert.ok(/perte de change de/.test(r.texte()), 'l\'annonce ne suit pas la frappe : ' + r.texte());
  // Une fois la fenêtre fermée, la ligne du règlement dit ce qui est passé à la banque, et à quel
  // taux : sans elle, le taux du jour n'était écrit nulle part à l'écran.
  const enDinars = app.slice(app.indexOf('function reglementEnDinars('), app.indexOf('function brancherTauxReglement('));
  const lire = (piece, p) => vm.runInNewContext(`${enDinars} reglementEnDinars(piece, p)`, { C: core, company: () => co, piece, p }).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  assert.strictEqual(lire({ currency: 'DT' }, { amount: 100 }), '', 'une ligne en dinars porte un « = … DT »');
  assert.strictEqual(lire({ currency: 'EUR', exchangeRate: 3.35 }, { amount: 1100, exchangeRate: 3.4 }), `= ${core.money(3740, 'DT').replace(/\s+/g, ' ')} au taux de 3,4`);
  assert.strictEqual(lire({ currency: 'EUR', exchangeRate: 3.35 }, { amount: -100 }), `= ${core.money(335, 'DT').replace(/\s+/g, ' ')} au taux de 3,35`, 'un règlement sans taux ne reprend pas celui de sa pièce');
  assert.ok(/C\.money\(p\.amount, cur\)\}\$\{reglementEnDinars\(s, p\)\}/.test(app), 'la ligne d\'un paiement client ne dit pas ce qui est passé à la banque');
  // Dans la cellule du montant, où qu'elle soit posée : la part de retenue peut la suivre (10.14.0).
  assert.ok(/\$\{reglementEnDinars\(s2, x\)\}(?:(?!<\/td>)[^\n])*<\/td>\$\{rowMenuCell\(x\.id\)\}/.test(app), 'la ligne d\'un règlement fournisseur ne dit pas ce qui est passé à la banque');
  // Les deux fenêtres posent le champ, le branchent, refusent un taux invalide et l'enregistrent.
  const pf = app.slice(app.indexOf('function paymentForm('), app.indexOf('function paymentForm(') + 9000);
  const sp = app.slice(app.indexOf('champTauxReglement(p, r0,') - 800, app.indexOf('champTauxReglement(p, r0,') + 5000);
  [[pf, 'paymentForm', /champTauxReglement\(inv, p0, 'ed\.payRate'\)/, /brancherTauxReglement\(root, inv, !rend,/],
    [sp, 'supplierPaymentForm', /champTauxReglement\(p, r0, 'buy\.payRate'\)/, /brancherTauxReglement\(root, p, rend,/]].forEach(([z, nom, pose, branchee]) => {
    assert.ok(pose.test(z), `${nom} ne pose pas le champ`);
    assert.ok(branchee.test(z), `${nom} ne branche pas l'annonce`);
    assert.ok(/if \(\$\('\[name=exchangeRate\]', root\) && !\(Number\(v\.exchangeRate\) > 0\)\) return refus\(/.test(z), `${nom} accepte un taux invalide`);
    assert.ok(/if \(\$\('\[name=exchangeRate\]', root\)\) champs\.exchangeRate = Number\(v\.exchangeRate\);/.test(z), `${nom} n'enregistre pas le taux du jour`);
  });
});
// Une entreprise au forfait (ou exonérée) paie la TVA de ses fournisseurs et ne la déduit jamais :
// elle fait partie du coût. SkanFact la déduisait quand même — le 4366 débité, la charge au HT, le
// résultat trop beau de toute la TVA payée, et le stock et les biens entrés hors TVA.
function scenarioForfait() {
  return core.migrateData(base0({
    company: { ...CO, taxRegime: 'forfaitaire' },
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 5000, openingDate: '2026-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client' }], suppliers: [{ id: 's', name: 'Fournisseur' }],
    catalog: [{ id: 'it', label: 'Robinet', unitPrice: 100, unitCost: 60, vatRate: 19, unit: 'pièce', tracked: true, initialQty: 0 }],
    documents: [{ id: 'F', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', clientId: 'c', date: '2026-03-10', dueDate: '2026-04-10', createdAt: 3, issuedTs: 3, payments: [],
      lines: [{ label: 'Robinet', itemId: 'it', qty: 2, unit: 'pièce', unitPrice: 100, vatRate: 0 }] }],
    purchases: [
      { id: 'A', kind: 'facture', supplierId: 's', number: 'X-1', date: '2026-03-02', createdAt: 1, payments: [{ id: 'pa', date: '2026-03-15', amount: 1190, accountId: 'b' }],
        lines: [{ label: 'Outillage', qty: 1, unitPrice: 1000, vatRate: 19, destination: 'charge', deductible: true }] },
      { id: 'S', kind: 'facture', supplierId: 's', number: 'X-2', date: '2026-03-05', createdAt: 2, payments: [],
        lines: [{ label: 'Robinet', itemId: 'it', qty: 5, unit: 'pièce', unitPrice: 60, vatRate: 19, destination: 'stock', deductible: true }] },
      { id: 'B', kind: 'facture', supplierId: 's', number: 'X-3', date: '2026-02-05', createdAt: 1, payments: [],
        lines: [{ label: 'Machine', qty: 1, unitPrice: 1000, vatRate: 19, destination: 'immobilisation', deductible: true }] }]
  }));
}
t('10.14.0 : au forfait, la TVA des achats est un coût — charge, stock et bien TTC, rien au 4366, figé par pièce', () => {
  const d = scenarioForfait(), co = d.company, an = { from: '2026-01-01', to: '2026-12-31' };
  assert.strictEqual(core.assujettiTVA(co), false);
  // La migration fige la règle de chaque achat sur le régime du jour.
  assert.deepStrictEqual(d.purchases.map(p => p.tvaRecuperable), [false, false, false], 'la règle n\'est pas figée sur les achats');
  // A : 1 000 HT, TVA 190 payée et non récupérée → 1 190 de charge.
  const ta = core.purchaseTotals(d.purchases[0], co);
  assert.deepStrictEqual([ta.totalHT, ta.totalVAT, ta.deductibleVAT, ta.netToPay, ta.base.cout.charge], [1000, 190, 0, 1190, 1190]);
  // Le résultat simplifié : 200 de ventes − 1 190 de charge − 142,8 de marchandises vendues.
  const sr = core.simpleResult(d, co, an);
  assert.deepStrictEqual([sr.produits, sr.charges, sr.stock, sr.immo, sr.cogs, sr.resultat], [200, 1190, 357, 1190, 142.8, r3(200 - 1190 - 142.8)]);
  const v = core.vatReturn(d, co, an);
  assert.deepStrictEqual([v.collected, v.deductible], [0, 0], 'un forfaitaire déduit la TVA de ses achats');
  // Le stock : 5 × 60 × 1,19 = 357 ; deux sorties au coût moyen 71,4 = 142,8 ; il reste 3 × 71,4 = 214,2.
  const so = core.stockOf(d, 'it', '2026-12-31');
  assert.deepStrictEqual([so.qty, so.value], [3, 214.2], 'le stock d\'un forfaitaire entre hors TVA');
  assert.strictEqual(core.costOfGoodsSold(d, co, an), 142.8);
  // Le bien : 1 000 + 190 = 1 190.
  assert.deepStrictEqual(core.assetsToCreate(d).map(a => a.amount), [1190], 'le bien d\'un forfaitaire entre hors TVA');
  // Les écritures : rien au 4366 ; 401 = −(1 190 + 357 + 1 190) + 1 190 réglés = −1 547.
  const E = core.journalEntries(d, co, an);
  const solde = c => r3(E.filter(e => e.account.startsWith(c)).reduce((x, e) => x + e.debit - e.credit, 0));
  assert.strictEqual(solde('4366'), 0, 'le 4366 est débité chez un forfaitaire');
  assert.strictEqual(solde('401'), -1547);
  // Une ligne née du catalogue ne porte pas de TVA ; une ligne neuve non plus.
  assert.strictEqual(core.tauxPourRegime(co, 19), 0);
  assert.strictEqual(core.tauxPourRegime({ ...CO, taxRegime: 'reel' }, 19), 19);
  assert.strictEqual(core.newLine(co).vatRate, 0);
  assert.strictEqual(core.newLine(co, { vatRate: 19 }).vatRate, 0, 'une ligne neuve d\'un forfaitaire garde 19 %');
  // Le régime change : les pièces déjà saisies gardent LEUR règle (7.1.x), les neuves suivent le jour.
  const reel = { ...co, taxRegime: 'reel' };
  assert.strictEqual(core.purchaseTotals(d.purchases[0], reel).deductibleVAT, 0, 'passer au réel réécrit un achat fait au forfait');
  const avant = core.migrateData(base0({ company: { ...CO, taxRegime: 'reel' }, suppliers: [{ id: 's', name: 'F' }],
    purchases: [{ id: 'R', kind: 'facture', supplierId: 's', number: 'R-1', date: '2026-01-10', createdAt: 1, payments: [], lines: [{ label: 'x', qty: 1, unitPrice: 100, vatRate: 19, destination: 'charge', deductible: true }] }] }));
  assert.strictEqual(avant.purchases[0].tvaRecuperable, true);
  assert.strictEqual(core.purchaseTotals(avant.purchases[0], co).deductibleVAT, 19, 'passer au forfait retire la TVA déjà déduite au réel');
  // Une ligne marquée non déductible au réel reste non déductible (le carburant, les cadeaux).
  assert.strictEqual(core.tvaNonDeductible({ deductible: false }, { tvaRecuperable: true }, reel), true);
  assert.strictEqual(core.tvaNonDeductible({ deductible: true }, { tvaRecuperable: false }, reel), true);
  assert.strictEqual(core.tvaNonDeductible({ deductible: true }, { tvaRecuperable: true }, co), false);
  const e = ecarts(d);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : l\'écran d\'un achat au forfait éteint « Déduct. » et dit pourquoi — un avoir prend la règle de sa pièce', () => {
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  // La case se lit sur la règle de la PIÈCE, pas sur celle de la ligne.
  assert.ok(/\$\{C\.tvaRecuperable\(p, company\(\)\)\s*\n\s*\? `<input type="checkbox" data-k="deductible"/.test(app), 'la case « Déduct. » ne suit pas la règle de la pièce');
  assert.ok(/: `<input type="checkbox" disabled title="\$\{h\(`Ton régime/.test(app), 'la case éteinte ne dit pas pourquoi');
  // Un achat neuf et une copie prennent la règle du jour ; un avoir ou un acompte celle de sa pièce.
  assert.ok(/tvaRecuperable: C\.assujettiTVA\(company\(\)\),\s*\n\s*payments: \[\], attachments: \[\], createdAt: Date\.now\(\)/.test(app), 'un achat neuf ne prend pas la règle du jour');
  assert.ok(/withholdingCertificate: false, tvaRecuperable: C\.assujettiTVA\(company\(\)\) \}/.test(app), 'une copie garde la règle de l\'original');
  assert.ok(/p\.tvaRecuperable = C\.tvaRecuperable\(vise, company\(\)\);/.test(app), 'un avoir fournisseur ne prend pas la règle de la pièce qu\'il corrige');
  assert.ok(/e\.target\.name === 'achatLie'\) \{\s*\n\s*const vise = purchaseById\(p\.achatLie\);/.test(app), 'rattacher un avoir à une autre pièce ne change pas sa règle');
  // Chaque ligne née du catalogue passe par le régime : trois portes dans l'éditeur, les modèles, les licences.
  const nus = (app.match(/vatRate: it\.vatRate/g) || []).length;
  assert.strictEqual(nus, 0, 'une ligne née du catalogue reprend son taux sans le régime');
  assert.ok((app.match(/vatRate: C\.tauxPourRegime\(company\(\), it\.vatRate\)/g) || []).length >= 3);
  // L'émission prévient d'une TVA restée sur la pièce d'un non-assujetti.
  assert.ok(/if \(!C\.assujettiTVA\(co\) && \(isInv \|\| doc\.type === 'avoir'\)\) \{\s*\n\s*const tva = C\.computeTotals\(doc, co\)\.totalVAT;/.test(app), 'l\'émission ne prévient pas de la TVA d\'un forfaitaire');
});
t('10.14.0 : une erreur de régime se répare dans les mois ouverts — l\'annonce est celle de la déclaration', () => {
  // Saisis au réel, puis l'entreprise se découvre au forfait. Juin est clôturé.
  const d = core.migrateData(base0({
    company: { ...CO, taxRegime: 'reel' }, closedUntil: '2026-06-30', suppliers: [{ id: 's', name: 'F' }],
    purchases: [
      { id: 'J', kind: 'facture', supplierId: 's', number: 'J-1', date: '2026-06-10', createdAt: 1, payments: [], lines: [{ label: 'x', qty: 1, unitPrice: 500, vatRate: 19, destination: 'charge', deductible: true }] },
      { id: 'K', kind: 'acompte', supplierId: 's', number: 'K-1', date: '2026-06-20', createdAt: 1, achatLie: 'P', payments: [], lines: [{ label: 'acompte', qty: 1, unitPrice: 100, vatRate: 19, destination: 'charge', deductible: true }] },
      { id: 'P', kind: 'facture', supplierId: 's', number: 'P-1', date: '2026-07-05', createdAt: 1, payments: [], lines: [{ label: 'y', qty: 1, unitPrice: 1000, vatRate: 19, destination: 'charge', deductible: true }] },
      { id: 'A', kind: 'avoir', supplierId: 's', number: 'A-1', date: '2026-07-15', createdAt: 1, achatLie: 'P', payments: [], lines: [{ label: 'y', qty: 1, unitPrice: 200, vatRate: 19, destination: 'charge', deductible: true }] },
      { id: 'Q', kind: 'facture', supplierId: 's', number: 'Q-1', date: '2026-08-01', createdAt: 1, payments: [], lines: [{ label: 'z', qty: 1, unitPrice: 300, vatRate: 7, destination: 'charge', deductible: true }] }]
  }));
  const forf = { ...d.company, taxRegime: 'forfaitaire' };
  d.company = forf;
  const r = core.achatsHorsRegime(d, forf);
  // J est clôturé ; l'acompte K est clôturé aussi. P, son avoir A (sa pièce change avec lui) et Q.
  assert.deepStrictEqual(r.pieces.map(p => p.id).sort(), ['A', 'P', 'Q'], 'le lot touche un mois clôturé, ou oublie un avoir rattaché');
  assert.strictEqual(r.cible, false);
  // Juillet et août, à la main : P déduit 190 moins les 19 que l'acompte de juin a déjà déduits, soit
  // 171 ; l'avoir retire 38 ; Q déduit 21. Déductible 171 − 38 + 21 = 154 ; après, P reprend les 19
  // de l'acompte (−19) et le reste vaut 0 : la déclaration bouge de 154 + 19 = 173.
  const per = { from: '2026-07-01', to: '2026-08-31' };
  assert.strictEqual(core.vatReturn(d, forf, per).deductible, 154);
  assert.strictEqual(r.tva, 173, 'l\'annonce n\'est pas l\'écart de la déclaration');
  // Rien au régime du jour : aucune pièce.
  assert.deepStrictEqual(core.achatsHorsRegime(d, { ...forf, taxRegime: 'reel' }).pieces, []);
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../src/renderer/app.js'), 'utf8');
  // Le geste en lot : lit le régime ENREGISTRÉ, demande avant, n'écrit que les pièces du lot.
  assert.ok(/const r2 = C\.achatsHorsRegime\(data, company\(\)\);[\s\S]{0,200}const ok = await confirmDialog\(/.test(app), 'le lot applique sans demander');
  assert.ok(/data\.purchases\.forEach\(x => \{ if \(ids\.has\(x\.id\)\) x\.tvaRecuperable = r2\.cible; \}\);/.test(app));
  // Le geste d'une pièce : le bandeau garde sa place, et les pièces rattachées suivent à l'enregistrement.
  assert.ok(/\$\('#b-regle'\)\.style\.minHeight = \$\('#b-regle'\)\.offsetHeight \+ 'px';/.test(app), 'le bandeau se replie sous le clic');
  assert.ok(/data\.purchases\.forEach\(x => \{ if \(x\.achatLie === p\.id && !C\.isClosedDate\(data, x\.date\)\) x\.tvaRecuperable = C\.tvaRecuperable\(p, company\(\)\); \}\);/.test(app), 'un avoir ou un acompte rattaché ne suit pas sa pièce');
  // Le panneau du régime suit le choix AVANT l'enregistrement, par la même phrase qu'au dessin.
  assert.ok(/<div id="regime-note">\$\{noteRegime\(c\)\}<\/div>/.test(app) && /\$\('#regime-note'\)\.innerHTML = noteRegime\(co\);/.test(app), 'le panneau du régime ne suit pas le choix');
});
t('10.14.0 : un taux forcé par le régime ne se range jamais — le passage au réel ne fait pas de factures sans TVA', () => {
  const onboarding = require('../../src/renderer/onboarding.js');
  // L'assistant d'un forfaitaire ne range PAS le 0 % forcé : le réglage reste vide, et le jour du
  // passage au réel, les nouvelles lignes naissent au taux ordinaire.
  const f = onboarding.applySetup(core.migrateData(null), { name: 'Menuiserie F', activity: 'batiment', taxRegime: 'forfaitaire', fillCatalog: true });
  assert.strictEqual(core.defaultVat(f.company), 0, 'au forfait, les lignes naissent à 0 %');
  assert.ok(f.company.defaultVatRate === '' || f.company.defaultVatRate == null, 'le 0 % forcé a été rangé comme réglage');
  assert.strictEqual(core.defaultVat({ ...f.company, taxRegime: 'reel' }), 19, 'au passage au réel, les lignes naîtraient à 0 %');
  // Un réel, lui, garde son taux dans le réglage.
  const r = onboarding.applySetup(core.migrateData(null), { name: 'Menuiserie R', activity: 'batiment', taxRegime: 'reel', fillCatalog: false });
  assert.strictEqual(Number(r.company.defaultVatRate), 19);

  // Le catalogue du forfaitaire est à 0 % (le taux de ses ventes). Au réel, il se SIGNALE…
  assert.ok(f.catalog.length > 0 && f.catalog.every(x => Number(x.vatRate) === 0));
  assert.deepStrictEqual(core.articlesSansTva(f, f.company), [], 'au forfait, 0 % est juste : rien à signaler');
  const reel = { ...f.company, taxRegime: 'reel' };
  assert.strictEqual(core.articlesSansTva(f, reel).length, f.catalog.length, 'au réel, les articles à 0 % ne se signalent pas');
  // …sauf ceux qui portent un taux, et rien quand le taux des nouvelles lignes est lui-même 0.
  const mix = { catalog: [{ id: 'a', vatRate: 0 }, { id: 'b', vatRate: 19 }, { id: 'c', vatRate: 7 }, { id: 'd' }] };
  assert.deepStrictEqual(core.articlesSansTva(mix, { taxRegime: 'reel' }).map(x => x.id), ['a', 'd']);
  assert.deepStrictEqual(core.articlesSansTva(mix, { taxRegime: 'reel', defaultVatRate: 0 }), [], 'aucun taux à proposer : il n\'y a rien à dire');

  // Un achat tiré du catalogue : au forfait, le 0 % du catalogue n'est pas la TVA du fournisseur.
  assert.strictEqual(core.tauxAchatArticle({ vatRate: 0 }, { taxRegime: 'forfaitaire' }), 19, 'l\'achat recopie le 0 % forcé des ventes');
  assert.strictEqual(core.tauxAchatArticle({ vatRate: 0 }, { taxRegime: 'forfaitaire', defaultVatRate: 0 }), 19, 'un vieux 0 % rangé fait encore un achat sans TVA');
  assert.strictEqual(core.tauxAchatArticle({ vatRate: 7 }, { taxRegime: 'forfaitaire' }), 7);
  assert.strictEqual(core.tauxAchatArticle({ vatRate: 0 }, { taxRegime: 'reel' }), 0, 'au réel, un article à 0 % s\'achète à 0 %');
  assert.strictEqual(core.tauxAchatArticle({ vatRate: 13 }, { taxRegime: 'reel' }), 13);
  // Et l'achat qui en naît compte la TVA dans son coût : 100 HT à 19 %, coût 119.
  const p = { id: 'p', tvaRecuperable: false, lines: [{ qty: 1, unitPrice: 100, vatRate: core.tauxAchatArticle({ vatRate: 0 }, { taxRegime: 'forfaitaire' }), destination: 'charge', deductible: true }] };
  assert.strictEqual(core.purchaseTotals(p, { taxRegime: 'forfaitaire' }).base.cout.charge, 119, 'le coût d\'un achat au forfait oublie la TVA payée');

  const fs = require('fs'), path = require('path');
  const app = fs.readFileSync(path.join(__dirname, '../../src/renderer/app.js'), 'utf8');
  // Les Paramètres ne rangent pas le taux AFFICHÉ grisé d'un non-assujetti.
  assert.ok(/const v = formValues\(\$\('#pf'\)\);[\s\S]{0,700}if \(!C\.assujettiTVA\(\{ \.\.\.data\.company, \.\.\.v \}\)\) delete v\.defaultVatRate;/.test(app), 'les Paramètres rangent le 0 % forcé');
  // Les trois chemins d'un achat tiré du catalogue passent par la même fonction.
  assert.strictEqual((app.match(/vatRate: C\.tauxAchatArticle\((it|art), company\(\)\)/g) || []).length, 3, 'un achat tiré du catalogue recopie son taux de vente');
  assert.ok(!/vatRate: Number\((it|art)\.vatRate\) \|\| 0/.test(app), 'un chemin recopie encore le taux de vente sur un achat');
  // Le catalogue à 0 % se signale au régime et au taux CHOISIS, et le geste se défait.
  const panneau = app.slice(app.indexOf('function dessinerCatalogueSansTva()'), app.indexOf('function noteRegime('));
  assert.ok(panneau.length > 500 && panneau.length < 4000, 'tranche inattendue');
  assert.ok(/C\.articlesSansTva\(data, co\)/.test(panneau) && /C\.articlesSansTva\(data, co2\)/.test(panneau), 'le compte et le geste ne lisent pas la même fonction');
  assert.ok(/const co = regimeChoisi\(\);/.test(panneau), 'le panneau lit le régime enregistré, pas celui qu\'on choisit');
  assert.ok(/await confirmDialog\(/.test(panneau) && /toastUndo\(/.test(panneau), 'le geste ne demande pas, ou ne se défait pas');
  assert.ok(/selTaux\.addEventListener\('change'/.test(app) && /dessinerCatalogueSansTva\(\);\s*\}\);\s*\/\/ Le taux choisi/.test(app), 'le panneau ne suit pas le choix');  // La liste du catalogue dit le taux qui s'IMPRIMERA : 0 % chez qui ne facture pas de TVA.
  assert.ok(/key: 'vat', label: 'TVA', r: true, val: c => Number\(c\.vatRate\) \|\| 0, get: c => C\.assujettiTVA\(company\(\)\) \|\| !\(Number\(c\.vatRate\) > 0\) \? c\.vatRate \+ ' %'/.test(app), 'le catalogue affiche 19 % à une entreprise qui facture 0 %');
});

t('10.14.0 : la retenue à la source naît au RÈGLEMENT — déclarée le mois du paiement, au prorata, le dernier règlement prend le reste', () => {
  // Calculé à la main. H-1 : 1 000 HT + 19 % = 1 190 ; 1,5 % = 17,850 retenus ; net 1 172,150.
  // Réglée 400 en avril et 772,150 en mai : 17,85 × 400 / 1 172,15 = 6,0913… → 6,091 ; le solde,
  // 17,850 − 6,091 = 11,759. Rien en mars : la facture n'a encore rien retenu.
  // A-1 (acompte, 500 HT → 595 ; 8,925 ; net 586,075) réglé en juin, F-2 (2 000 HT → 2 380 ; 35,700 ;
  // net 2 344,300) réduite de l'acompte et de l'avoir AV-3 (100 HT → 119 ; 1,785 ; net 117,215) :
  // il reste 1 641,010 à verser en août, qui retient 35,7 − 8,925 − 1,785 = 24,990. En tout 33,915 :
  // 1,5 % des 2 261 TTC réellement servis (1 900 HT + 19 %).
  // H-4 (1 000 HT, 1,5 %) n'est jamais payée : ni déclarée, ni attestée — son 401 porte le brut.
  const ligne = ht => [{ label: 'Honoraires', qty: 1, unitPrice: ht, vatRate: 19, destination: 'charge', deductible: true }];
  const d = base0({
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 10000, openingDate: '2026-01-01', isDefault: true }],
    suppliers: [{ id: 's', name: 'Cabinet Conseil' }],
    purchases: [
      { id: 'H1', kind: 'facture', supplierId: 's', number: 'H-1', date: '2026-03-10', withholdingRate: 1.5, fees: 0, createdAt: 1, lines: ligne(1000),
        payments: [{ id: 'h1a', date: '2026-04-05', amount: 400 }, { id: 'h1b', date: '2026-05-20', amount: 772.15 }] },
      { id: 'A1', kind: 'acompte', supplierId: 's', number: 'A-1', date: '2026-06-01', withholdingRate: 1.5, fees: 0, createdAt: 2, achatLie: 'F2', lines: ligne(500),
        payments: [{ id: 'a1a', date: '2026-06-02', amount: 586.075 }] },
      { id: 'F2', kind: 'facture', supplierId: 's', number: 'F-2', date: '2026-07-01', withholdingRate: 1.5, fees: 0, createdAt: 3, lines: ligne(2000),
        payments: [{ id: 'f2a', date: '2026-08-10', amount: 1641.01 }] },
      { id: 'AV3', kind: 'avoir', supplierId: 's', number: 'AV-3', date: '2026-07-15', withholdingRate: 1.5, fees: 0, createdAt: 4, achatLie: 'F2', lines: ligne(100), payments: [] },
      { id: 'H4', kind: 'facture', supplierId: 's', number: 'H-4', date: '2026-08-12', withholdingRate: 1.5, fees: 0, createdAt: 5, lines: ligne(1000), payments: [] }
    ]
  });
  const co = d.company, acc = core.chartAccounts(d);
  // La déclaration de chaque mois : la retenue des RÈGLEMENTS du mois.
  const rs = m => core.vatReturn(d, co, core.packPeriod(2026, m)).withheldOnBuys;
  assert.deepStrictEqual([3, 4, 5, 6, 7, 8].map(rs), [0, 6.091, 11.759, 8.925, 0, 24.99], 'la retenue n\'est pas déclarée le mois du paiement');
  // Les écritures : le fournisseur crédité du BRUT à la facture, rien au 4352 ; chaque règlement le solde.
  const E = core.journalEntries(d, co, { from: '2026-01-01', to: '2026-08-31' }, { sections: ['achats', 'reglements'] });
  const mars = E.filter(e => e.date === '2026-03-10');
  assert.strictEqual(soldeDe(mars, acc.rsOperee), 0, 'la facture crédite encore le 4352');
  assert.strictEqual(soldeDe(mars, acc.fournisseurs), -1190, 'le fournisseur n\'est pas crédité du brut');
  const avril = E.filter(e => e.date === '2026-04-05');
  assert.deepStrictEqual([soldeDe(avril, acc.fournisseurs), soldeDe(avril, acc.rsOperee)], [406.091, -6.091]);
  // Tout ce qui a été versé retient en tout la retenue sur ce qui a été servi, au millime.
  assert.strictEqual(soldeDe(E, acc.rsOperee), r3(-(17.85 + 33.915)), 'la retenue opérée n\'est pas celle des pièces servies');
  assert.strictEqual(soldeDe(E, acc.avancesFournisseurs), 0, 'l\'acompte n\'est pas soldé');
  assert.strictEqual(soldeDe(E, acc.fournisseurs), -1190, 'seule la facture impayée doit rester au 401, en brut');
  // La facture impayée : ni attestation, ni déclaration ; la fiche dit le net ET la retenue à garder.
  assert.deepStrictEqual(core.withholdingsToIssue(d, co).map(x => [x.number, x.amount]), [['H-1', 17.85], ['A-1', 8.925], ['F-2', 24.99]]);
  const fiche = core.supplierSummary(d, co, 's', '2026-09-01');
  assert.deepStrictEqual([fiche.remaining, fiche.rsAOperer], [1172.15, 17.85], 'la fiche ne dit pas le net et la retenue à garder');
  // Le lettrage lit le compte : le brut de la facture impayée.
  const lt = core.lettrage(d, co, 'fournisseurs', '2026-09-01');
  assert.deepStrictEqual([lt.reste, lt.rows[0].ouverts.map(o => [o.piece, o.reste])], [1190, [['H-4', 1190]]], 'le lettrage ne dit pas ce que le compte porte');
  // La déclaration annuelle : 51,765 retenus sur l'année, et H-4 n'y est pas.
  const an = core.employerAnnual(d, 2026, co);
  assert.deepStrictEqual([an.heldTotal, an.held.map(x => x.number).sort().join()], [51.765, 'A-1,F-2,H-1']);
  // Payer PLUS que le net ne retient pas plus que la retenue : 1 200 versés sur 1 172,150 dus
  // retiennent 17,850, pas 17,85 × 1 200 / 1 172,15 = 18,274 ; rendre le trop-payé n'y change rien.
  const d2 = base0({ suppliers: [{ id: 's', name: 'Cabinet Conseil' }], purchases: [
    { id: 'H5', kind: 'facture', supplierId: 's', number: 'H-5', date: '2026-04-01', withholdingRate: 1.5, fees: 0, createdAt: 1, lines: ligne(1000),
      payments: [{ id: 'x1', date: '2026-04-02', amount: 1200 }, { id: 'x2', date: '2026-05-02', amount: -27.85 }] }] });
  assert.deepStrictEqual([4, 5].map(m => core.vatReturn(d2, d2.company, core.packPeriod(2026, m)).withheldOnBuys), [17.85, 0], 'un trop-payé retient plus que la retenue');
  // Chaque invariant, et le Cabinet qui lit le même client mois par mois (déclaration comprise).
  const e = ecarts(d);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : un avoir fournisseur posé APRÈS le règlement régularise la retenue à SA date — le mois déjà déclaré ne bouge pas', () => {
  // Calculé à la main. H-6 : 1 000 HT + 19 % = 1 190 ; 17,850 retenus ; réglée en entier le 5 mars
  // (1 172,150). L'avoir AV-7 du 12 avril (100 HT → 119 ; 1,785 ; net 117,215) ramène la retenue due
  // à 1,5 % de 1 071 = 16,065 : les 1,785 de trop se régularisent en AVRIL. Recalculer la part du
  // règlement de mars réécrivait une déclaration déjà déposée.
  const ligne = ht => [{ label: 'Honoraires', qty: 1, unitPrice: ht, vatRate: 19, destination: 'charge', deductible: true }];
  const sans = base0({
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 10000, openingDate: '2026-01-01', isDefault: true }],
    suppliers: [{ id: 's', name: 'Cabinet Conseil' }],
    purchases: [{ id: 'H6', kind: 'facture', supplierId: 's', number: 'H-6', date: '2026-03-02', withholdingRate: 1.5, fees: 0, createdAt: 1, lines: ligne(1000),
      payments: [{ id: 'h6', date: '2026-03-05', amount: 1172.15 }] }]
  });
  const d = JSON.parse(JSON.stringify(sans));
  d.purchases.push({ id: 'AV7', kind: 'avoir', supplierId: 's', number: 'AV-7', date: '2026-04-12', withholdingRate: 1.5, fees: 0, createdAt: 2, achatLie: 'H6', lines: ligne(100), payments: [] });
  const co = d.company, acc = core.chartAccounts(d);
  const rs = (x, m) => core.vatReturn(x, x.company, core.packPeriod(2026, m)).withheldOnBuys;
  assert.deepStrictEqual([rs(sans, 3), rs(sans, 4)], [17.85, 0]);
  assert.deepStrictEqual([rs(d, 3), rs(d, 4)], [17.85, -1.785], 'l\'avoir a réécrit la retenue du mois déjà déclaré');
  const E = core.journalEntries(d, co, { from: '2026-01-01', to: '2026-04-30' }, { sections: ['achats', 'reglements'] });
  const avril = E.filter(x => x.date === '2026-04-12');
  assert.deepStrictEqual([soldeDe(avril, acc.rsOperee), soldeDe(avril, acc.fournisseurs)], [1.785, 117.215], 'l\'avoir ne régularise pas la retenue dans son écriture');
  assert.strictEqual(soldeDe(E, acc.rsOperee), -16.065);
  assert.deepStrictEqual(core.withholdingsToIssue(d, co).map(x => [x.number, x.amount]), [['H-6', 16.065]]);
  assert.strictEqual(core.employerAnnual(d, 2026, co).heldTotal, 16.065);
  assert.strictEqual(core.retenueAOperer(d.purchases[0], co, d), 0, 'une facture soldée n\'a plus rien à retenir');
  const e = ecarts(d);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
t('10.14.0 : la retenue SUBIE naît à l\'encaissement — déclarée le mois où le client paie, et l\'attestation se réclame seulement quand il a retenu', () => {
  // Calculé à la main.
  // F-1 : 1 000 HT + 190 de TVA + 1 de timbre = 1 191 ; retenue 1,5 % de 1 190 = 17,850 ; net
  //       1 173,150. 500 encaissés le 20 mars : 17,85 × 500 / 1 173,15 = 7,6077… → 7,608 ; le solde
  //       du 5 avril (673,150) prend le reste, 10,242.
  // F-2 : 100 HT + 19 + 1 = 120 ; 1,785 ; net 118,215, encaissée en entier le 15 mars (1,785 en
  //       mars). L'avoir AV-2 du 10 avril (40 HT + 7,6 = 47,6 ; 0,714 ; net 46,886) la réduit à
  //       72,400 brut : la retenue due tombe à 1,071, et les 0,714 de trop se régularisent en AVRIL.
  //       Le trop-perçu (46,886) est rendu le 2 mai : la retenue n'en bouge plus.
  // F-3 : impayée (200 HT + 38 + 1 = 239 ; 3,570 à subir) : ni déclarée, ni réclamée.
  // F-5 : 300 HT + 57 + 1 = 358 ; 5,355 ; net 352,645. 100 encaissés le 3 mai (1,519 retenus), puis
  //       rendus le 20 mai : la retenue est défaite le même mois — mai déclare 0.
  // AV-4 : un avoir libre du client L (100 HT + 19 = 119, 1,5 %) : sa retenue (1,785) ne naîtra qu'au
  //       règlement qui l'emploiera.
  // Déclaré : mars 7,608 + 1,785 = 9,393 ; avril 10,242 − 0,714 = 9,528 ; mai 0. Au 4358 : 18,921.
  const l = ht => [{ label: 'Service', qty: 1, unitPrice: ht, vatRate: 19 }];
  const fac = (id, number, date, ht, payments) => ({ id, type: 'facture', number, status: 'envoyée', clientId: 'c', date, dueDate: date, withholdingRate: 1.5, lines: l(ht), payments });
  const sans = base0({
    accounts: [{ id: 'b', name: 'Banque', kind: 'banque', opening: 10000, openingDate: '2026-01-01', isDefault: true }],
    clients: [{ id: 'c', name: 'Client RS', withholdingRate: 1.5 }, { id: 'lb', name: 'Client Libre' }],
    documents: [
      fac('F1', 'FAC-2026-001', '2026-03-10', 1000, [{ id: 'p1', date: '2026-03-20', amount: 500, accountId: 'b' }, { id: 'p2', date: '2026-04-05', amount: 673.15, accountId: 'b' }]),
      fac('F2', 'FAC-2026-002', '2026-03-01', 100, [{ id: 'p3', date: '2026-03-15', amount: 118.215, accountId: 'b' }]),
      fac('F3', 'FAC-2026-003', '2026-04-20', 200, []),
      fac('F5', 'FAC-2026-004', '2026-05-01', 300, [{ id: 'p5', date: '2026-05-03', amount: 100, accountId: 'b' }, { id: 'p6', date: '2026-05-20', amount: -100, accountId: 'b' }]),
      { id: 'A4', type: 'avoir', number: 'AVO-2026-002', status: 'émis', clientId: 'lb', date: '2026-05-05', withholdingRate: 1.5, lines: l(100) }
    ]
  });
  const d = JSON.parse(JSON.stringify(sans));
  d.documents.push({ id: 'A2', type: 'avoir', number: 'AVO-2026-001', status: 'émis', clientId: 'c', date: '2026-04-10', creditOf: 'F2', creditOfNumber: 'FAC-2026-002', withholdingRate: 1.5, lines: l(40) });
  d.documents.find(x => x.id === 'F2').payments.push({ id: 'p4', date: '2026-05-02', amount: -46.886, accountId: 'b' });
  const co = d.company, acc = core.chartAccounts(d);
  const rs = (x, m) => core.vatReturn(x, x.company, core.packPeriod(2026, m)).withheldBySale;
  assert.deepStrictEqual([3, 4, 5].map(m => rs(sans, m)), [9.393, 10.242, 0]);
  assert.deepStrictEqual([3, 4, 5].map(m => rs(d, m)), [9.393, 9.528, 0], 'la retenue subie n\'est pas déclarée le mois de l\'encaissement, ou l\'avoir a réécrit mars');
  // Les écritures : le client débité du BRUT à la facture, rien au 4358 ; chaque encaissement le solde.
  const E = core.journalEntries(d, co, { from: '2026-01-01', to: '2026-05-31' }, { sections: ['ventes', 'encaissements'] });
  const f1 = E.filter(x => x.date === '2026-03-10');
  assert.deepStrictEqual([soldeDe(f1, acc.clients), soldeDe(f1, acc.rsSubie)], [1191, 0], 'la facture constate encore la retenue, ou le client n\'est pas débité du brut');
  const p1 = E.filter(x => x.date === '2026-03-20');
  assert.deepStrictEqual([soldeDe(p1, acc.clients), soldeDe(p1, acc.rsSubie)], [-507.608, 7.608]);
  const av = E.filter(x => x.date === '2026-04-10');
  assert.deepStrictEqual([soldeDe(av, acc.clients), soldeDe(av, acc.rsSubie)], [-46.886, -0.714], 'l\'avoir ne régularise pas la retenue dans son écriture');
  assert.strictEqual(soldeDe(E, acc.rsSubie), 18.921);
  assert.strictEqual(soldeDe(E, acc.clients), r3(239 + 358 - 119), 'le 411 ne porte pas le brut de ce qui reste dû');
  // Les attestations : seulement ce que les clients ont DÉJÀ retenu, pour ce montant-là.
  assert.deepStrictEqual(core.attestationsARecevoir(d, co).map(x => [x.number, x.amount]), [['FAC-2026-002', 1.071], ['FAC-2026-001', 17.85]]);
  const todo = core.todoList(d, { ...co, name: 'X', matricule: '1234567A', rib: '00 006 0000123456789 01' }, '2026-06-01').find(x => x.id === 'attestations');
  assert.deepStrictEqual([todo.count, todo.amount], [2, 18.921]);
  // « Ce qui manque » du paquet de mars : deux attestations à RECEVOIR (et la phrase le dit) ; mai n'en a aucune.
  const pm = core.packChecklist(d, co, core.packPeriod(2026, 3)).find(x => x.id === 'attestations');
  assert.ok(pm && pm.count === 2 && /recevoir/.test(pm.label), JSON.stringify(pm));
  assert.ok(!core.packChecklist(d, co, core.packPeriod(2026, 5)).some(x => x.id === 'attestations'));
  // La fiche et le relevé disent le net ; la retenue à subir se dit à côté, et les deux font le compte.
  const fiche = core.clientSummary(d, co, 'c'), rel = core.releveClient(d, 'c', co, { date: '2026-06-01' });
  assert.deepStrictEqual([fiche.net, fiche.rsASubir, rel.total, rel.rsASubir], [588.075, 8.925, 588.075, 8.925]);
  assert.strictEqual(core.clientSummary(d, co, 'lb').rsASubir, -1.785);
  // Rien n'est retenu tant que rien n'est versé : une facture couverte par un avoir sans retenue,
  // jamais payée, ne fait naître aucune retenue — même si ses deux taux ne se répondent pas.
  assert.strictEqual(core.retenueChrono(118.215, 120, [{ key: 'a', date: '2026-04-01', net: 120, brut: 120 }], []).operee, 0);
  const e = ecarts(d);
  assert.deepStrictEqual(e, [], e.join('\n'));
});
};
