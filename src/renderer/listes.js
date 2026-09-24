// Les listes déroulantes — PARTAGÉES par les deux applications.
//
// Skander, avant la mise en production : « les dropdown, y en a qui sont natifs et y en a qui sont
// modernes. Il faut que tout soit moderne. » Il avait raison, et l'écart se comptait : 97 `<select>`
// dans l'app entreprise et 43 dans le Cabinet ouvraient la liste du SYSTÈME — grise sous Windows,
// une bulle macOS sur Mac, sans recherche — pendant que les clients, le catalogue ou les factures
// d'un avoir ouvraient la liste de SkanFact (`combo`, 2.3.0). Deux dessins pour un même geste, et
// l'application paraissait faite de deux morceaux.
//
// On ne remplace PAS les `<select>` par des combos : ils sont lus par `formValues()`, écoutés par
// des dizaines de `onchange`, réglés par le code (`sel.value = …`) et pilotés par les parcours de
// test (`selectOption`). Les réécrire un par un, c'était cent quarante occasions d'en casser un.
// Le `<select>` reste donc la SOURCE de vérité, visible et à sa place ; seul son geste change :
// le clic et le clavier ouvrent la liste de SkanFact au lieu de celle du système, et choisir une
// ligne pose la valeur puis envoie `input` et `change`, exactement comme le ferait la liste native.
// Tout ce qui écoutait le `<select>` continue d'écouter la même chose.
//
// Même principe pour les `<datalist>` (une liste de comptes proposée sous un champ libre) : le
// champ reste libre, seule la liste de propositions prend le dessin de l'application.
//
// Et le LIBELLÉ d'un champ désigne ce champ (voir `lierLibelle`) : dans un <label>, la bulle « i »
// venait avant le champ, et c'est donc ELLE que le libellé désignait — cliquer « Raison sociale »
// ouvrait l'explication au lieu de poser le curseur dans la case.
//
// Le fichier ne connaît rien du métier ni de l'application qui le charge : il s'installe tout seul
// sur le document, par délégation — un `<select>` posé demain par une page neuve est moderne le
// jour où il est écrit, sans que personne ait à y penser. `data-natif` sur un `<select>` le rend
// au système (aucun ne le porte aujourd'hui ; l'attribut existe pour qu'une exception se NOMME).
(function (global) {
  'use strict';

  const ECH = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ECH[c]);
  // Accents et majuscules ignorés, comme dans toutes les recherches de l'application (10.12.0) :
  // « societe » trouve « Société ».
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Au-delà de ce nombre de lignes, la liste porte une recherche : c'est le seuil où l'on cherche au
  // lieu de lire. En dessous, un champ de recherche au-dessus de six mois serait une décoration.
  const RECHERCHE_DES = 10;
  // Les surfaces de la liste ouverte — pour que le garde-fou global des overlays (`RowMenu.SURFACES`)
  // ne la ferme pas au moment où l'on clique dedans.
  const SURFACE = '.lm-pop';

  const estListe = el => el && el.tagName === 'SELECT' && !el.multiple && !(el.size > 1) && !el.hasAttribute('data-natif');

  let ouverte = null;   // { cible, pop, close }

  function fermer() { if (ouverte) ouverte.close(); }

  // Les lignes d'un <select>, groupes compris. Une option cachée n'est pas une option ; une option
  // éteinte se montre, grisée, et ne se choisit pas — comme dans la liste native.
  function lignesDuSelect(sel) {
    const out = [];
    const opt = (o, grpOff) => { if (!o.hidden) out.push({ opt: o, label: o.label || o.textContent.trim(), off: o.disabled || grpOff }); };
    Array.from(sel.children).forEach(c => {
      if (c.tagName === 'OPTGROUP') { out.push({ groupe: c.label }); Array.from(c.children).forEach(o => opt(o, c.disabled)); }
      else if (c.tagName === 'OPTION') opt(c, false);
    });
    return out;
  }

  // Les propositions d'une <datalist> : sa valeur, et son libellé quand il en porte un.
  function lignesDeDatalist(dl) {
    return Array.from(dl.querySelectorAll('option')).map(o => {
      const v = o.value;
      const lab = (o.label || o.textContent || '').trim();
      return { valeur: v, label: lab && lab !== v ? `${v} — ${lab.replace(new RegExp('^' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[—-]\\s*'), '')}` : v };
    });
  }

  // La liste se pose sous le champ, ou au-dessus quand la place manque dessous — dans une fenêtre
  // modale, le bas de l'écran arrive vite. Elle ne sort jamais de la fenêtre de l'application.
  function placer(pop, cible) {
    const r = cible.getBoundingClientRect();
    const larg = Math.max(r.width, 180);
    pop.style.minWidth = larg + 'px';
    pop.style.maxWidth = Math.max(larg, 440) + 'px';
    const haut = pop.offsetHeight;
    const dessous = window.innerHeight - r.bottom - 8, dessus = r.top - 8;
    const enHaut = haut > dessous && dessus > dessous;
    pop.style.top = (enHaut ? Math.max(8, r.top - haut - 5) : r.bottom + 5) + 'px';
    let x = r.left;
    if (x + pop.offsetWidth > window.innerWidth - 8) x = Math.max(8, window.innerWidth - 8 - pop.offsetWidth);
    pop.style.left = x + 'px';
    pop.classList.toggle('lm-haut', enHaut);
    return r.top;
  }

  // Ouvre la liste d'un <select> (mode 'select') ou les propositions d'un champ libre (mode 'saisie').
  function ouvrir(cible, mode) {
    fermer();
    const saisie = mode === 'saisie';
    const dl = saisie ? document.getElementById(cible.dataset.lmListe || '') : null;
    if (saisie && !dl) return;
    const lignes = saisie ? lignesDeDatalist(dl) : lignesDuSelect(cible);
    const choisissables = lignes.filter(x => !x.groupe && x.groupe !== '');
    const avecRecherche = !saisie && choisissables.length > RECHERCHE_DES;

    const pop = document.createElement('div');
    pop.className = 'lm-pop';
    pop.innerHTML = (avecRecherche ? '<input type="text" class="combo-q lm-q" placeholder="Rechercher…" autocomplete="off" spellcheck="false" aria-label="Rechercher dans la liste">' : '')
      + '<div class="combo-list lm-list" role="listbox" tabindex="-1"></div>';
    document.body.appendChild(pop);
    const q = pop.querySelector('.lm-q'), list = pop.querySelector('.lm-list');
    if (cible.id) list.setAttribute('aria-labelledby', cible.id);

    let montrees = [], i = 0;
    const courante = () => (!saisie && cible.selectedIndex >= 0 ? cible.options[cible.selectedIndex] : null);
    const marquer = () => {
      list.querySelectorAll('.combo-it').forEach(d => {
        const on = Number(d.dataset.i) === i;
        d.classList.toggle('sel', on); d.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const c = list.querySelector('.combo-it.sel'); if (c) c.scrollIntoView({ block: 'nearest' });
    };
    const dessiner = () => {
      const t = norm((saisie ? cible.value : (q ? q.value : '')).trim());
      montrees = []; let html = '', groupe = null, groupeMis = false;
      lignes.forEach(x => {
        if (x.groupe != null) { groupe = x.groupe; groupeMis = false; return; }
        // Un champ libre de comptes se cherche par le DÉBUT du numéro (« 61 » ne propose pas 261) ;
        // un mot se cherche partout dans le libellé.
        if (t && (saisie ? !(norm(x.valeur).startsWith(t) || (/\D/.test(t) && norm(x.label).includes(t))) : !norm(x.label).includes(t))) return;
        if (groupe && !groupeMis) { html += `<div class="lm-groupe">${h(groupe)}</div>`; groupeMis = true; }
        const n = montrees.length; montrees.push(x);
        const cur = !saisie && x.opt === courante();
        html += `<div class="combo-it${x.off ? ' off' : ''}${cur ? ' cur' : ''}" data-i="${n}" role="option" aria-selected="false"${x.off ? ' aria-disabled="true"' : ''}><span class="ci-main">${h(x.label)}</span></div>`;
      });
      // Une liste de propositions qui n'a rien à proposer se tait ; une liste de choix le dit.
      if (!montrees.length && saisie) { pop.hidden = true; return; }
      pop.hidden = false;
      list.innerHTML = html || '<div class="combo-empty">Aucun résultat</div>';
      // Dans un champ libre, rien n'est présélectionné : Entrée garde ce qu'on a tapé tant qu'on n'a
      // pas descendu dans la liste — sinon « 61 » devenait « 611 » sans qu'on l'ait choisi.
      i = saisie ? Math.min(i, montrees.length - 1) : Math.max(0, Math.min(i, montrees.length - 1));
      if (montrees[i] && montrees[i].off) i = suivante(i, 1);
      marquer();
    };
    const suivante = (depart, pas) => {
      for (let k = depart + pas; k >= 0 && k < montrees.length; k += pas) if (!montrees[k].off) return k;
      return depart;
    };
    const choisir = x => {
      if (!x || x.off) return;
      if (saisie) {
        cible.value = x.valeur;
        close();
        cible.focus({ preventScroll: true });
        cible.dispatchEvent(new Event('input', { bubbles: true }));
        cible.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      const avant = cible.value;
      x.opt.selected = true;
      close();
      cible.focus({ preventScroll: true });
      // Comme la liste native : un changement envoie `input` puis `change` ; re-choisir la même
      // ligne n'envoie rien.
      if (cible.value !== avant) {
        cible.dispatchEvent(new Event('input', { bubbles: true }));
        cible.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    // La touche qui se tape sur la liste : descendre, monter, choisir, renoncer.
    const touche = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); i = suivante(i, 1); marquer(); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); i = suivante(i, -1); marquer(); return true; }
      if (e.key === 'Home' && !q && !saisie) { e.preventDefault(); i = suivante(-1, 1); marquer(); return true; }
      if (e.key === 'End' && !q && !saisie) { e.preventDefault(); i = suivante(montrees.length, -1); marquer(); return true; }
      // stopPropagation : sinon Entrée valide aussi le bouton principal de la fenêtre modale, et
      // Échap ferme la fenêtre au lieu de la seule liste.
      if (e.key === 'Enter') {
        if (pop.hidden || !montrees[i]) { close(); return false; }
        e.preventDefault(); e.stopPropagation(); choisir(montrees[i]); return true;
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); if (!saisie) cible.focus({ preventScroll: true }); return true; }
      if (e.key === 'Tab') { close(); if (q) cible.focus({ preventScroll: true }); return false; }
      // Sans recherche, une lettre saute à la prochaine ligne qui commence par elle — ce que fait la
      // liste native, et ce qu'on attend d'une liste de mois ou de taux.
      if (!q && !saisie && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const l = norm(e.key);
        for (let k = 1; k <= montrees.length; k++) {
          const n = (i + k) % montrees.length;
          if (!montrees[n].off && norm(montrees[n].label).startsWith(l)) { i = n; marquer(); break; }
        }
        e.preventDefault(); e.stopPropagation(); return true;
      }
      return false;
    };

    list.addEventListener('mousedown', e => {
      e.preventDefault();
      const d = e.target.closest('.combo-it');
      if (d) choisir(montrees[Number(d.dataset.i)]);
    });
    list.addEventListener('mousemove', e => {
      const d = e.target.closest('.combo-it');
      if (d && Number(d.dataset.i) !== i && !montrees[Number(d.dataset.i)].off) { i = Number(d.dataset.i); marquer(); }
    });
    if (q) {
      q.addEventListener('keydown', touche);
      q.addEventListener('input', e => { e.stopPropagation(); i = 0; dessiner(); placer(pop, cible); });
      // Chercher n'est pas modifier : la frappe dans la recherche ne remonte pas au formulaire
      // (même règle que `combo`, 10.12.0).
      q.addEventListener('change', e => e.stopPropagation());
    }

    let departTop = 0, veille = null;
    const surDefilement = e => {
      if (pop.contains(e.target)) return;
      // Un défilement qui n'a pas BOUGÉ le champ n'est pas une raison de fermer : celui qui a amené
      // le champ à l'écran arrive parfois juste après le clic (piège 7.29.0).
      if (!cible.isConnected || Math.abs(cible.getBoundingClientRect().top - departTop) > 4) close();
    };
    const surTaille = () => close();
    function close() {
      if (!pop.isConnected) return;
      pop.remove();
      clearInterval(veille);
      document.removeEventListener('scroll', surDefilement, true);
      window.removeEventListener('resize', surTaille);
      window.removeEventListener('blur', surTaille);
      cible.removeAttribute('aria-expanded');
      if (ouverte && ouverte.pop === pop) ouverte = null;
    }

    const x0 = choisissables.findIndex(x => x.opt && x.opt === courante());
    if (saisie) i = -1;
    dessiner();
    if (!saisie) {
      i = Math.max(0, montrees.findIndex(x => x.opt && x.opt === courante()));
      if (x0 < 0 || (montrees[i] && montrees[i].off)) i = suivante(-1, 1);
      marquer();
    }
    departTop = placer(pop, cible);
    cible.setAttribute('aria-expanded', 'true');
    document.addEventListener('scroll', surDefilement, true);
    window.addEventListener('resize', surTaille);
    window.addEventListener('blur', surTaille);
    // Un champ retiré de la page (la page s'est redessinée) n'a plus de liste.
    veille = setInterval(() => { if (!cible.isConnected || !cible.getClientRects().length) close(); }, 300);
    ouverte = { cible, pop, close, touche, dessiner: () => { dessiner(); placer(pop, cible); } };
    if (q) q.focus({ preventScroll: true });
    return ouverte;
  }

  // Un <label> désigne le premier élément « étiquetable » qu'il contient — et un <button> l'est. Le
  // libellé d'un champ porte sa bulle « i » AVANT le champ (`lbl()`), donc c'est la BULLE qu'il
  // désignait : cliquer sur les mots « Raison sociale » ouvrait l'explication et donnait le focus à
  // la bulle, et survoler le champ allumait la bulle en vert. 32 libellés sur la seule page des
  // Paramètres. On lie le libellé à SON champ (`for`), qui reçoit un identifiant s'il n'en a pas ;
  // un libellé sans champ ne désigne plus rien (un clic sur ses mots n'ouvre plus rien).
  const CHAMP = 'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]), select, textarea, .combo-btn';
  let nLibelles = 0;
  function lierLibelle(lab) {
    const c = lab.control;
    if (!c || !c.matches('button.i')) return;
    const champ = lab.querySelector(CHAMP);
    if (champ) {
      if (!champ.id) champ.id = 'lm-champ-' + (++nLibelles);
      lab.htmlFor = champ.id;
    } else {
      lab.htmlFor = 'lm-sans-champ';
    }
  }
  const lierLibelles = racine => {
    if (!racine || !racine.querySelectorAll) return;
    if (racine.tagName === 'LABEL') lierLibelle(racine);
    racine.querySelectorAll('label').forEach(lierLibelle);
  };

  let installe = false;
  function installer() {
    if (installe || typeof document === 'undefined') return;
    installe = true;

    // Le clic : c'est à l'appui (mousedown) que la liste native s'ouvre ; l'empêcher là, c'est la
    // seule façon de ne jamais la voir apparaître une fraction de seconde avant la nôtre.
    document.addEventListener('mousedown', e => {
      const t = e.target;
      if (ouverte && !ouverte.pop.contains(t) && t !== ouverte.cible) fermer();
      const sel = t && t.closest && t.closest('select');
      if (!estListe(sel) || e.button !== 0) return;
      e.preventDefault();
      if (sel.disabled) return;
      if (ouverte && ouverte.cible === sel) { fermer(); return; }
      sel.focus({ preventScroll: true });
      ouvrir(sel, 'select');
    }, true);

    // Le clavier sur une liste fermée : Espace, les flèches, F4 et Alt+↓ ouvraient la liste native.
    // Entrée n'ouvre rien — dans une fenêtre, Entrée valide le bouton principal, et ça ne change pas.
    // Une lettre garde son comportement natif (elle choisit la ligne suivante qui commence par elle,
    // et envoie `change`).
    document.addEventListener('keydown', e => {
      const t = e.target;
      if (ouverte && ouverte.cible === t) { ouverte.touche(e); return; }
      if (estListe(t) && !t.disabled && (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'F4')) {
        e.preventDefault(); e.stopPropagation();
        ouvrir(t, 'select');
        return;
      }
      // Un champ libre ouvre ses propositions à la flèche du bas, comme le fait le système.
      if (t && t.dataset && t.dataset.lmListe && !t.readOnly && e.key === 'ArrowDown') {
        e.preventDefault();
        ouvrir(t, 'saisie');
      }
    }, true);

    // Les <datalist> : on retire l'attribut `list` (sinon le système pose SA liste par-dessus la
    // nôtre), on le garde sous un autre nom, et les propositions suivent la frappe.
    const neutraliser = el => {
      if (el && el.tagName === 'INPUT' && el.getAttribute('list') && !el.hasAttribute('data-natif')) {
        el.dataset.lmListe = el.getAttribute('list');
        el.removeAttribute('list');
        el.setAttribute('autocomplete', 'off');
      }
    };
    // Un libellé qui n'est PAS un <label> (un combo vit dans un `div.field`) : cliquer ses mots ne
    // faisait rien, à côté de champs dont les mots posent le curseur. Même geste partout.
    document.addEventListener('click', e => {
      const t = e.target;
      if (!t || !t.closest || e.defaultPrevented) return;
      const mots = t.closest('.fl');
      if (!mots || t.closest('button, a, input, select, textarea, label')) return;
      // Le libellé peut vivre dans une rangée (`.fl-ligne`, avec « Modifier la fiche » à côté) :
      // c'est le `.field` qu'on cherche, pas le parent immédiat.
      const bloc = mots.closest('.field');
      if (!bloc || bloc.tagName === 'LABEL') return;
      const champ = bloc.querySelector(CHAMP);
      if (champ && !champ.disabled) champ.focus();
    });

    // Le focus seul n'ouvre RIEN : une liste que personne n'a demandée, posée sous le champ, recouvre
    // le champ suivant et vole le clic qui le visait (H-E20, 10.12.0). Elle s'ouvre à la frappe.
    document.addEventListener('focusin', e => neutraliser(e.target));
    document.addEventListener('input', e => {
      const t = e.target;
      if (!(t && t.dataset && t.dataset.lmListe)) return;
      if (ouverte && ouverte.cible === t) ouverte.dessiner();
      else if (t.value) ouvrir(t, 'saisie');
    });
    document.addEventListener('focusout', e => {
      const t = e.target;
      // La liste d'un champ libre se ferme quand on le quitte — sauf si c'est pour cliquer dedans
      // (le mousedown des lignes empêche déjà la perte de focus).
      if (ouverte && ouverte.cible === t && t.dataset && t.dataset.lmListe) setTimeout(() => { if (ouverte && ouverte.cible === t && document.activeElement !== t) fermer(); }, 0);
    });
    // Un champ libre qui arrive DÉJÀ avec son `list` : on le neutralise dès qu'il existe, pour que
    // le système ne le décore pas d'une flèche avant le premier focus.
    const scanner = racine => { if (racine && racine.querySelectorAll) racine.querySelectorAll('input[list]').forEach(neutraliser); };
    scanner(document);
    lierLibelles(document);
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { neutraliser(n); scanner(n); lierLibelles(n); } })))
      .observe(document.documentElement, { childList: true, subtree: true });
  }

  const api = { installer, fermer, SURFACE, ouverte: () => ouverte, RECHERCHE_DES, lierLibelles, CHAMP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Listes = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installer);
    else installer();
  }
})(typeof window !== 'undefined' ? window : globalThis);
