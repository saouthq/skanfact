// La visite guidée — le MOTEUR, sans aucun métier (10.14.0).
//
// Skander, le 24/09/2026 : « on part du principe que quelqu'un qui découvre l'application n'a pas
// envie de lire la page Aide, donc il faut pouvoir toujours le guider pour chaque étape afin de faire
// quelque chose, et il faut couvrir toute l'app » — puis : « quelque chose de premium et complet qui
// couvre la totalité des deux applications, qui couvre tous les boutons ». L'Aide explique ; la
// visite MONTRE où cliquer, sur le vrai écran, et attend qu'on l'ait fait avant de passer à la suite.
//
// Trois sortes d'étapes :
//   - « regarder » : la cible est éclairée, le reste de l'écran s'assombrit, on lit, on fait Suivant ;
//   - « liste » : une ZONE est éclairée (une barre d'actions, des filtres, un formulaire) et la bulle
//     nomme et explique CHACUN de ses contrôles ; survoler une ligne de la bulle éclaire le bouton dont
//     elle parle. C'est ce qui permet d'expliquer tous les boutons sans cent étapes : l'explication
//     vient de l'hôte (`expliquer`), qui lit un dictionnaire et les bulles « i » — et un contrôle que
//     personne n'explique est trouvé par l'instrument de couverture, pas par un client ;
//   - « faire » : rien ne s'assombrit (les listes déroulantes, les calendriers et les fenêtres doivent
//     rester utilisables), un anneau pulse autour de la cible, la bulle dit « À toi : … », et l'étape
//     suivante n'arrive que quand le geste a eu lieu — un clic sur la cible, ou un état qu'on vérifie.
//
// Ce qui rend un débutant « jamais perdu », et qui est écrit ici plutôt qu'à chaque visite :
//   - on n'est jamais ENFERMÉ : rien n'empêche de cliquer ailleurs, et la bulle a toujours de quoi
//     passer l'étape, passer le chapitre ou arrêter ;
//   - on n'est jamais LAISSÉ SEUL : si la cible disparaît (on a quitté la page, fermé la fenêtre), la
//     bulle le dit et propose d'y retourner, au lieu de flotter sur un écran qui ne la concerne plus ;
//   - on sait toujours où l'on en est : « Chapitre 2 sur 9 · Vendre », « Étape 3 sur 7 », et la fin
//     propose la suite logique.
//
// Il ne connaît RIEN de SkanFact — pas de données, pas de routeur — comme `rowmenu.js` : l'hôte lui
// prête de quoi naviguer et expliquer, et chaque visite apporte ses cibles et ses conditions. C'est ce
// qui le rend partageable avec l'application du cabinet (un fichier partagé : trois branchements).
//
// Les couches (règle 5.2.2) : l'assombrissement vit SOUS les fenêtres (390, une fenêtre 400 et plus
// garde sa lisibilité), les anneaux et la bulle AU-DESSUS (891, 892) pour pouvoir désigner un champ
// d'une fenêtre, et sous la bulle « i » (900) et le message passager (950), qui se lisent par-dessus.
(function (global) {
  'use strict';

  const ECH = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ECH[c]);

  // Le délai avant de dire « je ne trouve pas » : une fenêtre qui s'ouvre, un PDF qui se fabrique,
  // une page asynchrone (les Paramètres attendent le disque) — trois secondes et demie couvrent le
  // cas lent sans laisser quelqu'un devant une bulle qui ne désigne rien.
  const PATIENCE = 3500;
  // Une étape FACULTATIVE (une zone que la page n'a pas toujours : des filtres sur une liste vide, un
  // tableau sans ligne) se saute d'elle-même quand sa cible n'est pas venue — plus vite que la
  // patience d'une étape obligatoire, parce qu'il n'y a rien à attendre.
  const PATIENCE_FACULTATIVE = 900;
  const MARGE = 12, ECART = 14;
  // Les contrôles qu'une étape « liste » énumère dans sa zone. Les bulles « i » n'en sont pas : elles
  // EXPLIQUENT, on ne les explique pas.
  const CONTROLES = 'button, a[href], select, textarea, input:not([type=hidden]), [role=button], [role=tab]';

  // ---------- placement (PUR : c'est lui que les tests jouent) ----------
  // La bulle ne recouvre JAMAIS la cible, reste dans l'écran, et se pose d'abord du côté demandé.
  // Pour une étape « faire » sur un champ, on réserve la place SOUS la cible : c'est là que s'ouvrent
  // les listes déroulantes et le calendrier — une bulle posée dessous les cacherait au moment où l'on
  // en a besoin (la règle H-E20 : rien ne se pose sous le prochain clic).
  function placerBulle(cible, bulle, ecran, opts) {
    opts = opts || {};
    const W = ecran.w, H = ecran.h, bw = bulle.w, bh = bulle.h;
    const borne = (v, min, max) => Math.max(min, Math.min(v, max));
    if (!cible) return { x: Math.round((W - bw) / 2), y: Math.round(Math.max(MARGE, (H - bh) * 0.38)), cote: 'centre' };
    const reserve = opts.reserveDessous ? Math.min(260, H * 0.35) : 0;
    const zone = { l: cible.l, t: cible.t, r: cible.r, b: cible.b + reserve };
    const midY = borne(cible.t + (cible.b - cible.t) / 2 - bh / 2, MARGE, H - MARGE - bh);
    const midX = borne(cible.l + (cible.r - cible.l) / 2 - bw / 2, MARGE, W - MARGE - bw);
    const essais = {
      droite: () => ({ x: zone.r + ECART, y: midY, ok: zone.r + ECART + bw <= W - MARGE }),
      gauche: () => ({ x: zone.l - ECART - bw, y: midY, ok: zone.l - ECART - bw >= MARGE }),
      dessous: () => ({ x: midX, y: zone.b + ECART, ok: zone.b + ECART + bh <= H - MARGE }),
      dessus: () => ({ x: midX, y: zone.t - ECART - bh, ok: zone.t - ECART - bh >= MARGE })
    };
    const ordre = (opts.cotes || [opts.pref, 'droite', 'gauche', 'dessous', 'dessus']).filter((c, i, a) => c && essais[c] && a.indexOf(c) === i);
    for (const c of ordre) {
      const p = essais[c]();
      if (p.ok) return { x: Math.round(p.x), y: Math.round(p.y), cote: c };
    }
    // Des côtés IMPOSÉS qui ne tiennent pas : l'appelant a un autre plan (`placerPres`).
    if (opts.cotes) return null;
    // Rien ne tient à côté (une cible qui occupe presque tout l'écran, une grande fenêtre) : dans le
    // coin le plus éloigné du centre de la cible, sans jamais sortir de l'écran.
    const cx = (cible.l + cible.r) / 2, cy = (cible.t + cible.b) / 2;
    const x = cx > W / 2 ? MARGE : W - MARGE - bw;
    const y = cy > H / 2 ? MARGE : H - MARGE - bh;
    return { x: Math.round(Math.max(MARGE, x)), y: Math.round(Math.max(MARGE, y)), cote: 'coin' };
  }

  // Une cible DANS une fenêtre (PUR : les tests le jouent) : la bulle se pose à côté de la FENÊTRE, à
  // la hauteur de la cible — jamais sur la fenêtre, où l'on relit ce qu'on vient de taper. Vu à
  // l'écran (10.14.0) : « Enregistrer ta réponse », posée au-dessus du bouton, couvrait la réponse et
  // la question qu'elle demandait d'enregistrer. Sans place ni à droite ni à gauche de la fenêtre (une
  // grande fenêtre sur un petit écran), la règle ordinaire autour de la cible.
  function placerPres(r, fen, bulle, ecran, opts) {
    opts = opts || {};
    if (r && fen) {
      const cotes = opts.pref === 'gauche' ? ['gauche', 'droite'] : ['droite', 'gauche'];
      const p = placerBulle({ l: fen.l, r: fen.r, t: r.t, b: r.b }, bulle, ecran, { cotes });
      if (p) return p;
    }
    return placerBulle(r, bulle, ecran, opts);
  }

  // Où poser le HAUT d'une cible pour que la bulle tienne à côté d'elle (PUR : les tests le jouent) —
  // ou null quand elle tient déjà, ou ne tiendra jamais. Centrée à l'écran, une zone large et haute
  // (le tableau des questions du comptable, un panneau) ne laissait assez de place ni dessus ni
  // dessous : la bulle se rabattait dans un coin, sur le bouton même dont elle parlait — « Importer
  // les questions de ton comptable » (vu à l'écran, 10.14.0). S'ils tiennent ensemble dans la
  // hauteur, on fait défiler pour libérer le côté demandé ; dessous sinon, sous l'en-tête de la page.
  // Avec du JEU : la page défile au pixel entier, les rectangles ne tombent pas juste — viser la
  // limite exacte laissait la bulle à 0,28 px de sa place, et elle retournait dans le coin (vu à
  // l'écran, la première version).
  const JEU = 8;
  function hautPourBulle(r, bulle, ecran, pref) {
    const W = ecran.w, H = ecran.h, bw = bulle.w, bh = bulle.h;
    if (!r || !bh) return null;
    const aCote = r.r + ECART + bw <= W - MARGE || r.l - ECART - bw >= MARGE;
    const dessus = r.t - ECART - bh >= MARGE, dessous = r.b + ECART + bh <= H - MARGE;
    if (aCote || dessus || dessous) return null;
    const hauteur = r.b - r.t;
    if (hauteur + ECART + bh + 2 * MARGE + JEU > H) return null;
    return pref === 'dessus' ? MARGE + bh + ECART + JEU : Math.min(MARGE + 48, H - MARGE - bh - ECART - hauteur - JEU);
  }

  // Une zone LARGE qu'aucun défilement ne sépare de sa bulle (PUR : les tests le jouent) : plus haute
  // que ce que l'écran laisse une fois la bulle posée, mais pas assez pour la règle des blocs géants.
  // `hautPourBulle` renonçait (« ne tiendra jamais ») et la bulle se rabattait dans un coin, SUR le
  // titre du panneau qu'elle présentait — « Les sauvegardes » du Cabinet (vu à la souris, 10.14.0).
  // On amène alors son haut sous l'en-tête de la page, et on n'en éclaire que ce qui laisse la place
  // de la bulle dessous (`decouperHaut` avec la hauteur de la bulle). Rend le haut visé, ou null.
  function hautPourCouper(r, bulle, ecran) {
    const W = ecran.w, H = ecran.h, bw = bulle.w, bh = bulle.h;
    if (!r || !bh || r.r - r.l <= W * 0.45) return null;
    const aCote = r.r + ECART + bw <= W - MARGE || r.l - ECART - bw >= MARGE;
    const dessus = r.t - ECART - bh >= MARGE, dessous = r.b + ECART + bh <= H - MARGE;
    if (aCote || dessus || dessous) return null;
    if (hautPourBulle(r, bulle, ecran) != null) return null;
    return MARGE + 48;
  }

  // La ponctuation double porte une espace FINE INSÉCABLE (PUR : les tests le jouent). Sans elle, le
  // navigateur coupe juste avant « ? », ou laisse un « seul en fin de ligne et son mot sur la
  // suivante (vu à l'écran, 10.14.0 : « Dossier » séparé de son guillemet, dans une bulle). C'est la
  // règle `typographie()` du Cabinet (9.4.2) ; `typographier` ne touche que les NŒUDS DE TEXTE de la
  // bulle — aucune balise, aucun attribut.
  const FINE = '\u202f';
  const typo = t => String(t).replace(/ ([?!;:»])/g, FINE + '$1').replace(/« /g, '«' + FINE);
  function typographier(racine) {
    if (!racine || typeof document === 'undefined' || !document.createTreeWalker) return;
    const it = document.createTreeWalker(racine, 4 /* NodeFilter.SHOW_TEXT */);
    let n;
    while ((n = it.nextNode())) { const v = n.nodeValue; if (/ [?!;:»]|« /.test(v)) n.nodeValue = typo(v); }
  }

  // Deux rectangles se chevauchent-ils ? (pour les tests : la bulle ne couvre jamais sa cible)
  const chevauche = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  // Le HAUT d'un bloc trop grand pour laisser un côté libre (PUR : les tests le jouent). On garde
  // entre 240 px et 44 % de l'écran à partir de son bord visible — assez pour lire un en-tête de
  // tableau et trois lignes, et il reste la place d'une bulle dessous.
  function decouperHaut(r, H, bh) {
    const haut = Math.max(r.t, 0);
    // Avec la hauteur de la bulle : on s'arrête là où elle tient encore dessous (`hautPourCouper`).
    const place = bh ? H - MARGE - ECART - bh - JEU : Infinity;
    return { l: r.l, r: r.r, t: r.t, b: Math.min(r.b, haut + Math.max(240, Math.round(H * 0.44)), Math.max(haut + 120, place)) };
  }

  // Une étape est-elle « faire » ? Une seule définition, pour le dessin ET pour les tests.
  const estFaire = e => !!(e && (e.faire === 'clic' || e.faire === 'valeur' || typeof e.fait === 'function' && e.faire !== 'regarder'));

  // Les CHAPITRES d'une visite (PUR) : une étape qui porte `chapitre` en ouvre un, les suivantes en
  // font partie jusqu'au prochain. Une visite sans chapitre en a un seul, sans titre.
  function chapitres(etapes) {
    const out = [];
    (etapes || []).forEach((e, i) => {
      if (i === 0 || (e && e.chapitre)) out.push({ titre: (e && e.chapitre) || '', debut: i, fin: i });
      out[out.length - 1].fin = i;
    });
    return out;
  }
  const chapitreDe = (chaps, i) => { for (let k = chaps.length - 1; k >= 0; k--) if (i >= chaps[k].debut) return k; return 0; };

  // ---------- l'état ----------
  const hote = {
    aller: hash => { location.hash = hash; },   // navigation de l'hôte (son routeur, sa pile)
    hash: () => location.hash,
    fini: () => {},                             // la visite est terminée : l'hôte retient, propose la suite
    interrompu: () => {},                       // on a quitté en route : l'hôte retient où
    etape: () => {},                            // chaque étape atteinte (pour reprendre au bon endroit)
    parcours: () => null,                       // retrouver une visite par son identifiant (la suite)
    lancerSuite: null,                          // lancer la visite qui suit (l'hôte peut charger d'abord)
    expliquer: () => null,                      // un contrôle → { cle, nom, texte } ou null
    action: () => {},                           // une action de fin de visite (« passer à mes données »)
    // L'habillage (10.14.0, « quelque chose de wow et beau ») : la COULEUR d'une visite (un nom de
    // thème de la feuille de style, `th-<nom>`), son ICÔNE, où en est le parcours de la personne, les
    // visites à proposer à la fin, et si la fin se FÊTE. Tous facultatifs : sans eux, la visite est
    // sobre, mais elle marche.
    couleur: () => '',                          // une visite → 'vendre', 'acheter'… (classe th-<nom>)
    icone: () => '',                            // un nom de couleur → le dessin SVG de son domaine
    progres: () => null,                        // une visite finie → { titre, fait, total } ou null
    suites: null,                               // une visite finie → les identifiants à proposer
    fete: () => false                           // une visite finie → la fêter (confettis) ?
  };
  let cur = null;
  let clavierPose = false;
  let boucle = 0, logique = 0, glisseT = 0, feteT = 0;
  const els = {};
  // Les dessins de la bulle. Ils vivent ICI, avec le moteur : une visite n'a pas à les connaître.
  const SVG = d => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
  const ICONE_DEFAUT = SVG('<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>');
  const ICONE_PERDU = SVG('<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5"/><path d="M12 17.4v.1"/>');
  const ICONE_MAIN = SVG('<path d="M8.5 12.5V5.8a1.6 1.6 0 0 1 3.2 0v5.4"/><path d="M11.7 10.8V9.3a1.6 1.6 0 0 1 3.2 0v2"/><path d="M14.9 11.3v-.6a1.6 1.6 0 0 1 3.2 0v4.1a6.2 6.2 0 0 1-6.2 6.2h-.6a6.2 6.2 0 0 1-5-2.6l-2.4-3.4a1.6 1.6 0 0 1 2.6-1.9l1.9 2.4"/>');
  const FLECHE = SVG('<path d="M5 12h13"/><path d="M13 6.5l5.5 5.5-5.5 5.5"/>');
  const FLECHE_G = SVG('<path d="M19 12H6"/><path d="M11 6.5L5.5 12l5.5 5.5"/>');

  function installer(o) { Object.assign(hote, o || {}); }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  }
  // Une cible : un sélecteur, une liste de sélecteurs (le premier qui existe et se voit), ou une
  // fonction qui rend l'élément. La première correspondance VISIBLE gagne : une page porte souvent le
  // même bouton dans un onglet masqué.
  function resoudre(cible) {
    if (!cible) return null;
    if (typeof cible === 'function') { try { const el = cible(); return visible(el) ? el : null; } catch (_) { return null; } }
    for (const sel of (Array.isArray(cible) ? cible : [cible])) {
      let liste = [];
      try { liste = document.querySelectorAll(sel); } catch (_) { liste = []; }
      for (const el of liste) if (visible(el)) return el;
    }
    return null;
  }
  // L'adresse d'une étape : une chaîne, une expression régulière (on n'y mène pas, on vérifie), ou
  // une fonction — une fiche se désigne par un identifiant tiré des données au moment de l'étape.
  const pageDe = e => { if (!e || !e.page) return null; if (typeof e.page === 'function') { try { return e.page() || null; } catch (_) { return null; } } return e.page; };
  const pageOk = e => {
    const p = pageDe(e);
    if (!p) return true;
    const hash = hote.hash() || '#/dashboard';
    return p instanceof RegExp ? p.test(hash) : (hash === p || hash.startsWith(p + '/'));
  };

  // Les contrôles d'une étape « liste », dans l'ordre de l'écran, chacun une fois : le même bouton
  // répété sur chaque ligne (« Actions ») ne se dit qu'une fois, grâce à la clé que rend l'hôte.
  function candidats(e) {
    const racine = resoudre(e.zone || e.cible);
    if (!racine) return [];
    const sel = typeof e.liste === 'string' ? e.liste : CONTROLES;
    try { return [...(racine.matches(sel) ? [racine] : []), ...racine.querySelectorAll(sel)]; } catch (_) { return []; }
  }
  const compterBruts = e => candidats(e).filter(el => !el.matches('button.i') && visible(el)).length;
  function listerControles(e) {
    const tous = candidats(e);
    const vus = new Set(), out = [];
    for (const el of tous) {
      if (el.matches('button.i') || (els.bulle && els.bulle.contains(el)) || !visible(el)) continue;
      let x = null;
      try { x = hote.expliquer(el); } catch (_) { x = null; }
      if (!x || !x.texte) continue;
      const cle = x.cle || x.nom || x.texte;
      if (vus.has(cle)) continue;
      vus.add(cle);
      out.push({ el, nom: x.nom || '', texte: x.texte });
    }
    return out;
  }

  function creer() {
    if (els.bulle && els.bulle.isConnected) return;
    const mk = (id, cls) => { const d = document.createElement('div'); d.id = id; if (cls) d.className = cls; document.body.appendChild(d); return d; };
    els.trou = mk('visite-trou');
    els.anneau = mk('visite-anneau');
    els.point = mk('visite-point');
    els.point.hidden = true;
    els.bulle = mk('visite-bulle', 'visite-bulle');
    els.bulle.setAttribute('role', 'dialog');
    els.bulle.setAttribute('aria-labelledby', 'visite-titre');
    els.bulle.setAttribute('aria-live', 'polite');
    els.bulle.addEventListener('keydown', e => {
      const item = e.target.closest && e.target.closest('.vb-item');
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); quitter(); }
      else if (item && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const it = [...els.bulle.querySelectorAll('.vb-item')];
        const k = it.indexOf(item) + (e.key === 'ArrowDown' ? 1 : -1);
        if (it[k]) it[k].focus();
      } else if (e.key === 'ArrowRight' && !estFaire(etape())) { e.preventDefault(); suivant(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); precedent(); }
    });
    // Les flèches que la bulle annonce (« ← → pour avancer ») marchent aussi quand le curseur est
    // ailleurs : un humain clique à côté de la bulle, sur la page éclairée, puis appuie sur → — et
    // l'écoute posée sur la seule bulle ne recevait plus rien (10.14.0, trouvé à la souris). Jamais
    // dans un champ (la flèche y déplace le curseur), ni sous une fenêtre ouverte, qui a son clavier.
    if (!clavierPose) {
      clavierPose = true;
      document.addEventListener('keydown', e => {
        // `defaultPrevented` : la bulle a déjà traité la touche. Tester `contains(e.target)` ne suffit
        // pas — la bulle se redessine en avançant, le bouton qui avait le curseur est détaché, et la
        // même flèche avançait de DEUX étapes (trouvé à la souris, sur ce correctif même).
        if (e.defaultPrevented || !cur || !els.bulle || els.bulle.contains(e.target)) return;
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (document.querySelector('.modal-bg')) return;
        if (e.key === 'ArrowRight' && estFaire(etape())) return;
        e.preventDefault();
        if (e.key === 'ArrowRight') suivant(); else precedent();
      });
    }
    els.bulle.addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const v = b.dataset.v;
      if (v === 'suiv') suivant();
      else if (v === 'prec') precedent();
      else if (v === 'fermer') quitter();
      else if (v === 'passer') suivant(true);
      else if (v === 'chapitre') chapitreSuivant();
      else if (v === 'retour') retourner();
      else if (v === 'fin') terminer();
      else if (v === 'suite') lancerSuite(b.dataset.id);
      else if (v === 'action') agir(b.dataset.id);
    });
    // Survoler (ou parcourir au clavier) une ligne de la liste éclaire le bouton dont elle parle.
    const pointer = ev => {
      if (!cur) return;
      const it = ev.target.closest && ev.target.closest('.vb-item');
      const k = it ? Number(it.dataset.k) : -1;
      if (k !== cur.pointe) { cur.pointe = k; if (k >= 0 && cur.items && cur.items[k]) amenerAlEcran(cur.items[k].el); }
    };
    els.bulle.addEventListener('mouseover', pointer);
    els.bulle.addEventListener('focusin', pointer);
    els.bulle.addEventListener('mouseleave', () => { if (cur && !els.bulle.contains(document.activeElement)) cur.pointe = -1; });
  }
  function retirer() {
    ['trou', 'anneau', 'point', 'bulle', 'fete'].forEach(k => { if (els[k]) els[k].remove(); els[k] = null; });
    cancelAnimationFrame(boucle); clearInterval(logique); clearTimeout(glisseT); clearTimeout(feteT);
    boucle = 0; logique = 0; glisseT = 0; feteT = 0;
  }
  // D'une étape à l'autre, le projecteur et la bulle GLISSENT vers leur nouvelle place au lieu d'y
  // sauter : l'œil suit le mouvement, et on voit d'où l'on vient. Seulement le temps du glissement —
  // le reste du temps, ils suivent la page qui défile image par image, sans retard.
  function glisser() {
    const cibles = [els.trou, els.anneau, els.bulle].filter(Boolean);
    cibles.forEach(n => n.classList.add('glisse'));
    clearTimeout(glisseT);
    glisseT = setTimeout(() => cibles.forEach(n => n && n.classList.remove('glisse')), 480);
  }
  // La couleur d'une étape : la sienne, sinon celle de son chapitre (portée par l'étape qui l'ouvre),
  // sinon celle de la visite. Un nom de thème de la feuille de style, jamais une couleur écrite ici :
  // une couleur écrite dans du JavaScript ne sait pas se retourner en mode sombre (7.27.0).
  function couleurDe(i) {
    if (!cur) return '';
    const et = cur.p.etapes, e = et[i] || {};
    const k = chapitreDe(cur.chaps || [], i), c = (cur.chaps || [])[k];
    let x = e.couleur || (c && et[c.debut] && et[c.debut].couleur) || cur.p.couleur || '';
    if (!x) { try { x = hote.couleur(cur.p) || ''; } catch (_) { x = ''; } }
    return /^[a-z-]+$/.test(x) ? x : '';
  }
  const couleurVisite = p => { let x = (p && p.couleur) || ''; if (!x) { try { x = hote.couleur(p) || ''; } catch (_) { x = ''; } } return /^[a-z-]+$/.test(x) ? x : ''; };
  const iconeDe = (coul, p) => { let s = ''; try { s = hote.icone(coul, p || (cur && cur.p)) || ''; } catch (_) { s = ''; } return s || ICONE_DEFAUT; };
  function teinter(n, coul) {
    if (!n) return;
    [...n.classList].forEach(c => { if (c.startsWith('th-')) n.classList.remove(c); });
    if (coul) n.classList.add('th-' + coul);
  }
  // Un bouton d'une longue zone peut être hors de l'écran : on l'y amène, sans bousculer le reste.
  function amenerAlEcran(el) {
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    if (r.top < 50 || r.bottom > window.innerHeight - 30) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* rien */ } }
  }

  const etape = () => (cur ? cur.p.etapes[cur.i] : null);

  // ---------- le déroulé ----------
  function lancer(p, depart) {
    if (!p || !p.etapes || !p.etapes.length) return false;
    if (cur) arreterSansBruit();
    // Une COPIE : les étapes qu'on déplie en route (une page lue sur l'écran) ne doivent pas rester
    // dans la visite d'origine — la prochaine fois, l'écran aura peut-être changé.
    const copie = Object.assign({}, p, { etapes: p.etapes.slice() });
    cur = { p: copie, i: -1, premiere: true, chaps: chapitres(copie.etapes), pointe: -1, items: [], vues: 0, dessine: '' };
    // Le BUT de la visite, mesuré au départ : « un client de plus », « une facture émise de plus ».
    // Quelqu'un qui va plus vite que la visite (Entrée enregistre la fenêtre avant les trois étapes
    // qui décrivent ses champs) a fini — on ne le laisse pas devant une bulle qui désigne un champ
    // disparu.
    try { cur.mesure0 = typeof p.mesure === 'function' ? p.mesure() : null; } catch (_) { cur.mesure0 = null; }
    creer();
    entrer(Math.max(0, Math.min(Number(depart) || 0, copie.etapes.length - 1)), 1);
    boucle = requestAnimationFrame(image);
    logique = setInterval(verifier, 180);
    return true;
  }
  function entrer(i, sens) {
    if (!cur) return;
    // Une étape conditionnelle (`si`) se saute dans le sens où l'on va : une liste vide n'a pas de
    // ligne à montrer, un exemple a déjà son client.
    while (i >= 0 && i < cur.p.etapes.length) {
      const e = cur.p.etapes[i];
      let garder = true;
      try { garder = !e.si || !!e.si(); } catch (_) { garder = false; }
      if (garder) break;
      i += sens;
    }
    if (i < 0) i = 0;
    if (i >= cur.p.etapes.length) { finir(); return; }
    cur.i = i; cur.t0 = Date.now(); cur.defile = false; cur.couper = false; cur.clic = 0; cur.pret = false; cur.perdu = false; cur.pointe = -1; cur.sens = sens;
    // La première étape apparaît ; les suivantes glissent depuis la précédente.
    if (cur.vues++ > 0) glisser();
    const e = etape();
    // Une étape « regarder » amène à sa page toute seule : on regarde, on ne fait rien. Une étape
    // « faire » laisse l'adresse telle qu'elle est — c'est le geste de la personne qui doit y mener.
    const premiere = cur.premiere; cur.premiere = false;
    const dest = pageDe(e);
    if (dest && typeof dest === 'string' && !pageOk(e) && (!estFaire(e) || i === 0 || premiere)) {
      try { hote.aller(dest); } catch (_) { /* l'hôte a refusé : la bulle le dira */ }
    }
    try { hote.etape(cur.p, cur.i); } catch (_) { /* l'hôte retient où l'on en est ; s'il n'y arrive pas, la visite continue */ }
    // `avant` prépare l'écran (ouvrir un onglet, dérouler un menu). Il peut être asynchrone : tant
    // qu'il travaille, l'anneau ne désigne rien — il désignerait l'écran d'avant.
    let r = null;
    if (typeof e.avant === 'function') { try { r = e.avant(); } catch (_) { r = null; } }
    // `deplier` remplace l'étape par celles qu'on lit sur l'écran, une fois celui-ci prêt : les
    // blocs d'un onglet n'existent qu'après le clic qui l'ouvre.
    const deplier = typeof e.deplier === 'function';
    if (deplier || (r && typeof r.then === 'function')) {
      const moi = cur, iMoi = i;
      cur.attente = true;
      const delai = ms => new Promise(res => setTimeout(res, ms));
      Promise.race([Promise.resolve(r).catch(() => {}), delai(2500)])
        .then(() => delai(deplier ? 350 : 0))
        .then(() => {
          if (cur !== moi || cur.i !== iMoi) return;
          cur.attente = false; cur.t0 = Date.now(); cur.defile = false; cur.couper = false;
          if (deplier) {
            let neuves = [];
            try { neuves = (e.deplier() || []).filter(Boolean); } catch (_) { neuves = []; }
            if (neuves.length && e.chapitre && !neuves[0].chapitre) neuves[0] = Object.assign({}, neuves[0], { chapitre: e.chapitre });
            if (neuves.length && e.couleur && !neuves[0].couleur) neuves[0] = Object.assign({}, neuves[0], { couleur: e.couleur });
            cur.p.etapes.splice(iMoi, 1, ...neuves);
            cur.chaps = chapitres(cur.p.etapes);
            // Rien à montrer sur cet écran : on continue dans le sens où l'on allait.
            entrer(neuves.length ? iMoi : iMoi + (sens < 0 ? -1 : 0), sens < 0 ? -1 : 1);
            return;
          }
          dessinerBulle();
        });
    } else cur.attente = false;
    dessinerBulle();
  }
  function suivant(passer) {
    if (!cur) return;
    const e = etape();
    if (!passer && e && e.faire === 'valeur' && !cur.pret) return;
    entrer(cur.i + 1, 1);
  }
  function precedent() {
    if (!cur || !peutReculer()) return;
    entrer(cur.i - 1, -1);
  }
  function chapitreSuivant() {
    if (!cur) return;
    const k = chapitreDe(cur.chaps, cur.i);
    if (k + 1 < cur.chaps.length) entrer(cur.chaps[k + 1].debut, 1); else finir();
  }
  // Revenir en arrière n'a de sens qu'entre deux étapes qu'on REGARDE : défaire un geste déjà fait
  // (« clique sur Nouveau devis ») ferait repasser aussitôt à l'étape suivante, puisque le geste est
  // fait — un bouton qui ne mène nulle part.
  function peutReculer() {
    if (!cur || cur.i <= 0) return false;
    const e = etape(), av = cur.p.etapes[cur.i - 1];
    return !estFaire(e) && !estFaire(av);
  }
  function retourner() {
    const e = etape(); if (!e) return;
    const dest = typeof e.retour === 'string' ? e.retour : pageDe(e);
    if (dest && typeof dest === 'string') { try { hote.aller(dest); } catch (_) { /* rien */ } }
    if (typeof e.avant === 'function') { try { e.avant(); } catch (_) { /* rien */ } }
    cur.t0 = Date.now(); cur.perdu = false; cur.defile = false; cur.couper = false;
    dessinerBulle();
  }
  function lancerSuite(id) {
    const p = hote.parcours(id);
    const fini = cur && cur.p;
    arreterSansBruit();
    if (fini) { try { hote.fini(fini); } catch (_) { /* rien */ } }
    if (!p) return;
    if (hote.lancerSuite) hote.lancerSuite(p); else lancer(p, 0);
  }
  function agir(id) {
    const p = cur && cur.p;
    arreterSansBruit();
    if (p) { try { hote.fini(p); } catch (_) { /* rien */ } }
    try { hote.action(id, p); } catch (_) { /* l'hôte dira ce qui n'a pas marché */ }
  }
  function finir() {
    // Dernière bulle : ce qui vient d'être fait, et la suite logique — on ne laisse pas quelqu'un au
    // milieu de l'écran avec « Terminé » et plus rien à faire (7.27.0 : chaque écran finit par le
    // geste suivant).
    if (!cur) return;
    cur.i = cur.p.etapes.length; cur.fin = true;
    dessinerBulle();
  }
  function terminer() {
    const p = cur && cur.p;
    arreterSansBruit();
    if (p) hote.fini(p);
  }
  function quitter() {
    if (!cur) return;
    const p = cur.p, i = cur.i;
    if (cur.fin) { terminer(); return; }
    arreterSansBruit();
    hote.interrompu(p, i);
  }
  function arreterSansBruit() { cur = null; retirer(); }

  // ---------- la boucle ----------
  // Le DESSIN suit chaque image (la page défile, une fenêtre s'ouvre, une ligne se redessine) ; la
  // LOGIQUE (conditions, patience) tourne toutes les 180 ms — une condition peut lire les données.
  function image() {
    if (!cur) return;
    positionner();
    boucle = requestAnimationFrame(image);
  }
  function verifier() {
    if (!cur || cur.fin || cur.attente) return;
    const e = etape(); if (!e) return;
    if (typeof cur.p.but === 'function') {
      let atteint = false;
      try { atteint = !!cur.p.but(cur.mesure0); } catch (_) { atteint = false; }
      if (atteint) { finir(); return; }
    }
    const el = resoudre(e.cible);
    // Une étape facultative dont la zone n'existe pas sur cet écran se saute, dans le sens où l'on va.
    if (!el && e.cible && e.facultatif && Date.now() - cur.t0 > PATIENCE_FACULTATIVE) { entrer(cur.i + (cur.sens || 1), cur.sens || 1); return; }
    // La cible a disparu parce qu'on a pris de l'avance (deux champs remplis d'un coup, une fenêtre
    // validée par Entrée) : si l'une des étapes suivantes est déjà à l'écran, on y va.
    if (!el && e.cible && estFaire(e) && Date.now() - cur.t0 > 500) {
      const etapes = cur.p.etapes;
      for (let j = cur.i + 1; j < Math.min(etapes.length, cur.i + 5); j++) {
        const f = etapes[j];
        let garder = true;
        try { garder = !f.si || !!f.si(); } catch (_) { garder = false; }
        if (garder && f.cible && pageOk(f) && resoudre(f.cible)) { entrer(j, 1); return; }
      }
    }
    // Le geste est fait ?
    let fait = false;
    if (typeof e.fait === 'function') { try { fait = !!e.fait(); } catch (_) { fait = false; } }
    // Le clic ne suffit que quand rien d'autre ne prouve le geste. Une étape qui dit ce qui le
    // prouve (`fait`) attend CETTE preuve : un « Enregistrer » refusé (un champ manque) garde sa
    // fenêtre ouverte, un choix de fichier peut être annulé — et la visite passait à la suite en
    // décrivant ce qui n'existait pas (vu à l'écran, 10.14.0 : « Où il est rangé » sur une liste vide).
    if (e.faire === 'clic' && typeof e.fait !== 'function' && cur.clic && Date.now() - cur.clic > 80) fait = true;
    if (e.faire === 'valeur') {
      const pret = typeof e.fait === 'function' ? fait : !!(el && String(el.value || '').trim());
      if (pret !== cur.pret) { cur.pret = pret; dessinerBulle(); }
      return;
    }
    if (fait && (estFaire(e) || e.fait)) { entrer(cur.i + 1, 1); return; }
    // La cible a-t-elle disparu ? Pas tout de suite : une fenêtre met un instant à s'ouvrir.
    const perdu = !!e.cible && !el && Date.now() - cur.t0 > PATIENCE;
    if (perdu !== cur.perdu) { cur.perdu = perdu; dessinerBulle(); return; }
    // Une liste dont les boutons ont changé (un onglet redessiné, une liste chargée) se redit. On
    // compte les contrôles BRUTS — sans demander d'explication à l'hôte toutes les 180 ms.
    if (e.liste && el && !cur.perdu && compterBruts(e) !== cur.bruts) dessinerBulle();
    // Le bouton nommé dans « À toi » est arrivé (ou a changé de nom) : on redit la phrase.
    if (el && typeof e.action === 'string' && e.action.includes('{bouton}') && libelleCible(e) !== cur.libelle) dessinerBulle();
  }
  // Le clic sur la cible se lit en CAPTURE, avant que la page ne le traite : un bouton qui redessine
  // la page aura disparu au moment où l'on regarderait.
  if (typeof document !== 'undefined') document.addEventListener('click', ev => {
    if (!cur || cur.fin) return;
    const e = etape();
    if (!e || e.faire !== 'clic') return;
    if (els.bulle && els.bulle.contains(ev.target)) return;
    const el = resoudre(e.cible);
    if (el && (el === ev.target || el.contains(ev.target))) cur.clic = Date.now();
  }, true);

  const rect = (el, pad) => { const b = el.getBoundingClientRect(); return { l: b.left - pad, t: b.top - pad, r: b.right + pad, b: b.bottom + pad }; };
  // Fait défiler de `dy` pixels le premier ancêtre de `el` qui défile (la page, sinon la fenêtre).
  function defilerDe(el, dy) {
    if (!dy) return;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const st = getComputedStyle(p);
      if (/(auto|scroll)/.test(st.overflowY) && p.scrollHeight > p.clientHeight) { p.scrollTop += dy; return; }
    }
    window.scrollBy(0, dy);
  }
  const poser = (node, r) => Object.assign(node.style, { left: r.l + 'px', top: r.t + 'px', width: Math.max(0, r.r - r.l) + 'px', height: Math.max(0, r.b - r.t) + 'px' });

  function positionner() {
    if (!els.bulle) return;
    const e = cur.fin ? {} : etape();
    if (!e) return;
    const W = window.innerWidth, H = window.innerHeight;
    const el = cur.fin || cur.attente ? null : resoudre(e.cible);
    const zoneEl = el && e.zone ? (resoudre(e.zone) || el) : el;
    const faire = estFaire(e) && !cur.fin;
    let r = null;
    if (zoneEl) {
      // Amener la cible à l'écran UNE fois par étape : la ramener à chaque image empêcherait de
      // faire défiler la page pour regarder autour.
      if (!cur.defile) {
        cur.defile = true;
        const rr = zoneEl.getBoundingClientRect();
        if (rr.top < 60 || rr.bottom > H - 40) { try { zoneEl.scrollIntoView({ block: rr.height > H * 0.7 ? 'start' : 'center', inline: 'nearest' }); } catch (_) { /* rien */ } }
        // Puis on libère le côté de la bulle, s'il n'en reste aucun (`hautPourBulle`). Pas pendant un
        // geste : sa cible est un bouton, et il a toujours un côté libre.
        const r0 = rect(zoneEl, 6);
        const taille = { w: els.bulle.offsetWidth, h: els.bulle.offsetHeight };
        const haut = faire ? null : hautPourBulle(r0, taille, { w: W, h: H }, e.cote);
        if (haut != null) defilerDe(zoneEl, Math.round(r0.t - haut));
        else if (!faire) {
          const hc = hautPourCouper(r0, taille, { w: W, h: H });
          if (hc != null) { cur.couper = true; defilerDe(zoneEl, Math.round(r0.t - hc)); }
        }
      }
      r = rect(zoneEl, 6);
      // Un bloc plus haut que l'écran (un tableau entier) ne laisse aucun côté libre : la bulle se
      // rabattait dans un coin et cachait sa première colonne — l'information même qu'on montrait.
      // On éclaire alors le HAUT du bloc (son en-tête et ses premières lignes, ce qui dit ce qu'il
      // est) et la bulle se pose juste dessous, sur des lignes qui restent dans l'ombre. Pas pendant
      // un geste : la cible d'un geste est un bouton, jamais un bloc.
      if (!faire && (cur.couper || (r.b - r.t > H * 0.62 && r.r - r.l > W * 0.45))) r = decouperHaut(r, H, cur.couper ? els.bulle.offsetHeight : 0);
    }
    const trou = els.trou, anneau = els.anneau, point = els.point;
    // L'ombre : seulement quand on REGARDE. Pendant un geste, rien ne s'assombrit — une liste qui
    // s'ouvre sous la cible doit rester lisible et cliquable.
    const ombre = !faire && (r || !e.cible || cur.fin || cur.perdu);
    trou.hidden = !ombre;
    if (ombre) {
      if (r && !cur.perdu) poser(trou, r);
      else poser(trou, { l: W / 2, t: H / 2, r: W / 2, b: H / 2 });
    }
    anneau.hidden = !r || cur.perdu;
    anneau.classList.toggle('pulse', faire);
    if (r) poser(anneau, r);
    // Le second anneau : le bouton dont parle la ligne survolée de la bulle.
    const it = cur.pointe >= 0 && cur.items ? cur.items[cur.pointe] : null;
    const vu = it && it.el && it.el.isConnected && visible(it.el);
    point.hidden = !vu;
    if (vu) poser(point, rect(it.el, 3));
    const bw = els.bulle.offsetWidth, bh = els.bulle.offsetHeight;
    const champ = el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || (el && el.classList && el.classList.contains('combo-btn'));
    const fen = r && !cur.perdu && zoneEl && zoneEl.closest ? zoneEl.closest('.modal') : null;
    const pos = placerPres(cur.perdu ? null : r, fen ? rect(fen, 0) : null, { w: bw, h: bh }, { w: W, h: H }, { pref: e.cote, reserveDessous: faire && champ });
    els.bulle.style.left = pos.x + 'px';
    els.bulle.style.top = pos.y + 'px';
    els.bulle.dataset.cote = pos.cote;
    // La pointe de la bulle vise le centre de la cible, même quand la bulle a dû glisser. Elle se
    // place en coordonnées PHYSIQUES, calculées sur des rectangles : c'est le script qui la pose,
    // pas la feuille de style — qui, elle, reste en propriétés logiques (9.4.10).
    const pointe = els.bulle.querySelector('.vb-pointe');
    if (pointe) {
      const cote = r && !cur.perdu ? pos.cote : '';
      pointe.hidden = !/^(droite|gauche|dessous|dessus)$/.test(cote);
      const vy = r ? Math.max(14, Math.min(bh - 14, (r.t + r.b) / 2 - pos.y)) : 0;
      const vx = r ? Math.max(14, Math.min(bw - 14, (r.l + r.r) / 2 - pos.x)) : 0;
      const st = pointe.style;
      st.left = cote === 'droite' ? '-7px' : cote === 'gauche' ? (bw - 7) + 'px' : (vx - 7) + 'px';
      st.top = cote === 'dessous' ? '-7px' : cote === 'dessus' ? (bh - 7) + 'px' : (vy - 7) + 'px';
      // La pointe prend la teinte de l'en-tête quand elle s'y accroche : une pointe blanche sur un
      // en-tête coloré se voit comme une encoche.
      const haut = els.bulle.querySelector('.vb-haut');
      const hh = haut ? haut.offsetHeight : 0;
      pointe.classList.toggle('teinte', cote === 'dessous' || ((cote === 'droite' || cote === 'gauche') && vy < hh - 6));
    }
  }

  // ---------- le dessin de la bulle ----------
  // Trois étages, toujours les mêmes, pour que l'œil sache où chercher : l'EN-TÊTE teinté à la couleur
  // du chapitre (son dessin, « Chapitre 3 sur 12 », le nom du chapitre, et la barre de progression
  // par chapitres), le CORPS (le titre de l'étape, son texte, la liste des boutons ou « À toi »), et
  // le PIED (précédent, le compte, suivant). Le compte n'est écrit dans aucun texte : il se calcule.
  function enTete(p) {
    const n = p.etapes.length;
    const chaps = cur.chaps && cur.chaps.length ? cur.chaps : [{ titre: '', debut: 0, fin: n - 1 }];
    const k = chapitreDe(chaps, cur.i), c = chaps[k];
    const dansChap = cur.i - c.debut + 1, tailleChap = c.fin - c.debut + 1;
    const avecChapitres = chaps.length > 1;
    const sur = avecChapitres ? `Chapitre ${k + 1} sur ${chaps.length}` : n > 1 ? `Étape ${cur.i + 1} sur ${n}` : 'Visite guidée';
    const lieu = (avecChapitres && c.titre) || p.titre || '';
    // La barre : un segment par chapitre (celui en cours se remplit étape par étape), sinon un segment
    // par étape, sinon — au-delà de douze étapes — une seule jauge.
    let segs;
    if (avecChapitres) segs = chaps.map((_, j) => (j < k ? 100 : j > k ? 0 : Math.round(dansChap / tailleChap * 100)));
    else if (n <= 12) segs = Array.from({ length: n }, (_, j) => (j <= cur.i ? 100 : 0));
    else segs = [Math.round((cur.i + 1) / n * 100)];
    const courant = avecChapitres ? k : n <= 12 ? cur.i : 0;
    // Le segment courant se REMPLIT depuis sa valeur précédente quand on avance : on voit le progrès.
    const avant = cur.sens > 0 ? (avecChapitres ? (dansChap > 1 ? Math.round((dansChap - 1) / tailleChap * 100) : 0) : n > 12 ? Math.round(cur.i / n * 100) : 0) : null;
    const barre = `<div class="vb-progres${segs.length > 1 ? '' : ' seul'}" aria-hidden="true">${segs.map((v, j) =>
      `<i class="${j < courant ? 'fait' : j === courant ? 'ici' : ''}"><b style="--p:${v}%${j === courant && avant != null ? `;--p0:${avant}%` : ''}"></b></i>`).join('')}</div>`;
    // Le compte du pied dit l'étape DANS le chapitre ; sans chapitre, l'en-tête dit déjà « Étape 2 sur 6 ».
    const compteur = avecChapitres ? `${dansChap} / ${tailleChap}` : '';
    const prochain = avecChapitres && cur.i === c.fin && k + 1 < chaps.length ? chaps[k + 1].titre : '';
    return { sur, lieu, barre, compteur, avecChapitres, dernierChap: k === chaps.length - 1, dansChap, tailleChap, debutChap: avecChapitres && cur.i === c.debut && k > 0, prochain };
  }

  // Le lieu de l'en-tête ne répète jamais le titre de la bulle : « Les factures et les avoirs » en
  // petit au-dessus de « Les factures et les avoirs » en grand se lit deux fois pour rien. La visite
  // d'une page dit alors ce qu'elle est ; une autre se contente de « Étape 1 sur 2 ».
  const plierTitre = t => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  function lieuDe(lieu, titre, p) {
    if (!lieu || plierTitre(lieu) !== plierTitre(titre)) return lieu;
    return p && p.type === 'page' ? 'Visite de la page' : '';
  }
  // L'en-tête commun : le dessin du domaine, où l'on est, et la pause.
  const tete = (icone, sur, lieu, fermer, titreFermer) => `<div class="vb-tete">
      <span class="vb-ico">${icone}</span>
      <span class="vb-ou"><span class="vb-sur">${h(sur)}</span><span class="vb-lieu">${h(lieu)}</span></span>
      <button type="button" class="vb-fermer" data-v="${fermer}" aria-label="${h(titreFermer)}" title="${h(titreFermer)}">${SVG('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>`;

  function dessinerBulle() {
    if (!cur || !els.bulle) return;
    const p = cur.p, n = p.etapes.length;
    // Une étape NOUVELLE s'anime en entrant (le texte glisse du côté où l'on va) ; un simple
    // rafraîchissement — un champ rempli, une liste chargée — ne rejoue pas l'animation.
    const cle = cur.fin ? 'fin' : cur.i + (cur.perdu ? 'p' : '') + (cur.attente ? 'a' : '');
    const neuve = cur.dessine !== cle;
    cur.dessine = cle;
    if (cur.fin) { dessinerFin(p, neuve); return; }
    const e = etape();
    const faire = estFaire(e);
    const t = enTete(p);
    const coul = couleurDe(cur.i);
    [els.anneau, els.point, els.trou].forEach(x => teinter(x, coul));
    if (cur.attente && typeof e.deplier === 'function') {
      cur.items = [];
      els.bulle.className = 'visite-bulle';
      teinter(els.bulle, coul);
      els.bulle.innerHTML = `<i class="vb-pointe" hidden></i>
        <div class="vb-haut">${tete(iconeDe(coul), t.sur, lieuDe(t.lieu, e.titre || e.chapitre, p), 'fermer', 'Mettre la visite en pause (Échap)')}${t.barre}</div>
        <div class="vb-corps"><h3 id="visite-titre">${h(e.titre || e.chapitre || 'Un instant…')}</h3>
          <div class="vb-texte vb-prepare">Je regarde ce qu'il y a sur cet écran…</div>
          <div class="vb-squelette" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
      typographier(els.bulle);
      return;
    }
    cur.items = e.liste && !cur.perdu && !cur.attente ? listerControles(e) : [];
    cur.bruts = e.liste ? compterBruts(e) : 0;
    els.bulle.className = 'visite-bulle' + (faire ? ' faire' : '') + (cur.items.length ? ' liste' : '') + (cur.perdu ? ' perdu' : '')
      + (neuve ? (cur.sens < 0 ? ' entre-arriere' : ' entre') : '') + (neuve && t.debutChap && cur.sens > 0 ? ' nouveau-chapitre' : '');
    teinter(els.bulle, coul);
    const dernier = cur.i === n - 1;
    const chapSuiv = t.avecChapitres && !t.dernierChap && !faire && !cur.perdu
      ? `<div class="vb-pied2"><button type="button" class="vb-lien" data-v="chapitre" title="Aller au début du chapitre suivant">Passer au chapitre suivant ›</button></div>` : '';
    const suivant = `<button type="button" class="vb-suiv" data-v="suiv">${dernier ? 'Terminer' : `Suivant${FLECHE}`}</button>`;
    const pied = cur.perdu ? `
        <button type="button" class="vb-lien" data-v="passer">Passer cette étape</button>
        ${pageDe(e) || e.retour ? '<button type="button" class="vb-suiv" data-v="retour">M\'y ramener</button>' : '<button type="button" class="vb-suiv" data-v="fermer">Arrêter la visite</button>'}`
      : faire ? `
        <button type="button" class="vb-lien" data-v="passer">Passer cette étape</button>
        ${e.faire === 'valeur'
          ? `<button type="button" class="vb-suiv" data-v="suiv" ${cur.pret ? '' : 'disabled'}>${h(e.bouton || 'C\'est fait')}</button>`
          : '<span class="vb-attente" role="status"><span class="vb-points-attente" aria-hidden="true"><i></i><i></i><i></i></span>J\'attends ton geste</span>'}`
      : `
        ${peutReculer() ? `<button type="button" class="vb-prec" data-v="prec">${FLECHE_G}Précédent</button>` : '<span class="vb-vide"></span>'}
        ${t.compteur ? `<span class="vb-compte">${t.compteur}</span>` : ''}
        ${suivant}`;
    const liste = cur.items.length ? `<ol class="vb-liste" aria-label="Ce que fait chaque bouton">${cur.items.map((x, k) =>
      `<li class="vb-item" tabindex="0" data-k="${k}"><span class="vb-num" aria-hidden="true">${k + 1}</span><span class="vb-it"><b>${h(x.nom)}</b><span class="vb-it-t">${x.texte}</span></span></li>`).join('')}</ol>` : '';
    // L'astuce du clavier, une fois par visite : sur la première bulle qu'on lit.
    const astuce = cur.vues <= 1 && !faire && !cur.perdu
      ? '<div class="vb-astuce"><kbd>←</kbd><kbd>→</kbd> pour avancer · <kbd>Échap</kbd> pour faire une pause</div>' : '';
    els.bulle.innerHTML = `<i class="vb-pointe" hidden></i>
      <div class="vb-haut">${tete(cur.perdu ? ICONE_PERDU : iconeDe(coul), t.sur, cur.perdu ? t.lieu : lieuDe(t.lieu, e.titre, p), 'fermer', 'Mettre la visite en pause (Échap) — tu la reprendras depuis « Me guider »')}${t.barre}</div>
      <div class="vb-corps">
      ${cur.perdu
        ? `<h3 id="visite-titre">On s'est perdus de vue</h3>
           <div class="vb-texte">${e.perdu || 'L\'endroit que je voulais te montrer n\'est plus à l\'écran : tu as peut-être changé de page ou fermé une fenêtre. Pas de souci — je peux t\'y ramener, ou tu passes cette étape.'}</div>`
        : `<h3 id="visite-titre">${h(e.titre || '')}</h3>
           ${e.texte ? `<div class="vb-texte">${e.texte}</div>` : ''}
           ${liste}
           ${faire && e.action ? `<div class="vb-afaire"><span class="vb-atoi">${ICONE_MAIN}À toi</span><span class="vb-action">${action(e)}</span></div>` : ''}
           ${t.prochain && !faire ? `<div class="vb-prochain">Ensuite : <b>${h(t.prochain)}</b></div>` : ''}`}
      </div>
      <div class="vb-pied">${pied}</div>${chapSuiv}${astuce}`;
    typographier(els.bulle);
    // Pendant un geste, le curseur reste dans l'application : lui voler le focus empêcherait de
    // taper dans le champ que la bulle désigne. Quand on regarde, il va sur « Suivant » — sauf si
    // l'on regarde un CHAMP : on a peut-être envie d'y écrire tout de suite.
    const cibleEl = resoudre(e.cible);
    const champ = cibleEl && /^(INPUT|SELECT|TEXTAREA)$/.test(cibleEl.tagName);
    if (!faire && !cur.perdu && !champ) focaliser('.vb-suiv');
  }

  // La DERNIÈRE bulle : une réussite se voit. Une médaille qui se dessine, des confettis la première
  // fois (et jamais pour quelqu'un qui a demandé moins d'animations), ce qu'on vient d'apprendre, où
  // en est son parcours, et la suite logique — on ne laisse personne devant « Terminé » et plus rien
  // à faire (7.27.0 : chaque écran finit par le geste suivant).
  function dessinerFin(p, neuve) {
    const coul = couleurVisite(p);
    [els.anneau, els.point, els.trou].forEach(x => teinter(x, coul));
    let ids = null;
    try { ids = typeof hote.suites === 'function' ? hote.suites(p) : null; } catch (_) { ids = null; }
    const suites = (ids || p.suite || []).map(id => hote.parcours(id)).filter(Boolean).slice(0, 3);
    const actions = (typeof p.actions === 'function' ? p.actions() : (p.actions || [])).filter(Boolean);
    let pr = null;
    try { pr = hote.progres(p); } catch (_) { pr = null; }
    cur.items = [];
    els.bulle.className = 'visite-bulle fin' + (neuve ? ' entre' : '');
    teinter(els.bulle, coul);
    const pct = pr && pr.total ? Math.round(pr.fait / pr.total * 100) : 0;
    const carte = s => { const c = couleurVisite(s); return `<button type="button" class="vb-suite${c ? ' th-' + c : ''}" data-v="suite" data-id="${h(s.id)}">
        <span class="vb-suite-ico">${iconeDe(c, s)}</span><span class="vb-suite-t"><b>${h(s.titre)}</b>${s.resume ? `<span>${h(s.resume)}</span>` : ''}</span>${s.duree ? `<span class="vb-duree">${h(s.duree)}</span>` : ''}</button>`; };
    els.bulle.innerHTML = `<i class="vb-pointe" hidden></i>
      <div class="vb-haut">
        <div class="vb-medaille" aria-hidden="true"><svg viewBox="0 0 52 52"><circle class="vb-m-rond" cx="26" cy="26" r="23"/><path class="vb-m-coche" d="M15.5 27.5l7 7 14-15"/></svg></div>
        <div class="vb-fin-ou"><span class="vb-sur">Visite terminée</span><span class="vb-lieu">${h(p.titre || '')}</span></div>
        <button type="button" class="vb-fermer" data-v="fin" aria-label="Fermer la visite" title="Fermer">${SVG('<path d="M6 6l12 12M18 6L6 18"/>')}</button>
      </div>
      <div class="vb-corps">
        <h3 id="visite-titre">${h(p.bravo || 'C\'est fait !')}</h3>
        <div class="vb-texte">${p.conclusion || 'Tu sais maintenant le faire. Tu retrouveras cette visite, et toutes les autres, dans « Me guider ».'}</div>
        ${pr && pr.total ? `<div class="vb-parcours"><div class="vb-parcours-t"><b>${h(pr.titre || 'Ton parcours')}</b><span>${pr.fait} / ${pr.total}</span></div>
          <span class="vb-jauge"><i style="--p:${pct}%"></i></span>${pr.texte ? `<span class="vb-parcours-s">${h(pr.texte)}</span>` : ''}</div>` : ''}
        ${actions.length ? `<div class="vb-actions">${actions.map(a => `<button type="button" class="${a.principal ? 'vb-suiv' : 'vb-suite simple'}" data-v="action" data-id="${h(a.id)}">${a.principal ? `${h(a.label)}${FLECHE}` : `<span class="vb-suite-t"><b>${h(a.label)}</b>${a.detail ? `<span>${h(a.detail)}</span>` : ''}</span>`}</button>`).join('')}</div>` : ''}
        ${suites.length ? `<div class="vb-suites"><div class="vb-label">Et maintenant ?</div>${suites.map(carte).join('')}</div>` : ''}
      </div>
      <div class="vb-pied"><span class="vb-vide"></span><button type="button" class="${actions.some(a => a.principal) ? 'vb-prec' : 'vb-suiv'}" data-v="fin">Terminer</button></div>`;
    typographier(els.bulle);
    // « Terminer », pas la croix de l'en-tête : les deux portent `data-v="fin"`, et le premier trouvé
    // était la croix — un cadre de focus sur un ✕, et Entrée qui « ferme » au lieu de terminer.
    focaliser(actions.some(a => a.principal) ? '[data-v="action"].vb-suiv' : '.vb-pied [data-v="fin"]');
    let fete = false;
    try { fete = neuve && !!hote.fete(p); } catch (_) { fete = false; }
    if (fete) feter();
  }

  // Les confettis : une gerbe d'une seconde, partie du haut de la bulle, qui ne prend aucun clic et
  // disparaît d'elle-même. Rien du tout pour qui a demandé moins d'animations.
  function feter() {
    if (!els.bulle) return;
    try { if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (_) { /* rien */ }
    if (els.fete) els.fete.remove();
    const f = document.createElement('div');
    f.id = 'visite-fete';
    f.setAttribute('aria-hidden', 'true');
    const r = els.bulle.getBoundingClientRect();
    f.style.left = Math.round(r.left + r.width / 2) + 'px';
    f.style.top = Math.round(r.top + 36) + 'px';
    f.innerHTML = Array.from({ length: 28 }, (_, i) => {
      const a = (-160 + (i * 140 / 27) + (Math.random() * 10 - 5)) * Math.PI / 180;
      const d = 90 + Math.random() * 120;
      return `<i style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d)}px;--r:${Math.round(Math.random() * 540 - 270)}deg;--t:${(0.75 + Math.random() * 0.5).toFixed(2)}s"></i>`;
    }).join('');
    document.body.appendChild(f);
    els.fete = f;
    clearTimeout(feteT);
    feteT = setTimeout(() => { if (els.fete === f) { f.remove(); els.fete = null; } }, 1700);
  }

  // « Clique sur {bouton} » nomme le bouton RÉEL : sur une liste vide, le geste est
  // « + Ajouter mon premier client » ; sur une liste pleine, « + Nouveau client ». Écrire l'un des
  // deux en dur ferait lire à la personne un nom qu'elle ne voit pas à l'écran.
  function libelleCible(e) {
    const el = resoudre(e.cible);
    if (!el) return '';
    const t = (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim();
    return t.length > 60 ? t.slice(0, 57) + '…' : t;
  }
  function action(e) {
    const a = typeof e.action === 'function' ? e.action() : String(e.action || '');
    if (!a.includes('{bouton}')) return a;
    const t = libelleCible(e);
    cur.libelle = t;
    return a.replace('{bouton}', t ? '<b>« ' + h(t) + ' »</b>' : 'le bouton éclairé');
  }
  function focaliser(sel) {
    const b = els.bulle && els.bulle.querySelector(sel);
    if (b) { try { b.focus({ preventScroll: true }); } catch (_) { /* rien */ } }
  }

  // ---------- une page LUE sur l'écran ----------
  // La visite d'une page ne s'écrit pas étape par étape : elle se LIT sur l'écran, bloc par bloc
  // (l'en-tête, les onglets, les filtres, chaque panneau, chaque tableau), et chaque bloc devient une
  // étape « liste » qui nomme et explique ses contrôles. Écrite à la main, elle se périmerait au
  // premier bouton ajouté — exactement ce que le projet combat depuis la 7.3.0 (un e2e se périme,
  // une table en double diverge). Ce qui s'écrit à la main, c'est l'EXPLICATION : le dictionnaire de
  // l'hôte (`expliquer`, `zone`) — et un contrôle qu'il n'explique pas est trouvé par l'instrument.
  //
  // Les onglets deviennent des chapitres : on ouvre chacun à son tour, et ses blocs se lisent APRÈS
  // le clic (`deplier`), parce qu'ils n'existent pas avant.
  const BLOCS = '.page-head, .tabs, .filters, .panel, .banner, .warn-box, .pager, .cards, .stats, .scroll-x, table, .vide-utile, .empty, .help-search, .lead';
  const DESCENDRE = '.split, .dash-grid, .grid2, .cols, .g-cartes';
  function cheminDe(el, racine) {
    const esc = x => (global.CSS && global.CSS.escape ? global.CSS.escape(x) : String(x).replace(/[^\w-]/g, '\\$&'));
    const parts = [];
    let n = el;
    while (n && n !== racine && n.parentElement) {
      if (n.id) { parts.unshift('#' + esc(n.id)); return parts.join(' > '); }
      const par = n.parentElement;
      parts.unshift(`${n.tagName.toLowerCase()}:nth-child(${[...par.children].indexOf(n) + 1})`);
      n = par;
    }
    if (racine && racine.id) parts.unshift('#' + esc(racine.id));
    return parts.join(' > ');
  }
  function blocsDe(racine, exclure) {
    const out = [];
    const walk = (el, prof) => {
      for (const c of el.children) {
        if (!visible(c) || c.closest('#visite-bulle')) continue;
        if (exclure && c.matches(exclure)) continue;
        if (c.matches(BLOCS)) { out.push(c); continue; }
        if (prof < 4 && c.children.length && (c.matches(DESCENDRE) || (c.tagName === 'DIV' && !c.querySelector(':scope > h2, :scope > h3')))) { walk(c, prof + 1); continue; }
        if (c.querySelector(CONTROLES) || c.querySelector(':scope > h2, :scope > h3')) out.push(c);
      }
    };
    if (racine) walk(racine, 0);
    return out;
  }
  // Le titre d'un bloc : son intitulé, sans la bulle « i » ni les compteurs qui l'accompagnent.
  const titreDe = el => {
    const t = el.querySelector(':scope > h2, :scope > h3, :scope > .panel-head h2, :scope > header h2, h2, h3');
    if (!t) return '';
    const c = t.cloneNode(true);
    c.querySelectorAll('button, .muted, .small, .pp-compte, .badge').forEach(x => x.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  };
  function etapesDeLaVue(opts) {
    const o = opts || {};
    const racine = typeof o.racine === 'string' ? document.querySelector(o.racine) : (o.racine || document.querySelector('#view'));
    if (!racine) return [];
    const out = [];
    for (const b of blocsDe(racine, o.exclure)) {
      const sel = cheminDe(b, racine);
      let z = null;
      try { z = hote.zone ? hote.zone(b) : null; } catch (_) { z = null; }
      const titre = (z && z.titre) || titreDe(b) || '';
      const texte = (z && z.texte) || '';
      const etape = { cible: sel, liste: true, facultatif: true, titre, texte, cote: b.getBoundingClientRect().width > window.innerWidth * 0.55 ? 'dessous' : undefined };
      // Un bloc qui n'a ni explication ni contrôle expliqué n'apprend rien : on ne s'y arrête pas.
      let n = 0;
      try { n = listerControles(etape).length; } catch (_) { n = 0; }
      if (!n && !texte) continue;
      if (!etape.titre) etape.titre = n ? 'Ce que fait chaque bouton ici' : 'À savoir';
      out.push(etape);
      // Une barre d'onglets : chaque onglet devient un chapitre, lu après son clic.
      if (o.onglets && b.matches('.tabs') && b.id) {
        const barre = '#' + b.id;
        [...b.querySelectorAll('button[data-tab]')].filter(x => visible(x) && !x.disabled).forEach(t => {
          const cle = t.dataset.tab, nom = t.textContent.replace(/\s+/g, ' ').trim();
          out.push({
            chapitre: nom, titre: nom,
            avant: () => ouvrirOnglet(barre, cle),
            deplier: () => etapesDeLaVue({ racine: o.racine, exclure: [o.exclure, '.page-head', barre].filter(Boolean).join(', '), onglets: false })
          });
        });
        break;       // la suite de la page appartient aux onglets : elle se lit dans chacun
      }
    }
    return out;
  }
  // Un onglet se clique quand sa barre EXISTE. `hote.aller()` change l'adresse, et la page se dessine
  // au `hashchange` qui suit — asynchrone, et plus tard encore pour une page qui attend le disque (les
  // Paramètres). Cliqué tout de suite, l'onglet visait l'écran d'AVANT et ne trouvait rien : la visite
  // « Répondre aux questions de mon comptable », lancée depuis « Me guider », restait sur l'onglet
  // Ventes, la bulle au milieu de l'écran (vu à l'écran, 10.14.0). `entrer` attend la promesse
  // (2,5 s au plus) avant de désigner quoi que ce soit.
  function ouvrirOnglet(barre, cle, patience) {
    const limite = Date.now() + (patience == null ? 2000 : patience);
    return new Promise(res => {
      const essayer = () => {
        const bt = document.querySelector(`${barre} button[data-tab="${cle}"]`);
        if (bt) { if (!bt.classList.contains('active')) bt.click(); res(true); return; }
        if (Date.now() >= limite) { res(false); return; }
        setTimeout(essayer, 50);
      };
      essayer();
    });
  }

  // ---------- ce que fait un contrôle (10.14.0) ----------
  // L'ALGORITHME qui explique un bouton, un champ ou un onglet vit ici, avec le moteur ; chaque
  // application n'apporte que SES tables (le dictionnaire des boutons, les onglets, les champs, les
  // menus de ligne). Écrit d'abord dans `visites.js` pour l'application entreprise, il aurait été
  // recopié dans le Cabinet — et une copie diverge, toujours (7.29.0) : la première règle ajoutée d'un
  // côté aurait manqué de l'autre, sans que rien le dise.
  const nettoie = t => String(t == null ? '' : t).replace(/\s+/g, ' ').replace(/\s*[▾▸]\s*$/, '').trim();
  function libelleDe(el) {
    const aria = el.getAttribute('aria-label');
    if (aria) return nettoie(aria);
    if (el.matches('input, select, textarea') || el.classList.contains('combo-btn')) {
      const l = el.closest('label, .field');
      if (l) {
        const c = l.cloneNode(true);
        c.querySelectorAll('input, select, textarea, button, .combo-list, .small, .muted').forEach(x => x.remove());
        const t = nettoie(c.textContent);
        if (t) return t;
      }
      return nettoie(el.placeholder || el.getAttribute('title') || '');
    }
    const c = el.cloneNode(true);
    c.querySelectorAll('button.i, .badge, .pp-compte').forEach(x => x.remove());
    return nettoie(c.textContent || el.value || el.getAttribute('title'));
  }
  // Le résumé d'une bulle « i » : sa première ou ses deux premières phrases, sans balise.
  function resumeBulle(html) {
    const t = String(html || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const phrases = t.match(/[^.!?]+[.!?]+(\s|$)/g) || [t];
    let out = '';
    for (const p of phrases) { if ((out + p).length > 190 && out) break; out += p; }
    return out.trim();
  }
  // La page courante, lue dans l'adresse (`#/devis/…` → « devis »), ou `defaut`.
  const routeDe = defaut => () => (String((typeof location !== 'undefined' && location.hash) || '').replace(/^#\/?/, '').split('/')[0] || defaut);
  // `t` : { B (le dictionnaire), ONGLETS, CHAMPS, MENUS, route() (la page courante), guide() (les
  // bulles « i » de l'application : { INFO }), familles(el, lab, nom) (des champs reconnus à leur
  // forme, propres à l'application) }. Rend `expliquer(el, ctx)` : { cle, nom, texte } ou null — et
  // c'est l'instrument de couverture qui compte les null, écran par écran.
  function expliqueur(t) {
    const B = t.B || [], ONGLETS = t.ONGLETS || {}, CHAMPS = t.CHAMPS || {}, MENUS = t.MENUS || {};
    return function expliquer(el, ctx) {
      if (!el || !el.matches) return null;
      const r = (ctx && ctx.route) ? ctx.route() : t.route();
      const G = (ctx && ctx.G) || (t.guide && t.guide()) || { INFO: {} };
      const lab = libelleDe(el);
      // 0. une action d'un menu « Actions » porte sa propre phrase (7.28.0) : la visite dit la MÊME que
      // celle que la personne lit dans le menu, jamais une seconde qui divergerait.
      if (el.matches('.row-menu button')) {
        const l = el.querySelector('.rm-l'), ph = el.querySelector('.rm-h');
        const nom = l ? nettoie(l.textContent) : lab;
        const phrase = ph ? nettoie(ph.textContent) : '';
        if (phrase) return { cle: 'rm:' + nom, nom, texte: phrase };
      }
      // 1. le dictionnaire
      for (let i = 0; i < B.length; i++) {
        const x = B[i];
        if (x.route && !(Array.isArray(x.route) ? x.route : [x.route]).includes(r)) continue;
        if (x.id && el.id !== x.id) continue;
        if (x.sel) { let ok = false; try { ok = el.matches(x.sel); } catch (_) { ok = false; } if (!ok) continue; }
        if (x.lib && !x.lib.test(lab)) continue;
        if (x.rowmenu) return { cle: 'rowmenu', nom: x.nom, texte: `Tous les autres gestes de cette ligne, chacun avec sa phrase : ${MENUS[r] || 'ouvrir, modifier, supprimer…'}` };
        if (x.onglet) break;
        return { cle: x.cle || (x.id ? '#' + x.id : 'b' + i), nom: x.nom || lab || x.id, texte: x.texte };
      }
      // 2. les onglets
      const onglet = el.dataset && (el.dataset.tab || el.dataset.vue);
      if (onglet && el.closest('.tabs')) {
        const o = ONGLETS[r + ':' + onglet] || ONGLETS[onglet];
        if (o) return { cle: 'tab:' + onglet, nom: lab, texte: o };
      }
      // 3. un champ : la bulle « i » de son libellé, sinon son nom
      const champ = el.matches('input, select, textarea') || el.classList.contains('combo-btn');
      if (champ) {
        const hote = el.closest('label, .field, .combo, .datefield');
        const zone = hote && (hote.closest('label, .field') || hote);
        const bulle = zone && zone.querySelector('button.i[data-info]');
        const x = bulle && G.INFO[bulle.dataset.info];
        if (x) return { cle: 'i:' + bulle.dataset.info, nom: x.t || lab, texte: resumeBulle(x.d) };
        const nom = el.getAttribute('name') || (el.closest('[data-combo]') && el.closest('[data-combo]').dataset.combo) || '';
        if (CHAMPS[nom]) return { cle: 'c:' + nom, nom: lab || nom, texte: CHAMPS[nom] };
        if (CHAMPS['#' + el.id]) return { cle: 'c:#' + el.id, nom: lab || el.id, texte: CHAMPS['#' + el.id] };
        // Les familles de champs qu'on reconnaît à leur forme.
        if (el.closest('.datefield') || el.classList.contains('d-txt')) return { cle: 'date', nom: lab || 'Date', texte: "Tape la date (JJ/MM/AAAA, ou juste le jour) ou choisis-la dans le calendrier." };
        const f = t.familles ? t.familles(el, lab, nom) : null;
        if (f) return f;
        if (el.classList.contains('combo-btn')) return { cle: 'combo', nom: lab || 'Liste', texte: "Clique pour ouvrir la liste, tape quelques lettres pour chercher, et choisis." };
        if (el.type === 'search' || /^Rechercher/i.test(el.placeholder || '')) return { cle: 'recherche', nom: 'Recherche', texte: "Tape quelques lettres : la liste se réduit pendant la frappe." };
      }
      // 4. un bouton de calendrier, un lien vers une page
      if (el.matches('.d-btn, [aria-label="Ouvrir le calendrier"]')) return { cle: 'cal', nom: 'Calendrier', texte: "Ouvre le calendrier pour choisir la date." };
      if (el.matches('a[href^="#/"]')) return { cle: 'lien:' + (el.getAttribute('href') || '').split('/')[1], nom: lab, texte: "Ouvre ce qui est nommé." };
      return null;
    };
  }
  // Le titre et le mot d'un bloc de l'écran (pour les visites de page), lus dans la table `ZONES`.
  function zoneur(ZONES) {
    return function zone(el) {
      for (const z of ZONES) {
        let ok = false;
        try { ok = el.matches(z.sel); } catch (_) { ok = false; }
        if (ok) {
          const titre = z.sel === '.banner' ? nettoie((el.querySelector('b') || el).textContent).slice(0, 80) : z.titre;
          return { titre: titre || z.titre, texte: z.texte };
        }
      }
      return null;
    };
  }

  // Ce que l'hôte peut demander : où en est-on ? (pour la palette, la barre, les tests)
  function enCours() {
    if (!cur) return null;
    const k = chapitreDe(cur.chaps || [], cur.i);
    return { id: cur.p.id, index: cur.i, total: cur.p.etapes.length, fin: !!cur.fin, perdu: !!cur.perdu,
      chapitre: (cur.chaps && cur.chaps.length > 1) ? k : null, items: (cur.items || []).length };
  }

  const api = { installer, lancer, quitter, enCours, suivant, precedent, chapitreSuivant, placerBulle, placerPres, typo, chevauche, decouperHaut, hautPourBulle, hautPourCouper, estFaire, lieuDe, ouvrirOnglet,
    chapitres, resoudre, visible, listerControles, etapesDeLaVue, blocsDe, cheminDe, PATIENCE, PATIENCE_FACULTATIVE, CONTROLES,
    nettoie, libelleDe, resumeBulle, routeDe, expliqueur, zoneur };
  global.Visite = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
