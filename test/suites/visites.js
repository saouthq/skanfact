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
// « Démarrer dans ma vraie entreprise »). Dans l'application réelle, `npm run e2e:couverture` vérifie
// que chaque contrôle a son explication ; le parcours qui rejouera chaque ÉTAPE de chaque visite
// (`e2e:visite`) reste à écrire — `A-FAIRE.md` § 4 bis.
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

// Vu à l'écran (10.14.0) : « Répondre aux questions de mon comptable », lancée depuis « Me guider »,
// restait sur l'onglet Ventes, la bulle au milieu de l'écran. `aller()` change l'adresse, la page se
// dessine au `hashchange` qui suit, et l'onglet était cliqué AVANT : sur l'écran d'avant, où il
// n'existe pas. Trente-six étapes ouvrent un onglet de cette façon.
t('10.14.0 : un onglet se clique quand sa page est DESSINÉE — jamais sur l\'écran d\'avant', () => {
  const vieuxDoc = global.document, vieuxTimer = global.setTimeout;
  const file = [];
  let dessinee = false, actif = false, clics = 0;
  global.document = { querySelector: sel => dessinee && sel === '#c-tabs button[data-tab="cabinet"]'
    ? { classList: { contains: c => c === 'active' && actif }, click: () => { clics++; } } : null };
  global.setTimeout = fn => { file.push(fn); return file.length; };
  try {
    V.ouvrirOnglet('#c-tabs', 'cabinet');
    assert.strictEqual(clics, 0);
    assert.strictEqual(file.length, 1, 'l\'onglet absent n\'est pas attendu : il visait l\'écran d\'avant, et rien ne se passait');
    file.shift()();                                   // la page n'est toujours pas dessinée
    assert.strictEqual(clics, 0);
    dessinee = true; file.shift()();                  // elle l'est
    assert.strictEqual(clics, 1, 'l\'onglet n\'est pas cliqué une fois sa page dessinée');
    assert.strictEqual(file.length, 0, 'l\'attente continue après le clic');
    actif = true; V.ouvrirOnglet('#c-tabs', 'cabinet');
    assert.strictEqual(clics, 1, 'un onglet déjà ouvert se reclique — et sa page repart en haut');
    dessinee = false; V.ouvrirOnglet('#c-tabs', 'cabinet', 0);
    assert.strictEqual(file.length, 0, 'une barre qui n\'arrive jamais s\'attend sans fin');
  } finally { global.document = vieuxDoc; global.setTimeout = vieuxTimer; }
  // Et les deux usages passent par lui : les visites écrites à la main, et les onglets d'une page lus
  // sur l'écran par le moteur.
  const vs = lireSource('src', 'renderer', 'visites.js'), vj = lireSource('src', 'renderer', 'visite.js');
  assert.ok(/const onglet = \(barre, cle\) => \(\) => ctx\.Visite\.ouvrirOnglet\(barre, cle\);/.test(vs), 'les visites cliquent encore l\'onglet sans attendre sa page');
  assert.ok(/avant: \(\) => ouvrirOnglet\(barre, cle\),/.test(vj), 'les onglets lus sur l\'écran cliquent encore sans attendre');
  assert.ok(!/button\[data-tab="\$\{cle\}"\]`\); if \(bt/.test(vs + vj), 'un clic d\'onglet sans attente subsiste');
});

// Vu à l'écran (10.14.0) : sur l'EXEMPLE, « Compléter ma fiche société » démarrait et disait « Vérifie
// ou tape ta raison sociale » dans la fiche de la société fictive — ce qu'on y tapait repartait avec
// l'exemple. Les Paramètres portent ce qui est à TOI (ta fiche, ta copie de sécurité, ton mot de
// passe, ton comptable) : une visite qui y fait écrire sort d'abord de l'exemple.
t('10.14.0 : une visite qui fait écrire dans les Paramètres se fait dans la VRAIE entreprise', () => {
  const fautives = [];
  let lues = 0;
  visites.forEach(v => {
    let page = typeof v.page === 'string' ? v.page : '';
    v.etapes.forEach(e => {
      if (typeof e.page === 'string') page = e.page;
      else if (e.page) page = '';                 // une page calculée : on ne sait pas, on ne juge pas
      if (e.faire && page === '#/parametres') { lues++; if (!v.reel) fautives.push(v.id + ' — « ' + e.titre + ' »'); }
    });
  });
  assert.ok(lues >= 6, 'les données doivent discriminer : ' + lues + ' gestes lus dans les Paramètres');
  assert.deepStrictEqual(fautives, [], 'une visite fait écrire dans les Paramètres sur l\'exemple');
  // Et l'inverse : une visite qui se fait SUR l'exemple n'en sort jamais.
  assert.deepStrictEqual(visites.filter(v => v.exemple && v.reel).map(v => v.id), [], 'une visite à la fois sur l\'exemple et hors de lui');
  // La page « Me guider » le dit sur le bouton, depuis l'exemple : on sait où l'on va avant de cliquer
  // — y compris sur une visite déjà faite ou mise en pause (elle disait « Recommencer », et le clic
  // quittait l'exemple). On JOUE le calcul du libellé sur les six cas.
  const app = lireSource('src', 'renderer', 'app.js');
  const f = app.match(/\n {2}(function libelleVisite\(v, verbe\) \{[\s\S]*?\n {2}\})\n/);
  assert.ok(f, 'le libellé d\'un bouton de visite n\'est plus calculé par UNE fonction');
  const lib = (v, exemple, verbe) => require('vm').runInNewContext('(' + f[1] + ')', { C: { estDemo: () => exemple }, data: {} })(v, verbe);
  const reel = { id: 'societe', reel: true }, decouvrir = { id: 'decouvrir', exemple: true };
  assert.strictEqual(lib(reel, true, 'commencer'), 'Quitter l\'exemple et commencer');
  assert.strictEqual(lib(reel, true, 'recommencer'), 'Quitter l\'exemple et recommencer', 'une visite en pause sur l\'exemple cache qu\'on va le quitter');
  assert.strictEqual(lib(reel, true, 'reprendre'), 'Quitter l\'exemple et reprendre');
  assert.strictEqual(lib(reel, true, 'refaire'), 'Quitter l\'exemple et refaire', 'une visite faite cache qu\'on va quitter l\'exemple');
  assert.strictEqual(lib(reel, false, 'commencer'), 'Commencer');
  assert.strictEqual(lib(decouvrir, false, 'refaire'), 'Charger l\'exemple et refaire', 'refaire la découverte cache qu\'on charge l\'exemple');
  assert.strictEqual(lib(decouvrir, true, 'reprendre'), 'Reprendre');
  // Et les deux boutons de la page l'appellent : la carte ET le héros « Reprendre ».
  const guide = app.slice(app.indexOf('routes.guide = '), app.indexOf('routes.aide = '));
  assert.ok(/label: libelleVisite\(reprise, 'reprendre'\)/.test(guide), 'le héros « Reprendre » ne dit pas qu\'il quitte ou charge l\'exemple');
  assert.ok(/const lib = libelleVisite\(v, /.test(guide), 'les cartes ne passent plus par libelleVisite');
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
  assert.ok(/if \(!faire[^\n]*\) r = decouperHaut\(r, H[,)]/.test(pos), 'positionner découpe les zones hautes, sauf pendant un geste');
});

// Vu à la souris dans le Cabinet (Réglages → « Les sauvegardes ») : un panneau large, plus haut que ce
// que l'écran laisse une fois la bulle posée, mais sous le seuil des blocs géants. `hautPourBulle`
// renonçait, et la bulle se rabattait dans un coin, SUR le titre du panneau qu'elle présentait.
t('10.14.0 : un panneau large que la bulle ne peut pas longer se découpe au lieu d\'être couvert', () => {
  // Les mesures relevées à l'écran (1440 × 853) : le panneau et la bulle.
  const ecran = { w: 1440, h: 853 }, bulle = { w: 388, h: 310 };
  const r = { l: 257, t: 240, r: 1395, b: 760 };
  assert.strictEqual(V.placerBulle(r, bulle, ecran, {}).cote, 'coin', 'les données doivent discriminer : sans rien faire, c\'est le coin');
  assert.strictEqual(V.hautPourBulle(r, bulle, ecran), null, 'les données doivent discriminer : défiler seul ne suffit pas');
  assert.ok(r.b - r.t <= ecran.h * 0.62, 'les données doivent discriminer : ce n\'est pas un bloc géant');
  const hc = V.hautPourCouper(r, bulle, ecran);
  assert.ok(hc != null, 'le panneau n\'est ni amené ni découpé');
  const dy = Math.round(r.t - hc);
  const r2 = { ...r, t: r.t - dy, b: r.b - dy };
  const d = V.decouperHaut(r2, ecran.h, bulle.h);
  assert.ok(d.b - d.t >= 120, 'on montre au moins le haut du panneau : ' + JSON.stringify(d));
  const pos = V.placerBulle(d, bulle, ecran, {});
  assert.notStrictEqual(pos.cote, 'coin', 'la bulle retourne dans un coin');
  assert.ok(!V.chevauche({ l: pos.x, t: pos.y, r: pos.x + bulle.w, b: pos.y + bulle.h }, d), 'la bulle couvre le haut qu\'elle montre');
  // Ce qui laisse un côté libre, ou que le défilement suffit à séparer, ne se découpe pas.
  assert.strictEqual(V.hautPourCouper({ l: 262, t: 100, r: 700, b: 700 }, bulle, ecran), null, 'une zone étroite se découpe pour rien');
  assert.strictEqual(V.hautPourCouper({ l: 254, t: 319, r: 1395, b: 646 }, { w: 388, h: 322 }, { w: 1440, h: 873 }), null, 'une zone que le défilement suffit à séparer se découpe pour rien');
  const vj = lireSource('src', 'renderer', 'visite.js');
  const i = vj.indexOf('if (!cur.defile) {');
  const zone = vj.slice(i, vj.indexOf('\n      }\n', i) + 400);
  assert.ok(/hautPourCouper\(/.test(zone) && /cur\.couper = true/.test(zone), 'le moteur ne découpe pas les panneaux larges');
});

// Vu à l'écran : « Enregistrer ta réponse », posée AU-DESSUS du bouton de la fenêtre, couvrait la
// réponse qu'on venait de taper et la question qu'on demandait d'enregistrer. Une fenêtre est l'endroit
// où l'on relit : la bulle se pose à côté d'elle, à la hauteur de la cible.
t('10.14.0 : la bulle d\'une cible DANS une fenêtre se pose à côté de la fenêtre, jamais dessus', () => {
  // Les mesures relevées à l'écran (1440 × 873) : la fenêtre « Répondre à ton comptable » et son bouton.
  const ecran = { w: 1440, h: 873 }, bulle = { w: 388, h: 312 };
  const fen = { l: 431, t: 240, r: 1011, b: 630 };
  const ok = { l: 799, t: 563, r: 989, b: 609 };
  // Les données discriminent : l'ancienne règle, avec le côté que demande l'étape, couvre la fenêtre.
  const avant = V.placerBulle(ok, bulle, ecran, { pref: 'dessus' });
  assert.ok(V.chevauche({ l: avant.x, t: avant.y, r: avant.x + bulle.w, b: avant.y + bulle.h }, fen), 'les données doivent discriminer : autour du seul bouton, la bulle couvre la fenêtre');
  const pos = V.placerPres(ok, fen, bulle, ecran, { pref: 'dessus' });
  const b = { l: pos.x, t: pos.y, r: pos.x + bulle.w, b: pos.y + bulle.h };
  assert.ok(!V.chevauche(b, fen), 'la bulle couvre la fenêtre : ' + JSON.stringify(pos));
  assert.strictEqual(pos.cote, 'droite', 'à côté de la fenêtre, à droite d\'abord');
  assert.ok(pos.y <= ok.b && pos.y + bulle.h >= ok.t, 'la bulle n\'est pas à la hauteur de sa cible : ' + JSON.stringify(pos));
  // Pas de place à droite (un petit écran) : à gauche de la fenêtre ; ni l'un ni l'autre : la règle
  // ordinaire autour de la cible — jamais un coin quand la cible laisse un côté libre.
  const petit = { w: 1280, h: 800 };
  assert.strictEqual(V.placerPres(ok, fen, bulle, petit, { pref: 'dessus' }).cote, 'gauche', 'sans place à droite, à gauche de la fenêtre');
  const large = { l: 150, t: 240, r: 1130, b: 630 };
  const repli = V.placerPres(ok, large, bulle, petit, { pref: 'dessus' });
  assert.deepStrictEqual(repli, V.placerBulle(ok, bulle, petit, { pref: 'dessus' }), 'une fenêtre trop large rend la règle ordinaire');
  // Sans fenêtre, rien ne change.
  assert.deepStrictEqual(V.placerPres(ok, null, bulle, ecran, { pref: 'dessus' }), avant, 'sans fenêtre, la règle ordinaire');
  // Et le moteur s'en sert : la fenêtre se cherche autour de la cible.
  const vj = lireSource('src', 'renderer', 'visite.js');
  const p = vj.slice(vj.indexOf('function positionner('), vj.indexOf('// ---------- le dessin de la bulle'));
  assert.ok(/closest\('\.modal'\)/.test(p) && /placerPres\(/.test(p) && !/= placerBulle\(/.test(p), 'positionner ne cherche plus la fenêtre de sa cible');
});

// Vu à l'écran : le tableau des questions du comptable, centré, ne laissait assez de place ni dessus
// ni dessous — la bulle se rabattait dans un coin, sur « Importer les questions de ton comptable »,
// le bouton même dont elle parlait. On fait défiler pour libérer le côté demandé.
t('10.14.0 : une zone large et haute laisse la place de sa bulle — on fait défiler au lieu de se rabattre dans un coin', () => {
  // Des mesures RÉELLES, pas des nombres ronds : un rectangle tombe au quart de pixel, et la page
  // défile au pixel entier. Viser la limite exacte laissait la bulle à 0,28 px de sa place — elle
  // retournait dans le coin (vu à l'écran : bulle de 322,875 px, cible à 354,59 px).
  const ecran = { w: 1440, h: 873 }, bulle = { w: 388, h: 322.875 };
  const r = { l: 254, t: 319.4, r: 1395, b: 646.4 };
  assert.strictEqual(V.placerBulle(r, bulle, ecran, { pref: 'dessus' }).cote, 'coin', 'les données doivent discriminer : centrée, la zone renvoie la bulle dans un coin');
  ['dessus', 'dessous', undefined].forEach(pref => {
    const haut = V.hautPourBulle(r, bulle, ecran, pref);
    assert.ok(haut != null, 'rien ne libère la place de la bulle (' + pref + ')');
    // Ce que fait le moteur : défiler d'un nombre ENTIER de pixels (`defilerDe`, `Math.round`).
    const dy = Math.round(r.t - haut);
    const r2 = { ...r, t: r.t - dy, b: r.b - dy };
    const pos = V.placerBulle(r2, bulle, ecran, { pref });
    assert.notStrictEqual(pos.cote, 'coin', 'après défilement, la bulle se rabat encore dans un coin (' + pref + ')');
    assert.ok(!V.chevauche({ l: pos.x, t: pos.y, r: pos.x + bulle.w, b: pos.y + bulle.h }, r2), 'la bulle couvre encore sa zone (' + pref + ')');
    if (pref) assert.strictEqual(pos.cote, pref, 'le côté libéré n\'est pas celui que l\'étape demande');
  });
  // Ce qui tient déjà ne bouge pas ; ce qui ne tiendra jamais non plus.
  assert.strictEqual(V.hautPourBulle({ l: 262, t: 60, r: 1396, b: 380 }, bulle, ecran, 'dessous'), null, 'une zone qui laisse déjà sa place fait défiler la page');
  assert.strictEqual(V.hautPourBulle({ l: 262, t: 100, r: 700, b: 700 }, bulle, ecran), null, 'une zone qui laisse un côté libre fait défiler la page');
  assert.strictEqual(V.hautPourBulle({ l: 262, t: 60, r: 1396, b: 700 }, bulle, ecran), null, 'une zone trop haute pour sa bulle fait défiler pour rien');
  // Et le moteur s'en sert, APRÈS avoir amené la zone à l'écran (sinon il mesure l'écran d'avant).
  const vj = lireSource('src', 'renderer', 'visite.js');
  const i = vj.indexOf('if (!cur.defile) {');
  const zone = vj.slice(i, vj.indexOf('\n      }', i));
  assert.ok(i > 0 && zone.indexOf('scrollIntoView') > 0 && zone.indexOf('scrollIntoView') < zone.indexOf('hautPourBulle(') && /defilerDe\(zoneEl, /.test(zone),
    'le défilement ne libère plus la place de la bulle, ou mesure avant d\'avoir amené la zone à l\'écran');
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
  // `lesPas` : la lecture UNIQUE des premiers pas (10.14.0), celle de l'accueil et de « Me guider ».
  const lp = app.match(/const lesPas = \(\) => (C\.firstSteps\(data, company\(\), \{[^}]*\}\));/);
  assert.ok(lp, 'lesPas introuvable');
  const ctx = {
    data: { documents: [], clients: [] }, copieExterne: null, dossierPartage: false, company: () => Core.DEFAULT_COMPANY,
    C: { estDemo: x => !!x.demo, firstSteps: Core.firstSteps },
    visitesEtat: () => ({ faites: {} }),
    VISITES_DES_PAS: new Set(['premiers-pas', ...Object.values(PAS_VISITES)]),
    minuscule: t => String(t || '').charAt(0).toLowerCase() + String(t || '').slice(1)
  };
  ctx.lesPas = vm.runInNewContext('(() => ' + lp[1] + ')', ctx);
  const progres = vm.runInNewContext('(' + pm[1] + ')', ctx);
  const r = progres({ id: 'premier-client' });
  // La découverte est en tête de liste, pas faite — et pourtant la prochaine étape est la fiche :
  // une étape FACULTATIVE ne passe jamais devant une étape du métier (10.14.0).
  assert.ok(r && r.total >= 6 && r.fait === 0 && /^Prochaine étape : compléter ta fiche société\.$/.test(r.texte), JSON.stringify(r));
  // La découverte faite COMPTE (la liste démarre à « 1 sur n »), et ne change pas la suite.
  ctx.visitesEtat = () => ({ faites: { decouvrir: '2026-09-24' } });
  const r2 = progres({ id: 'premier-client' });
  assert.ok(r2 && r2.fait === 1 && /compléter ta fiche société/.test(r2.texte), JSON.stringify(r2));
  ctx.visitesEtat = () => ({ faites: {} });
  assert.strictEqual(progres({ id: 'page-factures' }), null, 'la visite d\'une page ne montre pas les premiers pas');
  ctx.data = { documents: [], clients: [], demo: true };
  assert.strictEqual(progres({ id: 'premier-client' }), null, 'jamais sur l\'exemple');
});

// ------------------------------------------------------------------ le démarrage (10.14.0, suite)
// Skander : « es-ce que tu me conseilles de mettre le parcours de démarrage après la visite guidée et
// la découverte de l'app ? Si on tombe sur un formulaire au début, on a tendance à passer et revenir
// plus tard. » La porte d'abord (découvrir ou commencer), trois questions ensuite, et tout le reste
// dans « Tes premiers pas », au moment où la question devient concrète.

t('10.14.0 : « Tes premiers pas » — l\'ordre, les étapes facultatives, et l\'étape suivante qui ne les propose jamais', () => {
  const Core = require('../../src/renderer/core.js');
  const complete = { ...Core.DEFAULT_COMPANY, name: 'Atelier Nour SUARL', matricule: '1234567A/A/M/000', rib: '07040005810111129653' };
  assert.deepStrictEqual(Core.companyGaps(complete), [], 'les données doivent discriminer : une fiche complète');
  const vide = Core.firstSteps({ documents: [], clients: [], catalog: [] }, Core.DEFAULT_COMPANY, {});
  const ids = vide.etapes.map(e => e.id);
  assert.deepStrictEqual(ids, ['decouverte', 'societe', 'marque', 'client', 'catalogue', 'devis', 'sauvegarde', 'envoi', 'facture', 'comptable']);
  // La copie de sécurité vient JUSTE APRÈS le premier devis : avant, elle protégeait un fichier vide.
  assert.strictEqual(ids.indexOf('sauvegarde'), ids.indexOf('devis') + 1);
  assert.deepStrictEqual(vide.etapes.filter(e => e.facultatif).map(e => e.id), ['decouverte', 'marque', 'comptable'], 'seules la découverte, la facture à ton image et le comptable sont facultatifs');
  // La découverte est en tête et pas faite — l'étape suivante est pourtant la fiche société.
  assert.strictEqual(vide.suivante.id, 'societe', 'une étape facultative passe devant une étape du métier');
  // Faite, la découverte COMPTE : la liste démarre à « 1 sur n ».
  const apres = Core.firstSteps({ documents: [], clients: [], catalog: [] }, Core.DEFAULT_COMPANY, { decouverte: true });
  assert.strictEqual(apres.faits, 1);
  assert.strictEqual(apres.suivante.id, 'societe');
  // Tout le métier fait, ni découverte ni comptable : le panneau se retire — un panneau qui ne
  // disparaîtrait jamais parce qu'on n'a pas de comptable serait celui qu'on apprend à ne plus lire.
  const metier = {
    clients: [{ id: 'c1', name: 'Hôtel' }], catalog: [{ id: 'k', label: 'Pose', unitPrice: 50 }],
    documents: [{ id: 'q', type: 'devis', status: 'envoyé', clientId: 'c1' }, { id: 'f', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', clientId: 'c1' }]
  };
  const fin = Core.firstSteps(metier, complete, { copieExterne: true });
  assert.strictEqual(fin.demarrage, false, 'les étapes facultatives retiennent le panneau');
  assert.strictEqual(fin.suivante, null, 'une étape facultative devient « la suivante »');
  assert.ok(['decouverte', 'marque', 'comptable'].every(id => fin.etapes.find(e => e.id === id).fait === false), 'les données doivent discriminer : aucune étape facultative faite');
  // Le comptable est relié par son adresse OU par son fichier d'appairage — une adresse vide ne compte pas.
  const cpt = co => Core.firstSteps(metier, co, {}).etapes.find(e => e.id === 'comptable').fait;
  assert.strictEqual(cpt({ ...complete, accountantEmail: '   ' }), false);
  assert.strictEqual(cpt({ ...complete, accountantEmail: 'cabinet@exemple.tn' }), true);
  assert.strictEqual(cpt({ ...complete, cabinet: { name: 'Cabinet Ben Salah', publicKey: 'MCow' } }), true);
  // Et chaque étape a son geste dans l'accueil : une étape sans bouton serait une consigne de lecture.
  const app = lireSource('src', 'renderer', 'app.js');
  const pa = app.slice(app.indexOf('const PAS_ACTIONS = {'), app.indexOf('};', app.indexOf('const PAS_ACTIONS = {')));
  assert.ok(pa.length > 200, 'PAS_ACTIONS introuvable');
  const actions = new Set(vide.etapes.concat(Core.firstSteps({ documents: [{ type: 'devis' }] }, Core.DEFAULT_COMPANY, {}).etapes).map(e => e.action).filter(Boolean));
  actions.forEach(a => assert.ok(new RegExp('\\b' + a + ': \\[').test(pa), 'l\'étape « ' + a + ' » n\'a pas de bouton dans l\'accueil'));
});

t('10.14.0 : la porte — deux battants, un seul vert, vue une fois ; et l\'assistant ne garde que trois questions', () => {
  const OB = require('../../src/renderer/onboarding.js');
  const Core = require('../../src/renderer/core.js');
  const portes = OB.STEPS.filter(s => s.porte);
  assert.strictEqual(portes.length, 1);
  assert.strictEqual(OB.STEPS[0], portes[0], 'la porte est le premier écran');
  const questions = OB.STEPS.filter(s => !s.porte);
  assert.ok(questions.length >= 1 && questions.length <= 3, 'trois questions au plus : ' + questions.map(q => q.id));
  const app = lireSource('src', 'renderer', 'app.js');
  const rs = app.slice(app.indexOf('function runSetup(rejoue) {'), app.indexOf('async function decouvrirDepuisLaPorte('));
  assert.ok(rs.length > 6000 && rs.length < 30000, 'tranche de runSetup inattendue : ' + rs.length);
  // Elle ne s'ouvre ni au rejeu, ni sur l'exemple, ni pour qui l'a déjà vue ou a fait la découverte.
  assert.ok(/const porte = !rejoue && !et\.faites\.decouvrir && !et\.accueilVu && !C\.estDemo\(data\);/.test(rs), 'la condition de la porte a changé');
  assert.ok(/if \(i < premier\) i = premier;/.test(rs), 'une reprise peut rouvrir la porte à quelqu\'un qui l\'a passée');
  // Vue quel que soit le battant : découvrir, commencer, ou passer.
  const zone = (debut, fin) => rs.slice(rs.indexOf(debut), rs.indexOf(fin, rs.indexOf(debut)));
  const dec = zone("$('#sf-decouvrir', root).onclick", "if ($('#sf-prev'");
  const suite = zone("$('#sf-next', root).onclick", 'root.onkeydown');
  const passer = zone("$('#sf-skip', root).onclick", 'const collect = ');
  [['découvrir', dec], ['commencer', suite], ['passer', passer]].forEach(([nom, z]) => {
    assert.ok(z.length > 60 && /porteVue\(\);/.test(z), `« ${nom} » ne marque pas la porte comme vue`);
  });
  // Découvrir laisse l'assistant EN ATTENTE à la première question — la sauvegarde de l'exemple le
  // garde, et en sortir le rouvre là.
  assert.ok(/etape\(i \+ 1\);\s*root\.remove\(\);\s*resolve\('decouvrir'\);/.test(dec), 'découvrir ne laisse plus l\'assistant en attente');
  // Un seul vert sur la porte, et Entrée ne clique pas « Continuer » sur un bouton.
  const corps = rs.slice(rs.indexOf('if (s.porte) {'), rs.indexOf("if (s.id === 'entreprise')"));
  assert.strictEqual((corps.match(/btn-primary/g) || []).length, 1, 'la porte doit porter UN bouton vert');
  assert.ok(/class="btn btn-primary" id="sf-decouvrir"/.test(corps) && /class="btn" id="sf-next"/.test(corps), 'le vert est « Découvrir », « Commencer » est un bouton ordinaire');
  assert.ok(/\$\{s\.porte \? '' : `<button class="btn btn-primary" id="sf-next">/.test(rs), 'le pied de la porte porte un second « Continuer » vert');
  assert.ok(/\['TEXTAREA', 'BUTTON', 'A', 'SELECT'\]\.includes\(e\.target\.tagName\) \|\| steps\[i\]\.porte\) return;/.test(rs), 'Entrée sur un bouton de la porte clique « Continuer » à sa place');
  // Le compte des questions se lit sur OB.STEPS, jamais écrit à la main (règle 7.3.0).
  assert.ok(/LETTRES\[questions\.length\]/.test(corps), 'le nombre de questions est écrit à la main sur la porte');
  // Les règles de facturation que l'assistant ne demande plus ont leurs usages par défaut.
  const def = (/const defauts = (\{[^}]*\});/.exec(rs) || [])[1];
  const defauts = require('vm').runInNewContext('(' + def + ')');
  assert.deepStrictEqual([defauts.currency, defauts.stampFee, defauts.quoteValidityDays, defauts.paymentTermsDays, defauts.defaultWithholdingRate], ['DT', 1, 30, 30, 0]);
  // Une écriture intermédiaire garde l'assistant « à reprendre » : sans elle, revenir de l'exemple
  // atterrissait sur une fiche société vide, au milieu des Paramètres.
  const data = JSON.parse(JSON.stringify(Core.DEFAULT_DATA));
  OB.applySetup(data, {}, { done: false, step: 1 });
  assert.strictEqual(OB.needsSetup(data), true);
  assert.strictEqual(data.company.setupStep, 1);
});

