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
  assert.strictEqual(d.version, 3);
  assert.deepStrictEqual([d.recurring, d.templates, d.snippets], [[], [], []]);
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

// ---------- 1.5 : récurrences, relances, emails ----------
t('récurrences : dates (fin de mois, trimestre, année) et échéances dues', () => {
  assert.strictEqual(core.addMonths('2026-01-31', 1, 31), '2026-02-28');
  assert.strictEqual(core.addMonths('2026-02-28', 1, 31), '2026-03-31');
  assert.strictEqual(core.nextRecurrenceDate('2026-11-15', 'month', 15), '2026-12-15');
  assert.strictEqual(core.nextRecurrenceDate('2026-11-15', 'quarter', 1), '2027-02-01');
  assert.strictEqual(core.nextRecurrenceDate('2026-02-29', 'year', 29), '2027-02-28');
  assert.strictEqual(core.monthLabel('2026-09-11'), 'septembre 2026');
  const data = { recurring: [{ id: 'r1', nextDate: '2026-09-01', active: true }, { id: 'r2', nextDate: '2026-10-01', active: true }, { id: 'r3', nextDate: '2026-08-01', active: false }] };
  assert.deepStrictEqual(core.dueRecurrences(data, '2026-09-11').map(r => r.id), ['r1']);
  const inv = core.buildRecurringInvoice({ id: 'r1', clientId: 'c', subject: 'Maintenance — {mois}', lines: [{ label: 'Supervision {mois}', qty: 1, unitPrice: 250, vatRate: 19 }], withholdingRate: 1.5 }, '2026-09-01', CO);
  assert.strictEqual(inv.subject, 'Maintenance — septembre 2026');
  assert.strictEqual(inv.lines[0].label, 'Supervision septembre 2026');
  assert.strictEqual(inv.dueDate, '2026-10-01');
  assert.strictEqual(inv.status, 'brouillon'); assert.strictEqual(inv.number, '');
});

t('relances : factures échues, niveaux, gabarits d\'email', () => {
  const data = { clients: [{ id: 'c1', name: 'ACME', email: 'compta@acme.tn' }], documents: [
    inv({ id: 'i1', number: 'FAC-2026-001', dueDate: '2026-08-01', clientId: 'c1' }),
    inv({ id: 'i2', number: 'FAC-2026-002', dueDate: '2026-09-05', clientId: 'c1', payments: [{ id: 'p', date: '2026-09-06', amount: 1191 }] }),
    inv({ id: 'i3', number: 'FAC-2026-003', dueDate: '2026-12-01', clientId: 'c1' }),
    inv({ id: 'i4', number: '', status: 'brouillon', dueDate: '2026-01-01' })
  ] };
  const od = core.overdueInvoices(data, CO, '2026-09-11');
  assert.deepStrictEqual(od.map(x => x.doc.number), ['FAC-2026-001']);
  assert.strictEqual(od[0].daysLate, 41); assert.strictEqual(od[0].level, 2);
  assert.strictEqual(core.reminderLevel(3), 1); assert.strictEqual(core.reminderLevel(60), 3);
  const m = core.emailFor('relance2', od[0].doc, data.clients[0], CO, { jours: od[0].daysLate });
  assert.strictEqual(m.to, 'compta@acme.tn');
  assert.strictEqual(m.subject, 'Relance — facture FAC-2026-001 en retard de 41 jours');
  assert.ok(m.body.includes('1 191,000 DT') && m.body.includes('01/08/2026') && m.body.endsWith(CO.name));
  const custom = core.emailFor('facture', od[0].doc, data.clients[0], { ...CO, emailTemplates: { facture: { subject: 'Hello {client}', body: 'x' } } });
  assert.strictEqual(custom.subject, 'Hello ACME');
  assert.strictEqual(core.fillTemplate('{a}-{b}-{c}', { a: 1, b: 'deux' }), '1-deux-{c}');
});

// ---------- 1.6 : anglais, devises, tableau de bord ----------
t('anglais : montant en lettres, format des nombres, template', () => {
  assert.strictEqual(core.intToWordsEn(1191), 'one thousand one hundred and ninety-one');
  assert.strictEqual(core.intToWordsEn(2000015), 'two million fifteen');
  assert.strictEqual(core.amountToWords(1191.15, 'EUR', 'en'), 'One thousand one hundred and ninety-one euros and fifteen cents');
  assert.strictEqual(core.amountToWords(2.5, 'EUR', 'fr'), 'Deux euros et cinquante centimes');
  assert.strictEqual(core.amountToWords(1.001, 'DT', 'en'), 'One dinar and one millime');
  assert.strictEqual(core.money(1234.5, 'EUR'), '1 234,50 EUR');
  assert.strictEqual(core.money(1234.5, 'DT'), '1 234,500 DT');
  assert.strictEqual(core.money(1234567.891, null, 2, 'en'), '1,234,567.89');
  const html = core.documentHtml({ ...inv(), lang: 'en', currency: 'EUR', exchangeRate: 3.4, withholdingRate: 0 }, { name: 'ACME Ltd', matricule: 'GB123' }, CO);
  assert.ok(html.includes('<div class="kind">Invoice</div>') && html.includes('Billed to') && html.includes('Amount due') && html.includes('Stamp duty'));
  assert.ok(html.includes('1,191.00') && html.includes('<small>EUR</small>') && html.includes('1 EUR = 3,400 DT'));
  assert.ok(html.includes('Total amount in words:') && html.includes('one thousand one hundred and ninety-one euros'));
  assert.ok(html.includes('Tax ID GB123') && html.includes('Payment by bank transfer'));
  const draft = core.documentHtml({ ...inv(), lang: 'en', number: '', status: 'brouillon' }, { name: 'X' }, CO);
  assert.ok(draft.includes('>Draft<'));
  const paid = core.documentHtml({ ...inv(), lang: 'en' }, { name: 'X' }, { ...CO, stampImage: 'data:image/png;base64,AAAA' }, { stampText: 'Payée' });
  assert.ok(paid.includes('>Paid<') && paid.includes('src="data:image/png;base64,AAAA"'));
  const fr = core.documentHtml(inv(), { name: 'X' }, CO);
  assert.ok(fr.includes('<div class="kind">Facture</div>') && fr.includes('1 191,000'));
});

