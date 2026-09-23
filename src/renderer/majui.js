// L'écran des mises à jour, LE MÊME dans les deux applications (23/09/2026).
//
// Skander : « au niveau UI/UX je veux le même workflow que Apple pour la mise à jour, même UI et
// fonctionnement, car le nôtre est un peu archaïque ». Il l'était : un numéro, une phrase, un bouton
// gris, et un exemple de numéro de bêta écrit à la main et faux depuis des mois. Et surtout deux
// écrans recopiés l'un de l'autre, qui avaient déjà commencé à diverger (identifiants, phrases,
// boutons) : un mécanisme recopié ne diverge pas peut-être, il diverge (7.29.0).
//
// Ce qu'on reprend du panneau « Mise à jour de logiciels » de macOS et de la fenêtre de Sparkle :
//  - en tête, l'application et sa version, comme une fiche « À propos » ;
//  - UN bloc d'état qui répond à la seule question qu'on se pose — « suis-je à jour ? » — avec une
//    coche verte, ou la mise à jour disponible et sa progression, ou « prête » et le bouton qui
//    redémarre ;
//  - dessous, des LIGNES de réglage (« Mises à jour automatiques », « Versions d'essai ») avec leur
//    valeur ou leur interrupteur à droite ;
//  - quand une version finit de se télécharger, une fenêtre qui dit ce qu'elle apporte et propose
//    « Plus tard » ou « Redémarrer maintenant » — une fois par jour au plus, jamais par-dessus une
//    autre question.
//
// Le module ne parle à aucun pont : il rend du HTML et des décisions, et chaque application branche
// ses boutons (les identifiants portent un préfixe, `upd` chez l'entreprise, `u` au Cabinet). Chargé
// par les DEUX `index.html` et entré dans les `files` de `build/cabinet.config.js` : un fichier
// partagé a trois branchements.
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.MajUI = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Une taille lisible, à la française : « 38,2 Mo ».
  function taille(octets) {
    const n = Number(octets);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} Ko`;
    return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
  }

  const jour = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  };

  // Même règle que `src/canaux.js` (comparer des NOMBRES, une préversion avant sa version) : le
  // renderer ne peut pas charger un module Node, et ce calcul décide d'une seule phrase.
  function comparer(a, b) {
    const lire = v => { const [x, pre] = String(v || '').replace(/^v/, '').split('-'); return { n: x.split('.').map(Number), pre: pre || '' }; };
    const x = lire(a), y = lire(b);
    for (let i = 0; i < 3; i++) if ((x.n[i] || 0) !== (y.n[i] || 0)) return (x.n[i] || 0) < (y.n[i] || 0) ? -1 : 1;
    if (x.pre === y.pre) return 0;
    if (!x.pre) return 1;
    if (!y.pre) return -1;
    return x.pre.localeCompare(y.pre, 'en', { numeric: true });
  }
  const memeBase = (a, b) => String(a || '').split('-')[0] === String(b || '').split('-')[0];

  // Ce que la ligne « Versions d'essai » dit du canal — avec le VRAI numéro publié, ou sans numéro.
  // `canaux` vient de `src/canaux.js` : { stable: {version, publie}, essai: {version, publie} } ou null.
  function phraseEssai(canaux) {
    const stable = canaux && canaux.stable, essai = canaux && canaux.essai;
    if (!essai) return 'Les versions d\'essai arrivent avant les autres et peuvent contenir des défauts. À laisser désactivé sur l\'ordinateur qui sert à travailler.';
    if (!stable || comparer(essai.version, stable.version) > 0) {
      return `Version d'essai en cours : <b>${esc(essai.version)}</b>${essai.publie ? `, publiée le ${esc(jour(essai.publie))}` : ''}. Elle peut contenir des défauts : à laisser désactivé sur l'ordinateur qui sert à travailler.`;
    }
    return memeBase(essai.version, stable.version)
      ? `Aucun essai en cours : la dernière version d'essai (${esc(essai.version)}) est devenue la ${esc(stable.version)}.`
      : 'Aucune version d\'essai en cours.';
  }

  // Les notes de version (la section du CHANGELOG, en Markdown) en HTML sûr : on échappe D'ABORD,
  // puis on remet la mise en forme — l'inverse laisserait passer du HTML (même règle que
  // `notesHtml` dans l'app entreprise, 7.x). Un lien devient son seul texte.
  function enLigne(t) {
    return esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  }
  function notesHtml(md) {
    const lignes = String(md || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!lignes.length) return '';
    let out = '', liste = false;
    for (const l of lignes) {
      if (/^[-*] /.test(l)) { if (!liste) { out += '<ul>'; liste = true; } out += `<li>${enLigne(l.slice(2))}</li>`; continue; }
      if (liste) { out += '</ul>'; liste = false; }
      if (/^#+ /.test(l)) out += `<h3>${enLigne(l.replace(/^#+ /, ''))}</h3>`;
      else out += `<p>${enLigne(l)}</p>`;
    }
    if (liste) out += '</ul>';
    return `<div class="notes-md">${out}</div>`;
  }

  const ICONES = {
    coche: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>',
    fleche: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v9"/><path d="m8 12.5 4 4 4-4"/></svg>',
    alerte: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 11v6"/><path d="M12 7.5h.01"/></svg>'
  };

  // Le bloc d'état. `o` : { p (préfixe des identifiants), nom, a (l'état de l'application : version,
  // packaged, lastResult…), u (l'état en cours : state, version, percent, transferred, total,
  // message, detail, soft), notes (HTML déjà sûr), quand (texte), macNonSigne, tokenManquant }.
  function etat(o) {
    const p = o.p, a = o.a || {}, u = o.u || {}, nom = esc(o.nom);
    const rechercher = `<button class="btn" id="${p}-check">Rechercher les mises à jour</button>`;
    const notes = o.notes ? `<details class="maj-notes"><summary>Plus d'infos…</summary>${o.notes}</details>` : '';
    const carte = (classe, icone, titre, sous, suite) => `<div class="maj-etat ${classe}">
      <span class="maj-pictos">${ICONES[icone]}</span>
      <div class="maj-txt"><div class="maj-titre">${titre}</div>${sous ? `<div class="maj-sous">${sous}</div>` : ''}${suite || ''}</div>
    </div>`;

    if (!a.packaged) return carte('maj-neutre', 'info', 'Mode développement', 'La recherche de mises à jour n\'est active que dans l\'application installée.', `<div class="maj-actions">${rechercher}</div>`);
    if (u.state === 'checking') return `<div class="maj-etat maj-neutre"><span class="maj-spin" role="status" aria-label="Recherche en cours"></span><div class="maj-txt"><div class="maj-titre">Recherche de mises à jour…</div></div></div>`;
    // Disponible, puis en cours de téléchargement : une seule carte, la barre avance. Le bouton qui
    // relance existe depuis la 7.30.0 (une coupure à 40 % figeait la barre pour de bon).
    if (u.state === 'available' || u.state === 'downloading') {
      const pc = Math.max(0, Math.min(100, Number(u.percent) || 0));
      const vol = u.total ? ` — ${taille(u.transferred)} sur ${taille(u.total)}` : '';
      return carte('maj-dispo', 'fleche', 'Mise à jour disponible', `${nom} ${esc(u.version)}`,
        `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><div style="width:${pc}%"></div></div>
        <div class="maj-sous">${u.state === 'available' ? 'Préparation du téléchargement…' : `Téléchargement… ${pc} %${vol}`}</div>
        ${notes}<div class="maj-actions"><button class="btn btn-ghost btn-sm" id="${p}-retry">Relancer le téléchargement</button></div>`);
    }
    // Prête : le geste qui compte est « Redémarrer maintenant ». Et « Rechercher une version plus
    // récente » reste là : une version téléchargée ne doit jamais cacher la suivante (23/09/2026).
    if (u.state === 'downloaded') {
      return carte('maj-pret', 'fleche', `${nom} ${esc(u.version)} est prête à être installée`,
        o.macNonSigne ? 'L\'application se ferme, se remplace dans le dossier Applications et se relance — une dizaine de secondes.'
          : 'L\'application se ferme, s\'installe et redémarre — quelques secondes.',
        `${notes}<div class="maj-actions"><button class="btn btn-primary" id="${p}-install">Redémarrer maintenant</button><button class="btn btn-ghost" id="${p}-check">Rechercher une version plus récente</button></div>`);
    }
    // Un échec se lit en français, le texte d'origine replié dessous (6.7.2, 7.26.0) ; ce qui n'est
    // pas une panne (`soft`) reste gris : du rouge sur une situation normale apprend à ignorer le rouge.
    if (u.state === 'error') {
      return carte(u.soft ? 'maj-neutre' : 'maj-erreur', u.soft ? 'info' : 'alerte', u.soft ? 'Rien à installer pour l\'instant' : 'La recherche n\'a pas abouti',
        esc(u.message),
        `${u.detail ? `<details class="tech"><summary>Détails techniques</summary><code>${esc(u.detail)}</code></details>` : ''}
        <div class="maj-actions"><button class="btn" id="${p}-check">Réessayer</button><button class="btn btn-ghost" id="${p}-releases">Voir les versions</button>${u.soft ? '' : `<button class="btn btn-ghost" id="${p}-log">Ouvrir le journal</button>`}</div>`);
    }
    if (u.state === 'unconfigured') return carte('maj-neutre', 'info', 'Mises à jour non configurées', 'package.json → build.publish ne désigne aucun dépôt.', `<div class="maj-actions">${rechercher}</div>`);
    if (o.tokenManquant) return carte('maj-neutre', 'info', 'Mises à jour pas encore activées', 'Colle le jeton d\'accès ci-dessous pour les recevoir sur cet ordinateur.', `<div class="maj-actions">${rechercher}</div>`);
    // Au repos : ce que la DERNIÈRE recherche a constaté, silencieuse comprise, et quand.
    if (u.state === 'none' || a.lastResult === 'none') {
      return `<div class="maj-etat maj-ajour">
        <span class="maj-pictos">${ICONES.coche}</span>
        <div class="maj-txt"><div class="maj-titre">${nom} est à jour</div><div class="maj-sous">Version ${esc(a.version)}${o.quand ? ` · vérifié ${esc(o.quand)}` : ''}</div></div>
        <div class="maj-droite">${rechercher}</div>
      </div>`;
    }
    if (a.lastResult === 'error') return carte('maj-neutre', 'info', 'La dernière recherche n\'a pas abouti', `${nom} réessaiera tout seul ; tu peux aussi relancer maintenant.`, `<div class="maj-actions">${rechercher}<button class="btn btn-ghost" id="${p}-releases">Voir les versions</button></div>`);
    return carte('maj-neutre', 'info', 'Aucune recherche encore', 'Aucune recherche de mise à jour n\'a encore eu lieu sur cet ordinateur.', `<div class="maj-actions">${rechercher}</div>`);
  }

  // Le panneau entier. `o` reprend ceux de `etat`, plus : icone (HTML de la marque), heures (rythme
  // des recherches automatiques), canaux, aideEssai (bulle « i »), avecNouveautes, fin (HTML ajouté
  // sous les lignes : le jeton d'accès, la panne de relais).
  function panneau(o) {
    const p = o.p, a = o.a || {};
    const etatEssai = !a.packaged ? '' : a.prerelease
      ? `<div class="maj-sous maj-note">${a.beta ? 'Tu tournes sur une version d\'essai : les corrections arrivent ici en premier.'
        : `Tu tournes encore sur une version d'essai (${esc(a.version)}) : ${esc(o.nom)} la remplacera par la prochaine version stable.`}</div>`
      : '';
    const auto = o.heures
      ? `Recherche toutes les ${o.heures} heures et au retour sur l'application, téléchargement en arrière-plan. Rien ne s'installe sans ton accord.`
      : 'Téléchargement en arrière-plan. Rien ne s\'installe sans ton accord.';
    return `<div class="maj">
      <div class="maj-app">
        <span class="maj-icone">${o.icone || ''}</span>
        <div class="maj-id"><div class="maj-nom">${esc(o.nom)}</div><div class="maj-ver ver">Version ${esc(a.version || '…')}${a.prerelease ? ' <span class="beta-tag">bêta</span>' : ''}</div></div>
        ${o.avecNouveautes ? `<button class="btn btn-sm btn-ghost" id="${p}-changelog">Nouveautés</button>` : ''}
      </div>
      ${etat(o)}
      <div class="maj-lignes">
        <div class="maj-ligne">
          <div class="maj-ligne-txt"><div class="maj-ligne-titre">Mises à jour automatiques</div><div class="maj-sous">${auto}</div></div>
          <span class="maj-valeur">${a.packaged ? 'Activées' : '—'}</span>
        </div>
        <div class="maj-ligne">
          <div class="maj-ligne-txt"><label class="maj-ligne-titre" for="${p}-beta">Versions d'essai</label> ${o.aideEssai || ''}<div class="maj-sous">${phraseEssai(o.canaux)}</div>${etatEssai}</div>
          <input type="checkbox" class="switch" id="${p}-beta" role="switch" aria-label="Recevoir les versions d'essai" ${a.beta ? 'checked' : ''}>
        </div>
      </div>
      ${o.fin || ''}
    </div>`;
  }

  // La fenêtre qui s'ouvre quand une version finit de se télécharger (celle de Sparkle). `o` :
  // { nom, icone, version, installee, notes (HTML sûr), macNonSigne }.
  function fenetrePrete(o) {
    return `<div class="maj-fenetre">
      <div class="maj-fenetre-tete"><span class="maj-icone grande">${o.icone || ''}</span>
        <div><h2>Une nouvelle version de ${esc(o.nom)} est prête</h2>
        <p class="maj-sous">${esc(o.nom)} ${esc(o.version)} est téléchargée${o.installee ? ` — tu as la ${esc(o.installee)}` : ''}. ${o.macNonSigne
          ? 'L\'application se fermera, se remplacera dans le dossier Applications et se relancera, en une dizaine de secondes.'
          : 'L\'application se fermera, s\'installera et redémarrera, en quelques secondes.'} Ce que tu as enregistré ne bouge pas.</p></div>
      </div>
      ${o.notes ? `<div class="maj-fenetre-notes"><div class="k-label">Nouveautés</div>${o.notes}</div>` : ''}
    </div>
    <div class="modal-actions"><button class="btn" data-close>Plus tard</button><button class="btn btn-primary" id="maj-go">Redémarrer maintenant</button></div>`;
  }

  // Quand la proposer : une fois par version et par jour au plus. `lire`/`ecrire` sont ceux du
  // stockage de l'hôte (localStorage, avec ses try/catch) — injectés pour que la règle se teste.
  const CLE = 'maj-proposee';
  const JOUR_MS = 24 * 60 * 60 * 1000;
  function doitProposer(version, lire, maintenant) {
    if (!version) return false;
    let v = null;
    try { v = JSON.parse(lire(CLE) || 'null'); } catch (_) { v = null; }
    return !(v && v.version === version && maintenant - Number(v.at || 0) < JOUR_MS);
  }
  function noterProposee(version, ecrire, maintenant) {
    try { ecrire(CLE, JSON.stringify({ version, at: maintenant })); } catch (_) { /* un rappel de trop ne casse rien */ }
  }

  return { esc, taille, comparer, phraseEssai, notesHtml, etat, panneau, fenetrePrete, doitProposer, noterProposee, ICONES, JOUR_MS };
});