t('10.14.0 : après la découverte, l\'assistant reprend — au démarrage comme à la sortie de l\'exemple', () => {
  const app = lireSource('src', 'renderer', 'app.js');
  // Le démarrage : « Découvrir » choisi sur la porte lance l'exemple APRÈS le premier dessin.
  // Jusqu'à la fin de la séquence de démarrage (`})();`), jamais un nombre de caractères en dur : une
  // ligne de plus au démarrage (10.14.0, la commande en attente) faisait tomber ce test sur du code juste.
  const iBoot = app.indexOf('let decouvrirDabord = false;');
  const boot = app.slice(iBoot, app.indexOf('\n  })();', iBoot));
  assert.ok(boot.length > 500 && boot.length < 12000, 'tranche du démarrage inattendue : ' + boot.length);
  assert.ok(/decouvrirDabord = done === 'decouvrir';/.test(boot) && /if \(decouvrirDabord\) decouvrirDepuisLaPorte\(\);/.test(boot), 'le battant « Découvrir » n\'est plus suivi au démarrage');
  // L'exemple qui ne se charge pas rend la main à l'assistant : personne ne reste devant un accueil vide.
  const ddp = app.slice(app.indexOf('async function decouvrirDepuisLaPorte() {'), app.indexOf('async function reprendreAssistant() {'));
  assert.ok(/if \(await loadDemo\(\)\) \{ lancerVisite\(visiteParId\('decouvrir'\)\); return; \}/.test(ddp) && /reprendreAssistant\(\)/.test(ddp));
  const ra = app.slice(app.indexOf('async function reprendreAssistant() {'), app.indexOf('async function rejouerAssistant('));
  assert.ok(/if \(!OB\.needsSetup\(data\)\) return false;/.test(ra), 'reprendre l\'assistant sans vérifier qu\'il attend quelque chose');
  // La sortie de l'exemple reprend l'assistant AVANT de naviguer, et une sauvegarde VIDE se dit comme
  // un départ, pas comme un retour de « 0 document, 0 client ».
  const ds = app.slice(app.indexOf('async function demoSortie() {'), app.indexOf('function render(keepScroll)'));
  const iRep = ds.indexOf('await reprendreAssistant();'), iNav = ds.indexOf("navigate(data.company.name ? '#/dashboard' : '#/parametres')");
  assert.ok(iRep > 0 && iRep < iNav, 'la sortie de l\'exemple ne reprend pas l\'assistant avant de naviguer');
  assert.ok(/const vide = ok && !vu\.societe && !Object\.values\(vu\.compte \|\| \{\}\)\.some\(n => n > 0\);/.test(ds), 'une sauvegarde vide ne se reconnaît plus');
  assert.ok(/vide \? 'Passer à ma vraie entreprise'/.test(ds), 'le bouton annonce un retour de données qui n\'existent pas');
  assert.ok(/if \(!vide\) toast\('Tes données sont revenues'\);/.test(ds), '« Tes données sont revenues » sur une entreprise vide');
});