t('devises : conversion dans le journal et le tableau de bord', () => {
  const data = { clients: [{ id: 'c1', name: 'ACME' }, { id: 'c2', name: 'Local' }], documents: [
    inv({ id: 'e1', number: 'FAC-2026-001', clientId: 'c1', currency: 'EUR', exchangeRate: 3.4, date: '2026-09-02', payments: [{ id: 'p', date: '2026-09-10', amount: 1191 }] }),
    inv({ id: 'l1', number: 'FAC-2026-002', clientId: 'c2', date: '2026-08-15', lines: [{ label: 'x', qty: 1, unitPrice: 500, vatRate: 19 }] }),
    { id: 'q1', type: 'devis', number: 'DEV-2026-001', status: 'accepté', date: '2026-08-01', lines: [] },
    { id: 'q2', type: 'devis', number: 'DEV-2026-002', status: 'refusé', date: '2026-08-05', lines: [] },
    { id: 'q3', type: 'devis', number: 'DEV-2026-003', status: 'envoyé', date: '2026-09-05', lines: [] }
  ] };
  const rows = core.salesJournal(data, CO, { from: '2026-09-01', to: '2026-09-30', today: '2026-09-11' });
  assert.strictEqual(rows[0].ht, 3400); assert.strictEqual(rows[0].currency, 'EUR'); assert.strictEqual(rows[0].rate, 3.4);
  const series = core.monthlySeries(data, CO, '2026-09-11', 12);
  assert.strictEqual(series.length, 12);
  assert.strictEqual(series[11].month, '2026-09'); assert.strictEqual(series[11].invoiced, 3400); assert.strictEqual(series[11].collected, core.round3(1191 * 3.4));
  assert.strictEqual(series[10].invoiced, 500);
  assert.deepStrictEqual(core.topClients(data, CO, '2026-01-01', '2026-12-31', 5).map(x => [x.name, x.ht]), [['ACME', 3400], ['Local', 500]]);
  assert.deepStrictEqual(core.quoteStats(data, '2026-01-01', '2026-12-31', '2026-09-11'), { total: 3, accepted: 1, refused: 1, expired: 0, pending: 1, rate: 50 });
  assert.strictEqual(core.avgPaymentDelay(data, CO, '2026-01-01', '2026-12-31'), 8);
  assert.strictEqual(core.monthKeys('2026-01-15', 3).join(','), '2025-11,2025-12,2026-01');
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

t('chiffrement : aller-retour, mauvais mot de passe, fichier verrouillé, sauvegardes converties', () => {
  const { isEncrypted, encryptData, decryptData } = require('../src/storage.js');
  const env = encryptData({ a: 1 }, 'secret');
  assert.ok(isEncrypted(env) && !JSON.stringify(env).includes('"a":1'));
  assert.deepStrictEqual(decryptData(env, 'secret'), { a: 1 });
  assert.throws(() => decryptData(env, 'wrong'));
  let day = new Date('2026-09-11T09:00:00');
  const s = createStorage(tmpDir(), { now: () => day });
  s.write({ ...core.DEFAULT_DATA, clients: [{ id: 'a', name: 'X' }] });
  s.write({ ...core.DEFAULT_DATA, clients: [{ id: 'a', name: 'X2' }] }); // crée la sauvegarde du jour (en clair)
  assert.strictEqual(s.listBackups().length, 1);
  s.setPassword(s.read(), 'pw');
  assert.ok(isEncrypted(JSON.parse(fs.readFileSync(s.file, 'utf8'))), 'fichier chiffré');
  assert.ok(isEncrypted(JSON.parse(fs.readFileSync(s.listBackups()[0].path, 'utf8'))), 'sauvegarde chiffrée aussi');
  assert.strictEqual(s.read().clients[0].name, 'X2'); // clé en mémoire
  s.lock();
  assert.deepStrictEqual(s.read(), { locked: true });
  assert.throws(() => s.write(core.DEFAULT_DATA), /verrouill/);
  assert.strictEqual(s.unlock('bad').ok, false);
  const u = s.unlock('pw'); assert.ok(u.ok && u.data.clients[0].name === 'X2');
  s.write({ ...u.data, clients: [] }); s.lock();
  assert.strictEqual(s.unlock('pw').data.clients.length, 0);
  // changement puis retrait : sauvegardes reconverties, fichier en clair
  s.setPassword(s.read(), 'pw2'); s.lock(); assert.ok(s.unlock('pw2').ok);
  s.setPassword(s.read(), '');
  assert.ok(!isEncrypted(JSON.parse(fs.readFileSync(s.file, 'utf8'))) && s.state.encrypted === false);
  assert.ok(!isEncrypted(JSON.parse(fs.readFileSync(s.listBackups()[0].path, 'utf8'))), 'sauvegarde redevenue lisible');
  assert.strictEqual(s.read().clients.length, 0);
  // import d'un fichier chiffré : mot de passe requis
  const p = path.join(tmpDir(), 'x.json');
  fs.writeFileSync(p, JSON.stringify(encryptData({ documents: [] }, 'zzz')));
  assert.throws(() => s.readExternal(p), /chiffré/);
  assert.deepStrictEqual(s.readExternal(p, 'zzz'), { documents: [] });
  assert.throws(() => s.readExternal(p, 'nope'));
});

t('copie externe : miroir du fichier et des sauvegardes, support absent signalé', () => {
  const ext = tmpDir();
  const s = createStorage(tmpDir());
  s.write(core.DEFAULT_DATA);
  s.setExternalDir(ext);
  assert.ok(fs.existsSync(path.join(ext, 'SkanFact', 'skanfact-data.json')));
  assert.ok(s.state.external.lastCopy && !s.state.external.lastError);
  s.backupNow('manuelle');
  assert.strictEqual(fs.readdirSync(path.join(ext, 'SkanFact', 'backups')).length, 1);
  s.write({ ...core.DEFAULT_DATA, counters: { x: 1 } });
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(ext, 'SkanFact', 'skanfact-data.json'), 'utf8')).counters.x, 1);
  s.setExternalDir(path.join(ext, 'debranche'));
  s.write(core.DEFAULT_DATA); // ne bloque pas
  assert.ok(/introuvable/.test(s.state.external.lastError));
  s.setExternalDir(null); s.write(core.DEFAULT_DATA); assert.strictEqual(s.state.external.lastError, null);
});

// ---------- jeu de démonstration (src/renderer/demo.js) ----------
const { buildDemoData } = require('../src/renderer/demo.js');

t('démo : cohérente quelle que soit la date du jour, société conservée', () => {
  ['2026-09-11', '2026-09-01', '2026-01-31', '2026-03-01', '2026-12-31', '2027-02-28', '2028-02-29'].forEach(T => {
    const d = buildDemoData({ name: 'Ma société', logo: 'data:logo', theme: 'dark', phone: '' }, T);
    assert.ok(isValidData(d) && d.version === 3);
    assert.strictEqual(d.company.name, 'Ma société', 'la démo ne remplace jamais le nom déjà saisi');
    assert.strictEqual(d.company.logo, 'data:logo'); assert.strictEqual(d.company.theme, 'dark');
    assert.strictEqual(d.company.phone, '+216 55 123 456'); // champ vide complété, le reste conservé
    JSON.parse(JSON.stringify(d));
    assert.ok(d.clients.length >= 8 && d.catalog.length >= 10 && d.recurring.length === 3 && d.templates.length === 3 && d.snippets.length === 3);
    // numéros uniques et continus par type et par année, dans l'ordre des dates
    ['devis', 'facture', 'avoir'].forEach(type => {
      const byYear = {};
      d.documents.filter(x => x.type === type && x.number).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
        .forEach(x => { const y = x.number.slice(4, 8); (byYear[y] = byYear[y] || []).push(Number(x.number.slice(9))); });
      Object.values(byYear).forEach(seq => assert.deepStrictEqual(seq, seq.map((_, i) => i + 1), `${type} ${T}`));
    });
    d.documents.forEach(x => { if (x.type === 'devis') assert.ok(x.number); else assert.strictEqual(!!x.number, x.status !== 'brouillon', x.subject); });
    // aucun paiement dans le futur ni trop-perçu
    d.documents.forEach(x => (x.payments || []).forEach(p => { assert.ok(p.date <= T && p.date >= x.date, `paiement ${x.number} ${p.date} (${T})`); assert.ok(p.amount > 0); }));
    d.documents.filter(x => x.type === 'facture').forEach(x => assert.ok(core.invoiceBalance(x, d, d.company).remaining >= -0.0005, 'trop-perçu ' + x.number));
    // tous les cas de figure présents
    const st = new Set(d.documents.filter(x => x.type === 'facture').map(x => core.effectiveStatus(x, d, d.company, T)));
    ['brouillon', 'envoyée', 'partielle', 'retard', 'payée', 'annulée'].forEach(s => assert.ok(st.has(s), `${s} manquant (${T})`));
    const qs = new Set(d.documents.filter(x => x.type === 'devis').map(x => x.status));
    ['brouillon', 'envoyé', 'accepté', 'refusé'].forEach(s => assert.ok(qs.has(s), s));
    assert.strictEqual(d.documents.filter(x => x.type === 'avoir' && x.status === 'émis').length, 2);
    assert.ok(d.documents.some(x => x.type === 'devis' && x.status === 'envoyé' && x.dueDate < T), 'devis expiré');
    // relances aux trois niveaux (la plus ancienne a déjà reçu deux relances), un contrat dû, onze mois pleins
    const od = core.overdueInvoices(d, d.company, T);
    assert.ok([1, 2, 3].every(l => od.some(x => x.level === l)), 'niveaux ' + od.map(x => x.level));
    assert.strictEqual(od[0].level, 3); assert.deepStrictEqual(od[0].reminders.map(r => r.level), [1, 2]); assert.strictEqual(od[0].doc.emails.length, 3);
    // une relance téléphonique notée et une relance reportée figurent dans le jeu de démo
    assert.ok(od.some(x => x.snoozed), 'aucune relance reportée');
    assert.ok(d.documents.some(x => (x.reminders || []).some(r => r.channel === 'tel' && r.note)), 'aucune relance téléphonique');
    const todoIds = core.todoList(d, d.company, T).map(x => x.id);
    assert.ok(todoIds.length >= 5, 'panneau À faire vide');
    assert.ok(todoIds.includes('devis-acceptes'), 'la démo doit contenir un devis accepté non facturé');
    assert.ok(!todoIds.includes('societe'), 'la société de démo est complète');
    assert.strictEqual(core.dueRecurrences(d, T).length, 1);
    assert.ok(core.monthlySeries(d, d.company, T, 12).slice(0, 11).every(m => m.invoiced > 0));
    assert.ok(core.avgPaymentDelay(d, d.company, core.addMonths(T, -12, 1), T) > 0);
    assert.ok(core.topClients(d, d.company, core.addMonths(T, -12, 1), T, 5).length >= 5); // sur douze mois glissants, au moins cinq clients facturés
  });
});

