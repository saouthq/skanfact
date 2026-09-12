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

t('migration 1.x → 4 : « payée » devient un paiement, les listes manquantes sont créées', () => {
  const d = core.migrateData({ version: 1, company: { name: 'X' }, documents: [inv({ status: 'payée', payments: undefined })], clients: [], catalog: [] });
  assert.strictEqual(d.version, 6);
  assert.deepStrictEqual([d.recurring, d.templates, d.snippets], [[], [], []]);
  // version 4 : les trois listes d'achats arrivent vides, sans rien casser de l'existant
  assert.deepStrictEqual([d.suppliers, d.purchases, d.expenseCategories], [[], [], []]);
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
    assert.ok(isValidData(d) && d.version === 6);
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
  assert.deepStrictEqual(ids, ['retards', 'cloture', 'contrats', 'devis-acceptes', 'devis-expires', 'devis-sans-reponse', 'attestations', 'echeances', 'brouillons']);
  // 'cloture' : les pièces du jeu de test remontent à des mois terminés et rien n'est clôturé (6.0.0)
  assert.ok(todo.find(x => x.id === 'cloture').count > 0, 'des mois à clôturer');
  assert.strictEqual(todo[0].level, 'danger');
  assert.strictEqual(todo[0].count, 1);
  assert.ok(todo[0].detail.includes('72 jours'));
  assert.ok(todo[0].detail.includes('1 191,000 DT'), 'montant non formaté : ' + todo[0].detail);
  assert.ok(todo.find(x => x.id === 'attestations').detail.includes(' DT'));
  assert.ok(todo.find(x => x.id === 'contrats').detail.includes('septembre 2026'));
  const acc = todo.find(x => x.id === 'devis-acceptes');
  assert.strictEqual(acc.count, 1); assert.strictEqual(acc.docs[0].id, 'q3'); assert.ok(acc.detail.includes('1 190,000 DT'));
  // fiche société incomplète : signalée juste après les retards, avec ce qui manque
  const todoCo = core.todoList(data, { ...FULL, matricule: '', rib: '' }, T);
  const gapItem = todoCo.find(x => x.id === 'societe');
  assert.ok(gapItem, 'fiche société signalée');
  assert.ok(todoCo.indexOf(gapItem) <= 2, 'signalée tôt dans la liste');
  assert.ok(gapItem.detail.includes('le matricule fiscal') && gapItem.detail.includes('le RIB') && !gapItem.detail.includes('raison sociale'));
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

// ---------- achats et fournisseurs (3.0.0) ----------

const SUP = [{ id: 's1', name: 'Tunisie Matériel SARL' }, { id: 's2', name: 'Cabinet Compta Plus' }];
const buy = (o) => ({
  id: 'a1', kind: 'facture', supplierId: 's1', number: 'F-2026-4412', date: '2026-03-10', dueDate: '2026-04-09',
  subject: 'Serveur et disques', category: 'Achats de marchandises', payments: [], createdAt: 1,
  lines: [{ label: 'Serveur', qty: 1, unitPrice: 3000, vatRate: 19, destination: 'stock' }], ...o
});

t('achats : totaux, TVA déductible et destination des lignes', () => {
  const t1 = core.purchaseTotals(buy({
    lines: [
      { label: 'Serveur', qty: 2, unitPrice: 1000, vatRate: 19, destination: 'stock' },
      { label: 'Ordinateur portable', qty: 1, unitPrice: 2500, vatRate: 19, destination: 'immobilisation' },
      { label: 'Carburant', qty: 1, unitPrice: 100, vatRate: 19, destination: 'charge', deductible: false }
    ], fees: 1
  }), CO);
  assert.strictEqual(t1.totalHT, 4600);
  assert.strictEqual(t1.totalVAT, core.round3(4600 * 0.19));
  // la TVA de la ligne non déductible est comptée dans le total mais pas dans le déductible
  assert.strictEqual(t1.deductibleVAT, core.round3(4500 * 0.19));
  assert.strictEqual(t1.fees, 1);
  assert.strictEqual(t1.totalTTC, core.round3(4600 + 4600 * 0.19 + 1));
  assert.deepStrictEqual(t1.byDestination, { charge: 100, stock: 2000, immobilisation: 2500 });
  // une ligne sans destination est une charge : c'est le cas le plus courant et le moins risqué
  assert.strictEqual(core.purchaseTotals(buy({ lines: [{ label: 'X', qty: 1, unitPrice: 10, vatRate: 19 }] }), CO).lines[0].destination, 'charge');
  // ventilation par taux, avec la part déductible de chacun
  const byRate = core.purchaseTotals(buy({ lines: [
    { label: 'A', qty: 1, unitPrice: 100, vatRate: 19 },
    { label: 'B', qty: 1, unitPrice: 100, vatRate: 19, deductible: false },
    { label: 'C', qty: 1, unitPrice: 100, vatRate: 7 }
  ] }), CO).vatByRate;
  assert.strictEqual(byRate[19].base, 200);
  assert.strictEqual(byRate[19].vat, 38);
  assert.strictEqual(byRate[19].deductible, 19);
  assert.strictEqual(byRate[7].deductible, 7);
  // achat vide : aucun NaN
  const vide = core.purchaseTotals({ lines: [] }, CO);
  assert.strictEqual(vide.totalHT, 0); assert.strictEqual(vide.netToPay, 0);
});

t('achats : retenue à la source opérée sur un prestataire', () => {
  // on retient 3 % sur le TTC hors frais, et on ne paie que le net — l'écart est reversé au fisc
  const t1 = core.purchaseTotals(buy({ supplierId: 's2', withholdingRate: 3, fees: 1,
    lines: [{ label: 'Honoraires comptables', qty: 1, unitPrice: 1000, vatRate: 19, destination: 'charge' }] }), CO);
  assert.strictEqual(t1.withholding, core.round3(1190 * 0.03));
  assert.strictEqual(t1.netToPay, core.round3(1191 - 1190 * 0.03));
  // sans taux, rien n'est retenu
  assert.strictEqual(core.purchaseTotals(buy({}), CO).withholding, 0);
});

t('achats : statut déduit des paiements, jamais saisi', () => {
  const p = buy({ lines: [{ label: 'X', qty: 1, unitPrice: 1000, vatRate: 19 }] });
  const net = core.purchaseTotals(p, CO).netToPay;      // 1190
  assert.strictEqual(core.purchaseStatus(p, CO, '2026-03-15'), 'à payer');
  assert.strictEqual(core.purchaseStatus(p, CO, '2026-05-15'), 'retard');  // échéance 09/04 dépassée
  p.payments = [{ id: 'p1', date: '2026-03-20', amount: 500, method: 'virement' }];
  assert.strictEqual(core.purchaseStatus(p, CO, '2026-05-15'), 'partiel');
  assert.strictEqual(core.purchaseBalance(p, CO).remaining, core.round3(net - 500));
  p.payments.push({ id: 'p2', date: '2026-04-01', amount: net - 500, method: 'cheque' });
  assert.strictEqual(core.purchaseStatus(p, CO, '2026-05-15'), 'payée');
  assert.strictEqual(core.purchaseBalance(p, CO).remaining, 0);
  // sans échéance, on ne peut pas être en retard
  assert.strictEqual(core.purchaseStatus(buy({ dueDate: '' }), CO, '2030-01-01'), 'à payer');
});

t('achats : ce qu\'on doit, les plus en retard d\'abord', () => {
  const data = { suppliers: SUP, purchases: [
    buy({ id: 'a1', number: 'F-1', dueDate: '2026-08-01' }),
    buy({ id: 'a2', number: 'F-2', dueDate: '2026-06-01' }),
    buy({ id: 'a3', number: 'F-3', dueDate: '2026-12-01' }),
    buy({ id: 'a4', number: 'F-4', dueDate: '2026-05-01', payments: [{ id: 'p', date: '2026-05-01', amount: 99999 }] })
  ] };
  const due = core.payablesList(data, CO, '2026-09-11');
  assert.deepStrictEqual(due.map(x => x.number), ['F-2', 'F-1', 'F-3']);   // F-4 est soldée
  assert.strictEqual(due[0].late, 102);
  assert.strictEqual(due[2].late, 0);                                       // pas encore échue
  assert.ok(due.every(x => x.remaining > 0));
  assert.deepStrictEqual(core.payablesList({ purchases: [] }, CO, '2026-09-11'), []);
});

t('achats : journal, récapitulatif et fiche fournisseur', () => {
  const data = { suppliers: SUP, purchases: [
    buy({ id: 'a1', date: '2026-03-10', category: 'Achats de marchandises', lines: [{ label: 'Serveur', qty: 1, unitPrice: 1000, vatRate: 19 }] }),
    buy({ id: 'a2', date: '2026-04-02', supplierId: 's2', kind: 'depense', category: 'Honoraires (comptable, avocat)', number: '',
      lines: [{ label: 'Honoraires mars', qty: 1, unitPrice: 400, vatRate: 19, deductible: false }] }),
    buy({ id: 'a3', date: '2025-12-01', category: 'Fournitures de bureau', lines: [{ label: 'Papier', qty: 1, unitPrice: 60, vatRate: 19 }] })
  ] };
  const rows = core.purchaseJournal(data, CO, { from: '2026-01-01', to: '2026-12-31' });
  assert.strictEqual(rows.length, 2);                       // 2025 est hors période
  assert.deepStrictEqual(rows.map(r => r.id), ['a1', 'a2']); // ordre chronologique
  assert.strictEqual(rows[0].supplier, 'Tunisie Matériel SARL');
  assert.strictEqual(rows[1].kind, 'Dépense');
  const sum = core.purchaseSummary(rows);
  assert.strictEqual(sum.ht, 1400);
  assert.strictEqual(sum.tva, core.round3(1400 * 0.19));
  assert.strictEqual(sum.deductible, 190);                  // les honoraires sont marqués non déductibles
  assert.strictEqual(sum.byCategory[0].label, 'Achats de marchandises');
  assert.strictEqual(sum.byCategory[0].ht, 1000);
  // fiche fournisseur
  const f = core.supplierSummary(data, CO, 's1', '2026-09-11');
  assert.strictEqual(f.count, 2);
  assert.strictEqual(f.ht, 1060);
  assert.strictEqual(f.first, '2025-12-01');
  assert.strictEqual(f.last, '2026-03-10');
  assert.ok(f.remaining > 0 && f.late > 0);                 // les deux échéances sont passées
  // fournisseur sans achat
  assert.strictEqual(core.supplierSummary(data, CO, 'inconnu', '2026-09-11').count, 0);
});

t('achats : attestations de retenue à remettre au fournisseur', () => {
  const data = { suppliers: SUP, purchases: [
    buy({ id: 'a1', supplierId: 's2', withholdingRate: 3, lines: [{ label: 'Honoraires', qty: 1, unitPrice: 1000, vatRate: 19 }] }),
    buy({ id: 'a2', supplierId: 's2', withholdingRate: 3, withholdingCertificate: true, lines: [{ label: 'Honoraires', qty: 1, unitPrice: 500, vatRate: 19 }] }),
    buy({ id: 'a3', lines: [{ label: 'Papier', qty: 1, unitPrice: 60, vatRate: 19 }] })
  ] };
  const w = core.withholdingsToIssue(data, CO);
  assert.deepStrictEqual(w.map(x => x.id), ['a1']);         // a2 est déjà remise, a3 n'a pas de retenue
  assert.strictEqual(w[0].supplier, 'Cabinet Compta Plus');
  assert.strictEqual(w[0].amount, core.round3(1190 * 0.03));
});

t('achats : catégories de charges, celles d\'origine plus les ajoutées', () => {
  assert.ok(core.DEFAULT_EXPENSE_CATEGORIES.includes('Loyer et charges locatives'));
  const list = core.expenseCategories({ expenseCategories: ['Douane', 'Loyer et charges locatives', '  '] });
  assert.ok(list.includes('Douane'));
  assert.strictEqual(list.filter(x => x === 'Loyer et charges locatives').length, 1);   // pas de doublon
  assert.ok(!list.some(x => !x.trim()));
  assert.deepStrictEqual(core.expenseCategories({}), core.DEFAULT_EXPENSE_CATEGORIES);
});

t('démo : achats cohérents quelle que soit la date, tous les statuts présents', () => {
  ['2026-01-15', '2026-03-31', '2026-09-11', '2026-12-28', '2027-02-28'].forEach(day => {
    const d = buildDemoData({}, day);
    assert.strictEqual(d.version, 6);
    assert.ok(d.suppliers.length >= 4, day);
    assert.ok(d.purchases.length >= 8, day);
    // aucun règlement daté dans le futur : un jeu de démo ne doit jamais montrer l'impossible
    d.purchases.forEach(p => (p.payments || []).forEach(x => assert.ok(x.date <= day, `règlement futur ${x.date} > ${day}`)));
    // chaque achat pointe sur un fournisseur qui existe
    d.purchases.forEach(p => assert.ok(d.suppliers.some(s => s.id === p.supplierId), 'fournisseur orphelin'));
    // les quatre statuts sont représentés, quelle que soit la date du jour
    const statuts = new Set(d.purchases.map(p => core.purchaseStatus(p, d.company, day)));
    core.PURCHASE_STATUSES.forEach(st => assert.ok(statuts.has(st), `statut ${st} absent le ${day}`));
    // les trois destinations de ligne sont montrées : c'est ce qui prépare stock et immobilisations
    const dest = new Set();
    d.purchases.forEach(p => core.purchaseTotals(p, d.company).lines.forEach(l => dest.add(l.destination)));
    assert.deepStrictEqual([...dest].sort(), ['charge', 'immobilisation', 'stock']);
    // une TVA non déductible et une retenue opérée, pour que les deux cas se voient
    assert.ok(d.purchases.some(p => core.purchaseTotals(p, d.company).deductibleVAT < core.purchaseTotals(p, d.company).totalVAT));
    assert.strictEqual(core.withholdingsToIssue(d, d.company).length, 1);
    // le panneau « À faire » parle des fournisseurs
    const ids = core.todoList(d, d.company, day).map(x => x.id);
    assert.ok(ids.includes('fournisseurs-retard'), 'retard fournisseur absent du À faire le ' + day);
    assert.ok(ids.includes('attestations-fournisseurs'), 'attestation fournisseur absente le ' + day);
  });
});

// ---------- TVA réelle et calendrier fiscal (3.1.0) ----------

t('TVA : collectée moins déductible, crédit reportable', () => {
  const inv2 = (o) => ({ id: 'i' + Math.random(), type: 'facture', number: 'FAC-2026-001', status: 'envoyée',
    date: '2026-03-10', dueDate: '2026-04-09', clientId: 'c1', payments: [], createdAt: 1, ...o });
  const data = {
    clients: [{ id: 'c1', name: 'Alpha' }], suppliers: [{ id: 's1', name: 'Beta' }], counters: {},
    documents: [inv2({ lines: [{ label: 'Audit', qty: 1, unitPrice: 10000, vatRate: 19 }] })],
    purchases: [{ id: 'a1', kind: 'facture', supplierId: 's1', number: 'F-1', date: '2026-03-05', payments: [], createdAt: 1,
      lines: [{ label: 'Serveur', qty: 1, unitPrice: 4000, vatRate: 19 }] }]
  };
  const p = { from: '2026-03-01', to: '2026-03-31' };
  const r = core.vatReturn(data, CO, p, 0);
  assert.strictEqual(r.collected, 1900);
  assert.strictEqual(r.deductible, 760);
  assert.strictEqual(r.toPay, 1140);
  assert.strictEqual(r.carryOut, 0);
  assert.strictEqual(r.byRate[19].collected, 1900);
  assert.strictEqual(r.byRate[19].deductible, 760);
  assert.strictEqual(r.stamps, 1);                       // le timbre est déclaré à part
  // un crédit reporté vient en déduction
  assert.strictEqual(core.vatReturn(data, CO, p, 400).toPay, 740);
  // gros achat : on bascule en crédit de TVA, rien à payer
  data.purchases[0].lines[0].unitPrice = 20000;
  const cred = core.vatReturn(data, CO, p, 0);
  assert.strictEqual(cred.toPay, 0);
  assert.strictEqual(cred.carryOut, core.round3(20000 * 0.19 - 1900));
  // une TVA non déductible ne vient pas en déduction
  data.purchases[0].lines[0].deductible = false;
  assert.strictEqual(core.vatReturn(data, CO, p, 0).deductible, 0);
  assert.strictEqual(core.vatReturn(data, CO, p, 0).toPay, 1900);
  // période vide : tout à zéro, pas de NaN
  const vide = core.vatReturn(data, CO, { from: '2020-01-01', to: '2020-12-31' }, 0);
  assert.strictEqual(vide.collected, 0); assert.strictEqual(vide.toPay, 0); assert.strictEqual(vide.carryOut, 0);
});

t('TVA : le crédit d\'un mois se reporte sur le suivant', () => {
  const mk = (date, ht) => ({ id: 'i' + date, type: 'facture', number: 'FAC-' + date, status: 'envoyée', date,
    dueDate: date, clientId: 'c1', payments: [], createdAt: 1, lines: [{ label: 'x', qty: 1, unitPrice: ht, vatRate: 19 }] });
  const buy2 = (date, ht) => ({ id: 'a' + date, kind: 'facture', supplierId: 's1', number: 'F-' + date, date, payments: [], createdAt: 1,
    lines: [{ label: 'y', qty: 1, unitPrice: ht, vatRate: 19 }] });
  const data = {
    clients: [{ id: 'c1', name: 'Alpha' }], suppliers: [{ id: 's1', name: 'Beta' }], counters: {},
    documents: [mk('2026-01-10', 1000), mk('2026-02-10', 1000), mk('2026-03-10', 5000)],
    purchases: [buy2('2026-01-05', 6000), buy2('2026-02-05', 500)]
  };
  const chain = core.vatChain(data, CO, 2026, 3);
  assert.strictEqual(chain.length, 3);
  // janvier : gros achat → crédit
  assert.strictEqual(chain[0].toPay, 0);
  assert.strictEqual(chain[0].carryOut, core.round3(6000 * 0.19 - 1000 * 0.19));
  // février : le crédit de janvier est repris, et il reste du crédit
  assert.strictEqual(chain[1].carryIn, chain[0].carryOut);
  assert.strictEqual(chain[1].toPay, 0);
  // mars : le crédit restant est absorbé, il reste à payer
  assert.strictEqual(chain[2].carryIn, chain[1].carryOut);
  assert.strictEqual(chain[2].toPay, core.round3(5000 * 0.19 - chain[1].carryOut));
  assert.strictEqual(chain[2].label, 'mars');
  // crédit venu de l'année précédente, saisi à la main
  const avec = core.vatChain({ ...data, vatCarryIn: { 2026: 500 } }, CO, 2026, 1);
  assert.strictEqual(avec[0].carryIn, 500);
  assert.strictEqual(avec[0].carryOut, core.round3(chain[0].carryOut + 500));
});

t('calendrier fiscal : prochaine échéance de chaque règle', () => {
  const mensuel = { every: 'month', day: 28 };
  assert.strictEqual(core.nextDeadline(mensuel, '2026-09-11'), '2026-09-28');
  assert.strictEqual(core.nextDeadline(mensuel, '2026-09-28'), '2026-09-28');   // le jour même compte encore
  assert.strictEqual(core.nextDeadline(mensuel, '2026-09-29'), '2026-10-28');
  // un jour qui n'existe pas dans le mois est ramené à la fin du mois
  assert.strictEqual(core.nextDeadline({ every: 'month', day: 31 }, '2026-02-01'), '2026-02-28');
  assert.strictEqual(core.nextDeadline({ every: 'month', day: 31 }, '2024-02-01'), '2024-02-29');
  // trimestriel
  const trim = { every: 'months', months: [6, 9, 12], day: 28 };
  assert.strictEqual(core.nextDeadline(trim, '2026-07-01'), '2026-09-28');
  assert.strictEqual(core.nextDeadline(trim, '2026-12-29'), '2027-06-28');      // bascule d'année
  // annuel
  assert.strictEqual(core.nextDeadline({ every: 'year', month: 4, day: 30 }, '2026-09-11'), '2027-04-30');
  // les échéances proches, triées
  const up = core.upcomingFiscal({}, '2026-09-11', 40);
  assert.ok(up.length);
  assert.ok(up.every(x => x.days <= 40 && x.days >= 0));
  assert.deepStrictEqual(up.map(x => x.date), up.map(x => x.date).slice().sort());
  assert.ok(up.some(x => x.id === 'tva'));
  // une règle désactivée ne remonte pas ; une règle ajoutée oui
  const off = core.upcomingFiscal({ fiscalDeadlines: [{ id: 'tva', active: false }] }, '2026-09-11', 40);
  assert.ok(!off.some(x => x.id === 'tva'));
  const on = core.upcomingFiscal({ fiscalDeadlines: [{ id: 'tcl', active: true }] }, '2026-09-11', 40);
  assert.ok(on.some(x => x.id === 'tcl'));
  // personnaliser le jour d'une règle existante ne casse pas le reste
  const moved = core.fiscalDeadlines({ fiscalDeadlines: [{ id: 'tva', day: 15 }] }).find(x => x.id === 'tva');
  assert.strictEqual(moved.day, 15);
  assert.ok(moved.label.includes('TVA'));
});

t('résultat simple : stock et immobilisations ne sont pas des charges', () => {
  const data = {
    clients: [{ id: 'c1', name: 'Alpha' }], suppliers: [{ id: 's1', name: 'Beta' }], counters: {},
    documents: [{ id: 'i1', type: 'facture', number: 'FAC-1', status: 'envoyée', date: '2026-03-10', dueDate: '2026-04-09',
      clientId: 'c1', payments: [], createdAt: 1, lines: [{ label: 'x', qty: 1, unitPrice: 10000, vatRate: 19 }] }],
    purchases: [{ id: 'a1', kind: 'facture', supplierId: 's1', number: 'F-1', date: '2026-03-05', payments: [], createdAt: 1, fees: 1,
      lines: [
        { label: 'Loyer', qty: 1, unitPrice: 1000, vatRate: 19, destination: 'charge' },
        { label: 'Marchandise', qty: 1, unitPrice: 3000, vatRate: 19, destination: 'stock' },
        { label: 'Ordinateur', qty: 1, unitPrice: 2000, vatRate: 19, destination: 'immobilisation' }
      ] }]
  };
  const r = core.simpleResult(data, CO, { from: '2026-03-01', to: '2026-03-31' });
  assert.strictEqual(r.produits, 10000);
  assert.strictEqual(r.charges, 1001);      // loyer + timbre, pas la marchandise ni l'ordinateur
  assert.strictEqual(r.stock, 3000);
  assert.strictEqual(r.immo, 2000);
  assert.strictEqual(r.resultat, 8999);
  assert.strictEqual(r.marge, 90);
  // aucune vente : pas de division par zéro
  assert.strictEqual(core.simpleResult({ documents: [], purchases: [] }, CO, { from: '2026-01-01', to: '2026-12-31' }).marge, null);
});

// ---------- travailler à deux (3.2.0) ----------

const mkDoc = (id, o) => ({ id, type: 'facture', number: 'FAC-2026-' + id, status: 'envoyée', date: '2026-03-10',
  dueDate: '2026-04-09', clientId: 'c1', payments: [], createdAt: 1, lines: [{ label: 'x', qty: 1, unitPrice: 100, vatRate: 19 }], ...o });
const base = (o) => core.migrateData({ company: { name: 'Ma boîte', matricule: 'MF1' }, clients: [{ id: 'c1', name: 'Alpha' }],
  catalog: [], documents: [], counters: {}, ...o });

t('fusion : chacun ajoute de son côté, rien ne se perd', () => {
  const mine = base({ documents: [mkDoc('001')], syncWrittenAt: 100 });
  const theirs = base({ documents: [mkDoc('002')], syncWrittenAt: 200 });
  const r = core.mergeData(mine, theirs);
  assert.deepStrictEqual(r.data.documents.map(d => d.id).sort(), ['001', '002']);
  assert.strictEqual(r.counts.conflicts, 0);
  assert.strictEqual(r.counts.duplicates, 0);
  assert.strictEqual(r.counts.added, 1);                 // la pièce venue du perdant
  // la fusion ne modifie aucune des deux entrées
  assert.strictEqual(mine.documents.length, 1);
  assert.strictEqual(theirs.documents.length, 1);
  // et elle est symétrique sur le contenu
  const inverse = core.mergeData(theirs, mine);
  assert.deepStrictEqual(inverse.data.documents.map(d => d.id).sort(), ['001', '002']);
});

t('fusion : la même pièce modifiée des deux côtés est signalée, pas écrasée en silence', () => {
  const mine = base({ documents: [mkDoc('001', { subject: 'Version de ce poste' })], syncWrittenAt: 100 });
  const theirs = base({ documents: [mkDoc('001', { subject: 'Version de l\'autre poste' })], syncWrittenAt: 200 });
  const r = core.mergeData(mine, theirs);
  assert.strictEqual(r.data.documents.length, 1);
  assert.strictEqual(r.data.documents[0].subject, 'Version de l\'autre poste');   // le fichier le plus récent tranche
  assert.strictEqual(r.counts.conflicts, 1);
  assert.strictEqual(r.conflicts[0].label, 'Facture FAC-2026-001');
  assert.strictEqual(r.keptFrom, 'autre poste');
  // la version écartée est archivée, jamais détruite
  assert.strictEqual(r.data.conflictArchive.length, 1);
  assert.strictEqual(r.data.conflictArchive[0].record.subject, 'Version de ce poste');
  // si c'est notre fichier le plus récent, c'est le nôtre qui gagne
  const r2 = core.mergeData(base({ documents: [mkDoc('001', { subject: 'A' })], syncWrittenAt: 300 }),
                            base({ documents: [mkDoc('001', { subject: 'B' })], syncWrittenAt: 200 }));
  assert.strictEqual(r2.data.documents[0].subject, 'A');
  assert.strictEqual(r2.keptFrom, 'ce poste');
  // une pièce identique des deux côtés n'est pas un conflit
  assert.strictEqual(core.mergeData(base({ documents: [mkDoc('001')], syncWrittenAt: 100 }),
                                    base({ documents: [mkDoc('001')], syncWrittenAt: 200 })).counts.conflicts, 0);
});

t('fusion : une pièce supprimée ne ressuscite pas', () => {
  const theirs = base({ documents: [mkDoc('001'), mkDoc('002')], syncWrittenAt: 100 });
  // ici on supprime 002 et on le note
  let mine = base({ documents: [mkDoc('001')], syncWrittenAt: 200 });
  core.trackDeletion(mine, 'documents', '002', 'Facture FAC-2026-002');
  const r = core.mergeData(mine, theirs);
  assert.deepStrictEqual(r.data.documents.map(d => d.id), ['001']);
  assert.strictEqual(r.data.deleted.length, 1);
  // la trace se propage : une fusion suivante la respecte aussi
  assert.deepStrictEqual(core.mergeData(theirs, r.data).data.documents.map(d => d.id), ['001']);
  // sans trace de suppression, la pièce reviendrait — c'est bien pour ça que la trace existe
  const sans = core.mergeData(base({ documents: [mkDoc('001')], syncWrittenAt: 200 }), theirs);
  assert.strictEqual(sans.data.documents.length, 2);
  // trackDeletion ne crée pas de doublon
  core.trackDeletion(mine, 'documents', '002', 'x');
  assert.strictEqual(mine.deleted.length, 1);
});

t('fusion : les compteurs ne redescendent jamais, les doublons de numéro sont signalés', () => {
  const mine = base({ counters: { 'facture-2026': 12 }, syncWrittenAt: 100 });
  const theirs = base({ counters: { 'facture-2026': 9, 'devis-2026': 4 }, syncWrittenAt: 200 });
  const r = core.mergeData(mine, theirs);
  assert.strictEqual(r.data.counters['facture-2026'], 12);   // on garde le plus haut, jamais le dernier écrit
  assert.strictEqual(r.data.counters['devis-2026'], 4);
  // deux postes hors ligne ont émis le même numéro : SkanFact ne peut pas trancher, il alerte
  const d1 = core.mergeData(
    base({ documents: [mkDoc('a', { number: 'FAC-2026-012' })], syncWrittenAt: 100 }),
    base({ documents: [mkDoc('b', { number: 'FAC-2026-012' })], syncWrittenAt: 200 }));
  assert.strictEqual(d1.counts.duplicates, 1);
  assert.strictEqual(d1.duplicates[0].number, 'FAC-2026-012');
  // deux brouillons sans numéro ne sont pas des doublons
  assert.strictEqual(core.mergeData(
    base({ documents: [mkDoc('a', { number: '', status: 'brouillon' })], syncWrittenAt: 100 }),
    base({ documents: [mkDoc('b', { number: '', status: 'brouillon' })], syncWrittenAt: 200 })).counts.duplicates, 0);
});

t('fusion : société, achats et fournisseurs suivent la même règle', () => {
  const mine = base({ company: { name: 'Ma boîte', matricule: 'MF1', phone: '111' },
    suppliers: [{ id: 's1', name: 'Alpha' }], purchases: [{ id: 'p1', kind: 'facture', supplierId: 's1', number: 'F-1', date: '2026-01-01', lines: [], payments: [] }],
    syncWrittenAt: 100 });
  const theirs = base({ company: { name: 'Ma boîte', matricule: 'MF1', phone: '222' },
    suppliers: [{ id: 's2', name: 'Beta' }], purchases: [{ id: 'p2', kind: 'depense', supplierId: 's2', number: '', date: '2026-02-01', lines: [], payments: [] }],
    syncWrittenAt: 200 });
  const r = core.mergeData(mine, theirs);
  assert.deepStrictEqual(r.data.suppliers.map(s => s.id).sort(), ['s1', 's2']);
  assert.deepStrictEqual(r.data.purchases.map(p => p.id).sort(), ['p1', 'p2']);
  assert.strictEqual(r.data.company.phone, '222');         // fiche société : le fichier le plus récent
  assert.ok(r.conflicts.some(c => c.kind === 'company'));
  // une société identique des deux côtés ne déclenche rien
  assert.strictEqual(core.mergeData(mine, base({ ...mine, syncWrittenAt: 300 })).conflicts.filter(c => c.kind === 'company').length, 0);
  // le résultat reste un fichier valide au sens du stockage
  assert.ok(isValidData(r.data));
  assert.strictEqual(r.data.version, 6);
});

t('stockage : un autre poste a enregistré entre-temps — on refuse d\'écraser', () => {
  const dir = tmpDir();
  // deux postes qui partagent le même dossier
  const moi = createStorage(dir, { deviceId: 'poste-A', deviceName: 'Mac de Skander' });
  const lui = createStorage(dir, { deviceId: 'poste-B', deviceName: 'PC du bureau' });
  const r1 = moi.write({ ...core.DEFAULT_DATA, clients: [{ id: 'a', name: 'Alpha' }] });
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.revision, 1);
  // les deux lisent la même version
  const mien = moi.read(), sien = lui.read();
  assert.strictEqual(mien.syncRevision, 1);
  assert.strictEqual(sien.syncRevision, 1);
  assert.strictEqual(mien.syncDeviceName, 'Mac de Skander');
  // l'autre poste enregistre en premier
  assert.strictEqual(lui.write({ ...sien, clients: [{ id: 'b', name: 'Beta' }] }).ok, true);
  // notre enregistrement est refusé, et il nous rend leur version pour qu'on fusionne
  const r2 = moi.write({ ...mien, clients: [{ id: 'a', name: 'Alpha modifié' }] });
  assert.strictEqual(r2.conflict, true);
  assert.strictEqual(r2.diskRevision, 2);
  assert.strictEqual(r2.myRevision, 1);
  assert.strictEqual(r2.disk.clients[0].name, 'Beta');
  // le fichier sur le disque n'a PAS été touché : c'est tout l'intérêt
  assert.strictEqual(JSON.parse(fs.readFileSync(moi.file, 'utf8')).clients[0].name, 'Beta');
  // après fusion, on réécrit de force et la révision repart du plus haut numéro vu
  const fus = core.mergeData({ ...mien, clients: [{ id: 'a', name: 'Alpha modifié' }], syncWrittenAt: 10 }, r2.disk);
  const r3 = moi.write(fus.data, { force: true });
  assert.strictEqual(r3.ok, true);
  assert.ok(r3.revision > 2);
  assert.deepStrictEqual(moi.read().clients.map(c => c.name).sort(), ['Alpha modifié', 'Beta']);
  // et l'enregistrement suivant du même poste passe sans conflit
  assert.strictEqual(moi.write(moi.read()).ok, true);
});

t('stockage : le garde-fou ne bloque jamais un poste seul', () => {
  const s = createStorage(tmpDir(), { deviceId: 'seul' });
  // fichier absent : rien à comparer, on écrit
  assert.strictEqual(s.write(core.DEFAULT_DATA).ok, true);
  // écritures successives du même poste : la révision monte, aucun conflit
  for (let i = 0; i < 5; i++) assert.strictEqual(s.write({ ...core.DEFAULT_DATA, counters: { i } }).ok, true);
  assert.strictEqual(s.read().syncRevision, 6);
  // fichier chiffré et verrouillé : on ne peut pas comparer, on ne bloque pas pour autant
  const s2 = createStorage(tmpDir(), { deviceId: 'x' });
  s2.write(core.DEFAULT_DATA);
  s2.setPassword({ data: s2.read(), password: 'secret123' });
  assert.strictEqual(s2.write({ ...s2.read(), clients: [] }).ok, true);
});

// ---------- trésorerie (3.3.0) ----------

const tAcc = (id, o) => ({ id, name: id, kind: 'banque', opening: 0, openingDate: '2026-01-01', isDefault: false, statementBalance: '', ...o });
const tInv = (id, date, ht, pays) => ({ id, type: 'facture', number: 'FAC-' + id, status: 'envoyée', date,
  dueDate: core.addDays(date, 30), clientId: 'c1', createdAt: 1,
  lines: [{ label: 'x', qty: 1, unitPrice: ht, vatRate: 19 }], payments: pays || [] });
const tBuy = (id, date, ht, pays) => ({ id, kind: 'facture', supplierId: 's1', number: 'F-' + id, date,
  dueDate: core.addDays(date, 30), createdAt: 1, lines: [{ label: 'y', qty: 1, unitPrice: ht, vatRate: 19 }], payments: pays || [] });

t('trésorerie : les mouvements sont déduits, jamais ressaisis', () => {
  const data = core.migrateData({
    clients: [{ id: 'c1', name: 'Alpha' }], suppliers: [{ id: 's1', name: 'Beta' }],
    accounts: [tAcc('b1', { name: 'BIAT', opening: 5000, isDefault: true }), tAcc('cx', { name: 'Caisse', kind: 'caisse', opening: 200 })],
    documents: [tInv('1', '2026-03-01', 1000, [{ id: 'p1', date: '2026-03-15', amount: 1191, method: 'virement' }])],
    purchases: [tBuy('a', '2026-03-05', 500, [{ id: 'p2', date: '2026-03-20', amount: 595, method: 'cheque' }])],
    movements: [{ id: 'm1', date: '2026-03-25', kind: 'salaire', amount: 900, accountId: 'b1' },
                { id: 'm2', date: '2026-03-28', kind: 'apport', amount: 2000, accountId: 'b1' },
                { id: 'm3', date: '2026-03-10', kind: 'autre-sortie', amount: 40, accountId: 'cx', label: 'Timbres' }]
  });
  const all = core.cashMovements(data, CO, { from: '2026-01-01', to: '2026-12-31' });
  assert.strictEqual(all.length, 5);
  assert.deepStrictEqual(all.map(m => m.date), ['2026-03-10', '2026-03-15', '2026-03-20', '2026-03-25', '2026-03-28']);
  // signes : ce qui rentre est positif, ce qui sort est négatif — le signe vient du type, jamais de la saisie
  assert.strictEqual(all.find(m => m.kind === 'encaissement').amount, 1191);
  assert.strictEqual(all.find(m => m.kind === 'decaissement').amount, -595);
  assert.strictEqual(all.find(m => m.movementId === 'm1').amount, -900);
  assert.strictEqual(all.find(m => m.movementId === 'm2').amount, 2000);
  // solde par compte : départ + mouvements du compte
  const b = core.accountBalance(data, CO, 'b1', '2026-12-31');
  assert.strictEqual(b.opening, 5000);
  assert.strictEqual(b.balance, core.round3(5000 + 1191 - 595 - 900 + 2000));
  assert.strictEqual(core.accountBalance(data, CO, 'cx', '2026-12-31').balance, 160);
  // un solde à une date passée ignore ce qui vient après
  assert.strictEqual(core.accountBalance(data, CO, 'b1', '2026-03-16').balance, 6191);
  // total tous comptes
  const pos = core.cashPosition(data, CO, '2026-12-31');
  assert.strictEqual(pos.accounts.length, 2);
  assert.strictEqual(pos.total, core.round3(6696 + 160));
  // compte inconnu : pas de plantage
  assert.strictEqual(core.accountBalance(data, CO, 'nexistepas', '2026-12-31').balance, 0);
});

t('trésorerie : un paiement sans compte tombe sur le compte par défaut', () => {
  const data = core.migrateData({
    clients: [{ id: 'c1', name: 'Alpha' }],
    accounts: [tAcc('b1', { opening: 100, isDefault: true }), tAcc('b2', { opening: 0 })],
    documents: [tInv('1', '2026-03-01', 1000, [{ id: 'p1', date: '2026-03-15', amount: 500 }])]
  });
  assert.strictEqual(core.accountBalance(data, CO, 'b1', '2026-12-31').balance, 600);
  assert.strictEqual(core.accountBalance(data, CO, 'b2', '2026-12-31').balance, 0);
  assert.strictEqual(core.cashMovements(data, CO, {}, 'b1').length, 1);
  assert.strictEqual(core.cashMovements(data, CO, {}, 'b2').length, 0);
});

t('trésorerie : la prévision dit à quelle date on passe en négatif', () => {
  const data = core.migrateData({
    clients: [{ id: 'c1', name: 'Alpha' }], suppliers: [{ id: 's1', name: 'Beta' }],
    accounts: [tAcc('b1', { opening: 1000, isDefault: true })],
    // une grosse sortie proche, une rentrée lointaine : le classique trou de trésorerie
    purchases: [tBuy('a', '2026-09-01', 5000)],                   // échéance 01/10
    documents: [tInv('1', '2026-09-20', 8000)]                    // échéance 20/10
  });
  const f = core.cashForecast(data, CO, 90, '2026-09-11');
  assert.strictEqual(f.start, 1000);
  assert.strictEqual(f.events.length, 2);
  assert.deepStrictEqual(f.events.map(e => e.kind), ['fournisseur', 'client']);
  // on passe en négatif le 1er octobre, et on remonte le 20
  assert.ok(f.shortfall, 'aucun creux détecté');
  assert.strictEqual(f.shortfall.date, '2026-10-01');
  assert.strictEqual(f.shortfall.balance, core.round3(1000 - 5950));
  assert.strictEqual(f.end, core.round3(1000 - 5950 + 9521));
  assert.ok(f.end > 0);                                           // à la fin tout va bien : c'est le piège
  // l'ordre chronologique est garanti, et le premier point est aujourd'hui
  assert.strictEqual(f.points[0].date, '2026-09-11');
  assert.deepStrictEqual(f.points.map(p => p.date), ['2026-09-11', '2026-10-01', '2026-10-20']);
  // sans trou, rien n'est signalé
  const riche = core.cashForecast(core.migrateData({ ...data, accounts: [tAcc('b1', { opening: 50000, isDefault: true })] }), CO, 90, '2026-09-11');
  assert.strictEqual(riche.shortfall, null);
});

t('trésorerie : une échéance déjà passée est attendue tout de suite, pas à sa date', () => {
  const data = core.migrateData({
    clients: [{ id: 'c1', name: 'Alpha' }], suppliers: [{ id: 's1', name: 'Beta' }],
    accounts: [tAcc('b1', { opening: 0, isDefault: true })],
    documents: [tInv('1', '2026-01-05', 1000)],                   // échue depuis longtemps
    purchases: [tBuy('a', '2026-02-01', 200)]                     // échue aussi
  });
  const f = core.cashForecast(data, CO, 90, '2026-09-11');
  // les deux sont ramenées à aujourd'hui : se dire qu'elles rentreront « à leur date » serait se mentir
  assert.ok(f.events.every(e => e.date === '2026-09-11'));
  assert.strictEqual(f.late.clients.length, 1);
  assert.strictEqual(f.late.suppliers.length, 1);
  // une facture soldée ne figure pas dans la prévision
  const solde = core.migrateData({ ...data, documents: [tInv('1', '2026-01-05', 1000, [{ id: 'p', date: '2026-02-01', amount: 99999 }])] });
  assert.strictEqual(core.cashForecast(solde, CO, 90, '2026-09-11').events.filter(e => e.kind === 'client').length, 0);
  // rien au-delà de l'horizon
  const loin = core.migrateData({ ...data, documents: [tInv('1', '2027-06-01', 1000)] });
  assert.strictEqual(core.cashForecast(loin, CO, 30, '2026-09-11').events.filter(e => e.kind === 'client').length, 0);
});

t('trésorerie : rapprochement bancaire, écart avec le relevé', () => {
  const data = core.migrateData({
    clients: [{ id: 'c1', name: 'Alpha' }],
    accounts: [tAcc('b1', { opening: 1000, isDefault: true, statementBalance: 1500 })],
    documents: [tInv('1', '2026-03-01', 1000, [
      { id: 'p1', date: '2026-03-10', amount: 500, reconciled: true },   // pointé sur le relevé
      { id: 'p2', date: '2026-03-20', amount: 300 }                      // pas encore pointé
    ])]
  });
  const r = core.reconciliation(data, CO, 'b1', '2026-12-31');
  assert.strictEqual(r.balance, 1800);          // ce que dit SkanFact
  assert.strictEqual(r.pointed, 1500);          // ce qui devrait tomber sur le relevé
  assert.strictEqual(r.statement, 1500);
  assert.strictEqual(r.gap, 0);                 // ça tombe juste
  assert.strictEqual(r.pendingCount, 1);
  assert.strictEqual(r.pendingAmount, 300);
  // relevé faux : l'écart se voit
  data.accounts[0].statementBalance = 1450;
  assert.strictEqual(core.reconciliation(data, CO, 'b1', '2026-12-31').gap, 50);
  // relevé non saisi : pas d'écart inventé
  data.accounts[0].statementBalance = '';
  assert.strictEqual(core.reconciliation(data, CO, 'b1', '2026-12-31').gap, null);
  assert.strictEqual(core.reconciliation(data, CO, 'inconnu', '2026-12-31'), null);
});

t('démo : trésorerie cohérente quelle que soit la date', () => {
  ['2026-01-15', '2026-09-11', '2026-12-28', '2027-02-28'].forEach(day => {
    const d = buildDemoData({}, day);
    assert.strictEqual(d.accounts.length, 2, day);
    assert.ok(d.accounts.some(a => a.isDefault), 'aucun compte par défaut');
    // Depuis la 5.0.0 les salaires viennent des bulletins, pas de mouvements saisis : on compte donc
    // ce qui alimente vraiment la trésorerie, pas seulement la liste des mouvements libres.
    assert.ok(d.movements.length >= 12, day);
    assert.ok(core.cashMovements(d, d.company).length >= 30, day);
    // les salaires réglés sortent bien l'argent, sans mouvement libre en double
    assert.ok(core.cashMovements(d, d.company).some(m => m.source === 'paie'), `aucune sortie de salaire le ${day}`);
    assert.ok(!d.movements.some(m => m.kind === 'salaire'), 'un mouvement « Salaires » ferait double emploi avec les bulletins');
    // aucun mouvement daté dans le futur : on ne montre jamais de l'argent qui n'est pas encore sorti
    d.movements.forEach(m => assert.ok(m.date <= day, `mouvement futur ${m.date} > ${day}`));
    // chaque mouvement pointe sur un compte qui existe
    d.movements.forEach(m => assert.ok(d.accounts.some(a => a.id === m.accountId), 'compte orphelin'));
    // le solde est positif et se recompose : départ + mouvements
    const pos = core.cashPosition(d, d.company, day);
    assert.ok(pos.total > 0, `solde négatif le ${day} : ${pos.total}`);
    const recompose = core.round3(pos.accounts.reduce((s, a) => s + a.opening + a.movements, 0));
    assert.strictEqual(pos.total, recompose);
    // la prévision produit des échéances, et sa courbe part du solde du jour
    const f = core.cashForecast(d, d.company, 90, day);
    assert.ok(f.events.length > 0, `aucune échéance prévue le ${day}`);
    assert.strictEqual(f.points[0].balance, pos.total);
    assert.strictEqual(f.points.length, f.events.length + 1);
    // le rapprochement a de quoi travailler : des mouvements pointés et d'autres non
    const reco = core.reconciliation(d, d.company, d.accounts[0].id, day);
    assert.ok(reco.pendingCount > 0, 'rien à pointer');
    assert.ok(reco.moves.some(m => m.reconciled), 'rien de déjà pointé');
  });
});

// ---------- marges et rentabilité (3.4.0) ----------

const mCat = [{ id: 'k1', label: 'Serveur', unitPrice: 1500, unitCost: 1000, vatRate: 19 },
              { id: 'k2', label: 'Installation', unitPrice: 300, unitCost: 0, vatRate: 19 }];
const mInv = (id, o) => ({ id, type: 'facture', number: 'FAC-' + id, status: 'envoyée', date: '2026-03-10',
  dueDate: '2026-04-09', clientId: 'c1', payments: [], createdAt: 1, ...o });

t('marge : le coût vient de la ligne, sinon du catalogue', () => {
  const data = core.migrateData({ clients: [{ id: 'c1', name: 'Alpha' }], catalog: mCat });
  // coût pris dans le catalogue par correspondance du libellé
  const d1 = mInv('1', { lines: [{ label: 'Serveur', qty: 2, unitPrice: 1500, vatRate: 19 }] });
  const m1 = core.documentMargin(d1, data, CO);
  assert.strictEqual(m1.revenue, 3000);
  assert.strictEqual(m1.cost, 2000);
  assert.strictEqual(m1.margin, 1000);
  assert.strictEqual(m1.rate, 33.3);
  assert.strictEqual(m1.complete, true);
  // un coût saisi sur la ligne l'emporte sur le catalogue
  const d2 = mInv('2', { lines: [{ label: 'Serveur', qty: 2, unitPrice: 1500, unitCost: 1200, vatRate: 19 }] });
  assert.strictEqual(core.documentMargin(d2, data, CO).cost, 2400);
  // un coût à zéro saisi explicitement est respecté, il ne retombe pas sur le catalogue
  assert.strictEqual(core.documentMargin(mInv('3', { lines: [{ label: 'Serveur', qty: 1, unitPrice: 1500, unitCost: 0, vatRate: 19 }] }), data, CO).cost, 0);
  // aucun coût connu : la marge vaut le chiffre d'affaires, mais « complete » dit que c'est une illusion
  const inconnu = core.documentMargin(mInv('4', { lines: [{ label: 'Prestation inconnue', qty: 1, unitPrice: 500, vatRate: 19 }] }), data, CO);
  assert.strictEqual(inconnu.margin, 500);
  assert.strictEqual(inconnu.complete, false);
  assert.strictEqual(inconnu.costed, 0);
  // la remise globale ampute le prix de vente, jamais le coût d'achat
  const remise = core.documentMargin(mInv('5', { discountRate: 10, lines: [{ label: 'Serveur', qty: 1, unitPrice: 1500, vatRate: 19 }] }), data, CO);
  assert.strictEqual(remise.revenue, 1350);
  assert.strictEqual(remise.cost, 1000);
  assert.strictEqual(remise.margin, 350);
  // un avoir retranche des deux côtés
  const avoir = core.documentMargin({ id: 'a', type: 'avoir', status: 'émis', number: 'AVO-1', date: '2026-03-20',
    clientId: 'c1', lines: [{ label: 'Serveur', qty: 1, unitPrice: 1500, vatRate: 19 }] }, data, CO);
  assert.strictEqual(avoir.revenue, -1500);
  assert.strictEqual(avoir.cost, -1000);
  // une ligne de déduction d'acompte n'est ni un produit ni un coût
  const acompte = core.documentMargin(mInv('6', { lines: [
    { label: 'Serveur', qty: 1, unitPrice: 1500, vatRate: 19 },
    { label: 'Acompte déjà facturé', qty: 1, unitPrice: -500, vatRate: 19, noDiscount: true }] }), data, CO);
  assert.strictEqual(acompte.revenue, 1500);
  assert.strictEqual(acompte.lines, 1);
});

t('marge : par client et par prestation', () => {
  const data = core.migrateData({
    clients: [{ id: 'c1', name: 'Alpha' }, { id: 'c2', name: 'Beta' }], catalog: mCat,
    documents: [
      mInv('1', { clientId: 'c1', lines: [{ label: 'Serveur', qty: 2, unitPrice: 1500, vatRate: 19 }] }),
      mInv('2', { clientId: 'c2', lines: [{ label: 'Installation', qty: 3, unitPrice: 300, vatRate: 19 }] }),
      mInv('3', { clientId: 'c1', date: '2025-06-01', lines: [{ label: 'Serveur', qty: 1, unitPrice: 1500, vatRate: 19 }] })
    ]
  });
  const p = ['2026-01-01', '2026-12-31'];
  const parClient = core.marginBy(data, CO, p[0], p[1], 'client');
  assert.strictEqual(parClient.length, 2);
  assert.strictEqual(parClient[0].label, 'Alpha');         // trié par marge décroissante
  assert.strictEqual(parClient[0].margin, 1000);
  assert.strictEqual(parClient[1].label, 'Beta');
  assert.strictEqual(parClient[1].margin, 900);            // installation sans coût connu
  assert.strictEqual(parClient[1].complete, false);
  const parItem = core.marginBy(data, CO, p[0], p[1], 'item');
  assert.deepStrictEqual(parItem.map(x => x.label).sort(), ['Installation', 'Serveur']);
  assert.strictEqual(parItem.find(x => x.label === 'Serveur').cost, 2000);
  // 2025 est hors période
  assert.strictEqual(core.marginBy(data, CO, '2025-01-01', '2025-12-31', 'client')[0].revenue, 1500);
});

t('affaire : la marge exacte, parce qu\'on a vraiment payé les achats', () => {
  const data = core.migrateData({
    clients: [{ id: 'c1', name: 'Alpha' }], suppliers: [{ id: 's1', name: 'Grossiste' }], catalog: mCat,
    projects: [{ id: 'pr1', name: 'Salle serveur Alpha', clientId: 'c1', status: 'en cours', startDate: '2026-03-01' }],
    documents: [
      { id: 'q1', type: 'devis', number: 'DEV-1', status: 'envoyé', date: '2026-03-01', dueDate: '2026-04-01',
        clientId: 'c1', projectId: 'pr1', lines: [{ label: 'Extension', qty: 1, unitPrice: 2000, vatRate: 19 }], createdAt: 1 },
      mInv('1', { projectId: 'pr1', lines: [{ label: 'Serveur', qty: 4, unitPrice: 1500, vatRate: 19 }],
        payments: [{ id: 'p', date: '2026-03-20', amount: 3000 }] })
    ],
    purchases: [{ id: 'a1', kind: 'facture', supplierId: 's1', number: 'F-1', date: '2026-03-05', projectId: 'pr1',
      fees: 1, payments: [{ id: 'x', date: '2026-03-06', amount: 2000 }], createdAt: 1,
      lines: [{ label: 'Serveurs', qty: 4, unitPrice: 950, vatRate: 19, destination: 'stock' }] }]
  });
  const m = core.projectMargin(data, CO, 'pr1');
  assert.strictEqual(m.revenue, 6000);
  assert.strictEqual(m.cost, 3801);                        // 4 × 950 + 1 DT de timbre fournisseur
  assert.strictEqual(m.margin, 2199);
  assert.strictEqual(m.rate, 36.7);
  assert.strictEqual(m.salesCount, 1);
  assert.strictEqual(m.buysCount, 1);
  assert.strictEqual(m.quotesCount, 1);
  assert.strictEqual(m.pending, 2000);                     // le devis en cours, pas encore vendu
  // trésorerie de l'affaire : encaissé moins payé
  assert.strictEqual(m.collected, 3000);
  assert.strictEqual(m.paid, 2000);
  assert.strictEqual(m.cash, 1000);
  // une affaire sans rien ne plante pas
  const vide = core.projectMargin(data, CO, 'inconnue');
  assert.strictEqual(vide.revenue, 0); assert.strictEqual(vide.rate, null);
  assert.strictEqual(core.projectList(data, CO).length, 1);
});

t('contrat récurrent : ce qu\'il rapporte par mois', () => {
  const data = core.migrateData({
    clients: [{ id: 'c1', name: 'Alpha' }], catalog: [{ id: 'k', label: 'Maintenance', unitPrice: 250, unitCost: 60, vatRate: 19 }],
    recurring: [{ id: 'r1', clientId: 'c1', subject: 'Maintenance', every: 'month', day: 1, nextDate: '2026-10-01', active: true, lines: [] }],
    documents: ['2026-01-01', '2026-02-01', '2026-03-01'].map((date, i) => mInv('m' + i, {
      date, recurringId: 'r1', lines: [{ label: 'Maintenance', qty: 1, unitPrice: 250, vatRate: 19 }] }))
  });
  const r = core.recurringProfitability(data, CO, 'r1');
  assert.strictEqual(r.count, 3);
  assert.strictEqual(r.revenue, 750);
  assert.strictEqual(r.cost, 180);
  assert.strictEqual(r.margin, 570);
  assert.strictEqual(r.rate, 76);
  assert.strictEqual(r.months, 3);
  assert.strictEqual(r.perMonth, 190);
  assert.strictEqual(r.first, '2026-01-01');
  // contrat sans facture : aucun chiffre inventé
  assert.strictEqual(core.recurringProfitability(data, CO, 'inconnu').count, 0);
});

t('seuil de rentabilité : charges fixes, variables et le CA minimum', () => {
  const buy = (cat, ht, dest) => ({ id: 'a' + cat + ht, kind: 'facture', supplierId: 's1', number: 'F', date: '2026-03-01',
    payments: [], createdAt: 1, lines: [{ label: 'x', qty: 1, unitPrice: ht, vatRate: 19, destination: dest || 'charge' }] });
  const data = core.migrateData({
    clients: [{ id: 'c1', name: 'Alpha' }], suppliers: [{ id: 's1', name: 'B' }],
    documents: [mInv('1', { lines: [{ label: 'Vente', qty: 1, unitPrice: 10000, vatRate: 19 }] })],
    purchases: [
      { ...buy('Loyer et charges locatives', 1200), category: 'Loyer et charges locatives' },
      { ...buy('Assurances', 300), category: 'Assurances' },
      { ...buy('Achats de marchandises', 4000), category: 'Achats de marchandises' },
      { ...buy('Stock', 5000, 'stock'), category: 'Achats de marchandises' }   // stock : pas une charge
    ],
    movements: [{ id: 'm', date: '2026-03-28', kind: 'salaire', amount: 1850, accountId: 'x' }]
  });
  const p = { from: '2026-01-01', to: '2026-12-31' };
  const b = core.breakEven(data, CO, p);
  assert.strictEqual(b.revenue, 10000);
  assert.strictEqual(b.fixed, 3350);                       // loyer + assurance + salaire
  assert.strictEqual(b.variable, 4000);                    // marchandises consommées, pas le stock
  assert.strictEqual(b.marginOnVariable, 6000);
  assert.strictEqual(b.rate, 60);
  assert.strictEqual(b.breakEven, core.round3(3350 / 0.6));
  assert.strictEqual(b.result, 2650);
  assert.strictEqual(b.reached, true);
  assert.ok(b.gap > 0);
  // classement des catégories modifiable
  assert.strictEqual(core.isFixedCategory({}, 'Loyer et charges locatives'), true);
  assert.strictEqual(core.isFixedCategory({}, 'Achats de marchandises'), false);
  assert.strictEqual(core.isFixedCategory({ fixedCategories: ['Achats de marchandises'] }, 'Achats de marchandises'), true);
  assert.strictEqual(core.isFixedCategory({ fixedCategories: ['Achats de marchandises'] }, 'Loyer et charges locatives'), false);
  // aucune vente : pas de seuil calculable, et on le dit au lieu de diviser par zéro
  const rien = core.breakEven(core.migrateData({ purchases: data.purchases }), CO, p);
  assert.strictEqual(rien.breakEven, null);
  assert.strictEqual(rien.gap, null);
  assert.strictEqual(rien.reached, false);
});

// ---------- immobilisations et amortissements (3.5.0) ----------

t('amortissement linéaire : prorata temporis la première année, la dernière solde le reste', () => {
  const a = { id: 'a1', label: 'Ordinateur portable', amount: 2400, residual: 0, years: 3, date: '2026-07-01', category: 'informatique' };
  const rows = core.assetSchedule(a);
  assert.strictEqual(rows.length, 4);                       // 2026 partielle, 2027, 2028, 2029 partielle
  // du 1er juillet au 31 décembre, base 360 : 180 jours → la moitié d'une annuité
  assert.strictEqual(rows[0].days, 180);
  assert.strictEqual(rows[0].annuity, 400);
  assert.strictEqual(rows[1].annuity, 800);
  assert.strictEqual(rows[2].annuity, 800);
  assert.strictEqual(rows[3].annuity, 400);
  // le total amorti vaut exactement la valeur d'acquisition, sans traîner un millime
  assert.strictEqual(rows[rows.length - 1].cumulated, 2400);
  assert.strictEqual(rows[rows.length - 1].nbv, 0);
  // la VNC calculée à une date quelconque colle au tableau
  assert.strictEqual(core.assetNBV(a, '2026-12-31'), rows[0].nbv);
  assert.strictEqual(core.assetNBV(a, '2027-12-31'), rows[1].nbv);
  // valeur résiduelle : on n'amortit que la différence
  const b = { ...a, residual: 400 };
  const rb = core.assetSchedule(b);
  assert.strictEqual(core.round3(rb.reduce((s, r) => s + r.annuity, 0)), 2000);
  assert.strictEqual(rb[rb.length - 1].nbv, 400);
  // un bien sans durée ou sans date ne produit aucun tableau, au lieu de diviser par zéro
  assert.deepStrictEqual(core.assetSchedule({ ...a, years: 0 }), []);
  assert.deepStrictEqual(core.assetSchedule({ ...a, date: '' }), []);
});

t('cession : plus-value contre la VNC du jour, et plus rien après', () => {
  const a = { id: 'a1', label: 'Camionnette', amount: 30000, residual: 0, years: 5, date: '2024-01-01', category: 'transport',
    disposal: { date: '2026-06-30', amount: 16000, reason: 'Revendue' } };
  // 2,5 ans amortis sur 5 : la moitié
  assert.strictEqual(core.assetCumulated(a, '2026-06-30'), 15000);
  const d = core.disposalResult(a);
  assert.strictEqual(d.nbv, 15000);
  assert.strictEqual(d.result, 1000);                        // plus-value
  // l'année de la cession, on amortit jusqu'au jour de la sortie seulement
  const y = core.assetYear(a, 2026);
  assert.strictEqual(y.annuity, 3000);                       // six mois
  assert.strictEqual(y.out, true);
  // l'année suivante, plus aucune dotation et le cumul reste figé
  const y2 = core.assetYear(a, 2027);
  assert.strictEqual(y2.annuity, 0);
  assert.strictEqual(y2.cumulated, 15000);
  // moins-value
  const m = core.disposalResult({ ...a, disposal: { date: '2026-06-30', amount: 9000, reason: '' } });
  assert.strictEqual(m.result, -6000);
});

t('état des immobilisations : un bien cédé sort de l\'exercice suivant', () => {
  const data = core.migrateData({
    assets: [
      { id: 'a1', label: 'Portable', amount: 2400, residual: 0, years: 3, date: '2026-01-01', category: 'informatique' },
      { id: 'a2', label: 'Camionnette', amount: 30000, residual: 0, years: 5, date: '2024-01-01', category: 'transport',
        disposal: { date: '2026-06-30', amount: 16000, reason: '' } },
      { id: 'a3', label: 'Acheté plus tard', amount: 1000, residual: 0, years: 5, date: '2027-03-01', category: 'bureau' }
    ]
  });
  const t = core.assetTotals(data, 2026);
  assert.strictEqual(t.count, 2);                            // a3 n'existe pas encore en 2026
  assert.strictEqual(t.annuity, core.round3(800 + 3000));
  assert.strictEqual(t.disposals.length, 1);
  const t27 = core.assetTotals(data, 2027);
  assert.strictEqual(t27.count, 2);                          // a1 et a3 : la camionnette est sortie
  assert.ok(!t27.rows.some(r => r.id === 'a2'));
});

t('achats : une ligne « immobilisation » attend sa fiche, une seule fois', () => {
  const data = core.migrateData({
    purchases: [{
      id: 'p1', kind: 'facture', supplierId: 's1', number: 'FA-1', date: '2026-03-10', category: 'Petit équipement',
      lines: [
        { label: 'Serveur', qty: 1, unitPrice: 7000, vatRate: 19, destination: 'immobilisation', deductible: true },
        { label: 'Câbles', qty: 10, unitPrice: 12, vatRate: 19, destination: 'charge', deductible: true }
      ], payments: []
    }]
  });
  let todo = core.assetsToCreate(data);
  assert.strictEqual(todo.length, 1);
  assert.strictEqual(todo[0].label, 'Serveur');
  assert.strictEqual(todo[0].amount, 7000);
  // une fois la fiche créée, la ligne ne revient plus
  data.assets.push({ id: 'a1', label: 'Serveur', amount: 7000, residual: 0, years: 5, date: '2026-03-10', category: 'informatique', purchaseId: 'p1', lineIndex: 0 });
  assert.deepStrictEqual(core.assetsToCreate(data), []);
});

t('la dotation est une charge : elle pèse sur le résultat et sur le seuil', () => {
  const base = {
    company: CO,
    documents: [{ id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-02-01', status: 'envoyée', clientId: 'c1',
      lines: [{ label: 'Presta', qty: 1, unitPrice: 20000, vatRate: 19 }], payments: [], applyStamp: true }],
    purchases: [{ id: 'p1', kind: 'facture', supplierId: 's1', number: 'FA-1', date: '2026-01-05', category: 'Petit équipement',
      lines: [{ label: 'Serveur', qty: 1, unitPrice: 12000, vatRate: 19, destination: 'immobilisation', deductible: true }], payments: [], fees: 0 }]
  };
  const p = { from: '2026-01-01', to: '2026-12-31' };
  const sans = core.simpleResult(core.migrateData(base), CO, p);
  assert.strictEqual(sans.immo, 12000);
  assert.strictEqual(sans.charges, 0);                       // l'achat n'est pas une charge…
  assert.strictEqual(sans.depreciation, 0);                  // …et sans fiche, rien n'est amorti
  assert.strictEqual(sans.resultat, 20000);
  // avec la fiche : 12 000 sur 4 ans à partir du 5 janvier
  const avec = core.migrateData({ ...base,
    assets: [{ id: 'a1', label: 'Serveur', amount: 12000, residual: 0, years: 4, date: '2026-01-05', category: 'informatique', purchaseId: 'p1', lineIndex: 0 }] });
  const r = core.simpleResult(avec, CO, p);
  const dot = core.assetTotals(avec, 2026).annuity;
  assert.ok(dot > 2900 && dot < 3000, 'dotation ' + dot);
  assert.strictEqual(r.depreciation, dot);
  assert.strictEqual(r.resultat, core.round3(20000 - dot));
  // le seuil de rentabilité compte la dotation dans les charges fixes
  const b = core.breakEven(avec, CO, p);
  assert.strictEqual(b.depreciation, dot);
  assert.strictEqual(b.fixed, dot);
  assert.strictEqual(core.breakEven(core.migrateData(base), CO, p).fixed, 0);
});

t('dotation : sur un mois on amortit un mois, pas une année', () => {
  const data = core.migrateData({
    assets: [
      { id: 'a1', label: 'Serveur', amount: 12000, residual: 0, years: 4, date: '2026-01-01', category: 'informatique' },
      { id: 'a2', label: 'Vendu en cours d\'année', amount: 6000, residual: 0, years: 5, date: '2025-01-01', category: 'bureau',
        disposal: { date: '2026-04-30', amount: 1000, reason: '' } }
    ]
  });
  const year = core.depreciationFor(data, { from: '2026-01-01', to: '2026-12-31' });
  assert.strictEqual(year, core.assetTotals(data, 2026).annuity);
  // un mois ne peut pas peser autant qu'une année — c'est le bug que la capture a montré
  const mars = core.depreciationFor(data, { from: '2026-03-01', to: '2026-03-31' });
  assert.ok(mars > 0 && mars < year / 5, 'mars ' + mars + ' contre ' + year);
  // les douze mois redonnent exactement l'année
  let somme = 0;
  const fins = ['31', '28', '31', '30', '31', '30', '31', '31', '30', '31', '30', '31'];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    somme = core.round3(somme + core.depreciationFor(data, { from: `2026-${mm}-01`, to: `2026-${mm}-${fins[m - 1]}` }));
  }
  assert.strictEqual(somme, year);
  // après la cession, le bien sorti n'ajoute plus rien
  assert.strictEqual(core.depreciationFor(data, { from: '2026-06-01', to: '2026-06-30' }),
    core.round3(12000 / 4 / 12));
});

