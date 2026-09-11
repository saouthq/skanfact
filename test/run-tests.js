// Tests de la logique métier (node test/run-tests.js)
const assert = require('assert');
const core = require('../src/renderer/core.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('montants en lettres', () => {
  assert.strictEqual(core.amountToWords(0), 'Zéro dinar');
  assert.strictEqual(core.amountToWords(1), 'Un dinar');
  assert.strictEqual(core.amountToWords(21), 'Vingt et un dinars');
  assert.strictEqual(core.amountToWords(71), 'Soixante et onze dinars');
  assert.strictEqual(core.amountToWords(80), 'Quatre-vingts dinars');
  assert.strictEqual(core.amountToWords(81), 'Quatre-vingt-un dinars');
  assert.strictEqual(core.amountToWords(91), 'Quatre-vingt-onze dinars');
  assert.strictEqual(core.amountToWords(200), 'Deux cents dinars');
  assert.strictEqual(core.amountToWords(201), 'Deux cent un dinars');
  assert.strictEqual(core.amountToWords(1000), 'Mille dinars');
  assert.strictEqual(core.amountToWords(1500.5), 'Mille cinq cents dinars et cinq cents millimes');
  assert.strictEqual(core.amountToWords(2380.001), 'Deux mille trois cent quatre-vingts dinars et un millime');
  assert.strictEqual(core.amountToWords(1000000), 'Un million dinars');
});

t('calculs facture avec TVA 19% et timbre', () => {
  const company = { ...core.DEFAULT_COMPANY, stampFee: 1 };
  const doc = { type: 'facture', lines: [
    { label: 'Audit', qty: 2, unitPrice: 500, vatRate: 19 },
    { label: 'Licence', qty: 1, unitPrice: 100, vatRate: 7 }
  ] };
  const r = core.computeTotals(doc, company);
  assert.strictEqual(r.totalHT, 1100);
  assert.strictEqual(r.vatByRate[19].vat, 190);
  assert.strictEqual(r.vatByRate[7].vat, 7);
  assert.strictEqual(r.totalVAT, 197);
  assert.strictEqual(r.stamp, 1);
  assert.strictEqual(r.totalTTC, 1298);
});

t('devis : pas de timbre, remise globale', () => {
  const company = { ...core.DEFAULT_COMPANY, stampFee: 1 };
  const doc = { type: 'devis', discountRate: 10, lines: [{ label: 'x', qty: 1, unitPrice: 1000, vatRate: 19 }] };
  const r = core.computeTotals(doc, company);
  assert.strictEqual(r.discount, 100);
  assert.strictEqual(r.netHT, 900);
  assert.strictEqual(r.totalVAT, 171);
  assert.strictEqual(r.stamp, 0);
  assert.strictEqual(r.totalTTC, 1071);
});

t('numérotation continue par année', () => {
  const data = { documents: [], counters: {} };
  assert.strictEqual(core.nextNumber(data, 'devis', '2026-09-11'), 'DEV-2026-001');
  data.documents.push({ type: 'devis', number: 'DEV-2026-001' });
  assert.strictEqual(core.nextNumber(data, 'devis', '2026-09-12'), 'DEV-2026-002');
  assert.strictEqual(core.nextNumber(data, 'facture', '2026-09-12'), 'FAC-2026-001');
  assert.strictEqual(core.nextNumber(data, 'facture', '2027-01-05'), 'FAC-2027-001');
  // compteur perdu mais documents présents : on ne réutilise jamais un numéro
  const data2 = { documents: [{ type: 'facture', number: 'FAC-2026-007' }], counters: {} };
  assert.strictEqual(core.nextNumber(data2, 'facture', '2026-10-01'), 'FAC-2026-008');
});

t('format monétaire', () => {
  assert.strictEqual(core.money(1234567.5, 'DT'), '1 234 567,500 DT');
  assert.strictEqual(core.money(0), '0,000');
});

t('template HTML échappe les entrées', () => {
  const html = core.documentHtml(
    { type: 'facture', number: 'FAC-2026-001', date: '2026-09-11', dueDate: '2026-10-11', lines: [{ label: '<script>alert(1)</script>', qty: 1, unitPrice: 10, vatRate: 19 }] },
    { name: 'Client <b>' }, core.DEFAULT_COMPANY);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Client &lt;b&gt;'));
});

console.log(`\n${n} tests OK`);
