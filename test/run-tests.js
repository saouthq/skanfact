// Tests de la logique métier (node test/run-tests.js)
const assert = require('assert');
const core = require('../src/renderer/core.js');

let n = 0;
function t(name, fn) {
  const r = fn();
  // Un test asynchrone dont on n'attend pas la promesse affiche « ok » sans avoir rien vérifié :
  // il ne peut plus jamais échouer. Ici, on refuse de le laisser passer.
  if (r && typeof r.then === 'function') throw new Error(`le test « ${name} » est asynchrone : utilise ta() et attends-le`);
  n++; console.log('ok -', name);
}
// Version asynchrone, à attendre explicitement : `await ta('…', async () => { … })`.
async function ta(name, fn) { await fn(); n++; console.log('ok -', name); }

// Un test qui lit du code doit lire du CODE : un appel cité dans un commentaire, ou un lien mis en
// commentaire, satisfait un `includes` sans que le code fasse quoi que ce soit (6.8.0, 7.0.0). On
// retire donc les commentaires — et on vérifie que le nettoyage n'a pas mangé le code au passage.
// Et il doit le lire en fins de ligne UNIX. Sur Windows, git convertit les fichiers texte en CRLF
// au checkout (core.autocrlf, activé par défaut) : toute assertion qui contient un « \n » littéral
// cesse alors de correspondre, et le test échoue sur la seule plateforme où personne ne regarde.
// C'est ce qui bloquait la publication en 7.21.3. Un `.gitattributes` impose désormais le LF au
// checkout ; on normalise quand même ici, pour une copie de travail clonée avant cette règle.
function lireSource(...morceaux) {
  const fs2 = require('fs'), path2 = require('path');
  return fs2.readFileSync(path2.join(__dirname, '..', ...morceaux), 'utf8').replace(/\r\n/g, '\n');
}

// Le menu d'actions d'une ligne vit dans son propre fichier depuis la 7.29.0, parce que les DEUX
// applications s'en servent. Comme pour app.js, on juge le CODE : un commentaire qui cite la règle
// qu'on cherche l'a déjà satisfaite deux fois dans l'histoire de ce projet (6.8.0, 7.25.0).
function lireRowMenu() {
  const brut = lireSource('src', 'renderer', 'rowmenu.js');
  const net = brut.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(net.includes('function brancherMenus') && net.includes('const ICO = {'),
    'le nettoyage des commentaires a mangé le code du menu d\'actions');
  return net;
}

function lireApp() {
  const brut = lireSource('src', 'renderer', 'app.js');
  const net = brut.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(net.includes('routes.dashboard') && net.length > brut.length * 0.6,
    'le nettoyage des commentaires a mangé le code : le test ne jugerait plus rien');
  return net;
}

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
  // 1 000 HT + 190 de TVA + le timbre. Le timbre vaut **1 dinar**, pas « 1 » : sur une facture en
  // euros il se convertit, soit 1 / 3,4 = 0,29 €. Jusqu'à la 7.0.1 il était ajouté tel quel, et
  // cette assertion affirmait donc le défaut : elle attendait 1 191,00 €, c'est-à-dire un timbre de
  // 3,40 DT sur une facture qui en doit 1,00.
  assert.ok(html.includes('1,190.29'), 'le timbre doit être converti dans la devise du document');
  assert.ok(html.includes('<small>EUR</small>') && html.includes('1 EUR = 3,400 DT'));
  assert.ok(html.includes('Total amount in words:') && html.includes('one thousand one hundred and ninety euros'));
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

// Le pire cas de cette fonction : celui qu'on ne voit pas, parce qu'il se passe sur la clé USB.
t('mot de passe : la copie externe ne garde pas les sauvegardes en clair', () => {
  const { isEncrypted } = require('../src/storage.js');
  const ext = tmpDir();
  const day = new Date('2026-05-10T08:00:00Z');
  const s = createStorage(tmpDir(), { now: () => day });
  s.setExternalDir(ext);
  s.write({ ...core.DEFAULT_DATA, clients: [{ id: 'a', name: 'Client secret' }] });
  s.write({ ...core.DEFAULT_DATA, clients: [{ id: 'a', name: 'Client secret 2' }] });  // sauvegarde du jour
  const dossierExt = path.join(ext, 'SkanFact', 'backups');
  const noms = fs.readdirSync(dossierExt).filter(f => f.endsWith('.json'));
  assert.strictEqual(noms.length, 1, 'la sauvegarde doit être copiée dehors');
  assert.ok(!isEncrypted(JSON.parse(fs.readFileSync(path.join(dossierExt, noms[0]), 'utf8'))),
    'au départ, tout est en clair des deux côtés');

  // On active un mot de passe. `mirrorExternal` ne recopiait un fichier que s'il n'existait PAS
  // encore : la copie externe restait donc en clair pour toujours, à côté d'un fichier de données
  // chiffré, pendant que l'écran annonçait « le fichier et ses sauvegardes sont chiffrés ».
  s.setPassword(s.read(), 'motdepasse');
  assert.ok(isEncrypted(JSON.parse(fs.readFileSync(s.file, 'utf8'))), 'le fichier local est chiffré');
  assert.ok(isEncrypted(JSON.parse(fs.readFileSync(path.join(ext, 'SkanFact', 'skanfact-data.json'), 'utf8'))),
    'le fichier externe est chiffré');
  assert.ok(isEncrypted(JSON.parse(fs.readFileSync(path.join(dossierExt, noms[0]), 'utf8'))),
    'une sauvegarde déjà copiée dehors est restée EN CLAIR après l\'activation du mot de passe');

  // Et une sauvegarde externe qui n'a plus d'équivalent local (rotation de trente jours) se
  // convertit aussi : sinon elle resterait lisible sur la clé pour toujours. On ne la SUPPRIME pas,
  // c'est un filet — elle a juste à ne plus être lisible.
  const orpheline = path.join(dossierExt, 'manuelle-2020-01-01_00h00m00.json');
  fs.writeFileSync(orpheline, JSON.stringify({ ...core.DEFAULT_DATA, clients: [{ id: 'z', name: 'Vieux client' }] }));
  s.setPassword(s.read(), 'autre-mot-de-passe');
  assert.ok(fs.existsSync(orpheline), 'une sauvegarde externe ancienne ne se supprime pas');
  assert.ok(isEncrypted(JSON.parse(fs.readFileSync(orpheline, 'utf8'))),
    'une sauvegarde externe sans équivalent local est restée en clair');
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
  // Les mêmes neuf lignes, quel que soit l'ordre : c'est le CONTENU qu'on vérifie ici.
  assert.deepStrictEqual(ids.slice().sort(),
    ['attestations', 'brouillons', 'cloture', 'contrats', 'devis-acceptes', 'devis-expires', 'devis-sans-reponse', 'echeances', 'retards'].sort());
  // Et l'ordre, lui, se vérifie par sa RÈGLE plutôt que par une liste écrite à la main : le panneau
  // promet « du plus urgent au moins urgent » depuis la 1.10.0 et rendait en fait l'ordre du code,
  // c'est-à-dire celui dans lequel les modules ont été écrits. Une liste en dur ne l'aurait jamais
  // attrapé — elle décrivait le défaut.
  const rang = { danger: 0, warn: 1, info: 2 };
  todo.forEach((x, i) => {
    if (!i) return;
    assert.ok(rang[todo[i - 1].level] <= rang[x.level],
      `« ${todo[i - 1].label} » (${todo[i - 1].level}) passe avant « ${x.label} » (${x.level}) : la liste doit aller du plus urgent au moins urgent`);
  });
  // Le tri est STABLE : à urgence égale, l'ordre thématique du code est conservé (il est lisible).
  const warns = todo.filter(x => x.level === 'warn').map(x => x.id);
  assert.deepStrictEqual(warns, ['cloture', 'contrats', 'devis-acceptes', 'devis-expires', 'attestations'],
    'à urgence égale, l\'ordre du code doit être conservé');
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
    assert.ok(a.id && a.label, a.id);
    assert.ok(Array.isArray(a.catalog), a.id);
    // 7.22.0 : le métier ne porte PLUS de taux de TVA. Deviner la TVA à partir de l'activité se
    // trompait dans les deux sens (un kiné au réel en facture, un informaticien au forfaitaire
    // n'en facture pas) et l'erreur s'imprimait sur une pièce officielle. C'est le RÉGIME qui
    // décide. On vérifie l'ABSENCE du champ : c'est ce qui empêche de le réintroduire.
    assert.ok(!('vat' in a), `le métier « ${a.id} » porte encore un taux de TVA : c'est le régime qui décide`);
    a.catalog.forEach(([label, , price, unit]) => { assert.ok(label && unit, a.id); assert.ok(price >= 0); });
  });
  assert.ok(core.ACTIVITIES.some(a => a.id === 'autre' && !a.catalog.length));
  // Quinze métiers, plus « Autre activité ». Six ne couvraient ni la restauration, ni le transport,
  // ni les professions libérales — c'est-à-dire l'essentiel du tissu de petites entreprises.
  const metiers = core.ACTIVITIES.filter(a => a.id !== 'autre');
  assert.strictEqual(metiers.length, 15, `${metiers.length} métiers proposés au lieu de quinze`);
  assert.strictEqual(new Set(core.ACTIVITIES.map(a => a.id)).size, core.ACTIVITIES.length, 'deux métiers portent le même identifiant');
  // Les professions libérales facturent une note d'honoraires ; les métiers encaissés sur place
  // ne se voient pas réclamer un RIB. Au moins un de chaque, sinon les deux règles sont mortes.
  assert.ok(metiers.some(a => a.honoraires), 'aucune profession libérale : « note d\'honoraires » ne servirait jamais');
  assert.ok(metiers.some(a => a.comptant), 'aucun métier encaissé sur place : le RIB conditionnel ne servirait jamais');
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
  // Depuis la 7.31.0 les pages sont de VRAIES pages : quand il y en a plusieurs, on les compte.
  const pagine = n => ({ querySelectorAll: () => ({ length: n }), querySelector: () => null, createElement: () => ({ style: {}, offsetHeight: 1120, remove() {} }) });
  assert.strictEqual(core.pageCount(pagine(3)), 3);
  assert.strictEqual(core.pageCount(pagine(1)), 1);
});

t('document long : le gabarit porte de quoi se découper en vraies pages', () => {
  const html = core.documentHtml(inv(), { name: 'C' }, CO);
  // paginate clone le pied page par page et écrit le numéro dans son côté droit : sans cette classe,
  // aucune page ne serait numérotée et le bandeau de continuation n'aurait rien à recopier.
  assert.ok(html.includes('<div class="f-right">'), 'le pied doit porter .f-right');
  // Sans cette règle, les pages fabriquées s'imprimeraient toutes sur la même feuille.
  assert.ok(/\.page \+ \.page \{\s*break-before: page;/.test(html), 'il manque le saut de page entre deux pages');
  ['.cont {', '.page.suite .inner', '.page.dense .hero'].forEach(s =>
    assert.ok(html.includes(s), 'il manque ' + s));
});

t('document long : les notes se découpent ligne par ligne, et restent échappées', () => {
  const html = core.documentHtml({ ...inv(), notes: 'Première ligne\n<img src=x onerror=alert(1)>' }, { name: 'C' }, CO);
  // Une note d'un seul tenant est plus haute qu'une page : paginate renoncerait à toute la mise en
  // page. Découpée, elle se répartit — mais chaque ligne doit rester échappée, une par une.
  assert.ok(html.includes('<div class="n-l">Première ligne</div>'), 'les notes ne sont pas découpées');
  assert.ok(!html.includes('<img src=x'), 'une note passe en HTML brut');
  assert.ok(html.includes('&lt;img src=x'));
});

t('mise en page : fitToPage et paginate tournent SEULES (main.js les sérialise)', () => {
  // main.js envoie ces deux fonctions telles quelles dans la fenêtre PDF. Un appel à une autre
  // fonction de core.js y lèverait une ReferenceError, et le PDF sortirait sans mise en page — sans
  // rien dans aucune console. C'est le défaut de la 6.8.0 (h/esc), transposé au processus principal.
  const autres = Object.keys(core).filter(k => typeof core[k] === 'function' && k !== 'fitToPage' && k !== 'paginate' && k.length > 2);
  [['fitToPage', core.fitToPage], ['paginate', core.paginate]].forEach(([nom, f]) => {
    const code = f.toString().replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(code.includes('querySelector'), nom + ' : le nettoyage a mangé le code');
    autres.forEach(n => assert.ok(!new RegExp('(^|[^.\\w])' + n + '\\s*\\(').test(code),
      nom + ' appelle ' + n + '() : elle ne peut plus être sérialisée'));
  });
  const m = lireSource('src', 'main.js');
  assert.ok(/fitToPage\.toString\(\)/.test(m) && /paginate\.toString\(\)/.test(m),
    'la fenêtre PDF doit exécuter les DEUX');
});

t('mise en page : une seule porte, pour que l\'aperçu ne puisse pas diverger du PDF', () => {
  const app = lireApp();
  const i = app.indexOf('function mettreEnPage(');
  assert.ok(i > 0, 'mettreEnPage a disparu');
  const bloc = app.slice(i, i + 400);
  assert.ok(bloc.includes('C.fitToPage(') && bloc.includes('C.paginate('), 'mettreEnPage doit faire les deux');
  // Un aperçu qui appellerait fitToPage tout seul montrerait l'ancienne mise en page : pied de page
  // en travers des signatures, pas de numéro. Une seule porte, donc un seul appel.
  assert.strictEqual((app.match(/C\.fitToPage\(/g) || []).length, 1, 'fitToPage ne s\'appelle que dans mettreEnPage');
  assert.strictEqual((app.match(/C\.pageCount\(/g) || []).length, 0, 'le nombre de pages vient de paginate');
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
  // La signature est `setPassword(data, password)`. Elle était appelée avec UN objet
  // `{ data, password }` : le second argument valait `undefined`, donc ce test « fichier chiffré et
  // verrouillé » écrivait en fait un fichier EN CLAIR contenant `{data, password}`. Il ne prouvait
  // rien de ce qu'il annonce, et il aurait survécu à n'importe quelle régression du chiffrement.
  assert.deepStrictEqual(s2.setPassword(s2.read(), 'secret123'), { ok: true });
  assert.ok(s2.state.encrypted, 'le mot de passe n\'a pas été appliqué');
  assert.strictEqual(s2.write({ ...s2.read(), clients: [] }).ok, true);
  s2.lock();
  assert.throws(() => s2.write(core.DEFAULT_DATA), /verrouill/i, 'un fichier verrouillé doit refuser d\'être écrit');
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
  assert.ok(html.includes('1 facture en brouillon'), 'ce qui manque figure sur la page de garde, au bon nombre');
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

// ---------- chien de garde (6.5.0) ----------
// Un gel ne laisse aucune trace : ni erreur, ni journal, rien à envoyer. Ce test ne peut pas geler
// une vraie application (c'est le rôle de scratchpad/watchdog-e2e.js), mais il tient les quatre
// invariants sans lesquels le chien de garde se retournerait contre l'application.
t('chien de garde : les quatre règles sans lesquelles il ferait plus de mal que de bien', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const wd = src.slice(src.indexOf('function startWatchdog'), src.indexOf('function createWindow'));
  assert.ok(wd, 'chien de garde introuvable');

  // 1. Le domaine Debugger s'active AVANT le gel : demandé pendant, il attendrait le fil bloqué.
  // On cherche les APPELS, pas les mots : les commentaires parlent des mêmes commandes, dans
  // l'ordre du raisonnement et pas dans celui de l'exécution.
  const enable = wd.indexOf("sendCommand('Debugger.enable'");
  const boucle = wd.indexOf('setInterval');
  assert.ok(enable > 0 && enable < boucle, 'Debugger.enable doit être demandé avant la surveillance');

  // 2. On relâche le débogueur AVANT d'interrompre : terminateExecution sur une VM en pause ne
  //    rend jamais la main, et le chien de garde resterait bloqué à son tour.
  const resume = wd.indexOf("cmd('Debugger.resume')");
  const terminate = wd.indexOf("cmd('Runtime.terminateExecution')");
  assert.ok(resume > 0 && terminate > 0 && resume < terminate,
    'Debugger.resume doit précéder Runtime.terminateExecution');

  // 3. Aucune fenêtre SYNCHRONE : showMessageBoxSync bloque le processus principal tant que
  //    personne ne répond — devant une application figée, personne ne peut répondre.
  assert.ok(!/showMessageBoxSync/.test(wd), 'le chien de garde ne doit jamais ouvrir de fenêtre synchrone');

  // 4. Chaque commande au débogueur est bornée : le surveillant ne doit pas pouvoir geler.
  assert.ok(/Promise\.race/.test(wd), 'les commandes du débogueur doivent être bornées dans le temps');

  // Et côté interface : le battement de cœur et l'annonce d'après-gel sont branchés AVANT la
  // séquence de démarrage, sinon l'assistant de première utilisation les ferait manquer.
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
  const ping = app.indexOf('bridge.onAlivePing()');
  const notice = app.indexOf('bridge.onFreezeNotice');
  const demarrage = app.indexOf('// ---------- démarrage ----------');
  assert.ok(ping > 0 && ping < demarrage, 'le battement de cœur doit être branché avant le démarrage');
  assert.ok(notice > 0 && notice < demarrage, 'l\'annonce d\'après-gel doit être branchée avant le démarrage');
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

t('licence : le garde-fou ne barre que la création, et l\'app livrée embarque la clé qui l\'arme', () => {
  const src = lireApp();
  // Le garde-fou ne doit être posé que sur des créations, jamais sur un export ou une lecture.
  // Depuis la 7.33.0 il prend un second argument (le module fermé par l'offre) : la regex de 6.4.0
  // ne voyait que la forme à un argument, et un appel à deux arguments lui échappait en silence.
  const calls = [...src.matchAll(/licenceBlock\('([^']+)'(?:, '([a-z]+)')?\)/g)];
  assert.ok(calls.length >= 18, 'garde-fou de licence absent des chemins de création : ' + calls.length + ' appels');
  calls.forEach(m => assert.ok(/^(Créer|Émettre|Enregistrer un nouvel|Établir un nouveau)/.test(m[1]),
    'le garde-fou de licence est posé ailleurs que sur une création : ' + m[0]));
  assert.ok(!/licenceBlock\([^)]*[Ee]xport/.test(src), 'un export ne doit jamais dépendre de la licence');
  // Un appel qui ne suivrait ni l'une ni l'autre forme (troisième argument, variable) ne serait pas
  // vérifié : on compte aussi les appels bruts.
  assert.strictEqual((src.match(/licenceBlock\(/g) || []).length, calls.length + 1, 'un appel à licenceBlock échappe au contrôle (la définition mise à part)');
  // Depuis la 8.0.0 la version livrée EMBARQUE la clé publique de l'éditeur : l'application est armée
  // pour tout le monde. C'est une décision du propriétaire (clé créée dans SkanFact et collée le
  // 14/09/2026) — ce test exigeait l'ABSENCE du fichier jusque-là, il a été retourné ce jour-là.
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'build', 'licence-public.json')),
    'build/licence-public.json manque : la 8.0.0 est armée, une version sans clé désarmerait tous les clients');
});

t('8.0.0 : la clé embarquée est une vraie clé publique, l\'éditeur ne s\'achète pas de licence, et le désarmement ne vaut qu\'en développement', () => {
  const crypto = require('crypto');
  const pubPath = path.join(__dirname, '..', 'build', 'licence-public.json');
  const pub = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
  assert.strictEqual(pub.format, lic.FORMAT);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(pub.createdAt) && pub.createdAt <= lic.today(), 'createdAt doit être un jour passé ou présent (c\'est un point de départ d\'essai)');
  assert.strictEqual(crypto.createPublicKey(pub.publicKey).asymmetricKeyType, 'ed25519', 'la clé embarquée doit être une clé publique Ed25519 lisible');
  assert.ok(!/PRIVATE/.test(JSON.stringify(pub)) && !('privateKey' in pub), 'le fichier embarqué ne porte que la clé publique');
  // Une licence signée par N'IMPORTE QUELLE autre clé privée est refusée avec elle : c'est ce qui
  // fait qu'une clé d'essai fabriquée par un test — ou par un curieux — ne vaut rien chez un client.
  const autre = lic.generateKeys();
  assert.strictEqual(lic.verifyKey(lic.signLicence({ nom: 'X', offre: 'entreprise' }, autre.privateKey), pub.publicKey), null,
    'une licence signée par une autre clé privée doit être refusée par la clé embarquée');
  // Une installation qui découvre la clé aujourd'hui a trente jours, quelle que soit son ancienneté.
  const S = o => lic.licenceState({ publicKey: pub.publicKey, ...o });
  assert.strictEqual(S({ installedAt: '2025-01-01', armedAt: '2026-09-14', today: '2026-09-14' }).daysLeft, 30);
  assert.strictEqual(S({ installedAt: '2025-01-01', armedAt: '2026-09-14', today: '2026-10-14' }).state, 'essai', 'le trentième jour est encore un essai');
  assert.strictEqual(S({ installedAt: '2025-01-01', armedAt: '2026-09-14', today: '2026-10-15' }).state, 'finessai');
  // Celui qui signe n'achète pas : le poste dont la clé privée correspond à la clé en vigueur n'a ni
  // essai ni verrou, à n'importe quelle date.
  const ed = S({ installedAt: '2025-01-01', armedAt: '2026-09-14', today: '2030-01-01', editeur: true });
  assert.strictEqual(ed.state, 'editeur'); assert.strictEqual(ed.locked, false); assert.deepStrictEqual(ed.reserves, []);
  // …mais une clé COLLÉE reprend le dessus : c'est ainsi qu'il voit exactement ce que voit un client.
  const mine = lic.generateKeys();
  const indep = lic.signLicence({ nom: 'Moi', offre: 'independant', exp: '2027-01-01' }, mine.privateKey);
  const vu = lic.licenceState({ publicKey: mine.publicKey, key: indep, today: '2026-09-14', editeur: true });
  assert.strictEqual(vu.state, 'active'); assert.ok(vu.reserves.includes('paie'), 'la clé collée l\'emporte sur le passe-droit de l\'éditeur');
  assert.strictEqual(lic.licenceState({ publicKey: mine.publicKey, key: indep, today: '2028-01-01', editeur: true }).state, 'expiree',
    'une clé collée expirée verrouille aussi le poste de l\'éditeur — il la retire pour revenir à son état');
  // Sans clé publique du tout, `editeur` ne fabrique rien : l'état reste « libre ».
  assert.strictEqual(lic.licenceState({ editeur: true }).state, 'libre');
  // Dans main.js : le passe-droit ne vaut que si la clé privée du poste CORRESPOND à la clé EN
  // VIGUEUR (un second éditeur, une clé recréée par erreur : rien), et il est passé à licenceState.
  const main = lireSource('src', 'main.js').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(/editeur: editeurDeLaCleEnVigueur\(\)/.test(main), 'licenceStatus doit passer editeurDeLaCleEnVigueur() à licenceState');
  const cpe = main.slice(main.indexOf('function clePubliqueEditeur('), main.indexOf('function editeurDeLaCleEnVigueur('));
  const edv = main.slice(main.indexOf('function editeurDeLaCleEnVigueur('), main.indexOf('function ecrireLicence('));
  assert.ok(cpe.length > 100 && edv.length > 50 && edv.length < 600, 'tranches clePubliqueEditeur / editeurDeLaCleEnVigueur introuvables');
  // La publique de l'éditeur se DÉDUIT de la privée AVANT toute lecture du fichier public : un
  // fichier licence-publique.json recopié avec la clé de SkanFact, à côté d'un .pem quelconque,
  // donnait le passe-droit (relecture adversariale de la 8.0.0).
  const deduction = cpe.indexOf('crypto.createPublicKey(crypto.createPrivateKey(lirePrivee()))');
  assert.ok(deduction > 0 && (cpe.indexOf('lireJson(') < 0 || cpe.indexOf('lireJson(') > deduction), 'clePubliqueEditeur doit déduire la clé publique de la privée avant de lire le fichier');
  assert.ok(!/return (fichier|lireJson)/.test(cpe), 'clePubliqueEditeur ne doit jamais rendre le contenu du fichier tel quel');
  assert.ok(/clePubliqueEditeur\(\)/.test(edv) && /publicKey\(\)/.test(edv) && !/lireJson/.test(edv), 'editeurDeLaCleEnVigueur compare la clé DÉDUITE à la clé EN VIGUEUR');
  // Le repli GitHub ne garde pas les en-têtes du relais (secret, clé de licence).
  const fg = main.slice(main.indexOf('function feedGithub('), main.indexOf('function feedGithub(') + 400);
  assert.ok(/u\.requestHeaders = null;[\s\S]*u\.setFeedURL/.test(fg), 'feedGithub doit retirer requestHeaders AVANT de changer de flux');
  // « Retirer la clé » retire aussi la clé héritée de la 6.4.0.
  assert.ok(/ecrireLicence\(''\);[^\n]*\n\s*try \{ fs\.unlinkSync\(LIC_ANCIEN\(\)\)/.test(main), 'licence:set(\'\') doit retirer la clé du dossier ET LIC_ANCIEN');
  // L'essai ne se rejoue pas en effaçant app-config.json : la date d'armement est doublée dans le
  // dossier de l'entreprise, la plus ancienne fait foi, et « Retirer la clé » la garde.
  const arm = main.slice(main.indexOf('function armedAt('), main.indexOf('function licenceStatus('));
  assert.ok(/lic\.armedAt < arme\) \{ arme = lic\.armedAt; cfg\.armedAt = arme; writeAppCfg\(cfg\); \}/.test(arm) && /JSON\.stringify\(\{ \.\.\.lic, armedAt: arme \}/.test(arm), 'armedAt doit être doublé dans <dossier>/licence.json, la plus ancienne date faisant foi');
  const ecr = main.slice(main.indexOf('function ecrireLicence('), main.indexOf('function readLicence('));
  assert.ok(/if \(L\.dateValide\(avant\.armedAt\)\) doc\.armedAt = avant\.armedAt;/.test(ecr), 'ecrireLicence doit conserver armedAt du dossier');
  // Le désarmement par l'environnement (SKANFACT_CLE_EMBARQUEE, pour e2e:licence) ne vaut qu'en
  // développement : une application installée lit toujours sa propre clé, quoi que dise l'environnement.
  assert.ok(/!app\.isPackaged && process\.env\.SKANFACT_CLE_EMBARQUEE !== undefined/.test(main), 'SKANFACT_CLE_EMBARQUEE doit être gardé par !app.isPackaged');
  // Le renderer connaît l'état : badge vert ; la porte « Créer mes clés » reste réservée à `libre`.
  const appSrc = lireApp();
  assert.ok(/\|\| st\.state === 'editeur' \? 'accepté'/.test(appSrc), 'le panneau Licence doit afficher l\'état éditeur en vert');
  // Une licence PAYANTE qui finit est annoncée dans la barre (pas seulement l'essai), l'état se
  // relit toutes les heures et au retour au premier plan, et le panneau ne prétend plus que la clé
  // ne part nulle part (elle est présentée au relais de mise à jour).
  assert.ok(/licence\.state === 'active' && licence\.daysLeft <= 14/.test(appSrc), 'licenceBanner doit annoncer une licence active qui se termine');
  assert.ok(/setInterval\(relireLicence, 60 \* 60 \* 1000\)/.test(appSrc) && /addEventListener\('focus', relireLicence\)/.test(appSrc), 'la licence doit se relire toutes les heures et au retour au premier plan');
  assert.ok(!/n'envoie jamais ta clé nulle part/.test(appSrc) && /présentée qu'au service de mise à jour/.test(appSrc), 'le panneau doit dire où la clé est présentée');
  assert.ok(/\(key \? 'Licence enregistrée : ' : 'Clé retirée — '\)/.test(appSrc), 'retirer la clé ne doit pas annoncer « Licence enregistrée »');
  // L'e2e ouvre l'application DÉSARMÉE (override) pour créer ses clés, PUIS la vraie, armée, où sa
  // propre clé d'essai est refusée : les deux moitiés, sinon l'armement n'est prouvé nulle part.
  const e2e = lireSource('test', 'e2e', 'licence.js');
  assert.ok(/SKANFACT_CLE_EMBARQUEE: /.test(e2e), 'e2e:licence doit désarmer l\'application par SKANFACT_CLE_EMBARQUEE');
  // Le second lancement se juge sur son LITTÉRAL : un `env` construit sans l'override (le `delete`
  // qui suit n'est qu'une ceinture, process.env ne porte jamais la variable).
  const lancements = e2e.split('electron.launch(');
  assert.ok(lancements.length >= 3, 'e2e:licence doit ouvrir au moins deux applications');
  assert.ok(/const env2 = \{ \.\.\.process\.env, SKANFACT_DOSSIER_CLES: clesVides \};/.test(e2e) && /env: env2 \}/.test(lancements[2]), 'le second lancement doit être ARMÉ avec la vraie clé (sans SKANFACT_CLE_EMBARQUEE)');
  assert.ok(/imposteur/.test(e2e) && /publicKey: embarquee\.publicKey/.test(e2e), 'e2e:licence doit rejouer le contournement « clé publique recopiée à côté d\'un .pem quelconque »');
});

t('offre Indépendant : chaque module réservé est fermé à la création, partout où l\'on crée', () => {
  const src = lireApp();
  const calls = [...src.matchAll(/licenceBlock\('([^']+)'(?:, '([a-z]+)')?\)/g)];
  const modules = new Set(calls.map(m => m[2]).filter(Boolean));
  // Tout module que licence.js réserve à l'offre Entreprise doit être nommé au moins une fois.
  lic.OFFRES.independant.reserves.forEach(id => assert.ok(modules.has(id), `aucun garde-fou d'offre ne nomme le module « ${id} »`));
  // …et jamais un module qui n'existe pas (une faute de frappe ne bloquerait personne, en silence).
  const connus = new Set(core.MODULES.map(m => m.id).concat(['partage']));
  modules.forEach(id => assert.ok(connus.has(id), `garde-fou d'offre sur un module inconnu : ${id}`));
  // Les points de création, un par un : la porte va DANS le formulaire, sur la branche création,
  // parce que chacun s'ouvre depuis plusieurs pages (règle 7.29.0). Une tranche par fonction.
  const tranche = (debut, fin) => { const a = src.indexOf(debut), b = src.indexOf(fin, a + 1); assert.ok(a >= 0 && b > a, 'tranche introuvable : ' + debut); return src.slice(a, b); };
  const attendus = [
    ['function supplierForm(', 'const supplierState', 'achats', '!supplier &&'],
    ['function duplicatePurchase(', 'function ', 'achats', ''],
    ['function projectForm(', 'routes.marges', 'pilotage', '!proj &&'],
    ['function accountForm(', 'function movementForm(', 'pilotage', '!acc &&'],
    ['function movementForm(', 'routes.tresorerie', 'pilotage', '!mv &&'],
    ['function employeeForm(', 'function payslipForm(', 'paie', '!employee &&'],
    ['function payslipForm(', 'function leaveForm(', 'paie', '!slip &&'],
    ['function leaveForm(', 'function advanceForm(', 'paie', '!leave &&'],
    ['function advanceForm(', 'function hrDocForm(', 'paie', '!advance &&'],
    ['$(\'#p-gen\').onclick', 'confirmDialog', 'paie', ''],
    ['function adjustForm(', 'routes.stock', 'stock', ''],
    ['$(\'#inv-apply\').onclick', 'confirmDialog', 'stock', ''],
    ['function serialIntakeForm(', 'function serialAssignForm(', 'stock', ''],
    ['function assetForm(', 'routes.immos', 'immos', '!asset &&'],
    ['async function partagerDossier(', 'async function rejoindreDossier(', 'partage', '']
  ];
  attendus.forEach(([debut, fin, module, cond]) => {
    const t = tranche(debut, fin);
    const re = new RegExp((cond ? cond.replace(/[!&]/g, '\\$&') + '\\s*' : '') + "licenceBlock\\('[^']+', '" + module + "'\\)");
    assert.ok(re.test(t), `${debut} : pas de garde-fou d'offre « ${module} »${cond ? ' sur la branche création (' + cond + ')' : ''}`);
  });
  // Deux créations avaient échappé au garde-fou de 6.4.0 : la copie d'un achat et « Établir n
  // bulletins ». Les contrôles passent AVANT la grande question (règle 7.6.0).
  const gen = tranche('$(\'#p-gen\').onclick', 'closedBlock');
  assert.ok(gen.indexOf('licenceBlock(') < gen.indexOf('confirmDialog('), '« Établir n bulletins » pose sa question avant le garde-fou');
  const inv = tranche('$(\'#inv-apply\').onclick', 'closedBlock');
  assert.ok(inv.indexOf('licenceBlock(') < inv.indexOf('confirmDialog('), 'l\'inventaire pose sa question avant le garde-fou');
  // La porte lit `licence.reserves` (jamais moduleOn : l'offre ne masque rien) et ne ferme que le
  // module nommé. Statistiques vit dans Pilotage et ne crée rien : elle reste ouverte, sans bandeau.
  const porte = tranche('function licenceBlock(', 'function pageReservee(');
  assert.ok(/licence\.reserves \|\| \[\]\)\.includes\(module\)/.test(porte), 'la porte de l\'offre doit lire licence.reserves');
  assert.ok(!/moduleOn\(/.test(porte), 'l\'offre ne passe pas par moduleOn : elle ne masque rien');
  const res = tranche('function pageReservee(', 'const closedToast');
  assert.ok(/p\.id !== 'stats'/.test(res), 'les Statistiques doivent rester ouvertes (elles ne créent rien)');
  // Le bandeau se pose dans render(), après la route, comme celui des modules.
  const rendu = tranche('function render(keepScroll)', 'function setWindowTitle');
  assert.ok(rendu.indexOf('bandeauOffre(active)') > rendu.indexOf('(routes[name] || routes.dashboard)'), 'bandeauOffre doit suivre la route');
  // Et la barre garde la page, avec un cadenas : on ne masque jamais ce qui existe.
  const barre = tranche('function drawNav(', 'function bandeauModule(');
  assert.ok(/ferme \? CADENAS : ''/.test(barre) && !/pageReservee\(p\) \? '' :/.test(barre), 'un module fermé garde son entrée dans la barre, avec un cadenas');
});

// ---------- les offres (7.33.0) ----------
t('licence : l\'offre voyage dans la clé, le matricule l\'attache, et l\'essai compte depuis l\'armement', () => {
  const k = lic.generateKeys();
  const S = o => lic.licenceState({ publicKey: k.publicKey, installedAt: '2026-01-01', today: '2026-09-14', ...o });

  // L'offre est DANS la clé signée : un client ne peut pas se la changer, et l'application sait
  // quels modules lui sont fermés à la création. Un client Entreprise n'a rien de fermé.
  const indep = lic.signLicence({ nom: 'Trabelsi', matricule: '1234567A/M/P/000', offre: 'independant', exp: '2027-09-14' }, k.privateKey);
  const st = S({ key: indep, matricule: '1234567 A' });
  assert.strictEqual(st.state, 'active');
  assert.strictEqual(st.offre, 'independant');
  assert.deepStrictEqual(st.reserves, ['achats', 'stock', 'immos', 'pilotage', 'paie', 'partage']);
  assert.ok(/Indépendant/.test(st.label), 'l\'écran doit nommer l\'offre : ' + st.label);
  const entr = lic.signLicence({ nom: 'Y', offre: 'entreprise', exp: '2027-09-14' }, k.privateKey);
  assert.deepStrictEqual(S({ key: entr }).reserves, []);
  // Une clé d'avant la 7.33.0 n'a pas d'offre : elle vaut Entreprise. Une offre inconnue aussi —
  // en cas de doute on OUVRE, on ne prend jamais personne en otage.
  const vieille = lic.signLicence({ nom: 'X', exp: '2027-01-01' }, k.privateKey);
  assert.strictEqual(S({ key: vieille }).offre, 'entreprise');
  assert.deepStrictEqual(S({ key: vieille }).reserves, []);
  const inconnue = lic.signLicence({ nom: 'X', offre: 'premium', exp: '2027-01-01' }, k.privateKey);
  assert.strictEqual(S({ key: inconnue }).offre, 'entreprise');
  // Pendant l'essai, tout est ouvert : c'est la seule façon de savoir de quelle offre on a besoin.
  assert.deepStrictEqual(S({ installedAt: '2026-09-01' }).reserves, []);
  // Expirée : `locked` ferme déjà toute création, `reserves` n'a plus de sens.
  assert.deepStrictEqual(S({ key: indep, today: '2030-01-01' }).reserves, []);

  // Le matricule attache la clé à UNE entreprise : émise pour Trabelsi, elle ne s'active pas ailleurs.
  const autre = S({ key: indep, matricule: '7654321B/A/M/000' });
  assert.strictEqual(autre.state, 'autre');
  assert.strictEqual(autre.locked, true);
  assert.ok(/7654321B/.test(autre.detail) && /1234567A/.test(autre.detail), 'le refus nomme les deux matricules');
  // …mais on compare le CŒUR du matricule (sept chiffres + lettre), pas sa ponctuation ni son suffixe,
  // et un côté vide ne compte pas : on ne punit pas qui n'a pas encore rempli sa fiche.
  assert.ok(lic.memeMatricule('1234567A/M/P/000', '1234567-a'));
  assert.ok(lic.memeMatricule('1234567A', ''));
  assert.ok(!lic.memeMatricule('1234567A', '1234567B'));
  assert.strictEqual(S({ key: indep }).state, 'active', 'sans matricule saisi, la clé passe');
  assert.strictEqual(S({ key: vieille, matricule: '1234567A' }).state, 'active', 'une clé sans matricule s\'active partout');

  // L'essai compte à partir du jour où la licence est ARMÉE quand il est postérieur à l'installation.
  // Sans ça, toute installation de plus de trente jours se verrouillerait à la minute de la mise à
  // jour qui arme la licence — c'est-à-dire chez tous ceux qui ont installé l'app avant.
  assert.strictEqual(S({}).state, 'finessai', 'installée en janvier, sans armement : l\'essai est fini');
  assert.strictEqual(S({ armedAt: '2026-09-10' }).state, 'essai');
  assert.strictEqual(S({ armedAt: '2026-09-10' }).daysLeft, 26);
  assert.strictEqual(S({ armedAt: '2025-01-01' }).state, 'finessai', 'un armement ANTÉRIEUR à l\'installation ne rallonge rien');
  assert.strictEqual(S({ armedAt: 'n\'importe quoi' }).state, 'finessai', 'une date illisible est ignorée');

  // Les durées : un mois de licence est un mois du calendrier. « À vie » = pas de date.
  assert.strictEqual(lic.addMonths('2026-09-14', 12), '2027-09-14');
  assert.strictEqual(lic.addMonths('2026-01-31', 1), '2026-02-28', 'le 31 janvier + 1 mois finit en février, pas le 3 mars');
  assert.strictEqual(lic.addMonths('2024-02-29', 12), '2025-02-28');
  assert.strictEqual(lic.expirationPour('2026-09-14', '1a'), '2027-09-14');
  assert.strictEqual(lic.expirationPour('2026-09-14', '3m'), '2026-12-14');
  assert.strictEqual(lic.expirationPour('2026-09-14', 'vie'), '');
  assert.strictEqual(lic.expirationPour('2026-09-14', 'date', '2027-01-01'), '2027-01-01');
  assert.strictEqual(lic.expirationPour('2026-09-14', 'date', '2026-09-14'), null, 'une licence née expirée n\'est pas une licence');
  assert.strictEqual(lic.expirationPour('2026-09-14', 'date', '14/09/2027'), null, 'une date mal écrite est refusée, pas devinée');
  assert.strictEqual(lic.expirationPour('2026-09-14', 'jamais-vu'), null);
  assert.ok(lic.DUREES.some(d => d.id === 'vie') && lic.DUREES.some(d => d.mois === 12));
  assert.strictEqual(S({ key: lic.signLicence({ nom: 'Z', offre: 'independant' }, k.privateKey), today: '2099-01-01' }).state, 'active', 'à vie');

  // Le singulier : « 1 jour restant », jamais « 1 jour(s) ».
  assert.ok(!/\(s\)/.test(S({ installedAt: '2026-08-16' }).label + S({ installedAt: '2026-08-16' }).detail));
  assert.ok(/1 jour restant\b/.test(S({ installedAt: '2026-08-16' }).label), S({ installedAt: '2026-08-16' }).label);
  assert.ok(/0 jours restants/.test(S({ installedAt: '2026-08-15' }).label), 'le dernier jour se lit « 0 jours restants »');
});

t('éditeur : la clé privée ne traverse jamais le pont, et l\'app livrée embarque la clé publique', () => {
  const main = lireSource('src', 'main.js').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  // La tranche part de `clePubliqueEditeur()` — la première lecture de la clé privée (8.0.0 : elle
  // sert aussi au passe-droit de l'éditeur) — passe par `editeurStatus()`, l'objet qui traverse le
  // pont, et va jusqu'à la fin de `licence:emettre`, en passant par tous les handlers de l'éditeur.
  const a = main.indexOf('function clePubliqueEditeur('), b = main.indexOf("ipcMain.handle('licence:emettre'");
  const c = main.indexOf('\n});', b);
  assert.ok(a > 0 && b > a && c > b, 'la section éditeur de main.js est introuvable');
  const section = main.slice(a, c);
  assert.ok(/function editeurStatus\(/.test(section) && /ipcMain\.handle\('editeur:keygen'/.test(section) && /ipcMain\.handle\('editeur:importer'/.test(section), 'la tranche ne couvre pas les handlers de l\'éditeur');
  // La clé privée n'est lue que pour signer, pour en déduire la publique, ou pour la comparer à
  // un fichier repris. Aucun `return` ne la contient. Jugé sur TOUT main.js, pas seulement la
  // tranche : une lecture posée ailleurs (un handler ajouté plus haut) ne doit pas échapper.
  // Chaque occurrence est jugée sur ce qui la SUIT immédiatement : une regex gourmande jusqu'à la
  // fin de la ligne avalait une seconde lecture posée sur la même ligne (prouvé en l'y mettant).
  // Et c'est le CONTEXTE ENTIER de chaque lecture qui est jugé, pas le caractère qui suit : le
  // contradicteur a montré qu'un `String(lirePrivee())` renvoyé passait un contrôle sur le seul « ) ».
  const lectures = [...main.matchAll(/.{0,40}lirePrivee\(\).{0,24}/g)].map(m => m[0]);
  assert.ok(lectures.length >= 3, 'main.js ne lit pas la clé privée ?');
  // Deux tranches serrées — clePubliqueEditeur/editeurDeLaCleEnVigueur, puis les handlers de
  // l'éditeur — et rien entre les deux : une lecture posée dans data:export ou backups:* n'y entre pas.
  const t1 = main.slice(a, main.indexOf('function ecrireLicence('));
  const t2 = main.slice(main.indexOf("ipcMain.handle('editeur:keygen'"), c);
  assert.ok(t1.length > 100 && t2.length > 100 && !/ipcMain\.handle\('(data|backups|dossiers|attach|ocr|pdf):/.test(t1 + t2), 'les tranches éditeur ne doivent contenir aucun handler étranger');
  assert.ok(lectures.every(ctx => t1.includes(ctx) || t2.includes(ctx)), 'une lecture de la clé privée vit hors des tranches éditeur : …' + lectures.find(ctx => !t1.includes(ctx) && !t2.includes(ctx)));
  const AUTORISES = [/L\.signLicence\(payload, lirePrivee\(\)\)/, /crypto\.createPrivateKey\(lirePrivee\(\)\)/, /lirePrivee\(\)\.trim\(\) !== pem\.trim\(\)/];
  lectures.forEach(ctx => assert.ok(AUTORISES.some(re => re.test(ctx)),
    'la clé privée est lue pour autre chose que signer / déduire / comparer : …' + ctx.trim()));
  assert.ok(/L\.signLicence\(payload, lirePrivee\(\)\)/.test(section), 'la signature se fait dans main.js, avec le fichier de clé privée');
  assert.ok(!/return \{[^}]*privateKey/.test(section) && !/privateKey:/.test(section.replace(/publicKey/g, '')), 'un handler renvoie la clé privée');
  // Une clé émise pour une AUTRE entreprise est refusée à l'enregistrement, en nommant les deux.
  assert.ok(/essai\.state === 'autre'/.test(main) && /LICENCE_AUTRE_ENTREPRISE/.test(main), 'licence:set doit refuser la clé d\'une autre entreprise');
  // Le pont expose l'état et la signature, jamais un canal qui rendrait le fichier .pem.
  const preload = lireSource('src', 'preload.js');
  ['licenceEmettre', 'editeurStatus', 'editeurKeygen', 'editeurImporter', 'editeurExporter', 'editeurCopierPublique'].forEach(n =>
    assert.ok(preload.includes(n + ':'), 'le pont n\'expose pas ' + n));
  assert.ok(!/privee|private/i.test(preload.replace(/\/\/.*$/gm, '')), 'le pont ne doit rien exposer qui nomme la clé privée');
  // L'essai compte depuis la date du fichier de clé publique, et le matricule voyage avec la demande.
  assert.ok(/armedAt: armedAt\(\)/.test(main) && /matricule: matricule \|\| ''/.test(main), 'licenceStatus doit passer armedAt et le matricule');
  // Et le paquet EMBARQUE la clé publique : `build/` n'était pas dans les fichiers d'electron-builder,
  // donc l'app installée restait libre quoi qu'on commite. Un glob : son absence ne casse rien.
  const pkg = JSON.parse(lireSource('package.json'));
  assert.ok(pkg.build.files.some(f => /^build\/licence-public\*?\.json$/.test(f)), 'build/licence-public.json doit figurer dans build.files');
  assert.ok(pkg.build.files.some(f => f.includes('*')), 'le motif doit être un glob : un fichier absent ferait échouer la construction');
});

t('éditeur : le renderer relit la licence avec le matricule, et la page Licences n\'existe que chez lui', () => {
  const app = lireApp();
  // Relue AVANT le premier dessin, avec le matricule de la société ouverte, et à chaque fiche société enregistrée.
  const boot = app.slice(app.indexOf('const loaded = await bridge.loadData()'), app.indexOf('render();', app.indexOf('const loaded = await bridge.loadData()')));
  assert.ok(/await rafraichirLicence\(\)/.test(boot), 'la licence doit être relue (et attendue) avant le premier render');
  assert.ok(!/bridge\.licenceStatus\(\)\.then/.test(app), 'plus de lecture sans matricule au chargement');
  const applique = app.slice(app.indexOf('const applySettings = () => {'), app.indexOf('setGuard({ dirty: () => setDirty'));
  assert.ok(/rafraichirLicence\(\)/.test(applique), 'enregistrer la fiche société doit revérifier la licence (attachée au matricule)');
  assert.ok(/const mf = data \? \(company\(\)\.matricule \|\| ''\) : '';\s*const st = await bridge\.licenceStatus\(mf\)/.test(app), 'le matricule doit voyager avec la demande d\'état');
  assert.ok(/bridge\.licenceSet\(key, company\(\)\.matricule \|\| ''\)/.test(app), 'le matricule doit voyager avec la clé collée');
  // La page Licences : hors menu dans PAGES, ajoutée à la barre SEULEMENT sur le poste de l'éditeur.
  const p = core.PAGES.find(x => x.id === 'licences');
  assert.ok(p && p.horsMenu && p.titre === 'Licences', 'la page licences doit être déclarée hors menu');
  const nav = app.slice(app.indexOf('function drawNav()'), app.indexOf('function bandeauModule('));
  const lien = nav.indexOf('href="#/licences"');
  assert.ok(lien > 0 && nav.lastIndexOf('if (licence.editeur)', lien) > 0, 'le lien Licences doit être sous `if (licence.editeur)`');
  assert.ok(/routes\.licences = \(\) => \{/.test(app) && /const peut = !!licence\.editeur;/.test(app.slice(app.indexOf('routes.licences = '))) && /if \(!peut && !\(data\.licences \|\| \[\]\)\.length\) \{/.test(app), 'la route existe, ne montre l\'état vide que sans clé ET sans historique, et n\'émet que chez l\'éditeur');
  // Le panneau Éditeur n'est posé que chez lui ; la palette et les modèles d'email aussi.
  assert.ok(/\$\{licence\.editeur \? `\$\{panneau\('p-editeur'/.test(app), 'le panneau p-editeur doit être conditionnel');
  assert.ok(/\.\.\.\(licence\.editeur \? \[\['Licences émises'/.test(app), 'l\'entrée de palette « Licences émises » doit être conditionnelle');
  assert.ok(/\.\.\.\(licence\.editeur \? \[\['licence', /.test(app), 'le gabarit d\'email « licence » ne s\'édite que chez l\'éditeur');
  // « À faire » reçoit le drapeau, et la ligne mène à la page.
  assert.ok(/C\.todoList\(data, company\(\), null, \{ copieExterne, editeur: !!licence\.editeur \}\)/.test(app), 'todoList doit recevoir editeur');
  // Émettre = signer dans main.js + un BROUILLON (jamais nextNumber) + l'historique + la page de la facture.
  const form = app.slice(app.indexOf('function licenceForm('), app.indexOf('async function envoyerLicence('));
  assert.ok(/bridge\.licenceEmettre\(\{/.test(form) && !/signLicence/.test(form), 'le formulaire signe par le pont, jamais lui-même');
  assert.ok(/newDocument\('facture'\)/.test(form) && !/nextNumber/.test(form), 'la facture est un brouillon fabriqué par newDocument, sans numéro');
  assert.ok(/data\.licences\.push\(/.test(form) && /data\.documents\.push\(inv\)/.test(form) && /navigate\('#\/doc\/' \+ inv\.id\)/.test(form), 'le geste écrit l\'historique, la facture, et ouvre le brouillon');
  assert.ok(/discountRate: v\.parrain \? /.test(form), 'la remise de parrainage se pose sur la facture (doc.discountRate), pas sur la ligne');
  // Le mail porte la clé, et la facture en PDF passe par le tampon comme tout document.
  const mail = app.slice(app.indexOf('async function envoyerLicence('), app.indexOf('const licState = '));
  assert.ok(/demoBlock\('Envoyer un email'\)/.test(mail), 'le mail de licence prévient depuis l\'exemple, comme les autres envois');
  assert.ok(/cle: lic\.key/.test(mail) && /stampText: stampFor\(inv\)/.test(mail), 'le mail porte la clé et le PDF passe par stampFor');
});

t('éditeur : les données, la fusion, l\'effacement, le gabarit d\'email et « À faire »', () => {
  // La liste naît vide, se migre, se fusionne par identifiant et s\'efface avec le reste.
  assert.deepStrictEqual(core.DEFAULT_DATA.licences, []);
  assert.deepStrictEqual(core.migrateData({ version: 6, company: {}, clients: [], catalog: [], documents: [] }).licences, []);
  assert.deepStrictEqual(core.migrateData({ version: 6, licences: 'abîmé' }).licences, [], 'une liste abîmée est remise à vide');
  assert.ok(core.MERGE_LISTS.includes('licences') && core.LIST_LABELS.licences, 'sans MERGE_LISTS, les licences du poste perdant disparaîtraient en silence à la fusion');
  const licA = { id: 'aaaa1111', nom: 'A', offre: 'independant', exp: '2027-01-01', key: 'SKAN1.a.a' };
  const licB = { id: 'bbbb2222', nom: 'B', offre: 'entreprise', exp: '', key: 'SKAN1.b.b' };
  const mine = { ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), licences: [licA], syncWrittenAt: 100 };
  const theirs = { ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), licences: [licB], syncWrittenAt: 200 };
  assert.deepStrictEqual(core.mergeData(mine, theirs).data.licences.map(l => l.id).sort(), ['aaaa1111', 'bbbb2222']);
  const w = { ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), licences: [licA, licB] };
  core.wipeData(w, { garderSociete: true });
  assert.deepStrictEqual(w.licences, [], '« Tout effacer » emporte aussi les licences émises (une sauvegarde est prise avant)');

  // Le gabarit du mail existe dans les deux langues et porte la clé ; sans lui, emailFor
  // retomberait sur le gabarit de facture et le client recevrait « veuillez trouver ci-joint… ».
  [core.DEFAULT_EMAIL_TEMPLATES, core.DEFAULT_EMAIL_TEMPLATES_EN].forEach(T => {
    assert.ok(T.licence && /\{cle\}/.test(T.licence.body) && /\{offre\}/.test(T.licence.subject), 'gabarit licence incomplet');
    assert.ok(/SKAN1\./.test(T.licence.body), 'le mail dit d\'où commence la clé');
  });
  assert.strictEqual(core.fillTemplate(core.DEFAULT_EMAIL_TEMPLATES.licence.body, { cle: 'SKAN1.x.y', offre: 'Indépendant', fin: ', valable jusqu\'au 14/09/2027', numero: 'FAC-2026-001', societe: 'S' }).includes('SKAN1.x.y'), true);

  // « À faire » : les licences qui finissent dans les 30 jours, chez l\'éditeur seulement.
  const T = '2026-09-14';
  const d = { ...JSON.parse(JSON.stringify(core.DEFAULT_DATA)), licences: [
    { id: 'a', nom: 'A', exp: '2026-10-01' },            // dans 17 jours → à renouveler
    { id: 'b', nom: 'B', exp: '' },                      // à vie
    { id: 'c', nom: 'C', exp: '2026-09-01' },            // expirée
    { id: 'd', nom: 'D', exp: '2027-06-01' },            // active
    { id: 'e', nom: 'E', exp: '2026-09-20', remplaceePar: 'd' }   // déjà renouvelée : ne réclame plus
  ] };
  const rows = core.licenceRows(d, T);
  assert.deepStrictEqual(rows.map(r => r.id + ':' + r.etat), ['e:bientot', 'a:bientot', 'c:expiree', 'd:active', 'b:vie'], 'ce qui presse d\'abord');
  assert.deepStrictEqual(core.licencesExpirant(d, T).map(r => r.id), ['a'], 'une licence déjà renouvelée ne réclame plus');
  const ligne = core.todoList(d, core.DEFAULT_COMPANY, T, { editeur: true }).find(x => x.id === 'licences-expirent');
  assert.ok(ligne && ligne.level === 'warn' && ligne.count === 1 && /1 licence expire dans les 30 jours/.test(ligne.label) && ligne.route === '#/licences', JSON.stringify(ligne));
  assert.strictEqual(core.todoList(d, core.DEFAULT_COMPANY, T).find(x => x.id === 'licences-expirent'), undefined, 'chez un client (pas de clé privée), la ligne n\'existe pas');
  assert.strictEqual(core.todoList(d, core.DEFAULT_COMPANY, T, { editeur: false }).find(x => x.id === 'licences-expirent'), undefined);
  d.licences.push({ id: 'f', nom: 'F', exp: '2026-10-10' });
  assert.ok(/2 licences expirent/.test(core.todoList(d, core.DEFAULT_COMPANY, T, { editeur: true }).find(x => x.id === 'licences-expirent').label));

  // L'outil en ligne de commande écrit aux mêmes emplacements que l'application — et n'arme pas le
  // dépôt en effet de bord (build/licence-public.json se copie à la main, le jour décidé).
  const cli = lireSource('scripts', 'licence.js');
  assert.ok(/SKANFACT_DOSSIER_CLES/.test(cli) && /licence-publique\.json/.test(cli) && /--offre/.test(cli), 'scripts/licence.js doit suivre main.js (dossier de clés, clé publique à côté, offre)');
  assert.ok(!/fs\.writeFileSync\(PUB,/.test(cli), 'le keygen ne doit pas écrire build/licence-public.json : armer est une décision');
});

t('éditeur : ce que la relecture adversariale a trouvé (7.33.0), tenu par des tests', () => {
  const app = lireApp();
  const main = lireSource('src', 'main.js').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  // 1. Une licence EXPIRÉE ne barre pas le partage d'un dossier : partager n'est pas créer une pièce,
  //    c'est mettre ses données à l'abri. Seule l'OFFRE est jugée.
  const partage = app.slice(app.indexOf('async function partagerDossier('), app.indexOf('async function rejoindreDossier('));
  assert.ok(/if \(!licence\.locked && licenceBlock\('[^']+', 'partage'\)\) return;/.test(partage), 'le partage ne doit dépendre que de l\'offre, jamais de licence.locked');
  // 2. La clé vit DANS LE DOSSIER (un ordinateur ouvre plusieurs entreprises), et une clé rangée par
  //    la 6.4.0 au niveau de l'ordinateur n'est reprise que pour le dossier qu'elle concerne.
  assert.ok(/const LIC_FILE = \(\) => path\.join\(currentDossier\(\)\.dir, 'licence\.json'\)/.test(main), 'la clé de licence doit vivre dans le dossier de l\'entreprise');
  assert.ok(/L\.memeMatricule\(p\.matricule, matricule \|\| ''\)/.test(main), 'l\'ancienne clé (6.4.0) ne se reprend que si son matricule correspond');
  // 3. L'essai compte depuis le jour où CE poste a vu une clé publique (armedAt écrit dans
  //    app-config.json), pas seulement depuis la fabrication de la clé.
  assert.ok(/if \(!cfg\.armedAt\) \{ cfg\.armedAt = L\.today\(\); writeAppCfg\(cfg\); \}/.test(main) && /armedAt: armedAt\(\)/.test(main), 'armedAt doit être posé sur le poste à la première clé vue');
  // 4. Un renouvellement part de la fin de la licence précédente quand elle est encore future.
  assert.ok(/const depuis = prec && prec\.exp && prec\.exp > C\.today\(\) \? prec\.exp : ''/.test(app) && /depuis, cabinet:/.test(app), 'licenceForm doit transmettre `depuis` au renouvellement');
  assert.ok(/const depart = L\.dateValide\(p\.depuis\) && p\.depuis > L\.today\(\) \? p\.depuis : L\.today\(\)/.test(main), 'licence:emettre doit partir de `depuis`');
  assert.ok(/bridge\.editeurStatus\(depuis\)/.test(app), 'les durées se relisent à l\'ouverture du formulaire, depuis la bonne date');
  //    …et la remise de parrainage (« première année ») ne se recoche pas toute seule.
  assert.ok(/remise: prec \? 0 : 20/.test(app), 'au renouvellement la remise repart à zéro');
  // 5. Émettre depuis l'exemple prévient ; une facture de licence passe par le garde-fou de création.
  assert.ok(/await demoBlock\('Émettre une licence'\)/.test(app), 'licenceForm doit prévenir depuis le jeu d\'exemple');
  assert.ok(/licenceBlock\('Créer une facture de licence'\)/.test(app), 'la facture de licence passe par licenceBlock');
  // 6. Une licence déjà renouvelée ne se renouvelle pas deux fois.
  assert.ok(/peut && !r\.remplaceePar \? \{ icon: 'contrat', label: 'Renouveler'/.test(app), '« Renouveler » ne s\'offre pas sur une licence déjà renouvelée');
  // 7. Le mail n'annonce la facture jointe que si elle part vraiment, et l'historique de la facture aussi.
  assert.ok(/facture: phraseFacture/.test(app) && /if \(attachment && inv\) \{ inv\.emails/.test(app), 'la phrase « facture jointe » et la trace ne valent qu\'avec la pièce');
  assert.ok(/\{facture\}/.test(core.DEFAULT_EMAIL_TEMPLATES.licence.body) && /\{facture\}/.test(core.DEFAULT_EMAIL_TEMPLATES_EN.licence.body), 'le gabarit porte {facture}, pas une phrase inconditionnelle');
  // 8. Cmd+K ne propose pas le panneau Éditeur à un client ; la porte « Créer mes clés » n'existe que
  //    tant que l'application n'est pas armée ; Paramètres enregistre avant d'agir.
  assert.ok(/filter\(id => !SETTINGS_PANNEAUX\[id\]\.visible \|\| SETTINGS_PANNEAUX\[id\]\.visible\(\)\)/.test(app), 'la palette doit taire un panneau non visible');
  assert.ok(/visible: \(\) => !!licence\.editeur/.test(app), 'p-editeur doit déclarer sa visibilité');
  assert.ok(/if \(!licence\.editeur && licence\.state === 'libre'\) el\.innerHTML \+= /.test(app), '« Créer mes clés » n\'existe que sur une application non armée');
  const cle = app.slice(app.indexOf('const setKey = async (key) => {'), app.indexOf("if ($('#lic-save'))"));
  assert.ok(/enregistrerEnCours\(\);/.test(cle), '« Enregistrer la clé » compare au matricule du formulaire (enregistré d\'abord)');
  assert.ok(/async function devenirEditeur\(\) \{\s*enregistrerEnCours\(\);/.test(app), 'devenirEditeur enregistre les Paramètres avant de redessiner');
  assert.ok(/if \(saisie && saisie !== \(st\.key \|\| ''\)/.test(app), 'une clé collée survit au redessin du panneau');
  // 9. Le stock de départ d'un article est un mouvement de stock : garde-fou d'offre.
  assert.ok(/licenceBlock\('Créer un stock de départ', 'stock'\)/.test(app), 'le stock de départ du catalogue doit passer par le garde-fou');
  // 10. Un matricule changé par un remplacement de données (import, restauration, exemple) se revoit.
  assert.ok(/\(company\(\)\.matricule \|\| ''\) !== licenceMatriculeVu/.test(app.slice(app.indexOf('function render(keepScroll)'))), 'render() doit relire la licence quand le matricule change');
  // 11. Le libellé d'un module fermé ne cite pas les Statistiques ; le retour depuis une facture de
  //     licence nomme la page ; la facture dit quelle licence elle porte.
  assert.ok(/pilotage: 'Trésorerie et marges'/.test(app), 'le module Pilotage fermé se nomme sans les Statistiques');
  assert.ok(/licences: 'Licences'/.test(app.slice(app.indexOf('const PAGE_LABELS'), app.indexOf('const PAGE_LABELS') + 2000)), 'PAGE_LABELS doit connaître la page Licences');
  const hist = core.documentHistory({ id: 'i', type: 'facture', date: '2026-09-14', licenceId: 'abcd1234', lines: [] }, { ...core.DEFAULT_DATA, licences: [{ id: 'abcd1234', offre: 'independant', exp: '2027-09-14' }] }, core.DEFAULT_COMPANY);
  assert.ok(hist.some(e => e.kind === 'licence' && /abcd1234/.test(e.label) && /Indépendant/.test(e.detail)), 'la facture doit dire quelle licence elle porte');
  // 12. Le harnais e2e isole les clés : aucun parcours ne tourne sur le vrai ~/.skanfact.
  assert.ok(/process\.env\.SKANFACT_DOSSIER_CLES = /.test(lireSource('test', 'e2e', 'harnais.js')), 'le harnais doit poser SKANFACT_DOSSIER_CLES');
  // 13. Le matricule se compare sur ses sept chiffres et sa lettre, quelle que soit l'écriture ; et une
  //     date impossible (30 février) est refusée au lieu de rouler au 2 mars.
  assert.ok(lic.memeMatricule('MF 1234567A/M/000', '1234567/A/M/000'), '« MF 1234567A » et « 1234567/A » sont la même entreprise');
  assert.ok(lic.memeMatricule('MF: 1234567A', '1234567A/M/P/000'));
  assert.ok(lic.memeMatricule('1234567/M/000', '1234567B'), 'une lettre absente d\'un côté ne compte pas');
  assert.ok(!lic.memeMatricule('1234567A', '1234567B'), 'même chiffres, autre lettre : deux entreprises');
  assert.ok(!lic.memeMatricule('1234567A', '7654321A'));
  assert.deepStrictEqual(lic.normMatricule('mf 1234567 a / m / 000'), { chiffres: '1234567', lettre: 'A' });
  assert.strictEqual(lic.normMatricule(''), null);
  assert.strictEqual(lic.dateValide('2027-02-30'), false);
  assert.strictEqual(lic.dateValide('2028-02-29'), true);
  assert.strictEqual(lic.expirationPour('2026-09-14', 'date', '2027-02-30'), null, 'un 30 février n\'est pas une date de fin');
  // 14. Trois états dans le panneau de l'éditeur : armée avec cette clé, pas armée, armée avec une autre.
  assert.ok(/const etat = editeur\.correspond \? 'ok' : editeur\.armee \? 'autre' : 'attente'/.test(app), 'le panneau Éditeur doit distinguer « armée avec une AUTRE clé »');
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

// « 7 pièces vérifiées, intactes » est la seule affirmation rigoureuse de l'app cabinet. Elle doit
// compter juste : ni le manifeste (il ne peut pas porter sa propre empreinte), ni un fichier absent.
t('cabinet : le compte des pièces vérifiées est exact, et un fichier modifié se voit', () => {
  const man = {
    fichiers: [
      { chemin: 'manifeste.json', empreinte: '' },     // présent dans certains paquets : à ignorer
      { chemin: '00-page-de-garde.pdf', empreinte: 'aaa' },
      { chemin: 'journaux/ventes.csv', empreinte: 'bbb' },
      { chemin: 'ventes/FAC-1.pdf', empreinte: 'ccc' }
    ]
  };
  const tout = cab.checkIntegrity(man, { '00-page-de-garde.pdf': 'aaa', 'journaux/ventes.csv': 'bbb', 'ventes/FAC-1.pdf': 'ccc' });
  assert.strictEqual(tout.checked, 3, 'trois fichiers vérifiés, pas deux ni quatre');
  assert.deepStrictEqual(tout.bad, []);
  assert.strictEqual(tout.ok, true);

  const modifie = cab.checkIntegrity(man, { '00-page-de-garde.pdf': 'aaa', 'journaux/ventes.csv': 'AUTRE', 'ventes/FAC-1.pdf': 'ccc' });
  assert.strictEqual(modifie.checked, 3, 'un fichier modifié a bien été vérifié');
  assert.deepStrictEqual(modifie.bad, ['journaux/ventes.csv (modifié)']);
  assert.strictEqual(modifie.ok, false);

  const manquant = cab.checkIntegrity(man, { '00-page-de-garde.pdf': 'aaa' });
  assert.strictEqual(manquant.checked, 1, 'un fichier absent n\'est pas un fichier vérifié');
  assert.deepStrictEqual(manquant.bad, ['journaux/ventes.csv (absent)', 'ventes/FAC-1.pdf (absent)']);

  // Et dans l'AUTRE sens : un fichier présent que le manifeste n'annonce pas. Il était invisible —
  // « 3 pièces vérifiées, intactes » pour un paquet qui en contenait cinq, les deux autres listées,
  // cliquables, et contrôlées par personne. Un intrus n'est pas une pièce vérifiée.
  const enTrop = cab.checkIntegrity(man, {
    'manifeste.json': 'peu importe', '00-page-de-garde.pdf': 'aaa', 'journaux/ventes.csv': 'bbb',
    'ventes/FAC-1.pdf': 'ccc', 'z-bonus/facture.pdf.command': 'xxx', 'lisez-moi.exe': 'yyy'
  });
  assert.strictEqual(enTrop.checked, 3, 'un intrus ne gonfle pas le compte des pièces vérifiées');
  assert.deepStrictEqual(enTrop.bad, [], 'un intrus n\'est pas une empreinte fausse : il se dit à part');
  assert.deepStrictEqual(enTrop.intrus, ['lisez-moi.exe', 'z-bonus/facture.pdf.command']);
  assert.strictEqual(enTrop.ok, false, 'un paquet qui contient autre chose que ce qu\'il annonce n\'est pas conforme');
  // Le manifeste ne se liste pas lui-même : il est attendu, jamais intrus.
  assert.ok(!enTrop.intrus.includes('manifeste.json'));

  // Un manifeste sans liste de fichiers ne doit pas faire croire à une vérification.
  assert.deepStrictEqual(cab.checkIntegrity({}, {}), { checked: 0, bad: [], intrus: [], ok: true });
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
  // La règle vaut pour TOUT ce qu'on livre, pas seulement pour le jeu de démonstration : elle était
  // encore écrite dans la bannière de l'installeur Windows, que Skander montre à qui l'installe.
  ['Installer SkanFact.command', 'Installer SkanFact (Windows).bat', 'README.md'].forEach(f => {
    const texte = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!/SKANCYBER/i.test(texte) && !/1998268D/.test(texte), `${f} porte encore le nom d'une autre entreprise`);
  });
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
// audit I2 : ce test ne pouvait pas échouer. Il changeait cinq fuseaux puis appelait trois
// fonctions d'arithmétique de CHAÎNES, dont aucune ne construit un `Date` : vrai par construction.
// La seule fonction de cabcore qui lit l'horloge, `today()`, n'y figurait pas et n'était appelée
// par AUCUN test — tous passent une date de référence, alors que l'interface, elle, appelle
// toujours sans. C'est la configuration exacte de la panne 5.2.3 (machine en UTC, utilisateur à
// Tunis) : le jour où quelqu'un « harmonise » today() en toISOString().slice(0,10), tout reste
// vert et le 1er octobre à 00 h 30 l'application croit qu'on est le 30 septembre.
t('cabinet : l\'arithmétique des mois donne le même résultat sous tous les fuseaux', () => {
  const tzBefore = process.env.TZ;
  try {
    for (const tz of ['Africa/Tunis', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Kathmandu']) {
      process.env.TZ = tz;
      assert.strictEqual(cab.addMonth('2026-12', 1), '2027-01', tz);
      assert.strictEqual(cab.addMonth('2026-01', -1), '2025-12', tz);
      assert.deepStrictEqual(cab.monthsBetween('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02'], tz);
      assert.ok(cab.monthsBetween('1900-01', '2200-01').length <= 240, tz + ' : borné, jamais infini');
      assert.strictEqual(cab.monthLabel('2026-08'), 'août 2026', tz);

      // today() rend le jour LOCAL, pas un instant UTC découpé. C'est le calendrier de
      // l'utilisateur qui fait foi : à Tunis, à minuit passé, on est déjà demain.
      const maintenant = new Date();
      const attendu = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-${String(maintenant.getDate()).padStart(2, '0')}`;
      assert.strictEqual(cab.today(), attendu, tz + ' : today() ne suit pas le calendrier local');
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(cab.today()), tz + ' : today() n\'est pas un jour du calendrier');

      // Et les fonctions que l'interface appelle SANS date de référence doivent marcher : c'est
      // par là que passe le vrai code, et c'est la seule façon d'atteindre today().
      const S = cab.migrate({ dossiers: cab.demoDossiers(), settings: { relanceDay: 10 } });
      assert.ok(Array.isArray(cab.dossierList(S)), tz + ' : dossierList() sans date');
      const mois = cab.dossierMonths(S.dossiers[0]);
      assert.ok(mois.length && mois.length <= 61, tz + ' : dossierMonths() sans date donne ' + mois.length + ' mois');
      const rel = cab.relanceDue(S);
      assert.strictEqual(rel.jour, Number(cab.today().slice(8, 10)), tz + ' : relanceDue() sans date');
      assert.ok(Array.isArray(cab.echeances(S)), tz + ' : echeances() sans date');
      assert.ok(Array.isArray(cab.cabinetTodo(S)), tz + ' : cabinetTodo() sans date');
      // Aucun mois attendu ne doit être dans le futur, quel que soit le fuseau : c'est ce qui
      // faisait voir quatre cartes rouges sur cinq à un cabinet parfaitement à jour (B1).
      const moisCourant = cab.today().slice(0, 7);
      mois.forEach(m => assert.ok(m.month < moisCourant || m.state === 'ok' || m.state === 'provisoire',
        tz + ' : le mois ' + m.month + ' est réclamé alors qu\'il n\'est pas fini'));
    }
  } finally { if (tzBefore === undefined) delete process.env.TZ; else process.env.TZ = tzBefore; }
});

// La clé privée du cabinet ouvre toutes les comptabilités de ses clients. Elle ne doit jamais
// traverser le pont vers l'interface : de là, elle finirait dans une capture d'écran ou un journal.
// Deux applications dans une même release GitHub se partagent un espace de noms. Le fichier de
// mise à jour porte un nom FIXE (`latest.yml`) : si le cabinet publiait sur le même canal, il
// écraserait celui de l'app entreprise, et chaque application proposerait à ses utilisateurs la
// version de l'autre. Rien ne planterait — les gens installeraient simplement le mauvais logiciel.
t('cabinet : son canal de mise à jour ne peut pas écraser celui de l\'app entreprise', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const cfg = require('../build/cabinet.config.js');

  assert.ok(cfg.publish && cfg.publish.channel, 'le cabinet doit publier sur un canal nommé');
  assert.notStrictEqual(cfg.publish.channel, 'latest', 'le canal « latest » est celui de l\'app entreprise');
  assert.strictEqual(cfg.publish.provider, 'github');
  assert.strictEqual(cfg.publish.repo, pkg.build.publish.repo, 'les deux applications publient dans le même dépôt');

  // Même version des deux côtés : c'est ce qui les met dans la même release, donc dans la même
  // page de téléchargement, et ce qui permet de comparer deux installations d'un coup d'œil.
  assert.strictEqual(cfg.extraMetadata.version, pkg.version, 'les deux applications doivent porter la même version');
  assert.ok(!('cabinetVersion' in pkg), 'cabinetVersion n\'a plus lieu d\'être');

  // Sur macOS, electron-updater télécharge le .zip, pas le .dmg : sans lui, aucune mise à jour.
  const cibles = cfg.mac.target.map(t => t.target);
  assert.ok(cibles.includes('zip'), 'le .zip mac est ce qu\'electron-updater télécharge');
  assert.ok(cibles.includes('dmg'), 'le .dmg reste nécessaire à la première installation');

  // Et l'application doit demander CE canal, sinon elle recevrait les versions de l'app entreprise.
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'main.js'), 'utf8');
  assert.ok(new RegExp(`UPDATE_CHANNEL = '${cfg.publish.channel}'`).test(src), 'le canal de l\'app et celui du paquet doivent être le même');
  assert.ok(/autoUpdater\.channel = UPDATE_CHANNEL/.test(src));
  // macOS n'est pas signé : Squirrel ne peut pas installer, c'est mac-update.sh qui remplace l'app.
  assert.ok(/MAC_SIGNED = false/.test(src) && /mac-update\.sh/.test(src));
  const sh = fs.readFileSync(path.join(__dirname, '..', 'src', 'mac-update.sh'), 'utf8');
  assert.ok(/BIN="\$\{6:-SkanFact\}"/.test(sh), 'le script doit accepter le nom du binaire : il sert aux deux applications');
  assert.ok(/MacOS\/\$BIN/.test(sh), 'et le vérifier avec ce nom, pas avec « SkanFact » en dur');
});

t('cabinet : la clé privée ne traverse jamais le pont vers l\'interface', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'main.js'), 'utf8');

  // audit I3 : ce test contenait `assert.ok(handlers.length >= 0)` — toujours vrai. Et la
  // vérification part d'un découpage sur `ipcMain.handle(` : le jour où ce motif ne correspond plus
  // (renommage, handleOnce, découpage en modules — ce qui vient d'arriver avec cabstore.js), le
  // tableau est vide, la boucle ne s'exécute pas, et le test annonce « ok » sans avoir lu un seul
  // handler. C'est le test censé garantir la promesse centrale faite au comptable.
  const blocs = src.split(/ipcMain\.handle\(/).slice(1);
  assert.ok(blocs.length >= 25,
    `plus aucun handler reconnu (${blocs.length}) : le garde-fou ne garde plus rien`);
  blocs.forEach(block => {
    const name = (block.match(/^'([^']+)'/) || [])[1] || '?';
    assert.ok(!/return\s+state\b/.test(block), `le handler ${name} renvoie l'état brut`);
  });

  // Et on exécute vraiment safeState au lieu de croire une expression régulière : celle-ci
  // acceptait un `delete` situé n'importe où dans les 800 lignes suivantes.
  const corps = (src.match(/function safeState\(\)\s*\{[\s\S]*?\n\}/) || [])[0];
  assert.ok(corps, 'safeState() est introuvable dans main.js');
  const faux = {
    cabinet: { name: 'Cabinet Essai', email: 'c@example.tn', publicKey: 'PUB', privateKey: 'SECRET-A-NE-JAMAIS-SORTIR' },
    dossiers: [{ id: 'MF:1', name: 'Client', packs: [] }], settings: { relanceDay: 10 }
  };
  // Le corps référence `state` et `Z.keyFingerprint` : on les fournit, et rien d'autre.
  const faireSafeState = new Function('state', 'Z', corps + '; return safeState();');
  const sorti = faireSafeState(faux, { keyFingerprint: k => 'EMPREINTE-DE-' + k });
  const texte = JSON.stringify(sorti);
  assert.ok(!/SECRET-A-NE-JAMAIS-SORTIR/.test(texte), 'safeState laisse passer la clé privée');
  assert.ok(!('privateKey' in (sorti.cabinet || {})), 'la clé privée est encore là, même vide');
  assert.strictEqual(sorti.cabinet.fingerprint, 'EMPREINTE-DE-PUB', 'l\'empreinte doit être calculée, pas recopiée');
  assert.strictEqual(sorti.cabinet.name, 'Cabinet Essai', 'safeState ne doit pas vider le reste');
  assert.strictEqual(faux.cabinet.privateKey, 'SECRET-A-NE-JAMAIS-SORTIR', 'safeState a muté l\'état d\'origine');
  // L'interface ne reçoit aucun moyen de demander la clé.
  const preRaw = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'preload.js'), 'utf8');
  // On juge le CODE, pas les commentaires : un commentaire qui explique la règle en la citant
  // faisait échouer le test qui la fait respecter. Le garde-fou doit viser ce qui s'exécute.
  const pre = preRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/privateKey/.test(pre), 'le préchargement ne parle pas de clé privée');
  // Et elle n'écrit jamais chez un client : aucune fonction d'export de données vers l'entreprise.
  assert.ok(!/data:save|pack:build/.test(pre), 'l\'app cabinet ne doit rien pouvoir écrire chez un client');
  // Le garde-fou lui-même doit rester efficace : la version sans commentaires contient bien le code.
  assert.ok(/contextBridge\.exposeInMainWorld/.test(pre), 'le nettoyage des commentaires a mangé le code');
});

// ---------- cabinet 2.0.0 : le portefeuille, les relances, les filets ----------

t('cabinet : un dossier se crée à la main, et le premier paquet l\'adopte', () => {
  const S = cab.migrate({});
  // Un cabinet a soixante clients dont deux sous SkanFact. Sans création manuelle, l'application
  // ne montre que ces deux-là et ne sert à rien tant que tout le monde n'a pas migré.
  const d = cab.newDossier({ name: 'Menuiserie Trabelsi SUARL', matricule: '1122334A/M/P/000', phone: '+216 22 333 444' });
  S.dossiers.push(d);
  assert.strictEqual(d.manual, true);
  assert.strictEqual(cab.dossierRow(d, '2026-09-12').level, 'hors', 'un client hors SkanFact n\'est ni à jour ni en retard');
  assert.strictEqual(cab.dossierMonths(d, '2026-09-12').length, 0, 'on ne réclame rien à qui n\'a pas l\'application');
  assert.strictEqual(cab.relanceRows(S, '2026-09-12').length, 0);

  // L'identifiant suit la MÊME règle que celle des paquets : le premier envoi tombe dans CE
  // dossier-ci au lieu d'en créer un second.
  const manifest = { entreprise: { nom: 'Menuiserie Trabelsi SUARL', matricule: '1122334A/M/P/000' }, periode: { mois: '2026-08' }, fichiers: [], definitif: true };
  assert.strictEqual(cab.dossierKey(manifest), d.id, 'la clé d\'un dossier créé à la main doit être celle des paquets');
  const r = cab.filePack(S, manifest, { receivedAt: 1, path: '/x' });
  assert.strictEqual(S.dossiers.length, 1, 'le paquet ne doit pas créer un doublon');
  assert.strictEqual(r.created, false);
  assert.strictEqual(r.adopted, true, 'le passage à SkanFact est une bonne nouvelle : elle se dit');
  assert.strictEqual(S.dossiers[0].manual, false);
  assert.strictEqual(S.dossiers[0].phone, '+216 22 333 444', 'la fiche saisie à la main survit au premier paquet');
});

t('cabinet : une liste de clients se colle depuis un tableur', () => {
  // Un cabinet a soixante clients. Les saisir un par un dans un formulaire, personne ne le fera —
  // et l'application resterait vide le jour de la démonstration, c'est-à-dire au moment précis où
  // elle doit convaincre.
  const r = cab.parseDossierLines(
    'Nom ; Matricule ; Email ; Téléphone\n' +                       // entête collée avec le tableau
    'Menuiserie Trabelsi SUARL ; 1122334A/M/P/000 ; contact@trabelsi.tn ; +216 22 333 444\n' +
    '\n' +                                                           // ligne vide
    'Pharmacie El Menzah\n' +                                        // le nom suffit
    'Café des Jasmins ; ; jasmins@example.tn\n' +                     // colonne vide au milieu
    'Studio Sfax\t3344556C/N/M/000\thello@sfax.tn', []);              // tabulations (copie d'Excel)
  assert.strictEqual(r.dossiers.length, 4);
  assert.deepStrictEqual(r.dossiers.map(d => d.name),
    ['Menuiserie Trabelsi SUARL', 'Pharmacie El Menzah', 'Café des Jasmins', 'Studio Sfax']);
  assert.strictEqual(r.dossiers[0].phone, '+216 22 333 444');
  assert.strictEqual(r.dossiers[0].matricule, '1122334A/M/P/000');
  assert.strictEqual(r.dossiers[2].email, 'jasmins@example.tn');
  assert.strictEqual(r.dossiers[2].matricule, '', 'un email ne doit jamais finir dans le matricule');
  assert.strictEqual(r.dossiers[3].matricule, '3344556C/N/M/000');
  assert.ok(r.dossiers.every(d => d.manual), 'un client collé n\'utilise pas encore SkanFact');

  // Les doublons sont écartés et NOMMÉS : un import silencieux qui perd la moitié des lignes
  // est pire qu'un import qui échoue.
  const existants = [cab.newDossier({ name: 'Pharmacie El Menzah' })];
  const r2 = cab.parseDossierLines('Pharmacie El Menzah\nNouvelle Société\nPharmacie El Menzah', existants);
  assert.strictEqual(r2.dossiers.length, 1);
  assert.strictEqual(r2.dossiers[0].name, 'Nouvelle Société');
  assert.deepStrictEqual(r2.ignorés, ['Pharmacie El Menzah', 'Pharmacie El Menzah']);
  // Un matricule tunisien écrit en chiffres seuls ressemble à un téléphone : il était déplacé dans
  // la colonne téléphone PUIS effacé — c'est-à-dire l'identifiant du dossier, perdu en silence.
  const r3 = cab.parseDossierLines('Boulangerie Hamdi ; 1234567 ; h@x.tn ; +216 98 111 222', []);
  assert.strictEqual(r3.dossiers[0].matricule, '1234567');
  assert.strictEqual(r3.dossiers[0].phone, '+216 98 111 222');
  assert.strictEqual(r3.dossiers[0].email, 'h@x.tn');
  // Rien à lire ne casse rien.
  assert.strictEqual(cab.parseDossierLines('', []).dossiers.length, 0);
  assert.strictEqual(cab.parseDossierLines(null, null).dossiers.length, 0);
  assert.strictEqual(cab.parseDossierLines('Nom\n', []).dossiers.length, 0, 'une entête seule ne crée pas un client « Nom »');
});

t('cabinet : la date de début de mission réclame les mois d\'avant', () => {
  // Sans elle, l'attente démarre au premier paquet reçu : un client repris en cours d'année n'est
  // jamais réclamé sur ses mois antérieurs, et on s'en aperçoit au bilan.
  const d = cab.migrateDossier({ id: 'MF:X', name: 'Repris', packs: [
    { month: '2026-07', label: 'juillet 2026', definitive: true, missing: [] }
  ] });
  assert.deepStrictEqual(cab.dossierMonths(d, '2026-09-12').map(m => m.month), ['2026-07', '2026-08']);
  d.from = '2026-04';
  assert.deepStrictEqual(cab.dossierMonths(d, '2026-09-12').map(m => m.month),
    ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
  assert.strictEqual(cab.dossierRow(d, '2026-09-12').missingCount, 4);
  // Elle vaut aussi AVANT tout paquet : « je reprends ce client à partir de janvier ».
  const neuf = cab.migrateDossier({ id: 'MF:Y', name: 'Neuf', from: '2026-07', packs: [] });
  assert.deepStrictEqual(cab.dossierMonths(neuf, '2026-09-12').map(m => m.month), ['2026-07', '2026-08']);
  // Un format inventé ne doit pas casser le calcul : il est écarté à la migration.
  assert.strictEqual(cab.migrateDossier({ from: 'janvier' }).from, '');
});

t('cabinet : la pastille et la page Relances comptent la même chose', () => {
  // Avant, la pastille comptait les seuls retardataires pendant que la page en listait trois (elle
  // y ajoutait les provisoires). Deux chiffres pour la même chose font douter de tout le reste.
  const S = cab.migrate({ dossiers: [
    { id: 'a', name: 'En retard', packs: [{ month: '2026-05', definitive: true, missing: [] }] },
    { id: 'b', name: 'Provisoire', packs: [{ month: '2026-08', definitive: false, missing: [] }] },
    { id: 'c', name: 'À jour', packs: [{ month: '2026-08', definitive: true, missing: [] }] }
  ] });
  const rows = cab.relanceRows(S, '2026-09-12');
  assert.deepStrictEqual(rows.map(r => r.name).sort(), ['En retard', 'Provisoire']);
  assert.strictEqual(rows.length, 2);
});

t('cabinet : le jour de relance est enfin vivant, et l\'historique se garde', () => {
  // L'aide promettait « Le 10 : la page Dossiers te dit qui n'a rien envoyé » depuis la 1.0.0, et
  // rien ne l'implémentait ni ne permettait de le régler.
  const S = cab.migrate({ settings: { relanceDay: 10 }, dossiers: [
    { id: 'a', name: 'En retard', packs: [{ month: '2026-05', definitive: true, missing: [] }] }
  ] });
  assert.strictEqual(cab.relanceDue(S, '2026-09-03').due, false, 'le 3, la tournée n\'a pas commencé');
  assert.strictEqual(cab.relanceDue(S, '2026-09-10').due, true);
  assert.strictEqual(cab.relanceDue(S, '2026-09-12').count, 1);
  assert.ok(cab.cabinetTodo(S, '2026-09-12').some(x => x.id === 'jour-de-relance'));
  assert.ok(!cab.cabinetTodo(S, '2026-09-03').some(x => x.id === 'jour-de-relance'));
  // Un réglage aberrant ne doit pas rendre la relance impossible ou permanente.
  assert.strictEqual(cab.migrate({ settings: { relanceDay: 0 } }).settings.relanceDay, 10);
  assert.strictEqual(cab.migrate({ settings: { relanceDay: 99 } }).settings.relanceDay, 10);
  assert.strictEqual(cab.migrate({ settings: { relanceDay: 5 } }).settings.relanceDay, 5);

  // La trace : sans elle, le lundi suivant on ne sait plus qui a été relancé.
  const d = S.dossiers[0];
  cab.noteRelance(d, ['2026-06', '2026-07'], 'tel', 1757000000000, 'promet vendredi');
  const row = cab.dossierRow(d, '2026-09-12');
  assert.strictEqual(row.relanceCount, 1);
  assert.strictEqual(row.lastRelanceVia, 'tel');
  assert.deepStrictEqual(row.lastRelanceMonths, ['2026-06', '2026-07']);
  // L'historique ne gonfle pas indéfiniment.
  for (let i = 0; i < 60; i++) cab.noteRelance(d, [], 'email', 1757000000000 + i);
  assert.strictEqual(d.relances.length, 50);
});

t('cabinet : l\'accusé de réception dit ce qui est arrivé, et ce qui manque', () => {
  // Le client envoie son mois et n'entend plus parler de rien : il ne sait ni si c'est arrivé, ni
  // si c'était lisible, ni s'il manquait quelque chose. Trois lignes valent mieux que trois relances.
  const cabinet = { name: 'Cabinet Ben Salah' };
  const d = cab.migrateDossier({ id: 'a', name: 'Menuiserie', email: 'contact@menuiserie.tn' });
  const complet = cab.accuseMail(cabinet, d, { month: '2026-08', label: 'août 2026', definitive: true, files: 14, missing: [] });
  assert.strictEqual(complet.to, 'contact@menuiserie.tn');
  assert.strictEqual(complet.subject, "Bien reçu : votre dossier d'août 2026", 'élision : « de août » ne s\'écrit pas');
  assert.ok(/14 pièces/.test(complet.body));
  assert.ok(/mois clôturé/.test(complet.body));
  assert.ok(/Rien ne manque/.test(complet.body));
  assert.ok(complet.body.endsWith('Cabinet Ben Salah'));

  // Un paquet provisoire le dit, et un paquet incomplet énumère ce qui manque : c'est là qu'un
  // accusé de réception devient utile au lieu d'être poli.
  const partiel = cab.accuseMail(cabinet, d, {
    month: '2026-09', label: 'septembre 2026', definitive: false, files: 9,
    missing: [{ id: 'justif', label: 'achats sans justificatif joint', count: 6 }, { id: 'brouillon', label: 'factures restées en brouillon', count: 1 }]
  });
  assert.ok(/provisoire/.test(partiel.body));
  assert.ok(/7 éléments/.test(partiel.body), '6 + 1, comptés et pas énumérés à la louche');
  assert.ok(/6 achats sans justificatif joint/.test(partiel.body));
  assert.ok(/1 factures restées en brouillon/.test(partiel.body));
  // Sans email au dossier, le message existe quand même : le comptable tapera l'adresse.
  assert.strictEqual(cab.accuseMail(cabinet, cab.migrateDossier({ name: 'X' }), { month: '2026-08' }).to, '');
});

t('cabinet : le portefeuille se compte, hors SkanFact compris', () => {
  const S = cab.migrate({ dossiers: [
    { id: 'a', name: 'À jour', fees: 250, packs: [{ month: '2026-08', definitive: true, missing: [], figures: { ca: 10000, devise: 'DT' } }] },
    { id: 'b', name: 'En retard', fees: 180, packs: [{ month: '2026-05', definitive: true, missing: [], figures: { ca: 4000, devise: 'DT' } }] },
    { id: 'c', name: 'Pas encore', manual: true, fees: 300, packs: [] },
    { id: 'd', name: 'Parti', archived: true, packs: [] }
  ] });
  const p = cab.portfolio(S, '2026-09-12');
  assert.strictEqual(p.total, 3, 'les archivés ne comptent pas dans le portefeuille actif');
  assert.strictEqual(p.surSkanfact, 2);
  assert.strictEqual(p.horsSkanfact, 1);
  assert.strictEqual(p.aJour, 1);
  assert.strictEqual(p.enRetard, 1);
  assert.strictEqual(p.dernierCA, 14000);
  assert.strictEqual(p.honoraires, 730);
  // « tout est à jour » ne doit jamais s'afficher à un cabinet dont personne n'envoie rien.
  const vide = cab.migrate({ dossiers: [{ id: 'x', name: 'Pas encore', manual: true, packs: [] }] });
  assert.strictEqual(cab.portfolio(vide, '2026-09-12').surSkanfact, 0);
});

t('cabinet : les listes se trient sans jamais perdre de ligne', () => {
  const S = cab.migrate({ dossiers: [
    { id: 'a', name: 'Zeta', phone: '22111222', packs: [{ month: '2026-08', definitive: true, missing: [], receivedAt: 3, figures: { ca: 100, devise: 'DT' } }] },
    { id: 'b', name: 'Alpha', packs: [{ month: '2026-06', definitive: true, missing: [], receivedAt: 1, figures: { ca: 900, devise: 'DT' } }] },
    { id: 'c', name: 'Mu', packs: [{ month: '2026-07', definitive: true, missing: [], receivedAt: 2, figures: { ca: 500, devise: 'DT' } }] }
  ] });
  const noms = o => cab.dossierList(S, '2026-09-12', o).map(r => r.name);
  assert.deepStrictEqual(noms({ sort: 'nom' }), ['Alpha', 'Mu', 'Zeta']);
  assert.deepStrictEqual(noms({ sort: 'nom', desc: true }), ['Zeta', 'Mu', 'Alpha']);
  assert.deepStrictEqual(noms({ sort: 'ca' }), ['Alpha', 'Mu', 'Zeta']);
  assert.deepStrictEqual(noms({ sort: 'dernier' }), ['Zeta', 'Mu', 'Alpha']);
  assert.strictEqual(noms({ sort: 'inconnu' }).length, 3, 'un tri inconnu retombe sur le classement par urgence');
  // La recherche couvre le téléphone : un comptable cherche par ce qu'il a sous la main.
  assert.deepStrictEqual(noms({ q: '22111' }), ['Zeta']);
  // Le tri ne modifie jamais l'état.
  assert.deepStrictEqual(S.dossiers.map(d => d.name), ['Zeta', 'Alpha', 'Mu']);
});

t('cabinet : les échéances savent qui n\'a pas envoyé ses pièces', () => {
  // Une liste de dates, un comptable en a déjà une. Ce que personne d'autre ne fait pour lui :
  // rattacher l'échéance aux paquets qu'il n'a PAS reçus.
  const p = (m, def) => ({ month: m, label: cab.monthLabel(m), definitive: def, missing: [] });
  const S = cab.migrate({ settings: { relanceDay: 10 }, dossiers: [
    { id: 'a', name: 'À jour', tvaPeriod: 'mensuelle', packs: [p('2026-07', true), p('2026-08', true)] },
    { id: 'b', name: 'Rien envoyé', tvaPeriod: 'mensuelle', packs: [p('2026-06', true)] },
    { id: 'c', name: 'Provisoire', tvaPeriod: 'mensuelle', packs: [p('2026-07', true), p('2026-08', false)] },
    { id: 'd', name: 'Trimestriel', tvaPeriod: 'trimestrielle', packs: [p('2026-07', true), p('2026-08', true), p('2026-09', true)] },
    { id: 'e', name: 'Parti', archived: true, tvaPeriod: 'mensuelle', packs: [] },
    // Un client qui n'utilise pas SkanFact n'a rien à envoyer : le calendrier ne doit pas le compter
    // comme un retardataire, sinon il contredit la page Relances un clic plus loin.
    { id: 'f', name: 'Pas encore sur SkanFact', manual: true, tvaPeriod: 'mensuelle', packs: [] }
  ] });
  const liste = cab.echeances(S, '2026-09-20');
  const tvaAout = liste.find(e => e.label === "TVA d'août 2026");
  assert.ok(tvaAout, 'la TVA du mois précédent doit figurer au calendrier');
  assert.strictEqual(tvaAout.date, '2026-09-28', 'la TVA d\'août se dépose le 28 septembre');
  assert.strictEqual(tvaAout.jours, 8);
  assert.strictEqual(tvaAout.clients, 3, 'un archivé ne compte pas, un trimestriel non plus, un hors SkanFact non plus');
  assert.deepStrictEqual(tvaAout.manquants, ['Rien envoyé']);
  assert.deepStrictEqual(tvaAout.provisoires, ['Provisoire']);
  assert.strictEqual(tvaAout.prets, 1);
  assert.strictEqual(tvaAout.level, 'danger', 'une échéance proche avec des pièces manquantes est urgente');

  // Le calendrier ne fabrique QUE des échéances de mois terminés. Un cabinet à jour voyait quatre
  // cartes rouges sur cinq parce qu'on réclamait le mois en cours et les trois suivants.
  assert.ok(!liste.some(e => e.mois.some(m => m >= '2026-09')), 'aucune échéance pour un mois non terminé');

  // Un trimestre : les trois mois comptent, pas seulement le dernier.
  const trim = cab.echeances(S, '2026-10-05').find(e => /3.{0,3} trimestre/.test(e.label) && /TVA/.test(e.label));
  assert.ok(trim, 'la TVA trimestrielle doit apparaître après un mois de fin de trimestre');
  assert.deepStrictEqual(trim.mois, ['2026-07', '2026-08', '2026-09']);
  assert.strictEqual(trim.date, '2026-10-28');

  // Le « début de mission » vaut aussi ici : un client repris en juillet n'est pas en défaut sur juin.
  const repris = cab.migrate({ settings: { relanceDay: 10 }, dossiers: [
    { id: 'r', name: 'Repris', tvaPeriod: 'mensuelle', from: '2026-07', packs: [p('2026-07', true), p('2026-08', true)] }
  ] });
  assert.ok(!cab.echeances(repris, '2026-09-20').some(e => e.label === 'TVA de juin 2026'),
    'le calendrier doit respecter le début de mission, comme la fiche du client');

  // Le jour est réglable, et un réglage aberrant ne fait pas disparaître l'échéance.
  const S2 = cab.migrate({ ...S, settings: { relanceDay: 10, deadlines: { tvaDay: 15 } } });
  assert.strictEqual(cab.echeances(S2, '2026-09-20').find(e => e.label === "TVA d'août 2026").date, '2026-09-15');
  assert.strictEqual(cab.migrate({ settings: { deadlines: { tvaDay: 0 } } }).settings.deadlines.tvaDay, 28);
  assert.strictEqual(cab.migrate({ settings: { deadlines: { tvaDay: 99 } } }).settings.deadlines.tvaDay, 28);
  // Un jour qui n'existe pas dans le mois retombe sur le dernier : une échéance approximative vaut
  // mieux qu'une échéance disparue.
  assert.strictEqual(cab.dayOf('2027-02', 31), '2027-02-28');
  assert.strictEqual(cab.dayOf('2028-02', 31), '2028-02-29');

  // « À faire » remonte l'échéance qui approche avec des pièces manquantes.
  const ligne = cab.cabinetTodo(S, '2026-09-20').find(x => x.id === 'echeance');
  assert.ok(ligne, 'une échéance à huit jours avec un client en défaut doit apparaître dans « À faire »');
  assert.ok(/Rien envoyé/.test(ligne.detail));
  // Un cabinet dont tout le monde a envoyé n'a pas de ligne d'échéance : on ne crie pas pour rien.
  const propre = cab.migrate({ settings: { relanceDay: 10 }, dossiers: [{ id: 'a', name: 'À jour', tvaPeriod: 'mensuelle', packs: [p('2026-07', true), p('2026-08', true)] }] });
  assert.ok(!cab.cabinetTodo(propre, '2026-09-20').some(x => x.id === 'echeance'));
});


t('audit H5 : l\'app gratuite du comptable n\'embarque pas le code de l\'app payante', () => {
  const cfg = require('../build/cabinet.config.js');
  const motifs = cfg.files.map(String);
  assert.ok(!motifs.includes('src/**/*'), 'src/**/* emporte toute la logique de facturation, de paie et de stock');
  assert.ok(motifs.some(m => m.startsWith('src/cabinet/')), 'mais bien tout le code du cabinet');
  // Et ce dont elle a besoin doit y être : on relit ses propres require et les balises de son HTML.
  const lus = ['main.js', 'cabcore.js', 'cabstore.js', 'preload.js']
    .map(f => fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', f), 'utf8')).join('\n')
    + fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'renderer', 'index.html'), 'utf8');
  const besoins = [];
  if (/require\('\.\.\/zip'\)/.test(lus)) besoins.push('src/zip.js');
  if (/mac-update\.sh/.test(lus)) besoins.push('src/mac-update.sh');
  if (/renderer\/style\.css/.test(lus)) besoins.push('src/renderer/style.css');
  // Le menu d'actions partagé (7.29.0). Oublié ici, l'app du cabinet démarre en développement —
  // où le fichier est là — et plante une fois CONSTRUITE, sur un `RowMenu is not defined` qui ne
  // se voit qu'après installation. Exactement le piège de `src/depot.js` en 7.26.0.
  if (/renderer\/rowmenu\.js/.test(lus)) besoins.push('src/renderer/rowmenu.js');
  besoins.forEach(f => assert.ok(motifs.includes(f), `l'app cabinet a besoin de ${f} et il n'est pas livré`));
  // Les fichiers de l'app entreprise qui ne doivent PAS partir.
  ['src/renderer/app.js', 'src/renderer/core.js', 'src/main.js', 'src/storage.js', 'src/licence.js']
    .forEach(f => assert.ok(!motifs.includes(f), `${f} n'a rien à faire dans l'app du comptable`));
});

t('audit G24 : les textes fixes ne parlent pas d\'une seule plateforme', () => {
  // Windows est une cible de construction : l'application parlait de « ce Mac », du « Finder » et de
  // « Time Machine » à un comptable tunisien qui l'aura très probablement installée sur Windows.
  // Les textes qui dépendent vraiment de la plateforme passent par `surMac()` dans app.js ; ceux de
  // l'aide, qui sont fixes, doivent rester neutres.
  const guide = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'renderer', 'cabguide.js'), 'utf8');
  [/\bce Mac\b/, /\bdans le Finder\b/, /\bton Finder\b/].forEach(re => {
    assert.ok(!re.test(guide), `l'aide du cabinet parle encore d'une seule plateforme : ${re}`);
  });
  // « Time Machine » est autorisé s'il est cité à côté de son équivalent Windows.
  if (/Time Machine/.test(guide)) {
    assert.ok(/Historique des fichiers/.test(guide), 'Time Machine doit être cité avec son équivalent Windows');
  }
});

t('audit C4 : une bombe à décompression est refusée au lieu de tuer l\'application', () => {
  // Un ZIP de quelques centaines de kilo-octets peut produire plusieurs gigaoctets. Le paquet vient
  // de l'extérieur, par mail : la mémoire du processus explosait avant qu'aucun contrôle ne
  // s'exécute, et l'application mourait sans un mot.
  const zlib = require('zlib');
  const zip = require('../src/zip.js');
  const gros = Buffer.alloc(600 * 1024 * 1024, 0);                 // > MAX_FICHIER une fois gonflé
  const b = zip.zipBuffer([{ name: 'bombe.bin', data: gros }]);
  assert.ok(b.length < 2 * 1024 * 1024, 'le zip compressé doit rester minuscule : ' + b.length);
  const e = zip.zipRead(b).find(x => x.name === 'bombe.bin');
  // Node arrête l'inflation à la borne posée : l'erreur est nette, la mémoire tient.
  assert.throws(() => e.data(), /anormalement gros|larger than|output length|maxOutputLength/i,
    'la décompression doit échouer proprement, pas remplir la mémoire');
  // Un paquet honnête reste lisible.
  const ok = zip.zipRead(zip.zipBuffer([{ name: 'a.txt', data: Buffer.from('bonjour') }]));
  assert.strictEqual(ok[0].data().toString(), 'bonjour');
});

t('audit C5 : le verdict d\'intégrité est conservé avec le paquet', () => {
  // « 7 pièces vérifiées, intactes » est la seule affirmation rigoureuse de cette application. Elle
  // vivait deux secondes dans une fenêtre : un paquet dont un fichier ne correspondait pas
  // redevenait un mois vert « définitif » dès la fenêtre fermée.
  const S = cab.migrate({});
  const manifest = { entreprise: { nom: 'X', matricule: '1A' }, periode: { mois: '2026-08' }, fichiers: [], definitif: true };
  cab.filePack(S, manifest, { receivedAt: 1, path: '/x', integrity: { checked: 7, bad: [], at: 2 } });
  assert.deepStrictEqual(S.dossiers[0].packs[0].integrity, { checked: 7, bad: [], at: 2 });
  const abime = cab.migrate({});
  cab.filePack(abime, { ...manifest, periode: { mois: '2026-09' } }, { receivedAt: 1, path: '/y', integrity: { checked: 6, bad: ['ventes/FAC-1.pdf (modifié)'], at: 3 } });
  assert.deepStrictEqual(abime.dossiers[0].packs[0].integrity.bad, ['ventes/FAC-1.pdf (modifié)']);
});

t('cabinet : un CSV se lit vraiment, point-virgules et guillemets compris', () => {
  // Découper sur « ; » serait plus court et faux : un libellé de facture contient un point-virgule
  // un jour sur dix, et la ligne partirait en morceaux sans que rien ne le signale.
  const rows = cab.parseCsv('﻿Date;Libellé;Débit\r\n01/08/2026;"Prestation ; maintenance";1 200,000\r\n02/08/2026;"Il a dit ""oui""";0,000\r\n');
  assert.deepStrictEqual(rows[0], ['Date', 'Libellé', 'Débit']);
  assert.deepStrictEqual(rows[1], ['01/08/2026', 'Prestation ; maintenance', '1 200,000']);
  assert.deepStrictEqual(rows[2], ['02/08/2026', 'Il a dit "oui"', '0,000']);
  assert.strictEqual(rows.length, 3, 'la ligne vide finale ne compte pas');
  // Un retour à la ligne à l'intérieur d'un champ ne coupe pas la ligne.
  const multi = cab.parseCsv('A;B\r\n1;"deux\nlignes"\r\n');
  assert.strictEqual(multi.length, 2);
  assert.strictEqual(multi[1][1], 'deux\nlignes');
  assert.deepStrictEqual(cab.parseCsv(''), []);
});

t('cabinet : les écritures de plusieurs clients se regroupent en un seul fichier', () => {
  // C'est ce qui fait gagner du temps à un comptable : un import, pas soixante.
  const a = 'Date;Journal;Compte;Libellé;Débit;Crédit\r\n01/08/2026;VE;411000;Facture;1200,000;0,000\r\n';
  // Deuxième client, colonnes DANS UN AUTRE ORDRE et une colonne en plus : une version différente
  // de SkanFact chez le client. Aligner à l'aveugle mettrait des montants dans « Libellé ».
  const b = 'Journal;Date;Libellé;Compte;Crédit;Débit;Devise\r\nVE;03/08/2026;Vente;707000;800,000;0,000;DT\r\n';
  const r = cab.mergeEcritures([
    { name: 'Menuiserie Trabelsi', matricule: '1122334A', month: '2026-08', csv: a },
    { name: 'Pharmacie El Menzah', matricule: '2233445B', month: '2026-08', csv: b },
    { name: 'Café des Jasmins', matricule: '5566778E', month: '2026-08', csv: 'Date;Journal\r\n' }   // mois sans activité
  ]);
  const lignes = r.csv.replace(/^﻿/, '').trim().split('\r\n');
  // Le client vient en tête, puis les colonnes dans l'ordre où elles sont apparues.
  assert.strictEqual(lignes[0], 'Client;Matricule;Mois;Date;Journal;Compte;Libellé;Débit;Crédit;Devise');
  assert.strictEqual(r.lignes, 2);
  assert.strictEqual(r.dossiers, 2);
  assert.deepStrictEqual(r.vides, ['Café des Jasmins (août 2026)']);
  // La ligne du second client est remise dans l'ordre des colonnes, pas recopiée telle quelle.
  const cols = lignes[0].split(';');
  const l2 = cab.parseCsv(lignes[0] + '\r\n' + lignes[2])[1];
  const val = nom => l2[cols.indexOf(nom)];
  assert.strictEqual(val('Client'), 'Pharmacie El Menzah');
  assert.strictEqual(val('Date'), '03/08/2026');
  assert.strictEqual(val('Compte'), '707000');
  assert.strictEqual(val('Crédit'), '800,000');
  assert.strictEqual(val('Devise'), 'DT');
  // Le premier client n'a pas de colonne Devise : la case reste vide, elle ne décale rien.
  const l1 = cab.parseCsv(lignes[0] + '\r\n' + lignes[1])[1];
  assert.strictEqual(l1[cols.indexOf('Devise')], '');
  assert.strictEqual(l1[cols.indexOf('Débit')], '1200,000');
  assert.ok(r.csv.startsWith('﻿'), 'sans le BOM, Excel en français lit « Société » comme « SociÃ©tÃ© »');
});

t('cabinet : le plan d\'export dit ce qui sera lu et ce qui manque', () => {
  const S = cab.migrate({ dossiers: [
    { id: 'a', name: 'Alpha', matricule: '1111111A', packs: [
      { month: '2026-07', definitive: true, path: '/p/a-07', missing: [] },
      { month: '2026-08', definitive: false, path: '/p/a-08', missing: [] }] },
    { id: 'b', name: 'Beta', matricule: '2222222B', packs: [{ month: '2026-08', definitive: true, path: '/p/b-08', missing: [] }] },
    { id: 'c', name: 'Gamma', packs: [] },                                   // n'a rien envoyé
    { id: 'd', name: 'Delta', manual: true, packs: [] },                     // pas encore sur SkanFact
    { id: 'e', name: 'Exemple', demo: true, packs: [{ month: '2026-08', path: '' }] }
  ] });
  const plan = cab.ecrituresPlan(S, { month: '2026-08' });
  assert.deepStrictEqual(plan.packs.map(p => p.name), ['Alpha', 'Beta']);
  assert.deepStrictEqual(plan.mois, ['2026-08']);
  assert.deepStrictEqual(plan.provisoires, ['Alpha (août 2026)']);
  assert.deepStrictEqual(plan.sansPaquet, ['Gamma'], 'un client hors SkanFact n\'est pas « en manque »');
  // Un intervalle prend les deux mois, dans l'ordre.
  const large = cab.ecrituresPlan(S, { from: '2026-07', to: '2026-08' });
  assert.deepStrictEqual(large.packs.map(p => p.month + ' ' + p.name), ['2026-07 Alpha', '2026-08 Alpha', '2026-08 Beta']);
  // On peut se limiter à un client.
  assert.deepStrictEqual(cab.ecrituresPlan(S, { month: '2026-08', ids: ['b'] }).packs.map(p => p.name), ['Beta']);
  // Un paquet d'exemple n'a pas de fichier : il ne doit jamais entrer dans un export réel.
  assert.ok(!plan.packs.some(p => p.id === 'e'));
});

// ---------- cabinet : le magasin et ses filets (src/cabinet/cabstore.js) ----------
// C'est l'application qui détient la comptabilité de dizaines d'entreprises ET la clé qui ouvre
// leurs paquets. Elle n'avait aucune sauvegarde. Ces tests prouvent les filets un par un.
const CS = require('../src/cabinet/cabstore.js');
const cfs = require('fs');
const cpath = require('path');
const cos = require('os');

function tmpCab() { return cfs.mkdtempSync(cpath.join(cos.tmpdir(), 'cabstore-')); }
function cabState(extra) { return cab.migrate({ cabinet: { name: 'Cabinet Test', publicKey: 'PUB', privateKey: 'PRIV' }, ...(extra || {}) }); }

t('cabstore : le coffre s\'ouvre avec le bon mot de passe, et avec lui seul', () => {
  const dir = tmpCab();
  const s = CS.createCabStore(dir);
  assert.strictEqual(s.exists(), false);
  s.create('mot-de-passe-long', cabState());
  assert.strictEqual(s.exists(), true);
  // Le fichier sur le disque ne laisse rien filtrer : ni les noms des clients, ni la clé privée.
  const brut = cfs.readFileSync(s.file, 'utf8');
  assert.ok(!/Cabinet Test|PRIV/.test(brut), 'le fichier chiffré ne doit rien laisser lire en clair');

  const autre = CS.createCabStore(dir);
  assert.strictEqual(autre.unlock('mauvais').ok, false);
  const r = autre.unlock('mot-de-passe-long');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.state.cabinet.privateKey, 'PRIV');
});

t('cabstore : un fichier illisible est mis de côté, jamais écrasé', () => {
  // C'est la règle qui a sauvé l'app entreprise : sans elle, la première écriture après une
  // corruption détruit la seule copie qui restait.
  const dir = tmpCab();
  const s = CS.createCabStore(dir);
  s.create('mot-de-passe-long', cabState());
  cfs.writeFileSync(s.file, 'ceci n\'est pas du JSON', 'utf8');
  const s2 = CS.createCabStore(dir);
  const r = s2.unlock('mot-de-passe-long');
  assert.strictEqual(r.missing, true);
  assert.ok(s2.state.corruptFile, 'le fichier abîmé doit être nommé pour qu\'on puisse le récupérer');
  assert.ok(cfs.existsSync(s2.state.corruptFile));
  assert.strictEqual(cfs.readFileSync(s2.state.corruptFile, 'utf8'), 'ceci n\'est pas du JSON');
  assert.strictEqual(cfs.existsSync(s.file), false, 'et l\'original ne doit plus être là pour être écrasé');
});

t('cabstore : la sauvegarde du jour garde l\'état du matin, pas celui de midi', () => {
  const dir = tmpCab();
  let jour = new Date('2026-09-12T09:00:00Z');
  const s = CS.createCabStore(dir, { now: () => jour });
  const st = cabState();
  s.create('mot-de-passe-long', st);
  st.dossiers.push(cab.newDossier({ name: 'Premier client' }));
  s.write(st);                                   // première écriture du jour → photo de l'état d'avant
  st.dossiers.push(cab.newDossier({ name: 'Deuxième client' }));
  s.write(st);                                   // deuxième écriture → pas de seconde photo
  const list = s.listBackups();
  assert.strictEqual(list.filter(x => x.daily).length, 1, 'une seule sauvegarde quotidienne par jour');
  const photo = s.peek(list[0].path, 'mot-de-passe-long');
  assert.strictEqual(photo.dossiers.length, 0, 'la photo est l\'état de CE MATIN, avant la première modification');

  // Le lendemain, une nouvelle photo — celle de la veille au soir.
  jour = new Date('2026-09-13T09:00:00Z');
  st.dossiers.push(cab.newDossier({ name: 'Troisième client' }));
  s.write(st);
  const list2 = s.listBackups().filter(x => x.daily);
  assert.strictEqual(list2.length, 2);
  assert.strictEqual(s.peek(list2[0].path, 'mot-de-passe-long').dossiers.length, 2);
});

t('cabstore : restaurer met l\'état actuel de côté avant de l\'écraser', () => {
  // Une restauration qui se révèle être la mauvaise sauvegarde ne doit pas être un aller simple.
  const dir = tmpCab();
  let jour = new Date('2026-09-12T09:00:00Z');
  const s = CS.createCabStore(dir, { now: () => jour });
  const st = cabState();
  s.create('mot-de-passe-long', st);
  const avant = s.backupNow('point-de-depart');
  st.dossiers.push(cab.newDossier({ name: 'Ajouté après' }));
  jour = new Date('2026-09-12T10:00:00Z');
  s.write(st);
  assert.strictEqual(s.unlock('mot-de-passe-long').state.dossiers.length, 1);

  jour = new Date('2026-09-12T11:00:00Z');
  const restauré = s.restore(avant);
  assert.strictEqual(restauré.dossiers.length, 0);
  assert.ok(s.listBackups().some(x => /avant-restauration/.test(x.name)), 'l\'état d\'avant la restauration doit être gardé');
  const retour = s.listBackups().find(x => /avant-restauration/.test(x.name));
  assert.strictEqual(s.peek(retour.path).dossiers.length, 1, 'et il doit contenir ce qu\'on venait de perdre');
});

t('cabstore : le MÊME mot de passe rouvre une sauvegarde faite avant une recréation', () => {
  // Le piège du jour où ça compte. Le fichier principal disparaît ; on rouvre l'application et on
  // retape le bon mot de passe — mais un nouveau sel est tiré au hasard, donc la clé dérivée n'est
  // plus la même et les sauvegardes paraissent verrouillées. L'application répondait « cette
  // sauvegarde a été faite avec un autre mot de passe » à quelqu'un qui venait de taper le bon.
  const dir = tmpCab();
  let jour = new Date('2026-09-12T09:00:00Z');
  const s = CS.createCabStore(dir, { now: () => jour });
  const st = cabState();
  st.dossiers.push(cab.newDossier({ name: 'Client à sauver' }));
  s.create('mot-de-passe-long', st);
  const sauvegarde = s.backupNow('avant-la-catastrophe');

  // catastrophe : le fichier principal disparaît, les sauvegardes restent
  cfs.unlinkSync(s.file);
  jour = new Date('2026-09-12T11:00:00Z');
  const s2 = CS.createCabStore(dir, { now: () => jour });
  assert.strictEqual(s2.exists(), false);
  s2.create('mot-de-passe-long', cabState());          // même mot de passe, NOUVEAU sel

  const relu = s2.peek(sauvegarde);
  assert.strictEqual(relu.dossiers.length, 1);
  assert.strictEqual(relu.dossiers[0].name, 'Client à sauver');
  // Et la clé du cabinet revient : sans elle, tous les paquets déjà reçus seraient illisibles.
  assert.strictEqual(relu.cabinet.privateKey, 'PRIV');
  // Un mot de passe qui n'est vraiment pas le bon reste refusé, lui.
  const s3 = CS.createCabStore(tmpCab());
  s3.create('un-tout-autre-mot-de-passe', cabState());
  assert.throws(() => s3.peek(sauvegarde), /autre mot de passe/);
});

t('cabstore : changer le mot de passe rechiffre AUSSI les sauvegardes', () => {
  // Une sauvegarde restée sur l'ancien mot de passe est une sauvegarde qu'on ne pourra pas
  // restaurer le jour venu — c'est-à-dire pas une sauvegarde.
  const dir = tmpCab();
  let jour = new Date('2026-09-12T09:00:00Z');
  const s = CS.createCabStore(dir, { now: () => jour });
  const st = cabState();
  s.create('ancien-mot-de-passe', st);
  s.backupNow('avant');
  jour = new Date('2026-09-12T10:00:00Z');
  s.setPassword(st, 'nouveau-mot-de-passe');

  const s2 = CS.createCabStore(dir);
  assert.strictEqual(s2.unlock('ancien-mot-de-passe').ok, false, 'l\'ancien mot de passe ne doit plus ouvrir');
  assert.strictEqual(s2.unlock('nouveau-mot-de-passe').ok, true);
  s2.listBackups().forEach(b => {
    assert.doesNotThrow(() => s2.peek(b.path), `la sauvegarde ${b.name} doit s'ouvrir avec le nouveau mot de passe`);
  });
});

t('cabstore : les paquets se rangent par client et par année', () => {
  // Ils étaient tous à plat, nommés par matricule : deux mille fichiers illisibles dans un dossier.
  const dir = tmpCab();
  const s = CS.createCabStore(dir);
  const st = cabState();
  s.create('mot-de-passe-long', st);
  const src = cpath.join(dir, 'source.skanpack');
  cfs.writeFileSync(src, 'contenu');

  const d = cab.newDossier({ name: 'Menuiserie Trabelsi SUARL', matricule: '1122334A/M/P/000' });
  st.dossiers.push(d);
  const p = s.storePack(src, d, '2026-08', st.dossiers);
  assert.ok(p.endsWith(cpath.join('Menuiserie-Trabelsi-SUARL', '2026', '2026-08.skanpack')), 'chemin inattendu : ' + p);
  assert.strictEqual(cfs.readFileSync(p, 'utf8'), 'contenu');
  assert.strictEqual(cfs.existsSync(src), true, 'le fichier d\'origine du comptable n\'est jamais déplacé');

  // Deux clients de même nom ne doivent pas se mélanger : le matricule les sépare.
  const d2 = cab.newDossier({ name: 'Menuiserie Trabelsi SUARL', matricule: '9988776Z/M/P/000' });
  st.dossiers.push(d2);
  const p2 = s.storePack(src, d2, '2026-08', st.dossiers);
  assert.notStrictEqual(p, p2, 'deux clients homonymes écriraient dans le même fichier');

  const stats = s.packStats();
  assert.strictEqual(stats.files, 2);
  assert.ok(stats.bytes > 0);
});

t('cabstore : le rangement reprend l\'ancien classement à plat sans rien perdre', () => {
  const dir = tmpCab();
  const s = CS.createCabStore(dir);
  const st = cabState();
  s.create('mot-de-passe-long', st);
  // L'ancien rangement : paquets/MF_1122334AMP000-2026-08.skanpack
  const vieux = cpath.join(s.packRoot, 'MF_1122334AMP000-2026-08.skanpack');
  cfs.mkdirSync(s.packRoot, { recursive: true });
  cfs.writeFileSync(vieux, 'vieux contenu');
  st.dossiers.push(cab.migrateDossier({
    id: 'MF:1122334AMP000', name: 'Menuiserie Trabelsi SUARL', matricule: '1122334A/M/P/000',
    packs: [{ month: '2026-08', label: 'août 2026', definitive: true, missing: [], path: vieux }]
  }));

  const r = s.reorganize(st);
  assert.strictEqual(r.moved, 1);
  assert.strictEqual(r.lost, 0);
  const neuf = st.dossiers[0].packs[0].path;
  assert.ok(neuf.endsWith(cpath.join('Menuiserie-Trabelsi-SUARL', '2026', '2026-08.skanpack')));
  assert.strictEqual(cfs.readFileSync(neuf, 'utf8'), 'vieux contenu');
  assert.strictEqual(cfs.existsSync(vieux), false);
  // Deux passages de suite ne cassent rien et ne déplacent plus rien.
  assert.strictEqual(s.reorganize(st).moved, 0);
  // Un paquet d'exemple n'a pas de fichier : il ne doit ni être compté ni faire échouer le rangement.
  st.dossiers.push(cab.migrateDossier({ id: 'demo', name: 'Exemple', demo: true, packs: [{ month: '2026-07', path: '' }] }));
  assert.strictEqual(s.reorganize(st).lost, 0);
  // Un fichier disparu se compte, sans faire tomber l'application.
  cfs.unlinkSync(neuf);
  st.dossiers[0].name = 'Menuiserie Trabelsi SARL';
  assert.strictEqual(s.reorganize(st).lost, 1);
});

t('cabinet : changer d\'ordinateur — le cabinet se reprend, paquets compris', () => {
  // Le pire des défauts : celui qui punit quelqu'un qui a tout bien fait. Le comptable avait sa copie
  // sur clé USB et sa clé de secours ; sur le poste neuf l'application disait « Bienvenue », lui
  // fabriquait une clé NEUVE, et les paquets que ses clients enverraient ensuite étaient refusés
  // (« adressé à un autre cabinet »). Huit cents paquets lisibles, et aucun bouton pour les reprendre.
  const ancien = tmpCab(), ext = tmpCab(), neuf = tmpCab();
  const s = CS.createCabStore(ancien, { externalDir: ext });
  const st = cabState();
  const d = cab.newDossier({ name: 'Menuiserie Trabelsi SUARL', matricule: '1122334A/M/P/000' });
  st.dossiers.push(d);
  s.create('mot-de-passe-long', st);
  const recu = cpath.join(ancien, 'recu.skanpack');
  cfs.writeFileSync(recu, 'le paquet du client');
  d.packs.push({ month: '2026-08', label: 'août 2026', definitive: true, missing: [], path: s.storePack(recu, d, '2026-08', st.dossiers) });
  s.write(st);

  // Le poste neuf : rien du tout. On REGARDE avant de demander quoi que ce soit.
  const s2 = CS.createCabStore(neuf);
  assert.strictEqual(s2.exists(), false);
  const vu = s2.inspectSource(ext);                    // la racine du support, pas le sous-dossier
  assert.strictEqual(vu.kind, 'dossier');
  assert.ok(vu.base, 'la copie externe porte le fichier du cabinet');
  assert.strictEqual(vu.packs, 1, 'et le paquet du client');

  // Un mot de passe faux ne laisse RIEN derrière lui : sur cette machine-là, il n'y a encore rien à
  // quoi revenir.
  assert.throws(() => s2.adoptSource(ext, 'mauvais'), /Mot de passe incorrect/);
  assert.strictEqual(s2.exists(), false, 'un essai raté ne doit pas créer de cabinet');

  const r = s2.adoptSource(ext, 'mot-de-passe-long');
  assert.strictEqual(r.state.dossiers.length, 1);
  assert.strictEqual(r.state.cabinet.privateKey, 'PRIV', 'la clé du cabinet revient : c\'est tout l\'enjeu');
  assert.strictEqual(r.packs, 1, 'les paquets suivent la base');
  assert.strictEqual(s2.unlocked(), true, 'la session repart ouverte : on ne redemande pas ce qu\'on vient de taper');

  // Les chemins enregistrés désignent l'ANCIEN poste. Sans rattrapage, des paquets bien présents
  // passeraient pour perdus, sans un mot.
  const st2 = cab.migrate(r.state);
  assert.ok(st2.dossiers[0].packs[0].path.startsWith(ancien), 'le chemin enregistré vient de l\'autre poste');
  const rr = s2.reorganize(st2);
  assert.strictEqual(rr.recovered, 1);
  assert.strictEqual(rr.lost, 0);
  assert.ok(st2.dossiers[0].packs[0].path.startsWith(s2.packRoot), 'le chemin doit être recollé sur ce poste');
  assert.strictEqual(cfs.readFileSync(st2.dossiers[0].packs[0].path, 'utf8'), 'le paquet du client');
  assert.ok(!st2.dossiers[0].packs[0].missingFile);
  assert.strictEqual(s2.reorganize(st2).recovered, 0, 'un second passage ne retrouve plus rien : tout est en place');

  // Un paquet vraiment absent reste absent : on ne fait pas semblant.
  st2.dossiers[0].packs.push({ month: '2026-07', label: 'juillet 2026', missing: [], path: cpath.join(ancien, 'paquets', 'x', '2026', '2026-07.skanpack') });
  assert.strictEqual(s2.reorganize(st2).lost, 1);
  assert.strictEqual(st2.dossiers[0].packs[1].missingFile, true);

  // Le fichier seul se reprend aussi — sans les paquets, et on ne le cache pas.
  const seul = CS.createCabStore(tmpCab());
  const r2 = seul.adoptSource(cpath.join(ext, 'SkanFact Cabinet', 'cabinet-data.json'), 'mot-de-passe-long');
  assert.strictEqual(r2.state.dossiers.length, 1);
  assert.strictEqual(r2.packs, 0, 'un fichier seul ne rapporte pas les pièces');

  // Et ce qui n'est pas un cabinet est refusé AVANT qu'on demande un mot de passe.
  const bidon = cpath.join(neuf, 'liste.txt');
  cfs.writeFileSync(bidon, 'bonjour');
  assert.throws(() => seul.inspectSource(bidon), /pas un cabinet SkanFact/);
  assert.throws(() => seul.inspectSource(tmpCab()), /aucun cabinet SkanFact/);
});

t('cabstore : la copie externe emporte AUSSI les paquets', () => {
  // Une copie qui ne prend que la base laisserait le comptable avec l'index de ce qu'il a perdu :
  // les paquets SONT les pièces justificatives.
  const dir = tmpCab();
  const ext = tmpCab();
  const s = CS.createCabStore(dir, { externalDir: ext });
  const st = cabState();
  s.create('mot-de-passe-long', st);
  const src = cpath.join(dir, 'source.skanpack');
  cfs.writeFileSync(src, 'pièce justificative');
  const d = cab.newDossier({ name: 'Client A', matricule: '1111111A/M/P/000' });
  st.dossiers.push(d);
  s.storePack(src, d, '2026-08', st.dossiers);      // ranger un paquet entraîne la copie complète
  s.backupNow('manuelle');

  const cible = cpath.join(ext, 'SkanFact Cabinet');
  assert.ok(cfs.existsSync(cpath.join(cible, 'cabinet-data.json')), 'la base doit être copiée');
  assert.ok(cfs.readdirSync(cpath.join(cible, 'sauvegardes')).length > 0, 'les sauvegardes aussi');
  assert.strictEqual(
    cfs.readFileSync(cpath.join(cible, 'paquets', 'Client-A', '2026', '2026-08.skanpack'), 'utf8'),
    'pièce justificative', 'et les paquets, rangés pareil');

  // Mais PAS à chaque enregistrement : les paquets ne bougent qu'à l'import et à la suppression,
  // et parcourir deux mille fichiers pour enregistrer un numéro de téléphone bloquerait
  // l'application plusieurs secondes à chaque bouton Enregistrer.
  const nouveau = cpath.join(dir, 'apres.skanpack');
  cfs.writeFileSync(nouveau, 'ajouté à la main dans le dossier local');
  cfs.copyFileSync(nouveau, cpath.join(s.packRoot, 'Client-A', '2026', '2026-09.skanpack'));
  st.dossiers[0].note = 'une modification de fiche ordinaire';
  s.write(st);
  assert.strictEqual(cfs.existsSync(cpath.join(cible, 'paquets', 'Client-A', '2026', '2026-09.skanpack')), false,
    'un enregistrement ordinaire ne doit pas parcourir toute l\'arborescence des paquets');
  assert.strictEqual(s.mirrorExternal({ packs: true }), true);
  assert.strictEqual(cfs.existsSync(cpath.join(cible, 'paquets', 'Client-A', '2026', '2026-09.skanpack')), true,
    'la copie complète, elle, les emporte');

  // Support débranché : on note l'erreur, on ne bloque rien.
  s.setExternalDir(cpath.join(ext, 'nulle-part-du-tout'));
  assert.strictEqual(s.mirrorExternal(), false);
  assert.ok(s.state.external.lastError, 'l\'échec doit être nommé, pas avalé');
  assert.doesNotThrow(() => s.write(st), 'une copie impossible n\'empêche jamais d\'enregistrer');
});

t('cabstore : supprimer un dossier emporte ses paquets', () => {
  const dir = tmpCab();
  const s = CS.createCabStore(dir);
  const st = cabState();
  s.create('mot-de-passe-long', st);
  const src = cpath.join(dir, 'source.skanpack');
  cfs.writeFileSync(src, 'x');
  const d = cab.newDossier({ name: 'Client Parti', matricule: '2222222B/M/P/000' });
  st.dossiers.push(d);
  const p = s.storePack(src, d, '2026-08', st.dossiers);
  d.packs.push({ month: '2026-08', path: p });
  assert.strictEqual(cfs.existsSync(p), true);
  s.removeDossierFiles(d, st.dossiers);
  assert.strictEqual(cfs.existsSync(p), false, 'garder les pièces d\'un dossier supprimé serait le pire des deux mondes');
  // Un chemin hors du dossier des paquets n'est jamais supprimé, même si l'état le prétend.
  const dehors = cpath.join(dir, 'important.txt');
  cfs.writeFileSync(dehors, 'ne pas toucher');
  s.removePack(dehors);
  assert.strictEqual(cfs.existsSync(dehors), true, 'la suppression ne doit jamais sortir du dossier des paquets');
});

t('cabstore : la clé de secours se rouvre, et elle seule', () => {
  // Sans elle, perdre le poste rend illisible TOUT ce que les clients ont envoyé, pour toujours.
  const fichier = CS.makeRecovery({ name: 'Cabinet Test', email: 'c@t.tn', publicKey: 'PUB', privateKey: 'PRIV' }, 'secours-long-mdp', new Date('2026-09-12T10:00:00Z'));
  // L'entête reste lisible : une clé mal rangée doit rester identifiable sans mot de passe.
  assert.strictEqual(fichier.cabinet, 'Cabinet Test');
  assert.ok(fichier.avertissement.length > 40, 'le fichier doit dire lui-même ce qu\'il est et ce qu\'on risque');
  assert.ok(!JSON.stringify(fichier.coffre).includes('PRIV'), 'la clé privée ne doit jamais être en clair');

  const relu = CS.readRecovery(fichier, 'secours-long-mdp');
  assert.strictEqual(relu.privateKey, 'PRIV');
  assert.strictEqual(relu.publicKey, 'PUB');
  assert.throws(() => CS.readRecovery(fichier, 'mauvais'), /incorrect/);
  assert.throws(() => CS.readRecovery({ quoi: 'autre chose' }, 'x'), /clé de secours/);
});

// Un appel à une fonction qui n'existe pas ne se voit NULLE PART avant l'exécution : pas à la
// lecture, pas au `node --check`, pas dans les tests qui ne touchent pas cette ligne. C'est comme ça
// que `h(a.relayFailure)` est arrivé dans le renderer du cabinet (où la fonction s'appelle `esc`),
// copié d'app.js côté entreprise : le panneau des mises à jour plantait au moment précis où il
// devait annoncer qu'une mise à jour était impossible. Ce test lit le code, sans les commentaires ni
// le texte des chaînes — mais EN GARDANT les `${…}` des gabarits, puisque c'est là qu'il était.
function codeSeulement(src) {
  let out = '', i = 0;
  // La pile dit où l'on est : dans le TEXTE d'un gabarit, ou dans le CODE d'un ${…}. Sans elle, un
  // gabarit imbriqué dans une interpolation (il y en a partout dans le renderer) désynchronise tout
  // et la moitié du fichier est prise pour du texte.
  const pile = [];
  const dansTexte = () => pile.length && pile[pile.length - 1].type === 'tpl';
  // Un « / » ouvre une expression régulière seulement après un opérateur ou une ouverture ; après un
  // identifiant ou une parenthèse fermante, c'est une division. Sans cette distinction, le `/'/g` de
  // la fonction d'échappement fait croire à une chaîne et décale la lecture.
  const avantRegex = () => {
    const m = out.replace(/\s+$/, '');
    if (!m) return true;
    const c = m[m.length - 1];
    if ('([{,;:=!&|?+-*%~^<>'.includes(c)) return true;
    return /\b(return|typeof|case|in|of|new|delete|void|instanceof|do|else)$/.test(m);
  };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (dansTexte()) {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { pile.pop(); out += ' "" '; i++; continue; }
      if (c === '$' && d === '{') { pile.push({ type: 'expr', prof: 0 }); out += ' ; '; i += 2; continue; }
      i++; continue;                                   // le texte du gabarit n'est pas du code
    }
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; out += ' '; continue; }
    if (c === '/' && d === '/') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; out += ' '; continue; }
    if (c === '/' && avantRegex()) {                   // expression régulière
      i++;
      let classe = false;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') classe = true;
        else if (src[i] === ']') classe = false;
        else if (src[i] === '/' && !classe) break;
        else if (src[i] === '\n') break;
        i++;
      }
      i++;
      while (i < src.length && /[a-z]/.test(src[i])) i++;
      out += ' 0 '; continue;
    }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; out += ' "" '; continue;
    }
    if (c === '`') { pile.push({ type: 'tpl' }); out += ' '; i++; continue; }
    if (c === '{') { const top = pile[pile.length - 1]; if (top && top.type === 'expr') top.prof++; out += c; i++; continue; }
    if (c === '}') {
      const top = pile[pile.length - 1];
      if (top && top.type === 'expr') {
        if (top.prof === 0) { pile.pop(); out += ' ; '; i++; continue; }   // fin du ${ }
        top.prof--;
      }
      out += c; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

const GLOBAUX = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'new', 'delete', 'await',
  'do', 'else', 'in', 'of', 'void', 'yield', 'case', 'throw', 'instanceof',
  'String', 'Number', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'Promise', 'Set', 'Map',
  'RegExp', 'Error', 'Symbol', 'BigInt', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'alert', 'confirm', 'prompt', 'fetch', 'structuredClone', 'queueMicrotask', 'require', 'async',
  'matchMedia',   // window.matchMedia — le thème « auto » suit le réglage du système
  // Côté processus principal (Node). Seuls les noms qui commencent par une minuscule peuvent être
  // signalés par le détecteur — les constructeurs (Buffer, URL, TextEncoder…) ne le sont jamais.
  'setImmediate', 'clearImmediate', 'process', 'globalThis'
]);

function appelsNonDefinis(src) {
  const code = codeSeulement(src);
  const defs = new Set();
  // déclarations
  [...code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].forEach(m => defs.add(m[1]));
  [...code.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/g)].forEach(m => defs.add(m[1]));
  [...code.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)].forEach(m => defs.add(m[1]));
  // déstructurations : const { a, b: c } = …  et  const [a, b] = …
  [...code.matchAll(/\b(?:const|let|var)\s*[[{]([^}\]]*)[}\]]/g)].forEach(m =>
    m[1].split(',').forEach(p => { const x = (p.split(':').pop() || '').trim().replace(/=.*$/, '').trim(); if (/^[A-Za-z_$][\w$]*$/.test(x)) defs.add(x); }));
  // paramètres : function f(a, b), (a, b) => , a =>, catch (e)
  [...code.matchAll(/(?:function\s*\*?\s*[A-Za-z_$][\w$]*\s*|function\s*|catch\s*)\(([^)]*)\)/g)].forEach(m =>
    m[1].split(',').forEach(p => { const x = p.trim().replace(/=.*$/, '').replace(/^\.\.\./, '').trim(); if (/^[A-Za-z_$][\w$]*$/.test(x)) defs.add(x); }));
  [...code.matchAll(/\(([^()]*)\)\s*=>/g)].forEach(m =>
    m[1].split(',').forEach(p => { const x = p.trim().replace(/=.*$/, '').replace(/^\.\.\./, '').trim(); if (/^[A-Za-z_$][\w$]*$/.test(x)) defs.add(x); }));
  [...code.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)].forEach(m => defs.add(m[1]));
  // méthodes abrégées d'un objet : { get(k, def) { … } } — ce sont des définitions, pas des appels
  [...code.matchAll(/([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{/g)].forEach(m => {
    defs.add(m[1]);
    m[2].split(',').forEach(p => { const x = p.trim().replace(/=.*$/, '').replace(/^\.\.\./, '').trim(); if (/^[A-Za-z_$][\w$]*$/.test(x)) defs.add(x); });
  });
  // appels : nom( — sauf après un point (méthode) ou précédé d'un mot
  const manquants = new Set();
  [...code.matchAll(/(^|[^.\w$])([a-z_$][\w$]*)\s*\(/g)].forEach(m => {
    const nom = m[2];
    if (!defs.has(nom) && !GLOBAUX.has(nom)) manquants.add(nom);
  });
  return [...manquants];
}

t('cabinet : aucun de ses fichiers n\'appelle une fonction qui n\'existe pas', () => {
  // Le test se prouve lui-même d'abord : sur un cas fabriqué, il doit voir le défaut.
  assert.deepStrictEqual(appelsNonDefinis('const esc = x => x; const s = `<p>${h(a)}</p>`;'), ['h'],
    'le détecteur doit voir un appel manquant à l\'intérieur d\'un gabarit');
  assert.deepStrictEqual(appelsNonDefinis('const h = x => x; const s = `<p>${h(a)}</p>`;'), []);
  assert.deepStrictEqual(appelsNonDefinis('// jamais lu : quelque chose (ici)\nconst s = "une phrase (entre guillemets)";'), [],
    'ni un commentaire ni une chaîne ne sont du code');

  // audit I1 : les deux `main.js` manquaient à cette liste — et ce sont les seuls fichiers
  // qu'AUCUN test n'exécute. Une faute du genre `h(...)` (le défaut que ce test existe pour
  // attraper, déjà survenu une fois) dans un handler IPC ne se manifeste que le jour où un
  // comptable clique : « Impossible d'importer », sans autre explication, et personne ne peut le
  // reproduire avant d'avoir installé l'application.
  // 7.22.1 : l'app ENTREPRISE manquait à cette liste — c'est-à-dire l'application principale, et
  // celle qui a le plus de code. Elle y est entrée après ce défaut : `serialForm` appelait
  // `clientItems`, une fonction déclarée LOCALEMENT dans deux autres formulaires et absente ici.
  // « Modifier » sur un numéro de série levait une ReferenceError pendant la construction de la
  // fenêtre : la fenêtre ne s'ouvrait pas, le bouton paraissait simplement mort, et rien
  // n'apparaissait dans la console de l'utilisateur. Une règle apprise d'un côté se vérifie de
  // l'autre (règle 7.3.0) — celle-ci ne l'avait jamais été.
  [
    'src/cabinet/renderer/app.js', 'src/cabinet/cabcore.js', 'src/cabinet/renderer/cabguide.js',
    'src/cabinet/cabstore.js', 'src/cabinet/main.js', 'src/cabinet/preload.js',
    'src/main.js', 'src/preload.js',
    'src/renderer/app.js', 'src/renderer/core.js', 'src/renderer/guide.js', 'src/renderer/rowmenu.js',
    'src/renderer/onboarding.js', 'src/renderer/demo.js', 'src/storage.js', 'src/zip.js', 'src/licence.js'
  ].forEach(f => {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.deepStrictEqual(appelsNonDefinis(src), [], `${f} appelle une fonction qui n'existe pas`);
  });
});

t('cabinet : un import de vingt paquets parle, s\'arrête, et son interface est surveillée', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'main.js'), 'utf8');
  const pre = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'preload.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'renderer', 'app.js'), 'utf8');

  // ---- la boucle d'import rend la main ----
  // Vingt paquets de cinquante mégaoctets, c'est vingt secondes pendant lesquelles le processus
  // principal ne lit AUCUN message : ni l'avancement qu'il devrait envoyer, ni l'arrêt qu'on lui
  // demande. Une seule ligne empêche ça, et elle doit rester.
  const boucle = main.slice(main.indexOf('ipcMain.handle(\'cab:importPack\''), main.indexOf('const PACK_FORMAT'));
  assert.ok(boucle, 'le handler d\'import est introuvable');
  assert.ok(!/for \(const f of files\)/.test(boucle), 'la boucle d\'import ne doit plus être synchrone');
  assert.ok(/await new Promise\(res => setImmediate\(res\)\)/.test(boucle),
    'l\'import doit rendre la main entre deux paquets');
  assert.ok(/import:progress/.test(boucle), 'l\'import doit dire où il en est');
  assert.ok(/ipcMain\.on\('cab:importCancel'/.test(main), 'il faut un moyen d\'arrêter un import en cours');
  // L'arrêt se lit ENTRE deux paquets : après la respiration (sinon il n'arriverait jamais) et
  // avant d'en ouvrir un nouveau (jamais au milieu d'une écriture).
  const respire = boucle.indexOf('setImmediate');
  const arret = boucle.indexOf('if (importAnnule)');
  const range = boucle.indexOf('ingest(f');
  assert.ok(respire > 0 && arret > respire && range > arret,
    'l\'arrêt doit être lu après la respiration et avant de ranger le paquet suivant');

  // ---- on ne hache rien deux fois ----
  // `data()` refait l'inflate ET le contrôle CRC à chaque appel : le manifeste était décompressé
  // trois fois par paquet, et haché deux fois, pour un fichier qui ne peut pas porter sa propre
  // empreinte.
  const ing = main.slice(main.indexOf('function ingest('), main.indexOf('ipcMain.handle(\'cab:openInPack\''));
  assert.strictEqual((ing.match(/mEntry\.data\(\)/g) || []).length, 1,
    'le manifeste ne doit être décompressé qu\'une seule fois');
  assert.ok(/e\.name === 'manifeste\.json'\) return;/.test(ing),
    'le manifeste ne se hache pas : il ne peut pas porter sa propre empreinte');

  // ---- le chien de garde, porté de l'app entreprise (6.5.0) ----
  const wd = main.slice(main.indexOf('function startWatchdog'), main.indexOf('function createWindow'));
  assert.ok(wd, 'l\'app cabinet n\'a pas de chien de garde');
  // 1. Le domaine Debugger s'active AVANT le gel : demandé pendant, il attendrait le fil bloqué.
  const enable = wd.indexOf('sendCommand(\'Debugger.enable\'');
  const surveille = wd.indexOf('setInterval');
  assert.ok(enable > 0 && enable < surveille, 'Debugger.enable doit être demandé avant la surveillance');
  // 2. On relâche le débogueur AVANT d'interrompre : terminateExecution sur une VM en pause ne rend
  //    jamais la main, et le surveillant gèlerait à son tour.
  const resume = wd.indexOf('cmd(\'Debugger.resume\')');
  const terminate = wd.indexOf('cmd(\'Runtime.terminateExecution\')');
  assert.ok(resume > 0 && terminate > 0 && resume < terminate,
    'Debugger.resume doit précéder Runtime.terminateExecution');
  // 3. Aucune fenêtre synchrone : devant une application figée, personne ne peut répondre.
  assert.ok(!/showMessageBoxSync/.test(wd), 'le chien de garde ne doit jamais ouvrir de fenêtre synchrone');
  // 4. Chaque commande au débogueur est bornée.
  assert.ok(/Promise\.race/.test(wd), 'les commandes du débogueur doivent être bornées dans le temps');
  // 5. Un seul programme peut inspecter la page à la fois (6.5.1).
  assert.ok(/devtools-opened/.test(wd) && /devtools-closed/.test(wd),
    'le chien de garde doit se détacher quand les outils de développement s\'ouvrent');
  // Et une règle propre au cabinet : ici c'est le processus PRINCIPAL qui travaille longtemps
  // (ranger vingt paquets, en extraire un, relire soixante paquets pour un export). Son silence à
  // lui ne doit pas passer pour un gel de l'interface, sinon il recharge une page innocente.
  assert.ok(/retard > WATCHDOG\.every/.test(wd),
    'un blocage du processus principal ne doit pas être pris pour un gel de l\'interface');
  assert.ok(/startWatchdog\(mainWindow\)/.test(main), 'le chien de garde doit être lancé avec la fenêtre');

  // ---- le pont et l'interface ----
  ['cancelImport', 'onImportProgress', 'onAlivePing', 'onFreezeNotice'].forEach(k =>
    assert.ok(new RegExp('\\b' + k + ':').test(pre), `le pont n'expose pas ${k}`));
  assert.ok(!/data:save|pack:build/.test(pre),
    'l\'app cabinet ne doit toujours rien pouvoir écrire chez un client');
  // Le battement de cœur et l'annonce d'après-gel sont branchés AVANT la séquence de démarrage :
  // l'écran de verrouillage la met en attente, et un message reçu pendant ce temps serait perdu.
  const ping = app.indexOf('api.onAlivePing()');
  const notice = app.indexOf('api.onFreezeNotice');
  const demarrage = app.indexOf('// ---------- démarrage ----------');
  assert.ok(ping > 0 && demarrage > 0 && ping < demarrage, 'le battement de cœur doit être branché avant le démarrage');
  assert.ok(notice > 0 && notice < demarrage, 'l\'annonce d\'après-gel doit être branchée avant le démarrage');
});

t('cabinet : les Réglages en onglets, et rien qui échappe à la table', () => {
  // Même garde-fou que côté entreprise, et pour la même raison : les trois usages d'un panneau (son
  // titre, les mots que la recherche connaît, son entrée de palette Cmd+K) ne peuvent pas diverger
  // s'ils viennent d'une seule table. Recopiés à la main, ils divergent toujours.
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(app.includes('const REG_PANNEAUX'), 'le nettoyage des commentaires a mangé le code');

  const table = app.slice(app.indexOf('const REG_PANNEAUX'), app.indexOf('const panneauReg'));
  const decl = {};
  (table.match(/'(pan-[a-z]+)': \{ onglet: '([a-z]+)'/g) || []).forEach(m => {
    const [, id, onglet] = m.match(/'(pan-[a-z]+)': \{ onglet: '([a-z]+)'/);
    decl[id] = onglet;
  });
  assert.ok(Object.keys(decl).length >= 7, 'la table des panneaux n\'a pas été relue');

  // Chaque panneau déclaré est posé UNE fois et une seule, et aucun panneau n'est écrit à la main.
  Object.keys(decl).forEach(id => {
    const n = app.split('panneauReg(\'' + id + '\'').length - 1;
    assert.strictEqual(n, 1, `le panneau ${id} est posé ${n} fois`);
  });
  assert.ok(!/<div class="panel[^"]*" id="pan-/.test(app), 'un panneau de réglages est écrit à la main');

  // Chaque onglet déclaré porte au moins un panneau, et chaque panneau vise un onglet qui existe.
  const onglets = app.slice(app.indexOf('const REG_TABS'), app.indexOf('const REG_PANNEAUX'));
  const ids = (onglets.match(/\['([a-z]+)',/g) || []).map(m => m.slice(2, -2));
  assert.ok(ids.length >= 2, 'les onglets n\'ont pas été relus');
  ids.forEach(t2 => assert.ok(Object.values(decl).includes(t2), `l'onglet « ${t2} » ne contient aucun panneau`));
  Object.keys(decl).forEach(id => assert.ok(ids.includes(decl[id]), `${id} vise l'onglet inexistant « ${decl[id]} »`));

  // Toute phrase qui dicte un chemin « Réglages → X » doit nommer un onglet QUI EXISTE. Le jumeau
  // « Paramètres → » existait déjà ; celui-ci manquait, et l'une des phrases nommait déjà
  // « Réglages → Sécurité », un onglet qui n'a jamais existé.
  const libelles = (onglets.match(/, *'((?:[^'\\]|\\.)*)'\]/g) || []).map(m => m.slice(3, -2).replace(/\\'/g, "'"));
  assert.ok(libelles.length >= 2, 'les libellés d\'onglets n\'ont pas été relus');
  ['src/cabinet/renderer/app.js', 'src/cabinet/main.js', 'src/cabinet/renderer/cabguide.js'].forEach(f => {
    const src = lireSource(...f.split('/'))
      .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const chemins = (src.match(/Réglages → [^<.,:)»"`\n]+/g) || [])
      .map(m => m.slice('Réglages → '.length).replace(/\\'/g, "'").split(' → ')[0].trim())
      .filter(x => x && !x.startsWith('$'));
    const inconnus = Array.from(new Set(chemins.filter(x => !libelles.includes(x))));
    assert.deepStrictEqual(inconnus, [], `${f} envoie vers un onglet de Réglages qui n'existe pas : ${inconnus.join(' · ')}`);
  });

  // La porte partagée ne bascule d'onglet que si on lui donne les TROIS rappels : n'en passer que
  // deux la laisse silencieusement inerte, et on atterrit sur le bon panneau dans un onglet masqué.
  const inst = app.slice(app.indexOf('Reglages.installer({'), app.indexOf('Reglages.installer({') + 600);
  ['nomOnglet:', 'ouvrirOnglet:', 'ongletCourant:'].forEach(k =>
    assert.ok(inst.includes(k), `installer() du cabinet ne reçoit pas ${k}`));
});

t('cabinet : la clé de secours se réclame là où on la lit, pas seulement dans un panneau', () => {
  const s = { cabinet: { name: 'C' }, dossiers: [], packs: [] };
  // Sans information, on ne crie pas : la date arrive par une promesse, et une alerte qui clignote
  // à chaque démarrage ne se lit plus.
  assert.ok(!cab.cabinetTodo(s, '2026-09-14').some(x => x.id === 'cle-secours'), 'réclamée sans rien savoir');
  assert.ok(!cab.cabinetTodo(s, '2026-09-14', { cleSecours: null }).some(x => x.id === 'cle-secours'), 'réclamée sur « je ne sais pas »');
  assert.ok(!cab.cabinetTodo(s, '2026-09-14', { cleSecours: true }).some(x => x.id === 'cle-secours'), 'réclamée alors qu\'elle existe');
  const avec = cab.cabinetTodo(s, '2026-09-14', { cleSecours: false });
  assert.strictEqual(avec[0].id, 'cle-secours', 'le seul manque irréparable passe avant tout le reste');
  assert.strictEqual(avec[0].level, 'danger');

  // Le bandeau vit HORS du système d'onglets : c'est la contrepartie exigée pour pouvoir ranger
  // cette page en onglets. Posé dans un panneau, il se cacherait derrière un clic.
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const tete = app.slice(app.indexOf('function drawReglages'), app.indexOf('id="set-corps"'));
  assert.ok(tete.includes('${recoveryBanner()}'), 'le bandeau de la clé doit être au-dessus des onglets');
  assert.ok(app.includes('${recoveryBanner()}\n        <div class="panel"><h2>Premiers pas</h2>'),
    'un cabinet sans aucun dossier ne verrait jamais l\'alerte — or c\'est le moment où elle compte le plus');
});

t('cabinet : chaque ligne de « À faire » mène quelque part', () => {
  // Jumeau du test de l'app entreprise, qui n'existait pas ici : les cinq lignes portaient le MÊME
  // lien en dur vers les Relances, donc « une échéance approche » y envoyait aussi, alors que sa
  // page est Échéances. Un bouton qui marche mais se trompe de page ne se remarque jamais.
  const core = lireSource('src', 'cabinet', 'cabcore.js');
  const bloc = core.slice(core.indexOf('function cabinetTodo'), core.indexOf('function monthListLabel'));
  assert.ok(bloc.length > 500 && bloc.includes('out.push'), 'la tranche de cabinetTodo est vide');
  const produits = Array.from(new Set((bloc.match(/id: '([a-z-]+)'/g) || []).map(m => m.slice(5, -1))));
  assert.ok(produits.length >= 5, 'les identifiants de cabinetTodo n\'ont pas été relus');

  const app = lireSource('src', 'cabinet', 'renderer', 'app.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const table = app.slice(app.indexOf('const TODO_ACTIONS'), app.indexOf('function versReglages'));
  assert.ok(table.includes('run:'), 'la table des actions est vide');
  produits.forEach(id => assert.ok(new RegExp(`'${id}':`).test(table), `« ${id} » n'a aucune action branchée`));
  // Et le bouton est vraiment posé et branché : une table seule ne fait rien.
  assert.ok(app.includes('data-todo="${esc(t.id)}"'), 'les lignes ne portent pas leur identifiant');
  assert.ok(/function bindTodo/.test(app) && app.includes('bindTodo(view)'), 'bindTodo n\'est pas appelé');
});

t('cabinet : ses classes à lui ne doivent pas exister dans la feuille partagée', () => {
  // L'app cabinet charge style.css (partagée) PUIS cabinet.css. Une classe portant le même nom des
  // deux côtés prend en silence les règles de l'autre application. C'est arrivé : l'assistant du
  // cabinet utilisait `.setup-step`, que style.css réserve au petit « étape 3 sur 5 » de l'app
  // entreprise — avec `white-space: nowrap`. Résultat : le texte ne revenait pas à la ligne et les
  // boutons sortaient de la fenêtre. Aucune erreur, rien dans la console, juste une mise en page
  // fausse qu'il faut voir pour la croire.
  const partagee = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'style.css'), 'utf8');
  const propre = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'renderer', 'cabinet.css'), 'utf8');
  // Les classes que le cabinet DÉFINIT pour lui-même (préfixes et noms qui n'ont de sens qu'ici).
  const siennes = [...propre.matchAll(/\.(wiz-[a-z-]+|reprise-[a-z-]+|drop-[a-z-]+|lock-warn|pw-[a-z-]+|warn-box|err-inline|ok-inline|year-[a-z-]+|b-hors|brand-tag|code-box|saved)\b/g)]
    .map(m => m[1]);
  assert.ok(siennes.length >= 10, 'le fichier propre au cabinet doit bien définir ses classes');
  [...new Set(siennes)].forEach(c => {
    assert.ok(!new RegExp('\\.' + c + '\\b').test(partagee),
      `la classe « ${c} » existe aussi dans style.css : l'app cabinet héritera de règles pensées pour l'autre application`);
  });
});

t('cabinet : chaque bulle « i » posée dans l\'interface a son texte', () => {
  // Même règle que côté entreprise depuis la 1.8.0 : un champ sans explication fait deviner, et le
  // comptable qui devine se trompe. L'inverse compte aussi — un texte que personne n'affiche est un
  // texte que personne ne relit.
  const guide = require('../src/cabinet/renderer/cabguide.js');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'renderer', 'app.js'), 'utf8');
  // Une clé de bulle est toujours le DERNIER argument : `info('d.name')` ou `lbl('…', 'd.name')`.
  // La chercher ainsi évite de confondre avec un sélecteur CSS de même allure (« th.sortable »),
  // et supporte un libellé qui contient lui-même des parenthèses.
  const posees = new Set([...src.matchAll(/(?:info\(|,\s*)'([a-z]{1,4}\.[A-Za-z]+)'\s*\)/g)].map(m => m[1]));
  assert.ok(posees.size >= 20, 'l\'interface du cabinet doit expliquer ses champs (posées : ' + posees.size + ')');
  posees.forEach(k => assert.ok(guide.INFO[k], `la bulle « ${k} » est posée dans l'interface mais n'a pas de texte`));
  Object.keys(guide.INFO).forEach(k => assert.ok(posees.has(k), `le texte « ${k} » n'est affiché nulle part`));
  // Et les articles de l'aide existent vraiment.
  assert.ok(guide.ARTICLES.length >= 5);
  guide.ARTICLES.forEach(a => {
    assert.ok(a.id && a.t && a.d, 'un article incomplet');
    assert.ok(a.d.length > 120, `l'article « ${a.t} » est trop court pour expliquer quoi que ce soit`);
  });
});

t('cabstore : on refuse d\'écrire autre chose qu\'un cabinet', () => {
  const dir = tmpCab();
  const s = CS.createCabStore(dir);
  s.create('mot-de-passe-long', cabState());
  assert.throws(() => s.write(null), /invalides/);
  assert.throws(() => s.write({ dossiers: 'pas un tableau' }), /invalides/);
  assert.throws(() => s.write([]), /invalides/);
  // Et rien ne s'écrit tant que personne n'a ouvert le coffre.
  const ferme = CS.createCabStore(tmpCab());
  assert.throws(() => ferme.write(cabState()), /Aucun cabinet ouvert/);
});

// ---------- second audit du 12/09/2026 au soir : les constats corrigés ----------

t('audit A5 : un nom en arabe a une identité, et deux clients arabophones ne se mélangent pas', () => {
  // Sans matricule, `dossierKey` ne gardait que A-Z0-9 : « شركة الأمان » et « مخبزة الياسمين »
  // donnaient tous deux « NOM: ». Dans un portefeuille tunisien, tous les clients dont la raison
  // sociale est en arabe tombaient dans UN SEUL dossier, et leurs paquets s'écrasaient.
  const k1 = cab.dossierKey({ entreprise: { nom: 'شركة الأمان للتجارة' } });
  const k2 = cab.dossierKey({ entreprise: { nom: 'مخبزة الياسمين' } });
  assert.ok(k1 && k1 !== 'NOM:', 'un nom arabe doit produire une clé, pas une clé vide');
  assert.notStrictEqual(k1, k2, 'deux clients arabophones ne doivent pas partager le même dossier');
  // Et le rangement sur le disque non plus.
  assert.notStrictEqual(CS.slug('شركة الأمان للتجارة'), CS.slug('مخبزة الياسمين'));
  // Une clé vide n'existe plus : elle ferait tomber tous les sans-nom au même endroit.
  assert.strictEqual(cab.dossierKey({ entreprise: {} }), '');
  // Coller une liste de clients arabophones ne doit plus perdre la moitié des lignes en « doublons ».
  const r = cab.parseDossierLines('شركة الأمان للتجارة\nمخبزة الياسمين\nصيدلية المنزه', []);
  assert.strictEqual(r.dossiers.length, 3);
  assert.strictEqual(r.ignorés.length, 0);
  assert.strictEqual(new Set(r.dossiers.map(d => d.id)).size, 3);
});

t('audit D5 : la recherche ignore les accents', () => {
  const S = cab.migrate({ dossiers: [
    { id: 'a', name: 'Épicerie du Lac', packs: [] },
    { id: 'b', name: 'Pâtisserie Ben Ali', packs: [] }
  ] });
  const noms = q => cab.dossierList(S, '2026-09-12', { q }).map(r => r.name);
  assert.deepStrictEqual(noms('epicerie'), ['Épicerie du Lac']);
  assert.deepStrictEqual(noms('patisserie'), ['Pâtisserie Ben Ali']);
  assert.deepStrictEqual(noms('Épic'), ['Épicerie du Lac'], 'et avec les accents, toujours');
});

t('audit A8 : un paquet plus ancien ne détrône pas un plus récent', () => {
  // En rattrapant une boîte mail en retard, un vieux provisoire remontait : le chiffre d'affaires
  // tombait, le mois repassait « provisoire », et le cabinet réclamait un mois déjà reçu définitif.
  const S = cab.migrate({});
  const m = (mois, gen, def, ca) => ({
    entreprise: { nom: 'Menuiserie', matricule: '1122334A' }, periode: { mois },
    genereLe: gen, definitif: def, fichiers: [], chiffres: { ca, devise: 'DT' }
  });
  cab.filePack(S, m('2026-08', '2026-09-05T10:00:00Z', true, 28450), { receivedAt: 1, path: '/a' });
  const vieux = cab.filePack(S, m('2026-08', '2026-09-02T10:00:00Z', false, 9999), { receivedAt: 2, path: '/b' });
  assert.strictEqual(vieux.ignored, true, 'un paquet fabriqué AVANT celui qu\'on a doit être écarté');
  assert.strictEqual(S.dossiers[0].packs[0].figures.ca, 28450);
  assert.strictEqual(S.dossiers[0].packs[0].definitive, true, 'et le mois ne doit pas repasser provisoire');

  // A2 : un vrai remplacement garde la trace de ce qu'il remplace, et dit de combien ça bouge.
  const neuf = cab.filePack(S, m('2026-08', '2026-09-20T10:00:00Z', true, 31000), { receivedAt: 3, path: '/c' });
  assert.strictEqual(neuf.replaced, true);
  assert.strictEqual(neuf.ecart.ca, 2550, 'l\'écart chiffré, c\'est exactement une rectificative');
  assert.strictEqual(S.dossiers[0].packs[0].precedents.length, 1);
  assert.strictEqual(S.dossiers[0].packs[0].precedents[0].figures.ca, 28450);
});

t('audit D3/D4 : le début de mission compte partout, et il est borné', () => {
  // D3 : la fiche disait « renseigne un début de mission pour commencer à attendre ses mois » à
  // propos d'un client hors SkanFact — et ce champ n'avait justement aucun effet dans ce cas.
  const hors = cab.migrateDossier({ id: 'a', name: 'Hors', manual: true, from: '2026-05', packs: [] });
  assert.deepStrictEqual(cab.dossierMonths(hors, '2026-09-12').map(m => m.month),
    ['2026-05', '2026-06', '2026-07', '2026-08']);
  // Sans date de début, on ne lui réclame toujours rien.
  assert.strictEqual(cab.dossierMonths(cab.migrateDossier({ id: 'b', manual: true, packs: [] }), '2026-09-12').length, 0);

  // D4 : sans plancher, `monthsBetween` rabotait par la FIN — l'application réclamait des mois de
  // 2006 et ne réclamait plus ceux réellement en retard.
  const vieux = cab.migrateDossier({ id: 'c', name: 'Vieux', from: '2006-01', packs: [] });
  const mois = cab.dossierMonths(vieux, '2026-09-12');
  assert.strictEqual(mois.length, 60, 'on borne à cinq ans');
  assert.strictEqual(mois[mois.length - 1].month, '2026-08', 'et on garde la FIN, pas le début');
  assert.strictEqual(mois[0].tronque, true, 'et on peut le dire à l\'écran');
});

t('audit B4 : le 1er du mois, le portefeuille ne bascule pas en retard', () => {
  // Le 1er septembre, personne n'a encore envoyé août. Le compteur rouge était maximal le jour où
  // personne n'était fautif.
  const S = cab.migrate({ settings: { relanceDay: 10 }, dossiers: [
    { id: 'a', name: 'À jour', packs: [{ month: '2026-07', definitive: true, missing: [] }] }
  ] });
  const au = d => cab.dossierList(S, d)[0];
  assert.strictEqual(au('2026-09-01').missingCount, 0);
  assert.deepStrictEqual(au('2026-09-01').awaited, ['2026-08'], 'le mois se montre, il ne crie pas');
  assert.strictEqual(au('2026-09-01').level, 'ok');
  assert.strictEqual(au('2026-09-09').missingCount, 0);
  assert.strictEqual(au('2026-09-10').missingCount, 1, 'le jour de relance, il devient un vrai manque');
  assert.strictEqual(au('2026-09-10').level, 'danger');
});

t('audit A4 : les sauvegardes se purgent par DATE, et les filets ont leur propre réserve', () => {
  // L'ordre alphabétique mettait « avant-changement-mot-de-passe » en tête : c'était TOUJOURS la
  // première effacée. Et vingt « manuelle » suffisaient à faire disparaître la copie
  // « avant-suppression-dossier » à la seconde même où elle naissait — pendant que la fenêtre
  // affichait « Une sauvegarde est prise juste avant ».
  const dir = tmpCab();
  let t0 = Date.parse('2026-09-12T08:00:00Z');
  const s = CS.createCabStore(dir, { now: () => new Date(t0) });
  s.create('mot-de-passe-long', cabState());
  const prises = [];
  for (let i = 0; i < 25; i++) { t0 += 60000; prises.push(cpath.basename(s.backupNow('manuelle'))); }
  t0 += 60000;
  const filet = s.backupNow('avant-suppression-dossier');
  assert.ok(cfs.existsSync(filet), 'le filet pris à l\'instant doit encore exister');
  const noms = s.listBackups().map(b => b.name);
  assert.ok(noms.some(n => /avant-suppression/.test(n)), 'le filet ne doit pas être chassé par les sauvegardes volontaires');

  // On vérifie NOM PAR NOM que ce sont les vingt dernières qui restent. Compter ne prouve rien :
  // vingt sauvegardes prises au hasard sont aussi « vingt ».
  const restantes = () => s.listBackups().map(b => b.name).filter(n => /^manuelle/.test(n)).sort();
  assert.deepStrictEqual(restantes(), prises.slice(5).sort(),
    'la purge doit garder les vingt DERNIÈRES prises, pas vingt quelconques');

  // Le cas Windows, reproduit ici pour qu'il échoue sur TOUTES les machines. Là-bas l'horloge
  // système n'avance que toutes les ~15 ms : vingt-six copies d'affilée portent le même mtime, et
  // l'ordre du disque ne dit plus rien. Une copie fait pire — miroir externe, clé USB, changement
  // d'ordinateur réécrivent les mtime dans l'ordre de la copie. On prend donc le cas extrême, les
  // mtime à l'ENVERS de l'ordre réel : une purge qui s'y fierait effacerait la plus RÉCENTE.
  // Sans ça, ce test passait sur Linux et échouait sur Windows, ce qui bloquait la publication.
  s.listBackups().map(b => b.path).sort().forEach((p, i) => {
    const faux = new Date(Date.parse('2026-01-01T00:00:00Z') - i * 60000);
    cfs.utimesSync(p, faux, faux);
  });
  t0 += 60000;
  const dernier = cpath.basename(s.backupNow('manuelle'));
  assert.deepStrictEqual(restantes(), prises.slice(6).concat(dernier).sort(),
    'avec des mtime trompeurs, la purge doit suivre la date écrite dans le NOM');
});

t('audit A1 : un mois piégé ne fait pas écrire hors du dossier de l\'application', () => {
  // Le mois vient du manifeste d'un paquet reçu par mail, donc de l'extérieur.
  const dir = tmpCab();
  const s = CS.createCabStore(dir);
  const d = cab.newDossier({ name: 'Client', matricule: '1111111A' });
  const piege = s.packPathFor(d, '../../../../tmp/piege', new Map());
  assert.ok(piege.startsWith(s.packRoot + cpath.sep), 'le chemin doit rester sous paquets/ : ' + piege);
  assert.ok(/inconnu\.skanpack$/.test(piege), 'un mois illisible devient « inconnu », il ne voyage pas');
  assert.ok(s.packPathFor(d, '2026-13', new Map()).endsWith(cpath.join('sans-date', 'inconnu.skanpack')), 'un 13e mois n\'existe pas');
  assert.ok(s.packPathFor(d, '2026-08', new Map()).endsWith(cpath.join('2026', '2026-08.skanpack')));
});

t('audit A2 : un mois renvoyé n\'écrase jamais le paquet sur lequel on a déclaré', () => {
  const dir = tmpCab();
  const s = CS.createCabStore(dir);
  const st = cabState();
  s.create('mot-de-passe-long', st);
  const d = cab.newDossier({ name: 'Menuiserie', matricule: '1122334A' });
  st.dossiers.push(d);
  const src1 = cpath.join(dir, 'v1.skanpack'); cfs.writeFileSync(src1, 'la version sur laquelle j\'ai déclaré');
  const src2 = cpath.join(dir, 'v2.skanpack'); cfs.writeFileSync(src2, 'la version rouverte');
  const p1 = s.storePack(src1, d, '2026-08', st.dossiers);
  const p2 = s.storePack(src2, d, '2026-08', st.dossiers);
  assert.notStrictEqual(p1, p2, 'le second ne doit pas réutiliser le nom du premier');
  assert.strictEqual(cfs.readFileSync(p1, 'utf8'), 'la version sur laquelle j\'ai déclaré',
    'sans le premier fichier, le comptable ne peut ni montrer sur quoi il a déclaré, ni rectifier');
  assert.strictEqual(cfs.readFileSync(p2, 'utf8'), 'la version rouverte');
});

t('audit A3 : la copie externe remplace ce qui a changé, au lieu de garder l\'ancien', () => {
  // `cpSync(..., { force: false })` ne remplaçait jamais ce qui existait déjà : sur la clé USB,
  // l'index disait « mars, définitif » pendant que le paquet à côté était la version d'avant.
  const dir = tmpCab();
  const ext = tmpCab();
  const s = CS.createCabStore(dir, { externalDir: ext });
  const st = cabState();
  s.create('mot-de-passe-long', st);
  const d = cab.newDossier({ name: 'Client A', matricule: '1111111A' });
  st.dossiers.push(d);
  const src = cpath.join(dir, 'v1.skanpack');
  cfs.writeFileSync(src, 'version du 8 avril, celle sur laquelle j\'ai déclaré');
  const p1 = s.storePack(src, d, '2026-03', st.dossiers);
  const cible = cpath.join(ext, 'SkanFact Cabinet', 'paquets', 'Client-A', '2026', '2026-03.skanpack');
  assert.strictEqual(cfs.readFileSync(cible, 'utf8'), 'version du 8 avril, celle sur laquelle j\'ai déclaré');

  // Le même fichier change sur le poste (restauration, réorganisation) : le miroir doit suivre.
  cfs.writeFileSync(p1, 'contenu corrigé');
  cfs.utimesSync(p1, new Date(), new Date(Date.now() + 10000));
  assert.strictEqual(s.mirrorExternal({ packs: true }), true);
  assert.strictEqual(cfs.readFileSync(cible, 'utf8'), 'contenu corrigé',
    'une copie qui ne remplace jamais rien est une sauvegarde qui ment');

  // La base aussi.
  st.dossiers[0].note = 'modifiée';
  s.write(st);
  const baseExt = cpath.join(ext, 'SkanFact Cabinet', 'cabinet-data.json');
  assert.strictEqual(cfs.readFileSync(baseExt).length, cfs.readFileSync(s.file).length);
});

t('audit A9 : un paquet dont le fichier a disparu se signale', () => {
  const dir = tmpCab();
  const s = CS.createCabStore(dir);
  const st = cabState();
  s.create('mot-de-passe-long', st);
  const d = cab.newDossier({ name: 'Client', matricule: '2222222B' });
  st.dossiers.push(d);
  const src = cpath.join(dir, 'x.skanpack'); cfs.writeFileSync(src, 'x');
  const p = s.storePack(src, d, '2026-08', st.dossiers);
  d.packs.push({ month: '2026-08', path: p });
  // Déjà à sa place : l'ancien code sortait avant même de regarder si le fichier existait.
  assert.strictEqual(s.reorganize(st).lost, 0);
  cfs.unlinkSync(p);
  assert.strictEqual(s.reorganize(st).lost, 1, 'un paquet à sa place mais disparu doit être compté');
  assert.strictEqual(d.packs[0].missingFile, true, 'et marqué, pour que l\'écran cesse de le dire vert');
});

// ---------- le relais de mise à jour (worker/skanfact-maj.mjs) ----------
// Le relais est un module ES (c'est ce que Cloudflare exécute) : on l'importe de façon asynchrone.
// Ses décisions sont pures et se testent sans réseau — ce sont elles qui décident qui télécharge.
(async () => {
  const W = await import('../worker/skanfact-maj.mjs');

  t('relais : il ne sert que les chemins qu\'il connaît', () => {
    assert.deepStrictEqual(W.route('/app/latest-mac.yml'), { canal: 'app', fichier: 'latest-mac.yml' });
    assert.deepStrictEqual(W.route('/cabinet/cabinet.yml'), { canal: 'cabinet', fichier: 'cabinet.yml' });
    // Tout ce qui sort du cadre est refusé avant même de regarder qui demande.
    [' ', '/', '/app', '/app/x/y', '/autre/latest.yml', '/app/../package.json', '/app/.env',
     '/app/' + 'a'.repeat(200)].forEach(p2 => assert.strictEqual(W.route(p2), null, 'chemin accepté à tort : ' + p2));
  });

  t('relais : un canal ne peut pas réclamer les fichiers de l\'autre', () => {
    // Sans cette règle, l'app du comptable proposerait à ses utilisateurs d'installer l'app
    // entreprise — sans que rien ne plante, ils installeraient juste le mauvais logiciel.
    assert.strictEqual(W.fichierAutorise('app', 'latest-mac.yml'), true);
    assert.strictEqual(W.fichierAutorise('app', 'cabinet-mac.yml'), false);
    assert.strictEqual(W.fichierAutorise('cabinet', 'latest-mac.yml'), false);
    assert.strictEqual(W.fichierAutorise('cabinet', 'cabinet-mac.yml'), true);
    assert.strictEqual(W.fichierAutorise('app', 'SkanFact-6.6.0-mac-universal.zip'), true);
    assert.strictEqual(W.fichierAutorise('app', 'SkanFact-Cabinet-6.6.0-mac-universal.zip'), false, 'préfixe du cabinet servi sur le canal entreprise');
    assert.strictEqual(W.fichierAutorise('cabinet', 'SkanFact-Cabinet-6.6.0-win-x64.exe'), true);
    assert.strictEqual(W.fichierAutorise('cabinet', 'SkanFact-6.6.0-win-x64.exe'), false);
    // Et rien d'autre que des fichiers de release.
    ['README.md', 'package.json', 'skanfact-data.json', 'SkanFact-6.6.0.tar.gz'].forEach(f =>
      assert.strictEqual(W.fichierAutorise('app', f), false, 'fichier servi à tort : ' + f));
  });

  // Le canal bêta (7.25.0). Sans ces trois fichiers dans la table, une installation qui a coché
  // « recevoir les bêtas » demande `beta-mac.yml`, prend un 404, et l'écran répond « aucune version
  // trouvée » : un canal parfaitement muet, sans rien qui dise pourquoi.
  t('relais : le canal bêta appartient à l\'app entreprise, et à elle seule', () => {
    ['beta.yml', 'beta-mac.yml', 'beta-linux.yml'].forEach(f => {
      assert.strictEqual(W.fichierAutorise('app', f), true, 'bêta refusée à l\'app : ' + f);
      // Une bêta d'entreprise servie au comptable lui proposerait d'installer l'autre logiciel.
      assert.strictEqual(W.fichierAutorise('cabinet', f), false, 'bêta de l\'app servie au cabinet : ' + f);
    });
    assert.strictEqual(W.fichierAutorise('app', 'SkanFact-7.26.0-beta.1-mac-universal.zip'), true);
    assert.strictEqual(W.fichierAutorise('app', 'SkanFact-7.26.0-beta.1-win-x64.exe'), true);
    assert.strictEqual(W.fichierAutorise('cabinet', 'SkanFact-7.26.0-beta.1-mac-universal.zip'), false);
  });

  t('relais : le secret se compare à temps constant', () => {
    assert.strictEqual(W.memeSecret('abcdef', 'abcdef'), true);
    assert.strictEqual(W.memeSecret('abcdef', 'abcdeg'), false);
    assert.strictEqual(W.memeSecret('abcdef', 'abcde'), false, 'une longueur différente n\'est jamais égale');
    assert.strictEqual(W.memeSecret('', ''), false, 'un secret vide n\'ouvre rien');
    assert.strictEqual(W.memeSecret(null, undefined), false);
  });

  await ta('relais : qui a le droit de télécharger', async () => {
    const k = lic.generateKeys();
    const cle = lic.signLicence({ nom: 'Menuiserie Trabelsi', exp: '2027-01-01' }, k.privateKey);
    const env = { APP_SECRET: 'phrase-secrete-de-quarante-caracteres-ok', LICENCE_PUBLIC_KEY: k.publicKey };
    const H = o => new Headers(o);
    const bon = { 'x-skanfact-app': env.APP_SECRET };

    // Un inconnu : refusé avant tout le reste.
    assert.strictEqual((await W.autorise(H({}), env)).code, 403);
    assert.strictEqual((await W.autorise(H({ 'x-skanfact-app': 'au hasard' }), env)).code, 403);
    // Le secret seul suffit pendant l'essai et pour l'app du cabinet, qui est gratuite.
    assert.strictEqual((await W.autorise(H(bon), env)).ok, true);
    // Une licence valide passe, et on sait qui c'est.
    const avec = await W.autorise(H({ ...bon, 'x-skanfact-licence': cle }), env);
    assert.strictEqual(avec.ok, true);
    assert.strictEqual(avec.qui, 'Menuiserie Trabelsi');
    // Une licence inventée est un refus : c'est le seul cas où quelqu'un ment.
    assert.strictEqual((await W.autorise(H({ ...bon, 'x-skanfact-licence': 'SKAN1.aa.bb' }), env)).code, 403);
    const autre = lic.signLicence({ nom: 'X' }, lic.generateKeys().privateKey);
    assert.strictEqual((await W.autorise(H({ ...bon, 'x-skanfact-licence': autre }), env)).code, 403, 'licence signée par une autre clé');
    // Un relais SANS clé publique ne peut pas juger : il laisse passer (8.0.0 — sinon chaque client
    // qui a payé était refusé le jour où il collait sa clé). Sauf si la licence est exigée : alors
    // c'est le relais qui est mal réglé, et il le dit (503, pas 403).
    const sansCle = { APP_SECRET: env.APP_SECRET };
    assert.strictEqual((await W.autorise(H({ ...bon, 'x-skanfact-licence': cle }), sansCle, 'app')).ok, true, 'sans clé publique, une licence présentée passe');
    assert.strictEqual((await W.autorise(H({ ...bon, 'x-skanfact-licence': 'SKAN1.aa.bb' }), sansCle, 'app')).ok, true, 'sans clé publique, le relais ne juge rien');
    assert.strictEqual((await W.autorise(H({ ...bon, 'x-skanfact-licence': cle }), { ...sansCle, LICENCE_REQUISE: '1' }, 'app')).code, 503);
    assert.strictEqual((await W.autorise(H({ ...bon, 'x-skanfact-licence': cle }), { ...sansCle, LICENCE_REQUISE: '1' }, 'cabinet')).ok, true, 'le cabinet reste gratuit');
    // Une licence EXPIRÉE reçoit quand même les corrections : on ne prend pas les gens en otage.
    const perimee = lic.signLicence({ nom: 'Y', exp: '2020-01-01' }, k.privateKey);
    assert.strictEqual((await W.autorise(H({ ...bon, 'x-skanfact-licence': perimee }), env)).ok, true);
    // Le jour où le propriétaire l'exige, plus rien ne passe sans licence sur le canal entreprise.
    assert.strictEqual((await W.autorise(H(bon), { ...env, LICENCE_REQUISE: '1' }, 'app')).code, 402);
    // Mais l'app du cabinet est gratuite : elle n'a pas de licence et n'en aura jamais. L'exiger sur
    // son canal couperait les mises à jour de tous les comptables sans que personne ne comprenne.
    const cab = await W.autorise(H(bon), { ...env, LICENCE_REQUISE: '1' }, 'cabinet');
    assert.strictEqual(cab.ok, true, 'le cabinet ne doit jamais être bloqué par LICENCE_REQUISE');
    assert.strictEqual(cab.qui, 'cabinet (gratuit)');
    // Et un canal inconnu ne contourne pas la règle : seul « cabinet » est exempté.
    assert.strictEqual((await W.autorise(H(bon), { ...env, LICENCE_REQUISE: '1' }, 'autre')).code, 402);
    // Relais mal configuré : on le dit, on n'ouvre pas la porte.
    assert.strictEqual((await W.autorise(H(bon), {})).code, 503);
  });

  // Le secret et l'adresse du relais viennent de la construction : jamais du dépôt.
  t('relais : ni l\'adresse ni le secret ne sont dans le code', () => {
    const pkg2 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    assert.ok(!pkg2.updateBase && !pkg2.updateSecret, 'les réglages du relais ne doivent pas être commités');
    const cfg = fs.readFileSync(path.join(__dirname, '..', 'build', 'cabinet.config.js'), 'utf8');
    assert.ok(/process\.env\.UPDATE_BASE/.test(cfg) && /process\.env\.UPDATE_SECRET/.test(cfg));
    const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'release.yml'), 'utf8');
    assert.ok(/secrets\.UPDATE_BASE/.test(wf) && /secrets\.UPDATE_SECRET/.test(wf));
    // Et sans eux, les applications retombent sur l'ancien fonctionnement au lieu de se bloquer.
    [['src', 'main.js'], ['src', 'cabinet', 'main.js']].forEach(parts => {
      const src = fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
      assert.ok(/relayBase\(\)/.test(src), parts.join('/') + ' : pas de repli sans relais');
      assert.ok(/provider: 'github'/.test(src), parts.join('/') + ' : le repli GitHub a disparu');
    });
  });

  // Une panne de mise à jour doit se NOMMER et laisser un recours. Les deux fautes que ce test
  // interdit ont vraiment eu lieu : un `catch` muet qui laissait l'utilisateur devant « Module de
  // mise à jour indisponible. » sans aucune piste, et un écran qui continuait d'affirmer « rien à
  // configurer » alors que plus rien ne pouvait se mettre à jour.
  t('mises à jour : une panne se nomme, et laisse un recours', () => {
    const cas = [
      { parts: ['src', 'main.js'], vue: ['src', 'renderer', 'app.js'] },
      { parts: ['src', 'cabinet', 'main.js'], vue: ['src', 'cabinet', 'renderer', 'app.js'] }
    ];
    cas.forEach(({ parts, vue }) => {
      const nom = parts.join('/');
      const src = fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
      // 1. L'adresse et le secret sont nettoyés : ils arrivent d'un copier-coller dans un formulaire.
      assert.ok(/updateBase \|\| ''\)\.trim\(\)/.test(src), nom + ' : l\'adresse du relais n\'est pas nettoyée');
      assert.ok(/updateSecret \|\| ''\)\.trim\(\)/.test(src), nom + ' : le secret n\'est pas nettoyé');
      // 2. Le module qui ne démarre pas dit POURQUOI (plus de `catch { updater = null; }` muet).
      assert.ok(/updaterError\s*=/.test(src), nom + ' : la cause de la panne est avalée');
      assert.ok(!/catch\s*\{\s*updater = null;?\s*\}/.test(src), nom + ' : catch muet sur le module');
      assert.ok(/updaterUnavailable\(\)/.test(src), nom + ' : le message ne nomme pas la cause');
      // 3. Un relais mal réglé retombe sur GitHub au lieu de laisser l'app sans issue…
      assert.ok(/relayFailure\s*=/.test(src), nom + ' : une panne de relais n\'est pas signalée');
      assert.ok(/new URL\(/.test(src), nom + ' : l\'adresse du relais n\'est jamais validée');
      assert.ok(/relay: !!relayBase\(\) && !relayFailure/.test(src), nom + ' : un relais en panne se déclare encore actif');
      // 4. … et l'écran le dit, pour que le champ jeton revienne.
      const ui = fs.readFileSync(path.join(__dirname, '..', ...vue), 'utf8');
      assert.ok(/relayFailure/.test(ui), vue.join('/') + ' : la panne de relais n\'est pas montrée');
      // 5. Jamais de retour en arrière : installer une version plus ancienne, c'est réinstaller un
      // défaut déjà corrigé. Piège d'electron-updater : affecter `channel` remet allowDowngrade à
      // true — c'est ce qui a fait proposer la 6.7.1 à une application en 6.7.2.
      assert.ok(/allowDowngrade = false/.test(src), nom + ' : le retour en arrière n\'est pas interdit');
      // La règle vaut pour TOUTE affectation de canal, quel que soit le nom de la variable qui
      // porte l'objet : `autoUpdater.channel` dans l'app cabinet, `u.channel` dans l'app entreprise
      // depuis que le canal bêta se pose dans `appliquerCanal(u)`. Chercher la seule forme
      // `autoUpdater.channel` laissait passer la seconde sans un mot.
      // On juge du CODE, pas des commentaires : le commentaire qui EXPLIQUE ce piège nomme les deux
      // lignes côte à côte, et satisfaisait le test à lui tout seul — même faute qu'en 6.8.0, sur
      // le garde-fou « l'app cabinet ne doit rien pouvoir écrire chez un client ».
      const net = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
      assert.ok(net.includes('updaterError') && net.includes('relayBase') && net.length > src.length * 0.5,
        nom + ' : le nettoyage des commentaires a mangé le code');
      const chan = Math.max(net.indexOf('autoUpdater.channel ='), net.indexOf('u.channel ='));
      if (chan >= 0) {
        // Et la remise doit SUIVRE le canal de près, dans le même bloc. Chercher `allowDowngrade`
        // n'importe où plus loin dans le fichier laisserait passer le défaut : il y a toujours un
        // `allowDowngrade = false` posé bien avant, à l'initialisation du module.
        assert.ok(/allowDowngrade/.test(net.slice(chan, chan + 300)),
          nom + ' : allowDowngrade doit être reposé JUSTE APRÈS le canal, qui le rallume en effet de bord');
      }
    });
  });

  // ------------------------------------------------------------------
  // Le canal bêta (7.25.0) : garder la version stable intacte pendant qu'on travaille sur la
  // suivante. Tout tient à UNE source de vérité — le numéro de version — et à un réglage qui
  // n'existe que si quelqu'un l'a demandé.
  t('canal bêta : le numéro de version décide, et rien d\'autre', () => {
    // Une stable est une stable.
    ['7.25.0', '1.0.0', '10.2.33'].forEach(v => {
      assert.strictEqual(core.canalDe(v), 'latest', v + ' pris pour une préversion');
      assert.strictEqual(core.estBeta(v), false, v + ' pris pour une bêta');
    });
    // Une préversion porte le nom de son canal, et c'est ce nom qu'electron-builder met dans le
    // fichier (`beta.yml`). Le lire autrement désaccorderait les deux moitiés du système.
    assert.strictEqual(core.canalDe('7.26.0-beta.1'), 'beta');
    assert.strictEqual(core.canalDe('7.26.0-BETA.2'), 'beta', 'la casse ne doit pas faire un autre canal');
    assert.strictEqual(core.canalDe('8.0.0-alpha.1'), 'alpha');
    assert.strictEqual(core.estBeta('7.26.0-beta.1'), true);
    // `npm version preminor` sans --preid donne `7.26.0-0` : un canal « 0 » n'existe pas, et
    // l'application irait chercher `0-mac.yml`. On refuse de l'appeler autrement que « latest ».
    assert.strictEqual(core.canalDe('7.26.0-0'), 'latest');
    ['', null, undefined, 'dev', 'n\'importe quoi'].forEach(v => assert.strictEqual(core.canalDe(v), 'latest'));
  });

  t('canal bêta : décoché par défaut, et le canal se pose sur les deux chemins', () => {
    const src = lireSource('src', 'main.js');
    // 1. Le réglage n'existe que si quelqu'un l'a posé : `readUpdateCfg().beta` est absent d'une
    // installation neuve, donc faux. Une mise à jour ne met personne sur le canal d'essai.
    assert.ok(/const beta = !!readUpdateCfg\(\)\.beta;/.test(src), 'le canal ne se lit pas dans les réglages');
    assert.ok(/if \(on\) cfg\.beta = true; else delete cfg\.beta;/.test(src), 'décocher ne retire pas le réglage');
    // 2. Sans `allowPrerelease`, le module interroge /releases/latest, qui IGNORE les préversions
    // par construction : la bêta serait publiée et jamais proposée à personne.
    assert.ok(/u\.allowPrerelease = beta;/.test(src), 'les préversions restent invisibles');
    // 3. Le canal se pose sur les DEUX chemins de `configureFeed` : celui sans relais (retour
    // anticipé) et celui avec. Un seul des deux, et la moitié des installations reste sur latest.
    const cf = src.slice(src.indexOf('function configureFeed('), src.indexOf('function notesToText('));
    assert.ok(cf.length > 200 && cf.includes('relayBase()'), 'découpage de configureFeed raté');
    assert.strictEqual((cf.match(/appliquerCanal\(u\)/g) || []).length, 2,
      'le canal doit être posé sur les deux chemins de configureFeed (avec et sans relais)');
    // 4. Changer de canal reconfigure tout de suite : sinon « Vérifier les mises à jour » juste
    // après aurait répondu sur l'ancien canal, c'est-à-dire le contraire de ce qu'on demande.
    const sb = src.slice(src.indexOf("ipcMain.handle('update:setBeta'"));
    assert.ok(/if \(updater\) configureFeed\(updater\)/.test(sb.slice(0, 900)), 'le changement de canal attend le prochain démarrage');
    assert.ok(/updateInfo = null/.test(sb.slice(0, 900)), 'la version repérée sur l\'autre canal reste en mémoire');
  });

  t('canal bêta : l\'écran prévient, prend un filet, et se reconnaît', () => {
    const app = lireApp();
    // La case ne bascule pas en silence : une bêta s'installe par-dessus l'application qui tient
    // la vraie comptabilité. On prévient, on sauvegarde, on n'interdit pas.
    const sb = app.slice(app.indexOf('async function setBeta('), app.indexOf('async function runCheck('));
    assert.ok(sb.length > 300, 'découpage de setBeta raté');
    assert.ok(/await confirmDialog\(/.test(sb), 'la case bascule sans rien dire');
    assert.ok(/createBackup\('avant-beta'\)/.test(sb), 'aucun filet avant d\'armer le canal');
    assert.ok(sb.indexOf('createBackup') < sb.indexOf('updateSetBeta'),
      'la sauvegarde doit être prise AVANT d\'armer le canal, pas après');
    assert.ok(/if \(!ok\) \{ if \(box\) box\.checked = false; return; \}/.test(sb),
      'refuser la question doit décocher la case, sinon elle ment');
    // Et une version d'essai se reconnaît en permanence, sans ouvrir les Paramètres : c'est la
    // seule protection contre « je croyais être sur la stable ».
    assert.ok(/C\.estBeta\(v\.version\)/.test(app), 'le repère « bêta » ne suit pas la version installée');
    const html = lireSource('src', 'renderer', 'index.html');
    assert.ok(/id="beta-tag"[^>]*hidden/.test(html), 'le repère doit être caché tant qu\'on est sur une stable');
  });

  t('canal bêta : la publication est décidée par le numéro, pas par une case', () => {
    const wf = lireSource('.github', 'workflows', 'release.yml');
    // Une préversion se marque « Pre-release » : c'est ce qui laisse /releases/latest pointer sur
    // la dernière STABLE. Sans ça, publier un essai écraserait la version officielle du dépôt.
    assert.ok(/steps\.canal\.outputs\.prerelease == 'true' && 'prerelease' \|\| 'release'/.test(wf),
      'le type de release ne suit pas le numéro de version');
    // Et l'app du comptable ne bouge pas : elle n'a aucune case à décocher, personne ne lui a rien
    // demandé, et sa mise à jour passe par le même fichier `cabinet.yml`.
    const cab = wf.slice(wf.indexOf('Build & publish SkanFact Cabinet'));
    assert.ok(/if: steps\.canal\.outputs\.prerelease != 'true'/.test(cab.slice(0, 400)),
      'une bêta d\'entreprise publierait aussi une bêta du cabinet');
  });

  // ------------------------------------------------------------------
  // Le garde-fou de saisie se pose en TROIS morceaux : déclarer `change`, l'armer au montage, et le
  // passer à `modal()`. Deux d'entre eux ont été posés dans la mauvaise fenêtre par un
  // remplacement de texte trop gourmand : `accuseReception` armait une variable qu'elle n'avait pas
  // déclarée — en mode strict, c'est une ReferenceError, et la fenêtre s'ouvrait avec AUCUN bouton
  // branché — pendant que `writeRelance`, la fenêtre nommée dans le constat, n'avait rien du tout.
  // Le détecteur d'appels inexistants ne pouvait pas le voir : ce n'est pas un appel.
  t('cabinet : le garde-fou de saisie est posé en entier, ou pas du tout', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'renderer', 'app.js'), 'utf8');
    assert.ok(/'use strict'/.test(src), 'le fichier n\'est plus en mode strict : une variable non déclarée passerait');
    // On découpe par fonction de premier niveau et on compte les trois morceaux dans chacune.
    const noms = [...src.matchAll(/\n  (?:async )?function ([A-Za-z_$][\w$]*)\s*\(/g)].map(m => ({ nom: m[1], a: m.index }));
    noms.forEach((f, i) => { f.corps = src.slice(f.a, i + 1 < noms.length ? noms[i + 1].a : src.length); });
    let poses = 0;
    for (const f of noms) {
      const declare = /let change = \(\) => false;/.test(f.corps);
      const arme = /change = suivreSaisie\(layer\);/.test(f.corps);
      const passe = /garde: \(\) => change\(\)/.test(f.corps);
      if (!declare && !arme && !passe) continue;            // cette fenêtre n'en a pas : c'est permis
      poses++;
      assert.ok(declare, `${f.nom} arme le garde-fou sans déclarer « change » : ReferenceError à l'ouverture`);
      assert.ok(arme, `${f.nom} déclare « change » sans jamais l'armer : le garde-fou répond toujours « rien n'a changé »`);
      assert.ok(passe, `${f.nom} arme le garde-fou sans le donner à modal() : Échap jette la saisie quand même`);
    }
    assert.ok(poses >= 4, `seules ${poses} fenêtres ont un garde-fou de saisie : il en faut au moins quatre`);
  });

  // ------------------------------------------------------------------
  // audit G6 / G7 : les couches du cabinet. Même règle que la 5.2.2 côté entreprise, jamais portée
  // ici. Un bouton parfaitement visible peut être inerte, et rien n'apparaît dans aucune console.
  t('audit G6/G7 : Échap ne ferme que la fenêtre du dessus, Entrée valide, Cmd+K attend son tour', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'renderer', 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'style.css'), 'utf8');
    const zIndex = sel => {
      const m = css.match(new RegExp(sel.replace(/[.#]/g, '\\$&') + '[^{]*\\{[^}]*?z-index:\\s*(\\d+)'));
      assert.ok(m, `z-index introuvable pour ${sel}`);
      return Number(m[1]);
    };
    const modale = zIndex('.modal-bg');

    // G6 — Échap : l'écouteur est posé sur `document`, donc stopPropagation n'arrête pas celui des
    // autres fenêtres. La seule parade est de ne rien faire quand on n'est pas la couche du dessus.
    const corps = src.slice(src.indexOf('function modal('), src.indexOf('function confirmDialog('));
    assert.ok(corps, 'modal() introuvable dans le renderer du cabinet');
    assert.ok(/layer !== root\.lastElementChild/.test(corps),
      'Échap ferme toutes les fenêtres empilées d\'un coup : le garde de couche manque');
    // G6 — Entrée valide le bouton principal, sauf dans une zone de texte.
    assert.ok(/e\.key !== 'Enter'/.test(corps), 'aucun gestionnaire d\'Entrée dans les fenêtres du cabinet');
    assert.ok(/TEXTAREA/.test(corps), 'Entrée ne doit pas valider depuis une zone de texte');
    assert.ok(/\.modal-actions \.btn-primary, \.modal-actions \.btn-danger/.test(corps),
      'Entrée doit déclencher le bouton principal de la fenêtre');
    // G6 — le focus va à un champ de saisie, pas au bouton « Annuler ».
    assert.ok(/input:not\(\[type=hidden\]\)/.test(corps),
      'le focus se pose encore sur le premier élément venu — dans une confirmation, « Annuler »');
    // Et les couches empilées partent de la même base que la feuille de style.
    const base = corps.match(/layer\.style\.zIndex = String\((\d+) \+ root\.children\.length\)/);
    assert.ok(base, 'base d\'empilement introuvable dans le renderer du cabinet');
    assert.strictEqual(Number(base[1]), modale, 'le cabinet et style.css ne partent pas de la même couche');

    // G7 — la palette ne doit jamais s'ouvrir sous une fenêtre : elle prendrait le clavier sans
    // rien montrer. `#palette-root` est à 60, sous tout le reste.
    ['#setup', '#lock-screen', '#palette-root'].forEach(sel =>
      assert.ok(zIndex(sel) < modale, `${sel} (${zIndex(sel)}) couvre les fenêtres modales (${modale})`));
    const garde = src.slice(src.indexOf('function palettePossible('), src.indexOf('function openPalette('));
    assert.ok(garde, 'aucun garde avant l\'ouverture de la palette');
    ['#palette-root', '#modal-root', '#setup', '#lock-screen'].forEach(sel =>
      assert.ok(garde.includes(sel), `la palette peut encore s'ouvrir par-dessus ${sel}`));
    assert.ok(/if \(!palettePossible\(\)\) return;/.test(src), 'openPalette n\'utilise pas son garde');
    // G7, l'autre sens. Le garde ci-dessus empêche la palette de passer sous une fenêtre ; rien
    // n'empêchait une fenêtre de passer au-dessus d'elle. Le menu reste actif pendant que la palette
    // est ouverte (Cmd+O, Cmd+N, Cmd+S) et un paquet double-cliqué dans le Finder ouvre aussi une
    // fenêtre. La palette écoute en phase de CAPTURE : restée dessous, elle garde le clavier —
    // Échap la ferme sans rien montrer, Entrée lance une recherche au lieu de valider.
    assert.ok(/document\.addEventListener\('keydown', onKey, true\);/.test(src),
      'la palette n\'écoute plus en capture : ce garde est à relire');
    assert.ok(/fermerPalette = close;/.test(src) && /fermerPalette = null;/.test(src),
      'rien ne permet de refermer la palette depuis l\'extérieur');
    assert.ok(/if \(fermerPalette\) fermerPalette\(\);/.test(corps),
      'une fenêtre peut encore s\'ouvrir par-dessus la palette, qui lui vole alors le clavier');
  });

  // ------------------------------------------------------------------
  // audit B8 : un compteur et la liste qu'il annonce viennent de la même fonction.
  t('audit B8 : le bandeau des relances compte exactement les lignes du tableau', () => {
    const cab = require('../src/cabinet/cabcore.js');
    const jour = '2026-09-20'; // après le jour de relance
    const mk = (nom, mf, packs) => ({
      id: 'MF:' + mf, name: nom, matricule: mf, email: 'x@example.tn', packs,
      from: '2026-05', relances: []
    });
    const p = (m, definitif) => ({
      month: m, label: cab.monthLabel(m), definitive: definitif,
      receivedAt: Date.parse(cab.addMonth(m, 1) + '-06T09:30:00Z'),
      generatedAt: cab.addMonth(m, 1) + '-06T08:15:00.000Z',
      files: 3, missing: [], absent: 0, digest: '', bytes: 1000, path: '', sealed: true
    });
    // Trois dossiers : un à jour, un à qui il manque des mois, un qui n'a envoyé que du provisoire.
    const S = cab.migrate({
      cabinet: { name: 'Cabinet Essai' },
      settings: { relanceDay: 10 },
      dossiers: [
        mk('À jour', '1111111A', ['2026-05', '2026-06', '2026-07', '2026-08'].map(m => p(m, true))),
        mk('Il manque', '2222222B', [p('2026-05', true)]),
        mk('Provisoire', '3333333C', ['2026-05', '2026-06', '2026-07'].map(m => p(m, true)).concat([p('2026-08', false)]))
      ]
    });
    const rows = cab.relanceRows(S, jour);
    const rel = cab.relanceDue(S, jour);
    assert.strictEqual(rel.total, rows.length,
      'le bandeau annonce ' + rel.total + ' dossiers au-dessus d\'un tableau de ' + rows.length + ' lignes');
    assert.strictEqual(rel.count + rel.provisoires, rel.total, 'les deux motifs ne couvrent pas le total');
    assert.strictEqual(rel.count, 1, 'un seul dossier a des mois manquants');
    assert.strictEqual(rel.provisoires, 1, 'un seul dossier n\'a que du provisoire');
    // Et « À faire » compte la même chose que la pastille et que la page.
    const todo = cab.cabinetTodo(S, jour).find(x => x.id === 'jour-de-relance');
    assert.ok(todo, 'le jour de relance ne remonte pas dans « À faire »');
    assert.strictEqual(todo.count, rows.length, '« À faire » et la page Relances donnent deux nombres différents');
  });

  // ------------------------------------------------------------------
  // audit B9 : un paquet se fabrique APRÈS le mois qu'il couvre.
  // L'exemple datait chaque envoi du 8 du mois lui-même : « août, définitif,
  // reçu le 08/08 ». C'est le premier écran qu'un comptable voit, et il dément
  // la promesse centrale du produit (définitif = mois clôturé).
  t('audit B9 : dans l\'exemple, aucun paquet n\'est reçu avant la fin de son mois', () => {
    const cab = require('../src/cabinet/cabcore.js');
    let paquets = 0;
    const jours = ['2026-09-12', '2026-09-01', '2026-01-31', '2026-03-01', '2026-12-31'];
    for (const jour of jours) {
      for (const d of cab.demoDossiers(jour)) {
        for (const p of d.packs) {
          paquets++;
          const finDuMois = Date.parse(cab.addMonth(p.month, 1) + '-01T00:00:00Z');
          assert.ok(p.receivedAt >= finDuMois,
            `${d.name} : ${p.month} reçu le ${new Date(p.receivedAt).toISOString().slice(0, 10)}, avant la fin du mois`);
          assert.ok(p.receivedAt <= Date.parse(jour + 'T23:59:59Z'),
            `${d.name} : ${p.month} reçu dans le futur (${new Date(p.receivedAt).toISOString().slice(0, 10)} alors qu'on est le ${jour})`);
          assert.ok(Date.parse(p.generatedAt) <= p.receivedAt,
            `${d.name} : ${p.month} fabriqué après avoir été reçu`);
        }
      }
    }
    assert.ok(paquets >= 50, 'le jeu d\'exemple a maigri : ' + paquets + ' paquets vérifiés');
    // Les cinq dossiers ne doivent pas tous avoir envoyé à la même minute.
    const heures = new Set(cab.demoDossiers('2026-06-20').map(d => d.packs[0].receivedAt));
    assert.ok(heures.size >= 3, 'tous les clients de l\'exemple envoient le même jour à la même minute');
  });

  // ------------------------------------------------------------------
  // audit H10 : une icône de fichier déclarée doit vraiment en être une.
  // electron-builder ne CONVERTIT pas : il échange `.ico` et `.icns` selon la
  // plateforme. Un chemin en `.png` ressort inchangé, s'installe tel quel là où
  // macOS attend un `.icns`, et rien ne le signale — le comptable voit un
  // fichier blanc générique. Ce test rejoue la résolution d'electron-builder.
  t('audit H10 : les icônes de .skanpack et .skanrecover existent vraiment', () => {
    const cfg = require('../build/cabinet.config.js');
    const { getPlatformIconFileName } = require('builder-util');
    const assoc = cfg.fileAssociations || [];
    assert.ok(assoc.length >= 2, 'les associations de fichiers ont disparu de la configuration');
    for (const fa of assoc) {
      assert.ok(fa.icon, `.${fa.ext} : aucune icône déclarée`);
      for (const [plateforme, estMac] of [['macOS', true], ['Windows', false]]) {
        const attendu = getPlatformIconFileName(fa.icon, estMac);
        const ext = path.extname(attendu).toLowerCase();
        assert.strictEqual(ext, estMac ? '.icns' : '.ico',
          `.${fa.ext} sous ${plateforme} : electron-builder installerait « ${attendu} », `
          + 'qui n\'est pas une icône. Déclare l\'icône SANS extension (icon: \'skanpack\').');
        // Résolu comme le fait getResource() : d'abord dans build/, puis à la racine.
        const existe = fs.existsSync(path.join(__dirname, '..', 'build', attendu))
          || fs.existsSync(path.join(__dirname, '..', attendu));
        assert.ok(existe,
          `.${fa.ext} sous ${plateforme} : « ${attendu} » est introuvable. `
          + 'electron-builder refusera de construire. Lance « node scripts/icones.js » et commite le résultat.');
      }
    }
  });

  // ---------- 7.0.0 : les modules et la barre latérale ----------

  // Ce que ce test protège (7.12.0) : « quand je décoche, ça disparaît pas du menu et je peux pas le
  // recocher ». Un module qui CONTENAIT quelque chose se rallumait tout seul à chaque calcul, au nom
  // de « on ne masque pas ce que tu as saisi » — donc décocher sa case la transformait en cadenas
  // sous le doigt, sans rien changer au menu. Le choix fait foi ; le filet, lui, est un ÉVÉNEMENT :
  // le module revient le jour où on y enregistre quelque chose, et l'application le dit.
  t('modules : une case décochée se recoche, et un module masqué revient quand on y écrit', () => {
    const vide = { ...core.DEFAULT_DATA, company: { ...core.DEFAULT_COMPANY, modules: ['ventes', 'fichiers', 'compta'] },
      purchases: [], suppliers: [], employees: [], payslips: [], assets: [], catalog: [], serials: [], stockAdjustments: [],
      accounts: [], movements: [], projects: [], documents: [], recurring: [] };
    // Rien de saisi : les modules non choisis ne sont pas dans le menu.
    assert.strictEqual(core.moduleOn(vide, 'achats'), false, 'un module non choisi et vide reste hors du menu');
    assert.strictEqual(core.moduleOn(vide, 'paie'), false);
    assert.strictEqual(core.moduleOn(vide, 'immos'), false);

    // Rempli mais masqué : il RESTE masqué. C'est ce qui rend la case à cocher utilisable.
    const avec = { ...vide, purchases: [{ id: 'p1', lines: [] }] };
    assert.strictEqual(core.moduleOn(avec, 'achats'), false,
      'un module masqué qui contient quelque chose se rallume tout seul : la case redevient un piège');
    assert.strictEqual(core.moduleWhy(avec, 'achats'), 'masque');
    assert.strictEqual(core.moduleCount(avec, 'achats'), 1);

    // Le filet. Masquer un module plein ne le ramène pas : les compteurs n'ont pas bougé.
    const reference = core.moduleCounts(avec);
    assert.deepStrictEqual(core.modulesRevenus(avec, reference), [],
      'masquer un module déjà plein le ferait revenir aussitôt');
    // Y enregistrer quelque chose de NOUVEAU le ramène, lui et lui seul.
    const apres = { ...avec, purchases: avec.purchases.concat([{ id: 'p2', lines: [] }]) };
    assert.deepStrictEqual(core.modulesRevenus(apres, reference), ['achats'],
      'un module masqué dans lequel on vient d\'écrire doit revenir dans le menu');
    // Et le garde-fou est par module, pas global.
    assert.strictEqual(core.moduleOn(apres, 'paie'), false);
    // Sans choix enregistré, il n'y a rien à ramener : tout est déjà affiché.
    const tout = { ...apres, company: { ...core.DEFAULT_COMPANY } };
    delete tout.company.modules;
    assert.deepStrictEqual(core.modulesRevenus(tout, {}), []);

    // Chaque module masquable sait se compter, sinon le filet ne le rattrape jamais.
    core.MODULES.filter(m => !m.toujours).forEach(m =>
      assert.strictEqual(typeof m.compte, 'function', `le module « ${m.id} » n'a pas de compteur : masqué, il ne reviendrait jamais`));
  });

  t('modules : l\'écran offre une case à tout ce qui n\'est pas le cœur, et prévient avant de masquer du plein', () => {
    const brut = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const app = brut.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(app.includes('routes.modules'), 'le nettoyage des commentaires a mangé le code');
    const page = app.slice(app.indexOf('routes.modules = () =>'), app.indexOf('let aideQ'));
    assert.ok(page.length > 500, 'la page « Tous les modules » est introuvable');

    // Le cadenas ne doit dépendre QUE du cœur du métier. Toute autre condition (« il est rempli »)
    // ramène le piège : la case disparaît au moment précis où on s'en sert.
    assert.ok(/\$\{m\.toujours\s*\n?\s*\? `<span class="mod-lock"/.test(page),
      'la case à cocher est retirée pour autre chose que le cœur du métier');
    assert.ok(!/fige/.test(page), 'une condition « figé » subsiste : elle peut encore enlever la case sous le doigt');

    // Masquer un module qui contient quelque chose se confirme, et un refus REMET la case.
    assert.ok(/if \(!cb\.checked && n\) \{[\s\S]{0,600}?await confirmDialog\(/.test(page),
      'décocher un module plein ne demande rien');
    assert.ok(/if \(!ok\) \{ cb\.checked = true; return; \}/.test(page),
      'refuser la question laisse la case décochée : l\'écran ne dit plus la vérité');

    // Et la page ne promet plus ce qui n'est plus vrai.
    assert.ok(!/reste affiché quoi qu'il arrive/.test(page), 'la page promet encore qu\'un module rempli ne peut pas être masqué');
    assert.ok(/revient tout seul/.test(page), 'la page ne dit pas ce qui ramène un module masqué');
  });

  t('modules : le cœur du métier ne se masque pas, et une installation existante ne perd rien', () => {
    const choisi = { ...core.DEFAULT_DATA, company: { ...core.DEFAULT_COMPANY, modules: [] } };
    ['ventes', 'fichiers', 'compta'].forEach(id => {
      assert.strictEqual(core.moduleOn(choisi, id), true, `« ${id} » doit rester affiché quoi qu'il arrive`);
      assert.strictEqual(core.moduleWhy(choisi, id), 'coeur');
    });
    // `modules` absent (toutes les installations d'avant la 7.0.0) = toute l'application, comme avant.
    const ancien = { ...core.DEFAULT_DATA, company: { ...core.DEFAULT_COMPANY } };
    delete ancien.company.modules;
    core.MODULES.forEach(m => assert.strictEqual(core.moduleOn(ancien, m.id), true,
      `sans réglage enregistré, « ${m.id} » doit s'afficher : une mise à jour ne fait disparaître aucune page`));
    assert.strictEqual(core.DEFAULT_COMPANY.modules, null, 'la valeur par défaut doit être « aucun choix », pas une liste');
  });

  t('barre latérale : chaque page a son icône, et Paramètres et Aide ne défilent pas', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    // Les commentaires HTML sont retirés avant de juger : sans ça, un lien mis en commentaire — donc
    // inerte — satisfaisait le test. C'est la même faute que celle attrapée en 6.8.0 côté cabinet, et
    // je l'ai refaite ici : elle s'est vue en essayant de faire échouer le test exprès.
    const brut = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
    const html = brut.replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(html.includes('sidebar-foot') && html.includes('<nav id="nav">'),
      'le nettoyage des commentaires a mangé le code : le test ne prouve plus rien');

    // Toutes les pages du menu doivent avoir un dessin, sinon elles portent l'icône de secours.
    const icones = app.slice(app.indexOf('const ICONES = {'), app.indexOf('const icone ='));
    core.PAGES.filter(p => !p.pied).forEach(p =>
      assert.ok(new RegExp(`\\b${p.id}:`).test(icones), `la page « ${p.id} » n'a pas d'icône dans ICONES`));

    // Le fond du problème de la 6.8.2 : `nav` défile, le pied non. Les deux liens dont un débutant a
    // besoin quand il est perdu doivent vivre dans le pied. Test prouvé en les remettant dans nav.
    const pied = html.slice(html.indexOf('<div class="sidebar-foot">'), html.indexOf('</aside>'));
    ['parametres', 'aide'].forEach(r =>
      assert.ok(pied.includes(`data-route="${r}"`), `« ${r} » doit être dans .sidebar-foot : nav défile, le pied non`));
    // Et ils ne doivent PAS être dessinés une seconde fois dans nav, sinon on a deux liens actifs.
    assert.ok(!core.PAGES.some(p => p.pied && !p.horsMenu && core.navPages(core.DEFAULT_DATA).some(q => q.id === p.id)),
      'Paramètres et Aide ne doivent pas être redessinés dans nav');

    // Le titre de la fenêtre se lisait dans le TEXTE du lien de la barre : un module masqué n'a plus
    // de lien, et la fenêtre perdait son nom. Il doit venir des données.
    assert.ok(!/nav a\[data-route="\$\{name\}"\]/.test(app),
      'setWindowTitle ne doit plus lire le titre dans le DOM de la barre latérale');
    core.PAGES.forEach(p => assert.ok(core.pageTitle(p.id), `« ${p.id} » n'a pas de titre`));

    // La classe active doit couvrir les liens du pied, sinon Paramètres et Aide ne se marquent jamais.
    assert.ok(/\$\$\('nav a, \.sidebar-foot a'\)/.test(app),
      'le marquage de la page courante doit inclure les liens du pied');
  });

  t('barre latérale : tout ce que la palette propose reste atteignable', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    // Filtrer le menu n'est acceptable QUE parce que la palette liste tout. Si une page du menu
    // disparaissait de la palette, la masquer reviendrait à la supprimer.
    const palette = app.slice(app.indexOf('function openPalette()'), app.indexOf('const closeMenus ='));
    core.PAGES.filter(p => !p.horsMenu).forEach(p =>
      assert.ok(palette.includes(`navigate('#/${p.id}`), `la page « ${p.id} » n'est pas dans la palette`));
    assert.ok(palette.includes("navigate('#/modules')"), 'la palette doit mener à « Tous les modules »');
    // Et la page qui permet de tout réafficher doit exister.
    assert.ok(/routes\.modules\s*=/.test(app), 'la page « Tous les modules » doit exister');
  });

  t('À faire : aucun bouton ne mène nulle part', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'core.js'), 'utf8');

    // Tout ce que `todoList` sait produire. On lit la source plutôt que d'exécuter la fonction :
    // il faudrait fabriquer vingt-deux situations différentes pour les faire toutes apparaître, et
    // c'est précisément parce que personne ne les voit toutes à la fois que treize d'entre elles
    // ont pu rester sans action pendant des mois.
    const bloc = src.slice(src.indexOf('function todoList'), src.indexOf('function companyGaps'));
    assert.ok(bloc.length > 2000, 'le découpage de todoList a raté : le test ne prouve rien');
    const produits = [...new Set([...bloc.matchAll(/id: '([a-z0-9-]+)'/g)].map(m => m[1]))];
    assert.ok(produits.length >= 20, `todoList ne produit que ${produits.length} lignes : découpage suspect`);

    // Toutes celles qui sont branchées.
    const depart = app.indexOf('const TODO_ACTIONS = {');
    assert.ok(depart > 0, 'TODO_ACTIONS introuvable');
    const actions = app.slice(depart, app.indexOf('\n  };', depart));
    const armes = [...new Set([...actions.matchAll(/^\s{4}'?([a-z0-9-]+)'?:\s*\{/gm)].map(m => m[1]))];

    const orphelines = produits.filter(id => !armes.includes(id));
    assert.deepStrictEqual(orphelines, [],
      `ces lignes de « À faire » afficheraient un bouton qui ne fait rien au clic : ${orphelines.join(', ')}. `
      + 'Ajoute-leur une entrée dans TODO_ACTIONS — un bouton muet est pire qu\'un bouton absent.');

    // Et l'inverse : une action pour une ligne qui n'existe plus est du code mort qui trompe la lecture.
    const mortes = armes.filter(id => !produits.includes(id));
    assert.deepStrictEqual(mortes, [], `TODO_ACTIONS arme des lignes que todoList ne produit plus : ${mortes.join(', ')}`);

    // Le filet : même sans action, le clic doit parler au lieu de se taire.
    assert.ok(/Cette ligne n'a pas encore d'écran dédié/.test(app),
      'bindTodo doit dire quelque chose quand une action manque, au lieu d\'avaler le clic');
  });

  t('« Tout effacer » efface tout, y compris les modules ajoutés demain', () => {
    const demo = require('../src/renderer/demo.js');
    // On part du jeu d'exemple : c'est le seul moyen simple d'avoir les trente listes remplies.
    const d = demo.buildDemoData({ ...core.DEFAULT_COMPANY }, '2026-09-12');
    const remplies = Object.keys(core.DEFAULT_DATA)
      .filter(k => Array.isArray(d[k]) ? d[k].length : (d[k] && typeof d[k] === 'object' ? Object.keys(d[k]).length : false));
    assert.ok(remplies.length >= 15, `l'exemple ne remplit que ${remplies.length} listes : le test ne prouve pas grand-chose`);

    core.wipeData(d, { garderSociete: true });
    const restes = Object.keys(core.DEFAULT_DATA)
      .filter(k => k !== 'company' && k !== 'version')
      .filter(k => Array.isArray(d[k]) ? d[k].length : (d[k] && typeof d[k] === 'object' ? Object.keys(d[k]).length : d[k]));
    assert.deepStrictEqual(restes, [],
      `ces données survivent à « Tout effacer » : ${restes.join(', ')}. `
      + 'La liste se déduit de DEFAULT_DATA justement pour qu\'un module ajouté demain soit vidé sans y penser.');
    assert.strictEqual(d.closedUntil, '', 'la clôture doit repartir à zéro');
    assert.strictEqual(d.demo, false, 'les données effacées ne sont plus le jeu d\'exemple');
  });

  t('l\'exemple ne laisse jamais sa fausse identité servir à une vraie facture', () => {
    const demo = require('../src/renderer/demo.js');

    // Cas qui fait mal : charger l'exemple AVANT d'avoir rempli sa fiche — ce que fait un débutant.
    const sansFiche = demo.buildDemoData({ ...core.DEFAULT_COMPANY }, '2026-09-12');
    assert.ok(/DÉMO/.test(sansFiche.company.name), 'l\'exemple doit bien fournir une société de démonstration');
    assert.strictEqual(sansFiche.company.demo, true, 'l\'identité empruntée doit être marquée comme telle');
    assert.strictEqual(core.estDemo(sansFiche), true);
    // Effacer emporte alors la fausse identité : sinon la première vraie facture part avec un
    // matricule inventé et un RIB qui n'existe pas, et le client vire l'argent dans le vide.
    core.wipeData(sansFiche, { garderSociete: !sansFiche.company.demo });
    assert.strictEqual(sansFiche.company.name, '', 'la fausse raison sociale doit partir');
    assert.strictEqual(sansFiche.company.matricule, '', 'le faux matricule doit partir');
    assert.strictEqual(sansFiche.company.rib, '', 'le faux RIB doit partir');

    // Cas normal : sa fiche est remplie, l'exemple ne la touche pas et l'effacement la garde.
    const sienne = { ...core.DEFAULT_COMPANY, name: 'Atelier Ben Salah SUARL', matricule: '9876543Z/A/P/000', rib: '08 006 000 42' };
    const avecFiche = demo.buildDemoData(sienne, '2026-09-12');
    assert.strictEqual(avecFiche.company.name, 'Atelier Ben Salah SUARL');
    assert.strictEqual(avecFiche.company.demo, false, 'son identité à lui n\'est pas une identité empruntée');
    core.wipeData(avecFiche, { garderSociete: !avecFiche.company.demo });
    assert.strictEqual(avecFiche.company.name, 'Atelier Ben Salah SUARL', 'on ne jette pas l\'identité de quelqu\'un en effaçant des factures');
    assert.strictEqual(avecFiche.company.matricule, '9876543Z/A/P/000');
    assert.ok(!('demo' in avecFiche.company), 'la marque d\'emprunt doit disparaître une fois l\'exemple effacé');
  });

  t('les mots : une bulle mène à son article, et un en-tête de colonne peut en porter une', () => {
    const guide = require('../src/renderer/guide.js');
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const ids = new Set(guide.ARTICLES.map(a => a.id));

    // Une bulle qui renvoie à un article disparu serait un lien mort — et personne ne le verrait,
    // puisqu'il faut cliquer la bulle pour le découvrir.
    const reliees = Object.entries(guide.INFO).filter(([, v]) => v.a);
    assert.ok(reliees.length >= 10, `seulement ${reliees.length} bulles mènent à un article`);
    reliees.forEach(([cle, v]) => assert.ok(ids.has(v.a),
      `la bulle « ${cle} » renvoie à l'article « ${v.a} », qui n'existe pas`));
    assert.ok(/ip-more/.test(app), 'openInfoPop doit afficher le lien vers l\'article');

    // Les abréviations vivent dans les en-têtes de colonnes ; c'était le seul endroit de
    // l'application où l'on ne pouvait pas poser de bulle.
    assert.ok(/c\.info \? info\(c\.info\)/.test(app), 'sortHead doit savoir rendre la bulle d\'une colonne');
    // Et cliquer cette bulle ne doit pas trier la colonne au passage : la liste sauterait sous les
    // yeux de quelqu'un qui voulait seulement lire une définition.
    assert.ok(/e\.target\.closest\('\.i\[data-info\]'\)\) return;/.test(app),
      'bindSort doit ignorer un clic sur la bulle de l\'en-tête');

    // La recherche de l'aide doit lire le CORPS des articles : un mot comme « assiette »
    // n'apparaît dans aucun des trente-deux titres.
    assert.ok(/sansBalises\(a\.body\)/.test(app), 'la recherche de l\'aide doit lire le corps des articles');
    const glossaire = guide.ARTICLES.find(a => a.id === 'vocabulaire');
    assert.ok(glossaire, 'le glossaire doit exister');

    // Le glossaire s'était arrêté à la 2.0 : seize mots de vente, et pas un seul des quinze modules
    // ajoutés depuis. Quelqu'un qui butait sur « VNC » le consultait, ne trouvait rien, et n'y
    // revenait plus. Chaque mot ci-dessous est affiché quelque part dans l'interface ; s'il n'est
    // pas défini, le glossaire ment par omission.
    const AFFICHES = [
      'VNC', 'amortissement', 'dotation', 'prorata', 'immobilisation', 'exercice',
      'TVA déductible', 'TVA collectée', 'crédit de TVA', 'coût moyen pondéré', 'inventaire',
      'numéro de série', 'marge', 'affaire', 'charge fixe', 'charge variable',
      'seuil de rentabilité', 'rapprochement', 'brut', 'net', 'coût employeur', 'assiette',
      'CNSS', 'IRPP', 'écriture comptable', 'partie double', 'plan de comptes',
      'clôturer', 'paquet mensuel', 'provisoire', 'empreinte', 'proforma', 'bon de livraison'
    ];
    const corps = glossaire.body.toLowerCase();
    const absents = AFFICHES.filter(m => !corps.includes(m.toLowerCase()));
    assert.deepStrictEqual(absents, [],
      `ces mots s'affichent dans l'application et ne sont définis nulle part : ${absents.join(', ')}`);
    assert.ok((glossaire.body.match(/<dt>/g) || []).length >= 50,
      'le glossaire doit couvrir tous les modules, pas seulement la vente');
  });

  // La devise de l'entreprise se réglait dans un champ de TEXTE LIBRE, alors que l'éditeur et la
  // fiche client n'offrent que sept codes depuis la 2.4.0. Le nombre de décimales ne reconnaît que
  // 'DT' et 'TND' : « dinar », « TN » ou une faute de frappe passaient toutes les factures à deux
  // décimales sur des montants en millimes, sans un mot.
  t('la devise de l\'entreprise est une liste fermée, et ce qui a été tapé se rattrape', () => {
    assert.strictEqual(core.normCurrency('TND'), 'DT');
    assert.strictEqual(core.normCurrency(' dt '), 'DT');
    assert.strictEqual(core.normCurrency('Dinar'), 'DT');
    assert.strictEqual(core.normCurrency('€'), 'EUR');
    assert.strictEqual(core.normCurrency('eur'), 'EUR');
    assert.strictEqual(core.normCurrency(''), 'DT', 'une devise vide vaut le dinar, jamais la chaîne vide');
    assert.strictEqual(core.normCurrency('Yen'), 'DT', 'une devise inconnue retombe sur le dinar');
    core.CURRENCIES.forEach(c => assert.strictEqual(core.normCurrency(c), c, c + ' doit se conserver'));
    // Les décimales suivent : trois pour le dinar, deux pour le reste. C'est tout l'enjeu.
    assert.strictEqual(core.decimalsFor(core.normCurrency('TND')), 3);
    assert.strictEqual(core.decimalsFor(core.normCurrency('Dinar')), 3);
    // La migration rattrape l'existant, et l'écran ne laisse plus rien taper.
    assert.strictEqual(core.migrateData({ company: { currency: 'TND' } }).company.currency, 'DT');
    const app = lireApp();
    const page = app.slice(app.indexOf('routes.parametres = async () =>'), app.indexOf('function drawCabinetPair'));
    assert.ok(!/'currency', c\.currency/.test(page), 'la devise est encore un champ de texte libre dans les Paramètres');
    assert.ok(/<select name="currency">\$\{C\.CURRENCIES\.map/.test(page), 'la devise n\'est pas une liste dans les Paramètres');
    assert.ok(!/'currency', a\.currency, 'text'/.test(app), 'la devise est encore un champ libre dans l\'assistant');
    assert.ok(/data\.company\.currency = C\.normCurrency\(/.test(page), 'la devise enregistrée n\'est pas normalisée');
  });

  t('devise : le timbre vaut un DINAR, et un taux absent ne passe plus en silence', () => {
    const co = { ...core.DEFAULT_COMPANY, stampFee: 1, currency: 'DT' };
    const lignes = [{ label: 'Prestation', qty: 1, unitPrice: 1000, vatRate: 19 }];

    // Le timbre fiscal est un montant fixé en dinars par l'État, pas un nombre sans unité. Ajouté tel
    // quel sur une facture en euros, il valait 1 € — soit 3,4 fois le timbre dû.
    const eur = core.computeTotals({ type: 'facture', currency: 'EUR', exchangeRate: 3.4, lines: lignes }, co);
    assert.strictEqual(core.round3(eur.stamp * 3.4), 1,
      `le timbre d'une facture en EUR vaut ${eur.stamp} €, soit ${core.round3(eur.stamp * 3.4)} DT au lieu de 1,000 DT`);
    // Et il ne bouge pas dans la devise de l'entreprise, qui est le cas de presque toutes les factures.
    assert.strictEqual(core.computeTotals({ type: 'facture', currency: 'DT', lines: lignes }, co).stamp, 1);
    // Un devis n'a jamais de timbre, dans aucune devise.
    assert.strictEqual(core.computeTotals({ type: 'devis', currency: 'EUR', exchangeRate: 3.4, lines: lignes }, co).stamp, 0);

    // Le taux absent : le repli à 1 évite un écran cassé, mais il fait compter 1 EUR = 1 DT partout.
    // Rien ne le montrait.
    const sansTaux = { id: 'd1', type: 'facture', currency: 'EUR', date: '2026-05-10', status: 'envoyée', number: 'FAC-2026-009', lines: lignes };
    assert.strictEqual(core.missingRate(sansTaux, co), true);
    assert.strictEqual(core.missingRate({ type: 'facture', currency: 'DT', lines: [] }, co), false, 'la devise de l\'entreprise n\'a pas besoin de taux');
    assert.strictEqual(core.missingRate({ type: 'facture', lines: [] }, co), false, 'une pièce sans devise déclarée suit celle de l\'entreprise');
    assert.strictEqual(core.missingRate({ type: 'facture', currency: 'EUR', exchangeRate: 3.4, lines: [] }, co), false);
    assert.strictEqual(core.rateOf(sansTaux, co), 1, 'le repli existe pour ne rien faire planter');

    // Et « À faire » le remonte en rouge : les pièces déjà enregistrées faussent déjà la déclaration.
    const ligne = core.todoList({ ...core.DEFAULT_DATA, documents: [sansTaux], clients: [] },
      { ...co, name: 'ACME', matricule: '1234567A', rib: '12 345' }, '2026-09-12')
      .find(x => x.id === 'taux-change');
    assert.ok(ligne, '« À faire » doit signaler une pièce en devise sans taux de change');
    assert.strictEqual(ligne.level, 'danger', 'des chiffres faux dans une déclaration, c\'est rouge');
  });

  t('TVA : une ligne neuve suit le RÉGIME déclaré, pas le métier ni 19 % en dur', () => {
    const OB = require('../src/renderer/onboarding.js');
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');

    // Jusqu'à la 7.22.0, le taux se devinait à partir du MÉTIER (« Santé et paramédical » = exonéré).
    // C'était faux dans les deux sens — un kinésithérapeute au réel facture de la TVA, un
    // informaticien au forfaitaire n'en facture pas — et l'erreur s'imprimait sur une pièce
    // officielle, pas dans une console. C'est le RÉGIME FISCAL qui décide, et il est demandé en clair.
    const ouvrir = (regime) => OB.applySetup(
      { company: { ...core.DEFAULT_COMPANY }, catalog: [] },
      { name: 'Cabinet X', activity: 'sante', taxRegime: regime, fillCatalog: true });

    const forf = ouvrir('forfaitaire');
    assert.strictEqual(forf.company.taxRegime, 'forfaitaire', 'le régime doit être enregistré');
    assert.strictEqual(core.defaultVat(forf.company), 0, 'un non-assujetti ne peut pas faire naître une ligne à 19 %');
    assert.strictEqual(core.newLine(forf.company).vatRate, 0);
    assert.ok(forf.catalog.length && forf.catalog.every(x => x.vatRate === 0), 'le catalogue posé par l\'assistant suit le régime');

    // LE MÊME MÉTIER au réel facture bien de la TVA. C'est la preuve que le métier ne décide plus :
    // un test qui ne regarderait qu'un seul régime passerait avec l'ancienne règle intacte.
    const reel = ouvrir('reel');
    assert.strictEqual(core.defaultVat(reel.company), 19, 'le métier ne décide plus du taux — le régime, oui');
    assert.ok(reel.catalog.every(x => x.vatRate === 19));

    // Le régime prime sur un réglage oublié : quelqu'un qui passe au forfaitaire peut garder un
    // « TVA des nouvelles lignes : 19 % » dans ses réglages. Aucune ligne ne doit en porter.
    assert.strictEqual(core.defaultVat({ taxRegime: 'forfaitaire', defaultVatRate: 19 }), 0);

    // Et rien ne change pour l'existant : sans régime enregistré, on est assujetti, comme avant.
    assert.strictEqual(core.defaultVat({}), 19, 'sans réglage, on reste sur le taux le plus courant');
    assert.strictEqual(core.defaultVat({ defaultVatRate: 42 }), 19, 'un taux qui n\'existe pas ne doit pas se retrouver sur une facture');

    // Plus aucun 19 % en dur du côté VENTE. Côté achat, le taux est celui du fournisseur : une
    // entreprise exonérée paie quand même la TVA de ses fournisseurs, et le réglage ne s'y applique pas.
    const venteDur = app.split('\n').filter(l => /vatRate: 19/.test(l) && !/destination: 'charge'/.test(l));
    assert.deepStrictEqual(venteDur, [],
      'il reste des lignes de vente créées à 19 % en dur :\n' + venteDur.join('\n'));
  });

  t('chaque page mène à son article d\'aide', () => {
    const guide = require('../src/renderer/guide.js');
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const ids = new Set(guide.ARTICLES.map(a => a.id));

    // La table vit maintenant dans guide.js, à côté des articles qu'elle désigne (7.23.0) : elle
    // était en double avec app.js, et deux tables divergent toujours. On lit donc l'OBJET plutôt
    // qu'une expression régulière sur du texte — et on vérifie que l'interface s'en sert vraiment.
    assert.ok(/const id = G\.PAR_PAGE\[route\];/.test(app), 'l\'interface ne lit plus la table de guide.js');
    assert.ok(!app.includes('const PAGE_AIDE'), 'la table est revenue en double dans app.js');
    const paires = Object.entries(guide.PAR_PAGE);
    assert.ok(paires.length >= 20, `PAR_PAGE ne couvre que ${paires.length} pages`);
    paires.forEach(([page, art]) => assert.ok(ids.has(art),
      `la page « ${page} » renvoie à l'article « ${art} », qui n'existe pas`));

    // Toutes les pages du menu doivent avoir leur article : trente-deux articles que rien n'atteint
    // au moment où on en a besoin ne servent à rien.
    const couvertes = new Set(paires.map(p => p[0]));
    // « aide » est la seule exception : c'est l'aide elle-même, elle n'a pas à se renvoyer à elle-même.
    const oubliees = core.PAGES.filter(p => !p.horsMenu && p.id !== 'aide' && !couvertes.has(p.id)).map(p => p.id);
    assert.deepStrictEqual(oubliees, [], `ces pages ne mènent à aucun article : ${oubliees.join(', ')}`);
  });

  t('une facture émise ne change plus de total quand on change un réglage', () => {
    const facture = {
      id: 'f1', type: 'facture', status: 'envoyée', number: 'FAC-2026-001', date: '2026-03-10',
      lines: [{ label: 'Audit', qty: 1, unitPrice: 1000, vatRate: 19 }]
    };
    const avant = { ...core.DEFAULT_COMPANY, stampFee: 1 };

    // Avant la 7.1.1, `computeTotals` relisait `company.stampFee` à CHAQUE affichage : le jour où
    // l'État change le timbre et où l'utilisateur met son réglage à jour, le total de toutes les
    // factures déjà émises, envoyées et déclarées changeait avec lui. Le PDF chez le client disait
    // 1 191, l'application disait 1 192, et le journal des ventes suivait l'application.
    const data = core.migrateData({ version: 6, company: avant, documents: [facture] });
    const gelee = data.documents[0];
    assert.strictEqual(gelee.stampFee, 1, 'la migration doit figer le timbre des pièces déjà émises');

    const apres = { ...core.DEFAULT_COMPANY, stampFee: 2 };
    assert.strictEqual(core.computeTotals(gelee, avant).netToPay, 1191);
    assert.strictEqual(core.computeTotals(gelee, apres).netToPay, 1191,
      'changer le réglage du timbre ne doit RIEN changer à une pièce déjà émise');

    // Un brouillon, lui, suit le réglage courant : il n'est encore rien.
    const brouillon = { id: 'f2', type: 'facture', status: 'brouillon', date: '2026-03-10', lines: facture.lines };
    const d2 = core.migrateData({ version: 6, company: avant, documents: [brouillon] });
    assert.ok(d2.documents[0].stampFee === undefined, 'un brouillon ne fige rien');
    assert.strictEqual(core.computeTotals(d2.documents[0], apres).netToPay, 1192);

    // Et le gel tient aussi en devise : 1 DT figé reste 1 DT, converti au taux de la pièce.
    const eur = core.migrateData({ version: 6, company: avant, documents: [{ ...facture, id: 'f3', currency: 'EUR', exchangeRate: 3.4 }] }).documents[0];
    assert.strictEqual(core.round3(core.computeTotals(eur, apres).stamp * 3.4), 1);
  });

  t('l\'assistant range le menu d\'après le métier déclaré', () => {
    const OB = require(path.join(__dirname, '..', 'src', 'renderer', 'onboarding.js'));

    // Le défaut que ce test existe pour empêcher : la 7.0.0 a construit TOUT le mécanisme de tri
    // des modules — MODULES, moduleOn, navPages, la page « Tous les modules », le bandeau de
    // rattrapage — et la seule fonction qui devait l'allumer, `modulesSuggeres`, n'avait aucun
    // appelant. Le menu faisait donc ses dix-sept entrées au premier jour, pour quelqu'un qui
    // venait de déclarer à l'écran précédent qu'il fait du conseil. Rien ne plantait, aucun test
    // ne tombait : une fonction morte est invisible.
    const neuf = () => JSON.parse(JSON.stringify({ ...core.DEFAULT_DATA, company: { ...core.DEFAULT_COMPANY } }));

    const sans = neuf();
    OB.applySetup(sans, { name: 'Test SUARL', activity: 'conseil', fillCatalog: false });
    assert.strictEqual(sans.company.modules, null, 'sans réponse à l\'écran des modules, on n\'invente aucun choix');
    const toutes = core.navPages(sans).length;

    const avec = neuf();
    OB.applySetup(avec, { name: 'Test SUARL', activity: 'conseil', fillCatalog: false, modules: core.modulesSuggeres('conseil') });
    assert.ok(Array.isArray(avec.company.modules), 'l\'assistant doit écrire le choix des modules');
    assert.ok(core.navPages(avec).length < toutes,
      'répondre à l\'écran des modules doit RACCOURCIR le menu, sinon l\'écran ne sert à rien');

    // Le cœur du métier est ajouté d'office : un réglage enregistré qui ne contiendrait ni les
    // devis ni les clients ferait disparaître l'application de son propre menu.
    core.MODULES.filter(m => m.toujours).forEach(m =>
      assert.ok(avec.company.modules.includes(m.id), `« ${m.id} » doit figurer d'office dans le choix enregistré`));
    assert.strictEqual(core.moduleOn(avec, 'paie'), false, 'un conseil sans salarié n\'a pas la Paie dans son menu');
    assert.strictEqual(core.moduleOn(avec, 'pieces'), true, 'le conseil signe des contrats : le module est proposé');

    // Un identifiant inventé ne doit pas se retrouver enregistré.
    const bruit = neuf();
    OB.applySetup(bruit, { name: 'X', activity: 'autre', modules: ['paie', 'nexistepas', 'ventes'] });
    assert.ok(!bruit.company.modules.includes('nexistepas'));
    assert.strictEqual(bruit.company.modules.filter(x => x === 'ventes').length, 1, '« ventes » ne doit pas être compté deux fois');

    // Chaque métier propose quelque chose de sensé, et jamais un module qui n'existe pas.
    core.ACTIVITIES.forEach(act => core.modulesSuggeres(act.id).forEach(id =>
      assert.ok(core.moduleById(id), `« ${act.id} » propose un module inconnu : ${id}`)));
  });

  t('l\'assistant : chaque écran a son contenu, et l\'écran qu\'on quitte est écrit sur le disque', () => {
    const OB = require(path.join(__dirname, '..', 'src', 'renderer', 'onboarding.js'));
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');

    // Un écran ajouté à STEPS sans corps dans `bodyFor` s'affiche VIDE : le titre, la barre de
    // progression, les boutons — et rien entre les deux. Aucune erreur, aucune trace.
    OB.STEPS.forEach(s => assert.ok(app.includes(`s.id === '${s.id}'`),
      `l'écran « ${s.id} » de l'assistant n'a pas de contenu dans app.js`));

    // Rien n'était écrit entre deux étapes : fermer la fenêtre au cinquième écran effaçait les
    // cinq, alors que « Passer » — geste plus radical — les conservait depuis la 7.1.1.
    const d = JSON.parse(JSON.stringify({ ...core.DEFAULT_DATA, company: { ...core.DEFAULT_COMPANY } }));
    assert.strictEqual(OB.needsSetup(d), true);
    OB.applySetup(d, { name: 'Reprise SUARL', matricule: '1234567X/A/M/000' }, { done: false, step: 3 });
    assert.strictEqual(d.company.name, 'Reprise SUARL', 'ce qui a été tapé doit être sur le disque');
    assert.ok(!d.company.setupDone, 'une écriture intermédiaire ne déclare pas l\'assistant terminé');
    assert.strictEqual(d.company.setupStep, 3);
    assert.strictEqual(OB.needsSetup(d), true, 'un assistant interrompu doit reprendre, pas disparaître');

    OB.applySetup(d, { name: 'Reprise SUARL' });
    assert.strictEqual(d.company.setupDone, true);
    assert.ok(!('setupStarted' in d.company) && !('setupStep' in d.company), 'la trace de reprise s\'efface à la fin');
    assert.strictEqual(OB.needsSetup(d), false);

    // Et une installation ancienne, société renseignée mais `setupDone` absent, ne doit PAS se voir
    // proposer un assistant qu'elle n'a jamais commencé.
    const vieux = { ...core.DEFAULT_DATA, company: { ...core.DEFAULT_COMPANY, name: 'Déjà là' }, documents: [], clients: [] };
    assert.strictEqual(OB.needsSetup(vieux), false);
  });

  t('l\'assistant ne promet rien qu\'il ne tient : activité obligatoire, taux en liste, copie vérifiée', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(code.includes('runSetup'), 'le nettoyage des commentaires a mangé le code');

    // L'écran « Ton activité » se traversait sans rien cliquer, la case « Préremplir mon catalogue »
    // cochée d'office : le catalogue n'arrivait pas, `defaultVatRate` restait vide, et une bulle de
    // Paramètres affirmait pourtant que l'assistant l'avait réglé d'après le métier déclaré.
    assert.ok(/steps\[i\]\.id === 'activite' && !a\.activity/.test(code),
      'quitter l\'écran « Ton activité » sans choix doit être refusé');

    // La retenue à la source était le SEUL point de saisie libre de l'application : partout
    // ailleurs c'est une liste fermée. Et c'est le premier endroit où on la rencontre.
    const bloc = code.slice(code.indexOf('function runSetup'), code.indexOf('async function rejouerAssistant'));
    assert.ok(bloc.includes('withholdingOptions(a.defaultWithholdingRate)'),
      'la retenue à la source doit être une liste dans l\'assistant, comme dans Paramètres');
    assert.ok(!/name="defaultWithholdingRate", a\.defaultWithholdingRate, 'number'/.test(bloc));

    // L'écran de sauvegarde écrivait « Copie activée vers : … » sans jamais lire `lastError` :
    // un dossier iCloud pas encore synchronisé ou une clé en lecture seule donnaient le même
    // message rassurant que le succès — sur le seul écran dont le sous-titre dit qu'il ne faut
    // pas le sauter.
    // On exige la BRANCHE, pas une mention : un premier jet de ce test se contentait de trouver la
    // chaîne « x.lastError » quelque part dans le bloc, et restait vert quand on débranchait le
    // `if` — parce que le mot survivait dans le message d'erreur juste en dessous. Vérifié en
    // remettant le défaut : il ne tombait pas.
    assert.ok(/if \(x\.lastError\)/.test(bloc), 'l\'écran de sauvegarde doit REFUSER d\'annoncer une copie qui a échoué');
    assert.ok(/copieExterne = false/.test(bloc), 'une copie en échec ne doit pas cocher l\'étape des premiers pas');
    assert.ok(bloc.includes('bridge.externalBackupInfo()'),
      'l\'écran de sauvegarde doit montrer l\'état réel, pas un texte par défaut');
  });

  t('trésorerie : un encaissement tombe sur le compte qu\'on a désigné', () => {
    const co = { ...core.DEFAULT_COMPANY, currency: 'DT' };
    const banque = { id: 'acc-b', name: 'BIAT', isDefault: true, opening: 0, openingDate: '2026-01-01' };
    const caisse = { id: 'acc-c', name: 'Caisse espèces', opening: 0, openingDate: '2026-01-01' };
    const d = core.migrateData({
      version: 6, company: co, accounts: [banque, caisse], movements: [], purchases: [],
      documents: [{
        id: 'f1', type: 'facture', status: 'envoyée', number: 'FAC-2026-001', date: '2026-03-01',
        lines: [{ label: 'Audit', qty: 1, unitPrice: 300, vatRate: 0 }],
        payments: [{ id: 'p1', date: '2026-03-05', amount: 300, method: 'especes', accountId: 'acc-c' }]
      }]
    });
    // Le défaut : `cashMovements` lisait `p.accountId` depuis la 3.3.0 et RIEN ne l'écrivait — aucun
    // écran n'avait le champ. Un règlement en espèces montait donc sur le compte bancaire, pendant
    // que deux bulles d'aide parlaient des paiements « pour lesquels tu n'as rien précisé ».
    const mv = core.cashMovements(d, co);
    const enc = mv.find(x => x.kind === 'encaissement');
    assert.strictEqual(enc.accountId, 'acc-c', 'l\'encaissement doit tomber sur le compte désigné');
    assert.strictEqual(core.accountBalance(d, co, 'acc-c').balance, 300, 'la caisse doit monter de 300');
    assert.strictEqual(core.accountBalance(d, co, 'acc-b').balance, 0, 'la banque ne doit pas bouger');

    // Sans compte désigné, on retombe sur le compte par défaut — c'est le comportement de toutes les
    // pièces saisies avant la 7.3.0, et il ne doit pas changer.
    delete d.documents[0].payments[0].accountId;
    assert.strictEqual(core.accountBalance(d, co, 'acc-b').balance, 300, 'sans compte désigné, le défaut prend');

    // Et l'interface doit poser le champ des DEUX côtés : c'est l'absence de ces deux lignes qui a
    // laissé le champ mort pendant quatre versions.
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(code.includes('function accountFieldHtml'), 'le nettoyage des commentaires a mangé le code');
    const bloc = f => { const i = code.indexOf('function ' + f); return code.slice(i, i + 2600); };
    ['paymentForm', 'supplierPaymentForm'].forEach(f =>
      assert.ok(bloc(f).includes('accountFieldHtml'), `${f} doit proposer le compte de trésorerie`));
    assert.ok(/accountId: v\.accountId/.test(bloc('paymentForm')), 'paymentForm doit ÉCRIRE le compte, pas seulement le proposer');
    assert.ok(/accountId: v\.accountId/.test(bloc('supplierPaymentForm')), 'supplierPaymentForm doit écrire le compte');
    // Un paiement qui ne se modifie pas condamne l'erreur : le bouton de modification est la moitié
    // qui manque, sans quoi tout ce qui a été saisi avant reste sur le mauvais compte pour toujours.
    // Deux moitiés, toutes deux nécessaires : l'attribut sur la ligne ET le gestionnaire. Un premier
    // jet cherchait juste la chaîne « data-edpay » quelque part — il restait vert quand on cassait
    // le bouton, parce que le mot survivait dans le gestionnaire. Vérifié en cassant chacun des deux.
    assert.ok(/data-edpay="\$\{p\.id\}"/.test(code), 'la ligne d\'un paiement doit porter un bouton Modifier');
    assert.ok(/\$\$\('\[data-edpay\]'/.test(code), 'et ce bouton doit être branché');
  });

  t('le paquet du comptable ne félicite pas un mois vide', () => {
    const co = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', matricule: '1X/A/M/000', currency: 'DT' };
    const vide = core.migrateData({ version: 6, company: co, documents: [] });
    const plan = core.packPlan(vide, co, core.packPeriod(2026, 3), {});
    const t0 = plan.totaux;
    assert.strictEqual(t0.pieces + t0.ventes + t0.achats + t0.encaissements + t0.bulletins, 0);
    // C'est LA raison du défaut : `packChecklist` ne signale que ce qui existe, donc sur un mois
    // sans rien elle est vide — et l'écran n'avait qu'une alternative à une liste de manques :
    // « Rien à signaler : le dossier du mois est complet. » En vert, avec neuf fichiers annoncés et
    // le bouton d'envoi armé, à quelqu'un qui n'a pas encore émis une seule facture.
    assert.strictEqual(plan.checklist.length, 0, 'un mois vide n\'a rien à signaler — c\'est bien le piège');
    assert.ok(plan.entries.length > 0, 'le plan contient quand même des journaux vides : ce ne sont pas des pièces');

    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const i = code.indexOf('function drawCabinet');
    const bloc = code.slice(i, code.indexOf('function drawCabinetPair'));
    assert.ok(/const moisVide = !\(/.test(bloc), 'la page Cabinet doit savoir que le mois est vide');
    // Le panneau « Ce qui manque » doit brancher SA phrase sur ce calcul — pas ailleurs dans la page.
    assert.ok(/Ce qui manque[\s\S]{0,120}\$\{moisVide[\s\S]{0,300}Ce mois ne contient/.test(bloc),
      'le panneau « Ce qui manque » doit dire que le mois est vide au lieu de féliciter');
    assert.ok(/id="cab-build" \$\{moisVide \? 'disabled/.test(bloc), 'et refuser de fabriquer un paquet de rien');
  });

  t('la recherche connaît les onglets, et chaque page dit ce qu\'elle fait', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(code.includes('function ongletsDePalette'), 'le nettoyage des commentaires a mangé le code');

    // La palette n'indexait AUCUN onglet : « TVA » ne rendait que des articles à lire, et « cabinet »,
    // « mise à jour », « écritures », « calendrier fiscal », « apparence » ne rendaient rien du tout.
    // Deux réponses vides d'affilée, et on en conclut que la chose n'existe pas dans SkanFact.
    // On exige que les onglets soient ENGENDRÉS depuis les tableaux qui les dessinent : recopiés à
    // la main, ils divergeraient au premier onglet ajouté — c'est exactement ce qui est arrivé.
    const bloc = code.slice(code.indexOf('function ongletsDePalette'), code.indexOf('const ALIAS'));
    ['COMPTA_TABS', 'PAIE_TABS', 'STOCK_TABS', 'MARGE_TABS', 'TRESO_TABS', 'IMMO_TABS', 'AUTRES_TABS', 'CATALOG_TABS', 'SETTINGS_TABS']
      .forEach(t2 => assert.ok(bloc.includes(t2), `la palette ignore les onglets de ${t2}`));
    // Et une seule source : ces deux tableaux vivaient dans leur fonction de route, hors de portée.
    assert.ok(/const TABS = CATALOG_TABS;/.test(code), 'le Catalogue doit dessiner ses onglets depuis CATALOG_TABS');
    assert.ok(/const TABS = SETTINGS_TABS;/.test(code), 'les Paramètres doivent dessiner leurs onglets depuis SETTINGS_TABS');
    // Les mots qu'on tape et qui ne sont dans aucun libellé.
    //
    // L'ANCIEN test se contentait de chercher ces mots dans le bloc ALIAS. Il ne pouvait donc pas
    // échouer : la refonte des onglets a périmé les six clés « Paramètres → … » — plus aucune ne
    // correspondait à une entrée réelle, donc « maj », « backup », « logo » ne rendaient plus rien —
    // et il est resté vert. On exige maintenant que chaque mot atteigne une entrée EXISTANTE.
    //
    // Les réglages sont engendrés panneau par panneau depuis `SETTINGS_PANNEAUX` : on relit la
    // table et on cherche dedans, comme le ferait la palette.
    const bloc2 = code.slice(code.indexOf('const SETTINGS_PANNEAUX'), code.indexOf('const panneau ='));
    assert.ok(bloc2.length > 500, 'la table des panneaux de réglages n\'a pas été trouvée');
    const alias = code.slice(code.indexOf('const ALIAS'), code.indexOf('function closePalette'));
    ['maj', 'backup', 'mot de passe', 'logo', 'appairage', 'activation', 'matricule', 'iban', 'ocr', 'demo']
      .forEach(mot => assert.ok(bloc2.includes(mot) || alias.includes(mot),
        `« ${mot} » ne rend rien dans la recherche`));
    // Toute clé d'ALIAS doit désigner une entrée que la palette fabrique VRAIMENT : une clé orpheline
    // est un alias mort, et c'est exactement ce qui s'est passé.
    const libelles = new Set();
    (code.match(/const (COMPTA|PAIE|STOCK|MARGE|TRESO|IMMO|AUTRES|CATALOG|SETTINGS)_TABS = \[[\s\S]*?\];/g) || [])
      .forEach(b => (b.match(/, *'((?:[^'\\]|\\.)*)'\]/g) || [])
        .forEach(m => libelles.add(m.slice(3, -2).replace(/\\'/g, "'"))));
    const orphelines = (alias.match(/^\s*'([^']+)':/gm) || []).map(m => m.trim().slice(1, -2))
      .filter(k => k.includes(' → '))
      .filter(k => !libelles.has(k.split(' → ')[1]));
    assert.deepStrictEqual(orphelines, [], 'des alias de la palette nomment un onglet qui n\'existe plus');

    // Trois pages d'un même module affichaient au survol EXACTEMENT la même phrase : l'infobulle,
    // seul secours ajouté en 7.0.0, affirmait que Trésorerie, Marges et Statistiques font la même
    // chose. La phrase de la page passe avant celle du module.
    assert.ok(/const texte = p\.quoi \|\| \(m && m\.quoi\)/.test(code), 'la phrase de la page doit primer sur celle du module');
    const parModule = {};
    core.PAGES.filter(p => p.module && !p.horsMenu && !p.pied).forEach(p => {
      (parModule[p.module] = parModule[p.module] || []).push(p);
    });
    Object.keys(parModule).filter(id => parModule[id].length > 1).forEach(id => {
      const phrases = parModule[id].map(p => p.quoi || (core.moduleById(id) || {}).quoi);
      assert.strictEqual(new Set(phrases).size, phrases.length,
        `les pages du module « ${id} » partagent la même infobulle : ${parModule[id].map(p => p.titre).join(', ')}`);
    });

    // « Contrats » menait aux contrats récurrents, et le contrat que le client signe était ailleurs.
    assert.strictEqual(core.pageTitle('contrats'), 'Facturation récurrente');
    assert.ok(/contrats/i.test(core.pageTitle('autres')), 'la page qui CONTIENT les contrats doit le dire dans son nom');
    // Le titre affiché en haut de la page doit être celui du menu : deux noms pour le même écran, et
    // on croit s'être trompé de porte.
    [['contrats', 'Facturation récurrente'], ['autres', 'Proforma, bons et contrats']].forEach(([id, titre]) =>
      assert.ok(code.includes(`<h1>${titre}`), `la page « ${id} » doit s'intituler « ${titre} », comme dans le menu`));
  });

  t('sauvegardes : on purge la plus ANCIENNE, jamais la première par ordre alphabétique', () => {
    const dir = tmpDir();
    const s = createStorage(dir);
    s.write({ ...core.DEFAULT_DATA, company: { ...core.DEFAULT_COMPANY, name: 'Test' } });

    // Le défaut : `named.sort()` triait par NOM. « avant-demo », « avant-effacement » et
    // « avant-import » passent toujours avant « manuelle-… », donc les trois filets partaient les
    // premiers — celui qu'on vient de prendre disparaissait à la seconde où il servait, pendant que
    // l'écran annonçait « une sauvegarde est prise juste avant ». C'est exactement le défaut corrigé
    // dans l'app cabinet en 6.8.1, et jamais porté ici.
    const dossier = path.join(dir, 'backups');
    fs.mkdirSync(dossier, { recursive: true });
    const noms = [];
    for (let i = 0; i < 25; i++) noms.push('manuelle-' + String(i).padStart(3, '0'));
    noms.forEach((nom, i) => {
      const f = path.join(dossier, nom + '.json');
      fs.writeFileSync(f, JSON.stringify({ ...core.DEFAULT_DATA, company: { ...core.DEFAULT_COMPANY, name: nom } }));
      fs.utimesSync(f, new Date(2020, 0, 1 + i), new Date(2020, 0, 1 + i));   // les plus vieilles
    });
    // Le filet, pris à l'instant : le plus RÉCENT de tous, et le premier par ordre alphabétique.
    const filet = path.join(dossier, 'avant-effacement-2026-09-12.json');
    fs.writeFileSync(filet, JSON.stringify({ ...core.DEFAULT_DATA, company: { ...core.DEFAULT_COMPANY, name: 'FILET' } }));
    fs.utimesSync(filet, new Date(2026, 8, 12), new Date(2026, 8, 12));

    s.backupNow('manuelle');            // déclenche la purge

    const restants = fs.readdirSync(dossier);
    assert.ok(restants.includes('avant-effacement-2026-09-12.json'),
      'le filet le plus récent a été purgé alors que vingt-cinq sauvegardes plus vieilles restaient : ' + restants.join(', '));
    // Et ce sont bien les plus vieilles qui sont parties.
    assert.ok(!restants.includes('manuelle-000.json'), 'la plus ancienne aurait dû partir');

    // Le cas Windows. Là-bas l'horloge système n'avance que toutes les ~15 ms : des copies
    // successives portent le MÊME mtime, et le tri retombait alors sur son départage — qui était
    // ALPHABÉTIQUE. « avant-… » repassait donc en tête et redevenait la première effacée : le bug
    // de 6.8.1 intact, sur la seule plateforme que personne ne testait. Depuis, les filets ont
    // leur propre réserve, comme dans l'app cabinet.
    fs.readdirSync(dossier).forEach(n => {
      const q = new Date(2026, 8, 12);
      fs.utimesSync(path.join(dossier, n), q, q);
    });
    // Deux étiquettes DIFFÉRENTES : le nom d'une sauvegarde porte l'heure à la seconde près, donc
    // deux `backupNow('manuelle')` lancés dans la même seconde écrivent le MÊME fichier. Le second
    // écrasait le premier, le compte ne bougeait pas, aucune purge ne se déclenchait — et ce test
    // passait avec le défaut réintroduit. Un test qui ne peut pas échouer est pire que pas de test.
    s.backupNow('manuelle-bis');
    s.backupNow('manuelle-ter');
    const apres = fs.readdirSync(dossier);
    assert.ok(apres.includes('avant-effacement-2026-09-12.json'),
      'à mtime égal, le filet redevenait la première effacée par ordre alphabétique : ' + apres.join(', '));
    assert.ok(!apres.includes('manuelle-007.json'),
      'c\'est la plus ancienne des VOLONTAIRES qui doit partir, pas le filet');
  });

  t('l\'exemple rend ce qu\'il a emprunté, et ne signe jamais rien', () => {
    const demo = require(path.join(__dirname, '..', 'src', 'renderer', 'demo.js'));

    // Le trou de la 7.0.0 : l'identité était jugée « empruntée » sur la SEULE raison sociale. Or
    // l'assistant invite explicitement à laisser le matricule fiscal et le RIB vides (« si tu ne
    // l'as pas encore, laisse vide »). L'exemple les remplissait avec les siens, `demo` restait
    // faux puisque le nom était là, et plus rien ne les enlevait — ni la sortie de l'exemple, ni
    // « Tout effacer ». Les trois contrôles de conformité ne regardent que la PRÉSENCE d'une
    // valeur : l'application affirmait donc en vert « tes documents sont en règle » sur un
    // matricule fiscal inventé et un RIB qui n'est pas le sien.
    const d = core.migrateData(null);
    d.company.name = 'Menuiserie Ben Salah SUARL';          // le seul champ que l'assistant exige
    const charge = demo.buildDemoData(d.company, '2026-09-12');
    assert.strictEqual(charge.company.name, 'Menuiserie Ben Salah SUARL', 'son nom ne doit pas être écrasé');
    assert.ok(charge.company.matricule, 'l\'exemple prête bien un matricule — c\'est le piège');
    assert.ok((charge.company.demoFields || []).includes('matricule'), 'l\'emprunt doit être noté pour pouvoir être rendu');
    assert.ok(charge.company.demoFields.includes('rib'));
    assert.ok(!charge.company.demoFields.includes('name'), 'ce qu\'il avait déjà n\'est pas un emprunt');

    // La sortie de l'exemple lui rend sa fiche telle qu'il l'avait laissée : incomplète, mais VRAIE.
    charge.documents = [{ id: 'x', type: 'facture' }];
    core.wipeData(charge, { garderSociete: true });
    assert.strictEqual(charge.company.name, 'Menuiserie Ben Salah SUARL');
    assert.strictEqual(charge.company.matricule, '', 'le faux matricule fiscal doit repartir avec l\'exemple');
    assert.strictEqual(charge.company.rib, '', 'le faux RIB aussi — c\'est un paiement qui n\'arrive jamais');
    assert.ok(!('demoFields' in charge.company));
    // Et l'application le redit : la fiche est de nouveau incomplète, donc elle le signale.
    assert.ok(core.companyGaps(charge.company).length >= 2, 'les contrôles doivent redevenir vrais');

    // L'app le dit sur chaque page — « n'envoie rien à personne depuis ici » — et rien ne le tenait :
    // `estDemo` n'avait qu'un seul appelant dans toute l'application, le bandeau lui-même.
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(code.includes('async function demoBlock'), 'le nettoyage des commentaires a mangé le code');
    const portes = (code.match(/await demoBlock\(/g) || []).length;
    assert.ok(portes >= 6, `seulement ${portes} geste(s) sortant(s) protégé(s) : email au client, CNSS, journal, écritures, fabrication et envoi du paquet`);
    // Le PDF, lui, ne se bloque pas — regarder un PDF EST l'apprentissage. Il se marque.
    assert.ok(/function stampFor[\s\S]{0,200}estDemo\(data\)\) return 'EXEMPLE'/.test(code),
      'un PDF de démonstration doit porter la mention EXEMPLE');
    // Et les quatre chemins qui produisent un PDF doivent passer par stampFor : trois recopiaient
    // la logique à la main, donc un tampon posé ici seul en aurait manqué trois sur quatre.
    const copies = code.match(/st === 'payée' \? 'Payée'/g) || [];
    assert.strictEqual(copies.length, 1, `${copies.length} endroits décident du tampon : il n'en faut qu'un`);
    // On teste la RÈGLE, pas un compte : « tout document qu'on fabrique porte le tampon décidé par
    // `stampFor` ». Un nombre en dur se périme au premier écran ajouté (c'est arrivé en 7.13.0 avec
    // le grand aperçu) et, pire, il se « répare » en changeant le chiffre — sans rien vérifier.
    // Seule exception : l'aperçu de la PROCHAINE facture d'un contrat, qui n'existe pas encore.
    const appelsDoc = code.match(/C\.documentHtml\([\s\S]{0,260}?\);/g) || [];
    assert.ok(appelsDoc.length >= 6, `seulement ${appelsDoc.length} fabrications de document trouvées : l'analyse a raté des appels`);
    appelsDoc.filter(a => !/C\.documentHtml\(next,/.test(a)).forEach(a =>
      assert.ok(/stampText: stampFor\(/.test(a),
        'un document se fabrique sans passer par stampFor : ' + a.replace(/\s+/g, ' ').slice(0, 110)));
  });

  t('charger l\'exemple prévient et sauvegarde, quelles que soient les listes remplies', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const bloc = code.slice(code.indexOf('async function loadDemo'), code.indexOf('async function demoSortie'));
    assert.ok(bloc.length > 100, 'bloc loadDemo introuvable');

    // `hasData` ne regardait que `documents` et `clients` : DEUX listes sur vingt. Or l'assistant en
    // remplit une troisième — le catalogue du métier déclaré — donc quelqu'un qui finissait
    // l'assistant puis cliquait « Voir un exemple rempli » perdait ses prestations sans une question
    // et sans sauvegarde, pendant que l'article d'aide promet « tes données sont mises de côté ».
    assert.ok(!/data\.documents\.length \|\| data\.clients\.length/.test(bloc),
      'la question ne doit pas se décider sur deux listes sur vingt');
    assert.ok(/Object\.keys\(C\.LIST_LABELS\)/.test(bloc), 'ce qui sera remplacé se DÉDUIT, comme pour « Tout effacer »');
    // La sauvegarde n'est plus conditionnelle : elle coûte un fichier, et c'est le seul retour.
    assert.ok(/\n\s*await bridge\.createBackup\('avant-demo'\);/.test(bloc),
      'la sauvegarde « avant-demo » doit être prise sans condition');
    // Et dans l'ordre de « Tout effacer » : le refus de la seconde question ne doit pas laisser une
    // sauvegarde orpheline derrière lui.
    assert.ok(bloc.indexOf('closedWipeOk') < bloc.indexOf("createBackup('avant-demo')"),
      'le garde-fou de clôture se pose AVANT la sauvegarde, comme dans « Tout effacer »');
  });

  t('le geste qui rapporte de l\'argent n\'est pas au fond d\'un menu gris', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(code.includes('function facturerDevis'), 'le nettoyage des commentaires a mangé le code');

    // Facturer un devis était la seule porte de l'application : un bouton gris au contenu invisible
    // avant clic, sans aucun double dans la liste ni dans la palette. Le panneau « À faire » en
    // était réduit à écrire l'itinéraire — « Ouvre le devis puis « Facturer ▾ » ». Une application
    // qui doit décrire son propre chemin décrit surtout un bouton mal placé.
    assert.ok(/const devisFacturable = [\s\S]{0,160}accepté[\s\S]{0,40}envoyé/.test(code),
      'un devis que le client a accepté doit proposer « Facturer » en premier');
    assert.ok(/btn btn-primary" id="convert">Facturer ce devis/.test(code), 'et ce bouton doit être le bouton coloré');
    // La LISTE offre le geste sans qu'on ait à ouvrir le devis. Depuis la 7.28.0 les actions d'une
    // ligne vivent dans un menu et non plus dans une rangée de boutons : ce n'est donc plus un
    // `data-facturer` qu'on cherche, mais l'entrée du menu — la RÈGLE n'a pas changé, sa forme si.
    const menuDoc = code.slice(code.indexOf('bindRowMenus(document, id => {'), code.indexOf('function duplicateDoc'));
    assert.ok(menuDoc.length > 400 && !menuDoc.includes('clientForm('), 'découpage du menu de ligne raté');
    assert.ok(/label: 'Facturer ce devis'/.test(menuDoc), 'la LISTE doit aussi porter le geste, sans avoir à ouvrir le devis');
    // Les deux chemins passent par la MÊME fonction : recopiés, ils divergeraient au premier
    // changement — et c'est le geste qui crée une facture.
    // Les deux chemins passent par `facturerDevis` — on teste la RÈGLE (le gestionnaire l'appelle),
    // pas la forme exacte d'une ligne : depuis la 7.16.0 il pose d'abord une question quand le devis
    // est déjà facturé, donc une assertion recopiée mot pour mot tomberait sans rien prouver.
    assert.ok(/\$\('#convert'\)\.onclick = [\s\S]{0,700}?facturerDevis\(doc\)/.test(code),
      'le bouton de l\'éditeur doit passer par facturerDevis');
    // Et le garde-fou « ce devis a déjà donné … » vit DANS `facturerDevis`, pas chez ses appelants
    // (7.29.0) : posé sur le bouton de l'éditeur en 7.16.0, il ne protégeait que ce bouton-là — le
    // menu de ligne de la 7.28.0, écrit ailleurs, refabriquait une facture entière sans un mot.
    const fd = code.slice(code.indexOf('async function facturerDevis(q) {'), code.indexOf('function invoiceFromQuote('));
    assert.ok(fd.length > 200 && fd.includes('data.documents.push(inv)'), 'découpage de facturerDevis raté');
    assert.ok(/piecesDuDevis\(q\.id\)[\s\S]{0,400}?await confirmDialog\(/.test(fd),
      'facturerDevis ne demande rien sur un devis déjà facturé : un second clic crée une facture entière de plus');
    // Et l'appelant ne recopie plus la condition : c'est ce qui a fait diverger les deux chemins.
    assert.ok(!/dejaFacture\.length \|\| issuedDeposits\.length\) \{[\s\S]{0,200}?confirmDialog/.test(code),
      'la question est de nouveau recopiée chez un appelant : le prochain chemin repartira sans elle');
    assert.ok(/run: \(\) => facturerDevis\(d\)/.test(menuDoc), 'et celui de la liste aussi');
    assert.ok(!/invoiceFromQuote\(doc, deepCopy\(doc\.lines\)/.test(code), 'plus aucune copie du geste à la main');
    // Et le détail de « À faire » ne décrit plus un itinéraire.
    const core2 = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'core.js'), 'utf8');
    assert.ok(!/Ouvre le devis puis/.test(core2), 'l\'application ne doit plus décrire son propre chemin');
  });

  t('un devis en brouillon est rappelé, et son rappel mène à la bonne liste', () => {
    const co = { ...core.DEFAULT_COMPANY, currency: 'DT' };
    const vieux = core.addDays('2026-09-12', -30);
    const d = core.migrateData({
      version: 6, company: co,
      documents: [
        { id: 'q1', type: 'devis', status: 'brouillon', number: 'DEV-2026-001', date: vieux, lines: [{ label: 'x', qty: 1, unitPrice: 100, vatRate: 0 }] },
        { id: 'f1', type: 'facture', status: 'brouillon', date: vieux, lines: [{ label: 'y', qty: 1, unitPrice: 100, vatRate: 0 }] }
      ]
    });
    const todo = core.todoList(d, co, '2026-09-12');
    const dev = todo.find(x => x.id === 'devis-brouillons');
    const fac = todo.find(x => x.id === 'brouillons');
    // Le défaut : UNE ligne comptait les deux familles, et son unique bouton ouvrait la liste des
    // FACTURES filtrée sur « brouillon » — où un devis ne peut pas figurer. Le rappel existait, et
    // menait à une liste où la pièce annoncée était invisible. Un compteur et la liste qu'il annonce
    // se calculent avec la même fonction.
    assert.ok(dev, 'un devis en brouillon depuis un mois doit être rappelé');
    assert.strictEqual(dev.route, '#/devis', 'et son bouton doit mener aux DEVIS');
    assert.strictEqual(dev.count, 1);
    assert.ok(fac, 'le brouillon de facture garde sa propre ligne');
    assert.strictEqual(fac.route, '#/factures');
    assert.strictEqual(fac.count, 1, 'et il ne compte que les factures');

    // Le seul endroit du code qui faisait avancer le statut d'un devis était le bouton Email : un
    // devis envoyé par WhatsApp ou remis en main propre restait brouillon à vie — ni relancé, ni
    // compté dans le taux de transformation, ni jamais déclaré expiré — alors que son PDF, qui
    // porte déjà son numéro, est indiscernable d'un devis envoyé.
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(/Ce devis part chez ton client \?/.test(code), 'exporter le PDF d\'un devis brouillon doit poser la question');
    assert.ok(/'Le marquer envoyé', 'Le garder en brouillon'/.test(code), 'et laisser le choix');
  });

  t('le bouton vert de l\'en-tête suit l\'onglet ouvert', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

    // Sur « Congés », le gros bouton vert en haut à droite disait « + Salarié » pendant que le vrai
    // geste de l'onglet était un bouton vert plus petit dans le panneau : deux boutons verts sur
    // l'écran, et le mauvais à la place canonique. Le Catalogue redessine son en-tête à chaque
    // onglet depuis la 1.9.0 ; Paie et Stock ne le faisaient pas.
    [['p-head', 'pHead', 'P_ACTION'], ['st-head', 'stHead', 'ST_ACTION']].forEach(([id, fn, table]) => {
      assert.ok(code.includes(`const ${table} = {`), `${id} : la table des actions par onglet manque`);
      assert.ok(new RegExp(`\\$\\('#${id}'\\)\\.innerHTML = ${fn}\\(\\); bind`).test(code),
        `${id} : l'en-tête doit être redessiné avec le corps`);
    });
    // Un seul bouton vert par écran : ceux des panneaux repassent en ordinaire, sinon on en a deux.
    ['new-lv', 'new-av', 'se-add'].forEach(b =>
      assert.ok(!new RegExp(`btn-sm btn-primary" id="${b}"`).test(code),
        `« ${b} » est encore un second bouton vert dans son panneau`));
    // Et chaque bouton du nouvel en-tête est réarmé : un bouton visible et inerte est pire qu'absent.
    ['new-emp', 'new-lv', 'new-av', 'st-adj', 'se-add'].forEach(b =>
      assert.ok(new RegExp(`\\$\\('#${b}'\\)\\) \\$\\('#${b}'\\)\\.onclick`).test(code),
        `« ${b} » n'est pas rebranché après le redessin de l'en-tête`));
  });

  t('un écran vide apprend quelque chose, et ne félicite pas un travail jamais commencé', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(code.includes('function etatVide'), 'le nettoyage des commentaires a mangé le code');

    // Un état vide qui explique le geste en prose n'est pas une interface, c'est une notice de
    // montage : « Aucun devis. Crée le premier avec le bouton en haut à droite » demande de retenir
    // une phrase et de retrouver le bon bouton. Le patron dit à quoi sert la page, puis donne les
    // vrais boutons.
    ['Crée le premier avec le bouton en haut à droite', 'Crée la première avec le bouton en haut à droite']
      .forEach(p => assert.ok(!code.includes(p), `un état vide décrit encore un itinéraire : « ${p} »`));
    assert.ok(/etatVide\(/.test(code));
    ['vide-new', 'rec-first', 'rel-vers-new', 'immo-vers-achats', 'emp-first'].forEach(id =>
      assert.ok(new RegExp(`\\$\\('#${id}'\\)\\) \\$\\('#${id}'\\)\\.onclick`).test(code),
        `le bouton « ${id} » d'un état vide n'est pas branché — un bouton inerte est pire qu'une phrase`));

    // Une barre de recherche et des filtres au-dessus de ZÉRO ligne occupent la place où devrait
    // vivre l'explication, et laissent croire que quelque chose est filtré. On la garde évidemment
    // quand la liste est vide À CAUSE d'un filtre : sinon on ne peut plus le retirer.
    assert.ok(/function filtersBar\(html, total, filtered\) \{[\s\S]{0,120}if \(!total && !filtered\) return ''/.test(code),
      'filtersBar doit se taire sur une liste vide, mais rester quand un filtre est actif');
    assert.ok((code.match(/filtersBar\(`/g) || []).length >= 3, 'les listes principales doivent passer par filtersBar');

    // Avant d'écrire une phrase rassurante, vérifier que l'univers concerné est non vide. La règle
    // était déjà écrite pour l'accueil en 7.0.0 ; deux écrans ne l'appliquaient pas.
    assert.ok(/documents\.some\(d => d\.type === 'facture' && d\.number\)[\s\S]{0,120}Tout est encaissé/.test(code),
      '« Tout est encaissé » ne doit s\'afficher que si une facture a été émise');
    assert.ok(/\(data\.purchases \|\| \[\]\)\.length[\s\S]{0,160}ont leur fiche/.test(code),
      '« Toutes les lignes d\'achat ont leur fiche » suppose qu\'il existe un achat');
    // La TVA : sur une base vide, `toPay` vaut 0, donc la ligne verte annonçait un « crédit de TVA
    // reportable » à quelqu'un qui n'a jamais facturé. Et la branche « Rien à déclarer » était du
    // code mort (`vatChain` renvoie toujours douze mois) : elle faisait croire le cas traité.
    assert.ok(/!cur1\.collected && !cur1\.deductible && !cur1\.carryIn/.test(code),
      'un mois sans la moindre écriture doit être nommé, pas verdict en vert');
    assert.ok(!/: '<div class="empty">Rien à déclarer.<\/div>'/.test(code), 'la branche morte doit disparaître');
  });

  // ---------- le pluriel, dans les QUATRE fichiers qui écrivent des phrases ----------
  //
  // La règle vit dans l'app cabinet depuis sa 1.0.0 : « un logiciel qui écrit "1 dossier(s)" paraît
  // bâclé ». Elle avait été portée à l'app entreprise en 7.18.0 — pour UN écran. Il restait
  // quatre-vingts « (s) » dans app.js et onze dans core.js, dont « 1 facture(s) en brouillon » dans
  // « À faire », « 1 achat(s) sans justificatif » dans le paquet du comptable, et « 51 document(s) »
  // dans les Paramètres. Le test interdit la forme, dans les deux applications et dans leur logique
  // partagée : c'est la seule façon qu'elle ne revienne pas au prochain module.
  //
  // Ce qui reste permis : `foo(s)` est un APPEL dont l'argument s'appelle `s`. La liste est courte
  // et le message dit quoi faire — l'allonger pour un vrai appel, corriger le texte sinon.
  t('aucun écran n\'écrit « 1 facture(s) »', () => {
    const APPELS = ['String', 'push', 'done', 'bodyFor', 'balance', 'nPoint', 'escapeHtml', 'nl2br',
      'statusLabel', 'payslipDate', 'test', 'exec', 'indexOf', 'br', 'normNom', 'trim', 'esc', 'h'];
    // On lit la source avec ses CHAÎNES : `codeSeulement` les vide, or c'est très exactement dedans
    // que vivent les pluriels — première version de ce test, qui ne pouvait donc pas échouer, et je
    // ne l'ai su qu'en réintroduisant le défaut. Seuls les commentaires partent, parce qu'ils citent
    // la faute pour l'expliquer.
    const sansCommentaires = src => src.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    ['src/renderer/app.js', 'src/renderer/core.js', 'src/cabinet/renderer/app.js', 'src/cabinet/cabcore.js']
      .forEach(f => {
        const code = sansCommentaires(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
        assert.ok(code.length > 1000, `le nettoyage des commentaires a mangé ${f}`);
        const fautes = Array.from(new Set((code.match(/[A-Za-zÀ-ÿ_$][A-Za-zÀ-ÿ0-9_$]*\(s\)/g) || [])
          .filter(m => !APPELS.includes(m.slice(0, -3)))));
        assert.deepStrictEqual(fautes, [], `${f} écrit encore des pluriels en « (s) » : ${fautes.join(', ')}`);
      });
    // Et les deux outils qui les remplacent existent bien, des deux côtés.
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const core = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'core.js'), 'utf8');
    assert.ok(/const pl = \(n, un, plur\)/.test(app) && /const sPl = n =>/.test(app),
      'app.js n\'a pas de quoi accorder un pluriel');
    assert.ok(/const plFr = \(n, un, plur\)/.test(core) && /const sAccord = n =>/.test(core),
      'core.js n\'a pas de quoi accorder un pluriel');
  });

  t('un même geste porte partout le même nom et le même habit', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'style.css'), 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(code.includes('function filterReset'), 'le nettoyage des commentaires a mangé le code');

    // Quatre libellés pour le même geste obligent à RELIRE chaque bouton au lieu de le reconnaître.
    ['Exporter (CSV)', 'Exporter en CSV (Excel)', 'Exporter le registre (CSV)'].forEach(l =>
      assert.ok(!code.includes('>' + l + '<'), `« ${l} » : un seul libellé, « Exporter en CSV »`));
    assert.ok(code.split('>Exporter en CSV<').length - 1 >= 10, 'tous les exports portent le libellé commun');
    // Exporter n'est l'action principale d'aucun écran : le bouton coloré dit « voici le geste du
    // jour », et il ne peut pas y en avoir deux.
    assert.ok(!/btn btn-primary" id="[a-z-]*csv/.test(code), 'un export ne doit jamais être le bouton coloré');

    // Le bouton qui annule les filtres portait trois libellés, deux styles et deux identifiants.
    assert.ok(!/id="rel-clear"|id="cpt-clear"|btn-ghost reset-f/.test(code),
      'tous les écrans passent par filterReset() : un libellé, un style, un id');

    // « Modifier » est une action, pas un pictogramme : elle garde sa bordure. Huit listes
    // l'écrivaient en `btn-ghost` (fond et bordure transparents) là où quatre autres la bordaient.
    assert.ok(!/btn btn-sm btn-ghost" data-\w+="[^"]*">Modifier</.test(code),
      '« Modifier » sans bordure : le même bouton ne peut pas avoir deux apparences');

    // Le sélecteur des champs était énuméré type par type et oubliait `search` : cinq listes
    // affichaient une petite boîte native dont le texte était coupé au milieu d'un mot.
    assert.ok(!/input\[type=text\], input\[type=number\]/.test(css),
      'on exclut ce qui doit rester natif, on n\'énumère pas ce qui doit être stylé');
    assert.ok(/input:not\(\[type=checkbox\]\)[^{]*\{/.test(css), 'le sélecteur générique doit exister');
    assert.ok(!/\.filters input\[type=text\]/.test(css), 'la barre de filtres doit styler tous ses champs');

    // Deux bulles « i » identiques qui se touchent : même glyphe, même infobulle, impossible de
    // savoir laquelle explique quoi. Si elles portent sur le même bloc, c'est une seule clé.
    assert.ok(!/\$\{info\('[a-z.]+'\)\}\s*\$\{info\('/.test(code),
      'deux bulles « i » ne se suivent jamais sans texte entre elles');
  });

  t('l\'aide décrit l\'application d\'aujourd\'hui, pas celle d\'il y a six versions', () => {
    const guide = require(path.join(__dirname, '..', 'src', 'renderer', 'guide.js'));
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
    const corpus = guide.ARTICLES.map(a => a.body).join('\n');
    const bulles = Object.values(guide.INFO).map(x => x.d).join('\n');

    // Le panneau « Tes premiers pas » donne SEPT étapes et renvoie à un article qui en donnait
    // CINQ, différentes : « les cinq premières minutes » contre « compléter ta fiche société,
    // enregistrer ton premier client… ». Quelqu'un qui suit la notice ne fait pas ce que
    // l'application lui demande. Les deux se calculent maintenant sur la même liste.
    const d = core.migrateData(null);
    const art = guide.ARTICLES.find(a => a.id === 'demarrer');
    core.firstSteps(d, d.company, {}).etapes.forEach(e =>
      assert.ok(art.body.includes(e.titre),
        `l'article « Démarrer » ne parle pas de l'étape « ${e.titre} » que l'accueil affiche`));

    // Chaque onglet de l'application doit être nommé au moins une fois dans l'aide : l'article
    // Comptabilité annonçait « quatre onglets » quand la page en avait sept, et les trois nouveaux
    // (Écritures, Clôtures, Cabinet) n'y figuraient nulle part.
    const onglets = [];
    // L'extraction doit tenir les apostrophes échappées (« Où j\'en suis ») : une première version
    // découpait sur `', '` et rendait « Où j\ », donc le test cherchait un libellé qui n'existe pas.
    (app.match(/const (COMPTA|PAIE|STOCK|MARGE|TRESO|IMMO|AUTRES|CATALOG|SETTINGS)_TABS = \[[\s\S]*?\];/g) || [])
      .forEach(bloc => {
        const paires = bloc.match(/\['(?:[^'\\]|\\.)*', *'((?:[^'\\]|\\.)*)'/g) || [];
        paires.forEach(m => {
          const lab = m.slice(m.indexOf("', '") >= 0 ? 0 : 0).match(/, *'((?:[^'\\]|\\.)*)'$/);
          if (lab) onglets.push(lab[1].replace(/\\'/g, "'"));
        });
      });
    assert.ok(onglets.length > 30, 'les tableaux d\'onglets n\'ont pas été trouvés : ' + onglets.length);
    const jamais = onglets.filter(l => !corpus.includes(l));
    assert.deepStrictEqual(jamais, [], 'des onglets de l\'application ne sont nommés nulle part dans l\'aide');

    // Le menu est la source de vérité des raccourcis : l'article en oubliait six, dont celui qui
    // ouvre l'aide et celui qui revient en arrière.
    const touches = Array.from(new Set((main.match(/accelerator: '([^']+)'/g) || [])
      .map(m => m.split("'")[1]).map(a => a.replace(/^(CmdOrCtrl|Cmd|Ctrl)\+/, '').replace('Shift+', ''))));
    const racc = guide.ARTICLES.find(a => a.id === 'raccourcis').body;
    const absents = touches.filter(k => !new RegExp(`<kbd>${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</kbd>`).test(racc)
      && !(/^[1-9]$/.test(k) && /<kbd>1<\/kbd> à <kbd>5<\/kbd>/.test(racc) && Number(k) <= 5));
    assert.deepStrictEqual(absents, [], 'des raccourcis du menu ne figurent pas dans l\'article');

    // Une aide qui parle au futur d'un module livré depuis un an fait douter de tout le reste.
    [corpus, bulles].forEach(txt => {
      const dates = txt.match(/(À partir de la version|quand ils arriveront|n'aient pas à te faire tout ressaisir|la page a quatre onglets)/g);
      assert.strictEqual(dates, null, 'un texte d\'aide parle encore au futur d\'un module déjà livré : ' + (dates || []).join(' · '));
    });
  });


  t('les réglages : on les trouve, on les voit, et rien ne se jette sans un mot', () => {
    const brut = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    // On juge le CODE : les commentaires de cette version citent justement les chemins en prose
    // qu'elle vient de remplacer par des boutons, et le test se croirait en échec pour ça.
    const app = brut.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(app.includes('routes.parametres'), 'le nettoyage des commentaires a mangé le code');
    const i = app.indexOf('routes.parametres = async () =>');
    const j = app.indexOf('function drawCabinetPair');
    assert.ok(i > 0 && j > i, 'la page Paramètres n\'a pas été trouvée dans app.js');
    const page = app.slice(i, j);

    // 1. Un lien qui promet un réglage précis doit désigner un panneau QUI EXISTE, dans un onglet
    // qui existe : sinon on atterrit en haut d'une pile de six panneaux, exactement comme avant.
    const onglets = (app.match(/const SETTINGS_TABS = \[[\s\S]*?\];/) || [''])[0];
    const table = app.slice(app.indexOf('const SETTINGS_PANNEAUX'), app.indexOf('const panneau ='));
    const decl = {};
    (table.match(/'(p-[a-z]+)': \{ onglet: '([a-z]+)'/g) || [])
      .forEach(m => { const x = m.match(/'(p-[a-z]+)': \{ onglet: '([a-z]+)'/); decl[x[1]] = x[2]; });
    const idsPanneaux = new Set(Object.keys(decl));
    assert.ok(idsPanneaux.size >= 20, 'les panneaux de Paramètres ne sont pas déclarés : ' + idsPanneaux.size);
    const liens = (app.match(/allerParametres\('([a-z]+)', *'([a-z-]+)'\)/g) || [])
      .map(m => m.match(/allerParametres\('([a-z]+)', *'([a-z-]+)'\)/).slice(1))
      .concat((app.match(/settingsFocus = '([a-z-]+)'/g) || []).map(m => ['', m.split("'")[1]]));
    assert.ok(liens.length >= 8, 'aucun lien ne vise un panneau de Paramètres : ' + liens.length);
    liens.forEach(([tab, focus]) => {
      assert.ok(idsPanneaux.has(focus), `un lien vise le panneau « ${focus} », qui n'existe pas dans Paramètres`);
      if (tab) assert.ok(onglets.includes(`'${tab}'`), `un lien vise l'onglet « ${tab} », qui n'est pas dans SETTINGS_TABS`);
      if (tab) assert.strictEqual(decl[focus], tab,
        `un lien envoie le panneau « ${focus} » dans l'onglet « ${tab} », alors qu'il vit dans « ${decl[focus]} »`);
    });
    // La table et la PAGE se confrontent : chaque panneau déclaré est posé une fois et une seule,
    // et la page n'en pose aucun qui ne soit déclaré. Sans ça, un panneau ajouté à la main serait
    // absent de la palette et de la recherche — c'est-à-dire introuvable, donc inexistant.
    Object.keys(decl).forEach(id => {
      const n = (page.match(new RegExp(`panneau\\('${id}'`, 'g')) || []).length;
      assert.strictEqual(n, 1, `le panneau « ${id} » est déclaré mais posé ${n} fois dans la page`);
      assert.ok(onglets.includes(`'${decl[id]}'`), `le panneau « ${id} » vit dans un onglet qui n'est pas dans SETTINGS_TABS`);
    });
    (page.match(/panneau\('(p-[a-z]+)'/g) || []).forEach(m => {
      const id = m.slice(9, -1);
      assert.ok(decl[id], `la page pose le panneau « ${id} », qui n'est pas déclaré dans SETTINGS_PANNEAUX`);
    });
    // Et la page n'écrit plus aucun panneau de réglages à la main : le titre, les mots-clés et
    // l'entrée de palette viendraient alors de nulle part.
    assert.ok(!/<div class="panel[^"]*" id="p-/.test(page), 'un panneau de réglages est écrit à la main');
    // Chaque onglet déclaré porte au moins un panneau : un onglet vide se voit à l'écran.
    (onglets.match(/\['([a-z]+)',/g) || []).map(m => m.slice(2, -2)).forEach(t2 =>
      assert.ok(Object.values(decl).includes(t2), `l'onglet « ${t2} » ne contient aucun panneau`));

    // 1 bis. Toute phrase qui dicte un chemin « Paramètres → X » doit nommer un onglet QUI EXISTE.
    // La refonte en a périmé onze d'un coup, dans les deux `main.js` et les deux renderers : un
    // refus qui envoie vers un onglet disparu est le pire des refus — on cherche, on ne trouve pas,
    // et on conclut que le logiciel ment. Le contrôle est générique, il ne nomme aucun cas : sinon
    // il ne couvrirait que le défaut du jour (le précédent n'interdisait qu'une seule chaîne).
    const libellesOnglets = (onglets.match(/, *'((?:[^'\\]|\\.)*)'\]/g) || [])
      .map(m => m.slice(3, -2).replace(/\\'/g, "'"));
    assert.ok(libellesOnglets.length >= 4, 'les libellés d\'onglets n\'ont pas été relus');
    ['src/renderer/app.js', 'src/main.js', 'src/cabinet/renderer/app.js', 'src/cabinet/main.js',
      'src/renderer/guide.js', 'src/cabinet/renderer/cabguide.js'].forEach(f => {
        const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
        const chemins = (src.match(/Paramètres → [^<.,:)»"`\n]+/g) || [])
          .map(m => m.slice('Paramètres → '.length).replace(/\\'/g, "'").split(' → ')[0].trim())
          .filter(x => x && !x.startsWith('$'));
        const inconnus = Array.from(new Set(chemins.filter(x => !libellesOnglets.includes(x))));
        assert.deepStrictEqual(inconnus, [], `${f} envoie vers un onglet de Paramètres qui n'existe pas : ${inconnus.join(' · ')}`);
      });
    // Trois chemins mènent à un panneau — le lien venu d'ailleurs (`settingsFocus`), le sommaire de
    // l'onglet, un résultat de recherche — et ils passent tous par la MÊME fonction. C'est elle qui
    // change d'onglet si besoin : sans ça, un lien qui se trompe d'onglet amènerait au bon panneau
    // dans un écran masqué, c'est-à-dire nulle part.
    // Sans les commentaires, mais AVEC les chaînes : `codeSeulement` les vide, or c'est précisément
    // `classList.add('flash')` qu'on vérifie ici.
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'reglages.js'), 'utf8')
      .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(mod.includes('function installer(opts)'), 'le nettoyage des commentaires a mangé reglages.js');
    assert.ok(/function montrer\(pid\) \{[\s\S]{0,900}?scrollIntoView[\s\S]{0,200}?classList\.add\('flash'\)/.test(mod),
      'le panneau visé n\'est pas amené à l\'écran ni désigné');
    assert.ok(/function montrer\(pid\)[\s\S]{0,600}?sec\.dataset\.pane !== opts\.ongletCourant\(\)[\s\S]{0,120}?ouvrirOnglet/.test(mod),
      'viser un panneau n\'ouvre pas l\'onglet qui le contient');
    ['data-somm', 'data-go'].forEach(chemin =>
      assert.ok(new RegExp(chemin).test(mod), `le chemin « ${chemin} » ne mène nulle part`));
    assert.ok(/if \(settingsFocus\) \{[\s\S]{0,200}?reg\.montrer\(/.test(page),
      'un lien venu d\'ailleurs n\'utilise pas la porte commune');
    // La porte est UNE : le sommaire, la recherche et les liens l'appellent tous. Si l'app entreprise
    // se remettait à faire son propre `scrollIntoView`, on aurait deux comportements pour un geste.
    assert.ok(!/scrollIntoView/.test(page.slice(page.indexOf('const showTab'), page.indexOf('let setDirty'))),
      'la page Paramètres refait à la main ce que la porte commune sait faire');

    // 2. Un champ `type=number` vidé rend la CHAÎNE VIDE. Tout réglage numérique de la fiche
    // société doit être borné dans applySettings : trois l'étaient, trois ne l'étaient pas, et
    // vider le timbre fiscal le mettait à 0 sur toutes les factures à venir sans un mot.
    const bornes = page.slice(page.indexOf('const applySettings'), page.indexOf('setGuard('));
    assert.ok(bornes.length > 200, 'applySettings n\'a pas été trouvé');
    const nums = Array.from(new Set((page.match(/'(\w+)', *[^,]+, *'number'/g) || [])
      .map(m => m.match(/'(\w+)'/)[1])));
    assert.ok(nums.length >= 5, 'les champs numériques de Paramètres n\'ont pas été trouvés : ' + nums.join(', '));
    const libres = nums.filter(k => !new RegExp(`data\\.company\\.${k} = `).test(bornes));
    assert.deepStrictEqual(libres, [], 'des réglages numériques ne sont pas bornés après enregistrement');

    // 3. Ce qui se jette sans retour se demande : « Annuler », collé à « Enregistrer », jetait dix
    // minutes de saisie en silence ; « Retirer » éteignait la copie externe de la même façon, sur
    // le panneau qui déclare être le réglage le plus important de la page.
    [['#cancel-set', /#cancel-set'\)\.onclick = async \(\) => \{\s*if \(!await confirmDialog\(/],
     ['#ext-remove', /#ext-remove'\)\.onclick = async \(\) => \{\s*if \(!await confirmDialog\(/]].forEach(([id, re]) => {
      assert.ok(re.test(app), `« ${id} » agit sans poser de question`);
    });
    assert.ok(/setExternalBackup\(null\)/.test(app) && app.indexOf('confirmDialog(\'Arrêter la copie externe') < app.indexOf('await bridge.setExternalBackup(null)'),
      'la copie externe s\'éteint avant la question');
    assert.ok(!/id="cancel-set">Annuler</.test(page), 'le bouton dit encore « Annuler » sans dire ce qu\'il jette');

    // 4. Choisir le thème ne changeait rien tant qu'on n'avait pas trouvé « Enregistrer » en bas de
    // page. C'est visuel et réversible : ça se montre tout de suite. Et si on renonce, ça se défait
    // — sinon l'application reste habillée d'un réglage qu'on vient de refuser.
    assert.ok(/select\[name=theme\]/.test(page) && /themeSel\.onchange = \(\) => \{[\s\S]{0,400}?classList\.toggle\('dark'/.test(page),
      'le thème ne se voit pas avant d\'être enregistré');
    assert.ok(/discard: applyTheme/.test(page), 'un aperçu immédiat ne se défait pas quand on renonce');
    assert.ok(/typeof g\.discard === 'function'/.test(app), 'le garde-fou de navigation ignore le retour en arrière de l\'aperçu');

    // 5. Les couleurs et le logo habillent les DOCUMENTS : c'est le titre du panneau lui-même qui
    // le dit. Les chercher entre le matricule fiscal et le RIB n'a rien d'évident (défaut d'avant
    // la 7.11.0), et l'onglet « Apparence » où ils avaient atterri ne portait plus qu'eux.
    assert.strictEqual(decl['p-marque'], 'documents', 'le panneau « Image de marque » n\'est pas dans l\'onglet Documents');
    const societe = page.slice(page.indexOf('data-pane="societe"'), page.indexOf('data-pane="documents"'));
    assert.ok(!societe.includes('name="accentColor"'), 'les couleurs sont restées dans l\'onglet Société');

    // 5 bis. Le panneau est posé dans la SECTION de l'onglet qu'il déclare. Un panneau posé au bon
    // endroit dans la table et au mauvais endroit dans la page serait masqué avec son voisin, donc
    // inatteignable — et le sommaire de son onglet ne le montrerait pas.
    let pane = '';
    page.split('\n').forEach(l => {
      const m = l.match(/data-pane="([a-z]+)"/); if (m) pane = m[1];
      const p = l.match(/panneau\('(p-[a-z]+)'/); if (p) assert.strictEqual(pane, decl[p[1]],
        `le panneau « ${p[1]} » est posé dans l'onglet « ${pane} » alors qu'il se déclare dans « ${decl[p[1]]} »`);
    });

    // 5 ter. La recherche et le sommaire se construisent à partir de l'ÉCRAN. Une liste écrite à la
    // main oublierait le premier panneau ajouté après elle — et personne ne s'en apercevrait, parce
    // qu'un réglage introuvable ressemble à un réglage qui n'existe pas.
    assert.ok(/function indexer\(corps\)[\s\S]{0,300}?\$\$\('\[data-pane\] \.panel', corps/.test(mod),
      'l\'index de la recherche des réglages n\'est pas déduit de l\'écran');
    assert.ok(/function rafraichirSommaire\(pane\)[\s\S]{0,400}?\$\$\(`\[data-pane="\$\{pane\}"\] \.panel`/.test(mod),
      'le sommaire d\'un onglet n\'est pas déduit de ses panneaux');
    // Et les deux applications le chargent vraiment : un module partagé oublié dans une balise
    // `script` marche en développement et plante une fois l'app construite (défaut de la 7.26.0).
    [['src/renderer/index.html', 'reglages.js'], ['src/cabinet/renderer/index.html', '../../renderer/reglages.js']]
      .forEach(([f, src]) => assert.ok(fs.readFileSync(path.join(__dirname, '..', f), 'utf8').includes(`src="${src}"`),
        `${f} ne charge pas reglages.js`));
    assert.ok(fs.readFileSync(path.join(__dirname, '..', 'build', 'cabinet.config.js'), 'utf8').includes("'src/renderer/reglages.js'"),
      'reglages.js n\'est pas embarqué dans la construction de l\'app cabinet');

    // 6. Un refus dit trois choses : ce qui est refusé, pourquoi, et le bouton qui débloque. Trois
    // refus renvoyaient en prose vers un chemin à retenir — dont un vers un onglet inexistant.
    assert.ok(!/Paramètres → Sécurité\./.test(app), 'un message nomme encore l\'onglet « Sécurité », qui n\'existe pas');
    assert.ok(/security\.encrypted\) \{\s*const c = await choiceDialog\(/.test(app),
      'le verrouillage sans mot de passe refuse sans proposer de l\'activer');
    assert.ok(!/va dans Paramètres → Mises à jour → Lecture de factures/.test(app),
      'la lecture de photo renvoie encore à un chemin à retenir plutôt qu\'à un bouton');
    assert.ok(/emailComptablePret/.test(app) && /allerParametres\('envois', 'p-comptable'\)/.test(app),
      'l\'email du comptable manquant ne mène pas au champ');
  });

  // ---------- 7.12.0 : le droit à l'erreur ----------
  //
  // « Quand on fait une action en se trompant, on ne peut pas revenir en arrière. » Six gestes
  // s'exécutaient sur un clic, sans question ET sans retour visible : celui qu'on a cliqué par
  // erreur, on ne pouvait plus le défaire depuis l'écran où on était.
  //
  // La règle n'est pas « tout confirmer » : dix questions par jour ne se lisent plus, on clique
  // « Oui » sans voir. C'est : ce qui détruit DEMANDE, ce qui se répare laisse un « Annuler » sous
  // la main. Et un « Annuler » qu'on ne peut pas cliquer ne compte pas — d'où la vérification du CSS.
  t('le droit à l\'erreur : ce qui détruit demande, ce qui se répare laisse un retour', () => {
    const brut = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const app = brut.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(app.includes('function toastUndo'), 'le nettoyage des commentaires a mangé le code');
    const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'style.css'), 'utf8');

    // 1. Le bandeau « Annuler » doit pouvoir être CLIQUÉ. `#toast` vit en `pointer-events: none` :
    // sans la levée, le bouton est parfaitement visible et parfaitement inerte — le défaut de la
    // 5.2.2, qui n'apparaît dans aucune console.
    assert.ok(/#toast\.avec-bouton[^}]*pointer-events:\s*auto/.test(css),
      'le bandeau qui porte « Annuler » ne reçoit pas les clics : le bouton serait inerte');
    assert.ok(/t\.className = 'show avec-bouton'/.test(app), 'le bandeau de retour n\'a pas sa classe');
    // Et il dure plus longtemps qu'un message ordinaire : comprendre qu'on s'est trompé prend du temps.
    const ordinaire = Number((app.match(/setTimeout\(\(\) => t\.className = '', (\d+)\)/) || [])[1]);
    const retour = Number((app.match(/t\._timer = setTimeout\(fermer, (\d+)\)/) || [])[1]);
    assert.ok(ordinaire > 0 && retour > ordinaire * 2,
      `le « Annuler » dure ${retour} ms contre ${ordinaire} ms pour un message ordinaire : trop court pour être vu`);

    // 2. Tout appel à `toastUndo` passe vraiment de quoi défaire. Un bandeau qui montre « Annuler »
    // sans rien défaire serait pire que pas de bandeau.
    const appels = (app.match(/toastUndo\([\s\S]{0,400}?\n/g) || []).filter(a => !/^toastUndo\(msg, undo\)/.test(a));
    assert.ok(appels.length >= 4, `seulement ${appels.length} geste(s) offrent un retour : la règle n'est pas appliquée`);
    appels.forEach(a => assert.ok(/, \(\) =>/.test(a), 'un « Annuler » est affiché sans fonction pour défaire : ' + a.slice(0, 90)));

    // 3. Les gestes nommés, un par un. Chacun est ancré sur SON code, pas sur une mention.
    const bloc = (depart, taille) => { const i = app.indexOf(depart); assert.ok(i > 0, 'ancre introuvable : ' + depart); return app.slice(i, i + taille); };
    // « Marquer déposée » : la ligne quitte « À déposer », donc le bouton qui retire la mention
    // n'est plus là où on vient de cliquer.
    assert.ok(/toastUndo\(`Noté : \$\{label\} est déposée/.test(bloc('const mark = async (id, label)', 900)),
      'noter une déclaration déposée ne laisse aucun retour');
    // « Attestation reçue » : même chose, la ligne quitte la liste des manquantes.
    assert.ok(/toastUndo\('Attestation notée reçue/.test(bloc("$$('[data-cert]')", 600)),
      'noter une attestation reçue ne laisse aucun retour');
    // Suspendre / reprendre un contrat DÉPLACE la prochaine échéance : l'ancienne date est perdue.
    // Depuis la 7.29.0 le geste de la liste vit dans le menu d'actions et non plus sur un bouton
    // `[data-toggle]` : c'est l'ancre qui change, pas la règle.
    ["const basculer = (r) => {", "$('#c-toggle').onclick"].forEach(ancre => {
      const b = bloc(ancre, 900);
      assert.ok(/const avant = \{ active: r\.active, nextDate: r\.nextDate \}/.test(b) && /toastUndo\(msg, \(\) => \{ Object\.assign\(r, avant\)/.test(b),
        `reprendre un contrat déplace sa date sans retour possible (${ancre})`);
    });
    // Ce qui DÉTRUIT demande d'abord : les numéros de compte dictés par le cabinet, et une volée de
    // brouillons qu'il faudrait ensuite supprimer un par un.
    assert.ok(/await confirmDialog\(/.test(bloc("$('#ch-reset', layer).onclick", 700)),
      'remettre le plan de comptes à zéro ne demande rien');
    assert.ok(/await confirmDialog\(/.test(bloc("$('#gen-due').onclick", 700)),
      'générer tous les brouillons d\'un coup ne demande rien');
  });

  // ---------- 7.15.0 : tout ce qui se lit se clique ----------

  t('un filtre qui regroupe plusieurs statuts est une fonction, pas une chaîne', () => {
    // « Émis » figurait dans le menu de statuts de la liste des factures depuis la 2.x, et le
    // filtrage faisait `effectiveStatus(d) === 'émis'`. Aucune facture ne porte ce statut — mais les
    // AVOIRS, si : choisir « Émis » sur une liste de 25 pièces rendait 2 avoirs. Une liste vide se
    // remarque tout de suite ; une liste FAUSSE, non. Mesuré dans l'application avant correction.
    assert.strictEqual(typeof core.docFiltre, 'function');
    // Sans filtre, tout passe.
    ['brouillon', 'envoyée', 'partielle', 'retard', 'payée', 'annulée'].forEach(st =>
      assert.strictEqual(core.docFiltre('', st), true, `sans filtre, « ${st} » doit passer`));
    // « Émis » = tout ce qui porte un numéro et compte, donc ni brouillon ni annulée.
    assert.strictEqual(core.docFiltre('émis', 'envoyée'), true, '« Émis » doit garder une facture envoyée');
    assert.strictEqual(core.docFiltre('émis', 'payée'), true);
    assert.strictEqual(core.docFiltre('émis', 'retard'), true);
    assert.strictEqual(core.docFiltre('émis', 'brouillon'), false, 'un brouillon n\'est pas émis');
    assert.strictEqual(core.docFiltre('émis', 'annulée'), false, 'une facture annulée ne compte plus');
    // « À encaisser » = ce qu'on attend vraiment, c'est-à-dire le compteur du tableau de bord.
    ['envoyée', 'partielle', 'retard'].forEach(st =>
      assert.strictEqual(core.docFiltre('à encaisser', st), true, `« à encaisser » doit garder « ${st} »`));
    ['payée', 'brouillon', 'annulée'].forEach(st =>
      assert.strictEqual(core.docFiltre('à encaisser', st), false, `« à encaisser » ne doit pas garder « ${st} »`));
    // Un statut ordinaire reste une égalité stricte.
    assert.strictEqual(core.docFiltre('payée', 'payée'), true);
    assert.strictEqual(core.docFiltre('payée', 'retard'), false);

    // Et le compte annoncé sur l'accueil est CELUI que le filtre rend : les deux se calculent avec
    // la même règle, sinon la carte promet six factures et la liste en montre quatre.
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const carte = app.match(/const open = data\.documents\.filter\(d => d\.type === 'facture' && \[([^\]]+)\]/);
    assert.ok(carte, 'le calcul de « Reste à encaisser » est introuvable');
    const statutsCarte = carte[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
    statutsCarte.forEach(st => assert.strictEqual(core.docFiltre('à encaisser', st), true,
      `la carte « Reste à encaisser » compte « ${st} », que le filtre de la liste ne garde pas`));
  });

  t('« Ce qui manque » : chaque ligne mène aux pièces concernées', () => {
    const brut = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const app = brut.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(app.includes('CHECK_ACTIONS'), 'le nettoyage des commentaires a mangé le code');

    // La couverture, comme pour « À faire » en 7.0.0 : ce que la SOURCE peut produire contre ce que
    // l'interface sait ouvrir. Les identifiants sont lus dans core.js, jamais recopiés à la main —
    // une liste en dur se périmerait au premier contrôle ajouté.
    const coreSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'core.js'), 'utf8');
    const bloc = coreSrc.slice(coreSrc.indexOf('function closureChecks'), coreSrc.indexOf('function packPlan'));
    const produits = new Set();
    (bloc.match(/add\('([\w-]+)'/g) || []).forEach(m => produits.add(m.match(/'([\w-]+)'/)[1]));
    (bloc.match(/id: '([\w-]+)', level:/g) || []).forEach(m => produits.add(m.match(/'([\w-]+)'/)[1]));
    assert.ok(produits.size >= 7, `seulement ${produits.size} sortes de manques trouvées : l'analyse a raté des lignes`);

    const table = app.slice(app.indexOf('const CHECK_ACTIONS = {'), app.indexOf('const TODO_VISIBLE'));
    const armes = new Set((table.match(/^\s{4}'?([\w-]+)'?: \{ label:/gm) || [])
      .map(m => m.match(/'?([\w-]+)'?: \{ label:/)[1]));
    const orphelins = [...produits].filter(id => !armes.has(id));
    assert.deepStrictEqual(orphelins, [],
      'des lignes de « Ce qui manque » ne mènent nulle part : ' + orphelins.join(', '));

    // Et le bouton est vraiment posé et branché, pas seulement décrit dans une table.
    assert.ok(/data-check="\$\{h\(c\.id\)\}"/.test(app), 'les lignes ne portent pas de bouton');
    assert.ok(/\$\$\('\[data-check\]'\)\.forEach\(b => b\.onclick = \(\) => CHECK_ACTIONS\[b\.dataset\.check\]\.run\(\)\)/.test(app),
      'les boutons de « Ce qui manque » ne sont pas branchés');

    // Et le piège qui rendait plusieurs de ces boutons inertes : `navigate` pose le hash, le routeur
    // réagit au `hashchange` — donc viser la page où l'on EST déjà ne redessine rien, alors que
    // l'onglet et le filtre viennent d'être changés juste au-dessus. « Voir les factures » depuis
    // Comptabilité → Cabinet vise l'onglet Ventes de la même page : il ne se passait rien.
    assert.ok(/const vers = \(hash, avant\) => \(\) => \{[\s\S]{0,200}?if \(location\.hash === hash\) render\(\); else navigate\(hash\);/.test(app),
      'un raccourci qui vise la page courante ne redessine pas : le clic est avalé en silence');
  });

  t('les chiffres du tableau de bord mènent à la liste qu\'ils résument', () => {
    const brut = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const app = brut.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'style.css'), 'utf8');

    // Chaque carte déclarée dans le tableau de bord a son action, et réciproquement : une carte sans
    // action serait un clic avalé en silence, une action sans carte du code mort.
    // On lit le tableau de bord seul : d'autres pages posent des cartes cliquables avec leur propre
    // gestionnaire (le Stock depuis la 7.17.0). La règle universelle — toute page qui pose une carte
    // doit aussi l'armer — est vérifiée juste après, page par page.
    const dash = app.slice(app.indexOf('routes.dashboard ='), app.indexOf('function barChart('));
    const cartes = new Set((dash.match(/data-stat="([\w-]+)"/g) || []).map(m => m.match(/"([\w-]+)"/)[1]));
    assert.ok(cartes.size >= 4, `seulement ${cartes.size} carte(s) cliquable(s) : les quatre chiffres doivent mener quelque part`);
    const bloc = app.slice(app.indexOf('const STAT_ACTIONS = {'), app.indexOf('$$(\'[data-stat]\')'));
    const armes = new Set((bloc.match(/^\s+'?([\w-]+)'?: vers\(/gm) || []).map(m => m.match(/'?([\w-]+)'?: vers\(/)[1]));
    assert.deepStrictEqual([...cartes].filter(k => !armes.has(k)), [], 'une carte de chiffre ne mène nulle part');
    assert.deepStrictEqual([...armes].filter(k => !cartes.has(k)), [], 'une action de carte ne correspond à aucune carte');

    // La règle qui vaut pour toutes les pages : celle qui POSE une carte cliquable doit l'armer.
    // Sans ce contrôle, une carte ajoutée ailleurs afficherait son chevron et avalerait le clic.
    app.split(/\n  routes\.(?=\w+ =)/).forEach(bloc2 => {
      if (!/data-stat="/.test(bloc2)) return;
      const nom = (bloc2.match(/^(\w+) =/) || [, 'dashboard'])[1];
      assert.ok(/data-stat\]'\)/.test(bloc2) || /STAT_ACTIONS\[/.test(bloc2),
        `la page « ${nom} » pose une carte cliquable et ne l'arme pas : le clic serait avalé`);
    });

    // Elle le DIT : curseur, relief au survol, chevron. Sans ces signes personne ne clique un chiffre.
    assert.ok(/\.stat\[data-stat\][^}]*cursor: pointer/.test(css), 'une carte cliquable sans curseur de clic ne s\'essaie pas');
    assert.ok(/\.stat\[data-stat\]:hover/.test(css), 'aucun état au survol');
    assert.ok(/\.stat\[data-stat\]::after/.test(css), 'aucun chevron : rien ne dit que ça mène quelque part');
    // Et au clavier : `role="button"` + tabindex + Entrée/Espace.
    assert.ok(/role="button" tabindex="0"/.test(app), 'les cartes ne sont pas atteignables au clavier');
    assert.ok(/e\.key === 'Enter' \|\| e\.key === ' '/.test(app), 'Entrée et Espace n\'activent pas la carte');
    // La bulle « i » explique le chiffre : elle ne doit pas naviguer.
    assert.ok(/e\.target\.closest\('button\.i, a'\)\) return/.test(app),
      'cliquer la bulle « i » d\'une carte navigue au lieu d\'expliquer');
  });

  // ---------- 7.16.0 : les chiffres qui mentent ----------

  t('accueil : une facture en euros ne s\'additionne pas à une facture en dinars', () => {
    // Montants calculés À LA MAIN avant de regarder ce que le code rend (règle de la 7.0.1, la
    // leçon la plus coûteuse du projet) :
    //   facture DT : 1 000 HT
    //   facture EUR : 500 HT au taux 3,4 → 1 700 DT
    //   total attendu : 2 700 DT — et surtout PAS 1 500.
    const co = { ...core.DEFAULT_COMPANY, currency: 'DT', stampFee: 0 };
    const ligne = (pu) => [{ label: 'x', qty: 1, unit: 'u', unitPrice: pu, vatRate: 0 }];
    const data = core.migrateData({
      version: 6, company: co,
      documents: [
        { id: 'a', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', date: '2026-03-10', clientId: 'c', lines: ligne(1000), payments: [] },
        { id: 'b', type: 'facture', number: 'FAC-2026-002', status: 'envoyée', date: '2026-03-11', clientId: 'c', currency: 'EUR', exchangeRate: 3.4, lines: ligne(500), payments: [] }
      ],
      clients: [{ id: 'c', name: 'Client' }]
    });
    const issued = data.documents;
    const brut = issued.reduce((s, d) => s + core.computeTotals(d, co).netHT, 0);
    const converti = issued.reduce((s, d) => s + core.toBase(d, core.computeTotals(d, co).netHT, co), 0);
    assert.strictEqual(core.round3(brut), 1500, 'le calcul « sans conversion » n\'est pas celui qu\'on croit');
    assert.strictEqual(core.round3(converti), 2700, '1 000 DT + 500 EUR à 3,4 font 2 700 DT');

    // Et l'accueil doit prendre le second. Le graphique juste en dessous convertit depuis toujours
    // (`monthlySeries` passe par `toBase`) : deux chiffres du même écran ne peuvent pas raconter
    // deux années différentes.
    const brutApp = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const app = brutApp.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(app.includes('routes.dashboard'), 'le nettoyage des commentaires a mangé le code');
    const tdb = app.slice(app.indexOf('routes.dashboard = () =>'), app.indexOf('routes.modules = () =>'));
    assert.ok(tdb.length > 400, 'le tableau de bord est introuvable');
    ['sumHT', 'sumTTC', 'sumQ'].forEach(f => {
      const m = tdb.match(new RegExp(`const ${f} = list => list\\.reduce\\([^\\n]*`));
      assert.ok(m, `${f} est introuvable`);
      assert.ok(/enDinars\(/.test(m[0]), `${f} additionne des devises sans les convertir : ${m[0].trim().slice(0, 90)}`);
    });
    const open = tdb.match(/const openAmount = open\.reduce\([^\n]*/);
    assert.ok(open && /enDinars\(/.test(open[0]), '« Reste à encaisser » additionne des devises sans les convertir');
    // La même carte existe sur Comptabilité : le correctif se vérifie des deux côtés.
    const compta = app.slice(app.indexOf('routes.compta = () =>'), app.indexOf('function drawVat'));
    const open2 = compta.match(/const openAmount = open\.reduce\([^\n]*/);
    assert.ok(open2 && /C\.toBase\(/.test(open2[0]), '« Reste à encaisser » de la Comptabilité ne convertit pas');
  });

  t('marges : les cartes portent sur toutes les lignes, pas sur les vingt premières', () => {
    // 25 clients, chacun une facture : la 21e à 25e ligne existent et doivent compter.
    const co = { ...core.DEFAULT_COMPANY, currency: 'DT', stampFee: 0 };
    const clients = [], docs = [];
    for (let i = 0; i < 25; i++) {
      clients.push({ id: 'c' + i, name: 'Client ' + String(i).padStart(2, '0') });
      docs.push({ id: 'd' + i, type: 'facture', number: 'FAC-2026-' + String(i + 1).padStart(3, '0'),
        status: 'envoyée', date: '2026-04-0' + (i % 9 + 1), clientId: 'c' + i,
        lines: [{ label: 'p' + i, qty: 1, unit: 'u', unitPrice: 100, vatRate: 0 }], payments: [] });
    }
    const data = core.migrateData({ version: 6, company: co, documents: docs, clients });
    const vingt = core.marginBy(data, co, '2026-01-01', '2026-12-31', 'client', 20);
    const toutes = core.marginBy(data, co, '2026-01-01', '2026-12-31', 'client', 0);
    assert.strictEqual(vingt.length, 20, 'une limite explicite doit encore tronquer');
    assert.strictEqual(toutes.length, 25, '`limit` à 0 doit rendre TOUT — `limit || 20` le ramenait à 20');
    // 25 factures à 100 HT : le chiffre d'affaires est 2 500, pas 2 000.
    assert.strictEqual(core.round3(toutes.reduce((s, r) => s + r.revenue, 0)), 2500);
    assert.strictEqual(core.round3(vingt.reduce((s, r) => s + r.revenue, 0)), 2000,
      'la troncature coûte bien 500 DT : c\'est ce que la carte annonçait');
    // Sans argument, le comportement d'avant ne change pas (les appelants existants).
    assert.strictEqual(core.marginBy(data, co, '2026-01-01', '2026-12-31', 'client').length, 20);

    const brutApp = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const app = brutApp.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const bloc = app.slice(app.indexOf('function drawAnalysis'), app.indexOf('function drawContracts'));
    assert.ok(/C\.marginBy\(data, company\(\), p\.from, p\.to, s\.dim, 0\)/.test(bloc),
      'la page Marges calcule encore ses cartes sur un tableau tronqué');
    assert.ok(/const pg = paginate\(rows, s\)/.test(bloc) && /pagerBar\(pg,/.test(bloc) && /bindPager\(/.test(bloc),
      'la table des marges n\'est pas paginée comme toutes les autres listes');
  });

  t('l\'affaire suit le devis jusqu\'à la facture, et l\'avoir s\'en retranche', () => {
    const brutApp = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const app = brutApp.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    // Les TROIS chemins de facturation d'un devis passent par `invoiceFromQuote` : c'est là que
    // `projectId` se recopie, sinon la fiche d'affaire affiche 0 facturé pendant que les achats
    // rattachés, eux, sont comptés — l'affaire paraît perdre de l'argent.
    const inv = app.match(/Object\.assign\(inv, \{ clientId: quote\.clientId[^\n]*/);
    assert.ok(inv, 'invoiceFromQuote est introuvable');
    assert.ok(/projectId: quote\.projectId/.test(inv[0]), 'l\'affaire est perdue quand le devis devient facture');
    const credit = app.slice(app.indexOf('function creditDraftFrom'), app.indexOf('function creditDraftFrom') + 700);
    assert.ok(/projectId: inv\.projectId/.test(credit), 'l\'avoir ne se retranche pas de l\'affaire de sa facture');
    // Et `projectMargin` lit bien ce champ-là : sans ça le correctif ne servirait à rien.
    const coreSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'core.js'), 'utf8');
    assert.ok(/d\.projectId === projectId/.test(coreSrc), 'projectMargin ne lit plus projectId');
  });

  t('une facture fournisseur saisie deux fois est signalée', () => {
    const data = { purchases: [
      { id: 'p1', kind: 'facture', supplierId: 's1', number: 'F-2026-88', date: '2026-03-01', lines: [] },
      { id: 'p2', kind: 'depense', supplierId: 's1', number: '', date: '2026-03-02', lines: [] }
    ] };
    // Le même fournisseur et le même numéro, à la casse et aux espaces près.
    assert.ok(core.achatDoublon(data, { id: 'neuf', kind: 'facture', supplierId: 's1', number: ' f-2026-88 ' }),
      'le doublon doit être trouvé malgré la casse et les espaces');
    assert.strictEqual(core.achatDoublon(data, { id: 'neuf', kind: 'facture', supplierId: 's2', number: 'F-2026-88' }), null,
      'un autre fournisseur peut porter le même numéro : ce n\'est pas un doublon');
    assert.strictEqual(core.achatDoublon(data, { id: 'p1', kind: 'facture', supplierId: 's1', number: 'F-2026-88' }), null,
      'une pièce ne peut pas être son propre doublon — sinon on ne pourrait plus la modifier');
    assert.strictEqual(core.achatDoublon(data, { id: 'n', kind: 'facture', supplierId: 's1', number: '' }), null,
      'sans numéro, il n\'y a rien à comparer');
    assert.strictEqual(core.achatDoublon(data, { id: 'n', kind: 'depense', supplierId: 's1', number: 'F-2026-88' }), null,
      'une dépense n\'a pas de numéro qui fasse foi');

    const brutApp = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const app = brutApp.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    // On PRÉVIENT, on ne refuse pas : un fournisseur peut recycler ses numéros d'une année sur
    // l'autre. Et les deux chemins d'enregistrement posent la question — le bouton et le garde-fou.
    assert.ok(/async function doublonOk\(\)[\s\S]{0,600}?await confirmDialog\(/.test(app),
      'le doublon n\'est pas signalé au moment d\'enregistrer');
    assert.ok(/if \(!await doublonOk\(\)\) return;/.test(app), 'le bouton « Enregistrer » ne pose pas la question');
    assert.ok(/save: async \(\) => \{ if \(!validate\(\) \|\| !await doublonOk\(\)\)/.test(app),
      'quitter la page en enregistrant contourne la question');
  });

  t('un devis déjà facturé ne propose plus « Facturer ce devis » en bouton coloré', () => {
    const data = { documents: [
      { id: 'q1', type: 'devis' }, { id: 'q2', type: 'devis' },
      { id: 'f1', type: 'facture', fromQuoteId: 'q1' },
      { id: 'f2', type: 'facture', fromQuoteId: 'q1', deposit: { percent: 30 } }
    ] };
    assert.strictEqual(core.facturesDuDevis(data, 'q1').length, 2);
    assert.strictEqual(core.facturesDuDevis(data, 'q2').length, 0);
    assert.strictEqual(core.facturesDuDevis(data, '').length, 0, 'un devis sans identifiant ne « descend » pas toute la base');

    const brutApp = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    const app = brutApp.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    // `facturerDevis` marque le devis « accepté » : la condition restait donc vraie après coup, et
    // un second clic fabriquait une seconde facture complète.
    assert.ok(/const devisFacturable = [\s\S]{0,220}?!dejaFacture\.length && !issuedDeposits\.length/.test(app),
      'le bouton coloré reste offert sur un devis déjà facturé');
    // Un acompte émis : le geste suivant est le SOLDE, pas 100 % du devis.
    assert.ok(/issuedDeposits\.length\s*\n?\s*\? `<button class="btn btn-primary" id="settle2">Facture de solde/.test(app),
      'après un acompte, le bouton principal doit être la facture de solde');
    // Déjà facturé : on mène à la facture.
    assert.ok(/id="voir-facture">Voir \$\{h\(dejaFacture\[0\]\.number/.test(app), 'rien ne mène à la facture déjà établie');
    // Refacturer reste possible — derrière une question qui nomme les pièces existantes. Depuis la
    // 7.29.0 cette question vit DANS `facturerDevis` : posée chez l'appelant, elle ne protégeait que
    // cet appelant-là, et le menu de ligne de la 7.28.0 est reparti sans elle.
    assert.ok(/Refacturer la totalité/.test(app), 'refacturer la totalité a disparu');
    assert.ok(/async function facturerDevis\(q\) \{[\s\S]{0,600}?await confirmDialog\([\s\S]{0,400}?'Refacturer la totalité', true\)/.test(app),
      'refacturer la totalité ne demande rien');
  });

  // ---------- 7.17.0 : les écrans qui ne répondent pas ----------
  // Un écran qui accepte un geste et n'en fait rien est le pire défaut d'interface : rien ne plante,
  // aucune console ne dit rien, et l'utilisateur finit par douter de lui avant de douter du logiciel.
  // Ces contrôles lisent la SOURCE : ce sont des branchements, et aucun calcul ne les couvre.

  t('pointer un mouvement se défait', () => {
    const app = lireApp();
    // Le drapeau vit sur le paiement d'origine. Le retrouver deux fois (au clic, puis à l'annulation)
    // est indispensable : entre les deux, `draw()` a reconstruit la liste et l'objet cherché par
    // référence n'est plus celui qu'on afficherait.
    assert.ok(/const porteur = id => \{/.test(app), 'la recherche du porteur du drapeau n\'est plus factorisée');
    assert.ok(/const avant = !!hit\.reconciled;[\s\S]{0,260}?toastUndo\([\s\S]{0,200}?const h2 = porteur\(id\);[\s\S]{0,140}?h2\.reconciled = avant;/.test(app),
      'pointer un mouvement ne laisse aucun « Annuler » qui remette l\'état d\'avant');
    // Et le panneau qui rend la chose relisible un mois plus tard.
    assert.ok(/const pointes = r\.moves\.filter\(m => m\.reconciled\)/.test(app), 'les mouvements déjà pointés ne sont listés nulle part');
    assert.ok(/Déjà pointés — \$\{pl\(pointes\.length, 'mouvement'\)\}/.test(app), 'le panneau des pointés ne dit pas combien il en contient');
    // La case doit porter son état : sans `checked`, le panneau des pointés afficherait des cases vides.
    assert.ok(/data-rec="\$\{h\(m\.id\)\}"[^\n]*\$\{m\.reconciled \? 'checked' : ''\}/.test(app),
      'la case d\'un mouvement pointé ne se montre pas cochée');
  });

  t('le solde de tout compte se tape sans perdre le curseur', () => {
    const app = lireApp();
    // Le total a son propre élément : c'est LUI qu'on recalcule, jamais tout le tableau.
    assert.ok(/const total = \(\) => C\.round3\(lines\.reduce/.test(app), 'le total du solde de tout compte n\'est plus une fonction à part');
    assert.ok(/<b id="hf-total">/.test(app), 'le total n\'a pas d\'élément à lui : il faut redessiner pour le mettre à jour');
    const bloc = (app.match(/\$\$\('\[data-f\]', \$\('#hf-lines', root\)\)\.forEach\(el => el\.oninput = \(\) => \{[\s\S]*?\n          \}\);/) || [''])[0];
    assert.ok(bloc, 'le gestionnaire de saisie du solde de tout compte est introuvable');
    assert.ok(/#hf-total.*?textContent/.test(bloc), 'la saisie ne met pas le total à jour');
    assert.ok(!/drawLines\(\);/.test(bloc), 'la saisie redessine tout le bloc : le curseur saute à chaque caractère');
  });

  t('un sélecteur d\'année ne reste jamais visible sur un onglet qui l\'ignore', () => {
    const app = lireApp();
    // La RÈGLE, pas la liste : tout onglet qui ne lit pas l'année doit figurer dans la liste
    // d'exclusion. On la vérifie en confrontant les deux listes du code.
    const mg = (app.match(/const MG_SANS_ANNEE = \[([^\]]*)\]/) || [, ''])[1];
    const pa = (app.match(/const P_SANS_ANNEE = \[([^\]]*)\]/) || [, ''])[1];
    ['affaires', 'contrats'].forEach(k => assert.ok(mg.includes(`'${k}'`), `Marges → ${k} n'utilise pas l'année : le sélecteur doit y disparaître`));
    ['salaries', 'avances', 'registre', 'baremes'].forEach(k => assert.ok(pa.includes(`'${k}'`), `Paie → ${k} n'utilise pas l'année : le sélecteur doit y disparaître`));
    assert.ok(/\$\('#mg-year'\)\.hidden = MG_SANS_ANNEE\.includes\(s\.tab\)/.test(app), 'le sélecteur de Marges ne suit pas la liste');
    assert.ok(/id="p-year" \$\{P_SANS_ANNEE\.includes\(s\.tab\) \? 'hidden' : ''\}/.test(app), 'le sélecteur de Paie ne suit pas la liste');
  });

  t('un en-tête qui annonce un tri trie vraiment', () => {
    const app = lireApp();
    // `bindSort` passe la colonne cliquée à son rappel. Un rappel qui ne la prend pas la jette : les
    // « ⇅ » s'affichent, le clic est accepté, et la liste ne bouge pas.
    const mauvais = (app.match(/bindSort\([^,]+,\s*\(\)\s*=>/g) || []);
    assert.deepStrictEqual(mauvais, [], `un bindSort jette la colonne cliquée : ${mauvais.join(' · ')}`);
    // `bindDocTable` passe SON premier argument à `bindSort` : le rappel y arrive donc avec la même
    // contrainte, et la fiche d'affaire le violait — `bindDocTable(() => render(), …)` — sans que ce
    // test puisse le voir, parce qu'il ne regardait que les appels DIRECTS. Les huit en-têtes de
    // « Ventes rattachées » ont donc accepté le clic sans trier pendant quatre versions.
    const mauvais2 = (app.match(/bindDocTable\(\s*\(\)\s*=>/g) || []);
    assert.deepStrictEqual(mauvais2, [], `un bindDocTable jette la colonne cliquée : ${mauvais2.join(' · ')}`);
    assert.ok(/const drawVentes = sortKey => \{\s*if \(sortKey\) \{ affaireDocState\.sort = toggleSort/.test(app),
      'la fiche d\'affaire ne trie pas ses ventes rattachées');
    // Et les deux qui étaient fautifs portent bien leur toggleSort.
    assert.ok(/bindSort\(wrap\.closest\('\.panel'\), key => \{ s\.moves\.sort = toggleSort/.test(app), 'Trésorerie → Mouvements ne trie pas');
    assert.ok(/bindSort\(\$\('#sup-docs'\), key => \{ supplierBuyState\.sort = toggleSort/.test(app), 'la fiche fournisseur ne trie pas');
  });

  t('les mouvements ne sont plus figés sur l\'année en cours', () => {
    const app = lireApp();
    // Trésorerie et Stock écrivaient l'année dans le code : le 3 janvier, la page devenait vide et
    // l'exercice écoulé inatteignable — le moment précis où on vient le consulter.
    assert.ok(/const period = \{ from: `\$\{s\.year\}-01-01`, to: `\$\{s\.year\}-12-31` \};/.test(app),
      'la Trésorerie lit encore une année écrite dans le code');
    assert.ok(/<select id="t-year">/.test(app) && /\$\('#t-year'\)\.onchange/.test(app), 'la Trésorerie n\'offre pas de choisir l\'année');
    assert.ok(/<select id="st-year">/.test(app) && /\$\('#st-year'\)\.onchange/.test(app), 'le Stock n\'offre pas de choisir l\'année');
    assert.ok(!/const year = C\.today\(\)\.slice\(0, 4\);\n      const all = C\.stockJournal/.test(app),
      'le journal de stock repart de l\'année en cours quoi qu\'on choisisse');
  });

  t('l\'export CSV du Stock suit l\'onglet ouvert', () => {
    const app = lireApp();
    const bloc = (app.match(/const ST_EXPORTS = \{[\s\S]*?\n    \};/) || [''])[0];
    assert.ok(bloc, 'l\'export du Stock ne connaît pas les onglets');
    // La RÈGLE : chaque onglet de STOCK_TABS a son export. Une liste en dur se périmerait au
    // prochain onglet ajouté ; on relit les onglets déclarés dans la source.
    const tabs = (app.match(/const STOCK_TABS = (\[[\s\S]*?\]\];)/) || [, ''])[1];
    const ids = (tabs.match(/\['([a-z]+)',/g) || []).map(x => x.slice(2, -2));
    assert.ok(ids.length >= 5, 'les onglets du Stock n\'ont pas été relus');
    ids.forEach(id => assert.ok(new RegExp(`\\n      ${id}: \\(\\) => \\(\\{`).test(bloc), `l'onglet « ${id} » n'a pas d'export : il recevrait l'état du stock`));
    assert.ok(/const e = \(ST_EXPORTS\[s\.tab\] \|\| ST_EXPORTS\.etat\)\(\);/.test(app), 'l\'export ne consulte pas l\'onglet ouvert');
    // Et le bouton DIT ce qu'il exporte : « Exporter en CSV » sur cinq onglets ne renseigne personne.
    ids.forEach(id => assert.ok(new RegExp(`${id}: '`).test((app.match(/const ST_LABELS = \{[\s\S]*?\};/) || [''])[0]),
      `l'onglet « ${id} » n'a pas de libellé d'export`));
    assert.ok(/id="st-csv" data-csv="\$\{h\(s\.tab\)\}">Exporter \$\{h\(ST_LABELS\[s\.tab\]/.test(app),
      'le bouton d\'export du Stock ne nomme pas ce qu\'il exporte');
  });

  t('les compteurs rouges du Stock ouvrent la liste qu\'ils annoncent', () => {
    const app = lireApp();
    assert.ok(/data-stat="low"/.test(app) && /data-stat="neg"/.test(app), 'les deux compteurs du Stock ne sont pas cliquables');
    assert.ok(/const versAlertes = \(\) => \{ s\.tab = 'alertes';/.test(app), 'les compteurs ne mènent pas aux alertes');
    // Clavier ET souris, et la bulle « i » explique sans naviguer (règle de la 7.15.0).
    assert.ok(/\$\$\('#st-body \.stat\[data-stat\]'\)\.forEach\([\s\S]{0,400}?e2\.target\.closest\('\.i\[data-info\]'\)/.test(app),
      'cliquer la bulle « i » du compteur navigue au lieu d\'expliquer');
    assert.ok(/\$\$\('#st-body \.stat\[data-stat\]'\)\.forEach\([\s\S]{0,500}?onkeydown/.test(app), 'les compteurs du Stock ne répondent pas au clavier');
  });

  // ---------- 7.18.0 : l'accueil tient ses promesses ----------

  t('une ligne « À faire » qui pose un filtre le pose en entier', () => {
    const app = lireApp();
    // Cinq réglages à remettre, recopiés à la main dans chaque action : « Facturer » en oubliait un
    // (`yearTouched`), et la liste d'arrivée se re-filtrait toute seule sur l'année en cours — donc
    // cachait précisément les devis que la ligne venait d'annoncer. Le helper rend l'oubli impossible.
    assert.ok(/const filtre = \(liste, st, extra\) => \(\) => Object\.assign\(listState\[liste\],[\s\S]{0,240}?yearTouched: true, page: 1 \}/.test(app),
      'le helper de filtre de liste n\'existe plus');
    // Plus aucune action ne bricole `listState` à la main dans une table d'actions.
    const tables = app.slice(app.indexOf('const TODO_ACTIONS = {'), app.indexOf('const TODO_VISIBLE'))
      + app.slice(app.indexOf('const STAT_ACTIONS = {'), app.indexOf('$$(\'[data-stat]\')'));
    const bricolage = (tables.match(/listState\.\w+\.\w+ =/g) || []);
    assert.deepStrictEqual(bricolage, [],
      `une action pose un filtre à la main au lieu de passer par filtre() : ${bricolage.join(' · ')}`);
  });

  t('un raccourci qui vise un panneau y amène', () => {
    const app = lireApp();
    // « n attestations à réclamer » déposait en haut de Comptabilité → Ventes, trois écrans au-dessus
    // du panneau visé. `settingsFocus` faisait déjà ça pour les Paramètres depuis la 7.11.0.
    assert.ok(/let pageFocus = '';/.test(app), 'le mécanisme de mise au point sur un panneau n\'existe plus');
    assert.ok(/if \(pageFocus\) \{[\s\S]{0,300}?pageFocus = '';[\s\S]{0,300}?scrollIntoView/.test(app),
      'le routeur ne consomme pas pageFocus après le rendu');
    assert.ok(/pageFocus = 'p-rs-clients';/.test(app) && /id="p-rs-clients"/.test(app),
      'la ligne des attestations ne vise pas le panneau des retenues');
  });

  t('« Rien à faire » ne s\'affiche pas au-dessus de « Tes premiers pas »', () => {
    const app = lireApp();
    assert.ok(/if \(premiersPasVisibles\(\) \|\| \(!data\.documents\.length && !data\.clients\.length\)\) return '';/.test(app),
      '« Rien à faire aujourd\'hui » peut encore s\'afficher sous « étape 1 sur 7 »');
  });

  t('l\'étape « catalogue » ne se coche pas parce que l\'assistant l\'a faite', () => {
    // L'assistant propose les prestations du métier, avec des prix à 0. L'étape était réputée faite.
    const avecSetup = { catalog: [{ id: 'a', label: 'X', unitPrice: 0, fromSetup: true }] };
    const e1 = core.firstSteps(avecSetup, {}, {}).etapes.find(x => x.id === 'catalogue');
    assert.strictEqual(e1.fait, false, 'un catalogue d\'exemples sans prix ne vaut pas un catalogue');
    assert.ok(/Ajuster les prix/.test(e1.titre), 'le titre ne dit pas ce qu\'il reste à faire');
    assert.ok(/exemples, pas tes tarifs/.test(e1.quoi), 'l\'explication ne dit pas que ce sont des exemples');
    // Un prix ajusté suffit : on ne réclame pas les douze.
    const ajuste = { catalog: [{ id: 'a', label: 'X', unitPrice: 0, fromSetup: true }, { id: 'b', label: 'Y', unitPrice: 120, fromSetup: true }] };
    assert.strictEqual(core.firstSteps(ajuste, {}, {}).etapes.find(x => x.id === 'catalogue').fait, true);
    // Une prestation saisie à la main aussi, même à 0 (c'est une décision, pas un reste d'assistant).
    const main = { catalog: [{ id: 'a', label: 'X', unitPrice: 0 }] };
    assert.strictEqual(core.firstSteps(main, {}, {}).etapes.find(x => x.id === 'catalogue').fait, true);
    assert.strictEqual(core.firstSteps({ catalog: [] }, {}, {}).etapes.find(x => x.id === 'catalogue').fait, false);
    // Et l'assistant marque bien ce qu'il pose.
    const ob = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'onboarding.js'), 'utf8');
    assert.ok(/fromSetup: true/.test(ob), 'l\'assistant ne marque plus les prestations qu\'il propose');
  });

  t('l\'accueil accorde ses pluriels', () => {
    const app = lireApp();
    assert.ok(/const pl = \(n, un, plur\) =>/.test(app), 'le helper de pluriel n\'existe pas dans l\'app entreprise');
    // La règle : un compteur interpolé juste avant « (s) » est un pluriel non accordé. On lit le
    // tableau de bord et `docTable`, les écrans qu'on regarde le plus souvent.
    const zone = app.slice(app.indexOf('routes.dashboard ='), app.indexOf('function bindDocTable('));
    const fautes = (zone.match(/\$\{[^}]+\}\s*[A-Za-zÀ-ÿ' -]+\(s\)/g) || []);
    assert.deepStrictEqual(fautes, [], `pluriel non accordé sur l'accueil : ${fautes.join(' · ')}`);
  });

  t('un extrait de liste n\'affiche pas de total', () => {
    const app = lireApp();
    // « Documents récents » totalisait en HT des devis, des factures et des bons de livraison, et
    // les rangeait sous « Net à payer ». Huit pièces sur deux cents ne font pas un total.
    assert.ok(/\$\{opts\.noFoot \? '' : `<tfoot>/.test(app), 'docTable n\'a plus de mode « sans pied »');
    assert.ok(/docTable\(recent, \{ noFoot: true \}\)/.test(app), '« Documents récents » affiche encore un total');
    assert.ok(/les \$\{recent\.length\} dernières pièces sur \$\{data\.documents\.length\}/.test(app),
      '« Documents récents » ne dit pas qu\'il n\'est qu\'un extrait');
  });

  t('la bulle « À faire » décrit la liste d\'aujourd\'hui', () => {
    const g = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'guide.js'), 'utf8');
    const bulle = (g.match(/'todo': \{ t: 'À faire', d: '([\s\S]*?)', a: '/) || [, ''])[1];
    assert.ok(bulle, 'la bulle « À faire » est introuvable');
    // Une énumération figée se périme à chaque module ajouté : elle en listait huit sur vingt-six.
    // On interdit la forme, et on exige ce qui ne se périme pas : l'ordre, les couleurs, la limite.
    assert.ok(!/contrats à générer, devis acceptés/.test(bulle), 'la bulle énumère encore les lignes une par une');
    assert.ok(/urgent/.test(bulle), 'la bulle ne dit pas que la liste est triée par urgence');
    assert.ok(/rouge/.test(bulle), 'la bulle ne dit pas ce que veut dire une ligne rouge');
    assert.ok(/cinq premières/.test(bulle), 'la bulle ne dit pas que la liste est tronquée à cinq');
  });

  t('« Générer maintenant » se demande et se défait', () => {
    const app = lireApp();
    // Le geste fabrique une facture ET repousse l'échéance du contrat : deux effets qu'un clic de
    // trop laissait en place sans un mot, y compris sur un contrat suspendu.
    assert.ok(/function generateRecurring\(recs, force\) \{\n    let n = 0, skipped = 0; const ids = \[\];/.test(app),
      'generateRecurring ne renvoie plus de quoi annuler');
    assert.ok(/return \{ n, skipped, ids \};/.test(app), 'generateRecurring renvoie encore un simple compteur');
    assert.ok(/async function genererContrat\(r, apres\)[\s\S]{0,900}?await confirmDialog\(/.test(app),
      'générer un contrat suspendu ou en avance ne demande rien');
    assert.ok(/const avance = r\.active === false \|\| r\.nextDate > C\.today\(\);/.test(app),
      'la condition « suspendu ou en avance » a disparu');
    assert.ok(/toastUndo\(`Brouillon créé pour[\s\S]{0,300}?Object\.assign\(r, avant\); save\(true\);/.test(app),
      '« Annuler » ne remet pas les dates du contrat');
    // Et plus aucun appelant ne génère à côté du garde-fou.
    const brut = (app.match(/generateRecurring\(\[r\], true\)/g) || []).length;
    assert.strictEqual(brut, 1, 'un bouton génère encore un contrat sans passer par genererContrat');
  });

  t('un contrat en euros s\'affiche et se trie en euros', () => {
    const app = lireApp();
    const zone = app.slice(app.indexOf('routes.contrats = () => {'), app.indexOf('const relState'));
    assert.ok(/const curOf = r => r\.currency \|\| cur;/.test(zone), 'la devise du contrat n\'est plus lue');
    assert.ok(/get: r => C\.money\(htOf\(r\), curOf\(r\)\)/.test(zone), 'la colonne « HT / facture » affiche la devise de la société');
    // Le tri doit comparer des montants comparables, donc convertis.
    assert.ok(/const htBase = r => C\.toBase\(/.test(zone) && /val: htBase,/.test(zone),
      'le tri compare encore des euros à des dinars');
    // Et le pied dit ce que les contrats rapportent, sur la sélection entière.
    assert.ok(/const actifs = kept\.filter\(r => r\.active !== false\);/.test(zone),
      'le pied des contrats compte les contrats suspendus');
    assert.ok(/par mois · \$\{C\.money\(parAn, cur\)\} par an/.test(zone), 'la page ne dit pas ce que les contrats rapportent');
  });

  t('la recherche des Relances filtre les quatre tableaux', () => {
    const app = lireApp();
    assert.ok(/const matchDoc = d => !q \|\|/.test(app), 'le filtre de document des Relances n\'est plus factorisé');
    const zone = app.slice(app.indexOf('const matchDoc = d => !q'), app.indexOf('const total = od.reduce'));
    const lignes = zone.split('\n').filter(l => /^\s+const (od|soon|quotes) =/.test(l));
    assert.strictEqual(lignes.length, 3, 'les trois sélections des Relances n\'ont pas été relues');
    lignes.forEach(l => assert.ok(/match/.test(l), `une section des Relances ignore la recherche : ${l.trim().slice(0, 70)}`));
  });

  t('on répond à un devis depuis la liste', () => {
    const app = lireApp();
    // Le statut d'un devis se saisit à la main : il fallait pourtant ouvrir la pièce pour dire
    // « le client a dit oui ». Et « Facturer » n'apparaissait qu'après.
    // Depuis la 7.28.0 les deux réponses vivent dans le menu de la ligne, avec une phrase entière
    // au lieu d'un « Accepté ✓ ». On teste la RÈGLE — les réponses sont offertes depuis la liste,
    // sur les devis en attente seulement, et chacune laisse un retour en arrière.
    const menu = app.slice(app.indexOf('bindRowMenus(document, id => {'), app.indexOf('function duplicateDoc'));
    assert.ok(menu.length > 400 && !menu.includes('clientForm('), 'découpage du menu de ligne raté');
    assert.ok(/label: 'Le client a accepté'/.test(menu) && /label: 'Le client a refusé'/.test(menu),
      'rien ne permet de répondre à un devis depuis la liste');
    assert.ok(/d\.type === 'devis' && \['envoyé', 'expiré'\]\.includes\(effStatus\(d\)\)[\s\S]{0,200}?Le client a accepté/.test(menu),
      'les réponses ne sont pas offertes sur les devis en attente seulement');
    // Confirmer AVANT (règle 7.28.0 : un clic qui change l'état d'une pièce commerciale se
    // demande), annoncer APRÈS, et laisser défaire.
    assert.ok(/const repondreAccepte = async id => \{[\s\S]{0,700}?choiceDialog\(/.test(app),
      'accepter un devis ne pose aucune question');
    assert.ok(/const repondreAccepte = async id => \{[\s\S]{0,1200}?toastUndo\(/.test(app),
      'accepter un devis ne laisse aucun retour en arrière');
    assert.ok(/const repondreRefuse = async id => \{[\s\S]{0,500}?confirmDialog\(/.test(app),
      'refuser un devis ne pose aucune question');
    assert.ok(/const repondreRefuse = async id => \{[\s\S]{0,900}?toastUndo\(/.test(app),
      'refuser un devis ne laisse aucun retour en arrière');
    // Et accepter propose LA SUITE : ce qui vient après un devis accepté, c'est la facture.
    assert.ok(/'Accepter et facturer'/.test(app) && /if \(suite === 'a'\) return facturerDevis\(d\)/.test(app),
      'accepter un devis ne propose pas de facturer dans la foulée');
  });

  // ---------- 7.19.0 : l'éditeur de document ----------

  t('le timbre annoncé à côté de la case est celui qui sera compté', () => {
    const app = lireApp();
    // Le timbre est fixé EN DINARS (7.0.1) : sur une facture en euros au taux 3,4 il vaut 0,29 €.
    // L'étiquette montrait le réglage brut — « 1,00 € » — à côté d'un total qui comptait 0,29 €.
    assert.ok(/const timbreAffiche = \(\) => \{[\s\S]{0,420}?C\.rateOf\(doc, company\(\)\)/.test(app),
      'le montant du timbre affiché n\'est plus converti dans la devise de la pièce');
    assert.ok(/<span id="stamp-lbl">\$\{C\.money\(timbreAffiche\(\), cur\)\}<\/span>/.test(app),
      'l\'étiquette du timbre n\'utilise pas le montant réellement compté');
    assert.ok(/const lbl2 = \$\('#stamp-lbl'\); if \(lbl2\) lbl2\.textContent = C\.money\(timbreAffiche\(\), cur\);/.test(app),
      'l\'étiquette ne se recalcule pas quand la devise ou le taux changent');
    // Et le calcul de core reste la référence : sur une facture en EUR, l'étiquette vaut `stamp`.
    const co = { currency: 'DT', stampFee: 1, vatRate: 19 };
    const f = { type: 'facture', currency: 'EUR', exchangeRate: 3.4, applyStamp: true, status: 'envoyée',
      lines: [{ label: 'X', qty: 1, unitPrice: 100, vatRate: 19 }] };
    const t2 = core.computeTotals(f, co);
    assert.ok(Math.abs(t2.stamp - core.round3(1 / 3.4)) < 0.0005,
      `le timbre d'une facture en EUR vaut ${t2.stamp} au lieu de ${core.round3(1 / 3.4)}`);
  });

  t('changer la date recalcule l\'échéance, sauf si elle a été saisie à la main', () => {
    const app = lireApp();
    assert.ok(/let dueAuto = doc\.dueDate;/.test(app), 'l\'échéance automatique n\'est plus mémorisée');
    // La condition porte les DEUX moitiés : c'est la date qui a changé, et l'échéance n'a pas été touchée.
    assert.ok(/e\.target\.name === 'date' && doc\.date && dueAuto && doc\.dueDate === dueAuto/.test(app),
      'l\'échéance se recalcule même quand elle a été saisie à la main');
    assert.ok(/doc\.dueDate = neuf; dueAuto = neuf;\s*\n\s*poserDate\('dueDate', neuf\);/.test(app),
      'la nouvelle échéance n\'est pas écrite dans le champ visible');
    // Un champ date est un COUPLE (règle 3.0.0) : le helper touche les deux, et il est partagé.
    assert.ok(/function poserDateField\(root, name, iso\)[\s\S]{0,420}?hid\.value = iso;[\s\S]{0,300}?txt\.value = iso \? C\.fmtDateInput\(iso\) : '';/.test(app),
      'le helper de champ date ne met plus à jour le couple hidden + texte');
    assert.ok(/poserDateField\(head, 'dueDate', p\.dueDate\);/.test(app), 'l\'éditeur d\'achat ne passe pas par le helper');
    assert.ok(/id="due-auto"/.test(app), 'rien ne dit que l\'échéance vient d\'être recalculée');
  });

  t('une quantité effacée ne vaut pas zéro', () => {
    const app = lireApp();
    // `Number('')` vaut 0 : effacer une quantité pour la retaper faisait tomber la ligne, le total
    // du document et l'aperçu à zéro, sans un mot.
    assert.ok(/const vide = el\.value\.trim\(\) === '' \|\| el\.validity\.badInput;/.test(app),
      'une saisie numérique vide ou illisible est encore convertie en 0');
    assert.ok(/el\.classList\.toggle\('champ-faute', vide\);\s*\n\s*if \(vide\) return;/.test(app),
      'un champ numérique vide n\'est ni marqué ni ignoré');
    // Et on PRÉVIENT à l'émission : une ligne offerte reste légitime.
    assert.ok(/La ligne « \$\{l\.label\} » est à 0/.test(app), 'une ligne à zéro n\'est pas signalée avant d\'émettre');
    assert.ok(/issueWarnings[\s\S]{0,3000}?!\(Number\(l\.qty\) > 0\) \|\| !\(Number\(l\.unitPrice\) > 0\)/.test(app),
      'le contrôle des lignes à zéro n\'est pas dans issueWarnings');
  });

  t('la fiche du client se corrige depuis le document', () => {
    const app = lireApp();
    assert.ok(/id="cl-edit"/.test(app), 'rien ne mène à la fiche du client depuis l\'éditeur');
    assert.ok(/\$\('#cl-edit', head\)\.onclick = \(\) => \{[\s\S]{0,300}?clientForm\(c, \(\)/.test(app),
      'le bouton « Fiche du client » n\'ouvre pas le formulaire');
    // Il n'apparaît que s'il y a un client, et suit le choix.
    assert.ok(/const majFicheClient = \(\) => \{[\s\S]{0,160}?b\.hidden = !doc\.clientId;/.test(app),
      'le bouton reste visible sans client choisi');
    assert.ok(/majFicheClient\(\);\s*\n\s*drawLines\(\);/.test(app), 'le bouton ne suit pas le changement de client');
  });

  t('une facture soldée n\'invite plus à enregistrer un paiement', () => {
    const app = lireApp();
    // Le calcul existait dix lignes plus haut (`bal`), la barre d'actions ne le lisait pas.
    assert.ok(/locked && isInv && doc\.status !== 'annulée' && bal && bal\.remaining > 0\.0005 \? `<button class="btn btn-primary" id="pay">/.test(app),
      'le bouton « Enregistrer un paiement » s\'affiche encore sur une facture soldée');
  });

  t('supprimer une pièce nomme ce qui en dépend', () => {
    // La fonction est pure : elle se teste sans Electron.
    const data = { documents: [
      { id: 'q1', type: 'devis', number: 'DEV-1' },
      { id: 'f1', type: 'facture', number: 'FAC-1', fromQuoteId: 'q1', deposit: { percent: 30, quoteId: 'q1' } },
      { id: 'f2', type: 'facture', number: 'FAC-2', fromQuoteId: 'q1', settles: { quoteId: 'q1' } },
      { id: 'a1', type: 'avoir', number: 'AVO-1', creditOf: 'f1' },
      { id: 'bl', type: 'livraison', number: 'BL-1', fromDocId: 'q1' },
      { id: 'x', type: 'facture', number: 'FAC-9' }
    ] };
    const liees = core.piecesLiees(data, { id: 'q1' });
    assert.strictEqual(liees.length, 3, `3 pièces dépendent du devis, trouvé ${liees.length}`);
    assert.ok(liees.some(x => x.number === 'FAC-1' && /acompte 30/.test(x.quoi)), 'l\'acompte n\'est pas nommé comme tel');
    assert.ok(liees.some(x => x.number === 'FAC-2' && /solde/.test(x.quoi)), 'la facture de solde n\'est pas nommée');
    assert.ok(liees.some(x => x.number === 'BL-1'), 'la pièce issue du devis n\'est pas comptée');
    const surF1 = core.piecesLiees(data, { id: 'f1' });
    assert.strictEqual(surF1.length, 1, `un avoir dépend de sa facture : ${surF1.length} pièce(s) liée(s) trouvée(s) au lieu d'une`);
    assert.strictEqual(surF1[0].number, 'AVO-1', 'l\'avoir ne dépend pas de sa facture');
    // Sans identifiant, on ne « descend » pas toute la base (le piège de derivedDocs, 2.6.0).
    assert.deepStrictEqual(core.piecesLiees(data, { id: '' }), []);
    assert.deepStrictEqual(core.piecesLiees(data, null), []);
    // Une pièce sans lien ne réclame rien.
    assert.deepStrictEqual(core.piecesLiees(data, { id: 'x' }), []);

    const app = lireApp();
    assert.ok(/const liees = C\.piecesLiees\(data, doc\);[\s\S]{0,600}?await confirmDialog\(`Supprimer/.test(app),
      'la suppression ne nomme pas les pièces liées');
  });

  t('un acompte se demande aussi en dinars', () => {
    const app = lireApp();
    // Un acompte se négocie au téléphone en dinars : il fallait diviser de tête et découvrir le
    // montant réel une fois le brouillon créé.
    assert.ok(/<select name="mode"><option value="pct">.*?<option value="dt">/.test(app),
      'l\'acompte ne se demande qu\'en pourcentage');
    assert.ok(/const lirePct = \(\) => \{[\s\S]{0,300}?if \(v\.mode === 'dt'\) \{ const m = Number\(v\.montant\); return ttcDevis > 0 \? \(m \/ ttcDevis\) \* 100 : 0; \}/.test(app),
      'le montant n\'est pas converti en pourcentage (c\'est ce que depositLines attend)');
    // Le TTC réellement obtenu s'affiche AVANT : l'écart d'arrondi ne se découvre pas après coup.
    assert.ok(/L'acompte fera <b>\$\{h\(C\.money\(t\.netToPay, cur\)\)\}<\/b> à payer/.test(app),
      'le montant réellement obtenu n\'est pas annoncé avant de créer le brouillon');
    assert.ok(/ttcDevis > 0 \? \(m \/ ttcDevis\) \* 100 : 0/.test(app), 'une division par zéro reste possible sur un devis à 0');
    // `depositLines` ne change pas : c'est tout l'intérêt de convertir en amont.
    const co = { currency: 'DT', stampFee: 1 };
    const q = { type: 'devis', lines: [{ label: 'X', qty: 1, unitPrice: 1000, vatRate: 19 }] };
    const ttc = core.computeTotals(q, co).totalTTC;
    const lignes = core.depositLines(q, (300 / ttc) * 100, co);
    const sansTimbre = core.computeTotals({ type: 'facture', lines: lignes, applyStamp: false }, co);
    assert.ok(Math.abs(sansTimbre.totalTTC - 300) < 0.01,
      `les lignes d'un acompte demandé à 300 DT doivent totaliser 300 DT TTC, obtenu ${sansTimbre.totalTTC}`);
    // Et le timbre s'ajoute PAR-DESSUS : c'est précisément l'écart que la fenêtre annonce avant de
    // créer le brouillon, au lieu de le laisser découvrir sur la facture.
    const avecTimbre = core.computeTotals({ type: 'facture', lines: lignes, applyStamp: true }, co);
    assert.ok(Math.abs(avecTimbre.netToPay - 301) < 0.01,
      `l'acompte réellement à payer vaut 300 + 1 DT de timbre, obtenu ${avecTimbre.netToPay}`);
  });

  // ---------- 7.20.0 : ce qui est obligatoire, et ce qui mène quelque part ----------

  t('ce qui est obligatoire se voit avant d\'appuyer sur Enregistrer', () => {
    const app = lireApp();
    const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'style.css'), 'utf8');
    // `required` sur un <input> d'une fenêtre modale est INERTE : rien ne soumet le formulaire,
    // c'est un bouton qui lit les valeurs. On le dit donc nous-mêmes.
    assert.ok(/\.field\.obligatoire > span:first-child::after[^}]*content: ' \*'/.test(css),
      'l\'étoile des champs obligatoires n\'est plus dessinée');
    // La légende est DÉDUITE : posée par modal() dès qu'un champ la porte, jamais recopiée fenêtre
    // par fenêtre — sinon la première fenêtre qui gagne un champ obligatoire l'oublie.
    assert.ok(/if \(actions && \$\('\.field\.obligatoire', layer\) && !\$\('\.oblig-note', layer\)\)/.test(app),
      'la légende « * obligatoire » n\'est plus posée automatiquement');
    assert.ok(/actions\.insertBefore\(note, actions\.firstChild\);/.test(app), 'la légende n\'est pas insérée dans la barre d\'actions');
    // Et chaque fenêtre qui REFUSE sur un champ doit le MONTRER (règle 7.0.0), pas se contenter
    // d'un toast : la fenêtre peut avoir défilé, et rien ne dit lequel des champs relire.
    ['cf', 'sf', 'kf', 'ef'].forEach(f => {
      assert.ok(app.includes(`refus('#${f} `), `la fenêtre « ${f} » refuse encore par un simple message`);
    });
    // Chaque formulaire qui refuse sur un champ porte aussi la marque sur ce champ.
    const oblig = (app.match(/class="field[^"]*obligatoire/g) || []).length;
    assert.ok(oblig >= 6, `seulement ${oblig} champ(s) marqué(s) obligatoire(s) : les formulaires principaux doivent l'être`);
  });

  t('le Catalogue mène à la fiche de l\'article suivi', () => {
    const app = lireApp();
    // Le Catalogue AFFICHE une quantité en stock ; la fiche qui l'explique n'était atteignable que
    // depuis la page Stock.
    // Depuis la 7.29.0 le geste vit dans le menu d'actions de la ligne : la RÈGLE est la même, sa
    // forme a changé. On teste donc le chemin, pas le bouton.
    const menu = app.slice(app.indexOf('menu: (c, redraw) =>'), app.indexOf('const tplCols'));
    assert.ok(menu.length > 200 && menu.includes('catalogForm('), 'découpage du menu du Catalogue raté');
    assert.ok(/run: \(\) => navigate\('#\/article\/' \+ c\.id\)/.test(menu),
      'aucun chemin du Catalogue vers la fiche de l\'article');
    // Et seulement sur un article suivi : la fiche d'un article sans stock n'aurait rien à montrer.
    assert.ok(/c\.tracked \? \{[\s\S]{0,200}?navigate\('#\/article\/' \+ c\.id\)[\s\S]{0,20}?\} : null/.test(menu),
      'la fiche stock est offerte sur un article qui n\'est pas suivi en stock');
  });

  t('l\'éditeur d\'achat propose le catalogue au lieu de le reprocher', () => {
    const app = lireApp();
    assert.ok(/if \(\$\('#b-cat'\)\) bindCombo/.test(app), 'l\'éditeur d\'achat n\'a pas de sélecteur de catalogue');
    // On ACHÈTE : c'est le coût d'achat qui est repris, pas le prix de vente.
    assert.ok(/unitPrice: Number\(it\.unitCost\) \|\| Number\(it\.unitPrice\) \|\| 0/.test(app),
      'la ligne d\'achat reprend le prix de VENTE du catalogue');
    // Et la ligne porte l'itemId : c'est lui qui relie l'achat au stock, sans dépendre du libellé.
    assert.ok(/itemId: it\.id, destination: it\.tracked \? 'stock' : 'charge'/.test(app),
      'la ligne choisie au catalogue ne porte pas son itemId ni sa destination');
  });

  t('une ligne en immobilisation dit qu\'elle n\'est déduite nulle part', () => {
    const app = lireApp();
    // Le rappel ne regardait que « stock » : « immobilisation » ne disait rien, alors que la ligne
    // n'est déduite ni en charge, ni en amortissement tant que la fiche du bien n'existe pas.
    assert.ok(/const immos = t\.lines\.filter\(l => l\.destination === 'immobilisation'/.test(app),
      'les lignes en immobilisation ne sont pas comptées dans l\'éditeur d\'achat');
    assert.ok(/l'amortissement ne commencera qu'une fois la fiche du bien créée/.test(app),
      'rien ne dit ce qui manque pour qu\'une immobilisation soit déduite');
    assert.ok(/\$\('#b-immo'\)\.onclick = \(\) => \{ immoState\.tab = 'attente'; navigate\('#\/immos'\); \}/.test(app),
      'le rappel des immobilisations ne mène pas aux biens à créer');
  });

  t('la fiche client montre ses affaires et ses contrats', () => {
    const app = lireApp();
    // `clientForm` est déclaré AVANT `routes.client` dans le fichier : découper de l'un à l'autre
    // donnait une tranche vide, et le test aurait échoué en annonçant un défaut qui n'existe pas.
    const debut = app.indexOf('routes.client = ');
    assert.ok(debut > 0, 'la fiche client est introuvable dans app.js');
    const zone = app.slice(debut, app.indexOf('\n  routes.', debut + 10));
    assert.ok(zone.length > 2000, `la tranche de la fiche client fait ${zone.length} caractères : le découpage est faux`);
    assert.ok(/const affaires = C\.projectList\(data, company\(\)\)\.filter\(x => x\.clientId === c\.id\);/.test(zone),
      'la fiche client ne lit pas ses affaires');
    assert.ok(/const contrats = \(data\.recurring \|\| \[\]\)\.filter\(r => r\.clientId === c\.id\);/.test(zone),
      'la fiche client ne lit pas ses contrats récurrents');
    // Masqués quand il n'y en a pas : un panneau vide n'apprend rien (règle des états vides, 7.0.0).
    assert.ok(/if \(!affaires\.length && !contrats\.length\) return '';/.test(zone),
      'les deux panneaux s\'affichent même vides');
    assert.ok(/data-pid="\$\{h\(x\.id\)\}"/.test(zone) && /navigate\('#\/affaire\/' \+ tr\.dataset\.pid\)/.test(zone),
      'les affaires de la fiche client ne s\'ouvrent pas');
    assert.ok(/data-rid="\$\{h\(r\.id\)\}"/.test(zone) && /navigate\('#\/contrat\/' \+ tr\.dataset\.rid\)/.test(zone),
      'les contrats de la fiche client ne s\'ouvrent pas');
    // Un contrat en euros s'affiche en euros, ici aussi (règle de la 7.18.0, re-vérifiée ailleurs).
    assert.ok(/C\.money\(ht, r\.currency \|\| cur\)/.test(zone), 'le contrat de la fiche client s\'affiche en devise société');
  });

  // ---------- 7.21.0 : la comptabilité qui mène aux pièces ----------

  t('une échéance fiscale déposée cesse de crier — et seulement celle-là', () => {
    const data = core.migrateData({ company: {}, fiscalDeadlines: [{ id: 'tva', active: true, every: 'month', day: 28 }] });
    assert.ok(Array.isArray(data.fiscalFilings), 'la liste des échéances déposées n\'existe pas après migration');
    const t0 = '2026-10-01';
    const avant = core.upcomingFiscal(data, t0, 120);
    const tva = avant.filter(x => x.id === 'tva');
    assert.ok(tva.length, 'aucune échéance TVA sur 120 jours : le test ne prouve rien');
    assert.ok(tva[0].filingId, 'une occasion d\'échéance n\'a pas d\'identifiant pointable');
    // On pointe la PREMIÈRE occurrence.
    data.fiscalFilings.push({ id: tva[0].filingId, at: Date.now() });
    const apres = core.upcomingFiscal(data, t0, 120).filter(x => x.id === 'tva');
    assert.ok(apres.length, 'pointer une échéance a fait disparaître la règle : les mois suivants ne sont plus réclamés');
    assert.ok(apres[0].date > tva[0].date,
      `l'échéance pointée revient : ${apres[0].date} au lieu d'une date après ${tva[0].date}`);
    // L'identifiant est bien « règle @ date » : c'est une occurrence, pas une règle.
    assert.strictEqual(core.fiscalFilingId('tva', '2026-10-28'), 'tva@2026-10-28');

    const app = lireApp();
    assert.ok(/data-fdone="\$\{h\(x\.filingId\)\}"/.test(app), 'aucun bouton pour marquer une échéance déposée');
    assert.ok(/\$\$\('\[data-fdone\]'\)\.forEach[\s\S]{0,500}?toastUndo\(/.test(app),
      'marquer une échéance déposée ne laisse aucun retour en arrière');
    // Chaque règle qui a un écran de préparation y mène ; celles qui n'en ont pas ne portent pas de
    // bouton — mieux vaut rien qu'un bouton qui mène au hasard.
    const vers = (app.match(/const FISCAL_VERS = \{[\s\S]*?\n    \};/) || [''])[0];
    assert.ok(vers, 'la table des écrans de préparation a disparu');
    Object.keys({ tva: 1, cnss: 1, employeur: 1 }).forEach(k =>
      assert.ok(new RegExp(`\\n      ${k}: `).test(vers), `l'échéance « ${k} » ne mène nulle part`));
    const connus = core.DEFAULT_FISCAL_DEADLINES.map(r => r.id);
    (vers.match(/\n      (\w+): /g) || []).map(x => x.trim().replace(':', '')).forEach(k =>
      assert.ok(connus.includes(k), `« ${k} » n'est pas une échéance connue de core : le bouton mènerait au hasard`));
  });

  t('les contrôles avant clôture portent leur bouton', () => {
    const app = lireApp();
    // La même liste porte ses boutons dans l'onglet Cabinet depuis la 7.15.0 ; ici c'était du texte.
    // Le bloc du Cabinet vit ENTRE `drawClosures` et `drawFiscal` : découper de l'une à l'autre
    // incluait ses boutons, et le test passait même si les contrôles de clôture n'en avaient aucun.
    // (Trouvé en réintroduisant le défaut : le test restait vert.) On découpe sur le panneau lui-même.
    const debut2 = app.indexOf('À regarder avant de clôturer');
    assert.ok(debut2 > 0, 'le panneau des contrôles avant clôture est introuvable');
    const zone = app.slice(debut2, app.indexOf('</table>', debut2));
    assert.ok(!zone.includes('cab-'), 'la tranche déborde sur le panneau du Cabinet : le test ne prouverait rien');
    assert.ok(/data-check="\$\{h\(c\.id\)\}"/.test(zone), 'les contrôles avant clôture n\'ont toujours aucun bouton');
    // Le branchement vit dans le CORPS de `drawClosures`, pas dans son gabarit : on le cherche là.
    const corps = app.slice(app.indexOf('function drawClosures()'), app.indexOf('#do-close'));
    assert.ok(/\$\$\('\[data-check\]'\)\.forEach\(b => b\.onclick = \(\) => CHECK_ACTIONS\[b\.dataset\.check\]\.run\(\)\);/.test(corps),
      'les boutons des contrôles avant clôture ne sont pas branchés');
    // `closureChecks` est un sous-ensemble de `packChecklist` : le test de couverture de la 7.15.0
    // vaut donc aussi ici, et on le vérifie au lieu de le supposer.
    const core2 = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'core.js'), 'utf8');
    const bloc2 = core2.slice(core2.indexOf('function closureChecks('), core2.indexOf('function closePeriod('));
    // Les contrôles se déclarent par `add('id', …)`, jamais par un littéral `{ id: … }` : lire la
    // mauvaise forme donnait zéro contrôle, donc un test qui ne vérifiait rien.
    const ids = [...new Set((bloc2.match(/\n    add\('([\w-]+)'/g) || []).map(x => x.trim().slice(5, -1)))];
    assert.ok(ids.length >= 3, `seulement ${ids.length} contrôle(s) lus dans closureChecks : le découpage est faux`);
    const table = app.slice(app.indexOf('const CHECK_ACTIONS = {'), app.indexOf('const TODO_VISIBLE'));
    ids.forEach(id => assert.ok(new RegExp(`(^|\\s)'?${id}'?: \\{`, 'm').test(table),
      `le contrôle « ${id} » n'a pas d'action : son bouton avalerait le clic`));
  });

  t('les chiffres de la TVA mènent aux pièces qui les font', () => {
    const app = lireApp();
    assert.ok(/data-vm="\$\{String\(i \+ 1\)\.padStart\(2, '0'\)\}"/.test(app),
      'les douze lignes « Mois par mois » ne se cliquent toujours pas');
    assert.ok(/\$\$\('#c-body tr\[data-vm\]'\)\.forEach\(tr => tr\.onclick[\s\S]{0,220}?comptaState\.month = tr\.dataset\.vm;/.test(app),
      'cliquer un mois ne change pas la déclaration affichée');
    assert.ok(/id="vat-ventes"/.test(app) && /id="vat-achats"/.test(app),
      'rien ne mène du bloc de TVA aux journaux qui le fabriquent');
    // Le bouton bascule aussi l'onglet ACTIF : sans ça on arrive sur le bon contenu avec le mauvais
    // onglet allumé (le piège déjà rencontré avec `#cab-goclose`).
    assert.ok(/const versOnglet = \(tab, mois\) => \{[\s\S]{0,300}?classList\.toggle\('active', b\.dataset\.tab === tab\)/.test(app),
      'changer d\'onglet par un bouton n\'allume pas l\'onglet d\'arrivée');
  });

  t('un mouvement mène à la pièce d\'où il vient', () => {
    const app = lireApp();
    // La phrase sous le tableau disait d'aller corriger le paiement sur sa pièce, sans offrir d'y aller.
    assert.ok(/const cible = m\.source === 'libre' \? '' : m\.docId \? '#\/doc\/' \+ m\.docId : m\.purchaseId \? '#\/achat\/' \+ m\.purchaseId : m\.payslipId \? '#\/paie' : '';/.test(app),
      'un mouvement ne sait pas d\'où il vient');
    assert.ok(/else if \(tr\.dataset\.go\) tr\.onclick = \(\) => navigate\(tr\.dataset\.go\);/.test(app),
      'les lignes de mouvement venues d\'une pièce ne sont pas branchées');
    assert.ok(/Clique une ligne pour ouvrir la pièce d'où elle vient/.test(app),
      'la note sous le tableau décrit encore un geste impossible');
    // Les trois sources que `cashMovements` sait produire sont bien couvertes.
    const core2 = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'core.js'), 'utf8');
    const bloc2 = core2.slice(core2.indexOf('function cashMovements('), core2.indexOf('function accountBalance('));
    ['docId', 'purchaseId', 'payslipId'].forEach(k =>
      assert.ok(bloc2.includes(k + ':'), `cashMovements ne produit plus « ${k} » : le lien est mort`));
  });

  t('un paquet fabriqué se retrouve sur le disque', () => {
    const app = lireApp();
    assert.ok(/data-reveal="\$\{h\(x\.path \|\| ''\)\}"/.test(app), 'l\'historique des paquets ne mène pas au fichier');
    assert.ok(/bridge\.showInFolder\(b2\.dataset\.reveal\)/.test(app), 'le bouton « Montrer le fichier » n\'est pas branché');
    // Un paquet d'avant cette version n'a pas de chemin : le bouton le DIT au lieu de ne rien faire.
    assert.ok(/disabled title="Paquet fabriqué avant cette version/.test(app),
      'un paquet sans chemin offre un bouton qui ne ferait rien');
  });

  t('la carte « Reste à encaisser » de la Comptabilité ouvre sa liste', () => {
    const app = lireApp();
    const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'style.css'), 'utf8');
    assert.ok(/data-cstat="encaisser"/.test(app), 'la carte de la Comptabilité n\'est pas cliquable');
    assert.ok(/\$\$\('#c-body \.stat\[data-cstat\]'\)\.forEach[\s\S]{0,400}?filtre\('facture', 'à encaisser'\)\(\); navigate\('#\/factures'\);/.test(app),
      'la carte de la Comptabilité n\'ouvre pas la même liste que sa jumelle de l\'accueil');
    // Elle le DIT : curseur, chevron, relief (règle de la 7.15.0, à étendre au nouvel attribut).
    assert.ok(/\.stat\[data-stat\], \.stat\[data-cstat\] \{[^}]*cursor: pointer/.test(css),
      'la carte cliquable de la Comptabilité n\'a pas de curseur de clic');
    assert.ok(/\.stat\[data-stat\]::after, \.stat\[data-cstat\]::after/.test(css), 'elle n\'a pas de chevron');
  });

  // ---------- 7.21.1 : l'installeur Windows ----------

  // ---------- 7.24.0 : les mises à jour d'un dépôt public ----------

  t('les notes de version s\'affichent mises en forme, pas en Markdown brut', () => {
    const app = lireApp();
    // `notesHtml` ne traitait que les titres et les listes : tout le reste sortait TEL QUEL, sur
    // l'écran qu'on regarde au moment précis où l'on décide d'installer une mise à jour.
    const zone = app.slice(app.indexOf('function inlineMd('), app.indexOf('function notesHtml('));
    assert.ok(zone.length > 150, 'le découpage de inlineMd est faux');
    // L'ordre compte : on ÉCHAPPE d'abord, on remet la mise en forme ensuite. L'inverse laisserait
    // passer du HTML venu d'un fichier qu'on ne contrôle pas entièrement.
    assert.ok(zone.indexOf('return h(texte)') < zone.indexOf('<strong>'),
      'inlineMd remet la mise en forme AVANT d\'échapper : du HTML du CHANGELOG passerait tel quel');
    ['<code>', '<strong>', '<em>'].forEach(t2 =>
      assert.ok(zone.includes(t2), `inlineMd ne produit pas de ${t2}`));
    // Et les trois usages passent par lui : un seul oubli et la ligne concernée reste en Markdown.
    const nh = app.slice(app.indexOf('function notesHtml('), app.indexOf('function notesHtml(') + 900);
    assert.ok(!/\$\{h\(l/.test(nh), 'notesHtml échappe encore sans mettre en forme : du Markdown brut resterait à l\'écran');
    assert.strictEqual((nh.match(/inlineMd\(/g) || []).length, 4,
      'les quatre sorties de notesHtml (liste, titre, citation, paragraphe) doivent passer par inlineMd');
  });

  // Public ou privé : UN SEUL interrupteur, et les deux applications le suivent.
  //
  // Ce test a d'abord décrit la mauvaise règle. Écrit en 7.24.0, il exigeait l'ABSENCE du champ
  // jeton — vrai le jour où le dépôt est passé public, faux comme règle : le jour où il redevient
  // privé, basculer le drapeau n'aurait plus rien réarmé et l'écran aurait dit « colle ton jeton
  // ci-dessous » au-dessus de rien. On teste l'interrupteur, pas la position dans laquelle il est.
  t('public ou privé : un seul interrupteur, et les deux applications le suivent', () => {
    const main = lireSource('src', 'main.js');
    const cab = lireSource('src', 'cabinet', 'main.js');
    const app = lireApp();

    // 1. La vérité vit dans UN fichier, et les deux applications la lisent. Chacune avait la sienne,
    // et elles ont divergé : l'app entreprise disait « public » pendant que celle du comptable
    // affichait encore « dépôt privé, colle un jeton ». Deux vérités pour un seul fait.
    const D = require('../src/depot.js');
    assert.strictEqual(typeof D.private, 'boolean', 'src/depot.js doit déclarer `private`');
    assert.ok(/const GITHUB = require\('\.\/depot'\)/.test(main), 'src/main.js redéclare le dépôt au lieu de le lire');
    assert.ok(/const GITHUB = require\('\.\.\/depot'\)/.test(cab), 'src/cabinet/main.js redéclare le dépôt au lieu de le lire');
    [['src/main.js', main], ['src/cabinet/main.js', cab]].forEach(([nom, src]) =>
      assert.ok(!/private:\s*(true|false)/.test(src), nom + ' : un second drapeau `private` est réapparu, il divergera'));
    // Et le fichier doit être EMBARQUÉ dans l'app cabinet, sinon elle ne démarre plus une fois
    // construite : un `require` manquant ne se voit pas avant l'installation.
    const conf = lireSource('build', 'cabinet.config.js');
    assert.ok(/'src\/depot\.js'/.test(conf), 'src/depot.js n\'est pas livré avec l\'app cabinet');

    // 2. L'interrupteur traverse le pont : sans ça, l'interface ne peut pas le suivre.
    assert.ok(/private: GITHUB\.private/.test(main), 'update:version ne dit pas à l\'écran si le dépôt est privé');
    assert.ok(/private: GITHUB\.private/.test(cab), 'upd:version (cabinet) ne dit pas à l\'écran si le dépôt est privé');

    // 3. Le champ de saisie existe, et il est posé SOUS la condition — jamais en dur.
    const i = app.indexOf('const tokenBlock = a.relay');
    const j = app.indexOf('el.innerHTML = `<div class="update-head">');
    const bloc = app.slice(i, j);
    assert.ok(i > 0 && j > i && bloc.length > 400, 'découpage du bloc jeton raté');
    assert.ok(bloc.includes('id="upd-token"'), 'plus aucun champ où coller un jeton : un dépôt privé serait un cul-de-sac');
    assert.ok(bloc.indexOf('a.private ?') > 0 && bloc.indexOf('a.private ?') < bloc.indexOf('id="upd-token"'),
      'le champ jeton doit être posé SOUS `a.private`, sinon il s\'affiche sur un dépôt public');
    // Retirer un ancien jeton reste possible dans les deux cas : on ne laisse pas une valeur morte
    // sur le poste de quelqu'un sans bouton pour l'enlever.
    assert.ok((bloc.match(/id="upd-token-clear"/g) || []).length >= 2, 'retirer un jeton doit rester possible des deux côtés');
    // Même chose côté cabinet.
    const cabui = lireSource('src', 'cabinet', 'renderer', 'app.js');
    assert.ok(/a\.private \? noteRelais/.test(cabui), 'l\'app cabinet affiche son champ jeton sans regarder le drapeau');

    // 4. Une panne de relais ne s'affiche en rouge que si elle empêche quelque chose : sur un dépôt
    // public le repli GitHub suffit tout seul. Elle reste dans le journal.
    [['src/main.js', main], ['src/cabinet/main.js', cab]].forEach(([nom, src]) =>
      assert.ok(/relayFailure: GITHUB\.private \? relayFailure : ''/.test(src),
        nom + ' : une panne de relais est montrée en rouge alors qu\'elle n\'empêche rien'));
  });

  // Un message d'erreur venu d'une bibliothèque n'est jamais montré tel quel.
  //
  // Vu par le propriétaire sur son écran, en toutes lettres : « Cannot find latest-mac.yml in the
  // release https://github.com/saouthq/skanfact/releases/tag/v7.25.0 ». Techniquement exact,
  // parfaitement inutilisable, et ça donne l'impression d'un logiciel cassé — alors que la release
  // était simplement en train de monter ses fichiers.
  t('mises à jour : aucun message brut ne remonte à l\'écran', () => {
    [['src/main.js', lireSource('src', 'main.js')],
     ['src/cabinet/main.js', lireSource('src', 'cabinet', 'main.js')]].forEach(([nom, src]) => {
      const i = src.indexOf('function updateProblem(err)');
      assert.ok(i > 0, nom + ' : updateProblem introuvable');
      const fin = src.indexOf('\n}', src.indexOf('return dit(', i));
      const f = src.slice(i, fin > i ? fin + 2 : i + 4000);
      assert.ok(f.length > 600, nom + ' : découpage de updateProblem raté');

      // 1. Plus AUCUN chemin ne renvoie le texte d'origine. C'était la dernière ligne de l'ancienne
      // version (`return m.split('\n')[0].slice(0, 200)`), et c'est elle qu'on a lue à l'écran.
      //
      // On lit l'ARGUMENT de chaque `return dit(…)`, parenthèses équilibrées : une assertion sur la
      // forme `return brut` laissait passer `return dit(brut.split(…))`, vérifié en le réintroduisant.
      const rendus = [];
      for (let k = f.indexOf('return dit('); k >= 0; k = f.indexOf('return dit(', k + 1)) {
        let p = f.indexOf('(', k), prof = 0, fin = p;
        for (; fin < f.length; fin++) {
          if (f[fin] === '(') prof++;
          else if (f[fin] === ')') { prof--; if (!prof) break; }
        }
        rendus.push(f.slice(p + 1, fin));
      }
      assert.ok(rendus.length >= 5, nom + ' : trop peu de cas traités, le découpage est faux');
      rendus.forEach(arg => assert.ok(!/\bbrut\b|\bm\.split\b/.test(arg),
        nom + ' : un message brut est renvoyé à l\'écran — ' + arg.slice(0, 60)));
      // Et le dernier recours — celui qui attrape tout ce qu'on n'a pas prévu — est une phrase écrite.
      assert.ok(/^'[A-ZÀ-Ý]/.test(rendus[rendus.length - 1].trim()),
        nom + ' : le dernier recours n\'est pas une phrase en français');

      // 2. Le code d'erreur se lit sur l'ERREUR, pas dans son texte : `CHANNEL_FILE_NOT_FOUND` ne
      // figure nulle part dans « Cannot find latest-mac.yml in the release … ». Le chercher dans le
      // message, c'est ne jamais le trouver — c'est ce que faisait la version d'avant.
      assert.ok(/err && err\.code/.test(f), nom + ' : le code de l\'erreur n\'est jamais lu');
      assert.ok(/CHANNEL_FILE_NOT_FOUND/.test(f) && /Cannot find/.test(f),
        nom + ' : une release en cours de publication n\'est pas reconnue');

      // 3. Le texte d'origine n'est pas jeté pour autant : c'est lui qui sert à dépanner (6.7.2).
      assert.ok(/detail = brut/.test(f), nom + ' : la cause technique est perdue');
      // 4. Ce qui n'est pas une panne ne s'affiche pas en rouge.
      assert.ok(/, true\)/.test(f), nom + ' : aucun cas n\'est marqué « pas une panne »');
    });

    // Côté écran : la phrase, le détail replié, et le gris pour ce qui n'est pas une panne.
    const app = lireApp();
    const e = app.slice(app.indexOf("else if (upd.state === 'error')"), app.indexOf('const relayNote'));
    assert.ok(e.length > 200 && e.includes('upd.message'), 'découpage du bloc erreur raté');
    assert.ok(/upd\.soft \?/.test(e), 'un échec sans gravité s\'affiche encore en rouge');
    assert.ok(/details class="tech"/.test(e) && /upd\.detail/.test(e), 'le détail technique n\'est pas montrable');
    assert.ok(/id="upd-log"/.test(e), 'aucun accès au journal depuis l\'erreur');
  });

  // Un relais en panne bascule TOUT SEUL sur GitHub.
  //
  // Le repli existait depuis la 6.7.0 — mais seulement quand le relais était MAL RÉGLÉ (adresse
  // invalide, attrapée par `new URL`). Pas quand il répondait mal : le seul cas qui arrive
  // vraiment. L'app du comptable affichait donc « Aucune version trouvée : le jeton d'accès
  // manque » pendant qu'un second chemin, parfaitement fonctionnel, l'attendait juste à côté.
  // C'est le défaut de la 6.7.2, une couche plus bas.
  t('mises à jour : un relais qui répond mal bascule tout seul sur GitHub', () => {
    [['src/main.js', lireSource('src', 'main.js')],
     ['src/cabinet/main.js', lireSource('src', 'cabinet', 'main.js')]].forEach(([nom, src]) => {
      // 1. Le repli se souvient : on ne repasse pas par un service qui vient de refuser.
      assert.ok(/let relayDown = false;/.test(src), nom + ' : rien ne retient qu\'un relais a échoué');
      assert.ok(/if \(!base \|\| relayDown\)/.test(src), nom + ' : configureFeed repasse par un relais en panne');

      // 2. Et il se déclenche DANS la vérification, pas seulement au réglage.
      const i = src.indexOf('async function checkForUpdates');
      const f = src.slice(i, src.indexOf('\n}', src.indexOf('return { state: \'error\', ...updateProblem(e) };', i)));
      assert.ok(i > 0 && f.length > 500, nom + ' : découpage de checkForUpdates raté');
      assert.ok(/relayDown = true;/.test(f), nom + ' : un échec du relais ne le débranche pas');
      assert.ok(/configureFeed\(u\)/.test(f), nom + ' : le flux n\'est jamais rebranché sur GitHub');
      assert.strictEqual((f.match(/u\.checkForUpdates\(\)/g) || []).length, 2,
        nom + ' : il n\'y a pas de SECOND essai après l\'échec du relais');

      // 3. On ne crie pas avant d'avoir essayé le second chemin : l'événement `error` du premier
      // échec afficherait un rouge que le repli dément une seconde plus tard.
      assert.ok(/silencerErreur/.test(f), nom + ' : le premier échec s\'affiche avant le second essai');
      assert.ok(/&& !silencerErreur\) send/.test(src), nom + ' : l\'événement d\'erreur n\'est jamais retenu');
      // Et il se rouvre sur tous les chemins, sinon une erreur suivante resterait muette.
      assert.ok((src.match(/silencerErreur = false/g) || []).length >= 3,
        nom + ' : silencerErreur doit être relevé sur chaque sortie, sinon l\'écran devient muet');
    });

    // Côté écran : le détail et la gravité voyagent avec le message renvoyé par `check`, et l'état
    // du relais est relu — sinon l'écran continue d'annoncer « rien à configurer » après la bascule.
    const app = lireApp();
    assert.ok(/upd\.detail = r\.detail \|\| ''; upd\.soft = !!r\.soft;/.test(app),
      'app.js : une erreur renvoyée par check perd son détail et sa gravité');
    const rc = app.slice(app.indexOf('async function runCheck()'), app.indexOf('async function showChangelog'));
    assert.ok(rc.length > 300 && /bridge\.updateVersion\(\)/.test(rc), 'app.js : l\'état du relais n\'est pas relu après la vérification');
    const cab = lireSource('src', 'cabinet', 'renderer', 'app.js');
    assert.ok(/upd\.detail = r\.detail \|\| ''; upd\.soft = !!r\.soft;/.test(cab),
      'cabinet : une erreur renvoyée par check perd son détail et sa gravité');
    assert.ok(/upd\.app = await api\.updVersion\(\);/.test(cab), 'cabinet : l\'état du relais n\'est pas relu');
  });

  // ---------- 7.23.0 : l'Aide ----------

  t('l\'Aide range ses trente-deux articles en thèmes, sans en perdre ni en dupliquer', () => {
    const G = require('../src/renderer/guide.js');
    const ids = G.ARTICLES.map(a => a.id);
    const classes = G.THEMES.flatMap(t => t.articles);
    // Une liste écrite à la main dérive au premier article ajouté : on confronte les DEUX sens.
    const orphelins = ids.filter(x => !classes.includes(x));
    assert.deepStrictEqual(orphelins, [], `ces articles n'appartiennent à aucun thème : ${orphelins.join(', ')}`);
    const fantomes = classes.filter(x => !ids.includes(x));
    assert.deepStrictEqual(fantomes, [], `ces thèmes citent un article inexistant : ${fantomes.join(', ')}`);
    const doublons = classes.filter((x, i) => classes.indexOf(x) !== i);
    assert.deepStrictEqual(doublons, [], `ces articles sont dans deux thèmes : ${doublons.join(', ')}`);
    assert.ok(G.THEMES.length >= 5 && G.THEMES.length <= 9, `${G.THEMES.length} thèmes : trop peu ou trop`);
    G.THEMES.forEach(t => {
      assert.ok(t.id && t.label && t.sub, `le thème « ${t.id} » est incomplet`);
      assert.ok(t.articles.length, `le thème « ${t.label} » est vide`);
    });
    // Et `themeOf` retrouve bien le thème de chaque article — c'est lui qui dessine le fil d'Ariane.
    ids.forEach(id => assert.ok(G.themeOf(id), `themeOf ne retrouve pas le thème de « ${id} »`));
  });

  t('chaque article de l\'Aide finit par un geste qui mène quelque part', () => {
    const G = require('../src/renderer/guide.js');
    const app = lireApp();
    const ids = new Set(G.ARTICLES.map(a => a.id));
    const routes = new Set(core.PAGES.map(p => p.hash || '#/' + p.id));
    const gestes = Object.entries(G.GESTES);
    assert.ok(gestes.length >= 25, `seulement ${gestes.length} gestes : la plupart des articles restent des culs-de-sac`);
    gestes.forEach(([art, g]) => {
      assert.ok(ids.has(art), `un geste est posé sur « ${art} », qui n'est pas un article`);
      assert.ok(g.label && g.hash, `le geste de « ${art} » est incomplet`);
      // Le vrai piège : un bouton qui mène à une adresse qui n'existe pas ne plante pas, il
      // dépose sur le tableau de bord — et on croit s'être trompé de bouton.
      assert.ok(routes.has(g.hash), `le geste de « ${art} » mène à « ${g.hash} », qui n'est pas une page`);
    });
    // Trois articles n'en ont volontairement pas : on ne renvoie nulle part depuis un glossaire.
    const sans = [...ids].filter(id => !G.GESTES[id]);
    assert.deepStrictEqual(sans.sort(), ['raccourcis', 'support', 'vocabulaire'],
      `ces articles n'ont pas de geste : ${sans.join(', ')}`);
    // Et l'interface les arme : une table sans appelant est une table morte (règle 7.2.0).
    assert.ok(/data-geste="\$\{h\(geste\.hash\)\}"/.test(app), 'le bouton du geste n\'est plus dessiné');
    assert.ok(/\$\$\('\[data-geste\]'\)\.forEach\(b => b\.onclick/.test(app), 'le bouton du geste n\'est plus branché');
  });

  // ---------- 7.28.0 : ce que le processus principal doit savoir ----------

  // Le drapeau « il reste du travail non enregistré » vit dans le processus PRINCIPAL : c'est lui
  // qui pose la question à la fermeture de la fenêtre. Le renderer doit donc le remettre à jour
  // chaque fois que le garde-fou DISPARAÎT, pas seulement quand il se pose. `leaveOk` et le routeur
  // remettaient `guard` à null directement : une fois qu'on avait modifié quoi que ce soit,
  // `dirtyReported` restait à `true` pour le reste de la session, et fermer la fenêtre posait pour
  // toujours la question « modifications non enregistrées » — sur des données pourtant enregistrées.
  // Une application qui annonce une perte qui n'existe pas apprend à cliquer sans lire.
  t('quitter une page prévient aussi le processus principal', () => {
    const app = lireApp();
    assert.ok(/function clearGuard\(g\) \{[^}]*reportDirty\(\)/.test(app),
      'clearGuard ne redit plus au processus principal qu\'il n\'y a rien en attente');
    assert.ok(/function reportDirty\(\) \{[\s\S]{0,260}?bridge\.setDirty\(d\)/.test(app),
      'reportDirty ne traverse plus le pont');
    // Et personne ne court-circuite `clearGuard` : la seule remise à zéro directe est la sienne,
    // plus la déclaration de la variable.
    const lignes = app.split('\n').filter(l => /(^|[^.\w])guard = null/.test(l) && !/^\s*\/\//.test(l));
    assert.strictEqual(lignes.length, 2,
      'un endroit remet `guard` à zéro sans le dire au processus principal :\n  ' + lignes.map(l => l.trim().slice(0, 80)).join('\n  '));
  });

  // ---------- 7.28.0 : le menu d'actions d'une ligne ----------

  // Un overlay qui n'est pas dans la liste des surfaces cliquables est un overlay dont les entrées
  // acceptent le clic sans rien faire : le `mousedown` global le referme, donc retire son bouton du
  // document, et le `click` n'a plus personne à qui parler. Aucune erreur, aucune console — et le
  // menu se ferme, ce qui donne l'impression que quelque chose s'est passé. C'est arrivé au menu
  // d'actions le jour où il a été écrit.
  t('le clic dans un menu ouvert ne le referme pas avant d\'avoir agi', () => {
    const app = lireApp();
    const rm = lireRowMenu();
    const m = /const SURFACES = '([^']+)'/.exec(rm);
    assert.ok(m, 'la liste des surfaces d\'overlay a disparu : chaque garde-fou va la recopier');
    const surfaces = m[1].split(',').map(x => x.trim());
    // L'application LIT cette liste, elle n'en écrit pas une seconde.
    assert.ok(/const SURFACES_OVERLAY = RowMenu\.SURFACES;/.test(app),
      'l\'app entreprise s\'est refait sa propre liste de surfaces : les deux vont diverger');
    // Les overlays de l'application, chacun reconnaissable à la classe qu'il pose — plus le BOUTON
    // qui ouvre le menu : sans lui, un reclic dessus refermait le menu au `mousedown` et le `click`
    // le rouvrait aussitôt. Le bouton n'était donc pas un interrupteur (7.29.0).
    ['.combo', '.datefield', '.row-menu', '.row-menu-btn'].forEach(c =>
      assert.ok(surfaces.includes(c), `${c} n'est pas dans les surfaces d'overlay : ses clics le refermeront avant d'agir`));
    // Et la seconde moitié du correctif : le menu se REFERME quand on rappuie sur son bouton.
    assert.ok(/if \(ouvertSur === bouton\) \{ if \(dejaOuvert\) dejaOuvert\(\); return; \}/.test(rm),
      'rappuyer sur le bouton d\'un menu ouvert le rouvre au lieu de le fermer');
    assert.ok(/if \(ouvertSur === bouton\) ouvertSur = null;/.test(rm),
      'la fermeture n\'oublie pas le bouton, ou l\'oublie même quand un autre menu a pris sa place');
    // Et le garde-fou lit bien CETTE liste, au lieu d'énumérer ses propres conditions.
    assert.ok(/if \(closeOverlay && !e\.target\.closest\(SURFACES_OVERLAY\)\) closeOverlay\(\);/.test(app),
      'le garde-fou global n\'utilise pas la liste des surfaces');
    assert.ok(!/!e\.target\.closest\('\.combo'\) && !e\.target\.closest\('\.datefield'\)/.test(app),
      'les surfaces sont de nouveau recopiées à la main dans le garde-fou');
  });

  // Une ligne finit par UN bouton, et ce bouton ouvre des actions écrites en toutes lettres. Le
  // budget de boutons d'une ligne est réel (7.18.0) : cinq boutons se disputaient la place et
  // tombaient dans des pictogrammes muets dès qu'ils étaient trop nombreux.
  t('les listes n\'alignent plus de boutons en fin de ligne', () => {
    const app = lireApp();
    const cab = lireSource('src', 'cabinet', 'renderer', 'app.js');
    const rm = lireRowMenu();
    // Plus aucune rangée de boutons dans une cellule d'actions, NI DANS L'UNE NI DANS L'AUTRE
    // application : l'app du cabinet en alignait cinq par ligne, dont un « ✕ » muet qui supprime un
    // paquet reçu, et cette règle ne lui avait jamais été appliquée (règle 7.3.0).
    // La règle : une ligne garde AU PLUS UN bouton toujours visible — le geste pour lequel la page
    // existe — et tout le reste passe par le menu. Et aucun de ces boutons ne se réduit à un
    // pictogramme : « ✕ » et « ⧉ » sont ce que devient une rangée trop longue.
    [['entreprise', app], ['cabinet', cab]].forEach(([quoi, src]) => {
      [...src.matchAll(/<td class="[^"]*row-actions[^"]*">([\s\S]*?)<\/td>/g)].forEach(m => {
        const boutons = [...m[1].matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
          .map(b => b[1].replace(/<[^>]*>|\$\{[^}]*\}/g, '').trim());
        assert.ok(boutons.length <= 1,
          `app ${quoi} : une ligne aligne encore ${boutons.length} boutons (${boutons.join(', ')})`);
        boutons.forEach(b => assert.ok(b.length >= 6,
          `app ${quoi} : le bouton « ${b} » d'une ligne ne se lit pas — un pictogramme n'est pas un libellé`));
      });
    });
    // Toutes les listes passent par le même helper — et il n'existe qu'en UN exemplaire, dans
    // rowmenu.js : recopié dans la seconde application, il aurait divergé au premier ajustement.
    const cellules = (app.match(/rowMenuCell\(/g) || []).length + (cab.match(/rowMenuCell\(/g) || []).length;
    assert.ok(cellules >= 9, `seulement ${cellules} liste(s) portent un menu d'actions`);
    const branchements = (app.match(/bindRowMenus\(/g) || []).length + (cab.match(/bindRowMenus\(/g) || []).length;
    assert.ok(branchements >= cellules, `${cellules} menus posés pour ${branchements} branchés : un menu n'est pas armé`);
    [['entreprise', app], ['cabinet', cab]].forEach(([quoi, src]) => {
      assert.ok(/RowMenu\.cellule/.test(src) && /RowMenu\.brancherMenus/.test(src),
        `app ${quoi} : elle ne passe pas par le menu partagé`);
      assert.ok(!/const ICO = \{/.test(src), `app ${quoi} : elle s'est refait sa propre table d'icônes`);
    });
    // Et un menu vide n'existe pas : un bouton qui ouvre le néant est un bouton mort.
    assert.ok(/if \(!reelles\.length\) \{ b\.remove\(\); return; \}/.test(rm),
      'une ligne sans action garde son bouton : il ouvrira un menu vide');
    // Une SEULE action ne se cache pas derrière un menu : le bouton la nomme et l'exécute (7.29.0).
    assert.ok(/if \(reelles\.length === 1\) \{[\s\S]{0,400}?a\.run\(\);/.test(rm),
      'un choix unique s\'ouvre quand même en menu : un clic et une lecture de plus pour rien');
    // Chaque action porte une phrase, jamais un pictogramme.
    // Seulement les actions de menu : un objet `{ icon, label, …, run }`. D'autres tables de
    // l'application portent un `label` (colonnes, axes de graphique) et n'ont rien à voir ici.
    const labels = [...(app + cab).matchAll(/\{ (?:icon: '[a-zA-Z]+', )?label: '([^']+)'[\s\S]{0,240}?run:/g)].map(x => x[1]);
    assert.ok(labels.length >= 18, `seulement ${labels.length} actions nommées`);
    labels.forEach(l => assert.ok(l.length >= 6, `l'action « ${l} » est trop courte pour être comprise`));
    // Et elle porte une icône (7.29.0) : une liste de phrases toutes semblables se parcourt à la
    // lecture, une liste illustrée se parcourt du regard. Le gabarit du menu doit la poser.
    const avecIcone = [...(app + cab).matchAll(/\{ icon: '([a-zA-Z]+)', label: ('[^']+'|`[^`]+`)/g)];
    assert.ok(avecIcone.length >= 30, `seulement ${avecIcone.length} actions portent une icône`);
    assert.ok(/\$\{ico\(a\.icon\)\}/.test(rm), 'le menu ne dessine pas l\'icône de ses actions');
    // Une icône nommée par erreur ne plante pas : `ico()` rend un vide de la même largeur, et la
    // ligne paraît simplement… sans icône. C'est exactement le genre de défaut qu'aucun écran ne
    // signale — on confronte donc les noms employés à la table qui les définit.
    const table = rm.slice(rm.indexOf('const ICO = {'), rm.indexOf('const ico = nom =>'));
    assert.ok(table.length > 400, 'la table des icônes a disparu');
    const connues = [...table.matchAll(/^\s{4}([a-zA-Z]+):/gm)].map(x => x[1]);
    assert.ok(connues.length >= 15, `seulement ${connues.length} icônes définies`);
    [...new Set(avecIcone.map(a => a[1]))].forEach(n =>
      assert.ok(connues.includes(n), `l'icône « ${n} » n'existe pas dans la table : l'action sortira sans dessin`));
    // Et chaque dessin est un vrai tracé, pas une chaîne vide oubliée.
    assert.ok(!/^\s{4}[a-zA-Z]+: '',?$/m.test(table), 'une icône de la table est vide');
  });

  // Un menu qui s'ouvre et disparaît dans la milliseconde ne laisse aucune trace : on croit avoir
  // mal cliqué. La cause était un `scroll` EN RETARD — celui qui a amené le bouton à l'écran juste
  // avant le clic, livré à la frame suivante. Le menu doit se fermer quand la page bouge VRAIMENT,
  // pas quand un événement en retard arrive à la même position.
  t('le menu ne se referme pas sur un défilement qui n\'a pas eu lieu', () => {
    const rm = lireRowMenu();
    assert.ok(/const depart = scroller \? scroller\.scrollTop : 0;/.test(rm),
      'la position de départ du défilement n\'est plus retenue');
    assert.ok(/Math\.abs\(scroller\.scrollTop - depart\) > 4/.test(rm),
      'le menu se referme au moindre événement de défilement, même sans mouvement');
    // Et c'est bien CE filtre qui est branché, pas `close` en direct — sinon la mesure ne sert à rien.
    assert.ok(/scroller\.addEventListener\('scroll', siDefile\)/.test(rm) && /removeEventListener\('scroll', siDefile\)/.test(rm),
      'le filtre de défilement n\'est pas branché (ou pas débranché)');
  });

  // ---------- 7.29.0 : ce que l'audit a trouvé autour du menu ----------

  t('la palette ne laisse aucun menu ouvert derrière elle, et ses onglets redessinent', () => {
    const app = lireApp();
    // Deux menus de page vivent en couche 70, la palette en 60 : ouverts, ils restaient dessinés
    // par-dessus son fond flouté et volaient le premier Échap.
    const ouvre = app.slice(app.indexOf('function openPalette() {'), app.indexOf('function openPalette() {') + 900);
    assert.ok(ouvre.includes('root.innerHTML'), 'découpage d\'openPalette raté');
    ['closeOverlay()', 'fermerDossiers()'].forEach(g =>
      assert.ok(ouvre.includes(g), `la palette laisse un menu ouvert derrière elle (${g} manquant)`));
    // Et viser la page où l'on est DÉJÀ ne produit aucun `hashchange` : il faut `vers()`, pas
    // `navigate()` — sinon l'onglet est posé et l'écran ne bouge pas (piège de la 7.15.0).
    assert.ok(/\[`\$\{page\} → \$\{label\}`, vers\(route, \(\) => poser\(id\)\)\]/.test(app),
      'les entrées d\'onglet de la palette sont inertes depuis la page qu\'elles visent');
    assert.ok(!/\[`\$\{page\} → \$\{label\}`, \(\) => \{ poser\(id\); navigate\(route\); \}\]/.test(app),
      'la palette repose l\'onglet puis navigue : depuis la page visée, rien ne se redessine');
  });

  t('un bouton posé dans une ligne cliquable n\'emmène pas ailleurs', () => {
    const app = lireApp();
    // « Attestation reçue » cochait la case ET quittait la page : on ne voyait jamais que c'était
    // noté. Toute liaison de ligne doit laisser passer les clics sur ses boutons.
    const nues = app.match(/\$\$\('tr\.clickable\[data-id\]'\)\.forEach\(tr => tr\.onclick = \(\) =>/g) || [];
    assert.strictEqual(nues.length, 0,
      `${nues.length} liste(s) emmènent ailleurs quand on clique un bouton DANS la ligne`);
    const gardees = app.match(/\$\$\('tr\.clickable\[data-id\]'\)\.forEach\(tr => tr\.onclick = e => \{ if \(e\.target\.closest\('button'\)\) return;/g) || [];
    assert.ok(gardees.length >= 3, `seulement ${gardees.length} liaison(s) de ligne protègent leurs boutons`);
  });

  t('la prévision de trésorerie convertit AUSSI les contrats en devise', () => {
    // `cashForecast` convertissait les factures clients et pas les contrats récurrents : un
    // abonnement de 800 € entrait dans la courbe pour 800 DT. La page existe pour savoir si l'on
    // tiendra le mois — un creux inventé y vaut un vrai creux manqué.
    const base = {
      ...core.DEFAULT_DATA, accounts: [{ id: 'a1', name: 'Banque', kind: 'banque', opening: 0 }],
      documents: [], purchases: [], recurring: []
    };
    // Timbre à zéro : il est fixé EN DINARS (7.0.1), donc il ne se met pas à l'échelle du taux — il
    // brouillerait la seule chose que ce test mesure, la conversion des LIGNES.
    const co = { ...core.DEFAULT_COMPANY, currency: 'TND', paymentTermsDays: 30, stampFee: 0 };
    const prochain = core.addDays(core.today(), 5);
    const contrat = (cur, taux) => ({
      id: 'r1', clientId: '', subject: 'Abonnement', active: true, every: 'month', day: 1,
      nextDate: prochain, lines: [{ label: 'Abonnement', qty: 1, unitPrice: 1000, vatRate: 0 }],
      currency: cur, exchangeRate: taux
    });
    const somme = (r) => (r.events || []).filter(e => e.kind === 'contrat').reduce((s, e) => s + e.amount, 0);
    const enDinars = somme(core.cashForecast({ ...base, recurring: [contrat('TND', '')] }, co, 60));
    const enEuros = somme(core.cashForecast({ ...base, recurring: [contrat('EUR', 3.4)] }, co, 60));
    assert.ok(enDinars > 0, 'aucun contrat dans la prévision : le test ne juge rien');
    // 1 000 € au taux 3,4 pèsent 3,4 fois plus qu'une facture de 1 000 DT. Le chiffre se calcule à
    // partir de la RÈGLE, jamais en recopiant ce que le code renvoie (leçon de la 7.0.1).
    assert.ok(Math.abs(enEuros - enDinars * 3.4) < 0.01,
      `un contrat en euros pèse ${enEuros} au lieu de ${core.round3(enDinars * 3.4)} : la devise n'est pas convertie`);
  });

  // ---------- 7.27.0 : la mise en page de l'Aide ----------

  // Une couleur qui n'existe pas ne se voit pas : le thème sort simplement en gris, au milieu de
  // six autres colorés, et personne ne remarque qu'il manque quelque chose. La table des couleurs
  // vit dans style.css (le mode sombre l'exige) et la table des thèmes dans guide.js : deux tables
  // séparées divergent toujours — on les confronte.
  t('l\'Aide : chaque thème a son dessin et sa couleur, en clair comme en sombre', () => {
    const G = require('../src/renderer/guide.js');
    const css = lireSource('src', 'renderer', 'style.css');
    G.THEMES.forEach(th => {
      assert.ok(th.icon && /<(path|circle|rect)\b/.test(th.icon), `le thème « ${th.label} » n'a pas de dessin`);
      const clair = new RegExp(`(^|[^-\\w])\\.th-${th.id}\\b[^{]*\\{[^}]*--th:`, 'm');
      const sombre = new RegExp(`body\\.dark\\s+\\.th-${th.id}\\b[^{]*\\{[^}]*--th:`, 'm');
      assert.ok(clair.test(css), `le thème « ${th.label} » n'a pas de couleur dans style.css (.th-${th.id})`);
      assert.ok(sombre.test(css), `le thème « ${th.label} » n'a pas de couleur en mode sombre (body.dark .th-${th.id})`);
    });
    // Et le repli, sans lequel un article sans thème perdrait sa bordure en silence.
    assert.ok(/body \{ --th: var\(--primary\)/.test(css), 'aucune couleur de repli : un article sans thème n\'aurait pas de bordure');
  });

  // Le fil d'Ariane s'est affiché VERTICALEMENT, centré au milieu de la page, en tête de chaque
  // article, de la 7.23.0 à la 7.26.1. Cause : c'était un `<nav>`, et `nav { display: flex;
  // flex-direction: column }` — la règle de la barre latérale, posée sur l'ÉLÉMENT — battait
  // `.help-fil` (une classe ne bat pas une déclaration plus précise du même poids sur la même
  // propriété : ici `.help-fil` ne déclarait tout simplement pas `flex-direction`).
  // Rien en console, aucun test de calcul : ça ne se voyait que sur une capture.
  t('l\'Aide : le fil d\'Ariane ne peut pas retomber dans le piège du <nav>', () => {
    const app = lireApp();
    const css = lireSource('src', 'renderer', 'style.css');
    assert.ok(/class="help-fil/.test(app), 'le fil d\'Ariane a disparu de l\'Aide');
    assert.ok(!/<nav[^>]*help-fil/.test(app),
      'le fil d\'Ariane est redevenu un <nav> : la règle de la barre latérale va l\'empiler verticalement');
    // Et la direction est écrite noir sur blanc, pour que la prochaine règle d'élément ne décide
    // pas à sa place.
    const bloc = css.slice(css.indexOf('.help-fil {'), css.indexOf('.help-fil {') + 200);
    assert.ok(/flex-direction: row/.test(bloc), '.help-fil ne déclare pas sa direction');
  });

  // Le surlignage des résultats de recherche pose des <mark> DANS du texte venu des articles.
  // Échapper après coup mangerait les balises qu'on vient de poser ; ne pas échapper du tout
  // laisserait passer le HTML. Chaque morceau se coupe puis s'échappe, un par un.
  t('l\'Aide : ce qui est surligné dans les résultats reste échappé', () => {
    const app = lireApp();
    const i = app.indexOf('function aideSurligne(');
    assert.ok(i > 0, 'aideSurligne introuvable');
    const f = app.slice(i, app.indexOf('\n  }', i) + 4);
    assert.ok(f.length > 300, 'découpage de aideSurligne raté');
    const morceaux = [...f.matchAll(/(.{2})texte\.slice\(/g)].map(m => m[1]);
    assert.ok(morceaux.length >= 3, `seulement ${morceaux.length} découpes : la fonction n'est plus celle-là`);
    morceaux.forEach(avant => assert.strictEqual(avant, 'h(',
      'un morceau de texte est recollé sans être échappé : le corps d\'un article passerait en HTML'));
  });

  // Un sommaire ne s'affiche que quand il y a quelque chose à résumer — mais il doit s'afficher là
  // où il sert. Onze intertitres dans « Ta comptabilité mois par mois », sept dans le glossaire :
  // sans lui on fait défiler à l'aveugle.
  t('l\'Aide : les articles longs ont de quoi se résumer', () => {
    const G = require('../src/renderer/guide.js');
    const app = lireApp();
    const m = /AIDE_SOMMAIRE_MIN = (\d+)/.exec(app);
    assert.ok(m, 'le seuil du sommaire a disparu');
    const seuil = Number(m[1]);
    const titres = a => (a.body.match(/<h3>/g) || []).length;
    // La règle, des deux côtés : un article qu'on ne voit pas d'un écran a son sommaire, et un
    // article court n'en a pas (trois lignes de sommaire au-dessus de quinze lignes de texte, c'est
    // du bruit). Les deux bornes sont larges : c'est le seuil qu'on teste, pas la longueur exacte
    // des articles du jour.
    G.ARTICLES.forEach(a => {
      if (a.body.length >= 2800) assert.ok(titres(a) >= seuil,
        `« ${a.title} » fait ${a.body.length} caractères et n'aurait pas de sommaire (${titres(a)} intertitres pour un seuil de ${seuil})`);
      if (a.body.length <= 1600) assert.ok(titres(a) < seuil,
        `« ${a.title} » ne fait que ${a.body.length} caractères et porterait un sommaire : c'est du bruit`);
    });
    // Les intertitres reçoivent un identifiant : sans lui, le sommaire ne mène nulle part.
    assert.ok(/replace\(\/<h3>\/g, \(\) => `<h3 id="art-h-\$\{i\+\+\}">`\)/.test(app),
      'les intertitres ne reçoivent plus d\'identifiant : les entrées du sommaire ne mènent nulle part');
    assert.ok(/\$\$\('\[data-h\]'\)\.forEach\(b => b\.onclick/.test(app), 'les entrées du sommaire ne sont plus branchées');
  });

  // ---------- 7.22.0 : le métier ----------

  t('l\'interface n\'appelle aucune fonction de core.js qui n\'existe pas', () => {
    // Écrire `C.pl(...)` alors que `pl` est une fonction LOCALE d'app.js lève une TypeError pendant
    // la construction du gabarit : l'écran reste blanc, sans une ligne dans la console de
    // l'utilisateur, et `node --check` ne voit rien. C'est ce qui est arrivé à l'écran « Ton
    // activité » en 7.22.0, et seul l'e2e l'a attrapé — trente secondes de parcours pour une faute
    // qu'une seconde de lecture suffit à interdire.
    //
    // L'app cabinet a ce garde-fou depuis la 6.8.0 ; il n'avait jamais été porté ici. Une règle
    // apprise d'un côté se vérifie de l'autre (règle 7.3.0).
    const app = lireApp();
    const exportes = new Set(Object.keys(core));
    // On ne juge que les appels et les accès `C.<nom>` — jamais le texte d'une chaîne : on retire
    // d'abord ce qui est entre guillemets simples ou doubles. Les gabarits sont gardés, parce que
    // c'est très exactement dedans que vivait la faute.
    const code = app.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
    const utilises = [...new Set((code.match(/\bC\.([A-Za-z_$][\w$]*)/g) || []).map(x => x.slice(2)))];
    assert.ok(utilises.length > 80, `seulement ${utilises.length} usages de core lus : le découpage est faux`);
    const fantomes = utilises.filter(n => !exportes.has(n));
    assert.deepStrictEqual(fantomes, [],
      `l'interface appelle ${fantomes.length} nom(s) que core.js n'exporte pas : ${fantomes.join(', ')}`);
  });

  t('le régime fiscal fait disparaître la colonne TVA, et la mention prend sa place', () => {
    const doc = {
      id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-09-14', dueDate: '2026-10-14',
      clientId: 'c1', status: 'envoyée', lines: [{ label: 'Consultation', qty: 2, unitPrice: 50, vatRate: 0, unit: 'séance' }]
    };
    const cl = { id: 'c1', name: 'Client SARL' };
    const base = { name: 'Cabinet X', matricule: '1234567A', activity: 'sante' };
    const entetes = html => (html.match(/<th[^>]*>[^<]*<\/th>/g) || []).map(x => x.replace(/<[^>]*>/g, ''));

    const reel = core.documentHtml(doc, cl, { ...base }, {});
    assert.ok(entetes(reel).some(x => /TVA/.test(x)), 'un assujetti garde sa colonne TVA');
    assert.ok(!/TVA non applicable/.test(reel), 'un assujetti ne porte aucune mention d\'exonération');

    const forf = core.documentHtml(doc, cl, { ...base, taxRegime: 'forfaitaire' }, {});
    assert.ok(!entetes(forf).some(x => /TVA/.test(x)), 'la colonne TVA doit disparaître pour un non-assujetti');
    assert.ok(/TVA non applicable — régime forfaitaire/.test(forf), 'la mention légale doit remplacer la colonne');
    // Le nombre de colonnes du corps doit suivre l'entête, sinon le tableau se décale d'une case.
    const cols = h => { const tr = (h.match(/<tr>[\s\S]*?<\/tr>/g) || []).find(x => /class="lbl"/.test(x)); return (tr.match(/<td/g) || []).length; };
    assert.ok(cols(reel) >= 4, `le découpage des colonnes est faux : ${cols(reel)} lue(s)`);
    assert.strictEqual(cols(reel) - cols(forf), 1, 'le corps doit perdre exactement une colonne, comme l\'entête');
    assert.strictEqual(entetes(reel).filter(Boolean).length - entetes(forf).filter(Boolean).length, 1,
      'l\'entête et le corps doivent perdre la MÊME colonne, sinon le tableau se décale d\'une case');

    // Et la garantie qui compte : une pièce QUI PORTE de la TVA la garde, même si l'entreprise
    // change de régime ensuite. Une pièce émise ne se réécrit pas (règle 7.1.0) — le PDF chez le
    // client ferait foi contre nous.
    const avecTva = { ...doc, lines: [{ label: 'X', qty: 1, unitPrice: 100, vatRate: 19, unit: 'u' }] };
    const apres = core.documentHtml(avecTva, cl, { ...base, taxRegime: 'forfaitaire' }, {});
    assert.ok(entetes(apres).some(x => /TVA/.test(x)), 'une facture qui porte de la TVA garde sa colonne pour toujours');
  });

  // La 7.22.0 a remplacé le taux de TVA porté par le métier (`ACTIVITIES[].vat`) par un régime
  // fiscal choisi à l'écran suivant — et a perdu au passage ce que le métier savait : « Santé et
  // paramédical » valait 0 %. L'application proposait donc 19 % de TVA à un kinésithérapeute qui
  // venait de déclarer son métier à l'écran précédent. Retirer un mécanisme n'autorise pas à
  // perdre ce qu'il savait.
  t('le métier propose son régime fiscal, sans l\'imposer', () => {
    assert.strictEqual(core.regimeSuggere('sante'), 'exonere', 'la santé doit proposer l\'exonération');
    // Une proposition ne s'invente pas : les métiers ordinaires n'en portent aucune, et retombent
    // sur « réel », le cas le plus courant.
    ['informatique', 'batiment', 'conseil', 'commerce', ''].forEach(id =>
      assert.strictEqual(core.regimeSuggere(id), '', 'régime proposé à tort pour ' + id));
    assert.strictEqual(core.regimeSuggere('métier qui n\'existe pas'), '');
    // Ce que ça change là où ça compte : le taux d'une ligne neuve.
    assert.strictEqual(core.defaultVat({ activity: 'sante', taxRegime: core.regimeSuggere('sante') }), 0);
    // Et une proposition n'est pas une règle : un choix explicite gagne toujours.
    assert.strictEqual(core.defaultVat({ activity: 'sante', taxRegime: 'reel' }), 19);

    // L'assistant l'applique — et cesse de l'appliquer dès qu'on a touché à la liste.
    const app = lireApp();
    const z = app.slice(app.indexOf("$$('[data-act]', root)"), app.indexOf("if ($('#sf-cat', root))"));
    assert.ok(z.length > 200 && z.includes('a.activity = b.dataset.act'), 'découpage de l\'écran « métier » raté');
    assert.ok(/if \(!a\.regimeTouche\) a\.taxRegime = C\.regimeSuggere\(a\.activity\);/.test(z),
      'choisir un métier ne propose pas son régime');
    assert.ok(/a\.regimeTouche = true/.test(z),
      'un régime choisi à la main doit être retenu, sinon le métier suivant l\'écrase');
    // Et AU REJEU, qui est le seul endroit où l'on puisse changer de métier. `regimeTouche` n'est
    // jamais enregistré (`applySetup` ne recopie que les champs de la société) : sans ce
    // réamorçage, il repartait à `undefined` et rejouer l'assistant pour corriger son métier
    // écrasait le régime en silence. Le voisin immédiat, `modulesTouche`, le faisait déjà.
    assert.ok(/a\.modulesTouche = Array\.isArray\(a\.modules\);[\s\S]{0,900}?a\.regimeTouche = !!String\(co\.taxRegime/.test(app),
      'le rejeu de l\'assistant peut écraser un régime fiscal déjà enregistré');
    // Le drapeau n'est pas enregistré : c'est ce qui rend le réamorçage indispensable. Si un jour
    // il l'était, ce test doit tomber pour qu'on relise la règle plutôt que d'empiler les filets.
    const ob = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'onboarding.js'), 'utf8');
    assert.ok(!/regimeTouche/.test(ob), 'onboarding.js enregistre désormais regimeTouche : relire le réamorçage du rejeu');
  });

  t('une profession libérale facture une note d\'honoraires', () => {
    const med = { name: 'X', activity: 'sante' };
    const dev = { name: 'X', activity: 'informatique' };
    assert.strictEqual(core.docLabel('facture', med), 'Note d\'honoraires');
    assert.strictEqual(core.docLabel('facture', dev), 'Facture');
    assert.strictEqual(core.docLabel('facture', med, 'en'), 'Fee note');
    // Seule la FACTURE change de nom : un devis reste un devis, un avoir un avoir.
    ['devis', 'avoir', 'proforma', 'livraison'].forEach(t2 =>
      assert.strictEqual(core.docLabel(t2, med), core.TITLES[t2], `« ${t2} » ne doit pas changer de nom`));
    // Et le titre imprimé suit.
    const doc = { id: 'd', type: 'facture', number: 'FAC-2026-001', date: '2026-09-14', dueDate: '2026-10-14', clientId: 'c', status: 'envoyée', lines: [{ label: 'C', qty: 1, unitPrice: 50, vatRate: 0 }] };
    assert.ok(/Note d.{0,8}honoraires/.test(core.documentHtml(doc, { id: 'c', name: 'Cl' }, { ...med, matricule: '1' }, {})),
      'le document imprimé doit porter « Note d\'honoraires »');
    // Le TYPE, lui, ne bouge pas : même préfixe, même numérotation, même valeur comptable.
    assert.strictEqual(core.PREFIX.facture, 'FAC', 'la note d\'honoraires reste une facture : le préfixe ne change pas');
  });

  t('le RIB n\'est réclamé qu\'à qui attend un virement', () => {
    const sansRib = a => ({ name: 'A', matricule: '1', activity: a });
    assert.deepStrictEqual(core.companyGaps(sansRib('conseil')), ['le RIB'], 'un prestataire payé par virement doit le voir manquer');
    assert.deepStrictEqual(core.companyGaps(sansRib('restauration')), [], 'un restaurant encaisse sur place');
    assert.deepStrictEqual(core.companyGaps(sansRib('beaute')), []);
    assert.deepStrictEqual(core.companyGaps(sansRib('')), ['le RIB'], 'métier inconnu : on le réclame, comme avant');
    // Le RIB renseigné ne manque évidemment jamais.
    assert.deepStrictEqual(core.companyGaps({ name: 'A', matricule: '1', activity: 'conseil', rib: 'TN59' }), []);
    // Les deux autres manques ne bougent pas.
    assert.ok(core.companyGaps({ activity: 'restauration' }).includes('la raison sociale'));
    assert.ok(core.companyGaps({ activity: 'restauration' }).includes('le matricule fiscal'));
    // Et l'avertissement à l'émission suit la MÊME règle : deux écrans qui disent la même chose ne
    // peuvent pas se contredire (règle 6.8.1, un compteur et sa liste se calculent pareil).
    const app = lireApp();
    assert.ok(/C\.ribAttendu\(co\)[^;]*rib[^;]*\.trim\(\)/.test(app.replace(/\s+/g, ' ')),
      'l\'avertissement d\'émission réclame encore le RIB à tout le monde');
  });

  t('l\'installeur Windows a des fins de ligne Windows', () => {
    // `cmd.exe` lit un fichier batch OCTET PAR OCTET. Avec des fins de ligne Unix il se
    // desynchronise sur le premier bloc « if ... ( ... ) » : erreur de syntaxe, et la fenetre se
    // ferme sans un mot — impossible a diagnostiquer pour qui double-clique le fichier.
    // C'est ce qui est arrive a l'installeur Windows jusqu'a la 7.21.1.
    const racine = path.join(__dirname, '..');
    // On descend dans les sous-dossiers : un .bat en fins de ligne Unix ferme la fenetre ou
    // qu'il soit, et le recolleur de « Installateur Temporaire/ » n'est pas a la racine.
    const ignore = new Set(['node_modules', 'dist', 'dist-cabinet', 'dist-e2e', '.git']);
    const parcourir = (dir, prefixe = '') => fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => !ignore.has(e.name))
      .flatMap(e => e.isDirectory()
        ? parcourir(path.join(dir, e.name), prefixe + e.name + '/')
        : (/\.(bat|cmd|ps1)$/i.test(e.name) ? [prefixe + e.name] : []));
    const bats = parcourir(racine);
    assert.ok(bats.length >= 1, `aucun fichier batch lu : le parcours des sous-dossiers ne marche pas`);
    bats.forEach(f => {
      const brut = fs.readFileSync(path.join(racine, f));
      const lf = (brut.toString('binary').match(/\n/g) || []).length;
      const crlf = (brut.toString('binary').match(/\r\n/g) || []).length;
      assert.strictEqual(lf - crlf, 0, `« ${f} » contient ${lf - crlf} fin(s) de ligne Unix : cmd.exe fermera la fenetre`);
      // Et pas d'accent : une console Windows sans la bonne page de code les affiche de travers,
      // et le fichier devient illisible au moment precis ou il doit expliquer une erreur.
      const horsAscii = [...brut].filter(b => b > 127);
      assert.strictEqual(horsAscii.length, 0, `« ${f} » contient ${horsAscii.length} caractere(s) non-ASCII`);
      // Une fenetre qui se ferme toute seule ne dit rien : il faut une pause finale.
      assert.ok(/\npause/i.test(brut.toString('ascii')), `« ${f} » ne met jamais la fenetre en pause : une erreur serait invisible`);
    });

    // `.gitattributes` garantit le CRLF au checkout, quel que soit le reglage du poste. Sans lui,
    // le fichier peut etre re-normalise en LF a la prochaine copie du depot.
    const attrs = fs.readFileSync(path.join(racine, '.gitattributes'), 'utf8');
    assert.ok(/^\*\.bat\s+text eol=crlf$/m.test(attrs), '.gitattributes ne force plus le CRLF sur les .bat');
    assert.ok(/^\*\.command\s+text eol=lf$/m.test(attrs), '.gitattributes ne force plus le LF sur les .command');
  });

  t('un echec de construction se nomme, au lieu du seul mot « echec »', () => {
    // 7.21.2 : le journal d'installation ne portait que « construction : echec ». Une panne qui ne
    // se nomme pas condamne l'utilisateur ET le depannage a distance (regle de la 6.7.2).
    const bat = fs.readFileSync(path.join(__dirname, '..', 'Installer SkanFact (Windows).bat'), 'ascii');
    assert.ok(/call npm run build:win > "%BLOG%" 2>&1/.test(bat),
      'la sortie de la construction n\'est plus capturee : l\'echec redeviendrait muet');
    // Capturer ne suffit pas : il faut que la sortie arrive dans le journal qu'on envoie...
    const versLeJournal = bat.indexOf('type "%BLOG%" >> "%LOG%"');
    assert.ok(versLeJournal > 0, 'le journal de construction n\'est pas verse dans le journal principal');
    // ... ET a l'ecran, dans la branche d'echec, sinon il faut savoir qu'un second fichier existe.
    // On ancre sur les DECLARATIONS d'etiquette (debut de ligne), pas sur `goto :dev` /
    // `goto :echec_build` qui apparaissent plus haut et dans l'autre ordre : la tranche serait vide.
    const debut = bat.search(/^:echec_build$/m);
    const fin = bat.search(/^:dev$/m);
    assert.ok(debut > 0 && fin > debut, 'le decoupage de la branche d\'echec est faux');
    const echec = bat.slice(debut, fin);
    assert.ok(echec.length > 100, 'la branche d\'echec est vide');
    assert.ok(!echec.includes('npm run build:win'), 'la tranche deborde sur la construction : elle prouverait autre chose');
    assert.ok(/\ntype "%BLOG%"\r?\n/.test(echec), 'la branche d\'echec n\'affiche pas ce que la construction a repondu');
    // errorlevel se lit AVANT les `type` qui suivent : chacun le remet a zero. C'est la faute
    // exacte qu'un `if errorlevel 1` place apres aurait introduite, sans que rien ne le signale.
    assert.ok(bat.indexOf('set "RC=%errorlevel%"') < versLeJournal,
      'errorlevel est lu APRES un autre appel : il vaudra celui du `type`, et tout echec passera pour un succes');
  });

  t('l\'installeur Windows appelle des commandes qui existent', () => {
    const racine = path.join(__dirname, '..');
    const bat = fs.readFileSync(path.join(racine, 'Installer SkanFact (Windows).bat'), 'ascii');
    const pkg = JSON.parse(fs.readFileSync(path.join(racine, 'package.json'), 'utf8'));
    // Chaque `npm run <x>` du script doit exister dans package.json : sinon npm repond « Missing
    // script » et le script continue comme si de rien n'etait.
    (bat.match(/npm run ([\w:-]+)/g) || []).map(x => x.slice(8)).forEach(s2 =>
      assert.ok(pkg.scripts[s2], `l'installeur appelle « npm run ${s2} », qui n'existe pas dans package.json`));
    // Tout `goto :label` doit avoir sa cible : un label absent fait sortir cmd.exe du script.
    // Vaut pour TOUS les .bat du depot, pas seulement celui de la racine.
    const sautsTiennent = (nom, source, minimum) => {
      const labels = new Set((source.match(/^:(\w+)/gm) || []).map(x => x.slice(1)));
      const sauts = [...new Set((source.match(/goto :(\w+)/g) || []).map(x => x.slice(6)))];
      assert.ok(sauts.length >= minimum, `« ${nom} » : seulement ${sauts.length} saut(s) lus, le decoupage est faux`);
      sauts.forEach(l => assert.ok(labels.has(l),
        `« ${nom} » : goto :${l} ne mene a aucun label, cmd.exe quitterait le script`));
    };
    sautsTiennent('Installer SkanFact (Windows).bat', bat, 5);
  });

  console.log(`\n${n} tests OK`);
})().catch(e => { console.error(e); process.exit(1); });
