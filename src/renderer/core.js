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

  // Réglages d'une entreprise. Volontairement vides : SkanFact ne présuppose aucune société,
  // l'assistant de première utilisation les remplit. Voir onboarding dans app.js.
  const DEFAULT_COMPANY = {
    name: '',
    matricule: '',
    rc: '',
    capital: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    rib: '',
    bank: '',
    logo: '',
    footer: '',           // vide : la ligne légale est composée à partir du nom et du matricule
    stampFee: 1.0,        // timbre fiscal (DT) par facture — À VÉRIFIER avec le comptable
    quoteValidityDays: 30,
    paymentTermsDays: 30,
    defaultWithholdingRate: 0,
    paymentTerms: 'Paiement par virement bancaire à réception de la facture.',
    quoteTerms: 'Pour accepter ce devis, retournez-le daté et signé avec la mention « Bon pour accord ».',
    paymentTermsEn: 'Payment by bank transfer upon receipt of invoice.',
    quoteTermsEn: 'To accept this quote, please return it dated and signed with the mention "Approved".',
    currency: 'DT',
    defaultLang: 'fr',
    stampImage: '',       // cachet / signature (data URL) sur les documents
    theme: 'light',       // light | dark | auto
    tagline: '',
    accountantEmail: '',
    activity: '',         // secteur choisi à la première utilisation (voir ACTIVITIES)
    primaryColor: '#1b2430',
    accentColor: '#0f9d8f',
    setupDone: false      // l'assistant de première utilisation a été mené jusqu'au bout
  };

  // Secteurs proposés au premier démarrage : ils préremplissent le catalogue, le taux de TVA
  // habituel et le slogan. Rien n'est imposé, tout se modifie ensuite.
  // vat : taux de TVA proposé pour les prestations du secteur — À VÉRIFIER avec le comptable.
  const ACTIVITIES = [
    {
      id: 'informatique', label: 'Informatique et cybersécurité', tagline: 'Cybersécurité · Infrastructure · Services informatiques', vat: 19,
      catalog: [
        ['Audit de sécurité réseau', 'Cartographie, scan de vulnérabilités, rapport et plan d\'action', 1200, 'forfait'],
        ['Maintenance et supervision', 'Surveillance des équipements, mises à jour, intervention sous 24 h', 250, 'mois'],
        ['Installation poste de travail', 'Préparation, sécurisation et mise en réseau d\'un poste', 120, 'u'],
        ['Sauvegarde externalisée', 'Sauvegarde chiffrée automatique avec vérification mensuelle', 90, 'mois'],
        ['Déplacement', 'Frais de déplacement', 60, 'u']
      ]
    },
    {
      id: 'batiment', label: 'Bâtiment et travaux', tagline: 'Construction · Rénovation · Second œuvre', vat: 19,
      catalog: [
        ['Main-d\'œuvre', 'Heure de travail sur chantier', 25, 'h'],
        ['Déplacement et installation de chantier', '', 150, 'forfait'],
        ['Fourniture de matériaux', 'Refacturation des matériaux, sur justificatifs', 0, 'lot'],
        ['Évacuation des gravats', '', 200, 'forfait']
      ]
    },
    {
      id: 'conseil', label: 'Conseil, formation et services', tagline: 'Conseil · Accompagnement · Formation', vat: 19,
      catalog: [
        ['Journée de conseil', 'Intervention sur site ou à distance', 600, 'jour'],
        ['Formation', 'Session pour un groupe, support fourni', 150, 'h'],
        ['Rédaction de livrable', 'Rapport, procédure, cahier des charges', 400, 'forfait'],
        ['Suivi mensuel', 'Point régulier et disponibilité par email', 300, 'mois']
      ]
    },
    {
      id: 'commerce', label: 'Commerce et vente de produits', tagline: '', vat: 19,
      catalog: [
        ['Produit', 'Désignation du produit vendu', 0, 'u'],
        ['Livraison', 'Frais de livraison', 15, 'u'],
        ['Installation / mise en service', '', 80, 'u']
      ]
    },
    {
      id: 'sante', label: 'Santé et paramédical', tagline: '', vat: 0,
      catalog: [
        ['Consultation', '', 50, 'séance'],
        ['Séance de suivi', '', 40, 'séance'],
        ['Déplacement à domicile', '', 20, 'u']
      ]
    },
    {
      id: 'artisanat', label: 'Artisanat et création', tagline: 'Fait main · Sur mesure', vat: 19,
      catalog: [
        ['Pièce sur mesure', 'Création personnalisée', 0, 'u'],
        ['Main-d\'œuvre', 'Heure de travail en atelier', 20, 'h'],
        ['Matières premières', '', 0, 'lot']
      ]
    },
    { id: 'autre', label: 'Autre activité', tagline: '', vat: 19, catalog: [] }
  ];

  const DEFAULT_DATA = {
    version: 3,
    company: DEFAULT_COMPANY,
    clients: [],
    catalog: [],
    documents: [],
    recurring: [],   // contrats récurrents
    templates: [],   // modèles de documents
    snippets: [],    // textes prédéfinis
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
    devis: ['brouillon', 'envoyé', 'expiré', 'accepté', 'refusé'],
    facture: ['brouillon', 'envoyée', 'partielle', 'retard', 'payée', 'annulée'],
    avoir: STATUSES.avoir
  };
  const STATUS_LABELS = { partielle: 'partiellement payée', retard: 'en retard', expiré: 'expiré' };

  // ---------- utilitaires ----------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

  const CURRENCIES = ['DT', 'EUR', 'USD', 'GBP', 'CHF', 'MAD', 'DZD'];
  function decimalsFor(currency) { return !currency || currency === 'DT' || currency === 'TND' ? 3 : 2; }
  function money(n, currency, decimals, lang) {
    const v = round3(n);
    const neg = v < 0;
    const dec = decimals != null ? decimals : decimalsFor(currency);
    const en = lang === 'en';
    const s = Math.abs(v).toFixed(dec).replace('.', en ? '.' : ',').replace(/\B(?=(\d{3})+(?!\d))/g, en ? ',' : ' ');
    const out = (neg ? '− ' : '') + s;
    return currency ? `${out} ${currency}` : out;
  }
  // Montant d'un document ramené à la devise de la société (taux saisi sur le document : 1 devise = x DT)
  function toBase(doc, amount, company) {
    const cur = doc.currency || company.currency;
    if (!cur || cur === company.currency) return round3(amount);
    return round3(amount * (Number(doc.exchangeRate) || 1));
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

  // Statut affiché. Facture : déduit des paiements et des avoirs. Devis : « expiré » quand la date de
  // validité est passée sans réponse du client (le statut enregistré, lui, reste « envoyé »).
  function effectiveStatus(doc, data, company, todayIso) {
    if (doc.type === 'devis') {
      return doc.status === 'envoyé' && doc.dueDate && doc.dueDate < (todayIso || today()) ? 'expiré' : doc.status;
    }
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
      const rate = (d.currency && d.currency !== company.currency) ? (Number(d.exchangeRate) || 1) : 1;
      const sign = (cancelled ? 0 : (d.type === 'avoir' ? -1 : 1)) * rate;
      const status = d.type === 'facture' ? effectiveStatus(d, data, company, period.today) : d.status;
      const bal = d.type === 'facture' ? invoiceBalance(d, data, company) : null;
      const vatByRate = {};
      VAT_RATES.forEach(r => { const v = t.vatByRate[r]; vatByRate[r] = { base: round3((v ? v.base : 0) * sign), vat: round3((v ? v.vat : 0) * sign) }; });
      return {
        id: d.id, date: d.date, number: d.number, type: d.type, typeLabel: TITLES[d.type], client: clientName(d.clientId), subject: d.subject || '',
        ht: round3(t.netHT * sign), vatByRate, tva: round3(t.totalVAT * sign), timbre: round3(t.stamp * sign), ttc: round3(t.totalTTC * sign),
        rs: round3(t.withholding * sign), net: round3(t.netToPay * sign), status, statusLabel: statusLabel(status),
        paid: bal ? round3(bal.paid * rate) : 0, remaining: bal ? round3(bal.remaining * rate) : 0, currency: d.currency || company.currency, rate,
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
        rows.push({ id: p.id, date: p.date, number: d.number, client: clientName(d.clientId), amount: toBase(d, p.amount, company), method: m ? m[1] : (p.method || ''), reference: p.reference || '', note: p.note || '', docId: d.id, currency: d.currency || company.currency });
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
    if (!Array.isArray(data.recurring)) data.recurring = [];
    if (!Array.isArray(data.templates)) data.templates = [];
    if (!Array.isArray(data.snippets)) data.snippets = [];
    data.version = 3;
    return data;
  }

  // ---------- récurrences (contrats) ----------

  const PERIODS = [['month', 'Chaque mois'], ['quarter', 'Chaque trimestre'], ['year', 'Chaque année']];
  const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function monthLabel(iso) { const [y, m] = (iso || today()).split('-'); return `${MONTHS_FR[Number(m) - 1]} ${y}`; }

  // Ajoute n mois en gardant le jour demandé (31 → dernier jour du mois si besoin).
  function addMonths(iso, n, day) {
    const [y, m] = iso.split('-').map(Number);
    const total = y * 12 + (m - 1) + n;
    const ny = Math.floor(total / 12), nm = total % 12;
    const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    const d = Math.min(Math.max(1, Number(day) || Number(iso.slice(8, 10))), last);
    return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function nextRecurrenceDate(fromIso, every, day) {
    const months = every === 'year' ? 12 : every === 'quarter' ? 3 : 1;
    return addMonths(fromIso, months, day);
  }

  function dueRecurrences(data, todayIso) {
    const t = todayIso || today();
    return (data.recurring || []).filter(r => r.active !== false && r.nextDate && r.nextDate <= t);
  }

  // Reprise d'un contrat suspendu : première échéance à partir d'aujourd'hui (les mois suspendus ne sont pas facturés).
  function catchUpRecurrence(nextDate, every, day, todayIso) {
    const t = todayIso || today();
    let d = nextDate || t, guard = 0;
    while (d < t && ++guard < 240) d = nextRecurrenceDate(d, every, day);
    return d;
  }

  // Remplace {client}, {mois}, {numero}… dans un gabarit.
  function fillTemplate(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
  }

  // Brouillon de facture généré par un contrat pour une date donnée (l'app ajoute id/numéro/dates de création).
  function buildRecurringInvoice(rec, dateIso, company) {
    const vars = { mois: monthLabel(dateIso), annee: dateIso.slice(0, 4) };
    return {
      type: 'facture', number: '', status: 'brouillon', date: dateIso, dueDate: addDays(dateIso, company.paymentTermsDays || 30),
      clientId: rec.clientId, subject: fillTemplate(rec.subject, vars), reference: rec.reference || '',
      lines: (rec.lines || []).map(l => ({ ...l, label: fillTemplate(l.label, vars), description: fillTemplate(l.description || '', vars) })),
      discountRate: rec.discountRate || 0, applyStamp: true, notes: fillTemplate(rec.notes || '', vars), payments: [],
      withholdingRate: Number(rec.withholdingRate) || 0, recurringId: rec.id, lang: rec.lang || company.defaultLang || 'fr', currency: rec.currency || company.currency, exchangeRate: rec.exchangeRate || ''
    };
  }

  // ---------- tableau de bord ----------

  function monthKeys(todayIso, n) {
    const [y, m] = (todayIso || today()).split('-').map(Number);
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const total = y * 12 + (m - 1) - i; out.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`); }
    return out;
  }

  // CA HT facturé (avoirs déduits) et encaissements par mois, sur les n derniers mois, en devise société.
  function monthlySeries(data, company, todayIso, n) {
    const keys = monthKeys(todayIso, n || 12);
    const series = keys.map(k => ({ month: k, label: MONTHS_SHORT[Number(k.slice(5, 7)) - 1] + (k.endsWith('-01') || k === keys[0] ? ' ' + k.slice(2, 4) : ''), invoiced: 0, collected: 0 }));
    const byKey = Object.fromEntries(series.map(x => [x.month, x]));
    (data.documents || []).forEach(d => {
      if (d.type === 'facture' || d.type === 'avoir') {
        if (d.status !== 'brouillon' && d.status !== 'annulée' && byKey[(d.date || '').slice(0, 7)]) {
          byKey[d.date.slice(0, 7)].invoiced = round3(byKey[d.date.slice(0, 7)].invoiced + (d.type === 'avoir' ? -1 : 1) * toBase(d, computeTotals(d, company).netHT, company));
        }
        if (d.type === 'facture') (d.payments || []).forEach(p => { const k = (p.date || '').slice(0, 7); if (byKey[k]) byKey[k].collected = round3(byKey[k].collected + toBase(d, Number(p.amount) || 0, company)); });
      }
    });
    return series;
  }

  function topClients(data, company, fromIso, toIso, limit) {
    const totals = {};
    (data.documents || []).filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.status !== 'annulée' && inPeriod(d.date, fromIso, toIso))
      .forEach(d => { totals[d.clientId] = round3((totals[d.clientId] || 0) + (d.type === 'avoir' ? -1 : 1) * toBase(d, computeTotals(d, company).netHT, company)); });
    const name = id => ((data.clients || []).find(c => c.id === id) || {}).name || '—';
    return Object.keys(totals).map(id => ({ clientId: id, name: name(id), ht: totals[id] })).sort((a, b) => b.ht - a.ht).slice(0, limit || 5);
  }

  // Devis émis sur la période : acceptés / refusés / en attente, taux de conversion (acceptés / décidés)
  function quoteStats(data, fromIso, toIso, todayIso) {
    const q = (data.documents || []).filter(d => d.type === 'devis' && d.status !== 'brouillon' && inPeriod(d.date, fromIso, toIso));
    const accepted = q.filter(d => d.status === 'accepté').length, refused = q.filter(d => d.status === 'refusé').length;
    const decided = accepted + refused;
    const expired = q.filter(d => effectiveStatus(d, data, null, todayIso) === 'expiré').length;
    return { total: q.length, accepted, refused, expired, pending: q.length - decided, rate: decided ? Math.round(accepted / decided * 100) : null };
  }

  // Chiffres d'un client : facturé HT, encaissé, reste à payer, délai moyen, dates du premier et du dernier document.
  function clientSummary(data, company, clientId) {
    const docs = (data.documents || []).filter(d => d.clientId === clientId);
    const issued = docs.filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.status !== 'annulée');
    const ht = round3(issued.reduce((s, d) => s + (d.type === 'avoir' ? -1 : 1) * toBase(d, computeTotals(d, company).netHT, company), 0));
    const invoices = docs.filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée');
    const paid = round3(invoices.reduce((s, d) => s + toBase(d, (d.payments || []).reduce((x, p) => x + (Number(p.amount) || 0), 0), company), 0));
    const due = round3(invoices.reduce((s, d) => s + Math.max(0, toBase(d, invoiceBalance(d, data, company).remaining, company)), 0));
    const dates = docs.map(d => d.date).filter(Boolean).sort();
    const quotes = docs.filter(d => d.type === 'devis');
    const accepted = quotes.filter(d => d.status === 'accepté').length;
    const decided = accepted + quotes.filter(d => d.status === 'refusé').length;
    // Délai moyen de paiement de ce client : on raisonne sur l'ensemble des données (les avoirs comptent)
    const delays = [];
    invoices.forEach(d => {
      if (effectiveStatus(d, data, company, '9999-12-31') !== 'payée' || !(d.payments || []).length) return;
      const last = d.payments.map(p => p.date).sort().pop();
      if (last && d.date) delays.push(daysBetween(d.date, last));
    });
    return {
      docs, ht, paid, due, count: docs.length, invoiceCount: invoices.length, quoteCount: quotes.length,
      first: dates[0] || '', last: dates[dates.length - 1] || '',
      conversion: decided ? Math.round(accepted / decided * 100) : null,
      delay: delays.length ? Math.round(delays.reduce((s, x) => s + x, 0) / delays.length) : null
    };
  }

  // Délai moyen (jours) entre la date de facture et le dernier paiement, sur les factures soldées de la période
  function avgPaymentDelay(data, company, fromIso, toIso) {
    const delays = [];
    (data.documents || []).filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée' && inPeriod(d.date, fromIso, toIso)).forEach(d => {
      if (effectiveStatus(d, data, company, '9999-12-31') !== 'payée' || !(d.payments || []).length) return;
      const last = d.payments.map(p => p.date).sort().pop();
      if (last && d.date) delays.push(daysBetween(d.date, last));
    });
    return delays.length ? Math.round(delays.reduce((s, x) => s + x, 0) / delays.length) : null;
  }

  // ---------- relances ----------

  function reminderLevel(daysLate) { return daysLate > 45 ? 3 : daysLate > 15 ? 2 : 1; }
  const REMINDER_LABELS = { 1: 'Rappel', 2: 'Relance', 3: 'Dernière relance' };

  function daysBetween(fromIso, toIso) { return Math.round((new Date(toIso + 'T00:00:00') - new Date(fromIso + 'T00:00:00')) / 86400000); }

  // Factures échues (ou partiellement payées et échues), avec jours de retard et dernière relance.
  // `snoozed` : l'utilisateur a demandé de ne pas relancer avant une date (doc.remindAfter).
  function overdueInvoices(data, company, todayIso) {
    const t = todayIso || today();
    return (data.documents || [])
      .filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée' && d.dueDate && d.dueDate < t)
      .map(d => ({ doc: d, balance: invoiceBalance(d, data, company), status: effectiveStatus(d, data, company, t) }))
      .filter(x => x.balance.remaining > 0.0005)
      .map(x => {
        const daysLate = daysBetween(x.doc.dueDate, t);
        const reminders = x.doc.reminders || [];
        const last = reminders.length ? reminders[reminders.length - 1] : null;
        const snoozed = !!(x.doc.remindAfter && x.doc.remindAfter > t);
        return { doc: x.doc, remaining: x.balance.remaining, daysLate, level: reminderLevel(daysLate), reminders, lastReminder: last, status: x.status, snoozed, remindAfter: x.doc.remindAfter || '' };
      })
      .sort((a, b) => (a.snoozed ? 1 : 0) - (b.snoozed ? 1 : 0) || b.daysLate - a.daysLate);
  }

  // ---------- ce qui demande une action ----------

  // Le panneau « À faire » de l'accueil. Renvoie des groupes ordonnés du plus urgent au moins urgent.
  // Chaque groupe : { id, level (danger|warn|info), label, detail, count, amount, route, docs }
  function todoList(data, company, todayIso) {
    const t = todayIso || today();
    const out = [];
    const cur = company.currency;
    const fmt = n => money(n, cur);

    const overdue = overdueInvoices(data, company, t).filter(x => !x.snoozed);
    const overdueAmount = round3(overdue.reduce((s, x) => s + toBase(x.doc, x.remaining, company), 0));
    if (overdue.length) out.push({
      id: 'retards', level: 'danger', label: `${overdue.length} facture${overdue.length > 1 ? 's' : ''} en retard`,
      detail: `${fmt(overdueAmount)} à récupérer · plus ancienne : ${overdue[0].daysLate} jours`,
      count: overdue.length, amount: overdueAmount, route: '#/relances', docs: overdue.map(x => x.doc)
    });

    // Fiche société : sans raison sociale ni matricule, une facture n'est pas conforme ; sans RIB, le client ne sait pas où payer
    const missing = companyGaps(company);
    if (missing.length) out.push({
      id: 'societe', level: 'warn', label: 'Fiche société incomplète',
      detail: `Il manque : ${missing.join(', ')}. Ces informations s'impriment sur chaque document.`,
      count: missing.length, route: '#/parametres', docs: []
    });

    const due = dueRecurrences(data, t);
    if (due.length) out.push({
      id: 'contrats', level: 'warn', label: `${due.length} facture${due.length > 1 ? 's' : ''} de contrat à générer`,
      detail: due.map(r => fillTemplate(r.subject, { mois: monthLabel(r.nextDate) })).join(' · '),
      count: due.length, route: '#/contrats', docs: []
    });

    // Devis acceptés dont aucune facture (même brouillon) n'a été tirée : le travail est vendu, pas facturé
    const billed = new Set((data.documents || []).filter(d => d.type === 'facture' && d.fromQuoteId).map(d => d.fromQuoteId));
    const accepted = (data.documents || []).filter(d => d.type === 'devis' && d.status === 'accepté' && !billed.has(d.id));
    const acceptedAmount = round3(accepted.reduce((s, d) => s + toBase(d, computeTotals(d, company).totalTTC, company), 0));
    if (accepted.length) out.push({
      id: 'devis-acceptes', level: 'warn', label: `${accepted.length} devis accepté${accepted.length > 1 ? 's' : ''} à facturer`,
      detail: `${fmt(acceptedAmount)} TTC vendus et pas encore facturés. Ouvre le devis puis « Facturer ▾ ».`,
      count: accepted.length, amount: acceptedAmount, route: '#/devis', docs: accepted
    });

    const expired = (data.documents || []).filter(d => d.type === 'devis' && effectiveStatus(d, data, company, t) === 'expiré');
    if (expired.length) out.push({
      id: 'devis-expires', level: 'warn', label: `${expired.length} devis expiré${expired.length > 1 ? 's' : ''}`,
      detail: 'La date de validité est passée sans réponse : relance ou classe-les en refusés.',
      count: expired.length, route: '#/devis', docs: expired
    });

    // Devis envoyés, encore valables, mais sans nouvelle depuis plus de 15 jours
    const silent = (data.documents || []).filter(d => d.type === 'devis' && effectiveStatus(d, data, company, t) === 'envoyé' && d.date && daysBetween(d.date, t) > 15);
    if (silent.length) out.push({
      id: 'devis-sans-reponse', level: 'info', label: `${silent.length} devis sans réponse depuis plus de 15 jours`,
      detail: 'Un appel ou un email relance souvent une décision qui traîne.',
      count: silent.length, route: '#/devis', docs: silent
    });

    const rsPending = (data.documents || []).filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée'
      && computeTotals(d, company).withholding > 0 && !d.withholdingCertificate);
    const rsAmount = round3(rsPending.reduce((s, d) => s + toBase(d, computeTotals(d, company).withholding, company), 0));
    if (rsPending.length) out.push({
      id: 'attestations', level: 'warn', label: `${rsPending.length} attestation${rsPending.length > 1 ? 's' : ''} de retenue à réclamer`,
      detail: `${fmt(rsAmount)} retenus par tes clients. Sans attestation, tu ne peux pas les déduire de ton impôt.`,
      count: rsPending.length, amount: rsAmount, route: '#/compta', docs: rsPending
    });

    const soon = (data.documents || []).filter(d => d.type === 'facture' && ['envoyée', 'partielle'].includes(effectiveStatus(d, data, company, t))
      && d.dueDate && d.dueDate >= t && daysBetween(t, d.dueDate) <= 7);
    if (soon.length) out.push({
      id: 'echeances', level: 'info', label: `${soon.length} facture${soon.length > 1 ? 's' : ''} à échéance cette semaine`,
      detail: 'Un message avant l\'échéance évite souvent la relance après.',
      count: soon.length, route: '#/relances', docs: soon
    });

    const oldDrafts = (data.documents || []).filter(d => d.status === 'brouillon' && d.date && daysBetween(d.date, t) > 7);
    if (oldDrafts.length) out.push({
      id: 'brouillons', level: 'info', label: `${oldDrafts.length} brouillon${oldDrafts.length > 1 ? 's' : ''} de plus de 7 jours`,
      detail: 'Un brouillon oublié, c\'est un travail non facturé.',
      count: oldDrafts.length, route: '#/factures', docs: oldDrafts
    });

    return out;
  }

  // Ce qui manque à la fiche société pour que les documents soient complets.
  function companyGaps(company) {
    const c = company || {};
    const out = [];
    if (!(c.name || '').trim()) out.push('la raison sociale');
    if (!(c.matricule || '').trim()) out.push('le matricule fiscal');
    if (!(c.rib || '').trim()) out.push('le RIB');
    return out;
  }

  // Historique d'un document, reconstitué à partir de ce qui est déjà enregistré.
  function documentHistory(doc, data, company) {
    const ev = [];
    const dateOf = ms => new Date(ms).toISOString().slice(0, 10);
    if (doc.createdAt) ev.push({ date: dateOf(doc.createdAt), kind: 'cree', label: 'Brouillon créé' });
    if (doc.fromQuoteNumber) ev.push({ date: doc.date, kind: 'devis', label: `Établi à partir du devis ${doc.fromQuoteNumber}`, id: doc.fromQuoteId });
    if (doc.number && doc.status !== 'brouillon') ev.push({ date: doc.date, kind: 'emis', label: `${TITLES[doc.type]} ${doc.number} ${doc.type === 'facture' ? 'émise' : 'émis'}` });
    // Côté devis : les factures qui en sont tirées (conversion, acompte, solde), même encore en brouillon
    if (doc.type === 'devis' && doc.id) (data.documents || []).filter(d => d.type === 'facture' && d.fromQuoteId === doc.id).forEach(inv => {
      const what = inv.deposit ? `Facture d'acompte ${inv.deposit.percent} %` : inv.settles ? 'Facture de solde' : 'Facture';
      ev.push({ date: inv.date, kind: 'facture', label: `${what} ${inv.number || '(brouillon)'} établie`, detail: inv.status === 'brouillon' ? 'pas encore émise' : '', id: inv.id });
    });
    (doc.emails || []).forEach(e => ev.push({
      date: e.date, kind: /^relance/.test(e.kind) ? 'relance' : 'email',
      label: /^relance/.test(e.kind) ? (REMINDER_LABELS[Number(e.kind.slice(-1))] || 'Relance') + ' par email' : 'Envoyé par email',
      detail: e.to || ''
    }));
    (doc.reminders || []).filter(r => r.channel && r.channel !== 'email').forEach(r => ev.push({
      date: r.date, kind: 'relance', label: (REMINDER_LABELS[r.level] || 'Relance') + ' par téléphone', detail: r.note || ''
    }));
    (doc.payments || []).forEach(p => {
      const m = PAYMENT_METHODS.find(x => x[0] === p.method);
      ev.push({ date: p.date, kind: 'paiement', label: `Paiement de ${money(p.amount, doc.currency || company.currency)}`, detail: [m ? m[1] : p.method, p.reference].filter(Boolean).join(' · ') });
    });
    if (doc.remindAfter) ev.push({ date: doc.remindAfter, kind: 'report', label: 'Ne pas relancer avant cette date' });
    if (doc.type === 'facture') creditsFor(data, doc.id).forEach(a => ev.push({ date: a.date, kind: 'avoir', label: `Avoir ${a.number}`, detail: a.creditReason || '', id: a.id }));
    if (doc.withholdingCertificate) ev.push({ date: '', kind: 'attestation', label: 'Attestation de retenue à la source reçue' });
    if (doc.status === 'annulée') ev.push({ date: '', kind: 'annule', label: 'Facture marquée annulée' });
    return ev.filter(e => e.date !== undefined).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  }

  // ---------- emails ----------

  const DEFAULT_EMAIL_TEMPLATES = {
    devis: { subject: 'Devis {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre devis {numero} ({montant} TTC) concernant : {objet}.\nIl est valable jusqu\'au {echeance}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n{societe}' },
    facture: { subject: 'Facture {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint notre facture {numero} d\'un montant de {montant} TTC, à régler avant le {echeance}.\n\nMerci de votre confiance.\n\nCordialement,\n{societe}' },
    avoir: { subject: 'Avoir {numero} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint l\'avoir {numero} ({montant}) relatif à la facture {reference}.\n\nCordialement,\n{societe}' },
    relance1: { subject: 'Rappel — facture {numero}', body: 'Bonjour,\n\nSauf erreur de notre part, la facture {numero} ({montant}) arrivée à échéance le {echeance} reste en attente de règlement.\nSi le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.\n\nCordialement,\n{societe}' },
    relance2: { subject: 'Relance — facture {numero} en retard de {jours} jours', body: 'Bonjour,\n\nNotre facture {numero} d\'un montant de {montant}, échue le {echeance}, n\'a pas été réglée à ce jour ({jours} jours de retard).\nMerci de procéder au règlement dans les meilleurs délais ou de nous indiquer la date prévue.\n\nCordialement,\n{societe}' },
    relance3: { subject: 'Dernière relance — facture {numero}', body: 'Bonjour,\n\nMalgré nos précédents rappels, la facture {numero} ({montant}, échue le {echeance}) reste impayée après {jours} jours.\nSans règlement sous 8 jours, nous serons contraints d\'engager une procédure de recouvrement.\n\nCordialement,\n{societe}' },
    relanceDevis: { subject: 'Notre devis {numero} — {objet}', body: 'Bonjour,\n\nNous vous avons adressé le devis {numero} ({montant} TTC) concernant : {objet}.\nAvez-vous pu l\'examiner ? Nous restons disponibles pour en discuter ou l\'ajuster si besoin.\n\nCordialement,\n{societe}' },
    comptable: { subject: 'Comptabilité {objet} — {societe}', body: 'Bonjour,\n\nVeuillez trouver ci-joint le journal des ventes de {objet} : {numero} document(s), {montant} de chiffre d\'affaires hors taxes.\n\nJe reste à votre disposition pour tout complément.\n\nCordialement,\n{societe}' }
  };

  const DEFAULT_EMAIL_TEMPLATES_EN = {
    devis: { subject: 'Quote {numero} — {societe}', body: 'Hello,\n\nPlease find attached our quote {numero} ({montant} incl. VAT) for: {objet}.\nIt is valid until {echeance}.\n\nWe remain at your disposal for any question.\n\nBest regards,\n{societe}' },
    facture: { subject: 'Invoice {numero} — {societe}', body: 'Hello,\n\nPlease find attached our invoice {numero} for {montant}, due by {echeance}.\n\nThank you for your trust.\n\nBest regards,\n{societe}' },
    avoir: { subject: 'Credit note {numero} — {societe}', body: 'Hello,\n\nPlease find attached credit note {numero} ({montant}) related to invoice {reference}.\n\nBest regards,\n{societe}' },
    relance1: { subject: 'Reminder — invoice {numero}', body: 'Hello,\n\nUnless we are mistaken, invoice {numero} ({montant}) due on {echeance} is still awaiting payment.\nIf you have already paid, please disregard this message.\n\nBest regards,\n{societe}' },
    relance2: { subject: 'Second reminder — invoice {numero} is {jours} days overdue', body: 'Hello,\n\nOur invoice {numero} for {montant}, due on {echeance}, remains unpaid ({jours} days overdue).\nPlease proceed with payment as soon as possible or let us know the expected date.\n\nBest regards,\n{societe}' },
    relance3: { subject: 'Final reminder — invoice {numero}', body: 'Hello,\n\nDespite our previous reminders, invoice {numero} ({montant}, due on {echeance}) remains unpaid after {jours} days.\nWithout payment within 8 days, we will have to start a recovery procedure.\n\nBest regards,\n{societe}' },
    relanceDevis: { subject: 'Our quote {numero} — {objet}', body: 'Hello,\n\nWe sent you quote {numero} ({montant} incl. VAT) for: {objet}.\nHave you had a chance to review it? We remain available to discuss or adjust it.\n\nBest regards,\n{societe}' },
    comptable: { subject: 'Accounting {objet} — {societe}', body: 'Hello,\n\nPlease find attached the sales journal for {objet}.\n\nBest regards,\n{societe}' }
  };

  function emailFor(kind, doc, client, company, extra) {
    const en = (doc.lang || (client && client.lang) || company.defaultLang) === 'en';
    const templates = en ? { ...DEFAULT_EMAIL_TEMPLATES_EN, ...(company.emailTemplatesEn || {}) } : { ...DEFAULT_EMAIL_TEMPLATES, ...(company.emailTemplates || {}) };
    const tpl = templates[kind] || templates.facture;
    const t = computeTotals(doc, company);
    const cur = doc.currency || company.currency || 'DT';
    const vars = {
      numero: doc.number || 'brouillon', objet: doc.subject || '', client: (client || {}).name || '', societe: company.name,
      montant: money(doc.type === 'devis' ? t.totalTTC : t.netToPay, cur), echeance: fmtDate(doc.dueDate), reference: doc.creditOfNumber || doc.reference || '',
      ...(extra || {})
    };
    return { to: (client || {}).email || '', subject: fillTemplate(tpl.subject, vars), body: fillTemplate(tpl.body, vars) };
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

  // ---------- montant en lettres (anglais) ----------

  const UNITS_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function below1000En(n) {
    const h = Math.floor(n / 100), r = n % 100;
    let s = h ? UNITS_EN[h] + ' hundred' : '';
    if (r) s += (s ? ' and ' : '') + (r < 20 ? UNITS_EN[r] : TENS_EN[Math.floor(r / 10)] + (r % 10 ? '-' + UNITS_EN[r % 10] : ''));
    return s;
  }
  function intToWordsEn(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zero';
    const parts = [];
    [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']].forEach(([val, name]) => { if (n >= val) { parts.push(below1000En(Math.floor(n / val)) + ' ' + name); n %= val; } });
    if (n) parts.push(below1000En(n));
    return parts.join(' ');
  }

  // Unités monétaires : [singulier, pluriel, sous-unité singulier, pluriel, diviseur]
  const CURRENCY_WORDS = {
    fr: { DT: ['dinar', 'dinars', 'millime', 'millimes', 1000], TND: ['dinar', 'dinars', 'millime', 'millimes', 1000], EUR: ['euro', 'euros', 'centime', 'centimes', 100], USD: ['dollar', 'dollars', 'cent', 'cents', 100], GBP: ['livre', 'livres', 'penny', 'pence', 100], CHF: ['franc', 'francs', 'centime', 'centimes', 100], MAD: ['dirham', 'dirhams', 'centime', 'centimes', 100], DZD: ['dinar', 'dinars', 'centime', 'centimes', 100] },
    en: { DT: ['dinar', 'dinars', 'millime', 'millimes', 1000], TND: ['dinar', 'dinars', 'millime', 'millimes', 1000], EUR: ['euro', 'euros', 'cent', 'cents', 100], USD: ['dollar', 'dollars', 'cent', 'cents', 100], GBP: ['pound', 'pounds', 'penny', 'pence', 100], CHF: ['franc', 'francs', 'centime', 'centimes', 100], MAD: ['dirham', 'dirhams', 'centime', 'centimes', 100], DZD: ['dinar', 'dinars', 'centime', 'centimes', 100] }
  };

  function amountToWords(amount, currency, lang) {
    const cur = currency || 'DT';
    const en = lang === 'en';
    const w = (CURRENCY_WORDS[en ? 'en' : 'fr'][cur]) || [cur, cur, en ? 'cent' : 'centime', en ? 'cents' : 'centimes', 100];
    const v = round3(Math.abs(amount));
    const d = Math.floor(v);
    const m = Math.round((v - d) * w[4]);
    const words = en ? intToWordsEn : intToWords;
    let s = words(d) + ' ' + (d > 1 ? w[1] : w[0]);
    if (m) s += (en ? ' and ' : ' et ') + words(m) + ' ' + (m > 1 ? w[3] : w[2]);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- template HTML (aperçu + PDF) ----------

  const I18N = {
    fr: {
      devis: 'Devis', facture: 'Facture', avoir: 'Avoir', issuedF: 'Émise le', issued: 'Émis le', dueBy: 'À régler avant le', validUntil: 'Valable jusqu\'au',
      deposit: 'Acompte', depositOf: '% du devis', balance: 'Solde', balanceOf: 'du devis', afterQuote: 'Suite au devis', reference: 'Référence', cancels: 'Annule / rectifie',
      billedTo: 'Facturé à', preparedFor: 'Préparé pour', client: 'Client', subject: 'Objet', designation: 'Désignation', qty: 'Qté', unitPrice: 'Prix unit. HT', vat: 'TVA', lineTotal: 'Total HT',
      payment: 'Règlement', bank: 'Banque', rib: 'RIB', motif: 'Motif', creditText: n => `Cet avoir vient en déduction de la facture ${n}`, conditions: 'Conditions', validText: d => `Devis valable jusqu'au ${d}.`,
      subtotal: 'Total HT', discount: 'Remise', netHT: 'Net HT', on: 'sur', stamp: 'Timbre fiscal', totalTTC: 'Total TTC', withholding: 'Retenue à la source', netToPay: 'Net à payer', creditAmount: 'Montant de l\'avoir',
      wordsInvoice: 'Arrêtée la présente facture à la somme de', wordsCredit: 'Arrêté le présent avoir à la somme de', wordsQuote: 'Arrêté le présent devis à la somme de',
      approve: 'Bon pour accord', approveSub: 'Date, signature et cachet du client', stampSign: 'Cachet et signature', provider: 'Le prestataire', draft: 'Brouillon', paid: 'Payée', cancelled: 'Annulée', mf: 'MF', mfCin: 'MF / CIN', rate: 'Taux'
    },
    en: {
      devis: 'Quote', facture: 'Invoice', avoir: 'Credit note', issuedF: 'Issued on', issued: 'Issued on', dueBy: 'Due by', validUntil: 'Valid until',
      deposit: 'Deposit', depositOf: '% of quote', balance: 'Balance', balanceOf: 'of quote', afterQuote: 'Following quote', reference: 'Reference', cancels: 'Cancels / corrects',
      billedTo: 'Billed to', preparedFor: 'Prepared for', client: 'Client', subject: 'Subject', designation: 'Description', qty: 'Qty', unitPrice: 'Unit price', vat: 'VAT', lineTotal: 'Total excl. VAT',
      payment: 'Payment', bank: 'Bank', rib: 'Account (RIB)', motif: 'Reference', creditText: n => `This credit note is deducted from invoice ${n}`, conditions: 'Terms', validText: d => `This quote is valid until ${d}.`,
      subtotal: 'Subtotal excl. VAT', discount: 'Discount', netHT: 'Net excl. VAT', on: 'on', stamp: 'Stamp duty', totalTTC: 'Total incl. VAT', withholding: 'Withholding tax', netToPay: 'Amount due', creditAmount: 'Credit amount',
      wordsInvoice: 'Total amount in words:', wordsCredit: 'Total amount in words:', wordsQuote: 'Total amount in words:',
      approve: 'Approved — signature', approveSub: 'Date, signature and stamp of the client', stampSign: 'Stamp and signature', provider: 'Provider', draft: 'Draft', paid: 'Paid', cancelled: 'Cancelled', mf: 'Tax ID', mfCin: 'Tax ID', rate: 'Rate'
    }
  };

  function documentHtml(doc, client, company, opts) {
    opts = opts || {};
    const t = computeTotals(doc, company);
    const lang = (doc.lang || company.defaultLang) === 'en' ? 'en' : 'fr';
    const L = I18N[lang];
    const cur = doc.currency || company.currency || 'DT';
    const dec = decimalsFor(cur);
    const fmt = n => money(n, null, dec, lang);
    const isInvoice = doc.type === 'facture';
    const isCredit = doc.type === 'avoir';
    const isQuote = doc.type === 'devis';
    const title = L[doc.type] || 'Document';
    const cl = client || {};
    const ink = company.primaryColor || '#1b2430';
    const accent = company.accentColor || '#0f9d8f';
    const numberText = doc.number || L.draft;
    const stampKey = opts.stamp || ({ 'Payée': 'paid', 'Annulée': 'cancelled', 'Brouillon': 'draft' })[opts.stampText] || (opts.stampText ? 'custom' : (!isQuote && doc.status === 'brouillon' ? 'draft' : null));
    const stampText = stampKey === 'custom' ? opts.stampText : (stampKey ? L[stampKey] : '');
    const multiVat = Object.keys(t.vatByRate).length > 1;
    const pct = n => String(n).replace('.', lang === 'en' ? '.' : ',');
    const foreign = cur !== (company.currency || 'DT') && Number(doc.exchangeRate) > 0;

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
        <td class="r num">${escapeHtml(String(l.qty).replace('.', lang === 'en' ? '.' : ','))}${l.unit ? `<span class="unit"> ${escapeHtml(l.unit)}</span>` : ''}</td>
        <td class="r num">${fmt(l.unitPrice)}</td>
        <td class="r num dim">${l.vatRate}%</td>
        <td class="r num strong">${fmt(l.ht)}</td>
      </tr>`).join('');

    const metaItems = isInvoice ? [
      [L.issuedF, fmtDate(doc.date)],
      [L.dueBy, fmtDate(doc.dueDate)],
      doc.deposit ? [L.deposit, `${pct(doc.deposit.percent)} ${L.depositOf} ${doc.deposit.quoteNumber}`] : (doc.settles ? [L.balance, `${L.balanceOf} ${doc.settles.quoteNumber}`] : (doc.fromQuoteNumber ? [L.afterQuote, doc.fromQuoteNumber] : null)),
      doc.reference ? [L.reference, doc.reference] : null
    ] : isCredit ? [
      [L.issued, fmtDate(doc.date)],
      doc.creditOfNumber ? [L.cancels, L.facture + ' ' + doc.creditOfNumber] : null,
      doc.reference ? [L.reference, doc.reference] : null
    ] : [
      [L.issued, fmtDate(doc.date)],
      [L.validUntil, fmtDate(doc.dueDate)],
      doc.reference ? [L.reference, doc.reference] : null
    ];
    if (foreign) metaItems.push([L.rate, `1 ${cur} = ${money(doc.exchangeRate, company.currency)}`]);
    const meta = metaItems.filter(Boolean).map(([k, v]) => `<div class="chip"><span class="ck">${escapeHtml(k)}</span><span class="cv">${escapeHtml(v)}</span></div>`).join('');

    const vatRows = multiVat ? Object.keys(t.vatByRate).sort((a, b) => a - b).map(rate =>
      `<tr><td>${L.vat} ${rate}% <span class="dim">${L.on} ${fmt(t.vatByRate[rate].base)}</span></td><td class="r num">${fmt(t.vatByRate[rate].vat)}</td></tr>`).join('')
      : `<tr><td>${L.vat}</td><td class="r num">${fmt(t.totalVAT)}</td></tr>`;

    const contact = [company.phone, company.email, company.website].filter(Boolean).map(escapeHtml).join('<br>');
    const clientContact = [cl.contact ? escapeHtml(cl.contact) : '', cl.matricule ? L.mfCin + ' ' + escapeHtml(cl.matricule) : '', cl.phone ? escapeHtml(cl.phone) : '', cl.email ? escapeHtml(cl.email) : ''].filter(Boolean).join('<br>');
    // Pied de page légal : le texte libre s'il est rempli, sinon composé du nom et du matricule
    const footerBase = company.footer || [company.name, company.matricule ? (lang === 'en' ? 'Tax ID ' : 'Matricule fiscal ') + company.matricule : ''].filter(Boolean).join(' — ');
    const legal = [footerBase, company.rc ? 'RC ' + company.rc : '', company.capital ? (lang === 'en' ? 'Share capital ' : 'Capital ') + company.capital : ''].filter(Boolean).join(' — ');
    const grandLabel = isInvoice ? L.netToPay : isCredit ? L.creditAmount : L.totalTTC;
    const grandValue = isQuote ? t.totalTTC : t.netToPay;
    const wordsIntro = isInvoice ? L.wordsInvoice : isCredit ? L.wordsCredit : L.wordsQuote;
    const paymentTerms = lang === 'en' ? company.paymentTermsEn : company.paymentTerms;
    const quoteTerms = lang === 'en' ? company.quoteTermsEn : company.quoteTerms;

    return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8">
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
  .sign .s { width: 64mm; height: 15mm; border: .3mm dashed ${tint(.5)}; border-radius: 3.5mm; padding: 3mm 4mm; position: relative; }
  .sign .s small { display: block; color: #9aa3ae; font-size: 8pt; margin-top: .6mm; }
  .sign .s img { position: absolute; right: 3mm; top: 1.5mm; max-height: 12mm; max-width: 34mm; }

  .stamp { position: absolute; top: 62mm; right: 24mm; transform: rotate(-12deg); border: .8mm solid ${accent}; color: ${accent}; border-radius: 2mm; padding: 1.5mm 5mm; font-size: 18pt; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; opacity: .45; z-index: 2; }
  .stamp.draft { border-color: #9aa3ae; color: #9aa3ae; }

  .footer { position: absolute; left: 18mm; right: 18mm; bottom: 7mm; font-size: 7.6pt; color: #9aa3ae; display: flex; justify-content: space-between; gap: 6mm; border-top: .2mm solid #eceff3; padding-top: 2.5mm; }
  .footer .f-left { white-space: pre-line; }

  /* documents longs : pas de ligne coupée entre deux pages, en-tête du tableau répété */
  table.lines thead { display: table-header-group; }
  table.lines tr, .after, .sign, .card, .parties { break-inside: avoid; page-break-inside: avoid; }

  /* mode compact (fitToPage) : marges resserrées quand le contenu dépasse d'un peu la page, même design */
  .page.compact .hero { padding: 8mm 18mm 6mm; }
  .page.compact .chips { margin-top: 4mm; }
  .page.compact .inner { padding-top: 4mm; }
  .page.compact .parties { gap: 10mm; }
  .page.compact .party .pname { margin-bottom: .4mm; }
  .page.compact table.lines { margin-top: 3mm; }
  .page.compact table.lines tbody td { padding: 1.4mm 3mm; }
  .page.compact .after { margin-top: 2mm; }
  .page.compact .card { padding: 3mm 5mm; }
  .page.compact .info + .info, .page.compact .notes { margin-top: 3mm; }
  .page.compact .words { margin-top: 1.8mm; }
  .page.compact .sign { margin-top: 3.5mm; }
  .page.compact .sign .s { height: 13mm; }
</style></head>
<body><div class="page">
  ${stampText ? `<div class="stamp${stampKey === 'draft' ? ' draft' : ''}">${escapeHtml(stampText)}</div>` : ''}
  <div class="hero">
    <div class="head">
      <div class="brand">
        ${company.logo ? `<img class="logo" src="${company.logo}" alt="">` : ''}
        <div class="name">${escapeHtml(company.name)}</div>
        ${company.tagline ? `<div class="tag">${escapeHtml(company.tagline)}</div>` : ''}
        <div class="addr">${nl2br(company.address)}<br>${L.mf} ${escapeHtml(company.matricule)}${contact ? '<br>' + contact : ''}</div>
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
        <span class="k">${isInvoice ? L.billedTo : isCredit ? L.client : L.preparedFor}</span>
        <div class="pname">${escapeHtml(cl.name || '')}</div>
        ${cl.address ? `<div class="addr">${nl2br(cl.address)}</div>` : ''}
        ${clientContact ? `<div class="more">${clientContact}</div>` : ''}
      </div>
      ${doc.subject ? `<div class="party"><span class="k">${L.subject}</span><div class="pname" style="font-weight:600;font-size:10.5pt">${escapeHtml(doc.subject)}</div></div>` : ''}
    </div>

    <table class="lines">
      <thead><tr>
        <th>${L.designation}</th>
        <th class="r" style="width:16mm">${L.qty}</th><th class="r" style="width:26mm">${L.unitPrice}</th>
        <th class="r" style="width:12mm">${L.vat}</th><th class="r" style="width:28mm">${L.lineTotal}</th>
      </tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>

    <div class="after">
      <div>
        ${isInvoice && (company.rib || company.bank || paymentTerms) ? `
        <div class="info"><span class="k">${L.payment}</span>
          ${company.bank ? `<div class="row"><span>${L.bank}</span><span>${escapeHtml(company.bank)}</span></div>` : ''}
          ${company.rib ? `<div class="row"><span>${L.rib}</span><span class="mono">${escapeHtml(company.rib)}</span></div>` : ''}
          ${doc.number ? `<div class="row"><span>${L.motif}</span><span>${escapeHtml(doc.number)}</span></div>` : ''}
          ${paymentTerms ? `<div class="terms">${nl2br(paymentTerms)}</div>` : ''}
        </div>` : ''}
        ${isCredit ? `
        <div class="info"><span class="k">${L.avoir}</span>
          ${L.creditText(escapeHtml(doc.creditOfNumber || ''))}${doc.creditReason ? ' — ' + escapeHtml(doc.creditReason) : ''}.
        </div>` : ''}
        ${isQuote ? `
        <div class="info"><span class="k">${L.conditions}</span>
          ${L.validText(fmtDate(doc.dueDate))} ${escapeHtml(quoteTerms || '')}
        </div>` : ''}
        ${doc.notes ? `<div class="notes">${nl2br(doc.notes)}</div>` : ''}
      </div>
      <div class="card">
        <table class="totals">
          <tr><td>${L.subtotal}</td><td class="r num">${fmt(t.totalHT)}</td></tr>
          ${t.discount ? `<tr><td>${L.discount} ${pct(t.discountRate)}%</td><td class="r num">− ${fmt(t.discount)}</td></tr><tr><td>${L.netHT}</td><td class="r num">${fmt(t.netHT)}</td></tr>` : ''}
          ${vatRows}
          ${t.stamp ? `<tr><td>${L.stamp}</td><td class="r num">${fmt(t.stamp)}</td></tr>` : ''}
          ${t.withholding ? `<tr class="sub"><td>${L.totalTTC}</td><td class="r num">${fmt(t.totalTTC)}</td></tr><tr><td>${L.withholding} ${pct(t.withholdingRate)}%</td><td class="r num">− ${fmt(t.withholding)}</td></tr>` : ''}
        </table>
        <div class="grand"><span class="gl">${grandLabel}</span><span class="gv num">${fmt(grandValue)}<small>${escapeHtml(cur)}</small></span></div>
        <div class="words">${wordsIntro} <strong>${escapeHtml(amountToWords(grandValue, cur, lang).toLowerCase())}</strong>.</div>
      </div>
    </div>

    <div class="sign">
      ${isQuote ? `<div class="s"><span class="k">${L.approve}</span><small>${L.approveSub}</small></div>` : ''}
      <div class="s"><span class="k">${isQuote ? L.provider : L.stampSign}</span><small>${escapeHtml(company.name)}</small>${company.stampImage ? `<img src="${company.stampImage}" alt="">` : ''}</div>
    </div>
  </div>

  <div class="footer">
    <div class="f-left">${nl2br(legal)}</div>
    <div>${title} ${escapeHtml(numberText)}</div>
  </div>
</div></body></html>`;
  }

  // À exécuter dans le document rendu (aperçu, fenêtre PDF) : si le contenu déborde de la page A4, passe en
  // mode compact (marges resserrées, même design) pour qu'un document de quatre ou cinq lignes tienne sur
  // une page. Renvoie true si le mode compact a été appliqué. Au-delà, le document fait légitimement deux pages.
  function fitToPage(d) {
    const page = d && d.querySelector && d.querySelector('.page');
    if (!page || page.classList.contains('compact')) return false;
    const probe = d.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;top:0;left:0;width:1px;height:296mm';
    page.appendChild(probe);
    let overflow = page.offsetHeight > probe.offsetHeight + 1;
    probe.remove();
    // Le pied de page est positionné en absolu : le contenu peut le chevaucher sans allonger la page.
    if (!overflow) {
      const foot = d.querySelector('.footer'), last = d.querySelector('.sign') || d.querySelector('.after');
      if (foot && last) overflow = last.getBoundingClientRect().bottom > foot.getBoundingClientRect().top;
    }
    if (overflow) page.classList.add('compact');
    return overflow;
  }

  // Nombre de pages A4 qu'occupera le document rendu (à exécuter dans le document, après fitToPage).
  function pageCount(d) {
    const page = d && d.querySelector && d.querySelector('.page');
    if (!page) return 1;
    const probe = d.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;top:0;left:0;width:1px;height:297mm';
    page.appendChild(probe);
    const n = Math.max(1, Math.ceil((page.offsetHeight - 2) / probe.offsetHeight));
    probe.remove();
    return n;
  }

  return {
    VAT_RATES, WITHHOLDING_RATES, PAYMENT_METHODS, PREFIX, TITLES, DEFAULT_DATA, DEFAULT_COMPANY, ACTIVITIES, STATUSES, DISPLAY_STATUSES, STATUS_LABELS,
    uid, round3, money, fmtDate, addDays, today, escapeHtml, nl2br, statusLabel,
    nextNumber, isLocked, isIssued, computeTotals, creditsFor, invoiceBalance, effectiveStatus,
    depositLines, settlementLines, salesJournal, vatSummary, paymentsJournal, toCsv, migrateData,
    PERIODS, MONTHS_FR, MONTHS_SHORT, monthLabel, addMonths, nextRecurrenceDate, dueRecurrences, catchUpRecurrence, fillTemplate, buildRecurringInvoice,
    reminderLevel, REMINDER_LABELS, daysBetween, overdueInvoices, todoList, companyGaps, documentHistory, DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES_EN, emailFor,
    CURRENCIES, decimalsFor, toBase, monthKeys, monthlySeries, topClients, quoteStats, avgPaymentDelay, clientSummary, I18N,
    amountToWords, intToWords, intToWordsEn, documentHtml, fitToPage, pageCount
  };
});
