/* SkanFact — interface (JS pur, sans framework) */
(function () {
  const C = window.SkanCore;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const h = C.escapeHtml;

  // La touche de raccourci porte deux noms selon la machine. L'application écrivait tantôt « Cmd+K »,
  // tantôt « Cmd/Ctrl+K » : le premier est faux sur Windows, le second demande à l'utilisateur de
  // faire le tri lui-même. On décide une fois pour toutes, ici.
  const SUR_MAC = /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent || '');
  const MOD = SUR_MAC ? 'Cmd' : 'Ctrl';

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
    peekBackup: async () => ({ ok: false, error: 'indisponible' }), restoreBackup: async () => ({ ok: false, error: 'indisponible' }),
    pickLogo: async () => null,
    exportPdf: async (html) => { const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print(); return null; },
    exportPdfMany: async () => null, saveText: async () => null, exportPdfSilent: async () => null, saveTextSilent: async () => null, composeMail: async () => ({ state: 'mailto' }),
    openPath: async () => {}, showInFolder: async () => {}, setDirty: () => {},
    changelog: async () => '', onMenuAction: () => {}, setTitle: () => {},
    onAlivePing: () => {}, onFreezeNotice: () => {}, supportInfo: async () => ({ version: 'dev', platform: 'browser', log: '', lines: 0 }), openLog: async () => {},
    updateVersion: async () => ({ version: 'dev', packaged: false, platform: 'browser', macSigned: false }),
    updateCheck: async () => ({ state: 'dev' }), updateDownload: async () => ({ state: 'dev' }), updateInstall: async () => ({ state: 'dev' }), updateSetToken: async () => ({ hasToken: false }),
    updateOpenReleases: async () => {},
    licenceStatus: async () => ({ state: 'libre', locked: false, label: 'Licence non requise', detail: '' }),
    licenceSet: async () => ({ state: 'libre', locked: false, label: 'Licence non requise', detail: '' }),
    licenceMail: async () => ({ subject: 'Demande de licence SkanFact', body: '' }),
    onUpdateEvent: () => {}
  };

  // ---------- état ----------
  // Licence (6.4.0). `locked` ne bloque QUE la création de nouvelles pièces : lire, imprimer,
  // exporter, sauvegarder et envoyer le paquet au comptable restent toujours possibles. Une licence
  // expirée ne prend pas les données en otage — c'est écrit dans l'app et dans l'aide.
  let licence = { state: 'libre', locked: false, label: '', detail: '' };
  // À qui s'adresse une demande de licence. Une seule ligne à changer le jour où ce sera une adresse
  // de société plutôt qu'une adresse personnelle.
  const LICENCE_CONTACT = 'licences@skanfact.tn';
  let data = null;
  let saveTimer = null;
  const unlockedIds = new Set(); // factures émises déverrouillées « quand même » pour la session
  const security = { encrypted: false };
  // Aperçu masqué (petit écran) : préférence gardée d'une session à l'autre
  let previewHidden = false;
  try { previewHidden = localStorage.getItem('skanfact.preview') === '0'; } catch (_) {}
  let settingsTab = 'societe';   // onglet ouvert dans Paramètres
  // Un lien qui promet un réglage précis doit y arriver, pas en haut d'une pile de six panneaux.
  // `settingsFocus` porte l'identifiant du panneau visé ; il est consommé une seule fois.
  let settingsFocus = '';
  function allerParametres(tab, focus) { settingsTab = tab || 'societe'; settingsFocus = focus || ''; navigate('#/parametres'); }
  // La même idée, pour n'importe quelle page : « n attestations à réclamer » déposait tout en haut de
  // Comptabilité → Ventes, trois écrans au-dessus du panneau qui les liste. Le routeur consomme
  // `pageFocus` APRÈS le rendu de la page, une seule fois.
  let pageFocus = '';
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

  // Le message est prêt, mais sans adresse il faudra la taper à la main à chaque envoi. Un bandeau
  // qui nomme « Paramètres » sans y mener laisse chercher dans sept onglets.
  async function emailComptablePret(adresse) {
    if (adresse) return toast('Message préparé pour le comptable');
    const c = await choiceDialog('Message préparé', 'L\'adresse de ton comptable n\'est pas enregistrée : le message s\'ouvre sans destinataire. Si tu la renseignes une fois, tous les envois suivants la reprendront.',
      'Renseigner son email…', 'Plus tard');
    if (c === 'a') allerParametres('emails', 'p-comptable');
  }

  async function lockNow() {
    // Un refus dit trois choses : ce qui est refusé, pourquoi, et le bouton qui débloque. Celui-ci
    // était un bandeau de 2,6 s qui nommait en plus un onglet inexistant (« Sécurité »).
    if (!security.encrypted) {
      const c = await choiceDialog('Rien à verrouiller pour l\'instant',
        'Le verrouillage demande un mot de passe à l\'ouverture de l\'application. Tu n\'en as pas encore : le fichier de données est en clair sur ce disque.',
        'Activer un mot de passe…', 'Plus tard');
      if (c === 'a') allerParametres('donnees', 'p-motdepasse');
      return;
    }
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

  // Enregistrement. Si un autre poste a écrit dans le dossier partagé entre-temps, le stockage
  // REFUSE d'écraser et nous rend sa version : on fusionne pièce par pièce, on réécrit, et on dit
  // clairement ce qui s'est passé. Voir core.mergeData — rien n'est jamais perdu en silence.
  let merging = false;
  // Les compteurs de modules au dernier enregistrement. Ils servent de référence pour savoir si on
  // vient d'ENREGISTRER quelque chose dans un module masqué — auquel cas il revient dans le menu.
  // Sans cette référence, le simple fait d'être plein rallumerait le module, et la case à cocher de
  // « Tous les modules » redeviendrait le piège qu'elle était (voir `moduleOn` dans core.js).
  let comptesModules = null;
  function rappelerModules() {
    const avant = comptesModules;
    comptesModules = C.moduleCounts(data);
    if (!avant) return;
    const revenus = C.modulesRevenus(data, avant);
    if (!revenus.length) return;
    const liste = company().modules.slice().concat(revenus);
    company().modules = liste;
    comptesModules = C.moduleCounts(data);
    drawNav();
    const noms = revenus.map(id => C.moduleById(id).label);
    toast(`${C.liste(noms)} ${revenus.length > 1 ? 'reviennent' : 'revient'} dans ton menu : tu viens d'y enregistrer quelque chose.`);
  }

  function save(immediate) {
    try { window.__data = data; } catch (_) {}   // visible depuis les tests de bout en bout
    rappelerModules();
    clearTimeout(saveTimer);
    const doSave = () => bridge.saveData(data)
      .then(r => { if (r && r.conflict) return resolveConflict(r); })
      .catch(e => toast('Erreur de sauvegarde : ' + e.message, true));
    if (immediate) return doSave();
    saveTimer = setTimeout(doSave, 300);
  }

  async function resolveConflict(r) {
    if (merging) return;                       // une fusion à la fois, sinon on tourne en rond
    merging = true;
    try {
      const m = C.mergeData(data, r.disk);
      data = m.data;
      const w = await bridge.saveData(data, true);
      if (w && w.conflict) { toast('Enregistrement impossible : le dossier partagé bouge en permanence. Attends que l\'autre poste ait fini.', true); return; }
      try { window.__data = data; window.__lastMerge = m; } catch (_) {}
      render();
      reportMerge(m, r.disk);
    } finally { merging = false; }
  }

  // Ce qu'on dit à l'utilisateur après une fusion. Silencieux quand il n'y a rien à signaler,
  // insistant quand deux numéros de facture se retrouvent en double — ça, il doit le corriger.
  function reportMerge(m, disk) {
    const who = (disk && disk.syncDeviceName) || 'l\'autre poste';
    if (m.counts.duplicates || m.counts.conflicts) {
      modal(`<h2>${m.counts.duplicates ? 'Attention : numéros en double' : 'Modifications des deux côtés'}</h2>
        <p class="small">Les modifications de <strong>${h(who)}</strong> ont été reprises et ton travail a été conservé.
        ${m.counts.added ? `${m.counts.added} pièce(s) venaient de l'autre poste.` : ''}</p>
        ${m.counts.duplicates ? `<div class="panel" style="margin:12px 0;border-color:var(--danger)">
          <h2 style="color:var(--danger)">${m.counts.duplicates} numéro(s) attribué(s) deux fois</h2>
          <p class="small">Vous avez émis ces pièces chacun de votre côté, sans voir le travail de l'autre. Deux documents ne peuvent pas porter le même numéro : il faut en annuler un par un avoir et le réémettre.</p>
          <ul class="small">${m.duplicates.map(d => `<li><strong>${h(d.label)}</strong></li>`).join('')}</ul>
          <p class="small muted">Pour que ça n'arrive plus : n'émettez pas de factures en même temps, ou mettez-vous d'accord sur qui émet.</p>
        </div>` : ''}
        ${m.counts.conflicts ? `<div class="panel" style="margin:12px 0">
          <h2>${m.counts.conflicts} pièce(s) modifiée(s) des deux côtés</h2>
          <p class="small">La version du fichier enregistré en dernier (<strong>${h(m.keptFrom)}</strong>) a été gardée. L'autre version n'est pas détruite : elle est conservée dans tes données et ton comptable peut la retrouver si besoin.</p>
          <ul class="small">${m.conflicts.slice(0, 12).map(c => `<li>${h(c.label)} <span class="muted">(${h(C.LIST_LABELS[c.kind] || c.kind)})</span></li>`).join('')}</ul>
        </div>` : ''}
        <div class="modal-actions"><button class="btn btn-primary" data-close>J'ai compris</button></div>`);
    } else if (m.counts.added) {
      toast(`${m.counts.added} nouveauté(s) reprise(s) de ${who}`);
    }
  }

  // Remplacer toutes les données efface aussi les périodes clôturées. On ne l'interdit pas — c'est un
  // geste volontaire — mais on prévient : le dossier que le comptable a reçu ne correspondra plus.
  async function closedWipeOk(what) {
    const c = C.closedUntil(data);
    if (!c) return true;
    return await confirmDialog(`${what}\n\nTes données sont clôturées jusqu'au ${C.fmtDate(c)}. Ce que ton comptable a déjà reçu ne correspondra plus à ce que contient l'application. Une sauvegarde de l'état actuel est prise avant.`, 'Continuer quand même');
  }

  // ---------- garde-fou de clôture (6.0.0) ----------
  // Une seule porte pour toute l'application. On lui donne la ou les dates concernées ; si l'une
  // d'elles tombe dans une période clôturée, elle explique et refuse. Deux dates quand on MODIFIE
  // une pièce : l'ancienne et la nouvelle — sortir une facture d'un mois clos est aussi interdit
  // que d'y en entrer une, sinon il suffirait de changer la date pour contourner la clôture.
  function closedBlock(dates, what) {
    const list = (Array.isArray(dates) ? dates : [dates]).filter(Boolean);
    const hit = list.find(d => C.isClosedDate(data, d));
    if (!hit) return false;
    const until = C.closedUntil(data);
    modal(`<h2>Période clôturée</h2>
      <p>${h(what)} porte la date du <strong>${C.fmtDate(hit)}</strong>, dans <strong>${h(C.closedPeriodLabel(data, hit))}</strong> — une période clôturée jusqu'au ${C.fmtDate(until)}.</p>
      <p class="small">Ce qui est clôturé a été transmis à ton comptable et ne doit plus bouger. Deux façons d'avancer :</p>
      <ul class="small">
        <li><strong>Sans toucher au passé</strong> — refais la pièce à la date d'aujourd'hui. Pour corriger une facture déjà émise, c'est un avoir.</li>
        <li><strong>En rouvrant la période</strong> — Comptabilité → Clôtures, avec un motif. Préviens ton comptable : les chiffres qu'il a reçus vont changer.</li>
      </ul>
      <div class="modal-actions"><button class="btn" data-close>Compris</button><button class="btn btn-primary" id="go-clot">Aller aux clôtures</button></div>`,
      (root, close) => { $('#go-clot', root).onclick = () => { close(); comptaState.tab = 'clotures'; navigate('#/compta'); }; });
    return true;
  }

  // Le garde-fou de la licence (6.4.0). Une seule porte, comme closedBlock : elle ne barre que la
  // création de nouvelles pièces. Tout le reste — lire, imprimer, exporter, sauvegarder, envoyer le
  // paquet au comptable — reste ouvert, et la fenêtre le dit noir sur blanc.
  function licenceBlock(what) {
    if (!licence.locked) return false;
    modal(`<h2>${h(licence.label)}</h2>
      <p>${h(what)} : il faut une licence en cours de validité.</p>
      <p class="small">${h(licence.detail)}</p>
      <ul class="small">
        <li><strong>Tes données restent les tiennes</strong> : tu peux tout lire, imprimer, exporter et envoyer à ton comptable, aujourd'hui comme dans dix ans.</li>
        <li>Seule la création de nouvelles pièces attend la licence.</li>
      </ul>
      <div class="modal-actions"><button class="btn" data-close>Plus tard</button><button class="btn btn-primary" id="go-lic">Voir ma licence</button></div>`,
      (root, close) => { $('#go-lic', root).onclick = () => { close(); allerParametres('licence', 'p-licence'); }; });
    return true;
  }

  // `closedToast` existait pour les « cas où un simple message suffit ». Il n'y en avait pas :
  // c'était le MÊME refus que `closedBlock`, dit deux fois de deux façons. Depuis un formulaire, une
  // fenêtre avec un bouton « Aller aux clôtures » ; depuis une ligne de liste, un bandeau noir de
  // deux secondes et demie en bas de l'écran, qui nommait l'endroit sans y mener et disparaissait
  // avant qu'on ait fini de le lire. Un refus se dit d'une seule façon, et il porte sa sortie.
  const closedToast = (dates, what) => closedBlock(dates, what);

  // Refuser une saisie en MONTRANT ce qui ne va pas. Trois gestes, toujours les mêmes : on amène le
  // champ à l'écran, on y met le curseur, on le marque en rouge le temps qu'il soit corrigé. Sans ça,
  // le message dit « ajoute une désignation » et on cherche laquelle parmi huit lignes.
  // Renvoie toujours `false` : les validateurs s'écrivent `return refus(...)`.
  function refus(selecteur, message) {
    toast(message, true);
    const el = $(selecteur);
    if (el) {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { el.scrollIntoView(); }
      // Un `<input type=hidden>` (combo, date) ne se focalise pas : on marque son enveloppe visible.
      const cible = el.type === 'hidden' ? (el.closest('.combo') || el.closest('.datefield') || el) : el;
      try { cible.focus({ preventScroll: true }); } catch (_) {}
      const marque = cible.closest('.field') || cible;
      marque.classList.add('champ-faute');
      // Le rouge s'efface dès qu'on touche au champ : le laisser serait accuser quelqu'un qui a
      // déjà corrigé.
      const nettoyer = () => marque.classList.remove('champ-faute');
      marque.addEventListener('input', nettoyer, { once: true });
      marque.addEventListener('change', nettoyer, { once: true });
      setTimeout(nettoyer, 6000);
    }
    return false;
  }

  // Le nom du poste, tel que le stockage l'estampille à chaque écriture (3.2.0). Il sert à dire QUI
  // a clôturé ou rouvert une période : sur un dossier partagé, c'est la première question posée.
  function deviceLabel() { return (data && data.syncDeviceName) || 'cet ordinateur'; }
  // Une erreur venue du processus principal arrive habillée : « Error invoking remote method 'x:y':
  // Error: … ». Ce préambule n'apprend rien à personne ; on ne garde que la phrase écrite pour
  // l'utilisateur.
  function plainError(e) {
    const m = String((e && e.message) || e || '');
    return m.replace(/^Error invoking remote method '[^']*':\s*/, '').replace(/^Error:\s*/, '').trim() || 'Erreur inattendue';
  }

  // Mémoire des suppressions : sans elle, une pièce supprimée ici reviendrait à la fusion suivante,
  // renvoyée par le poste qui ne l'a pas encore vue disparaître.
  function forget(kind, id, label) { C.trackDeletion(data, kind, id, label); }

  const migrate = d => { const m = C.migrateData(d); try { window.__data = m; } catch (_) {} return m; };
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
  // L'éditeur ouvert publie ici sa fonction « aperçu en grand », pour que le raccourci clavier et le
  // menu Affichage puissent l'appeler. `null` ailleurs : le raccourci le dit au lieu de ne rien faire.
  let pleinEcranCourant = null;
  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (previewRedraw) previewRedraw(); }, 200); });

  function closeInfoPop() { const p = $('#info-pop'); if (p) p.remove(); }
  function openInfoPop(btn) {
    const x = G.INFO[btn.dataset.info]; if (!x) return;
    closeInfoPop();
    const pop = document.createElement('div');
    pop.id = 'info-pop';
    // Une bulle qui explique bien, et s'arrête là, est un cul-de-sac : elle laisse quelqu'un avec
    // une question plus précise et aucun endroit où aller. `a` désigne l'article qui développe.
    const art = x.a ? (G.ARTICLES.find(y => y.id === x.a) || null) : null;
    pop.innerHTML = `<div class="ip-head">${h(x.t)}<button type="button" class="ip-close" aria-label="Fermer">✕</button></div>`
      + `<div class="ip-body">${x.d}`
      + (art ? `<p class="ip-more"><a href="#/aide/${h(art.id)}">Lire « ${h(art.title)} » →</a></p>` : '')
      + '</div>';
    document.body.appendChild(pop);
    // Le lien ferme la bulle : sans ça, elle restait ouverte par-dessus l'article qu'elle vient d'ouvrir.
    const lien = $('.ip-more a', pop);
    if (lien) lien.onclick = () => closeInfoPop();
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

  // Le droit à l'erreur (7.12.0).
  //
  // Toute action ne mérite pas une question : dix confirmations par jour ne se lisent plus, on clique
  // « Oui » sans voir. Mais une action qui s'exécute en un clic doit laisser son retour en arrière
  // SOUS LA MAIN, parce qu'au moment où on comprend qu'on s'est trompé, la ligne a déjà disparu de
  // l'écran d'où on l'a cliquée. « Marquer déposée » en était l'exemple parfait : le bouton qui
  // retire la mention existe, mais sur un AUTRE panneau, et seulement si on retrouve le bon
  // trimestre — donc, vu d'ici, l'action était sans retour.
  //
  // Le bandeau dure trois fois plus longtemps qu'un message ordinaire : comprendre qu'on vient de se
  // tromper prend quelques secondes. Et il rétablit les clics (`#toast` est en `pointer-events: none`
  // le reste du temps, sans quoi le bouton serait parfaitement visible et parfaitement inerte).
  function toastUndo(msg, undo) {
    const t = $('#toast');
    const fermer = () => { clearTimeout(t._timer); t.className = ''; t.textContent = ''; };
    t.innerHTML = `<span>${h(msg)}</span><button class="toast-undo" id="toast-undo">Annuler</button>`;
    t.className = 'show avec-bouton';
    $('#toast-undo').onclick = () => { fermer(); undo(); };
    clearTimeout(t._timer);
    t._timer = setTimeout(fermer, 8000);
  }

  // Fenêtre modale. Échap ferme, Entrée valide le bouton principal (sauf dans un textarea).
  let modalClose = null;
  // Les fenêtres s'empilent. Avant, ouvrir une confirmation depuis un formulaire écrasait ce formulaire
  // et la saisie en cours : un trop-perçu confirmé depuis « Enregistrer un paiement » faisait tout perdre.
  // Chaque fenêtre est une couche à elle, et `onMount` reçoit sa couche (pas tout le conteneur), si bien
  // que les sélecteurs des formulaires continuent de viser leurs propres champs.
  // `onDismiss` est appelé chaque fois que la fenêtre se ferme — y compris par Échap ou par un clic
  // à côté. Sans lui, une question posée sous forme de promesse ne recevait jamais de réponse : elle
  // restait en suspens pour toujours et bloquait ce qui l'attendait (voir le routeur plus bas).
  function modal(html, onMount, onDismiss) {
    const root = $('#modal-root');
    const layer = document.createElement('div');
    layer.className = 'modal-bg';
    // 400 et au-dessus : une question doit couvrir TOUT le reste, y compris l'assistant de première
    // utilisation (250) et l'écran de verrouillage (200). En dessous d'eux, ses boutons existaient
    // mais les clics atterrissaient sur l'écran du dessus — la question paraissait morte.
    layer.style.zIndex = String(400 + root.children.length);
    layer.innerHTML = `<div class="modal">${html}</div>`;
    root.appendChild(layer);
    const under = modalClose;
    const close = () => { layer.remove(); if (modalClose === close) modalClose = under; if (onDismiss) onDismiss(); };
    modalClose = close;
    layer.addEventListener('click', e => { if (e.target === layer) close(); });
    $$('[data-close]', layer).forEach(b => b.addEventListener('click', close));
    bindDateFields(layer);
    // « * obligatoire » se pose TOUT SEUL dès qu'un champ de la fenêtre porte la classe. Une légende
    // recopiée fenêtre par fenêtre se périme à la première qui gagne un champ obligatoire ; déduite,
    // elle ne peut pas manquer. (Même principe que `wipeData` déduit de `DEFAULT_DATA`, 7.0.0.)
    const actions = $('.modal-actions', layer);
    if (actions && $('.field.obligatoire', layer) && !$('.oblig-note', layer)) {
      const note = document.createElement('span');
      note.className = 'oblig-note';
      note.innerHTML = '<b>*</b> obligatoire';
      actions.insertBefore(note, actions.firstChild);
    }
    layer.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
      const main = $('.modal-actions .btn-primary, .modal-actions .btn-danger', layer);
      if (main && !main.disabled) { e.preventDefault(); main.click(); }
    });
    if (onMount) onMount(layer, close);
    const first = $('input:not([type=hidden]), select, textarea', layer); if (first) first.focus();
    return close;
  }

  // Une question finit TOUJOURS par répondre : fermée par Échap ou par un clic à côté, elle vaut
  // « Annuler ». Une promesse laissée en suspens bloquait tout ce qui l'attendait, sans aucune erreur
  // visible — c'est ce qui figeait l'application entière après le garde-fou de navigation.
  function confirmDialog(msg, okLabel, danger) {
    return new Promise(resolve => {
      let settled = false;
      const finish = (close, v) => { settled = true; close(); resolve(v); };
      modal(`<h2>Confirmation</h2><p>${C.nl2br(msg)}</p>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn ${danger === false ? 'btn-primary' : 'btn-danger'}" id="ok">${h(okLabel || 'Confirmer')}</button></div>`,
        (root, close) => { $('#ok', root).onclick = () => finish(close, true); $('[data-close]', root).onclick = () => finish(close, false); },
        () => { if (!settled) resolve(false); });
    });
  }

  // Boîte à trois choix : résout avec 'a', 'b' ou null (annulé, Échap compris)
  function choiceDialog(title, msg, labelA, labelB) {
    return new Promise(resolve => {
      let settled = false;
      const finish = (close, v) => { settled = true; close(); resolve(v); };
      modal(`<h2>${h(title)}</h2><p>${h(msg)}</p>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn" id="b">${h(labelB)}</button><button class="btn btn-primary" id="a">${h(labelA)}</button></div>`,
        (root, close) => { $('#a', root).onclick = () => finish(close, 'a'); $('#b', root).onclick = () => finish(close, 'b'); $('[data-close]', root).onclick = () => finish(close, null); },
        () => { if (!settled) resolve(null); });
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
  // Un champ date est un COUPLE : un <input type=hidden> nommé et un champ texte visible dans le
  // même `.datefield` (règle apprise en 3.0.0). Le mettre à jour depuis du code demande de toucher
  // les deux — sinon la valeur enregistrée change et l'écran continue d'afficher l'ancienne.
  function poserDateField(root, name, iso) {
    const hid = $(`input[name=${name}]`, root);
    if (!hid) return;
    hid.value = iso;
    const box = hid.closest('.datefield');
    const txt = box && $('.d-txt', box);
    if (txt) txt.value = iso ? C.fmtDateInput(iso) : '';
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
  // Statut d'un achat : « à payer » contient une espace, qui ferait deux classes CSS au lieu d'une.
  const BUY_BADGE = { 'à payer': 'b-due', partiel: 'b-part', retard: 'b-late', 'payée': 'b-paid' };
  function buyBadge(status) { return `<span class="badge ${BUY_BADGE[status] || ''}">${h(status)}</span>`; }
  function statusBadge(doc) { return badge(effStatus(doc)); }
  function methodLabel(m) { const x = C.PAYMENT_METHODS.find(p => p[0] === m); return x ? x[1] : (m || ''); }
  // Le compte d'un paiement qui n'en porte pas : c'est celui sur lequel `cashMovements` le fait
  // tomber (le compte par défaut). On l'écrit ainsi plutôt que de laisser la case vide — une case
  // vide laisserait croire que l'argent n'est nulle part.
  function accountLabel(id) {
    const cptes = data.accounts || [];
    const a = cptes.find(x => x.id === id);
    if (a) return a.name || 'Compte';
    const d = cptes.find(x => x.isDefault) || cptes[0];
    return d ? (d.name || 'Compte') + ' (par défaut)' : '—';
  }
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
  function setGuard(g) { guard = g; reportDirty(); }
  function clearGuard(g) { if (!g || guard === g) guard = null; reportDirty(); }
  // Le process principal doit savoir s'il reste du travail non enregistré : sans ça, fermer la fenêtre
  // pendant la saisie d'un devis le perdait sans un mot.
  let dirtyReported = null;
  function reportDirty() {
    const d = !!(guard && guard.dirty());
    if (d === dirtyReported) return;
    dirtyReported = d;
    if (bridge.setDirty) bridge.setDirty(d);
  }
  // Demande à l'utilisateur avant de perdre son travail. Résout true si on peut continuer.
  async function leaveOk() {
    if (!guard || !guard.dirty()) return true;
    const g = guard;
    const c = await choiceDialog('Modifications non enregistrées',
      `Tu as modifié ${g.what || 'cette page'} sans enregistrer. Que veut-on faire ?`,
      'Enregistrer et continuer', 'Quitter sans enregistrer');
    if (c === null) return false;
    if (c === 'a') { const ok = await g.save(); if (ok === false) return false; }
    // Un aperçu immédiat (le thème) doit se défaire si on renonce : sinon l'application reste
    // habillée d'un réglage qu'on vient de refuser, et plus rien à l'écran ne le dit.
    else if (typeof g.discard === 'function') g.discard();
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

  // ---------- revenir en arrière ----------
  // On tient notre propre pile plutôt que l'historique du navigateur : le garde-fou « modifications non
  // enregistrées » remet la page précédente dans la barre d'adresse pour poser sa question, ce qui
  // fausserait history.back(). Le bouton retour dit où il mène, il ne se contente pas d'une flèche.
  const navStack = [];
  try { window.__navStack = navStack; } catch (_) {}   // visible depuis les tests
  let goingBack = false;
  const PAGE_LABELS = {
    dashboard: 'Accueil', devis: 'Devis', factures: 'Factures', relances: 'Relances', contrats: 'Facturation récurrente',
    contrat: 'le contrat', autres: 'Proforma, bons et contrats', clients: 'Clients', client: 'la fiche client', catalogue: 'Catalogue',
    tresorerie: 'Trésorerie', stats: 'Statistiques', compta: 'Comptabilité', parametres: 'Paramètres', aide: 'Aide', doc: 'le document',
    achats: 'Achats et dépenses', achat: 'l\'achat', fournisseurs: 'Fournisseurs', fournisseur: 'la fiche fournisseur',
    marges: 'Marges', affaire: 'l\'affaire', immos: 'Immobilisations', immo: 'l\'immobilisation',
    stock: 'Stock', article: 'l\'article', garanties: 'Garanties', paie: 'Paie', salarie: 'la fiche du salarié',
    modules: 'Tous les modules'
  };
  const pageLabel = hash => PAGE_LABELS[(hash || '').replace(/^#\/?/, '').split('/')[0]] || 'Accueil';
  function pushHistory(previous) {
    if (goingBack) { goingBack = false; return; }
    if (!previous || previous === location.hash) return;
    navStack.push(previous);
    if (navStack.length > 60) navStack.shift();
  }
  const routeOf = hash => (hash || '').replace(/^#\/?/, '').split('/')[0] || 'dashboard';
  // `skip` saute les pages du même type : depuis l'Aide, on veut retrouver ce qu'on faisait avant,
  // pas repasser un à un par les articles déjà lus.
  function backTarget(fallback, skip) {
    for (let i = navStack.length - 1; i >= 0; i--) if (routeOf(navStack[i]) !== skip) return navStack[i];
    return fallback;
  }
  function goBack(fallback, skip) {
    let target = null;
    while (navStack.length) {
      const candidate = navStack.pop();
      if (routeOf(candidate) !== skip) { target = candidate; break; }
    }
    target = target || fallback || '#/dashboard';
    // Si on y est déjà, aucun hashchange ne se déclenche : sans ce cas, le drapeau resterait armé
    // et la navigation suivante ne s'empilerait pas.
    if (location.hash === target) { render(); return; }
    goingBack = true;
    navigate(target);
  }
  // Bouton retour d'une sous-page. `fallback` sert quand on y est arrivé directement (lien, démarrage).
  function backButton(fallback, skip) {
    const label = pageLabel(backTarget(fallback, skip));
    return `<button class="btn btn-back" id="back" title="Revenir à ${h(label)}">← ${h(label)}</button>`;
  }
  function bindBack(fallback, skip) {
    const b = $('#back');
    if (b) b.onclick = () => go(() => goBack(fallback, skip));
  }

  // ---------- la barre latérale (7.0.0) ----------
  // Les icônes vivaient dans index.html à côté de leur lien. Maintenant que les liens sont dessinés
  // à partir de core.PAGES, elles vivent ici : une page = un dessin, et rien à retrouver dans deux
  // fichiers quand on ajoute un module.
  const ICONES = {
    dashboard: '<path d="M3 12l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    devis: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    factures: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    relances: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    autres: '<path d="M9 3h8l4 4v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 3v5h4"/><path d="M5 7v13a2 2 0 0 0 2 2h9"/>',
    contrats: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    achats: '<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>',
    fournisseurs: '<path d="M3 9l2-5h14l2 5"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/>',
    clients: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    catalogue: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    tresorerie: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/>',
    marges: '<path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/><path d="M3 21h18"/>',
    paie: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.3 3-5.5 6.5-5.5s6.5 2.2 6.5 5.5"/><path d="M17 4h5v6h-5z"/><path d="M18.5 6.5h2"/>',
    stock: '<path d="M3 8l9-4 9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4"/><path d="M12 12v8"/>',
    garanties: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    immos: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/>',
    stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    compta: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    modules: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>'
  };
  const icone = id => `<svg viewBox="0 0 24 24">${ICONES[id] || ICONES.modules}</svg>`;

  // Les compteurs de la barre : ils vivaient en dur dans index.html (<span id="nav-relances">…).
  // Maintenant qu'on dessine, on les pose en même temps que le lien.
  const NAV_COMPTEURS = { relances: 'nav-relances', contrats: 'nav-contrats', achats: 'nav-achats', tresorerie: 'nav-treso', paie: 'nav-paie', stock: 'nav-stock', immos: 'nav-immos' };
  const NAV_INFO = ['contrats', 'immos'];          // compteur bleu « pour information », pas une alerte

  // ---------- le sélecteur d'entreprise (7.14.0) ----------
  //
  // Pourquoi : l'application gère plusieurs dossiers depuis la 3.2.0 — la société de Skander, celle
  // de son père, un dossier partagé à deux — et le seul moyen d'en changer était Paramètres →
  // Dossiers, cinq clics plus loin. Pendant ce temps, le nom du dossier ouvert est écrit en haut à
  // gauche de la fenêtre, en permanence. **L'endroit qui AFFICHE un état est l'endroit où on
  // s'attend à le changer** : c'est le même principe que « un lien qui promet un réglage l'amène ».
  //
  // Le menu liste aussi ce qu'on ne peut faire nulle part ailleurs en un geste : créer une seconde
  // entreprise, et rejoindre un dossier partagé.
  let dossiersConnus = null;                  // dernière liste lue, pour ne pas re-demander à chaque clic

  // Deux noms pour la même chose, à dix pixels d'écart : l'en-tête affichait « Atelier Un SUARL »
  // (la société, dans les données) pendant que le menu et Paramètres → Dossiers affichaient
  // « Mon entreprise » (le nom du dossier, posé par main.js à la création). Personne ne peut savoir
  // que ces deux lignes désignent le même dossier. Le nom du dossier suit donc celui de la société,
  // tant qu'on ne l'a pas renommé soi-même — un nom choisi à la main n'est jamais écrasé.
  const NOM_DOSSIER_DEFAUT = 'Mon entreprise';
  async function accorderNomDossier() {
    if (!bridge.listDossiers || !bridge.renameDossier) return;
    const voulu = ((data && data.company && data.company.name) || '').trim();
    if (!voulu) return;
    try {
      const r = await bridge.listDossiers();
      const d = (r.dossiers || []).find(x => x.id === r.current);
      if (!d || d.name === voulu) return;
      if (d.name !== NOM_DOSSIER_DEFAUT) return;      // renommé à la main : on n'y touche pas
      await bridge.renameDossier({ id: d.id, name: voulu });
    } catch (_) { /* les dossiers ne sont pas disponibles ici */ }
  }
  function fermerDossiers() {
    const m = $('#dos-menu'); if (!m) return;
    m.hidden = true; m.innerHTML = '';
    const b = $('#brand-btn'); if (b) b.setAttribute('aria-expanded', 'false');
  }
  async function ouvrirDossiers() {
    const m = $('#dos-menu'); const bouton = $('#brand-btn');
    if (!m || !bouton) return;
    if (!m.hidden) return fermerDossiers();
    // Le pont n'expose pas les dossiers dans les contextes de secours (tests unitaires, navigateur) :
    // on le dit au lieu d'ouvrir un menu vide.
    if (!bridge.listDossiers) return toast('Les dossiers ne sont pas disponibles ici.', true);
    let r;
    try { r = await bridge.listDossiers(); } catch (e) { return toast(plainError(e), true); }
    dossiersConnus = r;
    const autres = (r.dossiers || []).filter(d => d.id !== r.current);
    // Pour le dossier ouvert on connaît la vraie société : on l'affiche plutôt que l'étiquette du
    // dossier, qui peut être restée générique sur une installation ancienne.
    const nomOuvert = d => ((data && data.company && data.company.name) || '').trim() || d.name;
    m.innerHTML = `<div class="dm-titre">Entreprise ouverte</div>
      ${(r.dossiers || []).filter(d => d.id === r.current).map(d => `<button type="button" class="on" data-dos="${h(d.id)}">
        <span class="dm-mark">✓</span><span class="dm-nom">${h(nomOuvert(d))}</span>${d.shared ? '<span class="dm-tag">partagé</span>' : ''}</button>`).join('')}
      ${autres.length ? `<div class="dm-titre">Basculer vers</div>
        ${autres.map(d => `<button type="button" data-dos="${h(d.id)}" title="${h(d.name)}">
          <span class="dm-mark"></span><span class="dm-nom">${h(d.name)}</span>${d.shared ? '<span class="dm-tag">partagé</span>' : ''}</button>`).join('')}` : ''}
      <hr>
      <button type="button" id="dm-new" title="Créer un second dossier, pour une autre entreprise"><span class="dm-mark">+</span><span class="dm-nom">Nouvelle entreprise…</span></button>
      <button type="button" id="dm-shared" title="Un dossier posé dans iCloud, OneDrive ou sur une clé, que deux ordinateurs ouvrent tour à tour"><span class="dm-mark">↔</span><span class="dm-nom">Dossier partagé…</span></button>
      <button type="button" id="dm-manage" title="Renommer, retirer de la liste, voir où vivent les fichiers"><span class="dm-mark">⚙</span><span class="dm-nom">Gérer les dossiers…</span></button>`;
    m.hidden = false;
    bouton.setAttribute('aria-expanded', 'true');
    $$('[data-dos]', m).forEach(b => b.onclick = async () => {
      fermerDossiers();
      if (b.dataset.dos === r.current) return;
      const d = (r.dossiers || []).find(x => x.id === b.dataset.dos);
      // Le garde-fou des modifications non enregistrées vaut ici comme pour une navigation : changer
      // de dossier recharge la fenêtre, donc ce qui n'est pas écrit est perdu.
      if (!await leaveOk()) return;
      toast(`Ouverture de « ${d ? d.name : 'ce dossier'} »…`);
      try { await bridge.switchDossier(b.dataset.dos); } catch (e) { toast(plainError(e), true); }
    });
    $('#dm-new', m).onclick = () => {
      fermerDossiers();
      promptDialog('Nouvelle entreprise', 'Nom de l\'entreprise', '', async v => {
        const res = await bridge.addDossier({ name: v, shared: false });
        if (res && !res.ok && res.error) toast(res.error, true);
      });
    };
    $('#dm-shared', m).onclick = () => { fermerDossiers(); allerParametres('donnees', 'p-dossiers'); };
    $('#dm-manage', m).onclick = () => { fermerDossiers(); allerParametres('donnees', 'p-dossiers'); };
  }

  function drawNav() {
    const pages = C.navPages(data);
    // Groupé par FAMILLE, pas par module : huit intertitres coûteraient 250 px de barre, et on aurait
    // remplacé un débordement par un autre.
    let html = '', famille = '§';
    pages.forEach(p => {
      if (p.famille && p.famille !== famille) { famille = p.famille; html += `<div class="nav-group">${h(famille)}</div>`; }
      const cid = NAV_COMPTEURS[p.id];
      // « Immobilisations », « Marges », « Trésorerie » : trois mots de gestion qu'un créateur
      // d'entreprise n'a jamais employés, et rien ne disait ce qu'il y avait derrière. La phrase
      // existait déjà dans MODULES (`quoi`) : elle sert d'infobulle.
      // La phrase de la PAGE d'abord, celle du module en repli : trois pages d'un même module
      // partageaient au survol exactement la même phrase, donc l'infobulle affirmait trois fois que
      // Trésorerie, Marges et Statistiques font la même chose.
      const m = p.module ? C.moduleById(p.module) : null;
      const texte = p.quoi || (m && m.quoi) || '';
      const quoi = texte ? ` title="${h(texte)}"` : '';
      html += `<a href="#/${p.id}" data-route="${p.id}"${quoi}${p.famille ? '' : ' class="solo"'}>${icone(p.id)}${h(p.titre)}`
        + (cid ? `<span class="nav-count${NAV_INFO.includes(p.id) ? ' info' : ''}" id="${cid}" hidden></span>` : '')
        + '</a>';
    });
    // « Tous les modules » vivait ici, en dernier : donc la première entrée à passer sous la coupe,
    // et mesurée hors champ dès 1366×768. C'est la porte de ce qui n'est pas affiché — elle est
    // maintenant dans le pied de la barre (index.html), qui ne défile jamais.
    const nav = $('#nav');
    nav.innerHTML = html;
    // Une barre qui défile doit AVOIR L'AIR de défiler. Sur macOS, la barre de défilement est cachée
    // tant qu'on ne fait pas défiler : Skander a donc regardé pendant des semaines une liste qui
    // paraissait finie à « Immobilisations ». La classe force une barre visible (CSS).
    nav.classList.toggle('deborde', nav.scrollHeight > nav.clientHeight + 1);
  }

  // On arrive sur la page d'un module retiré du menu (par la recherche, par une adresse, par un lien
  // d'une autre page). Elle marche exactement comme les autres — mais si on ne dit rien, l'utilisateur
  // croira l'avoir trouvée par hasard et ne saura pas la retrouver demain.
  function bandeauModule(active) {
    const p = C.pageById(active);
    if (!p || !p.module || !data) return;
    const choisis = company().modules;
    if (!Array.isArray(choisis) || choisis.includes(p.module)) return;
    const m = C.moduleById(p.module);
    if (!m) return;
    const el = document.createElement('div');
    el.className = 'banner info mod-banner';
    el.innerHTML = `<span>« ${h(m.label)} » n'est pas dans ton menu. La page marche normalement — elle n'y est simplement pas affichée.</span>
      <button class="btn btn-sm" id="mod-add">Ajouter au menu</button>`;
    const view = $('#view');
    const head = $('.page-head', view);
    if (head && head.nextSibling) view.insertBefore(el, head.nextSibling); else view.appendChild(el);
    $('#mod-add').onclick = () => {
      const liste = (company().modules || []).slice();
      if (!liste.includes(m.id)) liste.push(m.id);
      company().modules = liste;
      save(); drawNav(); el.remove();
      toast(`« ${m.label} » ajouté au menu`);
    };
  }

  // Tant que le jeu d'exemple est chargé, l'application le DIT — sur chaque page, en permanence.
  // Sans ça, rien à l'écran ne distingue treize mois d'activité fictive de vraies données : on peut
  // relancer un client qui n'existe pas, ou pire, envoyer une facture au nom d'une société inventée.
  // Le bandeau porte la sortie, parce que « revenir à mes données » passait par Paramètres →
  // Sécurité et données → Importer → choisir le bon fichier dans le dossier des sauvegardes.
  function bandeauDemo() {
    if (!data || !C.estDemo(data)) return;
    const el = document.createElement('div');
    el.className = 'banner demo-banner';
    el.innerHTML = `<span><b>Jeu d'exemple</b> — ce ne sont pas tes données : treize mois d'activité fictive,
      pour regarder comment l'application fonctionne. N'envoie rien à personne depuis ici.</span>
      <button class="btn btn-sm" id="demo-out">Repartir de mes données</button>`;
    const view = $('#view');
    view.insertBefore(el, view.firstChild);
    $('#demo-out').onclick = demoSortie;
  }

  // Charger l'exemple. Sorti des Paramètres pour que l'accueil puisse le proposer vraiment : le
  // bouton « Voir un exemple rempli » du tableau de bord n'ouvrait pas l'exemple, il déposait
  // l'utilisateur dans une page à huit onglets, devant un encadré rouge « Zone sensible », avec un
  // toast qui nommait l'onglet où chercher. C'est le contraire d'un exemple.
  async function loadDemo() {
    // `hasData` ne regardait que les documents et les clients : DEUX listes sur vingt. L'assistant
    // en remplit une troisième — le catalogue du métier déclaré — et quelqu'un qui venait de finir
    // l'assistant puis cliquait « Voir un exemple rempli » perdait ses quatre prestations sans une
    // question et sans sauvegarde, alors que l'article d'aide promet « tes données sont mises de
    // côté avant ». Mêmes victimes : fournisseurs, achats, salariés, immobilisations, comptes.
    // On DÉDUIT de `LIST_LABELS`, comme « Tout effacer » le fait déjà — une liste écrite à la main
    // dérive à chaque module ajouté, c'est la leçon de la 7.0.0.
    const remplies = Object.keys(C.LIST_LABELS)
      .filter(k => Array.isArray(data[k]) && data[k].length)
      .map(k => `${data[k].length} ${C.LIST_LABELS[k]}`);
    if (remplies.length && !await confirmDialog(
      `Remplacer tes données par le jeu d'exemple ?\n\nCe qui sera remplacé : ${C.liste(remplies)}.\n\n`
      + 'Une sauvegarde est prise juste avant, et le bandeau orange te les rendra d\'un clic. '
      + 'Tes paramètres société (nom, logo, cachet, thème…) sont conservés.',
      'Charger l\'exemple', false)) return;
    // Toutes les données sont remplacées : le garde-fou de la page en cours n'a plus d'objet, et
    // laisser sa question surgir ensuite revenait à demander s'il faut enregistrer ce qu'on vient
    // d'effacer sciemment. Posé AVANT la sauvegarde : dans l'autre ordre, refuser cette seconde
    // question laissait une sauvegarde orpheline. C'est l'ordre de « Tout effacer ».
    if (!await closedWipeOk('Charger l\'exemple remplace tout.')) return;
    // Sans condition : elle coûte un fichier, et c'est le seul chemin de retour.
    await bridge.createBackup('avant-demo');
    clearGuard();
    data = window.SkanDemo.buildDemoData(data.company);
    save(true); applyTheme();
    $('#brand-company').textContent = data.company.name;
    toast('Jeu de démonstration chargé');
    navigate('#/dashboard');
    render();
  }

  // La sortie de l'exemple. Deux chemins, et l'app dit lequel elle propose :
  //   — une sauvegarde « avant-demo » existe (on avait des données) → on les remet ;
  //   — sinon (on a chargé l'exemple sur une installation neuve) → on repart à vide.
  async function demoSortie() {
    let avant = null;
    try {
      // La plus récente : recharger l'exemple deux fois crée deux « avant-demo ».
      avant = (await bridge.listBackups() || []).filter(b => /avant-demo/.test(b.name || '')).sort((a, b) => b.mtime - a.mtime)[0];
    } catch (_) {}
    // On REGARDE avant de proposer : annoncer « tes données reviennent » sans avoir vérifié que la
    // sauvegarde est lisible, c'est promettre quelque chose qu'on ne tiendra qu'après l'écrasement.
    let vu = null;
    if (avant) { try { vu = await bridge.peekBackup(avant.name); } catch (_) {} }
    const ok = vu && vu.ok;
    // Texte BRUT : confirmDialog passe par nl2br, qui échappe. Une balise écrite ici s'afficherait
    // telle quelle à l'écran.
    const msg = ok
      ? `Tes données d'avant l'exemple ont été mises de côté au moment du chargement :\n`
        + `${vu.compte.documents} document(s), ${vu.compte.clients} client(s), ${vu.compte.catalog} prestation(s)`
        + `${vu.societe ? ` au nom de « ${vu.societe} »` : ''}.\n\nOn les remet en place, et l'exemple disparaît.`
      : avant
        ? `La sauvegarde d'avant l'exemple est illisible (${(vu && vu.error) || 'raison inconnue'}).\n\n`
          + 'On peut effacer l\'exemple, mais tes données d\'avant ne reviendront pas d\'ici : elles sont dans le dossier des sauvegardes, et « Importer » sait les relire.'
        : 'Il n\'y avait aucune donnée avant l\'exemple : l\'application repart vide, avec ta fiche société à remplir.';
    if (!await confirmDialog(msg, ok ? 'Remettre mes données' : 'Effacer l\'exemple', !ok)) return;
    clearGuard();
    if (ok) {
      const r = await bridge.restoreBackup(avant.name);
      if (!r || !r.ok) return toast('Restauration impossible : ' + ((r && r.error) || 'sauvegarde illisible'), true);
      data = migrate(r.data);
      toast('Tes données sont revenues');
    } else {
      C.wipeData(data, { garderSociete: !(data.company && data.company.demo) });
      save(true);
      toast('L\'exemple est effacé');
    }
    applyTheme();
    $('#brand-company').textContent = data.company.name;
    settingsTab = 'societe';
    navigate(data.company.name ? '#/dashboard' : '#/parametres');
    render();
  }

  function render(keepScroll) {
    const view = $('#view');
    const scroll = keepScroll ? view.scrollTop : 0;
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
    const name = parts[0];
    let active = name;
    if (name === 'doc') {
      const type = parts[1] === 'new' ? parts[2] : (docById(parts[1]) || {}).type;
      active = type === 'devis' ? 'devis' : C.EXTRA_TYPES.includes(type) ? 'autres' : 'factures';
    } else if (name === 'client') active = 'clients';
    else if (name === 'contrat') active = 'contrats';
    else if (name === 'achat') active = 'achats';
    else if (name === 'fournisseur') active = 'fournisseurs';
    else if (name === 'affaire') active = 'marges';
    else if (name === 'immo') active = 'immos';
    else if (name === 'article') active = 'stock';
    else if (name === 'garanties') active = 'stock';
    else if (name === 'salarie') active = 'paie';
    // La barre se redessine à chaque navigation : un module qui vient de recevoir sa première ligne
    // doit apparaître tout de suite, pas au prochain démarrage.
    drawNav();
    // Les liens du pied (Paramètres, Aide) ne sont pas dans <nav> : sans eux dans le sélecteur, la
    // page ouverte n'aurait jamais été marquée sur ces deux-là.
    $$('nav a, .sidebar-foot a').forEach(a => a.classList.toggle('active', a.dataset.route === active));
    // `drawNav` réécrit `nav.innerHTML`, ce qui remet le défilement à zéro : sur les quatre dernières
    // pages (Statistiques, Paie, Comptabilité, et tout ce qui suit), l'entrée allumée était cent
    // pixels sous le bord et AUCUNE entrée en vert n'était visible. On arrivait au bon écran sans
    // apprendre où il vit dans le menu — donc en dépendant à chaque fois du bouton qui nous y a
    // menés. `block: 'nearest'` ne bouge rien quand l'entrée est déjà dans le champ.
    const courante = $('nav a.active');
    if (courante) { try { courante.scrollIntoView({ block: 'nearest' }); } catch (_) {} }
    guard = null; previewRedraw = null; pleinEcranCourant = null;
    // Le grand aperçu appartient au document qu'on quitte : le laisser ouvert par-dessus la page
    // suivante montrerait une pièce qui n'est plus celle qu'on regarde.
    const grand = $('#pv-full'); if (grand) grand.remove();
    pushHistory(currentHash);        // d'où l'on vient, pour le bouton retour de la page qui s'ouvre
    (routes[name] || routes.dashboard)(parts.slice(1));
    poserLienAide(name);             // « Comprendre cette page → » : l'article qui explique cet écran
    bandeauDemo();                   // « ce ne sont pas tes données » — sur chaque page, en permanence
    bandeauModule(active);           // « cette page n'est pas dans ton menu » — et le bouton pour l'y mettre
    bindDateFields(view);            // champs date posés par la page qui vient d'être dessinée
    view.scrollTop = scroll;
    currentHash = location.hash;
    updateNavCounts();
    closePalette();
    closeInfoPop();
    setWindowTitle(name, parts.slice(1));
    // Le panneau visé est amené à l'écran et marqué une seconde et demie : arriver en haut d'une page
    // de six panneaux, c'est redescendre à la main en cherchant le bon titre.
    if (pageFocus) {
      const cible = $('#' + pageFocus);
      pageFocus = '';
      if (cible) {
        try { cible.scrollIntoView({ block: 'start' }); } catch (_) {}
        cible.classList.add('flash');
        setTimeout(() => cible.classList.remove('flash'), 1600);
      }
    }
  }

  // Poser l'adresse sans réveiller notre propre routeur. Si l'adresse ne change pas, aucun événement
  // ne viendra désarmer le drapeau : on ne l'arme donc pas. Armé à vide, il avalait la navigation
  // suivante — c'est le même piège que dans goBack.
  function setHashSilently(hash) {
    if (location.hash === hash) return;
    ignoreHashChange = true;
    location.hash = hash;
  }

  let askingLeave = false;
  window.addEventListener('hashchange', async () => {
    if (ignoreHashChange) { ignoreHashChange = false; return; }
    if (guard && guard.dirty()) {
      // Une seule question à la fois : chaque clic pendant la question en empilait une autre, et
      // l'application finissait par ne plus répondre du tout.
      if (askingLeave) { setHashSilently(currentHash); return; }
      const target = location.hash;
      setHashSilently(currentHash);            // on reste sur place le temps de demander
      let ok = false;
      askingLeave = true;
      try { ok = await leaveOk(); } finally { askingLeave = false; }
      if (!ok) return;
      setHashSilently(target);
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
      // Le titre se lisait dans le TEXTE du lien de la barre latérale. Un module masqué n'a plus de
      // lien : la fenêtre se serait appelée « SkanFact » tout court sur ses pages. Le titre vient
      // maintenant de core.PAGES, la même source que le lien.
      t = C.pageTitle(name);
    }
    const title = (t ? t + ' — ' : '') + 'SkanFact';
    document.title = title;
    if (bridge.setTitle) bridge.setTitle(title);
  }

  // ---------- Accueil ----------

  // L'état de la copie externe vit sur le poste, pas dans les données : on le lit une fois et on le
  // garde, pour que `firstSteps` reste une fonction pure qu'on peut tester sans Electron.
  let copieExterne = null;

  // Les premiers pas. Sept étapes, dont l'état est DÉDUIT des données — jamais coché à la main.
  // Le panneau prend la place des quatre compteurs à zéro tant que rien n'a été fait, et disparaît
  // tout seul quand tout est fait (il se retrouve alors dans l'Aide).
  const PAS_ACTIONS = {
    societe: ['Compléter ma fiche', () => allerParametres('societe', 'p-identite')],
    client: ['+ Créer un client', () => clientForm(null, () => render())],
    catalogue: ['Remplir le catalogue', () => navigate('#/catalogue')],
    devis: ['+ Créer un devis', () => navigate('#/doc/new/devis')],
    // « L'envoyer » ne se fait pas depuis l'accueil : le geste vit sur le devis lui-même. Le bouton
    // mène donc à la liste. Il portait le même libellé que l'étape précédente — deux boutons voisins
    // marqués « + Créer un devis » pour deux gestes différents.
    envoiDevis: ['Ouvrir mes devis', () => navigate('#/devis')],
    factures: ['Voir mes factures', () => navigate('#/factures')],
    sauvegarde: ['Choisir un dossier', () => allerParametres('donnees', 'p-externe')]
  };
  // Le panneau est-il à l'écran ? `todoPanel` a besoin de le savoir pour ne pas répéter l'étape 1.
  // Le panneau ne s'affiche que pendant le démarrage : une fois une facture partie, il proposerait
  // « crée ton premier client » à quelqu'un qui a deux ans d'activité — et reprendrait tout l'écran,
  // exactement le défaut qu'il corrige.
  const premiersPasVisibles = () => C.firstSteps(data, company(), { copieExterne }).demarrage;
  function premiersPas() {
    const p = C.firstSteps(data, company(), { copieExterne });
    if (!p.demarrage) return '';
    const suivante = p.etapes.find(e => !e.fait);
    return `<div class="panel premiers-pas">
      <h2>Tes premiers pas <span class="pp-compte">${p.faits} / ${p.total}</span></h2>
      <p class="small muted mb">SkanFact fait beaucoup de choses, mais elles s'enchaînent toujours dans le même ordre.
        Voilà celui-là. Ce panneau disparaît tout seul quand tu l'as parcouru, et se retrouve ensuite dans l'Aide.</p>
      <ol class="pp-list">${p.etapes.map(e => {
        const a = PAS_ACTIONS[e.action];
        const encours = e === suivante;
        return `<li class="${e.fait ? 'fait' : ''}${encours ? ' encours' : ''}">
          <span class="pp-marque">${e.fait ? '✓' : ''}</span>
          <span class="pp-txt"><strong>${h(e.titre)}</strong><span class="small muted">${h(e.quoi)}</span></span>
          <span class="pp-go">${!e.fait && a ? `<button class="btn btn-sm ${encours ? 'btn-primary' : ''}" data-pas="${h(e.action)}">${h(a[0])}</button>` : ''}</span>
        </li>`;
      }).join('')}</ol>
      <p class="small muted mt">${helpLink('demarrer', 'Ces sept étapes, expliquées en détail')}</p>
    </div>`;
  }
  function bindPremiersPas() {
    $$('[data-pas]').forEach(b => b.onclick = () => {
      const a = PAS_ACTIONS[b.dataset.pas];
      if (a) a[1]();
    });
  }

  // Le lien vers l'article d'aide qui explique l'écran où l'on est. Trente-deux articles existaient,
  // et aucune page n'y menait : on ne les atteignait qu'en ouvrant l'Aide et en lisant trente-deux
  // titres — depuis un bouton qui, lui, était hors de l'écran.
  const helpLink = (id, label) => `<a href="#/aide/${h(id)}" class="help-link">${h(label || 'Comprendre cette page')} →</a>`;

  // Quel article explique quelle page. Trente-deux articles existaient et **aucune page n'y menait** :
  // il fallait ouvrir l'Aide — depuis un bouton qui était hors de l'écran — et lire trente-deux
  // titres. Le lien se pose une seule fois, dans le routeur : dix-huit `page-head` à modifier à la
  // main, c'est dix-huit endroits qu'on oublie au prochain module ajouté.
  const PAGE_AIDE = {
    dashboard: 'demarrer', devis: 'devis', factures: 'facture', doc: 'facture',
    relances: 'paiements', autres: 'pieces', contrats: 'contrats', contrat: 'contrats',
    clients: 'gestion', client: 'gestion', catalogue: 'gestion',
    achats: 'achats', achat: 'achats', fournisseurs: 'achats', fournisseur: 'achats',
    tresorerie: 'tresorerie', marges: 'marges', affaire: 'marges',
    paie: 'paie', salarie: 'conges', stock: 'stock', article: 'stock', garanties: 'series',
    immos: 'immobilisations', immo: 'immobilisations', stats: 'statistiques',
    compta: 'compta', parametres: 'donnees'
  };
  function poserLienAide(route) {
    const id = PAGE_AIDE[route];
    if (!id || !G.ARTICLES.some(a => a.id === id)) return;
    const head = $('#view .page-head');
    if (!head || $('.page-help', head)) return;
    const a = document.createElement('a');
    a.href = '#/aide/' + id;
    a.className = 'help-link page-help';
    a.textContent = 'Comprendre cette page →';
    // Dans le bloc d'actions quand il existe, sinon en bout de titre : la place doit être la même
    // d'une page à l'autre, sinon on la cherche.
    const actions = $('.actions', head);
    if (actions) actions.insertBefore(a, actions.firstChild); else head.appendChild(a);
  }

  routes.dashboard = () => {
    const cur = company().currency;
    const month = C.today().slice(0, 7);
    const year = C.today().slice(0, 4);
    const issued = data.documents.filter(d => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.status !== 'annulée');
    const sign = d => d.type === 'avoir' ? -1 : 1;
    // Une facture en euros ne s'additionne pas à une facture en dinars (7.16.0). Ces quatre agrégats
    // sommaient les montants BRUTS, dans la devise de chaque pièce : sur le jeu d'exemple, la carte
    // « CA de l'année » annonçait 41 307 DT là où le total vaut 43 892 DT — 2 585 DT manquants,
    // 5,9 %. Et le graphique dix centimètres plus bas, lui, passe par `toBase` depuis toujours :
    // deux chiffres du même écran ne racontaient pas la même année. Même faute que la 7.0.1, au même
    // endroit conceptuel, sur le premier écran qu'on regarde le matin.
    const enDinars = (d, montant) => C.toBase(d, montant, company());
    const sumHT = list => list.reduce((s, d) => s + sign(d) * enDinars(d, C.computeTotals(d, company()).netHT), 0);
    const sumTTC = list => list.reduce((s, d) => s + sign(d) * enDinars(d, C.computeTotals(d, company()).totalTTC), 0);
    const ofMonth = issued.filter(d => d.date && d.date.startsWith(month));
    const ofYear = issued.filter(d => d.date && d.date.startsWith(year));
    const open = data.documents.filter(d => d.type === 'facture' && ['envoyée', 'partielle', 'retard'].includes(effStatus(d)));
    const openAmount = open.reduce((s, d) => s + enDinars(d, balance(d).remaining), 0);
    const late = open.filter(d => effStatus(d) === 'retard');
    const sentQuotes = data.documents.filter(d => d.type === 'devis' && d.status === 'envoyé');
    const expiredQuotes = sentQuotes.filter(d => effStatus(d) === 'expiré');
    const pendingQuotes = sentQuotes.filter(d => effStatus(d) === 'envoyé');
    const sumQ = list => list.reduce((s, d) => s + enDinars(d, C.computeTotals(d, company()).totalTTC), 0);
    const recent = data.documents.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
    const series = C.monthlySeries(data, company(), C.today(), 12);
    const from12 = C.addMonths(C.today(), -12, 1);
    const qs = C.quoteStats(data, from12, C.today());
    const delay = C.avgPaymentDelay(data, company(), from12, C.today());
    const top = C.topClients(data, company(), `${year}-01-01`, `${year}-12-31`, 5);
    const topMax = top.length ? Math.max(...top.map(x => x.ht), 1) : 1;

    // Y a-t-il quelque chose à montrer ? Tant que non, quatre compteurs à « 0,000 DT », un graphique
    // de douze mois vides et un « Top clients » vide occupent 548 px avant la première phrase utile.
    // La place revient alors aux premiers pas, qui eux disent quoi faire.
    const duGrain = data.documents.length > 0;
    const duGraphique = series.some(x => x.invoiced || x.collected);

    $('#view').innerHTML = `
      <div class="page-head"><h1>Accueil</h1>
        <div class="actions">
          <button class="btn" id="new-devis">+ Nouveau devis</button>
          <button class="btn btn-primary" id="new-facture">+ Nouvelle facture</button>
        </div></div>
      ${premiersPas()}
      ${todoPanel()}
      ${!duGrain ? '' : `
      <!-- Les quatre chiffres menaient nulle part (7.15.0). « Reste à encaisser : 8 400 DT,
           6 factures » est une QUESTION — lesquelles ? — et il fallait ouvrir Factures, chercher
           un filtre, et comprendre que ni « envoyée » ni « en retard » ne donnent le compte annoncé.
           Chaque carte ouvre maintenant exactement la liste qu'elle résume. -->
      <div class="stats">
        <div class="stat" data-stat="ca-mois" role="button" tabindex="0" title="Voir le journal des ventes du mois"><div class="lbl">CA du mois (HT) ${info('dash.caMonth')}</div><div class="val">${C.money(sumHT(ofMonth), cur)}</div><div class="sub">${C.money(sumTTC(ofMonth), cur)} TTC, avoirs déduits</div></div>
        <div class="stat" data-stat="ca-annee" role="button" tabindex="0" title="Voir les statistiques de l'année"><div class="lbl">CA de l'année (HT) ${info('dash.caYear')}</div><div class="val">${C.money(sumHT(ofYear), cur)}</div><div class="sub">${year} · ${C.money(sumTTC(ofYear), cur)} TTC</div></div>
        <div class="stat" data-stat="encaisser" role="button" tabindex="0" title="Voir les ${pl(open.length, 'facture')} qui restent à encaisser"><div class="lbl">Reste à encaisser ${info('dash.open')}</div><div class="val">${C.money(openAmount, cur)}</div><div class="sub">${pl(open.length, 'facture')}, ${late.length} en retard</div></div>
        <div class="stat" data-stat="devis" role="button" tabindex="0" title="Voir les devis envoyés sans réponse"><div class="lbl">Devis en attente ${info('dash.quotes')}</div><div class="val">${C.money(sumQ(pendingQuotes), cur)}</div><div class="sub">${pendingQuotes.length} devis ${pendingQuotes.length > 1 ? 'envoyés' : 'envoyé'}${expiredQuotes.length ? ` · <a href="#/devis" class="warn-link" id="go-expired">${expiredQuotes.length} ${expiredQuotes.length > 1 ? 'expirés' : 'expiré'}</a>` : ''}</div></div>
      </div>
      <div class="dash-grid">
        <div class="panel"><h2>Activité des 12 derniers mois ${info('dash.chart')}</h2>
          ${duGraphique ? `${barChart(series)}
          <div class="legend"><span><i style="background:var(--primary)"></i>Facturé HT (avoirs déduits)</span><span><i style="background:#2a6fd6;opacity:.55"></i>Encaissé</span></div>`
          : '<p class="small muted">Ce graphique se remplira tout seul : une barre verte par mois facturé, une barre bleue par mois encaissé. L\'écart entre les deux, c\'est ce qu\'on te doit.</p>'}
          <div class="kpis">
            <div class="kpi"><div class="k-label">Devis → facture ${info('dash.conversion')}</div><div class="v">${qs.rate == null ? '—' : qs.rate + ' %'}</div><div class="sub">${qs.accepted} ${qs.accepted > 1 ? 'acceptés' : 'accepté'}, ${qs.refused} ${qs.refused > 1 ? 'refusés' : 'refusé'}, ${qs.pending} en attente</div></div>
            <div class="kpi"><div class="k-label">Délai moyen de paiement ${info('dash.delay')}</div><div class="v">${delay == null ? '—' : delay + ' jours'}</div><div class="sub">factures soldées, 12 derniers mois</div></div>
          </div>
        </div>
        <div class="panel"><h2>Top clients ${year} (HT) ${info('dash.top')}</h2>
          ${top.length ? `<ul class="rank">${top.map(x => `<li><a class="name" href="#/client/${h(x.clientId)}" title="Ouvrir la fiche de ${h(x.name)}">${h(x.name)}</a><span class="bar"><i style="width:${Math.max(4, Math.round(x.ht / topMax * 100))}%"></i></span><span class="amt">${C.money(x.ht, cur)}</span></li>`).join('')}</ul>` : '<p class="small muted">Aucune facture émise cette année. Ton premier devis accepté la remplira.</p>'}
        </div>
      </div>`}
      ${!recent.length ? '' : `<div class="panel"><h2>Documents récents <span class="small muted">— les ${recent.length} dernières pièces sur ${data.documents.length}</span></h2>${docTable(recent, { noFoot: true })}
        <div class="inline mt"><a class="btn btn-sm" href="#/factures">Toutes les factures</a><a class="btn btn-sm" href="#/devis">Tous les devis</a></div></div>`}
      ${duGrain || !data.clients.length ? '' : `
      <div class="panel"><h2>Et maintenant</h2>
        <p>Tu as ${data.clients.length} client${data.clients.length > 1 ? 's' : ''} et aucun document. La suite tient en un geste :</p>
        <div class="inline mt"><button class="btn btn-primary" id="start-devis">+ Créer ton premier devis</button>
          <button class="btn btn-ghost" id="start-demo">Voir un exemple rempli</button></div>
      </div>`}`;
    $('#new-devis').onclick = () => navigate('#/doc/new/devis');
    $('#new-facture').onclick = () => navigate('#/doc/new/facture');
    // Sur une installation neuve, « Aucun document » ne proposait rien (audit) : on montre le chemin.
    if ($('#start-client')) $('#start-client').onclick = () => clientForm(null, () => navigate('#/clients'));
    if ($('#start-devis')) $('#start-devis').onclick = () => navigate('#/doc/new/devis');
    if ($('#start-cat')) $('#start-cat').onclick = () => navigate('#/catalogue');
    if ($('#start-demo')) $('#start-demo').onclick = loadDemo;
    bindPremiersPas();
    bindTodo();
    if ($('#go-expired')) $('#go-expired').onclick = e => { e.preventDefault(); TODO_ACTIONS['devis-expires'].run(); };
    // Chaque carte de chiffre ouvre la liste qu'elle résume. Le clic sur la bulle « i » n'y compte
    // pas : elle explique le chiffre, elle ne navigue pas.
    const STAT_ACTIONS = {
      'ca-mois': vers('#/compta', () => { comptaState.tab = 'ventes'; comptaState.year = C.today().slice(0, 4); comptaState.month = C.today().slice(5, 7); }),
      'ca-annee': vers('#/stats'),
      encaisser: vers('#/factures', filtre('facture', 'à encaisser')),
      devis: vers('#/devis', filtre('devis', 'envoyé'))
    };
    $$('[data-stat]').forEach(c => {
      const aller = e => { if (e.target.closest('button.i, a')) return; STAT_ACTIONS[c.dataset.stat](); };
      c.onclick = aller;
      c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aller(e); } };
    });
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
      // Un en-tête de colonne peut porter sa bulle (7.0.0). C'est là que vivent presque toutes les
      // abréviations que personne ne connaît — « VNC », « Assiette », « RS », « Débit », « Cumul » —
      // et jusqu'ici c'était le seul endroit de l'application où on ne pouvait pas en poser une.
      // Le tri reste sur le <th> ; le « i » arrête la propagation de son côté, donc cliquer la bulle
      // ne trie pas la colonne au passage.
      return `<th class="${cls}"${attrs}${c.w ? ` style="width:${c.w}"` : ''}>${h(c.label)}${c.info ? info(c.info) : ''}${mark}</th>`;
    }).join('')}${extra || ''}</tr>`;
  }
  function bindSort(root, redraw) {
    $$('th[data-sort]', root).forEach(th => {
      // Le « i » posé dans l'en-tête (7.0.0) est à l'intérieur du <th> : sans ce garde, ouvrir la
      // bulle trierait la colonne au passage, et la liste sauterait sous les yeux de quelqu'un qui
      // voulait seulement savoir ce que veut dire « VNC ».
      th.onclick = e => { if (e.target.closest('.i[data-info]')) return; redraw(th.dataset.sort); };
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

  // Une barre de recherche et des filtres au-dessus de ZÉRO ligne n'aident personne : ils occupent
  // la place où devrait vivre l'explication, et laissent croire que quelque chose est filtré. Huit
  // listes les affichaient sans condition. On la garde évidemment quand la liste est vide À CAUSE
  // d'un filtre : sinon on ne pourrait plus le retirer.
  function filtersBar(html, total, filtered) {
    if (!total && !filtered) return '';
    return `<div class="filters">${html}</div>`;
  }

  // Un état vide qui explique le geste en prose n'est pas une interface, c'est une notice de
  // montage : il demande de retenir une phrase, de naviguer ailleurs, et de retrouver le bon
  // bouton. Celui-ci dit à quoi sert la chose, puis donne les vrais boutons.
  //   titre, phrases[], boutons[[id, label, primaire?]]
  function etatVide(titre, phrases, boutons) {
    return `<div class="panel vide-utile"><h2>${h(titre)}</h2>
      ${(phrases || []).map(p => `<p class="small">${p}</p>`).join('')}
      ${(boutons || []).length ? `<div class="inline mt">${boutons.map(([id, label, p]) =>
        `<button class="btn ${p ? 'btn-primary' : ''}" id="${h(id)}">${h(label)}</button>`).join('')}</div>` : ''}
    </div>`;
  }

  // ---------- listes devis / factures ----------
  // Colonnes d'une liste de documents. `get` sert à l'affichage, `val` au tri (nombre ou texte comparable).
  function docColumns(opts) {
    const cur = doc => docCur(doc);
    const amountOf = d => { const t = C.computeTotals(d, company()); return d.type === 'avoir' ? -t.netToPay : (['facture', 'proforma'].includes(d.type) ? t.netToPay : t.totalTTC); };
    const restOf = d => d.type === 'facture' && d.status !== 'brouillon' ? balance(d).remaining : null;
    const cols = [
      { key: 'number', label: 'Numéro', cls: 'nw', val: d => (d.number ? '1' : '0') + (d.number || ''), get: d => `<strong>${d.number ? h(d.number) : '<span class="muted">Brouillon</span>'}</strong>` },
      opts.extra
        ? (opts.extra === 'proforma'
          ? { key: 'due', label: 'Échéance', val: d => d.dueDate || '', get: d => C.fmtDate(d.dueDate) }
          : { key: 'reference', label: 'Référence', asc: true, val: d => (d.reference || '').toLowerCase(), get: d => h(d.reference || '') || '<span class="muted">—</span>' })
        : opts.quotes
          ? { key: 'due', label: 'Valable jusqu\'au', val: d => d.dueDate || '', get: d => C.fmtDate(d.dueDate) }
          : { key: 'type', label: 'Type', asc: true, val: d => d.type, get: d => C.TITLES[d.type] },
      opts.hideClient
        ? { key: 'subject', label: 'Objet', asc: true, val: d => (d.subject || '').toLowerCase(), get: d => h(d.subject || '') || '<span class="muted">—</span>' }
        : { key: 'client', label: 'Client', asc: true, val: d => clientName(d.clientId).toLowerCase(), get: d => `${h(clientName(d.clientId))}${d.subject ? `<div class="small muted">${h(d.subject)}</div>` : ''}` },
      { key: 'date', label: 'Date', val: d => d.date || '', get: d => C.fmtDate(d.date) },
      { key: 'status', label: 'Statut', val: d => effStatus(d), get: d => statusBadge(d) },
      { key: 'amount', label: opts.extra === 'proforma' || !opts.quotes ? 'Net à payer' : 'Total TTC', r: true, val: amountOf, get: d => C.money(amountOf(d), cur(d)) }
    ];
    if (!opts.quotes) cols.push({ key: 'rest', label: 'Reste', r: true, val: d => restOf(d) || 0, get: d => { const x = restOf(d); return x != null && x > 0.0005 ? C.money(x, cur(d)) : '<span class="muted">—</span>'; } });
    return { cols, amountOf, restOf };
  }

  // Liste de documents triable, avec un pied de tableau qui totalise ce qui est affiché.
  // « 1 facture(s), 0 en retard ». La règle du pluriel existait dans l'app cabinet depuis sa 1.0.0
  // et n'avait jamais été portée ici : un logiciel qui écrit « (s) » paraît bâclé, et c'est l'écran
  // que l'utilisateur regarde le plus souvent.
  const pl = (n, un, plur) => `${n} ${n > 1 ? (plur || un + 's') : un}`;

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
          ${d.type === 'devis' && d.status === 'accepté' ? `<button class="btn btn-sm" data-facturer="${d.id}" title="Créer la facture de ce devis">Facturer</button>` : ''}
          ${d.type === 'devis' && ['envoyé', 'expiré'].includes(effStatus(d)) ? `<button class="btn btn-sm" data-accepte="${d.id}" title="Le client a dit oui">Accepté ✓</button><button class="btn btn-sm btn-ghost" data-refuse="${d.id}" title="Le client a dit non">Refusé ✕</button>` : ''}
          ${d.type !== 'avoir' ? `<button class="btn btn-sm btn-ghost" data-dup="${d.id}" title="Dupliquer">⧉</button>` : ''}
        </span></td></tr>`).join('')}
    </tbody>${opts.noFoot ? '' : `<tfoot><tr>
      <td colspan="${Math.max(1, cols.length - (opts.quotes ? 1 : 2))}">${pl(sorted.length, 'document')} · ${C.money(totalHT, cur)} HT${mixed ? ` <span class="muted">(devises étrangères converties en ${h(cur)})</span>` : ''}</td>
      <td class="r">${C.money(totalAmount, cur)}</td>
      ${opts.quotes ? '' : `<td class="r">${totalRest > 0.0005 ? C.money(totalRest, cur) : '<span class="muted">—</span>'}</td>`}
      <td></td></tr></tfoot>`}</table>
      ${paged.pg ? pagerBar(paged.pg, { noun: 'document', grandTotal: opts.grandTotal }) : ''}`;
  }

  function bindDocTable(redraw, state, anchor) {
    $$('tr.clickable[data-id]').forEach(tr => tr.onclick = e => { if (e.target.closest('button')) return; navigate('#/doc/' + tr.dataset.id); });
    $$('button[data-pdf]').forEach(b => b.onclick = () => exportPdf(docById(b.dataset.pdf)));
    $$('button[data-mail]').forEach(b => b.onclick = () => sendByEmail(docById(b.dataset.mail)));
    $$('button[data-paye]').forEach(b => b.onclick = () => paymentForm(docById(b.dataset.paye), () => (redraw || render)()));
    $$('button[data-dup]').forEach(b => b.onclick = () => duplicateDoc(docById(b.dataset.dup)));
    // Facturer depuis la LISTE : c'est le geste qui rapporte de l'argent, et il n'existait qu'au
    // fond d'un menu gris, à l'intérieur du devis. Le panneau « À faire » renvoyait sur cette liste
    // en écrivant « ouvre le devis puis Facturer ▾ » — l'itinéraire au lieu du bouton.
    $$('button[data-facturer]').forEach(b => b.onclick = () => facturerDevis(docById(b.dataset.facturer)));
    // Le statut d'un devis se saisit à la main (contrairement à celui d'une facture, qui se déduit
    // des paiements) : il n'y avait pourtant aucun moyen de répondre « le client a dit oui » depuis
    // la liste. Il fallait ouvrir le devis, trouver le sélecteur, enregistrer. Et « Facturer »
    // n'apparaissait que sur un devis déjà « accepté » — alors que l'éditeur, lui, l'accepte
    // depuis un devis « envoyé » et passe le statut lui-même.
    const repondre = (id, st) => {
      const d = docById(id); if (!d) return;
      const avant = d.status;
      d.status = st; save(true); (redraw || render)();
      toastUndo(`${d.number || 'Devis'} marqué ${st}`, () => { const x = docById(id); if (x) { x.status = avant; save(true); (redraw || render)(); } });
    };
    $$('button[data-accepte]').forEach(b => b.onclick = () => repondre(b.dataset.accepte, 'accepté'));
    $$('button[data-refuse]').forEach(b => b.onclick = () => repondre(b.dataset.refuse, 'refusé'));
    if (redraw) bindSort(document, redraw);
    if (redraw && state) bindPager(document, state, () => redraw(), anchor);
  }

  // Duplication d'un document : nouveau brouillon aux dates du jour, sans paiement ni rattachement
  function duplicateDoc(doc) {
    const isQ = doc.type === 'devis';
    const numbered = isQ || C.EXTRA_TYPES.includes(doc.type);   // ces pièces portent un numéro dès l'enregistrement
    const copy = { ...deepCopy(doc), id: C.uid(), number: '', status: 'brouillon', date: C.today(), createdAt: Date.now(), payments: [], emails: [], reminders: [], attachments: [], withholdingCertificate: false, fromQuoteId: undefined, fromQuoteNumber: undefined, fromDocId: undefined, fromDocType: undefined, fromDocNumber: undefined, deposit: undefined, settles: undefined, recurringId: undefined };
    if (copy.dueDate) copy.dueDate = C.addDays(copy.date, isQ ? company().quoteValidityDays : company().paymentTermsDays);
    if (numbered) copy.number = C.nextNumber(data, doc.type, copy.date);
    data.documents.push(copy); save(true);
    toast(numbered ? 'Copie créée : ' + copy.number : 'Brouillon créé à partir de ' + (doc.number || 'ce brouillon'));
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
      if (!$('#list-wrap')) return;                 // liste vide : l'écran explique au lieu de lister
      if (sortKey) { s.sort = toggleSort(s.sort, sortKey, cols); s.page = 1; }
      const list = mine
        .filter(d => !s.kind || d.type === s.kind)
        .filter(d => !s.year || (d.date || '').startsWith(s.year))
        .filter(d => C.docFiltre(s.st, effStatus(d)))
        .filter(d => !s.q || [d.number, clientName(d.clientId), d.subject, d.reference].join(' ').toLowerCase().includes(s.q))
        .sort(byNumberDesc);
      const filtered = !!(s.q || s.st || s.kind || s.year);
      $('#list-wrap').innerHTML = docTable(list, {
        quotes: isQ, sort: s.sort, onSort: true, page: s, grandTotal: mine.length,
        // `draw` ne tourne que si `#list-wrap` existe, c'est-à-dire s'il y a au moins une pièce :
        // une liste vide ici ne peut venir que d'un filtre. L'autre cas est traité par `etatVide`.
        empty: 'Aucun document ne correspond à ces filtres. Clique « Réinitialiser les filtres » pour tout revoir.'
      });
      const note = $('#f-note');
      if (!note) return bindDocTable(draw, s, '#list-wrap');
      note.hidden = !filtered;
      note.innerHTML = !filtered ? '' :
        `<span class="small muted">${list.length} sur ${mine.length}${s.year && s.yearAuto ? ` · année ${h(s.year)} affichée par défaut` : ''}</span>${filterReset(true)}`;
      if ($('#reset-f')) $('#reset-f').onclick = resetFilters;
      bindDocTable(draw, s, '#list-wrap');
    };
    const resetFilters = () => { s.q = ''; s.st = ''; s.kind = ''; s.year = ''; s.yearAuto = false; s.yearTouched = true; s.page = 1; listView(type); };
    // « Émis » et « À encaisser » regroupent plusieurs statuts : ils passent par `C.docFiltre`, pas
    // par une comparaison de chaîne (voir DOC_FILTRES dans core.js — « Émis » rendait les avoirs).
    const statuses = isQ ? C.DISPLAY_STATUSES.devis : [...C.DISPLAY_STATUSES.facture, 'émis', 'à encaisser'];
    $('#view').innerHTML = `
      <div class="page-head"><h1>${isQ ? 'Devis' : 'Factures'}</h1>
        <div class="actions">${isQ || !data.documents.some(d => d.type === 'facture' && d.status !== 'brouillon' && d.number) ? '' : '<button class="btn" id="new-avoir">+ Avoir</button>'}<button class="btn btn-primary" id="new">+ ${isQ ? 'Nouveau devis' : 'Nouvelle facture'}</button></div></div>
      ${filtersBar(`
        <input type="text" id="q" placeholder="Rechercher : n°, client, objet…" value="${h(s.q)}">
        ${isQ ? '' : `<select id="kind"><option value="">Factures et avoirs</option><option value="facture" ${s.kind === 'facture' ? 'selected' : ''}>Factures</option><option value="avoir" ${s.kind === 'avoir' ? 'selected' : ''}>Avoirs</option></select>`}
        <select id="st"><option value="">Tous les statuts</option>${statuses.map(x => `<option value="${x}" ${s.st === x ? 'selected' : ''}>${h(C.statusLabel(x))}</option>`).join('')}</select>
        ${years.length > 1 ? `<select id="yr"><option value="">Toutes les années</option>${years.map(y => `<option value="${y}" ${s.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}
        ${info('list.filters')}
        <span class="f-note" id="f-note" hidden></span>
        `, mine.length, !!(s.q || s.st || s.kind || s.year))}
      ${mine.length ? '<div id="list-wrap"></div>' : etatVide(
        isQ ? 'Proposer un prix, avant de travailler' : 'Réclamer l\'argent du travail fait',
        isQ
          ? ['Un devis annonce un prix ferme à ton client. Il n\'engage rien tant qu\'il n\'est pas accepté — et une fois accepté, il devient une facture <b>en un clic</b>, sans rien ressaisir.',
             'Tu n\'as pas besoin de créer le client d\'abord : tu le crées depuis le devis.']
          : ['Une facture est la pièce officielle : elle prend son numéro au moment où tu l\'émets, et n\'est plus modifiable ensuite. Pour corriger après coup, on fait un avoir.',
             'SkanFact suit ensuite toute seule ce qu\'on te doit, et te la remonte dans « Relances » dès qu\'elle dépasse son échéance.'],
        [['vide-new', isQ ? '+ Créer mon premier devis' : '+ Créer ma première facture', true],
         ['vide-demo', 'Voir un exemple rempli']])}`;
    if ($('#vide-new')) $('#vide-new').onclick = () => navigate('#/doc/new/' + type);
    if ($('#vide-demo')) $('#vide-demo').onclick = loadDemo;
    $('#new').onclick = () => navigate('#/doc/new/' + type);
    if ($('#new-avoir')) $('#new-avoir').onclick = () => navigate('#/doc/new/avoir');
    if ($('#q')) $('#q').oninput = e => { s.q = e.target.value.toLowerCase(); s.page = 1; draw(); };
    if ($('#st')) $('#st').onchange = e => { s.st = e.target.value; s.page = 1; draw(); };
    if ($('#yr')) $('#yr').onchange = e => { s.year = e.target.value; s.yearAuto = false; s.yearTouched = true; s.page = 1; draw(); };
    if ($('#kind')) $('#kind').onchange = e => { s.kind = e.target.value; s.page = 1; draw(); };
    draw();
  }
  routes.devis = () => listView('devis');
  routes.factures = () => listView('facture');

  // ---------- éditeur de document ----------
  function newDocument(type) {
    const date = C.today();
    const days = Number(type === 'devis' ? company().quoteValidityDays : company().paymentTermsDays) || 30;
    // Une échéance n'a de sens que sur ce qui se paie ou se périme : un bon de livraison n'en a pas.
    const dated = ['devis', 'facture', 'proforma'].includes(type);
    const d = {
      id: C.uid(), type, number: '', date, dueDate: dated ? C.addDays(date, days) : '', clientId: '', subject: '', reference: '',
      lines: [C.newLine(company())],
      discountRate: 0, applyStamp: type === 'facture', status: 'brouillon', notes: '', payments: [],
      withholdingRate: ['facture', 'avoir', 'proforma'].includes(type) ? (Number(company().defaultWithholdingRate) || 0) : 0, createdAt: Date.now(),
      lang: company().defaultLang || 'fr', currency: company().currency, exchangeRate: ''
    };
    if (type === 'contrat') d.clauses = { ...C.DEFAULT_CLAUSES };
    if (type === 'livraison') d.hidePrices = true;
    return d;
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
      const type = ['devis', 'facture', 'avoir'].concat(C.EXTRA_TYPES).includes(parts[1]) ? parts[1] : 'devis';
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
    // Les quatre pièces ajoutées en 2.6.0 se comportent comme un devis : modifiables, numérotées à
    // l'enregistrement, statut choisi à la main. Aucune n'a de valeur comptable.
    const isExtra = C.EXTRA_TYPES.includes(doc.type);
    const isProforma = doc.type === 'proforma', isDelivery = doc.type === 'livraison', isContract = doc.type === 'contrat';
    const hasDue = isQ || isInv || isProforma;
    const backTo = isQ ? '#/devis' : isExtra ? '#/autres/' + doc.type : '#/factures';
    let cur = docCur(doc);
    const locked = C.isLocked(doc) && !unlockedIds.has(doc.id);
    const ro = locked ? 'disabled' : '';
    const stored = isNew ? null : docById(doc.id);
    const bal = isInv && !isNew && doc.status !== 'brouillon' ? balance(stored) : null;
    const canUnlock = locked && isInv && bal && !bal.paid && !bal.credits.length;
    // Le timbre fiscal est fixé EN DINARS (7.0.1) : sur une facture en euros il vaut 1 DT converti,
    // soit 0,29 € au taux 3,4. L'étiquette à côté de la case annonçait le réglage brut — donc
    // « 1,00 € » sur une pièce où le total, lui, comptait 0,29 €. Et une pièce émise garde son
    // propre `stampFee` figé (7.1.0) : c'est celui-là qu'il faut montrer, pas le réglage du jour.
    // L'échéance posée par l'application (30 j par défaut) : tant que `doc.dueDate` lui est égale,
    // c'est qu'elle n'a pas été touchée à la main et elle suit la date du document.
    const joursEcheance = Number(isQ ? company().quoteValidityDays : company().paymentTermsDays) || 30;
    let dueAuto = doc.dueDate;
    const poserDate = (name, iso) => poserDateField(head, name, iso);
    const timbreAffiche = () => {
      const t = C.computeTotals(doc, company());
      if (t.stamp) return t.stamp;
      const brut = doc.stampFee === undefined || doc.stampFee === null || doc.stampFee === ''
        ? Number(company().stampFee) || 0 : Number(doc.stampFee) || 0;
      return C.round3(brut / C.rateOf(doc, company()));
    };
    // Attribuer des numéros de série n'a de sens que sur une pièce qui livre vraiment : facture ou bon
    // de livraison, et seulement si une de ses lignes porte un article suivi par numéro.
    const hasSerials = (isInv || doc.type === 'livraison')
      && (doc.lines || []).some(l => { const it = C.itemOfLine(l, data); return it && it.serialized; });
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

    const NEW_TITLES = { proforma: 'Nouvelle proforma', commande: 'Nouveau bon de commande', livraison: 'Nouveau bon de livraison', contrat: 'Nouveau contrat' };
    const title = isNew ? (isQ ? 'Nouveau devis' : isInv ? 'Nouvelle facture' : isAv ? 'Nouvel avoir' : NEW_TITLES[doc.type]) : docLabel(doc);
    const statusCell = isQ || isExtra
      ? `<label class="field">${lbl('Statut', isQ ? 'ed.statusQuote' : 'ed.statusExtra')}<select name="status">${C.STATUSES[doc.type].map(s => `<option ${s === doc.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`
      : `<div class="field">${lbl('Statut', isInv ? 'ed.statusInvoice' : '')}<div class="status-cell">${isNew || doc.status === 'brouillon' ? `${badge('brouillon')}<span class="small muted">numéro attribué à l'émission</span> ${info('ed.draftNumber')}` : (isInv ? statusBadge(stored) : badge(doc.status))}</div></div>`;

    // Facturer un devis, c'est le geste qui rapporte de l'argent — et c'était la seule porte de
    // toute l'application : un bouton gris, au contenu invisible avant clic, sans aucun double dans
    // la liste ni dans la palette. Le panneau « À faire » en était réduit à écrire l'itinéraire
    // (« Ouvre le devis puis « Facturer ▾ » ») : une application qui doit décrire son propre chemin
    // décrit surtout un bouton mal placé.
    //
    // Dès que le client a dit oui, « Facturer » devient le bouton coloré et convertit directement ;
    // les deux autres chemins (acompte, solde) restent dans le ▾ accolé. « Enregistrer » redevient
    // ordinaire : sur un devis déjà écrit, il ne se passe rien de neuf quand on l'actionne.
    //
    // Et (7.16.0) il ne le propose plus quand c'est DÉJÀ fait. `facturerDevis` marque le devis
    // « accepté » : la condition restait donc vraie après coup, et un second clic sur le bouton
    // coloré fabriquait une seconde facture complète. Avec un acompte émis c'était pire : le bouton
    // principal proposait 100 % du devis pendant que « Facture de solde » dormait dans le ▾.
    const dejaFacture = isNew || !isQ ? [] : C.facturesDuDevis(data, doc.id).filter(d => !d.deposit);
    const devisFacturable = !isNew && isQ && !dejaFacture.length && !issuedDeposits.length
      && (doc.status === 'accepté' || doc.status === 'envoyé');
    const autresChemins = `<button id="deposit">Facture d'acompte… ${info('ed.deposit')}</button>
        ${issuedDeposits.length ? `<button id="settle">Facture de solde (${issuedDeposits.length} acompte${issuedDeposits.length > 1 ? 's' : ''} déduit${issuedDeposits.length > 1 ? 's' : ''}) ${info('ed.settle')}</button>` : ''}
        ${dejaFacture.length || issuedDeposits.length ? `<button id="convert" class="danger">Refacturer la totalité…</button>` : ''}`;
    const facturerMenu = !isNew && isQ
      ? (devisFacturable
        ? `<button class="btn btn-primary" id="convert">Facturer ce devis ${info('ed.convert')}</button>
           <div class="more"><button class="btn" id="bill-btn" aria-label="Autres façons de facturer">▾</button>
             <div class="more-list" id="bill-list" hidden>${autresChemins}</div></div>`
        // Un acompte est émis : le geste suivant est le SOLDE, pas une facture de plus.
        : issuedDeposits.length
        ? `<button class="btn btn-primary" id="settle2">Facture de solde ${info('ed.settle')}</button>
           <div class="more"><button class="btn" id="bill-btn" aria-label="Autres façons de facturer">▾</button>
             <div class="more-list" id="bill-list" hidden>${autresChemins}</div></div>`
        // Déjà facturé : on mène à la facture au lieu d'en proposer une seconde.
        : dejaFacture.length
        ? `<button class="btn" id="voir-facture">Voir ${h(dejaFacture[0].number || 'la facture')}</button>
           <div class="more"><button class="btn" id="bill-btn" aria-label="Autres façons de facturer">▾</button>
             <div class="more-list" id="bill-list" hidden>${autresChemins}</div></div>`
        : `<div class="more"><button class="btn" id="bill-btn">Facturer ▾</button><div class="more-list" id="bill-list" hidden>
             <button id="convert">Convertir en facture ${info('ed.convert')}</button>${autresChemins}
           </div></div>`)
      : '';

    // « Transformer ▾ » : les pièces qu'on peut tirer de celle-ci. Chacune arrive en brouillon.
    const convertibles = isNew ? [] : (C.CONVERSIONS[doc.type] || []).filter(t => t !== 'facture' || !isQ);
    const transformMenu = convertibles.length ? `<div class="more"><button class="btn" id="conv-btn">Transformer ▾</button><div class="more-list" id="conv-list" hidden>
        ${convertibles.map(t => `<button data-conv="${t}">${h(C.CONVERSION_LABELS[t] || C.TITLES[t])}</button>`).join('')}
      </div></div>` : '';

    $('#view').innerHTML = `
      <div class="page-head">
        <div><h1>${h(title)} <span class="dirty-dot" id="dirty-dot" hidden title="Modifications non enregistrées">non enregistré</span></h1>${doc.recurringId ? `<div class="small muted">Générée par un contrat récurrent — <a href="#/contrat/${h(doc.recurringId)}">voir le contrat</a></div>` : ''}</div>
        <div class="actions">
          ${backButton(backTo)}
          <!-- Le bouton existe sur TOUTE pièce enregistrée (7.1.2). Sur un brouillon de facture il
               n'envoie pas — une facture sans numéro n'a pas à partir chez un client — mais il
               explique pourquoi et propose d'émettre. Avant, la ligne « Brouillon » était la seule
               sans bouton Email de toute la liste, et aucun écran ne disait pourquoi. -->
          <!-- L'aperçu se commande depuis la barre d'actions (7.13.0), pas depuis l'aperçu lui-même.
               Avant, le bouton « Masquer » vivait au-dessus de la colonne de droite : une fois
               masqué, il repartait à la FIN du formulaire, c'est-à-dire trois écrans plus bas —
               donc on ne le retrouvait pas, et on croyait l'aperçu perdu. Un interrupteur doit
               rester là où on l'a actionné. « Agrandir » est ce qui manquait le plus : sur un
               écran de portable, la colonne de droite montre un A4 à 45 %, illisible. -->
          <div class="pv-cmd">
            <button class="btn btn-sm" id="pv-toggle" aria-pressed="false">Aperçu</button>
            <button class="btn btn-sm" id="pv-big" title="Voir le document en grand (⌘⇧A)">Agrandir</button>
          </div>
          ${!isNew ? `<button class="btn" id="email">Email</button>` : ''}
          <button class="btn" id="pdf">PDF</button>
          ${locked && isInv && doc.status !== 'annulée' && bal && bal.remaining > 0.0005 ? `<button class="btn btn-primary" id="pay">Enregistrer un paiement</button>` : ''}
          ${facturerMenu}${transformMenu}
          ${!locked ? `<button class="btn ${(isQ || isExtra) && !devisFacturable ? 'btn-primary' : ''}" id="save">Enregistrer${isQ || isExtra ? '' : ' le brouillon'}</button>` : ''}
          ${!locked && (isInv || isAv) ? `<button class="btn btn-primary" id="issue">${isInv ? 'Émettre la facture' : 'Émettre l\'avoir'}</button> ${info('ed.issue')}` : ''}
          ${!isNew && (!isAv || !locked) ? `<div class="more"><button class="btn" id="more-btn" aria-label="Autres actions">Plus ▾</button><div class="more-list" id="more-list" hidden>
            ${!isAv ? `<button id="dup">Dupliquer</button><button id="as-template">Enregistrer comme modèle…</button>` : ''}
            ${hasSerials ? `<button id="serials">Numéros de série livrés…</button>` : ''}
            ${isInv ? `<button id="make-recurring">Rendre récurrent (contrat)… ${info('ed.recurring')}</button>` : ''}
            ${locked && isInv && doc.status !== 'annulée' ? `<button id="credit">Créer un avoir…</button>` : ''}
            ${canUnlock ? `<button id="unlock">Modifier malgré l'émission…</button>` : ''}
            ${!locked ? `<button id="del" class="danger">Supprimer</button>` : ''}
          </div></div>` : ''}
        </div></div>
      ${!locked ? '' : `<div class="banner info lock-banner">
        <span><b>Cette pièce est émise : elle ne se modifie plus.</b> C'est la règle qui rend une
        numérotation crédible — un numéro attribué ne doit jamais désigner deux contenus différents.
        ${isInv && doc.status !== 'annulée'
          ? 'Pour corriger, on fabrique un avoir : il annule tout ou partie de celle-ci, et les deux pièces restent.'
          : 'Tu peux la lire, l\'imprimer, l\'envoyer et l\'exporter : seule la modification est fermée.'}
        ${info('ed.locked')}</span>
        <span class="lock-go">
          ${isInv && doc.status !== 'annulée' ? '<button class="btn btn-sm btn-primary" id="lock-credit">Corriger par un avoir…</button>' : ''}
          ${canUnlock ? '<button class="btn btn-sm" id="lock-unlock">Modifier quand même…</button>'
            : (isInv && doc.status !== 'annulée' ? `<span class="small" title="${h(bal && bal.paid ? 'Cette facture est soldée.' : 'Cette facture a déjà reçu un paiement ou un avoir.')}">Plus déverrouillable${bal && bal.credits.length ? ' (un avoir existe)' : (bal && (bal.paid || bal.remaining < C.computeTotals(doc, company()).netToPay) ? ' (déjà payée en partie)' : '')}</span>` : '')}
        </span></div>`}
      <div class="editor">
        <div>
          <div class="panel"><h2>Informations</h2>
            <form id="f-head" class="grid-3">
              <div class="field">${lbl('Client', 'ed.client')}
                ${combo({ name: 'clientId', value: doc.clientId, items: clientItems(), placeholder: '— Choisir un client —', search: 'Rechercher : nom, contact, MF…', add: locked ? null : '+ Nouveau client', ro: locked })}
                <button type="button" class="btn btn-sm btn-ghost mt" id="cl-edit" ${doc.clientId ? '' : 'hidden'} title="Corriger l'adresse, le matricule, l'email de ce client">✎ Fiche du client</button>
              </div>
              ${isAv ? `<div class="field span-2">Facture concernée${combo({ name: 'creditOf', value: doc.creditOf, items: invoiceItems(), placeholder: '— Facture concernée —', search: 'Rechercher : n°, client, objet…', ro: locked })}</div>` : ''}
              ${dateFieldHtml(lbl('Date', 'ed.date'), 'date', doc.date, { ro: locked })}
              ${hasDue ? dateFieldHtml(isQ ? lbl('Valable jusqu\'au', 'ed.validUntil') : lbl('Échéance', 'ed.due'), 'dueDate', doc.dueDate, { ro: locked, quick: true }) : ''}
              ${hasDue ? '<div class="small muted" id="due-auto" hidden></div>' : ''}
              <label class="field span-2">${lbl('Objet', 'ed.subject')}<input type="text" name="subject" value="${h(doc.subject)}" placeholder="Ex : Audit de sécurité du réseau" ${ro}></label>
              ${field(lbl('Référence (optionnel)', 'ed.reference'), 'reference', doc.reference || '', 'text', ro)}
              <div class="field">${lbl('Affaire (optionnel)', 'ed.project')}
                ${combo({ name: 'projectId', value: doc.projectId || '', items: projectItems(doc.clientId), placeholder: '— Aucune affaire —', search: 'Rechercher une affaire…', add: locked ? null : '+ Nouvelle affaire', ro: locked })}
              </div>
              ${isAv ? field('Motif de l\'avoir', 'creditReason', doc.creditReason || '', 'text', ro + ' placeholder="Erreur de facturation, remise commerciale…"') : ''}
              <label class="field">${lbl('Langue du document', 'ed.lang')}<select name="lang" ${ro}><option value="fr" ${doc.lang !== 'en' ? 'selected' : ''}>Français</option><option value="en" ${doc.lang === 'en' ? 'selected' : ''}>English</option></select></label>
              <label class="field">${lbl('Devise', 'ed.docCurrency')}<select name="currency" ${ro}>${C.CURRENCIES.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
              <label class="field" id="rate-field" ${cur === company().currency ? 'hidden' : ''}><span class="fl"><span class="rate-lbl">Taux : 1 ${h(cur)} = ? ${h(company().currency)}</span> <span class="req">obligatoire</span> ${info('ed.rate')}</span><input type="number" name="exchangeRate" value="${h(doc.exchangeRate || '')}" step="0.0001" min="0" class="num" placeholder="ex. 3.4" ${ro}></label>
              ${statusCell}
              ${field(lbl('Remise globale (%)', 'ed.discount'), 'discountRate', doc.discountRate || 0, 'number', 'min="0" max="100" step="0.5" class="num" ' + ro)}
              ${isInv || isAv || isProforma ? `<label class="field">${lbl('Retenue à la source', 'ed.withholding')}<select name="withholdingRate" ${ro}>${withholdingOptions(doc.withholdingRate)}</select></label>` : ''}
              ${isInv || isAv || isProforma ? `<label class="check" style="align-self:end"><input type="checkbox" name="applyStamp" ${doc.applyStamp === true || (isInv && doc.applyStamp !== false) ? 'checked' : ''} ${ro}> Timbre fiscal (<span id="stamp-lbl">${C.money(timbreAffiche(), cur)}</span>) ${info(isProforma ? 'ed.stampProforma' : 'ed.applyStamp')}</label>` : ''}
              ${isDelivery ? `<label class="check" style="align-self:end"><input type="checkbox" name="hidePrices" ${doc.hidePrices !== false ? 'checked' : ''}> Masquer les prix sur le bon ${info('ed.hidePrices')}</label>` : ''}
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
          ${isContract ? `<div class="panel"><h2>Clauses du contrat ${info('ed.clauses')}</h2>
            <p class="small muted mb">Ces textes s'impriment sur le contrat, numérotés dans l'ordre. Vide un champ pour retirer la clause. Ce sont des formulations courantes, pas un conseil juridique : <em>à faire relire par un juriste ou ton comptable</em> avant la première signature.</p>
            <form id="f-clauses">${C.CLAUSE_LABELS.map(([k, label]) =>
              `<label class="field mb">${h(label)}<textarea name="${k}" rows="2" ${ro}>${h((doc.clauses || {})[k] || '')}</textarea></label>`).join('')}
            <button type="button" class="btn btn-sm" id="reset-clauses">Revenir aux textes proposés</button></form></div>` : ''}
          <!-- Le panneau existe MÊME sur une pièce neuve (7.1.2). Il n'apparaissait qu'après
               l'enregistrement : quelqu'un qui saisissait sa première facture avec la photo du
               justificatif ouverte à côté ne trouvait aucun endroit où l'accrocher, et en concluait
               que l'application ne sait pas faire. Une pièce jointe a besoin d'un identifiant, donc
               d'un enregistrement : le panneau le dit, et propose de l'enregistrer tout de suite. -->
          <div class="panel"><h2>Pièces jointes ${info('ed.attachments')}</h2>
            ${isNew
              ? `<p class="small muted">Bon de commande du client, photo d'un justificatif, plan, contrat signé :
                 tout ce qui doit rester avec cette pièce. Les pièces jointes s'attachent à un document enregistré —
                 <b>enregistre d'abord</b>, le panneau s'ouvre ensuite.</p>
                 <button type="button" class="btn btn-sm mt" id="att-save-first">Enregistrer maintenant pour joindre un fichier</button>`
              : '<div id="attachments"></div>'}
          </div>
          ${isNew ? '' : `<div class="panel"><h2>Historique ${info('ed.history')}</h2><div id="doc-history"></div></div>`}
          <div class="panel"><h2>Notes (affichées sur le document) ${info('ed.notes')}</h2>
            ${!locked && data.snippets.length ? `<div class="catalog-pick"><div id="snip-pick">${combo({ items: [], placeholder: 'Insérer un texte prédéfini…', search: 'Rechercher un texte…' })}</div></div>` : ''}
            <textarea id="notes" placeholder="Conditions particulières, mentions…" ${ro}>${h(doc.notes || '')}</textarea>
          </div>
        </div>
        <div class="preview">
          <div class="pv-head"><span class="k-label">Aperçu ${info('ed.preview')}</span><span class="pv-pages" id="pv-pages"></span>
            <button class="btn btn-ghost btn-sm" id="pv-hide">Agrandir</button></div>
          <iframe id="preview" title="Aperçu du document"></iframe>
        </div>
      </div>`;
    // Aperçu masqué : le choix est mémorisé d'un document à l'autre. La colonne disparaît ENTIÈREMENT
    // quand il est masqué — un bouton isolé au bas du formulaire ne se retrouve pas — et c'est
    // l'interrupteur de la barre d'actions, en haut, qui le ramène.
    const applyPreview = () => {
      const ed = $('.editor'); if (!ed) return;
      ed.classList.toggle('no-preview', previewHidden);
      const t = $('#pv-toggle');
      if (t) {
        t.textContent = previewHidden ? 'Afficher l\'aperçu' : 'Aperçu';
        t.classList.toggle('on', !previewHidden);
        t.setAttribute('aria-pressed', previewHidden ? 'false' : 'true');
        t.title = previewHidden ? 'Remettre l\'aperçu du document à droite' : 'Masquer l\'aperçu et travailler sur toute la largeur';
      }
    };
    $('#pv-toggle').onclick = () => {
      previewHidden = !previewHidden;
      try { localStorage.setItem('skanfact.preview', previewHidden ? '0' : '1'); } catch (_) {}
      applyPreview(); if (!previewHidden) drawPreview();
    };
    $('#pv-hide').onclick = () => apercuPleinEcran();
    $('#pv-big').onclick = () => apercuPleinEcran();
    applyPreview();

    // --- modifications non enregistrées : marqueur visible + garde-fou à la navigation
    let dirty = false;
    function touch() {
      if (dirty || locked) return;
      dirty = true;
      const el = $('#dirty-dot'); if (el) el.hidden = false;
      const s = $('#save'); if (s) s.classList.add('btn-primary');
      reportDirty();
    }
    function untouch() { dirty = false; const el = $('#dirty-dot'); if (el) el.hidden = true; reportDirty(); }
    if (!locked) setGuard({
      dirty: () => dirty,
      what: isQ ? 'ce devis' : isInv ? 'cette facture' : isAv ? 'cet avoir' : 'ce ' + (C.TITLES[doc.type] || 'document').toLowerCase(),
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
          if (el.type === 'number') {
            // `Number('')` vaut 0 : effacer une quantité pour la retaper faisait passer la ligne à
            // zéro, donc le total du document, donc l'aperçu — sans un mot. On ne retient rien tant
            // que le champ n'est pas lisible ; le marquage dit que la valeur affichée n'est pas celle
            // qui est retenue. (`badInput` : « 12,,5 » ou « e » dans un champ numérique.)
            const vide = el.value.trim() === '' || el.validity.badInput;
            el.classList.toggle('champ-faute', vide);
            if (vide) return;
            doc.lines[i][el.dataset.k] = Number(el.value);
          } else {
            doc.lines[i][el.dataset.k] = el.value;
          }
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
        doc.lines.splice(i, 1); if (!doc.lines.length) doc.lines.push(C.newLine(company()));
        reindex(k => k > i ? k - 1 : k); openDesc.delete(doc.lines.length);
        touch(); drawLines();
      });
      $$('[data-desc]', linesBody).forEach(b => b.onclick = () => { openDesc.add(Number(b.dataset.desc)); drawLines(); const ta = $$('textarea[data-k=description]', linesBody).pop(); if (ta) ta.focus(); });
      refreshTotals();
    }
    if ($('#add-line')) $('#add-line').onclick = () => { doc.lines.push(C.newLine(company())); touch(); drawLines(); $$('input[data-k=label]', linesBody).pop().focus(); };
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
        // `itemId` rattache la ligne à l'article : c'est lui qui fait le lien avec le stock, même si le
        // libellé est retouché ensuite. Les lignes plus anciennes restent rattrapées par leur libellé.
        doc.lines.push({ label: it.label, description: it.description || '', qty: 1, unit: it.unit || '', unitPrice: it.unitPrice, unitCost: it.unitCost || '', vatRate: it.vatRate, itemId: it.id });
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
    // Voir la note de l'éditeur d'achat : la fermeture de la liste déroulante émet un `change` anonyme
    // qui a déjà recopié le nouveau client dans `doc`. On mémorise donc le dernier client appliqué.
    let appliedClient = doc.clientId;
    head.oninput = head.onchange = (e) => {
      Object.assign(doc, formValues(head));
      touch();
      const setRateLabel = () => { const rf = $('#rate-field', head); rf.hidden = cur === company().currency; $('.rate-lbl', rf).textContent = `Taux : 1 ${cur} = ? ${company().currency}`; };
      if (e && e.target && e.target.name === 'currency') {
        cur = docCur(doc);
        setRateLabel();
        drawLines();
      }
      if (e && e.target && e.target.name === 'clientId' && doc.clientId !== appliedClient && doc.status === 'brouillon') {
        appliedClient = doc.clientId;
        // nouveau client : on reprend son taux de retenue à la source, sa langue et sa devise
        if (!isQ) { doc.withholdingRate = clientWithholding(doc.clientId); const sel = $('select[name=withholdingRate]', head); if (sel) sel.innerHTML = withholdingOptions(doc.withholdingRate); }
        applyClientDefaults(doc, doc.clientId);
        $('select[name=lang]', head).value = doc.lang || 'fr'; $('select[name=currency]', head).value = docCur(doc);
        cur = docCur(doc); setRateLabel();
        // les affaires proposées suivent le client : celles d'un autre client n'ont rien à faire ici
        if (projectCombo) projectCombo.setItems(projectItems(doc.clientId));
        majFicheClient();
        drawLines();
      }
      if (e && e.target && e.target.name === 'creditOf') {
        const inv = docById(doc.creditOf); if (inv) { doc.creditOfNumber = inv.number; if (!doc.clientId) { doc.clientId = inv.clientId; clientCombo.setValue(inv.clientId, true); } }
      }
      // Changer la date ne recalculait jamais l'échéance : on corrigeait la date d'une facture et
      // elle restait due au 30e jour de l'ANCIENNE. On ne recalcule que tant que l'échéance est
      // restée celle que l'application avait posée — une date saisie à la main ne s'écrase jamais.
      if (e && e.target && e.target.name === 'date' && doc.date && dueAuto && doc.dueDate === dueAuto) {
        const neuf = C.addDays(doc.date, joursEcheance);
        if (neuf !== doc.dueDate) {
          doc.dueDate = neuf; dueAuto = neuf;
          poserDate('dueDate', neuf);
          const note = $('#due-auto', head);
          if (note) { note.textContent = `Échéance recalculée au ${C.fmtDate(neuf)} (${joursEcheance} j). Change-la si besoin.`; note.hidden = false; }
        }
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
    // Une adresse fausse ou un matricule oublié se découvrent EN REGARDANT l'aperçu : il fallait
    // pourtant quitter le document (donc le garde-fou « modifications non enregistrées »), aller aux
    // Clients, chercher la fiche, corriger, revenir. Tout existait déjà — le formulaire, la pile de
    // fenêtres, le redessin de l'aperçu : il manquait le bouton.
    const majFicheClient = () => {
      const b = $('#cl-edit', head);
      if (b) b.hidden = !doc.clientId;
    };
    if ($('#cl-edit', head)) $('#cl-edit', head).onclick = () => {
      const c = clientById(doc.clientId); if (!c) return;
      clientForm(c, () => { clientCombo.setItems(clientItems()); refreshTotals(); schedulePreview(); });
    };
    majFicheClient();
    bindCombo($('[data-combo=creditOf]', head), { items: invoiceItems(), placeholder: '— Facture concernée —' });
    const projectCombo = bindCombo($('[data-combo=projectId]', head), {
      items: projectItems(doc.clientId), placeholder: '— Aucune affaire —',
      onAdd: () => projectForm(null, p => {
        projectCombo.setItems(projectItems(doc.clientId)); projectCombo.setValue(p.id); doc.projectId = p.id; touch();
      }, { clientId: doc.clientId || '', startDate: doc.date || C.today() })
    });

    // --- totaux + aperçu
    let previewTimer = null;
    function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(drawPreview, 250); }
    previewRedraw = schedulePreview;
    function drawPreview() {
      const pv = $('#preview'); if (!pv || previewHidden) return; // masqué, ou l'utilisateur a quitté l'éditeur
      const html = C.documentHtml(doc, clientById(doc.clientId), company(), { preview: true, stampText: stampFor(doc), zoom: Math.max(0.3, Math.floor((pv.clientWidth - 2) / 794 * 100) / 100) });
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
      if ($('#pv-full')) dessinerPleinEcran();
    }

    // ---------- l'aperçu en grand (7.13.0) ----------
    //
    // Pourquoi : la colonne de droite fait 430 px, et une page A4 en fait 794. Le document y est
    // donc affiché à 54 % — et à 35 % sur un portable de 1280 px, où la colonne tombe à 350. On
    // voit une mise en page, on ne LIT rien : ni un prix, ni une désignation, ni une mention
    // légale. C'est pourtant la seule chose que le client, lui, verra.
    //
    // Le zoom est explicite (`pvZoom`), avec « Ajuster » comme valeur de départ : un aperçu qui
    // décide seul de sa taille ne se corrige pas quand il se trompe.
    let pvZoom = null;                                  // null = la page entière à l'écran
    const PV_PAS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2, 2.5];
    // « Ajuster » montre la PAGE ENTIÈRE, pas seulement sa largeur. Mesuré dans l'application : caler
    // sur la largeur seule donnait 177 % à 1440 px — le haut de la facture remplissait l'écran et il
    // fallait défiler pour voir le total. Un aperçu « ajusté » qu'on doit faire défiler n'est pas
    // ajusté. Les 60 px sont le `padding: 8mm 0` que le gabarit d'aperçu pose autour de la page.
    function pvAjuste() {
      const b = $('#pv-full-frame'); if (!b) return 1;
      const l = b.parentElement.clientWidth - 28;
      const ht = b.parentElement.clientHeight - 28;
      return Math.max(0.3, Math.floor(Math.min(l / 794, ht / 1190) * 100) / 100);
    }
    function dessinerPleinEcran() {
      const f = $('#pv-full-frame'); if (!f) return;
      const z = pvZoom || pvAjuste();
      const val = $('#pv-zoom-val'); if (val) val.textContent = pvZoom ? Math.round(z * 100) + ' %' : 'Ajusté (' + Math.round(z * 100) + ' %)';
      f.onload = () => {
        try {
          const compact = C.fitToPage(f.contentDocument);
          const pages = C.pageCount(f.contentDocument);
          const el = $('#pv-full-pages');
          if (el) { el.textContent = pages <= 1 ? (compact ? '1 page (resserrée)' : '1 page') : pages + ' pages'; el.className = 'pv-pages' + (pages > 1 ? ' warn' : ''); }
        } catch (_) { /* aperçu indisponible */ }
      };
      f.srcdoc = C.documentHtml(doc, clientById(doc.clientId), company(), { preview: true, stampText: stampFor(doc), zoom: z });
    }
    function fermerPleinEcran() {
      const el = $('#pv-full'); if (!el) return;
      el.remove();
      document.removeEventListener('keydown', pvTouche, true);
    }
    function pvTouche(e) {
      // Une fenêtre ouverte par-dessus (une confirmation) garde la priorité sur Échap : sinon on
      // ferme l'aperçu et la question reste seule au milieu de l'écran.
      if (e.key !== 'Escape' || $('#modal-root').children.length) return;
      e.preventDefault(); e.stopPropagation(); fermerPleinEcran();
    }
    function apercuPleinEcran() {
      if ($('#pv-full')) return fermerPleinEcran();
      const el = document.createElement('div');
      el.id = 'pv-full';
      el.innerHTML = `<div class="pv-full-bar">
          <span class="k-label">${h(doc.number || title)}</span>
          <span class="pv-pages" id="pv-full-pages"></span>
          <div class="pv-zoom">
            <button class="btn btn-sm" id="pv-zoom-out" title="Réduire">−</button>
            <span id="pv-zoom-val" class="small muted"></span>
            <button class="btn btn-sm" id="pv-zoom-in" title="Agrandir">+</button>
            <button class="btn btn-sm" id="pv-fit">Ajuster</button>
          </div>
          <button class="btn btn-sm" id="pv-full-pdf">Exporter en PDF</button>
          <button class="btn btn-sm btn-primary" id="pv-full-close">Fermer</button>
        </div>
        <div class="pv-full-body"><iframe id="pv-full-frame" title="Aperçu du document en grand"></iframe></div>`;
      document.body.appendChild(el);
      // On monte au premier palier strictement au-dessus, on descend au premier strictement en
      // dessous : le zoom actuel peut être une valeur « ajustée » quelconque (0,91), pas un palier.
      const bouger = (sens) => {
        const courant = pvZoom || pvAjuste();
        const suivant = sens > 0
          ? PV_PAS.find(p => p > courant + 0.001)
          : PV_PAS.slice().reverse().find(p => p < courant - 0.001);
        if (suivant === undefined) return toast(sens > 0 ? 'Zoom maximum atteint.' : 'Zoom minimum atteint.');
        pvZoom = suivant;
        dessinerPleinEcran();
      };
      $('#pv-zoom-in').onclick = () => bouger(1);
      $('#pv-zoom-out').onclick = () => bouger(-1);
      $('#pv-fit').onclick = () => { pvZoom = null; dessinerPleinEcran(); };
      $('#pv-full-close').onclick = fermerPleinEcran;
      $('#pv-full-pdf').onclick = () => exportPdf(doc);
      el.onclick = e => { if (e.target === el) fermerPleinEcran(); };
      document.addEventListener('keydown', pvTouche, true);
      dessinerPleinEcran();
    }
    // Le raccourci est écrit sur le bouton : ⌘⇧A (Ctrl+Maj+A) ouvre et referme le grand aperçu.
    pleinEcranCourant = apercuPleinEcran;
    function refreshTotals() {
      const t = C.computeTotals(doc, company());
      const lbl2 = $('#stamp-lbl'); if (lbl2) lbl2.textContent = C.money(timbreAffiche(), cur);
      t.lines.forEach((l, i) => { const c = $(`[data-total="${i}"]`); if (c) c.textContent = C.money(l.ht, null, C.decimalsFor(cur)); });
      $('#totals').innerHTML = `<table>
        <tr><td>Total HT</td><td>${C.money(t.totalHT, cur)}</td></tr>
        ${t.discount ? `<tr><td>Remise ${pct(t.discountRate)}%</td><td>- ${C.money(t.discount, cur)}</td></tr><tr><td>Net HT</td><td>${C.money(t.netHT, cur)}</td></tr>` : ''}
        <tr><td>TVA</td><td>${C.money(t.totalVAT, cur)}</td></tr>
        ${t.stamp ? `<tr><td>Timbre fiscal</td><td>${C.money(t.stamp, cur)}</td></tr>` : ''}
        ${t.withholding ? `<tr><td>Total TTC</td><td>${C.money(t.totalTTC, cur)}</td></tr><tr><td>Retenue à la source ${pct(t.withholdingRate)}%</td><td>- ${C.money(t.withholding, cur)}</td></tr>` : ''}
        <tr class="grand"><td>${isInv || isProforma ? 'Net à payer' : isAv ? 'Montant de l\'avoir' : 'Total TTC'}</td><td>${C.money(isInv || isAv || isProforma ? t.netToPay : t.totalTTC, cur)}</td></tr></table>`;
      // Marge estimée : affichée seulement quand au moins une ligne a un coût connu, et jamais sur un avoir
      // (un avoir n'a pas de marge : c'est une vente qu'on annule).
      if (doc.type !== 'avoir') {
        const m = C.documentMargin(doc, data, company());
        if (m.costed) {
          const el = document.createElement('div');
          el.className = 'small muted mt';
          el.innerHTML = `Marge estimée : <strong class="${m.margin < 0 ? 'warn-text' : ''}">${C.money(m.margin, cur)}</strong>`
            + (m.rate == null ? '' : ` <span class="muted">(${pct(m.rate)} %)</span>`)
            + (m.complete ? '' : ' <span class="muted" title="Toutes les lignes n\'ont pas de coût de revient : la marge est surestimée">≈</span>')
            + ` ${info('ed.margin')}`;
          $('#totals').appendChild(el);
        }
      }
      schedulePreview();
    }

    // --- paiements (facture émise)
    function drawPayments() {
      const el = $('#pay-body'); if (!el) return;
      const cur = docCur(doc);
      const s = docById(doc.id); const b = balance(s); const t = b.totals;
      const rows = (s.payments || []).slice().sort((a, x) => (a.date || '').localeCompare(x.date || ''));
      const plusieursComptes = (data.accounts || []).length > 1;
      el.innerHTML = `
        <div class="pay-grid">
          <div><div class="k-label">Net à payer</div><div class="v">${C.money(t.netToPay, cur)}</div>${t.withholding ? `<div class="small muted">TTC ${C.money(t.totalTTC, cur)} − RS ${C.money(t.withholding, cur)} ${info('ed.withholding')}</div>` : ''}</div>
          <div><div class="k-label">Avoirs ${info('ed.credit')}</div><div class="v">${C.money(b.credited, cur)}</div>${b.credits.length ? `<div class="small">${b.credits.map(a => `<a href="#/doc/${a.id}">${h(a.number)}</a>`).join(', ')}</div>` : ''}</div>
          <div><div class="k-label">Payé</div><div class="v">${C.money(b.paid, cur)}</div></div>
          <div><div class="k-label">Reste à payer</div><div class="v ${b.remaining > 0.0005 ? 'due' : 'ok'}">${C.money(Math.max(0, b.remaining), cur)}</div>${b.remaining < -0.0005 ? `<div class="small muted">trop-perçu ${C.money(-b.remaining, cur)}</div>` : ''}</div>
        </div>
        ${rows.length ? `<table class="list compact"><thead><tr><th>Date</th><th>Mode</th>${plusieursComptes ? '<th>Compte</th>' : ''}<th>Référence</th><th class="r">Montant</th><th></th></tr></thead><tbody>
          ${rows.map(p => `<tr><td>${C.fmtDate(p.date)}</td><td>${h(methodLabel(p.method))}</td>${plusieursComptes ? `<td>${h(accountLabel(p.accountId))}</td>` : ''}<td>${h(p.reference || '')}${p.note ? `<div class="small muted">${h(p.note)}</div>` : ''}</td><td class="r">${C.money(p.amount, cur)}</td><td class="actions"><button class="btn btn-ghost btn-sm" data-edpay="${p.id}" title="Modifier">✎</button><button class="btn btn-ghost btn-sm" data-rmpay="${p.id}" title="Supprimer">✕</button></td></tr>`).join('')}
        </tbody></table>` : `<p class="small muted">Aucun paiement enregistré.</p>`}
        <div class="inline mt">
          ${s.status !== 'annulée' && b.remaining > 0.0005 ? `<button class="btn btn-primary" id="pay2">+ Enregistrer un paiement</button>` : ''}
          ${t.withholding ? `<label class="check"><input type="checkbox" id="rs-cert" ${s.withholdingCertificate ? 'checked' : ''}> Attestation de retenue à la source reçue (${C.money(t.withholding, cur)}) ${info('compta.rs')}</label>` : ''}
          ${s.status === 'annulée' ? `<span class="muted small">Facture annulée.</span><button class="btn btn-ghost btn-sm" id="uncancel">Rétablir</button>` : (!b.paid && !b.credits.length ? `<button class="btn btn-ghost btn-sm" id="cancel-inv">Marquer annulée…</button>` : '')}
        </div>`;
      $$('[data-rmpay]', el).forEach(btn => btn.onclick = async () => {
        if (!await confirmDialog('Supprimer ce paiement ?')) return;
        const gone = (s.payments || []).find(p => p.id === btn.dataset.rmpay);
        if (gone && closedToast(gone.date, 'Ce paiement ne peut pas être supprimé')) return;
        s.payments = s.payments.filter(p => p.id !== btn.dataset.rmpay); save(true); render();
      });
      $$('[data-edpay]', el).forEach(btn => btn.onclick = () => {
        const p = (s.payments || []).find(x => x.id === btn.dataset.edpay);
        if (p) paymentForm(s, () => render(), p);
      });
      if ($('#pay2')) $('#pay2').onclick = () => paymentForm(s, () => render());
      if ($('#rs-cert')) $('#rs-cert').onchange = e => { s.withholdingCertificate = e.target.checked; save(true); };
      if ($('#cancel-inv')) $('#cancel-inv').onclick = async () => {
        if (!await confirmDialog(`Marquer ${s.number} comme annulée ? La facture reste dans la numérotation. La façon conforme de corriger une facture émise est d'établir un avoir.`, 'Marquer annulée')) return;
        if (closedBlock(s.date, 'Cette facture')) return;
        s.status = 'annulée'; save(true); render();
      };
      if ($('#uncancel')) $('#uncancel').onclick = () => {
        if (closedBlock(s.date, 'Cette facture')) return;
        s.status = 'envoyée'; save(true); render();
      };
    }

    // --- actions
    function validate() {
      // Un refus qui ne montre pas le champ fautif oblige à relire tout le formulaire. Sur un devis
      // de huit lignes, la barre d'actions est en haut et la ligne oubliée en bas : le bandeau noir
      // passait deux secondes et demie tout en bas de l'écran, pendant qu'on regardait le haut.
      if (!doc.clientId) return refus('[data-combo=clientId] .combo-btn', 'Choisis un client.');
      // Un taux de change absent ne se voit nulle part et fausse TOUT : le journal des ventes, la
      // TVA à déclarer, le chiffre d'affaires, le tableau de bord et le paquet du comptable comptent
      // alors 1 euro = 1 dinar. C'est le seul champ de l'application dont l'oubli change des chiffres
      // ailleurs sans rien afficher ici — il est donc obligatoire, pas conseillé.
      if (C.missingRate(doc, company())) {
        return refus('[name=exchangeRate]',
          `Indique le taux de change : combien vaut 1 ${doc.currency} en ${company().currency} ? Sans lui, toute ta comptabilité compterait 1 ${doc.currency} = 1 ${company().currency}.`);
      }
      if (isAv && !doc.creditOf) return refus('[data-combo=creditOf] .combo-btn', 'Indique la facture concernée par l\'avoir.');
      if (!doc.lines.some(l => l.label && l.label.trim())) return refus('#lines input[data-k=label]', 'Ajoute au moins une ligne avec une désignation.');
      if (hasDue && doc.dueDate && doc.date && doc.dueDate < doc.date) return refus('[name=dueDate]', `${isQ ? 'La validité' : 'L\'échéance'} ne peut pas précéder la date du document.`);
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
      // Vendre ce qu'on n'a pas : la pièce reste émissible (une commande peut partir avant la livraison
      // du fournisseur), mais on le dit — un stock négatif est presque toujours une saisie manquante.
      if (isInv || doc.type === 'livraison') {
        C.stockImpact(doc, data).forEach(x => w.push(
          `Stock insuffisant sur « ${x.label} » : il en reste ${pct(x.have)}${x.unit ? ' ' + x.unit : ''} et cette pièce en sort ${pct(x.need)}. Le stock passerait à ${pct(x.after)}. Vérifie qu'une facture d'achat n'a pas été oubliée.`));
      }
      // Une ligne à zéro est légitime (une prestation offerte), mais c'est aussi la trace d'une
      // quantité effacée et jamais retapée. On la nomme avant d'émettre : après, la pièce est
      // verrouillée et il faut un avoir.
      (doc.lines || []).filter(l => (l.label || '').trim() && !l.noDiscount
        && (!(Number(l.qty) > 0) || !(Number(l.unitPrice) > 0)))
        .forEach(l => w.push(`La ligne « ${l.label} » est à 0 : ${!(Number(l.qty) > 0) ? 'quantité' : 'prix unitaire'} manquant. Si c'est une prestation offerte, ignore cet avertissement.`));
      return w;
    }
    // L'avertissement « ta fiche société est incomplète » n'existait que sur `#issue`, c'est-à-dire
    // pour les factures et les avoirs. Or la première pièce qu'un débutant fabrique est un devis —
    // « Tes premiers pas » le lui demande en quatrième ligne — et le devis s'exporte par `#pdf`,
    // qui ne contrôlait rien. Il partait chez le premier client avec un nom, pas de matricule et
    // pas d'adresse, alors que l'application le savait et l'écrivait sur son propre accueil.
    // Une seule fois : c'est un rattrapage du premier jour, pas un rappel de tous les matins.
    async function premierEnvoiOk() {
      const co = company();
      if (co.premierExportAverti) return true;
      const gaps = C.companyGaps(co);
      if (!gaps.length) return true;
      if (data.documents.some(d => d.number && d.id !== doc.id)) return true;   // plus le premier jour
      const c = await choiceDialog('Avant d\'envoyer ce document',
        `Il manque ${C.liste(gaps)} sur ta fiche société. Ces informations s'impriment en haut du document, et le matricule fiscal est obligatoire sur une facture en Tunisie.`,
        'Compléter ma fiche', 'Exporter quand même');
      if (!c) return false;
      if (c === 'a') { allerParametres('societe', 'p-identite'); return false; }
      co.premierExportAverti = true; save();
      return true;
    }
    function persist() {
      if (!validate()) return false;
      // L'ancienne date compte autant que la nouvelle : déplacer une pièce hors d'un mois clos
      // contournerait la clôture aussi sûrement que d'en créer une dedans.
      const was = (data.documents.find(d => d.id === doc.id) || {}).date;
      if (closedBlock([was, doc.date], 'Ce document')) return false;
      // Licence : seule la CRÉATION est retenue. Modifier ou corriger une pièce existante reste
      // possible — sinon une licence expirée empêcherait de réparer une faute de frappe.
      if (!data.documents.some(d => d.id === doc.id) && licenceBlock('Créer un nouveau document')) return false;
      if ((isQ || isExtra) && !doc.number) doc.number = C.nextNumber(data, doc.type, doc.date);
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
      // Avant `nextNumber` : le compteur est écrit même quand l'enregistrement échoue ensuite. Un
      // garde-fou posé après aurait troué la numérotation à chaque tentative refusée.
      if (closedBlock(doc.date, 'Cette pièce')) return false;
      if (!data.documents.some(d => d.id === doc.id) && licenceBlock('Émettre une nouvelle pièce')) return false;
      if (!doc.number) doc.number = C.nextNumber(data, doc.type, doc.date);
      // Le timbre se fige ici, avec le numéro : les deux deviennent définitifs au même instant.
      // Sans ça, changer le réglage du timbre réécrivait le total des factures déjà envoyées.
      if (doc.stampFee === undefined || doc.stampFee === null || doc.stampFee === '') doc.stampFee = Number(company().stampFee) || 0;
      doc.status = isInv ? 'envoyée' : 'émis';
      unlockedIds.delete(doc.id);
      persist();
      toast(`${C.TITLES[doc.type]} ${doc.number} émis${isInv ? 'e' : ''}`);
      return true;
    }
    bindBack(backTo);
    if ($('#save')) $('#save').onclick = () => { if (persist()) { toast(isQ || isExtra ? 'Enregistré : ' + doc.number : 'Brouillon enregistré'); unlockedIds.delete(doc.id); if (isNew) navigate('#/doc/' + doc.id); else render(true); } };
    if ($('#issue')) $('#issue').onclick = async () => {
      if (!validate()) return;
      const n = doc.number || peekNumber(doc.type, doc.date);
      const warn = issueWarnings();
      if (!await confirmDialog(`Émettre ${isInv ? 'la facture' : 'l\'avoir'} ${n} ? Le numéro devient définitif et le document ne sera plus modifiable. Pour corriger après coup, il faudra faire un avoir.${warn.length ? '\n\n⚠ ' + warn.join('\n⚠ ') : ''}`, warn.length ? 'Émettre quand même' : 'Émettre', false)) return;
      if (issue()) { if (isNew) navigate('#/doc/' + doc.id); else render(); }
    };
    if ($('#serials')) $('#serials').onclick = () => serialAssignForm(docById(doc.id) || doc, () => render(true));
    if ($('#bill-btn')) $('#bill-btn').onclick = e => { e.stopPropagation(); const l = $('#bill-list'); const open = l.hidden; closeMenus(); l.hidden = !open; };
    $$('#bill-list button').forEach(b => b.addEventListener('click', () => { $('#bill-list').hidden = true; }));
    $('#pdf').onclick = async () => {
      if (locked) return exportPdf(docById(doc.id) || doc);
      if (!validate()) return;
      if (!await premierEnvoiOk()) return;
      if (!isQ && !isExtra && doc.status === 'brouillon') {
        const n = doc.number || peekNumber(doc.type, doc.date);
        const c = await choiceDialog('Exporter en PDF', `Ce document est un brouillon. Tu peux l'émettre maintenant (numéro ${n}, définitif) ou exporter un brouillon marqué « Brouillon », sans numéro.`, `Émettre ${n} et exporter`, 'Exporter le brouillon');
        if (!c) return;
        if (c === 'a') { if (!issue()) return; }
        else if (!persist()) return;   // sans ce refus, on exportait un document qui n'a pas été écrit
        exportPdf(docById(doc.id));
        if (isNew) navigate('#/doc/' + doc.id); else render();
        return;
      }
      if (!persist()) return;
      exportPdf(docById(doc.id));
      // Le seul moment où l'application SAIT qu'un devis part. Un devis reste « brouillon » tant
      // qu'on ne l'envoie pas par le bouton Email — le seul endroit du code qui fasse avancer son
      // statut. Envoyé par WhatsApp, imprimé, remis en main propre, il reste brouillon à vie : ni
      // relancé, ni compté dans le taux de transformation, ni jamais déclaré expiré. Et son PDF est
      // indiscernable d'un devis envoyé, puisqu'il porte déjà son numéro.
      if (isQ && doc.status === 'brouillon') {
        const c = await choiceDialog('Ce devis part chez ton client ?',
          'Tant qu\'il est en brouillon, SkanFact ne le relance pas, ne le compte pas dans tes statistiques et ne le déclare jamais expiré.',
          'Le marquer envoyé', 'Le garder en brouillon');
        if (c === 'a') {
          const st = docById(doc.id);
          if (st) { st.status = 'envoyé'; doc.status = 'envoyé'; save(true); toast(`${st.number} marqué envoyé`); }
        }
      }
      if (isNew) navigate('#/doc/' + doc.id); else render();
    };
    if ($('#del')) $('#del').onclick = async () => {
      // Une suppression qui laisse des liens morts doit au moins les nommer : une facture qui
      // annonce « établie à partir du devis DEV-2026-012 » et dont le lien mène au tableau de bord
      // est un mystère qu'on n'élucide plus six mois après.
      const liees = C.piecesLiees(data, doc);
      const quoi = liees.length
        ? `\n\n${pl(liees.length, 'pièce en est issue', 'pièces en sont issues')} : ${liees.map(x => `${x.number} (${x.quoi})`).join(', ')}. ${liees.length > 1 ? 'Elles resteront' : 'Elle restera'}, mais ${liees.length > 1 ? 'leur lien' : 'son lien'} vers cette pièce sera rompu.`
        : '';
      if (!await confirmDialog(`Supprimer ${docLabel(doc)} ?${doc.number ? ' Le numéro ne sera pas réutilisé.' : ''}${quoi}`, 'Supprimer', true)) return;
      if (closedBlock(doc.date, 'Ce document')) return;
      forget('documents', doc.id, docLabel(doc));
      data.documents = data.documents.filter(d => d.id !== doc.id); save(true); navigate(backTo);
    };
    if ($('#unlock')) $('#unlock').onclick = async () => {
      if (!await confirmDialog(`Modifier ${doc.number} après émission ? Ce n'est pas conforme : une facture émise se corrige par un avoir. À réserver à une erreur repérée avant l'envoi au client.`, 'Modifier quand même')) return;
      unlockedIds.add(doc.id); render();
    };
    if ($('#dup')) $('#dup').onclick = () => { untouch(); duplicateDoc(doc); };
    // Refacturer la totalité d'un devis déjà facturé est légitime (une commande annulée puis
    // reprise) mais ce n'est jamais le geste ordinaire : on nomme d'abord ce qui existe déjà.
    if ($('#convert')) $('#convert').onclick = async () => {
      if (dejaFacture.length || issuedDeposits.length) {
        const pieces = dejaFacture.concat(issuedDeposits).map(d => d.number || 'brouillon').join(', ');
        if (!await confirmDialog(
          `Ce devis a déjà donné ${pieces}.\n\nFacturer la totalité créerait une facture de plus, `
          + 'pour le montant entier du devis. Si tu veux seulement le reste à payer, utilise « Facture de solde ».',
          'Refacturer la totalité', true)) return;
      }
      facturerDevis(doc);
    };
    if ($('#voir-facture')) $('#voir-facture').onclick = () => navigate('#/doc/' + dejaFacture[0].id);
    if ($('#deposit')) $('#deposit').onclick = () => {
      // Un acompte se négocie au téléphone en DINARS (« tu me mets 5 000 à la commande »), jamais en
      // pourcentage : il fallait diviser de tête, tomber sur 33,33 %, et découvrir le montant réel
      // seulement une fois le brouillon créé. Les deux modes vivent dans la même fenêtre, et le TTC
      // obtenu s'affiche en direct — l'écart d'arrondi se voit AVANT, pas après.
      const ttcDevis = C.computeTotals(doc, company()).totalTTC;
      modal(`<h2>Facture d'acompte</h2><p class="small muted">Une part du devis ${h(doc.number)} (${C.money(ttcDevis, cur)} TTC). La facture de solde déduira automatiquement cet acompte.</p>
        <form id="df" class="grid-2">
          <label class="field">Exprimé en<select name="mode"><option value="pct">Pourcentage du devis</option><option value="dt">Montant TTC (${h(cur)})</option></select></label>
          <label class="field" id="dp-pct">Pourcentage<input type="number" name="percent" value="30" min="0.1" max="99.9" step="0.5" class="num"></label>
          <label class="field" id="dp-dt" hidden>Montant TTC${info('ed.depositAmount')}<input type="number" name="montant" value="${C.round3(ttcDevis * 0.3)}" min="0" step="0.001" class="num"></label>
          <div class="small muted span-2" id="dp-apercu"></div>
        </form>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Créer le brouillon</button></div>`,
        (root, close) => {
        // Le pourcentage réellement demandé à `depositLines`, quel que soit le mode de saisie.
        const lirePct = () => {
          const v = formValues($('#df', root));
          if (v.mode === 'dt') { const m = Number(v.montant); return ttcDevis > 0 ? (m / ttcDevis) * 100 : 0; }
          return Number(v.percent);
        };
        const apercu = () => {
          const p2 = lirePct();
          const el = $('#dp-apercu', root);
          if (!(p2 > 0 && p2 < 100)) { el.textContent = 'Un acompte est une PART du devis : entre 0 et 100 % de son total TTC.'; return; }
          const t = C.computeTotals({ ...doc, type: 'facture', lines: C.depositLines(doc, p2, company()), discountRate: 0, applyStamp: true }, company());
          el.innerHTML = `L'acompte fera <b>${h(C.money(t.netToPay, cur))}</b> à payer (${pct(p2)} % du devis, timbre compris). Le solde restera de ${h(C.money(C.round3(ttcDevis - t.totalTTC), cur))}.`;
        };
        $('#df', root).oninput = $('#df', root).onchange = () => {
          const v = formValues($('#df', root));
          $('#dp-pct', root).hidden = v.mode === 'dt';
          $('#dp-dt', root).hidden = v.mode !== 'dt';
          apercu();
        };
        apercu();
        $('#ok', root).onclick = () => {
          const p = C.round3(lirePct());
          if (!(p > 0 && p < 100)) return refus('#df [name=' + (formValues($('#df', root)).mode === 'dt' ? 'montant' : 'percent') + ']', 'Un acompte est une part du devis : entre 0 et 100 % de son total TTC.');
          const inv = invoiceFromQuote(doc, C.depositLines(doc, p, company()), 0);
          inv.deposit = { percent: p, quoteId: doc.id, quoteNumber: doc.number }; inv.fromQuoteId = doc.id; inv.fromQuoteNumber = doc.number;
          inv.subject = `Acompte ${pct(p)} % — ${doc.subject || doc.number}`;
          acceptQuote(doc.id); data.documents.push(inv); save(true); close(); toast('Brouillon de facture d\'acompte créé'); navigate('#/doc/' + inv.id);
        };
      });
    };
    if ($('#settle2')) $('#settle2').onclick = () => $('#settle') ? $('#settle').click() : null;
    if ($('#settle')) $('#settle').onclick = () => {
      const inv = invoiceFromQuote(doc, C.settlementLines(doc, issuedDeposits), doc.discountRate);
      inv.settles = { quoteId: doc.id, quoteNumber: doc.number, depositIds: issuedDeposits.map(d => d.id) }; inv.fromQuoteId = doc.id; inv.fromQuoteNumber = doc.number;
      inv.subject = `Solde — ${doc.subject || doc.number}`;
      data.documents.push(inv); save(true); toast(`Brouillon de facture de solde créé (${issuedDeposits.length} acompte(s) déduit(s))`); navigate('#/doc/' + inv.id);
    };
    if ($('#pay')) $('#pay').onclick = () => paymentForm(docById(doc.id), () => render());
    if ($('#credit')) $('#credit').onclick = () => navigate('#/doc/new/avoir/' + doc.id);
    // Les deux mêmes sorties, portées cette fois par le bandeau plutôt que cachées dans « Plus ▾ » :
    // quelqu'un qui vient de comprendre pourquoi il ne peut rien taper doit trouver la suite là où il
    // l'a lu, pas dans un menu qu'il n'a pas encore ouvert.
    if ($('#lock-credit')) $('#lock-credit').onclick = () => navigate('#/doc/new/avoir/' + doc.id);
    if ($('#lock-unlock')) $('#lock-unlock').onclick = () => { const u = $('#unlock'); if (u) u.onclick(); };
    if ($('#email')) $('#email').onclick = async () => {
      // La porte de l'exemple AVANT tout le reste : sinon on explique d'abord comment émettre une
      // facture de démonstration, ce qui n'a pas de sens, et on refuse seulement à la fin.
      if (await demoBlock('Envoyer un email')) return;
      const d = docById(doc.id) || doc;
      // Un brouillon de facture ou d'avoir n'a pas de numéro : il ne part pas. On le DIT, et on
      // propose le geste qui débloque, au lieu de faire disparaître le bouton.
      if ((isInv || isAv) && !locked && !d.number) {
        const n = peekNumber(doc.type, doc.date);
        return modal(`<h2>Ce brouillon n'a pas encore de numéro</h2>
          <p>Une ${isInv ? 'facture' : 'avoir'} part chez un client avec son numéro : c'est lui qui la rend
          opposable et qui permet à ton comptable de la retrouver. Tant qu'elle est en brouillon, elle n'en a pas.</p>
          <p class="small muted">En l'émettant, elle prendra le numéro <b>${h(n)}</b> et ne sera plus modifiable.
          Pour corriger après coup, ce sera un avoir.</p>
          <div class="modal-actions"><button class="btn" data-close>Rester en brouillon</button>
            <button class="btn btn-primary" id="em-issue">Émettre puis envoyer</button></div>`,
          (root, close) => {
            $('#em-issue', root).onclick = () => {
              close();
              if (!issue()) return;
              render();
              sendByEmail(docById(doc.id) || doc);
            };
          });
      }
      sendByEmail(d);
    };
    if ($('#as-template')) $('#as-template').onclick = () => saveAsTemplate(doc);
    if ($('#make-recurring')) $('#make-recurring').onclick = () => recurrenceForm(recurrenceFromInvoice(doc), () => { toast('Contrat créé'); navigate('#/contrats'); });
    if ($('#more-btn')) $('#more-btn').onclick = e => { e.stopPropagation(); const l = $('#more-list'); const open = l.hidden; closeMenus(); l.hidden = !open; };
    $$('#more-list button').forEach(b => b.addEventListener('click', () => { $('#more-list').hidden = true; }));
    if ($('#conv-btn')) $('#conv-btn').onclick = e => { e.stopPropagation(); const l = $('#conv-list'); const open = l.hidden; closeMenus(); l.hidden = !open; };
    $$('#conv-list button').forEach(b => b.addEventListener('click', async () => {
      $('#conv-list').hidden = true;
      // On part de ce qui est enregistré : convertir une saisie non sauvegardée donnerait une pièce fantôme.
      if (dirty && !persist()) return;
      const src = docById(doc.id) || doc;
      const t = b.dataset.conv;
      const out = C.convertDoc(src, t, company(), C.today());
      data.documents.push(out); save(true);
      toast(`${C.TITLES[t]} créé en brouillon à partir de ${src.number || 'ce brouillon'}`);
      navigate('#/doc/' + out.id);
    }));

    // --- clauses du contrat
    const clausesForm = $('#f-clauses');
    if (clausesForm) {
      clausesForm.oninput = () => { doc.clauses = formValues(clausesForm); touch(); schedulePreview(); };
      $('#reset-clauses').onclick = async () => {
        if (!await confirmDialog('Remplacer toutes les clauses par les textes proposés ?', 'Remplacer', false)) return;
        doc.clauses = { ...C.DEFAULT_CLAUSES };
        C.CLAUSE_LABELS.forEach(([k]) => { const ta = $(`textarea[name=${k}]`, clausesForm); if (ta) ta.value = doc.clauses[k]; });
        touch(); schedulePreview();
      };
    }

    // --- pièces jointes : copiées à côté du fichier de données, jamais dans le JSON
    function drawAttachments() {
      const el = $('#attachments'); if (!el) return;
      const s2 = docById(doc.id); if (!s2) return;
      const list = s2.attachments || [];
      el.innerHTML = `
        ${list.length ? `<table class="list compact"><thead><tr><th>Fichier</th><th>Ajouté le</th><th class="r">Taille</th><th></th></tr></thead><tbody>
          ${list.map(a => `<tr><td><a href="#" data-open="${h(a.file)}">${h(a.name)}</a></td><td class="nw">${C.fmtDate(a.date)}</td><td class="r nw">${fileSize(a.size)}</td>
            <td class="actions"><button class="btn btn-ghost btn-sm" data-reveal="${h(a.file)}" title="Montrer dans le dossier">Dossier</button><button class="btn btn-ghost btn-sm" data-rmatt="${h(a.file)}" title="Retirer">✕</button></td></tr>`).join('')}
        </tbody></table>` : '<p class="small muted">Aucune pièce jointe. Le devis signé scanné, le bon de commande du client, une photo du chantier : tout ce qui justifie ce document a sa place ici.</p>'}
        <div class="inline mt"><button class="btn btn-sm" id="add-att">+ Joindre un fichier…</button>
        <span class="small muted">Les fichiers sont copiés à côté de tes données. Ils ne sont pas dans les sauvegardes quotidiennes (qui ne contiennent qu'un fichier texte) mais le sont dans la copie externe.</span></div>`;
      $('#add-att').onclick = async () => {
        try {
          const added = await bridge.addAttachments(doc.id);
          if (!added.length) return;
          s2.attachments = (s2.attachments || []).concat(added);
          save(true); drawAttachments(); drawHistory();
          toast(added.length > 1 ? `${added.length} pièces jointes ajoutées` : 'Pièce jointe ajoutée');
        } catch (e) { toast(e.message.replace(/^.*Error: /, ''), true); }
      };
      $$('[data-open]', el).forEach(a => a.onclick = e => { e.preventDefault(); bridge.openAttachment(doc.id, a.dataset.open); });
      $$('[data-reveal]', el).forEach(b => b.onclick = () => bridge.revealAttachment(doc.id, b.dataset.reveal));
      $$('[data-rmatt]', el).forEach(b => b.onclick = async () => {
        const a = (s2.attachments || []).find(x => x.file === b.dataset.rmatt);
        if (!await confirmDialog(`Retirer « ${a ? a.name : 'cette pièce'} » ? Le fichier copié sera supprimé, ton fichier d'origine ne bouge pas.`)) return;
        await bridge.removeAttachment(doc.id, b.dataset.rmatt);
        s2.attachments = (s2.attachments || []).filter(x => x.file !== b.dataset.rmatt);
        save(true); drawAttachments(); drawHistory();
      });
    }

    // --- historique (reconstitué à partir de ce qui est enregistré : envois, relances, paiements, avoirs)
    function drawHistory() {
      const el = $('#doc-history'); if (!el) return;
      const ev = C.documentHistory(docById(doc.id) || doc, data, company());
      el.innerHTML = ev.length
        ? `<ul class="timeline">${ev.map(e => `<li class="k-${h(e.kind)}">
            <div class="tl-h">${e.id ? `<a href="#/doc/${e.id}">${h(e.label)}</a>` : e.contractId ? `<a href="#/contrat/${e.contractId}">${h(e.label)}</a>` : h(e.label)}</div>
            <div class="tl-d">${e.date ? C.fmtDate(e.date) : ''}${e.date && e.detail ? ' · ' : ''}${h(e.detail || '')}</div></li>`).join('')}</ul>`
        : '<p class="small muted">Rien à afficher pour l\'instant.</p>';
    }

    drawLines();
    drawPayments();
    drawHistory();
    drawAttachments();
    // Sur une pièce neuve, le panneau propose d'enregistrer pour pouvoir joindre : le geste suivant
    // est alors à portée, au lieu d'être à deviner.
    if ($('#att-save-first')) $('#att-save-first').onclick = () => {
      if (!persist()) return;
      toast('Enregistré — tu peux joindre tes fichiers');
      if (isNew) navigate('#/doc/' + doc.id); else render(true);
    };
  };

  // Taille de fichier lisible : « 1,4 Mo » vaut mieux que 1468006.
  function fileSize(n) {
    const b = Number(n) || 0;
    if (b < 1024) return b + ' o';
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' Ko';
    return (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo';
  }

  // Le devis devient une facture. Une seule fonction pour les deux chemins — le bouton de l'éditeur
  // et celui de la liste — sinon ils divergeraient : c'est le geste qui rapporte de l'argent.
  function facturerDevis(q) {
    if (!q) return;
    const inv = invoiceFromQuote(q, deepCopy(q.lines), q.discountRate);
    inv.fromQuoteId = q.id; inv.fromQuoteNumber = q.number;
    acceptQuote(q.id);
    data.documents.push(inv); save(true);
    toast('Brouillon de facture créé — clique sur « Émettre » quand elle est prête');
    navigate('#/doc/' + inv.id);
  }

  function invoiceFromQuote(quote, lines, discountRate) {
    const inv = newDocument('facture');
    // `projectId` fait partie de ce qui se recopie (7.16.0). Il manquait : les TROIS chemins qui
    // passent par ici — « Facturer ce devis », l'acompte, le solde — fabriquaient une facture sans
    // affaire. `projectMargin` ne retient que `d.projectId === projectId`, donc la fiche d'affaire
    // affichait 0 facturé et 0 encaissé pendant que les achats rattachés, eux, étaient comptés :
    // l'affaire paraissait perdre de l'argent. Et `core.convertDoc` (« Transformer ▾ ») recopie le
    // document en entier, donc il la gardait — deux conversions, deux comportements.
    Object.assign(inv, { clientId: quote.clientId, subject: quote.subject, reference: quote.reference || '', lines, discountRate: discountRate || 0, notes: quote.notes || '', projectId: quote.projectId || '', withholdingRate: clientWithholding(quote.clientId), lang: quote.lang || 'fr', currency: quote.currency || company().currency, exchangeRate: quote.exchangeRate || '' });
    return inv;
  }
  function acceptQuote(id) { const orig = docById(id); if (orig && orig.status !== 'accepté') orig.status = 'accepté'; }
  function creditDraftFrom(inv) {
    return {
      creditOf: inv.id, creditOfNumber: inv.number, clientId: inv.clientId, subject: `Avoir sur facture ${inv.number}${inv.subject ? ' — ' + inv.subject : ''}`,
      lines: deepCopy(inv.lines || []), discountRate: inv.discountRate || 0, withholdingRate: inv.withholdingRate || 0, applyStamp: false, creditReason: '',
      projectId: inv.projectId || '',     // un avoir se retranche de l'affaire de la facture qu'il annule
      lang: inv.lang || 'fr', currency: inv.currency || company().currency, exchangeRate: inv.exchangeRate || ''
    };
  }

  // Le compte de trésorerie sur lequel tombe un encaissement ou un règlement.
  //
  // `cashMovements` lit `p.accountId` depuis la 3.3.0 — et RIEN ne l'écrivait : seuls les mouvements
  // libres et les bulletins avaient le champ. Tout ce qui vient d'une facture ou d'un achat tombait
  // donc sur le compte par défaut, quel que soit le mode de paiement. Un règlement en espèces
  // montait sur le compte bancaire, et le rapprochement ne tombait jamais juste. Pendant ce temps
  // deux bulles d'aide parlaient des paiements « pour lesquels tu n'as rien précisé », et la page
  // Trésorerie renvoyait sur la facture en disant « ils se modifient là-bas » — là où le champ
  // n'existait pas. Sans compte, ou avec un seul, le champ ne sert à rien : on ne le montre pas.
  function accountFieldHtml(valeur) {
    const cptes = data.accounts || [];
    if (cptes.length < 2) return '';
    const defaut = (cptes.find(a => a.isDefault) || cptes[0]).id;
    const sel = valeur || defaut;
    return `<label class="field">${lbl('Compte', 'treso.compteDuPaiement')}<select name="accountId">${cptes
      .map(a => `<option value="${h(a.id)}" ${a.id === sel ? 'selected' : ''}>${h(a.name || 'Compte')}${a.isDefault ? ' (par défaut)' : ''}</option>`).join('')}</select></label>`;
  }

  // `pay` : le paiement à modifier. Un paiement ne se modifiait pas — la seule action de sa ligne
  // était « ✕ » — donc une erreur de compte, de date ou de mode obligeait à supprimer et resaisir.
  function paymentForm(inv, done, pay) {
    const b = balance(inv); const cur = docCur(inv);
    const p0 = pay || null;
    const reste = Math.max(0, b.remaining + (p0 ? Number(p0.amount) || 0 : 0));
    modal(`<h2>${p0 ? 'Modifier le paiement' : 'Enregistrer un paiement'}</h2><p class="small muted">${h(inv.number)} — reste à payer ${C.money(p0 ? Math.max(0, b.remaining) : reste, cur)}</p>
      <form id="pf2" class="grid-2">
        ${dateFieldHtml('Date', 'date', p0 ? p0.date : C.today())}
        ${field('Montant', 'amount', p0 ? p0.amount : reste, 'number', 'step="0.001" min="0" class="num"')}
        <label class="field">Mode<select name="method">${C.PAYMENT_METHODS.map(m => `<option value="${m[0]}" ${p0 && p0.method === m[0] ? 'selected' : ''}>${m[1]}</option>`).join('')}</select></label>
        ${accountFieldHtml(p0 && p0.accountId)}
        ${field('Référence (n° chèque, virement…)', 'reference', p0 ? p0.reference || '' : '')}
        <label class="field span-2">Note<input type="text" name="note" value="${h(p0 ? p0.note || '' : '')}"></label>
      </form>
      ${!(data.accounts || []).length ? '<p class="small muted">Aucun compte de trésorerie n\'est créé : ce paiement ne sera rattaché à aucun compte. Tu peux en créer dans <a href="#/tresorerie">Trésorerie</a>.</p>' : ''}
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => { $('#ok', root).onclick = async () => {
        const v = formValues($('#pf2', root));
        if (!(Number(v.amount) > 0)) return toast('Montant invalide.', true);
        if (!v.date) return toast('Date obligatoire.', true);
        if (v.date > C.today() && !await confirmDialog(`La date du paiement (${C.fmtDate(v.date)}) est dans le futur. Un paiement s'enregistre quand l'argent est reçu, pas quand il est promis. Enregistrer quand même ?`, 'Enregistrer quand même')) return;
        if (Number(v.amount) > reste + 0.0005 && !await confirmDialog(`Le montant (${C.money(v.amount, cur)}) dépasse le reste à payer (${C.money(reste, cur)}). La facture apparaîtra avec un trop-perçu. Enregistrer quand même ?`, 'Enregistrer quand même')) return;
        // Modifier la date d'un paiement le sort d'un mois peut-être déjà déclaré : l'ancienne date
        // compte autant que la nouvelle, comme pour un document.
        if (closedBlock(p0 ? [p0.date, v.date] : v.date, 'Ce paiement')) return;
        inv.payments = inv.payments || [];
        const cible = p0 ? inv.payments.find(x => x.id === p0.id) : null;
        const champs = { date: v.date, amount: C.round3(v.amount), method: v.method, accountId: v.accountId || (p0 ? p0.accountId || '' : ''), reference: v.reference || '', note: v.note || '' };
        if (cible) Object.assign(cible, champs);
        else inv.payments.push({ id: C.uid(), ...champs });
        save(true); close();
        const st = effStatus(inv); toast(p0 ? 'Paiement modifié' : st === 'payée' ? `${inv.number} payée intégralement` : 'Paiement enregistré');
        if (done) done();
      }; });
  }

  async function exportPdf(doc) {
    const html = C.documentHtml(doc, clientById(doc.clientId), company(), { stampText: stampFor(doc) });
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
        <label class="field span-2 obligatoire">Nom / Raison sociale<input type="text" name="name" value="${h(c.name)}" required></label>
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
          // `refus()` amène le champ à l'écran, y met le curseur et le marque (7.0.0). Un toast seul
          // oblige à relire tout le formulaire — et la fenêtre peut avoir défilé.
          if (!v.name.trim()) return refus('#cf input[name=name]', 'Le nom est obligatoire : c\'est lui qui apparaît sur chaque document.');
          Object.assign(c, v, { withholdingRate: v.withholdingRate === '' ? '' : Number(v.withholdingRate) });
          if (!client) data.clients.push(c);
          save(true); close(); if (done) done(c);
        };
        if ($('#del-client', root)) $('#del-client', root).onclick = async () => {
          const n = data.documents.filter(d => d.clientId === c.id).length;
          if (n) return toast(`Impossible : ${n} document(s) sont liés à ce client. Un client qui a une histoire ne se supprime pas.`, true);
          if (!await confirmDialog(`Supprimer ${c.name} ?`)) return;
          forget('clients', c.id, c.name);
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
        </tbody><tfoot><tr>
          <td colspan="3"><strong>${rows.length} client(s)</strong>${filtered ? `<span class="muted"> sur ${all.length}</span>` : ''}</td>
          <td class="r"><strong>${rows.reduce((a, r) => a + r.sum.count, 0)}</strong></td>
          <td class="r"><strong>${C.money(C.round3(rows.reduce((a, r) => a + r.sum.ht, 0)), cur)}</strong></td>
          <td class="r"><strong>${C.money(C.round3(rows.reduce((a, r) => a + r.sum.due, 0)), cur)}</strong></td>
          <td colspan="2"></td></tr></tfoot></table>${pagerBar(pg, { noun: 'client', grandTotal: all.length })}`
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
          ${backButton('#/clients')}
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
            <p class="small muted mt">Ces notes ne sortent jamais sur un document, et <b>s'enregistrent toutes seules</b> au fil de la frappe. <span class="ok-text" id="cl-notes-saved" hidden>✓ enregistré</span></p>
          </div>
      </div>
      ${(() => {
        const parc = C.clientFleet(data, c.id);
        if (!parc.length) return '';
        const soon = parc.filter(x => x.warrantyEndingSoon).length;
        return `<div class="panel"><h2>Matériel installé chez ce client ${info('ser.fleet')}</h2>
          ${soon ? `<p class="small warn-text mb">${soon} garantie(s) se terminent dans moins de deux mois : le moment de proposer un contrat de maintenance.</p>` : ''}
          <div class="scroll-x"><table class="list compact"><thead><tr><th>Article</th><th>Numéro</th><th>Livré le</th><th>Garantie</th><th>Pièce</th></tr></thead><tbody>
            ${parc.map(x => `<tr class="${x.warrantyEndingSoon ? 'row-warn' : ''}">
              <td><strong>${h(x.itemLabel)}</strong></td><td class="nw">${h(x.serial)}</td>
              <td class="nw">${C.fmtDate(x.outDate)}</td>
              <td class="nw">${!x.warrantyEndDate ? '<span class="muted">aucune</span>'
                : x.expired ? `<span class="muted">expirée le ${C.fmtDate(x.warrantyEndDate)}</span>`
                : `<span class="${x.warrantyEndingSoon ? 'warn-text' : 'ok-text'}">jusqu'au ${C.fmtDate(x.warrantyEndDate)}</span>`}</td>
              <td class="nw">${x.outDocId && docById(x.outDocId) ? `<a href="#/doc/${h(x.outDocId)}">${h(docById(x.outDocId).number || 'voir')}</a>` : '<span class="muted">—</span>'}</td></tr>`).join('')}
          </tbody></table></div></div>`;
      })()}
      ${(() => {
        // L'historique d'un client s'arrêtait aux documents : ni ses affaires (où l'on sait
        // exactement ce qu'il a rapporté, achats déduits), ni ses contrats récurrents (le revenu
        // qui revient tous les mois). Les deux données existaient, aucune n'était montrée ici.
        const affaires = C.projectList(data, company()).filter(x => x.clientId === c.id);
        const contrats = (data.recurring || []).filter(r => r.clientId === c.id);
        if (!affaires.length && !contrats.length) return '';
        return `${affaires.length ? `<div class="panel"><h2>Affaires ${info('mg.projects')}</h2>
          <div class="scroll-x"><table class="list compact"><thead><tr><th>Affaire</th><th>Statut</th><th class="r">Vendu HT</th><th class="r">Acheté HT</th><th class="r">Marge</th><th class="r">En caisse</th></tr></thead><tbody>
            ${affaires.map(x => `<tr class="clickable ${x.margin < 0 ? 'row-warn' : ''}" data-pid="${h(x.id)}">
              <td><strong>${h(x.name)}</strong></td>
              <td><span class="badge ${x.status === 'en cours' ? 'b-due' : x.status === 'terminée' ? 'b-paid' : ''}">${h(x.status)}</span></td>
              <td class="r nw">${C.money(x.revenue, cur)}</td><td class="r nw">${C.money(x.cost, cur)}</td>
              <td class="r nw"><strong class="${x.margin < 0 ? 'warn-text' : ''}">${C.money(x.margin, cur)}</strong></td>
              <td class="r nw">${C.money(x.cash, cur)}</td></tr>`).join('')}
          </tbody></table></div></div>` : ''}
        ${contrats.length ? `<div class="panel"><h2>Contrats récurrents ${info('rec.what')}</h2>
          <div class="scroll-x"><table class="list compact"><thead><tr><th>Objet</th><th>Période</th><th>Prochaine facture</th><th class="r">HT / facture</th><th>État</th></tr></thead><tbody>
            ${contrats.map(r => {
              const ht = C.computeTotals({ type: 'facture', lines: r.lines, discountRate: r.discountRate, currency: r.currency, exchangeRate: r.exchangeRate }, company()).netHT;
              return `<tr class="clickable" data-rid="${h(r.id)}">
                <td><strong>${h(C.fillTemplate(r.subject, { mois: '', annee: '' }).trim() || 'Contrat')}</strong></td>
                <td>${h((C.PERIODS.find(x => x[0] === r.every) || [])[1] || '')}</td>
                <td class="nw">${r.active === false ? '<span class="muted">suspendu</span>' : C.fmtDate(r.nextDate)}</td>
                <td class="r nw">${C.money(ht, r.currency || cur)}</td>
                <td>${r.active !== false ? '<span class="badge envoyée">actif</span>' : '<span class="badge">suspendu</span>'}</td></tr>`;
            }).join('')}
          </tbody></table></div></div>` : ''}`;
      })()}
      <div class="panel"><h2>Documents</h2><div id="cl-docs"></div></div>`;
    $$('#view tr[data-pid]').forEach(tr => tr.onclick = () => navigate('#/affaire/' + tr.dataset.pid));
    $$('#view tr[data-rid]').forEach(tr => tr.onclick = () => navigate('#/contrat/' + tr.dataset.rid));
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
    bindBack('#/clients');
    $('#edit').onclick = () => clientForm(c, () => render(true));
    $('#new-dev').onclick = () => navigate('#/doc/new/devis/client/' + c.id);
    $('#new-fac').onclick = () => navigate('#/doc/new/facture/client/' + c.id);
    if ($('#mailto')) $('#mailto').onclick = () => bridge.composeMail({ to: c.email, subject: '', body: '', attachment: null, mode: 'mailto' });
    if ($('#go-rel')) $('#go-rel').onclick = () => navigate('#/relances');
    // Ces notes s'enregistrent au fil de la frappe. C'est agréable, mais c'était surprenant tant que
    // rien ne le disait — la fenêtre de modification, elle, attend « Enregistrer » (audit).
    let notesTimer = null;
    $('#cl-notes').oninput = e => {
      c.notes = e.target.value; save();
      const tag = $('#cl-notes-saved');
      if (tag) { tag.hidden = false; clearTimeout(notesTimer); notesTimer = setTimeout(() => { tag.hidden = true; }, 1600); }
    };
  };

  // ---------- Catalogue ----------
  function catalogForm(item, done) {
    const it = item || { id: C.uid(), label: '', description: '', unit: '', unitPrice: 0, unitCost: 0, vatRate: C.defaultVat(company()),
      tracked: false, minStock: 0, location: '', initialQty: 0, initialCost: 0, initialDate: C.today(),
      serialized: false, warrantyMonths: 0 };
    const already = item ? C.stockOf(data, it.id) : null;   // stock déjà constitué : on ne rejoue pas le départ
    modal(`<h2>${item ? 'Modifier la prestation' : 'Nouvelle prestation'}</h2>
      <form id="kf" class="grid-2">
        <label class="field span-2 obligatoire">${lbl('Désignation', 'cat.catalog')}<input type="text" name="label" value="${h(it.label)}"></label>
        <label class="field span-2">Description<textarea name="description">${h(it.description || '')}</textarea></label>
        ${field('Prix unitaire HT', 'unitPrice', it.unitPrice, 'number', 'step="0.001" min="0" class="num"')}
        ${field(lbl('Coût de revient HT', 'cat.cost'), 'unitCost', it.unitCost || 0, 'number', 'step="0.001" min="0" class="num"')}
        <label class="field">TVA<select name="vatRate">${C.VAT_RATES.map(r => `<option value="${r}" ${Number(it.vatRate) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select></label>
        <div class="field span-2" id="marge-hint"></div>
        <div class="field">${lbl('Unité', 'ed.unit')}<select name="unit" id="cat-unit">${unitOptions(it.unit || '', C.usedUnits(data))}</select></div>
        <label class="check span-2"><input type="checkbox" name="tracked" ${it.tracked ? 'checked' : ''}> Suivi en stock ${info('stk.tracked')}</label>
        <!-- Cette case vivait À L'INTÉRIEUR du bloc masqué par « Suivi en stock » : quelqu'un qui
             venait de lire « coche l'option sur une prestation du catalogue » ouvrait la fiche et ne
             la trouvait pas — elle n'existait pas à l'écran. Elle est ici, toujours visible, et elle
             coche « Suivi en stock » elle-même : suivre des numéros implique de suivre le stock. -->
        <label class="check span-2"><input type="checkbox" name="serialized" ${it.serialized ? 'checked' : ''}> Suivre chaque unité par son numéro de série ${info('ser.serialized')}</label>
        <div class="field span-2" id="serial-block" ${it.serialized ? '' : 'hidden'}>
          <label class="field">${lbl('Garantie proposée', 'ser.warranty')}<select name="warrantyMonths">${C.WARRANTY_CHOICES.map(m => `<option value="${m}" ${Number(it.warrantyMonths) === m ? 'selected' : ''}>${m ? m + ' mois' : 'Aucune'}</option>`).join('')}</select></label>
        </div>
        <div class="field span-2" id="stock-block" ${it.tracked ? '' : 'hidden'}>
          <div class="grid-2">
            ${field(lbl('Seuil d\'alerte', 'stk.min'), 'minStock', it.minStock || 0, 'number', 'step="0.01" min="0" class="num"')}
            ${field('Emplacement', 'location', it.location || '', 'text', 'placeholder="Étagère A, réserve…"')}
            ${field(lbl('Stock de départ', 'stk.initial'), 'initialQty', it.initialQty || 0, 'number', 'step="0.01" class="num"' + (already && already.moves.length > 1 ? ' disabled' : ''))}
            ${field(lbl('Coût unitaire du départ', 'stk.initialCost'), 'initialCost', it.initialCost || 0, 'number', 'step="0.001" min="0" class="num"' + (already && already.moves.length > 1 ? ' disabled' : ''))}
          </div>
          ${already && already.moves.length > 1
            ? `<p class="small muted mt">Stock actuel : <b>${already.qty} ${h(already.unit)}</b> au coût moyen de ${C.money(already.cmp, company().currency)}. Le stock de départ n'est plus modifiable ici — des mouvements s'y appuient. Passe par un ajustement sur la page Stock.</p>`
            : '<p class="small muted mt">Ce que tu as en rayon aujourd\'hui, avant que SkanFact ne commence à compter. Les achats et les ventes s\'y ajoutent tout seuls ensuite.</p>'}
        </div>
      </form>
      <div class="modal-actions">
        ${item ? '<button class="btn btn-danger" id="del-cat" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        let unit = it.unit || '';
        if ($('#del-cat', root)) $('#del-cat', root).onclick = async () => {
          const used = data.documents.filter(d => (d.lines || []).some(l => l.itemId === it.id
            || (l.label || '').trim().toLowerCase() === (it.label || '').trim().toLowerCase())).length;
          const st = it.tracked ? C.stockOf(data, it.id) : null;
          if (!await confirmDialog(`Supprimer « ${it.label} » du catalogue ?`
            + (used ? ` ${used} document(s) la portent déjà : ils ne changent pas, elle ne sera simplement plus proposée.` : '')
            + (st && st.qty ? ` Attention : il en reste ${pct(st.qty)} en stock, et son suivi disparaîtra avec elle.` : ''))) return;
          forget('catalog', it.id, it.label);
          data.catalog = data.catalog.filter(c => c.id !== it.id);
          save(true); close(); if (done) done(null);
        };
        bindUnitSelect($('#cat-unit', root), () => unit, u => { unit = u; });
        // La marge se montre pendant la saisie : c'est le moment où on se rend compte qu'on vend à perte.
        const hint = () => {
          const v = formValues($('#kf', root));
          const pv = Number(v.unitPrice) || 0, pa = Number(v.unitCost) || 0;
          const el = $('#marge-hint', root);
          if (!pa) { el.innerHTML = '<span class="small muted">Sans coût de revient, la marge de cette prestation ne sera pas calculable.</span>'; return; }
          const m = C.round3(pv - pa), r = pv ? Math.round(m / pv * 1000) / 10 : 0;
          el.innerHTML = `<span class="small ${m <= 0 ? 'warn-text' : 'ok-text'}">Marge : <strong>${C.money(m, company().currency)}</strong> par unité, soit ${pct(r)} %${m <= 0 ? ' — tu vends à perte.' : ''}</span>`;
        };
        $('#kf', root).oninput = hint; hint();
        // Le bloc stock n'apparaît que si l'article est suivi : inutile d'imposer quatre champs de plus
        // à qui ne vend que des prestations.
        const caseStock = $('input[name=tracked]', root), caseSerie = $('input[name=serialized]', root);
        caseStock.onchange = e => {
          $('#stock-block', root).hidden = !e.target.checked;
          // Décocher le stock retire forcément le suivi par numéro (il s'appuie dessus) : on le dit
          // en le faisant, plutôt que de laisser une case cochée qui ne s'enregistrera pas.
          if (!e.target.checked && caseSerie.checked) { caseSerie.checked = false; caseSerie.onchange({ target: caseSerie }); }
        };
        caseSerie.onchange = e => {
          $('#serial-block', root).hidden = !e.target.checked;
          // Suivre chaque unité par son numéro implique de suivre le stock : `save` le forçait déjà
          // en silence (`serialized: !!v.tracked && !!v.serialized`), ce qui faisait disparaître la
          // case à l'enregistrement sans un mot.
          if (e.target.checked && !caseStock.checked) { caseStock.checked = true; caseStock.onchange({ target: caseStock }); }
        };
        $('#ok', root).onclick = () => {
          const v = formValues($('#kf', root));
          if (!v.label.trim()) return refus('#kf input[name=label]', 'La désignation est obligatoire : c\'est elle qui s\'écrit sur la ligne du devis.');
          if (v.tracked && already && already.moves.length > 1) { v.initialQty = it.initialQty; v.initialCost = it.initialCost; }
          Object.assign(it, v, { vatRate: Number(v.vatRate), unitCost: Number(v.unitCost) || 0, unit,
            tracked: !!v.tracked, minStock: Number(v.minStock) || 0,
            serialized: !!v.tracked && !!v.serialized, warrantyMonths: Number(v.warrantyMonths) || 0,
            initialQty: Number(v.initialQty) || 0, initialCost: Number(v.initialCost) || 0,
            initialDate: it.initialDate || C.today() });
          if (!item) data.catalog.push(it);
          save(true); close(); if (done) done(it);
        };
      });
  }

  // Modifier un modèle : jusqu'ici seul son nom était changeable, alors que les deux autres onglets du
  // Catalogue ont « Modifier ». On édite ici l'objet, les notes et les lignes — le reste d'un modèle
  // (client, dates) n'existe pas : il se remplit au moment de créer le document.
  function templateForm(tpl, done) {
    const t = deepCopy(tpl);
    if (!Array.isArray(t.lines)) t.lines = [];
    const cur = company().currency;
    modal(`<h2>Modifier le modèle</h2>
      <form id="tf2" class="grid-2">
        <label class="field span-2 obligatoire">Nom du modèle<input type="text" name="name" value="${h(t.name || '')}"></label>
        <label class="field">Type<select name="type">${['devis', 'facture'].map(x => `<option value="${x}" ${t.type === x ? 'selected' : ''}>${C.TITLES[x]}</option>`).join('')}</select></label>
        ${field('Remise globale (%)', 'discountRate', t.discountRate || 0, 'number', 'min="0" max="100" step="0.5" class="num"')}
        <label class="field span-2">Objet<input type="text" name="subject" value="${h(t.subject || '')}" placeholder="Ce qui sera proposé comme objet du document"></label>
        <label class="field span-2">Notes<textarea name="notes" rows="3">${h(t.notes || '')}</textarea></label>
      </form>
      <div class="panel"><h2>Lignes</h2>
        <div class="catalog-pick"><div id="tf-cat">${combo({ items: [], placeholder: 'Ajouter depuis le catalogue…', search: 'Rechercher une prestation…' })}</div>
          <button type="button" class="btn btn-sm" id="tf-add">+ Ligne vide</button></div>
        <table class="lines-edit"><thead><tr><th>Désignation</th><th style="width:62px">Qté</th><th style="width:96px">P.U. HT</th><th style="width:76px">TVA</th><th class="r">Total HT</th><th></th></tr></thead>
          <tbody id="tf-lines"></tbody></table>
        <div class="inline mt"><span class="small muted" id="tf-sum"></span></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-danger" id="tf-del" style="margin-right:auto">Supprimer</button>
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        const drawLines = () => {
          $('#tf-lines', root).innerHTML = t.lines.length ? t.lines.map((l, i) => `<tr data-i="${i}">
            <td><input type="text" data-k="label" value="${h(l.label || '')}" placeholder="Désignation"></td>
            <td><input type="number" class="num" data-k="qty" value="${l.qty != null ? l.qty : 1}" step="0.01"></td>
            <td><input type="number" class="num" data-k="unitPrice" value="${l.unitPrice || 0}" step="0.001"></td>
            <td><select data-k="vatRate">${C.VAT_RATES.map(r => `<option value="${r}" ${Number(l.vatRate) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select></td>
            <td class="total">${C.money(C.round3((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)), cur)}</td>
            <td class="line-tools"><button type="button" class="btn btn-ghost btn-sm" data-x="${i}" title="Supprimer">✕</button></td></tr>`).join('')
            : '<tr><td colspan="6" class="small muted">Aucune ligne. Un modèle sans ligne sert quand même : il pose l\'objet et les notes.</td></tr>';
          $$('[data-k]', $('#tf-lines', root)).forEach(el => el.oninput = el.onchange = () => {
            const i = Number(el.closest('tr').dataset.i);
            t.lines[i][el.dataset.k] = el.type === 'number' || el.dataset.k === 'vatRate' ? Number(el.value) : el.value;
            drawLines();
          });
          $$('[data-x]', $('#tf-lines', root)).forEach(b => b.onclick = () => { t.lines.splice(Number(b.dataset.x), 1); drawLines(); });
          const tot = C.round3(t.lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0));
          $('#tf-sum', root).innerHTML = `${t.lines.length} ligne(s) · <b>${C.money(tot, cur)}</b> HT`;
        };
        drawLines();
        bindCombo($('.combo', $('#tf-cat', root)), {
          reset: true, placeholder: 'Ajouter depuis le catalogue…',
          items: data.catalog.slice().sort((a, b) => a.label.localeCompare(b.label, 'fr'))
            .map(c => ({ v: c.id, label: c.label, sub: c.description || '', right: C.money(c.unitPrice, cur) + ' HT', text: `${c.label} ${c.description || ''}` })),
          onPick: id => {
            const it = data.catalog.find(c => c.id === id); if (!it) return;
            t.lines.push({ label: it.label, description: it.description || '', qty: 1, unit: it.unit || '',
              unitPrice: it.unitPrice, unitCost: it.unitCost || '', vatRate: it.vatRate, itemId: it.id });
            drawLines();
          }
        });
        $('#tf-add', root).onclick = () => { t.lines.push(C.newLine(company())); drawLines(); };
        $('#ok', root).onclick = () => {
          const v = formValues($('#tf2', root));
          if (!(v.name || '').trim()) return toast('Donne un nom à ce modèle.', true);
          const idx = data.templates.findIndex(x => x.id === t.id);
          const next = { ...t, ...v, discountRate: Number(v.discountRate) || 0 };
          if (idx >= 0) data.templates[idx] = next; else data.templates.push(next);
          save(true); close(); if (done) done();
        };
        $('#tf-del', root).onclick = async () => {
          if (!await confirmDialog(`Supprimer le modèle « ${t.name} » ?`)) return;
          forget('templates', t.id, t.name);
          data.templates = data.templates.filter(x => x.id !== t.id);
          save(true); close(); if (done) done();
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
        // Pied totalisé, comme sur les listes de documents : il porte sur toute la sélection, jamais
        // sur la page affichée (audit — Clients et Catalogue en étaient les seules listes dépourvues).
        const foot = opts.foot ? opts.foot(kept, all) : '';
        $('.rows', wrap).innerHTML = kept.length
          ? `<table class="list sortable"><thead>${sortHead(cols, state.sort, '<th class="row-actions-h"></th>')}</thead><tbody>
              ${page.map(r => `<tr>${cols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}<td class="actions">${opts.actions(r)}</td></tr>`).join('')}
            </tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table>${pagerBar(pg, { noun: opts.noun, grandTotal: all.length })}`
          : `<div class="empty">${state.q ? 'Rien ne correspond à cette recherche.' : h(opts.empty)}</div>`;
        const note = $('.f-note', wrap);
        note.hidden = !state.q;
        note.innerHTML = state.q ? `<span class="small muted">${kept.length} sur ${all.length}</span>${filterReset(true)}` : '';
        if ($('#reset-f', wrap)) $('#reset-f', wrap).onclick = () => { state.q = ''; state.page = 1; $('.q', wrap).value = ''; redraw(); };
        bindSort(wrap, redraw);
        bindPager($('.rows', wrap), state, () => redraw(), wrapSel);
        opts.bind(wrap, redraw);
      };
      return redraw;
    };

    const prestaCols = [
      { key: 'label', label: 'Désignation', asc: true, val: c => c.label.toLowerCase(), get: c => `<strong>${h(c.label)}</strong><div class="small muted">${h(c.description || '')}</div>` },
      { key: 'price', label: 'P.U. HT', r: true, val: c => Number(c.unitPrice) || 0, get: c => C.money(c.unitPrice, cur) },
      { key: 'cost', label: 'Coût', r: true, val: c => Number(c.unitCost) || 0, get: c => Number(c.unitCost) ? C.money(c.unitCost, cur) : '<span class="muted">—</span>' },
      { key: 'margin', label: 'Marge', r: true, val: c => Number(c.unitCost) ? (Number(c.unitPrice) || 0) - Number(c.unitCost) : -Infinity, get: c => {
        if (!Number(c.unitCost)) return '<span class="muted">—</span>';
        const m = C.round3((Number(c.unitPrice) || 0) - Number(c.unitCost));
        const r = Number(c.unitPrice) ? Math.round(m / Number(c.unitPrice) * 1000) / 10 : 0;
        return `<span class="${m <= 0 ? 'warn-text' : ''}">${C.money(m, cur)} <span class="muted">(${pct(r)} %)</span></span>`;
      } },
      { key: 'vat', label: 'TVA', r: true, val: c => Number(c.vatRate) || 0, get: c => c.vatRate + ' %' },
      { key: 'unit', label: 'Unité', asc: true, val: c => (c.unit || '').toLowerCase(), get: c => h(c.unit || '') },
      { key: 'stock', label: 'Stock', r: true, val: c => c.tracked ? C.stockOf(data, c.id).qty : -Infinity, get: c => {
        if (!c.tracked) return '<span class="muted">—</span>';
        const st = C.stockOf(data, c.id);
        const cls = st.negative ? 'warn-text' : st.low ? 'warn-text' : '';
        return `<span class="${cls}"><strong>${pct(st.qty)}</strong>${c.unit ? ' ' + h(c.unit) : ''}</span>${st.negative ? '<div class="small warn-text">négatif</div>' : st.low ? '<div class="small warn-text">sous le seuil</div>' : ''}`;
      } }
    ];
    const draw = drawList('#list-wrap', catalogState.presta, prestaCols, () => data.catalog.slice(), {
      noun: 'prestation', placeholder: 'Rechercher une prestation…', text: c => `${c.label} ${c.description || ''} ${c.unit || ''}`,
      foot: (kept) => {
        const tracked = kept.filter(c => c.tracked);
        const stockValue = C.round3(tracked.reduce((a, c) => a + Math.max(0, C.stockOf(data, c.id).value), 0));
        const avg = kept.length ? C.round3(kept.reduce((a, c) => a + (Number(c.unitPrice) || 0), 0) / kept.length) : 0;
        return `<tr><td><strong>${kept.length} prestation(s)</strong>${tracked.length ? `<span class="muted"> · ${tracked.length} suivie(s) en stock</span>` : ''}</td>
          <td class="r"><span class="muted">moyenne</span> <strong>${C.money(avg, cur)}</strong></td>
          <td colspan="2"></td>
          <td class="r">${tracked.length ? `<span class="muted">stock</span> <strong>${C.money(stockValue, cur)}</strong>` : ''}</td>
          <td colspan="3"></td></tr>`;
      },
      empty: 'Catalogue vide. Ajoute tes prestations récurrentes pour remplir les devis en un clic.',
      // Le Catalogue AFFICHE une quantité en stock et n'offrait aucun moyen d'aller voir d'où elle
      // vient : la fiche de l'article — mouvements, coût moyen, historique — n'était atteignable que
      // depuis la page Stock. Un chiffre qu'on lit doit s'ouvrir (7.15.0).
      actions: c => `${c.tracked ? `<button class="btn btn-sm" data-fiche="${c.id}" title="Mouvements, coût moyen, historique">Fiche stock</button>` : ''}<button class="btn btn-sm" data-edit="${c.id}">Modifier</button>`,
      bind: (wrap, redraw) => {
        $$('[data-edit]', wrap).forEach(b => b.onclick = () => catalogForm(data.catalog.find(c => c.id === b.dataset.edit), redraw));
        $$('[data-fiche]', wrap).forEach(b => b.onclick = () => navigate('#/article/' + b.dataset.fiche));
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
      actions: t => `<button class="btn btn-sm btn-primary" data-use="${t.id}">Nouveau ${t.type === 'devis' ? 'devis' : 'facture'}</button> <button class="btn btn-sm" data-tedit="${t.id}">Modifier</button>`,
      bind: (wrap, redraw) => {
        $$('[data-use]', wrap).forEach(b => b.onclick = () => { const t = data.templates.find(x => x.id === b.dataset.use); navigate(`#/doc/new/${t.type}/tpl/${t.id}`); });
        $$('[data-tedit]', wrap).forEach(b => b.onclick = () => templateForm(data.templates.find(x => x.id === b.dataset.tedit), redraw));
      }
    });

    const snipCols = [
      { key: 'name', label: 'Nom', asc: true, val: x => (x.name || '').toLowerCase(), get: x => `<strong>${h(x.name)}</strong>` },
      { key: 'text', label: 'Texte', get: x => `<span class="small">${h(x.text).replace(/\n/g, '<br>')}</span>` }
    ];
    const drawSnippets = drawList('#snip-wrap', catalogState.textes, snipCols, () => data.snippets.slice(), {
      noun: 'texte', placeholder: 'Rechercher un texte…', text: x => `${x.name} ${x.text || ''}`,
      empty: 'Aucun texte prédéfini. Conditions de garantie, modalités, mentions récurrentes… à insérer dans les notes d\'un document en un clic.',
      actions: x => `<button class="btn btn-sm" data-sedit="${x.id}">Modifier</button>`,
      bind: (wrap, redraw) => {
        $$('[data-sedit]', wrap).forEach(b => b.onclick = () => snippetForm(data.snippets.find(x => x.id === b.dataset.sedit), redraw));
      }
    });
    const TABS = CATALOG_TABS;
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
      <form id="sf" class="grid-2"><label class="field obligatoire">Nom<input type="text" name="name" value="${h(x.name)}" placeholder="Garantie, Conditions de paiement…"></label><label class="field span-2 obligatoire">Texte<textarea name="text" rows="5">${h(x.text)}</textarea></label></form>
      <div class="modal-actions">
        ${sn ? '<button class="btn btn-danger" id="del-snip" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = () => {
          const v = formValues($('#sf', root));
          // On montre CELUI qui manque, pas « Nom et texte obligatoires » : avec deux champs, un
          // message qui les nomme tous les deux ne dit pas lequel relire.
          if (!v.name.trim()) return refus('#sf input[name=name]', 'Donne un nom à ce texte : c\'est lui que tu choisiras dans la liste.');
          if (!v.text.trim()) return refus('#sf textarea[name=text]', 'Le texte est vide.');
          Object.assign(x, v); if (!sn) data.snippets.push(x); save(true); close(); if (done) done();
        };
        if ($('#del-snip', root)) $('#del-snip', root).onclick = async () => {
          if (!await confirmDialog(`Supprimer le texte « ${x.name} » ? Les documents où il a déjà été inséré ne changent pas.`)) return;
          forget('snippets', x.id, x.name);
          data.snippets = data.snippets.filter(y => y.id !== x.id);
          save(true); close(); if (done) done();
        };
      });
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
    if (!doc.lines.length) doc.lines = [C.newLine(company())];
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
  // Le tampon du document. UNE seule source : trois autres endroits recopiaient cette ligne à la
  // main (l'aperçu de l'éditeur, l'export PDF, l'envoi au comptable), donc un tampon posé ici seul
  // aurait manqué trois chemins sur quatre.
  //
  // « EXEMPLE » passe avant tout le reste : le bandeau dit « n'envoie rien à personne depuis ici »,
  // mais rien ne le tenait — `estDemo` n'avait qu'un seul appelant dans toute l'application, le
  // bandeau lui-même. Un PDF de démonstration sortait au nom de l'entreprise, sans une marque, avec
  // des clients aux adresses plausibles. Regarder un PDF reste le geste d'apprentissage : on ne le
  // bloque pas, on le MARQUE.
  function stampFor(doc) {
    if (C.estDemo(data)) return 'EXEMPLE';
    const st = doc.type === 'facture' && doc.status !== 'brouillon' ? effStatus(doc) : null;
    return st === 'payée' ? 'Payée' : st === 'annulée' ? 'Annulée' : undefined;
  }

  // La porte de l'exemple. Elle ne s'applique qu'aux gestes qui SORTENT de l'ordinateur : envoyer un
  // email, écrire au comptable, fabriquer le paquet mensuel. Lire, imprimer, exporter restent libres
  // — c'est l'apprentissage même.
  //
  // Elle PRÉVIENT, elle n'interdit pas, et c'est voulu : les clients de l'exemple portent des
  // adresses plausibles (« direction@clinique-jasmins.tn »), donc le risque réel est d'ouvrir un
  // brouillon et d'appuyer sur Envoyer par réflexe. Un logiciel ne peut pas empêcher la messagerie
  // d'envoyer ; il peut nommer le danger une fois, et laisser décider. C'est la règle posée en
  // 6.0.0 pour les remplacements en masse : on prévient, on ne refuse pas un geste volontaire.
  // Un refus déguisé en choix — deux boutons dont aucun ne laisse passer — serait pire que rien.
  async function demoBlock(quoi) {
    if (!C.estDemo(data)) return false;
    const c = await choiceDialog('Ce sont des données d\'exemple',
      `${quoi} depuis le jeu d'exemple : ces clients, ces adresses et ces montants sont inventés — `
      + 'et les adresses ressemblent à de vraies adresses. Tes vraies données sont mises de côté, tu peux y revenir maintenant.',
      'Repartir de mes données', 'Continuer quand même');
    if (c === 'a') { demoSortie(); return true; }
    return c !== 'b';                          // fermer la fenêtre vaut « ne rien faire »
  }
  async function sendByEmail(doc, kind, extra, afterSend) {
    if (await demoBlock('Envoyer un email')) return;
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
    if (!r.lines || !r.lines.length) r.lines = [C.newLine(company())];
    const cur = company().currency;
    const clientItems = () => data.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(c => ({
      v: c.id, label: c.name, sub: [c.contact, c.matricule ? 'MF ' + c.matricule : ''].filter(Boolean).join(' · '),
      text: `${c.name} ${c.contact || ''} ${c.email || ''} ${c.phone || ''} ${c.matricule || ''}`
    }));
    modal(`<h2>${isNew ? 'Nouveau contrat récurrent' : 'Modifier le contrat'}</h2>
      <form id="rf" class="grid-3">
        <div class="field span-2">Client${combo({ name: 'clientId', value: r.clientId, items: clientItems(), placeholder: '— Choisir un client —', search: 'Rechercher : nom, contact, MF…', add: '+ Nouveau client' })}</div>
        <label class="field">Période<select name="every">${C.PERIODS.map(p => `<option value="${p[0]}" ${p[0] === r.every ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label>
        <label class="field span-2">Objet des factures <span class="muted">({mois} = mois facturé)</span><input type="text" name="subject" value="${h(r.subject)}" placeholder="Maintenance et supervision — {mois}"></label>
        ${field('Jour du mois', 'day', r.day || 1, 'number', 'min="1" max="31" class="num"')}
        ${dateFieldHtml('Prochaine facture', 'nextDate', r.nextDate || C.today(), { quick: true })}
        <label class="field">Retenue à la source<select name="withholdingRate">${withholdingOptions(r.withholdingRate)}</select></label>
        ${field('Remise (%)', 'discountRate', r.discountRate || 0, 'number', 'min="0" max="100" step="0.5" class="num"')}
        <label class="field span-3">Notes sur la facture<textarea name="notes" rows="2">${h(r.notes || '')}</textarea></label>
        <label class="check span-3"><input type="checkbox" name="active" ${r.active !== false ? 'checked' : ''}> Contrat actif (les factures sont proposées à la date prévue)</label>
      </form>
      <table class="mini"><thead><tr><th>Désignation</th><th style="width:58px">Qté</th><th style="width:104px">Unité ${info('ed.unit')}</th><th style="width:96px">P.U. HT</th><th style="width:74px">TVA</th><th></th></tr></thead><tbody id="rl"></tbody></table>
      <div class="inline mt"><button type="button" class="btn btn-sm" id="rl-add">+ Ligne</button><span class="small muted" id="rl-total"></span></div>
      <div class="modal-actions">
        ${isNew ? '' : '<button class="btn btn-danger" id="del-rec" style="margin-right:auto">Supprimer</button>'}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        const cliCombo = bindCombo($('[data-combo=clientId]', root), {
          items: clientItems(), placeholder: '— Choisir un client —',
          onAdd: () => clientForm(null, c => { cliCombo.setItems(clientItems()); cliCombo.setValue(c.id); })
        });
        // La suppression vit ici, comme pour les clients, les prestations et les textes : c'est la
        // fenêtre où l'on voit ce qu'on supprime (audit — elle était sur la ligne de la liste).
        if ($('#del-rec', root)) $('#del-rec', root).onclick = async () => {
          const n = data.documents.filter(d => d.recurringId === r.id).length;
          if (!await confirmDialog(`Supprimer ce contrat ?${n ? ` ${n} facture(s) en sont issues : elles sont conservées.` : ''}`)) return;
          forget('recurring', r.id, C.fillTemplate(r.subject || '', { mois: '', annee: '' }).trim());
          data.recurring = data.recurring.filter(x => x.id !== r.id);
          save(true); close(); if (done) done();
        };
        const body = $('#rl', root);
        const openRl = new Set();                    // lignes dont la description est dépliée
        r.lines.forEach((l, i) => { if (l.description) openRl.add(i); });
        const drawL = () => {
          const extraUnits = C.usedUnits(data, r.lines.map(l => l.unit));
          body.innerHTML = r.lines.map((l, i) => `<tr data-i="${i}"><td><input type="text" data-k="label" value="${h(l.label)}" placeholder="Désignation">
              ${openRl.has(i) ? `<textarea data-k="description" rows="2" placeholder="Description reprise sur chaque facture">${h(l.description || '')}</textarea>` : `<button type="button" class="link-add" data-rdesc="${i}">+ description</button>`}</td>
            <td><input type="number" class="num" data-k="qty" value="${l.qty}" step="0.01"></td><td><select data-k="unit">${unitOptions(l.unit, extraUnits)}</select></td><td><input type="number" class="num" data-k="unitPrice" value="${l.unitPrice}" step="0.001"></td><td><select data-k="vatRate">${C.VAT_RATES.map(v => `<option value="${v}" ${Number(l.vatRate) === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></td><td><button type="button" class="btn btn-ghost btn-sm" data-rm="${i}">✕</button></td></tr>`).join('');
          $$('[data-k]', body).forEach(el => {
            if (el.dataset.k === 'unit') return;
            el.oninput = () => { const i = Number(el.closest('tr').dataset.i); r.lines[i][el.dataset.k] = el.type === 'number' ? Number(el.value) : el.value; tot(); };
          });
          $$('select[data-k=unit]', body).forEach(sel => {
            const i = Number(sel.closest('tr').dataset.i);
            bindUnitSelect(sel, () => r.lines[i].unit, u => { r.lines[i].unit = u; });
          });
          $$('[data-rdesc]', body).forEach(b => b.onclick = () => { openRl.add(Number(b.dataset.rdesc)); drawL(); const ta = $$('textarea[data-k=description]', body).pop(); if (ta) ta.focus(); });
          $$('[data-rm]', body).forEach(b => b.onclick = () => {
            const i = Number(b.dataset.rm);
            r.lines.splice(i, 1); if (!r.lines.length) r.lines.push(C.newLine(company()));
            const next = new Set(); openRl.forEach(k => { if (k < i) next.add(k); else if (k > i) next.add(k - 1); });
            openRl.clear(); next.forEach(k => openRl.add(k));
            drawL();
          });
          tot();
        };
        const tot = () => { const t = C.computeTotals({ type: 'facture', lines: r.lines, discountRate: Number($('input[name=discountRate]', root).value) || 0 }, company()); $('#rl-total', root).textContent = `${C.money(t.netHT, cur)} HT · ${C.money(t.totalTTC, cur)} TTC par facture`; };
        $('#rl-add', root).onclick = () => { r.lines.push(C.newLine(company())); drawL(); };
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
  // Renvoie `{ n, skipped, ids }` : sans les identifiants des brouillons créés, « Générer
  // maintenant » n'était pas annulable — or il fabrique une facture ET repousse l'échéance du
  // contrat, deux effets qu'un clic de trop laissait en place sans un mot.
  function generateRecurring(recs, force) {
    let n = 0, skipped = 0; const ids = [];
    (recs || C.dueRecurrences(data)).forEach(rec => {
      let guard = 0;
      do {
        // Une échéance tombée dans un mois déjà clôturé ne crée rien : on la passe, et on le dit.
        // Générer là-dedans ferait apparaître une facture dans un dossier déjà remis au comptable.
        if (C.isClosedDate(data, rec.nextDate)) {
          skipped++;
          rec.lastIssued = rec.nextDate; rec.nextDate = C.nextRecurrenceDate(rec.nextDate, rec.every, rec.day);
          continue;
        }
        const inv = { ...C.buildRecurringInvoice(rec, rec.nextDate, company()), id: C.uid(), createdAt: Date.now() };
        data.documents.push(inv); n++; ids.push(inv.id);
        rec.lastIssued = rec.nextDate; rec.nextDate = C.nextRecurrenceDate(rec.nextDate, rec.every, rec.day);
      } while (!force && rec.active !== false && rec.nextDate <= C.today() && ++guard < 12);
    });
    if (n || skipped) save(true);
    if (skipped) toast(`${pl(skipped, 'échéance passée', 'échéances passées')} : leur mois est clôturé. Rouvre la période si ces factures doivent exister.`, true);
    return { n, skipped, ids };
  }

  // Générer un contrat en le rendant annulable : on garde les deux dates AVANT, et « Annuler »
  // supprime le brouillon créé et les remet. Sur un contrat suspendu ou dont l'échéance n'est pas
  // encore arrivée, on demande d'abord — c'est un geste qui avance le calendrier de facturation.
  async function genererContrat(r, apres) {
    const avance = r.active === false || r.nextDate > C.today();
    if (avance) {
      const quoi = r.active === false
        ? 'Ce contrat est suspendu.' : `La prochaine échéance est le ${C.fmtDate(r.nextDate)}, elle n'est pas encore arrivée.`;
      if (!await confirmDialog(`${quoi}\n\nGénérer quand même le brouillon de facture ? L'échéance suivante sera repoussée d'une période.`, 'Générer', false)) return;
    }
    const avant = { lastIssued: r.lastIssued, nextDate: r.nextDate };
    const res = generateRecurring([r], true);
    if (!res.n) return;
    if (apres) apres();
    toastUndo(`Brouillon créé pour ${C.monthLabel(r.lastIssued)} — prochaine échéance le ${C.fmtDate(r.nextDate)}`, () => {
      data.documents = data.documents.filter(d => !res.ids.includes(d.id));
      res.ids.forEach(id => forget('documents', id, 'brouillon récurrent'));
      Object.assign(r, avant); save(true);
      if (apres) apres();
    });
  }
  // ---------- fiche d'un contrat ----------
  // Un contrat n'existait que comme ligne de tableau : on ne voyait ni ce qu'il facturera,
  // ni ce qu'il a déjà facturé. La fiche montre les deux, avec le même aperçu que l'éditeur.
  const contratDocState = { sort: null, page: 1 };
  routes.contrat = (parts) => {
    const r = (data.recurring || []).find(x => x.id === parts[0]);
    if (!r) return navigate('#/contrats');
    contratDocState.page = 1;
    const co = company();
    const cur = r.currency || co.currency;
    const invoices = data.documents.filter(d => d.recurringId === r.id).sort(byNumberDesc);
    const issued = invoices.filter(d => d.status !== 'brouillon');
    const drafts = invoices.filter(d => d.status === 'brouillon');
    const facture = C.round3(issued.reduce((s, d) => s + C.toBase(d, C.computeTotals(d, co).netHT, co), 0));
    const encaisse = C.round3(issued.reduce((s, d) => s + C.toBase(d, C.computeTotals(d, co).netToPay - balance(d).remaining, co), 0));
    const next = C.buildRecurringInvoice(r, r.nextDate, co);          // la facture que le contrat produira
    const t = C.computeTotals(next, co);
    const active = r.active !== false;
    const isDue = active && r.nextDate <= C.today();
    const period = (C.PERIODS.find(p => p[0] === r.every) || [])[1] || '';
    const subj = C.fillTemplate(r.subject, { mois: C.monthLabel(r.nextDate), annee: (r.nextDate || '').slice(0, 4) });

    $('#view').innerHTML = `
      <div class="page-head">
        <div><h1>${h(subj || 'Contrat')} ${info('contrat.fiche')}</h1>
          <div class="small muted">${h(clientName(r.clientId))} · ${h(period)} · ${active ? 'actif' : 'suspendu'}${r.subject !== subj ? ` · gabarit « ${h(r.subject)} »` : ''}</div></div>
        <div class="actions">
          ${backButton('#/contrats')}
          <button class="btn" id="c-client">Fiche client</button>
          <button class="btn" id="c-edit">Modifier</button>
          <button class="btn" id="c-toggle">${active ? 'Suspendre' : 'Reprendre'}</button>
          <button class="btn btn-primary" id="c-gen">Générer maintenant</button>
          <div class="more"><button class="btn" id="c-more-btn" aria-label="Autres actions">Plus ▾</button><div class="more-list" id="c-more" hidden>
            <button id="c-del" class="danger">Supprimer le contrat</button>
          </div></div>
        </div></div>
      ${isDue ? `<div class="banner">Une facture est à générer pour le ${C.fmtDate(r.nextDate)}<button class="btn" id="c-gen2">Générer le brouillon</button></div>` : ''}
      ${!active ? `<div class="banner info">Contrat suspendu : aucune facture n'est générée tant qu'il n'est pas repris.</div>` : ''}
      <div class="stats">
        <div class="stat"><div class="lbl">Par facture (HT) ${info('contrat.montant')}</div><div class="val">${C.money(t.netHT, cur)}</div><div class="sub">${C.money(t.totalTTC, cur)} TTC</div></div>
        <div class="stat"><div class="lbl">Prochaine facture ${info('contrat.next')}</div><div class="val">${C.fmtDate(r.nextDate)}</div><div class="sub">${isDue ? 'à générer' : period.toLowerCase()}${r.lastIssued ? ' · dernière : ' + C.fmtDate(r.lastIssued) : ''}</div></div>
        <div class="stat"><div class="lbl">Facturé depuis le début ${info('contrat.total')}</div><div class="val">${C.money(facture, co.currency)}</div><div class="sub">${issued.length} facture(s) émise(s)${drafts.length ? ` · ${drafts.length} brouillon(s)` : ''}</div></div>
        <div class="stat"><div class="lbl">Encaissé ${info('dash.open')}</div><div class="val">${C.money(encaisse, co.currency)}</div><div class="sub">${C.money(C.round3(facture - encaisse), co.currency)} restant, avoirs et taxes compris</div></div>
      </div>
      <div class="editor editor-short">
        <div>
          <div class="panel"><h2>Ce qui sera facturé ${info('contrat.lignes')}</h2>
            ${(r.lines || []).length ? `<table class="list compact"><thead><tr><th>Désignation</th><th class="r">Qté</th><th>Unité</th><th class="r">P.U. HT</th><th class="r">TVA</th><th class="r">Total HT</th></tr></thead><tbody>
              ${t.lines.map(l => `<tr><td><strong>${h(C.fillTemplate(l.label, { mois: C.monthLabel(r.nextDate) }))}</strong>${l.description ? `<div class="small muted">${h(l.description)}</div>` : ''}</td>
                <td class="r nw">${h(String(l.qty))}</td><td>${h(l.unit || '')}</td><td class="r nw">${C.money(l.unitPrice, cur)}</td><td class="r nw">${l.vatRate} %</td><td class="r nw">${C.money(l.ht, cur)}</td></tr>`).join('')}
            </tbody></table>` : '<div class="empty">Aucune ligne. Clique sur « Modifier » pour en ajouter.</div>'}
          </div>
        </div>
        <div class="preview">
          <div class="pv-head"><span class="k-label">Aperçu de la prochaine facture ${info('contrat.apercu')}</span><span class="pv-pages" id="pv-pages"></span></div>
          <iframe id="preview" title="Aperçu de la facture que ce contrat produira"></iframe>
        </div>
      </div>
      <div class="panel"><h2>Factures générées par ce contrat ${info('contrat.factures')}</h2><div id="c-docs"></div></div>`;

    // Aperçu : exactement le rendu de la facture que « Générer » produira, mois résolu compris.
    const pv = $('#preview');
    const drawPv = () => {
      if (!pv) return;
      pv.onload = () => {
        try {
          const compact = C.fitToPage(pv.contentDocument);
          const pages = C.pageCount(pv.contentDocument);
          const el = $('#pv-pages');
          if (el) { el.textContent = pages <= 1 ? (compact ? '1 page (resserrée)' : '1 page') : pages + ' pages'; el.className = 'pv-pages' + (pages > 1 ? ' warn' : ''); }
        } catch (_) { /* aperçu indisponible */ }
      };
      pv.srcdoc = C.documentHtml(next, clientById(r.clientId), co, { preview: true, zoom: Math.max(0.3, Math.floor((pv.clientWidth - 2) / 794 * 100) / 100) });
    };
    drawPv();
    previewRedraw = drawPv;

    const drawDocs = (sortKey) => {
      const cols = docColumns({ hideClient: true }).cols;
      if (sortKey) { contratDocState.sort = toggleSort(contratDocState.sort, sortKey, cols); contratDocState.page = 1; }
      $('#c-docs').innerHTML = docTable(invoices, {
        hideClient: true, sort: contratDocState.sort, onSort: true, page: contratDocState,
        empty: 'Aucune facture générée pour l\'instant. La première le sera le ' + C.fmtDate(r.nextDate) + '.'
      });
      bindDocTable(drawDocs, contratDocState, '#c-docs');
    };
    drawDocs();

    bindBack('#/contrats');
    $('#c-client').onclick = () => navigate('#/client/' + r.clientId);
    $('#c-edit').onclick = () => recurrenceForm(r, () => render(true));
    $('#c-more-btn').onclick = e => { e.stopPropagation(); const l = $('#c-more'); l.hidden = !l.hidden; };
    $('#c-toggle').onclick = () => {
      const avant = { active: r.active, nextDate: r.nextDate };
      r.active = !active;
      let msg = r.active ? 'Contrat repris' : 'Contrat suspendu — plus aucun brouillon ne sera préparé';
      if (r.active && r.nextDate < C.today()) {
        r.nextDate = C.catchUpRecurrence(r.nextDate, r.every, r.day);
        msg = `Contrat repris — prochaine facture le ${C.fmtDate(r.nextDate)} (les échéances passées ne sont pas facturées)`;
      }
      save(true); render(true);
      toastUndo(msg, () => { Object.assign(r, avant); save(true); render(true); });
    };
    const generate = () => genererContrat(r, () => render(true));
    $('#c-gen').onclick = generate;
    if ($('#c-gen2')) $('#c-gen2').onclick = generate;
    $('#c-del').onclick = async () => {
      if (!await confirmDialog('Supprimer ce contrat ? Les factures déjà générées sont conservées.', 'Supprimer', true)) return;
      forget('recurring', r.id, r.subject || '');
      data.recurring = data.recurring.filter(x => x.id !== r.id);
      save(true); navigate('#/contrats');
    };
  };

  const contratState = { q: '', st: '', sort: { key: 'next', dir: 'asc' }, page: 1 };
  routes.contrats = () => {
    const cur = company().currency;
    const s = contratState;
    // Un contrat porte sa devise (`buildRecurringInvoice` la reporte sur chaque facture) : la
    // colonne l'affichait pourtant en dinars, quel que soit le contrat. Et le tri comparait des
    // euros à des dinars — donc classait de travers.
    const curOf = r => r.currency || cur;
    const htOf = r => C.computeTotals({ type: 'facture', lines: r.lines, discountRate: r.discountRate,
      currency: r.currency, exchangeRate: r.exchangeRate }, company()).netHT;
    const htBase = r => C.toBase({ currency: r.currency, exchangeRate: r.exchangeRate }, htOf(r), company());
    // Ramené au mois : c'est le seul chiffre qui dit ce que ces contrats rapportent vraiment.
    const PAR_AN = { month: 12, quarter: 4, year: 1 };
    const cols = [
      { key: 'client', label: 'Client', asc: true, val: r => clientName(r.clientId).toLowerCase(), get: r => `<strong>${h(clientName(r.clientId))}</strong>` },
      { key: 'subject', label: 'Objet', asc: true, val: r => (r.subject || '').toLowerCase(), get: r => { const subj = C.fillTemplate(r.subject, { mois: C.monthLabel(r.nextDate) }); return `${h(subj)}${subj !== r.subject ? `<div class="small muted">${h(r.subject)}</div>` : ''}`; } },
      { key: 'every', label: 'Période', asc: true, val: r => r.every || '', get: r => (C.PERIODS.find(p => p[0] === r.every) || [])[1] || '' },
      { key: 'next', label: 'Prochaine facture', asc: true, val: r => r.nextDate || '', get: r => { const isDue = r.active !== false && r.nextDate <= C.today(); return `${C.fmtDate(r.nextDate)}${isDue ? ' <span class="level l2">à générer</span>' : ''}${r.lastIssued ? `<div class="small muted">dernière : ${C.fmtDate(r.lastIssued)}</div>` : ''}`; } },
      { key: 'ht', label: 'HT / facture', r: true, val: htBase, get: r => C.money(htOf(r), curOf(r)) },
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
      // Le pied porte sur la sélection ENTIÈRE (règle des listes depuis la 2.2.0), et ne compte que
      // les contrats actifs : un contrat suspendu ne rapporte rien ce mois-ci.
      const actifs = kept.filter(r => r.active !== false);
      const parAn = C.round3(actifs.reduce((a2, r) => a2 + htBase(r) * (PAR_AN[r.every] || 12), 0));
      const parMois = C.round3(parAn / 12);
      $('#c-wrap').innerHTML = `${due.length ? `<div class="banner">${due.length} facture(s) récurrente(s) à générer<button class="btn" id="gen-due">Générer les brouillons</button></div>` : ''}
        ${filtersBar(`
          <input type="text" id="q" placeholder="Rechercher : client, objet…" value="${h(s.q)}">
          <select id="st">${STATES.map(([v, l]) => `<option value="${v}" ${s.st === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          ${info('list.filters')}
          ${filtered ? `<span class="f-note"><span class="small muted">${kept.length} sur ${all.length}</span>${filterReset(true)}</span>` : ''}`, all.length, filtered)}
        ${kept.length ? `<table class="list sortable"><thead>${sortHead(cols, s.sort, '<th class="row-actions-h"></th>')}</thead><tbody>
        ${page.map(r => `<tr class="clickable" data-rid="${r.id}">${cols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}
          <td class="actions"><button class="btn btn-sm" data-gen="${r.id}">Générer maintenant</button> <button class="btn btn-sm" data-edit="${r.id}">Modifier</button> <button class="btn btn-sm" data-toggle="${r.id}">${r.active !== false ? 'Suspendre' : 'Reprendre'}</button></td></tr>`).join('')}
        </tbody><tfoot><tr>
          <td colspan="4"><strong>${pl(actifs.length, 'contrat actif', 'contrats actifs')}</strong>${filtered ? '<span class="muted"> dans cette sélection</span>' : ''}</td>
          <td class="r"><strong>${C.money(parMois, cur)}</strong><div class="small muted">par mois · ${C.money(parAn, cur)} par an</div></td>
          <td colspan="2"></td></tr></tfoot></table>${pagerBar(pg, { noun: 'contrat', grandTotal: all.length })}`
          : filtered ? '<div class="empty">Aucun contrat ne correspond à ces filtres.</div>'
          : etatVide('Les factures qui se répètent toutes seules',
              ['Un abonnement, une maintenance, un forfait mensuel : tu le décris une fois — client, lignes, périodicité — et SkanFact prépare le <b>brouillon de facture</b> à chaque échéance. Tu n\'as plus qu\'à le relire et l\'émettre.',
               'Rien n\'est envoyé à ta place : un brouillon t\'attend, c\'est tout.',
               'À ne pas confondre avec le <b>contrat que ton client signe</b>, qui est dans « Proforma, bons et contrats ».'],
              [['rec-first', '+ Créer mon premier contrat', true],
               ['rec-depuis', 'Partir d\'une facture existante']])}`;
      if ($('#rec-first')) $('#rec-first').onclick = () => recurrenceForm(null, draw);
      if ($('#rec-depuis')) $('#rec-depuis').onclick = () => navigate('#/factures');
      const q = $('#q');
      if (q) q.oninput = e => {
        const pos = e.target.selectionStart;                 // on redessine la page : il faut rendre le curseur où il était
        s.q = e.target.value.toLowerCase(); s.page = 1; draw();
        const el = $('#q'); if (el) { el.focus(); el.setSelectionRange(pos, pos); }
      };
      if ($('#st')) $('#st').onchange = e => { s.st = e.target.value; s.page = 1; draw(); };
      if ($('#reset-f')) $('#reset-f').onclick = () => { s.q = ''; s.st = ''; s.page = 1; draw(); };
      $$('tr.clickable[data-rid]').forEach(tr => tr.onclick = e => { if (e.target.closest('button')) return; navigate('#/contrat/' + tr.dataset.rid); });
      bindSort($('#c-wrap'), draw);
      bindPager($('#c-wrap'), s, () => draw(), '#c-wrap');
      // Un clic qui fabrique plusieurs factures d'un coup annonce combien, et laisse reculer : les
      // défaire ensuite veut dire ouvrir chaque brouillon et le supprimer un par un.
      if ($('#gen-due')) $('#gen-due').onclick = async () => {
        const combien = due.length;
        if (!await confirmDialog(
          `Générer ${combien} brouillon${combien > 1 ? 's' : ''} de facture ?\n\n`
          + `${combien > 1 ? 'Ils arrivent' : 'Il arrive'} en brouillon dans Factures : rien n'est émis, rien n'est numéroté et rien ne part chez un client tant que tu ne l'as pas relu.`,
          `Générer ${combien > 1 ? 'les brouillons' : 'le brouillon'}`)) return;
        const res = generateRecurring(); toast(`${pl(res.n, 'brouillon créé', 'brouillons créés')} — à émettre depuis Factures`); draw();
      };
      // On mène à la fiche du contrat : c'est là qu'on voit le brouillon qui vient d'être créé.
      // `vers()` redessine quand on y est déjà — l'annulation repasse par ici et le hash n'a pas
      // changé, donc aucun `hashchange` ne viendrait rafraîchir la page (piège de la 7.15.0).
      $$('[data-gen]').forEach(b => b.onclick = () => {
        const r = data.recurring.find(x => x.id === b.dataset.gen);
        genererContrat(r, vers('#/contrat/' + r.id));
      });
      $$('[data-edit]').forEach(b => b.onclick = () => recurrenceForm(data.recurring.find(x => x.id === b.dataset.edit), draw));
      // Reprendre un contrat suspendu DÉPLACE sa prochaine échéance, et l'ancienne date est perdue :
      // un clic de trop sur « Suspendre » puis « Reprendre » décale la facturation sans qu'on puisse
      // revenir à l'état d'avant. On garde donc de quoi le défaire.
      $$('[data-toggle]').forEach(b => b.onclick = () => {
        const r = data.recurring.find(x => x.id === b.dataset.toggle);
        const avant = { active: r.active, nextDate: r.nextDate };
        r.active = r.active === false;
        let msg = r.active ? 'Contrat repris' : 'Contrat suspendu — plus aucun brouillon ne sera préparé';
        if (r.active && r.nextDate < C.today()) {
          // Reprise : on repart de la prochaine échéance, sans facturer les mois suspendus
          r.nextDate = C.catchUpRecurrence(r.nextDate, r.every, r.day);
          msg = `Contrat repris — prochaine facture le ${C.fmtDate(r.nextDate)} (les échéances passées ne sont pas facturées)`;
        }
        save(true); draw();
        toastUndo(msg, () => { Object.assign(r, avant); save(true); draw(); });
      });
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Facturation récurrente ${info('contrat.form')}</h1><div class="actions"><button class="btn btn-primary" id="new">+ Nouveau contrat</button></div></div><div id="c-wrap"></div>`;
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

  const relState = { sort: null, page: 1, q: '' };   // tri, page et recherche de la liste des factures à relancer
  routes.relances = () => {
    const cur = company().currency;
    const draw = () => {
      const all = C.overdueInvoices(data, company());
      // Recherche : la page Relances était l'une des deux seules listes à ne pas en avoir (audit).
      const q = relState.q.trim().toLowerCase();
      // La recherche ne filtrait qu'un tableau sur quatre : on tapait le nom d'un client, le premier
      // tableau se réduisait, et les trois autres continuaient d'afficher tout le monde — pendant que
      // le bandeau annonçait « n sur N ». Un filtre qui ne s'applique qu'à une partie de l'écran ment.
      const matchDoc = d => !q || `${d.number || ''} ${clientName(d.clientId)} ${d.subject || ''}`.toLowerCase().includes(q);
      const match = x => matchDoc(x.doc);
      const od = all.filter(x => !x.snoozed && match(x)), later = all.filter(x => x.snoozed && match(x));
      const soon = data.documents.filter(d => d.type === 'facture' && ['envoyée', 'partielle'].includes(effStatus(d)) && d.dueDate >= C.today() && C.daysBetween(C.today(), d.dueDate) <= 7 && matchDoc(d));
      const quotes = data.documents.filter(d => d.type === 'devis' && ['envoyé', 'expiré'].includes(effStatus(d)) && d.date && C.daysBetween(d.date, C.today()) > 10 && matchDoc(d))
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
      const nAll = all.filter(x => !x.snoozed).length;
      // Rien à relancer ET rien à venir : la page ne dit jamais la seule chose qui compte ici, à
      // savoir qu'elle se remplit TOUTE SEULE et qu'il n'y a rien à y saisir. Elle ouvrait sur un
      // moteur de recherche posé au-dessus de zéro ligne, et une note sur trois niveaux de relance
      // dont aucun exemple n'était visible.
      const rienDuTout = !all.length && !soon.length && !quotes.length && !q;
      const aDesFactures = data.documents.some(d => d.type === 'facture' && d.number);
      $('#r-wrap').innerHTML = rienDuTout ? etatVide('Relancer tes impayés',
        ['Dès qu\'une facture dépasse son échéance, elle apparaît ici toute seule : le nombre de jours de retard, ce qui reste à récupérer, et un email prêt à partir. <b>Tu n\'as rien à saisir sur cette page.</b>',
         'Trois tons, choisis pour toi selon le retard : rappel amical jusqu\'à 15 jours, relance jusqu\'à 45 jours, dernière relance au-delà. Les textes se modifient dans Paramètres → Emails.'],
        aDesFactures ? [['rel-vers-fac', 'Voir mes factures', true]] : [['rel-vers-new', '+ Créer ma première facture', true]])
        : `
        ${filtersBar(`
          <input type="search" id="rel-q" placeholder="Rechercher : n°, client, objet…" value="${h(relState.q)}">
          ${q ? `<span class="small muted">${od.length} sur ${nAll}</span>${filterReset(true)}` : ''}`, all.length, !!q)}
        ${od.length ? `<div class="banner">${od.length} facture(s) à relancer — ${C.money(total, cur)} à récupérer</div>` : `<div class="banner info">${q ? 'Aucune facture ne correspond à cette recherche.' : `Aucune facture à relancer${later.length ? ` (${later.length} reportée(s))` : ''}.`}</div>`}
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
      if ($('#rel-vers-fac')) $('#rel-vers-fac').onclick = () => navigate('#/factures');
      if ($('#rel-vers-new')) $('#rel-vers-new').onclick = () => navigate('#/doc/new/facture');
      if ($('#rel-q')) $('#rel-q').oninput = e => { relState.q = e.target.value; relState.page = 1; draw(); const el = $('#rel-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
      if ($('#reset-f')) $('#reset-f').onclick = () => { relState.q = ''; relState.page = 1; draw(); };
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
  // Chaque ligne de « À faire » doit mener quelque part. Jusqu'à la 7.0.0, `core.todoList` savait
  // produire vingt-deux sortes de lignes et neuf seulement avaient une action : les treize autres
  // affichaient un bouton « Voir » qui, au clic, ne faisait RIEN — ni message, ni erreur, ni
  // navigation, parce que `bindTodo` fait `if (a) a.run()`. Sur le tableau de bord du jeu de
  // démonstration, sept boutons sur treize étaient morts.
  //
  // C'est très exactement « y'a des choses qu'on arrive pas à faire et on ne comprend pas pourquoi ».
  // Un bouton qui ne répond pas n'apprend rien : on croit avoir mal cliqué, on recommence, on doute
  // de soi, puis on doute du logiciel.
  //
  // Le test « À faire : aucun bouton ne mène nulle part » interdit d'en rajouter un.
  // `navigate` pose le hash, et le routeur réagit au `hashchange` : quand on est DÉJÀ sur la page
  // visée, il n'y a pas de changement, donc pas de redessin — et le clic est avalé en silence, alors
  // que l'état (onglet, filtre) vient d'être modifié juste au-dessus. C'était le cas de « Voir les
  // factures » depuis Comptabilité → Cabinet, qui vise l'onglet Ventes de la même page : rien ne se
  // passait. Même piège que `goBack` et son cas « on y est déjà » (2.4.0).
  const vers = (hash, avant) => () => {
    if (avant) avant();
    if (location.hash === hash) render(); else navigate(hash);
  };
  // Poser un filtre sur une liste, en ENTIER. Chaque action recopiait à la main les cinq réglages à
  // remettre, et « Facturer » en oubliait un : `yearTouched`. Sans lui, la liste d'arrivée se
  // re-filtre toute seule sur l'année en cours et cache précisément les pièces que la ligne venait
  // d'annoncer. Une recopie à cinq morceaux se trompe un jour ; un helper, jamais.
  const filtre = (liste, st, extra) => () => Object.assign(listState[liste],
    { q: '', st: st || '', kind: '', year: '', yearAuto: false, yearTouched: true, page: 1 }, extra || {});
  const TODO_ACTIONS = {
    contrats: { label: 'Générer les brouillons', run: () => { const res = generateRecurring(); toast(`${pl(res.n, 'brouillon créé', 'brouillons créés')} — à relire puis émettre`); render(); } },
    retards: { label: 'Voir les relances', run: vers('#/relances') },
    societe: { label: 'Compléter', run: vers('#/parametres', () => { settingsTab = 'societe'; settingsFocus = 'p-identite'; }) },
    'devis-brouillons': { label: 'Voir les devis', run: vers('#/devis', filtre('devis', 'brouillon')) },
    'devis-acceptes': { label: 'Facturer', run: vers('#/devis', filtre('devis', 'accepté')) },
    'devis-expires': { label: 'Voir les devis', run: vers('#/devis', filtre('devis', 'expiré')) },
    'devis-sans-reponse': { label: 'Voir les devis', run: vers('#/devis', filtre('devis', 'envoyé')) },
    attestations: { label: 'Voir la liste', run: vers('#/compta', () => { comptaState.tab = 'ventes'; pageFocus = 'p-rs-clients'; }) },
    echeances: { label: 'Voir les échéances', run: vers('#/relances') },
    brouillons: { label: 'Voir les brouillons', run: vers('#/factures', filtre('facture', 'brouillon')) },
    // Les treize qui ne menaient nulle part.
    cloture: { label: 'Clôturer un mois', run: vers('#/compta', () => { comptaState.tab = 'clotures'; }) },
    fiscal: { label: 'Voir le calendrier', run: vers('#/compta', () => { comptaState.tab = 'calendrier'; }) },
    'fournisseurs-retard': { label: 'Voir les achats', run: vers('#/achats', () => { buyState.st = 'retard'; buyState.year = ''; }) },
    'fournisseurs-echeances': { label: 'Voir les achats', run: vers('#/achats', () => { buyState.st = 'à payer'; buyState.year = ''; }) },
    'attestations-fournisseurs': { label: 'Voir la liste', run: vers('#/compta', () => { comptaState.tab = 'achats'; }) },
    'stock-negatif': { label: 'Voir les alertes', run: vers('#/stock', () => { stockState.tab = 'alertes'; }) },
    'stock-bas': { label: 'Voir les alertes', run: vers('#/stock', () => { stockState.tab = 'alertes'; }) },
    'series-ecart': { label: 'Voir les numéros', run: vers('#/stock', () => { stockState.tab = 'series'; }) },
    garanties: { label: 'Voir les garanties', run: vers('#/garanties') },
    immobilisations: { label: 'Voir les lignes', run: vers('#/immos', () => { immoState.tab = 'attente'; }) },
    'declarations-sociales': { label: 'Voir les déclarations', run: vers('#/paie', () => { paieState.tab = 'declarations'; }) },
    bulletins: { label: 'Voir les bulletins', run: vers('#/paie', () => { paieState.tab = 'bulletins'; }) },
    'salaires-double': { label: 'Voir les mouvements', run: vers('#/tresorerie', () => { tresoState.tab = 'mouvements'; }) },
    tresorerie: { label: 'Voir la prévision', run: vers('#/tresorerie', () => { tresoState.tab = 'prevision'; }) },
    'taux-change': { label: 'Voir les pièces', run: vers('#/factures', filtre('facture')) },
    sauvegarde: { label: 'Choisir un dossier', run: vers('#/parametres', () => { settingsTab = 'donnees'; settingsFocus = 'p-externe'; }) }
  };

  // « Ce qui manque » (Comptabilité → Cabinet) et les contrôles avant clôture disent exactement ce
  // qu'il faut aller regarder — « 3 achats sans justificatif », « 2 mouvements non pointés » — et
  // c'étaient des lignes de texte inerte : un libellé, un compteur, et rien à cliquer. On lisait le
  // reproche, on retrouvait la page à la main, puis on cherchait lesquels. Même famille que les
  // treize boutons « Voir » morts de la 7.0.0, et même parade : une table, et un test de couverture
  // entre ce que `core.packChecklist` peut PRODUIRE et ce que l'interface sait ouvrir.
  const CHECK_ACTIONS = {
    brouillons: { label: 'Voir les brouillons', run: vers('#/factures', filtre('facture', 'brouillon')) },
    justificatifs: { label: 'Voir les achats', run: vers('#/achats', () => { buyState.st = ''; buyState.year = ''; }) },
    pointage: { label: 'Pointer les mouvements', run: vers('#/tresorerie', () => { tresoState.tab = 'rapprochement'; }) },
    bulletins: { label: 'Voir les bulletins', run: vers('#/paie', () => { paieState.tab = 'bulletins'; }) },
    stock: { label: 'Voir les alertes', run: vers('#/stock', () => { stockState.tab = 'alertes'; }) },
    series: { label: 'Voir les numéros', run: vers('#/stock', () => { stockState.tab = 'series'; }) },
    attestations: { label: 'Voir les factures', run: vers('#/compta', () => { comptaState.tab = 'ventes'; }) }
  };
  // Combien de lignes on montre avant de proposer « voir le reste ». En démo, « À faire » affichait
  // treize lignes et occupait l'écran entier : le chiffre d'affaires, le graphique et tout le reste
  // du tableau de bord passaient sous la ligne de flottaison. Treize corvées d'un coup, ça ne se
  // hiérarchise pas — ça se subit.
  const TODO_VISIBLE = 5;

  function todoPanel() {
    let items = C.todoList(data, company(), null, { copieExterne });
    // Tant que « Tes premiers pas » est à l'écran, il porte déjà la fiche société — en étape 1, et
    // formulée comme une étape. La répéter dix centimètres plus bas sous le titre « À faire » et le
    // libellé « Fiche société incomplète », c'est dire deux fois la même chose, dont une fois comme
    // un reproche, à quelqu'un qui vient de finir l'assistant.
    if (premiersPasVisibles()) items = items.filter(x => x.id !== 'societe');
    // Rien à faire et rien du tout ne sont pas la même chose. « Aucun retard, aucun contrat en
    // attente » sur une entreprise qui n'a jamais rien facturé, c'est féliciter quelqu'un pour un
    // travail qu'il n'a pas commencé. Dans ce cas la place revient aux premiers pas.
    if (!items.length) {
      // Et tant que « Tes premiers pas » est à l'écran, ILS SONT la liste des choses à faire :
      // annoncer « rien à faire » juste en dessous de « étape 1 sur 7 » se contredit à dix
      // centimètres d'intervalle.
      if (premiersPasVisibles() || (!data.documents.length && !data.clients.length)) return '';
      return `<div class="todo-ok">Rien à faire aujourd'hui : aucun retard, aucun contrat en attente, aucune attestation à réclamer.</div>`;
    }
    // Panneau repliable : une fois la liste connue, elle prend la place du tableau de bord.
    // L'état est gardé d'une session à l'autre, et le résumé replié dit ce qui reste.
    const open = prefs.get('todoOpen', true) !== false;
    const urgent = items.filter(x => x.level === 'danger').length;
    const summary = `${items.length} chose${items.length > 1 ? 's' : ''} à faire${urgent ? ` · ${urgent} urgente${urgent > 1 ? 's' : ''}` : ''}`;
    return `<div class="panel todo${open ? '' : ' collapsed'}">
      <h2><button type="button" class="collapse-h" id="todo-toggle" aria-expanded="${open}" aria-controls="todo-list" title="${open ? 'Replier' : 'Déplier'} la liste">
        <span class="chev">▾</span>À faire<span class="count">${items.length}</span></button> ${info('todo')}</h2>
      <p class="todo-sum small muted" ${open ? 'hidden' : ''}>${h(summary)}</p>
      <ul id="todo-list" ${open ? '' : 'hidden'}>${items.map((x, i) => `<li class="lvl-${x.level}" ${i >= TODO_VISIBLE && !todoTout ? 'hidden' : ''}>
        <span class="td-dot"></span>
        <span class="td-txt"><strong>${h(x.label)}</strong><span class="small muted">${h(x.detail || '')}</span></span>
        <button class="btn btn-sm" data-todo="${x.id}">${h((TODO_ACTIONS[x.id] || {}).label || 'Voir')}</button>
      </li>`).join('')}</ul>
      ${items.length > TODO_VISIBLE && !todoTout ? `<button class="btn btn-sm btn-ghost todo-more" id="todo-more" ${open ? '' : 'hidden'}>Voir les ${items.length - TODO_VISIBLE} autres</button>` : ''}
      </div>`;
  }
  // Déplié pour la session en cours seulement : demain, la liste repart courte. Ce n'est pas un
  // réglage, c'est un geste — le mémoriser ramènerait le mur de treize lignes tous les matins.
  let todoTout = false;
  function bindTodo() {
    // `if (a) a.run()` avalait le clic en silence quand l'action manquait. Un bouton qui ne répond
    // pas est pire qu'un bouton absent : on croit avoir mal cliqué. Le test de couverture rend ce
    // cas impossible — et si jamais il revenait, l'application le DIT au lieu de se taire.
    $$('[data-todo]').forEach(b => b.onclick = () => {
      const a = TODO_ACTIONS[b.dataset.todo];
      if (a) return a.run();
      toast(`Cette ligne n'a pas encore d'écran dédié (${b.dataset.todo}) — signale-le dans Aide → Signaler un problème.`, true);
    });
    const plus = $('#todo-more');
    if (plus) plus.onclick = () => {
      todoTout = true;
      $$('#todo-list li').forEach(li => { li.hidden = false; });
      plus.remove();
    };
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
    const ach = $('#nav-achats');
    if (ach) { const n = C.payablesList(data, company(), C.today()).filter(x => x.late > 0).length; ach.hidden = !n; ach.textContent = n; }
    const tr = $('#nav-treso');
    if (tr) {
      // Le compteur ne s'allume que pour un trou prévu : une alerte permanente n'alerte plus personne.
      const hole = data.accounts.length ? C.cashForecast(data, company(), 30, C.today()).shortfall : null;
      tr.hidden = !hole; tr.textContent = '!';
      tr.className = 'nav-count' + (hole ? '' : '');
    }
    const im = $('#nav-immos');
    if (im) { const n = C.assetsToCreate(data).length; im.hidden = !n; im.textContent = n; }
    const pay = $('#nav-paie');
    if (pay) {
      const t = C.today();
      const prev = C.addMonths(t.slice(0, 7) + '-01', -1, 1);
      const n = data.employees.length ? C.missingPayslips(data, Number(prev.slice(0, 4)), Number(prev.slice(5, 7))).length : 0;
      pay.hidden = !n; pay.textContent = n;
    }
    const stk = $('#nav-stock');
    if (stk) { const n = C.stockAlerts(data).length + C.serialGaps(data).length; stk.hidden = !n; stk.textContent = n; }
  }

  // Les onglets du Catalogue et des Paramètres vivaient dans leur fonction de route, donc hors de
  // portée de la palette. Une seule source pour les deux usages : l'écran les dessine, la recherche
  // les indexe. Le troisième élément du catalogue est la clé de sa bulle « i ».
  const CATALOG_TABS = [['presta', 'Prestations', 'cat.catalog'], ['modeles', 'Modèles de documents', 'ed.template'], ['textes', 'Textes prédéfinis', 'cat.snippets']];
  const SETTINGS_TABS = [['societe', 'Société'], ['documents', 'Documents'], ['emails', 'Emails'], ['apparence', 'Apparence'],
    ['cabinet', 'Cabinet comptable'], ['donnees', 'Sécurité et données'], ['licence', 'Licence'], ['maj', 'Mises à jour']];

  // ---------- palette de recherche (Cmd/Ctrl+K) ----------
  //
  // Les onglets de l'application, lus dans les tableaux qui les dessinent. Appelée au moment de
  // l'ouverture, jamais au chargement : la plupart de ces tableaux sont déclarés plus bas.
  // Catalogue et Paramètres gardent les leurs dans leur fonction de route ; on les reprend ici, et
  // le test « la palette connaît tous les onglets » vérifie que les deux copies concordent.
  function ongletsDePalette() {
    return [
      ['Comptabilité', '#/compta', v => { comptaState.tab = v; }, COMPTA_TABS],
      ['Paie', '#/paie', v => { paieState.tab = v; }, PAIE_TABS],
      ['Stock', '#/stock', v => { stockState.tab = v; }, STOCK_TABS],
      ['Marges', '#/marges', v => { margeState.tab = v; }, MARGE_TABS],
      ['Trésorerie', '#/tresorerie', v => { tresoState.tab = v; }, TRESO_TABS],
      ['Immobilisations', '#/immos', v => { immoState.tab = v; }, IMMO_TABS],
      ['Proforma, bons et contrats', '#/autres', v => { autresTab = v; }, AUTRES_TABS],
      ['Catalogue', '#/catalogue', v => { catalogTab = v; }, CATALOG_TABS],
      ['Paramètres', '#/parametres', v => { settingsTab = v; }, SETTINGS_TABS]
    ];
  }
  // Les mots qu'on tape et qui ne figurent dans aucun libellé. Sans eux, « maj », « backup »,
  // « démo » ou « mot de passe » ne rendent rien — et deux réponses vides suffisent à faire croire
  // que la recherche ne connaît pas l'application.
  const ALIAS = {
    'Paramètres → Mises à jour': 'maj version mise à jour nouvelle version télécharger',
    'Paramètres → Sécurité et données': 'sauvegarde backup copie externe chiffrer mot de passe verrou effacer exemple démo importer exporter dossier',
    'Paramètres → Apparence': 'logo cachet signature couleur thème sombre police',
    'Paramètres → Société': 'raison sociale matricule fiscal rib rc capital adresse',
    'Paramètres → Cabinet comptable': 'appairage empreinte comptable expert',
    'Paramètres → Licence': 'clé activation abonnement expiration',
    'Comptabilité → TVA à payer': 'tva déclaration collectée déductible crédit',
    'Comptabilité → Calendrier fiscal': 'échéance acompte déclaration date limite',
    'Comptabilité → Cabinet': 'paquet skanpack envoyer comptable mensuel',
    'Comptabilité → Écritures': 'journal comptable débit crédit compte plan',
    'Comptabilité → Clôtures': 'clôturer fermer mois verrouiller période',
    'Trésorerie → Rapprochement': 'pointer relevé bancaire',
    'Paie → Congés et absences': 'vacances maladie absence',
    'Paie → Déclarations': 'cnss trimestre employeur annuelle',
    'Tous les modules': 'menu cacher afficher page manquante',
    'Revoir l\'assistant de démarrage': 'assistant onboarding recommencer premier démarrage bienvenue'
  };
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
      ['Facturation récurrente (contrats qui refacturent)', () => navigate('#/contrats')], ['Achats et dépenses', () => navigate('#/achats')], ['Nouvelle facture d\'achat', () => navigate('#/achat/new')], ['Nouvelle dépense', () => navigate('#/achat/new/-/depense')], ['Fournisseurs', () => navigate('#/fournisseurs')], ['Trésorerie', () => navigate('#/tresorerie')], ['Marges et rentabilité', () => navigate('#/marges')], ['Paie', () => navigate('#/paie')], ['Bulletins de paie', () => { paieState.tab = 'bulletins'; navigate('#/paie'); }], ['Salariés', () => { paieState.tab = 'salaries'; navigate('#/paie'); }], ['Barèmes de paie', () => { paieState.tab = 'baremes'; navigate('#/paie'); }], ['Déclarations sociales', () => { paieState.tab = 'declarations'; navigate('#/paie'); }], ['Déclaration CNSS', () => { paieState.tab = 'declarations'; navigate('#/paie'); }], ['Registre du personnel', () => { paieState.tab = 'registre'; navigate('#/paie'); }], ['Nouveau salarié', () => employeeForm(null, () => render())], ['Stock', () => navigate('#/stock')], ['Garanties', () => navigate('#/garanties')], ['Numéros de série', () => { stockState.tab = 'series'; navigate('#/stock'); }], ['Entrée de numéros de série', () => serialIntakeForm(null, () => render())], ['Inventaire', () => { stockState.tab = 'inventaire'; navigate('#/stock'); }], ['Mouvement de stock', () => adjustForm(null, () => render())], ['Immobilisations', () => navigate('#/immos')], ['Nouvelle immobilisation', () => assetForm(null, a => navigate('#/immo/' + a.id))], ['Lignes à immobiliser', () => { immoState.tab = 'attente'; navigate('#/immos'); }], ['Seuil de rentabilité', () => navigate('#/marges')], ['Nouvelle affaire', () => projectForm(null, p => navigate('#/affaire/' + p.id))], ['Nouveau fournisseur', () => supplierForm(null, () => render())], ['Proformas', () => navigate('#/autres/proforma')], ['Bons de commande', () => navigate('#/autres/commande')], ['Bons de livraison', () => navigate('#/autres/livraison')], ['Contrats à signer', () => navigate('#/autres/contrat')], ['Clients', () => navigate('#/clients')], ['Catalogue', () => navigate('#/catalogue')], ['Statistiques', () => navigate('#/stats')], ['Comptabilité', () => navigate('#/compta')], ['Paramètres', () => navigate('#/parametres')],
      ['Aide et guide', () => navigate('#/aide')], ['Nouveau client', () => clientForm(null, () => render())],
      // La palette liste TOUTES les pages, y compris celles des modules retirés du menu : c'est ce
      // qui rend le filtrage de la barre latérale inoffensif.
      ['Tous les modules', () => navigate('#/modules')],
      ['Revoir l\'assistant de démarrage', () => rejouerAssistant()]
    ]
      // Les ONGLETS. La palette n'en connaissait aucun : « TVA » ne rendait que des articles à lire,
      // « cabinet », « mise à jour », « écritures », « calendrier fiscal » et « apparence » ne
      // rendaient RIEN — deux réponses vides d'affilée, et on en conclut que la chose n'existe pas
      // dans SkanFact. Elle existe : ce sont sept onglets de Comptabilité et huit de Paramètres.
      // Un onglet n'a de nom qu'une fois la page ouverte : impossible à deviner.
      //
      // On les ENGENDRE à partir des tableaux qui les dessinent, au lieu de les recopier : un onglet
      // ajouté demain devient trouvable le jour même, sans que personne y pense. Le libellé est
      // préfixé par la page — « Cabinet » tout seul ne dit pas où l'on va.
      .concat(ongletsDePalette().map(([page, route, poser, tabs]) => tabs.map(([id, label]) =>
        [`${page} → ${label}`, () => { poser(id); navigate(route); }]
      )).flat())
      .map(([label, run]) => ({ kind: 'Action', main: label, text: label.toLowerCase(), run }))
      // Les mots qu'on tape vraiment, et qui ne sont dans aucun libellé : « maj », « backup »,
      // « démo », « logo », « mot de passe »… `text` sert déjà au filtrage, on lui ajoute les alias.
      .map(a => { const al = ALIAS[a.main]; return al ? { ...a, text: a.text + ' ' + al } : a; });
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
    // ⌘⇧A : voir le document en grand. Ailleurs que dans un éditeur, on le DIT plutôt que de ne
    // rien faire — un raccourci silencieux fait douter du clavier avant de faire douter de l'app.
    else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      if (pleinEcranCourant) pleinEcranCourant();
      else toast('Le grand aperçu s\'ouvre depuis un devis ou une facture.');
    }
    else if (e.key === 'Escape') {
      if ($('#info-pop')) { closeInfoPop(); return; }
      if ($('#dos-menu') && !$('#dos-menu').hidden) { fermerDossiers(); return; }
      if (closeOverlay) { closeOverlay(); return; }   // calendrier ou liste déroulante ouverte
      if ($$('.more-list').some(l => !l.hidden)) { closeMenus(); return; }
      if (!$('#palette-root').hidden) { closePalette(); return; }
      if (modalClose) modalClose();
    }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.more')) closeMenus(); });
  // Le sélecteur d'entreprise : un clic dessus l'ouvre, un clic ailleurs le referme.
  const brandBtn = $('#brand-btn');
  if (brandBtn) brandBtn.onclick = e => { e.stopPropagation(); ouvrirDossiers(); };
  document.addEventListener('click', e => { if (!e.target.closest('.brand-wrap')) fermerDossiers(); });
  // Un clic ailleurs referme le calendrier ou la liste déroulante ouverte.
  document.addEventListener('mousedown', e => {
    if (closeOverlay && !e.target.closest('.combo') && !e.target.closest('.datefield')) closeOverlay();
  });

  // ---------- Paramètres ----------

  // ---------- Comptabilité ----------
  // Les colonnes des journaux vivent dans core.js depuis la 6.1.0 : l'export manuel et le paquet
  // envoyé au cabinet doivent dire exactement la même chose, sinon deux exports du même mois diffèrent.
  const journalColumns = () => C.salesCsvColumns();
  const buyJournalColumns = () => C.buyCsvColumns();
  const payColumns = () => C.payCsvColumns();
  const decColumns = () => C.supplierPayCsvColumns();

  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const cabinetState = { month: '', seal: false };
  const comptaState = {
    tab: 'ventes',
    year: C.today().slice(0, 4), month: C.today().slice(5, 7),
    q: '',                                 // recherche, commune aux journaux de la page
    journal: { sort: null, page: 1 },      // journal des ventes
    pays: { sort: null, page: 1 },         // encaissements
    buys: { sort: null, page: 1 }          // journal des achats
  };
  const COMPTA_TABS = [['ventes', 'Ventes'], ['achats', 'Achats'], ['tva', 'TVA à payer'], ['ecritures', 'Écritures'], ['calendrier', 'Calendrier fiscal'], ['clotures', 'Clôtures'], ['cabinet', 'Cabinet']];
  // État propre à l'onglet Écritures : sa pagination et son tri ne doivent pas se mélanger à ceux
  // des journaux de la même page.
  const ecrState = { page: 1, sort: null };

  // ---------- Fournisseurs ----------
  const supplierById = id => data.suppliers.find(s => s.id === id);
  const supplierName = id => (supplierById(id) || {}).name || '—';

  function supplierForm(supplier, done, preset) {
    const s = supplier || Object.assign({ id: C.uid(), name: '', contact: '', matricule: '', address: '', phone: '', email: '', rib: '', bank: '', notes: '', paymentTermsDays: '', withholdingRate: '' }, preset || {});
    modal(`<h2>${supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h2>
      <form id="sf" class="grid-2">
        <label class="field span-2 obligatoire">Nom / Raison sociale<input type="text" name="name" value="${h(s.name)}" required></label>
        ${field(lbl('Personne à contacter', 'cl.contact'), 'contact', s.contact || '', 'text', 'placeholder="M. Sami Gharbi, commercial"')}
        ${field(lbl('Matricule fiscal', 'co.matricule'), 'matricule', s.matricule || '')}
        ${field('Téléphone', 'phone', s.phone || '')}
        ${field('Email', 'email', s.email || '', 'email')}
        ${field(lbl('Délai de paiement accordé (jours)', 'sup.terms'), 'paymentTermsDays', s.paymentTermsDays || '', 'number', 'min="0" class="num" placeholder="30"')}
        <label class="field">${lbl('Retenue à la source à opérer', 'sup.withholding')}<select name="withholdingRate"><option value="" ${s.withholdingRate === '' || s.withholdingRate == null ? 'selected' : ''}>Aucune</option>${C.WITHHOLDING_RATES.filter(r => r).map(r => `<option value="${r}" ${String(s.withholdingRate) === String(r) ? 'selected' : ''}>${pct(r)} %</option>`).join('')}</select></label>
        ${field(lbl('Banque', 'pay.bank'), 'bank', s.bank || '')}
        ${field('RIB du fournisseur', 'rib', s.rib || '')}
        <label class="field span-2">Adresse<textarea name="address">${h(s.address || '')}</textarea></label>
        <label class="field span-2">Notes internes<textarea name="notes">${h(s.notes || '')}</textarea></label>
      </form>
      <div class="modal-actions">
        ${supplier ? '<button class="btn btn-danger" id="del-sup" style="margin-right:auto">Supprimer ce fournisseur</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = () => {
          const v = formValues($('#sf', root));
          if (!v.name.trim()) return refus('#sf input[name=name]', 'Le nom est obligatoire : c\'est lui qui apparaît sur chaque achat.');
          Object.assign(s, v, {
            withholdingRate: v.withholdingRate === '' ? '' : Number(v.withholdingRate),
            paymentTermsDays: v.paymentTermsDays === '' ? '' : Number(v.paymentTermsDays)
          });
          if (!supplier) data.suppliers.push(s);
          save(true); close(); if (done) done(s);
        };
        if ($('#del-sup', root)) $('#del-sup', root).onclick = async () => {
          const n = data.purchases.filter(p => p.supplierId === s.id).length;
          if (n) return toast(`Impossible : ${n} achat(s) sont liés à ce fournisseur. Un fournisseur qui a une histoire ne se supprime pas.`, true);
          if (!await confirmDialog(`Supprimer ${s.name} ?`)) return;
          forget('suppliers', s.id, s.name);
          data.suppliers = data.suppliers.filter(x => x.id !== s.id); save(true); close(); navigate('#/fournisseurs');
        };
      });
  }

  const supplierState = { q: '', f: '', sort: { key: 'name', dir: 'asc' }, page: 1 };
  const supplierBuyState = { sort: null, page: 1 };

  routes.fournisseurs = () => {
    const cur = company().currency;
    const s = supplierState;
    const cols = [
      { key: 'name', label: 'Nom', asc: true, val: r => r.s.name.toLowerCase(), get: r => `<strong>${h(r.s.name)}</strong>${r.s.contact ? `<div class="small muted">${h(r.s.contact)}</div>` : ''}` },
      { key: 'mf', label: 'Matricule', get: r => `${h(r.s.matricule || '')}${Number(r.s.withholdingRate) ? `<div class="small muted">RS ${pct(r.s.withholdingRate)} %</div>` : ''}` },
      { key: 'contact', label: 'Contact', get: r => `<span class="small">${h(r.s.phone || '')}${r.s.phone && r.s.email ? '<br>' : ''}${h(r.s.email || '')}</span>` },
      { key: 'count', label: 'Achats', r: true, val: r => r.sum.count, get: r => r.sum.count || '<span class="muted">—</span>' },
      { key: 'ht', label: 'Acheté HT', r: true, val: r => r.sum.ht, get: r => r.sum.ht ? C.money(r.sum.ht, cur) : '<span class="muted">—</span>' },
      { key: 'due', label: 'Reste à payer', r: true, val: r => r.sum.remaining, get: r => r.sum.remaining > 0.0005 ? `<strong class="${r.sum.late > 0.0005 ? 'warn-text' : ''}">${C.money(r.sum.remaining, cur)}</strong>` : '<span class="muted">—</span>' },
      { key: 'last', label: 'Dernier achat', val: r => r.sum.last || '', get: r => r.sum.last ? C.fmtDate(r.sum.last) : '<span class="muted">—</span>' }
    ];
    const FILTERS = [['', 'Tous les fournisseurs'], ['due', 'Avec un impayé'], ['late', 'En retard de paiement'], ['none', 'Sans aucun achat']];
    const draw = (sortKey) => {
      if (sortKey) { s.sort = toggleSort(s.sort, sortKey, cols); s.page = 1; }
      const all = data.suppliers.map(x => ({ s: x, sum: C.supplierSummary(data, company(), x.id, C.today()) }));
      const rows = applySort(all
        .filter(r => !s.q || [r.s.name, r.s.contact, r.s.matricule, r.s.email, r.s.phone].join(' ').toLowerCase().includes(s.q))
        .filter(r => !s.f || (s.f === 'due' ? r.sum.remaining > 0.0005 : s.f === 'late' ? r.sum.late > 0.0005 : r.sum.count === 0)), cols, s.sort);
      const filtered = !!(s.q || s.f);
      const { rows: page, pg } = paginate(rows, s);
      const totalHT = rows.reduce((a, r) => a + r.sum.ht, 0);
      const totalDue = rows.reduce((a, r) => a + r.sum.remaining, 0);
      $('#list-wrap').innerHTML = rows.length ? `<table class="list sortable"><thead>
          ${sortHead(cols, s.sort, '<th class="row-actions-h"></th>')}</thead><tbody>
        ${page.map(r => `<tr class="clickable" data-sid="${r.s.id}">
          ${cols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}
          <td class="row-actions"><span>
            <button class="btn btn-sm" data-buy="${r.s.id}" title="Enregistrer un achat chez ce fournisseur">+ Achat</button>
            <button class="btn btn-sm" data-edit="${r.s.id}">Modifier</button>
          </span></td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="4">${rows.length} fournisseur${rows.length > 1 ? 's' : ''}</td>
          <td class="r">${C.money(totalHT, cur)}</td><td class="r">${totalDue > 0.0005 ? C.money(totalDue, cur) : '<span class="muted">—</span>'}</td><td></td><td></td></tr></tfoot>
        </table>${pagerBar(pg, { noun: 'fournisseur', grandTotal: all.length })}`
        : `<div class="empty">${filtered ? 'Aucun fournisseur ne correspond à cette recherche.' : 'Aucun fournisseur. Ajoute ceux chez qui tu achètes : leurs coordonnées et leur délai de paiement se reporteront sur chaque achat.'}</div>`;
      const note = $('#f-note');
      note.hidden = !filtered;
      note.innerHTML = !filtered ? '' : `<span class="small muted">${rows.length} sur ${all.length}</span>${filterReset(true)}`;
      if ($('#reset-f')) $('#reset-f').onclick = () => { s.q = ''; s.f = ''; s.page = 1; routes.fournisseurs(); };
      $$('tr.clickable[data-sid]').forEach(tr => tr.onclick = e => { if (e.target.closest('button')) return; navigate('#/fournisseur/' + tr.dataset.sid); });
      $$('[data-edit]').forEach(b => b.onclick = () => supplierForm(supplierById(b.dataset.edit), () => draw()));
      $$('[data-buy]').forEach(b => b.onclick = () => navigate('#/achat/new/' + b.dataset.buy));
      bindSort($('#list-wrap'), draw);
      bindPager($('#list-wrap'), s, () => draw(), '#list-wrap');
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Fournisseurs</h1><div class="actions"><button class="btn btn-primary" id="new">+ Nouveau fournisseur</button></div></div>
      <div class="filters">
        <input type="text" id="q" placeholder="Rechercher : nom, contact, matricule…" value="${h(s.q)}">
        <select id="f">${FILTERS.map(([v, l]) => `<option value="${v}" ${s.f === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${info('list.sort')}
        <span class="f-note" id="f-note" hidden></span>
      </div><div id="list-wrap"></div>`;
    $('#new').onclick = () => supplierForm(null, () => draw());
    $('#q').oninput = e => { s.q = e.target.value.toLowerCase(); s.page = 1; draw(); };
    $('#f').onchange = e => { s.f = e.target.value; s.page = 1; draw(); };
    draw();
  };

  routes.fournisseur = (parts) => {
    const s = supplierById(parts[0]);
    if (!s) return navigate('#/fournisseurs');
    const cur = company().currency;
    const sum = C.supplierSummary(data, company(), s.id, C.today());
    const mine = data.purchases.filter(p => p.supplierId === s.id);
    const draw = () => {
      const { cols } = purchaseColumns({ hideSupplier: true });
      const list = applySort(mine.slice(), cols, supplierBuyState.sort);
      const { rows, pg } = paginate(list, supplierBuyState);
      $('#sup-docs').innerHTML = mine.length ? `<table class="list compact sortable"><thead>${sortHead(cols, supplierBuyState.sort)}</thead><tbody>
          ${rows.map(p => `<tr class="clickable" data-id="${p.id}">${cols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(p)}</td>`).join('')}</tr>`).join('')}
        </tbody></table>${pagerBar(pg, { noun: 'achat' })}`
        : '<div class="empty">Aucun achat chez ce fournisseur pour l\'instant.</div>';
      $$('#sup-docs tr.clickable').forEach(tr => tr.onclick = () => navigate('#/achat/' + tr.dataset.id));
      bindSort($('#sup-docs'), key => { supplierBuyState.sort = toggleSort(supplierBuyState.sort, key, cols); supplierBuyState.page = 1; draw(); });
      bindPager($('#sup-docs'), supplierBuyState, () => draw(), '#sup-docs');
    };
    $('#view').innerHTML = `
      <div class="page-head"><div><h1>${h(s.name)}</h1>${s.contact ? `<div class="small muted">${h(s.contact)}</div>` : ''}</div>
        <div class="actions">${backButton('#/fournisseurs')}<button class="btn" id="edit">Modifier</button><button class="btn btn-primary" id="buy">+ Enregistrer un achat</button></div></div>
      <div class="stats">
        <div class="stat"><div class="lbl">Acheté HT ${info('sup.total')}</div><div class="val">${C.money(sum.ht, cur)}</div><div class="sub">${sum.count} pièce(s)</div></div>
        <div class="stat"><div class="lbl">Reste à payer ${info('sup.due')}</div><div class="val ${sum.remaining > 0.0005 ? 'due' : ''}">${C.money(sum.remaining, cur)}</div><div class="sub">${sum.late > 0.0005 ? `dont ${C.money(sum.late, cur)} en retard` : 'rien en retard'}</div></div>
        <div class="stat"><div class="lbl">Délai accordé</div><div class="val">${s.paymentTermsDays === '' || s.paymentTermsDays == null ? '—' : s.paymentTermsDays + ' j'}</div><div class="sub">reporté sur chaque achat</div></div>
        <div class="stat"><div class="lbl">Relation</div><div class="val">${sum.first ? C.fmtDate(sum.first).slice(3) : '—'}</div><div class="sub">${sum.last ? 'dernier achat le ' + C.fmtDate(sum.last) : 'aucun achat'}</div></div>
      </div>
      <div class="dash-grid">
        <div class="panel"><h2>Achats chez ce fournisseur</h2><div id="sup-docs"></div></div>
        <div class="panel"><h2>Coordonnées</h2>
          <div class="kv">
            <div><span>Matricule fiscal</span><span>${h(s.matricule || '—')}</span></div>
            <div><span>Téléphone</span><span>${h(s.phone || '—')}</span></div>
            <div><span>Email</span><span>${h(s.email || '—')}</span></div>
            <div><span>Banque</span><span>${h(s.bank || '—')}</span></div>
            <div><span>RIB</span><span>${h(s.rib || '—')}</span></div>
            <div><span>Retenue à la source</span><span>${Number(s.withholdingRate) ? pct(s.withholdingRate) + ' %' : 'aucune'}</span></div>
          </div>
          ${s.address ? `<p class="small muted mt">${C.nl2br(s.address)}</p>` : ''}
          <h3 class="sub-h">Notes internes ${info('cl.notes')}</h3>
          <textarea id="sup-notes" placeholder="Ce qu'il faut savoir sur ce fournisseur : délais réels, interlocuteur, conditions négociées…">${h(s.notes || '')}</textarea>
          <p class="small muted">Enregistré automatiquement. Ces notes ne s'impriment nulle part.</p>
        </div>
      </div>`;
    bindBack('#/fournisseurs');
    $('#edit').onclick = () => supplierForm(s, () => render());
    $('#buy').onclick = () => navigate('#/achat/new/' + s.id);
    let noteTimer = null;
    $('#sup-notes').oninput = e => { s.notes = e.target.value; clearTimeout(noteTimer); noteTimer = setTimeout(() => save(true), 600); };
    draw();
  };

  // ---------- Achats et dépenses ----------
  const purchaseById = id => data.purchases.find(p => p.id === id);
  const buyStatus = p => C.purchaseStatus(p, company(), C.today());

  function purchaseColumns(opts) {
    opts = opts || {};
    const cur = company().currency;
    const netOf = p => C.purchaseTotals(p, company()).netToPay;
    const restOf = p => C.purchaseBalance(p, company()).remaining;
    const cols = [
      { key: 'date', label: 'Date', cls: 'nw', val: p => p.date || '', get: p => C.fmtDate(p.date) },
      { key: 'number', label: 'N° fournisseur', cls: 'nw', asc: true, val: p => (p.number || '').toLowerCase(), get: p => p.number ? `<strong>${h(p.number)}</strong>` : '<span class="muted">sans numéro</span>' }
    ];
    if (!opts.hideSupplier) cols.push({ key: 'supplier', label: 'Fournisseur', asc: true, val: p => supplierName(p.supplierId).toLowerCase(), get: p => `${h(supplierName(p.supplierId))}${p.subject ? `<div class="small muted">${h(p.subject)}</div>` : ''}` });
    else cols.push({ key: 'subject', label: 'Objet', asc: true, val: p => (p.subject || '').toLowerCase(), get: p => h(p.subject || '') || '<span class="muted">—</span>' });
    cols.push(
      { key: 'category', label: 'Catégorie', asc: true, val: p => (p.category || '').toLowerCase(), get: p => `${h(p.category || '')}${p.kind === 'depense' ? '<div class="small muted">dépense</div>' : ''}` || '<span class="muted">—</span>' },
      { key: 'due', label: 'Échéance', cls: 'nw', val: p => p.dueDate || '', get: p => p.dueDate ? C.fmtDate(p.dueDate) : '<span class="muted">—</span>' },
      { key: 'status', label: 'Statut', val: p => buyStatus(p), get: p => buyBadge(buyStatus(p)) },
      { key: 'net', label: 'Net à payer', r: true, val: netOf, get: p => C.money(netOf(p), cur) },
      { key: 'rest', label: 'Reste', r: true, val: restOf, get: p => { const x = restOf(p); return x > 0.0005 ? C.money(x, cur) : '<span class="muted">—</span>'; } }
    );
    return { cols, netOf, restOf };
  }

  const buyState = { q: '', st: '', kind: '', cat: '', year: '', sort: { key: 'date', dir: 'desc' }, page: 1 };

  routes.achats = () => {
    const cur = company().currency;
    const s = buyState;
    const { cols, netOf, restOf } = purchaseColumns({});
    const all = data.purchases;
    const years = Array.from(new Set(all.map(p => (p.date || '').slice(0, 4)).filter(Boolean))).sort().reverse();
    const cats = Array.from(new Set(all.map(p => p.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));
    const draw = (sortKey) => {
      if (sortKey) { s.sort = toggleSort(s.sort, sortKey, cols); s.page = 1; }
      const rows = applySort(all
        .filter(p => !s.kind || p.kind === s.kind)
        .filter(p => !s.year || (p.date || '').startsWith(s.year))
        .filter(p => !s.cat || p.category === s.cat)
        .filter(p => !s.st || buyStatus(p) === s.st)
        .filter(p => !s.q || [p.number, supplierName(p.supplierId), p.subject, p.category].join(' ').toLowerCase().includes(s.q)), cols, s.sort);
      const filtered = !!(s.q || s.st || s.kind || s.cat || s.year);
      const { rows: page, pg } = paginate(rows, s);
      // Les totaux portent sur toute la sélection, jamais sur la page affichée.
      const totHT = rows.reduce((a, p) => a + C.purchaseTotals(p, company()).totalHT, 0);
      const totNet = rows.reduce((a, p) => a + netOf(p), 0);
      const totRest = rows.reduce((a, p) => a + Math.max(0, restOf(p)), 0);
      $('#list-wrap').innerHTML = rows.length ? `<table class="list sortable"><thead>${sortHead(cols, s.sort, '<th class="row-actions-h"></th>')}</thead><tbody>
          ${page.map(p => `<tr class="clickable" data-id="${p.id}">${cols.map(c => `<td class="${c.r ? 'r nw' : ''}${c.cls ? ' ' + c.cls : ''}">${c.get(p)}</td>`).join('')}
            <td class="row-actions"><span>${restOf(p) > 0.0005 ? `<button class="btn btn-sm" data-pay="${p.id}" title="Enregistrer un règlement">Régler</button>` : ''}
            <button class="btn btn-sm btn-ghost" data-dup="${p.id}" title="Dupliquer">⧉</button></span></td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="${cols.length - 2}">${rows.length} pièce${rows.length > 1 ? 's' : ''} · ${C.money(totHT, cur)} HT</td>
          <td class="r">${C.money(totNet, cur)}</td><td class="r">${totRest > 0.0005 ? C.money(totRest, cur) : '<span class="muted">—</span>'}</td><td></td></tr></tfoot></table>${pagerBar(pg, { noun: 'pièce', grandTotal: all.length })}`
        : `<div class="empty">${filtered ? 'Aucune pièce ne correspond à ces filtres.' : 'Aucun achat enregistré. Saisis tes factures fournisseurs et tes dépenses ici : c\'est ce qui permettra de récupérer la TVA et de connaître ta marge réelle.'}</div>`;
      const note = $('#f-note');
      note.hidden = !filtered;
      note.innerHTML = !filtered ? '' : `<span class="small muted">${rows.length} sur ${all.length}</span>${filterReset(true)}`;
      if ($('#reset-f')) $('#reset-f').onclick = () => { s.q = ''; s.st = ''; s.kind = ''; s.cat = ''; s.year = ''; s.page = 1; routes.achats(); };
      $$('#list-wrap tr.clickable').forEach(tr => tr.onclick = e => { if (e.target.closest('button')) return; navigate('#/achat/' + tr.dataset.id); });
      $$('[data-pay]').forEach(b => b.onclick = () => supplierPaymentForm(purchaseById(b.dataset.pay), () => draw()));
      $$('[data-dup]').forEach(b => b.onclick = () => duplicatePurchase(purchaseById(b.dataset.dup)));
      bindSort($('#list-wrap'), draw);
      bindPager($('#list-wrap'), s, () => draw(), '#list-wrap');
    };
    $('#view').innerHTML = `
      <div class="page-head"><h1>Achats et dépenses</h1>
        <div class="actions"><button class="btn" id="new-dep">+ Dépense</button><button class="btn btn-primary" id="new">+ Facture d'achat</button></div></div>
      ${payablesPanel()}
      <div class="filters">
        <input type="text" id="q" placeholder="Rechercher : n°, fournisseur, objet, catégorie…" value="${h(s.q)}">
        <select id="kind"><option value="">Tout</option>${C.PURCHASE_KINDS.map(([v, l]) => `<option value="${v}" ${s.kind === v ? 'selected' : ''}>${l}s</option>`).join('')}</select>
        <select id="st"><option value="">Tous les statuts</option>${C.PURCHASE_STATUSES.map(x => `<option value="${x}" ${s.st === x ? 'selected' : ''}>${h(x)}</option>`).join('')}</select>
        ${cats.length > 1 ? `<select id="cat"><option value="">Toutes les catégories</option>${cats.map(c => `<option value="${h(c)}" ${s.cat === c ? 'selected' : ''}>${h(c)}</option>`).join('')}</select>` : ''}
        ${years.length > 1 ? `<select id="yr"><option value="">Toutes les années</option>${years.map(y => `<option value="${y}" ${s.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}
        ${info('list.filters')}
        <span class="f-note" id="f-note" hidden></span>
      </div>
      <div id="list-wrap"></div>`;
    $('#new').onclick = () => navigate('#/achat/new');
    $('#new-dep').onclick = () => navigate('#/achat/new/-/depense');
    $('#q').oninput = e => { s.q = e.target.value.toLowerCase(); s.page = 1; draw(); };
    $('#st').onchange = e => { s.st = e.target.value; s.page = 1; draw(); };
    $('#kind').onchange = e => { s.kind = e.target.value; s.page = 1; draw(); };
    if ($('#cat')) $('#cat').onchange = e => { s.cat = e.target.value; s.page = 1; draw(); };
    if ($('#yr')) $('#yr').onchange = e => { s.year = e.target.value; s.page = 1; draw(); };
    bindPayables();
    draw();
  };

  // Bandeau « à payer » : le pendant des relances, côté sortant.
  function payablesPanel() {
    const cur = company().currency;
    const due = C.payablesList(data, company(), C.today());
    if (!due.length) return '';
    const late = due.filter(x => x.late > 0);
    const soon = due.filter(x => !x.late && x.dueDate && C.daysBetween(C.today(), x.dueDate) <= 7);
    const total = due.reduce((s, x) => s + x.remaining, 0);
    const open = prefs.get('payablesOpen', true);
    return `<div class="panel todo" id="payables">
      <h2 class="collapse-h" id="pay-h" role="button" tabindex="0" aria-expanded="${open}">
        <span class="chev">${open ? '▾' : '▸'}</span>À payer ${info('buy.payables')}<span class="count">${due.length}</span></h2>
      <div id="pay-body" ${open ? '' : 'hidden'}>
        <p class="small muted">${C.money(total, cur)} dû au total${late.length ? ` · <span class="warn-text">${late.length} pièce(s) en retard</span>` : ''}${soon.length ? ` · ${soon.length} à régler sous 7 jours` : ''}.</p>
        <table class="list compact"><thead><tr><th>Fournisseur</th><th>Pièce</th><th>Échéance</th><th class="r">Reste dû</th><th></th></tr></thead><tbody>
          ${due.slice(0, 8).map(x => `<tr class="clickable ${x.late > 0 ? 'row-warn' : ''}" data-id="${h(x.id)}">
            <td>${h(supplierName(x.supplierId))}</td>
            <td>${x.number ? `<strong>${h(x.number)}</strong>` : '<span class="muted">sans numéro</span>'}${x.subject ? `<div class="small muted">${h(x.subject)}</div>` : ''}</td>
            <td class="nw">${x.dueDate ? C.fmtDate(x.dueDate) : '—'}${x.late ? `<div class="small warn-text">${x.late} j de retard</div>` : ''}</td>
            <td class="r nw"><strong>${C.money(x.remaining, cur)}</strong></td>
            <td class="actions"><button class="btn btn-sm" data-payx="${h(x.id)}">Régler</button></td></tr>`).join('')}
        </tbody></table>
        ${due.length > 8 ? `<p class="small muted mt">… et ${due.length - 8} autre(s). Filtre sur « à payer » ou « retard » pour tout voir.</p>` : ''}
      </div></div>`;
  }
  function bindPayables() {
    const h2 = $('#pay-h'); if (!h2) return;
    const toggle = () => {
      const body = $('#pay-body'); const open = body.hidden;
      body.hidden = !open; $('.chev', h2).textContent = open ? '▾' : '▸';
      h2.setAttribute('aria-expanded', String(open)); prefs.set('payablesOpen', open);
    };
    h2.onclick = toggle;
    h2.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
    $$('#payables tr.clickable').forEach(tr => tr.onclick = e => { if (e.target.closest('button')) return; navigate('#/achat/' + tr.dataset.id); });
    $$('[data-payx]').forEach(b => b.onclick = () => supplierPaymentForm(purchaseById(b.dataset.payx), () => render()));
  }

  function newPurchase(kind, supplierId) {
    const date = C.today();
    const sup = supplierId ? supplierById(supplierId) : null;
    const days = sup && sup.paymentTermsDays !== '' && sup.paymentTermsDays != null ? Number(sup.paymentTermsDays) : 30;
    return {
      id: C.uid(), kind: kind === 'depense' ? 'depense' : 'facture', supplierId: supplierId || '', number: '',
      date, dueDate: kind === 'depense' ? '' : C.addDays(date, days),
      subject: '', category: '', notes: '', fees: 0,
      withholdingRate: sup && Number(sup.withholdingRate) ? Number(sup.withholdingRate) : 0,
      // Côté ACHAT, le taux est celui du FOURNISSEUR, pas le nôtre : une entreprise exonérée paie
      // quand même la TVA de ses fournisseurs. Le réglage `defaultVatRate` ne s'applique donc pas ici.
      lines: [{ label: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19, destination: 'charge', deductible: true }],
      payments: [], attachments: [], createdAt: Date.now()
    };
  }

  function duplicatePurchase(p) {
    if (!p) return;
    const copy = { ...deepCopy(p), id: C.uid(), number: '', date: C.today(), createdAt: Date.now(), payments: [], attachments: [], withholdingCertificate: false };
    if (copy.dueDate) copy.dueDate = C.addDays(copy.date, 30);
    data.purchases.push(copy); save(true);
    toast('Copie créée — vérifie le numéro et la date de la facture du fournisseur');
    navigate('#/achat/' + copy.id);
  }

  // Règlement d'un achat : le symétrique exact d'un encaissement client.
  function supplierPaymentForm(p, done) {
    if (!p) return;
    const cur = company().currency;
    const b = C.purchaseBalance(p, company());
    modal(`<h2>Régler ${h(p.number || 'cet achat')}</h2>
      <p class="small muted">${h(supplierName(p.supplierId))} · net à payer ${C.money(b.totals.netToPay, cur)} · déjà réglé ${C.money(b.paid, cur)} · reste ${C.money(Math.max(0, b.remaining), cur)}</p>
      <form id="spf" class="grid-2">
        ${dateFieldHtml('Date du règlement', 'date', C.today(), {})}
        ${field('Montant', 'amount', C.round3(Math.max(0, b.remaining)), 'number', 'step="0.001" min="0" class="num"')}
        <label class="field">Mode<select name="method">${C.PAYMENT_METHODS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        ${accountFieldHtml('')}
        ${field('Référence', 'reference', '', 'text', 'placeholder="N° de chèque, référence du virement…"')}
        <label class="field span-2">Note<input type="text" name="note" value=""></label>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => { $('#ok', root).onclick = async () => {
        const v = formValues($('#spf', root));
        if (!(Number(v.amount) > 0)) return toast('Montant invalide.', true);
        if (!v.date) return toast('Date invalide.', true);
        if (v.date > C.today() && !await confirmDialog(`La date (${C.fmtDate(v.date)}) est dans le futur. Enregistrer quand même ?`, 'Enregistrer')) return;
        if (Number(v.amount) > b.remaining + 0.0005 && !await confirmDialog(`Le montant (${C.money(v.amount, cur)}) dépasse le reste dû (${C.money(Math.max(0, b.remaining), cur)}). Enregistrer quand même ?`, 'Enregistrer quand même')) return;
        if (closedBlock(v.date, 'Ce règlement')) return;
        const stored = purchaseById(p.id) || p;
        stored.payments = (stored.payments || []).concat([{ id: C.uid(), date: v.date, amount: C.round3(v.amount), method: v.method, accountId: v.accountId || '', reference: v.reference || '', note: v.note || '' }]);
        save(true); close(); toast('Règlement enregistré'); if (done) done();
      }; });
  }

  // Éditeur d'achat. Pas d'aperçu ni de PDF : le document existe déjà, c'est celui du fournisseur.
  // On le saisit pour récupérer la TVA, suivre ce qu'on doit et, plus tard, alimenter le stock.
  // Un achat n'est JAMAIS verrouillé (contrairement à une facture émise) : `locked` n'existe pas
  // dans cette route. L'y écrire lève une ReferenceError au moment de construire le gabarit, et
  // c'est TOUTE la page qui reste blanche — sans rien dans la console de l'utilisateur.
  routes.achat = (parts) => {
    let p, isNew = false;
    if (parts[0] === 'new') {
      const sup = parts[1] && parts[1] !== '-' ? parts[1] : '';
      p = newPurchase(parts[2] || (parts[1] === 'depense' ? 'depense' : 'facture'), supplierById(sup) ? sup : '');
      isNew = true;
    } else {
      const stored = purchaseById(parts[0]);
      if (!stored) return navigate('#/achats');
      p = deepCopy(stored);
    }
    const isDep = p.kind === 'depense';
    const cur = company().currency;
    const stored = isNew ? null : purchaseById(p.id);
    const cats = C.expenseCategories(data);

    const supplierItems = () => data.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(x => ({
      v: x.id, label: x.name, sub: [x.contact, x.matricule ? 'MF ' + x.matricule : ''].filter(Boolean).join(' · '),
      text: `${x.name} ${x.contact || ''} ${x.matricule || ''} ${x.email || ''}`
    }));

    $('#view').innerHTML = `
      <div class="page-head">
        <div><h1>${isNew ? (isDep ? 'Nouvelle dépense' : 'Nouvelle facture d\'achat') : `${isDep ? 'Dépense' : 'Facture d\'achat'} ${h(p.number || 'sans numéro')}`}
          <span class="dirty-dot" id="dirty-dot" hidden title="Modifications non enregistrées">non enregistré</span></h1>
          ${isNew ? '' : `<div class="small muted">${h(supplierName(p.supplierId))} · ${C.fmtDate(p.date)}</div>`}</div>
        <div class="actions">
          ${backButton('#/achats')}
          ${!isNew && C.purchaseBalance(stored, company()).remaining > 0.0005 ? '<button class="btn" id="pay">Enregistrer un règlement</button>' : ''}
          <button class="btn" id="photo">Depuis une photo… ${info('ocr.photo')}</button>
          <button class="btn btn-primary" id="save">Enregistrer</button>
          ${isNew ? '' : `<div class="more"><button class="btn" id="more-btn">Plus ▾</button><div class="more-list" id="more-list" hidden>
            <button id="dup">Dupliquer</button>
            <button id="del" class="danger">Supprimer</button>
          </div></div>`}
        </div></div>
      <div class="buy-editor">
        <div>
          <div class="panel"><h2>La pièce du fournisseur ${info('buy.head')}</h2>
            <form id="b-head" class="grid-3">
              <div class="field">${lbl('Fournisseur', 'buy.supplier')}
                ${combo({ name: 'supplierId', value: p.supplierId, items: supplierItems(), placeholder: '— Choisir un fournisseur —', search: 'Rechercher : nom, contact, MF…', add: '+ Nouveau fournisseur' })}
              </div>
              ${field(lbl(isDep ? 'Référence du justificatif' : 'Numéro de la facture', 'buy.number'), 'number', p.number || '', 'text', isDep ? 'placeholder="Ticket, reçu…"' : 'placeholder="Celui écrit sur la facture du fournisseur"')}
              <label class="field">${lbl('Nature', 'buy.kind')}<select name="kind">${C.PURCHASE_KINDS.map(([v, l]) => `<option value="${v}" ${p.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              ${dateFieldHtml(lbl('Date de la pièce', 'buy.date'), 'date', p.date, {})}
              ${dateFieldHtml(lbl('Échéance de paiement', 'buy.due'), 'dueDate', p.dueDate || '', { quick: true })}
              <div class="field">${lbl('Catégorie de charge', 'buy.category')}
                ${combo({ name: 'category', value: p.category || '', items: cats.map(c => ({ v: c, label: c })), placeholder: '— Choisir une catégorie —', search: 'Rechercher une catégorie…', add: '+ Nouvelle catégorie' })}
              </div>
              <label class="field span-2">${lbl('Objet', 'buy.subject')}<input type="text" name="subject" value="${h(p.subject || '')}" placeholder="Ex : disques durs pour la Clinique"></label>
              <div class="field">${lbl('Affaire (optionnel)', 'buy.project')}
                ${combo({ name: 'projectId', value: p.projectId || '', items: projectItems(''), placeholder: '— Aucune affaire —', search: 'Rechercher une affaire…', add: '+ Nouvelle affaire' })}
              </div>
              <label class="field">${lbl('Retenue à la source opérée', 'buy.withholding')}<select name="withholdingRate"><option value="0" ${!Number(p.withholdingRate) ? 'selected' : ''}>Aucune</option>${C.WITHHOLDING_RATES.filter(r => r).map(r => `<option value="${r}" ${Number(p.withholdingRate) === r ? 'selected' : ''}>${pct(r)} %</option>`).join('')}</select></label>
              ${field(lbl('Timbre et frais', 'buy.fees'), 'fees', p.fees || 0, 'number', 'step="0.001" min="0" class="num"')}
            </form>
          </div>
          <div class="panel"><h2>Lignes ${info('buy.lines')}</h2>
            <div class="catalog-pick"><div id="b-cat">${combo({ items: [], placeholder: 'Ajouter depuis le catalogue…', search: 'Rechercher une prestation…' })}</div>
              <button class="btn btn-sm" id="add-line">+ Ligne</button>
              <span class="small muted">Saisis au moins le total hors taxes et son taux de TVA : c'est ce qui permet de récupérer la TVA.</span></div>
            <table class="lines-edit buy-lines"><thead><tr><th>Désignation</th><th style="width:62px">Qté</th><th style="width:92px">P.U. HT</th><th style="width:76px">TVA</th>
              <th style="width:150px">Destination ${info('buy.destination')}</th><th style="width:74px">Déduct. ${info('buy.deductible')}</th><th class="r">Total HT</th><th></th></tr></thead>
              <tbody id="b-lines"></tbody></table>
            <div class="totals-box" id="b-totals"></div>
            <div id="b-stock-hint" hidden></div>
          </div>
          ${isNew ? '' : `<div class="panel"><h2>Règlements ${info('buy.payments')}</h2><div id="b-pay"></div></div>`}
          <!-- Le panneau existe MÊME sur une pièce neuve (7.1.2). Il n'apparaissait qu'après
               l'enregistrement : quelqu'un qui saisissait sa première facture avec la photo du
               justificatif ouverte à côté ne trouvait aucun endroit où l'accrocher, et en concluait
               que l'application ne sait pas faire. Une pièce jointe a besoin d'un identifiant, donc
               d'un enregistrement : le panneau le dit, et propose de l'enregistrer tout de suite. -->
          <div class="panel"><h2>Pièces jointes ${info('ed.attachments')}</h2>
            ${isNew
              ? `<p class="small muted">Bon de commande du client, photo d'un justificatif, plan, contrat signé :
                 tout ce qui doit rester avec cette pièce. Les pièces jointes s'attachent à un document enregistré —
                 <b>enregistre d'abord</b>, le panneau s'ouvre ensuite.</p>
                 <button type="button" class="btn btn-sm mt" id="att-save-first">Enregistrer maintenant pour joindre un fichier</button>`
              : '<div id="attachments"></div>'}
          </div>
          <div class="panel"><h2>Notes internes</h2>
            <textarea id="b-notes" placeholder="Ce qu'il faut se rappeler sur cet achat">${h(p.notes || '')}</textarea>
          </div>
        </div>
      </div>`;

    // --- garde-fou
    let dirty = false;
    const touch = () => { if (dirty) return; dirty = true; const el = $('#dirty-dot'); if (el) el.hidden = false; reportDirty(); };
    const untouch = () => { dirty = false; const el = $('#dirty-dot'); if (el) el.hidden = true; reportDirty(); };
    setGuard({ dirty: () => dirty, what: isDep ? 'cette dépense' : 'cette facture d\'achat', save: async () => { if (!validate() || !await doublonOk()) return false; const ok = persist(); if (ok) untouch(); return ok; } });

    // --- lignes
    const body = $('#b-lines');
    function drawLines() {
      const n = p.lines.length;
      body.innerHTML = p.lines.map((l, i) => `<tr data-i="${i}">
        <td><input type="text" data-k="label" value="${h(l.label || '')}" placeholder="Désignation"></td>
        <td><input type="number" class="num" data-k="qty" value="${l.qty}" step="0.01"></td>
        <td><input type="number" class="num" data-k="unitPrice" value="${l.unitPrice}" step="0.001"></td>
        <td><select data-k="vatRate">${C.VAT_RATES.map(r => `<option value="${r}" ${Number(l.vatRate) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select></td>
        <td><select data-k="destination">${C.LINE_DESTINATIONS.map(([v, lab, d]) => `<option value="${v}" ${(l.destination || 'charge') === v ? 'selected' : ''} title="${h(d)}">${lab}</option>`).join('')}</select></td>
        <td class="c"><input type="checkbox" data-k="deductible" ${l.deductible !== false ? 'checked' : ''}></td>
        <td class="total" data-total="${i}"></td>
        <td class="line-tools">
          <button class="btn btn-ghost btn-sm" data-dup="${i}" title="Dupliquer la ligne">⧉</button>
          <button class="btn btn-ghost btn-sm" data-rm="${i}" title="Supprimer la ligne">✕</button></td></tr>`).join('');
      $$('[data-k]', body).forEach(el => {
        const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'onchange' : 'oninput';
        el[ev] = () => {
          const i = Number(el.closest('tr').dataset.i);
          p.lines[i][el.dataset.k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
          touch(); refresh();
        };
      });
      $$('[data-dup]', body).forEach(b => b.onclick = () => { const i = Number(b.dataset.dup); p.lines.splice(i + 1, 0, deepCopy(p.lines[i])); touch(); drawLines(); });
      // Le « ✕ » de la dernière ligne était éteint et muet ici, alors que le même bouton marche dans
      // l'éditeur de vente : on y remet simplement une ligne vide. Un bouton qui ne répond pas fait
      // recommencer, puis douter — et on finit par tout retaper.
      $$('[data-rm]', body).forEach(b => b.onclick = () => {
        p.lines.splice(Number(b.dataset.rm), 1);
        if (!p.lines.length) p.lines.push({ label: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19, destination: 'charge', deductible: true });
        touch(); drawLines();
      });
      refresh();
    }
    $('#add-line').onclick = () => { p.lines.push({ label: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19, destination: 'charge', deductible: true }); touch(); drawLines(); $$('input[data-k=label]', body).pop().focus(); };
    // L'éditeur d'achat reprochait ensuite un libellé qui ne correspond à aucun article du catalogue
    // (« cette ligne n'entrera dans aucun stock ») sans jamais avoir offert de le choisir dans la
    // liste. On pose le même sélecteur que dans l'éditeur de document et les modèles.
    // Le PRIX repris est le coût d'achat (`unitCost`) quand il existe : ici on achète, on ne vend pas.
    if ($('#b-cat')) bindCombo($('.combo', $('#b-cat')), {
      reset: true, placeholder: 'Ajouter depuis le catalogue…',
      items: data.catalog.slice().sort((a2, b2) => (a2.label || '').localeCompare(b2.label || '', 'fr'))
        .map(c => ({ v: c.id, label: c.label, sub: c.tracked ? 'suivi en stock' : (c.description || ''),
          right: C.money(Number(c.unitCost) || Number(c.unitPrice) || 0, cur) + ' HT',
          text: `${c.label} ${c.description || ''}` })),
      onPick: id => {
        const it = data.catalog.find(c => c.id === id); if (!it) return;
        p.lines.push({ label: it.label, qty: 1, unit: it.unit || '',
          unitPrice: Number(it.unitCost) || Number(it.unitPrice) || 0, vatRate: Number(it.vatRate) || 0,
          itemId: it.id, destination: it.tracked ? 'stock' : 'charge', deductible: true });
        touch(); drawLines();
      }
    });

    function refresh() {
      const t = C.purchaseTotals(p, company());
      t.lines.forEach((l, i) => { const c = $(`[data-total="${i}"]`); if (c) c.textContent = C.money(l.ht, null, C.decimalsFor(cur)); });
      const dest = C.LINE_DESTINATIONS.filter(([k]) => t.byDestination[k] > 0.0005);
      $('#b-totals').innerHTML = `<table>
        <tr><td>Total HT</td><td>${C.money(t.totalHT, cur)}</td></tr>
        <tr><td>TVA</td><td>${C.money(t.totalVAT, cur)}</td></tr>
        ${t.deductibleVAT !== t.totalVAT ? `<tr><td>dont TVA déductible</td><td>${C.money(t.deductibleVAT, cur)}</td></tr>` : ''}
        ${t.fees ? `<tr><td>Timbre et frais</td><td>${C.money(t.fees, cur)}</td></tr>` : ''}
        ${t.withholding ? `<tr><td>Total TTC</td><td>${C.money(t.totalTTC, cur)}</td></tr><tr><td>Retenue opérée ${pct(t.withholdingRate)}%</td><td>- ${C.money(t.withholding, cur)}</td></tr>` : ''}
        <tr class="grand"><td>Net à payer</td><td>${C.money(t.netToPay, cur)}</td></tr>
        ${dest.length ? `<tr><td colspan="2" class="small muted" style="padding-top:8px">${dest.map(([k, lab]) => `${lab} ${C.money(t.byDestination[k], cur)}`).join(' · ')}</td></tr>` : ''}
      </table>`;
      // Une ligne « stock » dont le libellé ne retrouve aucun article suivi n'entrera dans aucun stock :
      // sans ce rappel, l'entrée disparaît en silence et le stock finit par passer en négatif.
      const orphelines = t.lines.filter(l => l.destination === 'stock' && (Number(l.qty) || 0) > 0)
        .filter(l => { const it = C.itemOfLine(l, data); return !it || !it.tracked; });
      // Choisir « Immobilisation » ne disait rien — or la ligne n'est déduite NULLE PART tant que la
      // fiche du bien n'existe pas : ni en charge (ce n'en est pas une), ni en amortissement (il n'y
      // a pas encore de durée). Elle dormait dans un compteur de barre latérale que personne ne
      // regarde au moment où on saisit l'achat.
      const immos = t.lines.filter(l => l.destination === 'immobilisation' && C.round3((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)) > 0);
      const box = $('#b-stock-hint');
      if (box) {
        const morceaux = [];
        if (orphelines.length) morceaux.push(`<span class="small warn-text">${pl(orphelines.length, 'ligne')} en destination « stock » ${orphelines.length > 1 ? 'ne correspondent' : 'ne correspond'} à aucun article suivi du catalogue : ${orphelines.map(l => h(l.label || 'sans désignation')).join(', ')}. ${orphelines.length > 1 ? 'Elles n\'entreront' : 'Elle n\'entrera'} dans aucun stock. ${info('stk.orphan')}</span>`);
        if (immos.length) morceaux.push(`<div class="small warn-text mt">${pl(immos.length, 'ligne')} en immobilisation : l'amortissement ne commencera qu'une fois la fiche du bien créée (famille, durée, date de mise en service). En attendant, ${immos.length > 1 ? 'ces montants ne sont déduits' : 'ce montant n\'est déduit'} nulle part. ${info('immo.attente')}
          <button class="btn btn-sm mt" id="b-immo" type="button">Voir les biens à créer</button></div>`);
        box.hidden = !morceaux.length;
        box.innerHTML = morceaux.join('');
        if ($('#b-immo')) $('#b-immo').onclick = () => { immoState.tab = 'attente'; navigate('#/immos'); };
      }
    }

    // --- en-tête
    const head = $('#b-head');
    // Le dernier fournisseur dont on a appliqué les réglages. On ne peut PAS comparer avec `p.supplierId` :
    // en fermant la liste déroulante, son champ de recherche perd le focus et émet son propre `change`
    // (sans nom), qui recopie déjà le nouvel identifiant dans `p`. L'événement utile arrivait donc toujours
    // « inchangé », et ni le délai de paiement ni la retenue du fournisseur n'étaient repris.
    let appliedSupplier = p.supplierId;
    head.oninput = head.onchange = (e) => {
      Object.assign(p, formValues(head));
      p.fees = Number(p.fees) || 0;
      p.withholdingRate = Number(p.withholdingRate) || 0;
      touch();
      if (e && e.target && e.target.name === 'supplierId' && p.supplierId !== appliedSupplier) {
        appliedSupplier = p.supplierId;
        // nouveau fournisseur : on reprend son délai de paiement et son taux de retenue
        const sup = supplierById(p.supplierId);
        if (sup) {
          if (sup.paymentTermsDays !== '' && sup.paymentTermsDays != null && p.date) {
            p.dueDate = C.addDays(p.date, Number(sup.paymentTermsDays) || 0);
            poserDateField(head, 'dueDate', p.dueDate);
          }
          if (Number(sup.withholdingRate)) { p.withholdingRate = Number(sup.withholdingRate); $('select[name=withholdingRate]', head).value = String(p.withholdingRate); }
        }
      }
      refresh();
    };
    const supCombo = bindCombo($('[data-combo=supplierId]', head), {
      items: supplierItems(), placeholder: '— Choisir un fournisseur —',
      onAdd: () => supplierForm(null, sup => { supCombo.setItems(supplierItems()); supCombo.setValue(sup.id); })
    });
    const buyProjectCombo = bindCombo($('[data-combo=projectId]', head), {
      items: projectItems(''), placeholder: '— Aucune affaire —',
      onAdd: () => projectForm(null, pr => {
        buyProjectCombo.setItems(projectItems('')); buyProjectCombo.setValue(pr.id); p.projectId = pr.id; touch();
      }, { startDate: p.date || C.today() })
    });
    bindCombo($('[data-combo=category]', head), {
      items: cats.map(c => ({ v: c, label: c })), placeholder: '— Choisir une catégorie —',
      onAdd: () => promptDialog('Nouvelle catégorie de charge', 'Nom de la catégorie', '', name => {
        const v = (name || '').trim(); if (!v) return;
        if (!C.expenseCategories(data).includes(v)) { data.expenseCategories.push(v); save(true); }
        const el = $('[data-combo=category]', head);
        bindCombo(el, { items: C.expenseCategories(data).map(c => ({ v: c, label: c })), placeholder: '— Choisir une catégorie —' }).setValue(v);
        p.category = v; touch();
      })
    });
    $('#b-notes').oninput = e => { p.notes = e.target.value; touch(); };
    // Crochet de démonstration : ouvrir la fenêtre de vérification sur une lecture simulée, sans aucun
    // appel réseau. Sert aux captures d'écran et à l'audit ; inoffensif, il ne fait qu'afficher.
    document.addEventListener('skanfact:ocr-demo', () => {
      if (!window.__ocrDemo) return;
      ocrReviewForm(window.__ocrDemo, { name: 'facture-fournisseur.jpg', size: 420000, path: '' }, () => {});
    }, { once: true });

    // --- lecture d'une photo de facture (4.2.0)
    // Le chemin sans clé est le chemin par défaut : on joint la photo et on saisit à la main. La lecture
    // n'est proposée que si l'utilisateur a lui-même activé la fonction dans les Paramètres.
    $('#photo').onclick = async () => {
      let file;
      try { file = await bridge.ocrPick(); } catch (e) { return toast(e.message || 'Fichier illisible', true); }
      if (!file) return;
      let st = { hasKey: false };
      try { st = await bridge.ocrStatus(); } catch (_) {}
      const attach = async () => {
        if (isNew) { if (!persist()) return false; }
        try { const a = await bridge.attachPath(p.id, file.path); p.attachments = (p.attachments || []).concat([a]); save(true); return true; }
        catch (e) { toast(e.message || 'Impossible de joindre la photo', true); return false; }
      };
      if (!st.hasKey) {
        // « va dans Paramètres → Mises à jour → Lecture de factures » demandait de retenir trois
        // niveaux et de les retrouver seul. Le second bouton y mène, sur le bon panneau.
        const go = await choiceDialog('La lecture automatique n\'est pas activée',
          `Rien ne peut être envoyé nulle part.\n\n« ${file.name} » peut quand même être jointe à cet achat comme justificatif, et tu saisis la facture à la main — c'est le fonctionnement normal, hors ligne.`,
          'Joindre la photo', 'Activer la lecture…');
        if (!go) return;
        if (go === 'b') return allerParametres('maj', 'p-ocr');
        if (await attach()) { toast('Photo jointe'); render(true); }
        return;
      }
      if (!await confirmDialog(`Envoyer « ${file.name} » (${(file.size / 1024).toFixed(0)} Ko) au service de lecture ?\n\nL'image part sur internet. Rien d'autre n'est envoyé. Le résultat te sera proposé : tu le valides ou tu le corriges avant qu'il n'entre dans tes données.`, 'Lire la facture', false)) return;
      toast('Lecture en cours…');
      let read;
      try { read = await bridge.ocrRead(file.path); }
      catch (e) {
        const retry = await confirmDialog(`La lecture a échoué.\n\n${e.message || 'Erreur inconnue.'}\n\nTu peux joindre la photo et saisir la facture à la main.`, 'Joindre la photo', false);
        if (retry && await attach()) { toast('Photo jointe'); render(true); }
        return;
      }
      ocrReviewForm(read, file, async (values) => {
        Object.assign(p, values.head);
        p.lines = values.lines;
        touch();
        if (await attach()) toast('Facture pré-remplie et photo jointe — vérifie avant d\'enregistrer');
        render(true);
      });
    };


    // --- règlements
    function drawPayments() {
      const el = $('#b-pay'); if (!el) return;
      const s2 = purchaseById(p.id); if (!s2) return;
      const b = C.purchaseBalance(s2, company());
      const rows = (s2.payments || []).slice().sort((a, x) => (a.date || '').localeCompare(x.date || ''));
      const t = b.totals;
      el.innerHTML = `
        <div class="pay-grid">
          <div><div class="k-label">Net à payer</div><div class="v">${C.money(t.netToPay, cur)}</div>${t.withholding ? `<div class="small muted">TTC ${C.money(t.totalTTC, cur)} − retenue ${C.money(t.withholding, cur)}</div>` : ''}</div>
          <div><div class="k-label">Réglé</div><div class="v">${C.money(b.paid, cur)}</div></div>
          <div><div class="k-label">Reste dû</div><div class="v ${b.remaining > 0.0005 ? 'due' : 'ok'}">${C.money(Math.max(0, b.remaining), cur)}</div></div>
          <div><div class="k-label">Statut</div><div class="v">${buyBadge(buyStatus(s2))}</div></div>
        </div>
        ${rows.length ? `<table class="list compact"><thead><tr><th>Date</th><th>Mode</th><th>Référence</th><th class="r">Montant</th><th></th></tr></thead><tbody>
          ${rows.map(x => `<tr><td>${C.fmtDate(x.date)}</td><td>${h(methodLabel(x.method))}</td><td>${h(x.reference || '')}${x.note ? `<div class="small muted">${h(x.note)}</div>` : ''}</td><td class="r">${C.money(x.amount, cur)}</td><td class="actions"><button class="btn btn-ghost btn-sm" data-rmpay="${x.id}" title="Supprimer">✕</button></td></tr>`).join('')}
        </tbody></table>` : '<p class="small muted">Aucun règlement enregistré.</p>'}
        <div class="inline mt">
          ${b.remaining > 0.0005 ? '<button class="btn btn-primary" id="pay2">+ Enregistrer un règlement</button>' : ''}
          ${t.withholding ? `<label class="check"><input type="checkbox" id="rs-cert2" ${s2.withholdingCertificate ? 'checked' : ''}> Attestation de retenue remise au fournisseur (${C.money(t.withholding, cur)}) ${info('buy.certificate')}</label>` : ''}
        </div>`;
      $$('[data-rmpay]', el).forEach(btn => btn.onclick = async () => {
        if (!await confirmDialog('Supprimer ce règlement ?')) return;
        const gone2 = (s2.payments || []).find(x => x.id === btn.dataset.rmpay);
        if (gone2 && closedToast(gone2.date, 'Ce règlement ne peut pas être supprimé')) return;
        s2.payments = s2.payments.filter(x => x.id !== btn.dataset.rmpay); save(true); render();
      });
      if ($('#pay2')) $('#pay2').onclick = () => supplierPaymentForm(s2, () => render());
      if ($('#rs-cert2')) $('#rs-cert2').onchange = e => { s2.withholdingCertificate = e.target.checked; save(true); };
    }

    // --- pièces jointes (même mécanisme que sur un document de vente)
    function drawBuyAttachments() {
      const el = $('#attachments'); if (!el) return;
      const s2 = purchaseById(p.id); if (!s2) return;
      const list = s2.attachments || [];
      el.innerHTML = `
        ${list.length ? `<table class="list compact"><thead><tr><th>Fichier</th><th>Ajouté le</th><th class="r">Taille</th><th></th></tr></thead><tbody>
          ${list.map(a => `<tr><td><a href="#" data-open="${h(a.file)}">${h(a.name)}</a></td><td class="nw">${C.fmtDate(a.date)}</td><td class="r nw">${fileSize(a.size)}</td>
            <td class="actions"><button class="btn btn-ghost btn-sm" data-reveal="${h(a.file)}">Dossier</button><button class="btn btn-ghost btn-sm" data-rmatt="${h(a.file)}">✕</button></td></tr>`).join('')}
        </tbody></table>` : '<p class="small muted">Aucun justificatif. Photographie ou scanne la facture du fournisseur : sans justificatif, ni la charge ni la TVA ne sont récupérables.</p>'}
        <div class="inline mt"><button class="btn btn-sm" id="add-att">+ Joindre le justificatif…</button></div>`;
      $('#add-att').onclick = async () => {
        try {
          const added = await bridge.addAttachments(p.id);
          if (!added.length) return;
          s2.attachments = (s2.attachments || []).concat(added);
          save(true); drawBuyAttachments(); toast('Justificatif joint');
        } catch (e) { toast(e.message.replace(/^.*Error: /, ''), true); }
      };
      $$('[data-open]', el).forEach(a => a.onclick = e => { e.preventDefault(); bridge.openAttachment(p.id, a.dataset.open); });
      $$('[data-reveal]', el).forEach(b => b.onclick = () => bridge.revealAttachment(p.id, b.dataset.reveal));
      $$('[data-rmatt]', el).forEach(b => b.onclick = async () => {
        if (!await confirmDialog('Retirer ce justificatif ? Le fichier copié sera supprimé, ton original ne bouge pas.')) return;
        await bridge.removeAttachment(p.id, b.dataset.rmatt);
        s2.attachments = (s2.attachments || []).filter(x => x.file !== b.dataset.rmatt);
        save(true); drawBuyAttachments();
      });
    }

    function validate() {
      if (!p.supplierId) return refus('[data-combo=supplierId] .combo-btn', 'Choisis un fournisseur.');
      if (!p.date) return refus('[name=date]', 'La date de la pièce est obligatoire.');
      if (!p.lines.some(l => (l.label || '').trim() || Number(l.unitPrice))) return refus('#b-lines input[data-k=label]', 'Saisis au moins une ligne avec un montant.');
      if (p.dueDate && p.dueDate < p.date) return refus('[name=dueDate]', 'L\'échéance ne peut pas précéder la date de la pièce.');
      return true;
    }
    // Saisir deux fois la même facture fournisseur ne déclenchait RIEN : elle entrait deux fois dans
    // la TVA déductible, dans la charge, dans les écritures — sous le même numéro — et dans le paquet
    // du comptable. On ne refuse pas (un fournisseur peut recycler ses numéros d'une année sur
    // l'autre) : on nomme la pièce déjà saisie, avec sa date et son montant, et on laisse décider.
    async function doublonOk() {
      const jumeau = C.achatDoublon(data, p);
      if (!jumeau) return true;
      const t = C.purchaseTotals(jumeau, company());
      return await confirmDialog(
        `La facture n° ${p.number} de ${supplierName(p.supplierId)} est déjà saisie.\n\n`
        + `Celle du ${C.fmtDate(jumeau.date)}, ${C.money(t.totalTTC, company().currency)} TTC. `
        + 'La saisir une seconde fois compterait deux fois sa TVA déductible et sa charge.\n\n'
        + 'Enregistrer quand même ?', 'Enregistrer quand même', true);
    }

    function persist() {
      if (!validate()) return false;
      const wasDate = (data.purchases.find(x => x.id === p.id) || {}).date;
      if (closedBlock([wasDate, p.date], 'Cet achat')) return false;
      if (!data.purchases.some(x => x.id === p.id) && licenceBlock('Enregistrer un nouvel achat')) return false;
      const idx = data.purchases.findIndex(x => x.id === p.id);
      const clean = deepCopy(p);
      if (idx >= 0) data.purchases[idx] = clean; else data.purchases.push(clean);
      save(true); untouch();
      return true;
    }
    bindBack('#/achats');
    $('#save').onclick = async () => {
      if (!validate()) return;            // les contrôles de saisie AVANT la grande question (7.6.0)
      if (!await doublonOk()) return;
      if (!persist()) return;
      toast('Enregistré');
      if (isNew) navigate('#/achat/' + p.id); else render(true);
    };
    if ($('#pay')) $('#pay').onclick = () => supplierPaymentForm(purchaseById(p.id), () => render());
    if ($('#more-btn')) $('#more-btn').onclick = e => { e.stopPropagation(); const l = $('#more-list'); const open = l.hidden; closeMenus(); l.hidden = !open; };
    $$('#more-list button').forEach(b => b.addEventListener('click', () => { $('#more-list').hidden = true; }));
    if ($('#dup')) $('#dup').onclick = () => { untouch(); duplicatePurchase(purchaseById(p.id)); };
    if ($('#del')) $('#del').onclick = async () => {
      if (!await confirmDialog(`Supprimer ${p.number || 'cette pièce'} ? Les règlements enregistrés seront perdus.`)) return;
      if (closedBlock(p.date, 'Cet achat')) return;
      forget('purchases', p.id, p.number || '');
      data.purchases = data.purchases.filter(x => x.id !== p.id); save(true); untouch(); navigate('#/achats');
    };

    drawLines();
    drawPayments();
    drawBuyAttachments();
    if ($('#att-save-first')) $('#att-save-first').onclick = () => {
      if (!persist()) return;
      toast('Enregistré — tu peux joindre ton justificatif');
      navigate('#/achat/' + p.id);
    };
  };

  // ---------- Autres documents : proforma, bon de commande, bon de livraison, contrat ----------
  // Quatre pièces sans valeur comptable, réunies sur une page à onglets plutôt que quatre entrées
  // de barre latérale : elles servent moins souvent qu'un devis ou une facture.
  const AUTRES_TABS = [
    ['proforma', 'Proformas', 'Une proforma annonce un prix ferme sans être une facture. Les administrations et les banques la demandent pour un dossier.'],
    ['commande', 'Bons de commande', 'Le bon de commande enregistre ce que le client a commandé, avant que tu livres ou que tu factures.'],
    ['livraison', 'Bons de livraison', 'Le bon de livraison accompagne la marchandise et se fait signer à la réception. Il prouve que tu as livré.'],
    ['contrat', 'Contrats à signer', 'Le contrat de prestation est la pièce que ton client signe : objet, durée, reconduction, préavis. À ne pas confondre avec les contrats récurrents, qui fabriquent des factures.']
  ];
  const autresState = {};
  AUTRES_TABS.forEach(([t]) => { autresState[t] = { q: '', st: '', year: '', sort: null, page: 1 }; });
  let autresTab = 'proforma';

  routes.autres = (parts) => {
    if (parts[0] && autresState[parts[0]]) autresTab = parts[0];
    const type = autresTab;
    const s = autresState[type];
    const tab = AUTRES_TABS.find(x => x[0] === type);
    const { cols } = docColumns({ quotes: true, extra: type });
    const mine = data.documents.filter(d => d.type === type);
    const years = Array.from(new Set(mine.map(d => (d.date || '').slice(0, 4)).filter(Boolean))).sort().reverse();

    $('#view').innerHTML = `
      <div class="page-head"><h1>Proforma, bons et contrats</h1>
        <div class="actions"><button class="btn btn-primary" id="new">+ ${h(NEW_LABELS[type])}</button></div></div>
      <div class="tabs" id="a-tabs" role="tablist">${AUTRES_TABS.map(([t, label]) =>
        `<button role="tab" data-tab="${t}" class="${t === type ? 'active' : ''}">${h(label)}${data.documents.some(d => d.type === t) ? ` <span class="tab-n">${data.documents.filter(d => d.type === t).length}</span>` : ''}</button>`).join('')}</div>
      <p class="small muted mb">${h(tab[2])} ${info('autres.' + type)}</p>
      <div class="filters">
        <input type="text" id="q" placeholder="Rechercher : n°, client, objet…" value="${h(s.q)}">
        <select id="st"><option value="">Tous les statuts</option>${C.STATUSES[type].map(x => `<option value="${x}" ${s.st === x ? 'selected' : ''}>${h(C.statusLabel(x))}</option>`).join('')}</select>
        ${years.length > 1 ? `<select id="yr"><option value="">Toutes les années</option>${years.map(y => `<option value="${y}" ${s.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}
        ${info('list.filters')}
        <span class="f-note" id="f-note" hidden></span>
      </div>
      <div id="list-wrap"></div>`;

    const draw = (sortKey) => {
      if (sortKey) { s.sort = toggleSort(s.sort, sortKey, cols); s.page = 1; }
      const list = mine
        .filter(d => !s.year || (d.date || '').startsWith(s.year))
        .filter(d => !s.st || d.status === s.st)
        .filter(d => !s.q || [d.number, clientName(d.clientId), d.subject, d.reference].join(' ').toLowerCase().includes(s.q))
        .sort(byNumberDesc);
      const filtered = !!(s.q || s.st || s.year);
      $('#list-wrap').innerHTML = docTable(list, {
        quotes: true, extra: type, sort: s.sort, onSort: true, page: s, grandTotal: mine.length,
        empty: filtered ? 'Aucun document ne correspond à ces filtres.' : EMPTY_LABELS[type]
      });
      const note = $('#f-note');
      note.hidden = !filtered;
      note.innerHTML = !filtered ? '' : `<span class="small muted">${list.length} sur ${mine.length}</span>${filterReset(true)}`;
      if ($('#reset-f')) $('#reset-f').onclick = () => { s.q = ''; s.st = ''; s.year = ''; s.page = 1; routes.autres([type]); };
      bindDocTable(draw, s, '#list-wrap');
    };
    $$('#a-tabs button').forEach(b => b.onclick = () => { autresTab = b.dataset.tab; navigate('#/autres/' + b.dataset.tab); });
    $('#new').onclick = () => navigate('#/doc/new/' + type);
    $('#q').oninput = e => { s.q = e.target.value.toLowerCase(); s.page = 1; draw(); };
    $('#st').onchange = e => { s.st = e.target.value; s.page = 1; draw(); };
    if ($('#yr')) $('#yr').onchange = e => { s.year = e.target.value; s.page = 1; draw(); };
    draw();
  };
  const NEW_LABELS = { proforma: 'Nouvelle proforma', commande: 'Nouveau bon de commande', livraison: 'Nouveau bon de livraison', contrat: 'Nouveau contrat' };
  const EMPTY_LABELS = {
    proforma: 'Aucune proforma. Tu peux en tirer une d\'un devis existant, depuis le menu « Transformer » de ce devis.',
    commande: 'Aucun bon de commande. Enregistre ici ce que le client commande avant la livraison ou la facture.',
    livraison: 'Aucun bon de livraison. Il se tire d\'un devis, d\'une commande ou d\'une facture, en un clic.',
    contrat: 'Aucun contrat. Rédige ici la pièce que ton client signe : objet, durée, reconduction, préavis.'
  };

  // ---------- Affaires et marges ----------
  const projectById = id => data.projects.find(p => p.id === id);
  const projectName = id => (projectById(id) || {}).name || '';
  // Liste utilisée par tous les sélecteurs d'affaire : les affaires en cours d'abord.
  const projectItems = (clientId) => data.projects
    .filter(p => !clientId || !p.clientId || p.clientId === clientId)
    .sort((a, b) => (a.status === 'en cours' ? 0 : 1) - (b.status === 'en cours' ? 0 : 1) || (b.startDate || '').localeCompare(a.startDate || ''))
    .map(p => ({ v: p.id, label: p.name, sub: [clientName(p.clientId), p.status].filter(Boolean).join(' · '), text: `${p.name} ${clientName(p.clientId)}` }));

  function projectForm(proj, done, preset) {
    const p = proj || Object.assign({ id: C.uid(), name: '', clientId: '', status: 'en cours', startDate: C.today(), endDate: '', notes: '' }, preset || {});
    modal(`<h2>${proj ? 'Modifier l\'affaire' : 'Nouvelle affaire'}</h2>
      <p class="small muted">Une affaire relie des ventes et des achats. C'est le seul endroit où la marge est <b>exacte</b> : on ne devine plus le coût, on l'a payé.</p>
      <form id="pf3" class="grid-2">
        <label class="field span-2 obligatoire">Nom de l'affaire<input type="text" name="name" value="${h(p.name)}" placeholder="Salle serveur — École Les Lauriers"></label>
        <div class="field">Client
          ${combo({ name: 'clientId', value: p.clientId, items: data.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(c => ({ v: c.id, label: c.name, text: c.name })), placeholder: '— Aucun client précis —', search: 'Rechercher un client…' })}
        </div>
        <label class="field">Statut<select name="status">${C.PROJECT_STATUSES.map(x => `<option value="${x}" ${p.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        ${dateFieldHtml('Début', 'startDate', p.startDate, {})}
        ${dateFieldHtml('Fin (optionnel)', 'endDate', p.endDate || '', { clearable: true })}
        <label class="field span-2">Notes<textarea name="notes">${h(p.notes || '')}</textarea></label>
      </form>
      <div class="modal-actions">
        ${proj ? '<button class="btn btn-danger" id="del-proj" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        bindCombo($('[data-combo=clientId]', root), { items: data.clients.map(c => ({ v: c.id, label: c.name, text: c.name })), placeholder: '— Aucun client précis —' });
        $('#ok', root).onclick = () => {
          const v = formValues($('#pf3', root));
          if (!v.name.trim()) return toast('Donne un nom à cette affaire.', true);
          Object.assign(p, v);
          if (!proj) data.projects.push(p);
          save(true); close(); if (done) done(p);
        };
        if ($('#del-proj', root)) $('#del-proj', root).onclick = async () => {
          const n = data.documents.filter(d => d.projectId === p.id).length + data.purchases.filter(x => x.projectId === p.id).length;
          if (!await confirmDialog(`Supprimer « ${p.name} » ?${n ? ` ${n} pièce(s) y sont rattachées : elles ne seront pas supprimées, elles perdront simplement leur affaire.` : ''}`)) return;
          forget('projects', p.id, p.name);
          data.projects = data.projects.filter(x => x.id !== p.id);
          data.documents.forEach(d => { if (d.projectId === p.id) delete d.projectId; });
          data.purchases.forEach(x => { if (x.projectId === p.id) delete x.projectId; });
          save(true); close(); navigate('#/marges');
        };
      });
  }

  const margeState = { tab: 'affaires', year: C.today().slice(0, 4), dim: 'client', page: 1 };
  const MARGE_TABS = [['affaires', 'Affaires'], ['analyse', 'Où est la marge'], ['contrats', 'Contrats'], ['seuil', 'Seuil de rentabilité']];
  // Les onglets qui ne lisent pas l'année : le sélecteur y disparaît au lieu d'y être inerte.
  const MG_SANS_ANNEE = ['affaires', 'contrats'];

  routes.marges = () => {
    const cur = company().currency;
    const s = margeState;
    const years = Array.from(new Set(data.documents.map(d => (d.date || '').slice(0, 4)).filter(Boolean).concat([C.today().slice(0, 4)]))).sort().reverse();
    if (!years.includes(s.year)) s.year = years[0];
    const period = () => ({ from: `${s.year}-01-01`, to: `${s.year}-12-31` });

    $('#view').innerHTML = `
      <div class="page-head"><h1>Marges</h1>
        <div class="actions">
          <select id="mg-year" ${MG_SANS_ANNEE.includes(s.tab) ? 'hidden' : ''}>${years.map(y => `<option ${y === s.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <button class="btn btn-primary" id="new-proj">+ Nouvelle affaire</button>
        </div></div>
      <div class="tabs" id="mg-tabs" role="tablist">${MARGE_TABS.map(([id, label]) =>
        `<button role="tab" data-tab="${id}" class="${id === s.tab ? 'active' : ''}">${label}</button>`).join('')}</div>
      <div id="mg-body"></div>`;

    const rateCell = (r, complete) => r == null ? '<span class="muted">—</span>'
      : `<strong class="${r < 0 ? 'warn-text' : r >= 30 ? 'ok-text' : ''}">${pct(r)} %</strong>${complete === false ? ' <span class="muted" title="Toutes les lignes n\'ont pas de coût connu : la marge est surestimée">≈</span>' : ''}`;

    function drawProjects() {
      const list = C.projectList(data, company());
      $('#mg-body').innerHTML = list.length ? `
        <div class="panel"><h2>Affaires ${info('mg.projects')}</h2>
          <div class="scroll-x"><table class="list compact"><thead><tr><th>Affaire</th><th>Client</th><th>Statut</th><th class="r">Vendu HT</th><th class="r">Acheté HT</th><th class="r">Marge</th><th class="r">Taux</th><th class="r">En caisse</th></tr></thead><tbody>
            ${list.map(p => `<tr class="clickable ${p.margin < 0 ? 'row-warn' : ''}" data-pid="${h(p.id)}">
              <td><strong>${h(p.name)}</strong>${p.pending ? `<div class="small muted">+ ${C.money(p.pending, cur)} en devis</div>` : ''}</td>
              <td>${h(clientName(p.clientId)) || '<span class="muted">—</span>'}</td>
              <td><span class="badge ${p.status === 'en cours' ? 'b-due' : p.status === 'terminée' ? 'b-paid' : ''}">${h(p.status)}</span></td>
              <td class="r nw">${C.money(p.revenue, cur)}</td>
              <td class="r nw">${C.money(p.cost, cur)}</td>
              <td class="r nw ${p.margin < 0 ? 'warn-text' : ''}"><strong>${C.money(p.margin, cur)}</strong></td>
              <td class="r nw">${rateCell(p.rate)}</td>
              <td class="r nw ${p.cash < 0 ? 'warn-text' : ''}">${C.money(p.cash, cur)}</td></tr>`).join('')}
            <tr class="total-row"><td colspan="3"><strong>Total</strong></td>
              <td class="r"><strong>${C.money(C.round3(list.reduce((a, p) => a + p.revenue, 0)), cur)}</strong></td>
              <td class="r"><strong>${C.money(C.round3(list.reduce((a, p) => a + p.cost, 0)), cur)}</strong></td>
              <td class="r"><strong>${C.money(C.round3(list.reduce((a, p) => a + p.margin, 0)), cur)}</strong></td><td></td>
              <td class="r"><strong>${C.money(C.round3(list.reduce((a, p) => a + p.cash, 0)), cur)}</strong></td></tr>
          </tbody></table></div>
          <p class="small muted mt">« En caisse » : ce que l'affaire a réellement rapporté — encaissé moins payé. Une affaire peut être rentable et n'avoir encore rien rapporté.</p>
        </div>` : `<div class="empty">Aucune affaire. Crée-en une pour rattacher les ventes et les achats d'un même chantier : c'est le seul endroit où la marge est exacte, parce qu'elle compare des factures réelles à des achats réels.</div>`;
      $$('#mg-body tr[data-pid]').forEach(tr => tr.onclick = () => navigate('#/affaire/' + tr.dataset.pid));
    }

    function drawAnalysis() {
      const p = period();
      // `0` = toutes les lignes. Les trois cartes et le compteur « n ligne(s) sans coût connu »
      // portent sur la SÉLECTION ENTIÈRE, jamais sur la page affichée — la règle des listes depuis
      // la 2.2.0, qui n'avait jamais été appliquée ici : le tableau était tronqué à vingt lignes
      // et les cartes additionnaient ces vingt-là (7.16.0).
      const rows = C.marginBy(data, company(), p.from, p.to, s.dim, 0);
      const max = rows.length ? Math.max(1, ...rows.map(r => Math.abs(r.margin))) : 1;
      const totalRev = C.round3(rows.reduce((a, r) => a + r.revenue, 0));
      const totalMar = C.round3(rows.reduce((a, r) => a + r.margin, 0));
      const incomplete = rows.filter(r => !r.complete).length;
      const pg = paginate(rows, s);
      $('#mg-body').innerHTML = `
        <div class="filters">
          <select id="mg-dim"><option value="client" ${s.dim === 'client' ? 'selected' : ''}>Par client</option><option value="item" ${s.dim === 'item' ? 'selected' : ''}>Par prestation</option></select>
          ${info('mg.analysis')}
          ${incomplete ? `<span class="small warn-text">${incomplete} ligne(s) sans coût connu : leur marge est surestimée.</span>` : '<span class="small muted">Tous les coûts sont connus.</span>'}
        </div>
        <div class="stats">
          <div class="stat"><div class="lbl">Chiffre d'affaires ${info('stat.ca')}</div><div class="val">${C.money(totalRev, cur)}</div><div class="sub">année ${s.year}</div></div>
          <div class="stat"><div class="lbl">Marge totale ${info('mg.total')}</div><div class="val ${totalMar < 0 ? 'due' : 'ok'}">${C.money(totalMar, cur)}</div><div class="sub">${totalRev ? pct(Math.round(totalMar / totalRev * 1000) / 10) + ' % du chiffre d\'affaires' : ''}</div></div>
          <div class="stat"><div class="lbl">Coût des ventes</div><div class="val">${C.money(C.round3(totalRev - totalMar), cur)}</div><div class="sub">ce que tu as acheté pour vendre</div></div>
        </div>
        <div class="panel"><h2>${s.dim === 'client' ? 'Marge par client' : 'Marge par prestation'} — ${s.year}</h2>
          ${rows.length ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>${s.dim === 'client' ? 'Client' : 'Prestation'}</th><th class="r">Vendu HT</th><th class="r">Coût</th><th class="r">Marge</th><th class="r">Taux</th><th style="width:24%"></th></tr></thead><tbody>
            ${pg.rows.map(r => `<tr class="${r.margin < 0 ? 'row-warn' : ''}">
              <td>${h(r.label)}</td><td class="r nw">${C.money(r.revenue, cur)}</td><td class="r nw">${C.money(r.cost, cur)}</td>
              <td class="r nw ${r.margin < 0 ? 'warn-text' : ''}"><strong>${C.money(r.margin, cur)}</strong></td>
              <td class="r nw">${rateCell(r.rate, r.complete)}</td>
              <td><span class="bar"><i class="${r.margin < 0 ? 'f-bad' : 'f-ok'}" style="width:${Math.max(3, Math.round(Math.abs(r.margin) / max * 100))}%"></i></span></td></tr>`).join('')}
          </tbody></table></div>${pagerBar(pg, { noun: s.dim === 'client' ? 'client' : 'prestation', grandTotal: rows.length })}
          <p class="small muted mt">Le repère « ≈ » signale les lignes dont toutes les prestations n'ont pas de coût de revient : leur marge est optimiste. Renseigne le coût dans le catalogue pour la rendre juste.</p>`
            : '<div class="empty">Aucune vente sur cette année.</div>'}
        </div>`;
      $('#mg-dim').onchange = e => { s.dim = e.target.value; s.page = 1; draw(); };
      bindPager($('#mg-body'), s, () => draw(), '#mg-body');
    }

    function drawContracts() {
      const rows = data.recurring.map(r => ({ r, p: C.recurringProfitability(data, company(), r.id) }))
        .filter(x => x.p.count > 0).sort((a, b) => b.p.margin - a.p.margin);
      $('#mg-body').innerHTML = `
        <div class="panel"><h2>Rentabilité des contrats récurrents ${info('mg.contracts')}</h2>
          ${rows.length ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Contrat</th><th>Client</th><th class="r">Factures</th><th class="r">Facturé HT</th><th class="r">Coût</th><th class="r">Marge</th><th class="r">Par mois</th><th class="r">Taux</th></tr></thead><tbody>
            ${rows.map(({ r, p }) => `<tr class="clickable" data-rid="${h(r.id)}">
              <td><strong>${h(C.fillTemplate(r.subject, { mois: '', annee: '' }).trim() || 'Contrat')}</strong><div class="small muted">depuis ${C.fmtDate(p.first)}</div></td>
              <td>${h(clientName(r.clientId))}</td><td class="r nw">${p.count}</td>
              <td class="r nw">${C.money(p.revenue, cur)}</td><td class="r nw">${C.money(p.cost, cur)}</td>
              <td class="r nw"><strong>${C.money(p.margin, cur)}</strong></td>
              <td class="r nw">${C.money(p.perMonth, cur)}</td><td class="r nw">${rateCell(p.rate)}</td></tr>`).join('')}
          </tbody></table></div>
          <p class="small muted mt">Un contrat de maintenance qui rapporte peu par mois mais qui tourne depuis deux ans vaut souvent mieux qu'une grosse affaire ponctuelle : il est prévisible, et il ne demande pas de vendre à nouveau.</p>`
            : '<div class="empty">Aucun contrat récurrent n\'a encore produit de facture.</div>'}
        </div>`;
      $$('#mg-body tr[data-rid]').forEach(tr => tr.onclick = () => navigate('#/contrat/' + tr.dataset.rid));
    }

    function drawBreakEven() {
      const b = C.breakEven(data, company(), period());
      const cats = C.expenseCategories(data);
      const pctOf = v => b.breakEven ? Math.min(100, Math.round(v / Math.max(b.breakEven, b.revenue) * 100)) : 0;
      $('#mg-body').innerHTML = `
        <div class="panel"><h2>Seuil de rentabilité — ${s.year} ${info('mg.breakeven')}</h2>
          ${b.breakEven == null ? '<div class="empty">Aucune vente sur cette année : le seuil ne peut pas se calculer.</div>' : `
          <div class="vat-box" style="max-width:680px">
            <div class="vat-line"><span>Chiffre d'affaires HT</span><span class="num">${C.money(b.revenue, cur)}</span></div>
            <div class="vat-line minus"><span>− Charges variables ${info('mg.variable')}</span><span class="num">${C.money(b.variable, cur)}</span></div>
            ${b.cogs ? `<div class="vat-line sub-line"><span class="muted">dont coût des marchandises vendues ${info('stk.cogs')}</span><span class="num muted">${C.money(b.cogs, cur)}</span></div>` : ''}
            <div class="vat-line"><span>= Marge sur coûts variables <span class="muted">(${pct(b.rate)} %)</span></span><span class="num">${C.money(b.marginOnVariable, cur)}</span></div>
            <div class="vat-line minus"><span>− Charges fixes ${info('mg.fixed')}</span><span class="num">${C.money(b.fixed, cur)}</span></div>
            ${b.payroll ? `<div class="vat-line sub-line"><span class="muted">dont coût de la paie ${info('pay.employerCost')}</span><span class="num muted">${C.money(b.payroll, cur)}</span></div>` : ''}
            ${b.depreciation ? `<div class="vat-line sub-line"><span class="muted">dont dotation aux amortissements ${info('immo.annuity')}</span><span class="num muted">${C.money(b.depreciation, cur)}</span></div>` : ''}
            <div class="vat-line total ${b.result < 0 ? 'due' : 'ok'}"><span>${b.result < 0 ? 'Perte' : 'Résultat'}</span><span class="num">${C.money(b.result, cur)}</span></div>
          </div>
          <h3 class="sub-h">Le chiffre d'affaires minimum</h3>
          <p>Pour couvrir tes charges fixes, il te faut <strong>${C.money(b.breakEven, cur)}</strong> de chiffre d'affaires sur l'année.
          ${b.reached ? `<span class="ok-text">Tu l'as dépassé de ${C.money(b.gap, cur)}.</span>` : `<span class="warn-text">Il t'en manque ${C.money(-b.gap, cur)}.</span>`}</p>
          <div class="gauge"><div class="g-bar"><i style="width:${pctOf(b.revenue)}%"></i><span class="g-mark" style="left:${pctOf(b.breakEven)}%" title="Seuil de rentabilité"></span></div>
            <div class="g-legend"><span><strong>${C.money(b.revenue, cur)}</strong> réalisés</span><span class="muted">seuil ${C.money(b.breakEven, cur)}</span></div></div>
          <p class="small muted mt">Autrement dit : il te faut <strong>${C.money(C.round3(b.breakEven / 12), cur)}</strong> par mois, soit <strong>${C.money(C.round3(b.breakEven / 220), cur)}</strong> par jour ouvré, rien que pour rentrer dans tes frais.</p>`}
        </div>
        <div class="panel"><h2>Fixe ou variable ? ${info('mg.classify')}</h2>
          <p class="small muted mb">Une charge <b>fixe</b> tombe que tu vendes ou non : loyer, assurance, abonnement, salaires. Une charge <b>variable</b> suit les ventes : marchandises, sous-traitance. Ce classement dépend de ton activité — <em>À VÉRIFIER avec ton comptable.</em></p>
          <div class="two-col">
            ${[['Fixes', true], ['Variables', false]].map(([title, fixed]) => `<div>
              <h3 class="sub-h">${title}</h3>
              <div style="display:grid;gap:4px">
                ${cats.filter(c => C.isFixedCategory(data, c) === fixed).map(c => `<label class="check"><input type="checkbox" data-fix="${h(c)}" ${fixed ? 'checked' : ''}> ${h(c)}</label>`).join('') || '<span class="small muted">Aucune</span>'}
              </div></div>`).join('')}
          </div>
        </div>`;
      $$('[data-fix]').forEach(cb => cb.onchange = () => {
        const cur2 = C.expenseCategories(data).filter(c => C.isFixedCategory(data, c));
        const next = cb.checked ? cur2.concat([cb.dataset.fix]) : cur2.filter(c => c !== cb.dataset.fix);
        // Une liste vide voudrait dire « reprendre les valeurs par défaut » : on y met un marqueur inoffensif.
        data.fixedCategories = next.length ? Array.from(new Set(next)) : ['—'];
        save(true); draw();
      });
    }

    const draw = () => {
      // Un sélecteur visible et sans effet est pire qu'absent : on change d'année, rien ne bouge, et
      // on croit que l'application est cassée. « Affaires » et « Contrats » portent sur toute la vie
      // de l'affaire ou du contrat, pas sur un exercice.
      $('#mg-year').hidden = MG_SANS_ANNEE.includes(s.tab);
      if (s.tab === 'analyse') return drawAnalysis();
      if (s.tab === 'contrats') return drawContracts();
      if (s.tab === 'seuil') return drawBreakEven();
      drawProjects();
    };
    $$('#mg-tabs button').forEach(b => b.onclick = () => {
      s.tab = b.dataset.tab;
      $$('#mg-tabs button').forEach(x => x.classList.toggle('active', x === b));
      draw();
    });
    $('#mg-year').onchange = e => { s.year = e.target.value; draw(); };
    $('#new-proj').onclick = () => projectForm(null, () => render());
    draw();
  };

  const affaireDocState = { sort: null, page: 1 };

  routes.affaire = (parts) => {
    const p = projectById(parts[0]);
    if (!p) return navigate('#/marges');
    const cur = company().currency;
    const m = C.projectMargin(data, company(), p.id);
    $('#view').innerHTML = `
      <div class="page-head"><div><h1>${h(p.name)}</h1>
        <div class="small muted">${[clientName(p.clientId), p.status, p.startDate ? 'depuis le ' + C.fmtDate(p.startDate) : ''].filter(Boolean).join(' · ')}</div></div>
        <div class="actions">${backButton('#/marges')}<button class="btn" id="edit-p">Modifier</button>
          <button class="btn" id="p-devis">+ Devis</button><button class="btn btn-primary" id="p-achat">+ Achat</button></div></div>
      <div class="stats">
        <div class="stat"><div class="lbl">Vendu HT ${info('mg.projectRevenue')}</div><div class="val">${C.money(m.revenue, cur)}</div><div class="sub">${m.salesCount} facture(s)${m.pending ? ` · ${C.money(m.pending, cur)} en devis` : ''}</div></div>
        <div class="stat"><div class="lbl">Acheté HT</div><div class="val">${C.money(m.cost, cur)}</div><div class="sub">${m.buysCount} achat(s) rattaché(s)</div></div>
        <div class="stat"><div class="lbl">Marge ${info('mg.projectMargin')}</div><div class="val ${m.margin < 0 ? 'due' : 'ok'}">${C.money(m.margin, cur)}</div><div class="sub">${m.rate == null ? '' : pct(m.rate) + ' % du prix de vente'}</div></div>
        <div class="stat"><div class="lbl">En caisse ${info('mg.projectCash')}</div><div class="val ${m.cash < 0 ? 'due' : ''}">${C.money(m.cash, cur)}</div><div class="sub">${C.money(m.collected, cur)} encaissés − ${C.money(m.paid, cur)} payés</div></div>
      </div>
      ${m.margin < 0 ? `<div class="panel" style="border-left:3px solid var(--danger)"><h2 style="color:var(--danger)">Cette affaire perd de l'argent</h2>
        <p class="small">Tu as acheté ${C.money(m.cost, cur)} et facturé ${C.money(m.revenue, cur)}. Vérifie qu'il ne reste pas quelque chose à facturer, ou qu'un achat n'a pas été rattaché par erreur.</p></div>` : ''}
      <div class="panel"><h2>Ventes rattachées</h2><div id="p-sales"></div></div>
      <div class="panel"><h2>Achats rattachés</h2><div id="p-buys"></div></div>
      ${p.notes ? `<div class="panel"><h2>Notes</h2><p class="small">${C.nl2br(p.notes)}</p></div>` : ''}`;
    bindBack('#/marges');
    $('#edit-p').onclick = () => projectForm(p, () => render());
    $('#p-devis').onclick = () => navigate('#/doc/new/devis' + (p.clientId ? '/client/' + p.clientId : ''));
    $('#p-achat').onclick = () => navigate('#/achat/new');
    const sales = m.sales.concat(m.quotes).sort(byNumberDesc);
    // Huit colonnes dans un panneau : sans `scroll-x`, la table déborde et recouvre le panneau suivant.
    $('#p-sales').innerHTML = sales.length ? `<div class="scroll-x">${docTable(sales, { quotes: false, sort: affaireDocState.sort, onSort: true, page: affaireDocState })}</div>`
      : '<div class="empty">Aucune vente rattachée. Ouvre un devis ou une facture et choisis cette affaire.</div>';
    bindDocTable(() => render(), affaireDocState, '#p-sales');
    const { cols } = purchaseColumns({ hideSupplier: false });
    $('#p-buys').innerHTML = m.buys.length ? `<div class="scroll-x"><table class="list compact"><thead>${sortHead(cols.map(c => ({ ...c, val: null })), null)}</thead><tbody>
        ${m.buys.map(b => `<tr class="clickable" data-bid="${h(b.id)}">${cols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(b)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`
      : '<div class="empty">Aucun achat rattaché. Ouvre un achat et choisis cette affaire : c\'est ce qui rend la marge exacte.</div>';
    $$('#p-buys tr[data-bid]').forEach(tr => tr.onclick = () => navigate('#/achat/' + tr.dataset.bid));
  };

  // ---------- Paie (5.0.0) ----------
  const employeeById = id => data.employees.find(e => e.id === id);
  const payslipById = id => data.payslips.find(p => p.id === id);
  const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function employeeForm(employee, done) {
    const e = employee || { id: C.uid(), name: '', cin: '', cnss: '', position: '', contract: 'cdi',
      hireDate: C.today(), endDate: '', grossSalary: 0, headOfFamily: false, children: 0,
      method: 'virement', iban: '', notes: '' };
    const cur = company().currency;
    modal(`<h2>${employee ? 'Modifier le salarié' : 'Nouveau salarié'}</h2>
      <form id="ef" class="grid-2">
        <label class="field span-2 obligatoire">Nom et prénom<input type="text" name="name" value="${h(e.name)}" placeholder="Ahmed Ben Ali"></label>
        ${field('CIN', 'cin', e.cin || '', 'text', '')}
        ${field(lbl('Matricule CNSS', 'pay.cnss'), 'cnss', e.cnss || '', 'text', '')}
        ${field('Poste', 'position', e.position || '', 'text', 'placeholder="Technicien"')}
        <label class="field">${lbl('Contrat', 'pay.contract')}<select name="contract">${C.CONTRACT_TYPES.map(([v, l]) => `<option value="${v}" ${e.contract === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${dateFieldHtml('Date d\'embauche', 'hireDate', e.hireDate || '', { clearable: true })}
        ${dateFieldHtml(lbl('Date de sortie', 'pay.endDate'), 'endDate', e.endDate || '', { clearable: true })}
        ${field(lbl('Salaire brut mensuel', 'pay.gross'), 'grossSalary', e.grossSalary || 0, 'number', 'step="0.001" min="0" class="num"')}
        <label class="field">Mode de paiement<select name="method">${C.PAYMENT_METHODS.map(([v, l]) => `<option value="${v}" ${e.method === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" name="headOfFamily" ${e.headOfFamily ? 'checked' : ''}> Chef de famille ${info('pay.family')}</label>
        ${field(lbl('Enfants à charge', 'pay.children'), 'children', e.children || 0, 'number', 'step="1" min="0" max="10" class="num"')}
        ${field('RIB / IBAN', 'iban', e.iban || '', 'text', '')}
        <label class="field span-2">Notes<input type="text" name="notes" value="${h(e.notes || '')}"></label>
        <div class="field span-2" id="ef-hint"></div>
      </form>
      <div class="modal-actions">
        ${employee ? '<button class="btn btn-danger" id="del-emp" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        const hint = () => {
          const v = formValues($('#ef', root));
          const c = C.computePayslip({ ...e, ...v, children: Number(v.children) || 0 }, {}, C.payrollSettings(data));
          $('#ef-hint', root).innerHTML = Number(v.grossSalary) > 0
            ? `<span class="small muted">Sur ce brut : net d'environ <b>${C.money(c.net, cur)}</b> pour le salarié, coût de <b>${C.money(c.employerCost, cur)}</b> pour l'entreprise. <em>À VÉRIFIER avec ton comptable.</em></span>`
            : '<span class="small muted">Saisis le brut mensuel pour voir le net et le coût employeur.</span>';
        };
        $('#ef', root).oninput = $('#ef', root).onchange = hint; hint();
        $('#ok', root).onclick = () => {
          const v = formValues($('#ef', root));
          if (!v.name.trim()) return refus('#ef input[name=name]', 'Le nom du salarié est obligatoire : il figure sur chaque bulletin.');
          if (!(Number(v.grossSalary) > 0)) return toast('Le salaire brut doit être supérieur à zéro.', true);
          if (v.endDate && v.hireDate && v.endDate < v.hireDate) return toast('La sortie ne peut pas précéder l\'embauche.', true);
          Object.assign(e, v, { grossSalary: Number(v.grossSalary) || 0, children: Number(v.children) || 0, headOfFamily: !!v.headOfFamily });
          if (!employee) data.employees.push(e);
          save(true); close(); if (done) done(e);
        };
        if ($('#del-emp', root)) $('#del-emp', root).onclick = async () => {
          const n = data.payslips.filter(p => p.employeeId === e.id).length;
          if (n) return toast(`${n} bulletin(s) existent pour ${e.name} : on ne supprime pas un salarié payé. Renseigne sa date de sortie.`, true);
          if (!await confirmDialog(`Supprimer ${e.name} ?`)) return;
          forget('employees', e.id, e.name);
          data.employees = data.employees.filter(x => x.id !== e.id);
          save(true); close(); navigate('#/paie');
        };
      });
  }

  // Établir ou modifier un bulletin. Le calcul est recalculé à chaque frappe et gardé dans le bulletin :
  // un barème changé l'an prochain ne doit pas réécrire un bulletin déjà remis.
  function payslipForm(slip, employee, year, month, done) {
    const emp = employee || employeeById(slip.employeeId);
    const s = C.payrollSettings(data);
    const cur = company().currency;
    const auto = slip ? null : C.payslipInputFor(data, emp, year, month);
    const p = slip || { id: C.uid(), employeeId: emp.id, year, month, ...auto, paidDate: '', accountId: '',
      method: emp.method || 'virement', reference: '', issuedAt: C.today() };
    let bonuses = deepCopy(p.bonuses || []);
    let deductions = deepCopy(p.deductions || []);

    modal(`<h2>Bulletin de ${h(emp.name)} — ${h(MONTHS_LONG[Number(p.month) - 1])} ${h(String(p.year))}</h2>
      <form id="bf" class="grid-2">
        ${field(lbl('Salaire brut du mois', 'pay.gross'), 'gross', p.gross != null ? p.gross : emp.grossSalary, 'number', 'step="0.001" min="0" class="num"')}
        ${field(lbl('Jours ouvrables', 'pay.workedDays'), 'workedDays', p.workedDays || 26, 'number', 'step="0.5" min="1" max="31" class="num"')}
        ${field(lbl('Jours d\'absence non payés', 'pay.absent'), 'absentDays', p.absentDays || 0, 'number', 'step="0.5" min="0" class="num"')}
        ${dateFieldHtml(lbl('Payé le', 'pay.paid'), 'paidDate', p.paidDate || '', { clearable: true })}
        <label class="field">Compte<select name="accountId"><option value="">— compte par défaut —</option>${data.accounts.map(a => `<option value="${a.id}" ${p.accountId === a.id ? 'selected' : ''}>${h(a.name)}</option>`).join('')}</select></label>
        <label class="field">Mode<select name="method">${C.PAYMENT_METHODS.map(([v, l]) => `<option value="${v}" ${p.method === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </form>
      <div class="split">
        <div class="panel"><h2>Primes et indemnités ${info('pay.bonus')}</h2><div id="bf-bon"></div>
          <button type="button" class="btn btn-sm mt" id="add-bon">+ Prime</button></div>
        <div class="panel"><h2>Retenues ${info('pay.deduction')}</h2><div id="bf-ded"></div>
          <button type="button" class="btn btn-sm mt" id="add-ded">+ Retenue</button></div>
      </div>
      <div class="panel"><h2>Ce que ça donne</h2><div id="bf-calc"></div></div>
      <div class="modal-actions">
        ${slip ? '<button class="btn btn-danger" id="del-slip" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        const input = () => {
          const v = formValues($('#bf', root));
          return { gross: Number(v.gross) || 0, workedDays: Number(v.workedDays) || 26,
            absentDays: Number(v.absentDays) || 0, bonuses, deductions };
        };
        const drawSmall = (sel, list, kind) => {
          $(sel, root).innerHTML = list.length ? `<table class="lines-edit"><tbody>
            ${list.map((x, i) => `<tr data-i="${i}">
              <td><input type="text" data-f="label" value="${h(x.label || '')}" placeholder="${kind === 'bon' ? 'Prime de rendement' : 'Avance sur salaire'}"></td>
              <td style="width:110px"><input type="number" class="num" data-f="amount" value="${x.amount || 0}" step="0.001"></td>
              ${kind === 'bon' ? `<td style="width:110px"><label class="check small"><input type="checkbox" data-f="taxable" ${x.taxable !== false ? 'checked' : ''}> imposable</label></td>` : ''}
              <td class="line-tools"><button type="button" class="btn btn-ghost btn-sm" data-x="${i}">✕</button></td></tr>`).join('')}
          </tbody></table>` : `<p class="small muted">${kind === 'bon' ? 'Aucune prime ce mois-ci.' : 'Aucune retenue ce mois-ci.'}</p>`;
          $$('[data-f]', $(sel, root)).forEach(el => el.oninput = el.onchange = () => {
            const i = Number(el.closest('tr').dataset.i);
            list[i][el.dataset.f] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value);
            calc();
          });
          $$('[data-x]', $(sel, root)).forEach(b => b.onclick = () => { list.splice(Number(b.dataset.x), 1); drawSmall(sel, list, kind); calc(); });
        };
        const calc = () => {
          const c = C.computePayslip(emp, input(), s);
          $('#bf-calc', root).innerHTML = `
            <div class="vat-box" style="max-width:640px">
              <div class="vat-line"><span>Salaire brut</span><span class="num">${C.money(c.gross, cur)}</span></div>
              ${c.absenceCut ? `<div class="vat-line sub-line"><span class="muted">dont absence retirée</span><span class="num muted">− ${C.money(c.absenceCut, cur)}</span></div>` : ''}
              <div class="vat-line minus"><span>− CNSS salarié (${pct(c.rates.cnssEmployee)} %)</span><span class="num">${C.money(c.cnssEmployee, cur)}</span></div>
              <div class="vat-line minus"><span>− Impôt sur le revenu ${info('pay.irpp')}</span><span class="num">${C.money(c.irpp, cur)}</span></div>
              ${c.css ? `<div class="vat-line minus"><span>− Contribution sociale de solidarité</span><span class="num">${C.money(c.css, cur)}</span></div>` : ''}
              ${c.otherDeductions ? `<div class="vat-line minus"><span>− Autres retenues</span><span class="num">${C.money(c.otherDeductions, cur)}</span></div>` : ''}
              <div class="vat-line total ok"><span>Net à payer</span><span class="num">${C.money(c.net, cur)}</span></div>
              <div class="vat-line"><span>Charges patronales ${info('pay.employerCost')}</span><span class="num">${C.money(C.round3(c.cnssEmployer + c.accident), cur)}</span></div>
              <div class="vat-line"><span><b>Coût pour l'entreprise</b></span><span class="num"><b>${C.money(c.employerCost, cur)}</b></span></div>
            </div>
            <p class="small muted mt">Barème appliqué : CNSS ${pct(c.rates.cnssEmployee)} % salarié / ${pct(c.rates.cnssEmployer)} % employeur, IRPP progressif sur ${C.money(c.annualTaxable, cur)} imposables à l'année. <em>À VÉRIFIER avec ton comptable</em> — ces taux se règlent dans l'onglet Barèmes.</p>`;
        };
        drawSmall('#bf-bon', bonuses, 'bon'); drawSmall('#bf-ded', deductions, 'ded'); calc();
        $('#add-bon', root).onclick = () => { bonuses.push({ label: '', amount: 0, taxable: true }); drawSmall('#bf-bon', bonuses, 'bon'); calc(); };
        $('#add-ded', root).onclick = () => { deductions.push({ label: '', amount: 0 }); drawSmall('#bf-ded', deductions, 'ded'); calc(); };
        $('#bf', root).oninput = $('#bf', root).onchange = calc;
        $('#ok', root).onclick = () => {
          const v = formValues($('#bf', root));
          const i = input();
          if (closedBlock(C.payslipDate(p), 'Ce bulletin')) return;
          if (!slip && licenceBlock('Établir un nouveau bulletin')) return;
          Object.assign(p, v, i, { gross: i.gross, computed: C.computePayslip(emp, i, s), issuedAt: p.issuedAt || C.today() });
          if (!slip) data.payslips.push(p);
          save(true); close(); if (done) done(p);
        };
        if ($('#del-slip', root)) $('#del-slip', root).onclick = async () => {
          if (!await confirmDialog('Supprimer ce bulletin ? S\'il a déjà été remis au salarié, mieux vaut le corriger que le faire disparaître.')) return;
          if (closedBlock(C.payslipDate(p), 'Ce bulletin')) return;
          forget('payslips', p.id, `${emp.name} ${p.month}/${p.year}`);
          data.payslips = data.payslips.filter(x => x.id !== p.id);
          save(true); close(); if (done) done(null);
        };
      });
  }

  async function exportPayslip(slip) {
    const emp = employeeById(slip.employeeId) || {};
    const html = C.payslipHtml(slip, data, company(), {});
    const safe = s2 => String(s2).replace(/[^\w\-àâäéèêëïîôöùûüç ]/gi, '').trim().replace(/\s+/g, '_');
    const name = `Bulletin_${safe(emp.name)}_${slip.year}-${String(slip.month).padStart(2, '0')}.pdf`;
    try {
      const f = await bridge.exportPdf(html, name);
      if (f) toast('PDF enregistré : ' + f.split(/[\\/]/).pop());
    } catch (e) { toast(e.message || 'Export impossible', true); }
  }

  // On ouvre sur le MOIS ÉCOULÉ, pas sur le mois en cours : c'est celui dont les bulletins sont à
  // établir, et c'est lui que le panneau « À faire » réclame.
  const lastMonth = C.addMonths(C.today().slice(0, 7) + '-01', -1, 1);
  // ---------- congés, absences, avances et documents (5.1.0) ----------
  function leaveForm(leave, employeeId, done) {
    const emps = data.employees.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (!emps.length) return toast('Crée d\'abord la fiche d\'un salarié.', true);
    const l = leave || { id: C.uid(), employeeId: employeeId || emps[0].id, kind: 'conges',
      from: C.today(), to: C.today(), paid: null, note: '' };
    modal(`<h2>${leave ? 'Modifier l\'absence' : 'Congé ou absence'}</h2>
      <form id="lf" class="grid-2">
        <div class="field span-2">Salarié
          ${combo({ name: 'employeeId', value: l.employeeId, items: emps.map(e => ({ v: e.id, label: e.name, sub: e.position || '', text: e.name })), placeholder: '— Choisir —', search: 'Rechercher un salarié…' })}
        </div>
        <label class="field">${lbl('Nature', 'hr.leaveKind')}<select name="kind">${C.LEAVE_KINDS.map(([v, lab, paid]) => `<option value="${v}" ${l.kind === v ? 'selected' : ''}>${lab}${paid ? '' : ' (non payée)'}</option>`).join('')}</select></label>
        <label class="field">${lbl('Effet sur le salaire', 'hr.paid')}<select name="paid">
          <option value="">selon la nature</option><option value="1" ${l.paid === true ? 'selected' : ''}>payée</option><option value="0" ${l.paid === false ? 'selected' : ''}>non payée</option></select></label>
        ${dateFieldHtml('Du', 'from', l.from, {})}
        ${dateFieldHtml('Au', 'to', l.to, {})}
        <label class="field span-2">Motif<input type="text" name="note" value="${h(l.note || '')}" placeholder="Certificat médical, congé annuel…"></label>
        <div class="field span-2" id="lf-hint"></div>
      </form>
      <div class="modal-actions">
        ${leave ? '<button class="btn btn-danger" id="del-lv" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        bindCombo($('[data-combo=employeeId]', root), { items: emps.map(e => ({ v: e.id, label: e.name, text: e.name })), placeholder: '— Choisir —' });
        const hint = () => {
          const v = formValues($('#lf', root));
          const days = C.workingDays(v.from, v.to, C.payrollSettings(data).offDays);
          const paid = v.paid === '' ? C.leaveIsPaid(v.kind) : v.paid === '1';
          const bal = v.employeeId ? C.leaveBalance(data, v.employeeId, Number((v.from || C.today()).slice(0, 4))) : null;
          $('#lf-hint', root).innerHTML = `<span class="small ${days ? 'muted' : 'warn-text'}">`
            + (days ? `<b>${pct(days)} jour(s) ouvrable(s)</b>, dimanches exclus. ` : 'Aucun jour ouvrable dans cette période — vérifie les dates. ')
            + (paid ? 'Payée : le salaire du mois n\'est pas réduit.' : 'Non payée : le brut sera réduit au prorata sur le bulletin du mois.')
            + (bal && v.kind === 'conges' ? ` Solde de congés avant cette demande : <b>${pct(bal.remaining)} jour(s)</b>.` : '')
            + '</span>';
        };
        $('#lf', root).oninput = $('#lf', root).onchange = hint; hint();
        $('#ok', root).onclick = () => {
          const v = formValues($('#lf', root));
          if (!v.employeeId) return toast('Choisis le salarié.', true);
          if (!v.from || !v.to) return toast('Dates invalides.', true);
          if (v.to < v.from) return toast('La fin ne peut pas précéder le début.', true);
          if (closedBlock([l.from, l.to, v.from, v.to], 'Cette absence')) return;
          Object.assign(l, v, { paid: v.paid === '' ? null : v.paid === '1' });
          if (!leave) data.leaves.push(l);
          save(true); close(); if (done) done();
        };
        if ($('#del-lv', root)) $('#del-lv', root).onclick = async () => {
          if (!await confirmDialog('Supprimer cette absence ? Les bulletins déjà établis ne changeront pas.')) return;
          if (closedBlock([l.from, l.to], 'Cette absence')) return;
          forget('leaves', l.id, C.leaveKindLabel(l.kind));
          data.leaves = data.leaves.filter(x => x.id !== l.id);
          save(true); close(); if (done) done();
        };
      });
  }

  function advanceForm(advance, employeeId, done) {
    const emps = data.employees.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (!emps.length) return toast('Crée d\'abord la fiche d\'un salarié.', true);
    const a = advance || { id: C.uid(), employeeId: employeeId || emps[0].id, date: C.today(), amount: 0, monthly: 0, note: '' };
    const cur = company().currency;
    modal(`<h2>${advance ? 'Modifier l\'avance' : 'Avance sur salaire'}</h2>
      <p class="small muted">Une somme prêtée au salarié, remboursée par retenues sur ses prochains bulletins. La retenue se pose toute seule, mois après mois, jusqu'à extinction.</p>
      <form id="af2" class="grid-2">
        <div class="field span-2">Salarié
          ${combo({ name: 'employeeId', value: a.employeeId, items: emps.map(e => ({ v: e.id, label: e.name, sub: e.position || '', text: e.name })), placeholder: '— Choisir —', search: 'Rechercher un salarié…' })}
        </div>
        ${dateFieldHtml('Date de l\'avance', 'date', a.date, {})}
        ${field('Montant avancé', 'amount', a.amount || 0, 'number', 'step="0.001" min="0" class="num"')}
        ${field(lbl('Retenue mensuelle', 'hr.monthly'), 'monthly', a.monthly || 0, 'number', 'step="0.001" min="0" class="num"')}
        <label class="field span-2">Note<input type="text" name="note" value="${h(a.note || '')}"></label>
        <div class="field span-2" id="af2-hint"></div>
      </form>
      <div class="modal-actions">
        ${advance ? '<button class="btn btn-danger" id="del-av" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        bindCombo($('[data-combo=employeeId]', root), { items: emps.map(e => ({ v: e.id, label: e.name, text: e.name })), placeholder: '— Choisir —' });
        const hint = () => {
          const v = formValues($('#af2', root));
          const amt = Number(v.amount) || 0, m = Number(v.monthly) || 0;
          const emp = employeeById(v.employeeId);
          const net = emp ? C.computePayslip(emp, {}, C.payrollSettings(data)).net : 0;
          $('#af2-hint', root).innerHTML = !amt || !m
            ? '<span class="small muted">Saisis le montant et la retenue mensuelle pour voir la durée du remboursement.</span>'
            : `<span class="small ${m > net * 0.3 ? 'warn-text' : 'muted'}">Remboursée en <b>${Math.ceil(amt / m)} mois</b> à ${C.money(m, cur)} par bulletin.`
              + (net ? ` Le net habituel de ce salarié est de ${C.money(net, cur)} : la retenue en représente ${pct(Math.round(m / net * 1000) / 10)} %.` : '')
              + (m > net * 0.3 ? ' C\'est beaucoup — une retenue trop lourde met le salarié en difficulté et se retourne contre toi. <em>À VÉRIFIER : la loi encadre la part du salaire qui peut être saisie.</em>' : '') + '</span>';
        };
        $('#af2', root).oninput = $('#af2', root).onchange = hint; hint();
        $('#ok', root).onclick = () => {
          const v = formValues($('#af2', root));
          if (!v.employeeId) return toast('Choisis le salarié.', true);
          if (!(Number(v.amount) > 0)) return toast('Le montant doit être supérieur à zéro.', true);
          if (!(Number(v.monthly) > 0)) return toast('Indique la retenue mensuelle.', true);
          if (closedBlock([a.date, v.date], 'Cette avance')) return;
          Object.assign(a, v, { amount: Number(v.amount), monthly: Number(v.monthly) });
          if (!advance) data.advances.push(a);
          save(true); close(); if (done) done();
        };
        if ($('#del-av', root)) $('#del-av', root).onclick = async () => {
          const r = C.advancesOf(data, a.employeeId).find(x => x.id === a.id);
          if (!await confirmDialog(`Supprimer cette avance ?${r && r.repaid ? ` ${C.money(r.repaid, cur)} ont déjà été retenus sur des bulletins : ces retenues resteront sur les bulletins concernés.` : ''}`)) return;
          if (closedBlock(a.date, 'Cette avance')) return;
          forget('advances', a.id, C.money(a.amount, cur));
          data.advances = data.advances.filter(x => x.id !== a.id);
          save(true); close(); if (done) done();
        };
      });
  }

  // Générer un document du personnel : on montre ce qu'il contiendra avant de produire le PDF.
  function hrDocForm(employee, done) {
    const e = employee;
    const cur = company().currency;
    const st = C.payrollSettings(data);
    const bal = C.leaveBalance(data, e.id, Number((e.endDate || C.today()).slice(0, 4)));
    const last = C.payslipsOf(data).filter(p => p.employeeId === e.id)[0];
    const daily = last ? C.round3(last.c.gross / (Number(st.workedDays) || 26)) : C.round3(e.grossSalary / 26);
    let lines = [
      { label: 'Salaire du mois en cours', amount: 0 },
      { label: `Indemnité de congés non pris (${pct(Math.max(0, bal.remaining))} jour(s))`, amount: C.round3(daily * Math.max(0, bal.remaining)) },
      { label: 'Indemnité de préavis', amount: 0 },
      { label: 'Indemnité de fin de contrat', amount: 0 }
    ];
    modal(`<h2>Document pour ${h(e.name)}</h2>
      <form id="hf" class="grid-2">
        <label class="field span-2">${lbl('Document', 'hr.doc')}<select name="kind">${C.HR_DOCS.map(([v, lab]) => `<option value="${v}">${lab}</option>`).join('')}</select></label>
        ${dateFieldHtml('Daté du', 'date', C.today(), {})}
        <label class="check" style="align-self:end"><input type="checkbox" name="withSalary"> Mentionner le salaire ${info('hr.withSalary')}</label>
      </form>
      <p class="small muted" id="hf-desc"></p>
      <div class="panel" id="hf-solde" hidden><h2>Solde de tout compte</h2>
        <p class="small muted mb">Ce que tu dois encore au salarié à son départ. Les montants sont à toi : SkanFact propose seulement l'indemnité de congés non pris, calculée sur son dernier salaire. <em>À VÉRIFIER : les indemnités dépendent du motif de la rupture et de la convention collective.</em></p>
        <div id="hf-lines"></div>
      </div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Exporter en PDF</button></div>`,
      (root, close) => {
        const total = () => C.round3(lines.reduce((a, l) => a + (Number(l.amount) || 0), 0));
        const drawLines = () => {
          $('#hf-lines', root).innerHTML = `<table class="lines-edit"><tbody>
            ${lines.map((l, i) => `<tr data-i="${i}">
              <td><input type="text" data-f="label" value="${h(l.label)}"></td>
              <td style="width:130px"><input type="number" class="num" data-f="amount" value="${l.amount}" step="0.001"></td>
              <td class="line-tools"><button type="button" class="btn btn-ghost btn-sm" data-x="${i}">✕</button></td></tr>`).join('')}
          </tbody></table>
          <div class="inline mt"><button type="button" class="btn btn-sm" id="hf-add">+ Ligne</button>
            <span class="small muted">Net à percevoir : <b id="hf-total">${C.money(total(), cur)}</b></span></div>`;
          // Chaque frappe redessinait tout le bloc : l'élément qu'on tapait était détruit et recréé,
          // donc le curseur repartait dans le vide à chaque caractère. On ne peut pas écrire un
          // libellé dans un champ pareil. Seul le total se recalcule ; le tableau ne bouge qu'à
          // l'ajout ou au retrait d'une ligne.
          $$('[data-f]', $('#hf-lines', root)).forEach(el => el.oninput = () => {
            const i = Number(el.closest('tr').dataset.i);
            lines[i][el.dataset.f] = el.type === 'number' ? Number(el.value) : el.value;
            $('#hf-total', root).textContent = C.money(total(), cur);
          });
          $$('[data-x]', $('#hf-lines', root)).forEach(b => b.onclick = () => { lines.splice(Number(b.dataset.x), 1); drawLines(); });
          $('#hf-add', root).onclick = () => { lines.push({ label: '', amount: 0 }); drawLines(); };
        };
        const sync = () => {
          const v = formValues($('#hf', root));
          const desc = (C.HR_DOCS.find(x => x[0] === v.kind) || [])[2] || '';
          $('#hf-desc', root).textContent = desc;
          $('#hf-solde', root).hidden = v.kind !== 'solde';
          if (v.kind !== 'attestation') $('input[name=withSalary]', root).closest('.check').style.display = 'none';
          else $('input[name=withSalary]', root).closest('.check').style.display = '';
          if (v.kind !== 'attestation' && !e.endDate) {
            $('#hf-desc', root).innerHTML = h(desc) + ' <span class="warn-text">Ce salarié n\'a pas de date de sortie : renseigne-la sur sa fiche, sinon le document portera la date du jour.</span>';
          }
        };
        drawLines(); sync();
        $('#hf', root).onchange = sync;
        $('#ok', root).onclick = async () => {
          const v = formValues($('#hf', root));
          const html = C.hrDocumentHtml(v.kind, e, data, company(), { date: v.date, withSalary: !!v.withSalary, lines });
          const safe = s2 => String(s2).replace(/[^\w\-àâäéèêëïîôöùûüç ]/gi, '').trim().replace(/\s+/g, '_');
          try {
            const f = await bridge.exportPdf(html, `${safe(C.hrDocLabel(v.kind))}_${safe(e.name)}.pdf`);
            if (f) { toast('PDF enregistré : ' + f.split(/[\\/]/).pop()); close(); if (done) done(); }
          } catch (err) { toast(err.message || 'Export impossible', true); }
        };
      });
  }

  const paieState = { tab: 'bulletins', year: lastMonth.slice(0, 4), month: String(Number(lastMonth.slice(5, 7))),
    quarter: String(Math.ceil(Number(lastMonth.slice(5, 7)) / 3)) };
  const PAIE_TABS = [['bulletins', 'Bulletins'], ['salaries', 'Salariés'], ['conges', 'Congés et absences'],
    ['avances', 'Avances'], ['declarations', 'Déclarations'], ['registre', 'Registre'], ['baremes', 'Barèmes']];
  // Idem sur la Paie : la liste des salariés, les avances en cours et le registre du personnel sont
  // des états du jour, pas d'un exercice. Ils affichaient un sélecteur d'année qui ne faisait rien.
  const P_SANS_ANNEE = ['salaries', 'avances', 'registre', 'baremes'];

  routes.paie = () => {
    const cur = company().currency;
    const s = paieState;
    const years = Array.from(new Set(data.payslips.map(p => String(p.year)).concat([C.today().slice(0, 4)]))).sort().reverse();
    if (!years.includes(s.year)) s.year = years[0];

    // L'en-tête suit l'onglet ouvert. Il était écrit UNE fois, hors du redessin : sur « Congés »,
    // le gros bouton vert en haut à droite disait « + Salarié » pendant que le vrai geste de
    // l'onglet — « + Congé ou absence » — était un bouton vert plus petit, dans le panneau. Deux
    // boutons verts sur un écran, et le mauvais à la place canonique. Le Catalogue sait faire ça
    // depuis la 1.9.0 (`head()` redessiné à chaque onglet) : on reprend son mécanisme.
    const P_ACTION = {
      salaries: ['new-emp', '+ Salarié'],
      conges: ['new-lv', '+ Congé ou absence'],
      avances: ['new-av', '+ Avance']
    };
    const pHead = () => {
      // Sans aucun salarié, les onglets sont masqués : le bouton doit alors être là quoi qu'il
      // arrive, sinon l'écran dit « commence par créer la fiche d'un salarié » sans offrir de quoi
      // le faire. (Défaut introduit par cette même version, attrapé par `npm run e2e:barre`.)
      const a = data.employees.length ? P_ACTION[s.tab] : P_ACTION.salaries;
      return `<h1>Paie</h1>
        <div class="actions">
          <select id="p-year" ${P_SANS_ANNEE.includes(s.tab) ? 'hidden' : ''}>${years.map(y => `<option ${y === s.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
          ${a ? `<button class="btn btn-primary" id="${a[0]}">${a[1]}</button>` : ''}
        </div>`;
    };
    $('#view').innerHTML = `
      <div class="page-head" id="p-head">${pHead()}</div>
      ${data.employees.length ? '' : `<div class="panel"><h2>Aucun salarié</h2>
        <p class="small">Ce module calcule les bulletins de paie à partir de barèmes que <b>tu règles toi-même</b> : CNSS, impôt sur le revenu, contribution de solidarité. Les valeurs livrées sont celles couramment appliquées en Tunisie, mais elles changent à chaque loi de finances — <em>fais valider les premiers bulletins par ton comptable avant de les remettre.</em></p>
        <p class="small muted">Commence par créer la fiche d'un salarié, avec son brut mensuel.</p>
        <button class="btn btn-primary mt" id="emp-first">+ Créer mon premier salarié</button></div>`}
      <div class="tabs" id="p-tabs" role="tablist" ${data.employees.length ? '' : 'hidden'}>${PAIE_TABS.map(([id, label]) =>
        `<button role="tab" data-tab="${id}" class="${id === s.tab ? 'active' : ''}">${label}</button>`).join('')}</div>
      <div id="p-body"></div>`;

    function drawSlips() {
      const y = Number(s.year), m = Number(s.month);
      const month = C.payslipsOf(data, y, m);
      const missing = C.missingPayslips(data, y, m);
      const sum = C.payrollSummary(data, y);
      $('#p-body').innerHTML = `
        <div class="stats">
          <div class="stat"><div class="lbl">Coût de la paie ${s.year} ${info('pay.employerCost')}</div><div class="val">${C.money(sum.cost, cur)}</div><div class="sub">${sum.count} bulletin(s), ${sum.employees} salarié(s)</div></div>
          <div class="stat"><div class="lbl">Net versé</div><div class="val">${C.money(sum.net, cur)}</div><div class="sub">ce que touchent les salariés</div></div>
          <div class="stat"><div class="lbl">CNSS à reverser ${info('pay.cnssTotal')}</div><div class="val">${C.money(C.round3(sum.cnssEmployee + sum.cnssEmployer + sum.accident), cur)}</div><div class="sub">parts salarié et employeur</div></div>
          <div class="stat"><div class="lbl">Impôt retenu ${info('pay.irpp')}</div><div class="val">${C.money(C.round3(sum.irpp + sum.css), cur)}</div><div class="sub">à reverser au Trésor</div></div>
        </div>
        <div class="panel"><h2>Bulletins du mois</h2>
          <div class="filters">
            <select id="p-month">${MONTHS_LONG.map((l, i) => `<option value="${i + 1}" ${m === i + 1 ? 'selected' : ''}>${l}</option>`).join('')}</select>
            ${missing.length ? `<button class="btn btn-sm btn-primary" id="p-gen">Établir les ${missing.length} bulletin(s) manquant(s)</button>` : '<span class="small ok-text">Tous les bulletins du mois sont établis.</span>'}
          </div>
          ${month.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Salarié</th><th class="r">Brut</th><th class="r">CNSS</th><th class="r">IRPP</th><th class="r">Net à payer</th><th class="r">Coût employeur</th><th>Payé le</th><th></th></tr></thead><tbody>
            ${month.map(x => `<tr class="${x.paidDate ? '' : 'row-warn'}">
              <td><strong>${h(x.employeeName)}</strong>${x.employee.position ? `<div class="small muted">${h(x.employee.position)}</div>` : ''}</td>
              <td class="r nw">${C.money(x.c.gross, cur)}</td>
              <td class="r nw">${C.money(x.c.cnssEmployee, cur)}</td>
              <td class="r nw">${C.money(C.round3(x.c.irpp + x.c.css), cur)}</td>
              <td class="r nw"><strong>${C.money(x.c.net, cur)}</strong></td>
              <td class="r nw">${C.money(x.c.employerCost, cur)}</td>
              <td class="nw">${x.paidDate ? C.fmtDate(x.paidDate) : '<span class="warn-text">pas encore</span>'}</td>
              <td class="r nw"><button class="btn btn-sm" data-pdf="${h(x.id)}">PDF</button>
                <button class="btn btn-sm" data-ed="${h(x.id)}">Modifier</button></td></tr>`).join('')}
            <tr class="total-row"><td><strong>Total du mois</strong></td>
              <td class="r"><strong>${C.money(C.round3(month.reduce((a, x) => a + x.c.gross, 0)), cur)}</strong></td>
              <td class="r">${C.money(C.round3(month.reduce((a, x) => a + x.c.cnssEmployee, 0)), cur)}</td>
              <td class="r">${C.money(C.round3(month.reduce((a, x) => a + x.c.irpp + x.c.css, 0)), cur)}</td>
              <td class="r"><strong>${C.money(C.round3(month.reduce((a, x) => a + x.c.net, 0)), cur)}</strong></td>
              <td class="r"><strong>${C.money(C.round3(month.reduce((a, x) => a + x.c.employerCost, 0)), cur)}</strong></td>
              <td colspan="2"></td></tr>
          </tbody></table></div>
          <p class="small muted mt">Un bulletin marqué payé sort l'argent tout seul dans la <a href="#/tresorerie">trésorerie</a> : ne saisis pas en plus un mouvement « Salaires », il compterait deux fois.</p>`
            : `<div class="empty">Aucun bulletin pour ${h(MONTHS_LONG[m - 1])} ${h(s.year)}.${missing.length ? ' Le bouton ci-dessus les établit d\'un coup, au brut de chaque fiche.' : ''}</div>`}
        </div>`;
      $('#p-month').onchange = e => { s.month = e.target.value; drawSlips(); };
      $$('#p-body [data-pdf]').forEach(b => b.onclick = () => exportPayslip(payslipById(b.dataset.pdf)));
      $$('#p-body [data-ed]').forEach(b => b.onclick = () => { const x = payslipById(b.dataset.ed); payslipForm(x, employeeById(x.employeeId), x.year, x.month, () => draw()); });
      if ($('#p-gen')) $('#p-gen').onclick = async () => {
        if (!await confirmDialog(`Établir ${missing.length} bulletin(s) pour ${MONTHS_LONG[m - 1]} ${s.year} ?\n\nLe brut vient de chaque fiche, les absences non payées et les échéances d'avance sont reprises automatiquement. Tu pourras encore ajouter les primes, bulletin par bulletin. Rien n'est payé : c'est toi qui marques chaque bulletin comme réglé.`, 'Établir', false)) return;
        const st = C.payrollSettings(data);
        if (closedBlock(C.payslipDate({ year: y, month: m }), 'Ces bulletins')) return;
        missing.forEach(e => {
          // Les absences non payées du mois et les échéances d'avance arrivent toutes seules (5.1.0).
          const input = C.payslipInputFor(data, e, y, m);
          data.payslips.push({ id: C.uid(), employeeId: e.id, year: y, month: m, ...input,
            computed: C.computePayslip(e, input, st), paidDate: '', accountId: '', method: e.method || 'virement',
            reference: '', issuedAt: C.today() });
        });
        save(true); toast(`${missing.length} bulletin(s) établi(s)`); draw();
      };
    }

    function drawEmployees() {
      const list = data.employees.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
      const st = C.payrollSettings(data);
      const active = C.activeEmployees(data).length;
      $('#p-body').innerHTML = `
        <div class="panel"><h2>Salariés ${info('pay.employees')}</h2>
          ${list.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Nom</th><th>Poste</th><th>Contrat</th><th>Depuis</th><th class="r">Brut mensuel</th><th class="r">Net estimé</th><th class="r">Coût employeur</th><th></th></tr></thead><tbody>
            ${list.map(e => {
              const c = C.computePayslip(e, {}, st);
              const out = e.endDate && e.endDate < C.today();
              return `<tr class="clickable ${out ? 'muted' : ''}" data-eid="${h(e.id)}">
                <td><strong>${h(e.name)}</strong>${out ? `<div class="small muted">parti le ${C.fmtDate(e.endDate)}</div>` : ''}</td>
                <td>${h(e.position || '')}</td><td>${h((C.contractLabel(e.contract || 'cdi') || '').split(' —')[0])}</td>
                <td class="nw">${e.hireDate ? C.fmtDate(e.hireDate) : '—'}</td>
                <td class="r nw">${C.money(e.grossSalary, cur)}</td>
                <td class="r nw">${C.money(c.net, cur)}</td>
                <td class="r nw"><strong>${C.money(c.employerCost, cur)}</strong></td>
                <td class="r"><button class="btn btn-sm" data-ee="${h(e.id)}">Modifier</button></td></tr>`;
            }).join('')}
            <tr class="total-row"><td colspan="4"><strong>${active} salarié(s) en poste</strong></td>
              <td class="r"><strong>${C.money(C.round3(C.activeEmployees(data).reduce((a, e) => a + (Number(e.grossSalary) || 0), 0)), cur)}</strong></td>
              <td></td>
              <td class="r"><strong>${C.money(C.round3(C.activeEmployees(data).reduce((a, e) => a + C.computePayslip(e, {}, st).employerCost, 0)), cur)}</strong></td>
              <td></td></tr>
          </tbody></table></div>
          <p class="small muted mt">Le coût employeur est ce que le salarié coûte vraiment : le brut plus les charges patronales. C'est lui qui entre dans ton résultat et dans ton seuil de rentabilité, pas le net.</p>`
            : '<div class="empty">Aucun salarié.</div>'}
        </div>`;
      $$('#p-body tr[data-eid]').forEach(tr => tr.onclick = e2 => { if (e2.target.closest('button')) return; navigate('#/salarie/' + tr.dataset.eid); });
      $$('#p-body [data-ee]').forEach(b => b.onclick = () => employeeForm(employeeById(b.dataset.ee), () => draw()));
    }

    function drawLeaves() {
      const y = Number(s.year);
      const all = C.leavesOf(data, '', y);
      const emps = C.activeEmployees(data);
      $('#p-body').innerHTML = `
        <div class="panel"><h2>Compteurs de congés ${info('hr.balance')}</h2>
          <p class="small muted mb">Le droit annuel (<b>${pct(C.payrollSettings(data).leaveDaysPerYear)} jours ouvrables</b>) se règle dans l'onglet Barèmes. Il s'acquiert au prorata des mois travaillés. <em>À VÉRIFIER avec ton comptable : la convention collective de ton secteur peut prévoir davantage.</em></p>
          ${emps.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Salarié</th><th class="r">Acquis ${y}</th><th class="r">Reporté</th><th class="r">Pris</th><th class="r">Solde</th><th class="r">Maladie</th><th class="r">Sans solde</th></tr></thead><tbody>
            ${emps.map(e => { const b = C.leaveBalance(data, e.id, y);
              return `<tr class="clickable ${b.remaining < 0 ? 'row-warn' : ''}" data-eid="${h(e.id)}">
                <td><strong>${h(e.name)}</strong></td>
                <td class="r nw">${pct(b.acquired)}</td><td class="r nw">${b.carry ? pct(b.carry) : '<span class="muted">—</span>'}</td>
                <td class="r nw">${pct(b.taken)}</td>
                <td class="r nw ${b.remaining < 0 ? 'warn-text' : ''}"><strong>${pct(b.remaining)}</strong></td>
                <td class="r nw">${b.byKind.maladie ? pct(b.byKind.maladie) : '<span class="muted">—</span>'}</td>
                <td class="r nw">${b.byKind['sans-solde'] ? pct(b.byKind['sans-solde']) : '<span class="muted">—</span>'}</td></tr>`;
            }).join('')}
          </tbody></table></div>
          <p class="small muted mt">Un solde négatif veut dire que le salarié a pris plus de jours qu'il n'en a acquis : ce n'est pas interdit, mais il faut le savoir.</p>`
            : '<div class="empty">Aucun salarié en poste.</div>'}
        </div>
        <div class="panel"><h2>Congés et absences de ${h(s.year)}</h2>
          <div class="filters"><span class="small muted">${all.length} enregistrement(s)</span></div>
          ${all.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Salarié</th><th>Nature</th><th>Du</th><th>Au</th><th class="r">Jours</th><th>Effet</th><th>Motif</th><th></th></tr></thead><tbody>
            ${all.map(l => { const e = employeeById(l.employeeId) || {};
              return `<tr><td><strong>${h(e.name || '')}</strong></td><td>${h(l.kindLabel)}</td>
                <td class="nw">${C.fmtDate(l.from)}</td><td class="nw">${C.fmtDate(l.to)}</td>
                <td class="r nw">${pct(l.days)}</td>
                <td>${l.paid ? '<span class="ok-text">payée</span>' : '<span class="warn-text">retirée du salaire</span>'}</td>
                <td>${h(l.note || '')}</td>
                <td class="r"><button class="btn btn-sm" data-lv="${h(l.id)}">Modifier</button></td></tr>`;
            }).join('')}
          </tbody></table></div>`
            : '<div class="empty">Aucun congé ni absence enregistré cette année. Une absence non payée se retire toute seule du bulletin du mois concerné.</div>'}
        </div>`;
      $$('#p-body [data-lv]').forEach(b => b.onclick = () => leaveForm(data.leaves.find(x => x.id === b.dataset.lv), null, () => draw()));
      $$('#p-body tr[data-eid]').forEach(tr => tr.onclick = e2 => { if (e2.target.closest('button')) return; navigate('#/salarie/' + tr.dataset.eid); });
    }

    function drawAdvances() {
      const all = C.advancesOf(data);
      const open = all.filter(a => !a.done);
      $('#p-body').innerHTML = `
        <div class="panel"><h2>Avances sur salaire ${info('hr.advance')}</h2>
          <div class="filters"><span class="small muted">${open.length} en cours sur ${all.length}${open.length ? ` · ${C.money(C.round3(open.reduce((a, x) => a + x.remaining, 0)), cur)} restant à récupérer` : ''}</span></div>
          ${all.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Salarié</th><th>Date</th><th class="r">Avancé</th><th class="r">Par mois</th><th class="r">Remboursé</th><th class="r">Reste</th><th>Note</th><th></th></tr></thead><tbody>
            ${all.map(a => { const e = employeeById(a.employeeId) || {};
              return `<tr class="${a.done ? '' : 'row-warn'}">
                <td><strong>${h(e.name || '')}</strong></td><td class="nw">${C.fmtDate(a.date)}</td>
                <td class="r nw">${C.money(a.amount, cur)}</td><td class="r nw">${C.money(a.monthly, cur)}</td>
                <td class="r nw">${C.money(a.repaid, cur)}</td>
                <td class="r nw">${a.done ? '<span class="ok-text">soldée</span>' : `<strong>${C.money(a.remaining, cur)}</strong>`}</td>
                <td>${h(a.note || '')}</td>
                <td class="r"><button class="btn btn-sm" data-av="${h(a.id)}">Modifier</button></td></tr>`;
            }).join('')}
          </tbody></table></div>
          <p class="small muted mt">La retenue se pose toute seule sur chaque bulletin établi, jusqu'à extinction — la dernière échéance ne prend que ce qui reste. Ce qui est remboursé se lit sur les bulletins, pas sur un compteur à part : supprimer une avance ne défait donc pas les retenues déjà passées.</p>`
            : '<div class="empty">Aucune avance. Une avance sur salaire se rembourse par retenues mensuelles sur les bulletins suivants.</div>'}
        </div>`;
      $$('#p-body [data-av]').forEach(b => b.onclick = () => advanceForm(data.advances.find(x => x.id === b.dataset.av), null, () => draw()));
    }

    function drawRegister() {
      const reg = C.staffRegister(data);
      $('#p-body').innerHTML = `
        <div class="panel"><h2>Registre du personnel ${info('hr.register')}</h2>
          <p class="small muted mb">La liste que l'inspection du travail peut demander : qui a travaillé chez toi, à quel poste, sous quel contrat, et entre quelles dates. <em>À VÉRIFIER : la forme exacte du registre et son mode de tenue relèvent du code du travail.</em></p>
          ${reg.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>N°</th><th>Nom</th><th>CIN</th><th>CNSS</th><th>Emploi</th><th>Contrat</th><th>Entrée</th><th>Sortie</th><th class="r">Brut</th></tr></thead><tbody>
            ${reg.map(r => `<tr class="${r.active ? '' : 'muted'}">
              <td>${r.n}</td><td><strong>${h(r.name)}</strong></td><td class="nw">${h(r.cin) || '—'}</td><td class="nw">${h(r.cnss) || '—'}</td>
              <td>${h(r.position)}</td><td>${h(r.contract)}</td>
              <td class="nw">${r.hireDate ? C.fmtDate(r.hireDate) : '—'}</td>
              <td class="nw">${r.endDate ? C.fmtDate(r.endDate) : '<span class="ok-text">en poste</span>'}</td>
              <td class="r nw">${C.money(r.grossSalary, cur)}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="inline mt"><button class="btn" id="reg-csv">Exporter en CSV</button></div>`
            : '<div class="empty">Aucun salarié.</div>'}
        </div>
        <div class="panel"><h2>Documents à remettre ${info('hr.doc')}</h2>
          <p class="small muted mb">Attestation de travail, certificat de travail, solde de tout compte : générés au même format que tes autres documents, et prêts à signer.</p>
          ${data.employees.length ? `<div class="chips-list">${data.employees.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(e => `
            <div class="inline mb"><strong style="min-width:200px;display:inline-block">${h(e.name)}</strong>
              <button class="btn btn-sm" data-hr="${h(e.id)}">Établir un document…</button></div>`).join('')}</div>`
            : '<div class="empty">Aucun salarié.</div>'}
        </div>`;
      $$('#p-body [data-hr]').forEach(b => b.onclick = () => hrDocForm(employeeById(b.dataset.hr), () => draw()));
      if ($('#reg-csv')) $('#reg-csv').onclick = async () => {
        const cols = [{ key: 'n', label: 'N°' }, { key: 'name', label: 'Nom' }, { key: 'cin', label: 'CIN' },
          { key: 'cnss', label: 'N° CNSS' }, { key: 'position', label: 'Emploi' }, { key: 'contract', label: 'Contrat' },
          { key: 'hireDate', label: 'Entrée', type: 'date' }, { label: 'Sortie', get: r => r.endDate ? C.fmtDate(r.endDate) : '' },
          { key: 'grossSalary', label: 'Brut mensuel', type: 'money' }];
        const f = await bridge.saveText(`registre-personnel-${C.today()}.csv`, C.toCsv(reg, cols));
        if (f) toast('Exporté : ' + f.split(/[\\/]/).pop());
      };
    }

    function drawDeclarations() {
      const y = Number(s.year);
      const q = Number(s.quarter) || Math.ceil(Number(C.today().slice(5, 7)) / 3);
      s.quarter = String(q);
      const cn = C.cnssDeclaration(data, y, q);
      const an = C.employerAnnual(data, y, company());
      const due = C.socialDue(data);
      const filed = id => (data.socialFilings || []).find(f => f.id === id);
      // Noter une déclaration déposée est un clic sans question — et c'est bien ainsi, on le fait
      // douze fois par an. Mais la ligne quitte aussitôt le panneau « À déposer », donc le bouton
      // qui retire la mention n'est plus là où on vient de cliquer : il faut descendre au bon
      // panneau et retrouver le bon trimestre. D'où le « Annuler » sous la main.
      const mark = async (id, label) => {
        const f = filed(id);
        if (f) {
          if (!await confirmDialog(`Retirer la mention « déposée » de ${label} ?`)) return;
          data.socialFilings = data.socialFilings.filter(x => x.id !== id);
          save(true); draw();
          return;
        }
        data.socialFilings.push({ id, filedAt: C.today(), label });
        save(true); draw();
        toastUndo(`Noté : ${label} est déposée.`, () => {
          data.socialFilings = (data.socialFilings || []).filter(x => x.id !== id);
          save(true); draw();
        });
      };
      $('#p-body').innerHTML = `
        ${due.length ? `<div class="panel" style="border-left:3px solid var(--${due.some(x => x.late) ? 'danger' : 'warning'})">
          <h2>À déposer ${info('soc.due')}</h2>
          <table class="list compact"><tbody>
            ${due.map(x => `<tr class="${x.late ? 'row-warn' : ''}"><td><strong>${h(x.label)}</strong></td>
              <td class="nw">échéance ${C.fmtDate(x.dueDate)}${x.late ? ' <span class="warn-text">— dépassée</span>' : ''}</td>
              <td class="r nw">${x.amount ? C.money(x.amount, cur) : ''}</td>
              <td class="r"><button class="btn btn-sm" data-file="${h(x.id)}" data-lab="${h(x.label)}">Marquer déposée</button></td></tr>`).join('')}
          </tbody></table>
          <p class="small muted mt">SkanFact ne dépose rien et ne se connecte à aucune administration : il prépare le tableau et te rappelle la date. <em>À VÉRIFIER avec ton comptable : les dates et les modalités de dépôt.</em></p>
        </div>` : ''}

        <div class="panel"><h2>Déclaration CNSS ${info('soc.cnss')}</h2>
          <div class="filters">
            <select id="d-quarter">${C.QUARTERS.map(([n2, lab]) => `<option value="${n2}" ${q === n2 ? 'selected' : ''}>${lab}</option>`).join('')}</select>
            <span class="small muted">Échéance usuelle : ${C.fmtDate(cn.dueDate)}${filed(`cnss-${y}-T${q}`) ? ` · <span class="ok-text">déposée le ${C.fmtDate(filed(`cnss-${y}-T${q}`).filedAt)}</span>` : ''}</span>
          </div>
          ${cn.rows.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Salarié</th><th>N° CNSS</th><th class="r">Mois</th><th class="r">Jours</th><th class="r">Assiette</th>
            <th class="r">Part salarié</th><th class="r">Part employeur</th><th class="r">Accident</th><th class="r">Total</th></tr></thead><tbody>
            ${cn.rows.map(r => `<tr><td><strong>${h(r.name)}</strong></td><td class="nw">${h(r.cnss) || '<span class="warn-text">manquant</span>'}</td>
              <td class="r nw">${r.months}</td><td class="r nw">${pct(r.days)}</td>
              <td class="r nw">${C.money(r.base, cur)}</td><td class="r nw">${C.money(r.employee, cur)}</td>
              <td class="r nw">${C.money(r.employer, cur)}</td><td class="r nw">${C.money(r.accident, cur)}</td>
              <td class="r nw"><strong>${C.money(r.total, cur)}</strong></td></tr>`).join('')}
            <tr class="total-row"><td colspan="4"><strong>${cn.employees} salarié(s)</strong></td>
              <td class="r"><strong>${C.money(cn.base, cur)}</strong></td>
              <td class="r"><strong>${C.money(cn.employee, cur)}</strong></td>
              <td class="r"><strong>${C.money(cn.employer, cur)}</strong></td>
              <td class="r"><strong>${C.money(cn.accident, cur)}</strong></td>
              <td class="r"><strong>${C.money(cn.total, cur)}</strong></td></tr>
          </tbody></table></div>
          <div class="inline mt">
            <button class="btn" id="cn-csv">Exporter en CSV</button>
            <button class="btn" id="cn-mail">Envoyer au comptable</button>
            <button class="btn ${filed(`cnss-${y}-T${q}`) ? '' : 'btn-primary'}" id="cn-file">${filed(`cnss-${y}-T${q}`) ? 'Retirer « déposée »' : 'Marquer déposée'}</button>
          </div>
          ${cn.rows.some(r => !r.cnss) ? '<p class="small warn-text mt">Un matricule CNSS manque sur une fiche : la déclaration ne peut pas être déposée sans lui.</p>' : ''}`
            : `<div class="empty">Aucun bulletin sur ce trimestre.</div>`}
        </div>

        <div class="panel"><h2>Déclaration annuelle d'employeur — ${y} ${info('soc.annual')}</h2>
          <p class="small muted mb">Le récapitulatif de ce que tu as versé et de ce que tu as retenu dans l'année. Il porte sur deux choses distinctes qu'on confond souvent : les <b>salaires</b>, et les <b>retenues à la source pratiquées sur des fournisseurs</b>. Échéance usuelle : ${C.fmtDate(an.dueDate)}${filed('employeur-' + y) ? ` · <span class="ok-text">déposée le ${C.fmtDate(filed('employeur-' + y).filedAt)}</span>` : ''}.</p>
          <h3 class="sub-h">Salaires versés</h3>
          ${an.rows.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Salarié</th><th>CIN</th><th class="r">Mois payés</th><th class="r">Brut annuel</th>
            <th class="r">CNSS retenue</th><th class="r">IRPP retenu</th><th class="r">Solidarité</th><th class="r">Net versé</th></tr></thead><tbody>
            ${an.rows.map(r => `<tr><td><strong>${h(r.name)}</strong>${r.position ? `<div class="small muted">${h(r.position)}</div>` : ''}</td>
              <td class="nw">${h(r.cin) || '—'}</td><td class="r nw">${r.months}</td>
              <td class="r nw">${C.money(r.gross, cur)}</td><td class="r nw">${C.money(r.cnss_, cur)}</td>
              <td class="r nw">${C.money(r.irpp, cur)}</td><td class="r nw">${C.money(r.css, cur)}</td>
              <td class="r nw"><strong>${C.money(r.net, cur)}</strong></td></tr>`).join('')}
            <tr class="total-row"><td colspan="3"><strong>Total</strong></td>
              <td class="r"><strong>${C.money(an.gross, cur)}</strong></td>
              <td class="r"><strong>${C.money(an.cnss, cur)}</strong></td>
              <td class="r"><strong>${C.money(an.irpp, cur)}</strong></td>
              <td class="r"><strong>${C.money(an.css, cur)}</strong></td>
              <td class="r"><strong>${C.money(an.net, cur)}</strong></td></tr>
          </tbody></table></div>` : '<div class="empty">Aucun bulletin cette année.</div>'}

          <h3 class="sub-h mt">Retenues à la source sur fournisseurs ${info('soc.held')}</h3>
          ${an.heldBySupplier.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Fournisseur</th><th>Matricule</th><th class="r">Pièces</th><th class="r">Base</th><th class="r">Retenu</th><th>Attestations</th></tr></thead><tbody>
            ${an.heldBySupplier.map(r => `<tr class="${r.missing ? 'row-warn' : ''}">
              <td><strong>${h(r.supplier)}</strong></td><td class="nw">${h(r.matricule) || '<span class="warn-text">manquant</span>'}</td>
              <td class="r nw">${r.count}</td><td class="r nw">${C.money(r.base, cur)}</td>
              <td class="r nw"><strong>${C.money(r.amount, cur)}</strong></td>
              <td>${r.missing ? `<span class="warn-text">${r.missing} à remettre</span>` : '<span class="ok-text">toutes remises</span>'}</td></tr>`).join('')}
            <tr class="total-row"><td colspan="4"><strong>Total retenu</strong></td>
              <td class="r"><strong>${C.money(an.heldTotal, cur)}</strong></td><td></td></tr>
          </tbody></table></div>
          ${an.heldMissing ? `<p class="small warn-text mt">${an.heldMissing} attestation(s) de retenue ne sont pas encore remises à tes fournisseurs. Sans elles, ils ne peuvent pas déduire ce que tu leur as retenu.</p>` : ''}`
            : '<p class="small muted">Aucune retenue à la source opérée sur un fournisseur cette année.</p>'}
          <div class="inline mt">
            <button class="btn" id="an-csv">Exporter en CSV</button>
            <button class="btn ${filed('employeur-' + y) ? '' : 'btn-primary'}" id="an-file">${filed('employeur-' + y) ? 'Retirer « déposée »' : 'Marquer déposée'}</button>
          </div>
          <p class="small muted mt"><em>À VÉRIFIER avec ton comptable : la forme exacte du formulaire, les dates et les modalités de dépôt. SkanFact prépare les chiffres, il ne dépose rien.</em></p>
        </div>`;
      $('#d-quarter').onchange = e2 => { s.quarter = e2.target.value; draw(); };
      $$('#p-body [data-file]').forEach(b => b.onclick = () => mark(b.dataset.file, b.dataset.lab));
      if ($('#cn-file')) $('#cn-file').onclick = () => mark(`cnss-${y}-T${q}`, `la déclaration CNSS ${C.quarterLabel(q)} ${y}`);
      if ($('#an-file')) $('#an-file').onclick = () => mark('employeur-' + y, `la déclaration d'employeur ${y}`);
      const cnCols = [
        { key: 'name', label: 'Salarié' }, { key: 'cnss', label: 'N° CNSS' }, { key: 'months', label: 'Mois' },
        { key: 'days', label: 'Jours' }, { key: 'base', label: 'Assiette', type: 'money' },
        { key: 'employee', label: 'Part salarié', type: 'money' }, { key: 'employer', label: 'Part employeur', type: 'money' },
        { key: 'accident', label: 'Accident du travail', type: 'money' }, { key: 'total', label: 'Total', type: 'money' }
      ];
      if ($('#cn-csv')) $('#cn-csv').onclick = async () => {
        const f = await bridge.saveText(`cnss-${y}-T${q}.csv`, C.toCsv(cn.rows, cnCols));
        if (f) toast('Exporté : ' + f.split(/[\\/]/).pop());
      };
      if ($('#cn-mail')) $('#cn-mail').onclick = async () => {
        if (await demoBlock('Envoyer une déclaration au comptable')) return;
        const acc = (company().accountantEmail || '').trim();
        const name = `cnss-${y}-T${q}.csv`;
        const att = await bridge.saveTextSilent(name, C.toCsv(cn.rows, cnCols));
        await bridge.composeMail({
          to: acc, subject: `Déclaration CNSS ${C.quarterLabel(q)} ${y} — ${company().name}`,
          body: `Bonjour,\n\nCi-joint le détail de la déclaration CNSS du ${C.quarterLabel(q).toLowerCase()} ${y} :\n`
            + `${cn.employees} salarié(s), assiette ${C.money(cn.base, cur)}, part salarié ${C.money(cn.employee, cur)}, `
            + `part employeur ${C.money(cn.employer, cur)}, accident du travail ${C.money(cn.accident, cur)}.\n`
            + `Total dû : ${C.money(cn.total, cur)}. Échéance : ${C.fmtDate(cn.dueDate)}.\n\nMerci de vérifier avant dépôt.\n`,
          attachments: att ? [att] : [], mode: 'auto'
        });
        emailComptablePret(acc);
      };
      if ($('#an-csv')) $('#an-csv').onclick = async () => {
        const cols = [
          { key: 'name', label: 'Salarié' }, { key: 'cin', label: 'CIN' }, { key: 'cnss', label: 'N° CNSS' },
          { key: 'months', label: 'Mois payés' }, { key: 'gross', label: 'Brut annuel', type: 'money' },
          { key: 'cnss_', label: 'CNSS retenue', type: 'money' }, { key: 'irpp', label: 'IRPP retenu', type: 'money' },
          { key: 'css', label: 'Solidarité', type: 'money' }, { key: 'net', label: 'Net versé', type: 'money' }
        ];
        const f = await bridge.saveText(`declaration-employeur-${y}.csv`, C.toCsv(an.rows, cols));
        if (f) toast('Exporté : ' + f.split(/[\\/]/).pop());
      };
    }

    function drawRates() {
      const st = C.payrollSettings(data);
      const num = (k, lab, key, suffix) => `<label class="field">${lbl(lab, key)}<input type="number" name="${k}" value="${st[k]}" step="0.01" min="0" class="num">${suffix ? `<span class="small muted">${suffix}</span>` : ''}</label>`;
      $('#p-body').innerHTML = `
        <div class="panel" style="border-left:3px solid var(--warning)"><h2>Ces chiffres sont à toi ${info('pay.rates')}</h2>
          <p class="small">Aucun taux n'est écrit en dur dans SkanFact : tout ce que tu vois ici sert au calcul, et rien d'autre. Les valeurs livrées sont celles couramment appliquées en Tunisie <b>au moment où cette version a été écrite</b> — elles changent à chaque loi de finances.
          <em>À VÉRIFIER avec ton comptable, et à corriger ici dès qu'un taux bouge.</em></p>
        </div>
        <form id="rf">
          <div class="panel"><h2>Cotisations sociales</h2>
            <div class="grid-3">
              ${num('cnssEmployee', 'CNSS part salarié (%)', 'pay.cnssEmployee')}
              ${num('cnssEmployer', 'CNSS part employeur (%)', 'pay.cnssEmployerRate')}
              ${num('accidentRate', 'Accident du travail (%)', 'pay.accident')}
            </div>
          </div>
          <div class="panel"><h2>Impôt sur le revenu</h2>
            <div class="grid-3">
              ${num('solidarity', 'Contribution de solidarité (%)', 'pay.solidarity')}
              ${num('proRate', 'Frais professionnels (%)', 'pay.pro')}
              ${num('proCap', 'Plafond annuel des frais', 'pay.proCap')}
              ${num('headOfFamily', 'Déduction chef de famille (par an)', 'pay.family')}
              ${num('perChild', 'Déduction par enfant (par an)', 'pay.children')}
              ${num('maxChildren', 'Nombre maximum d\'enfants comptés', 'pay.children')}
            </div>
          </div>
          <div class="panel"><h2>Congés et jours ouvrables</h2>
            <div class="grid-3">
              ${num('leaveDaysPerYear', 'Congés payés par an (jours ouvrables)', 'hr.perYear')}
              ${num('workedDays', 'Jours ouvrables d\'un mois complet', 'pay.workedDays')}
            </div>
            <p class="small muted mt">Ces deux chiffres servent au calcul des congés acquis et à la réduction d'une absence non payée. <em>À VÉRIFIER avec ton comptable : la convention collective de ton secteur peut prévoir davantage de congés.</em></p>
          </div>
          <div class="panel"><h2>Barème progressif annuel ${info('pay.brackets')}</h2>
            <table class="list compact"><thead><tr><th>De</th><th>Jusqu'à</th><th class="r" style="width:140px">Taux</th><th></th></tr></thead>
              <tbody id="rf-br"></tbody></table>
            <button type="button" class="btn btn-sm mt" id="add-br">+ Tranche</button>
            <p class="small muted mt">La dernière tranche doit rester ouverte (« au-delà ») : c'est elle qui s'applique aux revenus les plus élevés.</p>
            <div class="mt" id="rf-demo"></div>
          </div>
          <div class="inline">
            <button type="button" class="btn btn-primary" id="rf-save">Enregistrer les barèmes</button>
            <button type="button" class="btn" id="rf-reset">Revenir aux valeurs livrées</button>
          </div>
        </form>`;
      let brackets = deepCopy(st.brackets);
      const drawBrackets = () => {
        let from = 0;
        $('#rf-br').innerHTML = brackets.map((b, i) => {
          const row = `<tr data-i="${i}"><td class="nw">${C.money(from, cur)}</td>
            <td>${b.upTo == null ? '<span class="muted">au-delà</span>' : `<input type="number" class="num" data-b="upTo" value="${b.upTo}" step="100" style="width:130px">`}</td>
            <td class="r"><input type="number" class="num" data-b="rate" value="${b.rate}" step="0.5" min="0" max="100" style="width:90px"> %</td>
            <td class="r">${brackets.length > 1 ? `<button type="button" class="btn btn-ghost btn-sm" data-brm="${i}">✕</button>` : ''}</td></tr>`;
          from = b.upTo == null ? from : b.upTo;
          return row;
        }).join('');
        $$('[data-b]', $('#rf-br')).forEach(el => el.onchange = () => {
          const i = Number(el.closest('tr').dataset.i);
          brackets[i][el.dataset.b] = Number(el.value);
          drawBrackets();
        });
        $$('[data-brm]', $('#rf-br')).forEach(b => b.onclick = () => { brackets.splice(Number(b.dataset.brm), 1); drawBrackets(); });
        // Un exemple vaut mieux qu'un barème : on montre ce que ça donne sur un salaire courant.
        const demo = [1000, 1500, 2500, 4000].map(g => {
          const c = C.computePayslip({ grossSalary: g, children: 0, headOfFamily: false }, {}, { ...readRates(), brackets });
          return `<tr><td>${C.money(g, cur)}</td><td class="r">${C.money(c.cnssEmployee, cur)}</td><td class="r">${C.money(C.round3(c.irpp + c.css), cur)}</td><td class="r"><strong>${C.money(c.net, cur)}</strong></td><td class="r">${C.money(c.employerCost, cur)}</td></tr>`;
        }).join('');
        $('#rf-demo').innerHTML = `<h3 class="sub-h">Ce que ça donne, pour un célibataire sans enfant</h3>
          <table class="list compact"><thead><tr><th>Brut</th><th class="r">CNSS</th><th class="r">Impôt</th><th class="r">Net</th><th class="r">Coût employeur</th></tr></thead><tbody>${demo}</tbody></table>`;
      };
      const readRates = () => {
        const v = formValues($('#rf'));
        const out = {};
        ['cnssEmployee', 'cnssEmployer', 'accidentRate', 'solidarity', 'proRate', 'proCap', 'headOfFamily', 'perChild', 'maxChildren', 'leaveDaysPerYear', 'workedDays']
          .forEach(k => { out[k] = Number(v[k]) || 0; });
        return out;
      };
      drawBrackets();
      $('#rf').oninput = $('#rf').onchange = () => drawBrackets();
      $('#add-br').onclick = () => {
        const last = brackets[brackets.length - 1];
        const prev = brackets.length > 1 ? brackets[brackets.length - 2].upTo : 0;
        brackets.splice(brackets.length - 1, 0, { upTo: (Number(prev) || 0) + 10000, rate: last.rate });
        drawBrackets();
      };
      $('#rf-save').onclick = () => {
        const b = brackets.filter(x => x.upTo == null || Number(x.upTo) > 0);
        if (!b.some(x => x.upTo == null)) b.push({ upTo: null, rate: b.length ? b[b.length - 1].rate : 0 });
        data.payrollSettings = { ...readRates(), brackets: b };
        save(true); toast('Barèmes enregistrés — les bulletins déjà établis ne changent pas'); draw();
      };
      $('#rf-reset').onclick = async () => {
        if (!await confirmDialog('Revenir aux valeurs livrées avec SkanFact ? Les bulletins déjà établis gardent leur propre calcul et ne changeront pas.')) return;
        data.payrollSettings = {}; save(true); toast('Barèmes réinitialisés'); draw();
      };
    }

    // L'en-tête se redessine AVEC le corps : c'est ce qui manquait, et c'est pour ça que le bouton
    // vert contredisait l'onglet. `bindHead` rearme le bouton du moment — sans quoi il serait
    // visible et inerte, ce qui est pire qu'absent.
    const bindHead = () => {
      $('#p-year').onchange = e => { s.year = e.target.value; draw(); };
      const ouvrirSalarie = () => employeeForm(null, () => { paieState.tab = 'salaries'; render(); });
      if ($('#new-emp')) $('#new-emp').onclick = ouvrirSalarie;
      if ($('#emp-first')) $('#emp-first').onclick = ouvrirSalarie;
      if ($('#new-lv')) $('#new-lv').onclick = () => leaveForm(null, null, () => draw());
      if ($('#new-av')) $('#new-av').onclick = () => advanceForm(null, null, () => draw());
    };
    const draw = () => {
      $('#p-head').innerHTML = pHead(); bindHead();
      if (!data.employees.length) { $('#p-body').innerHTML = ''; return; }
      if (s.tab === 'salaries') return drawEmployees();
      if (s.tab === 'conges') return drawLeaves();
      if (s.tab === 'avances') return drawAdvances();
      if (s.tab === 'declarations') return drawDeclarations();
      if (s.tab === 'registre') return drawRegister();
      if (s.tab === 'baremes') return drawRates();
      drawSlips();
    };
    $$('#p-tabs button').forEach(b => b.onclick = () => {
      s.tab = b.dataset.tab;
      $$('#p-tabs button').forEach(x => x.classList.toggle('active', x === b));
      draw();
    });
    draw();
  };

  routes.salarie = (parts) => {
    const e = employeeById(parts[0]);
    if (!e) return navigate('#/paie');
    const cur = company().currency;
    const st = C.payrollSettings(data);
    const c = C.computePayslip(e, {}, st);
    const slips = C.payslipsOf(data).filter(p => p.employeeId === e.id);
    const year = C.today().slice(0, 4);
    const thisYear = slips.filter(p => String(p.year) === year);
    const cost = C.round3(thisYear.reduce((a, p) => a + p.c.employerCost, 0));
    $('#view').innerHTML = `
      <div class="page-head"><div><h1>${h(e.name)}</h1>
        <div class="small muted">${[e.position, C.contractLabel(e.contract || 'cdi').split(' —')[0], e.hireDate ? 'depuis le ' + C.fmtDate(e.hireDate) : '', e.endDate ? 'parti le ' + C.fmtDate(e.endDate) : ''].filter(Boolean).join(' · ')}</div></div>
        <div class="actions">${backButton('#/paie')}<button class="btn" id="edit-emp">Modifier</button>
          <button class="btn btn-primary" id="new-slip">+ Bulletin</button></div></div>
      <div class="stats">
        <div class="stat"><div class="lbl">Salaire brut mensuel</div><div class="val">${C.money(e.grossSalary, cur)}</div><div class="sub">${e.headOfFamily ? 'chef de famille' : 'célibataire'}${Number(e.children) ? ` · ${e.children} enfant(s)` : ''}</div></div>
        <div class="stat"><div class="lbl">Net estimé</div><div class="val">${C.money(c.net, cur)}</div><div class="sub">hors primes et retenues</div></div>
        <div class="stat"><div class="lbl">Coût employeur mensuel ${info('pay.employerCost')}</div><div class="val">${C.money(c.employerCost, cur)}</div><div class="sub">brut + charges patronales</div></div>
        <div class="stat"><div class="lbl">Coût ${year}</div><div class="val">${C.money(cost, cur)}</div><div class="sub">${thisYear.length} bulletin(s)</div></div>
      </div>
      <div class="panel"><h2>Identité</h2>
        <div class="kv">
          ${e.cin ? `<div><span>CIN</span><span>${h(e.cin)}</span></div>` : ''}
          ${e.cnss ? `<div><span>Matricule CNSS</span><span>${h(e.cnss)}</span></div>` : ''}
          <div><span>Contrat</span><span>${h(C.contractLabel(e.contract || 'cdi'))}</span></div>
          ${e.iban ? `<div><span>RIB / IBAN</span><span>${h(e.iban)}</span></div>` : ''}
          ${e.notes ? `<div><span>Notes</span><span>${h(e.notes)}</span></div>` : ''}
        </div>
      </div>
      ${(() => {
        const b = C.leaveBalance(data, e.id, Number(year));
        const av = C.advancesOf(data, e.id);
        const open = av.filter(x => !x.done);
        return `<div class="split">
          <div class="panel"><h2>Congés ${year} ${info('hr.balance')}</h2>
            <div class="kv">
              <div><span>Acquis</span><span>${pct(b.acquired)} jour(s) sur ${pct(b.perYear)} par an</span></div>
              ${b.carry ? `<div><span>Reporté de ${Number(year) - 1}</span><span>${pct(b.carry)} jour(s)</span></div>` : ''}
              <div><span>Pris</span><span>${pct(b.taken)} jour(s)</span></div>
              <div><span><b>Solde</b></span><span class="${b.remaining < 0 ? 'warn-text' : ''}"><b>${pct(b.remaining)} jour(s)</b></span></div>
              ${b.byKind.maladie ? `<div><span>Arrêt maladie</span><span>${pct(b.byKind.maladie)} jour(s)</span></div>` : ''}
              ${b.byKind['sans-solde'] ? `<div><span>Sans solde</span><span>${pct(b.byKind['sans-solde'])} jour(s)</span></div>` : ''}
            </div>
            <div class="inline mt"><button class="btn btn-sm" id="add-lv">+ Congé ou absence</button></div>
          </div>
          <div class="panel"><h2>Avances ${info('hr.advance')}</h2>
            ${av.length ? `<table class="list compact"><thead><tr><th>Date</th><th class="r">Avancé</th><th class="r">Reste</th></tr></thead><tbody>
              ${av.map(x => `<tr><td class="nw">${C.fmtDate(x.date)}</td><td class="r nw">${C.money(x.amount, cur)}</td>
                <td class="r nw">${x.done ? '<span class="ok-text">soldée</span>' : `<strong>${C.money(x.remaining, cur)}</strong>`}</td></tr>`).join('')}
            </tbody></table>${open.length ? `<p class="small muted mt">${C.money(C.round3(open.reduce((a2, x) => a2 + x.remaining, 0)), cur)} encore à retenir sur les prochains bulletins.</p>` : ''}`
              : '<p class="small muted">Aucune avance.</p>'}
            <div class="inline mt"><button class="btn btn-sm" id="add-av">+ Avance</button>
              <button class="btn btn-sm" id="hr-doc">Établir un document…</button></div>
          </div>
        </div>`;
      })()}
      <div class="panel"><h2>Congés et absences</h2>
        ${C.leavesOf(data, e.id, Number(year)).length ? `<table class="list compact"><thead><tr><th>Nature</th><th>Du</th><th>Au</th><th class="r">Jours</th><th>Effet</th><th>Motif</th><th></th></tr></thead><tbody>
          ${C.leavesOf(data, e.id, Number(year)).map(l => `<tr><td>${h(l.kindLabel)}</td>
            <td class="nw">${C.fmtDate(l.from)}</td><td class="nw">${C.fmtDate(l.to)}</td><td class="r nw">${pct(l.days)}</td>
            <td>${l.paid ? '<span class="ok-text">payée</span>' : '<span class="warn-text">retirée du salaire</span>'}</td>
            <td>${h(l.note || '')}</td>
            <td class="r"><button class="btn btn-sm" data-lv="${h(l.id)}">Modifier</button></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty">Aucun congé ni absence en ${h(year)}.</div>`}
      </div>
      <div class="panel"><h2>Bulletins</h2>
        ${slips.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
          <th>Mois</th><th class="r">Brut</th><th class="r">Retenues</th><th class="r">Net</th><th class="r">Coût</th><th>Payé le</th><th></th></tr></thead><tbody>
          ${slips.map(x => `<tr class="${x.paidDate ? '' : 'row-warn'}">
            <td><strong>${h(MONTHS_LONG[x.month - 1])} ${x.year}</strong></td>
            <td class="r nw">${C.money(x.c.gross, cur)}</td>
            <td class="r nw">${C.money(C.round3(x.c.cnssEmployee + x.c.irpp + x.c.css + x.c.otherDeductions), cur)}</td>
            <td class="r nw"><strong>${C.money(x.c.net, cur)}</strong></td>
            <td class="r nw">${C.money(x.c.employerCost, cur)}</td>
            <td class="nw">${x.paidDate ? C.fmtDate(x.paidDate) : '<span class="warn-text">pas encore</span>'}</td>
            <td class="r nw"><button class="btn btn-sm" data-pdf="${h(x.id)}">PDF</button>
              <button class="btn btn-sm" data-ed="${h(x.id)}">Modifier</button></td></tr>`).join('')}
        </tbody></table></div>`
          : '<div class="empty">Aucun bulletin pour ce salarié.</div>'}
      </div>`;
    bindBack('#/paie');
    $('#edit-emp').onclick = () => employeeForm(e, () => render());
    $('#new-slip').onclick = () => {
      const t = C.addMonths(C.today().slice(0, 7) + '-01', -1, 1);
      payslipForm(null, e, Number(t.slice(0, 4)), Number(t.slice(5, 7)), () => render());
    };
    $$('[data-pdf]').forEach(b => b.onclick = () => exportPayslip(payslipById(b.dataset.pdf)));
    $$('[data-ed]').forEach(b => b.onclick = () => { const x = payslipById(b.dataset.ed); payslipForm(x, e, x.year, x.month, () => render()); });
    $('#add-lv').onclick = () => leaveForm(null, e.id, () => render());
    $('#add-av').onclick = () => advanceForm(null, e.id, () => render());
    $('#hr-doc').onclick = () => hrDocForm(e, () => render());
    $$('[data-lv]').forEach(b => b.onclick = () => leaveForm(data.leaves.find(x => x.id === b.dataset.lv), null, () => render()));
  };

  // ---------- Stock (4.0.0) ----------
  const stockState = { tab: 'etat', q: '', only: '', counts: {}, countDate: C.today(), year: C.today().slice(0, 4), moves: { page: 1 },
    ser: { q: '', status: '', page: 1 } };
  const STOCK_TABS = [['etat', 'État du stock'], ['mouvements', 'Mouvements'], ['series', 'Numéros de série'], ['inventaire', 'Inventaire'], ['alertes', 'Alertes']];

  function adjustForm(itemId, done) {
    const items = C.trackedItems(data);
    if (!items.length) return toast('Aucun article n\'est suivi en stock. Coche « Suivi en stock » sur une prestation du catalogue.', true);
    const a = { id: C.uid(), date: C.today(), itemId: itemId || items[0].id, qty: 0, unitCost: '', source: 'casse', reference: '', note: '' };
    const cur = company().currency;
    modal(`<h2>Mouvement de stock</h2>
      <p class="small muted">Ce qui n'a ni facture ni achat : casse, perte, vol, cadeau, correction d'inventaire. Les entrées d'achat et les sorties de vente remontent toutes seules — ne les saisis pas ici.</p>
      <form id="adf" class="grid-2">
        ${dateFieldHtml('Date', 'date', a.date, {})}
        <div class="field">Article
          ${combo({ name: 'itemId', value: a.itemId, items: items.map(c => ({ v: c.id, label: c.label, sub: c.unit || '', text: c.label })), placeholder: '— Choisir un article —', search: 'Rechercher un article…' })}
        </div>
        <label class="field">${lbl('Nature', 'stk.moveKind')}<select name="source">${C.MOVE_SOURCES.filter(([k]) => ['casse', 'inventaire', 'ajustement'].includes(k)).map(([v, l]) => `<option value="${v}" ${a.source === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${field(lbl('Quantité', 'stk.adjustQty'), 'qty', 0, 'number', 'step="0.01" class="num" placeholder="-2 pour une sortie"')}
        ${field('Coût unitaire (optionnel)', 'unitCost', '', 'number', 'step="0.001" min="0" class="num" placeholder="laisse vide : coût moyen"')}
        ${field('Référence', 'reference', '', 'text', '')}
        <label class="field span-2">Note<input type="text" name="note" placeholder="Deux disques tombés à la livraison"></label>
        <div class="field span-2" id="adj-hint"></div>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        bindCombo($('[data-combo=itemId]', root), { items: items.map(c => ({ v: c.id, label: c.label, text: c.label })), placeholder: '— Choisir un article —' });
        const hint = () => {
          const v = formValues($('#adf', root));
          const s = C.stockOf(data, v.itemId);
          const q = Number(v.qty) || 0;
          const after = C.round3(s.qty + q);
          $('#adj-hint', root).innerHTML = `<span class="small ${after < 0 ? 'warn-text' : 'muted'}">`
            + `Stock actuel : <b>${pct(s.qty)} ${h(s.unit)}</b> au coût moyen de ${C.money(s.cmp, cur)}. `
            + (q ? `Après ce mouvement : <b>${pct(after)} ${h(s.unit)}</b>.` : 'Une quantité négative sort de la marchandise, une positive en fait rentrer.')
            + (after < 0 ? ' Un stock négatif veut dire qu\'une entrée manque quelque part.' : '') + '</span>';
        };
        $('#adf', root).oninput = $('#adf', root).onchange = hint; hint();
        $('#ok', root).onclick = () => {
          const v = formValues($('#adf', root));
          if (!v.itemId) return toast('Choisis un article.', true);
          if (!Number(v.qty)) return toast('La quantité ne peut pas être zéro.', true);
          if (!v.date) return toast('Date invalide.', true);
          if (closedBlock(v.date, 'Ce mouvement de stock')) return;
          data.stockAdjustments.push({ ...a, ...v, qty: Number(v.qty), unitCost: v.unitCost === '' ? '' : Number(v.unitCost) });
          save(true); close(); if (done) done();
        };
      });
  }

  routes.stock = () => {
    const cur = company().currency;
    const s = stockState;
    const items = C.trackedItems(data);
    const alerts = C.stockAlerts(data);

    // Même défaut que sur Paie : le bouton vert de l'en-tête ne suivait pas l'onglet. Sur
    // « Numéros de série », il disait « + Mouvement » pendant que « + Entrée de numéros », le vrai
    // geste, était un bouton vert plus petit dans le panneau.
    const ST_ACTION = { etat: ['st-adj', '+ Mouvement'], series: ['se-add', '+ Entrée de numéros'] };
    // Le bouton d'export DIT ce qu'il exporte : jusqu'ici il s'appelait « Exporter en CSV » sur les
    // cinq onglets et renvoyait l'état du stock sur les cinq.
    const ST_LABELS = { etat: 'l\'état du stock', mouvements: 'les mouvements', series: 'les numéros de série',
      inventaire: 'l\'inventaire', alertes: 'ce qu\'il faut recommander' };
    const stHead = () => {
      const a = items.length ? ST_ACTION[s.tab] : ST_ACTION.etat;   // même garde-fou que sur Paie
      return `<h1>Stock</h1>
        <div class="actions">
          <button class="btn" id="st-csv" data-csv="${h(s.tab)}">Exporter ${h(ST_LABELS[s.tab] || ST_LABELS.etat)}</button>
          <button class="btn" id="st-war">Garanties</button>
          ${a ? `<button class="btn btn-primary" id="${a[0]}">${a[1]}</button>` : ''}
        </div>`;
    };
    $('#view').innerHTML = `
      <div class="page-head" id="st-head">${stHead()}</div>
      ${items.length ? '' : `<div class="panel"><h2>Aucun article suivi</h2>
        <p class="small">Le stock ne se saisit pas : il se déduit de tes achats et de tes ventes. Pour qu'un article soit compté, ouvre le <a href="#/catalogue">Catalogue</a>, modifie la prestation et coche <b>« Suivi en stock »</b>. Indique ce que tu as en rayon aujourd'hui, et SkanFact suit le reste tout seul.</p>
        <p class="small muted">Les prestations (du temps, du conseil) n'ont pas de stock : ne coche la case que pour de la marchandise.</p></div>`}
      <div class="tabs" id="st-tabs" role="tablist" ${items.length ? '' : 'hidden'}>${STOCK_TABS.map(([id, label]) =>
        `<button role="tab" data-tab="${id}" class="${id === s.tab ? 'active' : ''}">${label}${id === 'alertes' && alerts.length ? ` <span class="nav-count">${alerts.length}</span>` : ''}</button>`).join('')}</div>
      <div id="st-body"></div>`;

    const qtyCell = (st) => `<span class="${st.negative ? 'warn-text' : st.low ? 'warn-text' : ''}"><strong>${pct(st.qty)}</strong>${st.unit ? ' ' + h(st.unit) : ''}</span>`;

    function drawState() {
      const t = C.stockTotals(data);
      const q = s.q.trim().toLowerCase();
      const rows = t.rows.filter(r => (!q || (r.label || '').toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q))
        && (!s.only || (s.only === 'alerte' ? (r.low || r.negative) : r.qty > 0)));
      $('#st-body').innerHTML = `
        <div class="stats">
          <div class="stat"><div class="lbl">Valeur du stock ${info('stk.value')}</div><div class="val">${C.money(t.value, cur)}</div><div class="sub">${t.count} article(s) suivi(s)</div></div>
          <div class="stat" ${t.low ? 'data-stat="low" role="button" tabindex="0"' : ''}><div class="lbl">Sous le seuil ${info('stk.min')}</div><div class="val ${t.low ? 'due' : ''}">${t.low}</div><div class="sub">${t.low ? 'à recommander — voir lesquels' : 'à recommander'}</div></div>
          <div class="stat" ${t.negative ? 'data-stat="neg" role="button" tabindex="0"' : ''}><div class="lbl">Stocks négatifs ${info('stk.negative')}</div><div class="val ${t.negative ? 'due' : ''}">${t.negative}</div><div class="sub">${t.negative ? 'une entrée manque quelque part — voir lesquels' : 'rien d\'impossible'}</div></div>
          <div class="stat"><div class="lbl">Prix de vente du stock</div><div class="val">${C.money(C.round3(t.rows.reduce((a, r) => a + Math.max(0, r.qty) * r.unitPrice, 0)), cur)}</div><div class="sub">ce qu'il rapporterait vendu</div></div>
        </div>
        <div class="panel"><h2>État du stock ${info('stk.state')}</h2>
          <div class="filters">
            <input type="search" id="st-q" placeholder="Rechercher un article…" value="${h(s.q)}">
            <select id="st-only"><option value="">Tous les articles</option><option value="positif" ${s.only === 'positif' ? 'selected' : ''}>En stock seulement</option><option value="alerte" ${s.only === 'alerte' ? 'selected' : ''}>À surveiller</option></select>
            <span class="small muted">${rows.length} sur ${t.count}</span>
          </div>
          ${rows.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Article</th><th>Emplacement</th><th class="r">En stock</th><th class="r">Seuil</th><th class="r">Coût moyen ${info('stk.cmp')}</th><th class="r">Valeur</th><th class="r">Prix de vente</th></tr></thead><tbody>
            ${rows.map(r => `<tr class="clickable ${r.negative ? 'row-warn' : ''}" data-iid="${h(r.itemId)}">
              <td><strong>${h(r.label)}</strong>${r.negative ? '<div class="small warn-text">stock négatif : une entrée manque</div>' : r.low ? '<div class="small warn-text">sous le seuil d\'alerte</div>' : ''}</td>
              <td>${h(r.location) || '<span class="muted">—</span>'}</td>
              <td class="r nw">${qtyCell(r)}</td>
              <td class="r nw">${r.minStock ? pct(r.minStock) : '<span class="muted">—</span>'}</td>
              <td class="r nw">${C.money(r.cmp, cur)}</td>
              <td class="r nw"><strong>${C.money(Math.max(0, r.value), cur)}</strong></td>
              <td class="r nw">${C.money(r.unitPrice, cur)}</td></tr>`).join('')}
            <tr class="total-row"><td colspan="5"><strong>Total</strong></td>
              <td class="r"><strong>${C.money(C.round3(rows.reduce((a, r) => a + Math.max(0, r.value), 0)), cur)}</strong></td><td></td></tr>
          </tbody></table></div>
          <p class="small muted mt">Valorisation au <b>coût moyen pondéré</b> : à chaque entrée, le coût unitaire moyen est recalculé sur tout le stock. <em>À VÉRIFIER avec ton comptable : la méthode retenue pour tes comptes annuels.</em></p>`
            : '<div class="empty">Aucun article ne correspond.</div>'}
        </div>`;
      $('#st-q').oninput = e => { s.q = e.target.value; drawState(); const el = $('#st-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
      $('#st-only').onchange = e => { s.only = e.target.value; drawState(); };
      // Un compteur rouge qui nomme un ensemble doit l'ouvrir (7.15.0) : ces deux-là annonçaient un
      // problème et laissaient chercher les articles concernés à la main dans toute la liste.
      const versAlertes = () => { s.tab = 'alertes'; $$('#st-tabs button').forEach(x => x.classList.toggle('active', x.dataset.tab === 'alertes')); draw(); };
      $$('#st-body .stat[data-stat]').forEach(el => {
        const go = e2 => { if (e2.target.closest('.i[data-info]')) return; versAlertes(); };
        el.onclick = go;
        el.onkeydown = e2 => { if (e2.key === 'Enter' || e2.key === ' ') { e2.preventDefault(); versAlertes(); } };
      });
      $$('#st-body tr[data-iid]').forEach(tr => tr.onclick = () => navigate('#/article/' + tr.dataset.iid));
    }

    function drawMoves() {
      // Même défaut que sur la Trésorerie : l'année était écrite dans le code. Un inventaire se
      // justifie sur l'exercice écoulé, et la page n'offrait aucun moyen d'y retourner.
      const tout = C.stockJournal(data, { from: '', to: '9999-12-31' });
      const annees = Array.from(new Set(tout.map(m => (m.date || '').slice(0, 4)).filter(Boolean)
        .concat([C.today().slice(0, 4)]))).sort().reverse();
      if (!annees.includes(s.year)) s.year = annees[0];
      const year = s.year;
      const all = C.stockJournal(data, { from: `${year}-01-01`, to: `${year}-12-31` });
      const paged = paginate(all, s.moves);
      $('#st-body').innerHTML = `
        <div class="panel"><h2>Mouvements de ${h(year)} ${info('stk.moves')}</h2>
          <div class="filters"><select id="st-year">${annees.map(y => `<option ${y === s.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
            <span class="small muted">${all.length} mouvement(s)</span></div>
          ${all.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Date</th><th>Article</th><th>Origine</th><th>Référence</th><th class="r">Quantité</th><th class="r">Coût unitaire</th><th class="r">Stock après</th></tr></thead><tbody>
            ${paged.rows.map(m => `<tr class="${m.docId ? 'clickable' : ''}" ${m.docId ? `data-go="${h(m.source === 'achat' ? '#/achat/' : '#/doc/')}${h(m.docId)}"` : ''}>
              <td class="nw">${C.fmtDate(m.date)}</td><td>${h(m.label)}</td>
              <td>${h(C.moveSourceLabel(m.source))}${m.note ? `<div class="small muted">${h(m.note)}</div>` : ''}</td>
              <td class="nw">${h(m.ref) || '<span class="muted">—</span>'}</td>
              <td class="r nw ${m.qty < 0 ? 'warn-text' : 'ok-text'}"><strong>${m.qty > 0 ? '+' : ''}${pct(m.qty)}</strong></td>
              <td class="r nw">${C.money(m.unitApplied, cur)}</td>
              <td class="r nw ${m.qtyAfter < 0 ? 'warn-text' : ''}">${pct(m.qtyAfter)}</td></tr>`).join('')}
          </tbody></table></div>
          ${paged.pg ? pagerBar(paged.pg, { noun: 'mouvement' }) : ''}
          <p class="small muted mt">Tout vient des pièces déjà saisies : une ligne d'achat en destination « stock » fait une entrée, une facture ou un bon de livraison fait une sortie. Seuls les mouvements « casse », « inventaire » et « ajustement » se saisissent à la main.</p>`
            : `<div class="empty">Aucun mouvement en ${h(year)}.</div>`}
        </div>`;
      $('#st-year').onchange = e => { s.year = e.target.value; s.moves.page = 1; drawMoves(); };
      $$('#st-body tr[data-go]').forEach(tr => tr.onclick = () => navigate(tr.dataset.go));
      bindPager($('#st-body'), s.moves, () => drawMoves(), '#st-body');
    }

    function drawInventory() {
      const rows = C.inventoryDiff(data, s.counts, s.countDate);
      const counted = rows.filter(r => r.counted != null);
      const gaps = counted.filter(r => r.gap !== 0);
      const value = C.round3(gaps.reduce((a, r) => a + r.value, 0));
      $('#st-body').innerHTML = `
        <div class="panel"><h2>Inventaire physique ${info('stk.inventory')}</h2>
          <p class="small muted mb">Une fois par an au minimum, on compte ce qu'il y a vraiment en rayon et on le compare à ce que dit l'application. Un écart n'est pas une faute : c'est de la casse non déclarée, une sortie oubliée ou une erreur de saisie. L'important est de le voir.</p>
          <div class="filters">
            <label class="small">Date du comptage ${dateFieldHtml('', 'countDate', s.countDate, {})}</label>
            <span class="small muted">${counted.length} article(s) comptés sur ${rows.length}</span>
          </div>
          <div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Article</th><th class="r">Stock théorique</th><th class="r">Compté</th><th class="r">Écart</th><th class="r">Valeur de l'écart</th></tr></thead><tbody>
            ${rows.map(r => `<tr class="${r.gap != null && r.gap !== 0 ? 'row-warn' : ''}">
              <td><strong>${h(r.label)}</strong>${r.unit ? ` <span class="muted">(${h(r.unit)})</span>` : ''}</td>
              <td class="r nw">${pct(r.book)}</td>
              <td class="r"><input type="number" step="0.01" class="num inv-in" data-iid="${h(r.itemId)}" value="${r.counted == null ? '' : r.counted}" placeholder="—" style="width:90px"></td>
              <td class="r nw ${r.gap ? (r.gap < 0 ? 'warn-text' : 'ok-text') : ''}">${r.gap == null ? '<span class="muted">—</span>' : `<strong>${r.gap > 0 ? '+' : ''}${pct(r.gap)}</strong>`}</td>
              <td class="r nw">${r.gap == null || r.gap === 0 ? '<span class="muted">—</span>' : C.money(r.value, cur)}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="inline mt">
            <button class="btn btn-primary" id="inv-apply" ${gaps.length ? '' : 'disabled'}>Enregistrer ${gaps.length} écart(s)</button>
            <button class="btn" id="inv-clear" ${counted.length ? '' : 'disabled'}>Effacer le comptage</button>
            <span class="small ${value < 0 ? 'warn-text' : 'muted'}">${gaps.length ? `Impact sur la valeur du stock : ${C.money(value, cur)}` : 'Aucun écart pour l\'instant.'}</span>
          </div>
          <p class="small muted mt">Rien n'est modifié tant que tu ne cliques pas : le comptage reste à l'écran, et c'est toi qui décides de le passer en mouvements d'inventaire.</p>
        </div>`;
      bindDateFields($('#st-body'));
      const hid = $('#st-body input[name=countDate]');
      if (hid) hid.onchange = () => { s.countDate = hid.value || C.today(); drawInventory(); };
      $$('#st-body .inv-in').forEach(el => el.oninput = () => {
        s.counts[el.dataset.iid] = el.value;
        const keep = el.dataset.iid, pos = el.selectionStart;
        drawInventory();
        const again = $(`#st-body .inv-in[data-iid="${keep}"]`);
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (_) {} }
      });
      $('#inv-clear').onclick = () => { s.counts = {}; drawInventory(); };
      $('#inv-apply').onclick = async () => {
        if (!await confirmDialog(`Enregistrer ${gaps.length} mouvement(s) d'inventaire au ${C.fmtDate(s.countDate)} ? Le stock théorique sera aligné sur ce que tu as compté. Cette opération est tracée dans les mouvements et se corrige comme n'importe quel ajustement.`, 'Enregistrer')) return;
        if (closedBlock(s.countDate, 'Cet inventaire')) return;
        gaps.forEach(r => data.stockAdjustments.push({ id: C.uid(), date: s.countDate, itemId: r.itemId, qty: r.gap,
          unitCost: '', source: 'inventaire', reference: '', note: `Inventaire du ${C.fmtDate(s.countDate)}` }));
        s.counts = {}; save(true); toast(`${gaps.length} écart(s) enregistré(s)`); draw();
      };
    }

    function drawAlerts() {
      $('#st-body').innerHTML = `
        <div class="panel"><h2>Ce qui demande ton attention ${info('stk.alerts')}</h2>
          ${alerts.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Article</th><th>Problème</th><th class="r">En stock</th><th class="r">Seuil</th><th class="r">À commander</th><th></th></tr></thead><tbody>
            ${alerts.map(r => `<tr class="${r.kind === 'negatif' ? 'row-warn' : ''}">
              <td><strong>${h(r.label)}</strong>${r.location ? `<div class="small muted">${h(r.location)}</div>` : ''}</td>
              <td>${r.kind === 'negatif' ? '<span class="warn-text">Stock négatif — tu as vendu plus que tu n\'as acheté. Un achat manque, ou une quantité a été saisie de travers.</span>'
                : r.kind === 'rupture' ? '<span class="warn-text">Rupture : il n\'en reste plus.</span>'
                : 'Sous le seuil d\'alerte.'}</td>
              <td class="r nw">${qtyCell(r)}</td>
              <td class="r nw">${r.minStock ? pct(r.minStock) : '<span class="muted">—</span>'}</td>
              <td class="r nw">${r.kind === 'negatif' ? '<span class="muted">—</span>' : `<strong>${pct(C.round3(Math.max(r.minStock, 1) - r.qty))}</strong>`}</td>
              <td class="r"><button class="btn btn-sm" data-fix="${h(r.itemId)}">Ajuster</button>
                <button class="btn btn-sm btn-ghost" data-see="${h(r.itemId)}">Voir</button></td></tr>`).join('')}
          </tbody></table></div>`
            : '<div class="empty">Rien à signaler : aucun stock négatif, aucun article sous son seuil.</div>'}
        </div>`;
      $$('#st-body [data-fix]').forEach(b => b.onclick = () => adjustForm(b.dataset.fix, () => draw()));
      $$('#st-body [data-see]').forEach(b => b.onclick = () => navigate('#/article/' + b.dataset.see));
    }

    function drawSerials() {
      const serialized = C.serializedItems(data);
      const q = s.ser.q.trim().toLowerCase();
      const all = C.serialList(data, { status: s.ser.status })
        .filter(x => !q || (x.serial || '').toLowerCase().includes(q) || (x.itemLabel || '').toLowerCase().includes(q) || (x.clientName || '').toLowerCase().includes(q));
      const paged = paginate(all, s.ser);
      const gaps = C.serialGaps(data);
      $('#st-body').innerHTML = `
        ${gaps.length ? `<div class="panel" style="border-left:3px solid var(--warning)"><h2>Les deux comptes ne disent pas la même chose ${info('ser.gap')}</h2>
          <p class="small">${gaps.map(g => `<b>${h(g.label)}</b> : ${pct(g.qty)} en stock, ${g.serials} numéro(s) disponible(s)`).join(' · ')}. Un numéro n'a pas été saisi à l'entrée, ou pas attribué à la sortie.</p></div>` : ''}
        <div class="panel"><h2>Numéros de série ${info('ser.list')}</h2>
          ${serialized.length ? `<div class="filters">
            <input type="search" id="se-q" placeholder="Rechercher : numéro, article, client…" value="${h(s.ser.q)}">
            <select id="se-st"><option value="">Tous les états</option>${C.SERIAL_STATUSES.map(([v, l]) => `<option value="${v}" ${s.ser.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <span class="small muted">${all.length} numéro(s)</span>
          </div>
          ${all.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Numéro</th><th>Article</th><th>État</th><th>Entré le</th><th>Client</th><th>Livré le</th><th>Garantie</th><th></th></tr></thead><tbody>
            ${paged.rows.map(x => `<tr>
              <td><strong>${h(x.serial)}</strong></td><td>${h(x.itemLabel)}</td>
              <td>${h(C.serialStatusLabel(x.status))}</td>
              <td class="nw">${C.fmtDate(x.inDate)}</td>
              <td>${x.clientId ? `<a href="#/client/${h(x.clientId)}">${h(x.clientName)}</a>` : '<span class="muted">—</span>'}</td>
              <td class="nw">${x.outDate ? C.fmtDate(x.outDate) : '<span class="muted">—</span>'}</td>
              <td class="nw">${!x.warrantyEndDate ? '<span class="muted">—</span>'
                : x.expired ? `<span class="muted">expirée le ${C.fmtDate(x.warrantyEndDate)}</span>`
                : `<span class="${x.warrantyEndingSoon ? 'warn-text' : 'ok-text'}">jusqu'au ${C.fmtDate(x.warrantyEndDate)}</span>`}</td>
              <td class="r"><button class="btn btn-sm" data-ser="${h(x.id)}">Modifier</button></td></tr>`).join('')}
          </tbody></table></div>
          ${paged.pg ? pagerBar(paged.pg, { noun: 'numéro' }) : ''}`
            : '<div class="empty">Aucun numéro ne correspond.</div>'}`
            : `<div class="empty">
                <p><b>Aucun article n'est suivi par numéro de série.</b> C'est utile pour du matériel garanti :
                tu sauras qui a quoi, depuis quand, et jusqu'à quand c'est couvert.</p>
                <div class="inline" style="justify-content:center;margin-top:10px">
                  ${data.catalog.length ? '<button class="btn btn-primary" id="ser-pick">Choisir une prestation à suivre…</button>' : ''}
                  <button class="btn${data.catalog.length ? ' btn-ghost' : ' btn-primary'}" id="ser-new">+ Nouvelle prestation suivie</button>
                </div></div>`}
        </div>`;
      if ($('#se-q')) $('#se-q').oninput = e => { s.ser.q = e.target.value; s.ser.page = 1; drawSerials(); const el = $('#se-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
      if ($('#se-st')) $('#se-st').onchange = e => { s.ser.status = e.target.value; s.ser.page = 1; drawSerials(); };
      // L'état vide expliquait le geste en prose et laissait retraverser l'application de mémoire.
      if ($('#ser-pick')) $('#ser-pick').onclick = () => navigate('#/catalogue');
      if ($('#ser-new')) $('#ser-new').onclick = () => catalogForm(null, () => render());
      $$('#st-body [data-ser]').forEach(b => b.onclick = () => { const x = data.serials.find(y => y.id === b.dataset.ser); if (x) serialForm(x, () => draw()); });
      bindPager($('#st-body'), s.ser, () => drawSerials(), '#st-body');
    }

    const bindStHead = () => {
      if ($('#st-adj')) $('#st-adj').onclick = () => adjustForm(null, () => draw());
      if ($('#se-add')) $('#se-add').onclick = () => serialIntakeForm(null, () => draw());
      $('#st-war').onclick = () => navigate('#/garanties');
      $('#st-csv').onclick = exportStock;
    };
    const draw = () => {
      $('#st-head').innerHTML = stHead(); bindStHead();
      if (!items.length) { $('#st-body').innerHTML = ''; return; }
      if (s.tab === 'series') return drawSerials();
      if (s.tab === 'mouvements') return drawMoves();
      if (s.tab === 'inventaire') return drawInventory();
      if (s.tab === 'alertes') return drawAlerts();
      drawState();
    };
    $$('#st-tabs button').forEach(b => b.onclick = () => {
      s.tab = b.dataset.tab;
      $$('#st-tabs button').forEach(x => x.classList.toggle('active', x === b));
      draw();
    });
    // Le bouton exportait l'état du stock quel que soit l'onglet ouvert : depuis « Mouvements », on
    // demandait le journal et on recevait l'inventaire, sans un mot. Un export suit ce qu'on regarde.
    const ST_EXPORTS = {
      etat: () => ({
        nom: `stock-${C.today()}.csv`, rows: C.stockTotals(data).rows, cols: [
          { key: 'label', label: 'Article' }, { key: 'location', label: 'Emplacement' },
          { key: 'qty', label: 'En stock' }, { key: 'unit', label: 'Unité' },
          { key: 'minStock', label: 'Seuil' }, { key: 'cmp', label: 'Coût moyen', type: 'money' },
          { label: 'Valeur', type: 'money', get: r => Math.max(0, r.value) },
          { key: 'unitPrice', label: 'Prix de vente', type: 'money' }]
      }),
      mouvements: () => ({
        nom: `mouvements-stock-${s.year}.csv`,
        rows: C.stockJournal(data, { from: `${s.year}-01-01`, to: `${s.year}-12-31` }), cols: [
          { key: 'date', label: 'Date', type: 'date' }, { key: 'label', label: 'Article' },
          { label: 'Origine', get: m => C.moveSourceLabel(m.source) }, { key: 'ref', label: 'Référence' },
          { key: 'note', label: 'Note' }, { key: 'qty', label: 'Quantité' },
          { key: 'unitApplied', label: 'Coût unitaire', type: 'money' }, { key: 'qtyAfter', label: 'Stock après' }]
      }),
      series: () => ({
        nom: `numeros-serie-${C.today()}.csv`, rows: C.serialList(data, { status: s.ser.status }), cols: [
          { key: 'serial', label: 'Numéro' }, { key: 'itemLabel', label: 'Article' },
          { label: 'Statut', get: x => C.serialStatusLabel(x.status) }, { key: 'clientName', label: 'Client' },
          { key: 'inDate', label: 'Entrée', type: 'date' }, { key: 'outDate', label: 'Sortie', type: 'date' },
          { key: 'warrantyEndDate', label: 'Fin de garantie', type: 'date' }]
      }),
      inventaire: () => ({
        nom: `inventaire-${s.countDate}.csv`, rows: C.inventoryDiff(data, s.counts, s.countDate), cols: [
          { key: 'label', label: 'Article' }, { key: 'unit', label: 'Unité' },
          { key: 'book', label: 'Selon SkanFact' }, { key: 'counted', label: 'Compté' },
          { key: 'gap', label: 'Écart' }, { key: 'value', label: 'Valeur de l\'écart', type: 'money' }]
      }),
      alertes: () => ({
        nom: `a-recommander-${C.today()}.csv`, rows: C.stockAlerts(data), cols: [
          { key: 'label', label: 'Article' }, { key: 'location', label: 'Emplacement' },
          { key: 'kind', label: 'Problème' }, { key: 'qty', label: 'En stock' },
          { key: 'minStock', label: 'Seuil' },
          { label: 'À commander', get: r => r.kind === 'negatif' ? '' : C.round3(Math.max(r.minStock, 1) - r.qty) }]
      })
    };
    async function exportStock() {
      const e = (ST_EXPORTS[s.tab] || ST_EXPORTS.etat)();
      if (!e.rows.length) return toast('Rien à exporter dans cet onglet.', true);
      const f = await bridge.saveText(e.nom, C.toCsv(e.rows, e.cols));
      if (f) toast('Exporté : ' + f.split(/[\\/]/).pop());
    };
    draw();
  };

  routes.article = (parts) => {
    const item = data.catalog.find(c => c.id === parts[0]);
    if (!item) return navigate('#/stock');
    const cur = company().currency;
    const st = C.stockOf(data, item.id);
    const moves = st.moves.slice().reverse();
    $('#view').innerHTML = `
      <div class="page-head"><div><h1>${h(item.label)}</h1>
        <div class="small muted">${[item.location, item.unit ? 'unité : ' + item.unit : '', item.tracked ? 'suivi en stock' : 'non suivi'].filter(Boolean).join(' · ')}</div></div>
        <div class="actions">${backButton('#/stock')}<button class="btn" id="edit-item">Modifier l'article</button>
          <button class="btn btn-primary" id="adj-item">+ Mouvement</button></div></div>
      ${st.negative ? `<div class="panel" style="border-left:3px solid var(--danger)"><h2 style="color:var(--danger)">Stock négatif</h2>
        <p class="small">D'après les pièces saisies, il en reste <b>${pct(st.qty)}</b> — ce qui est impossible. Il manque une entrée : un achat non saisi, une quantité mal recopiée, ou un stock de départ oublié. Corrige la pièce en cause plutôt que d'ajuster, sinon l'erreur restera dans les chiffres.</p></div>` : ''}
      <div class="stats">
        <div class="stat"><div class="lbl">En stock</div><div class="val ${st.negative || st.low ? 'due' : ''}">${pct(st.qty)}${st.unit ? ' ' + h(st.unit) : ''}</div><div class="sub">${st.minStock ? 'seuil d\'alerte : ' + pct(st.minStock) : 'aucun seuil défini'}</div></div>
        <div class="stat"><div class="lbl">Coût moyen pondéré ${info('stk.cmp')}</div><div class="val">${C.money(st.cmp, cur)}</div><div class="sub">recalculé à chaque entrée</div></div>
        <div class="stat"><div class="lbl">Valeur du stock</div><div class="val">${C.money(Math.max(0, st.value), cur)}</div><div class="sub">au coût moyen</div></div>
        <div class="stat"><div class="lbl">Marge unitaire</div><div class="val ${st.unitPrice - st.cmp < 0 ? 'due' : 'ok'}">${C.money(C.round3(st.unitPrice - st.cmp), cur)}</div><div class="sub">vendu ${C.money(st.unitPrice, cur)}</div></div>
      </div>
      <div class="panel"><h2>Historique des mouvements</h2>
        ${moves.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
          <th>Date</th><th>Origine</th><th>Référence</th><th class="r">Quantité</th><th class="r">Coût unitaire</th><th class="r">Stock après</th><th class="r">Coût moyen après</th><th></th></tr></thead><tbody>
          ${moves.map(m => `<tr>
            <td class="nw">${C.fmtDate(m.date)}</td>
            <td>${h(C.moveSourceLabel(m.source))}${m.note ? `<div class="small muted">${h(m.note)}</div>` : ''}</td>
            <td class="nw">${m.docId ? `<a href="${m.source === 'achat' ? '#/achat/' : '#/doc/'}${h(m.docId)}">${h(m.ref) || 'voir'}</a>` : (h(m.ref) || '<span class="muted">—</span>')}</td>
            <td class="r nw ${m.qty < 0 ? 'warn-text' : 'ok-text'}"><strong>${m.qty > 0 ? '+' : ''}${pct(m.qty)}</strong></td>
            <td class="r nw">${C.money(m.unitApplied, cur)}</td>
            <td class="r nw ${m.qtyAfter < 0 ? 'warn-text' : ''}">${pct(m.qtyAfter)}</td>
            <td class="r nw">${C.money(m.cmpAfter, cur)}</td>
            <td class="r">${m.manual ? `<button class="btn btn-sm btn-ghost" data-rm="${h(m.id)}" title="Supprimer ce mouvement">✕</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>`
          : '<div class="empty">Aucun mouvement. Le stock bougera dès qu\'un achat en destination « stock » ou une vente portera cet article.</div>'}
      </div>`;
    bindBack('#/stock');
    $('#edit-item').onclick = () => catalogForm(item, () => render());
    $('#adj-item').onclick = () => adjustForm(item.id, () => render());
    $$('[data-rm]').forEach(b => b.onclick = async () => {
      if (!await confirmDialog('Supprimer ce mouvement saisi à la main ?')) return;
      const gone3 = (data.stockAdjustments || []).find(x => x.id === b.dataset.rm);
      if (gone3 && closedBlock(gone3.date, 'Ce mouvement de stock')) return;
      forget('stockAdjustments', b.dataset.rm, item.label);
      data.stockAdjustments = data.stockAdjustments.filter(x => x.id !== b.dataset.rm);
      save(true); render();
    });
  };

  // ---------- validation de ce qui a été lu sur la photo (4.2.0) ----------
  // C'est ici que se joue la règle la plus importante du module : l'application ne remplit jamais toute
  // seule. Elle montre ce qu'elle a cru lire, signale ce qui ne colle pas, et attend un clic.
  function ocrReviewForm(read, file, done) {
    const cur = company().currency;
    // Toute la normalisation (nombres, dates, reconnaissance du fournisseur, avertissements) vit dans
    // core.js : elle est testable sans Electron, ce qui compte quand on manipule ce qu'une machine a cru lire.
    const prep = C.ocrToPurchase(read, data);
    const head = { ...prep.head, category: '' };
    let lines = prep.lines;

    const computed = () => C.round3(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
    const gapHT = () => prep.readHT == null ? null : C.round3(computed() - prep.readHT);

    modal(`<h2>Ce que SkanFact a lu</h2>
      <p class="small muted">Lu sur « ${h(file.name)} ». <b>Rien n'est encore entré dans tes données.</b> Vérifie, corrige si besoin, puis valide — l'écran d'achat s'ouvrira pré-rempli et tu pourras encore tout changer.</p>
      <div id="ocr-warn"></div>
      <form id="orf" class="grid-2">
        <div class="field span-2">${lbl('Fournisseur', 'ocr.supplier')}
          ${combo({ name: 'supplierId', value: head.supplierId, items: data.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(x => ({ v: x.id, label: x.name, sub: x.matricule || '', text: `${x.name} ${x.matricule || ''}` })), placeholder: '— À choisir —', search: 'Rechercher un fournisseur…', add: head.supplierName && !head.supplierId ? `+ Créer « ${h(head.supplierName)} »` : '+ Nouveau fournisseur' })}
        </div>
        ${field('Numéro de la facture', 'number', head.number, 'text', '')}
        ${dateFieldHtml('Date', 'date', head.date, {})}
        ${dateFieldHtml('Échéance', 'dueDate', head.dueDate, { clearable: true })}
        ${field('Timbre et frais', 'fees', head.fees, 'number', 'step="0.001" min="0" class="num"')}
        <label class="field span-2">Objet<input type="text" name="subject" value="${h(head.subject)}"></label>
        <div class="field span-2">Catégorie de charge
          ${combo({ name: 'category', value: '', items: C.expenseCategories(data).map(c => ({ v: c, label: c })), placeholder: '— À choisir —', search: 'Rechercher une catégorie…' })}
        </div>
      </form>
      <div class="panel"><h2>Lignes lues</h2>
        <table class="lines-edit buy-lines"><thead><tr><th>Désignation</th><th style="width:70px">Qté</th><th style="width:100px">P.U. HT</th><th style="width:80px">TVA</th><th class="r">Total HT</th><th></th></tr></thead>
          <tbody id="orf-lines"></tbody></table>
        <div class="inline mt"><button type="button" class="btn btn-sm" id="orf-add">+ Ligne</button>
          <span class="small muted" id="orf-sum"></span></div>
      </div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Utiliser ces informations</button></div>`,
      (root, close) => {
        const supCombo = bindCombo($('[data-combo=supplierId]', root), {
          items: data.suppliers.map(x => ({ v: x.id, label: x.name, text: x.name })), placeholder: '— À choisir —',
          onAdd: () => supplierForm(null, sup => {
            supCombo.setItems(data.suppliers.map(x => ({ v: x.id, label: x.name, text: x.name })));
            supCombo.setValue(sup.id);
          }, head.supplierName && !head.supplierId ? { name: head.supplierName, matricule: head.matricule || '' } : null)
        });
        bindCombo($('[data-combo=category]', root), { items: C.expenseCategories(data).map(c => ({ v: c, label: c })), placeholder: '— À choisir —' });
        bindDateFields(root);

        const drawLines = () => {
          $('#orf-lines', root).innerHTML = lines.map((l, i) => `<tr data-i="${i}">
            <td><input type="text" data-k="label" value="${h(l.label)}"></td>
            <td><input type="number" class="num" data-k="qty" value="${l.qty}" step="0.01"></td>
            <td><input type="number" class="num" data-k="unitPrice" value="${l.unitPrice}" step="0.001"></td>
            <td><select data-k="vatRate">${C.VAT_RATES.map(r => `<option value="${r}" ${Number(l.vatRate) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select></td>
            <td class="total">${C.money(C.round3(l.qty * l.unitPrice), cur)}</td>
            <td class="line-tools"><button type="button" class="btn btn-ghost btn-sm" data-rm="${i}" title="Supprimer">✕</button></td></tr>`).join('');
          $$('[data-k]', $('#orf-lines', root)).forEach(el => el.oninput = el.onchange = () => {
            const i = Number(el.closest('tr').dataset.i);
            lines[i][el.dataset.k] = el.type === 'number' || el.dataset.k === 'vatRate' ? Number(el.value) : el.value;
            drawLines();
          });
          $$('[data-rm]', $('#orf-lines', root)).forEach(b => b.onclick = () => { lines.splice(Number(b.dataset.rm), 1); if (!lines.length) lines.push({ label: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19, destination: 'charge', deductible: true }); drawLines(); });
          const g = gapHT();
          $('#orf-sum', root).innerHTML = `Total des lignes : <b>${C.money(computed(), cur)}</b> HT`
            + (prep.readHT != null ? ` · total lu sur la pièce : ${C.money(prep.readHT, cur)}` : '');
          $('#ocr-warn', root).innerHTML = [
            !$('input[name=supplierId]', root).value ? 'Aucun fournisseur reconnu : choisis-le, ou crée-le depuis la liste.' : '',
            g != null && Math.abs(g) > 0.005 ? `Les lignes lues totalisent ${C.money(computed(), cur)} alors que la pièce annonce ${C.money(prep.readHT, cur)} : un écart de ${C.money(g, cur)}. Corrige avant de valider.` : '',
            !read.number ? 'Aucun numéro de facture lu : saisis-le, il est obligatoire pour la déduction de TVA.' : ''
          ].filter(Boolean).map(m => `<p class="small warn-text">${m}</p>`).join('');
        };
        drawLines();
        $('#orf-add', root).onclick = () => { lines.push({ label: '', qty: 1, unit: '', unitPrice: 0, vatRate: 19, destination: 'charge', deductible: true }); drawLines(); };
        $('#orf', root).oninput = $('#orf', root).onchange = drawLines;
        $('#ok', root).onclick = () => {
          const v = formValues($('#orf', root));
          if (!v.supplierId) return toast('Choisis le fournisseur : sans lui, l\'achat n\'est rattaché à personne.', true);
          close();
          done({ head: { supplierId: v.supplierId, number: v.number || '', date: v.date || C.today(), dueDate: v.dueDate || '',
            subject: v.subject || '', category: v.category || '', fees: Number(v.fees) || 0 }, lines });
        };
      });
  }

  // ---------- Numéros de série et garanties (4.1.0) ----------
  const serialById = id => data.serials.find(x => x.id === id);

  // Entrée : on colle une liste de numéros, un par ligne. Coller vaut mieux que saisir vingt fois.
  function serialIntakeForm(itemId, done) {
    const items = C.serializedItems(data);
    // Un refus qui nomme un geste sans le proposer oblige à traverser l'application de mémoire.
    if (!items.length) {
      return modal(`<h2>Aucun article suivi par numéro</h2>
        <p>Pour saisir des numéros de série, il faut d'abord dire quelle prestation se suit unité par unité.</p>
        <p class="small muted">Une case à cocher sur la fiche de l'article, dans le Catalogue. Elle active aussi le suivi en stock, dont elle dépend.</p>
        <div class="modal-actions"><button class="btn" data-close>Plus tard</button>
          <button class="btn btn-primary" id="ser-go">${data.catalog.length ? 'Choisir une prestation…' : 'Créer une prestation suivie'}</button></div>`,
        (root, close) => {
          $('#ser-go', root).onclick = () => {
            close();
            if (data.catalog.length) navigate('#/catalogue');
            else catalogForm(null, () => render());
          };
        });
    }
    const first = itemId && items.some(c => c.id === itemId) ? itemId : items[0].id;
    modal(`<h2>Entrée de numéros de série</h2>
      <p class="small muted">Un numéro par ligne. Tu peux les coller depuis un bon de livraison fournisseur ou un fichier : SkanFact ignore les lignes vides et refuse les doublons.</p>
      <form id="sif" class="grid-2">
        <div class="field">Article
          ${combo({ name: 'itemId', value: first, items: items.map(c => ({ v: c.id, label: c.label, sub: c.unit || '', text: c.label })), placeholder: '— Choisir un article —', search: 'Rechercher un article…' })}
        </div>
        ${dateFieldHtml(lbl('Date d\'entrée', 'ser.inDate'), 'inDate', C.today(), {})}
        <div class="field span-2">Facture d'achat (optionnel)
          ${combo({ name: 'inPurchaseId', value: '', items: data.purchases.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 200).map(p => ({ v: p.id, label: p.number || 'sans numéro', sub: `${C.fmtDate(p.date)} · ${supplierName(p.supplierId)}`, text: `${p.number || ''} ${supplierName(p.supplierId)}` })), placeholder: '— Aucune —', search: 'Rechercher une facture d\'achat…' })}
        </div>
        <label class="field span-2">Numéros de série<textarea name="list" rows="8" placeholder="SN-2026-0001&#10;SN-2026-0002&#10;SN-2026-0003"></textarea></label>
        <div class="field span-2" id="sif-hint"></div>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        bindCombo($('[data-combo=itemId]', root), { items: items.map(c => ({ v: c.id, label: c.label, text: c.label })), placeholder: '— Choisir un article —' });
        bindCombo($('[data-combo=inPurchaseId]', root), { items: data.purchases.map(p => ({ v: p.id, label: p.number || 'sans numéro', text: p.number || '' })), placeholder: '— Aucune —' });
        const parse = () => (formValues($('#sif', root)).list || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        const hint = () => {
          const v = formValues($('#sif', root));
          const nums = parse();
          const known = new Set(data.serials.filter(x => x.itemId === v.itemId).map(x => (x.serial || '').toLowerCase()));
          const dbl = nums.filter(x => known.has(x.toLowerCase()));
          const item = data.catalog.find(c => c.id === v.itemId) || {};
          $('#sif-hint', root).innerHTML = `<span class="small ${dbl.length ? 'warn-text' : 'muted'}">`
            + (nums.length ? `${nums.length} numéro(s) à enregistrer${item.warrantyMonths ? `, garantie de ${item.warrantyMonths} mois` : ', sans garantie'}.` : 'Colle ou saisis au moins un numéro.')
            + (dbl.length ? ` ${dbl.length} déjà connu(s) et ignoré(s) : ${dbl.slice(0, 5).join(', ')}.` : '') + '</span>';
        };
        $('#sif', root).oninput = $('#sif', root).onchange = hint; hint();
        $('#ok', root).onclick = () => {
          const v = formValues($('#sif', root));
          const nums = parse();
          if (!v.itemId) return toast('Choisis un article.', true);
          if (!nums.length) return toast('Saisis au moins un numéro de série.', true);
          const item = data.catalog.find(c => c.id === v.itemId) || {};
          const known = new Set(data.serials.filter(x => x.itemId === v.itemId).map(x => (x.serial || '').toLowerCase()));
          let added = 0;
          nums.forEach(num => {
            if (known.has(num.toLowerCase())) return;
            known.add(num.toLowerCase());
            data.serials.push({ id: C.uid(), itemId: v.itemId, serial: num, status: 'stock',
              inDate: v.inDate || C.today(), inPurchaseId: v.inPurchaseId || '', clientId: '', outDate: '', outDocId: '',
              warrantyMonths: Number(item.warrantyMonths) || 0, notes: '' });
            added++;
          });
          save(true); close();
          toast(added ? `${added} numéro(s) enregistré(s)` : 'Tous ces numéros étaient déjà connus', !added);
          if (done) done();
        };
      });
  }

  // Sortie : attribuer des unités à un client, avec la garantie qui démarre ce jour-là.
  function serialAssignForm(doc, done) {
    const lines = (doc.lines || []).map(l => ({ l, item: C.itemOfLine(l, data) }))
      .filter(x => x.item && x.item.serialized);
    if (!lines.length) return toast('Aucune ligne de ce document ne porte un article suivi par numéro de série.', true);
    const cur = company().currency;
    const chosen = {};                       // itemId → Set d'identifiants
    const draw = (root) => {
      const body = $('#sa-body', root);
      body.innerHTML = lines.map(({ l, item }) => {
        const need = Number(l.qty) || 0;
        const avail = C.availableSerials(data, item.id);
        const already = data.serials.filter(x => x.outDocId === doc.id && x.itemId === item.id);
        const picked = chosen[item.id] || new Set(already.map(x => x.id));
        chosen[item.id] = picked;
        return `<div class="panel"><h2>${h(item.label)}</h2>
          <p class="small muted mb">${pct(need)} unité(s) sur ce document.</p>
          ${avail.length || already.length ? `<div class="scroll-x"><table class="list compact"><thead><tr><th></th><th>Numéro</th><th>Entré le</th><th>État</th></tr></thead><tbody>
            ${already.concat(avail).map(x => `<tr>
              <td><input type="checkbox" data-pick="${h(x.id)}" data-item="${h(item.id)}" ${picked.has(x.id) ? 'checked' : ''}></td>
              <td><strong>${h(x.serial)}</strong></td><td class="nw">${C.fmtDate(x.inDate)}</td>
              <td>${x.outDocId === doc.id ? '<span class="ok-text">déjà attribué à ce document</span>' : C.serialStatusLabel(x.status)}</td></tr>`).join('')}
          </tbody></table></div>
          <p class="small ${picked.size === need ? 'muted' : 'warn-text'}">${picked.size} sélectionné(s) sur ${pct(need)} attendu(s).${item.warrantyMonths ? ` Garantie de ${item.warrantyMonths} mois à compter du ${C.fmtDate(doc.date)}.` : ' Aucune garantie définie sur cet article.'}</p>`
            : '<div class="empty">Aucune unité disponible en stock pour cet article. Saisis d\'abord les numéros entrés, depuis la page Stock.</div>'}
        </div>`;
      }).join('');
      $$('[data-pick]', body).forEach(cb => cb.onchange = () => {
        const set = chosen[cb.dataset.item];
        if (cb.checked) set.add(cb.dataset.pick); else set.delete(cb.dataset.pick);
        draw(root);
      });
    };
    modal(`<h2>Numéros de série de ${h(doc.number || 'ce document')}</h2>
      <p class="small muted">Coche les unités effectivement livrées. Leur garantie démarre à la date du document (${C.fmtDate(doc.date)}), et elles apparaîtront dans le parc de ${h(clientName(doc.clientId) || 'ce client')}.</p>
      <div id="sa-body"></div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Attribuer</button></div>`,
      (root, close) => {
        draw(root);
        $('#ok', root).onclick = () => {
          const keep = new Set();
          Object.keys(chosen).forEach(k => chosen[k].forEach(id => keep.add(id)));
          // Ce qui était attribué à ce document et ne l'est plus revient en stock.
          data.serials.forEach(x => {
            if (x.outDocId === doc.id && !keep.has(x.id)) {
              x.status = 'stock'; x.outDate = ''; x.outDocId = ''; x.clientId = '';
            }
          });
          keep.forEach(id => {
            const x = serialById(id); if (!x) return;
            x.status = 'vendu'; x.outDate = doc.date; x.outDocId = doc.id; x.clientId = doc.clientId || '';
            const item = data.catalog.find(c => c.id === x.itemId);
            if (item && !x.warrantyMonths) x.warrantyMonths = Number(item.warrantyMonths) || 0;
          });
          save(true); close(); toast(`${keep.size} numéro(s) attribué(s)`);
          if (done) done();
        };
      });
  }

  function serialForm(serial, done) {
    const x = serial;
    modal(`<h2>${h(x.serial)}</h2>
      <form id="sef" class="grid-2">
        <label class="field span-2">Numéro de série<input type="text" name="serial" value="${h(x.serial)}"></label>
        <label class="field">${lbl('État', 'ser.status')}<select name="status">${C.SERIAL_STATUSES.map(([v, l]) => `<option value="${v}" ${x.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">${lbl('Garantie', 'ser.warranty')}<select name="warrantyMonths">${C.WARRANTY_CHOICES.map(m => `<option value="${m}" ${Number(x.warrantyMonths) === m ? 'selected' : ''}>${m ? m + ' mois' : 'Aucune'}</option>`).join('')}</select></label>
        ${dateFieldHtml('Entré le', 'inDate', x.inDate || '', { clearable: true })}
        ${dateFieldHtml(lbl('Sorti le', 'ser.outDate'), 'outDate', x.outDate || '', { clearable: true })}
        <div class="field span-2">Client
          ${combo({ name: 'clientId', value: x.clientId || '', items: clientItems(), placeholder: '— Aucun —', search: 'Rechercher un client…' })}
        </div>
        <label class="field span-2">Notes<input type="text" name="notes" value="${h(x.notes || '')}"></label>
        <div class="field span-2" id="sef-hint"></div>
      </form>
      <div class="modal-actions">
        <button class="btn btn-danger" id="del-ser" style="margin-right:auto">Supprimer</button>
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        bindCombo($('[data-combo=clientId]', root), { items: clientItems(), placeholder: '— Aucun —' });
        const hint = () => {
          const v = formValues($('#sef', root));
          const end = C.warrantyEnd({ outDate: v.outDate, warrantyMonths: Number(v.warrantyMonths) || 0 });
          $('#sef-hint', root).innerHTML = `<span class="small muted">${end
            ? `Garantie jusqu'au <b>${C.fmtDate(end)}</b>${end < C.today() ? ' — déjà expirée' : ''}.`
            : 'Pas de garantie en cours : il faut une date de sortie et une durée.'}</span>`;
        };
        $('#sef', root).oninput = $('#sef', root).onchange = hint; hint();
        $('#ok', root).onclick = () => {
          const v = formValues($('#sef', root));
          if (!(v.serial || '').trim()) return toast('Le numéro ne peut pas être vide.', true);
          Object.assign(x, v, { warrantyMonths: Number(v.warrantyMonths) || 0 });
          if (x.status === 'stock') { x.outDate = ''; x.outDocId = ''; x.clientId = ''; }
          save(true); close(); if (done) done();
        };
        $('#del-ser', root).onclick = async () => {
          if (!await confirmDialog(`Supprimer le numéro ${x.serial} ? Son historique sera perdu.`)) return;
          forget('serials', x.id, x.serial);
          data.serials = data.serials.filter(y => y.id !== x.id);
          save(true); close(); if (done) done();
        };
      });
  }

  const garState = { days: 90, page: 1 };
  routes.garanties = () => {
    const rows = C.warrantiesEnding(data, garState.days);
    const expired = C.serialList(data, { status: 'vendu' }).filter(x => x.expired);
    $('#view').innerHTML = `
      <div class="page-head"><h1>Garanties</h1>
        <div class="actions">${backButton('#/stock')}
          <select id="g-days">${[30, 60, 90, 180, 365].map(d => `<option value="${d}" ${garState.days === d ? 'selected' : ''}>${d} jours</option>`).join('')}</select>
        </div></div>
      <div class="panel"><h2>Garanties qui se terminent ${info('ser.ending')}</h2>
        <p class="small muted mb">Une fin de garantie n'est pas une mauvaise nouvelle : c'est le moment naturel de proposer un contrat de maintenance. Le client y pense rarement tout seul.</p>
        ${rows.length ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Fin</th><th>Dans</th><th>Article</th><th>Numéro</th><th>Client</th><th>Livré le</th><th></th></tr></thead><tbody>
          ${rows.map(x => `<tr class="${x.warrantyDays <= 30 ? 'row-warn' : ''}">
            <td class="nw"><strong>${C.fmtDate(x.warrantyEndDate)}</strong></td>
            <td class="nw">${x.warrantyDays} jour${x.warrantyDays > 1 ? 's' : ''}</td>
            <td>${h(x.itemLabel)}</td><td class="nw">${h(x.serial)}</td>
            <td>${x.clientId ? `<a href="#/client/${h(x.clientId)}">${h(x.clientName)}</a>` : '<span class="muted">—</span>'}</td>
            <td class="nw">${C.fmtDate(x.outDate)}</td>
            <td class="r">${x.clientId ? `<button class="btn btn-sm" data-quote="${h(x.clientId)}">Proposer un contrat</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>`
          : `<div class="empty">Aucune garantie ne se termine dans les ${garState.days} prochains jours.</div>`}
      </div>
      ${expired.length ? `<div class="panel"><h2>Déjà hors garantie <span class="small muted">(${expired.length})</span></h2>
        <div class="scroll-x"><table class="list compact"><thead><tr><th>Article</th><th>Numéro</th><th>Client</th><th>Livré le</th><th>Garantie expirée le</th></tr></thead><tbody>
          ${expired.slice(0, 30).map(x => `<tr><td>${h(x.itemLabel)}</td><td class="nw">${h(x.serial)}</td>
            <td>${x.clientId ? `<a href="#/client/${h(x.clientId)}">${h(x.clientName)}</a>` : '<span class="muted">—</span>'}</td>
            <td class="nw">${C.fmtDate(x.outDate)}</td><td class="nw">${C.fmtDate(x.warrantyEndDate)}</td></tr>`).join('')}
        </tbody></table></div>
        ${expired.length > 30 ? `<p class="small muted mt">30 affichés sur ${expired.length}.</p>` : ''}</div>` : ''}`;
    bindBack('#/stock');
    $('#g-days').onchange = e => { garState.days = Number(e.target.value); render(); };
    $$('[data-quote]').forEach(b => b.onclick = () => navigate('#/doc/new/devis/client/' + b.dataset.quote));
  };

  // ---------- Immobilisations et amortissements (3.5.0) ----------
  const assetById = id => data.assets.find(a => a.id === id);
  // `supplierItems` vit dans l'éditeur d'achat : ici on refait la liste, sans la sortir de son contexte.
  const supItems = () => data.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(x => ({ v: x.id, label: x.name, sub: x.contact || '', text: `${x.name} ${x.contact || ''}` }));

  function assetForm(asset, done, preset) {
    const a = asset || Object.assign({ id: C.uid(), label: '', category: 'informatique', date: C.today(), amount: 0,
      residual: 0, years: C.assetClassYears('informatique'), supplierId: '', purchaseId: '', lineIndex: null, notes: '' }, preset || {});
    modal(`<h2>${asset ? 'Modifier l\'immobilisation' : 'Nouvelle immobilisation'}</h2>
      <p class="small muted">Un bien qui reste dans l'entreprise ne se déduit pas d'un coup : il se déduit un peu chaque année, pendant sa durée d'usage. <em>À VÉRIFIER avec ton comptable : la durée dépend de la nature du bien.</em></p>
      <form id="imf" class="grid-2">
        <label class="field span-2">Désignation<input type="text" name="label" value="${h(a.label)}" placeholder="Ordinateur portable du bureau"></label>
        <label class="field">${lbl('Famille', 'immo.class')}<select name="category">${C.DEFAULT_ASSET_CLASSES.map(([v, l]) => `<option value="${v}" ${a.category === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${dateFieldHtml(lbl('Mise en service', 'immo.date'), 'date', a.date, {})}
        ${field(lbl('Valeur d\'acquisition HT', 'immo.amount'), 'amount', a.amount || 0, 'number', 'step="0.001" min="0" class="num"')}
        ${field(lbl('Durée (années)', 'immo.years'), 'years', a.years || 0, 'number', 'step="1" min="1" max="50" class="num"')}
        ${field(lbl('Valeur résiduelle', 'immo.residual'), 'residual', a.residual || 0, 'number', 'step="0.001" min="0" class="num"')}
        <div class="field">Fournisseur
          ${combo({ name: 'supplierId', value: a.supplierId || '', items: supItems(), placeholder: '— Aucun —', search: 'Rechercher un fournisseur…' })}
        </div>
        <div class="field span-2" id="amort-hint"></div>
        <label class="field span-2">Notes<input type="text" name="notes" value="${h(a.notes || '')}"></label>
      </form>
      <div class="modal-actions">
        ${asset ? '<button class="btn btn-danger" id="del-imm" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        bindCombo($('[data-combo=supplierId]', root), { items: supItems(), placeholder: '— Aucun —' });
        // La famille propose sa durée usuelle, mais ne l'impose pas : si l'utilisateur a déjà touché
        // le champ, on ne l'écrase pas derrière son dos.
        let yearsTouched = !!asset;
        $('input[name=years]', root).oninput = () => { yearsTouched = true; };
        const hint = () => {
          const v = formValues($('#imf', root));
          const draft = { ...a, ...v, amount: Number(v.amount) || 0, residual: Number(v.residual) || 0, years: Number(v.years) || 0 };
          const rows = C.assetSchedule(draft);
          const el = $('#amort-hint', root);
          if (!rows.length) { el.innerHTML = '<span class="small muted">Renseigne une valeur, une durée et une date de mise en service pour voir le plan d\'amortissement.</span>'; return; }
          const cur = company().currency;
          el.innerHTML = `<span class="small muted">Plan sur ${rows.length} exercice(s) — ${rows.slice(0, 4).map(r => `<b>${r.year}</b> : ${C.money(r.annuity, cur)}`).join(' · ')}${rows.length > 4 ? ' · …' : ''}</span>`;
        };
        $('select[name=category]', root).onchange = e => {
          if (!yearsTouched) $('input[name=years]', root).value = C.assetClassYears(e.target.value);
          hint();
        };
        $('#imf', root).oninput = hint; hint();
        $('#ok', root).onclick = () => {
          const v = formValues($('#imf', root));
          if (!v.label.trim()) return toast('Donne un nom à ce bien.', true);
          if (!(Number(v.amount) > 0)) return toast('La valeur d\'acquisition doit être supérieure à zéro.', true);
          if (!(Number(v.years) > 0)) return toast('La durée d\'amortissement doit être d\'au moins un an.', true);
          if (Number(v.residual) >= Number(v.amount)) return toast('La valeur résiduelle doit rester inférieure à la valeur d\'acquisition.', true);
          if (!v.date) return toast('Date de mise en service invalide.', true);
          if (closedBlock([a.date, v.date], 'Ce bien')) return;
          Object.assign(a, v, { amount: Number(v.amount), residual: Number(v.residual) || 0, years: Number(v.years) });
          if (!asset) data.assets.push(a);
          save(true); close(); if (done) done(a);
        };
        if ($('#del-imm', root)) $('#del-imm', root).onclick = async () => {
          if (!await confirmDialog(`Supprimer « ${a.label} » ?${a.purchaseId ? ' La ligne d\'achat correspondante repassera dans « À immobiliser ».' : ''} L\'achat lui-même n\'est pas touché.`)) return;
          if (closedBlock([a.date, a.disposal && a.disposal.date], 'Ce bien')) return;
          forget('assets', a.id, a.label);
          data.assets = data.assets.filter(x => x.id !== a.id);
          save(true); close(); navigate('#/immos');
        };
      });
  }

  // Céder un bien moins de cinq ans après son acquisition peut obliger à reverser une part de la TVA
  // récupérée à l'achat. SkanFact ne calcule rien : il rappelle la question au bon moment.
  const vatWarning = (asset, dateIso) => {
    if (!asset.date || !dateIso || dateIso < asset.date) return '';
    if (C.days360(asset.date, dateIso) >= 5 * 360) return '';
    const held = Math.max(1, Math.round(C.days360(asset.date, dateIso) / 30));
    return `Ce bien n'aura été détenu que ${held} mois. Une cession avant cinq ans peut imposer de reverser une partie de la TVA récupérée à l'achat — <em>À VÉRIFIER avec ton comptable avant de conclure la vente.</em>`;
  };

  function disposalForm(asset, done) {
    const d = { ...(asset.disposal || { date: C.today(), amount: 0, reason: '' }) };
    const cur = company().currency;
    modal(`<h2>Sortie de « ${h(asset.label)} »</h2>
      <p class="small muted">Vendu, mis au rebut ou volé : le bien quitte l'actif. On amortit jusqu'au jour de la sortie, puis on compare le prix obtenu à ce qu'il valait encore dans les comptes.</p>
      <form id="dsf" class="grid-2">
        ${dateFieldHtml('Date de sortie', 'date', d.date, {})}
        ${field(lbl('Prix de cession HT', 'immo.disposalPrice'), 'amount', d.amount || 0, 'number', 'step="0.001" min="0" class="num"')}
        <label class="field span-2">Motif<input type="text" name="reason" value="${h(d.reason || '')}" placeholder="Revendu, mis au rebut, volé…"></label>
        <div class="field span-2" id="dsf-hint"></div>
      </form>
      <div class="modal-actions">
        ${asset.disposal ? '<button class="btn btn-danger" id="undo-dis" style="margin-right:auto">Annuler la sortie</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer la sortie</button></div>`,
      (root, close) => {
        const hint = () => {
          const v = formValues($('#dsf', root));
          const r = C.disposalResult({ ...asset, disposal: { date: v.date, amount: Number(v.amount) || 0 } });
          const el = $('#dsf-hint', root);
          if (!r) { el.innerHTML = ''; return; }
          el.innerHTML = `<span class="small">Valeur nette comptable au ${C.fmtDate(r.date)} : <b>${C.money(r.nbv, cur)}</b> — `
            + (r.result >= 0
              ? `<span class="ok-text">plus-value de ${C.money(r.result, cur)}</span>`
              : `<span class="warn-text">moins-value de ${C.money(-r.result, cur)}</span>`)
            + `. <em>À VÉRIFIER avec ton comptable : le traitement fiscal de cette plus-value.</em></span>`
            + (vatWarning(asset, v.date) ? `<div class="small warn-text mt">${vatWarning(asset, v.date)}</div>` : '');
        };
        $('#dsf', root).oninput = hint; hint();
        $('#ok', root).onclick = async () => {
          const v = formValues($('#dsf', root));
          if (!v.date) return toast('Date de sortie invalide.', true);
          if (v.date < asset.date) return toast('La sortie ne peut pas précéder la mise en service.', true);
          if (v.date > C.today() && !await confirmDialog(`La date (${C.fmtDate(v.date)}) est dans le futur. Enregistrer quand même ?`, 'Enregistrer')) return;
          if (closedBlock([asset.disposal && asset.disposal.date, v.date], 'Cette sortie')) return;
          asset.disposal = { date: v.date, amount: Number(v.amount) || 0, reason: v.reason || '' };
          save(true); close(); if (done) done(asset);
        };
        if ($('#undo-dis', root)) $('#undo-dis', root).onclick = async () => {
          if (!await confirmDialog('Remettre ce bien à l\'actif ? L\'amortissement reprendra comme s\'il n\'était jamais sorti.')) return;
          if (closedBlock(asset.disposal && asset.disposal.date, 'Cette sortie')) return;
          delete asset.disposal; save(true); close(); if (done) done(asset);
        };
      });
  }

  const immoState = { tab: 'tableau', year: C.today().slice(0, 4) };
  const IMMO_TABS = [['tableau', 'Tableau des amortissements'], ['attente', 'À immobiliser'], ['sorties', 'Sorties et cessions']];

  routes.immos = () => {
    const cur = company().currency;
    const s = immoState;
    const years = Array.from(new Set(data.assets.map(a => (a.date || '').slice(0, 4)).filter(Boolean)
      .concat([C.today().slice(0, 4)]))).sort().reverse();
    if (!years.includes(s.year)) s.year = years[0];
    const waiting = C.assetsToCreate(data);

    $('#view').innerHTML = `
      <div class="page-head"><h1>Immobilisations</h1>
        <div class="actions">
          <select id="im-year" ${s.tab === 'attente' ? 'hidden' : ''}>${years.map(y => `<option ${y === s.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <button class="btn" id="im-csv">Exporter en CSV</button>
          <button class="btn btn-primary" id="new-imm">+ Nouveau bien</button>
        </div></div>
      <div class="tabs" id="im-tabs" role="tablist">${IMMO_TABS.map(([id, label]) =>
        `<button role="tab" data-tab="${id}" class="${id === s.tab ? 'active' : ''}">${label}${id === 'attente' && waiting.length ? ` <span class="nav-count">${waiting.length}</span>` : ''}</button>`).join('')}</div>
      <div id="im-body"></div>`;

    function drawTable() {
      const y = Number(s.year);
      const t = C.assetTotals(data, y);
      $('#im-body').innerHTML = `
        <div class="stats">
          <div class="stat"><div class="lbl">Valeur d'acquisition ${info('immo.gross')}</div><div class="val">${C.money(t.gross, cur)}</div><div class="sub">${t.count} bien(s) à l'actif</div></div>
          <div class="stat"><div class="lbl">Dotation ${s.year} ${info('immo.annuity')}</div><div class="val">${C.money(t.annuity, cur)}</div><div class="sub">la charge de l'exercice</div></div>
          <div class="stat"><div class="lbl">Amortissement cumulé</div><div class="val">${C.money(t.cumulated, cur)}</div><div class="sub">depuis l'origine</div></div>
          <div class="stat"><div class="lbl">Valeur nette comptable ${info('immo.nbv')}</div><div class="val">${C.money(t.nbv, cur)}</div><div class="sub">ce qu'il reste à amortir</div></div>
        </div>
        <div class="panel"><h2>Tableau des amortissements — ${s.year} ${info('immo.table')}</h2>
          ${t.rows.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
            <th>Bien</th><th>Famille</th><th class="r">Mise en service</th><th class="r">Durée</th>
            <th class="r">Valeur HT</th><th class="r">Cumul au 01/01</th><th class="r">Dotation ${s.year} ${info('immo.annuity')}</th><th class="r">Cumul au 31/12</th><th class="r">VNC ${info('immo.nbv')}</th></tr></thead><tbody>
            ${t.rows.map(a => `<tr class="clickable" data-aid="${h(a.id)}">
              <td><strong>${h(a.label)}</strong>${a.out ? `<div class="small warn-text">sorti le ${C.fmtDate(a.disposalResult.date)}</div>` : ''}</td>
              <td>${h(C.assetClassLabel(a.category))}</td>
              <td class="r nw">${C.fmtDate(a.date)}</td>
              <td class="r nw">${a.years} an${a.years > 1 ? 's' : ''}</td>
              <td class="r nw">${C.money(a.amount, cur)}</td>
              <td class="r nw">${C.money(a.opening, cur)}</td>
              <td class="r nw"><strong>${C.money(a.annuity, cur)}</strong></td>
              <td class="r nw">${C.money(a.cumulated, cur)}</td>
              <td class="r nw">${a.out ? '<span class="muted">—</span>' : C.money(a.nbv, cur)}</td></tr>`).join('')}
            <tr class="total-row"><td colspan="4"><strong>Total</strong></td>
              <td class="r"><strong>${C.money(t.gross, cur)}</strong></td>
              <td class="r"><strong>${C.money(t.opening, cur)}</strong></td>
              <td class="r"><strong>${C.money(t.annuity, cur)}</strong></td>
              <td class="r"><strong>${C.money(t.cumulated, cur)}</strong></td>
              <td class="r"><strong>${C.money(t.nbv, cur)}</strong></td></tr>
          </tbody></table></div>
          <p class="small muted mt">Amortissement linéaire, au prorata du nombre de jours d'utilisation la première année (base 360). La dotation de l'exercice est une <b>charge</b> : elle est déjà comptée dans le résultat simplifié et dans le seuil de rentabilité. <em>À VÉRIFIER avec ton comptable : les durées retenues et la règle de prorata.</em></p>`
            : '<div class="empty">Aucune immobilisation pour cet exercice. Un bien qui reste dans l\'entreprise — ordinateur, véhicule, mobilier — se saisit ici, ou se crée depuis l\'onglet « À immobiliser » à partir d\'une ligne d\'achat.</div>'}
        </div>`;
      $$('#im-body tr[data-aid]').forEach(tr => tr.onclick = () => navigate('#/immo/' + tr.dataset.aid));
    }

    function drawWaiting() {
      $('#im-body').innerHTML = `
        <div class="panel"><h2>Lignes d'achat à immobiliser ${info('immo.waiting')}</h2>
          <p class="small muted mb">Ces lignes ont été saisies avec la destination « immobilisation ». SkanFact ne crée pas leur fiche tout seul : la durée d'amortissement est une décision, pas une donnée.</p>
          ${waiting.length ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Date</th><th>Fournisseur</th><th>Désignation</th><th class="r">Valeur HT</th><th></th></tr></thead><tbody>
            ${waiting.map((w, i) => `<tr><td class="nw">${C.fmtDate(w.date)}</td>
              <td>${h(supplierName(w.supplierId))}${w.number ? `<div class="small muted">${h(w.number)}</div>` : ''}</td>
              <td>${h(w.label)}</td><td class="r nw">${C.money(w.amount, cur)}</td>
              <td class="r"><button class="btn btn-sm btn-primary" data-mk="${i}">Créer la fiche</button>
                <button class="btn btn-sm btn-ghost" data-open="${h(w.purchaseId)}">Voir l'achat</button></td></tr>`).join('')}
          </tbody></table></div>`
            : (data.purchases || []).length
              ? '<div class="empty">Rien en attente. Toutes les lignes d\'achat marquées « immobilisation » ont leur fiche.</div>'
              : etatVide('Rien à immobiliser pour l\'instant',
                  ['Une ligne apparaît ici dès que tu saisis un achat dont la destination est <b>« immobilisation »</b> : un ordinateur, un véhicule, du mobilier — tout ce que tu gardes plus d\'un an.',
                   'Tant qu\'une ligne reste en attente, son amortissement n\'est déduit nulle part.'],
                  [['immo-vers-achats', '+ Saisir une facture d\'achat', true]])}
        </div>`;
      if ($('#immo-vers-achats')) $('#immo-vers-achats').onclick = () => navigate('#/achat/new');
      $$('#im-body [data-mk]').forEach(b => b.onclick = () => {
        const w = waiting[Number(b.dataset.mk)];
        assetForm(null, () => render(), { label: w.label, amount: w.amount, date: w.date, supplierId: w.supplierId, purchaseId: w.purchaseId, lineIndex: w.lineIndex });
      });
      $$('#im-body [data-open]').forEach(b => b.onclick = () => navigate('#/achat/' + b.dataset.open));
    }

    function drawDisposals() {
      const y = Number(s.year);
      const rows = data.assets.map(a => ({ a, d: C.disposalResult(a) }))
        .filter(x => x.d && Number(x.d.date.slice(0, 4)) === y)
        .sort((x, z) => z.d.date.localeCompare(x.d.date));
      const gain = C.round3(rows.reduce((t, x) => t + Math.max(0, x.d.result), 0));
      const loss = C.round3(rows.reduce((t, x) => t + Math.min(0, x.d.result), 0));
      $('#im-body').innerHTML = `
        <div class="panel"><h2>Sorties de ${s.year} ${info('immo.disposal')}</h2>
          ${rows.length ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Date</th><th>Bien</th><th>Motif</th><th class="r">Valeur HT</th><th class="r">VNC à la sortie</th><th class="r">Prix obtenu</th><th class="r">Résultat</th></tr></thead><tbody>
            ${rows.map(({ a, d }) => `<tr class="clickable" data-aid="${h(a.id)}">
              <td class="nw">${C.fmtDate(d.date)}</td><td><strong>${h(a.label)}</strong></td><td>${h(d.reason) || '<span class="muted">—</span>'}</td>
              <td class="r nw">${C.money(a.amount, cur)}</td><td class="r nw">${C.money(d.nbv, cur)}</td><td class="r nw">${C.money(d.price, cur)}</td>
              <td class="r nw ${d.result < 0 ? 'warn-text' : 'ok-text'}"><strong>${C.money(d.result, cur)}</strong></td></tr>`).join('')}
          </tbody></table></div>
          <p class="small mt">Plus-values : <b class="ok-text">${C.money(gain, cur)}</b> · Moins-values : <b class="warn-text">${C.money(loss, cur)}</b>.
          <em>À VÉRIFIER avec ton comptable : une plus-value de cession est en principe imposable, une moins-value déductible.</em></p>`
            : '<div class="empty">Aucune sortie sur cet exercice. Un bien vendu, mis au rebut ou volé se sort depuis sa fiche.</div>'}
        </div>`;
      $$('#im-body tr[data-aid]').forEach(tr => tr.onclick = () => navigate('#/immo/' + tr.dataset.aid));
    }

    const draw = () => {
      $('#im-year').hidden = s.tab === 'attente';
      if (s.tab === 'attente') return drawWaiting();
      if (s.tab === 'sorties') return drawDisposals();
      drawTable();
    };
    $$('#im-tabs button').forEach(b => b.onclick = () => {
      s.tab = b.dataset.tab;
      $$('#im-tabs button').forEach(x => x.classList.toggle('active', x === b));
      draw();
    });
    $('#im-year').onchange = e => { s.year = e.target.value; draw(); };
    $('#new-imm').onclick = () => assetForm(null, () => render());
    $('#im-csv').onclick = async () => {
      const t = C.assetTotals(data, Number(s.year));
      if (!t.rows.length) return toast('Rien à exporter sur cet exercice.', true);
      const cols = [
        { key: 'label', label: 'Bien' },
        { label: 'Famille', get: a => C.assetClassLabel(a.category) },
        { key: 'date', label: 'Mise en service', type: 'date' },
        { key: 'years', label: 'Durée (ans)' },
        { key: 'amount', label: 'Valeur HT', type: 'money' },
        { key: 'opening', label: 'Cumul au 01/01', type: 'money' },
        { key: 'annuity', label: 'Dotation', type: 'money' },
        { key: 'cumulated', label: 'Cumul au 31/12', type: 'money' },
        { label: 'VNC', type: 'money', get: a => a.out ? 0 : a.nbv },
        { label: 'Sortie', get: a => a.out ? C.fmtDate(a.disposalResult.date) : '' }
      ];
      const f = await bridge.saveText(`immobilisations-${s.year}.csv`, C.toCsv(t.rows, cols));
      if (f) toast('Exporté : ' + f.split(/[\\/]/).pop());
    };
    draw();
  };

  routes.immo = (parts) => {
    const a = assetById(parts[0]);
    if (!a) return navigate('#/immos');
    const cur = company().currency;
    const rows = C.assetSchedule(a);
    const dis = C.disposalResult(a);
    const thisYear = Number(C.today().slice(0, 4));
    const buy = a.purchaseId ? purchaseById(a.purchaseId) : null;
    $('#view').innerHTML = `
      <div class="page-head"><div><h1>${h(a.label)}</h1>
        <div class="small muted">${[C.assetClassLabel(a.category), 'mis en service le ' + C.fmtDate(a.date), a.supplierId ? supplierName(a.supplierId) : ''].filter(Boolean).join(' · ')}</div></div>
        <div class="actions">${backButton('#/immos')}<button class="btn" id="edit-imm">Modifier</button>
          <button class="btn ${dis ? '' : 'btn-primary'}" id="dispose">${dis ? 'Modifier la sortie' : 'Sortir du patrimoine'}</button></div></div>
      ${dis ? `<div class="panel" style="border-left:3px solid ${dis.result < 0 ? 'var(--danger)' : 'var(--success)'}">
        <h2>Sorti le ${C.fmtDate(dis.date)}${dis.reason ? ' — ' + h(dis.reason) : ''}</h2>
        <p class="small">Vendu ${C.money(dis.price, cur)} alors qu'il valait encore ${C.money(dis.nbv, cur)} dans les comptes :
        ${dis.result >= 0 ? `<b class="ok-text">plus-value de ${C.money(dis.result, cur)}</b>` : `<b class="warn-text">moins-value de ${C.money(-dis.result, cur)}</b>`}.
        <em>À VÉRIFIER avec ton comptable.</em></p>
        ${vatWarning(a, dis.date) ? `<p class="small warn-text">${vatWarning(a, dis.date)}</p>` : ''}</div>` : ''}
      <div class="stats">
        <div class="stat"><div class="lbl">Valeur d'acquisition</div><div class="val">${C.money(a.amount, cur)}</div><div class="sub">${Number(a.residual) ? 'valeur résiduelle ' + C.money(a.residual, cur) : 'aucune valeur résiduelle'}</div></div>
        <div class="stat"><div class="lbl">Durée</div><div class="val">${a.years} an${a.years > 1 ? 's' : ''}</div><div class="sub">jusqu'au ${rows.length ? C.fmtDate(rows[rows.length - 1].to) : '—'}</div></div>
        <div class="stat"><div class="lbl">Amorti à ce jour</div><div class="val">${C.money(C.assetCumulated(a, dis ? dis.date : C.today()), cur)}</div><div class="sub">${a.amount ? pct(Math.round(C.assetCumulated(a, dis ? dis.date : C.today()) / a.amount * 1000) / 10) + ' % de la valeur' : ''}</div></div>
        <div class="stat"><div class="lbl">Valeur nette comptable ${info('immo.nbv')}</div><div class="val">${dis ? C.money(0, cur) : C.money(C.assetNBV(a, C.today()), cur)}</div><div class="sub">${dis ? 'bien sorti de l\'actif' : 'aujourd\'hui'}</div></div>
      </div>
      <div class="panel"><h2>Plan d'amortissement ${info('immo.plan')}</h2>
        ${rows.length ? `<table class="list compact"><thead><tr><th>Exercice</th><th>Période</th><th class="r">Jours</th><th class="r">Dotation</th><th class="r">Cumul</th><th class="r">VNC au 31/12</th></tr></thead><tbody>
          ${rows.map(r => `<tr class="${r.year === thisYear ? 'row-now' : ''}">
            <td><strong>${r.year}</strong>${r.year === thisYear ? ' <span class="small muted">(exercice en cours)</span>' : ''}</td>
            <td class="nw">${C.fmtDate(r.from)} → ${C.fmtDate(r.to)}</td>
            <td class="r nw">${r.days}</td><td class="r nw"><strong>${C.money(r.annuity, cur)}</strong></td>
            <td class="r nw">${C.money(r.cumulated, cur)}</td><td class="r nw">${C.money(r.nbv, cur)}</td></tr>`).join('')}
        </tbody></table>` : '<div class="empty">Plan indisponible : vérifie la valeur, la durée et la date de mise en service.</div>'}
        ${dis ? `<p class="small muted mt">Ce tableau est le plan <b>d'origine</b>, celui qui aurait couru si le bien était resté. Il est sorti le ${C.fmtDate(dis.date)} : l'exercice ${dis.date.slice(0, 4)} n'a été amorti que jusqu'à ce jour-là (${C.money(C.round3(C.assetCumulated(a, dis.date) - C.assetCumulated(a, `${Number(dis.date.slice(0, 4)) - 1}-12-31`)), cur)}), et les suivants n'ont plus aucune dotation. C'est ce que montre le tableau des amortissements de l'exercice.</p>` : ''}
      </div>
      ${buy ? `<div class="panel"><h2>Achat d'origine</h2>
        <p class="small">Ce bien vient de la pièce <a href="#/achat/${h(buy.id)}">${h(buy.number || 'sans numéro')}</a> du ${C.fmtDate(buy.date)}${buy.supplierId ? ', ' + h(supplierName(buy.supplierId)) : ''}. Modifier l'achat ne change pas cette fiche : la valeur immobilisée est recopiée à la création.</p></div>` : ''}
      ${a.notes ? `<div class="panel"><h2>Notes</h2><p class="small">${C.nl2br(a.notes)}</p></div>` : ''}`;
    bindBack('#/immos');
    $('#edit-imm').onclick = () => assetForm(a, () => render());
    $('#dispose').onclick = () => disposalForm(a, () => render());
  };

  // ---------- Trésorerie ----------
  const tresoState = { tab: 'position', account: '', days: 90, year: C.today().slice(0, 4), showPointed: false,
    moves: { sort: null, page: 1 } };
  const TRESO_TABS = [['position', 'Où j\'en suis'], ['prevision', 'Ce qui arrive'], ['mouvements', 'Mouvements'], ['rapprochement', 'Rapprochement']];

  function accountForm(acc, done) {
    const a = acc || { id: C.uid(), name: '', kind: 'banque', bank: '', rib: '', opening: 0, openingDate: C.today(), isDefault: !data.accounts.length, statementBalance: '', notes: '' };
    modal(`<h2>${acc ? 'Modifier le compte' : 'Nouveau compte'}</h2>
      <p class="small muted">Le <b>solde de départ</b> est celui de ton relevé au jour où tu commences à suivre ce compte dans SkanFact. Tout ce qui est saisi après s'y ajoute.</p>
      <form id="af" class="grid-2">
        <label class="field span-2 obligatoire">Nom du compte<input type="text" name="name" value="${h(a.name)}" placeholder="BIAT — compte courant" required></label>
        <label class="field">${lbl('Type', 'tre.kind')}<select name="kind">${C.ACCOUNT_KINDS.map(([v, l]) => `<option value="${v}" ${a.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${field('Banque', 'bank', a.bank || '')}
        ${field('RIB', 'rib', a.rib || '')}
        ${field(lbl('Solde de départ', 'tre.opening'), 'opening', a.opening || 0, 'number', 'step="0.001" class="num"')}
        ${dateFieldHtml(lbl('À la date du', 'tre.openingDate'), 'openingDate', a.openingDate || C.today(), {})}
        <label class="check span-2"><input type="checkbox" name="isDefault" ${a.isDefault ? 'checked' : ''}> Compte par défaut ${info('tre.default')}</label>
        <label class="field span-2">Notes<input type="text" name="notes" value="${h(a.notes || '')}"></label>
      </form>
      <div class="modal-actions">
        ${acc ? '<button class="btn btn-danger" id="del-acc" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = () => {
          const v = formValues($('#af', root));
          if (!v.name.trim()) return toast('Donne un nom à ce compte.', true);
          // Le solde de départ et sa date sont le point zéro de toute la trésorerie : les changer
          // après coup déplace tous les soldes, y compris ceux des mois déjà clôturés.
          if (acc && (Number(v.opening) !== Number(acc.opening) || v.openingDate !== acc.openingDate)
              && closedBlock([acc.openingDate, v.openingDate], 'Ce solde de départ')) return;
          Object.assign(a, v, { opening: Number(v.opening) || 0 });
          if (a.isDefault) data.accounts.forEach(x => { if (x.id !== a.id) x.isDefault = false; });
          else if (!data.accounts.some(x => x.isDefault && x.id !== a.id)) a.isDefault = true;   // il en faut toujours un
          if (!acc) data.accounts.push(a);
          save(true); close(); if (done) done(a);
        };
        if ($('#del-acc', root)) $('#del-acc', root).onclick = async () => {
          const n = C.cashMovements(data, company(), {}, a.id).length;
          if (!await confirmDialog(`Supprimer « ${a.name} » ?${n ? ` ${n} mouvement(s) y sont rattachés : ils basculeront sur le compte par défaut.` : ''}`)) return;
          forget('accounts', a.id, a.name);
          data.accounts = data.accounts.filter(x => x.id !== a.id);
          if (data.accounts.length && !data.accounts.some(x => x.isDefault)) data.accounts[0].isDefault = true;
          save(true); close(); render();
        };
      });
  }

  function movementForm(mv, done) {
    const m = mv || { id: C.uid(), date: C.today(), kind: 'autre-sortie', amount: 0, accountId: (data.accounts.find(a => a.isDefault) || data.accounts[0] || {}).id || '', label: '', reference: '', method: 'virement' };
    modal(`<h2>${mv ? 'Modifier le mouvement' : 'Nouveau mouvement'}</h2>
      <p class="small muted">Ce qui n'a ni facture ni achat : salaires, impôts, frais bancaires, apport, retrait. Les encaissements clients et les règlements fournisseurs n'ont <b>pas</b> à être saisis ici — ils remontent tout seuls.</p>
      <form id="mf2" class="grid-2">
        ${dateFieldHtml('Date', 'date', m.date, {})}
        <label class="field">${lbl('Nature', 'tre.moveKind')}<select name="kind">${C.MOVE_KINDS.map(([v, l, s]) => `<option value="${v}" ${m.kind === v ? 'selected' : ''}>${s > 0 ? '↑' : '↓'} ${l}</option>`).join('')}</select></label>
        ${field('Montant', 'amount', Math.abs(m.amount) || 0, 'number', 'step="0.001" min="0" class="num"')}
        <label class="field">Compte<select name="accountId">${data.accounts.map(a => `<option value="${a.id}" ${m.accountId === a.id ? 'selected' : ''}>${h(a.name)}</option>`).join('')}</select></label>
        <label class="field span-2">Libellé<input type="text" name="label" value="${h(m.label || '')}" placeholder="Salaires de septembre"></label>
        ${field('Référence', 'reference', m.reference || '', 'text', 'placeholder="N° de chèque, référence du virement…"')}
        <label class="field">Mode<select name="method">${C.PAYMENT_METHODS.map(([v, l]) => `<option value="${v}" ${m.method === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </form>
      <div class="modal-actions">
        ${mv ? '<button class="btn btn-danger" id="del-mv" style="margin-right:auto">Supprimer</button>' : ''}
        <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = async () => {
          const v = formValues($('#mf2', root));
          if (!(Number(v.amount) > 0)) return toast('Montant invalide.', true);
          if (!v.date) return toast('Date invalide.', true);
          if (v.date > C.today() && !await confirmDialog(`La date (${C.fmtDate(v.date)}) est dans le futur. Un mouvement de trésorerie se saisit quand il a eu lieu. Enregistrer quand même ?`, 'Enregistrer')) return;
          if (closedBlock([mv && mv.date, v.date], 'Ce mouvement')) return;
          Object.assign(m, v, { amount: Math.abs(Number(v.amount)) });
          if (!mv) data.movements.push(m);
          save(true); close(); if (done) done(m);
        };
        if ($('#del-mv', root)) $('#del-mv', root).onclick = async () => {
          if (!await confirmDialog('Supprimer ce mouvement ?')) return;
          if (closedBlock(m.date, 'Ce mouvement')) return;
          forget('movements', m.id, m.label || '');
          data.movements = data.movements.filter(x => x.id !== m.id); save(true); close(); render();
        };
      });
  }

  routes.tresorerie = () => {
    const cur = company().currency;
    const s = tresoState;
    if (!data.accounts.length) {
      $('#view').innerHTML = `<div class="page-head"><h1>Trésorerie</h1></div>
        <div class="panel"><h2>Commence par un compte ${info('tre.accounts')}</h2>
          <p class="small muted">La trésorerie répond à une seule question : <b>est-ce que j'aurai de quoi payer le mois prochain ?</b>
          Pour y répondre, SkanFact a besoin de savoir ce que tu as aujourd'hui. Crée ton compte bancaire et saisis son solde actuel — il reprendra ensuite tout seul tes encaissements et tes règlements.</p>
          <p class="small muted">Rien à ressaisir : les paiements clients et les règlements fournisseurs déjà enregistrés remontent automatiquement.</p>
          <button class="btn btn-primary" id="first-acc">+ Créer mon premier compte</button></div>`;
      $('#first-acc').onclick = () => accountForm(null, () => render());
      return;
    }
    $('#view').innerHTML = `
      <div class="page-head"><h1>Trésorerie</h1>
        <div class="actions"><button class="btn" id="new-move">+ Mouvement</button><button class="btn" id="new-acc">+ Compte</button></div></div>
      <div class="tabs" id="t-tabs" role="tablist">${TRESO_TABS.map(([id, label]) =>
        `<button role="tab" data-tab="${id}" class="${id === s.tab ? 'active' : ''}">${label}</button>`).join('')}</div>
      <div id="t-body"></div>`;

    const draw = () => {
      if (s.tab === 'prevision') return drawForecast();
      if (s.tab === 'mouvements') return drawMoves();
      if (s.tab === 'rapprochement') return drawReco();
      drawPosition();
    };

    // --- Où j'en suis
    function drawPosition() {
      const pos = C.cashPosition(data, company(), C.today());
      const f = C.cashForecast(data, company(), 30, C.today());
      $('#t-body').innerHTML = `
        <div class="stats">
          <div class="stat"><div class="lbl">Disponible aujourd'hui ${info('tre.total')}</div><div class="val ${pos.total < 0 ? 'due' : ''}">${C.money(pos.total, cur)}</div><div class="sub">${pos.accounts.length} compte(s)</div></div>
          <div class="stat"><div class="lbl">À encaisser ${info('dash.open')}</div><div class="val">${C.money(f.inflow, cur)}</div><div class="sub">sous 30 jours</div></div>
          <div class="stat"><div class="lbl">À décaisser ${info('buy.payables')}</div><div class="val">${C.money(-f.outflow, cur)}</div><div class="sub">sous 30 jours</div></div>
          <div class="stat"><div class="lbl">Solde projeté à 30 jours ${info('tre.projected')}</div><div class="val ${f.end < 0 ? 'due' : 'ok'}">${C.money(f.end, cur)}</div><div class="sub">${f.shortfall ? `<span class="warn-text">passage en négatif le ${C.fmtDate(f.shortfall.date)}</span>` : 'aucun trou prévu'}</div></div>
        </div>
        ${f.shortfall ? `<div class="panel" style="border-left:3px solid var(--danger)">
          <h2 style="color:var(--danger)">Trou de trésorerie prévu le ${C.fmtDate(f.shortfall.date)} ${info('tre.shortfall')}</h2>
          <p class="small">Si tout se passe comme prévu, ton solde descendra à <strong>${C.money(f.shortfall.balance, cur)}</strong> après « ${h(f.shortfall.label)} ».</p>
          <p class="small muted">Ce qui peut le combler : relancer ${f.late.clients.length} facture(s) client déjà échue(s), décaler un règlement fournisseur, ou prévenir ta banque. Un trou anticipé se négocie ; un trou constaté se subit.</p>
        </div>` : ''}
        <div class="panel"><h2>Comptes ${info('tre.accounts')}</h2>
          <table class="list compact"><thead><tr><th>Compte</th><th>Type</th><th class="r">Solde de départ</th><th class="r">Mouvements</th><th class="r">Solde</th><th class="r">Non pointé</th><th></th></tr></thead><tbody>
            ${pos.accounts.map(a => `<tr><td><strong>${h(a.name)}</strong>${a.isDefault ? ' <span class="badge b-paid">par défaut</span>' : ''}${a.bank ? `<div class="small muted">${h(a.bank)}</div>` : ''}</td>
              <td class="small">${h((C.ACCOUNT_KINDS.find(k => k[0] === a.kind) || [, a.kind])[1])}</td>
              <td class="r nw">${C.money(a.opening, cur)}<div class="small muted">au ${C.fmtDate(a.openingDate)}</div></td>
              <td class="r nw">${a.count} · ${C.money(a.movements, cur)}</td>
              <td class="r nw"><strong class="${a.balance < 0 ? 'warn-text' : ''}">${C.money(a.balance, cur)}</strong></td>
              <td class="r nw">${a.pending ? C.money(a.pending, cur) : '<span class="muted">—</span>'}</td>
              <td class="actions"><button class="btn btn-ghost btn-sm" data-eacc="${h(a.id)}">Modifier</button></td></tr>`).join('')}
            <tr class="total-row"><td colspan="4"><strong>Total disponible</strong></td><td class="r"><strong>${C.money(pos.total, cur)}</strong></td><td></td><td></td></tr>
          </tbody></table>
          <p class="small muted mt">« Non pointé » : ce que SkanFact connaît et que tu n'as pas encore retrouvé sur ton relevé. L'onglet Rapprochement sert à ça.</p>
        </div>`;
      $$('[data-eacc]').forEach(b => b.onclick = () => accountForm(data.accounts.find(a => a.id === b.dataset.eacc), () => draw()));
    }

    // --- Ce qui arrive
    function drawForecast() {
      const f = C.cashForecast(data, company(), s.days, C.today());
      $('#t-body').innerHTML = `
        <div class="filters">
          <select id="t-days">${[30, 60, 90, 180].map(d => `<option value="${d}" ${Number(s.days) === d ? 'selected' : ''}>${d} jours</option>`).join('')}</select>
          ${info('tre.forecast')}
          <span class="small muted">Départ ${C.money(f.start, cur)} · arrivée ${C.money(f.end, cur)}</span>
        </div>
        <div class="panel"><h2>Courbe du solde prévu ${info('tre.curve')}</h2>
          ${forecastChart(f)}
          <p class="small muted mt">Seules les échéances connues sont projetées : factures ouvertes, achats à régler, contrats récurrents. Aucune estimation, aucune moyenne — ce que tu vois est ce qui est déjà engagé.</p>
        </div>
        ${f.fiscal.length ? `<div class="panel"><h2>Échéances fiscales sur la période ${info('compta.fiscal')}</h2>
          <p class="small muted">Leur montant n'est pas dans la courbe : SkanFact connaît la date, pas la somme. Pense à les provisionner.</p>
          <ul class="small">${f.fiscal.map(x => `<li><strong>${C.fmtDate(x.date)}</strong> — ${h(x.label)}</li>`).join('')}</ul>
        </div>` : ''}
        <div class="panel"><h2>Le détail, dans l'ordre ${info('tre.events')}</h2>
          ${f.events.length ? `<table class="list compact"><thead><tr><th>Date</th><th>Origine</th><th>Pièce</th><th class="r">Mouvement</th><th class="r">Solde après</th></tr></thead><tbody>
            ${f.points.slice(1).map((p, i) => { const e = f.events[i]; return `<tr class="clickable ${p.balance < 0 ? 'row-warn' : ''}" data-fid="${h(e.id)}" data-fkind="${h(e.kind)}">
              <td class="nw">${C.fmtDate(p.date)}${e.late ? '<div class="small warn-text">déjà échue</div>' : ''}</td>
              <td class="small">${e.kind === 'client' ? 'Facture client' : e.kind === 'fournisseur' ? 'Achat' : 'Contrat récurrent'}</td>
              <td>${h(e.label)}</td>
              <td class="r nw ${p.delta > 0 ? 'ok-text' : 'warn-text'}">${p.delta > 0 ? '+' : ''}${C.money(p.delta, cur)}</td>
              <td class="r nw ${p.balance < 0 ? 'warn-text' : ''}"><strong>${C.money(p.balance, cur)}</strong></td></tr>`; }).join('')}
          </tbody></table>` : '<div class="empty">Rien d\'attendu sur cette période : aucune facture ouverte, aucun achat à régler.</div>'}
        </div>`;
      $('#t-days').onchange = e => { s.days = Number(e.target.value); draw(); };
      $$('#t-body tr[data-fid]').forEach(tr => tr.onclick = () => {
        const k = tr.dataset.fkind;
        navigate(k === 'client' ? '#/doc/' + tr.dataset.fid : k === 'fournisseur' ? '#/achat/' + tr.dataset.fid : '#/contrat/' + tr.dataset.fid);
      });
    }

    // --- Mouvements
    function drawMoves() {
      const cols = [
        { key: 'date', label: 'Date', cls: 'nw', asc: true, val: m => m.date || '', get: m => C.fmtDate(m.date) },
        { key: 'label', label: 'Libellé', asc: true, val: m => (m.label || '').toLowerCase(), get: m => `${h(m.label)}${m.party ? `<div class="small muted">${h(m.party)}</div>` : ''}` },
        { key: 'account', label: 'Compte', asc: true, val: m => m.accountId, get: m => h(((data.accounts.find(a => a.id === m.accountId)) || {}).name || '—') },
        { key: 'method', label: 'Mode', asc: true, val: m => m.method || '', get: m => h(methodLabel(m.method)) },
        { key: 'reference', label: 'Référence', asc: true, val: m => (m.reference || '').toLowerCase(), get: m => h(m.reference || '') || '<span class="muted">—</span>' },
        { key: 'amount', label: 'Montant', r: true, val: m => m.amount, get: m => `<span class="${m.amount > 0 ? 'ok-text' : ''}">${m.amount > 0 ? '+' : ''}${C.money(m.amount, cur)}</span>` }
      ];
      // L'année se choisit. Elle était figée sur l'année en cours, sans le moindre moyen de
      // remonter : le 3 janvier, la page de trésorerie devenait vide et l'année écoulée
      // inatteignable — alors que c'est exactement le moment où on la regarde.
      const annees = Array.from(new Set(C.cashMovements(data, company(), { from: '', to: '9999-12-31' }, null)
        .map(m => (m.date || '').slice(0, 4)).filter(Boolean).concat([C.today().slice(0, 4)]))).sort().reverse();
      if (!annees.includes(s.year)) s.year = annees[0];
      const period = { from: `${s.year}-01-01`, to: `${s.year}-12-31` };
      const all = C.cashMovements(data, company(), period, s.account || null);
      const rows = applySort(all.slice().reverse(), cols, s.moves.sort);
      const pg = paginate(rows, s.moves);
      const entrees = C.round3(all.filter(m => m.amount > 0).reduce((x, m) => x + m.amount, 0));
      const sorties = C.round3(all.filter(m => m.amount < 0).reduce((x, m) => x + m.amount, 0));
      $('#t-body').innerHTML = `
        <div class="filters">
          <select id="t-acc"><option value="">Tous les comptes</option>${data.accounts.map(a => `<option value="${a.id}" ${s.account === a.id ? 'selected' : ''}>${h(a.name)}</option>`).join('')}</select>
          <select id="t-year">${annees.map(y => `<option ${y === s.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
          ${info('tre.moves')}
          <span class="small muted">${all.length} mouvement(s)</span>
        </div>
        <div class="stats">
          <div class="stat"><div class="lbl">Entrées</div><div class="val ok">${C.money(entrees, cur)}</div><div class="sub">encaissements et apports</div></div>
          <div class="stat"><div class="lbl">Sorties</div><div class="val due">${C.money(-sorties, cur)}</div><div class="sub">règlements et charges</div></div>
          <div class="stat"><div class="lbl">Variation</div><div class="val ${entrees + sorties < 0 ? 'due' : 'ok'}">${C.money(C.round3(entrees + sorties), cur)}</div><div class="sub">sur ${h(s.year)}</div></div>
        </div>
        <div class="panel"><h2>Tous les mouvements de ${h(s.year)}</h2>
          <div class="inline mb"><button class="btn btn-sm" id="exp-moves">Exporter en CSV</button></div>
          ${rows.length ? `<div id="m-wrap"><table class="list compact sortable"><thead>${sortHead(cols, s.moves.sort)}</thead><tbody>
            ${pg.rows.map(m => { const cible = m.source === 'libre' ? '' : m.docId ? '#/doc/' + m.docId : m.purchaseId ? '#/achat/' + m.purchaseId : m.payslipId ? '#/paie' : '';
              return `<tr class="${m.source === 'libre' || cible ? 'clickable' : ''}" data-mv="${m.source === 'libre' ? h(m.movementId) : ''}" data-go="${h(cible)}">
              ${cols.map(c => `<td class="${c.r ? 'r nw' : ''}${c.cls ? ' ' + c.cls : ''}">${c.get(m)}</td>`).join('')}</tr>`; }).join('')}
          </tbody></table></div>${pagerBar(pg.pg, { noun: 'mouvement' })}`
            : `<div class="empty">Aucun mouvement en ${h(s.year)}.</div>`}
          <p class="small muted mt">Clique une ligne pour ouvrir la pièce d'où elle vient : le compte et le mode de règlement se corrigent là-bas, avec le bouton ✎ à côté du paiement. Les mouvements libres (salaires, impôts, apports, frais bancaires) se modifient ici même.</p>
        </div>`;
      $('#t-acc').onchange = e => { s.account = e.target.value; s.moves.page = 1; draw(); };
      $('#t-year').onchange = e => { s.year = e.target.value; s.moves.page = 1; draw(); };
      // Un mouvement déduit d'un paiement ne se modifie pas ici — mais il DOIT mener à sa pièce :
      // la phrase juste en dessous disait d'aller la corriger, sans offrir d'y aller.
      $$('#t-body tr[data-mv], #t-body tr[data-go]').forEach(tr => {
        if (tr.dataset.mv) tr.onclick = () => movementForm(data.movements.find(m => m.id === tr.dataset.mv), () => draw());
        else if (tr.dataset.go) tr.onclick = () => navigate(tr.dataset.go);
      });
      const wrap = $('#m-wrap');
      // `bindSort` passe la colonne cliquée à son rappel : `() => draw()` la jetait, et les six
      // en-têtes affichaient leur « ⇅ » sans jamais rien trier. Un tri qui ne trie pas ne se voit
      // pas — on croit que la liste était déjà dans cet ordre.
      if (wrap) {
        bindSort(wrap.closest('.panel'), key => { s.moves.sort = toggleSort(s.moves.sort, key, cols); s.moves.page = 1; draw(); });
        bindPager(wrap.closest('.panel'), s.moves, () => draw(), '#m-wrap');
      }
      $('#exp-moves').onclick = async () => {
        if (!all.length) return toast('Rien à exporter.', true);
        const cs = [{ key: 'date', label: 'Date', type: 'date' }, { key: 'label', label: 'Libellé' }, { key: 'party', label: 'Tiers' },
          { label: 'Compte', get: m => ((data.accounts.find(a => a.id === m.accountId)) || {}).name || '' },
          { key: 'method', label: 'Mode' }, { key: 'reference', label: 'Référence' }, { key: 'amount', label: 'Montant', type: 'money' }];
        const f2 = await bridge.saveText(`mouvements-${s.year}.csv`, C.toCsv(all, cs));
        if (f2) toast('Exporté : ' + f2.split(/[\\/]/).pop());
      };
    }

    // --- Rapprochement
    function drawReco() {
      const accId = s.account || (data.accounts.find(a => a.isDefault) || data.accounts[0]).id;
      const r = C.reconciliation(data, company(), accId, C.today());
      const pending = r.moves.filter(m => !m.reconciled).slice().reverse();
      // Ce qui est déjà pointé se relit et se dépointe. Avant la 7.17.0, cocher faisait disparaître
      // la ligne à l'instant même : un clic à côté était définitif, et rien nulle part ne montrait
      // ce qui avait été pointé. Or pointer par erreur fausse l'écart avec le relevé — c'est-à-dire
      // exactement le chiffre pour lequel on est venu sur cette page.
      const pointes = r.moves.filter(m => m.reconciled).slice().reverse();
      const ligne = m => `<tr><td><input type="checkbox" data-rec="${h(m.id)}" data-src="${h(m.source)}" ${m.reconciled ? 'checked' : ''}></td>
              <td class="nw">${C.fmtDate(m.date)}</td><td>${h(m.label)}<div class="small muted">${h(m.party || '')}</div></td>
              <td class="small">${h(m.reference || '')}</td>
              <td class="r nw ${m.amount > 0 ? 'ok-text' : ''}">${m.amount > 0 ? '+' : ''}${C.money(m.amount, cur)}</td></tr>`;
      $('#t-body').innerHTML = `
        <div class="filters">
          <select id="t-acc2">${data.accounts.map(a => `<option value="${a.id}" ${accId === a.id ? 'selected' : ''}>${h(a.name)}</option>`).join('')}</select>
          ${info('tre.reco')}
        </div>
        <div class="panel"><h2>Ton relevé face à SkanFact ${info('tre.gap')}</h2>
          <div class="vat-box">
            <div class="vat-line"><span>Solde de départ du compte</span><span class="num">${C.money(r.opening, cur)}</span></div>
            <div class="vat-line"><span>+ Mouvements déjà pointés</span><span class="num">${C.money(C.round3(r.pointed - r.opening), cur)}</span></div>
            <div class="vat-line total"><span>Solde qui devrait figurer sur ton relevé</span><span class="num">${C.money(r.pointed, cur)}</span></div>
          </div>
          <div class="inline mt" style="flex-wrap:wrap">
            <label class="field" style="max-width:220px">Solde réel de ton relevé<input type="number" id="stmt" step="0.001" value="${r.statement == null ? '' : r.statement}" class="num" placeholder="Recopie-le ici"></label>
            ${r.gap == null ? '<span class="small muted">Saisis le solde de ton relevé pour voir l\'écart.</span>'
              : Math.abs(r.gap) < 0.0005 ? '<span class="ok-text"><strong>Ça tombe juste.</strong> Ton relevé et SkanFact disent la même chose.</span>'
              : `<span class="warn-text"><strong>Écart de ${C.money(Math.abs(r.gap), cur)}.</strong> ${r.gap > 0 ? 'SkanFact compte plus que ta banque' : 'ta banque compte plus que SkanFact'} : il manque une pièce quelque part.</span>`}
          </div>
        </div>
        <div class="panel"><h2>Pas encore pointés — ${pending.length} mouvement(s) ${info('tre.pending')}</h2>
          <p class="small muted mb">Coche ce que tu retrouves sur ton relevé. Ce qui reste décoché est soit en cours de traitement à la banque, soit une erreur de saisie.</p>
          ${pending.length ? `<table class="list compact"><thead><tr><th style="width:46px"></th><th>Date</th><th>Libellé</th><th>Référence</th><th class="r">Montant</th></tr></thead><tbody>
            ${pending.map(ligne).join('')}
          </tbody><tfoot><tr><td colspan="4"><strong>Total non pointé</strong></td><td class="r"><strong>${C.money(r.pendingAmount, cur)}</strong></td></tr></tfoot></table>`
            : '<div class="empty">Tout est pointé. Ton relevé et SkanFact sont alignés.</div>'}
        </div>
        ${pointes.length ? `<div class="panel"><h2><button class="btn btn-ghost btn-sm" id="t-vus">${s.showPointed ? '▾' : '▸'}</button> Déjà pointés — ${pointes.length} mouvement(s)</h2>
          <p class="small muted mb">Décoche si tu t'es trompé : le mouvement revient dans la liste du dessus et le solde pointé se recalcule.</p>
          ${s.showPointed ? `<table class="list compact"><thead><tr><th style="width:46px"></th><th>Date</th><th>Libellé</th><th>Référence</th><th class="r">Montant</th></tr></thead><tbody>
            ${pointes.map(ligne).join('')}
          </tbody></table>` : ''}
        </div>` : ''}`;
      if ($('#t-vus')) $('#t-vus').onclick = () => { s.showPointed = !s.showPointed; draw(); };
      $('#t-acc2').onchange = e => { s.account = e.target.value; draw(); };
      $('#stmt').onchange = e => {
        const acc = data.accounts.find(a => a.id === accId);
        acc.statementBalance = e.target.value === '' ? '' : Number(e.target.value);
        save(true); draw();
      };
      // Pointer un mouvement : le drapeau vit sur le paiement d'origine, pas sur une copie.
      // La ligne quitte l'écran à l'instant du clic : au moment où on comprend qu'on s'est trompé,
      // il n'y a plus rien sous le doigt. D'où « Annuler » (7.12.0), en plus du panneau du dessous.
      const porteur = id => {
        let hit = null;
        data.documents.forEach(d => (d.payments || []).forEach(p => { if (p.id === id) hit = p; }));
        data.purchases.forEach(pu => (pu.payments || []).forEach(p => { if (p.id === id) hit = p; }));
        data.movements.forEach(m => { if (m.id === id) hit = m; });
        return hit;
      };
      $$('[data-rec]').forEach(cb => cb.onchange = () => {
        const id = cb.dataset.rec;
        const hit = porteur(id);
        if (!hit) return;
        const avant = !!hit.reconciled;
        hit.reconciled = cb.checked; save(true); draw();
        toastUndo(cb.checked ? 'Mouvement pointé' : 'Mouvement dépointé', () => {
          const h2 = porteur(id);
          if (h2) { h2.reconciled = avant; save(true); draw(); }
        });
      });
    }

    $$('#t-tabs button').forEach(b => b.onclick = () => {
      s.tab = b.dataset.tab;
      $$('#t-tabs button').forEach(x => x.classList.toggle('active', x === b));
      draw();
    });
    $('#new-acc').onclick = () => accountForm(null, () => render());
    $('#new-move').onclick = () => movementForm(null, () => draw());
    draw();
  };

  // Courbe du solde prévu. Une ligne, une zone, et le zéro marqué : c'est le passage sous zéro qui compte.
  function forecastChart(f) {
    const W = 660, H = 200, left = 52, right = 8, bottom = 24, top = 12;
    const pts = f.points;
    if (pts.length < 2) return '<div class="empty">Rien à projeter : aucune échéance connue sur la période.</div>';
    const vals = pts.map(p => p.balance);
    const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
    const span = Math.max(1, hi - lo);
    const x = i => left + (W - left - right) * (i / (pts.length - 1));
    const y = v => top + (H - bottom - top) * (1 - (v - lo) / span);
    const zero = y(0);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
    const area = `${line} L${x(pts.length - 1).toFixed(1)},${zero.toFixed(1)} L${x(0).toFixed(1)},${zero.toFixed(1)} Z`;
    const grid = [hi, lo + span / 2, lo].map(v => `<line class="grid" x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}"/><text class="lbl" x="${left - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`).join('');
    const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.balance).toFixed(1)}" r="${p.balance < 0 ? 4 : 3}" fill="${p.balance < 0 ? 'var(--danger)' : 'var(--primary)'}"><title>${h(C.fmtDate(p.date))} — ${h(p.label)} : ${C.money(p.balance, company().currency)}</title></circle>`).join('');
    return `<svg class="chart forecast" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${grid}
      <path d="${area}" class="fc-area"/>
      <path d="${line}" class="fc-line" fill="none"/>
      <line class="fc-zero" x1="${left}" x2="${W - right}" y1="${zero}" y2="${zero}"/>
      ${dots}
      <text class="lbl" x="${left}" y="${H - 6}">${h(C.fmtDate(f.today))}</text>
      <text class="lbl" x="${W - right}" y="${H - 6}" text-anchor="end">${h(C.fmtDate(f.horizon))}</text>
    </svg>`;
  }

  // ---------- Statistiques ----------
  // Une page de pilotage : la même période comparée à l'an dernier, et les quatre questions
  // que se pose un dirigeant — est-ce que je vends, est-ce qu'on me paie, qu'est-ce qui se vend,
  // et qui sont mes clients.
  const statsState = { kind: 'annee', year: C.today().slice(0, 4), n: String(Number(C.today().slice(5, 7))) };

  routes.stats = () => {
    const cur = company().currency;
    const years = Array.from(new Set(data.documents.map(d => (d.date || '').slice(0, 4)).filter(Boolean)
      .concat([C.today().slice(0, 4)]))).sort().reverse();
    if (!years.includes(statsState.year)) statsState.year = years[0];
    const QUARTERS = [['1', '1ᵉʳ trimestre · janv.–mars'], ['2', '2ᵉ trimestre · avr.–juin'], ['3', '3ᵉ trimestre · juil.–sept.'], ['4', '4ᵉ trimestre · oct.–déc.']];

    $('#view').innerHTML = `
      <div class="page-head"><h1>Statistiques</h1>
        <div class="actions">
          <select id="s-kind" title="Période analysée">
            <option value="annee" ${statsState.kind === 'annee' ? 'selected' : ''}>Année entière</option>
            <option value="trimestre" ${statsState.kind === 'trimestre' ? 'selected' : ''}>Trimestre</option>
            <option value="mois" ${statsState.kind === 'mois' ? 'selected' : ''}>Mois</option>
          </select>
          <select id="s-year">${years.map(y => `<option ${y === statsState.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <select id="s-n" ${statsState.kind === 'annee' ? 'hidden' : ''}></select>
          <button class="btn" id="s-export">Exporter en CSV</button>
        </div></div>
      <div id="s-body"></div>`;

    const fillN = () => {
      const sel = $('#s-n');
      sel.hidden = statsState.kind === 'annee';
      if (sel.hidden) return;
      const opts = statsState.kind === 'trimestre' ? QUARTERS : MONTHS.map((m, i) => [String(i + 1), m]);
      if (!opts.some(o => o[0] === statsState.n)) statsState.n = opts[0][0];
      sel.innerHTML = opts.map(([v, l]) => `<option value="${v}" ${v === statsState.n ? 'selected' : ''}>${h(l)}</option>`).join('');
    };

    const draw = () => {
      const p = C.periodBounds(statsState.kind, statsState.year, statsState.n);
      const now = C.today();
      const cur1 = C.salesTotals(data, company(), p.from, p.to);
      const prev = C.salesTotals(data, company(), p.prev.from, p.prev.to);
      // Le graphique montre toujours l'année entière, avec la période choisie en couleur : un mois
      // seul ne fait qu'une barre, et une barre isolée n'apprend rien. Vu dans les douze mois, si.
      const series = C.revenueByMonth(data, company(), `${p.year}-01-01`, `${p.year}-12-31`);
      const seriesPrev = C.revenueByMonth(data, company(), `${p.year - 1}-01-01`, `${p.year - 1}-12-31`);
      series.forEach(x => { x.off = x.month < p.from.slice(0, 7) || x.month > p.to.slice(0, 7); });
      const funnel = C.quoteFunnel(data, company(), p.from, p.to, now);
      const items = C.topItems(data, company(), p.from, p.to, 8);
      const clients = C.topClients(data, company(), p.from, p.to, 8);
      const mvt = C.clientMovement(data, company(), p.from, p.to, company().dormantDays || 180, now);
      const aging = C.agedReceivables(data, company(), now);
      const payers = C.payerRanking(data, company(), 5);
      const yearHT = C.salesTotals(data, company(), `${p.year}-01-01`, `${p.year}-12-31`).ht;
      const obj = C.objectiveProgress(company().revenueTarget, yearHT, now, p.year);
      const itemMax = items.length ? Math.max(...items.map(x => Math.abs(x.ht)), 1) : 1;
      const clientMax = clients.length ? Math.max(...clients.map(x => x.ht), 1) : 1;
      const funMax = Math.max(1, funnel.accepted, funnel.refused, funnel.expired, funnel.pending);

      $('#s-body').innerHTML = `
        <div class="stats">
          ${statCard('Chiffre d\'affaires HT', C.money(cur1.ht, cur), cur1.ht, prev.ht, `${p.label} · avoirs déduits`, 'stat.ca')}
          ${statCard('Factures émises', String(cur1.invoices), cur1.invoices, prev.invoices, `${cur1.count - cur1.invoices} avoir(s) sur la période`, 'stat.count')}
          ${statCard('Panier moyen HT', C.money(cur1.avgTicket, cur), cur1.avgTicket, prev.avgTicket, 'par facture émise', 'stat.avg')}
          ${statCard('TVA collectée', C.money(cur1.vat, cur), cur1.vat, prev.vat, 'à reverser, avoirs déduits', 'stat.vat')}
        </div>
        ${obj ? `<div class="panel"><h2>Objectif ${p.year} ${info('stat.objectif')}</h2>
          <div class="gauge"><div class="g-bar"><i style="width:${Math.min(100, Math.max(0, obj.pct))}%"></i><span class="g-mark" style="left:${Math.min(100, obj.expectedPct)}%" title="Où tu devrais en être aujourd'hui"></span></div>
            <div class="g-legend"><span><strong>${C.money(obj.ht, cur)}</strong> réalisés · ${obj.pct} % de l'objectif</span><span class="muted">objectif ${C.money(obj.goal, cur)}</span></div></div>
          <p class="small ${obj.ahead >= 0 ? 'ok-text' : 'warn-text'}">${obj.ahead >= 0
            ? `En avance de ${C.money(obj.ahead, cur)} sur le rythme de l'année.`
            : `En retard de ${C.money(-obj.ahead, cur)} sur le rythme de l'année.`}
            ${obj.remaining > 0 ? ` Il reste ${C.money(obj.remaining, cur)} à facturer, soit ${C.money(obj.perMonth, cur)} par mois sur les ${obj.monthsLeft} mois restants.` : ' Objectif atteint.'}</p>
        </div>` : `<div class="panel"><h2>Objectif annuel ${info('stat.objectif')}</h2>
          <p class="small muted">Aucun objectif défini. Donne-toi un chiffre d'affaires à atteindre : la page te dira chaque mois si tu tiens le rythme.</p>
          <button class="btn btn-sm" id="s-goal">Définir un objectif…</button></div>`}
        <div class="panel"><h2>Chiffre d'affaires mois par mois — ${p.year} ${info('stat.chart')}</h2>
          ${compareChart(series, seriesPrev)}
          <div class="legend"><span><i style="background:var(--primary)"></i>${h(p.label)}</span>${p.kind === 'annee' ? '' : `<span><i style="background:var(--primary);opacity:.28"></i>reste de ${p.year}</span>`}<span><i style="background:#9aa7b4;opacity:.6"></i>${p.year - 1}</span></div>
        </div>
        <div class="split">
          <div class="panel"><h2>Issue des devis ${info('stat.funnel')}</h2>
            ${funnel.total ? `<table class="list compact"><thead><tr><th>Issue</th><th class="r">Devis</th><th class="r">Montant TTC</th><th></th></tr></thead><tbody>
              ${[['Acceptés', funnel.accepted, funnel.acceptedAmount, 'ok'], ['Refusés', funnel.refused, funnel.refusedAmount, 'bad'],
                 ['Expirés sans réponse', funnel.expired, funnel.expiredAmount, 'warn'], ['Encore en attente', funnel.pending, funnel.pendingAmount, 'neutral']]
                .map(([l, n2, amt, cls]) => `<tr><td>${l}</td><td class="r nw">${n2}</td><td class="r nw">${C.money(amt, cur)}</td><td style="width:34%"><span class="bar"><i class="f-${cls}" style="width:${Math.round(n2 / funMax * 100)}%"></i></span></td></tr>`).join('')}
            </tbody></table>
            <p class="small muted mt">Taux d'acceptation : <strong>${funnel.rate == null ? '—' : funnel.rate + ' %'}</strong> (sur les devis tranchés).
            Délai moyen entre le devis et la première facture : <strong>${funnel.replyDelay == null ? '—' : funnel.replyDelay + ' jours'}</strong>.</p>`
            : '<div class="empty">Aucun devis émis sur cette période.</div>'}
          </div>
          <div class="panel"><h2>Âge des impayés ${info('stat.aging')}</h2>
            ${aging.total ? `<table class="list compact"><thead><tr><th>Retard</th><th class="r">Factures</th><th class="r">Montant</th></tr></thead><tbody>
              ${aging.buckets.map(b => `<tr class="${b.min >= 61 && b.amount ? 'row-warn' : ''}"><td>${h(b.label)}</td><td class="r nw">${b.count || '—'}</td><td class="r nw">${b.amount ? C.money(b.amount, cur) : '—'}</td></tr>`).join('')}
              <tr class="total-row"><td><strong>Total dû</strong></td><td></td><td class="r nw"><strong>${C.money(aging.total, cur)}</strong></td></tr>
            </tbody></table>
            <p class="small muted mt">Au-delà de 90 jours, une créance devient difficile à recouvrer : c'est le moment d'une relance écrite. <a href="#/relances" id="s-relances">Voir les relances</a></p>`
            : data.documents.some(d => d.type === 'facture' && d.number)
              ? '<div class="empty">Rien en attente de paiement. Tout est encaissé.</div>'
              // Avant d'écrire une phrase rassurante, vérifier que l'univers concerné est non vide :
              // « tout est encaissé » félicitait quelqu'un qui n'avait jamais émis une facture.
              : '<div class="empty">Aucune facture émise pour l\'instant : il n\'y a rien à encaisser.</div>'}
          </div>
        </div>
        <div class="split">
          <div class="panel"><h2>Prestations les plus vendues ${info('stat.items')}</h2>
            ${items.length ? `<ul class="rank">${items.map(x => `<li><span class="name">${h(x.label)}</span><span class="bar"><i style="width:${Math.max(4, Math.round(Math.abs(x.ht) / itemMax * 100))}%"></i></span><span class="amt">${C.money(x.ht, cur)}</span></li>`).join('')}</ul>
            <p class="small muted mt">Regroupées par libellé, quantités et remises comprises. Les lignes de déduction d'acompte sont ignorées.</p>`
            : '<div class="empty">Aucune vente sur cette période.</div>'}
          </div>
          <div class="panel"><h2>Meilleurs clients (HT) ${info('stat.clients')}</h2>
            ${clients.length ? `<ul class="rank">${clients.map(x => `<li><a class="name" href="#/client/${h(x.clientId)}">${h(x.name)}</a><span class="bar"><i style="width:${Math.max(4, Math.round(x.ht / clientMax * 100))}%"></i></span><span class="amt">${C.money(x.ht, cur)}</span></li>`).join('')}</ul>
            ${clients.length > 1 ? `<p class="small ${clients[0].ht / Math.max(1, cur1.ht) > 0.5 ? 'warn-text' : 'muted'} mt">Ton premier client pèse ${Math.round(clients[0].ht / Math.max(1, cur1.ht) * 100)} % du chiffre d'affaires.${clients[0].ht / Math.max(1, cur1.ht) > 0.5 ? ' C\'est beaucoup : perdre ce client ferait très mal.' : ''}</p>` : ''}`
            : '<div class="empty">Aucun client facturé sur cette période.</div>'}
          </div>
        </div>
        <div class="split">
          <div class="panel"><h2>Mouvement des clients ${info('stat.mouvement')}</h2>
            <h3 class="sub-h">Nouveaux sur la période (${mvt.nouveaux.length})</h3>
            ${mvt.nouveaux.length ? `<table class="list compact"><thead><tr><th>Client</th><th>Première facture</th><th class="r">HT sur la période</th></tr></thead><tbody>
              ${mvt.nouveaux.slice(0, 8).map(x => `<tr class="clickable" data-client="${h(x.clientId)}"><td>${h(x.name)}</td><td class="nw">${C.fmtDate(x.since)}</td><td class="r nw">${C.money(x.ht, cur)}</td></tr>`).join('')}
            </tbody></table>` : '<p class="small muted">Aucun nouveau client sur cette période.</p>'}
            <h3 class="sub-h">Endormis depuis plus de ${company().dormantDays || 180} jours (${mvt.dormants.length})</h3>
            ${mvt.dormants.length ? `<table class="list compact"><thead><tr><th>Client</th><th>Dernière pièce</th><th class="r">Silence</th></tr></thead><tbody>
              ${mvt.dormants.slice(0, 8).map(x => `<tr class="clickable" data-client="${h(x.clientId)}"><td>${h(x.name)}</td><td class="nw">${C.fmtDate(x.last)}</td><td class="r nw">${x.days} j</td></tr>`).join('')}
            </tbody></table>
            <p class="small muted mt">Un appel suffit parfois : ce sont des clients qui te connaissent déjà.</p>` : '<p class="small muted">Aucun client endormi. Tu les fais tous travailler.</p>'}
          </div>
          <div class="panel"><h2>Qui paie vite, qui paie tard ${info('stat.payeurs')}</h2>
            ${payers.tous.length ? `<div class="two-col">
              <div><h3 class="sub-h">Les plus rapides</h3><ul class="rank plain">${payers.rapides.map(x => `<li><a class="name" href="#/client/${h(x.clientId)}">${h(x.name)}</a><span class="amt">${x.delay} j</span></li>`).join('')}</ul></div>
              <div><h3 class="sub-h">Les plus lents</h3><ul class="rank plain">${payers.lents.map(x => `<li><a class="name" href="#/client/${h(x.clientId)}">${h(x.name)}</a><span class="amt">${x.delay} j</span></li>`).join('')}</ul></div>
            </div>
            <p class="small muted mt">Délai moyen entre la date de facture et le dernier paiement, sur les factures soldées. Ton délai annoncé est de ${company().paymentTermsDays} jours.</p>`
            : '<div class="empty">Aucune facture soldée pour l\'instant : le classement apparaîtra au premier paiement.</div>'}
          </div>
        </div>`;

      $$('tr.clickable[data-client]').forEach(tr => tr.onclick = () => navigate('#/client/' + tr.dataset.client));
      if ($('#s-goal')) $('#s-goal').onclick = () => askGoal(draw);
      $('#s-export').onclick = async () => {
        const rows = statsCsvRows(p, cur1, prev, funnel, aging, items, clients, mvt, payers, obj);
        const cols = [{ key: 'section', label: 'Rubrique' }, { key: 'label', label: 'Libellé' }, { key: 'value', label: 'Valeur' }];
        const name = `statistiques-${p.kind === 'annee' ? p.year : `${p.year}-${p.kind}${p.n}`}.csv`;
        const f = await bridge.saveText(name, C.toCsv(rows, cols));
        if (f) toast('Exporté : ' + f.split(/[\\/]/).pop());
      };
    };

    fillN();
    $('#s-kind').onchange = e => { statsState.kind = e.target.value; fillN(); draw(); };
    $('#s-year').onchange = e => { statsState.year = e.target.value; draw(); };
    $('#s-n').onchange = e => { statsState.n = e.target.value; draw(); };
    draw();
  };

  // Carte de statistique avec comparaison à la même période de l'an dernier.
  function statCard(label, value, now, before, sub, key) {
    const delta = before ? Math.round((now - before) / Math.abs(before) * 100) : null;
    const cls = delta == null ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : '';
    const tip = delta == null ? 'Rien à comparer sur la même période l\'an dernier'
      : `Même période l'an dernier : ${before}`;
    return `<div class="stat"><div class="lbl">${label} ${info(key)}</div>
      <div class="val"><span>${value}</span>${delta == null ? '' : `<span class="delta ${cls}" title="${h(tip)}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(delta)} %</span>`}</div>
      <div class="sub">${sub}</div></div>`;
  }

  // Histogramme comparatif : la période en cours devant, la même période l'an dernier derrière.
  function compareChart(series, prev) {
    const W = 640, H = 220, left = 48, bottom = 26, top = 10;
    const vals = series.map(x => x.ht).concat(prev.map(x => x.ht));
    const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
    const span = Math.max(1, hi - lo);
    const slot = (W - left) / Math.max(1, series.length);
    const y = v => top + (H - bottom - top) * (1 - (v - lo) / span);
    const zero = y(0);
    const grid = [0, 0.5, 1].map(f => { const v = lo + span * f; return `<line class="grid" x1="${left}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="lbl" x="${left - 6}" y="${y(v) + 4}" text-anchor="end">${hi || lo ? short(v) : (f ? '' : '0')}</text>`; }).join('');
    // Sur un mois seul, deux barres à 34 % d'un créneau large de 600 px seraient deux pavés :
    // on plafonne la largeur et on centre la paire dans son créneau.
    const bw = Math.min(slot * 0.34, 52), gap = Math.min(slot * 0.04, 8);
    const bar = (v, x0, cls, title) => `<rect class="${cls}" x="${x0}" width="${bw}" y="${Math.min(y(v), zero)}" height="${Math.max(1, Math.abs(zero - y(v)))}" rx="2"><title>${h(title)}</title></rect>`;
    const bars = series.map((x, i) => {
      const mid = left + i * slot + slot / 2, p = prev[i];
      const cy = company().currency;
      return (p ? bar(p.ht, mid - bw - gap / 2, 'bar-prev', `${p.label} ${p.month.slice(0, 4)} — ${C.money(p.ht, cy)}`) : '')
        + bar(x.ht, p ? mid + gap / 2 : mid - bw / 2, x.off ? 'bar-inv bar-off' : 'bar-inv', `${x.label} ${x.month.slice(0, 4)} — ${C.money(x.ht, cy)}`)
        + `<text class="lbl" x="${mid}" y="${H - 8}" text-anchor="middle">${h(x.label)}</text>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<line class="axis" x1="${left}" x2="${W}" y1="${zero}" y2="${zero}"/>${bars}</svg>`;
  }

  // Objectif annuel : demandé depuis la page Statistiques, enregistré dans la société.
  function askGoal(after) {
    modal(`<h2>Objectif de chiffre d'affaires</h2>
      <p class="small muted">Le montant HT que tu veux facturer sur une année entière. Tu peux le changer quand tu veux dans Paramètres → Documents.</p>
      <form id="gf"><label class="field">Objectif annuel HT<input type="number" name="target" min="0" step="1" value="${Number(company().revenueTarget) || ''}" placeholder="60000"></label></form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
      (root, close) => { $('#ok', root).onclick = () => {
        const v = formValues($('#gf', root));
        data.company.revenueTarget = Math.max(0, Number(v.target) || 0);
        save(true); close(); if (after) after();
        toast(data.company.revenueTarget ? 'Objectif enregistré' : 'Objectif retiré');
      }; });
  }

  // Export CSV de la page : une ligne par chiffre, pour reprise dans un tableur.
  function statsCsvRows(p, cur1, prev, funnel, aging, items, clients, mvt, payers, obj) {
    const cur = company().currency;
    const m = n => C.money(n, cur);
    const rows = [
      { section: 'Période', label: 'Analysée', value: p.label },
      { section: 'Période', label: 'Du', value: p.from }, { section: 'Période', label: 'Au', value: p.to },
      { section: 'Ventes', label: 'Chiffre d\'affaires HT', value: m(cur1.ht) },
      { section: 'Ventes', label: 'Chiffre d\'affaires HT — même période l\'an dernier', value: m(prev.ht) },
      { section: 'Ventes', label: 'TVA collectée', value: m(cur1.vat) },
      { section: 'Ventes', label: 'Total TTC', value: m(cur1.ttc) },
      { section: 'Ventes', label: 'Factures émises', value: cur1.invoices },
      { section: 'Ventes', label: 'Panier moyen HT', value: m(cur1.avgTicket) },
      { section: 'Devis', label: 'Émis', value: funnel.total },
      { section: 'Devis', label: 'Acceptés', value: `${funnel.accepted} (${m(funnel.acceptedAmount)})` },
      { section: 'Devis', label: 'Refusés', value: `${funnel.refused} (${m(funnel.refusedAmount)})` },
      { section: 'Devis', label: 'Expirés sans réponse', value: `${funnel.expired} (${m(funnel.expiredAmount)})` },
      { section: 'Devis', label: 'En attente', value: `${funnel.pending} (${m(funnel.pendingAmount)})` },
      { section: 'Devis', label: 'Taux d\'acceptation', value: funnel.rate == null ? '' : funnel.rate + ' %' },
      { section: 'Devis', label: 'Délai moyen de réponse (jours)', value: funnel.replyDelay == null ? '' : funnel.replyDelay }
    ];
    aging.buckets.forEach(b => rows.push({ section: 'Impayés', label: b.label, value: `${b.count} — ${m(b.amount)}` }));
    rows.push({ section: 'Impayés', label: 'Total dû', value: m(aging.total) });
    items.forEach((x, i) => rows.push({ section: 'Prestations', label: `${i + 1}. ${x.label}`, value: m(x.ht) }));
    clients.forEach((x, i) => rows.push({ section: 'Clients', label: `${i + 1}. ${x.name}`, value: m(x.ht) }));
    mvt.nouveaux.forEach(x => rows.push({ section: 'Nouveaux clients', label: x.name, value: `${C.fmtDate(x.since)} — ${m(x.ht)}` }));
    mvt.dormants.forEach(x => rows.push({ section: 'Clients endormis', label: x.name, value: `${C.fmtDate(x.last)} — ${x.days} jours` }));
    payers.tous.forEach(x => rows.push({ section: 'Délai de paiement', label: x.name, value: `${x.delay} jours sur ${x.count} facture(s)` }));
    if (obj) {
      rows.push({ section: 'Objectif', label: 'Objectif annuel HT', value: m(obj.goal) });
      rows.push({ section: 'Objectif', label: 'Réalisé', value: `${m(obj.ht)} (${obj.pct} %)` });
      rows.push({ section: 'Objectif', label: 'Reste à facturer', value: m(obj.remaining) });
    }
    return rows;
  }

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
        <div class="actions" id="c-period" ${comptaState.tab === 'calendrier' ? 'hidden' : ''}>
          <select id="c-year">${years.map(y => `<option ${y === comptaState.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <select id="c-month"><option value="">Toute l'année</option>${MONTHS.map((m, i) => { const v = String(i + 1).padStart(2, '0'); return `<option value="${v}" ${v === comptaState.month ? 'selected' : ''}>${m}</option>`; }).join('')}</select>
        </div></div>
      <div class="tabs" id="c-tabs" role="tablist">${COMPTA_TABS.map(([id, label]) =>
        `<button role="tab" data-tab="${id}" class="${id === comptaState.tab ? 'active' : ''}">${label}</button>`).join('')}</div>
      <div id="c-body"></div>`;
    const draw = () => {
      $('#c-period').hidden = ['calendrier', 'clotures', 'cabinet'].includes(comptaState.tab);
      if (comptaState.tab === 'achats') return drawBuyJournal(period(), periodLabel());
      if (comptaState.tab === 'tva') return drawVat();
      if (comptaState.tab === 'ecritures') return drawEntries();
      if (comptaState.tab === 'calendrier') return drawFiscal();
      if (comptaState.tab === 'clotures') return drawClosures();
      if (comptaState.tab === 'cabinet') return drawCabinet();
      const p = period();
      // Recherche : la Comptabilité était l'autre page de liste sans champ de recherche (audit).
      const q = comptaState.q.trim().toLowerCase();
      const hit = (...parts) => !q || parts.filter(Boolean).join(' ').toLowerCase().includes(q);
      const allRows = C.salesJournal(data, company(), p);
      const rows = allRows.filter(r => hit(r.number, r.client, r.subject, r.creditOfNumber));
      const sum = C.vatSummary(rows);
      const allPays = C.paymentsJournal(data, company(), p);
      const pays = allPays.filter(r => hit(r.number, r.client, r.reference, r.method));
      const paidTotal = pays.reduce((s, r) => s + r.amount, 0);
      const open = data.documents.filter(d => d.type === 'facture' && ['envoyée', 'partielle', 'retard'].includes(effStatus(d)));
      // Converti, comme sa jumelle de l'accueil : une facture en euros ne s'additionne pas
      // à une facture en dinars (7.16.0).
      const openAmount = open.reduce((s, d) => s + C.toBase(d, balance(d).remaining, company()), 0);
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
        <div class="filters">
          <input type="search" id="cpt-q" placeholder="Rechercher : n°, client, objet, référence…" value="${h(comptaState.q)}">
          ${q ? `<span class="small muted">${rows.length} sur ${allRows.length} document(s) · ${pays.length} sur ${allPays.length} paiement(s)</span>
            ${filterReset(true)}
            <span class="small warn-text">Les totaux ci-dessous ne portent que sur la sélection.</span>` : ''}
        </div>
        <div class="stats">
          <div class="stat"><div class="lbl">CA HT — ${h(periodLabel())} ${info('dash.caMonth')}</div><div class="val">${C.money(sum.ht, cur)}</div><div class="sub">${sum.count} document(s), avoirs déduits</div></div>
          <div class="stat"><div class="lbl">TVA collectée ${info('compta.vat')}</div><div class="val">${C.money(sum.tva, cur)}</div><div class="sub">+ timbres ${C.money(sum.timbre, cur)}</div></div>
          <div class="stat"><div class="lbl">Encaissé sur la période ${info('compta.payments')}</div><div class="val">${C.money(paidTotal, cur)}</div><div class="sub">${pays.length} paiement(s)</div></div>
          <div class="stat" data-cstat="encaisser" role="button" tabindex="0" title="Voir les factures qui restent à encaisser"><div class="lbl">Reste à encaisser (total) ${info('dash.open')}</div><div class="val">${C.money(openAmount, cur)}</div><div class="sub">${pl(open.length, 'facture ouverte', 'factures ouvertes')}</div></div>
        </div>
        <div class="panel"><h2>TVA par taux — ${h(periodLabel())} ${info('compta.vat')}</h2>
          <table class="list compact"><thead><tr><th>Taux</th><th class="r">Base HT</th><th class="r">TVA</th></tr></thead><tbody>
            ${C.VAT_RATES.map(r => `<tr><td>TVA ${r} %</td><td class="r">${C.money(sum.byRate[r].base, cur)}</td><td class="r">${C.money(sum.byRate[r].vat, cur)}</td></tr>`).join('')}
            <tr class="total-row"><td><strong>Total</strong></td><td class="r"><strong>${C.money(sum.ht, cur)}</strong></td><td class="r"><strong>${C.money(sum.tva, cur)}</strong></td></tr>
          </tbody></table>
          <p class="small muted mt">Timbres fiscaux : ${C.money(sum.timbre, cur)} · TTC facturé : ${C.money(sum.ttc, cur)} · Retenues à la source subies : ${C.money(sum.rs, cur)}. <em>À VÉRIFIER avec le comptable</em> avant déclaration.</p>
        </div>
        <div class="panel"><h2>Journal des ventes — ${h(periodLabel())} ${info('compta.journal')}</h2>
          <div class="inline mb"><button class="btn" id="exp-journal">Exporter en CSV</button><button class="btn" id="exp-pdfs">Exporter tous les PDF de la période</button><button class="btn btn-primary" id="exp-comptable">Envoyer au comptable…</button>${info('compta.comptable')}</div>
          ${rows.length ? `<div class="scroll-x" id="j-wrap"><table class="list compact sortable"><thead>${sortHead(journalCols, comptaState.journal.sort)}</thead><tbody>
            ${jPage.rows.map(r => `<tr class="clickable" data-id="${r.id}">${journalCols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>${pagerBar(jPage.pg, { noun: 'document' })}` : '<div class="empty">Aucune facture émise sur cette période.</div>'}
        </div>
        <div class="panel"><h2>Encaissements — ${h(periodLabel())}</h2>
          <div class="inline mb"><button class="btn" id="exp-pays">Exporter en CSV</button></div>
          ${pays.length ? `<div id="p-wrap"><table class="list compact sortable"><thead>${sortHead(payCols, comptaState.pays.sort)}</thead><tbody>
            ${pPage.rows.map(r => `<tr class="clickable" data-id="${r.docId}">${payCols.map(c => `<td class="${c.r ? 'r nw' : ''}">${c.get(r)}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>${pagerBar(pPage.pg, { noun: 'paiement' })}` : '<div class="empty">Aucun encaissement sur cette période.</div>'}
        </div>
        <div class="panel" id="p-rs-clients"><h2>Retenues à la source — attestations à recevoir ${info('compta.rs')}</h2>
          ${rsPending.length ? `<p class="small muted">${C.money(rsPendingAmount, cur)} retenus par tes clients sans attestation reçue. Coche quand l'attestation arrive (elle justifie la retenue auprès du fisc).</p>
          <table class="list compact"><thead><tr><th>Facture</th><th>Client</th><th>Date</th><th class="r">Retenue</th><th></th></tr></thead><tbody>
            ${rsPending.map(d => { const t = C.computeTotals(d, company()); return `<tr class="clickable" data-id="${d.id}"><td><strong>${h(d.number)}</strong></td><td>${h(clientName(d.clientId))}</td><td>${C.fmtDate(d.date)}</td><td class="r">${C.money(t.withholding, cur)} <span class="muted small">(${pct(t.withholdingRate)} %)</span></td><td class="actions"><button class="btn btn-sm" data-cert="${d.id}">Attestation reçue</button></td></tr>`; }).join('')}
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
      // Même règle que « Marquer déposée » : la ligne quitte la liste des attestations manquantes,
      // et le seul endroit où l'on peut décocher est la fiche de la facture. Le retour vient à nous.
      $$('[data-cert]').forEach(b => b.onclick = () => {
        const d = docById(b.dataset.cert);
        d.withholdingCertificate = true; save(true); draw();
        toastUndo('Attestation notée reçue pour ' + d.number, () => { d.withholdingCertificate = false; save(true); draw(); });
      });
      const tag = tagOf();
      // Envoi au comptable : journal de la période en pièce jointe, message prérempli
      $('#exp-comptable').onclick = async () => {
        if (await demoBlock('Envoyer la comptabilité au comptable')) return;
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
      // La carte « Reste à encaisser » affichait le même chiffre que sa jumelle de l'accueil et,
      // contrairement à elle, n'ouvrait rien : la 7.15.0 n'avait armé que le tableau de bord.
      $$('#c-body .stat[data-cstat]').forEach(el => {
        const go = e => { if (e.target.closest('.i[data-info]')) return; filtre('facture', 'à encaisser')(); navigate('#/factures'); };
        el.onclick = go;
        el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } };
      });
      $('#cpt-q').oninput = e => { comptaState.q = e.target.value; comptaState.journal.page = 1; comptaState.pays.page = 1; draw(); const el = $('#cpt-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
      if ($('#reset-f')) $('#reset-f').onclick = () => { comptaState.q = ''; draw(); };
      $('#exp-journal').onclick = async () => {
        const p2 = await bridge.saveText(`journal-ventes-${tag}.csv`, C.toCsv(rows, journalColumns())); if (p2) toast('Exporté : ' + p2.split(/[\\/]/).pop());
      };
      $('#exp-pays').onclick = async () => {
        const p2 = await bridge.saveText(`encaissements-${tag}.csv`, C.toCsv(pays, payColumns())); if (p2) toast('Exporté : ' + p2.split(/[\\/]/).pop());
      };
      $('#exp-pdfs').onclick = async () => {
        if (!rows.length) return toast('Rien à exporter sur cette période.', true);
        const files = rows.map(r => { const d = docById(r.id); return { name: `${d.number}_${(r.client || '').replace(/[^\w\-àâäéèêëïîôöùûüç ]/gi, '').trim().replace(/\s+/g, '_')}.pdf`, html: C.documentHtml(d, clientById(d.clientId), company(), { stampText: stampFor(d) }) }; });
        toast(`Génération de ${files.length} PDF…`);
        try { const dir = await bridge.exportPdfMany(files, `SkanFact-${tag}`); if (dir) { toast(`${files.length} PDF exportés`); bridge.openPath(dir); } }
        catch (e) { toast('Erreur : ' + e.message, true); }
      };
    };
    // ---------- onglet Achats : le journal symétrique de celui des ventes ----------
    function drawBuyJournal(p, label) {
      const q = comptaState.q.trim().toLowerCase();
      const allRows = C.purchaseJournal(data, company(), p);
      const rows = allRows.filter(r => !q || `${r.number || ''} ${r.supplier || ''} ${r.subject || ''} ${r.category || ''}`.toLowerCase().includes(q));
      const sum = C.purchaseSummary(rows);
      const cols = [
        { key: 'date', label: 'Date', asc: true, cls: 'nw', val: r => r.date || '', get: r => C.fmtDate(r.date) },
        { key: 'number', label: 'N° fournisseur', asc: true, cls: 'nw', val: r => (r.number || '').toLowerCase(), get: r => r.number ? `<strong>${h(r.number)}</strong>` : '<span class="muted">sans numéro</span>' },
        { key: 'supplier', label: 'Fournisseur', asc: true, val: r => r.supplier.toLowerCase(), get: r => `${h(r.supplier)}${r.subject ? `<div class="small muted">${h(r.subject)}</div>` : ''}` },
        { key: 'category', label: 'Catégorie', asc: true, val: r => (r.category || '').toLowerCase(), get: r => `${h(r.category || '—')}${r.kind === 'Dépense' ? '<div class="small muted">dépense</div>' : ''}` },
        { key: 'ht', label: 'HT', r: true, val: r => r.ht, get: r => C.money(r.ht) },
        { key: 'tva', label: 'TVA', r: true, val: r => r.tva, get: r => C.money(r.tva) },
        { key: 'deductible', label: 'dont déductible', r: true, val: r => r.deductible, get: r => r.deductible === r.tva ? C.money(r.deductible) : `<strong>${C.money(r.deductible)}</strong>` },
        { key: 'net', label: 'Net payé', r: true, val: r => r.net, get: r => C.money(r.net) },
        { key: 'status', label: 'Statut', val: r => r.status, get: r => buyBadge(r.status) }
      ];
      const pg = paginate(applySort(rows, cols, comptaState.buys.sort), comptaState.buys);
      $('#c-body').innerHTML = `
        <div class="filters">
          <input type="search" id="cpt-q" placeholder="Rechercher : n°, fournisseur, objet, catégorie…" value="${h(comptaState.q)}">
          ${q ? `<span class="small muted">${rows.length} sur ${allRows.length}</span>${filterReset(true)}
            <span class="small warn-text">Les totaux ne portent que sur la sélection.</span>` : ''}
        </div>
        <div class="stats">
          <div class="stat"><div class="lbl">Achats HT — ${h(label)} ${info('compta.buyJournal')}</div><div class="val">${C.money(sum.ht, cur)}</div><div class="sub">${sum.count} pièce(s)</div></div>
          <div class="stat"><div class="lbl">TVA déductible ${info('compta.deductible')}</div><div class="val">${C.money(sum.deductible, cur)}</div><div class="sub">${sum.deductible === sum.tva ? 'toute la TVA payée' : `sur ${C.money(sum.tva, cur)} payés`}</div></div>
          <div class="stat"><div class="lbl">Retenues opérées ${info('buy.withholding')}</div><div class="val">${C.money(sum.rs, cur)}</div><div class="sub">à reverser au fisc</div></div>
          <div class="stat"><div class="lbl">Total réglé ou dû ${info('compta.buyNet')}</div><div class="val">${C.money(sum.net, cur)}</div><div class="sub">net à payer, toutes pièces</div></div>
        </div>
        ${sum.byCategory.length ? `<div class="panel"><h2>Où part ton argent — ${h(label)} ${info('compta.byCategory')}</h2>
          <ul class="rank">${sum.byCategory.slice(0, 10).map(x => `<li><span class="name">${h(x.label)}</span><span class="bar"><i style="width:${Math.max(4, Math.round(x.ht / Math.max(1, sum.byCategory[0].ht) * 100))}%"></i></span><span class="amt">${C.money(x.ht, cur)}</span></li>`).join('')}</ul>
        </div>` : ''}
        <div class="panel"><h2>Journal des achats — ${h(label)} ${info('compta.buyJournal')}</h2>
          <div class="inline mb"><button class="btn" id="exp-buys">Exporter en CSV</button></div>
          ${rows.length ? `<div class="scroll-x" id="b-wrap"><table class="list compact sortable"><thead>${sortHead(cols, comptaState.buys.sort)}</thead><tbody>
            ${pg.rows.map(r => `<tr class="clickable" data-bid="${r.id}">${cols.map(c => `<td class="${c.r ? 'r nw' : ''}${c.cls ? ' ' + c.cls : ''}">${c.get(r)}</td>`).join('')}</tr>`).join('')}
          </tbody><tfoot><tr><td colspan="4"><strong>Total</strong></td><td class="r"><strong>${C.money(sum.ht)}</strong></td><td class="r"><strong>${C.money(sum.tva)}</strong></td>
            <td class="r"><strong>${C.money(sum.deductible)}</strong></td><td class="r"><strong>${C.money(sum.net)}</strong></td><td></td></tr></tfoot></table></div>${pagerBar(pg.pg, { noun: 'pièce' })}`
            : '<div class="empty">Aucun achat sur cette période.</div>'}
        </div>`;
      $$('#c-body tr[data-bid]').forEach(tr => tr.onclick = () => navigate('#/achat/' + tr.dataset.bid));
      $('#cpt-q').oninput = e => { comptaState.q = e.target.value; comptaState.buys.page = 1; draw(); const el = $('#cpt-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
      if ($('#reset-f')) $('#reset-f').onclick = () => { comptaState.q = ''; draw(); };
      const panel = $('#b-wrap') && $('#b-wrap').closest('.panel');
      if (panel) {
        bindSort(panel, key => { comptaState.buys.sort = toggleSort(comptaState.buys.sort, key, cols); comptaState.buys.page = 1; draw(); });
        bindPager(panel, comptaState.buys, () => draw(), '#b-wrap');
      }
      $('#exp-buys').onclick = async () => {
        if (!rows.length) return toast('Rien à exporter sur cette période.', true);
        const f = await bridge.saveText(`journal-achats-${tagOf()}.csv`, C.toCsv(rows, buyJournalColumns()));
        if (f) toast('Exporté : ' + f.split(/[\\/]/).pop());
      };
    }

    // ---------- onglet TVA : la soustraction qui manquait ----------
    function drawVat() {
      const year = comptaState.year;
      // La TVA se déclare par mois : le bloc du haut porte toujours sur UN mois. Sans mois choisi,
      // on prend le mois en cours si l'année affichée est l'année en cours, sinon décembre — et on le dit.
      const auto = !comptaState.month;
      const upTo = comptaState.month ? Number(comptaState.month)
        : (year === C.today().slice(0, 4) ? Number(C.today().slice(5, 7)) : 12);
      const chain = C.vatChain(data, company(), year, 12);
      const cur1 = chain[upTo - 1] || null;
      const res = C.simpleResult(data, company(), period());
      const carryIn = Number((data.vatCarryIn || {})[year]) || 0;
      $('#c-body').innerHTML = `
        <div class="panel"><h2>Déclaration de TVA — ${h(MONTHS[upTo - 1])} ${year} ${info('compta.vatReturn')}</h2>
          ${auto ? `<p class="small muted mb">La TVA se déclare mois par mois : voici ${h(MONTHS[upTo - 1])}. Choisis un autre mois en haut à droite, ou lis le tableau ci-dessous pour toute l'année.</p>` : ''}
          ${cur1 && !cur1.collected && !cur1.deductible && !cur1.carryIn
            // Sur une base vide, `toPay` vaut 0, donc la ligne verte annonçait « Crédit de TVA
            // reportable sur la période suivante » à quelqu'un qui n'a jamais facturé. Et la
            // branche « Rien à déclarer » était du CODE MORT : `vatChain` renvoie toujours douze
            // mois, donc `cur1` n'est jamais null — elle faisait croire que le cas était traité.
            ? `<p>Rien à déclarer pour ${h(MONTHS[upTo - 1])} ${year} : aucune vente, aucun achat sur ce mois.</p>
               <p class="small muted">Cette page calculera <b>TVA collectée sur tes ventes − TVA déductible sur tes achats</b>. Si le résultat est négatif, le crédit se reporte sur le mois suivant tout seul. <em>À VÉRIFIER avec ton comptable : ta périodicité de dépôt et les taux qui s'appliquent à ton activité.</em></p>`
            : cur1 ? `<div class="vat-box">
            <div class="vat-line"><span>TVA collectée sur tes ventes</span><span class="num">${C.money(cur1.collected, cur)}</span></div>
            <div class="vat-line minus"><span>− TVA déductible sur tes achats</span><span class="num">${C.money(cur1.deductible, cur)}</span></div>
            ${cur1.carryIn ? `<div class="vat-line minus"><span>− Crédit de TVA reporté ${info('compta.carry')}</span><span class="num">${C.money(cur1.carryIn, cur)}</span></div>` : ''}
            <div class="vat-line total ${cur1.toPay ? 'due' : 'ok'}">
              <span>${cur1.toPay ? 'TVA à reverser' : 'Crédit de TVA reportable sur la période suivante'}</span>
              <span class="num">${C.money(cur1.toPay || cur1.carryOut, cur)}</span></div>
          </div>
          <p class="small muted mt">Timbres fiscaux encaissés sur la période : ${C.money(cur1.stamps, cur)} · retenues subies : ${C.money(cur1.withheldBySale, cur)} · retenues que tu as opérées : ${C.money(cur1.withheldOnBuys, cur)}. Ces trois lignes se déclarent séparément de la TVA. <em>À VÉRIFIER avec ton comptable.</em></p>` : ''}
          ${cur1 && (cur1.collected || cur1.deductible) ? `<div class="inline mt">
            <button class="btn btn-sm" id="vat-ventes">Voir les ventes de ${h(MONTHS[upTo - 1])}</button>
            <button class="btn btn-sm" id="vat-achats">Voir les achats de ${h(MONTHS[upTo - 1])}</button>
          </div>` : ''}
          <div class="inline mt"><button class="btn btn-sm" id="set-carry">Crédit de TVA venu de ${Number(year) - 1} : ${C.money(carryIn, cur)}</button>${info('compta.carryIn')}</div>
        </div>
        ${chain.some(m => m.collected || m.deductible || m.carryIn) ? `
        <div class="panel"><h2>Mois par mois — ${year} ${info('compta.vatMonths')}</h2>
          <table class="list compact"><thead><tr><th>Mois</th><th class="r">Collectée</th><th class="r">Déductible</th><th class="r">Crédit repris</th><th class="r">À payer</th><th class="r">Crédit reporté</th></tr></thead><tbody>
            ${chain.map((m, i) => `<tr class="clickable ${m.toPay ? '' : 'row-ok'}" data-vm="${String(i + 1).padStart(2, '0')}" title="Voir la déclaration de ${h(m.label)}"><td>${h(m.label)}</td><td class="r nw">${C.money(m.collected)}</td><td class="r nw">${C.money(m.deductible)}</td>
              <td class="r nw">${m.carryIn ? C.money(m.carryIn) : '<span class="muted">—</span>'}</td>
              <td class="r nw">${m.toPay ? `<strong>${C.money(m.toPay)}</strong>` : '<span class="muted">—</span>'}</td>
              <td class="r nw">${m.carryOut ? C.money(m.carryOut) : '<span class="muted">—</span>'}</td></tr>`).join('')}
            <tr class="total-row"><td><strong>Total à reverser</strong></td><td class="r">${C.money(chain.reduce((s, m) => s + m.collected, 0))}</td>
              <td class="r">${C.money(chain.reduce((s, m) => s + m.deductible, 0))}</td><td></td>
              <td class="r"><strong>${C.money(chain.reduce((s, m) => s + m.toPay, 0))}</strong></td><td></td></tr>
          </tbody></table>
          <p class="small muted mt">Le crédit d'un mois vient en déduction du suivant : c'est pour ça que le total ne se lit pas ligne par ligne. <em>Ces chiffres sont l'arithmétique exacte de tes données, pas une déclaration officielle : à faire valider par ton comptable avant tout dépôt.</em></p>
        </div>
        ` : ''}
        <div class="panel"><h2>Résultat simplifié — ${h(periodLabel())} ${info('compta.result')}</h2>
          <div class="stats compact-stats">
            <div class="stat"><div class="lbl">Produits (ventes HT)</div><div class="val">${C.money(res.produits, cur)}</div><div class="sub">${res.salesCount} pièce(s)</div></div>
            <div class="stat"><div class="lbl">Charges HT</div><div class="val">${C.money(res.charges, cur)}</div><div class="sub">${res.buysCount} pièce(s) d'achat</div></div>
            <div class="stat"><div class="lbl">Coût des marchandises vendues ${info('stk.cogs')}</div><div class="val">${C.money(res.cogs, cur)}</div><div class="sub">${res.cogs ? 'sorties de stock, au coût moyen' : 'aucune sortie de stock'}</div></div>
            <div class="stat"><div class="lbl">Coût de la paie ${info('pay.employerCost')}</div><div class="val">${C.money(res.payroll, cur)}</div><div class="sub">${res.payroll ? 'brut + charges patronales' : 'aucun bulletin sur la période'}</div></div>
            <div class="stat"><div class="lbl">Dotation aux amortissements ${info('immo.annuity')}</div><div class="val">${C.money(res.depreciation, cur)}</div><div class="sub">${res.depreciation ? 'une charge qui ne sort pas d\'argent' : 'aucun bien amorti sur la période'}</div></div>
            <div class="stat"><div class="lbl">Résultat avant impôt</div><div class="val ${res.resultat >= 0 ? 'ok' : 'due'}">${C.money(res.resultat, cur)}</div><div class="sub">${res.marge == null ? '' : res.marge + ' % du chiffre d\'affaires'}</div></div>
            <div class="stat"><div class="lbl">Non comptés en charges</div><div class="val">${C.money(C.round3(res.stock + res.immo), cur)}</div><div class="sub">${C.money(res.stock, cur)} en stock · ${C.money(res.immo, cur)} en immobilisations</div></div>
          </div>
          <p class="small muted mt"><em>Ce n'est pas ton résultat comptable :</em> il manque les provisions. Les amortissements y sont depuis la 3.5.0 (<a href="#/immos">Immobilisations</a>), la variation de stock depuis la 4.0.0 (<a href="#/stock">Stock</a>) et les salaires depuis la 5.0.0 (<a href="#/paie">Paie</a>). C'est un ordre de grandeur pour savoir où tu en es, pas un bilan. <em>À VÉRIFIER avec ton comptable.</em></p>
        </div>`;
      // Cinq chiffres sur lesquels tout repose, et aucun ne menait à la pièce qui le fabrique : il
      // fallait retenir le mois, changer d'onglet, refaire le filtre. Les douze lignes du tableau
      // ouvrent maintenant leur propre mois, et deux boutons mènent au journal correspondant.
      const versOnglet = (tab, mois) => { comptaState.month = mois; comptaState.tab = tab; draw(); $$('#c-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); };
      $$('#c-body tr[data-vm]').forEach(tr => tr.onclick = () => { comptaState.month = tr.dataset.vm; if ($('#c-month')) $('#c-month').value = tr.dataset.vm; draw(); });
      if ($('#vat-ventes')) $('#vat-ventes').onclick = () => versOnglet('ventes', String(upTo).padStart(2, '0'));
      if ($('#vat-achats')) $('#vat-achats').onclick = () => versOnglet('achats', String(upTo).padStart(2, '0'));
      $('#set-carry').onclick = () => promptDialog('Crédit de TVA reporté',
        `Crédit de TVA restant à la fin de ${Number(year) - 1}, tel qu'il figure sur ta dernière déclaration. Il viendra en déduction du premier mois de ${year}.`,
        String(carryIn || ''), v => {
          data.vatCarryIn = { ...(data.vatCarryIn || {}), [year]: Math.max(0, Number(String(v).replace(',', '.')) || 0) };
          save(true); draw(); toast('Crédit de TVA enregistré');
        }, 'number');
    }

    // ---------- onglet Calendrier fiscal ----------
    // Clôturer un mois, c'est promettre que ce mois ne bougera plus. C'est ce qui permet d'envoyer
    // un dossier au comptable sans qu'il change dans son dos. Rouvrir reste possible — mais tracé.
    // ---------- Écritures comptables (Cabinet 1.1.0) ----------
    // Ce que le comptable retape aujourd'hui pièce par pièce. Ici, c'est un fichier.
    function drawEntries() {
      const cur = company().currency;
      const p = period();
      const entries = C.journalEntries(data, company(), p, {});
      const bal = C.entriesBalance(entries);
      const acc = C.chartAccounts(data);
      const byAcc = C.entriesByAccount(entries);
      const cols = [
        { key: 'date', label: 'Date', val: e => e.date },
        { key: 'journal', label: 'Journal', val: e => e.journal },
        { key: 'piece', label: 'Pièce', val: e => e.piece },
        { key: 'account', label: 'Compte', val: e => e.account },
        { key: 'label', label: 'Libellé', val: e => e.label },
        { key: 'debit', label: 'Débit', r: true, info: 'ecr.quoi', val: e => e.debit },
        { key: 'credit', label: 'Crédit', r: true, info: 'ecr.quoi', val: e => e.credit }
      ];
      const sorted = applySort(entries, cols, ecrState.sort);
      const { rows, pg } = paginate(sorted, ecrState);

      $('#c-body').innerHTML = `
        <div class="panel"><h2>Écritures — ${h(periodLabel())} ${info('ecr.quoi')}</h2>
          <p class="small">Les pièces de la période transformées en écritures comptables, en partie double, prêtes à importer dans le logiciel de ton comptable. Il n'a plus rien à retaper.</p>
          <div class="pay-grid">
            <div><div class="k-label">Lignes</div><div class="v">${bal.lines}</div></div>
            <div><div class="k-label">Pièces</div><div class="v">${bal.pieces}</div></div>
            <div><div class="k-label">Total débit</div><div class="v">${C.money(bal.debit, cur)}</div></div>
            <div><div class="k-label">Total crédit</div><div class="v ${bal.balanced ? 'ok' : 'due'}">${C.money(bal.credit, cur)}</div></div>
          </div>
          ${!bal.lines
            ? '<div class="banner info"><span>Aucune pièce sur cette période : il n\'y a rien à exporter. Choisis un autre mois en haut à droite.</span></div>'
            : bal.balanced
            ? '<div class="todo-ok">Débit = crédit sur chaque pièce : le fichier passera à l\'import.</div>'
            : `<div class="banner"><span>${bal.off.length} pièce${bal.off.length > 1 ? 's' : ''} ne tombe${bal.off.length > 1 ? 'nt' : ''} pas juste — signale-le avant d'envoyer.</span></div>`}
          <p class="small muted"><em>À VÉRIFIER avec ton comptable :</em> les numéros de compte ci-dessous sont ceux du plan comptable tunisien tel qu'il est couramment utilisé, mais chaque cabinet a ses habitudes. Ils se modifient dans « Plan de comptes », et l'export suit.</p>
          <div class="inline mt">
            <button class="btn" id="ecr-csv" ${bal.lines ? '' : 'disabled'}>Exporter en CSV</button>
            <button class="btn" id="ecr-mail" ${bal.lines ? '' : 'disabled'}>Envoyer au comptable</button>
            <button class="btn btn-ghost" id="ecr-plan">Plan de comptes…</button>
          </div>
        </div>

        <div class="panel"><h2>Par compte</h2>
          ${byAcc.length ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Compte</th><th>Intitulé</th><th class="r">Débit</th><th class="r">Crédit</th><th class="r">Solde</th></tr></thead><tbody>
            ${byAcc.map(a => { const key = Object.keys(acc).find(k => acc[k] === a.account); return `<tr>
              <td class="nw"><strong>${h(a.account)}</strong></td>
              <td class="muted">${h(key ? C.ACCOUNT_LABELS[key] : 'Compte hors plan')}</td>
              <td class="r nw">${C.money(a.debit)}</td><td class="r nw">${C.money(a.credit)}</td>
              <td class="r nw">${C.money(a.solde)}</td></tr>`; }).join('')}
          </tbody></table></div>` : '<div class="empty">—</div>'}
          <!-- « Retenue à la source opérée » et « subie » s'affichent l'une SOUS l'autre, avec des
               numéros de compte voisins, et rien dans toute l'application ne les distinguait : deux
               mots de la même famille pour deux choses opposées, au seul endroit où on les voit
               côte à côte. -->
          <p class="small muted mt"><b>Retenue à la source opérée</b> : ce que <b>tu</b> as retenu en payant un fournisseur, et que tu dois reverser au Trésor à sa place — tu lui en remets l'attestation.
          <b>Subie</b> : ce que <b>tes clients</b> t'ont retenu sur tes factures, et que tu récupéreras sur ton impôt, avec l'attestation qu'ils te doivent. ${info('ecr.rs')}</p>
          <p class="small muted mt">Un compte inattendu ou un solde qui surprend se corrige dans le plan de comptes : les écritures se recalculent aussitôt.</p>
        </div>

        <div class="panel"><h2>Le détail</h2>
          ${entries.length ? `<div class="scroll-x"><table class="list compact" id="ecr-t">
            <thead>${sortHead(cols, ecrState.sort)}</thead>
            <tbody>${rows.map(e => `<tr>
              <td class="nw">${C.fmtDate(e.date)}</td><td>${h(e.journal)}</td><td class="nw">${h(e.piece)}</td>
              <td class="nw"><strong>${h(e.account)}</strong></td><td>${h(e.label)}</td>
              <td class="r nw">${e.debit ? C.money(e.debit) : '<span class="muted">—</span>'}</td>
              <td class="r nw">${e.credit ? C.money(e.credit) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody>
            <tfoot><tr class="total-row"><td colspan="5">Total de la sélection</td>
              <td class="r nw"><strong>${C.money(bal.debit)}</strong></td><td class="r nw"><strong>${C.money(bal.credit)}</strong></td></tr></tfoot>
          </table></div>${pagerBar(pg, { noun: 'écriture' })}`
            : '<div class="empty">Aucune pièce sur cette période.</div>'}
        </div>`;

      bindSort($('#c-body'), key => { ecrState.sort = toggleSort(ecrState.sort, key, cols); ecrState.page = 1; drawEntries(); });
      bindPager($('#c-body'), ecrState, drawEntries);
      const tag = comptaState.month ? `${comptaState.year}-${comptaState.month}` : comptaState.year;
      $('#ecr-csv').onclick = async () => {
        const f = await bridge.saveText(`ecritures-${tag}.csv`, C.toCsv(sorted, C.entryCsvColumns()));
        if (f) toast('Exporté : ' + f.split(/[\\/]/).pop());
      };
      $('#ecr-mail').onclick = async () => {
        if (await demoBlock('Envoyer les écritures au comptable')) return;
        const att = await bridge.saveTextSilent(`ecritures-${tag}.csv`, C.toCsv(sorted, C.entryCsvColumns()));
        const r = await bridge.composeMail({
          to: company().accountantEmail || '', subject: `Écritures ${periodLabel()} — ${company().name || ''}`,
          body: `Bonjour,\n\nVoici les écritures comptables de ${periodLabel()} : ${bal.lines} lignes, ${bal.pieces} pièces, débit = crédit = ${C.money(bal.debit, cur)}.\n\nLes numéros de compte sont ceux réglés dans SkanFact ; dis-moi s'ils ne correspondent pas aux tiens, je les change.\n\nBien à toi,\n${company().name || ''}`,
          attachments: att ? [att] : []
        });
        toast(r && r.state === 'mail' ? 'Message préparé dans Mail' : 'Message préparé');
      };
      $('#ecr-plan').onclick = () => chartForm(drawEntries);
    }

    // Le plan de comptes. Aucun numéro n'est certain : le comptable a le dernier mot, donc tout
    // se modifie, et « Revenir aux comptes proposés » ramène la proposition de départ.
    function chartForm(done) {
      const acc = C.chartAccounts(data);
      const keys = Object.keys(C.DEFAULT_ACCOUNTS);
      modal(`<h2>Plan de comptes</h2>
        <p class="small muted">Demande ces numéros à ton comptable : ce sont les siens qui comptent, pas les nôtres. Les écritures exportées les reprendront tels quels. <em>À VÉRIFIER.</em></p>
        <form id="chf"><table class="list compact"><tbody>
          ${keys.map(k => `<tr><td>${h(C.ACCOUNT_LABELS[k] || k)}</td>
            <td style="width:140px"><input type="text" name="${h(k)}" value="${h(acc[k])}" placeholder="${h(C.DEFAULT_ACCOUNTS[k])}"></td></tr>`).join('')}
        </tbody></table></form>
        <div class="modal-actions"><button class="btn btn-ghost" id="ch-reset">Revenir aux comptes proposés</button>
          <button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ch-ok">Enregistrer</button></div>`,
        (layer, close) => {
          // Ce bouton jette des numéros de compte que le cabinet a dictés un par un. Il ne s'exécute
          // pas sur un clic : une fois la fenêtre fermée, plus rien ne les retrouve.
          $('#ch-reset', layer).onclick = async () => {
            const perso = Object.keys(data.chartAccounts || {}).length;
            if (perso && !await confirmDialog(
              `Remettre les ${perso} compte${perso > 1 ? 's' : ''} que tu as modifié${perso > 1 ? 's' : ''} à la proposition de départ ?\n\n`
              + 'Les numéros que ton comptable t\'a donnés seront perdus : il n\'y a pas de retour en arrière une fois la fenêtre fermée.',
              'Remettre la proposition', true)) return;
            delete data.chartAccounts; save(); close(); toast('Comptes remis à la proposition de départ'); if (done) done();
          };
          $('#ch-ok', layer).onclick = () => {
            const v = formValues($('#chf', layer));
            const out = {};
            keys.forEach(k => { const val = String(v[k] || '').trim(); if (val && val !== C.DEFAULT_ACCOUNTS[k]) out[k] = val; });
            if (Object.keys(out).length) data.chartAccounts = out; else delete data.chartAccounts;
            save(); close(); toast('Plan de comptes enregistré'); if (done) done();
          };
        });
    }

    function drawClosures() {
      const closed = C.closedUntil(data);
      const months = C.closableMonths(data, C.today());
      const next = months[0] || null;
      const checks = next ? C.closureChecks(data, company(), next.from, next.to) : [];
      const log = C.closureLog(data);
      const blocking = checks.filter(c => c.level === 'danger');

      $('#c-body').innerHTML = `
        <div class="panel"><h2>État ${info('clot.etat')}</h2>
          ${closed
            ? `<p>Tout ce qui est daté jusqu'au <strong>${C.fmtDate(closed)}</strong> est clôturé : plus aucune pièce de cette période ne peut être créée, modifiée ou supprimée.</p>`
            : '<p>Aucune période n\'est clôturée. Tes pièces passées peuvent encore être modifiées — y compris celles que ton comptable a déjà reçues.</p>'}
          <p class="small muted">Clôturer un mois est la promesse que ce mois ne bougera plus. C'est ce qui permet à ton comptable de travailler sur un dossier stable. Une réouverture reste possible, avec un motif, et elle est inscrite dans le journal ci-dessous.</p>
        </div>

        <div class="panel"><h2>Clôturer ${info('clot.cloturer')}</h2>
          ${!next
            ? `<div class="empty">${months.length === 0 && !closed ? 'Aucune pièce datée pour l\'instant.' : 'Tout est clôturé jusqu\'au mois en cours. Le mois en cours ne se clôture qu\'une fois terminé.'}</div>`
            : `<p>Prochain mois à clôturer : <strong>${h(next.label)}</strong> <span class="muted small">(du ${C.fmtDate(next.from)} au ${C.fmtDate(next.to)})</span></p>
               ${checks.length
                 ? `<div class="panel sub" style="margin:12px 0">
                      <h3 style="margin-top:0">À regarder avant de clôturer</h3>
                      <table class="list compact"><tbody>
                        ${checks.map(c => `<tr class="${c.level === 'danger' ? 'row-warn' : ''}"><td><strong>${h(c.label)}</strong><div class="small muted">${h(c.detail)}</div></td>
                          <td class="r nw">${c.count == null ? '' : c.count}</td>
                          <td class="r nw">${CHECK_ACTIONS[c.id] ? `<button class="btn btn-sm" data-check="${h(c.id)}">${h(CHECK_ACTIONS[c.id].label)}</button>` : ''}</td></tr>`).join('')}
                      </tbody></table>
                      <p class="small muted">Tu peux clôturer quand même : ces points sont là pour que tu les voies, pas pour t'empêcher d'avancer.</p>
                    </div>`
                 : '<p class="small" style="color:var(--primary)">Rien à signaler sur ce mois.</p>'}
               <div class="inline mt">
                 <button class="btn btn-primary" id="do-close">Clôturer ${h(next.label)}</button>
                 ${months.length > 1 ? `<button class="btn" id="close-to">Clôturer jusqu'à un mois plus récent…</button>` : ''}
               </div>`}
        </div>

        <div class="panel"><h2>Rouvrir ${info('clot.rouvrir')}</h2>
          ${closed
            ? `<p class="small">Rouvrir sert quand une pièce a été oubliée dans une période déjà clôturée. <strong>Préviens ton comptable</strong> : les chiffres qu'il a reçus vont changer. Le motif que tu écris ici est ce qu'il lira.</p>
               <button class="btn btn-danger" id="do-reopen">Rouvrir une période…</button>`
            : '<div class="empty">Rien n\'est clôturé, donc rien à rouvrir.</div>'}
        </div>

        <div class="panel"><h2>Journal des clôtures ${info('clot.journal')}</h2>
          ${log.length
            ? `<table class="list compact"><thead><tr><th>Action</th><th>Jusqu'au</th><th>Motif</th></tr></thead><tbody>
                ${log.map(e => `<tr><td><span class="badge ${e.action === 'reouverture' ? 'b-late' : 'b-paid'}">${h(C.CLOSURE_ACTIONS[e.action] || e.action)}</span></td>
                  <td class="nw">${e.until ? C.fmtDate(e.until) : '<span class="muted">tout rouvert</span>'}</td>
                  <td class="small">${h(e.reason || '')}${e.previous ? `<div class="muted">auparavant : ${C.fmtDate(e.previous)}</div>` : ''}</td></tr>`).join('')}
              </tbody></table>`
            : '<div class="empty">Aucune clôture pour l\'instant.</div>'}
        </div>`;

      // Les contrôles avant clôture étaient du TEXTE : « 3 achats sans justificatif » sans rien pour
      // les ouvrir, alors que la même liste porte ses boutons à un onglet de distance (Cabinet).
      // Même table, même branchement — un manque qu'on ne peut pas ouvrir n'est pas un manque,
      // c'est un reproche.
      $$('[data-check]').forEach(b => b.onclick = () => CHECK_ACTIONS[b.dataset.check].run());
      if ($('#do-close')) $('#do-close').onclick = async () => {
        const warn = blocking.length
          ? `\n\nPoint(s) à régler d'abord : ${blocking.map(c => c.label).join(', ')}.`
          : '';
        if (!await confirmDialog(`Clôturer ${next.label} ?\n\nAprès ça, aucune pièce datée du ${C.fmtDate(next.from)} au ${C.fmtDate(next.to)} ne pourra plus être créée, modifiée ou supprimée. Tu pourras rouvrir si besoin, avec un motif.${warn}`, 'Clôturer', false)) return;
        const r = C.closePeriod(data, next.to, { at: Date.now(), by: deviceLabel() });
        if (r.error) return toast(r.error, true);
        save(true); toast(`${next.label} clôturé`); draw(); updateNavCounts();
      };

      if ($('#close-to')) $('#close-to').onclick = () => {
        modal(`<h2>Clôturer jusqu'à…</h2>
          <p class="small">Tous les mois jusqu'à celui que tu choisis seront clôturés d'un coup.</p>
          <form id="ct" class="grid-2"><label class="field span-2">Dernier mois à clôturer
            <select name="m">${months.map(m => `<option value="${m.to}">${h(m.label)}</option>`).join('')}</select></label></form>
          <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Clôturer</button></div>`,
          (root, close) => {
            $('#ok', root).onclick = () => {
              const to = $('select[name=m]', root).value;
              const r = C.closePeriod(data, to, { at: Date.now(), by: deviceLabel() });
              close();
              if (r.error) return toast(r.error, true);
              save(true); toast('Clôturé jusqu\'au ' + C.fmtDate(to)); draw(); updateNavCounts();
            };
          });
      };

      if ($('#do-reopen')) $('#do-reopen').onclick = () => {
        const opts = C.closureLog(data).filter(e => e.action === 'cloture').map(e => e.previous).filter((v, i, a) => a.indexOf(v) === i);
        modal(`<h2>Rouvrir une période</h2>
          <p class="small">Les chiffres déjà envoyés à ton comptable vont changer. <strong>Préviens-le</strong>, et écris ici pourquoi : c'est ce motif qu'il lira.</p>
          <form id="rf" class="grid-2">
            ${dateFieldHtml('Rouvrir jusqu\'au (exclu)', 'until', opts[0] || '', { span: true })}
            <label class="field span-2">Motif<input type="text" name="reason" placeholder="Facture d'achat retrouvée, erreur de montant…"></label>
            <label class="check span-2"><input type="checkbox" name="all"> Tout rouvrir (plus aucune période clôturée)</label>
          </form>
          <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-danger" id="ok">Rouvrir</button></div>`,
          (root, close) => {
            $('#ok', root).onclick = () => {
              const v = formValues($('#rf', root));
              const r = C.reopenPeriod(data, v.all ? '' : v.until, { at: Date.now(), by: deviceLabel(), reason: (v.reason || '').trim() });
              if (r.error) return toast(r.error, true);
              close(); save(true); toast('Période rouverte'); draw(); updateNavCounts();
            };
          });
      };
    }

    // Le paquet mensuel : tout ce que le comptable attend, dans un fichier, vérifiable.
    // Avant de le fabriquer, on montre exactement ce qu'il contiendra — y compris ce qui manque.
    function drawCabinet() {
      const co = company();
      const months = (() => {
        // Les douze derniers mois terminés, le plus récent d'abord : c'est celui qu'on envoie.
        const out = [];
        let m = C.addMonths(C.today().slice(0, 7) + '-01', -1, 1).slice(0, 7);
        for (let i = 0; i < 12; i++) { out.push(m); m = C.addMonths(m + '-01', -1, 1).slice(0, 7); }
        return out;
      })();
      if (!cabinetState.month) cabinetState.month = months[0];
      const per = C.packPeriod(Number(cabinetState.month.slice(0, 4)), Number(cabinetState.month.slice(5, 7)));
      const plan = C.packPlan(data, co, per, { device: deviceLabel() });
      const paired = co.cabinet && co.cabinet.publicKey ? co.cabinet : null;
      const sent = (data.packs || []).filter(x => x.month === per.month).sort((a, b) => (b.at || 0) - (a.at || 0));
      const history = (data.packs || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12);
      const cur = co.currency;
      const tt = plan.totaux;
      const moisVide = !(tt.pieces + tt.ventes + tt.achats + tt.encaissements + tt.bulletins);

      $('#c-body').innerHTML = `
        <div class="panel"><h2>Le paquet du mois ${info('cab.paquet')}</h2>
          <div class="inline mb">
            <select id="cab-month">${months.map(m => `<option value="${m}" ${m === cabinetState.month ? 'selected' : ''}>${h(C.monthLabel(m + '-01'))}</option>`).join('')}</select>
            <span class="badge ${plan.definitive ? 'b-paid' : 'b-due'}">${plan.definitive ? 'définitif — mois clôturé' : 'provisoire — mois non clôturé'}</span>
          </div>
          ${plan.definitive
            ? '<p class="small muted">Ce mois est clôturé : le paquet est <b>définitif</b>. Ton comptable peut travailler dessus en sachant que rien ne bougera.</p>'
            : `<p class="small" style="background:var(--warning-soft);padding:10px 12px;border-radius:8px">
                 Ce mois n'est <b>pas clôturé</b> : le paquet partira marqué « provisoire ». Tu peux l'envoyer quand même — mais l'envoi qui compte est celui qui suit la clôture.
                 <a href="#" id="cab-goclose" class="warn-link">Clôturer ${h(per.label)}</a></p>`}

          <div class="dash-grid mt">
            <div>
              <table class="list compact"><thead><tr><th>Ce que contient le paquet</th><th class="r">Nombre</th></tr></thead><tbody>
                <tr><td>Pièces de vente émises (PDF joints)</td><td class="r">${plan.totaux.pieces}</td></tr>
                <tr><td>Lignes au journal des ventes</td><td class="r">${plan.totaux.ventes}</td></tr>
                <tr><td>Lignes au journal des achats</td><td class="r">${plan.totaux.achats}</td></tr>
                <tr><td>Justificatifs d'achat joints</td><td class="r">${plan.totaux.justificatifs}</td></tr>
                <tr><td>Encaissements clients</td><td class="r">${plan.totaux.encaissements}</td></tr>
                <tr><td>Bulletins de paie</td><td class="r">${plan.totaux.bulletins}</td></tr>
                <tr class="total-row"><td><b>Fichiers en tout</b></td><td class="r"><b>${moisVide ? 0 : plan.entries.length + 2}</b></td></tr>
              </tbody></table>
            </div>
            <div>
              <div class="stat"><div class="lbl">CA HT du mois</div><div class="val">${C.money(plan.ca, cur)}</div></div>
              <div class="stat"><div class="lbl">TVA collectée</div><div class="val">${C.money(plan.tvaCollectee, cur)}</div></div>
              <div class="stat"><div class="lbl">TVA déductible</div><div class="val">${C.money(plan.tvaDeductible, cur)}</div></div>
            </div>
          </div>
        </div>

        <div class="panel"><h2>Ce qui manque ${info('cab.manques')}</h2>
          ${moisVide
            // « Rien à signaler : le dossier du mois est complet » était la SEULE alternative à une
            // liste de manques. Sur un mois sans une seule pièce, tous les compteurs valent zéro,
            // donc la liste est vide, donc l'application félicitait — en vert — quelqu'un qui n'a
            // rien fait, en annonçant neuf fichiers (cinq journaux vides, les écritures et la TVA)
            // et en armant le bouton d'envoi. Avant d'écrire une phrase rassurante, vérifier que
            // l'univers dont elle parle n'est pas vide.
            ? `<p>Ce mois ne contient <b>aucune pièce</b> : il n'y a rien à envoyer à ton comptable.</p>
               <p class="small muted">Choisis un autre mois en haut de la page, ou commence par émettre une facture.</p>
               <div class="inline mt"><button class="btn btn-primary" id="cab-vers-factures">Aller aux factures</button></div>`
            : plan.checklist.length
            ? `<table class="list compact"><tbody>${plan.checklist.map(c => `<tr class="${c.level === 'danger' ? 'row-warn' : ''}">
                <td><strong>${h(c.label)}</strong><div class="small muted">${h(c.detail)}</div></td><td class="r nw">${c.count}</td>
                <td class="r nw">${CHECK_ACTIONS[c.id] ? `<button class="btn btn-sm" data-check="${h(c.id)}">${h(CHECK_ACTIONS[c.id].label)}</button>` : ''}</td></tr>`).join('')}</tbody></table>
               <p class="small muted mt">Ces points figureront sur la page de garde du paquet. Le comptable saura quoi te réclamer — c'est mieux qu'un dossier qu'il croit complet.</p>`
            : '<p class="small" style="color:var(--primary)">Rien à signaler : le dossier du mois est complet.</p>'}
        </div>

        <div class="panel"><h2>Fabriquer et envoyer ${info('cab.envoyer')}</h2>
          ${paired
            ? `<p class="small" style="background:var(--primary-soft);padding:10px 12px;border-radius:8px">
                 Le paquet sera <b>chiffré pour ${h(paired.name || 'ton cabinet')}</b> (empreinte ${h(paired.fingerprint || '')}).
                 Lui seul pourra l'ouvrir : aucun mot de passe à transmettre. ${info('cab.pourcabinet')}</p>`
            : `<label class="check mb"><input type="checkbox" id="cab-seal" ${cabinetState.seal ? 'checked' : ''}> Protéger le paquet par un mot de passe ${info('cab.motdepasse')}</label>
               <div id="cab-pw" ${cabinetState.seal ? '' : 'hidden'} class="mb">
                 <input type="password" id="cab-pwv" placeholder="Mot de passe convenu avec ton comptable" style="max-width:340px">
                 <div class="small muted">Transmets-le-lui par un autre canal que le fichier : par téléphone, pas dans le même mail.
                   Mieux : demande-lui son fichier d'appairage et importe-le dans <a href="#" id="cab-gopair" class="warn-link">Paramètres → Cabinet comptable</a>.</div>
               </div>`}
          <div class="inline">
            <button class="btn btn-primary" id="cab-build" ${moisVide ? 'disabled title="Ce mois ne contient aucune pièce."' : ''}>Fabriquer le paquet…</button>
            ${sent.length ? `<button class="btn" id="cab-mail">Envoyer au comptable…</button>` : ''}
          </div>
          <div id="cab-prog" class="small muted mt" hidden></div>
        </div>

        <div class="panel"><h2>Ce qui a déjà été envoyé ${info('cab.historique')}</h2>
          ${history.length
            ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Mois</th><th>Fabriqué le</th><th>État</th><th class="r">Fichiers</th><th class="r">Taille</th><th>Empreinte</th><th></th></tr></thead><tbody>
                ${history.map(x => `<tr><td class="nw"><strong>${h(C.monthLabel(x.month + '-01'))}</strong></td>
                  <td class="nw small">${x.at ? C.fmtDate(new Date(x.at).toISOString().slice(0, 10)) : ''}</td>
                  <td><span class="badge ${x.definitive ? 'b-paid' : 'b-due'}">${x.definitive ? 'définitif' : 'provisoire'}</span>${x.cabinet ? ' <span class="small muted">pour le cabinet</span>' : x.sealed ? ' <span class="small muted">chiffré</span>' : ''}</td>
                  <td class="r">${x.files || ''}</td><td class="r nw">${x.bytes ? (x.bytes / 1048576).toFixed(1).replace('.', ',') + ' Mo' : ''}</td>
                  <td class="small muted mono">${h(String(x.digest || '').slice(0, 12))}</td>
                  <td class="actions"><button class="btn btn-sm" data-reveal="${h(x.path || '')}" ${x.path ? '' : 'disabled title="Paquet fabriqué avant cette version : son chemin n\'a pas été gardé."'}>Montrer le fichier</button></td></tr>`).join('')}
              </tbody></table></div>
               <p class="small muted mt">L'empreinte est la carte d'identité du paquet : si ton comptable obtient la même, le fichier qu'il a reçu est bien celui que tu as envoyé, à l'octet près.</p>`
            : '<div class="empty">Aucun paquet fabriqué pour l\'instant.</div>'}
        </div>`;

      $('#cab-month').onchange = e => { cabinetState.month = e.target.value; draw(); };
      if ($('#cab-goclose')) $('#cab-goclose').onclick = e => { e.preventDefault(); comptaState.tab = 'clotures'; draw(); $$('#c-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'clotures')); };
      if ($('#cab-seal')) $('#cab-seal').onchange = e => { cabinetState.seal = e.target.checked; $('#cab-pw').hidden = !e.target.checked; };
      if ($('#cab-gopair')) $('#cab-gopair').onclick = e => { e.preventDefault(); allerParametres('cabinet', 'p-cabinet'); };

      if ($('#cab-vers-factures')) $('#cab-vers-factures').onclick = () => navigate('#/factures');
      // L'historique donnait l'empreinte du paquet et jamais son emplacement : six semaines plus
      // tard, le comptable réclame « le fichier de mars » et rien ne dit où il est. Le chemin était
      // pourtant enregistré depuis la 6.1.0 — il n'était affiché nulle part.
      $$('[data-reveal]').forEach(b2 => { if (b2.dataset.reveal) b2.onclick = () => bridge.showInFolder(b2.dataset.reveal); });
      // Chaque manque mène aux pièces concernées, filtrées. Le `if` n'est pas une précaution : la
      // table est complète par construction, et un test le vérifie contre `core.packChecklist`.
      $$('[data-check]').forEach(b => b.onclick = () => CHECK_ACTIONS[b.dataset.check].run());
      $('#cab-build').onclick = async () => {
        // Les contrôles de saisie d'abord, la grande question ensuite : poser une question de fond
        // puis refuser sur un champ trop court, c'est faire répondre pour rien.
        const pw = (!paired && cabinetState.seal) ? ($('#cab-pwv').value || '').trim() : '';
        if (!paired && cabinetState.seal && pw.length < 6) return toast('Choisis un mot de passe d\'au moins six caractères.', true);
        if (await demoBlock('Fabriquer le paquet du comptable')) return;
        if (!plan.definitive && !await confirmDialog(`${per.label} n'est pas clôturé : le paquet partira marqué « provisoire » et pourra encore changer.\n\nFabriquer quand même ?`, 'Fabriquer', false)) return;

        // Le HTML de chaque pièce est produit ici : c'est le renderer qui sait dessiner un document.
        const entries = plan.entries.map(e => {
          if (e.kind === 'pdf') {
            const d = docById(e.docId);
            return d ? { ...e, html: C.documentHtml(d, clientById(d.clientId), co, { stampText: stampFor(d) }) } : e;
          }
          if (e.kind === 'payslip') {
            const sl = (data.payslips || []).find(x => x.id === e.slipId);
            return sl ? { ...e, html: C.payslipHtml(sl, data, co, {}) } : e;
          }
          return e;
        });
        const cover = C.packCoverHtml(plan, co, { version: $('#app-version').textContent, at: C.fmtDate(C.today()) });

        const prog = $('#cab-prog');
        prog.hidden = false; prog.textContent = 'Préparation…';
        const off = bridge.onPackProgress(d => { prog.textContent = `${d.done} / ${d.total} — ${d.label}`; });
        try {
          const r = await bridge.buildPack({
            plan: { manifest: plan.manifest, entries },
            coverHtml: cover, password: pw, cabinetKey: paired ? paired.publicKey : '',
            suggestedName: C.packFileName(co, per, plan.definitive)
          });
          prog.hidden = true;
          if (!r) return;
          data.packs = (data.packs || []).concat([{
            id: C.uid(), month: per.month, at: Date.now(), definitive: plan.definitive,
            sealed: !!r.chiffre, cabinet: r.pourCabinet || '', files: r.fichiers, bytes: r.octets, digest: r.empreinte,
            path: r.path, missing: (r.absents || []).length
          }]);
          save(true);
          const warn = (r.absents || []).length ? ` ${r.absents.length} fichier(s) n'ont pas pu être joints (voir le manifeste).` : '';
          toast(`Paquet créé : ${r.path.split(/[\\/]/).pop()}${warn}`);
          draw();
        } catch (err) {
          prog.hidden = true;
          toast('Fabrication impossible : ' + (err.message || err), true);
        } finally { if (typeof off === 'function') off(); }
      };

      if ($('#cab-mail')) $('#cab-mail').onclick = async () => {
        if (await demoBlock('Envoyer le paquet au comptable')) return;
        const last = sent[0];
        const to = co.accountantEmail || '';
        bridge.composeMail({
          to, subject: `${co.name || ''} — comptabilité ${per.label}${last.definitive ? '' : ' (provisoire)'}`,
          body: `Bonjour,\n\nVoici le dossier de ${per.label}.\n\n`
            + `${last.definitive ? 'Le mois est clôturé : ces chiffres ne bougeront plus.' : 'Le mois n\'est pas encore clôturé : ce dossier est provisoire.'}\n`
            + `Le paquet contient les journaux, les pièces en PDF, les justificatifs d'achat et la page de garde.\n`
            + (last.cabinet ? 'Il est chiffré pour ta clé (empreinte ' + last.cabinet + ') : toi seul peux l\'ouvrir.\n'
               : last.sealed ? 'Il est protégé par le mot de passe convenu — je te le donne par téléphone.\n' : '')
            + `\nEmpreinte du manifeste : ${String(last.digest || '').slice(0, 16)}\n\nBien à toi,\n${co.name || ''}`,
          attachments: [last.path]
        }).then(() => emailComptablePret(to));
      };
    }

    // Là où se PRÉPARE chaque échéance. Une règle sans écran ne porte pas de bouton : mieux vaut
    // rien qu'un bouton qui mène au hasard.
    const FISCAL_VERS = {
      tva: () => { comptaState.tab = 'tva'; draw(); $$('#c-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'tva')); },
      cnss: () => { paieState.tab = 'declarations'; navigate('#/paie'); },
      employeur: () => { paieState.tab = 'declarations'; navigate('#/paie'); }
    };
    function drawFiscal() {
      const rules = C.fiscalDeadlines(data);
      const up = C.upcomingFiscal(data, C.today(), 120);
      $('#c-body').innerHTML = `
        <div class="panel"><h2>Ce qui arrive ${info('compta.fiscal')}</h2>
          ${up.length ? `<table class="list compact"><thead><tr><th>Échéance</th><th>Date</th><th class="r">Dans</th><th></th></tr></thead><tbody>
            ${up.map(x => `<tr class="${x.days <= 7 ? 'row-warn' : ''}"><td><strong>${h(x.label)}</strong>${x.note ? `<div class="small muted">${h(x.note)}</div>` : ''}</td>
              <td class="nw">${C.fmtDate(x.date)}</td><td class="r nw">${x.days === 0 ? "aujourd'hui" : x.days + ' j'}</td>
              <td class="actions">${FISCAL_VERS[x.id] ? `<button class="btn btn-sm btn-ghost" data-fvers="${h(x.id)}">Préparer</button>` : ''}<button class="btn btn-sm" data-fdone="${h(x.filingId)}" data-flab="${h(x.label)}">Marquer déposée</button></td></tr>`).join('')}
          </tbody></table>` : '<div class="empty">Aucune échéance activée. Active celles qui te concernent ci-dessous.</div>'}
          <p class="small muted mt"><em>À VÉRIFIER avec ton comptable :</em> les dates limites, la périodicité et les déclarations qui te concernent dépendent de ta forme juridique, de ton régime fiscal et de la présence de salariés. Ce calendrier est un pense-bête que tu règles toi-même, pas une source officielle.</p>
        </div>
        <div class="panel"><h2>Les échéances et leur réglage</h2>
          <table class="list compact"><thead><tr><th>Déclaration</th><th>Périodicité</th><th style="width:110px">Jour limite</th><th style="width:90px">Active</th></tr></thead><tbody>
            ${rules.map(r => `<tr><td><strong>${h(r.label)}</strong>${r.note ? `<div class="small muted">${h(r.note)}</div>` : ''}</td>
              <td class="small">${r.every === 'month' ? 'chaque mois' : r.every === 'year' ? `une fois par an (${MONTHS[(Number(r.month) || 1) - 1]})` : `${(r.months || []).map(m => MONTHS[m - 1]).join(', ')}`}</td>
              <td><input type="number" class="num" data-day="${h(r.id)}" value="${Number(r.day) || 28}" min="1" max="31"></td>
              <td><label class="check"><input type="checkbox" data-active="${h(r.id)}" ${r.active !== false ? 'checked' : ''}></label></td></tr>`).join('')}
          </tbody></table>
        </div>`;
      const setRule = (id, patch) => {
        const list = Array.isArray(data.fiscalDeadlines) ? data.fiscalDeadlines.slice() : [];
        const i = list.findIndex(x => x.id === id);
        if (i >= 0) list[i] = { ...list[i], ...patch }; else list.push({ id, ...patch });
        data.fiscalDeadlines = list; save(true);
      };
      // Une échéance restait rouge après le dépôt : le calendrier ne savait pas ce qu'on avait fait,
      // et le seul recours était de désactiver la règle — donc de perdre l'échéance suivante.
      // « Marquer déposée » pointe une OCCURRENCE, et laisse un « Annuler » (règle de la 7.12.0).
      $$('[data-fdone]').forEach(b => b.onclick = () => {
        const id = b.dataset.fdone;
        data.fiscalFilings = (data.fiscalFilings || []).concat([{ id, at: Date.now() }]);
        save(true); draw();
        toastUndo(`${b.dataset.flab} marquée déposée`, () => {
          data.fiscalFilings = (data.fiscalFilings || []).filter(f => f.id !== id);
          save(true); draw();
        });
      });
      // Et chaque échéance mène à l'écran où on la prépare : la TVA du mois, les déclarations de paie.
      $$('[data-fvers]').forEach(b => b.onclick = () => FISCAL_VERS[b.dataset.fvers]());
      $$('[data-active]').forEach(c => c.onchange = () => { setRule(c.dataset.active, { active: c.checked }); draw(); });
      $$('[data-day]').forEach(i => i.onchange = () => { setRule(i.dataset.day, { day: Math.min(31, Math.max(1, Number(i.value) || 28)) }); draw(); });
    }

    const tagOf = () => comptaState.month ? `${comptaState.year}-${comptaState.month}` : comptaState.year;
    const resetPages = () => { comptaState.journal.page = 1; comptaState.pays.page = 1; comptaState.buys.page = 1; };
    $('#c-year').onchange = e => { comptaState.year = e.target.value; resetPages(); draw(); };
    $('#c-month').onchange = e => { comptaState.month = e.target.value; resetPages(); draw(); };
    $$('#c-tabs button').forEach(b => b.onclick = () => {
      comptaState.tab = b.dataset.tab;
      $$('#c-tabs button').forEach(x => x.classList.toggle('active', x === b));
      resetPages(); draw();
    });
    draw();
  };

  // ---------- Paramètres ----------
  routes.parametres = async () => {
    const c = company();
    const path = await bridge.dataPath();
    const TABS = SETTINGS_TABS;
    if (!TABS.some(t => t[0] === settingsTab)) settingsTab = 'societe';
    $('#view').innerHTML = `<div class="page-head"><h1>Paramètres</h1></div>
      <div class="tabs" id="set-tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" data-tab="${id}" class="${id === settingsTab ? 'active' : ''}">${label}</button>`).join('')}</div>
      <form id="pf">
        <section data-pane="societe">
        <div class="panel" id="p-identite"><h2>Identité de l'entreprise</h2>
          <p class="small muted mb">Ces informations s'impriment en haut de chaque devis et facture. Le matricule fiscal est obligatoire sur une facture.
          <button type="button" class="btn btn-sm btn-ghost" id="redo-setup-2">Revoir l'assistant de démarrage…</button></p>
          <div class="grid-2">
          ${field(lbl('Raison sociale', 'co.name'), 'name', c.name)}
          ${field(lbl('Matricule fiscal', 'co.matricule'), 'matricule', c.matricule, 'text', 'placeholder="1234567X/A/M/000"')}
          ${field(lbl('Registre de commerce (RC)', 'co.rc'), 'rc', c.rc || '', 'text', 'placeholder="B123456789"')}
          ${field(lbl('Matricule CNSS employeur', 'pay.cnssEmployerId'), 'cnss', c.cnss || '', 'text', 'placeholder="s\'il y a des salariés"')}
          ${field(lbl('Capital social', 'co.capital'), 'capital', c.capital || '', 'text', 'placeholder="1 000 DT"')}
          <label class="field span-2">${lbl('Adresse', 'co.address')}<textarea name="address">${h(c.address)}</textarea></label>
          ${field('Téléphone', 'phone', c.phone)}
          ${field('Email', 'email', c.email, 'email')}
          ${field('Site web', 'website', c.website || '')}
          <label class="field span-2">${lbl('Slogan (sous le nom, sur les documents)', 'co.tagline')}<input type="text" name="tagline" value="${h(c.tagline || '')}" placeholder="Ce que fait ton entreprise, en quelques mots"></label>
        </div></div>
        <div class="panel" id="p-banque"><h2>Coordonnées bancaires</h2>
          <p class="small muted mb">Le RIB s'affiche sur les factures, dans le bloc « Règlement ». C'est ce que ton client copie pour te payer : relis-le deux fois.</p>
          <div class="grid-2">
          ${field(lbl('Banque', 'pay.bank'), 'bank', c.bank)}
          ${field('RIB', 'rib', c.rib)}
          <label class="field span-2">${lbl('Conditions de paiement (sur les factures)', 'pay.terms')}<textarea name="paymentTerms">${h(c.paymentTerms || '')}</textarea></label>
        </div></div>
        </section>

        <section data-pane="documents" hidden>
        <div class="panel" id="p-facturation"><h2>Règles de facturation</h2><div class="grid-3">
          ${field(lbl('Timbre fiscal par facture', 'doc.stampFee'), 'stampFee', c.stampFee, 'number', 'step="0.001" min="0" class="num"')}
          ${field(lbl('Validité des devis (jours)', 'doc.quoteValidity'), 'quoteValidityDays', c.quoteValidityDays, 'number', 'min="0" class="num"')}
          ${field(lbl('Délai de paiement (jours)', 'doc.paymentDays'), 'paymentTermsDays', c.paymentTermsDays, 'number', 'min="0" class="num"')}
          <label class="field">${lbl('Retenue à la source par défaut', 'doc.withholdingDefault')}<select name="defaultWithholdingRate">${withholdingOptions(c.defaultWithholdingRate)}</select></label>
          <label class="field">${lbl('TVA des nouvelles lignes', 'doc.defaultVat')}<select name="defaultVatRate">${C.VAT_RATES.map(v => `<option value="${v}" ${C.defaultVat(c) === v ? 'selected' : ''}>${v} %</option>`).join('')}</select></label>
          ${field(lbl('Devise', 'doc.currency'), 'currency', c.currency)}
          <label class="check" style="align-self:end"><input type="checkbox" name="openAfterExport" ${c.openAfterExport !== false ? 'checked' : ''}> Ouvrir le PDF après export ${info('doc.openAfterExport')}</label>
        </div>
        <p class="small muted mt">Retenue à la source : calculée sur le TTC hors timbre, modifiable sur chaque facture et par client. Les taux et l'assiette sont <em>À VÉRIFIER avec ton comptable</em>.</p></div>
        <div class="panel" id="p-objectifs"><h2>Objectifs et statistiques</h2>
          <p class="small muted mb">Ces deux réglages ne servent qu'à la page Statistiques : ils ne s'impriment nulle part et ne changent aucun calcul de facture.</p>
          <div class="grid-3">
          ${field(lbl('Objectif de chiffre d\'affaires HT (par an)', 'stat.target'), 'revenueTarget', c.revenueTarget || 0, 'number', 'step="1" min="0" class="num"')}
          ${field(lbl('Un client est « endormi » après (jours)', 'stat.dormant'), 'dormantDays', c.dormantDays || 180, 'number', 'min="1" class="num"')}
        </div></div>
        <div class="panel" id="p-textes"><h2>Textes imprimés sur les documents</h2><div class="grid-2">
          <label class="field span-2">${lbl('Conditions des devis', 'doc.quoteTerms')}<textarea name="quoteTerms">${h(c.quoteTerms || '')}</textarea></label>
          <label class="field span-2">${lbl('Pied de page des documents', 'doc.footer')}<textarea name="footer">${h(c.footer)}</textarea></label>
          <label class="field span-2">${lbl('Conditions de paiement — documents en anglais', 'doc.en')}<textarea name="paymentTermsEn">${h(c.paymentTermsEn || '')}</textarea></label>
          <label class="field span-2">Conditions des devis — documents en anglais<textarea name="quoteTermsEn">${h(c.quoteTermsEn || '')}</textarea></label>
        </div></div>
        </section>

        <section data-pane="emails" hidden>
        <div class="panel" id="p-envoi"><h2>Envoi</h2>
          <div class="grid-2">
            <label class="field">${lbl('Envoi des emails', 'mail.client')}<select name="mailClient"><option value="auto" ${c.mailClient !== 'mailto' ? 'selected' : ''}>Mail (Apple) avec le PDF joint — Mac</option><option value="mailto" ${c.mailClient === 'mailto' ? 'selected' : ''}>Autre messagerie (mailto, PDF à glisser)</option></select></label>
          </div>
        </div>
        <div class="panel" id="p-comptable"><h2>Comptable</h2><div class="grid-2">
          ${field(lbl('Email du comptable', 'compta.comptable'), 'accountantEmail', c.accountantEmail || '', 'email', 'placeholder="comptable@cabinet.tn"')}
        </div><p class="small muted mt">Utilisé par « Envoyer au comptable » sur la page Comptabilité.</p></div>
        <div class="panel" id="p-modeles"><h2>Modèles de messages ${info('mail.templates')}</h2>
          <p class="small muted mt">Variables utilisables : {numero} {client} {objet} {montant} {echeance} {jours} {societe} {reference}. Les documents en anglais utilisent les modèles en anglais.</p>
          ${[['fr', 'et', 'Modèles en français', C.DEFAULT_EMAIL_TEMPLATES, c.emailTemplates || {}], ['en', 'eten', 'Modèles en anglais (clients étrangers)', C.DEFAULT_EMAIL_TEMPLATES_EN, c.emailTemplatesEn || {}]].map(([lg, prefix, title, defs, cur2]) => `<details ${lg === 'fr' ? 'open' : ''}><summary>${title}</summary>
          ${[['devis', lg === 'fr' ? 'Envoi d\'un devis' : 'Quote'], ['facture', lg === 'fr' ? 'Envoi d\'une facture' : 'Invoice'], ['avoir', lg === 'fr' ? 'Envoi d\'un avoir' : 'Credit note'], ['relance1', lg === 'fr' ? 'Rappel (≤ 15 jours de retard)' : 'Reminder (≤ 15 days)'], ['relance2', lg === 'fr' ? 'Relance (16 à 45 jours)' : 'Second reminder (16–45 days)'], ['relance3', lg === 'fr' ? 'Dernière relance (> 45 jours)' : 'Final reminder (> 45 days)'], ['relanceDevis', lg === 'fr' ? 'Relance d\'un devis sans réponse' : 'Quote follow-up'], ['comptable', lg === 'fr' ? 'Envoi au comptable' : 'To the accountant']].map(([k, label]) => {
            const t = { ...defs[k], ...(cur2[k] || {}) };
            return `<div class="section-head"><h2 class="small">${label}</h2></div><div class="grid-2"><label class="field span-2">Objet<input type="text" name="${prefix}_${k}_subject" value="${h(t.subject)}"></label><label class="field span-2">Message<textarea name="${prefix}_${k}_body" rows="4">${h(t.body)}</textarea></label></div>`; }).join('')}
          </details>`).join('')}
        </div>
        </section>

        <section data-pane="apparence" hidden>
        <div class="panel" id="p-apparence"><h2>L'application</h2><div class="grid-3">
          <label class="field">${lbl('Thème', 'ap.theme')}<select name="theme"><option value="light" ${c.theme !== 'dark' && c.theme !== 'auto' ? 'selected' : ''}>Clair</option><option value="dark" ${c.theme === 'dark' ? 'selected' : ''}>Sombre</option><option value="auto" ${c.theme === 'auto' ? 'selected' : ''}>Comme le système</option></select></label>
          <label class="field">${lbl('Langue des documents par défaut', 'ap.defaultLang')}<select name="defaultLang"><option value="fr" ${c.defaultLang !== 'en' ? 'selected' : ''}>Français</option><option value="en" ${c.defaultLang === 'en' ? 'selected' : ''}>English</option></select></label>
        </div><p class="small muted mt">Le thème sombre ne concerne que l'interface : les documents restent clairs. Le changement se voit tout de suite ; il n'est gardé qu'une fois enregistré.</p></div>
        <!-- « Image de marque » vivait dans l'onglet Société, entre le matricule fiscal et le RIB.
             Chercher où changer la couleur ou le logo dans un onglet qui parle d'identité juridique
             n'a rien d'évident : ce sont des réglages d'apparence, ils vivent avec l'apparence. -->
        <div class="panel" id="p-marque"><h2>Image de marque (sur tes documents)</h2><div class="grid-2">
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
        </div>
        <p class="small muted mt">Ces deux couleurs habillent les devis et les factures, pas l'application. Pour les voir, ouvre un document : l'aperçu se met à jour.</p></div>
        </section>
      </form>

      <section data-pane="maj" hidden>
        <div class="panel" id="p-maj"><h2>Mises à jour</h2><div id="update-panel"></div></div>
        <div class="panel" id="p-ocr"><h2>Lecture de factures d'achat ${info('ocr.key')}</h2><div id="ocr-panel"></div></div>
      </section>

      <section data-pane="cabinet" hidden>
        <div class="panel" id="p-cabinet"><h2>Ton cabinet comptable ${info('cab.appaire')}</h2>
          <div id="cab-pair"></div>
        </div>
      </section>
      <section data-pane="licence" hidden>
        <div class="panel" id="p-licence"><h2>Licence ${info('lic.etat')}</h2><div id="lic-panel"></div></div>
      </section>
      <section data-pane="donnees" hidden>
      <div class="panel" id="p-dossiers"><h2>Dossiers — plusieurs entreprises sur cet ordinateur ${info('data.dossiers')}</h2>
        <p class="small muted mb">Chaque dossier est une entreprise : ses clients, ses documents, ses achats, ses sauvegardes. Ils ne se mélangent jamais. Tu passes de l'un à l'autre en un clic, l'application se recharge.</p>
        <div id="dossiers-list"></div>
        <div class="inline mt"><button type="button" class="btn" id="dos-add">+ Nouveau dossier sur cet ordinateur</button>
          <button type="button" class="btn" id="dos-shared">+ Dossier partagé à deux…</button>${info('data.shared')}</div>
      </div>
      <div class="panel" id="p-poste"><h2>Ce poste ${info('data.device')}</h2>
        <p class="small muted mb">Le nom de cet ordinateur. Il sert uniquement à dire qui a enregistré en dernier quand vous travaillez à deux sur un dossier partagé.</p>
        <div class="inline"><input type="text" id="dev-name" value="" style="max-width:280px"><button type="button" class="btn" id="dev-save">Renommer</button></div>
      </div>
      <div class="panel" id="p-externe"><h2>Copie externe ${info('data.external')}</h2>
        <p class="small muted">iCloud Drive, clé USB, disque réseau. À chaque enregistrement, le fichier de données et les sauvegardes y sont copiés. Si le Mac meurt, tout est ailleurs. <b>C'est le réglage le plus important de cette page.</b></p>
        <div id="ext-status" class="small mt"></div>
        <div class="inline mt"><button class="btn btn-primary" id="ext-choose">Choisir un dossier…</button><button class="btn btn-ghost" id="ext-remove" hidden>Retirer</button></div>
      </div>
      <div class="panel" id="p-motdepasse"><h2>Mot de passe ${info('sec.password')}</h2>
        <p id="sec-status">${security.encrypted ? '🔒 Mot de passe activé : le fichier de données et ses sauvegardes sont chiffrés (AES-256). Verrouiller : menu Fichier ou Cmd/Ctrl+L.' : 'Le fichier de données est en clair sur ce disque. Tu peux le protéger par un mot de passe demandé à chaque ouverture.'}</p>
        <div class="inline mt">${security.encrypted ? '<button class="btn" id="sec-change">Changer le mot de passe…</button><button class="btn" id="sec-lock">Verrouiller maintenant</button><button class="btn btn-danger" id="sec-remove">Retirer le mot de passe…</button>' : '<button class="btn btn-primary" id="sec-set">Activer un mot de passe…</button>'}</div>
        <p class="small muted mt">Le mot de passe protège les fichiers sur le disque (ordinateur perdu ou volé). Il n'existe aucune récupération : sans lui, les données sont définitivement illisibles, <b>y compris pour toi</b>.</p>
      </div>
      <div class="panel" id="p-modules"><h2>Ce que l'application t'affiche</h2>
        <p class="small muted mb">SkanFact sait faire beaucoup de choses. Tu choisis lesquelles apparaissent
        dans le menu de gauche — sans rien supprimer : ce qui est masqué reste atteignable par la
        recherche, et un module qui contient des données se réaffiche tout seul.</p>
        <div class="inline">
          <button type="button" class="btn" id="go-modules">Choisir les modules affichés…</button>
          <button type="button" class="btn btn-ghost" id="redo-setup">Revoir l'assistant de démarrage…</button>
        </div>
      </div>
      <div class="panel" id="p-sauvegardes"><h2>Sauvegardes ${info('data.backups')}</h2>
        <p class="small muted">Fichier de données : <code>${h(path)}</code></p>
        <p class="small">${data.documents.length} document(s), ${data.clients.length} client(s), ${data.catalog.length} prestation(s).</p>
        <p class="small muted">Chaque jour, l'état du matin est copié dans le dossier <code>backups</code> (30 jours conservés) ; une copie est aussi prise avant tout import, avant l'exemple et avant un effacement.</p>
        <div class="inline mt">
          <button class="btn" id="backup-now">Sauvegarder maintenant</button>
          <button class="btn" id="open-backups">Ouvrir le dossier des sauvegardes</button>
          <button class="btn" id="export-data">Exporter les données…</button>
          <button class="btn" id="import-data">Importer…</button>
        </div>
        <!-- Le moteur sait restaurer depuis la 7.0.0 (backups:peek et backups:restore), et
             AUCUN écran ne l'appelait : seule la sortie du jeu d'exemple s'en servait. Le seul
             chemin proposé à quelqu'un qui vient de perdre quelque chose était « Importer et
             choisis un fichier de ce dossier » — c'est-à-dire naviguer dans un dossier caché, y
             reconnaître un nom de fichier, et remplacer TOUT sans savoir ce qu'on perd. Le jour où
             on en a besoin est le pire jour pour apprendre un chemin. -->
        <div id="backup-list" class="mt"></div>
      </div>
      <!-- Charger l'exemple n'est PAS un geste dangereux : une sauvegarde est prise, la société est
           conservée, un bandeau permanent offre le retour, et l'article « Démarrer » le présente
           comme l'étape d'apprentissage. Il vivait pourtant dans l'encadré rouge, collé à « Tout
           effacer » — donc on hésitait à cliquer sur ce qu'on nous demandait de faire, puis on
           prenait le bouton écarlate d'à côté pour en sortir, et on perdait tout. -->
      <div class="panel" id="p-exemple"><h2>Essayer sans risque ${info('data.demo')}</h2>
        <div class="dz-row">
          <div><b>Charger le jeu d'exemple</b>
            <div class="small muted">Remplace tes données par treize mois d'activité fictive, pour cliquer partout sans rien casser.
            Une sauvegarde est prise avant, ta fiche société est conservée, et un bandeau orange te rendra tes données d'un clic.</div></div>
          <button class="btn" id="load-demo">Charger l'exemple</button>
        </div>
      </div>
      <div class="panel danger-zone" id="p-danger"><h2>Zone sensible</h2>
        <div class="dz-row">
          <div><b>Tout effacer</b> ${info('data.wipe')}
            <div class="small muted">Supprime clients, prestations, documents, contrats, modèles et textes. Les paramètres société restent. Une sauvegarde est prise avant.</div></div>
          <button class="btn btn-danger" id="wipe-data">Tout effacer…</button>
        </div>
      </div>
      </section>

      <div class="save-bar" id="save-bar" hidden>
        <span>Modifications non enregistrées</span>
        <button class="btn" id="cancel-set">Abandonner les modifications</button>
        <button class="btn btn-primary" id="save">Enregistrer</button>
      </div>`;

    // --- onglets
    const showTab = id => {
      settingsTab = id;
      $$('#set-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
      $$('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== id);
      $('#view').scrollTop = 0;
    };
    $$('#set-tabs button').forEach(b => b.onclick = () => { settingsFocus = ''; showTab(b.dataset.tab); });
    showTab(settingsTab);
    // Un lien qui promet « le mot de passe » ou « la copie externe » atterrissait en haut d'une pile
    // de six panneaux : on redescendait à la main en cherchant le titre. On amène le panneau visé.
    if (settingsFocus) {
      const cible = $('#' + settingsFocus);
      settingsFocus = '';
      if (cible) {
        try { cible.scrollIntoView({ block: 'center' }); } catch (_) {}
        cible.classList.add('flash');
        setTimeout(() => cible.classList.remove('flash'), 1600);
      }
    }

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
      // Un champ `type=number` vidé rend la CHAÎNE VIDE, pas zéro. Trois réglages étaient bornés
      // ici et trois autres du même bloc ne l'étaient pas : vider le timbre fiscal le mettait
      // silencieusement à 0 sur toutes les factures à venir, et vider un délai donnait 0 jour sur
      // un chemin (`newDocument`) et 30 sur l'autre (`invoiceFromQuote`, qui replie sur 30). Un
      // réglage vidé par erreur ne doit pas donner deux réponses différentes selon l'écran.
      data.company.defaultWithholdingRate = Number(data.company.defaultWithholdingRate) || 0;
      data.company.revenueTarget = Math.max(0, Number(data.company.revenueTarget) || 0);
      data.company.dormantDays = Math.max(1, Number(data.company.dormantDays) || 180);
      data.company.stampFee = Math.max(0, Number(data.company.stampFee) || 0);
      data.company.quoteValidityDays = Math.max(0, Number(data.company.quoteValidityDays) || 30);
      data.company.paymentTermsDays = Math.max(0, Number(data.company.paymentTermsDays) || 30);
      save(true); applyTheme(); $('#brand-company').textContent = data.company.name || 'Ton entreprise';
      accorderNomDossier();     // le dossier porte le nom de la société, pas « Mon entreprise »
      setDirty = false; $('#save-bar').hidden = true;
      return true;
    };
    setGuard({ dirty: () => setDirty, what: 'les paramètres', save: applySettings, discard: applyTheme });
    $('#save').onclick = () => { applySettings(); toast('Paramètres enregistrés'); };
    // « Annuler », collé à « Enregistrer », jetait sans un mot tout ce qui venait d'être tapé —
    // y compris dix minutes de modèles d'email. Le mot dit maintenant ce qu'il fait, et il demande.
    $('#cancel-set').onclick = async () => {
      if (!await confirmDialog('Abandonner les modifications en cours des paramètres ?\n\nCe qui vient d\'être saisi et pas encore enregistré sera perdu.', 'Abandonner', true)) return;
      setDirty = false; applyTheme(); render();
    };
    // Le thème et les couleurs sont purement visuels et réversibles : les montrer tout de suite
    // évite de chercher « Enregistrer » pour savoir à quoi ça ressemble. L'enregistrement, lui,
    // reste explicite — la barre du bas apparaît comme pour tout le reste.
    const themeSel = $('#pf select[name=theme]');
    if (themeSel) themeSel.onchange = () => {
      const v = themeSel.value;
      const sombre = v === 'dark' || (v === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.body.classList.toggle('dark', sombre);
      markSet();
    };
    // ---------- appairage du cabinet (6.2.0) ----------
    // Le cabinet remet à ses clients un petit fichier contenant sa clé publique. Une fois importé,
    // les paquets mensuels sont chiffrés POUR LUI : rien à transmettre, rien à retenir, et une clé
    // volée chez un client n'ouvre aucun paquet, pas même les siens.
    function drawCabinetPair() {
      const el = $('#cab-pair'); if (!el) return;
      const cab = company().cabinet;
      el.innerHTML = cab && cab.publicKey
        ? `<p>Tes paquets mensuels sont chiffrés pour <strong>${h(cab.name || 'ton cabinet')}</strong>${cab.email ? ` <span class="muted">(${h(cab.email)})</span>` : ''}.</p>
           <table class="list compact"><tbody>
             <tr><td>Empreinte de sa clé ${info('cab.empreinte')}</td><td class="mono"><strong>${h(cab.fingerprint || '')}</strong></td></tr>
             <tr><td>Appairé le</td><td>${cab.pairedAt ? C.fmtDate(String(cab.pairedAt).slice(0, 10)) : '—'}</td></tr>
           </tbody></table>
           <p class="small muted mt">Vérifie cette empreinte <b>de vive voix</b> avec ton comptable la première fois : c'est ce qui garantit que tu as bien sa clé et pas celle de quelqu'un d'autre.</p>
           <div class="inline mt"><button class="btn" id="cab-repair">Remplacer par un autre cabinet…</button><button class="btn btn-danger" id="cab-unpair">Retirer</button></div>`
        : `<p>Aucun cabinet appairé. Tes paquets mensuels peuvent être protégés par un mot de passe, mais c'est moins pratique et moins sûr : un mot de passe se transmet, donc il fuite.</p>
           <p class="small muted">Demande à ton comptable son <b>fichier d'appairage</b> (il l'exporte depuis SkanFact Cabinet). Une fois importé ici, chaque paquet sera chiffré pour lui seul, sans mot de passe à échanger.</p>
           <p class="small muted">Ton comptable n'a pas encore l'application ? <b>SkanFact Cabinet</b> est gratuite pour lui : elle est jointe à chaque version de SkanFact, sous le même lien de téléchargement. Elle lit tes paquets, ne modifie jamais tes données et ne t'envoie rien.</p>
           <button class="btn btn-primary mt" id="cab-import">Importer le fichier du cabinet…</button>`;

      const doImport = async () => {
        try {
          const r = await bridge.importCabinet();
          if (!r) return;
          applySettings();                 // ne jamais perdre ce qui est en cours de saisie (règle 5.2.1)
          data.company.cabinet = r;
          save(true); render();
          toast(`Cabinet appairé : ${r.name || ''} — empreinte ${r.fingerprint}`);
        } catch (e) { toast(e.message || 'Fichier illisible', true); }
      };
      if ($('#cab-import')) $('#cab-import').onclick = doImport;
      if ($('#cab-repair')) $('#cab-repair').onclick = doImport;
      if ($('#cab-unpair')) $('#cab-unpair').onclick = async () => {
        if (!await confirmDialog('Retirer ce cabinet ? Tes prochains paquets ne seront plus chiffrés pour lui — il faudra revenir au mot de passe.')) return;
        applySettings();
        delete data.company.cabinet; save(true); render();
        toast('Cabinet retiré');
      };
    }
    drawCabinetPair();
    drawLicencePanel();
    drawUpdatePanel();
    drawOcrPanel();
    $('#go-modules').onclick = () => navigate('#/modules');
    $$('#redo-setup, #redo-setup-2').forEach(b => b.onclick = rejouerAssistant);
    $('#backup-now').onclick = async () => { const p = await bridge.createBackup(); toast(p ? 'Sauvegarde créée : ' + p.split(/[\\/]/).pop() : 'Rien à sauvegarder pour l\'instant'); drawExternal(); drawBackups(); };

    // La liste des sauvegardes, avec le bouton qui les remet. Chaque nom est traduit : « avant-demo »
    // ne veut rien dire pour quelqu'un qui n'a pas écrit le code.
    const NOM_SAUVEGARDE = [
      [/^avant-demo/, 'Juste avant de charger l\'exemple'],
      [/^avant-restauration/, 'Juste avant une restauration'],
      [/^avant-effacement/, 'Juste avant « Tout effacer »'],
      [/^avant-import/, 'Juste avant un import'],
      [/^manuelle/, 'Sauvegarde que tu as demandée'],
      [/^\d{4}-\d{2}-\d{2}/, 'État du matin']
    ];
    const nommer = f => (NOM_SAUVEGARDE.find(([re]) => re.test(f)) || [null, 'Sauvegarde'])[1];
    async function drawBackups() {
      if (!$('#backup-list')) return;
      let liste = [];
      try { liste = (await bridge.listBackups()) || []; } catch (_) {}
      // Redemandé APRÈS l'attente : changer de page pendant la question laisse une poignée détachée.
      const el = $('#backup-list'); if (!el) return;
      if (!liste.length) {
        el.innerHTML = '<p class="small muted">Aucune sauvegarde pour l\'instant. La première sera prise demain matin, ou tout de suite avec le bouton ci-dessus.</p>';
        return;
      }
      const vues = liste.slice(0, 12);
      el.innerHTML = `<p class="small muted mb"><b>Revenir en arrière.</b> Restaurer remet l'application dans l'état de la sauvegarde choisie.
        L'état actuel est mis de côté juste avant, donc ce geste se défait.</p>
        <table class="list compact"><thead><tr><th>Quand</th><th>Ce que c'était</th><th></th></tr></thead><tbody>
        ${vues.map(b => `<tr><td class="nw">${h(new Date(b.mtime).toLocaleString('fr-FR'))}</td>
          <td>${h(nommer(b.name))}<div class="small muted">${h(b.name)}</div></td>
          <td class="r"><button type="button" class="btn btn-sm" data-restore="${h(b.name)}">Restaurer…</button></td></tr>`).join('')}
        </tbody></table>
        ${liste.length > vues.length ? `<p class="small muted mt">${liste.length - vues.length} sauvegarde(s) plus ancienne(s) dans le dossier.</p>` : ''}`;
      $$('[data-restore]', el).forEach(b => b.onclick = () => restaurer(b.dataset.restore));
    }
    // On REGARDE d'abord, et on dit ce qu'on va perdre. Sans ça, une restauration est un pari.
    async function restaurer(nom) {
      const vu = await bridge.peekBackup(nom);
      if (!vu || !vu.ok) return toast('Sauvegarde illisible : ' + ((vu && vu.error) || 'erreur inconnue'), true);
      const ici = { documents: data.documents.length, clients: data.clients.length, catalog: data.catalog.length };
      const dit = c => `${c.documents} document(s), ${c.clients} client(s), ${c.catalog} prestation(s)`;
      const ok = await confirmDialog(
        `Revenir à la sauvegarde du ${new Date(vu.mtime).toLocaleString('fr-FR')} ?\n\n`
        + `Elle contient : ${dit(vu.compte)}${vu.societe ? ' — ' + vu.societe : ''}${vu.demo ? '\n⚠ C\'est le jeu d\'exemple, pas de vraies données.' : ''}\n`
        + `Aujourd'hui tu as : ${dit(ici)}\n\n`
        + 'Ton état actuel est sauvegardé juste avant, sous « avant-restauration » : ce geste se défait.',
        'Restaurer', false)
        || false;
      if (!ok) return;
      if (!await closedWipeOk('Une restauration remplace tout.')) return;
      const r = await bridge.restoreBackup(nom);
      if (!r || !r.ok) return toast('Restauration impossible : ' + ((r && r.error) || 'erreur inconnue'), true);
      data = C.migrateData(r.data);
      try { window.__data = data; } catch (_) {}
      applyTheme();
      $('#brand-company').textContent = data.company.name || 'Ton entreprise';
      drawNav();
      toast('Restauré : ' + dit(vu.compte));
      navigate('#/dashboard');
    }
    drawBackups();
    const drawExternal = async () => {
      const i = await bridge.externalBackupInfo();
      // « Tes premiers pas » lit cet état ; sans cette ligne, choisir enfin un dossier de copie
      // laissait l'étape « Mettre tes données à l'abri » décochée jusqu'au prochain démarrage.
      copieExterne = !!(i && i.dir);
      const el = $('#ext-status'); if (!el) return;
      el.innerHTML = i.dir ? `Dossier : <code>${h(i.dir)}</code><br>${i.lastError ? `<span style="color:var(--danger)">Dernière copie impossible : ${h(i.lastError)}</span>` : (i.lastCopy ? `Dernière copie : ${h(new Date(i.lastCopy).toLocaleString('fr-FR'))}` : 'Copie à la prochaine sauvegarde.')}` : '<span class="muted">Aucun dossier de copie externe.</span>';
      $('#ext-remove').hidden = !i.dir;
    };
    drawExternal();

    // --- dossiers (plusieurs entreprises, et le dossier partagé à deux)
    async function drawDossiers() {
      const el = $('#dossiers-list'); if (!el) return;
      const r = await bridge.listDossiers();
      $('#dev-name').value = r.device.name || '';
      el.innerHTML = `<table class="list compact"><thead><tr><th>Dossier</th><th>Emplacement</th><th></th></tr></thead><tbody>
        ${r.dossiers.map(d => `<tr class="${d.id === r.current ? 'row-ok' : ''}">
          <td><strong>${h(d.name)}</strong>${d.id === r.current ? ' <span class="badge b-paid">ouvert</span>' : ''}${d.shared ? ' <span class="badge b-due">partagé</span>' : ''}</td>
          <td class="small muted">${h(d.dir)}</td>
          <td class="actions">${d.id === r.current ? '' : `<button type="button" class="btn btn-sm" data-open="${h(d.id)}">Ouvrir</button>`}
            <button type="button" class="btn btn-ghost btn-sm" data-ren="${h(d.id)}">Renommer</button>
            ${r.dossiers.length > 1 && d.id !== r.current ? `<button type="button" class="btn btn-ghost btn-sm" data-forget="${h(d.id)}">Retirer</button>` : ''}</td></tr>`).join('')}
      </tbody></table>`;
      $$('[data-open]', el).forEach(b => b.onclick = async () => {
        if (setDirty && !await confirmDialog('Des paramètres ne sont pas enregistrés. Changer de dossier maintenant ?', 'Changer quand même')) return;
        await bridge.switchDossier(b.dataset.open);
      });
      $$('[data-ren]', el).forEach(b => b.onclick = () => {
        const d = r.dossiers.find(x => x.id === b.dataset.ren);
        promptDialog('Renommer le dossier', 'Nom du dossier', d.name, async v => { await bridge.renameDossier({ id: d.id, name: v }); drawDossiers(); });
      });
      $$('[data-forget]', el).forEach(b => b.onclick = async () => {
        const d = r.dossiers.find(x => x.id === b.dataset.forget);
        if (!await confirmDialog(`Retirer « ${d.name} » de la liste ? Ses fichiers ne sont PAS supprimés : ils restent dans ${d.dir}. Tu pourras le rouvrir plus tard.`, 'Retirer de la liste')) return;
        await bridge.forgetDossier(d.id);
      });
    }
    drawDossiers();
    $('#dos-add').onclick = () => promptDialog('Nouveau dossier', 'Nom de l\'entreprise', '', async v => {
      const r = await bridge.addDossier({ name: v, shared: false });
      if (!r.ok && r.error) toast(r.error, true);
    });
    $('#dos-shared').onclick = async () => {
      if (!await confirmDialog(
        'Un dossier partagé vit dans iCloud Drive, OneDrive, un disque réseau ou une clé USB, et deux ordinateurs l\'ouvrent tour à tour.\n\n' +
        'SkanFact ne laisse jamais l\'un écraser le travail de l\'autre : si vous avez modifié tous les deux, il fusionne et te dit ce qui a changé.\n\n' +
        'Une seule chose ne se répare pas toute seule : si vous émettez des factures en même temps chacun de votre côté, vous pouvez sortir deux fois le même numéro. ' +
        'Mettez-vous d\'accord sur qui émet, ou attendez que l\'autre ait fini.\n\n' +
        'La suite de la fiche d\'aide « Travailler à deux » explique tout ça.',
        'J\'ai compris, choisir le dossier', false)) return;
      promptDialog('Dossier partagé', 'Nom de l\'entreprise partagée', '', async v => {
        const r = await bridge.addDossier({ name: v, shared: true });
        if (!r.ok && r.error) toast(r.error, true);
      });
    };
    $('#dev-save').onclick = async () => {
      const r = await bridge.renameDevice($('#dev-name').value);
      if (r && r.ok) toast('Ce poste s\'appelle maintenant « ' + r.name + ' »');
    };

    $('#ext-choose').onclick = async () => { const i = await bridge.chooseExternalBackup(); if (i) { toast(i.lastError ? 'Dossier choisi, mais copie impossible : ' + i.lastError : 'Copie externe activée'); drawExternal(); } };
    // Le panneau lui-même écrit « C'est le réglage le plus important de cette page » — et le bouton
    // qui l'éteint s'exécutait sans une question, à côté de celui qui l'allume.
    $('#ext-remove').onclick = async () => {
      if (!await confirmDialog('Arrêter la copie externe ?\n\nLes fichiers déjà copiés restent où ils sont, mais plus rien n\'y sera copié : si cet ordinateur tombe en panne, tout ce que tu enregistreras à partir de maintenant sera perdu.', 'Arrêter la copie', true)) return;
      await bridge.setExternalBackup(null); toast('Copie externe désactivée'); drawExternal();
    };
    if ($('#sec-set')) $('#sec-set').onclick = () => passwordDialog('set');
    if ($('#sec-change')) $('#sec-change').onclick = () => passwordDialog('change');
    if ($('#sec-remove')) $('#sec-remove').onclick = () => passwordDialog('remove');
    if ($('#sec-lock')) $('#sec-lock').onclick = lockNow;
    $('#open-backups').onclick = () => bridge.openBackups();
    $('#export-data').onclick = exportAll;
    $('#import-data').onclick = importAll;
    // Choisir une image redessine toute la page : sans ce `applySettings()` préalable, tout ce qui était
    // saisi et pas encore enregistré dans le formulaire disparaissait en silence (défaut de l'audit).
    const setImage = (field, value) => { applySettings(); data.company[field] = value; save(true); render(); };
    $('#pick-logo').onclick = async () => { try { const l = await bridge.pickLogo(); if (l) setImage('logo', l); } catch (e) { toast(e.message.replace(/^.*Error: /, ''), true); } };
    if ($('#rm-logo')) $('#rm-logo').onclick = () => setImage('logo', '');
    $('#pick-stamp').onclick = async () => { try { const l = await bridge.pickLogo('Choisir l\'image du cachet / de la signature'); if (l) setImage('stampImage', l); } catch (e) { toast(e.message.replace(/^.*Error: /, ''), true); } };
    if ($('#rm-stamp')) $('#rm-stamp').onclick = () => setImage('stampImage', '');
    $('#load-demo').onclick = loadDemo;
    // Effacement définitif : on demande d'écrire le mot, pas juste de cliquer
    $('#wipe-data').onclick = () => {
      // Le décompte est calculé, pas écrit à la main : jusqu'à la 7.0.0 la fenêtre annonçait trois
      // chiffres et l'action en vidait sept listes sur trente — elle en vide maintenant trente, et
      // il serait malhonnête de continuer à n'en annoncer que trois.
      // On n'énumère que ce qui a un nom en français : les listes techniques (pièces supprimées,
      // archive de fusion, journal des clôtures) partent aussi, mais les annoncer n'apprendrait rien.
      const compte = Object.keys(C.LIST_LABELS)
        .filter(k => Array.isArray(data[k]) && data[k].length)
        .map(k => `${data[k].length} ${C.LIST_LABELS[k]}${data[k].length > 1 ? 's' : ''}`);
      const empruntee = !!(data.company && data.company.demo);
      modal(`<h2>Tout effacer</h2>
        <p>Cette action supprime <b>tout ce que contient ce dossier</b> : ${h(compte.join(', ') || 'aucune donnée pour l\'instant')}. Les factures émises partent aussi.</p>
        <p class="small muted">Une sauvegarde nommée est prise juste avant : tu pourras revenir en arrière par <em>Importer</em>. ${empruntee
          ? '<b>La fiche société part également</b>, parce qu\'elle vient du jeu d\'exemple : garder un matricule et un RIB inventés ferait partir ta première vraie facture dans le vide.'
          : 'Tes paramètres société sont conservés.'}</p>
        <form id="wf"><label class="field"><span class="fl">Pour confirmer, écris <b>EFFACER</b> ci-dessous</span><input type="text" name="w" autocomplete="off" spellcheck="false" placeholder="EFFACER"></label></form>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-danger" id="ok" disabled>Tout effacer</button></div>`,
        (root, close) => {
          const inp = $('input[name=w]', root), ok = $('#ok', root);
          inp.oninput = () => { ok.disabled = inp.value.trim().toUpperCase() !== 'EFFACER'; };
          ok.onclick = async () => {
            close();
            if (!await closedWipeOk('Tout effacer.')) return;
            clearGuard();                       // les données partent : plus rien à protéger
            await bridge.createBackup('avant-effacement');
            // La liste des choses à vider se déduit des données (core.wipeData) : écrite à la main,
            // elle avait raté treize modules sur vingt — après le jeu d'exemple il restait de faux
            // fournisseurs, de faux salariés et de faux comptes bancaires.
            // La fiche société est conservée SAUF si elle vient de l'exemple : garder un faux
            // matricule et un faux RIB, c'est envoyer la première vraie facture dans le vide.
            const identiteEmpruntee = !!(data.company && data.company.demo);
            C.wipeData(data, { garderSociete: !identiteEmpruntee });
            save(true);
            toast(identiteEmpruntee
              ? 'Données effacées — la fiche société de l\'exemple aussi : remplis la tienne dans Paramètres'
              : 'Données effacées');
            if (identiteEmpruntee) allerParametres('societe', 'p-identite'); else render();
            $('#brand-company').textContent = data.company.name;
          };
        });
    };
  };

  // ---------- Aide ----------
  // ---------- Tous les modules (7.0.0) ----------
  // La contrepartie de la barre latérale filtrée. Elle n'a de sens que si cette page existe : sans
  // elle, masquer un module reviendrait à le supprimer pour quelqu'un qui ne connaît pas la palette.
  // Trois règles s'y voient à l'œil nu :
  //   — le cœur du métier ne se décoche pas (il n'a même pas de case) ;
  //   — tout le reste se décoche ET se recoche, toujours : une case qui se change en cadenas sous le
  //     doigt (ce qu'elle faisait jusqu'à la 7.12.0 dès que le module contenait une ligne) laissait
  //     le module dans le menu sans plus aucun moyen de revenir en arrière ;
  //   — décocher ne supprime rien : la phrase le dit avant, pas après, et masquer un module qui
  //     contient quelque chose se confirme, en nommant ce qui reste atteignable.
  routes.modules = () => {
    const co = company();
    const choisis = Array.isArray(co.modules) ? co.modules.slice() : null;
    const dessine = () => {
      const lignes = C.MODULES.map(m => {
        const n = C.moduleCount(data, m.id);
        const why = C.moduleWhy(data, m.id);
        const on = C.moduleOn(data, m.id);
        const pages = C.PAGES.filter(p => p.module === m.id && !p.horsMenu).map(p => p.titre).join(' · ');
        const contenu = n ? `${n} élément${n > 1 ? 's' : ''} enregistré${n > 1 ? 's' : ''}.` : 'Rien d\'enregistré pour l\'instant.';
        const note = m.toujours ? 'Toujours affiché : c\'est le cœur du métier.'
          : why === 'tout' ? `Affiché : aucun choix enregistré pour l'instant. ${contenu}`
          : why === 'masque' ? `Hors du menu. ${contenu}${n ? ' Rien n\'est supprimé.' : ''}`
          : contenu;
        return `<div class="mod-row${on ? ' on' : ''}">
          <label class="mod-check">${m.toujours
            ? `<span class="mod-lock" title="${h(note)}">★</span>`
            : `<input type="checkbox" data-mod="${h(m.id)}" data-n="${n}" ${on ? 'checked' : ''}>`}</label>
          <div class="mod-txt">
            <div class="mod-t">${h(m.label)}</div>
            <div class="small muted">${h(m.quoi)}</div>
            <div class="small muted mt-s"><b>Pages :</b> ${h(pages)} · ${h(note)}</div>
          </div>
          <div class="mod-go">${on && pages ? `<button class="btn btn-sm" data-open="${h(m.id)}">Ouvrir</button>` : ''}</div>
        </div>`;
      }).join('');
      $('#mod-list').innerHTML = lignes;
      $$('[data-mod]').forEach(cb => cb.onchange = async () => {
        const id = cb.dataset.mod;
        const n = Number(cb.dataset.n) || 0;
        // Masquer un module qui contient quelque chose est un geste légitime — c'est son menu — mais
        // il mérite une phrase : ce qu'il advient des données (rien), par où la page reste
        // atteignable, et le fait qu'elle revienne d'elle-même le jour où il y enregistre autre
        // chose. Sans elle, décocher « Achats » après trente factures fournisseur fait peur.
        if (!cb.checked && n) {
          const ok = await confirmDialog(
            `Retirer « ${C.moduleById(id).label} » du menu ?\n\n`
            + `Il contient ${n} élément${n > 1 ? 's' : ''} : rien n'est supprimé et aucun calcul ne change. `
            + `Ses pages restent atteignables par la recherche (${MOD}+K) et par leur adresse, et le module revient tout seul `
            + 'dans le menu le jour où tu y enregistres quelque chose de nouveau.',
            'Retirer du menu', false);   // rien n'est détruit : le bouton n'a pas à être rouge
          if (!ok) { cb.checked = true; return; }
        }
        const liste = Array.isArray(company().modules) ? company().modules.slice() : C.MODULES.map(m => m.id);
        const i = liste.indexOf(id);
        if (cb.checked && i < 0) liste.push(id);
        if (!cb.checked && i >= 0) liste.splice(i, 1);
        company().modules = liste;
        save();
        dessine();
        drawNav();
        // Le panneau se redessine (les explications changent au premier choix) : sans ce rappel, le
        // focus retombait sur le corps de la page et il fallait reprendre la souris à chaque case.
        const encore = $(`[data-mod="${id}"]`);
        if (encore) encore.focus();
        toast(cb.checked ? 'Affiché dans le menu' : 'Retiré du menu — rien n\'est supprimé, et la case reste là pour revenir en arrière');
      });
      $$('[data-open]').forEach(b => b.onclick = () => {
        const p = C.PAGES.find(x => x.module === b.dataset.open && !x.horsMenu);
        if (p) navigate('#/' + p.id);
      });
    };
    $('#view').innerHTML = `<div class="page-head"><h1>Tous les modules</h1>
      <div class="actions">${backButton('#/dashboard')}${choisis ? '<button class="btn" id="mod-all">Tout afficher</button>' : ''}</div></div>
      <p class="lead">SkanFact sait faire beaucoup de choses. Tu n'en as pas besoin le premier jour, et
      une liste de dix-neuf entrées dans le menu ne t'aide pas à trouver la bonne.</p>
      <div class="panel">
        <p class="small muted mb"><b>Retirer un module du menu ne supprime rien</b> et ne désactive aucun calcul :
        ses pages restent atteignables par la recherche (${MOD}+K) et par leur adresse, et la case reste
        là pour le remettre. Un module que tu as masqué <b>revient tout seul</b> le jour où tu y
        enregistres quelque chose — on ne cache jamais ton travail.</p>
        <div id="mod-list"></div>
      </div>`;
    dessine();
    bindBack('#/dashboard');
    if ($('#mod-all')) $('#mod-all').onclick = () => {
      company().modules = null; save(); drawNav(); render();
      toast('Toutes les pages sont affichées');
    };
  };

  // L'aide comptait trente-deux articles présentés en une liste plate de trente-deux titres, sans
  // recherche : quelqu'un qui bute sur « assiette » ne pouvait pas taper « assiette ». Il devait
  // deviner dans lequel des trente-deux ça se trouve — et le glossaire était l'avant-dernier.
  // La recherche lit aussi le CORPS des articles : c'est ce qui permet de trouver un mot qui
  // n'apparaît dans aucun titre.
  let aideQ = '';
  const sansBalises = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  function aideFiltre(arts, q) {
    const mots = (q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!mots.length) return arts;
    return arts.filter(a => {
      const texte = `${a.title} ${a.sub} ${sansBalises(a.body)}`.toLowerCase();
      return mots.every(m => texte.includes(m));
    });
  }
  const aideListe = arts => arts.length
    ? arts.map(x => `<button data-art="${x.id}" class="${x.id === aideArticle ? 'active' : ''}"><span class="ht">${h(x.title)}</span><span class="hs">${h(x.sub)}</span></button>`).join('')
    : '<p class="small muted" style="padding:10px 12px">Aucun article ne contient ces mots. Essaie un seul mot, ou consulte « Le vocabulaire ».</p>';

  routes.aide = (parts) => {
    const arts = G.ARTICLES;
    if (parts && parts[0]) aideArticle = parts[0];
    if (!arts.some(a => a.id === aideArticle)) aideArticle = arts.length ? arts[0].id : '';
    const a = arts.find(x => x.id === aideArticle) || { title: '', sub: '', body: '' };
    $('#view').innerHTML = `
      <div class="page-head"><h1>Aide</h1>
        <div class="actions">${backButton('#/dashboard', 'aide')}<button class="btn" id="aide-support">Signaler un problème</button><button class="btn" id="aide-changelog">Nouveautés de la version</button></div></div>
      <p class="lead">Comment marche SkanFact, et comment tenir la gestion d'une petite entreprise sans rien oublier. Partout dans l'application, les petits <span class="i-demo">i</span> expliquent le champ juste à côté.</p>
      <div class="help-grid">
        <nav class="help-nav">
          <input type="search" id="aide-q" placeholder="Rechercher : un mot, une question…" autocomplete="off" spellcheck="false" value="${h(aideQ)}">
          <div class="help-count small muted" id="aide-n" hidden></div>
          <div id="aide-liste">${aideListe(arts)}</div>
        </nav>
        <article class="panel help-body">
          <h2 class="help-h">${h(a.title)}</h2>
          <p class="help-sub">${h(a.sub)}</p>
          ${a.body}
          <p class="small muted help-foot">Une question de fiscalité ou de comptabilité que cette aide ne tranche pas ? Elle est pour ton comptable : lui seul connaît ta situation et la réglementation en vigueur.</p>
        </article>
      </div>`;
    const brancherListe = () => $$('[data-art]').forEach(b => b.onclick = () => { aideArticle = b.dataset.art; navigate('#/aide/' + b.dataset.art); });
    brancherListe();
    const q = $('#aide-q');
    q.oninput = () => {
      aideQ = q.value;
      const trouves = aideFiltre(arts, aideQ);
      $('#aide-liste').innerHTML = aideListe(trouves);
      const n = $('#aide-n');
      n.hidden = !aideQ.trim();
      n.textContent = `${trouves.length} article${trouves.length > 1 ? 's' : ''} sur ${arts.length}`;
      brancherListe();
    };
    // Échap vide la recherche plutôt que de fermer quoi que ce soit : c'est le geste attendu dans un
    // champ de recherche, et il n'y a rien d'autre à fermer sur cette page.
    q.onkeydown = e => { if (e.key === 'Escape' && q.value) { e.stopPropagation(); q.value = ''; q.oninput(); } };
    if (aideQ) q.oninput();
    bindBack('#/dashboard', 'aide');
    $('#aide-changelog').onclick = showChangelog;
    $('#aide-support').onclick = supportForm;
  };

  // ---------- signaler un problème (6.6.0) ----------
  // Un rapport utile tient en trois choses : ce qui s'est passé, la version, et le journal technique.
  // Ce qu'il ne contient JAMAIS : un nom de client, un montant, une donnée d'entreprise.
  async function supportForm() {
    let info = {};
    try { info = await bridge.supportInfo(); } catch {}
    const tech = `SkanFact ${info.version || '?'} · ${info.platform || '?'} · Electron ${info.electron || '?'}`;
    modal(`<h2>Signaler un problème</h2>
      <p class="small">Décris ce que tu faisais au moment du problème : c'est ce qui permet de le reproduire, et donc de le corriger. Le reste est déjà rempli.</p>
      <label class="field">Ce qui s'est passé
        <textarea id="sup-what" rows="4" placeholder="Ex. : j'ai cliqué sur « Émettre » depuis un devis et l'application n'a plus répondu."></textarea></label>
      <div class="notes-md mt"><strong>Joint automatiquement</strong>
        <p class="small">${h(tech)}</p>
        <p class="small">Le journal technique : ${info.lines || 0} ligne(s)${info.lines ? ' — dates, erreurs et piles d\'appels' : ' (aucune erreur enregistrée, bon signe)'}.</p>
        <p class="small muted">Ce journal ne contient <strong>aucune donnée de ton entreprise</strong> : ni client, ni montant, ni document. Tu peux le lire avant d'envoyer.</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="sup-log">Voir le journal</button>
        <button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="sup-send">Préparer le message</button></div>`,
      (root, close) => {
        $('#sup-log', root).onclick = () => bridge.openLog();
        $('#sup-send', root).onclick = async () => {
          const what = $('#sup-what', root).value.trim();
          const body = `Bonjour,\n\nJ'ai rencontré un problème avec SkanFact.\n\n`
            + `Ce qui s'est passé :\n${what || '(à compléter)'}\n\n`
            + `--- informations techniques ---\n${tech}\nDossier : ${info.logPath || ''}\n\n`
            + (info.log ? `--- journal (${info.lines} lignes) ---\n${String(info.log).slice(-6000)}\n` : '(journal vide)\n');
          await bridge.composeMail({ to: LICENCE_CONTACT, subject: `Problème SkanFact ${info.version || ''}`, body });
          close(); toast('Message préparé — relis-le avant de l\'envoyer');
        };
      });
  }

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

  // ---------- lecture de factures : la clé et le consentement (4.2.0) ----------
  // Sans clé, aucune requête ne part de l'ordinateur. Le panneau le dit avant de proposer quoi que ce soit.
  async function drawOcrPanel() {
    if (!$('#ocr-panel')) return;
    let st = { hasKey: false, model: '' };
    try { st = await bridge.ocrStatus(); } catch (_) {}
    // On REDEMANDE l'élément après l'attente : entre la question au processus principal et sa
    // réponse, l'utilisateur a pu changer de page, et l'écran est alors entièrement redessiné. La
    // poignée obtenue avant l'attente désigne un élément détaché — on écrivait dedans sans rien
    // afficher, puis `$('#ocr-key')` cherchait dans le document VIVANT, ne trouvait rien, et
    // `null.onclick` levait une exception que personne ne voyait.
    const el = $('#ocr-panel'); if (!el) return;
    el.innerHTML = `
      <p class="small mb">Photographier une facture fournisseur au lieu de la saisir. SkanFact envoie l'image à un service d'intelligence artificielle qui en lit les informations, puis <b>te propose un formulaire pré-rempli à valider</b>. Il ne remplit jamais tes données tout seul : une erreur de lecture sur une quantité fausserait tout ton stock.</p>
      <div class="vat-box" style="max-width:760px">
        <div class="vat-line"><span>État</span><span class="num">${st.hasKey ? '<span class="ok-text">Activé</span>' : 'Désactivé'}</span></div>
        <div class="vat-line"><span>Ce qui sort de ton ordinateur</span><span class="num">${st.hasKey ? 'l\'image, au moment où tu cliques' : '<span class="ok-text">rien</span>'}</span></div>
        <div class="vat-line"><span>Dernière lecture</span><span class="num">${st.lastUsed ? h(new Date(st.lastUsed).toLocaleString('fr-FR')) : '<span class="muted">jamais</span>'}</span></div>
      </div>
      <p class="small muted mt">${st.hasKey
        ? 'La clé est stockée sur cet ordinateur seulement (<code>lecture-config.json</code>), jamais dans tes données ni dans tes sauvegardes. Chaque lecture coûte quelques centimes, facturés par le fournisseur de la clé.'
        : 'Tant qu\'aucune clé n\'est saisie, <b>aucune donnée ne quitte cet ordinateur</b> : une photo de facture peut quand même être jointe à un achat comme justificatif, ce qui marche hors ligne.'}</p>
      <div class="inline mt">
        <button class="btn ${st.hasKey ? '' : 'btn-primary'}" id="ocr-key">${st.hasKey ? 'Changer la clé' : 'Activer la lecture de factures…'}</button>
        ${st.hasKey ? '<button class="btn btn-danger" id="ocr-off">Désactiver et effacer la clé</button>' : ''}
      </div>`;
    $('#ocr-key', el).onclick = () => ocrKeyForm(() => drawOcrPanel());
    if ($('#ocr-off', el)) $('#ocr-off', el).onclick = async () => {
      if (!await confirmDialog('Effacer la clé de cet ordinateur ? Plus rien ne sera envoyé nulle part. Tu pourras toujours joindre les photos comme justificatifs.')) return;
      await bridge.ocrSetKey(null);
      toast('Clé effacée'); drawOcrPanel();
    };
  }

  function ocrKeyForm(done) {
    modal(`<h2>Activer la lecture de factures</h2>
      <p class="small">Avant d'activer, lis ceci — c'est important et ça ne prend pas trente secondes :</p>
      <ul class="small" style="margin:0 0 14px 18px">
        <li>L'<b>image de la facture</b> est envoyée sur internet, à un service d'intelligence artificielle, au moment où tu cliques « Lire ». Rien d'autre ne part : ni tes clients, ni tes chiffres, ni ta comptabilité.</li>
        <li>Il faut une <b>clé payante</b>, que tu crées toi-même sur <code>console.anthropic.com</code>. Chaque facture lue coûte quelques centimes.</li>
        <li>La clé reste <b>sur cet ordinateur</b>, dans un fichier à part. Elle n'est jamais mise dans tes données ni dans tes sauvegardes.</li>
        <li>Tu peux tout désactiver et effacer la clé à tout moment, d'un clic.</li>
      </ul>
      <form id="okf" class="grid-2">
        <label class="field span-2">Clé d'API<input type="password" name="key" placeholder="sk-ant-…" autocomplete="off"></label>
        <label class="field span-2">${lbl('Modèle', 'ocr.model')}<input type="text" name="model" value="claude-sonnet-5" spellcheck="false"></label>
      </form>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok">Activer</button></div>`,
      (root, close) => {
        $('#ok', root).onclick = async () => {
          const v = formValues($('#okf', root));
          if (!(v.key || '').trim()) return toast('Colle ta clé d\'API.', true);
          try {
            await bridge.ocrSetKey(v.key.trim(), (v.model || '').trim() || undefined);
            close(); toast('Lecture de factures activée'); if (done) done();
          } catch (e) { toast(e.message || 'Échec', true); }
        };
      });
  }

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

  // Le panneau de licence. Il dit l'état, ce qui est bloqué et ce qui ne l'est pas, et prépare la
  // demande. Jamais d'appel réseau : la vérification se fait avec la clé publique embarquée.
  function drawLicencePanel() {
    const el = $('#lic-panel'); if (!el) return;
    const st = licence || {};
    const cls = st.state === 'active' || st.state === 'libre' ? 'accepté' : st.state === 'essai' ? 'émis' : 'annulée';
    el.innerHTML = st.state === 'libre'
      ? `<p><span class="badge accepté">Licence non requise</span></p>
         <p class="small">Cette version de SkanFact n'exige aucune licence : tu peux l'utiliser et la partager telle quelle.</p>`
      : `<p><span class="badge ${cls}">${h(st.label || '')}</span></p>
         ${st.detail ? `<p class="small">${h(st.detail)}</p>` : ''}
         ${st.name ? `<table class="list compact"><tbody>
            <tr><td>Titulaire</td><td><strong>${h(st.name)}</strong></td></tr>
            ${st.matricule ? `<tr><td>Matricule</td><td>${h(st.matricule)}</td></tr>` : ''}
            ${st.exp ? `<tr><td>Valable jusqu'au</td><td>${C.fmtDate(st.exp)}</td></tr>` : ''}
            ${st.cabinet ? `<tr><td>Cabinet parrain</td><td class="mono">${h(st.cabinet)}</td></tr>` : ''}
          </tbody></table>` : ''}
         <label class="field mt">Clé de licence
           <textarea id="lic-key" rows="3" placeholder="SKAN1.…">${h(st.key || '')}</textarea></label>
         <div class="inline mt">
           <button type="button" class="btn btn-primary" id="lic-save">Enregistrer la clé</button>
           <button type="button" class="btn" id="lic-ask">Demander une licence</button>
           ${st.key ? '<button type="button" class="btn btn-ghost" id="lic-clear">Retirer la clé</button>' : ''}
         </div>
         <p class="small muted mt"><strong>Tes données t'appartiennent, licence ou pas.</strong> Même expirée, tu peux tout lire, imprimer, exporter et envoyer à ton comptable. Seule la création de nouvelles pièces attend le renouvellement.</p>
         <p class="small muted">La vérification se fait <strong>sur cet ordinateur</strong>, sans aucune connexion : SkanFact n'envoie jamais ta clé nulle part.</p>`;

    const setKey = async (key) => {
      try {
        licence = await bridge.licenceSet(key);
        drawLicencePanel(); licenceBanner();
        toast(licence.locked ? licence.label : 'Licence enregistrée : ' + licence.label);
      } catch (e) { toast(plainError(e), true); }
    };
    if ($('#lic-save')) $('#lic-save').onclick = () => setKey($('#lic-key').value.trim());
    if ($('#lic-clear')) $('#lic-clear').onclick = async () => {
      if (!await confirmDialog('Retirer la clé de licence de cet ordinateur ?')) return;
      setKey('');
    };
    if ($('#lic-ask')) $('#lic-ask').onclick = async () => {
      const m = await bridge.licenceMail(company(), deviceLabel());
      await bridge.composeMail({ to: LICENCE_CONTACT, subject: m.subject, body: m.body });
      toast('Message préparé');
    };
  }

  // Un bandeau, et seulement quand il sert : essai qui se termine, ou création bloquée.
  function licenceBanner() {
    const el = $('#lic-banner');
    const show = licence.locked || (licence.state === 'essai' && licence.daysLeft != null && licence.daysLeft <= 7);
    if (!el) return;
    el.hidden = !show;
    el.classList.toggle('warn', !!licence.locked);
    if (show) el.textContent = licence.locked ? licence.label + ' — voir Paramètres → Licence' : licence.label;
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
    else if (!a.relay && (upd.state === 'token' || !a.hasToken)) body = `<p class="muted">Les mises à jour automatiques ne sont pas encore activées sur cet ordinateur : colle ton token GitHub ci-dessous et clique sur Enregistrer.</p>${btnCheck}`;
    else body = btnCheck;
    // Quand le relais est en place, il n'y a plus rien à saisir : c'est lui qui détient l'accès au
    // dépôt. Montrer un champ « token » que personne n'a à remplir ne ferait qu'inquiéter.
    // Et si le relais a échoué, on le DIT et on remontre le champ : un écran qui affirme « rien à
    // configurer » devant une mise à jour impossible est pire que pas d'écran du tout.
    const relayNote = a.relayFailure ? `<p class="small mt" style="color:var(--danger)">${h(a.relayFailure)}</p>` : '';
    const tokenBlock = a.relay
      ? `<p class="small muted mt">Les mises à jour arrivent toutes seules : rien à configurer sur cet ordinateur.${a.hasToken ? ' <span class="muted">(Un ancien token est encore enregistré ; il ne sert plus.)</span>' : ''}</p>`
      : relayNote + `<div class="token-box">
      <div class="k-label">Accès au dépôt privé</div>
      <p class="small muted">Le dépôt GitHub de SkanFact est privé : un token de lecture est nécessaire pour vérifier les mises à jour. Il est enregistré uniquement sur cet ordinateur.</p>
      <div class="inline"><input type="text" id="upd-token" placeholder="${a.hasToken ? 'Token enregistré ✓ — coller un nouveau pour remplacer' : 'github_pat_… ou ghp_…'}" autocomplete="off" spellcheck="false"><button class="btn btn-sm" id="upd-token-save">Enregistrer</button>${a.hasToken ? '<button class="btn btn-sm btn-ghost" id="upd-token-clear">Retirer</button>' : ''}</div>
    </div>`;
    el.innerHTML = `<div class="update-head"><div><div class="k-label">Version installée</div><div class="ver">${h(a.version || '…')}</div></div><button class="btn btn-sm btn-ghost" id="upd-changelog">Nouveautés</button></div>${body}${tokenBlock}`;
    $('#upd-changelog').onclick = showChangelog;
    if ($('#upd-token-save')) $('#upd-token-save').onclick = async () => {
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
    else if (name === 'back') go(() => goBack());
    else if (name === 'apercu') {
      if (pleinEcranCourant) pleinEcranCourant();
      else toast('Le grand aperçu s\'ouvre depuis un devis ou une facture.', true);
    }
    else if (name.startsWith('help:')) navigate('#/aide/' + name.slice(5));
    else if (name.startsWith('go:')) navigate('#/' + name.slice(3));
  });

  // ---------- assistant de première utilisation ----------
  const OB = window.SkanOnboarding;
  // `rejoue` : l'assistant se relance depuis les Paramètres, prérempli avec ce qui est déjà réglé.
  // Jusqu'à la 7.1.1 il ne s'affichait qu'une fois — `needsSetup` exige qu'il n'y ait NI société, NI
  // document, NI client — et « Passer » le condamnait pour de bon. Quelqu'un qui l'avait sauté par
  // réflexe le premier jour ne pouvait plus jamais le revoir.
  function runSetup(rejoue) {
    return new Promise(resolve => {
      const steps = OB.STEPS;
      const co = (data && data.company) || {};
      const defauts = { currency: 'DT', stampFee: 1, quoteValidityDays: 30, paymentTermsDays: 30, defaultWithholdingRate: 0, activity: '', fillCatalog: true };
      // Reprise : l'assistant écrit à chaque étape depuis la 7.2.0, on repart donc là où il s'est
      // arrêté, avec ce qui avait déjà été tapé. Avant, fermer la fenêtre au cinquième écran
      // effaçait les cinq — alors que « Passer », geste plus radical, les conservait.
      const reprise = !rejoue && !!co.setupStarted;
      const a = rejoue ? { ...co, activity: co.activity || '', fillCatalog: false }
        : reprise ? { ...defauts, ...co, activity: co.activity || '', fillCatalog: !(data.catalog || []).length }
        : { ...defauts };
      if (!Array.isArray(a.modules)) delete a.modules;      // rejeu : null ne doit pas passer pour un choix
      a.modulesTouche = Array.isArray(a.modules);           // un choix déjà enregistré ne se fait pas écraser
      let i = reprise ? Math.min(Math.max(Number(co.setupStep) || 0, 0), steps.length - 1) : 0;
      const root = document.createElement('div'); root.id = 'setup';
      document.body.appendChild(root);

      const bodyFor = s => {
        if (s.id === 'bienvenue') return s.intro;
        if (s.id === 'entreprise') return `<form id="sf-form" class="grid-2">
          <label class="field span-2">${lbl('Raison sociale', 'co.name')} <span class="req">obligatoire</span><input type="text" name="name" value="${h(a.name || '')}" placeholder="Nom exact de l'entreprise, forme juridique comprise" autofocus></label>
          ${field(lbl('Matricule fiscal', 'co.matricule'), 'matricule', a.matricule || '', 'text', 'placeholder="1234567X/A/M/000"')}
          ${field(lbl('Registre de commerce (RC)', 'co.rc'), 'rc', a.rc || '', 'text', 'placeholder="facultatif"')}
          <label class="field span-2">${lbl('Adresse', 'co.address')}<textarea name="address" placeholder="Rue et numéro&#10;Code postal et ville">${h(a.address || '')}</textarea></label>
          ${field('Téléphone', 'phone', a.phone || '')}
          ${field('Email', 'email', a.email || '', 'email')}
          ${field(lbl('Capital social', 'co.capital'), 'capital', a.capital || '', 'text', 'placeholder="facultatif, ex. 1 000 DT"')}
        </form>
        ${a.nomDuDossier ? '<p class="small muted">C\'est le nom du dossier que tu viens de créer. Corrige-le ici pour qu\'il s\'imprime exactement comme sur tes papiers, forme juridique comprise.</p>' : ''}
        <p class="small muted">Le matricule fiscal est obligatoire sur une facture en Tunisie. Si tu ne l'as pas encore, laisse vide et complète-le avant ta première facture.</p>`;
        if (s.id === 'activite') return `<div class="act-grid">
          ${C.ACTIVITIES.map(x => `<button type="button" class="act ${a.activity === x.id ? 'sel' : ''}" data-act="${x.id}">
            <span class="act-l">${h(x.label)}</span>
            <span class="act-s">${x.catalog.length ? x.catalog.length + ' prestations proposées · TVA ' + x.vat + ' %' : 'catalogue vide'}</span></button>`).join('')}
        </div>
        <label class="check mt"><input type="checkbox" id="sf-cat" ${a.fillCatalog ? 'checked' : ''}> Préremplir mon catalogue avec ces prestations (prix à ajuster ensuite)</label>
        <p class="small muted mt">Le catalogue sert à insérer une prestation dans un devis en un clic, sans retaper le libellé ni le prix. Les taux de TVA proposés sont les plus courants — <em>à faire confirmer par ton comptable</em>.</p>`;
        // Tant que personne ne posait la question, `company.modules` restait à `null` et le menu
        // affichait ses dix-sept entrées dès le premier jour : Stock, Paie, Immobilisations et
        // Marges à quelqu'un qui n'a pas encore un seul client. Le tri existait, personne ne
        // l'armait. Les cases arrivent cochées d'après le métier déclaré à l'écran précédent.
        if (s.id === 'modules') {
          if (!a.modulesTouche) a.modules = C.modulesSuggeres(a.activity);
          const suggere = C.modulesSuggeres(a.activity);
          const coeur = C.MODULES.filter(m => m.toujours);
          const choix = C.MODULES.filter(m => !m.toujours);
          // Le cœur du métier tient en UNE ligne. La première version lui donnait trois lignes
          // verrouillées en tête de liste : elles ne se cochent pas, elles ne se décochent pas, et
          // elles poussaient les vraies questions — et la phrase qui rassure — sous la coupe. Une
          // capture l'a montré tout de suite ; la relecture du code, non.
          return `<p class="small muted">Les cases sont posées d'après ton métier. ${C.liste(coeur.map(m => m.label))} sont toujours là.</p>
          <div id="sf-mods" class="mods-serre">${choix.map(m => {
            const on = a.modules.includes(m.id);
            return `<div class="mod-row${on ? ' on' : ''}">
              <label class="mod-check"><input type="checkbox" data-sfmod="${h(m.id)}" ${on ? 'checked' : ''}></label>
              <div class="mod-txt">
                <div class="mod-t">${h(m.label)}${suggere.includes(m.id) ? ' <span class="small muted">— proposé pour ton métier</span>' : ''}</div>
                <div class="small muted">${h(m.quoi)}</div>
              </div>
            </div>`;
          }).join('')}</div>
          <p class="small muted"><b>Rien n'est supprimé ni désactivé.</b> Une page retirée du menu reste atteignable par la recherche
          (${MOD}+K), et un module qui contient quelque chose revient tout seul.</p>`;
        }
        if (s.id === 'facturation') return `<form id="sf-form" class="grid-3">
          ${field(lbl('Devise', 'doc.currency'), 'currency', a.currency, 'text')}
          ${field(lbl('Timbre fiscal par facture', 'doc.stampFee'), 'stampFee', a.stampFee, 'number', 'step="0.001" min="0" class="num"')}
          <label class="field">${lbl('Retenue à la source par défaut', 'doc.withholdingDefault')}<select name="defaultWithholdingRate">${withholdingOptions(a.defaultWithholdingRate)}</select></label>
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
          <p class="small muted mt" id="sf-ext-note" hidden></p>
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
        $$('[data-sfmod]', root).forEach(cb => cb.onchange = () => {
          const liste = Array.isArray(a.modules) ? a.modules.slice() : C.modulesSuggeres(a.activity);
          const k = liste.indexOf(cb.dataset.sfmod);
          if (cb.checked && k < 0) liste.push(cb.dataset.sfmod);
          if (!cb.checked && k >= 0) liste.splice(k, 1);
          a.modules = liste;
          a.modulesTouche = true;            // un choix fait à la main ne se fait plus écraser
          cb.closest('.mod-row').classList.toggle('on', cb.checked);
        });
        // L'écran de sauvegarde montre l'état RÉEL, à l'ouverture comme après le choix. Il écrivait
        // « Copie activée vers : … » sans jamais lire `lastError` : un dossier iCloud pas encore
        // synchronisé ou une clé en lecture seule donnaient le même message rassurant que le
        // succès. Et il repartait sur « Aucun dossier choisi » dès qu'on revenait dessus.
        const direExt = x => {
          const st = $('#sf-ext-st', root), note = $('#sf-ext-note', root);
          if (!st) return;
          if (!x || !x.dir) { st.textContent = 'Aucun dossier choisi.'; st.className = 'small muted'; if (note) note.hidden = true; return; }
          if (x.lastError) {
            st.innerHTML = `<span style="color:var(--danger)">La copie a échoué : ${h(x.lastError)}</span>`;
            st.className = 'small';
            if (note) { note.hidden = false; note.textContent = 'Dossier choisi : ' + x.dir + ' — choisis-en un autre, ou vérifie que le disque est branché et accessible en écriture.'; }
            copieExterne = false;
            return;
          }
          st.textContent = 'Copie activée vers : ' + x.dir; st.className = 'small';
          if (note) note.hidden = true;
          copieExterne = true;
        };
        if ($('#sf-ext', root)) {
          $('#sf-ext', root).onclick = async () => direExt(await bridge.chooseExternalBackup());
          Promise.resolve(bridge.externalBackupInfo()).then(direExt).catch(() => {});
        }
        if ($('#sf-prev', root)) $('#sf-prev', root).onclick = () => { collect(); etape(i - 1); i--; draw(); };
        $('#sf-next', root).onclick = () => {
          collect();
          if (steps[i].id === 'entreprise' && !String(a.name || '').trim()) return toast('La raison sociale est nécessaire : c\'est le nom qui apparaît sur tes documents.', true);
          // L'écran « Ton activité » se traversait sans rien cliquer, et la case « Préremplir mon
          // catalogue » était cochée d'office : on promettait un catalogue qui n'arrivait jamais,
          // et `defaultVatRate` restait vide alors qu'une bulle affirme ailleurs que l'assistant
          // l'a réglé d'après le métier. « Autre activité » existe précisément pour ce cas.
          if (steps[i].id === 'activite' && !a.activity) return toast('Choisis une activité — « Autre activité » convient si aucune ne correspond.', true);
          if (i === steps.length - 1) return finish();
          etape(i + 1);
          i++; draw();
        };
        root.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); $('#sf-next', root).click(); } };
        $('#sf-skip', root).onclick = async () => {
          // On ramasse d'abord : « Passer » jetait tout ce qui venait d'être tapé, même au dernier
          // écran, sans le dire. Quelqu'un qui avait rempli quatre écrans et cliquait « Passer » au
          // cinquième repartait avec une fiche société vide.
          collect();
          const saisi = ['name', 'matricule', 'rc', 'address', 'phone', 'email', 'bank', 'rib', 'capital']
            .filter(k => String(a[k] || '').trim()).length;
          if (!await confirmDialog(
            (saisi ? `Ce que tu as déjà rempli (${saisi} champ${saisi > 1 ? 's' : ''}) est conservé. ` : '')
            + 'Passer la suite de l\'assistant ? Tu pourras tout régler dans Paramètres, mais une facture sans raison sociale ni matricule fiscal n\'est pas conforme.',
            'Passer', false)) return;
          OB.applySetup(data, a);            // on garde ce qui a été saisi, on n'invente rien
          save(true); drawNav(); root.remove(); resolve(false);
        };
      };
      const collect = () => { const f = $('#sf-form', root); if (f) Object.assign(a, formValues(f)); };
      // Écrire à chaque changement d'étape, sans déclarer l'assistant terminé. Rien ne vivait sur
      // le disque avant `finish()` : une veille, un Cmd+Q ou un rechargement du chien de garde au
      // cinquième écran, et les cinq écrans étaient à retaper. En rejeu on ne touche à rien tant
      // que l'utilisateur n'a pas fini : ses données existent déjà, elles ne sont pas un brouillon.
      const etape = n => {
        if (rejoue) return;
        try { OB.applySetup(data, a, { done: false, step: n }); save(true); } catch (_) {}
      };
      const finish = () => {
        OB.applySetup(data, a);
        save(true);
        drawNav();                           // le choix des modules change le menu tout de suite
        root.remove();
        resolve(true);
      };
      // « + Nouveau dossier sur cet ordinateur » demande déjà le nom de l'entreprise ; l'assistant
      // le redemandait aussitôt sous un autre libellé, champ vide, et on se demandait si les deux
      // désignaient la même chose. On ne reprend PAS le dossier d'origine, dont le nom d'usine est
      // « Mon entreprise » : ce serait remplacer la page blanche par une fausse réponse.
      (async () => {
        if (!rejoue && !reprise && !String(a.name || '').trim() && bridge.listDossiers) {
          try {
            const r = await bridge.listDossiers();
            const d = ((r || {}).dossiers || []).find(x => x.id === r.current);
            if (d && d.id !== 'principal' && String(d.name || '').trim()) { a.name = d.name; a.nomDuDossier = true; }
          } catch (_) { /* pas de dossiers : on démarre sur la page blanche, comme avant */ }
        }
        draw();
      })();
    });
  }

  // L'assistant, rejouable (7.1.1). Il ne réécrit que ce qu'on lui redonne : les champs arrivent
  // préremplis avec les réglages actuels, et le catalogue n'est pas re-proposé (on en a déjà un).
  // Hors de `routes.parametres` depuis la 7.2.0 : le bouton était rangé dans un panneau qui parle
  // de la barre latérale, cinquième de sept, dans le sixième des huit onglets, et absent de la
  // palette. Quelqu'un qui veut revoir les questions ne le trouvait pas, et concluait qu'on ne
  // peut pas revoir l'assistant — alors qu'il a été écrit pour ça.
  async function rejouerAssistant() {
    if (!await confirmDialog('Revoir l\'assistant de démarrage ? Tes réponses actuelles y sont déjà inscrites : tu peux les corriger ou simplement le parcourir. Aucune de tes pièces n\'est touchée.', 'Revoir l\'assistant', false)) return;
    clearGuard();
    await runSetup(true);
    applyTheme();
    $('#brand-company').textContent = data.company.name || 'Ton entreprise';
    render();
  }

  // ---------- import / export ----------
  async function exportAll() {
    if (security.encrypted && !await confirmDialog('L\'export JSON est en clair (non chiffré). Continuer ?', 'Exporter', false)) return;
    const p = await bridge.exportData(data); if (p) toast('Exporté : ' + p.split(/[\\/]/).pop());
  }
  async function importAll() {
    if (!await confirmDialog('Importer un fichier remplacera toutes les données actuelles (une sauvegarde de l\'état actuel est faite avant). Continuer ?')) return;
    if (!await closedWipeOk('Importer un fichier remplace tout.')) return;
    try {
      let r = await bridge.importData();
      if (r && r.needPassword) {
        r = await new Promise(resolve => promptDialog('Fichier chiffré', 'Mot de passe de ce fichier', '', async pw => resolve(await bridge.importData({ retry: true, password: pw })), 'password'));
      }
      if (r && r.needPassword) return toast('Mot de passe incorrect.', true);
      const d = r && r.data;
      // `save` autant que `clearGuard` comptent : sans l'enregistrement, quitter juste après un import
      // reperdait le fichier importé ; sans le désarmement, le garde-fou réclamait ensuite des
      // modifications qui n'existent plus.
      if (d) { clearGuard(); data = migrate(d); save(true); applyTheme(); $('#brand-company').textContent = data.company.name; toast('Données importées'); render(); }
    } catch (e) { toast('Import impossible : ' + e.message.replace(/^.*Error: /, ''), true); }
  }
  // « Exporter » et « Importer » vivaient dans le pied de la barre latérale, donc toujours visibles,
  // alors que « Paramètres » et « Aide » ne l'étaient jamais. Les deux boutons dont un débutant n'a
  // pas besoin occupaient la place des deux dont il a besoin. Ils n'ont pas disparu : ils étaient
  // déjà en double dans Paramètres → Sécurité et données (#export-data / #import-data), à côté des
  // sauvegardes, c'est-à-dire là où on les cherche.

  // ---------- chien de garde et messages du processus principal ----------
  // Abonnés AVANT la séquence de démarrage : l'assistant de première utilisation la met en attente,
  // et un message reçu pendant ce temps serait perdu pour toujours.
  // Le chien de garde : répondre au processus principal tant que l'interface tourne. La réponse
  // part du fil principal du renderer — c'est exactement lui qu'une boucle infinie bloquerait.
  bridge.onAlivePing();
  // Après un gel, l'application se recharge toute seule. Elle le dit : un redémarrage silencieux
  // ferait douter de ce qui a été enregistré, alors qu'il ne s'est rien perdu de ce qui l'était.
  bridge.onFreezeNotice(f => {
    modal(`<h2>SkanFact s'était bloqué</h2>
      <p>L'application n'a plus répondu pendant ${h(String((f && f.silence) || '?'))} secondes, et elle vient de redémarrer toute seule.</p>
      <p class="small"><strong>Ce qui était enregistré est intact.</strong> Ce qui était en cours de saisie sans avoir été enregistré est perdu — c'était déjà le cas avant le redémarrage.</p>
      <p class="small">SkanFact a noté où le programme s'était arrêté. Si cela se reproduit, envoie-le : <em>Aide → Signaler un problème</em>. C'est ce qui permet de corriger.</p>
      <div class="modal-actions"><button class="btn" data-close>Continuer</button><button class="btn btn-primary" id="fz-rep">Signaler</button></div>`,
      (root, close) => { $('#fz-rep', root).onclick = () => { close(); supportForm(); }; });
  });
  // La licence se lit une fois au démarrage : hors ligne, instantané, et jamais renvoyé nulle part.
  bridge.licenceStatus().then(st => { licence = st || licence; licenceBanner(); }).catch(() => {});

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
      // Le premier message de l'application était un toast de deux secondes et demie, qui nommait
      // un onglet de Paramètres — une entrée de menu que l'utilisateur ne voyait même pas dans sa
      // barre latérale. Ce qu'il faut dire au premier lancement est maintenant dans le panneau
      // « Tes premiers pas », qui reste à l'écran et dont chaque ligne est cliquable.
      if (done) toast('C\'est prêt.');
    }
    // La copie de sauvegarde externe ne vit pas dans les données : on la lit une fois ici pour que
    // « Tes premiers pas » sache si l'étape est faite. Un échec n'empêche rien : l'étape s'affiche
    // simplement comme à faire.
    bridge.externalBackupInfo().then(i => {
      const avant = copieExterne;
      copieExterne = !!(i && i.dir);
      if (copieExterne !== avant && location.hash === '#/dashboard') render(true);
    }).catch(() => {});
    $('#brand-company').textContent = data.company.name || 'Ton entreprise';
    accorderNomDossier();
    // La recherche générale, enfin visible et cliquable. La touche est écrite sur le bouton : c'est
    // ainsi qu'on apprend un raccourci — en le lisant là où on cliquerait de toute façon.
    if ($('#nav-search')) {
      $('#nav-search-k').textContent = SUR_MAC ? '⌘K' : 'Ctrl K';
      $('#nav-search').onclick = () => openPalette();
    }
    bridge.updateVersion().then(v => {
      upd.app = v; const el = $('#app-version'); if (el) el.textContent = 'v' + v.version;
      if (v.lastUpdate) {
        if (v.lastUpdate.ok) toast('SkanFact mis à jour en version ' + v.version);
        else modal(`<h2>Mise à jour non installée</h2><p>${h(v.lastUpdate.message || 'Erreur inconnue')}.</p><p class="small muted">Tu peux installer la nouvelle version à la main depuis la page des versions, ou réessayer depuis Paramètres → Mises à jour.</p>
          <div class="modal-actions"><button class="btn" data-close>Fermer</button><button class="btn btn-primary" id="open-rel">Voir les versions</button></div>`, (root) => { $('#open-rel', root).onclick = () => bridge.updateOpenReleases(); });
      }
    });
    $('#update-pill').onclick = () => allerParametres('maj', 'p-maj');
    $('#lic-banner').onclick = () => allerParametres('licence', 'p-licence');
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
