// Les nouveautés d'une version, dites à tout le monde — PARTAGÉ par les deux applications (10.14.1, S-06).
//
// Skander : « à chaque nouvelle version, quand on relance l'application, présenter la nouvelle version
// avec les modifications, compréhensibles par tous ». Le CHANGELOG est écrit pour qui maintient le
// logiciel ; ces phrases-ci sont écrites pour qui s'en sert : ce qui change dans SES gestes, sans un
// mot technique. Une carte au coin de l'écran, au premier lancement de la version — jamais par-dessus
// une question, jamais à une installation neuve (tout y est nouveau), une fois, puis plus jamais.
//
// La table vit ICI et nulle part ailleurs : un test exige une entrée pour la version de package.json,
// donc chaque version publiée arrive avec ses phrases (une liste vide dit « rien de visible »). Et une
// phrase qui cite un bouton « entre guillemets » le cite tel que l'application l'écrit (un test le lit).
(function (global) {
  'use strict';

  // Les plus récentes en tête. `commun` vaut pour les deux applications ; `entreprise` et `cabinet` pour
  // la leur seule. Une phrase = un geste qui change, dit du côté de celui qui le fait.
  const NOTES = [
    {
      version: '10.14.1',
      commun: [
        '« Guide-moi », en haut de chaque page, liste tout ce que tu peux faire ici et te montre où cliquer, pas à pas.',
        'La visite guidée n\'avance plus toute seule : elle attend ton clic sur « Suivant », ou le geste qu\'elle te demande.',
        'Quand une page met du temps à se calculer, « Chargement… » s\'affiche : l\'application travaille, elle n\'est pas bloquée.',
        'Si tu reçois les versions d\'essai, une version stable plus récente t\'est maintenant proposée, sans décocher la case.'
      ],
      entreprise: [
        'Tes justificatifs se retrouvent par la recherche, et un 📎 marque chaque ligne qui en porte un.',
        'Une facture payable le jour même n\'affiche plus qu\'une seule date : « À réception ».',
        'Un acompte demandé en montant fait exactement ce montant, timbre compris.',
        'Un fichier joint qu\'aucun programme n\'ouvre est montré dans son dossier, au lieu de ne rien faire.'
      ],
      cabinet: [
        'Une écriture reçue avec son justificatif porte un 📎, et l\'ouvre depuis le paquet.',
        'Un fichier qu\'aucun programme n\'ouvre est montré dans son dossier, au lieu de ne rien faire.'
      ]
    }
  ];

  // « 10.14.1-beta.2 » compte comme la 10.14.1 : les phrases décrivent une version, pas un essai.
  function base(v) { return String(v || '').replace(/^v/, '').split('-')[0]; }
  function comparer(a, b) {
    const x = base(a).split('.').map(Number), y = base(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
    return 0;
  }

  // PUR, et c'est lui que les tests jouent. `vue` : la dernière version dont on a montré les nouveautés
  // (vide = jamais) ; `installationNeuve` : rien n'a encore été saisi — tout est nouveau, rien ne change.
  // Rend les entrées à montrer, de la plus récente à la plus ancienne, avec les seules phrases de `app`.
  function aMontrer(vue, version, app, installationNeuve) {
    if (installationNeuve) return [];
    if (vue && comparer(vue, version) >= 0) return [];
    return NOTES
      .filter(n => comparer(n.version, version) <= 0 && (!vue || comparer(n.version, vue) > 0))
      // Sans trace d'une version vue (une installation d'avant ce mécanisme), on ne remonte pas
      // l'histoire : seule la version en cours se présente.
      .filter(n => vue || comparer(n.version, version) === 0)
      .map(n => ({ version: n.version, points: (n.commun || []).concat(n[app] || []) }))
      .filter(n => n.points.length);
  }

  // La typographie française, posée ici : la carte vit hors des pages, que l'observateur de chaque
  // application ne lit pas — et un « seul en fin de ligne se lit comme une faute.
  function typo(s) {
    return String(s).replace(/« /g, '«\u202f').replace(/ »/g, '\u202f»').replace(/ ([?!;:])/g, '\u202f$1');
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function carteHtml(entrees, nomApp) {
    const v = entrees[0].version;
    const points = entrees.flatMap(e => e.points);
    return `<div class="nouv-tete"><span class="nouv-ico" aria-hidden="true">✦</span>
        <div><div class="nouv-titre">Nouveau dans ${esc(nomApp)} ${esc(v)}</div>
        <div class="nouv-sous">${entrees.length > 1 ? `Depuis ta dernière version, ${entrees.length} mises à jour` : 'Ce qui change pour toi'}</div></div></div>
      <ul class="nouv-liste">${points.map(p => `<li>${esc(typo(p))}</li>`).join('')}</ul>
      <div class="nouv-actions"><button class="btn btn-primary btn-sm" id="nouv-ok">Compris</button></div>`;
  }

  // Pose la carte, et retient la version dès qu'elle est montrée : un redémarrage ne la remontre pas.
  // `peutMontrer()` dit si l'écran est libre (pas de fenêtre, pas d'assistant, pas de visite).
  function presenter(o) {
    const cle = 'skanfact-nouveautes-vue-' + o.app;
    let vue = '';
    try { vue = localStorage.getItem(cle) || ''; } catch (_) { /* stockage indisponible : on montre une fois */ }
    const entrees = aMontrer(vue, o.version, o.app, o.installationNeuve);
    // On retient la plus RÉCENTE des deux : revenir sur une version plus ancienne (sortir de la bêta)
    // ferait sinon oublier ce qu'on a déjà lu, et la carte se remontrerait à la mise à jour suivante.
    const retenir = () => {
      if (vue && comparer(vue, o.version) >= 0) return;
      try { localStorage.setItem(cle, base(o.version)); } catch (_) { /* rien à retenir */ }
    };
    if (!entrees.length) { retenir(); return false; }
    let essais = 0;
    const tenter = () => {
      if (document.getElementById('nouveautes')) return;
      if (o.peutMontrer && !o.peutMontrer()) { if (++essais < 40) setTimeout(tenter, 1500); return; }
      const el = document.createElement('section');
      el.id = 'nouveautes';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Nouveautés de la version ' + entrees[0].version);
      el.innerHTML = carteHtml(entrees, o.nomApp);
      document.body.appendChild(el);
      retenir();
      const fermer = () => { el.classList.add('sort'); setTimeout(() => el.remove(), 180); };
      el.querySelector('#nouv-ok').onclick = fermer;
    };
    tenter();
    return true;
  }

  const api = { NOTES, aMontrer, comparer, base, carteHtml, presenter, typo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Nouveautes = api;
})(typeof window !== 'undefined' ? window : globalThis);