// ---------- stock (4.0.0) ----------

// Un jeu minimal : un article suivi, un acheté sans suivi, un achat, une vente.
function stockData(extra) {
  return core.migrateData({
    company: CO,
    catalog: [
      { id: 'k1', label: 'Disque dur 2 To', unitPrice: 320, unitCost: 210, vatRate: 19, unit: 'u', tracked: true, minStock: 3, initialQty: 5, initialCost: 200, initialDate: '2026-01-01' },
      { id: 'k2', label: 'Prestation de conseil', unitPrice: 500, vatRate: 19, unit: 'h', tracked: false }
    ],
    ...extra
  });
}

t('stock : les mouvements sont déduits des achats et des ventes, jamais ressaisis', () => {
  const d = stockData({
    purchases: [{ id: 'p1', kind: 'facture', supplierId: 's1', number: 'FA-1', date: '2026-02-10', category: 'Achats de marchandises',
      lines: [{ label: 'Disque dur 2 To', qty: 10, unitPrice: 230, vatRate: 19, destination: 'stock', deductible: true },
              { label: 'Câbles', qty: 5, unitPrice: 8, vatRate: 19, destination: 'charge', deductible: true }], payments: [], fees: 0 }],
    documents: [{ id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-03-01', status: 'envoyée', clientId: 'c1',
      lines: [{ label: 'Disque dur 2 To', qty: 4, unitPrice: 320, vatRate: 19 },
              { label: 'Prestation de conseil', qty: 2, unitPrice: 500, vatRate: 19 }], payments: [], applyStamp: true }]
  });
  const s = core.stockOf(d, 'k1');
  assert.strictEqual(s.qty, 11);                            // 5 de départ + 10 achetés − 4 vendus
  // coût moyen pondéré : (5 × 200 + 10 × 230) / 15 = 220
  const apresAchat = core.stockOf(d, 'k1', '2026-02-28');
  assert.strictEqual(apresAchat.cmp, 220);
  assert.strictEqual(apresAchat.qty, 15);
  assert.strictEqual(s.cmp, 220);                           // une sortie ne change pas le coût moyen
  assert.strictEqual(s.value, core.round3(11 * 220));
  // la prestation n'est pas suivie : elle ne produit aucun mouvement
  assert.strictEqual(core.stockList(d).length, 1);
  // une ligne de charge n'entre pas en stock
  assert.ok(!s.moves.some(m => m.label === 'Câbles'));
});

