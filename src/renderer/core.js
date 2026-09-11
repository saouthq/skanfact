// Logique métier partagée (calculs, numérotation, montants en lettres, template PDF).
// Fonctionne dans le navigateur (window.SkanCore) et dans Node (module.exports) pour les tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkanCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const VAT_RATES = [0, 7, 13, 19];

  const DEFAULT_COMPANY = {
    name: 'SKANCYBER SECURITY SUARL',
    matricule: '1998268D',
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
    currency: 'DT',
    tagline: 'Cybersécurité · Infrastructure · Services informatiques',
    primaryColor: '#1b2430',
    accentColor: '#0f9d8f'
  };

  const DEFAULT_DATA = {
    version: 1,
    company: DEFAULT_COMPANY,
    clients: [],
    catalog: [],
    documents: [],
    counters: {}
  };

  const STATUSES = {
    devis: ['brouillon', 'envoyé', 'accepté', 'refusé'],
    facture: ['brouillon', 'envoyée', 'payée', 'annulée']
  };

  // ---------- utilitaires ----------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

  function money(n, currency) {
    const v = round3(n);
    const s = v.toFixed(3).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return currency ? `${s} ${currency}` : s;
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

  // ---------- numérotation ----------
  // Format : DEV-2026-001 / FAC-2026-001, compteur par type et par année.

  function nextNumber(data, type, dateIso) {
    const year = (dateIso || today()).slice(0, 4);
    const key = `${type}-${year}`;
    const prefix = type === 'devis' ? 'DEV' : 'FAC';
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

  // ---------- calculs ----------

  function computeTotals(doc, company) {
    const lines = (doc.lines || []).map(l => {
      const qty = Number(l.qty) || 0;
      const unit = Number(l.unitPrice) || 0;
      const rate = Number(l.vatRate) || 0;
      const ht = round3(qty * unit);
      const vat = round3(ht * rate / 100);
      return { ...l, qty, unitPrice: unit, vatRate: rate, ht, vat, ttc: round3(ht + vat) };
    });
    const totalHT = round3(lines.reduce((s, l) => s + l.ht, 0));
    const discountRate = Number(doc.discountRate) || 0;
    const discount = round3(totalHT * discountRate / 100);
    const netHT = round3(totalHT - discount);
    // TVA par taux, appliquée après remise globale (remise répartie proportionnellement)
    const factor = totalHT > 0 ? netHT / totalHT : 1;
    const vatByRate = {};
    lines.forEach(l => {
      const base = round3(l.ht * factor);
      vatByRate[l.vatRate] = vatByRate[l.vatRate] || { base: 0, vat: 0 };
      vatByRate[l.vatRate].base = round3(vatByRate[l.vatRate].base + base);
      vatByRate[l.vatRate].vat = round3(vatByRate[l.vatRate].vat + base * l.vatRate / 100);
    });
    const totalVAT = round3(Object.values(vatByRate).reduce((s, v) => s + v.vat, 0));
    const stamp = doc.type === 'facture' && doc.applyStamp !== false ? round3(company.stampFee || 0) : 0;
    const totalTTC = round3(netHT + totalVAT + stamp);
    return { lines, totalHT, discountRate, discount, netHT, vatByRate, totalVAT, stamp, totalTTC };
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
    const v = round3(amount);
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
    const title = isInvoice ? 'Facture' : 'Devis';
    const cl = client || {};
    const ink = company.primaryColor || '#1b2430';
    const accent = company.accentColor || '#0f9d8f';
    const paid = isInvoice && doc.status === 'payée';
    const multiVat = Object.keys(t.vatByRate).length > 1;

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

    const meta = (isInvoice ? [
      ['Émise le', fmtDate(doc.date)],
      ['À régler avant le', fmtDate(doc.dueDate)],
      doc.fromQuoteNumber ? ['Suite au devis', doc.fromQuoteNumber] : null,
      doc.reference ? ['Référence', doc.reference] : null
    ] : [
      ['Émis le', fmtDate(doc.date)],
      ['Valable jusqu\'au', fmtDate(doc.dueDate)],
      doc.reference ? ['Référence', doc.reference] : null
    ]).filter(Boolean).map(([k, v]) => `<div class="chip"><span class="ck">${k}</span><span class="cv">${escapeHtml(v)}</span></div>`).join('');

    const vatRows = multiVat ? Object.keys(t.vatByRate).sort((a, b) => a - b).map(rate =>
      `<tr><td>TVA ${rate}% <span class="dim">sur ${money(t.vatByRate[rate].base)}</span></td><td class="r num">${money(t.vatByRate[rate].vat)}</td></tr>`).join('')
      : `<tr><td>TVA</td><td class="r num">${money(t.totalVAT)}</td></tr>`;

    const contact = [company.phone, company.email, company.website].filter(Boolean).map(escapeHtml).join('<br>');
    const clientContact = [cl.matricule ? 'MF / CIN ' + escapeHtml(cl.matricule) : '', cl.phone ? escapeHtml(cl.phone) : '', cl.email ? escapeHtml(cl.email) : ''].filter(Boolean).join('<br>');

    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>${title} ${escapeHtml(doc.number)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif; color: ${ink}; font-size: 9.8pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 296mm; padding: 0 0 14mm; position: relative; background: #fff; overflow: hidden; }
  ${opts.preview ? 'html { zoom: ' + (opts.zoom || 0.5) + '; background: #e9edf1; } body { padding: 8mm 0; } .page { box-shadow: 0 4px 24px rgba(20,40,60,.12); margin: 0 auto; border-radius: 2mm; }' : ''}

  .num { font-variant-numeric: tabular-nums; }
  .mono { font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; font-size: 9pt; letter-spacing: .4px; }
  .dim { color: #8b95a3; }
  .strong { font-weight: 600; }
  .r { text-align: right; white-space: nowrap; }
  .k { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.6px; color: ${accent}; font-weight: 700; }

  /* bandeau clair */
  .hero { background: linear-gradient(135deg, ${tint(.14)} 0%, ${tint(.05)} 60%, #fff 100%); padding: 12mm 18mm 9mm; position: relative; }
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
  .chips { display: flex; gap: 3mm; margin-top: 6mm; flex-wrap: wrap; }
  .chip { background: #fff; border-radius: 3mm; padding: 2mm 3.5mm; box-shadow: 0 1px 4px rgba(20,40,60,.06); }
  .chip .ck { display: block; font-size: 7pt; color: #8b95a3; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600; }
  .chip .cv { display: block; font-size: 10pt; font-weight: 600; margin-top: .4mm; }

  .inner { padding: 6mm 18mm 0; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; }
  .party { padding-left: 4mm; border-left: .7mm solid ${tint(.55)}; }
  .party .k { margin-bottom: 1.5mm; display: block; }
  .party .pname { font-size: 11pt; font-weight: 700; margin-bottom: .8mm; }
  .party .addr { color: #4b5563; }
  .party .more { color: #8b95a3; font-size: 9pt; margin-top: 1mm; }

  .subject { margin-top: 7mm; font-size: 10.5pt; }
  .subject .k { display: block; margin-bottom: .8mm; }

  table.lines { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 5mm; }
  table.lines thead th { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7684; font-weight: 700; text-align: left; padding: 2.4mm 3mm; background: ${tint(.09)}; }
  table.lines thead th:first-child { border-radius: 2.5mm 0 0 2.5mm; }
  table.lines thead th:last-child { border-radius: 0 2.5mm 2.5mm 0; }
  table.lines thead th.r { text-align: right; }
  table.lines tbody td { padding: 2.3mm 3mm; border-bottom: .2mm solid #eceff3; vertical-align: top; }
  table.lines tbody tr:last-child td { border-bottom: none; }
  table.lines .lbl { font-weight: 600; }
  table.lines .desc { font-size: 8.8pt; color: #6b7684; margin-top: .6mm; line-height: 1.4; }
  table.lines .unit { color: #9aa3ae; font-size: 8.5pt; }

  .after { display: grid; grid-template-columns: 1fr 74mm; gap: 12mm; margin-top: 4mm; align-items: start; }
  .card { background: ${tint(.07)}; border-radius: 3.5mm; padding: 4mm 5mm; }
  table.totals { width: 100%; border-collapse: collapse; font-size: 9.8pt; }
  table.totals td { padding: 1mm 0; color: #4b5563; }
  table.totals td.r { color: ${ink}; }
  .grand { margin-top: 2mm; padding-top: 2.5mm; border-top: .3mm solid ${tint(.45)}; display: flex; justify-content: space-between; align-items: baseline; }
  .grand .gl { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px; color: ${accent}; }
  .grand .gv { font-size: 17pt; font-weight: 700; letter-spacing: -.4px; }
  .grand .gv small { font-size: 8.5pt; color: ${accent}; margin-left: 1.2mm; letter-spacing: .8px; font-weight: 700; }
  .words { margin-top: 3mm; font-size: 8.4pt; color: #6b7684; line-height: 1.45; }
  .words strong { color: ${ink}; font-weight: 600; }

  .info { font-size: 9pt; color: #4b5563; }
  .info .k { margin-bottom: 1.5mm; display: block; }
  .info .row { display: flex; gap: 4mm; padding: .6mm 0; }
  .info .row span:first-child { color: #8b95a3; min-width: 16mm; }
  .info + .info, .notes { margin-top: 5mm; }
  .notes { font-size: 9pt; color: #4b5563; white-space: pre-line; line-height: 1.45; }

  .sign { display: flex; justify-content: ${isInvoice ? 'flex-end' : 'space-between'}; gap: 12mm; margin-top: 6mm; }
  .sign .s { width: 64mm; height: 17mm; border: .3mm dashed ${tint(.5)}; border-radius: 3.5mm; padding: 3mm 4mm; }
  .sign .s small { display: block; color: #9aa3ae; font-size: 8pt; margin-top: .6mm; }

  .stamp { position: absolute; top: 62mm; right: 24mm; transform: rotate(-12deg); border: .8mm solid ${accent}; color: ${accent}; border-radius: 2mm; padding: 1.5mm 5mm; font-size: 18pt; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; opacity: .45; z-index: 2; }

  .footer { position: absolute; left: 18mm; right: 18mm; bottom: 8mm; font-size: 7.6pt; color: #9aa3ae; display: flex; justify-content: space-between; gap: 6mm; border-top: .2mm solid #eceff3; padding-top: 2.5mm; }
  .footer .f-left { white-space: pre-line; }

  /* documents longs : pas de ligne coupée entre deux pages, en-tête du tableau répété */
  table.lines thead { display: table-header-group; }
  table.lines tr, .after, .sign, .card, .parties { break-inside: avoid; page-break-inside: avoid; }
</style></head>
<body><div class="page">
  ${paid ? '<div class="stamp">Payée</div>' : ''}
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
        <div class="number">${escapeHtml(doc.number)}</div>
      </div>
    </div>
    <div class="chips">${meta}</div>
  </div>

  <div class="inner">
    <div class="parties">
      <div class="party">
        <span class="k">${isInvoice ? 'Facturé à' : 'Préparé pour'}</span>
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
        ${isInvoice && (company.rib || company.bank) ? `
        <div class="info"><span class="k">Règlement</span>
          ${company.bank ? `<div class="row"><span>Banque</span><span>${escapeHtml(company.bank)}</span></div>` : ''}
          ${company.rib ? `<div class="row"><span>RIB</span><span class="mono">${escapeHtml(company.rib)}</span></div>` : ''}
          <div class="row"><span>Motif</span><span>${escapeHtml(doc.number)}</span></div>
        </div>` : ''}
        ${!isInvoice ? `
        <div class="info"><span class="k">Conditions</span>
          Devis valable jusqu'au ${fmtDate(doc.dueDate)}. Pour l'accepter, retournez-le daté et signé avec la mention « Bon pour accord ».
        </div>` : ''}
        ${doc.notes ? `<div class="notes">${nl2br(doc.notes)}</div>` : ''}
      </div>
      <div class="card">
        <table class="totals">
          <tr><td>Total HT</td><td class="r num">${money(t.totalHT)}</td></tr>
          ${t.discount ? `<tr><td>Remise ${t.discountRate}%</td><td class="r num">− ${money(t.discount)}</td></tr><tr><td>Net HT</td><td class="r num">${money(t.netHT)}</td></tr>` : ''}
          ${vatRows}
          ${t.stamp ? `<tr><td>Timbre fiscal</td><td class="r num">${money(t.stamp)}</td></tr>` : ''}
        </table>
        <div class="grand"><span class="gl">${isInvoice ? 'Net à payer' : 'Total TTC'}</span><span class="gv num">${money(t.totalTTC)}<small>${escapeHtml(cur)}</small></span></div>
        <div class="words">${isInvoice ? 'Arrêtée la présente facture' : 'Arrêté le présent devis'} à la somme de <strong>${escapeHtml(amountToWords(t.totalTTC, cur).toLowerCase())}</strong>.</div>
      </div>
    </div>

    <div class="sign">
      ${!isInvoice ? `<div class="s"><span class="k">Bon pour accord</span><small>Date, signature et cachet du client</small></div>` : ''}
      <div class="s"><span class="k">${isInvoice ? 'Cachet et signature' : 'Le prestataire'}</span><small>${escapeHtml(company.name)}</small></div>
    </div>
  </div>

  <div class="footer">
    <div class="f-left">${nl2br(company.footer || '')}</div>
    <div>${title} ${escapeHtml(doc.number)}</div>
  </div>
</div></body></html>`;
  }

  return {
    VAT_RATES, DEFAULT_DATA, DEFAULT_COMPANY, STATUSES,
    uid, round3, money, fmtDate, addDays, today, escapeHtml, nl2br,
    nextNumber, computeTotals, amountToWords, intToWords, documentHtml
  };
});
