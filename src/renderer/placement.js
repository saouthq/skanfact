// La hauteur d'une fenêtre — PARTAGÉE par les deux applications.
//
// Skander, en regardant la question « Revoir l'assistant ? » : « le toast de confirmation est trop
// haut, il devrait être au milieu non ? ». Oui, pour une question COURTE : ancrée à 10 % du haut,
// une confirmation de 160 px laissait six cents pixels de vide sous elle, et paraissait pendre au
// bord de l'écran. Mais une fenêtre LONGUE (la fiche d'un client, un paiement) doit rester ancrée
// en haut : centrée, elle se RECENTRE en grandissant, et le bouton qu'on visait remonte sous le
// curseur au moment du clic — le défaut que la 10.12.0 avait corrigé en ancrant tout en haut.
//
// La règle tient les deux : à l'ouverture, la fenêtre se pose à son CENTRE OPTIQUE — quatre dixièmes
// de l'espace libre au-dessus, six en dessous, parce que l'œil situe le milieu d'un écran un peu
// au-dessus du milieu géométrique. Ensuite elle ne bouge plus : elle grandit vers le bas, et ne
// remonte que si elle allait sortir de l'écran, jamais pour se recentrer. Une fenêtre haute tombe
// naturellement sur la hauteur minimale (`--haut-fenetre`) ; une question tombe au milieu du regard.
// Une seule règle, pour toutes les fenêtres et l'écran de verrouillage des deux applications.
//
// La palette (Ctrl K) et l'assistant n'y passent PAS : la palette grandit avec ses résultats et doit
// garder son champ de recherche immobile (c'est la convention de toute palette de commandes), et
// l'assistant change de hauteur à chaque étape — centré, son en-tête sauterait d'un écran à l'autre.
(function (global) {
  'use strict';

  // Ce qui est placé, et par qui : la fenêtre dans son fond, la carte dans l'écran de verrouillage.
  const CIBLES = '.modal-bg > .modal, #lock-screen > .lock-card';
  const PART_AU_DESSUS = 0.4;

  // PUR, et c'est lui que les tests jouent : le haut d'une fenêtre de hauteur `h` dans un écran de
  // hauteur `H`, entre une marge haute `min` (jamais plus haut) et une marge basse `bas`.
  function hautOptique(h, H, min, bas) {
    const optique = Math.round((H - h) * PART_AU_DESSUS);
    const tientDessous = Math.round(H - bas - h);
    return Math.max(min, Math.min(optique, tientDessous));
  }
  // Après l'ouverture : on ne redescend jamais, on remonte seulement ce qu'il faut pour rester dans
  // l'écran. Une fenêtre qui gagne une ligne pendant qu'on la remplit ne se déplace donc pas.
  function hautApresCroissance(courant, h, H, min, bas) {
    return Math.max(min, Math.min(courant, Math.round(H - bas - h)));
  }

  function marges(el) {
    const c = getComputedStyle(el.parentElement);
    const H = window.innerHeight;
    return { H, min: parseFloat(c.paddingTop) || 0, bas: Math.max(parseFloat(c.paddingBottom) || 0, Math.round(H * 0.03)) };
  }
  function poser(el, haut, m) { el.style.marginTop = Math.max(0, haut - m.min) + 'px'; el._hautPlace = haut; }

  function placer(el) {
    if (!el || !el.isConnected) return;
    const h = el.getBoundingClientRect().height;
    if (!h) return;                           // pas encore visible : l'observateur rappellera
    const m = marges(el);
    if (el._hautPlace === undefined) poser(el, hautOptique(h, m.H, m.min, m.bas), m);
    else poser(el, hautApresCroissance(el._hautPlace, h, m.H, m.min, m.bas), m);
  }
  const suivies = new Set();
  let observateur = null;
  function suivre(el) {
    if (suivies.has(el)) return;
    suivies.add(el);
    placer(el);
    if (observateur) observateur.observe(el);
  }
  function installer() {
    if (typeof ResizeObserver !== 'undefined') observateur = new ResizeObserver(es => es.forEach(e => placer(e.target)));
    const scanner = racine => {
      if (!racine || !racine.querySelectorAll) return;
      if (racine.matches && racine.matches(CIBLES)) suivre(racine);
      racine.querySelectorAll(CIBLES).forEach(suivre);
    };
    scanner(document);
    new MutationObserver(ms => ms.forEach(m => {
      m.addedNodes.forEach(n => { if (n.nodeType === 1) scanner(n); });
      m.removedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        for (const el of [...suivies]) if (!el.isConnected) { suivies.delete(el); if (observateur) observateur.unobserve(el); }
      });
    })).observe(document.documentElement, { childList: true, subtree: true });
    // L'écran change de taille : on repart de la règle d'ouverture, sur la nouvelle hauteur.
    window.addEventListener('resize', () => suivies.forEach(el => { el._hautPlace = undefined; placer(el); }));
  }

  const api = { hautOptique, hautApresCroissance, CIBLES, PART_AU_DESSUS, installer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Placement = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installer);
    else installer();
  }
})(typeof window !== 'undefined' ? window : globalThis);