t('stock : un brouillon ne sort rien, un bon de livraison ne sort qu\'une fois', () => {
  const base = {
    purchases: [{ id: 'p1', kind: 'facture', supplierId: 's1', number: 'FA-1', date: '2026-02-10', category: 'Achats de marchandises',
      lines: [{ label: 'Disque dur 2 To', qty: 10, unitPrice: 230, vatRate: 19, destination: 'stock', deductible: true }], payments: [], fees: 0 }]
  };
  // brouillon : rien ne bouge
  const brouillon = stockData({ ...base, documents: [{ id: 'd1', type: 'facture', number: '', date: '2026-03-01', status: 'brouillon', clientId: 'c1',
    lines: [{ label: 'Disque dur 2 To', qty: 4, unitPrice: 320, vatRate: 19 }], payments: [] }] });
  assert.strictEqual(core.stockOf(brouillon, 'k1').qty, 15);
  // bon de livraison puis facture tirée de lui : une seule sortie
  const chaine = stockData({ ...base, documents: [
    { id: 'bl', type: 'livraison', number: 'BL-2026-001', date: '2026-03-01', status: 'signé', clientId: 'c1',
      lines: [{ label: 'Disque dur 2 To', qty: 4, unitPrice: 320, vatRate: 19 }], payments: [] },
    { id: 'f', type: 'facture', number: 'FAC-2026-001', date: '2026-03-05', status: 'envoyée', clientId: 'c1',
      fromDocId: 'bl', fromDocType: 'livraison', fromDocNumber: 'BL-2026-001',
      lines: [{ label: 'Disque dur 2 To', qty: 4, unitPrice: 320, vatRate: 19 }], payments: [], applyStamp: true }
  ] });
  assert.strictEqual(core.stockOf(chaine, 'k1').qty, 11);
  assert.strictEqual(core.stockOf(chaine, 'k1').moves.filter(m => m.qty < 0).length, 1);
  // un avoir remet la marchandise en stock
  const retour = stockData({ ...base, documents: [
    { id: 'f', type: 'facture', number: 'FAC-2026-001', date: '2026-03-01', status: 'envoyée', clientId: 'c1',
      lines: [{ label: 'Disque dur 2 To', qty: 4, unitPrice: 320, vatRate: 19 }], payments: [], applyStamp: true },
    { id: 'a', type: 'avoir', number: 'AVO-2026-001', date: '2026-03-10', status: 'émis', clientId: 'c1', creditOf: 'f',
      lines: [{ label: 'Disque dur 2 To', qty: 1, unitPrice: 320, vatRate: 19 }], payments: [] }
  ] });
  assert.strictEqual(core.stockOf(retour, 'k1').qty, 12);
});

