// Le menu d'actions d'une ligne de liste — PARTAGÉ par les deux applications.
//
// Il est né dans l'app entreprise en 7.28.0 : une ligne finissait par cinq boutons qui se
// disputaient la place et tombaient dans des pictogrammes muets (« ⧉ », « ⏱ ») dès qu'ils étaient
// trop nombreux, jusqu'à sortir de l'écran à 1280 px. Un menu, lui, occupe la largeur d'un bouton
// quoi qu'il contienne, et chaque action y porte une phrase plus une explication.
//
// Il vit ici, dans un fichier à part, parce que l'app du cabinet avait EXACTEMENT le même défaut —
// cinq boutons fantômes par ligne d'historique, dont un « ✕ » muet qui supprime un paquet reçu —
// et qu'une règle apprise d'un côté se vérifie de l'autre (règle 7.3.0). Le recopier aurait garanti
// la divergence : la table d'icônes du cabinet aurait un jour un dessin que l'autre n'a pas.
//
// Les deux applications chargent déjà `style.css` en commun ; elles chargent maintenant ce fichier
// de la même façon. Il ne connaît RIEN du métier : ni données, ni sauvegarde, ni navigation. Il
// reçoit des actions toutes faites et les affiche.
(function (global) {
  'use strict';

  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  // Sa propre échappement : l'app entreprise l'appelle `h`, celle du cabinet `esc`. Dépendre de
  // l'une des deux ferait planter l'autre au premier rendu — et un `h is not defined` dans un
  // gabarit ne laisse aucune trace ailleurs que dans une fenêtre qui ne s'ouvre pas (6.8.0).
  const ECH = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ECH[c]);

  // Même trait que les icônes de la barre latérale — 24×24, contour, pas de remplissage : une icône
  // dessinée autrement se lit comme un corps étranger. Elles ACCOMPAGNENT le libellé, elles ne le
  // remplacent jamais : c'est le pictogramme SEUL qui avait rendu les anciennes rangées illisibles.
  const ICO = {
    ouvrir: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h4"/>',
    pdf: '<path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M4 19h16"/>',
    email: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    argent: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M5.5 12h.6M17.9 12h.6"/>',
    facture: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    oui: '<circle cx="12" cy="12" r="9"/><path d="M8 12.4l2.6 2.6L16 9.6"/>',
    non: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    client: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    modifier: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
    nouveau: '<path d="M12 5v14M5 12h14"/>',
    cloche: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    telephone: '<path d="M4 4h4l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 2 6a2 2 0 0 1 2-2z"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 1.9"/>',
    panier: '<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>',
    fournisseur: '<path d="M3 9l2-5h14l2 5"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/>',
    copier: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
    stock: '<path d="M3 8l9-4 9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4"/><path d="M12 12v8"/>',
    contrat: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
    reprendre: '<circle cx="12" cy="12" r="9"/><path d="M10.4 8.4l5.4 3.6-5.4 3.6z"/>',
    texte: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    dossier: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    extraire: '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    loupe: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    restaurer: '<path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 3v6h6"/>',
    supprimer: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13h10l1-13"/>'
  };
  // Une action sans icône garde quand même sa colonne : sans le vide, les libellés du menu ne
  // s'alignent plus les uns sous les autres et la liste paraît bancale.
  const ico = nom => ICO[nom] ? `<svg class="rm-i" viewBox="0 0 24 24" aria-hidden="true">${ICO[nom]}</svg>` : '<span class="rm-i"></span>';

  // « ⋮ » ne dit pas ce qu'il fait : trois points ne se lisent que si on connaît déjà la convention,
  // et c'était devenu la SEULE porte de la ligne. Le bouton porte donc le mot « Actions », et le
  // chevron annonce qu'il ouvre sur un choix.
  const CHEVRON = '<svg class="rm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>';

  // Les surfaces qu'on a le droit de cliquer SANS que l'overlay ouvert se referme. Le bouton du
  // menu en fait partie, et c'est ce qui en fait un INTERRUPTEUR : sans lui, le garde-fou global
  // fermait le menu au `mousedown` et le `click` le rouvrait dans la foulée.
  // `.sugg-host` : la cellule dont la désignation propose le catalogue (app entreprise, 9.2.1) —
  // le champ ET sa liste, sinon replacer le curseur dans le champ fermerait la liste.
  // `.lm-pop` : la liste déroulante de SkanFact posée sur un `<select>` (listes.js, 10.13.0).
  const SURFACES = '.combo, .datefield, .row-menu, .row-menu-btn, .sugg-host, .lm-pop';

  // L'application hôte prête son registre d'overlay : c'est lui qui garantit qu'un calendrier, une
  // liste déroulante et un menu ne restent jamais ouverts en même temps. L'app du cabinet n'a pas
  // d'autre overlay — son registre par défaut suffit.
  let registre = (() => { let f = null; return { lire: () => f, poser: x => { f = x; } }; })();
  function brancher(r) { registre = r; }

  // `avant` : le SEUL bouton qu'une ligne a le droit de garder toujours visible, quand une page
  // existe pour un geste précis (la page Relances existe pour écrire des relances). Tout le reste
  // passe par le menu. Un au maximum : c'est la règle qui a mis fin aux rangées de cinq.
  // Le bouton seul, sans sa cellule. Il sert dans une barre d'actions (l'en-tête d'une fiche du
  // Cabinet, 9.4.8), là où il n'y a pas de tableau autour. `cellule` l'appelle, donc les deux ne
  // peuvent pas diverger — une seconde version recopiée aurait perdu le `aria-expanded` ou le
  // `data-rowmenu` au premier ajustement (règle 7.29.0).
  const bouton = (id, libelle, classe) => `<button type="button" class="row-menu-btn${classe ? ' ' + classe : ''}" data-rowmenu="${h(id)}" aria-haspopup="menu" aria-expanded="false" title="Ce qu'on peut faire ici">${h(libelle || 'Actions')}${CHEVRON}</button>`;
  const cellule = (id, avant) => `<td class="actions row-actions">${avant || ''}${bouton(id, 'Actions')}</td>`;

  // `actionsDe(id)` rend les actions de CETTE ligne : { icon, label, hint, danger, run } ou { sep: true }.
  //
  // Une racine ne juge que SES lignes (10.12.0, trouvé en testant comme un humain). La fiche d'un
  // client pose sa table sur toute la vue, qui CONTIENT le livre-journal — lequel a sa propre table.
  // La fiche ne connaît pas les pièces : elle leur rendait « aucune action », et la règle qui suit
  // (une ligne sans action perd son bouton) retirait le menu de chaque pièce. Selon l'ordre des deux
  // dessins, le journal s'ouvrait avec ou sans ses actions — sans une erreur nulle part. Une racine
  // qui a posé sa table le dit (`data-menus`) ; celle du dessus passe son chemin sur ses boutons.
  // C'est la troisième fois que deux tables se mangent (9.4.8, 10.2.0) : la règle vit ici, une fois.
  function brancherMenus(racine, actionsDe) {
    const r = racine || document;
    if (r.setAttribute) r.setAttribute('data-menus', '');
    $$('[data-rowmenu]', r).forEach(b => {
      const proprio = b.parentElement ? b.parentElement.closest('[data-menus]') : null;
      if (proprio && proprio !== r) return;
      const actions = (actionsDe(b.dataset.rowmenu) || []).filter(Boolean);
      const reelles = actions.filter(a => !a.sep);
      // Une ligne sans action perd son bouton : un menu vide est pire qu'un menu absent — c'est
      // encore un bouton qui accepte le clic et n'en fait rien (règle 7.0.0).
      if (!reelles.length) { b.remove(); return; }
      // Une SEULE action : un vrai bouton qui la nomme, pas un menu. Ouvrir une liste pour un choix
      // unique, c'est un clic et une lecture de plus pour rien — et le libellé, lui, se lit sans
      // avoir à ouvrir quoi que ce soit.
      // `court` (10.12.0, vu au test humain) : dans un tableau DENSE, l'action seule prend la largeur
      // de sa phrase. Une pièce contre-passée ne gardait que « Joindre un justificatif… » : 203 px,
      // et la colonne d'actions collante recouvrait le Crédit du livre-journal. Le bouton porte alors
      // le mot court ; la phrase entière reste dans l'infobulle et dans ce que lit un lecteur d'écran.
      if (reelles.length === 1) {
        const a = reelles[0];
        b.classList.add('row-menu-solo');
        b.removeAttribute('aria-haspopup'); b.removeAttribute('aria-expanded');
        b.title = a.court ? [a.label, a.hint].filter(Boolean).join(' — ') : (a.hint || a.label);
        if (a.court) b.setAttribute('aria-label', a.label);
        b.innerHTML = `${ico(a.icon)}<span>${h(a.court || a.label)}</span>`;
        b.onclick = e => { e.stopPropagation(); a.run(); };
        return;
      }
      b.onclick = e => { e.stopPropagation(); ouvrir(b, actions); };
    });
  }

  let ouvertSur = null;   // le bouton dont le menu est ouvert : sans ça, un reclic le rouvre

  function ouvrir(bouton, actions) {
    // Un second clic sur le MÊME bouton REFERME. Sans ce test, le garde-fou `mousedown` global
    // fermait le menu puis le `click` le rouvrait aussitôt : on appuyait pour fermer, ça clignotait,
    // et le menu restait ouvert. Un bouton qui ne fait pas le contraire de ce qu'il vient de faire
    // n'est pas un interrupteur.
    const dejaOuvert = registre.lire();
    if (ouvertSur === bouton) { if (dejaOuvert) dejaOuvert(); return; }
    if (dejaOuvert) dejaOuvert();
    const m = document.createElement('div');
    m.className = 'row-menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = actions.map((a, i) => a.sep ? '<hr>'
      : `<button type="button" role="menuitem" data-i="${i}"${a.danger ? ' class="danger"' : ''}>
          ${ico(a.icon)}<span class="rm-t"><span class="rm-l">${h(a.label)}</span>${a.hint ? `<span class="rm-h">${h(a.hint)}</span>` : ''}</span></button>`).join('');
    document.body.appendChild(m);
    // Un menu ouvert DANS une fenêtre passe au-dessus d'elle (10.14.1, S-04) : à sa couche 70, il
    // naissait SOUS la fenêtre (400 et plus) — ouvert, invisible, et le clic suivant tombait dessus.
    // Juste au-dessus de SA fenêtre : une question que l'action ouvrira se pose encore par-dessus.
    const couche = bouton.closest('.modal-bg');
    if (couche) m.style.zIndex = String((Number(getComputedStyle(couche).zIndex) || 400) + 1);
    // On mesure APRÈS avoir posé le menu : sa hauteur dépend de ce qu'il contient, et une ligne du
    // bas de l'écran doit le voir s'ouvrir vers le haut plutôt que hors de la fenêtre.
    const r = bouton.getBoundingClientRect();
    const haut = m.offsetHeight, large = m.offsetWidth;
    m.style.top = (r.bottom + 6 + haut <= window.innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - 6 - haut)) + 'px';
    m.style.left = Math.max(8, Math.min(window.innerWidth - large - 8, r.right - large)) + 'px';
    bouton.setAttribute('aria-expanded', 'true');
    const scroller = bouton.closest('main');
    // La position de départ du défilement. Un menu ancré sur une ligne se ferme quand la page
    // défile — c'est voulu, sinon il flotterait loin de sa ligne. Mais un événement `scroll` en
    // RETARD (celui qui a amené le bouton à l'écran juste avant le clic, livré à la frame suivante)
    // arrivait après l'ouverture et refermait le menu dans la milliseconde : il s'ouvrait et
    // disparaissait, sans que rien ne le signale. On ne ferme donc que si la page a VRAIMENT bougé
    // depuis l'ouverture.
    const depart = scroller ? scroller.scrollTop : 0;
    const siDefile = () => { if (!scroller || Math.abs(scroller.scrollTop - depart) > 4) close(); };
    ouvertSur = bouton;
    const close = () => {
      m.remove(); bouton.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', dehors, true);
      document.removeEventListener('keydown', clavier, true);
      window.removeEventListener('resize', close);
      if (scroller) scroller.removeEventListener('scroll', siDefile);
      if (registre.lire() === close) registre.poser(null);
      // Sous condition : `close` peut être rappelé (redimensionnement puis clic) alors qu'un AUTRE
      // menu est déjà ouvert, et l'effacer sans regarder rendrait ce dernier impossible à refermer.
      if (ouvertSur === bouton) ouvertSur = null;
    };
    const dehors = e => { if (!m.contains(e.target) && !bouton.contains(e.target)) close(); };
    // Un `role="menu"` se parcourt aux flèches : sans elles, le clavier oblige à tabuler à travers
    // toute la page pour atteindre la deuxième entrée.
    const clavier = e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); bouton.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      const items = $$('button[data-i]', m);
      if (!items.length) return;
      e.preventDefault(); e.stopPropagation();
      const ici = items.indexOf(document.activeElement);
      const suivant = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
        : e.key === 'ArrowDown' ? (ici + 1) % items.length
        : (ici <= 0 ? items.length : ici) - 1;
      items[suivant].focus();
    };
    document.addEventListener('mousedown', dehors, true);
    document.addEventListener('keydown', clavier, true);
    window.addEventListener('resize', close);
    if (scroller) scroller.addEventListener('scroll', siDefile);
    registre.poser(close);
    // On ferme AVANT d'exécuter : une action qui ouvre une fenêtre laisserait sinon le menu dessous,
    // et une action qui redessine la page détacherait le menu sans jamais le retirer du document.
    $$('button[data-i]', m).forEach(b => b.onclick = () => { const a = actions[Number(b.dataset.i)]; close(); a.run(); });
    const premier = m.querySelector('button'); if (premier) premier.focus();
  }

  global.RowMenu = { ICO, ico, SURFACES, brancher, cellule, bouton, brancherMenus };
})(typeof window !== 'undefined' ? window : globalThis);
