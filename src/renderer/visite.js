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
  // La largeur d'une bulle qui tient À CÔTÉ d'une fenêtre trop large pour la bulle entière (PUR : les
  // tests le jouent) : la marge la plus grande, sans descendre sous une largeur lisible — null quand
  // la bulle entière tient déjà, ou quand même la marge la plus grande est trop étroite pour se lire.
  // Les largeurs de la feuille (`.visite-bulle`, `.visite-bulle.liste`) : la bulle ne se rétrécit que
  // si SA largeur ne tient pas — une bulle de liste est plus large qu'une bulle ordinaire.
  const LARGEUR_BULLE = 388, LARGEUR_LISTE = 448, LARGEUR_MIN = 264;
  function largeurPres(fen, ecran, largeur) {
    if (!fen || !ecran) return null;
    const place = Math.floor(Math.max(ecran.w - MARGE - (fen.r + ECART), fen.l - ECART - MARGE));
    if (place >= largeur) return null;
    return place >= LARGEUR_MIN ? place : null;
  }
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

  // ---------- ce que la visite fait de l'étape, à chaque tour (PUR : les tests le jouent) ----------
  // Skander, 26/09/2026 : « des fois il passe tout seul sans que j'ai appuyé sur suivant ». Trois
  // chemins avançaient sans lui, et chacun se trompait de preuve :
  //   - une étape FACULTATIVE se sautait dès que sa zone manquait — y compris une zone qu'on venait de
  //     voir et que la personne avait vidée (une recherche, un filtre, un onglet) : la visite d'une
  //     page se terminait d'elle-même, sur « Tu connais cette page ». Elle ne se saute plus qu'à
  //     l'ENTRÉE, pour une zone jamais venue ; une zone perdue se DIT ;
  //   - la « prise d'avance » (une étape plus loin déjà à l'écran) sautait sur un simple redessin de
  //     la page : elle exige maintenant un GESTE de la personne pendant l'étape ;
  //   - un geste déjà fait en entrant (une fenêtre déjà ouverte) faisait passer l'étape sans qu'on
  //     l'ait lue : l'étape le dit (« c'est déjà fait ») et attend « Suivant ». Seul le passage du
  //     non-fait au fait, pendant l'étape, avance tout seul — c'est le geste qu'on attendait.
  // Et pendant un ESSAI (la personne clique ce que la bulle lui montre), rien n'avance ni ne se perd.
  // `s` : { cible, el, vu, facultatif, faire, mode, aFait, fait, faitAvant, entree, clic, clicRecent,
  //         geste, essai, t } — rend 'sauter' | 'avance' | 'valeur' | 'dejaFait' | 'avancer' |
  //         'attendre' | 'perdu' | 'present' | null.
  function decider(s) {
    if (!s || s.essai) return null;
    if (!s.el && s.cible && s.facultatif && !s.vu && s.t > PATIENCE_FACULTATIVE) return 'sauter';
    if (!s.el && s.cible && s.faire && s.geste && s.t > 500) return 'avance';
    // Ce que le geste d'avant avait ouvert s'est refermé (un « Annuler » cliqué pendant qu'on le
    // regardait) : l'étape n'a plus rien à montrer, et elle ne le sera pas en attendant — sauf si son
    // PROPRE geste vient d'avoir lieu (« Émettre » ferme le récapitulatif, et c'est le geste attendu).
    if (s.cible && !s.el && s.defait && !(s.aFait && s.fait && s.faitAvant === false)) return 'perdu';
    if (s.mode === 'valeur') return 'valeur';
    if (s.aFait) {
      if (s.fait && s.entree) return 'dejaFait';
      if (s.fait && s.faitAvant === false) return 'avancer';
    } else if (s.mode === 'clic' && s.clic) return 'avancer';
    // Le clic vient d'avoir lieu : la page qu'il ouvre fait disparaître la cible, ce n'est pas se
    // perdre — le tour suivant le comptera comme fait.
    if (s.mode === 'clic' && !s.aFait && s.clicRecent) return 'attendre';
    if (s.cible && !s.el && s.t > PATIENCE) return 'perdu';
    return 'present';
  }

  // ---------- la bulle en retrait (PUR : les tests le jouent) ----------
  // Quand la personne ESSAIE (elle clique ce que la bulle lui montre) ou qu'une liste s'ouvre, la
  // bulle se range dans un coin, en petit, pour ne rien couvrir : le coin le plus proche du bas à
  // droite qui ne touche ni la liste ouverte, ni l'endroit du clic, ni la cible du geste attendu.
  function placerMini(ecran, bulle, evites) {
    const W = ecran.w, H = ecran.h, bw = bulle.w, bh = bulle.h;
    const coins = [
      { x: W - MARGE - bw, y: H - MARGE - bh, cote: 'bas-droite' },
      { x: W - MARGE - bw, y: MARGE, cote: 'haut-droite' },
      { x: MARGE, y: H - MARGE - bh, cote: 'bas-gauche' },
      { x: MARGE, y: MARGE, cote: 'haut-gauche' }
    ].map(c => ({ x: Math.round(Math.max(MARGE, c.x)), y: Math.round(Math.max(MARGE, c.y)), cote: c.cote }));
    for (const c of coins) {
      const r = { l: c.x, t: c.y, r: c.x + bw, b: c.y + bh };
      if (!(evites || []).some(z => z && chevauche(r, z))) return c;
    }
    return coins[0];
  }

  // ---------- les boutons que la bulle NOMME (PUR : les tests le jouent) ----------
  // « Clique sur « + Ligne vide » » : le bouton cité doit être en PLEINE LUMIÈRE, pas sous le voile —
  // Skander, 26/09/2026 : « quand le guide me parle d'une action il faut que je puisse appuyer dessus
  // pour la découvrir, et pas qu'elle s'affiche en sombre en arrière-plan ». Un nom se compare sans
  // ce qui le décore (« + », « ▾ », « … », les accents, la casse) : « Ajouter depuis le catalogue »
  // désigne le bouton « Ajouter depuis le catalogue… ».
  const normNom = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[\u00a0\u202f]/g, ' ').replace(/^[\s+✕×›‹←→✎↑↓]+/, '').replace(/[\s▾▸…→›.:]+$/, '').replace(/\s+/g, ' ').trim();
  // Les noms cités entre guillemets français dans un texte (HTML ou non), dans l'ordre, chacun une fois.
  function nomsCites(texte) {
    const t = String(texte == null ? '' : texte).replace(/<[^>]+>/g, '');
    const out = [];
    for (const m of t.matchAll(/«[\s\u00a0\u202f]*([^«»]{2,80}?)[\s\u00a0\u202f]*»/g)) {
      const n = m[1].trim();
      if (n && !out.includes(n)) out.push(n);
    }
    return out;
  }

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
    remettre: '',                               // le bouton qui réaffiche une liste vidée par une recherche ou un filtre
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
  const ICONE_COCHE = SVG('<path d="M5 12.5l4.5 4.5L19 7.5"/>');
  const ICONE_INFO = SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.1"/>');
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
  // Ce que l'anneau entoure. Une case à cocher (ou un bouton radio) se lit avec son LIBELLÉ : un
  // anneau de 16 px autour de la case seule mordait sur « Mentionner le salaire » et laissait le
  // libellé sous le voile — or c'est lui qu'on lit, et lui qu'on clique (10.14.1).
  function zoneDeLaCase(el) {
    if (!el || typeof el.matches !== 'function') return el;
    if (!el.matches('input[type=checkbox], input[type=radio]')) return el;
    const lab = typeof el.closest === 'function' ? el.closest('label') : null;
    return lab || el;
  }
  // Le clic d'un geste vise la cible : le premier élément visible qui correspond, OU n'importe quel
  // autre élément du même sélecteur. « Clique sur la ligne d'un client » éclaire la première ligne ;
  // cliquer la troisième est le même geste (10.14.0 — sur la Production du Cabinet, le clic sur une
  // autre ligne était ignoré, la page changeait, et la bulle annonçait « On s'est perdus de vue »).
  function viseLaCible(cible, cibleEl, cliquee) {
    if (!cliquee || !cible) return false;
    if (cibleEl && (cibleEl === cliquee || cibleEl.contains(cliquee))) return true;
    if (typeof cible === 'function') return false;
    for (const sel of (Array.isArray(cible) ? cible : [cible])) {
      let el = null;
      try { el = cliquee.closest(sel); } catch (_) { el = null; }
      if (el && visible(el)) return true;
    }
    return false;
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

  // La cible d'une étape : l'ÉLÉMENT qu'on a lu sur l'écran quand il est encore là (une page lue bloc
  // par bloc garde le sien), sinon son sélecteur. Un chemin de rang (« le 3e bloc ») se décale dès
  // qu'un bloc apparaît au-dessus ; l'élément, lui, ne ment pas tant qu'il est dans la page.
  const cibleDe = e => {
    if (!e) return null;
    if (e.el && e.el.isConnected && visible(e.el)) return e.el;
    return resoudre(e.cible);
  };
  const zoneDe = e => (e && e.zone ? (resoudre(e.zone) || cibleDe(e)) : cibleDe(e));

  // Les listes ouvertes par-dessus la page (une liste déroulante, un calendrier, un menu d'actions,
  // les suggestions du catalogue, la liste d'un sélecteur) : la bulle ne se pose jamais dessus.
  // L'hôte peut en déclarer d'autres (`hote.listes`).
  const LISTES_OUVERTES = '.combo-pop:not([hidden]), .cal-pop:not([hidden]), .sugg-pop:not([hidden]), .row-menu, .lm-pop';
  // Une fenêtre ouverte PAR-DESSUS la cible — « Abandonner cette saisie ? », une confirmation : la
  // dernière fenêtre de la pile ne contient pas l'endroit que la visite montre. L'anneau et la bulle
  // restaient alors dessinés sur la question et cachaient son texte (vu à la souris, 10.14.1). La
  // visite se range, comme devant une liste ouverte, le temps qu'on y réponde.
  function fenetreOuverte() {
    let fs = [];
    try { fs = [...document.querySelectorAll('.modal')].filter(x => visible(x) && !(els.bulle && els.bulle.contains(x))); } catch (_) { fs = []; }
    return fs[fs.length - 1] || null;
  }
  function fenetreQuiCouvre(el) {
    if (!el || !el.isConnected) return null;
    let fs = [];
    try { fs = [...document.querySelectorAll('.modal')].filter(x => visible(x) && !(els.bulle && els.bulle.contains(x))); } catch (_) { fs = []; }
    const haut = fs[fs.length - 1];
    return haut && !haut.contains(el) ? haut : null;
  }

  function listesOuvertes() {
    let sel = LISTES_OUVERTES;
    try { const x = hote.listes && hote.listes(); if (x) sel += ', ' + x; } catch (_) { /* la liste par défaut suffit */ }
    let l = [];
    try { l = [...document.querySelectorAll(sel)]; } catch (_) { l = []; }
    return l.filter(el => visible(el) && !(els.bulle && els.bulle.contains(el)));
  }

  // Les boutons que la bulle nomme « entre guillemets », trouvés sur l'écran par leur nom — plus
  // ceux que l'étape désigne elle-même (`eclairer`). Un nom qu'aucun bouton visible ne porte ne
  // s'éclaire pas : on n'invente pas de cible.
  const NOMMABLES = 'button, a[href], [role=button], [role=tab], .combo-btn, select, summary';
  function nommesDe(e, texte) {
    const out = [];
    const ajouter = (el, nom) => {
      if (!el || !visible(el) || el.closest('#visite-bulle, #visite-nommes')) return;
      if (out.some(x => x.el === el)) return;
      out.push({ el, nom: nom || '' });
    };
    const explicites = e && e.eclairer ? (Array.isArray(e.eclairer) ? e.eclairer : [e.eclairer]) : [];
    for (const s of explicites) {
      let l = [];
      try { l = document.querySelectorAll(s); } catch (_) { l = []; }
      for (const el of l) if (visible(el)) { ajouter(el, ''); break; }
    }
    const noms = nomsCites(texte);
    if (noms.length && typeof document !== 'undefined') {
      let tous = [];
      try { tous = [...document.querySelectorAll(NOMMABLES)].filter(el => visible(el) && !el.closest('#visite-bulle')); } catch (_) { tous = []; }
      const nomDe = el => [normNom(libelleDe(el)), normNom(el.textContent)];
      for (const n of noms) {
        const cle = normNom(n);
        if (!cle) continue;
        const el = tous.find(x => nomDe(x).includes(cle));
        if (el) ajouter(el, n);
      }
    }
    return out.slice(0, 8);
  }

  // Les contrôles d'une étape « liste », dans l'ordre de l'écran, chacun une fois : le même bouton
  // répété sur chaque ligne (« Actions ») ne se dit qu'une fois, grâce à la clé que rend l'hôte.
  function candidats(e) {
    const racine = zoneDe(e);
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
      if (vus.has(cle)) {
        // Deux contrôles DISTINCTS qui partagent une explication (le jour de dépôt de la TVA et celui
        // de la CNSS) se disent une fois, mais s'éclairent tous les deux : le second restait dans
        // l'ombre (vu à la souris, 10.14.1). Le même bouton répété sur chaque LIGNE d'un tableau
        // (« Actions ») ne s'éclaire qu'une fois — trente trous dans une colonne ne montrent rien.
        const deja = out.find(o => o.cle === cle);
        if (deja && !(el.closest && el.closest('tbody tr')) && deja.autres.length < 3) deja.autres.push(el);
        continue;
      }
      vus.add(cle);
      out.push({ el, nom: x.nom || '', texte: x.texte, cle, autres: [] });
    }
    return out;
  }

  function creer() {
    if (els.bulle && els.bulle.isConnected) return;
    const mk = (id, cls) => { const d = document.createElement('div'); d.id = id; if (cls) d.className = cls; document.body.appendChild(d); return d; };
    // Le VOILE : un dessin plein écran percé de TROUS — la zone de l'étape, et chaque bouton que la
    // bulle nomme. Une ombre portée autour d'un seul cadre (la version d'avant) ne savait percer
    // qu'un trou : les boutons cités hors de la zone restaient dans le noir (10.14.1, S-02).
    const NS = 'http://www.w3.org/2000/svg';
    els.voile = document.createElementNS(NS, 'svg');
    els.voile.id = 'visite-voile';
    els.voile.setAttribute('aria-hidden', 'true');
    els.voile.setAttribute('focusable', 'false');
    els.voile.innerHTML = '<defs><mask id="visite-masque" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">'
      + '<rect x="0" y="0" width="100%" height="100%" fill="#fff"/><rect class="vv-trou" rx="14" ry="14" fill="#000"/><g class="vv-extras"></g></mask></defs>'
      + '<rect class="vv-ombre" x="0" y="0" width="100%" height="100%" mask="url(#visite-masque)"/>';
    document.body.appendChild(els.voile);
    els.trou = els.voile.querySelector('.vv-trou');
    els.extras = els.voile.querySelector('.vv-extras');
    // Les anneaux fins des boutons nommés (hors de la zone) : l'œil les trouve sans chercher.
    els.nommes = mk('visite-nommes');
    els.anneau = mk('visite-anneau');
    els.point = mk('visite-point');
    els.point.hidden = true;
    els.bulle = mk('visite-bulle', 'visite-bulle');
    els.bulle.setAttribute('role', 'dialog');
    els.bulle.setAttribute('aria-labelledby', 'visite-titre');
    els.bulle.setAttribute('aria-live', 'polite');
    els.bulle.addEventListener('keydown', e => {
      const item = e.target.closest && e.target.closest('.vb-item');
      const nm = e.target.closest && e.target.closest('.vb-nomme');
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); quitter(); }
      else if (nm && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); montrerNomme(Number(nm.dataset.n)); }
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
      else if (v === 'reprendre') reprendre();
      else if (v === 'recommencer') recommencer();
      else if (v === 'abandon') { arreterSansBruit(); }
      else if (v === 'nomme') montrerNomme(Number(b.dataset.n));
      else if (v === 'remettre') remettre();
      else if (v === 'regeste') revenirAuGeste();
    });
    // Survoler (ou parcourir au clavier) une ligne de la liste éclaire le bouton dont elle parle — et
    // survoler un NOM cité dans le texte éclaire le bouton qu'il désigne.
    const pointer = ev => {
      if (!cur) return;
      const it = ev.target.closest && ev.target.closest('.vb-item');
      const k = it ? Number(it.dataset.k) : -1;
      if (k !== cur.pointe) { cur.pointe = k; if (k >= 0 && cur.items && cur.items[k]) amenerAlEcran(cur.items[k].el); }
      const nm = ev.target.closest && ev.target.closest('.vb-nomme');
      cur.pointeN = nm ? Number(nm.dataset.n) : -1;
    };
    els.bulle.addEventListener('mouseover', pointer);
    els.bulle.addEventListener('focusin', pointer);
    // Quitter la bulle éteint le second anneau — sauf si l'on parcourt la liste AU CLAVIER. Le
    // curseur posé d'office sur « Suivant » ne compte pas : avec lui, l'anneau restait allumé sur le
    // dernier bouton survolé pendant qu'on tapait ailleurs (vu à la souris, 10.14.1).
    const eteindre = () => { if (cur) { cur.pointe = -1; cur.pointeN = -1; } };
    els.bulle.addEventListener('mouseleave', () => {
      const f = document.activeElement;
      if (!(f && els.bulle.contains(f) && f.closest && f.closest('.vb-item, .vb-nomme'))) eteindre();
    });
    els.bulle.addEventListener('focusout', ev => {
      const vers = ev.relatedTarget;
      if (vers && els.bulle.contains(vers)) return;
      if (!els.bulle.matches(':hover')) eteindre();
    });
  }
  function retirer() {
    ['voile', 'nommes', 'anneau', 'point', 'bulle', 'fete'].forEach(k => { if (els[k]) els[k].remove(); els[k] = null; });
    els.trou = null; els.extras = null;
    cancelAnimationFrame(boucle); clearInterval(logique); clearTimeout(glisseT); clearTimeout(feteT);
    boucle = 0; logique = 0; glisseT = 0; feteT = 0;
  }
  // D'une étape à l'autre, le projecteur et la bulle GLISSENT vers leur nouvelle place au lieu d'y
  // sauter : l'œil suit le mouvement, et on voit d'où l'on vient. Seulement le temps du glissement —
  // le reste du temps, ils suivent la page qui défile image par image, sans retard.
  function glisser() {
    const cibles = [els.voile, els.anneau, els.bulle].filter(Boolean);
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
    // Une visite de page reprise au milieu : l'étape où l'on s'était arrêté (le sixième bloc, dans le
    // deuxième onglet) n'existe qu'une fois la page RELUE. On la vise, et chaque lecture rapproche
    // (`viser`, repris après chaque dépliage) — la version d'avant reprenait au premier bloc, pendant
    // que « Me guider » annonçait « Étape 2 sur 2 » (vu à la souris, 10.14.1).
    const d = Math.max(0, Number(depart) || 0);
    if (d > copie.etapes.length - 1 && enAttenteDe(copie.etapes, -1)) cur.viser = d;
    const dd = Math.min(d, copie.etapes.length - 1);
    // Une visite de GESTE reprise au milieu : l'écran de son étape (la fenêtre ouverte, le brouillon
    // du devis) n'existe plus quand on revient de « Me guider ». Reprise là, la bulle se perdait de vue
    // et ne proposait qu'« Arrêter la visite » (vu à la souris, 10.14.1). On reprend sur place si la
    // cible est à l'écran, sinon à la dernière étape qui dit où aller (`etapeAvecPage`).
    const ici = copie.etapes[dd];
    entrer(cur.viser != null || (ici && cibleDe(ici) && pageOk(ici)) ? dd
      : repriseDuGeste(copie.etapes, dd, j => ({ present: !!cibleDe(copie.etapes[j]), pageOk: pageOk(copie.etapes[j]) })), 1);
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
      // Après un geste PASSÉ, ce qu'il aurait ouvert ne s'est pas ouvert : l'étape qui le décrivait se
      // saute avec lui (`consequenceDuGeste`). La première étape qui a de quoi montrer lève la règle.
      if (garder && sens > 0 && cur.consequences) {
        const dest = pageDe(e);
        const seMene = !!dest && typeof dest === 'string' && !pageOk(e) && !estFaire(e);
        if (consequenceDuGeste(e, { present: !!cibleDe(e), seMene })) garder = false;
        else cur.consequences = false;
      }
      if (garder) break;
      i += sens;
    }
    if (sens < 0) cur.consequences = false;
    if (i < 0) i = 0;
    if (i >= cur.p.etapes.length) { finir(); return; }
    cur.i = i; cur.t0 = Date.now(); cur.defile = false; cur.couper = false; cur.clic = 0; cur.pret = false; cur.perdu = false; cur.pointe = -1; cur.sens = sens;
    // Ce qui ne vaut que pour l'étape qu'on quitte : un essai en cours, un geste, la zone déjà vue,
    // l'état du geste à l'entrée, les boutons nommés.
    cur.essai = null; cur.geste = 0; cur.vu = false; cur.faitAvant = undefined; cur.dejaFait = false; cur.dejaRempli = false; cur.mini = false; cur.couvert = false; cur.nommes = []; cur.pointeN = -1;
    cur.note = cur.noteProchaine || ''; cur.noteProchaine = ''; cur.defait = false;
    // La première étape apparaît ; les suivantes glissent depuis la précédente.
    if (cur.vues++ > 0) glisser();
    const e = etape();
    // Une étape « regarder » amène à sa page toute seule : on regarde, on ne fait rien. Une étape
    // « faire » laisse l'adresse telle qu'elle est — c'est le geste de la personne qui doit y mener.
    const premiere = cur.premiere; cur.premiere = false;
    const dest = pageDe(e);
    const surPlace = pageOk(e);
    if (dest && typeof dest === 'string' && !surPlace && (!estFaire(e) || i === 0 || premiere)) {
      try { hote.aller(dest); } catch (_) { /* l'hôte a refusé : la bulle le dira */ }
    }
    // La page est DÉJÀ à l'écran (la visite part de la page qu'elle présente) : on lit tout de suite
    // les blocs qui suivent, pour que « Étape 1 sur 5 » dise le vrai compte — la version d'avant
    // annonçait « 1 sur 2 », puis « 2 sur 5 » (vu à la souris, 10.14.1). Seulement sur place, et pour
    // une lecture sans préparation (`avant`) : un écran qu'on vient de demander n'est pas encore dessiné.
    if (surPlace && !e.avant && typeof e.deplier !== 'function') anticiper(i);
    // L'hôte retient où l'on en est — et le compte, quand on le connaît : une page encore à lire n'a
    // pas de « sur N » (`pointDeReprise`).
    try { hote.etape(cur.p, cur.i, compteDe(cur)); } catch (_) { /* l'hôte retient où l'on en est ; s'il n'y arrive pas, la visite continue */ }
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
            const neuves = etapesDepliees(e);
            cur.p.etapes.splice(iMoi, 1, ...neuves);
            cur.chaps = chapitres(cur.p.etapes);
            // Une reprise vise une étape plus loin : on lit les onglets qui la précèdent, un par un,
            // puis on s'y arrête. Si la page a changé depuis (moins de blocs), on s'arrête au dernier.
            if (cur.viser != null) {
              const r = versLaReprise(cur.p.etapes, iMoi, cur.viser);
              if (r.fini) cur.viser = null;
              entrer(r.i, 1);
              return;
            }
            // Rien à montrer sur cet écran : on continue dans le sens où l'on allait.
            entrer(neuves.length ? iMoi : iMoi + (sens < 0 ? -1 : 0), sens < 0 ? -1 : 1);
            return;
          }
          dessinerBulle();
        });
    } else cur.attente = false;
    dessinerBulle();
  }
  // Les étapes qu'un `deplier` rend, prêtes à entrer dans la visite. Elles héritent de la page de
  // l'étape qui les porte (« M'y ramener » sait où aller) et de ce qui prépare l'écran (l'onglet de
  // leur chapitre, rouvert par `retablir` — jamais par `avant`, qui rendrait chaque bloc asynchrone).
  function etapesDepliees(e) {
    let neuves = [];
    try { neuves = (e.deplier() || []).filter(Boolean); } catch (_) { neuves = []; }
    neuves = neuves.map((x, k) => {
      const o = Object.assign({}, x);
      if (!o.page && e.page) o.page = e.page;
      if (!o.retablir && !o.avant && (e.retablir || e.avant)) o.retablir = e.retablir || e.avant;
      if (k === 0 && e.chapitre && !o.chapitre) o.chapitre = e.chapitre;
      if (k === 0 && e.couleur && !o.couleur) o.couleur = e.couleur;
      return o;
    });
    return neuves;
  }
  // Lire tout de suite la page qui est déjà à l'écran : l'étape de lecture qui SUIT l'étape courante
  // (la présentation d'une page, puis ses blocs) se remplace par les blocs, sans attendre d'y arriver.
  function anticiper(i) {
    if (!cur) return;
    const j = i + 1, x = cur.p.etapes[j];
    if (!x || typeof x.deplier !== 'function' || x.avant || !pageOk(x)) return;
    const neuves = etapesDepliees(x);
    if (!neuves.length) return;
    cur.p.etapes.splice(j, 1, ...neuves);
    cur.chaps = chapitres(cur.p.etapes);
  }
  function suivant(passer) {
    if (!cur) return;
    const e = etape();
    if (!passer && e && e.faire === 'valeur' && !cur.pret) return;
    // Un GESTE passé sans être fait se retient : la fin ne félicite pas ce qui n'a pas eu lieu
    // (« Passer cette étape » sur « Enregistrer », puis « Ta fiche est à jour » — 10.14.1).
    if (passer && gestePasse(e, cur)) {
      (cur.passes = cur.passes || []).push(nettoie(e.titre || '') || 'une étape');
      cur.consequences = true;
    }
    entrer(cur.i + 1, 1);
  }
  // Le geste qui a ouvert ce qu'une étape montre : le plus proche, avant elle, qu'on FAIT (pas
  // facultatif). Pure. -1 quand il n'y en a pas.
  function gesteQuiOuvre(etapes, i) {
    for (let k = Math.min(i, (etapes || []).length) - 1; k >= 0; k--) {
      const g = etapes[k];
      if (g && estFaire(g) && !g.facultatif) return k;
    }
    return -1;
  }
  // Ce geste est-il DÉFAIT ? Sa preuve (`fait`) dit non — une fenêtre annulée, un menu refermé. Une
  // étape qui mène à sa page ou prépare son écran a de quoi se montrer seule : elle n'en dépend pas.
  function sourceDefaite(e) {
    if (!cur || !e || !e.cible || typeof e.avant === 'function' || typeof e.deplier === 'function') return false;
    const dest = pageDe(e);
    if (dest && typeof dest === 'string' && !pageOk(e) && !estFaire(e)) return false;
    const k = gesteQuiOuvre(cur.p.etapes, cur.i);
    const g = k >= 0 ? cur.p.etapes[k] : null;
    if (!g || typeof g.fait !== 'function') return false;
    try { return !g.fait(); } catch (_) { return false; }
  }
  // Une étape DÉPEND-elle du geste qu'on vient de passer ? Oui quand sa cible n'est pas à l'écran et
  // que rien ne l'y amènera : ni sa propre page (une étape « regarder » y mène seule), ni une
  // préparation (`avant`, `deplier`). Passer « Émettre la facture » laissait la visite décrire, au
  // milieu de l'écran, un récapitulatif qui ne s'était jamais ouvert, puis viser son bouton « Émettre »
  // (vu à la souris, 10.14.1). Pure : l'écran lui dit ce qu'il voit.
  function consequenceDuGeste(e, vu) {
    if (!e || !e.cible) return false;
    if (typeof e.avant === 'function' || typeof e.deplier === 'function') return false;
    if (vu && vu.seMene) return false;
    return !(vu && vu.present);
  }
  // Une étape « Passer » la laisse-t-elle NON faite ? Un geste d'une visite « faire », pas facultatif,
  // dont ni la preuve (`fait`), ni la case remplie (`valeur`), ni un « Déjà fait » ne disent qu'il l'est.
  function gestePasse(e, c) {
    if (!e || !c || !c.p || c.p.type !== 'faire' || e.facultatif || !estFaire(e) || c.dejaFait) return false;
    if (e.faire === 'valeur') return !c.pret;
    if (typeof e.fait === 'function') { try { return !e.fait(); } catch (_) { return true; } }
    return true;
  }
  // L'issue d'une visite, PURE (les tests la jouent) : un but atteint félicite, un but manqué le dit ;
  // sans but, un geste passé ne se félicite pas non plus.
  // La règle des fins, lue sur le CONTENU (les tests des deux applications l'appellent) : une fin qui
  // affirme un fait (« Ta facture est émise ») a un but ou une preuve ; un but ou une preuve qui
  // compare à l'entrée a sa mesure ; et un but — qui termine la visite dès qu'il est atteint — ne suit
  // aucune étape qu'on regarde : elle serait sautée (celles-là se jugent à la fin, par une preuve).
  function finsHonnetes(visites) {
    const savoir = /^(Tu sais|Tu connais|Tu suis|Tu as fait le tour|Te voilà)/;
    const r = { sansPreuve: [], sansMesure: [], coupees: [], causes: [], affirmatives: 0 };
    // Une fin ratée dit l'ÉTAT et le geste qui le fait — jamais une cause qu'elle n'a pas vue : « la
    // fenêtre s'est fermée sans « Émettre » » était faux quand on avait passé le geste qui l'ouvre
    // (10.14.1). « peut-être » laisse la cause possible ; l'affirmer, non.
    const cause = /s['’]est ferm|n['’]a pas été cliqu|(?<!peut-être )été annulé|reste éteint tant/;
    (visites || []).filter(v => v && v.type === 'faire').forEach(v => {
      const affirme = typeof v.bravo === 'function' || !savoir.test(String(v.bravo || ''));
      const but = typeof v.but === 'function', preuve = typeof v.preuve === 'function';
      if (affirme) r.affirmatives++;
      if (typeof v.echec === 'string' && cause.test(v.echec)) r.causes.push(`${v.id} — « ${v.echec.slice(0, 70)}… »`);
      if (affirme && !but && !preuve) r.sansPreuve.push(`${v.id} — « ${v.bravo} »`);
      if (((but && v.but.length) || (preuve && v.preuve.length)) && typeof v.mesure !== 'function') r.sansMesure.push(v.id);
      if (but) {
        const et = (v.etapes || []).filter(Boolean);
        let dernier = -1;
        et.forEach((e, i) => { if (estFaire(e) && !e.facultatif) dernier = i; });
        const apres = et.slice(dernier + 1).filter(e => !e.facultatif);
        if (dernier >= 0 && apres.length) r.coupees.push(`${v.id} — « ${apres[0].titre || ''} »`);
      }
    });
    return r;
  }
  // ---------- « Guide-moi » : ce qu'on peut faire sur CETTE page (10.14.1, S-03) ----------
  // Skander : « au lieu de garder “Comprendre cette page”, un bouton “Guide-moi” avec la liste de
  // toutes les actions qu'on peut faire sur cette page, afin que l'assistant soit toujours à portée
  // de main ». Les trois fonctions qui suivent sont PURES et servent les deux applications : chacune
  // prête ses visites, la clé de ses pages et l'onglet ouvert ; le rangement est le même.
  //
  // Les pages d'un geste guidé : celles qu'il déclare (`pages`) et celle où il COMMENCE — sa première
  // étape qui a une adresse. `cleDe(hash)` rend la clé de page d'une adresse (« doc » dans SkanFact,
  // « compta-saisie » dans le Cabinet).
  function pagesDuGeste(v, cleDe) {
    const cles = new Set(((v && v.pages) || []).filter(Boolean));
    const e = ((v && v.etapes) || []).find(x => x && x.page);
    const p = e ? pageDe(e) : null;
    const k = p && typeof p === 'string' ? cleDe(p) : null;
    if (k) cles.add(k);
    return [...cles];
  }
  // L'onglet qu'un geste ouvre sur une page : la première de ses étapes sur CETTE page qui prépare un
  // onglet (`avant` ou `retablir` construits par `onglet(barre, cle)`). Null quand il n'en ouvre aucun.
  function ongletDuGeste(v, cle, cleDe) {
    for (const e of (v && v.etapes) || []) {
      if (!e) continue;
      const p = pageDe(e);
      if (!p || typeof p !== 'string' || cleDe(p) !== cle) continue;
      const prep = [e.avant, e.retablir].find(f => f && f.barre && f.cle);
      if (prep) return { barre: prep.barre, cle: prep.cle };
    }
    return null;
  }
  // Ce que « Guide-moi » montre sur une page : sa visite ; les gestes qu'on peut faire ICI — ceux de
  // l'onglet ouvert, et ceux qui n'en ouvrent aucun — ; puis ceux des autres onglets, rangés par
  // onglet. Dans l'ordre des visites : les tables les rangent déjà par domaine. L'onglet ouvert se
  // lit à l'écran (`ongletActif(barre)`), par l'application : sur les Paramètres, douze gestes d'un
  // bloc feraient chercher celui de l'onglet qu'on regarde.
  // Un geste qui déclare `surLaPage(cle)` ne se propose que là où il s'applique : sur une fiche de
  // pièce, « Émettre » sur un brouillon de facture, jamais sur un devis. Une règle qui lève ne cache
  // rien : mieux vaut un geste proposé en trop qu'un geste perdu.
  const convientParDefaut = (v, cle) => { if (typeof v.surLaPage !== 'function') return true; try { return !!v.surLaPage(cle); } catch (_) { return true; } };
  function guideDeLaPage(visites, cle, o) {
    const opts = o || {};
    const cleDe = opts.cleDe || (x => x);
    const convient = opts.convient || convientParDefaut;
    const liste = (visites || []).filter(Boolean);
    const page = liste.find(v => v.type === 'page' && v.route === cle) || null;
    const ici = [], autres = new Map();
    liste.filter(v => v.type === 'faire' && pagesDuGeste(v, cleDe).includes(cle) && convient(v, cle)).forEach(v => {
      const og = ongletDuGeste(v, cle, cleDe);
      const actif = og && opts.ongletActif ? opts.ongletActif(og.barre) : null;
      if (!og || !actif || og.cle === actif) { ici.push(v); return; }
      if (!autres.has(og.cle)) autres.set(og.cle, { onglet: og, gestes: [] });
      autres.get(og.cle).gestes.push(v);
    });
    return { page, ici, ailleurs: [...autres.values()] };
  }
  // Le « Guide-moi » de cette page propose-t-il cette visite ? (PUR.) Une visite mise en pause se dit
  // reprise « depuis Guide-moi » seulement si elle y figure — la découverte, elle, n'est que dans
  // « Me guider ». Par identifiant : la visite en cours est une COPIE de sa définition (`lancer`).
  function dansLeGuide(g, id) {
    if (!g || !id) return false;
    const est = v => !!v && v.id === id;
    return est(g.page) || (g.ici || []).some(est) || (g.ailleurs || []).some(a => (a.gestes || []).some(est));
  }
  // Les entrées du menu « Guide-moi », prêtes pour `RowMenu.ouvrir`. L'application prête ses gestes :
  // lancer une visite, ce qui lui manque encore (`manque`, la MÊME fonction que celle qui refuserait
  // au lancement — 9.4.5), si elle est faite, ce qu'elle change aux données (`avertir` : l'exemple
  // qu'on quitte ou qu'on charge), le nom d'un onglet, l'article de la page. Les DEUX applications
  // passent par ici : un menu recopié aurait divergé au premier ajustement (7.29.0).
  function menuDuGuide(g, o) {
    const x = o || {};
    const bas = t => String(t || '').charAt(0).toLowerCase() + String(t || '').slice(1);
    const avertir = v => (x.avertir && x.avertir(v)) || '';
    // Une visite mise en pause se REPREND là où on l'a laissée : l'entrée le dit (« Reprendre », l'étape,
    // « en pause ») et relance à cette étape — sans quoi « Guide-moi » la recommençait au début, pendant
    // que « Me guider » proposait de la reprendre (vu à la souris, 10.14.1).
    const pause = v => { try { return (x.reprise && x.reprise(v)) || null; } catch (_) { return null; } };
    const enPause = r => `Arrêtée à l'${bas(r.texte)}${r.note ? ' — ' + r.note : ''}.`;
    const geste = v => {
      const m = x.manque ? x.manque(v) : null;
      const r = m ? null : pause(v);
      const hint = m ? 'Pas encore : ' + bas(m.texte)
        : [r ? enPause(r) : v.resume || '', avertir(v)].filter(Boolean).join(' ');
      return { icon: 'reprendre', label: r ? 'Reprendre : ' + bas(v.titre) : v.titre, hint, note: r ? 'en pause' : v.duree || '',
        fait: !m && !r && !!(x.fait && x.fait(v)), off: !!m, run: () => (r ? x.lancer(v, r.i) : x.lancer(v)) };
    };
    // Ce qu'on peut faire MAINTENANT passe devant ce qui attend un préalable : « Rapprocher la banque »,
    // grisé faute de relevé, était en tête au-dessus de « Importer le relevé » qui le débloque (vu en
    // guidant un débutant, 26/09). L'ordre du contenu est gardé à l'intérieur de chaque moitié.
    const ordre = l => {
      const m = v => { try { return !!(x.manque && x.manque(v)); } catch (_) { return false; } };
      return l.filter(v => !m(v)).concat(l.filter(m));
    };
    const actions = [];
    // Ce qui parle de LA page vient d'abord, ensemble : sa visite et son article. L'article en bas d'une
    // longue liste se perdait sous les gestes (vu à la souris sur l'accueil : sept gestes, l'article
    // hors de l'écran).
    if (g.page || x.article) {
      actions.push({ titre: x.titrePage || 'Cette page' });
      if (g.page) {
        const r = pause(g.page);
        const fait = !r && !!(x.fait && x.fait(g.page));
        actions.push({ icon: 'reprendre', label: r ? 'Reprendre la visite de la page' : fait ? 'Revoir la visite de la page' : 'Visite de la page',
          hint: r ? [enPause(r), g.page.resume || ''].filter(Boolean).join(' ')
            : [g.page.resume || '', 'Ce que fait chaque bouton, en ' + (g.page.duree || 'une minute') + '.'].filter(Boolean).join(' '),
          note: r ? 'en pause' : '', fait, run: () => (r ? x.lancer(g.page, r.i) : x.lancer(g.page)) });
      }
      if (x.article) actions.push({ icon: 'texte', label: `Lire l'article « ${x.article.titre} »`, hint: 'Le pourquoi, les règles et les pièges de cette page, expliqués en détail.', run: x.article.ouvrir });
    }
    if (g.ici.length) { actions.push({ titre: 'Ce que tu peux faire ici' }); ordre(g.ici).forEach(v => actions.push(geste(v))); }
    g.ailleurs.forEach(a => {
      const nom = (x.libelleOnglet && x.libelleOnglet(a.onglet)) || a.onglet.cle;
      actions.push({ titre: `Sur l'onglet « ${nom} »` });
      ordre(a.gestes).forEach(v => actions.push(geste(v)));
    });
    if (x.tout) {
      if (actions.length) actions.push({ sep: true });
      actions.push({ icon: 'loupe', label: 'Toutes les visites guidées', hint: 'La découverte avec l\'exemple, chaque geste pas à pas, et où tu en es.', run: x.tout });
    }
    return actions;
  }
  // Le mot de la fin peut dépendre de ce qui a été fait (« Ton comptable est relié » seulement si son
  // fichier l'est) : une fonction se lit au moment de la fin, jamais au lancement.
  function selonFin(x) {
    if (typeof x !== 'function') return x || '';
    try { return x() || ''; } catch (_) { return ''; }
  }
  function issueDeFin(butAtteint, passes) {
    if (butAtteint === true) return 'bravo';
    if (butAtteint === false) return 'echec';
    return (passes || []).length ? 'passe' : 'bravo';
  }
  function phrasePasses(passes) {
    const l = [...new Set(passes || [])].map(t => `« ${h(t)} »`);
    if (!l.length) return '';
    const liste = l.length === 1 ? l[0] : l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1];
    return `Tu as passé ${liste} : ${l.length > 1 ? 'ces gestes ne sont donc pas faits' : 'ce geste n\'est donc pas fait'}.`;
  }
  // Le texte d'une fin qui n'est pas un bravo : ce qui a été passé, puis ce qui manque (le mot de la
  // visite, sinon la phrase générale), puis le chemin pour la refaire — dit une fois.
  const REFAIRE = 'Tu peux refaire la visite maintenant — ou plus tard, depuis « Me guider ».';
  const ECHEC_GENERAL = 'La visite est allée jusqu\'au bout, mais rien n\'a été enregistré : la fenêtre s\'est peut-être fermée sans « Enregistrer », ou une étape a été passée.';
  function texteDeFin(issue, passes, echec) {
    if (issue === 'bravo') return '';
    const passe = phrasePasses(passes);
    // La phrase générale devine une cause (« la fenêtre s'est peut-être fermée… ») : quand un geste a
    // été passé, la cause est connue et vient d'être dite.
    const manque = issue === 'passe' || (!echec && passe) ? '' : String(echec || ECHEC_GENERAL).replace(/\s*Tu peux (?:la )?refaire la visite[^.]*\.\s*$/, '');
    return [passe, manque, REFAIRE].filter(Boolean).join(' ');
  }
  // La personne a fini d'ESSAYER : la bulle revient à sa place, sur l'étape où elle était — sur sa
  // page, et son onglet, si l'essai l'en a éloignée.
  function reprendre() {
    if (!cur) return;
    const e = etape();
    cur.essai = null; cur.mini = false; cur.couvert = false; cur.geste = 0;
    // L'essai a refermé ce que l'étape montrait (« Annuler » dans le récapitulatif) : reprendre, c'est
    // revenir au geste qui l'ouvre — l'étape décrirait sinon une fenêtre qui n'est plus là.
    if (e && !cur.fin && e.cible && !cibleDe(e) && sourceDefaite(e)) { revenirAuGeste(); return; }
    if (e && !cur.fin) {
      const dest = typeof e.retour === 'string' ? e.retour : pageDe(e);
      if (dest && typeof dest === 'string' && !pageOk(e)) { try { hote.aller(dest); } catch (_) { /* rien */ } }
      const prep = e.retablir || e.avant;
      if (typeof prep === 'function') { try { prep(); } catch (_) { /* rien */ } }
    }
    cur.t0 = Date.now(); cur.perdu = false; cur.defile = false; cur.couper = false;
    dessinerBulle();
  }
  // Revenir au geste qui ouvrait ce que l'étape montrait, en le disant.
  const RETOUR_GESTE = 'Ce que je te montrais s\'est refermé — une fenêtre annulée, peut-être. On revient au geste qui l\'ouvre, ou tu passes cette étape.';
  // Le geste à refaire : celui qui ouvrait ce que l'étape montrait — et, s'il n'est plus faisable
  // d'ici, celui qui le rendait faisable. « Relancer par email » vit dans un menu que l'« Annuler » a
  // refermé : on revient à « Actions », qui le rouvre. Le bouton et le geste lisent la MÊME réponse.
  function gesteARefaire() {
    if (!cur) return -1;
    let k = gesteQuiOuvre(cur.p.etapes, cur.i);
    while (k > 0) {
      const g = cur.p.etapes[k];
      if (!g.cible || cibleDe(g) || pageDe(g) || typeof g.avant === 'function' || typeof g.deplier === 'function') break;
      const j = gesteQuiOuvre(cur.p.etapes, k);
      const src = j >= 0 ? cur.p.etapes[j] : null;
      let tient = true;
      if (src && typeof src.fait === 'function') { try { tient = !!src.fait(); } catch (_) { tient = true; } }
      if (!src || tient) break;
      k = j;
    }
    return k;
  }
  function revenirAuGeste() {
    if (!cur) return;
    const k = gesteARefaire();
    if (k < 0) { reprendre(); return; }
    cur.consequences = false;
    cur.noteProchaine = 'Ce que je te montrais s\'est refermé : on reprend au geste qui l\'ouvre.';
    entrer(k, 1);
  }
  // Refaire la visite depuis le début — celle d'origine, pas la copie dépliée en route.
  function recommencer() {
    if (!cur) return;
    const p = hote.parcours(cur.p.id) || cur.p;
    arreterSansBruit();
    lancer(p, 0);
  }
  // Un nom cité dans la bulle, cliqué : on amène son bouton à l'écran et on le fait clignoter.
  function montrerNomme(k) {
    const x = cur && cur.nommes && cur.nommes[k];
    if (!x || !x.el || !x.el.isConnected) return;
    try { x.el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* rien */ }
    cur.pointeN = k;
    cur.flash = Date.now();
  }
  // Une zone de la page perdue parce que la liste a été vidée (une recherche, un filtre) : un clic la
  // réaffiche — le bouton de la page qui efface la recherche et les filtres, que l'hôte désigne.
  function remettre() {
    if (!cur) return;
    const b = hote.remettre ? resoudre(hote.remettre) : null;
    if (b) { try { b.click(); } catch (_) { /* rien */ } }
    cur.t0 = Date.now(); cur.perdu = false; cur.defile = false; cur.couper = false;
    dessinerBulle();
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
    const prep = e.retablir || e.avant;
    if (typeof prep === 'function') { try { prep(); } catch (_) { /* rien */ } }
    cur.t0 = Date.now(); cur.perdu = false; cur.defile = false; cur.couper = false; cur.essai = null; cur.mini = false; cur.couvert = false;
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
    cur.i = cur.p.etapes.length; cur.fin = true; cur.essai = null; cur.mini = false; cur.couvert = false;
    // Une visite qui a un BUT (« un client de plus ») ne félicite que si le but est atteint : fermer
    // la fenêtre sans enregistrer, ou passer les étapes, n'est pas « Ton client est enregistré ».
    // Le but se relève à chaque tour et TERMINE la visite dès qu'il est atteint ; une PREUVE
    // (`preuve`) ne se juge qu'ici, à la fin — pour une visite qui explique encore après le geste
    // (le paquet fabriqué, puis où le trouver), ou dont le résultat peut être vrai dès l'entrée (une
    // fiche déjà complète : « Ta fiche est à jour » est vrai, sans rien retaper).
    let butAtteint = null;
    const juge = typeof cur.p.but === 'function' ? cur.p.but : typeof cur.p.preuve === 'function' ? cur.p.preuve : null;
    if (juge) {
      try { butAtteint = !!juge(cur.mesure0); } catch (_) { butAtteint = false; }
    }
    const issue = issueDeFin(butAtteint, cur.passes);
    cur.echec = issue !== 'bravo';
    cur.passe = texteDeFin(issue, cur.passes, selonFin(cur.p.echec));
    dessinerBulle();
  }
  function terminer() {
    const p = cur && cur.p;
    arreterSansBruit();
    if (p) hote.fini(p);
  }
  function quitter() {
    if (!cur) return;
    const p = cur.p, i = cur.i, compte = compteDe(cur);
    if (cur.fin) { terminer(); return; }
    arreterSansBruit();
    hote.interrompu(p, i, compte);
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
    const el = cibleDe(e);
    if (el) cur.vu = true;
    // Le geste est fait ? La preuve de l'étape (`fait`), relevée à chaque tour — et son état à
    // l'ENTRÉE, qui dit si le geste était déjà fait avant qu'on le demande.
    let faitFn = false;
    if (typeof e.fait === 'function') { try { faitFn = !!e.fait(); } catch (_) { faitFn = false; } }
    const entree = cur.faitAvant === undefined;
    // Le clic ne suffit que quand rien d'autre ne prouve le geste. Une étape qui dit ce qui le
    // prouve (`fait`) attend CETTE preuve : un « Enregistrer » refusé (un champ manque) garde sa
    // fenêtre ouverte, un choix de fichier peut être annulé — et la visite passait à la suite en
    // décrivant ce qui n'existait pas (vu à l'écran, 10.14.0 : « Où il est rangé » sur une liste vide).
    const s = {
      cible: !!e.cible, el: !!el, vu: cur.vu, facultatif: !!e.facultatif, faire: estFaire(e), mode: e.faire || '',
      aFait: typeof e.fait === 'function', fait: faitFn, faitAvant: entree ? undefined : cur.faitAvant, entree,
      clic: !!(cur.clic && Date.now() - cur.clic > 80), clicRecent: !!cur.clic,
      geste: !!cur.geste, essai: !!cur.essai, t: Date.now() - cur.t0,
      defait: !el && !!e.cible && sourceDefaite(e)
    };
    let d = decider(s);
    cur.faitAvant = faitFn;
    // Le geste qu'on disait « déjà fait » a été défait : l'étape redevient une demande.
    if (cur.dejaFait && !faitFn && typeof e.fait === 'function') { cur.dejaFait = false; dessinerBulle(); }
    // Une étape facultative dont la zone n'est jamais venue sur cet écran se saute, dans le sens où l'on va.
    if (d === 'sauter') { entrer(cur.i + (cur.sens || 1), cur.sens || 1); return; }
    // La cible a disparu parce qu'on a pris de l'avance (deux champs remplis d'un coup, une fenêtre
    // validée par Entrée) : si l'une des étapes suivantes est déjà à l'écran, on y va. Sinon, on juge
    // l'étape comme si de rien n'était — un clic sur la cible qui a changé la page la fait avancer.
    if (d === 'avance') {
      const etapes = cur.p.etapes;
      for (let j = cur.i + 1; j < Math.min(etapes.length, cur.i + 5); j++) {
        const f = etapes[j];
        let garder = true;
        try { garder = !f.si || !!f.si(); } catch (_) { garder = false; }
        if (garder && f.cible && pageOk(f) && cibleDe(f)) { entrer(j, 1); return; }
      }
      d = decider(Object.assign({}, s, { geste: false }));
    }
    if (d === 'valeur') {
      const pret = typeof e.fait === 'function' ? faitFn : !!(el && String(el.value || '').trim());
      // Déjà rempli en arrivant (une prestation prise au catalogue remplit la désignation, le client
      // est déjà choisi) : la bulle le DIT, au lieu de demander d'écrire ce qui est écrit (vu à la
      // souris, 10.14.1). Vidé ensuite, l'étape redevient une demande.
      const dejaRempli = dejaRempliDe(pret, entree, cur.dejaRempli);
      if (pret !== cur.pret || dejaRempli !== !!cur.dejaRempli) { cur.pret = pret; cur.dejaRempli = dejaRempli; dessinerBulle(); }
      return;
    }
    if (d === 'avancer') { entrer(cur.i + 1, 1); return; }
    if (d === 'dejaFait') { cur.dejaFait = true; dessinerBulle(); return; }
    if (d === 'attendre' || d === null) return;
    // La cible a-t-elle disparu ? Pas tout de suite : une fenêtre met un instant à s'ouvrir.
    // Perdue parce que le geste d'avant est défait : la bulle propose de le refaire. Jugé ICI, après la
    // « prise d'avance » — un « Annuler » cliqué pendant l'étape est un geste, et la première décision
    // était « avance » (vu à la souris, 10.14.1 : « On s'est perdus de vue » au lieu de « Revenir à »).
    const perdu = d === 'perdu';
    const defait = perdu && !!s.defait;
    if (perdu !== cur.perdu || defait !== !!cur.defait) { cur.perdu = perdu; cur.defait = defait; dessinerBulle(); return; }
    // Une liste dont les boutons ont changé (un onglet redessiné, une liste chargée) se redit. On
    // compte les contrôles BRUTS — sans demander d'explication à l'hôte toutes les 180 ms.
    if (e.liste && el && !cur.perdu && !cur.mini && compterBruts(e) !== cur.bruts) dessinerBulle();
    // Le bouton nommé dans « À toi » est arrivé (ou a changé de nom) : on redit la phrase.
    if (el && !cur.mini && typeof e.action === 'string' && e.action.includes('{bouton}') && libelleCible(e) !== cur.libelle) dessinerBulle();
  }
  // Les gestes de la PERSONNE pendant l'étape — jamais ceux de la visite (un onglet qu'elle ouvre
  // elle-même par `click()` n'est pas un geste : `isTrusted` est faux). Un geste autorise la « prise
  // d'avance » ; un clic sur un contrôle de la page, pendant qu'on REGARDE, ouvre l'ESSAI.
  // Taper dans un champ n'en ouvre pas : on écrit là où la bulle le montre, rien ne s'ouvre dessous.
  const INTERACTIF = 'button, a[href], select, summary, label, [role=button], [role=tab], [role=option], [role=menuitem], [data-open], tr[data-id], .combo-btn, input[type=checkbox], input[type=radio], input[type=file]';
  function noterGeste(ev) {
    if (!cur || cur.fin || !ev || ev.isTrusted === false) return;
    const t = ev.target;
    if (!t || !t.closest || t.closest('#visite-bulle')) return;
    cur.geste = Date.now();
    if (ev.type !== 'pointerdown' || cur.essai || cur.attente) return;
    const e = etape();
    if (!e || estFaire(e) || !ouvreEssai(t)) return;
    cur.essai = { x: ev.clientX, y: ev.clientY };
    dessinerBulle();
  }
  // Un clic ouvre l'essai s'il vise un CONTRÔLE — pas s'il entre dans une case pour y écrire. Chaque
  // case des formulaires vit dans un `<label class="field">`, et `label` est un contrôle : cliquer dans
  // « Banque » pour taper le nom rangeait la bulle dans un coin (« Vas-y, essaie »), au milieu de la
  // phrase qu'elle expliquait (vu au guide, un comptable débutant, 10.14.1). Le bouton « i » posé DANS
  // le libellé reste un contrôle : c'est le plus proche qui décide. Pure (sur `closest`).
  const CHAMP_TEXTE = 'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit]), textarea';
  function ouvreEssai(t) {
    const x = t && t.closest ? t.closest(INTERACTIF) : null;
    if (!x) return false;
    if (String(x.tagName || '').toUpperCase() !== 'LABEL') return true;
    const c = x.control || (x.querySelector ? x.querySelector('input, select, textarea') : null);
    return !(c && c.matches && c.matches(CHAMP_TEXTE));
  }
  // La TOUCHE qu'une étape « valeur » annonce (« Tape le jour, puis Entrée ») est un geste : elle
  // fait avancer, une fois la case remplie. Sans elle, la bulle disait « puis Entrée », la personne
  // appuyait sur Entrée — et la visite restait sur « J'attends ton geste », sans « Suivant » quand
  // une liste s'était ouverte dessous (vu au guide, un comptable débutant, 10.14.1). Pure.
  function toucheAvance(e, key, shift) {
    // Une étape « valeur », ou une étape à LIRE posée sur une case (la pièce, facultative) : jamais
    // un clic attendu, que la touche ne remplace pas.
    if (!e || !e.touche || (estFaire(e) && e.faire !== 'valeur')) return false;
    if (key === 'Tab' && shift) return false;
    return [].concat(e.touche).includes(key);
  }
  function avancerAuClavier(ev) {
    if (!cur || cur.fin || !ev || ev.isTrusted === false) return;
    const e = etape();
    if (!toucheAvance(e, ev.key, ev.shiftKey)) return;
    const el = cibleDe(e);
    if (!el || !(el === ev.target || (el.contains && el.contains(ev.target)))) return;
    const i = cur.i;
    // Après l'application : c'est souvent la touche elle-même qui remplit la case (Tab solde la pièce).
    setTimeout(() => {
      if (!cur || cur.fin || cur.i !== i) return;
      if (e.faire === 'valeur') {
        let pret = false;
        try { pret = typeof e.fait === 'function' ? !!e.fait() : !!String(el.value || '').trim(); } catch (_) { pret = false; }
        if (!pret) return;
        cur.pret = true;
      }
      suivant();
    }, 90);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', noterGeste, true);
    document.addEventListener('input', noterGeste, true);
    document.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') noterGeste(ev); avancerAuClavier(ev); }, true);
  }
  // Le clic sur la cible se lit en CAPTURE, avant que la page ne le traite : un bouton qui redessine
  // la page aura disparu au moment où l'on regarderait.
  if (typeof document !== 'undefined') document.addEventListener('click', ev => {
    if (!cur || cur.fin) return;
    const e = etape();
    if (!e || e.faire !== 'clic') return;
    if (els.bulle && els.bulle.contains(ev.target)) return;
    if (viseLaCible(e.cible, resoudre(e.cible), ev.target)) cur.clic = Date.now();
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
  // Un TROU du voile : ses coordonnées sont des propriétés CSS du rectangle SVG — c'est ce qui les
  // fait glisser d'une étape à l'autre (une transition CSS), comme le reste du projecteur.
  const poserTrou = (node, r) => Object.assign(node.style, { x: r.l + 'px', y: r.t + 'px', width: Math.max(0, r.r - r.l) + 'px', height: Math.max(0, r.b - r.t) + 'px' });
  const RIEN = { l: 0, t: 0, r: 0, b: 0 };
  const dedans = (a, b) => a.l >= b.l - 2 && a.r <= b.r + 2 && a.t >= b.t - 2 && a.b <= b.b + 2;
  // Ce qu'on éclaire d'un contrôle décrit par la liste : son CHAMP entier (le libellé, sa bulle « i »
  // et la case), pas la seule case — sinon « Nom du cabinet » s'allume sans son nom. Un conteneur
  // plus haut qu'un champ ordinaire n'est pas un champ : on garde le contrôle seul.
  function cadreDe(el) {
    if (!el || !el.isConnected || !visible(el)) return null;
    const f = el.closest ? el.closest('.field, label.check') : null;
    if (f && f !== el) { const b = f.getBoundingClientRect(); if (b.height > 0 && b.height <= 160) return f; }
    return el;
  }
  // Les trous d'une étape « liste » (PUR : les tests le jouent) : chaque contrôle décrit, visible à
  // l'écran, hors de la partie éclairée, et pas deux fois le même endroit.
  function trousDeListe(rects, r, ecran) {
    const out = [];
    for (const rx of rects || []) {
      if (!rx || rx.b < 0 || rx.t > ecran.h || rx.r < 0 || rx.l > ecran.w) continue;
      if (r && dedans(rx, r)) continue;
      if (out.some(o => dedans(rx, o))) continue;
      out.push(rx);
    }
    return out;
  }

  function positionner() {
    if (!els.bulle) return;
    const e = cur.fin ? {} : etape();
    if (!e) return;
    const W = window.innerWidth, H = window.innerHeight;
    const el = cur.fin || cur.attente ? null : cibleDe(e);
    const zoneEl = el && e.zone ? (resoudre(e.zone) || el) : zoneDeLaCase(el);
    const faire = estFaire(e) && !cur.fin;
    // En RETRAIT pendant un essai, ou quand une liste est ouverte par-dessus la page : la bulle se
    // range dans un coin et rien ne s'assombrit — ce qu'on vient d'ouvrir se voit en entier.
    const listes = cur.fin ? [] : listesOuvertes();
    const couvre = cur.fin || cur.essai ? null : fenetreQuiCouvre(zoneEl);
    if (couvre) listes.push(couvre);
    // La FIN attend que la fenêtre ouverte par le dernier geste se referme : la carte « Ta pièce est
    // validée » se posait par-dessus le compte rendu qui donne le numéro — ce qu'on vient de faire,
    // caché par sa propre célébration (vu à la souris, 10.14.1). En attendant, la bulle réduite.
    const finAttend = !!cur.fin && !!fenetreOuverte();
    if (finAttend) listes.push(fenetreOuverte());
    const mini = finAttend || (!cur.fin && (!!cur.essai || listes.length > 0));
    if (mini !== !!cur.mini || !!couvre !== !!cur.couvert) { cur.mini = mini; cur.couvert = !!couvre; dessinerBulle(); }
    let r = null;
    if (zoneEl) {
      // Amener la cible à l'écran UNE fois par étape : la ramener à chaque image empêcherait de
      // faire défiler la page pour regarder autour.
      if (!cur.defile && !cur.mini) {
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
    const anneau = els.anneau, point = els.point;
    // L'ombre : seulement quand on REGARDE. Pendant un geste, rien ne s'assombrit — une liste qui
    // s'ouvre sous la cible doit rester lisible et cliquable ; pendant un essai non plus.
    const ombre = !faire && !cur.mini && (r || !e.cible || cur.fin || cur.perdu);
    els.voile.toggleAttribute('hidden', !ombre);
    // Les boutons que la bulle NOMME, hors de la zone : un trou chacun dans le voile (ils sont en
    // pleine lumière, on voit qu'on peut les cliquer), et un anneau fin qui attire l'œil.
    const nommes = !cur.fin && !cur.perdu && !cur.mini && !faire ? (cur.nommes || []) : [];
    const horsZone = [];
    for (const x of nommes) {
      if (!x.el || !x.el.isConnected || !visible(x.el)) continue;
      const rx = rect(x.el, 4);
      if (rx.b < 0 || rx.t > H || rx.r < 0 || rx.l > W) continue;
      if (r && dedans(rx, r)) continue;
      horsZone.push(rx);
    }
    // Les contrôles que la LISTE de la bulle décrit, hors de la partie éclairée : un trou chacun,
    // sans anneau. Un grand panneau se DÉCOUPE pour laisser la place de la bulle (`decouperHaut`), et
    // la liste parlait d'« Email du cabinet » ou du « Jour de relance » restés dans l'ombre, sous la
    // découpe (vu à la souris dans les Réglages du Cabinet, 10.14.1) — Skander : « quand le guide me
    // parle d'une action, il faut que je puisse appuyer dessus, pas qu'elle s'affiche en sombre ».
    const trous = ombre && !cur.fin && !cur.perdu && !cur.mini && !faire
      ? horsZone.concat(trousDeListe((cur.items || []).flatMap(x => [x.el, ...(x.autres || [])]).map(cadreDe).filter(Boolean).map(c => rect(c, 4)), r, { w: W, h: H }))
      : horsZone;
    if (ombre) {
      poserTrou(els.trou, r && !cur.perdu ? r : { l: W / 2, t: H / 2, r: W / 2, b: H / 2 });
      const NS = 'http://www.w3.org/2000/svg';
      while (els.extras.childNodes.length < trous.length) {
        const t = document.createElementNS(NS, 'rect');
        t.setAttribute('rx', '9'); t.setAttribute('ry', '9'); t.setAttribute('fill', '#000');
        els.extras.appendChild(t);
      }
      [...els.extras.childNodes].forEach((t, k) => poserTrou(t, trous[k] || RIEN));
    }
    while (els.nommes.childNodes.length < horsZone.length) { const d = document.createElement('div'); d.className = 'visite-nomme'; els.nommes.appendChild(d); }
    [...els.nommes.childNodes].forEach((d, k) => { d.hidden = !horsZone[k]; if (horsZone[k]) poser(d, horsZone[k]); });
    // Pendant un ESSAI, pas d'anneau : la page a pu changer, et le même sélecteur désignerait
    // l'en-tête d'un autre écran (vu à la souris : « Nouveau devis » cerclé comme « Le haut de la page »).
    anneau.hidden = !r || cur.perdu || !!cur.essai || !!cur.couvert;
    anneau.classList.toggle('pulse', faire && !cur.mini);
    if (r) poser(anneau, r);
    // Le second anneau : le bouton dont parle la ligne survolée de la bulle — ou le nom survolé
    // dans son texte (il clignote un instant quand on clique ce nom).
    const it = cur.pointe >= 0 && cur.items ? cur.items[cur.pointe] : null;
    const nm = !it && cur.pointeN >= 0 && cur.nommes ? cur.nommes[cur.pointeN] : null;
    const cibleP = (it && it.el) || (nm && nm.el) || null;
    const vu = !!cibleP && cibleP.isConnected && visible(cibleP) && !cur.mini;
    point.hidden = !vu;
    point.classList.toggle('flash', !!(vu && nm && cur.flash && Date.now() - cur.flash < 1400));
    if (vu) poser(point, rect(cibleP, 3));
    // Une GRANDE fenêtre ne laisse pas la place d'une bulle entière à côté d'elle : posée dessus, la
    // bulle cachait trois champs du contrat récurrent (vu à la souris, 10.14.1). Elle se rétrécit pour
    // tenir dans la marge quand la marge le permet (`largeurPres`) ; sinon la règle ordinaire.
    const fenEl = !cur.mini && r && !cur.perdu && zoneEl && zoneEl.closest ? zoneEl.closest('.modal') : null;
    const etroite = fenEl ? largeurPres(rect(fenEl, 0), { w: W, h: H }, els.bulle.classList.contains('liste') ? LARGEUR_LISTE : LARGEUR_BULLE) : null;
    const voulue = etroite ? etroite + 'px' : '';
    if (els.bulle.style.width !== voulue) els.bulle.style.width = voulue;
    const bw = els.bulle.offsetWidth, bh = els.bulle.offsetHeight;
    let pos;
    if (cur.mini) {
      // Le coin qui ne couvre ni la liste ouverte, ni l'endroit du clic, ni la cible du geste attendu.
      const evites = listes.map(x => rect(x, 8));
      if (cur.essai) evites.push({ l: cur.essai.x - 40, t: cur.essai.y - 40, r: cur.essai.x + 40, b: cur.essai.y + 40 });
      if (faire && r) evites.push(r);
      pos = placerMini({ w: W, h: H }, { w: bw, h: bh }, evites);
    } else {
      const champ = el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || (el && el.classList && el.classList.contains('combo-btn'));
      pos = placerPres(cur.perdu ? null : r, fenEl ? rect(fenEl, 0) : null, { w: bw, h: bh }, { w: W, h: H }, { pref: e.cote, reserveDessous: faire && champ });
    }
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

  // Reste-t-il, après l'étape `i`, une page à LIRE sur l'écran (PUR : les tests le jouent) ? Son
  // nombre de blocs n'est connu qu'une fois la page dessinée : le total ne se donne pas avant.
  const enAttenteDe = (etapes, i) => (etapes || []).some((x, j) => j > i && x && typeof x.deplier === 'function');
  // Où aller après une lecture, quand une reprise vise une étape plus loin (PUR) : le prochain onglet
  // à lire avant elle — ses blocs n'existent qu'une fois ouvert —, sinon l'étape elle-même (la
  // dernière, si la page a rapetissé depuis). Les onglets arrivent DANS la lecture qu'on vient de
  // faire : on cherche dès l'étape qui vient d'être remplacée.
  function versLaReprise(etapes, depuis, viser) {
    const l = etapes || [];
    const k = l.findIndex((x, j) => j >= depuis && j <= viser && x && typeof x.deplier === 'function');
    return k >= 0 ? { i: k, fini: false } : { i: Math.max(0, Math.min(viser, l.length - 1)), fini: true };
  }
  // Une case « à remplir » déjà remplie en ARRIVANT se dit (PUR) ; remplie pendant l'étape, c'est le
  // geste attendu ; vidée ensuite, l'étape redevient une demande — et le reste.
  const dejaRempliDe = (pret, entree, avant) => !!pret && (!!entree || !!avant);
  // Où reprendre une visite de geste dont la cible n'est PAS à l'écran (PUR : `vu(j)` dit si la cible
  // de l'étape j est là, et si l'on est sur sa page). Une fenêtre qu'un rechargement ou « Guide-moi » a
  // refermée ne se rouvre pas toute seule : on remonte au CLIC qui l'ouvre (« Nouveau client… »),
  // puis, s'il n'est pas à l'écran non plus, au clic d'avant. Toutes les étapes d'« Ajouter un
  // client » déclarent la même page : `etapeAvecPage` reprenait donc sur le champ TVA d'une fenêtre
  // fermée, et la bulle décrivait un champ absent (vu à la souris, 10.14.1). Sans clic pour la
  // rouvrir, la règle d'avant : la dernière étape qui dit où aller.
  function repriseDuGeste(etapes, i, vu) {
    const l = etapes || [];
    const clicAvant = j => { for (let k = j - 1; k >= 0; k--) { const e = l[k]; if (e && e.faire === 'clic' && !e.facultatif) return k; } return -1; };
    let j = Math.min(i, l.length - 1);
    for (let n = 0; n < l.length && j >= 0; n++) {
      const v = vu(j) || {};
      if (v.present && v.pageOk) return j;
      const k = clicAvant(j);
      if (k < 0) break;
      const vk = vu(k) || {};
      // Hors de sa page, le clic y mène — mais jamais avant la dernière étape qui CHANGE de page :
      // un brouillon de devis ouvert se rejoint par sa page, sans refaire le devis.
      if (!vk.pageOk && typeof pageDe(l[k]) === 'string') return Math.max(k, changementDePage(l, i));
      j = k;
    }
    return etapeAvecPage(l, i);
  }
  // La dernière étape, jusqu'à `i`, dont la page DIFFÈRE de celle de l'étape d'avant (PUR) : là où la
  // visite change d'écran. Une page répétée d'étape en étape ne dit pas où aller, elle le rappelle.
  function changementDePage(etapes, i) {
    let avant = null, dernier = 0;
    for (let j = 0; j <= Math.min(i, (etapes || []).length - 1); j++) {
      const p = pageDe(etapes[j]);
      if (typeof p !== 'string') continue;
      if (p !== avant) dernier = j;
      avant = p;
    }
    return dernier;
  }
  // La dernière étape, en remontant depuis `i`, qui dit où aller (sa page) : c'est d'elle qu'une
  // visite arrêtée au milieu d'un geste peut repartir.
  function etapeAvecPage(etapes, i) {
    for (let j = Math.min(i, (etapes || []).length - 1); j > 0; j--) if (typeof pageDe(etapes[j]) === 'string') return j;
    return 0;
  }
  // Ce que l'hôte retient d'une étape : le nombre d'étapes connues, et s'il reste une page à lire —
  // auquel cas ce nombre n'est pas un total.
  // Le point d'arrêt retient le TITRE de l'étape, pas seulement son rang (10.14.1) : une visite qui
  // gagne des étapes d'une version à l'autre rangerait sinon la reprise sur une autre étape — vu en
  // suivant « Déclarer la TVA » : arrêtée au portail, elle reprenait sur « Préparer », en sautant
  // l'étape du brouillard qui la précède désormais.
  const compteDe = c => ({ n: c && c.p ? c.p.etapes.length : 0, attente: !!(c && c.p && enAttenteDe(c.p.etapes, c.i)),
    titre: c && c.p && c.p.etapes[c.i] ? String(c.p.etapes[c.i].titre || '') : '' });
  // Où reprend une visite en pause, et ce qu'on peut en dire (PUR : « Me guider » des deux
  // applications l'appelle). Une visite de page se RELIT : l'étape retenue dépasse les deux étapes
  // de sa définition, et son total n'est connu que si la page avait fini d'être lue. La version
  // d'avant écrivait « Étape 2 sur 2 » d'une page arrêtée au premier de ses blocs, et reprenait au
  // premier bloc quel que soit celui où l'on s'était arrêté (vu à la souris, 10.14.1).
  function pointDeReprise(v, r) {
    const etapes = (v && v.etapes) || [];
    const lue = enAttenteDe(etapes, -1);
    let brut = Math.max(0, Math.floor(Number(r && r.i) || 0));
    // Le rang ne désigne plus la même étape (la visite a changé depuis l'arrêt) : on la retrouve par
    // son titre, et si elle n'existe plus, on repart du début — jamais d'une étape au hasard.
    const titre = r && r.titre ? String(r.titre) : '';
    let change = false;
    if (titre && !lue && !(etapes[brut] && String(etapes[brut].titre || '') === titre)) {
      const j = etapes.findIndex(e => String(e.titre || '') === titre);
      brut = j >= 0 ? j : 0;
      change = j < 0;
    }
    const n = Math.floor(Number(r && r.n) || 0);
    // Le plafond : le nombre d'étapes connu quand on s'est arrêté (une page relue), sinon la définition.
    const plafond = lue ? (n > 0 ? n : brut + 1) : etapes.length;
    const arret = Math.min(brut, Math.max(0, plafond - 1));
    // Un geste arrêté au milieu repart de l'étape qui ouvre son écran (le même calcul que `lancer`,
    // depuis « Me guider » où aucune cible d'un geste n'est à l'écran) — et la carte le dit.
    const i = lue ? arret : etapeAvecPage(etapes, arret);
    const sur = lue ? (r && r.attente === false && n > 0 ? n : 0) : etapes.length;
    return { i, sur, texte: sur > 1 ? `Étape ${i + 1} sur ${sur}` : `Étape ${i + 1}`,
      note: change ? 'la visite a changé depuis : on repart du début' : i < arret ? `tu étais à l'étape ${arret + 1} : on repart de l'écran où ce geste commence` : '' };
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
    // Une page encore à LIRE plus loin (ses blocs ne sont connus qu'une fois à l'écran) : on ne donne
    // pas un total qui va changer — « Étape 1 sur 2 », puis « Étape 2 sur 5 », se lisait comme une
    // erreur (vu à la souris, 10.14.1).
    const enAttente = !avecChapitres && enAttenteDe(p.etapes, cur.i);
    const sur = avecChapitres ? `Chapitre ${k + 1} sur ${chaps.length}` : enAttente ? `Étape ${cur.i + 1}` : n > 1 ? `Étape ${cur.i + 1} sur ${n}` : 'Visite guidée';
    const lieu = (avecChapitres && c.titre) || p.titre || '';
    // La barre : un segment par chapitre (celui en cours se remplit étape par étape), sinon un segment
    // par étape, sinon — au-delà de douze étapes, ou quand le compte n'est pas encore connu — une seule jauge.
    let segs;
    if (avecChapitres) segs = chaps.map((_, j) => (j < k ? 100 : j > k ? 0 : Math.round(dansChap / tailleChap * 100)));
    else if (enAttente) segs = [Math.min(30, Math.round((cur.i + 1) / (n + 4) * 100))];
    else if (n <= 12) segs = Array.from({ length: n }, (_, j) => (j <= cur.i ? 100 : 0));
    else segs = [Math.round((cur.i + 1) / n * 100)];
    const courant = avecChapitres ? k : (n <= 12 && !enAttente) ? cur.i : 0;
    // Le segment courant se REMPLIT depuis sa valeur précédente quand on avance : on voit le progrès.
    const avant = cur.sens > 0 ? (avecChapitres ? (dansChap > 1 ? Math.round((dansChap - 1) / tailleChap * 100) : 0) : (n > 12 && !enAttente) ? Math.round(cur.i / n * 100) : 0) : null;
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
    const cle = cur.fin ? (cur.mini ? 'fin-attend' : 'fin') : cur.i + (cur.perdu ? 'p' : '') + (cur.attente ? 'a' : '');
    const neuve = cur.dessine !== cle;
    cur.dessine = cle;
    if (cur.fin && cur.mini) { dessinerFinAttente(p); return; }
    if (cur.fin) { dessinerFin(p, neuve); return; }
    const e = etape();
    const faire = estFaire(e);
    const t = enTete(p);
    const coul = couleurDe(cur.i);
    [els.anneau, els.point, els.voile, els.nommes].forEach(x => teinter(x, coul));
    if (cur.mini) { dessinerMini(e, t, coul, faire); return; }
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
    // Une zone de page perdue avec une liste vidée : le remède est de réafficher la liste, pas de
    // naviguer — on est déjà sur la bonne page.
    const remise = cur.perdu && e.liste && hote.remettre ? resoudre(hote.remettre) : null;
    // Ce qu'un geste avait ouvert s'est refermé : le remède est de refaire CE geste.
    const source = cur.perdu && cur.defait ? cur.p.etapes[gesteARefaire()] : null;
    const pied = cur.perdu ? `
        <button type="button" class="vb-lien" data-v="passer">Passer cette étape</button>
        ${remise ? '<button type="button" class="vb-suiv" data-v="remettre">Réafficher toute la liste</button>'
          : source ? `<button type="button" class="vb-suiv" data-v="regeste">Revenir à « ${h(nettoie(source.titre || '') || 'l\'étape d\'avant')} »</button>`
          : pageDe(e) || e.retour ? '<button type="button" class="vb-suiv" data-v="retour">M\'y ramener</button>' : '<button type="button" class="vb-suiv" data-v="fermer">Arrêter la visite</button>'}`
      : faire ? `
        <button type="button" class="vb-lien" data-v="passer">Passer cette étape</button>
        ${e.faire === 'valeur'
          ? `<button type="button" class="vb-suiv" data-v="suiv" ${cur.pret ? '' : 'disabled'}>${h(e.bouton || 'C\'est fait')}</button>`
          : cur.dejaFait
            ? `<button type="button" class="vb-suiv" data-v="suiv">${dernier ? 'Terminer' : `Suivant${FLECHE}`}</button>`
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
        ? source
          ? `<h3 id="visite-titre">Ça s'est refermé</h3>
           <div class="vb-texte">${RETOUR_GESTE}</div>`
          : `<h3 id="visite-titre">On s'est perdus de vue</h3>
           <div class="vb-texte">${e.perdu || 'L\'endroit que je voulais te montrer n\'est plus à l\'écran : tu as peut-être changé de page ou fermé une fenêtre. Pas de souci — je peux t\'y ramener, ou tu passes cette étape.'}${remise ? '<p><b>Réafficher toute la liste</b> efface la recherche et les filtres : ce que je voulais te montrer revient.</p>'
             : e.liste ? '<p>Remets l\'écran comme il était pour le revoir, ou passe cette étape.</p>' : ''}</div>`
        : `<h3 id="visite-titre">${h(e.titre || '')}</h3>
           ${cur.note ? `<div class="vb-note" role="status">${h(cur.note)}</div>` : ''}
           ${e.texte ? `<div class="vb-texte">${e.texte}</div>` : ''}
           ${liste}
           ${faire && e.action ? (cur.dejaFait
             ? `<div class="vb-afaire fait"><span class="vb-atoi">${ICONE_COCHE}Déjà fait</span><span class="vb-action">C'est déjà fait : ${action(e)} Tu peux passer à la suite.</span></div>`
             : e.faire === 'valeur' && cur.dejaRempli
               ? `<div class="vb-afaire fait"><span class="vb-atoi">${ICONE_COCHE}Déjà rempli</span><span class="vb-action">Cette case est déjà remplie : garde ce qui est écrit ou change-le, puis clique sur <b>« ${h(e.bouton || 'C\'est fait')} »</b>.</span></div>`
               : `<div class="vb-afaire"><span class="vb-atoi">${ICONE_MAIN}À toi</span><span class="vb-action">${action(e)}</span></div>`) : ''}
           ${noteEssai(e, faire) ? `<div class="vb-essai-note">${ICONE_MAIN}<span>Tu peux cliquer ce qui est éclairé pour l'essayer : je m'efface le temps que tu regardes, puis tu reprends la visite.</span></div>` : ''}
           ${t.prochain && !faire ? `<div class="vb-prochain">Ensuite : <b>${h(t.prochain)}</b></div>` : ''}`}
      </div>
      <div class="vb-pied">${pied}</div>${chapSuiv}${astuce}`;
    typographier(els.bulle);
    // Les boutons que le texte NOMME : trouvés sur l'écran, éclairés, et chaque nom devient un lien
    // qui montre son bouton (survol : un anneau ; clic : on l'amène à l'écran).
    cur.nommes = cur.perdu ? [] : nommesDe(e, [...els.bulle.querySelectorAll('.vb-texte, .vb-action')].map(x => x.textContent).join(' '));
    lierNommes(els.bulle, cur.nommes);
    // Pendant un geste, le curseur reste dans l'application : lui voler le focus empêcherait de
    // taper dans le champ que la bulle désigne. Quand on regarde, il va sur « Suivant » — sauf si
    // l'on regarde un CHAMP : on a peut-être envie d'y écrire tout de suite.
    const cibleEl = cibleDe(e);
    const champ = cibleEl && /^(INPUT|SELECT|TEXTAREA)$/.test(cibleEl.tagName);
    if ((!faire || cur.dejaFait) && !cur.perdu && !champ) focaliser('.vb-suiv');
  }

  // « Tu peux cliquer ce qui est éclairé » se dit UNE fois par visite, sur la première étape qui
  // éclaire quelque chose — le redire à chaque bulle, c'est une phrase qu'on apprend à sauter.
  function noteEssai(e, faire) {
    if (faire || cur.perdu || !e || !e.cible) return false;
    if (cur.noteEssai === undefined) cur.noteEssai = cur.i;
    return cur.noteEssai === cur.i;
  }

  // Chaque nom cité dans la bulle, et qu'un bouton de l'écran porte, devient un LIEN vers ce bouton.
  function lierNommes(racine, nommes) {
    if (!racine || !nommes || !nommes.length || typeof document === 'undefined' || !document.createTreeWalker) return;
    const cles = nommes.map(x => normNom(x.nom));
    for (const zone of racine.querySelectorAll('.vb-texte, .vb-action')) {
      const it = document.createTreeWalker(zone, 4 /* NodeFilter.SHOW_TEXT */);
      const noeuds = [];
      let n;
      while ((n = it.nextNode())) if (/«/.test(n.nodeValue) && !n.parentNode.closest('.vb-nomme')) noeuds.push(n);
      for (const noeud of noeuds) {
        const v = noeud.nodeValue;
        const re = /«[\s\u00a0\u202f]*([^«»]{2,80}?)[\s\u00a0\u202f]*»/g;
        let m, dernier = 0;
        const frag = document.createDocumentFragment();
        let touche = false;
        while ((m = re.exec(v))) {
          const k = cles.indexOf(normNom(m[1]));
          if (k < 0) continue;
          touche = true;
          frag.appendChild(document.createTextNode(v.slice(dernier, m.index)));
          const s = document.createElement('span');
          s.className = 'vb-nomme';
          s.dataset.v = 'nomme'; s.dataset.n = String(k);
          s.setAttribute('role', 'button'); s.setAttribute('tabindex', '0');
          s.title = 'Montrer ce bouton';
          s.textContent = m[0];
          frag.appendChild(s);
          dernier = m.index + m[0].length;
        }
        if (!touche) continue;
        frag.appendChild(document.createTextNode(v.slice(dernier)));
        noeud.parentNode.replaceChild(frag, noeud);
      }
    }
  }

  // La bulle EN RETRAIT : pendant un essai (la personne clique ce qu'on lui montre), ou pendant
  // qu'une liste est ouverte. Petite, dans un coin, sans rien assombrir : on la voit, elle ne cache
  // rien — et elle dit comment reprendre.
  function dessinerMini(e, t, coul, faire) {
    cur.items = [];
    const essai = !!cur.essai;
    const dernier = cur.i === cur.p.etapes.length - 1;
    els.bulle.className = 'visite-bulle mini' + (faire ? ' faire' : '');
    teinter(els.bulle, coul);
    // Le titre de l'étape plutôt que « À toi » : quand une liste s'ouvre sous la case (les comptes de
    // la grille), la bulle réduite était tout ce qu'on lisait — « À toi » ne disait pas ce qu'on fait.
    const titre = essai ? 'Vas-y, essaie' : cur.couvert ? 'La visite t\'attend' : faire ? (nettoie(e.titre || '') || 'À toi') : 'La visite t\'attend';
    // Une case déjà remplie n'attend plus rien : la bulle réduite (une liste s'est ouverte sous la
    // case) garde « Suivant », sinon elle disait « J'attends ton geste » d'un geste déjà fait.
    const rempli = faire && !essai && !cur.couvert && e.faire === 'valeur' && !!cur.pret;
    const texte = rempli
      ? `C'est rempli${e.touche ? ` : appuie sur <kbd>${[].concat(e.touche)[0] === 'Tab' ? 'Tab' : 'Entrée'}</kbd>, ou clique` : ' : clique'} sur <b>« ${h(e.bouton || 'C\'est fait')} »</b>.`
      : essai
      ? `Clique, ouvre, choisis : je m'efface le temps que tu regardes. Quand tu as vu, reprends l'étape <b>« ${h(e.titre || '')} »</b>.`
      : cur.couvert ? 'Une question s\'est ouverte par-dessus : réponds-y d\'abord — la visite reprend juste après, là où tu en étais.'
      : faire ? (e.action ? action(e) : '') : 'Une liste est ouverte : choisis, ou appuie sur <kbd>Échap</kbd> pour la refermer — la visite reprend juste après.';
    const pied = cur.couvert && !essai ? '' : essai
      ? `<button type="button" class="vb-lien" data-v="suiv">${dernier ? 'Terminer la visite' : 'Étape suivante ›'}</button><button type="button" class="vb-suiv" data-v="reprendre">Reprendre la visite</button>`
      : rempli ? `<button type="button" class="vb-lien" data-v="passer">Passer cette étape</button><button type="button" class="vb-suiv" data-v="suiv">${h(e.bouton || 'C\'est fait')}</button>`
      : faire ? '<button type="button" class="vb-lien" data-v="passer">Passer cette étape</button><span class="vb-attente" role="status"><span class="vb-points-attente" aria-hidden="true"><i></i><i></i><i></i></span>J\'attends ton geste</span>' : '';
    els.bulle.innerHTML = `<i class="vb-pointe" hidden></i>
      <div class="vb-haut">${tete(essai ? ICONE_MAIN : iconeDe(coul), t.sur, titre, 'fermer', 'Mettre la visite en pause (Échap)')}</div>
      <div class="vb-corps"><div class="vb-texte">${texte}</div></div>
      ${pied ? `<div class="vb-pied">${pied}</div>` : ''}`;
    typographier(els.bulle);
  }

  // La fin qui ATTEND : le dernier geste a ouvert une fenêtre (un compte rendu, une confirmation) ;
  // on la laisse lire, et la carte de fin vient quand elle se referme.
  function dessinerFinAttente(p) {
    cur.items = [];
    const coul = couleurDe(Math.max(0, p.etapes.length - 1));
    els.bulle.className = 'visite-bulle mini';
    teinter(els.bulle, coul);
    els.bulle.innerHTML = `<i class="vb-pointe" hidden></i>
      <div class="vb-haut">${tete(iconeDe(coul), h(p.titre || 'Visite guidée'), 'La visite t\'attend', 'fermer', 'Mettre la visite en pause (Échap)')}</div>
      <div class="vb-corps"><div class="vb-texte">Lis ce que la fenêtre te dit, puis ferme-la : la visite se termine juste après.</div></div>`;
    typographier(els.bulle);
  }

  // La DERNIÈRE bulle : une réussite se voit. Une médaille qui se dessine, des confettis la première
  // fois (et jamais pour quelqu'un qui a demandé moins d'animations), ce qu'on vient d'apprendre, où
  // en est son parcours, et la suite logique — on ne laisse personne devant « Terminé » et plus rien
  // à faire (7.27.0 : chaque écran finit par le geste suivant).
  function dessinerFin(p, neuve) {
    const coul = couleurVisite(p);
    [els.anneau, els.point, els.voile, els.nommes].forEach(x => teinter(x, coul));
    cur.nommes = [];
    // Le but n'est pas atteint : on ne félicite pas, on dit ce qui manque et on propose de refaire.
    if (cur.echec) {
      cur.items = [];
      els.bulle.className = 'visite-bulle fin echec' + (neuve ? ' entre' : '');
      teinter(els.bulle, coul);
      els.bulle.innerHTML = `<i class="vb-pointe" hidden></i>
        <div class="vb-haut">
          <div class="vb-medaille info" aria-hidden="true">${ICONE_INFO}</div>
          <div class="vb-fin-ou"><span class="vb-sur">Visite finie</span><span class="vb-lieu">${h(p.titre || '')}</span></div>
          <button type="button" class="vb-fermer" data-v="abandon" aria-label="Fermer la visite" title="Fermer">${SVG('<path d="M6 6l12 12M18 6L6 18"/>')}</button>
        </div>
        <div class="vb-corps">
          <h3 id="visite-titre">Ce n'est pas encore fait</h3>
          <div class="vb-texte">${cur.passe}</div>
        </div>
        <div class="vb-pied"><button type="button" class="vb-prec" data-v="abandon">Fermer</button><button type="button" class="vb-suiv" data-v="recommencer">Recommencer la visite${FLECHE}</button></div>`;
      typographier(els.bulle);
      focaliser('[data-v="recommencer"]');
      return;
    }
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
        <h3 id="visite-titre">${h(selonFin(p.bravo) || 'C\'est fait !')}</h3>
        <div class="vb-texte">${selonFin(p.conclusion) || 'Tu sais maintenant le faire. Tu retrouveras cette visite, et toutes les autres, dans « Me guider ».'}</div>
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
    // Le geste est FAIT dès que la carte de réussite s'affiche : attendre « Terminer » laissait, à qui
    // fermait l'application sur cette carte, une visite « arrêtée à l'étape 2 sur 2 » à reprendre
    // (vu en guidant un débutant, 26/09). Après les confettis, qui lisent « déjà fait ».
    if (neuve) { try { hote.fini(p); } catch (_) { /* « Terminer » l'enregistrera */ } }
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
    // Une classe que ce bloc est seul à porter parmi ses voisins le désigne mieux que son rang : un
    // bloc qui apparaît au-dessus (un bandeau, une ligne d'aide) décale tous les rangs d'en dessous.
    const ETATS = /^(on|active|open|ouvert|up|glisse|th-.*)$/;
    while (n && n !== racine && n.parentElement) {
      if (n.id) { parts.unshift('#' + esc(n.id)); return parts.join(' > '); }
      const par = n.parentElement;
      const voisins = [...par.children].filter(x => x !== n);
      const cls = [...n.classList].find(c => !ETATS.test(c) && !voisins.some(v => v.classList && v.classList.contains(c)));
      parts.unshift(cls ? `${n.tagName.toLowerCase()}.${esc(cls)}` : `${n.tagName.toLowerCase()}:nth-child(${[...par.children].indexOf(n) + 1})`);
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
        // Un conteneur sans titre à lui (une DIV, une SECTION d'onglet) se traverse : ses panneaux sont
        // les blocs. Les Réglages du Cabinet rangent chaque onglet dans une <section> — lue d'un bloc,
        // ses cinq panneaux devenaient une seule étape « Ton cabinet » de treize boutons (10.14.1).
        if (prof < 4 && c.children.length && (c.matches(DESCENDRE) || (/^(DIV|SECTION)$/.test(c.tagName) && !c.querySelector(':scope > h2, :scope > h3')))) { walk(c, prof + 1); continue; }
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
      // Le bloc lu sur l'écran EXISTE : il n'est pas facultatif. S'il disparaît en route (une
      // recherche qui vide la liste, un onglet changé), la visite le DIT au lieu de sauter l'étape en
      // silence — et de finir d'elle-même sur « Tu connais cette page » (vu à la souris, 10.14.1).
      const etape = { cible: sel, el: b, liste: true, titre, texte, cote: b.getBoundingClientRect().width > window.innerWidth * 0.55 ? 'dessous' : undefined,
        perdu: `Je ne retrouve plus <b>${h(titre || 'ce bloc')}</b> à l'écran : une recherche ou un filtre a peut-être tout masqué, ou tu as changé d'onglet.` };
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
      // 1. le dictionnaire. Une entrée écrite pour CE bouton (son identifiant) passe avant une FAMILLE
      // (un sélecteur), quel que soit l'ordre du fichier : « .modal-actions .btn-primary » — « Valide ce
      // que tu viens de saisir dans la fenêtre » —, écrit plus haut, répondait pour « Importer un
      // paquet… » posé dans l'état vide d'une PAGE, et masquait l'entrée `#imp` écrite exprès pour lui
      // (10.14.0, vu au test humain du Cabinet). Une explication fausse est pire qu'une absente.
      const r1 = [], r2 = [];
      B.forEach((x, i) => (x.id ? r1 : r2).push(i));
      for (const i of r1.concat(r2)) {
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
  // Le titre et le mot d'un bloc de l'écran (pour les visites de page), lus dans la table `ZONES`. Un
  // mot peut être une FONCTION du bloc : il dit alors ce que CE bloc montre (le haut d'une page, plus bas).
  function zoneur(ZONES) {
    return function zone(el) {
      for (const z of ZONES) {
        let ok = false;
        try { ok = el.matches(z.sel); } catch (_) { ok = false; }
        if (ok) {
          const titre = z.sel === '.banner' ? nettoie((el.querySelector('b') || el).textContent).slice(0, 80) : z.titre;
          let texte = z.texte;
          if (typeof texte === 'function') { try { texte = texte(el); } catch (_) { texte = ''; } }
          return { titre: titre || z.titre, texte: texte || '' };
        }
      }
      return null;
    };
  }
  // Le haut d'une page, dit tel qu'il EST (10.14.1). « Un seul est vert, c'est l'étape suivante » était
  // écrit pour TOUTES les pages : faux sur celles dont le vert est plus bas (un état vide qui porte son
  // bouton, U-11) et sur celles qui n'en ont pas (des Réglages au repos) — la bulle promettait un bouton
  // que l'œil cherchait en vain. `phraseDuHaut` est pure ; `texteDuHaut` lit l'écran et lui passe ce
  // qu'il y voit, nommé : un « bouton vert » sans son nom ne se retrouve pas d'un coup d'œil.
  function phraseDuHaut(o) {
    const x = o || {};
    const vert = x.vertHaut ? ` Le bouton vert, <b>« ${h(x.vertHaut)} »</b>, est l'étape suivante : c'est le geste qu'on attend de toi ici.`
      : x.vertBas ? ` Aucun n'est vert ici : l'étape suivante est plus bas, en vert — <b>« ${h(x.vertBas)} »</b>.`
      : ' Aucun n\'est vert : sur cette page, rien ne presse — chaque geste attend que tu en aies besoin.';
    return 'Le titre dit où tu es ; à droite, les gestes de la page.' + vert + (x.suite ? ' ' + x.suite : '');
  }
  function texteDuHaut(el, suite) {
    const lab = b => nettoie(b.textContent || '').slice(0, 60);
    const vif = b => visible(b) && !b.disabled;
    const haut = [...el.querySelectorAll('.btn-primary')].find(vif);
    const vue = (el.closest && el.closest('#view')) || document;
    const bas = haut ? null : [...vue.querySelectorAll('.btn-primary')].find(b => vif(b) && !el.contains(b));
    return phraseDuHaut({ vertHaut: haut ? lab(haut) : '', vertBas: bas ? lab(bas) : '', suite });
  }

  // Ce que l'hôte peut demander : où en est-on ? (pour la palette, la barre, les tests)
  function enCours() {
    if (!cur) return null;
    const k = chapitreDe(cur.chaps || [], cur.i);
    return { id: cur.p.id, index: cur.i, total: cur.p.etapes.length, fin: !!cur.fin, perdu: !!cur.perdu,
      chapitre: (cur.chaps && cur.chaps.length > 1) ? k : null, items: (cur.items || []).length };
  }

  // L'étape courante, telle qu'elle est écrite : l'instrument `e2e:cabinet-visites` en a besoin pour
  // JOUER le geste qu'elle demande (sa cible, son essai) — une copie, jamais l'objet du parcours.
  // Sans l'élément lu sur l'écran (`el`) : une copie qui traverse le pont de l'instrument se sérialise.
  const etapeCourante = () => { const e = etape(); if (!e) return null; const c = Object.assign({}, e); delete c.el; return c; };

  const api = { installer, lancer, quitter, enCours, etapeCourante, suivant, precedent, chapitreSuivant, reprendre, gestePasse, consequenceDuGeste, gesteQuiOuvre, issueDeFin, phrasePasses, texteDeFin, selonFin, finsHonnetes,
    toucheAvance, ouvreEssai, pagesDuGeste, ongletDuGeste, guideDeLaPage, dansLeGuide, menuDuGuide, placerBulle, placerPres, largeurPres, zoneDeLaCase, placerMini, typo, chevauche, decouperHaut, trousDeListe, hautPourBulle, hautPourCouper, viseLaCible, estFaire, decider, enAttenteDe, compteDe, pointDeReprise, etapeAvecPage, repriseDuGeste, changementDePage, versLaReprise, dejaRempliDe, normNom, nomsCites, lieuDe, ouvrirOnglet,
    chapitres, resoudre, visible, listerControles, etapesDeLaVue, blocsDe, cheminDe, PATIENCE, PATIENCE_FACULTATIVE, CONTROLES,
    nettoie, libelleDe, resumeBulle, routeDe, expliqueur, zoneur, phraseDuHaut, texteDuHaut };
  global.Visite = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
