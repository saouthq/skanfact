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

t('10.14.0 Cabinet : chaque écran de travail a au moins un parcours où l\'on FAIT — pas seulement une visite qui décrit', () => {
  // Demandé par Skander : « il manque encore beaucoup de parcours… faire pareil pour cabinet ». Une
  // visite de page DÉCRIT ; un parcours « faire » fait jouer le geste. Chaque écran où l'on travaille
  // en a un — sauf l'Aide, « Me guider » et l'aiguillage de la comptabilité, qui ne portent aucun geste.
  // Un contexte PLEIN (un dossier de chaque sorte), sinon les adresses des dossiers valent null.
  const plein = { state: () => ({ cabinet: { name: 'X' }, dossiers: [{ id: 'A' }] }), dossier: () => 'A', estExemple: () => true,
    cleSecours: () => null, copieExterne: () => false, Visite: V };
  const cov = new Map();
  CV.parcours(plein).filter(v => v.type === 'faire').forEach(v => v.etapes.forEach(e => {
    const src = e.page || v.page;
    const adr = typeof src === 'function' ? src() : src;
    if (!adr) return;
    const k = CV.cleDePage(adr);
    if (!cov.has(k)) cov.set(k, new Set());
    cov.get(k).add(v.id);
  }));
  const SANS_GESTE = ['aide', 'guide', 'compta'];
  const sans = Object.keys(CV.PAGES).filter(k => !SANS_GESTE.includes(k) && !cov.has(k));
  assert.deepStrictEqual(sans, [], 'des écrans sans aucun parcours « faire » : ' + sans.join(', '));
  // Et un parcours « faire » fait jouer au moins un geste — sauf quand ce geste est irréversible ou sort
  // du Cabinet (clôturer, valider, composer un mail) : alors il NOMME pourquoi (`sansGeste`). Une
  // exception anonyme est un trou ; une exception sur un parcours qui a son geste est un mensonge.
  const faire = CV.parcours(plein).filter(v => v.type === 'faire');
  const muets = faire.filter(v => !v.etapes.some(e => V.estFaire(e)) && !(typeof v.sansGeste === 'string' && v.sansGeste.length > 30)).map(v => v.id);
  assert.deepStrictEqual(muets, [], 'des parcours « faire » sans aucun geste, et sans dire pourquoi : ' + muets.join(', '));
  const contradictoires = faire.filter(v => v.sansGeste && v.etapes.some(e => V.estFaire(e))).map(v => v.id);
  assert.deepStrictEqual(contradictoires, [], 'des parcours disent n\'avoir aucun geste et en ont un : ' + contradictoires.join(', '));
  // La moitié au moins fait vraiment jouer quelque chose : un « faire » qui ne fait rien est une page.
  assert.ok(faire.filter(v => !v.sansGeste).length >= faire.length * 0.7, 'trop de parcours « faire » qui ne font rien jouer');
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

t('10.14.1 (26/09) : sur un portefeuille hors SkanFact sans livre, la saisie propose de commencer le livre — pas d\'ajouter un client qui existe déjà', () => {
  const hors = { ...ctx, state: () => ({ cabinet: { name: 'Cab' }, dossiers: [{ id: 'h', name: 'Boulangerie Ennour', packs: [] }] }), avecLivre: () => new Set(), livres: () => 0 };
  const vs = CV.parcours(hors);
  const par = id => vs.find(v => v.id === id);
  const livre = par('premier-livre');
  assert.ok(livre && livre.si(), 'la visite « premier-livre » ne se lance pas sur un client hors SkanFact sans livre');
  ['saisir-piece'].forEach(id => {
    const v = par(id);
    assert.ok(v && !v.si(), id + ' se lance sans livre');
    assert.strictEqual(v.manque.visite, 'premier-livre', id + ' renvoie ailleurs que vers le premier livre : ' + v.manque.visite);
  });
  // Le livre commencé, il n'y a plus de client « à tenir » : la même question renvoie à l'ajout d'un client.
  const tenu = CV.parcours({ ...hors, avecLivre: () => new Set(['h']), livres: () => 1 });
  assert.ok(!tenu.find(v => v.id === 'premier-livre').si(), 'le premier livre se repropose à un client qui a le sien');
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
  // 26/09 — le livre vient juste après les clients : c'est le métier, et un portefeuille hors SkanFact
  // (le premier jour d'un comptable) n'a pas à passer par le fichier d'appairage pour y arriver.
  assert.deepStrictEqual(p0.etapes.map(e => e.id), ['decouverte', 'cabinet', 'equipe', 'clients', 'travail', 'appairage', 'cle', 'copie', 'saisie']);
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
  // Un client hors SkanFact sans livre : l'étape suivante est de commencer SON livre, et elle le nomme ;
  // un client archivé ou un dossier qui a reçu un paquet ne le devient pas.
  const hors = { cabinet: { name: 'Cab' }, dossiers: [{ id: 'z', name: 'Vieux', archived: true, packs: [] }, { id: 'h', name: 'Boulangerie Ennour', packs: [] }] };
  const ph = K.premiersPas(hors, {});
  assert.strictEqual(ph.suivante.id, 'travail', 'après les clients, l\'étape suivante n\'est plus le livre : ' + ph.suivante.id);
  assert.strictEqual(ph.suivante.action, 'livre');
  assert.strictEqual(ph.suivante.dossierId, 'h', 'le livre proposé est celui d\'un client archivé');
  assert.ok(/Boulangerie Ennour/.test(ph.suivante.quoi), 'l\'étape ne nomme pas le client');
  const recu = { cabinet: { name: 'Cab' }, dossiers: [{ id: 's', name: 'Sur SkanFact', packs: [{ month: '2026-08' }] }] };
  assert.strictEqual(K.premiersPas(recu, {}).etapes.find(e => e.id === 'travail').action, 'travail', 'un paquet reçu fait encore proposer un livre');
  // Un livre tenu, aucun paquet reçu : l'appairage et la clé de secours ne protègent encore rien,
  // la copie protège ses livres — elle passe devant. Le premier paquet reçu les rend dus.
  const tenu = K.premiersPas(hors, { tenus: { h: true } });
  assert.strictEqual(tenu.suivante.id, 'copie', 'un cabinet sans paquet se voit réclamer l\'appairage avant la copie de ses livres : ' + (tenu.suivante || {}).id);
  assert.ok(['appairage', 'cle'].every(id => tenu.etapes.find(e => e.id === id).facultatif), 'l\'appairage ou la clé retient le panneau sans paquet');
  const tenuRecu = K.premiersPas({ ...hors, dossiers: hors.dossiers.concat([{ id: 's', name: 'Sur SkanFact', packs: [{ month: '2026-08' }] }]) }, { tenus: { h: true } });
  assert.strictEqual(tenuRecu.suivante.id, 'appairage', 'un paquet reçu ne rend pas l\'appairage dû');
  assert.ok(!tenuRecu.etapes.find(e => e.id === 'cle').facultatif, 'un paquet reçu laisse la clé de secours facultative');
  // Tout en place — les facultatives ne retiennent pas le panneau.
  const plein = { cabinet: { name: 'Cab', pairingExportedAt: '2026-09-24T10:00:00Z' }, dossiers: [{ id: 'r', packs: [] }] };
  const p2 = K.premiersPas(plein, { cleSecours: true, copieExterne: true, tenus: { r: true } });
  assert.strictEqual(p2.demarrage, false, 'le panneau reste alors que le métier est en place');
  assert.strictEqual(p2.suivante, null);
  assert.deepStrictEqual(p2.etapes.filter(e => !e.fait).map(e => e.id), ['decouverte', 'equipe', 'saisie'], 'il ne reste que les facultatives');
  assert.ok(p2.etapes.filter(e => !e.fait).every(e => e.facultatif), 'une étape du métier reste à faire alors que tout est en place');
  // Chaque étape a son geste ET sa visite guidée, dans l'application.
  const gestes = /const PAS_ACTIONS = \{([\s\S]*?)\n {2}\};/.exec(app);
  const guides = /const PAS_VISITES = \{([\s\S]*?)\};/.exec(app);
  assert.ok(gestes && guides, 'PAS_ACTIONS / PAS_VISITES introuvables');
  [...p0.etapes, ph.suivante].forEach(e => {
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

t('10.14.0 Cabinet : le bandeau de l\'exemple est celui de l\'entreprise, et il vit sur CHAQUE page', () => {
  // Demandé par Skander : « l'alerte du jeu d'exemple doit devenir comme celle de l'app entreprise ».
  // Il ne vivait que sur la page Dossiers, en orange : sur une fiche, un livre ou une déclaration, rien
  // ne rappelait que les chiffres étaient inventés.
  const html = fonction(app, 'function htmlBandeauDemo(');
  assert.ok(html.length > 300 && html.length < 4000, 'tranche du bandeau inattendue : ' + html.length);
  ['demo-banner', 'db-ico', 'db-txt', 'db-actions'].forEach(c => assert.ok(html.includes(c), 'le bandeau n\'a pas la forme de celui de l\'entreprise : ' + c));
  const ent = lireSource('src', 'renderer', 'app.js');
  ['demo-banner', 'db-ico', 'db-txt', 'db-actions'].forEach(c => assert.ok(ent.includes(c), 'l\'entreprise n\'a plus ' + c + ' : les deux bandeaux ont divergé'));
  // Posé par le routeur, après la route — donc sur toutes les pages — et reposé quand une page
  // asynchrone réécrit `#view`.
  const render = fonction(app, 'function render(');
  const iRoute = render.indexOf('drawDossiers(view)'), iBandeau = render.indexOf('bandeauDemo()');
  assert.ok(iRoute > 0 && iBandeau > iRoute, 'le bandeau doit être posé par le routeur, après la page');
  assert.ok(/surveillerBandeauDemo\(\)/.test(render), 'une page asynchrone perdrait le bandeau');
  assert.ok(/MutationObserver/.test(fonction(app, 'function surveillerBandeauDemo(')), 'le bandeau ne revient pas après un redessin');
  // Et la page Dossiers n'a plus le sien : deux bandeaux pour le même exemple se contrediraient.
  assert.ok(!/id="demo-banner"/.test(fonction(app, 'function drawDossiers(')), 'la page Dossiers porte encore son propre bandeau');
});

t('10.14.0 Cabinet : l\'écran du mot de passe pose le curseur dans le champ, comme l\'app entreprise', () => {
  const i = app.indexOf("const pw = $('#lock-pw'), pw2 = $('#lock-pw2');");
  const j = app.indexOf("$('#lock-form').onsubmit", i);
  assert.ok(i > 0 && j > i && j - i < 3000, 'tranche de l\'écran de verrouillage inattendue');
  assert.ok(/\n\s*pw\.focus\(\);/.test(app.slice(i, j).replace(/\$\('#lock-eye'\)\.onclick = [\s\S]*?\n {4}\};/, '')), 'le champ du mot de passe ne reçoit pas le curseur à l\'ouverture');
  assert.ok(/const input = \$\('#lock-pw', el\); input\.focus\(\);/.test(lireSource('src', 'renderer', 'app.js')), 'l\'app entreprise ne pose plus le curseur : le jumeau a divergé');
});

t('10.14.0 Cabinet : le menu d\'un paquet sait si CE dossier a un livre — pas le livre gardé en mémoire', () => {
  const i = app.indexOf("label: 'Voir ses écritures'");
  assert.ok(i > 0, 'libellé introuvable');
  const avant = app.slice(i - 200, i);
  assert.ok(/aUnLivre\(dossier\.id\)\s*\?\s*\{ icon: 'contrat', $/.test(avant), 'le menu juge encore sur le livre en mémoire (celui d\'un autre client, ou aucun après un redémarrage)');
  // La réponse vient de l'index du dossier, lu à l'ouverture de sa fiche.
  assert.ok(/api\.livreIndex\(dossier\.id\)\.then\(ix => \{ livresConnus\.set\(dossier\.id,/.test(app), 'l\'index du dossier n\'est plus lu à l\'ouverture de la fiche');
  // Et le repli mémoire vérifie que le livre en mémoire est bien celui de CE dossier.
  assert.ok(/startsWith\(id \+ '\|'\)/.test(app.slice(app.indexOf('const aUnLivre ='), app.indexOf('const aUnLivre =') + 300)), 'le repli prend le livre d\'un autre client');
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
t('10.14.0 : une étape vise le menu d\'une LIGNE, jamais « le premier [data-rowmenu] venu » (les deux applications)', () => {
  // e2e:cabinet-visites : « Ouvre le menu d'une pièce » visait `#view [data-rowmenu]`. Le premier de
  // la page est celui de l'en-tête de la fiche (9.4.8), qui n'a qu'une action — « Imprimer » —, donc
  // un bouton nommé (7.29.0) : le clic ouvrait la boîte d'impression du système. Une cible réduite à
  // `[data-rowmenu]` nu change de sens dès qu'un menu s'ajoute plus haut dans la page.
  const fautes = [];
  [['src', 'renderer', 'visites.js'], ['src', 'cabinet', 'renderer', 'cabvisites.js']].forEach(ch => {
    const src = lireSource(...ch);
    const re = /cible:\s*(\[[^\]]*\]|'[^']*')/g; let m;
    while ((m = re.exec(src))) {
      const cibles = m[1].startsWith('[') ? (m[1].match(/'[^']*'/g) || []) : [m[1]];
      cibles.map(c => c.slice(1, -1)).forEach(c => {
        if (/^(#view\s+)?\[data-rowmenu\]$/.test(c.trim())) fautes.push(`${ch[ch.length - 1]} : ${c}`);
      });
    }
  });
  assert.deepStrictEqual(fautes, [], 'une étape vise le premier menu venu : ' + fautes.join(' ; '));
});
t('10.14.0 Cabinet : un handler dont l\'écran fait `S = await api.x()` rend l\'ÉTAT, jamais `{ ok, state }`', () => {
  // e2e:cabinet-visites : après « Enregistrer ma méthode », plus aucune page ne s'ouvrait. Le handler
  // rendait `{ ok: true, state }`, l'écran en faisait tout son état — sans `cabinet` —, et le rendu
  // suivant tombait sur `S.cabinet.name`. Le modèle de liasse avait le même, depuis la 10.0.0.
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const pre = lireSource('src', 'cabinet', 'preload.js');
  const main = lireSource('src', 'cabinet', 'main.js');
  const fns = [...new Set([...app.matchAll(/\bS = await api\.(\w+)\(/g)].map(m => m[1]))];
  assert.ok(fns.length >= 10, `seulement ${fns.length} appels lus : l'analyse ne voit plus l'écran`);
  const fautes = [];
  fns.forEach(f => {
    const m = pre.match(new RegExp('\\b' + f + ":[^\\n]*?invoke\\('([^']+)'"));
    assert.ok(m, `${f} : introuvable dans le préchargement`);
    const i = main.indexOf(`ipcMain.handle('${m[1]}'`);
    assert.ok(i >= 0, `${m[1]} : handler introuvable`);
    const ligne = main.slice(i, main.indexOf('\n', i));
    // Un handler d'une ligne (`=> save()`) s'arrête à sa ligne ; les autres à leur `});` en colonne 0.
    const corps = /=>\s*\{\s*$/.test(ligne) ? main.slice(i, main.indexOf('\n});', i)) : ligne;
    // Le corps entier du handler, jusqu'à son `});` en colonne 0 : les `return` d'une fonction
    // imbriquée (un `.map(r => { … return … })`) sont écartés par leur indentation profonde.
    const rets = [...corps.matchAll(/^ {2}(?: {2})?return ([^;\n]+)/gm)].map(r => r[1].trim());
    // Une expression fléchée (`=> save()`) n'a pas de `return` : elle est jugée sur sa flèche.
    const fleche = /^ipcMain\.handle\('[^']+',\s*\([^)]*\)\s*=>\s*(?!\{)(\S[^\n]*)/.exec(corps);
    if (fleche) rets.push(fleche[1].replace(/\)?;?\s*$/, '').trim());
    if (!rets.length) fautes.push(`${m[1]} : aucun retour`);
    rets.forEach(r => { if (!/^(save|safeState)\(\)$|^\(state \? safeState\(\) : null\)$/.test(r)) fautes.push(`${m[1]} rend « ${r} »`); });
  });
  assert.deepStrictEqual(fautes, [], 'un handler rend autre chose que l\'état : ' + fautes.join(' ; '));
});

t('10.14.0 : une explication écrite pour CE bouton passe avant une famille, et la famille « fenêtre » ne répond que dans une fenêtre (les deux applications)', () => {
  // « .modal-actions .btn-primary » — « Valide ce que tu viens de saisir dans la fenêtre » — était écrit
  // plus haut dans le dictionnaire que `#imp`, et le moteur prenait la PREMIÈRE entrée qui répond :
  // « Importer un paquet… », posé dans l'état vide d'une page, se disait « valide la fenêtre ».
  // L'instrument de couverture compte les explications ABSENTES ; aucun ne voit les fausses.
  const faux = (id, sels, txt) => ({
    id, dataset: {}, textContent: txt, getAttribute: () => null,
    matches: s => String(s).split(',').map(x => x.trim()).some(x => sels.includes(x)),
    classList: { contains: () => false }, closest: () => null, querySelector: () => null,
    cloneNode: () => ({ querySelectorAll: () => [], textContent: txt })
  });
  // 1. le MOTEUR, sur un dictionnaire fabriqué : la famille est écrite AVANT l'entrée propre.
  const ex = V.expliqueur({ B: [{ sel: '.famille', texte: 'le texte de la famille' }, { id: 'x', texte: 'le texte de ce bouton' }], route: () => 'p' });
  assert.strictEqual(ex(faux('x', ['.famille'], 'X'), { route: () => 'p', G: { INFO: {} } }).texte, 'le texte de ce bouton',
    'une famille écrite plus haut masque l\'explication écrite pour ce bouton');
  assert.strictEqual(ex(faux('y', ['.famille'], 'Y'), { route: () => 'p', G: { INFO: {} } }).texte, 'le texte de la famille',
    'sans entrée propre, la famille répond');
  // 2. les deux DICTIONNAIRES : un bouton vert dans la barre d'actions d'une PAGE n'est pas « la
  // fenêtre » ; dans une vraie fenêtre, si.
  const page = ['.modal-actions .btn-primary', '.btn-primary', '.btn'];
  const fenetre = page.concat(['.modal .modal-actions .btn-primary', '#modal-root .modal .modal-actions .btn-primary']);
  const S = require('../../src/renderer/visites.js');
  // La phrase de la famille, pas le mot « fenêtre » : « glisse-le sur la fenêtre » est juste (T-49 bis :
  // une sonde trop large accuse du code juste).
  const FAMILLE = /^Valide ce que tu viens de saisir dans la fenêtre/;
  [['Cabinet', CV.expliquer, 'dossiers'], ['entreprise', S.expliquer, 'clients']].forEach(([nom, expl, route]) => {
    const dansPage = expl(faux('', page, 'Faire quelque chose'), { route: () => route, G: { INFO: {} } });
    assert.ok(!dansPage || !FAMILLE.test(dansPage.texte), nom + ' : un bouton de PAGE se dit « la fenêtre » : ' + JSON.stringify(dansPage));
    const dansFenetre = expl(faux('', fenetre, 'Enregistrer'), { route: () => route, G: { INFO: {} } });
    assert.ok(dansFenetre && FAMILLE.test(dansFenetre.texte), nom + ' : dans une fenêtre, le bouton vert valide la fenêtre');
  });
  // 3. et les boutons des états vides du Cabinet ont leur propre phrase.
  ['imp', 'nd', 'rl-nd', 'rl-imp', 'ech-livre', 'ech-pair', 'lv-ecrire', 'ab-guides'].forEach(id => {
    const x = CV.expliquer(faux(id, page, id), { route: () => 'dossiers', G: { INFO: {} } });
    assert.ok(x && x.cle === '#' + id && !FAMILLE.test(x.texte), '#' + id + ' : ' + JSON.stringify(x));
  });
});

t('10.14.1 : le menu « Actions » de l\'EN-TÊTE d\'une fiche ne se décrit pas comme celui d\'une ligne', () => {
  // « Tous les autres gestes de cette ligne : ouvrir la pièce, contre-passer, extourner » sur le bouton
  // qui imprime la fiche du client (vu en guidant un débutant dans le livre-journal).
  const faux = (sels, txt) => ({
    id: '', dataset: {}, textContent: txt, getAttribute: () => null,
    matches: s => String(s).split(',').map(x => x.trim()).some(x => sels.includes(x)),
    classList: { contains: () => false }, closest: () => null, querySelector: () => null,
    cloneNode: () => ({ querySelectorAll: () => [], textContent: txt })
  });
  const S = require('../../src/renderer/visites.js');
  const LIGNE = /de cette ligne/;
  const fiche = CV.expliquer(faux(['[data-rowmenu]', '[data-rowmenu^="F:"]'], 'Actions'), { route: () => 'compta-journal', G: { INFO: {} } });
  assert.ok(fiche && !LIGNE.test(fiche.texte) && /imprimer/.test(fiche.texte), 'Cabinet, en-tête : ' + JSON.stringify(fiche));
  const releve = CV.expliquer(faux(['[data-rowmenu]', '[data-rowmenu^="REL:"]'], 'Ce relevé'), { route: () => 'compta-banque', G: { INFO: {} } });
  assert.ok(releve && !LIGNE.test(releve.texte), 'Cabinet, relevé : ' + JSON.stringify(releve));
  const ligne = CV.expliquer(faux(['[data-rowmenu]'], 'Actions'), { route: () => 'compta-journal', G: { INFO: {} } });
  assert.ok(ligne && LIGNE.test(ligne.texte), 'une vraie ligne perd son explication : ' + JSON.stringify(ligne));
  const client = S.expliquer(faux(['[data-rowmenu]', '[data-rowmenu^="CL:"]'], 'Actions'), { route: () => 'client', G: { INFO: {} } });
  assert.ok(client && !LIGNE.test(client.texte) && /relevé/.test(client.texte), 'entreprise, fiche client : ' + JSON.stringify(client));
});

t('10.14.0 Cabinet : les cartes du portefeuille s\'accordent au chiffre qu\'elles portent — « 1 client suivi », « 0 mois manquant »', () => {
  // « 1 clients suivis » sur le tout premier écran d'un cabinet qui vient d'ajouter son premier client
  // (vu au test humain) : le libellé vit à côté du nombre, séparé de lui, et `pl()` n'y passait pas.
  const src = fonction(app, 'function portfolioPanel(p) {');
  const vm = require('vm');
  const pl = (n, un, plur) => `${n} ${Math.abs(n) > 1 ? (plur || un + 's') : un}`;
  // Le `\n` avant la parenthèse : la tranche finit sur les commentaires qui suivent la fonction.
  const panneau = vm.runInNewContext('(' + src.replace(/^function portfolioPanel/, 'function') + '\n)',
    { esc: x => String(x), pl, money: x => String(x), K: { monthLabel: m => m } });
  const base = { surSkanfact: 1, horsSkanfact: 1, aJour: 0, enRetard: 0, provisoires: 0, paquets: 0, ca: {} };
  const texte = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const un = texte(panneau({ ...base, total: 1, moisManquants: 0 }));
  assert.ok(/\b1 client suivi\b/.test(un) && !/clients suivis/.test(un), 'un client : ' + un);
  assert.ok(/\b0 mois manquant\b/.test(un) && !/mois manquants/.test(un), 'aucun mois : ' + un);
  const trois = texte(panneau({ ...base, total: 3, moisManquants: 4 }));
  assert.ok(/\b3 clients suivis\b/.test(trois) && /\b4 mois manquants\b/.test(trois), 'plusieurs : ' + trois);
  // 26/09 — un portefeuille SANS client sur SkanFact ne montre pas trois cartes de paquets vides
  // (« 0 / 0 à jour », « aucun paquet reçu », « — de CA ») : il compte les livres qu'il tient.
  const hors = texte(panneau({ ...base, surSkanfact: 0, horsSkanfact: 3, total: 3, moisManquants: 0, livres: 1 }));
  assert.ok(!/à jour|mois manquant|de CA/.test(hors), 'des cartes de paquets sur un portefeuille hors SkanFact : ' + hors);
  assert.ok(/\b1 \/ 3 livre tenu\b/.test(hors) && /\b2 clients sans livre\b/.test(hors), 'hors SkanFact : ' + hors);
  const tous = texte(panneau({ ...base, surSkanfact: 0, horsSkanfact: 2, total: 2, moisManquants: 0, livres: 2 }));
  assert.ok(/\b2 \/ 2 livres tenus\b/.test(tous) && /chaque client a son livre/.test(tous), 'tous tenus : ' + tous);
});

t('10.14.0 Cabinet : les Échéances d\'un cabinet qui A des clients ne disent pas « Aucun client »', () => {
  // Un client hors SkanFact dont personne ne tient encore le livre n'a aucune échéance : la page disait
  // « Aucun client pour l'instant » à un cabinet qui venait d'en ajouter un (vu au test humain). Un état
  // vide dit SA raison (E-06), et le geste qui le remplit.
  const src = fonction(app, 'function drawEcheancesVides(view) {');
  // Et la page y passe bien quand la liste est vide.
  assert.ok(/if \(!liste\.length\) \{ drawEcheancesVides\(view\); return; \}/.test(fonction(app, 'function drawEcheances(view) {')),
    'la page des Échéances ne passe plus par son état vide');
  const vm = require('vm');
  const boutons = {};
  const dessiner = clients => {
    const view = { innerHTML: '' };
    const ctx = {
      K: { echeances: () => [], dossierList: () => clients, de: n => 'de ' + n },
      S: {}, esc: x => String(x), pl: (n, un) => `${n} ${n > 1 ? un + 's' : un}`,
      employeursConnus: () => ({}), tenusConnus: () => ({}), typographie: () => {},
      $: sel => (boutons[sel] = boutons[sel] || {}), newDossierForm: () => {}, versReglages: () => {}, location: {}
    };
    vm.runInNewContext('(' + src.replace(/^function drawEcheancesVides/, 'function') + '\n)(view)', { ...ctx, view });
    return view.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  };
  assert.ok(/Aucun client pour l'instant/.test(dessiner([])), 'un cabinet vide garde son état vide');
  const un = dessiner([{ id: 'd1', name: 'Garage Test' }]);
  assert.ok(!/Aucun client/.test(un), 'un cabinet qui a un client s\'entend dire qu\'il n\'en a aucun : ' + un);
  assert.ok(/Aucune échéance/.test(un) && /Garage Test n'est encore dans aucun/.test(un) && /Ouvrir la comptabilité de Garage Test/.test(un),
    'la raison et le geste : ' + un);
  const trois = dessiner([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]);
  assert.ok(/Tes 3 clients ne sont encore dans aucun/.test(trois) && /Choisir un client à tenir/.test(trois), 'plusieurs : ' + trois);
});
// Vu à la souris (10.14.1) : « Déclarer les régimes de mes clients » ouvrait l'onglet « Comptabilité »
// des Réglages pour un panneau rangé dans « Mon cabinet ». Les deux tables (où l'application range un
// panneau, ce que la visite ouvre) vivent dans deux fichiers : elles se confrontent, étape par étape.
t('10.14.1 Cabinet : une visite qui ouvre un onglet des Réglages vise un panneau rangé dans CET onglet', () => {
  const verif = require('../onglets-visites.js');
  const plein = { state: () => ({ cabinet: { name: 'X' }, dossiers: [{ id: 'A' }] }), dossier: () => 'A', estExemple: () => true,
    cleSecours: () => null, copieExterne: () => false, Visite: V };
  const r = verif({ visites: CV.parcours(plein), app, table: /'(pan-[a-z]+)': \{ onglet: '([a-z]+)'/g, appel: 'panneauReg', page: '#/reglages', barre: '#set-tabs' });
  assert.ok(r.panneaux >= 12 && r.identifiants >= 30, `les tables n'ont pas été lues : ${r.panneaux} panneaux, ${r.identifiants} identifiants`);
  assert.ok(r.controles >= 30, 'contrôles confrontés : ' + r.controles);
  assert.deepStrictEqual(r.fautes, []);
});

// Vu à la souris (10.14.1) : la visite des régimes se disait « Bravo » dès qu'on avait posé les lignes
// de base — sans les avoir enregistrées. Rien n'était gardé, et la visite affirmait le contraire.
t('10.14.1 Cabinet : la visite des régimes ne se dit réussie qu\'une fois les régimes ENREGISTRÉS', () => {
  let etat = { cabinet: { name: 'X' }, dossiers: [{ id: 'A' }], settings: { regimes: [] } };
  const ctx2 = { state: () => etat, dossier: () => 'A', estExemple: () => true, cleSecours: () => null, copieExterne: () => false, Visite: V };
  const v = CV.parcours(ctx2).find(x => x.id === 'regimes');
  assert.ok(v && typeof v.mesure === 'function' && typeof v.but === 'function', 'la visite n\'a plus de quoi dire si elle a réussi');
  const avant = v.mesure();
  assert.strictEqual(v.but(avant), false, 'rien enregistré : la visite se dit réussie');
  const save = v.etapes[v.etapes.length - 1];
  assert.ok(save.cible === '#sr-reg-save' && save.faire === 'clic' && typeof save.fait === 'function', 'la dernière étape n\'est plus l\'enregistrement');
  save.avant();
  assert.strictEqual(save.fait(), false, 'le clic sur « Enregistrer » passe pour fait avant que rien ne change');
  etat = { ...etat, settings: { regimes: [{ id: 'reel', label: 'Régime réel' }] } };
  assert.strictEqual(save.fait(), true, 'les régimes enregistrés ne font pas avancer la visite');
  assert.strictEqual(v.but(avant), true, 'des régimes enregistrés ne font pas une visite réussie');
});

// Vu à la souris (10.14.1) : un régime déclaré dans les Réglages (« Régime exonéré ») n'était proposé
// sur AUCUNE fiche de client : ses règles ne servaient jamais. Et l'en-tête écrivait « régime Régime réel ».
t('10.14.1 Cabinet : la fiche d\'un client propose les régimes du cabinet, et l\'en-tête les dit en français', () => {
  const st = { settings: { regimes: [{ id: 'reel', label: 'Réel (BIC)' }, { id: 'exonere', label: 'Régime exonéré' }] } };
  const ch = K.choixRegimes(st, '');
  assert.deepStrictEqual(ch.map(r => r.id), ['reel', 'forfaitaire', 'autre', 'exonere'], 'un régime déclaré n\'est pas proposé');
  assert.strictEqual(ch[0].label, 'Réel (BIC)', 'le nom que le cabinet a donné au régime de départ est ignoré');
  assert.strictEqual(ch[1].label, 'Régime forfaitaire');
  const retire = K.choixRegimes(st, 'bnc');
  assert.ok(retire.some(r => r.id === 'bnc' && /retiré des réglages/.test(r.label)), 'un régime retiré disparaît de la fiche qui le porte : la rouvrir changerait le régime du client');
  assert.strictEqual(K.choixRegimes({}, '').length, 3, 'sans réglage, les trois régimes de départ');
  assert.strictEqual(K.regimeEnPhrase('Régime réel'), 'régime réel');
  assert.strictEqual(K.regimeEnPhrase('Régime exonéré'), 'régime exonéré');
  assert.strictEqual(K.regimeEnPhrase('Autre / à préciser'), 'régime autre / à préciser');
  assert.strictEqual(K.regimeEnPhrase('BNC'), 'régime BNC', 'un sigle perd sa majuscule');
  assert.strictEqual(K.regimeEnPhrase(''), '');
  // L'écran : la fiche et son en-tête lisent la même liste, jamais les trois régimes de départ seuls.
  const code = app.replace(/\/\/[^\n]*/g, '');
  assert.ok(!/<select id="f-regime">[\s\S]{0,120}K\.REGIMES\b/.test(code) && !/labelOf\(K\.REGIMES\b/.test(code), 'la fiche ou l\'en-tête relit les trois régimes de départ');
  assert.ok(/<select id="f-regime">[\s\S]{0,120}K\.choixRegimes\(S, d\.regime\)/.test(code), 'la liste de la fiche ne lit plus les régimes du cabinet');
  assert.ok(/K\.regimeEnPhrase\(labelOf\(K\.choixRegimes\(S, dossier\.regime\), dossier\.regime\)\)/.test(code), 'l\'en-tête de la fiche ne dit plus le régime choisi');
});

// Vu à la souris (10.14.1) : « ✓ enregistré », posé AVANT le bouton dans un panneau des Réglages, le
// poussait de sa largeur au moment où il apparaît — « Enregistrer les régimes » glissait de 84 px sous
// le curseur (règle H-E1 : ce qui apparaît ne pousse rien).
t('10.14.1 Cabinet : « ✓ enregistré » passe APRÈS le bouton d\'un panneau, il ne le pousse pas', () => {
  const sans = f => lireSource(...f).replace(/\/\*[\s\S]*?\*\//g, '');
  const cab = sans(['src', 'cabinet', 'renderer', 'cabinet.css']);
  assert.ok(/(^|\n)\.panel \.modal-actions \{[^}]*display:\s*flex/.test(cab), 'la rangée d\'un panneau n\'est plus une rangée flex : `order` n\'y ferait rien');
  assert.ok(/(^|\n)\.panel \.modal-actions > \.saved \{[^}]*\border:\s*[1-9]/.test(cab), '« ✓ enregistré » repasse devant le bouton');
  // Et c'est bien DEVANT le bouton, dans le gabarit, qu'il est posé : sans cela la règle ne protège rien.
  const posees = [...app.matchAll(/<div class="modal-actions"><span class="saved"/g)].length;
  assert.ok(posees >= 5, 'marques « enregistré » lues : ' + posees);
});

// Vu à la souris (10.14.1) : l'onglet « Mon cabinet » des Réglages range ses cinq panneaux dans une
// <section> sans titre. La visite de la page la lisait d'un bloc — une seule étape « Ton cabinet » de
// treize boutons. Un conteneur sans titre à lui se traverse : ses panneaux sont les blocs.
// La règle des fins de l'application entreprise (visites.js), tenue ici aussi : « Ta relance est
// prête » d'un mail jamais ouvert, « Ton équipe peut travailler » d'une équipe jamais déclarée,
// « Ta grille est réglée » d'une grille jamais enregistrée (10.14.1). Une fin qui AFFIRME un fait le
// prouve par l'état ; une visite qui ne fait que montrer dit « Tu sais… ».
t('10.14.1 Cabinet : une fin qui affirme un fait le prouve par l\'état — sinon elle dit « Tu sais »', () => {
  const r = V.finsHonnetes(visites);
  assert.deepStrictEqual(r.sansPreuve, [], 'des visites affirment un fait sans le prouver');
  assert.deepStrictEqual(r.sansMesure, [], 'un but relatif sans sa mesure d\'entrée');
  assert.deepStrictEqual(r.coupees, [], 'un but atteint couperait les étapes qui le suivent — jugez-le à la fin (preuve)');
  assert.ok(r.affirmatives >= 10, 'la règle ne voit plus assez de visites : ' + r.affirmatives);  // mesuré : 11
  // Une fin ratée dit l'état et le geste qui le fait — jamais une cause qu'un geste passé démentirait
  // (« la fenêtre s'est fermée sans « Ajouter » », dit d'une fenêtre jamais ouverte — 10.14.1).
  assert.deepStrictEqual(r.causes, [], 'une fin ratée devine une cause qu\'un geste passé démentirait');
  // La pièce saisie se compte dans le livre OUVERT, à l'étape « Enregistrer » : à l'entrée de la visite,
  // le livre du dossier n'est peut-être pas encore lu, et le compte d'entrée serait faux.
  const saisir = parId('saisir-piece');
  const ok = saisir.etapes.find(e => e.cible === '#sa-ok');
  assert.ok(ok && typeof ok.avant === 'function' && typeof ok.fait === 'function', 'l\'enregistrement de la pièce ne se mesure plus à son étape');
  assert.ok(/ecritures: \(\) => \(\(livresState\.livre && livresState\.livre\.ecritures\) \|\| \[\]\)\.length/.test(app), 'le Cabinet ne prête plus le compte des écritures du livre ouvert');
});

t('10.14.1 : un conteneur sans titre (DIV, SECTION d\'onglet) se traverse, ses panneaux sont les étapes', () => {
  const vj = lireSource('src', 'renderer', 'visite.js').replace(/\/\/[^\n]*/g, '');
  const bloc = vj.slice(vj.indexOf('function blocsDe('), vj.indexOf('const titreDe'));
  assert.ok(bloc.length > 200 && bloc.length < 2000, 'tranche inattendue : ' + bloc.length);
  const m = /\(\/\^\(([A-Z|]+)\)\$\/\.test\(c\.tagName\) && !c\.querySelector\(':scope > h2, :scope > h3'\)\)+ \{ walk\(c, prof \+ 1\)/.exec(bloc);
  assert.ok(m, 'la traversée des conteneurs sans titre a disparu');
  assert.deepStrictEqual(m[1].split('|').sort(), ['DIV', 'SECTION'], 'une SECTION d\'onglet n\'est plus traversée : ' + m[1]);
});
};
