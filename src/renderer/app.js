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
    importData: async () => null, unlock: async () => ({ ok: false }), lock: async () => true, securityInfo: async () => ({ encrypted: false }), setPassword: async () => ({ ok: true, encrypted: false }),
    externalBackupInfo: async () => ({ dir: null }), setExternalBackup: async () => ({ dir: null }), chooseExternalBackup: async () => null,
    openBackups: async () => {}, createBackup: async () => null, listBackups: async () => [],
    pickLogo: async () => null,
    exportPdf: async (html) => { const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print(); return null; },
    exportPdfMany: async () => null, saveText: async () => null, exportPdfSilent: async () => null, saveTextSilent: async () => null, composeMail: async () => ({ state: 'mailto' }),
    openPath: async () => {}, showInFolder: async () => {},
    changelog: async () => '', onMenuAction: () => {}, setTitle: () => {},
    updateVersion: async () => ({ version: 'dev', packaged: false, platform: 'browser', macSigned: false }),
    updateCheck: async () => ({ state: 'dev' }), updateDownload: async () => ({ state: 'dev' }), updateInstall: async () => ({ state: 'dev' }), updateSetToken: async () => ({ hasToken: false }),
    updateOpenReleases: async () => {},
    onUpdateEvent: () => {}
  };

  // ---------- état ----------
  let data = null;
  let saveTimer = null;
  const unlockedIds = new Set(); // factures émises déverrouillées « quand même » pour la session
  const security = { encrypted: false };
  // Aperçu masqué (petit écran) : préférence gardée d'une session à l'autre
  let previewHidden = false;
  try { previewHidden = localStorage.getItem('skanfact.preview') === '0'; } catch (_) {}
  let settingsTab = 'societe';   // onglet ouvert dans Paramètres
  let catalogTab = 'presta';     // onglet ouvert dans Catalogue
  // Recherche, tri et page courante de chaque onglet du Catalogue
  const catalogState = {
    presta: { q: '', sort: { key: 'label', dir: 'asc' }, page: 1 },
    modeles: { q: '', sort: { key: 'name', dir: 'asc' }, page: 1 },
    textes: { q: '', sort: { key: 'name', dir: 'asc' }, page: 1 }
  };
  let aideArticle = '';          // article ouvert dans l'Aide

  // Écran de verrouillage : demande le mot de passe tant que le fichier n'est pas déchiffré.
  function showLockScreen() {
    return new Promise(resolve => {
      const el = document.createElement('div'); el.id = 'lock-screen';
      el.innerHTML = `<div class="lock-card"><div class="brand-mark">SF</div><h2>SkanFact est verrouillé</h2><p class="muted small">Les données sont chiffrées sur ce disque. Entre ton mot de passe pour continuer.</p>
        <form id="lock-form"><input type="password" id="lock-pw" placeholder="Mot de passe" autocomplete="current-password"><div class="lock-err" id="lock-err" hidden>Mot de passe incorrect.</div><button class="btn btn-primary" type="submit" id="lock-ok">Déverrouiller</button></form></div>`;
      document.body.appendChild(el);
      const input = $('#lock-pw', el); input.focus();
      $('#lock-form', el).onsubmit = async e => {
        e.preventDefault();
        const b = $('#lock-ok', el); b.disabled = true;
        const r = await bridge.unlock(input.value);
        if (r && r.ok) { el.remove(); resolve(r.data); }
        else { b.disabled = false; $('#lock-err', el).hidden = false; input.value = ''; input.focus(); }
      };
    });
  }

  async function lockNow() {
    if (!security.encrypted) return toast('Active d\'abord un mot de passe (Paramètres → Sécurité).', true);
    await save(true);
    bridge.lock();
  }

  function passwordDialog(mode) { // 'set' | 'change' | 'remove'
    const title = mode === 'set' ? 'Activer le mot de passe' : mode === 'change' ? 'Changer le mot de passe' : 'Retirer le mot de passe';
    modal(`<h2>${title}</h2>
      ${mode === 'set' ? '<p class="small muted">Le fichier de données et ses sauvegardes seront chiffrés (AES-256). Sans ce mot de passe, personne ne peut les lire — toi non plus : garde-le en lieu sûr, il n\'y a pas de récupération possible.</p>' : ''}
      <form id="pwf" class="grid-2">
        ${mode !== 'set' ? field('Mot de passe actuel', 'current', '', 'password', 'autocomplete="current-password"') : ''}
        ${mode !== 'remove' ? field('Nouveau mot de passe', 'password', '', 'password', 'autocomplete="new-password"') + field('Confirmation', 'confirm', '', 'password', 'autocomplete="new-password"') : ''}
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn ${mode === 'remove' ? 'btn-danger' : 'btn-primary'}" id="ok">${mode === 'remove' ? 'Retirer' : 'Enregistrer'}</button></div>`,
      (root, close) => { $('#ok', root).onclick = async () => {
        const v = formValues($('#pwf', root));
        if (mode !== 'remove') {
          if (!v.password || v.password.length < 6) return toast('Mot de passe : 6 caractères minimum.', true);
          if (v.password !== v.confirm) return toast('Les deux mots de passe ne correspondent pas.', true);
        }
        const b = $('#ok', root); b.disabled = true; b.textContent = 'Chiffrement…';
        const r = await bridge.setPassword({ data, password: mode === 'remove' ? '' : v.password, current: v.current || '' });
        if (!r || !r.ok) { b.disabled = false; b.textContent = mode === 'remove' ? 'Retirer' : 'Enregistrer'; return toast((r && r.error) || 'Échec', true); }
        security.encrypted = r.encrypted; close(); toast(r.encrypted ? 'Données chiffrées — mot de passe demandé à chaque ouverture' : 'Mot de passe retiré : données en clair'); render();
      }; });
  }

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

  // ---------- bulles d'explication « i » ----------
  // info(clé) pose un petit bouton rond à côté d'un libellé ; le texte vient de guide.js.
  const G = window.SkanGuide || { INFO: {}, ARTICLES: [] };
  function info(key) {
    const x = G.INFO[key];
    if (!x) return '';
    return `<button type="button" class="i" data-info="${h(key)}" aria-label="Qu'est-ce que c'est ?" title="Qu'est-ce que c'est ?">i</button>`;
  }
  // Un libellé de champ suivi de sa bulle. Le <span> garde les deux sur la même ligne dans un label en colonne.
  const lbl = (text, key) => key ? `<span class="fl">${text} ${info(key)}</span>` : text;

  // L'aperçu est rendu à une échelle calculée sur la largeur disponible : il faut le refaire au redimensionnement.
  let previewRedraw = null;
  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (previewRedraw) previewRedraw(); }, 200); });

  function closeInfoPop() { const p = $('#info-pop'); if (p) p.remove(); }
  function openInfoPop(btn) {
    const x = G.INFO[btn.dataset.info]; if (!x) return;
    closeInfoPop();
    const pop = document.createElement('div');
    pop.id = 'info-pop';
    pop.innerHTML = `<div class="ip-head">${h(x.t)}<button type="button" class="ip-close" aria-label="Fermer">✕</button></div><div class="ip-body">${x.d}</div>`;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth, hh = pop.offsetHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    $('.ip-close', pop).onclick = closeInfoPop;
  }
  document.addEventListener('click', e => {
    const btn = e.target.closest('.i[data-info]');
    if (btn) { e.preventDefault(); e.stopPropagation(); const open = $('#info-pop'); closeInfoPop(); if (!open || open._key !== btn.dataset.info) { openInfoPop(btn); if ($('#info-pop')) $('#info-pop')._key = btn.dataset.info; } return; }
    if (!e.target.closest('#info-pop')) closeInfoPop();
  }, true);
  window.addEventListener('resize', closeInfoPop);

  // ---------- UI helpers ----------
  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'show' + (isError ? ' error' : '');
    clearTimeout(t._timer); t._timer = setTimeout(() => t.className = '', 2600);
  }

  // Fenêtre modale. Échap ferme, Entrée valide le bouton principal (sauf dans un textarea).
  let modalClose = null;
  function modal(html, onMount) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-bg"><div class="modal">${html}</div></div>`;
    const close = () => { root.innerHTML = ''; if (modalClose === close) modalClose = null; };
    modalClose = close;
    $('.modal-bg', root).addEventListener('click', e => { if (e.target.classList.contains('modal-bg')) close(); });
    $$('[data-close]', root).forEach(b => b.addEventListener('click', close));
    bindDateFields(root);
    root.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
      const main = $('.modal-actions .btn-primary, .modal-actions .btn-danger', root);
      if (main && !main.disabled) { e.preventDefault(); main.click(); }
    });
    if (onMount) onMount(root, close);
    const first = $('input:not([type=hidden]), select, textarea', root); if (first) first.focus();
    return close;
  }

  function confirmDialog(msg, okLabel, danger) {
    return new Promise(resolve => {
      modal(`<h2>Confirmation</h2><p>${C.nl2br(msg)}</p>
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

  let uiSeq = 0;                 // identifiants des composants posés dans la page
  let closeOverlay = null;       // fermeture du calendrier ou de la liste déroulante ouverte

  // ---------- liste déroulante avec recherche ----------
  // Remplace <select> dès que la liste s'allonge (clients, factures, catalogue) : champ de recherche,
  // liste filtrée, navigation au clavier. La valeur reste dans un <input type="hidden"> portant le nom
  // de l'ancien <select>, si bien que formValues() et les gestionnaires de formulaire ne changent pas.
  function combo(o) {
    const id = 'cb' + (++uiSeq);
    const cur = (o.items || []).find(x => x.v === o.value);
    const lab = cur ? cur.label : '';
    return `<div class="combo${o.ro ? ' ro' : ''}" id="${id}"${o.name ? ` data-combo="${h(o.name)}"` : ''}>
      ${o.name ? `<input type="hidden" name="${h(o.name)}" value="${h(o.value || '')}">` : ''}
      <button type="button" class="combo-btn" aria-haspopup="listbox" aria-expanded="false" ${o.ro ? 'disabled' : ''}>
        <span class="combo-val${lab ? '' : ' ph'}">${h(lab || o.placeholder || 'Choisir…')}</span>
        <span class="combo-caret" aria-hidden="true">▾</span>
      </button>
      <div class="combo-pop" hidden>
        <input type="text" class="combo-q" placeholder="${h(o.search || 'Rechercher…')}" autocomplete="off" spellcheck="false">
        <div class="combo-list" role="listbox"></div>
        ${o.add ? `<button type="button" class="combo-add">${h(o.add)}</button>` : ''}
      </div></div>`;
  }
  // `items` : [{ v, label, sub, right, text }]. `onPick(v, item)` est appelé après le choix.
  // `reset: true` pour une liste d'action (catalogue, modèles) qui ne garde pas la valeur choisie.
  function bindCombo(el, o) {
    if (!el || el._bound) return el;
    el._bound = true;
    o = o || {};
    const hidden = $('input[type=hidden]', el), btn = $('.combo-btn', el), pop = $('.combo-pop', el);
    const q = $('.combo-q', el), list = $('.combo-list', el), add = $('.combo-add', el);
    el._items = o.items || [];
    el._value = hidden ? hidden.value : '';
    let sel = 0, shown = [];

    const paint = () => {
      const it = el._items.find(x => x.v === el._value);
      const span = $('.combo-val', el);
      span.textContent = it ? it.label : (o.placeholder || 'Choisir…');
      span.classList.toggle('ph', !it);
      if (hidden) hidden.value = el._value || '';
    };
    const draw = () => {
      const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      shown = el._items.filter(x => !words.length || words.every(w => (x.text || x.label || '').toLowerCase().includes(w)));
      sel = Math.max(0, Math.min(sel, shown.length - 1));
      list.innerHTML = shown.length ? shown.map((x, i) => `<div class="combo-it${i === sel ? ' sel' : ''}${x.v === el._value ? ' cur' : ''}" data-i="${i}" role="option" aria-selected="${i === sel}">
          <span class="ci-main">${h(x.label)}${x.sub ? `<span class="ci-sub">${h(x.sub)}</span>` : ''}</span>
          ${x.right ? `<span class="ci-right">${h(x.right)}</span>` : ''}</div>`).join('')
        : '<div class="combo-empty">Aucun résultat</div>';
      $$('.combo-it', list).forEach(d => d.onmousedown = e => { e.preventDefault(); pick(shown[Number(d.dataset.i)]); });
      const cur = $('.combo-it.sel', list); if (cur) cur.scrollIntoView({ block: 'nearest' });
    };
    const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); el.classList.remove('up'); if (closeOverlay === close) closeOverlay = null; };
    const open = () => {
      if (closeOverlay) closeOverlay();
      pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
      // Dans une fenêtre modale il n'y a pas toujours la place en dessous : on ouvre vers le haut.
      el.classList.toggle('up', window.innerHeight - btn.getBoundingClientRect().bottom < 300);
      q.value = ''; sel = Math.max(0, el._items.findIndex(x => x.v === el._value));
      draw(); q.focus(); closeOverlay = close;
    };
    const pick = (x) => {
      if (!x) return;
      el._value = o.reset ? '' : x.v;
      paint(); close(); btn.focus();
      if (o.onPick) o.onPick(x.v, x);
      if (hidden && !o.reset) hidden.dispatchEvent(new Event('change', { bubbles: true }));
    };
    btn.onclick = () => (pop.hidden ? open() : close());
    q.oninput = () => { sel = 0; draw(); };
    q.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
      // stopPropagation : sinon Entrée validerait aussi le bouton principal de la fenêtre modale
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); pick(shown[sel]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); }
      else if (e.key === 'Tab') close();
    };
    if (add) add.onclick = () => { close(); if (o.onAdd) o.onAdd(); };
    el.setItems = (items, value) => { el._items = items; if (value !== undefined) el._value = value; paint(); if (!pop.hidden) draw(); };
    el.setValue = (v, silent) => { el._value = v; paint(); if (hidden && !silent) hidden.dispatchEvent(new Event('change', { bubbles: true })); };
    paint();
    return el;
  }

  // ---------- champ date avec calendrier ----------
  // Saisie libre tolérante (12/03/2026, 12-3-26, 12032026, 12/03, 12) et calendrier cliquable.
  // La valeur ISO vit dans un <input type="hidden"> : le reste de l'app ne voit aucune différence.
  const DOW = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  function dateInput(name, value, o) {
    o = o || {};
    return `<div class="datefield${o.ro ? ' ro' : ''}" id="dt${++uiSeq}"${o.quick ? ' data-quick="1"' : ''}${o.clearable ? ' data-clearable="1"' : ''}>
      <input type="hidden" name="${h(name)}" value="${h(value || '')}">
      <input type="text" class="d-txt" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="JJ/MM/AAAA" value="${h(C.fmtDateInput(value))}" ${o.ro ? 'disabled' : ''}>
      <button type="button" class="d-btn" tabindex="-1" aria-label="Ouvrir le calendrier" title="Ouvrir le calendrier" ${o.ro ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
      </button>
      <div class="cal-pop" hidden></div>
    </div>`;
  }
  function dateFieldHtml(label, name, value, o) {
    return `<div class="field">${label}${dateInput(name, value, o)}</div>`;
  }
  function bindDateFields(root) {
    $$('.datefield', root || document).forEach(el => {
      if (el._bound) return;
      el._bound = true;
      const hidden = $('input[type=hidden]', el), txt = $('.d-txt', el), btn = $('.d-btn', el), pop = $('.cal-pop', el);
      const quick = el.dataset.quick === '1', clearable = el.dataset.clearable === '1';
      let view = null;
      const fire = () => hidden.dispatchEvent(new Event('change', { bubbles: true }));
      const commit = (iso, silent) => {
        if (hidden.value === iso) { txt.value = C.fmtDateInput(iso); return; }
        hidden.value = iso; txt.value = C.fmtDateInput(iso);
        if (!silent) fire();
      };
      // On vide le calendrier en le fermant : sinon deux champs date laissent deux grilles dans la page.
      const closeCal = () => { pop.hidden = true; pop.innerHTML = ''; el.classList.remove('up'); if (closeOverlay === closeCal) closeOverlay = null; };
      const drawCal = () => {
        const cur = hidden.value || C.today();
        view = view || { y: Number(cur.slice(0, 4)), m: Number(cur.slice(5, 7)) };
        const t = C.today();
        pop.innerHTML = `<div class="cal-head">
            <button type="button" class="cal-nav" data-mv="-1" aria-label="Mois précédent">‹</button>
            <select class="cal-m" aria-label="Mois">${C.MONTHS_FR.map((m, i) => `<option value="${i + 1}" ${i + 1 === view.m ? 'selected' : ''}>${m}</option>`).join('')}</select>
            <input type="number" class="cal-y" aria-label="Année" value="${view.y}" min="1900" max="2999" step="1">
            <button type="button" class="cal-nav" data-mv="1" aria-label="Mois suivant">›</button>
          </div>
          <div class="cal-dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
          <div class="cal-grid">${C.monthMatrix(view.y, view.m).map(w => w.map(d =>
            `<button type="button" class="cal-d${d.out ? ' out' : ''}${d.iso === hidden.value ? ' sel' : ''}${d.iso === t ? ' today' : ''}" data-d="${d.iso}" tabindex="-1">${d.day}</button>`).join('')).join('')}</div>
          <div class="cal-foot">
            <button type="button" class="btn btn-sm" data-d="${t}">Aujourd'hui</button>
            ${quick ? [7, 15, 30].map(n => `<button type="button" class="btn btn-sm" data-plus="${n}">+${n} j</button>`).join('') : ''}
            ${clearable && hidden.value ? '<button type="button" class="btn btn-sm btn-ghost" data-clear="1">Effacer</button>' : ''}
          </div>`;
        $$('[data-mv]', pop).forEach(b => b.onclick = () => {
          view.m += Number(b.dataset.mv);
          if (view.m < 1) { view.m = 12; view.y--; } else if (view.m > 12) { view.m = 1; view.y++; }
          drawCal();
        });
        $('.cal-m', pop).onchange = e => { view.m = Number(e.target.value); drawCal(); };
        $('.cal-y', pop).onchange = e => { const y = Number(e.target.value); if (y >= 1900 && y <= 2999) { view.y = y; drawCal(); } };
        $$('[data-d]', pop).forEach(b => b.onclick = () => { commit(b.dataset.d); closeCal(); txt.focus(); });
        $$('[data-plus]', pop).forEach(b => b.onclick = () => { commit(C.addDays(hidden.value || t, Number(b.dataset.plus))); closeCal(); txt.focus(); });
        if ($('[data-clear]', pop)) $('[data-clear]', pop).onclick = () => { commit(''); closeCal(); txt.focus(); };
      };
      const openCal = () => {
        if (closeOverlay) closeOverlay();
        view = null; pop.hidden = false;
        el.classList.toggle('up', window.innerHeight - btn.getBoundingClientRect().bottom < 340);
        drawCal(); closeOverlay = closeCal;
      };
      btn.onclick = () => (pop.hidden ? openCal() : closeCal());
      // Confort de frappe : les séparateurs s'écrivent tout seuls, rien n'est validé avant de quitter le champ.
      txt.oninput = () => {
        const d = txt.value.replace(/\D/g, '').slice(0, 8);
        if (txt.value.replace(/[\d/]/g, '') === '' && d.length >= 3) {
          txt.value = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : `${d.slice(0, 2)}/${d.slice(2)}`;
        }
      };
      txt.onblur = () => {
        const iso = C.parseDateInput(txt.value);
        if (!txt.value.trim()) return commit('');
        if (!iso) { txt.value = C.fmtDateInput(hidden.value); toast('Date incomprise : écris-la sous la forme 12/03/2026.', true); return; }
        commit(iso);
      };
      txt.onkeydown = e => {
        if (e.key === 'Enter') { txt.blur(); txt.focus(); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const base = C.parseDateInput(txt.value) || hidden.value || C.today();
          commit(C.addDays(base, e.key === 'ArrowUp' ? 1 : -1));
        } else if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); closeCal(); }
      };
    });
  }

  // ---------- unité d'une ligne ----------
  const UNIT_OTHER = '__autre__';
  function unitOptions(value, extras) {
    const list = C.LINE_UNITS.concat((extras || []).map(u => [u, u]));
    if (value && !list.some(x => x[0] === value)) list.push([value, value]);
    return `<option value="">—</option>${list.map(([v, l]) => `<option value="${h(v)}" ${v === value ? 'selected' : ''}>${h(l)}</option>`).join('')}<option value="${UNIT_OTHER}">Autre…</option>`;
  }
  // « Autre… » ouvre une saisie libre ; l'unité tapée rejoint la liste puisqu'elle est alors dans les données.
  function bindUnitSelect(sel, get, set) {
    sel.onchange = () => {
      if (sel.value !== UNIT_OTHER) return set(sel.value);
      const prev = get() || '';
      sel.value = prev; set(prev);
      promptDialog('Unité personnalisée', 'Unité (ex : rouleau, palette, ml)', '', v => {
        const u = v.trim();
        sel.innerHTML = unitOptions(u, []);
        sel.value = u; set(u);
      });
    };
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

  // ---------- garde-fou « modifications non enregistrées » ----------
  // Une page qui a des modifications en cours s'enregistre ici ; toute navigation demande alors quoi faire.
  let guard = null;                       // { dirty: () => bool, save: () => bool|Promise, what: 'ce devis' }
  function setGuard(g) { guard = g; }
  function clearGuard(g) { if (!g || guard === g) guard = null; }
  // Demande à l'utilisateur avant de perdre son travail. Résout true si on peut continuer.
  async function leaveOk() {
    if (!guard || !guard.dirty()) return true;
    const g = guard;
    const c = await choiceDialog('Modifications non enregistrées',
      `Tu as modifié ${g.what || 'cette page'} sans enregistrer. Que veut-on faire ?`,
      'Enregistrer et continuer', 'Quitter sans enregistrer');
    if (c === null) return false;
    if (c === 'a') { const ok = await g.save(); if (ok === false) return false; }
    guard = null;
    return true;
  }

  // ---------- routeur ----------
  const routes = {};
  let currentHash = '';
  let ignoreHashChange = false;
  function navigate(hash) { location.hash = hash; }
  // Exécute une action qui quitte la page courante (bouton de la barre latérale, palette, menu…)
  async function go(fn) { if (await leaveOk()) fn(); }

  function render(keepScroll) {
    const view = $('#view');
    const scroll = keepScroll ? view.scrollTop : 0;
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
    const name = parts[0];
    let active = name;
    if (name === 'doc') {
      const type = parts[1] === 'new' ? parts[2] : (docById(parts[1]) || {}).type;
      active = type === 'devis' ? 'devis' : 'factures';
    } else if (name === 'client') active = 'clients';
    $$('nav a').forEach(a => a.classList.toggle('active', a.dataset.route === active));
    guard = null; previewRedraw = null;
    (routes[name] || routes.dashboard)(parts.slice(1));
    bindDateFields(view);            // champs date posés par la page qui vient d'être dessinée
    view.scrollTop = scroll;
    currentHash = location.hash;
    updateNavCounts();
    closePalette();
    closeInfoPop();
    setWindowTitle(name, parts.slice(1));
  }

  window.addEventListener('hashchange', async () => {
    if (ignoreHashChange) { ignoreHashChange = false; return; }
    if (guard && guard.dirty()) {
      const target = location.hash;
      ignoreHashChange = true; location.hash = currentHash;   // on reste sur place le temps de demander
      if (!(await leaveOk())) return;
      ignoreHashChange = true; location.hash = target;
      render();
      return;
    }
    render();
  });

  // Titre de la fenêtre : on voit dans le Dock et dans « Fenêtre » ce qui est ouvert
  function setWindowTitle(name, parts) {
    let t = '';
    if (name === 'doc') {
      const d = parts[0] === 'new' ? null : docById(parts[0]);
      t = d ? docLabel(d) + ' — ' + clientName(d.clientId) : 'Nouveau document';
    } else if (name === 'client') {
      t = (clientById(parts[0]) || {}).name || 'Client';
    } else {
      const a = $(`nav a[data-route="${name}"]`);
      t = a ? a.textContent.trim().replace(/\d+$/, '').trim() : '';
    }
    const title = (t ? t + ' — ' : '') + 'SkanFact';
    document.title = title;
    if (bridge.setTitle) bridge.setTitle(title);
  }

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
    const sentQuotes = data.documents.filter(d => d.type === 'devis' && d.status === 'envoyé');
    const expiredQuotes = sentQuotes.filter(d => effStatus(d) === 'expiré');
    const pendingQuotes = sentQuotes.filter(d => effStatus(d) === 'envoyé');
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
      ${todoPanel()}
      <div class="stats">
        <div class="stat"><div class="lbl">CA du mois (HT) ${info('dash.caMonth')}</div><div class="val">${C.money(sumHT(ofMonth), cur)}</div><div class="sub">${C.money(sumTTC(ofMonth), cur)} TTC, avoirs déduits</div></div>
        <div class="stat"><div class="lbl">CA de l'année (HT) ${info('dash.caYear')}</div><div class="val">${C.money(sumHT(ofYear), cur)}</div><div class="sub">${year} · ${C.money(sumTTC(ofYear), cur)} TTC</div></div>
        <div class="stat"><div class="lbl">Reste à encaisser ${info('dash.open')}</div><div class="val">${C.money(openAmount, cur)}</div><div class="sub">${open.length} facture(s), ${late.length} en retard</div></div>
        <div class="stat"><div class="lbl">Devis en attente ${info('dash.quotes')}</div><div class="val">${C.money(sumQ(pendingQuotes), cur)}</div><div class="sub">${pendingQuotes.length} devis envoyé(s)${expiredQuotes.length ? ` · <a href="#/devis" class="warn-link">${expiredQuotes.length} expiré(s)</a>` : ''}</div></div>
      </div>
      <div class="dash-grid">
        <div class="panel"><h2>Activité des 12 derniers mois ${info('dash.chart')}</h2>
          ${barChart(series)}
          <div class="legend"><span><i style="background:var(--primary)"></i>Facturé HT (avoirs déduits)</span><span><i style="background:#2a6fd6;opacity:.55"></i>Encaissé</span></div>
          <div class="kpis">
            <div class="kpi"><div class="k-label">Devis → facture ${info('dash.conversion')}</div><div class="v">${qs.rate == null ? '—' : qs.rate + ' %'}</div><div class="sub">${qs.accepted} accepté(s), ${qs.refused} refusé(s), ${qs.pending} en attente</div></div>
            <div class="kpi"><div class="k-label">Délai moyen de paiement ${info('dash.delay')}</div><div class="v">${delay == null ? '—' : delay + ' jours'}</div><div class="sub">factures soldées, 12 derniers mois</div></div>
          </div>
        </div>
        <div class="panel"><h2>Top clients ${year} (HT) ${info('dash.top')}</h2>
          ${top.length ? `<ul class="rank">${top.map(x => `<li><span class="name">${h(x.name)}</span><span class="bar"><i style="width:${Math.max(4, Math.round(x.ht / topMax * 100))}%"></i></span><span class="amt">${C.money(x.ht, cur)}</span></li>`).join('')}</ul>` : '<p class="small muted">Aucune facture émise cette année.</p>'}
        </div>
      </div>
      <div class="panel"><h2>Documents récents</h2>${docTable(recent)}</div>`;
    $('#new-devis').onclick = () => navigate('#/doc/new/devis');
    $('#new-facture').onclick = () => navigate('#/doc/new/facture');
    bindTodo();
    bindDocTable();
  };

  // Histogramme SVG : facturé HT et encaissé par mois (sans bibliothèque)
  function barChart(series) {
    const W = 600, H = 220, left = 44, bottom = 26, top = 10;
    const real = Math.max(0, ...series.map(x => Math.max(x.invoiced, x.collected)));
    const max = Math.max(1, real);
    const slot = (W - left) / series.length;
    const y = v => top + (H - bottom - top) * (1 - Math.max(0, v) / max);
    // Sans aucune donnée, l'axe n'a qu'un zéro : afficher « 1 » deux fois n'aurait aucun sens
    const grid = [0, 0.5, 1].map(f => `<line class="grid" x1="${left}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}"/><text class="lbl" x="${left - 6}" y="${y(max * f) + 4}" text-anchor="end">${real || !f ? short(max * f) : ''}</text>`).join('');
    const bars = series.map((x, i) => {
      const x0 = left + i * slot;
      return `<rect class="bar-inv" x="${x0 + slot * 0.12}" width="${slot * 0.36}" y="${y(x.invoiced)}" height="${H - bottom - y(x.invoiced)}" rx="2"><title>${h(C.monthLabel(x.month + '-01'))} — facturé ${C.money(x.invoiced, company().currency)}</title></rect>
        <rect class="bar-col" x="${x0 + slot * 0.52}" width="${slot * 0.36}" y="${y(x.collected)}" height="${H - bottom - y(x.collected)}" rx="2"><title>${h(C.monthLabel(x.month + '-01'))} — encaissé ${C.money(x.collected, company().currency)}</title></rect>
        <text class="lbl" x="${x0 + slot / 2}" y="${H - 8}" text-anchor="middle">${h(x.label)}</text>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<line class="axis" x1="${left}" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"/>${bars}</svg>`;
  }

  // ---------- outils communs à toutes les listes : préférences, tri, pagination ----------
  // Préférences d'affichage (taille de page, panneaux repliés). Elles décrivent l'écran, pas l'entreprise :
  // elles restent sur cet ordinateur et ne partent ni dans le fichier de données ni dans les sauvegardes.
  const prefs = {
    get(key, dflt) { try { const v = localStorage.getItem('skanfact.' + key); return v == null ? dflt : JSON.parse(v); } catch (_) { return dflt; } },
    set(key, value) { try { localStorage.setItem('skanfact.' + key, JSON.stringify(value)); } catch (_) {} }
  };

  const PAGE_SIZES = [[25, '25'], [50, '50'], [100, '100'], [0, 'Tout']];
  const rowsPerPage = () => { const n = Number(prefs.get('rowsPerPage', 25)); return PAGE_SIZES.some(p => p[0] === n) ? n : 25; };

  // Bascule de tri : recliquer la même colonne inverse le sens, une autre colonne repart de son sens naturel
  // (croissant pour un texte, décroissant pour une date ou un montant — on veut voir le plus récent d'abord).
  function toggleSort(sort, key, cols) {
    if (sort && sort.key === key) return { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
    const col = (cols || []).find(c => c.key === key);
    return { key, dir: col && col.asc ? 'asc' : 'desc' };
  }
  function applySort(list, cols, sort) {
    const col = sort && cols.find(c => c.key === sort.key);
    if (!col || !col.val) return list;
    return list.slice().sort((a, b) => { const cmp = C.compareValues(col.val(a), col.val(b)); return sort.dir === 'asc' ? cmp : -cmp; });
  }
  // En-têtes cliquables. Une colonne triable porte toujours un repère « ⇅ » : sans lui, personne ne devine
  // que l'en-tête est un bouton (remarque de Skander).
  function sortHead(cols, sort, extra) {
    return `<tr>${cols.map(c => {
      const on = sort && sort.key === c.key;
      const cls = [c.r ? 'r' : '', c.val ? 'sortable-h' : '', on ? 'sorted' : ''].filter(Boolean).join(' ');
      const attrs = c.val ? ` data-sort="${h(c.key)}" title="Trier par ${h(c.label)}" role="button" tabindex="0"` : '';
      const mark = c.val ? `<span class="sort-ar">${on ? (sort.dir === 'asc' ? '↑' : '↓') : '⇅'}</span>` : '';
      return `<th class="${cls}"${attrs}${c.w ? ` style="width:${c.w}"` : ''}>${h(c.label)}${mark}</th>`;
    }).join('')}${extra || ''}</tr>`;
  }
  function bindSort(root, redraw) {
    $$('th[data-sort]', root).forEach(th => {
      th.onclick = () => redraw(th.dataset.sort);
      th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); redraw(th.dataset.sort); } };
    });
  }

  // Découpe la liste selon la page courante de `state` et renvoie { rows, pg } pour l'affichage.
  function paginate(list, state) {
    const pg = C.pageInfo(list.length, state.page || 1, rowsPerPage());
    state.page = pg.page;
    return { rows: pg.size ? list.slice(pg.start, pg.end) : list, pg };
  }
  // Barre de pagination. Masquée tant qu'il n'y a pas de quoi remplir une page : une liste de six lignes
  // n'a pas besoin de « Page 1 / 1 ».
  function pagerBar(pg, opts) {
    opts = opts || {};
    if (pg.pages <= 1 && pg.total <= PAGE_SIZES[0][0]) return '';
    const noun = opts.noun || 'ligne';
    const s = pg.total > 1 ? 's' : '';
    const filtered = opts.grandTotal != null && opts.grandTotal !== pg.total;
    const count = filtered
      ? `${pg.from}–${pg.to} sur ${pg.total} ${noun}${s} après filtrage (${opts.grandTotal} au total)`
      : `${pg.from}–${pg.to} sur ${pg.total} ${noun}${s}`;
    return `<div class="pager">
      <span class="pg-info">${h(count)}</span>
      <div class="pg-nav">
        <button type="button" class="btn btn-sm" data-pg="prev" ${pg.page <= 1 ? 'disabled' : ''}>‹ Précédent</button>
        <span class="pg-page">Page ${pg.page} / ${pg.pages}</span>
        <button type="button" class="btn btn-sm" data-pg="next" ${pg.page >= pg.pages ? 'disabled' : ''}>Suivant ›</button>
      </div>
      <label class="pg-size">Lignes par page <select data-pg="size">${PAGE_SIZES.map(([v, l]) => `<option value="${v}" ${v === pg.size ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${info('list.page')}</div>`;
  }
  // `root` limite la liaison à un tableau : la page Comptabilité et la page Relances en affichent deux.
  function bindPager(root, state, redraw, anchor) {
    $$('[data-pg]', root).forEach(el => {
      if (el.dataset.pg === 'size') el.onchange = e => { prefs.set('rowsPerPage', Number(e.target.value)); state.page = 1; redraw(); };
      else el.onclick = () => {
        state.page = (state.page || 1) + (el.dataset.pg === 'next' ? 1 : -1);
        redraw();
        const a = anchor && $(anchor);
        if (a && a.scrollIntoView) a.scrollIntoView({ block: 'start', behavior: 'smooth' });
      };
    });
  }
  // Bandeau « filtres actifs » : sans lui, une liste filtrée ressemble à une liste vide.
  // Le filtre par année s'applique tout seul sur les grosses listes : il faut pouvoir le défaire d'un clic.
  function filterReset(active) {
    if (!active) return '';
    return `<button type="button" class="btn btn-sm btn-ghost" id="reset-f" title="Effacer la recherche et les filtres">✕ Réinitialiser les filtres</button>`;
  }

  // ---------- listes devis / factures ----------
  // Colonnes d'une liste de documents. `get` sert à l'affichage, `val` au tri (nombre ou texte comparable).
  function docColumns(opts) {
    const cur = doc => docCur(doc);
    const amountOf = d => { const t = C.computeTotals(d, company()); return d.type === 'devis' ? t.totalTTC : (d.type === 'avoir' ? -t.netToPay : t.netToPay); };
    const restOf = d => d.type === 'facture' && d.status !== 'brouillon' ? balance(d).remaining : null;
    const cols = [
      { key: 'number', label: 'Numéro', cls: 'nw', val: d => (d.number ? '1' : '0') + (d.number || ''), get: d => `<strong>${d.number ? h(d.number) : '<span class="muted">Brouillon</span>'}</strong>` },
      opts.quotes
        ? { key: 'due', label: 'Valable jusqu\'au', val: d => d.dueDate || '', get: d => C.fmtDate(d.dueDate) }
        : { key: 'type', label: 'Type', asc: true, val: d => d.type, get: d => C.TITLES[d.type] },
      opts.hideClient
        ? { key: 'subject', label: 'Objet', asc: true, val: d => (d.subject || '').toLowerCase(), get: d => h(d.subject || '') || '<span class="muted">—</span>' }
        : { key: 'client', label: 'Client', asc: true, val: d => clientName(d.clientId).toLowerCase(), get: d => `${h(clientName(d.clientId))}${d.subject ? `<div class="small muted">${h(d.subject)}</div>` : ''}` },
      { key: 'date', label: 'Date', val: d => d.date || '', get: d => C.fmtDate(d.date) },
      { key: 'status', label: 'Statut', val: d => effStatus(d), get: d => statusBadge(d) },
      { key: 'amount', label: opts.quotes ? 'Total TTC' : 'Net à payer', r: true, val: amountOf, get: d => C.money(amountOf(d), cur(d)) }
    ];
    if (!opts.quotes) cols.push({ key: 'rest', label: 'Reste', r: true, val: d => restOf(d) || 0, get: d => { const x = restOf(d); return x != null && x > 0.0005 ? C.money(x, cur(d)) : '<span class="muted">—</span>'; } });
    return { cols, amountOf, restOf };
  }

  // Liste de documents triable, avec un pied de tableau qui totalise ce qui est affiché.
  function docTable(list, opts) {
    opts = opts || {};
    const { cols, amountOf, restOf } = docColumns(opts);
    if (!list.length) return `<div class="empty">${h(opts.empty || 'Aucun document.')}</div>`;
    const cur = company().currency;
    const sorted = applySort(list, cols, opts.sort);
    // Le pied de tableau totalise toute la sélection, pas seulement la page affichée :
    // un total qui changerait en tournant les pages ne voudrait rien dire.
    const mixed = sorted.some(d => docCur(d) !== cur);
    const totalHT = sorted.reduce((s, d) => s + (d.type === 'avoir' ? -1 : 1) * C.toBase(d, C.computeTotals(d, company()).netHT, company()), 0);
    const totalAmount = sorted.reduce((s, d) => s + C.toBase(d, amountOf(d), company()), 0);
    const totalRest = sorted.reduce((s, d) => s + Math.max(0, C.toBase(d, restOf(d) || 0, company())), 0);
    const paged = opts.page ? paginate(sorted, opts.page) : { rows: sorted, pg: null };
    return `<table class="list sortable"><thead>
        ${sortHead(opts.onSort ? cols : cols.map(c => ({ ...c, val: null })), opts.sort, '<th class="row-actions-h"></th>')}
      </thead><tbody>
      ${paged.rows.map(d => `<tr class="clickable" data-id="${d.id}">
        ${cols.map(c => `<td class="${c.r ? 'r nw' : ''}${c.cls ? ' ' + c.cls : ''}">${c.get(d)}</td>`).join('')}
        <td class="row-actions"><span>
          <button class="btn btn-sm" data-pdf="${d.id}" title="Exporter en PDF">PDF</button>
          ${d.number ? `<button class="btn btn-sm" data-mail="${d.id}" title="Envoyer par email">Email</button>` : ''}
          ${d.type === 'facture' && d.status !== 'brouillon' && d.status !== 'annulée' && (restOf(d) || 0) > 0.0005 ? `<button class="btn btn-sm" data-paye="${d.id}" title="Enregistrer un paiement">Paiement</button>` : ''}
          ${d.type !== 'avoir' ? `<button class="btn btn-sm btn-ghost" data-dup="${d.id}" title="Dupliquer">⧉</button>` : ''}
        </span></td></tr>`).join('')}
    </tbody><tfoot><tr>
      <td colspan="${Math.max(1, cols.length - (opts.quotes ? 1 : 2))}">${sorted.length} document${sorted.length > 1 ? 's' : ''} · ${C.money(totalHT, cur)} HT${mixed ? ` <span class="muted">(devises étrangères converties en ${h(cur)})</span>` : ''}</td>
      <td class="r">${C.money(totalAmount, cur)}</td>
      ${opts.quotes ? '' : `<td class="r">${totalRest > 0.0005 ? C.money(totalRest, cur) : '<span class="muted">—</span>'}</td>`}
      <td></td></tr></tfoot></table>
      ${paged.pg ? pagerBar(paged.pg, { noun: 'document', grandTotal: opts.grandTotal }) : ''}`;
  }

  function bindDocTable(redraw, state, anchor) {
    $$('tr.clickable[data-id]').forEach(tr => tr.onclick = e => { if (e.target.closest('button')) return; navigate('#/doc/' + tr.dataset.id); });
    $$('button[data-pdf]').forEach(b => b.onclick = () => exportPdf(docById(b.dataset.pdf)));
    $$('button[data-mail]').forEach(b => b.onclick = () => sendByEmail(docById(b.dataset.mail)));
    $$('button[data-paye]').forEach(b => b.onclick = () => paymentForm(docById(b.dataset.paye), () => (redraw || render)()));
    $$('button[data-dup]').forEach(b => b.onclick = () => duplicateDoc(docById(b.dataset.dup)));
    if (redraw) bindSort(document, redraw);
    if (redraw && state) bindPager(document, state, () => redraw(), anchor);
  }

  // Duplication d'un document : nouveau brouillon aux dates du jour, sans paiement ni rattachement
  function duplicateDoc(doc) {
    const isQ = doc.type === 'devis';
    const copy = { ...deepCopy(doc), id: C.uid(), number: '', status: 'brouillon', date: C.today(), createdAt: Date.now(), payments: [], emails: [], reminders: [], withholdingCertificate: false, fromQuoteId: undefined, fromQuoteNumber: undefined, deposit: undefined, settles: undefined, recurringId: undefined };
    copy.dueDate = C.addDays(copy.date, isQ ? company().quoteValidityDays : company().paymentTermsDays);
    if (isQ) copy.number = C.nextNumber(data, 'devis', copy.date);
    data.documents.push(copy); save(true);
    toast(isQ ? 'Copie créée : ' + copy.number : 'Brouillon créé à partir de ' + (doc.number || 'ce brouillon'));
    navigate('#/doc/' + copy.id);
  }

  // brouillons (sans numéro) en tête, puis numéros décroissants
  const byNumberDesc = (a, b) => ((a.number ? 1 : 0) - (b.number ? 1 : 0)) || (b.number || '').localeCompare(a.number || '', undefined, { numeric: true }) || (b.createdAt || 0) - (a.createdAt || 0);

  const listState = {
    devis: { q: '', st: '', kind: '', year: '', sort: null, page: 1, yearAuto: false, yearTouched: false },
    facture: { q: '', st: '', kind: '', year: '', sort: null, page: 1, yearAuto: false, yearTouched: false }
  };

  function listView(type) {
    const isQ = type === 'devis';
    const s = listState[type];
    const { cols } = docColumns({ quotes: isQ });
    const mine = data.documents.filter(d => isQ ? d.type === 'devis' : (d.type === 'facture' || d.type === 'avoir'));
    const years = Array.from(new Set(mine.map(d => (d.date || '').slice(0, 4)).filter(Boolean))).sort().reverse();
    const thisYear = C.today().slice(0, 4);
    // Par défaut on montre l'année en cours si elle contient quelque chose : une liste courte se lit, une liste de trois ans ne se lit pas.
    // C'est signalé sous les filtres : sans ça on croit avoir perdu les documents des années précédentes.
    if (s.year === '' && !s.yearTouched && years.includes(thisYear) && mine.length > 25) { s.year = thisYear; s.yearAuto = true; }
    if (s.year && !years.includes(s.year)) { s.year = ''; s.yearAuto = false; }

    const draw = (sortKey) => {
      if (sortKey) { s.sort = toggleSort(s.sort, sortKey, cols); s.page = 1; }
      const list = mine
        .filter(d => !s.kind || d.type === s.kind)
        .filter(d => !s.year || (d.date || '').startsWith(s.year))
        .filter(d => !s.st || effStatus(d) === s.st)
        .filter(d => !s.q || [d.number, clientName(d.clientId), d.subject, d.reference].join(' ').toLowerCase().includes(s.q))
        .sort(byNumberDesc);
      const filtered = !!(s.q || s.st || s.kind || s.year);
      $('#list-wrap').innerHTML = docTable(list, {
        quotes: isQ, sort: s.sort, onSort: true, page: s, grandTotal: mine.length,
        empty: filtered ? 'Aucun document ne correspond à ces filtres. Clique « Réinitialiser les filtres » pour tout revoir.' : (isQ ? 'Aucun devis. Crée le premier avec le bouton en haut à droite.' : 'Aucune facture. Crée la première avec le bouton en haut à droite.')
      });
      const note = $('#f-note');
      note.hidden = !filtered;
      note.innerHTML = !filtered ? '' :
        `<span class="small muted">${list.length} sur ${mine.length}${s.year && s.yearAuto ? ` · année ${h(s.year)} affichée par défaut` : ''}</span>${filterReset(true)}`;
      if ($('#reset-f')) $('#reset-f').onclick = resetFilters;
      bindDocTable(draw, s, '#list-wrap');
    };
    const resetFilters = () => { s.q = ''; s.st = ''; s.kind = ''; s.year = ''; s.yearAuto = false; s.yearTouched = true; s.page = 1; listView(type); };
    const statuses = isQ ? C.DISPLAY_STATUSES.devis : [...C.DISPLAY_STATUSES.facture, 'émis'];
    $('#view').innerHTML = `
      <div class="page-head"><h1>${isQ ? 'Devis' : 'Factures'}</h1>
        <div class="actions">${isQ ? '' : '<button class="btn" id="new-avoir">+ Avoir</button>'}<button class="btn btn-primary" id="new">+ ${isQ ? 'Nouveau devis' : 'Nouvelle facture'}</button></div></div>
      <div class="filters">
        <input type="text" id="q" placeholder="Rechercher : n°, client, objet…" value="${h(s.q)}">
        ${isQ ? '' : `<select id="kind"><option value="">Factures et avoirs</option><option value="facture" ${s.kind === 'facture' ? 'selected' : ''}>Factures</option><option value="avoir" ${s.kind === 'avoir' ? 'selected' : ''}>Avoirs</option></select>`}
        <select id="st"><option value="">Tous les statuts</option>${statuses.map(x => `<option value="${x}" ${s.st === x ? 'selected' : ''}>${h(C.statusLabel(x))}</option>`).join('')}</select>
        ${years.length > 1 ? `<select id="yr"><option value="">Toutes les années</option>${years.map(y => `<option value="${y}" ${s.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}
        ${info('list.filters')}
        <span class="f-note" id="f-note" hidden></span>
      </div>
      <div id="list-wrap"></div>`;
    $('#new').onclick = () => navigate('#/doc/new/' + type);
    if ($('#new-avoir')) $('#new-avoir').onclick = () => navigate('#/doc/new/avoir');
    $('#q').oninput = e => { s.q = e.target.value.toLowerCase(); s.page = 1; draw(); };
    $('#st').onchange = e => { s.st = e.target.value; s.page = 1; draw(); };
    if ($('#yr')) $('#yr').onchange = e => { s.year = e.target.value; s.yearAuto = false; s.yearTouched = true; s.page = 1; draw(); };
    if ($('#kind')) $('#kind').onchange = e => { s.kind = e.target.value; s.page = 1; draw(); };
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
      if (type === 'avoir' && parts[2] && parts[2] !== 'tpl' && parts[2] !== 'client') { const inv = docById(parts[2]); if (inv) Object.assign(doc, creditDraftFrom(inv)); }
      if (parts[2] === 'tpl' && parts[3]) applyTemplate(doc, parts[3]);
      // Depuis la fiche client : le client est déjà choisi, avec sa langue, sa devise et sa retenue
      if (parts[2] === 'client' && parts[3] && clientById(parts[3])) {
        doc.clientId = parts[3];
        applyClientDefaults(doc, doc.clientId);
        if (type !== 'devis') doc.withholdingRate = clientWithholding(doc.clientId);
      }
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

    const clientItems = () => data.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(c => ({
      v: c.id, label: c.name, sub: [c.contact, c.matricule ? 'MF ' + c.matricule : ''].filter(Boolean).join(' · '),
      text: `${c.name} ${c.contact || ''} ${c.email || ''} ${c.phone || ''} ${c.matricule || ''}`
    }));
    const invoiceItems = () => data.documents.filter(d => d.type === 'facture' && d.status !== 'brouillon' && d.number).sort(byNumberDesc).map(d => ({
      v: d.id, label: d.number, sub: clientName(d.clientId) + (d.subject ? ' — ' + d.subject : ''),
      right: C.money(C.computeTotals(d, company()).netToPay, docCur(d)),
      text: `${d.number} ${clientName(d.clientId)} ${d.subject || ''}`
    }));

    const title = isNew ? (isQ ? 'Nouveau devis' : isInv ? 'Nouvelle facture' : 'Nouvel avoir') : docLabel(doc);
    const statusCell = isQ
      ? `<label class="field">${lbl('Statut', 'ed.statusQuote')}<select name="status">${C.STATUSES.devis.map(s => `<option ${s === doc.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`
      : `<div class="field">${lbl('Statut', isInv ? 'ed.statusInvoice' : '')}<div class="status-cell">${isNew || doc.status === 'brouillon' ? `${badge('brouillon')}<span class="small muted">numéro attribué à l'émission</span> ${info('ed.draftNumber')}` : (isInv ? statusBadge(stored) : badge(doc.status))}</div></div>`;

    // « Facturer ▾ » regroupe ce qu'on fait d'un devis accepté : les trois chemins de facturation
    const facturerMenu = !isNew && isQ ? `<div class="more"><button class="btn" id="bill-btn">Facturer ▾</button><div class="more-list" id="bill-list" hidden>
        <button id="convert">Convertir en facture</button>
        <button id="deposit">Facture d'acompte…</button>
        ${issuedDeposits.length ? `<button id="settle">Facture de solde (${issuedDeposits.length} acompte${issuedDeposits.length > 1 ? 's' : ''} déduit${issuedDeposits.length > 1 ? 's' : ''})</button>` : ''}
      </div></div>` : '';

    $('#view').innerHTML = `
      <div class="page-head">
        <div><h1>${h(title)} <span class="dirty-dot" id="dirty-dot" hidden title="Modifications non enregistrées">non enregistré</span></h1>${locked ? `<div class="small muted lock-note">Document émis : il n'est plus modifiable${isInv ? ' — pour corriger, crée un avoir' : ''}. ${info('ed.locked')}</div>` : ''}</div>
        <div class="actions">
          ${!isNew && (locked || isQ) ? `<button class="btn" id="email">Email</button>` : ''}
          <button class="btn" id="pdf">PDF</button>
          ${locked && isInv && doc.status !== 'annulée' ? `<button class="btn btn-primary" id="pay">Enregistrer un paiement</button>` : ''}
          ${facturerMenu}
          ${!locked ? `<button class="btn ${isQ ? 'btn-primary' : ''}" id="save">Enregistrer${isQ ? '' : ' le brouillon'}</button>` : ''}
          ${!locked && !isQ ? `<button class="btn btn-primary" id="issue">${isInv ? 'Émettre la facture' : 'Émettre l\'avoir'}</button> ${info('ed.issue')}` : ''}
          ${!isNew ? `<div class="more"><button class="btn" id="more-btn" aria-label="Autres actions">Plus ▾</button><div class="more-list" id="more-list" hidden>
            ${!isAv ? `<button id="dup">Dupliquer</button><button id="as-template">Enregistrer comme modèle…</button>` : ''}
            ${isInv ? `<button id="make-recurring">Rendre récurrent (contrat)…</button>` : ''}
            ${locked && isInv && doc.status !== 'annulée' ? `<button id="credit">Créer un avoir…</button>` : ''}
            ${canUnlock ? `<button id="unlock">Modifier malgré l'émission…</button>` : ''}
            ${!locked ? `<button id="del" class="danger">Supprimer</button>` : ''}
          </div></div>` : ''}
        </div></div>
      <div class="editor">
        <div>
          <div class="panel"><h2>Informations</h2>
            <form id="f-head" class="grid-3">
              <div class="field">${lbl('Client', 'ed.client')}
                ${combo({ name: 'clientId', value: doc.clientId, items: clientItems(), placeholder: '— Choisir un client —', search: 'Rechercher : nom, contact, MF…', add: locked ? null : '+ Nouveau client', ro: locked })}
              </div>
              ${isAv ? `<div class="field span-2">Facture concernée${combo({ name: 'creditOf', value: doc.creditOf, items: invoiceItems(), placeholder: '— Facture concernée —', search: 'Rechercher : n°, client, objet…', ro: locked })}</div>` : ''}
              ${dateFieldHtml(lbl('Date', 'ed.date'), 'date', doc.date, { ro: locked })}
              ${isAv ? '' : dateFieldHtml(isQ ? lbl('Valable jusqu\'au', 'ed.validUntil') : lbl('Échéance', 'ed.due'), 'dueDate', doc.dueDate, { ro: locked, quick: true })}
              <label class="field span-2">${lbl('Objet', 'ed.subject')}<input type="text" name="subject" value="${h(doc.subject)}" placeholder="Ex : Audit de sécurité du réseau" ${ro}></label>
              ${field(lbl('Référence (optionnel)', 'ed.reference'), 'reference', doc.reference || '', 'text', ro)}
              ${isAv ? field('Motif de l\'avoir', 'creditReason', doc.creditReason || '', 'text', ro + ' placeholder="Erreur de facturation, remise commerciale…"') : ''}
              <label class="field">${lbl('Langue du document', 'ed.lang')}<select name="lang" ${ro}><option value="fr" ${doc.lang !== 'en' ? 'selected' : ''}>Français</option><option value="en" ${doc.lang === 'en' ? 'selected' : ''}>English</option></select></label>
              <label class="field">${lbl('Devise', 'ed.docCurrency')}<select name="currency" ${ro}>${C.CURRENCIES.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
              <label class="field" id="rate-field" ${cur === company().currency ? 'hidden' : ''}><span class="fl"><span class="rate-lbl">Taux : 1 ${h(cur)} = ? ${h(company().currency)}</span> ${info('ed.rate')}</span><input type="number" name="exchangeRate" value="${h(doc.exchangeRate || '')}" step="0.0001" min="0" class="num" placeholder="ex. 3.4" ${ro}></label>
              ${statusCell}
              ${field(lbl('Remise globale (%)', 'ed.discount'), 'discountRate', doc.discountRate || 0, 'number', 'min="0" max="100" step="0.5" class="num" ' + ro)}
              ${!isQ ? `<label class="field">${lbl('Retenue à la source', 'ed.withholding')}<select name="withholdingRate" ${ro}>${withholdingOptions(doc.withholdingRate)}</select></label>` : ''}
              ${!isQ ? `<label class="check" style="align-self:end"><input type="checkbox" name="applyStamp" ${doc.applyStamp === true || (isInv && doc.applyStamp !== false) ? 'checked' : ''} ${ro}> Timbre fiscal (${C.money(company().stampFee, cur)}) ${info('ed.applyStamp')}</label>` : ''}
            </form>
          </div>
          <div class="panel"><h2>Lignes ${info('ed.lines')}</h2>
            ${locked ? '' : `<div class="catalog-pick">
              ${templatesFor(doc.type).length ? `<div id="tpl-pick">${combo({ items: [], placeholder: 'Depuis un modèle…', search: 'Rechercher un modèle…' })}</div>` : ''}
              <div id="cat-pick">${combo({ items: [], placeholder: 'Ajouter depuis le catalogue…', search: 'Rechercher une prestation…' })}</div>
              <button class="btn btn-sm" id="add-line">+ Ligne vide</button>
            </div>`}
            <table class="lines-edit"><thead><tr><th>Désignation</th><th style="width:62px">Qté</th><th style="width:104px">Unité ${info('ed.unit')}</th><th style="width:92px">P.U. HT</th><th style="width:80px">TVA ${info('ed.vat')}</th><th class="r">Total HT</th><th></th></tr></thead>
              <tbody id="lines"></tbody></table>
            <div class="totals-box" id="totals"></div>
          </div>
          ${bal ? `<div class="panel" id="pay-panel"><h2>Paiements et situation ${info('ed.payments')}</h2><div id="pay-body"></div></div>` : ''}
          ${isNew ? '' : `<div class="panel"><h2>Historique ${info('ed.history')}</h2><div id="doc-history"></div></div>`}
          <div class="panel"><h2>Notes (affichées sur le document) ${info('ed.notes')}</h2>
            ${!locked && data.snippets.length ? `<div class="catalog-pick"><div id="snip-pick">${combo({ items: [], placeholder: 'Insérer un texte prédéfini…', search: 'Rechercher un texte…' })}</div></div>` : ''}
            <textarea id="notes" placeholder="Conditions particulières, mentions…" ${ro}>${h(doc.notes || '')}</textarea>
          </div>
        </div>
        <div class="preview">
          <div class="pv-head"><span class="k-label">Aperçu ${info('ed.preview')}</span><span class="pv-pages" id="pv-pages"></span><button class="btn btn-ghost btn-sm" id="pv-hide">Masquer</button></div>
          <iframe id="preview" title="Aperçu du document"></iframe>
        </div>
      </div>`;
    // Aperçu masqué : le choix est mémorisé d'un document à l'autre
    const applyPreview = () => {
      const ed = $('.editor'); if (!ed) return;
      ed.classList.toggle('no-preview', previewHidden);
      const b = $('#pv-hide'); if (b) b.textContent = previewHidden ? 'Afficher l\'aperçu' : 'Masquer';
    };
    $('#pv-hide').onclick = () => { previewHidden = !previewHidden; try { localStorage.setItem('skanfact.preview', previewHidden ? '0' : '1'); } catch (_) {} applyPreview(); if (!previewHidden) drawPreview(); };
    applyPreview();

    // --- modifications non enregistrées : marqueur visible + garde-fou à la navigation
    let dirty = false;
    function touch() {
      if (dirty || locked) return;
      dirty = true;
      const el = $('#dirty-dot'); if (el) el.hidden = false;
      const s = $('#save'); if (s) s.classList.add('btn-primary');
    }
    function untouch() { dirty = false; const el = $('#dirty-dot'); if (el) el.hidden = true; }
    if (!locked) setGuard({
      dirty: () => dirty,
      what: isQ ? 'ce devis' : isInv ? 'cette facture' : 'cet avoir',
      save: () => { const ok = persist(); if (ok) untouch(); return ok; }
    });

    // --- lignes
    const linesBody = $('#lines');
    const openDesc = new Set();   // lignes dont la description est dépliée
    doc.lines.forEach((l, i) => { if (l.description) openDesc.add(i); });
    function drawLines() {
      const n = doc.lines.length;
      // Unités déjà employées ailleurs dans les données, plus celles du document en cours :
      // une unité saisie une fois reste proposée.
      const extraUnits = C.usedUnits(data, doc.lines.map(l => l.unit));
      linesBody.innerHTML = doc.lines.map((l, i) => `<tr data-i="${i}">
        <td><input type="text" data-k="label" value="${h(l.label)}" placeholder="Désignation" ${ro}>
            ${openDesc.has(i)
              ? `<textarea data-k="description" placeholder="Description : ce que comprend la prestation" ${ro}>${h(l.description || '')}</textarea>`
              : (locked ? '' : `<button type="button" class="link-add" data-desc="${i}">+ description</button>`)}</td>
        <td><input type="number" class="num" data-k="qty" value="${l.qty}" step="0.01" ${ro}></td>
        <td><select data-k="unit" ${ro}>${unitOptions(l.unit, extraUnits)}</select></td>
        <td><input type="number" class="num" data-k="unitPrice" value="${l.unitPrice}" step="0.001" ${ro}></td>
        <td><select data-k="vatRate" ${ro}>${C.VAT_RATES.map(r => `<option value="${r}" ${Number(l.vatRate) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select></td>
        <td class="total" data-total="${i}"></td>
        <td class="line-tools">${locked ? '' : `
          <button class="btn btn-ghost btn-sm" data-up="${i}" title="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-ghost btn-sm" data-down="${i}" title="Descendre" ${i === n - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn btn-ghost btn-sm" data-dup="${i}" title="Dupliquer la ligne">⧉</button>
          <button class="btn btn-ghost btn-sm" data-rm="${i}" title="Supprimer la ligne">✕</button>`}</td></tr>`).join('');
      $$('[data-k]', linesBody).forEach(el => {
        if (el.dataset.k === 'unit') return;   // traité juste après : « Autre… » ouvre une saisie libre
        el.oninput = () => {
          const i = Number(el.closest('tr').dataset.i);
          doc.lines[i][el.dataset.k] = el.type === 'number' ? Number(el.value) : el.value;
          touch(); refreshTotals();
        };
      });
      $$('select[data-k=unit]', linesBody).forEach(sel => {
        const i = Number(sel.closest('tr').dataset.i);
        bindUnitSelect(sel, () => doc.lines[i].unit, u => { doc.lines[i].unit = u; touch(); refreshTotals(); });
      });
      // Réordonner : on déplace aussi les descriptions dépliées pour qu'elles suivent leur ligne
      const reindex = map => { const next = new Set(); openDesc.forEach(i => next.add(map(i))); openDesc.clear(); next.forEach(i => openDesc.add(i)); };
      const swap = (i, j) => { const t = doc.lines[i]; doc.lines[i] = doc.lines[j]; doc.lines[j] = t; reindex(k => k === i ? j : k === j ? i : k); touch(); drawLines(); };
      $$('[data-up]', linesBody).forEach(b => b.onclick = () => swap(Number(b.dataset.up), Number(b.dataset.up) - 1));
      $$('[data-down]', linesBody).forEach(b => b.onclick = () => swap(Number(b.dataset.down), Number(b.dataset.down) + 1));
      $$('[data-dup]', linesBody).forEach(b => b.onclick = () => {
        const i = Number(b.dataset.dup);
        doc.lines.splice(i + 1, 0, deepCopy(doc.lines[i]));
        reindex(k => k > i ? k + 1 : k); if (doc.lines[i + 1].description) openDesc.add(i + 1);
        touch(); drawLines();
      });
      $$('[data-rm]', linesBody).forEach(b => b.onclick = () => {
        const i = Number(b.dataset.rm);
        doc.lines.splice(i, 1); if (!doc.lines.length) doc.lines.push({ label: '', description: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19 });
        reindex(k => k > i ? k - 1 : k); openDesc.delete(doc.lines.length);
        touch(); drawLines();
      });
      $$('[data-desc]', linesBody).forEach(b => b.onclick = () => { openDesc.add(Number(b.dataset.desc)); drawLines(); const ta = $$('textarea[data-k=description]', linesBody).pop(); if (ta) ta.focus(); });
      refreshTotals();
    }
    if ($('#add-line')) $('#add-line').onclick = () => { doc.lines.push({ label: '', description: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19 }); touch(); drawLines(); $$('input[data-k=label]', linesBody).pop().focus(); };
    // Catalogue, modèles et textes : listes de choix qui ne gardent pas de valeur (reset), avec recherche.
    if ($('#cat-pick')) bindCombo($('.combo', $('#cat-pick')), {
      reset: true, placeholder: 'Ajouter depuis le catalogue…',
      items: data.catalog.slice().sort((a, b) => a.label.localeCompare(b.label, 'fr')).map(c => ({
        v: c.id, label: c.label, sub: c.description || '', right: C.money(c.unitPrice, cur) + ' HT',
        text: `${c.label} ${c.description || ''} ${c.unit || ''}`
      })),
      onPick: id => {
        const it = data.catalog.find(c => c.id === id); if (!it) return;
        if (doc.lines.length === 1 && !doc.lines[0].label && !doc.lines[0].unitPrice) { doc.lines = []; openDesc.clear(); }
        doc.lines.push({ label: it.label, description: it.description || '', qty: 1, unit: it.unit || '', unitPrice: it.unitPrice, vatRate: it.vatRate });
        if (it.description) openDesc.add(doc.lines.length - 1);
        touch(); drawLines();
      }
    });
    if ($('#tpl-pick')) bindCombo($('.combo', $('#tpl-pick')), {
      reset: true, placeholder: 'Depuis un modèle…',
      items: templatesFor(doc.type).map(t => ({ v: t.id, label: t.name, sub: t.subject || '', right: `${(t.lines || []).length} ligne${(t.lines || []).length > 1 ? 's' : ''}`, text: `${t.name} ${t.subject || ''}` })),
      onPick: async id => {
        if (doc.lines.some(l => l.label) && !await confirmDialog('Remplacer les lignes actuelles par celles du modèle ?', 'Remplacer', false)) return;
        applyTemplate(doc, id);
        openDesc.clear(); doc.lines.forEach((l, i) => { if (l.description) openDesc.add(i); });
        $('input[name=subject]', head).value = doc.subject; $('input[name=discountRate]', head).value = doc.discountRate || 0; $('#notes').value = doc.notes || '';
        touch(); drawLines();
      }
    });
    if ($('#snip-pick')) bindCombo($('.combo', $('#snip-pick')), {
      reset: true, placeholder: 'Insérer un texte prédéfini…',
      items: data.snippets.map(x => ({ v: x.id, label: x.name, sub: (x.text || '').slice(0, 90), text: `${x.name} ${x.text || ''}` })),
      onPick: id => {
        const sn = data.snippets.find(x => x.id === id); if (!sn) return;
        doc.notes = (doc.notes ? doc.notes.replace(/\s+$/, '') + '\n' : '') + sn.text;
        $('#notes').value = doc.notes; touch(); schedulePreview();
      }
    });

    // --- en-tête
    const head = $('#f-head');
    head.oninput = head.onchange = (e) => {
      const before = doc.clientId;
      Object.assign(doc, formValues(head));
      touch();
      const setRateLabel = () => { const rf = $('#rate-field', head); rf.hidden = cur === company().currency; $('.rate-lbl', rf).textContent = `Taux : 1 ${cur} = ? ${company().currency}`; };
      if (e && e.target && e.target.name === 'currency') {
        cur = docCur(doc);
        setRateLabel();
        drawLines();
      }
      if (e && e.target && e.target.name === 'clientId' && doc.clientId !== before && doc.status === 'brouillon') {
        // nouveau client : on reprend son taux de retenue à la source, sa langue et sa devise
        if (!isQ) { doc.withholdingRate = clientWithholding(doc.clientId); const sel = $('select[name=withholdingRate]', head); if (sel) sel.innerHTML = withholdingOptions(doc.withholdingRate); }
        applyClientDefaults(doc, doc.clientId);
        $('select[name=lang]', head).value = doc.lang || 'fr'; $('select[name=currency]', head).value = docCur(doc);
        cur = docCur(doc); setRateLabel();
        drawLines();
      }
      if (e && e.target && e.target.name === 'creditOf') {
        const inv = docById(doc.creditOf); if (inv) { doc.creditOfNumber = inv.number; if (!doc.clientId) { doc.clientId = inv.clientId; clientCombo.setValue(inv.clientId, true); } }
      }
      refreshTotals();
    };
    $('#notes').oninput = e => { doc.notes = e.target.value; touch(); schedulePreview(); };
    // Le client se choisit dans une liste avec recherche : au-delà d'une poignée de clients, un <select> devient
    // une corvée. « + Nouveau client » crée la fiche et la sélectionne dans la foulée.
    const clientCombo = bindCombo($('[data-combo=clientId]', head), {
      items: clientItems(), placeholder: '— Choisir un client —',
      onAdd: () => clientForm(null, c => { clientCombo.setItems(clientItems()); clientCombo.setValue(c.id); })
    });
    bindCombo($('[data-combo=creditOf]', head), { items: invoiceItems(), placeholder: '— Facture concernée —' });

    // --- totaux + aperçu
    let previewTimer = null;
    function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(drawPreview, 250); }
    previewRedraw = schedulePreview;
    function drawPreview() {
      const pv = $('#preview'); if (!pv || previewHidden) return; // masqué, ou l'utilisateur a quitté l'éditeur
      const st = isInv && stored && stored.status !== 'brouillon' ? effStatus(stored) : null;
      const stampText = st === 'payée' ? 'Payée' : st === 'annulée' ? 'Annulée' : undefined;
      const html = C.documentHtml(doc, clientById(doc.clientId), company(), { preview: true, stampText, zoom: Math.max(0.3, Math.floor((pv.clientWidth - 2) / 794 * 100) / 100) });
      pv.onload = () => {
        try {
          const compact = C.fitToPage(pv.contentDocument);   // même resserrement que le PDF
          const pages = C.pageCount(pv.contentDocument);
          const el = $('#pv-pages');
          if (el) {
            el.textContent = pages <= 1 ? (compact ? '1 page (resserrée)' : '1 page') : pages + ' pages';
            el.className = 'pv-pages' + (pages > 1 ? ' warn' : '');
            el.title = pages > 1
              ? 'Le document ne tient pas sur une page. Raccourcis les descriptions ou les notes si tu veux le ramener à une seule.'
              : (compact ? 'Les marges ont été resserrées automatiquement pour tenir sur une page.' : 'Le document tient sur une page.');
          }
        } catch (_) { /* aperçu indisponible */ }
      };
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
          <div><div class="k-label">Net à payer</div><div class="v">${C.money(t.netToPay, cur)}</div>${t.withholding ? `<div class="small muted">TTC ${C.money(t.totalTTC, cur)} − RS ${C.money(t.withholding, cur)} ${info('ed.withholding')}</div>` : ''}</div>
          <div><div class="k-label">Avoirs ${info('ed.credit')}</div><div class="v">${C.money(b.credited, cur)}</div>${b.credits.length ? `<div class="small">${b.credits.map(a => `<a href="#/doc/${a.id}">${h(a.number)}</a>`).join(', ')}</div>` : ''}</div>
          <div><div class="k-label">Payé</div><div class="v">${C.money(b.paid, cur)}</div></div>
          <div><div class="k-label">Reste à payer</div><div class="v ${b.remaining > 0.0005 ? 'due' : 'ok'}">${C.money(Math.max(0, b.remaining), cur)}</div>${b.remaining < -0.0005 ? `<div class="small muted">trop-perçu ${C.money(-b.remaining, cur)}</div>` : ''}</div>
        </div>
        ${rows.length ? `<table class="list compact"><thead><tr><th>Date</th><th>Mode</th><th>Référence</th><th class="r">Montant</th><th></th></tr></thead><tbody>
          ${rows.map(p => `<tr><td>${C.fmtDate(p.date)}</td><td>${h(methodLabel(p.method))}</td><td>${h(p.reference || '')}${p.note ? `<div class="small muted">${h(p.note)}</div>` : ''}</td><td class="r">${C.money(p.amount, cur)}</td><td class="actions"><button class="btn btn-ghost btn-sm" data-rmpay="${p.id}" title="Supprimer">✕</button></td></tr>`).join('')}
        </tbody></table>` : `<p class="small muted">Aucun paiement enregistré.</p>`}
        <div class="inline mt">
          ${s.status !== 'annulée' && b.remaining > 0.0005 ? `<button class="btn btn-primary" id="pay2">+ Enregistrer un paiement</button>` : ''}
          ${t.withholding ? `<label class="check"><input type="checkbox" id="rs-cert" ${s.withholdingCertificate ? 'checked' : ''}> Attestation de retenue à la source reçue (${C.money(t.withholding, cur)}) ${info('compta.rs')}</label>` : ''}
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
      if (!isAv && doc.dueDate && doc.date && doc.dueDate < doc.date) { toast(`${isQ ? 'La validité' : 'L\'échéance'} ne peut pas précéder la date du document.`, true); return false; }
      return true;
    }
    // Ce qui rendrait le document non conforme sans empêcher l'émission : on prévient, l'utilisateur décide
    function issueWarnings() {
      const w = [];
      const co = company();
      if (!(co.name || '').trim() || !(co.matricule || '').trim()) w.push('Ta fiche société est incomplète (raison sociale ou matricule fiscal) : le document ne sera pas conforme. Paramètres → Société.');
      if (isInv && !(co.rib || '').trim()) w.push('Aucun RIB n\'est renseigné : le client ne saura pas où virer le paiement.');
      const last = data.documents.filter(d => d.type === doc.type && d.id !== doc.id && d.number && d.status !== 'brouillon' && (d.date || '').slice(0, 4) === (doc.date || '').slice(0, 4)).sort(byNumberDesc)[0];
      if (last && last.date > doc.date) w.push(`La date (${C.fmtDate(doc.date)}) est antérieure à la dernière ${isInv ? 'facture' : 'pièce'} émise, ${last.number} du ${C.fmtDate(last.date)} : la numérotation ne serait plus chronologique.`);
      return w;
    }
    function persist() {
      if (!validate()) return false;
      if (isQ && !doc.number) doc.number = C.nextNumber(data, 'devis', doc.date);
      if (isAv && doc.creditOf) { const inv = docById(doc.creditOf); if (inv) doc.creditOfNumber = inv.number; }
      const idx = data.documents.findIndex(d => d.id === doc.id);
      const clean = deepCopy(doc);
      if (idx >= 0) data.documents[idx] = clean; else data.documents.push(clean);
      save(true);
      untouch();
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
    if ($('#save')) $('#save').onclick = () => { if (persist()) { toast(isQ ? 'Enregistré : ' + doc.number : 'Brouillon enregistré'); unlockedIds.delete(doc.id); if (isNew) navigate('#/doc/' + doc.id); else render(true); } };
    if ($('#issue')) $('#issue').onclick = async () => {
      if (!validate()) return;
      const n = doc.number || peekNumber(doc.type, doc.date);
      const warn = issueWarnings();
      if (!await confirmDialog(`Émettre ${isInv ? 'la facture' : 'l\'avoir'} ${n} ? Le numéro devient définitif et le document ne sera plus modifiable. Pour corriger après coup, il faudra faire un avoir.${warn.length ? '\n\n⚠ ' + warn.join('\n⚠ ') : ''}`, warn.length ? 'Émettre quand même' : 'Émettre', false)) return;
      if (issue()) { if (isNew) navigate('#/doc/' + doc.id); else render(); }
    };
    if ($('#bill-btn')) $('#bill-btn').onclick = e => { e.stopPropagation(); const l = $('#bill-list'); const open = l.hidden; closeMenus(); l.hidden = !open; };
    $$('#bill-list button').forEach(b => b.addEventListener('click', () => { $('#bill-list').hidden = true; }));
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
    if ($('#dup')) $('#dup').onclick = () => { untouch(); duplicateDoc(doc); };
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
    if ($('#more-btn')) $('#more-btn').onclick = e => { e.stopPropagation(); const l = $('#more-list'); const open = l.hidden; closeMenus(); l.hidden = !open; };
    $$('#more-list button').forEach(b => b.addEventListener('click', () => { $('#more-list').hidden = true; }));

    // --- historique (reconstitué à partir de ce qui est enregistré : envois, relances, paiements, avoirs)
    function drawHistory() {
      const el = $('#doc-history'); if (!el) return;
      const ev = C.documentHistory(docById(doc.id) || doc, data, company());
      el.innerHTML = ev.length
        ? `<ul class="timeline">${ev.map(e => `<li class="k-${h(e.kind)}">
            <div class="tl-h">${e.id ? `<a href="#/doc/${e.id}">${h(e.label)}</a>` : h(e.label)}</div>
            <div class="tl-d">${e.date ? C.fmtDate(e.date) : ''}${e.date && e.detail ? ' · ' : ''}${h(e.detail || '')}</div></li>`).join('')}</ul>`
        : '<p class="small muted">Rien à afficher pour l\'instant.</p>';
    }

    drawLines();
    drawPayments();
    drawHistory();
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
        ${dateFieldHtml('Date', 'date', C.today())}
        ${field('Montant', 'amount', Math.max(0, b.remaining), 'number', 'step="0.001" min="0" class="num"')}
        <label class="field">Mode<select name="method">${C.PAYMENT_METHODS.map(m => `<option value="${m[0]}">${m[1]}</option>`).join('')}</select></label>
        ${field('Référence (n° chèque, virement…)', 'reference', '')}
        <label class="field span-2">Note<input type="text" name="note" value=""></label>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => { $('#ok', root).onclick = async () => {
        const v = formValues($('#pf2', root));
        if (!(Number(v.amount) > 0)) return toast('Montant invalide.', true);
        if (!v.date) return toast('Date obligatoire.', true);
        if (v.date > C.today() && !await confirmDialog(`La date du paiement (${C.fmtDate(v.date)}) est dans le futur. Un paiement s'enregistre quand l'argent est reçu, pas quand il est promis. Enregistrer quand même ?`, 'Enregistrer quand même')) return;
        if (Number(v.amount) > b.remaining + 0.0005 && !await confirmDialog(`Le montant (${C.money(v.amount, cur)}) dépasse le reste à payer (${C.money(Math.max(0, b.remaining), cur)}). La facture apparaîtra avec un trop-perçu. Enregistrer quand même ?`, 'Enregistrer quand même')) return;
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
    const c = client || { id: C.uid(), name: '', contact: '', matricule: '', address: '', phone: '', email: '', notes: '', withholdingRate: '' };
    modal(`<h2>${client ? 'Modifier le client' : 'Nouveau client'}</h2>
      <form id="cf" class="grid-2">
        <label class="field span-2">Nom / Raison sociale<input type="text" name="name" value="${h(c.name)}" required></label>
        ${field(lbl('Personne à contacter', 'cl.contact'), 'contact', c.contact || '', 'text', 'placeholder="Mme Leïla Mansour, directrice"')}
        ${field(lbl('Matricule fiscal / CIN', 'co.matricule'), 'matricule', c.matricule)}
        <label class="field">${lbl('Retenue à la source appliquée par ce client', 'ed.withholding')}<select name="withholdingRate"><option value="" ${c.withholdingRate === '' || c.withholdingRate == null ? 'selected' : ''}>Par défaut (${pct(company().defaultWithholdingRate || 0)} %)</option>${C.WITHHOLDING_RATES.map(r => `<option value="${r}" ${String(c.withholdingRate) === String(r) ? 'selected' : ''}>${r === 0 ? 'Aucune' : pct(r) + ' %'}</option>`).join('')}</select></label>
        ${field('Téléphone', 'phone', c.phone)}
        ${field('Email', 'email', c.email, 'email')}
        <label class="field">Langue des documents<select name="lang"><option value="" ${!c.lang ? 'selected' : ''}>Par défaut</option><option value="fr" ${c.lang === 'fr' ? 'selected' : ''}>Français</option><option value="en" ${c.lang === 'en' ? 'selected' : ''}>English</option></select></label>
        <label class="field">Devise<select name="currency"><option value="" ${!c.currency ? 'selected' : ''}>Par défaut (${h(company().currency)})</option>${C.CURRENCIES.map(x => `<option value="${x}" ${c.currency === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="field span-2">Adresse<textarea name="address">${h(c.address)}</textarea></label>
        <label class="field span-2">Notes internes<textarea name="notes">${h(c.notes || '')}</textarea></label>
      </form>
      <div class="modal-actions">
        ${client ? '<button class="btn btn-danger" id="del-client" style="margin-right:auto">Supprimer ce client</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = () => {
          const v = formValues($('#cf', root));
          if (!v.name.trim()) return toast('Le nom est obligatoire.', true);
          Object.assign(c, v, { withholdingRate: v.withholdingRate === '' ? '' : Number(v.withholdingRate) });
          if (!client) data.clients.push(c);
          save(true); close(); if (done) done(c);
        };
        if ($('#del-client', root)) $('#del-client', root).onclick = async () => {
          const n = data.documents.filter(d => d.clientId === c.id).length;
          if (n) return toast(`Impossible : ${n} document(s) sont liés à ce client. Un client qui a une histoire ne se supprime pas.`, true);
          if (!await confirmDialog(`Supprimer ${c.name} ?`)) return;
          data.clients = data.clients.filter(x => x.id !== c.id); save(true); close(); navigate('#/clients');
        };
      });
  }

  const clientState = { q: '', f: '', sort: { key: 'name', dir: 'asc' }, page: 1 };
  const clientDocState = { sort: null, page: 1 };  // liste des documents dans la fiche client

  routes.clients = () => {
    const cur = company().currency;
    const s = clientState;
    const cols = [
      { key: 'name', label: 'Nom', asc: true, val: r => r.c.name.toLowerCase(), get: r => `<strong>${h(r.c.name)}</strong>${r.c.contact ? `<div class="small muted">${h(r.c.contact)}</div>` : ''}` },
      { key: 'mf', label: 'MF / CIN', get: r => `${h(r.c.matricule)}${r.c.withholdingRate !== '' && r.c.withholdingRate != null && Number(r.c.withholdingRate) ? `<div class="small muted">RS ${pct(r.c.withholdingRate)} %</div>` : ''}` },
      { key: 'contact', label: 'Contact', get: r => `<span class="small">${h(r.c.phone)}${r.c.phone && r.c.email ? '<br>' : ''}${h(r.c.email)}</span>` },
      { key: 'docs', label: 'Documents', r: true, val: r => r.sum.count, get: r => r.sum.count },
      { key: 'ht', label: 'Facturé HT', r: true, val: r => r.sum.ht, get: r => r.sum.ht ? C.money(r.sum.ht, cur) : '<span class="muted">—</span>' },
      { key: 'due', label: 'Reste à payer', r: true, val: r => r.sum.due, get: r => r.sum.due > 0.0005 ? `<strong>${C.money(r.sum.due, cur)}</strong>` : '<span class="muted">—</span>' },
      { key: 'last', label: 'Dernier document', val: r => r.sum.last || '', get: r => r.sum.last ? C.fmtDate(r.sum.last) : '<span class="muted">—</span>' }
    ];
    const FILTERS = [['', 'Tous les clients'], ['due', 'Avec un impayé'], ['none', 'Sans aucun document']];
    const draw = (sortKey) => {
      if (sortKey) { s.sort = toggleSort(s.sort, sortKey, cols); s.page = 1; }
      const all = data.clients.map(c => ({ c, sum: C.clientSummary(data, company(), c.id) }));
      const rows = applySort(all
        .filter(r => !s.q || [r.c.name, r.c.contact, r.c.matricule, r.c.email, r.c.phone].join(' ').toLowerCase().includes(s.q))
        .filter(r => !s.f || (s.f === 'due' ? r.sum.due > 0.0005 : r.sum.count === 0)), cols, s.sort);
      const filtered = !!(s.q || s.f);
      const { rows: page, pg } = paginate(rows, s);
      $('#list-wrap').innerHTML = rows.length ? `<table class="list sortable"><thead>
          ${sortHead(cols, s.sort, '<th class="row-actions-h"></th>')}</thead><tbody>
        ${page.map(r => `<tr class="clickable" data-cid="${r.c.id}">
          ${cols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}
          <td class="row-actions"><span>
            <button class="btn btn-sm" data-devis="${r.c.id}" title="Nouveau devis pour ce client">+ Devis</button>
            <button class="btn btn-sm" data-edit="${r.c.id}">Modifier</button>
          </span></td></tr>`).join('')}
        </tbody></table>${pagerBar(pg, { noun: 'client', grandTotal: all.length })}`
        : `<div class="empty">${filtered ? 'Aucun client ne correspond à cette recherche.' : 'Aucun client. Ajoute ton premier client : son adresse et son matricule fiscal se reporteront automatiquement sur tes documents.'}</div>`;
      const note = $('#f-note');
      note.hidden = !filtered;
      note.innerHTML = !filtered ? '' : `<span class="small muted">${rows.length} sur ${all.length}</span>${filterReset(true)}`;
      if ($('#reset-f')) $('#reset-f').onclick = () => { s.q = ''; s.f = ''; s.page = 1; routes.clients(); };
      $$('tr.clickable[data-cid]').forEach(tr => tr.onclick = e => { if (e.target.closest('button')) return; navigate('#/client/' + tr.dataset.cid); });
      $$('[data-edit]').forEach(b => b.onclick = () => clientForm(clientById(b.dataset.edit), () => draw()));
      $$('[data-devis]').forEach(b => b.onclick = () => navigate('#/doc/new/devis/client/' + b.dataset.devis));
      bindSort($('#list-wrap'), draw);
      bindPager($('#list-wrap'), s, () => draw(), '#list-wrap');
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Clients</h1><div class="actions"><button class="btn btn-primary" id="new">+ Nouveau client</button></div></div>
      <div class="filters">
        <input type="text" id="q" placeholder="Rechercher : nom, contact, MF, email…" value="${h(s.q)}">
        <select id="f">${FILTERS.map(([v, l]) => `<option value="${v}" ${s.f === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${info('list.sort')}
        <span class="f-note" id="f-note" hidden></span>
      </div><div id="list-wrap"></div>`;
    $('#new').onclick = () => clientForm(null, () => draw());
    $('#q').oninput = e => { s.q = e.target.value.toLowerCase(); s.page = 1; draw(); };
    $('#f').onchange = e => { s.f = e.target.value; s.page = 1; draw(); };
    draw();
  };

  // ---------- fiche client ----------
  routes.client = (parts) => {
    const c = clientById(parts[0]);
    if (!c) return navigate('#/clients');
    clientDocState.page = 1;   // on change de client : on repart de la première page
    const cur = company().currency;
    const sum = C.clientSummary(data, company(), c.id);
    const docs = sum.docs.slice().sort(byNumberDesc);
    const late = docs.filter(d => d.type === 'facture' && effStatus(d) === 'retard');
    const lateAmount = late.reduce((s2, d) => s2 + C.toBase(d, balance(d).remaining, company()), 0);
    const openQuotes = docs.filter(d => d.type === 'devis' && ['envoyé', 'expiré'].includes(effStatus(d)));

    $('#view').innerHTML = `
      <div class="page-head">
        <div><h1>${h(c.name)} ${info('cl.page')}</h1>
          <div class="small muted">${[c.contact, c.matricule ? 'MF ' + c.matricule : '', c.phone, c.email].filter(Boolean).map(h).join(' · ')}</div></div>
        <div class="actions">
          <button class="btn" id="back">← Clients</button>
          ${c.email ? '<button class="btn" id="mailto">Écrire</button>' : ''}
          <button class="btn" id="edit">Modifier</button>
          <button class="btn" id="new-fac">+ Facture</button>
          <button class="btn btn-primary" id="new-dev">+ Devis</button>
        </div></div>
      ${late.length ? `<div class="banner">${late.length} facture(s) en retard — ${C.money(lateAmount, cur)}<button class="btn" id="go-rel">Voir les relances</button></div>` : ''}
      <div class="stats">
        <div class="stat"><div class="lbl">Facturé HT ${info('dash.caYear')}</div><div class="val">${C.money(sum.ht, cur)}</div><div class="sub">${sum.invoiceCount} facture(s)${sum.first ? ' depuis ' + C.fmtDate(sum.first) : ''}</div></div>
        <div class="stat"><div class="lbl">Reste à payer ${info('cl.due')}</div><div class="val">${C.money(sum.due, cur)}</div><div class="sub">${sum.due > 0.0005 ? 'à encaisser' : 'tout est réglé'}</div></div>
        <div class="stat"><div class="lbl">Délai moyen de paiement ${info('dash.delay')}</div><div class="val">${sum.delay == null ? '—' : sum.delay + ' j'}</div><div class="sub">annoncé : ${company().paymentTermsDays} jours</div></div>
        <div class="stat"><div class="lbl">Devis acceptés ${info('dash.conversion')}</div><div class="val">${sum.conversion == null ? '—' : sum.conversion + ' %'}</div><div class="sub">${sum.quoteCount} devis, ${openQuotes.length} sans réponse</div></div>
      </div>
      <div class="grid-2">
          <div class="panel"><h2>Coordonnées</h2>
            <div class="kv">
              ${c.address ? `<div><span>Adresse</span><span>${h(c.address).replace(/\n/g, '<br>')}</span></div>` : ''}
              ${c.contact ? `<div><span>Contact</span><span>${h(c.contact)}</span></div>` : ''}
              ${c.phone ? `<div><span>Téléphone</span><span>${h(c.phone)}</span></div>` : ''}
              ${c.email ? `<div><span>Email</span><span>${h(c.email)}</span></div>` : ''}
              ${c.matricule ? `<div><span>MF / CIN</span><span>${h(c.matricule)}</span></div>` : ''}
              <div><span>Retenue à la source</span><span>${c.withholdingRate === '' || c.withholdingRate == null ? `par défaut (${pct(company().defaultWithholdingRate || 0)} %)` : (Number(c.withholdingRate) ? pct(c.withholdingRate) + ' %' : 'aucune')}</span></div>
              <div><span>Documents</span><span>${(c.lang === 'en' ? 'anglais' : 'français')} · ${h(c.currency || company().currency)}</span></div>
            </div>
          </div>
          <div class="panel"><h2>Notes internes</h2>
            <textarea id="cl-notes" rows="6" placeholder="Ce qu'il faut se rappeler : habitudes de paiement, interlocuteurs, historique…">${h(c.notes || '')}</textarea>
            <p class="small muted mt">Ces notes ne sortent jamais sur un document.</p>
          </div>
      </div>
      <div class="panel"><h2>Documents</h2><div id="cl-docs"></div></div>`;
    const dcols = docColumns({ hideClient: true }).cols;
    const drawDocs = (sortKey) => {
      if (sortKey) { clientDocState.sort = toggleSort(clientDocState.sort, sortKey, dcols); clientDocState.page = 1; }
      $('#cl-docs').innerHTML = docTable(docs, {
        hideClient: true, sort: clientDocState.sort, onSort: true, page: clientDocState,
        empty: 'Aucun document pour ce client. Commence par un devis.'
      });
      bindDocTable(drawDocs, clientDocState, '#cl-docs');
    };
    drawDocs();
    $('#back').onclick = () => navigate('#/clients');
    $('#edit').onclick = () => clientForm(c, () => render(true));
    $('#new-dev').onclick = () => navigate('#/doc/new/devis/client/' + c.id);
    $('#new-fac').onclick = () => navigate('#/doc/new/facture/client/' + c.id);
    if ($('#mailto')) $('#mailto').onclick = () => bridge.composeMail({ to: c.email, subject: '', body: '', attachment: null, mode: 'mailto' });
    if ($('#go-rel')) $('#go-rel').onclick = () => navigate('#/relances');
    $('#cl-notes').oninput = e => { c.notes = e.target.value; save(); };
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
        <div class="field">Unité<select name="unit" id="cat-unit">${unitOptions(it.unit || '', C.usedUnits(data))}</select></div>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        let unit = it.unit || '';
        bindUnitSelect($('#cat-unit', root), () => unit, u => { unit = u; });
        $('#ok', root).onclick = () => {
          const v = formValues($('#kf', root));
          if (!v.label.trim()) return toast('La désignation est obligatoire.', true);
          Object.assign(it, v, { vatRate: Number(v.vatRate), unit });
          if (!item) data.catalog.push(it);
          save(true); close(); if (done) done(it);
        };
      });
  }

  routes.catalogue = () => {
    const cur = company().currency;
    // Un onglet = une liste avec sa recherche, son tri et sa pagination. Le catalogue d'un revendeur
    // atteint vite cent références : sans recherche, il n'est plus consultable.
    const drawList = (wrapSel, state, cols, rows, opts) => {
      let built = false;
      const redraw = (sortKey) => {
        const wrap = $(wrapSel);
        if (!wrap) return;
        if (sortKey) { state.sort = toggleSort(state.sort, sortKey, cols); state.page = 1; }
        if (!built) {
          // La barre de recherche est construite une seule fois : la redessiner à chaque frappe ferait perdre le curseur.
          wrap.innerHTML = `<div class="filters">
            <input type="text" class="q" placeholder="${h(opts.placeholder)}" value="${h(state.q)}">
            ${info('list.sort')}<span class="f-note" hidden></span></div><div class="rows"></div>`;
          $('.q', wrap).oninput = e => { state.q = e.target.value.toLowerCase(); state.page = 1; redraw(); };
          built = true;
        }
        const all = rows();
        const kept = applySort(all.filter(r => !state.q || opts.text(r).toLowerCase().includes(state.q)), cols, state.sort);
        const { rows: page, pg } = paginate(kept, state);
        $('.rows', wrap).innerHTML = kept.length
          ? `<table class="list sortable"><thead>${sortHead(cols, state.sort, '<th class="row-actions-h"></th>')}</thead><tbody>
              ${page.map(r => `<tr>${cols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}<td class="actions">${opts.actions(r)}</td></tr>`).join('')}
            </tbody></table>${pagerBar(pg, { noun: opts.noun, grandTotal: all.length })}`
          : `<div class="empty">${state.q ? 'Rien ne correspond à cette recherche.' : h(opts.empty)}</div>`;
        const note = $('.f-note', wrap);
        note.hidden = !state.q;
        note.innerHTML = state.q ? `<span class="small muted">${kept.length} sur ${all.length}</span><button type="button" class="btn btn-sm btn-ghost reset-f" title="Effacer la recherche">✕ Réinitialiser</button>` : '';
        if ($('.reset-f', wrap)) $('.reset-f', wrap).onclick = () => { state.q = ''; state.page = 1; $('.q', wrap).value = ''; redraw(); };
        bindSort(wrap, redraw);
        bindPager($('.rows', wrap), state, () => redraw(), wrapSel);
        opts.bind(wrap, redraw);
      };
      return redraw;
    };

    const prestaCols = [
      { key: 'label', label: 'Désignation', asc: true, val: c => c.label.toLowerCase(), get: c => `<strong>${h(c.label)}</strong><div class="small muted">${h(c.description || '')}</div>` },
      { key: 'price', label: 'P.U. HT', r: true, val: c => Number(c.unitPrice) || 0, get: c => C.money(c.unitPrice, cur) },
      { key: 'vat', label: 'TVA', r: true, val: c => Number(c.vatRate) || 0, get: c => c.vatRate + ' %' },
      { key: 'unit', label: 'Unité', asc: true, val: c => (c.unit || '').toLowerCase(), get: c => h(c.unit || '') }
    ];
    const draw = drawList('#list-wrap', catalogState.presta, prestaCols, () => data.catalog.slice(), {
      noun: 'prestation', placeholder: 'Rechercher une prestation…', text: c => `${c.label} ${c.description || ''} ${c.unit || ''}`,
      empty: 'Catalogue vide. Ajoute tes prestations récurrentes pour remplir les devis en un clic.',
      actions: c => `<button class="btn btn-sm" data-edit="${c.id}">Modifier</button> <button class="btn btn-sm btn-danger" data-del="${c.id}">Supprimer</button>`,
      bind: (wrap, redraw) => {
        $$('[data-edit]', wrap).forEach(b => b.onclick = () => catalogForm(data.catalog.find(c => c.id === b.dataset.edit), redraw));
        $$('[data-del]', wrap).forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer cette prestation ?')) { data.catalog = data.catalog.filter(c => c.id !== b.dataset.del); save(true); redraw(); } });
      }
    });

    const tplCols = [
      { key: 'name', label: 'Modèle', asc: true, val: t => (t.name || '').toLowerCase(), get: t => `<strong>${h(t.name)}</strong><div class="small muted">${h(t.subject || '')}</div>` },
      { key: 'type', label: 'Type', asc: true, val: t => t.type || '', get: t => C.TITLES[t.type] || t.type },
      { key: 'lines', label: 'Lignes', r: true, val: t => (t.lines || []).length, get: t => (t.lines || []).length }
    ];
    const drawTemplates = drawList('#tpl-wrap', catalogState.modeles, tplCols, () => data.templates.slice(), {
      noun: 'modèle', placeholder: 'Rechercher un modèle…', text: t => `${t.name} ${t.subject || ''}`,
      empty: 'Aucun modèle. Depuis un devis ou une facture : Plus ▾ → « Enregistrer comme modèle ».',
      actions: t => `<button class="btn btn-sm btn-primary" data-use="${t.id}">Nouveau ${t.type === 'devis' ? 'devis' : 'facture'}</button> <button class="btn btn-sm" data-ren="${t.id}">Renommer</button> <button class="btn btn-sm btn-danger" data-tdel="${t.id}">Supprimer</button>`,
      bind: (wrap, redraw) => {
        $$('[data-use]', wrap).forEach(b => b.onclick = () => { const t = data.templates.find(x => x.id === b.dataset.use); navigate(`#/doc/new/${t.type}/tpl/${t.id}`); });
        $$('[data-ren]', wrap).forEach(b => b.onclick = () => { const t = data.templates.find(x => x.id === b.dataset.ren); promptDialog('Renommer le modèle', 'Nom', t.name, v => { t.name = v; save(true); redraw(); }); });
        $$('[data-tdel]', wrap).forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ce modèle ?')) { data.templates = data.templates.filter(x => x.id !== b.dataset.tdel); save(true); redraw(); } });
      }
    });

    const snipCols = [
      { key: 'name', label: 'Nom', asc: true, val: x => (x.name || '').toLowerCase(), get: x => `<strong>${h(x.name)}</strong>` },
      { key: 'text', label: 'Texte', get: x => `<span class="small">${h(x.text).replace(/\n/g, '<br>')}</span>` }
    ];
    const drawSnippets = drawList('#snip-wrap', catalogState.textes, snipCols, () => data.snippets.slice(), {
      noun: 'texte', placeholder: 'Rechercher un texte…', text: x => `${x.name} ${x.text || ''}`,
      empty: 'Aucun texte prédéfini. Conditions de garantie, modalités, mentions récurrentes… à insérer dans les notes d\'un document en un clic.',
      actions: x => `<button class="btn btn-sm" data-sedit="${x.id}">Modifier</button> <button class="btn btn-sm btn-danger" data-sdel="${x.id}">Supprimer</button>`,
      bind: (wrap, redraw) => {
        $$('[data-sedit]', wrap).forEach(b => b.onclick = () => snippetForm(data.snippets.find(x => x.id === b.dataset.sedit), redraw));
        $$('[data-sdel]', wrap).forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ce texte ?')) { data.snippets = data.snippets.filter(x => x.id !== b.dataset.sdel); save(true); redraw(); } });
      }
    });
    const TABS = [['presta', 'Prestations', 'cat.catalog'], ['modeles', 'Modèles de documents', 'ed.template'], ['textes', 'Textes prédéfinis', 'cat.snippets']];
    if (!TABS.some(t => t[0] === catalogTab)) catalogTab = 'presta';
    const head = () => {
      const t = TABS.find(x => x[0] === catalogTab);
      return `<h1>${t[1]} ${info(t[2])}</h1><div class="actions">
        ${catalogTab === 'presta' ? '<button class="btn btn-primary" id="new">+ Nouvelle prestation</button>' : ''}
        ${catalogTab === 'textes' ? '<button class="btn btn-primary" id="new-snip">+ Nouveau texte</button>' : ''}
        ${catalogTab === 'modeles' ? '<span class="small muted">Depuis un devis ou une facture : Plus ▾ → « Enregistrer comme modèle »</span>' : ''}
      </div>`;
    };
    $('#view').innerHTML = `<div class="page-head" id="cat-head">${head()}</div>
      <div class="tabs" id="cat-tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" data-tab="${id}" class="${id === catalogTab ? 'active' : ''}">${label}</button>`).join('')}</div>
      <div data-pane="presta"><div id="list-wrap"></div></div>
      <div data-pane="modeles" hidden><div id="tpl-wrap"></div></div>
      <div data-pane="textes" hidden><div id="snip-wrap"></div></div>`;
    const bindHead = () => {
      if ($('#new')) $('#new').onclick = () => catalogForm(null, draw);
      if ($('#new-snip')) $('#new-snip').onclick = () => snippetForm(null, drawSnippets);
    };
    const showTab = id => {
      catalogTab = id;
      $$('#cat-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
      $$('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== id);
      $('#cat-head').innerHTML = head(); bindHead();
    };
    $$('#cat-tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
    showTab(catalogTab);
    draw(); drawTemplates(); drawSnippets();
  };

  function snippetForm(sn, done) {
    const x = sn || { id: C.uid(), name: '', text: '' };
    modal(`<h2>${sn ? 'Modifier le texte' : 'Nouveau texte prédéfini'}</h2>
      <form id="sf" class="grid-2">${field('Nom', 'name', x.name, 'text', 'placeholder="Garantie, Conditions de paiement…"')}<label class="field span-2">Texte<textarea name="text" rows="5">${h(x.text)}</textarea></label></form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => { $('#ok', root).onclick = () => { const v = formValues($('#sf', root)); if (!v.name.trim() || !v.text.trim()) return toast('Nom et texte obligatoires.', true); Object.assign(x, v); if (!sn) data.snippets.push(x); save(true); close(); if (done) done(); }; });
  }

  function promptDialog(title, label, value, done, type) {
    modal(`<h2>${h(title)}</h2><form id="pr" class="grid-2"><label class="field span-2">${h(label)}<input type="${type || 'text'}" name="v" value="${h(value || '')}"></label></form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">OK</button></div>`,
      (root, close) => { const go = () => { const v = $('input[name=v]', root).value.trim(); if (!v) return toast('Valeur obligatoire.', true); close(); done(v); }; $('#ok', root).onclick = go; $('#pr', root).onsubmit = e => { e.preventDefault(); go(); }; });
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
    const mtitle = kind === 'relanceDevis' ? 'Relancer le devis ' + h(doc.number)
      : /^relance\d$/.test(kind) ? C.REMINDER_LABELS[Number(kind.slice(-1))] + ' — ' + h(doc.number)
      : 'Envoyer ' + h(docLabel(doc)) + ' par email';
    modal(`<h2>${mtitle}</h2>
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
    const clientItems = () => data.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(c => ({
      v: c.id, label: c.name, sub: [c.contact, c.matricule ? 'MF ' + c.matricule : ''].filter(Boolean).join(' · '),
      text: `${c.name} ${c.contact || ''} ${c.email || ''} ${c.phone || ''} ${c.matricule || ''}`
    }));
    modal(`<h2>${isNew ? 'Nouveau contrat récurrent' : 'Modifier le contrat'}</h2>
      <form id="rf" class="grid-3">
        <div class="field span-2">Client${combo({ name: 'clientId', value: r.clientId, items: clientItems(), placeholder: '— Choisir un client —', search: 'Rechercher : nom, contact, MF…' })}</div>
        <label class="field">Période<select name="every">${C.PERIODS.map(p => `<option value="${p[0]}" ${p[0] === r.every ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label>
        <label class="field span-2">Objet des factures <span class="muted">({mois} = mois facturé)</span><input type="text" name="subject" value="${h(r.subject)}" placeholder="Maintenance et supervision — {mois}"></label>
        ${field('Jour du mois', 'day', r.day || 1, 'number', 'min="1" max="31" class="num"')}
        ${dateFieldHtml('Prochaine facture', 'nextDate', r.nextDate || C.today(), { quick: true })}
        <label class="field">Retenue à la source<select name="withholdingRate">${withholdingOptions(r.withholdingRate)}</select></label>
        ${field('Remise (%)', 'discountRate', r.discountRate || 0, 'number', 'min="0" max="100" step="0.5" class="num"')}
        <label class="field span-3">Notes sur la facture<textarea name="notes" rows="2">${h(r.notes || '')}</textarea></label>
        <label class="check span-3"><input type="checkbox" name="active" ${r.active !== false ? 'checked' : ''}> Contrat actif (les factures sont proposées à la date prévue)</label>
      </form>
      <table class="mini"><thead><tr><th>Désignation</th><th style="width:70px">Qté</th><th style="width:110px">P.U. HT</th><th style="width:80px">TVA</th><th></th></tr></thead><tbody id="rl"></tbody></table>
      <div class="inline mt"><button type="button" class="btn btn-sm" id="rl-add">+ Ligne</button><span class="small muted" id="rl-total"></span></div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        bindCombo($('[data-combo=clientId]', root), { items: clientItems(), placeholder: '— Choisir un client —' });
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
  const contratState = { q: '', st: '', sort: { key: 'next', dir: 'asc' }, page: 1 };
  routes.contrats = () => {
    const cur = company().currency;
    const s = contratState;
    const cols = [
      { key: 'client', label: 'Client', asc: true, val: r => clientName(r.clientId).toLowerCase(), get: r => `<strong>${h(clientName(r.clientId))}</strong>` },
      { key: 'subject', label: 'Objet', asc: true, val: r => (r.subject || '').toLowerCase(), get: r => { const subj = C.fillTemplate(r.subject, { mois: C.monthLabel(r.nextDate) }); return `${h(subj)}${subj !== r.subject ? `<div class="small muted">${h(r.subject)}</div>` : ''}`; } },
      { key: 'every', label: 'Période', asc: true, val: r => r.every || '', get: r => (C.PERIODS.find(p => p[0] === r.every) || [])[1] || '' },
      { key: 'next', label: 'Prochaine facture', asc: true, val: r => r.nextDate || '', get: r => { const isDue = r.active !== false && r.nextDate <= C.today(); return `${C.fmtDate(r.nextDate)}${isDue ? ' <span class="level l2">à générer</span>' : ''}${r.lastIssued ? `<div class="small muted">dernière : ${C.fmtDate(r.lastIssued)}</div>` : ''}`; } },
      { key: 'ht', label: 'HT / facture', r: true, val: r => C.computeTotals({ type: 'facture', lines: r.lines, discountRate: r.discountRate }, company()).netHT, get: r => C.money(C.computeTotals({ type: 'facture', lines: r.lines, discountRate: r.discountRate }, company()).netHT, cur) },
      { key: 'state', label: 'État', asc: true, val: r => r.active !== false ? 'actif' : 'suspendu', get: r => r.active !== false ? '<span class="badge envoyée">actif</span>' : '<span class="badge">suspendu</span>' }
    ];
    const STATES = [['', 'Tous les contrats'], ['actif', 'Actifs'], ['suspendu', 'Suspendus'], ['due', 'À générer']];
    const draw = (sortKey) => {
      if (sortKey) { s.sort = toggleSort(s.sort, sortKey, cols); s.page = 1; }
      const due = C.dueRecurrences(data);
      const all = data.recurring.slice();
      const kept = applySort(all
        .filter(r => !s.st || (s.st === 'due' ? (r.active !== false && r.nextDate <= C.today()) : (s.st === 'actif') === (r.active !== false)))
        .filter(r => !s.q || `${clientName(r.clientId)} ${r.subject || ''}`.toLowerCase().includes(s.q)), cols, s.sort);
      const { rows: page, pg } = paginate(kept, s);
      const filtered = !!(s.q || s.st);
      $('#c-wrap').innerHTML = `${due.length ? `<div class="banner">${due.length} facture(s) récurrente(s) à générer<button class="btn" id="gen-due">Générer les brouillons</button></div>` : ''}
        <div class="filters">
          <input type="text" id="q" placeholder="Rechercher : client, objet…" value="${h(s.q)}">
          <select id="st">${STATES.map(([v, l]) => `<option value="${v}" ${s.st === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          ${info('list.filters')}
          ${filtered ? `<span class="f-note"><span class="small muted">${kept.length} sur ${all.length}</span><button type="button" class="btn btn-sm btn-ghost" id="reset-f" title="Effacer la recherche et les filtres">✕ Réinitialiser les filtres</button></span>` : ''}
        </div>
        ${kept.length ? `<table class="list sortable"><thead>${sortHead(cols, s.sort, '<th class="row-actions-h"></th>')}</thead><tbody>
        ${page.map(r => `<tr>${cols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}
          <td class="actions"><button class="btn btn-sm" data-gen="${r.id}">Générer maintenant</button> <button class="btn btn-sm" data-edit="${r.id}">Modifier</button> <button class="btn btn-sm" data-toggle="${r.id}">${r.active !== false ? 'Suspendre' : 'Reprendre'}</button> <button class="btn btn-sm btn-danger" data-del="${r.id}">Supprimer</button></td></tr>`).join('')}
        </tbody></table>${pagerBar(pg, { noun: 'contrat', grandTotal: all.length })}`
          : `<div class="empty">${filtered ? 'Aucun contrat ne correspond à ces filtres.' : 'Aucun contrat. Un contrat génère automatiquement un brouillon de facture à chaque échéance (mensuelle, trimestrielle, annuelle). Crée-le ici, ou depuis une facture existante : Plus ▾ → « Rendre récurrent ».'}</div>`}`;
      const q = $('#q');
      q.oninput = e => { s.q = e.target.value.toLowerCase(); s.page = 1; draw(); const el = $('#q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
      $('#st').onchange = e => { s.st = e.target.value; s.page = 1; draw(); };
      if ($('#reset-f')) $('#reset-f').onclick = () => { s.q = ''; s.st = ''; s.page = 1; draw(); };
      bindSort($('#c-wrap'), draw);
      bindPager($('#c-wrap'), s, () => draw(), '#c-wrap');
      if ($('#gen-due')) $('#gen-due').onclick = () => { const n = generateRecurring(); toast(`${n} brouillon(s) créé(s) — à émettre depuis Factures`); draw(); };
      $$('[data-gen]').forEach(b => b.onclick = () => { const r = data.recurring.find(x => x.id === b.dataset.gen); generateRecurring([r], true); toast('Brouillon créé pour ' + C.monthLabel(r.lastIssued)); draw(); });
      $$('[data-edit]').forEach(b => b.onclick = () => recurrenceForm(data.recurring.find(x => x.id === b.dataset.edit), draw));
      $$('[data-toggle]').forEach(b => b.onclick = () => {
        const r = data.recurring.find(x => x.id === b.dataset.toggle);
        r.active = r.active === false;
        if (r.active && r.nextDate < C.today()) {
          // Reprise : on repart de la prochaine échéance, sans facturer les mois suspendus
          r.nextDate = C.catchUpRecurrence(r.nextDate, r.every, r.day);
          toast(`Contrat repris — prochaine facture le ${C.fmtDate(r.nextDate)} (les échéances passées pendant la suspension ne sont pas facturées ; modifie la date si besoin)`);
        }
        save(true); draw();
      });
      $$('[data-del]').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ce contrat ? Les factures déjà générées sont conservées.')) { data.recurring = data.recurring.filter(x => x.id !== b.dataset.del); save(true); draw(); } });
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Contrats récurrents ${info('contrat.form')}</h1><div class="actions"><button class="btn btn-primary" id="new">+ Nouveau contrat</button></div></div><div id="c-wrap"></div>`;
    $('#new').onclick = () => recurrenceForm({ id: C.uid(), clientId: '', subject: '', lines: [], every: 'month', day: 1, nextDate: C.addMonths(C.today(), 1, 1), active: true, withholdingRate: 0, discountRate: 0, notes: '' }, draw);
    draw();
  };

  // ---------- relances ----------
  // Relance notée à la main (téléphone, visite) : elle compte dans l'historique comme un email.
  function phoneReminderForm(item, done) {
    const d = item.doc;
    modal(`<h2>Relance par téléphone — ${h(d.number)}</h2>
      <p class="small muted">${h(clientName(d.clientId))} · ${C.money(item.remaining, docCur(d))} · ${item.daysLate} jours de retard</p>
      <form id="tf" class="grid-2">
        ${dateFieldHtml('Date de l\'appel', 'date', C.today())}
        <label class="field">Niveau<select name="level">${[1, 2, 3].map(l => `<option value="${l}" ${l === item.level ? 'selected' : ''}>${h(C.REMINDER_LABELS[l])}</option>`).join('')}</select></label>
        <label class="field span-2">Ce qui a été dit<input type="text" name="note" placeholder="Promet un virement avant le 20, relancer si rien"></label>
        ${dateFieldHtml('Ne pas relancer avant le (optionnel)', 'remindAfter', '', { quick: true, clearable: true })}
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Noter la relance</button></div>`,
      (root, close) => { $('#ok', root).onclick = () => {
        const v = formValues($('#tf', root));
        if (!v.date) return toast('Date obligatoire.', true);
        const s = docById(d.id);
        s.reminders = s.reminders || [];
        s.reminders.push({ date: v.date, level: Number(v.level) || item.level, channel: 'tel', note: v.note || '' });
        if (v.remindAfter) s.remindAfter = v.remindAfter;
        save(true); close(); toast('Relance notée'); if (done) done();
      }; });
  }

  function snoozeForm(item, done) {
    const d = item.doc;
    modal(`<h2>Reporter la relance — ${h(d.number)}</h2>
      <p class="small muted">La facture reste en retard et continue de compter dans ton « reste à encaisser ». Elle passe simplement en bas de la liste des relances jusqu'à cette date.</p>
      <form id="sf2" class="grid-2">${dateFieldHtml('Ne pas relancer avant le', 'remindAfter', C.addDays(C.today(), 15), { quick: true, clearable: true })}</form>
      <div class="modal-actions">${d.remindAfter ? '<button class="btn" id="clear" style="margin-right:auto">Retirer le report</button>' : ''}<button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Reporter</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = () => {
          const v = formValues($('#sf2', root)); if (!v.remindAfter) return toast('Choisis une date.', true);
          docById(d.id).remindAfter = v.remindAfter; save(true); close(); toast('Relance reportée au ' + C.fmtDate(v.remindAfter)); if (done) done();
        };
        if ($('#clear', root)) $('#clear', root).onclick = () => { delete docById(d.id).remindAfter; save(true); close(); toast('Report retiré'); if (done) done(); };
      });
  }

  const relState = { sort: null, page: 1 };   // tri et page de la liste des factures à relancer
  routes.relances = () => {
    const cur = company().currency;
    const draw = () => {
      const all = C.overdueInvoices(data, company());
      const od = all.filter(x => !x.snoozed), later = all.filter(x => x.snoozed);
      const soon = data.documents.filter(d => d.type === 'facture' && ['envoyée', 'partielle'].includes(effStatus(d)) && d.dueDate >= C.today() && C.daysBetween(C.today(), d.dueDate) <= 7);
      const quotes = data.documents.filter(d => d.type === 'devis' && ['envoyé', 'expiré'].includes(effStatus(d)) && d.date && C.daysBetween(d.date, C.today()) > 10)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const total = od.reduce((s, x) => s + C.toBase(x.doc, x.remaining, company()), 0);
      const row = x => `<tr class="${x.snoozed ? 'snoozed' : ''}">
        <td><strong><a href="#/doc/${x.doc.id}">${h(x.doc.number)}</a></strong><div class="small muted">${h(x.doc.subject || '')}</div></td>
        <td><a href="#/client/${x.doc.clientId}">${h(clientName(x.doc.clientId))}</a></td>
        <td>${C.fmtDate(x.doc.dueDate)}</td>
        <td class="r">${x.daysLate} j <span class="level l${x.level}">${h(C.REMINDER_LABELS[x.level])}</span></td>
        <td class="r">${C.money(x.remaining, docCur(x.doc))}</td>
        <td>${x.lastReminder ? `${C.fmtDate(x.lastReminder.date)} <span class="small muted">(${x.lastReminder.channel === 'tel' ? 'téléphone' : 'email'}, niveau ${x.lastReminder.level}, ${x.reminders.length} au total)</span>${x.lastReminder.note ? `<div class="small muted">« ${h(x.lastReminder.note)} »</div>` : ''}` : '<span class="muted">jamais</span>'}
          ${x.snoozed ? `<div class="small warn-link">reporté au ${C.fmtDate(x.remindAfter)}</div>` : ''}</td>
        <td class="actions">
          <button class="btn btn-sm btn-primary" data-rem="${x.doc.id}">Email</button>
          <button class="btn btn-sm" data-tel="${x.doc.id}">Téléphone…</button>
          <button class="btn btn-sm" data-pay="${x.doc.id}">Paiement reçu</button>
          <button class="btn btn-sm btn-ghost" data-snooze="${x.doc.id}" title="Ne pas relancer avant une date">⏱</button>
        </td></tr>`;
      const relCols = [
        { key: 'number', label: 'Facture', asc: true, val: x => x.doc.number || '' },
        { key: 'client', label: 'Client', asc: true, val: x => clientName(x.doc.clientId).toLowerCase() },
        { key: 'due', label: 'Échéance', asc: true, val: x => x.doc.dueDate || '' },
        { key: 'late', label: 'Retard', r: true, val: x => x.daysLate },
        { key: 'rest', label: 'Reste à payer', r: true, val: x => C.toBase(x.doc, x.remaining, company()) },
        { key: 'last', label: 'Dernière relance', val: x => (x.lastReminder || {}).date || '' }
      ];
      const head = `<thead>${sortHead(relCols, relState.sort, '<th class="row-actions-h"></th>')}</thead>`;
      const headFixed = `<thead>${sortHead(relCols.map(c => ({ ...c, val: null })), null, '<th class="row-actions-h"></th>')}</thead>`;
      const odSorted = applySort(od, relCols, relState.sort);
      const odPage = paginate(odSorted, relState);
      $('#r-wrap').innerHTML = `
        ${od.length ? `<div class="banner">${od.length} facture(s) à relancer — ${C.money(total, cur)} à récupérer</div>` : `<div class="banner info">Aucune facture à relancer${later.length ? ` (${later.length} reportée(s))` : ''}.</div>`}
        ${od.length ? `<table class="list sortable">${head}<tbody>${odPage.rows.map(row).join('')}</tbody></table>${pagerBar(odPage.pg, { noun: 'facture' })}` : ''}
        ${later.length ? `<div class="section-head"><h2>Reportées ${info('rel.snooze')}</h2></div><table class="list">${headFixed}<tbody>${later.map(row).join('')}</tbody></table>` : ''}
        ${soon.length ? `<div class="section-head"><h2>Échéances dans les 7 jours ${info('rel.soon')}</h2></div><table class="list compact"><thead><tr><th>Facture</th><th>Client</th><th>Échéance</th><th class="r">Reste</th></tr></thead><tbody>
          ${soon.map(d => `<tr class="clickable" data-id="${d.id}"><td><strong>${h(d.number)}</strong></td><td>${h(clientName(d.clientId))}</td><td>${C.fmtDate(d.dueDate)}</td><td class="r">${C.money(balance(d).remaining, docCur(d))}</td></tr>`).join('')}
        </tbody></table>` : ''}
        ${quotes.length ? `<div class="section-head"><h2>Devis sans réponse ${info('rel.quotes')}</h2></div><table class="list compact"><thead><tr><th>Devis</th><th>Client</th><th>Envoyé il y a</th><th>Validité</th><th class="r">Montant</th><th></th></tr></thead><tbody>
          ${quotes.map(d => `<tr><td><strong><a href="#/doc/${d.id}">${h(d.number)}</a></strong><div class="small muted">${h(d.subject || '')}</div></td><td>${h(clientName(d.clientId))}</td><td>${C.daysBetween(d.date, C.today())} jours</td><td>${effStatus(d) === 'expiré' ? '<span class="badge expiré">expiré</span>' : C.fmtDate(d.dueDate)}</td><td class="r">${C.money(C.computeTotals(d, company()).totalTTC, docCur(d))}</td>
            <td class="actions"><button class="btn btn-sm" data-qrem="${d.id}">Relancer par email</button></td></tr>`).join('')}
        </tbody></table>` : ''}
        <p class="small muted mt">Niveaux : rappel amical jusqu'à 15 jours, relance jusqu'à 45 jours, dernière relance au-delà. Textes modifiables dans Paramètres → Emails.</p>`;
      const find = id => all.find(x => x.doc.id === id);
      bindSort($('#r-wrap'), key => { relState.sort = toggleSort(relState.sort, key, relCols); relState.page = 1; draw(); });
      bindPager($('#r-wrap'), relState, () => draw(), '#r-wrap');
      $$('[data-rem]').forEach(b => b.onclick = () => sendReminder(find(b.dataset.rem)));
      $$('[data-tel]').forEach(b => b.onclick = () => phoneReminderForm(find(b.dataset.tel), draw));
      $$('[data-snooze]').forEach(b => b.onclick = () => snoozeForm(find(b.dataset.snooze), draw));
      $$('[data-pay]').forEach(b => b.onclick = () => paymentForm(docById(b.dataset.pay), draw));
      $$('[data-qrem]').forEach(b => b.onclick = () => sendByEmail(docById(b.dataset.qrem), 'relanceDevis', null, () => {}));
      $$('tr.clickable[data-id]').forEach(tr => tr.onclick = () => navigate('#/doc/' + tr.dataset.id));
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Relances ${info('rel.levels')}</h1></div><div id="r-wrap"></div>`;
    draw();
  };

  // ---------- panneau « À faire » ----------
  const TODO_ACTIONS = {
    contrats: { label: 'Générer les brouillons', run: () => { const n = generateRecurring(); toast(`${n} brouillon(s) créé(s) — à relire puis émettre`); render(); } },
    retards: { label: 'Voir les relances', run: () => navigate('#/relances') },
    societe: { label: 'Compléter', run: () => { settingsTab = 'societe'; navigate('#/parametres'); } },
    'devis-acceptes': { label: 'Voir les devis', run: () => { listState.devis.st = 'accepté'; listState.devis.year = ''; navigate('#/devis'); } },
    'devis-expires': { label: 'Voir les devis', run: () => navigate('#/devis') },
    'devis-sans-reponse': { label: 'Voir les devis', run: () => navigate('#/devis') },
    attestations: { label: 'Voir la liste', run: () => navigate('#/compta') },
    echeances: { label: 'Voir les échéances', run: () => navigate('#/relances') },
    brouillons: { label: 'Voir les brouillons', run: () => navigate('#/factures') }
  };
  function todoPanel() {
    const items = C.todoList(data, company());
    if (!items.length) return `<div class="todo-ok">Rien à faire aujourd'hui : aucun retard, aucun contrat en attente, aucune attestation à réclamer.</div>`;
    // Panneau repliable : une fois la liste connue, elle prend la place du tableau de bord.
    // L'état est gardé d'une session à l'autre, et le résumé replié dit ce qui reste.
    const open = prefs.get('todoOpen', true) !== false;
    const urgent = items.filter(x => x.level === 'danger').length;
    const summary = `${items.length} chose${items.length > 1 ? 's' : ''} à faire${urgent ? ` · ${urgent} urgente${urgent > 1 ? 's' : ''}` : ''}`;
    return `<div class="panel todo${open ? '' : ' collapsed'}">
      <h2><button type="button" class="collapse-h" id="todo-toggle" aria-expanded="${open}" aria-controls="todo-list" title="${open ? 'Replier' : 'Déplier'} la liste">
        <span class="chev">▾</span>À faire<span class="count">${items.length}</span></button> ${info('todo')}</h2>
      <p class="todo-sum small muted" ${open ? 'hidden' : ''}>${h(summary)}</p>
      <ul id="todo-list" ${open ? '' : 'hidden'}>${items.map(x => `<li class="lvl-${x.level}">
        <span class="td-dot"></span>
        <span class="td-txt"><strong>${h(x.label)}</strong><span class="small muted">${h(x.detail || '')}</span></span>
        <button class="btn btn-sm" data-todo="${x.id}">${h((TODO_ACTIONS[x.id] || {}).label || 'Voir')}</button>
      </li>`).join('')}</ul></div>`;
  }
  function bindTodo() {
    $$('[data-todo]').forEach(b => b.onclick = () => { const a = TODO_ACTIONS[b.dataset.todo]; if (a) a.run(); });
    const t = $('#todo-toggle');
    if (t) t.onclick = () => {
      const open = !(prefs.get('todoOpen', true) !== false);
      prefs.set('todoOpen', open);
      t.setAttribute('aria-expanded', String(open));
      t.title = (open ? 'Replier' : 'Déplier') + ' la liste';
      t.closest('.panel').classList.toggle('collapsed', !open);
      $('#todo-list').hidden = !open;
      $('.todo-sum').hidden = open;
    };
  }
  function updateNavCounts() {
    if (!data) return;
    const rel = $('#nav-relances');
    if (rel) { const n = C.overdueInvoices(data, company()).filter(x => !x.snoozed).length; rel.hidden = !n; rel.textContent = n; }
    const ct = $('#nav-contrats');
    if (ct) { const n = C.dueRecurrences(data).length; ct.hidden = !n; ct.textContent = n; }
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
      ['Aide et guide', () => navigate('#/aide')], ['Nouveau client', () => clientForm(null, () => render())]
    ].map(([label, run]) => ({ kind: 'Action', main: label, text: label.toLowerCase(), run }));
    const helps = G.ARTICLES.map(x => ({ kind: 'Aide', main: x.title, sub: x.sub, text: `aide ${x.title} ${x.sub}`.toLowerCase(), run: () => navigate('#/aide/' + x.id) }));
    const docs = data.documents.map(d => { const t = C.computeTotals(d, company()); const cn = clientName(d.clientId); return { kind: C.TITLES[d.type], main: d.number || 'Brouillon', sub: `${cn}${d.subject ? ' — ' + d.subject : ''}`, amt: C.money(d.type === 'devis' ? t.totalTTC : t.netToPay, cur), text: `${d.number} ${cn} ${d.subject || ''} ${d.type}`.toLowerCase(), run: () => navigate('#/doc/' + d.id), ts: d.createdAt || 0 }; });
    const clients = data.clients.map(c => ({ kind: 'Client', main: c.name, sub: [c.contact, c.email, c.phone].filter(Boolean).join(' · '), text: `${c.name} ${c.contact || ''} ${c.email || ''} ${c.phone || ''} ${c.matricule || ''}`.toLowerCase(), run: () => navigate('#/client/' + c.id) }));
    const items = data.catalog.map(c => ({ kind: 'Prestation', main: c.label, sub: C.money(c.unitPrice, cur) + ' HT', text: `${c.label} ${c.description || ''}`.toLowerCase(), run: () => navigate('#/catalogue') }));
    const all = [...actions, ...docs, ...clients, ...items, ...helps];
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
  const closeMenus = () => $$('.more-list').forEach(l => l.hidden = true);
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    else if (e.key === 'Escape') {
      if ($('#info-pop')) { closeInfoPop(); return; }
      if (closeOverlay) { closeOverlay(); return; }   // calendrier ou liste déroulante ouverte
      if ($$('.more-list').some(l => !l.hidden)) { closeMenus(); return; }
      if (!$('#palette-root').hidden) { closePalette(); return; }
      if (modalClose) modalClose();
    }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.more')) closeMenus(); });
  // Un clic ailleurs referme le calendrier ou la liste déroulante ouverte.
  document.addEventListener('mousedown', e => {
    if (closeOverlay && !e.target.closest('.combo') && !e.target.closest('.datefield')) closeOverlay();
  });

  // ---------- Paramètres ----------

  // ---------- Comptabilité ----------
  // Colonnes du journal des ventes exporté en CSV (export manuel et envoi au comptable)
  const journalColumns = () => [
    { key: 'date', label: 'Date', type: 'date' }, { key: 'number', label: 'Numéro' }, { key: 'typeLabel', label: 'Type' }, { key: 'client', label: 'Client' }, { key: 'subject', label: 'Objet' },
    { key: 'ht', label: 'Total HT', type: 'money' },
    ...C.VAT_RATES.map(r => ({ label: `Base ${r}%`, type: 'money', get: x => x.vatByRate[r].base })),
    ...C.VAT_RATES.map(r => ({ label: `TVA ${r}%`, type: 'money', get: x => x.vatByRate[r].vat })),
    { key: 'tva', label: 'Total TVA', type: 'money' }, { key: 'timbre', label: 'Timbre', type: 'money' }, { key: 'ttc', label: 'TTC', type: 'money' },
    { key: 'rs', label: 'Retenue source', type: 'money' }, { key: 'net', label: 'Net à payer', type: 'money' },
    { key: 'statusLabel', label: 'Statut' }, { key: 'paid', label: 'Payé', type: 'money' }, { key: 'remaining', label: 'Reste', type: 'money' }
  ];
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const comptaState = {
    year: C.today().slice(0, 4), month: C.today().slice(5, 7),
    journal: { sort: null, page: 1 },      // journal des ventes
    pays: { sort: null, page: 1 }          // encaissements
  };

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
      const journalCols = [
        { key: 'date', label: 'Date', asc: true, val: r => r.date || '', get: r => C.fmtDate(r.date) },
        { key: 'number', label: 'Numéro', asc: true, val: r => r.number || '', get: r => `<strong>${h(r.number)}</strong>${r.type === 'avoir' ? `<div class="small muted">avoir · ${h(r.creditOfNumber)}</div>` : ''}` },
        { key: 'client', label: 'Client', asc: true, val: r => (r.client || '').toLowerCase(), get: r => `${h(r.client)}<div class="small muted">${h(r.subject)}</div>` },
        { key: 'ht', label: 'HT', r: true, val: r => r.ht, get: r => C.money(r.ht) },
        { key: 'tva', label: 'TVA', r: true, val: r => r.tva, get: r => C.money(r.tva) },
        { key: 'ttc', label: 'TTC', r: true, val: r => r.ttc, get: r => C.money(r.ttc) },
        { key: 'rs', label: 'RS', r: true, val: r => r.rs, get: r => r.rs ? C.money(r.rs) : '—' },
        { key: 'net', label: 'Net', r: true, val: r => r.net, get: r => C.money(r.net) },
        { key: 'status', label: 'Statut', asc: true, val: r => r.status || '', get: r => badge(r.status) }
      ];
      const payCols = [
        { key: 'date', label: 'Date', asc: true, val: r => r.date || '', get: r => C.fmtDate(r.date) },
        { key: 'number', label: 'Facture', asc: true, val: r => r.number || '', get: r => `<strong>${h(r.number)}</strong>` },
        { key: 'client', label: 'Client', asc: true, val: r => (r.client || '').toLowerCase(), get: r => h(r.client) },
        { key: 'method', label: 'Mode', asc: true, val: r => r.method || '', get: r => h(r.method) },
        { key: 'reference', label: 'Référence', asc: true, val: r => (r.reference || '').toLowerCase(), get: r => h(r.reference) },
        { key: 'amount', label: 'Montant', r: true, val: r => r.amount, get: r => C.money(r.amount, cur) }
      ];
      const jPage = paginate(applySort(rows, journalCols, comptaState.journal.sort), comptaState.journal);
      const pPage = paginate(applySort(pays, payCols, comptaState.pays.sort), comptaState.pays);
      $('#c-body').innerHTML = `
        <div class="stats">
          <div class="stat"><div class="lbl">CA HT — ${h(periodLabel())} ${info('dash.caMonth')}</div><div class="val">${C.money(sum.ht, cur)}</div><div class="sub">${sum.count} document(s), avoirs déduits</div></div>
          <div class="stat"><div class="lbl">TVA collectée ${info('compta.vat')}</div><div class="val">${C.money(sum.tva, cur)}</div><div class="sub">+ timbres ${C.money(sum.timbre, cur)}</div></div>
          <div class="stat"><div class="lbl">Encaissé sur la période ${info('compta.payments')}</div><div class="val">${C.money(paidTotal, cur)}</div><div class="sub">${pays.length} paiement(s)</div></div>
          <div class="stat"><div class="lbl">Reste à encaisser (total) ${info('dash.open')}</div><div class="val">${C.money(openAmount, cur)}</div><div class="sub">${open.length} facture(s) ouverte(s)</div></div>
        </div>
        <div class="panel"><h2>TVA par taux — ${h(periodLabel())} ${info('compta.vat')}</h2>
          <table class="list compact"><thead><tr><th>Taux</th><th class="r">Base HT</th><th class="r">TVA</th></tr></thead><tbody>
            ${C.VAT_RATES.map(r => `<tr><td>TVA ${r} %</td><td class="r">${C.money(sum.byRate[r].base, cur)}</td><td class="r">${C.money(sum.byRate[r].vat, cur)}</td></tr>`).join('')}
            <tr class="total-row"><td><strong>Total</strong></td><td class="r"><strong>${C.money(sum.ht, cur)}</strong></td><td class="r"><strong>${C.money(sum.tva, cur)}</strong></td></tr>
          </tbody></table>
          <p class="small muted mt">Timbres fiscaux : ${C.money(sum.timbre, cur)} · TTC facturé : ${C.money(sum.ttc, cur)} · Retenues à la source subies : ${C.money(sum.rs, cur)}. <em>À VÉRIFIER avec le comptable</em> avant déclaration.</p>
        </div>
        <div class="panel"><h2>Journal des ventes — ${h(periodLabel())} ${info('compta.journal')}</h2>
          <div class="inline mb"><button class="btn" id="exp-journal">Exporter en CSV (Excel)</button><button class="btn" id="exp-pdfs">Exporter tous les PDF de la période</button><button class="btn btn-primary" id="exp-comptable">Envoyer au comptable…</button>${info('compta.comptable')}</div>
          ${rows.length ? `<div class="scroll-x" id="j-wrap"><table class="list compact sortable"><thead>${sortHead(journalCols, comptaState.journal.sort)}</thead><tbody>
            ${jPage.rows.map(r => `<tr class="clickable" data-id="${r.id}">${journalCols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>${pagerBar(jPage.pg, { noun: 'document' })}` : '<div class="empty">Aucune facture émise sur cette période.</div>'}
        </div>
        <div class="panel"><h2>Encaissements — ${h(periodLabel())}</h2>
          <div class="inline mb"><button class="btn" id="exp-pays">Exporter en CSV (Excel)</button></div>
          ${pays.length ? `<div id="p-wrap"><table class="list compact sortable"><thead>${sortHead(payCols, comptaState.pays.sort)}</thead><tbody>
            ${pPage.rows.map(r => `<tr class="clickable" data-id="${r.docId}">${payCols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>${pagerBar(pPage.pg, { noun: 'paiement' })}` : '<div class="empty">Aucun encaissement sur cette période.</div>'}
        </div>
        <div class="panel"><h2>Retenues à la source — attestations à recevoir ${info('compta.rs')}</h2>
          ${rsPending.length ? `<p class="small muted">${C.money(rsPendingAmount, cur)} retenus par tes clients sans attestation reçue. Coche quand l'attestation arrive (elle justifie la retenue auprès du fisc).</p>
          <table class="list compact"><thead><tr><th>Facture</th><th>Client</th><th>Date</th><th class="r">Retenue</th><th></th></tr></thead><tbody>
            ${rsPending.map(d => { const t = C.computeTotals(d, company()); return `<tr><td><strong>${h(d.number)}</strong></td><td>${h(clientName(d.clientId))}</td><td>${C.fmtDate(d.date)}</td><td class="r">${C.money(t.withholding, cur)} <span class="muted small">(${pct(t.withholdingRate)} %)</span></td><td class="actions"><button class="btn btn-sm" data-cert="${d.id}">Attestation reçue</button></td></tr>`; }).join('')}
          </tbody></table>` : '<p class="small muted">Aucune attestation en attente.</p>'}
        </div>`;
      $$('tr.clickable[data-id]').forEach(tr => tr.onclick = () => navigate('#/doc/' + tr.dataset.id));
      // Chaque tableau a son propre tri et sa propre pagination : on limite la liaison à son panneau.
      const jPanel = $('#j-wrap') && $('#j-wrap').closest('.panel');
      const pPanel = $('#p-wrap') && $('#p-wrap').closest('.panel');
      if (jPanel) {
        bindSort(jPanel, key => { comptaState.journal.sort = toggleSort(comptaState.journal.sort, key, journalCols); comptaState.journal.page = 1; draw(); });
        bindPager(jPanel, comptaState.journal, () => draw(), '#j-wrap');
      }
      if (pPanel) {
        bindSort(pPanel, key => { comptaState.pays.sort = toggleSort(comptaState.pays.sort, key, payCols); comptaState.pays.page = 1; draw(); });
        bindPager(pPanel, comptaState.pays, () => draw(), '#p-wrap');
      }
      $$('[data-cert]').forEach(b => b.onclick = () => { const d = docById(b.dataset.cert); d.withholdingCertificate = true; save(true); draw(); toast('Attestation notée pour ' + d.number); });
      const tag = comptaState.month ? `${comptaState.year}-${comptaState.month}` : comptaState.year;
      // Envoi au comptable : journal de la période en pièce jointe, message prérempli
      $('#exp-comptable').onclick = () => {
        if (!rows.length) return toast('Rien à envoyer sur cette période.', true);
        const tpl = { ...C.DEFAULT_EMAIL_TEMPLATES.comptable, ...((company().emailTemplates || {}).comptable || {}) };
        const vars = { objet: periodLabel(), numero: rows.length, montant: C.money(sum.ht, cur), societe: company().name, client: company().accountantName || '' };
        modal(`<h2>Envoyer la comptabilité au comptable</h2>
          <p class="small muted">${rows.length} document(s) · ${C.money(sum.ht, cur)} HT · TVA ${C.money(sum.tva, cur)} — ${h(periodLabel())}</p>
          <form id="cpf" class="grid-2">
            ${field('Email du comptable', 'to', company().accountantEmail || '', 'email', 'placeholder="comptable@cabinet.tn"')}
            <label class="check" style="align-self:end"><input type="checkbox" name="remember" checked> Retenir cette adresse</label>
            <label class="field span-2">Objet<input type="text" name="subject" value="${h(C.fillTemplate(tpl.subject, vars))}"></label>
            <label class="field span-2">Message<textarea name="body" rows="8">${h(C.fillTemplate(tpl.body, vars))}</textarea></label>
          </form>
          <p class="small muted">Le journal des ventes est joint en CSV. Les encaissements et les PDF s'exportent séparément si ton comptable les demande.</p>
          <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Ouvrir dans la messagerie</button></div>`,
          (root, close) => { $('#ok', root).onclick = async () => {
            const v = formValues($('#cpf', root));
            if (!v.to || !/^[^@\s]+@[^@\s]+$/.test(v.to)) return toast('Adresse email invalide.', true);
            const b = $('#ok', root); b.disabled = true; b.textContent = 'Préparation…';
            try {
              const att = await bridge.saveTextSilent(`journal-ventes-${tag}.csv`, C.toCsv(rows, journalColumns()));
              const r = await bridge.composeMail({ to: v.to, subject: v.subject, body: v.body, attachment: att, mode: company().mailClient === 'mailto' ? 'mailto' : 'auto' });
              if (v.remember) { data.company.accountantEmail = v.to; save(true); }
              close();
              toast(r && r.state === 'mail' ? 'Message ouvert dans Mail avec le journal joint' : 'Message ouvert — glisse le fichier affiché dans le Finder');
            } catch (e) { b.disabled = false; b.textContent = 'Ouvrir dans la messagerie'; toast('Erreur : ' + e.message.replace(/^.*Error: /, ''), true); }
          }; });
      };
      $('#exp-journal').onclick = async () => {
        const p2 = await bridge.saveText(`journal-ventes-${tag}.csv`, C.toCsv(rows, journalColumns())); if (p2) toast('Exporté : ' + p2.split(/[\\/]/).pop());
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
    const resetPages = () => { comptaState.journal.page = 1; comptaState.pays.page = 1; };
    $('#c-year').onchange = e => { comptaState.year = e.target.value; resetPages(); draw(); };
    $('#c-month').onchange = e => { comptaState.month = e.target.value; resetPages(); draw(); };
    draw();
  };

  // ---------- Paramètres ----------
  routes.parametres = async () => {
    const c = company();
    const path = await bridge.dataPath();
    const TABS = [['societe', 'Société'], ['documents', 'Documents'], ['emails', 'Emails'], ['apparence', 'Apparence'], ['donnees', 'Sécurité et données'], ['maj', 'Mises à jour']];
    if (!TABS.some(t => t[0] === settingsTab)) settingsTab = 'societe';
    $('#view').innerHTML = `<div class="page-head"><h1>Paramètres</h1></div>
      <div class="tabs" id="set-tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" data-tab="${id}" class="${id === settingsTab ? 'active' : ''}">${label}</button>`).join('')}</div>
      <form id="pf">
        <section data-pane="societe">
        <div class="panel"><h2>Identité de l'entreprise</h2>
          <p class="small muted mb">Ces informations s'impriment en haut de chaque devis et facture. Le matricule fiscal est obligatoire sur une facture.</p>
          <div class="grid-2">
          ${field(lbl('Raison sociale', 'co.name'), 'name', c.name)}
          ${field(lbl('Matricule fiscal', 'co.matricule'), 'matricule', c.matricule, 'text', 'placeholder="1234567X/A/M/000"')}
          ${field(lbl('Registre de commerce (RC)', 'co.rc'), 'rc', c.rc || '', 'text', 'placeholder="B123456789"')}
          ${field(lbl('Capital social', 'co.capital'), 'capital', c.capital || '', 'text', 'placeholder="1 000 DT"')}
          <label class="field span-2">${lbl('Adresse', 'co.address')}<textarea name="address">${h(c.address)}</textarea></label>
          ${field('Téléphone', 'phone', c.phone)}
          ${field('Email', 'email', c.email, 'email')}
          ${field('Site web', 'website', c.website || '')}
          <label class="field span-2">${lbl('Slogan (sous le nom, sur les documents)', 'co.tagline')}<input type="text" name="tagline" value="${h(c.tagline || '')}" placeholder="Ce que fait ton entreprise, en quelques mots"></label>
        </div></div>
        <div class="panel"><h2>Image de marque</h2><div class="grid-2">
          <label class="field">${lbl('Couleur principale', 'co.colors')}<input type="color" name="primaryColor" value="${h(c.primaryColor || '#1b2430')}"></label>
          <label class="field">Couleur d'accent<input type="color" name="accentColor" value="${h(c.accentColor || '#0f9d8f')}"></label>
          <label class="field">${lbl('Logo', 'co.logo')}
            <div>${c.logo ? `<img class="logo-preview" src="${c.logo}">` : ''}
            <div class="inline"><button type="button" class="btn btn-sm" id="pick-logo">Choisir une image…</button>${c.logo ? '<button type="button" class="btn btn-sm btn-ghost" id="rm-logo">Retirer</button>' : ''}</div></div>
          </label>
          <label class="field">${lbl('Cachet / signature', 'co.stampImage')}
            <div>${c.stampImage ? `<img class="stamp-preview" src="${c.stampImage}">` : ''}
            <div class="inline"><button type="button" class="btn btn-sm" id="pick-stamp">Choisir une image…</button>${c.stampImage ? '<button type="button" class="btn btn-sm btn-ghost" id="rm-stamp">Retirer</button>' : ''}</div></div>
          </label>
        </div></div>
        <div class="panel"><h2>Coordonnées bancaires</h2>
          <p class="small muted mb">Le RIB s'affiche sur les factures, dans le bloc « Règlement ». C'est ce que ton client copie pour te payer : relis-le deux fois.</p>
          <div class="grid-2">
          ${field(lbl('Banque', 'pay.bank'), 'bank', c.bank)}
          ${field('RIB', 'rib', c.rib)}
          <label class="field span-2">${lbl('Conditions de paiement (sur les factures)', 'pay.terms')}<textarea name="paymentTerms">${h(c.paymentTerms || '')}</textarea></label>
        </div></div>
        </section>

        <section data-pane="documents" hidden>
        <div class="panel"><h2>Règles de facturation</h2><div class="grid-3">
          ${field(lbl('Timbre fiscal par facture', 'doc.stampFee'), 'stampFee', c.stampFee, 'number', 'step="0.001" min="0" class="num"')}
          ${field(lbl('Validité des devis (jours)', 'doc.quoteValidity'), 'quoteValidityDays', c.quoteValidityDays, 'number', 'min="0" class="num"')}
          ${field(lbl('Délai de paiement (jours)', 'doc.paymentDays'), 'paymentTermsDays', c.paymentTermsDays, 'number', 'min="0" class="num"')}
          <label class="field">${lbl('Retenue à la source par défaut', 'doc.withholdingDefault')}<select name="defaultWithholdingRate">${withholdingOptions(c.defaultWithholdingRate)}</select></label>
          ${field(lbl('Devise', 'doc.currency'), 'currency', c.currency)}
          <label class="check" style="align-self:end"><input type="checkbox" name="openAfterExport" ${c.openAfterExport !== false ? 'checked' : ''}> Ouvrir le PDF après export ${info('doc.openAfterExport')}</label>
        </div>
        <p class="small muted mt">Retenue à la source : calculée sur le TTC hors timbre, modifiable sur chaque facture et par client. Les taux et l'assiette sont <em>À VÉRIFIER avec ton comptable</em>.</p></div>
        <div class="panel"><h2>Textes imprimés sur les documents</h2><div class="grid-2">
          <label class="field span-2">${lbl('Conditions des devis', 'doc.quoteTerms')}<textarea name="quoteTerms">${h(c.quoteTerms || '')}</textarea></label>
          <label class="field span-2">${lbl('Pied de page des documents', 'doc.footer')}<textarea name="footer">${h(c.footer)}</textarea></label>
          <label class="field span-2">${lbl('Conditions de paiement — documents en anglais', 'doc.en')}<textarea name="paymentTermsEn">${h(c.paymentTermsEn || '')}</textarea></label>
          <label class="field span-2">Conditions des devis — documents en anglais<textarea name="quoteTermsEn">${h(c.quoteTermsEn || '')}</textarea></label>
        </div></div>
        </section>

        <section data-pane="emails" hidden>
        <div class="panel"><h2>Envoi</h2>
          <div class="grid-2">
            <label class="field">${lbl('Envoi des emails', 'mail.client')}<select name="mailClient"><option value="auto" ${c.mailClient !== 'mailto' ? 'selected' : ''}>Mail (Apple) avec le PDF joint — Mac</option><option value="mailto" ${c.mailClient === 'mailto' ? 'selected' : ''}>Autre messagerie (mailto, PDF à glisser)</option></select></label>
          </div>
        </div>
        <div class="panel"><h2>Comptable</h2><div class="grid-2">
          ${field(lbl('Email du comptable', 'compta.comptable'), 'accountantEmail', c.accountantEmail || '', 'email', 'placeholder="comptable@cabinet.tn"')}
        </div><p class="small muted mt">Utilisé par « Envoyer au comptable » sur la page Comptabilité.</p></div>
        <div class="panel"><h2>Modèles de messages ${info('mail.templates')}</h2>
          <p class="small muted mt">Variables utilisables : {numero} {client} {objet} {montant} {echeance} {jours} {societe} {reference}. Les documents en anglais utilisent les modèles en anglais.</p>
          ${[['fr', 'et', 'Modèles en français', C.DEFAULT_EMAIL_TEMPLATES, c.emailTemplates || {}], ['en', 'eten', 'Modèles en anglais (clients étrangers)', C.DEFAULT_EMAIL_TEMPLATES_EN, c.emailTemplatesEn || {}]].map(([lg, prefix, title, defs, cur2]) => `<details ${lg === 'fr' ? 'open' : ''}><summary>${title}</summary>
          ${[['devis', lg === 'fr' ? 'Envoi d\'un devis' : 'Quote'], ['facture', lg === 'fr' ? 'Envoi d\'une facture' : 'Invoice'], ['avoir', lg === 'fr' ? 'Envoi d\'un avoir' : 'Credit note'], ['relance1', lg === 'fr' ? 'Rappel (≤ 15 jours de retard)' : 'Reminder (≤ 15 days)'], ['relance2', lg === 'fr' ? 'Relance (16 à 45 jours)' : 'Second reminder (16–45 days)'], ['relance3', lg === 'fr' ? 'Dernière relance (> 45 jours)' : 'Final reminder (> 45 days)'], ['relanceDevis', lg === 'fr' ? 'Relance d\'un devis sans réponse' : 'Quote follow-up'], ['comptable', lg === 'fr' ? 'Envoi au comptable' : 'To the accountant']].map(([k, label]) => {
            const t = { ...defs[k], ...(cur2[k] || {}) };
            return `<div class="section-head"><h2 class="small">${label}</h2></div><div class="grid-2"><label class="field span-2">Objet<input type="text" name="${prefix}_${k}_subject" value="${h(t.subject)}"></label><label class="field span-2">Message<textarea name="${prefix}_${k}_body" rows="4">${h(t.body)}</textarea></label></div>`; }).join('')}
          </details>`).join('')}
        </div>
        </section>

        <section data-pane="apparence" hidden>
        <div class="panel"><h2>Apparence</h2><div class="grid-3">
          <label class="field">${lbl('Thème', 'ap.theme')}<select name="theme"><option value="light" ${c.theme !== 'dark' && c.theme !== 'auto' ? 'selected' : ''}>Clair</option><option value="dark" ${c.theme === 'dark' ? 'selected' : ''}>Sombre</option><option value="auto" ${c.theme === 'auto' ? 'selected' : ''}>Comme le système</option></select></label>
          <label class="field">${lbl('Langue des documents par défaut', 'ap.defaultLang')}<select name="defaultLang"><option value="fr" ${c.defaultLang !== 'en' ? 'selected' : ''}>Français</option><option value="en" ${c.defaultLang === 'en' ? 'selected' : ''}>English</option></select></label>
        </div><p class="small muted mt">Le thème sombre ne concerne que l'interface : les documents restent clairs.</p></div>
        </section>
      </form>

      <section data-pane="maj" hidden>
        <div class="panel"><h2>Mises à jour</h2><div id="update-panel"></div></div>
      </section>

      <section data-pane="donnees" hidden>
      <div class="panel"><h2>Copie externe ${info('data.external')}</h2>
        <p class="small muted">iCloud Drive, clé USB, disque réseau. À chaque enregistrement, le fichier de données et les sauvegardes y sont copiés. Si le Mac meurt, tout est ailleurs. <b>C'est le réglage le plus important de cette page.</b></p>
        <div id="ext-status" class="small mt"></div>
        <div class="inline mt"><button class="btn btn-primary" id="ext-choose">Choisir un dossier…</button><button class="btn btn-ghost" id="ext-remove" hidden>Retirer</button></div>
      </div>
      <div class="panel"><h2>Mot de passe ${info('sec.password')}</h2>
        <p id="sec-status">${security.encrypted ? '🔒 Mot de passe activé : le fichier de données et ses sauvegardes sont chiffrés (AES-256). Verrouiller : menu Fichier ou Cmd/Ctrl+L.' : 'Le fichier de données est en clair sur ce disque. Tu peux le protéger par un mot de passe demandé à chaque ouverture.'}</p>
        <div class="inline mt">${security.encrypted ? '<button class="btn" id="sec-change">Changer le mot de passe…</button><button class="btn" id="sec-lock">Verrouiller maintenant</button><button class="btn btn-danger" id="sec-remove">Retirer le mot de passe…</button>' : '<button class="btn btn-primary" id="sec-set">Activer un mot de passe…</button>'}</div>
        <p class="small muted mt">Le mot de passe protège les fichiers sur le disque (ordinateur perdu ou volé). Il n'existe aucune récupération : sans lui, les données sont définitivement illisibles, <b>y compris pour toi</b>.</p>
      </div>
      <div class="panel"><h2>Sauvegardes ${info('data.backups')}</h2>
        <p class="small muted">Fichier de données : <code>${h(path)}</code></p>
        <p class="small">${data.documents.length} document(s), ${data.clients.length} client(s), ${data.catalog.length} prestation(s).</p>
        <p class="small muted">Chaque jour, l'état du matin est copié dans le dossier <code>backups</code> (30 jours conservés) ; une copie est aussi prise avant tout import. Pour revenir en arrière : <em>Importer</em> et choisis un fichier de ce dossier.</p>
        <div class="inline mt">
          <button class="btn" id="backup-now">Sauvegarder maintenant</button>
          <button class="btn" id="open-backups">Ouvrir le dossier des sauvegardes</button>
          <button class="btn" id="export-data">Exporter les données…</button>
          <button class="btn" id="import-data">Importer…</button>
        </div>
      </div>
      <div class="panel danger-zone"><h2>Zone sensible</h2>
        <div class="dz-row">
          <div><b>Charger le jeu de démonstration</b> ${info('data.demo')}
            <div class="small muted">Remplace tes données par treize mois d'activité fictive. Tes paramètres société sont conservés et une sauvegarde est prise avant.</div></div>
          <button class="btn" id="load-demo">Charger la démo</button>
        </div>
        <div class="dz-row">
          <div><b>Tout effacer</b> ${info('data.wipe')}
            <div class="small muted">Supprime clients, prestations, documents, contrats, modèles et textes. Les paramètres société restent. Une sauvegarde est prise avant.</div></div>
          <button class="btn btn-danger" id="wipe-data">Tout effacer…</button>
        </div>
      </div>
      </section>

      <div class="save-bar" id="save-bar" hidden>
        <span>Modifications non enregistrées</span>
        <button class="btn" id="cancel-set">Annuler</button>
        <button class="btn btn-primary" id="save">Enregistrer</button>
      </div>`;

    // --- onglets
    const showTab = id => {
      settingsTab = id;
      $$('#set-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
      $$('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== id);
      $('#view').scrollTop = 0;
    };
    $$('#set-tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
    showTab(settingsTab);

    // --- barre « Enregistrer » : elle n'apparaît que s'il y a quelque chose à enregistrer
    let setDirty = false;
    const markSet = () => { if (setDirty) return; setDirty = true; $('#save-bar').hidden = false; };
    $('#pf').addEventListener('input', markSet);
    $('#pf').addEventListener('change', markSet);
    const applySettings = () => {
      const v = formValues($('#pf'));
      const et = {}, eten = {};
      Object.keys(v).forEach(k => { const m = k.match(/^(et|eten)_(\w+)_(subject|body)$/); if (m) { const bag = m[1] === 'et' ? et : eten; bag[m[2]] = bag[m[2]] || {}; bag[m[2]][m[3]] = v[k]; delete v[k]; } });
      Object.assign(data.company, v, { emailTemplates: et, emailTemplatesEn: eten });
      data.company.defaultWithholdingRate = Number(data.company.defaultWithholdingRate) || 0;
      save(true); applyTheme(); $('#brand-company').textContent = data.company.name || 'Ton entreprise';
      setDirty = false; $('#save-bar').hidden = true;
      return true;
    };
    setGuard({ dirty: () => setDirty, what: 'les paramètres', save: applySettings });
    $('#save').onclick = () => { applySettings(); toast('Paramètres enregistrés'); };
    $('#cancel-set').onclick = () => { setDirty = false; render(); };
    drawUpdatePanel();
    $('#backup-now').onclick = async () => { const p = await bridge.createBackup(); toast(p ? 'Sauvegarde créée : ' + p.split(/[\\/]/).pop() : 'Rien à sauvegarder pour l\'instant'); drawExternal(); };
    const drawExternal = async () => {
      const i = await bridge.externalBackupInfo(); const el = $('#ext-status'); if (!el) return;
      el.innerHTML = i.dir ? `Dossier : <code>${h(i.dir)}</code><br>${i.lastError ? `<span style="color:var(--danger)">Dernière copie impossible : ${h(i.lastError)}</span>` : (i.lastCopy ? `Dernière copie : ${h(new Date(i.lastCopy).toLocaleString('fr-FR'))}` : 'Copie à la prochaine sauvegarde.')}` : '<span class="muted">Aucun dossier de copie externe.</span>';
      $('#ext-remove').hidden = !i.dir;
    };
    drawExternal();
    $('#ext-choose').onclick = async () => { const i = await bridge.chooseExternalBackup(); if (i) { toast(i.lastError ? 'Dossier choisi, mais copie impossible : ' + i.lastError : 'Copie externe activée'); drawExternal(); } };
    $('#ext-remove').onclick = async () => { await bridge.setExternalBackup(null); toast('Copie externe désactivée'); drawExternal(); };
    if ($('#sec-set')) $('#sec-set').onclick = () => passwordDialog('set');
    if ($('#sec-change')) $('#sec-change').onclick = () => passwordDialog('change');
    if ($('#sec-remove')) $('#sec-remove').onclick = () => passwordDialog('remove');
    if ($('#sec-lock')) $('#sec-lock').onclick = lockNow;
    $('#open-backups').onclick = () => bridge.openBackups();
    $('#export-data').onclick = exportAll;
    $('#import-data').onclick = importAll;
    $('#pick-logo').onclick = async () => { try { const l = await bridge.pickLogo(); if (l) { data.company.logo = l; save(true); render(); } } catch (e) { toast(e.message.replace(/^.*Error: /, ''), true); } };
    if ($('#rm-logo')) $('#rm-logo').onclick = () => { data.company.logo = ''; save(true); render(); };
    $('#pick-stamp').onclick = async () => { try { const l = await bridge.pickLogo('Choisir l\'image du cachet / de la signature'); if (l) { data.company.stampImage = l; save(true); render(); } } catch (e) { toast(e.message.replace(/^.*Error: /, ''), true); } };
    if ($('#rm-stamp')) $('#rm-stamp').onclick = () => { data.company.stampImage = ''; save(true); render(); };
    $('#load-demo').onclick = async () => {
      const hasData = data.documents.length || data.clients.length;
      if (hasData && !await confirmDialog('Remplacer toutes les données actuelles par la démonstration ? Une sauvegarde de l\'état actuel est prise avant ; tes paramètres société (nom, logo, cachet, thème…) sont conservés.', 'Charger la démo', false)) return;
      if (hasData) await bridge.createBackup('avant-demo');
      data = window.SkanDemo.buildDemoData(data.company); save(true); applyTheme(); $('#brand-company').textContent = data.company.name; toast('Jeu de démonstration chargé'); navigate('#/dashboard');
    };
    // Effacement définitif : on demande d'écrire le mot, pas juste de cliquer
    $('#wipe-data').onclick = () => {
      modal(`<h2>Tout effacer</h2>
        <p>Cette action supprime <b>${data.documents.length} document(s)</b>, ${data.clients.length} client(s), ${data.catalog.length} prestation(s), ainsi que les contrats, modèles et textes prédéfinis. Les factures émises partent aussi.</p>
        <p class="small muted">Une sauvegarde nommée est prise juste avant : tu pourras revenir en arrière par <em>Importer</em>. Tes paramètres société sont conservés.</p>
        <form id="wf"><label class="field"><span class="fl">Pour confirmer, écris <b>EFFACER</b> ci-dessous</span><input type="text" name="w" autocomplete="off" spellcheck="false" placeholder="EFFACER"></label></form>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-danger" id="ok" disabled>Tout effacer</button></div>`,
        (root, close) => {
          const inp = $('input[name=w]', root), ok = $('#ok', root);
          inp.oninput = () => { ok.disabled = inp.value.trim().toUpperCase() !== 'EFFACER'; };
          ok.onclick = async () => {
            close();
            await bridge.createBackup('avant-effacement');
            data.clients = []; data.catalog = []; data.documents = []; data.recurring = []; data.templates = []; data.snippets = []; data.counters = {};
            save(true); toast('Données effacées'); render();
          };
        });
    };
  };

  // ---------- Aide ----------
  routes.aide = (parts) => {
    const arts = G.ARTICLES;
    if (parts && parts[0]) aideArticle = parts[0];
    if (!arts.some(a => a.id === aideArticle)) aideArticle = arts.length ? arts[0].id : '';
    const a = arts.find(x => x.id === aideArticle) || { title: '', sub: '', body: '' };
    $('#view').innerHTML = `
      <div class="page-head"><h1>Aide</h1>
        <div class="actions"><button class="btn" id="aide-changelog">Nouveautés de la version</button></div></div>
      <p class="lead">Comment marche SkanFact, et comment tenir la gestion d'une petite entreprise sans rien oublier. Partout dans l'application, les petits <span class="i-demo">i</span> expliquent le champ juste à côté.</p>
      <div class="help-grid">
        <nav class="help-nav">${arts.map(x => `<button data-art="${x.id}" class="${x.id === aideArticle ? 'active' : ''}"><span class="ht">${h(x.title)}</span><span class="hs">${h(x.sub)}</span></button>`).join('')}</nav>
        <article class="panel help-body">
          <h2 class="help-h">${h(a.title)}</h2>
          <p class="help-sub">${h(a.sub)}</p>
          ${a.body}
          <p class="small muted help-foot">Une question de fiscalité ou de comptabilité que cette aide ne tranche pas ? Elle est pour ton comptable : lui seul connaît ta situation et la réglementation en vigueur.</p>
        </article>
      </div>`;
    $$('[data-art]').forEach(b => b.onclick = () => { aideArticle = b.dataset.art; navigate('#/aide/' + b.dataset.art); });
    $('#aide-changelog').onclick = showChangelog;
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
    else if (name === 'lock') lockNow();
    else if (name.startsWith('help:')) navigate('#/aide/' + name.slice(5));
    else if (name.startsWith('go:')) navigate('#/' + name.slice(3));
  });

  // ---------- assistant de première utilisation ----------
  const OB = window.SkanOnboarding;
  function runSetup() {
    return new Promise(resolve => {
      const steps = OB.STEPS;
      const a = { currency: 'DT', stampFee: 1, quoteValidityDays: 30, paymentTermsDays: 30, defaultWithholdingRate: 0, activity: '', fillCatalog: true };
      let i = 0;
      const root = document.createElement('div'); root.id = 'setup';
      document.body.appendChild(root);

      const bodyFor = s => {
        if (s.id === 'bienvenue') return s.intro;
        if (s.id === 'entreprise') return `<form id="sf-form" class="grid-2">
          <label class="field span-2">Raison sociale <span class="req">obligatoire</span><input type="text" name="name" value="${h(a.name || '')}" placeholder="Nom exact de l'entreprise, forme juridique comprise" autofocus></label>
          ${field(lbl('Matricule fiscal', 'co.matricule'), 'matricule', a.matricule || '', 'text', 'placeholder="1234567X/A/M/000"')}
          ${field(lbl('Registre de commerce (RC)', 'co.rc'), 'rc', a.rc || '', 'text', 'placeholder="facultatif"')}
          <label class="field span-2">Adresse<textarea name="address" placeholder="Rue et numéro&#10;Code postal et ville">${h(a.address || '')}</textarea></label>
          ${field('Téléphone', 'phone', a.phone || '')}
          ${field('Email', 'email', a.email || '', 'email')}
          ${field(lbl('Capital social', 'co.capital'), 'capital', a.capital || '', 'text', 'placeholder="facultatif, ex. 1 000 DT"')}
        </form>
        <p class="small muted">Le matricule fiscal est obligatoire sur une facture en Tunisie. Si tu ne l'as pas encore, laisse vide et complète-le avant ta première facture.</p>`;
        if (s.id === 'activite') return `<div class="act-grid">
          ${C.ACTIVITIES.map(x => `<button type="button" class="act ${a.activity === x.id ? 'sel' : ''}" data-act="${x.id}">
            <span class="act-l">${h(x.label)}</span>
            <span class="act-s">${x.catalog.length ? x.catalog.length + ' prestations proposées · TVA ' + x.vat + ' %' : 'catalogue vide'}</span></button>`).join('')}
        </div>
        <label class="check mt"><input type="checkbox" id="sf-cat" ${a.fillCatalog ? 'checked' : ''}> Préremplir mon catalogue avec ces prestations (prix à ajuster ensuite)</label>
        <p class="small muted mt">Le catalogue sert à insérer une prestation dans un devis en un clic, sans retaper le libellé ni le prix. Les taux de TVA proposés sont les plus courants — <em>à faire confirmer par ton comptable</em>.</p>`;
        if (s.id === 'facturation') return `<form id="sf-form" class="grid-3">
          ${field(lbl('Devise', 'doc.currency'), 'currency', a.currency, 'text')}
          ${field(lbl('Timbre fiscal par facture', 'doc.stampFee'), 'stampFee', a.stampFee, 'number', 'step="0.001" min="0" class="num"')}
          ${field(lbl('Retenue à la source par défaut', 'doc.withholdingDefault'), 'defaultWithholdingRate', a.defaultWithholdingRate, 'number', 'step="0.5" min="0" class="num"')}
          ${field(lbl('Validité des devis (jours)', 'doc.quoteValidity'), 'quoteValidityDays', a.quoteValidityDays, 'number', 'min="0" class="num"')}
          ${field(lbl('Délai de paiement (jours)', 'doc.paymentDays'), 'paymentTermsDays', a.paymentTermsDays, 'number', 'min="0" class="num"')}
        </form>
        <p class="small muted">Les valeurs proposées sont les usages tunisiens : timbre fiscal de 1 dinar, trente jours de validité et trente jours de paiement, pas de retenue à la source par défaut. <em>À VÉRIFIER avec ton comptable selon ton activité et ton régime.</em></p>`;
        if (s.id === 'paiement') return `<form id="sf-form" class="grid-2">
          ${field(lbl('Banque', 'pay.bank'), 'bank', a.bank || '', 'text', 'placeholder="Nom de la banque et agence"')}
          ${field('RIB', 'rib', a.rib || '', 'text', 'placeholder="20 chiffres"')}
        </form>
        <p class="small muted">Ton RIB apparaîtra sur chaque facture, dans le bloc « Règlement ». <b>Relis-le caractère par caractère</b> : une erreur ici, c'est un paiement qui n'arrive jamais. Tu peux laisser vide et le remplir plus tard.</p>`;
        if (s.id === 'sauvegarde') return `<p>Tes données vivent dans un seul fichier, sur cet ordinateur. S'il tombe en panne, est volé ou perdu, ta comptabilité disparaît avec lui.</p>
          <p>Choisis un dossier dans <b>iCloud Drive</b>, sur une <b>clé USB</b> ou un disque réseau : à chaque enregistrement, SkanFact y recopiera tout, sans que tu aies à y penser.</p>
          <div class="inline mt"><button type="button" class="btn btn-primary" id="sf-ext">Choisir un dossier…</button><span id="sf-ext-st" class="small muted">Aucun dossier choisi.</span></div>
          <p class="small muted mt">Tu peux le faire plus tard dans Paramètres → Sécurité et données, mais l'expérience montre que « plus tard » n'arrive jamais.</p>`;
        return '';
      };

      const draw = () => {
        const s = steps[i];
        root.innerHTML = `<div class="setup-card">
          <div class="setup-head">
            <div class="brand-mark">SF</div>
            <div><div class="setup-t">${h(s.title)}</div><div class="setup-s">${h(s.sub)}</div></div>
            <div class="setup-step">${i + 1} / ${steps.length}</div>
          </div>
          <div class="setup-bar"><i style="width:${Math.round((i + 1) / steps.length * 100)}%"></i></div>
          <div class="setup-body">${bodyFor(s)}</div>
          <div class="setup-foot">
            <button class="btn btn-ghost" id="sf-skip">Passer et tout régler plus tard</button>
            ${i > 0 ? '<button class="btn" id="sf-prev">Retour</button>' : ''}
            <button class="btn btn-primary" id="sf-next">${i === steps.length - 1 ? 'Terminer' : 'Continuer'}</button>
          </div>
        </div>`;
        const form = $('#sf-form', root);
        if (form) { const f = $('input, textarea', form); if (f) f.focus(); }
        $$('[data-act]', root).forEach(b => b.onclick = () => { a.activity = b.dataset.act; a.fillCatalog = $('#sf-cat', root).checked; draw(); });
        if ($('#sf-cat', root)) $('#sf-cat', root).onchange = e => { a.fillCatalog = e.target.checked; };
        if ($('#sf-ext', root)) $('#sf-ext', root).onclick = async () => {
          const x = await bridge.chooseExternalBackup();
          const st = $('#sf-ext-st', root); if (!st) return;
          st.textContent = x && x.dir ? 'Copie activée vers : ' + x.dir : 'Aucun dossier choisi.';
          st.className = x && x.dir ? 'small' : 'small muted';
        };
        if ($('#sf-prev', root)) $('#sf-prev', root).onclick = () => { collect(); i--; draw(); };
        $('#sf-next', root).onclick = () => {
          collect();
          if (steps[i].id === 'entreprise' && !String(a.name || '').trim()) return toast('La raison sociale est nécessaire : c\'est le nom qui apparaît sur tes documents.', true);
          if (i === steps.length - 1) return finish();
          i++; draw();
        };
        root.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); $('#sf-next', root).click(); } };
        $('#sf-skip', root).onclick = async () => {
          if (!await confirmDialog('Passer l\'assistant ? Tu pourras tout régler dans Paramètres, mais une facture sans raison sociale ni matricule fiscal n\'est pas conforme.', 'Passer', false)) return;
          data.company.setupDone = true; save(true); root.remove(); resolve(false);
        };
      };
      const collect = () => { const f = $('#sf-form', root); if (f) Object.assign(a, formValues(f)); };
      const finish = () => {
        OB.applySetup(data, a);
        save(true);
        root.remove();
        resolve(true);
      };
      draw();
    });
  }

  // ---------- import / export ----------
  async function exportAll() {
    if (security.encrypted && !await confirmDialog('L\'export JSON est en clair (non chiffré). Continuer ?', 'Exporter', false)) return;
    const p = await bridge.exportData(data); if (p) toast('Exporté : ' + p.split(/[\\/]/).pop());
  }
  async function importAll() {
    if (!await confirmDialog('Importer un fichier remplacera toutes les données actuelles (une sauvegarde de l\'état actuel est faite avant). Continuer ?')) return;
    try {
      let r = await bridge.importData();
      if (r && r.needPassword) {
        r = await new Promise(resolve => promptDialog('Fichier chiffré', 'Mot de passe de ce fichier', '', async pw => resolve(await bridge.importData({ retry: true, password: pw })), 'password'));
      }
      if (r && r.needPassword) return toast('Mot de passe incorrect.', true);
      const d = r && r.data;
      if (d) { data = migrate(d); applyTheme(); $('#brand-company').textContent = data.company.name; toast('Données importées'); render(); }
    } catch (e) { toast('Import impossible : ' + e.message.replace(/^.*Error: /, ''), true); }
  }
  $('#btn-export-data').onclick = exportAll;
  $('#btn-import-data').onclick = importAll;

  // ---------- démarrage ----------
  (async () => {
    const loaded = await bridge.loadData();
    let raw = loaded && loaded.data;
    security.encrypted = !!(loaded && loaded.encrypted);
    if (loaded && loaded.locked) raw = await showLockScreen();
    data = migrate(raw);
    if (raw && (raw.version || 1) < 3) save(true); // données migrées vers le nouveau format : on enregistre tout de suite
    applyTheme();
    // Toute première ouverture : l'assistant remplit l'entreprise avant d'entrer dans l'application
    if (OB.needsSetup(data)) {
      const done = await runSetup();
      applyTheme();
      if (done) toast('Bienvenue ! Commence par un devis, ou charge la démo depuis Paramètres.');
    }
    $('#brand-company').textContent = data.company.name || 'Ton entreprise';
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
