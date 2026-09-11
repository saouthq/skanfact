/* SkanFact — interface (JS pur, sans framework) */
(function () {
  const C = window.SkanCore;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const h = C.escapeHtml;

  // ---------- pont Electron (avec repli navigateur pour les tests) ----------
  const bridge = window.skanfact || {
    _mem: null,
    loadData: async () => { try { return JSON.parse(localStorage.getItem('skanfact')); } catch { return null; } },
    saveData: async (d) => { localStorage.setItem('skanfact', JSON.stringify(d)); return true; },
    dataPath: async () => 'localStorage (mode navigateur)',
    exportData: async () => null,
    importData: async () => null,
    pickLogo: async () => null,
    exportPdf: async (html) => { const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print(); return null; },
    openPath: async () => {}, showInFolder: async () => {},
    updateVersion: async () => ({ version: 'dev', packaged: false, platform: 'browser', macSigned: false }),
    updateCheck: async () => ({ state: 'dev' }), updateDownload: async () => ({ state: 'dev' }), updateInstall: async () => true, updateSetToken: async () => ({ hasToken: false }),
    onUpdateEvent: () => {}
  };

  // ---------- état ----------
  let data = null;
  let saveTimer = null;

  function save(immediate) {
    clearTimeout(saveTimer);
    const doSave = () => bridge.saveData(data).catch(e => toast('Erreur de sauvegarde : ' + e.message, true));
    if (immediate) return doSave();
    saveTimer = setTimeout(doSave, 300);
  }

  function migrate(d) {
    const base = JSON.parse(JSON.stringify(C.DEFAULT_DATA));
    if (!d) return base;
    return {
      ...base, ...d,
      company: { ...base.company, ...(d.company || {}) },
      clients: d.clients || [], catalog: d.catalog || [], documents: d.documents || [], counters: d.counters || {}
    };
  }

  const clientById = id => data.clients.find(c => c.id === id) || null;
  const docById = id => data.documents.find(d => d.id === id) || null;

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

  function confirmDialog(msg) {
    return new Promise(resolve => {
      modal(`<h2>Confirmation</h2><p>${h(msg)}</p>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-danger" id="ok">Confirmer</button></div>`,
        (root, close) => { $('#ok', root).onclick = () => { close(); resolve(true); }; $('[data-close]', root).onclick = () => { close(); resolve(false); }; });
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

  function statusBadge(doc) {
    let s = doc.status || 'brouillon';
    let cls = s;
    if (doc.type === 'facture' && s === 'envoyée' && doc.dueDate && doc.dueDate < C.today()) { s = 'en retard'; cls = 'retard'; }
    return `<span class="badge ${cls}">${h(s)}</span>`;
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
      active = type === 'facture' ? 'factures' : 'devis';
    }
    $$('nav a').forEach(a => a.classList.toggle('active', a.dataset.route === active));
    (routes[name] || routes.dashboard)(parts.slice(1));
    $('#view').scrollTop = 0;
  }
  window.addEventListener('hashchange', render);

  // ---------- Accueil ----------
  routes.dashboard = () => {
    const cur = data.company.currency;
    const month = C.today().slice(0, 7);
    const year = C.today().slice(0, 4);
    const invoices = data.documents.filter(d => d.type === 'facture' && d.status !== 'annulée' && d.status !== 'brouillon');
    const sum = list => list.reduce((s, d) => s + C.computeTotals(d, data.company).totalTTC, 0);
    const caMonth = sum(invoices.filter(d => d.date && d.date.startsWith(month)));
    const caYear = sum(invoices.filter(d => d.date && d.date.startsWith(year)));
    const unpaid = invoices.filter(d => d.status === 'envoyée');
    const late = unpaid.filter(d => d.dueDate && d.dueDate < C.today());
    const pendingQuotes = data.documents.filter(d => d.type === 'devis' && d.status === 'envoyé');
    const recent = data.documents.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);

    $('#view').innerHTML = `
      <div class="page-head"><h1>Accueil</h1>
        <div class="actions">
          <button class="btn" id="new-devis">+ Nouveau devis</button>
          <button class="btn btn-primary" id="new-facture">+ Nouvelle facture</button>
        </div></div>
      <div class="stats">
        <div class="stat"><div class="lbl">CA du mois (TTC)</div><div class="val">${C.money(caMonth, cur)}</div><div class="sub">factures émises</div></div>
        <div class="stat"><div class="lbl">CA de l'année (TTC)</div><div class="val">${C.money(caYear, cur)}</div><div class="sub">${year}</div></div>
        <div class="stat"><div class="lbl">Impayées</div><div class="val">${C.money(sum(unpaid), cur)}</div><div class="sub">${unpaid.length} facture(s), ${late.length} en retard</div></div>
        <div class="stat"><div class="lbl">Devis en attente</div><div class="val">${C.money(sum(pendingQuotes), cur)}</div><div class="sub">${pendingQuotes.length} devis envoyé(s)</div></div>
      </div>
      <div class="panel"><h2>Documents récents</h2>${docTable(recent)}</div>`;
    $('#new-devis').onclick = () => navigate('#/doc/new/devis');
    $('#new-facture').onclick = () => navigate('#/doc/new/facture');
    bindDocTable();
  };

  // ---------- listes devis / factures ----------
  function docTable(list) {
    if (!list.length) return `<div class="empty">Aucun document.</div>`;
    const cur = data.company.currency;
    return `<table class="list"><thead><tr><th>Numéro</th><th>Type</th><th>Client</th><th>Date</th><th>Statut</th><th class="r">Total TTC</th><th></th></tr></thead><tbody>
      ${list.map(d => `<tr class="clickable" data-id="${d.id}">
        <td><strong>${h(d.number)}</strong></td><td>${d.type === 'devis' ? 'Devis' : 'Facture'}</td>
        <td>${h((clientById(d.clientId) || {}).name || '—')}</td><td>${C.fmtDate(d.date)}</td>
        <td>${statusBadge(d)}</td><td class="r">${C.money(C.computeTotals(d, data.company).totalTTC, cur)}</td>
        <td class="actions"><button class="btn btn-sm" data-pdf="${d.id}">PDF</button></td></tr>`).join('')}
    </tbody></table>`;
  }
  function bindDocTable() {
    $$('tr.clickable[data-id]').forEach(tr => tr.onclick = e => { if (e.target.closest('button')) return; navigate('#/doc/' + tr.dataset.id); });
    $$('button[data-pdf]').forEach(b => b.onclick = () => exportPdf(docById(b.dataset.pdf)));
  }

  function listView(type) {
    const isQ = type === 'devis';
    let q = '', st = '';
    const draw = () => {
      const list = data.documents.filter(d => d.type === type)
        .filter(d => !st || d.status === st)
        .filter(d => !q || [d.number, (clientById(d.clientId) || {}).name, d.subject].join(' ').toLowerCase().includes(q))
        .sort((a, b) => (b.number || '').localeCompare(a.number || ''));
      $('#list-wrap').innerHTML = docTable(list);
      bindDocTable();
    };
    $('#view').innerHTML = `
      <div class="page-head"><h1>${isQ ? 'Devis' : 'Factures'}</h1>
        <div class="actions"><button class="btn btn-primary" id="new">+ ${isQ ? 'Nouveau devis' : 'Nouvelle facture'}</button></div></div>
      <div class="filters">
        <input type="text" id="q" placeholder="Rechercher (numéro, client, objet)…">
        <select id="st"><option value="">Tous les statuts</option>${C.STATUSES[type].map(s => `<option>${s}</option>`).join('')}</select>
      </div>
      <div id="list-wrap"></div>`;
    $('#new').onclick = () => navigate('#/doc/new/' + type);
    $('#q').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
    $('#st').onchange = e => { st = e.target.value; draw(); };
    draw();
  }
  routes.devis = () => listView('devis');
  routes.factures = () => listView('facture');

  // ---------- éditeur de document ----------
  function newDocument(type) {
    const date = C.today();
    const days = type === 'devis' ? data.company.quoteValidityDays : data.company.paymentTermsDays;
    return {
      id: C.uid(), type, number: '', date, dueDate: C.addDays(date, days), clientId: '', subject: '', reference: '',
      lines: [{ label: '', description: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19 }],
      discountRate: 0, applyStamp: true, status: 'brouillon', notes: '', createdAt: Date.now()
    };
  }

  routes.doc = (parts) => {
    let doc, isNew = false;
    if (parts[0] === 'new') { doc = newDocument(parts[1] === 'facture' ? 'facture' : 'devis'); isNew = true; }
    else { doc = docById(parts[0]); if (!doc) return navigate('#/dashboard'); doc = JSON.parse(JSON.stringify(doc)); }
    const isQ = doc.type === 'devis';
    const cur = data.company.currency;

    const clientOptions = () => `<option value="">— Choisir un client —</option>` +
      data.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}" ${c.id === doc.clientId ? 'selected' : ''}>${h(c.name)}</option>`).join('');

    $('#view').innerHTML = `
      <div class="page-head">
        <h1>${isNew ? (isQ ? 'Nouveau devis' : 'Nouvelle facture') : (isQ ? 'Devis ' : 'Facture ') + h(doc.number)}</h1>
        <div class="actions">
          ${!isNew ? `<button class="btn" id="dup">Dupliquer</button>` : ''}
          ${!isNew && isQ ? `<button class="btn" id="convert">Convertir en facture</button>` : ''}
          ${!isNew ? `<button class="btn btn-danger" id="del">Supprimer</button>` : ''}
          <button class="btn" id="pdf">Exporter en PDF</button>
          <button class="btn btn-primary" id="save">Enregistrer</button>
        </div></div>
      <div class="editor">
        <div>
          <div class="panel"><h2>Informations</h2>
            <form id="f-head" class="grid-3">
              <label class="field">Client
                <div class="inline"><select name="clientId">${clientOptions()}</select><button type="button" class="btn btn-sm" id="quick-client">+</button></div>
              </label>
              ${field('Date', 'date', doc.date, 'date')}
              ${field(isQ ? 'Valable jusqu\'au' : 'Échéance', 'dueDate', doc.dueDate, 'date')}
              <label class="field span-2">Objet<input type="text" name="subject" value="${h(doc.subject)}" placeholder="Ex : Audit de sécurité du réseau"></label>
              ${field('Référence (optionnel)', 'reference', doc.reference || '')}
              <label class="field">Statut<select name="status">${C.STATUSES[doc.type].map(s => `<option ${s === doc.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
              ${field('Remise globale (%)', 'discountRate', doc.discountRate || 0, 'number', 'min="0" max="100" step="0.5" class="num"')}
              ${!isQ ? `<label class="check" style="align-self:end"><input type="checkbox" name="applyStamp" ${doc.applyStamp !== false ? 'checked' : ''}> Timbre fiscal (${C.money(data.company.stampFee, cur)})</label>` : ''}
            </form>
          </div>
          <div class="panel"><h2>Lignes</h2>
            <div class="catalog-pick">
              <select id="cat-pick"><option value="">Ajouter depuis le catalogue…</option>${data.catalog.map(c => `<option value="${c.id}">${h(c.label)} — ${C.money(c.unitPrice, cur)}</option>`).join('')}</select>
              <button class="btn btn-sm" id="add-line">+ Ligne vide</button>
            </div>
            <table class="lines-edit"><thead><tr><th style="width:38%">Désignation / description</th><th style="width:9%">Qté</th><th style="width:9%">Unité</th><th style="width:15%">P.U. HT</th><th style="width:13%">TVA</th><th class="r">Total HT</th><th></th></tr></thead>
              <tbody id="lines"></tbody></table>
            <div class="totals-box" id="totals"></div>
          </div>
          <div class="panel"><h2>Notes (affichées sur le document)</h2>
            <textarea id="notes" placeholder="Conditions de paiement, mentions particulières…">${h(doc.notes || '')}</textarea>
          </div>
        </div>
        <div class="preview"><iframe id="preview" title="Aperçu"></iframe></div>
      </div>`;

    // --- lignes
    const linesBody = $('#lines');
    function drawLines() {
      linesBody.innerHTML = doc.lines.map((l, i) => `<tr data-i="${i}">
        <td><input type="text" data-k="label" value="${h(l.label)}" placeholder="Désignation">
            <textarea data-k="description" placeholder="Description (optionnel)">${h(l.description || '')}</textarea></td>
        <td><input type="number" class="num" data-k="qty" value="${l.qty}" step="0.01" min="0"></td>
        <td><input type="text" data-k="unit" value="${h(l.unit || '')}" placeholder="u, h, j"></td>
        <td><input type="number" class="num" data-k="unitPrice" value="${l.unitPrice}" step="0.001" min="0"></td>
        <td><select data-k="vatRate">${C.VAT_RATES.map(r => `<option value="${r}" ${Number(l.vatRate) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select></td>
        <td class="total" data-total="${i}"></td>
        <td><button class="btn btn-ghost btn-sm" data-rm="${i}" title="Supprimer">✕</button></td></tr>`).join('');
      $$('[data-k]', linesBody).forEach(el => el.oninput = () => {
        const i = Number(el.closest('tr').dataset.i);
        doc.lines[i][el.dataset.k] = el.type === 'number' ? Number(el.value) : el.value;
        refreshTotals();
      });
      $$('[data-rm]', linesBody).forEach(b => b.onclick = () => { doc.lines.splice(Number(b.dataset.rm), 1); if (!doc.lines.length) doc.lines.push({ label: '', qty: 1, unitPrice: 0, vatRate: 19 }); drawLines(); refreshTotals(); });
      refreshTotals();
    }
    $('#add-line').onclick = () => { doc.lines.push({ label: '', description: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19 }); drawLines(); $$('input[data-k=label]', linesBody).pop().focus(); };
    $('#cat-pick').onchange = e => {
      const it = data.catalog.find(c => c.id === e.target.value); if (!it) return;
      if (doc.lines.length === 1 && !doc.lines[0].label && !doc.lines[0].unitPrice) doc.lines = [];
      doc.lines.push({ label: it.label, description: it.description || '', qty: 1, unit: it.unit || '', unitPrice: it.unitPrice, vatRate: it.vatRate });
      e.target.value = ''; drawLines();
    };

    // --- en-tête
    const head = $('#f-head');
    head.oninput = head.onchange = () => { Object.assign(doc, formValues(head)); refreshTotals(); };
    $('#notes').oninput = e => { doc.notes = e.target.value; schedulePreview(); };
    $('#quick-client').onclick = () => clientForm(null, c => { $('select[name=clientId]', head).innerHTML = clientOptions(); $('select[name=clientId]', head).value = c.id; doc.clientId = c.id; schedulePreview(); });

    // --- totaux + aperçu
    let previewTimer = null;
    function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(drawPreview, 250); }
    function drawPreview() {
      const html = C.documentHtml({ ...doc, number: doc.number || (isQ ? 'DEV-…' : 'FAC-…') }, clientById(doc.clientId), data.company, { preview: true, zoom: Math.max(0.3, Math.floor(($('#preview').clientWidth - 2) / 794 * 100) / 100) });
      $('#preview').srcdoc = html;
    }
    function refreshTotals() {
      const t = C.computeTotals(doc, data.company);
      t.lines.forEach((l, i) => { const c = $(`[data-total="${i}"]`); if (c) c.textContent = C.money(l.ht); });
      $('#totals').innerHTML = `<table>
        <tr><td>Total HT</td><td>${C.money(t.totalHT, cur)}</td></tr>
        ${t.discount ? `<tr><td>Remise ${t.discountRate}%</td><td>- ${C.money(t.discount, cur)}</td></tr><tr><td>Net HT</td><td>${C.money(t.netHT, cur)}</td></tr>` : ''}
        <tr><td>TVA</td><td>${C.money(t.totalVAT, cur)}</td></tr>
        ${t.stamp ? `<tr><td>Timbre fiscal</td><td>${C.money(t.stamp, cur)}</td></tr>` : ''}
        <tr class="grand"><td>Total TTC</td><td>${C.money(t.totalTTC, cur)}</td></tr></table>`;
      schedulePreview();
    }

    // --- actions
    function validate() {
      if (!doc.clientId) { toast('Choisis un client.', true); return false; }
      if (!doc.lines.some(l => l.label && l.label.trim())) { toast('Ajoute au moins une ligne avec une désignation.', true); return false; }
      return true;
    }
    function persist() {
      if (!validate()) return false;
      if (!doc.number) doc.number = C.nextNumber(data, doc.type, doc.date);
      const idx = data.documents.findIndex(d => d.id === doc.id);
      const clean = JSON.parse(JSON.stringify(doc));
      if (idx >= 0) data.documents[idx] = clean; else data.documents.push(clean);
      save(true);
      return true;
    }
    $('#save').onclick = () => { if (persist()) { toast('Enregistré : ' + doc.number); if (isNew) navigate('#/doc/' + doc.id); else render(); } };
    $('#pdf').onclick = () => { if (persist()) exportPdf(doc); };
    if ($('#del')) $('#del').onclick = async () => {
      if (!await confirmDialog(`Supprimer ${doc.number} ? Le numéro ne sera pas réutilisé.`)) return;
      data.documents = data.documents.filter(d => d.id !== doc.id); save(true); navigate(isQ ? '#/devis' : '#/factures');
    };
    if ($('#dup')) $('#dup').onclick = () => {
      const copy = { ...JSON.parse(JSON.stringify(doc)), id: C.uid(), number: '', status: 'brouillon', date: C.today(), createdAt: Date.now(), fromQuoteId: undefined, fromQuoteNumber: undefined };
      copy.dueDate = C.addDays(copy.date, isQ ? data.company.quoteValidityDays : data.company.paymentTermsDays);
      copy.number = C.nextNumber(data, copy.type, copy.date);
      data.documents.push(copy); save(true); toast('Copie créée : ' + copy.number); navigate('#/doc/' + copy.id);
    };
    if ($('#convert')) $('#convert').onclick = () => {
      const inv = { ...JSON.parse(JSON.stringify(doc)), id: C.uid(), type: 'facture', number: '', status: 'brouillon', date: C.today(), applyStamp: true, createdAt: Date.now(), fromQuoteId: doc.id, fromQuoteNumber: doc.number };
      inv.dueDate = C.addDays(inv.date, data.company.paymentTermsDays);
      inv.number = C.nextNumber(data, 'facture', inv.date);
      const orig = docById(doc.id); if (orig && orig.status !== 'accepté') orig.status = 'accepté';
      data.documents.push(inv); save(true); toast('Facture créée : ' + inv.number); navigate('#/doc/' + inv.id);
    };

    drawLines();
  };

  async function exportPdf(doc) {
    const html = C.documentHtml(doc, clientById(doc.clientId), data.company);
    const client = (clientById(doc.clientId) || {}).name || '';
    const safe = s => String(s).replace(/[^\w\-àâäéèêëïîôöùûüç ]/gi, '').trim().replace(/\s+/g, '_');
    const name = `${doc.number}${client ? '_' + safe(client) : ''}.pdf`;
    try {
      const p = await bridge.exportPdf(html, name);
      if (p) {
        toast('PDF enregistré : ' + p.split(/[\\/]/).pop());
        if (data.company.openAfterExport !== false) bridge.openPath(p);
      }
    } catch (e) { toast('Erreur PDF : ' + e.message, true); }
  }

  // ---------- Clients ----------
  function clientForm(client, done) {
    const c = client || { id: C.uid(), name: '', matricule: '', address: '', phone: '', email: '', notes: '' };
    modal(`<h2>${client ? 'Modifier le client' : 'Nouveau client'}</h2>
      <form id="cf" class="grid-2">
        <label class="field span-2">Nom / Raison sociale<input type="text" name="name" value="${h(c.name)}" required></label>
        ${field('Matricule fiscal / CIN', 'matricule', c.matricule)}
        ${field('Téléphone', 'phone', c.phone)}
        ${field('Email', 'email', c.email, 'email')}
        <label class="field span-2">Adresse<textarea name="address">${h(c.address)}</textarea></label>
        <label class="field span-2">Notes internes<textarea name="notes">${h(c.notes || '')}</textarea></label>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = () => {
          const v = formValues($('#cf', root));
          if (!v.name.trim()) return toast('Le nom est obligatoire.', true);
          Object.assign(c, v);
          if (!client) data.clients.push(c);
          save(true); close(); if (done) done(c);
        };
      });
  }

  routes.clients = () => {
    let q = '';
    const draw = () => {
      const list = data.clients.filter(c => !q || [c.name, c.matricule, c.email, c.phone].join(' ').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
      $('#list-wrap').innerHTML = list.length ? `<table class="list"><thead><tr><th>Nom</th><th>MF / CIN</th><th>Contact</th><th class="r">Documents</th><th></th></tr></thead><tbody>
        ${list.map(c => `<tr><td><strong>${h(c.name)}</strong><div class="small muted">${h((c.address || '').split('\n')[0])}</div></td><td>${h(c.matricule)}</td>
          <td>${h(c.phone)}${c.phone && c.email ? ' · ' : ''}${h(c.email)}</td>
          <td class="r">${data.documents.filter(d => d.clientId === c.id).length}</td>
          <td class="actions"><button class="btn btn-sm" data-edit="${c.id}">Modifier</button> <button class="btn btn-sm btn-danger" data-del="${c.id}">Supprimer</button></td></tr>`).join('')}
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
    const cur = data.company.currency;
    const draw = () => {
      const list = data.catalog.slice().sort((a, b) => a.label.localeCompare(b.label));
      $('#list-wrap').innerHTML = list.length ? `<table class="list"><thead><tr><th>Désignation</th><th class="r">P.U. HT</th><th class="r">TVA</th><th>Unité</th><th></th></tr></thead><tbody>
        ${list.map(c => `<tr><td><strong>${h(c.label)}</strong><div class="small muted">${h(c.description || '')}</div></td><td class="r">${C.money(c.unitPrice, cur)}</td><td class="r">${c.vatRate}%</td><td>${h(c.unit || '')}</td>
          <td class="actions"><button class="btn btn-sm" data-edit="${c.id}">Modifier</button> <button class="btn btn-sm btn-danger" data-del="${c.id}">Supprimer</button></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty">Catalogue vide. Ajoute tes prestations récurrentes pour remplir les devis en un clic.</div>`;
      $$('[data-edit]').forEach(b => b.onclick = () => catalogForm(data.catalog.find(c => c.id === b.dataset.edit), draw));
      $$('[data-del]').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer cette prestation ?')) { data.catalog = data.catalog.filter(c => c.id !== b.dataset.del); save(true); draw(); } });
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Catalogue de prestations</h1><div class="actions"><button class="btn btn-primary" id="new">+ Nouvelle prestation</button></div></div><div id="list-wrap"></div>`;
    $('#new').onclick = () => catalogForm(null, draw);
    draw();
  };

  // ---------- Paramètres ----------
  routes.parametres = async () => {
    const c = data.company;
    const path = await bridge.dataPath();
    $('#view').innerHTML = `<div class="page-head"><h1>Paramètres</h1><div class="actions"><button class="btn btn-primary" id="save">Enregistrer</button></div></div>
      <form id="pf">
        <div class="panel"><h2>Société</h2><div class="grid-2">
          ${field('Raison sociale', 'name', c.name)}
          ${field('Matricule fiscal', 'matricule', c.matricule)}
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
        </div></div>
        <div class="panel"><h2>Paiement</h2><div class="grid-2">
          ${field('Banque', 'bank', c.bank)}
          ${field('RIB', 'rib', c.rib)}
        </div></div>
        <div class="panel"><h2>Documents</h2><div class="grid-3">
          ${field('Timbre fiscal par facture', 'stampFee', c.stampFee, 'number', 'step="0.001" min="0" class="num"')}
          ${field('Validité des devis (jours)', 'quoteValidityDays', c.quoteValidityDays, 'number', 'min="0" class="num"')}
          ${field('Délai de paiement (jours)', 'paymentTermsDays', c.paymentTermsDays, 'number', 'min="0" class="num"')}
          ${field('Devise', 'currency', c.currency)}
          <label class="field span-2">Pied de page des documents<textarea name="footer">${h(c.footer)}</textarea></label>
          <label class="check"><input type="checkbox" name="openAfterExport" ${c.openAfterExport !== false ? 'checked' : ''}> Ouvrir le PDF après export</label>
        </div></div>
      </form>
      <div class="panel"><h2>Mises à jour</h2><div id="update-panel"></div></div>
      <div class="panel"><h2>Données</h2>
        <p class="small muted">Fichier de données : <code>${h(path)}</code><br>Une sauvegarde automatique quotidienne est conservée dans le dossier <code>backups</code> à côté (30 derniers jours).</p>
        <p class="small">${data.documents.length} document(s), ${data.clients.length} client(s), ${data.catalog.length} prestation(s).</p>
        <div class="inline mt">
          <button class="btn" id="load-demo">Charger le jeu de données de démonstration</button>
          <button class="btn btn-danger" id="wipe-data">Tout effacer</button>
        </div>
        <p class="small muted mt">La démo remplace tes données actuelles par des clients, prestations, devis et factures fictifs pour découvrir l'app. Exporte d'abord si tu veux garder quelque chose.</p>
      </div>`;
    $('#save').onclick = () => { Object.assign(data.company, formValues($('#pf'))); save(true); toast('Paramètres enregistrés'); $('#brand-company').textContent = data.company.name; };
    drawUpdatePanel();
    $('#pick-logo').onclick = async () => { const l = await bridge.pickLogo(); if (l) { data.company.logo = l; save(true); render(); } };
    if ($('#rm-logo')) $('#rm-logo').onclick = () => { data.company.logo = ''; save(true); render(); };
    $('#load-demo').onclick = async () => {
      if (data.documents.length && !await confirmDialog('Remplacer toutes les données actuelles par la démonstration ?')) return;
      data = buildDemoData(); save(true); $('#brand-company').textContent = data.company.name; toast('Jeu de démonstration chargé'); navigate('#/dashboard');
    };
    $('#wipe-data').onclick = async () => {
      if (!await confirmDialog('Effacer TOUS les clients, prestations, devis et factures ? Les paramètres société sont conservés.')) return;
      data.clients = []; data.catalog = []; data.documents = []; data.counters = {}; save(true); toast('Données effacées'); render();
    };
  };

  // ---------- mises à jour ----------
  const upd = { state: 'idle', version: '', percent: 0, message: '', app: null };
  bridge.onUpdateEvent(ev => {
    upd.state = ev.state;
    if (ev.version) upd.version = ev.version;
    if (ev.percent != null) upd.percent = ev.percent;
    if (ev.message) upd.message = ev.message;
    drawUpdatePanel();
    const pill = $('#update-pill');
    if (pill) pill.hidden = !(ev.state === 'available' || ev.state === 'downloaded');
    if (ev.state === 'available') toast('Mise à jour ' + ev.version + ' disponible — voir Paramètres');
  });

  function drawUpdatePanel() {
    const el = $('#update-panel'); if (!el) return;
    const a = upd.app || {};
    let body = '';
    const btnCheck = `<button class="btn" id="upd-check">Vérifier les mises à jour</button>`;
    if (!a.packaged) body = `<p class="muted small">Mode développement (npm start) : la vérification des mises à jour n'est active que dans l'application installée.</p>${btnCheck}`;
    else if (upd.state === 'checking') body = `<p class="muted">Vérification en cours…</p>`;
    else if (upd.state === 'none') body = `<p>Tu as la dernière version. <span class="muted">(${h(a.version)})</span></p>${btnCheck}`;
    else if (upd.state === 'available') body = `<p><strong>Version ${h(upd.version)} disponible.</strong>${a.platform === 'darwin' && !a.macSigned ? ' Sur Mac, le téléchargement ouvre la page de la version : télécharge le .dmg et remplace l\'app dans Applications.' : ''}</p>
      <div class="inline"><button class="btn btn-primary" id="upd-download">${a.platform === 'darwin' && !a.macSigned ? 'Ouvrir la page de téléchargement' : 'Télécharger la mise à jour'}</button>${btnCheck}</div>`;
    else if (upd.state === 'downloading') body = `<p>Téléchargement… ${upd.percent}%</p><div class="progress"><div style="width:${upd.percent}%"></div></div>`;
    else if (upd.state === 'downloaded') body = `<p><strong>Version ${h(upd.version)} prête.</strong> L'app va redémarrer pour l'installer (quelques secondes).</p><button class="btn btn-primary" id="upd-install">Redémarrer et installer</button>`;
    else if (upd.state === 'unconfigured') body = `<p class="muted">Les mises à jour automatiques ne sont pas encore configurées : il faut un dépôt GitHub pour héberger les versions (voir README, section « Mises à jour automatiques »).</p>${btnCheck}`;
    else if (upd.state === 'error') body = `<p class="small" style="color:var(--danger)">${h(upd.message)}</p>${btnCheck}`;
    else body = btnCheck;
    const tokenBlock = `<div class="token-box">
      <div class="k-label">Accès au dépôt privé</div>
      <p class="small muted">Le dépôt GitHub de SkanFact est privé : un token de lecture est nécessaire pour vérifier les mises à jour. Il est enregistré uniquement sur cet ordinateur.</p>
      <div class="inline"><input type="text" id="upd-token" placeholder="${a.hasToken ? 'Token enregistré ✓ — coller un nouveau pour remplacer' : 'github_pat_… ou ghp_…'}" autocomplete="off" spellcheck="false"><button class="btn btn-sm" id="upd-token-save">Enregistrer</button>${a.hasToken ? '<button class="btn btn-sm btn-ghost" id="upd-token-clear">Retirer</button>' : ''}</div>
    </div>`;
    el.innerHTML = `<div class="update-head"><div><div class="k-label">Version installée</div><div class="ver">${h(a.version || '…')}</div></div></div>${body}${tokenBlock}`;
    $('#upd-token-save').onclick = async () => { const t = $('#upd-token').value.trim(); if (!t) return toast('Colle un token d\'abord', true); const r = await bridge.updateSetToken(t); upd.app.hasToken = r.hasToken; upd.state = 'idle'; drawUpdatePanel(); toast('Token enregistré'); };
    if ($('#upd-token-clear')) $('#upd-token-clear').onclick = async () => { const r = await bridge.updateSetToken(''); upd.app.hasToken = r.hasToken; drawUpdatePanel(); };
    if ($('#upd-check')) $('#upd-check').onclick = async () => { upd.state = 'checking'; drawUpdatePanel(); const r = await bridge.updateCheck(); if (r.state === 'error') { upd.state = 'error'; upd.message = r.message; drawUpdatePanel(); } else if (r.state === 'dev') { upd.state = 'idle'; drawUpdatePanel(); toast('Disponible uniquement dans l\'application installée'); } else if (r.state === 'unconfigured') { upd.state = 'unconfigured'; drawUpdatePanel(); } };
    if ($('#upd-download')) $('#upd-download').onclick = async () => { const r = await bridge.updateDownload(); if (r.state === 'error') { upd.state = 'error'; upd.message = r.message; drawUpdatePanel(); } else if (r.state === 'manual') { toast('Page de téléchargement ouverte dans le navigateur'); } };
    if ($('#upd-install')) $('#upd-install').onclick = () => bridge.updateInstall();
  }


  // ---------- jeu de données de démonstration ----------
  function buildDemoData() {
    const d = migrate(null);
    Object.assign(d.company, { phone: '+216 55 123 456', email: 'contact@skancyber.tn', website: 'www.skancyber.tn', bank: 'BIAT — Agence El Manar', rib: '08 006 0000123456789 12' });
    const mk = (name, matricule, address, phone, email) => ({ id: C.uid(), name, matricule, address, phone, email, notes: '' });
    d.clients = [
      mk('Clinique Les Jasmins', '1234567A/M/000', 'Avenue Habib Bourguiba\n2080 Ariana', '+216 71 700 100', 'direction@clinique-jasmins.tn'),
      mk('Pharmacie Centrale El Menzah', '2345678B/A/000', '12 rue Ibn Khaldoun\n1004 El Menzah', '+216 71 234 567', 'pharmacie.menzah@gmail.com'),
      mk('Cabinet Ben Salah Avocats', '3456789C/P/000', 'Immeuble Le Palmier, Lac 2\n1053 Tunis', '+216 71 960 200', 'contact@bensalah-avocats.tn'),
      mk('Lemon Beach Hammamet', '4567890D/A/000', 'Zone touristique\n8050 Hammamet', '+216 72 280 300', 'hello@lemonbeach.tn'),
      mk('Restaurant Dar El Jeld', '5678901E/A/000', '5 rue Dar El Jeld, Médina\n1006 Tunis', '+216 71 560 916', 'reservation@dareljeld.tn'),
      mk('Mohamed Trabelsi', 'CIN 09876543', 'Résidence Les Oliviers, Bloc B\n2092 El Manar', '+216 98 765 432', 'm.trabelsi@outlook.com')
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
      const doc = { id: C.uid(), type, number: C.nextNumber(d, type, date), date, dueDate: C.addDays(date, type === 'devis' ? d.company.quoteValidityDays : d.company.paymentTermsDays),
        clientId: cl[ci].id, subject, reference: '', lines, discountRate, applyStamp: true, status, notes, createdAt: Date.now() - ago * 86400000 };
      if (fromIdx != null) { const q = created.find(x => x.spec === specs[fromIdx]); if (q) { doc.fromQuoteId = q.doc.id; doc.fromQuoteNumber = q.doc.number; } }
      created.push({ spec: sp, doc });
      d.documents.push(doc);
    });
    // une facture en retard : échéance dépassée
    const late = d.documents.find(x => x.type === 'facture' && x.status === 'envoyée' && x.subject.startsWith('Installation pare-feu'));
    if (late) late.dueDate = daysAgo(18);
    return d;
  }

  // ---------- import / export ----------
  $('#btn-export-data').onclick = async () => { const p = await bridge.exportData(data); if (p) toast('Exporté : ' + p.split(/[\\/]/).pop()); };
  $('#btn-import-data').onclick = async () => {
    if (!await confirmDialog('Importer un fichier remplacera toutes les données actuelles. Continuer ?')) return;
    try { const d = await bridge.importData(); if (d) { data = migrate(d); toast('Données importées'); render(); } }
    catch (e) { toast('Import impossible : ' + e.message, true); }
  };

  // ---------- démarrage ----------
  (async () => {
    data = migrate(await bridge.loadData());
    $('#brand-company').textContent = data.company.name;
    bridge.updateVersion().then(v => { upd.app = v; const el = $('#app-version'); if (el) el.textContent = 'v' + v.version; });
    $('#update-pill').onclick = () => navigate('#/parametres');
    if (!location.hash) location.hash = '#/dashboard';
    render();
  })();
})();