t('démo : acompte + solde, avoir total, client étranger en euros', () => {
  const T = '2026-09-11';
  const d = buildDemoData(null, T);
  assert.ok(/DÉMO/.test(d.company.name), 'la démo doit se donner un nom quand aucune société n\'est renseignée');
  const dep = d.documents.find(x => x.deposit), sold = d.documents.find(x => x.settles), quote = d.documents.find(x => x.id === dep.deposit.quoteId);
  assert.strictEqual(dep.deposit.quoteNumber, quote.number); assert.strictEqual(sold.settles.depositIds[0], dep.id);
  assert.ok(sold.lines.some(l => l.noDiscount && l.unitPrice < 0));
  const tq = core.computeTotals(quote, d.company);
  assert.strictEqual(core.round3(core.computeTotals(dep, d.company).netHT + core.computeTotals(sold, d.company).netHT), tq.netHT);
  const cancelled = d.documents.find(x => x.type === 'facture' && core.effectiveStatus(x, d, d.company, T) === 'annulée');
  const av = d.documents.find(x => x.type === 'avoir' && x.creditOf === cancelled.id);
  assert.strictEqual(av.creditOfNumber, cancelled.number); assert.strictEqual(av.applyStamp, true);
  const nova = d.documents.find(x => x.type === 'facture' && x.currency === 'EUR');
  assert.strictEqual(nova.lang, 'en'); assert.strictEqual(nova.applyStamp, false); assert.strictEqual(core.computeTotals(nova, d.company).totalVAT, 0);
  const html = core.documentHtml(nova, d.clients.find(c => c.id === nova.clientId), d.company);
  assert.ok(html.includes('<div class="kind">Invoice</div>') && html.includes('<small>EUR</small>') && !html.includes('Stamp duty') && html.includes('1 EUR = 3,350 DT'));
  const row = core.salesJournal(d, d.company, { from: nova.date, to: nova.date, today: T }).find(r => r.id === nova.id);
  assert.strictEqual(row.ht, core.round3(1100 * 3.35));
  const pending = d.documents.filter(x => x.type === 'facture' && x.status !== 'brouillon' && core.computeTotals(x, d.company).withholding > 0 && !x.withholdingCertificate);
  assert.ok(pending.length >= 3 && d.documents.some(x => x.withholdingCertificate));
  d.documents.filter(x => x.type !== 'devis' && x.number).forEach(x => assert.ok(core.documentHtml(x, d.clients.find(c => c.id === x.clientId), d.company).length > 1000));
});

t('devis : « expiré » déduit de la date de validité, sans toucher au statut enregistré', () => {
  const q = { id: 'q1', type: 'devis', number: 'DEV-2026-001', status: 'envoyé', date: '2026-08-01', dueDate: '2026-08-31', lines: [] };
  const data = { documents: [q], clients: [] };
  assert.strictEqual(core.effectiveStatus(q, data, CO, '2026-08-15'), 'envoyé');
  assert.strictEqual(core.effectiveStatus(q, data, CO, '2026-09-15'), 'expiré');
  assert.strictEqual(q.status, 'envoyé', 'le statut enregistré ne bouge pas');
  assert.strictEqual(core.effectiveStatus({ ...q, status: 'accepté' }, data, CO, '2026-09-15'), 'accepté');
  assert.strictEqual(core.effectiveStatus({ ...q, status: 'brouillon' }, data, CO, '2026-09-15'), 'brouillon');
  assert.ok(core.DISPLAY_STATUSES.devis.includes('expiré'));
  assert.strictEqual(core.quoteStats(data, '2026-01-01', '2026-12-31', '2026-09-15').expired, 1);
});

t('fiche client : facturé, reste à payer, délai, conversion', () => {
  const data = {
    clients: [{ id: 'c1', name: 'ACME' }, { id: 'c2', name: 'Autre' }],
    documents: [
      inv({ id: 'i1', clientId: 'c1', number: 'FAC-2026-001', date: '2026-03-01', payments: [{ id: 'p', date: '2026-03-21', amount: 1191 }] }),
      inv({ id: 'i2', clientId: 'c1', number: 'FAC-2026-002', date: '2026-04-01', payments: [{ id: 'p2', date: '2026-04-11', amount: 500 }] }),
      inv({ id: 'i3', clientId: 'c1', number: '', status: 'brouillon', date: '2026-05-01' }),
      inv({ id: 'i4', clientId: 'c2', number: 'FAC-2026-003', date: '2026-05-01' }),
      { id: 'q1', type: 'devis', clientId: 'c1', number: 'DEV-2026-001', status: 'accepté', date: '2026-02-01', lines: [] },
      { id: 'q2', type: 'devis', clientId: 'c1', number: 'DEV-2026-002', status: 'refusé', date: '2026-02-05', lines: [] }
    ]
  };
  const s = core.clientSummary(data, CO, 'c1');
  assert.strictEqual(s.count, 5);                       // le brouillon compte comme document
  assert.strictEqual(s.invoiceCount, 2);                // mais pas comme facture
  assert.strictEqual(s.ht, 2000);                       // deux factures émises à 1000 HT
  assert.strictEqual(s.paid, 1691);
  assert.strictEqual(s.due, 691);                       // 1191 − 500 sur la deuxième
  assert.strictEqual(s.delay, 20);                      // seule la facture soldée compte
  assert.strictEqual(s.conversion, 50);
  assert.strictEqual(s.first, '2026-02-01'); assert.strictEqual(s.last, '2026-05-01');
  assert.strictEqual(core.clientSummary(data, CO, 'inconnu').count, 0);
});

t('contact du client imprimé sur le document', () => {
  const html = core.documentHtml(inv(), { name: 'ACME', contact: 'Me Sonia Ben Salah', matricule: '123' }, CO);
  assert.ok(html.includes('Me Sonia Ben Salah'));
});

t('à faire : ce qui demande une action, par ordre d\'urgence', () => {
  const T = '2026-09-11';
  const data = {
    clients: [{ id: 'c1', name: 'ACME' }],
    documents: [
      inv({ id: 'i1', clientId: 'c1', number: 'FAC-2026-001', date: '2026-06-01', dueDate: '2026-07-01' }),                       // en retard
      inv({ id: 'i2', clientId: 'c1', number: 'FAC-2026-002', date: '2026-09-05', dueDate: '2026-09-15' }),                       // échéance cette semaine
      inv({ id: 'i3', clientId: 'c1', number: 'FAC-2026-003', date: '2026-08-01', dueDate: '2026-09-30', withholdingRate: 1.5 }), // attestation à réclamer
      inv({ id: 'i4', clientId: 'c1', number: '', status: 'brouillon', date: '2026-08-20' }),                                     // vieux brouillon
      { id: 'q1', type: 'devis', clientId: 'c1', number: 'DEV-2026-001', status: 'envoyé', date: '2026-07-01', dueDate: '2026-08-01', lines: [] }, // expiré
      { id: 'q2', type: 'devis', clientId: 'c1', number: 'DEV-2026-002', status: 'envoyé', date: '2026-08-20', dueDate: '2026-10-20', lines: [] },  // sans réponse
      { id: 'q3', type: 'devis', clientId: 'c1', number: 'DEV-2026-003', status: 'accepté', date: '2026-08-25', dueDate: '2026-09-25', lines: [{ label: 'x', qty: 1, unitPrice: 1000, vatRate: 19 }] }, // accepté, pas facturé
      { id: 'q4', type: 'devis', clientId: 'c1', number: 'DEV-2026-004', status: 'accepté', date: '2026-08-25', dueDate: '2026-09-25', lines: [] }, // accepté et déjà facturé (brouillon i5)
      inv({ id: 'i5', clientId: 'c1', number: '', status: 'brouillon', date: T, fromQuoteId: 'q4', fromQuoteNumber: 'DEV-2026-004' })
    ],
    recurring: [{ id: 'r1', clientId: 'c1', subject: 'Maintenance — {mois}', lines: [], nextDate: '2026-09-01', active: true }]
  };
  const FULL = { ...CO, name: 'ACME', matricule: '1234567A', rib: '12 345' };
  const todo = core.todoList(data, FULL, T);
  const ids = todo.map(x => x.id);
  assert.deepStrictEqual(ids, ['retards', 'contrats', 'devis-acceptes', 'devis-expires', 'devis-sans-reponse', 'attestations', 'echeances', 'brouillons']);
  assert.strictEqual(todo[0].level, 'danger');
  assert.strictEqual(todo[0].count, 1);
  assert.ok(todo[0].detail.includes('72 jours'));
  assert.ok(todo[0].detail.includes('1 191,000 DT'), 'montant non formaté : ' + todo[0].detail);
  assert.ok(todo.find(x => x.id === 'attestations').detail.includes(' DT'));
  assert.ok(todo[1].detail.includes('septembre 2026'));
  const acc = todo.find(x => x.id === 'devis-acceptes');
  assert.strictEqual(acc.count, 1); assert.strictEqual(acc.docs[0].id, 'q3'); assert.ok(acc.detail.includes('1 190,000 DT'));
  // fiche société incomplète : signalée juste après les retards, avec ce qui manque
  const todoCo = core.todoList(data, { ...FULL, matricule: '', rib: '' }, T);
  assert.strictEqual(todoCo[1].id, 'societe');
  assert.ok(todoCo[1].detail.includes('le matricule fiscal') && todoCo[1].detail.includes('le RIB') && !todoCo[1].detail.includes('raison sociale'));
  assert.deepStrictEqual(core.companyGaps({}), ['la raison sociale', 'le matricule fiscal', 'le RIB']);
  assert.deepStrictEqual(core.companyGaps(FULL), []);
  // une facture reportée ne remonte plus dans « à faire » mais reste dans les relances
  data.documents[0].remindAfter = '2026-09-30';
  const todo2 = core.todoList(data, FULL, T);
  assert.ok(!todo2.some(x => x.id === 'retards'));
  const od = core.overdueInvoices(data, FULL, T);
  assert.strictEqual(od.length, 1); assert.strictEqual(od[0].snoozed, true); assert.strictEqual(od[0].remindAfter, '2026-09-30');
  // tout traité : plus rien à faire
  assert.deepStrictEqual(core.todoList({ clients: [], documents: [], recurring: [] }, FULL, T), []);
  assert.deepStrictEqual(core.todoList({ clients: [], documents: [], recurring: [] }, CO, T).map(x => x.id), ['societe']);
});

