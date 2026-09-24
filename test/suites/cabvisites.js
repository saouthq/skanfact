'use strict';
// ============================================================================================
// La visite guidée du CABINET (10.14.0)
//
// Skander, après la visite de l'application entreprise : « commence par faire ce qu'on vient de faire
// dans le dernier lot sur l'app cabinet », puis : « oublie pas le onboarding aussi, et fais le même
// système : la démo avant l'écran de démarrage ».
//
// Le MOTEUR est celui de l'application entreprise (`src/renderer/visite.js`) : ces tests tiennent ce
// qui est propre au Cabinet — que chaque page et chacun des quatorze écrans de comptabilité aient leur
// visite, que chaque geste attendu porte son essai, que la découverte se fasse sur l'EXEMPLE, que
// chaque bouton expliqué existe, que « Tes premiers pas » se déduisent de l'état, et que la PORTE
// passe avant les questions. Dans l'application réelle, `npm run e2e:cabinet-couverture` vérifie que
// chaque contrôle visible a son explication.
module.exports = ({ t, assert, lireSource }) => {
const V = require('../../src/renderer/visite.js');
const CV = require('../../src/cabinet/renderer/cabvisites.js');
const K = require('../../src/cabinet/cabcore.js');
const G = require('../../src/cabinet/renderer/cabguide.js');

// Un contexte d'hôte sans Electron : un cabinet VIDE (aucun dossier à montrer).
const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => null, estExemple: () => false,
  cleSecours: () => null, copieExterne: () => false, Visite: V };