t('stock : le négatif et la rupture sont signalés, pas cachés', () => {
  const d = stockData({
    documents: [{ id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-03-01', status: 'envoyée', clientId: 'c1',
      lines: [{ label: 'Disque dur 2 To', qty: 8, unitPrice: 320, vatRate: 19 }], payments: [], applyStamp: true }]
  });
  const s = core.stockOf(d, 'k1');
  assert.strictEqual(s.qty, -3);                            // on a vendu ce qu'on n'avait pas
  assert.strictEqual(s.negative, true);
  const alerts = core.stockAlerts(d);
  assert.strictEqual(alerts[0].kind, 'negatif');
  // stock bas : sous le seuil sans être négatif
  const bas = stockData({
    documents: [{ id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-03-01', status: 'envoyée', clientId: 'c1',
      lines: [{ label: 'Disque dur 2 To', qty: 3, unitPrice: 320, vatRate: 19 }], payments: [], applyStamp: true }]
  });
  const sb = core.stockOf(bas, 'k1');
  assert.strictEqual(sb.qty, 2);
  assert.strictEqual(sb.low, true);
  assert.strictEqual(sb.negative, false);
  assert.strictEqual(core.stockAlerts(bas)[0].kind, 'bas');
});

t('stock : on prévient avant d\'émettre une pièce qui fait passer sous zéro', () => {
  const d = stockData({});
  const doc = { id: 'x', type: 'facture', date: '2026-03-01', status: 'brouillon', clientId: 'c1',
    lines: [{ label: 'Disque dur 2 To', qty: 9, unitPrice: 320, vatRate: 19 },
            { label: 'Prestation de conseil', qty: 1, unitPrice: 500, vatRate: 19 }] };
  const impact = core.stockImpact(doc, d);
  assert.strictEqual(impact.length, 1);
  assert.strictEqual(impact[0].have, 5);
  assert.strictEqual(impact[0].need, 9);
  assert.strictEqual(impact[0].after, -4);
  // ce qui tient dans le stock ne déclenche rien
  assert.deepStrictEqual(core.stockImpact({ ...doc, lines: [{ label: 'Disque dur 2 To', qty: 5, unitPrice: 320, vatRate: 19 }] }, d), []);
  // une ligne de déduction d'acompte ne sort aucune marchandise
  assert.deepStrictEqual(core.stockImpact({ ...doc, lines: [{ label: 'Disque dur 2 To', qty: 9, unitPrice: -320, vatRate: 19, noDiscount: true }] }, d), []);
});

t('stock : l\'inventaire dit l\'écart, il ne le corrige pas tout seul', () => {
  const d = stockData({});
  const diff = core.inventoryDiff(d, { k1: 4 }, '2026-06-30');
  assert.strictEqual(diff.length, 1);
  assert.strictEqual(diff[0].book, 5);
  assert.strictEqual(diff[0].counted, 4);
  assert.strictEqual(diff[0].gap, -1);
  assert.strictEqual(diff[0].value, -200);                  // une unité au coût moyen de 200
  // un article non compté n'invente aucun écart
  const vide = core.inventoryDiff(d, {}, '2026-06-30');
  assert.strictEqual(vide[0].counted, null);
  assert.strictEqual(vide[0].gap, null);
  // l'ajustement saisi corrige bien le stock
  d.stockAdjustments.push({ id: 'adj', date: '2026-06-30', itemId: 'k1', qty: -1, unitCost: '', source: 'inventaire', note: 'Inventaire du 30/06' });
  assert.strictEqual(core.stockOf(d, 'k1').qty, 4);
  assert.strictEqual(core.inventoryDiff(d, { k1: 4 }, '2026-06-30')[0].gap, 0);
});

t('stock : acheter de la marchandise ne coûte rien, la vendre coûte ce qu\'elle a coûté', () => {
  const d = stockData({
    purchases: [{ id: 'p1', kind: 'facture', supplierId: 's1', number: 'FA-1', date: '2026-02-10', category: 'Achats de marchandises',
      lines: [{ label: 'Disque dur 2 To', qty: 10, unitPrice: 230, vatRate: 19, destination: 'stock', deductible: true }], payments: [], fees: 0 }],
    documents: [{ id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-03-01', status: 'envoyée', clientId: 'c1',
      lines: [{ label: 'Disque dur 2 To', qty: 4, unitPrice: 320, vatRate: 19 }], payments: [], applyStamp: true }]
  });
  const p = { from: '2026-01-01', to: '2026-12-31' };
  // quatre disques sortis au coût moyen de 220
  assert.strictEqual(core.costOfGoodsSold(d, p), 880);
  const r = core.simpleResult(d, CO, p);
  assert.strictEqual(r.stock, 2300);                     // l'achat est allé en stock…
  assert.strictEqual(r.charges, 0);                      // …donc ce n'est pas une charge de la période
  assert.strictEqual(r.cogs, 880);                       // la charge, c'est ce qui est sorti
  assert.strictEqual(r.resultat, core.round3(1280 - 880));
  // le coût des marchandises vendues est une charge VARIABLE : sans vente, il n'existe pas
  const b = core.breakEven(d, CO, p);
  assert.strictEqual(b.cogs, 880);
  assert.strictEqual(b.variable, 880);
  assert.strictEqual(b.fixed, 0);
  // rien vendu sur février : aucun coût de marchandise
  assert.strictEqual(core.costOfGoodsSold(d, { from: '2026-02-01', to: '2026-02-28' }), 0);
});

// ---------- numéros de série et garanties (4.1.0) ----------

function serialData(extra) {
  return core.migrateData({
    company: CO,
    clients: [{ id: 'c1', name: 'Clinique Test', matricule: '1A/M/000' }],
    catalog: [{ id: 'k1', label: 'Serveur rack', unitPrice: 6000, unitCost: 4200, vatRate: 19, unit: 'u',
      tracked: true, serialized: true, minStock: 0, warrantyMonths: 24 }],
    serials: [
      { id: 's1', itemId: 'k1', serial: 'SN-001', status: 'vendu', inDate: '2024-01-10', clientId: 'c1',
        outDate: '2024-03-01', outDocId: 'd1', warrantyMonths: 24, notes: '' },
      { id: 's2', itemId: 'k1', serial: 'SN-002', status: 'stock', inDate: '2026-01-05', warrantyMonths: 24, notes: '' },
      { id: 's3', itemId: 'k1', serial: 'SN-003', status: 'vendu', inDate: '2024-06-01', clientId: 'c1',
        outDate: '2024-11-15', outDocId: 'd2', warrantyMonths: 24, notes: '' }
    ],
    ...extra
  });
}

t('garantie : elle court de la livraison, pas de l\'achat', () => {
  const d = serialData();
  const v = core.serialView(d.serials[0], d, '2026-01-01');
  // vendu le 01/03/2024, garantie 24 mois → jusqu'au 28/02/2026 inclus (2026 n'est pas bissextile)
  assert.strictEqual(v.warrantyEndDate, '2026-02-28');
  assert.strictEqual(v.underWarranty, true);
  assert.strictEqual(core.serialView(d.serials[0], d, '2026-03-01').underWarranty, false);
  assert.strictEqual(core.serialView(d.serials[0], d, '2026-03-01').expired, true);
  // une unité encore en stock n'a pas de garantie en cours : elle n'est chez personne
  assert.strictEqual(core.serialView(d.serials[1], d, '2026-01-01').warrantyEndDate, '');
  // sans durée, pas de date de fin — on n'invente pas une garantie
  assert.strictEqual(core.warrantyEnd({ outDate: '2026-01-01', warrantyMonths: 0 }), '');
});

