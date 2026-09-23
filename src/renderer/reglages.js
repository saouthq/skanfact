// Les pages de réglages des DEUX applications (7.30.0).
//
// Une page de réglages finit toujours de la même façon : elle grossit d'un panneau par version, et
// au bout de deux ans on ne sait plus dans quel onglet un réglage a été rangé. Les Paramètres de
// l'app entreprise en comptaient soixante répartis sur huit onglets, ceux du cabinet une seule page
// de deux écrans et demi. Trois choses règlent ça, et elles vivent ici plutôt qu'en double :
//
//   — le SOMMAIRE de l'onglet ouvert : ce qu'il contient, d'un coup d'œil, et un clic pour y aller ;
//   — la RECHERCHE : quand on ne sait pas où c'est, on tape son nom. Elle dit toujours dans quel
//     onglet le réglage se trouve — c'est ce qu'on apprend en cherchant ;
//   — une seule PORTE pour amener un panneau à l'écran (`montrer`), qu'on vienne du sommaire, d'un
//     résultat de recherche ou d'un lien posé ailleurs dans l'application.
//
// Le module ne connaît rien des réglages eux-mêmes : il lit l'ÉCRAN. Un panneau ajouté demain est
// trouvable le jour où il est écrit, sans qu'on ait à l'inscrire dans une liste — une table tenue à
// la main diverge toujours, et un réglage introuvable ressemble à un réglage qui n'existe pas.
//
// L'app cabinet charge `style.css` PUIS `cabinet.css` : les classes posées ici (`set-…`, `somm-…`)
// sont définies dans la feuille partagée, elles valent donc des deux côtés.
(function (global) {
  'use strict';

  const $$ = (sel, racine) => Array.from((racine || document).querySelectorAll(sel));

  // Son propre échappement : le module ne doit dépendre d'aucune des deux applications (l'une
  // appelle la sienne `h`, l'autre `esc` — c'est ce genre d'écart qui a fait planter le panneau des
  // mises à jour du cabinet en 6.8.0).
  const ech = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const sansAccents = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const motsDe = q => String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  // 10.12.0 (U-30) — la phrase d'une recherche vide suit ce qu'on a TAPÉ. « Essaie un seul mot »
  // s'affichait après un seul mot : il demandait l'impossible. Plusieurs mots : chacun doit se
  // trouver dans le réglage, on le dit. Un seul : on le nomme. Écrite ICI, une fois, pour les deux
  // applications — chacune y ajoute sa sortie par `rienTrouve(mots, phrase)`.
  const phraseRien = mots => (mots.length > 1
    ? 'Aucun réglage ne porte tous ces mots — chacun doit s\'y trouver. Essaie-les un par un.'
    : `Aucun réglage ne parle de « ${ech(mots[0] || '')} ». Essaie un mot voisin.`);

  // Le texte d'un élément, sans ce qui n'est pas du texte : les bulles « i » (dont le contenu est la
  // lettre i) et les zones de saisie (on indexe le LIBELLÉ d'un champ, jamais ce que l'utilisateur y
  // a écrit — le pied de page des documents et les huit modèles de messages y passeraient).
  function texteUtile(el) {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('button.i, textarea').forEach(x => x.remove());
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  }

  const titreDe = p => { const t = p.querySelector('h2'); return t ? texteUtile(t) : p.id; };
  // « Dossiers — plusieurs entreprises sur cet ordinateur » : ce qui suit le tiret est une
  // explication, pas un nom. Une pastille de sommaire prend le nom.
  const titreCourt = t => String(t).split(' — ')[0];

  // Trois profondeurs, et c'est ce qui fait le classement : le titre du panneau, les libellés de ses
  // champs, puis sa PROSE. La prose compte : « où je règle la copie iCloud ? » ne se répond ni par un
  // titre (« Copie externe ») ni par un libellé — le mot n'est que dans la phrase d'explication.
  // `data-mots` n'est pas un doublon de tout ça : ce sont les synonymes que personne ne lit à l'écran
  // mais que tout le monde tape — « ocr », « iban », « token », « démo ».
  function indexer(corps) {
    return $$('[data-pane] .panel', corps || document).filter(p => p.id).map(p => {
      const sec = p.closest('[data-pane]');
      const titre = titreDe(p);
      const champs = Array.from(new Set(
        $$('.fl, label.field, label.check, h3, summary', p).map(texteUtile).filter(Boolean)));
      const synonymes = p.dataset.mots || '';
      const prose = texteUtile(p);
      return {
        id: p.id, pane: sec ? sec.dataset.pane : '', titre, champs, prose,
        aTitre: sansAccents(titre + ' ' + synonymes),
        aChamps: sansAccents([titre, synonymes, champs.join(' ')].join(' ')),
        aTout: sansAccents([titre, synonymes, prose].join(' '))
      };
    });
  }

  // Surligner, c'est découper PUIS échapper morceau par morceau : échapper après aurait mangé les
  // balises qu'on vient de poser, échapper avant décalerait toutes les positions (règle 7.27.0).
  function surligner(texte, mots) {
    if (!mots || !mots.length) return ech(texte);
    const bas = sansAccents(texte);
    const coupes = [];
    mots.forEach(m => {
      const a = sansAccents(m);
      if (!a) return;
      let k = bas.indexOf(a);
      while (k >= 0) { coupes.push([k, k + a.length]); k = bas.indexOf(a, k + a.length); }
    });
    coupes.sort((x, y) => x[0] - y[0]);
    let out = '', pos = 0;
    coupes.forEach(([d, f]) => {
      if (d < pos) return;
      out += ech(texte.slice(pos, d)) + '<mark>' + ech(texte.slice(d, f)) + '</mark>';
      pos = f;
    });
    return out + ech(texte.slice(pos));
  }

  // L'extrait de prose où le mot cherché se trouve : sans lui, un résultat dont le mot n'est ni dans
  // le titre ni dans un libellé ne dit pas pourquoi il est là.
  function extrait(prose, mots) {
    const bas = sansAccents(prose);
    let i = -1;
    mots.forEach(m => { const k = bas.indexOf(sansAccents(m)); if (k >= 0 && (i < 0 || k < i)) i = k; });
    if (i < 0) return '';
    let d = Math.max(0, i - 45);
    const f = Math.min(prose.length, i + 110);
    if (d > 0) { const e = prose.indexOf(' ', d); if (e > 0 && e < i) d = e + 1; }
    return (d > 0 ? '… ' : '') + prose.slice(d, f).trim() + (f < prose.length ? ' …' : '');
  }

  // Installe les trois mécanismes sur une page déjà dessinée.
  //
  //   corps      : le conteneur de tout ce qui se masque pendant une recherche
  //   champ      : l'<input type=search>
  //   resultats  : le conteneur des résultats (masqué hors recherche)
  //   sommaire   : le conteneur des pastilles (facultatif)
  //   nomOnglet  : (pane) => libellé lisible de l'onglet
  //   ouvrirOnglet : (pane) => void — l'hôte sait seul comment basculer
  //   ongletCourant : () => pane affiché
  //   pluriel    : (n, mot) => '3 réglages'
  //   rienTrouve : (mots, phrase) => html affiché quand rien ne correspond — `phrase` est déjà
  //                écrite ici selon le nombre de mots ; l'hôte n'y ajoute que sa sortie
  //
  // Rend `{ montrer, rafraichirSommaire, chercher }`.
  function installer(opts) {
    const corps = opts.corps, champ = opts.champ, res = opts.resultats;
    const pl = opts.pluriel || ((n, m) => `${n} ${m}${n > 1 ? 's' : ''}`);
    let index = null;

    // Amener un panneau à l'écran et le désigner. C'est LA porte : le sommaire, la recherche et les
    // liens venus d'ailleurs passent tous par elle, donc l'onglet suit toujours, même quand
    // l'appelant s'est trompé d'onglet — sinon on atterrirait au bon panneau dans un écran masqué.
    function montrer(pid) {
      const cible = document.getElementById(pid);
      if (!cible) return false;
      const sec = cible.closest('[data-pane]');
      if (sec && opts.ouvrirOnglet && opts.ongletCourant && sec.dataset.pane !== opts.ongletCourant()) {
        opts.ouvrirOnglet(sec.dataset.pane);
      }
      try { cible.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { }
      cible.classList.add('flash');
      setTimeout(() => cible.classList.remove('flash'), 1600);
      return true;
    }

    function rafraichirSommaire(pane) {
      const som = opts.sommaire;
      if (!som) return;
      const panneaux = $$(`[data-pane="${pane}"] .panel`, corps || document);
      // Un panneau seul n'a pas besoin d'un sommaire d'un élément.
      som.innerHTML = panneaux.length < 2 ? '' : panneaux.map(p =>
        `<button type="button" class="somm-chip" data-somm="${ech(p.id)}">${ech(titreCourt(titreDe(p)))}</button>`).join('');
      $$('[data-somm]', som).forEach(b => b.onclick = () => montrer(b.dataset.somm));
    }

    function chercher() {
      if (!champ || !res) return;
      const brut = champ.value.trim();
      if (corps) corps.hidden = !!brut;
      res.hidden = !brut;
      if (!brut) return;
      if (!index) index = indexer(corps);
      const mots = motsDe(brut).map(sansAccents);
      const bruts = motsDe(brut);
      const trouves = index
        .filter(p => mots.every(m => p.aTout.includes(m)))
        .map(p => ({ p, rang: mots.every(m => p.aTitre.includes(m)) ? 0 : mots.every(m => p.aChamps.includes(m)) ? 1 : 2 }))
        .sort((a, b) => a.rang - b.rang)
        .map(x => x.p);
      res.innerHTML = trouves.length
        ? `<p class="small muted mb">${ech(pl(trouves.length, 'réglage'))} sur ${index.length}, le plus proche en premier.</p>
           <div class="set-hits">${trouves.map(p => {
          const lignes = p.champs.filter(t => mots.some(m => sansAccents(t).includes(m))).slice(0, 4);
          const detail = lignes.length ? lignes.join(' · ') : extrait(p.prose, mots);
          return `<button type="button" class="set-hit" data-go="${ech(p.id)}">
            <span class="set-hit-ou">${ech(opts.nomOnglet ? opts.nomOnglet(p.pane) : p.pane)}</span>
            <span class="set-hit-t">${surligner(p.titre, bruts)}</span>
            ${detail ? `<span class="set-hit-d">${surligner(detail, bruts)}</span>` : ''}
          </button>`;
        }).join('')}</div>`
        : (opts.rienTrouve ? opts.rienTrouve(bruts, phraseRien(bruts)) : `<div class="empty"><p>${phraseRien(bruts)}</p></div>`);
      $$('[data-go]', res).forEach(b => b.onclick = () => {
        champ.value = ''; chercher(); montrer(b.dataset.go);
      });
      if (opts.apresResultats) opts.apresResultats(res);
    }

    if (champ) {
      champ.oninput = chercher;
      // Échap vide le champ : c'est le geste attendu dans une recherche, et il n'y a rien d'autre à
      // fermer ici. Sans `stopPropagation`, il remonterait au garde-fou global de la page.
      champ.onkeydown = e => { if (e.key === 'Escape' && champ.value) { e.stopPropagation(); champ.value = ''; chercher(); } };
    }
    return { montrer, rafraichirSommaire, chercher };
  }

  global.Reglages = { texteUtile, titreDe, titreCourt, indexer, surligner, extrait, sansAccents, installer };
})(typeof window !== 'undefined' ? window : globalThis);
