/* SkanFact — interface (JS pur, sans framework) */
(function () {
  const C = window.SkanCore;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const h = C.escapeHtml;

  // ---------- pont Electron (avec repli navigateur pour les tests) ----------
  const bridge = window.skanfact || {
    _mem: null,
    loadData: async () => { try { return { data: JSON.parse(localStorage.getItem('skanfact')), corruptFile: null }; } catch { return { data: null, corruptFile: null }; } },
    saveData: async (d) => { localStorage.setItem('skanfact', JSON.stringify(d)); return true; },
    dataPath: async () => 'localStorage (mode navigateur)',
    exportData: async () => null,
    importData: async () => null,
    openBackups: async () => {}, createBackup: async () => null, listBackups: async () => [],
    pickLogo: async () => null,
    exportPdf: async (html) => { const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print(); return null; },
    exportPdfMany: async () => null, saveText: async () => null, exportPdfSilent: async () => null, composeMail: async () => ({ state: 'mailto' }),
    openPath: async () => {}, showInFolder: async () => {},
    changelog: async () => '', onMenuAction: () => {},
    updateVersion: async () => ({ version: 'dev', packaged: false, platform: 'browser', macSigned: false }),
    updateCheck: async () => ({ state: 'dev' }), updateDownload: async () => ({ state: 'dev' }), updateInstall: async () => ({ state: 'dev' }), updateSetToken: async () => ({ hasToken: false }),
    updateOpenReleases: async () => {},
    onUpdateEvent: () => {}
  };

  // ---------- état ----------
  let data = null;
  let saveTimer = null;
  const unlockedIds = new Set(); // factures émises déverrouillées « quand même » pour la session

  function save(immediate) {
    clearTimeout(saveTimer);
    const doSave = () => bridge.saveData(data).catch(e => toast('Erreur de sauvegarde : ' + e.message, true));
    if (immediate) return doSave();
    saveTimer = setTimeout(doSave, 300);
  }

  const migrate = d => C.migrateData(d);
  const clientById = id => data.clients.find(c => c.id === id) || null;
  const docById = id => data.documents.find(d => d.id === id) || null;
  const company = () => data.company;
  const clientName = id => (clientById(id) || {}).name || '—';
  const effStatus = doc => C.effectiveStatus(doc, data, data.company);
  const balance = doc => C.invoiceBalance(doc, data, data.company);
  const docLabel = doc => `${C.TITLES[doc.type]} ${doc.number || '(brouillon)'}`;
  const deepCopy = o => JSON.parse(JSON.stringify(o));
  const pct = n => String(n).replace('.', ',');
  const docCur = doc => doc.currency || company().currency;
  const short = n => Math.abs(n) >= 1000 ? (n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1).replace('.', ',') + ' k' : String(Math.round(n));
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() { const t = company().theme || 'light'; document.body.classList.toggle('dark', t === 'dark' || (t === 'auto' && mq.matches)); }
  mq.addEventListener('change', () => { if (data) applyTheme(); });

  // ---------- UI helpers ----------
  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'show' + (isError ? ' error' : '');
    clearTimeout(t._timer); t._timer = setTimeout(() => t.className = '', 2600);
  }

  function modal(html, onMount) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-bg"><div class="modal">${html}</div></div>`;
    const close = () => root.innerHTML = '';
    $('.modal-bg', root).addEventListener('click', e => { if (e.target.classList.contains('modal-bg')) close(); });
    $$('[data-close]', root).forEach(b => b.addEventListener('click', close));
    if (onMount) onMount(root, close);
    const first = $('input, select, textarea', root); if (first) first.focus();
    return close;
  }

  function confirmDialog(msg, okLabel, danger) {
    return new Promise(resolve => {
      modal(`<h2>Confirmation</h2><p>${h(msg)}</p>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn ${danger === false ? 'btn-primary' : 'btn-danger'}" id="ok">${h(okLabel || 'Confirmer')}</button></div>`,
        (root, close) => { $('#ok', root).onclick = () => { close(); resolve(true); }; $('[data-close]', root).onclick = () => { close(); resolve(false); }; });
    });
  }

  // Boîte à trois choix : résout avec 'a', 'b' ou null (annulé)
  function choiceDialog(title, msg, labelA, labelB) {
    return new Promise(resolve => {
      modal(`<h2>${h(title)}</h2><p>${h(msg)}</p>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn" id="b">${h(labelB)}</button><button class="btn btn-primary" id="a">${h(labelA)}</button></div>`,
        (root, close) => { $('#a', root).onclick = () => { close(); resolve('a'); }; $('#b', root).onclick = () => { close(); resolve('b'); }; $('[data-close]', root).onclick = () => { close(); resolve(null); }; });
    });
  }

  function field(label, name, value, type, extra) {
    type = type || 'text';
    const attrs = extra || '';
    if (type === 'textarea') return `<label class="field">${label}<textarea name="${name}" ${attrs}>${h(value)}</textarea></label>`;
    return `<label class="field">${label}<input type="${type}" name="${name}" value="${h(value)}" ${attrs}></label>`;
  }

  function formValues(form) {
    const o = {};
    $$('input, select, textarea', form).forEach(el => {
      if (!el.name) return;
      o[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
    });
    return o;
  }

  function badge(status) { return `<span class="badge ${h(status)}">${h(C.statusLabel(status))}</span>`; }
  function statusBadge(doc) { return badge(effStatus(doc)); }
  function methodLabel(m) { const x = C.PAYMENT_METHODS.find(p => p[0] === m); return x ? x[1] : (m || ''); }
  // Numéro que recevrait le document à l'émission, sans consommer le compteur
  function peekNumber(type, date) { return C.nextNumber({ documents: data.documents, counters: { ...data.counters } }, type, date); }
  function withholdingOptions(value) {
    const rates = C.WITHHOLDING_RATES.slice(); const v = Number(value) || 0;
    if (!rates.includes(v)) rates.push(v);
    return rates.sort((a, b) => a - b).map(r => `<option value="${r}" ${r === v ? 'selected' : ''}>${r === 0 ? 'Aucune' : pct(r) + ' %'}</option>`).join('');
  }

  // ---------- routeur ----------
  const routes = {};
  function navigate(hash) { location.hash = hash; }
  function render() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
    const name = parts[0];
    let active = name;
    if (name === 'doc') {
      const type = parts[1] === 'new' ? parts[2] : (docById(parts[1]) || {}).type;
      active = type === 'devis' ? 'devis' : 'factures';
    }
    $$('nav a').forEach(a => a.classList.toggle('active', a.dataset.route === active));
    (routes[name] || routes.dashboard)(parts.slice(1));
    $('#view').scrollTop = 0;
    updateNavCounts();
    closePalette();
  }
  window.addEventListener('hashchange', render);

  // ---------- Accueil ----------
  routes.dashboard = () => {
    const cur = company().currency;
    const month = C.today().slice(0, 7);
    const year = C.today().slice(0, 4);
    const issued = data.documents.filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.status !== 'annulée');
    const sign = d => d.type === 'avoir' ? -1 : 1;
    const sumHT = list => list.reduce((s, d) => s + sign(d) * C.computeTotals(d, company()).netHT, 0);
    const sumTTC = list => list.reduce((s, d) => s + sign(d) * C.computeTotals(d, company()).totalTTC, 0);
    const ofMonth = issued.filter(d => d.date && d.date.startsWith(month));
    const ofYear = issued.filter(d => d.date && d.date.startsWith(year));
    const open = data.documents.filter(d => d.type === 'facture' && ['envoyée', 'partielle', 'retard'].includes(effStatus(d)));
    const openAmount = open.reduce((s, d) => s + balance(d).remaining, 0);
    const late = open.filter(d => effStatus(d) === 'retard');
    const pendingQuotes = data.documents.filter(d => d.type === 'devis' && d.status === 'envoyé');
    const sumQ = list => list.reduce((s, d) => s + C.computeTotals(d, company()).totalTTC, 0);
    const recent = data.documents.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
    const series = C.monthlySeries(data, company(), C.today(), 12);
    const from12 = C.addMonths(C.today(), -12, 1);
    const qs = C.quoteStats(data, from12, C.today());
    const delay = C.avgPaymentDelay(data, company(), from12, C.today());
    const top = C.topClients(data, company(), `${year}-01-01`, `${year}-12-31`, 5);
    const topMax = top.length ? Math.max(...top.map(x => x.ht), 1) : 1;

    $('#view').innerHTML = `
      <div class="page-head"><h1>Accueil</h1>
        <div class="actions">
          <button class="btn" id="new-devis">+ Nouveau devis</button>
          <button class="btn btn-primary" id="new-facture">+ Nouvelle facture</button>
        </div></div>
      ${dashboardBanners()}
      <div class="stats">
        <div class="stat"><div class="lbl">CA du mois (HT)</div><div class="val">${C.money(sumHT(ofMonth), cur)}</div><div class="sub">${C.money(sumTTC(ofMonth), cur)} TTC, avoirs déduits</div></div>
        <div class="stat"><div class="lbl">CA de l'année (HT)</div><div class="val">${C.money(sumHT(ofYear), cur)}</div><div class="sub">${year} · ${C.money(sumTTC(ofYear), cur)} TTC</div></div>
        <div class="stat"><div class="lbl">Reste à encaisser</div><div class="val">${C.money(openAmount, cur)}</div><div class="sub">${open.length} facture(s), ${late.length} en retard</div></div>
        <div class="stat"><div class="lbl">Devis en attente</div><div class="val">${C.money(sumQ(pendingQuotes), cur)}</div><div class="sub">${pendingQuotes.length} devis envoyé(s)</div></div>
      </div>
      <div class="dash-grid">
        <div class="panel"><h2>Activité des 12 derniers mois</h2>
          ${barChart(series)}
          <div class="legend"><span><i style="background:var(--primary)"></i>Facturé HT (avoirs déduits)</span><span><i style="background:#2a6fd6;opacity:.55"></i>Encaissé</span></div>
          <div class="kpis">
            <div class="kpi"><div class="k-label">Devis → facture</div><div class="v">${qs.rate == null ? '—' : qs.rate + ' %'}</div><div class="sub">${qs.accepted} accepté(s), ${qs.refused} refusé(s), ${qs.pending} en attente</div></div>
            <div class="kpi"><div class="k-label">Délai moyen de paiement</div><div class="v">${delay == null ? '—' : delay + ' jours'}</div><div class="sub">factures soldées, 12 derniers mois</div></div>
          </div>
        </div>
        <div class="panel"><h2>Top clients ${year} (HT)</h2>
          ${top.length ? `<ul class="rank">${top.map(x => `<li><span class="name">${h(x.name)}</span><span class="bar"><i style="width:${Math.max(4, Math.round(x.ht / topMax * 100))}%"></i></span><span class="amt">${C.money(x.ht, cur)}</span></li>`).join('')}</ul>` : '<p class="small muted">Aucune facture émise cette année.</p>'}
        </div>
      </div>
      <div class="panel"><h2>Documents récents</h2>${docTable(recent)}</div>`;
    $('#new-devis').onclick = () => navigate('#/doc/new/devis');
    $('#new-facture').onclick = () => navigate('#/doc/new/facture');
    bindBanners();
    bindDocTable();
  };

  // Histogramme SVG : facturé HT et encaissé par mois (sans bibliothèque)
  function barChart(series) {
    const W = 600, H = 220, left = 44, bottom = 26, top = 10;
    const max = Math.max(1, ...series.map(x => Math.max(x.invoiced, x.collected)));
    const slot = (W - left) / series.length;
    const y = v => top + (H - bottom - top) * (1 - Math.max(0, v) / max);
    const grid = [0, 0.5, 1].map(f => `<line class="grid" x1="${left}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}"/><text class="lbl" x="${left - 6}" y="${y(max * f) + 4}" text-anchor="end">${short(max * f)}</text>`).join('');
    const bars = series.map((x, i) => {
      const x0 = left + i * slot;
      return `<rect class="bar-inv" x="${x0 + slot * 0.12}" width="${slot * 0.36}" y="${y(x.invoiced)}" height="${H - bottom - y(x.invoiced)}" rx="2"><title>${h(C.monthLabel(x.month + '-01'))} — facturé ${C.money(x.invoiced, company().currency)}</title></rect>
        <rect class="bar-col" x="${x0 + slot * 0.52}" width="${slot * 0.36}" y="${y(x.collected)}" height="${H - bottom - y(x.collected)}" rx="2"><title>${h(C.monthLabel(x.month + '-01'))} — encaissé ${C.money(x.collected, company().currency)}</title></rect>
        <text class="lbl" x="${x0 + slot / 2}" y="${H - 8}" text-anchor="middle">${h(x.label)}</text>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<line class="axis" x1="${left}" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"/>${bars}</svg>`;
  }

  // ---------- listes devis / factures ----------
  function docTable(list, opts) {
    opts = opts || {};
    if (!list.length) return `<div class="empty">Aucun document.</div>`;
    const cur = company().currency;
    return `<table class="list"><thead><tr><th>Numéro</th><th>Type</th><th>Client</th><th>Date</th><th>Statut</th><th class="r">${opts.invoices ? 'Net à payer' : 'Total TTC'}</th>${opts.invoices ? '<th class="r">Reste</th>' : ''}<th></th></tr></thead><tbody>
      ${list.map(d => {
        const t = C.computeTotals(d, company());
        const amount = d.type === 'devis' ? t.totalTTC : (d.type === 'avoir' ? -t.netToPay : t.netToPay);
        const rest = d.type === 'facture' && d.status !== 'brouillon' ? balance(d).remaining : null;
        return `<tr class="clickable" data-id="${d.id}">
        <td><strong>${d.number ? h(d.number) : '<span class="muted">Brouillon</span>'}</strong></td><td>${C.TITLES[d.type]}</td>
        <td>${h(clientName(d.clientId))}</td><td>${C.fmtDate(d.date)}</td>
        <td>${statusBadge(d)}</td><td class="r">${C.money(amount, docCur(d))}</td>
        ${opts.invoices ? `<td class="r">${rest != null && rest > 0.0005 ? C.money(rest, docCur(d)) : '<span class="muted">—</span>'}</td>` : ''}
        <td class="actions"><button class="btn btn-sm" data-pdf="${d.id}">PDF</button></td></tr>`; }).join('')}
    </tbody></table>`;
  }
  function bindDocTable() {
    $$('tr.clickable[data-id]').forEach(tr => tr.onclick = e => { if (e.target.closest('button')) return; navigate('#/doc/' + tr.dataset.id); });
    $$('button[data-pdf]').forEach(b => b.onclick = () => exportPdf(docById(b.dataset.pdf)));
  }
  // brouillons (sans numéro) en tête, puis numéros décroissants
  const byNumberDesc = (a, b) => ((a.number ? 1 : 0) - (b.number ? 1 : 0)) || (b.number || '').localeCompare(a.number || '', undefined, { numeric: true }) || (b.createdAt || 0) - (a.createdAt || 0);

  function listView(type) {
    const isQ = type === 'devis';
    let q = '', st = '', kind = '';
    const draw = () => {
      const list = data.documents.filter(d => isQ ? d.type === 'devis' : (d.type === 'facture' || d.type === 'avoir'))
        .filter(d => !kind || d.type === kind)
        .filter(d => !st || effStatus(d) === st)
        .filter(d => !q || [d.number, clientName(d.clientId), d.subject].join(' ').toLowerCase().includes(q))
        .sort(byNumberDesc);
      $('#list-wrap').innerHTML = docTable(list, { invoices: !isQ });
      bindDocTable();
    };
    const statuses = isQ ? C.DISPLAY_STATUSES.devis : [...C.DISPLAY_STATUSES.facture, 'émis'];
    $('#view').innerHTML = `
      <div class="page-head"><h1>${isQ ? 'Devis' : 'Factures'}</h1>
        <div class="actions">${isQ ? '' : '<button class="btn" id="new-avoir">+ Avoir</button>'}<button class="btn btn-primary" id="new">+ ${isQ ? 'Nouveau devis' : 'Nouvelle facture'}</button></div></div>
      <div class="filters">
        <input type="text" id="q" placeholder="Rechercher (numéro, client, objet)…">
        ${isQ ? '' : `<select id="kind"><option value="">Factures et avoirs</option><option value="facture">Factures</option><option value="avoir">Avoirs</option></select>`}
        <select id="st"><option value="">Tous les statuts</option>${statuses.map(s => `<option value="${s}">${h(C.statusLabel(s))}</option>`).join('')}</select>
      </div>
      <div id="list-wrap"></div>`;
    $('#new').onclick = () => navigate('#/doc/new/' + type);
    if ($('#new-avoir')) $('#new-avoir').onclick = () => navigate('#/doc/new/avoir');
    $('#q').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
    $('#st').onchange = e => { st = e.target.value; draw(); };
    if ($('#kind')) $('#kind').onchange = e => { kind = e.target.value; draw(); };
    draw();
  }
  routes.devis = () => listView('devis');
  routes.factures = () => listView('facture');

  // ---------- éditeur de document ----------
  function newDocument(type) {
    const date = C.today();
    const days = type === 'devis' ? company().quoteValidityDays : company().paymentTermsDays;
    return {
      id: C.uid(), type, number: '', date, dueDate: C.addDays(date, days), clientId: '', subject: '', reference: '',
      lines: [{ label: '', description: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19 }],
      discountRate: 0, applyStamp: type === 'facture', status: 'brouillon', notes: '', payments: [],
      withholdingRate: type === 'devis' ? 0 : (Number(company().defaultWithholdingRate) || 0), createdAt: Date.now(),
      lang: company().defaultLang || 'fr', currency: company().currency, exchangeRate: ''
    };
  }
  function applyClientDefaults(doc, clientId) {
    const c = clientById(clientId); if (!c) return;
    if (c.lang) doc.lang = c.lang;
    if (c.currency) doc.currency = c.currency;
  }

  function clientWithholding(clientId) {
    const c = clientById(clientId);
    if (c && c.withholdingRate != null && c.withholdingRate !== '') return Number(c.withholdingRate) || 0;
    return Number(company().defaultWithholdingRate) || 0;
  }

  routes.doc = (parts) => {
    let doc, isNew = false;
    if (parts[0] === 'new') {
      const type = ['devis', 'facture', 'avoir'].includes(parts[1]) ? parts[1] : 'devis';
      doc = newDocument(type); isNew = true;
      if (type === 'avoir' && parts[2] && parts[2] !== 'tpl') { const inv = docById(parts[2]); if (inv) Object.assign(doc, creditDraftFrom(inv)); }
      if (parts[2] === 'tpl' && parts[3]) applyTemplate(doc, parts[3]);
    } else {
      doc = docById(parts[0]); if (!doc) return navigate('#/dashboard'); doc = deepCopy(doc);
    }
    const isQ = doc.type === 'devis', isInv = doc.type === 'facture', isAv = doc.type === 'avoir';
    let cur = docCur(doc);
    const locked = C.isLocked(doc) && !unlockedIds.has(doc.id);
    const ro = locked ? 'disabled' : '';
    const stored = isNew ? null : docById(doc.id);
    const bal = isInv && !isNew && doc.status !== 'brouillon' ? balance(stored) : null;
    const canUnlock = locked && isInv && bal && !bal.paid && !bal.credits.length;
    const issuedDeposits = isQ && !isNew ? data.documents.filter(d => d.type === 'facture' && d.deposit && d.deposit.quoteId === doc.id && d.status !== 'brouillon') : [];

    const clientOptions = () => `<option value="">— Choisir un client —</option>` +
      data.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}" ${c.id === doc.clientId ? 'selected' : ''}>${h(c.name)}</option>`).join('');
    const invoiceOptions = () => `<option value="">— Facture concernée —</option>` +
      data.documents.filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.number).sort(byNumberDesc)
        .map(d => `<option value="${d.id}" ${d.id === doc.creditOf ? 'selected' : ''}>${h(d.number)} — ${h(clientName(d.clientId))} — ${C.money(C.computeTotals(d, company()).netToPay, cur)}</option>`).join('');

    const title = isNew ? (isQ ? 'Nouveau devis' : isInv ? 'Nouvelle facture' : 'Nouvel avoir') : docLabel(doc);
    const statusCell = isQ
      ? `<label class="field">Statut<select name="status">${C.STATUSES.devis.map(s => `<option ${s === doc.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`
      : `<div class="field">Statut<div class="status-cell">${isNew || doc.status === 'brouillon' ? `${badge('brouillon')}<span class="small muted">numéro attribué à l'émission</span>` : (isInv ? statusBadge(stored) : badge(doc.status))}</div></div>`;

    $('#view').innerHTML = `
      <div class="page-head">
        <div><h1>${h(title)}</h1>${locked ? `<div class="small muted lock-note">Document émis : il n'est plus modifiable${isInv ? ' — pour corriger, crée un avoir' : ''}.</div>` : ''}</div>
        <div class="actions">
          ${!isNew && (locked || isQ) ? `<button class="btn" id="email">Envoyer par email</button>` : ''}
          ${!isNew && isQ ? `<button class="btn" id="deposit">Facture d'acompte…</button>` : ''}
          ${!isNew && isQ && issuedDeposits.length ? `<button class="btn" id="settle">Facture de solde</button>` : ''}
          ${!isNew && isQ ? `<button class="btn" id="convert">Convertir en facture</button>` : ''}
          ${locked && isInv && doc.status !== 'annulée' ? `<button class="btn" id="pay">Enregistrer un paiement</button><button class="btn" id="credit">Créer un avoir</button>` : ''}
          <button class="btn" id="pdf">Exporter en PDF</button>
          ${!locked ? `<button class="btn ${isQ ? 'btn-primary' : ''}" id="save">Enregistrer${isQ ? '' : ' le brouillon'}</button>` : ''}
          ${!locked && !isQ ? `<button class="btn btn-primary" id="issue">${isInv ? 'Émettre la facture' : 'Émettre l\'avoir'}</button>` : ''}
          ${!isNew ? `<div class="more"><button class="btn" id="more-btn">Plus ▾</button><div class="more-list" id="more-list" hidden>
            ${!isAv ? `<button id="dup">Dupliquer</button><button id="as-template">Enregistrer comme modèle…</button>` : ''}
            ${isInv ? `<button id="make-recurring">Rendre récurrent (contrat)…</button>` : ''}
            ${canUnlock ? `<button id="unlock">Modifier malgré l'émission…</button>` : ''}
            ${!locked ? `<button id="del" class="danger">Supprimer</button>` : ''}
          </div></div>` : ''}
        </div></div>
      <div class="editor">
        <div>
          <div class="panel"><h2>Informations</h2>
            <form id="f-head" class="grid-3">
              <label class="field">Client
                <div class="inline"><select name="clientId" ${ro}>${clientOptions()}</select>${locked ? '' : '<button type="button" class="btn btn-sm" id="quick-client">+</button>'}</div>
              </label>
              ${isAv ? `<label class="field span-2">Facture concernée<select name="creditOf" ${ro}>${invoiceOptions()}</select></label>` : ''}
              ${field('Date', 'date', doc.date, 'date', ro)}
              ${isAv ? '' : field(isQ ? 'Valable jusqu\'au' : 'Échéance', 'dueDate', doc.dueDate, 'date', ro)}
              <label class="field span-2">Objet<input type="text" name="subject" value="${h(doc.subject)}" placeholder="Ex : Audit de sécurité du réseau" ${ro}></label>
              ${field('Référence (optionnel)', 'reference', doc.reference || '', 'text', ro)}
              ${isAv ? field('Motif de l\'avoir', 'creditReason', doc.creditReason || '', 'text', ro + ' placeholder="Erreur de facturation, remise commerciale…"') : ''}
              <label class="field">Langue du document<select name="lang" ${ro}><option value="fr" ${doc.lang !== 'en' ? 'selected' : ''}>Français</option><option value="en" ${doc.lang === 'en' ? 'selected' : ''}>English</option></select></label>
              <label class="field">Devise<select name="currency" ${ro}>${C.CURRENCIES.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
              <label class="field" id="rate-field" ${cur === company().currency ? 'hidden' : ''}>Taux : 1 ${h(cur)} = ? ${h(company().currency)}<input type="number" name="exchangeRate" value="${h(doc.exchangeRate || '')}" step="0.0001" min="0" class="num" placeholder="ex. 3.4" ${ro}></label>
              ${statusCell}
              ${field('Remise globale (%)', 'discountRate', doc.discountRate || 0, 'number', 'min="0" max="100" step="0.5" class="num" ' + ro)}
              ${!isQ ? `<label class="field">Retenue à la source<select name="withholdingRate" ${ro}>${withholdingOptions(doc.withholdingRate)}</select></label>` : ''}
              ${!isQ ? `<label class="check" style="align-self:end"><input type="checkbox" name="applyStamp" ${doc.applyStamp === true || (isInv && doc.applyStamp !== false) ? 'checked' : ''} ${ro}> Timbre fiscal (${C.money(company().stampFee, cur)})</label>` : ''}
            </form>
          </div>
          <div class="panel"><h2>Lignes</h2>
            ${locked ? '' : `<div class="catalog-pick">
              ${templatesFor(doc.type).length ? `<select id="tpl-pick"><option value="">Depuis un modèle…</option>${templatesFor(doc.type).map(t => `<option value="${t.id}">${h(t.name)}</option>`).join('')}</select>` : ''}
              <select id="cat-pick"><option value="">Ajouter depuis le catalogue…</option>${data.catalog.map(c => `<option value="${c.id}">${h(c.label)} — ${C.money(c.unitPrice, cur)}</option>`).join('')}</select>
              <button class="btn btn-sm" id="add-line">+ Ligne vide</button>
            </div>`}
            <table class="lines-edit"><thead><tr><th style="width:38%">Désignation / description</th><th style="width:9%">Qté</th><th style="width:9%">Unité</th><th style="width:15%">P.U. HT</th><th style="width:13%">TVA</th><th class="r">Total HT</th><th></th></tr></thead>
              <tbody id="lines"></tbody></table>
            <div class="totals-box" id="totals"></div>
          </div>
          ${bal ? `<div class="panel" id="pay-panel"><h2>Paiements et situation</h2><div id="pay-body"></div></div>` : ''}
          <div class="panel"><h2>Notes (affichées sur le document)</h2>
            ${!locked && data.snippets.length ? `<div class="catalog-pick"><select id="snip-pick"><option value="">Insérer un texte prédéfini…</option>${data.snippets.map(x => `<option value="${x.id}">${h(x.name)}</option>`).join('')}</select></div>` : ''}
            <textarea id="notes" placeholder="Conditions particulières, mentions…" ${ro}>${h(doc.notes || '')}</textarea>
          </div>
        </div>
        <div class="preview"><iframe id="preview" title="Aperçu"></iframe></div>
      </div>`;

    // --- lignes
    const linesBody = $('#lines');
    function drawLines() {
      linesBody.innerHTML = doc.lines.map((l, i) => `<tr data-i="${i}">
        <td><input type="text" data-k="label" value="${h(l.label)}" placeholder="Désignation" ${ro}>
            <textarea data-k="description" placeholder="Description (optionnel)" ${ro}>${h(l.description || '')}</textarea></td>
        <td><input type="number" class="num" data-k="qty" value="${l.qty}" step="0.01" ${ro}></td>
        <td><input type="text" data-k="unit" value="${h(l.unit || '')}" placeholder="u, h, j" ${ro}></td>
        <td><input type="number" class="num" data-k="unitPrice" value="${l.unitPrice}" step="0.001" ${ro}></td>
        <td><select data-k="vatRate" ${ro}>${C.VAT_RATES.map(r => `<option value="${r}" ${Number(l.vatRate) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select></td>
        <td class="total" data-total="${i}"></td>
        <td>${locked ? '' : `<button class="btn btn-ghost btn-sm" data-rm="${i}" title="Supprimer">✕</button>`}</td></tr>`).join('');
      $$('[data-k]', linesBody).forEach(el => el.oninput = () => {
        const i = Number(el.closest('tr').dataset.i);
        doc.lines[i][el.dataset.k] = el.type === 'number' ? Number(el.value) : el.value;
        refreshTotals();
      });
      $$('[data-rm]', linesBody).forEach(b => b.onclick = () => { doc.lines.splice(Number(b.dataset.rm), 1); if (!doc.lines.length) doc.lines.push({ label: '', qty: 1, unitPrice: 0, vatRate: 19 }); drawLines(); refreshTotals(); });
      refreshTotals();
    }
    if ($('#add-line')) $('#add-line').onclick = () => { doc.lines.push({ label: '', description: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19 }); drawLines(); $$('input[data-k=label]', linesBody).pop().focus(); };
    if ($('#cat-pick')) $('#cat-pick').onchange = e => {
      const it = data.catalog.find(c => c.id === e.target.value); if (!it) return;
      if (doc.lines.length === 1 && !doc.lines[0].label && !doc.lines[0].unitPrice) doc.lines = [];
      doc.lines.push({ label: it.label, description: it.description || '', qty: 1, unit: it.unit || '', unitPrice: it.unitPrice, vatRate: it.vatRate });
      e.target.value = ''; drawLines();
    };
    if ($('#tpl-pick')) $('#tpl-pick').onchange = async e => {
      const id = e.target.value; e.target.value = ''; if (!id) return;
      const hasContent = doc.lines.some(l => l.label) ;
      if (hasContent && !await confirmDialog('Remplacer les lignes actuelles par celles du modèle ?', 'Remplacer', false)) return;
      applyTemplate(doc, id);
      $('input[name=subject]', head).value = doc.subject; $('input[name=discountRate]', head).value = doc.discountRate || 0; $('#notes').value = doc.notes || '';
      drawLines();
    };
    if ($('#snip-pick')) $('#snip-pick').onchange = e => {
      const sn = data.snippets.find(x => x.id === e.target.value); e.target.value = ''; if (!sn) return;
      doc.notes = (doc.notes ? doc.notes.replace(/\s+$/, '') + '\n' : '') + sn.text; $('#notes').value = doc.notes; schedulePreview();
    };

    // --- en-tête
    const head = $('#f-head');
    head.oninput = head.onchange = (e) => {
      const before = doc.clientId;
      Object.assign(doc, formValues(head));
      if (e && e.target && e.target.name === 'currency') {
        cur = docCur(doc);
        const rf = $('#rate-field', head); rf.hidden = cur === company().currency; rf.firstChild.textContent = `Taux : 1 ${cur} = ? ${company().currency}`;
        drawLines();
      }
      if (e && e.target && e.target.name === 'clientId' && doc.clientId !== before && doc.status === 'brouillon') {
        // nouveau client : on reprend son taux de retenue à la source, sa langue et sa devise
        if (!isQ) { doc.withholdingRate = clientWithholding(doc.clientId); const sel = $('select[name=withholdingRate]', head); if (sel) sel.innerHTML = withholdingOptions(doc.withholdingRate); }
        applyClientDefaults(doc, doc.clientId);
        $('select[name=lang]', head).value = doc.lang || 'fr'; $('select[name=currency]', head).value = docCur(doc);
        cur = docCur(doc); const rf = $('#rate-field', head); rf.hidden = cur === company().currency; rf.firstChild.textContent = `Taux : 1 ${cur} = ? ${company().currency}`;
        drawLines();
      }
      if (e && e.target && e.target.name === 'creditOf') {
        const inv = docById(doc.creditOf); if (inv) { doc.creditOfNumber = inv.number; if (!doc.clientId) { doc.clientId = inv.clientId; $('select[name=clientId]', head).value = inv.clientId; } }
      }
      refreshTotals();
    };
    $('#notes').oninput = e => { doc.notes = e.target.value; schedulePreview(); };
    if ($('#quick-client')) $('#quick-client').onclick = () => clientForm(null, c => { $('select[name=clientId]', head).innerHTML = clientOptions(); $('select[name=clientId]', head).value = c.id; doc.clientId = c.id; doc.withholdingRate = isQ ? 0 : clientWithholding(c.id); const sel = $('select[name=withholdingRate]', head); if (sel) sel.innerHTML = withholdingOptions(doc.withholdingRate); applyClientDefaults(doc, c.id); $('select[name=lang]', head).value = doc.lang || 'fr'; $('select[name=currency]', head).value = docCur(doc); cur = docCur(doc); refreshTotals(); });

    // --- totaux + aperçu
    let previewTimer = null;
    function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(drawPreview, 250); }
    function drawPreview() {
      const pv = $('#preview'); if (!pv) return; // l'utilisateur a quitté l'éditeur avant la fin du délai
      const st = isInv && stored && stored.status !== 'brouillon' ? effStatus(stored) : null;
      const stampText = st === 'payée' ? 'Payée' : st === 'annulée' ? 'Annulée' : undefined;
      const html = C.documentHtml(doc, clientById(doc.clientId), company(), { preview: true, stampText, zoom: Math.max(0.3, Math.floor((pv.clientWidth - 2) / 794 * 100) / 100) });
      pv.srcdoc = html;
    }
    function refreshTotals() {
      const t = C.computeTotals(doc, company());
      t.lines.forEach((l, i) => { const c = $(`[data-total="${i}"]`); if (c) c.textContent = C.money(l.ht, null, C.decimalsFor(cur)); });
      $('#totals').innerHTML = `<table>
        <tr><td>Total HT</td><td>${C.money(t.totalHT, cur)}</td></tr>
        ${t.discount ? `<tr><td>Remise ${pct(t.discountRate)}%</td><td>- ${C.money(t.discount, cur)}</td></tr><tr><td>Net HT</td><td>${C.money(t.netHT, cur)}</td></tr>` : ''}
        <tr><td>TVA</td><td>${C.money(t.totalVAT, cur)}</td></tr>
        ${t.stamp ? `<tr><td>Timbre fiscal</td><td>${C.money(t.stamp, cur)}</td></tr>` : ''}
        ${t.withholding ? `<tr><td>Total TTC</td><td>${C.money(t.totalTTC, cur)}</td></tr><tr><td>Retenue à la source ${pct(t.withholdingRate)}%</td><td>- ${C.money(t.withholding, cur)}</td></tr>` : ''}
        <tr class="grand"><td>${isQ ? 'Total TTC' : isAv ? 'Montant de l\'avoir' : 'Net à payer'}</td><td>${C.money(isQ ? t.totalTTC : t.netToPay, cur)}</td></tr></table>`;
      schedulePreview();
    }

    // --- paiements (facture émise)
    function drawPayments() {
      const el = $('#pay-body'); if (!el) return;
      const cur = docCur(doc);
      const s = docById(doc.id); const b = balance(s); const t = b.totals;
      const rows = (s.payments || []).slice().sort((a, x) => (a.date || '').localeCompare(x.date || ''));
      el.innerHTML = `
        <div class="pay-grid">
          <div><div class="k-label">Net à payer</div><div class="v">${C.money(t.netToPay, cur)}</div>${t.withholding ? `<div class="small muted">TTC ${C.money(t.totalTTC, cur)} − RS ${C.money(t.withholding, cur)}</div>` : ''}</div>
          <div><div class="k-label">Avoirs</div><div class="v">${C.money(b.credited, cur)}</div>${b.credits.length ? `<div class="small">${b.credits.map(a => `<a href="#/doc/${a.id}">${h(a.number)}</a>`).join(', ')}</div>` : ''}</div>
          <div><div class="k-label">Payé</div><div class="v">${C.money(b.paid, cur)}</div></div>
          <div><div class="k-label">Reste à payer</div><div class="v ${b.remaining > 0.0005 ? 'due' : 'ok'}">${C.money(Math.max(0, b.remaining), cur)}</div>${b.remaining < -0.0005 ? `<div class="small muted">trop-perçu ${C.money(-b.remaining, cur)}</div>` : ''}</div>
        </div>
        ${rows.length ? `<table class="list compact"><thead><tr><th>Date</th><th>Mode</th><th>Référence</th><th class="r">Montant</th><th></th></tr></thead><tbody>
          ${rows.map(p => `<tr><td>${C.fmtDate(p.date)}</td><td>${h(methodLabel(p.method))}</td><td>${h(p.reference || '')}${p.note ? `<div class="small muted">${h(p.note)}</div>` : ''}</td><td class="r">${C.money(p.amount, cur)}</td><td class="actions"><button class="btn btn-ghost btn-sm" data-rmpay="${p.id}" title="Supprimer">✕</button></td></tr>`).join('')}
        </tbody></table>` : `<p class="small muted">Aucun paiement enregistré.</p>`}
        <div class="inline mt">
          ${s.status !== 'annulée' && b.remaining > 0.0005 ? `<button class="btn btn-primary" id="pay2">+ Enregistrer un paiement</button>` : ''}
          ${t.withholding ? `<label class="check"><input type="checkbox" id="rs-cert" ${s.withholdingCertificate ? 'checked' : ''}> Attestation de retenue à la source reçue (${C.money(t.withholding, cur)})</label>` : ''}
          ${s.status === 'annulée' ? `<span class="muted small">Facture annulée.</span><button class="btn btn-ghost btn-sm" id="uncancel">Rétablir</button>` : (!b.paid && !b.credits.length ? `<button class="btn btn-ghost btn-sm" id="cancel-inv">Marquer annulée…</button>` : '')}
        </div>`;
      $$('[data-rmpay]', el).forEach(btn => btn.onclick = async () => {
        if (!await confirmDialog('Supprimer ce paiement ?')) return;
        s.payments = s.payments.filter(p => p.id !== btn.dataset.rmpay); save(true); render();
      });
      if ($('#pay2')) $('#pay2').onclick = () => paymentForm(s, () => render());
      if ($('#rs-cert')) $('#rs-cert').onchange = e => { s.withholdingCertificate = e.target.checked; save(true); };
      if ($('#cancel-inv')) $('#cancel-inv').onclick = async () => {
        if (!await confirmDialog(`Marquer ${s.number} comme annulée ? La facture reste dans la numérotation. La façon conforme de corriger une facture émise est d'établir un avoir.`, 'Marquer annulée')) return;
        s.status = 'annulée'; save(true); render();
      };
      if ($('#uncancel')) $('#uncancel').onclick = () => { s.status = 'envoyée'; save(true); render(); };
    }

    // --- actions
    function validate() {
      if (!doc.clientId) { toast('Choisis un client.', true); return false; }
      if (isAv && !doc.creditOf) { toast('Indique la facture concernée par l\'avoir.', true); return false; }
      if (!doc.lines.some(l => l.label && l.label.trim())) { toast('Ajoute au moins une ligne avec une désignation.', true); return false; }
      return true;
    }
    function persist() {
      if (!validate()) return false;
      if (isQ && !doc.number) doc.number = C.nextNumber(data, 'devis', doc.date);
      if (isAv && doc.creditOf) { const inv = docById(doc.creditOf); if (inv) doc.creditOfNumber = inv.number; }
      const idx = data.documents.findIndex(d => d.id === doc.id);
      const clean = deepCopy(doc);
      if (idx >= 0) data.documents[idx] = clean; else data.documents.push(clean);
      save(true);
      return true;
    }
    function issue() {
      if (!validate()) return false;
      if (!doc.number) doc.number = C.nextNumber(data, doc.type, doc.date);
      doc.status = isInv ? 'envoyée' : 'émis';
      unlockedIds.delete(doc.id);
      persist();
      toast(`${C.TITLES[doc.type]} ${doc.number} émis${isInv ? 'e' : ''}`);
      return true;
    }
    if ($('#save')) $('#save').onclick = () => { if (persist()) { toast(isQ ? 'Enregistré : ' + doc.number : 'Brouillon enregistré'); unlockedIds.delete(doc.id); if (isNew) navigate('#/doc/' + doc.id); else render(); } };
    if ($('#issue')) $('#issue').onclick = async () => {
      if (!validate()) return;
      const n = doc.number || peekNumber(doc.type, doc.date);
      if (!await confirmDialog(`Émettre ${isInv ? 'la facture' : 'l\'avoir'} ${n} ? Le numéro devient définitif et le document ne sera plus modifiable.`, 'Émettre', false)) return;
      if (issue()) { if (isNew) navigate('#/doc/' + doc.id); else render(); }
    };
    $('#pdf').onclick = async () => {
      if (locked) return exportPdf(docById(doc.id) || doc);
      if (!validate()) return;
      if (!isQ && doc.status === 'brouillon') {
        const n = doc.number || peekNumber(doc.type, doc.date);
        const c = await choiceDialog('Exporter en PDF', `Ce document est un brouillon. Tu peux l'émettre maintenant (numéro ${n}, définitif) ou exporter un brouillon marqué « Brouillon », sans numéro.`, `Émettre ${n} et exporter`, 'Exporter le brouillon');
        if (!c) return;
        if (c === 'a') { if (!issue()) return; }
        else persist();
        exportPdf(docById(doc.id));
        if (isNew) navigate('#/doc/' + doc.id); else render();
        return;
      }
      if (persist()) { exportPdf(docById(doc.id)); if (isNew) navigate('#/doc/' + doc.id); }
    };
    if ($('#del')) $('#del').onclick = async () => {
      if (!await confirmDialog(`Supprimer ${docLabel(doc)} ?${doc.number ? ' Le numéro ne sera pas réutilisé.' : ''}`)) return;
      data.documents = data.documents.filter(d => d.id !== doc.id); save(true); navigate(isQ ? '#/devis' : '#/factures');
    };
    if ($('#unlock')) $('#unlock').onclick = async () => {
      if (!await confirmDialog(`Modifier ${doc.number} après émission ? Ce n'est pas conforme : une facture émise se corrige par un avoir. À réserver à une erreur repérée avant l'envoi au client.`, 'Modifier quand même')) return;
      unlockedIds.add(doc.id); render();
    };
    if ($('#dup')) $('#dup').onclick = () => {
      const copy = { ...deepCopy(doc), id: C.uid(), number: '', status: 'brouillon', date: C.today(), createdAt: Date.now(), payments: [], withholdingCertificate: false, fromQuoteId: undefined, fromQuoteNumber: undefined, deposit: undefined, settles: undefined };
      copy.dueDate = C.addDays(copy.date, isQ ? company().quoteValidityDays : company().paymentTermsDays);
      if (isQ) copy.number = C.nextNumber(data, 'devis', copy.date);
      data.documents.push(copy); save(true); toast(isQ ? 'Copie créée : ' + copy.number : 'Brouillon créé à partir de ' + doc.number); navigate('#/doc/' + copy.id);
    };
    if ($('#convert')) $('#convert').onclick = () => {
      const inv = invoiceFromQuote(doc, deepCopy(doc.lines), doc.discountRate);
      inv.fromQuoteId = doc.id; inv.fromQuoteNumber = doc.number;
      acceptQuote(doc.id); data.documents.push(inv); save(true); toast('Brouillon de facture créé — clique sur « Émettre » quand elle est prête'); navigate('#/doc/' + inv.id);
    };
    if ($('#deposit')) $('#deposit').onclick = () => {
      modal(`<h2>Facture d'acompte</h2><p class="small muted">Une facture d'un pourcentage du devis ${h(doc.number)} (${C.money(C.computeTotals(doc, company()).totalTTC, cur)} TTC). La facture de solde déduira automatiquement cet acompte.</p>
        <form id="df" class="grid-2">${field('Pourcentage du devis', 'percent', 30, 'number', 'min="1" max="99" step="0.5" class="num"')}</form>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Créer le brouillon</button></div>`,
        (root, close) => { $('#ok', root).onclick = () => {
          const p = Number($('input[name=percent]', root).value); if (!(p > 0 && p < 100)) return toast('Pourcentage entre 1 et 99.', true);
          const inv = invoiceFromQuote(doc, C.depositLines(doc, p, company()), 0);
          inv.deposit = { percent: p, quoteId: doc.id, quoteNumber: doc.number }; inv.fromQuoteId = doc.id; inv.fromQuoteNumber = doc.number;
          inv.subject = `Acompte ${pct(p)} % — ${doc.subject || doc.number}`;
          acceptQuote(doc.id); data.documents.push(inv); save(true); close(); toast('Brouillon de facture d\'acompte créé'); navigate('#/doc/' + inv.id);
        }; });
    };
    if ($('#settle')) $('#settle').onclick = () => {
      const inv = invoiceFromQuote(doc, C.settlementLines(doc, issuedDeposits), doc.discountRate);
      inv.settles = { quoteId: doc.id, quoteNumber: doc.number, depositIds: issuedDeposits.map(d => d.id) }; inv.fromQuoteId = doc.id; inv.fromQuoteNumber = doc.number;
      inv.subject = `Solde — ${doc.subject || doc.number}`;
      data.documents.push(inv); save(true); toast(`Brouillon de facture de solde créé (${issuedDeposits.length} acompte(s) déduit(s))`); navigate('#/doc/' + inv.id);
    };
    if ($('#pay')) $('#pay').onclick = () => paymentForm(docById(doc.id), () => render());
    if ($('#credit')) $('#credit').onclick = () => navigate('#/doc/new/avoir/' + doc.id);
    if ($('#email')) $('#email').onclick = () => sendByEmail(docById(doc.id) || doc);
    if ($('#as-template')) $('#as-template').onclick = () => saveAsTemplate(doc);
    if ($('#make-recurring')) $('#make-recurring').onclick = () => recurrenceForm(recurrenceFromInvoice(doc), () => { toast('Contrat créé'); navigate('#/contrats'); });
    if ($('#more-btn')) $('#more-btn').onclick = e => { e.stopPropagation(); const l = $('#more-list'); l.hidden = !l.hidden; };
    $$('#more-list button').forEach(b => b.addEventListener('click', () => { $('#more-list').hidden = true; }));

    drawLines();
    drawPayments();
  };

  function invoiceFromQuote(quote, lines, discountRate) {
    const inv = newDocument('facture');
    Object.assign(inv, { clientId: quote.clientId, subject: quote.subject, reference: quote.reference || '', lines, discountRate: discountRate || 0, notes: quote.notes || '', withholdingRate: clientWithholding(quote.clientId), lang: quote.lang || 'fr', currency: quote.currency || company().currency, exchangeRate: quote.exchangeRate || '' });
    return inv;
  }
  function acceptQuote(id) { const orig = docById(id); if (orig && orig.status !== 'accepté') orig.status = 'accepté'; }
  function creditDraftFrom(inv) {
    return {
      creditOf: inv.id, creditOfNumber: inv.number, clientId: inv.clientId, subject: `Avoir sur facture ${inv.number}${inv.subject ? ' — ' + inv.subject : ''}`,
      lines: deepCopy(inv.lines || []), discountRate: inv.discountRate || 0, withholdingRate: inv.withholdingRate || 0, applyStamp: false, creditReason: '',
      lang: inv.lang || 'fr', currency: inv.currency || company().currency, exchangeRate: inv.exchangeRate || ''
    };
  }

  function paymentForm(inv, done) {
    const b = balance(inv); const cur = docCur(inv);
    modal(`<h2>Enregistrer un paiement</h2><p class="small muted">${h(inv.number)} — reste à payer ${C.money(Math.max(0, b.remaining), cur)}</p>
      <form id="pf2" class="grid-2">
        ${field('Date', 'date', C.today(), 'date')}
        ${field('Montant', 'amount', Math.max(0, b.remaining), 'number', 'step="0.001" min="0" class="num"')}
        <label class="field">Mode<select name="method">${C.PAYMENT_METHODS.map(m => `<option value="${m[0]}">${m[1]}</option>`).join('')}</select></label>
        ${field('Référence (n° chèque, virement…)', 'reference', '')}
        <label class="field span-2">Note<input type="text" name="note" value=""></label>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => { $('#ok', root).onclick = () => {
        const v = formValues($('#pf2', root));
        if (!(Number(v.amount) > 0)) return toast('Montant invalide.', true);
        if (!v.date) return toast('Date obligatoire.', true);
        inv.payments = inv.payments || [];
        inv.payments.push({ id: C.uid(), date: v.date, amount: C.round3(v.amount), method: v.method, reference: v.reference || '', note: v.note || '' });
        save(true); close();
        const st = effStatus(inv); toast(st === 'payée' ? `${inv.number} payée intégralement` : 'Paiement enregistré');
        if (done) done();
      }; });
  }

  async function exportPdf(doc) {
    const st = doc.type === 'facture' && doc.status !== 'brouillon' ? effStatus(doc) : null;
    const stampText = st === 'payée' ? 'Payée' : st === 'annulée' ? 'Annulée' : undefined;
    const html = C.documentHtml(doc, clientById(doc.clientId), company(), { stampText });
    const client = (clientById(doc.clientId) || {}).name || '';
    const safe = s => String(s).replace(/[^\w\-àâäéèêëïîôöùûüç ]/gi, '').trim().replace(/\s+/g, '_');
    const name = `${doc.number || 'Brouillon-' + doc.type}${client ? '_' + safe(client) : ''}.pdf`;
    try {
      const p = await bridge.exportPdf(html, name);
      if (p) {
        toast('PDF enregistré : ' + p.split(/[\\/]/).pop());
        if (company().openAfterExport !== false) bridge.openPath(p);
      }
    } catch (e) { toast('Erreur PDF : ' + e.message, true); }
  }

  // ---------- Clients ----------
  function clientForm(client, done) {
    const c = client || { id: C.uid(), name: '', matricule: '', address: '', phone: '', email: '', notes: '', withholdingRate: '' };
    modal(`<h2>${client ? 'Modifier le client' : 'Nouveau client'}</h2>
      <form id="cf" class="grid-2">
        <label class="field span-2">Nom / Raison sociale<input type="text" name="name" value="${h(c.name)}" required></label>
        ${field('Matricule fiscal / CIN', 'matricule', c.matricule)}
        <label class="field">Retenue à la source appliquée par ce client<select name="withholdingRate"><option value="" ${c.withholdingRate === '' || c.withholdingRate == null ? 'selected' : ''}>Par défaut (${pct(company().defaultWithholdingRate || 0)} %)</option>${C.WITHHOLDING_RATES.map(r => `<option value="${r}" ${String(c.withholdingRate) === String(r) ? 'selected' : ''}>${r === 0 ? 'Aucune' : pct(r) + ' %'}</option>`).join('')}</select></label>
        ${field('Téléphone', 'phone', c.phone)}
        ${field('Email', 'email', c.email, 'email')}
        <label class="field">Langue des documents<select name="lang"><option value="" ${!c.lang ? 'selected' : ''}>Par défaut</option><option value="fr" ${c.lang === 'fr' ? 'selected' : ''}>Français</option><option value="en" ${c.lang === 'en' ? 'selected' : ''}>English</option></select></label>
        <label class="field">Devise<select name="currency"><option value="" ${!c.currency ? 'selected' : ''}>Par défaut (${h(company().currency)})</option>${C.CURRENCIES.map(x => `<option value="${x}" ${c.currency === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="field span-2">Adresse<textarea name="address">${h(c.address)}</textarea></label>
        <label class="field span-2">Notes internes<textarea name="notes">${h(c.notes || '')}</textarea></label>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = () => {
          const v = formValues($('#cf', root));
          if (!v.name.trim()) return toast('Le nom est obligatoire.', true);
          Object.assign(c, v, { withholdingRate: v.withholdingRate === '' ? '' : Number(v.withholdingRate) });
          if (!client) data.clients.push(c);
          save(true); close(); if (done) done(c);
        };
      });
  }

  routes.clients = () => {
    let q = '';
    const cur = company().currency;
    const draw = () => {
      const list = data.clients.filter(c => !q || [c.name, c.matricule, c.email, c.phone].join(' ').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
      $('#list-wrap').innerHTML = list.length ? `<table class="list"><thead><tr><th>Nom</th><th>MF / CIN</th><th>Contact</th><th class="r">Documents</th><th class="r">Reste à payer</th><th></th></tr></thead><tbody>
        ${list.map(c => {
          const docs = data.documents.filter(d => d.clientId === c.id);
          const due = docs.filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée').reduce((s, d) => s + Math.max(0, balance(d).remaining), 0);
          return `<tr><td><strong>${h(c.name)}</strong><div class="small muted">${h((c.address || '').split('\n')[0])}</div></td><td>${h(c.matricule)}${c.withholdingRate !== '' && c.withholdingRate != null && Number(c.withholdingRate) ? `<div class="small muted">RS ${pct(c.withholdingRate)} %</div>` : ''}</td>
          <td>${h(c.phone)}${c.phone && c.email ? ' · ' : ''}${h(c.email)}</td>
          <td class="r">${docs.length}</td><td class="r">${due > 0.0005 ? C.money(due, cur) : '<span class="muted">—</span>'}</td>
          <td class="actions"><button class="btn btn-sm" data-edit="${c.id}">Modifier</button> <button class="btn btn-sm btn-danger" data-del="${c.id}">Supprimer</button></td></tr>`; }).join('')}
        </tbody></table>` : `<div class="empty">Aucun client. Ajoute ton premier client.</div>`;
      $$('[data-edit]').forEach(b => b.onclick = () => clientForm(clientById(b.dataset.edit), draw));
      $$('[data-del]').forEach(b => b.onclick = async () => {
        const n = data.documents.filter(d => d.clientId === b.dataset.del).length;
        if (n) return toast(`Impossible : ${n} document(s) lié(s) à ce client.`, true);
        if (await confirmDialog('Supprimer ce client ?')) { data.clients = data.clients.filter(c => c.id !== b.dataset.del); save(true); draw(); }
      });
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Clients</h1><div class="actions"><button class="btn btn-primary" id="new">+ Nouveau client</button></div></div>
      <div class="filters"><input type="text" id="q" placeholder="Rechercher…"></div><div id="list-wrap"></div>`;
    $('#new').onclick = () => clientForm(null, draw);
    $('#q').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
    draw();
  };

  // ---------- Catalogue ----------
  function catalogForm(item, done) {
    const it = item || { id: C.uid(), label: '', description: '', unit: '', unitPrice: 0, vatRate: 19 };
    modal(`<h2>${item ? 'Modifier la prestation' : 'Nouvelle prestation'}</h2>
      <form id="kf" class="grid-2">
        <label class="field span-2">Désignation<input type="text" name="label" value="${h(it.label)}"></label>
        <label class="field span-2">Description<textarea name="description">${h(it.description || '')}</textarea></label>
        ${field('Prix unitaire HT', 'unitPrice', it.unitPrice, 'number', 'step="0.001" min="0" class="num"')}
        <label class="field">TVA<select name="vatRate">${C.VAT_RATES.map(r => `<option value="${r}" ${Number(it.vatRate) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select></label>
        ${field('Unité (u, h, jour, mois…)', 'unit', it.unit || '')}
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = () => {
          const v = formValues($('#kf', root));
          if (!v.label.trim()) return toast('La désignation est obligatoire.', true);
          Object.assign(it, v, { vatRate: Number(v.vatRate) });
          if (!item) data.catalog.push(it);
          save(true); close(); if (done) done(it);
        };
      });
  }

  routes.catalogue = () => {
    const cur = company().currency;
    const draw = () => {
      const list = data.catalog.slice().sort((a, b) => a.label.localeCompare(b.label));
      $('#list-wrap').innerHTML = list.length ? `<table class="list"><thead><tr><th>Désignation</th><th class="r">P.U. HT</th><th class="r">TVA</th><th>Unité</th><th></th></tr></thead><tbody>
        ${list.map(c => `<tr><td><strong>${h(c.label)}</strong><div class="small muted">${h(c.description || '')}</div></td><td class="r">${C.money(c.unitPrice, cur)}</td><td class="r">${c.vatRate}%</td><td>${h(c.unit || '')}</td>
          <td class="actions"><button class="btn btn-sm" data-edit="${c.id}">Modifier</button> <button class="btn btn-sm btn-danger" data-del="${c.id}">Supprimer</button></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty">Catalogue vide. Ajoute tes prestations récurrentes pour remplir les devis en un clic.</div>`;
      $$('[data-edit]').forEach(b => b.onclick = () => catalogForm(data.catalog.find(c => c.id === b.dataset.edit), draw));
      $$('[data-del]').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer cette prestation ?')) { data.catalog = data.catalog.filter(c => c.id !== b.dataset.del); save(true); draw(); } });
    };
    const drawTemplates = () => {
      $('#tpl-wrap').innerHTML = data.templates.length ? `<table class="list"><thead><tr><th>Modèle</th><th>Type</th><th class="r">Lignes</th><th></th></tr></thead><tbody>
        ${data.templates.map(t => `<tr><td><strong>${h(t.name)}</strong><div class="small muted">${h(t.subject || '')}</div></td><td>${C.TITLES[t.type] || t.type}</td><td class="r">${(t.lines || []).length}</td>
          <td class="actions"><button class="btn btn-sm btn-primary" data-use="${t.id}">Nouveau ${t.type === 'devis' ? 'devis' : 'facture'}</button> <button class="btn btn-sm" data-ren="${t.id}">Renommer</button> <button class="btn btn-sm btn-danger" data-tdel="${t.id}">Supprimer</button></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty">Aucun modèle. Depuis un devis ou une facture : Plus ▾ → « Enregistrer comme modèle ».</div>`;
      $$('[data-use]').forEach(b => b.onclick = () => { const t = data.templates.find(x => x.id === b.dataset.use); navigate(`#/doc/new/${t.type}/tpl/${t.id}`); });
      $$('[data-ren]').forEach(b => b.onclick = () => { const t = data.templates.find(x => x.id === b.dataset.ren); promptDialog('Renommer le modèle', 'Nom', t.name, v => { t.name = v; save(true); drawTemplates(); }); });
      $$('[data-tdel]').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ce modèle ?')) { data.templates = data.templates.filter(x => x.id !== b.dataset.tdel); save(true); drawTemplates(); } });
    };
    const drawSnippets = () => {
      $('#snip-wrap').innerHTML = data.snippets.length ? `<table class="list"><thead><tr><th>Nom</th><th>Texte</th><th></th></tr></thead><tbody>
        ${data.snippets.map(x => `<tr><td><strong>${h(x.name)}</strong></td><td class="small">${h(x.text).replace(/\n/g, '<br>')}</td>
          <td class="actions"><button class="btn btn-sm" data-sedit="${x.id}">Modifier</button> <button class="btn btn-sm btn-danger" data-sdel="${x.id}">Supprimer</button></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty">Aucun texte prédéfini. Conditions de garantie, modalités, mentions récurrentes… à insérer dans les notes d'un document en un clic.</div>`;
      $$('[data-sedit]').forEach(b => b.onclick = () => snippetForm(data.snippets.find(x => x.id === b.dataset.sedit), drawSnippets));
      $$('[data-sdel]').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ce texte ?')) { data.snippets = data.snippets.filter(x => x.id !== b.dataset.sdel); save(true); drawSnippets(); } });
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Catalogue de prestations</h1><div class="actions"><button class="btn btn-primary" id="new">+ Nouvelle prestation</button></div></div><div id="list-wrap"></div>
      <div class="section-head"><h2>Modèles de documents</h2></div><div id="tpl-wrap"></div>
      <div class="section-head"><h2>Textes prédéfinis</h2><button class="btn btn-sm" id="new-snip">+ Nouveau texte</button></div><div id="snip-wrap"></div>`;
    $('#new').onclick = () => catalogForm(null, draw);
    $('#new-snip').onclick = () => snippetForm(null, drawSnippets);
    draw(); drawTemplates(); drawSnippets();
  };

  function snippetForm(sn, done) {
    const x = sn || { id: C.uid(), name: '', text: '' };
    modal(`<h2>${sn ? 'Modifier le texte' : 'Nouveau texte prédéfini'}</h2>
      <form id="sf" class="grid-2">${field('Nom', 'name', x.name, 'text', 'placeholder="Garantie, Conditions de paiement…"')}<label class="field span-2">Texte<textarea name="text" rows="5">${h(x.text)}</textarea></label></form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => { $('#ok', root).onclick = () => { const v = formValues($('#sf', root)); if (!v.name.trim() || !v.text.trim()) return toast('Nom et texte obligatoires.', true); Object.assign(x, v); if (!sn) data.snippets.push(x); save(true); close(); if (done) done(); }; });
  }

  function promptDialog(title, label, value, done) {
    modal(`<h2>${h(title)}</h2><form id="pr" class="grid-2"><label class="field span-2">${h(label)}<input type="text" name="v" value="${h(value || '')}"></label></form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">OK</button></div>`,
      (root, close) => { $('#ok', root).onclick = () => { const v = $('input[name=v]', root).value.trim(); if (!v) return toast('Valeur obligatoire.', true); close(); done(v); }; });
  }

  // ---------- modèles de documents ----------
  const templatesFor = type => data.templates.filter(t => t.type === (type === 'avoir' ? 'facture' : type) || !t.type);
  function applyTemplate(doc, id) {
    const t = data.templates.find(x => x.id === id); if (!t) return;
    if (!doc.subject) doc.subject = t.subject || '';
    doc.lines = deepCopy(t.lines || []).map(l => ({ ...l, noDiscount: false }));
    if (!doc.lines.length) doc.lines = [{ label: '', description: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19 }];
    doc.discountRate = t.discountRate || 0;
    if (!doc.notes) doc.notes = t.notes || '';
  }
  function saveAsTemplate(doc) {
    promptDialog('Enregistrer comme modèle', 'Nom du modèle', doc.subject || '', name => {
      data.templates.push({ id: C.uid(), name, type: doc.type === 'avoir' ? 'facture' : doc.type, subject: doc.subject || '', lines: deepCopy(doc.lines || []).filter(l => !l.noDiscount), discountRate: doc.discountRate || 0, notes: doc.notes || '' });
      save(true); toast('Modèle « ' + name + ' » enregistré (Catalogue → Modèles)');
    });
  }

  // ---------- envoi par email ----------
  function docFileName(doc) {
    const client = (clientById(doc.clientId) || {}).name || '';
    const safe = s => String(s).replace(/[^\w\-àâäéèêëïîôöùûüç ]/gi, '').trim().replace(/\s+/g, '_');
    return `${doc.number || 'Brouillon-' + doc.type}${client ? '_' + safe(client) : ''}.pdf`;
  }
  function stampFor(doc) {
    const st = doc.type === 'facture' && doc.status !== 'brouillon' ? effStatus(doc) : null;
    return st === 'payée' ? 'Payée' : st === 'annulée' ? 'Annulée' : undefined;
  }
  function sendByEmail(doc, kind, extra, afterSend) {
    const client = clientById(doc.clientId);
    if (!client) return toast('Choisis un client.', true);
    kind = kind || doc.type;
    const m = C.emailFor(kind, doc, client, company(), extra);
    modal(`<h2>${kind.startsWith('relance') ? C.REMINDER_LABELS[Number(kind.slice(-1))] + ' — ' + h(doc.number) : 'Envoyer ' + h(docLabel(doc)) + ' par email'}</h2>
      <form id="mf" class="grid-2">
        ${field('Destinataire', 'to', m.to, 'email', 'placeholder="email@client.tn"')}
        <label class="check" style="align-self:end"><input type="checkbox" name="attach" checked> Joindre le PDF</label>
        <label class="field span-2">Objet<input type="text" name="subject" value="${h(m.subject)}"></label>
        <label class="field span-2">Message<textarea name="body" rows="9">${h(m.body)}</textarea></label>
      </form>
      <p class="small muted">${company().mailClient === 'mailto' ? 'Le message s\'ouvre dans ta messagerie ; le PDF est affiché dans le Finder pour le glisser dans le message.' : 'Sur Mac, le message s\'ouvre dans Mail avec le PDF joint. Tu le relis et tu cliques sur Envoyer.'} Modèles d'email : Paramètres → Emails.</p>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Ouvrir dans la messagerie</button></div>`,
      (root, close) => { $('#ok', root).onclick = async () => {
        const v = formValues($('#mf', root));
        if (!v.to || !/^[^@\s]+@[^@\s]+$/.test(v.to)) return toast('Adresse email invalide.', true);
        const b = $('#ok', root); b.disabled = true; b.textContent = 'Préparation…';
        try {
          let attachment = null;
          if (v.attach) attachment = await bridge.exportPdfSilent(C.documentHtml(doc, client, company(), { stampText: stampFor(doc) }), docFileName(doc));
          const r = await bridge.composeMail({ to: v.to, subject: v.subject, body: v.body, attachment, mode: company().mailClient === 'mailto' ? 'mailto' : 'auto' });
          if (!client.email) { client.email = v.to; }
          const stored = docById(doc.id) || doc;
          stored.emails = stored.emails || []; stored.emails.push({ date: C.today(), to: v.to, subject: v.subject, kind });
          if (stored.type === 'devis' && stored.status === 'brouillon') stored.status = 'envoyé';
          if (afterSend) afterSend(stored);
          save(true); close();
          toast(r && r.state === 'mail' ? 'Message ouvert dans Mail avec le PDF joint' : 'Message ouvert dans ta messagerie' + (attachment ? ' — glisse le PDF affiché dans le Finder' : ''));
          render();
        } catch (e) { b.disabled = false; b.textContent = 'Ouvrir dans la messagerie'; toast('Erreur : ' + e.message.replace(/^.*Error: /, ''), true); }
      }; });
  }
  function sendReminder(item) {
    const level = item.level;
    sendByEmail(item.doc, 'relance' + level, { jours: item.daysLate }, stored => { stored.reminders = stored.reminders || []; stored.reminders.push({ date: C.today(), level }); });
  }

  // ---------- contrats récurrents ----------
  function recurrenceFromInvoice(doc) {
    const day = Number(doc.date.slice(8, 10)) || 1;
    return { id: C.uid(), clientId: doc.clientId, subject: (doc.subject || '').replace(/\s+—.*$/, '') + ' — {mois}', reference: '', lines: deepCopy(doc.lines || []).filter(l => !l.noDiscount),
      discountRate: doc.discountRate || 0, withholdingRate: doc.withholdingRate || 0, notes: doc.notes || '', every: 'month', day, nextDate: C.addMonths(doc.date, 1, day), active: true, createdAt: Date.now(),
      lang: doc.lang || 'fr', currency: doc.currency || company().currency, exchangeRate: doc.exchangeRate || '' };
  }
  function recurrenceForm(rec, done) {
    const isNew = !data.recurring.find(r => r.id === rec.id);
    const r = deepCopy(rec);
    if (!r.lines || !r.lines.length) r.lines = [{ label: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19 }];
    const cur = company().currency;
    const clientOptions = () => `<option value="">— Client —</option>` + data.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}" ${c.id === r.clientId ? 'selected' : ''}>${h(c.name)}</option>`).join('');
    modal(`<h2>${isNew ? 'Nouveau contrat récurrent' : 'Modifier le contrat'}</h2>
      <form id="rf" class="grid-3">
        <label class="field span-2">Client<select name="clientId">${clientOptions()}</select></label>
        <label class="field">Période<select name="every">${C.PERIODS.map(p => `<option value="${p[0]}" ${p[0] === r.every ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label>
        <label class="field span-2">Objet des factures <span class="muted">({mois} = mois facturé)</span><input type="text" name="subject" value="${h(r.subject)}" placeholder="Maintenance et supervision — {mois}"></label>
        ${field('Jour du mois', 'day', r.day || 1, 'number', 'min="1" max="31" class="num"')}
        ${field('Prochaine facture', 'nextDate', r.nextDate || C.today(), 'date')}
        <label class="field">Retenue à la source<select name="withholdingRate">${withholdingOptions(r.withholdingRate)}</select></label>
        ${field('Remise (%)', 'discountRate', r.discountRate || 0, 'number', 'min="0" max="100" step="0.5" class="num"')}
        <label class="field span-3">Notes sur la facture<textarea name="notes" rows="2">${h(r.notes || '')}</textarea></label>
        <label class="check span-3"><input type="checkbox" name="active" ${r.active !== false ? 'checked' : ''}> Contrat actif (les factures sont proposées à la date prévue)</label>
      </form>
      <table class="mini"><thead><tr><th>Désignation</th><th style="width:70px">Qté</th><th style="width:110px">P.U. HT</th><th style="width:80px">TVA</th><th></th></tr></thead><tbody id="rl"></tbody></table>
      <div class="inline mt"><button type="button" class="btn btn-sm" id="rl-add">+ Ligne</button><span class="small muted" id="rl-total"></span></div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        const body = $('#rl', root);
        const drawL = () => {
          body.innerHTML = r.lines.map((l, i) => `<tr data-i="${i}"><td><input type="text" data-k="label" value="${h(l.label)}" placeholder="Désignation"></td><td><input type="number" class="num" data-k="qty" value="${l.qty}" step="0.01"></td><td><input type="number" class="num" data-k="unitPrice" value="${l.unitPrice}" step="0.001"></td><td><select data-k="vatRate">${C.VAT_RATES.map(v => `<option value="${v}" ${Number(l.vatRate) === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></td><td><button type="button" class="btn btn-ghost btn-sm" data-rm="${i}">✕</button></td></tr>`).join('');
          $$('[data-k]', body).forEach(el => el.oninput = () => { const i = Number(el.closest('tr').dataset.i); r.lines[i][el.dataset.k] = el.type === 'number' ? Number(el.value) : el.value; tot(); });
          $$('[data-rm]', body).forEach(b => b.onclick = () => { r.lines.splice(Number(b.dataset.rm), 1); if (!r.lines.length) r.lines.push({ label: '', qty: 1, unitPrice: 0, vatRate: 19 }); drawL(); });
          tot();
        };
        const tot = () => { const t = C.computeTotals({ type: 'facture', lines: r.lines, discountRate: Number($('input[name=discountRate]', root).value) || 0 }, company()); $('#rl-total', root).textContent = `${C.money(t.netHT, cur)} HT · ${C.money(t.totalTTC, cur)} TTC par facture`; };
        $('#rl-add', root).onclick = () => { r.lines.push({ label: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19 }); drawL(); };
        $('input[name=discountRate]', root).oninput = tot;
        drawL();
        $('#ok', root).onclick = () => {
          const v = formValues($('#rf', root));
          if (!v.clientId) return toast('Choisis un client.', true);
          if (!v.subject.trim()) return toast('Indique l\'objet des factures.', true);
          if (!r.lines.some(l => l.label && l.label.trim())) return toast('Ajoute au moins une ligne.', true);
          if (!v.nextDate) return toast('Date de la prochaine facture obligatoire.', true);
          Object.assign(r, v, { day: Math.min(31, Math.max(1, Number(v.day) || 1)), withholdingRate: Number(v.withholdingRate) || 0, discountRate: Number(v.discountRate) || 0 });
          const idx = data.recurring.findIndex(x => x.id === r.id);
          if (idx >= 0) data.recurring[idx] = r; else data.recurring.push(r);
          save(true); close(); if (done) done(r);
        };
      });
  }
  // Génère les brouillons de factures dus (une par période manquée, 12 max) ; renvoie le nombre créé.
  function generateRecurring(recs, force) {
    let n = 0;
    (recs || C.dueRecurrences(data)).forEach(rec => {
      let guard = 0;
      do {
        const inv = { ...C.buildRecurringInvoice(rec, rec.nextDate, company()), id: C.uid(), createdAt: Date.now() };
        data.documents.push(inv); n++;
        rec.lastIssued = rec.nextDate; rec.nextDate = C.nextRecurrenceDate(rec.nextDate, rec.every, rec.day);
      } while (!force && rec.active !== false && rec.nextDate <= C.today() && ++guard < 12);
    });
    if (n) save(true);
    return n;
  }
  routes.contrats = () => {
    const cur = company().currency;
    const draw = () => {
      const due = C.dueRecurrences(data);
      const list = data.recurring.slice().sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));
      $('#c-wrap').innerHTML = `${due.length ? `<div class="banner">${due.length} facture(s) récurrente(s) à générer<button class="btn" id="gen-due">Générer les brouillons</button></div>` : ''}
        ${list.length ? `<table class="list"><thead><tr><th>Client</th><th>Objet</th><th>Période</th><th>Prochaine facture</th><th class="r">HT / facture</th><th>État</th><th></th></tr></thead><tbody>
        ${list.map(r => { const t = C.computeTotals({ type: 'facture', lines: r.lines, discountRate: r.discountRate }, company()); const isDue = r.active !== false && r.nextDate <= C.today();
          return `<tr><td><strong>${h(clientName(r.clientId))}</strong></td><td>${h(r.subject)}</td><td>${(C.PERIODS.find(p => p[0] === r.every) || [])[1] || ''}</td><td>${C.fmtDate(r.nextDate)}${isDue ? ' <span class="level l2">à générer</span>' : ''}${r.lastIssued ? `<div class="small muted">dernière : ${C.fmtDate(r.lastIssued)}</div>` : ''}</td><td class="r">${C.money(t.netHT, cur)}</td><td>${r.active !== false ? badge('envoyée').replace('envoyée', 'actif') : badge('brouillon').replace('brouillon', 'suspendu')}</td>
          <td class="actions"><button class="btn btn-sm" data-gen="${r.id}">Générer maintenant</button> <button class="btn btn-sm" data-edit="${r.id}">Modifier</button> <button class="btn btn-sm" data-toggle="${r.id}">${r.active !== false ? 'Suspendre' : 'Reprendre'}</button> <button class="btn btn-sm btn-danger" data-del="${r.id}">Supprimer</button></td></tr>`; }).join('')}
        </tbody></table>` : `<div class="empty">Aucun contrat. Un contrat génère automatiquement un brouillon de facture à chaque échéance (mensuelle, trimestrielle, annuelle). Crée-le ici, ou depuis une facture existante : Plus ▾ → « Rendre récurrent ».</div>`}`;
      if ($('#gen-due')) $('#gen-due').onclick = () => { const n = generateRecurring(); toast(`${n} brouillon(s) créé(s) — à émettre depuis Factures`); draw(); };
      $$('[data-gen]').forEach(b => b.onclick = () => { const r = data.recurring.find(x => x.id === b.dataset.gen); generateRecurring([r], true); toast('Brouillon créé pour ' + C.monthLabel(r.lastIssued)); draw(); });
      $$('[data-edit]').forEach(b => b.onclick = () => recurrenceForm(data.recurring.find(x => x.id === b.dataset.edit), draw));
      $$('[data-toggle]').forEach(b => b.onclick = () => { const r = data.recurring.find(x => x.id === b.dataset.toggle); r.active = r.active === false; save(true); draw(); });
      $$('[data-del]').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ce contrat ? Les factures déjà générées sont conservées.')) { data.recurring = data.recurring.filter(x => x.id !== b.dataset.del); save(true); draw(); } });
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Contrats récurrents</h1><div class="actions"><button class="btn btn-primary" id="new">+ Nouveau contrat</button></div></div><div id="c-wrap"></div>`;
    $('#new').onclick = () => recurrenceForm({ id: C.uid(), clientId: '', subject: '', lines: [], every: 'month', day: 1, nextDate: C.addMonths(C.today(), 1, 1), active: true, withholdingRate: 0, discountRate: 0, notes: '' }, draw);
    draw();
  };

  // ---------- relances ----------
  routes.relances = () => {
    const cur = company().currency;
    const draw = () => {
      const od = C.overdueInvoices(data, company());
      const soon = data.documents.filter(d => d.type === 'facture' && ['envoyée', 'partielle'].includes(effStatus(d)) && d.dueDate >= C.today() && C.daysBetween(C.today(), d.dueDate) <= 7);
      const total = od.reduce((s, x) => s + x.remaining, 0);
      $('#r-wrap').innerHTML = `
        ${od.length ? `<div class="banner">${od.length} facture(s) en retard — ${C.money(total, cur)} à récupérer</div>` : `<div class="banner info">Aucune facture en retard.</div>`}
        ${od.length ? `<table class="list"><thead><tr><th>Facture</th><th>Client</th><th>Échéance</th><th class="r">Retard</th><th class="r">Reste à payer</th><th>Dernière relance</th><th></th></tr></thead><tbody>
          ${od.map(x => `<tr><td><strong><a href="#/doc/${x.doc.id}">${h(x.doc.number)}</a></strong><div class="small muted">${h(x.doc.subject || '')}</div></td><td>${h(clientName(x.doc.clientId))}</td><td>${C.fmtDate(x.doc.dueDate)}</td><td class="r">${x.daysLate} j <span class="level l${x.level}">${h(C.REMINDER_LABELS[x.level])}</span></td><td class="r">${C.money(x.remaining, cur)}</td>
            <td>${x.lastReminder ? `${C.fmtDate(x.lastReminder.date)} <span class="small muted">(niveau ${x.lastReminder.level}, ${x.reminders.length} envoi${x.reminders.length > 1 ? 's' : ''})</span>` : '<span class="muted">jamais</span>'}</td>
            <td class="actions"><button class="btn btn-sm btn-primary" data-rem="${x.doc.id}">Relancer par email</button> <button class="btn btn-sm" data-pay="${x.doc.id}">Paiement reçu</button></td></tr>`).join('')}
        </tbody></table>` : ''}
        ${soon.length ? `<div class="section-head"><h2>Échéances dans les 7 jours</h2></div><table class="list compact"><thead><tr><th>Facture</th><th>Client</th><th>Échéance</th><th class="r">Reste</th></tr></thead><tbody>
          ${soon.map(d => `<tr class="clickable" data-id="${d.id}"><td><strong>${h(d.number)}</strong></td><td>${h(clientName(d.clientId))}</td><td>${C.fmtDate(d.dueDate)}</td><td class="r">${C.money(balance(d).remaining, cur)}</td></tr>`).join('')}
        </tbody></table>` : ''}
        <p class="small muted mt">Niveaux : rappel amical jusqu'à 15 jours, relance jusqu'à 45 jours, dernière relance au-delà. Textes modifiables dans Paramètres → Emails.</p>`;
      $$('[data-rem]').forEach(b => b.onclick = () => sendReminder(od.find(x => x.doc.id === b.dataset.rem)));
      $$('[data-pay]').forEach(b => b.onclick = () => paymentForm(docById(b.dataset.pay), draw));
      $$('tr.clickable[data-id]').forEach(tr => tr.onclick = () => navigate('#/doc/' + tr.dataset.id));
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Relances</h1></div><div id="r-wrap"></div>`;
    draw();
  };

  // ---------- bannières et compteurs ----------
  function dashboardBanners() {
    const due = C.dueRecurrences(data).length;
    const od = C.overdueInvoices(data, company());
    const cur = company().currency;
    return `${due ? `<div class="banner info">${due} facture(s) récurrente(s) à générer ce mois<button class="btn" id="b-gen">Générer les brouillons</button></div>` : ''}
      ${od.length ? `<div class="banner">${od.length} facture(s) en retard — ${C.money(od.reduce((s, x) => s + x.remaining, 0), cur)}<button class="btn" id="b-rel">Voir les relances</button></div>` : ''}`;
  }
  function bindBanners() {
    if ($('#b-gen')) $('#b-gen').onclick = () => { const n = generateRecurring(); toast(`${n} brouillon(s) créé(s)`); render(); };
    if ($('#b-rel')) $('#b-rel').onclick = () => navigate('#/relances');
  }
  function updateNavCounts() {
    const el = $('#nav-relances'); if (!el || !data) return;
    const n = C.overdueInvoices(data, company()).length;
    el.hidden = !n; el.textContent = n;
  }

  // ---------- palette de recherche (Cmd/Ctrl+K) ----------
  function closePalette() { const r = $('#palette-root'); if (r && !r.hidden) { r.hidden = true; r.innerHTML = ''; } }
  function openPalette() {
    const root = $('#palette-root');
    if (!root.hidden) return closePalette();
    root.hidden = false;
    root.innerHTML = `<div class="palette"><input type="text" id="pal-q" placeholder="Rechercher un document, un client, une prestation, une action…" autocomplete="off" spellcheck="false"><div class="results" id="pal-res"></div><div class="hint">↑ ↓ pour naviguer · Entrée pour ouvrir · Échap pour fermer</div></div>`;
    const cur = company().currency;
    const actions = [
      ['Nouveau devis', () => navigate('#/doc/new/devis')], ['Nouvelle facture', () => navigate('#/doc/new/facture')], ['Nouvel avoir', () => navigate('#/doc/new/avoir')],
      ['Accueil', () => navigate('#/dashboard')], ['Devis', () => navigate('#/devis')], ['Factures', () => navigate('#/factures')], ['Relances', () => navigate('#/relances')],
      ['Contrats récurrents', () => navigate('#/contrats')], ['Clients', () => navigate('#/clients')], ['Catalogue', () => navigate('#/catalogue')], ['Comptabilité', () => navigate('#/compta')], ['Paramètres', () => navigate('#/parametres')],
      ['Nouveau client', () => clientForm(null, () => render())]
    ].map(([label, run]) => ({ kind: 'Action', main: label, text: label.toLowerCase(), run }));
    const docs = data.documents.map(d => { const t = C.computeTotals(d, company()); const cn = clientName(d.clientId); return { kind: C.TITLES[d.type], main: d.number || 'Brouillon', sub: `${cn}${d.subject ? ' — ' + d.subject : ''}`, amt: C.money(d.type === 'devis' ? t.totalTTC : t.netToPay, cur), text: `${d.number} ${cn} ${d.subject || ''} ${d.type}`.toLowerCase(), run: () => navigate('#/doc/' + d.id), ts: d.createdAt || 0 }; });
    const clients = data.clients.map(c => ({ kind: 'Client', main: c.name, sub: [c.email, c.phone].filter(Boolean).join(' · '), text: `${c.name} ${c.email || ''} ${c.phone || ''} ${c.matricule || ''}`.toLowerCase(), run: () => clientForm(c, () => render()) }));
    const items = data.catalog.map(c => ({ kind: 'Prestation', main: c.label, sub: C.money(c.unitPrice, cur) + ' HT', text: `${c.label} ${c.description || ''}`.toLowerCase(), run: () => navigate('#/catalogue') }));
    const all = [...actions, ...docs, ...clients, ...items];
    let sel = 0, shown = [];
    const input = $('#pal-q'), res = $('#pal-res');
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      shown = (q ? all.filter(x => words.every(w => x.text.includes(w))) : [...docs.slice().sort((a, b) => b.ts - a.ts).slice(0, 6), ...actions.slice(0, 4)]).slice(0, 12);
      if (q) shown.sort((a, b) => (b.text.startsWith(q) ? 1 : 0) - (a.text.startsWith(q) ? 1 : 0));
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      res.innerHTML = shown.length ? shown.map((x, i) => `<div class="res ${i === sel ? 'sel' : ''}" data-i="${i}"><span class="kind">${h(x.kind)}</span><span class="main">${h(x.main)}${x.sub ? `<span class="sub">${h(x.sub)}</span>` : ''}</span>${x.amt ? `<span class="amt">${h(x.amt)}</span>` : ''}</div>`).join('') : `<div class="res"><span class="main muted">Aucun résultat</span></div>`;
      $$('.res[data-i]', res).forEach(el => el.onclick = () => { closePalette(); shown[Number(el.dataset.i)].run(); });
    };
    input.oninput = () => { sel = 0; draw(); };
    input.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); const x = shown[sel]; if (x) { closePalette(); x.run(); } }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    };
    root.onclick = e => { if (e.target === root) closePalette(); };
    draw(); input.focus();
  }
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    else if (e.key === 'Escape') { const l = $('#more-list'); if (l && !l.hidden) l.hidden = true; }
  });
  document.addEventListener('click', e => { const l = $('#more-list'); if (l && !l.hidden && !e.target.closest('.more')) l.hidden = true; });

  // ---------- Paramètres ----------

  // ---------- Comptabilité ----------
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const comptaState = { year: C.today().slice(0, 4), month: C.today().slice(5, 7) };

  routes.compta = () => {
    const cur = company().currency;
    const years = Array.from(new Set(data.documents.map(d => (d.date || '').slice(0, 4)).filter(Boolean).concat([C.today().slice(0, 4)]))).sort().reverse();
    if (!years.includes(comptaState.year)) comptaState.year = years[0];
    const period = () => comptaState.month
      ? { from: `${comptaState.year}-${comptaState.month}-01`, to: `${comptaState.year}-${comptaState.month}-31` }
      : { from: `${comptaState.year}-01-01`, to: `${comptaState.year}-12-31` };
    const periodLabel = () => comptaState.month ? `${MONTHS[Number(comptaState.month) - 1]} ${comptaState.year}` : `année ${comptaState.year}`;

    $('#view').innerHTML = `
      <div class="page-head"><h1>Comptabilité</h1>
        <div class="actions">
          <select id="c-year">${years.map(y => `<option ${y === comptaState.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <select id="c-month"><option value="">Toute l'année</option>${MONTHS.map((m, i) => { const v = String(i + 1).padStart(2, '0'); return `<option value="${v}" ${v === comptaState.month ? 'selected' : ''}>${m}</option>`; }).join('')}</select>
        </div></div>
      <div id="c-body"></div>`;
    const draw = () => {
      const p = period();
      const rows = C.salesJournal(data, company(), p);
      const sum = C.vatSummary(rows);
      const pays = C.paymentsJournal(data, company(), p);
      const paidTotal = pays.reduce((s, r) => s + r.amount, 0);
      const open = data.documents.filter(d => d.type === 'facture' && ['envoyée', 'partielle', 'retard'].includes(effStatus(d)));
      const openAmount = open.reduce((s, d) => s + balance(d).remaining, 0);
      const rsPending = data.documents.filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée' && C.computeTotals(d, company()).withholding > 0 && !d.withholdingCertificate);
      const rsPendingAmount = rsPending.reduce((s, d) => s + C.computeTotals(d, company()).withholding, 0);
      $('#c-body').innerHTML = `
        <div class="stats">
          <div class="stat"><div class="lbl">CA HT — ${h(periodLabel())}</div><div class="val">${C.money(sum.ht, cur)}</div><div class="sub">${sum.count} document(s), avoirs déduits</div></div>
          <div class="stat"><div class="lbl">TVA collectée</div><div class="val">${C.money(sum.tva, cur)}</div><div class="sub">+ timbres ${C.money(sum.timbre, cur)}</div></div>
          <div class="stat"><div class="lbl">Encaissé sur la période</div><div class="val">${C.money(paidTotal, cur)}</div><div class="sub">${pays.length} paiement(s)</div></div>
          <div class="stat"><div class="lbl">Reste à encaisser (total)</div><div class="val">${C.money(openAmount, cur)}</div><div class="sub">${open.length} facture(s) ouverte(s)</div></div>
        </div>
        <div class="panel"><h2>TVA par taux — ${h(periodLabel())}</h2>
          <table class="list compact"><thead><tr><th>Taux</th><th class="r">Base HT</th><th class="r">TVA</th></tr></thead><tbody>
            ${C.VAT_RATES.map(r => `<tr><td>TVA ${r} %</td><td class="r">${C.money(sum.byRate[r].base, cur)}</td><td class="r">${C.money(sum.byRate[r].vat, cur)}</td></tr>`).join('')}
            <tr class="total-row"><td><strong>Total</strong></td><td class="r"><strong>${C.money(sum.ht, cur)}</strong></td><td class="r"><strong>${C.money(sum.tva, cur)}</strong></td></tr>
          </tbody></table>
          <p class="small muted mt">Timbres fiscaux : ${C.money(sum.timbre, cur)} · TTC facturé : ${C.money(sum.ttc, cur)} · Retenues à la source subies : ${C.money(sum.rs, cur)}. <em>À VÉRIFIER avec le comptable</em> avant déclaration.</p>
        </div>
        <div class="panel"><h2>Journal des ventes — ${h(periodLabel())}</h2>
          <div class="inline mb"><button class="btn" id="exp-journal">Exporter en CSV (Excel)</button><button class="btn" id="exp-pdfs">Exporter tous les PDF de la période</button></div>
          ${rows.length ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Date</th><th>Numéro</th><th>Client</th><th class="r">HT</th><th class="r">TVA</th><th class="r">TTC</th><th class="r">RS</th><th class="r">Net</th><th>Statut</th></tr></thead><tbody>
            ${rows.map(r => `<tr class="clickable" data-id="${r.id}"><td>${C.fmtDate(r.date)}</td><td><strong>${h(r.number)}</strong>${r.type === 'avoir' ? `<div class="small muted">avoir · ${h(r.creditOfNumber)}</div>` : ''}</td><td>${h(r.client)}<div class="small muted">${h(r.subject)}</div></td><td class="r">${C.money(r.ht)}</td><td class="r">${C.money(r.tva)}</td><td class="r">${C.money(r.ttc)}</td><td class="r">${r.rs ? C.money(r.rs) : '—'}</td><td class="r">${C.money(r.net)}</td><td>${badge(r.status)}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty">Aucune facture émise sur cette période.</div>'}
        </div>
        <div class="panel"><h2>Encaissements — ${h(periodLabel())}</h2>
          <div class="inline mb"><button class="btn" id="exp-pays">Exporter en CSV (Excel)</button></div>
          ${pays.length ? `<table class="list compact"><thead><tr><th>Date</th><th>Facture</th><th>Client</th><th>Mode</th><th>Référence</th><th class="r">Montant</th></tr></thead><tbody>
            ${pays.map(r => `<tr class="clickable" data-id="${r.docId}"><td>${C.fmtDate(r.date)}</td><td><strong>${h(r.number)}</strong></td><td>${h(r.client)}</td><td>${h(r.method)}</td><td>${h(r.reference)}</td><td class="r">${C.money(r.amount, cur)}</td></tr>`).join('')}
          </tbody></table>` : '<div class="empty">Aucun encaissement sur cette période.</div>'}
        </div>
        <div class="panel"><h2>Retenues à la source — attestations à recevoir</h2>
          ${rsPending.length ? `<p class="small muted">${C.money(rsPendingAmount, cur)} retenus par tes clients sans attestation reçue. Coche quand l'attestation arrive (elle justifie la retenue auprès du fisc).</p>
          <table class="list compact"><thead><tr><th>Facture</th><th>Client</th><th>Date</th><th class="r">Retenue</th><th></th></tr></thead><tbody>
            ${rsPending.map(d => { const t = C.computeTotals(d, company()); return `<tr><td><strong>${h(d.number)}</strong></td><td>${h(clientName(d.clientId))}</td><td>${C.fmtDate(d.date)}</td><td class="r">${C.money(t.withholding, cur)} <span class="muted small">(${pct(t.withholdingRate)} %)</span></td><td class="actions"><button class="btn btn-sm" data-cert="${d.id}">Attestation reçue</button></td></tr>`; }).join('')}
          </tbody></table>` : '<p class="small muted">Aucune attestation en attente.</p>'}
        </div>`;
      $$('tr.clickable[data-id]').forEach(tr => tr.onclick = () => navigate('#/doc/' + tr.dataset.id));
      $$('[data-cert]').forEach(b => b.onclick = () => { const d = docById(b.dataset.cert); d.withholdingCertificate = true; save(true); draw(); toast('Attestation notée pour ' + d.number); });
      const tag = comptaState.month ? `${comptaState.year}-${comptaState.month}` : comptaState.year;
      $('#exp-journal').onclick = async () => {
        const cols = [
          { key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'Numéro' }, { key: 'typeLabel', label: 'Type' }, { key: 'client', label: 'Client' }, { key: 'subject', label: 'Objet' },
          { key: 'ht', label: 'Total HT', type: 'money' },
          ...C.VAT_RATES.map(r => ({ label: `Base ${r}%`, type: 'money', get: x => x.vatByRate[r].base })),
          ...C.VAT_RATES.map(r => ({ label: `TVA ${r}%`, type: 'money', get: x => x.vatByRate[r].vat })),
          { key: 'tva', label: 'Total TVA', type: 'money' }, { key: 'timbre', label: 'Timbre', type: 'money' }, { key: 'ttc', label: 'TTC', type: 'money' },
          { key: 'rs', label: 'Retenue source', type: 'money' }, { key: 'net', label: 'Net à payer', type: 'money' },
          { key: 'statusLabel', label: 'Statut' }, { key: 'paid', label: 'Payé', type: 'money' }, { key: 'remaining', label: 'Reste', type: 'money' }
        ];
        const p2 = await bridge.saveText(`journal-ventes-${tag}.csv`, C.toCsv(rows, cols)); if (p2) toast('Exporté : ' + p2.split(/[\\/]/).pop());
      };
      $('#exp-pays').onclick = async () => {
        const cols = [{ key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'Facture' }, { key: 'client', label: 'Client' }, { key: 'amount', label: 'Montant', type: 'money' }, { key: 'method', label: 'Mode' }, { key: 'reference', label: 'Référence' }, { key: 'note', label: 'Note' }];
        const p2 = await bridge.saveText(`encaissements-${tag}.csv`, C.toCsv(pays, cols)); if (p2) toast('Exporté : ' + p2.split(/[\\/]/).pop());
      };
      $('#exp-pdfs').onclick = async () => {
        if (!rows.length) return toast('Rien à exporter sur cette période.', true);
        const files = rows.map(r => { const d = docById(r.id); const st = d.type === 'facture' ? effStatus(d) : null; return { name: `${d.number}_${(r.client || '').replace(/[^\w\-àâäéèêëïîôöùûüç ]/gi, '').trim().replace(/\s+/g, '_')}.pdf`, html: C.documentHtml(d, clientById(d.clientId), company(), { stampText: st === 'payée' ? 'Payée' : st === 'annulée' ? 'Annulée' : undefined }) }; });
        toast(`Génération de ${files.length} PDF…`);
        try { const dir = await bridge.exportPdfMany(files, `SkanFact-${tag}`); if (dir) { toast(`${files.length} PDF exportés`); bridge.openPath(dir); } }
        catch (e) { toast('Erreur : ' + e.message, true); }
      };
    };
    $('#c-year').onchange = e => { comptaState.year = e.target.value; draw(); };
    $('#c-month').onchange = e => { comptaState.month = e.target.value; draw(); };
    draw();
  };

  // ---------- Paramètres ----------
  routes.parametres = async () => {
    const c = company();
    const path = await bridge.dataPath();
    $('#view').innerHTML = `<div class="page-head"><h1>Paramètres</h1><div class="actions"><button class="btn btn-primary" id="save">Enregistrer</button></div></div>
      <form id="pf">
        <div class="panel"><h2>Société</h2><div class="grid-2">
          ${field('Raison sociale', 'name', c.name)}
          ${field('Matricule fiscal', 'matricule', c.matricule, 'text', 'placeholder="1998268D/A/M/000"')}
          ${field('Registre de commerce (RC)', 'rc', c.rc || '', 'text', 'placeholder="B123456789"')}
          ${field('Capital social', 'capital', c.capital || '', 'text', 'placeholder="1 000 DT"')}
          <label class="field span-2">Adresse<textarea name="address">${h(c.address)}</textarea></label>
          ${field('Téléphone', 'phone', c.phone)}
          ${field('Email', 'email', c.email, 'email')}
          ${field('Site web', 'website', c.website || '')}
          <label class="field span-2">Slogan (sous le nom, sur les documents)<input type="text" name="tagline" value="${h(c.tagline || '')}" placeholder="Cybersécurité · Infrastructure · Services informatiques"></label>
          <label class="field">Couleur principale<input type="color" name="primaryColor" value="${h(c.primaryColor || '#1b2430')}"></label>
          <label class="field">Couleur d'accent<input type="color" name="accentColor" value="${h(c.accentColor || '#0f9d8f')}"></label>
          <label class="field">Logo
            <div>${c.logo ? `<img class="logo-preview" src="${c.logo}">` : ''}
            <div class="inline"><button type="button" class="btn btn-sm" id="pick-logo">Choisir une image…</button>${c.logo ? '<button type="button" class="btn btn-sm btn-ghost" id="rm-logo">Retirer</button>' : ''}</div></div>
          </label>
          <label class="field">Cachet / signature (dans la case « Cachet et signature » des documents)
            <div>${c.stampImage ? `<img class="stamp-preview" src="${c.stampImage}">` : ''}
            <div class="inline"><button type="button" class="btn btn-sm" id="pick-stamp">Choisir une image…</button>${c.stampImage ? '<button type="button" class="btn btn-sm btn-ghost" id="rm-stamp">Retirer</button>' : ''}</div></div>
          </label>
        </div></div>
        <div class="panel"><h2>Apparence</h2><div class="grid-3">
          <label class="field">Thème<select name="theme"><option value="light" ${c.theme !== 'dark' && c.theme !== 'auto' ? 'selected' : ''}>Clair</option><option value="dark" ${c.theme === 'dark' ? 'selected' : ''}>Sombre</option><option value="auto" ${c.theme === 'auto' ? 'selected' : ''}>Comme le système</option></select></label>
          <label class="field">Langue des documents par défaut<select name="defaultLang"><option value="fr" ${c.defaultLang !== 'en' ? 'selected' : ''}>Français</option><option value="en" ${c.defaultLang === 'en' ? 'selected' : ''}>English</option></select></label>
        </div><p class="small muted mt">Le thème sombre ne concerne que l'interface : les documents restent clairs.</p></div>
        <div class="panel"><h2>Paiement</h2><div class="grid-2">
          ${field('Banque', 'bank', c.bank)}
          ${field('RIB', 'rib', c.rib)}
          <label class="field span-2">Conditions de paiement (sur les factures)<textarea name="paymentTerms">${h(c.paymentTerms || '')}</textarea></label>
        </div></div>
        <div class="panel"><h2>Documents</h2><div class="grid-3">
          ${field('Timbre fiscal par facture', 'stampFee', c.stampFee, 'number', 'step="0.001" min="0" class="num"')}
          ${field('Validité des devis (jours)', 'quoteValidityDays', c.quoteValidityDays, 'number', 'min="0" class="num"')}
          ${field('Délai de paiement (jours)', 'paymentTermsDays', c.paymentTermsDays, 'number', 'min="0" class="num"')}
          <label class="field">Retenue à la source par défaut<select name="defaultWithholdingRate">${withholdingOptions(c.defaultWithholdingRate)}</select></label>
          ${field('Devise', 'currency', c.currency)}
          <label class="check" style="align-self:end"><input type="checkbox" name="openAfterExport" ${c.openAfterExport !== false ? 'checked' : ''}> Ouvrir le PDF après export</label>
          <label class="field span-2">Conditions des devis<textarea name="quoteTerms">${h(c.quoteTerms || '')}</textarea></label>
          <label class="field">Pied de page des documents<textarea name="footer">${h(c.footer)}</textarea></label>
          <label class="field span-2">Conditions de paiement (documents en anglais)<textarea name="paymentTermsEn">${h(c.paymentTermsEn || '')}</textarea></label>
          <label class="field">Conditions des devis (anglais)<textarea name="quoteTermsEn">${h(c.quoteTermsEn || '')}</textarea></label>
        </div>
        <p class="small muted mt">Retenue à la source : calculée sur le TTC hors timbre, modifiable sur chaque facture et par client. Les taux et l'assiette sont <em>À VÉRIFIER avec ton comptable</em>.</p></div>
        <div class="panel"><h2>Emails</h2>
          <div class="grid-2">
            <label class="field">Envoi des emails<select name="mailClient"><option value="auto" ${c.mailClient !== 'mailto' ? 'selected' : ''}>Mail (Apple) avec le PDF joint — Mac</option><option value="mailto" ${c.mailClient === 'mailto' ? 'selected' : ''}>Autre messagerie (mailto, PDF à glisser)</option></select></label>
          </div>
          <p class="small muted mt">Variables utilisables : {numero} {client} {objet} {montant} {echeance} {jours} {societe} {reference}. Les documents en anglais utilisent les modèles en anglais.</p>
          ${[['fr', 'et', 'Modèles en français', C.DEFAULT_EMAIL_TEMPLATES, c.emailTemplates || {}], ['en', 'eten', 'Modèles en anglais (clients étrangers)', C.DEFAULT_EMAIL_TEMPLATES_EN, c.emailTemplatesEn || {}]].map(([lg, prefix, title, defs, cur2]) => `<details ${lg === 'fr' ? 'open' : ''}><summary>${title}</summary>
          ${[['devis', lg === 'fr' ? 'Envoi d\'un devis' : 'Quote'], ['facture', lg === 'fr' ? 'Envoi d\'une facture' : 'Invoice'], ['avoir', lg === 'fr' ? 'Envoi d\'un avoir' : 'Credit note'], ['relance1', lg === 'fr' ? 'Rappel (≤ 15 jours de retard)' : 'Reminder (≤ 15 days)'], ['relance2', lg === 'fr' ? 'Relance (16 à 45 jours)' : 'Second reminder (16–45 days)'], ['relance3', lg === 'fr' ? 'Dernière relance (> 45 jours)' : 'Final reminder (> 45 days)']].map(([k, label]) => {
            const t = { ...defs[k], ...(cur2[k] || {}) };
            return `<div class="section-head"><h2 class="small">${label}</h2></div><div class="grid-2"><label class="field span-2">Objet<input type="text" name="${prefix}_${k}_subject" value="${h(t.subject)}"></label><label class="field span-2">Message<textarea name="${prefix}_${k}_body" rows="4">${h(t.body)}</textarea></label></div>`; }).join('')}
          </details>`).join('')}
        </div>
      </form>
      <div class="panel"><h2>Mises à jour</h2><div id="update-panel"></div></div>
      <div class="panel"><h2>Données et sauvegardes</h2>
        <p class="small muted">Fichier de données : <code>${h(path)}</code></p>
        <p class="small">${data.documents.length} document(s), ${data.clients.length} client(s), ${data.catalog.length} prestation(s).</p>
        <p class="small muted">Chaque jour, l'état du matin est copié dans le dossier <code>backups</code> (30 jours conservés) ; une copie est aussi prise avant tout import. Pour revenir en arrière : <em>Importer</em> et choisis un fichier de ce dossier.</p>
        <div class="inline mt">
          <button class="btn" id="backup-now">Sauvegarder maintenant</button>
          <button class="btn" id="open-backups">Ouvrir le dossier des sauvegardes</button>
          <button class="btn" id="export-data">Exporter les données…</button>
          <button class="btn" id="import-data">Importer…</button>
        </div>
        <div class="inline mt">
          <button class="btn" id="load-demo">Charger le jeu de données de démonstration</button>
          <button class="btn btn-danger" id="wipe-data">Tout effacer</button>
        </div>
        <p class="small muted mt">La démo remplace tes données actuelles par des clients, prestations, devis et factures fictifs pour découvrir l'app. Exporte d'abord si tu veux garder quelque chose.</p>
      </div>`;
    $('#save').onclick = () => {
      const v = formValues($('#pf'));
      const et = {}, eten = {};
      Object.keys(v).forEach(k => { const m = k.match(/^(et|eten)_(\w+)_(subject|body)$/); if (m) { const bag = m[1] === 'et' ? et : eten; bag[m[2]] = bag[m[2]] || {}; bag[m[2]][m[3]] = v[k]; delete v[k]; } });
      Object.assign(data.company, v, { emailTemplates: et, emailTemplatesEn: eten });
      data.company.defaultWithholdingRate = Number(data.company.defaultWithholdingRate) || 0;
      save(true); applyTheme(); toast('Paramètres enregistrés'); $('#brand-company').textContent = data.company.name;
    };
    drawUpdatePanel();
    $('#backup-now').onclick = async () => { const p = await bridge.createBackup(); toast(p ? 'Sauvegarde créée : ' + p.split(/[\\/]/).pop() : 'Rien à sauvegarder pour l\'instant'); };
    $('#open-backups').onclick = () => bridge.openBackups();
    $('#export-data').onclick = exportAll;
    $('#import-data').onclick = importAll;
    $('#pick-logo').onclick = async () => { try { const l = await bridge.pickLogo(); if (l) { data.company.logo = l; save(true); render(); } } catch (e) { toast(e.message.replace(/^.*Error: /, ''), true); } };
    if ($('#rm-logo')) $('#rm-logo').onclick = () => { data.company.logo = ''; save(true); render(); };
    $('#pick-stamp').onclick = async () => { try { const l = await bridge.pickLogo('Choisir l\'image du cachet / de la signature'); if (l) { data.company.stampImage = l; save(true); render(); } } catch (e) { toast(e.message.replace(/^.*Error: /, ''), true); } };
    if ($('#rm-stamp')) $('#rm-stamp').onclick = () => { data.company.stampImage = ''; save(true); render(); };
    $('#load-demo').onclick = async () => {
      if (data.documents.length && !await confirmDialog('Remplacer toutes les données actuelles par la démonstration ?')) return;
      data = buildDemoData(); save(true); applyTheme(); $('#brand-company').textContent = data.company.name; toast('Jeu de démonstration chargé'); navigate('#/dashboard');
    };
    $('#wipe-data').onclick = async () => {
      if (!await confirmDialog('Effacer TOUS les clients, prestations, devis et factures ? Les paramètres société sont conservés.')) return;
      data.clients = []; data.catalog = []; data.documents = []; data.counters = {}; save(true); toast('Données effacées'); render();
    };
  };

  // ---------- mises à jour ----------
  const upd = { state: 'idle', version: '', percent: 0, message: '', notes: '', app: null };
  bridge.onUpdateEvent(ev => {
    upd.state = ev.state;
    if (ev.version) upd.version = ev.version;
    if (ev.percent != null) upd.percent = ev.percent;
    if (ev.message) upd.message = ev.message;
    if (ev.notes != null) upd.notes = ev.notes;
    drawUpdatePanel();
    drawUpdatePill();
    if (ev.state === 'downloaded' && location.hash !== '#/parametres') toast('Version ' + ev.version + ' prête à installer — voir Paramètres');
  });

  function drawUpdatePill() {
    const pill = $('#update-pill'); if (!pill) return;
    const show = upd.state === 'available' || upd.state === 'downloading' || upd.state === 'downloaded';
    pill.hidden = !show;
    if (show) pill.textContent = upd.state === 'downloaded' ? `Version ${upd.version} prête` : `Version ${upd.version} en cours de téléchargement…`;
  }

  // Notes de version (markdown simple : titres et puces) → HTML sûr
  function notesHtml(md) {
    const lines = String(md || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    let out = '', inList = false;
    for (const l of lines) {
      if (/^[-*] /.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${h(l.slice(2))}</li>`; continue; }
      if (inList) { out += '</ul>'; inList = false; }
      if (/^#+ /.test(l)) out += `<h3>${h(l.replace(/^#+ /, ''))}</h3>`;
      else out += `<p>${h(l)}</p>`;
    }
    if (inList) out += '</ul>';
    return `<div class="notes-md">${out}</div>`;
  }

  function drawUpdatePanel() {
    const el = $('#update-panel'); if (!el) return;
    const a = upd.app || {};
    const isMacUnsigned = a.platform === 'darwin' && !a.macSigned;
    let body = '';
    const btnCheck = `<button class="btn" id="upd-check">Vérifier les mises à jour</button>`;
    if (!a.packaged) body = `<p class="muted small">Mode développement (npm start) : la vérification des mises à jour n'est active que dans l'application installée.</p>${btnCheck}`;
    else if (upd.state === 'checking') body = `<p class="muted">Vérification en cours…</p>`;
    else if (upd.state === 'none') body = `<p>Tu as la dernière version. <span class="muted">(${h(a.version)})</span></p>${btnCheck}`;
    else if (upd.state === 'available') body = `<p><strong>Version ${h(upd.version)} disponible</strong> — téléchargement en cours…</p>${notesHtml(upd.notes)}`;
    else if (upd.state === 'downloading') body = `<p>Téléchargement de la version ${h(upd.version)}… ${upd.percent}%</p><div class="progress"><div style="width:${upd.percent}%"></div></div>`;
    else if (upd.state === 'downloaded') body = `<p><strong>Version ${h(upd.version)} prête à installer.</strong> ${isMacUnsigned ? 'SkanFact se ferme, remplace l\'application dans le dossier Applications et se relance (une dizaine de secondes).' : 'L\'app se ferme, s\'installe et redémarre (quelques secondes).'}</p>
      ${notesHtml(upd.notes)}<button class="btn btn-primary" id="upd-install">Installer et redémarrer</button>`;
    else if (upd.state === 'unconfigured') body = `<p class="muted">Les mises à jour automatiques ne sont pas configurées (package.json → build.publish).</p>${btnCheck}`;
    else if (upd.state === 'error') body = `<p class="small" style="color:var(--danger)">${h(upd.message)}</p><div class="inline">${btnCheck}<button class="btn btn-ghost" id="upd-releases">Voir les versions sur GitHub</button></div>`;
    else if (upd.state === 'token' || !a.hasToken) body = `<p class="muted">Les mises à jour automatiques ne sont pas encore activées sur cet ordinateur : colle ton token GitHub ci-dessous et clique sur Enregistrer.</p>${btnCheck}`;
    else body = btnCheck;
    const tokenBlock = `<div class="token-box">
      <div class="k-label">Accès au dépôt privé</div>
      <p class="small muted">Le dépôt GitHub de SkanFact est privé : un token de lecture est nécessaire pour vérifier les mises à jour. Il est enregistré uniquement sur cet ordinateur.</p>
      <div class="inline"><input type="text" id="upd-token" placeholder="${a.hasToken ? 'Token enregistré ✓ — coller un nouveau pour remplacer' : 'github_pat_… ou ghp_…'}" autocomplete="off" spellcheck="false"><button class="btn btn-sm" id="upd-token-save">Enregistrer</button>${a.hasToken ? '<button class="btn btn-sm btn-ghost" id="upd-token-clear">Retirer</button>' : ''}</div>
    </div>`;
    el.innerHTML = `<div class="update-head"><div><div class="k-label">Version installée</div><div class="ver">${h(a.version || '…')}</div></div><button class="btn btn-sm btn-ghost" id="upd-changelog">Nouveautés</button></div>${body}${tokenBlock}`;
    $('#upd-changelog').onclick = showChangelog;
    $('#upd-token-save').onclick = async () => {
      const t = $('#upd-token').value.trim(); if (!t) return toast('Colle un token d\'abord', true);
      if (!/^(github_pat_|ghp_|gho_|ghs_)[A-Za-z0-9_]+$/.test(t)) return toast('Ce n\'est pas un token GitHub : il commence par github_pat_ ou ghp_', true);
      const r = await bridge.updateSetToken(t); upd.app.hasToken = r.hasToken; upd.state = 'idle'; toast('Token enregistré');
      runCheck();
    };
    if ($('#upd-token-clear')) $('#upd-token-clear').onclick = async () => { const r = await bridge.updateSetToken(''); upd.app.hasToken = r.hasToken; upd.state = 'idle'; drawUpdatePanel(); };
    if ($('#upd-check')) $('#upd-check').onclick = runCheck;
    if ($('#upd-releases')) $('#upd-releases').onclick = () => bridge.updateOpenReleases();
    if ($('#upd-install')) $('#upd-install').onclick = async () => {
      const b = $('#upd-install'); b.disabled = true; b.textContent = 'Installation…';
      const r = await bridge.updateInstall();
      if (r && r.state === 'error') { upd.state = 'error'; upd.message = r.message; drawUpdatePanel(); }
    };
  }

  async function runCheck() {
    if (upd.state === 'downloading' || upd.state === 'downloaded') return drawUpdatePanel();
    upd.state = 'checking'; drawUpdatePanel();
    const r = await bridge.updateCheck();
    if (r.state === 'error') { upd.state = 'error'; upd.message = r.message; drawUpdatePanel(); }
    else if (r.state === 'dev') { upd.state = 'idle'; drawUpdatePanel(); toast('Disponible uniquement dans l\'application installée'); }
    else if (r.state === 'unconfigured') { upd.state = 'unconfigured'; drawUpdatePanel(); }
    else if (r.state === 'token') { upd.state = 'token'; drawUpdatePanel(); const i = $('#upd-token'); if (i) i.focus(); }
    // sinon : les événements (none / available / downloading / downloaded) mettent le panneau à jour
  }

  async function showChangelog() {
    const md = await bridge.changelog();
    const body = md ? notesHtml(md.replace(/^# .*\n/, '').replace(/^Format[\s\S]*?\n\n/, '')) : '<p class="muted">Historique indisponible.</p>';
    modal(`<h2>Nouveautés</h2><div class="changelog">${body}</div><div class="modal-actions"><button class="btn" data-close>Fermer</button></div>`);
  }

  // ---------- actions du menu de l'application ----------
  bridge.onMenuAction(name => {
    const click = sel => { const b = $(sel); if (b) b.click(); else toast('Ouvre d\'abord un devis ou une facture.', true); };
    if (name === 'new-devis') navigate('#/doc/new/devis');
    else if (name === 'new-facture') navigate('#/doc/new/facture');
    else if (name === 'new-avoir') navigate('#/doc/new/avoir');
    else if (name === 'save') click('#save');
    else if (name === 'pdf') click('#pdf');
    else if (name === 'settings') navigate('#/parametres');
    else if (name === 'export-data') exportAll();
    else if (name === 'import-data') importAll();
    else if (name === 'changelog') showChangelog();
    else if (name === 'search') openPalette();
    else if (name.startsWith('go:')) navigate('#/' + name.slice(3));
  });

  // ---------- jeu de données de démonstration ----------
  function buildDemoData() {
    const d = migrate(null);
    Object.assign(d.company, { phone: '+216 55 123 456', email: 'contact@skancyber.tn', website: 'www.skancyber.tn', bank: 'BIAT — Agence El Manar', rib: '08 006 0000123456789 12', rc: 'B01234562024', capital: '1 000 DT' });
    const mk = (name, matricule, address, phone, email, withholdingRate) => ({ id: C.uid(), name, matricule, address, phone, email, notes: '', withholdingRate: withholdingRate == null ? '' : withholdingRate });
    d.clients = [
      mk('Clinique Les Jasmins', '1234567A/M/000', 'Avenue Habib Bourguiba\n2080 Ariana', '+216 71 700 100', 'direction@clinique-jasmins.tn', 1.5),
      mk('Pharmacie Centrale El Menzah', '2345678B/A/000', '12 rue Ibn Khaldoun\n1004 El Menzah', '+216 71 234 567', 'pharmacie.menzah@gmail.com'),
      mk('Cabinet Ben Salah Avocats', '3456789C/P/000', 'Immeuble Le Palmier, Lac 2\n1053 Tunis', '+216 71 960 200', 'contact@bensalah-avocats.tn', 1.5),
      mk('Lemon Beach Hammamet', '4567890D/A/000', 'Zone touristique\n8050 Hammamet', '+216 72 280 300', 'hello@lemonbeach.tn'),
      mk('Restaurant Dar El Jeld', '5678901E/A/000', '5 rue Dar El Jeld, Médina\n1006 Tunis', '+216 71 560 916', 'reservation@dareljeld.tn'),
      mk('Mohamed Trabelsi', 'CIN 09876543', 'Résidence Les Oliviers, Bloc B\n2092 El Manar', '+216 98 765 432', 'm.trabelsi@outlook.com', 0)
    ];
    const cat = (label, description, unitPrice, vatRate, unit) => ({ id: C.uid(), label, description, unitPrice, vatRate, unit });
    d.catalog = [
      cat('Audit de sécurité réseau', 'Cartographie du réseau, scan de vulnérabilités, revue de configuration, rapport et plan d\'action', 1200, 19, 'forfait'),
      cat('Test d\'intrusion applicatif', 'Test en boîte grise sur une application web, rapport détaillé avec preuves et recommandations', 2500, 19, 'forfait'),
      cat('Installation et configuration pare-feu', 'Mise en place d\'un pare-feu (matériel fourni séparément), règles, VPN, journalisation', 850, 19, 'u'),
      cat('Sauvegarde externalisée', 'Mise en place d\'une sauvegarde chiffrée automatique avec vérification mensuelle', 90, 19, 'mois'),
      cat('Maintenance et supervision', 'Surveillance des équipements, mises à jour de sécurité, intervention sous 24 h', 250, 19, 'mois'),
      cat('Formation sensibilisation cybersécurité', 'Session de 3 h pour les équipes : phishing, mots de passe, bonnes pratiques', 150, 7, 'h'),
      cat('Installation poste de travail', 'Préparation, sécurisation et mise en réseau d\'un poste', 120, 19, 'u'),
      cat('Déplacement hors Grand Tunis', 'Frais de déplacement', 60, 19, 'u')
    ];
    const cl = d.clients, k = d.catalog;
    const line = (item, qty, price) => ({ label: item.label, description: item.description, qty, unit: item.unit, unitPrice: price != null ? price : item.unitPrice, vatRate: item.vatRate });
    const daysAgo = n => C.addDays(C.today(), -n);
    const specs = [
      // [type, client, jours, statut, objet, lignes, remise, notes, devisLié]
      ['devis', 0, 95, 'accepté', 'Sécurisation du réseau de la clinique', [line(k[0], 1), line(k[2], 2), line(k[5], 3)], 5, 'Matériel pare-feu facturé séparément après validation du devis.'],
      ['facture', 0, 80, 'payée', 'Sécurisation du réseau de la clinique', [line(k[0], 1), line(k[2], 2), line(k[5], 3)], 5, 'Paiement par virement à réception.', 0],
      ['devis', 2, 70, 'accepté', 'Test d\'intrusion du portail clients', [line(k[1], 1), line(k[5], 2)], 0, ''],
      ['facture', 2, 62, 'payée', 'Test d\'intrusion du portail clients', [line(k[1], 1), line(k[5], 2)], 0, 'Rapport remis le jour de la facturation.', 2],
      ['devis', 3, 55, 'refusé', 'Refonte du réseau Wi-Fi et supervision', [line(k[0], 1), line(k[4], 12), line(k[7], 2)], 10, ''],
      ['devis', 1, 40, 'accepté', 'Sauvegarde et maintenance mensuelle', [line(k[3], 12), line(k[4], 12), line(k[6], 3)], 0, 'Engagement 12 mois, facturation mensuelle.'],
      ['facture', 1, 35, 'payée', 'Sauvegarde et maintenance — mois 1', [line(k[3], 1), line(k[4], 1), line(k[6], 3)], 0, '', 5],
      ['facture', 1, 5, 'envoyée', 'Sauvegarde et maintenance — mois 2', [line(k[3], 1), line(k[4], 1)], 0, ''],
      ['facture', 4, 48, 'envoyée', 'Installation pare-feu et sensibilisation', [line(k[2], 1), line(k[5], 3), line(k[7], 1)], 0, 'Merci de régler avant l\'échéance.'],
      ['devis', 5, 20, 'envoyé', 'Sécurisation du réseau domestique', [line(k[6], 2, 100), line(k[3], 12, 60)], 0, 'Tarif particulier.'],
      ['devis', 4, 12, 'envoyé', 'Audit annuel et test d\'intrusion', [line(k[0], 1), line(k[1], 1)], 15, 'Remise fidélité 15 %.'],
      ['facture', 3, 9, 'brouillon', 'Déplacement et diagnostic', [line(k[7], 1), line(k[6], 1)], 0, ''],
      ['devis', 2, 3, 'brouillon', 'Formation des nouveaux collaborateurs', [line(k[5], 6)], 0, ''],
      ['facture', 0, 2, 'envoyée', 'Extension de supervision — 6 mois', [line(k[4], 6), line(k[3], 6)], 0, '']
    ];
    // on crée d'abord dans l'ordre chronologique pour une numérotation cohérente
    const created = [];
    specs.slice().sort((a, b) => b[2] - a[2]).forEach(sp => {
      const [type, ci, ago, status, subject, lines, discountRate, notes, fromIdx] = sp;
      const date = daysAgo(ago);
      const isDraftInvoice = type === 'facture' && status === 'brouillon';
      const doc = { id: C.uid(), type, number: isDraftInvoice ? '' : C.nextNumber(d, type, date), date, dueDate: C.addDays(date, type === 'devis' ? d.company.quoteValidityDays : d.company.paymentTermsDays),
        clientId: cl[ci].id, subject, reference: '', lines, discountRate, applyStamp: type === 'facture', status, notes, payments: [],
        withholdingRate: type === 'facture' ? (Number(cl[ci].withholdingRate) || 0) : 0, createdAt: Date.now() - ago * 86400000 };
      if (fromIdx != null) { const q = created.find(x => x.spec === specs[fromIdx]); if (q) { doc.fromQuoteId = q.doc.id; doc.fromQuoteNumber = q.doc.number; } }
      created.push({ spec: sp, doc });
      d.documents.push(doc);
    });
    // une facture en retard : échéance dépassée
    const late = d.documents.find(x => x.type === 'facture' && x.status === 'envoyée' && x.subject.startsWith('Installation pare-feu'));
    if (late) late.dueDate = daysAgo(18);
    // un paiement partiel sur la facture de supervision
    const partial = d.documents.find(x => x.type === 'facture' && x.subject.startsWith('Extension de supervision'));
    if (partial) partial.payments.push({ id: C.uid(), date: daysAgo(1), amount: 1000, method: 'virement', reference: 'VIR 2026-0912', note: 'Acompte reçu' });
    // un avoir partiel (remise commerciale) sur la facture de maintenance mois 2
    const m2 = d.documents.find(x => x.type === 'facture' && x.subject.endsWith('mois 2'));
    if (m2) {
      const av = { id: C.uid(), type: 'avoir', number: C.nextNumber(d, 'avoir', daysAgo(2)), date: daysAgo(2), clientId: m2.clientId, creditOf: m2.id, creditOfNumber: m2.number, creditReason: 'Geste commercial : intervention tardive',
        subject: `Avoir sur facture ${m2.number}`, lines: [line(k[3], 1)], discountRate: 0, applyStamp: false, status: 'émis', notes: '', payments: [], withholdingRate: 0, createdAt: Date.now() };
      d.documents.push(av);
    }
    // un contrat mensuel dû aujourd'hui, un modèle de devis, un texte prédéfini
    d.recurring.push({ id: C.uid(), clientId: cl[1].id, subject: 'Sauvegarde et maintenance — {mois}', reference: '', lines: [line(k[3], 1), line(k[4], 1)], discountRate: 0, withholdingRate: 0, notes: 'Contrat annuel, facturation mensuelle.', every: 'month', day: 1, nextDate: C.today(), lastIssued: daysAgo(30), active: true, createdAt: Date.now() });
    d.templates.push({ id: C.uid(), name: 'Audit standard', type: 'devis', subject: 'Audit de sécurité et plan d\'action', lines: [line(k[0], 1), line(k[5], 2), line(k[7], 1)], discountRate: 0, notes: 'Rapport remis sous 10 jours ouvrés après l\'intervention.' });
    d.snippets.push({ id: C.uid(), name: 'Garantie', text: 'Prestations garanties 3 mois. Toute intervention hors périmètre fera l\'objet d\'un devis complémentaire.' });
    return migrate(d); // convertit les « payée » en paiements
  }

  // ---------- import / export ----------
  async function exportAll() { const p = await bridge.exportData(data); if (p) toast('Exporté : ' + p.split(/[\\/]/).pop()); }
  async function importAll() {
    if (!await confirmDialog('Importer un fichier remplacera toutes les données actuelles (une sauvegarde de l\'état actuel est faite avant). Continuer ?')) return;
    try { const d = await bridge.importData(); if (d) { data = migrate(d); applyTheme(); $('#brand-company').textContent = data.company.name; toast('Données importées'); render(); } }
    catch (e) { toast('Import impossible : ' + e.message.replace(/^.*Error: /, ''), true); }
  }
  $('#btn-export-data').onclick = exportAll;
  $('#btn-import-data').onclick = importAll;

  // ---------- démarrage ----------
  (async () => {
    const loaded = await bridge.loadData();
    const raw = loaded && loaded.data;
    data = migrate(raw);
    if (raw && (raw.version || 1) < 3) save(true); // données migrées vers le nouveau format : on enregistre tout de suite
    applyTheme();
    $('#brand-company').textContent = data.company.name;
    bridge.updateVersion().then(v => {
      upd.app = v; const el = $('#app-version'); if (el) el.textContent = 'v' + v.version;
      if (v.lastUpdate) {
        if (v.lastUpdate.ok) toast('SkanFact mis à jour en version ' + v.version);
        else modal(`<h2>Mise à jour non installée</h2><p>${h(v.lastUpdate.message || 'Erreur inconnue')}.</p><p class="small muted">Tu peux installer la nouvelle version à la main depuis la page des versions, ou réessayer depuis Paramètres → Mises à jour.</p>
          <div class="modal-actions"><button class="btn" data-close>Fermer</button><button class="btn btn-primary" id="open-rel">Voir les versions</button></div>`, (root) => { $('#open-rel', root).onclick = () => bridge.updateOpenReleases(); });
      }
    });
    $('#update-pill').onclick = () => navigate('#/parametres');
    if (!location.hash) location.hash = '#/dashboard';
    render();
    if (loaded && loaded.corruptFile) {
      modal(`<h2>Fichier de données illisible</h2>
        <p>Le fichier de données n'a pas pu être lu. Il n'a pas été effacé : il a été renommé en<br><code>${h(loaded.corruptFile.split(/[\\/]/).pop())}</code>.</p>
        <p>Pour retrouver tes données : <strong>Importer</strong> puis choisis la sauvegarde la plus récente dans le dossier <code>backups</code>.</p>
        <div class="modal-actions"><button class="btn" data-close>Plus tard</button><button class="btn" id="c-open">Ouvrir le dossier des sauvegardes</button><button class="btn btn-primary" id="c-import">Importer une sauvegarde</button></div>`,
        (root, close) => { $('#c-open', root).onclick = () => bridge.openBackups(); $('#c-import', root).onclick = () => { close(); importAll(); }; });
    }
  })();
})();
