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

// ---------- 1.4 : retenue à la source, avoirs, paiements, acompte/solde, journal ----------
const CO = { ...core.DEFAULT_COMPANY, stampFee: 1 };
const inv = (over) => ({ id: 'i1', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', date: '2026-09-01', dueDate: '2026-10-01', clientId: 'c1',
  lines: [{ label: 'Audit', qty: 1, unitPrice: 1000, vatRate: 19 }], discountRate: 0, applyStamp: true, payments: [], withholdingRate: 0, ...(over || {}) });

t('retenue à la source : calculée sur le TTC hors timbre, net à payer', () => {
  const tt = core.computeTotals(inv({ withholdingRate: 1.5 }), CO);
  assert.strictEqual(tt.totalTTC, 1191);         // 1000 + 190 + 1
  assert.strictEqual(tt.withholding, 17.85);     // 1,5 % de 1190
  assert.strictEqual(tt.netToPay, 1173.15);
  assert.strictEqual(core.computeTotals({ ...inv(), type: 'devis', withholdingRate: 5 }, CO).withholding, 0); // jamais sur un devis
});

t('remise globale : les lignes noDiscount (déduction d\'acompte) ne sont pas remisées', () => {
  const tt = core.computeTotals({ type: 'facture', applyStamp: false, discountRate: 10, lines: [
    { label: 'Presta', qty: 1, unitPrice: 1000, vatRate: 19 }, { label: 'Acompte déjà facturé', qty: 1, unitPrice: -300, vatRate: 19, noDiscount: true }] }, CO);
  assert.strictEqual(tt.discount, 100);
  assert.strictEqual(tt.netHT, 600);
  assert.strictEqual(tt.vatByRate[19].base, 600);
  assert.strictEqual(tt.totalVAT, 114);
});

t('paiements et avoirs : statut déduit, reste à payer', () => {
  const data = { documents: [inv()], clients: [] };
  const d = data.documents[0];
  assert.strictEqual(core.effectiveStatus(d, data, CO, '2026-09-15'), 'envoyée');
  assert.strictEqual(core.effectiveStatus(d, data, CO, '2026-10-02'), 'retard');
  d.payments.push({ id: 'p1', date: '2026-09-10', amount: 500, method: 'virement' });
  assert.strictEqual(core.effectiveStatus(d, data, CO, '2026-10-02'), 'partielle');
  assert.strictEqual(core.invoiceBalance(d, data, CO).remaining, 691);
  d.payments.push({ id: 'p2', date: '2026-09-12', amount: 691, method: 'cheque' });
  assert.strictEqual(core.effectiveStatus(d, data, CO, '2026-10-02'), 'payée');
  // avoir total → annulée
  const d2 = inv({ id: 'i2', number: 'FAC-2026-002', payments: [] });
  data.documents.push(d2, { id: 'a1', type: 'avoir', status: 'émis', number: 'AVO-2026-001', creditOf: 'i2', date: '2026-09-05', lines: d2.lines, applyStamp: true, withholdingRate: 0 });
  assert.strictEqual(core.invoiceBalance(d2, data, CO).credited, 1191);
  assert.strictEqual(core.effectiveStatus(d2, data, CO, '2026-09-15'), 'annulée');
  assert.strictEqual(core.isLocked(d2), true);
  assert.strictEqual(core.isLocked({ type: 'facture', status: 'brouillon' }), false);
  assert.strictEqual(core.isLocked({ type: 'devis', status: 'accepté' }), false);
});

t('numérotation des avoirs et des brouillons sans numéro', () => {
  const data = { documents: [{ type: 'facture', number: '', status: 'brouillon' }, { type: 'avoir', number: 'AVO-2026-003' }], counters: {} };
  assert.strictEqual(core.nextNumber(data, 'avoir', '2026-09-11'), 'AVO-2026-004');
  assert.strictEqual(core.nextNumber(data, 'facture', '2026-09-11'), 'FAC-2026-001');
});

t('acompte 30 % puis solde : la somme redonne le devis', () => {
  const quote = { id: 'q', type: 'devis', number: 'DEV-2026-001', subject: 'Projet', discountRate: 10, lines: [
    { label: 'A', qty: 2, unitPrice: 500, vatRate: 19 }, { label: 'B', qty: 3, unitPrice: 100, vatRate: 7 }] };
  const tq = core.computeTotals(quote, CO);
  const depLines = core.depositLines(quote, 30, CO);
  const dep = { type: 'facture', number: 'FAC-2026-010', status: 'envoyée', lines: depLines, discountRate: 0, applyStamp: true };
  const td = core.computeTotals(dep, CO);
  assert.strictEqual(depLines.length, 2);
  assert.strictEqual(td.netHT, core.round3(tq.netHT * 0.3));
  const sold = { type: 'facture', lines: core.settlementLines(quote, [dep]), discountRate: 10, applyStamp: true };
  const ts = core.computeTotals(sold, CO);
  assert.strictEqual(core.round3(td.netHT + ts.netHT), tq.netHT);
  assert.strictEqual(core.round3(td.totalVAT + ts.totalVAT), tq.totalVAT);
});