t('parc client et fins de garantie qui approchent', () => {
  const d = serialData();
  const parc = core.clientFleet(d, 'c1', '2026-01-15');
  assert.strictEqual(parc.length, 2);
  assert.strictEqual(parc[0].serial, 'SN-003');              // le plus récemment livré d'abord
  // SN-003 vendu le 15/11/2024 + 24 mois → 14/11/2026 : hors de la fenêtre de 60 jours
  // SN-001 se termine le 29/02/2026 : dans la fenêtre au 15/01/2026
  const soon = core.warrantiesEnding(d, 60, '2026-01-15');
  assert.strictEqual(soon.length, 1);
  assert.strictEqual(soon[0].serial, 'SN-001');
  // une garantie déjà expirée ne remonte plus : elle n'est plus une occasion, c'est un fait acquis
  assert.strictEqual(core.warrantiesEnding(d, 60, '2026-06-01').length, 0);
  // les disponibles : seules les unités en stock
  assert.deepStrictEqual(core.availableSerials(d, 'k1').map(x => x.serial), ['SN-002']);
});

t('numéros de série : l\'écart avec le stock en quantité est signalé', () => {
  // stock de départ 3, un seul numéro disponible : deux numéros manquent
  const d = serialData({
    catalog: [{ id: 'k1', label: 'Serveur rack', unitPrice: 6000, unitCost: 4200, vatRate: 19, unit: 'u',
      tracked: true, serialized: true, minStock: 0, initialQty: 3, initialCost: 4200, initialDate: '2026-01-01', warrantyMonths: 24 }]
  });
  const g = core.serialGap(d, 'k1', '2026-06-01');
  assert.ok(g);
  assert.strictEqual(g.qty, 3);
  assert.strictEqual(g.serials, 1);
  assert.strictEqual(g.gap, 2);
  assert.strictEqual(core.serialGaps(d, '2026-06-01').length, 1);
  // quand les deux comptes concordent, plus aucun écart
  d.serials.push({ id: 's4', itemId: 'k1', serial: 'SN-004', status: 'stock', inDate: '2026-01-01', warrantyMonths: 24 });
  d.serials.push({ id: 's5', itemId: 'k1', serial: 'SN-005', status: 'stock', inDate: '2026-01-01', warrantyMonths: 24 });
  assert.strictEqual(core.serialGap(d, 'k1', '2026-06-01'), null);
  // un article non suivi par série ne produit aucun écart
  assert.strictEqual(core.serialGap(d, 'inconnu', '2026-06-01'), null);
});

// ---------- lecture d'une photo de facture (4.2.0) ----------

t('lecture : les nombres arrivent dans tous les formats, on les ramène au même', () => {
  assert.strictEqual(core.ocrNumber('1 234,56 DT'), 1234.56);
  assert.strictEqual(core.ocrNumber('1.234,56'), 1234.56);      // format européen
  assert.strictEqual(core.ocrNumber('1,234.56'), 1234.56);      // format anglo-saxon
  assert.strictEqual(core.ocrNumber('19 %'), 19);
  assert.strictEqual(core.ocrNumber(''), 0);
  assert.strictEqual(core.ocrNumber(null), 0);
  assert.strictEqual(core.ocrNumber('n/a'), 0);                 // illisible : zéro, pas NaN
});

t('lecture : ce qui a été lu devient un achat, et ce qui cloche est dit', () => {
  const data = core.migrateData({
    suppliers: [{ id: 'f1', name: 'Tunisie Matériel', matricule: '7890123G/A/000', payments: [] }]
  });
  const lu = {
    supplier: 'TUNISIE MATÉRIEL', matricule: '7890123G/A/000', number: 'FA-2026-1187',
    date: '18/07/2026', dueDate: '17/08/2026', subject: 'Postes de travail', fees: '1,000',
    totalHT: '2 300,000',
    lines: [{ label: 'Poste de travail', qty: '10', unitPrice: '230,000', vatRate: '19' }]
  };
  const r = core.ocrToPurchase(lu, data, '2026-09-11');
  // le fournisseur est reconnu par son matricule, malgré la casse du nom
  assert.strictEqual(r.head.supplierId, 'f1');
  assert.strictEqual(r.head.date, '2026-07-18');                // JJ/MM/AAAA converti
  assert.strictEqual(r.head.dueDate, '2026-08-17');
  assert.strictEqual(r.head.fees, 1);
  assert.strictEqual(r.lines.length, 1);
  assert.strictEqual(r.lines[0].unitPrice, 230);
  assert.strictEqual(r.lines[0].destination, 'charge');         // jamais « stock » sans décision humaine
  assert.strictEqual(r.computedHT, 2300);
  assert.deepStrictEqual(r.warnings, []);                       // tout concorde
});

t('lecture : un écart, un fournisseur inconnu ou un numéro manquant sont signalés', () => {
  const data = core.migrateData({});
  const r = core.ocrToPurchase({
    supplier: 'Inconnu SARL', number: '', date: '2026-07-18', totalHT: 1000,
    lines: [{ label: 'Quelque chose', qty: 1, unitPrice: 900, vatRate: 19 }]
  }, data, '2026-09-11');
  assert.strictEqual(r.head.supplierId, '');
  assert.strictEqual(r.head.supplierName, 'Inconnu SARL');
  assert.strictEqual(r.warnings.length, 3);                     // fournisseur, numéro, écart
  assert.ok(r.warnings.some(w => /Inconnu SARL/.test(w)));
  assert.ok(r.warnings.some(w => /numéro/.test(w)));
  assert.ok(r.warnings.some(w => /900/.test(w) && /1000/.test(w)));
  // une date future est suspecte
  assert.ok(core.ocrToPurchase({ date: '2027-01-01', number: 'X', supplier: '' }, data, '2026-09-11')
    .warnings.some(w => /futur/.test(w)));
  // aucune ligne lue : on en pose une à compléter plutôt que zéro
  const vide = core.ocrToPurchase({ number: 'X', totalHT: 500, subject: 'Réparation' }, data, '2026-09-11');
  assert.strictEqual(vide.lines.length, 1);
  assert.strictEqual(vide.lines[0].label, 'Réparation');
  assert.strictEqual(vide.lines[0].unitPrice, 500);
  // un taux de TVA farfelu retombe sur 19 %
  const taux = core.ocrToPurchase({ number: 'X', lines: [{ label: 'A', qty: 1, unitPrice: 10, vatRate: 42 }] }, data, '2026-09-11');
  assert.strictEqual(taux.lines[0].vatRate, 19);
});

// ---------- paie (5.0.0) ----------

t('IRPP : le barème est progressif, tranche par tranche', () => {
  const b = core.payrollSettings({}).brackets;
  assert.strictEqual(core.irppAnnual(0, b), 0);
  assert.strictEqual(core.irppAnnual(5000, b), 0);              // la première tranche est à 0 %
  assert.strictEqual(core.irppAnnual(7000, b), 300);            // 2 000 × 15 %
  assert.strictEqual(core.irppAnnual(10000, b), 750);
  // l'erreur classique serait de taxer la tranche entière quand le revenu s'arrête au milieu
  assert.strictEqual(core.irppAnnual(15000, b), core.round3(750 + 5000 * 0.25));
  assert.strictEqual(core.irppAnnual(30000, b), 6250);
  assert.strictEqual(core.irppAnnual(100000, b), 32750);        // dernière tranche ouverte
  // barème entièrement remplaçable : rien n'est écrit en dur dans le calcul
  const plat = [{ upTo: null, rate: 10 }];
  assert.strictEqual(core.irppAnnual(1000, plat), 100);
});

t('bulletin : brut, CNSS, IRPP, net et coût employeur', () => {
  const s = core.payrollSettings({});
  const e = { id: 'e1', name: 'Salarié', grossSalary: 2000, children: 2, headOfFamily: true };
  const p = core.computePayslip(e, {}, s);
  assert.strictEqual(p.gross, 2000);
  assert.strictEqual(p.cnssEmployee, core.round3(2000 * 9.18 / 100));
  // frais professionnels plafonnés : 10 % de 21 796,80 = 2 179,68 → ramenés à 2 000
  assert.strictEqual(p.pro, 2000);
  assert.strictEqual(p.family, 500);                            // chef de famille 300 + 2 enfants × 100
  assert.strictEqual(p.annualTaxable, core.round3(2000 * 12 - p.cnssEmployee * 12 - 2000 - 500));
  assert.strictEqual(p.irpp, core.round3(core.irppAnnual(p.annualTaxable, s.brackets) / 12));
  assert.strictEqual(p.net, core.round3(p.gross - p.cnssEmployee - p.irpp - p.css));
  assert.strictEqual(p.employerCost, core.round3(p.gross + p.cnssEmployer + p.accident));
  assert.ok(p.employerCost > p.gross, 'le coût employeur dépasse toujours le brut');
  // le net est bien inférieur au brut, et le brut au coût
  assert.ok(p.net < p.gross && p.gross < p.employerCost);
});

t('bulletin : primes imposables ou non, retenues, absence au prorata', () => {
  const s = core.payrollSettings({});
  const e = { id: 'e1', name: 'Salarié', grossSalary: 1300, children: 0, headOfFamily: false };
  const simple = core.computePayslip(e, {}, s);
  // une prime imposable entre dans l'assiette CNSS, une prime non imposable n'y entre pas
  const primes = core.computePayslip(e, { bonuses: [{ label: 'Rendement', amount: 200, taxable: true }, { label: 'Panier', amount: 100, taxable: false }] }, s);
  assert.strictEqual(primes.gross, 1600);
  assert.strictEqual(primes.cnssBase, 1500);
  assert.ok(primes.cnssEmployee > simple.cnssEmployee);
  // une retenue baisse le net sans toucher aux cotisations
  const avance = core.computePayslip(e, { deductions: [{ label: 'Avance', amount: 150 }] }, s);
  assert.strictEqual(avance.cnssEmployee, simple.cnssEmployee);
  assert.strictEqual(avance.net, core.round3(simple.net - 150));
  // absence non rémunérée : le brut est réduit au prorata des jours
  const absent = core.computePayslip(e, { absentDays: 2, workedDays: 26 }, s);
  assert.strictEqual(absent.absenceCut, core.round3(1300 * 2 / 26));
  assert.strictEqual(absent.gross, core.round3(1300 - absent.absenceCut));
  assert.ok(absent.net < simple.net);
});

t('paie : les bulletins manquants du mois sont ceux des salariés actifs', () => {
  const d = core.migrateData({
    employees: [
      { id: 'e1', name: 'Présent', grossSalary: 1200, hireDate: '2024-01-01' },
      { id: 'e2', name: 'Parti', grossSalary: 1500, hireDate: '2023-01-01', endDate: '2026-05-31' },
      { id: 'e3', name: 'Pas encore arrivé', grossSalary: 1000, hireDate: '2026-12-01' }
    ],
    payslips: []
  });
  // en septembre 2026 : seul « Présent » doit avoir un bulletin
  let manquants = core.missingPayslips(d, 2026, 9).map(e => e.name);
  assert.deepStrictEqual(manquants, ['Présent']);
  d.payslips.push({ id: 'b1', employeeId: 'e1', year: 2026, month: 9, gross: 1200, computed: core.computePayslip(d.employees[0], {}, core.payrollSettings(d)) });
  assert.deepStrictEqual(core.missingPayslips(d, 2026, 9), []);
  // en mai 2026, le salarié parti en fin de mois est encore là
  assert.deepStrictEqual(core.missingPayslips(d, 2026, 5).map(e => e.name).sort(), ['Parti', 'Présent']);
  // la date d'un bulletin est le dernier jour de son mois
  assert.strictEqual(core.payslipDate({ year: 2026, month: 2 }), '2026-02-28');
  assert.strictEqual(core.payslipDate({ year: 2024, month: 2 }), '2024-02-29');
  assert.strictEqual(core.payslipDate({ year: 2026, month: 9 }), '2026-09-30');
});

t('paie : le coût employeur pèse sur le résultat et sur les charges fixes', () => {
  const s = core.payrollSettings({});
  const emp = { id: 'e1', name: 'Salarié', grossSalary: 1500, children: 0, headOfFamily: false };
  const c = core.computePayslip(emp, {}, s);
  const d = core.migrateData({
    company: CO,
    employees: [emp],
    payslips: [1, 2, 3].map(m => ({ id: 'b' + m, employeeId: 'e1', year: 2026, month: m, computed: c })),
    documents: [{ id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-02-01', status: 'envoyée', clientId: 'c1',
      lines: [{ label: 'Presta', qty: 1, unitPrice: 30000, vatRate: 19 }], payments: [], applyStamp: true }]
  });
  const annee = { from: '2026-01-01', to: '2026-12-31' };
  assert.strictEqual(core.payrollCost(d, annee), core.round3(c.employerCost * 3));
  // un seul mois ne compte qu'un bulletin
  assert.strictEqual(core.payrollCost(d, { from: '2026-02-01', to: '2026-02-28' }), c.employerCost);
  const r = core.simpleResult(d, CO, annee);
  assert.strictEqual(r.payroll, core.round3(c.employerCost * 3));
  assert.strictEqual(r.resultat, core.round3(r.produits - r.charges - r.cogs - r.depreciation - r.payroll));
  // les salaires sont la charge fixe par excellence
  const b = core.breakEven(d, CO, annee);
  assert.strictEqual(b.payroll, core.round3(c.employerCost * 3));
  assert.strictEqual(b.fixed, core.round3(c.employerCost * 3));
  // récapitulatif de l'année
  const sum = core.payrollSummary(d, 2026);
  assert.strictEqual(sum.count, 3);
  assert.strictEqual(sum.employees, 1);
  assert.strictEqual(sum.cost, core.round3(c.employerCost * 3));
  assert.strictEqual(sum.unpaid, 3);
});

// ---------- congés, absences et avances (5.1.0) ----------

t('jours ouvrables : le dimanche ne compte pas', () => {
  assert.strictEqual(core.workingDays('2026-01-01', '2026-01-07'), 6);   // une semaine moins un dimanche
  assert.strictEqual(core.workingDays('2026-01-01', '2026-01-31'), 27);
  assert.strictEqual(core.workingDays('2026-01-04', '2026-01-04'), 0);   // un dimanche seul
  assert.strictEqual(core.workingDays('2026-01-05', '2026-01-05'), 1);
  assert.strictEqual(core.workingDays('2026-01-10', '2026-01-01'), 0);   // à l'envers : zéro, pas un nombre négatif
  // semaine de cinq jours : on change les jours chômés, rien d'autre
  assert.strictEqual(core.workingDays('2026-01-01', '2026-01-07', [0, 6]), 5);
});

t('congés : acquis au prorata, pris déduits, à cheval sur deux mois réparti', () => {
  const emp = { id: 'e1', name: 'Salarié', grossSalary: 1500, hireDate: '2025-01-01' };
  const d = core.migrateData({
    employees: [emp],
    leaves: [
      { id: 'l1', employeeId: 'e1', kind: 'conges', from: '2026-03-02', to: '2026-03-07' },
      { id: 'l2', employeeId: 'e1', kind: 'sans-solde', from: '2026-04-28', to: '2026-05-02' }
    ]
  });
  const b = core.leaveBalance(d, 'e1', 2026, '2026-09-11');
  assert.strictEqual(b.perYear, 18);
  assert.strictEqual(b.months, 8);                        // janvier à début septembre
  assert.strictEqual(b.acquired, 12);                     // 18 × 8/12
  assert.strictEqual(b.taken, 6);                         // seuls les congés payés comptent
  assert.strictEqual(b.remaining, 6);
  assert.strictEqual(b.byKind['sans-solde'], 5);          // l'absence sans solde n'entame pas le compteur
  // l'absence du 28 avril au 2 mai se répartit : 3 jours en avril, 2 en mai
  assert.strictEqual(core.leaveDaysInMonth(d.leaves[1], 2026, 4), 3);
  assert.strictEqual(core.leaveDaysInMonth(d.leaves[1], 2026, 5), 2);
  assert.strictEqual(core.leaveDaysInMonth(d.leaves[1], 2026, 6), 0);
  // un salarié embauché en cours d'année n'acquiert pas une année entière
  const tard = core.migrateData({ employees: [{ id: 'e2', name: 'Récent', grossSalary: 1000, hireDate: '2026-07-01' }] });
  assert.ok(core.leaveBalance(tard, 'e2', 2026, '2026-09-11').acquired < 6);
});

t('bulletin : les absences et les avances y arrivent toutes seules', () => {
  const emp = { id: 'e1', name: 'Salarié', grossSalary: 1500, hireDate: '2025-01-01' };
  const d = core.migrateData({
    employees: [emp],
    leaves: [
      { id: 'l1', employeeId: 'e1', kind: 'conges', from: '2026-04-06', to: '2026-04-11' },     // payé : aucun effet
      { id: 'l2', employeeId: 'e1', kind: 'sans-solde', from: '2026-04-28', to: '2026-04-30' }  // non payé : 3 jours
    ],
    advances: [{ id: 'a1', employeeId: 'e1', date: '2026-02-10', amount: 900, monthly: 300 }]
  });
  const i = core.payslipInputFor(d, emp, 2026, 4);
  assert.strictEqual(i.absentDays, 3);                    // le congé payé ne retire rien
  assert.strictEqual(i.deductions.length, 1);
  assert.strictEqual(i.deductions[0].amount, 300);
  assert.strictEqual(i.deductions[0].advanceId, 'a1');
  // un mois sans absence ne retire rien, mais l'avance continue
  const mars = core.payslipInputFor(d, emp, 2026, 3);
  assert.strictEqual(mars.absentDays, 0);
  assert.strictEqual(mars.deductions.length, 1);
  // avant l'avance, aucune retenue
  assert.strictEqual(core.payslipInputFor(d, emp, 2026, 1).deductions.length, 0);
});

t('avance : ce qui est remboursé vient des bulletins, pas d\'un compteur à part', () => {
  const emp = { id: 'e1', name: 'Salarié', grossSalary: 1500, hireDate: '2025-01-01' };
  const d = core.migrateData({
    employees: [emp],
    advances: [{ id: 'a1', employeeId: 'e1', date: '2026-02-10', amount: 900, monthly: 300 }],
    payslips: [
      { id: 'b1', employeeId: 'e1', year: 2026, month: 3, deductions: [{ label: 'Avance', amount: 300, advanceId: 'a1' }] },
      { id: 'b2', employeeId: 'e1', year: 2026, month: 4, deductions: [{ label: 'Avance', amount: 300, advanceId: 'a1' }] }
    ]
  });
  const a = core.advancesOf(d, 'e1')[0];
  assert.strictEqual(a.repaid, 600);
  assert.strictEqual(a.remaining, 300);
  assert.strictEqual(a.done, false);
  assert.strictEqual(core.advanceBalance(d, 'e1'), 300);
  // la dernière échéance ne prend que ce qui reste, jamais la mensualité entière
  assert.strictEqual(core.payslipInputFor(d, emp, 2026, 5).deductions[0].amount, 300);
  d.payslips.push({ id: 'b3', employeeId: 'e1', year: 2026, month: 5, deductions: [{ label: 'Avance', amount: 300, advanceId: 'a1' }] });
  assert.strictEqual(core.advancesOf(d, 'e1')[0].done, true);
  assert.deepStrictEqual(core.payslipInputFor(d, emp, 2026, 6).deductions, []);
});

