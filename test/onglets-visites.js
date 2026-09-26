'use strict';
// ============================================================================================
// Une visite qui ouvre un onglet des Réglages (ou des Paramètres), puis désigne un panneau :
// l'onglet ouvert doit être CELUI où l'application range ce panneau (10.14.1).
//
// Vu à la souris dans le Cabinet : la visite « Déclarer les régimes de mes clients » ouvrait l'onglet
// « Comptabilité » pour un panneau rangé dans « Mon cabinet » — la bulle cherchait un panneau caché,
// et la visite se perdait à sa première étape. Les deux tables (où l'application range un panneau,
// ce que la visite ouvre) vivent dans deux fichiers : écrites séparément, elles divergent (7.23.0).
//
// `onglet()` des deux fichiers de visites PORTE son onglet (`barre`, `cle`) : ce module suit, étape
// par étape, l'onglet ouvert, et confronte chaque cible `#id` au panneau qui la contient — le panneau
// lui-même, ou le dernier panneau ouvert avant l'identifiant dans la page des réglages.
// ============================================================================================
module.exports = function ongletsDesVisites({ visites, app, table, appel, page, barre }) {
  const ongletDe = new Map([...app.matchAll(table)].map(m => [m[1], m[2]]));
  const marques = [...app.matchAll(new RegExp(appel + "\\('([a-z][\\w-]*)'", 'g'))];
  const panneauDe = new Map();
  if (marques.length) {
    const debut = marques[0].index, fin = marques[marques.length - 1].index + 4000;
    const zone = app.slice(debut, fin);
    let courant = null;
    for (const m of zone.matchAll(new RegExp(appel + "\\('([a-z][\\w-]*)'|id=\"([a-z][\\w-]*)\"", 'g'))) {
      if (m[1]) courant = m[1];
      else if (courant && !panneauDe.has(m[2])) panneauDe.set(m[2], courant);
    }
  }
  const fautes = [];
  let controles = 0;
  for (const v of visites) {
    let onglet = null;
    for (const e of v.etapes || []) {
      // Une étape qui change de page quitte les réglages : l'onglet ouvert ne compte plus.
      if (e.page !== undefined && e.page !== page) { onglet = null; continue; }
      if (e.avant && e.avant.barre === barre) onglet = e.avant.cle;
      if (!onglet) continue;
      for (const c of [].concat(e.cible || [], e.zone || []).filter(x => typeof x === 'string')) {
        const m = /#([a-z][\w-]*)/.exec(c);
        if (!m) continue;
        const pan = ongletDe.has(m[1]) ? m[1] : panneauDe.get(m[1]);
        if (!pan || !ongletDe.has(pan)) continue;
        controles++;
        if (ongletDe.get(pan) !== onglet) fautes.push(`« ${v.titre || v.id} » ouvre l'onglet « ${onglet} » et vise ${c}, rangé dans « ${ongletDe.get(pan)} »`);
      }
    }
  }
  return { fautes, controles, panneaux: ongletDe.size, identifiants: panneauDe.size };
};
