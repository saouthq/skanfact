'use strict';
// ============================================================================================
// La caisse — vendre au comptoir (10.15.0, H5 de l'étude Hesabi)
//
// Un ticket est une FACTURE marquée `ticket`, émise et réglée dans le même geste : c'est ce qui rend
// justes, sans les nommer, le journal des ventes, la TVA, le chiffre d'affaires, le stock, la caisse,
// les écritures et le paquet (la vérité comptable le prouve de son côté, par deux chemins et au
// Cabinet). Ce que ces tests tiennent, ici, c'est ce que la caisse a EN PROPRE :
//   • sa série TIC-AAAA-NNN — un ticket ne prend jamais un numéro de facture ;
//   • des montants calculés À LA MAIN (le jeu discrimine : deux taux, rien de rond) ;
//   • ce qui empêche d'encaisser, dit par la MÊME fonction que le bouton éteint ;
//   • les espèces dans la caisse, la carte et le chèque à la banque ;
//   • le bilan du jour, remboursement compris ;
//   • rendre un article : un avoir, l'argent qui sort, et jamais deux fois le même article ;
//   • le code-barres : lu sans espaces ni casse, et jamais deux articles pour un code.
module.exports = ({ t, assert, lireSource }) => {
  const C = require('../../src/renderer/core.js');
  const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

  const CO = { name: 'Épicerie du Port', currency: 'DT', stampFee: 1, regime: 'reel', taxRegime: 'reel', defaultVatRate: 19 };
  const base = () => ({
    company: { ...CO }, documents: [], clients: [], counters: {},
    accounts: [
      { id: 'b', name: 'BIAT', kind: 'banque', isDefault: true },
      { id: 'k', name: 'Caisse', kind: 'caisse' }],
    catalog: [
      { id: 'the', label: 'Thé vert 200 g', unitPrice: 12.5, vatRate: 19, unit: 'u', code: '6191234567890' },
      { id: 'pain', label: 'Pain', unitPrice: 3, vatRate: 7, unit: 'u', code: 'REF-12' }]
  });
  const art = (d, id, qty) => ({ ...C.ligneDePanier(d.catalog.find(c => c.id === id), d.company), qty });

  t('H5 : un ticket a sa série — il ne prend jamais un numéro de facture', () => {
    const d = base();
    d.documents.push({ id: 'f1', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', date: '2026-09-01', lines: [], payments: [] });
    const t1 = C.ticketDeCaisse(d, d.company, [art(d, 'the', 1)], { mode: 'carte', date: '2026-09-02', maintenant: 1 });
    d.documents.push(t1);
    assert.strictEqual(t1.number, 'TIC-2026-001');
    assert.strictEqual(t1.type, 'facture', 'un ticket est une facture : tout ce qui lit une vente le compte');
    assert.ok(C.estTicket(t1) && !C.estTicket(d.documents[0]));
    assert.strictEqual(C.nextNumber(d, 'facture', '2026-09-03'), 'FAC-2026-002', 'le ticket a troué la série des factures');
    assert.strictEqual(C.etatNumerotation(d, 'facture', 2026).prochaine, 'FAC-2026-003');
    assert.strictEqual(C.nextNumber(d, 'ticket', '2026-09-03'), 'TIC-2026-002');
    // Un compteur en retard (une restauration, une fusion de deux postes) repart du plus grand numéro
    // DÉJÀ PRIS de la série : sans ça, le prochain ticket redonnerait TIC-2026-001.
    const d2 = base();
    d2.documents.push({ id: 'x', type: 'facture', ticket: true, number: 'TIC-2026-005', status: 'envoyée', date: '2026-09-01', lines: [], payments: [] });
    assert.strictEqual(C.nextNumber(d2, 'ticket', '2026-09-02'), 'TIC-2026-006', 'un ticket reprend un numéro déjà pris');
    assert.strictEqual(C.etatNumerotation(d2, 'ticket', 2026).prochaine, 'TIC-2026-007');
    assert.strictEqual(C.titreDePiece(t1, d.company), 'Ticket');
    assert.strictEqual(C.titreDePiece(d.documents[0], d.company), C.docLabel('facture', d.company));
  });

  t('H5 : le panier calculé à la main — deux taux, la monnaie rendue, et le timbre quand on le demande', () => {
    // Thé : 2 × 12,500 = 25,000 HT, TVA 19 % = 4,750. Pain : 1 × 3 = 3,000 HT, TVA 7 % = 0,210.
    // HT 28,000 ; TVA 4,960 ; TTC 32,960. Reçu 50 → rendu 17,040.
    const d = base();
    const p = [art(d, 'the', 2), art(d, 'pain', 1)];
    const tt = C.totauxDuPanier(p, d.company, { recu: '50' });
    assert.strictEqual(tt.netHT, 28);
    assert.strictEqual(tt.totalVAT, 4.96);
    assert.strictEqual(tt.stamp, 0, 'pas de timbre par défaut sur un ticket (À VÉRIFIER, réglable)');
    assert.strictEqual(tt.netToPay, 32.96);
    assert.strictEqual(tt.rendu, 17.04);
    assert.strictEqual(tt.manque, 0);
    // La virgule est la décimale de l'utilisateur : « 50,5 » n'est pas « pas un nombre » (H-3).
    assert.strictEqual(C.totauxDuPanier(p, d.company, { recu: '50,5' }).rendu, 17.54);
    assert.strictEqual(C.totauxDuPanier(p, d.company, { recu: '1 000' }).rendu, 967.04);
    assert.strictEqual(C.totauxDuPanier(p, d.company, { recu: '' }).recu, null, 'rien de reçu n\'est pas zéro reçu');
    const avecTimbre = C.totauxDuPanier(p, { ...d.company, caisseTimbre: true }, {});
    assert.strictEqual(avecTimbre.netToPay, 33.96);
    // Et le ticket émis porte exactement ce que le panier annonçait.
    const t1 = C.ticketDeCaisse(d, d.company, p, { mode: 'especes', recu: '50', date: '2026-09-02', maintenant: 1 });
    assert.strictEqual(C.computeTotals(t1, d.company).netToPay, 32.96);
    assert.deepStrictEqual(t1.payments.map(x => [x.amount, x.method, x.accountId]), [[32.96, 'especes', 'k']]);
    assert.deepStrictEqual(t1.caisse, { mode: 'especes', recu: 50, rendu: 17.04 });
    assert.strictEqual(C.invoiceBalance(t1, { ...d, documents: [t1] }, d.company).remaining, 0, 'un ticket naît réglé');
    assert.strictEqual(t1.withholdingRate, 0, 'jamais de retenue à la source au comptoir');
  });

  t('H5 : un régime sans TVA vend au comptoir sans TVA', () => {
    const d = base();
    const forfait = { ...d.company, taxRegime: 'forfaitaire' };
    const l = C.ligneDePanier(d.catalog[0], forfait);
    assert.strictEqual(l.vatRate, 0);
    assert.strictEqual(C.totauxDuPanier([{ ...l, qty: 2 }], forfait).netToPay, 25);
  });

  t('H5 : ce qui empêche d\'encaisser — une phrase, par la fonction qui éteint le bouton', () => {
    const d = base();
    const p = [art(d, 'the', 2), art(d, 'pain', 1)];
    assert.match(C.motifEncaissement(d, d.company, [], {}), /panier est vide/);
    assert.match(C.motifEncaissement(d, d.company, [{ ...p[0], qty: -1 }], {}), /négative/);
    assert.match(C.motifEncaissement(d, d.company, p, { mode: 'especes', recu: '30' }), /Il manque 2,960/);
    assert.match(C.motifEncaissement(d, d.company, p, { mode: 'especes', recu: 'abc' }), /pas un nombre/);
    assert.match(C.motifEncaissement(d, d.company, [...p, { ...p[1], label: 'Produit', unitPrice: 0 }], { mode: 'carte' }), /« Produit » n'a pas de prix/,
      'un article sans prix partirait gratuitement : le stock sort, rien n\'entre');
    assert.strictEqual(C.motifEncaissement(d, d.company, p, { mode: 'especes', recu: '32,960' }), '');
    assert.strictEqual(C.motifEncaissement(d, d.company, p, { mode: 'especes' }), '', 'le reçu est facultatif');
    const sansCaisse = { ...d, accounts: [d.accounts[0]] };
    assert.match(C.motifEncaissement(sansCaisse, d.company, p, { mode: 'especes' }), /Aucun compte de caisse/,
      'des espèces sans caisse iraient à la banque : la Trésorerie ne retomberait jamais sur le tiroir');
    assert.strictEqual(C.motifEncaissement(sansCaisse, d.company, p, { mode: 'carte' }), '', 'la carte va à la banque, la caisse n\'est pas requise');
    // L'écran appelle la même fonction pour le bouton et pour le refus.
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    const i = app.indexOf('routes.caisse = ');
    const z = app.slice(i, app.indexOf('\n  routes.', i + 20));
    assert.ok(z.length > 3000 && z.length < 40000, 'tranche inattendue : ' + z.length);
    assert.ok((z.match(/C\.motifEncaissement\(/g) || []).length >= 3, 'le bouton et le refus ne lisent pas la même règle');
    assert.ok(/\$\{motif \? 'disabled' : ''\}/.test(z), 'le bouton ne s\'éteint pas sur le motif');
  });

  t('H5 : les espèces vont dans la caisse, la carte et le chèque à la banque', () => {
    const d = base();
    assert.deepStrictEqual(C.comptesDeCaisse(d), { especes: 'k', banque: 'b' });
    assert.strictEqual(C.compteDuMode(d, 'especes'), 'k');
    assert.strictEqual(C.compteDuMode(d, 'carte'), 'b');
    assert.strictEqual(C.compteDuMode(d, 'cheque'), 'b');
    const archivee = { ...d, accounts: [d.accounts[0], { ...d.accounts[1], archived: true }] };
    assert.strictEqual(C.comptesDeCaisse(archivee).especes, null, 'une caisse archivée ne reçoit plus rien');
    // Vu à la souris, et ce test gravait le défaut (« sans banque, la carte tombe dans le seul compte ») :
    // rendu par carte, l'argent sortait du TIROIR, qui annonçait 17,850 DT de moins que ce qu'il
    // contenait. La carte et le chèque vont à la banque ou nulle part — et l'encaissement le refuse.
    const seuleCaisse = { ...d, accounts: [{ id: 'k', kind: 'caisse', isDefault: true }] };
    assert.strictEqual(C.compteDuMode(seuleCaisse, 'carte'), null, 'sans banque, la carte tombe dans le tiroir');
    assert.strictEqual(C.compteDuMode(seuleCaisse, 'cheque'), null);
    const p = [art(d, 'the', 1)];
    assert.strictEqual(C.motifEncaissement(seuleCaisse, d.company, p, { mode: 'carte' }), C.MOTIF_SANS_BANQUE);
    assert.strictEqual(C.motifEncaissement(seuleCaisse, d.company, p, { mode: 'especes' }), '', 'les espèces, elles, vont au tiroir');
    // Le remboursement par carte, sans banque : refusé AVANT de prendre le numéro de l'avoir (6.0.0).
    const t1 = C.ticketDeCaisse(seuleCaisse, d.company, p, { mode: 'especes', date: '2026-09-02', maintenant: 1 });
    seuleCaisse.documents = [t1];
    const r = C.remboursementDeTicket(seuleCaisse, d.company, t1, { 0: 1 }, { mode: 'carte', date: '2026-09-02', maintenant: 2 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.motif, C.MOTIF_SANS_BANQUE);
    assert.strictEqual(C.nextNumber(seuleCaisse, 'avoir', '2026-09-02'), 'AVO-2026-001', 'le refus a consommé un numéro d\'avoir');
    // Et le tiroir n'est pas touché par ce qui passe à la banque : un ticket réglé par carte, puis rendu par carte.
    const d2 = base();
    d2.accounts = d2.accounts.map(a => a.id === 'k' ? { ...a, opening: 150, openingDate: '2026-09-01' } : a);
    const tc = C.ticketDeCaisse(d2, d2.company, p, { mode: 'carte', date: '2026-09-02', maintenant: 1 });
    d2.documents.push(tc);
    const rc = C.remboursementDeTicket(d2, d2.company, tc, { 0: 1 }, { mode: 'carte', date: '2026-09-02', maintenant: 2 });
    d2.documents.push(rc.avoir); tc.payments.push(rc.paiement);
    assert.strictEqual(rc.paiement.accountId, 'b');
    const bc = C.bilanCaisse(d2, d2.company, '2026-09-02');
    assert.strictEqual(bc.tiroir, 150, 'la carte a bougé le tiroir');
    assert.strictEqual(bc.parMode.carte, 0);
  });

  t('H5 : le bilan du jour — les tickets, la TVA, et l\'argent mode par mode, remboursement compris', () => {
    const d = base();
    const t1 = C.ticketDeCaisse(d, d.company, [art(d, 'the', 2), art(d, 'pain', 1)], { mode: 'especes', recu: 50, date: '2026-09-02', maintenant: 1 });
    d.documents.push(t1);
    const t2 = C.ticketDeCaisse(d, d.company, [art(d, 'pain', 3)], { mode: 'carte', date: '2026-09-02', maintenant: 2 });
    d.documents.push(t2);
    const t3 = C.ticketDeCaisse(d, d.company, [art(d, 'the', 1)], { mode: 'especes', date: '2026-09-03', maintenant: 3 });
    d.documents.push(t3);
    // t2 : 3 × 3 = 9 HT, TVA 0,630, TTC 9,630.
    const b = C.bilanCaisse(d, d.company, '2026-09-02');
    assert.strictEqual(b.nombre, 2);
    assert.strictEqual(b.total, 42.59);
    assert.strictEqual(b.tva, 5.59);
    assert.strictEqual(b.articles, 6);
    assert.deepStrictEqual(b.parMode, { especes: 32.96, carte: 9.63, cheque: 0 });
    // Le lendemain, on rend un pain de t1 en espèces : 3 × 1,07 = 3,210 sortent de la caisse CE jour-là.
    const r = C.remboursementDeTicket(d, d.company, t1, { 1: 1 }, { mode: 'especes', date: '2026-09-03', maintenant: 4 });
    d.documents.push(r.avoir); t1.payments.push(r.paiement);
    const b3 = C.bilanCaisse(d, d.company, '2026-09-03');
    assert.strictEqual(b3.nombre, 1);
    assert.strictEqual(b3.rembourse, 3.21);
    assert.strictEqual(b3.especes, 11.665, 'thé 14,875 encaissé − pain 3,210 rendu');
    assert.strictEqual(C.bilanCaisse(d, d.company, '2026-09-02').especes, 32.96, 'le remboursement compte au jour où l\'argent sort');
    // Le tiroir, ce soir-là : le fond de caisse (100) + 32,960 le 2 ; + 14,875 − 3,210 le 3.
    const avecFond = { ...d, accounts: d.accounts.map(a => a.id === 'k' ? { ...a, opening: 100, openingDate: '2026-09-01' } : a) };
    assert.strictEqual(C.bilanCaisse(avecFond, d.company, '2026-09-02').tiroir, 132.96, 'le tiroir du soir compte le fond de caisse');
    assert.strictEqual(C.bilanCaisse(avecFond, d.company, '2026-09-03').tiroir, 144.625, 'et les jours précédents');
    assert.strictEqual(C.bilanCaisse({ ...d, accounts: [d.accounts[0]] }, d.company, '2026-09-02').tiroir, null, 'sans caisse, on ne sait pas');
  });

  t('H5 : rendre un article — un avoir, l\'argent qui sort, le stock qui revient, et jamais deux fois le même article', () => {
    const d = base();
    d.catalog[0].tracked = true; d.catalog[0].initialQty = 10; d.catalog[0].initialCost = 8; d.catalog[0].initialDate = '2026-01-01';
    const t1 = C.ticketDeCaisse(d, d.company, [art(d, 'the', 2), art(d, 'pain', 1)], { mode: 'especes', recu: 50, date: '2026-09-02', maintenant: 1 });
    d.documents.push(t1);
    assert.strictEqual(C.stockOf(d, 'the').qty, 8);
    const r = C.remboursementDeTicket(d, d.company, t1, { 0: 1 }, { mode: 'especes', motif: 'Paquet ouvert', date: '2026-09-03', maintenant: 2 });
    assert.ok(r.ok, r.motif);
    // 12,500 HT + 19 % = 14,875 rendus.
    assert.strictEqual(r.montant, 14.875);
    assert.strictEqual(r.avoir.type, 'avoir');
    assert.match(r.avoir.number, /^AVO-2026-/, 'un retour prend un numéro d\'avoir, pas de ticket');
    assert.strictEqual(r.avoir.creditOf, t1.id);
    assert.deepStrictEqual(r.paiement.amount, -14.875);
    assert.strictEqual(r.paiement.accountId, 'k');
    d.documents.push(r.avoir); t1.payments.push(r.paiement);
    assert.strictEqual(C.stockOf(d, 'the').qty, 9, 'l\'article rendu revient sur l\'étagère');
    assert.strictEqual(C.invoiceBalance(t1, d, d.company).remaining, 0, 'un ticket remboursé reste soldé');
    assert.deepStrictEqual(C.resteARendre(d, t1).map(x => x.reste), [1, 1]);
    // On ne rend pas deux fois le même thé : une demande de 5 est bornée au seul qui reste.
    const r2 = C.remboursementDeTicket(d, d.company, t1, { 0: 5 }, { date: '2026-09-04', maintenant: 3 });
    assert.strictEqual(r2.avoir.lines[0].qty, 1);
    d.documents.push(r2.avoir); t1.payments.push(r2.paiement);
    const r3 = C.remboursementDeTicket(d, d.company, t1, { 0: 1 }, { date: '2026-09-04', maintenant: 4 });
    assert.strictEqual(r3.ok, false);
    assert.match(r3.motif, /au moins un article/);
  });

  t('H5 : le code-barres — lu sans espaces ni casse, et jamais deux articles pour un code', () => {
    const d = base();
    assert.strictEqual(C.normCode(' 619 1234 567890 '), '6191234567890');
    assert.strictEqual(C.articleParCode(d, '619 1234 567890').id, 'the');
    assert.strictEqual(C.articleParCode(d, 'ref-12').id, 'pain', 'une référence maison se lit sans la casse');
    assert.strictEqual(C.articleParCode(d, ''), null);
    assert.strictEqual(C.articleParCode(d, '999'), null);
    assert.strictEqual(C.articleVierge().code, '', 'un article naît avec sa case de code');
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    const i = app.indexOf('function catalogForm(');
    const f = app.slice(i, app.indexOf('\n  function ', i + 20));
    assert.ok(/name="code"/.test(f), 'la fiche article n\'a pas de case de code-barres');
    assert.ok(/refus\('#cat-code'/.test(f), 'un code déjà pris par un autre article n\'est pas refusé');
  });

  t('H5 : un ticket vit dans la caisse — pas dans la liste des factures ni dans les documents récents — et se journalise « Ticket »', () => {
    const d = base();
    const t1 = C.ticketDeCaisse(d, d.company, [art(d, 'pain', 1)], { mode: 'carte', date: '2026-09-02', maintenant: 1 });
    d.documents.push(t1);
    const j = C.salesJournal(d, d.company, { from: '2026-09-01', to: '2026-09-30' });
    assert.strictEqual(j.length, 1);
    assert.strictEqual(j[0].typeLabel, 'Ticket');
    assert.strictEqual(j[0].client, C.CLIENT_COMPTOIR, 'une vente sans client est une vente au comptoir, pas une case vide');
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    assert.ok(/\(d\.type === 'facture' && !C\.estTicket\(d\)\) \|\| d\.type === 'avoir'/.test(app), 'la liste des factures montre les tickets');
    assert.ok(/const pieces = data\.documents\.filter\(d => !C\.estTicket\(d\)\)/.test(app), 'les documents récents montrent les tickets');
    // Et les classements par client le rangent sous son nom, jamais sous « — » (trouvé par la vérité
    // comptable : la page Marges ignorait les ventes sans client).
    assert.strictEqual(C.marginBy(d, d.company, '2026-09-01', '2026-09-30', 'client', 0)[0].label, C.CLIENT_COMPTOIR);
    assert.strictEqual(C.topClients(d, d.company, '2026-09-01', '2026-09-30', 5)[0].name, C.CLIENT_COMPTOIR);
    // Les deux classements de clients (accueil et Statistiques) : leur lien ne mène pas à « #/client/ » vide.
    ['${top.map(x => `<li><a class="name" href=', '${clients.map(x => `<li><a class="name" href='].forEach(a => {
      const k = app.indexOf(a);
      assert.ok(k > 0, 'classement introuvable : ' + a);
      assert.ok(/^\$\{x\.clientId \? /.test(app.slice(k + a.length + 1)), 'le classement mène à « #/client/ » vide pour la vente au comptoir');
    });
  });

  t('H5 : le ticket imprimé — le numéro, les lignes TTC, la monnaie, la largeur du papier, et EXEMPLE quand c\'est l\'exemple', () => {
    const d = base();
    const t1 = C.ticketDeCaisse(d, d.company, [art(d, 'the', 2), art(d, 'pain', 1)], { mode: 'especes', recu: 50, date: '2026-09-02', maintenant: 1 });
    const html = C.ticketHtml(t1, d.company, {});
    assert.ok(html.includes('TIC-2026-001'));
    assert.ok(html.includes('Épicerie du Port'));
    assert.ok(html.includes(C.money(29.75, 'DT')), 'la ligne du thé en TTC (2 × 14,875)');
    assert.ok(html.includes(C.money(32.96, 'DT')) && html.includes(C.money(17.04, 'DT')), 'le total et le rendu');
    assert.ok(/size: 80mm/.test(html) && /size: 58mm/.test(C.ticketHtml(t1, { ...d.company, caisseLargeur: 58 }, {})));
    assert.ok(!html.includes('EXEMPLE') && C.ticketHtml(t1, d.company, { exemple: true }).includes('EXEMPLE'));
    assert.ok(C.ticketHtml(t1, { ...d.company, caissePied: 'À bientôt <b>' }, {}).includes('À bientôt &lt;b&gt;'), 'le pied n\'est pas échappé');
  });

  t('H5 : encaisser et rembourser passent les garde-fous AVANT de prendre un numéro', () => {
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    const e = app.slice(app.indexOf('const encaisser = () =>'), app.indexOf('const encaisser = () =>') + 1500);
    const ordre = ['C.motifEncaissement(', 'closedBlock(', "licenceBlock('Émettre un ticket de caisse'", 'C.ticketDeCaisse('].map(x => e.indexOf(x));
    assert.ok(ordre.every(x => x > 0), 'un garde-fou manque : ' + ordre);
    assert.deepStrictEqual(ordre.slice().sort((a, b) => a - b), ordre, 'un garde-fou passe après le numéro (règle 6.0.0)');
    const r = app.slice(app.indexOf("closedBlock(C.today(), 'Ce remboursement')") - 200, app.indexOf("closedBlock(C.today(), 'Ce remboursement')") + 800);
    const o2 = ["closedBlock(C.today(), 'Ce remboursement')", "licenceBlock('Émettre un avoir sur un ticket'", 'C.remboursementDeTicket('].map(x => r.indexOf(x));
    assert.ok(o2.every(x => x > 0), 'un garde-fou manque au remboursement : ' + o2);
    assert.deepStrictEqual(o2.slice().sort((a, b) => a - b), o2);
  });
  t('H5 (vu à la souris) : `vers()` rend une fonction — un appel dont on jette le résultat est un bouton mort', () => {
    // « Créer la caisse » disait « Caisse créée » sous un bandeau « Aucun compte de caisse » resté à sa
    // place, et les onglets de la caisse ne changeaient pas : `vers('#/caisse')` fabriquait la fonction
    // qui redessine, sans jamais l'appeler. Aucun test pur ne le voit ; la forme, si. `vers` s'affecte
    // (`onclick = vers(...)`) ou s'appelle (`vers(...)()`), jamais les deux à moitié.
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    assert.ok(/const vers = \(hash, avant\) => \(\) =>/.test(app), 'vers ne rend plus une fonction : ce test ne garde plus rien');
    const morts = app.split('\n').filter(l => /(^|[;{]\s*)vers\([^()]*(\([^()]*\))?[^()]*\);|=>\s*vers\([^()]*(\([^()]*\))?[^()]*\)\s*[,;)}]/.test(l));
    assert.deepStrictEqual(morts.map(l => l.trim().slice(0, 120)), [], 'des vers() jamais appelés');
  });

  t('H5 (vu à la souris) : les options de modal() vont en QUATRIÈME position, jamais à la place de onDismiss', () => {
    // « Rendre un article… » fermait l'aperçu du ticket et n'ouvrait rien : `{ garde: false }` passé en
    // troisième argument devenait `onDismiss`, et `onDismiss()` levait « is not a function » à la
    // fermeture — l'exception coupait le geste avant la fenêtre suivante. Rien ne s'affiche, et le lint
    // ne voit pas une signature. On lit chaque appel par l'analyseur d'ESLint, dans les deux applications.
    const espree = require('espree');
    const fautes = [];
    for (const f of [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js']]) {
      const ast = espree.parse(lireSource(...f), { ecmaVersion: 'latest', sourceType: 'script', loc: true });
      let appels = 0;
      (function marche(n) {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'modal') {
          appels++;
          const a = n.arguments[2];
          if (a && (a.type === 'ObjectExpression' || (a.type === 'Literal' && a.value !== null))) {
            fautes.push(f.join('/') + ':' + n.loc.start.line + ' (' + a.type + ')');
          }
        }
        for (const k of Object.keys(n)) {
          if (k === 'parent') continue;
          const v = n[k];
          if (Array.isArray(v)) v.forEach(marche); else if (v && typeof v.type === 'string') marche(v);
        }
      })(ast);
      assert.ok(appels > 40, f.join('/') + ' : ' + appels + ' appels de modal() lus — l\'analyseur ne lit plus le fichier');
    }
    assert.deepStrictEqual(fautes, [], 'un appel de modal() passe ses options à la place de onDismiss');
  });

  t('H5 (vu à la souris) : « Rembourser » est éteint tant que rien n\'est choisi, et sa largeur ne pousse pas « Annuler »', () => {
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    const i = app.indexOf('function rendreForm(');
    const f = app.slice(i, app.indexOf('\n  }\n', i));
    assert.ok(f.length > 1500 && f.length < 6000, 'tranche inattendue : ' + f.length);
    assert.ok(/id="ok" disabled style="min-width:\d+em;justify-content:center"/.test(f), 'le bouton naît allumé, ou sans largeur réservée');
    assert.ok(/\$\('#ok', root\)\.disabled = !lignes\.length/.test(f), 'le bouton ne suit pas la quantité choisie');
  });

  t('H5 (vu à la souris) : une caisse créée avant la banque cède le rôle de compte par défaut au premier compte bancaire', () => {
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    const i = app.indexOf('function accountForm(');
    const f = app.slice(i, app.indexOf('\n  function ', i + 20));
    assert.ok(/a\.kind !== 'caisse' && !a\.isDefault/.test(f) && /d\.kind === 'caisse'\) \{ d\.isDefault = false; a\.isDefault = true; \}/.test(f),
      'la caisse reste le compte par défaut : les virements des clients arriveraient dans le tiroir');
  });
};
