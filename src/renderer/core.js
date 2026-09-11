// Logique métier partagée (calculs, numérotation, montants en lettres, template PDF, journal des ventes).
// Fonctionne dans le navigateur (window.SkanCore) et dans Node (module.exports) pour les tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkanCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const VAT_RATES = [0, 7, 13, 19];
  // Taux de retenue à la source usuels en Tunisie (À VÉRIFIER avec le comptable selon la nature de la prestation).
  const WITHHOLDING_RATES = [0, 1.5, 3, 5, 10, 15];
  const PAYMENT_METHODS = [['virement', 'Virement'], ['cheque', 'Chèque'], ['especes', 'Espèces'], ['traite', 'Traite'], ['carte', 'Carte'], ['autre', 'Autre']];
  const PREFIX = { devis: 'DEV', facture: 'FAC', avoir: 'AVO' };
  const TITLES = { devis: 'Devis', facture: 'Facture', avoir: 'Avoir' };

  const DEFAULT_COMPANY = {
    name: 'SKANCYBER SECURITY SUARL',
    matricule: '1998268D',
    rc: '',
    capital: '',
    address: '08 Rue de l\'Université, Manar 1, El Menzah\n2092 Tunis',
    phone: '',
    email: '',
    website: '',
    rib: '',
    bank: '',
    logo: '',
    footer: 'SKANCYBER SECURITY SUARL — Matricule fiscal 1998268D',
    stampFee: 1.0,        // timbre fiscal (DT) par facture
    quoteValidityDays: 30,
    paymentTermsDays: 30,
    defaultWithholdingRate: 0,
    paymentTerms: 'Paiement par virement bancaire à réception de la facture.',
    quoteTerms: 'Pour accepter ce devis, retournez-le daté et signé avec la mention « Bon pour accord ».',
    currency: 'DT',
    tagline: 'Cybersécurité · Infrastructure · Services informatiques',
    primaryColor: '#1b2430',
    accentColor: '#0f9d8f'
  };

  const DEFAULT_DATA = {
    version: 2,
    company: DEFAULT_COMPANY,
    clients: [],
    catalog: [],
    documents: [],
    counters: {}
  };

  // Statuts enregistrés. Pour une facture, « payée » / « partielle » / « retard » sont DÉDUITS des paiements
  // et des avoirs (effectiveStatus), jamais saisis à la main.
  const STATUSES = {
    devis: ['brouillon', 'envoyé', 'accepté', 'refusé'],
    facture: ['brouillon', 'envoyée', 'annulée'],
    avoir: ['brouillon', 'émis']
  };
  const DISPLAY_STATUSES = {
    devis: STATUSES.devis,
    facture: ['brouillon', 'envoyée', 'partielle', 'retard', 'payée', 'annulée'],
    avoir: STATUSES.avoir
  };
  const STATUS_LABELS = { partielle: 'partiellement payée', retard: 'en retard' };

  // ---------- utilitaires ----------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

  function money(n, currency) {
    const v = round3(n);
    const neg = v < 0;
    const s = Math.abs(v).toFixed(3).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const out = (neg ? '− ' : '') + s;
    return currency ? `${out} ${currency}` : out;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function addDays(iso, days) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + (Number(days) || 0));
    return d.toISOString().slice(0, 10);
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function nl2br(s) { return escapeHtml(s).replace(/\n/g, '<br>'); }

  function statusLabel(s) { return STATUS_LABELS[s] || s; }

  // ---------- numérotation ----------
  // Format : DEV-2026-001 / FAC-2026-001 / AVO-2026-001, compteur par type et par année.
  // Devis : numéro au premier enregistrement. Factures et avoirs : numéro à l'ÉMISSION seulement
  // (un brouillon n'a pas de numéro), pour une numérotation continue sans trou.

  function nextNumber(data, type, dateIso) {
    const year = (dateIso || today()).slice(0, 4);
    const key = `${type}-${year}`;
    const prefix = PREFIX[type] || 'DOC';
    // On repart du max existant pour éviter un doublon si le compteur est incohérent.
    const existing = data.documents
      .filter(d => d.type === type && d.number && d.number.startsWith(`${prefix}-${year}-`))
      .map(d => parseInt(d.number.split('-')[2], 10) || 0);
    const fromDocs = existing.length ? Math.max(...existing) : 0;
    const fromCounter = data.counters[key] || 0;
    const seq = Math.max(fromDocs, fromCounter) + 1;
    data.counters[key] = seq;
    return `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
  }

  function isLocked(doc) { return (doc.type === 'facture' || doc.type === 'avoir') && doc.status !== 'brouillon'; }
  function isIssued(doc) { return doc.status !== 'brouillon'; }

  // ---------- calculs ----------

  function computeTotals(doc, company) {
    const lines = (doc.lines || []).map(l => {
      const qty = Number(l.qty) || 0;
      const unit = Number(l.unitPrice) || 0;
      const rate = Number(l.vatRate) || 0;
      const ht = round3(qty * unit);
      const vat = round3(ht * rate / 100);
      return { ...l, qty, unitPrice: unit, vatRate: rate, ht, vat, ttc: round3(ht + vat), noDiscount: !!l.noDiscount };
    });
    const totalHT = round3(lines.reduce((s, l) => s + l.ht, 0));
    const discountRate = Number(doc.discountRate) || 0;
    // La remise globale ne porte pas sur les lignes « noDiscount » (déduction d'un acompte déjà facturé).
    const discountable = round3(lines.filter(l => !l.noDiscount).reduce((s, l) => s + l.ht, 0));
    const discount = round3(discountable * discountRate / 100);
    const netHT = round3(totalHT - discount);
    // TVA par taux, appliquée après remise globale (remise répartie proportionnellement)
    const factor = discountable > 0 ? (discountable - discount) / discountable : 1;
    const vatByRate = {};
    lines.forEach(l => {
      const base = round3(l.noDiscount ? l.ht : l.ht * factor);
      vatByRate[l.vatRate] = vatByRate[l.vatRate] || { base: 0, vat: 0 };
      vatByRate[l.vatRate].base = round3(vatByRate[l.vatRate].base + base);
      vatByRate[l.vatRate].vat = round3(vatByRate[l.vatRate].vat + base * l.vatRate / 100);
    });
    const totalVAT = round3(Object.values(vatByRate).reduce((s, v) => s + v.vat, 0));
    const stampApplies = (doc.type === 'facture' && doc.applyStamp !== false) || (doc.type === 'avoir' && doc.applyStamp === true);
    const stamp = stampApplies ? round3(company.stampFee || 0) : 0;
    const totalTTC = round3(netHT + totalVAT + stamp);
    // Retenue à la source (factures / avoirs) : calculée sur le TTC hors timbre. À VÉRIFIER avec le comptable.
    const withholdingRate = doc.type === 'devis' ? 0 : (Number(doc.withholdingRate) || 0);
    const withholding = round3((netHT + totalVAT) * withholdingRate / 100);
    const netToPay = round3(totalTTC - withholding);
    return { lines, totalHT, discountRate, discount, netHT, vatByRate, totalVAT, stamp, totalTTC, withholdingRate, withholding, netToPay };
  }

  // Avoirs émis rattachés à une facture
  function creditsFor(data, invoiceId) {
    return (data.documents || []).filter(d => d.type === 'avoir' && d.creditOf === invoiceId && d.status !== 'brouillon');
  }

  // Situation d'une facture : total, avoirs, paiements, reste à payer.
  function invoiceBalance(doc, data, company) {
    const totals = computeTotals(doc, company);
    const credits = creditsFor(data, doc.id);
    const credited = round3(credits.reduce((s, a) => s + computeTotals(a, company).netToPay, 0));
    const paid = round3((doc.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
    const remaining = round3(totals.netToPay - credited - paid);
    return { totals, credits, credited, paid, remaining };
  }

  // Statut affiché. Facture : déduit des paiements/avoirs ; devis et avoir : statut enregistré.
  function effectiveStatus(doc, data, company, todayIso) {
    if (doc.type !== 'facture') return doc.status;
    if (doc.status === 'brouillon' || doc.status === 'annulée') return doc.status;
    const b = invoiceBalance(doc, data, company);
    if (b.remaining <= 0.0005) {
      return b.totals.netToPay > 0 && b.credited >= b.totals.netToPay - 0.0005 ? 'annulée' : 'payée';
    }
    if (b.paid > 0 || b.credited > 0) return 'partielle';
    if (doc.dueDate && doc.dueDate < (todayIso || today())) return 'retard';
    return 'envoyée';
  }

  // ---------- acompte / solde ----------

  // Lignes d'une facture d'acompte : un pourcentage du devis, une ligne par taux de TVA (base après remise).
  function depositLines(quote, percent, company) {
    const t = computeTotals(quote, company);
    const pct = Number(percent) || 0;
    return Object.keys(t.vatByRate).sort((a, b) => a - b).map(rate => ({
      label: `Acompte de ${String(pct).replace('.', ',')} % sur le devis ${quote.number}`,
      description: quote.subject || '',
      qty: 1, unit: '', unitPrice: round3(t.vatByRate[rate].base * pct / 100), vatRate: Number(rate), noDiscount: true
    }));
  }

  // Lignes d'une facture de solde : les lignes du devis, moins les acomptes déjà facturés (émis).
  function settlementLines(quote, depositInvoices) {
    const lines = (quote.lines || []).map(l => ({ ...l }));
    (depositInvoices || []).forEach(inv => {
      (inv.lines || []).forEach(l => lines.push({
        label: `Acompte déjà facturé (${inv.number})`, description: '', qty: 1, unit: '',
        unitPrice: -round3((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)), vatRate: Number(l.vatRate) || 0, noDiscount: true
      }));
    });
    return lines;
  }

  // ---------- journal des ventes, TVA, encaissements ----------

  function inPeriod(iso, from, to) { return (!from || iso >= from) && (!to || iso <= to); }

  function salesJournal(data, company, period) {
    period = period || {};
    const docs = (data.documents || [])
      .filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.number && inPeriod(d.date, period.from, period.to))
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.number || '').localeCompare(b.number || '', undefined, { numeric: true }));
    const clientName = id => ((data.clients || []).find(c => c.id === id) || {}).name || '';
    return docs.map(d => {
      const t = computeTotals(d, company);
      const cancelled = d.type === 'facture' && d.status === 'annulée';
      const sign = cancelled ? 0 : (d.type === 'avoir' ? -1 : 1);
      const status = d.type === 'facture' ? effectiveStatus(d, data, company, period.today) : d.status;
      const bal = d.type === 'facture' ? invoiceBalance(d, data, company) : null;
      const vatByRate = {};
      VAT_RATES.forEach(r => { const v = t.vatByRate[r]; vatByRate[r] = { base: round3((v ? v.base : 0) * sign), vat: round3((v ? v.vat : 0) * sign) }; });
      return {
        id: d.id, date: d.date, number: d.number, type: d.type, typeLabel: TITLES[d.type], client: clientName(d.clientId), subject: d.subject || '',
        ht: round3(t.netHT * sign), vatByRate, tva: round3(t.totalVAT * sign), timbre: round3(t.stamp * sign), ttc: round3(t.totalTTC * sign),
        rs: round3(t.withholding * sign), net: round3(t.netToPay * sign), status, statusLabel: statusLabel(status),
        paid: bal ? bal.paid : 0, remaining: bal ? bal.remaining : 0,
        withholdingCertificate: !!d.withholdingCertificate, creditOfNumber: d.creditOfNumber || ''
      };
    });
  }

  function vatSummary(rows) {
    const byRate = {};
    VAT_RATES.forEach(r => { byRate[r] = { base: 0, vat: 0 }; });
    const sum = { ht: 0, tva: 0, timbre: 0, ttc: 0, rs: 0, net: 0 };
    rows.forEach(r => {
      VAT_RATES.forEach(rate => { byRate[rate].base = round3(byRate[rate].base + r.vatByRate[rate].base); byRate[rate].vat = round3(byRate[rate].vat + r.vatByRate[rate].vat); });
      Object.keys(sum).forEach(k => { sum[k] = round3(sum[k] + r[k]); });
    });
    return { byRate, ...sum, count: rows.length };
  }

  function paymentsJournal(data, company, period) {
    period = period || {};
    const clientName = id => ((data.clients || []).find(c => c.id === id) || {}).name || '';
    const rows = [];
    (data.documents || []).filter(d => d.type === 'facture').forEach(d => {
      (d.payments || []).forEach(p => {
        if (!inPeriod(p.date, period.from, period.to)) return;
        const m = PAYMENT_METHODS.find(x => x[0] === p.method);
        rows.push({ id: p.id, date: p.date, number: d.number, client: clientName(d.clientId), amount: round3(p.amount), method: m ? m[1] : (p.method || ''), reference: p.reference || '', note: p.note || '', docId: d.id });
      });
    });
    return rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  // CSV lisible par Excel en français : séparateur « ; », virgule décimale, BOM UTF-8.
  function toCsv(rows, columns) {
    const cell = (v, type) => {
      if (type === 'money') return round3(v).toFixed(3).replace('.', ',');
      if (type === 'date') return fmtDate(v);
      const s = String(v == null ? '' : v);
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = columns.map(c => cell(c.label)).join(';');
    const body = rows.map(r => columns.map(c => cell(typeof c.get === 'function' ? c.get(r) : r[c.key], c.type)).join(';'));
    return '﻿' + [head].concat(body).join('\r\n') + '\r\n';
  }

  // ---------- migration des données ----------

  function migrateData(d) {
    const base = JSON.parse(JSON.stringify(DEFAULT_DATA));
    if (!d || typeof d !== 'object') return base;
    const data = {
      ...base, ...d,
      company: { ...base.company, ...(d.company || {}) },
      clients: Array.isArray(d.clients) ? d.clients : [], catalog: Array.isArray(d.catalog) ? d.catalog : [],
      documents: Array.isArray(d.documents) ? d.documents : [], counters: d.counters || {}
    };
    data.documents.forEach(doc => {
      if (!Array.isArray(doc.payments)) doc.payments = [];
      doc.withholdingRate = Number(doc.withholdingRate) || 0;
      // Avant la 1.4 : « payée » était un statut saisi. On le convertit en paiement pour garder l'historique.
      if (doc.type === 'facture' && doc.status === 'payée') {
        const t = computeTotals(doc, data.company);
        const paid = doc.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const rest = round3(t.netToPay - paid);
        if (rest > 0) doc.payments.push({ id: uid(), date: doc.paidDate || doc.dueDate || doc.date, amount: rest, method: 'autre', reference: '', note: 'Paiement enregistré avant la version 1.4' });
        doc.status = 'envoyée';
      }
    });
    data.version = 2;
    return data;
  }

  // ---------- montant en lettres (français) ----------

  const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  function below100(n) {
    if (n < 20) return UNITS[n];
    const t = Math.floor(n / 10), u = n % 10;
    if (t === 7 || t === 9) {
      const rest = UNITS[10 + u];
      return TENS[t] + (u === 1 && t === 7 ? ' et ' : '-') + rest;
    }
    if (u === 0) return TENS[t] + (t === 8 ? 's' : '');
    if (u === 1 && t !== 8) return TENS[t] + ' et un';
    return TENS[t] + '-' + UNITS[u];
  }

  function below1000(n) {
    const h = Math.floor(n / 100), r = n % 100;
    let s = '';
    if (h === 1) s = 'cent';
    else if (h > 1) s = UNITS[h] + ' cent' + (r === 0 ? 's' : '');
    if (r) s += (s ? ' ' : '') + below100(r);
    return s;
  }

  function intToWords(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zéro';
    const parts = [];
    const scales = [[1e9, 'milliard', 'milliards'], [1e6, 'million', 'millions'], [1e3, 'mille', 'mille']];
    for (const [val, sing, plur] of scales) {
      if (n >= val) {
        const q = Math.floor(n / val);
        n %= val;
        if (val === 1e3 && q === 1) parts.push('mille');
        else parts.push(below1000(q) + ' ' + (q > 1 ? plur : sing));
      }
    }
    if (n) parts.push(below1000(n));
    return parts.join(' ');
  }

  function amountToWords(amount, currency) {
    const cur = currency || 'DT';
    const curWord = cur === 'DT' || cur === 'TND' ? 'dinar' : cur;
    const v = round3(Math.abs(amount));
    const d = Math.floor(v);
    const m = Math.round((v - d) * 1000);
    let s = intToWords(d) + ' ' + curWord + (d > 1 && curWord === 'dinar' ? 's' : '');
    if (m) s += ' et ' + intToWords(m) + ' millime' + (m > 1 ? 's' : '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- template HTML (aperçu + PDF) ----------

  function documentHtml(doc, client, company, opts) {
    opts = opts || {};
    const t = computeTotals(doc, company);
    const cur = company.currency || 'DT';
    const isInvoice = doc.type === 'facture';
    const isCredit = doc.type === 'avoir';
    const isQuote = doc.type === 'devis';
    const title = TITLES[doc.type] || 'Document';
    const cl = client || {};
    const ink = company.primaryColor || '#1b2430';
    const accent = company.accentColor || '#0f9d8f';
    const numberText = doc.number || 'Brouillon';
    const stampText = opts.stampText != null ? opts.stampText : (!isQuote && doc.status === 'brouillon' ? 'Brouillon' : '');
    const multiVat = Object.keys(t.vatByRate).length > 1;
    const pct = n => String(n).replace('.', ',');

    // teinte claire dérivée de l'accent (mélange avec du blanc)
    const hex = accent.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const tint = (a) => `rgba(${r}, ${g}, ${b}, ${a})`;

    const linesHtml = t.lines.map((l) => `
      <tr>
        <td>
          <div class="lbl">${escapeHtml(l.label)}</div>
          ${l.description ? `<div class="desc">${nl2br(l.description)}</div>` : ''}
        </td>
        <td class="r num">${escapeHtml(String(l.qty).replace('.', ','))}${l.unit ? `<span class="unit"> ${escapeHtml(l.unit)}</span>` : ''}</td>
        <td class="r num">${money(l.unitPrice)}</td>
        <td class="r num dim">${l.vatRate}%</td>
        <td class="r num strong">${money(l.ht)}</td>
      </tr>`).join('');

    const metaItems = isInvoice ? [
      ['Émise le', fmtDate(doc.date)],
      ['À régler avant le', fmtDate(doc.dueDate)],
      doc.deposit ? ['Acompte', `${pct(doc.deposit.percent)} % du devis ${doc.deposit.quoteNumber}`] : (doc.settles ? ['Solde', `du devis ${doc.settles.quoteNumber}`] : (doc.fromQuoteNumber ? ['Suite au devis', doc.fromQuoteNumber] : null)),
      doc.reference ? ['Référence', doc.reference] : null
    ] : isCredit ? [
      ['Émis le', fmtDate(doc.date)],
      doc.creditOfNumber ? ['Annule / rectifie', 'Facture ' + doc.creditOfNumber] : null,
      doc.reference ? ['Référence', doc.reference] : null
    ] : [
      ['Émis le', fmtDate(doc.date)],
      ['Valable jusqu\'au', fmtDate(doc.dueDate)],
      doc.reference ? ['Référence', doc.reference] : null
    ];
    const meta = metaItems.filter(Boolean).map(([k, v]) => `<div class="chip"><span class="ck">${k}</span><span class="cv">${escapeHtml(v)}</span></div>`).join('');

    const vatRows = multiVat ? Object.keys(t.vatByRate).sort((a, b) => a - b).map(rate =>
      `<tr><td>TVA ${rate}% <span class="dim">sur ${money(t.vatByRate[rate].base)}</span></td><td class="r num">${money(t.vatByRate[rate].vat)}</td></tr>`).join('')
      : `<tr><td>TVA</td><td class="r num">${money(t.totalVAT)}</td></tr>`;

    const contact = [company.phone, company.email, company.website].filter(Boolean).map(escapeHtml).join('<br>');
    const clientContact = [cl.matricule ? 'MF / CIN ' + escapeHtml(cl.matricule) : '', cl.phone ? escapeHtml(cl.phone) : '', cl.email ? escapeHtml(cl.email) : ''].filter(Boolean).join('<br>');
    const legal = [company.footer || '', company.rc ? 'RC ' + company.rc : '', company.capital ? 'Capital ' + company.capital : ''].filter(Boolean).join(' — ');
    const grandLabel = isInvoice ? 'Net à payer' : isCredit ? 'Montant de l\'avoir' : 'Total TTC';
    const grandValue = isQuote ? t.totalTTC : t.netToPay;
    const wordsIntro = isInvoice ? 'Arrêtée la présente facture' : isCredit ? 'Arrêté le présent avoir' : 'Arrêté le présent devis';

    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>${title} ${escapeHtml(numberText)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif; color: ${ink}; font-size: 9.5pt; line-height: 1.42; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 296mm; padding: 0 0 12mm; position: relative; background: #fff; overflow: hidden; }
  ${opts.preview ? 'html { zoom: ' + (opts.zoom || 0.5) + '; background: #e9edf1; } body { padding: 8mm 0; } .page { box-shadow: 0 4px 24px rgba(20,40,60,.12); margin: 0 auto; border-radius: 2mm; }' : ''}

  .num { font-variant-numeric: tabular-nums; }
  .mono { font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; font-size: 9pt; letter-spacing: .4px; }
  .dim { color: #8b95a3; }
  .strong { font-weight: 600; }
  .r { text-align: right; white-space: nowrap; }
  .k { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.6px; color: ${accent}; font-weight: 700; }

  /* bandeau clair */
  .hero { background: linear-gradient(135deg, ${tint(.14)} 0%, ${tint(.05)} 60%, #fff 100%); padding: 10mm 18mm 8mm; position: relative; }
  .hero::after { content: ""; position: absolute; right: -30mm; top: -30mm; width: 90mm; height: 90mm; border-radius: 50%; background: ${tint(.08)}; }
  .hero > * { position: relative; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand .logo { max-height: 16mm; max-width: 52mm; display: block; margin-bottom: 2.5mm; }
  .brand .name { font-size: 12.5pt; font-weight: 700; letter-spacing: -.1px; }
  .brand .tag { font-size: 8.5pt; color: #6b7684; margin-top: .5mm; }
  .brand .addr { font-size: 8.5pt; color: #6b7684; margin-top: 2mm; line-height: 1.35; }
  .title { text-align: right; }
  .title .kind { font-size: 30pt; font-weight: 200; letter-spacing: -1px; line-height: 1; color: ${ink}; }
  .title .number { display: inline-block; margin-top: 3mm; background: #fff; color: ${accent}; font-weight: 700; font-size: 9.5pt; letter-spacing: .5px; padding: 1.6mm 3.5mm; border-radius: 99px; box-shadow: 0 1px 4px rgba(20,40,60,.08); }
  .chips { display: flex; gap: 3mm; margin-top: 5mm; flex-wrap: wrap; }
  .chip { background: #fff; border-radius: 3mm; padding: 2mm 3.5mm; box-shadow: 0 1px 4px rgba(20,40,60,.06); }
  .chip .ck { display: block; font-size: 7pt; color: #8b95a3; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600; }
  .chip .cv { display: block; font-size: 10pt; font-weight: 600; margin-top: .4mm; }

  .inner { padding: 5mm 18mm 0; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; }
  .party { padding-left: 4mm; border-left: .7mm solid ${tint(.55)}; }
  .party .k { margin-bottom: 1.5mm; display: block; }
  .party .pname { font-size: 11pt; font-weight: 700; margin-bottom: .8mm; }
  .party .addr { color: #4b5563; }
  .party .more { color: #8b95a3; font-size: 9pt; margin-top: 1mm; }

  table.lines { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 4mm; }
  table.lines thead th { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7684; font-weight: 700; text-align: left; padding: 2.4mm 3mm; background: ${tint(.09)}; }
  table.lines thead th:first-child { border-radius: 2.5mm 0 0 2.5mm; }
  table.lines thead th:last-child { border-radius: 0 2.5mm 2.5mm 0; }
  table.lines thead th.r { text-align: right; }
  table.lines tbody td { padding: 2mm 3mm; border-bottom: .2mm solid #eceff3; vertical-align: top; }
  table.lines tbody tr:last-child td { border-bottom: none; }
  table.lines .lbl { font-weight: 600; }
  table.lines .desc { font-size: 8.8pt; color: #6b7684; margin-top: .6mm; line-height: 1.4; }
  table.lines .unit { color: #9aa3ae; font-size: 8.5pt; }

  .after { display: grid; grid-template-columns: 1fr 74mm; gap: 12mm; margin-top: 3mm; align-items: start; }
  .card { background: ${tint(.07)}; border-radius: 3.5mm; padding: 4mm 5mm; }
  table.totals { width: 100%; border-collapse: collapse; font-size: 9.4pt; }
  table.totals td { padding: .7mm 0; color: #4b5563; }
  table.totals td.r { color: ${ink}; }
  table.totals tr.sub td { border-top: .2mm solid ${tint(.35)}; padding-top: 1.6mm; font-weight: 600; }
  .grand { margin-top: 2mm; padding-top: 2.5mm; border-top: .3mm solid ${tint(.45)}; display: flex; justify-content: space-between; align-items: baseline; }
  .grand .gl { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px; color: ${accent}; }
  .grand .gv { font-size: 17pt; font-weight: 700; letter-spacing: -.4px; }
  .grand .gv small { font-size: 8.5pt; color: ${accent}; margin-left: 1.2mm; letter-spacing: .8px; font-weight: 700; }
  .words { margin-top: 2.5mm; font-size: 8.2pt; color: #6b7684; line-height: 1.45; }
  .words strong { color: ${ink}; font-weight: 600; }

  .info { font-size: 9pt; color: #4b5563; }
  .info .k { margin-bottom: 1.5mm; display: block; }
  .info .row { display: flex; gap: 4mm; padding: .6mm 0; }
  .info .row span:first-child { color: #8b95a3; min-width: 16mm; }
  .info .terms { margin-top: 1.2mm; color: #6b7684; }
  .info + .info, .notes { margin-top: 5mm; }
  .notes { font-size: 9pt; color: #4b5563; white-space: pre-line; line-height: 1.45; }

  .sign { display: flex; justify-content: ${isQuote ? 'space-between' : 'flex-end'}; gap: 12mm; margin-top: 5mm; }
  .sign .s { width: 64mm; height: 15mm; border: .3mm dashed ${tint(.5)}; border-radius: 3.5mm; padding: 3mm 4mm; }
  .sign .s small { display: block; color: #9aa3ae; font-size: 8pt; margin-top: .6mm; }

  .stamp { position: absolute; top: 62mm; right: 24mm; transform: rotate(-12deg); border: .8mm solid ${accent}; color: ${accent}; border-radius: 2mm; padding: 1.5mm 5mm; font-size: 18pt; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; opacity: .45; z-index: 2; }
  .stamp.draft { border-color: #9aa3ae; color: #9aa3ae; }

  .footer { position: absolute; left: 18mm; right: 18mm; bottom: 7mm; font-size: 7.6pt; color: #9aa3ae; display: flex; justify-content: space-between; gap: 6mm; border-top: .2mm solid #eceff3; padding-top: 2.5mm; }
  .footer .f-left { white-space: pre-line; }

  /* documents longs : pas de ligne coupée entre deux pages, en-tête du tableau répété */
  table.lines thead { display: table-header-group; }
  table.lines tr, .after, .sign, .card, .parties { break-inside: avoid; page-break-inside: avoid; }
</style></head>
<body><div class="page">
  ${stampText ? `<div class="stamp${stampText === 'Brouillon' ? ' draft' : ''}">${escapeHtml(stampText)}</div>` : ''}
  <div class="hero">
    <div class="head">
      <div class="brand">
        ${company.logo ? `<img class="logo" src="${company.logo}" alt="">` : ''}
        <div class="name">${escapeHtml(company.name)}</div>
        ${company.tagline ? `<div class="tag">${escapeHtml(company.tagline)}</div>` : ''}
        <div class="addr">${nl2br(company.address)}<br>MF ${escapeHtml(company.matricule)}${contact ? '<br>' + contact : ''}</div>
      </div>
      <div class="title">
        <div class="kind">${title}</div>
        <div class="number">${escapeHtml(numberText)}</div>
      </div>
    </div>
    <div class="chips">${meta}</div>
  </div>

  <div class="inner">
    <div class="parties">
      <div class="party">
        <span class="k">${isInvoice ? 'Facturé à' : isCredit ? 'Client' : 'Préparé pour'}</span>
        <div class="pname">${escapeHtml(cl.name || '')}</div>
        ${cl.address ? `<div class="addr">${nl2br(cl.address)}</div>` : ''}
        ${clientContact ? `<div class="more">${clientContact}</div>` : ''}
      </div>
      ${doc.subject ? `<div class="party"><span class="k">Objet</span><div class="pname" style="font-weight:600;font-size:10.5pt">${escapeHtml(doc.subject)}</div></div>` : ''}
    </div>

    <table class="lines">
      <thead><tr>
        <th>Désignation</th>
        <th class="r" style="width:16mm">Qté</th><th class="r" style="width:26mm">Prix unit. HT</th>
        <th class="r" style="width:12mm">TVA</th><th class="r" style="width:28mm">Total HT</th>
      </tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>

    <div class="after">
      <div>
        ${isInvoice && (company.rib || company.bank || company.paymentTerms) ? `
        <div class="info"><span class="k">Règlement</span>
          ${company.bank ? `<div class="row"><span>Banque</span><span>${escapeHtml(company.bank)}</span></div>` : ''}
          ${company.rib ? `<div class="row"><span>RIB</span><span class="mono">${escapeHtml(company.rib)}</span></div>` : ''}
          ${doc.number ? `<div class="row"><span>Motif</span><span>${escapeHtml(doc.number)}</span></div>` : ''}
          ${company.paymentTerms ? `<div class="terms">${nl2br(company.paymentTerms)}</div>` : ''}
        </div>` : ''}
        ${isCredit ? `
        <div class="info"><span class="k">Avoir</span>
          Cet avoir vient en déduction de la facture ${escapeHtml(doc.creditOfNumber || '')}${doc.creditReason ? ' — ' + escapeHtml(doc.creditReason) : ''}.
        </div>` : ''}
        ${isQuote ? `
        <div class="info"><span class="k">Conditions</span>
          Devis valable jusqu'au ${fmtDate(doc.dueDate)}. ${escapeHtml(company.quoteTerms || '')}
        </div>` : ''}
        ${doc.notes ? `<div class="notes">${nl2br(doc.notes)}</div>` : ''}
      </div>
      <div class="card">
        <table class="totals">
          <tr><td>Total HT</td><td class="r num">${money(t.totalHT)}</td></tr>
          ${t.discount ? `<tr><td>Remise ${pct(t.discountRate)}%</td><td class="r num">− ${money(t.discount)}</td></tr><tr><td>Net HT</td><td class="r num">${money(t.netHT)}</td></tr>` : ''}
          ${vatRows}
          ${t.stamp ? `<tr><td>Timbre fiscal</td><td class="r num">${money(t.stamp)}</td></tr>` : ''}
          ${t.withholding ? `<tr class="sub"><td>Total TTC</td><td class="r num">${money(t.totalTTC)}</td></tr><tr><td>Retenue à la source ${pct(t.withholdingRate)}%</td><td class="r num">− ${money(t.withholding)}</td></tr>` : ''}
        </table>
        <div class="grand"><span class="gl">${grandLabel}</span><span class="gv num">${money(grandValue)}<small>${escapeHtml(cur)}</small></span></div>
        <div class="words">${wordsIntro} à la somme de <strong>${escapeHtml(amountToWords(grandValue, cur).toLowerCase())}</strong>.</div>
      </div>
    </div>

    <div class="sign">
      ${isQuote ? `<div class="s"><span class="k">Bon pour accord</span><small>Date, signature et cachet du client</small></div>` : ''}
      <div class="s"><span class="k">${isQuote ? 'Le prestataire' : 'Cachet et signature'}</span><small>${escapeHtml(company.name)}</small></div>
    </div>
  </div>

  <div class="footer">
    <div class="f-left">${nl2br(legal)}</div>
    <div>${title} ${escapeHtml(numberText)}</div>
  </div>
</div></body></html>`;
  }

  return {
    VAT_RATES, WITHHOLDING_RATES, PAYMENT_METHODS, PREFIX, TITLES, DEFAULT_DATA, DEFAULT_COMPANY, STATUSES, DISPLAY_STATUSES, STATUS_LABELS,
    uid, round3, money, fmtDate, addDays, today, escapeHtml, nl2br, statusLabel,
    nextNumber, isLocked, isIssued, computeTotals, creditsFor, invoiceBalance, effectiveStatus,
    depositLines, settlementLines, salesJournal, vatSummary, paymentsJournal, toCsv, migrateData,
    amountToWords, intToWords, documentHtml
  };
});