t('documents du personnel : attestation, certificat, registre', () => {
  const emp = { id: 'e1', name: 'Ahmed Ben Ali', cin: '09123456', cnss: '1122-33', position: 'Technicien',
    contract: 'cdi', hireDate: '2024-03-01', endDate: '', grossSalary: 1800 };
  const d = core.migrateData({ employees: [emp] });
  const co = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', matricule: '1A/M/000', address: 'Rue X\n2000 Tunis' };
  const att = core.hrDocumentHtml('attestation', emp, d, co, { date: '2026-09-11' });
  assert.ok(att.includes('Ahmed Ben Ali') && att.includes('Technicien'));
  assert.ok(att.includes('ATTESTATION DE TRAVAIL') || att.includes('Attestation de travail'));
  assert.ok(!att.includes('1 800'), 'le salaire ne sort que si on le demande');
  assert.ok(core.hrDocumentHtml('attestation', emp, d, co, { date: '2026-09-11', withSalary: true }).includes('1 800'));
  const cert = core.hrDocumentHtml('certificat', { ...emp, endDate: '2026-08-31' }, d, co, { date: '2026-09-11' });
  assert.ok(cert.includes('31/08/2026') && cert.includes('libre de tout engagement'));
  // le registre liste tout le monde, actifs et partis, dans l'ordre d'embauche
  const reg = core.staffRegister(d, '2026-09-11');
  assert.strictEqual(reg.length, 1);
  assert.strictEqual(reg[0].active, true);
  assert.strictEqual(reg[0].n, 1);
  assert.strictEqual(core.staffRegister(core.migrateData({ employees: [{ ...emp, endDate: '2026-01-31' }] }), '2026-09-11')[0].active, false);
});

// ---------- déclarations sociales (5.2.0) ----------

function declData() {
  const s = core.payrollSettings({});
  const e1 = { id: 'e1', name: 'Ahmed', cin: '01', cnss: 'A1', grossSalary: 1500, hireDate: '2025-01-01' };
  const e2 = { id: 'e2', name: 'Ines', cin: '02', cnss: 'B2', grossSalary: 1000, hireDate: '2025-01-01' };
  const slip = (e, m) => ({ id: `${e.id}-${m}`, employeeId: e.id, year: 2026, month: m,
    computed: core.computePayslip(e, {}, s) });
  return core.migrateData({
    company: CO,
    employees: [e1, e2],
    payslips: [1, 2, 3, 4, 5, 6].flatMap(m => [slip(e1, m), slip(e2, m)]),
    suppliers: [{ id: 'f1', name: 'Cabinet Comptable', matricule: '8A/P/000' }],
    purchases: [{ id: 'p1', kind: 'facture', supplierId: 'f1', number: 'H-1', date: '2026-03-10',
      category: 'Honoraires (comptable, avocat)', withholdingRate: 3, fees: 1,
      lines: [{ label: 'Honoraires', qty: 1, unitPrice: 1000, vatRate: 19, destination: 'charge', deductible: true }],
      payments: [], withholdingCertificate: false }]
  });
}

t('CNSS : le trimestre additionne les trois mois, par salarié', () => {
  const d = declData();
  const s = core.payrollSettings(d);
  const un = core.computePayslip(d.employees[0], {}, s);
  const q1 = core.cnssDeclaration(d, 2026, 1);
  assert.strictEqual(q1.employees, 2);
  assert.strictEqual(q1.slips, 6);                          // 2 salariés × 3 mois
  assert.strictEqual(q1.rows[0].months, 3);
  assert.strictEqual(q1.rows[0].employee, core.round3(un.cnssEmployee * 3));
  // le total dû à la CNSS, c'est les deux parts plus l'accident du travail
  assert.strictEqual(q1.total, core.round3(q1.employee + q1.employer + q1.accident));
  assert.strictEqual(q1.dueDate, '2026-04-15');             // le 15 du mois suivant le trimestre
  assert.strictEqual(core.cnssDeclaration(d, 2026, 4).dueDate, '2027-01-15');   // le quatrième bascule d'année
  // un trimestre sans bulletin ne fabrique pas de lignes
  assert.strictEqual(core.cnssDeclaration(d, 2026, 4).employees, 0);
  assert.strictEqual(core.cnssDeclaration(d, 2026, 4).total, 0);
});

t('déclaration d\'employeur : salaires et retenues sur fournisseurs, séparés', () => {
  const d = declData();
  const a = core.employerAnnual(d, 2026, CO);
  assert.strictEqual(a.employees, 2);
  assert.strictEqual(a.rows[0].months, 6);
  assert.strictEqual(a.gross, core.round3(a.rows.reduce((s, r) => s + r.gross, 0)));
  assert.ok(a.irpp > 0);
  assert.strictEqual(a.dueDate, '2027-04-30');
  // la retenue opérée sur le comptable figure à part, avec l'attestation qui manque
  assert.strictEqual(a.held.length, 1);
  assert.strictEqual(a.held[0].rate, 3);
  assert.strictEqual(a.heldMissing, 1);
  assert.strictEqual(a.heldBySupplier.length, 1);
  assert.strictEqual(a.heldBySupplier[0].supplier, 'Cabinet Comptable');
  assert.strictEqual(a.heldTotal, a.held[0].amount);
  // une année sans rien ne renvoie pas d'erreur
  const vide = core.employerAnnual(d, 2020, CO);
  assert.strictEqual(vide.employees, 0);
  assert.strictEqual(vide.heldTotal, 0);
});

t('déclarations sociales : ce qui est dû, ce qui est en retard, ce qui est déposé', () => {
  const d = declData();
  const due = core.socialDue(d, '2026-08-01');
  const t1 = due.find(x => x.id === 'cnss-2026-T1');
  const t2 = due.find(x => x.id === 'cnss-2026-T2');
  assert.ok(t1 && t1.late, 'le premier trimestre est en retard au 1er août');
  assert.ok(t2 && t2.late);
  // un trimestre sans bulletin n'est jamais réclamé
  assert.ok(!due.some(x => x.id === 'cnss-2026-T4'));
  // marquer déposé le fait disparaître
  d.socialFilings.push({ id: 'cnss-2026-T1', filedAt: '2026-04-12' });
  assert.ok(!core.socialDue(d, '2026-08-01').some(x => x.id === 'cnss-2026-T1'));
  // l'échéance CNSS du calendrier fiscal s'allume d'elle-même dès qu'il y a un salarié
  assert.strictEqual(core.fiscalDeadlines(d).find(x => x.id === 'cnss').active, true);
  assert.strictEqual(core.fiscalDeadlines(core.migrateData({})).find(x => x.id === 'cnss').active, false);
  // sans salarié, aucune déclaration sociale n'est réclamée
  assert.deepStrictEqual(core.socialDue(core.migrateData({}), '2026-08-01'), []);
});

// ---------- le paquet mensuel (6.1.0) ----------
// Le paquet part chez quelqu'un qui n'a pas SkanFact. Ces tests vérifient qu'il s'ouvre partout,
// qu'il dit la vérité sur son contenu, et qu'on ne peut pas le modifier sans que ça se voie.
const zipmod = require('../src/zip.js');

t('paquet : le ZIP écrit à la main se relit, entrée par entrée', () => {
  const gros = Buffer.from('date,numéro,montant\n'.repeat(300));
  const photo = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(600, 0x41)]);
  const buf = zipmod.zipBuffer([
    { name: 'manifeste.json', data: JSON.stringify({ société: 'Ébénisterie' }) },
    { name: 'journaux/ventes.csv', data: gros },
    { name: 'achats/reçu été.jpg', data: photo },
    { name: 'vide.txt', data: '' }
  ], { date: new Date(Date.UTC(2026, 8, 12, 10, 30, 0)) });

  assert.ok(buf.length < gros.length / 2, 'le CSV doit être compressé');
  const back = zipmod.zipRead(buf);
  assert.deepStrictEqual(back.map(e => e.name), ['manifeste.json', 'journaux/ventes.csv', 'achats/reçu été.jpg', 'vide.txt']);
  assert.ok(back[1].data().equals(gros), 'le CSV revient identique');
  assert.strictEqual(back[2].method, 0, 'une photo n\'est pas recompressée : ça la rallonge');
  assert.ok(back[2].data().equals(photo));
  assert.strictEqual(back[3].data().length, 0, 'un fichier vide reste un fichier');
  assert.strictEqual(JSON.parse(back[0].data().toString('utf8')).société, 'Ébénisterie', 'accents préservés');

  // un octet changé dans le corps : le CRC le dit. On isole une seule entrée pour viser à coup sûr
  // l'intérieur des données compressées (30 octets d'entête + le nom, puis le corps).
  const seul = zipmod.zipBuffer([{ name: 'j.csv', data: gros }], { date: new Date(Date.UTC(2026, 8, 12)) });
  const abime = Buffer.from(seul);
  const dansLeCorps = 30 + 'j.csv'.length + 12;
  abime[dansLeCorps] = abime[dansLeCorps] ^ 0xFF;
  assert.throws(() => zipmod.zipRead(abime)[0].data(), /abîmé|incorrect|invalid/i);
  // un fichier tronqué n'a plus de fin d'archive
  assert.throws(() => zipmod.zipRead(buf.subarray(0, buf.length - 10)), /tronqué|Fin d'archive/);
  // on ne s'échappe pas du dossier du paquet
  assert.throws(() => zipmod.zipBuffer([{ name: '../ailleurs.txt', data: 'x' }]), /interdit/);
});