t('reprise d\'un contrat suspendu : première échéance à partir d\'aujourd\'hui', () => {
  assert.strictEqual(core.catchUpRecurrence('2026-08-05', 'month', 5, '2026-09-11'), '2026-10-05');
  assert.strictEqual(core.catchUpRecurrence('2026-09-15', 'month', 15, '2026-09-11'), '2026-09-15'); // déjà dans le futur : inchangée
  assert.strictEqual(core.catchUpRecurrence('2025-11-15', 'quarter', 15, '2026-09-11'), '2026-11-15');
  assert.strictEqual(core.catchUpRecurrence('2024-01-01', 'year', 1, '2026-09-11'), '2027-01-01');
});

t('historique d\'un document : émission, envois, relances, paiements, avoir', () => {
  const d = inv({
    id: 'i1', number: 'FAC-2026-001', date: '2026-06-01', createdAt: new Date('2026-05-28T09:00:00Z').getTime(),
    fromQuoteNumber: 'DEV-2026-001',
    emails: [{ date: '2026-06-01', to: 'x@y.tn', kind: 'facture' }, { date: '2026-07-15', to: 'x@y.tn', kind: 'relance1' }],
    reminders: [{ date: '2026-07-15', level: 1 }, { date: '2026-08-02', level: 2, channel: 'tel', note: 'Promet un virement' }],
    payments: [{ id: 'p', date: '2026-08-20', amount: 500, method: 'virement', reference: 'VIR 12' }],
    remindAfter: '2026-09-01', withholdingCertificate: true
  });
  const data = { clients: [], documents: [d, { id: 'a1', type: 'avoir', status: 'émis', number: 'AVO-2026-001', creditOf: 'i1', date: '2026-08-25', lines: [], creditReason: 'Geste commercial' }] };
  const ev = core.documentHistory(d, data, CO);
  const kinds = ev.map(e => e.kind);
  assert.deepStrictEqual(kinds, ['cree', 'devis', 'emis', 'email', 'relance', 'relance', 'paiement', 'avoir', 'report', 'attestation']);
  assert.ok(ev.find(e => e.kind === 'relance' && e.label.includes('téléphone')).detail.includes('Promet'));
  assert.ok(ev.find(e => e.kind === 'paiement').label.includes('500,000'));
  assert.strictEqual(ev.find(e => e.kind === 'avoir').id, 'a1');
  // la relance email n'est comptée qu'une fois (elle existe dans emails ET dans reminders)
  assert.strictEqual(ev.filter(e => e.kind === 'relance').length, 2);
  assert.strictEqual(core.documentHistory({ type: 'devis', date: '2026-01-01', status: 'brouillon' }, data, CO).length, 0);
  // le devis voit les factures qui en sont tirées, la facture pointe vers son devis
  const q = { id: 'q1', type: 'devis', number: 'DEV-2026-001', status: 'accepté', date: '2026-05-20', lines: [] };
  const dep = inv({ id: 'd1', number: 'FAC-2026-002', date: '2026-05-25', fromQuoteId: 'q1', fromQuoteNumber: 'DEV-2026-001', deposit: { percent: 30, quoteId: 'q1' } });
  const sold = inv({ id: 'd2', number: '', status: 'brouillon', date: '2026-06-10', fromQuoteId: 'q1', fromQuoteNumber: 'DEV-2026-001', settles: { quoteId: 'q1' } });
  const evq = core.documentHistory(q, { clients: [], documents: [q, dep, sold] }, CO);
  assert.deepStrictEqual(evq.map(e => e.kind), ['emis', 'facture', 'facture']);
  assert.ok(evq[1].label.includes('acompte 30 %') && evq[1].id === 'd1');
  assert.ok(evq[2].label.includes('solde') && evq[2].label.includes('brouillon') && evq[2].detail.includes('pas encore émise'));
  assert.strictEqual(core.documentHistory(dep, { clients: [], documents: [q, dep] }, CO).find(e => e.kind === 'devis').id, 'q1');
});

t('modèles d\'email : relance de devis et envoi au comptable', () => {
  const q = { id: 'q', type: 'devis', number: 'DEV-2026-004', status: 'envoyé', date: '2026-08-01', dueDate: '2026-09-01', subject: 'Audit', lines: [{ label: 'x', qty: 1, unitPrice: 1000, vatRate: 19 }] };
  const m = core.emailFor('relanceDevis', q, { name: 'ACME', email: 'a@b.tn' }, CO);
  assert.strictEqual(m.subject, 'Notre devis DEV-2026-004 — Audit');
  assert.ok(m.body.includes('1 190,000 DT') && m.body.includes('Audit'));
  const en = core.emailFor('relanceDevis', { ...q, lang: 'en' }, { name: 'ACME' }, CO);
  assert.ok(en.subject.startsWith('Our quote'));
  assert.ok(core.DEFAULT_EMAIL_TEMPLATES.comptable.body.includes('{montant}'));
});

// ---------- première utilisation (src/renderer/onboarding.js) ----------
const onboarding = require('../src/renderer/onboarding.js');

t('première utilisation : assistant proposé, réponses appliquées, secteurs cohérents', () => {
  const neuf = core.migrateData(null);
  assert.strictEqual(onboarding.needsSetup(neuf), true);
  assert.strictEqual(core.DEFAULT_COMPANY.name, '', 'aucune société ne doit être écrite en dur');
  assert.strictEqual(core.DEFAULT_COMPANY.matricule, '');
  assert.strictEqual(core.DEFAULT_COMPANY.address, '');
  // un fichier qui contient déjà quelque chose ne déclenche pas l'assistant
  assert.strictEqual(onboarding.needsSetup({ company: { name: '' }, documents: [{ id: 'x' }], clients: [] }), false);
  assert.strictEqual(onboarding.needsSetup({ company: { name: 'X' }, documents: [], clients: [] }), false);
  assert.strictEqual(onboarding.needsSetup({ company: { name: '', setupDone: true }, documents: [], clients: [] }), false);

  const d = onboarding.applySetup(core.migrateData(null), {
    name: '  Menuiserie Trabelsi  ', matricule: '9876543Z/A/P/000', rc: 'B999', address: 'Rue X\n1000 Tunis',
    phone: '+216 20 000 000', email: 'a@b.tn', activity: 'batiment', fillCatalog: true,
    currency: 'DT', stampFee: 1, quoteValidityDays: 15, paymentTermsDays: 45, defaultWithholdingRate: 1.5
  });
  assert.strictEqual(d.company.name, 'Menuiserie Trabelsi');       // espaces retirés
  assert.strictEqual(d.company.paymentTermsDays, 45);
  assert.strictEqual(d.company.defaultWithholdingRate, 1.5);
  assert.strictEqual(d.company.activity, 'batiment');
  assert.ok(d.company.tagline.length > 0, 'slogan du secteur proposé');
  assert.strictEqual(d.catalog.length, 4);
  assert.ok(d.catalog.every(x => x.id && x.vatRate === 19 && x.unit));
  assert.strictEqual(onboarding.needsSetup(d), false);
  // sans préremplissage, le catalogue reste vide
  assert.strictEqual(onboarding.applySetup(core.migrateData(null), { name: 'X', activity: 'batiment', fillCatalog: false }).catalog.length, 0);
  // chaque secteur est utilisable
  core.ACTIVITIES.forEach(a => {
    assert.ok(a.id && a.label && core.VAT_RATES.includes(a.vat), a.id);
    a.catalog.forEach(([label, , price, unit]) => { assert.ok(label && unit, a.id); assert.ok(price >= 0); });
  });
  assert.ok(core.ACTIVITIES.some(a => a.id === 'autre' && !a.catalog.length));
  assert.ok(onboarding.STEPS.length >= 5 && onboarding.STEPS.every(s => s.id && s.title && s.sub));
});