// ------------------------------------------------------ les visites « techniques » (10.14.0, suite)
// Skander : « as-tu couvert les parties techniques — répondre à son comptable, faire le paquet, trouver
// un fichier joint, faire la mise à jour ? » Elles l'étaient à moitié : l'exemple n'avait aucune
// question de comptable à montrer, et le même bouton se disait de la même façon sur trois pages.

t('10.14.0 : un même attribut porte le geste de SA page — « Ouvrir » n\'ouvre pas une entreprise depuis un fichier joint', () => {
  // `data-open` porte trois gestes : une entreprise (Paramètres), un module (Tous les modules), un
  // fichier joint (une pièce, un achat). Sans la page, la bulle d'un fichier joint disait « Ouvre
  // cette entreprise » : une explication FAUSSE est pire qu'une explication absente — l'instrument de
  // couverture compte les absentes, aucun ne voit les fausses.
  const faux = {
    id: '', dataset: { open: 'x' }, textContent: 'devis-signe.pdf',
    matches: s => s === '[data-open]', getAttribute: () => null,
    classList: { contains: () => false }, closest: () => null, querySelector: () => null,
    cloneNode: () => ({ querySelectorAll: () => [], textContent: 'devis-signe.pdf' })
  };
  const sur = page => S.expliquer(faux, { route: () => page, G: { INFO: {} } });
  ['doc', 'achat'].forEach(p => {
    const x = sur(p);
    assert.ok(x && /fichier joint/.test(x.texte) && !/entreprise/.test(x.texte), 'sur « ' + p + ' » : ' + JSON.stringify(x));
  });
  assert.ok(/entreprise/.test(sur('parametres').texte), 'dans les Paramètres, c\'est une entreprise qu\'on ouvre');
  assert.ok(/module/.test(sur('modules').texte), 'dans « Tous les modules », c\'est un module');
  // Ailleurs, on ne devine pas : l'instrument de couverture le signalera.
  assert.strictEqual(sur('stats'), null, 'une page inconnue reçoit l\'explication d\'une autre');
});

