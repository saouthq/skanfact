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
  let inboxInfo = null;                  // la boîte de réception : dossier surveillé, paquets nouveaux
  let fermerPalette = null;              // de quoi refermer la palette quand une fenêtre s'ouvre au-dessus
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

  // Le menu d'actions d'une ligne vit dans `src/renderer/rowmenu.js`, chargé par les DEUX
  // applications. Cette app-ci alignait cinq boutons fantômes par ligne, dont un « ✕ » muet qui
  // supprime un paquet reçu : exactement le défaut corrigé côté entreprise en 7.28.0, et jamais
  // porté ici. Une règle apprise d'un côté se vérifie de l'autre (règle 7.3.0).
  const rowMenuCell = RowMenu.cellule;
  const bindRowMenus = RowMenu.brancherMenus;

  // Une erreur venue du processus principal arrive habillée en « Error invoking remote method '…' ».
  // On ne montre que la phrase écrite pour l'utilisateur.
  // Windows est une cible de construction : l'application parlait pourtant de « ce Mac », du
  // « Finder » et de « Time Machine » à un comptable tunisien qui l'aura très probablement installée
  // sur Windows. `upd.app.platform` arrive au démarrage ; avant, on reste neutre.
  const surMac = () => !upd.app || upd.app.platform === 'darwin';
  const CE_POSTE = () => (surMac() ? 'ce Mac' : 'cet ordinateur');
  const EXPLORATEUR = () => (surMac() ? 'le Finder' : 'l\'Explorateur');

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

  // Un refus MONTRE le champ. L'app entreprise a `refus()` depuis la 7.0.0 ; celle-ci n'en avait
  // aucun équivalent — zéro occurrence — et un jour de dépôt hors bornes était écarté en silence
  // par le processus principal pendant que l'écran affichait « ✓ enregistré » en vert et gardait la
  // valeur refusée sous les yeux.
  function refus(sel, message) {
    toast(message, 'error');
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return false;
    // Depuis que les Réglages ont des onglets, un champ refusé peut être dans un onglet masqué :
    // on l'amène à l'écran d'abord, sinon le message accuse un champ que personne ne voit.
    const sec = el.closest('[data-pane]');
    if (sec && sec.hidden) { const b = $(`#set-tabs button[data-tab="${sec.dataset.pane}"]`); if (b) b.click(); }
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { }
    try { el.focus({ preventScroll: true }); } catch (_) { }
    const marque = el.closest('.field') || el;
    marque.classList.add('champ-faute');
    const nettoyer = () => marque.classList.remove('champ-faute');
    marque.addEventListener('input', nettoyer, { once: true });
    marque.addEventListener('change', nettoyer, { once: true });
    setTimeout(nettoyer, 6000);
    return false;
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
  // `opts.garde` : une fonction qui répond « oui, il y a de la saisie non enregistrée ». Échap et le
  // clic à côté posent alors la question au lieu de jeter le travail en silence.
  function modal(html, onMount, onDismiss, opts) {
    // Une fenêtre s'ouvre TOUJOURS au-dessus de la palette (400 contre 60). `palettePossible()` ne
    // garde qu'un sens : il empêche la palette de passer sous une fenêtre, jamais une fenêtre de
    // passer au-dessus d'elle. Or le menu reste actif pendant que la palette est ouverte (Cmd+O,
    // Cmd+N, Cmd+S), et un paquet double-cliqué dans le Finder ouvre lui aussi une fenêtre. La
    // palette écoute le clavier en phase de CAPTURE : restée dessous, elle passerait devant, Échap
    // la fermerait sans rien montrer et Entrée lancerait une recherche au lieu de valider. C'est le
    // même défaut pris par l'autre bout — on la referme.
    if (fermerPalette) fermerPalette();
    const root = $('#modal-root');
    const layer = document.createElement('div');
    layer.className = 'modal-bg';
    // 400 et au-dessus : une question doit couvrir TOUT le reste, y compris l'assistant de première
    // utilisation (250) et l'écran de verrouillage (200). C'est la règle de la 5.2.2 côté entreprise.
    layer.style.zIndex = String(400 + root.children.length);
    layer.innerHTML = `<div class="modal">${html}</div>`;
    root.appendChild(layer);
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      layer.remove();
      document.removeEventListener('keydown', onKey);
    };
    let question = false;   // une seule question à la fois, sinon Échap répété les empile
    const dismiss = async () => {
      if (done || question) return;
      const garde = opts && opts.garde;
      if (garde && garde()) {
        question = true;
        const jeter = await confirmDialog(
          'Abandonner cette saisie ?',
          '<p>Ce que tu viens de taper ne sera pas enregistré.</p>',
          'Abandonner', true
        );
        question = false;
        if (!jeter) return;
      }
      if (done) return;
      const f = onDismiss; close(); if (f) f();
    };
    // Échap ne ferme QUE la fenêtre du dessus. Chaque fenêtre posait son écouteur sur `document`,
    // et `stopPropagation` n'arrête pas les autres écouteurs du MÊME nœud (il faudrait
    // `stopImmediatePropagation`) : deux fenêtres ouvertes, un Échap, les deux disparaissaient.
    // Le comptable remplissait une fiche, cliquait « Supprimer… » par erreur, faisait Échap pour
    // annuler — et perdait la question ET les huit champs qu'il venait de taper.
    const onKey = e => {
      if (done || layer !== root.lastElementChild) return;
      if (e.key === 'Escape') { e.stopPropagation(); dismiss(); }
    };
    document.addEventListener('keydown', onKey);
    layer.addEventListener('mousedown', e => { if (e.target === layer) dismiss(); });
    // Entrée valide, comme dans l'app entreprise depuis la 1.8.0. Sans ça, sur « Fichier créé ·
    // Le montrer dans le dossier », le réflexe « Entrée = oui » répondait « Annuler ».
    layer.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
      const principal = $('.modal-actions .btn-primary, .modal-actions .btn-danger', layer);
      if (principal && !principal.disabled) { e.preventDefault(); principal.click(); }
    });
    if (onMount) onMount(layer, close);
    // Le focus va au premier champ de SAISIE. Il allait au premier `input, select, textarea,
    // button` : dans une confirmation, qui n'a pas de champ, c'était le bouton « Annuler ».
    const saisie = layer.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
    const principal = $('.modal-actions .btn-primary, .modal-actions .btn-danger', layer);
    const cible = saisie || (principal && !principal.disabled ? principal : null);
    if (cible) cible.focus();
    return close;
  }

  // Un instantané des champs au moment où la fenêtre s'ouvre. Il sert à répondre à une seule
  // question : « est-ce qu'il a tapé quelque chose ? ». Sans lui, Échap jetait huit champs sans un
  // mot — et un comptable qui perd une saisie deux fois n'ouvre plus jamais ce formulaire sereinement.
  function suivreSaisie(layer) {
    const lire = () => JSON.stringify([...layer.querySelectorAll('input:not([type=hidden]), textarea, select')]
      .map(c => (c.type === 'checkbox' || c.type === 'radio' ? String(c.checked) : c.value)));
    const depart = lire();
    return () => lire() !== depart;
  }

  // Une promesse posée par une boîte de dialogue DOIT toujours se résoudre : Échap et le clic à côté
  // valent « Annuler ». Une promesse en suspens bloque son appelant pour toujours, sans erreur.
  // `cancelLabel` : « Annuler » est juste pour un geste qu'on renonce à faire, et FAUX pour une
  // question posée après coup — « tu viens d'importer, mets ta clé à l'abri » n'annule rien, elle
  // se remet à plus tard. Un bouton qui nomme mal ce qu'il fait se clique sans être lu.
  function confirmDialog(title, body, okLabel, danger, cancelLabel) {
    return new Promise(resolve => {
      modal(
        `<h2>${esc(title)}</h2><div>${body}</div>
         <div class="modal-actions"><button class="btn" id="no">${esc(cancelLabel || 'Annuler')}</button>
         <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="ok">${esc(okLabel || 'Continuer')}</button></div>`,
        (layer, close) => {
          $('#no', layer).onclick = () => { close(); resolve(false); };
          $('#ok', layer).onclick = () => { close(); resolve(true); };
        },
        () => resolve(false)
      );
    });
  }

  // Un compte rendu qu'on ferme, sans question. Il porte souvent plusieurs lignes et des chiffres
  // qu'on relit : `pre-wrap` garde les retours et l'alignement, là où un `<p>` collerait tout.
  function infoDialog(title, body, okLabel) {
    return new Promise(resolve => {
      modal(
        `<h2>${esc(title)}</h2><div style="white-space:pre-wrap">${esc(body)}</div>
         <div class="modal-actions"><button class="btn btn-primary" id="ok">${esc(okLabel || 'Fermer')}</button></div>`,
        (layer, close) => { $('#ok', layer).onclick = () => { close(); resolve(true); }; },
        () => resolve(true)
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
  // Recopié de core.js en 1.0.0 — en perdant le signe. Un mois d'avoirs (chiffre d'affaires négatif)
  // s'affichait donc comme un bon mois, et les lignes ne faisaient plus le total.
  const money = (n, cur) => {
    if (n == null || n === '') return '—';
    const v = Number(n);
    if (!isFinite(v)) return '—';
    const dec = dinar(cur) ? 3 : 2;
    const corps = Math.abs(v).toFixed(dec).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (v < 0 ? '−' : '') + corps + ' ' + (cur || 'DT');
  };
  // Une virgule décimale, comme les montants juste à côté : « 2.4 Mo » dans un tableau où tout le
  // reste s'écrit « 46 800,000 DT » se voit tout de suite.
  const fmtBytes = n => !n ? '—' : n >= 1073741824 ? (n / 1073741824).toFixed(1).replace('.', ',') + ' Go'
    : n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';
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
  // Des JOURS DE CALENDRIER, pas des tranches de 24 h. « 11/09/2026 (aujourd'hui) » affiché le 12 au
  // matin : la cellule se contredisait elle-même.
  // Quand une vérification a eu lieu, écrit comme on le dirait. Une date seule oblige à la comparer
  // mentalement à aujourd'hui ; ce qu'on veut savoir, c'est si c'est récent.
  function quandVerif(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    const p = x => String(x).padStart(2, '0');
    const heure = `${p(d.getHours())}:${p(d.getMinutes())}`;
    const mn = Math.floor((Date.now() - ms) / 60000);
    if (mn < 1) return 'à l\'instant';
    if (mn < 60) return 'il y a ' + pl(mn, 'minute');
    const jour = x => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
    const j = Math.round((jour(new Date()) - jour(d)) / 86400000);
    if (j <= 0) return `aujourd'hui à ${heure}`;
    if (j === 1) return `hier à ${heure}`;
    return `le ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${heure}`;
  }

  function ago(ms) {
    if (!ms) return '';
    const jour = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const j = Math.round((jour(new Date()) - jour(new Date(ms))) / 86400000);
    return j <= 0 ? "aujourd'hui" : j === 1 ? 'hier' : `il y a ${j} jours`;
  }

  // ---------- listes : tri et pagination ----------
  // À soixante dossiers, une liste sans tri ni pages devient un mur. Les totaux et les exports
  // portent toujours sur la SÉLECTION ENTIÈRE, jamais sur la page affichée (règle de la 2.2.0).
  function sortHead(label, key, help) {
    const on = listState.sort === key;
    // `sortable-h` : c'est le nom que connaît la feuille partagée. Avec `sortable`, l'en-tête n'avait
    // ni curseur, ni survol, ni flèche lisible — rien ne disait qu'on pouvait cliquer.
    return `<th class="nw sortable-h${on ? ' sorted' : ''}" data-sort="${esc(key)}" title="Trier">${esc(label)}${help ? ' ' + info(help) : ''}<span class="sort-ar">${on ? (listState.desc ? '↓' : '↑') : '⇅'}</span></th>`;
  }
  function bindSort(root, redraw) {
    $$('th.sortable-h', root).forEach(th => {
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

  // Une seule porte : `K.toCsvLine`. Cet écran avait sa propre version, qui n'échappait que
  // `" ; \n` — donc sans la parade à l'injection de formule (9.1.1), et sans qu'on puisse le voir
  // en relisant l'autre. Un export du portefeuille porte les noms et les matricules de soixante
  // clients : c'est exactement du texte venu de l'extérieur.
  // Point-virgule : c'est le séparateur qu'attend Excel dans une configuration française.
  function toCsv(cols, rows) {
    return [K.toCsvLine(cols.map(c => c.label))]
      .concat(rows.map(r => K.toCsvLine(cols.map(c => c.get(r))))).join('\r\n');
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
    // Le pire des cas : plus de fichier de données, mais des sauvegardes. Sans ce message, l'écran
    // dit « Bienvenue, choisis un mot de passe » — exactement comme au premier jour — et le
    // comptable croit avoir tout perdu alors que tout est là, à côté.
    const aRecuperer = !st.exists && st.backups > 0;
    if (aRecuperer) {
      $('#lock-err').innerHTML = `Le fichier principal de ce cabinet a disparu, mais <b>${st.backups === 1 ? 'une sauvegarde est là' : `${st.backups} sauvegardes sont là`}</b>.
        Choisis un mot de passe pour rouvrir l'application : elle te proposera aussitôt de restaurer.
        <br>Si tu connais ton ancien mot de passe, reprends-le : les sauvegardes sont chiffrées avec lui.`;
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
    // Le seul chemin de sortie pour qui change d'ordinateur. Proposé dans les DEUX cas : on y arrive
    // aussi après avoir créé un cabinet neuf par erreur, et c'est même le cas le plus fréquent.
    $('#lock-move').onclick = repriseDialog;

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
        start(r.created, r.reorganized, aRecuperer);
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

  // ---------- reprendre un cabinet venu d'un autre ordinateur ----------
  //
  // Le comptable qui change de poste a TOUT sur sa clé USB — et, jusqu'ici, aucun bouton pour le
  // dire. L'application lui répondait « Bienvenue », lui fabriquait une clé neuve, et les paquets que
  // ses clients enverraient ensuite étaient refusés : « adressé à un autre cabinet ». La question se
  // pose donc ici, sur l'écran de mot de passe, avant toute création de clé.
  let repriseParCle = false;             // « je n'ai que ma clé de secours » : à faire dès l'ouverture

  function repriseDialog() {
    modal(
      `<h2>${lbl('Reprendre un cabinet existant', 'b.reprise')}</h2>
       <p class="small">Tu changes d'ordinateur, ou tu réinstalles l'application ? <strong>Ne crée pas un cabinet neuf.</strong>
       Il aurait une autre empreinte, et les paquets que tes clients t'enverraient ensuite seraient refusés : « adressé à un autre cabinet ».</p>
       <div class="reprise-list">
         <div class="reprise-row"><div><strong>J'ai mon dossier de copie</strong>
           <div class="muted small">La clé USB, le disque externe ou le dossier iCloud choisi dans Réglages. Il s'appelle
           <code>SkanFact Cabinet</code> et contient aussi <strong>tes paquets</strong> : c'est celui qu'il faut préférer.</div></div>
           <button class="btn btn-primary" id="rp-dir">Choisir le dossier…</button></div>
         <div class="reprise-row"><div><strong>J'ai le fichier de mon cabinet</strong>
           <div class="muted small"><code>cabinet-data.json</code>, ou une sauvegarde du dossier <code>sauvegardes</code>.
           Tes dossiers et ta clé reviennent ; les paquets déjà reçus, non.</div></div>
           <button class="btn" id="rp-file">Choisir le fichier…</button></div>
         <div class="reprise-row"><div><strong>Je n'ai que ma clé de secours</strong>
           <div class="muted small">Le fichier <code>.skanrecover</code>. Il rend ta clé — donc ton empreinte, donc tes clients —
           mais ni tes dossiers ni tes paquets.</div></div>
           <button class="btn" id="rp-key">Faire comme ça</button></div>
       </div>
       <div class="modal-actions"><span class="grow"></span><button class="btn" id="rp-no">Annuler</button></div>`,
      (layer, close) => {
        $('#rp-no', layer).onclick = close;
        $('#rp-dir', layer).onclick = () => { close(); repriseChoisir('dossier'); };
        $('#rp-file', layer).onclick = () => { close(); repriseChoisir('fichier'); };
        $('#rp-key', layer).onclick = () => {
          close();
          // Une clé de secours ne se restaure qu'une fois un cabinet ouvert : on crée donc d'abord, et
          // `start()` réclame le fichier aussitôt après. Le dire maintenant évite de croire qu'on
          // s'est trompé de bouton.
          repriseParCle = true;
          confirmDialog('Avec la clé de secours',
            `<p>Une clé de secours ne contient <strong>que la clé</strong> du cabinet : ni tes dossiers, ni tes paquets.</p>
             <p class="small">Choisis un mot de passe pour ce poste, puis l'application te demandera tout de suite ton fichier
             <code>.skanrecover</code>. Ton empreinte redeviendra la même : tes clients n'auront rien à refaire.</p>`,
            'J\'ai compris');
        };
      }
    );
  }

  async function repriseChoisir(mode) {
    let vu;
    try { vu = await api.pickRecover(mode); }
    catch (e) { return toast(plainError(e), 'error'); }
    if (!vu) return;                                    // fenêtre annulée
    const trouve = [];
    if (vu.base) trouve.push('le fichier du cabinet');
    if (vu.backups) trouve.push(pl(vu.backups, 'sauvegarde'));
    if (vu.packs) trouve.push(`${pl(vu.packs, 'paquet')} (${fmtBytes(vu.bytes)})`);
    modal(
      `<h2>Reprendre ce cabinet</h2>
       <p class="path">${esc(vu.path)}</p>
       <div class="kv mt"><div><span>On y trouve</span><span>${esc(trouve.join(' · ') || 'une sauvegarde')}</span></div></div>
       ${vu.packs ? '' : `<div class="warn-box mt">Aucun paquet là-dedans : tes dossiers et ta clé reviendront, pas les pièces déjà reçues.
         Si tu as le dossier <code>paquets</code> ailleurs, recopie-le ensuite dans le dossier de l'application
         (Réglages → Données et sécurité → Sauvegardes, « Ouvrir le dossier ») : elles seront retrouvées à l'ouverture suivante.</div>`}
       <label class="field mt">Le mot de passe de ce cabinet<span class="pw-wrap">
         <input type="password" id="rp-pw" autocomplete="current-password"><button type="button" class="pw-eye" id="rp-eye">Afficher</button></span></label>
       <p class="muted small">Celui de l'autre ordinateur : c'est lui qui chiffre ce fichier, il n'a pas changé.</p>
       <div class="modal-actions"><button class="btn" id="rp-no">Annuler</button><button class="btn btn-primary" id="rp-go">Reprendre ce cabinet</button></div>`,
      (layer, close) => {
        const pw = $('#rp-pw', layer), go = $('#rp-go', layer);
        $('#rp-eye', layer).onclick = () => {
          pw.type = pw.type === 'password' ? 'text' : 'password';
          $('#rp-eye', layer).textContent = pw.type === 'password' ? 'Afficher' : 'Masquer';
          pw.focus();
        };
        $('#rp-no', layer).onclick = close;
        pw.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } };
        go.onclick = async () => {
          if (!pw.value) return toast('Entre le mot de passe de ce cabinet.', 'error');
          go.disabled = true; go.textContent = 'Reprise…';
          let r;
          try { r = await api.adopt(vu.path, pw.value); }
          catch (e) {
            go.disabled = false; go.textContent = 'Reprendre ce cabinet';
            pw.select();
            return toast(plainError(e), 'error');
          }
          close();
          S = r.state;
          $('#lock-screen').remove();
          $('#app').hidden = false;
          start(false, r.reorganized, false);
          const ok = await confirmDialog('Cabinet repris',
            `<div class="kv"><div><span>Dossiers</span><span>${r.repris.dossiers}</span></div>
             <div><span>Paquets repris</span><span>${r.repris.paquets}</span></div>
             <div><span>Sauvegardes</span><span>${r.repris.sauvegardes}</span></div>
             <div><span>Empreinte</span><span class="fingerprint">${esc(S.cabinet.fingerprint || '—')}</span></div></div>
             <p class="small mt">Vérifie cette empreinte : c'est celle que tes clients connaissent. Si elle a changé, tu as repris le mauvais fichier.</p>
             <div class="warn-box mt">Ce poste-ci n'a encore <strong>aucune copie de sauvegarde</strong> : celle de l'autre ordinateur
             désignait un support branché là-bas. Choisis-en une maintenant — « plus tard » est exactement le moment où l'on oublie.</div>`,
            'Choisir un dossier de copie…');
          if (ok) {
            try { await api.pickExternal(); refreshBackupInfo(); }
            catch (e) { toast(plainError(e), 'error'); }
          }
        };
      }
    );
  }

  function start(created, reorganized, aRecuperer) {
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
    // L'avancement d'un import : la fenêtre s'ouvre au premier signal reçu, que les fichiers aient
    // été choisis ici (glisser-déposer, boîte de réception) ou dans la fenêtre du système.
    api.onImportProgress(suivreImport);
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
    $('#upd-pill').onclick = () => versReglages('pan-maj');
    if (!location.hash) location.hash = '#/dossiers';
    render();
    refreshBackupInfo();
    refreshInbox(true);
    // L'état de la clé de secours arrive par une promesse : sans ce redessin, le bandeau et la ligne
    // « À faire » n'apparaîtraient qu'au prochain changement de page.
    chargerRecovery(true);
    // Le comptable enregistre ses pièces jointes dans sa messagerie, puis revient ici : c'est le
    // moment exact où il faut regarder la boîte. Sans ça, il faudrait redémarrer l'application pour
    // voir arriver ce qu'on vient d'y déposer.
    let dernierCoupDOeil = 0;
    window.addEventListener('focus', () => {
      const t = Date.now();
      if (t - dernierCoupDOeil < 4000) return;      // revenir deux fois de suite ne relance pas deux scans
      dernierCoupDOeil = t;
      const avant = inboxInfo && inboxInfo.nouveaux ? inboxInfo.nouveaux.length : 0;
      refreshInbox(false).then(() => {
        const apres = inboxInfo && inboxInfo.nouveaux ? inboxInfo.nouveaux.length : 0;
        // On ne redessine que si quelque chose a changé : redessiner sous les doigts de quelqu'un
        // qui revient à sa fenêtre lui ferait perdre sa saisie en cours.
        if (apres !== avant && !$('#modal-root').children.length && !$('#palette-root')) render();
      });
    });
    if (reorganized && (reorganized.moved || reorganized.recovered)) {
      const dits = [];
      if (reorganized.moved) dits.push(`${pl(reorganized.moved, 'paquet')} rangé${reorganized.moved > 1 ? 's' : ''} par client et par année`);
      // Un paquet repris d'un autre poste porte le chemin de cet autre poste : on l'a retrouvé sur ce
      // disque-ci. Le dire vaut mieux que de le compter perdu en silence.
      if (reorganized.recovered) dits.push(`${pl(reorganized.recovered, 'paquet')} retrouvé${reorganized.recovered > 1 ? 's' : ''} sur ce poste`);
      toast(dits.join(' · ') + '.');
    }
    // Un cabinet qui vient de perdre son fichier ne veut pas d'un assistant de bienvenue : il veut
    // ses données. On l'emmène directement là où elles sont.
    if (aRecuperer) {
      // Par la même porte que tout le reste : elle ouvre l'onglet AVANT d'amener le panneau. Un
      // scrollIntoView écrit à la main ici ferait défiler vers un panneau resté masqué.
      versReglages('pan-backup');
      setTimeout(() => toast('Choisis la sauvegarde à restaurer.', 'error'), 600);
      return;
    }
    // « Je n'ai que ma clé de secours » : le cabinet qu'on vient de créer est neuf, il lui manque la
    // clé qui ouvre les paquets déjà reçus — et qui fait que les clients n'ont rien à refaire. On la
    // demande tout de suite : c'est le seul moment où l'on est sûr qu'il l'a sous la main.
    if (created && repriseParCle) {
      repriseParCle = false;
      importRecovery().then(() => { if (!(S.cabinet.name || '').trim()) runSetup(); });
      return;
    }
    // Premier lancement : l'assistant, pas un formulaire de réglages et un message passager.
    if (created || !(S.cabinet.name || '').trim()) runSetup();
  }

  async function refresh() { S = await api.state(); }
  async function refreshBackupInfo() {
    try { backupInfo = await api.backups(); } catch { backupInfo = null; }
    if (location.hash.startsWith('#/reglages')) drawBackupPanels();
  }

  // La boîte de réception : le dossier où le comptable range les paquets reçus par mail. On regarde,
  // on propose, on n'importe jamais tout seul.
  async function refreshInbox(redraw) {
    try { inboxInfo = await api.inbox(); } catch { inboxInfo = null; }
    if (redraw) render();
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
  //
  // Vingt paquets de cinquante mégaoctets, c'est une vingtaine de secondes. Sans un mot à l'écran,
  // on croit l'application morte — et on la tue en plein rangement. On montre donc où on en est, et
  // on laisse arrêter : l'arrêt prend effet APRÈS le paquet en cours, jamais au milieu.
  //
  // La fenêtre s'ouvre tout de suite s'il y a plusieurs paquets, et seulement après une demi-seconde
  // s'il n'y en a qu'un : un petit paquet part et revient en un clin d'œil, et une fenêtre qui
  // clignote pour rien fait douter de tout le reste.
  // `importEnCours` dit si un import est vraiment en train de tourner. Sans lui, le DERNIER message
  // d'avancement — envoyé par le processus principal juste après le dernier paquet — pouvait arriver
  // APRÈS la fermeture de la fenêtre et la rouvrir pour toujours, par-dessus le compte rendu : le
  // bouton « Fermer » restait visible et parfaitement inerte, recouvert par une fenêtre qui
  // annonçait un travail déjà fini.
  let importUI = null, importTimer = null, importDernier = null, importEnCours = false;

  function importProgress() {
    const etat = { annule: false, close: null, maj: () => {} };
    const stop = layer => {
      if (etat.annule) return;
      etat.annule = true;
      api.cancelImport();
      const b = $('#ip-stop', layer), t = $('#ip-txt', layer);
      if (b) b.disabled = true;
      if (t) t.textContent = 'Arrêt demandé — on termine le paquet en cours, puis on s\'arrête.';
    };
    etat.close = modal(
      `<h2>Rangement des paquets ${info('p.arret')}</h2>
       <p id="ip-txt">Ouverture du premier paquet…</p>
       <div class="progress"><div id="ip-bar" style="width:0%"></div></div>
       <p class="muted small mt">Chaque paquet est ouvert, vérifié pièce par pièce, puis copié dans le dossier de l'application. Un gros mois prend une seconde ou deux.</p>
       <div class="modal-actions"><span class="grow"></span><button class="btn" id="ip-stop">Arrêter</button></div>`,
      (layer) => { $('#ip-stop', layer).onclick = () => stop(layer); },
      // Échap et le clic à côté valent « Arrêter », pas « rien » : une fenêtre d'avancement qui
      // disparaît pendant que le travail continue laisserait le comptable devant une application
      // muette, exactement ce qu'on est en train de corriger.
      () => { etat.annule = true; api.cancelImport(); }
    );
    etat.maj = p => {
      if (etat.annule) return;                 // on n'écrase pas « Arrêt demandé… »
      const t = $('#ip-txt'), b = $('#ip-bar');
      const total = Math.max(1, p.total || 1);
      if (t) t.textContent = `Paquet ${p.numero || 1} sur ${total}${p.nom ? ' — ' + p.nom : ''}`;
      if (b) b.style.width = Math.round(((p.faits || 0) / total) * 100) + '%';
    };
    return etat;
  }

  function ouvrirImport() {
    importTimer = null;
    if (!importUI) importUI = importProgress();
    if (importDernier) importUI.maj(importDernier);
  }

  function suivreImport(p) {
    if (!importEnCours) return;              // message en retard : l'import est déjà fini
    importDernier = p;
    if (importUI) return importUI.maj(p);
    if (importTimer) return;
    if (p.total > 1) ouvrirImport(); else importTimer = setTimeout(ouvrirImport, 500);
  }

  function fermerImport() {
    importEnCours = false;
    clearTimeout(importTimer);
    importTimer = null;
    importDernier = null;
    if (importUI) { importUI.close(); importUI = null; }
  }

  async function doImport(paths) {
    // Un seul chemin vers l'import : la fenêtre d'avancement s'ouvre au premier signal et se referme
    // ici, que l'import ait réussi, échoué ou été arrêté.
    const ranger = async opts => {
      importEnCours = true;
      try { return await api.importPack(opts); } finally { fermerImport(); }
    };
    let r;
    try { r = await ranger({ paths }); }
    catch (e) { return toast(plainError(e), 'error'); }
    if (!r) return;                                     // fenêtre annulée
    S = r.state;

    // Un paquet protégé par mot de passe : on le redemande une fois, pour ces fichiers-là seulement.
    const locked = r.results.filter(x => x.error && /mot de passe/i.test(x.error));
    if (locked.length) {
      const pw = await askPassword('Paquet protégé', `${pl(locked.length, 'paquet')} ${locked.length > 1 ? 'sont scellés' : 'est scellé'} par un mot de passe. Demande-le à ton client s'il ne te l'a pas donné.`);
      if (pw) {
        try {
          const r2 = await ranger({ paths: locked.map(x => x.file), password: pw });
          if (r2) {
            S = r2.state;
            r = { results: r.results.filter(x => !locked.includes(x)).concat(r2.results), state: r2.state, demoRemoved: r.demoRemoved || r2.demoRemoved, restants: (r.restants || 0) + (r2.restants || 0) };
          }
        } catch (e) { toast(plainError(e), 'error'); }
      }
    }
    const rapportLu = showImportReport(r.results, r.demoRemoved, r.restants || 0);
    render();
    // La clé de secours, réclamée AU PREMIER IMPORT (9.1.0). Elle était criée en rouge sur la page
    // Réglages depuis la 6.8.0, mais rien n'empêchait d'importer soixante paquets avant de
    // l'exporter — et sans elle, un poste perdu rend illisible POUR TOUJOURS tout ce qui a été
    // reçu. **Un filet se réclame au moment où il protège encore**, c'est-à-dire à la seconde où
    // il y a quelque chose à perdre : le premier paquet rangé sur ce poste.
    //
    // Une seule fois, et jamais bloquant : « Plus tard » existe, l'import est déjà fait. Une
    // question à chaque import ne se lirait plus au troisième (règle du droit à l'erreur, 7.12.0).
    if (recoveryAt === null && r.results.some(x => !x.error) && !cleReclameeCetteSession) {
      cleReclameeCetteSession = true;
      await rapportLu;                 // on ne parle pas par-dessus le rapport qu'il est en train de lire
      const ok = await confirmDialog('Mets ta clé de secours à l\'abri',
        '<p>Tu viens de ranger ton premier paquet. À partir de maintenant, <strong>tu as quelque chose à perdre</strong>.</p>' +
        '<p class="small">Les paquets de tes clients sont chiffrés avec la clé de ce cabinet. Si cet ordinateur tombe en panne ou est volé et que tu n\'as pas sa clé ailleurs, <strong>tout ce que tu as reçu devient illisible pour toujours</strong> — les sauvegardes comprises.</p>' +
        '<p class="small">La clé de secours est un petit fichier. Mets-le sur une clé USB ou dans un coffre, pas à côté de l\'ordinateur.</p>',
        'Exporter ma clé de secours', false, 'Plus tard');
      if (ok) exportRecovery(() => chargerRecovery(true));
    }
    refreshBackupInfo();
    refreshInbox(true);
    // (La boîte de réception est déjà surveillée depuis start() : y reposer un écouteur ici en
    // ajouterait un par import — vingt imports, vingt scans à chaque retour dans la fenêtre.)
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
    // Un fichier que le manifeste n'annonce pas n'a été comparé à rien : il ne compte pas parmi les
    // pièces vérifiées, et il se dit à part — sinon le paquet aurait l'air entièrement contrôlé.
    const trop = (integ.intrus || []).length;
    if (trop) bits.push(`⚠ ${pl(trop, 'fichier')} ${trop > 1 ? 'présents' : 'présent'} mais non ${trop > 1 ? 'annoncés' : 'annoncé'} par ton client`);
    // Un fichier présent dans le paquet sans être annoncé au manifeste : il ne se compare à rien,
    // mais sa présence se dit — c'est la seule chose honnête à en faire.
    const nonDits = (integ.intrus || []).length;
    if (nonDits) bits.push(`⚠ ${pl(nonDits, 'fichier')} ${nonDits > 1 ? 'non annoncés' : 'non annoncé'} au manifeste`);
    const miss = (x.summary && x.summary.missing || []).reduce((s, m) => s + (m.count || 0), 0);
    if (miss) bits.push(`${pl(miss, 'point')} ${miss > 1 ? 'signalés' : 'signalé'} par le client`);
    return `<li><strong>✓ ${esc(d.name || '')}</strong> — ${esc((x.summary && x.summary.label) || x.month || '')}
            <div class="imp-sub">${bits.map(esc).join(' · ')}</div></li>`;
  }

  // Rend une promesse résolue à la FERMETURE du rapport. Sans elle, une question posée juste après
  // s'empile PAR-DESSUS lui : le comptable voit une fenêtre qui en cache une autre, et ne lit ni
  // l'une ni l'autre. C'est le défaut de la 5.2.2 (l'ordre des couches) vu à l'envers — ici les
  // deux fenêtres sont légitimes, c'est leur ENCHAÎNEMENT qui manquait.
  function showImportReport(results, demoRemoved, restants) {
    let fini;
    const attendue = new Promise(res => { fini = res; });
    const ok = results.filter(x => !x.error).length;
    const ko = results.length - ok;
    // Un import arrêté n'est pas un import raté : ce qui est rangé l'est pour de bon, et le reste
    // attend sagement là où il était.
    const arret = restants > 0
      ? `<p class="small mt">Import arrêté : ${pl(restants, 'paquet')} ${restants > 1 ? 'n\'ont pas été ouverts' : 'n\'a pas été ouvert'}. Redépose-les quand tu veux, rien n'est perdu.</p>`
      : '';
    // Le bon moment pour accuser réception, c'est maintenant — pas en retournant fiche par fiche.
    const aPrevenir = results.filter(x => !x.error && x.dossier && !x.dossier.demo);
    modal(
      `<h2>${ok ? `${pl(ok, 'paquet')} ${ok > 1 ? 'rangés' : 'rangé'}` : 'Aucun paquet rangé'}${ko ? ` · ${pl(ko, 'refusé')}` : ''}</h2>
       <ul class="imp-list">${results.map(importLine).join('')}</ul>
       ${arret}
       ${demoRemoved ? '<p class="small mt">Les dossiers d\'exemple ont été effacés : place aux vrais.</p>' : ''}
       <p class="muted small mt">Les paquets sont copiés dans le dossier de l'application, rangés par client et par année : le fichier d'origine reste où il est.</p>
       <div class="modal-actions">
         ${aPrevenir.length ? `<button class="btn" id="acc-all">Prévenir ${aPrevenir.length > 1 ? 'les clients' : 'le client'}…</button>` : ''}
         <span class="grow"></span><button class="btn btn-primary" id="ok">Fermer</button></div>`,
      (layer, close) => {
        $('#ok', layer).onclick = () => { close(); fini(); };
        const a = $('#acc-all', layer);
        if (a) a.onclick = () => {
          close(); fini();
          const file = aPrevenir.slice();
          const suivant = () => {
            const x = file.shift();
            if (!x) return;
            const d = (S.dossiers || []).find(y => y.id === x.dossier.id);
            if (d) accuseReception(d, x.summary, suivant); else suivant();
          };
          suivant();
        };
      },
      // Échap et le clic à côté ferment aussi : une promesse posée par une fenêtre doit TOUJOURS
      // se résoudre, sinon la question suivante n'arrive jamais et rien ne le dit (règle 5.2.2).
      () => fini()
    );
    return attendue;
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
    if (route === 'dossier') drawDossier(view, arg, hash.split('/')[2]);
    else if (route === 'ecritures') drawEcritures(view);
    else if (route === 'echeances') drawEcheances(view);
    else if (route === 'relances') drawRelances(view);
    else if (route === 'reglages') drawReglages(view);
    else if (route === 'aide') drawAide(view, arg);
    else drawDossiers(view);
  }

  // Chaque ligne de « À faire » mène QUELQUE PART, et pas toutes au même endroit. Les cinq lignes
  // portaient le même lien en dur vers les Relances : « une échéance approche » y envoyait aussi,
  // alors que sa page est Échéances. C'est le défaut des treize boutons morts de l'app entreprise
  // (7.0.0), en plus discret — ici le bouton marche, il se trompe juste de page.
  //
  // Un test confronte les identifiants que `cabinetTodo` peut produire aux clés de cette table :
  // une ligne ajoutée demain sans son action fait tomber le test, pas l'utilisateur.
  const TODO_ACTIONS = {
    'cle-secours': { texte: 'Enregistrer ma clé…', run: () => versReglages('pan-secu') },
    'jour-de-relance': { texte: 'Voir', run: () => { location.hash = '#/relances'; } },
    'echeance': { texte: 'Voir', run: () => { location.hash = '#/echeances'; } },
    'manquants': { texte: 'Voir', run: () => { location.hash = '#/relances'; } },
    'provisoires': { texte: 'Voir', run: () => { location.hash = '#/relances'; } },
    'pieces': { texte: 'Voir', run: () => { location.hash = '#/dossiers'; } }
  };
  // Ouvrir les Réglages SUR un panneau : on pose l'onglet et la cible avant de naviguer, et on
  // redessine quand on y est déjà (sinon aucun `hashchange` n'a lieu et le clic paraît inerte —
  // piège 7.15.0).
  function versReglages(panneau) {
    const p = REG_PANNEAUX[panneau];
    if (p) { reglagesTab = p.onglet; reglagesFocus = panneau; }
    if (location.hash.startsWith('#/reglages')) render();
    else location.hash = '#/reglages';
  }

  function todoPanel(todo) {
    if (!todo.length) {
      const p = K.portfolio(S);
      if (!p.surSkanfact) return '';
      return p.surSkanfact > 1
        ? `<div class="todo-ok">Tout est à jour : tes ${p.surSkanfact} dossiers sur SkanFact ont envoyé leurs mois clôturés.</div>`
        : `<div class="todo-ok">Tout est à jour : ton dossier sur SkanFact a envoyé ses mois clôturés.</div>`;
    }
    return `<div class="panel todo"><h2>À faire</h2><ul>${todo.map(t => `
      <li class="lvl-${t.level}"><span class="td-dot"></span>
        <span class="td-txt"><strong>${esc(t.label)}</strong><span class="small muted">${esc(t.detail)}</span></span>
        <button class="btn btn-ghost btn-sm nw" data-todo="${esc(t.id)}">${esc((TODO_ACTIONS[t.id] || {}).texte || 'Voir')}</button></li>`).join('')}</ul></div>`;
  }
  function bindTodo(root) {
    $$('[data-todo]', root || document).forEach(b => b.onclick = () => {
      const a = TODO_ACTIONS[b.dataset.todo];
      // Un bouton qui avale le clic en silence fait douter de soi, puis du logiciel : on le dit.
      if (a) a.run(); else toast('Cette ligne n\'a pas encore d\'écran à ouvrir.', 'error');
    });
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

  // Le total du pied de liste additionnait un champ venu du paquet SANS le convertir : une chaîne le
  // faisait se concaténer, et 42 500 DT s'affichaient « 0,000 DT ». Il additionnait aussi des devises
  // différentes sans le dire. On additionne ce qui est comparable, et on refuse le reste.
  function totalCA(rows) {
    const avec = rows.filter(r => r.lastFigures && isFinite(Number(r.lastFigures.ca)));
    if (!avec.length) return '—';
    const devises = [...new Set(avec.map(r => r.lastFigures.devise || 'DT'))];
    if (devises.length > 1) return devises.length + ' devises';
    return money(avec.reduce((s, r) => s + Number(r.lastFigures.ca), 0), devises[0]);
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
    // `recoveryAt` vaut `undefined` tant que la réponse n'est pas revenue : on ne réclame que sur un
    // non franc. La date ne vit pas dans l'état chiffré, elle ne peut donc pas venir de `S`.
    const todo = K.cabinetTodo(S, null, { cleSecours: recoveryAt === undefined ? null : recoveryAt !== null });
    const p = K.portfolio(S);

    // Écran d'ouverture d'un cabinet qui vient d'installer l'application : il n'a rien reçu, et il
    // n'a rien à chercher ni à filtrer. Trois propositions, trois VRAIS boutons — la première version
    // cachait l'exemple dans une phrase en gras au milieu d'un cadre, et personne ne le voyait.
    if (!all.length) {
      view.innerHTML = `
        <div class="page-head"><h1>Dossiers</h1></div>
        ${recoveryBanner()}
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
        ${inboxBanner()}
        <div class="panel"><h2>Comment un paquet arrive jusqu'ici</h2>
          <ol class="small" style="line-height:1.9;margin:0;padding-left:20px">
            <li>Tu remets à ton client le <strong>fichier d'appairage</strong> (Réglages → Mon cabinet → Le fichier à remettre à tes clients).</li>
            <li>Il l'importe une fois dans son SkanFact, puis t'envoie son <strong>.skanpack</strong> chaque mois.</li>
            <li>Tu le <strong>glisses sur cette fenêtre</strong>, ou tu le double-cliques dans le Finder.</li>
          </ol>
        </div>`;
      $('#imp').onclick = () => doImport();
      $('#new-d').onclick = () => newDossierForm();
      $('#demo-on').onclick = async () => { S = await api.demo(true); render(); toast('Exemple chargé : ces cinq dossiers sont fictifs.'); };
      bindInboxBanner(view);
      bindRecoveryBanner(view);
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
      ${inboxBanner()}
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
        ${listState.sort !== 'urgence' ? '<button class="btn btn-ghost btn-sm" id="par-urgence">Reclasser par urgence</button>' : ''}
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" id="csv">Exporter en CSV</button>
      </div>
      ${rows.length ? `<div class="scroll-x"><table class="list sortable">
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
          <td class="r nw"><strong>${esc(totalCA(rows))}</strong></td>
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
    const pu = $('#par-urgence');
    if (pu) pu.onclick = () => {
      listState.sort = 'urgence'; listState.desc = false;
      prefs.set('sort', 'urgence'); prefs.set('desc', false);
      render();
    };
    bindInboxBanner(view);
    bindTodo(view);
    bindSort(view, render);
    bindPager(view, render);
    $$('tr[data-id]', view).forEach(tr => { tr.onclick = () => { location.hash = '#/dossier/' + encodeURIComponent(tr.dataset.id); }; });
  }

  // Le bouton du bandeau de la clé de secours. Il vit sur DEUX écrans (Dossiers et Réglages) : le
  // brancher au même endroit que le bandeau évite qu'un des deux devienne un rectangle inerte.
  function bindRecoveryBanner(root) {
    const b = $('#rec-go', root || document);
    if (b) b.onclick = () => exportRecovery();
  }

  // À soixante clients, le geste quotidien n'est pas d'importer UN paquet, c'est d'en importer douze.
  // L'application regarde le dossier désigné et dit ce qui est arrivé ; elle n'importe jamais toute
  // seule — c'est la même règle que la lecture de photo côté entreprise.
  function inboxBanner() {
    if (!inboxInfo || !inboxInfo.dir) return '';
    if (inboxInfo.erreur) {
      return `<div class="banner"><span><strong>Boîte de réception introuvable</strong> — ${esc(inboxInfo.erreur)}
        <span class="muted small">${esc(inboxInfo.dir)}</span></span>
        <a class="btn btn-ghost btn-sm nw" href="#/reglages">Réglages</a></div>`;
    }
    const n = (inboxInfo.nouveaux || []).length;
    if (!n) return '';
    return `<div class="banner"><span><strong>${pl(n, 'nouveau paquet', 'nouveaux paquets')}</strong> dans ta boîte de réception :
      ${esc((inboxInfo.nouveaux || []).slice(0, 3).map(x => x.name).join(', '))}${n > 3 ? '…' : ''}</span>
      <button class="btn btn-ghost btn-sm nw" id="inbox-skip">Ignorer</button>
      <button class="btn btn-primary btn-sm nw" id="inbox-go">Tout importer</button></div>`;
  }

  function bindInboxBanner(view) {
    const go = $('#inbox-go', view);
    if (go) go.onclick = async () => {
      const paths = (inboxInfo.nouveaux || []).map(x => x.path);
      await doImport(paths);
      await refreshInbox(true);
    };
    const skip = $('#inbox-skip', view);
    if (skip) skip.onclick = async () => {
      const n = (inboxInfo.nouveaux || []).length;
      const ok = await confirmDialog('Ne plus proposer ces paquets ?',
        `<p>${pl(n, 'fichier')} ${n > 1 ? 'resteront' : 'restera'} dans ton dossier — on ne les efface pas, ce sont les pièces de tes clients.
         Ils ne te seront simplement plus proposés.</p>`, 'Ignorer');
      if (!ok) return;
      try { inboxInfo = await api.inboxIgnore((inboxInfo.nouveaux || []).map(x => x.path)); render(); }
      catch (e) { toast(plainError(e), 'error'); }
    };
  }

  // ---------- la fiche d'un dossier ----------
  let ficheYear = '';                    // l'exercice choisi sur la fiche, entre deux redessins
  // ---------- la fiche d'un dossier : un en-tête, des alertes, trois onglets (9.2.2) ----------
  //
  // Skander : « le dossier est mal fait et pas pratique, tout est mis dans la même page ». Mesuré
  // avant d'y toucher : 1 741 px et six panneaux sur l'exemple — et sur un vrai dossier, le bloc
  // Comptabilité est à lui seul une page entière (15 pièces, 56 lignes) posée entre les mois et les
  // paquets. Deux métiers mélangés : SUIVRE le dossier (mois manquants, relances, paquets) et
  // TRAVAILLER sa comptabilité (journal, grand livre, balance, lettrage). Un comptable fait l'un ou
  // l'autre, jamais les deux à la fois.
  //
  // Trois onglets, pas quatre : l'identité (151 px) aurait fait un onglet d'un demi-écran — ce que
  // la 7.30.0 a retiré des Paramètres. Elle vit dans l'en-tête, avec l'état du dossier en une
  // phrase. Les alertes (paquet altéré, fichier intrus) restent AU-DESSUS des onglets : un rangement
  // ne range pas ce qu'il ne faut pas ranger (7.32.0). L'onglet vit dans l'ADRESSE
  // (`#/dossier/<id>/<onglet>`) : ce qui traverse un onglet doit l'ouvrir, et « précédent » marche.
  // L'impression, elle, imprime tout : la fiche imprimée reste la fiche entière.
  const ONGLETS_DOSSIER = ['suivi', 'comptabilite', 'paquets'];
  let ficheOnglet = 'suivi';
  let ficheDossierId = '';

  function drawDossier(view, id, ongletDemande) {
    const dossier = (S.dossiers || []).find(d => d.id === decodeURIComponent(id || ''));
    if (!dossier) { view.innerHTML = `<div class="empty">Ce dossier n'existe plus.</div>`; return; }
    const row = K.dossierRow(dossier);
    const months = K.dossierMonths(dossier).slice().reverse();
    const packs = (dossier.packs || []).slice().sort((a, b) => a.month < b.month ? 1 : -1);
    const relances = (dossier.relances || []).slice().reverse();
    // Les mois regroupés par année : douze cases par ligne valent mieux qu'une bande sans fin.
    const years = [...new Set(months.map(m => m.month.slice(0, 4)))];
    // L'exercice choisi ne suit pas d'un client à l'autre : sans ce garde-fou, passer d'un dossier
    // qui a 2025 à un dossier qui n'a que 2026 afficherait un graphique vide sans raison visible.
    const anneeVue = years.includes(ficheYear) ? ficheYear : years[0];
    const totalCA = packs.reduce((s, p) => s + ((p.figures && p.figures.ca) || 0), 0);
    // L'onglet : celui de l'adresse s'il en porte un ; sinon celui où l'on était sur CE dossier ;
    // sinon Suivi, l'écran du quotidien.
    const onglet = ONGLETS_DOSSIER.includes(ongletDemande) ? ongletDemande : (ficheDossierId === dossier.id ? ficheOnglet : 'suivi');
    ficheOnglet = onglet; ficheDossierId = dossier.id;
    const versOnglet = o => { location.hash = '#/dossier/' + encodeURIComponent(dossier.id) + '/' + o; };
    // L'état du dossier en une phrase : ce qu'un comptable veut savoir avant tout le reste.
    const dernierRecu = packs.reduce((m, p) => Math.max(m, p.receivedAt || 0), 0);
    const caAnnee = packs.filter(p => p.month.slice(0, 4) === anneeVue).reduce((s, p) => s + ((p.figures && p.figures.ca) || 0), 0);
    const etat = [
      packs.length ? pl(packs.length, 'mois reçu', 'mois reçus') : (dossier.manual ? 'pas encore sur SkanFact' : 'aucun paquet reçu pour l\'instant'),
      row.missingCount ? `<span class="warn-text">${pl(row.missingCount, 'manquant')}</span>` : '',
      row.provisionalCount ? `<span class="warn-text">${pl(row.provisionalCount, 'provisoire')}</span>` : '',
      dernierRecu ? 'dernier paquet le ' + esc(fmtDay(dernierRecu)) : '',
      packs.length && anneeVue ? `CA ${esc(anneeVue)} : <strong>${esc(money(caAnnee))}</strong>` : ''
    ].filter(Boolean).join(' · ');
    // L'identité, compacte, sans tiret : ce qui n'est pas renseigné ne prend pas de place — sauf
    // l'email et le téléphone, qui servent à relancer.
    const ident = [
      esc(dossier.matricule || 'Matricule inconnu'),
      dossier.contact ? esc(dossier.contact) : '',
      dossier.email ? esc(dossier.email) : '<span class="muted">email à renseigner</span>',
      dossier.phone ? esc(dossier.phone) : '<span class="muted">téléphone à renseigner</span>',
      labelOf(K.REGIMES, dossier.regime) ? 'régime ' + esc(labelOf(K.REGIMES, dossier.regime)) : '',
      labelOf(K.TVA_PERIODS, dossier.tvaPeriod) ? 'TVA ' + esc(labelOf(K.TVA_PERIODS, dossier.tvaPeriod)) : '',
      dossier.from ? 'mission depuis ' + esc(K.monthLabel(dossier.from)) : '',
      dossier.fees ? esc(money(dossier.fees)) + ' / mois' : ''
    ].filter(Boolean).join(' · ');
    const altere = packs.some(p => p.integrity && (p.integrity.bad || []).length);
    const intrus = packs.some(p => p.integrity && (p.integrity.intrus || []).length);
    const ongletBtn = (o, label, n) => `<button role="tab" data-tab="${o}" class="${onglet === o ? 'active' : ''}" aria-selected="${onglet === o}">${label}${n ? `<span class="tab-n">${n}</span>` : ''}</button>`;

    view.innerHTML = `
      <button class="btn btn-ghost btn-sm btn-back" id="back">← Dossiers</button>
      <div class="page-head"><div>
        <h1>${esc(dossier.name)}${dossier.archived ? ' <span class="badge">archivé</span>' : ''}${dossier.manual ? ' <span class="badge b-hors">pas encore sur SkanFact</span>' : ''}</h1>
        <div class="d-ident">${ident}</div>
        <div class="d-etat" id="d-etat">${etat}</div>
      </div><div class="actions">
        ${row.missingCount || row.provisionalCount ? '<button class="btn btn-primary" id="rel">Relancer</button>' : ''}
        <button class="btn" id="edit">Modifier la fiche</button>
        <button class="btn" id="print">Imprimer</button>
        ${dossier.phone ? '<button class="btn" id="call">Appeler</button><button class="btn" id="wa">WhatsApp</button>' : ''}
      </div></div>
      <div class="print-only print-head">${esc(S.cabinet.name || 'Cabinet')} — fiche client imprimée le ${esc(fmtDay(Date.now()))}</div>

      ${altere
        ? `<div class="warn-box mb"><strong>Au moins un paquet de ce client contient un fichier qui ne correspond pas à l'empreinte annoncée.</strong>
           Ce n'est pas ce qui a été envoyé : redemande-le avant de déclarer. ${onglet !== 'paquets' ? '<button class="btn btn-sm" data-vers="paquets">Voir les paquets</button>' : ''}</div>` : ''}
      ${intrus
        ? `<div class="warn-box mb"><strong>Au moins un paquet de ce client contient un fichier que son manifeste n'annonce pas ${info('p.intrus')}</strong>
           Personne ne l'a vérifié et il ne compte pas dans les pièces intactes. Ouvre-le seulement si tu sais d'où il vient. ${onglet !== 'paquets' ? '<button class="btn btn-sm" data-vers="paquets">Voir les paquets</button>' : ''}</div>` : ''}

      <div class="tabs" id="d-tabs" role="tablist">
        ${ongletBtn('suivi', 'Suivi', row.missingCount)}
        ${ongletBtn('comptabilite', 'Comptabilité', 0)}
        ${ongletBtn('paquets', 'Paquets', packs.length)}
      </div>

      <section data-onglet="suivi" ${onglet === 'suivi' ? '' : 'hidden'}>
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

      ${(dossier.note || '').trim() ? `<div class="panel"><h2>Note interne</h2><div class="notes-md">${esc(dossier.note)}</div></div>` : ''}
      </section>

      <section data-onglet="comptabilite" ${onglet === 'comptabilite' ? '' : 'hidden'}>
      ${packs.length ? `<div class="panel" id="c-compta"><h2>Comptabilité ${info('lv.compta')}</h2>
        <div class="filters">
          <select id="lv-mode">
            <option value="exercice" ${livresState.mode === 'exercice' ? 'selected' : ''}>L'exercice</option>
            <option value="mois" ${livresState.mode === 'mois' ? 'selected' : ''}>Un mois</option>
            <option value="intervalle" ${livresState.mode === 'intervalle' ? 'selected' : ''}>Du… au…</option>
          </select>
          <select id="lv-annee" ${livresState.mode === 'exercice' ? '' : 'hidden'}>${years.map(y => `<option value="${esc(y)}" ${livresState.annee === y ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select>
          <select id="lv-mois" ${livresState.mode === 'mois' ? '' : 'hidden'}>${months.map(m => `<option value="${esc(m.month)}" ${livresState.mois === m.month ? 'selected' : ''}>${esc(K.monthLabel(m.month))}</option>`).join('')}</select>
          <input type="month" id="lv-du" ${livresState.mode === 'intervalle' ? '' : 'hidden'} value="${esc(livresState.du)}">
          <input type="month" id="lv-au" ${livresState.mode === 'intervalle' ? '' : 'hidden'} value="${esc(livresState.au)}">
        </div>
        <div id="c-livres"><div class="empty">Lecture des paquets…</div></div>
      </div>` : `<div class="panel"><h2>Comptabilité ${info('lv.compta')}</h2>
        <div class="empty">${dossier.manual
          ? 'Ce client n\'est pas encore sur SkanFact : sa comptabilité apparaîtra ici dès son premier paquet.'
          : 'Aucun paquet reçu pour l\'instant : le livre-journal, le grand livre, la balance et le lettrage de ce client apparaîtront ici dès son premier envoi.'}</div>
      </div>`}
      </section>

      <section data-onglet="paquets" ${onglet === 'paquets' ? '' : 'hidden'}>
      ${years.length ? `<div class="panel"><h2>Chiffre d'affaires ${info('d.ca')}</h2>
        ${years.length > 1 ? `<div class="filters"><label class="inline small">Exercice
          <select id="ca-year">${years.map(y => `<option value="${esc(y)}" ${y === anneeVue ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select></label></div>` : ''}
        ${caChart(packs, anneeVue) || '<div class="empty">Les paquets de cette année ne portent pas de chiffres (fabriqués avant la 6.2.1).</div>'}
      </div>` : ''}

      <div class="panel"><h2>Paquets reçus ${info('p.integrity')}</h2>
      ${packs.length ? `<div class="scroll-x"><table class="list compact">
        <thead><tr><th class="nw">Mois</th><th>État</th><th class="r nw">Chiffre d'affaires</th><th class="r nw">TVA à décaisser</th>
        <th class="r">Vérifiées</th><th class="r">Signalé</th><th class="nw">Reçu le</th><th class="nw">Fabriqué le</th><th class="r">Taille</th><th></th></tr></thead>
        <tbody>${packs.map(p => `<tr>
          <td class="nw">${esc(p.label)}</td>
          <td>${p.definitive ? '<span class="badge accepté">définitif</span>' : '<span class="badge partielle">provisoire</span>'}</td>
          <td class="r nw">${esc(p.figures ? money(p.figures.ca, p.figures.devise) : '—')}</td>
          <td class="r nw">${esc(p.figures ? money(p.figures.tvaADecaisser, p.figures.devise) : '—')}</td>
          <td class="r">${p.integrity && (p.integrity.bad || []).length
            ? `<span class="err-inline" title="${esc((p.integrity.bad || []).join(', '))}">⚠ ${p.integrity.bad.length}</span>`
            : p.integrity ? `<span class="ok-inline" title="empreintes vérifiées à la réception">✓ ${p.integrity.checked}</span>` : p.files}
            ${p.integrity && (p.integrity.intrus || []).length
              ? `<span class="err-inline" title="${esc('non annoncés par le manifeste : ' + (p.integrity.intrus || []).join(', '))}">⚠ +${p.integrity.intrus.length}</span>`
              : ''}</td>
          <td class="r">${(p.missing || []).reduce((s, m) => s + (m.count || 0), 0) || '—'}</td>
          <td class="muted nw">${esc(fmtWhen(p.receivedAt))}</td>
          <td class="muted nw">${esc(p.generatedAt ? fmtWhen(Date.parse(p.generatedAt)) : '—')}</td>
          <td class="r muted nw">${esc(fmtBytes(p.bytes))}</td>
          ${p.path ? rowMenuCell(p.month) : '<td class="row-actions"><span class="muted small">exemple</span></td>'}</tr>`).join('')}</tbody>
        <tfoot><tr><td class="nw"><strong>${pl(packs.length, 'mois', 'mois')}</strong></td><td></td>
          <td class="r nw"><strong>${esc(money(totalCA))}</strong></td><td colspan="7"></td></tr></tfoot></table></div>
        <p class="muted small mt">Le bouton « Actions » de chaque ligne ouvre ce qu'on peut faire du mois : l'ouvrir, l'extraire dans un dossier de ton choix ${info('p.extract')} — pour travailler dans ton logiciel, ou pour rendre ses pièces à un client —, accuser réception, ou supprimer un paquet arrivé par erreur ${info('p.delete')}.</p>`
        : '<div class="empty">Aucun paquet reçu.</div>'}
      </div>
      </section>`;

    $('#back').onclick = () => { location.hash = '#/dossiers'; };
    // Changer d'onglet, c'est changer d'adresse : « précédent » revient dessus, et une autre page
    // peut y emmener directement.
    $$('#d-tabs button', view).forEach(b => b.onclick = () => versOnglet(b.dataset.tab));
    $$('[data-vers]', view).forEach(b => b.onclick = () => versOnglet(b.dataset.vers));
    $('#edit').onclick = () => dossierForm(dossier);
    $('#print').onclick = () => window.print();
    const cy = $('#ca-year');
    if (cy) cy.onchange = e => { ficheYear = e.target.value; render(); };
    const call = $('#call'); if (call) call.onclick = () => api.tel({ number: dossier.phone }).catch(e => toast(plainError(e), 'error'));
    const wa = $('#wa'); if (wa) wa.onclick = () => {
      const m = K.relanceMail(S.cabinet, row);
      api.tel({ number: dossier.phone, whatsapp: true, text: m.body }).catch(e => toast(plainError(e), 'error'));
    };
    const rel = $('#rel'); if (rel) rel.onclick = () => writeRelance(row);
    $('#note-rel').onclick = () => noteRelanceForm(row);
    $$('[data-m]', view).forEach(c => { c.onclick = () => openPack(dossier, c.dataset.m); });

    // Les livres du dossier (9.1.0). L'état de la période est propre au dossier : passer d'un
    // client à l'autre en gardant « mars 2026 » afficherait un livre vide sans raison visible
    // (même garde-fou que `ficheYear`, plus haut).
    if ($('#c-compta', view)) {
      if (livresState.dossierId !== dossier.id) {
        livresState.dossierId = dossier.id; livresState.data = null;
        livresState.annee = ''; livresState.mois = ''; livresState.du = ''; livresState.au = '';
        livresState.onglet = 'journal'; livresState.compte = ''; livresState.journal = ''; livresState.q = ''; livresState.aux = false;
      }
      const relire = () => drawLivres(view, dossier);
      const mode = $('#lv-mode', view);
      mode.onchange = () => { livresState.mode = mode.value; render(); };
      // Changer d'exercice change de LIVRE : sans cette relecture, on regarderait 2025 dans le
      // livre de 2026 sans que rien ne le dise.
      const an = $('#lv-annee', view); if (an) an.onchange = () => {
        livresState.annee = an.value;
        chargerLeLivre(dossier).then(apres, apres);
      };
      const mo = $('#lv-mois', view); if (mo) mo.onchange = () => { livresState.mois = mo.value; relire(); };
      const du = $('#lv-du', view); if (du) du.onchange = () => { livresState.du = du.value; relire(); };
      const au = $('#lv-au', view); if (au) au.onchange = () => { livresState.au = au.value; relire(); };
      // La page a pu changer pendant la lecture : on redemande l'élément APRÈS l'attente, jamais
      // avant (règle 7.6.0). Sinon on écrit dans un élément détaché.
      const apres = () => {
        if (livresState.dossierId === dossier.id && $('#c-livres')) drawLivres(document, dossier);
      };
      // Le livre se relit quand le COUPLE (dossier, exercice) change — pas à chaque affichage de
      // la page. Relire à chaque fois redessinait `#c-livres` de façon asynchrone pendant qu'un
      // menu de ligne était ouvert ailleurs sur la page, et le clic suivant tombait dans le vide :
      // le piège des poignées détachées (7.0.0), fabriqué ici par excès de prudence.
      // Les trois gestes qui changent le livre (relire, valider, contre-passer) reposent `s.livre`
      // eux-mêmes, donc l'écran reste juste sans cette relecture-là.
      const cle = dossier.id + '|' + (livresState.annee || '');
      if (livresState.data && livresState.livreCle === cle) relire();
      else if (livresState.data) { livresState.livreCle = cle; chargerLeLivre(dossier).then(apres, apres); }
      else chargerLivres(dossier).then(apres, apres);
    }
    // Les cinq boutons fantômes de cette ligne — dont un « ✕ » muet qui EFFACE un paquet reçu —
    // sont devenus un menu d'actions écrites en toutes lettres (7.29.0), comme dans l'app
    // entreprise. Le geste destructif y porte enfin son nom, et vit tout en bas, après un trait.
    const supprimerPaquet = async (p) => {
      const ok = await confirmDialog('Supprimer ce paquet ?',
        `<p>Le paquet <strong>${esc(p.label)}</strong> de ${esc(dossier.name)} sera effacé de ton disque, et ce mois redeviendra « manquant » pour ce client.</p>
         <p class="muted small">Une sauvegarde est prise juste avant. À réserver à un paquet arrivé par erreur.</p>
         ${backupInfo && backupInfo.external && backupInfo.external.dir ? '<p class="muted small">La copie externe n\'est pas touchée : une sauvegarde qui efface ce que tu effaces n\'en est plus une. Va l\'y supprimer à la main si c\'est ce que tu veux.</p>' : ''}`, 'Supprimer', true);
      if (!ok) return;
      try { S = await api.deletePack(dossier.id, p.month); render(); toast('Paquet supprimé.'); refreshBackupInfo(); }
      catch (e) { toast(plainError(e), 'error'); }
    };
    bindRowMenus(view, mois => {
      const p = packs.find(x => x.month === mois);
      if (!p || !p.path) return [];
      return [
        { icon: 'loupe', label: 'Ouvrir le paquet', hint: 'Les pièces du mois, une par une', run: () => openPack(dossier, p.month) },
        { icon: 'extraire', label: 'Extraire dans un dossier…', hint: 'Tout le contenu, pour ton logiciel ou pour le rendre au client', run: () => extractPack(dossier, p.month) },
        { icon: 'dossier', label: 'Montrer le fichier reçu', hint: 'Dans l\'explorateur de fichiers', run: () => api.reveal(p.path) },
        { sep: true },
        { icon: 'email', label: 'Accuser réception', hint: 'Prévenir le client que c\'est bien arrivé', run: () => accuseReception(dossier, p) },
        { sep: true },
        { icon: 'supprimer', label: 'Supprimer ce paquet', hint: 'Le mois redeviendra manquant pour ce client', danger: true, run: () => supprimerPaquet(p) }
      ];
    });
  }

  const labelOf = (list, id) => { const x = (list || []).find(o => o.id === id); return x ? x.label : ''; };


  // ---------------------------------------------------------------- les livres du dossier (9.1.0)
  //
  // SPEC-UI-CAB-001. Le Cabinet LIT une comptabilité dans les paquets reçus : livre-journal, grand
  // livre, balance, lettrage. Il n'écrit rien et ne tient pas encore de livre à lui (9.2.0).
  //
  // Tout passe par `SkanCompta`, le MÊME moteur que l'application du client. C'est ce qui fait que
  // la balance du comptable est celle de son client, au millime — et un test de parité le prouve
  // sur les 24 mois du jeu d'exemple. Deux calculs séparés auraient fini par diverger, et personne
  // n'aurait su lequel croire.
  const KC = window.SkanCompta;
  const livresState = {
    dossierId: '', mode: 'exercice', annee: '', mois: '', du: '', au: '',
    onglet: 'journal', compte: '', journal: '', q: '', aux: false, data: null,
    // 9.2.0 : le livre du dossier, quand il existe. Deux sources possibles, et l'écran DIT
    // laquelle il montre — une balance lue dans les paquets et une balance tenue par le cabinet
    // ne disent pas la même chose, et les confondre serait exactement le genre de chiffre qui ment.
    livre: null, livreEtat: '', brouillard: false
  };

  function moisLabelCourt(m) { return K.monthLabel(m); }

  // Ce qui borne la période. Trois modes, et le défaut est l'exercice du dernier paquet reçu :
  // c'est celui sur lequel le comptable travaille.
  function bornesLivres(mois) {
    const s = livresState;
    if (s.mode === 'mois' && s.mois) return { du: s.mois, au: s.mois };
    if (s.mode === 'intervalle') return { du: s.du || '', au: s.au || '' };
    const y = s.annee || (mois.length ? mois[mois.length - 1].slice(0, 4) : String(new Date().getFullYear()));
    return { du: y + '-01', au: y + '-12' };
  }

  async function chargerLivres(dossier) {
    const s = livresState;
    try {
      const brut = await api.livres(dossier.id, '', '');           // tout, une fois : le cache est côté main
      s.dossierId = dossier.id;
      s.data = brut;
      if (!s.annee) {
        const m = brut.tousLesMois;
        s.annee = m.length ? m[m.length - 1].slice(0, 4) : String(new Date().getFullYear());
      }
      await chargerLeLivre(dossier);
    } catch (e) { s.data = { erreur: plainError(e) }; }
  }

  // Le livre de l'exercice choisi (9.2.0). Absent, ce n'en est pas une : c'est un dossier qu'on
  // n'a pas encore repris, et l'écran doit le DIRE avec les deux gestes qui le règlent — jamais
  // créer un livre en silence.
  async function chargerLeLivre(dossier) {
    const s = livresState;
    s.livre = null; s.livreEtat = '';
    const annee = s.annee || String(new Date().getFullYear());
    s.livreCle = dossier.id + '|' + annee;
    try {
      const r = await api.livre(dossier.id, annee);
      if (r.livre) { s.livre = r.livre; s.livreEtat = 'ouvert'; return; }
      if (r.versionInconnue) { s.livreEtat = 'version-inconnue'; return; }
      if (r.illisible) { s.livreEtat = 'illisible'; s.livreMotif = r.motif || ''; return; }
      s.livreEtat = 'absent';
    } catch (e) { s.livreEtat = 'erreur'; s.livreMotif = plainError(e); }
  }

  // Les lignes de la période, analysées par compta.js. On garde la provenance (le mois et le
  // chemin du paquet) sur chaque ligne : c'est elle qui permet d'ouvrir la pièce dans son paquet.
  function lignesDeLaPeriode() {
    const s = livresState;
    if (!s.data || s.data.erreur) return { lignes: [], illisibles: [], anciens: [], manquants: [], pris: [] };
    // Le LIVRE fait foi dès qu'il existe : c'est lui que le comptable tient, avec ses validations,
    // ses saisies et ses lettrages. Les paquets ne sont plus que la matière première.
    if (s.livre) {
      const { du, au } = bornesLivres(s.data.tousLesMois || []);
      const jour = m => (m && m.length === 7 ? m : '');
      return {
        source: 'livre',
        lignes: KC.lignesDuLivre(s.livre, {
          brouillard: s.brouillard,
          du: jour(du) ? jour(du) + '-01' : '',
          au: jour(au) ? jour(au) + '-31' : ''
        }),
        illisibles: [], anciens: [], manquants: [], pris: []
      };
    }
    const { du, au } = bornesLivres(s.data.tousLesMois || []);
    const pris = (s.data.paquets || []).filter(p => (!du || p.month >= du) && (!au || p.month <= au));
    const lignes = [];
    const illisibles = [], anciens = [];
    pris.forEach(p => {
      if (p.motif) { illisibles.push({ month: p.month, motif: p.motif }); return; }
      const l = KC.entreesDepuisCsv(p.csv);
      if (!l.entete) { illisibles.push({ month: p.month, motif: 'fichier d\'écritures illisible' }); return; }
      // Un paquet d'avant la 8.8.0 n'a ni numéro ni tiers : on l'accepte et on le DIT, plutôt que
      // d'afficher des colonnes vides sans explication.
      if (l.colonnes.numero == null || l.colonnes.tiers == null) anciens.push(p.month);
      l.forEach(e => lignes.push({ ...e, mois: p.month, path: p.path }));
    });
    // Les mois ABSENTS de la période sont nommés en tête : un livre incomplet qui ne le dit pas
    // est un livre faux (règle « avant d'écrire une phrase rassurante, vérifier l'univers »).
    const manquants = [];
    if (du && au && du.length === 7 && au.length === 7) {
      const vus = new Set(pris.map(p => p.month));
      let m = du;
      for (let garde = 0; garde < 120 && m <= au; garde++) {
        if (!vus.has(m)) manquants.push(m);
        m = K.addMonth(m, 1);
      }
    }
    return { lignes, illisibles, anciens, manquants, pris };
  }

  // ---------------------------------------------------------------- reprendre / relire (9.2.0)

  // Créer le livre à partir de ce qui a déjà été reçu. Rejouer ne double RIEN : chaque mois
  // remplace ses brouillards et laisse les validées intactes — c'est la même fonction que l'import
  // d'un paquet neuf, donc le geste est sûr à répéter, et c'est ce qui le rend utilisable.
  async function relireLesPaquets(root, dossier) {
    const s = livresState;
    try {
      const r = await api.relireLesPaquets(dossier.id, s.annee);
      s.livre = r.livre; s.livreEtat = r.livre ? 'ouvert' : s.livreEtat;
      const lignes = [
        `${pl(r.mois, 'mois', 'mois')} relu${r.mois > 1 ? 's' : ''}.`,
        `${pl(r.ajoutees, 'écriture ajoutée', 'écritures ajoutées')}${r.validees ? `, dont ${pl(r.validees, 'validée', 'validées')} (mois définitifs)` : ' (en brouillard)'}.`,
        r.remplacees ? `${pl(r.remplacees, 'écriture remplacée', 'écritures remplacées')} par une version renvoyée.` : '',
        // Les écarts ne s'appliquent JAMAIS seuls : on les montre, le comptable tranche.
        r.ecarts.length ? `${pl(r.ecarts.length, 'écriture validée diffère', 'écritures validées diffèrent')} du mois renvoyé — elles n'ont pas été touchées :\n` +
          r.ecarts.slice(0, 8).map(e => `  • ${esc(e.piece || e.id)} (${moisLabelCourt(e.mois)}) : ${e.avant.toFixed(3)} → ${e.apres.toFixed(3)}`).join('\n') : '',
        r.illisibles.length ? `${pl(r.illisibles.length, 'mois', 'mois')} illisible${r.illisibles.length > 1 ? 's' : ''} : ${r.illisibles.map(x => moisLabelCourt(x.mois)).join(', ')}.` : ''
      ].filter(Boolean);
      await infoDialog(`Le livre de ${s.annee}`, lignes.join('\n\n'));
      drawLivres(root, dossier);
    } catch (e) { await infoDialog('Impossible de relire les paquets', plainError(e)); }
  }

  // Reprendre un dossier venu d'ailleurs : exercice, plan, balance d'ouverture. L'écart s'affiche
  // EN DIRECT pendant la saisie — découvrir à l'enregistrement qu'il manque 3 000 DT sur vingt
  // lignes, c'est recommencer ; le voir descendre à zéro pendant qu'on tape, c'est travailler.
  function repriseForm(root, dossier) {
    const s = livresState;
    const annee = s.annee || String(new Date().getFullYear());
    let lignes = [{ compte: '', libelle: '', debit: '', credit: '' }];
    const ligneHtml = (l, i) => `<tr>
      <td><input name="c${i}" value="${esc(l.compte)}" class="num" style="width:7em" placeholder="411"></td>
      <td><input name="l${i}" value="${esc(l.libelle)}" placeholder="Clients"></td>
      <td><input name="d${i}" value="${esc(l.debit)}" class="num" inputmode="decimal" style="width:8em"></td>
      <td><input name="k${i}" value="${esc(l.credit)}" class="num" inputmode="decimal" style="width:8em"></td>
      <td class="actions"><button type="button" class="btn btn-sm" data-sup="${i}">Retirer</button></td></tr>`;
    modal(`<h2>Reprendre ${esc(dossier.name)}</h2>
      <p class="small muted">Pour un client qui tenait sa comptabilité ailleurs. Tu poses son exercice et ce que
      ses comptes portaient au premier jour ; tout ce qui suivra s'appuiera dessus.
      <b>La balance d'ouverture doit s'équilibrer</b> — une reprise fausse fausse l'exercice entier, et on ne
      s'en aperçoit qu'au bilan.</p>
      <form id="rf" class="grid-2">
        <label class="field">Exercice<input name="annee" value="${esc(annee)}" class="num"></label>
        <label class="field">Du<input type="date" name="du" value="${esc(annee)}-01-01"></label>
        <label class="field">Au<input type="date" name="au" value="${esc(annee)}-12-31"></label>
      </form>
      <h3 class="sub-h">Balance d'ouverture</h3>
      <div class="scroll-x"><table class="list compact"><thead><tr><th>Compte</th><th>Libellé</th><th class="r">Débit</th><th class="r">Crédit</th><th></th></tr></thead>
        <tbody id="rf-lignes">${lignes.map(ligneHtml).join('')}</tbody></table></div>
      <div class="modal-actions" style="justify-content:flex-start">
        <button type="button" class="btn btn-sm" id="rf-add">Ajouter une ligne</button>
        <button type="button" class="btn btn-sm" id="rf-csv">Importer un CSV…</button>
        <span id="rf-ecart" class="small"></span>
      </div>
      <div class="modal-actions">
        <button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">Créer le livre</button></div>`,
      (rootModal, close) => {
        const corps = $('#rf-lignes', rootModal);
        const lire = () => {
          const out = [];
          $$('tr', corps).forEach((tr, i) => {
            const v = n => (($(`input[name=${n}${i}]`, tr) || {}).value || '').trim();
            out.push({ compte: v('c'), libelle: v('l'), debit: KC.nombreDepuisCsv(v('d')), credit: KC.nombreDepuisCsv(v('k')) });
          });
          return out.filter(l => l.compte || l.debit || l.credit);
        };
        const majEcart = () => {
          const L = lire();
          const d = KC.round3(L.reduce((a, x) => a + x.debit, 0));
          const c = KC.round3(L.reduce((a, x) => a + x.credit, 0));
          const e = KC.round3(d - c);
          const lbl = $('#rf-ecart', rootModal);
          lbl.textContent = L.length
            ? (e === 0 ? `Équilibrée : ${d.toFixed(3)} de chaque côté.` : `Écart : ${e.toFixed(3)} (débit ${d.toFixed(3)} / crédit ${c.toFixed(3)}).`)
            : '';
          // `.ok-inline` / `.err-inline` existent déjà dans la feuille : inventer deux noms de
          // classe de plus, c'est se retrouver avec du texte sans style et rien qui le dise —
          // le défaut `.mono` de la 8.1.0.
          lbl.className = 'small ' + (L.length && e === 0 ? 'ok-inline' : 'err-inline');
        };
        const redessine = () => {
          corps.innerHTML = lignes.map(ligneHtml).join('');
          $$('[data-sup]', corps).forEach(b => { b.onclick = () => { lignes.splice(Number(b.dataset.sup), 1); if (!lignes.length) lignes = [{ compte: '', libelle: '', debit: '', credit: '' }]; redessine(); }; });
          corps.oninput = majEcart;
          majEcart();
        };
        redessine();
        $('#rf-add', rootModal).onclick = () => { lignes = lire().concat([{ compte: '', libelle: '', debit: '', credit: '' }]); redessine(); };
        $('#rf-csv', rootModal).onclick = async () => {
          try {
            const r = await api.importerBalance({ dossierId: dossier.id, annee: $('input[name=annee]', rootModal).value });
            if (r.annule) return;
            lignes = r.lignes.map(l => ({ compte: l.compte, libelle: l.libelle, debit: l.debit || '', credit: l.credit || '' }));
            redessine();
            if (r.ignorees.length) await infoDialog('Lignes ignorées', r.ignorees.map(x => `Ligne ${x.ligne} : ${x.motif}`).join('\n'));
          } catch (e) { await infoDialog('Import impossible', plainError(e)); }
        };
        $('#ok', rootModal).onclick = async () => {
          const f = $('#rf', rootModal);
          const v = { annee: $('input[name=annee]', f).value.trim(), du: $('input[name=du]', f).value, au: $('input[name=au]', f).value };
          if (!/^\d{4}$/.test(v.annee)) return infoDialog('Exercice', 'Une année s\'écrit sur quatre chiffres.');
          try {
            const r = await api.reprendre({ dossierId: dossier.id, annee: Number(v.annee), du: v.du, au: v.au, ouverture: lire(), source: 'balance' });
            s.annee = v.annee; s.livre = r.livre; s.livreEtat = 'ouvert';
            close();
            drawLivres(root, dossier);
            toast(`Livre de ${v.annee} créé`);
          } catch (e) { await infoDialog('Reprise impossible', plainError(e)); }
        };
      });
  }

  // Les deux gestes du comptable sur une écriture. Chacun DEMANDE d'abord et dit ce qu'il fait —
  // valider est irréversible (le numéro est pris pour toujours), contre-passer laisse une trace
  // dans le journal que personne ne pourra effacer.
  async function validerEcriture(root, dossier, e) {
    const ok = await confirmDialog('Valider cette écriture ?',
      `<p><b>${esc(e.journal)} ${esc(e.piece)}</b> — ${esc(e.libelle || '')}</p>
       <p class="small muted">Elle prendra son numéro dans le livre-journal et <b>ne pourra plus être modifiée</b> :
       on corrige une écriture validée en la contre-passant, jamais en la réécrivant. C'est ce qui fait qu'un
       livre relu dans deux ans dit la vérité de ce qui a été fait.</p>`, 'Valider');
    if (!ok) return;
    try {
      const r = await api.valider(dossier.id, livresState.annee, e.id);
      livresState.livre = r.livre;
      drawLivres(root, dossier);
      toast(`Validée sous le n° ${r.numero}`);
    } catch (err) { await infoDialog('Validation refusée', plainError(err)); }
  }

  async function contrepasserEcriture(root, dossier, e) {
    const jour = new Date().toISOString().slice(0, 10);
    const ok = await confirmDialog('Contre-passer cette écriture ?',
      `<p><b>n° ${esc(String(e.numero))} — ${esc(e.journal)} ${esc(e.piece)}</b></p>
       <p class="small muted">Une écriture miroir sera enregistrée <b>à la date d'aujourd'hui</b> (${esc(fmtJour(jour))}),
       pas à celle de l'écriture d'origine : corriger aujourd'hui une écriture d'un mois déjà déclaré
       changerait ce mois-là sans que personne le voie. Les deux resteront dans le journal.</p>`, 'Contre-passer');
    if (!ok) return;
    try {
      const r = await api.contrepasser(dossier.id, livresState.annee, e.id, jour);
      livresState.livre = r.livre;
      drawLivres(root, dossier);
      toast(`Contre-passée sous le n° ${r.numero}`);
    } catch (err) { await infoDialog('Contre-passation impossible', plainError(err)); }
  }

  function drawLivres(root, dossier) {
    const s = livresState;
    const el = $('#c-livres', root);
    if (!el) return;
    if (!s.data) { el.innerHTML = '<div class="empty">Lecture des paquets…</div>'; return; }
    if (s.data.erreur) { el.innerHTML = `<div class="warn-box">${esc(s.data.erreur)}</div>`; return; }
    if (s.data.aucunPaquet) {
      el.innerHTML = `<div class="empty"><p>Aucun paquet reçu ne contient d'écritures.</p>
        <p class="muted small">Les paquets d'avant la 6.3.0 n'en ont pas : demande à ton client de renvoyer le mois.</p>
        <div class="modal-actions"><button class="btn btn-primary" id="lv-ecrire">Écrire au client</button></div></div>`;
      const b = $('#lv-ecrire', el); if (b) b.onclick = () => writeRelance(K.dossierRow(dossier));
      return;
    }

    // Le dossier n'a pas encore de livre pour cet exercice : deux gestes, nommés, et rien d'écrit
    // en silence. « Reprendre » pour un client venu d'un autre cabinet, « Relire les paquets » pour
    // un client déjà sur SkanFact — c'est le cas de loin le plus courant, donc c'est le bouton vert.
    const sansLivre = s.livreEtat === 'absent'
      ? `<div class="info-box mb"><b>Ce dossier n'a pas encore de livre pour ${esc(s.annee)}.</b>
          Tant qu'il n'en a pas, les tableaux ci-dessous sont lus directement dans les paquets reçus : tu vois ce que
          ton client a déclaré, sans pouvoir y ajouter une écriture ni valider quoi que ce soit.</div>
        <div class="modal-actions mb">
          <button class="btn btn-primary" id="lv-relire">Créer le livre à partir des paquets reçus…</button>
          <button class="btn" id="lv-reprendre">Reprendre ce dossier (balance d'ouverture)…</button>
        </div>`
      : s.livreEtat === 'illisible' || s.livreEtat === 'version-inconnue' || s.livreEtat === 'erreur'
        ? `<div class="warn-box mb"><b>Le livre de ${esc(s.annee)} n'a pas pu être ouvert.</b> ${esc(s.livreMotif || '')}
           Les tableaux ci-dessous sont lus dans les paquets reçus. Tes sauvegardes sont dans les Réglages.</div>`
        : '';

    const { lignes, illisibles, anciens, manquants, source } = lignesDeLaPeriode();
    const avert = [];
    if (source === 'livre') {
      const br = s.livre.ecritures.filter(e => e.statut === 'brouillard').length;
      if (br && !s.brouillard) avert.push(`${pl(br, 'écriture')} en brouillard ${br > 1 ? 'ne sont' : 'n\'est'} pas comptée${br > 1 ? 's' : ''} ici : un brouillard n'est pas encore de la comptabilité. Coche « Voir le brouillard » pour ${br > 1 ? 'les' : 'l\''}afficher.`);
    }
    if (manquants.length) avert.push(`Il manque ${manquants.length > 3
      ? pl(manquants.length, 'mois', 'mois') + ' sur cette période'
      : manquants.map(moisLabelCourt).join(' et ')} : ces livres sont incomplets.`);
    if (anciens.length) avert.push(`${anciens.length > 1 ? 'Des paquets viennent' : 'Un paquet vient'} d'une version d'avant la 8.8.0 : pas de numéro ni de tiers (${anciens.map(moisLabelCourt).join(', ')}).`);
    illisibles.forEach(i => avert.push(`${moisLabelCourt(i.month)} : ${i.motif}.`));

    const corps = !lignes.length
      ? `<div class="empty">Aucune écriture sur cette période.</div>`
      : s.onglet === 'journal' ? vueJournal(lignes)
        : s.onglet === 'grand-livre' ? vueGrandLivre(lignes)
          : s.onglet === 'balance' ? vueBalance(lignes)
            : vueLettrage(lignes);

    // D'OÙ viennent ces chiffres. Deux sources, et l'écran le dit en toutes lettres : une balance
    // lue dans les paquets du client et une balance tenue par le cabinet ne disent pas la même
    // chose dès la première saisie, et rien ne permettrait de savoir laquelle on regarde.
    const bandeau = source === 'livre'
      ? `<div class="ok-box mb"><b>Le livre de ${esc(s.annee)}</b> — ${pl((s.livre.ecritures || []).filter(e => e.statut === 'validee').length, 'écriture validée', 'écritures validées')}${
          (s.livre.ecritures || []).some(e => e.statut === 'brouillard') ? ', ' + pl(s.livre.ecritures.filter(e => e.statut === 'brouillard').length, 'en brouillard', 'en brouillard') : ''}.
          <label class="check" style="margin-inline-start:12px"><input type="checkbox" id="lv-brouillard" ${s.brouillard ? 'checked' : ''}> Voir le brouillard</label>
          <button class="btn btn-sm" id="lv-relire2" style="margin-inline-start:12px">Relire les paquets reçus</button></div>`
      : '';

    el.innerHTML = `${sansLivre}${bandeau}${avert.length ? `<div class="warn-box mb">${avert.map(a => `<div>${esc(a)}</div>`).join('')}</div>` : ''}
      <div class="tabs" id="c-tabs">
        <button data-tab="journal" class="${s.onglet === 'journal' ? 'on' : ''}">Livre-journal</button>
        <button data-tab="grand-livre" class="${s.onglet === 'grand-livre' ? 'on' : ''}">Grand livre</button>
        <button data-tab="balance" class="${s.onglet === 'balance' ? 'on' : ''}">Balance</button>
        <button data-tab="lettrage" class="${s.onglet === 'lettrage' ? 'on' : ''}">Lettrage</button>
      </div>${corps}`;

    $$('#c-tabs button', el).forEach(b => { b.onclick = () => { s.onglet = b.dataset.tab; drawLivres(root, dossier); }; });
    const cb = $('#lv-brouillard', el);
    if (cb) cb.onchange = () => { s.brouillard = cb.checked; drawLivres(root, dossier); };
    [$('#lv-relire', el), $('#lv-relire2', el)].forEach(b => { if (b) b.onclick = () => relireLesPaquets(root, dossier); });
    const rp = $('#lv-reprendre', el); if (rp) rp.onclick = () => repriseForm(root, dossier);
    brancherVue(el, root, dossier, lignes);
  }

  // Le livre-journal : une pièce par (date, journal, numéro), numérotée 1..n. Le filtre de journal
  // et la recherche portent sur la SÉLECTION ENTIÈRE — c'est elle que le pied totalise, jamais ce
  // qui est affiché (règle des listes depuis la 2.2.0, côté entreprise).
  function vueJournal(lignes) {
    const s = livresState;
    const journaux = [...new Set(lignes.map(l => l.journal).filter(Boolean))].sort();
    const q = s.q.trim().toLowerCase();
    const gardees = lignes.filter(l => (!s.journal || l.journal === s.journal)
      && (!q || `${l.piece} ${l.tiers} ${l.label} ${l.account}`.toLowerCase().includes(q)));
    const lj = KC.journalDepuisLignes(gardees);
    const cz = KC.centralisateurDepuisLignes(gardees);
    const plates = [];
    lj.pieces.forEach(p => p.lignes.forEach((e, i) => plates.push({ ...e, numero: p.numero, premiere: i === 0 })));
    return `${barreLivres(`<select id="lv-journal"><option value="">Tous les journaux</option>${journaux.map(j => `<option value="${esc(j)}" ${s.journal === j ? 'selected' : ''}>${esc(j)}</option>`).join('')}</select>
      <input type="search" id="lv-q" placeholder="Pièce, tiers, libellé…" value="${esc(s.q)}">`, 'Exporter le livre-journal')}
      <div class="muted small mb">${pl(lj.pieces.length, 'pièce')} · ${pl(gardees.length, 'ligne')}${lj.off.length ? ` · <span class="err-inline">${pl(lj.off.length, 'pièce')} déséquilibrée${lj.off.length > 1 ? 's' : ''}</span>` : ''}</div>
      <div class="scroll-x"><table class="list compact"><thead><tr>
        <th class="r nw">N°</th><th class="nw">Date</th><th>Journal</th><th class="nw">Pièce</th><th class="nw">Compte</th>
        <th>Tiers</th><th>Libellé</th><th class="r nw">Débit</th><th class="r nw">Crédit</th><th></th></tr></thead>
      <tbody>${plates.map(e => `<tr data-piece="${esc(e.piece)}" data-mois="${esc(e.mois || '')}" class="${e.statut === 'brouillard' ? 'br-ligne' : e.statut === 'contrepassee' ? 'cp-ligne' : ''}">
        <td class="r muted">${e.premiere ? (e.statut === 'brouillard' ? '<span class="badge">brouillard</span>' : e.numero || '') : ''}</td>
        <td class="nw">${e.premiere ? esc(fmtJour(e.date)) : ''}</td>
        <td>${e.premiere ? esc(e.journal) : ''}</td>
        <td class="nw">${e.premiere ? esc(e.piece) : ''}</td>
        <td class="nw">${esc(e.account)}</td><td>${esc(e.tiers)}</td><td>${esc(e.label)}</td>
        <td class="r nw">${e.debit ? esc(money(e.debit, e.currency)) : ''}</td>
        <td class="r nw">${e.credit ? esc(money(e.credit, e.currency)) : ''}</td>
        ${e.premiere ? rowMenuCell(e.ecritureId ? 'E:' + e.ecritureId : e.piece + '|' + (e.mois || '')) : '<td class="row-actions"></td>'}</tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="7"><strong>Total de la sélection</strong></td>
        <td class="r nw"><strong>${esc(money(lj.debit))}</strong></td>
        <td class="r nw"><strong>${esc(money(lj.credit))}</strong></td><td></td></tr></tfoot></table></div>
      <details class="mt"><summary>Centralisateur : mois par mois, journal par journal</summary>
        <table class="list compact mt"><thead><tr><th class="nw">Mois</th><th>Journal</th><th class="r">Pièces</th><th class="r nw">Débit</th><th class="r nw">Crédit</th></tr></thead>
        <tbody>${cz.map(r => `<tr><td class="nw">${esc(moisLabelCourt(r.mois))}</td><td>${esc(r.journal)}</td>
          <td class="r">${r.pieces}</td><td class="r nw">${esc(money(r.debit))}</td><td class="r nw">${esc(money(r.credit))}</td></tr>`).join('')}</tbody></table>
      </details>`;
  }

  function vueGrandLivre(lignes) {
    const s = livresState;
    const gl = KC.grandLivreDepuisLignes(lignes, s.compte, null, (c, t) => t || '');
    const comptes = [...new Set(lignes.map(l => l.account))].sort();
    return `${barreLivres(`<select id="lv-compte"><option value="">Tous les comptes</option>${comptes.map(c => `<option value="${esc(c)}" ${s.compte === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`, 'Exporter le grand livre')}
      <div class="muted small mb">Ouverture inconnue : ce livre est lu dans les paquets, sans à-nouveau ${info('lv.ouverture')}</div>
      ${gl.comptes.map(c => `<div class="panel mt"><h2>${esc(c.account)}${c.label ? ' — ' + esc(c.label) : ''}</h2>
        <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Date</th><th class="nw">Pièce</th><th>Libellé</th>
          <th class="r nw">Débit</th><th class="r nw">Crédit</th><th class="r nw">Solde</th></tr></thead>
        <tbody>${c.lignes.map(e => `<tr><td class="nw">${esc(fmtJour(e.date))}</td><td class="nw">${esc(e.piece)}</td><td>${esc(e.label)}</td>
          <td class="r nw">${e.debit ? esc(money(e.debit)) : ''}</td><td class="r nw">${e.credit ? esc(money(e.credit)) : ''}</td>
          <td class="r nw">${esc(money(e.solde))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3"><strong>${pl(c.lignes.length, 'mouvement')}</strong></td>
          <td class="r nw"><strong>${esc(money(c.debit))}</strong></td><td class="r nw"><strong>${esc(money(c.credit))}</strong></td>
          <td class="r nw"><strong>${esc(money(c.solde))}</strong></td></tr></tfoot></table></div></div>`).join('')}`;
  }

  function vueBalance(lignes) {
    const s = livresState;
    // L'auxiliaire regroupe par TIERS, pas par compte : c'est ce qu'un comptable appelle une
    // balance auxiliaire, et les lignes portent leur tiers depuis la 8.8.0.
    const b = s.aux ? balanceAux(lignes) : KC.balanceDepuisLignes(lignes, null, (c, t) => t || '');
    const ecart = Math.round((b.totaux.soldeD - b.totaux.soldeC) * 1000) / 1000;
    return `${barreLivres(`<button class="btn btn-sm ${s.aux ? '' : 'btn-ghost'}" id="lv-aux">${s.aux ? 'Balance générale' : 'Balance auxiliaire'}</button>`, 'Exporter la balance')}
      <div class="${b.ok ? 'ok-box' : 'warn-box'} mb" id="lv-verdict">${b.ok ? 'Équilibrée : débit = crédit sur les trois paires de totaux.'
        : `Écart de ${esc(money(Math.abs(ecart)))} entre les soldes débiteurs et créditeurs.`}</div>
      <div class="scroll-x"><table class="list compact"><thead><tr>
        <th class="nw">${s.aux ? 'Tiers' : 'Compte'}</th><th>${s.aux ? 'Compte' : 'Intitulé'}</th>
        <th class="r nw">Mouvements débit</th><th class="r nw">Mouvements crédit</th>
        <th class="r nw">Solde débiteur</th><th class="r nw">Solde créditeur</th></tr></thead>
      <tbody>${b.rows.map(r => `<tr><td class="nw">${esc(s.aux ? r.tiers : r.account)}</td><td>${esc(s.aux ? r.account : (r.label || ''))}</td>
        <td class="r nw">${esc(money(r.debit))}</td><td class="r nw">${esc(money(r.credit))}</td>
        <td class="r nw">${r.soldeD ? esc(money(r.soldeD)) : ''}</td><td class="r nw">${r.soldeC ? esc(money(r.soldeC)) : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2"><strong>${pl(b.rows.length, s.aux ? 'tiers' : 'compte', s.aux ? 'tiers' : 'comptes')}</strong></td>
        <td class="r nw"><strong>${esc(money(b.totaux.debit))}</strong></td><td class="r nw"><strong>${esc(money(b.totaux.credit))}</strong></td>
        <td class="r nw"><strong>${esc(money(b.totaux.soldeD))}</strong></td><td class="r nw"><strong>${esc(money(b.totaux.soldeC))}</strong></td></tr></tfoot></table></div>`;
  }

  // La balance auxiliaire : par tiers. Elle se construit sur les mêmes lignes, en remplaçant la
  // clé de regroupement — on ne réécrit pas le calcul, on change ce qu'on regroupe.
  function balanceAux(lignes) {
    const avecTiers = lignes.filter(l => l.tiers).map(l => ({ ...l, account: l.tiers, tiers: l.account }));
    const b = KC.balanceDepuisLignes(avecTiers, null, (c, t) => t || '');
    return { ...b, rows: b.rows.map(r => ({ ...r, tiers: r.account, account: r.tiers || '' })) };
  }

  function vueLettrage(lignes) {
    const s = livresState;
    // Le compte par défaut est le COLLECTIF CLIENTS, pas « toute la classe 4 » : les comptes de TVA
    // y vivent aussi, et lettrer de la TVA n'a aucun sens. Ma première version prenait « 4 » et
    // annonçait un écart qui ne voulait rien dire.
    const prefixe = s.compte || '411';
    const l = KC.lettrageDepuisLignes(lignes, prefixe, K.today());
    const comptes = [...new Set(lignes.map(x => x.account).filter(a => /^4/.test(a)))].sort();
    // **Le contrôle « reste ouvert = solde du compte » ne vaut que sur un livre COMPLET.** Ici on
    // lit des paquets mois par mois, sans à-nouveau : un règlement reçu en mars pour une facture de
    // février n'a pas sa facture en face, et l'écart est NORMAL. Le crier en rouge apprendrait au
    // comptable à ignorer le rouge — c'est exactement ce que ce projet s'interdit. On explique.
    const verdict = l.concorde
      ? `<div class="ok-box mb" id="lv-verdict">Ce qui reste ouvert est bien le solde du compte : ${esc(money(l.resteOuvert))}.</div>`
      : `<div class="info-box mb" id="lv-verdict">Reste ouvert ${esc(money(l.resteOuvert))}, solde du compte ${esc(money(l.soldeCompte))} — écart de ${esc(money(Math.abs(l.ecart)))}.
         <div class="small">C'est <strong>attendu</strong> sur un livre lu mois par mois : un règlement reçu ce mois-ci pour une facture d'un mois précédent n'a pas sa facture en face. Le contrôle ne vaut que sur un livre complet, avec ses à-nouveaux.</div></div>`;
    return `${barreLivres(`<select id="lv-compte"><option value="">Clients (411)</option>${comptes.map(c => `<option value="${esc(c)}" ${s.compte === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`, 'Exporter le lettrage')}
      ${verdict}
      ${l.lettragesFaux.length ? `<div class="warn-box mb">${l.lettragesFaux.map(f =>
        `<div>Lettrage « ${esc(f.lettre) }» de ${esc(f.tiers)} : les pièces ne se soldent pas entre elles (écart ${esc(money(Math.abs(f.ecart)))}).</div>`).join('')}</div>` : ''}
      ${l.rows.map(r => `<div class="panel mt"><h2>${esc(r.tiers)} <span class="muted small">${esc(r.account)} · reste ${esc(money(r.reste))}</span></h2>
        ${r.ouverts.length ? `<div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Pièce</th><th class="nw">Date</th>
          <th class="r nw">Débit</th><th class="r nw">Crédit</th><th class="r nw">Reste</th><th></th></tr></thead>
        <tbody>${r.ouverts.map(o => `<tr data-piece="${esc(o.piece)}" data-mois="">
          <td class="nw">${esc(o.piece)}${o.retard ? ' <span class="badge b-late">en retard</span>' : ''}</td>
          <td class="nw">${esc(fmtJour(o.date))}</td>
          <td class="r nw">${o.debit ? esc(money(o.debit)) : ''}</td><td class="r nw">${o.credit ? esc(money(o.credit)) : ''}</td>
          <td class="r nw">${esc(money(o.reste))}</td><td class="row-actions"></td></tr>`).join('')}</tbody></table></div>`
        : `<div class="muted small">Tout est lettré : ${pl(r.lettrees, 'pièce')} soldée${r.lettrees > 1 ? 's' : ''}.</div>`}</div>`).join('')}`;
  }

  const barreLivres = (controles, libelleExport) => `<div class="filters">${controles}
    <button class="btn btn-sm btn-ghost" id="lv-csv">${esc(libelleExport)}</button></div>`;

  const fmtJour = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
  };

  function brancherVue(el, root, dossier, lignes) {
    const s = livresState;
    const redraw = () => drawLivres(root, dossier);
    const j = $('#lv-journal', el); if (j) j.onchange = () => { s.journal = j.value; redraw(); };
    const q = $('#lv-q', el); if (q) q.oninput = () => { s.q = q.value; redraw(); };
    const c = $('#lv-compte', el); if (c) c.onchange = () => { s.compte = c.value; redraw(); };
    const a = $('#lv-aux', el); if (a) a.onclick = () => { s.aux = !s.aux; redraw(); };
    const x = $('#lv-csv', el); if (x) x.onclick = () => exporterLivre(lignes);
    // « Ouvrir la pièce dans le paquet » : seulement si on sait DANS QUEL paquet elle vit.
    bindRowMenus(el, cle => {
      // Sur le LIVRE, la clé désigne l'écriture : c'est elle qui se valide et se contre-passe.
      // Une validée n'offre JAMAIS « Modifier » ni « Supprimer » — elle se contre-passe, et c'est
      // toute la différence entre une comptabilité et un tableur.
      if (String(cle).startsWith('E:') && s.livre) {
        const id = String(cle).slice(2);
        const e = s.livre.ecritures.find(x => x.id === id);
        if (!e) return [];
        const actions = [];
        if (e.statut === 'brouillard') {
          actions.push({ icon: 'oui', label: 'Valider cette écriture', hint: 'Elle prend son numéro et ne se modifiera plus',
            run: () => validerEcriture(root, dossier, e) });
        }
        if (e.statut === 'validee') {
          actions.push({ icon: 'contrat', label: 'Contre-passer cette écriture', hint: 'Une écriture miroir, à la date du jour',
            run: () => contrepasserEcriture(root, dossier, e) });
        }
        if (e.mois && (s.data.paquets || []).some(z => z.month === e.mois && z.path)) {
          actions.push({ icon: 'loupe', label: 'Ouvrir la pièce dans le paquet', hint: `${e.piece} · ${moisLabelCourt(e.mois)}`,
            run: () => openPack(dossier, e.mois) });
        }
        return actions;
      }
      const [piece, mois] = String(cle).split('|');
      const p = (s.data.paquets || []).find(z => z.month === mois);
      if (!p || !p.path) return [];
      return [{ icon: 'loupe', label: 'Ouvrir la pièce dans le paquet', hint: `${piece} · ${moisLabelCourt(mois)}`,
        run: () => openPack(dossier, mois) }];
    });
  }

  async function exporterLivre(lignes) {
    const s = livresState;
    const cols = s.onglet === 'balance'
      ? [['account', 'Compte'], ['label', 'Intitulé'], ['debit', 'Mouvements débit'], ['credit', 'Mouvements crédit'], ['soldeD', 'Solde débiteur'], ['soldeC', 'Solde créditeur']]
      : [['numero', 'N°'], ['date', 'Date'], ['journal', 'Journal'], ['piece', 'Pièce'], ['account', 'Compte'], ['tiers', 'Tiers'], ['label', 'Libellé'], ['debit', 'Débit'], ['credit', 'Crédit'], ['lettre', 'Lettrage']];
    const rows = s.onglet === 'balance'
      ? (s.aux ? balanceAux(lignes) : KC.balanceDepuisLignes(lignes, null, (c, t) => t || '')).rows
      : KC.journalDepuisLignes(lignes).pieces.flatMap(p => p.lignes.map(e => ({ ...e, numero: p.numero })));
    // `K.toCsvLine` échappe comme le reste du Cabinet : un libellé de facture contient un
    // point-virgule un jour sur dix, et un montant s'écrit à la virgule décimale.
    const cell = v => (typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v));
    const csv = [K.toCsvLine(cols.map(c => c[1]))]
      .concat(rows.map(r => K.toCsvLine(cols.map(c => cell(r[c[0]])))))
      .join('\r\n') + '\r\n';
    const nom = s.onglet === 'balance' ? 'balance' : s.onglet === 'grand-livre' ? 'grand-livre'
      : s.onglet === 'lettrage' ? 'lettrage' : 'livre-journal';
    try {
      // Le même chemin d'export que le reste de l'application : `cab:exportCsv` pose le BOM et la
      // fenêtre d'enregistrement. En écrire un second aurait fini par diverger sur l'un des deux.
      const r = await api.exportCsv(csv, `${nom}-${s.data.dossier.matricule || s.data.dossier.name}`);
      if (r) toast('Fichier enregistré.');
    } catch (e) { toast(plainError(e), 'error'); }
  }

  // Le chiffre d'affaires mois par mois, en barres. Une fiche client qui ne montre que des cases
  // « reçu / pas reçu » ne dit rien du client lui-même : c'est 60 % de blanc et aucune information
  // que le comptable ne connaisse déjà.
  // Les douze mois de l'année sont toujours dessinés, ceux sans paquet estompés : un graphique
  // réduit aux trois mois reçus n'apprend rien (règle de la 2.5.0 côté entreprise).
  function caChart(packs, annee) {
    const parMois = {};
    packs.forEach(p => { if (p.month.slice(0, 4) === annee && p.figures) parMois[p.month] = Number(p.figures.ca) || 0; });
    const mois = Array.from({ length: 12 }, (_, i) => `${annee}-${String(i + 1).padStart(2, '0')}`);
    const vals = mois.map(m => parMois[m]);
    const max = Math.max(1, ...vals.map(v => v || 0));
    const total = vals.reduce((s, v) => s + (v || 0), 0);
    const recus = vals.filter(v => v != null).length;
    if (!recus) return '';
    const devise = (packs.find(p => p.figures) || { figures: {} }).figures.devise || 'DT';
    return `<div class="ca-chart">
      <div class="ca-bars">${mois.map((m, i) => {
        const v = vals[i];
        const haut = v == null ? 0 : Math.max(2, Math.round((v / max) * 100));
        return `<div class="ca-col${v == null ? ' off' : ''}" title="${esc(K.monthLabel(m))} : ${v == null ? 'pas reçu' : esc(money(v, devise))}">
          <div class="ca-v">${v == null ? '' : esc(money(v, devise).replace(' ' + devise, ''))}</div>
          <div class="ca-bar" style="height:${haut}%"></div>
          <div class="ca-m">${esc(K.MONTHS_FR[i].slice(0, 3))}</div></div>`;
      }).join('')}</div>
      <div class="ca-foot"><span class="muted small">${pl(recus, 'mois', 'mois')} reçu${recus > 1 ? 's' : ''} sur 12</span>
        <strong>${esc(money(total, devise))}</strong></div></div>`;
  }

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
    // Ce que le manifeste n'annonce pas n'a été comparé à rien — ni son empreinte, ni son existence.
    // Un paquet fabriqué par SkanFact n'en contient jamais.
    const trop = files.filter(f => f.annonce === false);
    modal(
      `<h2>${esc(dossier.name)} — ${esc(p.label)}</h2>
       <p class="muted small">${pl(files.length, 'fichier')}. Commence par la page de garde : elle résume le mois et liste ce qui manque.</p>
       ${trop.length ? `<div class="warn-box mt"><strong>${pl(trop.length, 'fichier')} ${trop.length > 1 ? 'ne sont pas annoncés' : 'n\'est pas annoncé'} par le manifeste de ton client ${info('p.intrus')}</strong>
         ${trop.length > 1 ? 'Ils n\'ont' : 'Il n\'a'} été ${trop.length > 1 ? 'vérifiés' : 'vérifié'} par personne : ${trop.length > 1 ? 'ils portent' : 'il porte'} un « ? » dans la liste, et SkanFact pose une question avant l'ouverture.</div>` : ''}
       <table class="list compact mt"><tbody>${files.map((f, i) => `<tr class="clickable" data-i="${i}">
         <td>${esc(f.name)}${f.annonce === false ? ' <span class="err-inline" title="non annoncé par le manifeste">?</span>' : ''}</td><td class="r muted nw">${esc(fmtBytes(f.size))}</td></tr>`).join('')}</tbody></table>
       <div class="modal-actions"><button class="btn" id="xtr">Tout extraire…</button><button class="btn btn-primary" id="ok">Fermer</button></div>`,
      (layer, close) => {
        $('#ok', layer).onclick = close;
        $('#xtr', layer).onclick = () => { close(); extractPack(dossier, month, password); };
        $$('tr[data-i]', layer).forEach(tr => {
          tr.onclick = async () => {
            const f = files[Number(tr.dataset.i)];
            // Un fichier que le manifeste n'annonce pas a pu être glissé dans le paquet après coup,
            // par quelqu'un d'autre que le client. Le contrôle d'extension reste le filet du dessous ;
            // celui-ci prévient AVANT, quand on peut encore ne pas cliquer.
            if (f.annonce === false) {
              const suite = await confirmDialog('Ce fichier n\'est pas annoncé par ton client',
                `<p><strong>${esc(f.name)}</strong> se trouve dans le paquet, mais le manifeste ne le mentionne pas : son empreinte n'a été comparée à rien.</p>
                 <p class="muted small">Un paquet fabriqué par SkanFact n'en contient jamais. Ouvre-le seulement si tu sais d'où il vient, et demande à ton client dans le doute.</p>`,
                'Ouvrir quand même', true);
              if (!suite) return;
            }
            try {
              const r = await api.openInPack(p.path, f.name, password);
              // Un fichier dont l'extension n'est pas celle d'un document n'est pas lancé : c'est le
              // nom choisi par l'expéditeur qui déciderait sinon quel programme s'exécute.
              if (r && r.opened === false) toast(r.reason, 'error');
            } catch (e) { toast(plainError(e), 'error'); }
          };
        });
      }
    );
  }

  // Prévenir le client que son envoi est arrivé. Il envoie son mois et n'entend plus parler de rien :
  // il ne sait ni si c'est arrivé, ni si c'était lisible, ni s'il manquait quelque chose. Trois
  // lignes du comptable valent mieux que trois relances du client.
  function accuseReception(dossier, pack, onDone) {
    const m = K.accuseMail(S.cabinet, dossier, pack);
    let change = () => false;
    modal(
      `<h2>Accuser réception à ${esc(dossier.name)}</h2>
       <label class="field">Destinataire<input type="text" id="a-to" value="${esc(m.to)}" placeholder="adresse@client.tn"></label>
       <label class="field mt">Objet<input type="text" id="a-sub" value="${esc(m.subject)}"></label>
       <label class="field mt">Message<textarea id="a-body" rows="10">${esc(m.body)}</textarea></label>
       <p class="muted small mt">Le message s'ouvre dans ta messagerie : rien ne part sans que tu cliques sur « Envoyer ».</p>
       <div class="modal-actions"><button class="btn" id="no">${onDone ? 'Passer' : 'Annuler'}</button>
       <button class="btn" id="copy">Copier</button>
       <button class="btn btn-primary" id="ok">Ouvrir dans ma messagerie</button></div>`,
      (layer, close) => {
        change = suivreSaisie(layer);
        $('#no', layer).onclick = () => { close(); if (onDone) onDone(); };
        $('#copy', layer).onclick = async () => {
          try { await navigator.clipboard.writeText($('#a-body', layer).value); toast('Texte copié.'); }
          catch { toast('Copie impossible.', 'error'); }
        };
        $('#ok', layer).onclick = async () => {
          const to = $('#a-to', layer).value.trim();
          if (to && to !== dossier.email) { try { await api.saveDossier(dossier.id, { email: to }); } catch {} }
          await api.mail({ to, subject: $('#a-sub', layer).value, body: $('#a-body', layer).value });
          close(); if (onDone) onDone();
        };
      },
      () => { if (onDone) onDone(); },
      { garde: () => change() }
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
    let change = () => false;
    modal(
      `<h2>Nouveau dossier client</h2>
       <p class="muted small">Ajoute un client même s'il n'utilise pas encore SkanFact ${info('d.manual')} : il compte dans ton portefeuille,
       et rien ne lui est réclamé tant qu'il n'a pas commencé.</p>
       ${dossierFields(empty)}
       <div class="modal-actions"><button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Créer le dossier</button></div>`,
      (layer, close) => {
        change = suivreSaisie(layer);
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
      },
      null,
      { garde: () => change() }
    );
  }

  function dossierForm(dossier) {
    let change = () => false;
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
        change = suivreSaisie(layer);
        $('#no', layer).onclick = close;
        $('#del', layer).onclick = async () => {
          const n = (dossier.packs || []).length;
          const ok = await confirmTyped('Supprimer ce dossier ?',
            `<p>Le dossier <strong>${esc(dossier.name)}</strong> et ${n ? `ses ${pl(n, 'paquet')}` : 'son historique'} seront <strong>effacés de ce poste</strong>.
             ${n ? 'Les pièces comptables que ce client t\'a envoyées seront supprimées du disque.' : ''}</p>
             <p class="muted small">Une sauvegarde est prise juste avant. Si le client est simplement parti, préfère <strong>l'archivage</strong> : il disparaît des listes sans rien perdre.</p>
             ${backupInfo && backupInfo.external && backupInfo.external.dir ? '<p class="muted small">La copie externe n\'est pas touchée : une sauvegarde qui efface ce que tu effaces n\'en est plus une. Si le client demande l\'effacement de ses pièces, supprime-les aussi là-bas.</p>' : ''}`,
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
            close();
            // Corriger le matricule d'un dossier sans paquet change son identifiant : il faut suivre,
            // sinon la fiche qu'on vient d'enregistrer affiche « ce dossier n'existe plus ».
            if (r.id && r.id !== dossier.id) location.hash = '#/dossier/' + encodeURIComponent(r.id);
            else render();
            toast(r.moved ? `Fiche enregistrée · ${pl(r.moved, 'paquet')} rangé${r.moved > 1 ? 's' : ''} au nouveau nom.` : 'Fiche enregistrée.');
          } catch (e) { toast(plainError(e), 'error'); }
        };
      },
      null,
      { garde: () => change() }
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
      ${rel.due && rel.total ? `<div class="banner"><span>On est le <strong>${rel.jour}</strong> : tu as fixé le ${rel.day} du mois comme jour de relance.
        ${[
    rel.count ? `${pl(rel.count, 'dossier')} ${rel.count > 1 ? 'ont' : 'a'} des mois manquants` : '',
    rel.provisoires ? `${pl(rel.provisoires, rel.count ? 'autre' : 'dossier')} ${rel.provisoires > 1 ? 'ont' : 'a'} envoyé un mois qui n'est pas clôturé` : ''
  ].filter(Boolean).join(', et ')}.</span></div>` : ''}
      ${rows.length ? `<div class="scroll-x"><table class="list">
        <thead><tr><th class="nw">Client</th><th class="nw">Contact</th><th class="nw">Ce qui manque</th><th class="nw">Dernière relance</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td class="nw"><span class="dot-lvl ${r.level === 'ok' ? '' : esc(r.level)}"></span>${esc(r.name)}</td>
          <td class="muted nw">${esc(r.email || r.phone || '— à renseigner')}</td>
          <td>${r.missingCount
            ? esc(K.missingLabel(r.missingMonths))
            : `<span class="muted">${pl(r.provisionalCount, 'mois', 'mois')} non clôturé${r.provisionalCount > 1 ? 's' : ''}</span>`}</td>
          <td class="muted nw">${r.lastRelanceAt ? esc(fmtDay(r.lastRelanceAt)) + ` <span class="small">(${esc(ago(r.lastRelanceAt))}, ${esc(labelOf(K.RELANCE_WAYS, r.lastRelanceVia) || r.lastRelanceVia)})</span>` : 'jamais'}</td>
          ${rowMenuCell(r.id, `<button class="btn btn-primary btn-sm" data-rel="${esc(r.id)}">Écrire</button>`)}</tr>`).join('')}</tbody></table></div>`
        : `<div class="todo-ok">Personne à relancer : tous tes dossiers sont à jour.</div>`}`;
    const findRow = id => K.dossierList(S).find(x => x.id === id);
    // « Écrire » reste le seul bouton visible de la ligne : c'est le geste pour lequel cette page
    // existe, et l'enfouir dans un menu ajouterait un clic à ce qu'on vient y faire. Le reste — qui
    // n'a pas à occuper une place permanente — vit dans le menu.
    $$('[data-rel]', view).forEach(b => { b.onclick = e => { e.stopPropagation(); const r = findRow(b.dataset.rel); if (r) writeRelance(r); }; });
    const appeler = async (r) => {
      try { await api.tel({ number: r.phone }); await recordRelance(r, 'tel'); render(); }
      catch (e) { toast(plainError(e), 'error'); }
    };
    bindRowMenus(view, id => {
      const r = findRow(id); if (!r) return [];
      return [
        { icon: 'cloche', label: 'Écrire la relance', hint: 'Le message tout prêt, avec les mois qui manquent', run: () => writeRelance(r) },
        r.phone ? { icon: 'telephone', label: 'Appeler le client', hint: `${r.phone} — l'appel est noté comme une relance`, run: () => appeler(r) } : null,
        { sep: true },
        { icon: 'dossier', label: 'Ouvrir le dossier', hint: 'Ses paquets, ses chiffres et son historique', run: () => { location.hash = '#/dossier/' + encodeURIComponent(r.id); } }
      ];
    });
    const g = $('#group'); if (g) g.onclick = () => groupRelance(rows.slice());
  }

  async function recordRelance(row, via, note) {
    try { S = await api.noteRelance(row.id, row.missingMonths || [], via, note || ''); }
    catch (e) { toast(plainError(e), 'error'); }
  }

  function writeRelance(row, onDone) {
    const m = K.relanceMail(S.cabinet, row);
    let change = () => false;
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
        change = suivreSaisie(layer);
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
          // Sans destinataire, la messagerie s'ouvre sur un message qui ne part pas — et le journal
          // de relance se mettait à mentir, ce qui est pire que de ne rien noter.
          if (!to) return toast('Renseigne une adresse : sans elle, rien ne partira et la relance serait notée à tort.', 'error');
          if (to !== row.email) {
            try { await api.saveDossier(row.id, { email: to }); }
            catch (e) { return toast('L\'adresse n\'a pas pu être enregistrée : ' + plainError(e), 'error'); }
          }
          await api.mail({ to, subject: $('#r-sub', layer).value, body: $('#r-body', layer).value });
          await recordRelance(row, 'email');
          close(); render(); if (onDone) onDone();
        };
      },
      () => { if (onDone) onDone(); },
      { garde: () => change() }
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

  // Les trois onglets, et les panneaux qui vivent dans chacun. Mêmes noms que l'app entreprise :
  // un comptable qui ouvre le SkanFact d'un client doit retrouver le même rangement.
  //
  // Mesuré avant de découper (npm run e2e:parametres) : 0,74 écran pour le premier onglet, 1 pour le
  // deuxième, 0,6 pour le troisième. Le troisième reste léger — c'est le prix de la symétrie avec
  // l'autre application, et c'est pour ça que « Signaler un problème » a quitté Sécurité, où il
  // n'avait rien à faire, pour rejoindre « Aide et dépannage ».
  const REG_TABS = [['cabinet', 'Mon cabinet'], ['donnees', 'Données et sécurité'], ['app', 'L\'application']];

  // Une seule table pour TROIS choses qui, écrites à trois endroits, divergent toujours : le titre du
  // panneau, les mots que sa recherche connaît sans qu'ils soient à l'écran, et son entrée de palette
  // Cmd+K. Même mécanique que SETTINGS_PANNEAUX côté entreprise, et pour la même raison : là-bas, six
  // alias écrits à la main ont nommé des onglets disparus et la palette n'a plus rien rendu.
  const REG_PANNEAUX = {
    'pan-cabinet': { onglet: 'cabinet', titre: 'Ton cabinet', mots: 'cabinet nom email telephone jour relance tva cnss depot echeance' },
    'pan-appairage': { onglet: 'cabinet', titre: 'Le fichier à remettre à tes clients', mots: 'appairage fichier client empreinte cle publique chiffrer skanpair' },
    'pan-inbox': { onglet: 'donnees', titre: 'Boîte de réception', mots: 'boite reception dossier surveille paquets arrives import mail' },
    'pan-backup': { onglet: 'donnees', titre: 'Sauvegardes', mots: 'sauvegarde restaurer copie externe usb icloud filet perdu' },
    'pan-secu': { onglet: 'donnees', titre: 'Sécurité', mots: 'securite mot de passe cle de secours verrouiller chiffrement empreinte' },
    'pan-maj': { onglet: 'app', titre: 'Mises à jour', mots: 'mise a jour version telecharger installer jeton token maj' },
    'pan-support': { onglet: 'app', titre: 'Aide et dépannage', mots: 'probleme bug journal log support signaler panne aide idee suggestion amelioration proposer fonctionnalite demande manque' },
    'pan-exemple': { onglet: 'app', titre: 'Exemple', mots: 'exemple demo dossiers fictifs essayer decouvrir' }
  };
  const panneauReg = (id, extra) => {
    const p = REG_PANNEAUX[id] || { titre: id, mots: '' };
    return `<div class="panel" id="${id}" data-mots="${esc(p.mots)}"><h2>${esc(p.titre)}${extra ? ' ' + extra : ''}</h2>`;
  };
  // L'onglet affiché, et le panneau qu'on veut amener à l'écran en arrivant. Les deux survivent à la
  // navigation : c'est ce qui permet à « À faire → Enregistrer ma clé de secours » d'atterrir sur le
  // bon panneau, dans le bon onglet, plutôt qu'en haut d'une page.
  let reglagesTab = 'cabinet';
  let reglagesFocus = '';

  function drawReglages(view) {
    const c = S.cabinet || {};
    if (!REG_TABS.some(t => t[0] === reglagesTab)) reglagesTab = 'cabinet';
    view.innerHTML = `
      <div class="page-head"><h1>Réglages</h1>
        <div class="actions set-search">
          <input type="search" id="set-q" placeholder="Chercher un réglage…" autocomplete="off" spellcheck="false">
        </div></div>
      <div id="set-res" class="set-res" hidden></div>
      ${recoveryBanner()}
      <div id="set-corps">
      <div class="tabs" id="set-tabs" role="tablist">${REG_TABS.map(([id, label]) =>
        `<button role="tab" data-tab="${id}" class="${id === reglagesTab ? 'active' : ''}">${label}</button>`).join('')}</div>
      <div class="set-somm" id="set-somm"></div>
      <section data-pane="cabinet"${reglagesTab === 'cabinet' ? '' : ' hidden'}>
      ${panneauReg('pan-cabinet')}
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

      ${panneauReg('pan-appairage', info('cab.pairing'))}
        <p class="small">Chaque client doit importer ce fichier une fois, dans <strong>Paramètres → Envois → Ton cabinet comptable</strong> de son SkanFact.
        À partir de là, les paquets qu'il fabrique sont chiffrés <strong>pour toi seul</strong> : personne d'autre ne peut les ouvrir,
        même en interceptant le mail, et il n'a plus aucun mot de passe à te communiquer.</p>
        <div class="mt"><div class="muted small">${lbl('Empreinte de ton cabinet', 'cab.fingerprint')}</div>
          <div class="fingerprint">${esc(c.fingerprint || '—')}</div></div>
        <p class="muted small mt">Cette empreinte identifie ton cabinet. Ton client la voit après l'import : s'il te la lit au téléphone
        et qu'elle correspond, c'est bien à toi qu'il envoie.</p>
        <div class="modal-actions"><button class="btn btn-primary" id="c-pair">Enregistrer le fichier d'appairage…</button></div>
      </div>

      </section>

      <!-- Les trois panneaux ci-dessous sont remplis APRÈS coup par drawBackupPanels(). Ils restent
           donc dans le document quel que soit l'onglet affiché — un onglet dessiné paresseusement
           les laisserait sur « Chargement… » pour toujours, sans une erreur dans aucune console. -->
      <section data-pane="donnees"${reglagesTab === 'donnees' ? '' : ' hidden'}>
      ${panneauReg('pan-inbox')}<p class="muted small">Chargement…</p></div>
      ${panneauReg('pan-backup')}<p class="muted small">Chargement…</p></div>
      ${panneauReg('pan-secu')}<p class="muted small">Chargement…</p></div>
      </section>

      <section data-pane="app"${reglagesTab === 'app' ? '' : ' hidden'}>
      ${panneauReg('pan-maj')}<div id="upd-panel"><p class="muted small">Chargement…</p></div></div>

      ${panneauReg('pan-support')}
        <p class="small">Si quelque chose ne va pas, cette fenêtre rassemble ce qu'il faut pour le comprendre :
        la version, le système, et le journal de l'application. Rien n'en part tout seul.</p>
        <p class="small">Et s'il manque quelque chose, dites-le : SkanFact Cabinet est écrit par une seule personne,
        et ce sont les cabinets qui s'en servent qui décident de la suite.</p>
        <div class="modal-actions"><button class="btn" id="s-support">Signaler un problème…</button>
        <button class="btn" id="s-idee">Proposer une amélioration…</button></div>
      </div>

      ${panneauReg('pan-exemple')}
        ${(S.dossiers || []).some(d => d.demo)
          ? `<p>Cinq dossiers <strong>fictifs</strong> sont chargés : ils montrent les quatre situations que tu rencontreras.
             Ils disparaîtront d'eux-mêmes au premier vrai paquet importé.</p>
             <div class="modal-actions"><button class="btn btn-danger" id="r-demo-off">Effacer l'exemple</button></div>`
          : `<p>Tu peux charger cinq clients fictifs pour voir à quoi ressemble l'application pleine : un client à jour,
             un en retard, un qui n'a envoyé que du provisoire, un dont les pièces sont incomplètes.</p>
             <p class="small muted">C'est aussi ce qu'il faut montrer à un confrère à qui tu parles de SkanFact.
             L'exemple s'efface tout seul dès qu'un vrai paquet arrive : aucun risque de mélange.</p>
             <div class="modal-actions"><button class="btn btn-primary" id="r-demo-on">Charger l'exemple</button></div>`}
      </div>
      </section>
      </div>`;
    drawUpdatePanel();
    drawBackupPanels();
    // Les onglets, le sommaire et la recherche : la mécanique vient de src/renderer/reglages.js,
    // partagée avec l'app entreprise, qui sait déjà basculer d'onglet — il suffit de lui dire
    // comment. Les trois rappels vont ENSEMBLE : n'en donner que deux laisse `montrer()`
    // silencieusement inerte, et on atterrit sur le bon panneau dans un onglet masqué.
    const showTab = id => {
      reglagesTab = id;
      $$('#set-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
      $$('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== id; });
      reg.rafraichirSommaire(id);
      $('#view').scrollTop = 0;
    };
    const reg = Reglages.installer({
      corps: $('#set-corps'), champ: $('#set-q'), resultats: $('#set-res'), sommaire: $('#set-somm'),
      nomOnglet: pane => (REG_TABS.find(t => t[0] === pane) || [pane, pane])[1],
      ouvrirOnglet: pane => showTab(pane),
      ongletCourant: () => reglagesTab,
      pluriel: pl,
      rienTrouve: () => `<div class="empty"><p>Aucun réglage ne porte ces mots. Essaie un seul mot —
        ou regarde dans l'<a href="#/aide">aide</a>.</p></div>`
    });
    $$('#set-tabs button').forEach(b => b.onclick = () => { reglagesFocus = ''; showTab(b.dataset.tab); });
    showTab(reglagesTab);
    // Un lien qui promet « la clé de secours » ou « les sauvegardes » doit amener LE PANNEAU, pas le
    // haut d'un onglet. Même porte que le sommaire et que la recherche : l'onglet suit tout seul.
    if (reglagesFocus) {
      const vise = reglagesFocus;
      reglagesFocus = '';
      reg.montrer(vise);
    }
    const sup = $('#s-support'); if (sup) sup.onclick = supportDialog;
    const idee = $('#s-idee'); if (idee) idee.onclick = ideeDialog;
    bindRecoveryBanner(view);
    if ($('#r-demo-on')) $('#r-demo-on').onclick = async () => {
      S = await api.demo(true); toast('Exemple chargé : ces cinq dossiers sont fictifs.'); location.hash = '#/dossiers';
    };
    if ($('#r-demo-off')) $('#r-demo-off').onclick = async () => { S = await api.demo(false); render(); toast('Exemple effacé.'); };
    $('#c-save').onclick = async () => {
      // Les trois jours sont bornés côté processus principal, qui écarte SILENCIEUSEMENT ce qui
      // sort des bornes et remet l'ancienne valeur. L'écran, lui, affichait « ✓ enregistré » en
      // vert et gardait la valeur refusée sous les yeux : on repartait convaincu d'avoir réglé son
      // calendrier. On refuse ici, on montre le champ, et on ne félicite plus personne à tort.
      const bornes = [['#c-day', 1, 28, 'Le jour de relance'], ['#c-tvaday', 1, 31, 'Le jour de dépôt de la TVA'],
        ['#c-cnssday', 1, 31, 'Le jour de dépôt CNSS']];
      for (const [sel, min, max, quoi] of bornes) {
        const v = Number($(sel).value);
        if (!Number.isFinite(v) || v < min || v > max || v !== Math.round(v)) {
          return refus(sel, `${quoi} doit être un jour du mois, entre ${min} et ${max}.`);
        }
      }
      try {
        S = await api.saveCabinet({
          name: $('#c-name').value.trim(), email: $('#c-email').value.trim(), phone: $('#c-phone').value.trim(),
          settings: {
            relanceDay: Number($('#c-day').value),
            deadlines: { tvaDay: Number($('#c-tvaday').value), cnssDay: Number($('#c-cnssday').value) }
          }
        });
        $('#brand-cab').textContent = S.cabinet.name || 'Cabinet';
        // L'écran affiche ce qui a VRAIMENT été retenu : `migrate` peut encore corriger une valeur,
        // et un champ qui montre autre chose que l'état enregistré est un mensonge de plus.
        const d = K.deadlineSettings(S);
        $('#c-day').value = Number((S.settings || {}).relanceDay) || 10;
        $('#c-tvaday').value = d.tvaDay; $('#c-cnssday').value = d.cnssDay;
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
    const b = $('#pan-backup'), s = $('#pan-secu'), inb = $('#pan-inbox');
    if (!b || !s || !inb) return;
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

      <h3 class="mt">Sauvegardes et copies</h3>
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
        <!-- Un bouton fantôme n'a ni bordure ni couleur, et c'est ici le bouton du pire jour :
             celui où l'on vient rechercher ce qu'on a perdu. Il ressemble maintenant à un bouton. -->
        <td class="actions row-actions"><button class="btn btn-sm" data-restore="${i}">Restaurer cette sauvegarde…</button></td></tr>`).join('')}</tbody></table></div>` : ''}`;

    // La boîte de réception vivait DANS le panneau des sauvegardes, sous un simple <h3>. Ce n'est
    // pas un filet : c'est la porte par laquelle les paquets ARRIVENT, le geste le plus fréquent de
    // l'application. Elle a son panneau, et il passe avant les filets.
    inb.innerHTML = `<h2>${lbl('Boîte de réception', 'b.inbox')}</h2>
      <p class="small">Le dossier où tu ranges les paquets reçus par mail. SkanFact regarde ce qui est arrivé et te le propose —
      il n'importe jamais tout seul, et n'efface jamais rien.</p>
      <div class="kv">
        <div><span>Dossier surveillé</span><span>${inboxInfo && inboxInfo.dir
          ? esc(inboxInfo.dir) + (inboxInfo.erreur ? ` <span class="err-inline">⚠ ${esc(inboxInfo.erreur)}</span>`
            : ` <span class="muted small">${(inboxInfo.nouveaux || []).length ? pl(inboxInfo.nouveaux.length, 'paquet') + ' en attente' : 'rien de nouveau'}</span>`)
          : '<span class="muted">aucun — tu importes les paquets un par un</span>'}</span></div>
      </div>
      <div class="modal-actions wrap">
        <button class="btn" id="i-pick">${inboxInfo && inboxInfo.dir ? 'Changer de dossier…' : 'Choisir un dossier…'}</button>
        ${inboxInfo && inboxInfo.dir ? '<button class="btn" id="i-off">Ne plus surveiller</button>' : ''}
      </div>`;

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
        <button class="btn" id="s-lock">Verrouiller maintenant</button>
      </div>

      <p class="muted small mt">Tu changes d'ordinateur ? N'y crée <strong>jamais</strong> un cabinet neuf : il aurait une autre empreinte,
      et les paquets de tes clients y seraient refusés. Emporte ton dossier de copie, puis reprends-le depuis l'écran de mot de passe
      (« J'ai déjà un cabinet sur un autre ordinateur »). <a href="#/aide">Aide → Changer d'ordinateur</a>.</p>

      <p class="muted small mt">À VÉRIFIER avec ton assureur ou ton Ordre : la conservation des pièces de tes clients sur ce poste
      relève des mêmes obligations que tes archives papier.</p>`;

    const ip = $('#i-pick', inb);
    if (ip) ip.onclick = async () => {
      try {
        const r = await api.pickInbox();
        if (r) { inboxInfo = r; drawBackupPanels(); toast(r.nouveaux.length ? `${pl(r.nouveaux.length, 'paquet')} en attente dans ce dossier.` : 'Dossier surveillé.'); }
      } catch (e) { toast(plainError(e), 'error'); }
    };
    const io = $('#i-off', inb);
    if (io) io.onclick = async () => { inboxInfo = await api.clearInbox(); drawBackupPanels(); };
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
  }

  function recoveryLine() {
    const at = recoveryAt;
    return at
      ? `<span class="ok-inline">✓ Clé de secours enregistrée le ${esc(fmtDay(at))}.</span> <span class="muted small">Vérifie qu'elle n'est pas sur ${CE_POSTE()}.</span>`
      : `<span class="err-inline">⚠ Tu n'as jamais enregistré de clé de secours.</span> <span class="muted small">C'est le filet le plus important : trois minutes maintenant, ou tout est perdu le jour où le disque lâche.</span>`;
  }

  // Le bandeau qui ne peut pas se cacher derrière un onglet. Les onglets rangent — mais ils rangent
  // AUSSI ce qu'il ne faut jamais ranger : cet avertissement-ci ne vivait que dans le panneau
  // Sécurité, à un écran et demi de défilement. Il est maintenant au-dessus de la barre d'onglets,
  // et dans « À faire » sur la page d'accueil. Il disparaît le jour où la clé est enregistrée.
  function recoveryBanner() {
    if (recoveryAt !== null) return '';
    return `<div class="banner danger"><span><strong>Tu n'as pas de clé de secours.</strong>
      Si cet ordinateur est perdu, aucun paquet déjà reçu ne pourra plus être ouvert et tes clients devront tous
      refaire leur appairage.</span>
      <button class="btn btn-primary btn-sm nw" id="rec-go">Enregistrer ma clé…</button></div>`;
  }
  // `recoveryAt` vaut `undefined` tant qu'on ne sait pas (la date vit dans app-config.json et arrive
  // par une promesse), `null` quand il n'y en a pas, un nombre sinon. La distinction compte : sur
  // « je ne sais pas encore », on ne crie pas.
  let recoveryAt;
  // Une seule demande par session : l'import est déjà fait quand on la pose, et redemander à chaque
  // fois ferait cliquer « Plus tard » sans lire.
  let cleReclameeCetteSession = false;
  function chargerRecovery(redessiner) {
    if (!api.recoveryStatus) { recoveryAt = null; return Promise.resolve(); }
    const avant = recoveryAt;
    return api.recoveryStatus().then(r => {
      recoveryAt = (r && r.exportedAt) || null;
      // Un état lu une fois au démarrage se périme (règle 7.1.x) : on ne redessine que s'il a
      // vraiment changé, pour ne pas effacer une saisie en cours.
      if (redessiner && recoveryAt !== avant && !$('#modal-root').children.length && !$('#palette-root')) render();
    }).catch(() => { recoveryAt = null; });
  }

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
       <div class="warn-box">Range-le <strong>ailleurs que sur ${CE_POSTE()}</strong> : une clé USB dans un tiroir, un coffre, chez ton associé.
       Une clé de secours posée à côté de l'ordinateur ne protège de rien.</div>
       <label class="field mt">Mot de passe <strong>du cabinet</strong><input type="password" id="p0" autocomplete="current-password"></label>
       <p class="muted small">Redemandé parce que ce fichier ouvre les comptabilités de tous tes clients : sans ça, n'importe qui passant devant ce poste déverrouillé repartirait avec.</p>
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
            const r = await api.exportRecovery(p1.value, $('#p0', layer).value);
            if (!r) return;
            close();
            recoveryAt = Date.now();
            // Le bandeau et la ligne « À faire » vivent hors de ces trois panneaux : sans un
            // redessin complet, l'application continuerait de reprocher à quelqu'un ce qu'il vient
            // très exactement de faire (règle 7.17.0).
            drawBackupPanels();
            if (location.hash.startsWith('#/reglages') || location.hash.startsWith('#/dossiers')) render();
            if (onDone) onDone();
            const show = await confirmDialog('Clé de secours enregistrée',
              `<p class="muted small">${esc(r.path)}</p><p>Copie-la maintenant sur une clé USB ou un disque que tu ranges ailleurs, et <strong>efface-la de ${CE_POSTE()}</strong>.</p>`,
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
    // Un gel passé est la première chose à joindre à un rapport : c'est justement ce dont aucune
    // console n'aurait gardé la trace.
    const gel = inf.dernierGel ? `\nDernier blocage : ${inf.dernierGel.at} (${inf.dernierGel.silence} s sans réponse)` : '';
    modal(
      `<h2>Signaler un problème</h2>
       <p class="small">Copie ces informations dans ton message : elles disent où en est ton installation, sans rien révéler du contenu de tes dossiers.</p>
       <pre class="code-box" id="sup">SkanFact Cabinet ${esc(inf.version || '')}
Système : ${esc(inf.platform || '')} ${esc(inf.arch || '')} · Electron ${esc(inf.electron || '')}
Dossiers : ${inf.dossiers || 0} · Paquets : ${inf.paquets || 0}
Copie externe : ${esc((inf.external && inf.external.dir) || 'aucune')}${inf.external && inf.external.lastError ? ' (erreur : ' + esc(inf.external.lastError) + ')' : ''}${esc(gel)}</pre>
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

  // ---------- proposer une amélioration (8.1.0) ----------
  //
  // Le pendant de « Signaler un problème ». L'application savait recevoir ce qui ne marche pas et
  // n'avait aucune porte pour ce qui manque — alors qu'un cabinet qui traite soixante dossiers voit
  // en un mois ce que l'éditeur ne verrait pas en un an.
  //
  // Contrairement au signalement, elle n'emporte NI journal NI état du portefeuille : une idée n'a
  // pas de trace technique, et joindre le nombre de dossiers « au cas où » serait prendre une
  // information sur le cabinet sans raison. Seule la version part, pour pouvoir répondre que la
  // chose existe déjà.
  //
  // Les deux questions ne sont pas interchangeables : on demande ce qu'on aimerait faire, PUIS
  // comment on s'en sort aujourd'hui. C'est la seconde qui apprend quelque chose — on propose
  // toujours une solution, et la solution imaginée est rarement la meilleure.
  async function ideeDialog() {
    let inf = {};
    try { inf = await api.support(); } catch {}
    const tech = `SkanFact Cabinet ${inf.version || '?'} · ${inf.platform || '?'}`;
    modal(
      `<h2>Proposer une amélioration</h2>
       <p class="small">SkanFact Cabinet est écrit par une seule personne, et ce sont les cabinets qui s'en servent tous les jours qui décident de la suite. Dites ce qui vous manque — même si cela vous paraît petit.</p>
       <label class="field">Ce que vous aimeriez faire
         <textarea id="idee-quoi" rows="3" placeholder="Ex. : relancer d'un seul geste tous les clients qui n'ont pas envoyé août."></textarea></label>
       <label class="field">Comment vous faites aujourd'hui
         <textarea id="idee-auj" rows="3" placeholder="Ex. : j'ouvre chaque dossier et j'écris un mail à la main."></textarea></label>
       <p class="small muted">Cette seconde question est celle qui sert le plus : elle dit le vrai problème, et pas seulement la solution imaginée.</p>
       <p class="small muted">Joint automatiquement : ${esc(tech)}. Rien d'autre — ni journal, ni nom de dossier, ni chiffre de vos clients.</p>
       <div class="modal-actions"><button class="btn" data-close>Annuler</button>
       <button class="btn btn-primary" id="idee-send">Préparer le message</button></div>`,
      (layer, close) => {
        $('#idee-send', layer).onclick = async () => {
          const quoi = $('#idee-quoi', layer).value.trim();
          if (!quoi) return refus('#idee-quoi', 'Dites en une phrase ce que vous aimeriez faire.');
          const auj = $('#idee-auj', layer).value.trim();
          const body = 'Bonjour,\n\nUne idée pour SkanFact Cabinet.\n\n'
            + `Ce que j'aimerais faire :\n${quoi}\n\n`
            + `Comment je fais aujourd'hui :\n${auj || '(non précisé)'}\n\n`
            + `--- version ---\n${tech}\n`;
          await api.mail({ to: 'contact@skanfact.tn', subject: `Idée pour SkanFact Cabinet ${inf.version || ''}`, body });
          close(); toast('Message préparé — relisez-le avant de l\'envoyer.');
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
            <div class="warn-box mt"><strong>Sans clé de secours, si ${CE_POSTE()} disparaît, aucun paquet déjà reçu ne pourra plus être ouvert.</strong>
            Ni par nous, ni par personne. Tes clients devraient tous réimporter un nouvel appairage.</div>
            <div class="wiz-steps mt">
              <div class="wiz-step"><div><strong>1. Une copie hors de cet ordinateur</strong>
                <div class="muted small">Clé USB, disque externe, iCloud Drive. La base, les sauvegardes et les paquets y seront recopiés à chaque enregistrement.</div></div>
                <button class="btn" id="w-ext">Choisir un dossier…</button><span class="ok-inline" id="w-ext-ok" hidden>✓ fait</span></div>
              <div class="wiz-step"><div><strong>2. La clé de secours</strong>
                <div class="muted small">Un petit fichier protégé par son propre mot de passe, à ranger ailleurs que sur ${CE_POSTE()}.</div></div>
                <button class="btn btn-primary" id="w-rec">Enregistrer la clé…</button><span class="ok-inline" id="w-rec-ok" hidden>✓ fait</span></div>
            </div>
            <p class="muted small mt">Tu peux les faire plus tard (Réglages → Données et sécurité → Sécurité), mais « plus tard » est exactement le moment où l'on oublie.</p>`,
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
            (Paramètres → Envois → Ton cabinet comptable). À partir de là, les paquets qu'il fabrique sont chiffrés
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
  //
  // La palette vit à z-index 60 dans la feuille partagée, sous les fenêtres (400), sous l'assistant
  // (250) et sous l'écran de verrouillage (200). Elle s'ouvrait quand même — DERRIÈRE — et prenait
  // le clavier avec `focus()` : la frappe suivante partait dans un champ invisible. Rien à l'écran,
  // rien en console, et le comptable en concluait que l'application était bloquée. C'est le
  // symptôme exact de la 5.2.2, réintroduit par une palette neuve.
  //
  // Ce garde ne vaut que dans un sens : il refuse d'ouvrir la palette sous une fenêtre. L'autre sens
  // — une fenêtre qui s'ouvre pendant que la palette est là — est tenu par `modal()`, qui la referme.
  function palettePossible() {
    return !$('#palette-root')
      && !$('#modal-root').children.length
      && !$('#setup')
      && !($('#lock-screen') && !$('#lock-screen').hidden);
  }

  function openPalette() {
    if (!palettePossible()) return;
    const root = document.createElement('div');
    root.id = 'palette-root';
    root.innerHTML = `<div class="palette">
      <input type="text" id="pal-q" placeholder="Chercher un client, ou taper une action…" autocomplete="off" spellcheck="false">
      <div class="results" id="pal-res"></div>
      <div class="hint">↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</div></div>`;
    document.body.appendChild(root);
    const close = () => { root.remove(); document.removeEventListener('keydown', onKey, true); fermerPalette = null; };
    let sel = 0, items = [];

    const actions = [
      { kind: 'action', main: 'Importer un paquet…', go: () => doImport() },
      { kind: 'action', main: 'Nouveau dossier client…', go: () => newDossierForm() },
      { kind: 'action', main: 'Sauvegarder maintenant', go: () => quickBackup() },
      { kind: 'action', main: 'Relances', go: () => { location.hash = '#/relances'; } },
      { kind: 'action', main: 'Échéances', go: () => { location.hash = '#/echeances'; } },
      { kind: 'action', main: 'Écritures — exporter un mois', go: () => { location.hash = '#/ecritures'; } },
      // Un réglage par PANNEAU, engendré depuis REG_PANNEAUX : taper « clé de secours » mène au
      // panneau Sécurité, pas en haut d'une page. Une liste écrite à la main se périmerait au
      // prochain découpage — c'est exactement ce qui est arrivé côté entreprise en 7.30.0.
      ...Object.keys(REG_PANNEAUX).map(id => ({
        kind: 'action', main: `Réglages → ${REG_PANNEAUX[id].titre}`,
        text: ('reglages ' + REG_PANNEAUX[id].titre + ' ' + REG_PANNEAUX[id].mots).toLowerCase(),
        go: () => versReglages(id)
      })),
      { kind: 'action', main: 'Aide', go: () => { location.hash = '#/aide'; } }
    ];

    function draw() {
      const q = $('#pal-q', root).value.trim().toLowerCase();
      const rows = K.dossierList(S, null, { q, withArchived: true }).slice(0, 30).map(r => ({
        kind: 'client', main: r.name,
        sub: [r.matricule, r.missingCount ? pl(r.missingCount, 'mois', 'mois') + ' manquant' + (r.missingCount > 1 ? 's' : '') : ''].filter(Boolean).join(' · '),
        go: () => { location.hash = '#/dossier/' + encodeURIComponent(r.id); }
      }));
      // On cherche aussi dans les synonymes : « backup », « token », « cle de secours » ne figurent
      // dans aucun libellé, et deux réponses vides suffisent à faire croire que la palette ne
      // connaît pas l'application.
      const acts = actions.filter(a => !q || a.main.toLowerCase().includes(q) || (a.text || '').includes(q));
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
    fermerPalette = close;                // la seule prise depuis l'extérieur : `modal()` s'en sert
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
    // Ces deux états n'offraient aucun bouton : une coupure de réseau à 40 % figeait la barre pour
    // de bon. Le moteur sait relancer depuis toujours, aucun écran ne l'appelait (règle 7.3.0).
    else if (upd.state === 'available') corps = `<p><strong>Version ${esc(upd.version)} disponible</strong> — téléchargement en cours…</p>
      <div class="inline"><button class="btn btn-ghost btn-sm" id="u-retry">Relancer le téléchargement</button></div>`;
    else if (upd.state === 'downloading') corps = `<p>Téléchargement de la version ${esc(upd.version)}… ${upd.percent} %</p>
      <div class="progress"><div style="width:${upd.percent}%"></div></div>
      <div class="inline"><button class="btn btn-ghost btn-sm" id="u-retry">Relancer le téléchargement</button></div>`;
    else if (upd.state === 'downloaded') corps = `<p><strong>Version ${esc(upd.version)} prête.</strong>
      ${macNonSigne ? 'L\'application se ferme, se remplace dans le dossier Applications et se relance (une dizaine de secondes).' : 'L\'application se ferme, s\'installe et redémarre.'}</p>
      <button class="btn btn-primary" id="u-install">Installer et redémarrer</button>`;
    else if (upd.state === 'error') corps = `<p class="${upd.soft ? 'muted' : 'small'}"${upd.soft ? '' : ' style="color:var(--danger)"'}>${esc(upd.message)}</p>
      ${upd.detail ? `<details class="tech"><summary>Détails techniques</summary><code>${esc(upd.detail)}</code></details>` : ''}
      <div class="inline">${btnCheck}<button class="btn btn-ghost" id="u-rel">Voir les versions</button></div>`;
    else if (!a.relay && a.private && (upd.state === 'token' || !a.hasToken)) corps = `<p class="muted small">Les mises à jour ne sont pas encore activées sur cet ordinateur : colle le jeton d'accès ci-dessous.</p>${btnCheck}`;
    // L'état au repos : il n'affichait qu'un bouton, c'est-à-dire rien. On répond avec ce que la
    // dernière vérification a constaté — silencieuse comprise, puisqu'elle ne dit rien par ailleurs.
    else if (a.lastResult === 'none') corps = `<p>Tu as la dernière version.</p>${btnCheck}`;
    else if (a.lastResult === 'error') corps = `<p class="muted">La dernière vérification n'a pas abouti. SkanFact réessaiera tout seul ; tu peux aussi relancer maintenant.</p>${btnCheck}`;
    else corps = `<p class="muted">Aucune vérification n'a encore eu lieu sur cet ordinateur.</p>${btnCheck}`;

    // Avec le relais, il n'y a rien à saisir : c'est lui qui détient l'accès au dépôt. On ne montre
    // pas un champ que personne n'a à remplir.
    // Un relais en panne se dit : un écran qui affirme « rien à configurer » devant une mise à jour
    // impossible laisse le comptable sans recours.
    const noteRelais = a.relayFailure ? `<p class="small mt" style="color:var(--danger)">${esc(a.relayFailure)}</p>` : '';
    // Trois états, un seul interrupteur (`a.private`, qui vaut `GITHUB.private` dans main.js) :
    // relais en place → rien à saisir ; dépôt privé → le champ jeton ; dépôt public → rien non plus,
    // sinon un bouton pour retirer un jeton devenu inutile. Avant la 7.26.0, cet écran affirmait
    // « SkanFact est distribué depuis un dépôt privé » alors que le dépôt était public depuis
    // treize versions : le comptable cherchait un jeton que personne n'avait à lui donner.
    const jeton = a.relay
      ? '<p class="small muted mt">Les mises à jour arrivent toutes seules : rien à configurer.</p>'
      : a.private ? noteRelais + `<div class="token-box">
      <div class="k-label">Accès au dépôt</div>
      <p class="small muted">SkanFact est distribué depuis un dépôt privé : un jeton de lecture est nécessaire pour recevoir les mises à jour.
      Demande-le à qui t'a remis l'application. Il reste sur cet ordinateur et ne sert qu'à télécharger les nouvelles versions.</p>
      <div class="inline"><input type="text" id="u-token" placeholder="${a.hasToken ? 'Jeton enregistré ✓ — en coller un nouveau pour le remplacer' : 'github_pat_… ou ghp_…'}" autocomplete="off" spellcheck="false">
      <button class="btn btn-sm" id="u-token-save">Enregistrer</button>${a.hasToken ? '<button class="btn btn-sm btn-ghost" id="u-token-clear">Retirer</button>' : ''}</div>
    </div>`
        : noteRelais + (a.hasToken ? `<div class="token-box">
      <div class="k-label">Ancien jeton d'accès</div>
      <p class="small muted">Les mises à jour arrivent sans rien présenter. Un jeton datant de l'époque où le dépôt était privé est encore enregistré sur cet ordinateur ; il ne sert plus à rien.</p>
      <div class="inline"><button class="btn btn-sm btn-ghost" id="u-token-clear">Retirer ce jeton</button></div>
    </div>` : '<p class="small muted mt">Les mises à jour arrivent toutes seules : rien à configurer.</p>');

    // Ce qui rend la phrase du dessus vérifiable : QUAND on l'a constaté, et à quel rythme c'est
    // refait. « Les mises à jour arrivent toutes seules » se disait sur une application qui ne
    // vérifiait qu'une fois, quatre secondes après l'ouverture — et un comptable n'éteint pas son
    // poste de la semaine.
    const heures = a.autoEvery ? Math.round(a.autoEvery / 3600000) : 0;
    const quand = !a.packaged ? '' : `<p class="small muted mt">Dernière vérification : <b>${esc(quandVerif(a.lastCheck) || 'jamais encore')}</b>${heures ? ` — SkanFact regarde tout seul toutes les ${heures} heures et au retour sur l'application.` : ''}</p>`;
    // Le canal d'essai du cabinet (9.1.0). Le comptable pilote a besoin de recevoir une version
    // avant les autres : sans ce canal, la seule façon de lui faire essayer quelque chose est de
    // la publier à TOUS les cabinets d'un coup.
    //
    // Le repère « bêta » suit la VERSION INSTALLÉE, jamais le canal choisi : ce qui compte, c'est
    // ce qui tourne. Les deux se contredisent une journée entière quand on décoche la case en
    // tournant sur une bêta (règle 7.25.0).
    const etatBeta = !a.packaged ? '' : (a.prerelease
      ? `<p class="small mt"><b>Tu tournes sur une version d'essai</b> (${esc(a.version || '')}).${a.beta ? '' : ' Tu es revenu au canal normal : SkanFact Cabinet la remplacera par la prochaine version stable.'}</p>`
      : '');
    const beta = !a.packaged ? '' : `<div class="beta-box">
      <label class="check"><input type="checkbox" id="u-beta" ${a.beta ? 'checked' : ''}> <b>Recevoir les versions d'essai</b></label>
      <p class="small muted">Les versions d'essai, avant les autres. Numérotées <code>9.2.0-beta.1</code>. À laisser décoché sur l'ordinateur qui sert à travailler.</p>
      ${etatBeta}
    </div>`;

    el.innerHTML = `<div class="update-head"><div><div class="k-label">Version installée</div><div class="ver">${esc(a.version || '…')}</div></div></div>${corps}${quand}${beta}${jeton}`;

    const relire = async () => { upd.app = await api.updVersion(); drawUpdatePanel(); };
    const verifier = async () => {
      upd.state = 'checking'; drawUpdatePanel();
      const r = await api.updCheck();
      if (r && (r.state === 'dev' || r.state === 'token' || r.state === 'error')) {
        upd.state = r.state === 'dev' ? 'idle' : r.state; upd.message = r.message || '';
        // Le détail et la gravité voyagent avec le message, sinon « Détails techniques » et le gris
        // ne servent que pour les erreurs venues d'un événement — jamais pour celles qu'on lit
        // après avoir cliqué.
        upd.detail = r.detail || ''; upd.soft = !!r.soft;
        drawUpdatePanel();
      }
      // Le repli automatique a pu débrancher le relais : on relit l'état plutôt que de continuer à
      // annoncer « rien à configurer ».
      upd.app = await api.updVersion();
      drawUpdatePanel();
    };
    if ($('#u-check')) $('#u-check').onclick = verifier;
    if ($('#u-retry')) $('#u-retry').onclick = async () => {
      upd.percent = 0; drawUpdatePanel();
      const r = await api.updDownload();
      if (r && r.state === 'error') { upd.state = 'error'; upd.message = r.message || ''; upd.detail = r.detail || ''; upd.soft = !!r.soft; drawUpdatePanel(); }
    };
    if ($('#u-rel')) $('#u-rel').onclick = () => api.updOpenReleases();
    if ($('#u-beta')) $('#u-beta').onchange = async (ev) => {
      const on = ev.target.checked;
      if (on) {
        const ok = await confirmDialog('Recevoir les versions d\'essai',
          '<p>Les versions d\'essai arrivent avant les autres et peuvent contenir des défauts.</p>' +
          '<p class="small">Elles s\'installent <b>par-dessus SkanFact Cabinet</b> et travaillent sur les mêmes dossiers, les mêmes paquets et la même clé. Une sauvegarde va être prise tout de suite, avant tout changement.</p>' +
          '<p class="small">Tu pourras revenir au canal normal à tout moment en décochant la case.</p>',
          'Recevoir les versions d\'essai');
        // Un refus DÉCOCHE vraiment la case : la laisser cochée après un « Annuler » ferait croire
        // que le canal est armé alors qu'il ne l'est pas.
        if (!ok) { ev.target.checked = false; return; }
        // Le filet, pris AVANT d'armer le canal : au moment où la bêta s'installera, le comptable
        // sera ailleurs, et il sera trop tard pour y penser.
        try { await api.backupNow('avant-beta'); } catch { /* pas de filet ≠ pas de canal */ }
      }
      const r = await api.updSetBeta(on);
      upd.app = { ...(upd.app || {}), beta: r.beta };
      upd.state = 'idle';
      drawUpdatePanel();
      toast(r.beta ? 'Versions d\'essai activées — sauvegarde « avant-beta » prise' : 'Retour au canal normal');
      verifier();
    };
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

  // ---------- aide (refondue en 7.28.0) ----------
  //
  // Avant : les huit articles dépliés l'un sous l'autre sur une seule page, sans sous-titres, sans
  // recherche, sans un seul lien vers l'application. Cinq écrans de prose grise où l'on ne savait
  // ni ce qu'il y avait, ni où l'on en était. C'est le premier contact d'un comptable avec
  // SkanFact, et l'app entreprise venait d'être refaite : celle-ci ne pouvait pas rester ainsi.
  //
  // Maintenant : un plan de huit cartes colorées, une recherche qui traverse le corps des articles,
  // et un article qui dit d'où il vient, ce qu'il contient et où il mène. Les classes sont celles
  // de la feuille PARTAGÉE (`.help-…`, `.th-…`) : c'est le même langage visuel que chez le client,
  // et surtout pas un second jeu de règles qui dériverait (règle 6.8.0 sur les collisions de noms).
  let aideQ = '';
  const sansBalises = x => String(x || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const aideIcone = a => `<svg viewBox="0 0 24 24" aria-hidden="true">${a.icon || ''}</svg>`;

  function aideTrouves(q) {
    const mots = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!mots.length) return G.ARTICLES;
    const notes = [];
    G.ARTICLES.forEach((a, i) => {
      const titre = `${a.t} ${a.s || ''}`.toLowerCase();
      const corps = sansBalises(a.d).toLowerCase();
      if (!mots.every(m => titre.includes(m) || corps.includes(m))) return;
      notes.push({ a, rang: mots.every(m => titre.includes(m)) ? 0 : 1, i });
    });
    return notes.sort((x, y) => x.rang - y.rang || x.i - y.i).map(x => x.a);
  }

  const aideCarte = a => `<button class="help-art grande ${esc(a.couleur || '')}" data-art="${esc(a.id)}">
      <span class="ht"><span class="ha-ico">${aideIcone(a)}</span>${esc(a.t)}</span>
      <span class="hs">${esc(a.s || '')}</span></button>`;

  function drawAide(view, arg) {
    const a = G.ARTICLES.find(x => x.id === arg) || null;
    if (a) aideQ = '';
    const i = a ? G.ARTICLES.indexOf(a) : -1;
    const prec = i > 0 ? G.ARTICLES[i - 1] : null;
    const suiv = i >= 0 && i < G.ARTICLES.length - 1 ? G.ARTICLES[i + 1] : null;
    view.innerHTML = `
      <div class="page-head"><h1>Comment ça marche</h1></div>
      ${a ? '' : `<p class="lead">Ce que fait SkanFact Cabinet, ce qu'il ne fait pas, et ce qu'il faut avoir mis de côté pour ne rien perdre. Partout ailleurs dans l'application, les petits <span class="i-demo">i</span> expliquent le champ juste à côté.</p>`}
      <div class="help-search">
        <svg class="hs-loupe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/></svg>
        <input type="search" id="aide-q" placeholder="Rechercher : un mot, une question… (« empreinte », « clé de secours »)" autocomplete="off" spellcheck="false" value="${esc(aideQ)}">
        <div class="help-count small muted" id="aide-n" hidden></div>
      </div>
      <div id="aide-res" hidden></div>
      <div id="aide-vue"></div>`;

    const vue = $('#aide-vue');
    if (a) {
      vue.innerHTML = `
        <div class="help-fil small"><button data-home="1">Aide</button><span class="sep">›</span><span>${esc(a.t)}</span></div>
        <div class="help-layout seul ${esc(a.couleur || '')}">
          <div class="help-col">
            <article class="panel help-body">
              <h2 class="help-h"><span class="ha-ico">${aideIcone(a)}</span>${esc(a.t)}</h2>
              <p class="help-sub">${esc(a.s || '')}</p>
              ${a.d}
              ${a.geste ? `<div class="help-geste"><button class="btn btn-primary" data-geste="${esc(a.geste.hash)}"${a.geste.panneau ? ` data-panneau="${esc(a.geste.panneau)}"` : ''}>${esc(a.geste.label)}</button>
                <span class="small muted">On lit une explication pour faire quelque chose.</span></div>` : ''}
              <p class="small muted help-foot">Une question que cette aide ne tranche pas ? <b>Réglages → L'application → Aide et dépannage</b> : le rapport ne contient aucune donnée de tes clients.</p>
            </article>
            <div class="help-suite">
              ${prec ? `<button class="btn btn-ghost" data-art="${esc(prec.id)}">← ${esc(prec.t)}</button>` : '<span></span>'}
              ${suiv ? `<button class="btn" data-art="${esc(suiv.id)}">${esc(suiv.t)} →</button>` : '<span></span>'}
            </div>
          </div>
        </div>`;
    } else {
      vue.innerHTML = `<div class="help-arts help-res">${G.ARTICLES.map(aideCarte).join('')}</div>
        <p class="small muted mt">Une question que cette aide ne tranche pas ? <b>Réglages → L'application → Aide et dépannage</b> : le rapport dit où l'application s'est arrêtée, et ne contient aucune donnée de tes clients.</p>`;
    }

    const brancher = () => {
      $$('[data-art]').forEach(b => b.onclick = () => { aideQ = ''; location.hash = '#/aide/' + b.dataset.art; });
      $$('[data-home]').forEach(b => b.onclick = () => { aideQ = ''; location.hash = '#/aide'; });
      // Un geste peut viser un PANNEAU des Réglages, pas seulement une page : depuis les onglets,
      // « Ouvrir les réglages » en haut d'un onglet de trois panneaux n'apprend rien.
      $$('[data-geste]').forEach(b => b.onclick = () => {
        if (b.dataset.panneau) return versReglages(b.dataset.panneau);
        location.hash = b.dataset.geste;
      });
    };
    brancher();

    const q = $('#aide-q');
    const chercher = () => {
      aideQ = q.value;
      const mots = aideQ.trim();
      const res = $('#aide-res'), n = $('#aide-n');
      res.hidden = !mots; n.hidden = !mots;
      $('#aide-vue').hidden = !!mots;
      if (!mots) { brancher(); return; }
      const trouves = aideTrouves(aideQ);
      n.textContent = trouves.length
        ? `${pl(trouves.length, 'article')} sur ${G.ARTICLES.length}, le plus proche en premier`
        : `Aucun article sur ${G.ARTICLES.length}`;
      res.innerHTML = trouves.length
        ? `<div class="help-arts help-res">${trouves.map(aideCarte).join('')}</div>`
        : '<div class="empty">Aucun article ne contient ces mots. Essaie un seul mot.</div>';
      brancher();
    };
    q.oninput = chercher;
    q.onkeydown = e => { if (e.key === 'Escape' && q.value) { e.stopPropagation(); q.value = ''; chercher(); } };
    if (aideQ) chercher();
  }

  // ---------- le garde-fou d'erreur (9.1.0, SPEC-OUT-004) ----------
  //
  // Même garde-fou que dans l'application entreprise, et posé au même endroit : AVANT la séquence
  // de démarrage, parce qu'une exception levée pendant cette séquence laisse l'écran blanc et ne
  // serait vue par aucun garde-fou installé plus bas.
  //
  // Ici, c'est un défaut de CETTE application qui l'a motivé : `h(a.relayFailure)` — copié de
  // l'app entreprise, où la fonction d'échappement s'appelle `h` et non `esc` — faisait planter le
  // panneau des mises à jour AU MOMENT PRÉCIS où il devait annoncer une panne (6.8.0). Rien en
  // console, rien nulle part, et un comptable devant un panneau muet.
  //
  // Il n'affiche rien et ne recharge rien : c'est au chien de garde de décider ça, lui seul sait
  // si l'interface répond encore.
  const noterErreur = (info) => { try { api.supportErreur(info); } catch {} };
  window.addEventListener('error', e => noterErreur({
    message: (e && e.message) || '(sans message)', source: (e && e.filename) || '',
    ligne: (e && e.lineno) || 0, pile: (e && e.error && e.error.stack) || ''
  }));
  window.addEventListener('unhandledrejection', e => {
    const r = e && e.reason;
    noterErreur({
      message: 'promesse rejetée : ' + ((r && r.message) || String(r || '(sans raison)')),
      source: '', ligne: 0, pile: (r && r.stack) || ''
    });
  });

  // ---------- chien de garde et messages du processus principal ----------
  // Abonnés AVANT la séquence de démarrage : l'écran de verrouillage la met en attente, et un
  // message reçu pendant ce temps serait perdu pour toujours (règle apprise en 6.5.0).
  // Le battement de cœur : répondre tant que l'interface tourne. La réponse part du fil principal
  // du renderer — c'est exactement lui qu'une boucle infinie bloquerait.
  api.onAlivePing();
  // Après un gel, l'application se recharge toute seule. Elle le dit : sans un mot, le comptable se
  // retrouve devant l'écran de verrouillage sans comprendre pourquoi, et doute de ce qui a été
  // enregistré.
  api.onFreezeNotice(f => {
    modal(`<h2>SkanFact Cabinet s'était bloqué</h2>
      <p>L'application n'a plus répondu pendant ${esc(String((f && f.silence) || '?'))} secondes, et elle vient de redémarrer toute seule.</p>
      <p class="small"><strong>Rien n'est perdu :</strong> les paquets déjà rangés le restent et ton cabinet est intact. Il faut seulement rouvrir avec ton mot de passe.</p>
      <p class="small">SkanFact a noté où le programme s'était arrêté. Si cela se reproduit, envoie-le : <em>Aide → Signaler un problème</em>. C'est ce qui permet de corriger.</p>
      <div class="modal-actions"><span class="grow"></span><button class="btn" id="fz-ok">Continuer</button><button class="btn btn-primary" id="fz-rep">Signaler</button></div>`,
      (layer, close) => {
        $('#fz-ok', layer).onclick = close;
        $('#fz-rep', layer).onclick = () => { close(); supportDialog(); };
      });
  });

  // ---------- démarrage ----------
  boot().catch(e => { $('#lock-sub').textContent = 'Erreur au démarrage : ' + plainError(e); });
})();