t('journal des ventes, récap TVA, CSV', () => {
  const data = { clients: [{ id: 'c1', name: 'Client ; "A"' }], documents: [
    inv({ withholdingRate: 1.5 }),
    inv({ id: 'i2', number: 'FAC-2026-002', date: '2026-09-20', lines: [{ label: 'Formation', qty: 2, unitPrice: 150, vatRate: 7 }] }),
    { id: 'a1', type: 'avoir', status: 'émis', number: 'AVO-2026-001', creditOf: 'i2', clientId: 'c1', date: '2026-09-25', lines: [{ label: 'Formation', qty: 1, unitPrice: 150, vatRate: 7 }], applyStamp: false, withholdingRate: 0 },
    inv({ id: 'i3', number: '', status: 'brouillon', date: '2026-09-28' }),
    inv({ id: 'i4', number: 'FAC-2026-004', date: '2026-10-02' })
  ] };
  const rows = core.salesJournal(data, CO, { from: '2026-09-01', to: '2026-09-31', today: '2026-09-30' });
  assert.deepStrictEqual(rows.map(r => r.number), ['FAC-2026-001', 'FAC-2026-002', 'AVO-2026-001']);
  const sum = core.vatSummary(rows);
  assert.strictEqual(sum.ht, 1150);                       // 1000 + 300 − 150
  assert.strictEqual(sum.byRate[19].vat, 190);
  assert.strictEqual(sum.byRate[7].vat, 10.5);            // 21 − 10,5
  assert.strictEqual(sum.timbre, 2);
  assert.strictEqual(sum.rs, 17.85);
  assert.strictEqual(rows[1].status, 'partielle');        // avoir partiel sur FAC-002
  const csv = core.toCsv(rows, [{ key: 'number', label: 'Numéro' }, { key: 'client', label: 'Client' }, { key: 'ht', label: 'HT', type: 'money' }, { key: 'date', label: 'Date', type: 'date' }]);
  assert.ok(csv.startsWith('﻿Numéro;Client;HT;Date'));
  assert.ok(csv.includes('FAC-2026-001;"Client ; ""A""";1000,000;01/09/2026'));
  assert.ok(csv.includes('AVO-2026-001;"Client ; ""A""";-150,000;'));
  const pays = core.paymentsJournal({ clients: [], documents: [inv({ payments: [{ id: 'p', date: '2026-09-03', amount: 100, method: 'cheque', reference: 'CHQ 12' }] })] }, CO, { from: '2026-09-01', to: '2026-09-30' });
  assert.strictEqual(pays.length, 1); assert.strictEqual(pays[0].method, 'Chèque');
});

t('migration 1.x → 2 : « payée » devient un paiement', () => {
  const d = core.migrateData({ version: 1, company: { name: 'X' }, documents: [inv({ status: 'payée', payments: undefined })], clients: [], catalog: [] });
  assert.strictEqual(d.version, 2);
  assert.strictEqual(d.company.name, 'X');
  assert.strictEqual(d.company.paymentTermsDays, 30); // valeurs par défaut fusionnées
  const doc = d.documents[0];
  assert.strictEqual(doc.status, 'envoyée');
  assert.strictEqual(doc.payments.length, 1);
  assert.strictEqual(doc.payments[0].amount, 1191);
  assert.strictEqual(core.effectiveStatus(doc, d, d.company), 'payée');
  assert.strictEqual(core.migrateData(null).documents.length, 0);
});

t('template : avoir, brouillon et retenue à la source', () => {
  const html = core.documentHtml(inv({ number: '', status: 'brouillon', withholdingRate: 1.5 }), { name: 'C' }, CO);
  assert.ok(html.includes('>Brouillon<') && html.includes('stamp draft'));
  assert.ok(html.includes('Retenue à la source 1,5%') && html.includes('1 173,150'));
  const av = core.documentHtml({ type: 'avoir', number: 'AVO-2026-001', status: 'émis', date: '2026-09-11', creditOfNumber: 'FAC-2026-001', lines: [{ label: 'X', qty: 1, unitPrice: 100, vatRate: 19 }] }, { name: 'C' }, CO);
  assert.ok(av.includes('<div class="kind">Avoir</div>') && av.includes('Annule / rectifie') && av.includes("Montant de l'avoir"));
  assert.ok(!av.includes('Timbre fiscal'));
  const paid = core.documentHtml(inv(), { name: 'C' }, { ...CO, rc: 'B123', capital: '1 000 DT' }, { stampText: 'Payée' });
  assert.ok(paid.includes('>Payée<') && paid.includes('RC B123 — Capital 1 000 DT'));
});

