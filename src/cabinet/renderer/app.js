// SkanFact Cabinet — l'interface du comptable.
//
// Une seule question guide cet écran : « lequel de mes clients ne m'a pas envoyé son mois ? ».
// Tout le reste (ouvrir une pièce, relancer, régler son cabinet) en découle. On ne modifie jamais la
// comptabilité d'un client : cette application lit, elle n'écrit pas chez les autres.
(function () {
  'use strict';

  const K = window.CabCore;
  const G = window.CabGuide || { INFO: {}, ARTICLES: [] };
  // Les visites guidées (10.14.0) : le moteur partagé et le contenu du Cabinet.
  const Visite = window.Visite;
  const CV = window.CabVisites;
  const api = window.cabinet;

  let S = null;                          // l'état du cabinet (sans la clé privée)
  let backupInfo = null;                 // sauvegardes, copie externe, place disque
  let inboxInfo = null;                  // la boîte de réception : dossier surveillé, paquets nouveaux
  let exempleRefait = null;              // l'exemple vient d'être remis à jour à l'ouverture (9.4.2)

  // Charger ou retirer l'exemple à la main passe par ici, et NON par `api.demo` directement : le
  // bandeau « ils viennent d'être remis à jour » ne doit pas survivre à un exemple qu'on vient de
  // recharger soi-même — il annoncerait un rattrapage qui n'a pas eu lieu.
  // Ce que dit le chargement de l'exemple : il COMPTE ses dossiers. La phrase disait « ces cinq
  // dossiers » depuis la 9.4.2 ; le dossier hors SkanFact (10.0.0) en a fait six, et la phrase n'a
  // pas suivi — une phrase qu'on écrit en dur se périme au premier dossier ajouté (7.3.0).
  function phraseExemple() {
    const n = (S.dossiers || []).filter(d => d.demo).length;
    return n === 1 ? 'Exemple chargé : ce dossier est fictif.' : `Exemple chargé : ces ${n} dossiers sont fictifs.`;
  }

  async function chargerOuRetirerExemple(on) {
    exempleRefait = null;
    const etat = await api.demo(on);
    // 10.14.0 (vu à la souris) — l'exemple écrit et efface des LIVRES : le résumé des index (dossiers
    // tenus au cabinet, exercices clos, questions) se relit ici. Lu au démarrage, avant l'exemple, il
    // disait « aucun exercice » du garage, et la découverte sautait son chapitre « D'un exercice à
    // l'autre » sans un mot — un état lu une fois se périme (7.1.x).
    await chargerQuestionsAttente(false);
    return etat;
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
  const relState = { seulement: null, depuis: '', coches: new Set(), pg: { page: 1, size: 50 } };

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
  // Aucun appel aujourd'hui — c'est un filet, pas un outil : il est DÉLIBÉRÉMENT inutilisé, et
  // c'est pour ça qu'on fait taire le lint ici plutôt que de le supprimer.
  // eslint-disable-next-line no-unused-vars
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
    // U-11 — « ✓ enregistré » rend son « Enregistrer » au repos : le vert ne désigne que ce qui
    // reste à enregistrer (voir `sale`).
    const b = el.parentElement && el.parentElement.querySelector('[data-enreg]');
    if (b) b.classList.remove('btn-primary');
  }

  // U-11 — un panneau de réglages n'a pas de bouton principal AU REPOS : six « Enregistrer » verts
  // sur le même onglet ne désignaient plus rien (mesuré sur « Mon cabinet » et « Comptabilité »). Le
  // bouton `data-enreg` d'un panneau prend la couleur à la première modification — une frappe, un
  // choix, une ligne ajoutée ou retirée — et `flash` la lui rend au « ✓ enregistré ».
  const sale = el => {
    const p = el && el.closest && el.closest('.panel');
    const b = p && p.querySelector('[data-enreg]');
    if (b) b.classList.add('btn-primary');
  };

  // Ce qui se dicte au téléphone se copie aussi : vingt caractères affichés sans bouton pour les
  // prendre se recopient à la main, donc se recopient faux (10.9.2). Une seule porte pour les trois
  // empreintes de l'application — celle du cabinet (Réglages, assistant) et celle de la licence.
  async function copierEmpreinte(texte) {
    try { await navigator.clipboard.writeText(texte || ''); toast('Empreinte copiée.'); }
    catch { await infoDialog('Copie impossible', 'Le presse-papiers n\'a pas répondu. Sélectionne l\'empreinte à la main.'); }
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
    // Et un lecteur d'écran le sait aussi : la classe ne se voit qu'à l'œil (C-14).
    el.setAttribute('aria-invalid', 'true');
    const nettoyer = () => { marque.classList.remove('champ-faute'); el.removeAttribute('aria-invalid'); };
    marque.addEventListener('input', nettoyer, { once: true });
    marque.addEventListener('change', nettoyer, { once: true });
    setTimeout(nettoyer, 6000);
    return false;
  }

  // 10.14.0 — un mot de passe se tape puis se confirme, et Entrée DESCEND de l'un à l'autre tant que
  // la confirmation est vide. Tab passe par « Afficher », et ça reste : le sortir de l'ordre de
  // tabulation rendrait le bouton inatteignable au clavier (règle 9.3.0 — on AJOUTE un chemin, on
  // n'en coupe pas un). Vu à la souris : taper le mot de passe, Tab, la confirmation… et la
  // confirmation partait sur le bouton. `stopPropagation` : la fenêtre valide sur Entrée, et
  // valider une confirmation vide ne ferait qu'afficher un refus pour un pas normal.
  // Le jumeau vit dans src/renderer/app.js, corps comparé par un test.
  function enchainerConfirmation(champ, confirmation) {
    if (!champ || !confirmation) return;
    champ.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || confirmation.value) return;
      e.preventDefault(); e.stopPropagation();
      confirmation.focus();
    });
  }

  // 10.14.0 — un NOM dans une cellule tronquée, et ses marques à côté : le nom se coupe, les marques
  // jamais (le motif « En face » du livre-journal, T-12). `nomHtml` et les marques sont déjà échappés.
  function marquesDuNom(nomHtml, marques) {
    const m = (marques || []).filter(Boolean);
    return m.length ? `<span class="face"><span class="face-p">${nomHtml}</span><span class="face-m">${m.join(' ')}</span></span>` : nomHtml;
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
      paire('Solder depuis la case Crédit', t.solder),
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
  //
  // 10.14.0 — le champ ne montre plus le nom INTERNE de la touche (« Control+Enter » à côté de sa
  // touche dessinée « Ctrl + ↵ Entrée ») : le format interne fuit dans l'écran de saisie (9.4.5). Il
  // vit dans `data-code`, la touche se lit une fois — dessinée, en français — et le champ n'est plus
  // que la zone où l'on appuie : « Changer… », puis « Appuie sur la touche… ». Vu au test humain,
  // sur l'écran qu'ouvre « Régler ta grille de saisie » dans « Tes premiers pas ».
  const nomTouche = combo => String(combo || '').split('+').map(t => NOM_TOUCHE[t] || t).join(' + ');
  const champTouche = (k, titre, cle) => {
    const v = (((S.settings || {}).saisie || {}).touches || {})[k] || K.DEFAULT_SAISIE.touches[k];
    return `<div class="field narrow touche-champ">${lbl(titre, cle)}
      <div class="touche-ligne">
        <span class="touche-vue" data-vue="${esc(k)}">${kbd(v)}</span>
        <input type="text" readonly data-touche="${esc(k)}" data-code="${esc(v)}" value="" placeholder="Changer…" class="touche-in"
          aria-label="${esc(titre)} : ${esc(nomTouche(v))} — appuie sur la touche à utiliser" title="Clique, puis appuie sur la touche à utiliser">
        <button type="button" class="btn btn-sm" data-touche-reset="${esc(k)}" title="Remettre ${esc(nomTouche(K.DEFAULT_SAISIE.touches[k]))}">Remettre d'origine</button>
      </div></div>`;
  };

  function info(key) {
    if (!G.INFO[key]) return '';
    // Le NOM que lit un lecteur d'écran dit ce que la bulle explique (10.12.0) : trois bulles
    // nommées « Qu'est-ce que c'est ? » sur une page sont trois boutons qu'on ne distingue pas —
    // c'est Browser Use, qui lit l'arbre d'accessibilité, qui l'a montré.
    return `<button type="button" class="i" data-info="${esc(key)}" aria-label="Explication : ${esc(G.INFO[key].t || key)}" title="Qu'est-ce que c'est ?">i</button>`;
  }
  const lbl = (text, key) => key ? `<span class="fl">${text} ${info(key)}</span>` : text;

  // 10.12.0 — une bulle « i » qui termine une phrase passait SEULE sur la ligne suivante dès que la
  // phrase remplissait sa ligne : « … pour un dossier. » puis, dessous, un « i » orphelin qu'on
  // prend pour un reste de mise en page. Le dernier mot et la bulle vont dans un <span> qui ne se
  // coupe pas (`.colle-bulle`) : la bulle part avec son dernier mot. Une espace insécable NE SUFFIT
  // PAS — c'était la première version : la bulle est un élément « en ligne atomique » (inline-grid),
  // et Chrome coupe avant lui même derrière une espace insécable. Elle tenait sur les écrans où on
  // l'avait vérifiée, et la sonde des bulles a trouvé à 1280 px « Délai moyen de paiement » puis un
  // « i » seul dessous, sur des étiquettes déjà « collées ». Jamais dans un conteneur flex ou
  // grille, où chaque morceau de texte est un élément à lui seul (H-E9). Posée sur chaque nœud
  // ajouté au document : une liste redessinée à la frappe reçoit la même règle qu'une page. Le
  // corps est le MÊME dans les deux applications (un test le compare).
  function collerBulles(racine) {
    const liste = racine.matches && racine.matches('button.i') ? [racine] : racine.querySelectorAll('button.i');
    for (const b of liste) {
      const parent = b.parentElement;
      if (!parent || parent.classList.contains('colle-bulle') || /flex|grid/.test(getComputedStyle(parent).display)) continue;
      const t = b.previousSibling;
      if (!t || t.nodeType !== 3) continue;
      const colle = document.createElement('span');
      colle.className = 'colle-bulle';
      const m = t.data.match(/(\S+)[ \t\n\u00a0]*$/);
      if (m) {
        // Le dernier mot part avec la bulle, séparé d'elle par une espace insécable.
        t.data = t.data.slice(0, m.index);
        colle.append(m[1] + '\u00a0');
      } else {
        // Que des blancs : la bulle suit un élément en ligne (« <strong>…</strong> i »), qui l'emmène.
        const el = t.previousSibling;
        if (!/\s/.test(t.data) || !el || el.nodeType !== 1 || !/^inline/.test(getComputedStyle(el).display)) continue;
        parent.insertBefore(colle, el);
        colle.append(el, '\u00a0');
        t.remove();
      }
      if (!colle.parentNode) parent.insertBefore(colle, b);
      colle.append(b);
    }
  }
  new MutationObserver(recs => {
    for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1 && n.isConnected) collerBulles(n);
  }).observe(document.body, { childList: true, subtree: true });

  function closeInfoPop() { const p = $('#info-pop'); if (p) p.remove(); }
  function openInfoPop(btn) {
    const x = G.INFO[btn.dataset.info]; if (!x) return;
    closeInfoPop();
    const pop = document.createElement('div');
    pop.id = 'info-pop';
    // 10.12.0 (U-08) — une bulle qui explique bien, et s'arrête là, est un cul-de-sac : `a` désigne
    // l'article qui développe. Le mécanisme existe dans l'app entreprise depuis la 7.0.0 ; la bulle
    // du titre de chaque écran de comptabilité y mène désormais aussi.
    // 10.13.0 — chaque bulle a son article : le sien (`a`), sinon celui de sa famille de clés.
    const idArt = G.articleDe ? G.articleDe(btn.dataset.info) : x.a;
    const art = idArt ? (G.ARTICLES.find(y => y.id === idArt) || null) : null;
    pop.innerHTML = `<div class="ip-head">${esc(x.t)}<button type="button" class="ip-close" aria-label="Fermer">✕</button></div>`
      + `<div class="ip-body">${x.d}`
      + (art ? `<p class="ip-more"><a href="#/aide/${esc(art.id)}">Lire « ${esc(art.t)} » →</a></p>` : '')
      + '</div>';
    document.body.appendChild(pop);
    // Le lien ferme la bulle : sans ça, elle restait ouverte par-dessus l'article qu'elle vient d'ouvrir.
    const lien = $('.ip-more a', pop);
    if (lien) lien.onclick = () => closeInfoPop();
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
    // 10.12.0 (H-8, vu au test humain) — le curseur REVIENT d'où il venait quand la fenêtre se
    // ferme. Un refus amène le curseur dans la case fautive (7.0.0), puis la fenêtre qui l'explique
    // le prenait et ne le rendait jamais : on fermait « Fermer », et il fallait recliquer dans la
    // case qu'on venait de nous montrer. Seulement si le curseur était DANS la fenêtre : un appelant
    // qui l'a déjà posé ailleurs garde sa décision.
    const avant = document.activeElement;
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
      const curseurDedans = layer.contains(document.activeElement);
      layer.remove();
      document.removeEventListener('keydown', onKey);
      if (curseurDedans && avant && avant !== document.body && avant.isConnected && !avant.disabled) {
        try { avant.focus(); } catch (_) { /* un élément qui ne prend pas le curseur : on n'insiste pas */ }
      }
    };
    let question = false;   // une seule question à la fois, sinon Échap répété les empile
    let gardeAuto = null;   // posé après le montage, voir plus bas
    const dismiss = async () => {
      if (done || question) return;
      const garde = (opts && opts.garde) || gardeAuto;
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
    // 10.14.1 — les montants préremplis s'écrivent comme l'écran AVANT l'instantané de la saisie :
    // complétés plus tard, au premier passage du curseur, « 1250.5 » devenu « 1 250,500 » passerait
    // pour une frappe, et fermer une fenêtre intacte demanderait « Abandonner cette saisie ? ».
    $$(SEL_MONTANT, layer).forEach(completerMontant);
    // Et une case de montant qu'on ne sait pas lire se REFUSE avant le geste, en la montrant. Hors de
    // la grille, « 150 DT » ou « 12a » valaient ZÉRO sans un mot : une prime perdue sur un bulletin,
    // une cession rangée en mise au rebut. UNE porte pour toutes les fenêtres : posée fenêtre par
    // fenêtre, elle manquerait la suivante (7.20.0). Elle passe AVANT le gestionnaire du bouton
    // (capture), et Entrée, qui clique ce même bouton, la traverse aussi.
    layer.addEventListener('click', e => {
      const b = e.target && e.target.closest ? e.target.closest('.modal-actions .btn-primary') : null;
      if (!b || !layer.contains(b)) return;
      const ko = montantIllisibleDans(layer);
      if (!ko) return;
      e.preventDefault(); e.stopImmediatePropagation();
      refus(ko, motifIllisible(ko.value));
    }, true);
    // 10.12.0 (vu au test humain) — une fenêtre qui porte un FORMULAIRE garde sa saisie d'office.
    // Cinq fenêtres posaient leur garde-fou à la main ; sept formulaires du livre — la fiche d'un
    // salarié, un bulletin, un bien, un inventaire, un relevé, la reprise d'ouverture, l'écriture
    // écrite depuis la banque — n'en avaient aucun : Échap, ou un clic à côté de la fenêtre, jetait
    // dix champs sans un mot. C'est le défaut de la 6.8.1, sept fenêtres plus loin, et une règle
    // posée fenêtre par fenêtre manquera toujours la suivante. L'instantané se prend APRÈS le
    // montage : ce que la fenêtre préremplit n'est pas une saisie. Une fenêtre qui pose son propre
    // garde-fou garde le sien ; `garde: false` dit, en le nommant, qu'on n'en veut pas.
    if (!(opts && 'garde' in opts) && layer.querySelector('form')) gardeAuto = suivreSaisie(layer);
    // Le focus va au premier champ de SAISIE. Il allait au premier `input, select, textarea,
    // button` : dans une confirmation, qui n'a pas de champ, c'était le bouton « Annuler ».
    const saisie = layer.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
    const principal = $('.modal-actions .btn-primary, .modal-actions .btn-danger', layer);
    const cible = saisie || (principal && !principal.disabled ? principal : null);
    // Un appelant qui a déjà posé le curseur DANS la fenêtre garde sa décision (10.12.0) :
    // « Renseigner le n° de Yassine Gharbi… » ouvrait sa fiche avec le curseur dans le NOM — le
    // champ qu'on vient de nommer était le seul qu'il fallait aller chercher.
    if (cible && !layer.contains(document.activeElement)) cible.focus();
    return close;
  }

  // Un instantané des champs au moment où la fenêtre s'ouvre. Il sert à répondre à une seule
  // question : « est-ce qu'il a tapé quelque chose ? ». Sans lui, Échap jetait huit champs sans un
  // mot — et un comptable qui perd une saisie deux fois n'ouvre plus jamais ce formulaire sereinement.
  function suivreSaisie(layer) {
    // Choisir n'est pas taper (10.14.0) : une fenêtre dont les seuls champs sont des listes et des
    // cases (« Clôturer jusqu'à… ») se referme sans demander — la question dirait « ce que tu viens de
    // taper » à quelqu'un qui n'a rien tapé, et se referait en un clic. La recherche d'une liste
    // (`.combo-q`) cherche, elle ne saisit rien (10.12.0) : elle ne compte pas non plus.
    if (!layer.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not(.combo-q), textarea')) return () => false;
    const lire = () => JSON.stringify([...layer.querySelectorAll('input:not([type=hidden]):not(.combo-q), textarea, select')]
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
    return fenetreInfo(title, `<div style="white-space:pre-wrap">${esc(body)}</div>`, okLabel);
  }

  // 10.10.0 (C-09) — la même fenêtre, pour un corps DÉJÀ écrit en HTML. `infoDialog` échappe son
  // texte, et c'est juste pour une phrase ; deux appelants lui passaient pourtant un tableau et une
  // liste, et le comptable lisait « <table class="list compact"> » à l'écran à la place des comptes
  // d'une rubrique de liasse. Deux portes, deux noms : l'appelant DIT ce qu'il donne, et le corps
  // se construit avec `esc()` sur chaque morceau venu des données.
  function infoHtml(title, html, okLabel) {
    return fenetreInfo(title, `<div>${html}</div>`, okLabel);
  }

  function fenetreInfo(title, corps, okLabel) {
    return new Promise(resolve => {
      modal(
        `<h2>${esc(title)}</h2>${corps}
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
         <label class="field mt"><span>Recopie <b>${esc(word)}</b> pour confirmer</span><input type="text" id="w" autocomplete="off" spellcheck="false"></label>
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
  // Le pluriel regarde la valeur absolue (10.12.0, jumeau de l'app entreprise : « −3 jour »).
  const pl = (n, un, plur) => `${Math.abs(n) >= 1000 ? Number(n).toLocaleString('fr-FR') : n} ${Math.abs(n) > 1 ? (plur || un + 's') : un}`;
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
  // Le nombre de dossiers du jeu d'exemple : ceux qui sont chargés, sinon ceux que `demoDossiers`
  // chargerait. Écrit à la main, il a menti dès que l'exemple a gagné un dossier (C-15).
  // (« Cinq dossiers » était écrit à la main avant que l'exemple gagne son client hors SkanFact en
  // 10.0.0 : deux écrans comptaient six, le troisième en annonçait cinq.)
  const nbExemple = () => (S && (S.dossiers || []).filter(d => d.demo).length)
    || K.demoDossiers(K.today()).length;

  // 10.12.0 — un montant ne se COUPE jamais en fin de ligne : l'espace des milliers est l'espace
  // insécable fine du moteur (`fmtMontant`, U+202F), et la devise tient au nombre par une insécable.
  // « coût employeur 1 500,225 DT » se lisait « …coût employeur 1 » / « 500,225 DT » dans l'aperçu
  // d'un bulletin : deux formateurs, deux espaces, et seul celui de l'écran se laissait couper.
  const money = (n, cur) => {
    if (n == null || n === '') return '—';
    const v = Number(n);
    if (!isFinite(v)) return '—';
    const dec = dinar(cur) ? 3 : 2;
    // Le demi-centime s'arrondit vers le haut (10.14.1), comme `money()` de l'app entreprise, et un
    // zéro n'a pas de signe : « −0,000 » se lit comme une dette de rien.
    const p = 10 ** dec, a = Math.round(Math.abs(v) * p * (1 + 4 * Number.EPSILON)) / p;
    const corps = a.toFixed(dec).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
    return (v < 0 && a ? '−' : '') + corps + '\u00a0' + (cur || 'DT');
  };
  // Un montant AFFICHÉ, sans sa devise : la grille de saisie, le brouillard, les abonnements et
  // la recherche écrivaient « 4.500 » à côté d'un total à « 0,000 » (T-28). En français, le point
  // décimal fait lire quatre mille cinq cents — sur l'écran dont le métier est de contrôler des
  // montants.
  const montant = n => money(n).replace(/\s(DT|[A-Z]{3})$/, '');
  // Un taux s'écrit comme un montant (10.12.0) : « 56,33 % » à côté de « -3,998 % », deux précisions
  // et deux signes moins dans le même tableau des ratios. Deux décimales, le vrai signe moins.
  const pourcent = v => { const n = Number(v); return v == null || !isFinite(n) ? '—' : (n < 0 ? '−' : '') + Math.abs(n).toFixed(2).replace('.', ',') + '\u00a0%'; };
  // 10.14.1 — un TAUX tel qu'il a été réglé (« 9,18 », « 0,4 », « 22,5 »), sans zéros ajoutés :
  // « 9.18 % de 1 500,000 DT » mettait un point décimal à côté d'une virgule, sur la même ligne.
  const taux = v => { const n = Number(v); return v == null || v === '' || !isFinite(n) ? '' : String(n).replace('.', ','); };
  // Un montant DANS UN CHAMP (10.12.0, H-3 — trouvé en testant comme un humain). La 9.8.8 gardait
  // `toFixed(3)` pour « remplir un champ, qui se relit en interne » : mais un champ, c'est le
  // COMPTABLE qui le relit. Tab soldait une pièce en écrivant « 250.000 » sous un total à
  // « 250,000 » — en français, deux cent cinquante mille. Un champ s'écrit donc comme l'écran
  // (virgule, espaces de milliers), avec un moins ASCII pour qu'il se relise tel quel.
  const montantChamp = n => { const v = Number(n); return v ? (v < 0 ? '-' : '') + montant(Math.abs(v)) : ''; };
  // Et il se LIT par une seule porte, qui comprend ce qu'un comptable tape : « 1 250,500 »,
  // « 1.250,500 », « 1250.5 ». La lecture d'avant — `Number(x.replace(',', '.'))` — rendait ZÉRO
  // pour l'espace des milliers, sans un mot : un prix de cession « 1 500,000 » devenait une mise au
  // rebut. Ce qui ne se lit pas du tout vaut 0 ici ; la grille de saisie, elle, le NOMME.
  const lireMontant = v => { const n = KC.nombreStrict(v); return Number.isFinite(n) ? n : 0; };
  // 10.14.1 — Un montant TAPÉ se relit comme il s'imprime, dès qu'on quitte la case : « 250 » devient
  // « 250,000 », comme le total juste en dessous (Skander : « des champs où le montant s'écrivait
  // "250" au lieu de la vraie écriture en dinar »). Une case illisible garde sa frappe et son rouge
  // (H-3). Le nombre ne change pas ; l'événement qui part met la donnée de la case à jour
  // (la grille la garde en texte). UNE écoute pour toutes les cases de montant du Cabinet.
  const montantSaisi = n => (n < 0 ? '-' : '') + montant(Math.abs(n));
  const SEL_MONTANT = 'input.sa-montant, input.montant';
  function completerMontant(el) {
    const brut = String(el.value || '').trim();
    if (!brut) return;
    if (montantIllisible(brut)) return;
    const n = lireMontant(brut);
    // Le livre du cabinet compte au millime (`round3` à l'écriture) : « 12,3456 » s'écrirait 12,346.
    // La case montre donc ce que la pièce portera, pas une décimale qui disparaîtra à l'enregistrement
    // pendant que le total, juste en dessous, dit déjà 12,346.
    const txt = montantSaisi(Math.round(n * 1000) / 1000);
    if (txt !== el.value) { el.value = txt; el.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  document.addEventListener('focusout', e => { const el = e.target; if (el && el.matches && el.matches(SEL_MONTANT)) completerMontant(el); }, true);
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
    // 10.14.0 (vu à la souris) — Entrée descend vers la confirmation, et la ligne qui juge le mot de
    // passe garde sa place avant d'avoir quelque chose à dire : née pendant la frappe, elle poussait
    // la confirmation de seize pixels sous le curseur (règle 10.12.0).
    if (!st.exists) { enchainerConfirmation(pw, pw2); $('#lock-strength').classList.add('ligne-reservee'); }
    // 10.14.0 — le curseur est dans le champ : on arrive ici pour taper un mot de passe, et rien
    // d'autre. Sans lui, la frappe partait dans le vide (vu à la souris) ; l'app entreprise le
    // posait depuis toujours — le jumeau manquant (7.3.0).
    pw.focus();
    // Le seul chemin de sortie pour qui change d'ordinateur. Proposé dans les DEUX cas : on y arrive
    // aussi après avoir créé un cabinet neuf par erreur, et c'est même le cas le plus fréquent.
    $('#lock-move').onclick = repriseDialog;

    $('#lock-form').onsubmit = async e => {
      e.preventDefault();
      const err = $('#lock-err');
      err.hidden = true;
      const v = pw.value;
      // Le refus MONTRE la case (règle 7.20.0) : le curseur y va, elle se marque. Et quand la
      // confirmation manque ou ne correspond pas, c'est ELLE qu'on refait — jamais le mot de passe
      // qu'on vient de choisir. « Les deux mots de passe ne sont pas les mêmes » sur une
      // confirmation vide disait faux : elle avait été tapée sur « Afficher » (10.14.0).
      const refuse = (champ, message) => {
        err.textContent = message; err.hidden = false;
        const marque = champ.closest('.field') || champ;
        marque.classList.add('champ-faute'); champ.setAttribute('aria-invalid', 'true');
        // 10.14.1 — et le reproche part avec la faute : « Entre ton mot de passe. » restait écrit
        // sous un mot de passe qu'on était en train de taper.
        champ.addEventListener('input', () => { marque.classList.remove('champ-faute'); champ.removeAttribute('aria-invalid'); err.hidden = true; }, { once: true });
        champ.focus();
        if (champ.value) champ.select();
      };
      if (st.exists && v.length < 1) return refuse(pw, 'Entre ton mot de passe.');
      if (!st.exists) {
        const vm = K.verdictMotDePasse(v, pw2.value, 8);
        if (!vm.ok) {
          return refuse(vm.champ === 'confirmation' ? pw2 : pw, vm.champ === 'motDePasse'
            ? 'Huit caractères au minimum : ce mot de passe protège les comptes de tous tes clients.' : vm.message);
        }
      }
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
        // Les nouveautés de la version, au premier lancement (10.14.1, S-06) — le jumeau de l'app
        // entreprise, même module : jamais à un cabinet qu'on vient de créer, jamais par-dessus une
        // fenêtre, l'assistant ou une visite.
        if (typeof Nouveautes !== 'undefined') Nouveautes.presenter({
          app: 'cabinet', nomApp: 'SkanFact Cabinet', version: st.version,
          installationNeuve: !!r.created || (!S.cabinet.name && !(S.dossiers || []).length),
          peutMontrer: () => !$('#modal-root').children.length && !$('#setup') && !(typeof Visite !== 'undefined' && Visite.enCours())
        });
      } catch (ex) {
        // L'écran de verrouillage a la place d'un code, et c'est le seul refus qu'on ne peut pas
        // dépanner en regardant l'application : elle n'est pas encore ouverte.
        const code = codeErreur(ex);
        err.innerHTML = esc(plainError(ex)) + (code ? ' <span class="muted small">' + esc(code) + '</span>' : '');
        err.hidden = false;
        go.disabled = false;
        go.textContent = st.exists ? 'Ouvrir' : 'Créer mon cabinet';
        pw.select();
        pw.addEventListener('input', () => { err.hidden = true; }, { once: true });
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
           <div class="muted small">La clé USB, le disque externe ou le dossier synchronisé (iCloud Drive, OneDrive) choisi dans Réglages. Il s'appelle
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
          // Une EXPLICATION, pas une question : « Annuler » à côté de « J'ai compris » faisait la même
          // chose et laissait croire qu'on pouvait renoncer à ce qu'on vient de choisir (10.13.0).
          infoHtml('Avec la clé de secours',
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
            'Choisir un dossier de copie…', false, 'Plus tard');
          if (ok) {
            try { await api.pickExternal(); refreshBackupInfo(); }
            catch (e) { toast(plainError(e), 'error'); }
          }
        };
      }
    );
  }

  // « Précédent » et « Suivant » (10.12.0, U-06) : l'historique du navigateur, puisque chaque écran a
  // son adresse. Jamais sous une fenêtre ouverte — on changerait l'écran du dessous pendant qu'une
  // question attend sa réponse par-dessus.
  function naviguerHistorique(sens) {
    if ($('#modal-root') && $('#modal-root').children.length) return;
    if (sens === 'back') history.back(); else history.forward();
  }

  function start(created, reorganized, aRecuperer, exemple) {
    // L'exemple a pu être refait pendant l'ouverture (9.4.2). Le bandeau des dossiers fictifs le
    // dit — un toast de trois secondes sur un jeu de données qui a changé n'informe personne.
    exempleRefait = exemple || null;
    // Un AUTRE écran commence en haut (10.12.0, vu au test humain) : la position de défilement de
    // l'écran quitté ne dit rien du suivant, et la Paie ouverte depuis une Saisie défilée arrivait à
    // mi-page, sous les bulletins qu'on venait chercher. Seul un vrai changement d'adresse remet en
    // haut : un redessin sur place (enregistrer, filtrer) garde sa position, et les sous-onglets de
    // la comptabilité passent par `pushState` avec leur propre règle (`allerSousOnglet`).
    window.addEventListener('hashchange', () => {
      const vue = $('#view');
      if (vue) vue.scrollTop = 0;
      renderAvecChargement();
    });
    api.onUpdateEvent(ev => {
      upd.state = ev.state;
      if (ev.version) upd.version = ev.version;
      if (ev.percent != null) upd.percent = ev.percent;
      upd.transferred = ev.transferred; upd.total = ev.total;
      if (ev.message) upd.message = ev.message;
      if (ev.detail != null) upd.detail = ev.detail;
      if (ev.soft != null) upd.soft = !!ev.soft;
      if (ev.notes != null) upd.notes = ev.notes;
      drawUpdatePanel();
      updateBanner();
      if (ev.state === 'downloaded') proposerInstallation(ev);
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
      else if (name === 'back' || name === 'forward') naviguerHistorique(name);
      else if (name.startsWith('go:')) location.hash = '#/' + name.slice(3);
    });
    // Les boutons latéraux de la souris font ce qu'ils font partout ailleurs.
    window.addEventListener('mouseup', e => {
      if (e.button === 3) { e.preventDefault(); naviguerHistorique('back'); }
      else if (e.button === 4) { e.preventDefault(); naviguerHistorique('forward'); }
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
    // La visite guidée (10.14.0) : le moteur apprend à naviguer et à expliquer dans le Cabinet.
    installerVisites();
    if (!location.hash) location.hash = '#/dossiers';
    render();
    refreshBackupInfo();
    refreshInbox(true);
    // L'état de la clé de secours arrive par une promesse : sans ce redessin, le bandeau et la ligne
    // « À faire » n'apparaîtraient qu'au prochain changement de page.
    chargerRecovery(true);
    chargerQuestionsAttente(true);
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
      importRecovery().then(() => { if (!(S.cabinet.name || '').trim()) runSetup({ sansPorte: true }); });
      return;
    }
    // Premier lancement : la porte, puis l'assistant — pas un formulaire de réglages et un message
    // passager. Pendant qu'on explore l'exemple sans avoir nommé son cabinet, l'assistant attend : il
    // reprend à la sortie de l'exemple (10.14.0).
    const sansNom = !(S.cabinet.name || '').trim();
    const dansLExemple = (S.dossiers || []).some(d => d.demo);
    if (created || (sansNom && !dansLExemple)) {
      runSetup().then(r => { if (r === 'decouvrir') lancerVisite(visiteParId('decouvrir')); });
    }
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
    // 10.13.0 — un paquet peut ÉCRIRE dans le livre de son dossier (les réponses du client) : le
    // livre gardé en mémoire est alors périmé, et la Révision annonçait « 1 question attend sa
    // réponse » sur une question répondue. On oublie ce qu'on avait lu du dossier ouvert.
    if (r.results.some(x => !x.error && x.dossier && x.dossier.id === livresState.dossierId)) {
      livresState.livreCle = ''; livresState.revision = null;
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
      // 10.13.0 — « ton premier paquet » se disait à chaque première importation de la SESSION : au
      // second paquet d'un mois déjà reçu, la phrase était fausse. Le premier se reconnaît à ce que le
      // portefeuille ne portait rien avant cet import.
      const rangesAvant = (S.dossiers || []).filter(d => !d.demo).reduce((n, d) => n + (d.packs || []).length, 0)
        - r.results.filter(x => !x.error && !x.replaced).length;
      const premier = rangesAvant <= 0 && !r.results.some(x => x.replaced);
      const ok = await confirmDialog('Mets ta clé de secours à l\'abri',
        (premier
          ? '<p>Tu viens de ranger ton premier paquet. À partir de maintenant, <strong>tu as quelque chose à perdre</strong>.</p>'
          : '<p>Les paquets de tes clients sont rangés sur ce poste : <strong>tu as quelque chose à perdre</strong>, et ta clé n\'est encore nulle part ailleurs.</p>') +
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
    // 10.14.1 — un mois reçu deux fois DIT de combien ses chiffres ont bougé : le moteur le calcule
    // (`filePack` → `ecart`) depuis la 9.x, et le rapport se contentait de « les chiffres ont pu
    // changer ». Une rectificative se lit en montant, sinon on ouvre les deux paquets pour comparer.
    if (x.replaced) {
      const e = x.ecart;
      const signe = n => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n), e.devise);
      const chiffres = !e ? (x.wasDefinitive && !x.nowDefinitive ? ' — les chiffres ont pu changer' : '')
        : (e.ca === 0 && e.tvaADecaisser === 0) ? ' — chiffres inchangés'
        : ` — chiffre d'affaires ${signe(e.ca)}, TVA à décaisser ${signe(e.tvaADecaisser)}`;
      bits.push((x.wasDefinitive && !x.nowDefinitive ? '⚠ remplace un mois qui était définitif' : 'remplace le mois déjà reçu') + chiffres);
    }
    bits.push(x.nowDefinitive ? 'mois clôturé (définitif)' : 'mois non clôturé (provisoire)');
    const integ = x.integrity || {};
    const bad = (integ.bad || []).length;
    bits.push(bad
      ? `⚠ ${pl(bad, 'fichier')} ne ${bad > 1 ? 'correspondent' : 'correspond'} pas à l'empreinte annoncée`
      : `${pl(integ.checked || 0, 'pièce')} ${(integ.checked || 0) > 1 ? 'vérifiées, intactes' : 'vérifiée, intacte'}`);
    // Un fichier que le manifeste n'annonce pas n'a été comparé à rien : il ne compte pas parmi les
    // pièces vérifiées, et il se dit à part — sinon le paquet aurait l'air entièrement contrôlé.
    // La même alerte était dite deux fois, sous deux tournures (10.13.0) : deux phrases font croire
    // à deux problèmes.
    const trop = (integ.intrus || []).length;
    if (trop) bits.push(`⚠ ${pl(trop, 'fichier')} ${trop > 1 ? 'présents' : 'présent'} mais non ${trop > 1 ? 'annoncés' : 'annoncé'} par ton client`);
    const miss = (x.summary && x.summary.missing || []).reduce((s, m) => s + (m.count || 0), 0);
    if (miss) bits.push(`${pl(miss, 'point signalé', 'points signalés')} par le client`);
    // 10.13.0 (test humain du pont) — les RÉPONSES du client étaient rangées sur leurs questions
    // (`posterReponses`) et le rapport n'en disait rien : c'est pourtant ce que le comptable qui a
    // posé une question cherche en ouvrant le paquet. Elles se disent, et mènent à la Révision.
    const rep = x.reponses || {};
    if (rep.posees) bits.push(`${pl(rep.posees, 'réponse', 'réponses')} du client à tes questions`);
    if (rep.inconnues) bits.push(`${pl(rep.inconnues, 'réponse', 'réponses')} à une question que ce dossier ne porte plus`);
    return `<li><strong>✓ ${esc(d.name || '')}</strong> — ${esc((x.summary && x.summary.label) || x.month || '')}
            <div class="imp-sub">${bits.map(esc).join(' · ')}</div>
            ${rep.posees && d.id ? `<div class="imp-sub mt-s"><button class="btn btn-sm" data-imp-rev="${esc(d.id)}">${rep.posees > 1 ? 'Lire les réponses' : 'Lire la réponse'}</button></div>` : ''}</li>`;
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
        $$('[data-imp-rev]', layer).forEach(b => b.onclick = () => {
          close(); fini();
          livresState.revViser = 'rv-questions';
          vers('#/dossier/' + encodeURIComponent(b.dataset.impRev) + '/comptabilite/revision');
        });
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

  let routeLue = '';
  // Un chargement VISIBLE et une page qui se voit changer (10.14.1, S-06) — les jumeaux de l'app
  // entreprise (son `renderAvecChargement` et son `marquerEntree`), même feuille partagée. Sur un
  // portefeuille de trois cents dossiers, compter les relances et dessiner la liste occupe le fil
  // principal : on pose « Chargement… », on laisse une image se peindre, puis on dessine.
  let chargementPose = null, dessinPrevu = false, entreeFin = 0, dernierEcran = '';
  function annoncerChargement() {
    const view = $('#view');
    if (chargementPose || !view) return;
    const r = view.getBoundingClientRect();
    const el = document.createElement('div');
    el.id = 'chargement-page';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="cp-roue" aria-hidden="true"></span><span>Chargement…</span>';
    Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(el);
    chargementPose = el;
  }
  function retirerChargement() { if (chargementPose) { chargementPose.remove(); chargementPose = null; } }
  function renderAvecChargement() {
    if (document.hidden) { render(); return; }
    if (dessinPrevu) return;
    dessinPrevu = true;
    annoncerChargement();
    let fait = false;
    const dessiner = () => {
      if (fait) return;
      fait = true; dessinPrevu = false;
      try { render(); } finally { retirerChargement(); }
    };
    requestAnimationFrame(() => setTimeout(dessiner, 0));
    setTimeout(dessiner, 80);
  }
  function marquerEntree(view) {
    view.classList.remove('entree');
    void view.offsetWidth;
    view.classList.add('entree');
    clearTimeout(entreeFin);
    entreeFin = setTimeout(() => view.classList.remove('entree'), 320);
  }

  function render() {
    const hash = location.hash.replace(/^#\//, '') || 'dossiers';
    const [route, arg] = hash.split('/');
    // Seul un changement d'ÉCRAN s'anime (la page, ou le dossier ouvert) : un redessin sur place ne bouge pas.
    const ecran = route + '/' + (arg || '');
    const ecranChange = ecran !== dernierEcran;
    dernierEcran = ecran;
    appliquerTheme();
    // L'invitation « Première fois sur cet écran ? » appartient à l'écran qu'on quitte ; l'observateur
    // qui repose « Guide-moi » se branche une fois, au premier dessin (10.14.1, S-03).
    fermerAppelGuide();
    appelEnAttente = '';
    surveillerGuideMoi();
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
    // Le résumé des index (questions, employeurs, dossiers tenus au cabinet) se relit quand on ENTRE
    // sur une page qui le lit (10.12.0) : lu une fois au démarrage, il se périmait (7.1.x) — un mois
    // saisi dans la journée restait « à saisir » au calendrier jusqu'au lendemain. On ne redessine
    // que s'il a changé : la page ne clignote pas, et rien ne boucle.
    if (route !== routeLue && (route === 'echeances' || route === 'dossiers')) chargerQuestionsAttente(true);
    routeLue = route;
    const view = $('#view');
    if (route === 'dossier') drawDossier(view, arg, hash.split('/')[2], hash.split('/')[3], hash.split('/')[4]);
    else if (route === 'production') drawProduction(view);
    else if (route === 'ecritures') drawEcritures(view);
    else if (route === 'echeances') drawEcheances(view);
    else if (route === 'relances') drawRelances(view);
    else if (route === 'reglages') drawReglages(view);
    else if (route === 'aide') drawAide(view, arg);
    else if (route === 'guide') drawGuide(view);
    else drawDossiers(view);
    if (ecranChange) marquerEntree(view);
    typographie(view);
    surveillerBandeauDemo();
    // « Ce ne sont pas tes dossiers » — sur CHAQUE page, en permanence, comme l'app entreprise (10.14.0).
    bandeauDemo();
    // « Guide-moi » dans l'en-tête de chaque écran (10.14.1, S-03) ; une page asynchrone le reçoit par
    // l'observateur, quand elle pose son en-tête.
    poserGuideMoi();
    // La première fois sur un écran, sa visite se propose — accrochée à « Guide-moi » (10.14.1).
    appelGuide();
  }

  // ---------- le bandeau de l'exemple ----------
  //
  // 10.14.0 — le MÊME bandeau que l'app entreprise (classes `.demo-banner` de la feuille partagée) : un
  // BAC À SABLE, pas une alerte. Il ne vivait que sur la page Dossiers, en orange, au milieu du
  // portefeuille : sur une fiche, un livre ou une déclaration, rien ne rappelait que les chiffres
  // étaient inventés (demandé par Skander : « l'alerte du jeu d'exemple doit devenir comme celle de
  // l'app entreprise »). Il dit ce qu'on PEUT faire (tout), ce qui est à l'abri (tes vrais dossiers),
  // et les deux portes : se faire guider, et quitter l'exemple. Une page dessinée plus tard (une
  // fiche lit son livre) réécrit `#view` : un observateur le repose, une fois, en tête.
  function htmlBandeauDemo() {
    const demoCount = (S.dossiers || []).filter(d => d.demo).length;
    if (!demoCount) return '';
    const refait = exempleRefait ? ` <b>${demoCount > 1 ? 'Ils viennent' : 'Il vient'} d'être refait${demoCount > 1 ? 's' : ''}</b>
      ${exempleRefait.raison === 'version' ? `pour la version ${esc(exempleRefait.version)}` : 'sur le mois en cours'} : un exemple qui date
      montre des retards qui n'existent pas.${exempleRefait.livres
        ? ` ${pl(exempleRefait.livres, 'livre de démonstration est parti', 'livres de démonstration sont partis')} avec l'ancien exemple.` : ''}` : '';
    const enVisite = typeof Visite !== 'undefined' && Visite.enCours();
    // 10.14.1 — sur la page Dossiers il s'EXPLIQUE ; ailleurs il se RAPPELLE, sur une ligne. Trois
    // lignes de la même phrase en tête de chaque écran poussaient la grille de saisie à 573 px sur un
    // portable (seuil 480, `e2e:cabinet-jour1`) : une explication se lit une fois, un rappel suffit
    // ensuite. Les deux portes restent, la phrase entière est au survol. Le MÊME choix que l'app
    // entreprise (son `htmlBandeauDemo`).
    const court = (location.hash.replace(/^#\/?/, '') || 'dossiers').split('/')[0] !== 'dossiers';
    const texte = court
      ? `<b>Cabinet d'exemple</b> : ici, rien ne compte — tes vrais dossiers sont à l'abri.`
      : `<b>Tu explores un cabinet d'exemple</b> — ${demoCount > 1 ? `${pl(demoCount, 'dossier')} inventés` : 'un dossier inventé'},
      du client en retard à celui dont tu tiens toute la comptabilité. Ouvre, saisis, déclare : rien de ce que tu fais ici ne compte, et
      tes vrais dossiers sont à l'abri. L'exemple s'efface tout seul au premier vrai paquet.${refait}`;
    return `<div class="banner demo-banner${court ? ' court' : ''}" id="demo-banner"><span class="db-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.5 15h9"/></svg></span>
      <span class="db-txt"${court ? ` title="Tu explores un cabinet d'exemple : des dossiers inventés, du client en retard à celui dont tu tiens toute la comptabilité. Rien de ce que tu fais ici ne compte, et l'exemple s'efface tout seul au premier vrai paquet."` : ''}>${texte}</span>
      <span class="db-actions">${enVisite ? '' : `<button class="btn btn-sm" id="demo-visite">${decouverteEnPause() ? 'Reprendre la visite' : 'Visite guidée'}</button>`}
      <button class="btn btn-sm" id="demo-off" title="Les dossiers de l'exemple partent ; tes vrais dossiers ne bougent pas">Quitter l'exemple</button></span></div>`;
  }
  function bandeauDemo() {
    const view = $('#view');
    if (!view || view.querySelector(':scope > #demo-banner')) return;
    const html = htmlBandeauDemo();
    if (!html) return;
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const el = tmp.firstElementChild;
    view.insertBefore(el, view.firstChild);
    const off = $('#demo-off', el);
    off.onclick = async () => {
      S = await chargerOuRetirerExemple(false); VISITES = null;
      // Quitté depuis la fiche d'un dossier FICTIF, on revient au portefeuille : l'écran restait sur
      // un dossier qui venait de partir (vu à la souris). Sur la fiche d'un vrai dossier, on reste.
      const ici = /^#\/dossier\/([^/]+)/.exec(location.hash);
      if (ici && !(S.dossiers || []).some(d => d.id === decodeURIComponent(ici[1]))) location.hash = '#/dossiers';
      else render();
      toast('Exemple effacé.');
      // Après la découverte, l'assistant reprend là où la porte l'a laissé : posé à quelqu'un qui sait
      // maintenant à quoi servent les questions (10.14.0).
      if (!String((S.cabinet || {}).name || '').trim()) { await runSetup({ sansPorte: true }); render(); }
    };
    const vis = $('#demo-visite', el);
    if (vis) vis.onclick = () => { const r = decouverteEnPause(); lancerVisite(visiteParId('decouvrir'), r ? r.i : 0); };
  }
  // Une page asynchrone réécrit `#view` après `render()` : le bandeau revient tout seul.
  let observeDemo = null;
  function surveillerBandeauDemo() {
    const view = $('#view');
    if (observeDemo || !view || !window.MutationObserver) return;
    observeDemo = new MutationObserver(() => { if (!view.querySelector(':scope > #demo-banner')) bandeauDemo(); });
    observeDemo.observe(view, { childList: true });
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
  // La même règle sur un TEXTE (10.14.0) : ce qui se pose par `textContent` pendant la frappe — la
  // phrase de la grille de saisie — ne passe par aucune prose déjà posée, et son « « » finissait une
  // ligne pendant que le nom du compte commençait la suivante. Une règle, deux entrées ; jamais deux
  // copies d'expressions régulières qui divergent.
  const typoTexte = t => String(t).replace(/ ([?!;:»])/g, '\u202f$1').replace(/« /g, '«\u202f');
  function typographie(racine) {
    (racine || document).querySelectorAll(PROSE).forEach(bloc => {
      const it = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = it.nextNode())) {
        const t = n.nodeValue;
        if (!/[ ][?!;:»]|«[ ]/.test(t)) continue;
        n.nodeValue = typoTexte(t);
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
    'pieces': { texte: 'Voir les dossiers', run: () => { location.hash = '#/dossiers'; } },
    // Les questions restées sans réponse (9.10.0). On emmène sur le portefeuille : la ligne nomme
    // les clients, et c'est de là qu'on ouvre le dossier de révision de chacun.
    'questions': { texte: 'Voir les clients qui n\'ont pas répondu', run: () => { location.hash = '#/dossiers'; } },
    // Tes premiers pas (10.14.0) : l'étape suivante, guidée clic par clic.
    'premiers-pas': { texte: 'Me guider pas à pas', run: () => lancerPasSuivant() }
  };
  // Ouvrir les Réglages SUR un panneau : on pose l'onglet et la cible avant de naviguer, et on
  // redessine quand on y est déjà (sinon aucun `hashchange` n'a lieu et le clic paraît inerte —
  // piège 7.15.0).
  // `refusDe` ({ sel, message }) : un refus qui mène aux Réglages MONTRE son champ une fois le panneau
  // chargé (règle 7.0.0) — le curseur dedans, marqué. Sans lui, « Nomme d'abord ton cabinet »
  // remontait au panneau et laissait le curseur nulle part, le champ blanc parmi cinq autres.
  function versReglages(panneau, refusDe) {
    const p = REG_PANNEAUX[panneau];
    if (p) { reglagesTab = p.onglet; reglagesFocus = panneau; }
    reglagesRefus = refusDe || null;
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
  // 10.12.0 — et « Tout afficher » se DÉFAIT : mémorisé, il n'avait aucun retour, et les colonnes
  // vides restaient pour toujours — un réglage qui accepte un clic et se retire la possibilité de
  // revenir en arrière (7.12.0). Le nombre de colonnes vides AFFICHÉES est gardé pour le dire.
  function colonnesUtiles(rows) {
    const c = {
      provisoires: rows.some(r => r.provisionalCount > 0),
      signale: rows.some(r => r.issues > 0),
      relance: rows.some(r => r.lastRelanceAt),
      honoraires: rows.some(r => r.fees > 0)
    };
    const vides = ['provisoires', 'signale', 'relance', 'honoraires'].filter(k => !c[k]).length;
    if (prefs.get('colTout', false) === true) {
      return { provisoires: true, signale: true, relance: true, honoraires: true, masquees: 0, videsAffichees: vides };
    }
    c.masquees = vides;
    c.videsAffichees = 0;
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
    // 10.12.0 (U-25) — les QUATRE chiffres ouvrent quelque chose : deux cartes sur quatre portaient
    // un chevron, et les deux autres ressemblaient aux premières sans rien faire. Une carte qui a
    // l'air d'un bouton et n'en est pas un fait douter de celles qui le sont (7.15.0).
    const item = (cle, lbl, val, sub, ton, titre) => `<button type="button" class="stat ouvre" data-pf="${cle}" title="${esc(titre)}">
      <span class="pf-l"><b class="val${ton ? ' ' + ton : ''}">${val}</b> <span class="lbl">${lbl}</span></span>
      <span class="sub">${sub}</span></button>`;
    // 10.12.0 (U-04) — un mois NOMMÉ, et le nombre de clients qu'il couvre (`caDuPortefeuille`).
    const ca = p.ca || {};
    const caVal = !ca.mois ? '—' : ca.montant == null ? esc(pl(ca.devises, 'devise')) : esc(money(ca.montant, ca.devise));
    // Le MOIS se lit sur la ligne du dessous, à côté du nombre de clients qu'il couvre : écrit dans
    // l'étiquette, il poussait le chevron hors de la carte. Les honoraires ne sont pas du chiffre
    // d'affaires : ils vivent dans la colonne « Honoraires » du tableau, avec leur total en pied.
    const caSub = !ca.mois ? 'aucun paquet ne porte de chiffres'
      : [esc(K.monthLabel(ca.mois)), ca.montant == null ? 'pas de total entre deux devises' : '',
        `${pl(ca.clients, 'client')} sur ${ca.sur}`].filter(Boolean).join(' · ');
    return `<div class="stats rangee">
      ${/* Le libellé s'accorde au chiffre qu'il suit : « 1 clients suivis » se lisait sur le tout
            premier écran d'un cabinet qui vient d'ajouter son premier client (10.14.0). */''}
      ${item('tous', p.total > 1 ? 'clients suivis' : 'client suivi', p.total,
    `${p.surSkanfact} sur SkanFact${p.horsSkanfact ? ` · ${p.horsSkanfact} hors SkanFact` : ''}`, '',
    'Voir tous tes clients, par ordre alphabétique')}
      ${/* « 2 / 5 » : le compte et son univers, dans le même chiffre. « 2 à jour sur 5 » à côté de
            « 6 clients suivis » se lisait comme une erreur — le 5, ce sont les clients sur
            SkanFact, les seuls à qui l'on réclame quelque chose. */''}
      ${item('ajour', 'à jour', `${p.aJour}<span class="val-sur"> / ${p.surSkanfact || 0}</span>`,
    `${p.enRetard ? `${p.enRetard} en retard` : 'aucun retard'}${p.provisoires ? ` · ${p.provisoires} en provisoire` : ''}`,
    p.enRetard ? '' : 'ok', 'Voir tes clients sur SkanFact, les plus urgents d\'abord')}
      ${item('manquants', p.moisManquants > 1 ? 'mois manquants' : 'mois manquant', p.moisManquants,
    p.paquets ? pl(p.paquets, 'paquet') + ' reçu' + (p.paquets > 1 ? 's' : '') : 'aucun paquet reçu',
    p.moisManquants ? 'due' : 'ok', 'Voir qui doit envoyer, et le relancer')}
      ${item('ca', 'de CA', caVal, caSub, '', 'Classer tes clients par chiffre d\'affaires')}
    </div>`;
  }
  // Chaque chiffre ouvre l'ensemble qu'il nomme. « À jour », « clients suivis » et le chiffre
  // d'affaires n'ont pas de page à eux : ils posent le filtre ou le tri qui les montre, sur la liste
  // qu'on a déjà sous les yeux. Une TABLE, comme `TODO_ACTIONS` : une carte ajoutée sans sa ligne
  // ici tombe au test de couverture au lieu de devenir un bouton qui avale le clic (7.0.0).
  const CARTES_PORTEFEUILLE = {
    tous: { onlySkanfact: false, sort: 'nom' },
    ajour: { onlySkanfact: true, sort: 'urgence' },
    ca: { onlySkanfact: true, sort: 'ca' }
  };
  function bindPortfolio(root) {
    $$('[data-pf]', root || document).forEach(b => {
      b.onclick = () => {
        const cle = b.dataset.pf;
        if (cle === 'manquants') { location.hash = '#/relances'; return; }
        const v = CARTES_PORTEFEUILLE[cle];
        if (!v) { toast('Ce chiffre n\'a pas encore d\'écran à ouvrir.', 'error'); return; }
        listState.q = ''; listState.withArchived = false; listState.page = 1;
        listState.onlySkanfact = v.onlySkanfact; listState.sort = v.sort; listState.desc = false;
        render();
      };
    });
  }

  // Le pied de la colonne « CA du dernier mois ». Il additionnait le dernier mois de CHAQUE client —
  // mars de l'un, août de l'autre — et le pied d'une colonne est lu comme sa somme (9.8.8) : il
  // porte donc le total d'UN mois nommé, le même que la carte du dessus (`caDuPortefeuille`, 6.8.1),
  // et dit combien de clients l'ont envoyé. Il rend du HTML : chaque morceau est échappé ici.
  function totalCA(rows) {
    const ids = new Set(rows.map(r => r.id));
    const ca = K.caDuPortefeuille((S.dossiers || []).filter(d => ids.has(d.id)));
    if (!ca.mois) return '—';
    const quand = `en ${esc(K.monthLabel(ca.mois))}${ca.clients < ca.sur ? ` · ${esc(`${ca.clients} sur ${ca.sur}`)}` : ''}`;
    if (ca.montant == null) return `<strong>${esc(pl(ca.devises, 'devise'))}</strong><div class="small muted nw">pas de total ${quand}</div>`;
    return `<strong>${esc(money(ca.montant, ca.devise))}</strong><div class="small muted nw">${quand}</div>`;
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
    { label: 'CA du dernier mois reçu', get: r => r.lastFigures ? K.csvMontant(r.lastFigures.ca) : '' },
    { label: 'Mois manquants', get: r => r.missingCount },
    { label: 'Provisoires', get: r => r.provisionalCount },
    { label: 'Points signalés', get: r => r.issues },
    { label: 'Dernière relance', get: r => r.lastRelanceAt ? fmtDay(r.lastRelanceAt) : '' },
    { label: 'Régime', get: r => r.regime },
    { label: 'TVA', get: r => r.tvaPeriod },
    { label: 'Honoraires', get: r => r.fees ? K.csvMontant(r.fees) : '' },
    { label: 'Archivé', get: r => r.archived ? 'oui' : '' }
  ];

  function drawDossiers(view) {
    const all = K.dossierList(S, null, { withArchived: true });
    const rows = K.dossierList(S, null, {
      q: listState.q, withArchived: listState.withArchived, onlySkanfact: listState.onlySkanfact,
      sort: listState.sort, desc: listState.desc
    });
    // `recoveryAt` vaut `undefined` tant que la réponse n'est pas revenue : on ne réclame que sur un
    // non franc. La date ne vit pas dans l'état chiffré, elle ne peut donc pas venir de `S`.
    // 10.14.0 — la ligne rouge ne se pose que le jour où un VRAI paquet est sur le disque (9.4.4) :
    // les paquets de l'exemple sont fictifs, les perdre ne coûte rien, et un rouge au premier écran de
    // la découverte apprend à ignorer le rouge. Avant, « Tes premiers pas » la propose calmement.
    const cleReclamee = recoveryAt === undefined ? null : recoveryAt !== null ? true : paquetsReelsRecus() ? false : null;
    const todo = K.cabinetTodo(S, null, { cleSecours: cleReclamee, licence: licCab, questions: questionsAttente, employeurs: employeursConnus(), tenus: tenusConnus() });
    // Tes premiers pas (10.14.0), quand le portefeuille a déjà des dossiers : UNE ligne de « À faire »,
    // juste après ce qui presse — jamais un panneau qui repousserait la liste des clients sous la ligne
    // de flottaison (9.4.4). La clé de secours déjà réclamée en rouge ne se réclame pas deux fois.
    const lignePas = lignePremiersPas();
    if (lignePas && !(lesPas().suivante.id === 'cle' && todo.some(t => t.id === 'cle-secours'))) {
      const apresUrgent = todo.filter(t => t.level === 'danger').length;
      todo.splice(apresUrgent, 0, lignePas);
    }
    const p = K.portfolio(S);

    // Écran d'ouverture d'un cabinet qui vient d'installer l'application : il n'a rien reçu, et il
    // n'a rien à chercher ni à filtrer. Trois propositions, trois VRAIS boutons — la première version
    // cachait l'exemple dans une phrase en gras au milieu d'un cadre, et personne ne le voyait.
    if (!all.length) {
      // 10.14.0 — « Tes premiers pas » : le corps de cet écran tant qu'il est vide. L'en-tête porte les
      // trois gestes de départ, et le vert est celui de l'étape suivante (U-11) : ajouter ses clients
      // tant qu'il n'y en a aucun.
      view.innerHTML = `
        <div class="page-head"><h1>Dossiers</h1>
          <div class="actions">
            <button class="btn" id="demo-on">Voir un exemple (${nbExemple()} clients fictifs)</button>
            <button class="btn" id="imp">Importer un paquet…</button>
            <button class="btn btn-primary" id="new-d">Ajouter mes clients…</button>
          </div></div>
        ${/* 10.14.0 — la ligne calme de la clé de secours doublait l'étape « Enregistrer ta clé de secours »
              de « Tes premiers pas », dix pixels plus bas, avec le même bouton. Sur cet écran, le panneau est le
              corps de la page : c'est lui qui la propose (7.18.0 — deux panneaux qui disent la même chose se
              lisent comme deux choses). Le rouge, lui, ne peut pas vivre ici : il suit un vrai paquet. */''}
        ${premiersPasPanel(true)}
        <div class="panel"><h2>Ce que tu verras ici</h2>
          <p>Tes clients, un par ligne, avec le dernier mois reçu et ce qui manque.</p>
          ${/* 10.12.0 — « les quatre situations » datait de l'exemple à quatre dossiers : il en a six, dont
                les deux qu'un cabinet tient de bout en bout (U-10). Un compte écrit à la main se périme au
                dossier suivant : la phrase énumère, elle ne compte pas. */''}
          <p class="small muted">L'exemple montre ce que tu rencontreras : un client à jour, un en retard, un qui n'a
          envoyé que du provisoire, un qui s'est endormi, un dont les pièces sont incomplètes et dont tu rapproches la
          banque — et un client hors SkanFact dont tu tiens toute la comptabilité, paie et biens compris. Il s'efface
          tout seul au premier vrai paquet, et tu peux l'effacer à la main quand tu veux.</p>
        </div>
        ${inboxBanner()}
        <div class="panel"><h2>Comment un paquet arrive jusqu'ici</h2>
          <ol class="small" style="line-height:1.9;margin:0;padding-inline-start:20px">
            <li>Tu remets à ton client le <strong>fichier d'appairage</strong> (Réglages → Mon cabinet → Le fichier à remettre à tes clients).</li>
            <li>Il l'importe une fois dans son SkanFact, puis t'envoie son <strong>.skanpack</strong> chaque mois.</li>
            <li>Tu le <strong>glisses sur cette fenêtre</strong>, ou tu le double-cliques dans ${EXPLORATEUR()}.</li>
          </ol>
        </div>`;
      $('#imp').onclick = () => doImport();
      $('#new-d').onclick = () => newDossierForm();
      $('#demo-on').onclick = async () => { S = await chargerOuRetirerExemple(true); VISITES = null; render(); toast(phraseExemple()); };
      bindInboxBanner(view);
      bindRecoveryBanner(view);
      bindPremiersPas(view);
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
      ${/* 10.12.0 (U-02) — le tableau TIENT dans sa page. À 1440 déjà, il faisait 160 px de trop :
            la colonne d'actions, collante, couvrait « Signalé ». Le nom du client se tronque (jamais
            son badge), « pas encore sur SkanFact » devient « hors SkanFact » — la légende dit le
            reste —, les en-têtes perdent le mot que la colonne voisine dit déjà, et la réception
            se lit au jour près (l'heure reste au survol). */''}
      ${rows.length ? `<div class="scroll-x"><table class="list sortable dl-table">
        <thead><tr>${sortHead('Client', 'nom')}${sortHead('Dernier mois', 'dernier')}
        ${sortHead('CA de ce mois', 'ca', null, true)}${col.honoraires ? '<th class="r nw">Honoraires</th>' : ''}${sortHead('Manquants', 'manquants', null, true)}
        ${col.provisoires ? '<th class="r nw">Provisoires</th>' : ''}${col.signale ? '<th class="r nw">Signalés</th>' : ''}
        ${col.relance ? sortHead('Relancé le', 'relance', 'r.history') : ''}${sortHead('Reçu le', 'recu')}<th></th></tr></thead>
        <tbody>${shown.map(r => `<tr class="clickable" data-id="${esc(r.id)}">
          <td class="dl-client"><div class="dl-cell"><span class="dot-lvl ${r.level === 'ok' ? '' : esc(r.level)}" title="${esc(NIVEAUX[r.level] || '')}"></span><span class="dl-nom" title="${esc(r.name)}">${esc(r.name)}</span>${r.archived ? ' <span class="badge">archivé</span>' : ''}</div></td>
          ${/* « hors SkanFact » vit dans « Dernier mois », pas à côté du nom (H-1, trouvé en testant
                comme un humain) : dans la cellule du nom, il le coupait — « Garage Ben… » — alors
                que la ligne avait de la place partout ailleurs. Ici, il remplace un tiret qui ne
                disait rien par la RAISON pour laquelle il n'y a pas de dernier mois. */''}
          <td class="dl-mois">${r.manual && !r.lastLabel ? '<span class="badge b-hors" title="Pas encore sur SkanFact : rien ne lui est réclamé">hors SkanFact</span>' : `<span class="nw">${esc(r.lastLabel || '—')}</span>`}${r.lastMonth && !r.lastDefinitive ? ' <span class="badge partielle">provisoire</span>' : ''}</td>
          <td class="r nw">${esc(r.lastFigures ? money(r.lastFigures.ca, r.lastFigures.devise) : '—')}</td>
          ${col.honoraires ? `<td class="r nw">${r.fees ? esc(money(r.fees)) : '—'}</td>` : ''}
          <td class="r">${r.missingCount || '—'}</td>
          ${col.provisoires ? `<td class="r">${r.provisionalCount || '—'}</td>` : ''}
          ${col.signale ? `<td class="r">${r.issues || '—'}</td>` : ''}
          ${col.relance ? `<td class="muted nw">${r.lastRelanceAt ? esc(fmtDay(r.lastRelanceAt)) + ` <span class="small">(${esc(ago(r.lastRelanceAt))})</span>` : '—'}</td>` : ''}
          <td class="muted nw" title="${esc(r.lastAt ? fmtWhen(r.lastAt) : '')}">${esc(r.lastAt ? fmtDay(r.lastAt) : '—')}</td>
          ${RowMenu.cellule('D:' + r.id, '')}</tr>`).join('')}</tbody>
        <tfoot><tr><td class="nw"><strong>${pl(rows.length, 'dossier')}</strong></td><td></td>
          <td class="r nw">${totalCA(rows)}</td>
          ${col.honoraires ? `<td class="r nw"><strong>${esc(money(rows.reduce((a, r) => a + (Number(r.fees) || 0), 0)))}</strong><div class="small muted nw">par mois</div></td>` : ''}
          <td class="r"><strong>${rows.reduce((s, r) => s + r.missingCount, 0) || '—'}</strong></td>
          ${col.provisoires ? `<td class="r"><strong>${rows.reduce((s, r) => s + r.provisionalCount, 0) || '—'}</strong></td>` : ''}
          ${col.signale ? `<td class="r"><strong>${rows.reduce((s, r) => s + r.issues, 0) || '—'}</strong></td>` : ''}
          ${col.relance ? '<td></td>' : ''}<td></td><td></td></tr></tfoot>
        </table></div>${pagerBar(rows.length)}
        <p class="legende">${legendeNiveaux()}</p>
        <div class="muted small ctrl-geste"><span>Les totaux et l'export portent sur la sélection entière, pas sur la page affichée.${
  col.masquees ? ` ${pl(col.masquees, 'colonne vide est masquée', 'colonnes vides sont masquées')}, pour laisser la place aux autres.</span>
          <button type="button" class="btn btn-ghost btn-sm" id="col-tout">Tout afficher</button>`
    : col.videsAffichees ? ` ${pl(col.videsAffichees, 'colonne vide est affichée', 'colonnes vides sont affichées')} : elles élargissent le tableau.</span>
          <button type="button" class="btn btn-ghost btn-sm" id="col-vides">Masquer les colonnes vides</button>` : '</span>'}</div>`
        : `<div class="empty">Aucun dossier ne correspond à cette recherche.</div>`}`;

    $('#imp').onclick = () => doImport();
    $('#new-d').onclick = () => newDossierForm();
    const q = $('#q');
    q.oninput = () => { listState.q = q.value; listState.page = 1; sansPerdreLaFrappe(q, render); };
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
    const cv = $('#col-vides');
    if (cv) cv.onclick = () => { prefs.set('colTout', false); render(); };
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

  // Les mois d'un dossier TENU AU CABINET (10.12.0, vu au test humain) : ceux de son LIVRE, lus
  // dans l'index sans déchiffrer le livre (mesure de la 9.1.0), avec la MÊME fonction que le tableau
  // de production — deux écrans qui disent l'état d'un mois ne peuvent pas se contredire (6.8.1).
  // Chaque mois porte son geste : saisir celui qui n'a rien, ouvrir la déclaration des autres.
  const MOT_TENU = { saisi: 'à saisir', revise: 'saisi', declare: 'révisé', fini: 'déclaré' };
  const CASE_TENU = { saisi: 'manquant', revise: 'provisoire', declare: 'provisoire', fini: 'complet' };
  async function dessinerMoisTenus(dossier) {
    let index = null;
    try { index = await api.livreIndex(dossier.id); } catch (_) { index = null; }
    // La page a pu changer pendant la lecture : la zone se redemande APRÈS l'attente, et elle doit
    // être celle de CE dossier (7.6.0).
    const zone = document.getElementById('d-mois-tenu');
    if (!zone || zone.dataset.id !== dossier.id) return;
    const mois = K.productionDuDossier(dossier, index, K.today(), (S.settings || {}).relanceDay);
    if (!mois.length) {
      zone.innerHTML = `<div class="empty mini">Ce client n'utilise pas SkanFact : rien ne lui est réclamé, sa comptabilité se tient ici.
        <div class="inline mt"><button type="button" class="btn btn-sm" data-vers="comptabilite">Ouvrir sa comptabilité</button></div></div>`;
      $$('[data-vers]', zone).forEach(b => { b.onclick = () => { location.hash = '#/dossier/' + encodeURIComponent(dossier.id) + '/' + b.dataset.vers; }; });
      return;
    }
    const parMois = new Map(mois.map(m => [m.mois, m]));
    const annees = [...new Set(mois.map(m => m.mois.slice(0, 4)))].sort().reverse();
    const premier = mois[0].mois;
    const ceMois = K.today().slice(0, 7);
    zone.innerHTML = annees.map(y => `<div class="year-row"><div class="year-lab">${esc(y)}</div>
      <div class="mgrid">${MOIS_COURTS.map((nom, k) => {
      const cle = `${y}-${String(k + 1).padStart(2, '0')}`;
      const m = parMois.get(cle);
      if (!m) {
        const avant = cle < premier;
        const raison = avant ? 'hors mission' : cle === ceMois ? 'en cours' : 'à venir';
        return `<div class="mcell hors" title="${esc(avant
          ? 'Avant le premier exercice tenu ici : rien à saisir pour ce mois.'
          : 'Le mois en cours et les suivants ne sont pas encore à saisir.')}">
          <div class="m-lab">${esc(nom)}</div><div class="m-st">${esc(raison)}</div></div>`;
      }
      const quoi = m.etape === 'saisi' ? `Saisir ${m.label}` : `Ouvrir la déclaration ${KC.deMois(m.label)}`;
      return `<button type="button" class="mcell ${CASE_TENU[m.etape] || 'hors'} clickable" data-tenu="${esc(cle)}" data-etape="${esc(m.etape)}"
        title="${esc(quoi)}" aria-label="${esc(m.label)} — ${esc(MOT_TENU[m.etape] || '')}. ${esc(quoi)}">
        <div class="m-lab">${esc(nom)}</div><div class="m-st">${esc(MOT_TENU[m.etape] || '')}</div></button>`;
    }).join('')}</div></div>`).join('')
      + '<p class="muted small mt">Tenu au cabinet : chaque mois se lit dans le livre — <strong>à saisir</strong> tant qu\'il n\'a aucune écriture, <strong>déclaré</strong> quand sa déclaration est marquée déposée. Rien n\'est réclamé au client.</p>';
    $$('[data-tenu]', zone).forEach(b => { b.onclick = () => ouvrirMoisTenu(dossier, b.dataset.tenu, b.dataset.etape); });
  }

  // Ouvre le mois d'un dossier tenu là où il se traite : la Saisie s'il n'a rien, sa Déclaration
  // sinon — sur CE mois et sur SON exercice, pas sur le dernier regardé.
  function ouvrirMoisTenu(dossier, mois, etape) {
    changerDeDossierCompta(dossier.id);
    livresState.annee = mois.slice(0, 4);
    if (etape !== 'saisi') { declState.mois = mois; declState.ouverte = ''; }
    location.hash = '#/dossier/' + encodeURIComponent(dossier.id) + '/comptabilite/' + (etape === 'saisi' ? 'saisie' : 'declaration') + '/' + mois.slice(0, 4);
  }

  function drawDossier(view, id, ongletDemande, sousOnglet, anneeDemandee) {
    const dossier = (S.dossiers || []).find(d => d.id === decodeURIComponent(id || ''));
    // Un état vide dit sa raison ET donne le geste (7.0.0) : seul, « Ce dossier n'existe plus. » ne
    // laissait que la barre latérale — vu à la souris après « Quitter l'exemple » sur la paie du garage.
    if (!dossier) {
      view.innerHTML = `<div class="empty">Ce dossier n'existe plus : il a été retiré, ou c'était un dossier de l'exemple.
        <div class="mt"><button class="btn" id="dz-retour">Revenir aux dossiers</button></div></div>`;
      $('#dz-retour', view).onclick = () => navigate('#/dossiers');
      return;
    }
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
    // Un chiffre venu d'un paquet peut être une chaîne : additionné tel quel, il se CONCATÈNE (6.8.1).
    // Et ce total ne s'appelle plus `totalCA` : une constante locale qui porte le nom d'une fonction
    // du module la MASQUE dans tout le corps (10.8.0).
    const caDe = p => { const n = Number(p.figures && p.figures.ca); return isFinite(n) ? n : 0; };
    const caTousMois = packs.reduce((s, p) => s + caDe(p), 0);
    // L'onglet : celui de l'adresse s'il en porte un ; sinon celui où l'on était sur CE dossier ;
    // sinon Suivi, l'écran du quotidien.
    const onglet = ONGLETS_DOSSIER.includes(ongletDemande) ? ongletDemande : (ficheDossierId === dossier.id ? ficheOnglet : 'suivi');
    ficheOnglet = onglet; ficheDossierId = dossier.id;
    const versOnglet = o => { location.hash = '#/dossier/' + encodeURIComponent(dossier.id) + '/' + o; };
    // L'état du dossier en une phrase : ce qu'un comptable veut savoir avant tout le reste.
    const dernierRecu = packs.reduce((m, p) => Math.max(m, p.receivedAt || 0), 0);
    const packsAnnee = packs.filter(p => p.month.slice(0, 4) === anneeVue);
    const caAnnee = packsAnnee.reduce((s, p) => s + caDe(p), 0);
    // 10.12.0 (U-25) — « CA 2026 » sur huit mois reçus se lisait comme le CA de l'année entière.
    // La période se NOMME : les mois qu'il additionne vraiment, du premier au dernier reçu.
    const moisAnnee = packsAnnee.map(p => p.month).sort();
    const periodeCA = moisAnnee.length > 1
      ? `${MOIS_COURTS[Number(moisAnnee[0].slice(5, 7)) - 1]}–${MOIS_COURTS[Number(moisAnnee[moisAnnee.length - 1].slice(5, 7)) - 1]} ${anneeVue}`.toLowerCase()
      : moisAnnee.length ? K.monthLabel(moisAnnee[0]) : anneeVue;
    const etat = [
      // Un dossier tenu au cabinet dit ce que ça VEUT DIRE (10.12.0) : « pas encore sur SkanFact »
      // répétait le badge du titre, dix pixels plus haut.
      packs.length ? pl(packs.length, 'mois reçu', 'mois reçus') : (dossier.manual ? 'tenu au cabinet : aucun paquet attendu' : 'aucun paquet reçu pour l\'instant'),
      row.missingCount ? `<span class="warn-text">${pl(row.missingCount, 'manquant')}</span>` : '',
      row.provisionalCount ? `<span class="warn-text">${pl(row.provisionalCount, 'provisoire')}</span>` : '',
      dernierRecu ? 'dernier paquet le ' + esc(fmtDay(dernierRecu)) : '',
      packs.length && anneeVue ? `CA ${esc(periodeCA)} : <strong>${esc(money(caAnnee))}</strong>` : '',
      // Les points signalés dans ses paquets (achats sans justificatif, brouillons…) : la colonne
      // « Signalé » de la liste les comptait, la fiche ne les nommait nulle part avant l'onglet Paquets.
      row.issues ? `<button type="button" class="lien-manque" data-vers="paquets">${esc(pl(row.issues, 'point signalé', 'points signalés'))}</button>` : ''
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
      esc(K.regimeEnPhrase(labelOf(K.choixRegimes(S, dossier.regime), dossier.regime))),
      labelOf(K.TVA_PERIODS, dossier.tvaPeriod) ? 'TVA ' + esc(labelOf(K.TVA_PERIODS, dossier.tvaPeriod)) : '',
      dossier.from ? 'mission depuis ' + esc(K.monthLabel(dossier.from)) : '',
      dossier.fees ? esc(money(dossier.fees)) + ' / mois' : ''
    ].filter(Boolean).join(' · ');
    const altere = packs.some(p => p.integrity && (p.integrity.bad || []).length);
    const intrus = packs.some(p => p.integrity && (p.integrity.intrus || []).length);
    const ongletBtn = (o, label, n) => `<button role="tab" data-tab="${o}" class="${onglet === o ? 'active' : ''}" aria-selected="${onglet === o}">${label}${n ? `<span class="tab-n">${n}</span>` : ''}</button>`;

    view.innerHTML = `
      ${/* 10.12.0 (U-01) — le bouton retour vit sur la LIGNE du titre. Posé seul au-dessus, il coûtait
            une rangée entière à chaque écran de la fiche, et sur un portable de 1280×800 la grille de
            saisie commençait à 764 px : une seule ligne visible. */''}
      ${/* 10.14.1 — le nom et ses gestes sur UNE rangée, l'identité et l'état sur une ligne pleine
            largeur dessous. Empilés sous le nom, ils élargissaient le titre : à 1280 px
            les gestes passaient sur une seconde rangée (126 px d'en-tête), et la grille de saisie
            tombait sous le bas de l'écran. */''}
      <div class="page-head fiche-dossier">
        <div class="fiche-titre"><button class="btn btn-ghost btn-sm btn-back" id="back" title="Revenir à la liste des dossiers">← Dossiers</button>
        <h1>${esc(dossier.name)}${dossier.archived ? ' <span class="badge">archivé</span>' : ''}${dossier.manual ? ' <span class="badge b-hors">pas encore sur SkanFact</span>' : ''}</h1></div>
      <div class="actions">
        ${/* U-11 — un seul vert par écran. Sur l'onglet Comptabilité, l'étape suivante est celle du
              livre (le créer, saisir, déclarer) et « Relancer » y redevient un bouton ordinaire : deux
              verts côte à côte ne désignent plus rien. Il reprend sa couleur sur le Suivi et les
              Paquets, où c'est lui qui répond au manque. */''}
        ${row.missingCount || row.provisionalCount ? `<button class="btn${onglet === 'comptabilite' ? '' : ' btn-primary'}" id="rel">Relancer</button>` : ''}
        <button class="btn" id="edit">Modifier la fiche</button>
        ${/* Un en-tête de fiche a un budget de boutons, comme une ligne de liste (7.29.0).
              « Imprimer » est un geste rare : il occupait une place premium à côté de ceux qu'on
              fait tous les jours. Les deux gestes de contact le rejoignent — ils dépendent d'un
              numéro qu'un dossier sur deux n'a pas, donc la barre changeait de forme d'un client
              à l'autre. */''}
        ${RowMenu.bouton('F:' + dossier.id, 'Actions', 'btn')}
      </div>
      <div class="d-meta"><div class="d-ident">${ident}</div><div class="d-etat" id="d-etat">${etat}</div></div></div>
      <div class="print-only print-head">${esc(S.cabinet.name || 'Cabinet')} — fiche client imprimée le ${esc(fmtDay(Date.now()))}</div>

      ${altere
        ? `<div class="warn-box mb"><strong>Au moins un paquet de ce client contient un fichier qui ne correspond pas à l'empreinte annoncée.</strong>
           Ce n'est pas ce qui a été envoyé : redemande-le avant de déclarer. ${onglet !== 'paquets' ? '<button class="btn btn-sm" data-vers="paquets">Voir les paquets</button>' : ''}</div>` : ''}
      ${intrus
        ? `<div class="warn-box mb"><strong>Au moins un paquet de ce client contient un fichier que son manifeste n'annonce pas ${info('p.intrus')}</strong>
           Personne ne l'a vérifié et il ne compte pas dans les pièces intactes. Ouvre-le seulement si tu sais d'où il vient. ${onglet !== 'paquets' ? '<button class="btn btn-sm" data-vers="paquets">Voir les paquets</button>' : ''}</div>` : ''}

      <div class="tabs" id="d-tabs" role="tablist" aria-label="La fiche de ${esc(dossier.name)}">
        ${ongletBtn('suivi', 'Suivi', row.missingCount)}
        ${ongletBtn('comptabilite', 'Comptabilité' + pointSale(dossier.id), 0)}
        ${ongletBtn('paquets', 'Paquets', packs.length)}
      </div>

      <section data-onglet="suivi" ${onglet === 'suivi' ? '' : 'hidden'}>
      <div class="panel"><h2>Les mois de ce client ${dossier.manual ? info('p.moisTenus') : info('p.definitif')}</h2>
        ${/* Les DOUZE mois de chaque année, pas seulement ceux attendus. L'écran en montrait six
              sous une étiquette « 2026 », sans dire pourquoi : on ne savait pas si la mission
              commençait en mars ou si l'application avait perdu les deux premiers. Les mois hors
              mission sont là, en gris, et ils DISENT pourquoi — c'est le calendrier qui explique
              l'extrait, pas l'inverse. Et chaque mois attendu porte son geste : ouvrir le paquet
              quand il est là, relancer sur CE mois quand il manque (règle 7.15.0 — un écran qui
              nomme un ensemble doit pouvoir l'ouvrir).
              Un dossier TENU AU CABINET (10.12.0) n'attend aucun paquet : ses mois viennent de son
              LIVRE, lus dans l'index après le dessin (`dessinerMoisTenus`). « Commence à attendre ses
              mois » ne voulait rien dire pour un client qui n'envoie rien, et le garage de l'exemple
              — sept mois déclarés — y paraissait vierge. */''}
        ${dossier.manual ? `<div id="d-mois-tenu" data-id="${esc(dossier.id)}"><span class="muted small">Lecture du livre…</span></div>`
          : months.length ? years.map(y => `<div class="year-row"><div class="year-lab">${esc(y)}</div>
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
          : '<span class="muted small">Aucun mois attendu pour l\'instant : l\'attente démarre au premier paquet reçu, ou à la date de début de mission que tu renseignes dans la fiche.</span>'}
        ${!dossier.manual && months.length ? `<p class="muted small mt">Un mois <strong>provisoire</strong> n'a pas été clôturé chez le client : ses chiffres peuvent encore changer,
        ne déclare pas dessus. Le mois en cours n'est jamais réclamé.</p>` : ''}
      </div>

      <div class="panel"><h2>Relances ${info('r.history')}</h2>
      ${relances.length ? `<table class="list compact"><thead><tr><th class="nw">Date</th><th class="nw">Moyen</th><th>Mois réclamés</th><th>Note</th></tr></thead>
        <tbody>${relances.map(r => `<tr>
          <td class="nw">${esc(fmtWhen(r.at))} <span class="muted small">${esc(ago(r.at))}</span></td>
          <td class="nw">${esc(labelOf(K.RELANCE_WAYS, r.via) || r.via)}</td>
          <td>${esc(K.monthListLabel(r.months || []) || '—')}</td>
          <td class="muted">${esc(r.note || '')}</td></tr>`).join('')}</tbody></table>`
        : `<div class="empty mini">Aucune relance enregistrée pour ce client.<br>
          <span class="small">${/* 10.12.0 (U-22) — la phrase suit la condition du bouton : sur un client à
                jour, « Relancer » n'existe pas, et l'écran renvoyait vers un bouton absent (7.3.0).
                Un dossier tenu au cabinet n'est pas « à jour » pour autant (10.14.1, MC-14) : on ne
                lui réclame rien, et ses mois à saisir sont le travail du cabinet. */''}${row.missingCount || row.provisionalCount
    ? 'Le bouton « Relancer », en haut, écrit le message et l\'enregistre ici. '
    : dossier.manual ? 'Tenu au cabinet : SkanFact ne lui réclame rien. '
      : 'Ce client est à jour : il n\'y a rien à lui réclamer. '}Un appel ou un message
          passé ailleurs se note à la main.</span></div>`}
        ${/* Un état vide qui explique le geste en prose n'est pas une interface (7.0.0) : le bouton
              vit DANS le panneau, et il en a l'air. */''}
        <div class="modal-actions"><button class="btn btn-sm" id="note-rel">Noter une relance faite ailleurs…</button></div>
      </div>

      ${/* Les droits sur CE dossier (9.9.0). Le panneau n'existe QUE si le cabinet a déclaré des
            collaborateurs : un cabinet d'une personne n'a personne à qui donner un droit, et lui
            poser une grille vide reviendrait à lui vendre un problème qu'il n'a pas. */''}
      ${panneauDroits(dossier)}

      ${(dossier.note || '').trim() ? `<div class="panel"><h2>Note interne</h2><div class="notes-md">${esc(dossier.note)}</div></div>` : ''}
      </section>

      <section data-onglet="comptabilite" ${onglet === 'comptabilite' ? '' : 'hidden'}>
      ${/* 10.10.0 (C-07) — le panneau existe pour TOUT dossier. Il n'existait qu'avec des paquets :
            un client hors SkanFact — le seul qu'on FACTURE — se voyait promettre sa comptabilité pour
            le jour de son premier envoi, un envoi qui ne viendra jamais, pendant que l'Aide lui disait
            de saisir « Comptabilité → Saisie ». Le moteur savait créer son livre ; l'écran, non. */''}
      ${/* 10.12.0 (U-01) — le titre « Comptabilité » répétait l'onglet qu'on venait de cliquer, et
            trois rangées (titre, période, bandeau du livre) passaient devant la grille. Elles n'en
            font plus qu'UNE : ce que je regarde (la période) et d'où ça vient (le livre ou les
            paquets). Sa bulle explique la comptabilité entière, sur le nom du livre. */''}
      <div class="panel" id="c-compta">
        ${/* Deux listes déroulantes nues au-dessus d'un livre-journal ne disent pas ce qu'elles
              choisissent : « L'exercice / 2026 » pouvait tout aussi bien être un filtre de journal.
              Le mot « Période » devant, et chaque contrôle porte son `aria-label` — un lecteur
              d'écran n'a pas de capture d'écran pour deviner. */''}
        <div class="filters c-barre">
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
          <span class="grow"></span>
          <span class="c-livre" id="c-livre-etat"><b>Comptabilité</b> ${info('lv.compta')}</span>
        </div>
        <div id="c-livres"><div class="empty">Lecture de la comptabilité…</div></div>
      </div>
      </section>

      <section data-onglet="paquets" ${onglet === 'paquets' ? '' : 'hidden'}>
      ${/* 10.14.1 — le chiffre d'affaires se lit dans les PAQUETS : un dossier qui n'en a reçu aucun
            (tenu au cabinet, ou pas encore d'envoi) n'a pas ce panneau, « Aucun paquet reçu » le dit
            juste dessous. Et une année sans paquet ne se dit plus « sans chiffres » (`caSansChiffre`). */''}
      ${years.length && packs.length ? `<div class="panel"><h2>Chiffre d'affaires ${info('d.ca')}</h2>
        ${years.length > 1 ? `<div class="filters"><label class="inline small">Exercice
          <select id="ca-year">${years.map(y => `<option value="${esc(y)}" ${y === anneeVue ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select></label></div>` : ''}
        ${caChart(packs, anneeVue) || `<div class="empty mini">${esc(caSansChiffre(packs, anneeVue))}</div>`}
      </div>` : ''}

      ${/* 10.12.0 (U-25) — deux bulles côte à côte sur le même titre se lisaient comme une seule, et
            la seconde ne s'ouvrait qu'en visant au pixel. Celle qui explique « Vérifiées » vit sur
            SA colonne : un en-tête de colonne peut porter une bulle (7.0.0). */''}
      <div class="panel"><h2>Paquets reçus ${info('p.actions')}</h2>
      ${packs.length ? `<div class="scroll-x"><table class="list compact">
        <thead><tr><th class="nw">Mois</th><th>État</th><th class="r nw">Chiffre d'affaires</th><th class="r nw">TVA à décaisser</th>
        <th class="r nw">Vérifiées ${info('p.integrity')}</th><th class="r">Signalé</th><th class="nw">Reçu le</th><th class="nw">Fabriqué le</th><th></th></tr></thead>
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
          <td class="r nw"><strong>${esc(money(caTousMois))}</strong></td><td colspan="6"></td></tr></tfoot></table></div>
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
    brancherDroits(view, dossier);
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
    if (dossier.manual) dessinerMoisTenus(dossier);
    // Le menu d'un paquet dit « Voir ses écritures » ou « Créer le livre » : il le demande à
    // l'INDEX de CE dossier, lu sans déchiffrer (9.1.0). Il jugeait sur le livre gardé en mémoire —
    // absent après un redémarrage (« Créer le livre » sur un livre qui existe), ou celui d'un AUTRE
    // client (« Voir ses écritures » sur un dossier qui n'en a pas). Vu à la souris, 10.14.0.
    api.livreIndex(dossier.id).then(ix => { livresConnus.set(dossier.id, ((ix || {}).exercices || []).length > 0); }, () => {});

    // Les livres du dossier (9.1.0). L'état de la période est propre au dossier : passer d'un
    // client à l'autre en gardant « mars 2026 » afficherait un livre vide sans raison visible
    // (même garde-fou que `ficheYear`, plus haut).
    if ($('#c-compta', view)) {
      changerDeDossierCompta(dossier.id);
      // Le sous-onglet de l'ADRESSE passe avant la mémoire (U-06) : « précédent », la palette et
      // toute autre page y mènent en le nommant. Sans sous-onglet, on garde celui où l'on était.
      if (sousOnglet && ONGLETS_COMPTA[sousOnglet] && livresState.onglet !== sousOnglet) {
        livresState.onglet = sousOnglet; livresState.page = 1;
      }
      // L'EXERCICE aussi (10.14.0) : `…/comptabilite/<écran>/<année>`. Sans lui, un exercice précis ne
      // s'atteignait qu'en changeant le sélecteur à la main — la visite ne pouvait pas montrer l'exercice
      // clos de l'exemple, ni « précédent » revenir sur 2025 après un détour. Toute porte qui change
      // d'exercice réécrit l'adresse (`suivreExercice`) : sinon le prochain redessin ramènerait l'ancien.
      if (/^\d{4}$/.test(String(anneeDemandee || '')) && String(livresState.annee) !== anneeDemandee) {
        livresState.annee = anneeDemandee; livresState.page = 1;
      }
      const relire = () => drawLivres(view, dossier);
      const mode = $('#lv-mode', view);
      mode.onchange = () => {
        livresState.mode = mode.value; livresState.page = 1;
        // « Un mois » s'ouvre sur un mois VRAI de l'exercice regardé (U-12) — jamais sur la première
        // option : la liste affichait « décembre 2026 », un mois futur, pendant que le livre montrait
        // l'exercice entier faute de mois choisi. Un select dont aucune option ne correspond retient
        // la première, en silence (8.3.0) ; ici il annonçait une période que l'écran ne montrait pas.
        if (livresState.mode === 'mois' && !String(livresState.mois || '').startsWith(String(livresState.annee) + '-')) livresState.mois = moisDeLaPeriode();
        render();
      };
      // Changer d'exercice change de LIVRE : sans cette relecture, on regarderait 2025 dans le
      // livre de 2026 sans que rien ne le dise.
      const an = $('#lv-annee', view); if (an) an.onchange = () => {
        livresState.annee = an.value; livresState.page = 1;
        suivreExercice(dossier);
        chargerLeLivre(dossier).then(apres, apres);
      };
      // Un mois d'un AUTRE exercice change de livre, comme le sélecteur d'exercice : sinon on lirait
      // novembre 2025 dans le livre de 2026 — vide, et « ce mois reste à saisir » à tort.
      const mo = $('#lv-mois', view); if (mo) mo.onchange = () => {
        livresState.mois = mo.value; livresState.page = 1;
        const y = String(mo.value).slice(0, 4);
        if (livresState.livre && /^\d{4}$/.test(y) && y !== String(livresState.annee)) {
          livresState.annee = y;
          suivreExercice(dossier);
          chargerLeLivre(dossier).then(apres, apres);
          return;
        }
        relire();
      };
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
        aUnLivre(dossier.id)
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
  // dossier → a-t-il au moins un livre ? (lu dans l'index à l'ouverture de sa fiche)
  const livresConnus = new Map();
  const aUnLivre = id => livresConnus.has(id) ? livresConnus.get(id)
    : !!(livresState.livre && String(livresState.livreCle || '').startsWith(id + '|'));
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

  // L'écran de comptabilité où l'on était, PAR DOSSIER (10.12.0, H-5 — trouvé en testant comme un
  // humain). Changer de client remettait tout à zéro, écran compris : on laissait Béji dans sa
  // Saisie, une pièce commencée, pour jeter un œil au journal d'un autre client — et Béji rouvrait
  // sur son livre-journal pendant que sa pièce attendait deux clics plus loin. La fiche retient son
  // onglet par dossier depuis la 9.2.2 ; sa comptabilité, jamais. Le reste (période, filtres,
  // page) repart à zéro : c'est de l'état de lecture, et un filtre qu'on ne voit pas cache ce
  // qu'on est venu chercher (9.4.6).
  const ecransCompta = {};
  function changerDeDossierCompta(dossierId) {
    const s = livresState;
    if (s.dossierId === dossierId) return;
    if (s.dossierId) ecransCompta[s.dossierId] = { onglet: s.onglet, dernierParGroupe: { ...(s.dernierParGroupe || {}) } };
    const m = ecransCompta[dossierId] || {};
    s.dossierId = dossierId; s.data = null;
    s.annee = ''; s.mois = ''; s.du = ''; s.au = '';
    s.onglet = m.onglet || 'journal'; s.compte = ''; s.journal = ''; s.q = ''; s.aux = false;
    s.page = 1; s.dernierParGroupe = { ...(m.dernierParGroupe || {}) };
    s.glOuverts = new Set(); s.glLimites = {};  // un compte ouvert chez un client ne l'est pas chez l'autre
    // Le mois de déclaration choisi chez un client ne suit pas chez le suivant (10.12.0) : juillet
    // 2026 du garage ouvrait la déclaration de juillet 2026 d'un client dont on regarde 2025.
    declState.mois = ''; declState.ouverte = '';
  }

  function moisLabelCourt(m) { return K.monthLabel(m); }

  // Le mois où s'ouvre « Un mois » : le dernier qui porte des écritures dans l'exercice regardé, sinon
  // le mois courant — la règle de la Paie et de la Déclaration (`K.moisDeTravail`, U-12). Sans livre,
  // les mois des paquets reçus font foi.
  function moisDeLaPeriode() {
    const s = livresState;
    if (s.livre) return moisPropose(s.livre);
    const y = String(s.annee || K.today().slice(0, 4));
    const faits = ((s.data || {}).tousLesMois || []).filter(m => String(m).startsWith(y + '-')).map(m => Number(String(m).slice(5, 7)));
    return `${y}-${String(K.moisDeTravail(faits, y, K.today())).padStart(2, '0')}`;
  }

  // Ce qui borne la période. Trois modes, et le défaut est l'exercice du dernier paquet reçu :
  // c'est celui sur lequel le comptable travaille.
  function bornesLivres(mois) {
    const s = livresState;
    if (s.mode === 'mois' && s.mois) return { du: s.mois, au: s.mois };
    if (s.mode === 'intervalle') return { du: s.du || '', au: s.au || '' };
    const y = s.annee || (mois.length ? mois[mois.length - 1].slice(0, 4) : String(new Date().getFullYear()));
    return { du: y + '-01', au: y + '-12' };
  }

  // Les exercices qu'on peut ouvrir : ceux des paquets reçus, ceux que le cabinet TIENT (lus dans
  // l'index des livres), et celui qu'on regarde. 10.10.0 (C-12) : la liste ne connaissait que les
  // paquets — « Ouvrir 2027 » créait un livre qu'aucun écran ne permettait d'ouvrir, même après un
  // redémarrage. Le geste qui crée un exercice l'ajoute ici lui-même (`exerciceConnu`).
  function anneesDuDossier() {
    const s = livresState;
    const d = s.data || {};
    const set = new Set((d.tousLesMois || []).map(m => m.slice(0, 4)));
    (d.exercices || []).forEach(x => set.add(String(x.annee)));
    if (s.annee) set.add(String(s.annee));
    return [...set].filter(y => /^\d{4}$/.test(y)).sort().reverse();
  }
  function exerciceConnu(annee) {
    const d = livresState.data;
    if (!d || d.erreur) return;
    d.exercices = d.exercices || [];
    if (!d.exercices.some(x => String(x.annee) === String(annee))) d.exercices.push({ annee: String(annee), clos: false, ecritures: 0 });
  }
  function majSelecteurExercice(root) {
    const sel = $('#lv-annee', root) || $('#lv-annee');
    if (!sel) return;
    const ans = anneesDuDossier();
    const cle = ans.join(',');
    if (!(sel.dataset.ans === cle && sel.value === String(livresState.annee))) {
      sel.dataset.ans = cle;
      sel.innerHTML = ans.map(y => `<option value="${esc(y)}" ${String(livresState.annee) === y ? 'selected' : ''}>${esc(y)}</option>`).join('');
    }
    // Et les MOIS : un dossier tenu à la main n'a aucun paquet, donc « Un mois » ne proposait rien.
    // Avec un livre, les douze mois de CHAQUE exercice connu s'ajoutent à ceux des paquets : choisir
    // décembre 2025 depuis 2026 ouvre le livre de 2025 (`lv-mois`), au lieu de le chercher en
    // repassant par « L'exercice ».
    const mo = $('#lv-mois', root) || $('#lv-mois');
    if (mo && livresState.livre) {
      const mois = new Set(((livresState.data || {}).tousLesMois || []));
      ans.forEach(y => { for (let i = 1; i <= 12; i++) mois.add(`${y}-${String(i).padStart(2, '0')}`); });
      const liste = [...mois].sort().reverse();
      const cleM = liste.join(',');
      if (mo.dataset.mois !== cleM) {
        mo.dataset.mois = cleM;
        mo.innerHTML = liste.map(m => `<option value="${esc(m)}" ${livresState.mois === m ? 'selected' : ''}>${esc(K.monthLabel(m))}</option>`).join('');
      }
    }
  }

  async function chargerLivres(dossier) {
    const s = livresState;
    try {
      const brut = await api.livres(dossier.id, '', '');           // tout, une fois : le cache est côté main
      s.dossierId = dossier.id;
      s.data = brut;
      if (!s.annee) {
        // L'exercice du dernier paquet reçu ; sans paquet, le dernier exercice que le cabinet tient ;
        // sinon l'année en cours — celle qu'on commence.
        const m = brut.tousLesMois;
        const ex = (brut.exercices || []).map(x => x.annee).sort();
        s.annee = m.length ? m[m.length - 1].slice(0, 4) : ex.length ? ex[ex.length - 1] : String(new Date().getFullYear());
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
  function lignesDeLaPeriode(dossier) {
    const s = livresState;
    if (!s.data || s.data.erreur) return { lignes: [], illisibles: [], anciens: [], manquants: [], pris: [] };
    // 10.12.0 (U-05) — un mois AVANT le début de mission n'est pas un manque : la fiche le dit
    // « hors mission » un onglet plus loin, et c'est la même fonction qui décide des deux côtés.
    // Sans elle, un client repris en juillet voyait « Il manque 6 mois » sur toute sa comptabilité.
    const mission = K.debutDeMission(dossier);
    const plusTard = (a, b) => (a && b ? (a > b ? a : b) : a || b);
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
        manquants = K.moisManquants(toutes.map(l => l.date), plusTard(plusTard(du, debutEx), mission), au);
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
    const manquants = K.moisManquants(pris.map(p => p.month), plusTard(du, mission), au);
    return { source: 'paquets', lignes, avant: [], ouverture: null, du: '', au: '', illisibles, anciens, manquants, pris };
  }

  // Ce que la période affichée porte AVANT elle, et comment le dire. Une seule phrase pour le
  // grand livre et la balance : la 9.1.0 écrivait « ce livre est lu dans les paquets, sans
  // à-nouveau » en permanence, y compris sur le LIVRE du cabinet (T-38) — le constat était vrai,
  // la raison donnée était fausse, et une phrase que rien ne tient est un bug (7.3.0).
  // Ce qui porte les soldes d'ouverture, NOMMÉ : la balance reprise (pièce OUVERTURE du journal AN)
  // et les à-nouveaux d'une clôture (pièces AN-…). La phrase disait « les soldes repris (aucun) »
  // sur un exercice ouvert par ses à-nouveaux : vrai de la reprise, faux pour un comptable — le
  // capital était là, dans la colonne d'à côté (10.14.0). Un brouillard ne compte que si l'écran
  // montre les brouillards : c'est la même règle que les lignes de la balance.
  function porteursDOuverture() {
    const s = livresState;
    const reprise = ((s.livre.ouverture || {}).lignes || []).length;
    const an = (s.livre.ecritures || []).filter(e => e.source === 'an' && e.piece !== 'OUVERTURE' && !e.contrepasseDe
      && (e.statut === 'validee' || (s.brouillard && e.statut === 'brouillard'))).map(e => e.piece || 'AN');
    // L'accord se fait sur les PIÈCES, jamais sur les morceaux de phrase : « les à-nouveaux AN-2026,
    // AN-2026-C1 est une pièce » se lisait comme une faute de l'écran.
    return {
      textes: [reprise ? `la balance d'ouverture reprise (${pl(reprise, 'compte')})` : '',
        an.length ? `${an.length > 1 ? 'les à-nouveaux' : 'l\'à-nouveau'} ${an.join(', ')}` : ''].filter(Boolean),
      pieces: (reprise ? 1 : 0) + an.length
    };
  }

  function phraseOuverture() {
    const s = livresState;
    const p = s.periode || {};
    if (p.source !== 'livre') return `Ouverture inconnue : ces écritures sont lues dans les paquets reçus, sans à-nouveau ${info('lv.ouverture')}`;
    const { textes: porte, pieces } = porteursDOuverture();
    const debutEx = String((s.livre.exercice || {}).du || '');
    if (p.du && p.du > debutEx) return `Ouverture au ${esc(fmtJour(p.du))} : ${porte.length ? esc(porte.join(' et ')) + ', plus' : 'aucun solde reporté, seulement'} les mouvements de l'exercice avant cette date ${info('lv.ouverture')}`;
    // 10.12.0 — la reprise est une pièce du journal AN : sur l'exercice entier, elle est dans les
    // MOUVEMENTS, et la colonne d'ouverture est nulle. La phrase disait le contraire — et la balance
    // comptait les deux.
    return porte.length
      ? `Ouverture au ${esc(fmtJour(debutEx))} : nulle sur l'exercice entier — ${esc(porte.join(' et '))} ${pieces > 1 ? 'sont des pièces' : 'est une pièce'} du journal AN, dans les mouvements ${info('lv.ouverture')}`
      : `Ouverture au ${esc(fmtJour(debutEx))} : nulle — ni balance d'ouverture reprise ni à-nouveau : ce livre part de zéro ${info('lv.ouverture')}`;
  }

  // ---------------------------------------------------------------- reprendre / relire (9.2.0)

  // Créer le livre à partir de ce qui a déjà été reçu. Rejouer ne double RIEN : chaque mois
  // remplace ses brouillards et laisse les validées intactes — c'est la même fonction que l'import
  // d'un paquet neuf, donc le geste est sûr à répéter, et c'est ce qui le rend utilisable.
  // Un compte rendu qui PROPOSE la suite (10.12.0, U-27). « Créer le livre » finissait sur une
  // fenêtre à un seul bouton, « OK » : on venait de créer quelque chose, et l'écran ne disait pas
  // quoi en faire. Chaque écran finit par le geste suivant (7.27.0, 9.4.9). Le geste principal vient
  // en dernier, à droite, là où l'œil finit la lecture ; « Fermer » reste toujours là.
  function compteRendu(title, html, gestes) {
    const ordre = (gestes || []).slice().sort((a, b) => (a.primaire ? 1 : 0) - (b.primaire ? 1 : 0));
    return new Promise(resolve => {
      modal(`<h2>${esc(title)}</h2><div class="cr-corps">${html}</div>
        <div class="modal-actions"><button class="btn" id="cr-fermer">Fermer</button>
        ${ordre.map((g, i) => `<button class="btn${g.primaire ? ' btn-primary' : ''}"${g.primaire ? ' id="ok"' : ''} data-cr="${i}">${esc(g.label)}</button>`).join('')}</div>`,
      (layer, close) => {
        $('#cr-fermer', layer).onclick = () => { close(); resolve(null); };
        $$('[data-cr]', layer).forEach(b => { b.onclick = () => { close(); resolve(ordre[Number(b.dataset.cr)]); }; });
      }, () => resolve(null));
    });
  }

  async function relireLesPaquets(root, dossier) {
    const s = livresState;
    const creation = !s.livre;
    try {
      const r = await api.relireLesPaquets(dossier.id, s.annee);
      s.livre = r.livre; s.livreEtat = r.livre ? 'ouvert' : s.livreEtat;
      // Le compte rendu s'écrit en HTML, chaque morceau venu des données échappé UNE fois : écrit en
      // texte puis passé à `infoDialog`, une pièce « A&B » s'affichait « A&amp;B » (échappée deux fois).
      const puces = l => `<ul class="cr-liste">${l.join('')}</ul>`;
      const blocs = [
        `<p>${esc(pl(r.mois, 'mois', 'mois'))} relu${r.mois > 1 ? 's' : ''} : ${esc(pl(r.ajoutees, 'écriture ajoutée', 'écritures ajoutées'))}${r.validees ? `, dont ${esc(pl(r.validees, 'validée', 'validées'))} (mois définitifs)` : ' (en brouillard)'}.</p>`,
        r.remplacees ? `<p>${esc(pl(r.remplacees, 'écriture remplacée', 'écritures remplacées'))} par une version renvoyée.</p>` : '',
        // Les écarts ne s'appliquent JAMAIS seuls : on les montre, le comptable tranche.
        r.ecarts.length ? `<p>${esc(pl(r.ecarts.length, 'écriture validée diffère', 'écritures validées diffèrent'))} du mois renvoyé — elles n'ont pas été touchées :</p>` +
          puces(r.ecarts.slice(0, 8).map(e => `<li>${esc(e.piece || e.id)} (${esc(moisLabelCourt(e.mois))}) : ${esc(montant(e.avant))} → ${esc(montant(e.apres))}</li>`)) : '',
        // Un mois définitif dont une pièce n'a pas pu être VALIDÉE reste en brouillard : on le dit,
        // sinon le mois paraît classé alors que deux pièces attendent encore (règle 9.8.0).
        (r.nonValidees || []).length ? `<p>${esc(pl(r.nonValidees.length, 'écriture n\'a pas pu être validée', 'écritures n\'ont pas pu être validées'))} et ${r.nonValidees.length > 1 ? 'restent' : 'reste'} en brouillard :</p>` +
          puces(r.nonValidees.slice(0, 8).map(x => `<li>${esc(x.journal || '')} ${esc(x.piece || '(sans référence)')} (${esc(moisLabelCourt(x.mois))}) : ${esc(x.motif || '')}</li>`)) : '',
        r.illisibles.length ? `<p>${esc(pl(r.illisibles.length, 'mois', 'mois'))} illisible${r.illisibles.length > 1 ? 's' : ''} : ${esc(K.monthListLabel(r.illisibles.map(x => x.mois)))}.</p>` : ''
      ].filter(Boolean);
      // La suite : le brouillard s'il en reste — c'est lui qui attend une décision —, sinon le
      // livre-journal, pour relire ce qui vient d'entrer.
      const br = ((s.livre || {}).ecritures || []).filter(e => e.statut === 'brouillard').length;
      const suite = await compteRendu(creation ? `Le livre de ${s.annee} est créé` : `Le livre de ${s.annee} : paquets relus`, blocs.join(''), [
        { label: 'Voir le livre-journal', onglet: 'journal', primaire: !br },
        // Le libellé dit l'écran d'ARRIVÉE (7.29.0) : le geste ouvre la Saisie, où le brouillard se
        // relit et se valide — il ne valide rien lui-même.
        { label: br ? `Voir le brouillard (${br})` : 'Ouvrir la saisie', onglet: 'saisie', primaire: !!br }
      ]);
      if (suite && s.livre) allerSousOnglet(root, dossier, suite.onglet);
      else drawLivres(root, dossier);
    } catch (e) { await infoDialog('Impossible de relire les paquets', plainError(e)); }
  }

  // Reprendre un dossier venu d'ailleurs : exercice, plan, balance d'ouverture. L'écart s'affiche
  // EN DIRECT pendant la saisie — découvrir à l'enregistrement qu'il manque 3 000 DT sur vingt
  // lignes, c'est recommencer ; le voir descendre à zéro pendant qu'on tape, c'est travailler.
  function repriseForm(root, dossier) {
    const s = livresState;
    const annee = s.annee || String(new Date().getFullYear());
    let lignes = [{ compte: '', libelle: '', debit: '', credit: '' }];
    // Un montant de la reprise s'écrit comme l'écran (H-3), qu'il vienne d'un nombre (import) ou de la
    // frappe (une rangée relue) ; ce qui ne se lit pas garde sa frappe, pour être refusé en la montrant.
    const montantRepris = v => typeof v === 'number' ? montantChamp(v) : montantIllisible(v) ? String(v) : montantChamp(lireMontant(v));
    const ligneHtml = (l, i) => `<tr>
      <td><input name="c${i}" value="${esc(l.compte)}" class="num" style="width:7em" placeholder="411"></td>
      <td><input name="l${i}" value="${esc(l.libelle)}" placeholder="Clients"></td>
      <td><input name="d${i}" value="${esc(montantRepris(l.debit))}" class="num montant" inputmode="decimal" style="width:8em"></td>
      <td><input name="k${i}" value="${esc(montantRepris(l.credit))}" class="num montant" inputmode="decimal" style="width:8em"></td>
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
        <p id="rf-exo" class="annonce-stable span-3 muted" aria-live="polite"></p>
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
          // Une case qu'on ne sait pas lire ne compte pas pour ce qu'on devine : « 12a » valait 12,
          // et l'écart pouvait dire « Équilibrée » sur une ouverture que la garde refusera (10.14.1).
          const illisible = montantIllisibleDans(corps);
          if (illisible) {
            const lb = $('#rf-ecart', rootModal);
            lb.textContent = motifIllisible(illisible.value); lb.className = 'small err-inline';
            return;
          }
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
        // 10.14.1 — les rangées TELLES QU'À L'ÉCRAN, vides comprises : c'est sur elles que « Retirer »
        // compte son rang. « Retirer » retirait dans l'état d'avant la dernière frappe — les montants
        // corrigés depuis revenaient à leur ancienne valeur, et l'écart disait « Équilibrée » sur une
        // ouverture que personne n'avait voulue.
        const lireRangees = () => $$('tr', corps).map((tr, i) => {
          const v = n => (($(`input[name=${n}${i}]`, tr) || {}).value || '').trim();
          return { compte: v('c'), libelle: v('l'), debit: v('d'), credit: v('k') };
        });
        const redessine = () => {
          corps.innerHTML = lignes.map(ligneHtml).join('');
          $$('[data-sup]', corps).forEach(b => { b.onclick = () => { lignes = lireRangees(); lignes.splice(Number(b.dataset.sup), 1); if (!lignes.length) lignes = [{ compte: '', libelle: '', debit: '', credit: '' }]; redessine(); }; });
          corps.oninput = majEcart;
          majEcart();
        };
        redessine();
        // 10.14.1 (CA-01) — les deux dates SUIVENT l'année tant qu'on n'y a pas touché (règle 7.19.0) :
        // taper 2025 laissait « du 01/01/2026 au 31/12/2026 » sous les yeux. Et le verdict se lit
        // PENDANT la saisie, par la fonction du pont : un exercice décalé se refuse avant le clic.
        const fRf = $('#rf', rootModal);
        const champ = n => $(`input[name=${n}]`, fRf);
        let anneeVue = champ('annee').value.trim();
        const majExo = () => {
          const ex = KC.exerciceDeReprise(champ('annee').value, champ('du').value, champ('au').value);
          const lb = $('#rf-exo', rootModal);
          lb.textContent = ex.ok ? `Le livre ouvrira le ${KC.fmtJour(ex.du)} et finira le ${KC.fmtJour(ex.au)}. La balance d'ouverture ci-dessous est celle du ${KC.fmtJour(ex.du)}.` : ex.motif;
          lb.className = 'annonce-stable span-3 ' + (ex.ok ? 'muted' : 'err-inline');
        };
        champ('annee').addEventListener('input', () => {
          const a = champ('annee').value.trim();
          if (/^\d{4}$/.test(a) && /^\d{4}$/.test(anneeVue)) {
            if (champ('du').value === `${anneeVue}-01-01`) champ('du').value = `${a}-01-01`;
            if (champ('au').value === `${anneeVue}-12-31`) champ('au').value = `${a}-12-31`;
          }
          if (/^\d{4}$/.test(a)) anneeVue = a;
          majExo();
        });
        champ('du').addEventListener('input', majExo);
        champ('au').addEventListener('input', majExo);
        majExo();
        $('#rf-add', rootModal).onclick = () => { lignes = lireRangees().concat([{ compte: '', libelle: '', debit: '', credit: '' }]); redessine(); };
        $('#rf-csv', rootModal).onclick = async () => {
          try {
            const r = await api.importerBalance({ dossierId: dossier.id, annee: $('input[name=annee]', rootModal).value });
            if (r.annule) return;
            lignes = r.lignes.map(l => ({ compte: l.compte, libelle: l.libelle, debit: montantChamp(l.debit), credit: montantChamp(l.credit) }));
            redessine();
            if (r.ignorees.length) await infoDialog('Lignes ignorées', r.ignorees.map(x => `Ligne ${x.ligne} : ${x.motif}`).join('\n'));
          } catch (e) { await infoDialog('Import impossible', plainError(e)); }
        };
        $('#ok', rootModal).onclick = async () => {
          const f = $('#rf', rootModal);
          const v = { annee: $('input[name=annee]', f).value.trim(), du: $('input[name=du]', f).value, au: $('input[name=au]', f).value };
          // 10.14.1 (CA-01) — l'exercice se juge par la MÊME fonction que le pont, et le refus montre la
          // case (règle 7.20.0) : un exercice du 1er avril au 31 mars s'acceptait, et le suivant naissait
          // le 1er janvier d'après.
          const ex = KC.exerciceDeReprise(v.annee, v.du, v.au);
          // Le bandeau ne redit que la première phrase : la raison entière est déjà écrite dans la
          // fenêtre, sous les dates, et deux fois la même phrase de trois lignes ne se lit plus.
          if (!ex.ok) return refus($(`input[name=${ex.champ}]`, f), ex.motif.split('. ')[0].replace(/\.?$/, '.'));
          try {
            const r = await api.reprendre({ dossierId: dossier.id, annee: Number(v.annee), du: v.du, au: v.au, ouverture: lire(), source: 'balance' });
            s.annee = v.annee; s.livre = r.livre; s.livreEtat = 'ouvert'; s.livreCle = dossier.id + '|' + v.annee; livresConnus.set(dossier.id, true);
            exerciceConnu(v.annee);
            suivreExercice(dossier);
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
  // La licence se vérifie AVANT la question (10.14.0) : sans ça, le comptable confirmait « Valider
  // 3 526 écritures ? » pour lire ensuite que c'était impossible. Rend `true` si c'est refusé.
  async function refusLicence(quoi) {
    let v = null;
    try { v = await api.licenceVerifier(quoi); } catch (_) { return false; }
    if (v && v.ok === false) { await infoDialog('Validation impossible', plainError({ message: v.motif })); return true; }
    return false;
  }

  async function validerEcriture(root, dossier, e) {
    // Ce qu'on valide se NOMME (T-51). La fenêtre écrivait « AC — » sur une pièce sans référence ni
    // libellé : on lisait un tiret et on cliquait. Ce qui manque est écrit en toutes lettres — et la
    // référence n'est pas exigée pour autant (savoir si un cabinet l'impose est une règle
    // d'organisation que personne n'a confirmée, règle 9.1.1) : on la montre, et on laisse passer.
    if (await refusLicence('Valider une écriture')) return;
    const quoi = [esc(e.journal), e.piece ? esc(e.piece) : '<i>sans référence</i>'].filter(Boolean).join(' ');
    const ok = await confirmDialog('Valider cette écriture ?',
      `<p><b>${quoi}</b>${e.libelle ? ' — ' + esc(e.libelle) : ''}</p>
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

  // Ce qu'une écriture PORTE, dit dans la question AVANT le geste (10.12.0) : la supprimer ou la
  // contre-passer rend « à passer » la paie, la dotation, la déclaration ou l'inventaire qu'elle
  // portait. Une suppression nomme ce qu'elle casse (7.19.0) ; sans cette phrase, la paie d'août
  // redevenait « à passer » dans l'onglet voisin sans que personne sache pourquoi.
  // Le pronom suit le titre de la question : « Supprimer ce brouillard ? » appelle « ce qu'IL porte »,
  // « Contre-passer cette écriture ? » appelle « ce qu'ELLE porte ».
  function ceQuellePorte(e, pronom) {
    const q = KC.ceQuePorte(livresState.livre, e.id);
    if (!q.length) return '';
    const liste = q.length > 1 ? `${q.slice(0, -1).join(', ')} et ${q[q.length - 1]}` : q[0];
    return `<p>Ce qu'${pronom === 'il' ? 'il' : 'elle'} porte redeviendra « à passer » : <b>${esc(liste)}</b>.</p>`;
  }

  // Le jour où tombera le miroir, dit AVANT le geste, et par la fonction même qui le posera
  // (`KC.dateDuMiroir`) : aujourd'hui ; le dernier jour d'un exercice passé ; le 1er janvier pour des
  // à-nouveaux. Une phrase qui promettait « la date d'aujourd'hui » pendant que le miroir se posait
  // ailleurs mentirait sur le seul chiffre qu'elle annonce (10.14.0).
  function phraseMiroir(e, jour) {
    const L = livresState.livre || {};
    const dm = KC.dateDuMiroir(L, e, jour);
    const ex = L.exercice || {};
    if (e.source === 'an') {
      return `Une écriture miroir sera enregistrée <b>au ${esc(fmtJour(dm))}</b>, le jour des à-nouveaux : une ouverture
       ne se corrige qu'au jour où elle s'ouvre. Pour un simple écart avec la clôture de ${esc(String(Number(ex.annee) - 1))}, son
       onglet Exercice le pose en à-nouveaux complémentaires, sans rien contre-passer.`;
    }
    if (dm === jour) {
      return `Une écriture miroir sera enregistrée <b>à la date d'aujourd'hui</b> (${esc(fmtJour(jour))}),
       pas à celle de l'écriture d'origine : corriger aujourd'hui une écriture d'un mois déjà déclaré
       changerait ce mois-là sans que personne le voie. Les deux resteront dans le journal.`;
    }
    if (dm === ex.au) {
      return `Une écriture miroir sera enregistrée <b>au dernier jour de l'exercice</b> (${esc(fmtJour(dm))}) : l'exercice
       ${esc(String(ex.annee))} est terminé, et un miroir daté d'aujourd'hui tomberait hors de son livre. Les deux resteront dans le journal.`;
    }
    return `Une écriture miroir sera enregistrée <b>au ${esc(fmtJour(dm))}</b> : un miroir ne se date jamais hors de son
     exercice, ni avant l'écriture qu'il corrige. Les deux resteront dans le journal.`;
  }

  async function contrepasserEcriture(root, dossier, e) {
    if (await refusLicence('Contre-passer une écriture')) return;
    const jour = K.today();
    const ok = await confirmDialog('Contre-passer cette écriture ?',
      `<p><b>n° ${esc(String(e.numero))} — ${esc(e.journal)} ${esc(e.piece)}</b></p>
       ${ceQuellePorte(e, 'elle')}
       <p class="small muted">${phraseMiroir(e, jour)}</p>`, 'Contre-passer');
    if (!ok) return;
    try {
      const r = await api.contrepasser(dossier.id, livresState.annee, e.id, jour);
      livresState.livre = r.livre;
      drawLivres(root, dossier);
      toast(r.date && r.date !== jour ? `Contre-passée au ${fmtJour(r.date)}, sous le n° ${r.numero}` : `Contre-passée sous le n° ${r.numero}`);
    } catch (err) { await infoDialog('Contre-passation impossible', plainError(err)); }
  }

  // Les onglets qui n'existent QU'AVEC un livre. 10.10.0 (C-02) : la phrase qui les annonce en
  // nommait SEPT, écrits à la main en 9.8.8 ; il en arrivait DIX — Paie, Révision et Liasse, les
  // trois plus récents, et ceux qui font du Cabinet autre chose qu'un récepteur de paquets. La
  // phrase se DÉDUIT de cette liste, et un test confronte la liste aux boutons que la barre pose.
  // 10.12.0 (U-06) — quatorze sous-onglets sur deux rangées, rangés dans l'ordre où ils sont
  // arrivés version après version : « Liasse » et « Recherche » seuls sur la seconde, la Saisie à
  // côté de la Balance. Un comptable ne pense pas en quatorze écrans : il SAISIT, il CONSULTE, puis
  // il DÉCLARE ET CLÔTURE — c'est l'ordre de son mois, et celui des logiciels qu'il connaît. Trois
  // groupes, et le second niveau ne montre que les écrans du groupe ouvert. Une seule table : les
  // libellés, les groupes, la phrase « Créer le livre ouvre… » et la palette en dérivent.
  const ONGLETS_COMPTA = {
    saisie: 'Saisie', banque: 'Banque', paie: 'Paie', immobilisations: 'Immobilisations', inventaire: 'Inventaire',
    journal: 'Livre-journal', 'grand-livre': 'Grand livre', balance: 'Balance', lettrage: 'Lettrage', recherche: 'Recherche',
    declaration: 'Déclaration', revision: 'Révision', exercice: 'Exercice', liasse: 'Liasse'
  };
  const GROUPES_COMPTA = [
    { id: 'saisir', label: 'Saisir', onglets: ['saisie', 'banque', 'paie', 'immobilisations', 'inventaire'] },
    { id: 'consulter', label: 'Consulter', onglets: ['journal', 'grand-livre', 'balance', 'lettrage', 'recherche'] },
    { id: 'cloturer', label: 'Déclarer et clôturer', onglets: ['declaration', 'revision', 'exercice', 'liasse'] }
  ];
  // Les mots qu'un comptable TAPE pour trouver un écran, qui ne sont pas son libellé (U-07) :
  // « rapprochement » ne figure nulle part sur l'onglet Banque, « tva » nulle part sur Déclaration.
  // Une clé par écran de ONGLETS_COMPTA — un test confronte les deux tables, sinon un quinzième
  // écran naîtrait introuvable dans la palette.
  const MOTS_COMPTA = {
    saisie: 'saisir écriture écritures pièce brouillard grille guide',
    banque: 'relevé relevés rapprochement rapprocher bancaire suspens',
    paie: 'salaire salaires bulletin bulletins salarié salariés personnel cnss',
    immobilisations: 'immos immobilisation amortissement amortissements dotation dotations biens cession',
    inventaire: 'stock stocks variation',
    journal: 'journaux pièces',
    'grand-livre': 'comptes compte solde',
    balance: 'auxiliaire soldes',
    lettrage: 'lettrer impayés ouvertes échues',
    recherche: 'chercher montant',
    declaration: 'tva mensuelle retenue source timbre dépôt',
    revision: 'réviser cycles cycle questions questionnaire',
    exercice: 'clôture clôturer à-nouveaux nouveaux sig soldes intermédiaires résultat',
    liasse: 'fiscale états financiers bilan annuelle'
  };
  // Ce qui se lit SANS livre, dans les paquets reçus. Le reste n'existe qu'une fois le livre créé.
  const ONGLETS_SANS_LIVRE = ['journal', 'grand-livre', 'balance', 'lettrage'];
  const ONGLETS_DU_LIVRE = Object.keys(ONGLETS_COMPTA).filter(o => !ONGLETS_SANS_LIVRE.includes(o)).map(o => ONGLETS_COMPTA[o]);
  const groupeCompta = onglet => GROUPES_COMPTA.find(g => g.onglets.includes(onglet)) || GROUPES_COMPTA[1];
  const ongletDispo = o => !!ONGLETS_COMPTA[o] && (!!livresState.livre || ONGLETS_SANS_LIVRE.includes(o));

  // L'adresse d'un écran de comptabilité : `#/dossier/<id>/comptabilite/<sous-onglet>`. Le
  // sous-onglet vivait dans la mémoire de la page : « précédent » ne revenait pas dessus, et aucune
  // autre page — ni la palette — ne pouvait y mener. `pushState` ne déclenche pas de redessin : on
  // dessine soi-même, une fois.
  function adresseCompta(dossier, onglet) {
    // L'exercice regardé entre dans l'adresse (10.14.0) : « précédent » revient sur CET exercice.
    const annee = livresState.dossierId === dossier.id && /^\d{4}$/.test(String(livresState.annee)) ? '/' + livresState.annee : '';
    return '#/dossier/' + encodeURIComponent(dossier.id) + '/comptabilite/' + onglet + annee;
  }
  // L'adresse suit l'exercice affiché, sans nouvelle entrée d'historique : changer d'exercice n'est pas
  // changer de page. Seulement quand on est sur la comptabilité de CE dossier.
  function suivreExercice(dossier) {
    if (!location.hash.startsWith('#/dossier/' + encodeURIComponent(dossier.id) + '/comptabilite')) return;
    const h = adresseCompta(dossier, livresState.onglet || 'journal');
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  function allerSousOnglet(root, dossier, onglet) {
    const s = livresState;
    if (!ongletDispo(onglet)) onglet = 'journal';
    const change = s.onglet !== onglet;
    if (change) s.page = 1;
    s.onglet = onglet;
    const h = adresseCompta(dossier, onglet);
    if (location.hash !== h) history.pushState(null, '', h);
    drawLivres(root, dossier);
    // Un AUTRE écran commence par son haut, juste sous la barre collante (vu au test humain :
    // « Ouvrir la paie du mois », cliqué au bas de la déclaration, arrivait au milieu de la Paie,
    // sous les bulletins qu'on venait chercher). La barre reste collée « pour changer d'écran sans
    // remonter » ; la position de défilement de l'ancien écran, elle, ne dit rien du nouveau. On
    // remonte au point où la zone commence — jamais en haut de la fiche, et jamais on ne descend.
    if (change) {
      const vue = $('#view'), zone = $('#c-livres', root) || $('#c-livres');
      if (vue && zone) {
        const debut = zone.getBoundingClientRect().top - vue.getBoundingClientRect().top + vue.scrollTop;
        if (vue.scrollTop > debut) vue.scrollTop = Math.max(0, debut);
      }
    }
  }

  // La pastille d'un sous-onglet : « ce qui attend une décision », jamais un inventaire (T-10).
  function pastilleCompta(o) {
    const s = livresState;
    const L = s.livre;
    if (!L) return null;
    if (o === 'saisie') {
      const n = (L.ecritures || []).filter(e => e.statut === 'brouillard').length;
      return n && !(L.exercice && L.exercice.clos) ? { n, titre: `${n} en brouillard` } : null;
    }
    if (o === 'banque') {
      const n = (L.releves || []).reduce((a, r) => a + r.lignes.filter(l => !(l.rapprochement && l.rapprochement.ecritureId)).length, 0);
      return n ? { n, titre: `${n} ligne${n > 1 ? 's' : ''} de relevé sans réponse` } : null;
    }
    // Ce qui est DÛ, pas ce qui est possible : une dotation ne se réclame qu'au dernier mois de
    // l'exercice (10.12.0) — la même fonction décide du bouton vert de l'écran.
    if (o === 'immobilisations') {
      const n = (L.immobilisations || []).length ? KC.aReclamerImmobilisations(KC.etatImmobilisations(L, s.annee), L.exercice, K.today()) : 0;
      return n ? { n, titre: `${pl(n, 'écriture')} d'immobilisation à passer` } : null;
    }
    // La PAIE (10.3.0) : les mois dont l'écriture n'est pas passée, jamais le nombre de bulletins.
    if (o === 'paie') {
      const n = new Set((L.bulletins || []).filter(x => !x.ecritureId).map(x => x.mois)).size;
      return n ? { n, titre: `${n} mois dont l'écriture de paie n'est pas passée` } : null;
    }
    if (o === 'revision') {
      const n = (L.questions || []).filter(q => q.statut !== 'close' && q.statut !== 'repondue').length;
      return n ? { n, titre: `${n} question${n > 1 ? 's' : ''} en attente de réponse` } : null;
    }
    return null;
  }

  function drawLivres(root, dossier) {
    const s = livresState;
    const el = $('#c-livres', root);
    if (!el) return;
    if (!s.data) { el.innerHTML = '<div class="empty">Lecture des paquets…</div>'; return; }
    if (s.data.erreur) { el.innerHTML = `<div class="warn-box">${esc(s.data.erreur)}</div>`; return; }
    // Le livre se lit encore : on ne décide de rien. Sans cette garde, un sous-onglet venu de
    // l'adresse (« banque ») serait jugé indisponible le temps de la lecture et remplacé pour de bon
    // par le livre-journal.
    if (!s.livreEtat) { el.innerHTML = '<div class="empty">Lecture du livre…</div>'; return; }
    // Le mois regardé appartient à l'exercice regardé (10.14.0). L'exercice change par l'adresse, le
    // sélecteur, « Ouvrir N+1 » : « Un mois » gardait août 2026 dans le livre de 2025 — la liste
    // affichait « décembre 2025 » (8.3.0), l'écran « aucune écriture sur août 2026 ». Une seule
    // garde, ici, au lieu d'une par porte : c'est ce que chaque porte oubliait.
    if (s.mode === 'mois' && !String(s.mois || '').startsWith(String(s.annee) + '-')) s.mois = moisDeLaPeriode();
    majSelecteurExercice(root);
    // Aucun paquet, et pas encore de livre : le dossier se TIENT ici, à la main (C-07). Un client
    // hors SkanFact n'enverra jamais rien ; un client sur SkanFact qui n'a encore rien envoyé peut
    // aussi être repris. Le geste est le même : poser l'exercice et, s'il y en a une, sa balance
    // d'ouverture — vide pour un client qui commence.
    if (s.data.aucunPaquet && s.livreEtat === 'absent') {
      el.innerHTML = `<div class="info-box mb"><b>${dossier.manual
        ? 'Ce client n\'utilise pas SkanFact : sa comptabilité se tient ici, à la main.'
        : 'Aucun paquet reçu pour l\'instant.'}</b>
          Commence son livre de ${esc(s.annee)} : tu poses son exercice et, s'il en a une, sa balance d'ouverture
          (laisse-la vide pour un client qui démarre). S'ouvrent alors la <b>Saisie</b> et tous les onglets du livre.
          ${dossier.manual ? '' : 'Ses paquets, quand il en enverra, s\'y ajouteront d\'eux-mêmes.'}</div>
        <div class="modal-actions mb">
          <button class="btn btn-primary" id="lv-reprendre">Commencer le livre de ${esc(s.annee)}…</button>
          ${dossier.manual ? '' : '<button class="btn" id="lv-ecrire">Écrire au client</button>'}
        </div>`;
      const b = $('#lv-ecrire', el); if (b) b.onclick = () => writeRelance(K.dossierRow(dossier));
      const rp = $('#lv-reprendre', el); if (rp) rp.onclick = () => repriseForm(root, dossier);
      return;
    }
    if (s.data.aucunPaquet && !s.livre) {
      el.innerHTML = s.livreEtat === 'illisible' || s.livreEtat === 'version-inconnue' || s.livreEtat === 'erreur'
        ? `<div class="warn-box mb"><b>Le livre de ${esc(s.annee)} n'a pas pu être ouvert.</b> ${esc(s.livreMotif || '')} Tes sauvegardes sont dans les Réglages.</div>`
        : '<div class="empty">Lecture du livre…</div>';
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
          Créer le livre ouvre ${ONGLETS_DU_LIVRE.length} onglets de plus : <b>${ONGLETS_DU_LIVRE.slice(0, -1).map(esc).join(', ')}</b> et <b>${esc(ONGLETS_DU_LIVRE[ONGLETS_DU_LIVRE.length - 1])}</b>.</div>
        <div class="modal-actions mb">
          ${/* Sans points de suspension (U-27) : ils promettent une fenêtre qui demande quelque chose
                avant d'agir, et ce geste-là agit tout de suite — sûrement : il ne touche à aucune
                validée, et son compte rendu propose la suite. */''}
          <button class="btn btn-primary" id="lv-relire">Créer le livre à partir des paquets reçus</button>
          <button class="btn" id="lv-reprendre">Reprendre ce dossier (balance d'ouverture)…</button>
        </div>`
      : s.livreEtat === 'illisible' || s.livreEtat === 'version-inconnue' || s.livreEtat === 'erreur'
        ? `<div class="warn-box mb"><b>Le livre de ${esc(s.annee)} n'a pas pu être ouvert.</b> ${esc(s.livreMotif || '')}
           Les tableaux ci-dessous sont lus dans les paquets reçus. Tes sauvegardes sont dans les Réglages.</div>`
        : '';

    // Un écran qui n'existe qu'avec un livre (« Banque », « Saisie »…) se ramène au livre-journal
    // AVANT que quoi que ce soit ne le dessine. Depuis que le sous-onglet vit dans l'adresse (U-06),
    // « /comptabilite/banque » peut désigner un dossier qui n'a pas encore de livre : la garde vivait
    // plus bas, APRÈS le calcul de la vue, et `vueBanque` lisait `s.livre.releves` sur un livre
    // absent — TypeError, et la page restait sur « Lecture de la comptabilité… » pour toujours, sans
    // un mot. L'adresse est corrigée sans ajouter d'entrée à l'historique : elle ne doit pas
    // promettre un écran qu'on ne montre pas.
    if (!ongletDispo(s.onglet)) {
      s.onglet = 'journal';
      if (location.hash.startsWith('#/dossier/' + encodeURIComponent(dossier.id) + '/comptabilite/')) {
        history.replaceState(null, '', adresseCompta(dossier, 'journal'));
      }
    }

    const periode = lignesDeLaPeriode(dossier);
    const { lignes, illisibles, anciens, manquants, source } = periode;
    // Les vues et l'export lisent la MÊME période (lignes, ouverture, bornes) : recalculée dans
    // chacune, elle finirait par diverger (7.29.0).
    s.periode = periode;
    const avert = [];
    // « juin 2026 et juillet 2026 et août 2026 » : personne n'écrit ça. Le formateur des relances le
    // sait depuis la 1.0.0 (« juin, juillet et août 2026 », l'intervalle au-delà de trois mois).
    // Un dossier tenu AU CABINET (hors SkanFact) ne se voit rien réclamer (6.8.0) : ses mois vides
    // sont une saisie qui reste à faire, pas un paquet à relancer (vu au test humain, 10.12.0).
    const tenuAuCabinet = !!dossier.manual && source === 'livre';
    if (manquants.length) {
      avert.push(tenuAuCabinet
        ? `Aucune écriture sur ${K.missingLabel(manquants)} : ${manquants.length > 1 ? 'ces mois restent' : 'ce mois reste'} à saisir.`
        : `Il manque ${K.missingLabel(manquants)} : ces livres sont incomplets.`);
    }
    if (anciens.length) avert.push(`${anciens.length > 1 ? 'Des paquets viennent' : 'Un paquet vient'} d'une version d'avant la 8.8.0 : pas de numéro ni de tiers (${K.monthListLabel(anciens)}).`);
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
              : s.onglet === 'revision' ? vueRevision(dossier)
                : s.onglet === 'liasse' ? vueLiasse(dossier)
                  : s.onglet === 'inventaire' ? vueInventaire(dossier)
                  : s.onglet === 'paie' ? vuePaie(dossier)
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
    // 10.12.0 (U-01) — elle monte dans la barre de la période : un bandeau vert de 54 px pour dire
    // « Le livre de 2026 », plus un bandeau orange en dessous, c'étaient deux rangées de plus entre
    // l'onglet et la grille. Le brouillard non compté ne fait plus une phrase à part : il se lit sur
    // la case qui le montre (« 3 en brouillard, non comptées »).
    const nbBr = source === 'livre' ? (s.livre.ecritures || []).filter(e => e.statut === 'brouillard').length : 0;
    const etatLivre = source === 'livre'
      ? `<b>Le livre de ${esc(s.annee)}</b> ${info('lv.compta')}
        <span class="muted">${pl((s.livre.ecritures || []).filter(e => e.statut === 'validee').length, 'écriture validée', 'écritures validées')}</span>
        ${nbBr ? `<label class="check" title="Un brouillard n'est pas encore de la comptabilité : il n'entre dans les tableaux que si tu coches cette case."><input type="checkbox" id="lv-brouillard" ${s.brouillard ? 'checked' : ''}> Compter ${esc(pl(nbBr, 'écriture'))} en brouillard</label>` : ''}
        ${/* Un dossier qui ne reçoit aucun paquet n'a rien à relire : le bouton y était un geste sans objet. */''}
        ${(dossier.packs || []).length ? `<span class="nw"><button class="btn btn-sm" id="lv-relire2">Relire les paquets reçus</button>${info('lv.relire')}</span>` : ''}`
      : `<b>Lu dans les paquets reçus</b> ${info('lv.compta')}`;
    const barre = $('#c-livre-etat', root) || $('#c-livre-etat');
    if (barre) barre.innerHTML = etatLivre;

    // Les manques et les paquets anciens : sous la barre, seulement quand il y a quelque chose à
    // dire (U-13 — l'orange est réservé à ce qui demande un geste, et le geste est là). Pas sur les
    // écrans de SAISIE : « ces livres sont incomplets » parle de ce qu'on lit, et au-dessus de la
    // grille il repoussait les lignes qu'on tape sous la ligne de flottaison (U-01).
    const alerte = s.onglet && groupeCompta(s.onglet).id === 'saisir' ? [] : avert;
    const relancerManquants = !manquants.length ? ''
      : tenuAuCabinet
        ? '<div class="c-alerte-geste"><button type="button" class="btn btn-sm" id="lv-saisir">Ouvrir la saisie</button></div>'
        : '<div class="c-alerte-geste"><button type="button" class="btn btn-sm" id="lv-relancer">Relancer le client pour ces mois</button></div>';

    // Le second niveau ne montre que les écrans du groupe ouvert. Sans livre, un seul groupe existe
    // (les quatre vues lues dans les paquets) : on ne pose pas de premier niveau pour un seul choix.
    const gOuvert = groupeCompta(s.onglet);
    s.dernierParGroupe = s.dernierParGroupe || {};
    s.dernierParGroupe[gOuvert.id] = s.onglet;
    const groupes = GROUPES_COMPTA.filter(g => g.onglets.some(ongletDispo));
    const totalGroupe = g => g.onglets.reduce((a, o) => a + ((pastilleCompta(o) || {}).n || 0), 0);
    const boutonOnglet = o => {
      const p = pastilleCompta(o);
      return `<button type="button" role="tab" data-tab="${o}" class="${s.onglet === o ? 'active' : ''}" aria-selected="${s.onglet === o}">${esc(ONGLETS_COMPTA[o])}${
        o === 'saisie' ? pointSale(dossier.id) : ''}${
        p ? ` <span class="tab-n" title="${esc(p.titre)}">${esc(K.nbFr(p.n))}</span>` : ''}${
        o === 'exercice' && s.livre && s.livre.exercice && s.livre.exercice.clos ? ' <span class="badge b-paid">clos</span>' : ''}</button>`;
    };

    // L'alerte vit SOUS la barre des groupes, jamais au-dessus (H-6, trouvé en testant comme un
    // humain) : elle se tait sur « Saisir » (U-01) et parle sur « Consulter », donc posée au-dessus
    // elle faisait SAUTER la barre de 89 px d'un groupe à l'autre — le bouton qu'on vient de cliquer
    // partait sous le pointeur. Une barre de navigation ne bouge pas quand on s'en sert.
    const alerteHtml = alerte.length ? `<div class="warn-box mb c-alerte">${alerte.map(a => `<div>${esc(a)}</div>`).join('')}${relancerManquants}</div>` : '';
    el.innerHTML = `${sansLivre}
      ${/* Une pastille = « ce qui attend une décision », PARTOUT (T-10). Saisie compte les
            brouillards, Banque les lignes non rapprochées, Immobilisations les biens dont la
            dotation de l'exercice n'est pas passée — jamais le nombre de fiches, qui est un
            inventaire. « clos » n'est pas un compteur : c'est un badge. Et sur un exercice clos, la
            Saisie se tait : un compteur sur un écran qui refuse de traiter apprend à ignorer
            les pastilles, y compris celles qui disent vrai. Le groupe additionne celles de ses
            écrans : on voit où l'attention est demandée sans ouvrir chaque groupe. */''}
      <div class="c-nav">
        ${groupes.length > 1 ? `<div class="c-groupes" id="c-groupes" role="tablist" aria-label="Que fais-tu dans ce dossier ?">${groupes.map(g => {
          const n = totalGroupe(g);
          return `<button type="button" role="tab" data-groupe="${g.id}" class="${g.id === gOuvert.id ? 'active' : ''}" aria-selected="${g.id === gOuvert.id}">${esc(g.label)}${
            g.id === 'saisir' ? pointSale(dossier.id) : ''}${n ? ` <span class="tab-n">${esc(K.nbFr(n))}</span>` : ''}</button>`;
        }).join('')}</div>` : ''}
        <div class="tabs" id="c-tabs" role="tablist" aria-label="${esc(gOuvert.label)}">${gOuvert.onglets.filter(ongletDispo).map(boutonOnglet).join('')}</div>
      </div>${alerteHtml}${corps}`;

    // La barre des groupes COLLE en haut quand on descend (U-06). Tout ce qu'on amène à l'écran — un
    // raccourci vers un panneau, la zone d'une visite guidée — doit donc s'arrêter SOUS elle : amené
    // au bord du haut, l'en-tête d'un tableau finissait caché derrière (10.14.0, trouvé à la souris
    // pendant la visite, sur le livre-journal). La hauteur se mesure : la barre passe sur deux
    // rangées à 1280 px.
    const navCompta = $('.c-nav', el), vue = document.getElementById('view');
    if (navCompta && vue) {
      const poserHauteur = () => { if (navCompta.isConnected) vue.style.setProperty('--c-nav-h', navCompta.offsetHeight + 'px'); };
      poserHauteur();
      if (window.ResizeObserver) new ResizeObserver(poserHauteur).observe(navCompta);
    }
    $$('#c-tabs button', el).forEach(b => { b.onclick = () => allerSousOnglet(root, dossier, b.dataset.tab); });
    // Un groupe ouvre l'écran qu'on y avait laissé, sinon son premier : on revient là où on était.
    $$('#c-groupes button', el).forEach(b => {
      b.onclick = () => {
        const g = GROUPES_COMPTA.find(x => x.id === b.dataset.groupe);
        if (!g) return;
        const avant = (s.dernierParGroupe || {})[g.id];
        allerSousOnglet(root, dossier, ongletDispo(avant) && g.onglets.includes(avant) ? avant : g.onglets.find(ongletDispo));
      };
    });
    // La case du brouillard et « Relire » vivent dans la barre de la période, HORS de `el`.
    const cb = $('#lv-brouillard');
    if (cb) cb.onchange = () => { s.brouillard = cb.checked; drawLivres(root, dossier); };
    [$('#lv-relire', el), $('#lv-relire2')].forEach(b => { if (b) b.onclick = () => relireLesPaquets(root, dossier); });
    const rp = $('#lv-reprendre', el); if (rp) rp.onclick = () => repriseForm(root, dossier);
    // Le manque NOMMÉ porte son geste (7.15.0) : la relance part préremplie sur CES mois-là.
    const rm = $('#lv-relancer', el);
    if (rm) rm.onclick = () => {
      const r = K.dossierList(S).find(x => x.id === dossier.id);
      if (r) writeRelance({ ...r, missingMonths: manquants.slice() });
    };
    const sm = $('#lv-saisir', el);
    if (sm) sm.onclick = () => allerSousOnglet(root, dossier, 'saisie');
    // Une lecture ratée se retente par son bouton, jamais toute seule (`lectureRatee`).
    $$('[data-relire-ecran]', el).forEach(b => { b.onclick = () => { s[b.dataset.relireEcran] = null; drawLivres(root, dossier); }; });
    if (s.onglet === 'saisie') { brancherSaisie(el, root, dossier); dessinerAbonnements(el, dossier); }
    else if (s.onglet === 'recherche') brancherRecherche(el, root, dossier);
    else if (s.onglet === 'banque') brancherBanque(el, root, dossier);
    else if (s.onglet === 'declaration') brancherDeclaration(el, root, dossier);
    else if (s.onglet === 'immobilisations') brancherImmobilisations(el, root, dossier);
    else if (s.onglet === 'inventaire') brancherInventaire(el, root, dossier);
    else if (s.onglet === 'paie') brancherPaie(el, root, dossier);
    else if (s.onglet === 'exercice') brancherCloture(el, root, dossier);
    else if (s.onglet === 'revision') brancherRevision(el, root, dossier);
    else if (s.onglet === 'liasse') brancherLiasse(el, root, dossier);
    else brancherVue(el, root, dossier, lignes);
    // APRÈS le dessin, jamais pendant (7.27.0) : un `scrollIntoView` posé dans un gabarit est
    // effacé par le `innerHTML` qui suit.
    focaliser(el);
    signalerSaisies();
  }

  // Le livre-journal : une pièce par (date, journal, numéro), numérotée 1..n. Le filtre de journal
  // et la recherche portent sur la SÉLECTION ENTIÈRE — c'est elle que le pied totalise, jamais ce
  // qui est affiché (règle des listes depuis la 2.2.0, côté entreprise).
  // Le badge d'un miroir : ce qu'il annule, et le numéro de l'origine. Partagé par le journal et le
  // grand livre — au grand livre, les deux lignes d'une correction étaient strictement indiscernables.
  // Il passe SOUS la référence quand la place manque (10.12.0, vu au test humain) : posé dans une
  // cellule qui interdit le retour à la ligne, « contre-passation ↩ n° 65 » élargissait la colonne
  // Pièce à 259 px, et la colonne d'actions collante recouvrait le Crédit. La référence, elle, ne se
  // coupe jamais — ses tirets sont des points de coupure pour le navigateur.
  const miroirBadge = e => e.contrepasseDe
    ? ` <span class="badge" title="${esc(e.libellePiece || '')}">contre-passation${e.origineNumero ? ` ↩ n° ${esc(String(e.origineNumero))}` : ''}</span>`
    : e.extourneDe
      ? ` <span class="badge" title="${esc(e.libellePiece || '')}">extourne${e.origineNumero ? ` ↩ n° ${esc(String(e.origineNumero))}` : ''}</span>`
      : '';

  // Le 📎 d'une pièce (10.14.1, S-04) : le justificatif que le CABINET a joint (`pieceJointe`,
  // 9.3.0) et ceux du CLIENT, arrivés dans son paquet avec la pièce qu'ils prouvent. Skander : « c'est
  // grâce à ça qu'on prouve tout ». UNE forme pour le livre-journal, le grand livre et la recherche —
  // la recherche posait un 📎 à la main qui ne disait que la moitié (le fichier du cabinet), et le
  // journal n'en montrait aucun.
  const justifsDuClient = e => K.justificatifsDeLigne((livresState.data && livresState.data.paquets) || [], e);
  function marqueJustif(e, pieceJointe) {
    const noms = [];
    if (pieceJointe) noms.push(`${String(pieceJointe).split(/[\\/]/).pop()} (joint au cabinet)`);
    justifsDuClient(e).forEach(j => noms.push(`${j.nom} (joint par le client)`));
    if (!noms.length) return '';
    const dit = `${pl(noms.length, 'justificatif')} : ${noms.join(', ')}`;
    return ` <span class="att-mark" role="img" aria-label="${esc(dit)}" title="${esc(dit)}">📎</span>`;
  }
  // Le fichier du client s'ouvre DANS le paquet, comme n'importe quelle pièce du paquet : extrait en
  // lecture, jamais lancé s'il n'est pas un document (6.8.1). Un paquet protégé demande son mot de passe.
  // Ce que le processus principal rend quand un fichier ne s'ouvre pas, dit en français avec son nom :
  // un fichier qui n'est pas un document n'est jamais lancé (sa raison vient du pont), et un document
  // qu'aucun programme de l'ordinateur n'ouvre est montré dans son dossier (`ouvrirOuMontrer`, main.js).
  // Sans cette phrase, le clic était accepté et rien ne s'ouvrait. Rien quand tout va bien.
  function ditOuverture(r, nom) {
    if (!r || (r.opened !== false && r.ouvert !== false)) return;
    if (r.reason) return toast(r.reason, 'error');
    if (r.absent) return toast(`« ${nom} » n'est plus sur le disque : il a peut-être été déplacé ou supprimé.`, 'error');
    if (r.sansProgramme) toast(`Aucun programme de cet ordinateur n'ouvre « ${nom} » : SkanFact le montre dans ${EXPLORATEUR()}, ouvre-le avec le programme de ton choix.`, 'error');
  }
  async function ouvrirJustifClient(j) {
    const ouvrir = async password => {
      ditOuverture(await api.openInPack(j.path, j.chemin, password), j.nom);
    };
    try { await ouvrir(); } catch (e) {
      const msg = plainError(e);
      if (!/mot de passe|déchiffr|authenticate/i.test(msg)) return toast(/absent/i.test(msg) ? `« ${j.nom} » n'est plus dans le paquet ${K.de(moisLabelCourt(j.month))}.` : msg, 'error');
      const password = await askPassword('Paquet protégé', 'Ce paquet est scellé par un mot de passe.');
      if (!password) return;
      try { await ouvrir(password); } catch (e2) { toast(plainError(e2), 'error'); }
    }
  }
  // Les gestes d'ouverture d'une pièce : un par justificatif du client (trois au plus, le paquet
  // montre le reste). Rangés par la table d'actions de l'écriture ET par celle d'une ligne de paquet.
  function actionsJustifsClient(e) {
    const l = justifsDuClient(e);
    return l.slice(0, 3).map(j => ({ icon: 'ouvrir', label: l.length > 1 ? `Ouvrir « ${j.nom} »` : 'Ouvrir le justificatif du client',
      court: 'Justificatif', hint: `${j.nom} — joint par le client, dans son paquet ${K.de(moisLabelCourt(j.month))}`, run: () => ouvrirJustifClient(j) }));
  }

  function vueJournal(lignes) {
    const s = livresState;
    const journaux = [...new Set(lignes.map(l => l.journal).filter(Boolean))].sort();
    const q = s.q.trim().toLowerCase();
    // La recherche garde des PIÈCES, jamais des lignes (10.12.0, vu au test humain) : une pièce dont
    // une seule ligne correspond sortait coupée, un débit sans son crédit — et l'écran annonçait
    // « 24 pièces déséquilibrées » en rouge sur un livre parfaitement juste. C'est la raison même de
    // la pagination par pièce (9.4.5), qu'un filtre ne doit pas défaire.
    const duJournal = lignes.filter(l => !s.journal || l.journal === s.journal);
    const trouvees = q
      ? new Set(duJournal.filter(l => `${l.piece} ${l.tiers} ${l.label} ${l.account}`.toLowerCase().includes(q)).map(KC.cleDePiece))
      : null;
    const gardees = trouvees ? duJournal.filter(l => trouvees.has(KC.cleDePiece(l))) : duJournal;
    // Le numéro d'une pièce se lit sur la PÉRIODE ENTIÈRE, jamais sur ce que le filtre garde : un
    // numéro qui change quand on cherche la pièce n'est plus un numéro (INVENTAIRE-2025 passait
    // « n° 1 » dans une recherche). Le livre et les paquets récents portent le leur ; seul un vieux
    // paquet se recompte, et il se recompte sur tout ce qu'on lit.
    const tout = KC.journalDepuisLignes(lignes);
    const numeroDe = new Map(tout.pieces.map(p => [p.key, p.numero]));
    const lj = KC.journalDepuisLignes(gardees);
    lj.pieces.forEach(p => { if (numeroDe.has(p.key)) p.numero = numeroDe.get(p.key); });
    const cz = KC.centralisateurDepuisLignes(gardees);
    // On pagine les PIÈCES, jamais les lignes : une pièce coupée en deux montrerait un débit sans
    // son crédit, et le lecteur conclurait à un déséquilibre qui n'existe pas. Le pied, lui, porte
    // sur la sélection entière (`lj.debit` / `lj.credit`) — règle des listes depuis la 2.2.0.
    // `pagerBar` est appelé AVANT `paginate` : c'est lui qui ramène `s.page` dans les bornes quand
    // un filtre vient de réduire la sélection. L'inverse afficherait une page vide, puis la bonne
    // au redessin suivant — c'est-à-dire un tableau qui paraît vide sans raison.
    pagerBar(lj.pieces.length, s, 'pièce');   // appelé pour son EFFET (borner s.page) ; la barre se dessine plus bas
    const plates = [];
    paginate(lj.pieces, s).forEach(p => p.lignes.forEach((e, i) => plates.push({ ...e, numero: p.numero, premiere: i === 0 })));
    return `${barreLivres(`<select id="lv-journal" aria-label="Filtrer par journal"><option value="">Tous les journaux</option>${journaux.map(j => `<option value="${esc(j)}" ${s.journal === j ? 'selected' : ''}>${esc(j)}</option>`).join('')}</select>
      <span class="champ-loupe"><input type="search" id="lv-q" placeholder="Pièce, tiers, libellé…" value="${esc(s.q)}"></span>`, 'Exporter le livre-journal')}
      <div class="muted small mb">${pl(lj.pieces.length, 'pièce')} · ${pl(gardees.length, 'ligne')}${tout.numeros === 'recomptes' && tout.pieces.length ? ' · <span title="Les paquets lus ne portent pas le numéro de pièce du client (paquets d\'avant la 10.12.0), ou deux paquets donnent le même numéro à deux pièces : elles sont numérotées ici, dans l\'ordre des dates.">numérotées ici, pas chez le client</span>' : ''}${lj.off.length ? ` · <span class="err-inline">${pl(lj.off.length, 'pièce')} déséquilibrée${lj.off.length > 1 ? 's' : ''}</span>` : ''}</div>
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
        <td>${e.premiere ? `<span class="nw">${esc(e.piece)}</span>${marqueJustif(e, e.ecritureId && s.livre ? (ecritureDuLivre(s.livre, e.ecritureId) || {}).pieceJointe : '')}${miroirBadge(e)}` : ''}</td>
        <td class="nw">${esc(e.account)}</td>
        <td class="tronq" title="${esc(e.tiers)}">${esc(e.tiers)}</td>
        <td class="tronq lg" title="${esc(e.label)}">${esc(e.label)}</td>
        <td class="r nw">${e.debit ? esc(money(e.debit, e.currency)) : ''}</td>
        <td class="r nw">${e.credit ? esc(money(e.credit, e.currency)) : ''}</td>
        ${e.premiere ? rowMenuCell(e.ecritureId ? 'E:' + e.ecritureId : [e.piece, e.mois || '', e.journal || '', e.date || ''].join('|')) : '<td class="row-actions"></td>'}</tr>`).join('')}</tbody>
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
      ${paginate(gl.comptes, s).map(c => `<details class="panel mt gl-compte" data-gl="${esc(c.account)}" ${s.compte || gl.comptes.length === 1 || glOuverts().has(c.account) ? 'open' : ''}>
        <summary class="gl-tete"><span class="gl-nom">${esc(c.account)}${c.label ? ' — ' + esc(c.label) : ''}</span>
          <span class="gl-chiffres"><span class="muted gl-mv">${pl(c.lignes.length, 'mouvement')}${c.ouverture ? ` · ouverture ${esc(money(c.ouverture))}` : ''}</span>
            <span class="gl-m">D ${esc(money(c.debit))}</span><span class="gl-m">C ${esc(money(c.credit))}</span>
            <strong class="gl-m gl-solde">Solde ${esc(money(c.solde))}</strong></span></summary>
        <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Date</th><th class="nw">Pièce</th><th>Libellé</th>
          <th class="r nw">Débit</th><th class="r nw">Crédit</th><th class="r nw">Solde</th></tr></thead>
        <tbody>${lignesAffichees(c).map(e => `<tr class="${e.statut === 'contrepassee' ? 'cp-ligne' : e.contrepasseDe || e.extourneDe ? 'cp-miroir' : ''}"><td class="nw">${esc(fmtJour(e.date))}</td><td><span class="nw">${esc(e.piece)}</span>${marqueJustif(e, e.ecritureId && s.livre ? (ecritureDuLivre(s.livre, e.ecritureId) || {}).pieceJointe : '')}${miroirBadge(e)}</td>
          <td class="tronq lg" title="${esc(e.label)}">${esc(e.label)}</td>
          <td class="r nw">${e.debit ? esc(money(e.debit)) : ''}</td><td class="r nw">${e.credit ? esc(money(e.credit)) : ''}</td>
          <td class="r nw">${esc(money(e.solde))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3"><strong>${pl(c.lignes.length, 'mouvement')}</strong></td>
          <td class="r nw"><strong>${esc(money(c.debit))}</strong></td><td class="r nw"><strong>${esc(money(c.credit))}</strong></td>
          <td class="r nw"><strong>${esc(money(c.solde))}</strong></td></tr></tfoot></table></div>${suiteDuCompte(c)}</details>`).join('')}`;
  }

  // Saturation (10.14.0) — un compte déplié affichait TOUTES ses lignes : le 411 d'un livre de
  // douze mille pièces en porte huit mille, et le déplier construisait huit mille rangées d'un coup.
  // On montre les premières, puis la suite à la demande ; le PIED garde les totaux du compte entier
  // (un pied porte la sélection entière, jamais la page, 2.2.0), et la phrase dit où est le reste —
  // y compris avant d'imprimer, puisqu'une rangée absente de l'écran ne s'imprime pas.
  const GL_PLAFOND = 300;
  function glOuverts() { return livresState.glOuverts || (livresState.glOuverts = new Set()); }
  function glLimite(compte) { return (livresState.glLimites || {})[compte] || GL_PLAFOND; }
  function lignesAffichees(c) { return c.lignes.length > glLimite(c.account) ? c.lignes.slice(0, glLimite(c.account)) : c.lignes; }
  function suiteDuCompte(c) {
    const reste = c.lignes.length - glLimite(c.account);
    if (reste <= 0) return '';
    const pas = Math.min(reste, GL_PLAFOND);
    return `<div class="gl-suite"><span class="small muted">${pl(glLimite(c.account), 'ligne affichée', 'lignes affichées')} sur ${esc(String(c.lignes.length).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f'))} — le pied porte le compte entier ; l'export du grand livre contient toutes les lignes, et « Tout montrer » les met à l'écran avant d'imprimer.</span>
      <button class="btn btn-sm" data-gl-plus="${esc(c.account)}" data-gl-n="${pas}">Montrer ${pl(pas, 'ligne de plus', 'lignes de plus')}</button>
      ${reste > GL_PLAFOND ? `<button class="btn btn-sm" data-gl-plus="${esc(c.account)}" data-gl-n="${reste}">Tout montrer</button>` : ''}</div>`;
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
      const reprisMap = KC.soldesRepris(s.livre);
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
    // Avec l'ouverture, la balance a HUIT colonnes : six en-têtes numériques tenus sur une ligne
    // (« MOUVEMENTS CRÉDIT », 164 px pour des montants de 100) serraient l'intitulé sur trois lignes et
    // coupaient « Solde créditeur » au bord de l'écran (10.14.0). Ils passent alors sur deux lignes :
    // c'est la largeur des MONTANTS qui décide de la colonne, pas celle de son titre.
    const thN = avecOuv ? 'r' : 'r nw';
    const colOuv = avecOuv ? `<th class="${thN}">Ouverture débit</th><th class="${thN}">Ouverture crédit</th>` : '';
    return `${barreLivres(commandes, 'Exporter la balance')}
      ${s.aux ? '' : `<div class="muted small mb">${phraseOuverture()}</div>`}
      ${verdict}
      ${pager}
      <div class="scroll-x"><table class="list compact"><thead><tr>
        <th class="nw">${s.aux ? 'Tiers' : 'Compte'}</th><th>${s.aux ? 'Comptes' : 'Intitulé'}</th>${colOuv}
        <th class="${thN}">Mouvements débit</th><th class="${thN}">Mouvements crédit</th>
        <th class="${thN}">Solde débiteur</th><th class="${thN}">Solde créditeur</th></tr></thead>
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
      ${/* 10.14.0 (saturation) — un tiers REPLIÉ sur sa ligne, comme un compte du grand livre
            (9.4.5) : vingt-cinq clients de soixante-dix pièces ouvertes chacun faisaient 77 000 px.
            La ligne repliée porte ce qu'on vient chercher — combien de pièces, combien reste dû —
            et une page de trois tiers au plus s'ouvre d'elle-même. */''}
      ${(page => page.map(r => `<details class="panel mt gl-compte lt-tiers"${page.length <= 3 ? ' open' : ''}>
        <summary class="gl-tete"><span class="gl-nom">${esc(r.tiers)} <span class="muted small">${esc(r.account)}</span></span>
          <span class="gl-chiffres"><span class="muted gl-mv">${pl(r.ouverts.length, 'pièce ouverte', 'pièces ouvertes')}</span>
            <strong class="gl-m gl-solde">Reste ${esc(money(r.reste))}</strong></span></summary>
        <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Pièce</th><th class="nw">Date</th>
          <th class="r nw">Débit</th><th class="r nw">Crédit</th><th class="r nw">Reste</th><th></th></tr></thead>
        <tbody>${r.ouverts.map(o => `<tr>
          <td class="nw">${esc(o.piece)}${o.retard ? ' <span class="badge b-late">en retard</span>' : ''}</td>
          <td class="nw">${esc(fmtJour(o.date))}</td>
          <td class="r nw">${o.debit ? esc(money(o.debit)) : ''}</td><td class="r nw">${o.credit ? esc(money(o.credit)) : ''}</td>
          <td class="r nw">${esc(money(o.reste))}</td>${rowMenuCell(o.ecritureId ? 'E:' + o.ecritureId : o.piece + '|' + (o.mois || ''))}</tr>`).join('')}</tbody></table></div></details>`).join(''))(paginate(ouverts, s))}
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

  // Les noms des cases vivent dans le moteur (10.14.0) : c'est lui qui les cite quand il refuse de
  // pointer un dépôt sur des chiffres périmés. Deux tables divergeraient (6.8.0).
  const LIBELLE_CASE = KC.LIBELLES_CASES_DECL;
  const ORDRE_CASES = ['tvaCollectee', 'tvaDeductible', 'creditReporte', 'netAPayer', 'creditAReporter',
    'timbre', 'retenuesOperees', 'irpp', 'aDecaisser', 'retenuesSubies', 'tfp', 'foprolos', 'tcl', 'acomptes'];

  // 10.14.1 (D1) — ce qui ôte la ressaisie SANS rien déposer : le comptable recopie les cases sur le
  // portail, alors un clic COPIE le montant sous la forme que le portail accepte (réglable : aucun
  // cahier ne se lit d'ici, À VÉRIFIER), et la date limite se lit sur l'écran où l'on déclare, par
  // la MÊME règle que le calendrier des Échéances. Le lien ouvre le navigateur : rien ne part d'ici.
  const ICONE_COPIE = '<svg class="dc-copie-i" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5"/></svg>';
  const formatCopie = () => ((S && S.settings) || {}).formatCopie || 'point';
  function boutonCopie(cle, montant, libelle) {
    const txt = K.montantPortail(montant, formatCopie());
    return `<button type="button" class="btn btn-sm dc-copie" data-copier="${esc(cle)}" data-libelle="${esc(libelle || '')}" data-valeur="${esc(txt)}"
      title="Copier « ${esc(txt)} » pour le coller sur le portail" aria-label="Copier ${esc(money(montant))}">${esc(money(montant))}${ICONE_COPIE}</button>`;
  }
  function reglageCopie() {
    return `<div class="dc-copie-regle"><span class="small muted">Un clic sur un montant le copie pour le portail, écrit</span>
      <select id="dc-format" aria-label="La forme d'un montant copié">${K.FORMATS_COPIE.map(f =>
        `<option value="${f.id}" ${f.id === formatCopie() ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select>${info('dc.format')}</div>`;
  }
  function ligneEcheanceDeclaration(dossier, periode, deposeeLe, sorte) {
    sorte = sorte || 'tva';
    const limite = K.dateLimiteDeclaration(S, periode, sorte, dossier);
    const portail = K.PORTAILS[sorte === 'cnss' ? 'cnss' : 'ejibaya'];
    const lien = `<a class="btn btn-sm btn-ghost" id="dc-portail" href="${esc(portail.url)}" target="_blank" rel="noopener">Ouvrir ${esc(portail.label)} ↗</a>`;
    const retard = !deposeeLe && limite < K.today();
    const phrase = deposeeLe ? `Déposée le ${esc(fmtJour(deposeeLe))} — la date limite était le ${esc(fmtJour(limite))}.`
      : retard ? `<b>Date limite dépassée</b> : c'était le ${esc(fmtJour(limite))}.`
        : `À déposer au plus tard le <b>${esc(fmtJour(limite))}</b>.`;
    return `<div class="dc-echeance${retard ? ' retard' : ''}"><span>${phrase}</span>${lien}${info('dc.portail')}</div>`;
  }
  async function copierPourPortail(b, libelle) {
    const txt = b.dataset.valeur || '';
    try {
      await navigator.clipboard.writeText(txt);
      toast(`Copié : ${txt} — colle-le dans la case « ${libelle} » du portail.`);
    } catch (_) { toast('La copie n\'a pas pu se faire : sélectionne le montant et copie-le à la main.', 'error'); }
  }

  // 10.14.1 (D1bis) — les cases, dans l'ORDRE du formulaire officiel (déclaration mensuelle des
  // impôts, imprimé 2026) : ses rubriques, ses numéros de ligne, son récapitulatif. Un montant copié
  // doit tomber sur une case du portail ; rangé dans l'ordre du moteur, il fallait le chercher. Le
  // rangement se fait au processus principal (`formulaireMensuel`) : l'écran ne recalcule rien.
  const tauxFr = t => (t == null ? '' : `${String(t).replace('.', ',')} %`);
  function celluleOrigine(l, etat) {
    // Plusieurs lignes attendent la MÊME étape (la paie du mois) : le bouton se pose une fois, sur la
    // première ; les suivantes y renvoient (9.4.6).
    if (l.montant == null) {
      if (l.attente === 'paie') {
        if (etat.paieDite) return '<span class="muted small">attend la paie</span>';
        etat.paieDite = l.libelle;
        return '<button type="button" class="btn btn-sm btn-ghost" data-vers-paie>Ouvrir la paie du mois</button>';
      }
      return '<span class="muted small">à vérifier</span>';
    }
    const c = l.source && livresState.decl.cases[l.source];
    const n = c ? (c.ecritures || []).length : 0;
    return n ? `<button type="button" class="btn btn-sm btn-ghost" data-cases="${esc(l.source)}" aria-expanded="${declState.ouverte === l.source ? 'true' : 'false'}">${esc(pl(n, 'écriture'))} ${declState.ouverte === l.source ? '▴' : '▾'}</button>`
      : '<span class="muted small">calculé</span>';
  }
  function ligneFormulaire(l, etat, classe) {
    const raison = l.montant == null ? l.motif : l.note;
    return `<tr class="${classe || ''}">
      <td>${l.ref ? `<span class="dc-ref">${esc(l.ref)}</span> ` : ''}${esc(l.libelle)}${raison ? `<div class="small muted dc-raison">${esc(raison)}</div>` : ''}</td>
      <td class="r nw">${l.base == null ? '' : boutonCopie('base-' + l.cle, l.base, `base — ${l.libelle}`)}</td>
      <td class="r nw">${esc(tauxFr(l.taux))}</td>
      <td class="r nw">${l.montant == null ? '<span class="muted">—</span>' : boutonCopie(l.cle, l.montant, l.libelle)}</td>
      <td class="nw">${celluleOrigine(l, etat)}</td></tr>`;
  }
  function panneauFormulaire(d) {
    const f = d.formulaire;
    if (!f) return '';
    const etat = { paieDite: '' };
    const rubriques = f.rubriques.map((r, i) => `<tr class="dc-rub"><th colspan="5">${i + 1}. ${esc(r.titre)}
        <span class="dc-ar" lang="ar" dir="rtl">${esc(r.ar)}</span></th></tr>
      ${r.lignes.map(l => ligneFormulaire(l, etat)).join('')}`).join('');
    const recap = f.recap.map(x => `<tr><td>${esc(x.libelle)}</td><td></td><td></td>
      <td class="r nw">${x.montant == null ? '<span class="muted">—</span>' : boutonCopie('recap-' + x.cle, x.montant, `${x.libelle} (récapitulatif)`)}</td><td></td></tr>`).join('');
    // Ce qui n'entre pas dans le total le DIT, sur la ligne du total (9.4.5, 9.8.8).
    const sans = f.manquent.length ? `Sans ${f.manquent.map(x => (/^\p{Lu}\p{Ll}/u.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join(', ')} : ${f.manquent.length > 1 ? 'leurs montants ne se savent' : 'son montant ne se sait'} pas ici.` : '';
    return `<div class="panel mt" id="dc-formulaire"><h2>Le formulaire du mois ${info('dc.cases')}</h2>
      <p class="small muted">Dans l'ordre de la déclaration mensuelle des impôts (imprimé 2026) : chaque montant tombe sur une case du portail.</p>
      ${reglageCopie()}
      <div class="scroll-x"><table class="list compact dc-form"><thead><tr>
        <th>Case du formulaire</th><th class="r nw">Base</th><th class="r nw">Taux</th><th class="r nw">Montant</th><th class="nw">D'où ça vient</th></tr></thead>
      <tbody>${rubriques}
        <tr class="dc-rub"><th colspan="5">Récapitulatif : ce qui se paie <span class="dc-ar" lang="ar" dir="rtl">خلاصة الأداءات والمعاليم الواجب دفعها</span></th></tr>
        ${recap}
        <tr class="dc-total"><td>Total de la déclaration${sans ? `<div class="small muted dc-raison">${esc(sans)}</div>` : ''}${f.aDecaisser != null ? `<div class="small muted dc-raison">Dont ${esc(money(f.aDecaisser))} portés au compte ${esc(d.comptes.aPayer)} par l'écriture du mois (TVA, timbre, retenues opérées) ; le reste se verse depuis les comptes de la paie.</div>` : ''}</td>
          <td></td><td></td><td class="r nw">${boutonCopie('total', f.total, 'Total de la déclaration')}</td><td></td></tr>
        <tr class="dc-rub"><th colspan="5">Hors de ce formulaire</th></tr>
        ${f.horsFormulaire.map(l => ligneFormulaire(l, etat)).join('')}
      </tbody></table></div>
      ${d.parTaux
        ? `<h3 class="sub-h">TVA collectée par taux</h3><table class="list compact"><tbody>${d.parTaux.map(x =>
            `<tr><td>${esc(x.compte)}</td><td class="r nw">${esc(money(x.montant))}</td></tr>`).join('')}</tbody></table>`
        : ''}
    </div>`;
  }

  function vueDeclaration(dossier) {
    const s = livresState;
    const d = s.decl;
    const tous = MOIS_COURTS.map((m, i) => `${s.annee}-${String(i + 1).padStart(2, '0')}`);
    if (!d) return `<div class="empty mini">Lecture de la déclaration…</div>`;
    if (d.erreur) return lectureRatee(d.erreur, 'decl');
    const posee = d.posee;
    const etat = KC.etatDuMois(s.livre, d.periode, { recu: (dossier.months || []).includes(d.periode) });
    // L'écriture de déclaration déjà passée — la nôtre, ou celle que le client avait déjà dans ses
    // propres livres. C'est elle qui éteint le bouton : la repasser compterait la TVA deux fois.
    const ecrite = !!d.ecritureExistante;
    // Au BROUILLARD, elle existe (un second clic en fabriquerait une seconde) mais n'est pas encore
    // un fait : le bouton le dit, et nomme ce qui reste — la valider dans la Saisie.
    // 10.14.0 — l'écriture du mois OU son complément : celle qui attend est celle que le moteur nomme.
    const auBrouillard = ecrite && !!d.ecritureAuBrouillard;
    const complementAuBrouillard = auBrouillard && d.ecritureAuBrouillard !== d.ecritureExistante;
    const echecs = (d.controles || []).filter(c => !c.ok);
    const deposee = !!(posee && posee.deposee && posee.deposee.le), payee = !!(posee && posee.payee && posee.payee.le);
    // 10.12.0 (U-11) — UN seul bouton principal, et c'est l'ÉTAPE SUIVANTE. « Préparer la
    // déclaration » vivait deux fois (en haut, neutre ; en bas, en vert), et une fois préparée, plus
    // rien ne disait ce qui venait après. Les quatre gestes du mois se lisent maintenant dans leur
    // ordre, en haut, et le vert suit le travail : préparer, écrire, déposer, payer.
    // 10.14.0 — une pièce saisie APRÈS l'écriture du mois : elle ne couvre plus le mois, et ce qui
    // manque se pose en complément. Une pièce saisie après la PRÉPARATION : les chiffres préparés ne
    // sont plus ceux qu'on recopie, et un dépôt pointé les figerait. Les deux se lisent dans le moteur.
    const aCompleter = ecrite && (d.complement || []).length > 0;
    const ecart = d.ecart || [];
    const perime = !!(posee && ecart.length);
    const suivante = !posee || (perime && !deposee) ? 'preparer' : (!ecrite || aCompleter) ? 'ecriture' : !deposee ? 'deposee' : !payee ? 'payee' : '';
    const motifPerime = perime && !deposee ? `Les chiffres ont changé depuis la préparation (${KC.phraseEcartDeclaration(ecart)}) : recalcule-la avant de la déposer.` : '';
    const cls = pas => 'btn btn-sm' + (pas === suivante ? ' btn-primary' : '');
    const fait = ok => ok ? '<span class="dc-coche" aria-hidden="true">✓</span>' : '';
    // La flèche est DESSINÉE : le caractère « → » se posait sous la ligne des boutons, sa hauteur
    // venant de la police et pas de la rangée.
    const fleche = '<svg class="dc-fleche" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"/></svg>';
    // Un bouton éteint dit POURQUOI, en gris et AU-DESSUS des boutons (T-17, règles 9.4.5 et
    // 9.4.2) — et une seule phrase, celle de l'étape qui bloque, pas quatre.
    // Une étape FAITE se dit sur son bouton (« ✓ Écriture du mois passée ») ; la phrase n'explique
    // que celles qui ATTENDENT — la première version redisait l'écriture faite et taisait le
    // paiement, qui était pourtant le seul bouton éteint.
    const motif = motifPerime || (!posee ? (ecrite ? 'Les deux pense-bêtes attendent la déclaration : prépare-la d\'abord.'
      : 'Les trois étapes suivantes attendent la déclaration : prépare-la d\'abord.')
      : !deposee && !payee ? '« Marquer payée » attend le dépôt : on ne paie pas ce qu\'on n\'a pas déposé.' : '');
    return `<div class="filters">
      <label class="f-lab">Mois<select id="dc-mois" aria-label="Le mois à déclarer">${tous.map((m, i) =>
        `<option value="${m}" ${m === d.periode ? 'selected' : ''}>${MOIS_COURTS[i]} ${esc(s.annee)}</option>`).join('')}</select></label>
      ${info('dc.etat')}
      <span class="small muted">État</span>
      <span class="badge ${etat.etat === 'payé' ? 'b-paid' : etat.etat === 'déclaré' ? 'b-part' : etat.etat === 'saisi' ? 'b-due' : ''}">${esc(etat.etat)}</span>
      <span class="grow"></span>
      <button class="btn btn-sm btn-ghost" id="dc-csv">Exporter les cases</button>
    </div>
    ${/* 10.12.0 (U-13) — les bandeaux ne s'empilent plus avant le premier chiffre. La promesse (« ne
          dépose rien ») vit avec les deux pense-bêtes qu'elle décrit ; les contrôles qui passent
          tiennent en une ligne discrète, et seul un contrôle qui ÉCHOUE garde l'orange : il porte
          un geste à faire. Un vert de plus au-dessus des cases n'apprenait rien. */''}
    <div class="panel dc-suite" id="dc-suite"><h2>Les étapes du mois ${info('dc.suite')}</h2>
      ${ligneEcheanceDeclaration(dossier, d.periode, deposee && posee.deposee.le)}
      ${motif ? `<p class="small muted dc-motif">${esc(motif)}</p>` : ''}
      <div class="dc-etapes">
        <button class="${cls('preparer')}" id="dc-preparer">${posee ? fait(true) + 'Préparée — recalculer' : 'Préparer la déclaration'}</button>${fleche}
        <button class="${cls('ecriture')}" id="dc-ecriture" ${!posee || (ecrite && !aCompleter) ? 'disabled' : ''}
          title="${!posee ? 'Prépare la déclaration d\'abord.' : aCompleter ? 'Une pièce est arrivée après l\'écriture du mois : le complément pose ce qui lui manque, en brouillard.' : ecrite ? 'Elle existe déjà : la refaire compterait la TVA du mois deux fois.' : ''}">${
          aCompleter ? 'Écrire le complément' : auBrouillard ? fait(true) + (complementAuBrouillard ? 'Complément au brouillard — à valider' : 'Écriture au brouillard — à valider') : ecrite ? fait(true) + 'Écriture du mois passée' : 'Écrire l\'écriture du mois'}</button>${fleche}
        <button class="${cls('deposee')}" id="dc-deposee" ${!posee || motifPerime ? 'disabled' : ''} title="${!posee ? 'Prépare la déclaration d\'abord.' : esc(motifPerime)}">${
          deposee ? fait(true) + 'Déposée le ' + esc(fmtJour(posee.deposee.le)) + ' — annuler' : 'Marquer déposée'}</button>${fleche}
        ${/* Le bouton du paiement reste ALLUMÉ tant qu'un paiement est posé (T-21) : éteint dès que
              le dépôt est vide, il enfermait dans « payée mais pas déposée » sans aucune issue. */''}
        <button class="${cls('payee')}" id="dc-payee" ${!posee || (!(posee.deposee && posee.deposee.le) && !(posee.payee && posee.payee.le)) ? 'disabled' : ''}
          title="${!posee ? 'Prépare la déclaration d\'abord.' : !(posee.deposee && posee.deposee.le) && !(posee.payee && posee.payee.le) ? 'On ne paie pas ce qu\'on n\'a pas déposé.' : ''}">${
          payee ? fait(true) + 'Payée le ' + esc(fmtJour(posee.payee.le)) + ' — annuler' : 'Marquer payée'}</button>
      </div>
      <p class="small muted mt">Ces chiffres se <b>recopient</b> sur le portail : SkanFact ne dépose rien et ne se connecte à aucune
      administration — « déposée » et « payée » sont des pense-bêtes, jamais un accusé de réception. L'écriture du mois
      (${esc(d.comptes.collectee)} / ${esc(d.comptes.deductible)} → ${esc(d.comptes.aPayer)}) arrive en <b>brouillard</b>, au dernier jour
      du mois ; ${(s.livre.releves || []).length
        ? 'le règlement viendra du relevé bancaire — pointer « payée » ne l\'écrit pas, sinon il serait compté deux fois.'
        : 'ce dossier n\'a pas de relevé bancaire : le règlement se saisit dans la grille, sur le journal de banque.'}</p>
    </div>
    ${echecs.length ? `<div class="warn-box mt">${echecs.map(c => `<div>${esc(c.detail)}</div>`).join('')}</div>`
      : `<p class="small ligne-ok mt"><span aria-hidden="true">✓</span> Les contrôles passent : aucun brouillard sur le mois, aucun compte d'attente ouvert, la TVA du mois soldée par son écriture, aucun crédit imputé en trop.</p>`}
    ${panneauFormulaire(d)}
    ${declState.ouverte && d.cases[declState.ouverte] ? panneauPieces(d.cases[declState.ouverte], LIBELLE_CASE[declState.ouverte]) : ''}`;
  }

  const panneauPieces = (c, titre) => `<div class="panel mt" id="dc-pieces"><h2>${esc(titre)} — les pièces</h2>
    <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Date</th><th class="nw">Journal</th><th class="nw">Pièce</th><th>Libellé</th></tr></thead>
    <tbody>${(c.ecritures || []).map(id => {
      const e = ecritureDuLivre(livresState.livre, id);
      return e ? `<tr><td class="nw">${esc(fmtJour(e.date))}</td><td class="nw">${esc(e.journal)}</td>
        <td class="nw">${esc(e.piece)}</td><td class="tronq lg" title="${esc(e.libelle)}">${esc(e.libelle)}</td></tr>` : '';
    }).join('')}</tbody></table></div></div>`;

  // Le mois proposé : le DERNIER qui porte des écritures, pas janvier. Un comptable ouvre cet
  // écran pour le mois qu'il vient de saisir ; le faire commencer au premier mois de l'exercice
  // serait onze clics par déclaration. Sans écriture, le mois courant (U-12) : la règle vit dans
  // `K.moisDeTravail`, la même que celle de la Paie.
  function moisPropose(livre) {
    const annee = Number(String((livre.exercice || {}).du || '').slice(0, 4)) || Number(livresState.annee);
    const faits = (livre.ecritures || []).map(e => String(e.date || '')).filter(d => d.startsWith(annee + '-')).map(d => Number(d.slice(5, 7)));
    return `${annee}-${String(K.moisDeTravail(faits, annee, K.today())).padStart(2, '0')}`;
  }

  // 10.14.0 — Ce qu'un écran de comptabilité LIT au processus principal se relit dès que le LIVRE a
  // bougé (la parade de T-24, que la clôture, la liasse et la révision portaient seules). La
  // déclaration de septembre, lue avant la validation de sa propre écriture, gardait ses cases et
  // ses contrôles d'avant — « 1 pièce encore en brouillard », « le 4367 porte encore 190 » — sur
  // un mois devenu juste ; une vente saisie dans la grille n'entrait dans la TVA collectée qu'au
  // changement de dossier. La piste d'audit trace chaque geste, les écritures leur nombre.
  function revDuLivre(livre) {
    return `${((livre && livre.audit) || []).length}:${((livre && livre.ecritures) || []).length}`;
  }

  // Une lecture qui échoue ne se retente pas toute seule : l'écran l'aurait redemandée à chaque
  // dessin, c'est-à-dire en boucle, un message d'erreur par tour. Elle se DIT, avec son geste.
  function lectureRatee(motif, cle) {
    return `<div class="warn-box">Cet écran n'a pas pu être lu : ${esc(motif)}
      <div class="mt"><button class="btn" data-relire-ecran="${esc(cle)}">Réessayer</button></div></div>`;
  }

  function brancherDeclaration(el, root, dossier) {
    const s = livresState;
    // Une déclaration se LIT au processus principal. Tant qu'elle n'est pas arrivée, l'écran le dit
    // — et c'est ici qu'on la demande, sinon l'onglet resterait sur « Lecture… » pour toujours.
    const veut = declState.mois || moisPropose(s.livre);
    const rev = revDuLivre(s.livre);
    if (!s.decl || s.decl.periode !== veut || s.declRev !== rev) { s.declRev = rev; chargerDeclaration(root, dossier); return; }
    if (s.decl.erreur) return;
    const m = $('#dc-mois', el);
    if (m) m.onchange = () => { declState.mois = m.value; declState.ouverte = ''; s.decl = null; chargerDeclaration(root, dossier); };
    $$('[data-cases]', el).forEach(b => { b.onclick = () => {
      declState.ouverte = declState.ouverte === b.dataset.cases ? '' : b.dataset.cases;
      if (declState.ouverte) pageFocus = 'dc-pieces';
      drawLivres(root, dossier);
    }; });
    $$('[data-copier]', el).forEach(b => { b.onclick = () => copierPourPortail(b, b.dataset.libelle || LIBELLE_CASE[b.dataset.copier] || b.dataset.copier); });
    const fmt = $('#dc-format', el);
    if (fmt) fmt.onchange = async () => {
      try {
        S = await api.saveCabinet({ ...S.cabinet, settings: { formatCopie: fmt.value } });
        drawLivres(root, dossier);
      } catch (e) { toast(plainError(e), 'error'); }
    };
    // La paie du mois déclaré, ouverte sur CE mois : c'est lui qu'il faut écrire.
    $$('[data-vers-paie]', el).forEach(b => { b.onclick = () => {
      s.paieMois = Number(String(s.decl && s.decl.periode || '').slice(5, 7)) || s.paieMois;
      allerSousOnglet(root, dossier, 'paie');
    }; });
    // UN bouton « Préparer » (U-11) : il était répété sous « Ce qui suit » (T-17) parce que les
    // gestes qu'il débloque vivaient deux écrans plus bas ; ils sont maintenant sur la même rangée.
    const prep = $('#dc-preparer', el);
    if (prep) prep.onclick = async () => {
      prep.disabled = true;
      try {
        const r = await api.poserDeclaration({ dossierId: dossier.id, annee: s.annee, periode: s.decl.periode });
        s.livre = r.livre; s.cloture = null; toast('Déclaration préparée.'); await chargerDeclaration(root, dossier);
      } catch (e) { toast(plainError(e), 'error'); prep.disabled = false; }
    };
    const ec = $('#dc-ecriture', el);
    if (ec) ec.onclick = async () => {
      ec.disabled = true;
      try {
        const r = await api.ecrireDeclaration({ dossierId: dossier.id, annee: s.annee, periode: s.decl.periode });
        s.livre = r.livre;
        toast(r.complement ? 'Complément créé en brouillard : valide-le quand tu es d\'accord.' : 'Écriture créée en brouillard : valide-la quand tu es d\'accord.');
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
      // 10.14.1 (D1bis) — dans l'ordre du formulaire, comme l'écran : une rubrique, sa ligne, sa base
      // et son taux quand ils se savent. Le récapitulatif et son total ferment le fichier.
      const f = s.decl.formulaire;
      const rangs = f ? [].concat(
        ...f.rubriques.map(r => r.lignes.map(l => [r.titre, [l.ref, l.libelle].filter(Boolean).join(' — '), l.base, l.taux, l.montant, l.montant == null ? l.motif : l.note])),
        f.recap.map(x => ['Récapitulatif', x.libelle, null, null, x.montant, '']),
        [['Récapitulatif', 'Total de la déclaration', null, null, f.total, f.manquent.length ? `Sans : ${f.manquent.join(', ')}` : '']],
        f.horsFormulaire.map(l => ['Hors de ce formulaire', l.libelle, null, null, l.montant, l.montant == null ? l.motif : ''])
      ) : ORDRE_CASES.filter(k => s.decl.cases[k]).map(k => ['', LIBELLE_CASE[k] || k, null, null, s.decl.cases[k].montant, s.decl.cases[k].motif || '']);
      const texte = [K.toCsvLine(['Rubrique', 'Case', 'Base', 'Taux (%)', 'Montant', 'Remarque'])]
        .concat(rangs.map(r => K.toCsvLine([r[0], r[1], K.csvMontant(r[2]), r[3] == null ? '' : Number(r[3]).toLocaleString('fr-FR'), K.csvMontant(r[4]), r[5] || '']))).join('\r\n') + '\r\n';
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
    } catch (e) { s.decl = { erreur: plainError(e), periode: declState.mois || moisPropose(s.livre) }; }
    drawLivres(root, dossier);
  }

  // ---------------------------------------------------------------- la clôture d'exercice (9.8.0)
  //
  // Clôturer, c'est arrêter de bouger. Les contrôles NOMMENT sans bloquer : un exercice clos avec
  // trois manques signalés vaut mieux qu'un exercice jamais clos (règle 6.0.0).

  // « Les sept contrôles » : en toutes lettres jusqu'à dix, comme on l'écrit dans une phrase.
  const EN_LETTRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
  const controlesPassent = n => (n === 1 ? 'Le contrôle passe.' : `Les ${EN_LETTRES[n] || n} contrôles passent.`);

  // Le bouton de l'exercice suivant nomme ce que le geste FERA (10.14.0), d'après l'état que le
  // moteur calcule en jouant le geste sur une copie (`etatExerciceSuivant`). Pas de points de
  // suspension sur « Voir » : il ne pose aucune question, il emmène.
  // Un écart avec la clôture se pose en à-nouveaux COMPLÉMENTAIRES : « Ajuster » quand le geste le
  // posera, « Ouvrir le brouillard » quand il attend déjà sa validation — c'est là qu'il se valide.
  function libelleSuivant(su) {
    const a = String(su.annee);
    if (su.etat === 'voir') return su.enAttente ? `Ouvrir le brouillard de ${a}` : `Voir les à-nouveaux de ${a}`;
    if (su.etat === 'refaire') return `Refaire les à-nouveaux de ${a}…`;
    if (su.etat === 'completer') return su.complement ? `Ajuster les à-nouveaux de ${a}…` : `Compléter l'ouverture de ${a}…`;
    return su.existe ? `Poser les à-nouveaux de ${a}…` : `Ouvrir ${a} (à-nouveaux)…`;
  }
  // Le bouton de l'exercice suivant est l'étape suivante (U-11) une fois l'exercice CLOS, tant qu'il
  // reste un geste à faire dans l'année d'après — ouvrir, refaire, ajuster, compléter, ou valider le
  // complément qui attend. Avant la clôture, l'étape suivante est de clôturer.
  const suivantPrincipal = (su, clos) => !!clos && (['ouvrir', 'refaire', 'completer'].includes(su.etat) || (su.etat === 'voir' && !!su.enAttente));
  // Une phrase du moteur citée après deux-points reprend en minuscule (typographie française).
  const minusculeInitiale = t => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
  // Un solde dans une PHRASE garde son sens en mots, jamais un signe : « −29 872,140 DT » se lit comme
  // une faute, « 29 872,140 DT créditeur » comme un solde (règle 6.3.0 — un montant négatif change de
  // colonne ; dans une phrase, la colonne se dit).
  const soldeEnClair = v => (!v ? 'soldé' : `${money(Math.abs(v))} ${v < 0 ? 'créditeur' : 'débiteur'}`);
  // Un compte de l'écart, dans la phrase : ses deux soldes, ou — même solde, autre répartition — le
  // nombre de tiers dont l'ouverture a changé. Un règlement réaffecté d'un client à l'autre ne change
  // pas le 411, et « 411 (940 repris, 940 à la clôture) » se lirait comme une erreur de l'écran.
  const ecartEnClair = x => (x.ecart
    ? `${esc(x.compte)} (${esc(soldeEnClair(x.porte))} repris, ${esc(soldeEnClair(x.attendu))} à la clôture)`
    : `${esc(x.compte)} (même solde, réparti autrement entre ${esc(pl(x.tiers, 'tiers', 'tiers'))})`);

  const LIBELLE_CONTROLE = {
    brouillard: 'Les pièces encore en brouillard', attente: 'Le compte d\'attente',
    tva: 'Les déclarations de TVA', declarations: 'Les déclarations et le livre d\'aujourd\'hui', tiers: 'La balance des tiers',
    dotations: 'Les dotations aux amortissements', amortissements: 'Le tableau d\'amortissement et le compte 28',
    equilibre: 'L\'équilibre de la balance'
  };

  function vueCloture(dossier) {
    const s = livresState;
    const d = s.cloture;
    if (!d) return `<div class="empty mini">Lecture de l'exercice…</div>`;
    if (d.erreur) return lectureRatee(d.erreur, 'cloture');
    const ex = d.exercice;
    const echecs = (d.controles || []).filter(c => !c.ok);
    const e = d.etats;
    const money0 = n => esc(money(n));
    const nomAN = nomDeCompte();
    // Un livre SANS à-nouveaux (T-23) : aucune balance d'ouverture reprise ET des capitaux propres
    // à zéro. Une pièce d'à-nouveau venue du client ou de « Ouvrir N+1 » porte ses capitaux dans
    // les lignes : elle suffit, et le vert reste légitime.
    const capitaux = (e.passif || []).find(g => /^Capitaux/.test(g.titre));
    const sansOuverture = !((s.livre.ouverture || {}).lignes || []).length && !(capitaux && capitaux.total);
    const groupe = g => `<tr class="gl-g"><th colspan="2">${esc(g.titre)}</th><th class="r nw">${money0(g.total)}</th></tr>`
      + g.lignes.map(l => `<tr><td class="nw">${esc(l.compte)}</td><td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td><td class="r nw">${money0(l.montant)}</td></tr>`).join('');
    // U-19 — 3 037 px en quatre sections qu'on lisait d'un bloc. Chacune se REPLIE, et repliée elle
    // porte son chiffre (règle 9.4.5 : un objet replié porte son chiffre) ; un sommaire les nomme en
    // tête. Une section qui porte une ALERTE s'ouvre toujours — on ne replie pas un déséquilibre,
    // ni les contrôles d'un exercice qu'on s'apprête à clôturer.
    const plis = s.clPlis || (s.clPlis = { controles: true, etats: true, sig: false, an: false });
    const alerteEtats = !e.equilibre || sansOuverture;
    const ouvert = k => plis[k] || (k === 'etats' && alerteEtats) || (k === 'controles' && echecs.length > 0 && !ex.clos);
    const sigLigne = id => (d.sig.lignes.find(l => l.id === id) || {}).montant;
    const section = (k, id, titre, chiffre, corps) => `<details class="panel mt pli" id="${id}" data-pli="${k}" ${ouvert(k) ? 'open' : ''}>
      <summary>${titre}<span class="pli-chiffre small muted">${chiffre}</span></summary>${corps}</details>`;
    const SECTIONS = [['controles', 'cl-sec-controles', 'Avant de clôturer'], ['etats', 'cl-sec-etats', 'Les états financiers'],
      ['sig', 'cl-sec-sig', 'Soldes intermédiaires'], ['an', 'cl-sec-an', `Les à-nouveaux de ${Number(ex.annee) + 1}`]];
    // 10.14.0 — le bouton de l'exercice suivant dit ce qu'il FERA, lu dans le moteur (le même geste
    // joué sur une copie) : « Ouvrir 2026 (à-nouveaux)… » répondait en rouge « déjà validés » sur un
    // exercice dont 2026 était ouvert depuis longtemps — le geste qui restait était d'aller voir.
    const su = d.suivant || { etat: 'ouvrir', annee: Number(ex.annee) + 1 };
    const ecartAN = su.ecart || [];
    return `<div class="filters">
      ${info('cl.etat')}
      <span class="small muted">Exercice ${esc(ex.annee)}</span>
      <span class="badge ${ex.clos ? 'b-paid' : 'b-due'}">${ex.clos ? 'clos' : 'ouvert'}</span>
      ${/* Un exercice clos ne propose plus « Clôturer » : un bouton éteint dont le motif ne vit que
            dans une infobulle ne se comprend qu'en survolant. Le badge « clos » le dit, et le geste
            qui reste est celui qu'on peut faire — rouvrir. */''}
      ${ex.clos ? '<button class="btn btn-sm" id="cl-rouvrir">Rouvrir (motif exigé)…</button>'
    : `<button class="btn btn-sm${exerciceTermine(ex.annee) ? ' btn-primary' : ''}" id="cl-cloturer">Clôturer l'exercice…</button>`}
      <button class="btn btn-sm${suivantPrincipal(su, ex.clos) ? ' btn-primary' : ''}" id="cl-suivant" data-etat="${esc(su.etat)}"${su.etat === 'refus' ? ' disabled aria-describedby="cl-suivant-motif"' : ''}>${esc(libelleSuivant(su))}</button>
      <button class="btn btn-sm" id="cl-fichier">Le dossier pour le client…</button>
      ${/* Réunir deux postes (9.9.0). Ici, et pas dans la Saisie : c'est un geste d'exercice, rare,
            et qui touche le livre entier. Quand les deux postes voient le même fichier, il ne sert
            à rien — l'application s'en aperçoit toute seule à l'enregistrement, fusionne et le
            dit. Il ne reste que le cas où les deux ne se sont jamais vus. */''}
      <span class="nw"><button class="btn btn-sm" id="cl-fusion">Réunir le livre d'un autre poste…</button>${info('eq.fusion')}</span>
    </div>
    ${/* Un bouton éteint dit POURQUOI sous ses yeux, jamais dans une infobulle (9.4.5) — et par la
          fonction même qui refuserait le geste. En gris : « rien à reporter » est l'état d'un
          exercice vide, pas une alarme (8.0.1). */''}
    ${su.etat === 'refus' ? `<p class="small muted mb" id="cl-suivant-motif">${esc(String(su.annee))} ne peut pas s'ouvrir : ${esc(minusculeInitiale(su.motif || ''))}</p>` : ''}
    ${/* Des à-nouveaux VALIDÉS qui ne reprennent plus cet exercice : l'écart se vérifie ici au lieu de
          se deviner, et il se pose en À-NOUVEAUX COMPLÉMENTAIRES par le bouton juste au-dessus. Le
          conseil d'avant — contre-passer la pièce, puis la reposer — comptait l'ouverture deux fois
          entre le 1er janvier et le jour de la contre-passation (vu à la souris, 10.14.0). */''}
    ${ecartAN.length ? `<div class="warn-box mb" id="cl-ecart-an"><b>Les à-nouveaux validés de ${esc(String(su.annee))} ne reprennent plus cet exercice</b>
       — ${esc(pl(ecartAN.length, 'compte diffère', 'comptes diffèrent'))} : ${ecartAN.slice(0, 4).map(ecartEnClair).join(' ; ')}${ecartAN.length > 4 ? '…' : ''}.
       Cet exercice a changé après leur validation. ${su.enAttente && !su.complement
    ? `L'écart est posé en <b>brouillard</b> dans ${esc(String(su.annee))}, au 1er janvier, dans une pièce d'à-nouveaux complémentaires : il reste à la valider.`
    : `« ${esc(libelleSuivant(su).replace(/…$/, ''))} » pose l'écart dans une pièce d'<b>à-nouveaux complémentaires</b>, au 1er janvier, en brouillard : rien de ce qui est validé ne bouge.`}</div>` : ''}
    ${/* Le motif d'une réouverture se lit PENDANT qu'elle sert (T-26) : un exercice rouvert est un
          exercice en train de changer, et c'est là que « pourquoi est-il ouvert ? » se pose. Il
          vivait dans la branche « clos » — donc il s'évaporait à la seconde où on le donnait, et
          seul le dernier revenait une fois reclos. L'historique complet est en dessous. */''}
    ${!ex.clos && (ex.reouvertures || []).length ? (() => { const d = ex.reouvertures[ex.reouvertures.length - 1] || {}; return `<div class="warn-box mb" id="cl-rouvert"><b>Exercice rouvert${d.le ? ' le ' + esc(fmtJour(KC.jourDeLInstant(d.le))) : ''}${d.par ? ' par ' + esc(d.par) : ''}</b> : « ${esc(d.motif || '')} »</div>`; })() : ''}
    ${/* U-13 — un état NORMAL se dit sur une ligne grise ; l'orange reste pour ce qui demande un
          geste (des contrôles à regarder). Le badge « clos » le disait déjà : l'encadré vert le
          répétait en plus gros. */''}
    ${ex.clos
    ? `<p class="small ligne-ok mb" id="cl-clos"><span aria-hidden="true">✓</span> Exercice clos${ex.closLe ? ' le ' + esc(fmtJour(KC.jourDeLInstant(ex.closLe))) : ''}${
      ex.closPar ? ' par ' + esc(ex.closPar) : ''}.${(ex.reouvertures || []).length
      ? ` Rouvert ${pl(ex.reouvertures.length, 'fois', 'fois')} — ${esc((ex.reouvertures[ex.reouvertures.length - 1] || {}).motif || '')}` : ''}</p>`
    : echecs.length
      ? `<div class="warn-box mb"><b>${pl(echecs.length, 'contrôle', 'contrôles')} ${echecs.length > 1 ? 'signalent' : 'signale'} quelque chose.</b>
           Ils ne bloquent pas : un exercice clos avec des manques signalés vaut mieux qu'un exercice jamais clos.</div>`
      : `<p class="small ligne-ok mb" id="cl-ok"><span aria-hidden="true">✓</span> ${
        /* Le compte se LIT sur la liste : sept contrôles quand le cabinet tient le registre des biens
           (le tableau d'amortissement contre le 28, 10.10.0), six sinon. « Les six » écrit en dur
           mentait sur chaque dossier qui a des biens — trouvé sur l'exercice clos de l'exemple. */''}${
        esc(controlesPassent((d.controles || []).length))}</p>`}
    ${/* Un <div> et non un <nav> : la règle `nav { flex-direction: column }` de la barre latérale
          empilait les pastilles en quatre barres pleine largeur — le piège du fil d'Ariane (7.27.0). */''}
    <div class="set-somm cl-somm" role="navigation" aria-label="Les sections de l'exercice">${SECTIONS.map(([k, , l]) =>
      `<button type="button" class="somm-chip" data-cl-sec="${k}">${esc(l)}</button>`).join('')}</div>
    ${/* Le dossier de clôture produit laisse une TRACE (T-27) : quand, où, scellé ou non, et le
          bouton qui retrouve le fichier — un fichier qu'on ne retrouve pas est un fichier qu'on ne
          peut pas envoyer. C'est ce qui répond, le lundi matin, à « lesquels ont reçu le leur ? ». */''}
    ${(ex.dossiersProduits || []).length ? `<div class="panel mt" id="cl-produits"><h2>Dossiers de clôture produits ${info('cl.produits')}</h2>
      <table class="list compact"><tbody>${ex.dossiersProduits.slice().reverse().map((p, i) => `<tr>
        <td class="nw">${esc(fmtJour(KC.jourDeLInstant(p.le)))}${p.par ? ` <span class="muted small">par ${esc(p.par)}</span>` : ''}</td>
        <td class="tronq lg" title="${esc(p.chemin)}">${esc(String(p.chemin || '').split(/[\\/]/).pop())}</td>
        <td class="nw small muted">${p.scelle ? 'scellé' : 'non scellé'} · ${p.pdf ? 'avec PDF' : 'sans PDF'}${p.signe ? ' · signé' : ''}</td>
        <td class="row-actions"><button type="button" class="btn btn-sm" data-reveal="${esc(p.chemin)}">Ouvrir le dossier</button></td></tr>`).join('')}</tbody></table></div>` : ''}
    ${(ex.reouvertures || []).length || ex.clos ? `<details class="mt" id="cl-historique"><summary>Clôtures et réouvertures ${info('cl.historique')}</summary>
      <ul class="small">${(ex.reouvertures || []).map(d => `<li>Clos${d.closLe ? ' le ' + esc(fmtJour(KC.jourDeLInstant(d.closLe))) : ''}, rouvert${d.le ? ' le ' + esc(fmtJour(KC.jourDeLInstant(d.le))) : ''}${d.par ? ' par ' + esc(d.par) : ''} : « ${esc(d.motif || '')} »</li>`).join('')}${
        ex.clos ? `<li>Clos${ex.closLe ? ' le ' + esc(fmtJour(KC.jourDeLInstant(ex.closLe))) : ''}${ex.closPar ? ' par ' + esc(ex.closPar) : ''} — en cours.</li>` : ''}</ul></details>` : ''}
    ${section('controles', 'cl-sec-controles', `<h2>Avant de clôturer</h2>${info('cl.controles')}`,
    echecs.length ? esc(pl(echecs.length, 'contrôle à voir', 'contrôles à voir')) : 'tous passent',
    `<table class="list compact"><tbody>${(d.controles || []).map(c => `<tr>
        <td class="nw">${c.ok ? '<span class="badge b-paid">ok</span>' : '<span class="badge b-late">à voir</span>'}</td>
        <td>${esc(LIBELLE_CONTROLE[c.id] || c.id)}</td>
        <td class="small muted">${esc(c.detail || 'rien à signaler')}</td></tr>`).join('')}</tbody></table>`)}
    ${section('etats', 'cl-sec-etats', `<h2>Les états financiers</h2>${info('cl.etats')}`,
    `résultat ${money0(e.resultat)} · ${e.equilibre ? 'actif = passif' : 'actif et passif diffèrent'}`, `
      <p class="small muted">Déduits de la <b>balance</b>, rubrique par rubrique — la présentation d'ensemble
      qui dit où en est le dossier. La <b>liasse</b>, avec ses codes de rubriques et le résultat fiscal, vit dans
      son onglet à elle. <em>À VÉRIFIER : la présentation exacte du système comptable des entreprises n'est
      validée par personne ici.</em></p>
      <div class="inline mb"><button type="button" class="btn btn-sm" id="cl-liasse">Ouvrir la liasse</button></div>
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
      : '<p class="small ligne-ok mt"><span aria-hidden="true">✓</span> Actif = passif, au millime.</p>'}
      <h3 class="sub-h">État de résultat</h3>
      <div class="scroll-x"><table class="list compact"><tbody>${groupe(e.produits)}${groupe(e.charges)}
        <tr class="dc-total"><td colspan="2"><b>Résultat de l'exercice</b></td><td class="r nw"><b>${money0(e.resultat)}</b></td></tr></tbody></table></div>`)}
    ${section('sig', 'cl-sec-sig', `<h2>Soldes intermédiaires et ratios</h2>${info('cl.sig')}`,
    sigLigne('va') == null ? '' : `valeur ajoutée ${money0(sigLigne('va'))} · EBE ${money0(sigLigne('ebe'))}`, `
      <table class="list compact"><thead><tr><th>Solde</th><th class="r nw">Montant</th><th>Comment il se calcule</th></tr></thead>
      <tbody>${d.sig.lignes.map(l => `<tr class="${l.id === 'net' ? 'dc-total' : ''}">
        <td>${esc(l.label)}</td><td class="r nw">${money0(l.montant)}</td>
        <td class="small muted">${esc(l.formule)}</td></tr>`).join('')}</tbody></table>
      <table class="list compact mt"><tbody>${d.sig.ratios.map(r => `<tr>
        <td>${esc(r.label)}</td>
        <td class="r nw">${r.valeur == null ? '<span class="muted">—</span>' : esc(r.unite === '%' ? pourcent(r.valeur) : String(r.valeur).replace('.', ',') + ' ' + r.unite)}</td></tr>`).join('')}</tbody></table>
      <p class="small muted mt">Un ratio sans dénominateur ne vaut rien : il affiche « — », jamais 0 %.
      Les rubriques retenues sont celles de l'usage — <b>À VÉRIFIER</b>.</p>`)}
    ${section('an', 'cl-sec-an', `<h2>Les à-nouveaux de ${esc(Number(ex.annee) + 1)}</h2>${info('cl.anouveaux')}`,
    esc(`${pl(d.anouveaux.lignes.length, 'ligne')} · ${money(d.anouveaux.debit)} au débit et au crédit`), `
      <p class="small muted">Calculés sur les écritures <b>réelles</b> de cet exercice et son ouverture :
      les comptes de bilan se reportent, le net des comptes de gestion va au résultat. Ils se posent
      en <b>brouillard</b> dans le livre suivant, et se refont tant qu'ils ne sont pas validés —
      un exercice qui bouge encore change son report.</p>
      <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Compte</th><th>Intitulé</th>
        <th class="r nw">Débit</th><th class="r nw">Crédit</th></tr></thead>
      <tbody>${/* 10.12.0 (U-15) — la colonne « Intitulé » lisait le libellé de la LIGNE, vide sur tous
            les comptes sauf le 13 : c'est le tableau qu'on relit avant de reporter un bilan, et il ne
            disait pas ce qu'était le 4531. Le nom du compte, par le résolveur unique (9.8.7). */''}${d.anouveaux.lignes.map(l => `<tr><td class="nw">${esc(l.compte)}</td>
        <td class="tronq" title="${esc(nomAN(l.compte, l.libelle))}">${esc(nomAN(l.compte, l.libelle))}</td>
        <td class="r nw">${l.debit ? money0(l.debit) : ''}</td><td class="r nw">${l.credit ? money0(l.credit) : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th colspan="2">${esc(pl(d.anouveaux.lignes.length, 'ligne'))}</th>
        <th class="r nw">${money0(d.anouveaux.debit)}</th><th class="r nw">${money0(d.anouveaux.credit)}</th></tr></tfoot></table></div>
      ${d.extournes.length ? `<p class="small muted mt">${pl(d.extournes.length, 'écriture s\'extourne', 'écritures s\'extournent')}
        au 1er janvier : elles partiront avec les à-nouveaux. L'originale, elle, reste dans son exercice avec son numéro.</p>` : ''}`)}`;
  }

  // Réunir le livre d'un autre poste (9.9.0). Le compte rendu n'est jamais un « c'est fait » : il
  // nomme ce qui est ENTRÉ et, surtout, ce qui est À REGARDER — un conflit résolu en silence est
  // encore un silence, et c'est très exactement ce que le partage à deux doit cesser de faire.
  async function fusionnerLivre(root, dossier) {
    const s = livresState;
    try {
      const r = await api.fusionner(dossier.id, s.annee);
      if (r.annule) return;
      const q = r.rapport;
      const bloc = (titre, liste, quoi) => liste.length
        ? `<p><b>${esc(titre)}</b></p><ul>${liste.slice(0, 12).map(x => `<li>${esc(quoi(x))}</li>`).join('')}</ul>`
          + (liste.length > 12 ? `<p class="muted small">… et ${liste.length - 12} de plus.</p>` : '')
        : '';
      await infoHtml(`Les deux livres sont réunis`,
        `<p>${pl(q.valideesAjoutees.length, 'écriture validée', 'écritures validées')} et ${pl(q.brouillardsAjoutes.length, 'brouillard')} `
        + `${q.valideesAjoutees.length + q.brouillardsAjoutes.length > 1 ? 'sont arrivés' : 'est arrivé'} de l'autre poste.</p>`
        + bloc('À regarder — même numéro que chez toi, sur une autre écriture :', q.numerosEnDoublon,
          x => `n° ${x.numero} · ${x.piece} du ${fmtJour(x.date)} — un numéro naît à la validation et ne se réattribue jamais ; il faut en contre-passer une`)
        + bloc('À regarder — la même écriture validée des deux côtés, avec un contenu différent :', q.valideesEnConflit,
          x => `${x.piece} du ${fmtJour(x.date)} — la tienne est gardée telle quelle`)
        + bloc('À regarder — un brouillard modifié des deux côtés :', q.brouillardsEnConflit,
          x => `${x.piece} du ${fmtJour(x.date)} — les DEUX sont gardés, à toi de choisir`)
        + (q.aRegarder ? '' : '<p class="muted small">Rien à trancher : les deux versions se complétaient.</p>'));
      s.livre = r.livre;
      render();
    } catch (e) { await infoDialog('Les livres n\'ont pas été réunis', plainError(e)); }
  }

  function brancherCloture(el, root, dossier) {
    const s = livresState;
    // Les contrôles se relisent dès que le LIVRE a bougé (T-24) — préparer une déclaration, valider
    // un brouillard, poser un inventaire : chacun trace dans la piste d'audit, et c'est elle qui
    // sert de repère. Lus une fois et jamais rafraîchis, deux contrôles sur six étaient faux sur
    // l'écran qui décide d'une clôture, et la fenêtre de confirmation les affichait périmés.
    const rev = `${(s.livre.audit || []).length}:${(s.livre.ecritures || []).length}`;
    if (!s.cloture || s.clotureRev !== rev) { s.clotureRev = rev; chargerCloture(root, dossier); return; }
    if (s.cloture.erreur) return;
    // U-19 — une section repliée ou dépliée le RESTE au prochain dessin ; le sommaire ouvre la
    // section qu'il nomme et l'amène à l'écran (un sommaire qui mène à un titre replié ne mène nulle part).
    const plis = s.clPlis || (s.clPlis = {});
    $$('details.pli[data-pli]', el).forEach(dt => { dt.ontoggle = () => { plis[dt.dataset.pli] = dt.open; }; });
    $$('[data-cl-sec]', el).forEach(b => { b.onclick = () => {
      const dt = $(`details.pli[data-pli="${b.dataset.clSec}"]`, el);
      if (!dt) return;
      dt.open = true; plis[b.dataset.clSec] = true;
      pageFocus = dt.id; focaliser(el);
    }; });
    const rep = $('#cl-reprise', el);
    if (rep) rep.onclick = () => repriseForm(root, dossier);
    const vli = $('#cl-liasse', el);
    if (vli) vli.onclick = () => allerSousOnglet(root, dossier, 'liasse');
    const fus = $('#cl-fusion', el);
    if (fus) fus.onclick = () => fusionnerLivre(root, dossier);
    const clo = $('#cl-cloturer', el);
    if (clo) clo.onclick = async () => {
      if (await refusLicence('Clôturer un exercice')) return;
      const echecs = (s.cloture.controles || []).filter(c => !c.ok);
      // Le corps d'un `confirmDialog` du Cabinet est du HTML (T-25) : les `\n` et les puces d'une
      // chaîne brute s'y aplatissaient en un pavé de six lignes, et deux avertissements collés ne
      // se lisent pas — on cherche le bouton vert. Une vraie liste, et la phrase dans son `<p>`.
      // 10.14.0 — un exercice qui court encore se clôt quand même (les contrôles nomment, ils ne
      // bloquent pas, 6.0.0), mais la question le DIT avant le geste : tout ce qui reste à passer
      // jusqu'au 31 décembre sera refusé. Trouvé à la souris : le bouton était vert en septembre.
      const enCours = !exerciceTermine(s.annee)
        ? `<p class="warn-box"><b>L'exercice ${esc(String(s.annee))} n'est pas terminé</b> : il court jusqu'au 31/12/${esc(String(s.annee))}. Le clôturer maintenant refusera toute écriture datée d'ici là, jusqu'à une réouverture motivée.</p>` : '';
      const ok = await confirmDialog(`Clôturer l'exercice ${s.annee} ?`,
        enCours + `<p>Après la clôture, plus aucune écriture de cet exercice ne bouge. La rouvrir reste possible, mais elle exigera un motif — c'est la seule trace qui expliquera pourquoi un chiffre a changé après coup.</p>`
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
      // Tout est déjà reporté : le geste est d'aller VOIR l'année d'après, sur son journal des
      // à-nouveaux — là où se lit ce qu'elle a reçu. Jamais un appel qui répondrait « déjà validés »
      // en rouge (10.14.0). Un complément qui attend sa validation se valide dans le BROUILLARD de la
      // saisie : c'est là qu'on emmène.
      const suiv = s.cloture.suivant || {};
      if (suiv.etat === 'voir') {
        if (suiv.enAttente) { await ouvrirExercice(root, dossier, String(Number(s.annee) + 1), 'saisie'); return; }
        s.journal = 'AN';
        await ouvrirExercice(root, dossier, String(Number(s.annee) + 1), 'journal');
        return;
      }
      su.disabled = true;
      try {
        const r = await api.ouvrirSuivant({ dossierId: dossier.id, annee: s.annee });
        exerciceConnu(r.annee);
        majSelecteurExercice(root);
        // 10.10.0 (C-12) — le geste finit là où il se termine vraiment (7.19.0) : l'exercice qu'on
        // vient d'ouvrir. Un message passager annonçait « à-nouveaux refaits sur 2027 » et laissait
        // le comptable sur 2026, devant un sélecteur qui ne proposait même pas 2027.
        // 10.14.0 — le registre suit les à-nouveaux : la phrase le DIT, avec ses deux nombres. Un
        // exercice qui s'ouvre sans ses biens ni ses salariés ne réclamerait aucune dotation et ne
        // proposerait aucun bulletin — et rien ne l'aurait montré.
        // Quand les à-nouveaux étaient déjà validés, le registre ne se redit que s'il a CHANGÉ : « 1 bien
        // et 1 salarié suivent » sous « Ajuster les à-nouveaux », pour un registre intact, faisait
        // chercher ce qui avait bougé.
        const registre = r.anDejaValides && !r.registreBouge ? ''
          : [r.biens ? pl(r.biens, 'bien') : '', r.salaries ? pl(r.salaries, 'salarié') : ''].filter(Boolean).join(' et ');
        const suit = registre ? `<p>${esc(registre)} de ${esc(String(s.annee))} ${(r.biens || 0) + (r.salaries || 0) > 1 ? 'suivent' : 'suit'} dans ${esc(String(r.annee))} :
          les biens avec leur plan d'amortissement, les salariés sans leurs bulletins — ceux-là restent dans leur mois.</p>` : '';
        // Une extourne prévue après la validation des à-nouveaux part ici aussi (10.14.0) : la
        // phrase la nomme, sinon on la chercherait dans un journal sans savoir qu'elle y est.
        const ext = r.extournes ? `<p>${esc(pl(r.extournes, 'extourne posée', 'extournes posées'))} au ${esc(fmtJour(`${r.annee}-01-01`))}, en <b>brouillard</b> : relis-${r.extournes > 1 ? 'les' : 'la'}, puis valide-${r.extournes > 1 ? 'les' : 'la'}.</p>` : '';
        // L'écart avec la clôture, posé en à-nouveaux COMPLÉMENTAIRES (10.14.0) : la phrase nomme la
        // pièce, sa date et ce qu'elle ne touche pas — la validée.
        const comp = r.complement
          ? `<p>L'écart avec la clôture de ${esc(String(s.annee))} est posé dans la pièce <b>${esc(r.piece || '')}</b>, au ${esc(fmtJour(`${r.annee}-01-01`))},
             en <b>brouillard</b> : ${esc(pl(r.complement, 'ligne', 'lignes'))}, rien d'autre. Relis-la, puis valide-la — rien de ce qui était validé n'a bougé.</p>`
          : r.complementRetire ? `<p>L'écart qui attendait en brouillard n'a plus lieu d'être : ${r.complementRetire > 1 ? 'les pièces complémentaires ont été retirées' : 'la pièce complémentaire a été retirée'}.</p>` : '';
        const aller = r.anDejaValides
          ? await confirmDialog(r.complement ? `À-nouveaux de ${r.annee} ajustés` : `Ouverture de ${r.annee} complétée`,
            `${r.complement ? '' : `<p>Les à-nouveaux de ${esc(String(r.annee))} étaient déjà validés : ils n'ont pas bougé.</p>`}${comp}${ext}${suit}`,
            `Ouvrir ${r.annee}`, false, `Rester sur ${s.annee}`)
          : await confirmDialog(`${r.refaits ? 'À-nouveaux refaits' : 'À-nouveaux posés'} sur ${r.annee}`,
            `<p>Ils sont en <b>brouillard</b> dans le livre de ${esc(String(r.annee))} : relis-les, puis valide-les.
             ${r.refaits ? 'Les précédents ont été remplacés — les validées, elles, n\'ont pas été touchées.' : ''}</p>${ext}${suit}`,
            `Ouvrir ${r.annee}`, false, `Rester sur ${s.annee}`);
        if (aller) { await ouvrirExercice(root, dossier, String(r.annee), 'saisie'); return; }
      } catch (err) { toast(plainError(err), 'error'); }
      // On reste : le bouton se RELIT — ce qui était « Ouvrir » est devenu « Refaire » ou « Voir ». Le
      // livre de N n'a pas bougé, donc rien d'autre ne relancerait la lecture de l'exercice.
      await chargerCloture(root, dossier);
    };
    const fi = $('#cl-fichier', el);
    if (fi) fi.onclick = () => clotureFichierForm(root, dossier);
    $$('[data-reveal]', el).forEach(b => { b.onclick = () => api.reveal(b.dataset.reveal); });
  }

  // Aller à un autre exercice du même dossier, comme le sélecteur le fait — et sur l'onglet voulu.
  async function ouvrirExercice(root, dossier, annee, onglet) {
    const s = livresState;
    s.mode = 'exercice'; s.annee = String(annee); s.page = 1;
    if (onglet) {
      s.onglet = onglet;
      // L'adresse suit l'écran (U-06) : sans elle, le prochain redessin ramènerait l'ancien onglet.
      const h = adresseCompta(dossier, onglet);
      if (location.hash !== h) history.pushState(null, '', h);
    } else suivreExercice(dossier);
    s.livreCle = dossier.id + '|' + s.annee;
    await chargerLeLivre(dossier);
    const mode = $('#lv-mode'); if (mode) mode.value = 'exercice';
    const an = $('#lv-annee'); if (an) an.hidden = false;
    // Les champs des AUTRES modes se cachent aussi : « Ouvrir 2026 » depuis « Un mois » laissait trois
    // listes côte à côte — l'exercice, 2026, et « décembre 2025 » au-dessus du livre de 2026 (10.14.0).
    ['#lv-mois', '#lv-du', '#lv-au'].forEach(q => { const x = $(q); if (x) x.hidden = true; });
    majSelecteurExercice(document);
    if ($('#c-livres')) drawLivres(document, dossier);
  }

  async function chargerCloture(root, dossier) {
    const s = livresState;
    try { s.cloture = await api.cloture({ dossierId: dossier.id, annee: s.annee }); }
    catch (e) { s.cloture = { erreur: plainError(e) }; }
    drawLivres(root, dossier);
  }

  // ==================================================== LA LIASSE ET L'ANNUEL (10.0.0)
  //
  // Le document où une erreur coûte le plus cher, et c'est pour ça que cet écran ne cache rien :
  // chaque rubrique s'ouvre sur les comptes qui l'ont remplie, une rubrique vide DIT pourquoi, et
  // ce qu'aucune rubrique ne capte est montré en rouge. « À VÉRIFIER » est écrit en tête : la
  // présentation exacte du système comptable des entreprises n'est validée par personne, et la
  // liasse réelle du pilote n'a pas encore été produite.

  async function chargerLiasse(root, dossier) {
    const s = livresState;
    try { s.liasse = await api.liasse({ dossierId: dossier.id, annee: s.annee }); }
    catch (e) { s.liasse = { erreur: plainError(e) }; }
    drawLivres(root, dossier);
  }

  function vueLiasse(dossier) {
    const s = livresState;
    const L = s.liasse;
    if (!L) return `<div class="empty mini">Lecture de la liasse…</div>`;
    if (L.erreur) return lectureRatee(L.erreur, 'liasse');
    const li = L.liasse, f = L.fiscal;
    const money0 = n => esc(money(n));
    const nature = id => (L.natures.find(x => x.id === id) || {}).label || id;
    // U-16 — dix-sept rubriques vides sur vingt-six, chacune avec sa phrase grise, noyaient les neuf
    // qui portent un montant. Elles sont MASQUÉES par défaut, et la case dit combien : masquer sans le
    // dire serait un piège (7.12.0). Le total ne bouge pas — une rubrique vide n'y met rien.
    const vides = li.etats.flatMap(e => e.lignes).filter(x => x.montant === null).length;
    const montrees = e => (s.liasseVides ? e.lignes : e.lignes.filter(x => x.montant !== null));
    // Le MONTANT est le lien : une colonne entière de « Voir les comptes » répétait le même bouton
    // sur chaque ligne (règle 7.29.0) ; c'est le chiffre qu'on veut ouvrir, c'est lui qu'on clique.
    const ligne = x => `<tr class="${x.montant === null ? 'row-muted' : ''}">
      <td class="nw small muted">${esc(x.id)}</td>
      <td>${esc(x.label)}${x.deduit || x.charge ? ' <span class="small muted">(en moins)</span>' : ''}
        ${x.montant === null ? `<div class="small muted">${esc(x.raison)}</div>` : ''}</td>
      <td class="r nw">${x.montant === null ? '<span class="muted">—</span>'
        : x.detail.length ? `<button type="button" class="montant-lien" data-rub="${esc(x.id)}" title="Voir les comptes qui forment ce montant">${money0(x.montant)}</button>`
          : money0(x.montant)}</td></tr>`;
    return `<div class="filters">
      ${info('li.liasse')}
      <span class="small muted">Exercice ${esc(s.annee)}</span>
      <span class="badge ${L.clos ? 'b-paid' : 'b-due'}">${L.clos ? 'clos' : 'ouvert'}</span>
      ${vides ? `<label class="check inline small"><input type="checkbox" id="li-masquer" ${s.liasseVides ? '' : 'checked'}> Masquer les rubriques vides (${vides})</label>` : ''}
      <button class="btn btn-sm" id="li-modele">Ajuster le modèle de rubriques…</button>
      <button class="btn btn-sm" id="li-csv">Exporter la liasse en CSV</button>
    </div>
    ${/* U-13 — la réserve vaut pour tout l'écran : elle se dit UNE fois, sur une ligne, sans l'orange
          d'un geste à faire. Un encadré orange permanent apprend à ignorer l'orange — y compris le
          jour où la liasse ne tombe pas juste, qui est le seul où il doit crier. */''}
    <p class="small muted mb" id="li-regle"><b>À VÉRIFIER</b> avec ton client et l'administration : les rubriques suivent
      l'usage, la présentation exacte n'est validée par personne ici, et <b>aucun taux d'impôt n'est écrit dans SkanFact</b>.
      Un montant souligné s'ouvre sur les comptes qui l'ont rempli.</p>
    ${li.equilibre && li.coherent
    ? '<p class="small ligne-ok mb" id="li-juste"><span aria-hidden="true">✓</span> Actif = passif, et le résultat du bilan est celui de l\'état de résultat.</p>'
    : `<div class="warn-box mb"><b>La liasse ne tombe pas juste.</b>
        ${li.equilibre ? '' : `Actif ${money0(li.totalActif)} contre passif ${money0(li.totalPassif)}, écart ${money0(li.totalActif - li.totalPassif)}. `}
        ${li.coherent ? '' : `Le résultat du bilan (${money0(li.resultat)}) n'est pas celui de l'état de résultat (${money0(li.resultatEtat)}). `}
        Signale-le avant de déposer quoi que ce soit.</div>`}
    ${li.orphelins.length ? `<div class="warn-box mb" id="li-orphelins"><b>${esc(pl(li.orphelins.length, 'compte n\'entre', 'comptes n\'entrent'))} dans aucune rubrique</b>
      — et ${li.orphelins.length > 1 ? 'ils ne sont' : 'il n\'est'} donc nulle part dans la liasse :
      ${li.orphelins.slice(0, 10).map(o => `${esc(o.compte)} (${money0(o.solde)})`).join(' · ')}${li.orphelins.length > 10 ? '…' : ''}.
      <div class="small">Ajuste le modèle de rubriques pour les rattacher.</div></div>` : ''}

    ${li.etats.map(e => `<div class="panel"><h2>${esc(e.label)}</h2>
      <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Code</th><th>Rubrique</th><th class="r">Montant</th></tr></thead>
      <tbody>${montrees(e).map(ligne).join('') || '<tr><td colspan="3" class="small muted">Aucune rubrique de cet état ne porte de montant.</td></tr>'}</tbody>
      <tfoot><tr><th colspan="2">${esc(e.id === 'resultat' ? 'Résultat de l\'exercice' : 'Total')}</th><th class="r nw">${money0(e.total)}</th></tr></tfoot></table></div></div>`).join('')}

    <div class="panel"><h2>Résultat fiscal et impôt ${info('li.fiscal')}</h2>
      <table class="list compact"><tbody>
        <tr><td>Résultat comptable</td><td class="r nw">${money0(f.resultatComptable)}</td></tr>
        <tr><td>+ Réintégrations</td><td class="r nw">${money0(f.reintegrations)}</td></tr>
        <tr><td>− Déductions et reports</td><td class="r nw">${money0(f.deductions)}</td></tr>
        <tr class="gl-g"><th>Résultat fiscal</th><th class="r nw">${money0(f.base)}</th></tr>
        ${f.deficitaire ? '<tr><td colspan="2" class="small muted">Exercice déficitaire : la base imposable est nulle, et le déficit se reporte — le report s\'impute à la main sur l\'exercice suivant.</td></tr>' : ''}
        <tr><td>Impôt${f.taux == null ? '' : ` au taux de ${esc(taux(f.taux))}\u00a0%`}</td>
          <td class="r nw">${f.impot === null ? '<span class="muted">—</span>' : money0(f.impot)}</td></tr>
        ${f.raisonImpot ? `<tr><td colspan="2" class="small muted">${esc(f.raisonImpot)}</td></tr>` : ''}
      </tbody></table>
      <p class="small muted mt">Le <b>minimum d'impôt</b> n'est pas calculé : il dépend d'une règle de droit que
      personne n'a confirmée ici, et un chiffre inventé sur une déclaration coûte plus cher qu'une case vide.</p>
      <div class="inline mt">
        <label class="field narrow"><span>Taux d'impôt (%) ${info('li.taux')}</span>
          <input type="text" id="li-taux" value="${esc(taux(L.tauxImpot))}" placeholder="vide = aucun"></label>
        <button class="btn btn-sm" id="li-taux-ok">Enregistrer le taux</button>
      </div>
      <h3 class="eyebrow mt">Retraitements</h3>
      ${L.retraitements.length
    ? `<table class="list compact"><tbody>${L.retraitements.map(r => `<tr>
          <td class="nw small">${esc(nature(r.nature))}</td><td>${esc(r.libelle)}</td>
          <td class="r nw">${money0(r.montant)}</td>
          <td class="row-actions"><button type="button" class="btn btn-sm" data-rtx="${esc(r.id)}">Retirer la ligne</button></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty mini">Aucun retraitement. Ce qui se réintègre et ce qui se déduit dépend du droit : chaque ligne se saisit, rien n\'est proposé.</div>'}
      <div class="sous-table"><button class="btn btn-sm" id="li-rt-add">Ajouter un retraitement…</button></div>
    </div>

    <div class="panel"><h2>Déclaration annuelle d'employeur ${info('li.employeur')}</h2>
      <p class="small">Elle porte <b>deux choses distinctes</b> qu'on confond : les salaires versés, et les
      retenues à la source pratiquées sur des fournisseurs. Les deux figurent sur le même formulaire.</p>
      <table class="list compact"><tbody>${L.employeur.cases.map(c => `<tr class="${c.montant === null ? 'row-muted' : ''}">
        <td>${esc(c.label)}<div class="small muted">${esc(c.comptes.join(', '))}${c.raison ? ' · ' + esc(c.raison) : ''}</div></td>
        <td class="r nw">${c.montant === null ? '<span class="muted">—</span>' : money0(c.montant)}</td></tr>`).join('')}</tbody></table>
      <p class="small muted mt">${esc(L.employeur.raisonNominatif)}</p>
    </div>`;
  }

  function brancherLiasse(el, root, dossier) {
    const s = livresState;
    const rev = `${(s.livre.audit || []).length}:${(s.livre.ecritures || []).length}`;
    if (!s.liasse || s.liasseRev !== rev) { s.liasseRev = rev; chargerLiasse(root, dossier); return; }
    if (s.liasse.erreur) return;
    const relire = () => { s.liasseRev = ''; chargerLiasse(root, dossier); };

    // Chaque rubrique s'OUVRE sur les comptes qui l'ont remplie : un chiffre qu'on ne peut pas
    // ouvrir se croit ou ne se croit pas, et sur une liasse c'est le pire des deux (7.15.0).
    $$('[data-rub]', el).forEach(b => { b.onclick = () => {
      const x = s.liasse.liasse.etats.flatMap(e => e.lignes).find(y => y.id === b.dataset.rub);
      if (!x) return;
      infoHtml(`${x.id} — ${x.label}`,
        `<table class="list compact"><tbody>${x.detail.map(d => `<tr><td class="nw">${esc(d.compte)}</td>
          <td>${esc(d.libelle)}</td><td class="r nw">${esc(money(d.montant))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th colspan="2">Total</th><th class="r nw">${esc(money(x.montant))}</th></tr></tfoot></table>`);
    }; });

    const mq = $('#li-masquer', el);
    if (mq) mq.onchange = () => { s.liasseVides = !mq.checked; drawLivres(root, dossier); };
    const t = $('#li-taux-ok', el);
    if (t) t.onclick = async () => {
      try {
        const r = await api.fiscalAnnuel({ dossierId: dossier.id, annee: s.annee, tauxImpot: $('#li-taux', el).value });
        s.livre = r.livre; relire();
      } catch (e) { toast(plainError(e), 'error'); }
    };
    const add = $('#li-rt-add', el);
    if (add) add.onclick = () => retraitementForm(root, dossier);
    $$('[data-rtx]', el).forEach(b => { b.onclick = async () => {
      const reste = (s.liasse.retraitements || []).filter(r => r.id !== b.dataset.rtx);
      try {
        const r = await api.fiscalAnnuel({ dossierId: dossier.id, annee: s.annee, retraitements: reste });
        s.livre = r.livre; relire();
      } catch (e) { toast(plainError(e), 'error'); }
    }; });
    const mod = $('#li-modele', el);
    if (mod) mod.onclick = () => modeleLiasseForm(relire);
    const csv = $('#li-csv', el);
    if (csv) csv.onclick = async () => {
      // `K.toCsvLine` échappe comme le reste du Cabinet : un libellé de rubrique qui commence par
      // « = » serait exécuté par un tableur (9.1.1).
      const texte = [K.toCsvLine(['État', 'Code', 'Rubrique', 'Montant', 'Sens'])]
        .concat(s.liasse.liasse.etats.flatMap(e => e.lignes.map(x => K.toCsvLine([
          e.label, x.id, x.label, K.csvMontant(x.montant),
          (x.deduit || x.charge) ? 'en moins' : ''
        ])))).join('\r\n') + '\r\n';
      try {
        const r = await api.exportCsv(texte, `liasse-${s.annee}-${dossier.matricule || dossier.name}`);
        if (r) toast('Fichier enregistré.');
      } catch (e) { toast(plainError(e), 'error'); }
    };
  }

  function retraitementForm(root, dossier) {
    const s = livresState;
    const nats = s.liasse.natures;
    modal(`<h2>Ajouter un retraitement</h2>
      <p class="small muted">Ce qui se réintègre et ce qui se déduit dépend du <b>droit fiscal</b>, pas de nous :
      rien n'est proposé, chaque ligne se saisit et s'explique. <em>À VÉRIFIER avec ton client.</em></p>
      <div class="grid-2">
        <label class="field"><span>Nature</span><select id="rt-nature">${nats.map(n => `<option value="${esc(n.id)}">${esc(n.label)}</option>`).join('')}</select></label>
        <label class="field obligatoire"><span>Montant (DT)</span><input type="text" id="rt-montant" class="num montant" inputmode="decimal" placeholder="0,000"></label>
        <label class="field obligatoire span-2"><span>Libellé</span><input type="text" id="rt-libelle" placeholder="Amende fiscale non déductible"></label>
      </div>
      <p class="small muted" id="rt-aide">${esc(nats[0].aide)}</p>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="rt-ok">Ajouter</button></div>`,
    (couche, close) => {
      const sel = $('#rt-nature', couche);
      sel.onchange = () => { $('#rt-aide', couche).textContent = (nats.find(n => n.id === sel.value) || {}).aide || ''; };
      $('#rt-ok', couche).onclick = async () => {
        const ligne = {
          id: 'rt' + Date.now().toString(36), nature: sel.value,
          libelle: $('#rt-libelle', couche).value.trim(),
          montant: lireMontant($('#rt-montant', couche).value)
        };
        const v = KC.retraitementValide(ligne);
        if (!v.ok) return toast(v.motifs[0], 'error');
        try {
          const r = await api.fiscalAnnuel({ dossierId: dossier.id, annee: s.annee,
            retraitements: (s.liasse.retraitements || []).concat([ligne]) });
          s.livre = r.livre; close(); s.liasseRev = ''; chargerLiasse(root, dossier);
        } catch (e) { toast(plainError(e), 'error'); }
      };
    });
  }

  // ================================================ LA RÉVISION ET LES QUESTIONS (9.10.0)
  //
  // Le dossier de travail. Il part de la méthode du comptable, pas de la nôtre : les sept cycles
  // PROPOSENT un rattachement par préfixe de compte, entièrement surchargeable dans les Réglages,
  // et le questionnaire de fin d'exercice part VIDE — les cinq questions les plus fréquentes du
  // pilote ne sont pas connues, et les inventer serait écrire sa méthode à sa place.

  async function chargerRevision(root, dossier) {
    const s = livresState;
    try { s.revision = await api.revision({ dossierId: dossier.id, annee: s.annee, periode: s.revPeriode || String(s.annee) }); }
    catch (e) { s.revision = { erreur: plainError(e) }; }
    drawLivres(root, dossier);
  }

  function vueRevision(dossier) {
    const s = livresState;
    const r = s.revision;
    if (!r) return `<div class="empty mini">Lecture du dossier de révision…</div>`;
    if (r.erreur) return lectureRatee(r.erreur, 'revision');
    const d = r.dossier;
    const cycle = s.revCycle || '';
    const feuille = cycle ? d.feuilles.find(f => f.cycle === cycle) : null;
    const money0 = n => esc(money(n));
    const mois = [''].concat(Array.from({ length: 12 }, (_, i) => `${s.annee}-${String(i + 1).padStart(2, '0')}`));
    const ligneCompte = c => `<tr class="${c.revu ? '' : 'row-warn'}">
      <td class="nw">${esc(c.compte)}</td>
      <td class="tronq" title="${esc(c.libelle)}">${esc(c.libelle)}</td>
      <td class="r nw">${money0(c.ouverture)}</td>
      <td class="r nw">${money0(c.debit)}</td>
      <td class="r nw">${money0(c.credit)}</td>
      <td class="r nw"><b>${money0(c.solde)}</b></td>
      <td class="r nw">${money0(c.variation)}</td>
      <td class="nw small">${c.revu
    ? `<span class="badge b-paid">revu</span> ${esc(c.revuPar || '')}${c.revuLe ? ' · ' + esc(fmtJour(KC.jourDeLInstant(c.revuLe))) : ''}`
    : '<span class="muted">à revoir</span>'}</td>
      ${rowMenuCell('RV:' + c.compte)}</tr>`;
    // 10.12.0 (U-11) — un seul vert, et c'est l'ÉTAPE SUIVANTE. À 0 compte signé sur 19, le vert
    // de l'écran était « Arrêter la révision… » : le geste de la FIN, proposé au début. Tant que des
    // comptes attendent leur signature, le vert ouvre le PROCHAIN cycle qui en a ; dans un cycle
    // ouvert qui en a encore, ce sont ses lignes « à revoir » qui sont la suite — rien n'est vert
    // au-dessus d'elles ; quand tout est signé, le vert passe à l'arrêt ; une révision arrêtée n'a
    // plus d'étape suivante. Signer reste un geste compte par compte : un « tout signer » serait
    // une signature sans revue.
    const ouvertIncomplet = d.feuilles.some(f => f.cycle === cycle && f.revus < f.total);
    const iOuvert = d.feuilles.findIndex(f => f.cycle === cycle);
    const prochain = d.feuilles.slice(iOuvert + 1).concat(d.feuilles.slice(0, iOuvert + 1)).find(f => f.revus < f.total && f.cycle !== cycle) || null;
    const horsARevoir = d.hors.filter(c => !c.revu).length;
    // U-13 — l'orange pour ce qui demande un geste (un brouillard à valider, une note à lever, une
    // question qui attend). « 19 comptes ne sont pas signés » est l'état de DÉPART d'une révision,
    // et l'avancement le dit déjà en tête des feuilles : il ne se répète pas en alerte.
    const controles = r.controles || [];
    // 10.13.0 (U-11, test humain du pont) — une question posée et pas encore partie passe AVANT la
    // suite de la révision : le client a besoin de temps pour répondre, chaque jour compte.
    const aEnvoyer = controles.some(c => c.envoyer);
    const suivante = d.faite ? '' : aEnvoyer ? 'envoyer' : ouvertIncomplet ? 'signer' : prochain ? 'cycle' : horsARevoir ? 'hors' : 'arreter';
    const aFaire = controles.filter(c => c.gravite !== 'info');
    const etatsNormaux = controles.filter(c => c.gravite === 'info' && c.id !== 'comptes');
    return `<div class="filters">
      ${info('rv.dossier')}
      <label class="f-lab" for="rv-periode">La période révisée</label>
      <select id="rv-periode">${mois.map(m => `<option value="${esc(m || String(s.annee))}" ${String(d.periode) === (m || String(s.annee)) ? 'selected' : ''}>${m ? esc(moisLabelCourt(m)) : 'L\'exercice ' + esc(s.annee)}</option>`).join('')}</select>
      ${/* Une révision arrêtée se dit UNE fois, sur l'état : le badge porte la date et le nom.
            Un encadré vert en dessous répétait le badge, en pesant autant qu'une alerte. */''}
      <span class="badge ${d.faite ? 'b-paid' : 'b-due'}">${d.faite ? 'révision arrêtée' : 'en cours'}</span>${d.faite && (d.faiteLe || d.faitePar)
    ? `<span class="small muted" id="rv-arretee">${d.faiteLe ? 'le ' + esc(fmtJour(KC.jourDeLInstant(d.faiteLe))) : ''}${d.faitePar ? ' par ' + esc(d.faitePar) : ''}</span>` : ''}
      <button class="btn btn-sm${suivante === 'arreter' ? ' btn-primary' : ''}" id="rv-arreter">${d.faite ? 'Rouvrir la révision' : 'Arrêter la révision…'}</button>
      <button class="btn btn-sm" id="rv-note">Note de revue…</button>
      <button class="btn btn-sm" id="rv-question">Poser une question…</button>
      <span class="nw"><button class="btn btn-sm${suivante === 'envoyer' ? ' btn-primary' : ''}" id="rv-envoyer">Envoyer les questions au client…</button>${info('rv.envoi')}</span>
    </div>
    ${aFaire.length ? `<div class="warn-box mb">${aFaire.map(c => `<div>${esc(c.texte)}</div>`).join('')}
      <div class="small">Ils ne bloquent pas : une révision arrêtée avec des manques signalés vaut mieux qu'une révision jamais arrêtée.</div></div>` : ''}
    ${etatsNormaux.length ? `<p class="small muted mb" id="rv-etats">${etatsNormaux.map(c => esc(c.texte)).join(' · ')}</p>` : ''}

    <div class="panel"><h2>Les feuilles maîtresses ${info('rv.feuilles')}</h2>
      <div class="rv-avance"><p class="lead">${esc(d.revus)} compte${d.revus > 1 ? 's' : ''} signé${d.revus > 1 ? 's' : ''} sur ${esc(d.total)}${d.reste ? ` — ${esc(pl(d.reste, 'reste à revoir', 'restent à revoir'))}` : ''}.</p>
      ${suivante === 'cycle' ? `<button class="btn btn-sm btn-primary" id="rv-suivant" data-cycle="${esc(prochain.cycle)}">Revoir ${esc(prochain.label)} (${esc(pl(prochain.total - prochain.revus, 'compte', 'comptes'))})</button>`
    : suivante === 'hors' ? `<button class="btn btn-sm btn-primary" id="rv-voir-hors">Revoir les comptes hors cycle (${esc(horsARevoir)})</button>`
      : suivante === 'signer' ? `<span class="small muted" id="rv-signer">Signe les comptes « à revoir » de ce cycle : menu « Actions » de la ligne.</span>` : ''}</div>
      <div class="stats rangee cy-cartes">${d.feuilles.map(f => `<button type="button" class="stat cy-carte${cycle === f.cycle ? ' cy-on' : ''}" data-cycle="${esc(f.cycle)}" aria-pressed="${cycle === f.cycle}">
        <span class="eyebrow">${esc(f.label)}</span>
        <span class="val">${esc(f.revus)} / ${esc(f.total)}</span>
        <span class="small muted">${f.total ? money0(f.totaux.solde) : 'aucun compte'}</span></button>`).join('')}</div>
      ${feuille
    ? (feuille.rows.length
      ? `<div class="scroll-x mt"><table class="list compact"><thead><tr><th>Compte</th><th>Intitulé</th><th class="r">Ouverture</th><th class="r">Débit</th><th class="r">Crédit</th><th class="r">Solde</th><th class="r">Variation</th><th>Revu</th><th></th></tr></thead>
          <tbody>${feuille.rows.map(ligneCompte).join('')}</tbody>
          <tfoot><tr><th colspan="2">${esc(feuille.label)}</th><th class="r nw">${money0(feuille.totaux.ouverture)}</th><th class="r nw">${money0(feuille.totaux.debit)}</th><th class="r nw">${money0(feuille.totaux.credit)}</th><th class="r nw">${money0(feuille.totaux.solde)}</th><th class="r nw">${money0(feuille.totaux.variation)}</th><th colspan="2"></th></tr></tfoot></table></div>`
      : `<div class="empty mini mt">Aucun compte de ce cycle n'est mouvementé sur la période.</div>`)
    : `<div class="empty mini mt">Choisis un cycle ci-dessus pour ouvrir sa feuille maîtresse.</div>`}
      ${d.hors.length ? `<details class="mt" id="rv-hors" ${s.revHors ? 'open' : ''}><summary>${esc(pl(d.hors.length, 'compte hors cycle', 'comptes hors cycle'))} ${info('rv.hors')}</summary>
        <div class="scroll-x"><table class="list compact"><thead><tr><th>Compte</th><th>Intitulé</th><th class="r">Ouverture</th><th class="r">Débit</th><th class="r">Crédit</th><th class="r">Solde</th><th class="r">Variation</th><th>Revu</th><th></th></tr></thead>
          <tbody>${d.hors.map(ligneCompte).join('')}</tbody></table></div></details>` : ''}
    </div>

    <div class="panel"><h2>Notes de revue ${info('rv.notes')}</h2>
      ${d.notes.length
    ? `<table class="list compact"><tbody>${d.notes.slice().reverse().map(n => `<tr class="${n.levee ? '' : 'row-warn'}">
          <td>${esc(n.texte)}<div class="small muted">${esc(n.par || '')}${n.le ? ' · ' + esc(fmtJour(KC.jourDeLInstant(n.le))) : ''}${n.cycle ? ' · ' + esc(libelleDuCycle(r, n.cycle)) : ''}${n.compte ? ' · ' + esc(n.compte) : ''}</div></td>
          <td class="nw">${n.levee ? `<span class="badge b-paid">levée</span>` : '<span class="badge b-due">ouverte</span>'}</td>
          <td class="row-actions"><button type="button" class="btn btn-sm" data-note="${esc(n.id)}">${n.levee ? 'Rouvrir' : 'Lever'} la note</button></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty mini">Aucune note de revue sur cette période.</div>'}
    </div>

    <div class="panel"><h2>Questionnaire de fin d'exercice ${info('rv.questionnaire')}</h2>
      ${d.questionnaire.length
    ? `<table class="list compact"><tbody>${d.questionnaire.map(q => `<tr>
          <td>${esc(q.question)}</td>
          <td>${q.reponse ? esc(q.reponse) : '<span class="muted">sans réponse</span>'}</td>
          <td class="row-actions"><button type="button" class="btn btn-sm" data-qq="${esc(q.id)}">Répondre</button></td></tr>`).join('')}</tbody></table>`
    : r.modeles.length
      ? `<div class="empty mini">Le questionnaire de ton cabinet n'est pas encore posé sur cette période.</div>
         <div class="inline mt"><button class="btn btn-sm" id="rv-poser">Poser les ${esc(pl(r.modeles.length, 'question'))} de ton cabinet</button></div>`
      : `<div class="empty mini">Ton cabinet n'a pas encore écrit son questionnaire de fin d'exercice.
         Il s'écrit une fois, pour tous tes dossiers.</div>
         <div class="inline mt"><button class="btn btn-sm" id="rv-modeles">Écrire le questionnaire…</button></div>`}
    </div>

    <div class="panel" id="rv-questions"><h2>Les questions posées au client ${info('rv.questions')}</h2>
      ${r.questions.length
    ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Pièce</th><th>Compte</th><th>La question</th><th>Attendu</th><th>Envois</th><th>Réponse</th><th></th></tr></thead>
        <tbody>${r.questions.slice().reverse().map(q => `<tr class="${(q.envois || []).length >= 2 && q.statut !== 'repondue' && q.statut !== 'close' ? 'row-warn' : ''}">
          <td class="nw">${q.piece ? esc(q.piece) : '<span class="muted">—</span>'}</td>
          <td class="nw small">${esc(q.compte || '')}</td>
          <td>${esc(q.objet || '')}<div class="small">${esc(q.texte)}</div></td>
          <td class="nw small">${esc(libelleAttendu(q.attendu))}</td>
          <td class="nw small">${(q.envois || []).length ? esc(pl((q.envois || []).length, 'fois', 'fois')) : '<span class="muted">pas encore</span>'}</td>
          <td>${q.reponse ? `<span class="badge b-paid">répondue</span><div class="small">${esc(q.reponse.texte || '')}</div>`
    : q.statut === 'close' ? '<span class="badge">close</span>' : '<span class="badge b-due">en attente</span>'}</td>
          ${rowMenuCell('QU:' + q.id)}</tr>`).join('')}</tbody></table></div>`
    : `<div class="empty mini">Aucune question posée sur cet exercice. Une question naît d'une LIGNE :
       ouvre un compte dans une feuille maîtresse et choisis « Poser une question au client ».</div>`}
    </div>`;
  }

  const libelleAttendu = id => (KC.QUESTION_ATTENDUS.find(x => x.id === id) || {}).label || 'Une explication';
  const libelleDuCycle = (r, id) => ((r.cycles || KC.CYCLES_REVISION).find(c => c.id === id) || {}).label || id;

  function brancherRevision(el, root, dossier) {
    const s = livresState;
    // Le dossier se relit dès que le LIVRE a bougé : signer un compte, valider un brouillard ou
    // poser une question change ce que les feuilles maîtresses montrent (même parade qu'en T-24).
    const rev = `${(s.livre.audit || []).length}:${(s.livre.ecritures || []).length}:${s.revPeriode || s.annee}`;
    if (!s.revision || s.revisionRev !== rev) { s.revisionRev = rev; chargerRevision(root, dossier); return; }
    if (s.revision.erreur) return;
    // 10.13.0 — un raccourci vise un PANNEAU (7.18.0) : « Lire la réponse », depuis le compte rendu
    // d'import, ouvrait la Révision en haut, et la réponse du client vivait trois panneaux plus bas.
    // La cible n'existe qu'une fois le dossier de révision LU : posée plus tôt, `focaliser` la
    // consommait sur l'écran « Lecture du dossier… » et ne trouvait rien.
    if (s.revViser) { pageFocus = s.revViser; s.revViser = ''; }
    const relire = () => { s.revisionRev = ''; chargerRevision(root, dossier); };

    const per = $('#rv-periode', el);
    if (per) per.onchange = () => { s.revPeriode = per.value; s.revisionRev = ''; chargerRevision(root, dossier); };
    $$('[data-cycle]', el).forEach(b => { b.onclick = () => { s.revCycle = s.revCycle === b.dataset.cycle ? '' : b.dataset.cycle; drawLivres(root, dossier); }; });
    // Les comptes hors cycle vivent dans un volet replié : le geste qui les désigne l'ouvre ET
    // l'amène à l'écran — un volet qu'on déplie hors de la vue, c'est un clic qui ne fait rien.
    const vh = $('#rv-voir-hors', el);
    if (vh) vh.onclick = () => { s.revHors = true; pageFocus = 'rv-hors'; drawLivres(root, dossier); };

    const geste = async (id, g) => {
      try {
        const r = await api.question({ dossierId: dossier.id, annee: s.annee, id, geste: g });
        s.livre = r.livre; relire();
      } catch (e) { toast(plainError(e), 'error'); }
    };
    bindRowMenus(el, cle => {
      const [quoi, id] = String(cle).split(/:(.*)/);
      if (quoi === 'RV') {
        const c = (s.revision.dossier.feuilles.flatMap(f => f.rows).concat(s.revision.dossier.hors)).find(x => x.compte === id);
        if (!c) return [];
        return [
          { icon: c.revu ? 'non' : 'oui', label: c.revu ? 'Retirer ma signature' : 'Signer ce compte',
            hint: c.revu ? 'Le compte redevient « à revoir ».' : 'Je l\'ai revu : il est juste.',
            run: async () => {
              try {
                const r = await api.signerCompte({ dossierId: dossier.id, annee: s.annee, periode: s.revision.dossier.periode, compte: id, revu: !c.revu });
                s.livre = r.livre; toast(r.revu ? `Compte ${id} signé.` : `Signature retirée sur ${id}.`); relire();
              } catch (e) { toast(plainError(e), 'error'); }
            } },
          { icon: 'modifier', label: 'Écrire une note de revue', hint: 'Ce qu\'il reste à vérifier sur ce compte.',
            run: () => noteForm(root, dossier, { compte: id, cycle: c.cycle }) },
          { icon: 'email', label: 'Poser une question au client', hint: 'Elle s\'affichera chez lui, en face de la pièce.',
            run: () => questionForm(root, dossier, { compte: id, cycle: c.cycle }) }
        ];
      }
      if (quoi !== 'QU') return [];
      const q = (s.revision.questions || []).find(x => x.id === id);
      if (!q) return [];
      const partie = (q.envois || []).length;
      return [
        q.statut === 'close'
          ? { icon: 'reprendre', label: 'Rouvrir cette question', hint: 'Elle repartira dans le prochain envoi.', run: () => geste(id, 'rouvrir') }
          : { icon: 'oui', label: 'Fermer cette question', hint: 'Elle a trouvé sa réponse ailleurs : elle ne repartira plus.', run: () => geste(id, 'fermer') },
        !q.reponse && q.statut !== 'close'
          ? { icon: 'modifier', label: 'Préciser la question', hint: 'Le client verra le texte corrigé au prochain envoi.', run: () => questionForm(root, dossier, null, id) } : null,
        // Une question DÉJÀ PARTIE ne s'efface pas : le client l'a sous les yeux, et la faire
        // disparaître de notre côté le laisserait répondre à une question qui n'existe plus.
        !partie ? { sep: true } : null,
        !partie ? { icon: 'supprimer', label: 'Retirer cette question', danger: true,
          hint: 'Elle n\'est jamais partie chez le client : elle s\'efface sans trace.',
          run: async () => {
            if (!await confirmDialog('Retirer cette question ?', '<p>Elle n\'est jamais partie chez le client : elle s\'efface sans laisser de trace.</p>', 'Retirer', true)) return;
            geste(id, 'supprimer');
          } } : null
      ].filter(Boolean);
    });

    $$('[data-note]', el).forEach(b => { b.onclick = async () => {
      const n = (s.revision.dossier.notes || []).find(x => x.id === b.dataset.note);
      try {
        const r = await api.noteRevue({ dossierId: dossier.id, annee: s.annee, periode: s.revision.dossier.periode, id: b.dataset.note, levee: !(n && n.levee) });
        s.livre = r.livre; relire();
      } catch (e) { toast(plainError(e), 'error'); }
    }; });

    $$('[data-qq]', el).forEach(b => { b.onclick = () => {
      const q = (s.revision.dossier.questionnaire || []).find(x => x.id === b.dataset.qq);
      modal(`<h2>Répondre</h2><p class="small">${esc((q && q.question) || '')}</p>
        <label class="field"><span>La réponse</span><textarea id="qq-rep" rows="3">${esc((q && q.reponse) || '')}</textarea></label>
        <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="qq-ok">Enregistrer</button></div>`,
      (couche, close) => { $('#qq-ok', couche).onclick = async () => {
        try {
          const r = await api.questionnaire({ dossierId: dossier.id, annee: s.annee, periode: s.revision.dossier.periode, id: b.dataset.qq, reponse: $('#qq-rep', couche).value });
          s.livre = r.livre; close(); relire();
        } catch (e) { toast(plainError(e), 'error'); }
      }; });
    }; });

    const poser = $('#rv-poser', el);
    if (poser) poser.onclick = async () => {
      try {
        const r = await api.questionnaire({ dossierId: dossier.id, annee: s.annee, periode: s.revision.dossier.periode, poser: true });
        s.livre = r.livre; toast(`${pl(r.poses, 'question posée', 'questions posées')}.`); relire();
      } catch (e) { toast(plainError(e), 'error'); }
    };
    const mod = $('#rv-modeles', el);
    if (mod) mod.onclick = () => versReglages('pan-questionnaire');
    const nb = $('#rv-note', el); if (nb) nb.onclick = () => noteForm(root, dossier, {});
    const qb = $('#rv-question', el); if (qb) qb.onclick = () => questionForm(root, dossier, {});

    const arr = $('#rv-arreter', el);
    if (arr) arr.onclick = async () => {
      const faite = !s.revision.dossier.faite;
      if (faite) {
        const c = s.revision.controles || [];
        // U-28 — une période se NOMME : « Arrêter la révision de 2026-08 ? » était le format du
        // fichier, écrit dans une question posée à un comptable.
        const per = String(s.revision.dossier.periode);
        const ok = await confirmDialog(`Arrêter la révision ${/^\d{4}-\d{2}$/.test(per) ? K.de(moisLabelCourt(per)) : 'de l\'exercice ' + per} ?`,
          '<p>La période est marquée révisée dans le tableau de production. Tu peux la rouvrir à tout moment.</p>'
          + (c.length ? `<p><b>${pl(c.length, 'point signalé', 'points signalés')} :</b></p><ul>${c.map(x => `<li>${esc(x.texte)}</li>`).join('')}</ul>` : ''),
          'Arrêter la révision', false);
        if (!ok) return;
      }
      try {
        const r = await api.arreterRevision({ dossierId: dossier.id, annee: s.annee, periode: s.revision.dossier.periode, faite });
        s.livre = r.livre; toast(r.faite ? 'Révision arrêtée.' : 'Révision rouverte.'); relire();
      } catch (e) { toast(plainError(e), 'error'); }
    };

    const env = $('#rv-envoyer', el);
    if (env) env.onclick = () => envoyerQuestions(root, dossier);
  }

  function noteForm(root, dossier, base) {
    const s = livresState;
    modal(`<h2>Note de revue</h2>
      <p class="small muted">Ce qu'il reste à vérifier${base.compte ? ` sur le compte ${esc(base.compte)}` : ''}. Elle reste dans le
      dossier de révision et ne part jamais chez le client — c'est une note pour toi et ton équipe.</p>
      <label class="field obligatoire"><span>La note</span><textarea id="nv-texte" rows="3" placeholder="Rapprocher le 471 avec le relevé de décembre"></textarea></label>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="nv-ok">Écrire la note</button></div>`,
    (couche, close) => { $('#nv-ok', couche).onclick = async () => {
      const t = $('#nv-texte', couche).value.trim();
      if (!t) return toast('Une note de revue sans texte n\'apprend rien.', 'error');
      try {
        const r = await api.noteRevue({ dossierId: dossier.id, annee: s.annee, periode: (s.revision && s.revision.dossier.periode) || String(s.annee),
          note: { texte: t, compte: base.compte || '', cycle: base.cycle || '' } });
        s.livre = r.livre; close(); s.revisionRev = ''; chargerRevision(root, dossier);
      } catch (e) { toast(plainError(e), 'error'); }
    }; });
  }

  // Une question naît d'une LIGNE : elle porte le compte, la pièce et l'écriture sur lesquels elle
  // est née. C'est ce qui permet à SkanFact de l'afficher EN FACE de la pièce chez le client, au
  // lieu de la ranger dans une liste que personne n'ouvre — et c'est tout l'intérêt du mécanisme.
  function questionForm(root, dossier, base, id) {
    const s = livresState;
    const q = id ? (s.revision.questions || []).find(x => x.id === id) : null;
    const b = base || {};
    modal(`<h2>${id ? 'Préciser la question' : 'Poser une question au client'}</h2>
      <p class="small muted">Elle s'affichera chez lui <b>en face de la pièce</b> qu'elle vise, et sa réponse
      reviendra toute seule dans son prochain paquet. Rien de ce que tu écris ici ne touche à ses chiffres.</p>
      <div class="grid-2">
        <label class="field">${lbl('La pièce', 'qf.piece')}<input type="text" id="qf-piece" value="${esc((q && q.piece) || b.piece || '')}" placeholder="FAC-2026-014"></label>
        <label class="field">${lbl('Le compte', 'qf.compte')}<input type="text" id="qf-compte" value="${esc((q && q.compte) || b.compte || '')}" placeholder="471"></label>
        <label class="field">${lbl('L\'objet', 'qf.objet')}<input type="text" id="qf-objet" value="${esc((q && q.objet) || '')}" placeholder="Justificatif absent"></label>
        <label class="field">${lbl('Ce que tu attends', 'qf.attendu')}<select id="qf-attendu">${KC.QUESTION_ATTENDUS.map(a => `<option value="${esc(a.id)}" ${(q ? q.attendu : 'explication') === a.id ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select></label>
        <label class="field obligatoire span-2">${lbl('La question', 'qf.texte')}
          <textarea id="qf-texte" rows="3" placeholder="Peux-tu m'envoyer la facture correspondant à ce virement de 1 200 DT ?">${esc((q && q.texte) || '')}</textarea></label>
      </div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="qf-ok">${id ? 'Enregistrer' : 'Poser la question'}</button></div>`,
    (couche, close) => { $('#qf-ok', couche).onclick = async () => {
      const champs = {
        piece: $('#qf-piece', couche).value.trim(), compte: $('#qf-compte', couche).value.trim(),
        objet: $('#qf-objet', couche).value.trim(), attendu: $('#qf-attendu', couche).value,
        texte: $('#qf-texte', couche).value.trim(), periode: (s.revision && s.revision.dossier.periode) || String(s.annee)
      };
      if (!champs.texte) return refus($('#qf-texte', couche), 'Une question sans texte n\'apprend rien au client.');
      try {
        const r = id
          ? await api.question({ dossierId: dossier.id, annee: s.annee, id, geste: 'modifier', champs })
          : await api.question({ dossierId: dossier.id, annee: s.annee, question: champs });
        s.livre = r.livre; close(); s.revisionRev = ''; chargerRevision(root, dossier);
      } catch (e) { toast(plainError(e), 'error'); }
    }; });
  }

  // L'envoi. Même construction que le dossier de clôture (9.8.0) : un ZIP ordinaire, un manifeste
  // qui porte l'empreinte de chaque fichier, la signature Ed25519 du cabinet, et un mot de passe
  // facultatif. Le client doit pouvoir l'ouvrir avec le Finder même si SkanFact disparaît.
  function envoyerQuestions(root, dossier) {
    const s = livresState;
    const en = (s.revision && s.revision.questions || []).filter(q => q.statut !== 'close' && q.statut !== 'repondue');
    if (!en.length) return toast('Aucune question n\'attend de réponse : il n\'y a rien à envoyer.', 'error');
    modal(`<h2>Envoyer les questions à ${esc(dossier.name)}</h2>
      <p class="small">${esc(pl(en.length, 'question partira', 'questions partiront'))} dans un fichier <code>.skanask</code>.
      Chez le client, chacune s'affiche en face de la pièce qu'elle vise, et ses réponses reviennent dans son prochain paquet.</p>
      <label class="check"><input type="checkbox" id="qe-seal"> Protéger le fichier par un mot de passe</label>
      <label class="field" id="qe-pwf" hidden><span>Le mot de passe</span><input type="password" id="qe-pw" placeholder="Dis-le-lui au téléphone, jamais dans le même mail"></label>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="qe-ok">Écrire le fichier…</button></div>`,
    (couche, close) => {
      const c = $('#qe-seal', couche);
      c.onchange = () => { $('#qe-pwf', couche).hidden = !c.checked; };
      $('#qe-ok', couche).onclick = async () => {
        const pw = c.checked ? $('#qe-pw', couche).value.trim() : '';
        if (c.checked && pw.length < 6) return refus($('#qe-pw', couche), 'Choisis un mot de passe d\'au moins six caractères.');
        try {
          const r = await api.ecrireQuestions({ dossierId: dossier.id, annee: s.annee, motDePasse: pw });
          close();
          if (r.annule) return;
          s.livre = r.livre; s.revisionRev = '';
          chargerRevision(root, dossier);
          // 10.13.0 (test humain du pont) — « 1 question envoyée » disait faux : un FICHIER vient
          // d'être écrit, et il reste à le transmettre. Même compte rendu que le fichier
          // d'appairage : ce qu'il faut en faire, où il est, et le bouton qui le montre.
          const pluriel = r.envoyees > 1 ? 's' : '';
          const quoi = `${pl(r.envoyees, 'question', 'questions')}${r.signe ? ` signée${pluriel}` : ''}${r.scelle ? ` et scellée${pluriel}` : ''}`;
          const voir = await confirmDialog('Fichier de questions écrit',
            `<p>${esc(quoi)} dans ce fichier. Envoie-le à ${esc(dossier.name)} (par mail, par exemple) : il l'ouvre dans SkanFact, et ses réponses te reviendront dans son prochain paquet.${r.scelle ? ' Dis-lui le mot de passe au téléphone, jamais dans le même mail.' : ''}</p>
             <p class="muted small">${esc(r.path || '')}</p>`, 'Le montrer dans le dossier', false, 'Fermer');
          if (voir && r.path) api.reveal(r.path);
        } catch (e) { toast(plainError(e), 'error'); }
      };
    });
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
        // 10.10.0 (C-14) — le refus se MONTRE (7.0.0). Le bouton acceptait le clic, l'exercice
        // restait clos, et rien ne le disait : la phrase « il est obligatoire » était déjà là avant
        // le clic, c'était une consigne, pas une réponse. On amène le champ, on y met le curseur.
        const motif = $('#cl-motif', rootModal).value.trim();
        if (!motif) return refus($('#cl-motif', rootModal), 'Écris pourquoi tu rouvres cet exercice : sans motif, personne ne saura dans six mois pourquoi un chiffre a changé.');
        try {
          const r = await api.rouvrir({ dossierId: dossier.id, annee: s.annee, motif });
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
    if (d.erreur) return lectureRatee(d.erreur, 'immo');
    const e = d.etat;
    const y = Number(s.annee);
    // 10.12.0 (U-11) — un seul bouton en couleur, et c'est l'ÉTAPE SUIVANTE : une acquisition sans
    // fiche d'abord (tant qu'elle n'en a pas, elle ne s'amortit nulle part), puis les écritures en
    // attente, puis — sur un exercice vide — le premier bien. Quand tout est fait, rien n'est vert.
    // « Ajouter un bien… » était vert en permanence, à côté d'écritures qui attendaient.
    // 10.12.0 (vu au test humain) — « écrire » n'est l'étape suivante que quand c'est DÛ : en
    // septembre, les dotations de décembre ne le sont pas. Le bouton reste armé (on peut préparer
    // l'inventaire plus tôt), il ne prend plus la couleur — la même règle que la pastille.
    const dues = KC.aReclamerImmobilisations(e, s.livre && s.livre.exercice, K.today());
    const suivante = d.aCreer.length ? 'creer' : dues ? 'ecrire' : !e.rows.length ? 'neuf' : '';
    const cls = pas => 'btn btn-sm' + (pas === suivante ? ' btn-primary' : '');
    // U-23 — un bouton éteint dit POURQUOI à côté de lui : l'infobulle ne se voit ni au clavier ni
    // au doigt. « Passées » seulement si une écriture l'est vraiment — un parc entièrement amorti
    // n'a rien à écrire, il n'a rien « déjà passé ».
    const pourquoiEcrire = e.aEcrire ? ''
      : !e.rows.length ? 'Rien à écrire : aucun bien sur cet exercice.'
        : e.rows.some(r => r.ecrite) ? `Celles de ${s.annee} sont passées — les repasser compterait la dotation deux fois.`
          : `Aucune dotation ni sortie sur ${s.annee} : rien à écrire.`;
    const au = String((s.livre && s.livre.exercice && s.livre.exercice.au) || `${s.annee}-12-31`);
    const motifs = !e.rows.length ? ['« Passer les écritures d\'inventaire » et « Exporter le tableau » attendent un premier bien.']
      : pourquoiEcrire ? ['« Passer les écritures d\'inventaire » : ' + pourquoiEcrire.charAt(0).toLowerCase() + pourquoiEcrire.slice(1)]
        : !dues ? [`Les dotations de ${s.annee} s'écrivent à l'inventaire, au ${fmtJour(au)} : rien ne presse, le bouton les prépare dès maintenant si tu le veux.`] : [];
    return `<div class="filters">
      ${info('im.etat')}
      <span class="small muted">Exercice ${esc(s.annee)}</span>
      <button class="${cls('neuf')}" id="im-neuf">Ajouter un bien…</button>
      <button class="${cls('ecrire')}" id="im-ecrire" ${e.aEcrire ? '' : 'disabled'}
        title="${esc(pourquoiEcrire)}">Passer les écritures d'inventaire${
  e.aEcrire ? ` (${e.aEcrire})` : ''}</button>
      <button class="btn btn-sm btn-ghost" id="im-csv" ${e.rows.length ? '' : 'disabled'}
        title="${e.rows.length ? '' : 'Rien à exporter : le tableau est vide.'}">Exporter le tableau</button>
    </div>
    ${motifs.length ? `<p class="small muted mb" id="im-motifs">${motifs.map(esc).join(' · ')}</p>` : ''}
    ${d.aCreer.length ? `<div class="warn-box mb"><b>${pl(d.aCreer.length, 'ligne', 'lignes')} au compte
      d'immobilisation ${d.aCreer.length > 1 ? 'n\'ont' : 'n\'a'} pas de fiche.</b>
      Tant qu'une fiche n'existe pas, ce bien ne s'amortit nulle part. On ne la crée jamais tout seul :
      la durée d'amortissement est une décision, pas une donnée.
      <div class="scroll-x mt"><table class="list compact"><thead><tr><th class="nw">Date</th><th>Libellé</th>
        <th class="nw">Compte</th><th class="r nw">Montant</th><th></th></tr></thead>
      <tbody>${d.aCreer.slice(0, 12).map((l, k) => `<tr>
        <td class="nw">${esc(fmtJour(l.date))}</td><td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td>
        <td class="nw">${esc(l.compte)}</td><td class="r nw">${esc(money(l.montant))}</td>
        <td class="row-actions"><button class="btn btn-sm${k === 0 ? ' btn-primary' : ''}" data-creer="${esc(l.docId)}">Créer la fiche du bien…</button></td>
      </tr>`).join('')}</tbody></table></div>${d.aCreer.length > 12
    ? `<p class="small mt">… et ${esc(pl(d.aCreer.length - 12, 'autre ligne', 'autres lignes'))} : elles remontent ici à mesure que les fiches se créent.</p>` : ''}</div>` : ''}
    <div class="panel mt"><h2>Les biens de l'exercice ${info('im.tableau')}</h2>
      ${!e.rows.length
    ? `<div class="empty mini">Aucun bien sur cet exercice. <button class="btn btn-sm" id="im-neuf2">Ajouter un bien…</button></div>`
    : `<div class="scroll-x"><table class="list compact"><thead><tr>
        ${/* U-20 — les réserves (taux dégressif, bascule, subvention, dérogatoire) vivent dans la
              bulle de la MÉTHODE, là où la décision se lit et se prend : un panneau permanent de quatre
              paragraphes, sous le tableau, se lisait une fois et restait pour toujours (règle 9.4.9). */''}
        ${/* Les en-têtes de plusieurs mots passent à la ligne (comme la Paie) : tenus sur une
              seule, « Mise en service », « Cumul au 01/01 » et « Dotation 2026 » réclamaient leur
              largeur et coupaient le nom du bien à « Serveur Dell R45… » sur un tableau qui avait
              la place de l'écrire. Les VALEURS, elles, ne se coupent jamais. */''}
        <th>Bien</th><th>Mise en service</th><th class="nw">Méthode ${info('im.verifier')}</th>
        <th class="r nw">Valeur</th><th class="r">Cumul au 01/01</th><th class="r">Dotation ${esc(s.annee)}</th>
        <th class="r nw">Cumul</th><th class="r nw">VNC</th><th></th></tr></thead>
      <tbody>${e.rows.map(r => `<tr>
        ${/* 10.14.0 (vu à la souris) — le NOM se coupe, jamais ses marques : écrites à la suite dans
              une cellule tronquée, « repris de 2025 » tombait derrière les points de suspension, et la
              découverte éclairait un « … » en disant « ce bien vient de l'exercice précédent ». */''}
        <td class="tronq" title="${esc(r.libelle)}">${marquesDuNom(esc(r.libelle), [
    r.reporteDe ? `<span class="badge" data-repris="${esc(r.reporteDe)}" title="Repris de l'exercice ${esc(r.reporteDe)} avec son plan d'amortissement">repris de ${esc(r.reporteDe)}</span>` : '',
    r.cession ? `<span class="badge b-part">${esc(r.cession.motif === 'rebut' ? 'rebut' : 'cédé')}</span>` : '',
    r.ecrite ? '<span class="badge b-paid">écrite</span>' : ''])}</td>
        <td class="nw">${esc(fmtJour(r.date))}</td>
        <td class="nw">${esc(METHODE_LABEL[r.methode] || r.methode)}</td>
        ${/* Un total sous une colonne est lu comme sa somme (9.8.8) : un bien sorti le DIT. */''}
        <td class="r nw">${r.cession ? `<span class="muted">${esc(money(r.valeur))}</span><div class="small muted">hors total</div>` : esc(money(r.valeur))}</td>
        <td class="r nw">${esc(money(r.ouverture))}</td>
        <td class="r nw">${esc(money(r.dotation))}</td>
        <td class="r nw">${r.cession ? `<span class="muted">${esc(money(r.cumul))}</span><div class="small muted">hors total</div>` : esc(money(r.cumul))}</td>
        <td class="r nw">${esc(money(r.vnc))}</td>
        ${RowMenu.cellule('IM:' + r.id)}</tr>`).join('')}</tbody>
      <tfoot><tr><th colspan="3">${esc(pl(e.rows.length, 'bien'))}</th>
        <th class="r nw">${esc(money(e.valeur))}</th><th class="r nw">${esc(money(e.ouverture))}</th>
        <th class="r nw">${esc(money(e.dotation))}</th><th class="r nw">${esc(money(e.cumul))}</th>
        <th class="r nw">${esc(money(e.vnc))}</th><th></th></tr></tfoot></table></div>`}
    </div>
    ${immoState.ouverte ? panneauPlan(d, immoState.ouverte, y) : ''}`;
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
  f.methode === 'degressif' ? ` au taux de ${esc(taux(f.tauxDegressif))}\u00a0%${f.bascule ? ', avec bascule au linéaire' : ''}` : ''}
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
    const rev = revDuLivre(s.livre);
    if (!s.immo || s.immoRev !== rev) { s.immoRev = rev; chargerImmobilisations(root, dossier); return; }
    if (s.immo.erreur) return;
    [$('#im-neuf', el), $('#im-neuf2', el)].forEach(b => { if (b) b.onclick = () => immoForm(root, dossier, null); });
    $$('[data-creer]', el).forEach(b => {
      b.onclick = () => {
        const l = (s.immo.aCreer || []).find(x => x.docId === b.dataset.creer);
        // 10.10.0 (C-10) — une ligne datée du PREMIER JOUR de l'exercice est un à-nouveau : elle
        // porte un bien (ou tout un parc) DÉJÀ amorti. La date proposée n'est donc pas sa date de
        // mise en service, et le formulaire le dit avant qu'on l'enregistre.
        if (l) immoForm(root, dossier, { libelle: l.libelle, compte: l.compte, valeur: l.montant, dateAcquisition: l.date, dateMiseEnService: l.date,
          reprise: l.date === (s.livre.exercice || {}).du || /nouveau/i.test(l.libelle || ''),
          origine: { source: 'paquet', docId: l.docId, mois: String(l.date).slice(0, 7) } });
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
        { label: 'Bien', get: r => r.libelle }, { label: 'Mise en service', get: r => K.csvDate(r.date) },
        { label: 'Méthode', get: r => METHODE_LABEL[r.methode] || r.methode },
        { label: 'Valeur', get: r => K.csvMontant(r.valeur) }, { label: 'Cumul au 01/01', get: r => K.csvMontant(r.ouverture) },
        { label: 'Dotation', get: r => K.csvMontant(r.dotation) }, { label: 'Cumul', get: r => K.csvMontant(r.cumul) },
        { label: 'VNC', get: r => K.csvMontant(r.vnc) }
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
    catch (e) { s.immo = { erreur: plainError(e) }; }
    drawLivres(root, dossier);
  }

  function immoForm(root, dossier, fiche) {
    const s = livresState;
    const f = fiche || {};
    const neuf = !f.id;
    const comptes = (s.livre.plan || []).map(c => c.compte);
    const dl = (pref) => comptes.filter(c => String(c).startsWith(pref)).sort();
    const familles = KC.DEFAULT_ASSET_CLASSES;
    // Ce que le compte 28 reprend au premier jour de l'exercice : le chiffre à reconstituer quand on
    // crée la fiche d'un bien repris.
    const du = (s.livre.exercice || {}).du || '';
    const deja28 = f.reprise ? KC.round3(KC.lignesDuLivre(s.livre, { du, au: du })
      .filter(x => String(x.account).startsWith('28')).reduce((t, x) => t + (Number(x.credit) || 0) - (Number(x.debit) || 0), 0)
      + Object.entries(KC.soldesDepuisOuverture(s.livre)).filter(([c]) => c.startsWith('28')).reduce((t, [, v]) => t - v, 0)) : 0;
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
          <input name="dateMiseEnService" placeholder="JJ/MM/AAAA" value="${esc(fmtJour(f.dateMiseEnService || ''))}"></label>
        <label class="field"><span>Date d'acquisition</span>
          <input name="dateAcquisition" placeholder="JJ/MM/AAAA" value="${esc(fmtJour(f.dateAcquisition || ''))}"></label>
        ${/* H-3 — un montant s'écrit dans son champ comme à l'écran (« 1 500,000 »), jamais
              « 1500.5 » : c'est le comptable qui relit le champ, et en français le point sépare
              les milliers. Il se relit par la porte commune (`lireMontant`), qui comprend les deux. */''}
        <label class="field obligatoire"><span>Valeur d'acquisition HT (DT)</span>
          <input name="valeur" class="num montant" inputmode="decimal" placeholder="0,000" value="${esc(montantChamp(f.valeur))}"></label>
        <label class="field"><span>Valeur résiduelle (DT)</span>
          <input name="residuelle" class="num montant" inputmode="decimal" placeholder="0,000" value="${esc(montantChamp(f.residuelle))}"></label>
        <label class="field">${lbl('Méthode', 'im.verifier')}
          <select name="methode">${KC.IMMO_METHODES.map(m =>
    `<option value="${m}" ${(f.methode || 'lineaire') === m ? 'selected' : ''}>${esc(METHODE_LABEL[m])}</option>`).join('')}</select></label>
        <label class="field" id="im-taux-l"><span>Taux dégressif (%)</span>
          <input name="tauxDegressif" class="num" inputmode="decimal" value="${esc(taux(f.tauxDegressif))}"></label>
        <label class="check span-2" id="im-bascule-l"><input type="checkbox" name="bascule" ${f.bascule ? 'checked' : ''}>
          Basculer au linéaire quand il devient plus favorable</label>
        ${/* U-20 — la réserve se lit là où la décision se prend : sous le taux dégressif, et
              seulement quand on a choisi le dégressif. Elle vivait dans un panneau permanent,
              sous le tableau, où personne ne la relisait au moment de choisir. */''}
        <p class="small muted champ-note span-2" id="im-degr-n">${esc(KC.IMMO_A_VERIFIER.tauxDegressif)} ${esc(KC.IMMO_A_VERIFIER.bascule)}</p>
        <label class="field obligatoire"><span>Compte du bien</span>
          <input name="compte" value="${esc(f.compte || '22')}" list="im-c1"><datalist id="im-c1">${dl('2').map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field"><span>Compte d'amortissement</span>
          <input name="compteAmort" value="${esc(f.compteAmort || '28')}" list="im-c1"></label>
        <label class="field"><span>Compte de dotation</span>
          <input name="compteDotation" value="${esc(f.compteDotation || '681')}" list="im-c2"><datalist id="im-c2">${dl('6').map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field"><span>Subvention reçue (DT, À VÉRIFIER)</span>
          <input name="subvention" class="num montant" inputmode="decimal" placeholder="0,000" value="${esc(montantChamp(f.subvention && f.subvention.montant))}">
          <span class="champ-note" id="im-sub-n">${esc(KC.IMMO_A_VERIFIER.subvention)}</span></label>
        <label class="field"><span>Date de cession ou de rebut</span>
          <input name="cessionDate" placeholder="JJ/MM/AAAA" value="${esc(fmtJour((f.cession && f.cession.date) || ''))}"></label>
        <label class="field"><span>Prix de cession (DT, 0 = rebut)</span>
          <input name="cessionPrix" class="num montant" inputmode="decimal" placeholder="0,000" value="${esc(montantChamp(f.cession && f.cession.prix))}"></label>
      </form>
      ${f.reprise ? `<div class="warn-box mt"><b>Cette ligne est un à-nouveau.</b> Elle porte un bien — ou tout un parc —
        <b>déjà amorti</b>${deja28 ? ` : le compte 28 en reprend ${esc(money(deja28))} au même jour` : ''}. Indique sa <b>vraie</b> date de
        mise en service, pas le 1<sup>er</sup> janvier : c'est elle qui reconstitue ce qui a déjà été amorti. Un parc
        entier se reprend mieux bien par bien — une fiche par bien, chacune à sa date.</div>` : ''}
      <div id="im-apercu" class="small muted"></div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">${neuf ? 'Ajouter' : 'Enregistrer'}</button></div>`,
    (rootModal, close) => {
      const v = n => (($(`[name=${n}]`, rootModal) || {}).value || '').trim();
      // Une date se TAPE comme partout ailleurs (« 01/03/2021 ») et se range en ISO (C-04) : le champ
      // montrait « 2026-01-01 » et n'acceptait que ça, à côté d'écrans qui écrivent 01/01/2026.
      const jour = n => { const t = v(n); return t ? (K.dateTapee(t, s.annee, `${s.annee}-01`) || t) : ''; };
      const lire = () => {
        const cd = jour('cessionDate');
        return {
          ...(f.id ? { id: f.id } : {}),
          libelle: v('libelle'),
          duree: Number(v('duree')) || 0,
          dateMiseEnService: jour('dateMiseEnService'),
          dateAcquisition: jour('dateAcquisition') || jour('dateMiseEnService'),
          valeur: lireMontant(v('valeur')),
          residuelle: lireMontant(v('residuelle')),
          methode: v('methode'),
          tauxDegressif: v('tauxDegressif') === '' ? null : Number(String(v('tauxDegressif')).replace(',', '.')),
          bascule: !!($('[name=bascule]', rootModal) || {}).checked,
          compte: v('compte'), compteAmort: v('compteAmort'), compteDotation: v('compteDotation'),
          subvention: v('subvention') ? { montant: lireMontant(v('subvention')) } : null,
          // Le motif se lit sur le prix LU, jamais sur le texte : « 1 500,000 » donnait `Number` NaN,
          // et une vraie cession s'écrivait « mise au rebut » (H-3).
          cession: cd ? { date: cd, prix: lireMontant(v('cessionPrix')), motif: lireMontant(v('cessionPrix')) ? 'cession' : 'rebut' } : null,
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
        $('#im-degr-n', rootModal).style.display = deg ? '' : 'none';
        // La réserve de la subvention n'apparaît qu'une fois un montant tapé : elle ne concerne
        // pas les neuf biens sur dix qui n'en ont pas.
        $('#im-sub-n', rootModal).style.display = lireMontant(v('subvention')) ? '' : 'none';
      };
      // U-13 — un refus avant le premier geste accuse un formulaire que personne n'a encore
      // touché : « Le bien n'a pas de libellé » s'affichait en orange à l'ouverture d'un bien neuf.
      // Il attend la première frappe ; une fiche qu'on rouvre, elle, se juge tout de suite.
      let touche = !!f.id;
      const maj = () => {
        majTaux();
        const p = lire();
        const illisible = montantIllisibleDans(rootModal);
        const val = illisible ? { ok: false, motifs: [motifIllisible(illisible.value)] } : KC.immoValide(p);
        if (!val.ok) { apercu.innerHTML = touche ? `<div class="warn-box mt">${esc(val.motifs[0])}</div>` : ''; return; }
        const plan = KC.planDuBien(p);
        // Le cumul déjà pratiqué au premier jour de l'exercice : c'est ce qu'on vérifie quand on
        // reprend un bien, et la fiche l'annonce avant qu'on l'enregistre (C-10).
        const avant = KC.cumulDuBien(p, `${Number(s.annee) - 1}-12-31`);
        apercu.innerHTML = `<div class="ok-box mt">${esc(pl(plan.length, 'exercice'))} —
          première dotation ${esc(money(plan.length ? plan[0].dotation : 0))},
          dernière ${esc(money(plan.length ? plan[plan.length - 1].dotation : 0))},
          VNC finale ${esc(money(plan.length ? plan[plan.length - 1].vnc : 0))}.
          <br><b>Déjà amorti au 01/01/${esc(s.annee)} : ${esc(money(avant))}</b>${f.reprise && deja28 && Math.abs(KC.round3(avant - deja28)) >= 0.001
    ? ` <span class="err-inline">— le compte 28 en reprend ${esc(money(deja28))}</span>` : ''}.</div>`;
      };
      const majTouche = () => { touche = true; maj(); };
      $$('input,select', rootModal).forEach(x => { x.oninput = majTouche; x.onchange = majTouche; });
      // La famille PROPOSE sa durée, elle ne l'impose pas : dès que la durée a été touchée, on n'y
      // revient plus (même motif que `regimeTouche`, 7.25.0).
      let dureeTouchee = !!f.duree;
      const dd = $('[name=duree]', rootModal); if (dd) dd.oninput = () => { dureeTouchee = true; majTouche(); };
      const fam = $('[name=famille]', rootModal);
      if (fam) fam.onchange = () => {
        const o = fam.selectedOptions[0];
        if (o && o.dataset.duree && !dureeTouchee) dd.value = o.dataset.duree;
        majTouche();
      };
      maj();
      $('#ok', rootModal).onclick = async () => {
        // Cliquer « Ajouter » sur un formulaire vide est un geste : le refus se montre dès lors.
        majTouche();
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


  // ---------- la paie d'un dossier (10.3.0) ----------
  //
  // Le travail mensuel le plus réclamé après la TVA, et le Cabinet ne savait pas le faire. Un
  // cabinet a soixante clients dont deux utilisent SkanFact : pour les cinquante-huit autres, le
  // comptable établissait les bulletins ailleurs et RETAPAIT l'écriture ici.
  //
  // Tout se calcule sur `s.livre`, déjà en mémoire : le moteur est celui de l'app entreprise
  // (`compta.js`), donc le bulletin du client et celui du cabinet ne peuvent pas diverger.
  function vuePaie(dossier) {
    const s = livresState;
    const L = s.livre;
    // U-12 — le dernier mois qui a des bulletins, sinon le mois courant : jamais décembre en
    // septembre, un mois futur qui avait l'air d'un dossier vide.
    if (!s.paieMois) s.paieMois = K.moisDeTravail((L.bulletins || []).filter(b => Number(b.annee) === Number(s.annee)).map(b => b.mois), s.annee, K.today());
    const m = s.paieMois;
    const bulletins = KC.bulletinsDuMois(L, s.annee, m);
    const masse = KC.masseSalariale(bulletins);
    const anneeEntiere = KC.masseSalariale((L.bulletins || []).filter(b => Number(b.annee) === Number(s.annee)));
    const controles = KC.controlesPaie(L, s.annee, m);
    const aFaire = controles.filter(c => c.niveau !== 'info'), etatsNormaux = controles.filter(c => c.niveau === 'info');
    const aPasser = bulletins.filter(b => !b.ecritureId).length;
    const nomDe = id => ((L.salaries || []).find(x => x.id === id) || {}).nom || '—';
    // Trois états, le vocabulaire du LIVRE (10.12.0) : « brouillon » disait un bulletin sans aucune
    // écriture, et « écrite » une écriture encore au brouillard — pendant que la déclaration du même
    // mois disait « pas encore d'écriture validée ». Deux écrans ne se contredisent pas (6.8.1).
    const statutDe = id => (ecritureDuLivre(L, id) || {}).statut;
    const etatDe = b => !b.ecritureId ? 'a-passer' : statutDe(b.ecritureId) === 'brouillard' ? 'brouillard' : 'ecrite';
    const auBrouillard = bulletins.some(b => etatDe(b) === 'brouillard');
    const t = s.paieTrimestre || Math.ceil(m / 3);
    const cnss = KC.cnssDuTrimestre(L, s.annee, t);
    const actifs = (L.salaries || []).filter(x => x.actif);

    const lignesBulletins = bulletins.map(b => {
      const c = b.calcul || {};
      return `<tr data-bul="${esc(b.id)}">
        <td class="tronq" title="${esc(nomDe(b.salarieId))}">${esc(nomDe(b.salarieId))}</td>
        <td class="r nw">${esc(money(c.gross))}</td>
        <td class="r nw">${esc(money(c.cnssEmployee))}</td>
        <td class="r nw">${esc(money(KC.round3((c.irpp || 0) + (c.css || 0))))}</td>
        <td class="r nw"><b>${esc(money(c.net))}</b></td>
        <td class="r nw">${esc(money(KC.employerChargesOf(c)))}</td>
        <td class="r nw">${esc(money(c.employerCost))}</td>
        <td class="nw">${{ 'a-passer': '<span class="badge b-due">à passer</span>', brouillard: '<span class="badge b-part">au brouillard</span>', ecrite: '<span class="badge b-paid">écrite</span>' }[etatDe(b)]}</td>
        ${RowMenu.cellule('PAIE:' + b.id)}</tr>`;
    }).join('');

    // U-11 — le bouton en couleur est l'ÉTAPE SUIVANTE du mois : un salarié à déclarer, puis les
    // bulletins qui manquent, puis l'écriture. « + Bulletin… » était vert sur un dossier sans
    // salarié — principal ET éteint, c'est-à-dire un geste qu'on montre du doigt et qu'on refuse.
    const manquants = (controles.find(c => c.id === 'bulletins-manquants') || {}).count || 0;
    // Au brouillard, l'étape suivante est de VALIDER : la paie n'entre dans les livres qu'à ce moment.
    const suivante = !actifs.length ? 'salarie' : manquants ? 'bulletin' : aPasser ? 'ecrire' : auBrouillard ? 'valider' : '';
    const cls = pas => 'btn btn-sm' + (pas === suivante ? ' btn-primary' : '');
    // U-23 — un bouton éteint dit POURQUOI à côté de lui, pas seulement au survol : l'infobulle ne
    // se voit ni au clavier ni au doigt (règle 9.4.5). Le `title` reste, pour qui survole.
    const pourquoiBulletin = actifs.length ? '' : 'Déclare d\'abord un salarié.';
    const pourquoiEcrire = aPasser ? '' : (bulletins.length ? 'L\'écriture de ce mois est déjà passée : la repasser compterait la paie deux fois.' : 'Aucun bulletin pour ce mois.');
    const motifs = [pourquoiBulletin && '« + Bulletin » attend un salarié : déclare-le d\'abord.',
      pourquoiEcrire && (bulletins.length ? '« Passer l\'écriture de paie » : celle de ce mois est déjà passée — la repasser compterait la paie deux fois.'
        : '« Passer l\'écriture de paie » attend les bulletins du mois.')].filter(Boolean);
    return `<div class="filters">
      ${info('pa.mois')}
      <label class="f-lab" for="pa-mois">Mois</label>
      <select id="pa-mois">${KC.MOIS_PAIE.map((lab, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${esc(lab)} ${esc(s.annee)}</option>`).join('')}</select>
      <button class="${cls('salarie')}" id="pa-salarie">+ Salarié…</button>
      <button class="${cls('bulletin')}" id="pa-bulletin" ${actifs.length ? '' : 'disabled'}
        title="${esc(pourquoiBulletin)}">+ Bulletin…</button>
      <button class="${cls('ecrire')}" id="pa-ecrire" ${aPasser ? '' : 'disabled'}
        title="${esc(pourquoiEcrire)}">Passer l'écriture de paie</button>
    </div>
    ${motifs.length ? `<p class="small muted mb" id="pa-motifs">${motifs.map(esc).join(' · ')}</p>` : ''}
    ${/* U-13 — l'orange seulement quand il y a un geste à faire. « 1 bulletin non réglé » est
          l'état NORMAL d'un bulletin qu'on vient d'établir : il se dit, en gris, sans alarme. */''}
    ${aFaire.length ? `<div class="warn-box mb">${aFaire.map(c => `<div class="ctrl-geste"><span><b>${esc(c.quoi)}</b> — ${esc(c.detail)}</span>${
      // Ce que le contrôle nomme, il l'ouvre (7.15.0) : le numéro manquant se renseigne sur la fiche.
      // Le geste vit dans une rangée flex, pas dans la phrase (règle 9.8.8, T-56) : à 1280 px il
      // passait à la ligne collé sous le texte, à 3 px (mesuré par e2e:cabinet-rendu).
      (c.ids || []).map(id => `<button type="button" class="btn btn-sm" data-sal-cnss="${esc(id)}">Renseigner le n° de ${esc(nomDe(id))}…</button>`).join('')}</div>`).join('')}
      <div class="small muted">Ces contrôles NOMMENT, ils ne bloquent rien : un mois traité avec deux manques signalés vaut mieux qu'un mois jamais traité.</div></div>` : ''}
    ${etatsNormaux.length ? `<p class="small muted mb">${etatsNormaux.map(c => `${esc(c.quoi)} — ${esc(c.detail)}`).join(' · ')}</p>` : ''}
    ${/* Le geste vit dans une rangée flex, pas dans la phrase (T-56) : passé à la ligne, le bouton se
         collait sous le texte, à zéro pixel (vu au test humain, 10.14.1). */''}
    ${auBrouillard ? `<div class="small mb ctrl-geste" id="pa-brouillard"><span>L'écriture de paie ${esc(KC.deMois(KC.moisPaie(m)))} est <b>au brouillard</b> : elle n'entre dans les livres — et dans la déclaration du mois — qu'une fois validée.</span>
      <button type="button" class="${cls('valider')}" id="pa-valider">La valider dans la saisie</button></div>` : ''}

    <div class="panel mt"><h2>Les bulletins ${esc(KC.deMois(KC.moisPaie(m)))} ${esc(s.annee)} ${info('pa.bulletins')}</h2>
      ${bulletins.length
    ? `<div class="scroll-x"><table class="list compact pa-bulletins"><thead><tr><th>Salarié</th>
        ${/* Les en-têtes de plusieurs mots passent sur deux lignes : tenus sur une seule, ils
              réclamaient 174 px pour « Charges patronales » et laissaient 90 px au nom du salarié,
              coupé à « Sonia Kh… » sur un tableau qui avait la place de l'écrire. */''}
        <th class="r nw">Brut</th><th class="r">CNSS salarié</th><th class="r nw">IRPP + CSS</th>
        <th class="r">Net à payer</th><th class="r">Charges patronales</th><th class="r">Coût employeur</th>
        <th class="nw">Écriture</th><th class="row-actions-h"></th></tr></thead>
        <tbody>${lignesBulletins}</tbody>
        <tfoot><tr><th class="nw">${esc(pl(masse.count, 'bulletin'))}</th>
          <th class="r nw">${esc(money(masse.brut))}</th><th class="r nw">${esc(money(masse.cnssSalarie))}</th>
          <th class="r nw">${esc(money(KC.round3(masse.irpp + masse.css)))}</th><th class="r nw">${esc(money(masse.net))}</th>
          <th class="r nw">${esc(money(masse.chargesPatronales))}</th><th class="r nw">${esc(money(masse.cout))}</th>
          <th colspan="2"></th></tr></tfoot></table></div>`
    : `<div class="empty">Aucun bulletin pour ${esc(KC.moisPaie(m))} ${esc(s.annee)}${actifs.length ? '.' : ' : il faut d\'abord un salarié.'}
        ${/* Le geste de l'état vide n'est PAS un second vert : la couleur est à l'étape suivante, en
              haut (U-11). Sans salarié, il n'y a rien à établir ici — le panneau des salariés, juste
              en dessous, porte le geste qui débloque. « Un bulletin garde une copie de son calcul »
              vit dans la bulle du mois (9.4.9) : répétée ici, c'était une notice sous un vide. */''}
        ${actifs.length ? '<div class="mt"><button class="btn" id="pa-bulletin2">Établir un bulletin…</button></div>' : ''}</div>`}
    </div>

    ${/* Empilés, pas côte à côte (règle 3.4.0) : deux tableaux de cinq et six colonnes dans un
          `.split` débordaient chacun de leur moitié — 107 et 46 px à 1440 — et coupaient les noms. */''}
    <div class="panel mt"><h2>Les salariés ${info('pa.salaries')}</h2>
        ${(L.salaries || []).length
    ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Nom</th><th class="nw">N° CNSS</th>
        <th>Poste</th><th class="nw">Contrat</th><th class="r nw">Brut mensuel</th><th class="row-actions-h"></th></tr></thead>
        <tbody>${(L.salaries || []).map(x => `<tr class="${x.actif ? '' : 'muted'}" data-sal="${esc(x.id)}">
          <td class="tronq" title="${esc(x.nom)}">${marquesDuNom(esc(x.nom), [
    x.reporteDe ? `<span class="badge" data-repris="${esc(x.reporteDe)}" title="Repris de l'exercice ${esc(x.reporteDe)} : sa fiche a suivi, ses bulletins restent dans leur mois">repris de ${esc(x.reporteDe)}</span>` : '',
    x.actif ? '' : '<span class="badge">sorti</span>'])}</td>
          <td class="nw">${x.cnss ? esc(x.cnss) : '<span class="warn-text small">à renseigner</span>'}</td>
          <td class="tronq" title="${esc(x.poste)}">${esc(x.poste || '—')}</td>
          <td class="nw small">${esc(KC.contractLabel(x.contrat).split(' —')[0])}</td>
          <td class="r nw">${esc(money(x.brut))}</td>
          ${RowMenu.cellule('SAL:' + x.id)}</tr>`).join('')}</tbody></table></div>`
    : `<div class="empty mini">Aucun salarié déclaré. C'est par là qu'une paie commence.
        <div class="mt"><button class="btn btn-sm" id="pa-salarie2">Déclarer un salarié…</button></div></div>`}
    </div>
    <div class="panel mt"><h2>La déclaration CNSS ${info('pa.cnss')}</h2>
        <div class="filters">
          <label class="f-lab" for="pa-trim">Trimestre</label>
          <select id="pa-trim">${KC.TRIMESTRES_PAIE.map(x => `<option value="${x[0]}" ${x[0] === t ? 'selected' : ''}>${esc(x[1])} ${esc(s.annee)}</option>`).join('')}</select>
        </div>
        ${cnss.lignes.length
    ? `<div class="scroll-x"><table class="list compact"><thead><tr><th>Salarié</th><th class="nw">N° CNSS</th>
        <th class="r nw">Assiette</th><th class="r nw">Part salarié</th><th class="r nw">Part employeur</th></tr></thead>
        <tbody>${cnss.lignes.map(l => `<tr><td class="tronq" title="${esc(l.nom)}">${esc(l.nom)}</td>
          <td class="nw">${l.cnss ? esc(l.cnss) : '<span class="warn-text small">—</span>'}</td>
          <td class="r nw">${esc(money(l.assiette))}</td><td class="r nw">${esc(money(l.partSalarie))}</td>
          <td class="r nw">${esc(money(KC.round3(l.partEmployeur + l.accident)))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th colspan="2">${esc(pl(cnss.salaries, 'salarié'))}</th>
          <th class="r nw">${esc(money(cnss.assiette))}</th><th class="r nw">${esc(money(cnss.partSalarie))}</th>
          <th class="r nw">${esc(money(KC.round3(cnss.partEmployeur + cnss.accident)))}</th></tr>
          <tr class="dc-total"><th colspan="4"><b>Total à verser</b></th><th class="r nw"><b>${esc(money(cnss.total))}</b></th></tr></tfoot></table></div>
        <p class="small muted mt">Échéance proposée : le ${esc(fmtJour(cnss.echeance))}. <b>À VÉRIFIER</b> — la date et la forme
        exacte du dépôt dépendent du régime. SkanFact Cabinet ne dépose rien et ne se connecte à aucune administration :
        c'est un tableau à recopier sur le portail.</p>`
    : `<div class="empty mini">Aucun bulletin sur ce trimestre : il n'y a rien à déclarer.</div>`}
    </div>

    <div class="panel mt"><h2>La masse salariale de l'exercice ${info('pa.masse')}</h2>
      ${/* U-24 — un tableau de zéros n'apprend rien : sans bulletin sur l'exercice, on le dit. */''}
      ${!anneeEntiere.count ? `<div class="empty mini">Aucun bulletin sur l'exercice ${esc(s.annee)} : la masse salariale se calcule dès le premier.</div>` : `
      <table class="list compact"><tbody>
        <tr><td>Brut versé</td><td class="r nw">${esc(money(anneeEntiere.brut))}</td></tr>
        <tr><td>Retenues salariales (CNSS, IRPP, CSS)</td><td class="r nw">${esc(money(KC.round3(anneeEntiere.cnssSalarie + anneeEntiere.irpp + anneeEntiere.css)))}</td></tr>
        <tr><td>Net versé au personnel</td><td class="r nw">${esc(money(anneeEntiere.net))}</td></tr>
        <tr><td>Charges patronales (CNSS, accident, TFP, FOPROLOS)</td><td class="r nw">${esc(money(anneeEntiere.chargesPatronales))}</td></tr>
        <tr class="dc-total"><td><b>Coût employeur</b></td><td class="r nw"><b>${esc(money(anneeEntiere.cout))}</b></td></tr>
      </tbody></table>
      <p class="small muted mt">Ce qui entre dans le résultat, c'est le <b>coût employeur</b> — jamais le net, jamais le brut seul.</p>`}
    </div>`;
  }

  function brancherPaie(el, root, dossier) {
    const s = livresState;
    const redraw = () => drawLivres(root, dossier);
    const mois = $('#pa-mois', el);
    if (mois) mois.onchange = () => { s.paieMois = Number(mois.value) || 1; redraw(); };
    const trim = $('#pa-trim', el);
    if (trim) trim.onchange = () => { s.paieTrimestre = Number(trim.value) || 1; redraw(); };
    [$('#pa-salarie', el), $('#pa-salarie2', el)].forEach(b => { if (b) b.onclick = () => salarieForm(root, dossier, null); });
    $$('[data-sal-cnss]', el).forEach(b => { b.onclick = () => {
      const x = (s.livre.salaries || []).find(y => y.id === b.dataset.salCnss);
      if (x) salarieForm(root, dossier, x, { focus: 'cnss' });
    }; });
    [$('#pa-bulletin', el), $('#pa-bulletin2', el)].forEach(b => { if (b) b.onclick = () => bulletinForm(root, dossier, null); });
    const pv = $('#pa-valider', el);
    if (pv) pv.onclick = () => allerSousOnglet(root, dossier, 'saisie');
    const ec = $('#pa-ecrire', el);
    if (ec) ec.onclick = async () => {
      ec.disabled = true;
      try {
        const r = await api.ecrirePaie({ dossierId: dossier.id, annee: s.annee, mois: s.paieMois });
        s.livre = r.livre;
        toast(`Écriture de paie ${KC.deMois(KC.moisPaie(s.paieMois))} passée en brouillard.`);
        redraw();
      } catch (err) { toast(plainError(err), 'error'); ec.disabled = false; }
    };
    // UNE table d'actions par racine (9.4.8) : celle de la Paie vit sur SON panneau, jamais sur
    // `document` — deux tables posées sur la même racine se mangent, et celle qui perd retire les
    // boutons qu'elle ne reconnaît pas.
    RowMenu.brancherMenus(el, id => {
      if (id.startsWith('SAL:')) {
        const x = (s.livre.salaries || []).find(y => y.id === id.slice(4));
        if (!x) return [];
        const a = [{ icon: 'modifier', label: 'Modifier la fiche', hint: 'Nom, CNSS, poste, brut', run: () => salarieForm(root, dossier, x) }];
        if (x.actif) a.push({ sep: true }, { icon: 'non', label: 'Noter la sortie', danger: true,
          hint: 'Son nom reste sur les bulletins déjà établis', run: async () => {
            if (!await confirmDialog(`Noter la sortie de ${x.nom} ?`, 'Il ne sera plus proposé pour un nouveau bulletin. Son nom reste sur ceux qui existent — un bulletin remis ne se réécrit pas.', 'Noter la sortie')) return;
            try { const r = await api.retirerSalarie({ dossierId: dossier.id, annee: s.annee, id: x.id }); s.livre = r.livre; toast('Sortie notée.'); redraw(); }
            catch (err) { toast(plainError(err), 'error'); }
          } });
        return a;
      }
      const b = (s.livre.bulletins || []).find(y => y.id === id.slice(5));
      if (!b) return [];
      const a = [{ icon: 'ouvrir', label: 'Voir le détail du calcul', hint: 'Assiette, tranches, charges', run: () => detailBulletin(b) }];
      if (!b.ecritureId) a.push(
        { icon: 'modifier', label: 'Modifier le bulletin', hint: 'Brut, primes, absences, retenues', run: () => bulletinForm(root, dossier, b) },
        { sep: true },
        { icon: 'supprimer', label: 'Supprimer ce bulletin', danger: true, hint: 'Possible tant que l\'écriture n\'est pas passée', run: async () => {
          if (!await confirmDialog('Supprimer ce bulletin ?', 'Il n\'a pas encore d\'écriture : rien d\'autre ne bouge.', 'Supprimer', true)) return;
          try { const r = await api.supprimerBulletin({ dossierId: dossier.id, annee: s.annee, id: b.id }); s.livre = r.livre; toast('Bulletin supprimé.'); redraw(); }
          catch (err) { toast(plainError(err), 'error'); }
        } });
      return a;
    });
  }

  // Le détail d'un bulletin, tel qu'il a été FIGÉ. Un chiffre qu'on ne peut pas ouvrir se croit ou
  // ne se croit pas ; celui-ci s'ouvre, ligne par ligne, avec les taux qui ont servi.
  function detailBulletin(b) {
    const c = b.calcul || {};
    const r = c.rates || {};
    const L = livresState.livre;
    const nom = ((L.salaries || []).find(x => x.id === b.salarieId) || {}).nom || '';
    const ligne = (lab, val, sub) => `<tr><td>${esc(lab)}${sub ? `<div class="small muted">${esc(sub)}</div>` : ''}</td><td class="r nw">${esc(money(val))}</td></tr>`;
    modal(`<h2>${esc(nom)} — ${esc(KC.moisPaie(b.mois))} ${esc(b.annee)}</h2>
      <table class="list compact"><tbody>
        ${ligne('Brut de base', c.baseGross)}
        ${c.absenceCut ? ligne('Absence non rémunérée', -c.absenceCut, `${pl(c.absentDays, 'jour')} sur ${c.workedDays}`) : ''}
        ${(c.bonuses || []).map(p => ligne(p.label, p.amount, p.taxable ? 'imposable' : 'non imposable')).join('')}
        <tr class="dc-total"><td><b>Brut du mois</b></td><td class="r nw"><b>${esc(money(c.gross))}</b></td></tr>
        ${ligne('CNSS part salarié', -c.cnssEmployee, `${taux(r.cnssEmployee)}\u00a0% de ${money(c.cnssBase)}`)}
        ${ligne('IRPP', -c.irpp, `barème annuel sur ${money(c.annualTaxable)} imposables`)}
        ${ligne('Contribution sociale de solidarité', -c.css, `${taux(r.solidarity)}\u00a0%`)}
        ${(c.deductions || []).map(d => ligne(d.label, -d.amount)).join('')}
        <tr class="dc-total"><td><b>Net à payer</b></td><td class="r nw"><b>${esc(money(c.net))}</b></td></tr>
        ${ligne('CNSS part employeur', c.cnssEmployer, `${taux(r.cnssEmployer)}\u00a0%`)}
        ${ligne('Accident du travail', c.accident, `${taux(r.accidentRate)}\u00a0%`)}
        ${ligne('TFP', c.tfp, `${taux(r.tfpRate)}\u00a0%`)}
        ${ligne('FOPROLOS', c.foprolos, `${taux(r.foprolosRate)}\u00a0%`)}
        <tr class="dc-total"><td><b>Coût employeur</b></td><td class="r nw"><b>${esc(money(c.employerCost))}</b></td></tr>
      </tbody></table>
      <p class="small muted mt">Les taux affichés sont ceux qui ont servi le jour où ce bulletin a été établi : ils sont
      figés avec lui. <b>À VÉRIFIER</b> — les barèmes changent à chaque loi de finances.</p>
      <div class="modal-actions"><button class="btn btn-primary" data-close>Fermer</button></div>`);
  }

  function salarieForm(root, dossier, x, opts) {
    const s = livresState;
    const e = x || { contrat: 'cdi', actif: true, enfants: 0 };
    modal(`<h2>${x ? 'Modifier ' + esc(x.nom) : 'Déclarer un salarié'}</h2>
      <form id="sf" class="grid-2">
        <label class="field obligatoire span-2"><span>Nom et prénom</span><input name="nom" value="${esc(e.nom || '')}"></label>
        <label class="field"><span>N° CIN</span><input name="cin" value="${esc(e.cin || '')}"></label>
        <label class="field"><span>N° CNSS</span><input name="cnss" value="${esc(e.cnss || '')}"></label>
        <label class="field span-2"><span>Poste occupé</span><input name="poste" value="${esc(e.poste || '')}"></label>
        <label class="field"><span>Type de contrat</span><select name="contrat">${KC.CONTRACT_TYPES.map(c => `<option value="${c[0]}" ${c[0] === (e.contrat || 'cdi') ? 'selected' : ''}>${esc(c[1].split(' —')[0])}</option>`).join('')}</select></label>
        ${/* 10.12.0 — la règle H-3 portée à la Paie (le jumeau manquant) : un montant s'écrit et se
              relit en français (« 1 250,500 »), une date se saisit JJ/MM/AAAA. Les champs
              numériques du navigateur refusaient la virgule sans un mot, et « AAAA-MM-JJ » était
              le format interne affiché sur un écran de saisie (règle 9.4.5). */''}
        <label class="field obligatoire"><span>Salaire brut mensuel (DT)</span><input name="brut" type="text" inputmode="decimal" class="num montant" placeholder="0,000" value="${esc(montantChamp(e.brut))}"></label>
        <label class="field obligatoire"><span>Date d'embauche</span><input name="embauche" placeholder="JJ/MM/AAAA" value="${esc(e.embauche ? fmtJour(e.embauche) : '')}"></label>
        <label class="field"><span>Date de sortie</span><input name="sortie" placeholder="JJ/MM/AAAA" value="${esc(e.sortie ? fmtJour(e.sortie) : '')}"></label>
        <label class="check span-2"><input type="checkbox" name="chefDeFamille" ${e.chefDeFamille ? 'checked' : ''}> Chef de famille (déduction annuelle)</label>
        <label class="field"><span>Enfants à charge</span><input name="enfants" type="number" min="0" step="1" class="num" value="${esc(String(e.enfants || 0))}"></label>
      </form>
      <p class="small muted">Le numéro CNSS n'est pas nécessaire pour calculer un bulletin ; la déclaration trimestrielle le
      demande. Le chef de famille et les enfants à charge entrent dans le calcul de l'IRPP.
      <b>À VÉRIFIER</b> — les conditions et les montants dépendent de la loi de finances.</p>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">Enregistrer</button></div>`,
    (rootModal, close) => {
      // Ouverte pour UN champ (le numéro CNSS qu'un contrôle vient de nommer), elle y met le curseur.
      if (opts && opts.focus) { const c = $(`[name=${opts.focus}]`, rootModal); if (c) c.focus(); }
      $('#ok', rootModal).onclick = async () => {
        const f = $('#sf', rootModal);
        // Une date tapée et illisible se REFUSE en montrant son champ ; vide, elle reste vide.
        const dateDe = (nom, quoi) => {
          const champ = $(`[name=${nom}]`, f), t = champ.value.trim();
          if (!t) return '';
          const iso = K.dateTapee(t, s.annee);
          if (!iso) { refus(champ, `${quoi} : « ${t} » n'est pas une date lisible. Écris-la JJ/MM/AAAA.`); return null; }
          return iso;
        };
        const embauche = dateDe('embauche', 'Date d\'embauche'); if (embauche === null) return;
        const sortie = dateDe('sortie', 'Date de sortie'); if (sortie === null) return;
        const v = {
          id: x ? x.id : '', nom: $('[name=nom]', f).value, cin: $('[name=cin]', f).value,
          cnss: $('[name=cnss]', f).value, poste: $('[name=poste]', f).value,
          contrat: $('[name=contrat]', f).value, brut: lireMontant($('[name=brut]', f).value),
          embauche, sortie,
          chefDeFamille: $('[name=chefDeFamille]', f).checked, enfants: Number($('[name=enfants]', f).value) || 0,
          actif: x ? x.actif : true
        };
        const ok = KC.salarieValide(v);
        if (!ok.ok) return toast(ok.motif, 'error');
        try {
          const r = await api.saveSalarie({ dossierId: dossier.id, annee: s.annee, salarie: v });
          s.livre = r.livre; close(); toast('Salarié enregistré.'); drawLivres(root, dossier);
        } catch (err) { toast(plainError(err), 'error'); }
      };
    });
  }

  function bulletinForm(root, dossier, b) {
    const s = livresState;
    const L = s.livre;
    const actifs = (L.salaries || []).filter(x => x.actif || (b && x.id === b.salarieId));
    const e = b || { mois: s.paieMois, annee: s.annee, joursTravailles: 26, joursAbsence: 0, primes: [], retenues: [] };
    const salDefaut = b ? b.salarieId : (actifs[0] || {}).id;
    const brutDefaut = b ? b.brut : ((actifs[0] || {}).brut || 0);
    modal(`<h2>${b ? 'Modifier le bulletin' : 'Établir un bulletin'}</h2>
      <form id="bf" class="grid-2">
        <label class="field obligatoire span-2"><span>Salarié</span>
          <select name="salarieId" ${b ? 'disabled' : ''}>${actifs.map(x => `<option value="${esc(x.id)}" ${x.id === salDefaut ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="field"><span>Mois</span><select name="mois">${KC.MOIS_PAIE.map((lab, i) => `<option value="${i + 1}" ${i + 1 === Number(e.mois) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select></label>
        <label class="field obligatoire"><span>Brut du mois (DT)</span><input name="brut" type="text" inputmode="decimal" class="num montant" placeholder="0,000" value="${esc(montantChamp(brutDefaut))}"></label>
        <label class="field"><span>Jours ouvrables du mois</span><input name="joursTravailles" type="number" min="1" step="1" class="num" value="${esc(String(e.joursTravailles || 26))}"></label>
        <label class="field"><span>Jours d'absence non payés</span><input name="joursAbsence" type="number" min="0" step="1" class="num" value="${esc(String(e.joursAbsence || 0))}"></label>
        <label class="field span-2"><span>Prime (facultatif)</span><input name="primeLabel" value="${esc(((e.primes || [])[0] || {}).label || '')}" placeholder="Prime de rendement"></label>
        <label class="field"><span>Montant de la prime (DT)</span><input name="primeAmount" type="text" inputmode="decimal" class="num montant" placeholder="0,000" value="${esc(montantChamp(((e.primes || [])[0] || {}).amount))}"></label>
        <label class="check"><input type="checkbox" name="primeTaxable" ${((e.primes || [])[0] || {}).taxable !== false ? 'checked' : ''}> Prime imposable</label>
        <label class="field span-2"><span>Retenue (facultatif)</span><input name="retLabel" value="${esc(((e.retenues || [])[0] || {}).label || '')}" placeholder="Remboursement d'avance"></label>
        <label class="field"><span>Montant de la retenue (DT)</span><input name="retAmount" type="text" inputmode="decimal" class="num montant" placeholder="0,000" value="${esc(montantChamp(((e.retenues || [])[0] || {}).amount))}"></label>
      </form>
      <div id="bf-apercu" class="ok-box mt"></div>
      <p class="small warn-text" id="bf-refus" role="status" aria-live="polite" hidden></p>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">Enregistrer le bulletin</button></div>`,
    (rootModal, close) => {
      const f = $('#bf', rootModal);
      const lire = () => {
        const sal = (L.salaries || []).find(x => x.id === (b ? b.salarieId : $('[name=salarieId]', f).value)) || {};
        const primeM = lireMontant($('[name=primeAmount]', f).value);
        const retM = lireMontant($('[name=retAmount]', f).value);
        return {
          id: b ? b.id : '', salarieId: sal.id, annee: s.annee, mois: Number($('[name=mois]', f).value) || 1,
          brut: lireMontant($('[name=brut]', f).value),
          joursTravailles: Number($('[name=joursTravailles]', f).value) || 26,
          joursAbsence: Number($('[name=joursAbsence]', f).value) || 0,
          primes: primeM ? [{ label: $('[name=primeLabel]', f).value || 'Prime', amount: primeM, taxable: $('[name=primeTaxable]', f).checked }] : [],
          retenues: retM ? [{ label: $('[name=retLabel]', f).value || 'Retenue', amount: retM }] : []
        };
      };
      // L'aperçu se recalcule pendant la frappe : c'est le seul moyen de vérifier un net AVANT de
      // l'enregistrer, et le moteur est exactement celui qui enregistrera (9.4.5) — barèmes DU
      // DOSSIER compris : l'aperçu les ignorait et annonçait un net que l'enregistrement démentait.
      //
      // 10.10.0 (C-11) — et le bouton s'éteint par la MÊME fonction que celle qui refusera
      // (`bulletinValide`), avec son motif AU-DESSUS du bouton (9.4.2). Quarante jours d'absence sur
      // vingt-six affichaient un net de −586 DT sans un mot, et le bulletin s'enregistrait.
      const baremes = dossier.paie || {};
      const maj = () => {
        const v = lire();
        const sal = (L.salaries || []).find(x => x.id === v.salarieId) || {};
        const c = KC.computePayslip({ grossSalary: sal.brut, headOfFamily: sal.chefDeFamille, children: sal.enfants },
          { gross: v.brut, workedDays: v.joursTravailles, absentDays: v.joursAbsence,
            bonuses: v.primes.map(p => ({ label: p.label, amount: p.amount, taxable: p.taxable })),
            deductions: v.retenues.map(d => ({ label: d.label, amount: d.amount })) },
          KC.baremesPaie(baremes));
        const illisible = montantIllisibleDans(rootModal);
        const verdict = illisible ? { ok: false, motif: motifIllisible(illisible.value) } : KC.bulletinValide(v, L, baremes);
        const apercu = $('#bf-apercu', rootModal);
        apercu.className = verdict.ok ? 'ok-box mt' : 'warn-box mt';
        // Un net calculé en lisant une case illisible pour zéro serait un chiffre faux affiché : il
        // attend que la case se lise, et le refus dessous dit laquelle.
        apercu.innerHTML = illisible ? '<b>Net à payer —</b> <span class="small muted">— un montant ne se lit pas encore.</span>' : `<b>Net à payer ${esc(money(c.net))}</b>
          <span class="small muted">— brut ${esc(money(c.gross))}, retenues ${esc(money(KC.round3(c.cnssEmployee + c.irpp + c.css + c.otherDeductions)))},
          coût employeur ${esc(money(c.employerCost))}</span>`;
        const refus = $('#bf-refus', rootModal);
        refus.hidden = verdict.ok;
        refus.textContent = verdict.ok ? '' : verdict.motif;
        const bouton = $('#ok', rootModal);
        bouton.disabled = !verdict.ok;
        bouton.title = verdict.ok ? '' : verdict.motif;
      };
      // Le brut PROPOSÉ suit le salarié choisi, tant qu'on n'y a pas touché (règle 10.6.0 : un champ
      // pré-rempli se recalcule quand ce dont il dépend change). Changer de salarié gardait le brut
      // du premier de la liste : un bulletin juste en apparence, au mauvais salaire.
      let brutTouche = !!b;
      $('[name=brut]', f).addEventListener('input', () => { brutTouche = true; });
      const choixSal = $('[name=salarieId]', f);
      if (choixSal) choixSal.addEventListener('change', () => {
        if (brutTouche) return;
        const sal = (L.salaries || []).find(x => x.id === choixSal.value) || {};
        $('[name=brut]', f).value = montantChamp(sal.brut);
      });
      f.oninput = f.onchange = maj;
      maj();
      $('#ok', rootModal).onclick = async () => {
        const v = lire();
        const ok = KC.bulletinValide(v, L, baremes);
        if (!ok.ok) return toast(ok.motif, 'error');
        try {
          const r = await api.saveBulletin({ dossierId: dossier.id, annee: s.annee, bulletin: v });
          s.livre = r.livre; close(); toast('Bulletin enregistré.'); drawLivres(root, dossier);
        } catch (err) { toast(plainError(err), 'error'); }
      };
    });
  }

  function vueInventaire(dossier) {
    const s = livresState;
    const d = s.inv;
    if (!d) return `<div class="empty mini">Lecture de l'inventaire…</div>`;
    if (d.erreur) return lectureRatee(d.erreur, 'inv');
    const inv = d.inventaire;
    const v = d.variation || {};
    // 10.12.0 (U-11) — un seul vert, l'étape suivante. Sans inventaire, le geste vit dans l'état
    // vide, qui EST le corps de l'écran : deux « Saisir l'inventaire… » verts à quarante pixels
    // l'un de l'autre, c'était le même bouton montré deux fois. Une fois compté, le vert passe à
    // l'écriture de la variation, puis s'éteint : il n'y a plus rien à faire.
    const ecrivable = !!(inv && v.ok && v.ecriture && !inv.ecritureId);
    const suivante = ecrivable ? 'ecrire' : '';
    const cls = pas => 'btn btn-sm' + (pas === suivante ? ' btn-primary' : '');
    // U-23 — la raison d'un bouton éteint se lit à côté de lui : le panneau de la variation vient
    // donc JUSTE sous la barre (le résumé avant le détail), et sa ligne d'état est cette raison.
    // Sous deux cents lignes comptées, elle n'était plus « à côté » de rien.
    const pourquoi = !inv || ecrivable ? '' : inv.ecritureId ? 'L\'écriture de variation est passée : la repasser compterait le stock deux fois.' : (v.motif || '');
    return `<div class="filters">
      ${info('iv.etat')}
      <span class="small muted">Exercice ${esc(s.annee)}</span>
      ${inv ? `<button class="${cls('reprendre')}" id="iv-saisir">Reprendre l'inventaire…</button>
      <button class="${cls('ecrire')}" id="iv-ecrire" ${ecrivable ? '' : 'disabled'}
        title="${esc(pourquoi)}">Écrire la variation de stock</button>` : ''}
    </div>
    ${!inv
    ? `<div class="empty">Aucun inventaire saisi pour ${esc(s.annee)}.
        <p class="small muted">Un inventaire, c'est ce qui reste au dernier jour, compté et valorisé.
        La différence avec ce que portent les comptes devient une écriture <span class="nw">(${esc(KC.COMPTES_IMMO.variationStocks)} / ${esc(KC.COMPTES_IMMO.stocks)})</span>.</p>
        <button class="btn btn-primary" id="iv-saisir2">Saisir l'inventaire…</button>
        <div class="small mt">${lienArticle('immobilisations')}</div></div>`
    : `<div class="panel mt" id="iv-variation"><h2>La variation ${info('iv.variation')}</h2>
        ${v.ok
    ? `<table class="list compact"><tbody>
            <tr><td>Stock aux comptes à l'ouverture</td><td class="r nw">${esc(money(v.initial))}</td></tr>
            <tr><td>Stock compté au ${esc(fmtJour(inv.date))}</td><td class="r nw">${esc(money(v.final))}</td></tr>
            <tr class="dc-total"><td><b>Variation</b></td><td class="r nw"><b>${esc(money(v.ecart))}</b></td></tr></tbody></table>
          ${/* U-13 — un état NORMAL se dit sur une ligne grise avec sa coche : « rien à écrire » et
                « déjà passée » ne demandent aucun geste, ils ne méritent pas un encadré vert qui pèse
                autant qu'une alerte. */''}
          ${pourquoi ? `<p class="small ligne-ok mt" id="iv-motifs"><span aria-hidden="true">✓</span> ${esc(pourquoi)}</p>`
    : `<p class="small muted mt">Le stock ${v.ecart > 0 ? 'augmente' : 'diminue'} :
              on ${v.ecart > 0 ? 'débite' : 'crédite'} le stock et on ${v.ecart > 0 ? 'crédite' : 'débite'} la variation.
              L'écriture arrive en <b>brouillard</b>, au ${esc(fmtJour(inv.date))}.</p>`}`
    : `<div class="warn-box">${esc(v.motif || '')}</div>`}
      </div>
      <div class="panel mt"><h2>Ce qui a été compté au ${esc(fmtJour(inv.date))} ${info('iv.lignes')}</h2>
        <div class="scroll-x"><table class="list compact"><thead><tr><th class="nw">Réf.</th><th>Désignation</th>
          <th class="r nw">Quantité</th><th class="r nw">Coût unitaire</th><th class="r nw">Valeur</th></tr></thead>
        <tbody>${inv.lignes.map(l => `<tr><td class="nw">${esc(l.ref)}</td>
          <td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td>
          <td class="r nw">${esc(String(l.quantite).replace('.', ','))}</td><td class="r nw">${esc(money(l.cout))}</td>
          <td class="r nw">${esc(money(l.valeur))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th colspan="4">${esc(pl(inv.lignes.length, 'ligne comptée', 'lignes comptées'))}</th>
          <th class="r nw">${esc(money(inv.total))}</th></tr></tfoot></table></div></div>`}`;
  }

  function brancherInventaire(el, root, dossier) {
    const s = livresState;
    const rev = revDuLivre(s.livre);
    if (!s.inv || s.invRev !== rev) { s.invRev = rev; chargerInventaire(root, dossier); return; }
    if (s.inv.erreur) return;
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
    catch (e) { s.inv = { erreur: plainError(e) }; }
    drawLivres(root, dossier);
  }

  function inventaireForm(root, dossier) {
    const s = livresState;
    const dejaLa = (s.inv && s.inv.inventaire) || null;
    // On saisit en COLLANT une liste depuis un tableur : ligne par ligne dans un formulaire,
    // personne ne compterait deux cents références (même règle que les dossiers collés, 6.8.0).
    // Ce qu'on rouvre se relit en français (H-3) : « 7.5 » dans une liste de coûts, c'est sept
    // mille cinq cents pour qui lit « 7.500 ». Le moteur relit les deux formes.
    const depart = dejaLa
      ? dejaLa.lignes.map(l => [l.ref, l.libelle, String(l.quantite).replace('.', ','), montantChamp(l.cout) || '0'].join('\t')).join('\n')
      : '';
    modal(`<h2>L'inventaire de ${esc(s.annee)}</h2>
      <p class="small muted">Une ligne par référence : <b>référence, désignation, quantité, coût unitaire</b>,
      séparées par une tabulation ou un point-virgule. Colle-les depuis ton tableur.</p>
      <form id="iv" class="grid-2">
        <label class="field obligatoire"><span>Date de l'inventaire</span>
          <input name="date" placeholder="31/12/${esc(s.annee)}" value="${esc(fmtJour((dejaLa && dejaLa.date) || (s.livre.exercice.au || '')))}"></label>
        <label class="field"><span>Compte de stock</span>
          <input name="compte" value="${esc((dejaLa && dejaLa.compte) || KC.COMPTES_IMMO.stocks)}"></label>
      </form>
      <label class="field mt"><span>Les lignes comptées</span>
        <textarea id="iv-lignes" rows="10" placeholder="REF-01&#9;Câble HDMI 2 m&#9;24&#9;7,500">${esc(depart)}</textarea></label>
      <div id="iv-apercu" class="small muted"></div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="ok">Enregistrer l'inventaire</button></div>`,
    (rootModal, close) => {
      const apercu = $('#iv-apercu', rootModal);
      // Les lignes sont lues par le MOTEUR (`lignesInventaireDepuisTexte`) : c'est lui qui refuse
      // une quantité illisible (C-16), et l'écran dit ce qu'il refuse — jamais un zéro en silence.
      // La date se tape comme partout ailleurs, « 31/12/2026 », et se range en ISO.
      const lire = () => {
        const r = KC.lignesInventaireDepuisTexte($('#iv-lignes', rootModal).value || '');
        const dateTape = (($('[name=date]', rootModal) || {}).value || '').trim();
        return {
          date: K.dateTapee(dateTape, s.annee, `${s.annee}-12`) || dateTape,
          compte: (($('[name=compte]', rootModal) || {}).value || '').trim(),
          lignes: r.lignes, refus: r.refus
        };
      };
      const maj = () => {
        const inv = lire();
        const v = KC.inventaireValide(inv);
        // U-13 — le refus attend le premier geste : « un inventaire sans une seule ligne… » en
        // orange sur une fenêtre qu'on vient d'ouvrir, c'était reprocher ce qu'on n'a pas encore eu
        // le temps de faire. Le bouton éteint dit déjà pourquoi, au survol et sous le doigt.
        apercu.innerHTML = v.ok
          ? `<div class="ok-box mt">${esc(pl(inv.lignes.length, 'ligne'))} — total ${esc(money(KC.totalInventaire(inv)))}.</div>`
          : !touche ? ''
            : `<div class="warn-box mt">${v.motifs.slice(0, 5).map(m => `<div>${esc(m)}</div>`).join('')}${v.motifs.length > 5 ? `<div>… et ${v.motifs.length - 5} de plus.</div>` : ''}</div>`;
        const b = $('#ok', rootModal);
        b.disabled = !v.ok; b.title = v.ok ? '' : v.motifs[0];
      };
      let touche = !!dejaLa;
      $$('input,textarea', rootModal).forEach(x => { x.oninput = () => { touche = true; maj(); }; });
      maj();
      $('#ok', rootModal).onclick = async () => {
        try {
          const inv = lire();
          const v = KC.inventaireValide(inv);
          if (!v.ok) return toast(v.motifs[0], 'error');
          delete inv.refus;
          const r = await api.saveInventaire({ dossierId: dossier.id, annee: s.annee, inventaire: inv });
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
        <div class="mt"><button class="btn btn-primary" id="bq-import">Importer un relevé…</button></div>
        <div class="small mt">${lienArticle('banque')}</div></div>`;
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
        const e = r.ecritureId ? ecritureDuLivre(s.livre, r.ecritureId) : null;
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
            // La pièce se coupe, son montant jamais (10.12.0) : coupé avec le reste, « BQ PAIE-2026-07
            // · −1 443,… » ne disait plus quelle ligne de la pièce répond — c'est tout T-12. Et une
            // ambiguïté commence par ce qu'elle DEMANDE : c'est la fin d'une phrase qu'on coupe.
            e ? `<span class="face"><span class="face-p">${esc((e.journal || '') + ' ' + (e.piece || ''))}</span>${
              mFace != null ? `<span class="muted face-m">· ${esc(money(mFace))}</span>` : ''}</span>`
              : r.niveau === 'probable' || r.niveau === 'a-confirmer' ? '<span class="muted">À trancher : plusieurs écritures au même montant</span>' : ''}</td>
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
            `<tr><td class="nw">${esc(fmtJour(l.date))}</td><td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td><td class="r nw">${esc(money(l.montant))}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2"><strong>Total côté banque</strong></td><td class="r nw"><strong>${esc(money(sus.totalBanque))}</strong></td></tr></tfoot></table>`
            : '<div class="empty mini">Rien : tout ce que la banque porte est dans le livre.</div>'}</div>
        <div><h3 class="sub-h">Côté livre · ${pl(sus.livre.length, 'ligne')}</h3>
          ${sus.livre.length ? `<table class="list compact"><tbody>${sus.livre.map(l =>
            `<tr><td class="nw">${esc(fmtJour(l.date))}</td><td class="tronq" title="${esc(l.libelle)}">${esc(l.libelle)}</td><td class="r nw">${esc(money(l.montant))}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2"><strong>Total côté livre</strong></td><td class="r nw"><strong>${esc(money(sus.totalLivre))}</strong></td></tr></tfoot></table>`
            : '<div class="empty mini">Rien : tout ce que le livre porte est sur le relevé.</div>'}</div>
      </div>
      ${/* Le VERDICT (10.12.0, vu au test humain sur la vitrine) : un écart de −3 650,591 en rouge,
            deux listes sans total, et rien pour dire que la banque moins le livre redonne l'écart au
            millime. Ce qu'un comptable vient chercher ici, c'est si l'écart est EXPLIQUÉ — sinon il
            refait l'addition à la main. Les deux termes sont écrits (9.8.8), et la part qui ne
            s'explique par aucun suspens se nomme comme sur la carte. */''}
      ${sus.banque.length || sus.livre.length ? `<p class="small mt">${sus.avant
        ? `Les suspens expliquent <b>${esc(money(sus.ecartSuspens))}</b> de l'écart : ${esc(money(sus.totalBanque))} côté banque − ${esc(money(sus.totalLivre))} côté livre. Le reste, <b>${esc(money(sus.avant))}</b>, vient d'avant les relevés importés.`
        : `Les suspens expliquent tout l'écart : <b>${esc(money(sus.totalBanque))}</b> côté banque − <b>${esc(money(sus.totalLivre))}</b> côté livre = <b>${esc(money(sus.ecartSuspens))}</b>.`}</p>` : ''}
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
        const e = ecritureDuLivre(s.livre, r.ecritureId);
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
      <div class="modal-actions"><button class="btn" data-close>Fermer</button></div>`,
    // Une fenêtre de CONTRÔLE se lit : à 580 px, chaque libellé tombait à « TVA, timbres et
    // retenues de j… » — la ligne qu'on est venu vérifier.
    layer => { $('.modal', layer).classList.add('cab-moyen'); });
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
  // 10.12.0 (vu au test humain) — et la fenêtre DIT ce que l'automatique a jugé : la ligne portait
  // « Probable » pendant que la fenêtre montrait ses deux écritures à égalité. Le jugement vient du
  // moteur (`candidatsDeLigne`, le même que l'automatique) ; le plus probable passe en tête et son
  // bouton est le seul en couleur — rien n'est posé tant qu'on n'a pas cliqué.
  function choisirEcritureForm(root, dossier, R, ligne) {
    const s = livresState;
    const jours = ((dossier.banque || {}).jours != null) ? dossier.banque.jours : KC.RELEVE_JOURS;
    const jug = KC.candidatsDeLigne(s.livre, R.id, ligne.id, { jours });
    const cle = c => c.ecritureId + '#' + c.ligne;
    const prefere = jug.meilleur ? cle(jug.meilleur) : '';
    const memeMontant = jug.libres.filter(c => KC.round3(c.montant - ligne.montant) === 0)
      .sort((a, b) => (cle(b) === prefere) - (cle(a) === prefere) || a.date.localeCompare(b.date));
    const autres = jug.libres.filter(c => KC.round3(c.montant - ligne.montant) !== 0);
    const jugement = !memeMontant.length ? ''
      : jug.niveau === 'certain' ? `Une seule écriture porte ce montant à ${pl(jours, 'jour')} près : c'est très probablement elle.`
        : jug.niveau === 'probable' ? 'La plus probable est en tête : son libellé partage le plus de mots avec celui de la banque. Rien n\'est posé tant que tu n\'as pas cliqué.'
          : jug.niveau === 'a-confirmer' ? 'Rien ne les départage — ni la date, ni le libellé : c\'est à toi de choisir.'
            : `Aucune à ${pl(jours, 'jour')} près de la banque : vérifie la date avant de rapprocher.`;
    const ligneHtml = c => `<tr><td class="nw">${esc(fmtJour(c.date))}</td><td class="tronq" title="${esc(c.libelle)}">${esc(c.libelle)}</td>
      <td class="nw">${esc(c.piece)}</td><td class="r nw">${esc(money(c.montant))}</td>
      <td class="actions"><button type="button" class="btn btn-sm${cle(c) === prefere ? ' btn-primary' : ''}" data-pick="${esc(c.ecritureId)}|${c.ligne}">Rapprocher</button></td></tr>`;
    modal(`<h2>Rapprocher ${esc(fmtJour(ligne.date))} · ${esc(money(ligne.montant))}</h2>
      <p class="small muted">${esc(ligne.libelle)}</p>
      <h3 class="sub-h">Du même montant · ${pl(memeMontant.length, 'écriture')}</h3>
      ${jugement ? `<p class="small muted" id="ce-jugement">${esc(jugement)}</p>` : ''}
      ${memeMontant.length ? `<div class="scroll-x"><table class="list compact"><tbody>${memeMontant.map(ligneHtml).join('')}</tbody></table></div>`
        : '<div class="empty mini">Aucune écriture du compte ' + esc(R.compte) + ' ne porte ce montant.</div>'}
      ${autres.length ? `<h3 class="sub-h">Les autres écritures du compte · ${pl(autres.length, 'écriture')}</h3>
        <div class="scroll-x" style="max-height:230px"><table class="list compact"><tbody>${autres.slice(0, 60).map(ligneHtml).join('')}</tbody></table></div>` : ''}
      ${/* La fenêtre finit par le geste SUIVANT (7.27.0) : quand rien dans le livre ne porte le
            montant, ce qu'il reste à faire, c'est l'écrire — et ce bouton-là est alors le principal. */''}
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn ${memeMontant.length ? '' : 'btn-primary'}" id="ce-ecrire">Écrire l'écriture manquante…</button></div>`,
      (rootModal, close) => {
        // Cinq colonnes et un bouton par ligne : dans la fenêtre ordinaire de 580 px, « Rapprocher »
        // vivait derrière un défilement de côté — on voyait « R », pas le geste (vu au test humain).
        $('.modal', rootModal).classList.add('cab-moyen');
        $('#ce-ecrire', rootModal).onclick = () => { close(); ecrireDepuisBanque(root, dossier, R, ligne); };
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
        <label class="field">Solde au début (DT)<input name="debut" class="num montant" inputmode="decimal" value="0,000">
          <span class="small muted" id="rv-debut-hint"></span></label>
        <label class="field">Solde à la fin (DT)<input name="fin" class="num montant" inputmode="decimal" value="0,000"></label>
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
          champDebut.value = montantChamp(solde) || '0';
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
  const saisieState = { dossierId: '', piece: null, focusApres: null, enAttente: {} };

  // 10.12.0 (U-09) — une pièce COMMENCÉE et pas enregistrée. Elle vivait en mémoire, sans trace :
  // fermer la fenêtre l'effaçait sans une question, et ouvrir la saisie d'un AUTRE client la
  // remplaçait par une pièce vide. Trois parades : elle est garée par dossier (`enAttente`) au lieu
  // d'être écrasée, un point le dit sur l'onglet, et la fermeture de la fenêtre demande.
  // « Touchée » ET « commencée » : la date et le journal proposés ne comptent pas, un champ tapé
  // puis vidé non plus — on ne demande pas de confirmer la perte d'une pièce vide.
  const pieceCommencee = p => !!p && (lignesReelles(p).length > 0 || !!String(p.libelle || '').trim()
    || !!String(p.piece || '').trim() || !!p.pieceJointe);
  const pieceEnCours = p => !!(p && p.touchee && pieceCommencee(p));
  const saleDe = id => (saisieState.dossierId === id && pieceEnCours(saisieState.piece)) || pieceEnCours(saisieState.enAttente[id]);
  // Le point qui le dit. Un point SEUL ne dit rien (9.4.4) : il porte son titre, et son nom pour
  // qui ne voit pas l'écran.
  const pointSale = id => `<span class="sa-sale" data-sale="${esc(id)}" role="img" aria-label="Une pièce commencée n'est pas enregistrée" title="Une pièce commencée n'est pas enregistrée"${saleDe(id) ? '' : ' hidden'}>●</span>`;
  // Les NOMS des dossiers dont une pièce commencée n'est pas enregistrée — ce que la fermeture et
  // l'installation d'une mise à jour nomment avant de fermer.
  function nomsDesSaisies() {
    const ids = Object.keys(saisieState.enAttente).filter(id => pieceEnCours(saisieState.enAttente[id]));
    if (pieceEnCours(saisieState.piece) && saisieState.dossierId) ids.unshift(saisieState.dossierId);
    return [...new Set(ids)].map(id => ((S.dossiers || []).find(d => d.id === id) || {}).name).filter(Boolean);
  }
  // `null` et pas '' : une interface qui (re)démarre DIT qu'elle n'a rien en cours, même si c'est
  // aussi ce qu'elle disait avant. Sinon, après un rechargement, le processus principal garde la
  // liste de l'interface précédente et demande pour une pièce qui n'existe plus (7.28.0 : un
  // drapeau se remet à jour quand l'état DISPARAÎT, pas seulement quand il se pose).
  let dernierSignal = null;
  function signalerSaisies() {
    const noms = nomsDesSaisies();
    const cle = noms.join('|');
    if (cle !== dernierSignal) { dernierSignal = cle; try { api.saisieEnCours(noms); } catch (_) { /* pont absent en test */ } }
    // Le point de l'onglet se met à jour SANS redessiner : on est au milieu d'une frappe (7.17.0).
    $$('[data-sale]').forEach(x => { x.hidden = !saleDe(x.dataset.sale); });
  }

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
  // Les montants passent par `lireMontant` (H-3) : « 1 250,500 » tapé avec l'espace des milliers
  // valait zéro, et la ligne « n'avait aucun montant » sous les yeux de qui venait de le taper.
  const lignesReelles = p => (p.lignes || [])
    .filter(l => String(l.compte || '').trim() || lireMontant(l.debit) || lireMontant(l.credit))
    .map(l => ({
      compte: String(l.compte || '').trim(), libelle: String(l.libelle || ''),
      debit: lireMontant(l.debit),
      credit: lireMontant(l.credit)
    }));

  // Un montant qu'on ne sait pas lire n'est pas un zéro : « 12a » passait pour une ligne « sans
  // montant ». Le refus NOMME la case et ce qui y est écrit (règle 10.10.0 : une cellule illisible
  // se refuse en nommant la ligne). Et c'est la MÊME fonction qui éteint les boutons pendant la
  // frappe et qui refuse à l'enregistrement (9.4.5) : `verdictSaisie`.
  // UNE définition de « illisible », pour la phrase, pour la case marquée pendant la frappe ET pour
  // la case redessinée : la marque ne posait qu'à la frappe, et une pièce rouverte gardait « 12a »
  // sans rouge pendant que la phrase le nommait.
  const montantIllisible = v => { const brut = String(v == null ? '' : v).trim(); return !!brut && !Number.isFinite(KC.nombreStrict(brut)); };
  // 10.14.1 — Une case que le moteur REFUSE se marque comme une case qu'il ne sait pas lire : « -40 »
  // au débit est refusé (« un montant négatif change de colonne »), la phrase le disait sous la grille
  // et la case restait blanche — on cherchait laquelle des lignes.
  const montantRefuse = v => montantIllisible(v) || lireMontant(v) < 0;
  // 10.14.1 — la case de montant qu'on ne sait pas lire, et sa phrase. UNE définition pour la garde
  // du clic ET pour les aperçus qui se recalculent à la frappe : l'aperçu d'un bien disait « La
  // valeur d'acquisition doit être positive » sous « 85 000 DT », celui d'un bulletin comptait une
  // prime « 150 DT » pour zéro — un chiffre faux affiché, et une raison qui accuse autre chose.
  const montantIllisibleDans = root => $$(SEL_MONTANT, root).find(el => !el.disabled && el.offsetParent !== null && montantIllisible(el.value)) || null;
  const motifIllisible = v => `« ${String(v).trim()} » ne se lit pas comme un montant. Écris-le en chiffres, par exemple 1\u202f250,500.`;
  const montantsIllisibles = p => {
    const out = [];
    (p.lignes || []).forEach((l, i) => ['debit', 'credit'].forEach(k => {
      if (montantIllisible(l[k])) {
        out.push(`Ligne ${i + 1} : « ${String(l[k]).trim()} » n'est pas un montant (${k === 'debit' ? 'débit' : 'crédit'}).`);
      }
    }));
    return out;
  };
  const verdictSaisie = (p, plan, opts) => {
    const illisibles = montantsIllisibles(p);
    if (illisibles.length) return { ok: false, motif: illisibles[0], motifs: illisibles };
    return KC.ecritureValide(ecritureSaisie(p), plan, opts);
  };

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
      // Une pièce commencée pour un AUTRE client se gare, elle ne s'écrase pas (U-09) : on la
      // retrouve telle quelle en revenant sur son dossier.
      if (saisieState.dossierId && saisieState.dossierId !== dossier.id && pieceEnCours(saisieState.piece)) {
        saisieState.enAttente[saisieState.dossierId] = saisieState.piece;
      }
      const garee = saisieState.enAttente[dossier.id];
      delete saisieState.enAttente[dossier.id];
      saisieState.dossierId = dossier.id;
      saisieState.piece = garee || null;
    }
    if (!saisieState.piece) {
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
    // Le brouillard d'un gros dossier comptait 3 532 pièces sous la grille : 153 000 px et deux
    // secondes à chaque redessin de la saisie (10.14.0, saturation). On pagine les PIÈCES (9.4.5) ;
    // les lots proposés, eux, portent sur tout le brouillard — c'est lui qu'ils valident.
    const pagerBrouillard = pagerBar(brouillards.length, s, 'pièce');
    const brouillardsPage = paginate(brouillards, s);

    return `<div class="sa-tete" id="sa-tete">
        <label class="field sa-j"><span class="fl">Journal ${info('sa.journal')}</span>
          <select id="sa-journal">${s.livre.journaux.map(j => `<option value="${esc(j.code)}" ${p.journal === j.code ? 'selected' : ''}>${esc(j.code)} — ${esc(j.libelle)}</option>`).join('')}</select></label>
        <label class="field sa-d"><span class="fl">Date ${info('sa.date')}</span>
          ${/* Le champ montre le jour en FRANÇAIS, la pièce garde l'ISO. L'écran affichait
                « 2026-09-17 » sous une invite qui annonce « 04/03/2026 » : le format interne
                fuyait dans l'écran où un comptable tunisien lit une date. La saisie reste
                tolérante — `dateTapee` accepte 4, 4/3, 04/03/2026 et l'ISO. */''}
          <input id="sa-date" autocomplete="off" placeholder="${r.dateComplete ? '04/03/2026' : '4'}" value="${esc(dateAffichee(p.date, r))}"></label>
        <label class="field sa-p"><span class="fl">Pièce ${info('sa.piece')}</span>
          <input id="sa-piece" autocomplete="off" value="${esc(p.piece)}"></label>
        <label class="field sa-grow"><span class="fl">Libellé ${info('sa.libelle')}</span>
          <input id="sa-libelle" autocomplete="off" value="${esc(p.libelle)}"></label>
        ${/* 10.12.0 (U-01) — « Joindre » vit au bout de la ligne des champs, et l'aide des touches
              sous la grille : chacune coûtait une rangée AU-DESSUS, entre l'en-tête de la pièce et
              ses lignes — sur un portable, c'était la grille qu'on ne voyait plus. */''}
        <button type="button" class="btn btn-sm sa-joindre" id="sa-joindre">${p.pieceJointe ? 'Justificatif joint ✓' : 'Joindre un justificatif…'}</button>
      </div>
      ${guides.length ? `<div class="sa-outils">
        <select id="sa-guide" aria-label="Partir d'un guide d'écritures"><option value="">Partir d'un guide…</option>${guides.map(g => `<option value="${esc(g.id)}">${esc(g.nom)}</option>`).join('')}</select>
          <input id="sa-guide-montant" class="sa-montant" inputmode="decimal" placeholder="Montant" aria-label="Montant du guide" autocomplete="off">
      </div>` : ''}
      ${/* 10.12.0 (U-26) — des largeurs FIXES : l'intitulé du compte apparaît pendant la frappe, et
            la grille se recalculait à chaque caractère — les colonnes sautaient sous le curseur. */''}
      <div class="scroll-x"><table class="list compact sa-grille"><colgroup>
        <col class="sa-c-compte"><col class="sa-c-nom"><col class="sa-c-lib"><col class="sa-c-mt"><col class="sa-c-mt"><col class="sa-c-sup">
      </colgroup><thead><tr>
        <th class="nw">Compte</th><th>Intitulé</th><th>Libellé</th>
        <th class="r nw">Débit</th><th class="r nw">Crédit</th><th></th></tr></thead>
        <tbody id="sa-lignes">${lignesSaisieHtml()}</tbody>
        <tfoot><tr>
          <td colspan="3" class="sa-tl">Total de la pièce</td>
          <td class="r nw" id="sa-td">0,000</td><td class="r nw" id="sa-tc">0,000</td><td></td></tr>
          <tr id="sa-ecart-l"><td colspan="3" class="sa-tl">Écart</td>
          <td class="r nw" id="sa-te" colspan="2">0,000</td><td></td></tr></tfoot></table></div>
      <div class="sa-ajout"><button type="button" class="btn btn-sm btn-ghost" id="sa-ajouter">+ Ajouter une ligne</button></div>
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
      ${/* Les touches : sous la grille, là où les doigts les cherchent pendant qu'ils tapent — et
            repliables, le choix retenu. Un comptable qui les connaît n'a pas à les relire à chaque
            pièce ; un débutant les trouve à l'endroit du geste. */''}
      <details class="sa-touches" id="sa-touches"${prefs.get('saTouches', true) === false ? '' : ' open'}><summary>Les touches de la grille</summary>${aideTouches()}</details>
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
        <tbody>${brouillardsPage.map(e => {
          const t = KC.soldeDeLignes(e.lignes);
          return `<tr data-br="${esc(e.id)}" class="br-ligne">
            <td class="nw">${esc(fmtJour(e.date))}</td><td>${esc(e.journal)}</td><td class="nw">${esc(e.piece || '—')}</td>
            <td>${esc(e.libelle || '')}${e.pieceJointe ? ' <span title="Justificatif joint">📎</span>' : ''}</td>
            <td class="r nw">${esc(montant(t.debit))}</td>
            <td class="nw">${t.equilibre ? '<span class="muted">équilibrée</span>' : `<span class="err-inline">écart ${esc(montant(t.ecart))}</span>`}</td>
            ${RowMenu.cellule('B:' + e.id, '')}</tr>`;
        }).join('')}</tbody></table></div>${pagerBrouillard}`
        : `<div class="empty mini"><p>Rien en brouillard.</p><p class="muted small">Tout ce que tu saisis ici arrive en brouillard : rien ne prend de numéro tant que tu ne l'as pas validé.</p></div>`}
      <p class="muted small mt">Une fois validée, une écriture ne se modifie plus : elle se <b>contre-passe</b> (une écriture miroir pour corriger une erreur, datée du jour — ou du dernier jour d'un exercice passé : le menu de la ligne dit laquelle)
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

  const TITRE_COMPTE_NEUF = 'Compte neuf pour ce dossier : il entrera au plan sous ce nom à l\'enregistrement.';
  function lignesSaisieHtml() {
    const p = saisieState.piece || pieceVide();
    const plan = ((livresState.livre || {}).plan) || [];
    const nom = c => (plan.find(x => x.compte === String(c || '').trim()) || {}).libelle || '';
    // 10.14.0 — un compte que le dossier n'a pas encore montre le nom qu'il PRENDRA (le plan de
    // référence, comme `assurerCompte`), en italique : on voit ce qu'on vient de taper avant de
    // l'enregistrer, et on le distingue d'un compte déjà au plan.
    const neuf = c => { const n = String(c || '').trim(); return !!n && !nom(n) && !!KC.libelleDuPlan(n); };
    const intitule = c => nom(c) || (neuf(c) ? KC.libelleDuPlan(String(c).trim()) : '');
    // Chaque case porte son `aria-label` : le rapport entre une case et son en-tête de colonne est
    // évident à l'œil et invisible au clavier comme à la voix. Le numéro de ligne y est, sinon cinq
    // cases annoncent toutes « Compte » et on ne sait plus laquelle on remplit.
    const lab = (quoi, i) => `aria-label="${quoi} — ligne ${i + 1}"`;
    return (p.lignes || []).map((l, i) => `<tr data-i="${i}">
      <td><input data-k="compte" class="sa-compte" ${lab('Compte', i)} autocomplete="off" value="${esc(l.compte)}"></td>
      <td class="sa-nom muted small${neuf(l.compte) ? ' sa-nom-neuf' : ''}" data-nom="${i}"${neuf(l.compte) ? ` title="${esc(TITRE_COMPTE_NEUF)}"` : ''}>${esc(intitule(l.compte))}</td>
      <td><input data-k="libelle" ${lab('Libellé', i)} autocomplete="off" value="${esc(l.libelle)}" placeholder="${esc(p.libelle || '')}"></td>
      <td><input data-k="debit" class="r sa-montant${montantRefuse(l.debit) ? ' sa-ko' : ''}" ${lab('Débit', i)}${montantRefuse(l.debit) ? ' aria-invalid="true"' : ''} inputmode="decimal" autocomplete="off" value="${esc(l.debit)}"></td>
      <td><input data-k="credit" class="r sa-montant${montantRefuse(l.credit) ? ' sa-ko' : ''}" ${lab('Crédit', i)}${montantRefuse(l.credit) ? ' aria-invalid="true"' : ''} inputmode="decimal" autocomplete="off" value="${esc(l.credit)}"></td>
      <td class="sa-sup"><button type="button" class="btn btn-sm" data-sup="${i}" title="Retirer cette ligne" aria-label="Retirer cette ligne">✕</button></td>
    </tr>`).join('');
  }

  function brancherSaisie(el, root, dossier) {
    const s = livresState;
    if (!s.livre || !saisieState.piece) return;
    // La pagination du brouillard : la pièce en cours vit dans `saisieState`, le redessin la garde.
    bindPager(el, () => drawLivres(root, dossier), s);
    const p = saisieState.piece;
    const corps = $('#sa-lignes', el);
    const t = touchesSaisie();
    const r = reglagesSaisie();

    // Le montant que ⇥ poserait sur la dernière ligne, ou `null` si le geste ne se propose pas.
    //
    // UNE fonction pour les deux moitiés : celle qui POSE le montant (le gestionnaire de Tab) et
    // celle qui l'ANNONCE dans la case d'où l'on appuie. L'aide disait « Solder la dernière ligne
    // ⇥ Tab » sans dire d'OÙ : le geste ne part que de la case Crédit, sur une ligne qui porte un
    // compte et pas encore de montant — trois conditions qu'aucun écran ne montrait, donc un
    // raccourci qui « ne marche pas » une fois sur deux sans qu'on sache pourquoi (T-48). C'est la
    // règle du bouton éteint (9.4.5) appliquée à une touche : ce qui refuse et ce qui annonce
    // doivent être la même fonction, sinon les deux divergent.
    const soldeProposable = () => {
      const i = (p.lignes || []).length - 1;
      const l = (p.lignes || [])[i];
      if (!l || !String(l.compte || '').trim()) return null;
      if (String(l.debit || '').trim() || String(l.credit || '').trim()) return null;
      const t2 = KC.soldeDeLignes(lignesReelles(p));
      if (t2.equilibre || (!t2.debit && !t2.credit)) return null;
      return { i, debit: t2.solde.debit, credit: t2.solde.credit };
    };

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
      //
      // DEUX verdicts, parce que les deux boutons n'exigent pas la même chose : le brouillard
      // accepte une pièce à moitié tapée (c'est sa raison d'être), la validation exige en plus un
      // libellé (T-51). Éteindre le brouillard sur le motif de la validation enfermerait la saisie
      // en cours ; ne rien dire ferait cliquer un bouton vif pour lire un refus.
      const plan = ((s.livre || {}).plan || []).map(c => c.compte);
      const v = verdictSaisie(p, plan);
      const vv = verdictSaisie(p, plan, { valider: true });
      const motif = $('#sa-refus', el);
      const bOk = $('#sa-ok', el), bVal = $('#sa-okvalider', el);
      if (bOk) { bOk.disabled = !v.ok; bOk.title = v.ok ? '' : v.motif; }
      if (bVal) { bVal.disabled = !vv.ok; bVal.title = vv.ok ? '' : vv.motif; }
      // 10.14.0 — un compte neuf pour le dossier se LIT ici, il n'éteint rien : il entrera au plan à
      // l'enregistrement (6.3.0). Un refus passe devant : c'est lui qui bloque.
      const av = (v.ok && vv.ok && v.avertissements) || [];
      const phrase = !v.ok ? v.motif : !vv.ok ? 'Pour valider : ' + vv.motif
        : av.length ? av[0] + (av.length > 1 ? ` Et ${pl(av.length - 1, 'autre compte neuf', 'autres comptes neufs')} dans cette pièce.` : '') : '';
      if (motif) { motif.hidden = !phrase; motif.textContent = typoTexte(phrase); }

      // Le geste de solde s'annonce là où il se déclenche, avec le montant qu'il posera — et il
      // nomme la colonne quand ce n'est pas celle où l'on est. Le placeholder se remet à jour ici,
      // avec les totaux : écrit une fois au dessin, il serait périmé à la frappe suivante.
      const prop = soldeProposable();
      const derniere = $(`tr[data-i="${(p.lignes || []).length - 1}"] input[data-k="credit"]`, corps);
      if (derniere) {
        derniere.placeholder = prop
          ? `⇥ ${montant(prop.debit || prop.credit)}${prop.debit ? ' au débit' : ''}`
          : '';
      }
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
          p.touchee = true;
          if (k === 'compte') {
            const n = inp.value.trim();
            const c = (s.livre.plan || []).find(x => x.compte === n);
            // Le même intitulé qu'au dessin : le nom du plan du dossier, sinon celui qu'il PRENDRA.
            const ref = !c && n ? KC.libelleDuPlan(n) : '';
            const cell = $(`[data-nom="${i}"]`, corps);
            if (cell) {
              cell.textContent = c ? (c.libelle || '') : ref;
              cell.classList.toggle('sa-nom-neuf', !!ref);
              if (ref) cell.title = TITRE_COMPTE_NEUF; else cell.removeAttribute('title');
            }
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
          // La case qu'on ne sait pas lire se VOIT, pas seulement dans la phrase sous la grille (H-3).
          if (k === 'debit' || k === 'credit') {
            inp.classList.toggle('sa-ko', montantRefuse(inp.value));
            if (montantRefuse(inp.value)) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
          }
          majSolde();
          signalerSaisies();
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
            const prop = soldeProposable();
            if (prop && prop.i === i) {
              ev.preventDefault();
              p.lignes[i].debit = montantChamp(prop.debit);
              p.lignes[i].credit = montantChamp(prop.credit);
              redessinerLignes({ i, k: prop.debit ? 'debit' : 'credit' });
            }
          }
        };
        if (k === 'compte') {
          suggererCompte(inp, () => s.livre.plan || [], c => {
            // 10.14.0 — le libellé de la ligne ne reçoit plus le NOM DU COMPTE : « Banques » sur le
            // 532 ne dit rien de l'opération, il remplaçait dans le journal le libellé de la pièce
            // qu'une ligne vide reprend — et la règle T-51 (une validée dit ce qu'elle enregistre)
            // passait sur des noms de comptes. Le nom vit dans la colonne Intitulé ; le champ vide
            // montre, en attente, le libellé de la pièce qu'il reprendra.
            p.lignes[i].compte = c.compte; p.touchee = true;
            redessinerLignes({ i, k: 'libelle' });
          });
        }
      });
      $$('[data-sup]', corps).forEach(b => {
        b.onclick = () => {
          const i = Number(b.dataset.sup);
          if (p.lignes.length <= 1) { p.lignes[0] = ligneVide(); } else { p.lignes.splice(i, 1); }
          p.touchee = true;
          redessinerLignes();
          signalerSaisies();
        };
      });
    }

    // L'entête : chaque champ écrit dans la pièce, aucun ne redessine la grille.
    const j = $('#sa-journal', el);
    if (j) j.onchange = () => { p.journal = j.value; p.touchee = true; api.dernierJournal(dossier.id, j.value).catch(() => {}); majSolde(); };
    const dt = $('#sa-date', el);
    if (dt) {
      const lire = () => {
        const iso = K.dateTapee(dt.value, s.annee, p.date || `${s.annee}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
        p.date = iso || '';
        const ko = !!dt.value.trim() && !iso;
        dt.classList.toggle('sa-ko', ko);
        if (ko) dt.setAttribute('aria-invalid', 'true'); else dt.removeAttribute('aria-invalid');
        if (iso) dt.value = dateAffichee(iso, r);
        majSolde();
      };
      dt.onblur = lire;
      // Un champ PRÉ-REMPLI se sélectionne au clic : sans ça, cliquer dedans et taper « 4/3 »
      // donne « 17/09/20264/3 », et il faut effacer à la main ce que l'application vient de
      // proposer. Le défaut est né avec la date proposée, deux corrections plus haut — c'est le
      // parcours réel qui l'a montré, jamais la relecture.
      dt.onfocus = () => dt.select();
    }
    const pc = $('#sa-piece', el); if (pc) pc.oninput = () => { p.piece = pc.value; p.touchee = true; signalerSaisies(); };
    // 10.14.0 — l'en-tête RELIT le verdict : les lignes tapées d'abord, « Pour valider : le libellé
    // manque » restait écrit sous un libellé qu'on venait de taper, et le bouton restait éteint — un
    // état lu une fois se périme (7.1.x). Les lignes sans libellé montrent celui qu'elles reprendront.
    const lb = $('#sa-libelle', el); if (lb) lb.oninput = () => {
      p.libelle = lb.value; p.touchee = true; signalerSaisies();
      $$('input[data-k="libelle"]', corps).forEach(x => { x.placeholder = lb.value; });
      majSolde();
    };

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
        // Un montant qu'on ne sait pas lire ne s'applique pas pour zéro : le guide répartirait
        // « 1 250 DT » en lignes à 0,000 sans un mot (10.14.1).
        const champM = $('#sa-guide-montant', el);
        if (champM && montantIllisible(champM.value)) { gs.value = ''; return refus(champM, motifIllisible(champM.value)); }
        const montant = lireMontant((champM || {}).value);
        const ecr = KC.ecritureDepuisGuide(g, { date: p.date, journal: g.journal, piece: p.piece, libelle: p.libelle, montant });
        p.journal = ecr.journal; p.libelle = ecr.libelle;
        p.lignes = ecr.lignes.map(l => ({
          compte: l.compte, libelle: l.libelle,
          debit: montantChamp(l.debit), credit: montantChamp(l.credit)
        }));
        p.lignes.push(ligneVide());
        p.touchee = true;
        gs.value = '';
        drawLivres(root, dossier);
      };
    }

    const jo = $('#sa-joindre', el);
    if (jo) jo.onclick = () => joindreJustificatif(root, dossier);
    const tch = $('#sa-touches', el);
    if (tch) tch.addEventListener('toggle', () => prefs.set('saTouches', tch.open));

    const dupliquerPiece = () => {
      const base = lignesReelles(p);
      if (!base.length) return;
      p.lignes = base.map(l => ({ compte: l.compte, libelle: l.libelle, debit: montantChamp(l.debit), credit: montantChamp(l.credit) }))
        .concat([ligneVide()]);
      p.id = ''; p.piece = '';
      toast('Pièce dupliquée : la nouvelle n\'a ni numéro ni pièce, tape-les.');
      drawLivres(root, dossier);
    };

    const enregistrer = async (puisValider) => {
      const ecr = ecritureSaisie(p);
      // Le contrôle porte sur le geste DEMANDÉ : valider exige un libellé, le brouillard non
      // (T-51). Sans ce drapeau, le pont refusait la validation APRÈS l'enregistrement, et l'écran
      // annonçait « Enregistrement impossible » sur une pièce pourtant bien rangée en brouillard.
      const v = verdictSaisie(p, (s.livre.plan || []).map(c => c.compte), puisValider ? { valider: true } : null);
      // Une saisie refusée se MONTRE : on amène le champ fautif à l'écran et on y met le curseur
      // (règle 7.0.0). Un message seul oblige à relire toute la grille. Un montant illisible amène
      // à SA case, pas au compte de la ligne.
      if (!v.ok) {
        const premier = v.motifs[0] || v.motif;
        const illisible = /n'est pas un montant \((débit|crédit)\)/.exec(premier);
        // Le montant illisible passe EN PREMIER : sa phrase cite ce qui est écrit dans la case, et
        // « « date » n'est pas un montant » enverrait sinon le curseur dans le champ Date.
        const ligneFautive = /Ligne (\d+)/.exec(premier);
        if (illisible && ligneFautive) allerA(Number(ligneFautive[1]) - 1, illisible[1] === 'débit' ? 'debit' : 'credit');
        else if (/date/i.test(premier) && dt) { dt.focus(); dt.classList.add('sa-ko'); dt.setAttribute('aria-invalid', 'true'); }
        else if (/journal/i.test(premier) && j) j.focus();
        else if (/libellé/i.test(premier) && lb) lb.focus();
        else if (ligneFautive) allerA(Number(ligneFautive[1]) - 1, 'compte');
        await infoDialog('Cette écriture n\'entre pas', v.motifs.join('\n'));
        return;
      }
      // « Enregistrer et valider » sans licence : on le dit AVANT d'écrire quoi que ce soit, et la
      // pièce reste dans la grille — elle s'enregistre en brouillard d'un clic (10.14.0).
      if (puisValider && await refusLicence('Valider une écriture')) return;
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
    // « Vider » jetait une pièce commencée sans un mot ni un retour (U-09) : ce qui se répare laisse
    // un « Annuler » sous la main (7.12.0) — on rend la pièce telle qu'elle était, lignes comprises.
    const vd = $('#sa-vider', el);
    if (vd) vd.onclick = () => {
      const avant = saisieState.piece;
      saisieState.piece = pieceVide(p.journal, p.date);
      drawLivres(root, dossier);
      if (pieceEnCours(avant)) {
        toastUndo('Pièce vidée.', () => {
          // Rendue à SON dossier : si l'on est passé à un autre client entre-temps, elle attend là
          // où elle était, comme toute pièce commencée qu'on quitte.
          if (saisieState.dossierId === dossier.id && $('#sa-lignes')) { saisieState.piece = avant; drawLivres(root, dossier); }
          else { saisieState.enAttente[dossier.id] = avant; signalerSaisies(); }
        });
      }
    };

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
      const e = ecritureDuLivre(s.livre, String(cle).slice(2));
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
      debit: montantChamp(l.debit), credit: montantChamp(l.credit)
    })).concat([ligneVide()])
  });

  async function supprimerBrouillard(root, dossier, e) {
    const ok = await confirmDialog('Supprimer ce brouillard ?',
      `<p>${esc(e.journal)} ${esc(e.piece || '(sans pièce)')} du ${esc(fmtJour(e.date))}.</p>${ceQuellePorte(e, 'il')}<p>Il n'a pas de numéro : il ne laissera aucun trou dans la numérotation, et rien n'en restera.</p>`,
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
        const v = verdictSaisie(saisieState.piece, (s.livre.plan || []).map(c => c.compte));
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
    if (await refusLicence('Valider un lot d\'écritures')) return;
    const quoi = filtre.journal ? `du journal ${filtre.journal}` : KC.deMois(moisLabelCourt(filtre.mois));
    // L'accord suit le nombre (10.12.0, vu au test humain) : « Chacune… Celles qui… » sous « Valider
    // 1 écriture » se lisait comme un modèle de phrase qu'on n'a pas fini de remplir.
    const une = cibles.length === 1;
    const ok = await confirmDialog(`Valider ${pl(cibles.length, 'écriture')} ${quoi} ?`,
      une
        ? '<p>Elle prend son numéro et ne se modifiera plus : une validée se contre-passe.</p><p>Si elle ne tombe pas juste, elle ne sera pas validée, et te sera nommée.</p>'
        : '<p>Chacune prend son numéro et ne se modifiera plus : une validée se contre-passe.</p><p>Celles qui ne tombent pas juste ne seront pas validées, et te seront nommées.</p>',
      'Valider');
    if (!ok) return;
    try {
      const r = await api.validerLot({ dossierId: dossier.id, annee: s.annee, journal: filtre.journal, mois: filtre.mois });
      s.livre = r.livre;
      const lignes = [`${pl(r.validees.length, 'écriture validée', 'écritures validées')}.`];
      if (r.refusees.length) {
        // L'accord suit le nombre, et la date s'écrit comme à l'écran (U-28) : « 1 écriture n'est pas
        // entrée — elles restent en brouillard », « du 2026-08-31 », vus en relisant ce message.
        const plus = r.refusees.length > 1;
        lignes.push(`${pl(r.refusees.length, 'écriture n\'est pas entrée', 'écritures ne sont pas entrées')} — ${plus ? 'elles restent' : 'elle reste'} en brouillard :`);
        r.refusees.slice(0, 10).forEach(x => lignes.push(`  • ${x.journal} ${x.piece || '(sans pièce)'} du ${fmtJour(x.date)} : ${x.motif}`));
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
         <label class="field obligatoire"><span>Nom</span><input type="text" id="ab-nom" value="${esc(a.nom)}" placeholder="Loyer du local"></label>
         <label class="field obligatoire"><span>Guide</span><select id="ab-guide">${guides.map(g => `<option value="${esc(g.id)}" ${a.guideId === g.id ? 'selected' : ''}>${esc(g.nom)}</option>`).join('')}</select></label>
         <label class="field narrow obligatoire"><span>Depuis</span><input type="date" id="ab-depuis" value="${esc(a.depuis)}"></label>
         <label class="field narrow">Jusqu'à<input type="date" id="ab-jusqua" value="${esc(a.jusqua || '')}"></label>
         <label class="field narrow">Tous les (mois)<input type="number" id="ab-pas" min="1" max="12" value="${Number(a.tousLesMois) || 1}"></label>
         <label class="field narrow obligatoire"><span>Montant (DT)</span><input type="text" id="ab-montant" class="num montant" inputmode="decimal" value="${esc(montantChamp(a.montant))}"></label>
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
          const montant = lireMontant($('#ab-montant', layer).value);
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
          // « 1 écriture trouvée sur 49 écritures » répétait le mot des deux côtés du « sur » :
          // un bandeau « n sur N » se lit d'un coup d'oeil, c'est sa raison d'être (T-54).
          : `<div class="muted small mb">${pl(trouvees.length, 'écriture trouvée', 'écritures trouvées')} sur ${total}${trouvees.length >= 200 ? ' — affichage limité aux 200 premières, précise ta recherche' : ''}.</div>
        <div class="scroll-x"><table class="list compact"><thead><tr>
          <th class="r nw">N°</th><th class="nw">Date</th><th>Journal</th><th class="nw">Pièce</th><th>Libellé</th>
          <th class="r nw">Total</th><th class="nw">État</th><th></th></tr></thead>
        <tbody>${trouvees.map(e => {
          const t = KC.soldeDeLignes(e.lignes);
          return `<tr data-re="${esc(e.id)}" class="${e.statut === 'brouillard' ? 'br-ligne' : e.statut === 'contrepassee' ? 'cp-ligne' : ''}">
            <td class="r nw">${e.numero == null ? '—' : e.numero}</td><td class="nw">${esc(fmtJour(e.date))}</td>
            <td>${esc(e.journal)}</td><td class="nw">${esc(e.piece || '—')}${marqueJustif(e, e.pieceJointe)}</td>
            <td>${esc(e.libelle || '')}</td>
            <td class="r nw">${esc(montant(t.debit))}</td>
            <td class="nw">${e.statut === 'brouillard' ? '<i>brouillard</i>' : e.statut === 'contrepassee' ? 'contre-passée' : 'validée'}</td>
            ${RowMenu.cellule('R:' + e.id, '')}</tr>`;
        }).join('')}</tbody></table></div>`}`;
  }

  // Un champ de recherche redessiné à la frappe perd le curseur, et on n'y tape qu'une lettre
  // (7.17.0). On le rend À SA PLACE, sélection comprise — pas au bout : corriger une faute au milieu
  // d'un mot renvoyait le curseur à la fin. UNE fonction pour tous les champs : la parade était
  // recopiée à deux endroits, et le troisième (le livre-journal) l'avait oubliée.
  function sansPerdreLaFrappe(champ, redessin) {
    const id = champ.id, debut = champ.selectionStart, fin = champ.selectionEnd;
    redessin();
    const n = document.getElementById(id);
    if (!n) return;
    if (document.activeElement !== n) n.focus();
    try { n.setSelectionRange(debut, fin); } catch (_) { /* un champ sans sélection : rien à rendre */ }
  }

  function brancherRecherche(el, root, dossier) {
    const s = livresState;
    const q = $('#re-q', el);
    if (q) {
      // On redessine à la frappe, mais le champ de recherche est REMIS et le curseur replacé au
      // bout : sans ça on ne peut taper qu'une lettre (défaut 7.17.0).
      q.oninput = () => { rechState.q = q.value; sansPerdreLaFrappe(q, () => drawLivres(root, dossier)); };
    }
    const j = $('#re-journal', el); if (j) j.onchange = () => { rechState.journal = j.value; drawLivres(root, dossier); };
    const st = $('#re-statut', el); if (st) st.onchange = () => { rechState.statut = st.value; drawLivres(root, dossier); };
    bindRowMenus(el, cle => {
      if (!String(cle).startsWith('R:') || !s.livre) return [];
      const e = ecritureDuLivre(s.livre, String(cle).slice(2));
      if (!e) return [];
      return actionsEcriture(root, dossier, e);
    });
  }

  // Une écriture retrouvée par son identifiant, dans un index tenu une fois par livre. Chaque menu de
  // ligne la cherchait dans TOUT le livre : un lettrage de 1 700 lignes sur un livre de 12 000 pièces
  // faisait vingt millions de comparaisons, 1,2 s à chaque dessin (10.14.0, saturation). L'index se
  // refait dès que la liste change de taille ou d'objet ; une validation modifie l'écriture SUR
  // place, et l'index pointe sur ce même objet.
  const INDEX_LIVRE = new WeakMap();
  function indexDuLivre(livre) {
    const ec = (livre && livre.ecritures) || [];
    let x = livre ? INDEX_LIVRE.get(livre) : null;
    if (!x || x.ec !== ec || x.n !== ec.length) {
      x = { ec, n: ec.length, parId: new Map(ec.map(e => [e.id, e])), extournees: new Set(ec.filter(e => e.extourneDe).map(e => e.extourneDe)) };
      if (livre) INDEX_LIVRE.set(livre, x);
    }
    return x;
  }
  const ecritureDuLivre = (livre, id) => indexDuLivre(livre).parId.get(id) || null;

  // Les actions d'une écriture, à UN endroit. Elles sont les mêmes depuis la recherche, le
  // livre-journal et le brouillard — trois tables séparées auraient divergé au premier ajout, et
  // c'est exactement le défaut que la 7.29.0 a trouvé sur le devis déjà facturé.
  function actionsEcriture(root, dossier, e) {
    const a = [];
    // Le geste qui DÉTRUIT vit tout en bas, après un trait (7.29.0). Vu au test humain (10.12.0) :
    // posé au milieu, « Supprimer ce brouillard » était la ligne juste au-dessus de « Joindre un
    // justificatif… » — un clic qui glisse d'une ligne efface une pièce au lieu d'y joindre un scan.
    let detruire = null;
    if (e.statut === 'brouillard') {
      a.push({ icon: 'oui', label: 'Valider cette écriture', hint: 'Elle prend son numéro et ne se modifiera plus',
        run: () => validerEcriture(root, dossier, e) });
      a.push({ icon: 'modifier', label: 'Reprendre dans la grille', hint: 'Elle remonte dans la saisie, modifiable',
        run: () => { saisieState.piece = pieceDepuis(e); allerSousOnglet(root, dossier, 'saisie'); } });
      detruire = { icon: 'supprimer', label: 'Supprimer ce brouillard', hint: 'Il n\'a pas de numéro : rien ne restera', danger: true,
        run: () => supprimerBrouillard(root, dossier, e) };
    }
    if (e.statut === 'validee') {
      // Le jour du miroir se dit dès le menu, par la fonction qui le posera : « à la date du jour »
      // sur un exercice passé était faux — le miroir tombe au dernier jour de l'exercice.
      const jour = K.today();
      const dm = KC.dateDuMiroir(livresState.livre, e, jour);
      a.push({ icon: 'contrat', label: 'Contre-passer cette écriture', hint: dm === jour ? 'Une écriture miroir, à la date du jour' : `Une écriture miroir, au ${fmtJour(dm)}`,
        run: () => contrepasserEcriture(root, dossier, e) });
      // Une écriture de DÉCEMBRE ne s'extourne pas dans ce livre : son extourne tombe au 1er janvier,
      // dans l'exercice suivant. On ne PROPOSE pas le geste qui sera refusé (C-06) : on propose
      // celui qui marche — la prévoir, pour qu'« Ouvrir N+1 » la pose.
      // Ni des à-nouveaux (ils ouvrent l'exercice : rien à défaire au 1er février), ni un MIROIR
      // (l'extourne d'une contre-passation rétablirait l'erreur un mois plus tard) : l'extourne est
      // le geste des charges à payer et des produits à recevoir, et de rien d'autre (10.14.0).
      const extournable = e.source !== 'an' && !e.contrepasseDe && !e.extourneDe;
      const dejaExt = indexDuLivre(livresState.livre).extournees.has(e.id);
      const dateExt = KC.premierDuMoisSuivant(e.date);
      const auSuivant = dateExt && dateExt > String((livresState.livre.exercice || {}).au || '');
      const suivante = Number((livresState.livre.exercice || {}).annee) + 1;
      if (extournable && !dejaExt && !auSuivant) {
        a.push({ icon: 'horloge', label: 'Extourner au 1er du mois suivant', hint: 'Pour une charge à payer ou un produit à recevoir',
          run: () => extournerEcriture(root, dossier, e) });
      } else if (extournable && !dejaExt && !e.extourne) {
        a.push({ icon: 'horloge', label: `Extourner à l'ouverture de ${suivante}`, hint: `Elle sera posée au ${fmtJour(dateExt)}, dans le livre de ${suivante}`,
          run: () => prevoirExtourneEcriture(root, dossier, e, dateExt, suivante) });
      }
    }
    a.push({ icon: 'texte', label: e.pieceJointe ? 'Remplacer le justificatif…' : 'Joindre un justificatif…',
      court: 'Justificatif…',
      hint: 'Le fichier est copié dans le dossier du client', run: () => joindreJustificatif(root, dossier, e.id) });
    a.push(...actionsJustifsClient(e));
    if (e.pieceJointe) {
      a.push({ icon: 'ouvrir', label: 'Ouvrir le justificatif', hint: esc(e.pieceJointe),
        run: async () => { try { ditOuverture(await api.ouvrirJustificatif(dossier.id, e.pieceJointe), String(e.pieceJointe).split(/[\\/]/).pop()); } catch (x) { await infoDialog('Justificatif introuvable', plainError(x)); } } });
    }
    if (detruire) a.push({ sep: true }, detruire);
    return a;
  }

  async function extournerEcriture(root, dossier, e) {
    if (await refusLicence('Extourner une écriture')) return;
    const date = KC.premierDuMoisSuivant(e.date);
    const ok = await confirmDialog('Extourner cette écriture ?',
      `<p>${esc(e.journal)} ${esc(e.piece || '(sans pièce)')} n° ${esc(String(e.numero))} du ${esc(fmtJour(e.date))}.</p><p>Une écriture miroir sera créée et VALIDÉE au ${esc(fmtJour(date))}. L'écriture d'origine ne bouge pas : elle reste dans son mois, avec son numéro — c'est ce qui distingue une extourne d'une contre-passation.</p>`,
      'Extourner');
    if (!ok) return;
    try {
      const r = await api.extourner(dossier.id, livresState.annee, e.id);
      livresState.livre = r.livre;
      toast(`Extourne créée au ${fmtJour(r.date)}, sous le n° ${r.numero}.`);
      drawLivres(root, dossier);
    } catch (err) { await infoDialog('Extourne impossible', plainError(err)); }
  }

  async function prevoirExtourneEcriture(root, dossier, e, date, suivante) {
    const ok = await confirmDialog(`Extourner à l'ouverture de ${suivante} ?`,
      `<p>${esc(e.journal)} ${esc(e.piece || '(sans pièce)')} n° ${esc(String(e.numero))} du ${esc(fmtJour(e.date))}.</p>
       <p>Son extourne tombe le <b>${esc(fmtJour(date))}</b> : elle vit dans le livre de ${esc(String(suivante))}, pas dans celui-ci.
       Elle y sera posée depuis l'onglet <b>Exercice</b>, avec les à-nouveaux de ${esc(String(suivante))}. L'écriture d'origine ne bouge pas.</p>`,
      'Prévoir l\'extourne');
    if (!ok) return;
    try {
      const r = await api.prevoirExtourne({ dossierId: dossier.id, annee: livresState.annee, id: e.id });
      livresState.livre = r.livre;
      drawLivres(root, dossier);
      if (r.suivantOuvert) {
        // L'exercice suivant existe déjà : ses à-nouveaux ont été posés SANS elle. On propose le même
        // geste qu'« Ouvrir N+1 », nommé d'après ce qu'il FERA (10.14.0) : des à-nouveaux validés ne
        // se refont pas — seule l'extourne entre ; la question disait « Refaire les à-nouveaux », et
        // le clic répondait « déjà validés » en rouge.
        const e = r.suivantEtat;
        const refaire = await confirmDialog(`${r.annee} est déjà ouvert`,
          e === 'completer'
            ? `<p>Ses à-nouveaux sont déjà validés : ils ne bougent pas. L'extourne, elle, peut y entrer maintenant, au ${esc(fmtJour(r.date))}, en brouillard.</p>`
            : e === 'ouvrir'
              ? `<p>Ses à-nouveaux ne sont pas encore posés : les poser maintenant y fait entrer l'extourne au ${esc(fmtJour(r.date))}.</p>`
              : `<p>Ses à-nouveaux ont été posés avant cette extourne. Les refaire maintenant la fait entrer au ${esc(fmtJour(r.date))}.</p>`,
          e === 'completer' ? 'Poser l\'extourne' : e === 'ouvrir' ? 'Poser les à-nouveaux' : 'Refaire les à-nouveaux', false, 'Plus tard');
        if (refaire) {
          const o = await api.ouvrirSuivant({ dossierId: dossier.id, annee: livresState.annee });
          toast(`Extourne posée au ${fmtJour(r.date)} dans le livre de ${o.annee}.`);
        }
      } else {
        toast(`Extourne prévue : elle sera posée au ${fmtJour(r.date)} à l'ouverture de ${r.annee}.`);
      }
    } catch (err) { await infoDialog('Extourne impossible', plainError(err)); }
  }

  function brancherVue(el, root, dossier, lignes) {
    const s = livresState;
    const redraw = () => drawLivres(root, dossier);
    // Tout ce qui change la SÉLECTION remet la page à 1 : sans ça, filtrer sur un journal depuis la
    // page 7 donne un tableau vide, et rien à l'écran n'explique pourquoi.
    const j = $('#lv-journal', el); if (j) j.onchange = () => { s.journal = j.value; s.page = 1; redraw(); };
    // Le champ de recherche du livre-journal est redessiné à chaque frappe : sans la parade, on n'y
    // tapait qu'une lettre (vu au test humain, 10.12.0 — « PAIE-2026-08 » devenait « P »). La
    // Recherche et la page Dossiers l'avaient ; lui, jamais (le jumeau manquant, 7.3.0).
    const q = $('#lv-q', el); if (q) q.oninput = () => { s.q = q.value; s.page = 1; sansPerdreLaFrappe(q, redraw); };
    const c = $('#lv-compte', el); if (c) c.onchange = () => { s.compte = c.value; s.page = 1; redraw(); };
    // Un compte qu'on a ouvert reste ouvert quand l'écran se redessine (« Montrer la suite », une
    // page suivante et retour) : sans ça, montrer plus de lignes refermait ce qu'on lisait.
    $$('details.gl-compte[data-gl]', el).forEach(d => d.addEventListener('toggle', () => {
      if (d.open) glOuverts().add(d.dataset.gl); else glOuverts().delete(d.dataset.gl);
    }));
    $$('[data-gl-plus]', el).forEach(b => b.onclick = () => {
      const compte = b.dataset.glPlus;
      s.glLimites = { ...(s.glLimites || {}), [compte]: glLimite(compte) + Number(b.dataset.glN) };
      glOuverts().add(compte);
      redraw();
    });
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
        const e = ecritureDuLivre(s.livre, id);
        if (!e) return [];
        // La MÊME table que la recherche et le brouillard : trois listes séparées auraient divergé
        // au premier ajout (règle 7.29.0).
        const actions = actionsEcriture(root, dossier, e);
        if (e.mois && (s.data.paquets || []).some(z => z.month === e.mois && z.path)) {
          actions.push({ icon: 'loupe', label: 'Voir dans le paquet', court: 'Paquet', hint: `${e.piece} · ${moisLabelCourt(e.mois)}`,
            run: () => openPack(dossier, e.mois) });
        }
        return actions;
      }
      const [piece, mois, journal, date] = String(cle).split('|');
      const p = (s.data.paquets || []).find(z => z.month === mois);
      if (!p || !p.path) return [];
      // 10.14.1 — seule sur sa ligne, l'action porte son mot court (10.12.0) : à 1280 px, « Voir dans
      // le paquet » (170 px, collé au bord) recouvrait le Crédit du livre-journal lu dans les paquets.
      return actionsJustifsClient({ piece, mois, journal, date }).concat([{ icon: 'loupe', label: 'Voir dans le paquet', court: 'Paquet', hint: `${piece} · ${moisLabelCourt(mois)}`,
        run: () => openPack(dossier, mois) }]);
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
    // Un montant et une date au format de l'app entreprise (C2) : les colonnes se reconnaissent à leur
    // clé, jamais au type de la valeur — un n° de pièce ou de compte est aussi un nombre.
    const MONTANTS = ['debit', 'credit', 'ouvertureD', 'ouvertureC', 'soldeD', 'soldeC'];
    const cell = (v, cle) => MONTANTS.includes(cle) ? K.csvMontant(v) : cle === 'date' ? K.csvDate(v) : String(v == null ? '' : v);
    const csv = [K.toCsvLine(cols.map(c => c[1]))]
      .concat(rows.map(r => K.toCsvLine(cols.map(c => cell(r[c[0]], c[0])))))
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
  // Ce que dit le panneau quand la courbe n'a rien à montrer — et pourquoi (10.14.1). Une explication
  // fausse est pire qu'une explication absente (10.14.0) : « les paquets de cette année ne portent pas
  // de chiffres (fabriqués avant la 6.2.1) » s'affichait pour une année qui n'en avait reçu AUCUN.
  function caSansChiffre(packs, annee) {
    return packs.some(p => String(p.month || '').slice(0, 4) === annee)
      ? `Les paquets de ${annee} ne portent pas de chiffres : ils ont été fabriqués avant la 6.2.1.`
      : `Aucun paquet reçu pour ${annee} : le chiffre d'affaires vient des paquets du client.`;
  }
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
      const nommes = K.monthListLabel(mois.filter((m, i) => vals[i] != null));
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
          <div class="ca-v">${v == null ? '' : esc(money(v, devise).replace(/\s\S+$/, ''))}</div>
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
    files.sort((a, b) => order(a) - order(b) || K.parNom(a.name, b.name));
    // Ce que le manifeste n'annonce pas n'a été comparé à rien — ni son empreinte, ni son existence.
    // Un paquet fabriqué par SkanFact n'en contient jamais.
    const trop = files.filter(f => f.annonce === false);
    modal(
      `<h2>${esc(dossier.name)} — ${esc(p.label)}</h2>
       ${/* 10.14.1 — la page de garde se CITE si elle est là : les paquets de l'exemple (fabriqués sans
             imprimante) n'en ont pas, et « commence par la page de garde » envoyait chercher un fichier
             absent de la liste juste en dessous. */''}
       <p class="muted small">${pl(files.length, 'fichier')}. ${files.some(f => f.name === '00-page-de-garde.pdf')
         ? 'Commence par la page de garde : elle résume le mois et liste ce qui manque.'
         : 'Ce paquet n\'a pas de page de garde : les journaux s\'ouvrent dans ton tableur, et le manifeste dit ce que ton client a envoyé.'}</p>
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
              // Un fichier dont l'extension n'est pas celle d'un document n'est pas lancé : c'est le
              // nom choisi par l'expéditeur qui déciderait sinon quel programme s'exécute.
              ditOuverture(await api.openInPack(p.path, f.name, password), f.name);
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
          <option value="">— non précisé —</option>${K.choixRegimes(S, d.regime).map(r => `<option value="${esc(r.id)}" ${d.regime === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select></label>
        <label class="field">${lbl('TVA', 'd.tvaPeriod')}<select id="f-tva">
          <option value="">— non précisé —</option>${K.TVA_PERIODS.map(r => `<option value="${esc(r.id)}" ${d.tvaPeriod === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select></label>
        <label class="field">${lbl('Début de mission', 'd.from')}<input type="text" id="f-from" value="${esc(K.moisAffiche(d.from))}" placeholder="01/2026" inputmode="numeric"></label>
        <label class="field">${lbl('Honoraires mensuels (DT)', 'd.fees')}<input type="text" inputmode="decimal" class="num montant" id="f-fees" value="${esc(montantChamp(d.fees))}" placeholder="0,000"></label>
      </div>
      <label class="field mt">${lbl('Note interne', 'd.note')}<textarea id="f-note" rows="3">${esc(d.note || '')}</textarea></label>`;
  }

  function readDossierFields(layer) {
    const from = K.moisTape($('#f-from', layer).value);
    return {
      name: $('#f-name', layer).value.trim(),
      matricule: $('#f-mat', layer).value.trim(),
      email: $('#f-email', layer).value.trim(),
      phone: $('#f-phone', layer).value.trim(),
      contact: $('#f-contact', layer).value.trim(),
      regime: $('#f-regime', layer).value,
      tvaPeriod: $('#f-tva', layer).value,
      from: from.ok ? from.mois : '',
      fees: lireMontant($('#f-fees', layer).value),
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
       <p class="small nd-plusieurs">Plusieurs clients d'un coup ? <button type="button" class="btn btn-sm" id="nd-coller">Coller une liste de clients…</button></p>
       ${dossierFields(empty)}
       <div class="modal-actions"><button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Créer le dossier</button></div>`,
      (layer, close) => {
        change = suivreSaisie(layer);
        $('#no', layer).onclick = close;
        $('#nd-coller', layer).onclick = () => { close(); collerDossiersForm(); };
        $('#ok', layer).onclick = async () => {
          const f = readDossierFields(layer);
          // Un refus MONTRE la case (7.0.0, 10.12.0) : le curseur y va, elle se marque.
          if (!f.name) return refus($('#f-name', layer), 'Donne au moins un nom à ce client.');
          const mois = K.moisTape($('#f-from', layer).value);
          if (!mois.ok) return refus($('#f-from', layer), mois.motif);
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

  // 10.14.1 — la liste collée depuis un tableur (6.8.0 : « un par un dans un formulaire, personne ne
  // le ferait ») ne vivait QUE dans l'assistant de démarrage : passé ce premier écran, « + Nouveau
  // dossier » n'offrait plus que la fiche d'un seul client, pendant que sa visite promettait « toute
  // la liste collée depuis ton tableur ». Le même moteur (`cab:importDossiers`), une porte de plus.
  function collerDossiersForm() {
    let change = () => false;
    modal(
      `<h2>Coller une liste de clients</h2>
       <p class="small">Un client par ligne, collé depuis ton tableur. Pour donner plus qu'un nom, sépare les colonnes par un point-virgule :
       <strong>nom ; matricule ; email ; téléphone</strong>. Seul le nom est obligatoire ; un client déjà dans ton portefeuille est ignoré et nommé.</p>
       <label class="field mt">${lbl('Un client par ligne', 'd.liste')}
         <textarea id="cl-liste" rows="9" placeholder="Menuiserie Trabelsi SUARL ; 1122334A/M/P/000 ; contact@trabelsi.tn&#10;Pharmacie El Menzah&#10;Café des Jasmins"></textarea></label>
       <div class="modal-actions"><button class="btn" id="no">Annuler</button><button class="btn btn-primary" id="ok">Ajouter ces clients</button></div>`,
      (layer, close) => {
        change = suivreSaisie(layer);
        $('#no', layer).onclick = close;
        $('#ok', layer).onclick = async () => {
          const txt = $('#cl-liste', layer).value.trim();
          if (!txt) return refus($('#cl-liste', layer), 'Colle au moins un nom de client, un par ligne.');
          try {
            const r = await api.importDossiers(txt);
            const ignores = (r.ignorés || []);
            if (!r.added) return refus($('#cl-liste', layer), ignores.length
              ? `Aucun client ajouté : ${pl(ignores.length, 'client')} déjà dans ton portefeuille (${ignores.slice(0, 3).join(', ')}${ignores.length > 3 ? '…' : ''}).`
              : 'Aucun nom de client n\'a été reconnu dans cette liste.');
            S = r.state; close(); render();
            toast(`${pl(r.added, 'client')} ajouté${r.added > 1 ? 's' : ''} à ton portefeuille`
              + (ignores.length ? ` — ${pl(ignores.length, 'doublon')} ignoré${ignores.length > 1 ? 's' : ''} : ${ignores.slice(0, 3).join(', ')}` : '') + '.');
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
            `<p>Le dossier <strong>${esc(dossier.name)}</strong> et ${n > 1 ? `ses ${pl(n, 'paquet')}` : n ? 'son paquet' : 'son historique'} seront <strong>effacés de ce poste</strong>.
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
          const mois = K.moisTape($('#f-from', layer).value);
          if (!mois.ok) return refus($('#f-from', layer), mois.motif);
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
    // 10.12.0 (U-11) — un seul vert : le geste de GROUPE quand il y a plusieurs clients à relancer,
    // le « Écrire » de la ligne quand il n'y en a qu'un. Chaque ligne portait son « Écrire » en vert :
    // quatre boutons verts pour trois clients, et plus aucun ne disait par où commencer. Le bouton
    // de la ligne reste visible (c'est le geste pour lequel la page existe, 7.29.0) — sans couleur.
    const vertLigne = rows.length === 1 ? 'btn btn-primary btn-sm' : 'btn btn-sm';
    // « Tous tes dossiers sont à jour » sur trois cents clients HORS SkanFact : aucun n'envoie de
    // paquet, donc aucun ne peut être « à jour » (10.14.0, saturation ; `hors` n'est pas `ok`, 6.8.0).
    // La phrase dit ce qu'on sait : combien envoient, et que les autres n'ont rien à t'envoyer.
    const phraseRienARelancer = () => {
      const tous = K.dossierList(S);
      const envoient = tous.filter(r => r.level !== 'hors').length;
      if (!envoient) return `<div class="info-box">Personne à relancer : aucun de tes ${esc(pl(tous.length, 'client'))} ne t'envoie encore ses paquets depuis SkanFact. Un client que tu tiens au cabinet n'a rien à t'envoyer.</div>`;
      return `<div class="todo-ok">Personne à relancer : ${envoient === 1 ? 'ton client sur SkanFact est à jour' : `tes ${esc(pl(envoient, 'client'))} sur SkanFact sont à jour`}${envoient < tous.length ? ` — les ${esc(String(tous.length - envoient))} autres ne t'envoient rien, ils sont tenus au cabinet ou pas encore sur SkanFact` : ''}.</div>`;
    };
    // Trois cents clients en retard faisaient trois cents lignes d'un bloc : on pagine ce qu'on NOMME.
    // Le geste de groupe, lui, porte sur tous ceux qui restent à relancer — pas sur la page.
    const pagerRel = pagerBar(rows.length, relState.pg, 'client');
    const rowsPage = paginate(rows, relState.pg);
    view.innerHTML = `
      ${/* U-13 — l'explication de la page vit dans la bulle du titre (règle 9.4.9) : un paragraphe
            permanent s'intercalait entre deux bandeaux, avant le premier nom. */''}
      <div class="page-head"><h1>Relances ${info('r.page')}</h1>
        ${rows.length > 1 ? `<div class="actions"><button class="btn btn-primary" id="group">${
  coches.length ? `Relancer ${pl(coches.length, 'client')} coché${coches.length > 1 ? 's' : ''}`
    : filtre ? `Relancer ${pl(rows.length, 'client')}` : 'Relancer tout le monde'}</button>${info('r.group')}</div>` : ''}</div>
      ${filtre ? `<div class="banner"><span><strong>${pl(rows.length, 'client')}</strong> sur ${toutes.length}${
  relState.depuis ? ` — ceux qu'il te manque pour « ${esc(relState.depuis)} »` : ''}.</span>
        <button class="btn btn-sm" id="rl-tout">Voir tout le monde</button></div>` : ''}
      ${/* `rel.due` vaut « le jour de relance est ATTEINT », pas « c'est aujourd'hui » : le 23 avec
            un jour réglé au 10, la phrase doit dire que le jour est passé, pas que c'est lui. */''}
      ${rel.due && rel.total ? `<p class="small mb" id="rl-jour">On est le <strong>${rel.jour}</strong>${rel.jour === rel.day
    ? ', ton jour de relance.' : ` : ton jour de relance, le ${rel.day}, est passé.`}
        ${[
    rel.count ? `${pl(rel.count, 'dossier')} ${rel.count > 1 ? 'ont' : 'a'} des mois manquants` : '',
    rel.provisoires ? `${pl(rel.provisoires, rel.count ? 'autre' : 'dossier')} ${rel.provisoires > 1 ? 'ont' : 'a'} envoyé un mois qui n'est pas clôturé` : ''
  ].filter(Boolean).join(', et ')}.</p>` : ''}
      ${rows.length ? `<div class="scroll-x"><table class="list">
        ${/* M11 — « tout le monde ou personne » : un comptable relance les cinq clients d'une
              échéance, ou ceux qu'il n'a pas eus au téléphone. La case d'en-tête coche ce que
              l'écran MONTRE, jamais les soixante — cocher ce qu'on ne voit pas est un piège. */''}
        <thead><tr>
          <th class="nw sel-col"><input type="checkbox" id="rl-all" aria-label="Tout cocher sur cette page"
            ${rowsPage.length && rowsPage.every(r => relState.coches.has(r.id)) ? 'checked' : ''}></th>
          <th class="nw">Client</th><th class="nw">Contact</th><th class="nw">Ce qui manque</th><th class="nw">Dernière relance</th><th></th></tr></thead>
        <tbody>${rowsPage.map(r => `<tr>
          <td class="nw sel-col"><input type="checkbox" data-sel="${esc(r.id)}" aria-label="Relancer ${esc(r.name)}" ${relState.coches.has(r.id) ? 'checked' : ''}></td>
          <td class="nw"><span class="dot-lvl ${r.level === 'ok' ? '' : esc(r.level)}"></span>${esc(r.name)}</td>
          <td class="muted nw">${esc(r.email || r.phone || '— à renseigner')}</td>
          <td>${r.missingCount
            ? esc(K.missingLabel(r.missingMonths))
            : `<span class="muted">${pl(r.provisionalCount, 'mois', 'mois')} non clôturé${r.provisionalCount > 1 ? 's' : ''}</span>`}</td>
          <td class="muted nw">${r.lastRelanceAt ? esc(fmtDay(r.lastRelanceAt)) + ` <span class="small">(${esc(ago(r.lastRelanceAt))}, ${esc(labelOf(K.RELANCE_WAYS, r.lastRelanceVia) || r.lastRelanceVia)})</span>` : 'jamais'}</td>
          ${rowMenuCell(r.id, `<button class="${vertLigne}" data-rel="${esc(r.id)}">Écrire</button>`)}</tr>`).join('')}</tbody></table></div>${pagerRel}`
        : phraseRienARelancer()}`;
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
      // Depuis la pagination (10.14.0), ce que l'écran montre est la PAGE : la case la coche, elle.
      rowsPage.forEach(r => { if (all.checked) relState.coches.add(r.id); else relState.coches.delete(r.id); });
      render();
    };
    bindPager(view, render, relState.pg);
    const rt = $('#rl-tout'); if (rt) rt.onclick = () => { relState.seulement = null; relState.depuis = ''; relState.pg.page = 1; render(); };
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
  // ---------------------------------------------------------------- le tableau de production (9.9.0)
  //
  // « Où en est chaque client, et depuis quand ? » — la question qu'un cabinet se pose le lundi
  // matin et à laquelle il répondait jusqu'ici en ouvrant soixante fiches. Tout est LU (paquets
  // reçus, écritures du livre, déclarations pointées) : une liste d'états qu'on coche à la main
  // est fausse le jour où quelqu'un oublie de cocher.
  let prodState = { lignes: null, etapes: [], collaborateurs: [], collab: '', mois: 12, pg: { page: 1, size: 50 } };

  // 10.12.0 (U-17) — une FORME par état. « Reçu » et « hors mission » portaient le même point,
  // « à réviser » et « à déclarer » le même rond : seule la couleur les distinguait, et une couleur
  // seule n'est pas une information (9.4.4). Et la légende de `recu` disait « reçu, rien de saisi »
  // pour l'étape où le paquet n'est justement PAS arrivé — l'étape est celle où le mois est BLOQUÉ.
  // Une seule table pour les cases et la légende : écrites à deux endroits, elles avaient divergé.
  const SIGNE_PRODUCTION = { recu: '○', saisi: '!', revise: '◐', declare: '◉', fini: '✓', hors: '–' };
  // « à saisir » et non « reçu, rien de saisi » : un dossier TENU AU CABINET n'a rien à recevoir,
  // et son mois vide est quand même une saisie à faire (10.12.0). C'est le mot de la colonne.
  const LEGENDE_PRODUCTION = [
    ['recu', 'pas encore reçu'], ['saisi', 'à saisir'], ['revise', 'saisi, à réviser'],
    ['declare', 'révisé, à déclarer'], ['fini', 'déclaré'], ['hors', 'hors mission']
  ];

  async function drawProduction(view) {
    if (!prodState.lignes) {
      view.innerHTML = `<div class="page-head"><h1>Production</h1></div>
        <div class="panel"><div class="empty">Lecture des dossiers…</div></div>`;
      try {
        const r = await api.production({});
        prodState = { ...prodState, lignes: r.lignes || [], etapes: r.etapes || [], collaborateurs: r.collaborateurs || [] };
      } catch (e) {
        view.innerHTML = `<div class="page-head"><h1>Production</h1></div>
          <div class="panel"><div class="warn-box">${esc(plainError(e))}</div></div>`;
        return;
      }
      // La page a pu changer pendant l'attente : on ne redessine que si on y est encore (7.6.0).
      if (!location.hash.startsWith('#/production')) return;
    }
    const confies = prodState.collab
      ? new Set((S.dossiers || []).filter(d => (d.droits || {})[prodState.collab]).map(d => d.id))
      : null;
    const lignes = (prodState.lignes || []).filter(l => !confies || confies.has(l.id));
    // Les N derniers mois, communs à toutes les lignes : une grille dont chaque ligne aurait ses
    // propres colonnes ne se lit pas en colonne, et c'est en colonne qu'on repère un mois où
    // personne n'a rien fait.
    const tous = [...new Set(lignes.flatMap(l => l.mois.map(m => m.mois)))].sort();
    const colonnes = tous.slice(-prodState.mois);
    const parDossier = new Map(lignes.map(l => [l.id, new Map(l.mois.map(m => [m.mois, m]))]));
    const retard = lignes.reduce((s, l) => s + l.aSaisir, 0);
    // Un portefeuille de trois cents dossiers faisait une page de 10 574 px (10.14.0, saturation) :
    // on pagine ce qu'on NOMME (9.4.5) — des dossiers —, et le compte « à saisir » porte sur tous.
    // `pagerBar` d'abord : c'est lui qui ramène la page dans les bornes quand un filtre réduit la liste.
    const pager = pagerBar(lignes.length, prodState.pg, 'dossier');
    const montrees = paginate(lignes, prodState.pg);

    view.innerHTML = `<div class="page-head"><h1>Production ${info('eq.production')}</h1>
      <div class="actions">
        ${prodState.collaborateurs.length ? `<label class="f-lab">Collaborateur
          <select id="pr-collab" aria-label="Filtrer sur les dossiers confiés à">
            <option value="">Tout le cabinet</option>
            ${prodState.collaborateurs.map(c => `<option value="${esc(c.id)}" ${c.id === prodState.collab ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}
          </select></label>` : ''}
        <label class="f-lab">Sur <select id="pr-mois" aria-label="Combien de mois afficher">
          ${[6, 12, 24].map(n => `<option value="${n}" ${n === prodState.mois ? 'selected' : ''}>${n} mois</option>`).join('')}
        </select></label>
      </div></div>
      ${!lignes.length ? `<div class="panel"><div class="empty">${prodState.collab
    ? 'Aucun dossier n\'est confié à cette personne.<br><span class="small">Un dossier se confie dans sa fiche, onglet Suivi, panneau « Qui travaille sur ce dossier ».</span>'
    // « Aucun dossier dans le portefeuille » s'affichait sur un portefeuille PLEIN : le tableau
    // de production lit les LIVRES, et tant qu'aucun n'est créé il n'a rien à montrer. Une phrase
    // qui dit le contraire de ce que l'écran d'à côté affiche est un bug, pas une imprécision
    // (7.3.0) — et un état vide sans geste n'apprend rien (7.0.0).
    : (S.dossiers || []).filter(d => !d.archived).length
      ? 'Aucun livre n\'est encore ouvert.<br><span class="small">Le tableau de production suit les <b>livres</b> de tes dossiers, pas leurs paquets : ouvre la comptabilité d\'un client et relis ses paquets pour qu\'il apparaisse ici.</span><div class="inline mt"><button class="btn btn-sm btn-primary" id="pr-vers-dossiers">Voir mes dossiers</button></div>'
      : 'Aucun dossier dans le portefeuille.<div class="inline mt"><button class="btn btn-sm btn-primary" id="pr-vers-dossiers">Ajouter un client</button></div>'}</div></div>`
    // « reçus et pas encore saisis » comptait aussi les mois d'un dossier tenu au cabinet, qui ne
    // reçoit rien : la phrase dit ce que la colonne compte, pour les deux sortes de dossiers.
    : `<div class="${retard ? 'warn-box' : 'ok-box'} mb">${retard
      ? `${pl(retard, 'mois', 'mois')} ${retard > 1 ? 'attendent' : 'attend'} leur saisie.`
      : 'Aucun mois n\'attend de saisie.'}</div>
      ${/* 10.12.0 (U-02) — des en-têtes de mois COURTS, l'année seulement quand elle change : douze
            « juillet 2026 » sur deux lignes faisaient déborder la grille, et la dernière colonne,
            collante, cachait juillet et août. (U-29) Le nom du client se tronque, jamais son badge :
            coupé par les points de suspension, « exemple » devenait « exem… ». */''}
      <div class="panel"><div class="scroll-x"><table class="list compact prod">
        <thead><tr><th>Client</th>${colonnes.map((m, i) => `<th class="r nw" title="${esc(K.monthLabel(m))}">${esc(MOIS_COURTS[Number(m.slice(5, 7)) - 1] || m)}${
    i === 0 || m.slice(5, 7) === '01' ? `<br><span class="muted small">${esc(m.slice(0, 4))}</span>` : ''}</th>`).join('')}<th class="r nw">À saisir</th></tr></thead>
        <tbody>${montrees.map(l => `<tr data-id="${esc(l.id)}">
          <td class="prod-client"><span class="prod-nom" title="${esc(l.name)}">${esc(l.name)}</span>${l.demo ? ' <span class="badge">exemple</span>' : ''}</td>
          ${colonnes.map(m => {
    const c = (parDossier.get(l.id) || new Map()).get(m);
    if (!c) return '<td class="r prod-c"><span class="prod-p prod-hors" title="Hors mission : rien n\'est attendu pour ce mois">–</span></td>';
    const t = [
      `${K.monthLabel(m)} — ${c.recu === null ? 'tenu au cabinet' : c.recu ? 'reçu' : 'pas reçu'}`,
      c.saisi ? `${pl(c.saisi, 'écriture')} dont ${c.brouillards} au brouillard` : 'rien de saisi',
      // « — » et non « non » : la révision n'a pas encore d'écrivain, et ne pas savoir
      // n'est pas savoir que non (règle des cases fiscales, 9.6.0).
      `révisé : ${c.revise === null ? '—' : c.revise ? 'oui' : 'non'}`,
      `déclaré : ${c.declare === null ? '—' : c.declare ? 'oui' : 'non'}`,
      c.qui ? `dernier geste : ${c.qui}` : ''
    ].filter(Boolean).join(' · ');
    return `<td class="r prod-c"><span class="prod-p prod-${esc(c.etape)}" title="${esc(t)}">${esc(SIGNE_PRODUCTION[c.etape] || '?')}</span></td>`;
  }).join('')}
          <td class="r nw">${l.aSaisir ? `<b class="err-inline">${l.aSaisir}</b>` : '—'}</td></tr>`).join('')}</tbody>
      </table></div>
      ${pager}
      ${/* Une couleur seule n'est pas une information (9.4.4) : la légende nomme chaque étape, et
            elle est engendrée depuis `ETAPES_PRODUCTION` — écrite à la main, elle oublierait la
            cinquième le jour où le cabinet en ajoute une. */''}
      <div class="prod-leg small muted">${LEGENDE_PRODUCTION.map(([etape, mot]) =>
    `<span><span class="prod-p prod-${etape}">${esc(SIGNE_PRODUCTION[etape])}</span> ${esc(mot)}</span>`).join('')}</div>
      <p class="muted small">Clique une ligne pour ouvrir la comptabilité du client.
      « Révisé » affiche « — » tant que le dossier de révision n'existe pas : ne pas savoir n'est pas « non ».</p>
      </div>`}`;

    const c = $('#pr-collab', view);
    if (c) c.onchange = () => { prodState.collab = c.value; prodState.pg.page = 1; render(); };
    bindPager(view, () => render(), prodState.pg);
    const pv = $('#pr-vers-dossiers', view);
    if (pv) pv.onclick = () => { location.hash = '#/dossiers'; };
    const m = $('#pr-mois', view);
    if (m) m.onchange = () => { prodState.mois = Number(m.value) || 12; render(); };
    $$('tbody tr[data-id]', view).forEach(tr => {
      tr.onclick = () => { location.hash = `#/dossier/${tr.dataset.id}/comptabilite`; };
    });
    // Une route ASYNCHRONE pose son écran APRÈS la fin de `render()` : la ponctuation française
    // serait passée sur la page « Lecture des dossiers… » et jamais sur celle-ci (piège 8.3.0).
    typographie(view);
  }

  // Les Échéances sans aucune échéance : la raison, et le geste qui les remplit.
  function drawEcheancesVides(view) {
    // « Aucun client pour l'instant » s'affichait aussi à un cabinet qui en a — un client hors
    // SkanFact dont personne ne tient encore le livre n'a aucune échéance à suivre, et la page
    // disait qu'il n'existait pas (10.14.0, vu au test humain). Un état vide dit SA raison (E-06)
    // et le geste qui le remplit : ouvrir la comptabilité d'un client, ou lui remettre le fichier.
    const clients = K.dossierList(S);
    if (!clients.length) {
      view.innerHTML = `<div class="page-head"><h1>Échéances</h1></div>
        <div class="panel"><h2>Aucun client pour l'instant</h2>
          <p>Le calendrier se remplit tout seul à partir de tes dossiers et de la périodicité de TVA que tu leur donnes.</p>
          <div class="modal-actions"><button class="btn btn-primary" id="nd">Ajouter mes clients…</button></div></div>`;
      $('#nd').onclick = () => newDossierForm();
      return;
    }
    const seul = clients.length === 1 ? clients[0] : null;
    view.innerHTML = `<div class="page-head"><h1>Échéances</h1></div>
      <div class="panel"><h2>Aucune échéance à suivre pour l'instant</h2>
        <p>Le calendrier suit les clients qui t'envoient leurs paquets depuis SkanFact, et ceux dont tu tiens
        la comptabilité ici. ${seul ? `<b>${esc(seul.name)}</b> n'est encore dans aucun de ces deux cas`
    : `Tes ${clients.length} clients ne sont encore dans aucun de ces deux cas`} : dès qu'un client t'envoie
        un paquet ou que tu ouvres son livre, ses déclarations apparaissent ici.</p>
        <div class="modal-actions"><button class="btn btn-primary" id="ech-livre">${seul ? `Ouvrir la comptabilité ${esc(K.de(seul.name))}` : 'Choisir un client à tenir…'}</button>
        <button class="btn" id="ech-pair">Remettre le fichier à mes clients…</button></div></div>`;
    $('#ech-livre').onclick = () => { location.hash = seul ? `#/dossier/${seul.id}/comptabilite` : '#/dossiers'; };
    $('#ech-pair').onclick = () => remettreAppairage();
    typographie(view);
  }

  function drawEcheances(view) {
    const liste = K.echeances(S, null, { employeurs: employeursConnus(), tenus: tenusConnus() });
    const prochaines = liste.filter(e => !e.passee);
    const passees = liste.filter(e => e.passee).reverse();

    if (!liste.length) { drawEcheancesVides(view); return; }

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
      // Cinq « Marquer déposée » sur une page sont cinq boutons qu'un lecteur d'écran ne distingue
      // pas (vu par Browser Use, 10.12.0) : le NOM porte l'échéance, le libellé visible reste court —
      // la carte le dit déjà autour de lui.
      const relLab = e.manquants.length > 1 ? `Relancer ces ${pl(e.manquants.length, 'client')}` : 'Relancer ce client';
      const depLab = depose ? 'Annuler « déposée »' : 'Marquer déposée';
      return `<div class="ech lvl-${depose ? 'ok' : e.level}${depose ? ' ech-fait' : ''}">
      <div class="ech-date"><div class="ech-j">${esc(e.date.slice(8))}</div><div class="ech-m">${esc(K.monthLabel(e.date.slice(0, 7)).split(' ')[0])}</div></div>
      <div class="ech-txt">
        <div class="ech-lab">${esc(e.label)}<span class="ech-when">${depose ? 'déposée' : e.passee ? `il y a ${-e.jours} j` : e.jours === 0 ? "aujourd'hui" : `dans ${e.jours} j`}</span></div>
        ${nouveauDetail ? `<div class="small muted">${esc(e.detail)}</div>` : ''}
        <div class="ech-bar">
          <span class="ok-inline">${e.prets} prêt${e.prets > 1 ? 's' : ''}</span>
          ${e.provisoires.length ? `<span class="warn-inline">${e.provisoires.length} en provisoire</span>` : ''}
          ${e.manquants.length ? `<span class="err-inline">${e.manquants.length} sans ${e.mois.length > 1 ? 'les mois' : 'le mois'}</span>` : ''}
          ${(e.aSaisir || []).length ? `<span class="err-inline">${e.aSaisir.length} à saisir au cabinet</span>` : ''}
          <span class="muted small">sur ${pl(e.clients, 'client')}</span>
        </div>
        ${/* 10.12.0 — un dossier TENU AU CABINET dont le mois n'a aucune écriture : on ne le relance
              pas (il n'envoie rien), on le SAISIT. Un seul : sa saisie, directement ; plusieurs : la
              Production, qui nomme leurs mois un par un. */''}
        ${(e.aSaisir || []).length ? `<div class="small mt ech-qui">${esc(e.aSaisir.slice(0, 8).join(', '))}${e.aSaisir.length > 8 ? '…' : ''}
          ${e.aSaisir.length === 1
            ? `<button class="btn btn-sm" data-saisir-tenu="${esc(e.aSaisirIds[0])}" aria-label="${esc('Ouvrir sa saisie — ' + e.label)}">Ouvrir sa saisie</button>`
            : `<button class="btn btn-sm" data-vers-production="1" aria-label="${esc('Voir dans la Production — ' + e.label)}">Voir dans la Production</button>`}</div>` : ''}
        ${e.manquants.length ? `<div class="small mt ech-qui">${memeListe
          ? `<span class="muted">${e.manquants.length > 1 ? `Les mêmes ${pl(e.manquants.length, 'client')}` : 'Le même client'} que l'échéance du dessus.</span>`
          : `${esc(e.manquants.slice(0, 8).join(', '))}${e.manquants.length > 8 ? '…' : ''}`}
          ${/* Un lien souligné au milieu d'une phrase n'est pas un geste : c'est un vrai bouton, et
                il emmène aux Relances FILTRÉES sur ces clients-là — « Les relancer » qui ouvre les
                soixante n'a pas tenu sa promesse (règle 7.15.0). */''}
          <button class="btn btn-sm" data-relq="${esc(cle)}" aria-label="${esc(relLab + ' — ' + e.label)}">${esc(relLab)}</button></div>` : ''}
        ${/* Pointer une occurrence, jamais une règle (7.21.0) : la TVA d'avril cesse de réclamer,
              celle de mai reste due. Et c'est un PENSE-BÊTE — le Cabinet ne dépose rien et ne se
              connecte à aucune administration : c'est écrit UNE fois, en tête de la page (U-21). */''}
        <div class="ech-fin"><button class="btn btn-sm ${depose ? '' : 'btn-ghost'}" data-depot="${esc(cle)}" aria-label="${esc(depLab + ' — ' + e.label)}">${esc(depLab)}</button></div>
      </div></div>`;
    };

    const jours = K.deadlineSettings(S);
    view.innerHTML = `
      ${/* 10.12.0 (U-21, U-13) — ce qui vaut pour TOUTES les cartes se dit UNE fois, en tête : « Un
            pense-bête : SkanFact ne dépose rien à ta place » se répétait sous chacune, et le rappel
            des jours proposés vivait dans un encadré orange PERMANENT — une réserve, pas un geste
            à faire. L'explication de la page vit dans la bulle du titre (règle 9.4.9). */''}
      <div class="page-head"><h1>Échéances ${info('ec.dates')}</h1></div>
      <p class="muted small mb" id="ec-regle">Des pense-bêtes : SkanFact Cabinet ne dépose rien à ta place ${info('ec.depot')} ·
      jours proposés : TVA le ${esc(jours.tvaDay)}, CNSS le ${esc(jours.cnssDay)} du mois suivant — <strong>À VÉRIFIER</strong>,
      ils se règlent dans <a href="#/reglages">Réglages</a>.</p>

      <div class="panel"><h2>À venir</h2>
        ${prochaines.length ? `<div class="ech-list">${prochaines.map(carte).join('')}</div>`
          : '<div class="empty mini">Rien dans les trois prochains mois.</div>'}</div>

      ${passees.length ? `<div class="panel"><h2>Déjà passées ${info('ec.passees')}</h2>
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
        relState.seulement = e ? e.manquants.slice() : null; relState.pg.page = 1;
        relState.depuis = e ? e.label : '';
        vers('#/relances');
      };
    });
    $$('[data-saisir-tenu]', view).forEach(b2 => {
      b2.onclick = () => { location.hash = '#/dossier/' + encodeURIComponent(b2.dataset.saisirTenu) + '/comptabilite/saisie'; };
    });
    $$('[data-vers-production]', view).forEach(b2 => { b2.onclick = () => { location.hash = '#/production'; }; });
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
    // L'accord suit le compte (10.12.0, vu au test humain) : « 1 paquet n'est pas définitif … Leur mois …
    // Ils sont quand même exportés » se lisait sur l'exemple, qui en a UN.
    const provPlus = plan.provisoires.length > 1;
    const opts = m => mois.map(x => `<option value="${esc(x)}" ${m === x ? 'selected' : ''}>${esc(K.monthLabel(x))}</option>`).join('');

    view.innerHTML = `
      <div class="page-head"><h1>Écritures</h1></div>
      <p class="muted small mb">Un seul fichier CSV, toutes les écritures de la période, avec le client et le mois devant chaque ligne —
      à importer dans ton logiciel au lieu de ressaisir. ${info('e.import')}</p>
      ${/* 10.10.0 (C-07) — ce regroupement lit les PAQUETS reçus. Un client hors SkanFact n'en
            envoie aucun : il n'y entrera jamais, et le taire ferait croire à un export complet. */''}
      ${(S.dossiers || []).some(d => d.manual && !d.archived && !d.demo)
    ? '<p class="muted small mb">Les clients <b>hors SkanFact</b> n\'y entrent pas : ils n\'envoient pas de paquet. Leur livre-journal s\'exporte depuis leur fiche, onglet Comptabilité → Livre-journal.</p>' : ''}

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

        ${plan.provisoires.length ? `<div class="warn-box mt">${info('e.provisoire')} <strong>${pl(plan.provisoires.length, 'paquet')} ${provPlus ? 'ne sont' : 'n\'est'} pas définitif${provPlus ? 's' : ''}</strong> :
          ${esc(plan.provisoires.slice(0, 6).join(' · '))}${plan.provisoires.length > 6 ? ' …' : ''}.
          ${provPlus ? 'Leur mois n\'a' : 'Son mois n\'a'} pas été clôturé chez le client : les chiffres peuvent encore changer. ${provPlus ? 'Ils sont quand même exportés' : 'Il est quand même exporté'}.</div>` : ''}
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
         <div><span>Mois</span><span>${esc(K.monthListLabel(r.mois))}</span></div>
         <div><span>Fichier</span><span class="path">${esc(r.path)}</span></div>
       </div>
       ${r.illisibles && r.illisibles.length ? `<div class="warn-box mt"><strong>${pl(r.illisibles.length, 'paquet')} n'${r.illisibles.length > 1 ? 'ont' : 'a'} pas pu être lu${r.illisibles.length > 1 ? 's' : ''}</strong> :
         <ul class="small" style="margin:6px 0 0;padding-inline-start:18px">${r.illisibles.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
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
  // Les droits d'un dossier (9.9.0). Le tableau se dessine à partir de l'état déjà chargé (`S`) :
  // pas d'appel, donc pas de panneau qui apparaît une seconde après le reste.
  function panneauDroits(dossier) {
    const liste = (S.collaborateurs || []).filter(c => c.actif);
    if (!liste.length) return '';
    const droits = dossier.droits || {};
    const confies = liste.filter(c => droits[c.id]);
    return `<div class="panel" id="d-droits"><h2>Qui travaille sur ce dossier ${info('eq.droits')}</h2>
      <div class="scroll-x"><table class="list compact"><thead><tr>
        <th>Collaborateur</th><th>Rôle général</th><th>Sur ce dossier</th></tr></thead>
      <tbody>${liste.map(c => `<tr>
        <td>${esc(c.nom)}${c.id === S.moi ? ' <span class="badge">toi</span>' : ''}</td>
        <td class="muted">${esc(K.LIBELLE_ROLE[c.role])}</td>
        <td><select class="dr-role" data-collab="${esc(c.id)}" aria-label="Droit de ${esc(c.nom)} sur ce dossier">
          <option value="">— son rôle général —</option>
          ${K.ROLES_COLLAB.map(r => `<option value="${r}" ${droits[c.id] === r ? 'selected' : ''}>${esc(K.LIBELLE_ROLE[r])}</option>`).join('')}
        </select></td></tr>`).join('')}</tbody></table></div>
      ${/* « Confié » et « autorisé » ne sont pas la même question, et les confondre ferait mentir
            le « À faire » de chacun. On le DIT plutôt que de le laisser deviner. */''}
      <p class="muted small mt">${confies.length
    ? `Ce dossier est confié à <b>${confies.map(c => esc(c.nom)).join(', ')}</b> : il apparaît dans ${confies.length > 1 ? 'leurs' : 'son'} « À faire ».`
    : 'Ce dossier n\'est confié à personne : tout le monde peut y travailler selon son rôle général, et il n\'apparaît dans aucun « À faire » personnel.'}</p>
      ${/* 10.14.1 (U-11) — au repos, rien à enregistrer : le vert de la page est « Relancer ». Le
            bouton s'allume au premier choix changé (`data-enreg` + `sale`, comme les Réglages). */''}
      <div class="modal-actions"><span class="saved" id="dr-saved" hidden></span>
        <button class="btn" id="dr-save" data-enreg>Enregistrer les droits</button></div></div>`;
  }

  function brancherDroits(view, dossier) {
    const b = $('#dr-save', view);
    if (!b) return;
    $$('.dr-role', view).forEach(sel => sel.addEventListener('change', () => sale(sel)));
    b.onclick = async () => {
      const droits = {};
      $$('.dr-role', view).forEach(s => { if (s.value) droits[s.dataset.collab] = s.value; });
      try {
        S = await api.saveDroits(dossier.id, droits);
        // La page se redessine (la phrase « confié à … » change) : le « ✓ enregistré » se pose sur
        // le panneau NEUF — posé avant, il partait avec l'ancien, et on ne le voyait jamais.
        render();
        flash($('#dr-saved'));
      } catch (e) { await infoDialog('Les droits n\'ont pas été enregistrés', plainError(e)); }
    };
  }

  // ---------------------------------------------------------------- l'équipe (9.9.0)
  //
  // Trois questions, dans cet ordre, parce que c'est l'ordre où elles se posent : qui travaille sur
  // CE poste, qui compose le cabinet, et qui a le droit de faire quoi. Tant que personne n'est
  // déclaré, le panneau ne montre qu'une phrase et un bouton — un cabinet d'une personne n'a rien
  // à régler, et lui poser une grille de droits vide serait lui vendre un problème qu'il n'a pas.
  let equipe = null;
  async function dessinerEquipe(view, dejaLu) {
    if (!dejaLu) {
      try { equipe = await api.collaborateurs(); } catch { equipe = null; }
      // La page a pu changer pendant l'attente : on redemande l'élément APRÈS (règle 7.6.0).
      return dessinerEquipe(document, true);
    }
    const box = $('#eq-panel', view);
    if (!box) return;
    if (!equipe) { box.innerHTML = '<p class="muted small">Chargement…</p>'; return; }
    const liste = (equipe.liste || []).filter(c => c.actif);
    const g = equipe.gestion || { ok: false };
    const moi = liste.find(c => c.id === equipe.moi) || null;
    box.innerHTML = `
      ${liste.length ? `<div class="${moi ? 'ok-box' : 'warn-box'} mb" id="eq-moi">
          ${/* 10.14.0 — la phrase est UN élément : dans ce bandeau flex, chaque morceau de texte et le
                nom en gras devenaient trois éléments séparés par l'écart du bandeau (« c'est   Karim
                   qui travaille »), la règle de la 10.12.0 sur l'étiquette d'une case, vue à la souris. */''}
          <span class="eq-phrase">${moi ? `Sur cet ordinateur, c'est <b>${esc(moi.nom)}</b> qui travaille — ${esc(K.LIBELLE_ROLE[moi.role])}.`
    : 'Cet ordinateur ne dit pas qui travaille dessus : la piste d\'audit portera le nom du poste, et les droits par dossier ne s\'appliquent pas.'}</span>
          <label class="f-lab mt-s">Je suis
            <select id="eq-je-suis" aria-label="Qui travaille sur cet ordinateur">
              <option value="">— personne de déclaré —</option>
              ${liste.map(c => `<option value="${esc(c.id)}" ${c.id === equipe.moi ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}
            </select></label>
        </div>`
    : `<p class="small">Ce cabinet fonctionne <strong>à une personne</strong> : rien n'est restreint, et la piste
          d'audit porte le nom de cet ordinateur. Déclare tes collaborateurs le jour où vous êtes plusieurs —
          chaque écriture validée portera alors le nom de qui l'a validée.</p>`}

      ${liste.length ? `<div class="scroll-x"><table class="list compact"><thead><tr>
          <th>Nom</th><th>Rôle</th><th>Poste habituel</th><th></th></tr></thead>
        <tbody>${liste.map(c => `<tr${c.id === equipe.moi ? ' class="eq-moi"' : ''}>
          <td>${esc(c.nom)}${c.id === equipe.moi ? ' <span class="badge">ce poste</span>' : ''}</td>
          <td>${esc(K.LIBELLE_ROLE[c.role])} <span class="muted small">— ${esc(K.DETAIL_ROLE[c.role])}</span></td>
          <td class="muted">${esc(c.poste || '—')}</td>
          ${g.ok ? RowMenu.cellule('EQ:' + c.id) : '<td class="row-actions"></td>'}</tr>`).join('')}</tbody></table></div>` : ''}

      ${/* Un bouton éteint DIT pourquoi, et par la même fonction que celle qui refusera (9.4.5) :
            `peutGererCollaborateurs` est appelée côté processus principal au moment du geste, et
            son verdict voyage jusqu'ici. Deux contrôles recopiés finiraient par diverger, et
            l'écran proposerait un geste que l'enregistrement refuse. */''}
      ${g.ok ? '' : `<p class="muted small mt">${esc(g.motif || '')} ${esc(g.geste || '')}</p>`}
      <div class="modal-actions">
        <button class="btn" id="eq-add" ${g.ok ? '' : 'disabled'}>Ajouter un collaborateur…</button>
      </div>
      <p class="muted small">Une identité <strong>déclarée</strong>, pas un mot de passe : celui du cabinet ouvre déjà
      toute la base, donc un second par personne ne protégerait rien de plus. Ce que les rôles apportent, c'est de
      savoir <strong>qui</strong> a validé une écriture, et d'éviter qu'elle soit validée par quelqu'un dont ce n'est
      pas le travail. Les droits d'un dossier précis se règlent dans sa fiche, onglet <strong>Suivi</strong>.</p>`;

    const sel = $('#eq-je-suis', box);
    if (sel) {
      sel.onchange = async () => {
        try {
          await api.jeSuis(sel.value);
          S = await api.state();
          equipe = await api.collaborateurs();
          dessinerEquipe(document, true);
          toast(sel.value ? 'C\'est noté : tes gestes porteront ton nom.' : 'Plus personne n\'est déclaré sur ce poste.');
        } catch (e) { toast(plainError(e), 'error'); }
      };
    }
    const add = $('#eq-add', box);
    if (add) add.onclick = () => formCollaborateur(null);
    RowMenu.brancherMenus(box, id => {
      const c = liste.find(x => x.id === String(id).slice(3));
      if (!c) return [];
      return [
        { icon: 'modifier', label: 'Modifier ce collaborateur', detail: 'Son nom et son rôle.', run: () => formCollaborateur(c) },
        { sep: true },
        { icon: 'supprimer', label: 'Retirer du cabinet', danger: true,
          detail: 'Son nom reste sur les écritures qu\'il a validées : une piste d\'audit ne s\'efface pas.',
          run: () => retirerCollaborateur(c) }
      ];
    });
  }

  function formCollaborateur(c) {
    // 10.14.0 — le premier déclaré devient l'identité de ce poste (9.9.0) : c'est presque toujours le
    // comptable lui-même, envoyé ici par « Tes premiers pas ». On le lui dit AVANT d'enregistrer
    // (un avertissement se lit avant le geste, 9.4.2) — le toast le disait après — et on lui propose
    // « Supervision » : « Saisie », la première option, lui retirait la validation de ses écritures.
    const premier = !c && !K.collaborateurs({ collaborateurs: (equipe && equipe.liste) || [] }).length;
    const role = c ? c.role : K.roleProposeCollab({ collaborateurs: (equipe && equipe.liste) || [] });
    modal(`<h2>${c ? 'Modifier ' + esc(c.nom) : 'Ajouter un collaborateur'}</h2>
      ${premier ? `<div class="info-box mb" id="eq-premier"><b>Commence par toi : le premier déclaré devient le nom de cet
        ordinateur.</b> Tes écritures validées le porteront. « Supervision » te garde tous les droits — la clôture et la
        gestion de l'équipe comprises.</div>` : ''}
      <label class="field obligatoire">${lbl('Nom', 'eq.nom')}
        <input type="text" id="eq-nom" value="${esc(c ? c.nom : '')}" placeholder="Amine Ben Salah"></label>
      <label class="field">${lbl('Rôle', 'eq.role')}<select id="eq-role">
        ${K.ROLES_COLLAB.map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${esc(K.LIBELLE_ROLE[r])}</option>`).join('')}
      </select></label>
      <p class="muted small" id="eq-detail"></p>
      <p class="muted small">Le rôle vaut partout, sauf sur les dossiers où un droit a été posé pour cette personne :
      c'est ce qui permet de confier un dossier à quelqu'un sans lui ouvrir tout le portefeuille.</p>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button>
        <button class="btn btn-primary" id="eq-ok">${c ? 'Enregistrer' : 'Ajouter'}</button></div>`,
    (couche, close) => {
      // Le détail du rôle suit la liste : choisir « Supervision » sans savoir ce que ça ouvre, c'est
      // choisir au hasard. La phrase vient de `DETAIL_ROLE`, la même que le tableau affiche.
      const r = $('#eq-role', couche), d = $('#eq-detail', couche);
      const dire = () => { d.textContent = K.DETAIL_ROLE[r.value] || ''; };
      r.onchange = dire; dire();
      $('#eq-ok', couche).onclick = async () => {
        const nom = $('#eq-nom', couche).value.trim();
        try {
          const avant = (equipe.liste || []).filter(x => x.actif).length;
          S = await api.saveCollaborateur({ id: c ? c.id : '', nom, role: r.value });
          equipe = await api.collaborateurs();
          close(); dessinerEquipe(document, true);
          // Le premier déclaré devient l'identité de ce poste : on le DIT, sinon la personne
          // découvre son nom en haut d'un bandeau sans savoir qui l'y a mis.
          toast(c ? 'Collaborateur enregistré.'
            : avant ? `${nom} fait partie du cabinet.`
              : `${nom} fait partie du cabinet, et c'est ton nom sur cet ordinateur.`);
        } catch (e) {
          // Un refus se MONTRE : on ramène le champ fautif à l'écran avec le curseur dedans,
          // plutôt qu'une phrase au-dessus d'un formulaire qui a pu défiler (règle 7.0.0).
          refus($('#eq-nom', couche), plainError(e));
        }
      };
    });
  }

  async function retirerCollaborateur(c) {
    const ok = await confirmDialog(`Retirer ${c.nom} ?`,
      '<p>Son nom <strong>reste</strong> sur les écritures qu\'il a validées : une piste d\'audit ne s\'efface pas, '
      + 'et c\'est elle que lit un contrôle.</p><p>Il ne pourra plus être choisi comme identité sur un poste, '
      + 'et les droits posés pour lui sur des dossiers cessent de s\'appliquer.</p>', 'Retirer', true);
    if (!ok) return;
    try {
      S = await api.retirerCollaborateur(c.id);
      equipe = await api.collaborateurs();
      dessinerEquipe(document, true);
      toast(`${c.nom} a été retiré du cabinet.`);
    } catch (e) { await infoDialog('Ce collaborateur reste en place', plainError(e)); }
  }

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
        <div><div class="k-label">Couverts</div><div class="ver">${licCab.autorises == null ? 'sans limite' : licCab.autorises}</div></div>
      </div>
      ${c.comptes ? `<h3 class="mt">Les dossiers comptés ${info('lic.comptes')}</h3>
        <ul class="small">${c.liste.slice(0, 40).map(d => `<li>${esc(d.name || d.id)} <span class="muted">— ${esc(d.raison)}</span></li>`).join('')}</ul>`
        : `<p class="muted small mt">Aucun dossier compté pour l'instant.</p>`}
      ${Object.keys(c.raisons).length ? `<h3 class="mt">Ce qui ne compte pas</h3>
        <ul class="small">${Object.keys(c.raisons).map(r => `<li>${esc(r)} <span class="muted">— ${pl(c.raisons[r], 'dossier')}</span></li>`).join('')}</ul>` : ''}
      <h3 class="mt">Ta clé ${info('lic.cle')}</h3>
      ${licCab.empreinte ? `<p class="small">Empreinte de ta licence ${info('lic.empreinteCle')} :
        <span class="mono">${esc(licCab.empreinte)}</span>
        <button type="button" class="btn btn-sm" id="lic-copier-emp">Copier</button></p>` : ''}
      <label class="field">${lbl('Colle ta clé ici', 'lic.cle')}<textarea id="lic-key" rows="3" spellcheck="false" placeholder="SKAN1.…">${esc(licCab.key || '')}</textarea></label>
      <div class="modal-actions">
        ${licCab.key ? '<button class="btn" id="lic-clear">Retirer la clé</button>' : ''}
        <button class="btn" id="lic-ask">Demander une licence…</button>
        <button class="btn" id="lic-save" data-enreg>Enregistrer la clé</button>
      </div>
      <p class="muted small">Ce qui part dans la demande : ton <strong>empreinte</strong>, le nombre de dossiers comptés
      et la version. <strong>Jamais un nom de client</strong> — ton portefeuille ne sort pas d'ici.</p>`;

    // Trente-deux caractères affichés sans bouton pour les prendre se recopient à la main,
    // donc se recopient faux (10.9.2).
    const cp = $('#lic-copier-emp', box);
    if (cp) {
      cp.onclick = () => copierEmpreinte(licCab.empreinte);
    }
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
      // La touche vit dans `data-code` ; le champ reste VIDE — il n'est que la zone où l'on appuie.
      const poser = v => { inp.dataset.code = v; if (vue) vue.innerHTML = kbd(v); sale(inp); };
      inp.onkeydown = ev => {
        if (ev.key === 'Escape') { inp.blur(); return; }
        // Un modificateur seul n'est pas un raccourci : on attend la touche qui l'accompagne.
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(ev.key)) { ev.preventDefault(); return; }
        ev.preventDefault();
        poser(toucheDe(ev));
      };
      inp.onfocus = () => { inp.placeholder = 'Appuie sur la touche…'; };
      inp.onblur = () => { inp.placeholder = 'Changer…'; };
    });
    $$('[data-touche-reset]', view).forEach(b => {
      b.onclick = () => {
        const k = b.dataset.toucheReset, d = K.DEFAULT_SAISIE.touches[k];
        const inp = $(`[data-touche="${k}"]`, view), vue = $(`[data-vue="${k}"]`, view);
        if (inp) inp.dataset.code = d;
        if (vue) vue.innerHTML = kbd(d);
        sale(b);
      };
    });
    const sr = $('#sr-save', view);
    if (sr) {
      sr.onclick = async () => {
        const touches = {};
        $$('[data-touche]', view).forEach(i => { touches[i.dataset.touche] = String(i.dataset.code || '').trim() || K.DEFAULT_SAISIE.touches[i.dataset.touche]; });
        try {
          S = await api.saveCabinet({
            name: (S.cabinet || {}).name || '', email: (S.cabinet || {}).email || '', phone: (S.cabinet || {}).phone || '',
            settings: {
              saisie: {
                journalParDefaut: $('#sr-journal', view).value.trim().toUpperCase(),
                dateComplete: $('#sr-datec', view).checked,
                validerParLot: $('#sr-lot', view).checked,
                touches,
                // « Tes premiers pas » se cochent sur un GESTE (10.12.0) : `migrate` remplit ces
                // réglages d'office, leur présence ne prouve rien. L'enregistrement, si.
                regleLe: new Date().toISOString()
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

    // F-9.6.0-12 (livré en 10.0.0) — les régimes et ce que chacun dépose. La table part VIDE : tant
    // qu'elle l'est, le calendrier ne change pas d'un pixel. C'est le cabinet qui écrit SES règles.
    const ra = $('#sr-reg-add', view);
    if (ra) ra.onclick = () => { regBrouillon = lireRegimes(view).concat([{ id: '', label: '', tva: '', cnss: true, annuelles: [] }]); dessinerRegimes(view); };
    const rb = $('#sr-reg-base', view);
    if (rb) rb.onclick = () => {
      regBrouillon = K.REGIMES.map(r => ({ id: r.id, label: r.label, tva: '', cnss: true, annuelles: [] }));
      dessinerRegimes(view);
      toast('Les trois régimes sont posés, sans aucune règle : à toi de dire ce que chacun dépose.');
    };
    const rs2 = $('#sr-reg-save', view);
    if (rs2) rs2.onclick = async () => {
      const table = lireRegimes(view).filter(r => r.id || r.label);
      if (table.some(r => !r.id || !r.label)) return toast('Chaque régime a besoin d\'un identifiant et d\'un nom.', 'error');
      try {
        S = await api.saveCabinet({ settings: { regimes: table } });
        regBrouillon = null; dessinerRegimes(view); flash($('#sr-reg-saved', view));
      } catch (e) { toast(plainError(e), 'error'); }
    };
    dessinerRegimes(view);

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

    // 9.10.0 — les cycles de révision et le questionnaire de fin d'exercice. Les deux se saisissent
    // et s'enregistrent ENSEMBLE : ce sont les deux moitiés d'une même chose, la méthode du cabinet.
    const ca = $('#sr-cycles-add', view);
    if (ca) ca.onclick = () => { cyclesBrouillon = lireCycles(view).concat([{ id: '', label: '', prefixes: [] }]); dessinerCycles(view); };
    const cr = $('#sr-cycles-reset', view);
    if (cr) cr.onclick = async () => {
      if (!await confirmDialog('Reprendre les sept cycles proposés ?',
        '<p>Tes cycles à toi seront remplacés par ceux que SkanFact propose. Tu pourras les remodifier ensuite.</p>', 'Reprendre', false)) return;
      cyclesBrouillon = KC.CYCLES_REVISION.map(c => ({ ...c, prefixes: c.prefixes.slice() }));
      dessinerCycles(view);
    };
    const qa = $('#sr-quest-add', view);
    if (qa) qa.onclick = () => { questBrouillon = lireQuestionnaire(view).concat(['']); dessinerQuestionnaire(view); };
    const qs = $('#sr-quest-save', view);
    if (qs) qs.onclick = async () => {
      // Une table de cycles À MOITIÉ remplie est pire que pas de table : le compte tombe alors dans
      // un cycle qui n'a pas de nom, et la feuille maîtresse s'appelle « ».
      const cycles = lireCycles(view).filter(c => c.id || c.label || c.prefixes.length);
      const boiteux = cycles.filter(c => !c.id || !c.label || !c.prefixes.length);
      if (boiteux.length) return toast('Chaque cycle a besoin d\'un identifiant, d\'un nom et d\'au moins un préfixe de compte.', 'error');
      try {
        S = await api.saveQuestionnaire({ cycles, modeles: lireQuestionnaire(view).filter(Boolean) });
        cyclesBrouillon = null; questBrouillon = null;
        dessinerCycles(view); dessinerQuestionnaire(view);
        flash($('#sr-quest-saved', view));
      } catch (e) { toast(plainError(e), 'error'); }
    };
    dessinerCycles(view); dessinerQuestionnaire(view);

    // 10.0.0 — le modèle de liasse, qui se modifie désormais dans sa fenêtre (U-19).
    const lo = $('#sr-liasse-ouvrir', view);
    if (lo) lo.onclick = () => modeleLiasseForm(() => { const r = $('#sr-liasse-resume', view); if (r) r.innerHTML = resumeLiasse(); });
  }

  // Le modèle en UNE phrase : ce qui sert (le proposé ou le tien) et combien de rubriques par état.
  const resumeLiasse = () => {
    const propre = (S.liasse || []).length > 0;
    const table = propre ? S.liasse : KC.MODELE_LIASSE;
    const par = KC.LIASSE_ETATS.map(e => `${e.label} : ${table.filter(r => r.etat === e.id).length}`).join(' · ');
    return `<p class="small"><b>${propre ? 'Ton modèle' : 'Le modèle proposé par SkanFact'}</b> — ${esc(pl(table.length, 'rubrique'))} (${esc(par)}).</p>`;
  };

  // U-19 — la fenêtre du modèle. Même mécanique qu'avant : vide = celui que le moteur PROPOSE, et
  // dès qu'on en écrit un, il le remplace entièrement — jamais un mélange des deux, qui donnerait
  // un rattachement de compte que personne n'a décidé. Elle s'ouvre des Réglages ET de la liasse
  // d'un dossier : on ajuste le modèle là où l'on voit ce qu'il produit.
  function modeleLiasseForm(apres) {
    liasseBrouillon = null;
    // Le garde-fou de saisie en ses trois morceaux (6.8.1) : déclaré AVANT la fenêtre — `modal()`
    // appelle son montage tout de suite, et une variable lue avant sa ligne est une zone morte —,
    // armé au montage, passé à `modal()`.
    let change = () => false;
    modal(`<h2>Le modèle de liasse ${info('li.modele')}</h2>
      <p class="small">Le compte va dans la rubrique dont le préfixe est le plus <strong>long</strong>, parmi celles du bon
      sens de solde — le 44 débiteur est une créance sur l'État, le même 44 créditeur est une dette envers lui.
      <em>À VÉRIFIER : la présentation exacte n'est validée par personne ici.</em></p>
      <div id="sr-liasse"></div>
      <div class="sous-table"><button class="btn btn-sm" id="sr-liasse-add">Ajouter une rubrique</button>
        <button class="btn btn-sm" id="sr-liasse-reset">Reprendre le modèle proposé</button></div>
      <div class="modal-actions"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="sr-liasse-save">Enregistrer le modèle</button></div>`,
    (layer, close) => {
      $('.modal', layer).classList.add('cab-large');
      dessinerLiasse(layer);
      change = suivreSaisie(layer);
      $('#sr-liasse-add', layer).onclick = () => { liasseBrouillon = lireLiasse(layer).concat([{ id: '', etat: 'bilan-actif', label: '', comptes: [], signe: 1, deduit: false, charge: false }]); dessinerLiasse(layer); };
      $('#sr-liasse-reset', layer).onclick = async () => {
        if (!await confirmDialog('Reprendre le modèle proposé ?',
          '<p>Tes rubriques à toi seront remplacées par celles que SkanFact propose. Tu pourras les remodifier ensuite.</p>', 'Reprendre', false)) return;
        liasseBrouillon = KC.MODELE_LIASSE.map(r => ({ ...r, comptes: (r.comptes || []).slice() }));
        dessinerLiasse(layer);
      };
      $('#sr-liasse-save', layer).onclick = async () => {
        const table = lireLiasse(layer).filter(r => r.id || r.label || r.comptes.length);
        const boiteux = table.filter(r => !r.id || !r.label);
        if (boiteux.length) return toast('Chaque rubrique a besoin d\'un code et d\'un libellé : sans eux, elle s\'imprimerait « ».', 'error');
        const doublons = table.map(r => r.id).filter((x, i, a) => a.indexOf(x) !== i);
        if (doublons.length) return toast(`Le code « ${doublons[0]} » est posé deux fois : deux rubriques ne peuvent pas porter le même.`, 'error');
        try {
          S = await api.saveLiasse({ modele: table });
          liasseBrouillon = null;
          close();
          toast('Modèle de liasse enregistré.');
          if (apres) apres();
        } catch (e) { toast(plainError(e), 'error'); }
      };
    }, () => { liasseBrouillon = null; }, { garde: () => change() || liasseBrouillon !== null });
  }

  let liasseBrouillon = null;
  const lireLiasse = view => $$('#sr-liasse tr[data-lr]', view).map(tr => ({
    id: ($('[data-k=id]', tr) || {}).value || '',
    etat: ($('[data-k=etat]', tr) || {}).value || 'bilan-actif',
    label: ($('[data-k=label]', tr) || {}).value || '',
    comptes: String((($('[data-k=comptes]', tr) || {}).value) || '').split(/[,\s]+/).map(x => x.trim()).filter(Boolean),
    // « d-1 » / « d1 » : les deux sens (10.10.0, C-08), le signe disant lequel s'imprime en plus.
    signe: /-1$/.test(($('[data-k=signe]', tr) || {}).value || '') ? -1 : 1,
    deuxSens: /^d/.test(($('[data-k=signe]', tr) || {}).value || ''),
    deduit: !!($('[data-k=deduit]', tr) || {}).checked,
    charge: !!($('[data-k=charge]', tr) || {}).checked,
    resultat: ($('[data-k=res]', tr) || {}).value === '1'
  }));

  function dessinerLiasse(view) {
    const box = $('#sr-liasse', view);
    if (!box) return;
    const table = liasseBrouillon || (S.liasse || []);
    const propose = !table.length;
    const rows = propose ? KC.MODELE_LIASSE : table;
    const d = propose ? 'disabled' : '';
    box.innerHTML = `${propose ? '<div class="sa-vide">Le modèle proposé sert tant que tu n\'en écris pas un autre.</div>' : ''}
      <div class="scroll-x"><table class="list compact sa-table sa-liasse"><thead><tr>
        <th class="nw">Code</th><th class="nw">État</th><th>Libellé</th><th>Comptes</th><th class="nw">Solde</th><th class="nw">En moins</th><th></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr data-lr="${i}">
        <td><input data-k="id" value="${esc(r.id)}" ${d} placeholder="AC1"></td>
        <td><select data-k="etat" ${d} aria-label="L'état où cette rubrique s'imprime">${KC.LIASSE_ETATS.map(e => `<option value="${esc(e.id)}" ${r.etat === e.id ? 'selected' : ''}>${esc(e.label)}</option>`).join('')}</select></td>
        <td><input data-k="label" value="${esc(r.label)}" ${d} placeholder="Clients et comptes rattachés"></td>
        <td><input data-k="comptes" value="${esc((r.comptes || []).join(' '))}" ${d} placeholder="41"></td>
        <td><select data-k="signe" ${d} aria-label="Le sens du solde que cette rubrique capte">${[
          ['1', 'débiteur', !r.deuxSens && r.signe === 1], ['-1', 'créditeur', !r.deuxSens && r.signe === -1],
          ['d1', 'les deux (débiteur en plus)', r.deuxSens && r.signe === 1], ['d-1', 'les deux (créditeur en plus)', r.deuxSens && r.signe === -1]
        ].map(([v, l, on]) => `<option value="${v}" ${on ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td><label class="check"><input type="checkbox" data-k="${r.charge ? 'charge' : 'deduit'}" ${(r.deduit || r.charge) ? 'checked' : ''} ${d}> ${r.charge ? 'charge' : 'déduit'}</label>
          <input type="hidden" data-k="res" value="${r.resultat ? '1' : '0'}"></td>
        <td class="sa-sup">${propose ? '' : `<button type="button" class="btn btn-sm" data-lrx="${i}" aria-label="Retirer cette rubrique">✕</button>`}</td>
      </tr>`).join('')}</tbody></table></div>`;
    $$('[data-lrx]', box).forEach(b => { b.onclick = () => {
      const t = lireLiasse(view); t.splice(Number(b.dataset.lrx), 1); liasseBrouillon = t; dessinerLiasse(view);
    }; });
  }

  let cyclesBrouillon = null, questBrouillon = null;
  const lireCycles = view => $$('#sr-cycles tr[data-cy]', view).map(tr => ({
    id: ($('[data-k=id]', tr) || {}).value || '', label: ($('[data-k=label]', tr) || {}).value || '',
    prefixes: String((($('[data-k=prefixes]', tr) || {}).value) || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
  }));
  const lireQuestionnaire = view => $$('#sr-quest input[data-q]', view).map(i => i.value.trim());

  function dessinerCycles(view) {
    const box = $('#sr-cycles', view);
    if (!box) return;
    const table = cyclesBrouillon || (S.cycles || []);
    const propose = !table.length;
    const rows = propose ? KC.CYCLES_REVISION : table;
    box.innerHTML = `${propose ? '<div class="sa-vide">Les sept cycles proposés servent tant que tu n\'en écris pas d\'autres.</div>' : ''}
      <div class="scroll-x"><table class="list compact sa-table"><thead><tr>
        <th class="nw">Identifiant</th><th class="nw">Nom du cycle</th><th>Préfixes de comptes</th><th></th></tr></thead>
      <tbody>${rows.map((c, i) => `<tr data-cy="${i}">
        <td><input data-k="id" value="${esc(c.id)}" ${propose ? 'disabled' : ''} placeholder="tresorerie"></td>
        <td><input data-k="label" value="${esc(c.label)}" ${propose ? 'disabled' : ''} placeholder="Trésorerie"></td>
        <td><input data-k="prefixes" value="${esc((c.prefixes || []).join(' '))}" ${propose ? 'disabled' : ''} placeholder="5 53 54"></td>
        <td class="sa-sup">${propose ? '' : `<button type="button" class="btn btn-sm" data-cyx="${i}" aria-label="Retirer ce cycle">✕</button>`}</td>
      </tr>`).join('')}</tbody></table></div>`;
    $$('[data-cyx]', box).forEach(b => { b.onclick = () => {
      const t = lireCycles(view); t.splice(Number(b.dataset.cyx), 1); cyclesBrouillon = t; dessinerCycles(view);
    }; });
    if (cyclesBrouillon !== null) sale(box);
  }

  function dessinerQuestionnaire(view) {
    const box = $('#sr-quest', view);
    if (!box) return;
    const table = questBrouillon || (S.questionnaire || []).map(q => q.question);
    box.innerHTML = !table.length
      ? '<div class="sa-vide">Aucune question. Elles s\'ajoutent une à une, et se posent ensuite sur chaque exercice d\'un clic.</div>'
      : `<div class="scroll-x"><table class="list compact sa-table"><tbody>${table.map((q, i) => `<tr data-qr="${i}">
          <td><input data-q="${i}" value="${esc(q)}" placeholder="Tous les contrats de leasing ont-ils été communiqués ?"></td>
          <td class="sa-sup"><button type="button" class="btn btn-sm" data-qx="${i}" aria-label="Retirer cette question">✕</button></td>
        </tr>`).join('')}</tbody></table></div>`;
    $$('[data-qx]', box).forEach(b => { b.onclick = () => {
      const t = lireQuestionnaire(view); t.splice(Number(b.dataset.qx), 1); questBrouillon = t; dessinerQuestionnaire(view);
    }; });
    if (questBrouillon !== null) sale(box);
  }

  let regBrouillon = null;
  const lireRegimes = view => $$('#sr-regimes tr[data-rg]', view).map(tr => ({
    id: ($('[data-k=id]', tr) || {}).value || '', label: ($('[data-k=label]', tr) || {}).value || '',
    tva: ($('[data-k=tva]', tr) || {}).value || '',
    cnss: !!($('[data-k=cnss]', tr) || {}).checked,
    annuelles: (() => {
      // Une échéance annuelle par régime, saisie en « nom / JJ-MM » : trois champs par ligne
      // auraient fait une grille de douze colonnes, illisible. Ce qui est tapé reste relu par le
      // moteur, qui borne le mois et le jour — un « 31-02 » ne peut désigner aucune date réelle.
      const t = String((($('[data-k=annuelles]', tr) || {}).value) || '').trim();
      return t ? t.split(';').map((x, i) => {
        const [nom, quand] = x.split('@').map(y => String(y || '').trim());
        const [j, m] = String(quand || '').split(/[-/]/).map(Number);
        return { id: 'a' + (i + 1), label: nom, jour: j || 0, mois: m || 0 };
      }).filter(a => a.label && a.jour && a.mois) : [];
    })()
  }));

  function dessinerRegimes(view) {
    const box = $('#sr-regimes', view);
    if (!box) return;
    const table = regBrouillon || ((S.settings || {}).regimes || []);
    box.innerHTML = !table.length
      ? `<div class="sa-vide">Aucun régime déclaré : le calendrier réclame la TVA mensuelle et la CNSS à tous tes
         clients, comme avant. Déclare-les pour qu'un forfaitaire cesse de se voir réclamer une TVA qu'il ne dépose pas.</div>`
      : `<div class="scroll-x"><table class="list compact sa-table"><thead><tr>
          <th class="nw">Identifiant</th><th class="nw">Nom du régime</th><th class="nw">TVA</th><th class="nw">CNSS</th>
          <th>Échéances annuelles</th><th></th></tr></thead>
        <tbody>${table.map((r, i) => `<tr data-rg="${i}">
          <td><input data-k="id" value="${esc(r.id)}" placeholder="forfaitaire"></td>
          <td><input data-k="label" value="${esc(r.label)}" placeholder="Régime forfaitaire"></td>
          <td><select data-k="tva" aria-label="La périodicité de TVA de ce régime">${K.TVA_PERIODES.map(p => `<option value="${esc(p.id)}" ${(r.tva || '') === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></td>
          <td><label class="check"><input type="checkbox" data-k="cnss" ${r.cnss !== false ? 'checked' : ''}> dépose</label></td>
          <td><input data-k="annuelles" value="${esc((r.annuelles || []).map(a => `${a.label}@${String(a.jour).padStart(2, '0')}-${String(a.mois).padStart(2, '0')}`).join(' ; '))}"
            placeholder="Déclaration annuelle@25-04 ; Acompte@25-06"></td>
          <td class="sa-sup"><button type="button" class="btn btn-sm" data-rgx="${i}" aria-label="Retirer ce régime">✕</button></td>
        </tr>`).join('')}</tbody></table></div>
        <p class="small muted">Une échéance annuelle s'écrit <code>nom@JJ-MM</code>, séparée par un point-virgule.
        Elle porte sur l'exercice écoulé.</p>`;
    $$('[data-rgx]', box).forEach(b => { b.onclick = () => {
      const t = lireRegimes(view); t.splice(Number(b.dataset.rgx), 1); regBrouillon = t; dessinerRegimes(view);
    }; });
    if (regBrouillon !== null) sale(box);
  }

  function dessinerGuides(view) {
    const box = $('#sr-guides', view);
    if (!box) return;
    const gs = (S.guides || []).slice().sort((a, b) => K.parNom(a.nom, b.nom));
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
  // 10.14.1 — Le montant fixe et le taux d'une ligne de guide se rangent en NOMBRE quand ils se
  // lisent, et restent tels quels sinon (le moteur les refuse alors en nommant la ligne). Rangés en
  // texte français (« 1 250,000 »), ils se relisaient par `Number()` — c'est-à-dire en rien : le
  // guide rouvert montrait une case VIDE, et l'enregistrer à nouveau effaçait le loyer fixe.
  const nombreOuTexte = v => { const t = String(v == null ? '' : v).trim(); if (!t) return ''; return montantIllisible(t) ? t : lireMontant(t); };
  const montantDuGuide = v => { const n = nombreOuTexte(v); return typeof n === 'number' ? montantSaisi(n) : n; };
  const tauxDuGuide = v => { const n = nombreOuTexte(v); return typeof n === 'number' ? String(n).replace('.', ',') : n; };
  function guideForm(guide) {
    const g = guide
      ? { ...guide, lignes: (guide.lignes || []).map(l => ({ ...l })) }
      : { id: '', nom: '', journal: '', lignes: [{ compte: '', libelle: '', sens: 'debit', base: true }, { compte: '', libelle: '', sens: 'credit', solde: true }] };
    const existe = !!(guide && guide.id && (S.guides || []).some(x => x.id === guide.id));

    const lignesHtml = () => g.lignes.map((l, i) => `<tr data-i="${i}">
      <td><input data-k="compte" value="${esc(l.compte || '')}" placeholder="607"></td>
      <td><input data-k="libelle" value="${esc(l.libelle || '')}" placeholder="Achat"></td>
      <td><select data-k="sens">${SENS.map(([v, t]) => `<option value="${v}" ${l.sens === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><input data-k="montant" class="num montant" inputmode="decimal" value="${esc(montantDuGuide(l.montant))}" placeholder="fixe"></td>
      <td><input data-k="taux" class="r" inputmode="decimal" value="${esc(tauxDuGuide(l.taux))}" placeholder="%"></td>
      <td class="nw"><label class="check"><input type="checkbox" data-k="base" ${l.base ? 'checked' : ''}> base</label></td>
      <td class="nw"><label class="check"><input type="checkbox" data-k="solde" ${l.solde ? 'checked' : ''}> solde</label></td>
      <td class="sa-sup"><button type="button" class="btn btn-sm" data-sup="${i}" aria-label="Retirer cette ligne">✕</button></td>
    </tr>`).join('');

    modal(
      `<h2>${existe ? 'Modifier le guide' : 'Nouveau guide'}</h2>
       <div class="grid-2">
         <label class="field obligatoire"><span>Nom</span><input type="text" id="g-nom" value="${esc(g.nom || '')}" placeholder="Achat avec TVA 19 %"></label>
         <label class="field narrow obligatoire"><span>Journal</span><input type="text" id="g-journal" maxlength="5" value="${esc(g.journal || '')}" placeholder="AC"></label>
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
              const k = f.dataset.k;
              g.lignes[i][k] = f.type === 'checkbox' ? f.checked : (k === 'montant' || k === 'taux') ? nombreOuTexte(f.value) : f.value;
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
    if (corrBrouillon !== null) sale(box);
  }

  const REG_TABS = [['cabinet', 'Mon cabinet'], ['compta', 'Comptabilité'], ['donnees', 'Données et sécurité'], ['app', 'L\'application']];

  // Une seule table pour TROIS choses qui, écrites à trois endroits, divergent toujours : le titre du
  // panneau, les mots que sa recherche connaît sans qu'ils soient à l'écran, et son entrée de palette
  // Cmd+K. Même mécanique que SETTINGS_PANNEAUX côté entreprise, et pour la même raison : là-bas, six
  // alias écrits à la main ont nommé des onglets disparus et la palette n'a plus rien rendu.
  const REG_PANNEAUX = {
    'pan-cabinet': { onglet: 'cabinet', titre: 'Ton cabinet', mots: 'cabinet nom email telephone jour relance tva cnss depot echeance' },
    'pan-appairage': { onglet: 'cabinet', titre: 'Le fichier à remettre à tes clients', mots: 'appairage fichier client empreinte cle publique chiffrer skanpair' },
    'pan-equipe': { onglet: 'cabinet', titre: 'L\'équipe', mots: 'equipe collaborateur collaborateurs qui saisit valide supervision role droits personne poste partage plusieurs assistant stagiaire chef mission' },
    'pan-licence': { onglet: 'cabinet', titre: 'Licence', mots: 'licence cle payer prix dossiers hors skanfact quota gratuit acheter abonnement facture' },
    'pan-saisie': { onglet: 'compta', titre: 'La grille de saisie', mots: 'saisie clavier touches raccourci solder recopier dupliquer journal date kilometre grille brouillard validation' },
    'pan-guides': { onglet: 'compta', titre: 'Guides d\'écritures', mots: 'guide modele ecriture type loyer salaire achat tva honoraires steg prerempli abonnement recurrent' },
    'pan-comptes': { onglet: 'compta', titre: 'Correspondance des comptes', mots: 'correspondance compte plan client cabinet traduire import export numero prefixe' },
    'pan-regimes': { onglet: 'cabinet', titre: 'Les régimes et leurs échéances', mots: 'regime regimes forfaitaire reel tva mensuelle trimestrielle cnss echeance annuelle calendrier fiscal depot' },
    'pan-liasse': { onglet: 'compta', titre: 'Le modèle de liasse', mots: 'liasse nct fiscale bilan actif passif resultat rubrique rubriques etats financiers annuel depot modele' },
    'pan-questionnaire': { onglet: 'compta', titre: 'Révision : cycles et questionnaire', mots: 'revision cycle cycles feuille maitresse lead schedule questionnaire fin exercice question client trésorerie ventes achats immobilisations personnel fiscal capitaux' },
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
  let reglagesRefus = null;

  function drawReglages(view) {
    const c = S.cabinet || {};
    if (!REG_TABS.some(t => t[0] === reglagesTab)) reglagesTab = 'cabinet';
    view.innerHTML = `
      <div class="page-head"><h1>Réglages</h1>
        <div class="actions set-search">
          <input type="search" id="set-q" placeholder="Chercher un réglage…" autocomplete="off" spellcheck="false">
        </div></div>
      <div id="set-res" class="set-res" hidden></div>
      ${/* U-13 — le bandeau existe pour que l'alerte ne se cache pas derrière un onglet (7.32.0).
            Sur l'onglet qui porte le panneau Sécurité, elle y est dite en entier : le bandeau se tait,
            sinon la clé de secours se lisait trois fois sur le même écran. */''}
      <div id="rec-banniere">${recoveryBanner()}</div>
      <div id="set-corps">
      <div class="tabs" id="set-tabs" role="tablist" aria-label="Les réglages du cabinet">${REG_TABS.map(([id, label]) =>
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
        <div class="modal-actions"><span class="saved" id="c-saved" hidden></span><button class="btn" id="c-save" data-enreg>Enregistrer mon cabinet</button></div>
      </div>

      ${panneauReg('pan-appairage', info('cab.pairing'))}
        <p class="small">Chaque client doit importer ce fichier une fois, dans <strong>Paramètres → Envois → Ton cabinet comptable</strong> de son SkanFact.
        À partir de là, les paquets qu'il fabrique sont chiffrés <strong>pour toi seul</strong> : personne d'autre ne peut les ouvrir,
        même en interceptant le mail, et il n'a plus aucun mot de passe à te communiquer.</p>
        <div class="mt"><div class="muted small">${lbl('Empreinte de ton cabinet', 'cab.fingerprint')}</div>
          <div class="empreinte-ligne"><span class="fingerprint">${esc(c.fingerprint || '—')}</span>${c.fingerprint
            ? '<button type="button" class="btn btn-sm" id="c-copier-emp">Copier</button>' : ''}</div></div>
        <p class="muted small mt">Cette empreinte identifie ton cabinet. Ton client la voit après l'import : s'il te la lit au téléphone
        et qu'elle correspond, c'est bien à toi qu'il envoie.</p>
        ${c.signatureFingerprint ? `<div class="mt"><div class="muted small">${lbl('Empreinte de ta signature', 'cab.signature')}</div>
          <div class="empreinte-ligne"><span class="fingerprint">${esc(c.signatureFingerprint)}</span></div></div>
        <p class="muted small mt">Tes clôtures et tes questions partent signées. Ton client retient cette signature la première fois,
        puis refuse un envoi qui en porterait une autre : si l'un d'eux te la lit au téléphone, c'est celle-ci.</p>` : ''}
        <div class="modal-actions"><button class="btn" id="c-pair">Remettre le fichier à mes clients…</button></div>
      </div>

      ${panneauReg('pan-regimes', info('rg.regimes'))}
        <p class="small">Ce que chaque <strong>régime</strong> dépose, et quand. Tant que tu n'en déclares aucun, le
        calendrier traite tous tes clients pareil — c'est le comportement d'avant, et il ne change pas tout seul.
        Dès que tu déclares un régime, les dossiers qui le portent suivent ses règles. <em>À VÉRIFIER : les
        périodicités et les dates sont les TIENNES. SkanFact n'écrit aucune règle de droit.</em></p>
        <div id="sr-regimes"></div>
        <div class="sous-table"><button class="btn btn-sm" id="sr-reg-add">Ajouter un régime</button>
          <button class="btn btn-sm" id="sr-reg-base">Partir des trois régimes proposés</button></div>
        <div class="modal-actions"><span class="saved" id="sr-reg-saved" hidden></span><button class="btn" id="sr-reg-save" data-enreg>Enregistrer les régimes</button></div>
      </div>

      ${panneauReg('pan-equipe', info('eq.equipe'))}
        <div id="eq-panel"><p class="muted small">Chargement…</p></div>
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
        <p class="muted small">Clique sur « Changer… » et <strong>appuie sur la touche</strong> que tu veux utiliser : elle se dessine à gauche. Échap pour ressortir sans rien changer.</p>
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
        <div class="modal-actions"><span class="saved" id="sr-saved" hidden></span><button class="btn" id="sr-save" data-enreg>Enregistrer la grille de saisie</button></div>
      </div>

      ${panneauReg('pan-guides', info('sa.guides'))}
        <p class="small">Un guide préremplit une pièce : un journal, des comptes, et d'où vient chaque montant.
        Il n'écrit rien tout seul — après le clic, tout reste modifiable.</p>
        <div id="sr-guides"></div>
        <div class="modal-actions"><button class="btn" id="sr-guide-new">Nouveau guide…</button></div>
      </div>

      ${panneauReg('pan-comptes', info('sa.correspondance'))}
        <p class="small">Traduire les comptes de tes clients vers les tiens, <strong>à l'import et à l'export</strong>.
        Une écriture déjà validée n'est jamais réécrite : elle porte le compte sous lequel tu l'as validée.</p>
        <div id="sr-corr"></div>
        <div class="sous-table"><button class="btn btn-sm" id="sr-corr-add">Ajouter une ligne</button></div>
        <div class="modal-actions"><span class="saved" id="sr-corr-saved" hidden></span><button class="btn" id="sr-corr-save" data-enreg>Enregistrer la correspondance</button></div>
      </div>

      ${panneauReg('pan-questionnaire', info('rv.reglages'))}
        <p class="small">Ta méthode de révision, écrite <strong>une fois pour tous tes dossiers</strong>. Les sept cycles
        proposés rattachent un compte à sa feuille maîtresse par son préfixe — le plus long gagne. Si ton cabinet range
        autrement, écris tes cycles ici : ils remplacent alors ceux que SkanFact propose. <em>À VÉRIFIER : aucun rattachement
        n'est une vérité comptable.</em></p>
        <div id="sr-cycles"></div>
        <div class="sous-table"><button class="btn btn-sm" id="sr-cycles-add">Ajouter un cycle</button>
          <button class="btn btn-sm" id="sr-cycles-reset">Reprendre les sept cycles proposés</button></div>
        <p class="small mt">Le <strong>questionnaire de fin d'exercice</strong> : les questions que tu poses sur chaque
        dossier avant de clôturer. Il part vide — ce sont les tiennes, pas les nôtres.</p>
        <div id="sr-quest"></div>
        <div class="sous-table"><button class="btn btn-sm" id="sr-quest-add">Ajouter une question</button></div>
        <div class="modal-actions"><span class="saved" id="sr-quest-saved" hidden></span><button class="btn" id="sr-quest-save" data-enreg>Enregistrer ma méthode</button></div>
      </div>

      ${panneauReg('pan-liasse', info('li.modele'))}
        <p class="small">Les rubriques de la <strong>liasse</strong>, et les comptes que chacune capte. Le compte va
        dans la rubrique dont le préfixe est le plus <strong>long</strong>, parmi celles du bon sens de solde — le 44
        débiteur est une créance sur l'État, le même 44 créditeur est une dette envers lui.
        <em>À VÉRIFIER : la présentation exacte du système comptable des entreprises n'est validée par personne ici.
        Confronte-la à ce que le portail attend avant de déposer.</em></p>
        ${/* U-19 — la grille de vingt-six rubriques faisait la MOITIÉ de l'onglet (1 998 px sur 4 193)
              pour un réglage qu'on touche une fois par an. Le panneau le résume ; il se modifie dans
              une fenêtre, la même que celle qu'ouvre la liasse d'un dossier. */''}
        <div id="sr-liasse-resume">${resumeLiasse()}</div>
        <div class="modal-actions"><button class="btn" id="sr-liasse-ouvrir">Voir et modifier le modèle…</button></div>
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
          ? `<p>${nbExemple()} dossiers <strong>fictifs</strong> sont chargés : ils montrent les situations que tu rencontreras, dont un client hors SkanFact.
             Ils disparaîtront d'eux-mêmes au premier vrai paquet importé.</p>
             <div class="modal-actions"><button class="btn btn-danger" id="r-demo-off">Effacer l'exemple</button></div>`
          : `<p>Tu peux charger ${nbExemple()} clients fictifs pour voir à quoi ressemble l'application pleine : un client à jour,
             un en retard, un qui n'a envoyé que du provisoire, un dont les pièces sont incomplètes, et un client hors SkanFact.</p>
             <p class="small muted">C'est aussi ce qu'il faut montrer à un confrère à qui tu parles de SkanFact.
             L'exemple s'efface tout seul dès qu'un vrai paquet arrive : aucun risque de mélange.</p>
             <div class="modal-actions"><button class="btn" id="r-demo-on">Charger l'exemple</button></div>`}
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
      const rb = $('#rec-banniere'); if (rb) rb.hidden = id === REG_PANNEAUX['pan-secu'].onglet;
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
      rienTrouve: (mots, phrase) => `<div class="empty"><p>${phrase} Ou regarde dans l'<a href="#/aide">aide</a>.</p></div>`
    });
    $$('#set-tabs button').forEach(b => b.onclick = () => { reglagesFocus = ''; showTab(b.dataset.tab); });
    showTab(reglagesTab);
    // Un lien qui promet « la clé de secours » ou « les sauvegardes » doit amener LE PANNEAU, pas le
    // haut d'un onglet. Même porte que le sommaire et que la recherche : l'onglet suit tout seul.
    // 10.14.0 — et on l'amène APRÈS le chargement de l'onglet (règle 10.13.0 : une cible
    // asynchrone se pose après le chargement). « L'équipe » et « Licence » s'affichent
    // « Chargement… » au premier dessin et grandissent ensuite : le défilement posé tout de suite
    // visait une page plus courte, et la pastille de licence ouvrait « Le fichier à remettre »,
    // le panneau Licence 50 px sous le bas de l'écran. Trouvé à la souris.
    const vise = reglagesFocus;
    reglagesFocus = '';
    const aRefuser = reglagesRefus;
    reglagesRefus = null;
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
    // U-11 — une frappe ou un choix dans un panneau rend son « Enregistrer » principal (`sale`).
    // La délégation vit sur le CORPS, redessiné à chaque passage : aucun écouteur ne s'empile d'un
    // dessin à l'autre, et la recherche des réglages, posée hors du corps, ne salit rien.
    const corps = $('#set-corps', view);
    if (corps) { corps.addEventListener('input', e => sale(e.target)); corps.addEventListener('change', e => sale(e.target)); }
    Promise.allSettled([dessinerEquipe(view), dessinerLicence(view)]).then(() => {
      if (vise && location.hash.startsWith('#/reglages')) reg.montrer(vise);
      if (aRefuser && location.hash.startsWith('#/reglages')) refus(aRefuser.sel, aRefuser.message);
    });
    bindRecoveryBanner(view);
    if ($('#r-demo-on')) $('#r-demo-on').onclick = async () => {
      S = await chargerOuRetirerExemple(true); toast(phraseExemple()); location.hash = '#/dossiers';
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
    if ($('#c-copier-emp')) $('#c-copier-emp').onclick = () => copierEmpreinte(S.cabinet.fingerprint);
    $('#c-pair').onclick = () => remettreAppairage();
  }

  // 10.14.0 (l'assistant, jusqu'au bout) — le fichier d'appairage PART. Enregistré, il ne servait à
  // rien tant que le comptable n'avait pas écrit lui-même le mail, retrouvé soixante adresses et
  // expliqué où cliquer dans une application qu'il n'utilise pas. UNE porte pour les deux boutons (le
  // panneau des Réglages et « Tes premiers pas ») : l'enregistrement, puis le message tout prêt
  // (`K.mailAppairage`), adressé en copie cachée à chaque client qui a une adresse. Et l'écran dit ce
  // qui est VRAIMENT parti (E-14) : un lien `mailto:` ne joint pas de fichier, et trop d'adresses le
  // feraient couper par Windows — elles vont alors dans le presse-papiers, en le disant.
  async function remettreAppairage() {
    if (!(S.cabinet.name || '').trim()) {
      versReglages('pan-cabinet', { sel: '#c-name', message: 'Nomme d\'abord ton cabinet : son nom entre dans le fichier que tes clients importent.' });
      return;
    }
    let r;
    try { r = await api.exportPairing(); } catch (e) { toast(plainError(e), 'error'); return; }
    if (!r) return;
    // L'état porte la date de la remise (10.14.0) : « Tes premiers pas » la lisent.
    if (r.state) S = r.state;
    const nomFichier = String(r.path || '').split(/[\\/]/).pop();
    const m = K.mailAppairage(S.cabinet, S.dossiers, r.fingerprint, nomFichier);
    const qui = m.avecAdresse
      ? `<b>${pl(m.avecAdresse, 'client')}</b> ${m.avecAdresse > 1 ? 'ont' : 'a'} une adresse : le message ${m.avecAdresse > 1 ? 'leur' : 'lui'} sera adressé en copie cachée.`
        + (m.sansAdresse ? ` ${pl(m.sansAdresse, 'autre client', 'autres clients')} n'en ${m.sansAdresse > 1 ? 'ont' : 'a'} pas : ajoute-la sur sa fiche, ou écris-lui à part.` : '')
      : 'Aucun de tes clients n\'a encore d\'adresse : le message s\'ouvrira sans destinataire, et tu choisiras à qui l\'envoyer.';
    modal(`<h2>Le fichier est prêt ${info('cab.pairing')}</h2>
      <p class="small">Il ne contient rien de secret : il s'envoie par mail. Chacun de tes clients qui utilise SkanFact l'importe une fois,
      puis te lit au téléphone l'empreinte qu'il voit — si c'est la tienne, c'est bien à toi qu'il envoie.</p>
      <div class="kv mt"><div><span>Fichier</span><span class="small">${esc(r.path)}</span></div>
        <div><span>Empreinte</span><span class="fingerprint">${esc(r.fingerprint || '')}</span></div></div>
      <div class="ap-etat mt" id="ap-etat" aria-live="polite"><div class="info-box">${qui}</div></div>
      <div class="modal-actions"><button class="btn" data-close>Fermer</button><button class="btn" id="ap-montrer">Le montrer dans le dossier</button><button class="btn btn-primary" id="ap-ecrire">Écrire à mes clients…</button></div>`,
      layer => {
        $('#ap-montrer', layer).onclick = () => api.reveal(r.path);
        $('#ap-ecrire', layer).onclick = async () => {
          let res;
          try { res = await api.mail({ bcc: m.bcc, subject: m.subject, body: m.body, attachment: r.path }); }
          catch (e) { toast(plainError(e), 'error'); return; }
          let copiees = false;
          if (m.bcc.length && !(res && res.bccInclus)) {
            try { await navigator.clipboard.writeText(m.bcc.join(', ')); copiees = true; } catch (_) { copiees = false; }
          }
          const dest = !m.bcc.length ? 'Choisis tes destinataires : aucun client n\'a d\'adresse.'
            : res && res.bccInclus ? `${m.bcc.length > 1 ? `Les ${m.bcc.length} adresses sont` : 'L\'adresse est'} en copie cachée.`
              : copiees ? `${m.bcc.length > 1 ? `Les ${m.bcc.length} adresses sont copiées` : 'L\'adresse est copiée'} : colle-${m.bcc.length > 1 ? 'les' : 'la'} dans le champ « Cci ».`
                : `Ajoute ${m.bcc.length > 1 ? 'ces adresses' : 'cette adresse'} dans le champ « Cci » : ${esc(m.bcc.join(', '))}.`;
          const piece = res && res.montre ? 'Le fichier est montré dans son dossier : glisse-le dans le message pour le joindre.'
            : `Joins le fichier au message : ${esc(r.path)}.`;
          $('#ap-etat', layer).innerHTML = `<div class="ok-box"><b>Ta messagerie s'ouvre avec le message tout prêt.</b> ${dest} ${piece}</div>`;
          // L'étape suivante n'est plus d'écrire : c'est de fermer (U-11). Le message se rouvre au besoin.
          const b = $('#ap-ecrire', layer); b.classList.remove('btn-primary'); b.textContent = 'Rouvrir le message…';
          $('[data-close]', layer).classList.add('btn-primary');
        };
      });
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
        Choisis une clé USB, un disque externe ou un dossier synchronisé (iCloud Drive, OneDrive).</div>` : ''}

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

      ${/* U-13 — UNE phrase, et l'orange seulement quand il y a un geste à faire. Le panneau disait
            « Ta clé n'existe qu'ici » dans un encadré orange MÊME une fois la clé enregistrée, puis
            la même chose une seconde fois dans sa ligne d'état. `undefined` = on ne sait pas encore
            (la date arrive par une promesse) : on ne crie pas. */''}
      ${recoveryAt === null ? `<div class="warn-box mt"><strong>${lbl('Tu n\'as jamais enregistré de clé de secours.', 'b.recovery')}</strong>
      Elle n'existe qu'ici : ni nous, ni personne d'autre ne peut la reconstituer. Sans elle et sans cet ordinateur,
      <strong>aucun paquet déjà reçu ne pourra plus être ouvert</strong>, et tes clients devront tous réimporter un nouveau
      fichier d'appairage. Trois minutes maintenant, une fois pour toutes.</div>`
    : recoveryAt ? `<p class="small ligne-ok mt" id="s-rec-ok"><span aria-hidden="true">✓</span> Clé de secours enregistrée le ${esc(fmtDay(recoveryAt))}
      ${info('b.recovery')} — vérifie qu'elle n'est pas sur ${CE_POSTE()}.</p>` : ''}

      <div class="modal-actions wrap">
        <button class="btn${recoveryAt === null ? ' btn-primary' : ''}" id="s-rec">Enregistrer ma clé de secours…</button>
        <button class="btn" id="s-rec-in">Restaurer une clé de secours…</button>
        <span class="grow"></span>
        <button class="btn" id="s-pw">Changer le mot de passe…</button>${info('b.password')}
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

  // Le bandeau qui ne peut pas se cacher derrière un onglet. Les onglets rangent — mais ils rangent
  // AUSSI ce qu'il ne faut jamais ranger : cet avertissement-ci ne vivait que dans le panneau
  // Sécurité, à un écran et demi de défilement. Il est maintenant au-dessus de la barre d'onglets,
  // et dans « À faire » sur la page d'accueil. Il disparaît le jour où la clé est enregistrée.
  // Un paquet VRAI, c'est-à-dire reçu d'un client : ceux du jeu d'exemple sont fictifs, et leur perte ne
  // coûterait rien (10.14.0 — la découverte criait la clé de secours en rouge dès son premier écran).
  function paquetsReelsRecus() {
    return (S.dossiers || []).some(d => !d.demo && (d.packs || []).length);
  }
  // Un exercice est TERMINÉ le lendemain de son 31 décembre (jour local, 5.2.3). Avant, clôturer
  // reste possible mais n'est jamais l'étape suivante : le bouton ne se colore pas (U-11).
  function exerciceTermine(annee) {
    return K.today() > `${annee}-12-31`;
  }
  function recoveryBanner() {
    if (recoveryAt !== null) return '';
    // 9.4.4 — l'avertissement est juste, le MOMENT ne l'était pas. Le tout premier écran d'un
    // comptable, avant qu'il ait un seul client, était un bandeau rouge : un premier contact qui
    // menace, et un rouge permanent dès le jour 0 apprend à ignorer le rouge. Tant qu'aucun paquet
    // n'est arrivé, il n'y a rien à perdre — c'est la règle « un filet se réclame au moment où il
    // protège encore » (QUESTIONS.md), prise par l'autre bout. Le rouge apparaît au premier paquet,
    // c'est-à-dire le jour où quelque chose d'irremplaçable est sur ce disque.
    if (!paquetsReelsRecus()) {
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

  // Les questions sans réponse, résumées dossier par dossier (9.10.0). Lues dans les INDEX, jamais
  // en déchiffrant soixante livres (mesure de la 9.1.0), et comme `recoveryAt` : on ne redessine
  // que si le chiffre a vraiment changé, pour ne pas effacer une saisie en cours.
  let questionsAttente = [];
  // Ce que les livres savent des employeurs, mois par mois, lu dans le même résumé des index
  // (10.12.0, U-21). La page Échéances et « À faire » le reçoivent tous les deux : deux écrans qui
  // comptent la même CNSS avec deux connaissances différentes finiraient par se contredire.
  const employeursConnus = () => Object.fromEntries(questionsAttente.map(q => [q.dossierId, q.employeur || {}]));
  // Les livres des dossiers TENUS AU CABINET (10.12.0), du même résumé : ils entrent dans le
  // calendrier et dans « À faire » avec leurs mois à saisir, jamais comme des retardataires.
  const tenusConnus = () => Object.fromEntries(questionsAttente.filter(q => q.tenu).map(q => [q.dossierId, q.tenu]));
  function chargerQuestionsAttente(redessiner) {
    if (!api.questionsEnAttente) return Promise.resolve();
    const avant = JSON.stringify(questionsAttente);
    return api.questionsEnAttente().then(r => {
      questionsAttente = Array.isArray(r) ? r : [];
      if (redessiner && JSON.stringify(questionsAttente) !== avant && !$('#modal-root').children.length && !$('#palette-root')) render();
    }).catch(() => { questionsAttente = []; });
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
         ? `<p class="warn-box mt">Cette sauvegarde <strong>ne porte pas les livres</strong> (${pl(peek.actuels.livres, 'livre')} aujourd'hui) : ils resteront tels qu'ils sont. Seules les sauvegardes prises à la main (« Sauvegarder maintenant ») et celles d'avant un geste important les emportent — pas la sauvegarde quotidienne.</p>`
         : peek.livres > 1 ? `<p class="small">Les ${pl(peek.livres, 'livre')} de la sauvegarde remplaceront ceux d'aujourd'hui qui portent le même nom.</p>`
         : peek.livres === 1 ? '<p class="small">Le livre de la sauvegarde remplacera celui d\'aujourd\'hui qui porte le même nom.</p>'
         : peek.livres === 0 ? '<p class="small">La sauvegarde ne porte aucun livre : ceux d\'aujourd\'hui resteront tels qu\'ils sont.</p>' : ''}
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
       <label class="field mt"><span>Mot de passe <strong>du cabinet</strong></span><input type="password" id="p0" autocomplete="current-password"></label>
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
        enchainerConfirmation(p1, p2);
        $('#no', layer).onclick = close;
        $('#ok', layer).onclick = async () => {
          // Le refus MONTRE la case (règle 7.20.0) ; un toast seul laissait chercher laquelle.
          const vm = K.verdictMotDePasse(p1.value, p2.value, 8);
          if (!vm.ok) return refus(vm.champ === 'confirmation' ? p2 : p1, vm.message);
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
              'La montrer dans le dossier', false, 'Fermer');
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
       <label class="field mt">Nouveau mot de passe<span class="pw-wrap"><input type="password" id="p1" autocomplete="new-password"><button type="button" class="pw-eye" id="eye">Afficher</button></span><span class="muted small ligne-reservee" id="str"></span></label>
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
        enchainerConfirmation(p1, p2);
        $('#no', layer).onclick = close;
        $('#ok', layer).onclick = async () => {
          const vm = K.verdictMotDePasse(p1.value, p2.value, 8);
          if (!vm.ok) return refus(vm.champ === 'confirmation' ? p2 : p1, vm.message);
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

  // ---------- La visite guidée (10.14.0) ----------
  //
  // Skander, après la visite guidée de l'application entreprise : « commence par faire ce qu'on vient
  // de faire dans le dernier lot sur l'app cabinet ». Le MOTEUR est le même (`src/renderer/visite.js`,
  // chargé tel quel) ; le contenu vit dans `cabvisites.js` ; ici, ce qui les relie au Cabinet : la
  // navigation, la progression, « Tes premiers pas » et la page « Me guider ».
  //
  // La progression décrit la PERSONNE, pas le cabinet : elle vit sur ce poste (`prefs`), jamais dans la
  // base chiffrée ni dans les sauvegardes.
  const VISITES_PREF = 'visites';
  const visitesEtat = () => Object.assign({ faites: {}, reprise: null, vues: {}, proposer: true, porteVue: false }, prefs.get(VISITES_PREF, {}) || {});
  const visitesPoser = modif => { const e = visitesEtat(); modif(e); prefs.set(VISITES_PREF, e); };
  // Les dossiers qui ont leur livre : ceux que l'index connaît, et celui qu'on regarde s'il est ouvert.
  const avecLivre = () => {
    const ids = new Set((questionsAttente || []).map(q => q.dossierId));
    if (livresState.dossierId && livresState.livre) ids.add(livresState.dossierId);
    return ids;
  };
  // Le dossier qu'une visite montre : celui qu'on regarde s'il convient, sinon la vitrine de l'exemple
  // qui le montre rempli, sinon le premier qui convient. `sorte` : 'skanfact' (il envoie ses paquets),
  // 'hors' (tenu au cabinet), 'livre' (il a son livre), 'client' (n'importe lequel), et 'saisie' (10.14.1,
  // S-03) : n'importe quel dossier qui a son livre — celui qu'on regarde d'abord, sinon le garage de
  // l'exemple. C'est la sorte des GESTES de saisie : « Saisir une pièce », lancé depuis « Guide-moi » sur
  // un client qui envoie ses paquets, se fait dans SON livre. La découverte, elle, garde 'hors' : ses
  // bulles parlent du garage, et ne doivent jamais se poser sur un autre dossier.
  function dossierPour(sorte) {
    const tous = (S && S.dossiers) || [];
    const livres = avecLivre();
    const convient = d => !!d && !d.archived && (sorte === 'client'
      || ((sorte === 'livre' || sorte === 'saisie') && livres.has(d.id))
      || (sorte === 'skanfact' && livres.has(d.id) && (d.packs || []).length > 0)
      || (sorte === 'hors' && livres.has(d.id) && !!d.manual));
    const ouvert = (/^#\/dossier\/([^/]+)/.exec(location.hash) || [])[1];
    const courant = ouvert ? tous.find(d => d.id === decodeURIComponent(ouvert)) : null;
    if (convient(courant)) return courant.id;
    const vitrines = K.demoDossiers(K.today()).filter(d => d.vitrine);
    const vit = vitrines.find(v => v.vitrine === (sorte === 'hors' || sorte === 'saisie' ? 'hors' : 'skanfact'));
    const v = vit && tous.find(d => d.id === vit.id);
    if (v && (sorte === 'client' || convient(v) || (v.demo && sorte !== 'client'))) return v.id;
    const r = tous.find(convient);
    return r ? r.id : null;
  }
  // Les exercices d'un dossier tenu au cabinet, lus dans le résumé des index (jamais dans un livre) :
  // c'est ce qui permet à la découverte de désigner l'exercice CLOS du garage de l'exemple.
  function exercicesDe(sorte) {
    const id = dossierPour(sorte);
    const q = id && (questionsAttente || []).find(x => x.dossierId === id);
    return ((q && q.tenu && q.tenu.exercices) || []).map(e => ({ annee: String(e.annee), clos: !!e.clos }));
  }
  let VISITES = null;
  const visites = () => VISITES || (VISITES = CV.parcours({
    state: () => S, dossier: dossierPour, exercices: exercicesDe, estExemple: () => (S.dossiers || []).some(d => d.demo),
    cleSecours: () => (recoveryAt === undefined ? null : recoveryAt !== null),
    copieExterne: () => !!(backupInfo && backupInfo.external && backupInfo.external.dir),
    // Le nombre d'écritures du livre ouvert : la preuve qu'une pièce a été enregistrée (10.14.1).
    ecritures: () => ((livresState.livre && livresState.livre.ecritures) || []).length,
    Visite
  }));
  const visiteParId = id => visites().find(v => v.id === id) || null;
  const visitePage = cle => visiteParId('page-' + cle);
  const decouverteEnPause = () => { const r = visitesEtat().reprise; return r && r.id === 'decouvrir' ? r : null; };

  // Ce qui manque à une visite pour se dérouler, ou null — UNE fonction pour le bouton éteint de « Me
  // guider » et pour le refus au lancement : les deux ne peuvent pas diverger (9.4.5).
  function visiteManque(p) {
    if (!p || typeof p.si !== 'function') return null;
    let ok = true;
    try { ok = !!p.si(); } catch (_) { ok = false; }
    return ok ? null : (p.manque || { texte: 'Il faut d\'abord quelque chose à montrer ici.' });
  }
  // La première visite qu'on peut FAIRE en remontant ce qui manque — jamais un bouton éteint qui
  // renvoie à un autre bouton éteint. Bornée.
  function visitePossibleAvant(p) {
    let x = p;
    for (let n = 0; n < 8; n++) {
      const m = visiteManque(x);
      if (!m) return x === p ? null : x;
      const avant = m.visite && visiteParId(m.visite);
      if (!avant || avant === x) return null;
      x = avant;
    }
    return null;
  }
  function expliquerManque(p, m) {
    const avant = visitePossibleAvant(p);
    modal(`<h2>${esc(p.titre)}</h2><p>${esc(m.texte)}</p>
      ${avant ? `<p class="small muted">La visite « ${esc(avant.titre)} » t'y amène pas à pas.</p>` : ''}
      <div class="modal-actions"><button class="btn" data-dismiss>Fermer</button>
        ${avant ? `<button class="btn btn-primary" id="vm-go">${esc(avant.titre)}</button>` : ''}</div>`,
    (root, close) => { const b = $('#vm-go', root); if (b) b.onclick = () => { close(); lancerVisite(avant); }; }, null, { garde: false });
  }
  async function lancerVisite(p, depart) {
    if (!p) return;
    // Rien ne reste ouvert par-dessus l'écran qu'on va montrer.
    if (fermerPalette) fermerPalette();
    const manque = visiteManque(p);
    if (manque) { expliquerManque(p, manque); return; }
    // La découverte se fait sur l'EXEMPLE : elle le charge d'abord. Les vrais dossiers ne bougent pas —
    // l'exemple vit à côté d'eux, et s'efface au premier vrai paquet.
    if (p.exemple && !(S.dossiers || []).some(d => d.demo)) {
      try { S = await chargerOuRetirerExemple(true); } catch (e) { toast(plainError(e), 'error'); return; }
      VISITES = null;
      render();
      toast(phraseExemple());
    }
    fermerAppelGuide();
    // Une visite lit le résumé des livres pendant qu'elle se déroule (l'exercice clos du garage, ses
    // dossiers tenus) : relu au lancement, jamais celui du démarrage — un exercice clôturé ou rouvert
    // depuis changerait sinon ce que les étapes montrent.
    await chargerQuestionsAttente(false);
    Visite.lancer(p, depart || 0);
  }
  // L'étape suivante des premiers pas, guidée : la même que celle que « À faire » nomme.
  function lancerPasSuivant() {
    const pp = lesPas();
    const e = pp.suivante;
    const v = e && visiteParId(PAS_VISITES[e.action]);
    if (v) lancerVisite(v); else navigate('#/guide');
  }
  async function actionDeVisite(id) {
    if (id === 'poser-cabinet') {
      if (!String((S.cabinet || {}).name || '').trim()) { await runSetup({ sansPorte: true }); render(); }
      lancerVisite(visiteParId('premiers-pas'));
    } else if (id === 'rester') {
      toast('Bonne exploration ! « Effacer l\'exemple », sur la page Dossiers, retire les dossiers fictifs.');
    }
  }
  const navigate = hash => vers(hash);

  // Tes premiers pas (10.14.0) : lus sur l'état, jamais cochés à la main (`K.premiersPas`).
  const lesPas = () => K.premiersPas(S, {
    cleSecours: recoveryAt === undefined ? null : recoveryAt !== null,
    copieExterne: !!(backupInfo && backupInfo.external && backupInfo.external.dir),
    tenus: tenusConnus(), decouverte: !!visitesEtat().faites.decouvrir
  });
  const PAS_ACTIONS = {
    decouverte: ['Faire la découverte', () => { const r = decouverteEnPause(); lancerVisite(visiteParId('decouvrir'), r ? r.i : 0); }],
    cabinet: ['Nommer mon cabinet', () => versReglages('pan-cabinet')],
    equipe: ['Déclarer mon équipe', () => versReglages('pan-equipe')],
    clients: ['Ajouter un client…', () => newDossierForm()],
    appairage: ['Remettre le fichier à mes clients…', () => remettreAppairage()],
    cle: ['Enregistrer ma clé…', () => versReglages('pan-secu')],
    copie: ['Choisir un dossier de copie…', () => versReglages('pan-backup')],
    saisie: ['Régler ma grille', () => versReglages('pan-saisie')],
    travail: ['Importer un paquet…', () => doImport()]
  };
  const PAS_VISITES = { decouverte: 'decouvrir', cabinet: 'nommer-cabinet', equipe: 'equipe', clients: 'ajouter-client', appairage: 'appairage',
    cle: 'cle-secours', copie: 'copie-externe', saisie: 'grille-saisie', travail: 'recevoir-paquet' };
  const ICONE_GUIDE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>';
  const ICONE_LECTURE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10.2 8.6l5 3.4-5 3.4z"/></svg>';
  const ICONE_COCHE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICONE_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>';
  const ICONE_DECOUVRIR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/></svg>';
  const ICONE_DEMARRER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';
  // Le panneau complet des premiers pas : sur la page Dossiers VIDE, où il est le corps de l'écran.
  // Quand des dossiers existent, il se réduit à UNE ligne de « À faire » (la liste des clients ne se
  // mérite pas au défilement, 9.4.4) et la liste entière vit dans « Me guider ».
  // `vertEnTete` : l'en-tête porte déjà le vert de l'étape (U-11) — l'étape en cours ne le double pas.
  function premiersPasPanel(vertEnTete) {
    const p = lesPas();
    const suivante = p.suivante;
    return `<div class="panel premiers-pas">
      <h2>Tes premiers pas <span class="pp-compte">${p.faits} / ${p.total}</span></h2>
      <p class="small muted mb">Le Cabinet fait beaucoup de choses, mais elles s'enchaînent toujours dans le même ordre.
        Chaque étape se coche toute seule quand c'est fait ; celles marquées « facultatif » t'attendent sans te presser.</p>
      <ol class="pp-list">${p.etapes.map(e => {
        const a = PAS_ACTIONS[e.action];
        const encours = e === suivante;
        const guide = !e.fait && PAS_VISITES[e.action];
        const libelle = a && e.action === 'decouverte' && decouverteEnPause() ? 'Reprendre la découverte' : a && a[0];
        return `<li class="${e.fait ? 'fait' : ''}${encours ? ' encours' : ''}">
          <span class="pp-marque">${e.fait ? '✓' : ''}</span>
          <span class="pp-txt"><strong>${esc(e.titre)}${e.facultatif && !e.fait ? ' <span class="pp-facult">facultatif</span>' : ''}</strong><span class="small muted">${esc(e.quoi)}</span></span>
          <span class="pp-go">${guide ? `<button type="button" class="pp-guide" data-pas-guide="${esc(guide)}" title="Je te montre où cliquer, étape par étape">${ICONE_GUIDE}Me guider</button>` : ''}${!e.fait && a
            ? `<button class="btn btn-sm ${encours && !vertEnTete ? 'btn-primary' : ''}" data-pas="${esc(e.action)}">${esc(libelle)}</button>` : ''}</span>
        </li>`;
      }).join('')}</ol></div>`;
  }
  function bindPremiersPas(root) {
    $$('[data-pas]', root).forEach(b => b.onclick = () => { const a = PAS_ACTIONS[b.dataset.pas]; if (a) a[1](); });
    $$('[data-pas-guide]', root).forEach(b => b.onclick = () => lancerVisite(visiteParId(b.dataset.pasGuide)));
  }
  // La ligne « Tes premiers pas » de « À faire », quand le portefeuille a déjà des dossiers.
  function lignePremiersPas() {
    const p = lesPas();
    if (!p.demarrage || !p.suivante) return null;
    return { id: 'premiers-pas', level: 'info', label: `Tes premiers pas — ${p.faits} sur ${p.total} : ${p.suivante.titre.charAt(0).toLowerCase() + p.suivante.titre.slice(1)}`,
      detail: p.suivante.quoi, count: 0, rows: [] };
  }

  // L'habillage que le moteur demande : la couleur et le dessin d'une visite, la suite, la fête.
  const iconeVisite = (coul, p) => {
    const propre = p && CV.iconeDe(p);
    const t = propre ? propre : '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>';
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${t}</svg>`;
  };
  function installerVisites() {
    Visite.installer({
      aller: hash => vers(hash),
      hash: () => location.hash || '#/dossiers',
      parcours: visiteParId,
      lancerSuite: p => lancerVisite(p),
      expliquer: el => CV.expliquer(el, { G }),
      zone: el => CV.zone(el),
      action: id => actionDeVisite(id),
      // Le jumeau de l'app entreprise : une liste vidée par une recherche ou un filtre se réaffiche
      // d'un clic depuis la bulle, au lieu de faire perdre la visite.
      remettre: '#reset-f',
      couleur: p => CV.couleurDe(p),
      icone: iconeVisite,
      progres: p => {
        if (!['premiers-pas', ...Object.values(PAS_VISITES)].includes(p.id)) return null;
        const pp = lesPas();
        return { titre: 'Tes premiers pas', fait: pp.faits, total: pp.total,
          texte: pp.suivante ? 'Prochaine étape : ' + pp.suivante.titre.charAt(0).toLowerCase() + pp.suivante.titre.slice(1) + '.' : 'Tout est en place : ton cabinet est prêt.' };
      },
      suites: p => {
        const et = visitesEtat();
        const pp = lesPas();
        const pas = pp.suivante && PAS_VISITES[pp.suivante.action];
        const ids = [pas, ...(p.suite || [])].filter((id, i, a) => id && id !== p.id && a.indexOf(id) === i && visiteParId(id) && !visiteManque(visiteParId(id)));
        const neuves = ids.filter(id => !et.faites[id]);
        return (neuves.length ? neuves : ids).slice(0, 3);
      },
      fete: p => p.type !== 'page' && !visitesEtat().faites[p.id],
      // L'étape où l'on en est, et le compte quand on le connaît (`Visite.pointDeReprise`).
      etape: (p, i, compte) => visitesPoser(e => { e.reprise = Object.assign({ id: p.id, i }, compte || {}); }),
      fini: p => {
        visitesPoser(e => { e.faites[p.id] = K.today(); if (e.reprise && e.reprise.id === p.id) e.reprise = null; });
        if (location.hash === '#/guide') render();
      },
      interrompu: (p, i, compte) => {
        visitesPoser(e => { e.reprise = Object.assign({ id: p.id, i: Math.max(0, i) }, compte || {}); });
        // Où la reprendre : « Guide-moi » de cet écran quand il la propose, sinon « Me guider » — la
        // découverte n'est que là (S-03, le jumeau de l'app entreprise).
        const g = Visite.guideDeLaPage(visites(), CV.cleDePage(location.hash), { cleDe: h => CV.cleDePage(h) });
        toast($('#guide-moi') && Visite.dansLeGuide(g, p.id)
          ? 'Visite mise en pause. Tu la reprends depuis « Guide-moi », en haut de cet écran, ou depuis « Me guider », dans le menu.'
          : 'Visite mise en pause. Tu la reprends quand tu veux depuis « Me guider », dans le menu.');
        if (location.hash === '#/guide') render();
      }
    });
  }

  // « Guide-moi » (10.14.1, S-03) — le jumeau de l'app entreprise, par le MÊME moteur
  // (`Visite.guideDeLaPage`, `Visite.menuDuGuide`) : dans l'en-tête de chaque écran, à la même place, la
  // liste de ce qu'on peut faire ICI — la visite de l'écran, chaque geste guidé pas à pas (ceux de
  // l'onglet ouvert d'abord), puis l'article qui l'explique et toutes les visites. Sur l'écran d'un
  // dossier, un geste ne se propose que s'il se fera dans CE dossier (`surLaPage`, cabvisites.js).
  // Un observateur le repose quand un écran redessine son en-tête — la fiche d'un dossier lit son livre
  // et réécrit `#view` après le routeur.
  const ICONE_GUIDE_MOI = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>';
  function poserGuideMoi() {
    const view = $('#view');
    const head = view && view.querySelector('.page-head');
    if (!S || !head || head.querySelector('.guide-moi')) return;
    const cle = CV.cleDePage(location.hash);
    // « Me guider » EST la liste de toutes les visites : un bouton qui y mène depuis elle-même non.
    if (cle === 'guide') return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-sm guide-moi';
    b.id = 'guide-moi';
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.title = 'Ce qu\'on peut faire sur cet écran, montré pas à pas';
    b.innerHTML = ICONE_GUIDE_MOI + '<span>Guide-moi</span>';
    b.onclick = e => { e.stopPropagation(); ouvrirGuideMoi(b); };
    const actions = head.querySelector(':scope > .actions');
    if (actions) actions.insertBefore(b, actions.firstChild); else head.appendChild(b);
    // Un écran asynchrone pose son en-tête APRÈS le routeur : l'invitation attendait ce bouton.
    if (appelEnAttente && appelEnAttente === cle) { appelEnAttente = ''; appelGuide(); }
  }
  let guideObs = null;
  function surveillerGuideMoi() {
    const view = $('#view');
    if (guideObs || !view || !window.MutationObserver) return;
    guideObs = new MutationObserver(() => poserGuideMoi());
    guideObs.observe(view, { childList: true, subtree: true });
  }
  function ouvrirGuideMoi(bouton) {
    fermerAppelGuide();
    const cle = CV.cleDePage(location.hash);
    const et = visitesEtat();
    const ongletActif = barre => { const t = $(barre + ' button[data-tab].active'); return t ? t.dataset.tab : null; };
    const g = Visite.guideDeLaPage(visites(), cle, { cleDe: h => CV.cleDePage(h), ongletActif });
    // L'article suit l'onglet ouvert des Réglages (`G.articleDeLaPage`).
    const artId = G.articleDeLaPage ? G.articleDeLaPage(cle, ongletActif) : G.PAR_PAGE && G.PAR_PAGE[cle];
    const art = artId && G.ARTICLES.find(a => a.id === artId);
    const exemple = (S.dossiers || []).some(d => d.demo);
    const actions = Visite.menuDuGuide(g, {
      titrePage: g.page ? g.page.titre : 'Cet écran',
      lancer: (v, i) => lancerVisite(v, i),
      manque: v => visiteManque(v),
      fait: v => !!et.faites[v.id],
      // Une visite en pause se reprend à son étape (`Visite.pointDeReprise`, le même calcul que « Me guider »).
      reprise: v => (et.reprise && et.reprise.id === v.id ? Visite.pointDeReprise(v, et.reprise) : null),
      avertir: v => v.exemple && !exemple ? 'L\'exemple se charge d\'abord ; tes vrais dossiers ne bougent pas.' : '',
      // Le nom d'un onglet, tel qu'il est écrit dans sa barre — sans le compteur qui le suit.
      libelleOnglet: og => {
        const t = $(og.barre + ' button[data-tab="' + og.cle + '"]');
        return t ? [...t.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() || og.cle : og.cle;
      },
      article: art ? { titre: art.t, ouvrir: () => navigate('#/aide/' + art.id) } : null,
      tout: () => navigate('#/guide')
    });
    RowMenu.ouvrir(bouton, actions, { classe: 'guide-menu', label: 'Guide-moi : ce qu\'on peut faire sur cet écran' });
  }

  // La première fois qu'on ouvre un écran, une invitation propose sa visite — trois fois au plus.
  // 10.14.1 (S-03) : elle s'ACCROCHE à « Guide-moi », par-dessus l'écran, au lieu de pousser l'écran de
  // travail (la bande d'avant faisait commencer la grille de saisie plus bas pendant ses trois
  // premières ouvertures), et elle apprend où la visite se retrouve. Pas de vert : le bouton principal
  // de l'écran reste le seul (U-11).
  const VISITE_PROPOSEE_MAX = 3;
  let appelEnAttente = '';
  function fermerAppelGuide() {
    const a = document.getElementById('guide-appel');
    if (a) { if (typeof a._fermer === 'function') a._fermer(); else a.remove(); }
  }
  function appelGuide() {
    const cle = CV.cleDePage(location.hash);
    if (!S || Visite.enCours() || cle === 'guide' || cle === 'aide') return;
    const p = visitePage(cle);
    const et = visitesEtat();
    if (!p || visiteManque(p) || !et.proposer || et.faites[p.id] || (et.vues[cle] || 0) >= VISITE_PROPOSEE_MAX) return;
    // Une page vide qui porte « Tes premiers pas » est déjà une invitation.
    if ($('#view .premiers-pas')) return;
    const bouton = $('#guide-moi');
    // Un écran asynchrone n'a pas encore son en-tête : l'invitation attend le bouton (`poserGuideMoi`).
    if (!bouton) { appelEnAttente = cle; return; }
    fermerAppelGuide();
    visitesPoser(e => { e.vues[cle] = (e.vues[cle] || 0) + 1; });
    const coul = CV.couleurDe(p);
    const el = document.createElement('div');
    el.className = 'guide-appel' + (coul ? ' th-' + coul : '');
    el.id = 'guide-appel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'ga-t');
    el.innerHTML = `<span class="ga-fleche" aria-hidden="true"></span>
      <div class="ga-tete"><span class="ga-ico" aria-hidden="true">${ICONE_GUIDE}</span>
        <b id="ga-t">Première fois sur cet écran ?</b></div>
      <p class="ga-txt">${esc(p.resume || '')} Je te montre à quoi il sert et ce que fait chaque bouton, en ${esc(p.duree || 'une minute')}.</p>
      <div class="ga-actions"><button type="button" class="btn btn-sm ga-go" id="ga-go">${ICONE_LECTURE}Faire la visite</button>
        <button type="button" class="btn btn-ghost btn-sm" id="ga-non" title="Ne plus me proposer la visite de cet écran">Plus tard</button></div>
      <p class="ga-note">Tu la retrouves dans « Guide-moi », avec tout ce qu'on peut faire ici.</p>`;
    document.body.appendChild(el);
    typographie(el);
    const scroller = $('#view');
    const depart = scroller ? scroller.scrollTop : 0;
    // Sous le bouton, calée sur son bord droit, la flèche sur son milieu ; jamais hors de l'écran.
    const placer = () => {
      const r = bouton.getBoundingClientRect();
      if (!r.width || !document.body.contains(bouton)) { fermer(); return; }
      const w = el.offsetWidth;
      const gauche = Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w));
      el.style.top = Math.round(r.bottom + 10) + 'px';
      el.style.left = Math.round(gauche) + 'px';
      el.style.setProperty('--ga-fleche', Math.round(Math.min(w - 22, Math.max(14, r.left + r.width / 2 - gauche))) + 'px');
    };
    // Le premier geste ailleurs la referme : on s'est mis au travail.
    const dehors = e => { if (!el.contains(e.target)) fermer(); };
    const clavier = e => { if (e.key === 'Escape' && el.contains(document.activeElement)) { e.stopPropagation(); fermer(); bouton.focus(); } };
    const defile = () => { if (!scroller || Math.abs(scroller.scrollTop - depart) > 4) fermer(); };
    function fermer() {
      el.remove();
      document.removeEventListener('mousedown', dehors, true);
      document.removeEventListener('keydown', clavier, true);
      window.removeEventListener('resize', placer);
      if (scroller) scroller.removeEventListener('scroll', defile);
    }
    el._fermer = fermer;
    placer();
    document.addEventListener('mousedown', dehors, true);
    document.addEventListener('keydown', clavier, true);
    window.addEventListener('resize', placer);
    if (scroller) scroller.addEventListener('scroll', defile);
    $('#ga-go', el).onclick = () => { fermer(); lancerVisite(p); };
    $('#ga-non', el).onclick = () => { visitesPoser(e => { e.vues[cle] = VISITE_PROPOSEE_MAX; }); fermer(); };
  }

  // La page « Me guider » : où j'en suis, LE prochain geste (un seul vert), les grands départs, chaque
  // famille avec ses visites, et chaque écran.
  let guideQ = '';
  function drawGuide(view) {
    const et = visitesEtat();
    const toutes = visites();
    const gestes = toutes.filter(v => v.type !== 'page');
    const pages = toutes.filter(v => v.type === 'page');
    const nbFaites = toutes.filter(v => et.faites[v.id]).length;
    const reprise = et.reprise && visiteParId(et.reprise.id);
    // Où la visite reprendra, et ce qu'on en sait (`Visite.pointDeReprise`, la même que SkanFact).
    const rep = reprise ? Visite.pointDeReprise(reprise, et.reprise) : null;
    const repriseI = rep ? rep.i : 0;
    const exemple = (S.dossiers || []).some(d => d.demo);
    const pp = lesPas();
    const dec = visiteParId('decouvrir');
    const pas = pp.suivante && visiteParId(PAS_VISITES[pp.suivante.action]);
    const prochain = reprise
      ? { etiq: 'En pause', label: 'Reprendre', titre: reprise.titre, sous: rep.note ? `${rep.texte} — ${rep.note}` : rep.texte, run: () => lancerVisite(reprise, repriseI) }
      : dec && !et.faites.decouvrir
        ? { etiq: 'Pour commencer', label: exemple ? 'Commencer la découverte' : 'Charger l\'exemple et découvrir', titre: dec.titre, sous: `${dec.duree} · ${pl(Visite.chapitres(dec.etapes).length, 'chapitre')}`, run: () => lancerVisite(dec) }
        : pas && !visiteManque(pas)
          ? { etiq: 'Prochaine étape', label: 'Me guider', titre: pas.titre, sous: `Premier pas ${pp.etapes.indexOf(pp.suivante) + 1} sur ${pp.total} · ${pas.duree}`, run: () => lancerVisite(pas) }
          : null;
    const titreHero = reprise ? 'Reprends ta visite là où tu l\'as laissée' : !et.faites.decouvrir ? 'Apprends le Cabinet en le faisant'
      : pp.demarrage ? 'Continue tes premiers pas' : 'Tu as les bases — explore à ton rythme';
    const anneauPas = pp.demarrage;
    const aFait = anneauPas ? pp.faits : nbFaites;
    const aTotal = anneauPas ? pp.total : toutes.length;
    const aQuoi = anneauPas ? 'premiers pas' : 'visites faites';
    const pct = aTotal ? aFait / aTotal : 0;
    const R = 52, CIRC = 2 * Math.PI * R;
    const statut = v => et.faites[v.id] ? '<span class="g-etat fait">Fait</span>'
      : reprise && reprise.id === v.id ? `<span class="g-etat encours">En pause · ${rep.sur ? `${repriseI + 1}/${rep.sur}` : `étape ${repriseI + 1}`}</span>` : '';
    const libelle = v => et.faites[v.id] ? 'Refaire' : reprise && reprise.id === v.id ? 'Recommencer' : 'Commencer';
    const bouton = v => {
      const m = visiteManque(v);
      if (!m) return `<button type="button" class="btn btn-sm" data-visite="${esc(v.id)}">${libelle(v)}</button>`;
      const avant = visitePossibleAvant(v);
      return avant
        ? `<button type="button" class="btn btn-sm" data-visite="${esc(avant.id)}" title="${esc(m.texte)}">D'abord : ${esc(avant.titre.charAt(0).toLowerCase() + avant.titre.slice(1))}</button>`
        : `<button type="button" class="btn btn-sm" disabled title="${esc(m.texte)}">${libelle(v)}</button>`;
    };
    const cherche = v => esc(K.sansAccents([v.titre, v.resume, (v.mots || []).join(' ')].join(' ')));
    const manqueDe = v => { const m = visiteManque(v); return m ? `<span class="small g-manque">Pas encore : ${esc(m.texte.charAt(0).toLowerCase() + m.texte.slice(1))}</span>` : ''; };
    const ligne = v => `<li class="g-ligne${et.faites[v.id] ? ' faite' : ''}" data-cherche="${cherche(v)}">
        <span class="g-l-ico" aria-hidden="true">${et.faites[v.id] ? ICONE_COCHE : reprise && reprise.id === v.id ? ICONE_PAUSE : ICONE_LECTURE}</span>
        <span class="g-txt"><b>${esc(v.titre)}</b><span class="small muted">${esc(v.resume || '')}</span>${manqueDe(v)}</span>
        <span class="g-duree">${esc(v.duree || '')}</span>${statut(v)}${bouton(v)}</li>`;
    const themes = CV.THEMES.filter(t => t.id !== 'pages' && t.id !== 'demarrer').map(t => {
      const liste = gestes.filter(v => v.theme === t.id);
      if (!liste.length) return '';
      const faites = liste.filter(v => et.faites[v.id]).length;
      return `<section class="g-theme th-${esc(t.couleur)}" id="g-${esc(t.id)}" data-g-theme>
        <header class="g-th-tete"><span class="g-th-ico">${iconeVisite(t.couleur, t)}</span>
          <span class="g-th-t"><h2>${esc(t.titre)}</h2><span>${esc(t.sous)}</span></span>
          <span class="g-th-n" title="${esc(`${faites} ${faites > 1 ? 'visites faites' : 'visite faite'} sur ${liste.length}`)}">${faites}<small> / ${liste.length}</small></span></header>
        <span class="g-th-barre" aria-hidden="true"><i style="width:${Math.round(faites / liste.length * 100)}%"></i></span>
        <ul class="g-liste">${liste.map(ligne).join('')}</ul></section>`;
    }).join('');
    const pagesFaites = pages.filter(v => et.faites[v.id]).length;
    const gestesFaits = gestes.filter(v => et.faites[v.id]).length;
    view.innerHTML = `
      <div class="page-head"><h1>Me guider</h1>
        <div class="actions"><button type="button" class="btn" id="g-aide">Ouvrir l'Aide</button></div></div>
      <section class="g-hero">
        <div class="g-hero-txt"><span class="g-sur">Ton guide</span>
          <h2>${esc(titreHero)}</h2>
          <p>Chaque visite te montre où cliquer, sur ton vrai écran, et attend que tu l'aies fait. Pendant une visite, tu peux cliquer partout, faire une pause avec la croix, et reprendre ici.</p>
          ${prochain ? `<div class="g-prochain"><span class="g-pr-t"><span class="g-pr-etiq">${esc(prochain.etiq)}</span><b>${esc(prochain.titre)}</b><span class="small muted">${esc(prochain.sous)}</span></span>
            <button type="button" class="btn btn-primary" id="${reprise ? 'g-reprendre' : 'g-prochain'}">${ICONE_LECTURE}${esc(prochain.label)}</button></div>` : ''}</div>
        <div class="g-hero-mesure"><div class="g-anneau" role="img" aria-label="${esc(`${aFait} sur ${aTotal} : ${aQuoi}`)}">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="g-an-fond" cx="60" cy="60" r="${R}"/><circle class="g-an-plein" cx="60" cy="60" r="${R}" style="--circ:${CIRC.toFixed(1)};--off:${(CIRC * (1 - pct)).toFixed(1)}"/></svg>
          <span class="g-an-t"><b>${aFait}<small> / ${aTotal}</small></b><span>${aQuoi}</span></span></div>
          <ul class="g-chiffres">
            <li><b>${gestesFaits}<small> / ${gestes.length}</small></b><span>${gestesFaits > 1 ? 'gestes guidés réussis' : 'geste guidé réussi'}</span></li>
            <li><b>${pagesFaites}<small> / ${pages.length}</small></b><span>${pagesFaites > 1 ? 'écrans découverts' : 'écran découvert'}</span></li>
            <li><b>${et.faites.decouvrir ? 'Faite' : 'À faire'}</b><span>la découverte de l'exemple</span></li>
          </ul></div>
      </section>
      ${pp.demarrage ? premiersPasPanel(!!prochain) : ''}
      <div class="g-cartes" id="g-demarrer" data-g-theme>
        ${gestes.filter(v => v.theme === 'demarrer').map(v => {
          const coul = CV.couleurDe(v);
          const lib = v.exemple && !exemple ? 'Charger l\'exemple et ' + libelle(v).toLowerCase() : libelle(v);
          return `<div class="g-carte${coul ? ' th-' + coul : ''}${et.faites[v.id] ? ' faite' : ''}" data-cherche="${cherche(v)}">
            <div class="g-carte-t"><span class="g-carte-ico">${v.exemple ? ICONE_DECOUVRIR : ICONE_DEMARRER}</span>
              <span class="g-duree">${esc(v.duree)}</span></div>
            <b class="g-carte-titre">${esc(v.titre)}</b>
            <p class="small">${esc(v.resume)}</p>${statut(v)}
            ${visiteManque(v) ? bouton(v) : `<button type="button" class="btn btn-sm" data-visite="${esc(v.id)}">${esc(lib)}</button>`}</div>`;
        }).join('')}
      </div>
      <div class="help-search g-cherche"><span class="hs-champ"><svg class="hs-loupe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/></svg>
        <input type="search" id="guide-q" placeholder="Je veux… (saisir une pièce, relancer un client, déclarer la TVA)" autocomplete="off" spellcheck="false" value="${esc(guideQ)}"></span>
        <div class="help-count small muted" id="guide-n" hidden></div></div>
      <div class="g-themes">${themes}</div>
      <section class="panel g-pages-sec" id="g-pages" data-g-theme>
        <div class="g-reu-tete"><h2>Chaque écran, en une minute</h2><span class="g-reu-n">${pagesFaites} sur ${pages.length}</span></div>
        <p class="small muted">À quoi il sert, et ce que fait chacun de ses boutons.</p>
        <ul class="g-pages">${pages.map(v => { const m = visiteManque(v); const c = CV.couleurDe(v); return `<li data-cherche="${cherche(v)}">
          <button type="button" class="g-page${c ? ' th-' + c : ''}${et.faites[v.id] ? ' fait' : ''}" data-visite="${esc(v.id)}"${m ? ` disabled title="${esc(m.texte)}"` : ` title="${esc(v.resume || '')}"`}>${et.faites[v.id] ? ICONE_COCHE : ''}${esc(v.titre)}</button></li>`; }).join('')}</ul>
      </section>
      <label class="check g-proposer"><input type="checkbox" id="guide-proposer" ${et.proposer ? 'checked' : ''}>
        <span>Me proposer la visite d'un écran quand je l'ouvre pour la première fois</span></label>`;
    // Le vert du héros porte LE prochain geste ; les cartes et les lignes n'en portent aucun (U-11).
    if (prochain) ($('#g-reprendre', view) || $('#g-prochain', view)).onclick = prochain.run;
    $$('[data-visite]', view).forEach(b => b.onclick = () => lancerVisite(visiteParId(b.dataset.visite)));
    bindPremiersPas(view);
    $('#g-aide', view).onclick = () => { location.hash = '#/aide'; };
    $('#guide-proposer', view).onchange = e => visitesPoser(x => { x.proposer = e.target.checked; if (e.target.checked) x.vues = {}; });
    // Chercher ne redessine rien : on montre ou on cache des lignes déjà là (la frappe reste).
    const q = $('#guide-q', view), n = $('#guide-n', view);
    const filtrer = () => {
      guideQ = q.value;
      const mots = K.sansAccents(q.value.trim()).split(/\s+/).filter(Boolean);
      let vus = 0;
      $$('[data-cherche]', view).forEach(li => { const ok = mots.every(m => li.dataset.cherche.includes(m)); li.hidden = !ok; if (ok) vus++; });
      $$('[data-g-theme]', view).forEach(sec => { sec.hidden = mots.length > 0 && !$$('[data-cherche]', sec).some(li => !li.hidden); });
      n.hidden = !mots.length;
      n.innerHTML = vus ? esc(`${pl(vus, 'visite')} pour « ${q.value.trim()} »`)
        : `Aucune visite pour « ${esc(q.value.trim())} ». <a href="#/aide" id="guide-aide">Chercher dans l'Aide →</a>`;
      const a = $('#guide-aide', view);
      if (a) a.onclick = ev => { ev.preventDefault(); aideQ = q.value.trim(); location.hash = '#/aide'; };
    };
    q.oninput = filtrer;
    if (guideQ) filtrer();
  }

  // ---------- assistant de première utilisation ----------
  //
  // C'est le premier contact d'un comptable avec le produit. Jusqu'à la 10.13.0, cinq écrans avant de
  // montrer quoi que ce soit : se nommer, entrer ses clients, poser ses filets, produire le fichier à
  // remettre. Les trois derniers se passaient — ils protégeaient un portefeuille vide et remettaient un
  // fichier à des clients qu'on n'avait pas encore.
  //
  // 10.14.0 (Skander : « oublie pas le onboarding aussi, et fais le même système : la démo avant l'écran
  // de démarrage ») — la PORTE d'abord, comme dans l'application entreprise : « Découvrir avec
  // l'exemple » ou « Commencer avec mon cabinet ». Puis deux questions seulement. Le reste vit dans
  // « Tes premiers pas », au moment où il sert, chaque étape avec sa visite guidée.
  //
  // Le mot de passe reste AVANT la porte : l'état du cabinet est chiffré, exemple compris, et il n'y a
  // pas de cabinet sans lui.
  //
  // Rend 'decouvrir' quand on a choisi la découverte (l'assistant reste EN ATTENTE : le nom manque, il
  // reprendra à la sortie de l'exemple, sans la porte), sinon rien. `o.sansPorte` : la reprise.
  function runSetup(o) {
    const opts = o || {};
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.id = 'setup';
      document.body.appendChild(el);
      let etape = 0;
      const fin = r => { el.remove(); resolve(r); };
      const et = visitesEtat();
      const porte = !opts.sansPorte && !et.porteVue && !et.faites.decouvrir;
      const porteVue = () => visitesPoser(e => { e.porteVue = true; });

      const etapes = [
        ...(porte ? [{
          t: 'Bienvenue dans SkanFact Cabinet',
          porte: true,
          html: () => {
            const dec = visiteParId('decouvrir');
            const nChap = dec ? Visite.chapitres(dec.etapes).length : 0;
            return `
            ${/* 10.10.0 (C-03) — cet écran ne peut pas mentir sur ce qu'est le Cabinet : il tient la
                  comptabilité de chaque dossier, avec ou sans SkanFact chez le client. */''}
            <p class="lead">Le logiciel de comptabilité de ton cabinet — et <strong>le trait d'union avec ceux de tes clients qui utilisent SkanFact</strong>.</p>
            <div class="setup-porte mt">
              <p class="sp-lead">Deux façons de commencer — et tu peux faire l'une puis l'autre.</p>
              <div class="sp-choix">
                <article class="pp-choix reco"><span class="pp-choix-badge">Recommandé</span>
                  <span class="pp-choix-ico">${ICONE_DECOUVRIR}</span>
                  <h3>Découvrir avec l'exemple</h3>
                  <p>Six dossiers fictifs, tout remplis : un client à jour, un en retard, un que tu tiens de bout en bout, paie et biens compris. Je te fais faire le tour, sans rien risquer.</p>
                  <ul class="pp-choix-meta">${dec ? `<li>${esc(dec.duree)}</li>` : ''}${nChap ? `<li>${pl(nChap, 'chapitre')}</li>` : ''}</ul>
                  <button type="button" class="btn btn-primary" id="w-decouvrir">Commencer la découverte</button></article>
                <article class="pp-choix"><span class="pp-choix-ico">${ICONE_DEMARRER}</span>
                  <h3>Commencer avec mon cabinet</h3>
                  <p>Son nom, puis tes clients — et je te guide ensuite pour chaque premier geste : le fichier à remettre à tes clients, ta clé de secours, ta copie externe.</p>
                  <ul class="pp-choix-meta"><li>${['', 'Une', 'Deux', 'Trois'][QUESTIONS] || QUESTIONS} ${QUESTIONS > 1 ? 'questions' : 'question'}</li></ul>
                  <button type="button" class="btn" id="w-next">Commencer avec mon cabinet</button></article>
              </div>
              <div class="sp-note"><p>Ce qu'il fait : il tient le livre de chaque dossier — saisie, banque, déclaration, paie, immobilisations, clôture et liasse. Ce qu'il ne fait pas : il ne modifie <strong>jamais</strong> la comptabilité d'un client chez lui, et ne dépose aucune déclaration à ta place. Ce qu'il coûte : rien pour les dossiers dont le client est sur SkanFact, ni pour trois dossiers hors SkanFact ; au-delà, une licence.</p></div>
            </div>`;
          },
          mount: () => {
            $('#w-decouvrir', el).onclick = () => { porteVue(); fin('decouvrir'); };
          },
          next: () => { porteVue(); return true; }
        }] : []),
        {
          t: 'Ton cabinet',
          html: () => `
            <p class="small">Ce nom apparaît en bas des relances que tu envoies et dans le fichier que tes clients importeront.</p>
            <div class="grid-2 mt">
              <label class="field obligatoire span-2">${lbl('Nom du cabinet', 'cab.name')}<input type="text" id="w-name" value="${esc(S.cabinet.name || '')}" placeholder="Cabinet Ben Salah"></label>
              <label class="field">${lbl('Email', 'cab.email')}<input type="email" id="w-email" value="${esc(S.cabinet.email || '')}" placeholder="contact@cabinet.tn"></label>
              <label class="field">${lbl('Téléphone', 'cab.phone')}<input type="tel" id="w-phone" value="${esc(S.cabinet.phone || '')}" placeholder="+216 …"></label>
              <label class="field narrow">${lbl('Jour de relance', 'cab.relanceDay')}
                <span class="suffixe"><span class="suffixe-av">le</span><input type="number" id="w-day" min="1" max="28" value="${Number((S.settings || {}).relanceDay) || 10}"><span class="suffixe-ap">de chaque mois</span></span></label>
            </div>`,
          next: async () => {
            const nom = $('#w-name', el).value.trim();
            // 10.10.0 (C-01) — le refus se MONTRE (7.0.0) : un message passager de deux secondes et
            // un bouton qui ne bouge pas se lisaient comme « le bouton ne marche pas ». On amène le
            // champ, on y met le curseur, on le marque — et l'étoile dit, avant le clic, qu'il est
            // obligatoire.
            if (!nom) return refus($('#w-name', el), 'Donne un nom à ton cabinet : il signe tes relances et le fichier que tes clients importent.');
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
      ];
      // Le nombre de questions se DÉDUIT des écrans (la porte n'en est pas une) : écrit à la main, il
      // mentirait au premier écran ajouté (9.4.2).
      const QUESTIONS = etapes.filter(e => !e.porte).length;

      function draw() {
        const e = etapes[etape];
        const derniere = etape === etapes.length - 1;
        el.innerHTML = `<div class="wiz-card${e.porte ? ' wiz-porte' : ''}">
          ${/* Le compte se DÉDUIT du nombre d'écrans — écrit à la main, il mentirait au premier écran
                ajouté (défaut corrigé en 9.4.2). La porte n'est pas un écran de questions. */''}
          ${e.porte ? '' : `<div class="wiz-dots"><span class="wiz-compte">Question ${etapes.filter(x => !x.porte).indexOf(e) + 1} sur ${QUESTIONS}</span>
            ${etapes.filter(x => !x.porte).map(x => `<span class="${x === e ? 'on' : etapes.indexOf(x) < etape ? 'done' : ''}"></span>`).join('')}</div>`}
          <h1>${esc(e.t)}</h1>
          <div class="wiz-body">${e.html()}</div>
          ${e.porte ? '' : `<div class="wiz-actions">
            ${etape > 0 && !etapes[etape - 1].porte ? '<button class="btn" id="w-back">← Retour</button>' : ''}
            <span class="grow"></span>
            <button class="btn btn-ghost" id="w-skip">Passer</button>
            <button class="btn btn-primary" id="w-next">${derniere ? 'Commencer' : 'Continuer'}</button>
          </div>`}</div>`;
        if (e.mount) e.mount();
        typographie(el);
        const b = $('#w-back', el); if (b) b.onclick = () => { etape--; draw(); };
        const s = $('#w-skip', el); if (s) s.onclick = () => { if (derniere) { fin(); render(); return; } etape++; draw(); };
        $('#w-next', el).onclick = async () => {
          const btn = $('#w-next', el);
          btn.disabled = true;
          let ok = true;
          try { ok = await e.next(); } catch (ex) { toast(plainError(ex), 'error'); ok = false; }
          btn.disabled = false;
          if (!ok) return;
          if (derniere) { fin(); render(); return; }
          etape++; draw();
        };
        const first = el.querySelector('input, textarea');
        if (first) first.focus();
        else if (e.porte) $('#w-decouvrir', el).focus();
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
    fermerAppelGuide();
    const root = document.createElement('div');
    root.id = 'palette-root';
    root.innerHTML = `<div class="palette">
      <input type="text" id="pal-q" placeholder="Chercher un client, ou taper une action…" autocomplete="off" spellcheck="false">
      <div class="results" id="pal-res"></div>
      <div class="hint">↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</div></div>`;
    document.body.appendChild(root);
    const close = () => { root.remove(); document.removeEventListener('keydown', onKey, true); fermerPalette = null; };
    let sel = 0, items = [];

    // Chaque entrée dit ce qu'elle EST (U-07) : un réglage étiqueté « action » faisait croire que
    // taper « tva » lançait quelque chose.
    const actions = [
      { kind: 'action', main: 'Importer un paquet…', go: () => doImport() },
      { kind: 'action', main: 'Nouveau dossier client…', go: () => newDossierForm() },
      { kind: 'action', main: 'Sauvegarder maintenant', go: () => quickBackup() },
      { kind: 'page', main: 'Relances', go: () => { location.hash = '#/relances'; } },
      { kind: 'page', main: 'Échéances', go: () => { location.hash = '#/echeances'; } },
      { kind: 'page', main: 'Écritures — exporter un mois', text: 'export exporter regrouper cabinet', go: () => { location.hash = '#/ecritures'; } },
      { kind: 'page', main: 'Production', text: 'tableau avancement portefeuille', go: () => { location.hash = '#/production'; } },
      // Un réglage par PANNEAU, engendré depuis REG_PANNEAUX : taper « clé de secours » mène au
      // panneau Sécurité, pas en haut d'une page. Une liste écrite à la main se périmerait au
      // prochain découpage — c'est exactement ce qui est arrivé côté entreprise en 7.30.0.
      ...Object.keys(REG_PANNEAUX).map(id => ({
        kind: 'réglage', main: `Réglages → ${REG_PANNEAUX[id].titre}`,
        text: K.sansAccents('reglages ' + REG_PANNEAUX[id].titre + ' ' + REG_PANNEAUX[id].mots),
        go: () => versReglages(id)
      })),
      { kind: 'page', main: 'Aide', go: () => { location.hash = '#/aide'; } },
      { kind: 'page', main: 'Me guider', text: 'visite guidee guide apprendre tutoriel decouvrir', go: () => { location.hash = '#/guide'; } },
      // Les visites guidées (10.14.0) : chacune se lance d'ici, par ses mots — « relancer », « tva »,
      // « clé de secours ». Celles qui n'ont encore rien à montrer ne se proposent pas.
      ...visites().filter(v => v.type !== 'page' && !visiteManque(v)).map(v => ({
        kind: 'visite', main: v.titre, sub: v.resume,
        text: K.sansAccents([v.titre, v.resume, (v.mots || []).join(' ')].join(' ')),
        go: () => lancerVisite(v)
      }))
    ];
    // Le dossier OUVERT, lu dans l'adresse au moment où la palette s'ouvre : c'est de lui qu'on
    // parle quand on tape « balance » sur sa fiche.
    const ouvert = (/^#\/dossier\/([^/]+)/.exec(location.hash) || [])[1];
    const courantId = ouvert ? decodeURIComponent(ouvert) : null;
    const ecransPalette = Object.fromEntries(Object.keys(ONGLETS_COMPTA).map(k => [k, { label: ONGLETS_COMPTA[k], mots: MOTS_COMPTA[k] || '' }]));
    // Les ARTICLES d'Aide (10.12.0, vu au test humain) : « rapprochement » ne rendait que l'écran
    // Banque — jamais l'article qui explique comment on rapproche. La palette de l'app entreprise
    // les liste depuis toujours ; celle du Cabinet jamais (le jumeau manquant, 7.3.0). On cherche
    // dans le titre, le sous-titre ET le corps sans ses balises — « lettrage » n'est dans aucun
    // titre —, on classe (titre, puis sous-titre, puis corps : 7.27.0), et on en garde quatre :
    // la palette montre d'abord ce qu'on OUVRE, l'explication vient après.
    const articlesPalette = (G.ARTICLES || []).map(a => ({
      a, titre: K.sansAccents(a.t), sous: K.sansAccents(a.s),
      corps: K.sansAccents(String(a.d || '').replace(/<[^>]+>/g, ' '))
    }));
    const aidesPour = qa => articlesPalette
      .map(x => ({ x, rang: x.titre.includes(qa) ? 3 : x.sous.includes(qa) ? 2 : x.corps.includes(qa) ? 1 : 0 }))
      .filter(r => r.rang).sort((p, q) => q.rang - p.rang).slice(0, 4)
      .map(({ x }) => ({ kind: 'aide', main: x.a.t, sub: x.a.s, go: () => { aideQ = ''; location.hash = '#/aide/' + x.a.id; } }));

    function draw() {
      const brut = $('#pal-q', root).value.trim();
      const q = brut.toLowerCase();
      const rows = K.dossierList(S, null, { q, withArchived: true }).slice(0, 30).map(r => ({
        kind: 'client', main: r.name,
        sub: [r.matricule, r.missingCount ? pl(r.missingCount, 'mois', 'mois') + ' manquant' + (r.missingCount > 1 ? 's' : '') : ''].filter(Boolean).join(' · '),
        go: () => { location.hash = '#/dossier/' + encodeURIComponent(r.id); }
      }));
      // Les écrans de comptabilité, en couples client + écran : « balance » sur une fiche ouvre SA
      // balance, « béji balance » celle de Béji. Un écran du livre sur un dossier dont on SAIT qu'il
      // n'a pas de livre le dit : l'adresse le ramènerait au livre-journal, où le bouton qui crée le
      // livre attend.
      const ecrans = K.paletteCompta(brut, ecransPalette, S.dossiers, courantId).map(p => {
        const sansLivre = p.dossierId === livresState.dossierId && livresState.livreEtat === 'absent' && !ONGLETS_SANS_LIVRE.includes(p.ecran);
        return {
          kind: 'écran', main: `${ONGLETS_COMPTA[p.ecran]} — ${p.dossierNom}`,
          sub: sansLivre ? 'Comptabilité › s\'ouvre une fois son livre créé' : `Comptabilité › ${groupeCompta(p.ecran).label}`,
          go: () => { location.hash = adresseCompta({ id: p.dossierId }, p.ecran); }
        };
      });
      // On cherche aussi dans les synonymes : « backup », « token », « cle de secours » ne figurent
      // dans aucun libellé, et deux réponses vides suffisent à faire croire que la palette ne
      // connaît pas l'application.
      const qa = K.sansAccents(brut);
      const acts = actions.filter(a => !qa || K.sansAccents(a.main).includes(qa) || (a.text || '').includes(qa));
      items = ecrans.concat(rows, acts, qa ? aidesPour(qa) : []);
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
  // L'écran vit dans `src/renderer/majui.js` depuis le 23/09/2026, le même que celui de l'app
  // entreprise (« le même workflow que Apple », Skander). Ici ne restent que le jeton d'accès, la
  // panne de relais et les branchements.
  const ICONE_CAB = '<span class="brand-mark cab"><svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span>';
  function drawUpdatePanel() {
    const el = $('#upd-panel'); if (!el) return;
    const a = upd.app || {};
    const macNonSigne = a.platform === 'darwin' && !a.macSigned;
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
      // La ligne « Mises à jour automatiques — Activées » le dit déjà (23/09/2026).
      ? ''
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
    </div>` : '');

    el.innerHTML = MajUI.panneau({
      p: 'u', nom: 'SkanFact Cabinet', icone: ICONE_CAB, a, u: upd,
      notes: notesMaj(upd.notes), quand: quandVerif(a.lastCheck), macNonSigne,
      tokenManquant: !a.relay && a.private && (upd.state === 'token' || !a.hasToken),
      heures: a.autoEvery ? Math.round(a.autoEvery / 3600000) : 0,
      canaux: upd.canaux, aideEssai: info('u.essai'), fin: jeton
    });

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
    if ($('#u-releases')) $('#u-releases').onclick = () => api.updOpenReleases();
    if ($('#u-log')) $('#u-log').onclick = () => api.openLog();
    if ($('#u-beta')) $('#u-beta').onchange = async (ev) => {
      const on = ev.target.checked;
      if (on) {
        const ok = await confirmDialog('Recevoir les versions d\'essai',
          '<p>Les versions d\'essai arrivent avant les autres et peuvent contenir des défauts.</p>' +
          '<p class="small">Elles s\'installent <b>par-dessus SkanFact Cabinet</b> et travaillent sur les mêmes dossiers, les mêmes paquets et la même clé. Une sauvegarde va être prise tout de suite, avant tout changement.</p>' +
          '<p class="small">Tu pourras revenir au canal normal à tout moment en désactivant « Versions d\'essai ».</p>',
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
    if ($('#u-install')) $('#u-install').onclick = () => installerMaj($('#u-install'));
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
    // Le panneau vient d'APPARAÎTRE (un nouvel élément, pas un redessin par un événement) : on
    // relit les canaux et on cherche, comme macOS quand on ouvre « Mise à jour de logiciels ».
    const neuf = !el.dataset.monte;
    el.dataset.monte = '1';
    if (!upd.app) relire().then(ouvrirPanneauMaj);
    else if (neuf) ouvrirPanneauMaj();
  }

  async function installerMaj(b) {
    // U-09 : redémarrer pour installer ferme l'application SANS passer par la question de la
    // fermeture (l'installeur de Windows arrête le processus, le script de macOS attend sa fin). On
    // pose donc la même question AVANT, ici.
    const enCours = nomsDesSaisies();
    let force = false;
    if (enCours.length) {
      const ok = await confirmDialog(
        enCours.length > 1 ? 'Des pièces ne sont pas enregistrées' : 'Une pièce n\'est pas enregistrée',
        `<p>${enCours.length > 1
          ? `Des pièces commencées ne sont pas enregistrées : <b>${enCours.map(esc).join('</b>, <b>')}</b>.`
          : `Une pièce commencée pour <b>${esc(enCours[0])}</b> n'est pas enregistrée.`}
          Redémarrer maintenant la perd. Enregistre-la en brouillard d'abord : elle ne prend aucun numéro.</p>`,
        'Redémarrer sans l\'enregistrer', true);
      if (!ok) return;
      force = true;
    }
    if (b) { b.disabled = true; b.textContent = 'Redémarrage…'; }
    const r = await api.updInstall(force ? { force: true } : undefined);
    if (r && r.state === 'error') { upd.state = 'error'; upd.message = r.message; upd.detail = r.detail || ''; upd.soft = !!r.soft; drawUpdatePanel(); }
  }

  // Les notes de version (le CHANGELOG, en Markdown) rendues par le module partagé.
  const notesMaj = md => MajUI.notesHtml(md);

  // À l'ouverture du panneau, comme macOS : la vraie dernière version d'essai publiée, et une
  // recherche si la dernière date.
  function ouvrirPanneauMaj() {
    api.updCanaux().then(c => { upd.canaux = c || null; drawUpdatePanel(); }).catch(() => {});
    const a = upd.app || {};
    if (a.packaged && (!upd.state || upd.state === 'idle' || upd.state === 'none') && Date.now() - (a.lastCheck || 0) > 60 * 1000) {
      const b = $('#u-check'); if (b) b.click();
    }
  }

  // La fenêtre de Sparkle, une fois par version et par jour au plus (voir majui.js).
  function proposerInstallation(ev) {
    const p = $('#upd-panel');
    if (p && p.offsetParent) return;
    if (document.querySelector('#modal-root .modal')) return;
    const lire = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
    const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* rappel perdu, rien de grave */ } };
    if (!MajUI.doitProposer(ev.version, lire, Date.now())) return;
    MajUI.noterProposee(ev.version, ecrire, Date.now());
    const a = upd.app || {};
    modal(MajUI.fenetrePrete({
      nom: 'SkanFact Cabinet', icone: ICONE_CAB, version: ev.version, installee: a.version,
      notes: notesMaj(ev.notes || upd.notes), macNonSigne: a.platform === 'darwin' && !a.macSigned
    }), (root, close) => { $('#maj-go', root).onclick = () => { close(); installerMaj(); }; });
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

  // Accents ignorés (10.12.0, U-08) : « declaration » tapé sans accent ne trouvait pas « La déclaration
  // du mois » — la même règle que la recherche des clients, qui l'applique depuis la 6.8.1.
  function aideTrouves(q) {
    const mots = K.sansAccents(q).trim().split(/\s+/).filter(Boolean);
    if (!mots.length) return G.ARTICLES;
    const notes = [];
    G.ARTICLES.forEach((a, i) => {
      const titre = K.sansAccents(`${a.t} ${a.s || ''}`);
      const corps = K.sansAccents(sansBalises(a.d));
      if (!mots.every(m => titre.includes(m) || corps.includes(m))) return;
      notes.push({ a, rang: mots.every(m => titre.includes(m)) ? 0 : 1, i });
    });
    return notes.sort((x, y) => x.rang - y.rang || x.i - y.i).map(x => x.a);
  }

  const aideCarte = a => `<button class="help-art grande ${esc(a.couleur || '')}" data-art="${esc(a.id)}">
      <span class="ht"><span class="ha-ico">${aideIcone(a)}</span>${esc(a.t)}</span>
      <span class="hs">${esc(a.s || '')}</span></button>`;

  // Le chemin d'un écran VIDE vers l'article qui l'explique (10.12.0, U-08) : c'est le jour où
  // l'écran est vide qu'on a le plus besoin de l'article — et la bulle de son titre n'existe pas
  // encore, puisque le titre n'apparaît qu'avec la première ligne.
  const lienArticle = id => {
    const a = G.ARTICLES.find(x => x.id === id);
    return a ? `<a class="lien-aide" href="#/aide/${esc(id)}">Comment ça marche : « ${esc(a.t)} » →</a>` : '';
  };

  // Le geste qui finit un article (7.27.0 côté entreprise, 7.28.0 ici). Un écran de comptabilité
  // n'a pas d'adresse à lui seul : il vit dans CHAQUE dossier. Le geste mène donc à celui du dossier
  // ouvert en dernier — en le nommant, pour qu'on sache où l'on va — et, quand aucun ne l'a été, fait
  // choisir le dossier plutôt que d'en deviner un (10.12.0, U-08).
  function gesteAide(g) {
    const pourquoi = '<span class="small muted">On lit une explication pour faire quelque chose.</span>';
    if (g.ecran) {
      const d = (S.dossiers || []).find(x => x.id === livresState.dossierId && !x.archived);
      // Un écran du livre sur un dossier qui n'en a pas : le bouton ne promet pas un écran que
      // l'adresse ramènerait au livre-journal — il mène à la comptabilité, où l'on crée le livre.
      if (d && livresState.livreEtat === 'absent' && !ONGLETS_SANS_LIVRE.includes(g.ecran)) {
        return `<button class="btn btn-primary" data-ecran="journal" data-dossier="${esc(d.id)}">Ouvrir la comptabilité ${esc(K.de(d.name))}</button>
          <span class="small muted">${esc(ONGLETS_COMPTA[g.ecran] || '')} s'ouvre une fois son livre créé : le bouton qui le crée est en tête de sa comptabilité.</span>`;
      }
      if (d) return `<button class="btn btn-primary" data-ecran="${esc(g.ecran)}" data-dossier="${esc(d.id)}">${esc(g.label)} ${esc(K.de(d.name))}</button>${pourquoi}`;
      return `<button class="btn btn-primary" data-geste="#/">Choisir le dossier</button>
        <span class="small muted">${esc(ONGLETS_COMPTA[g.ecran] || '')} vit dans chaque dossier, onglet Comptabilité.</span>`;
    }
    return `<button class="btn btn-primary" data-geste="${esc(g.hash)}"${g.panneau ? ` data-panneau="${esc(g.panneau)}"` : ''}>${esc(g.label)}</button>${pourquoi}`;
  }

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
        ${/* 10.12.0 (U-30) — la loupe vit AVEC le champ. Centrée sur le bloc entier, elle
              descendait sous la ligne du texte dès que le compte des résultats s'affichait. */''}
        <span class="hs-champ"><svg class="hs-loupe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/></svg>
        <input type="search" id="aide-q" placeholder="Rechercher : un mot, une question… (« empreinte », « clé de secours »)" autocomplete="off" spellcheck="false" value="${esc(aideQ)}"></span>
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
              ${a.geste ? `<div class="help-geste">${gesteAide(a.geste)}</div>` : ''}
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
      $$('[data-ecran]').forEach(b => b.onclick = () => { location.hash = adresseCompta({ id: b.dataset.dossier }, b.dataset.ecran); });
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
      // 10.12.0 (U-30) — la phrase suit ce qu'on a TAPÉ : « Essaie un seul mot » après un seul mot
      // demandait l'impossible. Plusieurs mots : chacun doit être dans l'article, on le dit. Un seul :
      // on le nomme. Et le refus a sa sortie (règle 7.0.0) — revenir aux articles d'un clic.
      const nMots = mots.split(/\s+/).filter(Boolean).length;
      res.innerHTML = trouves.length
        ? `<div class="help-arts help-res">${trouves.map(aideCarte).join('')}</div>`
        : `<div class="empty"><p>${nMots > 1
          ? 'Aucun article ne contient tous ces mots — chacun doit s\'y trouver. Essaie-les un par un.'
          : `Aucun article ne parle de « ${esc(mots)} ». Essaie un mot voisin, ou parcours les articles.`}</p>
          <div class="inline mt"><button type="button" class="btn btn-sm" id="aide-effacer">Revenir aux ${esc(pl(G.ARTICLES.length, 'article'))}</button></div></div>`;
      const effacer = $('#aide-effacer');
      if (effacer) effacer.onclick = () => { q.value = ''; chercher(); q.focus(); };
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
