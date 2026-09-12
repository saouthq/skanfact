// SkanFact Cabinet — l'interface du comptable.
//
// Une seule question guide cet écran : « lequel de mes clients ne m'a pas envoyé son mois ? ».
// Tout le reste (ouvrir une pièce, relancer, régler son cabinet) en découle. On ne modifie jamais la
// comptabilité d'un client : cette application lit, elle n'écrit pas chez les autres.
(function () {
  'use strict';

  const K = window.CabCore;
  const api = window.cabinet;

  let S = null;                          // l'état du cabinet (sans la clé privée)
  let listQ = '';                        // recherche de la liste des dossiers
  let withArchived = false;

  // ---------- petits outils ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let toastTimer = null;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (kind === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, kind === 'error' ? 5200 : 2800);
  }

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

  function askPassword(title, note) {
    return new Promise(resolve => {
      modal(
        `<h2>${esc(title)}</h2><p class="muted small">${esc(note || '')}</p>
         <label class="field mt">Mot de passe<input type="password" id="pw" autocomplete="off"></label>
         <div class="modal-actions"><button class="btn" id="no">Annuler</button>
         <button class="btn btn-primary" id="ok">Ouvrir</button></div>`,
        (layer, close) => {
          const go = () => { const v = $('#pw', layer).value; close(); resolve(v); };
          $('#pw', layer).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
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
  const fmtBytes = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';
  function fmtWhen(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    const p = x => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ---------- ouverture ----------
  async function boot() {
    const st = await api.status();
    $('#app-version').textContent = 'v' + st.version;
    const sub = $('#lock-sub'), pw2 = $('#lock-pw2'), note = $('#lock-note');
    if (st.exists) {
      sub.textContent = 'Entre le mot de passe de ton cabinet.';
      note.textContent = 'Le dossier est chiffré sur ce poste : sans ce mot de passe, personne ne peut lire les comptabilités de tes clients.';
    } else {
      $('#lock-title').textContent = 'Bienvenue';
      sub.textContent = 'Choisis le mot de passe de ton cabinet. Il chiffre tout ce que tes clients t\'enverront.';
      pw2.hidden = false;
      $('#lock-go').textContent = 'Créer mon cabinet';
      note.textContent = 'Il n\'y a aucun moyen de le récupérer : note-le quelque part de sûr.';
    }
    $('#lock-form').onsubmit = async e => {
      e.preventDefault();
      const pw = $('#lock-pw').value;
      const err = $('#lock-err');
      err.hidden = true;
      if (pw.length < 6) { err.textContent = 'Six caractères au minimum.'; err.hidden = false; return; }
      if (!st.exists && pw !== pw2.value) { err.textContent = 'Les deux mots de passe ne sont pas les mêmes.'; err.hidden = false; return; }
      try {
        const r = await api.unlock(pw);
        S = r.state;
        $('#lock-screen').remove();
        $('#app').hidden = false;
        start(r.created);
      } catch (ex) {
        err.textContent = ex.message || String(ex);
        err.hidden = false;
        $('#lock-pw').select();
      }
    };
    $('#lock-pw').focus();
  }

  function start(created) {
    window.addEventListener('hashchange', render);
    api.onMenuAction(name => {
      if (name === 'import') doImport();
      else if (name.startsWith('go:')) location.hash = '#/' + name.slice(3);
    });
    if (!location.hash) location.hash = '#/dossiers';
    render();
    if (created || !(S.cabinet.name || '').trim()) {
      location.hash = '#/reglages';
      setTimeout(() => toast('Commence par renseigner le nom de ton cabinet.'), 400);
    }
  }

  async function refresh() { S = await api.state(); }

  // ---------- import d'un paquet ----------
  async function doImport(paths) {
    let r;
    try { r = await api.importPack({ paths }); }
    catch (e) { return toast(e.message || String(e), 'error'); }
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
            r = { results: r.results.filter(x => !locked.includes(x)).concat(r2.results), state: r2.state };
          }
        } catch (e) { toast(e.message || String(e), 'error'); }
      }
    }
    showImportReport(r.results, r.demoRemoved);
    render();
  }

  function importLine(x) {
    const file = esc((x.file || '').split(/[\\/]/).pop());
    if (x.error) return `<li><span class="imp-err">✕ ${file}</span><div class="imp-sub">${esc(x.error)}</div></li>`;
    const d = x.dossier || {};
    const bits = [];
    if (x.created) bits.push('nouveau dossier');
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
    modal(
      `<h2>${pl(ok, 'paquet')} ${ok > 1 ? 'rangés' : 'rangé'}</h2>
       <ul class="imp-list">${results.map(importLine).join('')}</ul>
       ${demoRemoved ? '<p class="small mt">Les dossiers d\'exemple ont été effacés : place aux vrais.</p>' : ''}
       <p class="muted small mt">Les paquets sont copiés dans le dossier de l'application : le fichier d'origine reste où il est.</p>
       <div class="modal-actions"><button class="btn btn-primary" id="ok">Fermer</button></div>`,
      (layer, close) => { $('#ok', layer).onclick = close; }
    );
  }

  // ---------- rendu ----------
  function render() {
    const hash = location.hash.replace(/^#\//, '') || 'dossiers';
    const [route, arg] = hash.split('/');
    $$('.sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    $('#brand-cab').textContent = S.cabinet.name || 'Cabinet';
    const todo = K.cabinetTodo(S);
    const late = todo.find(t => t.id === 'manquants');
    const pill = $('#nav-relances');
    pill.hidden = !late;
    if (late) pill.textContent = late.count;
    const view = $('#view');
    if (route === 'dossier') drawDossier(view, arg);
    else if (route === 'relances') drawRelances(view);
    else if (route === 'reglages') drawReglages(view);
    else if (route === 'aide') drawAide(view);
    else drawDossiers(view);
  }

  function todoPanel(todo) {
    if (!todo.length) return `<div class="todo-ok">Tout est à jour : tous tes dossiers ont envoyé leurs mois clôturés.</div>`;
    return `<div class="panel todo"><h2>À faire</h2><ul>${todo.map(t => `
      <li class="lvl-${t.level}"><span class="td-dot"></span>
        <span class="td-txt"><strong>${esc(t.label)}</strong><span class="small muted">${esc(t.detail)}</span></span>
        <a class="btn btn-ghost btn-sm" href="#/relances">Voir</a></li>`).join('')}</ul></div>`;
  }

  function drawDossiers(view) {
    const rows = K.dossierList(S, null, { q: listQ, withArchived });
    const demoCount = (S.dossiers || []).filter(d => d.demo).length;
    const demoOn = demoCount > 0;
    const all = K.dossierList(S, null, { withArchived: true });
    const todo = K.cabinetTodo(S);
    view.innerHTML = `
      <div class="page-head"><h1>Dossiers</h1>
        <div class="actions"><button class="btn btn-primary" id="imp">Importer un paquet…</button></div></div>
      ${todoPanel(todo)}
      ${all.length ? '' : `<div class="drop" id="drop">Aucun paquet reçu pour l'instant.<br>
        Quand un client t'envoie son <strong>.skanpack</strong>, enregistre-le puis clique ici pour l'ajouter.
        <div class="mt"><button class="btn btn-ghost btn-sm" id="demo-on">Voir à quoi ça ressemble (exemple fictif)</button></div></div>`}
      ${demoOn ? `<div class="banner"><span>Ces ${pl(demoCount, 'dossier')} sont <strong>fictifs</strong> : ils montrent les quatre situations
        que tu rencontreras. Ils disparaîtront au premier vrai paquet importé.</span>
        <button class="btn btn-ghost btn-sm nw" id="demo-off">Effacer l'exemple</button></div>` : ''}
      <div class="filters">
        <input type="text" id="q" placeholder="Chercher un client, un matricule…" value="${esc(listQ)}">
        <label class="inline small muted"><input type="checkbox" id="arch" ${withArchived ? 'checked' : ''}> Voir les dossiers archivés</label>
        <span class="muted small">${rows.length} sur ${all.length}</span>
      </div>
      ${rows.length ? `<div class="scroll-x"><table class="list">
        <thead><tr><th>Client</th><th class="nw">Dernier mois reçu</th><th class="r nw">Chiffre d'affaires</th>
        <th class="r nw">Mois manquants</th><th class="r nw">Provisoires</th><th class="r nw">Signalé</th><th class="nw">Reçu le</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="clickable" data-id="${esc(r.id)}">
          <td><span class="dot-lvl ${r.level === 'ok' ? '' : r.level}"></span>${esc(r.name)}${r.archived ? ' <span class="badge">archivé</span>' : ''}</td>
          <td class="nw">${esc(r.lastLabel || '—')}${r.lastMonth && !r.lastDefinitive ? ' <span class="badge partielle">provisoire</span>' : ''}</td>
          <td class="r nw">${esc(r.lastFigures ? money(r.lastFigures.ca, r.lastFigures.devise) : '—')}</td>
          <td class="r">${r.missingCount || '—'}</td>
          <td class="r">${r.provisionalCount || '—'}</td>
          <td class="r">${r.issues || '—'}</td>
          <td class="muted nw">${esc(fmtWhen(r.lastAt))}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${all.length ? 'Aucun dossier ne correspond à cette recherche.' : 'Importe le premier paquet pour voir apparaître un dossier.'}</div>`}`;

    $('#imp').onclick = () => doImport();
    const drop = $('#drop');
    if (drop) drop.onclick = e => { if (e.target.id !== 'demo-on') doImport(); };
    const dOn = $('#demo-on'), dOff = $('#demo-off');
    if (dOn) dOn.onclick = async e => { e.stopPropagation(); S = await api.demo(true); render(); toast('Exemple chargé : ces dossiers sont fictifs.'); };
    if (dOff) dOff.onclick = async () => { S = await api.demo(false); render(); toast('Exemple effacé.'); };
    const q = $('#q');
    q.oninput = () => { listQ = q.value; const pos = q.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#arch').onchange = e => { withArchived = e.target.checked; render(); };
    $$('tr[data-id]', view).forEach(tr => { tr.onclick = () => { location.hash = '#/dossier/' + encodeURIComponent(tr.dataset.id); }; });
  }

  function drawDossier(view, id) {
    const dossier = (S.dossiers || []).find(d => d.id === decodeURIComponent(id || ''));
    if (!dossier) { view.innerHTML = `<div class="empty">Ce dossier n'existe plus.</div>`; return; }
    const row = K.dossierRow(dossier);
    const months = K.dossierMonths(dossier).slice().reverse();
    const packs = (dossier.packs || []).slice().sort((a, b) => a.month < b.month ? 1 : -1);

    view.innerHTML = `
      <button class="btn btn-ghost btn-sm btn-back" id="back">← Dossiers</button>
      <div class="page-head"><div>
        <h1>${esc(dossier.name)}</h1>
        <div class="muted small">${esc(dossier.matricule || 'Matricule inconnu')}${dossier.email ? ' · ' + esc(dossier.email) : ''}</div>
      </div><div class="actions">
        <button class="btn" id="edit">Modifier la fiche</button>
        ${row.missingCount || row.provisionalCount ? '<button class="btn btn-primary" id="rel">Relancer</button>' : ''}
      </div></div>

      <div class="panel"><h2>Les mois de ce client</h2>
        <div class="mgrid">${months.map(m => `<div class="mcell ${m.state}${m.pack && m.pack.path ? ' clickable' : ''}" ${m.pack && m.pack.path ? `data-m="${esc(m.month)}"` : ''}>
          <div class="m-lab">${esc(m.label)}</div>
          <div class="m-st">${m.state === 'complet' ? 'définitif' : m.state === 'provisoire' ? 'provisoire' : 'manquant'}</div>
        </div>`).join('') || '<span class="muted small">Aucun mois attendu pour l\'instant.</span>'}</div>
        <p class="muted small mt">Un mois <strong>provisoire</strong> n'a pas été clôturé chez le client : ses chiffres peuvent encore changer,
        ne déclare pas dessus. Le mois en cours n'est jamais réclamé.</p>
      </div>

      <div class="panel"><h2>Paquets reçus</h2>
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
          <td class="actions">${p.path
            ? `<button class="btn btn-ghost btn-sm" data-open="${esc(p.month)}">Ouvrir</button>
               <button class="btn btn-ghost btn-sm" data-rev="${esc(p.month)}">Voir le fichier</button>`
            : '<span class="muted small">exemple</span>'}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">Aucun paquet.</div>'}
      </div>

      ${(dossier.note || '').trim() ? `<div class="panel"><h2>Note</h2><div class="notes-md">${esc(dossier.note)}</div></div>` : ''}`;

    $('#back').onclick = () => { location.hash = '#/dossiers'; };
    $('#edit').onclick = () => dossierForm(dossier);
    const rel = $('#rel'); if (rel) rel.onclick = () => writeRelance(row);
    $$('[data-m]', view).forEach(c => { c.onclick = () => openPack(dossier, c.dataset.m); });
    $$('[data-open]', view).forEach(b => { b.onclick = () => openPack(dossier, b.dataset.open); });
    $$('[data-rev]', view).forEach(b => {
      b.onclick = () => {
        const p = packs.find(x => x.month === b.dataset.rev);
        if (p) api.reveal(p.path);
      };
    });
  }

  // Ouvrir un paquet : on montre ce qu'il contient, on n'extrait que ce qui est demandé.
  async function openPack(dossier, month) {
    const p = (dossier.packs || []).find(x => x.month === month);
    if (!p) return;
    let files, password = null;
    try { files = await api.listPack(p.path); }
    catch (e) {
      if (!/mot de passe|déchiffr|authenticate/i.test(e.message || '')) return toast(e.message || String(e), 'error');
      password = await askPassword('Paquet protégé', 'Ce paquet est scellé par un mot de passe.');
      if (!password) return;
      try { files = await api.listPack(p.path, password); }
      catch (e2) { return toast(e2.message || String(e2), 'error'); }
    }
    const order = f => (f.name === '00-page-de-garde.pdf' ? 0 : f.name.startsWith('journaux/') ? 1 : f.name === 'manifeste.json' ? 9 : 5);
    files.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'fr'));
    modal(
      `<h2>${esc(dossier.name)} — ${esc(p.label)}</h2>
       <p class="muted small">${pl(files.length, 'fichier')}. Commence par la page de garde : elle résume le mois et liste ce qui manque.</p>
       <table class="list compact mt"><tbody>${files.map((f, i) => `<tr class="clickable" data-i="${i}">
         <td>${esc(f.name)}</td><td class="r muted nw">${esc(fmtBytes(f.size))}</td></tr>`).join('')}</tbody></table>
       <div class="modal-actions"><button class="btn btn-primary" id="ok">Fermer</button></div>`,
      (layer, close) => {
        $('#ok', layer).onclick = close;
        $$('tr[data-i]', layer).forEach(tr => {
          tr.onclick = async () => {
            try { await api.openInPack(p.path, files[Number(tr.dataset.i)].name, password); }
            catch (e) { toast(e.message || String(e), 'error'); }
          };
        });
      }
    );
  }

  function dossierForm(dossier) {
    modal(
      `<h2>Fiche du dossier</h2>
       <div class="grid-2">
         <label class="field span-2">Nom du client<input type="text" id="f-name" value="${esc(dossier.name)}"></label>
         <label class="field span-2">Adresse email<input type="email" id="f-email" value="${esc(dossier.email)}" placeholder="Pour les relances"></label>
       </div>
       <label class="field mt">Note interne<textarea id="f-note">${esc(dossier.note)}</textarea></label>
       <label class="inline small mt"><input type="checkbox" id="f-arch" ${dossier.archived ? 'checked' : ''}> Dossier archivé (client parti : on ne le réclame plus)</label>
       <p class="muted small mt">Le matricule fiscal (${esc(dossier.matricule || 'absent')}) vient des paquets du client : c'est lui qui identifie le dossier, il ne se modifie pas ici.</p>
       <div class="modal-actions"><button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (layer, close) => {
        $('#no', layer).onclick = close;
        $('#ok', layer).onclick = async () => {
          try {
            S = await api.saveDossier(dossier.id, {
              name: $('#f-name', layer).value.trim() || dossier.name,
              email: $('#f-email', layer).value.trim(),
              note: $('#f-note', layer).value,
              archived: $('#f-arch', layer).checked
            });
            close(); render(); toast('Fiche enregistrée.');
          } catch (e) { toast(e.message || String(e), 'error'); }
        };
      }
    );
  }

  // ---------- relances ----------
  function drawRelances(view) {
    const rows = K.dossierList(S).filter(r => r.missingCount > 0 || r.provisionalCount > 0);
    view.innerHTML = `
      <div class="page-head"><h1>Relances</h1></div>
      <p class="muted small mb">Un message qui nomme les mois manquants fait bouger ; « envoie-moi tes documents » non.
      SkanFact prépare le texte, ton logiciel de messagerie l'envoie.</p>
      ${rows.length ? `<div class="scroll-x"><table class="list">
        <thead><tr><th>Client</th><th>Email</th><th>Ce qui manque</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><span class="dot-lvl ${r.level === 'ok' ? '' : r.level}"></span>${esc(r.name)}</td>
          <td class="muted">${esc(r.email || '— à renseigner')}</td>
          <td>${r.missingCount
            ? esc(K.missingLabel(r.missingMonths))
            : `<span class="muted">${r.provisionalCount} mois non clôturé${r.provisionalCount > 1 ? 's' : ''}</span>`}</td>
          <td class="actions"><button class="btn btn-ghost btn-sm" data-fiche="${esc(r.id)}">Le dossier</button>
            <button class="btn btn-primary btn-sm" data-rel="${esc(r.id)}">Écrire</button></td></tr>`).join('')}</tbody></table></div>`
        : `<div class="todo-ok">Personne à relancer : tous tes dossiers sont à jour.</div>`}`;
    $$('[data-rel]', view).forEach(b => {
      b.onclick = () => {
        const r = K.dossierList(S).find(x => x.id === b.dataset.rel);
        if (r) writeRelance(r);
      };
    });
    $$('[data-fiche]', view).forEach(b => { b.onclick = () => { location.hash = '#/dossier/' + encodeURIComponent(b.dataset.fiche); }; });
  }

  function writeRelance(row) {
    const m = K.relanceMail(S.cabinet, row);
    modal(
      `<h2>Relancer ${esc(row.name)}</h2>
       <label class="field">Destinataire<input type="text" id="r-to" value="${esc(m.to)}" placeholder="adresse@client.tn"></label>
       <label class="field mt">Objet<input type="text" id="r-sub" value="${esc(m.subject)}"></label>
       <label class="field mt">Message<textarea id="r-body" rows="10">${esc(m.body)}</textarea></label>
       <p class="muted small mt">Le message s'ouvre dans ton logiciel de messagerie : rien ne part sans que tu cliques sur « Envoyer ».</p>
       <div class="modal-actions"><button class="btn" id="no">Annuler</button>
       <button class="btn" id="copy">Copier le texte</button>
       <button class="btn btn-primary" id="ok">Ouvrir dans ma messagerie</button></div>`,
      (layer, close) => {
        $('#no', layer).onclick = close;
        $('#copy', layer).onclick = async () => {
          try { await navigator.clipboard.writeText($('#r-body', layer).value); toast('Texte copié.'); }
          catch { toast('Copie impossible.', 'error'); }
        };
        $('#ok', layer).onclick = async () => {
          const to = $('#r-to', layer).value.trim();
          if (to && to !== row.email) { try { S = await api.saveDossier(row.id, { email: to }); } catch {} }
          await api.mail({ to, subject: $('#r-sub', layer).value, body: $('#r-body', layer).value });
          close(); render();
        };
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
          <label class="field span-2">Nom du cabinet<input type="text" id="c-name" value="${esc(c.name)}" placeholder="Cabinet Ben Salah"></label>
          <label class="field span-2">Email<input type="email" id="c-email" value="${esc(c.email)}" placeholder="contact@cabinet.tn"></label>
        </div>
        <p class="muted small mt">Ce nom apparaît en bas des relances que tu envoies et dans le fichier d'appairage remis à tes clients.</p>
        <div class="modal-actions"><button class="btn btn-primary" id="c-save">Enregistrer</button></div>
      </div>

      <div class="panel"><h2>Le fichier à remettre à tes clients</h2>
        <p class="small">Chaque client doit importer ce fichier une fois, dans <strong>Paramètres → Cabinet comptable</strong> de son SkanFact.
        À partir de là, les paquets qu'il fabrique sont chiffrés <strong>pour toi seul</strong> : personne d'autre ne peut les ouvrir,
        même en interceptant le mail, et il n'a plus aucun mot de passe à te communiquer.</p>
        <div class="mt"><div class="muted small">Empreinte de ton cabinet</div>
          <div class="fingerprint">${esc(c.fingerprint || '—')}</div></div>
        <p class="muted small mt">Cette empreinte identifie ton cabinet. Ton client la voit après l'import : s'il te la lit au téléphone
        et qu'elle correspond, c'est bien à toi qu'il envoie.</p>
        <div class="modal-actions"><button class="btn btn-primary" id="c-pair">Enregistrer le fichier d'appairage…</button></div>
      </div>

      <div class="panel"><h2>Sécurité</h2>
        <p class="small">Le fichier de ce cabinet est chiffré avec ton mot de passe (AES-256). Il contient la clé qui ouvre les paquets de
        tes clients : si ce poste est perdu ou volé, personne ne peut les lire.</p>
        <p class="small"><strong>Ta clé n'existe qu'ici.</strong> Ni nous, ni personne d'autre ne peut la reconstituer.
        Si tu changes d'ordinateur, copie le dossier de l'application au lieu de repartir de zéro — sinon tes clients devront
        réimporter un nouveau fichier d'appairage.</p>
        <p class="muted small">À VÉRIFIER avec ton assureur ou ton Ordre : la conservation des pièces de tes clients sur ce poste
        relève des mêmes obligations que tes archives papier.</p>
      </div>`;
    $('#c-save').onclick = async () => {
      try {
        S = await api.saveCabinet({ name: $('#c-name').value.trim(), email: $('#c-email').value.trim() });
        render(); toast('Réglages enregistrés.');
      } catch (e) { toast(e.message || String(e), 'error'); }
    };
    $('#c-pair').onclick = async () => {
      if (!(S.cabinet.name || '').trim()) return toast('Renseigne d\'abord le nom de ton cabinet.', 'error');
      try {
        const r = await api.exportPairing();
        if (r) {
          toast('Fichier enregistré.');
          const ok = await confirmDialog('Fichier d\'appairage créé',
            `<p>Envoie ce fichier à tes clients (par mail, il ne contient rien de secret).</p>
             <p class="muted small">${esc(r.path)}</p>`, 'Le montrer dans le dossier');
          if (ok) api.reveal(r.path);
        }
      } catch (e) { toast(e.message || String(e), 'error'); }
    };
  }

  // ---------- aide ----------
  function drawAide(view) {
    view.innerHTML = `
      <div class="page-head"><h1>Comment ça marche</h1></div>
      <div class="panel"><h2>En trois gestes</h2>
        <ol class="small" style="line-height:1.8">
          <li><strong>Une fois :</strong> renseigne ton cabinet dans Réglages, enregistre le fichier d'appairage
          (<code>.skanpair</code>) et envoie-le à chacun de tes clients.</li>
          <li><strong>Chaque mois :</strong> ton client clôture son mois puis t'envoie un paquet (<code>.skanpack</code>).
          Tu l'enregistres et tu cliques sur « Importer un paquet… ».</li>
          <li><strong>Le 10 :</strong> la page Dossiers te dit qui n'a rien envoyé. Un clic sur « Relancer » prépare le message.</li>
        </ol>
      </div>
      <div class="panel"><h2>Ce que contient un paquet</h2>
        <p class="small">La page de garde (un PDF qui résume le mois et liste ce qui manque), les journaux au format CSV
        (ventes, achats, encaissements, règlements fournisseurs, trésorerie), les factures et avoirs en PDF, les bulletins de paie,
        et les justificatifs que ton client a joints à ses achats.</p>
        <p class="small"><strong>Et surtout <code>journaux/ecritures.csv</code></strong> : les pièces du mois déjà transformées en écritures
        en partie double, à importer dans ton logiciel au lieu de les ressaisir. Si les numéros de compte ne sont pas les tiens,
        donne-les à ton client une fois : il les saisit dans son SkanFact et tous ses envois suivants sont à ton format.</p>
        <p class="small">Un <strong>manifeste</strong> porte l'empreinte de chaque fichier. À l'import, SkanFact les recalcule toutes :
        c'est ce qui te permet d'affirmer que ce que tu as reçu est exactement ce qui a été envoyé.</p>
      </div>
      <div class="panel"><h2>Définitif ou provisoire</h2>
        <p class="small">Un paquet n'est <strong>définitif</strong> que si le client a clôturé son mois : après une clôture, il ne peut plus
        ni modifier ni supprimer une pièce de cette période sans rouvrir le mois, avec un motif écrit.</p>
        <p class="small">Un paquet <strong>provisoire</strong> se lit, mais ses chiffres peuvent encore bouger. Si tu reçois deux fois le même
        mois, SkanFact te le dit — et te prévient si le remplacé était définitif.</p>
      </div>
      <div class="panel"><h2>Ce que cette application ne fait pas</h2>
        <p class="small">Elle <strong>ne modifie jamais</strong> la comptabilité de tes clients et ne leur renvoie rien.
        Une correction se demande au client, qui la saisit chez lui : sinon deux versions des mêmes comptes coexistent,
        et plus personne ne sait laquelle fait foi.</p>
        <p class="small">Elle ne dépose aucune déclaration et ne se connecte à aucune administration.</p>
      </div>`;
  }

  boot().catch(e => { $('#lock-sub').textContent = 'Erreur au démarrage : ' + (e.message || e); });
})();