t('paquet scellé : lisible de l\'extérieur, illisible sans le mot de passe, infalsifiable', () => {
  const zip = zipmod.zipBuffer([{ name: 'a.csv', data: 'date,montant\n2026-08-01,1000' }], { date: new Date(Date.UTC(2026, 8, 12)) });
  const sealed = zipmod.sealBuffer(zip, 'le-mot-convenu', { entreprise: 'Ébénisterie Test', periode: '2026-08', definitif: true });

  assert.ok(zipmod.isSealed(sealed) && !zipmod.isSealed(zip));
  // l'entête est en clair À DESSEIN : sans elle, un paquet mal rangé serait impossible à identifier
  const head = zipmod.sealHeader(sealed);
  assert.strictEqual(head.entreprise, 'Ébénisterie Test');
  assert.strictEqual(head.periode, '2026-08');
  assert.strictEqual(head.definitif, true);
  assert.strictEqual(head.alg, 'aes-256-gcm');
  assert.ok(!sealed.includes(Buffer.from('date,montant')), 'le contenu ne doit pas rester en clair');

  assert.ok(zipmod.openBuffer(sealed, 'le-mot-convenu').equals(zip), 'le bon mot de passe rend le zip intact');
  assert.throws(() => zipmod.openBuffer(sealed, 'autre-chose'), /Mot de passe incorrect/);
  const falsifie = Buffer.from(sealed); falsifie[falsifie.length - 3] ^= 1;
  assert.throws(() => zipmod.openBuffer(falsifie, 'le-mot-convenu'), /Mot de passe incorrect|modifié/);
  assert.throws(() => zipmod.openBuffer(zip, 'x'), /n'est pas un paquet scellé/);
});

t('paquet : le plan dit exactement ce qui partira', () => {
  const co = { name: 'Ébénisterie Test SUARL', matricule: '9876543Z/A/P/000', currency: 'TND', paymentTermsDays: 30, stampFee: 1 };
  const d = core.migrateData({
    documents: [
      { id: 'f1', type: 'facture', clientId: 'c1', number: 'FAC-2026-001', status: 'envoyée', date: '2026-08-10', dueDate: '2026-09-09',
        lines: [{ label: 'Pose', qty: 1, unitPrice: 1000, vatRate: 19 }], payments: [{ id: 'p1', date: '2026-08-20', amount: 500, method: 'virement' }] },
      { id: 'f2', type: 'facture', clientId: 'c1', number: '', status: 'brouillon', date: '2026-08-12', lines: [{ label: 'x', qty: 1, unitPrice: 50, vatRate: 19 }] },
      { id: 'f3', type: 'facture', clientId: 'c1', number: 'FAC-2026-002', status: 'envoyée', date: '2026-07-10', lines: [] }   // hors période
    ],
    clients: [{ id: 'c1', name: 'Client A' }],
    purchases: [{ id: 'a1', kind: 'facture', supplierId: 's1', number: 'F-99', date: '2026-08-05',
      lines: [{ label: 'bois', qty: 1, unitPrice: 200, vatRate: 19, destination: 'charge', deductible: true }],
      attachments: [{ name: 'recu.jpg', file: 'recu.jpg' }] }],
    suppliers: [{ id: 's1', name: 'Scierie' }]
  });
  const per = core.packPeriod(2026, 8);
  const plan = core.packPlan(d, co, per, { device: 'Poste de test' });
  const paths = plan.entries.map(e => e.path);

  assert.ok(paths.includes('journaux/ventes.csv') && paths.includes('journaux/achats.csv')
    && paths.includes('journaux/encaissements.csv') && paths.includes('journaux/tresorerie.csv')
    && paths.includes('journaux/tva.json'), 'les journaux sont là');
  assert.ok(paths.includes('ventes/FAC-2026-001.pdf'), 'la facture émise du mois est jointe');
  assert.ok(!paths.some(x => x.includes('f2')), 'un brouillon n\'a pas de PDF : il n\'a pas de numéro');
  assert.ok(!paths.includes('ventes/FAC-2026-002.pdf'), 'une facture d\'un autre mois n\'entre pas');
  assert.ok(paths.includes('achats/F-99/recu.jpg'), 'le justificatif d\'achat est joint');

  // les chiffres de la page de garde sont ceux des journaux
  assert.strictEqual(plan.totaux.pieces, 1);
  assert.strictEqual(plan.ca, 1000);
  assert.strictEqual(plan.tvaCollectee, 190);
  assert.strictEqual(plan.tvaDeductible, 38);
  assert.strictEqual(plan.encaisse, 500);

  // provisoire tant que le mois n'est pas clôturé, définitif après
  assert.strictEqual(plan.definitive, false);
  assert.ok(core.packFileName(co, per, false).endsWith('-provisoire.skanpack'));
  core.closePeriod(d, '2026-08-31', { todayIso: '2026-09-12' });
  assert.strictEqual(core.packPlan(d, co, per, {}).definitive, true);
  assert.strictEqual(core.packFileName(co, per, true), 'Ebenisterie-Test-SUARL-2026-08.skanpack');

  // ce qui manque est annoncé : ici un brouillon dans la période
  assert.ok(plan.checklist.some(c => c.id === 'brouillons'), 'le brouillon est signalé');
  assert.ok(plan.manifest.manques.some(m => m.id === 'brouillons'), 'et il passe dans le manifeste');
  assert.strictEqual(plan.manifest.periode.mois, '2026-08');
  assert.strictEqual(plan.manifest.entreprise.matricule, '9876543Z/A/P/000');
  assert.strictEqual(plan.manifest.format, core.PACK_FORMAT);
});

t('paquet : la page de garde dit le mois, l\'état et ce qui manque', () => {
  const co = { name: 'Ébénisterie <Test>', currency: 'TND', paymentTermsDays: 30, stampFee: 1 };
  const d = core.migrateData({ documents: [{ id: 'f1', type: 'facture', clientId: 'c1', number: 'FAC-1', status: 'brouillon', date: '2026-08-10', lines: [] }] });
  const plan = core.packPlan(d, co, core.packPeriod(2026, 8), {});
  const html = core.packCoverHtml(plan, co, { version: '6.1.0', at: '12/09/2026' });
  assert.ok(html.includes('août 2026'));
  assert.ok(html.includes('PROVISOIRE'), 'un mois non clôturé est annoncé comme provisoire');
  assert.ok(html.includes('facture(s) en brouillon'), 'ce qui manque figure sur la page de garde');
  assert.ok(!html.includes('<Test>'), 'le nom de société est échappé, pas injecté');
  assert.ok(html.includes('&lt;Test&gt;'));
  // un dossier complet le dit aussi
  const plan2 = core.packPlan(core.migrateData({}), co, core.packPeriod(2026, 8), {});
  assert.ok(core.packCoverHtml(plan2, co, {}).includes('le dossier est complet'));
});


t('paquet adressé à un cabinet : lui seul l\'ouvre, sans mot de passe échangé', () => {
  const cab = zipmod.generateCabinetKeys();
  const autre = zipmod.generateCabinetKeys();
  const zip = zipmod.zipBuffer([{ name: 'j.csv', data: 'date;montant\n2026-08-01;1000' }], { date: new Date(Date.UTC(2026, 8, 12)) });

  // l'empreinte est stable et se lit au téléphone : cinq groupes de quatre
  const fp = zipmod.keyFingerprint(cab.publicKey);
  assert.match(fp, /^[0-9A-F]{4}(-[0-9A-F]{4}){4}$/);
  assert.strictEqual(zipmod.keyFingerprint(cab.publicKey), fp, 'stable');
  assert.notStrictEqual(zipmod.keyFingerprint(autre.publicKey), fp, 'deux cabinets, deux empreintes');

  const p1 = zipmod.sealForCabinet(zip, cab.publicKey, { entreprise: 'Ébénisterie', periode: '2026-08', definitif: true });
  const p2 = zipmod.sealForCabinet(zip, cab.publicKey, { entreprise: 'Ébénisterie', periode: '2026-08', definitif: true });
  assert.ok(!p1.equals(p2), 'clé éphémère par paquet : deux envois identiques ne donnent pas deux fichiers identiques');
  assert.ok(!p1.includes(Buffer.from('date;montant')), 'rien en clair');

  // l'entête reste lisible sans aucune clé : un paquet mal rangé doit rester identifiable
  const head = zipmod.cabinetHeader(p1);
  assert.strictEqual(head.entreprise, 'Ébénisterie');
  assert.strictEqual(head.periode, '2026-08');
  assert.strictEqual(head.destinataire, fp, 'l\'entête dit à quel cabinet le paquet s\'adresse');
  assert.strictEqual(head.alg, 'x25519+aes-256-gcm');

  assert.ok(zipmod.openWithCabinetKey(p1, cab.privateKey).equals(zip), 'le bon cabinet ouvre');
  assert.throws(() => zipmod.openWithCabinetKey(p1, autre.privateKey), /pas destiné à ce cabinet/, 'un autre cabinet, non');
  const falsifie = Buffer.from(p1); falsifie[falsifie.length - 2] ^= 1;
  assert.throws(() => zipmod.openWithCabinetKey(falsifie, cab.privateKey), /modifié|pas destiné/);
  assert.ok(!zipmod.isSealedForCabinet(zip) && zipmod.isSealedForCabinet(p1));
  // les deux formes de scellement ne se confondent pas
  assert.throws(() => zipmod.openBuffer(p1, 'x'), /n'est pas un paquet scellé/);
});


// ---------- clôture de période (6.0.0) ----------
// Sans clôture, une pièce saisie aujourd'hui change la TVA d'un mois déjà déclaré, en silence.
// Ces tests sont purs : ils vérifient la règle, pas l'interface qui l'applique.
t('clôture : ce qui est clôturé ne bouge plus, et rouvrir laisse une trace', () => {
  const d = core.migrateData({});
  assert.strictEqual(core.closedUntil(d), '', 'rien de clôturé au départ');
  assert.strictEqual(core.isClosedDate(d, '2020-01-01'), false, 'sans clôture, aucune date n\'est close');

  // clôture
  assert.deepStrictEqual(core.closePeriod(d, '2026-08-31', { todayIso: '2026-09-12' }), { ok: true, until: '2026-08-31' });
  assert.strictEqual(core.isClosedDate(d, '2026-08-31'), true, 'le jour de clôture est inclus');
  assert.strictEqual(core.isClosedDate(d, '2026-08-01'), true);
  assert.strictEqual(core.isClosedDate(d, '2026-09-01'), false, 'le lendemain est libre');
  assert.strictEqual(core.isClosedDate(d, ''), false, 'une date vide ne se refuse pas : un brouillon se date');
  assert.ok(core.closedPeriodLabel(d, '2026-08-15').includes('août'), 'le message nomme le mois');

  // on ne clôture ni le futur, ni deux fois, ni en arrière
  assert.ok(core.closePeriod(d, '2026-12-31', { todayIso: '2026-09-12' }).error, 'pas de clôture dans le futur');
  assert.ok(core.closePeriod(d, '2026-07-31', { todayIso: '2026-09-12' }).error, 'pas de clôture en arrière : c\'est rouvrir');

  // réouverture : le motif est obligatoire, c'est lui que le comptable lira
  assert.ok(core.reopenPeriod(d, '2026-07-31', {}).error, 'pas de réouverture sans motif');
  assert.ok(core.reopenPeriod(d, '2026-09-30', { reason: 'x' }).error, 'une réouverture va en arrière, pas en avant');
  assert.deepStrictEqual(core.reopenPeriod(d, '2026-07-31', { reason: 'facture d\'achat retrouvée' }), { ok: true, until: '2026-07-31' });
  assert.strictEqual(core.isClosedDate(d, '2026-08-15'), false, 'août est rouvert');
  assert.strictEqual(core.isClosedDate(d, '2026-07-15'), true, 'juillet reste clos');

  // tout rouvrir
  assert.ok(core.reopenPeriod(d, '', { reason: 'reprise complète' }).ok);
  assert.strictEqual(core.closedUntil(d), '');
  assert.ok(core.reopenPeriod(d, '2026-01-01', { reason: 'x' }).error, 'plus rien à rouvrir');

  // le journal garde tout, du plus récent au plus ancien
  const log = core.closureLog(d);
  assert.strictEqual(log.length, 3);
  assert.deepStrictEqual(log.map(e => e.action), ['reouverture', 'reouverture', 'cloture']);
  assert.strictEqual(log[0].reason, 'reprise complète');
  assert.strictEqual(log[2].until, '2026-08-31');
  assert.ok(core.CLOSURE_ACTIONS.cloture && core.CLOSURE_ACTIONS.reouverture);
});

t('clôture : les mois proposés s\'arrêtent au mois en cours et suivent le dernier clôturé', () => {
  const d = core.migrateData({ documents: [{ id: 'a', type: 'facture', date: '2026-06-10', status: 'envoyée', lines: [] }] });
  const m = core.closableMonths(d, '2026-09-12');
  assert.deepStrictEqual(m.map(x => x.month), ['2026-06', '2026-07', '2026-08'], 'de la première pièce au mois précédent');
  assert.strictEqual(m[0].from, '2026-06-01');
  assert.strictEqual(m[0].to, '2026-06-30', 'le dernier jour du mois, pas le 31');
  assert.strictEqual(m[2].to, '2026-08-31');

  core.closePeriod(d, '2026-06-30', { todayIso: '2026-09-12' });
  assert.deepStrictEqual(core.closableMonths(d, '2026-09-12').map(x => x.month), ['2026-07', '2026-08'], 'reprend après le dernier clôturé');

  // février bissextile, et un dossier vide ne propose rien
  const d2 = core.migrateData({ documents: [{ id: 'b', type: 'facture', date: '2028-02-03', status: 'envoyée', lines: [] }] });
  assert.strictEqual(core.closableMonths(d2, '2028-03-15')[0].to, '2028-02-29');
  assert.deepStrictEqual(core.closableMonths(core.migrateData({}), '2026-09-12'), []);
});

t('clôture : les contrôles montrent ce qui manque, sans jamais bloquer', () => {
  const co = { name: 'T', currency: 'TND', paymentTermsDays: 30, stampFee: 1 };
  const d = core.migrateData({
    documents: [{ id: 'br', type: 'facture', clientId: 'c', number: '', status: 'brouillon', date: '2026-08-20', lines: [{ label: 'x', qty: 1, unitPrice: 100, vatRate: 19 }] }],
    purchases: [{ id: 'p1', kind: 'facture', date: '2026-08-05', lines: [{ label: 'y', qty: 1, unitPrice: 50, vatRate: 19, destination: 'charge', deductible: true }], attachments: [] }]
  });
  const checks = core.closureChecks(d, co, '2026-08-01', '2026-08-31');
  const ids = checks.map(c => c.id);
  assert.ok(ids.includes('brouillons'), 'le brouillon de facture est signalé');
  assert.ok(ids.includes('justificatifs'), 'l\'achat sans pièce jointe est signalé');
  assert.strictEqual(checks.find(c => c.id === 'brouillons').level, 'danger');
  assert.strictEqual(checks.find(c => c.id === 'justificatifs').level, 'warn');
  // un contrôle n'empêche jamais de clôturer
  assert.ok(core.closePeriod(d, '2026-08-31', { todayIso: '2026-09-12' }).ok, 'on clôture malgré les signalements');
  // et un mois propre ne signale rien
  assert.deepStrictEqual(core.closureChecks(core.migrateData({}), co, '2026-08-01', '2026-08-31'), []);
});

t('clôture : « À faire » réclame les mois terminés depuis dix jours', () => {
  const co = { name: 'T', matricule: 'M', rib: 'R', currency: 'TND', paymentTermsDays: 30 };
  const d = core.migrateData({ documents: [{ id: 'a', type: 'facture', clientId: 'c', number: 'F1', status: 'payée', date: '2026-07-10', lines: [] }] });
  const item = () => core.todoList(d, co, '2026-09-12').find(x => x.id === 'cloture');
  assert.ok(item(), 'juillet et août sont à clôturer');
  assert.strictEqual(item().count, 2);
  core.closePeriod(d, '2026-08-31', { todayIso: '2026-09-12' });
  assert.strictEqual(item(), undefined, 'plus rien à réclamer une fois à jour');
  // le mois qui vient de se terminer n'est pas encore réclamé : les factures d'achat arrivent en retard
  const d2 = core.migrateData({ documents: [{ id: 'b', type: 'facture', clientId: 'c', number: 'F2', status: 'payée', date: '2026-08-10', lines: [] }] });
  assert.strictEqual(core.todoList(d2, co, '2026-09-05').find(x => x.id === 'cloture'), undefined, 'cinq jours après : trop tôt');
  assert.ok(core.todoList(d2, co, '2026-09-11').find(x => x.id === 'cloture'), 'dix jours après : réclamé');
});

t('clôture : elle voyage avec le dossier partagé et survit à une fusion', () => {
  const mine = core.migrateData({ closedUntil: '2026-08-31', syncRevision: 2 });
  const disk = core.migrateData({ closedUntil: '2026-08-31', syncRevision: 3, closureLog: [{ id: 'x', action: 'cloture', until: '2026-08-31', reason: '' }] });
  const m = core.mergeData(mine, disk);
  assert.strictEqual(m.data.closedUntil, '2026-08-31', 'la clôture est reprise du fichier écrit en dernier');
});


// ---------- dates et fuseaux horaires ----------
// Le gel de la 5.1.0 → 5.2.2 sur le Mac de Skander : `addDays` construisait la date en heure locale
// et la relisait en UTC. À Tunis (UTC+1), minuit est encore 23 h la veille en UTC : `addDays(d, 1)`
// renvoyait `d`, une échéance à 30 jours tombait un jour trop tôt, et la boucle de `workingDays`
// ne finissait jamais. Rien ne se voyait sur une machine réglée en UTC — la nôtre. Ce test change
// de fuseau à chaud (Node le permet) et exige le même résultat partout.
t('dates : le même résultat à Tunis, à Los Angeles, à Kiritimati et en UTC', () => {
  const tzBefore = process.env.TZ;
  try {
    for (const tz of ['Africa/Tunis', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Kolkata']) {
      process.env.TZ = tz;
      assert.strictEqual(core.addDays('2026-09-12', 1), '2026-09-13', `${tz} : +1 jour`);
      assert.strictEqual(core.addDays('2026-09-12', 30), '2026-10-12', `${tz} : +30 jours (une échéance)`);
      assert.strictEqual(core.addDays('2026-12-31', 1), '2027-01-01', `${tz} : passage d'année`);
      assert.strictEqual(core.addDays('2026-03-01', -1), '2026-02-28', `${tz} : −1 jour`);
      assert.strictEqual(core.addDays('n\'importe quoi', 1), '', `${tz} : date invalide → vide, jamais une boucle`);
      assert.strictEqual(core.daysInMonth(2026, 2), 28, `${tz} : février`);
      assert.strictEqual(core.daysInMonth(2028, 2), 29, `${tz} : février bissextile`);
      // 1er septembre 2026 = mardi ; du mardi au samedi : 5 jours ouvrables, dimanche seul chômé
      const t0 = Date.now();
      assert.strictEqual(core.workingDays('2026-09-01', '2026-09-05'), 5, `${tz} : jours ouvrables`);
      assert.strictEqual(core.workingDays('2026-09-01', '2026-09-30'), 26, `${tz} : un mois de six jours`);
      assert.strictEqual(core.workingDays('2026-09-01', '2026-09-30', [0, 6]), 22, `${tz} : semaine de cinq jours`);
      assert.strictEqual(core.workingDays('2026-09-05', '2026-09-01'), 0, `${tz} : à l'envers → 0`);
      assert.strictEqual(core.workingDays('2026-09-01', '2099-12-31') > 0, true, `${tz} : borné, pas infini`);
      assert.ok(Date.now() - t0 < 2000, `${tz} : workingDays doit rendre la main tout de suite`);
      assert.strictEqual(core.leaveDaysInMonth({ from: '2026-08-28', to: '2026-09-02' }, 2026, 9), 2, `${tz} : congé à cheval, part de septembre`);
      // « aujourd'hui » est le jour du calendrier LOCAL de l'utilisateur, pas le jour UTC
      const d = new Date();
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      assert.strictEqual(core.today(), local, `${tz} : today() = jour local`);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(core.nextRecurrenceDate('2026-01-31', 'mois', 31)), `${tz} : récurrence`);
    }
  } finally { if (tzBefore === undefined) delete process.env.TZ; else process.env.TZ = tzBefore; }
});

// ---------- superposition des couches (src/renderer/style.css) ----------
// Une fenêtre de confirmation affichée sous l'assistant de première utilisation avait toutes ses
// commandes visibles mais inertes : les clics atterrissaient sur l'écran du dessus. Aucune erreur
// JS, aucune trace — seulement un bouton qui « ne marche pas », et un curseur qui change de forme
// d'un pixel à l'autre selon ce qui se trouve dessus. L'invariant se vérifie sans Electron.
t('couches : une question passe au-dessus de tout, les bulles et messages au-dessus d\'elle', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'style.css'), 'utf8');
  const z = sel => {
    const re = new RegExp(sel.replace(/[.#]/g, '\\$&') + '[^{]*\\{[^}]*?z-index:\\s*(\\d+)');
    const m = css.match(re);
    assert.ok(m, `z-index introuvable pour ${sel}`);
    return Number(m[1]);
  };
  const modale = z('.modal-bg');
  // Tout écran qui occupe la fenêtre entière doit rester SOUS les fenêtres modales.
  ['#setup', '#lock-screen', '#palette-root'].forEach(sel =>
    assert.ok(z(sel) < modale, `${sel} (${z(sel)}) couvre les fenêtres modales (${modale})`));
  // La bulle d'aide et les messages doivent rester lisibles par-dessus une fenêtre modale.
  ['#info-pop', '#toast'].forEach(sel =>
    assert.ok(z(sel) > modale, `${sel} (${z(sel)}) passe sous les fenêtres modales (${modale})`));
  // Les couches empilées par modal() partent de la même base que la règle CSS.
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
  const base = appSrc.match(/layer\.style\.zIndex = String\((\d+) \+ root\.children\.length\)/);
  assert.ok(base, 'base d\'empilement des fenêtres modales introuvable dans app.js');
  assert.strictEqual(Number(base[1]), modale, 'app.js et style.css ne partent pas de la même couche');
});

// ---------- licence hors ligne (6.4.0) ----------
const lic = require('../src/licence.js');

t('licence : signée par Skander, vérifiée sur l\'ordinateur du client, et par personne d\'autre', () => {
  const k = lic.generateKeys();
  const key = lic.signLicence({ nom: 'Menuiserie Trabelsi SUARL', matricule: '1234567A', exp: '2027-09-12', cabinet: 'AB12-CD34' }, k.privateKey);
  const p = lic.verifyKey(key, k.publicKey);
  assert.ok(p && p.nom === 'Menuiserie Trabelsi SUARL');
  // Une licence émise avec une autre clé privée ne passe pas : c'est tout l'intérêt de la signature.
  assert.strictEqual(lic.verifyKey(key, lic.generateKeys().publicKey), null, 'une autre clé publique doit refuser');
  assert.strictEqual(lic.verifyKey(key.slice(0, -6), k.publicKey), null, 'une clé tronquée doit refuser');
  assert.strictEqual(lic.verifyKey(key + 'x', k.publicKey), null, 'une clé rallongée doit refuser');
  assert.strictEqual(lic.verifyKey('n\'importe quoi', k.publicKey), null);
  assert.strictEqual(lic.verifyKey('', k.publicKey), null);
  // Modifier le contenu (repousser la date) invalide la signature.
  const parts = key.slice(lic.PREFIX.length).split('.');
  const body = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  body.exp = '2099-01-01';
  const forged = lic.PREFIX + Buffer.from(JSON.stringify(body)).toString('base64url') + '.' + parts[1];
  assert.strictEqual(lic.verifyKey(forged, k.publicKey), null, 'une licence retouchée doit être refusée');
});

t('licence : les états, et ce qu\'ils bloquent', () => {
  const k = lic.generateKeys();
  const key = lic.signLicence({ nom: 'X', exp: '2027-09-12' }, k.privateKey);
  const S = o => lic.licenceState({ publicKey: k.publicKey, installedAt: '2026-09-01', ...o });

  // Sans clé publique configurée, l'application est LIBRE : elle ne se verrouille jamais toute seule.
  const libre = lic.licenceState({ today: '2030-01-01', installedAt: '2020-01-01' });
  assert.strictEqual(libre.state, 'libre');
  assert.strictEqual(libre.locked, false, 'une version sans clé publique ne doit rien bloquer');

  assert.strictEqual(S({ today: '2026-09-12' }).state, 'essai');
  assert.strictEqual(S({ today: '2026-09-12' }).daysLeft, 19);
  assert.strictEqual(S({ today: '2026-09-12' }).locked, false);
  assert.strictEqual(S({ today: '2026-10-01' }).state, 'essai', 'le dernier jour d\'essai est encore un essai');
  assert.strictEqual(S({ today: '2026-10-02' }).state, 'finessai');
  assert.strictEqual(S({ today: '2026-10-02' }).locked, true);

  assert.strictEqual(S({ today: '2030-01-01', key }).state, 'expiree');
  assert.strictEqual(S({ today: '2027-09-12', key }).state, 'active', 'le jour de l\'échéance compte encore');
  assert.strictEqual(S({ today: '2027-09-13', key }).state, 'expiree');
  assert.strictEqual(S({ today: '2026-09-12', key }).locked, false);
  assert.strictEqual(S({ today: '2026-09-12', key: 'SKAN1.faux.faux' }).state, 'invalide');

  // Une licence sans date d'expiration ne se périme pas.
  const perpet = lic.signLicence({ nom: 'Y' }, k.privateKey);
  assert.strictEqual(S({ today: '2099-01-01', key: perpet }).state, 'active');

  // Le message d'une licence expirée doit dire ce qui reste possible : jamais de données en otage.
  assert.ok(/lisible|exportable/i.test(S({ today: '2030-01-01', key }).detail));
});

t('licence : les dates tiennent sous tous les fuseaux, et la demande porte le cabinet parrain', () => {
  const tzBefore = process.env.TZ;
  try {
    const k = lic.generateKeys();
    const key = lic.signLicence({ nom: 'X', exp: '2026-10-01' }, k.privateKey);
    for (const tz of ['Africa/Tunis', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      const st = lic.licenceState({ publicKey: k.publicKey, key, installedAt: '2026-09-01', today: '2026-09-12' });
      assert.strictEqual(st.state, 'active', tz);
      assert.strictEqual(st.daysLeft, 19, tz + ' : le décompte doit être le même partout');
      assert.strictEqual(lic.addDays('2026-09-12', 30), '2026-10-12', tz);
    }
  } finally { if (tzBefore === undefined) delete process.env.TZ; else process.env.TZ = tzBefore; }

  const m = lic.requestMail(
    { name: 'Menuiserie Trabelsi', matricule: '1234567A', email: 'a@b.tn', cabinet: { name: 'Cabinet Ben Salah', fingerprint: 'AB12-CD34' } },
    { label: 'Période d\'essai' }, 'MacBook de Skander');
  assert.ok(m.body.includes('1234567A') && m.body.includes('AB12-CD34'), 'la demande doit porter le matricule et le parrain');
  assert.ok(/parrainage/.test(m.body), 'et réclamer la remise de parrainage');
});

t('licence : le garde-fou ne barre que la création, et l\'app livrée ne se verrouille pas', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
  // Le garde-fou ne doit être posé que sur des créations, jamais sur un export ou une lecture.
  const calls = src.match(/licenceBlock\('[^']+'\)/g) || [];
  assert.ok(calls.length >= 4, 'garde-fou de licence absent des chemins de création');
  calls.forEach(c => assert.ok(/Créer|Émettre|Enregistrer un nouvel|Établir un nouveau/.test(c),
    'le garde-fou de licence est posé ailleurs que sur une création : ' + c));
  assert.ok(!/licenceBlock\([^)]*[Ee]xport/.test(src), 'un export ne doit jamais dépendre de la licence');
  // Et la version livrée n'embarque pas de clé publique : elle ne peut donc verrouiller personne.
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'build', 'licence-public.json')),
    'build/licence-public.json est présent : la licence serait armée pour tout le monde — c\'est une décision du propriétaire, pas un effet de bord');
});

// ---------- écritures comptables (Cabinet 1.1.0) ----------
// L'invariant, et le seul qui soit certain : débit = crédit, pièce par pièce. Les numéros de compte,
// eux, sont une proposition — d'où le fait qu'ils soient modifiables et marqués « À VÉRIFIER ».
t('écritures : chaque pièce tombe juste, sur toute l\'année de démonstration', () => {
  const demo = require('../src/renderer/demo.js');
  const company = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', matricule: '1234567A' };
  const data = core.migrateData(demo.buildDemoData(company, '2026-09-12'));
  let lines = 0;
  for (const year of [2025, 2026]) {
    for (let m = 1; m <= 12; m++) {
      const entries = core.journalEntries(data, data.company, core.packPeriod(year, m), {});
      const bal = core.entriesBalance(entries);
      lines += entries.length;
      assert.ok(bal.balanced, `${year}-${m} : ${bal.off.length} pièce(s) déséquilibrée(s)`);
      // Aucun logiciel comptable n'accepte un montant négatif : un avoir change de colonne.
      entries.forEach(e => assert.ok(e.debit >= 0 && e.credit >= 0, `${year}-${m} : montant négatif sur ${e.piece}`));
      entries.forEach(e => assert.ok(!(e.debit && e.credit), `${year}-${m} : une ligne au débit ET au crédit sur ${e.piece}`));
    }
  }
  assert.ok(lines > 200, 'le jeu de démonstration doit produire des écritures : ' + lines);
});

