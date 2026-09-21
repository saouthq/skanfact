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
  let exempleRefait = null;              // l'exemple vient d'être remis à jour à l'ouverture (9.4.2)

  // Charger ou retirer l'exemple à la main passe par ici, et NON par `api.demo` directement : le
  // bandeau « ils viennent d'être remis à jour » ne doit pas survivre à un exemple qu'on vient de
  // recharger soi-même — il annoncerait un rattrapage qui n'a pas eu lieu.
  async function chargerOuRetirerExemple(on) {
    exempleRefait = null;
    return api.demo(on);
  }
  let fermerPalette = null;              // de quoi refermer la palette quand une fenêtre s'ouvre au-dessus
  // Un raccourci vise un PANNEAU, pas une page (7.18.0) — porté de l'app entreprise (T-20). Le
  // panneau « les pièces » d'une déclaration s'ouvrait sous le tableau des quatorze cases, hors de
  // l'écran, sans un mouvement : le geste de CONTRÔLE de cet écran paraissait ne rien faire. On
  // retient la cible, on l'amène à l'écran une fois le dessin fini, et on la marque une seconde
  // et demie pour dire « c'est ici ».
  let pageFocus = '';
  function focaliser(root) {
    if (!pageFocus) return;
    const cible = $('#' + pageFocus, root || document);
    pageFocus = '';
    if (!cible) return;
    try { cible.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch {}
    cible.classList.add('flash');
    setTimeout(() => cible.classList.remove('flash'), 1600);
  }
  // Mises à jour : l'état de la dernière vérification, partagé entre le panneau et la pastille.
  const upd = { state: 'idle', version: '', percent: 0, message: '', app: null };

  // Les préférences d'affichage vivent sur le poste, pas dans la base chiffrée : ce n'est pas une
  // donnée de cabinet, et une colonne triée n'a pas à être sauvegardée avec les comptabilités.
  const prefs = {
    get(k, def) { try { const v = localStorage.getItem('cab.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem('cab.' + k, JSON.stringify(v)); } catch {} }
  };

  // La sélection posée par une échéance (9.4.6). Elle ne vit pas dans `prefs` : c'est un état de
  // parcours — « je viens de cliquer sur les onze clients de la TVA d'avril » — et le retrouver
  // lundi matin sans savoir d'où il vient serait un piège. Il se vide dès qu'on quitte les Relances.
  const relState = { seulement: null, depuis: '', coches: new Set() };

  const listState = {
    q: '', withArchived: false, onlySkanfact: false,
    sort: prefs.get('sort', 'urgence'), desc: prefs.get('desc', false),
    page: 1, size: prefs.get('size', 25), sizeKey: 'size'
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

  // Depuis la 9.4.10 chaque refus finit par son code entre crochets (« … [ERR-CAB-009] »). Le code
  // sert au dépannage, pas à la lecture : on le détache de la phrase. `codeErreur` le rend à qui a
  // la place de l'afficher — jamais dans un bandeau de 2,6 secondes.
  const RE_CODE = /\s*\[(ERR-[A-Z]+-\d+)\]\s*$/;
  const plainError = e => String((e && e.message) || e || '')
    .replace(/^Error invoking remote method '[^']*':\s*/, '').replace(/^Error:\s*/, '')
    .replace(RE_CODE, '').trim() || 'Erreur inconnue.';
  const codeErreur = e => {
    const m = String((e && e.message) || e || '').match(RE_CODE);
    return (m && m[1]) || (e && e.code) || '';
  };

  let toastTimer = null;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (kind === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, kind === 'error' ? 5200 : 2800);
  }

  // Ce qui se RÉPARE laisse un « Annuler » sous la main (règle 7.12.0). L'app entreprise l'a depuis
  // cette version-là ; le Cabinet n'en avait aucun — zéro occurrence — alors que ses gestes pointés
  // ont exactement le même défaut : au moment où l'on comprend qu'on s'est trompé de ligne, la ligne
  // a déjà changé sous le doigt. Deux détails qui font toute la différence : le bandeau doit
  // RECEVOIR les clics (`#toast` est en `pointer-events: none`, un bouton posé dedans serait visible
  // et parfaitement inerte), et il dure trois fois plus longtemps qu'un message ordinaire —
  // comprendre son erreur prend quelques secondes.
  function toastUndo(msg, annuler) {
    const t = $('#toast');
    t.textContent = '';
    const txt = document.createElement('span');
    txt.textContent = msg;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-undo'; b.textContent = 'Annuler';
    b.onclick = () => { clearTimeout(toastTimer); t.className = ''; annuler(); };
    t.append(txt, b);
    t.className = 'show avec-bouton';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; t.textContent = ''; }, 8000);
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
  // ---------- les touches ----------
  // Un raccourci s'AFFICHE comme une touche, jamais comme du texte. « Control+Enter » au milieu
  // d'une phrase grise se lit comme une faute de frappe ; ⌃ + ↵ en relief se reconnaît sans être lu.
  // C'est ce que Skander a vu sur une capture : « la section "les touches" sont en texte, alors que
  // personne ne fait ça ». Les noms sont ceux d'un clavier français, pas ceux de `KeyboardEvent.key`.
  const NOM_TOUCHE = {
    Enter: '↵ Entrée', Tab: '⇥ Tab', Escape: 'Échap', ' ': 'Espace', Space: 'Espace',
    Control: 'Ctrl', Alt: 'Alt', Shift: '⇧ Maj', Meta: 'Cmd',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Backspace: '⌫', Delete: 'Suppr'
  };
  const kbd = combo => String(combo || '').split('+')
    .map(t => `<kbd>${esc(NOM_TOUCHE[t] || t)}</kbd>`).join('<span class="kbd-plus">+</span>');
  // La ligne d'aide de la grille : elle nomme le geste, puis montre la touche. Les touches viennent
  // des réglages, donc elle suit ce que le comptable a choisi — une aide qui annonce F2 quand la
  // touche est F5 est pire que pas d'aide.
  function aideTouches() {
    const t = touchesSaisie();
    const paire = (quoi, k) => `<span class="kbd-paire">${esc(quoi)} ${kbd(k)}</span>`;
    // La RÈGLE avant l'exception (T-31) : Tab avance de champ en champ, c'est son comportement
    // natif ; la légende ne nommait que son exception (« Solder la pièce ⇥ Tab »), et le testeur
    // n'osait plus s'en servir pour atteindre les montants.
    return `<div class="kbd-aide">${[
      paire('Champ suivant', 'Tab'),
      paire('Ligne suivante', t.ligneSuivante),
      paire('Solder la dernière ligne', t.solder),
      paire('Recopier la ligne du dessus', t.recopier),
      paire('Dupliquer la pièce', t.dupliquer),
      paire('Enregistrer et valider', t.valider)
    ].join('')}</div>`;
  }
  // Un champ « touche » de la grille de saisie. Il se règle en APPUYANT sur la touche, pas en
  // tapant son nom : personne ne sait que la touche Entrée s'appelle « Enter » et que Ctrl s'appelle
  // « Control », et une faute de frappe donnait un raccourci qui ne se déclenchait jamais — sans
  // rien à l'écran pour le dire. Le champ reste un `input` (donc il garde le focus, l'étiquette et
  // la bulle), mais il est en lecture seule : c'est le clavier qui l'écrit.
  const champTouche = (k, titre, cle) => {
    const v = (((S.settings || {}).saisie || {}).touches || {})[k] || K.DEFAULT_SAISIE.touches[k];
    return `<div class="field narrow touche-champ">${lbl(titre, cle)}
      <div class="touche-ligne">
        <input type="text" readonly data-touche="${esc(k)}" value="${esc(v)}" class="touche-in"
          aria-label="${esc(titre)} — appuie sur la touche à utiliser" title="Appuie sur la touche à utiliser">
        <span class="touche-vue" data-vue="${esc(k)}">${kbd(v)}</span>
        <button type="button" class="btn btn-sm" data-touche-reset="${esc(k)}" title="Remettre ${esc(K.DEFAULT_SAISIE.touches[k])}">Remettre d'origine</button>
      </div></div>`;
  };

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
    typographie(layer);
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
    // Le bouton « Annuler » lui-même. Il était posé dans neuf fenêtres (`data-close`) et relié à
    // RIEN : Échap et le clic à côté fermaient, le seul chemin écrit sur l'écran ne faisait rien.
    // On clique, rien ne se passe, on reclique, on doute de soi puis du logiciel — au pire moment,
    // celui où on vient de décider de NE PAS faire quelque chose. L'app entreprise a cette ligne
    // depuis la 1.8.0 ; elle n'avait jamais été portée (7.3.0). Il passe par `dismiss`, pas `close` :
    // « Annuler » vaut Échap, donc la garde de saisie pose sa question s'il y a du travail à jeter.
    $$('[data-close]', layer).forEach(b => b.addEventListener('click', dismiss));
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
  // Les douze mois, dans l'ordre du calendrier. Ils servent à dessiner l'année ENTIÈRE sur la fiche
  // d'un client : n'afficher que les mois attendus laissait croire que l'application en avait perdu.
  // Les codes de journal proposés. Ce réglage vaut pour TOUS les dossiers, donc la liste est celle
  // que `compta.js` pose à la création d'un livre — pas celle d'un dossier en particulier, qui
  // n'aurait aucun sens sur les cinquante-neuf autres. Le code déjà réglé y est ajouté s'il n'y
  // figure pas : un `select` dont aucune option ne correspond retient la PREMIÈRE en silence, et
  // rouvrir les Réglages pour changer autre chose effacerait le journal choisi (règle 8.3.0).
  function journauxConnus() {
    const vus = new Set((KC.JOURNAUX_PAR_DEFAUT || []).map(j => String(j.code || j)));
    const regle = String(((S.settings || {}).saisie || {}).journalParDefaut || '');
    if (regle) vus.add(regle);
    return [...vus].filter(Boolean).sort();
  }

  const MOIS_COURTS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
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
  // Un montant AFFICHÉ, sans sa devise : la grille de saisie, le brouillard, les abonnements et
  // la recherche écrivaient « 4.500 » à côté d'un total à « 0,000 » (T-28). En français, le point
  // décimal fait lire quatre mille cinq cents — sur l'écran dont le métier est de contrôler des
  // montants. `toFixed(3)` ne sert plus qu'à REMPLIR un champ de saisie, qui se relit en interne.
  const montant = n => money(n).replace(/\s(DT|[A-Z]{3})$/, '');
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
  // `droite` (9.4.3) : une colonne de CHIFFRES s'aligne à droite, et son en-tête avec elle. Sans ce
  // paramètre, `sortHead` posait toujours un en-tête à gauche : « Mois manquants » se lisait donc
  // à gauche au-dessus de valeurs alignées à droite, et on lisait la ligne de travers. C'est la
  // famille du `th.r` de la 7.23.0, et elle est revenue ici parce qu'aucun instrument ne mesurait
  // les colonnes du Cabinet — `e2e:cabinet-rendu` le fait depuis cette version.
  function sortHead(label, key, help, droite) {
    const on = listState.sort === key;
    // `sortable-h` : c'est le nom que connaît la feuille partagée. Avec `sortable`, l'en-tête n'avait
    // ni curseur, ni survol, ni flèche lisible — rien ne disait qu'on pouvait cliquer.
    return `<th class="nw sortable-h${droite ? ' r' : ''}${on ? ' sorted' : ''}" data-sort="${esc(key)}" title="Trier">${esc(label)}${help ? ' ' + info(help) : ''}<span class="sort-ar">${on ? (listState.desc ? '↓' : '↑') : '⇅'}</span></th>`;
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
  // Les trois aides de pagination prennent un ÉTAT, et retombent sur celui de la liste des
  // dossiers. Avant la 9.4.5 elles étaient câblées sur `listState` en dur : les vingt tableaux de
  // la comptabilité d'un dossier ne pouvaient donc pas s'en servir, et le grand livre d'un client
  // faisait 6 462 px — six écrans et demi d'un seul tenant. Le nom de l'unité (« ligne », « pièce »,
  // « compte ») est passé par l'appelant : un pied qui annonce « 25 sur 340 lignes » là où ce sont
  // des pièces raconte autre chose que ce que le tableau montre.
  function pagerBar(total, st = listState, unite = 'ligne', pluriel) {
    const pages = Math.max(1, Math.ceil(total / st.size));
    if (st.page > pages) st.page = pages;
    if (pages <= 1 && st.size >= total) return '';
    const from = total ? (st.page - 1) * st.size + 1 : 0;
    const to = Math.min(total, st.page * st.size);
    return `<div class="pager">
      <button class="btn btn-sm" id="pg-prev" ${st.page <= 1 ? 'disabled' : ''}>← Précédent</button>
      <span class="muted small">${from}–${to} sur ${pl(total, unite, pluriel)}</span>
      <button class="btn btn-sm" id="pg-next" ${st.page >= pages ? 'disabled' : ''}>Suivant →</button>
      <select id="pg-size" class="sm" aria-label="Lignes par page">
        ${[25, 50, 100, 500].map(n => `<option value="${n}" ${st.size === n ? 'selected' : ''}>${n} par page</option>`).join('')}
      </select></div>`;
  }
  function bindPager(root, redraw, st = listState) {
    const p = $('#pg-prev', root), n = $('#pg-next', root), s = $('#pg-size', root);
    if (p) p.onclick = () => { st.page--; redraw(); };
    if (n) n.onclick = () => { st.page++; redraw(); };
    if (s) s.onchange = () => { st.size = Number(s.value); st.page = 1; if (st.sizeKey) prefs.set(st.sizeKey, st.size); redraw(); };
  }
  const paginate = (rows, st = listState) => rows.slice((st.page - 1) * st.size, st.page * st.size);

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
      // L'avertissement le plus important de toute l'application était la ligne la plus petite et la
      // plus grise de l'écran ; il est ensuite devenu rouge, mais CENTRÉ sur trois lignes et posé
      // SOUS le bouton. Un encadré, aligné à gauche, au-dessus du geste : c'est exactement ce à quoi
      // `.warn-box` sert — « ce qui doit être lu avant d'agir, jamais une ligne grise de plus ».
      note.className = 'lock-note warn-box grave';
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
        // Avant de montrer l'application, pas après : le thème n'est lisible qu'une fois l'état
        // déchiffré, et une image blanche d'une frame sur un poste en sombre se voit.
        appliquerTheme();
        $('#lock-screen').remove();
        $('#app').hidden = false;
        start(r.created, r.reorganized, aRecuperer, r.exemple);
      } catch (ex) {
        // L'écran de verrouillage a la place d'un code, et c'est le seul refus qu'on ne peut pas
        // dépanner en regardant l'application : elle n'est pas encore ouverte.
        const code = codeErreur(ex);
        err.innerHTML = esc(plainError(ex)) + (code ? ' <span class="muted small">' + esc(code) + '</span>' : '');
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

  function start(created, reorganized, aRecuperer, exemple) {
    // L'exemple a pu être refait pendant l'ouverture (9.4.2). Le bandeau des dossiers fictifs le
    // dit — un toast de trois secondes sur un jeu de données qui a changé n'informe personne.
    exempleRefait = exemple || null;
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
    // La licence, dès l'ouverture : un bandeau qui n'apparaît qu'une fois les Réglages ouverts
    // n'avertit personne (règle 8.0.1 — « une échéance qui verrouille se voit depuis le premier
    // jour, pas depuis le dernier »).
    $('#lic-banner').onclick = () => versReglages('pan-licence');
    chargerLicence();
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

  // Le thème (9.4.3). L'app entreprise en a un depuis la 1.6.0 ; le Cabinet n'en avait aucun, donc
  // une fenêtre blanche à côté de tout le reste sur un poste réglé en sombre. « auto » suit le
  // système et RÉAGIT quand il change : un réglage lu une fois au démarrage se périme (7.1.x), et
  // celui-là bascule à la tombée de la nuit sur un Mac réglé ainsi.
  const mqSombre = window.matchMedia('(prefers-color-scheme: dark)');
  const themeCourant = () => ((S || {}).settings || {}).theme || 'auto';
  function appliquerTheme() {
    const t = ((S || {}).settings || {}).theme || 'auto';
    document.body.classList.toggle('dark', t === 'dark' || (t === 'auto' && mqSombre.matches));
  }
  mqSombre.addEventListener('change', () => { if (S) appliquerTheme(); });

  // Aller à une page en ayant posé un état juste avant. `location.hash = …` vers la page COURANTE
  // ne produit aucun `hashchange`, donc ne redessine rien : le filtre venait d'être posé et l'écran
  // ne bougeait pas. L'app entreprise a `vers()` depuis la 7.15.0 ; le Cabinet ne l'avait pas, et
  // c'est le même piège que le cas « on y est déjà » de `goBack` (2.4.0).
  function vers(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function render() {
    const hash = location.hash.replace(/^#\//, '') || 'dossiers';
    const [route, arg] = hash.split('/');
    appliquerTheme();
    $$('.sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    $('#brand-cab').textContent = S.cabinet.name || 'Cabinet';
    updateBanner();
    // La pastille compte EXACTEMENT les lignes de la page Relances. Deux chiffres pour la même chose
    // faisaient douter de tout le reste.
    const relCount = K.relanceRows(S).length;
    const pill = $('#nav-relances');
    pill.hidden = !relCount;
    if (relCount) pill.textContent = relCount;
    // La sélection posée par une échéance ne survit pas à la sortie des Relances : la retrouver en
    // revenant plus tard, sans savoir d'où elle vient, serait exactement le piège du filtre qui
    // cache ce qu'on est venu chercher (7.18.0).
    if (route !== 'relances') {
      if (relState.seulement) { relState.seulement = null; relState.depuis = ''; }
      relState.coches.clear();
    }
    const view = $('#view');
    if (route === 'dossier') drawDossier(view, arg, hash.split('/')[2]);
    else if (route === 'ecritures') drawEcritures(view);
    else if (route === 'echeances') drawEcheances(view);
    else if (route === 'relances') drawRelances(view);
    else if (route === 'reglages') drawReglages(view);
    else if (route === 'aide') drawAide(view, arg);
    else drawDossiers(view);
    typographie(view);
  }

  // ---------- la ponctuation double, à la française ----------
  //
  // En français, « ? », « ! », « ; », « : » et l'intérieur des guillemets prennent une espace
  // INSÉCABLE. Avec une espace ordinaire, le navigateur coupe la ligne juste avant : sur l'écran de
  // bienvenue, « … ne m'a pas envoyé son mois » finissait une ligne et le « ? » commençait la
  // suivante, tout seul. Ça ne se voit sur aucune relecture du code — seulement sur une capture — et
  // c'est le genre de détail qu'un expert-comptable remarque sans savoir le nommer.
  //
  // On travaille sur les NŒUDS DE TEXTE d'une prose déjà posée : aucune balise n'est touchée, et
  // seule la prose est concernée (les titres, les libellés et les cellules de tableau gardent leurs
  // espaces ordinaires, donc rien de ce qu'un test compare ne change). U+202F est l'espace fine
  // insécable, celle de la typographie française.
  const PROSE = 'p, .lead, .help-body, .wiz-body, .warn-box, .banner span, .empty, .kv span';
  function typographie(racine) {
    (racine || document).querySelectorAll(PROSE).forEach(bloc => {
      const it = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = it.nextNode())) {
        const t = n.nodeValue;
        if (!/[ ][?!;:»]|«[ ]/.test(t)) continue;
        n.nodeValue = t.replace(/ ([?!;:»])/g, ' $1').replace(/« /g, '« ');
      }
    });
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
    'licence': { texte: 'Voir ce qui est compté…', run: () => versReglages('pan-licence') },
    // 9.4.4 — cinq libellés « Voir » identiques. Un libellé décrit l'écran d'ARRIVÉE (règle
    // 7.29.0) : « Voir » ne dit pas si on part aux Relances, aux Échéances ou dans un dossier, donc
    // on clique pour savoir, et on revient.
    'jour-de-relance': { texte: 'Relancer', run: () => { location.hash = '#/relances'; } },
    'echeance': { texte: 'Voir l\'échéance', run: () => { location.hash = '#/echeances'; } },
    'manquants': { texte: 'Voir qui doit envoyer', run: () => { location.hash = '#/relances'; } },
    'provisoires': { texte: 'Voir le provisoire', run: () => { location.hash = '#/relances'; } },
    'pieces': { texte: 'Voir les dossiers', run: () => { location.hash = '#/dossiers'; } }
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
    // 9.4.4 — repliable, et plafonné. Six lignes font 400 px : avec les cartes au-dessus, la liste
    // des clients partait sous l'écran. Le panneau garde les DEUX plus urgentes sous les yeux (la
    // liste est triée par urgence) et range le reste derrière un lien qui COMPTE ce qu'il cache —
    // un « voir plus » qui ne dit pas combien ne se clique pas. Le choix de replier est mémorisé :
    // l'app entreprise a `todo-toggle` + `prefs` depuis la 2.2.0, le Cabinet ne l'avait jamais reçu.
    const ouvert = prefs.get('todoOpen', true) !== false;
    const tout = prefs.get('todoAll', false) === true;
    const VISIBLES = 2;
    const montres = !ouvert ? [] : (tout ? todo : todo.slice(0, VISIBLES));
    const caches = todo.length - montres.length;
    return `<div class="panel todo">
      <h2><button type="button" class="collapse-h" id="todo-toggle" aria-expanded="${ouvert}" aria-controls="todo-list"
        title="${ouvert ? 'Replier' : 'Déplier'} la liste"><span class="chev">▾</span>À faire<span class="count">${todo.length}</span></button></h2>
      <ul id="todo-list"${ouvert ? '' : ' hidden'}>${montres.map(t => `
      <li class="lvl-${t.level}"><span class="td-dot"></span>
        <span class="td-txt"><strong>${esc(t.label)}</strong><span class="small muted">${esc(t.detail)}</span></span>
        <button class="btn btn-ghost btn-sm nw" data-todo="${esc(t.id)}">${esc((TODO_ACTIONS[t.id] || {}).texte || 'Voir')}</button></li>`).join('')}</ul>
      ${ouvert && (caches > 0 || tout) ? `<button type="button" class="btn btn-ghost btn-sm" id="todo-plus">${
    caches > 0 ? `Voir ${pl(caches, 'autre ligne', 'autres lignes')}` : 'Ne montrer que les deux plus urgentes'}</button>` : ''}</div>`;
  }
  function bindTodo(root) {
    $$('[data-todo]', root || document).forEach(b => b.onclick = () => {
      const a = TODO_ACTIONS[b.dataset.todo];
      // Un bouton qui avale le clic en silence fait douter de soi, puis du logiciel : on le dit.
      if (a) a.run(); else toast('Cette ligne n\'a pas encore d\'écran à ouvrir.', 'error');
    });
    const t = $('#todo-toggle', root || document);
    if (t) t.onclick = () => { prefs.set('todoOpen', prefs.get('todoOpen', true) === false); render(); };
    const p = $('#todo-plus', root || document);
    if (p) p.onclick = () => { prefs.set('todoAll', prefs.get('todoAll', false) !== true); render(); };
  }

  // 9.4.4 — une pastille de couleur seule n'est pas une information. Rouge, orange, vert devant
  // chaque client, et rien nulle part ne disait ce que ça voulait dire : ni apprenable au premier
  // jour, ni lisible pour les 8 % d'hommes qui distinguent mal le rouge du vert, ni visible sur une
  // capture imprimée. La couleur RAPPELLE, elle ne dit pas — donc elle porte son mot.
  // Les quatre niveaux sont ceux de `dossierRow` — `danger`, `warn`, `ok`, `hors` — et pas des noms
  // inventés ici : une légende qui nomme des couleurs que le code ne pose pas ne légende rien.
  const NIVEAUX = {
    danger: 'en retard : il manque au moins un mois',
    warn: 'à surveiller : du provisoire, ou des pièces signalées',
    ok: 'à jour',
    hors: 'pas encore sur SkanFact : rien ne lui est réclamé'
  };
  const ORDRE_NIVEAUX = ['danger', 'warn', 'ok', 'hors'];
  function legendeNiveaux() {
    return ORDRE_NIVEAUX.map(n =>
      `<span class="lg"><span class="dot-lvl ${n === 'ok' ? '' : n}"></span>${esc(NIVEAUX[n])}</span>`).join('');
  }

  // Les colonnes qui ne contiennent QUE des tirets. Sur cinq dossiers, trois d'entre elles n'avaient
  // pas une seule valeur : elles coûtaient de la largeur à toutes les autres et serraient les noms
  // de clients. On les masque, on le DIT, et on laisse un bouton pour les rendre — masquer sans le
  // dire serait pire que le défaut (règle 7.12.0 : un filet ne doit pas devenir un piège).
  function colonnesUtiles(rows) {
    if (prefs.get('colTout', false) === true) return { provisoires: true, signale: true, relance: true, masquees: 0 };
    const c = {
      provisoires: rows.some(r => r.provisionalCount > 0),
      signale: rows.some(r => r.issues > 0),
      relance: rows.some(r => r.lastRelanceAt)
    };
    c.masquees = ['provisoires', 'signale', 'relance'].filter(k => !c[k]).length;
    return c;
  }

  // Le portefeuille d'un coup d'œil. C'est ce qui manquait pour qu'un comptable voie autre chose
  // qu'une liste — et c'est précisément ce qui impressionne en démonstration.
  function portfolioPanel(p) {
    if (!p.total) return '';
    // 9.4.4 — quatre cartes de 180 px de haut poussaient la LISTE DES CLIENTS sous la ligne de
    // flottaison : à 1280×800, elle commençait à 800 px, c'est-à-dire exactement au bas de l'écran.
    // Le portefeuille EST le produit ; il ne se mérite pas au défilement. Les mêmes quatre chiffres
    // tiennent sur une rangée de 72 px — et deux d'entre eux NOMMENT un ensemble, donc ils
    // l'ouvrent (règle 7.15.0) : « à jour » et « mois manquants » mènent là où on agit.
    const item = (cle, lbl, val, sub, ton) => `<${cle ? 'button type="button"' : 'div'} class="stat${cle ? ' ouvre' : ''}"${cle ? ` data-pf="${cle}"` : ''}>
      <span class="pf-l"><b class="val${ton ? ' ' + ton : ''}">${val}</b> <span class="lbl">${lbl}</span></span>
      <span class="sub">${sub}</span></${cle ? 'button' : 'div'}>`;
    return `<div class="stats rangee">
      ${item('', 'clients suivis', p.total,
    `${p.surSkanfact} sur SkanFact${p.horsSkanfact ? ` · ${p.horsSkanfact} pas encore` : ''}`)}
      ${item('ajour', `à jour sur ${p.surSkanfact || 0}`, p.aJour,
    `${p.enRetard ? `${p.enRetard} en retard` : 'aucun retard'}${p.provisoires ? ` · ${p.provisoires} en provisoire` : ''}`,
    p.enRetard ? '' : 'ok')}
      ${item('manquants', 'mois manquants', p.moisManquants,
    p.paquets ? pl(p.paquets, 'paquet') + ' reçu' + (p.paquets > 1 ? 's' : '') : 'aucun paquet reçu',
    p.moisManquants ? 'due' : 'ok')}
      ${item('', 'de CA suivi', esc(money(p.dernierCA)),
    p.honoraires ? 'Honoraires : ' + esc(money(p.honoraires)) + ' / mois' : 'somme des derniers mois reçus')}
    </div>`;
  }
  // Les deux chiffres qui nomment un ensemble l'ouvrent. « À jour » n'a pas de page à lui : il pose
  // le filtre qui montre les clients concernés, sur la liste qu'on a déjà sous les yeux.
  function bindPortfolio(root) {
    $$('[data-pf]', root || document).forEach(b => {
      b.onclick = () => {
        if (b.dataset.pf === 'manquants') { location.hash = '#/relances'; return; }
        listState.q = ''; listState.withArchived = false; listState.onlySkanfact = true;
        listState.sort = 'urgence'; listState.desc = false; listState.page = 1;
        render();
      };
    });
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
    const todo = K.cabinetTodo(S, null, { cleSecours: recoveryAt === undefined ? null : recoveryAt !== null, licence: licCab });
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
      $('#demo-on').onclick = async () => { S = await chargerOuRetirerExemple(true); render(); toast('Exemple chargé : ces cinq dossiers sont fictifs.'); };
      bindInboxBanner(view);
      bindRecoveryBanner(view);
      return;
    }

    const shown = paginate(rows);
    const col = colonnesUtiles(rows);
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
        que tu rencontreras. Ils disparaîtront au premier vrai paquet importé.${exempleRefait ? ` <strong>Ils viennent d'être remis à jour</strong>
        ${exempleRefait.raison === 'version' ? `avec la version ${esc(exempleRefait.version)}` : 'sur le mois en cours'} : un exemple qui date
        montrerait des retards qui n'existent pas. Tes vrais dossiers n'ont pas bougé.${exempleRefait.livres
          ? ` ${pl(exempleRefait.livres, 'livre de démonstration est parti', 'livres de démonstration sont partis')} avec l'ancien exemple : ce qui avait été saisi dessus n'existe plus.` : ''}` : ''}</span>
        <button class="btn btn-ghost btn-sm nw" id="demo-off">Effacer l'exemple</button></div>` : ''}
      <div class="filters">
        <span class="champ-loupe"><input type="search" id="q" placeholder="Chercher un client, un matricule, un téléphone…" value="${esc(listState.q)}"></span>
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
        <th class="r nw">Chiffre d'affaires</th>${sortHead('Mois manquants', 'manquants', null, true)}
        ${col.provisoires ? '<th class="r nw">Provisoires</th>' : ''}${col.signale ? '<th class="r nw">Signalé</th>' : ''}
        ${col.relance ? sortHead('Relancé le', 'relance', 'r.history') : ''}${sortHead('Reçu le', 'recu')}<th></th></tr></thead>
        <tbody>${shown.map(r => `<tr class="clickable" data-id="${esc(r.id)}">
          <td class="nw"><span class="dot-lvl ${r.level === 'ok' ? '' : esc(r.level)}" title="${esc(NIVEAUX[r.level] || '')}"></span>${esc(r.name)}${r.archived ? ' <span class="badge">archivé</span>' : ''}${r.manual ? ' <span class="badge b-hors">pas encore sur SkanFact</span>' : ''}</td>
          <td class="nw">${esc(r.lastLabel || '—')}${r.lastMonth && !r.lastDefinitive ? ' <span class="badge partielle">provisoire</span>' : ''}</td>
          <td class="r nw">${esc(r.lastFigures ? money(r.lastFigures.ca, r.lastFigures.devise) : '—')}</td>
          <td class="r">${r.missingCount || '—'}</td>
          ${col.provisoires ? `<td class="r">${r.provisionalCount || '—'}</td>` : ''}
          ${col.signale ? `<td class="r">${r.issues || '—'}</td>` : ''}
          ${col.relance ? `<td class="muted nw">${r.lastRelanceAt ? esc(fmtDay(r.lastRelanceAt)) + ` <span class="small">(${esc(ago(r.lastRelanceAt))})</span>` : '—'}</td>` : ''}
          <td class="muted nw">${esc(fmtWhen(r.lastAt))}</td>
          ${RowMenu.cellule('D:' + r.id, '')}</tr>`).join('')}</tbody>
        <tfoot><tr><td class="nw"><strong>${pl(rows.length, 'dossier')}</strong></td><td></td>
          <td class="r nw"><strong>${esc(totalCA(rows))}</strong></td>
          <td class="r"><strong>${rows.reduce((s, r) => s + r.missingCount, 0) || '—'}</strong></td>
          ${col.provisoires ? `<td class="r"><strong>${rows.reduce((s, r) => s + r.provisionalCount, 0) || '—'}</strong></td>` : ''}
          ${col.signale ? `<td class="r"><strong>${rows.reduce((s, r) => s + r.issues, 0) || '—'}</strong></td>` : ''}
          ${col.relance ? '<td></td>' : ''}<td></td><td></td></tr></tfoot>
        </table></div>${pagerBar(rows.length)}
        <p class="legende">${legendeNiveaux()}</p>
        <p class="muted small">Les totaux et l'export portent sur la sélection entière, pas sur la page affichée.${
  col.masquees ? ` ${pl(col.masquees, 'colonne vide est masquée', 'colonnes vides sont masquées')}, pour laisser la place aux autres.
          <button type="button" class="btn btn-ghost btn-sm" id="col-tout">Tout afficher</button>` : ''}</p>`
        : `<div class="empty">Aucun dossier ne correspond à cette recherche.</div>`}`;

    $('#imp').onclick = () => doImport();
    $('#new-d').onclick = () => newDossierForm();
    const dOff = $('#demo-off');
    if (dOff) dOff.onclick = async () => { S = await chargerOuRetirerExemple(false); render(); toast('Exemple effacé.'); };
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
    bindPortfolio(view);
    bindSort(view, render);
    bindPager(view, render);
    const ct = $('#col-tout');
    if (ct) ct.onclick = () => { prefs.set('colTout', true); render(); };
    $$('tr[data-id]', view).forEach(tr => {
      tr.onclick = e => {
        // Le menu d'actions vit DANS la ligne : sans cette garde, l'ouvrir ouvrirait aussi la fiche
        // (règle 7.28.0 — un menu ne vole pas le clic de sa ligne, et la ligne ne vole pas le sien).
        if (e.target.closest('.row-actions')) return;
        location.hash = '#/dossier/' + encodeURIComponent(tr.dataset.id);
      };
    });
    // 9.4.4 — la page principale du Cabinet n'avait AUCUNE action de ligne, alors que `rowmenu.js`
    // est partagé par les deux applications depuis la 7.29.0. Relancer un client depuis le
    // portefeuille demandait : cliquer la ligne, ouvrir la fiche, trouver « Relancer ». Trois écrans
    // pour le geste du lundi matin.
    bindRowMenus(view, cle => {
      const r = rows.find(x => 'D:' + x.id === cle);
      if (!r) return [];
      const d = (S.dossiers || []).find(x => x.id === r.id);
      if (!d) return [];
      const vers = onglet => { location.hash = '#/dossier/' + encodeURIComponent(r.id) + '/' + onglet; };
      // `writeRelance` attend une LIGNE de `dossierList` (elle y lit `missingMonths`), pas la fiche
      // brute — les deux existent ici et se ressemblent, et c'est exactement le genre de confusion
      // qui produit un mail vide. Et on ne propose la relance que s'il y a quelque chose à
      // réclamer : une action qui n'a rien à faire est du bruit dans un menu.
      const aRelancer = r.missingCount > 0 || r.provisionalCount > 0;
      return [
        ...(aRelancer ? [{
          icon: 'email', label: 'Relancer ce client',
          hint: r.missingCount ? `${pl(r.missingCount, 'mois', 'mois')} à réclamer` : 'Son dernier mois n\'est pas clôturé',
          run: () => writeRelance(r)
        }] : []),
        { icon: 'contrat', label: 'Ouvrir sa comptabilité', hint: 'Livre-journal, grand livre, balance, saisie', run: () => vers('comptabilite') },
        { icon: 'dossier', label: 'Voir ses paquets reçus', hint: 'Ce qu\'il a envoyé, mois par mois', run: () => vers('paquets') },
        { sep: true },
        { icon: 'modifier', label: 'Modifier la fiche', hint: 'Nom, matricule, contact, honoraires', run: () => dossierForm(d) }
      ];
    });
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
    // Les mois restent dans l'ordre du TEMPS. `.reverse()` les affichait « Août, Juillet, Juin,
    // Mai, Avril, Mars » sous une étiquette « 2026 » : personne ne lit un calendrier à l'envers, et
    // il fallait relire deux fois pour comprendre où commençait la mission. L'ordre des ANNÉES,
    // lui, reste le plus récent d'abord — c'est le mois courant qu'on vient voir.
    const months = K.dossierMonths(dossier);
    const packs = (dossier.packs || []).slice().sort((a, b) => a.month < b.month ? 1 : -1);
    const relances = (dossier.relances || []).slice().reverse();
    // Les mois regroupés par année : douze cases par ligne valent mieux qu'une bande sans fin.
    const years = [...new Set(months.map(m => m.month.slice(0, 4)))].sort().reverse();
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
      // Un manque annoncé porte le bouton qui le comble (7.20.0) : « email à renseigner » et
      // « téléphone à renseigner » étaient du gris inerte, alors que ce sont les deux champs sans
      // lesquels aucune relance ne part. Ici on est dans un tableau JS, pas dans un gabarit : la
      // forme `${/* … */''}` n'a rien à y faire, et casse le fichier.
      dossier.email ? esc(dossier.email) : '<button type="button" class="lien-manque" data-ident="1">email à renseigner</button>',
      dossier.phone ? esc(dossier.phone) : '<button type="button" class="lien-manque" data-ident="1">téléphone à renseigner</button>',
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
        ${/* Un en-tête de fiche a un budget de boutons, comme une ligne de liste (7.29.0).
              « Imprimer » est un geste rare : il occupait une place premium à côté de ceux qu'on
              fait tous les jours. Les deux gestes de contact le rejoignent — ils dépendent d'un
              numéro qu'un dossier sur deux n'a pas, donc la barre changeait de forme d'un client
              à l'autre. */''}
        ${RowMenu.bouton('F:' + dossier.id, 'Actions', 'btn')}
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
        ${/* Les DOUZE mois de chaque année, pas seulement ceux attendus. L'écran en montrait six
              sous une étiquette « 2026 », sans dire pourquoi : on ne savait pas si la mission
              commençait en mars ou si l'application avait perdu les deux premiers. Les mois hors
              mission sont là, en gris, et ils DISENT pourquoi — c'est le calendrier qui explique
              l'extrait, pas l'inverse. Et chaque mois attendu porte son geste : ouvrir le paquet
              quand il est là, relancer sur CE mois quand il manque (règle 7.15.0 — un écran qui
              nomme un ensemble doit pouvoir l'ouvrir). */''}
        ${months.length ? years.map(y => `<div class="year-row"><div class="year-lab">${esc(y)}</div>
          <div class="mgrid">${MOIS_COURTS.map((nom, k) => {
    const mois = `${y}-${String(k + 1).padStart(2, '0')}`;
    const m = months.find(x => x.month === mois);
    if (!m) {
      // « À venir » sur le mois où l'on EST serait faux : il est en cours, et c'est précisément
      // pour ça qu'il n'est jamais réclamé. Une étiquette approximative sur un calendrier fait
      // douter de tout le tableau.
      const avant = mois < (months[0] || {}).month;
      const raison = avant ? 'hors mission' : mois === K.today().slice(0, 7) ? 'en cours' : 'à venir';
      return `<div class="mcell hors" title="${esc(avant
        ? 'Avant le début de mission : rien n\'est réclamé pour ce mois.'
        : 'Le mois en cours et les suivants ne sont jamais réclamés — le client ne peut pas encore les clôturer.')}">
        <div class="m-lab">${esc(nom)}</div><div class="m-st">${esc(raison)}</div></div>`;
    }
    const ouvrable = !!(m.pack && m.pack.path);
    const etat = m.state === 'complet' ? 'définitif' : m.state === 'provisoire' ? 'provisoire' : 'manquant';
    // Un mois reçu avant la 6.1.0 n'a pas de fichier sur le disque : le bouton DIT pourquoi au
    // lieu de ne rien faire (règle 7.21.0). Un bouton qui accepte le clic sans agir est pire
    // qu'un bouton absent.
    const quoi = ouvrable ? 'Ouvrir le paquet de ' + m.label
      : m.state === 'manquant' ? 'Relancer sur ' + m.label
        : 'Reçu avant que les paquets ne soient rangés sur le disque : rien à ouvrir.';
    const agit = ouvrable || m.state === 'manquant';
    return `<button type="button" class="mcell ${m.state}${agit ? ' clickable' : ''}"
      ${ouvrable ? `data-m="${esc(m.month)}"` : m.state === 'manquant' ? `data-relm="${esc(m.month)}"` : 'disabled'}
      title="${esc(quoi)}" aria-label="${esc(m.label)} — ${esc(etat)}. ${esc(quoi)}">
      <div class="m-lab">${esc(nom)}</div><div class="m-st">${esc(etat)}</div></button>`;
  }).join('')}</div></div>`).join('')
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
        : `<div class="empty mini">Aucune relance enregistrée pour ce client.<br>
          <span class="small">Le bouton « Relancer », en haut, écrit le message et l'enregistre ici. Un appel ou un message
          passé ailleurs se note à la main.</span></div>`}
        ${/* Un état vide qui explique le geste en prose n'est pas une interface (7.0.0) : le bouton
              vit DANS le panneau, et il en a l'air. */''}
        <div class="modal-actions"><button class="btn btn-sm" id="note-rel">Noter une relance faite ailleurs…</button></div>
      </div>

      ${(dossier.note || '').trim() ? `<div class="panel"><h2>Note interne</h2><div class="notes-md">${esc(dossier.note)}</div></div>` : ''}
      </section>

      <section data-onglet="comptabilite" ${onglet === 'comptabilite' ? '' : 'hidden'}>
      ${packs.length ? `<div class="panel" id="c-compta"><h2>Comptabilité ${info('lv.compta')}</h2>
        ${/* Deux listes déroulantes nues au-dessus d'un livre-journal ne disent pas ce qu'elles
              choisissent : « L'exercice / 2026 » pouvait tout aussi bien être un filtre de journal.
              Le mot « Période » devant, et chaque contrôle porte son `aria-label` — un lecteur
              d'écran n'a pas de capture d'écran pour deviner. */''}
        <div class="filters">
          <span class="f-lab">Période</span>
          <select id="lv-mode" aria-label="Quelle période">
            <option value="exercice" ${livresState.mode === 'exercice' ? 'selected' : ''}>L'exercice</option>
            <option value="mois" ${livresState.mode === 'mois' ? 'selected' : ''}>Un mois</option>
            <option value="intervalle" ${livresState.mode === 'intervalle' ? 'selected' : ''}>Du… au…</option>
          </select>
          <select id="lv-annee" aria-label="L'exercice" ${livresState.mode === 'exercice' ? '' : 'hidden'}>${years.map(y => `<option value="${esc(y)}" ${livresState.annee === y ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select>
          <select id="lv-mois" aria-label="Le mois" ${livresState.mode === 'mois' ? '' : 'hidden'}>${months.map(m => `<option value="${esc(m.month)}" ${livresState.mois === m.month ? 'selected' : ''}>${esc(K.monthLabel(m.month))}</option>`).join('')}</select>
          <input type="month" id="lv-du" aria-label="Du mois" ${livresState.mode === 'intervalle' ? '' : 'hidden'} value="${esc(livresState.du)}">
          <input type="month" id="lv-au" aria-label="Au mois" ${livresState.mode === 'intervalle' ? '' : 'hidden'} value="${esc(livresState.au)}">
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
        ${caChart(packs, anneeVue) || '<div class="empty mini">Les paquets de cette année ne portent pas de chiffres (fabriqués avant la 6.2.1).</div>'}
      </div>` : ''}

      <div class="panel"><h2>Paquets reçus ${info('p.integrity')}${info('p.actions')}</h2>
      ${packs.length ? `<div class="scroll-x"><table class="list compact">
        <thead><tr><th class="nw">Mois</th><th>État</th><th class="r nw">Chiffre d'affaires</th><th class="r nw">TVA à décaisser</th>
        <th class="r">Vérifiées</th><th class="r">Signalé</th><th class="nw">Reçu le</th><th class="nw">Fabriqué le</th><th></th></tr></thead>
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
          <td class="muted nw" title="${esc('Poids du fichier : ' + fmtBytes(p.bytes))}">${esc(p.generatedAt ? fmtWhen(Date.parse(p.generatedAt)) : '—')}</td>
          ${p.path ? rowMenuCell(p.month) : '<td class="row-actions"><span class="muted small">exemple</span></td>'}</tr>`).join('')}</tbody>
        <tfoot><tr><td class="nw"><strong>${pl(packs.length, 'mois', 'mois')}</strong></td><td></td>
          <td class="r nw"><strong>${esc(money(totalCA))}</strong></td><td colspan="6"></td></tr></tfoot></table></div>
        `
        : '<div class="empty mini">Aucun paquet reçu.</div>'}
      </div>
      </section>`;

    $('#back').onclick = () => { location.hash = '#/dossiers'; };
    // Changer d'onglet, c'est changer d'adresse : « précédent » revient dessus, et une autre page
    // peut y emmener directement.
    $$('#d-tabs button', view).forEach(b => b.onclick = () => versOnglet(b.dataset.tab));
    $$('[data-vers]', view).forEach(b => b.onclick = () => versOnglet(b.dataset.vers));
    $('#edit').onclick = () => dossierForm(dossier);
    $$('[data-ident]', view).forEach(b3 => { b3.onclick = () => dossierForm(dossier); });
    const cy = $('#ca-year');
    if (cy) cy.onchange = e => { ficheYear = e.target.value; render(); };
    const rel = $('#rel'); if (rel) rel.onclick = () => writeRelance(row);
    $('#note-rel').onclick = () => noteRelanceForm(row);
    $$('[data-m]', view).forEach(c => { c.onclick = () => openPack(dossier, c.dataset.m); });
    // Un mois manquant NOMME un manque : le geste qui va avec, c'est la relance — et elle part
    // préremplie sur CE mois-là, pas sur tous. Cinq cartouches rouges et aucun bouton, c'était
    // l'écran qui décrit un problème sans offrir d'y répondre (7.15.0).
    $$('[data-relm]', view).forEach(c => {
      c.onclick = () => {
        const r = K.dossierList(S).find(x => x.id === dossier.id);
        if (r) writeRelance({ ...r, missingMonths: [c.dataset.relm] });
      };
    });

    // Les livres du dossier (9.1.0). L'état de la période est propre au dossier : passer d'un
    // client à l'autre en gardant « mars 2026 » afficherait un livre vide sans raison visible
    // (même garde-fou que `ficheYear`, plus haut).
    if ($('#c-compta', view)) {
      if (livresState.dossierId !== dossier.id) {
        livresState.dossierId = dossier.id; livresState.data = null;
        livresState.annee = ''; livresState.mois = ''; livresState.du = ''; livresState.au = '';
        livresState.onglet = 'journal'; livresState.compte = ''; livresState.journal = ''; livresState.q = ''; livresState.aux = false;
        livresState.page = 1;
      }
      const relire = () => drawLivres(view, dossier);
      const mode = $('#lv-mode', view);
      mode.onchange = () => { livresState.mode = mode.value; livresState.page = 1; render(); };
      // Changer d'exercice change de LIVRE : sans cette relecture, on regarderait 2025 dans le
      // livre de 2026 sans que rien ne le dise.
      const an = $('#lv-annee', view); if (an) an.onchange = () => {
        livresState.annee = an.value; livresState.page = 1;
        chargerLeLivre(dossier).then(apres, apres);
      };
      const mo = $('#lv-mois', view); if (mo) mo.onchange = () => { livresState.mois = mo.value; livresState.page = 1; relire(); };
      const du = $('#lv-du', view); if (du) du.onchange = () => { livresState.du = du.value; livresState.page = 1; relire(); };
      const au = $('#lv-au', view); if (au) au.onchange = () => { livresState.au = au.value; livresState.page = 1; relire(); };
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
    // UNE seule table d'actions par racine : `bindRowMenus` écrase le gestionnaire précédent, donc
    // une seconde table rendrait la première parfaitement inerte — sans une erreur nulle part.
    bindRowMenus(view, cle => {
      // Les gestes rares de l'EN-TÊTE de fiche (9.4.8). « Imprimer » occupait une place premium à
      // côté des gestes quotidiens ; les deux gestes de contact dépendent d'un numéro qu'un dossier
      // sur deux n'a pas, donc la barre changeait de forme d'un client à l'autre.
      if (cle === 'F:' + dossier.id) {
        return [
          { icon: 'ouvrir', label: 'Imprimer la fiche', hint: 'Tout le dossier, onglets compris', run: () => window.print() },
          dossier.phone ? { sep: true } : null,
          dossier.phone ? { icon: 'telephone', label: 'Appeler le client', hint: dossier.phone,
            run: () => api.tel({ number: dossier.phone }).catch(e => toast(plainError(e), 'error')) } : null,
          dossier.phone ? { icon: 'cloche', label: 'Écrire sur WhatsApp', hint: 'Le message de relance, tout prêt',
            run: () => {
              const m = K.relanceMail(S.cabinet, row);
              api.tel({ number: dossier.phone, whatsapp: true, text: m.body }).catch(e => toast(plainError(e), 'error'));
            } } : null
        ].filter(Boolean);
      }
      const mois = cle;
      const p = packs.find(x => x.month === mois);
      if (!p || !p.path) return [];
      return [
        { icon: 'loupe', label: 'Ouvrir le paquet', hint: 'Les pièces du mois, une par une', run: () => openPack(dossier, p.month) },
        { icon: 'extraire', label: 'Extraire dans un dossier…', hint: 'Tout le contenu, pour ton logiciel ou pour le rendre au client', run: () => extractPack(dossier, p.month) },
        { icon: 'dossier', label: 'Montrer le fichier reçu', hint: 'Dans l\'explorateur de fichiers', run: () => api.reveal(p.path) },
        { sep: true },
        { icon: 'email', label: 'Accuser réception', hint: 'Prévenir le client que c\'est bien arrivé', run: () => accuseReception(dossier, p) },
        { sep: true },
        // Le geste qui SUIT l'arrivée d'un mois : en faire des écritures. Rien n'y menait depuis un
        // paquet — il fallait savoir qu'un bouton existait, deux onglets plus loin.
        livresState.livre
          ? { icon: 'contrat', label: 'Voir ses écritures', hint: 'Le livre-journal de ce client',
            run: () => { location.hash = '#/dossier/' + encodeURIComponent(dossier.id) + '/comptabilite'; } }
          : { icon: 'contrat', label: 'Créer le livre de ce client', hint: 'À partir des paquets reçus, écriture par écriture',
            run: () => { location.hash = '#/dossier/' + encodeURIComponent(dossier.id) + '/comptabilite'; } },
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
    // 9.4.5 : la pagination des quatre vues. Un seul couple page/taille suffit — une seule vue est
    // affichée à la fois — mais il se remet à 1 dès que ce qu'on regarde change (onglet, filtre,
    // recherche, période, dossier), sinon on arrive « page 7 » sur une sélection qui en fait deux.
    page: 1, size: prefs.get('lvSize', 25), sizeKey: 'lvSize',
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
    // Tout ce qui est lu POUR un couple (dossier, exercice) se périme avec lui. Garder l'état des
    // immobilisations d'un dossier en ouvrant le suivant afficherait les biens de quelqu'un d'autre
    // — et personne ne le verrait, puisque le tableau serait plein (règle 7.1.x).
    s.decl = null; s.immo = null; s.inv = null; s.cloture = null;
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
      const duJ = jour(du) ? jour(du) + '-01' : '', auJ = jour(au) ? jour(au) + '-31' : '';
      // TOUTES les lignes du livre, une fois ; puis on sépare ce qui est DANS la période de ce qui
      // la précède. Ce qui précède fait l'OUVERTURE (T-38) : sur mars seul, un « solde » qui ne vaut
      // que les mouvements de mars n'est pas un solde de compte, et c'est pourtant ainsi qu'un
      // comptable lit cette colonne. L'ouverture = les soldes repris (la balance d'ouverture du
      // dossier) + les mouvements de l'exercice antérieurs au premier jour de la période.
      const toutes = KC.lignesDuLivre(s.livre, { brouillard: s.brouillard });
      const lignes = toutes.filter(l => (!duJ || l.date >= duJ) && (!auJ || l.date <= auJ));
      const avant = duJ ? toutes.filter(l => l.date < duJ) : [];
      const ouverture = KC.soldesDepuisOuverture(s.livre);
      avant.forEach(l => { ouverture[l.account] = KC.round3((ouverture[l.account] || 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0)); });
      // Les mois de l'exercice SANS LA MOINDRE ÉCRITURE (T-02). Avec un livre, « manquant » ne veut
      // plus dire « paquet non reçu » — un dossier hors SkanFact n'en reçoit aucun — mais le livre
      // d'un client à qui il manque neuf mois sur douze doit continuer à le dire : c'est sur ce
      // livre-là qu'on valide, qu'on déclare et qu'on clôture. Le mois en cours n'est jamais
      // réclamé (Cabinet 1.0.0), et un livre encore VIDE n'est pas incomplet, il est vide.
      // Le compte vit dans cabcore (`moisManquants`), le MÊME pour un dossier avec ou sans livre (T-47).
      let manquants = [];
      if (toutes.length && jour(du) && jour(au)) {
        const debutEx = String((s.livre.exercice || {}).du || '').slice(0, 7);
        manquants = K.moisManquants(toutes.map(l => l.date), debutEx && debutEx > du ? debutEx : du, au);
      }
      return { source: 'livre', lignes, avant, ouverture, du: duJ, au: auJ, illisibles: [], anciens: [], manquants, pris: [] };
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
    // Jamais le mois en cours ni l'avenir : sans cette borne, un exercice lu en septembre annonçait
    // neuf mois manquants sur douze, dont quatre qui n'étaient pas encore arrivés (T-47).
    const manquants = K.moisManquants(pris.map(p => p.month), du, au);
    return { source: 'paquets', lignes, avant: [], ouverture: null, du: '', au: '', illisibles, anciens, manquants, pris };
  }

  // Ce que la période affichée porte AVANT elle, et comment le dire. Une seule phrase pour le
  // grand livre et la balance : la 9.1.0 écrivait « ce livre est lu dans les paquets, sans
  // à-nouveau » en permanence, y compris sur le LIVRE du cabinet (T-38) — le constat était vrai,
  // la raison donnée était fausse, et une phrase que rien ne tient est un bug (7.3.0).
  function phraseOuverture() {
    const s = livresState;
    const p = s.periode || {};
    if (p.source !== 'livre') return `Ouverture inconnue : ces écritures sont lues dans les paquets reçus, sans à-nouveau ${info('lv.ouverture')}`;
    const reprise = ((s.livre.ouverture || {}).lignes || []).length;
    const debutEx = String((s.livre.exercice || {}).du || '');
    if (p.du && p.du > debutEx) return `Ouverture au ${esc(fmtJour(p.du))} : les soldes repris${reprise ? '' : ' (aucun)'} plus les mouvements de l'exercice avant cette date ${info('lv.ouverture')}`;
    return reprise
      ? `Ouverture au ${esc(fmtJour(debutEx))} : la balance d'ouverture reprise (${pl(reprise, 'compte')}) ${info('lv.ouverture')}`
      : `Ouverture au ${esc(fmtJour(debutEx))} : nulle — aucune balance d'ouverture reprise ; si l'exercice porte une pièce d'à-nouveau, c'est elle qui porte les soldes reportés ${info('lv.ouverture')}`;
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
          r.ecarts.slice(0, 8).map(e => `  • ${esc(e.piece || e.id)} (${moisLabelCourt(e.mois)}) : ${esc(montant(e.avant))} → ${esc(montant(e.apres))}`).join('\n') : '',
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
            ? (e === 0 ? `Équilibrée : ${esc(montant(d))} de chaque côté.` : `Écart : ${esc(montant(e))} (débit ${esc(montant(d))} / crédit ${esc(montant(c))}).`)
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
          ton client a déclaré, sans pouvoir y ajouter une écriture ni valider quoi que ce soit.
          ${/* Ce que le bouton vert fait APPARAÎTRE (T-03) : sans cette phrase, les sept onglets
                absents se lisaient comme un manque du logiciel — le testeur a cherché « Banque »
                plusieurs minutes et conclu qu'il fallait publier une version. */''}
          Créer le livre ouvre sept onglets de plus : <b>Saisie, Déclaration, Banque, Immobilisations, Inventaire, Exercice</b> et <b>Recherche</b>.</div>
        <div class="modal-actions mb">
          <button class="btn btn-primary" id="lv-relire">Créer le livre à partir des paquets reçus…</button>
          <button class="btn" id="lv-reprendre">Reprendre ce dossier (balance d'ouverture)…</button>
        </div>`
      : s.livreEtat === 'illisible' || s.livreEtat === 'version-inconnue' || s.livreEtat === 'erreur'
        ? `<div class="warn-box mb"><b>Le livre de ${esc(s.annee)} n'a pas pu être ouvert.</b> ${esc(s.livreMotif || '')}
           Les tableaux ci-dessous sont lus dans les paquets reçus. Tes sauvegardes sont dans les Réglages.</div>`
        : '';

    const periode = lignesDeLaPeriode();
    const { lignes, illisibles, anciens, manquants, source } = periode;
    // Les vues et l'export lisent la MÊME période (lignes, ouverture, bornes) : recalculée dans
    // chacune, elle finirait par diverger (7.29.0).
    s.periode = periode;
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

    // La SAISIE n'a pas besoin de lignes existantes : c'est l'écran par lequel elles arrivent. La
    // ranger derrière « Aucune écriture sur cette période » l'aurait rendue inatteignable très
    // exactement le jour où elle sert le plus — le premier.
    // La BANQUE non plus n'a pas besoin de lignes existantes : le premier relevé arrive souvent
    // avant la première écriture, et c'est justement lui qui va les produire.
    // Les IMMOBILISATIONS et l'INVENTAIRE non plus n'ont pas besoin de lignes existantes : un
    // dossier hors SkanFact commence souvent par sa reprise de biens, avant la moindre écriture.
    const corps = s.onglet === 'saisie' ? vueSaisie(dossier)
      : s.onglet === 'declaration' ? vueDeclaration(dossier)
        : s.onglet === 'banque' ? vueBanque(dossier)
          : s.onglet === 'immobilisations' ? vueImmobilisations(dossier)
            : s.onglet === 'exercice' ? vueCloture(dossier)
              : s.onglet === 'inventaire' ? vueInventaire(dossier)
                : !lignes.length
                  ? `<div class="empty mini">Aucune écriture sur cette période.</div>`
                  : s.onglet === 'journal' ? vueJournal(lignes)
                    : s.onglet === 'grand-livre' ? vueGrandLivre(lignes)
                      : s.onglet === 'balance' ? vueBalance(lignes)
                        : s.onglet === 'recherche' ? vueRecherche(lignes)
                          : vueLettrage(lignes);

    // D'OÙ viennent ces chiffres. Deux sources, et l'écran le dit en toutes lettres : une balance
    // lue dans les paquets du client et une balance tenue par le cabinet ne disent pas la même
    // chose dès la première saisie, et rien ne permettrait de savoir laquelle on regarde.
    const bandeau = source === 'livre'
      ? `<div class="ok-box mb"><b>Le livre de ${esc(s.annee)}</b> — ${pl((s.livre.ecritures || []).filter(e => e.statut === 'validee').length, 'écriture validée', 'écritures validées')}${
          (s.livre.ecritures || []).some(e => e.statut === 'brouillard') ? ', ' + pl(s.livre.ecritures.filter(e => e.statut === 'brouillard').length, 'en brouillard', 'en brouillard') : ''}.
          <label class="check" style="margin-inline-start:12px"><input type="checkbox" id="lv-brouillard" ${s.brouillard ? 'checked' : ''}> Voir le brouillard</label>
          <button class="btn btn-sm" id="lv-relire2" style="margin-inline-start:12px">Relire les paquets reçus</button>${info('lv.relire')}</div>`
      : '';

    el.innerHTML = `${sansLivre}${bandeau}${avert.length ? `<div class="warn-box mb">${avert.map(a => `<div>${esc(a)}</div>`).join('')}</div>` : ''}
      ${/* Une pastille = « ce qui attend une décision », PARTOUT (T-10). Saisie compte les
            brouillards, Banque les lignes non rapprochées, Immobilisations les biens dont la
            dotation de l'exercice n'est pas passée — jamais le nombre de fiches, qui est un
            inventaire. « clos » n'est pas un compteur : c'est un badge. Et sur un exercice clos, la
            Saisie se tait : un compteur sur un écran qui refuse de traiter apprend à ignorer
            les pastilles, y compris celles qui disent vrai. */''}
      <div class="tabs" id="c-tabs">
        ${s.livre ? `<button data-tab="saisie" class="${s.onglet === 'saisie' ? 'active' : ''}">Saisie${
          (s.livre.ecritures || []).some(e => e.statut === 'brouillard') && !(s.livre.exercice && s.livre.exercice.clos)
            ? ` <span class="tab-n">${(s.livre.ecritures || []).filter(e => e.statut === 'brouillard').length}</span>` : ''}</button>` : ''}
        <button data-tab="journal" class="${s.onglet === 'journal' ? 'active' : ''}">Livre-journal</button>
        <button data-tab="grand-livre" class="${s.onglet === 'grand-livre' ? 'active' : ''}">Grand livre</button>
        <button data-tab="balance" class="${s.onglet === 'balance' ? 'active' : ''}">Balance</button>
        <button data-tab="lettrage" class="${s.onglet === 'lettrage' ? 'active' : ''}">Lettrage</button>
        ${s.livre ? `<button data-tab="declaration" class="${s.onglet === 'declaration' ? 'active' : ''}">Déclaration</button>` : ''}
        ${s.livre ? `<button data-tab="banque" class="${s.onglet === 'banque' ? 'active' : ''}">Banque${
          (() => { const n = (s.livre.releves || []).reduce((a, r) => a + r.lignes.filter(l => !(l.rapprochement && l.rapprochement.ecritureId)).length, 0);
            return n ? ` <span class="tab-n">${n}</span>` : ''; })()}</button>` : ''}
        ${s.livre ? `<button data-tab="immobilisations" class="${s.onglet === 'immobilisations' ? 'active' : ''}">Immobilisations${
  (() => { const n = (s.livre.immobilisations || []).length ? KC.etatImmobilisations(s.livre, s.annee).aEcrire : 0;
    return n ? ` <span class="tab-n" title="${n} dont la dotation de l'exercice n'est pas passée">${n}</span>` : ''; })()}</button>` : ''}
        ${s.livre ? `<button data-tab="inventaire" class="${s.onglet === 'inventaire' ? 'active' : ''}">Inventaire</button>` : ''}
        ${s.livre ? `<button data-tab="exercice" class="${s.onglet === 'exercice' ? 'active' : ''}">Exercice${
  s.livre.exercice && s.livre.exercice.clos ? ' <span class="badge b-paid">clos</span>' : ''}</button>` : ''}
        ${s.livre ? `<button data-tab="recherche" class="${s.onglet === 'recherche' ? 'active' : ''}">Recherche</button>` : ''}
      </div>${corps}`;

    $$('#c-tabs button', el).forEach(b => { b.onclick = () => { s.onglet = b.dataset.tab; s.page = 1; drawLivres(root, dossier); }; });
    const cb = $('#lv-brouillard', el);
    if (cb) cb.onchange = () => { s.brouillard = cb.checked; drawLivres(root, dossier); };
    [$('#lv-relire', el), $('#lv-relire2', el)].forEach(b => { if (b) b.onclick = () => relireLesPaquets(root, dossier); });
    const rp = $('#lv-reprendre', el); if (rp) rp.onclick = () => repriseForm(root, dossier);
    if (s.onglet === 'saisie') { brancherSaisie(el, root, dossier); dessinerAbonnements(el, dossier); }
    else if (s.onglet === 'recherche') brancherRecherche(el, root, dossier);
    else if (s.onglet === 'banque') brancherBanque(el, root, dossier);
    else if (s.onglet === 'declaration') brancherDeclaration(el, root, dossier);
    else if (s.onglet === 'immobilisations') brancherImmobilisations(el, root, dossier);
    else if (s.onglet === 'inventaire') brancherInventaire(el, root, dossier);
    else if (s.onglet === 'exercice') brancherCloture(el, root, dossier);
    else brancherVue(el, root, dossier, lignes);
    // APRÈS le dessin, jamais pendant (7.27.0) : un `scrollIntoView` posé dans un gabarit est
    // effacé par le `innerHTML` qui suit.
    focaliser(el);
  }

  // Le livre-journal : une pièce par (date, journal, numéro), numérotée 1..n. Le filtre de journal
  // et la recherche portent sur la SÉLECTION ENTIÈRE — c'est elle que le pied totalise, jamais ce
  // qui est affiché (règle des listes depuis la 2.2.0, côté entreprise).
  // Le badge d'un miroir : ce qu'il annule, et le numéro de l'origine. Partagé par le journal et le
  // grand livre — au grand livre, les deux lignes d'une correction étaient strictement indiscernables.
  const miroirBadge = e => e.contrepasseDe
    ? ` <span class="badge" title="${esc(e.libellePiece || '')}">contre-passation${e.origineNumero ? ` ↩ n° ${esc(String(e.origineNumero))}` : ''}</span>`
    : e.extourneDe
      ? ` <span class="badge" title="${esc(e.libellePiece || '')}">extourne${e.origineNumero ? ` ↩ n° ${esc(String(e.origineNumero))}` : ''}</span>`
      : '';

  function vueJournal(lignes) {
    const s = livresState;
    const journaux = [...new Set(lignes.map(l => l.journal).filter(Boolean))].sort();
    const q = s.q.trim().toLowerCase();
    const gardees = lignes.filter(l => (!s.journal || l.journal === s.journal)
      && (!q || `${l.piece} ${l.tiers} ${l.label} ${l.account}`.toLowerCase().includes(q)));
    const lj = KC.journalDepuisLignes(gardees);
    const cz = KC.centralisateurDepuisLignes(gardees);
    // On pagine les PIÈCES, jamais les lignes : une pièce coupée en deux montrerait un débit sans
    // son crédit, et le lecteur conclurait à un déséquilibre qui n'existe pas. Le pied, lui, porte
    // sur la sélection entière (`lj.debit` / `lj.credit`) — règle des listes depuis la 2.2.0.
    // `pagerBar` est appelé AVANT `paginate` : c'est lui qui ramène `s.page` dans les bornes quand
    // un filtre vient de réduire la sélection. L'inverse afficherait une page vide, puis la bonne
    // au redessin suivant — c'est-à-dire un tableau qui paraît vide sans raison.
    const pager = pagerBar(lj.pieces.length, s, 'pièce');
    const plates = [];
    paginate(lj.pieces, s).forEach(p => p.lignes.forEach((e, i) => plates.push({ ...e, numero: p.numero, premiere: i === 0 })));
    return `${barreLivres(`<select id="lv-journal" aria-label="Filtrer par journal"><option value="">Tous les journaux</option>${journaux.map(j => `<option value="${esc(j)}" ${s.journal === j ? 'selected' : ''}>${esc(j)}</option>`).join('')}</select>
      <span class="champ-loupe"><input type="search" id="lv-q" placeholder="Pièce, tiers, libellé…" value="${esc(s.q)}"></span>`, 'Exporter le livre-journal')}
      <div class="muted small mb">${pl(lj.pieces.length, 'pièce')} · ${pl(gardees.length, 'ligne')}${lj.off.length ? ` · <span class="err-inline">${pl(lj.off.length, 'pièce')} déséquilibrée${lj.off.length > 1 ? 's' : ''}</span>` : ''}</div>
      <div class="scroll-x"><table class="list compact"><thead><tr>
        <th class="r nw">N°</th><th class="nw">Date</th><th>Journal</th><th class="nw">Pièce</th><th class="nw">Compte</th>
        <th>Tiers</th><th>Libellé</th><th class="r nw">Débit</th><th class="r nw">Crédit</th><th></th></tr></thead>
      ${/* Le MIROIR d'une contre-passation ou d'une extourne se reconnaît (T-34) : l'originale est
            barrée, mais la pièce jumelle — même numéro de pièce, mêmes libellés — ne portait aucun
            repère, et il fallait DÉDUIRE la correction au lieu de la lire. Le lien « ↩ n° 49 » est
            celui que le moteur enregistre depuis la 9.3.0 et que l'écran n'atteignait jamais. */''}
      <tbody>${plates.map(e => `<tr class="${e.statut === 'brouillard' ? 'br-ligne' : e.statut === 'contrepassee' ? 'cp-ligne' : e.contrepasseDe || e.extourneDe ? 'cp-miroir' : ''}">
        <td class="r muted">${e.premiere ? (e.statut === 'brouillard' ? '<span class="badge">brouillard</span>' : e.numero || '') : ''}</td>
        <td class="nw">${e.premiere ? esc(fmtJour(e.date)) : ''}</td>
        <td>${e.premiere ? esc(e.journal) : ''}</td>
        <td class="nw">${e.premiere ? esc(e.piece) + miroirBadge(e) : ''}</td>
        <td class="nw">${esc(e.account)}</td>
        <td class="tronq" title="${esc(e.tiers)}">${esc(e.tiers)}</td>
        <td class="tronq lg" title="${esc(e.label)}">${esc(e.label)}</td>
        <td class="r nw">${e.debit ? esc(money(e.debit, e.currency)) : ''}</td>
        <td class="r nw">${e.credit ? esc(money(e.credit, e.currency)) : ''}</td>
        ${e.premiere ? rowMenuCell(e.ecritureId ? 'E:' + e.ecritureId : e.piece + '|' + (e.mois || '')) : '<td class="row-actions"></td>'}</tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="7"><strong>Total de la sélection</strong> <span class="muted small">— toutes les pièces, pas seulement la page affichée</span></td>
        <td class="r nw"><strong>${esc(money(lj.debit))}</strong></td>
        <td class="r nw"><strong>${esc(money(lj.credit))}</strong></td><td></td></tr></tfoot></table></div>
      ${pagerBar(lj.pieces.length, s, 'pièce')}
      <details class="mt"><summary>Centralisateur : mois par mois, journal par journal</summary>
        <table class="list compact mt"><thead><tr><th class="nw">Mois</th><th>Journal</th><th class="r">Pièces</th><th class="r nw">Débit</th><th class="r nw">Crédit</th></tr></thead>
        <tbody>${cz.map(r => `<tr><td class="nw">${esc(moisLabelCourt(r.mois))}</td><td>${esc(r.journal)}</td>
          <td class="r">${r.pieces}</td><td class="r nw">${esc(money(r.debit))}</td><td class="r nw">${esc(money(r.credit))}</td></tr>`).join('')}</tbody></table>
      </details>`;
  }

  // Le NOM d'un compte, pour la colonne « Intitulé » du grand livre et de la balance générale.
  //
  // Ces deux écrans passaient `(c, t) => t || ''` : ils affichaient le TIERS, jamais le nom du
  // compte, et ce depuis leur premier jour. Tant que `lignesDuLivre` fabriquait un tiers en
  // découpant le libellé (T-13), quelque chose s'affichait — « Agence Immobilière Le Lac » en face
  // du 606, faux mais visible. La 9.8.5 a rendu au tiers son honnêteté, et la colonne s'est vidée :
  // corriger la donnée ne corrige pas l'écran qui ne l'a jamais lue.
  //
  // Sur une balance GÉNÉRALE, « Intitulé » désigne le nom du compte — c'est la définition du
  // document. Le tiers a son écran à lui, la balance AUXILIAIRE, qui groupe par tiers et l'affiche
  // en première colonne : les deux vues montraient la même chose, et la générale pas la sienne.
  //
  // Le nom vit dans `livre.plan`, nommé par le plan comptable depuis la 9.8.5 — et un compte nommé
  // par le cabinet n'y est jamais réécrit. Sans livre (lecture dans les paquets), on retombe sur le
  // plan comptable de référence, puis sur le tiers : mieux vaut un repère que rien.
  // UN seul résolveur : recopié à chaque écran, il divergerait (7.29.0) — c'est très exactement ce
  // qui vient d'arriver à ces quatre points d'appel.
  function nomDeCompte() {
    const plan = (livresState.livre && livresState.livre.plan) || [];
    const par = new Map(plan.map(c => [c.compte, c.libelle || '']));
    return (c, t) => par.get(c) || KC.libelleDuPlan(c) || t || '';
  }

  function vueGrandLivre(lignes) {
    const s = livresState;
    const ouverture = (s.periode || {}).ouverture || null;
    const gl = KC.grandLivreDepuisLignes(lignes, s.compte, ouverture, nomDeCompte());
    const comptes = [...new Set(lignes.map(l => l.account))].sort();
    return `${barreLivres(`<select id="lv-compte" aria-label="Le compte à afficher"><option value="">Tous les comptes</option>${comptes.map(c => `<option value="${esc(c)}" ${s.compte === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`, 'Exporter le grand livre')}
      <div class="muted small mb">${phraseOuverture()}</div>
      ${pagerBar(gl.comptes.length, s, 'compte')}
      ${/* Un comptable OUVRE un compte ; il ne lit pas les vingt d'affilée. La page en faisait
            6 554 px — sept écrans d'un seul tenant — et il fallait défiler pour savoir quels comptes
            existent, c'est-à-dire pour poser la seule question qu'on se pose en arrivant ici.
            Chaque compte est replié sur sa ligne de synthèse (mouvements, débit, crédit, solde) :
            l'information n'est pas perdue, elle est à un clic, et le PLAN du grand livre se lit
            enfin d'un coup d'oeil. Le compte choisi dans la liste s'ouvre tout seul, et l'impression
            les ouvre tous — un grand livre imprimé plié serait une feuille vide. */''}
      ${paginate(gl.comptes, s).map(c => `<details class="panel mt gl-compte" ${s.compte || gl.comptes.length === 1 ? 'open' : ''}>
        <summary class="gl-tete"><span class="gl-nom">${esc(c.account)}${c.label ? ' — ' + esc(c.label) : ''}</span>
          <span class="gl-chiffres"><span class="muted gl-mv">${pl(c.lignes.length, 'mouvement')}${c.ouverture ? ` · ouverture ${esc(money(c.ouverture))}` : ''}</span>
            <span class="gl-m">D ${esc(money(c.debit))}</span><span class="gl-m">C ${esc(money(c.credit))}</span>
            <strong class="gl-m gl-solde">Solde ${esc(money(c.solde))}</strong></span></summary>
        <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Date</th><th class="nw">Pièce</th><th>Libellé</th>
          <th class="r nw">Débit</th><th class="r nw">Crédit</th><th class="r nw">Solde</th></tr></thead>
        <tbody>${c.lignes.map(e => `<tr class="${e.statut === 'contrepassee' ? 'cp-ligne' : e.contrepasseDe || e.extourneDe ? 'cp-miroir' : ''}"><td class="nw">${esc(fmtJour(e.date))}</td><td class="nw">${esc(e.piece)}${miroirBadge(e)}</td>
          <td class="tronq lg" title="${esc(e.label)}">${esc(e.label)}</td>
          <td class="r nw">${e.debit ? esc(money(e.debit)) : ''}</td><td class="r nw">${e.credit ? esc(money(e.credit)) : ''}</td>
          <td class="r nw">${esc(money(e.solde))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3"><strong>${pl(c.lignes.length, 'mouvement')}</strong></td>
          <td class="r nw"><strong>${esc(money(c.debit))}</strong></td><td class="r nw"><strong>${esc(money(c.credit))}</strong></td>
          <td class="r nw"><strong>${esc(money(c.solde))}</strong></td></tr></tfoot></table></div></details>`).join('')}`;
  }

  function vueBalance(lignes) {
    const s = livresState;
    const ouverture = (s.periode || {}).ouverture || null;
    const generale = KC.balanceDepuisLignes(lignes, ouverture, nomDeCompte());
    const role = s.auxRole === 'fournisseurs' ? 'fournisseurs' : 'clients';
    const b = s.aux ? balanceAux(lignes, role) : generale;
    const ecart = Math.round((b.totaux.soldeD - b.totaux.soldeC) * 1000) / 1000;
    // Les colonnes d'ouverture ne se dessinent que si l'une des deux porte quelque chose : sur
    // l'exercice entier elles valent zéro par construction (règle 9.0.0), et deux colonnes de zéros
    // n'apprennent rien. Mais la phrase du verdict compte les paires qu'on VOIT (T-38).
    const avecOuv = !!(b.totaux.ouvertureD || b.totaux.ouvertureC);
    const paires = avecOuv ? 'les trois paires de totaux (ouverture, mouvements, soldes)' : 'les deux paires de totaux (mouvements, soldes)';
    const pager = pagerBar(b.rows.length, s, s.aux ? 'tiers' : 'compte', s.aux ? 'tiers' : 'comptes');
    const commandes = `<button class="btn btn-sm ${s.aux ? '' : 'btn-ghost'}" id="lv-aux">${s.aux ? 'Balance générale' : 'Balance auxiliaire'}</button>${
      s.aux ? `<label class="f-lab">Collectif<select id="lv-aux-role" aria-label="Le collectif de tiers à détailler">
        <option value="clients" ${role === 'clients' ? 'selected' : ''}>Clients (${esc(KC.collectifsDeTiers(s.livre, 'clients').join(', '))})</option>
        <option value="fournisseurs" ${role === 'fournisseurs' ? 'selected' : ''}>Fournisseurs (${esc(KC.collectifsDeTiers(s.livre, 'fournisseurs').join(', '))})</option></select></label>${info('lv.aux')}` : ''}`;
    // Le verdict d'une balance GÉNÉRALE, c'est l'équilibre. Celui d'une AUXILIAIRE, c'est qu'elle
    // détaille exactement le solde du collectif dans la générale — c'est le contrôle qui aurait
    // fait tomber T-41 le jour de sa naissance. Et une auxiliaire VIDE le dit avec sa cause, jamais
    // « Équilibrée » sur rien (T-40).
    let verdict;
    if (!s.aux) {
      verdict = `<div class="${b.ok ? 'ok-box' : 'warn-box'} mb" id="lv-verdict">${b.ok ? `Équilibrée : débit = crédit sur ${paires}.`
        : `Écart de ${esc(money(Math.abs(ecart)))} entre les soldes débiteurs et créditeurs.`}</div>`;
    } else {
      const C = b.collectifs;
      const nomRole = role === 'clients' ? 'clients' : 'fournisseurs';
      const soldeGen = KC.round3(generale.rows.filter(r => C.some(c => String(r.account).startsWith(c))).reduce((a, r) => a + r.solde, 0));
      const reprisMap = KC.soldesDepuisOuverture(s.livre);
      const repris = KC.round3(Object.keys(reprisMap).filter(k => C.some(c => k.startsWith(c))).reduce((a, k) => a + reprisMap[k], 0));
      if (!b.rows.length) {
        const surCollectif = lignes.some(l => C.some(c => String(l.account).startsWith(c)));
        verdict = `<div class="info-box mb" id="lv-verdict">Aucun ${nomRole === 'clients' ? 'client' : 'fournisseur'} sur cette période : ${
          surCollectif ? `des lignes touchent ${esc(C.join(', '))} mais aucune ne porte de tiers.`
            : `aucune écriture ne touche le collectif ${esc(C.join(', '))}${(s.periode || {}).source !== 'livre' ? ' — ou les paquets datent d\'avant la 8.8.0 et ne portent pas de tiers' : ''}.`}</div>`;
      } else if (KC.round3(b.solde - soldeGen) === 0) {
        verdict = `<div class="ok-box mb" id="lv-verdict">Balance auxiliaire <b>${nomRole}</b> (${esc(C.join(', '))}) : son total, ${esc(money(b.solde))}, est le solde du collectif dans la balance générale.</div>`;
      } else {
        verdict = `<div class="warn-box mb" id="lv-verdict">Balance auxiliaire <b>${nomRole}</b> (${esc(C.join(', '))}) : elle totalise ${esc(money(b.solde))}, la balance générale porte ${esc(money(soldeGen))} sur le collectif — écart de ${esc(money(Math.abs(KC.round3(b.solde - soldeGen))))}${
          repris ? `, dont ${esc(money(Math.abs(repris)))} de solde d'ouverture repris PAR COMPTE, que l'auxiliaire ne sait pas répartir entre les tiers` : ''}.</div>`;
      }
    }
    const colOuv = avecOuv ? `<th class="r nw">Ouverture débit</th><th class="r nw">Ouverture crédit</th>` : '';
    return `${barreLivres(commandes, 'Exporter la balance')}
      ${s.aux ? '' : `<div class="muted small mb">${phraseOuverture()}</div>`}
      ${verdict}
      ${pager}
      <div class="scroll-x"><table class="list compact"><thead><tr>
        <th class="nw">${s.aux ? 'Tiers' : 'Compte'}</th><th>${s.aux ? 'Comptes' : 'Intitulé'}</th>${colOuv}
        <th class="r nw">Mouvements débit</th><th class="r nw">Mouvements crédit</th>
        <th class="r nw">Solde débiteur</th><th class="r nw">Solde créditeur</th></tr></thead>
      <tbody>${paginate(b.rows, s).map(r => `<tr><td class="nw">${esc(s.aux ? r.tiers : r.account)}</td><td>${esc(s.aux ? r.account : (r.label || ''))}</td>${
        avecOuv ? `<td class="r nw">${r.ouvertureD ? esc(money(r.ouvertureD)) : ''}</td><td class="r nw">${r.ouvertureC ? esc(money(r.ouvertureC)) : ''}</td>` : ''}
        <td class="r nw">${esc(money(r.debit))}</td><td class="r nw">${esc(money(r.credit))}</td>
        <td class="r nw">${r.soldeD ? esc(money(r.soldeD)) : ''}</td><td class="r nw">${r.soldeC ? esc(money(r.soldeC)) : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2"><strong>${pl(b.rows.length, s.aux ? 'tiers' : 'compte', s.aux ? 'tiers' : 'comptes')}</strong> <span class="muted small">— la sélection entière</span></td>${
        avecOuv ? `<td class="r nw"><strong>${esc(money(b.totaux.ouvertureD))}</strong></td><td class="r nw"><strong>${esc(money(b.totaux.ouvertureC))}</strong></td>` : ''}
        <td class="r nw"><strong>${esc(money(b.totaux.debit))}</strong></td><td class="r nw"><strong>${esc(money(b.totaux.credit))}</strong></td>
        <td class="r nw"><strong>${esc(money(b.totaux.soldeD))}</strong></td><td class="r nw"><strong>${esc(money(b.totaux.soldeC))}</strong></td></tr></tfoot></table></div>`;
  }

  // La balance auxiliaire : le DÉTAIL D'UN COLLECTIF par tiers, calculé par le moteur
  // (`balanceAuxiliaireDepuisLignes`). La première version échangeait `account` et `tiers` sur
  // TOUTES les lignes qui portaient un tiers, donc chaque client additionnait sa pièce entière —
  // 411, 706, 4367, 4368 — et soldait à zéro par construction (T-41). Les collectifs viennent du
  // RÔLE dans le plan du dossier, jamais d'un numéro écrit ici (règle 6.3.0). Les lignes d'avant
  // la période font l'ouverture par tiers.
  function balanceAux(lignes, role) {
    const s = livresState;
    return KC.balanceAuxiliaireDepuisLignes(lignes, KC.collectifsDeTiers(s.livre, role), { avant: (s.periode || {}).avant || [] });
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
    // La balance âgée et le lettrage automatique (9.5.0). Ils lisent les MÊMES lignes non lettrées
    // que la liste ci-dessous — jamais une seconde liste, qui se désynchroniserait au premier
    // lettrage (SPEC-UI-CAB-022).
    const agee = KC.balanceAgeeDepuisLignes(lignes, prefixe, K.today());
    // Les tiers OUVERTS sont la réponse ; les soldés tiennent sur une ligne dépliable (T-14).
    const ouverts = l.rows.filter(r => r.ouverts.length), soldes = l.rows.filter(r => !r.ouverts.length);
    return `${barreLivres(`<select id="lv-compte" aria-label="Le compte à lettrer"><option value="">Clients (411)</option>${comptes.map(c => `<option value="${esc(c)}" ${s.compte === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      ${s.livre ? `<button class="btn btn-sm" id="lv-auto">Lettrer automatiquement</button>${info('bq.lettrageAuto')}` : ''}`, 'Exporter le lettrage')}
      ${verdict}
      ${agee.total ? `<div class="panel mt"><h2>Ce qui reste dû, par ancienneté ${info('bq.agee')}</h2>
        <div class="scroll-x"><table class="list compact"><thead><tr><th>Tiers</th>
          ${agee.tranches.map(t => `<th class="r nw">${esc(t.label)}</th>`).join('')}<th class="r nw">Total</th></tr></thead>
        <tbody>${agee.tiers.slice(0, 12).map(t => `<tr><td class="tronq" title="${esc(t.tiers)}">${esc(t.tiers)}</td>
          ${t.parTranche.map(x => `<td class="r nw">${x.montant ? esc(money(x.montant)) : ''}</td>`).join('')}
          <td class="r nw"><strong>${esc(money(t.total))}</strong></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>${esc(pl(agee.tiers.length, 'tiers', 'tiers'))}</td>
          ${agee.tranches.map(t => `<td class="r nw">${t.montant ? esc(money(t.montant)) : ''}</td>`).join('')}
          <td class="r nw"><strong>${esc(money(agee.total))}</strong></td></tr></tfoot></table></div>
        ${agee.tiers.length > 12 ? `<div class="small muted mt">Les douze plus gros ; le pied porte les ${agee.tiers.length}.</div>` : ''}</div>` : ''}
      ${l.lettragesFaux.length ? `<div class="warn-box mb">${l.lettragesFaux.map(f =>
        `<div>Lettrage « ${esc(f.lettre) }» de ${esc(f.tiers)} : les pièces ne se soldent pas entre elles (écart ${esc(money(Math.abs(f.ecart)))}).</div>`).join('')}</div>` : ''}
      ${/* Cet écran répond à UNE question : qu'est-ce qui reste dû ? Ce qui est soldé est ce qu'on
            n'a plus à regarder (T-14) : un panneau de 130 px par client soldé noyait la réponse.
            Les soldés tiennent sur une ligne dépliable, sous les ouverts. Et chaque pièce ouverte
            S'OUVRE (T-11) : « FAC-2026-014 · en retard » est une question, pas une information. */''}
      ${pagerBar(ouverts.length, s, 'tiers', 'tiers')}
      ${paginate(ouverts, s).map(r => `<div class="panel mt"><h2>${esc(r.tiers)} <span class="muted small">${esc(r.account)} · reste ${esc(money(r.reste))}</span></h2>
        <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Pièce</th><th class="nw">Date</th>
          <th class="r nw">Débit</th><th class="r nw">Crédit</th><th class="r nw">Reste</th><th></th></tr></thead>
        <tbody>${r.ouverts.map(o => `<tr>
          <td class="nw">${esc(o.piece)}${o.retard ? ' <span class="badge b-late">en retard</span>' : ''}</td>
          <td class="nw">${esc(fmtJour(o.date))}</td>
          <td class="r nw">${o.debit ? esc(money(o.debit)) : ''}</td><td class="r nw">${o.credit ? esc(money(o.credit)) : ''}</td>
          <td class="r nw">${esc(money(o.reste))}</td>${rowMenuCell(o.ecritureId ? 'E:' + o.ecritureId : o.piece + '|' + (o.mois || ''))}</tr>`).join('')}</tbody></table></div></div>`).join('')}
      ${soldes.length ? `<details class="mt" id="lv-soldes"><summary>${pl(soldes.length, 'tiers entièrement lettré', 'tiers entièrement lettrés')} — ${pl(soldes.reduce((a, r) => a + r.lettrees, 0), 'pièce soldée', 'pièces soldées')}</summary>
        <ul class="small">${soldes.map(r => `<li>${esc(r.tiers)} <span class="muted">${esc(r.account)} · ${pl(r.lettrees, 'pièce soldée', 'pièces soldées')}</span></li>`).join('')}</ul></details>` : ''}
      ${!ouverts.length && !soldes.length ? '<div class="empty mini">Aucune pièce sur ce compte pour cette période.</div>' : ''}`;
  }

  // ---------------------------------------------------------------- la déclaration (9.6.0)
  //
  // Ce que cet écran fait : il prépare les chiffres que le comptable RECOPIE sur le portail. Ce
  // qu'il ne fera jamais : déposer à sa place. « Marquer déposée » est un pense-bête, et l'écran le
  // dit en toutes lettres — une application qui déposerait se tromperait un jour sans que personne
  // ne le sache (règle 5.2.0).
  const declState = { mois: '', ouverte: '' };

  const LIBELLE_CASE = {
    tvaCollectee: 'TVA collectée', tvaDeductible: 'TVA déductible', creditReporte: 'Crédit reporté du mois précédent',
    netAPayer: 'TVA nette à payer', creditAReporter: 'Crédit à reporter', timbre: 'Droit de timbre',
    retenuesOperees: 'Retenues à la source opérées', retenuesSubies: 'Retenues subies — à récupérer, pas à payer',
    irpp: 'IRPP retenu sur salaires', aDecaisser: 'Total à décaisser (TVA nette + timbre + retenues opérées)',
    tfp: 'TFP', foprolos: 'FOPROLOS', tcl: 'TCL', acomptes: 'Acomptes provisionnels'
  };
  const ORDRE_CASES = ['tvaCollectee', 'tvaDeductible', 'creditReporte', 'netAPayer', 'creditAReporter',
    'timbre', 'retenuesOperees', 'irpp', 'aDecaisser', 'retenuesSubies', 'tfp', 'foprolos', 'tcl', 'acomptes'];

  function vueDeclaration(dossier) {
    const s = livresState;
    const d = s.decl;
    const tous = MOIS_COURTS.map((m, i) => `${s.annee}-${String(i + 1).padStart(2, '0')}`);
    if (!d) return `<div class="empty mini">Lecture de la déclaration…</div>`;
    const posee = d.posee;
    const etat = KC.etatDuMois(s.livre, d.periode, { recu: (dossier.months || []).includes(d.periode) });
    // L'écriture de déclaration déjà passée — la nôtre, ou celle que le client avait déjà dans ses
    // propres livres. C'est elle qui éteint le bouton : la repasser compterait la TVA deux fois.
    const ecrite = !!d.ecritureExistante;
    const echecs = (d.controles || []).filter(c => !c.ok);
    return `<div class="filters">
      <label class="f-lab">Mois<select id="dc-mois" aria-label="Le mois à déclarer">${tous.map((m, i) =>
        `<option value="${m}" ${m === d.periode ? 'selected' : ''}>${MOIS_COURTS[i]} ${esc(s.annee)}</option>`).join('')}</select></label>
      ${info('dc.etat')}
      <span class="small muted">État</span>
      <span class="badge ${etat.etat === 'payé' ? 'b-paid' : etat.etat === 'déclaré' ? 'b-part' : etat.etat === 'saisi' ? 'b-due' : ''}">${esc(etat.etat)}</span>
      <button class="btn btn-sm" id="dc-preparer">${posee ? 'Recalculer' : 'Préparer la déclaration'}</button>
      <button class="btn btn-sm btn-ghost" id="dc-csv">Exporter les cases</button>
    </div>
    <div class="info-box mb">Ces chiffres se <b>recopient</b> sur le portail. SkanFact ne dépose rien et ne se
      connecte à aucune administration : « Marquer déposée » est un pense-bête, jamais un accusé de réception.</div>
    ${echecs.length ? `<div class="warn-box mb">${echecs.map(c => `<div>${esc(c.detail)}</div>`).join('')}</div>`
      : `<div class="ok-box mb">Les trois contrôles passent : aucun brouillard sur le mois, aucun compte d'attente ouvert, et le report de TVA tombe juste.</div>`}
    <div class="panel mt"><h2>Les cases ${info('dc.cases')}</h2>
      <div class="scroll-x"><table class="list compact"><thead><tr>
        <th>Case</th><th class="r nw">Montant</th><th class="nw">D'où ça vient</th></tr></thead>
      <tbody>${ORDRE_CASES.filter(k => d.cases[k]).map(k => {
        const c = d.cases[k];
        const n = (c.ecritures || []).length;
        // Une ligne qui N'ENTRE PAS dans le total le dit dans sa colonne « d'où ça vient » (T-16) :
        // un total posé au bas d'une colonne se lit comme la somme de la colonne (9.4.5), et l'IRPP
        // imprimé juste au-dessus faisait plus de deux fois le total qui le sautait sans un mot.
        const hors = c.horsTotal ? ` <span class="muted small" title="${esc(c.horsTotal)}">— ${esc(c.horsTotal.split(' — ')[0])}, À VÉRIFIER</span>` : '';
        return `<tr class="${k === 'aDecaisser' ? 'dc-total' : ''}">
          <td>${esc(LIBELLE_CASE[k] || k)}</td>
          <td class="r nw">${c.montant == null ? '<span class="muted">—</span>' : esc(money(c.montant))}</td>
          <td class="tronq" title="${esc(c.horsTotal || c.motif || (n ? pl(n, 'écriture') : ''))}">${
            c.montant == null ? `<span class="muted small">${esc((c.motif || '').slice(0, 60))}…</span>`
              : n ? `<button type="button" class="btn btn-sm btn-ghost" data-cases="${k}" aria-expanded="${declState.ouverte === k ? 'true' : 'false'}">${esc(pl(n, 'écriture'))} ${declState.ouverte === k ? '▴' : '▾'}</button>${hors}`
                : c.sens === 'creance' ? '<span class="muted small">à récupérer — hors total</span>'
                  : c.composantes ? `<span class="muted small">somme de : ${esc(c.composantes.map(x => LIBELLE_CASE[x] || x).join(' + '))}</span>`
                    : `<span class="muted small">calculé</span>${hors}`}</td></tr>`;
      }).join('')}</tbody></table></div>
      ${d.parTaux
        ? `<h3 class="sub-h">TVA collectée par taux</h3><table class="list compact"><tbody>${d.parTaux.map(x =>
            `<tr><td>${esc(x.compte)}</td><td class="r nw">${esc(money(x.montant))}</td></tr>`).join('')}</tbody></table>`
        : `<p class="small muted mt">Le détail par taux demande un sous-compte de TVA collectée par taux
           (${esc(d.comptes.collectee)}1, ${esc(d.comptes.collectee)}2…). Ce dossier n'en a qu'un : le total est juste,
           sa répartition ne s'invente pas.</p>`}
    </div>
    ${declState.ouverte && d.cases[declState.ouverte] ? panneauPieces(d.cases[declState.ouverte], LIBELLE_CASE[declState.ouverte]) : ''}
    <div class="panel mt"><h2>Ce qui suit ${info('dc.suite')}</h2>
      ${/* Un bouton éteint dit POURQUOI, et le motif se lit AU-DESSUS des boutons, en gris — pas
            dans une infobulle qu'il faut deviner au survol, invisible au clavier et au doigt
            (T-17, règles 9.4.5 et 9.4.2). Et le bouton qui débloque est répété ICI : « Préparer la
            déclaration » vivait deux écrans plus haut, et les deux ne se rencontraient jamais. */''}
      ${!posee ? `<p class="small muted">Ces trois gestes attendent la déclaration : prépare-la d'abord.
        <button type="button" class="btn btn-sm btn-primary" id="dc-preparer2" style="margin-inline-start:8px">Préparer la déclaration</button></p>`
        : ecrite ? `<p class="small muted">L'écriture du mois existe déjà : la refaire compterait la TVA du mois deux fois.</p>`
          : !(posee.deposee && posee.deposee.le) && !(posee.payee && posee.payee.le)
            ? `<p class="small muted">« Marquer payée » attend le dépôt : on ne paie pas ce qu'on n'a pas déposé.</p>` : ''}
      <div class="inline">
        <button class="btn btn-sm" id="dc-ecriture" ${!posee || ecrite ? 'disabled' : ''}
          title="${!posee ? 'Prépare la déclaration d\'abord.' : ecrite ? 'Elle existe déjà : la refaire compterait la TVA du mois deux fois.' : ''}">Écrire l'écriture du mois</button>
        <button class="btn btn-sm" id="dc-deposee" ${!posee ? 'disabled' : ''} title="${!posee ? 'Prépare la déclaration d\'abord.' : ''}">${
          posee && posee.deposee && posee.deposee.le ? 'Déposée le ' + esc(fmtJour(posee.deposee.le)) + ' — annuler' : 'Marquer déposée'}</button>
        ${/* Le bouton du paiement reste ALLUMÉ tant qu'un paiement est posé (T-21) : éteint dès que
              le dépôt est vide, il enfermait dans « payée mais pas déposée » sans aucune issue. */''}
        <button class="btn btn-sm" id="dc-payee" ${!posee || (!(posee.deposee && posee.deposee.le) && !(posee.payee && posee.payee.le)) ? 'disabled' : ''}
          title="${!posee ? 'Prépare la déclaration d\'abord.' : !(posee.deposee && posee.deposee.le) && !(posee.payee && posee.payee.le) ? 'On ne paie pas ce qu\'on n\'a pas déposé.' : ''}">${
          posee && posee.payee && posee.payee.le ? 'Payée le ' + esc(fmtJour(posee.payee.le)) + ' — annuler' : 'Marquer payée'}</button>
      </div>
      <p class="small muted mt">L'écriture du mois (${esc(d.comptes.collectee)} / ${esc(d.comptes.deductible)} → ${esc(d.comptes.aPayer)})
      arrive en <b>brouillard</b>, au dernier jour du mois : c'est toi qui la valides.
      ${(s.livre.releves || []).length
        ? 'Le règlement, lui, viendra du relevé bancaire — pointer « payée » ne l\'écrit pas, sinon il serait compté deux fois.'
        : 'Ce dossier n\'a pas de relevé bancaire : le règlement se saisit dans la grille, sur le journal de banque.'}</p>
    </div>`;
  }

  const panneauPieces = (c, titre) => `<div class="panel mt" id="dc-pieces"><h2>${esc(titre)} — les pièces</h2>
    <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Date</th><th class="nw">Journal</th><th class="nw">Pièce</th><th>Libellé</th></tr></thead>
    <tbody>${(c.ecritures || []).map(id => {
      const e = (livresState.livre.ecritures || []).find(x => x.id === id);
      return e ? `<tr><td class="nw">${esc(fmtJour(e.date))}</td><td class="nw">${esc(e.journal)}</td>
        <td class="nw">${esc(e.piece)}</td><td class="tronq lg" title="${esc(e.libelle)}">${esc(e.libelle)}</td></tr>` : '';
    }).join('')}</tbody></table></div></div>`;

  // Le mois proposé : le DERNIER qui porte des écritures, pas janvier. Un comptable ouvre cet
  // écran pour le mois qu'il vient de saisir ; le faire commencer au premier mois de l'exercice
  // serait onze clics par déclaration.
  function moisPropose(livre) {
    const dates = (livre.ecritures || []).map(e => e.date).filter(Boolean).sort();
    return (dates.length ? dates[dates.length - 1] : (livre.exercice.du || '')).slice(0, 7);
  }

  function brancherDeclaration(el, root, dossier) {
    const s = livresState;
    // Une déclaration se LIT au processus principal. Tant qu'elle n'est pas arrivée, l'écran le dit
    // — et c'est ici qu'on la demande, sinon l'onglet resterait sur « Lecture… » pour toujours.
    const veut = declState.mois || moisPropose(s.livre);
    if (!s.decl || s.decl.periode !== veut) { chargerDeclaration(root, dossier); return; }
    const m = $('#dc-mois', el);
    if (m) m.onchange = () => { declState.mois = m.value; declState.ouverte = ''; s.decl = null; chargerDeclaration(root, dossier); };
    $$('[data-cases]', el).forEach(b => { b.onclick = () => {
      declState.ouverte = declState.ouverte === b.dataset.cases ? '' : b.dataset.cases;
      if (declState.ouverte) pageFocus = 'dc-pieces';
      drawLivres(root, dossier);
    }; });
    // Le MÊME geste sur les deux boutons (celui du haut et celui répété sous « Ce qui suit », T-17).
    [$('#dc-preparer', el), $('#dc-preparer2', el)].forEach(prep => {
      if (!prep) return;
      prep.onclick = async () => {
        prep.disabled = true;
        try {
          const r = await api.poserDeclaration({ dossierId: dossier.id, annee: s.annee, periode: s.decl.periode });
          s.livre = r.livre; s.cloture = null; toast('Déclaration préparée.'); await chargerDeclaration(root, dossier);
        } catch (e) { toast(plainError(e), 'error'); prep.disabled = false; }
      };
    });
    const ec = $('#dc-ecriture', el);
    if (ec) ec.onclick = async () => {
      ec.disabled = true;
      try {
        const r = await api.ecrireDeclaration({ dossierId: dossier.id, annee: s.annee, periode: s.decl.periode });
        s.livre = r.livre;
        toast('Écriture créée en brouillard : valide-la quand tu es d\'accord.');
        await chargerDeclaration(root, dossier);
      } catch (e) { toast(plainError(e), 'error'); ec.disabled = false; }
    };
    // Les deux pense-bêtes. Ce qui se pointe par erreur se dé-pointe (7.12.0) — et ici le bouton
    // lui-même porte l'annulation, parce qu'au moment où l'on comprend son erreur, la ligne a déjà
    // quitté l'écran d'où on l'a cliquée.
    [['deposee', '#dc-deposee'], ['payee', '#dc-payee']].forEach(([quoi, sel]) => {
      const b = $(sel, el);
      if (!b) return;
      b.onclick = async () => {
        const posee = s.decl.posee;
        const actif = posee && posee[quoi] && posee[quoi].le;
        try {
          const r = await api.pointerDeclaration({
            dossierId: dossier.id, annee: s.annee, periode: s.decl.periode, quoi,
            valeur: actif ? null : { le: K.today() }
          });
          s.livre = r.livre; s.cloture = null;
          toast(actif
            ? (r.aussiPayee ? 'Dépôt et paiement annulés : on ne paie pas ce qu\'on n\'a pas déposé.' : 'Pointage annulé.')
            : (quoi === 'deposee' ? 'Notée déposée — c\'est un pense-bête, pas un accusé de réception.' : 'Notée payée.'));
          await chargerDeclaration(root, dossier);
        } catch (e) { toast(plainError(e), 'error'); }
      };
    });
    // L'export passe par le MÊME chemin que le reste de l'application (`cab:exportCsv` pose le BOM
    // et la fenêtre d'enregistrement) : en écrire un second aurait fini par diverger sur l'un des
    // deux. Une case inconnue sort VIDE avec sa raison — jamais un zéro qu'on recopierait.
    const csv = $('#dc-csv', el);
    if (csv) csv.onclick = async () => {
      const cell = v => String(v == null ? '' : v).replace('.', ',');
      const texte = [K.toCsvLine(['Case', 'Montant', 'Remarque'])]
        .concat(ORDRE_CASES.filter(k => s.decl.cases[k]).map(k => K.toCsvLine([
          LIBELLE_CASE[k] || k,
          s.decl.cases[k].montant == null ? '' : cell(s.decl.cases[k].montant),
          s.decl.cases[k].motif || ''
        ]))).join('\r\n') + '\r\n';
      try {
        const r = await api.exportCsv(texte, `declaration-${s.decl.periode}-${dossier.matricule || dossier.name}`);
        if (r) toast('Fichier enregistré.');
      } catch (e) { toast(plainError(e), 'error'); }
    };
  }

  // La déclaration se relit au processus principal — jamais recalculée dans l'écran : deux moteurs
  // finiraient par donner deux chiffres, et c'est le genre d'écart qu'on découvre devant un client.
  async function chargerDeclaration(root, dossier) {
    const s = livresState;
    try {
      s.decl = await api.declaration({ dossierId: dossier.id, annee: s.annee, periode: declState.mois || moisPropose(s.livre) });
    } catch (e) { s.decl = null; toast(plainError(e), 'error'); }
    drawLivres(root, dossier);
  }

  // ---------------------------------------------------------------- la clôture d'exercice (9.8.0)
  //
  // Clôturer, c'est arrêter de bouger. Les contrôles NOMMENT sans bloquer : un exercice clos avec
  // trois manques signalés vaut mieux qu'un exercice jamais clos (règle 6.0.0).

  const clotureState = { vue: 'controles' };

  const LIBELLE_CONTROLE = {
    brouillard: 'Les pièces encore en brouillard', attente: 'Le compte d\'attente',
    tva: 'Les déclarations de TVA', tiers: 'La balance des tiers',
    dotations: 'Les dotations aux amortissements', equilibre: 'L\'équilibre de la balance'
  };

  function vueCloture(dossier) {
    const s = livresState;
    const d = s.cloture;
    if (!d) return `<div class="empty mini">Lecture de l'exercice…</div>`;
    const ex = d.exercice;
    const echecs = (d.controles || []).filter(c => !c.ok);
    const e = d.etats;
    const money0 = n => esc(money(n));
    // Un livre SANS à-nouveaux (T-23) : aucune balance d'ouverture reprise ET des capitaux propres
    // à zéro. Une pièce d'à-nouveau venue du client ou de « Ouvrir N+1 » porte ses capitaux dans
    // les lignes : elle suffit, et le vert reste légitime.
    const capitaux = (e.passif || []).find(g => /^Capitaux/.test(g.titre));
    const sansOuverture = !((s.livre.ouverture || {}).lignes || []).length && !(capitaux && capitaux.total);
    const groupe = g => `<tr class="gl-g"><th colspan="2">${esc(g.titre)}</th><th class="r nw">${money0(g.total)}</th></tr>`
      + g.lignes.map(l => `<tr><td class="nw">${esc(l.compte)}</td><td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td><td class="r nw">${money0(l.montant)}</td></tr>`).join('');
    return `<div class="filters">
      ${info('cl.etat')}
      <span class="small muted">Exercice ${esc(ex.annee)}</span>
      <span class="badge ${ex.clos ? 'b-paid' : 'b-due'}">${ex.clos ? 'clos' : 'ouvert'}</span>
      <button class="btn btn-sm ${ex.clos ? '' : 'btn-primary'}" id="cl-cloturer" ${ex.clos ? 'disabled' : ''}
        title="${ex.clos ? 'Cet exercice est déjà clos.' : ''}">Clôturer l'exercice…</button>
      ${ex.clos ? '<button class="btn btn-sm" id="cl-rouvrir">Rouvrir (motif exigé)…</button>' : ''}
      <button class="btn btn-sm" id="cl-suivant">Ouvrir ${esc(Number(ex.annee) + 1)} (à-nouveaux)…</button>
      <button class="btn btn-sm" id="cl-fichier">Le dossier pour le client…</button>
    </div>
    ${/* Le motif d'une réouverture se lit PENDANT qu'elle sert (T-26) : un exercice rouvert est un
          exercice en train de changer, et c'est là que « pourquoi est-il ouvert ? » se pose. Il
          vivait dans la branche « clos » — donc il s'évaporait à la seconde où on le donnait, et
          seul le dernier revenait une fois reclos. L'historique complet est en dessous. */''}
    ${!ex.clos && (ex.reouvertures || []).length ? (() => { const d = ex.reouvertures[ex.reouvertures.length - 1] || {}; return `<div class="warn-box mb" id="cl-rouvert"><b>Exercice rouvert${d.le ? ' le ' + esc(fmtJour(new Date(d.le).toISOString().slice(0, 10))) : ''}${d.par ? ' par ' + esc(d.par) : ''}</b> : « ${esc(d.motif || '')} »</div>`; })() : ''}
    ${ex.clos
    ? `<div class="ok-box mb"><b>Exercice clos</b>${ex.closLe ? ' le ' + esc(fmtJour(new Date(ex.closLe).toISOString().slice(0, 10))) : ''}${
      ex.closPar ? ' par ' + esc(ex.closPar) : ''}.${(ex.reouvertures || []).length
      ? ` Rouvert ${pl(ex.reouvertures.length, 'fois', 'fois')} — ${esc((ex.reouvertures[ex.reouvertures.length - 1] || {}).motif || '')}` : ''}</div>`
    : echecs.length
      ? `<div class="warn-box mb"><b>${pl(echecs.length, 'contrôle', 'contrôles')} ${echecs.length > 1 ? 'signalent' : 'signale'} quelque chose.</b>
           Ils ne bloquent pas : un exercice clos avec des manques signalés vaut mieux qu'un exercice jamais clos.</div>`
      : `<div class="ok-box mb">Les six contrôles passent.</div>`}
    ${/* Le dossier de clôture produit laisse une TRACE (T-27) : quand, où, scellé ou non, et le
          bouton qui retrouve le fichier — un fichier qu'on ne retrouve pas est un fichier qu'on ne
          peut pas envoyer. C'est ce qui répond, le lundi matin, à « lesquels ont reçu le leur ? ». */''}
    ${(ex.dossiersProduits || []).length ? `<div class="panel mt" id="cl-produits"><h2>Dossiers de clôture produits ${info('cl.produits')}</h2>
      <table class="list compact"><tbody>${ex.dossiersProduits.slice().reverse().map((p, i) => `<tr>
        <td class="nw">${esc(fmtJour(new Date(p.le).toISOString().slice(0, 10)))}${p.par ? ` <span class="muted small">par ${esc(p.par)}</span>` : ''}</td>
        <td class="tronq lg" title="${esc(p.chemin)}">${esc(String(p.chemin || '').split(/[\\/]/).pop())}</td>
        <td class="nw small muted">${p.scelle ? 'scellé' : 'non scellé'} · ${p.pdf ? 'avec PDF' : 'sans PDF'}${p.signe ? ' · signé' : ''}</td>
        <td class="row-actions"><button type="button" class="btn btn-sm" data-reveal="${esc(p.chemin)}">Ouvrir le dossier</button></td></tr>`).join('')}</tbody></table></div>` : ''}
    ${(ex.reouvertures || []).length || ex.clos ? `<details class="mt" id="cl-historique"><summary>Clôtures et réouvertures ${info('cl.historique')}</summary>
      <ul class="small">${(ex.reouvertures || []).map(d => `<li>Clos${d.closLe ? ' le ' + esc(fmtJour(new Date(d.closLe).toISOString().slice(0, 10))) : ''}, rouvert${d.le ? ' le ' + esc(fmtJour(new Date(d.le).toISOString().slice(0, 10))) : ''}${d.par ? ' par ' + esc(d.par) : ''} : « ${esc(d.motif || '')} »</li>`).join('')}${
        ex.clos ? `<li>Clos${ex.closLe ? ' le ' + esc(fmtJour(new Date(ex.closLe).toISOString().slice(0, 10))) : ''}${ex.closPar ? ' par ' + esc(ex.closPar) : ''} — en cours.</li>` : ''}</ul></details>` : ''}
    <div class="panel mt"><h2>Avant de clôturer ${info('cl.controles')}</h2>
      <table class="list compact"><tbody>${(d.controles || []).map(c => `<tr>
        <td class="nw">${c.ok ? '<span class="badge b-paid">ok</span>' : '<span class="badge b-late">à voir</span>'}</td>
        <td>${esc(LIBELLE_CONTROLE[c.id] || c.id)}</td>
        <td class="small muted">${esc(c.detail || 'rien à signaler')}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="panel mt"><h2>Les états financiers ${info('cl.etats')}</h2>
      <p class="small muted">Déduits de la <b>balance</b>, rubrique par rubrique. <b>Ce n'est pas la liasse
      fiscale NCT 01</b> : sa présentation exacte n'est pas établie ici, et la promettre serait promettre
      ce qu'une autre version livrera.</p>
      <div class="split">
        <div><h3 class="sub-h">Bilan — actif</h3>
          <div class="scroll-x"><table class="list compact"><tbody>${e.actif.map(groupe).join('')}
            <tr class="dc-total"><td colspan="2"><b>Total actif</b></td><td class="r nw"><b>${money0(e.totalActif)}</b></td></tr></tbody></table></div></div>
        <div><h3 class="sub-h">Bilan — passif</h3>
          <div class="scroll-x"><table class="list compact"><tbody>${e.passif.map(groupe).join('')}
            <tr class="gl-g"><th colspan="2">Résultat de l'exercice</th><th class="r nw">${money0(e.resultat)}</th></tr>
            <tr class="dc-total"><td colspan="2"><b>Total passif</b></td><td class="r nw"><b>${money0(e.totalPassif)}</b></td></tr></tbody></table></div></div>
      </div>
      ${/* Le vert ne se pose que sur un exercice qui a ses à-nouveaux (T-23). « Actif = passif, au
            millime » sur un livre qui commence en juin sans balance d'ouverture affirmait une chose
            vraie (l'équilibre) là où le lecteur en comprend une autre (« ce bilan est bon ») — avec
            un actif négatif et zéro capital. Une phrase rassurante se vérifie d'abord sur un univers
            non vide (7.0.0) ; ici l'univers, ce sont les soldes d'ouverture. */''}
      ${!e.equilibre
    ? `<div class="warn-box mt">Actif et passif diffèrent de ${money0(Math.round((e.totalActif - e.totalPassif) * 1000) / 1000)} :
         une pièce est déséquilibrée, et c'est à regarder avant tout le reste.</div>`
    : sansOuverture
      ? `<div class="warn-box mt" id="cl-sans-ouverture"><b>Ce bilan est la photo d'un livre sans à-nouveaux.</b> Aucune balance d'ouverture
           n'a été reprise et les capitaux propres sont à zéro : ce que les comptes portaient avant la première écriture n'y est pas.
           Actif et passif s'équilibrent — c'est la seule chose garantie — mais ce n'est pas encore un bilan qu'on montre à une banque.
           <div class="mt"><button type="button" class="btn btn-sm" id="cl-reprise">Reprendre les soldes d'ouverture…</button></div></div>`
      : `<div class="ok-box mt">Actif = passif, au millime.</div>`}
      <h3 class="sub-h">État de résultat</h3>
      <div class="scroll-x"><table class="list compact"><tbody>${groupe(e.produits)}${groupe(e.charges)}
        <tr class="dc-total"><td colspan="2"><b>Résultat de l'exercice</b></td><td class="r nw"><b>${money0(e.resultat)}</b></td></tr></tbody></table></div>
    </div>
    <div class="panel mt"><h2>Soldes intermédiaires et ratios ${info('cl.sig')}</h2>
      <table class="list compact"><thead><tr><th>Solde</th><th class="r nw">Montant</th><th>Comment il se calcule</th></tr></thead>
      <tbody>${d.sig.lignes.map(l => `<tr class="${l.id === 'net' ? 'dc-total' : ''}">
        <td>${esc(l.label)}</td><td class="r nw">${money0(l.montant)}</td>
        <td class="small muted">${esc(l.formule)}</td></tr>`).join('')}</tbody></table>
      <table class="list compact mt"><tbody>${d.sig.ratios.map(r => `<tr>
        <td>${esc(r.label)}</td>
        <td class="r nw">${r.valeur == null ? '<span class="muted">—</span>' : esc(String(r.valeur).replace('.', ',')) + ' ' + esc(r.unite)}</td></tr>`).join('')}</tbody></table>
      <p class="small muted mt">Un ratio sans dénominateur ne vaut rien : il affiche « — », jamais 0 %.
      Les rubriques retenues sont celles de l'usage — <b>À VÉRIFIER</b>.</p>
    </div>
    <div class="panel mt"><h2>Les à-nouveaux de ${esc(Number(ex.annee) + 1)} ${info('cl.anouveaux')}</h2>
      <p class="small muted">Calculés sur les écritures <b>réelles</b> de cet exercice et son ouverture :
      les comptes de bilan se reportent, le net des comptes de gestion va au résultat. Ils se posent
      en <b>brouillard</b> dans le livre suivant, et se refont tant qu'ils ne sont pas validés —
      un exercice qui bouge encore change son report.</p>
      <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Compte</th><th>Intitulé</th>
        <th class="r nw">Débit</th><th class="r nw">Crédit</th></tr></thead>
      <tbody>${d.anouveaux.lignes.map(l => `<tr><td class="nw">${esc(l.compte)}</td>
        <td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td>
        <td class="r nw">${l.debit ? money0(l.debit) : ''}</td><td class="r nw">${l.credit ? money0(l.credit) : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th colspan="2">${esc(pl(d.anouveaux.lignes.length, 'ligne'))}</th>
        <th class="r nw">${money0(d.anouveaux.debit)}</th><th class="r nw">${money0(d.anouveaux.credit)}</th></tr></tfoot></table></div>
      ${d.extournes.length ? `<p class="small muted mt">${pl(d.extournes.length, 'écriture s\'extourne', 'écritures s\'extournent')}
        au 1er janvier : elles partiront avec les à-nouveaux. L'originale, elle, reste dans son exercice avec son numéro.</p>` : ''}
    </div>`;
  }

  function brancherCloture(el, root, dossier) {
    const s = livresState;
    // Les contrôles se relisent dès que le LIVRE a bougé (T-24) — préparer une déclaration, valider
    // un brouillard, poser un inventaire : chacun trace dans la piste d'audit, et c'est elle qui
    // sert de repère. Lus une fois et jamais rafraîchis, deux contrôles sur six étaient faux sur
    // l'écran qui décide d'une clôture, et la fenêtre de confirmation les affichait périmés.
    const rev = `${(s.livre.audit || []).length}:${(s.livre.ecritures || []).length}`;
    if (!s.cloture || s.clotureRev !== rev) { s.clotureRev = rev; chargerCloture(root, dossier); return; }
    const rep = $('#cl-reprise', el);
    if (rep) rep.onclick = () => repriseForm(root, dossier);
    const clo = $('#cl-cloturer', el);
    if (clo) clo.onclick = async () => {
      const echecs = (s.cloture.controles || []).filter(c => !c.ok);
      // Le corps d'un `confirmDialog` du Cabinet est du HTML (T-25) : les `\n` et les puces d'une
      // chaîne brute s'y aplatissaient en un pavé de six lignes, et deux avertissements collés ne
      // se lisent pas — on cherche le bouton vert. Une vraie liste, et la phrase dans son `<p>`.
      const ok = await confirmDialog(`Clôturer l'exercice ${s.annee} ?`,
        `<p>Après la clôture, plus aucune écriture de cet exercice ne bouge. La rouvrir reste possible, mais elle exigera un motif — c'est la seule trace qui expliquera pourquoi un chiffre a changé après coup.</p>`
        + (echecs.length ? `<p><b>${pl(echecs.length, 'contrôle signale', 'contrôles signalent')} encore quelque chose :</b></p><ul>${echecs.map(c => `<li>${esc(c.detail)}</li>`).join('')}</ul>` : ''),
        'Clôturer', false);
      if (!ok) return;
      try {
        const r = await api.cloturer({ dossierId: dossier.id, annee: s.annee });
        s.livre = r.livre;
        toast(r.brouillards ? `Exercice clos — ${pl(r.brouillards, 'pièce restée en brouillard', 'pièces restées en brouillard')}.` : 'Exercice clos.');
        await chargerCloture(root, dossier);
      } catch (err) { toast(plainError(err), 'error'); }
    };
    const rou = $('#cl-rouvrir', el);
    if (rou) rou.onclick = () => motifForm(root, dossier);
    const su = $('#cl-suivant', el);
    if (su) su.onclick = async () => {
      su.disabled = true;
      try {
        const r = await api.ouvrirSuivant({ dossierId: dossier.id, annee: s.annee });
        toast(`${r.refaits ? 'À-nouveaux refaits' : 'À-nouveaux posés'} en brouillard sur ${r.annee}.`);
      } catch (err) { toast(plainError(err), 'error'); }
      su.disabled = false;
    };
    const fi = $('#cl-fichier', el);
    if (fi) fi.onclick = () => clotureFichierForm(root, dossier);
    $$('[data-reveal]', el).forEach(b => { b.onclick = () => api.reveal(b.dataset.reveal); });
  }

  async function chargerCloture(root, dossier) {
    const s = livresState;
    try { s.cloture = await api.cloture({ dossierId: dossier.id, annee: s.annee }); }
    catch (e) { s.cloture = null; toast(plainError(e), 'error'); }
    drawLivres(root, dossier);
  }

  function motifForm(root, dossier) {
    const s = livresState;
    modal(`<h2>Rouvrir l'exercice ${esc(s.annee)}</h2>
      <p class="small muted">Le motif est la <b>seule trace</b> qui expliquera, dans six mois, pourquoi un
      chiffre a changé après que le client a reçu ses états. Il est obligatoire.</p>
      <label class="field obligatoire"><span>Pourquoi rouvrir</span>
        <textarea id="cl-motif" rows="3" placeholder="Facture d'électricité de décembre reçue après la clôture"></textarea></label>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">Rouvrir</button></div>`,
    (rootModal, close) => {
      $('#ok', rootModal).onclick = async () => {
        try {
          const r = await api.rouvrir({ dossierId: dossier.id, annee: s.annee, motif: $('#cl-motif', rootModal).value });
          s.livre = r.livre; close(); toast('Exercice rouvert.');
          await chargerCloture(root, dossier);
        } catch (err) { toast(plainError(err), 'error'); }
      };
    });
  }

  function clotureFichierForm(root, dossier) {
    const s = livresState;
    modal(`<h2>Le dossier de clôture pour ${esc(dossier.name || 'ce client')}</h2>
      <p class="small muted">Un fichier <code>.skanclose</code> : les à-nouveaux officiels, les écritures
      d'inventaire, et les états en <b>HTML et PDF</b> — lisibles par n'importe qui, même par un client
      qui ne met jamais son application à jour. Sans lui, son bilan et le tien divergent pour toujours.</p>
      <label class="field"><span>Mot de passe (facultatif)</span>
        <input id="cl-mdp" type="password" placeholder="Laisse vide pour un fichier non scellé"></label>
      <p class="small muted">Le mot de passe se dit au téléphone, jamais dans le même mail que le fichier.
      La clé de signature de ton cabinet, elle, est posée automatiquement : c'est elle qui prouve que ce
      dossier vient bien de toi.</p>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">Produire le fichier…</button></div>`,
    (rootModal, close) => {
      $('#ok', rootModal).onclick = async () => {
        const b = $('#ok', rootModal); b.disabled = true;
        try {
          const r = await api.ecrireCloture({ dossierId: dossier.id, annee: s.annee, motDePasse: $('#cl-mdp', rootModal).value });
          close();
          if (r.annule) { b.disabled = false; return; }
          if (r.livre) s.livre = r.livre;
          toast(`Dossier de clôture écrit${r.pdf ? ' (avec le PDF)' : ' — le PDF n\'a pas pu être produit, l\'HTML est là'}.`);
          // La trace est dans le livre : l'onglet la montre, avec le bouton qui retrouve le fichier.
          pageFocus = 'cl-produits';
          await chargerCloture(root, dossier);
        } catch (err) { toast(plainError(err), 'error'); b.disabled = false; }
      };
    });
  }

  // ---------------------------------------------------------------- les immobilisations (9.7.0)
  //
  // Le dossier permanent du cabinet. Pour un dossier HORS SkanFact, c'est le seul endroit où le
  // plan d'amortissement existe — personne d'autre ne le lui calcule.

  const immoState = { ouverte: '' };

  const METHODE_LABEL = { lineaire: 'Linéaire', degressif: 'Dégressif' };

  function vueImmobilisations(dossier) {
    const s = livresState;
    const d = s.immo;
    if (!d) return `<div class="empty mini">Lecture des immobilisations…</div>`;
    const e = d.etat;
    const y = Number(s.annee);
    return `<div class="filters">
      ${info('im.etat')}
      <span class="small muted">Exercice ${esc(s.annee)}</span>
      <button class="btn btn-sm btn-primary" id="im-neuf">Ajouter un bien…</button>
      <button class="btn btn-sm" id="im-ecrire" ${e.aEcrire ? '' : 'disabled'}
        title="${e.aEcrire ? '' : 'Aucune dotation ni sortie en attente sur cet exercice.'}">Passer les écritures d'inventaire${
  e.aEcrire ? ` (${e.aEcrire})` : ''}</button>
      <button class="btn btn-sm btn-ghost" id="im-csv" ${e.rows.length ? '' : 'disabled'}>Exporter le tableau</button>
    </div>
    ${d.aCreer.length ? `<div class="warn-box mb"><b>${pl(d.aCreer.length, 'ligne', 'lignes')} au compte
      d'immobilisation ${d.aCreer.length > 1 ? 'n\'ont' : 'n\'a'} pas de fiche.</b>
      Tant qu'une fiche n'existe pas, ce bien ne s'amortit nulle part. On ne la crée jamais tout seul :
      la durée d'amortissement est une décision, pas une donnée.
      <div class="scroll-x mt"><table class="list compact"><thead><tr><th class="nw">Date</th><th>Libellé</th>
        <th class="nw">Compte</th><th class="r nw">Montant</th><th></th></tr></thead>
      <tbody>${d.aCreer.slice(0, 12).map(l => `<tr>
        <td class="nw">${esc(fmtJour(l.date))}</td><td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td>
        <td class="nw">${esc(l.compte)}</td><td class="r nw">${esc(money(l.montant))}</td>
        <td class="row-actions"><button class="btn btn-sm" data-creer="${esc(l.docId)}">Créer la fiche du bien…</button></td>
      </tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="panel mt"><h2>Les biens de l'exercice ${info('im.tableau')}</h2>
      ${!e.rows.length
    ? `<div class="empty mini">Aucun bien sur cet exercice. <button class="btn btn-sm" id="im-neuf2">Ajouter un bien…</button></div>`
    : `<div class="scroll-x"><table class="list compact"><thead><tr>
        <th>Bien</th><th class="nw">Mise en service</th><th class="nw">Méthode</th>
        <th class="r nw">Valeur</th><th class="r nw">Cumul au 01/01</th><th class="r nw">Dotation ${esc(s.annee)}</th>
        <th class="r nw">Cumul</th><th class="r nw">VNC</th><th></th></tr></thead>
      <tbody>${e.rows.map(r => `<tr>
        <td class="tronq" title="${esc(r.libelle)}">${esc(r.libelle)}${r.cession
    ? ` <span class="badge b-part">${esc(r.cession.motif === 'rebut' ? 'rebut' : 'cédé')}</span>` : ''}${
  r.ecrite ? ' <span class="badge b-paid">écrite</span>' : ''}</td>
        <td class="nw">${esc(fmtJour(r.date))}</td>
        <td class="nw">${esc(METHODE_LABEL[r.methode] || r.methode)}</td>
        <td class="r nw">${esc(money(r.valeur))}</td>
        <td class="r nw">${esc(money(r.ouverture))}</td>
        <td class="r nw">${esc(money(r.dotation))}</td>
        <td class="r nw">${esc(money(r.cumul))}</td>
        <td class="r nw">${esc(money(r.vnc))}</td>
        ${RowMenu.cellule('IM:' + r.id)}</tr>`).join('')}</tbody>
      <tfoot><tr><th colspan="3">${esc(pl(e.rows.length, 'bien'))}</th>
        <th class="r nw">${esc(money(e.valeur))}</th><th class="r nw">${esc(money(e.ouverture))}</th>
        <th class="r nw">${esc(money(e.dotation))}</th><th class="r nw">${esc(money(e.cumul))}</th>
        <th class="r nw">${esc(money(e.vnc))}</th><th></th></tr></tfoot></table></div>`}
    </div>
    ${immoState.ouverte ? panneauPlan(d, immoState.ouverte, y) : ''}
    <div class="panel mt"><h2>Ce que cet écran ne décide pas ${info('im.verifier')}</h2>
      <p class="small muted">${esc(KC.IMMO_A_VERIFIER.tauxDegressif)}</p>
      <p class="small muted">${esc(KC.IMMO_A_VERIFIER.bascule)}</p>
      <p class="small muted">${esc(KC.IMMO_A_VERIFIER.subvention)}</p>
      <p class="small muted">L'amortissement <b>dérogatoire</b> n'existe pas ici : le format du livre ne lui
      réserve rien, et personne ne l'a demandé. Le jour où un cabinet en a besoin, c'est une décision de
      format — pas une case à cocher qu'on aurait posée « au cas où ».</p>
    </div>`;
  }

  // Le plan d'un bien, année par année. C'est lui qui répond à « d'où sort cette dotation ? » —
  // un chiffre qu'on ne peut pas ouvrir se croit ou ne se croit pas (règle 9.6.0).
  function panneauPlan(d, id, annee) {
    const f = (d.fiches || []).find(x => x.id === id);
    if (!f) return '';
    const plan = KC.planDuBien(f);
    const ced = KC.resultatCession(f);
    return `<div class="panel mt" id="im-plan"><h2>${esc(f.libelle)} — le plan d'amortissement</h2>
      <p class="small muted">${esc(METHODE_LABEL[f.methode] || f.methode)}${
  f.methode === 'degressif' ? ` au taux de ${esc(String(f.tauxDegressif))} %${f.bascule ? ', avec bascule au linéaire' : ''}` : ''}
        · ${esc(f.duree)} ans · mise en service le ${esc(fmtJour(f.dateMiseEnService))}
        · compte ${esc(f.compte)} / amortissement ${esc(f.compteAmort)} / dotation ${esc(f.compteDotation)}</p>
      <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Exercice</th>
        <th class="r nw">Dotation</th><th class="r nw">Cumul</th><th class="r nw">VNC</th><th class="nw">Écriture</th></tr></thead>
      <tbody>${plan.map(p => `<tr class="${p.annee === annee ? 'dc-total' : ''}">
        <td class="nw">${esc(p.annee)}</td><td class="r nw">${esc(money(p.dotation))}</td>
        <td class="r nw">${esc(money(p.cumul))}</td><td class="r nw">${esc(money(p.vnc))}</td>
        <td class="nw">${p.ecritureId ? '<span class="badge b-paid">passée</span>' : '<span class="muted small">—</span>'}</td></tr>`).join('')}</tbody></table></div>
      ${ced ? `<div class="${ced.resultat >= 0 ? 'ok-box' : 'warn-box'} mt">
        ${esc(ced.motif === 'rebut' ? 'Mise au rebut' : 'Cession')} le ${esc(fmtJour(ced.date))} —
        prix ${esc(money(ced.prix))}, valeur comptable ${esc(money(ced.vnc))},
        <b>${esc(ced.resultat >= 0 ? 'plus-value' : 'moins-value')} de ${esc(money(Math.abs(ced.resultat)))}</b>.
        Le prix n'est jamais écrit d'office : il arrive par la facture de vente ou par le relevé bancaire.</div>` : ''}
      ${f.subvention ? `<p class="small muted mt">Subvention d'investissement de ${esc(money(f.subvention.montant))}
        (${esc(f.subvention.compte)} → ${esc(f.subvention.compteReprise)}), reprise au rythme de l'amortissement. À VÉRIFIER.</p>` : ''}</div>`;
  }

  function brancherImmobilisations(el, root, dossier) {
    const s = livresState;
    if (!s.immo) { chargerImmobilisations(root, dossier); return; }
    [$('#im-neuf', el), $('#im-neuf2', el)].forEach(b => { if (b) b.onclick = () => immoForm(root, dossier, null); });
    $$('[data-creer]', el).forEach(b => {
      b.onclick = () => {
        const l = (s.immo.aCreer || []).find(x => x.docId === b.dataset.creer);
        if (l) immoForm(root, dossier, { libelle: l.libelle, compte: l.compte, valeur: l.montant, dateAcquisition: l.date, dateMiseEnService: l.date, origine: { source: 'paquet', docId: l.docId, mois: String(l.date).slice(0, 7) } });
      };
    });
    bindRowMenus(el, cle => {
      const id = cle.slice(3);
      const f = (s.immo.fiches || []).find(x => x.id === id);
      if (!f) return [];
      return [
        { icon: 'loupe', label: 'Voir le plan d\'amortissement', hint: 'Année par année, et l\'écriture de chacune',
          run: () => { immoState.ouverte = immoState.ouverte === id ? '' : id; drawLivres(root, dossier); } },
        { icon: 'modifier', label: 'Modifier la fiche', hint: 'Valeur, durée, méthode, cession', run: () => immoForm(root, dossier, f) },
        { sep: true },
        { icon: 'supprimer', label: 'Supprimer ce bien', hint: 'Refusé si une dotation est déjà passée en écriture', danger: true,
          run: async () => {
            const ok = await confirmDialog(`Supprimer « ${f.libelle} » ?`,
              'Le bien disparaît du tableau d\'amortissement. Les écritures déjà passées, elles, restent : c\'est une fiche qu\'on retire, pas de la comptabilité.',
              'Supprimer', true);
            if (!ok) return;
            try {
              const r = await api.supprimerImmobilisation({ dossierId: dossier.id, annee: s.annee, id });
              s.livre = r.livre; toast('Bien supprimé.'); await chargerImmobilisations(root, dossier);
            } catch (err) { toast(plainError(err), 'error'); }
          } }
      ];
    });
    const ec = $('#im-ecrire', el);
    if (ec) ec.onclick = async () => {
      ec.disabled = true;
      try {
        const r = await api.ecrireDotations({ dossierId: dossier.id, annee: s.annee });
        s.livre = r.livre;
        toast(`${pl(r.ids.length, 'écriture passée', 'écritures passées')} en brouillard.`);
        await chargerImmobilisations(root, dossier);
      } catch (err) { toast(plainError(err), 'error'); ec.disabled = false; }
    };
    const cs = $('#im-csv', el);
    if (cs) cs.onclick = async () => {
      const cols = [
        { label: 'Bien', get: r => r.libelle }, { label: 'Mise en service', get: r => r.date },
        { label: 'Méthode', get: r => METHODE_LABEL[r.methode] || r.methode },
        { label: 'Valeur', get: r => r.valeur }, { label: 'Cumul au 01/01', get: r => r.ouverture },
        { label: 'Dotation', get: r => r.dotation }, { label: 'Cumul', get: r => r.cumul },
        { label: 'VNC', get: r => r.vnc }
      ];
      try {
        const r = await api.exportCsv(toCsv(cols, s.immo.etat.rows), `immobilisations-${s.annee}`);
        if (r && r.path) toast('Tableau exporté.');
      } catch (err) { toast(plainError(err), 'error'); }
    };
  }

  async function chargerImmobilisations(root, dossier) {
    const s = livresState;
    try { s.immo = await api.immobilisations({ dossierId: dossier.id, annee: s.annee }); }
    catch (e) { s.immo = null; toast(plainError(e), 'error'); }
    drawLivres(root, dossier);
  }

  function immoForm(root, dossier, fiche) {
    const s = livresState;
    const f = fiche || {};
    const neuf = !f.id;
    const comptes = (s.livre.plan || []).map(c => c.compte);
    const dl = (pref) => comptes.filter(c => String(c).startsWith(pref)).sort();
    const familles = KC.DEFAULT_ASSET_CLASSES;
    modal(`<h2>${neuf ? 'Ajouter un bien' : 'Modifier ' + esc(f.libelle)}</h2>
      <form id="im" class="grid-2">
        <label class="field obligatoire span-2"><span>Désignation</span>
          <input name="libelle" value="${esc(f.libelle || '')}" placeholder="Serveur Dell R450"></label>
        <label class="field"><span>Famille</span>
          <select name="famille"><option value="">—</option>${familles.map(c =>
    `<option value="${esc(c[0])}" data-duree="${c[2]}">${esc(c[1])} (${c[2]} ans)</option>`).join('')}</select></label>
        <label class="field obligatoire"><span>Durée (années)</span>
          <input name="duree" class="num" inputmode="numeric" value="${esc(String(f.duree || ''))}"></label>
        <label class="field obligatoire"><span>Date de mise en service</span>
          <input name="dateMiseEnService" placeholder="AAAA-MM-JJ" value="${esc(f.dateMiseEnService || '')}"></label>
        <label class="field"><span>Date d'acquisition</span>
          <input name="dateAcquisition" placeholder="AAAA-MM-JJ" value="${esc(f.dateAcquisition || '')}"></label>
        <label class="field obligatoire"><span>Valeur d'acquisition (HT)</span>
          <input name="valeur" class="num" inputmode="decimal" value="${esc(String(f.valeur || ''))}"></label>
        <label class="field"><span>Valeur résiduelle</span>
          <input name="residuelle" class="num" inputmode="decimal" value="${esc(String(f.residuelle || 0))}"></label>
        <label class="field"><span>Méthode</span>
          <select name="methode">${KC.IMMO_METHODES.map(m =>
    `<option value="${m}" ${(f.methode || 'lineaire') === m ? 'selected' : ''}>${esc(METHODE_LABEL[m])}</option>`).join('')}</select></label>
        <label class="field" id="im-taux-l"><span>Taux dégressif (%)</span>
          <input name="tauxDegressif" class="num" inputmode="decimal" value="${esc(f.tauxDegressif == null ? '' : String(f.tauxDegressif))}"></label>
        <label class="check span-2" id="im-bascule-l"><input type="checkbox" name="bascule" ${f.bascule ? 'checked' : ''}>
          Basculer au linéaire quand il devient plus favorable</label>
        <label class="field obligatoire"><span>Compte du bien</span>
          <input name="compte" value="${esc(f.compte || '22')}" list="im-c1"><datalist id="im-c1">${dl('2').map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field"><span>Compte d'amortissement</span>
          <input name="compteAmort" value="${esc(f.compteAmort || '28')}" list="im-c1"></label>
        <label class="field"><span>Compte de dotation</span>
          <input name="compteDotation" value="${esc(f.compteDotation || '681')}" list="im-c2"><datalist id="im-c2">${dl('6').map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field"><span>Subvention reçue (À VÉRIFIER)</span>
          <input name="subvention" class="num" inputmode="decimal" value="${esc(String((f.subvention && f.subvention.montant) || ''))}"></label>
        <label class="field"><span>Date de cession ou de rebut</span>
          <input name="cessionDate" placeholder="AAAA-MM-JJ" value="${esc((f.cession && f.cession.date) || '')}"></label>
        <label class="field"><span>Prix de cession (0 = rebut)</span>
          <input name="cessionPrix" class="num" inputmode="decimal" value="${esc(String((f.cession && f.cession.prix) || ''))}"></label>
      </form>
      <div id="im-apercu" class="small muted"></div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">${neuf ? 'Ajouter' : 'Enregistrer'}</button></div>`,
    (rootModal, close) => {
      const v = n => (($(`[name=${n}]`, rootModal) || {}).value || '').trim();
      const lire = () => {
        const cd = v('cessionDate');
        return {
          ...(f.id ? { id: f.id } : {}),
          libelle: v('libelle'),
          duree: Number(v('duree')) || 0,
          dateMiseEnService: v('dateMiseEnService'),
          dateAcquisition: v('dateAcquisition') || v('dateMiseEnService'),
          valeur: Number(String(v('valeur')).replace(',', '.')) || 0,
          residuelle: Number(String(v('residuelle')).replace(',', '.')) || 0,
          methode: v('methode'),
          tauxDegressif: v('tauxDegressif') === '' ? null : Number(String(v('tauxDegressif')).replace(',', '.')),
          bascule: !!($('[name=bascule]', rootModal) || {}).checked,
          compte: v('compte'), compteAmort: v('compteAmort'), compteDotation: v('compteDotation'),
          subvention: v('subvention') ? { montant: Number(String(v('subvention')).replace(',', '.')) || 0 } : null,
          cession: cd ? { date: cd, prix: Number(String(v('cessionPrix')).replace(',', '.')) || 0, motif: Number(v('cessionPrix')) ? 'cession' : 'rebut' } : null,
          origine: f.origine || { source: 'saisie', docId: '', mois: '' }
        };
      };
      // L'aperçu du plan PENDANT la saisie : on voit ce qu'on décide avant de l'enregistrer, comme
      // dans l'éditeur d'immobilisation de l'app entreprise (3.5.0).
      const apercu = $('#im-apercu', rootModal);
      const majTaux = () => {
        const deg = v('methode') === 'degressif';
        $('#im-taux-l', rootModal).style.display = deg ? '' : 'none';
        $('#im-bascule-l', rootModal).style.display = deg ? '' : 'none';
      };
      const maj = () => {
        majTaux();
        const p = lire();
        const val = KC.immoValide(p);
        if (!val.ok) { apercu.innerHTML = `<div class="warn-box mt">${esc(val.motifs[0])}</div>`; return; }
        const plan = KC.planDuBien(p);
        apercu.innerHTML = `<div class="ok-box mt">${esc(pl(plan.length, 'exercice'))} —
          première dotation ${esc(money(plan.length ? plan[0].dotation : 0))},
          dernière ${esc(money(plan.length ? plan[plan.length - 1].dotation : 0))},
          VNC finale ${esc(money(plan.length ? plan[plan.length - 1].vnc : 0))}.</div>`;
      };
      $$('input,select', rootModal).forEach(x => { x.oninput = maj; x.onchange = maj; });
      // La famille PROPOSE sa durée, elle ne l'impose pas : dès que la durée a été touchée, on n'y
      // revient plus (même motif que `regimeTouche`, 7.25.0).
      let dureeTouchee = !!f.duree;
      const dd = $('[name=duree]', rootModal); if (dd) dd.oninput = () => { dureeTouchee = true; maj(); };
      const fam = $('[name=famille]', rootModal);
      if (fam) fam.onchange = () => {
        const o = fam.selectedOptions[0];
        if (o && o.dataset.duree && !dureeTouchee) dd.value = o.dataset.duree;
        maj();
      };
      maj();
      $('#ok', rootModal).onclick = async () => {
        try {
          const r = await api.saveImmobilisation({ dossierId: dossier.id, annee: s.annee, fiche: lire() });
          s.livre = r.livre; close(); toast(neuf ? 'Bien ajouté.' : 'Fiche enregistrée.');
          await chargerImmobilisations(root, dossier);
        } catch (err) { toast(plainError(err), 'error'); }
      };
    });
  }

  // ---------------------------------------------------------------- l'inventaire de stock (9.7.0)
  //
  // Inventaire INTERMITTENT : on compte ce qui reste au dernier jour, la variation devient une
  // écriture. C'est ce que fait un cabinet pour un dossier sans logiciel de stock — et un dossier
  // SkanFact tient déjà le sien depuis la 4.0.0.

  function vueInventaire(dossier) {
    const s = livresState;
    const d = s.inv;
    if (!d) return `<div class="empty mini">Lecture de l'inventaire…</div>`;
    const inv = d.inventaire;
    const v = d.variation || {};
    return `<div class="filters">
      ${info('iv.etat')}
      <span class="small muted">Exercice ${esc(s.annee)}</span>
      <button class="btn btn-sm btn-primary" id="iv-saisir">${inv ? 'Reprendre l\'inventaire…' : 'Saisir l\'inventaire…'}</button>
      <button class="btn btn-sm" id="iv-ecrire" ${inv && v.ok && v.ecriture && !inv.ecritureId ? '' : 'disabled'}
        title="${!inv ? 'Saisis l\'inventaire d\'abord.'
    : inv.ecritureId ? 'Déjà passée : la repasser compterait le stock deux fois.'
      : !v.ecriture ? 'Le stock compté est exactement celui des comptes : rien à écrire.' : ''}">Écrire la variation de stock</button>
    </div>
    ${!inv
    ? `<div class="empty">Aucun inventaire saisi pour ${esc(s.annee)}.
        <p class="small muted">Un inventaire, c'est ce qui reste au dernier jour, compté et valorisé.
        La différence avec ce que portent les comptes devient une écriture (${esc(KC.COMPTES_IMMO.variationStocks)} / ${esc(KC.COMPTES_IMMO.stocks)}).</p>
        <button class="btn btn-primary" id="iv-saisir2">Saisir l'inventaire…</button></div>`
    : `<div class="panel mt"><h2>Ce qui a été compté au ${esc(fmtJour(inv.date))} ${info('iv.lignes')}</h2>
        <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Réf.</th><th>Désignation</th>
          <th class="r nw">Quantité</th><th class="r nw">Coût unitaire</th><th class="r nw">Valeur</th></tr></thead>
        <tbody>${inv.lignes.map(l => `<tr><td class="nw">${esc(l.ref)}</td>
          <td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td>
          <td class="r nw">${esc(String(l.quantite))}</td><td class="r nw">${esc(money(l.cout))}</td>
          <td class="r nw">${esc(money(l.valeur))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th colspan="4">${esc(pl(inv.lignes.length, 'ligne comptée', 'lignes comptées'))}</th>
          <th class="r nw">${esc(money(inv.total))}</th></tr></tfoot></table></div></div>
      <div class="panel mt"><h2>La variation ${info('iv.variation')}</h2>
        ${v.ok
    ? `<table class="list compact"><tbody>
            <tr><td>Stock aux comptes à l'ouverture</td><td class="r nw">${esc(money(v.initial))}</td></tr>
            <tr><td>Stock compté au ${esc(fmtJour(inv.date))}</td><td class="r nw">${esc(money(v.final))}</td></tr>
            <tr class="dc-total"><td><b>Variation</b></td><td class="r nw"><b>${esc(money(v.ecart))}</b></td></tr></tbody></table>
          ${v.ecart
    ? `<p class="small muted mt">Le stock ${v.ecart > 0 ? 'augmente' : 'diminue'} :
              on ${v.ecart > 0 ? 'débite' : 'crédite'} le stock et on ${v.ecart > 0 ? 'crédite' : 'débite'} la variation.
              L'écriture arrive en <b>brouillard</b>, au ${esc(fmtJour(inv.date))}.</p>`
    : `<div class="ok-box mt">${esc(v.motif || '')}</div>`}
          ${inv.ecritureId ? '<div class="ok-box mt">L\'écriture de variation est passée.</div>' : ''}`
    : `<div class="warn-box">${esc(v.motif || '')}</div>`}
      </div>`}`;
  }

  function brancherInventaire(el, root, dossier) {
    const s = livresState;
    if (!s.inv) { chargerInventaire(root, dossier); return; }
    [$('#iv-saisir', el), $('#iv-saisir2', el)].forEach(b => { if (b) b.onclick = () => inventaireForm(root, dossier); });
    const ec = $('#iv-ecrire', el);
    if (ec) ec.onclick = async () => {
      ec.disabled = true;
      try {
        const r = await api.ecrireVariationStock({ dossierId: dossier.id, annee: s.annee });
        s.livre = r.livre; toast('Variation de stock passée en brouillard.');
        await chargerInventaire(root, dossier);
      } catch (err) { toast(plainError(err), 'error'); ec.disabled = false; }
    };
  }

  async function chargerInventaire(root, dossier) {
    const s = livresState;
    try { s.inv = await api.inventaire({ dossierId: dossier.id, annee: s.annee }); }
    catch (e) { s.inv = null; toast(plainError(e), 'error'); }
    drawLivres(root, dossier);
  }

  function inventaireForm(root, dossier) {
    const s = livresState;
    const dejaLa = (s.inv && s.inv.inventaire) || null;
    // On saisit en COLLANT une liste depuis un tableur : ligne par ligne dans un formulaire,
    // personne ne compterait deux cents références (même règle que les dossiers collés, 6.8.0).
    const depart = dejaLa
      ? dejaLa.lignes.map(l => [l.ref, l.libelle, l.quantite, l.cout].join('\t')).join('\n')
      : '';
    modal(`<h2>L'inventaire de ${esc(s.annee)}</h2>
      <p class="small muted">Une ligne par référence : <b>référence, désignation, quantité, coût unitaire</b>,
      séparées par une tabulation ou un point-virgule. Colle-les depuis ton tableur.</p>
      <form id="iv" class="grid-2">
        <label class="field obligatoire"><span>Date de l'inventaire</span>
          <input name="date" placeholder="AAAA-MM-JJ" value="${esc((dejaLa && dejaLa.date) || (s.livre.exercice.au || ''))}"></label>
        <label class="field"><span>Compte de stock</span>
          <input name="compte" value="${esc((dejaLa && dejaLa.compte) || KC.COMPTES_IMMO.stocks)}"></label>
      </form>
      <label class="field"><span>Les lignes comptées</span>
        <textarea id="iv-lignes" rows="10" placeholder="REF-01&#9;Câble HDMI 2 m&#9;24&#9;7.500">${esc(depart)}</textarea></label>
      <div id="iv-apercu" class="small muted"></div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">Enregistrer l'inventaire</button></div>`,
    (rootModal, close) => {
      const apercu = $('#iv-apercu', rootModal);
      const lire = () => {
        const lignes = ($('#iv-lignes', rootModal).value || '').split('\n')
          .map(l => l.trim()).filter(Boolean)
          .map(l => {
            const p = l.split(/\t|;/).map(x => x.trim());
            // Quatre colonnes attendues ; avec trois, la référence manque et c'est le cas le plus
            // courant d'un tableur qui n'en tient pas.
            const [a, b, c, d] = p.length >= 4 ? p : ['', p[0], p[1], p[2]];
            return { ref: a || '', libelle: b || '', quantite: Number(String(c || '').replace(',', '.')) || 0, cout: Number(String(d || '').replace(',', '.')) || 0 };
          });
        return {
          date: (($('[name=date]', rootModal) || {}).value || '').trim(),
          compte: (($('[name=compte]', rootModal) || {}).value || '').trim(),
          lignes
        };
      };
      const maj = () => {
        const inv = lire();
        const v = KC.inventaireValide(inv);
        apercu.innerHTML = v.ok
          ? `<div class="ok-box mt">${esc(pl(inv.lignes.length, 'ligne'))} — total ${esc(money(KC.totalInventaire(inv)))}.</div>`
          : `<div class="warn-box mt">${esc(v.motifs[0])}</div>`;
      };
      $$('input,textarea', rootModal).forEach(x => { x.oninput = maj; });
      maj();
      $('#ok', rootModal).onclick = async () => {
        try {
          const r = await api.saveInventaire({ dossierId: dossier.id, annee: s.annee, inventaire: lire() });
          s.livre = r.livre; close(); toast('Inventaire enregistré.');
          await chargerInventaire(root, dossier);
        } catch (err) { toast(plainError(err), 'error'); }
      };
    });
  }

  // ---------------------------------------------------------------- la banque (9.5.0)
  //
  // Le rapprochement, et lui seul : le lettrage vit dans l'onglet d'à côté, avec son propre modèle
  // et ses propres tests. Confondre les deux est l'erreur de vocabulaire la plus courante de ce
  // métier, et un écran qui les mélange la rend définitive.
  const banqueState = { releve: '', filtre: '', ouvert: '' };

  const NIVEAU_LABEL = { certain: 'Rapproché', probable: 'Probable', 'a-confirmer': 'À confirmer', aucun: 'Sans réponse' };
  // Aucune couleur d'alarme sur « sans réponse » : c'est l'état de DÉPART de toute ligne d'un relevé
  // qu'on vient d'importer, pas une faute. Du rouge sur une situation normale apprend à ignorer le
  // rouge, et emmène avec lui celui qui comptait (8.0.1).
  const NIVEAU_CLASSE = { certain: 'b-paid', probable: 'b-part', 'a-confirmer': 'b-due', aucun: '' };

  function vueBanque(dossier) {
    const s = livresState;
    const releves = (s.livre.releves || []).slice().sort((a, b) => (b.du || '').localeCompare(a.du || ''));
    if (!releves.length) {
      // L'état vide qui EST le corps de son écran garde sa présence, et porte son geste (9.4.7).
      return `<div class="empty">Aucun relevé bancaire importé pour ${esc(s.annee)}.
        <div class="small mt">Un relevé se lit tel que la banque l'exporte : on associe ses colonnes par leur NOM,
        une fois par banque. Ensuite le rapprochement propose, et c'est toi qui tranches.</div>
        <div class="mt"><button class="btn btn-primary" id="bq-import">Importer un relevé…</button></div></div>`;
    }
    const R = releves.find(r => r.id === banqueState.releve) || releves[0];
    banqueState.releve = R.id;
    const parNiveau = { certain: 0, probable: 0, 'a-confirmer': 0, aucun: 0 };
    R.lignes.forEach(l => { parNiveau[(l.rapprochement || {}).niveau || 'aucun']++; });
    const sus = KC.suspens(s.livre, R.id);
    const f = banqueState.filtre;
    const vues = R.lignes.filter(l => !f || ((l.rapprochement || {}).niveau || 'aucun') === f);
    return `<div class="filters">
      <label class="f-lab">Relevé<select id="bq-releve" aria-label="Le relevé à rapprocher">${releves.map(r =>
        `<option value="${esc(r.id)}" ${r.id === R.id ? 'selected' : ''}>${esc(r.compte)} · ${esc(fmtJour(r.du))} → ${esc(fmtJour(r.au))}${r.banque ? ' · ' + esc(r.banque) : ''}</option>`).join('')}</select></label>
      <label class="f-lab">Montrer<select id="bq-filtre" aria-label="Filtrer par état de rapprochement">
        <option value="">Toutes les lignes</option>
        ${Object.keys(NIVEAU_LABEL).map(k => `<option value="${k}" ${f === k ? 'selected' : ''}>${NIVEAU_LABEL[k]} (${parNiveau[k]})</option>`).join('')}</select></label>
      ${info('bq.niveaux')}
      <button class="btn btn-sm" id="bq-auto">Rapprocher automatiquement</button>
      <button class="btn btn-sm btn-ghost" id="bq-import">Importer un relevé…</button>
      ${RowMenu.bouton('REL:' + R.id, 'Ce relevé', 'btn btn-sm btn-ghost')}
    </div>
    <div class="stats">
      <div class="stat"><div class="lbl">Rapproché</div><div class="val ok">${parNiveau.certain}</div><div class="sub">sur ${pl(R.lignes.length, 'ligne')}</div></div>
      <div class="stat"><div class="lbl">À trancher</div><div class="val ${parNiveau.probable + parNiveau['a-confirmer'] ? 'due' : ''}">${parNiveau.probable + parNiveau['a-confirmer']}</div><div class="sub">probables et ambiguïtés</div></div>
      <div class="stat"><div class="lbl">Sans réponse</div><div class="val ${parNiveau.aucun ? 'due' : ''}">${parNiveau.aucun}</div><div class="sub">rien dans le livre en face</div></div>
      ${/* L'écart du rapprochement classique : le solde de fin du relevé moins le solde comptable
            du compte à la même date (T-06). Il PEUT tomber à zéro, et c'est ce qui en fait un
            indicateur. Ce que les suspens n'expliquent pas vient d'avant le premier relevé, et on
            le nomme plutôt que de le laisser fondu dans le chiffre. */''}
      <div class="stat"><div class="lbl">Écart de rapprochement</div><div class="val ${sus.ecart ? 'due' : 'ok'}">${esc(money(sus.ecart))}</div>
        <div class="sub">relevé ${esc(money(sus.soldeFin))} − livre ${esc(money(sus.soldeComptable))} au ${esc(fmtJour(R.au))}${
          sus.avant ? ` · dont ${esc(money(sus.avant))} d'avant les relevés` : ''}</div></div>
    </div>
    <div class="panel mt"><h2>Le relevé ${info('bq.releve')}</h2>
      <div class="scroll-x"><table class="list compact"><thead><tr>
        <th class="nw">Date</th><th>Libellé</th><th class="nw">Référence</th><th class="r nw">Montant</th><th class="nw">État</th><th class="nw">En face</th><th></th>
      </tr></thead><tbody>
      ${vues.map(l => {
        const r = l.rapprochement || { niveau: 'aucun' };
        const e = r.ecritureId ? (s.livre.ecritures || []).find(x => x.id === r.ecritureId) : null;
        // « En face » montre la LIGNE appariée, avec son montant (T-12) : le moteur rapproche ligne
        // à ligne, et deux lignes de relevé sur deux lignes d'une même pièce de paie affichaient le
        // même texte — trait pour trait la faute que le moteur interdit. Un contrôle qu'on ne peut
        // pas faire finit par ne plus se faire.
        const lg = e && Array.isArray(e.lignes) ? e.lignes[Number(r.ligne)] : null;
        const mFace = lg ? KC.round3((Number(lg.debit) || 0) - (Number(lg.credit) || 0)) : null;
        return `<tr data-lig="${esc(l.id)}">
          <td class="nw">${esc(fmtJour(l.date))}</td>
          <td class="tronq lg" title="${esc(l.libelle)}">${esc(l.libelle)}</td>
          <td class="nw">${esc(l.reference)}</td>
          <td class="r nw">${esc(money(l.montant))}</td>
          <td class="nw"><span class="badge ${NIVEAU_CLASSE[r.niveau] || ''}">${esc(NIVEAU_LABEL[r.niveau] || r.niveau)}</span>${
            r.par === 'auto' ? ' <span class="muted small">auto</span>' : ''}</td>
          <td class="tronq" title="${e ? esc((e.journal || '') + ' ' + (e.piece || '') + ' — ' + (e.libelle || '') + (lg ? ` — ligne ${Number(r.ligne) + 1} (${lg.compte || ''})` : '')) : ''}">${
            e ? `${esc((e.journal || '') + ' ' + (e.piece || ''))}${mFace != null ? ` <span class="muted nw">· ${esc(money(mFace))}</span>` : ''}` : ''}</td>
          ${RowMenu.cellule('LIG:' + l.id)}</tr>`;
      }).join('')}
      </tbody></table></div>
      ${vues.length ? '' : '<div class="empty mini">Aucune ligne dans cet état.</div>'}
    </div>
    <div class="panel mt"><h2>Les suspens ${info('bq.suspens')}</h2>
      <p class="small muted">Ce que la banque porte et que le livre n'a pas, et l'inverse. Un chèque émis qui n'est
      pas encore encaissé vit ici : ce n'est pas une erreur, c'est ce qui explique l'écart.</p>
      <div class="split">
        <div><h3 class="sub-h">Côté banque · ${pl(sus.banque.length, 'ligne')}</h3>
          ${sus.banque.length ? `<table class="list compact"><tbody>${sus.banque.map(l =>
            `<tr><td class="nw">${esc(fmtJour(l.date))}</td><td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td><td class="r nw">${esc(money(l.montant))}</td></tr>`).join('')}</tbody></table>`
            : '<div class="empty mini">Rien : tout ce que la banque porte est dans le livre.</div>'}</div>
        <div><h3 class="sub-h">Côté livre · ${pl(sus.livre.length, 'ligne')}</h3>
          ${sus.livre.length ? `<table class="list compact"><tbody>${sus.livre.map(l =>
            `<tr><td class="nw">${esc(fmtJour(l.date))}</td><td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td><td class="r nw">${esc(money(l.montant))}</td></tr>`).join('')}</tbody></table>`
            : '<div class="empty mini">Rien : tout ce que le livre porte est sur le relevé.</div>'}</div>
      </div>
    </div>`;
  }

  function brancherBanque(el, root, dossier) {
    const s = livresState;
    const releves = s.livre.releves || [];
    const R = releves.find(r => r.id === banqueState.releve);
    $$('#bq-import', el).forEach(b => { b.onclick = () => releveForm(root, dossier); });
    const sel = $('#bq-releve', el);
    if (sel) sel.onchange = () => { banqueState.releve = sel.value; drawLivres(root, dossier); };
    const fil = $('#bq-filtre', el);
    if (fil) fil.onchange = () => { banqueState.filtre = fil.value; drawLivres(root, dossier); };
    const auto = $('#bq-auto', el);
    if (auto && R) auto.onclick = async () => {
      auto.disabled = true;
      try {
        const jours = ((dossier.banque || {}).jours != null) ? dossier.banque.jours : KC.RELEVE_JOURS;
        const r = await api.rapprocherAuto({ dossierId: dossier.id, annee: s.annee, releveId: R.id, jours });
        s.livre = r.livre;
        // On DIT ce qui a été posé et ce qui ne l'a pas été. « 12 lignes traitées » laisserait
        // croire que tout est réglé alors que la moitié attend une décision.
        // Et le cas « rien à faire » a SA phrase (T-07) : trois zéros se lisent comme un échec,
        // alors que « tout est déjà rapproché » est la meilleure nouvelle possible. Deux riens qui
        // ne sont pas la même nouvelle : tout rapproché, ou rien qui corresponde.
        const c = r.compte;
        // Le relevé se RELIT dans le livre rendu : `R` est la poignée d'avant le geste (7.17.0).
        const apres = ((r.livre && r.livre.releves) || []).find(x => x.id === R.id) || R;
        const total = apres.lignes.length;
        const dejaFait = apres.lignes.filter(l => l.rapprochement && l.rapprochement.ecritureId).length;
        const rien = !c.certain && !c.probable && !c['a-confirmer'];
        toast(rien && dejaFait === total && total
          ? `Tout est déjà rapproché : ${pl(total, 'ligne')} sur ${total}.`
          : rien
            ? `Rien à rapprocher d'office : ${pl(c.aucun, 'ligne')} sans réponse, aucune écriture au même montant dans le livre.`
            : `${pl(c.certain, 'ligne rapprochée', 'lignes rapprochées')} d'office ; ${c.probable + c['a-confirmer']} à trancher, ${c.aucun} sans réponse.`);
        drawLivres(root, dossier);
      } catch (e) { toast(plainError(e), 'error'); auto.disabled = false; }
    };
    // UNE seule table d'actions par racine : `bindRowMenus` écrase la précédente en silence (9.4.8).
    bindRowMenus(el, cle => {
      if (cle.startsWith('REL:')) {
        const rel = releves.find(x => x.id === cle.slice(4));
        if (!rel) return [];
        // Deux actions, donc un vrai menu : sans la première, `rowmenu.js` transformerait le
        // bouton en « Retirer ce relevé » nommé et visible (règle 7.29.0), c'est-à-dire un geste
        // destructeur au premier plan, à côté du bouton d'import. Ce qui se détruit demande ; ce
        // qui se répare se propose.
        return [
          { icon: 'non', label: 'Défaire tous les rapprochements', hint: 'Après un automatique qui s\'est trompé de compte : trente lignes se défont d\'un coup', run: async () => {
            try {
              const x = await api.derapprocher({ dossierId: dossier.id, annee: s.annee, releveId: rel.id });
              s.livre = x.livre;
              toast(x.defaits ? `${pl(x.defaits, 'rapprochement défait', 'rapprochements défaits')}.` : 'Aucun rapprochement à défaire.');
              drawLivres(root, dossier);
            } catch (e) { toast(plainError(e), 'error'); }
          } },
          { icon: 'supprimer', label: 'Retirer ce relevé', hint: 'Le fichier sort du livre ; les écritures qu\'il a servi à créer RESTENT', run: () => retirerReleve(root, dossier, rel) }
        ];
      }
      const l = R && R.lignes.find(x => x.id === cle.slice(4));
      if (!l) return [];
      const r = l.rapprochement || { niveau: 'aucun' };
      const actions = [];
      if (r.ecritureId) {
        const e = (s.livre.ecritures || []).find(x => x.id === r.ecritureId);
        if (e) actions.push({ icon: 'loupe', label: 'Voir l\'écriture en face', hint: `${e.journal || ''} ${e.piece || ''} — toutes ses lignes`, run: () => ecritureDialog(e, Number(r.ligne)) });
        actions.push({ icon: 'non', label: 'Défaire le rapprochement', hint: 'Même « rapproché » se défait : l\'automatique propose, c\'est toi qui décides', run: async () => {
          try { const x = await api.rapprocher({ dossierId: dossier.id, annee: s.annee, releveId: R.id, ligneId: l.id, choix: {} }); s.livre = x.livre; drawLivres(root, dossier); }
          catch (e) { toast(plainError(e), 'error'); }
        } });
      } else {
        actions.push({ icon: 'loupe', label: 'Choisir l\'écriture en face', hint: 'Toutes les écritures du compte, la bonne se pointe à la main', run: () => choisirEcritureForm(root, dossier, R, l) });
        actions.push({ icon: 'nouveau', label: 'Écrire l\'écriture manquante', hint: 'Un brouillon prérempli — rien n\'est enregistré tant que tu n\'as pas cliqué', run: () => ecrireDepuisBanque(root, dossier, R, l) });
      }
      return actions;
    });
  }

  // Une écriture, lue en entier, sans rien pouvoir y changer : c'est ce qu'un contrôle demande.
  // La ligne appariée est marquée, pour qu'on voie d'un coup d'œil laquelle répond au relevé.
  function ecritureDialog(e, ligneMarquee) {
    modal(`<h2>${esc(e.journal || '')} ${esc(e.piece || '(sans pièce)')}${e.numero ? ` <span class="muted small">n° ${esc(String(e.numero))}</span>` : ''}</h2>
      <p class="small muted">${esc(fmtJour(e.date))} · ${esc(e.libelle || '')}${e.statut === 'brouillard' ? ' · <b>brouillard</b>' : ''}</p>
      <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Compte</th><th>Libellé</th><th class="r nw">Débit</th><th class="r nw">Crédit</th></tr></thead>
      <tbody>${(e.lignes || []).map((l, i) => `<tr class="${i === ligneMarquee ? 'br-ligne' : ''}"><td class="nw">${esc(l.compte || '')}${i === ligneMarquee ? ' <span class="badge">en face</span>' : ''}</td>
        <td class="tronq" title="${esc(l.libelle || '')}">${esc(l.libelle || '')}</td>
        <td class="r nw">${Number(l.debit) ? esc(money(l.debit)) : ''}</td><td class="r nw">${Number(l.credit) ? esc(money(l.credit)) : ''}</td></tr>`).join('')}</tbody></table></div>
      <div class="modal-actions"><button class="btn" data-close>Fermer</button></div>`);
  }

  async function retirerReleve(root, dossier, rel) {
    const ok = await confirmDialog(`Retirer le relevé de ${fmtJour(rel.du)} → ${fmtJour(rel.au)} ?`,
      `Ses ${rel.lignes.length} lignes sortent du livre, et les rapprochements avec. Les écritures que tu as créées depuis ce relevé, elles, RESTENT : elles ont été décidées par un clic, et effacer un fichier ne défait pas une décision.`,
      'Retirer');
    if (!ok) return;
    try {
      const r = await api.supprimerReleve({ dossierId: dossier.id, annee: livresState.annee, id: rel.id });
      livresState.livre = r.livre; banqueState.releve = '';
      toast(r.ecrituresGardees ? `Relevé retiré. ${pl(r.ecrituresGardees, 'écriture gardée', 'écritures gardées')}.` : 'Relevé retiré.');
      drawLivres(root, dossier);
    } catch (e) { toast(plainError(e), 'error'); }
  }

  // Choisir l'écriture en face, à la main. On montre TOUS les candidats du bon montant d'abord, puis
  // le reste du compte : une ambiguïté se tranche en voyant les deux, pas en cherchant.
  function choisirEcritureForm(root, dossier, R, ligne) {
    const s = livresState;
    const toutes = KC.lignesBancaires(s.livre, R.compte);
    const prises = new Set();
    (s.livre.releves || []).forEach(x => x.lignes.forEach(l => {
      if (l.rapprochement && l.rapprochement.ecritureId && l.id !== ligne.id) prises.add(l.rapprochement.ecritureId + '#' + l.rapprochement.ligne);
    }));
    const libres = toutes.filter(c => !prises.has(c.ecritureId + '#' + c.ligne));
    const memeMontant = libres.filter(c => KC.round3(c.montant - ligne.montant) === 0);
    const autres = libres.filter(c => KC.round3(c.montant - ligne.montant) !== 0);
    const ligneHtml = c => `<tr><td class="nw">${esc(fmtJour(c.date))}</td><td class="tronq" title="${esc(c.libelle)}">${esc(c.libelle)}</td>
      <td class="nw">${esc(c.piece)}</td><td class="r nw">${esc(money(c.montant))}</td>
      <td class="actions"><button type="button" class="btn btn-sm" data-pick="${esc(c.ecritureId)}|${c.ligne}">Rapprocher</button></td></tr>`;
    modal(`<h2>Rapprocher ${esc(fmtJour(ligne.date))} · ${esc(money(ligne.montant))}</h2>
      <p class="small muted">${esc(ligne.libelle)}</p>
      <h3 class="sub-h">Du même montant · ${pl(memeMontant.length, 'écriture')}</h3>
      ${memeMontant.length ? `<div class="scroll-x"><table class="list compact"><tbody>${memeMontant.map(ligneHtml).join('')}</tbody></table></div>`
        : '<div class="empty mini">Aucune écriture du compte ' + esc(R.compte) + ' ne porte ce montant.</div>'}
      ${autres.length ? `<h3 class="sub-h">Les autres écritures du compte · ${pl(autres.length, 'écriture')}</h3>
        <div class="scroll-x" style="max-height:230px"><table class="list compact"><tbody>${autres.slice(0, 60).map(ligneHtml).join('')}</tbody></table></div>` : ''}
      <div class="modal-actions"><button class="btn" data-close>Annuler</button></div>`,
      (rootModal, close) => {
        $$('[data-pick]', rootModal).forEach(b => { b.onclick = async () => {
          const [ecritureId, i] = b.dataset.pick.split('|');
          try {
            const x = await api.rapprocher({ dossierId: dossier.id, annee: s.annee, releveId: R.id, ligneId: ligne.id, choix: { ecritureId, ligne: Number(i), niveau: 'certain', date: K.today() } });
            s.livre = x.livre; close(); drawLivres(root, dossier);
          } catch (e) { toast(plainError(e), 'error'); }
        }; });
      });
  }

  // L'écriture proposée depuis une ligne non rapprochée. Elle arrive PRÉREMPLIE et jamais
  // enregistrée : la banque ne fait pas foi contre la pièce. Quand aucune règle ne reconnaît le
  // libellé, la contrepartie reste VIDE — verser d'office au 471 rangerait le doute dans un compte
  // que personne ne solde, et la question disparaîtrait sans avoir été posée.
  function ecrireDepuisBanque(root, dossier, R, ligne) {
    const s = livresState;
    const table = Array.isArray(S.libelles) ? S.libelles : [];
    const brouillon = KC.ecritureProposee(ligne, table, { compte: R.compte, journal: 'BQ' });
    const contre = brouillon.lignes[1];
    modal(`<h2>Écrire ${esc(fmtJour(ligne.date))} · ${esc(money(ligne.montant))}</h2>
      <p class="small muted">${esc(ligne.libelle)}</p>
      ${brouillon.regle
        ? `<div class="ok-box mb">Le libellé contient « ${esc(brouillon.regle)} » : le compte ${esc(contre.compte)} est proposé.</div>`
        : `<div class="info-box mb">Aucune règle ne reconnaît ce libellé. Choisis le compte : il sera retenu, et le prochain relevé le proposera tout seul.</div>`}
      <form id="bf" class="grid-2">
        <label class="field">Journal<input name="journal" value="${esc(brouillon.journal)}"></label>
        <label class="field">Date<input type="date" name="date" value="${esc(brouillon.date)}"></label>
        <label class="field span-2">Libellé<input name="libelle" value="${esc(brouillon.libelle)}"></label>
        <label class="field">Compte ${esc(R.compte)}<input value="${esc(money(ligne.montant))}" disabled></label>
        <label class="field obligatoire"><span>Contrepartie</span><input name="compte" value="${esc(contre.compte)}" placeholder="606"></label>
        <label class="check span-2"><input type="checkbox" name="retenir" ${brouillon.regle ? '' : 'checked'}> Retenir ce libellé pour la prochaine fois</label>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">Créer le brouillard</button></div>`,
      (rootModal, close) => {
        $('#ok', rootModal).onclick = async () => {
          const v = n => (($(`[name=${n}]`, rootModal) || {}).value || '').trim();
          const compte = v('compte');
          if (!compte) return refus($('[name=compte]', rootModal), 'Choisis le compte de contrepartie : sans lui, l\'écriture ne s\'enregistre pas.');
          const ec = {
            ...brouillon, journal: v('journal') || 'BQ', date: v('date'), libelle: v('libelle'),
            lignes: [{ ...brouillon.lignes[0], libelle: v('libelle') }, { ...contre, compte, libelle: v('libelle') }]
          };
          delete ec.aChoisir; delete ec.regle;
          try {
            const r = await api.saisir(dossier.id, s.annee, ec);
            s.livre = r.livre;
            // Le mot RETENU est le plus long du libellé : « PRELEVEMENT STEG 03/2026 » ne se
            // reverra jamais tel quel, mais « PRELEVEMENT » si — et il ne veut rien dire tout seul.
            if ($('[name=retenir]', rootModal).checked) {
              const mot = (String(ligne.libelle || '').split(/[^A-Za-zÀ-ÿ]+/).filter(m => m.length >= 4)
                .sort((a, b) => b.length - a.length)[0] || '').toUpperCase();
              if (mot) {
                const table2 = (Array.isArray(S.libelles) ? S.libelles : []).filter(x => x.motif !== mot).concat([{ motif: mot, compte }]);
                S = await api.saveBanque({ libelles: table2 });
              }
            }
            // L'écriture créée rapproche la ligne du même geste : la laisser « sans réponse » après
            // l'avoir écrite ferait recommencer le travail au relevé suivant.
            const idx = (r.livre.ecritures || []).find(x => x.id === r.id);
            if (idx) {
              const x = await api.rapprocher({ dossierId: dossier.id, annee: s.annee, releveId: R.id, ligneId: ligne.id, choix: { ecritureId: r.id, ligne: 0, niveau: 'certain', date: K.today() } });
              s.livre = x.livre;
            }
            close(); toast('Brouillard créé et rapproché.'); drawLivres(root, dossier);
          } catch (e) { toast(plainError(e), 'error'); }
        };
      });
  }

  // L'import d'un relevé, en DEUX temps. On lit le fichier, on montre ce qu'on a compris, et on
  // demande ce que le fichier ne dit pas : le compte bancaire, et les deux soldes du relevé papier.
  // C'est ce contrôle-là qui refuse un fichier auquel il manque des lignes (ERR-CAB-040).
  function releveForm(root, dossier) {
    const s = livresState;
    const banques = (S.banques && typeof S.banques === 'object') ? S.banques : {};
    const comptes = (s.livre.plan || []).map(c => c.compte).filter(c => /^5/.test(c)).sort();
    const defaut = (dossier.banque || {}).compte || comptes[0] || '532';
    let lu = null;
    modal(`<h2>Importer un relevé bancaire</h2>
      <p class="small muted">Le fichier tel que la banque l'exporte. Les colonnes s'associent par leur NOM ;
      si cette banque est nouvelle, tu les associes une fois et je les retiens.</p>
      <form id="rv" class="grid-2">
        <label class="field obligatoire"><span>Compte bancaire</span>
          <input name="compte" value="${esc(defaut)}" list="rv-comptes" placeholder="532">
          <datalist id="rv-comptes">${comptes.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field">Banque<input name="banque" value="${esc((dossier.banque || {}).banque || '')}" list="rv-banques" placeholder="Le nom, pour retenir ses colonnes">
          <datalist id="rv-banques">${Object.keys(banques).map(b => `<option value="${esc(b)}">`).join('')}</datalist></label>
        <label class="field">Solde au début<input name="debut" class="num" inputmode="decimal" value="0">
          <span class="small muted" id="rv-debut-hint"></span></label>
        <label class="field">Solde à la fin<input name="fin" class="num" inputmode="decimal" value="0"></label>
      </form>
      <div class="modal-actions" style="justify-content:flex-start">
        <button type="button" class="btn btn-sm" id="rv-fichier">Choisir le fichier…</button>
        <span id="rv-etat" class="small muted">Aucun fichier choisi.</span>
      </div>
      <div id="rv-apercu"></div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok" disabled>Importer</button></div>`,
      (rootModal, close) => {
        const etat = $('#rv-etat', rootModal), apercu = $('#rv-apercu', rootModal), ok = $('#ok', rootModal);
        const v = n => (($(`[name=${n}]`, rootModal) || {}).value || '').trim();
        // Le solde de DÉPART se propose depuis le livre (T-04) : le solde du compte choisi, la
        // veille de la première ligne du relevé. Un relevé ne commence quasiment jamais à zéro, et
        // « 0 » passait le bouclage tout en rendant l'écart de rapprochement faux. La proposition
        // est NOMMÉE (« d'après le livre ») et cède la place à ce qu'on tape.
        const champDebut = $('[name=debut]', rootModal), hint = $('#rv-debut-hint', rootModal);
        let debutTouche = false;
        if (champDebut) champDebut.addEventListener('input', () => { debutTouche = true; });
        const proposerDebut = lignes => {
          if (!champDebut || debutTouche || !lignes.length) return;
          const compte = v('compte'), premiere = lignes.map(l => l.date).filter(Boolean).sort()[0];
          if (!compte || !premiere) return;
          const avant = KC.lignesBancaires(s.livre, compte).filter(c => c.date < premiere);
          const solde = KC.round3(avant.reduce((a, c) => a + c.montant, 0));
          champDebut.value = solde.toFixed(3);
          if (hint) hint.textContent = `d'après le livre : ${money(solde)} au ${fmtJour(premiere)} (veille de la première ligne)`;
        };
        const montrer = () => {
          if (!lu) return;
          const lignes = lu.lignes || [];
          proposerDebut(lignes);
          const somme = KC.round3(lignes.reduce((a, l) => a + l.montant, 0));
          // Le doublon se dit DÈS que le fichier est choisi (T-08) : l'empreinte est connue à la
          // lecture, c'est-à-dire au moment exact où l'app écrivait un bandeau vert. Un vert dans la
          // fenêtre et un refus rouge en bas de l'écran, c'est deux messages contradictoires, et
          // le rassurant est celui où l'œil est posé. Le bandeau devient orange, nomme la date du
          // premier import, et le bouton s'éteint en disant pourquoi (9.4.5).
          const deja = KC.releveDejaImporte(s.livre, lu.empreinte);
          apercu.innerHTML = `${lu.motif ? `<div class="warn-box mb">${esc(lu.motif)}</div>` : ''}
            ${deja ? `<div class="warn-box mb" id="rv-deja"><b>Ce fichier a déjà été importé</b> le ${esc(fmtJour(String(deja.importeLe || '').slice(0, 10)))} (${esc(fmtJour(deja.du))} → ${esc(fmtJour(deja.au))}).
              L'importer une seconde fois doublerait chacun de ses mouvements : les soldes n'ont pas besoin d'être saisis.</div>`
            : lignes.length ? `<div class="ok-box mb">${pl(lignes.length, 'ligne lue', 'lignes lues')} · mouvements ${esc(money(somme))}${
              lu.ignorees.length ? ` · ${pl(lu.ignorees.length, 'ligne ignorée', 'lignes ignorées')}` : ''}</div>` : ''}
            ${lu.ignorees && lu.ignorees.length ? `<div class="small muted">${lu.ignorees.slice(0, 5).map(i => `Ligne ${i.ligne} : ${esc(i.motif)}`).join(' · ')}</div>` : ''}
            ${lignes.length ? `<div class="scroll-x" style="max-height:200px"><table class="list compact"><thead><tr><th class="nw">Date</th><th>Libellé</th><th class="r nw">Montant</th></tr></thead>
              <tbody>${lignes.slice(0, 12).map(l => `<tr><td class="nw">${esc(fmtJour(l.date))}</td><td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td><td class="r nw">${esc(money(l.montant))}</td></tr>`).join('')}</tbody></table></div>` : ''}
            ${lu.motif && lu.entetes ? `<h3 class="sub-h">Associer les colonnes</h3>
              <div class="grid-2">${['date', 'libelle', 'montant', 'debit', 'credit', 'reference'].map(champ =>
                `<label class="field">${champ === 'libelle' ? 'Libellé' : champ[0].toUpperCase() + champ.slice(1)}
                  <select data-col="${champ}"><option value="">—</option>${lu.entetes.map((e, i) => `<option value="${i}">${esc(e || ('Colonne ' + (i + 1)))}</option>`).join('')}</select></label>`).join('')}</div>
              <div class="modal-actions" style="justify-content:flex-start"><button type="button" class="btn btn-sm" id="rv-relire">Relire avec cette association</button></div>` : ''}`;
          ok.disabled = !lignes.length || !!deja;
          ok.title = deja ? 'Ce fichier est déjà dans le livre.' : '';
          const relire = $('#rv-relire', rootModal);
          if (relire) relire.onclick = async () => {
            const assoc = {};
            $$('[data-col]', rootModal).forEach(sel2 => { if (sel2.value !== '') assoc[sel2.dataset.col] = Number(sel2.value); });
            lu = { ...await api.lireReleve({ chemin: lu.fichier, assoc }), assoc };
            montrer();
          };
        };
        $('#rv-fichier', rootModal).onclick = async () => {
          try {
            const banque = v('banque');
            const r = await api.lireReleve({ assoc: banques[banque] || null });
            if (r.annule) return;
            lu = { ...r, assoc: banques[banque] || r.colonnes };
            etat.textContent = String(r.fichier || '').split(/[\\/]/).pop();
            montrer();
          } catch (e) { toast(plainError(e), 'error'); }
        };
        ok.onclick = async () => {
          if (!lu || !lu.lignes.length) return;
          const compte = v('compte');
          if (!compte) return refus($('[name=compte]', rootModal), 'Choisis le compte bancaire : il ne se devine pas depuis le fichier.');
          const releve = {
            compte, banque: v('banque'), fichier: lu.fichier, empreinte: lu.empreinte,
            soldeDebut: KC.nombreDepuisCsv(v('debut')), soldeFin: KC.nombreDepuisCsv(v('fin')),
            lignes: lu.lignes
          };
          try {
            const r = await api.ajouterReleve({ dossierId: dossier.id, annee: s.annee, releve });
            s.livre = r.livre; banqueState.releve = r.releve.id;
            // Ce que l'association apprend ne sert que si on la garde : sans ça, chaque import
            // d'une même banque redemanderait le même travail.
            if (v('banque') && lu.assoc) {
              S = await api.saveBanque({
                banques: { ...banques, [v('banque')]: lu.assoc },
                dossierId: dossier.id, banque: { compte, banque: v('banque'), jours: (dossier.banque || {}).jours }
              });
            }
            close(); toast(`Relevé importé : ${pl(r.releve.lignes.length, 'ligne')}.`); drawLivres(root, dossier);
          } catch (e) { toast(plainError(e), 'error'); }
        };
      });
  }

  // Le fil du parcours (3/3) : depuis le livre d'UN client, rien ne menait à l'export qui regroupe
  // TOUS les clients d'un mois — le geste qui suit la relecture d'un livre, et la dernière étape de
  // la boucle. Il fallait connaître la page Écritures et y aller par le menu.
  const barreLivres = (controles, libelleExport) => `<div class="filters">${controles}
    <button class="btn btn-sm btn-ghost" id="lv-csv">${esc(libelleExport)}</button>
    ${/* Un libellé décrit l'écran d'ARRIVÉE (7.29.0). L'ancien libellé (« Regrouper… ») se lisait comme
          « donner à chacun son sous-compte » — deux lecteurs sur deux (T-42) — alors qu'il quitte le
          dossier pour la page Écritures, l'export de tout le portefeuille. Le mot « Exporter » le
          range avec son voisin, et le titre dit qu'on change de page. */''}
    <button class="btn btn-sm btn-ghost" id="lv-tous" title="Quitte ce dossier : la page Écritures regroupe les écritures de tous les clients d'un mois">Exporter les écritures de tous les clients…</button></div>`;

  const fmtJour = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
  };

  // ---------------------------------------------------------------- la grille de saisie (9.3.0)
  //
  // SPEC-UI-CAB-010. L'écran où un comptable passe ses journées, et la seule règle qui le décide :
  // **la souris n'est jamais obligatoire**. Journal, date, pièce, puis les lignes ; Entrée descend,
  // Tab sur la dernière ligne solde, Ctrl+Entrée enregistre. Les touches sont RÉGLABLES (Réglages →
  // Comptabilité) parce qu'on ne les invente pas : on reprend celles que le comptable a déjà dans
  // les doigts, et tant que personne ne l'a regardé travailler, ce qui est livré n'est qu'une
  // proposition.
  //
  // La pièce en cours vit dans `saisieState.piece` et l'écran ne se redessine PAS à chaque frappe :
  // on met à jour la donnée, puis le seul élément qui en dépend (`#sa-solde`). Redessiner la grille
  // à chaque caractère détruirait le champ sous le curseur — c'est le défaut de la 7.17.0, et il
  // rendait un champ littéralement impossible à remplir.
  const saisieState = { dossierId: '', piece: null, focusApres: null };

  // Un jour du calendrier, jamais un instant : `K.today()` rend le jour LOCAL, et la comparaison se
  // fait sur des chaînes `AAAA-MM-JJ` — aucune arithmétique de date, donc aucune question de fuseau
  // (règle 5.2.3). Hors de l'exercice ouvert, on propose son dernier jour : c'est là qu'on saisit
  // quand on rattrape un exercice passé.
  const dateProposee = annee => {
    const a = String(annee || '').slice(0, 4);
    if (!/^\d{4}$/.test(a)) return '';
    const auj = K.today();
    return auj.slice(0, 4) === a ? auj : `${a}-12-31`;
  };
  // Ce que le champ Date MONTRE : le jour en français quand on écrit la date complète, le seul
  // numéro de jour quand on est en saisie rapide. Ce que la pièce PORTE reste l'ISO, toujours.
  const dateAffichee = (iso, r) => (!iso ? '' : r.dateComplete ? fmtJour(iso) : String(Number(iso.slice(8, 10))));
  const pieceVide = (journal, date) => ({
    id: '', date: date || '', journal: journal || '', piece: '', libelle: '', pieceJointe: null,
    lignes: [ligneVide(), ligneVide()]
  });
  const ligneVide = () => ({ compte: '', libelle: '', debit: '', credit: '' });

  // Les lignes telles que le moteur les attend : les champs texte redeviennent des nombres ici, et
  // nulle part ailleurs. Une ligne entièrement vide ne compte pas — on en laisse toujours une au
  // bout de la grille pour pouvoir taper la suivante.
  const lignesReelles = p => (p.lignes || [])
    .filter(l => String(l.compte || '').trim() || Number(l.debit) || Number(l.credit))
    .map(l => ({
      compte: String(l.compte || '').trim(), libelle: String(l.libelle || ''),
      debit: Number(String(l.debit).replace(',', '.')) || 0,
      credit: Number(String(l.credit).replace(',', '.')) || 0
    }));

  const ecritureSaisie = p => ({
    date: p.date, journal: p.journal, piece: p.piece, libelle: p.libelle,
    source: 'saisie', pieceJointe: p.pieceJointe || null, lignes: lignesReelles(p)
  });

  // Une touche, sous la forme des réglages : « Enter », « Control+Enter », « F2 ».
  function toucheDe(ev) {
    const mods = [];
    if (ev.ctrlKey || ev.metaKey) mods.push('Control');
    if (ev.altKey) mods.push('Alt');
    if (ev.shiftKey && ev.key !== 'Tab') mods.push('Shift');
    return mods.concat([ev.key]).join('+');
  }
  const touchesSaisie = () => (((S || {}).settings || {}).saisie || K.DEFAULT_SAISIE).touches || K.DEFAULT_SAISIE.touches;
  const reglagesSaisie = () => ({ ...K.DEFAULT_SAISIE, ...(((S || {}).settings || {}).saisie || {}) });

  // Chercher un compte PENDANT la frappe, par numéro ou par nom. Le classement vient de
  // `compta.comptesQuiCorrespondent` : l'écran ne trie rien lui-même, sinon sa façon de classer
  // finirait par différer de celle qu'un test prouve. Les classes `.sugg-*` viennent de la feuille
  // PARTAGÉE (9.2.1) : même composant visuel des deux côtés, et aucune règle en double.
  function suggererCompte(input, planDe, onPick) {
    const host = input.closest('td') || input.parentElement;
    if (!host) return;
    host.classList.add('sugg-host');
    let pop = null, sel = 0, items = [];
    const fermer = () => { if (pop) pop.remove(); pop = null; items = []; };
    const dessiner = () => {
      items = KC.comptesQuiCorrespondent(planDe(), input.value, 8);
      if (!items.length || document.activeElement !== input) { fermer(); return; }
      // La liste vit sur le BODY, en position fixe calculée sur le champ (T-33) : dans la cellule,
      // elle était rognée par le `.scroll-x` du tableau — une seule entrée visible, coupée en deux.
      // Un conteneur qui défile rogne ce qui dépasse (7.13.0, vu de l'autre côté).
      if (!pop) { pop = document.createElement('div'); pop.className = 'sugg-pop sugg-fixe'; document.body.appendChild(pop); }
      const r = input.getBoundingClientRect();
      pop.style.left = Math.max(8, r.left) + 'px';
      pop.style.top = (r.bottom + 4) + 'px';
      pop.style.minWidth = Math.max(320, r.width) + 'px';
      sel = Math.min(sel, items.length - 1);
      pop.innerHTML = items.map((c, i) => `<div class="sugg-it ${i === sel ? 'sel' : ''}" data-i="${i}">
        <b>${esc(c.compte)}</b> <span class="muted">${esc(c.libelle || '')}</span></div>`).join('');
      $$('.sugg-it', pop).forEach(d => {
        // `mousedown` et pas `click` : le `blur` du champ referme la liste avant qu'un `click`
        // n'arrive, et le choix se perdrait sans que rien ne plante.
        d.onmousedown = ev => { ev.preventDefault(); choisir(items[Number(d.dataset.i)]); };
      });
    };
    const choisir = c => { if (!c) return; input.value = c.compte; fermer(); onPick(c); };
    input.addEventListener('input', () => { sel = 0; dessiner(); });
    input.addEventListener('focus', () => { sel = 0; dessiner(); });
    input.addEventListener('blur', () => setTimeout(fermer, 120));
    input.addEventListener('keydown', ev => {
      if (!pop || !items.length) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = (sel + 1) % items.length; dessiner(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = (sel - 1 + items.length) % items.length; dessiner(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fermer(); }
      else if (ev.key === 'Enter' || ev.key === 'Tab') {
        // Entrée et Tab CHOISISSENT quand une liste est ouverte : sans ça, il faudrait la souris
        // pour prendre ce qu'on vient de chercher, et la grille cesserait d'être au clavier.
        if (items[sel]) { ev.preventDefault(); choisir(items[sel]); }
      }
    });
  }

  function vueSaisie(dossier) {
    const s = livresState;
    const r = reglagesSaisie();
    if (!s.livre) {
      return `<div class="empty"><p>La saisie a besoin d'un livre.</p>
        <p class="muted small">Crée-le à partir des paquets reçus, ou reprends le dossier par sa balance d'ouverture — les deux boutons sont en haut de cette page.</p></div>`;
    }
    if (s.livre.exercice.clos) {
      return `<div class="warn-box"><b>L'exercice ${esc(s.annee)} est clos.</b> On n'y saisit plus. Rouvre-le si tu dois vraiment y toucher : la réouverture demande un motif, et c'est elle qui expliquera plus tard pourquoi un chiffre a changé.</div>`;
    }
    if (!saisieState.piece || saisieState.dossierId !== dossier.id) {
      saisieState.dossierId = dossier.id;
      const j = r.journalParDefaut || dossier.dernierJournal || (s.livre.journaux[0] || {}).code || '';
      // La date est PROPOSÉE : aujourd'hui si l'on est dans l'exercice ouvert, sinon son dernier
      // jour. La grille s'ouvrait vide, et le refus annonçait « La date manque » sur un écran où
      // l'invite grise « 04/03/2026 » se lit comme une valeur — on cherchait ce qui n'allait pas.
      // Elle reste modifiable, et les pièces suivantes reprennent celle de la précédente.
      saisieState.piece = pieceVide(j, dateProposee(s.annee));
    }
    const p = saisieState.piece;
    const brouillards = (s.livre.ecritures || []).filter(e => e.statut === 'brouillard')
      .slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const guides = K.guidesDuDossier(S, dossier);

    return `<div class="sa-tete">
        <label class="field"><span class="fl">Journal ${info('sa.journal')}</span>
          <select id="sa-journal">${s.livre.journaux.map(j => `<option value="${esc(j.code)}" ${p.journal === j.code ? 'selected' : ''}>${esc(j.code)} — ${esc(j.libelle)}</option>`).join('')}</select></label>
        <label class="field"><span class="fl">Date ${info('sa.date')}</span>
          ${/* Le champ montre le jour en FRANÇAIS, la pièce garde l'ISO. L'écran affichait
                « 2026-09-17 » sous une invite qui annonce « 04/03/2026 » : le format interne
                fuyait dans l'écran où un comptable tunisien lit une date. La saisie reste
                tolérante — `dateTapee` accepte 4, 4/3, 04/03/2026 et l'ISO. */''}
          <input id="sa-date" autocomplete="off" placeholder="${r.dateComplete ? '04/03/2026' : '4'}" value="${esc(dateAffichee(p.date, r))}"></label>
        <label class="field"><span class="fl">Pièce ${info('sa.piece')}</span>
          <input id="sa-piece" autocomplete="off" value="${esc(p.piece)}"></label>
        <label class="field sa-grow"><span class="fl">Libellé ${info('sa.libelle')}</span>
          <input id="sa-libelle" autocomplete="off" value="${esc(p.libelle)}"></label>
      </div>
      <div class="sa-outils">
        ${guides.length ? `<select id="sa-guide" aria-label="Partir d'un guide d'écritures"><option value="">Partir d'un guide…</option>${guides.map(g => `<option value="${esc(g.id)}">${esc(g.nom)}</option>`).join('')}</select>
          <input id="sa-guide-montant" class="sa-montant" inputmode="decimal" placeholder="Montant" autocomplete="off">` : ''}
        <button type="button" class="btn btn-sm" id="sa-joindre">${p.pieceJointe ? 'Justificatif joint ✓' : 'Joindre un justificatif…'}</button>
        ${aideTouches()}
      </div>
      <div class="scroll-x"><table class="list compact sa-grille"><thead><tr>
        <th class="nw">Compte</th><th>Intitulé</th><th>Libellé</th>
        <th class="r nw">Débit</th><th class="r nw">Crédit</th><th></th></tr></thead>
        <tbody id="sa-lignes">${lignesSaisieHtml()}</tbody>
        <tfoot><tr>
          <td colspan="3" class="sa-tl">Total de la pièce</td>
          <td class="r nw" id="sa-td">0,000</td><td class="r nw" id="sa-tc">0,000</td><td></td></tr>
          <tr id="sa-ecart-l"><td colspan="3" class="sa-tl">Écart</td>
          <td class="r nw" id="sa-te" colspan="2">0,000</td><td></td></tr></tfoot></table></div>
      <div class="sa-pied">
        <div>
          <div id="sa-solde"></div>
          ${/* Le motif du refus se lit AVANT le bouton, jamais dessous : un avertissement sous le
                geste arrive après la décision (règle 9.4.2). */''}
          <div class="sa-refus" id="sa-refus" hidden></div>
        </div>
        <div class="sa-actions">
          <button type="button" class="btn btn-sm" id="sa-vider">Vider</button>
          <button type="button" class="btn" id="sa-ok">Enregistrer en brouillard</button>
          <button type="button" class="btn btn-primary" id="sa-okvalider">Enregistrer et valider</button>
        </div>
      </div>
      <div class="sa-ajout"><button type="button" class="btn btn-sm btn-ghost" id="sa-ajouter">+ Ajouter une ligne</button></div>
      <h2 class="mt">Le brouillard ${info('sa.brouillard')}</h2>
      ${/* Les lots proposés sont ceux qui EXISTENT dans le brouillard (T-29) : « Valider tout le
            journal VT » quand le seul brouillard est en BQ ouvrait une fenêtre pour dire qu'il n'y
            avait rien à faire — un bouton vif qui ne peut rien valider de ce qui est affiché. Le
            compte est connu avant le clic, donc il est écrit dessus. */''}
      ${brouillards.length ? `${r.validerParLot ? `<div class="sa-lot">
          ${lotsDuBrouillard(brouillards).map(l => `<button type="button" class="btn btn-sm" data-lot-${l.type}="${esc(l.cle)}">${esc(K.libelleLot(l))}</button>`).join('')}
          <span class="muted small">Ce qui ne tombe pas juste n'est pas validé, et te sera nommé.</span></div>` : ''}
        <div class="scroll-x"><table class="list compact"><thead><tr>
          <th class="nw">Date</th><th>Journal</th><th class="nw">Pièce</th><th>Libellé</th>
          <th class="r nw">Total</th><th class="nw">État</th><th></th></tr></thead>
        <tbody>${brouillards.map(e => {
          const t = KC.soldeDeLignes(e.lignes);
          return `<tr data-br="${esc(e.id)}" class="br-ligne">
            <td class="nw">${esc(e.date)}</td><td>${esc(e.journal)}</td><td class="nw">${esc(e.piece || '—')}</td>
            <td>${esc(e.libelle || '')}${e.pieceJointe ? ' <span title="Justificatif joint">📎</span>' : ''}</td>
            <td class="r nw">${esc(montant(t.debit))}</td>
            <td class="nw">${t.equilibre ? '<span class="muted">équilibrée</span>' : `<span class="err-inline">écart ${esc(montant(t.ecart))}</span>`}</td>
            ${RowMenu.cellule('B:' + e.id, '')}</tr>`;
        }).join('')}</tbody></table></div>`
        : `<div class="empty mini"><p>Rien en brouillard.</p><p class="muted small">Tout ce que tu saisis ici arrive en brouillard : rien ne prend de numéro tant que tu ne l'as pas validé.</p></div>`}
      <p class="muted small mt">Une fois validée, une écriture ne se modifie plus : elle se <b>contre-passe</b> (une écriture miroir à la date du jour, pour corriger une erreur)
      ou s'<b>extourne</b> ${info('sa.extourne')} (une écriture miroir au 1er du mois suivant, pour une charge à payer). Les deux gestes sont dans le menu de la ligne, au livre-journal comme à la recherche.</p>
      ${/* Un abonnement est un modèle d'écriture récurrente : il appartient à la SAISIE (T-18). Posé
            hors des sous-onglets, il s'affichait sous la Balance, le Grand livre, la Banque et la
            Déclaration — un état vide secondaire qui repoussait chaque fois le contenu réel. */''}
      <div class="panel mt" id="c-abos"><h2>Abonnements ${info('sa.abonnements')}</h2><div id="d-abos"></div></div>`;
  }

  // Les périmètres qu'un lot peut valider, déduits du brouillard : par journal, puis par mois.
  function lotsDuBrouillard(brouillards) {
    const parJ = {}, parM = {};
    brouillards.forEach(e => {
      if (e.journal) parJ[e.journal] = (parJ[e.journal] || 0) + 1;
      const m = String(e.date || '').slice(0, 7);
      if (m) parM[m] = (parM[m] || 0) + 1;
    });
    const j = Object.keys(parJ).sort().map(k => ({ type: 'journal', cle: k, label: k, n: parJ[k] }));
    const m = Object.keys(parM).sort().map(k => ({ type: 'mois', cle: k, label: moisLabelCourt(k), n: parM[k] }));
    // Un seul journal ET un seul mois : les deux boutons valideraient la même chose.
    return j.length === 1 && m.length === 1 ? j : j.concat(m);
  }

  function lignesSaisieHtml() {
    const p = saisieState.piece || pieceVide();
    const plan = ((livresState.livre || {}).plan) || [];
    const nom = c => (plan.find(x => x.compte === String(c || '').trim()) || {}).libelle || '';
    // Chaque case porte son `aria-label` : le rapport entre une case et son en-tête de colonne est
    // évident à l'œil et invisible au clavier comme à la voix. Le numéro de ligne y est, sinon cinq
    // cases annoncent toutes « Compte » et on ne sait plus laquelle on remplit.
    const lab = (quoi, i) => `aria-label="${quoi} — ligne ${i + 1}"`;
    return (p.lignes || []).map((l, i) => `<tr data-i="${i}">
      <td><input data-k="compte" class="sa-compte" ${lab('Compte', i)} autocomplete="off" value="${esc(l.compte)}"></td>
      <td class="sa-nom muted small" data-nom="${i}">${esc(nom(l.compte))}</td>
      <td><input data-k="libelle" ${lab('Libellé', i)} autocomplete="off" value="${esc(l.libelle)}"></td>
      <td><input data-k="debit" class="r sa-montant" ${lab('Débit', i)} inputmode="decimal" autocomplete="off" value="${esc(l.debit)}"></td>
      <td><input data-k="credit" class="r sa-montant" ${lab('Crédit', i)} inputmode="decimal" autocomplete="off" value="${esc(l.credit)}"></td>
      <td class="sa-sup"><button type="button" class="btn btn-sm" data-sup="${i}" title="Retirer cette ligne" aria-label="Retirer cette ligne">✕</button></td>
    </tr>`).join('');
  }

  function brancherSaisie(el, root, dossier) {
    const s = livresState;
    if (!s.livre || !saisieState.piece) return;
    const p = saisieState.piece;
    const corps = $('#sa-lignes', el);
    const t = touchesSaisie();
    const r = reglagesSaisie();

    // Le solde, recalculé sans rien redessiner d'autre. C'est le « contrôle d'équilibre en direct » :
    // il ne refuse rien tout seul — c'est `ecritureValide` qui refuse, à l'enregistrement — il dit
    // seulement où on en est, pendant qu'on tape.
    const majSolde = () => {
      const box = $('#sa-solde', el);
      if (!box) return;
      const t2 = KC.soldeDeLignes(lignesReelles(p));
      box.className = t2.equilibre && t2.debit ? 'sa-solde ok' : t2.debit || t2.credit ? 'sa-solde ko' : 'sa-solde';
      box.innerHTML = !t2.debit && !t2.credit
        ? '<span class="muted">Débit et crédit à zéro.</span>'
        : t2.equilibre
          ? `<b>Équilibrée</b> — ${esc(montant(t2.debit))} de chaque côté.`
          : `<b>Écart ${esc(montant(t2.ecart))}</b> — débit ${esc(montant(t2.debit))} / crédit ${esc(montant(t2.credit))}. Il manque ${t2.solde.debit ? `${esc(montant(t2.solde.debit))} au débit` : `${esc(montant(t2.solde.credit))} au crédit`}.`;

      // Les totaux vivent SOUS leurs colonnes, en chiffres de même chasse. Une somme annoncée dans
      // une phrase à gauche de l'écran ne se compare à rien : l'œil descend une colonne de montants
      // et doit trouver leur total au bout, pas ailleurs.
      const td = $('#sa-td', el), tc = $('#sa-tc', el), te = $('#sa-te', el), lig = $('#sa-ecart-l', el);
      if (td) td.textContent = montant(t2.debit);
      if (tc) tc.textContent = montant(t2.credit);
      if (lig) lig.hidden = t2.equilibre;
      if (te) te.textContent = montant(t2.ecart);

      // **Un bouton éteint dit POURQUOI.** `ecritureValide` est la même fonction que celle qui
      // refusera à l'enregistrement : le motif affiché ici est donc exactement celui qu'on aurait
      // vu après le clic — on le lit avant, pendant qu'on a encore le curseur dans la grille.
      const v = KC.ecritureValide(ecritureSaisie(p), ((s.livre || {}).plan || []).map(c => c.compte));
      const motif = $('#sa-refus', el);
      [$('#sa-ok', el), $('#sa-okvalider', el)].forEach(b => {
        if (!b) return;
        b.disabled = !v.ok;
        b.title = v.ok ? '' : v.motif;
      });
      if (motif) { motif.hidden = v.ok; motif.textContent = v.ok ? '' : v.motif; }
    };

    const redessinerLignes = (focus) => {
      corps.innerHTML = lignesSaisieHtml();
      brancherLignes();
      majSolde();
      if (focus) {
        const cible = $(`tr[data-i="${focus.i}"] input[data-k="${focus.k}"]`, corps);
        if (cible) { cible.focus(); cible.select(); }
      }
    };

    const ligneDe = inp => Number(inp.closest('tr').dataset.i);
    const allerA = (i, k) => {
      const cible = $(`tr[data-i="${i}"] input[data-k="${k}"]`, corps);
      if (cible) { cible.focus(); cible.select(); return true; }
      return false;
    };

    function brancherLignes() {
      $$('input[data-k]', corps).forEach(inp => {
        const i = ligneDe(inp), k = inp.dataset.k;
        inp.oninput = () => {
          p.lignes[i][k] = inp.value;
          if (k === 'compte') {
            const c = (s.livre.plan || []).find(x => x.compte === inp.value.trim());
            const cell = $(`[data-nom="${i}"]`, corps);
            if (cell) cell.textContent = c ? (c.libelle || '') : '';
          }
          // Débit et crédit s'excluent : une ligne va d'un côté OU de l'autre, jamais des deux
          // (invariant de SPEC-DATA-005). On vide l'autre colonne plutôt que de laisser saisir une
          // ligne que la validation refusera trois écrans plus loin.
          if ((k === 'debit' || k === 'credit') && inp.value.trim()) {
            const autre = k === 'debit' ? 'credit' : 'debit';
            if (String(p.lignes[i][autre] || '').trim()) {
              p.lignes[i][autre] = '';
              const el2 = $(`tr[data-i="${i}"] input[data-k="${autre}"]`, corps);
              if (el2) el2.value = '';
            }
          }
          majSolde();
        };
        inp.onkeydown = ev => {
          const touche = toucheDe(ev);
          if (touche === t.recopier) {
            ev.preventDefault();
            if (i > 0) { p.lignes[i][k] = p.lignes[i - 1][k]; inp.value = p.lignes[i][k]; inp.dispatchEvent(new Event('input')); }
            return;
          }
          if (touche === t.dupliquer) { ev.preventDefault(); dupliquerPiece(); return; }
          if (touche === t.valider) { ev.preventDefault(); enregistrer(true); return; }
          if (touche === t.ligneSuivante) {
            ev.preventDefault();
            // Sur la dernière ligne, Entrée en AJOUTE une : la grille suit la saisie, on ne clique
            // jamais « ajouter une ligne ».
            if (i === p.lignes.length - 1) { p.lignes.push(ligneVide()); redessinerLignes({ i: i + 1, k: 'compte' }); }
            else allerA(i + 1, 'compte');
            return;
          }
          // Tab depuis le CRÉDIT de la dernière ligne : on solde. C'est le geste qui fait gagner le
          // plus de temps de toute la grille — et il ne s'invente pas : `soldeDeLignes` calcule,
          // l'écran pose. Si la pièce tombe déjà juste, Tab reprend son comportement normal.
          if (ev.key === 'Tab' && !ev.shiftKey && k === 'credit' && i === p.lignes.length - 1) {
            const solde = KC.soldeDeLignes(lignesReelles(p));
            if (!solde.equilibre && (solde.debit || solde.credit) && String(p.lignes[i].compte || '').trim()) {
              if (!String(p.lignes[i].debit || '').trim() && !String(p.lignes[i].credit || '').trim()) {
                ev.preventDefault();
                p.lignes[i].debit = solde.solde.debit ? solde.solde.debit.toFixed(3) : '';
                p.lignes[i].credit = solde.solde.credit ? solde.solde.credit.toFixed(3) : '';
                redessinerLignes({ i, k: solde.solde.debit ? 'debit' : 'credit' });
              }
            }
          }
        };
        if (k === 'compte') {
          suggererCompte(inp, () => s.livre.plan || [], c => {
            p.lignes[i].compte = c.compte;
            if (!String(p.lignes[i].libelle || '').trim()) p.lignes[i].libelle = c.libelle || '';
            redessinerLignes({ i, k: 'libelle' });
          });
        }
      });
      $$('[data-sup]', corps).forEach(b => {
        b.onclick = () => {
          const i = Number(b.dataset.sup);
          if (p.lignes.length <= 1) { p.lignes[0] = ligneVide(); } else { p.lignes.splice(i, 1); }
          redessinerLignes();
        };
      });
    }

    // L'entête : chaque champ écrit dans la pièce, aucun ne redessine la grille.
    const j = $('#sa-journal', el);
    if (j) j.onchange = () => { p.journal = j.value; api.dernierJournal(dossier.id, j.value).catch(() => {}); };
    const dt = $('#sa-date', el);
    if (dt) {
      const lire = () => {
        const iso = K.dateTapee(dt.value, s.annee, p.date || `${s.annee}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
        p.date = iso || '';
        dt.classList.toggle('sa-ko', !!dt.value.trim() && !iso);
        if (iso) dt.value = dateAffichee(iso, r);
      };
      dt.onblur = lire;
      // Un champ PRÉ-REMPLI se sélectionne au clic : sans ça, cliquer dedans et taper « 4/3 »
      // donne « 17/09/20264/3 », et il faut effacer à la main ce que l'application vient de
      // proposer. Le défaut est né avec la date proposée, deux corrections plus haut — c'est le
      // parcours réel qui l'a montré, jamais la relecture.
      dt.onfocus = () => dt.select();
    }
    const pc = $('#sa-piece', el); if (pc) pc.oninput = () => { p.piece = pc.value; };
    const lb = $('#sa-libelle', el); if (lb) lb.oninput = () => { p.libelle = lb.value; };

    // L'en-tête a sa propre chaîne, et c'est ENTRÉE — la même touche que dans la grille. Tab ne
    // peut pas la faire : chaque libellé porte sa bulle « i », qui est un vrai bouton et prend donc
    // le focus au passage. Les retirer de l'ordre de tabulation rendrait l'explication
    // inatteignable au clavier, ce que ce projet s'interdit depuis la 7.0.0. On ajoute un chemin
    // au lieu d'en couper un : Entrée descend de champ en champ, jusqu'à la première ligne.
    const chaine = [dt, pc, lb];
    chaine.forEach((champ, i) => {
      if (!champ) return;
      champ.addEventListener('keydown', ev => {
        if (toucheDe(ev) !== t.ligneSuivante) return;
        ev.preventDefault();
        if (champ === dt) champ.dispatchEvent(new Event('blur'));
        const suivant = chaine.slice(i + 1).find(Boolean);
        if (suivant) { suivant.focus(); suivant.select(); } else allerA(0, 'compte');
      });
    });

    // Les guides. Ils PRÉREMPLISSENT : après le clic, tout est encore modifiable, et rien n'est
    // enregistré. Un guide qui écrirait directement dans le livre serait un guide qu'on n'ose plus
    // utiliser.
    const gs = $('#sa-guide', el);
    if (gs) {
      gs.onchange = () => {
        const g = K.guidesDuDossier(S, dossier).find(x => x.id === gs.value);
        if (!g) return;
        const montant = Number(String(($('#sa-guide-montant', el) || {}).value || '').replace(',', '.')) || 0;
        const ecr = KC.ecritureDepuisGuide(g, { date: p.date, journal: g.journal, piece: p.piece, libelle: p.libelle, montant });
        p.journal = ecr.journal; p.libelle = ecr.libelle;
        p.lignes = ecr.lignes.map(l => ({
          compte: l.compte, libelle: l.libelle,
          debit: l.debit ? l.debit.toFixed(3) : '', credit: l.credit ? l.credit.toFixed(3) : ''
        }));
        p.lignes.push(ligneVide());
        gs.value = '';
        drawLivres(root, dossier);
      };
    }

    const jo = $('#sa-joindre', el);
    if (jo) jo.onclick = () => joindreJustificatif(root, dossier);

    const dupliquerPiece = () => {
      const base = lignesReelles(p);
      if (!base.length) return;
      p.lignes = base.map(l => ({ compte: l.compte, libelle: l.libelle, debit: l.debit ? l.debit.toFixed(3) : '', credit: l.credit ? l.credit.toFixed(3) : '' }))
        .concat([ligneVide()]);
      p.id = ''; p.piece = '';
      toast('Pièce dupliquée : la nouvelle n\'a ni numéro ni pièce, tape-les.');
      drawLivres(root, dossier);
    };

    const enregistrer = async (puisValider) => {
      const ecr = ecritureSaisie(p);
      const v = KC.ecritureValide(ecr, (s.livre.plan || []).map(c => c.compte));
      // Une saisie refusée se MONTRE : on amène le champ fautif à l'écran et on y met le curseur
      // (règle 7.0.0). Un message seul oblige à relire toute la grille.
      if (!v.ok) {
        const premier = v.motifs[0] || v.motif;
        if (/date/i.test(premier) && dt) { dt.focus(); dt.classList.add('sa-ko'); }
        else if (/journal/i.test(premier) && j) j.focus();
        else {
          const m = /Ligne (\d+)/.exec(premier);
          if (m) allerA(Number(m[1]) - 1, 'compte');
        }
        await infoDialog('Cette écriture n\'entre pas', v.motifs.join('\n'));
        return;
      }
      try {
        const res = p.id
          ? await api.modifierEcriture(dossier.id, s.annee, p.id, ecr)
          : await api.saisir(dossier.id, s.annee, ecr);
        s.livre = res.livre;
        if (puisValider) {
          const w = await api.valider(dossier.id, s.annee, res.id || p.id);
          s.livre = w.livre;
          toast(`Écriture validée sous le n° ${w.numero}.`);
        } else {
          toast(p.id ? 'Brouillard enregistré.' : 'Écriture enregistrée en brouillard : elle n\'a pas encore de numéro.');
        }
        // On enchaîne : même journal, même date, tout le reste vide. C'est ça, la saisie au
        // kilomètre — on ne revient jamais au menu entre deux pièces.
        saisieState.piece = pieceVide(p.journal, p.date);
        drawLivres(root, dossier);
        const d2 = $('#sa-piece'); if (d2) d2.focus();
      } catch (e) { await infoDialog('Enregistrement impossible', plainError(e)); }
    };

    const ok = $('#sa-ok', el); if (ok) ok.onclick = () => enregistrer(false);
    const okv = $('#sa-okvalider', el); if (okv) okv.onclick = () => enregistrer(true);
    const vd = $('#sa-vider', el);
    if (vd) vd.onclick = () => { saisieState.piece = pieceVide(p.journal, p.date); drawLivres(root, dossier); };

    $$('[data-lot-journal]', el).forEach(b => { b.onclick = () => validerUnLot(root, dossier, { journal: b.dataset.lotJournal }); });
    $$('[data-lot-mois]', el).forEach(b => { b.onclick = () => validerUnLot(root, dossier, { mois: b.dataset.lotMois }); });
    // « + Ajouter une ligne » (T-32) : le clavier reste le chemin rapide (Entrée sur la dernière
    // ligne), la souris cesse d'être un cul-de-sac — chaque ligne offrait déjà son « ✕ ».
    const aj = $('#sa-ajouter', el);
    if (aj) aj.onclick = () => { p.lignes.push(ligneVide()); redessinerLignes({ i: p.lignes.length - 1, k: 'compte' }); };

    brancherLignes();
    majSolde();

    // Les actions d'un brouillard : une seule porte par ligne (règle 7.29.0), et chaque action
    // porte une phrase entière.
    bindRowMenus(el, cle => {
      if (String(cle).startsWith('A:')) return actionsAbonnement(root, dossier, cle);
      if (!String(cle).startsWith('B:')) return [];
      const e = (s.livre.ecritures || []).find(x => x.id === String(cle).slice(2));
      return e ? actionsEcriture(root, dossier, e) : [];
    });
  }

  // Une écriture rangée, reprise dans la grille. Les montants redeviennent du TEXTE : la grille est
  // faite de champs, et un zéro affiché « 0 » dans une colonne vide se retaperait à chaque pièce.
  const pieceDepuis = e => ({
    id: e.id, date: e.date, journal: e.journal, piece: e.piece, libelle: e.libelle,
    pieceJointe: e.pieceJointe || null,
    lignes: (e.lignes || []).map(l => ({
      compte: l.compte, libelle: l.libelle,
      debit: l.debit ? Number(l.debit).toFixed(3) : '', credit: l.credit ? Number(l.credit).toFixed(3) : ''
    })).concat([ligneVide()])
  });

  async function supprimerBrouillard(root, dossier, e) {
    const ok = await confirmDialog('Supprimer ce brouillard ?',
      `<p>${esc(e.journal)} ${esc(e.piece || '(sans pièce)')} du ${esc(fmtJour(e.date))}.</p><p>Il n'a pas de numéro : il ne laissera aucun trou dans la numérotation, et rien n'en restera.</p>`,
      'Supprimer', true);
    if (!ok) return;
    try {
      const r = await api.supprimerEcriture(dossier.id, livresState.annee, e.id);
      livresState.livre = r.livre;
      if (saisieState.piece && saisieState.piece.id === e.id) saisieState.piece = null;
      toast('Brouillard supprimé.');
      drawLivres(root, dossier);
    } catch (err) { await infoDialog('Suppression impossible', plainError(err)); }
  }

  async function joindreJustificatif(root, dossier, ecritureId) {
    const s = livresState;
    // Sans écriture rangée, on joint à la pièce EN COURS : le justificatif se regarde pendant qu'on
    // saisit, pas après (règle 8.5.1, apprise sur l'app entreprise). Il faut donc l'enregistrer
    // d'abord, et on le dit.
    let id = ecritureId;
    if (!id) {
      if (!saisieState.piece || !saisieState.piece.id) {
        const suite = await confirmDialog('Enregistrer d\'abord ?',
          '<p>Un justificatif se range avec une écriture. Celle-ci n\'est pas encore enregistrée.</p><p>Je l\'enregistre en brouillard, puis j\'ouvre le sélecteur de fichier — elle reste modifiable.</p>',
          'Enregistrer et joindre');
        if (!suite) return;
        const ecr = ecritureSaisie(saisieState.piece);
        const v = KC.ecritureValide(ecr, (s.livre.plan || []).map(c => c.compte));
        if (!v.ok) { await infoDialog('Cette écriture n\'entre pas', v.motifs.join('\n')); return; }
        try {
          const res = await api.saisir(dossier.id, s.annee, ecr);
          s.livre = res.livre; saisieState.piece.id = res.id; id = res.id;
        } catch (e) { await infoDialog('Enregistrement impossible', plainError(e)); return; }
      } else id = saisieState.piece.id;
    }
    try {
      const r = await api.joindreEcriture({ dossierId: dossier.id, annee: s.annee, id });
      if (r.annule) return;
      s.livre = r.livre;
      if (saisieState.piece && saisieState.piece.id === id) saisieState.piece.pieceJointe = r.pieceJointe;
      toast('Justificatif joint et copié dans le dossier du client.');
      drawLivres(root, dossier);
    } catch (e) { await infoDialog('Justificatif impossible', plainError(e)); }
  }

  // Valider un lot. On DIT d'abord combien de pièces sont concernées : « valider » est irréversible,
  // et un bouton qui en validerait trente sans le dire serait un piège.
  async function validerUnLot(root, dossier, filtre) {
    const s = livresState;
    const cibles = (s.livre.ecritures || []).filter(e => e.statut === 'brouillard'
      && (!filtre.journal || e.journal === filtre.journal)
      && (!filtre.mois || String(e.date || '').slice(0, 7) === filtre.mois));
    if (!cibles.length) { await infoDialog('Rien à valider', 'Aucune écriture en brouillard ne correspond.'); return; }
    const quoi = filtre.journal ? `du journal ${filtre.journal}` : `de ${moisLabelCourt(filtre.mois)}`;
    const ok = await confirmDialog(`Valider ${pl(cibles.length, 'écriture')} ${quoi} ?`,
      '<p>Chacune prend son numéro et ne se modifiera plus : une validée se contre-passe.</p><p>Celles qui ne tombent pas juste ne seront pas validées, et te seront nommées.</p>',
      'Valider');
    if (!ok) return;
    try {
      const r = await api.validerLot({ dossierId: dossier.id, annee: s.annee, journal: filtre.journal, mois: filtre.mois });
      s.livre = r.livre;
      const lignes = [`${pl(r.validees.length, 'écriture validée', 'écritures validées')}.`];
      if (r.refusees.length) {
        lignes.push(`${pl(r.refusees.length, 'écriture n\'est pas entrée', 'écritures ne sont pas entrées')} — elles restent en brouillard :`);
        r.refusees.slice(0, 10).forEach(x => lignes.push(`  • ${x.journal} ${x.piece || '(sans pièce)'} du ${x.date} : ${x.motif}`));
      }
      await infoDialog('Validation', lignes.join('\n'));
      drawLivres(root, dossier);
    } catch (e) { await infoDialog('Validation impossible', plainError(e)); }
  }

  // ---------------------------------------------------------------- les abonnements (9.3.0)
  //
  // Un abonnement = un guide + une périodicité. Il vit sur le DOSSIER : un loyer appartient à un
  // client, pas au cabinet. Il génère EN BROUILLARD, jamais une validée d'office — une écriture que
  // personne n'a regardée ne doit pas engager la signature du comptable.
  function dessinerAbonnements(root, dossier) {
    const box = $('#d-abos', root);
    if (!box) return;
    const abos = dossier.abonnements || [];
    const guides = K.guidesDuDossier(S, dossier);
    if (!guides.length) {
      box.innerHTML = `<div class="sa-vide">Un abonnement s'appuie sur un guide d'écritures, et il n'y en a aucun pour l'instant.</div>
        <div class="modal-actions"><button type="button" class="btn" id="ab-guides">Écrire un premier guide…</button></div>`;
      const b = $('#ab-guides', box);
      if (b) b.onclick = () => versReglages('pan-guides');
      return;
    }
    box.innerHTML = `${abos.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
        <th>Nom</th><th>Guide</th><th class="nw">Depuis</th><th class="nw">Tous les</th>
        <th class="r nw">Montant</th><th class="nw">État</th><th></th></tr></thead>
      <tbody>${abos.map(a => {
        const g = guides.find(x => x.id === a.guideId);
        const reste = KC.occurrencesAGenerer(a, K.today()).length;
        return `<tr data-ab="${esc(a.id)}">
          <td>${esc(a.nom || '')}</td>
          <td>${g ? esc(g.nom) : '<span class="err-inline">guide supprimé</span>'}</td>
          <td class="nw">${esc(a.depuis || '—')}</td>
          <td class="nw">${a.tousLesMois > 1 ? `${a.tousLesMois} mois` : 'mois'}</td>
          <td class="r nw">${esc(montant(Number(a.montant) || 0))}</td>
          <td class="nw">${!a.actif ? '<span class="muted">suspendu</span>' : reste ? `<b>${pl(reste, 'à générer', 'à générer')}</b>` : '<span class="muted">à jour</span>'}</td>
          ${RowMenu.cellule('A:' + a.id, '')}</tr>`;
      }).join('')}</tbody></table></div>`
      : `<div class="sa-vide">Aucun abonnement. C'est ce qui évite de ressaisir le loyer tous les mois.</div>`}
      <div class="modal-actions">
        ${abos.some(a => a.actif && KC.occurrencesAGenerer(a, K.today()).length)
          ? '<button type="button" class="btn btn-primary" id="ab-gen">Générer ce qui manque</button>' : ''}
        <button type="button" class="btn" id="ab-new">Nouvel abonnement…</button></div>`;
    const nw = $('#ab-new', box); if (nw) nw.onclick = () => abonnementForm(root, dossier, null);
    const gen = $('#ab-gen', box);
    if (gen) gen.onclick = () => genererAbonnements(root, dossier);
    // Les menus des lignes sont branchés par la SAISIE, dont ce panneau fait partie (T-18) : UNE
    // seule table d'actions par racine (9.4.8), et le panneau vit dans `#c-livres`.
  }

  function actionsAbonnement(root, dossier, cle) {
    const a = (dossier.abonnements || []).find(x => x.id === String(cle).slice(2));
    if (!a) return [];
    return [
      { icon: 'modifier', label: 'Modifier cet abonnement', hint: 'Son guide, son montant, sa période', run: () => abonnementForm(root, dossier, a) },
      a.actif
        ? { icon: 'pause', label: 'Suspendre cet abonnement', hint: 'Il cesse de proposer des écritures', run: () => basculerAbo(root, dossier, a, false) }
        : { icon: 'reprendre', label: 'Reprendre cet abonnement', hint: 'Il recommence à proposer des écritures', run: () => basculerAbo(root, dossier, a, true) }
    ];
  }

  async function basculerAbo(root, dossier, abo, actif) {
    const liste = (dossier.abonnements || []).map(a => a.id === abo.id ? { ...a, actif } : a);
    try {
      S = await api.saveAbonnements(dossier.id, liste);
      toast(actif ? 'Abonnement repris.' : 'Abonnement suspendu.');
      render();
    } catch (e) { toast(plainError(e), 'error'); }
  }

  async function genererAbonnements(root, dossier) {
    const annee = livresState.annee || String(new Date().getFullYear());
    try {
      const r = await api.genererAbonnements({ dossierId: dossier.id, annee, jusquA: K.today() });
      livresState.livre = r.livre;
      const lignes = [`${pl(r.crees, 'écriture créée', 'écritures créées')} en brouillard.`];
      if (r.crees) lignes.push('Elles n\'ont pas de numéro : relis-les, puis valide-les.');
      if (r.horsExercice) lignes.push(`${pl(r.horsExercice, 'occurrence tombait', 'occurrences tombaient')} hors de l'exercice ${annee} : elles se génèreront dans le livre de leur année.`);
      if (r.sansGuide.length) lignes.push(`Guide introuvable pour : ${r.sansGuide.join(', ')}.`);
      await infoDialog('Abonnements', lignes.join('\n\n'));
      render();
    } catch (e) { await infoDialog('Génération impossible', plainError(e)); }
  }

  function abonnementForm(root, dossier, abo) {
    const guides = K.guidesDuDossier(S, dossier);
    const a = abo ? { ...abo } : {
      id: '', nom: '', guideId: (guides[0] || {}).id || '', actif: true,
      depuis: `${new Date().getFullYear()}-01-01`, jusqua: '', tousLesMois: 1, montant: 0, piece: '', libelle: '', faites: []
    };
    modal(
      `<h2>${abo ? 'Modifier l\'abonnement' : 'Nouvel abonnement'}</h2>
       <div class="grid-2">
         <label class="field obligatoire">Nom<input type="text" id="ab-nom" value="${esc(a.nom)}" placeholder="Loyer du local"></label>
         <label class="field obligatoire">Guide<select id="ab-guide">${guides.map(g => `<option value="${esc(g.id)}" ${a.guideId === g.id ? 'selected' : ''}>${esc(g.nom)}</option>`).join('')}</select></label>
         <label class="field narrow obligatoire">Depuis<input type="date" id="ab-depuis" value="${esc(a.depuis)}"></label>
         <label class="field narrow">Jusqu'à<input type="date" id="ab-jusqua" value="${esc(a.jusqua || '')}"></label>
         <label class="field narrow">Tous les (mois)<input type="number" id="ab-pas" min="1" max="12" value="${Number(a.tousLesMois) || 1}"></label>
         <label class="field narrow obligatoire">Montant<input type="text" id="ab-montant" class="r" value="${esc(a.montant || '')}"></label>
         <label class="field">Préfixe de pièce<input type="text" id="ab-piece" value="${esc(a.piece || '')}" placeholder="LOYER"></label>
         <label class="field">Libellé<input type="text" id="ab-libelle" value="${esc(a.libelle || '')}" placeholder="Loyer du local"></label>
       </div>
       <p class="muted small">La génération crée les écritures manquantes <strong>en brouillard</strong>, jusqu'à aujourd'hui. Relancer ne double rien : les mois déjà générés sont retenus.</p>
       <div class="modal-actions">
         ${abo ? '<button class="btn btn-danger" id="ab-sup">Supprimer</button>' : ''}
         <button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (layer, close) => {
        $('#no', layer).onclick = close;
        const ecrire = async liste => {
          try { S = await api.saveAbonnements(dossier.id, liste); close(); render(); toast('Abonnement enregistré.'); }
          catch (e) { toast(plainError(e), 'error'); }
        };
        const sup = $('#ab-sup', layer);
        if (sup) {
          sup.onclick = async () => {
            const ok = await confirmDialog('Supprimer cet abonnement ?',
              `<p>« ${esc(a.nom)} » ne proposera plus d'écritures.</p><p>Celles qu'il a déjà créées ne bougent pas : elles vivent leur vie dans le livre.</p>`, 'Supprimer', true);
            if (ok) ecrire((dossier.abonnements || []).filter(x => x.id !== a.id));
          };
        }
        $('#ok', layer).onclick = () => {
          const nom = $('#ab-nom', layer).value.trim();
          if (!nom) return refus($('#ab-nom', layer), 'Donne un nom à cet abonnement : c\'est lui que tu liras dans la liste.');
          const depuis = $('#ab-depuis', layer).value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(depuis)) return refus($('#ab-depuis', layer), 'Il faut une date de départ : c\'est elle qui dit à partir de quel mois générer.');
          const montant = Number(String($('#ab-montant', layer).value).replace(',', '.'));
          if (!Number.isFinite(montant) || montant <= 0) return refus($('#ab-montant', layer), 'Le montant doit être un nombre positif : c\'est lui que le guide répartit.');
          const neuf = {
            ...a, nom, guideId: $('#ab-guide', layer).value, depuis,
            jusqua: $('#ab-jusqua', layer).value || '',
            tousLesMois: Math.max(1, Number($('#ab-pas', layer).value) || 1),
            montant, piece: $('#ab-piece', layer).value.trim(), libelle: $('#ab-libelle', layer).value.trim(),
            actif: a.actif !== false
          };
          if (!neuf.id) neuf.id = 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
          const autres = (dossier.abonnements || []).filter(x => x.id !== neuf.id);
          ecrire(autres.concat([neuf]));
        };
      }
    );
  }

  // ---------------------------------------------------------------- la recherche (SPEC-UI-CAB-013)
  //
  // Chercher dans TOUT le journal de l'exercice, pas seulement dans la période affichée : on cherche
  // justement parce qu'on ne sait plus quand c'était. Le moteur est `compta.chercherEcritures` —
  // pur, testé, et il lit aussi bien un libellé qu'un montant.
  const rechState = { q: '', journal: '', statut: '' };

  function vueRecherche(/* lignes */) {
    const s = livresState;
    if (!s.livre) return '<div class="empty">La recherche a besoin d\'un livre.</div>';
    const trouvees = rechState.q.trim() || rechState.journal || rechState.statut
      ? KC.chercherEcritures(s.livre, rechState.q, { journal: rechState.journal, statut: rechState.statut, max: 200 })
      : [];
    const total = (s.livre.ecritures || []).length;
    return `<div class="filters mb">
        <input type="search" id="re-q" placeholder="Pièce, tiers, libellé, compte, numéro, montant…" value="${esc(rechState.q)}" style="min-width:280px">
        <select id="re-journal" aria-label="Le journal"><option value="">Tous les journaux</option>${(s.livre.journaux || []).map(j => `<option value="${esc(j.code)}" ${rechState.journal === j.code ? 'selected' : ''}>${esc(j.code)}</option>`).join('')}</select>
        <select id="re-statut" aria-label="L'état des écritures"><option value="">Brouillard et validées</option>
          <option value="brouillard" ${rechState.statut === 'brouillard' ? 'selected' : ''}>Brouillard seulement</option>
          <option value="validee" ${rechState.statut === 'validee' ? 'selected' : ''}>Validées seulement</option>
          <option value="contrepassee" ${rechState.statut === 'contrepassee' ? 'selected' : ''}>Contre-passées</option></select>
      </div>
      ${!rechState.q.trim() && !rechState.journal && !rechState.statut
        ? `<div class="empty"><p>Tape ce que tu cherches.</p><p class="muted small">${pl(total, 'écriture')} dans le livre de ${esc(s.annee)}. Un montant se cherche aussi : « 1191 » ou « 1191,000 ».</p></div>`
        : !trouvees.length
          ? `<div class="empty"><p>Rien ne correspond.</p><p class="muted small">La recherche porte sur toute l'année, pas seulement sur la période affichée en haut.</p></div>`
          : `<div class="muted small mb">${pl(trouvees.length, 'écriture trouvée', 'écritures trouvées')} sur ${pl(total, 'écriture')}${trouvees.length >= 200 ? ' — affichage limité aux 200 premières, précise ta recherche' : ''}.</div>
        <div class="scroll-x"><table class="list compact"><thead><tr>
          <th class="r nw">N°</th><th class="nw">Date</th><th>Journal</th><th class="nw">Pièce</th><th>Libellé</th>
          <th class="r nw">Total</th><th class="nw">État</th><th></th></tr></thead>
        <tbody>${trouvees.map(e => {
          const t = KC.soldeDeLignes(e.lignes);
          return `<tr data-re="${esc(e.id)}" class="${e.statut === 'brouillard' ? 'br-ligne' : e.statut === 'contrepassee' ? 'cp-ligne' : ''}">
            <td class="r nw">${e.numero == null ? '—' : e.numero}</td><td class="nw">${esc(e.date)}</td>
            <td>${esc(e.journal)}</td><td class="nw">${esc(e.piece || '—')}</td>
            <td>${esc(e.libelle || '')}${e.pieceJointe ? ' <span title="Justificatif joint">📎</span>' : ''}</td>
            <td class="r nw">${esc(montant(t.debit))}</td>
            <td class="nw">${e.statut === 'brouillard' ? '<i>brouillard</i>' : e.statut === 'contrepassee' ? 'contre-passée' : 'validée'}</td>
            ${RowMenu.cellule('R:' + e.id, '')}</tr>`;
        }).join('')}</tbody></table></div>`}`;
  }

  function brancherRecherche(el, root, dossier) {
    const s = livresState;
    const q = $('#re-q', el);
    if (q) {
      // On redessine à la frappe, mais le champ de recherche est REMIS et le curseur replacé au
      // bout : sans ça on ne peut taper qu'une lettre (défaut 7.17.0).
      q.oninput = () => {
        rechState.q = q.value;
        drawLivres(root, dossier);
        const n = $('#re-q');
        if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
      };
    }
    const j = $('#re-journal', el); if (j) j.onchange = () => { rechState.journal = j.value; drawLivres(root, dossier); };
    const st = $('#re-statut', el); if (st) st.onchange = () => { rechState.statut = st.value; drawLivres(root, dossier); };
    bindRowMenus(el, cle => {
      if (!String(cle).startsWith('R:') || !s.livre) return [];
      const e = (s.livre.ecritures || []).find(x => x.id === String(cle).slice(2));
      if (!e) return [];
      return actionsEcriture(root, dossier, e);
    });
  }

  // Les actions d'une écriture, à UN endroit. Elles sont les mêmes depuis la recherche, le
  // livre-journal et le brouillard — trois tables séparées auraient divergé au premier ajout, et
  // c'est exactement le défaut que la 7.29.0 a trouvé sur le devis déjà facturé.
  function actionsEcriture(root, dossier, e) {
    const a = [];
    if (e.statut === 'brouillard') {
      a.push({ icon: 'oui', label: 'Valider cette écriture', hint: 'Elle prend son numéro et ne se modifiera plus',
        run: () => validerEcriture(root, dossier, e) });
      a.push({ icon: 'modifier', label: 'Reprendre dans la grille', hint: 'Elle remonte dans la saisie, modifiable',
        run: () => { saisieState.piece = pieceDepuis(e); livresState.onglet = 'saisie'; drawLivres(root, dossier); } });
      a.push({ icon: 'supprimer', label: 'Supprimer ce brouillard', hint: 'Il n\'a pas de numéro : rien ne restera', danger: true,
        run: () => supprimerBrouillard(root, dossier, e) });
    }
    if (e.statut === 'validee') {
      a.push({ icon: 'contrat', label: 'Contre-passer cette écriture', hint: 'Une écriture miroir, à la date du jour',
        run: () => contrepasserEcriture(root, dossier, e) });
      a.push({ icon: 'horloge', label: 'Extourner au 1er du mois suivant', hint: 'Pour une charge à payer ou un produit à recevoir',
        run: () => extournerEcriture(root, dossier, e) });
    }
    a.push({ icon: 'texte', label: e.pieceJointe ? 'Remplacer le justificatif…' : 'Joindre un justificatif…',
      hint: 'Le fichier est copié dans le dossier du client', run: () => joindreJustificatif(root, dossier, e.id) });
    if (e.pieceJointe) {
      a.push({ icon: 'ouvrir', label: 'Ouvrir le justificatif', hint: esc(e.pieceJointe),
        run: async () => { try { await api.ouvrirJustificatif(dossier.id, e.pieceJointe); } catch (x) { await infoDialog('Justificatif introuvable', plainError(x)); } } });
    }
    return a;
  }

  async function extournerEcriture(root, dossier, e) {
    const date = KC.premierDuMoisSuivant(e.date);
    const ok = await confirmDialog('Extourner cette écriture ?',
      `<p>${esc(e.journal)} ${esc(e.piece || '(sans pièce)')} n° ${esc(String(e.numero))} du ${esc(fmtJour(e.date))}.</p><p>Une écriture miroir sera créée et VALIDÉE au ${esc(fmtJour(date))}. L'écriture d'origine ne bouge pas : elle reste dans son mois, avec son numéro — c'est ce qui distingue une extourne d'une contre-passation.</p>`,
      'Extourner');
    if (!ok) return;
    try {
      const r = await api.extourner(dossier.id, livresState.annee, e.id);
      livresState.livre = r.livre;
      toast(`Extourne créée au ${r.date}, sous le n° ${r.numero}.`);
      drawLivres(root, dossier);
    } catch (err) { await infoDialog('Extourne impossible', plainError(err)); }
  }

  function brancherVue(el, root, dossier, lignes) {
    const s = livresState;
    const redraw = () => drawLivres(root, dossier);
    // Tout ce qui change la SÉLECTION remet la page à 1 : sans ça, filtrer sur un journal depuis la
    // page 7 donne un tableau vide, et rien à l'écran n'explique pourquoi.
    const j = $('#lv-journal', el); if (j) j.onchange = () => { s.journal = j.value; s.page = 1; redraw(); };
    const q = $('#lv-q', el); if (q) q.oninput = () => { s.q = q.value; s.page = 1; redraw(); };
    const c = $('#lv-compte', el); if (c) c.onchange = () => { s.compte = c.value; s.page = 1; redraw(); };
    const a = $('#lv-aux', el); if (a) a.onclick = () => { s.aux = !s.aux; s.page = 1; redraw(); };
    const ar = $('#lv-aux-role', el); if (ar) ar.onchange = () => { s.auxRole = ar.value; s.page = 1; redraw(); };
    const x = $('#lv-csv', el); if (x) x.onclick = () => exporterLivre(lignes);
    const tt = $('#lv-tous', el); if (tt) tt.onclick = () => vers('#/ecritures');
    // Le lettrage automatique (9.5.0). Il DIT ce qu'il a posé et ce qu'il a laissé : « 12 lignes
    // traitées » laisserait croire que tout est réglé alors que la moitié attend une décision.
    const au = $('#lv-auto', el);
    if (au) au.onclick = async () => {
      au.disabled = true;
      try {
        const r = await api.lettrageAuto({ dossierId: dossier.id, annee: s.annee, compte: s.compte || '411' });
        s.livre = r.livre;
        toast(r.poses.length
          ? `${pl(r.poses.length, 'lettre posée', 'lettres posées')} ; ${pl(r.restent, 'ligne reste ouverte', 'lignes restent ouvertes')}.`
          : `Rien à lettrer d'office : ${pl(r.restent, 'ligne ouverte', 'lignes ouvertes')}, aucune paire qui se solde sans ambiguïté.`);
        redraw();
      } catch (e) { toast(plainError(e), 'error'); au.disabled = false; }
    };
    // L'export porte sur `lignes` — la sélection entière, jamais la page affichée.
    bindPager(el, redraw, s);
    // « Ouvrir la pièce dans le paquet » : seulement si on sait DANS QUEL paquet elle vit.
    bindRowMenus(el, cle => {
      // Sur le LIVRE, la clé désigne l'écriture : c'est elle qui se valide et se contre-passe.
      // Une validée n'offre JAMAIS « Modifier » ni « Supprimer » — elle se contre-passe, et c'est
      // toute la différence entre une comptabilité et un tableur.
      if (String(cle).startsWith('E:') && s.livre) {
        const id = String(cle).slice(2);
        const e = s.livre.ecritures.find(x => x.id === id);
        if (!e) return [];
        // La MÊME table que la recherche et le brouillard : trois listes séparées auraient divergé
        // au premier ajout (règle 7.29.0).
        const actions = actionsEcriture(root, dossier, e);
        if (e.mois && (s.data.paquets || []).some(z => z.month === e.mois && z.path)) {
          actions.push({ icon: 'loupe', label: 'Voir dans le paquet', hint: `${e.piece} · ${moisLabelCourt(e.mois)}`,
            run: () => openPack(dossier, e.mois) });
        }
        return actions;
      }
      const [piece, mois] = String(cle).split('|');
      const p = (s.data.paquets || []).find(z => z.month === mois);
      if (!p || !p.path) return [];
      return [{ icon: 'loupe', label: 'Voir dans le paquet', hint: `${piece} · ${moisLabelCourt(mois)}`,
        run: () => openPack(dossier, mois) }];
    });
  }

  async function exporterLivre(lignes) {
    const s = livresState;
    const cols = s.onglet === 'balance'
      ? (s.aux
        ? [['tiers', 'Tiers'], ['account', 'Comptes'], ['ouvertureD', 'Ouverture débit'], ['ouvertureC', 'Ouverture crédit'], ['debit', 'Mouvements débit'], ['credit', 'Mouvements crédit'], ['soldeD', 'Solde débiteur'], ['soldeC', 'Solde créditeur']]
        : [['account', 'Compte'], ['label', 'Intitulé'], ['ouvertureD', 'Ouverture débit'], ['ouvertureC', 'Ouverture crédit'], ['debit', 'Mouvements débit'], ['credit', 'Mouvements crédit'], ['soldeD', 'Solde débiteur'], ['soldeC', 'Solde créditeur']])
      : [['numero', 'N°'], ['date', 'Date'], ['journal', 'Journal'], ['piece', 'Pièce'], ['account', 'Compte'], ['tiers', 'Tiers'], ['label', 'Libellé'], ['debit', 'Débit'], ['credit', 'Crédit'], ['lettre', 'Lettrage']];
    // La MÊME période que l'écran (ouverture comprise, T-38) : un export qui ne porte pas ce que
    // l'écran montre est un second document, et les deux finissent par se contredire.
    const rows = s.onglet === 'balance'
      ? (s.aux ? balanceAux(lignes, s.auxRole === 'fournisseurs' ? 'fournisseurs' : 'clients')
        : KC.balanceDepuisLignes(lignes, (s.periode || {}).ouverture || null, nomDeCompte())).rows
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
    // Sous trois mois reçus, une courbe n'apprend rien : douze colonnes de 200 px de haut pour une
    // ou deux barres, et onze « pas reçu ». L'information réelle EST le chiffre — et le fait qu'il
    // ne porte que sur deux mois, ce qu'aucun graphique ne dit aussi clairement qu'une phrase.
    if (recus < 3) {
      const nommes = mois.filter((m, i) => vals[i] != null).map(m => K.monthLabel(m)).join(' et ');
      return `<div class="ca-maigre">
        <div><span class="eyebrow">Chiffre d'affaires déclaré</span>
          <div class="ca-somme">${esc(money(total, devise))}</div></div>
        <div class="muted small">sur ${pl(recus, 'mois', 'mois')} seulement — ${esc(nommes)}.
          La courbe des douze mois apparaîtra quand tu auras reçu au moins trois mois.</div></div>`;
    }
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
             <p class="muted small">Une sauvegarde est prise juste avant, ses livres compris. Si le client est simplement parti, préfère <strong>l'archivage</strong> : il disparaît des listes sans rien perdre.</p>
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
    const toutes = K.relanceRows(S);
    // La sélection venue d'une échéance. On la compare sur le NOM, parce que c'est ce que
    // `ligneEcheance` retient — et on garde ce qui reste à relancer : un client qui a envoyé son
    // mois entre-temps n'a plus rien à faire ici, même si l'échéance le nommait tout à l'heure.
    const filtre = Array.isArray(relState.seulement) ? new Set(relState.seulement) : null;
    const rows = filtre ? toutes.filter(r => filtre.has(r.name)) : toutes;
    // Une coche posée sur un client qui a envoyé son mois entre-temps n'a plus de sens : on la
    // laisse tomber au lieu de relancer quelqu'un qui n'a plus rien à envoyer.
    relState.coches = new Set([...relState.coches].filter(id => rows.some(r => r.id === id)));
    const coches = rows.filter(r => relState.coches.has(r.id));
    const rel = K.relanceDue(S);
    // « Personne à relancer : tous tes dossiers sont à jour » félicitait un cabinet qui n'a AUCUN
    // dossier. C'est la règle de la 7.0.0 — avant d'écrire une phrase rassurante, vérifier que
    // l'univers concerné est non vide — et c'était la seule des trois pages qui ne l'appliquait pas :
    // Échéances et Écritures ont leur état vide avec son geste depuis toujours.
    if (!K.dossierList(S).length) {
      relState.seulement = null; relState.depuis = ''; relState.coches.clear();
      view.innerHTML = `<div class="page-head"><h1>Relances</h1></div>
        <div class="panel"><h2>Aucun client pour l'instant</h2>
          <p>Cette page réunit les clients dont il te manque un mois, avec le message déjà écrit : les mois
          manquants sont nommés dedans, et la relance est enregistrée pour que tu saches, lundi, qui tu as
          déjà relancé.</p>
          <div class="modal-actions"><button class="btn btn-primary" id="rl-nd">Ajouter mes clients…</button>
          <button class="btn" id="rl-imp">Importer un paquet…</button></div></div>`;
      $('#rl-nd').onclick = () => newDossierForm();
      $('#rl-imp').onclick = () => doImport();
      return;
    }
    view.innerHTML = `
      <div class="page-head"><h1>Relances</h1>
        ${rows.length > 1 ? `<div class="actions"><button class="btn btn-primary" id="group">${
  coches.length ? `Relancer ${pl(coches.length, 'client')} coché${coches.length > 1 ? 's' : ''}`
    : filtre ? `Relancer ${pl(rows.length, 'client')}` : 'Relancer tout le monde'} ${info('r.group')}</button></div>` : ''}</div>
      ${filtre ? `<div class="banner"><span><strong>${pl(rows.length, 'client')}</strong> sur ${toutes.length}${
  relState.depuis ? ` — ceux qu'il te manque pour « ${esc(relState.depuis)} »` : ''}.</span>
        <button class="btn btn-sm" id="rl-tout">Voir tout le monde</button></div>` : ''}
      <p class="muted small mb">Un message qui nomme les mois manquants fait bouger ; « envoie-moi tes documents » non.
      SkanFact prépare le texte, ton logiciel de messagerie l'envoie — et la relance est enregistrée pour que tu saches, lundi, qui tu as déjà relancé.</p>
      ${rel.due && rel.total ? `<div class="banner"><span>On est le <strong>${rel.jour}</strong> : tu as fixé le ${rel.day} du mois comme jour de relance.
        ${[
    rel.count ? `${pl(rel.count, 'dossier')} ${rel.count > 1 ? 'ont' : 'a'} des mois manquants` : '',
    rel.provisoires ? `${pl(rel.provisoires, rel.count ? 'autre' : 'dossier')} ${rel.provisoires > 1 ? 'ont' : 'a'} envoyé un mois qui n'est pas clôturé` : ''
  ].filter(Boolean).join(', et ')}.</span></div>` : ''}
      ${rows.length ? `<div class="scroll-x"><table class="list">
        ${/* M11 — « tout le monde ou personne » : un comptable relance les cinq clients d'une
              échéance, ou ceux qu'il n'a pas eus au téléphone. La case d'en-tête coche ce que
              l'écran MONTRE, jamais les soixante — cocher ce qu'on ne voit pas est un piège. */''}
        <thead><tr>
          <th class="nw sel-col"><input type="checkbox" id="rl-all" aria-label="Tout cocher sur cette page"
            ${rows.length && rows.every(r => relState.coches.has(r.id)) ? 'checked' : ''}></th>
          <th class="nw">Client</th><th class="nw">Contact</th><th class="nw">Ce qui manque</th><th class="nw">Dernière relance</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td class="nw sel-col"><input type="checkbox" data-sel="${esc(r.id)}" aria-label="Relancer ${esc(r.name)}" ${relState.coches.has(r.id) ? 'checked' : ''}></td>
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
        { icon: 'dossier', label: 'Ouvrir le dossier', hint: 'Ses paquets, ses chiffres et son historique', run: () => { location.hash = '#/dossier/' + encodeURIComponent(r.id); } },
        // Le métier du Cabinet est une BOUCLE : un paquet arrive, on vérifie, on écrit, on exporte,
        // on relance qui n'a rien envoyé. Chaque écran doit finir par le geste suivant — c'est ce
        // que l'Aide de l'app entreprise applique depuis la 7.27.0, et qu'aucune page du Cabinet
        // n'appliquait. Avant d'écrire à quelqu'un, on va voir ce qu'on a déjà de lui.
        { icon: 'contrat', label: 'Ouvrir sa comptabilité', hint: 'Livre-journal, grand livre, balance, saisie',
          run: () => { location.hash = '#/dossier/' + encodeURIComponent(r.id) + '/comptabilite'; } }
      ];
    });
    // « Relancer tout le monde » porte sur ce que l'écran MONTRE : sous filtre, il ne peut pas
    // relancer soixante clients pendant que le bandeau en annonce onze (règle 7.16.0).
    const g = $('#group'); if (g) g.onclick = () => groupRelance((coches.length ? coches : rows).slice());
    $$('[data-sel]', view).forEach(c => {
      c.onchange = () => {
        if (c.checked) relState.coches.add(c.dataset.sel); else relState.coches.delete(c.dataset.sel);
        render();
      };
    });
    const all = $('#rl-all'); if (all) all.onchange = () => {
      // La case d'en-tête porte sur ce que l'écran MONTRE : sous filtre, cocher soixante clients
      // pendant que le bandeau en annonce onze serait exactement le chiffre qui ment (7.16.0).
      rows.forEach(r => { if (all.checked) relState.coches.add(r.id); else relState.coches.delete(r.id); });
      render();
    };
    const rt = $('#rl-tout'); if (rt) rt.onclick = () => { relState.seulement = null; relState.depuis = ''; render(); };
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

    // Deux répétitions que la capture montre et qu'aucun test ne voit. (1) Le `detail` explique la
    // RÈGLE, pas l'occurrence : la même phrase de 90 caractères s'affichait sous les quatre mois de
    // TVA d'affilée. Une explication se lit une fois — on la garde sur la première carte de chaque
    // règle. (2) Les noms des clients qui manquent sont les mêmes d'un mois sur l'autre : les
    // réénumérer quatre fois fait croire à quatre problèmes différents. Quand la liste est
    // identique à celle qu'on vient d'écrire, on le DIT au lieu de la recopier.
    const vus = new Set();
    let derniersManquants = '';
    const carte = e => {
      const cle = K.cleEcheance(e);
      const depose = K.echeanceDeposee(S, e);
      const nouveauDetail = !vus.has(e.id);
      vus.add(e.id);
      const sig = e.manquants.join('|');
      const memeListe = !!sig && sig === derniersManquants;
      derniersManquants = sig;
      return `<div class="ech lvl-${depose ? 'ok' : e.level}${depose ? ' ech-fait' : ''}">
      <div class="ech-date"><div class="ech-j">${esc(e.date.slice(8))}</div><div class="ech-m">${esc(K.monthLabel(e.date.slice(0, 7)).split(' ')[0])}</div></div>
      <div class="ech-txt">
        <div class="ech-lab">${esc(e.label)}<span class="ech-when">${depose ? 'déposée' : e.passee ? `il y a ${-e.jours} j` : e.jours === 0 ? "aujourd'hui" : `dans ${e.jours} j`}</span></div>
        ${nouveauDetail ? `<div class="small muted">${esc(e.detail)}</div>` : ''}
        <div class="ech-bar">
          <span class="ok-inline">${e.prets} prêt${e.prets > 1 ? 's' : ''}</span>
          ${e.provisoires.length ? `<span class="warn-inline">${e.provisoires.length} en provisoire</span>` : ''}
          ${e.manquants.length ? `<span class="err-inline">${e.manquants.length} sans ${e.mois.length > 1 ? 'les mois' : 'le mois'}</span>` : ''}
          <span class="muted small">sur ${pl(e.clients, 'client')}</span>
        </div>
        ${e.manquants.length ? `<div class="small mt ech-qui">${memeListe
          ? `<span class="muted">Les mêmes ${pl(e.manquants.length, 'client')} que l'échéance du dessus.</span>`
          : `${esc(e.manquants.slice(0, 8).join(', '))}${e.manquants.length > 8 ? '…' : ''}`}
          ${/* Un lien souligné au milieu d'une phrase n'est pas un geste : c'est un vrai bouton, et
                il emmène aux Relances FILTRÉES sur ces clients-là — « Les relancer » qui ouvre les
                soixante n'a pas tenu sa promesse (règle 7.15.0). */''}
          <button class="btn btn-sm" data-relq="${esc(cle)}">Relancer ces ${pl(e.manquants.length, 'client')}</button></div>` : ''}
        ${/* Pointer une occurrence, jamais une règle (7.21.0) : la TVA d'avril cesse de réclamer,
              celle de mai reste due. Et c'est un PENSE-BÊTE — le Cabinet ne dépose rien et ne se
              connecte à aucune administration : c'est écrit sous le bouton. */''}
        <div class="ech-fin"><button class="btn btn-sm ${depose ? '' : 'btn-ghost'}" data-depot="${esc(cle)}">${
  depose ? 'Annuler « déposée »' : 'Marquer déposée'}</button>
          <span class="muted small">Un pense-bête : SkanFact ne dépose rien à ta place. ${info('ec.depot')}</span></div>
      </div></div>`;
    };

    view.innerHTML = `
      <div class="page-head"><h1>Échéances</h1></div>
      <p class="muted small mb">Chaque échéance est rattachée aux <strong>paquets que tu n'as pas reçus</strong> : c'est la seule chose
      qu'un calendrier papier ne peut pas te dire. ${info('ec.dates')}</p>
      <div class="warn-box mb"><strong>À VÉRIFIER avec l'usage de ton cabinet.</strong> Les jours proposés suivent la pratique courante en Tunisie
      (TVA le ${K.deadlineSettings(S).tvaDay}, CNSS le ${K.deadlineSettings(S).cnssDay} du mois suivant) mais dépendent de la forme juridique,
      du régime et de la loi de finances. Tu les règles dans <a href="#/reglages">Réglages</a>.</div>

      <div class="panel"><h2>À venir</h2>
        ${prochaines.length ? `<div class="ech-list">${prochaines.map(carte).join('')}</div>`
          : '<div class="empty mini">Rien dans les trois prochains mois.</div>'}</div>

      ${passees.length ? `<div class="panel"><h2>Déjà passées</h2>
        <p class="small muted">SkanFact ne sait pas ce que tu as déposé : pointe celles que tu as faites, et cette liste ne garde que les mois
        qu'on n'a jamais pu déclarer faute de pièces. ${info('ec.passees')}</p>
        <div class="ech-list">${passees.slice(0, 8).map(carte).join('')}</div></div>` : ''}`;

    // Le pointage : on écrit, puis on propose de défaire. Au moment où l'on comprend qu'on s'est
    // trompé de ligne, la carte a déjà changé de couleur — d'où le « Annuler » sous la main (7.12.0),
    // et le bouton de la carte elle-même, qui reste le chemin du lendemain.
    $$('[data-depot]', view).forEach(b2 => {
      b2.onclick = async () => {
        const cle = b2.dataset.depot;
        const avant = ((S.settings || {}).depots || []).slice();
        const apres = avant.includes(cle) ? avant.filter(x => x !== cle) : avant.concat([cle]);
        const poser = async (liste, refaire) => {
          try {
            S = await api.saveCabinet({
              name: (S.cabinet || {}).name || '', email: (S.cabinet || {}).email || '', phone: (S.cabinet || {}).phone || '',
              settings: { depots: liste }
            });
            render();
            if (refaire) toastUndo(liste.includes(cle) ? 'Échéance marquée déposée.' : 'Pointage annulé.', () => poser(avant, false));
          } catch (e) { toast(plainError(e), 'error'); }
        };
        await poser(apres, true);
      };
    });

    // « Relancer ces N clients » : on emmène aux Relances avec la sélection POSÉE, pas la page
    // entière. Le lien d'avant nommait un ensemble et en ouvrait un autre.
    $$('[data-relq]', view).forEach(b2 => {
      b2.onclick = () => {
        const e = liste.find(x => K.cleEcheance(x) === b2.dataset.relq);
        relState.seulement = e ? e.manquants.slice() : null;
        relState.depuis = e ? e.label : '';
        vers('#/relances');
      };
    });
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
            <div class="sub">${plan.sansPaquet.length ? `${plan.sansPaquet.length} sans rien envoyé` : 'tous ont envoyé'}</div></div>
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
  // ---------------------------------------------------------------- la licence du cabinet (9.4.0)
  //
  // Elle se lit dans le processus principal (hors ligne, `licence.js`) et arrive ici toute faite :
  // l'état, ce qui est compté, et POURQUOI chaque dossier compte ou ne compte pas. Un écran qui
  // annoncerait « 7 dossiers comptés » sans pouvoir les nommer serait un chiffre qu'on ne croit pas
  // — et c'est un chiffre qui décide d'une facture.
  let licCab = null;

  async function chargerLicence() {
    try { licCab = await api.licenceStatus(); } catch (e) { licCab = { erreur: plainError(e) }; }
    majBandeauLicence();
  }

  // Le bandeau, à trois tons. La décision vient de `licence.pastille`, dont un test exige qu'elle
  // soit le JUMEAU EXACT de `core.pastilleLicence` : les deux applications doivent dire la même
  // chose de la même échéance, et aucune ne peut charger le module de l'autre.
  function majBandeauLicence() {
    const el = $('#lic-banner');
    if (!el) return;
    const p = (licCab && licCab.pastille) || { show: false };
    el.hidden = !p.show;
    el.classList.toggle('warn', p.ton === 'alerte' || p.ton === 'attire');
    el.classList.toggle('calme', p.ton === 'calme');
    if (p.show) el.textContent = p.texte;
  }

  // Le panneau RELIT l'état à chaque affichage. Le compte change à chaque dossier créé, archivé ou
  // reçu : un panneau qui garderait l'état lu au démarrage annoncerait un chiffre périmé — et c'est
  // un chiffre qui décide d'une facture (règle 7.1.x : « un état lu une fois au démarrage se
  // périme »). Le coût est un appel au processus principal, et rien d'autre.
  async function dessinerLicence(view, dejaLu) {
    if (!dejaLu) {
      await chargerLicence();
      // La page a pu changer pendant l'attente : on redemande l'élément APRÈS, jamais avant
      // (règle 7.6.0). Sinon on écrit dans un élément détaché, sans que rien ne s'affiche.
      return dessinerLicence(document, true);
    }
    const box = $('#lic-panel', view);
    if (!box) return;
    if (!licCab) { box.innerHTML = '<p class="muted small">Chargement…</p>'; return; }
    if (licCab.erreur) { box.innerHTML = `<div class="warn-box">${esc(licCab.erreur)}</div>`; return; }
    const c = licCab.comptage || { comptes: 0, liste: [], libres: [], raisons: {} };
    const boite = licCab.locked ? 'warn-box' : licCab.state === 'active' ? 'ok-box' : 'info-box';
    box.innerHTML = `
      <div class="${boite} mb"><b>${esc(licCab.label || '')}</b>${licCab.detail ? '<br>' + esc(licCab.detail) : ''}</div>
      <p class="small">On vend des <strong>dossiers</strong>, jamais des postes : installe SkanFact Cabinet sur autant
      d'ordinateurs que tu veux. Ce qui se compte, ce sont tes dossiers <strong>hors SkanFact</strong> —
      ceux dont le client n'a pas l'application. Les ${licCab.gratuits} premiers sont gratuits.</p>
      <div class="grid-2 mt">
        <div><div class="k-label">Comptés</div><div class="ver">${c.comptes}</div></div>
        <div><div class="k-label">Couverts</div><div class="ver">${licCab.autorises}</div></div>
      </div>
      ${c.comptes ? `<h3 class="mt">Les dossiers comptés ${info('lic.comptes')}</h3>
        <ul class="small">${c.liste.slice(0, 40).map(d => `<li>${esc(d.name || d.id)} <span class="muted">— ${esc(d.raison)}</span></li>`).join('')}</ul>`
        : `<p class="muted small mt">Aucun dossier compté pour l'instant.</p>`}
      ${Object.keys(c.raisons).length ? `<h3 class="mt">Ce qui ne compte pas</h3>
        <ul class="small">${Object.keys(c.raisons).map(r => `<li>${esc(r)} <span class="muted">— ${pl(c.raisons[r], 'dossier')}</span></li>`).join('')}</ul>` : ''}
      <h3 class="mt">Ta clé ${info('lic.cle')}</h3>
      <label class="field">${lbl('Colle ta clé ici', 'lic.cle')}<textarea id="lic-key" rows="3" spellcheck="false" placeholder="SKAN1.…">${esc(licCab.key || '')}</textarea></label>
      <div class="modal-actions">
        ${licCab.key ? '<button class="btn" id="lic-clear">Retirer la clé</button>' : ''}
        <button class="btn" id="lic-ask">Demander une licence…</button>
        <button class="btn btn-primary" id="lic-save">Enregistrer la clé</button>
      </div>
      <p class="muted small">Ce qui part dans la demande : ton <strong>empreinte</strong>, le nombre de dossiers comptés
      et la version. <strong>Jamais un nom de client</strong> — ton portefeuille ne sort pas d'ici.</p>`;

    const sv = $('#lic-save', box);
    if (sv) {
      sv.onclick = async () => {
        try {
          licCab = await api.licenceSet($('#lic-key', box).value.trim());
          majBandeauLicence(); dessinerLicence(document, true);
          toast('Licence enregistrée.');
        } catch (e) { await infoDialog('Cette clé n\'a pas été retenue', plainError(e)); }
      };
    }
    const cl = $('#lic-clear', box);
    if (cl) {
      cl.onclick = async () => {
        const ok = await confirmDialog('Retirer la clé ?',
          '<p>Tu repasses à l\'offre gratuite : trois dossiers hors SkanFact.</p><p>Rien n\'est effacé, et tout reste lisible, importable et exportable — seule la validation d\'une écriture peut attendre si tu dépasses.</p>',
          'Retirer', true);
        if (!ok) return;
        try { licCab = await api.licenceSet(''); majBandeauLicence(); dessinerLicence(document, true); toast('Clé retirée.'); }
        catch (e) { toast(plainError(e), 'error'); }
      };
    }
    const ask = $('#lic-ask', box);
    if (ask) {
      ask.onclick = async () => {
        try {
          const m = await api.licenceRequestMail();
          await api.mail({ to: 'contact@skanfact.tn', subject: m.subject, body: m.body });
        } catch (e) { await infoDialog('Impossible d\'ouvrir le message', plainError(e)); }
      };
    }
  }

  // ---------------------------------------------------------------- Réglages → Comptabilité (9.3.0)
  //
  // Trois panneaux : les touches de la grille, les guides, la correspondance des comptes. Aucun n'a
  // de valeur imposée — c'est toute la raison d'être de cet onglet. Les touches surtout : elles se
  // reprennent de l'ancien logiciel du comptable, elles ne s'inventent pas.

  const SENS = [['debit', 'Débit'], ['credit', 'Crédit']];
  let corrBrouillon = null;                 // la table en cours d'édition, tant qu'on n'a pas enregistré

  function brancherReglagesCompta(view) {
    // La capture : on APPUIE sur la touche, elle s'inscrit. Tab est une touche comme une autre ici
    // (c'est le raccourci « solder »), donc on l'intercepte aussi — sans quoi elle sortirait du
    // champ au lieu de s'y écrire. Échap rend la main sans rien changer : il faut toujours pouvoir
    // sortir d'un champ qui avale le clavier.
    $$('[data-touche]', view).forEach(inp => {
      const vue = $(`[data-vue="${inp.dataset.touche}"]`, view);
      const poser = v => { inp.value = v; if (vue) vue.innerHTML = kbd(v); };
      inp.onkeydown = ev => {
        if (ev.key === 'Escape') { inp.blur(); return; }
        // Un modificateur seul n'est pas un raccourci : on attend la touche qui l'accompagne.
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(ev.key)) { ev.preventDefault(); return; }
        ev.preventDefault();
        poser(toucheDe(ev));
      };
      inp.onfocus = () => inp.select();
    });
    $$('[data-touche-reset]', view).forEach(b => {
      b.onclick = () => {
        const k = b.dataset.toucheReset, d = K.DEFAULT_SAISIE.touches[k];
        const inp = $(`[data-touche="${k}"]`, view), vue = $(`[data-vue="${k}"]`, view);
        if (inp) inp.value = d;
        if (vue) vue.innerHTML = kbd(d);
      };
    });
    const sr = $('#sr-save', view);
    if (sr) {
      sr.onclick = async () => {
        const touches = {};
        $$('[data-touche]', view).forEach(i => { touches[i.dataset.touche] = i.value.trim() || K.DEFAULT_SAISIE.touches[i.dataset.touche]; });
        try {
          S = await api.saveCabinet({
            name: (S.cabinet || {}).name || '', email: (S.cabinet || {}).email || '', phone: (S.cabinet || {}).phone || '',
            settings: {
              saisie: {
                journalParDefaut: $('#sr-journal', view).value.trim().toUpperCase(),
                dateComplete: $('#sr-datec', view).checked,
                validerParLot: $('#sr-lot', view).checked,
                touches
              }
            }
          });
          flash($('#sr-saved', view));
        } catch (e) { toast(plainError(e), 'error'); }
      };
    }
    const ng = $('#sr-guide-new', view);
    if (ng) ng.onclick = () => guideForm(null);
    dessinerGuides(view);

    const add = $('#sr-corr-add', view);
    if (add) {
      add.onclick = () => {
        corrBrouillon = lireCorrespondance(view).concat([{ de: '', vers: '', prefixe: false }]);
        dessinerCorrespondance(view);
      };
    }
    const sv = $('#sr-corr-save', view);
    if (sv) {
      sv.onclick = async () => {
        const table = lireCorrespondance(view).filter(r => r.de || r.vers);
        const v = KC.correspondanceValide(table);
        if (!v.ok) { await infoDialog('Cette correspondance n\'entre pas', v.motifs.join('\n')); return; }
        try {
          S = await api.saveCorrespondance(table);
          corrBrouillon = null;
          dessinerCorrespondance(view);
          flash($('#sr-corr-saved', view));
        } catch (e) { toast(plainError(e), 'error'); }
      };
    }
    dessinerCorrespondance(view);
  }

  function dessinerGuides(view) {
    const box = $('#sr-guides', view);
    if (!box) return;
    const gs = (S.guides || []).slice().sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
    if (!gs.length) {
      // Un état vide qui explique le geste en prose n'est pas une interface (règle 7.0.0) : le
      // bouton qui crée est juste en dessous, et cette phrase dit à quoi ça sert, pas comment faire.
      box.innerHTML = `<div class="sa-vide">Aucun guide pour l'instant. Un guide fait gagner du temps sur les pièces qui reviennent : le loyer, les honoraires, un achat avec TVA.</div>`;
      return;
    }
    box.innerHTML = `<div class="scroll-x"><table class="list compact"><thead><tr>
        <th>Nom</th><th class="nw">Journal</th><th class="r nw">Lignes</th><th>Comptes</th><th></th></tr></thead>
      <tbody>${gs.map(g => `<tr data-g="${esc(g.id)}">
        <td>${esc(g.nom || '')}</td><td class="nw">${esc(g.journal || '')}</td>
        <td class="r nw">${(g.lignes || []).length}</td>
        <td class="muted small">${esc((g.lignes || []).map(l => l.compte).filter(Boolean).join(' · '))}</td>
        ${RowMenu.cellule('G:' + g.id, '')}</tr>`).join('')}</tbody></table></div>`;
    bindRowMenus(box, cle => {
      const g = (S.guides || []).find(x => x.id === String(cle).slice(2));
      if (!g) return [];
      return [
        { icon: 'modifier', label: 'Modifier ce guide', hint: 'Ses comptes et d\'où viennent ses montants', run: () => guideForm(g) },
        { icon: 'copier', label: 'Dupliquer ce guide', hint: 'Pour en écrire un proche sans repartir de zéro',
          run: () => guideForm({ ...g, id: '', nom: (g.nom || '') + ' (copie)' }) }
      ];
    });
  }

  // Le formulaire d'un guide. La suppression vit DEDANS, comme partout depuis la 5.2.1 : plus aucun
  // « Supprimer » en bout de ligne.
  function guideForm(guide) {
    const g = guide
      ? { ...guide, lignes: (guide.lignes || []).map(l => ({ ...l })) }
      : { id: '', nom: '', journal: '', lignes: [{ compte: '', libelle: '', sens: 'debit', base: true }, { compte: '', libelle: '', sens: 'credit', solde: true }] };
    const existe = !!(guide && guide.id && (S.guides || []).some(x => x.id === guide.id));

    const lignesHtml = () => g.lignes.map((l, i) => `<tr data-i="${i}">
      <td><input data-k="compte" value="${esc(l.compte || '')}" placeholder="607"></td>
      <td><input data-k="libelle" value="${esc(l.libelle || '')}" placeholder="Achat"></td>
      <td><select data-k="sens">${SENS.map(([v, t]) => `<option value="${v}" ${l.sens === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><input data-k="montant" class="r" value="${esc(l.montant == null ? '' : l.montant)}" placeholder="fixe"></td>
      <td><input data-k="taux" class="r" value="${esc(l.taux == null ? '' : l.taux)}" placeholder="%"></td>
      <td class="nw"><label class="check"><input type="checkbox" data-k="base" ${l.base ? 'checked' : ''}> base</label></td>
      <td class="nw"><label class="check"><input type="checkbox" data-k="solde" ${l.solde ? 'checked' : ''}> solde</label></td>
      <td class="sa-sup"><button type="button" class="btn btn-sm" data-sup="${i}" aria-label="Retirer cette ligne">✕</button></td>
    </tr>`).join('');

    modal(
      `<h2>${existe ? 'Modifier le guide' : 'Nouveau guide'}</h2>
       <div class="grid-2">
         <label class="field obligatoire">Nom<input type="text" id="g-nom" value="${esc(g.nom || '')}" placeholder="Achat avec TVA 19 %"></label>
         <label class="field narrow obligatoire">Journal<input type="text" id="g-journal" maxlength="5" value="${esc(g.journal || '')}" placeholder="AC"></label>
       </div>
       <h3 class="mt">Les lignes ${info('sa.guideLigne')}</h3>
       <div class="scroll-x"><table class="list compact sa-table"><thead><tr>
         <th class="nw">Compte</th><th>Libellé</th><th class="nw">Sens</th><th class="r nw">Montant</th>
         <th class="r nw">Taux</th><th class="nw"></th><th class="nw"></th><th></th></tr></thead>
       <tbody id="g-lignes">${lignesHtml()}</tbody></table></div>
       <div class="modal-actions" style="justify-content:flex-start"><button type="button" class="btn btn-sm" id="g-add">Ajouter une ligne</button></div>
       <p class="muted small">« base » = le montant que tu tapes. « taux » = un pourcentage de ce montant. « solde » = ce qu'il manque pour que la pièce tombe juste — une seule ligne peut le porter.</p>
       <div class="modal-actions">
         ${existe ? '<button class="btn btn-danger" id="g-sup">Supprimer ce guide</button>' : ''}
         <button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (layer, close) => {
        const corps = $('#g-lignes', layer);
        const relire = () => {
          $$('tr[data-i]', corps).forEach(tr => {
            const i = Number(tr.dataset.i);
            $$('[data-k]', tr).forEach(f => {
              g.lignes[i][f.dataset.k] = f.type === 'checkbox' ? f.checked : f.value;
            });
          });
        };
        const redessiner = () => { corps.innerHTML = lignesHtml(); brancher(); };
        function brancher() {
          $$('[data-k]', corps).forEach(f => { f.onchange = relire; });
          $$('[data-sup]', corps).forEach(b => {
            b.onclick = () => { relire(); g.lignes.splice(Number(b.dataset.sup), 1); redessiner(); };
          });
        }
        brancher();
        $('#g-add', layer).onclick = () => { relire(); g.lignes.push({ compte: '', libelle: '', sens: 'debit' }); redessiner(); };
        $('#no', layer).onclick = close;
        const sup = $('#g-sup', layer);
        if (sup) {
          sup.onclick = async () => {
            const ok = await confirmDialog('Supprimer ce guide ?',
              `<p>« ${esc(g.nom)} » ne sera plus proposé dans la grille.</p><p>Les écritures qu'il a déjà produites ne bougent pas : un guide ne laisse aucun lien derrière lui, il préremplit et s'efface.</p>`,
              'Supprimer', true);
            if (!ok) return;
            try {
              S = await api.saveGuides((S.guides || []).filter(x => x.id !== g.id));
              close(); dessinerGuides(document); toast('Guide supprimé.');
            } catch (e) { toast(plainError(e), 'error'); }
          };
        }
        $('#ok', layer).onclick = async () => {
          relire();
          g.nom = $('#g-nom', layer).value.trim();
          g.journal = $('#g-journal', layer).value.trim().toUpperCase();
          const v = KC.guideValide(g);
          if (!v.ok) {
            if (/nom/i.test(v.motif)) return refus($('#g-nom', layer), v.motif);
            if (/journal/i.test(v.motif)) return refus($('#g-journal', layer), v.motif);
            await infoDialog('Ce guide n\'entre pas', v.motifs.join('\n'));
            return;
          }
          if (!g.id) g.id = 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
          const autres = (S.guides || []).filter(x => x.id !== g.id);
          try {
            S = await api.saveGuides(autres.concat([g]));
            close(); dessinerGuides(document); toast(existe ? 'Guide modifié.' : 'Guide créé.');
          } catch (e) { toast(plainError(e), 'error'); }
        };
      }
    );
  }

  const lireCorrespondance = view => $$('#sr-corr tr[data-c]', view).map(tr => ({
    de: $('[data-k=de]', tr).value.trim(),
    vers: $('[data-k=vers]', tr).value.trim(),
    prefixe: $('[data-k=prefixe]', tr).checked
  }));

  function dessinerCorrespondance(view) {
    const box = $('#sr-corr', view);
    if (!box) return;
    const table = corrBrouillon || (S.correspondance || []);
    box.innerHTML = !table.length
      ? `<div class="sa-vide">Aucune correspondance. Tant qu'il n'y en a pas, les comptes de tes clients entrent tels quels — ce qui est le bon réglage si ton plan est le leur.</div>`
      : `<div class="scroll-x"><table class="list compact sa-table"><thead><tr>
          <th class="nw">Compte du client</th><th class="nw">Compte du cabinet</th><th class="nw">Toute la famille</th><th></th></tr></thead>
        <tbody>${table.map((r, i) => `<tr data-c="${i}">
          <td><input data-k="de" value="${esc(r.de || '')}" placeholder="411"></td>
          <td><input data-k="vers" value="${esc(r.vers || '')}" placeholder="3411"></td>
          <td><label class="check"><input type="checkbox" data-k="prefixe" ${r.prefixe ? 'checked' : ''}> préfixe</label></td>
          <td class="sa-sup"><button type="button" class="btn btn-sm" data-cs="${i}" aria-label="Retirer cette correspondance">✕</button></td>
        </tr>`).join('')}</tbody></table></div>`;
    $$('[data-cs]', box).forEach(b => {
      b.onclick = () => {
        const t = lireCorrespondance(view);
        t.splice(Number(b.dataset.cs), 1);
        corrBrouillon = t;
        dessinerCorrespondance(view);
      };
    });
  }

  const REG_TABS = [['cabinet', 'Mon cabinet'], ['compta', 'Comptabilité'], ['donnees', 'Données et sécurité'], ['app', 'L\'application']];

  // Une seule table pour TROIS choses qui, écrites à trois endroits, divergent toujours : le titre du
  // panneau, les mots que sa recherche connaît sans qu'ils soient à l'écran, et son entrée de palette
  // Cmd+K. Même mécanique que SETTINGS_PANNEAUX côté entreprise, et pour la même raison : là-bas, six
  // alias écrits à la main ont nommé des onglets disparus et la palette n'a plus rien rendu.
  const REG_PANNEAUX = {
    'pan-cabinet': { onglet: 'cabinet', titre: 'Ton cabinet', mots: 'cabinet nom email telephone jour relance tva cnss depot echeance' },
    'pan-appairage': { onglet: 'cabinet', titre: 'Le fichier à remettre à tes clients', mots: 'appairage fichier client empreinte cle publique chiffrer skanpair' },
    'pan-licence': { onglet: 'cabinet', titre: 'Licence', mots: 'licence cle payer prix dossiers hors skanfact quota gratuit acheter abonnement facture' },
    'pan-saisie': { onglet: 'compta', titre: 'La grille de saisie', mots: 'saisie clavier touches raccourci solder recopier dupliquer journal date kilometre grille brouillard validation' },
    'pan-guides': { onglet: 'compta', titre: 'Guides d\'écritures', mots: 'guide modele ecriture type loyer salaire achat tva honoraires steg prerempli abonnement recurrent' },
    'pan-comptes': { onglet: 'compta', titre: 'Correspondance des comptes', mots: 'correspondance compte plan client cabinet traduire import export numero prefixe' },
    'pan-inbox': { onglet: 'donnees', titre: 'Boîte de réception', mots: 'boite reception dossier surveille paquets arrives import mail' },
    'pan-backup': { onglet: 'donnees', titre: 'Sauvegardes', mots: 'sauvegarde restaurer copie externe usb icloud filet perdu' },
    'pan-secu': { onglet: 'donnees', titre: 'Sécurité', mots: 'securite mot de passe cle de secours verrouiller chiffrement empreinte' },
    'pan-theme': { onglet: 'app', titre: 'Apparence', mots: 'theme apparence sombre clair nuit dark mode couleur fond ecran yeux' },
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
          <label class="field narrow">${lbl('Jour de relance', 'cab.relanceDay')}
                <span class="suffixe"><span class="suffixe-av">le</span><input type="number" id="c-day" min="1" max="28" value="${Number((S.settings || {}).relanceDay) || 10}"><span class="suffixe-ap">de chaque mois</span></span></label>
          <label class="field narrow">${lbl('TVA : jour de dépôt', 'ec.jours')}<input type="number" id="c-tvaday" min="1" max="31" value="${K.deadlineSettings(S).tvaDay}"></label>
          <label class="field narrow">${lbl('CNSS : jour de dépôt', 'ec.jours')}<input type="number" id="c-cnssday" min="1" max="31" value="${K.deadlineSettings(S).cnssDay}"></label>
        </div>
        <p class="muted small">Les jours de dépôt alimentent la page <a href="#/echeances">Échéances</a>.
        <strong>À VÉRIFIER</strong> : ils dépendent de la forme juridique, du régime et de la loi de finances.</p>
        <p class="muted small mt">Ce nom apparaît en bas des relances que tu envoies et dans le fichier d'appairage remis à tes clients.</p>
        <div class="modal-actions"><span class="saved" id="c-saved" hidden></span><button class="btn btn-primary" id="c-save">Enregistrer mon cabinet</button></div>
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

      ${panneauReg('pan-licence', info('lic.cab'))}
        <div id="lic-panel"><p class="muted small">Chargement…</p></div>
      </div>

      </section>

      <section data-pane="compta"${reglagesTab === 'compta' ? '' : ' hidden'}>
      ${panneauReg('pan-saisie')}
        <p class="small">La grille de saisie vit dans la fiche d'un client, onglet <strong>Comptabilité → Saisie</strong>.
        Ce qui se règle ici vaut pour tous tes dossiers.</p>
        ${/* Le champ n'est plus `narrow` : son propre texte d'invite (« le dernier utilisé ») y était
              coupé au milieu. Un champ trop étroit pour ce qu'il affiche lui-même est un champ qu'on
              ne peut pas relire. Et les deux cases sont ensemble, alignées à gauche comme tout le
              reste du panneau — l'une d'elles flottait seule à droite de la grille. */''}
        <div class="grid-2">
          ${/* Une liste fermée ne se saisit jamais en texte libre (7.30.0) : un journal tapé de
                travers — « VTE » au lieu de « VT » — ne correspond à aucun journal, et la grille
                s'ouvre alors sur le premier venu sans un mot. « Le dernier utilisé » est la
                première option, parce que c'est le bon défaut et non un vide à remplir. */''}
          <label class="field narrow">${lbl('Journal proposé', 'sa.journalDefaut')}
            <select id="sr-journal">
              <option value="">le dernier utilisé</option>
              ${journauxConnus().map(j => `<option value="${esc(j)}" ${((S.settings || {}).saisie || {}).journalParDefaut === j ? 'selected' : ''}>${esc(j)}</option>`).join('')}
            </select></label>
          ${/* La case vient AVANT son libellé, comme les cinq autres de l'application. Dans une
                grille `span-2`, l'écrire après la posait 500 px à droite du texte qu'elle coche :
                l'œil la cherche à gauche et ne la trouve pas. */''}
          <label class="check span-2">
            <input type="checkbox" id="sr-datec" ${((S.settings || {}).saisie || {}).dateComplete !== false ? 'checked' : ''}>
            ${lbl('Écrire la date complète', 'sa.dateComplete')}</label>
          <label class="check span-2">
            <input type="checkbox" id="sr-lot" ${((S.settings || {}).saisie || {}).validerParLot !== false ? 'checked' : ''}>
            ${lbl('Proposer « valider tout le journal du mois »', 'sa.validerLot')}</label>
        </div>
        <h3 class="mt">${lbl('Les touches', 'sa.touches')}</h3>
        <p class="muted small">Clique dans le champ et <strong>appuie sur la touche</strong> que tu veux utiliser — elle s'inscrit toute seule. Échap pour ressortir sans rien changer.</p>
        ${/* Chaque touche porte SA bulle : « Solder la pièce » ne dit pas ce que le geste fait, et
              c'est précisément ce qu'on veut savoir avant de lui donner une touche. */''}
        <div class="grid-2">
          ${/* Chacune est écrite en toutes lettres plutôt que produite par une boucle : la clé de la
                bulle doit être LITTÉRALE et en dernier argument, c'est ainsi qu'un test relit
                l'interface pour vérifier qu'aucun texte d'aide ne meurt oublié. */''}
          ${champTouche('ligneSuivante', 'Ligne suivante', 'sa.kSuivante')}
          ${champTouche('solder', 'Solder la pièce', 'sa.kSolder')}
          ${champTouche('recopier', 'Recopier la ligne du dessus', 'sa.kRecopier')}
          ${champTouche('dupliquer', 'Dupliquer la pièce', 'sa.kDupliquer')}
          ${champTouche('valider', 'Enregistrer et valider', 'sa.kValider')}
        </div>
        <div class="modal-actions"><span class="saved" id="sr-saved" hidden></span><button class="btn btn-primary" id="sr-save">Enregistrer la grille de saisie</button></div>
      </div>

      ${panneauReg('pan-guides', info('sa.guides'))}
        <p class="small">Un guide préremplit une pièce : un journal, des comptes, et d'où vient chaque montant.
        Il n'écrit rien tout seul — après le clic, tout reste modifiable.</p>
        <div id="sr-guides"></div>
        <div class="modal-actions"><button class="btn btn-primary" id="sr-guide-new">Nouveau guide…</button></div>
      </div>

      ${panneauReg('pan-comptes', info('sa.correspondance'))}
        <p class="small">Traduire les comptes de tes clients vers les tiens, <strong>à l'import et à l'export</strong>.
        Une écriture déjà validée n'est jamais réécrite : elle porte le compte sous lequel tu l'as validée.</p>
        <div id="sr-corr"></div>
        <div class="sous-table"><button class="btn btn-sm" id="sr-corr-add">Ajouter une ligne</button></div>
        <div class="modal-actions"><span class="saved" id="sr-corr-saved" hidden></span><button class="btn btn-primary" id="sr-corr-save">Enregistrer la correspondance</button></div>
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
      ${panneauReg('pan-theme')}
        <p class="small">Un logiciel de comptabilité s'ouvre le matin et se referme le soir : sur un écran
        réglé en sombre, une fenêtre blanche fatigue au bout d'une heure.</p>
        <div class="theme-choix" role="radiogroup" aria-label="Le thème de l'application">
          ${[['auto', 'Comme le système', 'suit le réglage de ton ordinateur'],
            ['light', 'Clair', 'toujours clair'],
            ['dark', 'Sombre', 'toujours sombre']].map(([v, t, sub]) => `
            <label class="theme-op${themeCourant() === v ? ' on' : ''}">
              <input type="radio" name="theme" value="${v}" ${themeCourant() === v ? 'checked' : ''}>
              <span class="theme-ap" data-ap="${v}" aria-hidden="true"><i></i><b></b></span>
              <span class="theme-t">${esc(t)}</span>
              <span class="theme-s">${esc(sub)}</span>
            </label>`).join('')}
        </div>
      </div>

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
    // Le thème s'applique AVANT d'être enregistré : on choisit une apparence en la voyant, pas en
    // cliquant « Enregistrer » puis en attendant. Si l'écriture échoue, on remet ce qui était là —
    // une apparence appliquée que le disque ne porte pas reviendrait au prochain démarrage.
    $$('input[name=theme]', view).forEach(r => {
      r.onchange = async () => {
        const avant = themeCourant();
        S = { ...S, settings: { ...(S.settings || {}), theme: r.value } };
        appliquerTheme();
        try {
          S = await api.saveCabinet({ ...S.cabinet, settings: { theme: r.value } });
          $$('.theme-op', view).forEach(l => l.classList.toggle('on', l.querySelector('input').value === r.value));
        } catch (e) {
          S = { ...S, settings: { ...(S.settings || {}), theme: avant } };
          appliquerTheme();
          toast(plainError(e), 'error');
        }
      };
    });
    brancherReglagesCompta(view);
    dessinerLicence(view);
    bindRecoveryBanner(view);
    if ($('#r-demo-on')) $('#r-demo-on').onclick = async () => {
      S = await chargerOuRetirerExemple(true); toast('Exemple chargé : ces cinq dossiers sont fictifs.'); location.hash = '#/dossiers';
    };
    if ($('#r-demo-off')) $('#r-demo-off').onclick = async () => { S = await chargerOuRetirerExemple(false); render(); toast('Exemple effacé.'); };
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
        <td>${esc(x.daily ? 'Quotidienne' : x.name.replace(/-\d{4}-\d{2}-\d{2}_.*$/, '').replace(/_/g, ' '))}
          <span class="muted small">${x.livres ? '· avec les livres' : '· sans les livres'}</span></td>
        <td class="nw">${esc(fmtWhen(x.mtime))} <span class="muted small">${esc(ago(x.mtime))}</span></td>
        <td class="r muted nw">${esc(fmtBytes(x.size + (x.livresSize || 0)))}</td>
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
    // 9.4.4 — l'avertissement est juste, le MOMENT ne l'était pas. Le tout premier écran d'un
    // comptable, avant qu'il ait un seul client, était un bandeau rouge : un premier contact qui
    // menace, et un rouge permanent dès le jour 0 apprend à ignorer le rouge. Tant qu'aucun paquet
    // n'est arrivé, il n'y a rien à perdre — c'est la règle « un filet se réclame au moment où il
    // protège encore » (QUESTIONS.md), prise par l'autre bout. Le rouge apparaît au premier paquet,
    // c'est-à-dire le jour où quelque chose d'irremplaçable est sur ce disque.
    const recus = (S.dossiers || []).reduce((n, d) => n + ((d.packs || []).length), 0);
    if (!recus) {
      return `<div class="banner"><span><strong>Pense à enregistrer ta clé de secours.</strong>
        C'est elle qui te rendra tes paquets si tu changes d'ordinateur ou si celui-ci est perdu.
        Trois minutes, une fois pour toutes.</span>
        <button class="btn btn-sm nw" id="rec-go">Enregistrer ma clé…</button></div>`;
    }
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
       <tr><td>Paquets</td><td class="r">${peek.paquets}</td><td class="r">${peek.actuels.paquets}</td></tr>
       <tr><td>Livres (écritures du cabinet)</td><td class="r">${peek.livres == null ? '<span class="muted">aucun</span>' : peek.livres}</td><td class="r">${peek.actuels.livres || 0}</td></tr></tbody></table>
       ${dd > 0 || dp > 0 ? `<p class="warn-box mt">Tu perdrais <strong>${dd > 0 ? pl(dd, 'dossier') : ''}${dd > 0 && dp > 0 ? ' et ' : ''}${dp > 0 ? pl(dp, 'paquet') : ''}</strong> enregistrés depuis.</p>` : ''}
       ${/* Une restauration dit d'abord ce qu'elle ne rendra PAS (T-35) : une quotidienne, ou une
             sauvegarde d'avant la 9.8.8, ne porte pas les livres. Ils resteront tels qu'ils sont —
             ni rendus, ni détruits — et c'est écrit avant le clic. */''}
       ${peek.livres == null && peek.actuels.livres
         ? `<p class="warn-box mt">Cette sauvegarde <strong>ne porte pas les livres</strong> (${pl(peek.actuels.livres, 'livre')} aujourd'hui) : ils resteront tels qu'ils sont. Seules les sauvegardes nommées prises depuis la 9.8.8 les emportent.</p>`
         : peek.livres != null ? `<p class="small">Les ${pl(peek.livres, 'livre')} de la sauvegarde remplaceront ceux d'aujourd'hui qui portent le même nom.</p>` : ''}
       <p class="muted small">Une sauvegarde de l'état actuel, livres compris, est prise juste avant : tu pourras revenir en arrière.</p>`,
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
            ${/* Le compte se DÉDUIT : la phrase annonçait « Quatre écrans » et l'assistant en comptait
                  cinq, juste au-dessus de cinq pastilles qui les montraient. Une phrase affichée que
                  rien ne tient est un bug (7.3.0), et celle-ci se démentait toute seule à l'écran. */''}
            <p class="muted small mt">${esc(['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six'][etapes.length] || etapes.length)} écrans,
            deux minutes. Tu pourras tout changer ensuite dans Réglages.</p>`,
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
              <label class="field narrow">${lbl('Jour de relance', 'cab.relanceDay')}
                <span class="suffixe"><span class="suffixe-av">le</span><input type="number" id="w-day" min="1" max="28" value="${Number((S.settings || {}).relanceDay) || 10}"><span class="suffixe-ap">de chaque mois</span></span></label>
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
          ${/* Cinq pastilles muettes disent qu'il y a plusieurs écrans ; elles ne disent pas
                combien il en reste. Le chiffre est à côté, et il se DÉDUIT du nombre d'écrans —
                écrit à la main, il mentirait au premier écran ajouté (défaut corrigé en 9.4.2 sur
                la phrase du même assistant). */''}
          <div class="wiz-dots"><span class="wiz-compte">Écran ${etape + 1} sur ${etapes.length}</span>
            ${etapes.map((_, i) => `<span class="${i === etape ? 'on' : i < etape ? 'done' : ''}"></span>`).join('')}</div>
          <h1>${esc(e.t)}</h1>
          <div class="wiz-body">${e.html()}</div>
          <div class="wiz-actions">
            ${etape > 0 ? '<button class="btn" id="w-back">← Retour</button>' : ''}
            <span class="grow"></span>
            ${etape < etapes.length - 1 ? '<button class="btn btn-ghost" id="w-skip">Passer</button>' : ''}
            <button class="btn btn-primary" id="w-next">${etape === etapes.length - 1 ? 'Commencer' : 'Continuer'}</button>
          </div></div>`;
        if (e.mount) e.mount();
        typographie(el);
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
      <button class="btn btn-sm" id="u-token-save">Enregistrer le jeton</button>${a.hasToken ? '<button class="btn btn-sm btn-ghost" id="u-token-clear">Retirer</button>' : ''}</div>
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