// ---------- stockage (src/storage.js) ----------
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStorage, isValidData } = require('../src/storage.js');
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-test-'));

t('stockage : écriture, lecture, refus des données invalides', () => {
  const s = createStorage(tmpDir());
  assert.strictEqual(s.read(), null);
  s.write({ ...core.DEFAULT_DATA, clients: [{ id: 'a', name: 'X' }] });
  assert.strictEqual(s.read().clients[0].name, 'X');
  assert.ok(!fs.existsSync(s.file + '.tmp'));
  assert.throws(() => s.write('pas un objet'));
  assert.throws(() => s.write({ documents: 'oops' }));
  assert.strictEqual(isValidData(null), false);
  assert.strictEqual(isValidData({}), true);
});

t('stockage : fichier illisible mis de côté, jamais écrasé', () => {
  const s = createStorage(tmpDir());
  fs.mkdirSync(path.dirname(s.file), { recursive: true });
  fs.writeFileSync(s.file, '{ ceci n\'est pas du JSON');
  assert.strictEqual(s.read(), null);
  assert.ok(s.state.corruptFile && fs.existsSync(s.state.corruptFile));
  assert.ok(fs.readFileSync(s.state.corruptFile, 'utf8').includes('ceci n'));
  assert.ok(!fs.existsSync(s.file));
  s.write(core.DEFAULT_DATA); // repart sur un fichier neuf, l'ancien est conservé
  assert.ok(fs.existsSync(s.state.corruptFile));
});

t('stockage : sauvegarde quotidienne = état de début de journée', () => {
  let day = new Date('2026-09-11T09:00:00');
  const s = createStorage(tmpDir(), { now: () => day });
  s.write({ ...core.DEFAULT_DATA, clients: [{ id: '1', name: 'matin' }] });
  assert.deepStrictEqual(s.listBackups(), []); // premier fichier : rien à sauvegarder
  s.write({ ...core.DEFAULT_DATA, clients: [{ id: '1', name: 'midi' }] });
  s.write({ ...core.DEFAULT_DATA, clients: [{ id: '1', name: 'soir' }] });
  const b = s.listBackups();
  assert.strictEqual(b.length, 1);
  assert.strictEqual(b[0].name, 'skanfact-2026-09-11.json');
  assert.strictEqual(JSON.parse(fs.readFileSync(b[0].path, 'utf8')).clients[0].name, 'matin');
  day = new Date('2026-09-12T09:00:00');
  s.write({ ...core.DEFAULT_DATA, clients: [{ id: '1', name: 'lendemain' }] });
  const b2 = s.listBackups().map(x => x.name).sort();
  assert.deepStrictEqual(b2, ['skanfact-2026-09-11.json', 'skanfact-2026-09-12.json']);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(s.backupDir, 'skanfact-2026-09-12.json'), 'utf8')).clients[0].name, 'soir');
  const named = s.backupNow('avant-import');
  assert.ok(/avant-import-2026-09-12_/.test(path.basename(named)));
});

t('stockage : rotation à 30 sauvegardes quotidiennes', () => {
  let day = new Date('2026-01-01T09:00:00');
  const s = createStorage(tmpDir(), { now: () => day });
  for (let i = 0; i < 40; i++) {
    s.write({ ...core.DEFAULT_DATA, counters: { i } });
    day = new Date(day.getTime() + 86400000);
  }
  const names = s.listBackups().map(x => x.name).sort();
  assert.strictEqual(names.length, 30);
  assert.strictEqual(names[0], 'skanfact-2026-01-11.json'); // 39 créées (pas de copie au 1er jour), 30 gardées
});

t('stockage : import externe validé', () => {
  const s = createStorage(tmpDir());
  const p = path.join(tmpDir(), 'x.json');
  fs.writeFileSync(p, JSON.stringify({ clients: [], documents: [] }));
  assert.ok(s.readExternal(p));
  fs.writeFileSync(p, JSON.stringify([1, 2, 3]));
  assert.throws(() => s.readExternal(p), /export SkanFact/);
});

console.log(`\n${n} tests OK`);