t('10.14.0 : l\'exemple porte les questions de son comptable — sans réponse, et sur des pièces qui existent', () => {
  // Sans elles, « Répondre à mon comptable » et le chapitre du comptable montraient un panneau vide :
  // on ne montre pas un geste sur une page qui n'a rien à faire.
  const Core = require('../../src/renderer/core.js');
  const demo = require('../../src/renderer/demo.js');
  const data = Core.migrateData(demo.buildDemoData({ ...Core.DEFAULT_COMPANY, name: 'Test SUARL' }, '2026-09-24'));
  const qs = data.questionsCabinet || [];
  assert.strictEqual(qs.length, 2, 'deux questions attendues : ' + qs.map(q => q.piece));
  qs.forEach(q => {
    assert.ok(!q.reponse, 'une réponse posée d\'avance partirait dans le paquet de l\'exemple : ' + q.piece);
    assert.ok((data.purchases || []).some(p => p.number === q.piece), 'la pièce « ' + q.piece + ' » n\'existe pas dans l\'exemple');
    assert.ok(q.texte && q.texte.length > 40 && q.compte && q.periode, 'question incomplète : ' + q.piece);
    assert.ok(q.periode <= '2026-09', 'une question datée d\'un mois futur');
  });
  // Deux attentes différentes, pour montrer les deux gestes : confirmer, et joindre la pièce.
  assert.deepStrictEqual(qs.map(q => q.attendu).sort(), ['confirmation', 'piece']);
  // Et le paquet de l'exemple n'emporte aucune réponse : il est aussi la source des journaux
  // pré-calculés du Cabinet, qui ne doivent pas changer pour autant.
  assert.deepStrictEqual(require('../../src/renderer/compta.js').reponsesAEnvoyer(qs), [], 'le paquet de l\'exemple emporterait des réponses');
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

// Une visite qui NOMME un bouton doit nommer celui que l'écran porte (7.3.0 : une phrase affichée
// que rien ne tient est un bug). Vu à l'écran, 10.14.0 : « Le bouton vert te dit lequel » — le vert
// était ailleurs ; « Chapitre suivant » quand le moteur écrit « Passer au chapitre suivant » ;
// « Faire mon premier devis », une visite qui n'existe pas. Chaque citation « … » des textes des
// visites existe dans l'application, ou nomme une visite, ou figure ci-dessous AVEC la ligne de code
// qui la fabrique — une liste d'exceptions qui ne se vérifie pas finit par mentir à son tour.
t('10.14.0 : chaque libellé qu\'une visite cite « entre guillemets » existe dans l\'application', () => {
  const fs = require('fs'), path = require('path');
  const dossier = path.join(__dirname, '..', '..', 'src', 'renderer');
  const source = fs.readdirSync(dossier).filter(f => /\.(js|html)$/.test(f) && f !== 'visites.js')
    .map(f => fs.readFileSync(path.join(dossier, f), 'utf8')).join('\n').replace(/\\'/g, "'");
  const app = lireSource('src', 'renderer', 'app.js');
  // Les libellés FABRIQUÉS (un nombre, un accord) : la ligne qui les fabrique doit exister.
  const FABRIQUES = {
    'Refaire le paquet avec ta réponse': 'Refaire le paquet avec ${',
    'Établir les … bulletins manquants': "`Établir les ${pl(missing.length, 'bulletin')} manquants`"
  };
  // Des exemples de ce qu'on TAPE, pas des libellés.
  const EXEMPLES = new Set(['Villa Carthage', 'Cantine de l\'école']);
  Object.entries(FABRIQUES).forEach(([l, frag]) => assert.ok(app.includes(frag), `« ${l} » n'est plus fabriqué par app.js : l'exception ment`));
  const titres = new Set(visites.map(v => v.titre));
  const textes = [];
  const cles = new Set(['titre', 'texte', 'action', 'conclusion', 'resume', 'bravo']);
  // Les visites, et les tables d'explications (une table clé → phrase compte chacune de ses phrases).
  const ramasser = (o, ou, vus, table) => {
    if (!o || typeof o !== 'object' || vus.has(o)) return;
    vus.add(o);
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') { if (table || cles.has(k)) textes.push([v, ou + '.' + k]); }
      else if (v && typeof v === 'object') ramasser(v, ou + '/' + k, vus, false);
    }
  };
  visites.forEach(v => ramasser(v, v.id, new Set(), false));
  ['BOUTONS', 'ZONES', 'CHAMPS', 'MENUS', 'ONGLETS', 'PAGES'].forEach(nom => ramasser(S[nom], nom, new Set(), true));
  assert.ok(textes.length > 800, 'textes lus : ' + textes.length);
  const propre = s => s.replace(/<[^>]+>/g, '').replace(/[…\s.]+$/, '').trim();
  const fautes = [];
  let citations = 0;
  textes.forEach(([t, ou]) => {
    for (const m of t.matchAll(/«\s*([^»]{2,90}?)\s*»/g)) {
      const q = propre(m[1]);
      citations++;
      if (source.includes(q) || titres.has(q) || FABRIQUES[q] || EXEMPLES.has(q)) continue;
      fautes.push(`« ${q} » (${ou})`);
    }
  });
  assert.ok(citations > 60, 'citations lues : ' + citations);
  assert.deepStrictEqual(fautes, [], 'une visite cite un libellé que l\'application n\'a pas');
});

// Vu à l'écran : « Joindre un justificatif » passait à « Où il est rangé » dès le clic — le choix de
// fichier annulé, la bulle décrivait « le nom ouvre le fichier, Dossier le montre » au-dessus de
// « Aucun justificatif ». Et un « Enregistrer » refusé (un champ manque) faisait avancer la visite,
// fenêtre encore ouverte. Un clic n'est pas un geste fait : quand l'étape dit ce qui le prouve, c'est
// cette preuve qui décide.
t('10.14.0 : une étape « clique » qui dit ce qui prouve le geste attend cette preuve, pas le clic', () => {
  const vj = lireSource('src', 'renderer', 'visite.js').replace(/\/\/[^\n]*/g, '');
  const regle = vj.split('\n').filter(l => /cur\.clic/.test(l) && /fait = true/.test(l));
  assert.strictEqual(regle.length, 1, 'la règle du clic : ' + regle.length + ' ligne(s)');
  assert.ok(/typeof e\.fait !== 'function'/.test(regle[0]), 'le clic suffit encore quand l\'étape a sa preuve : ' + regle[0].trim());
  // Ce qui peut s'annuler ou se refuser porte sa preuve : un choix de fichier ou de dossier, le bouton
  // principal d'une fenêtre (un refus la garde ouverte), la fabrication d'un paquet.
  const annulables = [];
  visites.forEach(v => (v.etapes || []).forEach((e, i) => {
    if (e.faire !== 'clic') return;
    const cibles = [].concat(e.cible || []).join(' ');
    const texte = String(e.action || '') + ' ' + String(e.texte || '');
    const fenetre = /\.modal[^,]*(\.btn-primary|#ok)/.test(cibles);
    const fichier = /choisis le fichier|Choisir un dossier/.test(texte) || /#ext-choose|#cab-build|#attach-top|#cab-import/.test(cibles);
    if ((fenetre || fichier) && typeof e.fait !== 'function') annulables.push(v.id + '#' + i + ' (' + cibles + ')');
  }));
  assert.deepStrictEqual(annulables, [], 'des gestes annulables avancent sur le seul clic');
  // Les trois qu'on a vus à l'écran, nommément.
  const etape = (id, sel) => (parId(id).etapes || []).find(e => [].concat(e.cible || []).some(c => c === sel || c.includes(sel)));
  ['justificatif:#attach-top', 'sauvegarde:#ext-choose', 'paquet:#cab-build'].forEach(k => {
    const [id, sel] = k.split(':');
    const e = etape(id, sel);
    assert.ok(e && typeof e.fait === 'function', k + ' : pas de preuve');
  });
});

// Vu à l'écran : « Dossier » coupé de son guillemet — « en fin de ligne, le mot sur la suivante. La
// ponctuation double porte une espace fine insécable, dans la bulle comme dans le Cabinet (9.4.2).
t('10.14.0 : la bulle de la visite garde ses guillemets et sa ponctuation double avec leur mot', () => {
  const F = '\u202f';
  assert.strictEqual(V.typo('« Dossier » le montre ?'), '«' + F + 'Dossier' + F + '» le montre' + F + '?');
  assert.strictEqual(V.typo('Ensuite : le paquet ; puis !'), 'Ensuite' + F + ': le paquet' + F + '; puis' + F + '!');
  assert.strictEqual(V.typo('rien à changer'), 'rien à changer', 'un texte sans ponctuation double ne bouge pas');
  // Les trois dessins de la bulle (l'attente, l'étape, la fin) passent par la règle, APRÈS avoir
  // posé leur HTML — sinon le texte redessiné la perd.
  const vj = lireSource('src', 'renderer', 'visite.js');
  const poses = [...vj.matchAll(/els\.bulle\.innerHTML = `/g)].map(m => m.index);
  assert.ok(poses.length >= 3, 'dessins de la bulle : ' + poses.length);
  poses.forEach(i => {
    const fin = vj.indexOf('`;', i);
    const suite = vj.slice(fin, fin + 80);
    assert.ok(/typographier\(els\.bulle\)/.test(suite), 'un dessin de la bulle sans la règle typographique : ' + vj.slice(i, i + 60));
  });
});

// Vu à l'écran pendant la visite « Joindre un justificatif » : le bandeau de la question du comptable,
// sur l'achat STEG de l'exemple, finissait sa ligne sur « … n'est pas dans le paquet » et commençait
// la suivante par « ? », tout seul. Le texte est tapé DANS LE CABINET, avec des espaces ordinaires :
// l'app entreprise le met en typographie française à l'AFFICHAGE, jamais dans la donnée — elle repart
// telle quelle dans le paquet, et la case où l'on tape sa réponse ne réécrit pas ce qu'on vient d'y mettre.
t('10.14.0 : le texte d\'une question du comptable garde sa ponctuation double avec son mot', () => {
  const Core = require('../../src/renderer/core.js');
  const F = '\u202f';
  assert.strictEqual(Core.typoFr('peux-tu joindre sa photo ?'), 'peux-tu joindre sa photo' + F + '?');
  assert.strictEqual(Core.typoFr('« Oui » : merci ; vite !'), '«' + F + 'Oui' + F + '»' + F + ': merci' + F + '; vite' + F + '!');
  assert.strictEqual(Core.typoFr('https://skanfact.tn'), 'https://skanfact.tn', 'un « : » collé à son mot ne bouge pas');
  assert.strictEqual(Core.typoFr(null), '', 'une question sans texte ne s\'écrit pas « null »');
  // Jumelle de la règle de la bulle : les deux disent la même chose du même texte.
  ['« Dossier » le montre ?', 'Ensuite : le paquet ; puis !', 'rien', 'a  ?', '«  x »'].forEach(x =>
    assert.strictEqual(Core.typoFr(x), V.typo(x), 'les deux règles divergent sur « ' + x + ' »'));
  const app = lireSource('src', 'renderer', 'app.js').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const lignes = app.split('\n').filter(l => /\bh\([^\n]*\bq\.(?:texte|reponse)/.test(l));
  assert.ok(lignes.length >= 4, 'affichages du texte d\'une question retrouvés : ' + lignes.length);
  let cases = 0;
  lignes.forEach(l => {
    if (/<textarea/.test(l)) { cases++; assert.ok(!/typoFr/.test(l), 'la case de réponse réécrit ce qu\'on tape : ' + l.trim().slice(0, 120)); return; }
    for (const m of l.matchAll(/\bq\.(?:texte|reponse\.texte)\b/g)) {
      assert.strictEqual(l.slice(Math.max(0, m.index - 9), m.index), 'C.typoFr(', 'texte du comptable affiché sans la règle : ' + l.trim().slice(0, 120));
    }
  });
  assert.strictEqual(cases, 1, 'la case de réponse n\'a pas été retrouvée : le test ne juge plus ce qu\'il annonce');
});

// Vu à l'écran : « ME GUIDER » sur deux lignes dans la palette, et « Contrat de prestation » sur
// trois — la colonne des catégories fait une largeur fixe, et « Prestation » la dépassait déjà de
// 9 px. Une catégorie tient en UN mot court, sur une ligne. Mesuré dans l'application : 10 caractères
// en capitales de 10 px font 73 px (« Prestation »), la colonne en fait 78.
t('10.14.0 : chaque catégorie de la palette tient sur une ligne, dans sa colonne', () => {
  const app = lireSource('src', 'renderer', 'app.js');
  const cab = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const css = lireSource('src', 'renderer', 'style.css');
  const regle = (css.match(/\.palette \.res \.kind \{[^}]*\}/) || [''])[0];
  assert.ok(/white-space: nowrap/.test(regle), 'la catégorie peut passer à la ligne : ' + regle);
  const largeur = Number((regle.match(/width: (\d+)px/) || [])[1]);
  assert.ok(largeur >= 76, 'colonne trop étroite pour « Prestation » (73 px mesurés) : ' + largeur);
  const kinds = new Set();
  for (const src of [app, cab]) for (const m of src.matchAll(/kind: '([^']+)'/g)) kinds.add(m[1]);
  // Les catégories des pièces passent par la table courte, jamais par le titre entier.
  const table = (app.match(/const KIND_PIECE = \{([^}]*)\}/) || [])[1] || '';
  assert.ok(table, 'la table des catégories courtes a disparu');
  for (const m of table.matchAll(/:\s*'([^']+)'/g)) kinds.add(m[1]);
  assert.ok(/kind: KIND_PIECE\[d\.type\]/.test(app), 'les pièces reprennent leur titre entier dans la palette');
  // Les « kind » qui ne sont pas des catégories de palette (des états de listes, des natures).
  const HORS = new Set(['conges', 'banque', 'autre-sortie', 'annee', 'licence', 'facture']);
  const trop = [...kinds].filter(k => !HORS.has(k) && k.length > 10);
  assert.deepStrictEqual(trop, [], 'des catégories trop longues pour leur colonne');
});

// Vu à l'écran : « Le trombone — dans la liste des achats, 📎 marque ceux qui ont leur justificatif »
// éclairait le tableau « À payer », le PREMIER tableau de la page — sans un seul trombone. Une page
// d'achats en porte deux : une étape qui parle de LA liste vise la liste (`#list-wrap`).
t('10.14.0 : sur la page des achats, une étape qui parle de la liste éclaire la liste, pas « À payer »', () => {
  const app = lireSource('src', 'renderer', 'app.js');
  const achats = app.slice(app.indexOf('routes.achats = '), app.indexOf('function payablesPanel('));
  assert.ok(/payablesPanel\(\)/.test(achats) && /#list-wrap/.test(achats), 'la page des achats n\'a plus ses deux tableaux : le test ne discrimine plus');
  const fautes = [];
  visites.forEach(v => (v.etapes || []).forEach((e, i) => {
    if (e.page !== '#/achats') return;
    const premiere = [].concat(e.cible || [])[0] || '';
    if (/table/.test(premiere) && !/#list-wrap/.test(premiere)) fautes.push(v.id + '#' + i + ' → ' + premiere);
  }));
  assert.deepStrictEqual(fautes, [], 'une étape vise le premier tableau venu de la page des achats');
});

// Vu à l'écran : « Le trombone » amenait la liste des achats au bord de l'écran ; son en-tête collant
// colle sous la marge haute du conteneur (32 px) et recouvrait la première ligne — celle qui portait
// le 📎. Les défilements s'arrêtent à la même marge que le contenu.
t('10.14.0 : un défilement s\'arrête sous la marge où collent les en-têtes de tableau', () => {
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const main = (css.match(/(^|\n)main \{[^}]*\}/) || [''])[0];
  const haut = (main.match(/--main-haut: (\d+px)/) || [])[1];
  assert.ok(haut && new RegExp('padding: var\\(--main-haut\\)').test(main), 'la marge haute de la page n\'est plus une variable : le test ne discrimine plus');
  assert.ok(/scroll-padding-block-start: var\(--main-haut\)/.test(main), 'un défilement pose encore le contenu au ras du bord, sous l\'en-tête collant : ' + main);
  assert.ok(/table\.list thead th \{[^}]*position: sticky; top: 0/.test(css), 'les en-têtes de tableau ne collent plus : la règle ne sert plus');
});

t('10.14.0 : un geste « clique sur une ligne » se reconnaît sur n\'importe quelle ligne, pas seulement la première', () => {
  // La bulle éclaire la PREMIÈRE ligne qui correspond ; « Clique sur la ligne d'un client » vise
  // pourtant toutes les lignes. Le clic sur la troisième était ignoré, la page changeait, et la
  // bulle annonçait « On s'est perdus de vue » (vu à la souris, Production du Cabinet).
  const V = require('../../src/renderer/visite.js');
  const avant = global.getComputedStyle;
  global.getComputedStyle = () => ({ visibility: 'visible', display: 'block', opacity: '1' });
  try {
    const ligne = n => ({ n, isConnected: true, getBoundingClientRect: () => ({ width: 800, height: 38 }),
      closest: sel => (sel === '[hidden]' ? null : sel === '#view tr[data-id]' ? ligne.cache[n] : null), contains: x => x === ligne.cache[n] || (x && x.parent === ligne.cache[n]) });
    ligne.cache = {};
    [1, 2, 3].forEach(n => { ligne.cache[n] = ligne(n); });
    const cellule = { parent: ligne.cache[3], closest: sel => (sel === '#view tr[data-id]' ? ligne.cache[3] : null) };
    assert.ok(V.viseLaCible('#view tr[data-id]', ligne.cache[1], ligne.cache[1]), 'la première ligne');
    assert.ok(V.viseLaCible('#view tr[data-id]', ligne.cache[1], cellule), 'une cellule de la troisième ligne doit compter');
    assert.ok(V.viseLaCible(['.x', '#view tr[data-id]'], ligne.cache[1], cellule), 'une liste de sélecteurs aussi');
    const ailleurs = { closest: () => null };
    assert.ok(!V.viseLaCible('#view tr[data-id]', ligne.cache[1], ailleurs), 'un clic ailleurs ne compte pas');
  } finally { global.getComputedStyle = avant; }
  // Et le clic écouté en capture passe par cette règle, pas par la seule première cible.
  const vj = lireSource('src', 'renderer', 'visite.js');
  assert.ok(/if \(viseLaCible\(e\.cible, resoudre\(e\.cible\), ev\.target\)\) cur\.clic = Date\.now\(\);/.test(vj), 'le clic ne passe plus par viseLaCible');
  // Un clic qui vient d'avoir lieu n'est pas « se perdre » : la page qu'il ouvre fait disparaître la cible.
  const v = vj.slice(vj.indexOf('function verifier('), vj.indexOf("document.addEventListener('click'"));
  assert.ok(v.indexOf("if (e.faire === 'clic' && typeof e.fait !== 'function' && cur.clic) return;") > 0 &&
    v.indexOf("if (e.faire === 'clic' && typeof e.fait !== 'function' && cur.clic) return;") < v.indexOf('const perdu ='), 'un clic qui change de page passe encore pour « perdus de vue »');
});
};
