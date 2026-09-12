// SkanFact Cabinet — l'interface du comptable.
//
// Une seule question guide cet écran : « lequel de mes clients ne m'a pas envoyé son mois ? ».
// Tout le reste (ouvrir une pièce, relancer, régler son cabinet) en découle. On ne modifie jamais la
// comptabilité d'un client : cette application lit, elle n'écrit pas chez les autres.
(function () {
  'use strict';

  const K = window.CabCore;
  const G = window.CabGuide || { INFO: {}, ARTICLES: [] };
  const api = window.cabinet;

  let S = null;                          // l'état du cabinet (sans la clé privée)
  let backupInfo = null;                 // sauvegardes, copie externe, place disque
  // Mises à jour : l'état de la dernière vérification, partagé entre le panneau et la pastille.
  const upd = { state: 'idle', version: '', percent: 0, message: '', app: null };

  // Les préférences d'affichage vivent sur le poste, pas dans la base chiffrée : ce n'est pas une
  // donnée de cabinet, et une colonne triée n'a pas à être sauvegardée avec les comptabilités.
  const prefs = {
    get(k, def) { try { const v = localStorage.getItem('cab.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem('cab.' + k, JSON.stringify(v)); } catch {} }
  };

  const listState = {
    q: '', withArchived: false, onlySkanfact: false,
    sort: prefs.get('sort', 'urgence'), desc: prefs.get('desc', false),
    page: 1, size: prefs.get('size', 25)
  };

  // ---------- petits outils ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  // `h` est le nom de la fonction d'échappement dans l'app entreprise. On l'aliase ici parce qu'une
  // ligne copiée d'un fichier à l'autre a déjà appelé `h()` dans ce fichier-ci, où il n'existait
  // pas : le panneau des mises à jour plantait au moment précis où il devait annoncer une panne.
  const h = esc;

  // Une erreur venue du processus principal arrive habillée en « Error invoking remote method '…' ».
  // On ne montre que la phrase écrite pour l'utilisateur.
  const plainError = e => String((e && e.message) || e || '')
    .replace(/^Error invoking remote method '[^']*':\s*/, '').replace(/^Error:\s*/, '') || 'Erreur inconnue.';

  let toastTimer = null;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (kind === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, kind === 'error' ? 5200 : 2800);
  }

  // Un « ✓ enregistré » posé À CÔTÉ du bouton, plutôt qu'un message passager au bas de l'écran qui
  // recouvrait justement ce bouton-là.
  function flash(el, text) {
    if (!el) return;
    el.textContent = text || '✓ enregistré';
    el.hidden = false;
    clearTimeout(el.__t);
    el.__t = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // ---------- bulles « i » ----------
  function info(key) {
    if (!G.INFO[key]) return '';
    return `<button type="button" class="i" data-info="${esc(key)}" aria-label="Qu'est-ce que c'est ?" title="Qu'est-ce que c'est ?">i</button>`;
  }
  const lbl = (text, key) => key ? `<span class="fl">${text} ${info(key)}</span>` : text;

  function closeInfoPop() { const p = $('#info-pop'); if (p) p.remove(); }
  function openInfoPop(btn) {
    const x = G.INFO[btn.dataset.info]; if (!x) return;
    closeInfoPop();
    const pop = document.createElement('div');
    pop.id = 'info-pop';
    pop.innerHTML = `<div class="ip-head">${esc(x.t)}<button type="button" class="ip-close" aria-label="Fermer">✕</button></div><div class="ip-body">${x.d}</div>`;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth, hh = pop.offsetHeight;
    pop.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8) + 'px';
    pop.style.top = (r.bottom + 8 + hh > window.innerHeight - 8 ? Math.max(8, r.top - hh - 8) : r.bottom + 8) + 'px';
    $('.ip-close', pop).onclick = closeInfoPop;
  }
  document.addEventListener('click', e => {
    const btn = e.target.closest('.i[data-info]');
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      const open = $('#info-pop'); closeInfoPop();
      if (!open || open._key !== btn.dataset.info) { openInfoPop(btn); if ($('#info-pop')) $('#info-pop')._key = btn.dataset.info; }
      return;
    }
    if (!e.target.closest('#info-pop')) closeInfoPop();
  }, true);
  window.addEventListener('resize', closeInfoPop);

  // Une fenêtre = une couche. Jamais `innerHTML` sur le conteneur : cela détruirait la fenêtre du
  // dessous et la saisie en cours (règle apprise en 2.4.0 côté entreprise).
  function modal(html, onMount, onDismiss) {
    const layer = document.createElement('div');
    layer.className = 'modal-bg';
    layer.innerHTML = `<div class="modal">${html}</div>`;
    $('#modal-root').appendChild(layer);
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      layer.remove();
      document.removeEventListener('keydown', onKey);
    };
    const dismiss = () => { if (!done) { const f = onDismiss; close(); if (f) f(); } };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); dismiss(); } };
    document.addEventListener('keydown', onKey);
    layer.addEventListener('mousedown', e => { if (e.target === layer) dismiss(); });
    if (onMount) onMount(layer, close);
    const first = layer.querySelector('input, select, textarea, button');
    if (first) first.focus();
    return close;
  }

  // Une promesse posée par une boîte de dialogue DOIT toujours se résoudre : Échap et le clic à côté
  // valent « Annuler ». Une promesse en suspens bloque son appelant pour toujours, sans erreur.
  function confirmDialog(title, body, okLabel, danger) {
    return new Promise(resolve => {
      modal(
        `<h2>${esc(title)}</h2><div>${body}</div>
         <div class="modal-actions"><button class="btn" id="no">Annuler</button>
         <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="ok">${esc(okLabel || 'Continuer')}</button></div>`,
        (layer, close) => {
          $('#no', layer).onclick = () => { close(); resolve(false); };
          $('#ok', layer).onclick = () => { close(); resolve(true); };
        },
        () => resolve(false)
      );
    });
  }

  // Une confirmation dangereuse où il faut RECOPIER un mot. Réservée à ce qui ne se défait pas :
  // supprimer un dossier, c'est effacer les pièces d'un client.
  function confirmTyped(title, body, word, okLabel) {
    return new Promise(resolve => {
      modal(
        `<h2>${esc(title)}</h2><div>${body}</div>
         <label class="field mt">Recopie <b>${esc(word)}</b> pour confirmer<input type="text" id="w" autocomplete="off" spellcheck="false"></label>
         <div class="modal-actions"><button class="btn" id="no">Annuler</button>
         <button class="btn btn-danger" id="ok" disabled>${esc(okLabel || 'Supprimer')}</button></div>`,
        (layer, close) => {
          const w = $('#w', layer), ok = $('#ok', layer);
          w.oninput = () => { ok.disabled = w.value.trim().toUpperCase() !== word.toUpperCase(); };
          w.onkeydown = e => { if (e.key === 'Enter' && !ok.disabled) { e.preventDefault(); close(); resolve(true); } };
          $('#no', layer).onclick = () => { close(); resolve(false); };
          ok.onclick = () => { close(); resolve(true); };
        },
        () => resolve(false)
      );
    });
  }

  function askPassword(title, note, okLabel) {
    return new Promise(resolve => {
      modal(
        `<h2>${esc(title)}</h2><p class="muted small">${esc(note || '')}</p>
         <label class="field mt">Mot de passe<span class="pw-wrap"><input type="password" id="pw" autocomplete="off"><button type="button" class="pw-eye" id="eye" aria-label="Afficher le mot de passe">Afficher</button></span></label>
         <div class="modal-actions"><button class="btn" id="no">Annuler</button>
         <button class="btn btn-primary" id="ok">${esc(okLabel || 'Ouvrir')}</button></div>`,
        (layer, close) => {
          const pw = $('#pw', layer);
          const go = () => { const v = pw.value; close(); resolve(v); };
          $('#eye', layer).onclick = () => {
            pw.type = pw.type === 'password' ? 'text' : 'password';
            $('#eye', layer).textContent = pw.type === 'password' ? 'Afficher' : 'Masquer';
            pw.focus();
          };
          pw.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
          $('#no', layer).onclick = () => { close(); resolve(null); };
          $('#ok', layer).onclick = go;
        },
        () => resolve(null)
      );
    });
  }

  // « 1 dossier(s) » : personne n'écrit ça non plus. Un logiciel qui parle mal donne l'impression
  // d'être bâclé, et c'est le premier contact d'un comptable avec SkanFact.
  const pl = (n, un, plur) => `${n} ${n > 1 ? (plur || un + 's') : un}`;
  // Même règle que côté entreprise : le dinar se compte en millimes (trois décimales), les autres
  // devises en centimes. « DT » et « TND » désignent la même monnaie.
  const dinar = cur => !cur || cur === 'DT' || cur === 'TND';
  const money = (n, cur) => {
    if (n == null) return '—';
    const dec = dinar(cur) ? 3 : 2;
    return Math.abs(Number(n) || 0).toFixed(dec).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
      + ' ' + (cur || 'DT');
  };
  const fmtBytes = n => !n ? '—' : n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' Go'
    : n >= 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';
  function fmtWhen(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    const p = x => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fmtDay(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    const p = x => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  // « il y a 3 jours » : devant une colonne de dates, c'est ce qu'on cherche vraiment à savoir.
  function ago(ms) {
    if (!ms) return '';
    const j = Math.floor((Date.now() - ms) / 86400000);
    return j <= 0 ? "aujourd'hui" : j === 1 ? 'hier' : `il y a ${j} jours`;
  }

  // ---------- listes : tri et pagination ----------
  // À soixante dossiers, une liste sans tri ni pages devient un mur. Les totaux et les exports
  // portent toujours sur la SÉLECTION ENTIÈRE, jamais sur la page affichée (règle de la 2.2.0).
  function sortHead(label, key, help) {
    const on = listState.sort === key;
    return `<th class="nw sortable" data-sort="${esc(key)}" title="Trier">${esc(label)}${help ? ' ' + info(help) : ''}<span class="sort-ar">${on ? (listState.desc ? '↓' : '↑') : '⇅'}</span></th>`;
  }
  function bindSort(root, redraw) {
    $$('th.sortable', root).forEach(th => {
      th.onclick = () => {
        const k = th.dataset.sort;
        if (listState.sort === k) listState.desc = !listState.desc;
        else { listState.sort = k; listState.desc = false; }
        prefs.set('sort', listState.sort); prefs.set('desc', listState.desc);
        listState.page = 1;
        redraw();
      };
    });
  }
  function pagerBar(total) {
    const pages = Math.max(1, Math.ceil(total / listState.size));
    if (listState.page > pages) listState.page = pages;
    if (pages <= 1 && listState.size >= total) return '';
    const from = total ? (listState.page - 1) * listState.size + 1 : 0;
    const to = Math.min(total, listState.page * listState.size);
    return `<div class="pager">
      <button class="btn btn-sm" id="pg-prev" ${listState.page <= 1 ? 'disabled' : ''}>← Précédent</button>
      <span class="muted small">${from}–${to} sur ${total}</span>
      <button class="btn btn-sm" id="pg-next" ${listState.page >= pages ? 'disabled' : ''}>Suivant →</button>
      <select id="pg-size" class="sm" aria-label="Lignes par page">
        ${[25, 50, 100, 500].map(n => `<option value="${n}" ${listState.size === n ? 'selected' : ''}>${n} par page</option>`).join('')}
      </select></div>`;
  }
  function bindPager(root, redraw) {
    const p = $('#pg-prev', root), n = $('#pg-next', root), s = $('#pg-size', root);
    if (p) p.onclick = () => { listState.page--; redraw(); };
    if (n) n.onclick = () => { listState.page++; redraw(); };
    if (s) s.onchange = () => { listState.size = Number(s.value); listState.page = 1; prefs.set('size', listState.size); redraw(); };
  }
  const paginate = rows => rows.slice((listState.page - 1) * listState.size, listState.page * listState.size);

  function toCsv(cols, rows) {
    const q = v => {
      const s = String(v == null ? '' : v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    // Point-virgule : c'est le séparateur qu'attend Excel dans une configuration française.
    return [cols.map(c => q(c.label)).join(';')]
      .concat(rows.map(r => cols.map(c => q(c.get(r))).join(';'))).join('\r\n');
  }

  // ---------- ouverture ----------
  async function boot() {
    const st = await api.status();
    $('#app-version').textContent = 'v' + st.version;
    const sub = $('#lock-sub'), pw2wrap = $('#lock-pw2-wrap'), note = $('#lock-note');
    if (st.corruptFile) {
      $('#lock-err').innerHTML = 'Le fichier du cabinet était illisible. Il a été <b>mis de côté sans être effacé</b> : ouvre avec ton mot de passe, puis restaure une sauvegarde dans Réglages.';
      $('#lock-err').hidden = false;
    }
    if (st.exists) {
      sub.textContent = 'Entre le mot de passe de ton cabinet.';
      note.innerHTML = 'Le dossier est chiffré sur ce poste : sans ce mot de passe, personne ne peut lire les comptabilités de tes clients.';
    } else {
      $('#lock-title').textContent = 'Bienvenue';
      sub.textContent = 'Choisis le mot de passe de ton cabinet. Il chiffre tout ce que tes clients t\'enverront.';
      pw2wrap.hidden = false;
      $('#lock-go').textContent = 'Créer mon cabinet';
      // L'avertissement le plus important de toute l'application était jusqu'ici la ligne la plus
      // petite et la plus grise de l'écran. Il est maintenant impossible à manquer.
      note.innerHTML = '<span class="lock-warn">⚠ Il n\'y a aucun moyen de récupérer ce mot de passe.</span> '
        + 'Ni nous, ni personne. Note-le maintenant, quelque part de sûr — c\'est le prix à payer pour qu\'un ordinateur volé n\'emporte pas les comptabilités de tes clients.';
    }
    const pw = $('#lock-pw'), pw2 = $('#lock-pw2');
    $('#lock-eye').onclick = () => {
      const t = pw.type === 'password' ? 'text' : 'password';
      pw.type = t; pw2.type = t;
      $('#lock-eye').textContent = t === 'password' ? 'Afficher' : 'Masquer';
      pw.focus();
    };
    if (!st.exists) pw.oninput = () => { $('#lock-strength').textContent = strengthText(pw.value); };

    $('#lock-form').onsubmit = async e => {
      e.preventDefault();
      const err = $('#lock-err');
      err.hidden = true;
      const v = pw.value;
      if (!st.exists && v.length < 8) { err.textContent = 'Huit caractères au minimum : ce mot de passe protège les comptes de tous tes clients.'; err.hidden = false; return; }
      if (st.exists && v.length < 1) { err.textContent = 'Entre ton mot de passe.'; err.hidden = false; return; }
      if (!st.exists && v !== pw2.value) { err.textContent = 'Les deux mots de passe ne sont pas les mêmes.'; err.hidden = false; return; }
      const go = $('#lock-go');
      go.disabled = true; go.textContent = 'Ouverture…';
      try {
        const r = await api.unlock(v);
        S = r.state;
        $('#lock-screen').remove();
        $('#app').hidden = false;
        start(r.created, r.reorganized);
      } catch (ex) {
        err.innerHTML = esc(plainError(ex));
        err.hidden = false;
        go.disabled = false;
        go.textContent = st.exists ? 'Ouvrir' : 'Créer mon cabinet';
        pw.select();
      }
    };
    pw.focus();
  }

  function strengthText(v) {
    if (!v) return '';
    const varie = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(v)).length;
    if (v.length < 8) return 'Trop court (8 caractères minimum).';
    if (v.length >= 16 || (v.length >= 12 && varie >= 3)) return 'Solide.';
    if (v.length >= 10 && varie >= 2) return 'Correct.';
    return 'Faible : allonge-le, une phrase entière vaut mieux qu\'un mot compliqué.';
  }

  function start(created, reorganized) {
    window.addEventListener('hashchange', render);
    api.onUpdateEvent(ev => {
      upd.state = ev.state;
      if (ev.version) upd.version = ev.version;
      if (ev.percent != null) upd.percent = ev.percent;
      if (ev.message) upd.message = ev.message;
      drawUpdatePanel();
      updateBanner();
    });
    api.updVersion().then(v => {
      upd.app = v;
      const el = $('#app-version'); if (el) el.textContent = 'v' + v.version;
      // Résultat de la mise à jour précédente sur macOS : l'app vient de se relancer, on le dit.
      if (v.lastUpdate) {
        if (v.lastUpdate.ok) toast('SkanFact Cabinet mis à jour en version ' + v.version);
        else toast('Mise à jour non installée : ' + (v.lastUpdate.message || 'erreur inconnue'), 'error');
      }
    }).catch(() => {});
    api.onMenuAction(name => {
      if (name === 'import') doImport();
      else if (name === 'new-dossier') newDossierForm();
      else if (name === 'backup') quickBackup();
      else if (name === 'palette') openPalette();
      else if (name === 'support') supportDialog();
      else if (name.startsWith('go:')) location.hash = '#/' + name.slice(3);
    });
    // Un paquet double-cliqué dans le Finder : c'est le geste le plus naturel après avoir reçu un mail.
    api.onFileOpen(f => handleDropped([f]));
    api.takePending().then(list => { if (list && list.length) handleDropped(list); }).catch(() => {});
    setupDrop();
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    });
    $('#upd-pill').onclick = () => { location.hash = '#/reglages'; };
    if (!location.hash) location.hash = '#/dossiers';
    render();
    refreshBackupInfo();
    if (reorganized && reorganized.moved) {
      toast(`${pl(reorganized.moved, 'paquet')} rangé${reorganized.moved > 1 ? 's' : ''} par client et par année.`);
    }
    // Premier lancement : l'assistant, pas un formulaire de réglages et un message passager.
    if (created || !(S.cabinet.name || '').trim()) runSetup();
  }

  async function refresh() { S = await api.state(); }
  async function refreshBackupInfo() {
    try { backupInfo = await api.backups(); } catch { backupInfo = null; }
    if (location.hash.startsWith('#/reglages')) drawBackupPanels();
  }

  // ---------- glisser-déposer ----------
  // Le geste le plus naturel — attraper le .skanpack reçu par mail et le lâcher sur la fenêtre.
  function setupDrop() {
    const veil = $('#drop-veil');
    let depth = 0;
    const show = on => { veil.hidden = !on; };
    window.addEventListener('dragenter', e => { e.preventDefault(); depth++; show(true); });
    window.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    window.addEventListener('dragleave', e => { e.preventDefault(); depth = Math.max(0, depth - 1); if (!depth) show(false); });
    window.addEventListener('drop', e => {
      e.preventDefault(); depth = 0; show(false);
      const files = [...(e.dataTransfer.files || [])].map(f => api.pathForFile(f)).filter(Boolean);
      if (files.length) handleDropped(files);
    });
  }

  function handleDropped(paths) {
    const packs = paths.filter(p => /\.(skanpack|zip)$/i.test(p));
    const others = paths.filter(p => !/\.(skanpack|zip)$/i.test(p));
    if (packs.length) doImport(packs);
    if (others.length && !packs.length) {
      toast(others.some(p => /\.skanpair$/i.test(p))
        ? 'Ce fichier d\'appairage est celui que TU remets à tes clients : il s\'importe dans leur SkanFact, pas ici.'
        : 'Dépose un paquet .skanpack reçu d\'un client.', 'error');
    }
  }

  // ---------- import d'un paquet ----------
  async function doImport(paths) {
    let r;
    try { r = await api.importPack({ paths }); }
    catch (e) { return toast(plainError(e), 'error'); }
    if (!r) return;                                     // fenêtre annulée
    S = r.state;

    // Un paquet protégé par mot de passe : on le redemande une fois, pour ces fichiers-là seulement.
    const locked = r.results.filter(x => x.error && /mot de passe/i.test(x.error));
    if (locked.length) {
      const pw = await askPassword('Paquet protégé', `${pl(locked.length, 'paquet')} ${locked.length > 1 ? 'sont scellés' : 'est scellé'} par un mot de passe. Demande-le à ton client s'il ne te l'a pas donné.`);
      if (pw) {
        try {
          const r2 = await api.importPack({ paths: locked.map(x => x.file), password: pw });
          if (r2) {
            S = r2.state;
            r = { results: r.results.filter(x => !locked.includes(x)).concat(r2.results), state: r2.state, demoRemoved: r.demoRemoved || r2.demoRemoved };
          }
        } catch (e) { toast(plainError(e), 'error'); }
      }
    }
    showImportReport(r.results, r.demoRemoved);
    render();
    refreshBackupInfo();
  }

  function importLine(x) {
    const file = esc((x.file || '').split(/[\\/]/).pop());
    if (x.error) return `<li><span class="imp-err">✕ ${file}</span><div class="imp-sub">${esc(x.error)}</div></li>`;
    const d = x.dossier || {};
    const bits = [];
    if (x.created) bits.push('nouveau dossier');
    if (x.adopted) bits.push('✓ ce client s\'est mis à SkanFact');
    if (x.replaced) bits.push(x.wasDefinitive && !x.nowDefinitive
      ? '⚠ remplace un mois qui était définitif — les chiffres ont pu changer'
      : 'remplace le mois déjà reçu');
    bits.push(x.nowDefinitive ? 'mois clôturé (définitif)' : 'mois non clôturé (provisoire)');
    const integ = x.integrity || {};
    const bad = (integ.bad || []).length;
    bits.push(bad
      ? `⚠ ${pl(bad, 'fichier')} ne ${bad > 1 ? 'correspondent' : 'correspond'} pas à l'empreinte annoncée`
      : `${pl(integ.checked || 0, 'pièce')} ${(integ.checked || 0) > 1 ? 'vérifiées, intactes' : 'vérifiée, intacte'}`);
    const miss = (x.summary && x.summary.missing || []).reduce((s, m) => s + (m.count || 0), 0);
    if (miss) bits.push(`${pl(miss, 'point')} ${miss > 1 ? 'signalés' : 'signalé'} par le client`);
    return `<li><strong>✓ ${esc(d.name || '')}</strong> — ${esc((x.summary && x.summary.label) || x.month || '')}
            <div class="imp-sub">${bits.map(esc).join(' · ')}</div></li>`;
  }

  function showImportReport(results, demoRemoved) {
    const ok = results.filter(x => !x.error).length;
    const ko = results.length - ok;
    modal(
      `<h2>${ok ? `${pl(ok, 'paquet')} ${ok > 1 ? 'rangés' : 'rangé'}` : 'Aucun paquet rangé'}${ko ? ` · ${pl(ko, 'refusé')}` : ''}</h2>
       <ul class="imp-list">${results.map(importLine).join('')}</ul>
       ${demoRemoved ? '<p class="small mt">Les dossiers d\'exemple ont été effacés : place aux vrais.</p>' : ''}
       <p class="muted small mt">Les paquets sont copiés dans le dossier de l'application, rangés par client et par année : le fichier d'origine reste où il est.</p>
       <div class="modal-actions"><button class="btn btn-primary" id="ok">Fermer</button></div>`,
      (layer, close) => { $('#ok', layer).onclick = close; }
    );
  }

  async function quickBackup() {
    try {
      const r = await api.backupNow('manuelle');
      backupInfo = await api.backups();
      toast('Sauvegarde prise.');
      if (location.hash.startsWith('#/reglages')) drawBackupPanels();
      return r;
    } catch (e) { toast(plainError(e), 'error'); }
  }

  // ---------- rendu ----------
  // Une pastille, et seulement quand il y a vraiment quelque chose à installer.
  function updateBanner() {
    const el = $('#upd-pill'); if (!el) return;
    const montre = upd.state === 'available' || upd.state === 'downloading' || upd.state === 'downloaded';
    el.hidden = !montre;
    el.textContent = upd.state === 'downloaded' ? `Version ${upd.version} prête à installer`
      : upd.state === 'downloading' ? `Téléchargement… ${upd.percent} %`
      : `Version ${upd.version} disponible`;
  }

  function render() {
    const hash = location.hash.replace(/^#\//, '') || 'dossiers';
    const [route, arg] = hash.split('/');
    $$('.sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    $('#brand-cab').textContent = S.cabinet.name || 'Cabinet';
    updateBanner();
    // La pastille compte EXACTEMENT les lignes de la page Relances. Deux chiffres pour la même chose
    // faisaient douter de tout le reste.
    const relCount = K.relanceRows(S).length;
    const pill = $('#nav-relances');
    pill.hidden = !relCount;
    if (relCount) pill.textContent = relCount;
    const view = $('#view');
    if (route === 'dossier') drawDossier(view, arg);
    else if (route === 'ecritures') drawEcritures(view);
    else if (route === 'echeances') drawEcheances(view);
    else if (route === 'relances') drawRelances(view);
    else if (route === 'reglages') drawReglages(view);
    else if (route === 'aide') drawAide(view);
    else drawDossiers(view);
  }

  function todoPanel(todo) {
    if (!todo.length) {
      const p = K.portfolio(S);
      if (!p.surSkanfact) return '';
      return `<div class="todo-ok">Tout est à jour : tes ${pl(p.surSkanfact, 'dossier')} sur SkanFact ont envoyé leurs mois clôturés.</div>`;
    }
    return `<div class="panel todo"><h2>À faire</h2><ul>${todo.map(t => `
      <li class="lvl-${t.level}"><span class="td-dot"></span>
        <span class="td-txt"><strong>${esc(t.label)}</strong><span class="small muted">${esc(t.detail)}</span></span>
        <a class="btn btn-ghost btn-sm" href="#/relances">Voir</a></li>`).join('')}</ul></div>`;
  }

  // Le portefeuille d'un coup d'œil. C'est ce qui manquait pour qu'un comptable voie autre chose
  // qu'une liste — et c'est précisément ce qui impressionne en démonstration.
  function portfolioPanel(p) {
    if (!p.total) return '';
    return `<div class="stats">
      <div class="stat"><div class="lbl">Clients suivis</div><div class="val">${p.total}</div>
        <div class="sub">${p.surSkanfact} sur SkanFact${p.horsSkanfact ? ` · ${p.horsSkanfact} pas encore` : ''}</div></div>
      <div class="stat"><div class="lbl">À jour</div><div class="val ${p.enRetard ? '' : 'ok'}">${p.aJour}<span class="sub">/ ${p.surSkanfact || 0}</span></div>
        <div class="sub">${p.enRetard ? `${p.enRetard} en retard` : 'aucun retard'}${p.provisoires ? ` · ${p.provisoires} en provisoire` : ''}</div></div>
      <div class="stat"><div class="lbl">Mois manquants</div><div class="val ${p.moisManquants ? 'due' : 'ok'}">${p.moisManquants}</div>
        <div class="sub">${p.paquets ? pl(p.paquets, 'paquet') + ' reçu' + (p.paquets > 1 ? 's' : '') : 'aucun paquet reçu'}</div></div>
      <div class="stat"><div class="lbl">Dernier CA suivi</div><div class="val">${esc(money(p.dernierCA))}</div>
        <div class="sub">${p.honoraires ? 'Honoraires : ' + esc(money(p.honoraires)) + ' / mois' : 'somme des derniers mois reçus'}</div></div>
    </div>`;
  }

  const CSV_COLS = [
    { label: 'Client', get: r => r.name },
    { label: 'Matricule', get: r => r.matricule },
    { label: 'Email', get: r => r.email },
    { label: 'Téléphone', get: r => r.phone },
    { label: 'Interlocuteur', get: r => r.contact },
    { label: 'Sur SkanFact', get: r => r.manual ? 'non' : 'oui' },
    { label: 'Dernier mois reçu', get: r => r.lastLabel },
    { label: 'Définitif', get: r => r.lastMonth ? (r.lastDefinitive ? 'oui' : 'non') : '' },
    { label: 'Chiffre d\'affaires', get: r => r.lastFigures ? String(r.lastFigures.ca).replace('.', ',') : '' },
    { label: 'Mois manquants', get: r => r.missingCount },
    { label: 'Provisoires', get: r => r.provisionalCount },
    { label: 'Points signalés', get: r => r.issues },
    { label: 'Dernière relance', get: r => r.lastRelanceAt ? fmtDay(r.lastRelanceAt) : '' },
    { label: 'Régime', get: r => r.regime },
    { label: 'TVA', get: r => r.tvaPeriod },
    { label: 'Honoraires', get: r => r.fees || '' },
    { label: 'Archivé', get: r => r.archived ? 'oui' : '' }
  ];

  function drawDossiers(view) {
    const all = K.dossierList(S, null, { withArchived: true });
    const rows = K.dossierList(S, null, {
      q: listState.q, withArchived: listState.withArchived, onlySkanfact: listState.onlySkanfact,
      sort: listState.sort, desc: listState.desc
    });
    const demoCount = (S.dossiers || []).filter(d => d.demo).length;
    const todo = K.cabinetTodo(S);
    const p = K.portfolio(S);

    // Écran d'ouverture d'un cabinet qui vient d'installer l'application : il n'a rien reçu, et il
    // n'a rien à chercher ni à filtrer. Trois propositions, trois VRAIS boutons — la première version
    // cachait l'exemple dans une phrase en gras au milieu d'un cadre, et personne ne le voyait.
    if (!all.length) {
      view.innerHTML = `
        <div class="page-head"><h1>Dossiers</h1></div>
        <div class="panel"><h2>Premiers pas</h2>
          <p>Ici apparaîtront tes clients, un par ligne, avec le dernier mois reçu et ce qui manque.</p>
          <div class="inline mt">
            <button class="btn btn-primary" id="new-d">Ajouter mes clients…</button>
            <button class="btn" id="imp">Importer un paquet…</button>
            <button class="btn" id="demo-on">Voir un exemple (5 clients fictifs)</button>
          </div>
          <p class="small muted mt"><strong>Commence par tes clients.</strong> Ajoute-les même s'ils n'utilisent pas encore SkanFact :
          l'application devient le tableau de bord de ton portefeuille, et rien ne leur est réclamé tant qu'ils n'ont pas commencé.</p>
          <p class="small muted">L'exemple montre les quatre situations que tu rencontreras : un client à jour,
          un en retard, un qui n'a envoyé que du provisoire, un dont les pièces sont incomplètes. Il s'efface
          tout seul au premier vrai paquet, et tu peux l'effacer à la main quand tu veux.</p>
        </div>
        <div class="panel"><h2>Comment un paquet arrive jusqu'ici</h2>
          <ol class="small" style="line-height:1.9;margin:0;padding-left:20px">
            <li>Tu remets à ton client le <strong>fichier d'appairage</strong> (Réglages → Enregistrer le fichier d'appairage).</li>
            <li>Il l'importe une fois dans son SkanFact, puis t'envoie son <strong>.skanpack</strong> chaque mois.</li>
            <li>Tu le <strong>glisses sur cette fenêtre</strong>, ou tu le double-cliques dans le Finder.</li>
          </ol>
        </div>`;
      $('#imp').onclick = () => doImport();
      $('#new-d').onclick = () => newDossierForm();
      $('#demo-on').onclick = async () => { S = await api.demo(true); render(); toast('Exemple chargé : ces cinq dossiers sont fictifs.'); };
      return;
    }

    const shown = paginate(rows);
    view.innerHTML = `
      <div class="page-head"><h1>Dossiers</h1>
        <div class="actions">
          <button class="btn" id="new-d">Nouveau client…</button>
          <button class="btn btn-primary" id="imp">Importer un paquet…</button>
        </div></div>
      ${portfolioPanel(p)}
      ${todoPanel(todo)}
      ${demoCount ? `<div class="banner"><span>Ces ${pl(demoCount, 'dossier')} sont <strong>fictifs</strong> : ils montrent les quatre situations
        que tu rencontreras. Ils disparaîtront au premier vrai paquet importé.</span>
        <button class="btn btn-ghost btn-sm nw" id="demo-off">Effacer l'exemple</button></div>` : ''}
      <div class="filters">
        <input type="text" id="q" placeholder="Chercher un client, un matricule, un téléphone…" value="${esc(listState.q)}">
        <label class="inline small muted"><input type="checkbox" id="arch" ${listState.withArchived ? 'checked' : ''}> Archivés</label>
        <label class="inline small muted"><input type="checkbox" id="onlysf" ${listState.onlySkanfact ? 'checked' : ''}> Sur SkanFact seulement</label>
        <span class="muted small">${rows.length} sur ${all.length}</span>
        ${rows.length !== all.length ? '<button class="btn btn-ghost btn-sm" id="reset-f">Réinitialiser</button>' : ''}
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" id="csv">Exporter en CSV</button>
      </div>
      ${rows.length ? `<div class="scroll-x"><table class="list">
        <thead><tr>${sortHead('Client', 'nom')}${sortHead('Dernier mois reçu', 'dernier')}
        <th class="r nw">Chiffre d'affaires</th>${sortHead('Mois manquants', 'manquants')}
        <th class="r nw">Provisoires</th><th class="r nw">Signalé</th>${sortHead('Relancé le', 'relance', 'r.history')}${sortHead('Reçu le', 'recu')}</tr></thead>
        <tbody>${shown.map(r => `<tr class="clickable" data-id="${esc(r.id)}">
          <td class="nw"><span class="dot-lvl ${r.level === 'ok' ? '' : esc(r.level)}"></span>${esc(r.name)}${r.archived ? ' <span class="badge">archivé</span>' : ''}${r.manual ? ' <span class="badge b-hors">pas encore sur SkanFact</span>' : ''}</td>
          <td class="nw">${esc(r.lastLabel || '—')}${r.lastMonth && !r.lastDefinitive ? ' <span class="badge partielle">provisoire</span>' : ''}</td>
          <td class="r nw">${esc(r.lastFigures ? money(r.lastFigures.ca, r.lastFigures.devise) : '—')}</td>
          <td class="r">${r.missingCount || '—'}</td>
          <td class="r">${r.provisionalCount || '—'}</td>
          <td class="r">${r.issues || '—'}</td>
          <td class="muted nw">${r.lastRelanceAt ? esc(fmtDay(r.lastRelanceAt)) + ` <span class="small">(${esc(ago(r.lastRelanceAt))})</span>` : '—'}</td>
          <td class="muted nw">${esc(fmtWhen(r.lastAt))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td class="nw"><strong>${pl(rows.length, 'dossier')}</strong></td><td></td>
          <td class="r nw"><strong>${esc(money(rows.reduce((s, r) => s + ((r.lastFigures && r.lastFigures.ca) || 0), 0)))}</strong></td>
          <td class="r"><strong>${rows.reduce((s, r) => s + r.missingCount, 0) || '—'}</strong></td>
          <td class="r"><strong>${rows.reduce((s, r) => s + r.provisionalCount, 0) || '—'}</strong></td>
          <td class="r"><strong>${rows.reduce((s, r) => s + r.issues, 0) || '—'}</strong></td><td></td><td></td></tr></tfoot>
        </table></div>${pagerBar(rows.length)}
        <p class="muted small mt">Les totaux et l'export portent sur la sélection entière, pas sur la page affichée.</p>`
        : `<div class="empty">Aucun dossier ne correspond à cette recherche.</div>`}`;

    $('#imp').onclick = () => doImport();
    $('#new-d').onclick = () => newDossierForm();
    const dOff = $('#demo-off');
    if (dOff) dOff.onclick = async () => { S = await api.demo(false); render(); toast('Exemple effacé.'); };
    const q = $('#q');
    q.oninput = () => {
      listState.q = q.value; listState.page = 1;
      const pos = q.selectionStart; render();
      const n = $('#q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
    };
    $('#arch').onchange = e => { listState.withArchived = e.target.checked; listState.page = 1; render(); };
    $('#onlysf').onchange = e => { listState.onlySkanfact = e.target.checked; listState.page = 1; render(); };
    const rf = $('#reset-f');
    if (rf) rf.onclick = () => { listState.q = ''; listState.withArchived = false; listState.onlySkanfact = false; listState.page = 1; render(); };
    $('#csv').onclick = async () => {
      try {
        const r = await api.exportCsv(toCsv(CSV_COLS, rows), 'dossiers-' + (S.cabinet.name || 'cabinet'));
        if (r) toast('Tableau enregistré.');
      } catch (e) { toast(plainError(e), 'error'); }
    };
    bindSort(view, render);
    bindPager(view, render);
    $$('tr[data-id]', view).forEach(tr => { tr.onclick = () => { location.hash = '#/dossier/' + encodeURIComponent(tr.dataset.id); }; });
  }

  // ---------- la fiche d'un dossier ----------
  function drawDossier(view, id) {
    const dossier = (S.dossiers || []).find(d => d.id === decodeURIComponent(id || ''));
    if (!dossier) { view.innerHTML = `<div class="empty">Ce dossier n'existe plus.</div>`; return; }
    const row = K.dossierRow(dossier);
    const months = K.dossierMonths(dossier).slice().reverse();
    const packs = (dossier.packs || []).slice().sort((a, b) => a.month < b.month ? 1 : -1);
    const relances = (dossier.relances || []).slice().reverse();
    // Les mois regroupés par année : douze cases par ligne valent mieux qu'une bande sans fin.
    const years = [...new Set(months.map(m => m.month.slice(0, 4)))];
    const totalCA = packs.reduce((s, p) => s + ((p.figures && p.figures.ca) || 0), 0);

    view.innerHTML = `
      <button class="btn btn-ghost btn-sm btn-back" id="back">← Dossiers</button>
      <div class="page-head"><div>
        <h1>${esc(dossier.name)}${dossier.archived ? ' <span class="badge">archivé</span>' : ''}${dossier.manual ? ' <span class="badge b-hors">pas encore sur SkanFact</span>' : ''}</h1>
        <div class="muted small">${esc(dossier.matricule || 'Matricule inconnu')}${dossier.contact ? ' · ' + esc(dossier.contact) : ''}</div>
      </div><div class="actions">
        <button class="btn" id="edit">Modifier la fiche</button>
        ${dossier.phone ? '<button class="btn" id="call">Appeler</button><button class="btn" id="wa">WhatsApp</button>' : ''}
        ${row.missingCount || row.provisionalCount ? '<button class="btn btn-primary" id="rel">Relancer</button>' : ''}
      </div></div>

      <div class="panel"><h2>La fiche</h2>
        <div class="kv two">
          <div><span>Email</span><span>${dossier.email ? esc(dossier.email) : '<span class="muted">— à renseigner</span>'}</span></div>
          <div><span>Téléphone</span><span>${dossier.phone ? esc(dossier.phone) : '<span class="muted">— à renseigner</span>'}</span></div>
          <div><span>Régime</span><span>${esc(labelOf(K.REGIMES, dossier.regime) || '—')}</span></div>
          <div><span>TVA</span><span>${esc(labelOf(K.TVA_PERIODS, dossier.tvaPeriod) || '—')}</span></div>
          <div><span>Début de mission</span><span>${dossier.from ? esc(K.monthLabel(dossier.from)) : '<span class="muted">au premier paquet reçu</span>'}</span></div>
          <div><span>Honoraires</span><span>${dossier.fees ? esc(money(dossier.fees)) + ' / mois' : '—'}</span></div>
        </div>
      </div>

      <div class="panel"><h2>Les mois de ce client ${info('p.definitif')}</h2>
        ${months.length ? years.map(y => `<div class="year-row"><div class="year-lab">${esc(y)}</div>
          <div class="mgrid">${months.filter(m => m.month.slice(0, 4) === y).map(m => `<div class="mcell ${m.state}${m.pack && m.pack.path ? ' clickable' : ''}" ${m.pack && m.pack.path ? `data-m="${esc(m.month)}"` : ''}>
            <div class="m-lab">${esc(m.label.split(' ')[0])}</div>
            <div class="m-st">${m.state === 'complet' ? 'définitif' : m.state === 'provisoire' ? 'provisoire' : 'manquant'}</div>
          </div>`).join('')}</div></div>`).join('')
          : `<span class="muted small">${dossier.manual
              ? 'Ce client n\'utilise pas encore SkanFact : rien ne lui est réclamé. Renseigne un « début de mission » dans sa fiche si tu veux commencer à attendre ses mois.'
              : 'Aucun mois attendu pour l\'instant : l\'attente démarre au premier paquet reçu, ou à la date de début de mission que tu renseignes dans la fiche.'}</span>`}
        ${months.length ? `<p class="muted small mt">Un mois <strong>provisoire</strong> n'a pas été clôturé chez le client : ses chiffres peuvent encore changer,
        ne déclare pas dessus. Le mois en cours n'est jamais réclamé.</p>` : ''}
      </div>

      <div class="panel"><h2>Paquets reçus ${info('p.integrity')}</h2>
      ${packs.length ? `<div class="scroll-x"><table class="list compact">
        <thead><tr><th class="nw">Mois</th><th>État</th><th class="r nw">Chiffre d'affaires</th><th class="r nw">TVA à décaisser</th>
        <th class="r">Pièces</th><th class="r">Signalé</th><th class="nw">Reçu le</th><th class="nw">Fabriqué le</th><th class="r">Taille</th><th></th></tr></thead>
        <tbody>${packs.map(p => `<tr>
          <td class="nw">${esc(p.label)}</td>
          <td>${p.definitive ? '<span class="badge accepté">définitif</span>' : '<span class="badge partielle">provisoire</span>'}</td>
          <td class="r nw">${esc(p.figures ? money(p.figures.ca, p.figures.devise) : '—')}</td>
          <td class="r nw">${esc(p.figures ? money(p.figures.tvaADecaisser, p.figures.devise) : '—')}</td>
          <td class="r">${p.files}</td>
          <td class="r">${(p.missing || []).reduce((s, m) => s + (m.count || 0), 0) || '—'}</td>
          <td class="muted nw">${esc(fmtWhen(p.receivedAt))}</td>
          <td class="muted nw">${esc(p.generatedAt ? fmtWhen(Date.parse(p.generatedAt)) : '—')}</td>
          <td class="r muted nw">${esc(fmtBytes(p.bytes))}</td>
          <td class="actions row-actions">${p.path
            ? `<button class="btn btn-ghost btn-sm" data-open="${esc(p.month)}">Ouvrir</button>
               <button class="btn btn-ghost btn-sm" data-xtr="${esc(p.month)}">Extraire…</button>
               <button class="btn btn-ghost btn-sm" data-rev="${esc(p.month)}">Fichier</button>
               <button class="btn btn-ghost btn-sm danger" data-del="${esc(p.month)}" title="Supprimer ce paquet">✕</button>`
            : '<span class="muted small">exemple</span>'}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td class="nw"><strong>${pl(packs.length, 'mois', 'mois')}</strong></td><td></td>
          <td class="r nw"><strong>${esc(money(totalCA))}</strong></td><td colspan="7"></td></tr></tfoot></table></div>
        <p class="muted small mt">« Extraire » écrit tout le contenu d'un paquet dans un dossier de ton choix ${info('p.extract')} — pour travailler dans ton logiciel, ou pour rendre ses pièces à un client.
        La croix supprime un paquet arrivé par erreur ${info('p.delete')}.</p>`
        : '<div class="empty">Aucun paquet reçu.</div>'}
      </div>

      <div class="panel"><h2>Relances ${info('r.history')}</h2>
      ${relances.length ? `<table class="list compact"><thead><tr><th class="nw">Date</th><th class="nw">Moyen</th><th>Mois réclamés</th><th>Note</th></tr></thead>
        <tbody>${relances.map(r => `<tr>
          <td class="nw">${esc(fmtWhen(r.at))} <span class="muted small">${esc(ago(r.at))}</span></td>
          <td class="nw">${esc(labelOf(K.RELANCE_WAYS, r.via) || r.via)}</td>
          <td>${esc((r.months || []).map(K.monthLabel).join(', ') || '—')}</td>
          <td class="muted">${esc(r.note || '')}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">Aucune relance enregistrée.</div>'}
        <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="note-rel">Noter une relance faite ailleurs…</button></div>
      </div>

      ${(dossier.note || '').trim() ? `<div class="panel"><h2>Note interne</h2><div class="notes-md">${esc(dossier.note)}</div></div>` : ''}`;

    $('#back').onclick = () => { location.hash = '#/dossiers'; };
    $('#edit').onclick = () => dossierForm(dossier);
    const call = $('#call'); if (call) call.onclick = () => api.tel({ number: dossier.phone }).catch(e => toast(plainError(e), 'error'));
    const wa = $('#wa'); if (wa) wa.onclick = () => {
      const m = K.relanceMail(S.cabinet, row);
      api.tel({ number: dossier.phone, whatsapp: true, text: m.body }).catch(e => toast(plainError(e), 'error'));
    };
    const rel = $('#rel'); if (rel) rel.onclick = () => writeRelance(row);
    $('#note-rel').onclick = () => noteRelanceForm(row);
    $$('[data-m]', view).forEach(c => { c.onclick = () => openPack(dossier, c.dataset.m); });
    $$('[data-open]', view).forEach(b => { b.onclick = () => openPack(dossier, b.dataset.open); });
    $$('[data-xtr]', view).forEach(b => { b.onclick = () => extractPack(dossier, b.dataset.xtr); });
    $$('[data-rev]', view).forEach(b => {
      b.onclick = () => { const p = packs.find(x => x.month === b.dataset.rev); if (p) api.reveal(p.path); };
    });
    $$('[data-del]', view).forEach(b => {
      b.onclick = async () => {
        const p = packs.find(x => x.month === b.dataset.del);
        if (!p) return;
        const ok = await confirmDialog('Supprimer ce paquet ?',
          `<p>Le paquet <strong>${esc(p.label)}</strong> de ${esc(dossier.name)} sera effacé de ton disque, et ce mois redeviendra « manquant » pour ce client.</p>
           <p class="muted small">Une sauvegarde est prise juste avant. À réserver à un paquet arrivé par erreur.</p>`, 'Supprimer', true);
        if (!ok) return;
        try { S = await api.deletePack(dossier.id, p.month); render(); toast('Paquet supprimé.'); refreshBackupInfo(); }
        catch (e) { toast(plainError(e), 'error'); }
      };
    });
  }

  const labelOf = (list, id) => { const x = (list || []).find(o => o.id === id); return x ? x.label : ''; };

  // Ouvrir un paquet : on montre ce qu'il contient, on n'extrait que ce qui est demandé.
  async function openPack(dossier, month) {
    const p = (dossier.packs || []).find(x => x.month === month);
    if (!p || !p.path) return;
    let files, password = null;
    try { files = await api.listPack(p.path); }
    catch (e) {
      const msg = plainError(e);
      if (/ENOENT|introuvable|no such file/i.test(msg)) {
        return toast('Le fichier de ce paquet est introuvable sur le disque. Restaure une sauvegarde, ou demande-le à nouveau à ton client.', 'error');
      }
      if (!/mot de passe|déchiffr|authenticate/i.test(msg)) return toast(msg, 'error');
      password = await askPassword('Paquet protégé', 'Ce paquet est scellé par un mot de passe.');
      if (!password) return;
      try { files = await api.listPack(p.path, password); }
      catch (e2) { return toast(plainError(e2), 'error'); }
    }
    const order = f => (f.name === '00-page-de-garde.pdf' ? 0 : f.name.startsWith('journaux/') ? 1 : f.name === 'manifeste.json' ? 9 : 5);
    files.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'fr'));
    modal(
      `<h2>${esc(dossier.name)} — ${esc(p.label)}</h2>
       <p class="muted small">${pl(files.length, 'fichier')}. Commence par la page de garde : elle résume le mois et liste ce qui manque.</p>
       <table class="list compact mt"><tbody>${files.map((f, i) => `<tr class="clickable" data-i="${i}">
         <td>${esc(f.name)}</td><td class="r muted nw">${esc(fmtBytes(f.size))}</td></tr>`).join('')}</tbody></table>
       <div class="modal-actions"><button class="btn" id="xtr">Tout extraire…</button><button class="btn btn-primary" id="ok">Fermer</button></div>`,
      (layer, close) => {
        $('#ok', layer).onclick = close;
        $('#xtr', layer).onclick = () => { close(); extractPack(dossier, month, password); };
        $$('tr[data-i]', layer).forEach(tr => {
          tr.onclick = async () => {
            try { await api.openInPack(p.path, files[Number(tr.dataset.i)].name, password); }
            catch (e) { toast(plainError(e), 'error'); }
          };
        });
      }
    );
  }

  async function extractPack(dossier, month, password) {
    const p = (dossier.packs || []).find(x => x.month === month);
    if (!p || !p.path) return;
    try {
      const r = await api.extractPack(p.path, password, `${dossier.name}-${month}`);
      if (!r) return;
      toast(`${pl(r.files, 'fichier')} extrait${r.files > 1 ? 's' : ''}.`);
      api.reveal(r.dir);
    } catch (e) { toast(plainError(e), 'error'); }
  }

  // ---------- les formulaires de dossier ----------
  function dossierFields(d) {
    return `<div class="grid-2">
        <label class="field span-2">${lbl('Nom du client', 'd.name')}<input type="text" id="f-name" value="${esc(d.name || '')}"></label>
        <label class="field span-2">${lbl('Matricule fiscal', 'd.matricule')}<input type="text" id="f-mat" value="${esc(d.matricule || '')}" placeholder="1234567X/A/M/000" ${d.packs && d.packs.length ? 'readonly' : ''}></label>
        <label class="field">${lbl('Email', 'd.email')}<input type="email" id="f-email" value="${esc(d.email || '')}" placeholder="Pour les relances"></label>
        <label class="field">${lbl('Téléphone', 'd.phone')}<input type="tel" id="f-phone" value="${esc(d.phone || '')}" placeholder="+216 …"></label>
        <label class="field span-2">${lbl('Interlocuteur', 'd.contact')}<input type="text" id="f-contact" value="${esc(d.contact || '')}" placeholder="La personne que tu appelles"></label>
        <label class="field">${lbl('Régime fiscal', 'd.regime')}<select id="f-regime">
          <option value="">— non précisé —</option>${K.REGIMES.map(r => `<option value="${esc(r.id)}" ${d.regime === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select></label>
        <label class="field">${lbl('TVA', 'd.tvaPeriod')}<select id="f-tva">
          <option value="">— non précisé —</option>${K.TVA_PERIODS.map(r => `<option value="${esc(r.id)}" ${d.tvaPeriod === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select></label>
        <label class="field">${lbl('Début de mission', 'd.from')}<input type="text" id="f-from" value="${esc(d.from || '')}" placeholder="2026-01" pattern="\\d{4}-\\d{2}"></label>
        <label class="field">${lbl('Honoraires mensuels', 'd.fees')}<input type="number" id="f-fees" value="${d.fees || ''}" step="0.001" min="0" placeholder="0"></label>
      </div>
      <label class="field mt">${lbl('Note interne', 'd.note')}<textarea id="f-note" rows="3">${esc(d.note || '')}</textarea></label>`;
  }

  function readDossierFields(layer) {
    const from = $('#f-from', layer).value.trim();
    return {
      name: $('#f-name', layer).value.trim(),
      matricule: $('#f-mat', layer).value.trim(),
      email: $('#f-email', layer).value.trim(),
      phone: $('#f-phone', layer).value.trim(),
      contact: $('#f-contact', layer).value.trim(),
      regime: $('#f-regime', layer).value,
      tvaPeriod: $('#f-tva', layer).value,
      from: /^\d{4}-\d{2}$/.test(from) ? from : '',
      fees: Number($('#f-fees', layer).value) || 0,
      note: $('#f-note', layer).value
    };
  }

  function newDossierForm() {
    const empty = { packs: [] };
    modal(
      `<h2>Nouveau dossier client</h2>
       <p class="muted small">Ajoute un client même s'il n'utilise pas encore SkanFact ${info('d.manual')} : il compte dans ton portefeuille,
       et rien ne lui est réclamé tant qu'il n'a pas commencé.</p>
       ${dossierFields(empty)}
       <div class="modal-actions"><button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Créer le dossier</button></div>`,
      (layer, close) => {
        $('#no', layer).onclick = close;
        $('#ok', layer).onclick = async () => {
          const f = readDossierFields(layer);
          if (!f.name) return toast('Donne au moins un nom à ce client.', 'error');
          try {
            const r = await api.newDossier(f);
            S = r.state; close(); render(); toast('Dossier créé.');
            location.hash = '#/dossier/' + encodeURIComponent(r.id);
          } catch (e) { toast(plainError(e), 'error'); }
        };
      }
    );
  }

  function dossierForm(dossier) {
    modal(
      `<h2>Fiche du dossier</h2>
       ${dossierFields(dossier)}
       <label class="inline small mt"><input type="checkbox" id="f-arch" ${dossier.archived ? 'checked' : ''}> ${lbl('Dossier archivé (client parti : on ne le réclame plus)', 'd.archived')}</label>
       ${dossier.packs && dossier.packs.length
         ? `<p class="muted small mt">Le matricule vient des paquets de ce client : c'est lui qui identifie le dossier, il ne se modifie plus ici.</p>`
         : ''}
       <div class="modal-actions">
         <button class="btn btn-danger" id="del">Supprimer…</button>
         <span class="grow"></span>
         <button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (layer, close) => {
        $('#no', layer).onclick = close;
        $('#del', layer).onclick = async () => {
          const n = (dossier.packs || []).length;
          const ok = await confirmTyped('Supprimer ce dossier ?',
            `<p>Le dossier <strong>${esc(dossier.name)}</strong> et ${n ? `ses ${pl(n, 'paquet')}` : 'son historique'} seront <strong>effacés de ce poste</strong>.
             ${n ? 'Les pièces comptables que ce client t\'a envoyées seront supprimées du disque.' : ''}</p>
             <p class="muted small">Une sauvegarde est prise juste avant. Si le client est simplement parti, préfère <strong>l'archivage</strong> : il disparaît des listes sans rien perdre.</p>`,
            'SUPPRIMER');
          if (!ok) return;
          try {
            S = await api.deleteDossier(dossier.id);
            close(); location.hash = '#/dossiers'; render(); toast('Dossier supprimé.'); refreshBackupInfo();
          } catch (e) { toast(plainError(e), 'error'); }
        };
        $('#ok', layer).onclick = async () => {
          const f = readDossierFields(layer);
          if (!f.name) return toast('Le nom ne peut pas être vide.', 'error');
          const fromRaw = $('#f-from', layer).value.trim();
          if (fromRaw && !/^\d{4}-\d{2}$/.test(fromRaw)) return toast('Le début de mission s\'écrit comme 2026-01.', 'error');
          try {
            const patch = { ...f, archived: $('#f-arch', layer).checked };
            if (dossier.packs && dossier.packs.length) delete patch.matricule;  // il vient des paquets
            const r = await api.saveDossier(dossier.id, patch);
            S = r.state;
            close(); render();
            toast(r.moved ? `Fiche enregistrée · ${pl(r.moved, 'paquet')} rangé${r.moved > 1 ? 's' : ''} au nouveau nom.` : 'Fiche enregistrée.');
          } catch (e) { toast(plainError(e), 'error'); }
        };
      }
    );
  }

  // ---------- relances ----------
  function drawRelances(view) {
    const rows = K.relanceRows(S);
    const rel = K.relanceDue(S);
    view.innerHTML = `
      <div class="page-head"><h1>Relances</h1>
        ${rows.length > 1 ? `<div class="actions"><button class="btn btn-primary" id="group">Relancer tout le monde ${info('r.group')}</button></div>` : ''}</div>
      <p class="muted small mb">Un message qui nomme les mois manquants fait bouger ; « envoie-moi tes documents » non.
      SkanFact prépare le texte, ton logiciel de messagerie l'envoie — et la relance est enregistrée pour que tu saches, lundi, qui tu as déjà relancé.</p>
      ${rel.due && rel.count ? `<div class="banner"><span>On est le <strong>${rel.jour}</strong> : tu as fixé le ${rel.day} du mois comme jour de relance.
        ${pl(rel.count, 'dossier')} ${rel.count > 1 ? 'n\'ont' : 'n\'a'} pas tout envoyé.</span></div>` : ''}
      ${rows.length ? `<div class="scroll-x"><table class="list">
        <thead><tr><th class="nw">Client</th><th class="nw">Contact</th><th class="nw">Ce qui manque</th><th class="nw">Dernière relance</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td class="nw"><span class="dot-lvl ${r.level === 'ok' ? '' : esc(r.level)}"></span>${esc(r.name)}</td>
          <td class="muted nw">${esc(r.email || r.phone || '— à renseigner')}</td>
          <td>${r.missingCount
            ? esc(K.missingLabel(r.missingMonths))
            : `<span class="muted">${pl(r.provisionalCount, 'mois', 'mois')} non clôturé${r.provisionalCount > 1 ? 's' : ''}</span>`}</td>
          <td class="muted nw">${r.lastRelanceAt ? esc(fmtDay(r.lastRelanceAt)) + ` <span class="small">(${esc(ago(r.lastRelanceAt))}, ${esc(labelOf(K.RELANCE_WAYS, r.lastRelanceVia) || r.lastRelanceVia)})</span>` : 'jamais'}</td>
          <td class="actions row-actions"><button class="btn btn-ghost btn-sm" data-fiche="${esc(r.id)}">Le dossier</button>
            ${r.phone ? `<button class="btn btn-ghost btn-sm" data-tel="${esc(r.id)}">Appeler</button>` : ''}
            <button class="btn btn-primary btn-sm" data-rel="${esc(r.id)}">Écrire</button></td></tr>`).join('')}</tbody></table></div>`
        : `<div class="todo-ok">Personne à relancer : tous tes dossiers sont à jour.</div>`}`;
    const findRow = id => K.dossierList(S).find(x => x.id === id);
    $$('[data-rel]', view).forEach(b => { b.onclick = () => { const r = findRow(b.dataset.rel); if (r) writeRelance(r); }; });
    $$('[data-tel]', view).forEach(b => {
      b.onclick = async () => {
        const r = findRow(b.dataset.tel); if (!r) return;
        try { await api.tel({ number: r.phone }); await recordRelance(r, 'tel'); render(); }
        catch (e) { toast(plainError(e), 'error'); }
      };
    });
    $$('[data-fiche]', view).forEach(b => { b.onclick = () => { location.hash = '#/dossier/' + encodeURIComponent(b.dataset.fiche); }; });
    const g = $('#group'); if (g) g.onclick = () => groupRelance(rows.slice());
  }

  async function recordRelance(row, via, note) {
    try { S = await api.noteRelance(row.id, row.missingMonths || [], via, note || ''); }
    catch (e) { toast(plainError(e), 'error'); }
  }

  function writeRelance(row, onDone) {
    const m = K.relanceMail(S.cabinet, row);
    modal(
      `<h2>Relancer ${esc(row.name)}</h2>
       <label class="field">Destinataire<input type="text" id="r-to" value="${esc(m.to)}" placeholder="adresse@client.tn"></label>
       <label class="field mt">Objet<input type="text" id="r-sub" value="${esc(m.subject)}"></label>
       <label class="field mt">Message<textarea id="r-body" rows="10">${esc(m.body)}</textarea></label>
       <p class="muted small mt">Le message s'ouvre dans ton logiciel de messagerie : rien ne part sans que tu cliques sur « Envoyer ».
       La relance est enregistrée dans la fiche du client dès que tu l'ouvres.</p>
       <div class="modal-actions"><button class="btn" id="no">${onDone ? 'Passer' : 'Annuler'}</button>
       <button class="btn" id="copy">Copier</button>
       ${row.phone ? '<button class="btn" id="wa">WhatsApp</button>' : ''}
       <button class="btn btn-primary" id="ok">Ouvrir dans ma messagerie</button></div>`,
      (layer, close) => {
        $('#no', layer).onclick = () => { close(); if (onDone) onDone(); };
        $('#copy', layer).onclick = async () => {
          try { await navigator.clipboard.writeText($('#r-body', layer).value); toast('Texte copié.'); }
          catch { toast('Copie impossible.', 'error'); }
        };
        const wa = $('#wa', layer);
        if (wa) wa.onclick = async () => {
          try {
            await api.tel({ number: row.phone, whatsapp: true, text: $('#r-body', layer).value });
            await recordRelance(row, 'whatsapp');
            close(); render(); if (onDone) onDone();
          } catch (e) { toast(plainError(e), 'error'); }
        };
        $('#ok', layer).onclick = async () => {
          const to = $('#r-to', layer).value.trim();
          if (to && to !== row.email) { try { await api.saveDossier(row.id, { email: to }); } catch {} }
          await api.mail({ to, subject: $('#r-sub', layer).value, body: $('#r-body', layer).value });
          await recordRelance(row, 'email');
          close(); render(); if (onDone) onDone();
        };
      },
      () => { if (onDone) onDone(); }
    );
  }

  // Douze retardataires ne doivent pas coûter douze allers-retours dans la liste.
  function groupRelance(rows) {
    const next = () => {
      const r = rows.shift();
      if (!r) { render(); return toast('Tournée de relances terminée.'); }
      const fresh = K.dossierList(S).find(x => x.id === r.id) || r;
      writeRelance(fresh, next);
    };
    next();
  }

  function noteRelanceForm(row) {
    modal(
      `<h2>Noter une relance</h2>
       <p class="muted small">Tu l'as appelé, croisé, ou relancé depuis ton téléphone : garde-en la trace ici.</p>
       <label class="field">${lbl('Moyen', 'r.via')}<select id="n-via">${K.RELANCE_WAYS.map(w => `<option value="${esc(w.id)}">${esc(w.label)}</option>`).join('')}</select></label>
       <label class="field mt">Note<input type="text" id="n-note" placeholder="« promet d'envoyer avant vendredi »"></label>
       <div class="modal-actions"><button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (layer, close) => {
        $('#no', layer).onclick = close;
        $('#ok', layer).onclick = async () => {
          await recordRelance(row, $('#n-via', layer).value, $('#n-note', layer).value.trim());
          close(); render(); toast('Relance enregistrée.');
        };
      }
    );
  }

  // ---------- le calendrier des échéances ----------
  //
  // Une liste de dates, un comptable en a déjà une. Ce que personne d'autre ne fait pour lui :
  // rattacher chaque échéance aux paquets qu'il n'a PAS reçus.
  function drawEcheances(view) {
    const liste = K.echeances(S);
    const prochaines = liste.filter(e => !e.passee);
    const passees = liste.filter(e => e.passee).reverse();

    if (!liste.length) {
      view.innerHTML = `<div class="page-head"><h1>Échéances</h1></div>
        <div class="panel"><h2>Aucun client pour l'instant</h2>
          <p>Le calendrier se remplit tout seul à partir de tes dossiers et de la périodicité de TVA que tu leur donnes.</p>
          <div class="modal-actions"><button class="btn btn-primary" id="nd">Ajouter mes clients…</button></div></div>`;
      $('#nd').onclick = () => newDossierForm();
      return;
    }

    const carte = e => `<div class="ech lvl-${e.level}">
      <div class="ech-date"><div class="ech-j">${esc(e.date.slice(8))}</div><div class="ech-m">${esc(K.monthLabel(e.date.slice(0, 7)).split(' ')[0])}</div></div>
      <div class="ech-txt">
        <div class="ech-lab">${esc(e.label)}<span class="ech-when">${e.passee ? `il y a ${-e.jours} j` : e.jours === 0 ? "aujourd'hui" : `dans ${e.jours} j`}</span></div>
        <div class="small muted">${esc(e.detail)}</div>
        <div class="ech-bar">
          <span class="ok-inline">${e.prets} prêt${e.prets > 1 ? 's' : ''}</span>
          ${e.provisoires.length ? `<span class="warn-inline">${e.provisoires.length} en provisoire</span>` : ''}
          ${e.manquants.length ? `<span class="err-inline">${e.manquants.length} sans ${e.mois.length > 1 ? 'les mois' : 'le mois'}</span>` : ''}
          <span class="muted small">sur ${pl(e.clients, 'client')}</span>
        </div>
        ${e.manquants.length ? `<div class="small mt">${esc(e.manquants.slice(0, 8).join(', '))}${e.manquants.length > 8 ? '…' : ''}
          <a href="#/relances">Les relancer</a></div>` : ''}
      </div></div>`;

    view.innerHTML = `
      <div class="page-head"><h1>Échéances</h1></div>
      <p class="muted small mb">Chaque échéance est rattachée aux <strong>paquets que tu n'as pas reçus</strong> : c'est la seule chose
      qu'un calendrier papier ne peut pas te dire. ${info('ec.dates')}</p>
      <div class="warn-box mb"><strong>À VÉRIFIER avec l'usage de ton cabinet.</strong> Les jours proposés suivent la pratique courante en Tunisie
      (TVA le ${K.deadlineSettings(S).tvaDay}, CNSS le ${K.deadlineSettings(S).cnssDay} du mois suivant) mais dépendent de la forme juridique,
      du régime et de la loi de finances. Tu les règles dans <a href="#/reglages">Réglages</a>.</div>

      <div class="panel"><h2>À venir</h2>
        ${prochaines.length ? `<div class="ech-list">${prochaines.map(carte).join('')}</div>`
          : '<div class="empty">Rien dans les trois prochains mois.</div>'}</div>

      ${passees.length ? `<div class="panel"><h2>Déjà passées</h2>
        <p class="small muted">SkanFact ne sait pas ce que tu as déposé : cette liste est là pour repérer un mois qu'on n'a jamais pu déclarer
        faute de pièces. ${info('ec.passees')}</p>
        <div class="ech-list">${passees.slice(0, 8).map(carte).join('')}</div></div>` : ''}`;
  }

  // ---------- écritures regroupées ----------
  //
  // Chaque paquet porte déjà ses écritures en partie double. Mais rien ne les rassemblait : pour
  // importer un mois dans son logiciel de production, le comptable devait ouvrir soixante paquets
  // un par un — exactement le travail qu'on prétend lui épargner.
  const ecrState = { from: '', to: '', ids: null };

  function moisDisponibles() {
    const s = new Set();
    (S.dossiers || []).forEach(d => (d.packs || []).forEach(p => { if (p.path) s.add(p.month); }));
    return [...s].sort();
  }

  function drawEcritures(view) {
    const mois = moisDisponibles();
    if (!mois.length) {
      view.innerHTML = `<div class="page-head"><h1>Écritures</h1></div>
        <div class="panel"><h2>Rien à regrouper pour l'instant</h2>
          <p>Dès qu'un client t'aura envoyé un paquet, tu pourras sortir d'ici <strong>toutes les écritures du mois,
          tous clients confondus</strong>, dans un seul fichier à importer dans ton logiciel.</p>
          <p class="small muted">Chaque paquet contient déjà ses écritures en partie double : cette page les rassemble,
          en ajoutant le nom du client et le mois devant chaque ligne.</p>
          <div class="modal-actions"><button class="btn btn-primary" id="imp">Importer un paquet…</button></div></div>`;
      $('#imp').onclick = () => doImport();
      return;
    }
    if (!ecrState.from || !mois.includes(ecrState.from)) ecrState.from = mois[mois.length - 1];
    if (!ecrState.to || ecrState.to < ecrState.from) ecrState.to = ecrState.from;
    const plan = K.ecrituresPlan(S, { from: ecrState.from, to: ecrState.to, ids: ecrState.ids });
    const opts = m => mois.map(x => `<option value="${esc(x)}" ${m === x ? 'selected' : ''}>${esc(K.monthLabel(x))}</option>`).join('');

    view.innerHTML = `
      <div class="page-head"><h1>Écritures</h1></div>
      <p class="muted small mb">Un seul fichier CSV, toutes les écritures de la période, avec le client et le mois devant chaque ligne —
      à importer dans ton logiciel au lieu de ressaisir. ${info('e.import')}</p>

      <div class="panel"><h2>La période ${info('e.periode')}</h2>
        <div class="filters">
          <label class="inline small">Du <select id="e-from">${opts(ecrState.from)}</select></label>
          <label class="inline small">au <select id="e-to">${opts(ecrState.to)}</select></label>
          <button class="btn btn-ghost btn-sm" id="e-last">Le dernier mois</button>
          <button class="btn btn-ghost btn-sm" id="e-year">Toute l'année ${esc(ecrState.to.slice(0, 4))}</button>
        </div>
        <div class="stats mt">
          <div class="stat"><div class="lbl">Paquets</div><div class="val">${plan.packs.length}</div>
            <div class="sub">${plan.mois.length ? pl(plan.mois.length, 'mois', 'mois') : 'aucun'}</div></div>
          <div class="stat"><div class="lbl">Clients</div><div class="val">${new Set(plan.packs.map(p => p.id)).size}</div>
            <div class="sub">${plan.sansPaquet.length ? pl(plan.sansPaquet.length, 'sans rien envoyé') : 'tous ont envoyé'}</div></div>
          <div class="stat"><div class="lbl">Provisoires</div><div class="val ${plan.provisoires.length ? 'due' : 'ok'}">${plan.provisoires.length}</div>
            <div class="sub">${plan.provisoires.length ? 'chiffres susceptibles de bouger' : 'tout est définitif'}</div></div>
          <div class="stat"><div class="lbl">Période</div><div class="val" style="font-size:16px">${esc(plan.mois.length ? (plan.mois.length > 1 ? K.monthLabel(plan.mois[0]) + ' → ' + K.monthLabel(plan.mois[plan.mois.length - 1]) : K.monthLabel(plan.mois[0])) : '—')}</div></div>
        </div>

        ${plan.provisoires.length ? `<div class="warn-box mt">${info('e.provisoire')} <strong>${pl(plan.provisoires.length, 'paquet')} ${plan.provisoires.length > 1 ? 'ne sont' : 'n\'est'} pas définitif${plan.provisoires.length > 1 ? 's' : ''}</strong> :
          ${esc(plan.provisoires.slice(0, 6).join(' · '))}${plan.provisoires.length > 6 ? ' …' : ''}.
          Leur mois n'a pas été clôturé chez le client : les chiffres peuvent encore changer. Ils sont quand même exportés.</div>` : ''}
        ${plan.sansPaquet.length ? `<p class="small mt">${info('e.manquants')} <span class="err-inline">${pl(plan.sansPaquet.length, 'client')} n'${plan.sansPaquet.length > 1 ? 'ont' : 'a'} rien envoyé sur cette période</span> :
          ${esc(plan.sansPaquet.slice(0, 8).join(', '))}${plan.sansPaquet.length > 8 ? '…' : ''}. <a href="#/relances">Les relancer</a></p>` : ''}

        <div class="modal-actions">
          <button class="btn btn-primary" id="e-go" ${plan.packs.length ? '' : 'disabled'}>Exporter les écritures…</button>
          <span class="muted small">${plan.packs.length ? 'Un seul fichier, prêt pour ton logiciel.' : 'Aucun paquet sur cette période.'}</span>
        </div>
      </div>

      ${plan.packs.length ? `<div class="panel"><h2>Ce qui sera lu</h2>
        <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Mois</th><th>Client</th><th class="nw">Matricule</th><th>État</th></tr></thead>
        <tbody>${plan.packs.map(p => `<tr>
          <td class="nw">${esc(K.monthLabel(p.month))}</td><td>${esc(p.name)}</td>
          <td class="muted nw">${esc(p.matricule || '—')}</td>
          <td>${p.definitive ? '<span class="badge accepté">définitif</span>' : '<span class="badge partielle">provisoire</span>'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;

    $('#e-from').onchange = e => { ecrState.from = e.target.value; if (ecrState.to < ecrState.from) ecrState.to = ecrState.from; render(); };
    $('#e-to').onchange = e => { ecrState.to = e.target.value; if (ecrState.to < ecrState.from) ecrState.from = ecrState.to; render(); };
    $('#e-last').onclick = () => { ecrState.from = ecrState.to = mois[mois.length - 1]; render(); };
    $('#e-year').onclick = () => {
      const an = ecrState.to.slice(0, 4);
      const dedans = mois.filter(m => m.slice(0, 4) === an);
      if (dedans.length) { ecrState.from = dedans[0]; ecrState.to = dedans[dedans.length - 1]; render(); }
    };
    $('#e-go').onclick = async () => {
      const b = $('#e-go'); b.disabled = true; b.textContent = 'Lecture des paquets…';
      try {
        const r = await api.exportEcritures({ from: ecrState.from, to: ecrState.to, ids: ecrState.ids });
        if (r) showEcrituresReport(r);
      } catch (e) { toast(plainError(e), 'error'); }
      b.disabled = false; b.textContent = 'Exporter les écritures…';
    };
  }

  function showEcrituresReport(r) {
    modal(
      `<h2>${pl(r.lignes, 'écriture')} regroupée${r.lignes > 1 ? 's' : ''}</h2>
       <div class="kv mt">
         <div><span>Clients</span><span>${r.dossiers}</span></div>
         <div><span>Mois</span><span>${esc(r.mois.map(K.monthLabel).join(', '))}</span></div>
         <div><span>Fichier</span><span class="path">${esc(r.path)}</span></div>
       </div>
       ${r.illisibles && r.illisibles.length ? `<div class="warn-box mt"><strong>${pl(r.illisibles.length, 'paquet')} n'${r.illisibles.length > 1 ? 'ont' : 'a'} pas pu être lu${r.illisibles.length > 1 ? 's' : ''}</strong> :
         <ul class="small" style="margin:6px 0 0;padding-left:18px">${r.illisibles.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
         <div class="small mt">Le fichier a quand même été écrit avec le reste : mieux vaut 95 % avec le trou signalé qu'un export qui échoue.</div></div>` : ''}
       ${r.vides && r.vides.length ? `<p class="small muted mt">${pl(r.vides.length, 'paquet')} sans aucune écriture (mois sans activité) : ${esc(r.vides.slice(0, 5).join(', '))}.</p>` : ''}
       <p class="muted small mt">Les colonnes sont celles de tes clients, avec <strong>Client</strong>, <strong>Matricule</strong> et <strong>Mois</strong> ajoutées devant.
       Si les numéros de compte ne sont pas les tiens, donne-les une fois à ton client : il les saisit dans son SkanFact et tous ses envois suivants sont à ton format.</p>
       <div class="modal-actions"><button class="btn" id="rev">Montrer dans le dossier</button><span class="grow"></span><button class="btn btn-primary" id="ok">Fermer</button></div>`,
      (layer, close) => {
        $('#ok', layer).onclick = close;
        $('#rev', layer).onclick = () => api.reveal(r.path);
      }
    );
  }

  // ---------- réglages ----------
  function drawReglages(view) {
    const c = S.cabinet || {};
    view.innerHTML = `
      <div class="page-head"><h1>Réglages</h1></div>
      <div class="panel"><h2>Ton cabinet</h2>
        <div class="grid-2">
          <label class="field span-2">${lbl('Nom du cabinet', 'cab.name')}<input type="text" id="c-name" value="${esc(c.name)}" placeholder="Cabinet Ben Salah"></label>
          <label class="field">${lbl('Email', 'cab.email')}<input type="email" id="c-email" value="${esc(c.email)}" placeholder="contact@cabinet.tn"></label>
          <label class="field">${lbl('Téléphone', 'cab.phone')}<input type="tel" id="c-phone" value="${esc(c.phone || '')}" placeholder="+216 …"></label>
          <label class="field narrow">${lbl('Jour de relance', 'cab.relanceDay')}<input type="number" id="c-day" min="1" max="28" value="${Number((S.settings || {}).relanceDay) || 10}"></label>
          <label class="field narrow">${lbl('TVA : jour de dépôt', 'ec.jours')}<input type="number" id="c-tvaday" min="1" max="31" value="${K.deadlineSettings(S).tvaDay}"></label>
          <label class="field narrow">CNSS : jour de dépôt<input type="number" id="c-cnssday" min="1" max="31" value="${K.deadlineSettings(S).cnssDay}"></label>
        </div>
        <p class="muted small">Les jours de dépôt alimentent la page <a href="#/echeances">Échéances</a>.
        <strong>À VÉRIFIER</strong> : ils dépendent de la forme juridique, du régime et de la loi de finances.</p>
        <p class="muted small mt">Ce nom apparaît en bas des relances que tu envoies et dans le fichier d'appairage remis à tes clients.</p>
        <div class="modal-actions"><span class="saved" id="c-saved" hidden></span><button class="btn btn-primary" id="c-save">Enregistrer</button></div>
      </div>

      <div class="panel"><h2>Le fichier à remettre à tes clients ${info('cab.pairing')}</h2>
        <p class="small">Chaque client doit importer ce fichier une fois, dans <strong>Paramètres → Cabinet comptable</strong> de son SkanFact.
        À partir de là, les paquets qu'il fabrique sont chiffrés <strong>pour toi seul</strong> : personne d'autre ne peut les ouvrir,
        même en interceptant le mail, et il n'a plus aucun mot de passe à te communiquer.</p>
        <div class="mt"><div class="muted small">${lbl('Empreinte de ton cabinet', 'cab.fingerprint')}</div>
          <div class="fingerprint">${esc(c.fingerprint || '—')}</div></div>
        <p class="muted small mt">Cette empreinte identifie ton cabinet. Ton client la voit après l'import : s'il te la lit au téléphone
        et qu'elle correspond, c'est bien à toi qu'il envoie.</p>
        <div class="modal-actions"><button class="btn btn-primary" id="c-pair">Enregistrer le fichier d'appairage…</button></div>
      </div>

      <div class="panel" id="pan-backup"><h2>Sauvegardes</h2><p class="muted small">Chargement…</p></div>
      <div class="panel" id="pan-secu"><h2>Sécurité</h2><p class="muted small">Chargement…</p></div>

      <div class="panel"><h2>Mises à jour</h2><div id="upd-panel"><p class="muted small">Chargement…</p></div></div>

      <div class="panel"><h2>Exemple</h2>
        ${(S.dossiers || []).some(d => d.demo)
          ? `<p>Cinq dossiers <strong>fictifs</strong> sont chargés : ils montrent les quatre situations que tu rencontreras.
             Ils disparaîtront d'eux-mêmes au premier vrai paquet importé.</p>
             <div class="modal-actions"><button class="btn btn-danger" id="r-demo-off">Effacer l'exemple</button></div>`
          : `<p>Tu peux charger cinq clients fictifs pour voir à quoi ressemble l'application pleine : un client à jour,
             un en retard, un qui n'a envoyé que du provisoire, un dont les pièces sont incomplètes.</p>
             <p class="small muted">C'est aussi ce qu'il faut montrer à un confrère à qui tu parles de SkanFact.
             L'exemple s'efface tout seul dès qu'un vrai paquet arrive : aucun risque de mélange.</p>
             <div class="modal-actions"><button class="btn btn-primary" id="r-demo-on">Charger l'exemple</button></div>`}
      </div>`;
    drawUpdatePanel();
    drawBackupPanels();
    if ($('#r-demo-on')) $('#r-demo-on').onclick = async () => {
      S = await api.demo(true); toast('Exemple chargé : ces cinq dossiers sont fictifs.'); location.hash = '#/dossiers';
    };
    if ($('#r-demo-off')) $('#r-demo-off').onclick = async () => { S = await api.demo(false); render(); toast('Exemple effacé.'); };
    $('#c-save').onclick = async () => {
      try {
        S = await api.saveCabinet({
          name: $('#c-name').value.trim(), email: $('#c-email').value.trim(), phone: $('#c-phone').value.trim(),
          settings: {
            relanceDay: Number($('#c-day').value),
            deadlines: { tvaDay: Number($('#c-tvaday').value), cnssDay: Number($('#c-cnssday').value) }
          }
        });
        $('#brand-cab').textContent = S.cabinet.name || 'Cabinet';
        flash($('#c-saved'));
      } catch (e) { toast(plainError(e), 'error'); }
    };
    $('#c-pair').onclick = async () => {
      if (!(S.cabinet.name || '').trim()) return toast('Renseigne d\'abord le nom de ton cabinet.', 'error');
      try {
        const r = await api.exportPairing();
        if (r) {
          const ok = await confirmDialog('Fichier d\'appairage créé',
            `<p>Envoie ce fichier à tes clients (par mail, il ne contient rien de secret).</p>
             <p class="muted small">${esc(r.path)}</p>`, 'Le montrer dans le dossier');
          if (ok) api.reveal(r.path);
        }
      } catch (e) { toast(plainError(e), 'error'); }
    };
  }

  // ---------- les filets : sauvegardes et sécurité ----------
  function drawBackupPanels() {
    const b = $('#pan-backup'), s = $('#pan-secu');
    if (!b || !s) return;
    const inf = backupInfo || { list: [], external: {}, packs: {}, dir: '' };
    const ext = inf.external || {};
    const list = inf.list || [];

    b.innerHTML = `<h2>Sauvegardes ${info('b.daily')}</h2>
      <p class="small">Chaque jour, avant la première modification, SkanFact met de côté ton fichier tel qu'il était ce matin-là.
      Une sauvegarde est prise aussi avant chaque import et avant chaque suppression. Trente jours sont conservés.</p>

      <div class="kv mt">
        <div><span>Sauvegardes</span><span>${list.length ? `${pl(list.length, 'fichier')} · la plus récente ${esc(fmtWhen(list[0].mtime))}` : '<span class="muted">aucune pour l\'instant</span>'}</span></div>
        <div><span>${lbl('Copie externe', 'b.external')}</span><span>${ext.dir
          ? esc(ext.dir) + (ext.lastError ? ` <span class="err-inline">⚠ ${esc(ext.lastError)}</span>` : ext.lastCopy ? ` <span class="muted small">copié ${esc(fmtWhen(Date.parse(ext.lastCopy)))}</span>` : '')
          : '<span class="muted">aucune — c\'est le seul filet qui te protège d\'une panne de disque</span>'}</span></div>
        <div><span>Paquets sur ce poste</span><span>${inf.packs && inf.packs.files ? `${pl(inf.packs.files, 'fichier')} · ${esc(fmtBytes(inf.packs.bytes))}` : '<span class="muted">aucun</span>'}</span></div>
        <div><span>${lbl('Emplacement', 'b.where')}</span><span class="path">${esc(inf.dir || '')}</span></div>
      </div>

      ${!ext.dir ? `<div class="warn-box mt"><strong>Aucune copie hors de cet ordinateur.</strong>
        Les sauvegardes quotidiennes sont sur le même disque que tes données : elles ne te sauveront pas d'une panne, d'un vol ou d'un vol d'ordinateur.
        Choisis une clé USB, un disque externe ou un dossier iCloud Drive.</div>` : ''}

      <div class="modal-actions wrap">
        <button class="btn" id="b-now">Sauvegarder maintenant</button>
        <button class="btn" id="b-ext">${ext.dir ? 'Changer le dossier de copie…' : 'Choisir un dossier de copie…'}</button>
        ${ext.dir ? '<button class="btn" id="b-mirror">Copier maintenant</button><button class="btn btn-ghost" id="b-ext-off">Ne plus copier</button>' : ''}
        <span class="grow"></span>
        <button class="btn" id="b-open">Ouvrir le dossier</button>
      </div>

      ${list.length ? `<h3 class="mt">${lbl('Restaurer une sauvegarde', 'b.restore')}</h3>
      <div class="scroll-x"><table class="list compact"><thead><tr><th>Sauvegarde</th><th class="nw">Date</th><th class="r">Taille</th><th></th></tr></thead>
      <tbody>${list.slice(0, 40).map((x, i) => `<tr>
        <td>${esc(x.daily ? 'Quotidienne' : x.name.replace(/-\d{4}-\d{2}-\d{2}_.*$/, '').replace(/_/g, ' '))}</td>
        <td class="nw">${esc(fmtWhen(x.mtime))} <span class="muted small">${esc(ago(x.mtime))}</span></td>
        <td class="r muted nw">${esc(fmtBytes(x.size))}</td>
        <td class="actions row-actions"><button class="btn btn-ghost btn-sm" data-restore="${i}">Restaurer…</button></td></tr>`).join('')}</tbody></table></div>` : ''}`;

    s.innerHTML = `<h2>Sécurité</h2>
      <p class="small">Le fichier de ce cabinet est chiffré avec ton mot de passe (AES-256). Il contient la clé qui ouvre les paquets de
      tes clients : si ce poste est perdu ou volé, personne ne peut les lire.</p>

      <div class="warn-box mt"><strong>${lbl('Ta clé n\'existe qu\'ici.', 'b.recovery')}</strong>
      Ni nous, ni personne d\'autre ne peut la reconstituer. Sans elle et sans cet ordinateur, <strong>aucun paquet déjà reçu ne pourra plus être ouvert</strong>,
      et tes clients devront tous réimporter un nouveau fichier d'appairage.
      <div class="mt">${recoveryLine()}</div></div>

      <div class="modal-actions wrap">
        <button class="btn btn-primary" id="s-rec">Enregistrer ma clé de secours…</button>
        <button class="btn" id="s-rec-in">Restaurer une clé de secours…</button>
        <span class="grow"></span>
        <button class="btn" id="s-pw">${lbl('Changer le mot de passe…', 'b.password')}</button>
        <button class="btn btn-ghost" id="s-lock">Verrouiller maintenant</button>
      </div>

      <p class="muted small mt">À VÉRIFIER avec ton assureur ou ton Ordre : la conservation des pièces de tes clients sur ce poste
      relève des mêmes obligations que tes archives papier.</p>
      <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="s-support">Signaler un problème…</button></div>`;

    $('#b-now').onclick = quickBackup;
    $('#b-open').onclick = () => api.openDataDir();
    $('#b-ext').onclick = async () => {
      try {
        const r = await api.pickExternal();
        if (r) { backupInfo = await api.backups(); drawBackupPanels(); toast(r.lastError ? 'Dossier choisi, mais la copie a échoué : ' + r.lastError : 'Copie faite.'); }
      } catch (e) { toast(plainError(e), 'error'); }
    };
    const off = $('#b-ext-off');
    if (off) off.onclick = async () => {
      const ok = await confirmDialog('Ne plus copier ?', '<p>Les fichiers déjà copiés restent où ils sont. Plus rien n\'y sera ajouté.</p>', 'Arrêter la copie', true);
      if (!ok) return;
      await api.clearExternal(); backupInfo = await api.backups(); drawBackupPanels();
    };
    const mir = $('#b-mirror');
    if (mir) mir.onclick = async () => {
      const r = await api.mirrorNow();
      backupInfo = await api.backups(); drawBackupPanels();
      toast(r.ok ? 'Copie faite.' : 'Copie impossible : ' + (r.lastError || 'support introuvable'), r.ok ? '' : 'error');
    };
    $$('[data-restore]', b).forEach(btn => { btn.onclick = () => doRestore(list[Number(btn.dataset.restore)]); });

    $('#s-rec').onclick = exportRecovery;
    $('#s-rec-in').onclick = importRecovery;
    $('#s-pw').onclick = changePassword;
    $('#s-lock').onclick = async () => {
      const ok = await confirmDialog('Verrouiller le cabinet ?',
        '<p>L\'application se referme sur son écran de mot de passe. Rien n\'est perdu : tu rouvres avec ton mot de passe.</p>', 'Verrouiller');
      if (!ok) return;
      await api.lock();
      location.reload();
    };
    $('#s-support').onclick = supportDialog;
  }

  function recoveryLine() {
    const at = (backupInfo && backupInfo.recoveryExportedAt) || recoveryAt;
    return at
      ? `<span class="ok-inline">✓ Clé de secours enregistrée le ${esc(fmtDay(at))}.</span> <span class="muted small">Vérifie qu'elle n'est pas sur ce Mac.</span>`
      : `<span class="err-inline">⚠ Tu n'as jamais enregistré de clé de secours.</span> <span class="muted small">C'est le filet le plus important : trois minutes maintenant, ou tout est perdu le jour où le disque lâche.</span>`;
  }
  let recoveryAt = null;
  api.recoveryStatus && api.recoveryStatus().then(r => { recoveryAt = r && r.exportedAt; }).catch(() => {});

  async function doRestore(entry) {
    if (!entry) return;
    let peek;
    try { peek = await api.peekBackup(entry.path); }
    catch (e) {
      const msg = plainError(e);
      if (!/autre mot de passe/i.test(msg)) return toast(msg, 'error');
      const pw = await askPassword('Sauvegarde d\'un autre mot de passe', 'Cette sauvegarde a été chiffrée avec un mot de passe différent de celui d\'aujourd\'hui.', 'Lire');
      if (!pw) return;
      try { peek = await api.peekBackup(entry.path, pw); } catch (e2) { return toast(plainError(e2), 'error'); }
      return confirmRestore(entry, peek, pw);
    }
    confirmRestore(entry, peek, null);
  }

  async function confirmRestore(entry, peek, password) {
    const dd = peek.actuels.dossiers - peek.dossiers;
    const dp = peek.actuels.paquets - peek.paquets;
    const ok = await confirmDialog('Restaurer cette sauvegarde ?',
      `<p>Sauvegarde du <strong>${esc(fmtWhen(entry.mtime))}</strong>.</p>
       <table class="list compact"><thead><tr><th></th><th class="r">La sauvegarde</th><th class="r">Maintenant</th></tr></thead>
       <tbody><tr><td>Dossiers</td><td class="r">${peek.dossiers}</td><td class="r">${peek.actuels.dossiers}</td></tr>
       <tr><td>Paquets</td><td class="r">${peek.paquets}</td><td class="r">${peek.actuels.paquets}</td></tr></tbody></table>
       ${dd > 0 || dp > 0 ? `<p class="warn-box mt">Tu perdrais <strong>${dd > 0 ? pl(dd, 'dossier') : ''}${dd > 0 && dp > 0 ? ' et ' : ''}${dp > 0 ? pl(dp, 'paquet') : ''}</strong> enregistrés depuis.</p>` : ''}
       <p class="muted small">Une sauvegarde de l'état actuel est prise juste avant : tu pourras revenir en arrière.</p>`,
      'Restaurer', dd > 0 || dp > 0);
    if (!ok) return;
    try {
      S = await api.restore(entry.path, password);
      backupInfo = await api.backups();
      render(); toast('Sauvegarde restaurée.');
    } catch (e) { toast(plainError(e), 'error'); }
  }

  function exportRecovery(onDone) {
    modal(
      `<h2>Clé de secours</h2>
       <p class="small">Ce fichier contient la clé qui <strong>ouvre les paquets de tes clients</strong>. Protège-le par un mot de passe
       (différent de celui de l'application : ce fichier a vocation à quitter cet ordinateur).</p>
       <div class="warn-box">Range-le <strong>ailleurs que sur ce Mac</strong> : une clé USB dans un tiroir, un coffre, chez ton associé.
       Une clé de secours posée à côté de l'ordinateur ne protège de rien.</div>
       <label class="field mt">Mot de passe de ce fichier<span class="pw-wrap"><input type="password" id="p1" autocomplete="new-password"><button type="button" class="pw-eye" id="eye">Afficher</button></span></label>
       <label class="field mt">Confirme<input type="password" id="p2" autocomplete="new-password"></label>
       <div class="modal-actions"><button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Enregistrer le fichier…</button></div>`,
      (layer, close) => {
        const p1 = $('#p1', layer), p2 = $('#p2', layer);
        $('#eye', layer).onclick = () => {
          const t = p1.type === 'password' ? 'text' : 'password';
          p1.type = t; p2.type = t; $('#eye', layer).textContent = t === 'password' ? 'Afficher' : 'Masquer';
        };
        $('#no', layer).onclick = close;
        $('#ok', layer).onclick = async () => {
          if (p1.value.length < 8) return toast('Huit caractères au minimum.', 'error');
          if (p1.value !== p2.value) return toast('Les deux mots de passe ne sont pas les mêmes.', 'error');
          try {
            const r = await api.exportRecovery(p1.value);
            if (!r) return;
            close();
            recoveryAt = Date.now();
            drawBackupPanels();
            if (onDone) onDone();
            const show = await confirmDialog('Clé de secours enregistrée',
              `<p class="muted small">${esc(r.path)}</p><p>Copie-la maintenant sur une clé USB ou un disque que tu ranges ailleurs, et <strong>efface-la de cet ordinateur</strong>.</p>`,
              'La montrer dans le dossier');
            if (show) api.reveal(r.path);
          } catch (e) { toast(plainError(e), 'error'); }
        };
      }
    );
  }

  async function importRecovery() {
    const ok = await confirmDialog('Restaurer une clé de secours ?',
      `<p>La clé actuelle de ce cabinet sera <strong>remplacée</strong> par celle du fichier.</p>
       <p class="muted small">À faire quand tu réinstalles l'application sur un nouvel ordinateur. Si tu le fais par erreur,
       les paquets déjà reçus avec l'ancienne clé ne s'ouvriront plus. Une sauvegarde est prise juste avant.</p>`,
      'Continuer', true);
    if (!ok) return;
    const pw = await askPassword('Mot de passe de la clé de secours', 'Celui que tu as choisi en l\'enregistrant.', 'Restaurer');
    if (!pw) return;
    try {
      const r = await api.importRecovery(pw);
      if (!r) return;
      await refresh(); render();
      toast('Clé restaurée. Empreinte : ' + r.fingerprint);
    } catch (e) { toast(plainError(e), 'error'); }
  }

  function changePassword() {
    modal(
      `<h2>Changer le mot de passe</h2>
       <p class="small">Le fichier du cabinet et toutes ses sauvegardes seront rechiffrés avec le nouveau mot de passe.</p>
       <label class="field">Mot de passe actuel<input type="password" id="p0" autocomplete="current-password"></label>
       <label class="field mt">Nouveau mot de passe<span class="pw-wrap"><input type="password" id="p1" autocomplete="new-password"><button type="button" class="pw-eye" id="eye">Afficher</button></span><span class="muted small" id="str"></span></label>
       <label class="field mt">Confirme<input type="password" id="p2" autocomplete="new-password"></label>
       <div class="warn-box mt">Il n'y a toujours aucun moyen de le récupérer. Note le nouveau avant de valider.</div>
       <div class="modal-actions"><button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Changer</button></div>`,
      (layer, close) => {
        const p1 = $('#p1', layer), p2 = $('#p2', layer);
        p1.oninput = () => { $('#str', layer).textContent = strengthText(p1.value); };
        $('#eye', layer).onclick = () => {
          const t = p1.type === 'password' ? 'text' : 'password';
          p1.type = t; p2.type = t; $('#eye', layer).textContent = t === 'password' ? 'Afficher' : 'Masquer';
        };
        $('#no', layer).onclick = close;
        $('#ok', layer).onclick = async () => {
          if (p1.value.length < 8) return toast('Huit caractères au minimum.', 'error');
          if (p1.value !== p2.value) return toast('Les deux mots de passe ne sont pas les mêmes.', 'error');
          try {
            await api.changePassword($('#p0', layer).value, p1.value);
            close();
            backupInfo = await api.backups(); drawBackupPanels();
            toast('Mot de passe changé. Les sauvegardes ont été rechiffrées.');
          } catch (e) { toast(plainError(e), 'error'); }
        };
      }
    );
  }

  async function supportDialog() {
    let inf = {};
    try { inf = await api.support(); } catch {}
    modal(
      `<h2>Signaler un problème</h2>
       <p class="small">Copie ces informations dans ton message : elles disent où en est ton installation, sans rien révéler du contenu de tes dossiers.</p>
       <pre class="code-box" id="sup">SkanFact Cabinet ${esc(inf.version || '')}
Système : ${esc(inf.platform || '')} ${esc(inf.arch || '')} · Electron ${esc(inf.electron || '')}
Dossiers : ${inf.dossiers || 0} · Paquets : ${inf.paquets || 0}
Copie externe : ${esc((inf.external && inf.external.dir) || 'aucune')}${inf.external && inf.external.lastError ? ' (erreur : ' + esc(inf.external.lastError) + ')' : ''}</pre>
       <div class="modal-actions"><button class="btn" id="log">Ouvrir le journal technique</button><span class="grow"></span>
       <button class="btn" id="copy">Copier</button><button class="btn btn-primary" id="ok">Fermer</button></div>`,
      (layer, close) => {
        $('#ok', layer).onclick = close;
        $('#log', layer).onclick = () => api.openLog();
        $('#copy', layer).onclick = async () => {
          try { await navigator.clipboard.writeText($('#sup', layer).textContent); toast('Copié.'); }
          catch { toast('Copie impossible.', 'error'); }
        };
      }
    );
  }

  // ---------- assistant de première utilisation ----------
  //
  // C'est le premier contact d'un comptable avec le produit. Avant, on le laissait sur un formulaire
  // de réglages avec un message passager, et il repartait sans savoir quoi faire. L'assistant lui
  // fait faire, dans l'ordre, les quatre gestes qui rendent l'application utile : se nommer, entrer
  // ses clients, poser ses filets, produire le fichier à remettre.
  function runSetup() {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.id = 'setup';
      document.body.appendChild(el);
      let etape = 0;
      const fin = () => { el.remove(); resolve(); };

      const etapes = [
        {
          t: 'Bienvenue dans SkanFact Cabinet',
          html: () => `
            <p class="lead">L'application répond à une seule question : <strong>lequel de mes clients ne m'a pas envoyé son mois ?</strong></p>
            <div class="kv mt">
              <div><span>Ce qu'elle fait</span><span>Elle reçoit les paquets mensuels de tes clients, vérifie qu'ils sont intacts, te dit ce qui manque et prépare tes relances.</span></div>
              <div><span>Ce qu'elle ne fait pas</span><span>Elle ne modifie <strong>jamais</strong> la comptabilité d'un client et ne lui renvoie rien. Elle ne dépose aucune déclaration.</span></div>
              <div><span>Ce qu'elle coûte</span><span>Rien. C'est ton client qui paie SkanFact, pas toi.</span></div>
            </div>
            <p class="muted small mt">Quatre écrans, deux minutes. Tu pourras tout changer ensuite dans Réglages.</p>`,
          next: () => true
        },
        {
          t: 'Ton cabinet',
          html: () => `
            <p class="small">Ce nom apparaît en bas des relances que tu envoies et dans le fichier que tes clients importeront.</p>
            <div class="grid-2 mt">
              <label class="field span-2">${lbl('Nom du cabinet', 'cab.name')}<input type="text" id="w-name" value="${esc(S.cabinet.name || '')}" placeholder="Cabinet Ben Salah"></label>
              <label class="field">${lbl('Email', 'cab.email')}<input type="email" id="w-email" value="${esc(S.cabinet.email || '')}" placeholder="contact@cabinet.tn"></label>
              <label class="field">${lbl('Téléphone', 'cab.phone')}<input type="tel" id="w-phone" value="${esc(S.cabinet.phone || '')}" placeholder="+216 …"></label>
              <label class="field narrow">${lbl('Jour de relance', 'cab.relanceDay')}<input type="number" id="w-day" min="1" max="28" value="${Number((S.settings || {}).relanceDay) || 10}"></label>
            </div>`,
          next: async () => {
            const nom = $('#w-name', el).value.trim();
            if (!nom) { toast('Donne un nom à ton cabinet.', 'error'); return false; }
            S = await api.saveCabinet({
              name: nom, email: $('#w-email', el).value.trim(), phone: $('#w-phone', el).value.trim(),
              settings: { relanceDay: Number($('#w-day', el).value) }
            });
            return true;
          }
        },
        {
          t: 'Tes clients',
          html: () => `
            <p class="small">Mets-les <strong>tous</strong>, même ceux qui n'utilisent pas encore SkanFact : l'application devient le tableau de bord
            de ton portefeuille, et rien n'est réclamé à ceux qui n'ont pas commencé.</p>
            <label class="field mt">${lbl('Un client par ligne', 'd.liste')}
              <textarea id="w-clients" rows="8" placeholder="Menuiserie Trabelsi SUARL ; 1122334A/M/P/000 ; contact@trabelsi.tn ; +216 22 333 444&#10;Pharmacie El Menzah&#10;Café des Jasmins ; ; jasmins@example.tn"></textarea></label>
            <p class="muted small">Tu peux coller une colonne entière depuis Excel. Les colonnes, quand tu en mets, se séparent par
            un point-virgule : <strong>nom ; matricule ; email ; téléphone</strong>. Seul le nom est obligatoire.</p>
            <p class="muted small">Pas envie maintenant ? Passe : tu pourras charger un jeu d'exemple ou ajouter tes clients un par un.</p>`,
          next: async () => {
            const txt = $('#w-clients', el).value.trim();
            if (!txt) return true;
            const r = await api.importDossiers(txt);
            S = r.state;
            if (r.added) toast(`${pl(r.added, 'client')} ajouté${r.added > 1 ? 's' : ''}.`);
            if (r.ignorés && r.ignorés.length) toast(`${pl(r.ignorés.length, 'doublon')} ignoré${r.ignorés.length > 1 ? 's' : ''} : ${r.ignorés.slice(0, 3).join(', ')}`, 'error');
            return true;
          }
        },
        {
          t: 'Ne rien perdre',
          html: () => `
            <p class="small">Cette application va contenir la comptabilité de tes clients <strong>et la clé qui ouvre leurs paquets</strong>.
            Deux gestes, une fois, et un incident ne te coûtera plus rien.</p>
            <div class="warn-box mt"><strong>Sans clé de secours, si ce Mac disparaît, aucun paquet déjà reçu ne pourra plus être ouvert.</strong>
            Ni par nous, ni par personne. Tes clients devraient tous réimporter un nouvel appairage.</div>
            <div class="wiz-steps mt">
              <div class="wiz-step"><div><strong>1. Une copie hors de cet ordinateur</strong>
                <div class="muted small">Clé USB, disque externe, iCloud Drive. La base, les sauvegardes et les paquets y seront recopiés à chaque enregistrement.</div></div>
                <button class="btn" id="w-ext">Choisir un dossier…</button><span class="ok-inline" id="w-ext-ok" hidden>✓ fait</span></div>
              <div class="wiz-step"><div><strong>2. La clé de secours</strong>
                <div class="muted small">Un petit fichier protégé par son propre mot de passe, à ranger ailleurs que sur ce Mac.</div></div>
                <button class="btn btn-primary" id="w-rec">Enregistrer la clé…</button><span class="ok-inline" id="w-rec-ok" hidden>✓ fait</span></div>
            </div>
            <p class="muted small mt">Tu peux les faire plus tard (Réglages → Sécurité), mais « plus tard » est exactement le moment où l'on oublie.</p>`,
          mount: () => {
            $('#w-ext', el).onclick = async () => {
              try { const r = await api.pickExternal(); if (r && r.dir) { $('#w-ext-ok', el).hidden = false; refreshBackupInfo(); } }
              catch (e) { toast(plainError(e), 'error'); }
            };
            $('#w-rec', el).onclick = () => { exportRecovery(() => { $('#w-rec-ok', el).hidden = false; }); };
          },
          next: () => true
        },
        {
          t: 'Le fichier à remettre à tes clients',
          html: () => `
            <p class="small">Dernière étape. Chaque client importe ce fichier <strong>une fois</strong> dans son SkanFact
            (Paramètres → Cabinet comptable). À partir de là, les paquets qu'il fabrique sont chiffrés
            <strong>pour toi seul</strong>, et il n'a plus aucun mot de passe à te communiquer.</p>
            <div class="mt"><div class="muted small">${lbl('Empreinte de ton cabinet', 'cab.fingerprint')}</div>
              <div class="fingerprint">${esc(S.cabinet.fingerprint || '—')}</div></div>
            <p class="muted small mt">S'il te la lit au téléphone après l'import et qu'elle correspond, c'est bien à toi qu'il envoie.</p>
            <div class="wiz-steps mt">
              <div class="wiz-step"><div><strong>Le fichier d'appairage</strong>
                <div class="muted small">Un envoi par mail suffit : il ne contient rien de secret.</div></div>
                <button class="btn btn-primary" id="w-pair">Enregistrer le fichier…</button><span class="ok-inline" id="w-pair-ok" hidden>✓ fait</span></div>
            </div>`,
          mount: () => {
            $('#w-pair', el).onclick = async () => {
              try { const r = await api.exportPairing(); if (r) { $('#w-pair-ok', el).hidden = false; toast('Fichier enregistré.'); } }
              catch (e) { toast(plainError(e), 'error'); }
            };
          },
          next: () => true
        }
      ];

      function draw() {
        const e = etapes[etape];
        el.innerHTML = `<div class="wiz-card">
          <div class="wiz-dots">${etapes.map((_, i) => `<span class="${i === etape ? 'on' : i < etape ? 'done' : ''}"></span>`).join('')}</div>
          <h1>${esc(e.t)}</h1>
          <div class="wiz-body">${e.html()}</div>
          <div class="wiz-actions">
            ${etape > 0 ? '<button class="btn" id="w-back">← Retour</button>' : ''}
            <span class="grow"></span>
            ${etape < etapes.length - 1 ? '<button class="btn btn-ghost" id="w-skip">Passer</button>' : ''}
            <button class="btn btn-primary" id="w-next">${etape === etapes.length - 1 ? 'Commencer' : 'Continuer'}</button>
          </div></div>`;
        if (e.mount) e.mount();
        const b = $('#w-back', el); if (b) b.onclick = () => { etape--; draw(); };
        const s = $('#w-skip', el); if (s) s.onclick = () => { etape++; draw(); };
        $('#w-next', el).onclick = async () => {
          const btn = $('#w-next', el);
          btn.disabled = true;
          let ok = true;
          try { ok = await e.next(); } catch (ex) { toast(plainError(ex), 'error'); ok = false; }
          btn.disabled = false;
          if (!ok) return;
          if (etape === etapes.length - 1) { fin(); render(); return; }
          etape++; draw();
        };
        const first = el.querySelector('input, textarea');
        if (first) first.focus();
      }
      draw();
    });
  }

  // ---------- recherche rapide (Cmd+K) ----------
  function openPalette() {
    if ($('#palette-root')) return;
    const root = document.createElement('div');
    root.id = 'palette-root';
    root.innerHTML = `<div class="palette">
      <input type="text" id="pal-q" placeholder="Chercher un client, ou taper une action…" autocomplete="off" spellcheck="false">
      <div class="results" id="pal-res"></div>
      <div class="hint">↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</div></div>`;
    document.body.appendChild(root);
    const close = () => { root.remove(); document.removeEventListener('keydown', onKey, true); };
    let sel = 0, items = [];

    const actions = [
      { kind: 'action', main: 'Importer un paquet…', go: () => doImport() },
      { kind: 'action', main: 'Nouveau dossier client…', go: () => newDossierForm() },
      { kind: 'action', main: 'Sauvegarder maintenant', go: () => quickBackup() },
      { kind: 'action', main: 'Relances', go: () => { location.hash = '#/relances'; } },
      { kind: 'action', main: 'Réglages', go: () => { location.hash = '#/reglages'; } },
      { kind: 'action', main: 'Aide', go: () => { location.hash = '#/aide'; } }
    ];

    function draw() {
      const q = $('#pal-q', root).value.trim().toLowerCase();
      const rows = K.dossierList(S, null, { q, withArchived: true }).slice(0, 30).map(r => ({
        kind: 'client', main: r.name,
        sub: [r.matricule, r.missingCount ? pl(r.missingCount, 'mois', 'mois') + ' manquant' + (r.missingCount > 1 ? 's' : '') : ''].filter(Boolean).join(' · '),
        go: () => { location.hash = '#/dossier/' + encodeURIComponent(r.id); }
      }));
      const acts = actions.filter(a => !q || a.main.toLowerCase().includes(q));
      items = rows.concat(acts);
      if (sel >= items.length) sel = Math.max(0, items.length - 1);
      $('#pal-res', root).innerHTML = items.length
        ? items.map((x, i) => `<div class="res ${i === sel ? 'sel' : ''}" data-i="${i}">
            <span class="kind">${esc(x.kind)}</span><span class="main">${esc(x.main)}</span>
            ${x.sub ? `<span class="sub">${esc(x.sub)}</span>` : ''}</div>`).join('')
        : '<div class="res"><span class="main muted">Rien ne correspond.</span></div>';
      $$('.res[data-i]', root).forEach(el => {
        el.onclick = () => { const x = items[Number(el.dataset.i)]; close(); if (x) x.go(); };
      });
    }
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      if (e.key === 'Enter') { e.preventDefault(); const x = items[sel]; close(); if (x) x.go(); }
    };
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('mousedown', e => { if (e.target === root) close(); });
    $('#pal-q', root).oninput = () => { sel = 0; draw(); };
    draw();
    $('#pal-q', root).focus();
  }

  // ---------- mises à jour ----------
  // Même mécanique que dans SkanFact, avec un canal séparé : l'app cabinet ne reçoit QUE ses
  // versions à elle. Sur macOS l'app n'est pas signée, donc elle se remplace elle-même dans le
  // dossier Applications puis se relance — c'est ce que fait mac-update.sh.
  function drawUpdatePanel() {
    const el = $('#upd-panel'); if (!el) return;
    const a = upd.app || {};
    const macNonSigne = a.platform === 'darwin' && !a.macSigned;
    const btnCheck = '<button class="btn" id="u-check">Vérifier maintenant</button>';
    let corps = '';
    if (!a.packaged) corps = `<p class="muted small">Mode développement : la vérification n'est active que dans l'application installée.</p>${btnCheck}`;
    else if (upd.state === 'checking') corps = '<p class="muted">Vérification en cours…</p>';
    else if (upd.state === 'none') corps = `<p>Tu as la dernière version.</p>${btnCheck}`;
    else if (upd.state === 'available') corps = `<p><strong>Version ${esc(upd.version)} disponible</strong> — téléchargement en cours…</p>`;
    else if (upd.state === 'downloading') corps = `<p>Téléchargement de la version ${esc(upd.version)}… ${upd.percent} %</p>
      <div class="progress"><div style="width:${upd.percent}%"></div></div>`;
    else if (upd.state === 'downloaded') corps = `<p><strong>Version ${esc(upd.version)} prête.</strong>
      ${macNonSigne ? 'L\'application se ferme, se remplace dans le dossier Applications et se relance (une dizaine de secondes).' : 'L\'application se ferme, s\'installe et redémarre.'}</p>
      <button class="btn btn-primary" id="u-install">Installer et redémarrer</button>`;
    else if (upd.state === 'error') corps = `<p class="small" style="color:var(--danger)">${esc(upd.message)}</p>
      <div class="inline">${btnCheck}<button class="btn btn-ghost" id="u-rel">Voir les versions sur GitHub</button></div>`;
    else if (!a.relay && (upd.state === 'token' || !a.hasToken)) corps = `<p class="muted small">Les mises à jour ne sont pas encore activées sur cet ordinateur : colle le jeton d'accès ci-dessous.</p>${btnCheck}`;
    else corps = btnCheck;

    // Avec le relais, il n'y a rien à saisir : c'est lui qui détient l'accès au dépôt. On ne montre
    // pas un champ que personne n'a à remplir.
    // Un relais en panne se dit : un écran qui affirme « rien à configurer » devant une mise à jour
    // impossible laisse le comptable sans recours.
    const noteRelais = a.relayFailure ? `<p class="small mt" style="color:var(--danger)">${esc(a.relayFailure)}</p>` : '';
    const jeton = a.relay ? '<p class="small muted mt">Les mises à jour arrivent toutes seules : rien à configurer.</p>' : noteRelais + `<div class="token-box">
      <div class="k-label">Accès au dépôt</div>
      <p class="small muted">SkanFact est distribué depuis un dépôt privé : un jeton de lecture est nécessaire pour recevoir les mises à jour.
      Demande-le à qui t'a remis l'application. Il reste sur cet ordinateur et ne sert qu'à télécharger les nouvelles versions.</p>
      <div class="inline"><input type="text" id="u-token" placeholder="${a.hasToken ? 'Jeton enregistré ✓ — en coller un nouveau pour le remplacer' : 'github_pat_… ou ghp_…'}" autocomplete="off" spellcheck="false">
      <button class="btn btn-sm" id="u-token-save">Enregistrer</button>${a.hasToken ? '<button class="btn btn-sm btn-ghost" id="u-token-clear">Retirer</button>' : ''}</div>
    </div>`;

    el.innerHTML = `<div class="update-head"><div><div class="k-label">Version installée</div><div class="ver">${esc(a.version || '…')}</div></div></div>${corps}${jeton}`;

    const relire = async () => { upd.app = await api.updVersion(); drawUpdatePanel(); };
    const verifier = async () => {
      upd.state = 'checking'; drawUpdatePanel();
      const r = await api.updCheck();
      if (r && (r.state === 'dev' || r.state === 'token' || r.state === 'error')) {
        upd.state = r.state === 'dev' ? 'idle' : r.state; upd.message = r.message || ''; drawUpdatePanel();
      }
    };
    if ($('#u-check')) $('#u-check').onclick = verifier;
    if ($('#u-rel')) $('#u-rel').onclick = () => api.updOpenReleases();
    if ($('#u-install')) $('#u-install').onclick = async () => {
      const b = $('#u-install'); b.disabled = true; b.textContent = 'Installation…';
      const r = await api.updInstall();
      if (r && r.state === 'error') { upd.state = 'error'; upd.message = r.message; drawUpdatePanel(); }
    };
    if ($('#u-token-save')) $('#u-token-save').onclick = async () => {
      const t = $('#u-token').value.trim();
      if (!t) return toast('Colle un jeton d\'abord', 'error');
      if (!/^(github_pat_|ghp_|gho_|ghs_)[A-Za-z0-9_]+$/.test(t)) return toast('Ce n\'est pas un jeton GitHub : il commence par github_pat_ ou ghp_', 'error');
      const r = await api.updSetToken(t);
      upd.app = { ...(upd.app || {}), hasToken: r.hasToken };
      upd.state = 'idle'; toast('Jeton enregistré');
      verifier();
    };
    if ($('#u-token-clear')) $('#u-token-clear').onclick = async () => {
      const r = await api.updSetToken('');
      upd.app = { ...(upd.app || {}), hasToken: r.hasToken };
      upd.state = 'idle'; drawUpdatePanel();
    };
    if (!upd.app) relire();
  }

  // ---------- aide ----------
  function drawAide(view) {
    view.innerHTML = `
      <div class="page-head"><h1>Comment ça marche</h1></div>
      <p class="lead">Partout dans l'application, les petits <span class="i-demo">i</span> expliquent le champ juste à côté.</p>
      ${G.ARTICLES.map(a => `<div class="panel"><h2>${esc(a.t)}</h2>${a.d}</div>`).join('')}`;
  }

  boot().catch(e => { $('#lock-sub').textContent = 'Erreur au démarrage : ' + plainError(e); });
})();