const visites = CV.parcours(ctx);
const parId = id => visites.find(v => v.id === id);
const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
// Une tranche de source bornée sur la FIN de ce qu'elle juge : la fonction suivante déclarée au même
// niveau (règle 10.4.0 : un voisin nommé déménage).
function fonction(src, debut) {
  const i = src.indexOf(debut);
  assert.ok(i >= 0, 'introuvable : ' + debut);
  const j = src.slice(i + debut.length).search(/\n {2}(async )?function \w+\(|\n {2}const \w+ = /);
  return src.slice(i, j < 0 ? src.length : i + debut.length + j);
}

t('10.14.0 Cabinet : chaque page et chacun des quatorze écrans de comptabilité ont leur visite', () => {
  // Les pages lues dans le routeur (jamais une liste écrite à la main), plus la page d'accueil.
  const routes = new Set(['dossiers', ...[...app.matchAll(/route === '([a-z-]+)'\) draw\w+\(view/g)].map(m => m[1])]);
  assert.ok(routes.size >= 8, 'pages lues : ' + [...routes].join(', '));
  const sans = [...routes].filter(r => !CV.PAGES[r] && r !== 'dossier');
  assert.deepStrictEqual(sans, [], 'des pages sans visite : ' + sans.join(', '));
  // Les écrans de la comptabilité : la liste de l'application et celle des visites se confrontent.
  const bloc = /const ONGLETS_COMPTA = \{([\s\S]*?)\};/.exec(app);
  assert.ok(bloc, 'ONGLETS_COMPTA introuvable');
  const ecrans = [...bloc[1].matchAll(/'?([a-z-]+)'?\s*:/g)].map(m => m[1]);
  assert.strictEqual(ecrans.length, 14, 'écrans lus : ' + ecrans.join(', '));
  assert.deepStrictEqual([...CV.ECRANS].sort(), [...ecrans].sort(), 'la liste des écrans des visites a divergé de celle de l\'application');
  ecrans.forEach(e => assert.ok(CV.PAGES['compta-' + e], 'l\'écran « ' + e + ' » n\'a pas sa visite'));
  // Et chaque page décrite a sa visite construite ; aucune ne décrit un écran qui n'existe pas.
  Object.keys(CV.PAGES).forEach(k => assert.ok(parId('page-' + k), 'la visite de « ' + k + ' » n\'est pas construite'));
  const morts = Object.keys(CV.PAGES).filter(k => k.startsWith('compta-') && !ecrans.includes(k.slice(7)));
  assert.deepStrictEqual(morts, [], 'des visites d\'écrans qui n\'existent pas : ' + morts.join(', '));
});

t('10.14.0 Cabinet : la clé d\'un écran se lit dans l\'adresse — un dossier, son onglet, son écran de comptabilité', () => {
  assert.strictEqual(CV.cleDePage('#/dossiers'), 'dossiers');
  assert.strictEqual(CV.cleDePage(''), 'dossiers');
  assert.strictEqual(CV.cleDePage('#/reglages'), 'reglages');
  assert.strictEqual(CV.cleDePage('#/dossier/MF%3A123'), 'dossier');
  assert.strictEqual(CV.cleDePage('#/dossier/MF%3A123/suivi'), 'dossier');
  assert.strictEqual(CV.cleDePage('#/dossier/MF%3A123/paquets'), 'dossier-paquets');
  assert.strictEqual(CV.cleDePage('#/dossier/MF%3A123/comptabilite'), 'compta');
  assert.strictEqual(CV.cleDePage('#/dossier/MF%3A123/comptabilite/grand-livre'), 'compta-grand-livre');
  // Chaque clé que l'adresse peut rendre porte une visite.
  CV.ECRANS.forEach(e => assert.ok(CV.PAGES[CV.cleDePage('#/dossier/x/comptabilite/' + e)], e));
});

t('10.14.0 Cabinet : chaque visite est complète — identifiant unique, thème connu, suites qui existent, article d\'Aide réel', () => {
  const ids = visites.map(v => v.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'deux visites portent le même identifiant');
  const themes = new Set(CV.THEMES.map(x => x.id));
  visites.forEach(v => {
    assert.ok(v.titre && v.resume && v.duree && v.bravo && v.conclusion, 'visite incomplète : ' + v.id);
    assert.ok(themes.has(v.theme), 'thème inconnu pour ' + v.id + ' : ' + v.theme);
    assert.ok(Array.isArray(v.etapes) && v.etapes.length, 'visite sans étape : ' + v.id);
    (v.suite || []).forEach(s => assert.ok(parId(s), `la suite « ${s} » de ${v.id} n'existe pas`));
    if (v.manque && v.manque.visite) assert.ok(parId(v.manque.visite), `« ${v.manque.visite} », proposée à ${v.id}, n'existe pas`);
  });
  CV.THEMES.forEach(th => assert.ok(visites.some(v => v.theme === th.id), 'le thème « ' + th.id + ' » n\'a aucune visite'));
  // L'article qu'une famille ouvre existe dans l'Aide du Cabinet — un renvoi mort ouvrirait l'Aide
  // sur rien.
  const articles = new Set(G.ARTICLES.map(a => a.id));
  CV.THEMES.filter(th => th.aide).forEach(th => assert.ok(articles.has(th.aide), `la famille « ${th.id} » renvoie à l'article « ${th.aide} », qui n'existe pas`));
});

t('10.14.0 Cabinet : chaque geste attendu porte son essai ; une visite qui peut se taire dit pourquoi — et sur un cabinet vide, ce sont bien elles', () => {
  const sansEssai = [];
  visites.forEach(v => v.etapes.forEach((e, i) => { if (V.estFaire(e) && !e.essai) sansEssai.push(v.id + '#' + i); }));
  assert.deepStrictEqual(sansEssai, [], 'des gestes sans essai : ' + sansEssai.join(', '));
  const muettes = visites.filter(v => typeof v.si === 'function' && !(v.manque && v.manque.texte)).map(v => v.id);
  assert.deepStrictEqual(muettes, [], 'des visites qui peuvent se taire sans dire pourquoi : ' + muettes.join(', '));
  const vides = visites.filter(v => typeof v.si === 'function' && !v.si()).map(v => v.id);
  // Un cabinet vide n'a aucun livre à montrer, ni un nom à mettre dans le fichier d'appairage…
  ['saisir-piece', 'declarer-tva', 'rapprocher', 'cloturer', 'questions-client', 'appairage', 'page-compta-saisie', 'page-dossier']
    .forEach(id => assert.ok(vides.includes(id), id + ' devrait attendre des données'));
  // … mais on commence toujours : la découverte, le nom, un client, la page d'accueil.
  ['decouvrir', 'nommer-cabinet', 'ajouter-client', 'page-dossiers', 'premiers-pas', 'cle-secours']
    .forEach(id => assert.ok(!vides.includes(id), id + ' doit se lancer sur un cabinet vide'));
  // Ce qu'on propose à la place mène à une visite qu'on PEUT faire sur un cabinet vide : jamais un
  // bouton éteint qui renvoie à un autre bouton éteint.
  visites.filter(v => vides.includes(v.id) && v.manque && v.manque.visite).forEach(v => {
    const avant = parId(v.manque.visite);
    assert.ok(avant && !(typeof avant.si === 'function' && !avant.si()), `${v.id} propose « ${v.manque.visite} », qui ne se lance pas non plus`);
  });
});

t('10.14.0 Cabinet : la découverte se fait sur l\'EXEMPLE, couvre le Cabinet chapitre par chapitre, et ne recopie jamais leur compte', () => {
  const d = parId('decouvrir');
  assert.strictEqual(d.exemple, true, 'la découverte doit charger l\'exemple');
  assert.ok(V.chapitres(d.etapes).length >= 7, 'la découverte doit couvrir tout le Cabinet : ' + V.chapitres(d.etapes).length + ' chapitres');
  // Elle passe par les deux sortes de dossiers : un client sur SkanFact, un client que le cabinet tient.
  const hash = sorte => d.etapes.filter(e => typeof e.page === 'function').length;
  assert.ok(hash() >= 10, 'la découverte doit ouvrir les dossiers de l\'exemple');
  // Et finit par le geste suivant : poser SON cabinet.
  assert.strictEqual(d.actions()[0].id, 'poser-cabinet');
  assert.ok(d.actions()[0].principal, '« Poser mon cabinet » est le geste principal de la fin');
  const textes = visites.flatMap(v => v.etapes.map(e => String(e.texte || '') + ' ' + String(e.titre || '')));
  const compte = textes.filter(x => /\b(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|\d+)\s+chapitres\b/i.test(x));
  assert.deepStrictEqual(compte, [], 'un compte de chapitres écrit à la main : ' + compte.join(' / ').slice(0, 200));
  // Les étapes d'un dossier se posent sur un dossier que la visite TROUVE : sur un cabinet vide, leur
  // adresse est nulle (le moteur ne navigue pas vers « #/dossier/null »).
  const surDossier = d.etapes.filter(e => typeof e.page === 'function');
  surDossier.forEach(e => assert.strictEqual(e.page(), null, 'une étape navigue vers un dossier qui n\'existe pas : ' + e.titre));
  const avec = CV.parcours({ ...ctx, dossier: s => 'DOS-' + s }).find(v => v.id === 'decouvrir');
  avec.etapes.filter(e => typeof e.page === 'function').forEach(e => assert.ok(/^#\/dossier\/DOS-(skanfact|hors)\/(suivi|paquets|comptabilite\/[a-z-]+)$/.test(e.page()), e.page()));
});

t('10.14.0 Cabinet : l\'algorithme qui explique un contrôle vit dans le MOTEUR — un seul pour les deux applications', () => {
  // Deux moteurs d'explication divergeraient au premier réglage (7.29.0) : les deux contenus
  // appellent `M.expliqueur` et `M.zoneur`, et le Cabinet réutilise les mêmes aides.
  const ent = lireSource('src', 'renderer', 'visites.js');
  const cab = lireSource('src', 'cabinet', 'renderer', 'cabvisites.js');
  [['entreprise', ent], ['Cabinet', cab]].forEach(([nom, src]) => {
    assert.ok(/M\.expliqueur\(\{/.test(src), nom + ' : l\'explication ne passe plus par le moteur');
    assert.ok(/M\.zoneur\(ZONES\)/.test(src), nom + ' : les zones ne passent plus par le moteur');
    assert.ok(!/function expliquer\(/.test(src), nom + ' : une seconde implémentation d\'`expliquer` est revenue');
  });
  assert.strictEqual(CV.libelleDe, V.libelleDe, 'le Cabinet a sa propre lecture des libellés');
  assert.strictEqual(typeof CV.expliquer, 'function');
  // Et le Cabinet charge le MÊME fichier, avant son contenu, dans son HTML et dans son paquet.
  const html = lireSource('src', 'cabinet', 'renderer', 'index.html');
  const iM = html.indexOf('../../renderer/visite.js'), iC = html.indexOf('cabvisites.js'), iA = html.indexOf('src="app.js"');
  assert.ok(iM > 0 && iM < iC && iC < iA, 'l\'ordre des scripts : le moteur, puis le contenu, puis l\'application');
  const conf = lireSource('build', 'cabinet.config.js');
  assert.ok(conf.includes("'src/renderer/visite.js'"), 'le moteur n\'entre pas dans le paquet du Cabinet : il démarrerait en développement et planterait une fois construit');
});

t('10.14.0 Cabinet : le dictionnaire des boutons — chaque entrée désigne un contrôle qui existe, et dit ce qu\'il fait', () => {
  const src = [lireSource('src', 'cabinet', 'renderer', 'app.js'), lireSource('src', 'cabinet', 'renderer', 'index.html'),
    ...['rowmenu.js', 'majui.js', 'reglages.js', 'listes.js'].map(f => lireSource('src', 'renderer', f))].join('\n');
  const existe = id => src.includes(`id="${id}"`) || src.includes(`'#${id}'`) || src.includes(`"#${id}"`) || src.includes(`#${id} `) || src.includes(`'${id}'`);
  const ids = [];
  CV.BOUTONS.forEach(b => {
    if (b.id) ids.push(b.id);
    else if (b.sel) (b.sel.match(/#[\w-]+/g) || []).forEach(x => ids.push(x.slice(1)));
  });
  Object.keys(CV.CHAMPS).filter(k => k.startsWith('#')).forEach(k => ids.push(k.slice(1)));
  // `#w-copier-emp` : l'ancien écran de l'assistant, gardé pour le jour où il remontrerait l'empreinte
  // (le test de l'empreinte copiable le tient) ; aucun autre identifiant n'a d'excuse.
  const absents = [...new Set(ids)].filter(id => !existe(id) && id !== 'w-copier-emp');
  assert.deepStrictEqual(absents, [], 'des explications pour des contrôles introuvables : ' + absents.join(', '));
  CV.BOUTONS.forEach(b => {
    assert.ok(b.rowmenu || b.onglet || (b.texte && b.texte.length >= 12), 'explication trop courte : ' + (b.id || b.sel));
    assert.ok(!(b.id && /[ ,#.[]/.test(b.id)), 'un identifiant qui est en fait un sélecteur : ' + b.id);
  });
  Object.entries(CV.CHAMPS).forEach(([k, v]) => assert.ok(v.length >= 12, 'explication de champ trop courte : ' + k));
  // Chaque onglet expliqué existe.
  const inconnus = Object.keys(CV.ONGLETS).map(k => k.split(':').pop()).filter(o => !app.includes(`'${o}'`) && !app.includes(`"${o}"`));
  assert.deepStrictEqual(inconnus, [], 'des onglets expliqués qui n\'existent pas : ' + inconnus.join(', '));
});

t('10.14.0 Cabinet : chaque visite porte une couleur que la feuille connaît — en clair ET en sombre', () => {
  const css = lireSource('src', 'renderer', 'style.css');
  const clair = new Set([...css.matchAll(/^\.th-([a-z]+)\s*\{[^}]*--th:/gm)].map(m => m[1]));
  const sombre = new Set([...css.matchAll(/^body\.dark \.th-([a-z]+)\s*\{[^}]*--th:/gm)].map(m => m[1]));
  const couleurs = new Set([...CV.THEMES.map(x => x.couleur), ...Object.values(CV.COULEUR_PAGE), ...visites.map(v => CV.couleurDe(v))]);
  couleurs.forEach(c => {
    assert.ok(c, 'une visite sans couleur');
    assert.ok(clair.has(c), `la couleur « ${c} » n'existe pas dans la feuille (.th-${c})`);
    assert.ok(sombre.has(c), `la couleur « ${c} » n'a pas sa jumelle sombre`);
  });
  assert.deepStrictEqual(Object.keys(CV.PAGES).filter(r => !CV.COULEUR_PAGE[r]), [], 'des pages sans couleur');
  assert.deepStrictEqual(Object.keys(CV.COULEUR_PAGE).filter(r => !CV.PAGES[r]), [], 'des couleurs pour des pages qui n\'existent pas');
});

t('10.14.0 Cabinet : chaque libellé qu\'une visite cite « entre guillemets » existe dans le Cabinet', () => {
  const fs = require('fs'), path = require('path');
  const lire = d => fs.readdirSync(d).filter(f => /\.(js|html)$/.test(f) && f !== 'cabvisites.js').map(f => fs.readFileSync(path.join(d, f), 'utf8'));
  const racine = path.join(__dirname, '..', '..', 'src');
  const source = [...lire(path.join(racine, 'cabinet', 'renderer')), fs.readFileSync(path.join(racine, 'cabinet', 'cabcore.js'), 'utf8'),
    ...['rowmenu.js', 'majui.js', 'reglages.js', 'visite.js'].map(f => fs.readFileSync(path.join(racine, 'renderer', f), 'utf8'))]
    .join('\n').replace(/\\'/g, "'");
  const titres = new Set(visites.map(v => v.titre));
  const textes = [];
  const cles = new Set(['titre', 'texte', 'action', 'conclusion', 'resume', 'bravo']);
  const ramasser = (o, ou, vus, table) => {
    if (!o || typeof o !== 'object' || vus.has(o)) return;
    vus.add(o);
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') { if (table || cles.has(k)) textes.push([v, ou + '.' + k]); }
      else if (v && typeof v === 'object') ramasser(v, ou + '/' + k, vus, false);
    }
  };
  visites.forEach(v => ramasser(v, v.id, new Set(), false));
  ['BOUTONS', 'ZONES', 'CHAMPS', 'MENUS', 'ONGLETS', 'PAGES'].forEach(nom => ramasser(CV[nom], nom, new Set(), true));
  assert.ok(textes.length > 300, 'textes lus : ' + textes.length);
  const propre = s => s.replace(/<[^>]+>/g, '').replace(/[…\s.]+$/, '').trim();
  const fautes = [];
  let citations = 0;
  textes.forEach(([x, ou]) => {
    for (const m of x.matchAll(/«\s*([^»]{2,90}?)\s*»/g)) {
      const q = propre(m[1]);
      citations++;
      if (source.includes(q) || titres.has(q)) continue;
      fautes.push(`« ${q} » (${ou})`);
    }
  });
  assert.ok(citations > 30, 'citations lues : ' + citations);
  assert.deepStrictEqual(fautes, [], 'une visite cite un libellé que le Cabinet n\'a pas');
});

t('10.14.0 Cabinet : une étape « clique » qui peut s\'annuler attend la preuve du geste, pas le clic', () => {
  // Un choix de fichier annulé, une fenêtre refusée : le clic a eu lieu, le geste non. Chaque bouton
  // qui ouvre un sélecteur ou une fenêtre à valider porte ce qui prouve le geste.
  const annulables = ['#imp', '#c-pair', '#s-rec', '#b-ext', '#modal-root #ok'];
  const sans = [];
  visites.forEach(v => v.etapes.forEach((e, i) => {
    if (e.faire === 'clic' && !e.facultatif && annulables.includes(e.cible) && typeof e.fait !== 'function') sans.push(v.id + '#' + i);
  }));
  assert.deepStrictEqual(sans, [], 'un geste annulable avance sur le simple clic : ' + sans.join(', '));
  // La preuve de ce qui AJOUTE se mesure contre l'état d'entrée — un paquet d'hier la rendrait vraie
  // d'avance (règle 10.14.0).
  const recevoir = parId('recevoir-paquet').etapes.find(e => e.cible === '#imp');
  assert.ok(typeof recevoir.avant === 'function' && typeof recevoir.fait === 'function', 'l\'import mesure son état d\'entrée');
});

t('10.14.0 Cabinet : « Tes premiers pas » se déduisent de l\'état — l\'ordre, la découverte facultative, l\'exemple qui ne compte pas', () => {
  const p0 = K.premiersPas({ cabinet: {}, dossiers: [] }, {});
  assert.deepStrictEqual(p0.etapes.map(e => e.id), ['decouverte', 'cabinet', 'clients', 'appairage', 'cle', 'copie', 'travail']);
  assert.strictEqual(p0.faits, 0);
  assert.strictEqual(p0.demarrage, true);
  assert.strictEqual(p0.suivante.id, 'cabinet', 'la découverte, facultative, ne passe jamais devant une étape du métier');
  assert.strictEqual(p0.etapes.find(e => e.id === 'decouverte').facultatif, true);
  // L'exemple ne compte pas comme un client, ni ses paquets comme un premier paquet.
  const demo = { cabinet: { name: 'Cab' }, dossiers: [{ id: 'd', demo: true, packs: [{ month: '2026-08' }] }] };
  const p1 = K.premiersPas(demo, { decouverte: true });
  assert.strictEqual(p1.etapes.find(e => e.id === 'clients').fait, false, 'un dossier d\'exemple a coché « Ajouter tes clients »');
  assert.strictEqual(p1.etapes.find(e => e.id === 'travail').fait, false, 'un paquet de l\'exemple a coché le premier paquet');
  assert.strictEqual(p1.suivante.id, 'clients');
  // « Ne pas savoir » n'est pas « non » : une clé dont la réponse n'est pas revenue ne se coche pas.
  assert.strictEqual(K.premiersPas(demo, { cleSecours: null }).etapes.find(e => e.id === 'cle').fait, false);
  // Tout en place — les facultatives ne retiennent pas le panneau.
  const plein = { cabinet: { name: 'Cab', pairingExportedAt: '2026-09-24T10:00:00Z' }, dossiers: [{ id: 'r', packs: [] }] };
  const p2 = K.premiersPas(plein, { cleSecours: true, copieExterne: true, tenus: { r: true } });
  assert.strictEqual(p2.demarrage, false, 'le panneau reste alors que le métier est en place');
  assert.strictEqual(p2.suivante, null);
  assert.strictEqual(p2.faits, p2.total - 1, 'seule la découverte reste — facultative');
  // Chaque étape a son geste ET sa visite guidée, dans l'application.
  const gestes = /const PAS_ACTIONS = \{([\s\S]*?)\n {2}\};/.exec(app);
  const guides = /const PAS_VISITES = \{([\s\S]*?)\};/.exec(app);
  assert.ok(gestes && guides, 'PAS_ACTIONS / PAS_VISITES introuvables');
  p0.etapes.forEach(e => {
    assert.ok(new RegExp('\\b' + e.action + ': \\[').test(gestes[1]), 'l\'étape « ' + e.id + ' » n\'a pas son bouton');
    const m = new RegExp('\\b' + e.action + ": '([a-z-]+)'").exec(guides[1]);
    assert.ok(m && parId(m[1]), 'l\'étape « ' + e.id + ' » n\'a pas sa visite guidée');
  });
});

t('10.14.0 Cabinet : la porte avant les questions — deux battants, un seul vert, vue une fois, et l\'assistant réduit à deux questions', () => {
  const rs = fonction(app, 'function runSetup(');
  assert.ok(rs.length > 2000 && rs.length < 20000, 'tranche de runSetup inattendue : ' + rs.length);
  const porte = rs.slice(rs.indexOf('porte: true'), rs.indexOf("t: 'Ton cabinet'"));
  assert.ok(porte.length > 500, 'la porte a disparu');
  assert.ok(porte.includes('id="w-decouvrir"') && porte.includes('id="w-next"'), 'les deux battants');
  assert.strictEqual((porte.match(/btn-primary/g) || []).length, 1, 'la porte porte un seul vert (U-11)');
  assert.ok(/id="w-decouvrir">/.test(porte) && /class="btn btn-primary" id="w-decouvrir"/.test(porte), 'le vert est la découverte');
  // Vue une fois : les DEUX battants la marquent, et la reprise ne la rouvre jamais.
  assert.ok(/\$\('#w-decouvrir', el\)\.onclick = \(\) => \{ porteVue\(\); fin\('decouvrir'\); \}/.test(porte), 'la découverte ne marque pas la porte vue');
  assert.ok(/next: \(\) => \{ porteVue\(\); return true; \}/.test(porte), 'commencer ne marque pas la porte vue');
  assert.ok(/const porte = !opts\.sansPorte && !et\.porteVue && !et\.faites\.decouvrir/.test(rs), 'la porte se rouvre après avoir été vue');
  // Le compte des questions se déduit des écrans, la porte n'en est pas une ; et il en reste deux.
  assert.ok(/const QUESTIONS = etapes\.filter\(e => !e\.porte\)\.length/.test(rs));
  const questions = (rs.match(/\n {8}\{\n {10}t: '/g) || []).length;
  assert.strictEqual(questions, 2, 'l\'assistant doit se réduire au nom et aux clients : ' + questions + ' écrans');
  ['w-rec', 'w-pair', 'w-ext'].forEach(id => assert.ok(!rs.includes(`id="${id}"`), `« ${id} » est revenu dans l'assistant : il vit dans Tes premiers pas`));
  // La découverte choisie à la porte la lance ; la reprise se fait SANS la porte, à la sortie de
  // l'exemple ou au démarrage d'un cabinet encore sans nom.
  assert.ok(/runSetup\(\)\.then\(r => \{ if \(r === 'decouvrir'\) lancerVisite\(visiteParId\('decouvrir'\)\); \}\)/.test(app), 'la porte ne lance pas la découverte');
  assert.ok((app.match(/runSetup\(\{ sansPorte: true \}\)/g) || []).length >= 2, 'l\'assistant ne reprend pas sans la porte');
});

t('10.14.0 Cabinet : le branchement — une seule porte décide qu\'une visite ne se lance pas, et l\'exemple se charge AVANT la découverte', () => {
  const lv = fonction(app, 'async function lancerVisite(');
  assert.ok(lv.length > 300 && lv.length < 3000, 'tranche de lancerVisite inattendue : ' + lv.length);
  const iManque = lv.indexOf('visiteManque(p)'), iEx = lv.indexOf('p.exemple'), iLance = lv.indexOf('Visite.lancer(');
  assert.ok(iManque > 0 && iManque < iEx && iEx < iLance, 'l\'ordre : ce qui manque, puis charger l\'exemple, puis lancer');
  assert.ok(/catch \(e\) \{ toast\(plainError\(e\), 'error'\); return; \}/.test(lv), 'un exemple qui ne se charge pas lance quand même la visite');
  // « Me guider » éteint ses boutons par la MÊME fonction (9.4.5).
  const guide = fonction(app, 'function drawGuide(');
  assert.ok((guide.match(/visiteManque\(/g) || []).length >= 1, '« Me guider » doit juger avec visiteManque');
  assert.ok(!/\.si\(\)/.test(guide), '« Me guider » ne rejuge pas `si` elle-même');
  // Le menu porte « Me guider », avant l'Aide ; la palette propose les gestes.
  const html = lireSource('src', 'cabinet', 'renderer', 'index.html');
  assert.ok(html.indexOf('data-route="guide"') > 0 && html.indexOf('data-route="guide"') < html.indexOf('data-route="aide"'), '« Me guider » avant l\'Aide dans le menu');
  assert.ok(/visites\(\)\.filter\(v => v\.type !== 'page' && !visiteManque\(v\)\)/.test(app), 'la palette propose des visites qui ne se lancent pas');
});

t('10.14.0 Cabinet : le fichier d\'appairage enregistré se retient — c\'est lui qui coche l\'étape', () => {
  const main = lireSource('src', 'cabinet', 'main.js');
  const h = main.slice(main.indexOf("'cab:exportPairing'"), main.indexOf('ipcMain.handle(', main.indexOf("'cab:exportPairing'") + 20));
  assert.ok(h.length > 100, 'handler introuvable');
  assert.ok(/pairingExportedAt = new Date\(\)\.toISOString\(\)/.test(h), 'l\'export du fichier ne se retient plus');
  // Il rend l'état, que l'écran reprend : sinon la case reste décochée jusqu'au redémarrage (7.1.x).
  assert.ok(/state:/.test(h), 'le handler ne rend plus l\'état');
  assert.ok(/pairingExportedAt/.test(fonction(lireSource('src', 'cabinet', 'cabcore.js'), 'function premiersPas(')), 'l\'étape ne lit plus l\'export');
});
};
