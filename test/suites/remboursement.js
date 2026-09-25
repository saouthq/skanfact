'use strict';
// ============================================================================================
// Le remboursement d'un trop-perçu, et le reste à payer NET d'un client (10.14.0)
//
// Un avoir émis sur une facture déjà payée laisse de l'argent au CLIENT. Jusqu'ici, aucun geste ne
// l'enregistrait : la bulle disait « note la sortie dans Trésorerie, le trop-perçu restera affiché
// ici » — une sortie sans pièce, et une carte d'alerte pour toujours. Et la fiche du client
// annonçait un « reste à payer » qui ne retranchait pas ce qu'on lui doit (1 012,500 DT affichés
// quand il nous devait 505,560 net).
//
// La règle retenue : un remboursement est un RÈGLEMENT NÉGATIF sur la facture. Le signe fait le
// reste, sans qu'aucun agrégateur ait à s'en souvenir (la leçon de la 10.2.0) — et ces tests le
// vérifient en interrogeant chaque agrégateur pour de vrai, pas en lisant le code.
//
// Les données discriminent (9.6.1) : la facture fait 1 000 HT + 19 % + 1 de timbre = 1 191 ; le
// client en paie 1 191 ; un avoir de 300 HT (357 TTC, sans timbre) suit. Trop-perçu : 357 —
// aucune somme ronde ne tombe juste par hasard.
module.exports = ({ t, assert }) => {
  const fs = require('fs');
  const path = require('path');
  const app = fs.readFileSync(path.join(__dirname, '../../src/renderer/app.js'), 'utf8');
  const core = require('../../src/renderer/core.js');

  const société = { ...core.DEFAULT_DATA.company, name: 'Test', currency: 'DT', stampFee: 1, regime: 'reel', paymentTermsDays: 30 };
  const ligne = (pu) => ({ label: 'Prestation', qty: 1, unit: 'u', unitPrice: pu, vatRate: 19 });
  const jeu = (paiements, extra) => core.migrateData({
    ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), company: société,
    clients: [{ id: 'c1', name: 'Client Un' }, { id: 'c2', name: 'Client Deux' }],
    accounts: [{ id: 'b1', name: 'Banque', isDefault: true, opening: 0, openingDate: '2026-01-01' }],
    documents: [
      { id: 'F1', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', clientId: 'c1', date: '2026-03-01', dueDate: '2026-03-31',
        lines: [ligne(1000)], stamp: true, payments: paiements },
      { id: 'A1', type: 'avoir', number: 'AVO-2026-001', status: 'émis', clientId: 'c1', date: '2026-03-10', creditOf: 'F1', stamp: false,
        lines: [ligne(300)] },
      ...(extra || [])
    ]
  });
  const payé = { id: 'p1', date: '2026-03-05', amount: 1191, method: 'virement', accountId: 'b1', reference: '', note: '' };
  const rendu = { id: 'r1', date: '2026-03-20', amount: -357, method: 'virement', accountId: 'b1', reference: 'VIR-9', note: '' };

  t('10.14.0 : le jeu est bien celui qu\'on croit — 357 de trop-perçu avant le remboursement', () => {
    const d = jeu([payé]);
    const b = core.invoiceBalance(d.documents[0], d, société);
    assert.strictEqual(b.totals.netToPay, 1191);
    assert.strictEqual(b.credited, 357);
    assert.strictEqual(b.remaining, -357);
  });

  t('10.14.0 : un remboursement est un règlement négatif — la facture redevient réglée, pas « partielle »', () => {
    const d = jeu([payé, rendu]);
    const f = d.documents[0];
    assert.ok(core.estRemboursement(rendu) && !core.estRemboursement(payé));
    assert.strictEqual(core.invoiceBalance(f, d, société).remaining, 0);
    assert.strictEqual(core.effectiveStatus(f, d, société, '2026-06-01'), 'payée');
  });

  t('10.14.0 : la trésorerie voit une SORTIE, nommée « Remboursement », et le solde du compte suit', () => {
    const d = jeu([payé, rendu]);
    const m = core.cashMovements(d, société, { from: '2026-01-01', to: '2026-12-31' }).find(x => x.id === 'r1');
    assert.ok(m, 'le remboursement doit remonter en trésorerie');
    assert.strictEqual(m.amount, -357);
    assert.strictEqual(m.kind, 'decaissement');
    assert.ok(/^Remboursement FAC-2026-001/.test(m.label), m.label);
    // 1 191 entrés, 357 sortis : 834, calculé à la main.
    assert.strictEqual(core.accountBalance(d, société, 'b1', '2026-12-31').balance, 834);
    const csv = core.cashCsvRows(d, [m])[0];
    assert.strictEqual(csv.kindLabel, 'Remboursement client');
    assert.strictEqual(csv.outAmount, 357);
  });

  t('10.14.0 : l\'écriture du remboursement change de colonne — D client / C banque, et le 411 revient à zéro', () => {
    const d = jeu([payé, rendu]);
    const lignes = core.journalEntries(d, société, { from: '2026-01-01', to: '2026-12-31' });
    const piece = lignes.filter(l => l.source === 'encaissement' && /^Remboursement/.test(l.label));
    assert.strictEqual(piece.length, 2, 'une pièce de deux lignes');
    const client = piece.find(l => l.role === 'clients');
    const banque = piece.find(l => l.role !== 'clients');
    assert.strictEqual(client.debit, 357); assert.strictEqual(client.credit, 0);
    assert.strictEqual(banque.credit, 357); assert.strictEqual(banque.debit, 0);
    const c411 = client.account;
    const solde = core.round3(lignes.filter(l => l.account === c411).reduce((s, l) => s + l.debit - l.credit, 0));
    assert.strictEqual(solde, 0, 'le client est soldé : facture − avoir − paiement + remboursement');
  });

  t('10.14.0 : rendre de l\'argent n\'est pas « le jour où le client a fini de payer » — les délais l\'ignorent', () => {
    const d = jeu([payé, rendu]);
    const f = d.documents[0];
    assert.strictEqual(core.dateDernierReglement(f), '2026-03-05');
    // Délai constaté : du 1er au 5 mars, jamais jusqu'au remboursement du 20.
    assert.strictEqual(core.avgPaymentDelay(d, société, '2026-01-01', '2026-12-31'), 4);
    const rang = core.payerRanking(d, société, 5);
    const tous = [].concat(rang.fast || [], rang.slow || [], Array.isArray(rang) ? rang : []);
    const un = tous.find(r => r.clientId === 'c1');
    if (un) assert.strictEqual(un.delay, 4);
  });

  t('10.14.0 : le relevé montre le trop-perçu en faveur du client, et plus rien une fois rendu', () => {
    const avant = core.releveClient(jeu([payé]), 'c1', société, { date: '2026-06-01' });
    assert.strictEqual(avant.lignes.length, 1);
    assert.strictEqual(avant.lignes[0].type, 'tropPercu');
    assert.strictEqual(avant.total, -357);
    const html = core.releveHtml(avant, société, {});
    assert.ok(/Solde en votre faveur au/.test(html), 'le total dit « en votre faveur »');
    assert.ok(!/Total dû au/.test(html));
    // La ligne de détail garde son signe, comme un avoir libre (c'est un crédit) ; le TOTAL, lui, se
    // lit en toutes lettres : « −357 » sous « Total dû » se prendrait pour une faute de frappe.
    const tot = html.slice(html.indexOf('<tr class="tot">'), html.indexOf('</tr>', html.indexOf('<tr class="tot">')));
    assert.ok(tot.length > 20 && /357/.test(tot) && !/[-−]\s*357/.test(tot), tot);
    const apres = core.releveClient(jeu([payé, rendu]), 'c1', société, { date: '2026-06-01' });
    assert.strictEqual(apres.lignes.length, 0);
    assert.strictEqual(apres.total, 0);
  });

  t('10.14.0 : la fiche du client donne le reste NET — ce qu\'il doit, moins ce qu\'on lui doit', () => {
    // Une seconde facture de 600 HT (715 TTC) non payée : il doit 715, on lui doit 357 → net 358.
    const f2 = { id: 'F2', type: 'facture', number: 'FAC-2026-002', status: 'envoyée', clientId: 'c1', date: '2026-04-01', dueDate: '2026-05-01',
      lines: [ligne(600)], stamp: true, payments: [] };
    const s = core.clientSummary(jeu([payé], [f2]), société, 'c1');
    assert.strictEqual(s.due, 715);
    assert.strictEqual(s.aRendre, 357);
    assert.strictEqual(s.net, 358);
    // Le même chiffre que son relevé : deux écrans, un montant (6.8.1).
    assert.strictEqual(s.net, core.releveClient(jeu([payé], [f2]), 'c1', société, { date: '2026-12-31' }).total);
    // Une fois rendu, il ne reste que la facture due.
    const s2 = core.clientSummary(jeu([payé, rendu], [f2]), société, 'c1');
    assert.strictEqual(s2.aRendre, 0);
    assert.strictEqual(s2.net, 715);
  });

  t('10.14.0 : un avoir LIBRE compte aussi dans ce qu\'on doit au client, comme sur le relevé', () => {
    const libre = { id: 'A2', type: 'avoir', number: 'AVO-2026-002', status: 'émis', clientId: 'c2', date: '2026-04-02', stamp: false, lines: [ligne(100)] };
    const s = core.clientSummary(jeu([payé], [libre]), société, 'c2');
    assert.strictEqual(s.aRendre, 119);
    assert.strictEqual(s.net, -119);
    assert.strictEqual(s.net, core.releveClient(jeu([payé], [libre]), 'c2', société, { date: '2026-12-31' }).total);
  });

  t('10.14.0 : l\'historique de la pièce dit « Remboursement au client », pas « Paiement de −357 »', () => {
    const d = jeu([payé, rendu]);
    const ev = core.documentHistory(d.documents[0], d, société);
    const r = ev.find(e => e.kind === 'paiement' && e.date === '2026-03-20');
    assert.ok(r && /^Remboursement au client de 357/.test(r.label.replace(/ | /g, ' ')), r && r.label);
  });

  t('10.14.0 : l\'écran a le geste — « Rembourser … au client » ouvre la fenêtre en mode remboursement, qui enregistre un montant NÉGATIF', () => {
    const i = app.indexOf('function drawPayments()');
    const zone = app.slice(i, app.indexOf('\n    }\n', i));
    assert.ok(zone.length > 2000 && zone.length < 12000, 'tranche drawPayments : ' + zone.length);
    // Le bouton n'existe que sur un trop-perçu, et il appelle la fenêtre en mode remboursement.
    assert.ok(/b\.remaining < -0\.0005[\s\S]{0,120}id="rembourser"/.test(zone), 'bouton conditionné au trop-perçu');
    assert.ok(/\$\('#rembourser'\)\.onclick = \(\) => paymentForm\(s, [^,]+, null, true\)/.test(zone), 'branché en mode remboursement');
    const j = app.indexOf('function paymentForm(');
    const pf = app.slice(j, app.indexOf('\n  }\n', j));
    assert.ok(pf.length > 2000 && pf.length < 12000, 'tranche paymentForm : ' + pf.length);
    // On tape en positif, on range en négatif — et une modification garde le sens de la pièce.
    assert.ok(/amount: C\.round3\(rend \? -v\.amount : v\.amount\)/.test(pf), 'signe posé à l\'enregistrement');
    assert.ok(/const rend = p0 \? C\.estRemboursement\(p0\) : !!rembourser/.test(pf), 'le sens se relit sur le règlement modifié');
  });

  t('10.14.0 : la liste des clients et la fiche lisent le reste NET, pas le reste brut', () => {
    const i = app.indexOf("{ key: 'due', label: 'Reste à payer'");
    const col = app.slice(i, app.indexOf('\n', app.indexOf("'<span class=\"muted\">—</span>' }", i)));
    assert.ok(i > 0 && /val: r => r\.sum\.net/.test(col), 'la colonne trie sur le net');
    assert.ok(/r\.sum\.net > 0\.0005 : r\.sum\.count === 0/.test(app), 'le filtre « avec un impayé » juge le net');
    assert.ok(!/r\.sum\.due/.test(app), 'plus aucune lecture du reste brut dans la liste');
  });
};
