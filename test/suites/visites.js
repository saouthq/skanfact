'use strict';
// ============================================================================================
// La visite guidée (10.14.0)
//
// Skander : « quelqu'un qui découvre l'application n'a pas envie de lire la page Aide ; il faut
// pouvoir toujours le guider pour chaque étape, et couvrir toute l'app » — puis : « la visite
// guidée au début, sur un exemple de données ; et quand il passe à sa vraie entreprise, la visite
// pour le guider dans chaque étape ».
//
// Ce que ces tests tiennent sans Electron : le PLACEMENT de la bulle (elle ne couvre jamais ce
// qu'elle montre et ne sort jamais de l'écran), les CHAPITRES, la forme du contenu (chaque page a
// sa visite, chaque geste attendu porte l'essai qui le rejoue, chaque visite indisponible dit
// pourquoi), et le branchement dans l'application (une seule fonction décide qu'une visite ne peut
// pas se lancer, l'exemple se charge AVANT la découverte, la vraie entreprise se retrouve AVANT
// « Démarrer dans ma vraie entreprise »). Le parcours réel qui rejoue chaque visite est
// `npm run e2e:visite`.
module.exports = ({ t, assert, lireSource }) => {
const V = require('../../src/renderer/visite.js');
const S = require('../../src/renderer/visites.js');

// Un contexte d'hôte sans Electron : les visites se construisent sans DOM (les fonctions qui en
// ont besoin ne sont appelées que pendant la visite).
const ctx = { data: () => ({ clients: [], documents: [], catalog: [] }), premier: () => null, estDemo: () => false, editeur: () => false, Visite: V, G: { INFO: {} } };
const visites = S.parcours(ctx);
const parId = id => visites.find(v => v.id === id);

t('10.14.0 : la bulle ne couvre jamais sa cible quand un côté a la place, et ne sort jamais de l\'écran', () => {
  const ecran = { w: 1440, h: 900 };
  const bulle = { w: 360, h: 240 };
  const dedans = p => p.x >= 12 && p.y >= 12 && p.x + bulle.w <= ecran.w - 12 && p.y + bulle.h <= ecran.h - 12;
  const rect = p => ({ l: p.x, t: p.y, r: p.x + bulle.w, b: p.y + bulle.h });
  // Des cibles partout : aux quatre coins, au milieu, étroites, larges — chaque fois qu'un côté a la
  // place, la bulle s'y pose sans rien recouvrir.
  const cibles = [];
  for (const l of [20, 300, 700, 1100, 1300]) for (const tp of [20, 200, 450, 700, 850]) for (const w of [40, 200]) for (const hh of [30, 120]) {
    cibles.push({ l, t: tp, r: Math.min(l + w, 1430), b: Math.min(tp + hh, 895) });
  }
  let poses = 0;
  cibles.forEach(c => {
    const p = V.placerBulle(c, bulle, ecran, {});
    assert.ok(dedans(p), `la bulle sort de l'écran pour la cible ${JSON.stringify(c)} : ${JSON.stringify(p)}`);
    if (p.cote !== 'coin') { poses++; assert.ok(!V.chevauche(rect(p), c), `la bulle couvre sa cible ${JSON.stringify(c)} (${p.cote})`); }
  });
  assert.ok(poses > cibles.length * 0.9, 'presque toutes les cibles doivent trouver un côté libre : ' + poses + '/' + cibles.length);
  // Le côté demandé passe en premier quand il a la place.
  assert.strictEqual(V.placerBulle({ l: 600, t: 400, r: 700, b: 440 }, bulle, ecran, { pref: 'dessous' }).cote, 'dessous');
  assert.strictEqual(V.placerBulle({ l: 600, t: 400, r: 700, b: 440 }, bulle, ecran, { pref: 'gauche' }).cote, 'gauche');
  // Un geste sur un champ réserve la place SOUS lui (une liste déroulante, un calendrier s'y
  // ouvrent) : la bulle ne se pose pas dessous même si on le lui demande.
  const champ = { l: 600, t: 300, r: 900, b: 336 };
  const liste = { l: champ.l, t: champ.b, r: champ.r, b: champ.b + 260 };
  const p = V.placerBulle(champ, bulle, ecran, { pref: 'dessous', reserveDessous: true });
  assert.ok(!V.chevauche(rect(p), liste) && !V.chevauche(rect(p), champ), 'la bulle se posait sur la liste qui va s\'ouvrir : ' + JSON.stringify(p));
  assert.ok(dedans(p));
  // Sans cible (une étape d'introduction) : au milieu, dans l'écran.
  const c0 = V.placerBulle(null, bulle, ecran, {});
  assert.strictEqual(c0.cote, 'centre'); assert.ok(dedans(c0));
});

t('10.14.0 : les chapitres d\'une visite se lisent sur ses étapes, et une étape « faire » se reconnaît en un seul endroit', () => {
  const e = [{ chapitre: 'A' }, {}, {}, { chapitre: 'B' }, {}, { chapitre: 'C' }];
  assert.deepStrictEqual(V.chapitres(e).map(c => [c.titre, c.debut, c.fin]), [['A', 0, 2], ['B', 3, 4], ['C', 5, 5]]);
  assert.deepStrictEqual(V.chapitres([{}, {}]).map(c => [c.titre, c.debut, c.fin]), [['', 0, 1]], 'sans chapitre, un seul, sans titre');
  assert.strictEqual(V.estFaire({ faire: 'clic' }), true);
  assert.strictEqual(V.estFaire({ faire: 'valeur' }), true);
  assert.strictEqual(V.estFaire({ fait: () => true }), true, 'une condition de fin fait un geste');
  assert.strictEqual(V.estFaire({ faire: 'regarder', fait: () => true }), false);
  assert.strictEqual(V.estFaire({ titre: 'x' }), false);
});

t('10.14.0 : chaque page de l\'application a sa visite, et aucune visite ne désigne une page qui n\'existe pas', () => {
  const app = lireSource('src', 'renderer', 'app.js');
  const routes = [...new Set([...app.matchAll(/^\s*routes\.([a-zA-Z]+) = /gm)].map(m => m[1]))];
  assert.ok(routes.length >= 30, 'routes lues : ' + routes.length);
  const sans = routes.filter(r => !S.PAGES[r]);
  assert.deepStrictEqual(sans, [], 'des pages sans visite : ' + sans.join(', '));
  const morts = Object.keys(S.PAGES).filter(r => !routes.includes(r));
  assert.deepStrictEqual(morts, [], 'des visites de pages qui n\'existent pas : ' + morts.join(', '));
  routes.forEach(r => assert.ok(parId('page-' + r), 'la visite de la page « ' + r + ' » n\'est pas construite'));
  // Et chaque page se présente en DEUX phrases au moins : son titre ne suffit pas à dire à quoi
  // elle sert.
  Object.entries(S.PAGES).forEach(([r, P]) => {
    assert.ok(P.titre && P.resume && P.texte && P.texte.length > 60, 'la page « ' + r + ' » n\'est pas présentée');
  });
});

t('10.14.0 : chaque visite est complète — identifiant unique, thème connu, suites qui existent', () => {
  const ids = visites.map(v => v.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'deux visites portent le même identifiant');
  const themes = new Set(S.THEMES.map(x => x.id));
  visites.forEach(v => {
    assert.ok(v.titre && v.resume && v.duree && v.bravo && v.conclusion, 'visite incomplète : ' + v.id);
    assert.ok(themes.has(v.theme), 'thème inconnu pour ' + v.id + ' : ' + v.theme);
    assert.ok(Array.isArray(v.etapes) && v.etapes.length, 'visite sans étape : ' + v.id);
    (v.suite || []).forEach(s => assert.ok(parId(s), `la suite « ${s} » de ${v.id} n'existe pas`));
    if (v.manque && v.manque.visite) assert.ok(parId(v.manque.visite), `« ${v.manque.visite} », proposée à ${v.id}, n'existe pas`);
  });
  // Les thèmes ne restent pas vides : un titre de famille sans visite dans « Me guider » est une
  // promesse vide.
  S.THEMES.forEach(th => assert.ok(visites.some(v => v.theme === th.id), 'le thème « ' + th.id + ' » n\'a aucune visite'));
});

t('10.14.0 : chaque geste attendu porte l\'essai qui le rejoue, et chaque visite indisponible dit pourquoi', () => {
  // L'instrument (`e2e:visite`) rejoue chaque geste à la place de la personne : un geste sans essai
  // n'est jamais prouvé — la visite pourrait mener à un bouton qui n'existe plus, et personne ne le
  // saurait avant un client.
  const sansEssai = [];
  visites.forEach(v => v.etapes.forEach((e, i) => { if (V.estFaire(e) && !e.essai) sansEssai.push(v.id + '#' + i); }));
  assert.deepStrictEqual(sansEssai, [], 'des gestes sans essai : ' + sansEssai.join(', '));
  // Une visite qui peut ne rien avoir à montrer (`si`) porte sa raison (`manque`) : « Me guider »
  // éteint son bouton EN DISANT pourquoi (règle 9.4.5), et la palette ne la propose pas.
  const muettes = visites.filter(v => typeof v.si === 'function' && !(v.manque && v.manque.texte)).map(v => v.id);
  assert.deepStrictEqual(muettes, [], 'des visites qui peuvent se taire sans dire pourquoi : ' + muettes.join(', '));
  // Sur une entreprise vide, ce sont bien elles qui se taisent : on ne peut pas encaisser une facture
  // qui n'existe pas.
  const vides = visites.filter(v => typeof v.si === 'function' && !v.si()).map(v => v.id);
  ['encaisser', 'emettre', 'avoir', 'page-client', 'page-doc'].forEach(id => assert.ok(vides.includes(id), id + ' devrait attendre des données'));
  ['premier-client', 'premier-devis', 'page-factures', 'decouvrir'].forEach(id => assert.ok(!vides.includes(id), id + ' doit se lancer sur une entreprise vide'));
});

t('10.14.0 : la découverte se fait sur l\'EXEMPLE, « Démarrer » dans la VRAIE entreprise — et le compte des chapitres n\'est écrit nulle part', () => {
  const d = parId('decouvrir'), r = parId('premiers-pas');
  assert.strictEqual(d.exemple, true, 'la découverte doit charger l\'exemple');
  assert.strictEqual(r.reel, true, '« Démarrer dans ma vraie entreprise » doit sortir de l\'exemple');
  // Elle finit par le geste suivant : passer à sa vraie entreprise, seulement depuis l'exemple.
  const ids = ctxDemo => S.parcours({ ...ctx, estDemo: () => ctxDemo }).find(v => v.id === 'decouvrir').actions().map(a => a.id);
  assert.deepStrictEqual(ids(true), ['passer-au-reel', 'rester']);
  assert.deepStrictEqual(ids(false), [], 'hors de l\'exemple, rien à quitter');
  // « Je te fais faire le tour en onze chapitres » annonçait onze chapitres au-dessus d'une bulle qui
  // en comptait douze (vu à l'écran). Le compte se lit dans l'en-tête, calculé ; aucun texte ne le
  // recopie (règle 7.3.0 : une phrase que rien ne tient est un bug).
  const textes = visites.flatMap(v => v.etapes.map(e => String(e.texte || '') + ' ' + String(e.titre || '')));
  const compte = textes.filter(x => /\b(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|\d+)\s+chapitres\b/i.test(x));
  assert.deepStrictEqual(compte, [], 'un compte de chapitres écrit à la main : ' + compte.join(' / ').slice(0, 200));
  assert.ok(V.chapitres(d.etapes).length >= 10, 'la découverte doit couvrir toute l\'application, chapitre par chapitre');
});

t('10.14.0 : le dictionaire des boutons — chaque entrée désigne un bouton qui existe, et dit ce qu\'il fait', () => {
  const src = ['app.js', 'index.html', 'rowmenu.js', 'majui.js', 'reglages.js'].map(f => lireSource('src', 'renderer', f)).join('\n');
  const absents = S.BOUTONS.filter(b => b.id).map(b => b.id)
    .filter(id => !src.includes(`id="${id}"`) && !src.includes(`'#${id}'`) && !src.includes(`"#${id}"`) && !src.includes(`#${id} `));
  assert.deepStrictEqual(absents, [], 'des explications pour des boutons introuvables : ' + absents.join(', '));
  S.BOUTONS.forEach((b, i) => {
    // `onglet` : une entrée qui RENVOIE à l'explication des onglets (ONGLETS), sans texte propre.
    assert.ok(b.rowmenu || b.onglet || (b.texte && b.texte.length >= 12), 'explication trop courte : ' + (b.id || b.sel || b.lib));
    assert.ok(!(b.id && /[ ,#.[]/.test(b.id)), 'un identifiant qui est en fait un sélecteur : ' + b.id);
    if (b.sel) assert.doesNotThrow(() => { if (/[^\w\s#.[\]="':(),>*^$|~@-]/.test(b.sel)) throw new Error(b.sel); }, 'sélecteur suspect n°' + i);
  });
  // Chaque onglet expliqué existe dans l'application (une clé mal orthographiée ne s'afficherait
  // jamais, et l'onglet resterait sans explication sans que rien ne le dise).
  const app = lireSource('src', 'renderer', 'app.js');
  const inconnus = Object.keys(S.ONGLETS).map(k => k.split(':').pop()).filter(o => !app.includes(`'${o}'`) && !app.includes(`"${o}"`));
  assert.deepStrictEqual(inconnus, [], 'des onglets expliqués qui n\'existent pas : ' + inconnus.join(', '));
});

t('10.14.0 : le branchement — une seule porte décide qu\'une visite ne peut pas se lancer, l\'exemple avant la découverte, la vraie entreprise avant les premiers pas', () => {
  const app = lireSource('src', 'renderer', 'app.js');
  const lv = app.slice(app.indexOf('async function lancerVisite('), app.indexOf('function visiteManque('));
  assert.ok(lv.length > 300 && lv.length < 3000, 'tranche de lancerVisite inattendue : ' + lv.length);
  const iManque = lv.indexOf('visiteManque(p)'), iEx = lv.indexOf('p.exemple'), iReel = lv.indexOf('p.reel'), iLance = lv.indexOf('Visite.lancer(');
  assert.ok(iManque > 0 && iManque < iEx && iEx < iLance && iReel < iLance,
    'l\'ordre : ce qui manque, puis charger l\'exemple / en sortir, puis lancer');
  assert.ok(/p\.exemple && !C\.estDemo\(data\) && !await loadDemo\(\)\) return/.test(lv), 'la découverte charge l\'exemple et s\'arrête si on renonce');
  assert.ok(/p\.reel && C\.estDemo\(data\) && !await demoSortie\(\)\) return/.test(lv), 'les premiers pas sortent de l\'exemple et s\'arrêtent si on renonce');
  // La page « Me guider » éteint ses boutons par la MÊME fonction (9.4.5) : jamais une seconde règle.
  const guide = app.slice(app.indexOf('routes.guide = '), app.indexOf('routes.aide = '));
  assert.ok((guide.match(/visiteManque\(/g) || []).length >= 2, 'la page « Me guider » doit juger avec visiteManque');
  assert.ok(!/\.si\(\)/.test(guide), 'la page « Me guider » ne rejuge pas `si` elle-même');
  // `loadDemo` et `demoSortie` DISENT s'ils ont abouti : un `return;` nu rendrait `undefined`, et la
  // visite partirait sur les mauvaises données.
  const ld = app.slice(app.indexOf('async function loadDemo('), app.indexOf('async function demoSortie('));
  const ds = app.slice(app.indexOf('async function demoSortie('), app.indexOf('function render(keepScroll)'));
  [['loadDemo', ld], ['demoSortie', ds]].forEach(([nom, z]) => {
    assert.ok(z.length > 400, 'tranche de ' + nom + ' introuvable');
    const code = z.replace(/\/\/[^\n]*/g, '');
    assert.ok(!/return;/.test(code), nom + ' a un « return; » nu');
    assert.ok(/return true;/.test(code) && /return false/.test(code), nom + ' doit rendre true ET false');
  });
});

t('10.14.0 : l\'accueil de la toute première fois — un seul vert, et une seule invitation', () => {
  const app = lireSource('src', 'renderer', 'app.js');
  const pp = app.slice(app.indexOf('function premiersPas('), app.indexOf('function bindPremiersPas('));
  assert.ok(pp.length > 800 && pp.length < 5000, 'tranche de premiersPas inattendue : ' + pp.length);
  // Tant que l'accueil propose la découverte, c'est LUI le vert (U-11) : le bouton de l'étape en
  // cours perd le sien.
  assert.ok(/id="pp-decouvrir"/.test(pp) && /btn btn-primary" id="pp-decouvrir"/.test(pp), 'la découverte est le bouton vert de l\'accueil');
  assert.ok(/encours && !accueil \? 'btn-primary'/.test(pp), 'le bouton de l\'étape ne reste pas vert à côté de l\'accueil');
  // « Première fois sur cette page ? » se tait quand l'accueil est déjà là : deux invitations l'une
  // sous l'autre se contredisent (7.18.0) — vu à l'écran au premier lancement.
  const bv = app.slice(app.indexOf('function bandeauVisite('), app.indexOf('const ICONE_GUIDE'));
  assert.ok(bv.length > 300 && bv.length < 3000, 'tranche de bandeauVisite inattendue : ' + bv.length);
  const iAcc = bv.indexOf(".pp-accueil"), iCompte = bv.indexOf('e.vues[route] = (e.vues[route] || 0) + 1');
  assert.ok(iAcc > 0 && iAcc < iCompte, 'l\'invitation de page se tait (et ne compte pas) quand l\'accueil est affiché');
});

t('10.14.0 : le bandeau de l\'exemple est LILAS — la règle générale des bandeaux ne le repeint plus', () => {
  // `.banner` (une classe, écrite 650 lignes plus bas) repeignait `.demo-banner` (une classe aussi)
  // en orange avertissement : le lilas n'a jamais été appliqué, et seule une capture l'a montré. La
  // règle du bandeau d'exemple porte DEUX classes, dans les deux thèmes, boutons compris.
  const css = lireSource('src', 'renderer', 'style.css');
  assert.ok(/^\.banner\.demo-banner \{[^}]*background: #f1ecff/m.test(css), 'fond lilas en clair, sur .banner.demo-banner');
  assert.ok(/^body\.dark \.banner\.demo-banner \{[^}]*background: #2a2340/m.test(css), 'fond lilas en sombre');
  assert.ok(/^\.banner\.demo-banner \.btn:not\(\.btn-primary\):not\(\.btn-danger\) \{/m.test(css), 'ses boutons battent `.banner .btn`');
  assert.ok(!/^\.demo-banner \{/m.test(css), 'une règle à une seule classe perdrait contre `.banner`');
});

// ------------------------------------------------------------ l'habillage premium (10.14.0, suite)
// Skander : « faut qu'il soit wow, beau, attirant, qui donne envie d'acheter une licence — et de ne
// pas partir après l'essai ». Ce que ces tests tiennent : la couleur de chaque visite existe dans la
// feuille (en clair ET en sombre), la bulle ne se répète pas et ne se réfugie pas dans un coin, les
// réussites et la carte de l'essai ne disent que ce que les DONNÉES disent, et une visite bloquée
// propose la première qu'on peut vraiment faire.

t('10.14.0 : chaque visite porte une couleur que la feuille de style connaît — en clair ET en sombre', () => {
  const css = lireSource('src', 'renderer', 'style.css');
  const clair = new Set([...css.matchAll(/^\.th-([a-z]+)\s*\{[^}]*--th:/gm)].map(m => m[1]));
  const sombre = new Set([...css.matchAll(/^body\.dark \.th-([a-z]+)\s*\{[^}]*--th:/gm)].map(m => m[1]));
  assert.ok(clair.size >= 7, 'couleurs de domaine lues dans la feuille : ' + [...clair].join(', '));
  // Une couleur inconnue rendrait une bulle grise au milieu de bulles colorées — et une couleur sans
  // sa jumelle sombre, un en-tête clair dans une application sombre.
  const couleurs = new Set([...S.THEMES.map(x => x.couleur), ...Object.values(S.COULEUR_PAGE), ...visites.map(v => S.couleurDe(v))]);
  couleurs.forEach(c => {
    assert.ok(c, 'une visite sans couleur');
    assert.ok(clair.has(c), `la couleur « ${c} » n'existe pas dans la feuille (.th-${c})`);
    assert.ok(sombre.has(c), `la couleur « ${c} » n'a pas sa jumelle sombre (body.dark .th-${c})`);
  });
  // Chaque page a la sienne, et aucune ne désigne une page qui n'existe pas : deux tables séparées
  // divergent (7.23.0) — une page ajoutée demain naîtrait grise.
  assert.deepStrictEqual(Object.keys(S.PAGES).filter(r => !S.COULEUR_PAGE[r]), [], 'des pages sans couleur');
  assert.deepStrictEqual(Object.keys(S.COULEUR_PAGE).filter(r => !S.PAGES[r]), [], 'des couleurs pour des pages qui n\'existent pas');
});

t('10.14.0 : la bulle ne répète pas son titre dans son en-tête', () => {
  // « Les factures et les avoirs » en petit au-dessus de « Les factures et les avoirs » en grand :
  // vu à l'écran sur la première bulle de chaque visite de page.
  assert.strictEqual(V.lieuDe('Les factures et les avoirs', 'Les factures  et les avoirs ', { type: 'page' }), 'Visite de la page');
  assert.strictEqual(V.lieuDe('Faire un devis', 'faire un devis', { type: 'geste' }), '');
  assert.strictEqual(V.lieuDe('Faire un devis', 'Le client', {}), 'Faire un devis', 'un lieu différent du titre se garde');
  assert.strictEqual(V.lieuDe('', 'Le client', {}), '');
});

t('10.14.0 : une zone plus haute que l\'écran ne relègue pas la bulle dans un coin — on en montre le haut', () => {
  const ecran = { w: 1440, h: 900 }, bulle = { w: 380, h: 280 };
  // Une liste de trois écrans de haut, qui prend presque toute la largeur : sans découpe, aucun côté
  // n'a la place, et la bulle se posait dans un coin, sur la première colonne.
  const liste = { l: 250, t: 120, r: 1420, b: 2700 };
  assert.strictEqual(V.placerBulle(liste, bulle, ecran, {}).cote, 'coin', 'les données doivent discriminer : sans découpe, c\'est le coin');
  const d = V.decouperHaut(liste, ecran.h);
  assert.deepStrictEqual([d.l, d.r, d.t], [liste.l, liste.r, liste.t], 'la découpe garde la largeur et le haut');
  assert.ok(d.b - d.t >= 240 && d.b < ecran.h, 'on montre le haut, dans l\'écran : ' + JSON.stringify(d));
  const p = V.placerBulle(d, bulle, ecran, {});
  assert.notStrictEqual(p.cote, 'coin', 'la bulle trouve un côté une fois la zone découpée');
  assert.ok(!V.chevauche({ l: p.x, t: p.y, r: p.x + bulle.w, b: p.y + bulle.h }, d), 'et elle ne couvre pas le haut qu\'elle montre');
  // Une zone dont le haut est déjà sorti de l'écran (on a défilé) se découpe depuis le bord.
  const d2 = V.decouperHaut({ l: 0, t: -600, r: 1400, b: 3000 }, ecran.h);
  assert.ok(d2.b > 0 && d2.b <= Math.round(ecran.h * 0.44) + 1, 'découpe depuis le bord de l\'écran : ' + JSON.stringify(d2));
  // Et la découpe ne sert qu'à MONTRER : pendant un geste, la bulle garde toute la zone.
  const vj = lireSource('src', 'renderer', 'visite.js');
  const pos = vj.slice(vj.indexOf('function positionner('), vj.indexOf('function positionner(') + 3000);
  assert.ok(/if \(!faire[^\n]*\) r = decouperHaut\(r, H\)/.test(pos), 'positionner découpe les zones hautes, sauf pendant un geste');
});

t('10.14.0 : « Tes réussites » se lisent sur les DONNÉES — rien sur une entreprise vide, et chaque vrai geste débloque la sienne', () => {
  const Core = require('../../src/renderer/core.js');
  const co = { ...Core.DEFAULT_COMPANY };
  const r0 = Core.reussites({ documents: [], clients: [], purchases: [] }, co, {});
  assert.strictEqual(r0.faites, 0, 'une entreprise vide n\'a rien réussi : ' + r0.liste.filter(x => x.fait).map(x => x.id));
  assert.strictEqual(r0.total, r0.liste.length);
  r0.liste.forEach(x => assert.ok(x.titre && x.quoi && x.quoi.length > 20, 'réussite sans explication : ' + x.id));
  const faites = r => r.liste.filter(x => x.fait).map(x => x.id).sort();
  // Un brouillon n'est ni « envoyé » ni « émis » : la réussite attend le vrai geste.
  const d = { clients: [{ id: 'c1', name: 'Hôtel' }], purchases: [], documents: [
    { id: 'q1', type: 'devis', status: 'brouillon', lines: [] },
    { id: 'f1', type: 'facture', status: 'brouillon', lines: [] }] };
  assert.deepStrictEqual(faites(Core.reussites(d, co, {})), ['client']);
  d.documents[0].status = 'envoyé';
  Object.assign(d.documents[1], { number: 'FAC-2026-001', status: 'envoyée', payments: [{ amount: 50, date: '2026-09-01' }] });
  d.purchases.push({ id: 'a1' });
  assert.deepStrictEqual(faites(Core.reussites(d, co, { copieExterne: '/Volumes/Cle' })), ['abri', 'achat', 'client', 'devis', 'facture', 'paiement']);
  d.packs = [{ month: '2026-08' }]; d.closedUntil = '2026-08-31';
  assert.deepStrictEqual(faites(Core.reussites(d, co, {})), ['achat', 'client', 'cloture', 'comptable', 'devis', 'facture', 'paiement']);
  // Et l'hôte ne les montre JAMAIS sur l'exemple : celles d'une entreprise inventée ne sont pas les tiennes.
  const app = lireSource('src', 'renderer', 'app.js');
  const guide = app.slice(app.indexOf('routes.guide = '), app.indexOf('routes.aide = '));
  assert.ok(/const rr = exemple \? null : C\.reussites\(/.test(guide), 'les réussites se taisent sur l\'exemple');
});

t('10.14.0 : la carte de l\'essai ne parle que pendant l\'essai, ne compte que ce qui existe, et ne promet que ce que le code tient', () => {
  const vm = require('vm');
  const Core = require('../../src/renderer/core.js');
  const app = lireSource('src', 'renderer', 'app.js');
  const src = app.slice(app.indexOf('function carteEssai() {'), app.indexOf('routes.guide = () => {'));
  assert.ok(src.length > 800 && src.length < 6000, 'tranche de carteEssai inattendue : ' + src.length);
  const ctx = {
    data: null, licence: null,
    C: { estDemo: x => !!x.demo, toBase: (x, v) => v * (Number(x.exchangeRate) || 1), computeTotals: x => ({ netHT: x.ht || 0 }), money: (n, c) => Core.money(n, c), pastilleLicence: Core.pastilleLicence },
    company: () => ({ currency: 'DT' }),
    effStatus: x => x.status,
    pl: (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`,
    h: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  };
  const carteEssai = vm.runInNewContext(src + '\ncarteEssai;', ctx);
  const rendre = (data, licence) => { ctx.data = data; ctx.licence = licence; return carteEssai(); };
  const aplati = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const vide = { documents: [], clients: [], purchases: [] };
  // Hors de l'essai, rien : une licence payée n'a pas à entendre parler d'essai, l'éditeur non plus.
  ['libre', 'active', 'editeur', 'expiree', 'revoquee', 'autre', 'invalide'].forEach(st =>
    assert.strictEqual(rendre(vide, { state: st, daysLeft: 200 }), '', 'la carte parle hors de l\'essai : ' + st));
  // Sur l'exemple, rien : ses chiffres ne sont pas les tiens.
  assert.strictEqual(rendre({ ...vide, demo: true }, { state: 'essai', daysLeft: 20 }), '');
  // Pendant l'essai, sans rien encore : ce que l'essai vaut, sans compte à rebours criard (8.0.1).
  const debut = aplati(rendre(vide, { state: 'essai', daysLeft: 30 }));
  assert.ok(/encore 30 jours/.test(debut) && /Voir ma licence/.test(debut), debut);
  assert.ok(/rien à ressaisir/.test(debut), 'la carte dit que rien n\'est à ressaisir : ' + debut);
  assert.ok(!/proche/.test(rendre(vide, { state: 'essai', daysLeft: 30 })), 'trente jours ne sont pas une alerte');
  assert.ok(/proche/.test(rendre(vide, { state: 'essai', daysLeft: 5 })), 'la dernière semaine se voit');
  // La promesse qui fait acheter sans peur, tenue par un test depuis la 6.4.0 : licence ou pas, les
  // données restent à toi, et SEULE la création attend.
  assert.ok(/tes données restent à toi/.test(debut) && /Seule la création de nouvelles pièces attend ta licence/.test(debut), debut);
  // Ce que l'essai a construit : des FAITS comptés sur les données, jamais une estimation. Un
  // brouillon n'est pas une pièce numérotée, une facture annulée ne compte pas dans le chiffre.
  const plein = {
    clients: [{ id: 'a' }, { id: 'b' }], purchases: [{ id: 'p' }],
    documents: [
      { id: 'f1', type: 'facture', number: 'FAC-1', status: 'envoyée', ht: 1000, payments: [{ amount: 1 }] },
      { id: 'f2', type: 'facture', number: 'FAC-2', status: 'annulée', ht: 700 },
      { id: 'av', type: 'avoir', number: 'AVO-1', status: 'émis', ht: 100 },
      { id: 'br', type: 'facture', status: 'brouillon', ht: 5000 }]
  };
  const txt = aplati(rendre(plein, { state: 'essai', daysLeft: 12 }));
  ['2 clients', '3 pièces numérotées', '1 paiement noté', '1 achat saisi'].forEach(f => assert.ok(txt.includes(f), `« ${f} » absent : ${txt}`));
  assert.ok(txt.includes(aplati(Core.money(900, 'DT')) + ' facturés HT'), '1 000 − 100 d\'avoir, sans l\'annulée ni le brouillon : ' + txt);
  // L'essai fini : ce qui reste, et le geste qui rouvre la création.
  const fin = aplati(rendre(plein, { state: 'finessai', daysLeft: 0, locked: true }));
  assert.ok(/Ton essai est terminé/.test(fin) && /Activer ma licence/.test(fin) && /intactes/.test(fin), fin);
});

t('10.14.0 : une visite qui attend un préalable propose la PREMIÈRE qu\'on peut vraiment faire — jamais un bouton éteint qui renvoie à un autre', () => {
  const vm = require('vm');
  const app = lireSource('src', 'renderer', 'app.js');
  const src = app.slice(app.indexOf('function visiteManque(p) {'), app.indexOf('function expliquerManque('));
  assert.ok(src.length > 300 && src.length < 3000, 'tranche inattendue : ' + src.length);
  const monter = liste => vm.runInNewContext(src + '\n({ visiteManque, visitePossibleAvant });', { visiteParId: id => liste.find(v => v.id === id) });
  const { visitePossibleAvant } = monter(visites);
  // Sur une entreprise vide : encaisser attend une facture émise, qui attend un brouillon, qui attend
  // un devis — c'est le devis qu'on propose.
  ['encaisser', 'emettre', 'avoir', 'envoyer', 'devis-facture'].forEach(id => {
    const v = visitePossibleAvant(parId(id));
    assert.ok(v, id + ' ne propose rien');
    assert.strictEqual(v.id, 'premier-devis', id + ' propose ' + v.id);
  });
  assert.strictEqual(visitePossibleAvant(parId('premier-client')), null, 'une visite faisable ne propose rien d\'autre');
  // Une chaîne qui boucle ne gèle rien, et sans préalable nommé on ne devine pas.
  const boucle = [{ id: 'a', si: () => false, manque: { texte: 'x', visite: 'b' } }, { id: 'b', si: () => false, manque: { texte: 'y', visite: 'a' } }];
  assert.strictEqual(monter(boucle).visitePossibleAvant(boucle[0]), null);
  const orpheline = { id: 'o', si: () => false, manque: { texte: 'z' } };
  assert.strictEqual(monter([orpheline]).visitePossibleAvant(orpheline), null);
  // « Pas encore : il te faut… » — la raison se lit après deux-points : elle n'en porte pas un second.
  const doubles = visites.filter(v => v.manque && / : /.test(v.manque.texte)).map(v => v.id + ' — ' + v.manque.texte);
  assert.deepStrictEqual(doubles, [], 'une raison qui ajoute un second deux-points');
  // Et la page « Me guider » s'en sert, comme la fenêtre qui explique le refus.
  const guide = app.slice(app.indexOf('routes.guide = '), app.indexOf('routes.aide = '));
  assert.ok(/const avant = visitePossibleAvant\(v\);/.test(guide), 'la page « Me guider » remonte la chaîne');
  assert.ok(/function expliquerManque\(p, m\) \{\s*const avant = visitePossibleAvant\(p\);/.test(app), 'la fenêtre du refus aussi');
});

t('10.14.0 : « Tes premiers pas » — chaque étape a sa visite, et la jauge de fin ne parle ni sur l\'exemple, ni hors des premiers pas', () => {
  const vm = require('vm');
  const Core = require('../../src/renderer/core.js');
  const app = lireSource('src', 'renderer', 'app.js');
  const m = app.match(/const PAS_VISITES = (\{[^}]*\});/);
  assert.ok(m, 'PAS_VISITES introuvable');
  const PAS_VISITES = vm.runInNewContext('(' + m[1] + ')');
  // Chaque étape des premiers pas qui a un geste a sa visite, et chaque visite nommée existe.
  const actions = new Set(Core.firstSteps({ documents: [{ type: 'devis' }] }, Core.DEFAULT_COMPANY, {}).etapes.map(e => e.action).filter(Boolean));
  assert.deepStrictEqual([...actions].filter(a => !PAS_VISITES[a]), [], 'une étape des premiers pas sans visite');
  Object.values(PAS_VISITES).forEach(id => assert.ok(parId(id), 'la visite « ' + id + ' » n\'existe pas'));
  // La jauge de fin : le vrai code de l'hôte, évalué.
  const pm = app.match(/progres: (p => \{[\s\S]*?\n {4}\}),\n/);
  assert.ok(pm, 'le crochet « progres » est introuvable');
  const ctx = {
    data: { documents: [], clients: [] }, copieExterne: null, company: () => Core.DEFAULT_COMPANY,
    C: { estDemo: x => !!x.demo, firstSteps: Core.firstSteps },
    VISITES_DES_PAS: new Set(['premiers-pas', ...Object.values(PAS_VISITES)]),
    minuscule: t => String(t || '').charAt(0).toLowerCase() + String(t || '').slice(1)
  };
  const progres = vm.runInNewContext('(' + pm[1] + ')', ctx);
  const r = progres({ id: 'premier-client' });
  assert.ok(r && r.total >= 6 && r.fait === 0 && /^Prochaine étape : compléter ta fiche société\.$/.test(r.texte), JSON.stringify(r));
  assert.strictEqual(progres({ id: 'page-factures' }), null, 'la visite d\'une page ne montre pas les premiers pas');
  ctx.data = { documents: [], clients: [], demo: true };
  assert.strictEqual(progres({ id: 'premier-client' }), null, 'jamais sur l\'exemple');
});

t('10.14.0 : la bulle donne le curseur au bouton qui AVANCE — jamais à la croix qui porte le même geste', () => {
  // La carte de fin posait le curseur sur `[data-v="fin"]` : la croix de l'en-tête et « Terminer »
  // le portent tous les deux, et le premier trouvé était la croix — vu à l'écran, un cadre de focus
  // sur un ✕. Un sélecteur de focus désigne UN élément de la bulle qu'il vise.
  const vj = lireSource('src', 'renderer', 'visite.js');
  ['function dessinerBulle(', 'function dessinerFin('].forEach(debut => {
    const i = vj.indexOf(debut);
    const zone = vj.slice(i, vj.indexOf('\n  }\n', i));
    assert.ok(zone.length > 800, 'tranche introuvable : ' + debut);
    const appels = [...zone.matchAll(/focaliser\(([^;\n]*)\);/g)].map(m => m[1]);
    assert.ok(appels.length, 'aucun focus dans ' + debut);
    appels.forEach(a => [...a.matchAll(/'([^']*)'/g)].map(m => m[1]).forEach(sel => {
      const v = sel.match(/data-v="([a-z]+)"/);
      if (!v || /^\.vb-pied /.test(sel)) return;
      // Le gabarit seul : ni les commentaires, ni les appels de focus (qui CITENT le sélecteur).
      const gabarit = zone.replace(/\/\/[^\n]*/g, '').replace(/focaliser\([^;\n]*\);/g, '');
      const n = (gabarit.match(new RegExp('data-v="' + v[1] + '"', 'g')) || []).length;
      assert.strictEqual(n, 1, `« ${sel} » désigne ${n} éléments dans ${debut.trim()}`);
    }));
  });
});

t('10.14.0 : chaque classe que pose le moteur de visite existe dans la feuille de style', () => {
  // Une classe posée par le code et inconnue de la feuille ne se voit nulle part (6.8.0, 7.23.0…) :
  // la bulle entière en est faite.
  const vj = lireSource('src', 'renderer', 'visite.js');
  const css = lireSource('src', 'renderer', 'style.css');
  const jetons = new Set();
  for (const m of vj.matchAll(/class="([^"]*)"/g)) m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).filter(x => /^vb-[a-z0-9-]+$/.test(x)).forEach(x => jetons.add(x));
  assert.ok(jetons.size >= 40, 'classes lues dans le moteur : ' + jetons.size);
  const absentes = [...jetons].filter(c => !new RegExp('\\.' + c + '(?![\\w-])').test(css));
  assert.deepStrictEqual(absentes, [], 'des classes du moteur sans règle');
  // Les états de la bulle aussi — et aucun marqueur que personne ne lit (9.8.8, T-09).
  ['faire', 'liste', 'perdu', 'entre', 'entre-arriere', 'nouveau-chapitre', 'fin'].forEach(e =>
    assert.ok(new RegExp('\\.visite-bulle\\.' + e + '(?![\\w-])').test(css), 'état sans règle : .visite-bulle.' + e));
  const code = vj.replace(/\/\/[^\n]*/g, '');
  assert.ok(!/className = [^;\n]*regarder/.test(code) && !/visite-active/.test(code), 'un marqueur posé et lu par personne');
});
};
