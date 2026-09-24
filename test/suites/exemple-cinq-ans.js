'use strict';
// ============================================================================================
// L'exemple sur cinq ans (10.14.0), et ce qu'il a fait tomber
//
// Un jeu de treize mois ne fait traverser le 31 décembre à presque aucune facture : les
// à-nouveaux des tiers n'y étaient jamais mis à l'épreuve. Sur cinq ans, une facture de décembre
// réglée en janvier arrivait dans l'exercice suivant par son seul règlement — le lettrage la
// comptait réglée pendant que le compte la comptait due, et la balance auxiliaire relisait le
// passé deux fois. Ces tests tiennent la règle avec des données écrites à la main, puis l'exemple
// lui-même.
module.exports = ({ t, assert }) => {
const core = require('../../src/renderer/core.js');
const demo = require('../../src/renderer/demo.js');

const CO = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', matricule: '1234567A', stampFee: 1 };
const facture = over => ({
  type: 'facture', status: 'envoyée', dueDate: '', clientId: 'c1',
  lines: [{ label: 'Audit', qty: 1, unitPrice: 1000, vatRate: 19 }],
  discountRate: 0, applyStamp: true, payments: [], withholdingRate: 0, ...over
});
// 1 000 HT + 190 de TVA + 1 de timbre : 1 191, calculé à la main (règle 7.0.1).
const TTC = 1191;
function donnees() {
  return core.migrateData({
    company: CO,
    clients: [{ id: 'c1', name: 'Hôtel du Lac' }, { id: 'c2', name: 'Café de Sfax' }],
    documents: [
      // Réglée dans l'exercice : elle ne doit pas rouvrir.
      facture({ id: 'd0', number: 'FAC-2025-008', date: '2025-11-02', clientId: 'c2', payments: [{ id: 'p0', date: '2025-11-20', amount: TTC }] }),
      // Émise en décembre, réglée en janvier.
      facture({ id: 'd1', number: 'FAC-2025-010', date: '2025-12-15', payments: [{ id: 'p1', date: '2026-01-10', amount: TTC }] }),
      // Émise en décembre, réglée en mars : elle traverse janvier ET février.
      facture({ id: 'd2', number: 'FAC-2025-011', date: '2025-12-20', clientId: 'c2', payments: [{ id: 'p2', date: '2026-03-05', amount: TTC }] })
    ]
  });
}

t('10.14.0 : une facture ouverte au 31 décembre rouvre avec son client, son rôle et sa lettre', () => {
  const data = donnees();
  const acc = core.chartAccounts(data);
  const an = core.journalEntries(data, data.company, { from: '2026-01-01', to: '2026-01-01' }, {}).filter(e => e.journal === 'AN');
  const clients = an.filter(e => e.account === acc.clients);
  assert.strictEqual(clients.length, 2, 'une ligne par facture ouverte, rien pour celle réglée dans l\'exercice');
  const hotel = clients.find(e => e.tiersId === 'c1');
  assert.ok(hotel, 'la facture de l\'Hôtel du Lac rouvre sous son client');
  assert.strictEqual(hotel.role, 'clients', 'et avec son rôle : c\'est lui que lisent l\'auxiliaire et le lettrage');
  assert.strictEqual(hotel.lettre, 'FAC-2025-010', 'et avec sa lettre : c\'est elle qui retrouve le règlement de janvier');
  assert.strictEqual(hotel.debit, TTC);
  assert.ok(!an.some(e => e.account === acc.clients && !e.role), 'plus de ligne globale du 411 sans tiers');
  // Le total du compte ne change pas d'un millime.
  const total = core.round3(clients.reduce((s, e) => s + e.debit - e.credit, 0));
  assert.strictEqual(total, 2 * TTC);
});

t('10.14.0 : la balance auxiliaire ouvre au début de l\'EXERCICE — le passé n\'est pas compté deux fois', () => {
  const data = donnees();
  const acc = core.chartAccounts(data);
  // Février : le Café de Sfax ouvre sur sa facture de décembre (une fois), l'Hôtel est soldé.
  const p = core.packPeriod(2026, 2);
  const aux = core.balanceAuxiliaire(data, data.company, p, 'clients', {});
  const cafe = aux.rows.find(r => r.tiersId === 'c2');
  assert.strictEqual(cafe.ouverture, TTC, 'l\'à-nouveau et les écritures de 2025 comptaient la facture deux fois');
  const hotel = aux.rows.find(r => r.tiersId === 'c1');
  assert.ok(!hotel || hotel.solde === 0, 'réglé en janvier, l\'Hôtel du Lac n\'ouvre plus rien en février');
  // Et le contrôle qui fait foi : le total de l'auxiliaire est le collectif de la générale.
  const gen = core.balanceGenerale(data, data.company, p, {}).rows.find(r => r.account === acc.clients);
  assert.strictEqual(core.round3(aux.totals.soldeD - aux.totals.soldeC), gen.solde);
  assert.ok(!aux.rows.some(r => r.tiers === '(sans tiers)'));
  // Janvier : l'à-nouveau est un MOUVEMENT de la période, comme dans la générale.
  const jan = core.balanceAuxiliaire(data, data.company, core.packPeriod(2026, 1), 'clients', {});
  const genJan = core.balanceGenerale(data, data.company, core.packPeriod(2026, 1), {}).rows.find(r => r.account === acc.clients);
  assert.strictEqual(jan.totals.debit, genJan.debit);
  assert.strictEqual(jan.rows.find(r => r.tiersId === 'c1').solde, 0, 'le règlement de janvier solde la facture de décembre');
});

t('10.14.0 : l\'exemple raconte cinq ans, sans date future ni trou de numérotation', () => {
  const T = '2026-09-24';
  const debut = Date.now();
  const data = core.migrateData(demo.buildDemoData(CO, T));
  // Une borne large : ce qui compte, c'est qu'aucune boucle ne s'emballe (règle 5.2.3).
  assert.ok(Date.now() - debut < 5000, 'fabriquer l\'exemple ne doit pas prendre plusieurs secondes');
  const factures = data.documents.filter(d => d.type === 'facture' && d.number);
  const annees = [...new Set(factures.map(d => d.date.slice(0, 4)))].sort();
  assert.ok(annees.length >= 5, `cinq exercices au moins portent des factures (${annees.join(', ')})`);
  const premiere = factures.map(d => d.date).sort()[0];
  const mois = (Number(T.slice(0, 4)) - Number(premiere.slice(0, 4))) * 12 + Number(T.slice(5, 7)) - Number(premiere.slice(5, 7));
  assert.ok(mois >= 58, `la première facture date de ${mois} mois : l'exemple doit remonter à cinq ans`);
  // Chaque année se numérote de 001, sans trou : c'est ce qu'un contrôleur regarde en premier.
  annees.forEach(y => {
    const n = factures.filter(d => d.number.startsWith(`FAC-${y}-`)).map(d => Number(d.number.slice(-3))).sort((a, b) => a - b);
    n.forEach((x, i) => assert.strictEqual(x, i + 1, `FAC-${y} saute du n° ${i} au n° ${x}`));
  });
  // Rien n'est daté après aujourd'hui : ni une pièce, ni un paiement, ni un bulletin.
  data.documents.forEach(d => {
    assert.ok(!d.date || d.date <= T, `${d.number || d.id} est daté du ${d.date}`);
    (d.payments || []).forEach(p => assert.ok(p.date <= T, `un paiement de ${d.number} est daté du ${p.date}`));
  });
  (data.purchases || []).forEach(p => assert.ok(!p.date || p.date <= T, `l'achat ${p.number || p.id} est daté du ${p.date}`));
});

t('10.14.0 : sur cinq ans, chaque exercice de l\'exemple tombe juste — balance et auxiliaire', () => {
  const T = '2026-09-24';
  const data = core.migrateData(demo.buildDemoData(CO, T));
  const acc = core.chartAccounts(data);
  for (let y = 2022; y <= 2026; y++) {
    const p = { from: `${y}-01-01`, to: `${y}-12-31` };
    const b = core.balanceGenerale(data, data.company, p, {});
    assert.ok(b.equilibree, `la balance ${y} doit tomber juste`);
    ['clients', 'fournisseurs'].forEach(role => {
      const aux = core.balanceAuxiliaire(data, data.company, { from: `${y}-06-01`, to: `${y}-06-30` }, role, {});
      const gen = core.balanceGenerale(data, data.company, { from: `${y}-06-01`, to: `${y}-06-30` }, {}).rows
        .find(r => r.account === (role === 'clients' ? acc.clients : acc.fournisseurs));
      assert.strictEqual(core.round3(aux.totals.soldeD - aux.totals.soldeC), gen ? gen.solde : 0, `l'auxiliaire ${role} de juin ${y} doit retrouver son collectif`);
    });
  }
});
};