t('pied de page légal composé quand il n\'est pas saisi', () => {
  const co = { ...core.DEFAULT_COMPANY, name: 'Menuiserie Trabelsi', matricule: '9876543Z', rc: 'B999', capital: '5 000 DT' };
  const html = core.documentHtml(inv(), { name: 'C' }, co);
  assert.ok(html.includes('Menuiserie Trabelsi — Matricule fiscal 9876543Z — RC B999 — Capital 5 000 DT'));
  // un pied de page saisi à la main reste prioritaire
  const html2 = core.documentHtml(inv(), { name: 'C' }, { ...co, footer: 'Mon texte à moi' });
  assert.ok(html2.includes('Mon texte à moi') && !html2.includes('Matricule fiscal 9876543Z —'));
  // en anglais
  assert.ok(core.documentHtml({ ...inv(), lang: 'en' }, { name: 'C' }, co).includes('Tax ID 9876543Z'));
});

t('graphique : abréviations des mois distinctes', () => {
  const labels = core.monthlySeries({ documents: [] }, core.DEFAULT_COMPANY, '2026-09-11', 12).map(x => x.label);
  assert.deepStrictEqual(labels, ['oct. 25', 'nov.', 'déc.', 'janv. 26', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.']);
  assert.strictEqual(new Set(labels).size, 12);
});

// ---------- aide et bulles « i » (src/renderer/guide.js) ----------
const guide = require('../src/renderer/guide.js');

t('aide : toutes les bulles « i » de l\'interface existent et sont rédigées', () => {
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
  const used = new Set();
  for (const m of appSrc.matchAll(/\binfo\('([^']+)'\)/g)) used.add(m[1]);
  for (const m of appSrc.matchAll(/\blbl\((?:'(?:[^'\\]|\\.)*'|`[^`]*`|[^,]+),\s*'([^']+)'\)/g)) used.add(m[1]);
  assert.ok(used.size >= 40, `seulement ${used.size} bulles posées dans l'interface`);
  const missing = [...used].filter(k => !guide.INFO[k]);
  assert.deepStrictEqual(missing, [], 'clés utilisées sans texte dans guide.js');
  Object.entries(guide.INFO).forEach(([k, v]) => {
    assert.ok(v && v.t && v.d, k);
    assert.ok(v.t.length <= 60, `titre trop long : ${k}`);
    assert.ok(v.d.length >= 60, `explication trop courte : ${k}`);
    assert.ok(!/<script|onerror|onclick/i.test(v.d), `HTML interdit dans ${k}`);
  });
  // Les points fiscaux incertains portent tous la mention convenue
  ['ed.withholding', 'doc.stampFee', 'ed.vat'].forEach(k => assert.ok(/À VÉRIFIER/.test(guide.INFO[k].d), k));
});

t('aide : les articles du guide sont complets', () => {
  assert.ok(guide.ARTICLES.length >= 10);
  const ids = new Set();
  guide.ARTICLES.forEach(a => {
    assert.ok(a.id && a.title && a.sub && a.body, a.id);
    assert.ok(!ids.has(a.id), 'identifiant en double : ' + a.id); ids.add(a.id);
    assert.ok(a.body.length > 500, 'article trop court : ' + a.id);
    assert.ok(!/<script|onerror=|onclick=/i.test(a.body), 'HTML interdit dans ' + a.id);
    // pas de balise ouverte non fermée pour les blocs courants
    ['p', 'ul', 'ol', 'li', 'h3', 'dl', 'table'].forEach(tag => {
      const open = (a.body.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
      const close = (a.body.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      assert.strictEqual(open, close, `<${tag}> déséquilibré dans ${a.id}`);
    });
  });
  // les articles auxquels le menu de l'application renvoie doivent exister
  ['facture', 'fiscal', 'donnees'].forEach(id => assert.ok(ids.has(id), id));
});

t('document : nombre de pages mesuré comme dans l\'aperçu', () => {
  // fitToPage et pageCount tournent dans le document rendu : on vérifie le contrat (pas de dépendance au DOM réel)
  const fake = (heightPx, probePx) => ({
    querySelector: () => ({ offsetHeight: heightPx, classList: { contains: () => false, add() { this._c = true; } }, appendChild() {}, _c: false }),
    createElement: () => ({ style: {}, offsetHeight: probePx, remove() {} })
  });
  assert.strictEqual(core.pageCount(fake(1000, 1120)), 1);
  assert.strictEqual(core.pageCount(fake(1500, 1120)), 2);
  assert.strictEqual(core.pageCount(null), 1);
});

t('pagination : bornes, page hors limites, « Tout afficher »', () => {
  const p1 = core.pageInfo(46, 1, 25);
  assert.deepStrictEqual([p1.page, p1.pages, p1.from, p1.to, p1.start, p1.end], [1, 2, 1, 25, 0, 25]);
  const p2 = core.pageInfo(46, 2, 25);
  assert.deepStrictEqual([p2.page, p2.pages, p2.from, p2.to, p2.start, p2.end], [2, 2, 26, 46, 25, 46]);
  // Un filtre réduit la liste alors qu'on était en page 5 : on revient sur la dernière page existante,
  // sinon l'écran est vide sans rien expliquer.
  const p3 = core.pageInfo(12, 5, 25);
  assert.deepStrictEqual([p3.page, p3.pages, p3.from, p3.to], [1, 1, 1, 12]);
  const p4 = core.pageInfo(60, 99, 25);
  assert.strictEqual(p4.page, 3);
  // taille 0 = tout afficher, sur une seule page
  const all = core.pageInfo(137, 3, 0);
  assert.deepStrictEqual([all.page, all.pages, all.from, all.to, all.size], [1, 1, 1, 137, 0]);
  // liste vide : pas de « 1–0 sur 0 »
  const none = core.pageInfo(0, 1, 25);
  assert.deepStrictEqual([none.pages, none.from, none.to], [1, 0, 0]);
  // page absurde ou non numérique : on retombe sur la première page
  assert.strictEqual(core.pageInfo(50, 0, 25).page, 1);
  assert.strictEqual(core.pageInfo(50, undefined, 25).page, 1);
});

t('tri des colonnes : nombres, accents, valeurs vides en fin', () => {
  assert.ok(core.compareValues(2, 10) < 0);                 // numérique, pas alphabétique
  assert.ok(core.compareValues('FAC-2026-2', 'FAC-2026-10') < 0);
  assert.ok(core.compareValues('Élan', 'Zone') < 0);        // accents classés comme en français
  assert.ok(core.compareValues('elan', 'Élan') === 0);      // casse et accents ignorés à la comparaison
  assert.ok(core.compareValues('', 'Zone') > 0);            // vide toujours après, en tri croissant
  assert.ok(core.compareValues(null, 'Zone') > 0);
  assert.strictEqual(core.compareValues('', ''), 0);
  const rows = [{ d: '' }, { d: '2026-03-01' }, { d: '2026-01-05' }];
  assert.deepStrictEqual(rows.slice().sort((a, b) => core.compareValues(a.d, b.d)).map(x => x.d), ['2026-01-05', '2026-03-01', '']);
});

t('date tapée à la main : formats tolérés, dates impossibles refusées', () => {
  const p = s => core.parseDateInput(s, '2026-09-11');
  assert.strictEqual(p('12/03/2026'), '2026-03-12');
  assert.strictEqual(p('12-3-26'), '2026-03-12');       // séparateurs libres, année sur deux chiffres
  assert.strictEqual(p('12.03.2026'), '2026-03-12');
  assert.strictEqual(p('12032026'), '2026-03-12');      // sans séparateur
  assert.strictEqual(p('120326'), '2026-03-12');
  assert.strictEqual(p('12/03'), '2026-03-12');         // année en cours sous-entendue
  assert.strictEqual(p('12'), '2026-09-12');            // mois et année en cours sous-entendus
  assert.strictEqual(p('2026-03-12'), '2026-03-12');    // ISO collée
  assert.strictEqual(p('31/02/2026'), '');              // le 31 février n'existe pas
  assert.strictEqual(p('30/02/2024'), '');              // même en année bissextile
  assert.strictEqual(p('29/02/2024'), '2024-02-29');    // mais le 29 février bissextile, oui
  assert.strictEqual(p('45/13/2026'), '');
  assert.strictEqual(p(''), '');
  assert.strictEqual(p('bonjour'), '');
  // Appelée sans date de référence, la fonction doit se rabattre sur aujourd'hui sans exploser :
  // c'est ainsi que l'interface l'appelle.
  assert.strictEqual(core.parseDateInput('12/03/2026'), '2026-03-12');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(core.parseDateInput('12')));
  assert.strictEqual(core.fmtDateInput('2026-03-12'), '12/03/2026');
  assert.strictEqual(core.fmtDateInput(''), '');
  assert.strictEqual(core.fmtDateInput('pas une date'), '');
});

t('calendrier : six semaines commençant un lundi', () => {
  const w = core.monthMatrix(2026, 9);                  // septembre 2026 commence un mardi
  assert.strictEqual(w.length, 6);
  assert.ok(w.every(x => x.length === 7));
  assert.strictEqual(w[0][0].iso, '2026-08-31');        // le lundi précédent complète la première semaine
  assert.strictEqual(w[0][0].out, true);
  assert.strictEqual(w[0][1].iso, '2026-09-01');
  assert.strictEqual(w[0][1].out, false);
  const inMonth = w.flat().filter(d => !d.out);
  assert.strictEqual(inMonth.length, 30);
  assert.strictEqual(inMonth[29].iso, '2026-09-30');
  // février d'une année bissextile
  assert.strictEqual(core.monthMatrix(2024, 2).flat().filter(d => !d.out).length, 29);
});

t('unités : liste standard et unités déjà employées', () => {
  assert.ok(core.LINE_UNITS.some(u => u[0] === 'h'));
  assert.ok(core.LINE_UNITS.some(u => u[0] === 'forfait'));
  const d = { catalog: [{ unit: 'rouleau' }, { unit: 'h' }], documents: [{ lines: [{ unit: 'palette' }, { unit: '' }] }] };
  const extra = core.usedUnits(d);
  assert.deepStrictEqual(extra, ['palette', 'rouleau']);   // triées, sans doublon, sans les standards
  assert.deepStrictEqual(core.usedUnits(d, ['sac', 'rouleau']), ['palette', 'rouleau', 'sac']);
  assert.deepStrictEqual(core.usedUnits({}), []);
});

t('historique : une facture née d\'un contrat le dit et renvoie au contrat', () => {
  const rec = { id: 'r1', clientId: 'c1', subject: 'Maintenance — {mois}', every: 'month', day: 1, nextDate: '2026-10-01', lines: [], active: true };
  const inv = { id: 'i9', type: 'facture', number: 'FAC-2026-050', status: 'envoyée', date: '2026-09-01',
    clientId: 'c1', lines: [{ label: 'x', qty: 1, unitPrice: 100, vatRate: 19 }], payments: [], createdAt: 1, recurringId: 'r1' };
  const data = { documents: [inv], clients: [], recurring: [rec] };
  const ev = core.documentHistory(inv, data, CO);
  const c = ev.find(e => e.kind === 'contrat');
  assert.ok(c, 'événement contrat absent : ' + ev.map(e => e.kind).join(','));
  assert.strictEqual(c.contractId, 'r1');           // la ligne est cliquable vers le contrat
  assert.ok(c.detail.includes('septembre 2026'));   // {mois} résolu sur le mois facturé, pas sur le gabarit
  // contrat supprimé depuis : on le dit au lieu de planter
  const ev2 = core.documentHistory(inv, { documents: [inv], clients: [], recurring: [] }, CO);
  assert.ok(ev2.find(e => e.kind === 'contrat').detail.includes('supprimé'));
  // une facture ordinaire ne déclenche rien
  assert.ok(!core.documentHistory({ ...inv, recurringId: undefined }, data, CO).some(e => e.kind === 'contrat'));
});

// ---------- statistiques (2.5.0) ----------

// Petit jeu de données maison : deux clients, des factures sur deux années, un avoir, des paiements.
function statsData() {
  const inv = (id, num, date, clientId, ht, o) => ({
    id, type: 'facture', number: num, status: 'envoyée', date, dueDate: core.addDays(date, 30),
    clientId, lines: [{ label: o && o.label || 'Audit', qty: 1, unitPrice: ht, vatRate: 19 }],
    payments: [], createdAt: 1, ...(o || {})
  });
  return {
    version: 3,
    clients: [{ id: 'c1', name: 'Alpha' }, { id: 'c2', name: 'Beta' }, { id: 'c3', name: 'Gamma sans facture' }],
    documents: [
      inv('i1', 'FAC-2025-001', '2025-03-10', 'c1', 1000),
      inv('i2', 'FAC-2026-001', '2026-02-05', 'c1', 2000, { payments: [{ date: '2026-02-15', amount: 2381 }] }),
      inv('i3', 'FAC-2026-002', '2026-05-20', 'c2', 500, { label: 'Licence' }),
      inv('i4', 'FAC-2026-003', '2026-08-01', 'c1', 300, { label: 'Licence' }),
      { id: 'i5', type: 'facture', number: null, status: 'brouillon', date: '2026-06-01', clientId: 'c2',
        lines: [{ label: 'Jamais compté', qty: 1, unitPrice: 9999, vatRate: 19 }], payments: [], createdAt: 1 },
      { id: 'a1', type: 'avoir', number: 'AVO-2026-001', status: 'émis', date: '2026-06-10', clientId: 'c2',
        creditOf: 'i3', lines: [{ label: 'Licence', qty: 1, unitPrice: 100, vatRate: 19 }], createdAt: 1 },
      { id: 'q1', type: 'devis', number: 'DEV-2026-001', status: 'accepté', date: '2026-01-10', dueDate: '2026-02-10',
        clientId: 'c1', lines: [{ label: 'Audit', qty: 1, unitPrice: 2000, vatRate: 19 }], createdAt: 1 },
      { id: 'q2', type: 'devis', number: 'DEV-2026-002', status: 'refusé', date: '2026-03-01', dueDate: '2026-04-01',
        clientId: 'c2', lines: [{ label: 'Audit', qty: 1, unitPrice: 800, vatRate: 19 }], createdAt: 1 },
      { id: 'q3', type: 'devis', number: 'DEV-2026-003', status: 'envoyé', date: '2026-04-01', dueDate: '2026-05-01',
        clientId: 'c2', lines: [{ label: 'Audit', qty: 1, unitPrice: 400, vatRate: 19 }], createdAt: 1 },
      { id: 'q4', type: 'devis', number: 'DEV-2026-004', status: 'envoyé', date: '2026-09-01', dueDate: '2026-12-01',
        clientId: 'c1', lines: [{ label: 'Audit', qty: 1, unitPrice: 600, vatRate: 19 }], createdAt: 1 }
    ],
    catalog: [], recurring: [], templates: [], snippets: []
  };
}
// la facture i2 découle du devis q1 (délai de réponse du funnel)
const STATS = statsData();
STATS.documents.find(d => d.id === 'i2').fromQuoteId = 'q1';

t('statistiques : bornes de période et période comparable', () => {
  const an = core.periodBounds('annee', 2026);
  assert.strictEqual(an.from, '2026-01-01');
  assert.strictEqual(an.to, '2026-12-31');
  assert.strictEqual(an.prev.from, '2025-01-01');
  assert.ok(an.label.includes('2026'));
  const t2 = core.periodBounds('trimestre', 2026, 2);
  assert.strictEqual(t2.from, '2026-04-01');
  assert.strictEqual(t2.to, '2026-06-30');
  assert.strictEqual(t2.prev.to, '2025-06-30');
  const fev = core.periodBounds('mois', 2026, 2);
  assert.strictEqual(fev.to, '2026-02-28');                 // fin de mois réelle
  assert.strictEqual(core.periodBounds('mois', 2024, 2).to, '2024-02-29');  // bissextile
  assert.strictEqual(core.periodBounds('mois', 2026, 12).to, '2026-12-31'); // décembre ne déborde pas
  // valeurs hors bornes ramenées dans la plage plutôt que de produire une date absurde
  assert.strictEqual(core.periodBounds('trimestre', 2026, 9).from, '2026-10-01');
});

t('statistiques : chiffre d\'affaires, brouillons exclus, avoirs déduits', () => {
  const r = core.salesTotals(STATS, CO, '2026-01-01', '2026-12-31');
  // 2000 + 500 + 300 − 100 (avoir) = 2700 HT ; le brouillon à 9999 n'entre pas
  assert.strictEqual(r.ht, 2700);
  assert.strictEqual(r.vat, core.round3(2700 * 0.19));
  assert.strictEqual(r.invoices, 3);
  assert.strictEqual(r.count, 4);                            // avoir compris
  assert.strictEqual(r.avgTicket, core.round3(2700 / 3));
  // timbre : 3 factures − 0 sur l'avoir
  assert.strictEqual(r.ttc, core.round3(2700 + 2700 * 0.19 + 3));
  assert.strictEqual(core.salesTotals(STATS, CO, '2025-01-01', '2025-12-31').ht, 1000);
  const vide = core.salesTotals(STATS, CO, '2020-01-01', '2020-12-31');
  assert.strictEqual(vide.ht, 0);
  assert.strictEqual(vide.avgTicket, 0);                     // pas de division par zéro
});

t('statistiques : CA mois par mois, mois vides compris', () => {
  const s = core.revenueByMonth(STATS, CO, '2026-01-01', '2026-12-31');
  assert.strictEqual(s.length, 12);
  assert.strictEqual(s[0].ht, 0);
  assert.strictEqual(s[1].ht, 2000);                         // février
  assert.strictEqual(s[4].ht, 500);                          // mai
  assert.strictEqual(s[5].ht, -100);                         // juin : l'avoir seul
  assert.strictEqual(s[7].ht, 300);                          // août
  assert.strictEqual(core.round3(s.reduce((a, x) => a + x.ht, 0)), 2700);
  // une période à cheval sur deux années reste continue
  const ch = core.revenueByMonth(STATS, CO, '2025-11-01', '2026-02-28');
  assert.deepStrictEqual(ch.map(x => x.month), ['2025-11', '2025-12', '2026-01', '2026-02']);
});

t('statistiques : prestations les plus vendues', () => {
  const top = core.topItems(STATS, CO, '2026-01-01', '2026-12-31', 5);
  assert.strictEqual(top[0].label, 'Audit');
  assert.strictEqual(top[0].ht, 2000);
  assert.strictEqual(top[1].label, 'Licence');
  assert.strictEqual(top[1].ht, 700);                        // 500 + 300 − 100 d'avoir
  // une ligne de déduction d'acompte n'est pas une vente
  const avec = JSON.parse(JSON.stringify(STATS));
  avec.documents.find(d => d.id === 'i4').lines.push({ label: 'Acompte déduit', qty: 1, unitPrice: -200, vatRate: 19, noDiscount: true });
  assert.ok(!core.topItems(avec, CO, '2026-01-01', '2026-12-31', 9).some(x => x.label === 'Acompte déduit'));
  assert.strictEqual(core.topItems(STATS, CO, '2026-01-01', '2026-12-31', 1).length, 1);
});

t('statistiques : nouveaux clients et clients endormis', () => {
  const m = core.clientMovement(STATS, CO, '2026-01-01', '2026-12-31', 180, '2026-09-11');
  // Alpha facture pour la première fois en 2025 : pas un nouveau client de 2026
  assert.deepStrictEqual(m.nouveaux.map(x => x.name), ['Beta']);
  assert.strictEqual(m.nouveaux[0].since, '2026-05-20');
  // Beta : dernière pièce le 10/06/2026, soit 93 jours — pas encore endormi à 180
  assert.deepStrictEqual(m.dormants.map(x => x.name), []);
  const court = core.clientMovement(STATS, CO, '2026-01-01', '2026-12-31', 60, '2026-09-11');
  assert.deepStrictEqual(court.dormants.map(x => x.name), ['Beta']);
  assert.strictEqual(court.dormants[0].days, 93);
  // un client sans aucune facture n'est ni nouveau ni endormi
  assert.ok(!court.dormants.concat(court.nouveaux).some(x => x.name.startsWith('Gamma')));
});

t('statistiques : âge des impayés', () => {
  const r = core.agedReceivables(STATS, CO, '2026-09-11');
  const by = Object.fromEntries(r.buckets.map(b => [b.label, b]));
  // i2 est soldée : elle ne pèse plus rien, aucune de ses lignes n'apparaît
  assert.strictEqual(by['Pas encore échu'].amount, 0);
  // i1 (échéance 09/04/2025) : très en retard
  assert.strictEqual(by['Plus de 90 jours'].count, 1);
  assert.strictEqual(by['Plus de 90 jours'].amount, core.round3(1000 * 1.19 + 1));
  // i3 (échéance 19/06/2026, 84 jours) diminuée de l'avoir de 100 HT
  assert.strictEqual(by['61 à 90 jours'].count, 1);
  assert.strictEqual(by['61 à 90 jours'].amount, core.round3(500 * 1.19 + 1 - 100 * 1.19));
  // i4 échéance 31/08/2026 : 11 jours de retard
  assert.strictEqual(by['1 à 30 jours'].count, 1);
  assert.strictEqual(by['31 à 60 jours'].count, 0);
  assert.strictEqual(core.round3(r.buckets.reduce((s, b) => s + b.amount, 0)), r.total);
  // rien d'impayé un jour où tout est encore à venir
  assert.ok(core.agedReceivables({ documents: [], clients: [] }, CO, '2026-09-11').total === 0);
});

t('statistiques : classement des payeurs', () => {
  const r = core.payerRanking(STATS, CO, 5);
  assert.deepStrictEqual(r.tous.map(x => x.name), ['Alpha']); // seul client avec une facture soldée
  assert.strictEqual(r.tous[0].delay, 10);                    // 05/02 → 15/02
  assert.strictEqual(r.rapides[0].name, 'Alpha');
  assert.strictEqual(r.lents[0].name, 'Alpha');
  assert.deepStrictEqual(core.payerRanking({ documents: [], clients: [] }, CO, 5).tous, []);
});

t('statistiques : issue des devis', () => {
  const f = core.quoteFunnel(STATS, CO, '2026-01-01', '2026-12-31', '2026-09-11');
  assert.strictEqual(f.total, 4);
  assert.strictEqual(f.accepted, 1);
  assert.strictEqual(f.refused, 1);
  assert.strictEqual(f.expired, 1);                           // q3, validité passée sans réponse
  assert.strictEqual(f.pending, 1);                           // q4, encore valable
  assert.strictEqual(f.rate, 50);                             // 1 accepté sur 2 décidés
  assert.strictEqual(f.replyDelay, 26);                       // 10/01 → 05/02
  assert.strictEqual(f.acceptedAmount, core.round3(2000 * 1.19));
  // aucun devis : taux nul plutôt que NaN
  assert.strictEqual(core.quoteFunnel(STATS, CO, '2020-01-01', '2020-12-31', '2026-09-11').rate, null);
});

t('statistiques : objectif annuel', () => {
  assert.strictEqual(core.objectiveProgress(0, 1000, '2026-09-11', 2026), null);   // pas d'objectif saisi
  const o = core.objectiveProgress(100000, 25000, '2026-07-02', 2026);             // 183 jours sur 365
  assert.strictEqual(o.pct, 25);
  assert.strictEqual(o.expectedPct, 50);
  assert.ok(o.ahead < 0);                                                          // en retard sur le rythme
  assert.strictEqual(o.remaining, 75000);
  assert.ok(o.perMonth > 0 && o.monthsLeft >= 1);
  // une année déjà terminée ne demande plus rien par mois
  const fini = core.objectiveProgress(100000, 120000, '2027-01-05', 2026);
  assert.strictEqual(fini.remaining, 0);
  assert.strictEqual(fini.expectedPct, 100);
});

t('nouveaux documents : numérotation, timbre, retenue, conversions', () => {
  const data = { documents: [], counters: {}, clients: [{ id: 'c1', name: 'Alpha' }] };
  // chaque type a son préfixe et son compteur propre
  assert.strictEqual(core.nextNumber(data, 'proforma', '2026-03-01'), 'PRO-2026-001');
  assert.strictEqual(core.nextNumber(data, 'commande', '2026-03-01'), 'BC-2026-001');
  assert.strictEqual(core.nextNumber(data, 'livraison', '2026-03-01'), 'BL-2026-001');
  assert.strictEqual(core.nextNumber(data, 'contrat', '2026-03-01'), 'CTR-2026-001');
  assert.strictEqual(core.nextNumber(data, 'proforma', '2026-04-01'), 'PRO-2026-002');
  assert.strictEqual(core.nextNumber(data, 'facture', '2026-03-01'), 'FAC-2026-001');   // les compteurs ne se mélangent pas

  const lines = [{ label: 'Serveur', qty: 2, unitPrice: 1000, vatRate: 19 }];
  // proforma : pas de timbre par défaut, mais la retenue reste possible
  const pro = core.computeTotals({ type: 'proforma', lines, withholdingRate: 3 }, CO);
  assert.strictEqual(pro.stamp, 0);
  assert.strictEqual(pro.withholding, core.round3(2380 * 0.03));
  assert.strictEqual(core.computeTotals({ type: 'proforma', lines, applyStamp: true }, CO).stamp, 1);
  // bons et contrat : ni timbre ni retenue, même si le champ traîne dans les données
  ['commande', 'livraison', 'contrat'].forEach(ty => {
    const t2 = core.computeTotals({ type: ty, lines, applyStamp: true, withholdingRate: 10 }, CO);
    assert.strictEqual(t2.stamp, 0, ty);
    assert.strictEqual(t2.withholding, 0, ty);
    assert.strictEqual(t2.netToPay, 2380, ty);
  });
  // aucune de ces pièces n'entre dans le journal des ventes ni dans le chiffre d'affaires
  const docs = ['proforma', 'commande', 'livraison', 'contrat'].map((ty, i) => ({
    id: 'x' + i, type: ty, number: 'X-1', status: 'envoyée', date: '2026-03-10', clientId: 'c1', lines, createdAt: 1
  }));
  const d2 = { documents: docs, clients: [{ id: 'c1', name: 'Alpha' }], counters: {} };
  assert.strictEqual(core.salesJournal(d2, CO, { from: '2026-01-01', to: '2026-12-31' }).length, 0);
  assert.strictEqual(core.salesTotals(d2, CO, '2026-01-01', '2026-12-31').ht, 0);
});

t('conversion d\'une pièce en une autre : ce qui suit et ce qui ne suit pas', () => {
  const quote = {
    id: 'q1', type: 'devis', number: 'DEV-2026-001', status: 'accepté', date: '2026-03-01', dueDate: '2026-03-31',
    clientId: 'c1', subject: 'Serveur et installation', reference: 'REF-9', discountRate: 10, notes: 'Livraison sous 15 jours',
    lines: [{ label: 'Serveur', qty: 1, unitPrice: 3000, vatRate: 19 }], lang: 'fr', currency: 'DT',
    emails: [{ date: '2026-03-01', to: 'x@y.tn' }], attachments: [{ name: 'signe.pdf', file: 'a' }], createdAt: 1
  };
  const bl = core.convertDoc(quote, 'livraison', CO, '2026-03-20');
  assert.strictEqual(bl.type, 'livraison');
  assert.strictEqual(bl.status, 'brouillon');
  assert.strictEqual(bl.number, '');
  assert.strictEqual(bl.date, '2026-03-20');
  assert.strictEqual(bl.dueDate, '');                      // un bon de livraison n'a pas d'échéance
  assert.strictEqual(bl.hidePrices, true);                 // il accompagne la marchandise
  assert.strictEqual(bl.subject, quote.subject);
  assert.strictEqual(bl.discountRate, 10);
  assert.deepStrictEqual(bl.lines, quote.lines);
  assert.notStrictEqual(bl.id, quote.id);
  assert.strictEqual(bl.fromDocId, 'q1');
  assert.strictEqual(bl.fromDocNumber, 'DEV-2026-001');
  // ce qui appartenait à la pièce d'origine ne suit jamais
  assert.strictEqual(bl.emails, undefined);
  assert.strictEqual(bl.attachments, undefined);
  // modifier la copie ne touche pas l'original
  bl.lines[0].label = 'Autre';
  assert.strictEqual(quote.lines[0].label, 'Serveur');
  // devis → facture : la filiation « devis » reconnue par l'acompte et le tableau de bord est conservée
  const fac = core.convertDoc(quote, 'facture', CO, '2026-03-20');
  assert.strictEqual(fac.fromQuoteId, 'q1');
  assert.strictEqual(fac.applyStamp, true);
  assert.strictEqual(fac.dueDate, core.addDays('2026-03-20', CO.paymentTermsDays));
  // et elle se propage : le BL d'un devis facturé garde le devis d'origine
  assert.strictEqual(core.convertDoc(fac, 'livraison', CO, '2026-03-21').fromQuoteId, 'q1');
  // contrat : les clauses par défaut arrivent remplies
  const ctr = core.convertDoc(quote, 'contrat', CO, '2026-03-20');
  assert.ok(ctr.clauses.objet && ctr.clauses.preavis);
  assert.strictEqual(core.CLAUSE_LABELS.length, Object.keys(core.DEFAULT_CLAUSES).length);
});

t('historique : filiation entre pièces, dans les deux sens', () => {
  const quote = { id: 'q1', type: 'devis', number: 'DEV-2026-001', status: 'envoyé', date: '2026-03-01', lines: [], createdAt: 1 };
  const pro = { id: 'p1', type: 'proforma', number: 'PRO-2026-001', status: 'envoyée', date: '2026-03-05', lines: [],
    fromDocId: 'q1', fromDocType: 'devis', fromDocNumber: 'DEV-2026-001', createdAt: 2,
    attachments: [{ name: 'accord-client.pdf', file: 'x1', date: '2026-03-06' }] };
  const data = { documents: [quote, pro], clients: [], recurring: [] };
  // la proforma dit d'où elle vient, et sa pièce jointe apparaît
  const ev = core.documentHistory(pro, data, CO);
  const src = ev.find(e => e.kind === 'source');
  assert.ok(src && src.id === 'q1' && src.label.includes('DEV-2026-001'));
  assert.ok(ev.find(e => e.kind === 'piece' && e.label.includes('accord-client.pdf')));
  // le devis voit ce qui en découle
  const evq = core.documentHistory(quote, data, CO);
  const der = evq.find(e => e.kind === 'derive');
  assert.ok(der && der.id === 'p1' && der.label.includes('PRO-2026-001'));
  assert.deepStrictEqual(core.derivedDocs(quote, data).map(d => d.id), ['p1']);
  // un document sans identifiant ne « descend » de rien : sinon toute la base remonterait
  assert.deepStrictEqual(core.derivedDocs({ type: 'devis' }, data), []);
});

t('template : les quatre nouvelles pièces s\'impriment correctement', () => {
  const cl = { id: 'c1', name: 'Client SARL', address: 'Tunis', matricule: '1234567A/M/000' };
  const base = { clientId: 'c1', subject: 'Serveur', date: '2026-03-01', status: 'envoyée',
    lines: [{ label: 'Serveur rack', qty: 2, unit: 'u', unitPrice: 1500, vatRate: 19 }] };
  const pro = core.documentHtml({ ...base, id: 'p', type: 'proforma', number: 'PRO-2026-001', dueDate: '2026-03-31' }, cl, CO);
  assert.ok(pro.includes('Facture proforma'));
  assert.ok(pro.includes('sans valeur comptable'));
  assert.ok(!pro.includes('Timbre fiscal'));
  const bc = core.documentHtml({ ...base, id: 'b', type: 'commande', number: 'BC-2026-001', status: 'reçue' }, cl, CO);
  assert.ok(bc.includes('Bon de commande') && bc.includes('Bon pour commande'));
  // bon de livraison : ni prix unitaire, ni TVA, ni bloc de totaux
  const bl = core.documentHtml({ ...base, id: 'l', type: 'livraison', number: 'BL-2026-001', status: 'émis', hidePrices: true }, cl, CO);
  assert.ok(bl.includes('Bon de livraison') && bl.includes('Reçu conforme'));
  assert.ok(!bl.includes('Prix unit'));
  assert.ok(!bl.includes('1 500'), 'un prix s\'est glissé dans le bon de livraison');
  assert.ok(bl.includes('Serveur rack') && bl.includes('>2<') || bl.includes('2<'));
  // prix affichés à la demande
  assert.ok(core.documentHtml({ ...base, id: 'l', type: 'livraison', number: 'BL-1', hidePrices: false }, cl, CO).includes('Prix unit'));
  // contrat : les clauses numérotées et les deux cases de signature
  const ctr = core.documentHtml({ ...base, id: 'k', type: 'contrat', number: 'CTR-2026-001', status: 'envoyé', clauses: core.DEFAULT_CLAUSES }, cl, CO);
  assert.ok(ctr.includes('Contrat de prestation'));
  assert.ok(ctr.includes('1. Objet du contrat') && ctr.includes('4. Résiliation et préavis'));
  assert.ok(ctr.includes('Le client') && ctr.includes('Le prestataire'));
  // une clause vidée disparaît du document
  const sans = core.documentHtml({ ...base, id: 'k', type: 'contrat', number: 'CTR-1', clauses: { ...core.DEFAULT_CLAUSES, confidentialite: '' } }, cl, CO);
  assert.ok(!sans.includes('Confidentialité'));
  // l'échappement tient sur les clauses comme ailleurs
  const xss = core.documentHtml({ ...base, id: 'k', type: 'contrat', number: 'CTR-1', clauses: { objet: '<img src=x onerror=alert(1)>' } }, cl, CO);
  assert.ok(!xss.includes('<img src=x'));
});

t('emails : un gabarit par nouveau type', () => {
  const cl = { id: 'c1', name: 'Client SARL', email: 'contact@client.tn' };
  const doc = { id: 'p', type: 'proforma', number: 'PRO-2026-001', clientId: 'c1', subject: 'Serveur', date: '2026-03-01',
    dueDate: '2026-03-31', lines: [{ label: 'Serveur', qty: 1, unitPrice: 1000, vatRate: 19 }] };
  ['proforma', 'commande', 'livraison', 'contrat'].forEach(kind => {
    const m = core.emailFor(kind, { ...doc, type: kind }, cl, CO);
    assert.strictEqual(m.to, 'contact@client.tn');
    assert.ok(m.subject.includes('PRO-2026-001'), kind);
    assert.ok(m.body.includes('PRO-2026-001'), kind);
    assert.ok(!/\{[a-z]+\}/.test(m.subject + m.body), 'variable non remplacée dans ' + kind);
  });
});

console.log(`\n${n} tests OK`);