t('écritures : une facture, un avoir, un achat et un bulletin s\'écrivent comme il faut', () => {
  const company = { ...core.DEFAULT_COMPANY, name: 'T', matricule: '1A', stampFee: 1 };
  const data = core.migrateData({
    company,
    clients: [{ id: 'c1', name: 'Client Un' }],
    suppliers: [{ id: 's1', name: 'Fournisseur Un' }],
    documents: [
      { id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-05-10', status: 'envoyée', clientId: 'c1',
        lines: [{ label: 'Prestation', qty: 1, unitPrice: 1000, vatRate: 19 }] },
      { id: 'd2', type: 'avoir', number: 'AVO-2026-001', date: '2026-05-12', status: 'émis', clientId: 'c1',
        lines: [{ label: 'Retour', qty: 1, unitPrice: 200, vatRate: 19 }] }
    ],
    purchases: [{ id: 'p1', kind: 'facture', supplierId: 's1', number: 'F-77', date: '2026-05-11',
      lines: [{ label: 'Marchandise', qty: 1, unitPrice: 500, vatRate: 19, destination: 'stock', deductible: true }] }]
  });
  const acc = core.chartAccounts(data);
  const e = core.journalEntries(data, data.company, core.packPeriod(2026, 5), {});
  const at = (piece, account) => e.filter(x => x.piece === piece && x.account === account);

  // Facture : le client doit le TTC (timbre compris), la TVA et le timbre sont des dettes.
  assert.strictEqual(at('FAC-2026-001', acc.clients)[0].debit, 1191, 'client débité du TTC');
  assert.strictEqual(at('FAC-2026-001', acc.ventes)[0].credit, 1000);
  assert.strictEqual(at('FAC-2026-001', acc.tvaCollectee)[0].credit, 190);
  assert.strictEqual(at('FAC-2026-001', acc.timbre)[0].credit, 1, 'le timbre est encaissé pour l\'État, pas un produit');

  // Avoir : exactement l'inverse, en colonnes inversées — jamais en négatif.
  assert.strictEqual(at('AVO-2026-001', acc.clients)[0].credit, 238, 'le client est crédité');
  assert.strictEqual(at('AVO-2026-001', acc.ventes)[0].debit, 200, 'la vente est débitée');

  // Achat de marchandise : stock au débit, TVA déductible au débit, fournisseur au crédit.
  assert.strictEqual(at('F-77', acc.achatsStock)[0].debit, 500, 'acheter du stock n\'est pas une charge');
  assert.strictEqual(at('F-77', acc.tvaDeductible)[0].debit, 95);
  assert.strictEqual(at('F-77', acc.fournisseurs)[0].credit, 595);

  // Le plan de comptes se change, et les écritures suivent.
  data.chartAccounts = { clients: '4111', ventes: '7061' };
  const e2 = core.journalEntries(data, data.company, core.packPeriod(2026, 5), {});
  assert.ok(e2.some(x => x.account === '4111'), 'le compte client modifié doit être repris');
  assert.ok(e2.some(x => x.account === '7061'));
  assert.ok(!e2.some(x => x.account === '411'), 'et l\'ancien ne doit plus apparaître');
  assert.strictEqual(core.entriesBalance(e2).balanced, true, 'changer un compte ne déséquilibre rien');
});

t('écritures : une facture annulée ne produit aucune écriture', () => {
  const company = { ...core.DEFAULT_COMPANY, name: 'T', matricule: '1A' };
  const data = core.migrateData({
    company, clients: [{ id: 'c1', name: 'C' }],
    documents: [{ id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-05-10', status: 'annulée', clientId: 'c1',
      lines: [{ label: 'X', qty: 1, unitPrice: 100, vatRate: 19 }] }]
  });
  assert.strictEqual(core.journalEntries(data, data.company, core.packPeriod(2026, 5), {}).length, 0);
});

t('écritures : le paquet mensuel les emporte, équilibrées', () => {
  const demo = require('../src/renderer/demo.js');
  const company = { ...core.DEFAULT_COMPANY, name: 'T', matricule: '1A' };
  const data = core.migrateData(demo.buildDemoData(company, '2026-09-12'));
  const plan = core.packPlan(data, data.company, core.packPeriod(2026, 5), {});
  const file = plan.entries.find(e => e.path === 'journaux/ecritures.csv');
  assert.ok(file, 'le paquet doit contenir les écritures');
  assert.ok(file.text.split('\n').length > 5, 'et elles ne doivent pas être vides');
  // Un CSV sans entête est illisible par le logiciel du comptable : la première ligne doit nommer
  // les colonnes (le défaut est passé inaperçu parce que rien ne plante — le fichier est juste vide).
  const head = file.text.split('\r\n')[0].replace('﻿', '');
  assert.strictEqual(head, 'Date;Journal;Pièce;Compte;Tiers;Libellé;Débit;Crédit;Devise', head);
  assert.ok(/;\d+,\d{3};/.test(file.text.split('\r\n')[1]), 'les montants doivent être écrits à la française');
  assert.ok(plan.balance && plan.balance.balanced, 'le plan doit annoncer l\'équilibre');
  // La page de garde le dit au comptable, avec le mot « à adapter » : les comptes sont une proposition.
  const cover = core.packCoverHtml(plan, data.company, {});
  assert.ok(/Écritures comptables/.test(cover) && /adapter au plan du cabinet/.test(cover));
});

// ---------- SkanFact Cabinet (src/cabinet/cabcore.js) ----------
// La seconde application du dépôt. Sa logique est pure : elle se teste sans Electron, comme core.js.
const cab = require('../src/cabinet/cabcore.js');

const manif = (nom, mf, mois, def, extra) => ({
  format: 1, entreprise: { nom, matricule: mf }, periode: { mois, libelle: cab.monthLabel(mois) },
  definitif: !!def, genereLe: '2026-09-01T10:00:00.000Z',
  fichiers: [{ chemin: 'manifeste.json', empreinte: '' }, { chemin: '00-page-de-garde.pdf', empreinte: 'a' }],
  manques: (extra && extra.manques) || [], absents: (extra && extra.absents) || []
});

t('cabinet : un dossier est identifié par son matricule, pas par son nom', () => {
  // Une entreprise qui change de raison sociale reste le même dossier…
  const a = cab.dossierKey(manif('Menuiserie Trabelsi', '1234567A/M/P/000', '2026-07'));
  const b = cab.dossierKey(manif('Menuiserie Trabelsi SUARL', '1234567a m p 000', '2026-08'));
  assert.strictEqual(a, b, 'le matricule doit primer, quelle que soit sa ponctuation');
  // … et deux homonymes sans matricule ne se confondent que s'ils portent vraiment le même nom.
  assert.strictEqual(cab.dossierKey(manif('Café du Coin', '', '2026-07')), cab.dossierKey(manif('CAFE DU  COIN', '', '2026-08')));
  assert.notStrictEqual(cab.dossierKey(manif('Ben Ali', '111A', '2026-07')), cab.dossierKey(manif('Ben Ali', '222B', '2026-07')));
});

t('cabinet : ranger un paquet, et le dire quand il en remplace un définitif', () => {
  const s = cab.migrate({});
  const r1 = cab.filePack(s, manif('Trabelsi', '1234567A', '2026-07', true), { receivedAt: 1, bytes: 10, path: '/a' });
  assert.strictEqual(r1.created, true);
  assert.strictEqual(r1.replaced, false);
  assert.strictEqual(s.dossiers.length, 1);

  // même mois renvoyé, cette fois provisoire : le comptable DOIT l'apprendre, ses chiffres bougent
  const r2 = cab.filePack(s, manif('Trabelsi SUARL', '1234567A', '2026-07', false), { receivedAt: 2, bytes: 11, path: '/b' });
  assert.strictEqual(r2.created, false);
  assert.strictEqual(r2.replaced, true);
  assert.strictEqual(r2.wasDefinitive, true);
  assert.strictEqual(r2.nowDefinitive, false);
  assert.strictEqual(s.dossiers.length, 1, 'un renvoi ne crée pas un second dossier');
  assert.strictEqual(s.dossiers[0].packs.length, 1, 'un mois = un paquet, le dernier reçu');
  assert.strictEqual(s.dossiers[0].name, 'Trabelsi SUARL', 'le nom suit la raison sociale du client');
});

t('cabinet : les mois attendus, et jamais le mois en cours', () => {
  const s = cab.migrate({});
  cab.filePack(s, manif('X', '9A', '2026-05', true), { path: '/a' });
  cab.filePack(s, manif('X', '9A', '2026-07', false), { path: '/b' });
  const months = cab.dossierMonths(s.dossiers[0], '2026-09-12');
  assert.deepStrictEqual(months.map(m => m.month), ['2026-05', '2026-06', '2026-07', '2026-08']);
  assert.deepStrictEqual(months.map(m => m.state), ['complet', 'manquant', 'provisoire', 'manquant']);
  // On ne réclame rien avant le premier mois reçu : avant, on ne sait pas si ce client existait.
  assert.ok(!months.some(m => m.month < '2026-05'));

  const row = cab.dossierRow(s.dossiers[0], '2026-09-12');
  assert.strictEqual(row.missingCount, 2);
  assert.strictEqual(row.provisionalCount, 1);
  assert.strictEqual(row.lastMonth, '2026-07');
  assert.strictEqual(row.level, 'danger');
});

t('cabinet : les dossiers en retard passent devant, la recherche et l\'archivage filtrent', () => {
  const s = cab.migrate({});
  cab.filePack(s, manif('AJour SARL', '1A', '2026-07', true), { path: '/a' });
  cab.filePack(s, manif('AJour SARL', '1A', '2026-08', true), { path: '/a2' });
  cab.filePack(s, manif('Retard SUARL', '2B', '2026-05', true), { path: '/b' });
  cab.filePack(s, manif('Parti SARL', '3C', '2026-06', true), { path: '/c' });
  s.dossiers.find(d => d.name === 'Parti SARL').archived = true;

  const rows = cab.dossierList(s, '2026-09-12');
  assert.strictEqual(rows.length, 2, 'un dossier archivé ne se réclame plus');
  assert.strictEqual(rows[0].name, 'Retard SUARL', 'trois mois de retard passent devant un dossier à jour');
  assert.strictEqual(rows[1].missingCount, 0);
  assert.strictEqual(cab.dossierList(s, '2026-09-12', { withArchived: true }).length, 3);
  assert.strictEqual(cab.dossierList(s, '2026-09-12', { q: 'retard' }).length, 1);
  assert.strictEqual(cab.dossierList(s, '2026-09-12', { q: '2B' }).length, 1, 'on cherche aussi par matricule');
});

t('cabinet : ce que le comptable a sur le feu', () => {
  const s = cab.migrate({});
  cab.filePack(s, manif('Retard', '1A', '2026-05', true), { path: '/a' });
  cab.filePack(s, manif('Provisoire', '2B', '2026-07', false), { path: '/b' });
  cab.filePack(s, manif('Provisoire', '2B', '2026-08', false), { path: '/b2' });
  cab.filePack(s, manif('Trous', '3C', '2026-07', true, { manques: [{ id: 'justif', niveau: 'warn', quoi: 'justificatifs absents', combien: 4 }] }), { path: '/c' });
  cab.filePack(s, manif('Trous', '3C', '2026-08', true), { path: '/c2' });

  const todo = cab.cabinetTodo(s, '2026-09-12');
  const byId = Object.fromEntries(todo.map(x => [x.id, x]));
  assert.ok(byId.manquants, 'les mois jamais envoyés sont la première urgence');
  assert.strictEqual(byId.manquants.count, 1);
  assert.strictEqual(byId.manquants.level, 'danger');
  assert.ok(byId.provisoires, 'un mois non clôturé se relance aussi');
  assert.strictEqual(byId.provisoires.count, 1);
  assert.ok(byId.pieces, 'les pièces signalées par le client remontent');
  assert.strictEqual(byId.pieces.count, 1);
});

t('cabinet : la relance nomme les mois qui manquent', () => {
  const s = cab.migrate({});
  cab.filePack(s, manif('Trabelsi', '1A', '2026-05', true), { path: '/a' });
  const row = cab.dossierRow(s.dossiers[0], '2026-09-12');
  row.email = 'client@test.tn';
  const m = cab.relanceMail({ name: 'Cabinet Ben Salah' }, row, '2026-09-12');
  assert.strictEqual(m.to, 'client@test.tn');
  assert.strictEqual(m.subject, 'Il me manque vos dossiers de juin, juillet et août 2026',
    'les mois manquants sont nommés, l\'année ne se répète pas : ' + m.subject);
  assert.ok(m.body.includes('Cabinet Ben Salah'), 'le cabinet signe sa relance');
  assert.ok(m.body.includes('Clôtures'), 'la relance dit où cliquer dans SkanFact');

  // Onze mois énumérés dans un objet de mail ne se lisent pas : on donne l'intervalle, et le détail
  // dans le corps. Et « de octobre » ne s'écrit pas.
  const long = cab.relanceMail({ name: 'C' }, { missingMonths: ['2025-10', '2025-11', '2025-12', '2026-01'], lastLabel: '', email: '' });
  assert.strictEqual(long.subject, 'Il me manque 4 mois de dossiers (d\'octobre 2025 à janvier 2026)', long.subject);
  assert.ok(long.body.includes('· décembre 2025'), 'le détail des mois reste dans le corps');
  assert.strictEqual(cab.relanceMail({ name: 'C' }, { missingMonths: ['2026-04'], lastLabel: '', email: '' }).subject,
    'Il me manque votre dossier d\'avril 2026');

  // Rien ne manque, mais le dernier reçu est provisoire : le message change de sujet.
  const s2 = cab.migrate({});
  cab.filePack(s2, manif('X', '2B', '2026-08', false), { path: '/b' });
  const m2 = cab.relanceMail({ name: 'C' }, cab.dossierRow(s2.dossiers[0], '2026-09-12'), '2026-09-12');
  assert.ok(/n'est pas définitif/.test(m2.subject), m2.subject);
});

// Les chiffres du mois voyagent dans le manifeste depuis la 6.2.1 : le comptable voit le chiffre
// d'affaires et la TVA de chaque dossier sans ouvrir un CSV. Un paquet plus ancien n'en a pas, et
// l'application doit alors écrire « — », jamais zéro : zéro serait un chiffre, et il serait faux.
t('cabinet : les chiffres du mois traversent le paquet, et leur absence se voit', () => {
  const avec = { ...manif('X', '1A', '2026-07', true), chiffres: { ca: 1234.5, tvaCollectee: 234.5, tvaADecaisser: 120, devise: 'TND' } };
  assert.strictEqual(cab.packSummary(avec, {}).figures.ca, 1234.5);
  assert.strictEqual(cab.packSummary(manif('X', '1A', '2026-07', true), {}).figures, null, 'un paquet sans chiffres ne doit pas en inventer');
  const s = cab.migrate({});
  cab.filePack(s, avec, { path: '/a' });
  assert.strictEqual(cab.dossierRow(s.dossiers[0], '2026-09-12').lastFigures.ca, 1234.5);

  // Et côté entreprise, packPlan doit bien les poser dans le manifeste.
  const data = core.migrateData({ company: { ...core.DEFAULT_COMPANY, name: 'T', matricule: '1A' }, documents: [], counters: {} });
  const plan = core.packPlan(data, data.company, core.packPeriod(2026, 7), {});
  assert.ok(plan.manifest.chiffres && 'ca' in plan.manifest.chiffres, 'le manifeste doit porter les chiffres du mois');
  assert.ok(plan.manifest.compte && 'pieces' in plan.manifest.compte, 'et le compte des pièces');
});

t('cabinet : le jeu d\'exemple montre les quatre situations, à n\'importe quelle date', () => {
  for (const jour of ['2026-09-12', '2026-01-03', '2026-12-31', '2027-02-28']) {
    const s = cab.migrate({ dossiers: cab.demoDossiers(jour) });
    assert.strictEqual(s.dossiers.length, 5, jour);
    assert.ok(s.dossiers.every(d => d.demo), jour + ' : le drapeau « exemple » doit survivre à migrate()');
    const rows = cab.dossierList(s, jour);
    assert.ok(rows.some(r => r.missingCount > 0), jour + ' : un dossier en retard');
    assert.ok(rows.some(r => r.provisionalCount > 0), jour + ' : un dossier provisoire');
    assert.ok(rows.some(r => r.issues > 0), jour + ' : un dossier avec des pièces signalées');
    assert.ok(rows.some(r => r.level === 'ok'), jour + ' : un dossier à jour');
    assert.ok(rows[0].score >= rows[rows.length - 1].score, jour + ' : les retards en tête');
    // Aucun paquet d'exemple n'a de fichier sur le disque : l'interface ne doit pas proposer de l'ouvrir.
    assert.ok(s.dossiers.every(d => d.packs.every(p => !p.path)), jour);
    // Jamais l'entreprise du propriétaire ni un matricule réel dans un jeu de démonstration.
    const json = JSON.stringify(s);
    assert.ok(!/SKANCYBER/i.test(json) && !/1998268D/.test(json), jour);
  }
});

t('cabinet : le fichier d\'appairage ne contient QUE la clé publique', () => {
  const f = cab.pairingFile({ name: 'C', email: 'c@t.tn', publicKey: 'PUB', privateKey: 'SECRET' }, 'AB12-CD34');
  const json = JSON.stringify(f);
  assert.ok(!/SECRET/.test(json), 'la clé privée ne doit jamais sortir du poste du cabinet');
  assert.ok(!('privateKey' in f));
  assert.strictEqual(f.publicKey, 'PUB');
  assert.strictEqual(f.fingerprint, 'AB12-CD34');
});

// Le même piège que côté entreprise : une date est un jour du calendrier, jamais un instant.
t('cabinet : l\'arithmétique des mois donne le même résultat sous tous les fuseaux', () => {
  const tzBefore = process.env.TZ;
  try {
    for (const tz of ['Africa/Tunis', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      assert.strictEqual(cab.addMonth('2026-12', 1), '2027-01', tz);
      assert.strictEqual(cab.addMonth('2026-01', -1), '2025-12', tz);
      assert.deepStrictEqual(cab.monthsBetween('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02'], tz);
      assert.ok(cab.monthsBetween('1900-01', '2200-01').length <= 240, tz + ' : borné, jamais infini');
      assert.strictEqual(cab.monthLabel('2026-08'), 'août 2026', tz);
    }
  } finally { if (tzBefore === undefined) delete process.env.TZ; else process.env.TZ = tzBefore; }
});

// La clé privée du cabinet ouvre toutes les comptabilités de ses clients. Elle ne doit jamais
// traverser le pont vers l'interface : de là, elle finirait dans une capture d'écran ou un journal.
t('cabinet : la clé privée ne traverse jamais le pont vers l\'interface', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'main.js'), 'utf8');
  assert.ok(/function safeState\(\)[\s\S]*?delete s\.cabinet\.privateKey/.test(src), 'safeState doit retirer la clé privée');
  // Tout handler qui renvoie l'état doit passer par safeState(), jamais par `state` directement.
  const handlers = src.match(/ipcMain\.handle\([^]*?\n\}\);/g) || [];
  src.split(/ipcMain\.handle\(/).slice(1).forEach(block => {
    const name = (block.match(/^'([^']+)'/) || [])[1] || '?';
    assert.ok(!/return\s+state\b/.test(block), `le handler ${name} renvoie l'état brut`);
  });
  assert.ok(handlers.length >= 0);
  // L'interface ne reçoit aucun moyen de demander la clé.
  const pre = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'preload.js'), 'utf8');
  assert.ok(!/privateKey/.test(pre), 'le préchargement ne parle pas de clé privée');
  // Et elle n'écrit jamais chez un client : aucune fonction d'export de données vers l'entreprise.
  assert.ok(!/data:save|pack:build/.test(pre), 'l\'app cabinet ne doit rien pouvoir écrire chez un client');
});

console.log(`\n${n} tests OK`);
