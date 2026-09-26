'use strict';
// ============================================================================================
// « Guide-moi » (10.14.1, S-03)
//
// Skander : « Au lieu de garder le bouton “Comprendre cette page”, remplace-le par un bouton
// “Guide-moi” avec une liste de toutes les actions qu'on peut faire sur cette page, afin que
// l'assistant du guide soit toujours disponible à portée de main. »
//
// Ce que ces tests tiennent sans Electron : le RANGEMENT (la visite de la page, ce qu'on peut faire
// ICI — l'onglet ouvert d'abord —, les autres onglets, toutes les visites), la REPRISE d'une visite
// en pause à son étape, le geste qui attend un préalable, le geste proposé seulement là où il se fera
// (la pièce ouverte, le dossier regardé), l'ARTICLE qui suit l'onglet ouvert, l'onglet qu'un geste
// ouvre (il existe dans sa barre), le bouton d'en-tête qui n'existe que sur un onglet, le placement
// du menu, et le branchement des deux applications. À la souris, dans les deux applications, le
// tour a été refait (CHANGELOG 10.14.1).
module.exports = ({ t, assert, lireSource }) => {
const V = require('../../src/renderer/visite.js');
const SV = require('../../src/renderer/visites.js');
const CV = require('../../src/cabinet/renderer/cabvisites.js');
const GE = require('../../src/renderer/guide.js');
const GC = require('../../src/cabinet/renderer/cabguide.js');
require('../../src/renderer/rowmenu.js');
const RowMenu = globalThis.RowMenu;

// Le code sans commentaires ni chaînes vides de sens : un commentaire qui cite une forme satisferait
// une assertion (6.8.0, 7.25.0).
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
const cab = sansCommentaires(lireSource('src', 'cabinet', 'renderer', 'app.js'));
const cleEnt = hash => String(hash || '').replace(/^#\/?/, '').split('/')[0] || 'dashboard';
const cleCab = hash => CV.cleDePage(hash);

// Un onglet tel que `onglet(barre, cle)` le construit dans les deux contenus.
const onglet = (barre, cle) => Object.assign(() => {}, { barre, cle });
// Un petit jeu de visites qui DISCRIMINE : une page, un geste sans onglet, deux gestes sur deux
// onglets, un geste d'une autre page, un geste qui ne se déclare que par `pages`, un geste qui ne
// convient pas, un geste dont la règle lève.
const jeu = () => [
  { id: 'p-x', type: 'page', route: 'x', titre: 'La page X', resume: 'Ce que montre X.', duree: '1 min' },
  { id: 'sans-onglet', type: 'faire', titre: 'Faire une chose', resume: 'Une chose.', etapes: [{ page: '#/x', cible: '#a' }] },
  { id: 'sur-t1', type: 'faire', titre: 'Geste du premier onglet', etapes: [{ page: '#/x', avant: onglet('#tabs', 't1'), cible: '#b' }] },
  { id: 'sur-t2', type: 'faire', titre: 'Geste du second onglet', etapes: [{ page: '#/x', avant: onglet('#tabs', 't2'), cible: '#c' }] },
  { id: 'autre-page', type: 'faire', titre: 'Ailleurs', etapes: [{ page: '#/y', cible: '#d' }] },
  { id: 'declare', type: 'faire', titre: 'Déclaré par pages', pages: ['x'], etapes: [{ page: '#/y', cible: '#e' }] },
  { id: 'ne-convient-pas', type: 'faire', titre: 'Pas ici', surLaPage: () => false, etapes: [{ page: '#/x/42', cible: '#f' }] },
  { id: 'regle-qui-leve', type: 'faire', titre: 'Règle cassée', surLaPage: () => { throw new Error('x'); }, etapes: [{ page: '#/x', cible: '#g' }] }
];
const ids = l => l.map(v => v.id);

t('S-03 : « Guide-moi » range les gestes de la page — l\'onglet ouvert d\'abord, les autres par onglet', () => {
  const vs = jeu();
  // Sans onglet lu à l'écran, tout ce qui se fait sur la page est « ici », dans l'ordre des visites.
  const sans = V.guideDeLaPage(vs, 'x', { cleDe: cleEnt });
  assert.strictEqual(sans.page && sans.page.id, 'p-x', 'la visite de LA page');
  assert.deepStrictEqual(ids(sans.ici), ['sans-onglet', 'sur-t1', 'sur-t2', 'declare', 'regle-qui-leve']);
  assert.deepStrictEqual(sans.ailleurs, []);
  // Sur l'onglet t1 : le geste de t2 passe dans « Sur l'onglet … », le reste reste ici.
  let lu = null;
  const g1 = V.guideDeLaPage(vs, 'x', { cleDe: cleEnt, ongletActif: b => { lu = b; return 't1'; } });
  assert.strictEqual(lu, '#tabs', 'l\'onglet se lit dans la barre que le geste désigne');
  assert.deepStrictEqual(ids(g1.ici), ['sans-onglet', 'sur-t1', 'declare', 'regle-qui-leve']);
  assert.strictEqual(g1.ailleurs.length, 1);
  assert.deepStrictEqual(g1.ailleurs[0].onglet, { barre: '#tabs', cle: 't2' });
  assert.deepStrictEqual(ids(g1.ailleurs[0].gestes), ['sur-t2']);
  // Sur t2, l'inverse.
  const g2 = V.guideDeLaPage(vs, 'x', { cleDe: cleEnt, ongletActif: () => 't2' });
  assert.deepStrictEqual(ids(g2.ici), ['sans-onglet', 'sur-t2', 'declare', 'regle-qui-leve']);
  assert.deepStrictEqual(ids(g2.ailleurs[0].gestes), ['sur-t1']);
  // Une page sans visite ni geste : rien, pas d'erreur.
  const vide = V.guideDeLaPage(vs, 'z', { cleDe: cleEnt });
  assert.deepStrictEqual([vide.page, vide.ici, vide.ailleurs], [null, [], []]);
});

t('S-03 : un geste ne se propose que là où il se fera — une règle qui lève ne cache rien', () => {
  const g = V.guideDeLaPage(jeu(), 'x', { cleDe: cleEnt });
  assert.ok(!ids(g.ici).includes('ne-convient-pas'), 'un geste qui ne convient pas à la page est proposé');
  assert.ok(ids(g.ici).includes('regle-qui-leve'), 'une règle qui lève a caché un geste : mieux vaut en trop qu\'un geste perdu');
  // La règle reçoit la clé de la page.
  let recu = null;
  V.guideDeLaPage([{ id: 'r', type: 'faire', surLaPage: cle => { recu = cle; return true; }, etapes: [{ page: '#/x' }] }], 'x', { cleDe: cleEnt });
  assert.strictEqual(recu, 'x');
  // L'hôte peut prêter sa propre règle.
  const g2 = V.guideDeLaPage(jeu(), 'x', { cleDe: cleEnt, convient: v => v.id !== 'declare' });
  assert.ok(!ids(g2.ici).includes('declare'));
});

t('S-03 : « dansLeGuide » reconnaît une visite par identifiant (la page, ici, un autre onglet)', () => {
  const g = V.guideDeLaPage(jeu(), 'x', { cleDe: cleEnt, ongletActif: () => 't1' });
  ['p-x', 'sans-onglet', 'sur-t2'].forEach(id => assert.ok(V.dansLeGuide(g, id), id + ' devrait être dans le guide'));
  // La visite en cours est une COPIE de sa définition : c'est l'identifiant qui compte.
  assert.ok(V.dansLeGuide(g, { ...jeu()[1] }.id));
  ['autre-page', 'ne-convient-pas', '', null].forEach(id => assert.ok(!V.dansLeGuide(g, id), id + ' ne devrait pas y être'));
  assert.ok(!V.dansLeGuide(null, 'p-x'));
});

t('S-03 : le menu parle de LA page d\'abord (visite et article), puis de ce qu\'on fait ici, des autres onglets, et de toutes les visites', () => {
  const vs = jeu();
  const g = V.guideDeLaPage(vs, 'x', { cleDe: cleEnt, ongletActif: () => 't1' });
  let article = 0, tout = 0;
  const lances = [];
  const menu = V.menuDuGuide(g, {
    titrePage: 'La page X', lancer: (v, i) => lances.push([v.id, i]),
    libelleOnglet: og => 'Onglet ' + og.cle.toUpperCase(),
    article: { titre: 'Tout sur X', ouvrir: () => { article++; } }, tout: () => { tout++; }
  });
  const titres = menu.filter(a => a.titre).map(a => a.titre);
  assert.deepStrictEqual(titres, ['La page X', 'Ce que tu peux faire ici', 'Sur l\'onglet « Onglet T2 »']);
  // L'ordre exact : la page (titre, visite, article) AVANT les gestes — l'article en bas d'une longue
  // liste se perdait hors de l'écran (vu à la souris sur l'accueil).
  const lib = menu.map(a => a.titre ? '#' + a.titre : a.sep ? '—' : a.label);
  assert.deepStrictEqual(lib.slice(0, 4), ['#La page X', 'Visite de la page', 'Lire l\'article « Tout sur X »', '#Ce que tu peux faire ici']);
  assert.deepStrictEqual(lib.slice(-2), ['—', 'Toutes les visites guidées']);
  // La visite de la page dit ce qu'elle montre et combien de temps.
  const vp = menu.find(a => a.label === 'Visite de la page');
  assert.ok(/Ce que montre X\./.test(vp.hint) && /1 min/.test(vp.hint), vp.hint);
  vp.run(); menu.find(a => a.label === 'Faire une chose').run();
  menu.find(a => /^Lire l'article/.test(a.label || '')).run(); menu[menu.length - 1].run();
  assert.deepStrictEqual(lances, [['p-x', undefined], ['sans-onglet', undefined]]);
  assert.deepStrictEqual([article, tout], [1, 1]);
  // Sans visite de page NI article, pas de section « Cette page » vide ; sans « tout », pas de trait.
  const nu = V.menuDuGuide({ page: null, ici: [vs[1]], ailleurs: [] }, { lancer: () => {} });
  assert.deepStrictEqual(nu.map(a => a.titre || a.label), ['Ce que tu peux faire ici', 'Faire une chose']);
  // Une visite déjà faite se dit « Revoir » et porte sa coche.
  const fait = V.menuDuGuide(g, { lancer: () => {}, fait: v => v.id === 'p-x' || v.id === 'sans-onglet' });
  assert.ok(fait.some(a => a.label === 'Revoir la visite de la page' && a.fait));
  assert.ok(fait.some(a => a.label === 'Faire une chose' && a.fait));
});

t('S-03 : une visite en pause se REPREND depuis « Guide-moi » — à son étape, et l\'entrée le dit', () => {
  const vs = jeu();
  const g = V.guideDeLaPage(vs, 'x', { cleDe: cleEnt });
  const lances = [];
  const reprise = { 'sans-onglet': { i: 2, texte: 'Étape 3 sur 5', note: '' }, 'p-x': { i: 1, texte: 'Étape 2', note: 'tu étais à l\'étape 4 : on repart de l\'écran où ce geste commence' } };
  const menu = V.menuDuGuide(g, { lancer: (v, i) => lances.push([v.id, i]), reprise: v => reprise[v.id] || null, fait: () => true });
  const geste = menu.find(a => /Faire une chose/i.test(a.label || ''));
  assert.strictEqual(geste.label, 'Reprendre : faire une chose', 'le libellé dit « Reprendre »');
  assert.strictEqual(geste.note, 'en pause');
  assert.ok(/^Arrêtée à l'étape 3 sur 5\.$/.test(geste.hint), geste.hint);
  assert.ok(!geste.fait, 'une visite en pause n\'est pas « faite » à l\'écran');
  const page = menu.find(a => /visite de la page/.test(a.label || ''));
  assert.strictEqual(page.label, 'Reprendre la visite de la page');
  // Retournée (10.14.1) : « Arrêtée à l'étape 2 — tu étais à l'étape 4 » se contredisait.
  assert.ok(/^Reprise à l'étape 2 — tu étais à l'étape 4/.test(page.hint), page.hint);
  geste.run(); page.run();
  assert.deepStrictEqual(lances, [['sans-onglet', 2], ['p-x', 1]], 'la reprise relance à son étape, pas au début');
  // Une reprise qui lève ne casse pas le menu.
  const m2 = V.menuDuGuide(g, { lancer: () => {}, reprise: () => { throw new Error('x'); } });
  assert.ok(m2.some(a => a.label === 'Faire une chose'));
});

t('S-03 : un geste qui attend un préalable s\'éteint et dit ce qui lui manque', () => {
  const g = V.guideDeLaPage(jeu(), 'x', { cleDe: cleEnt });
  const menu = V.menuDuGuide(g, { lancer: () => {}, manque: v => v.id === 'sur-t1' ? { texte: 'Il faut d\'abord une facture émise.' } : null,
    reprise: () => ({ i: 1, texte: 'Étape 2' }), fait: () => true });
  const e = menu.find(a => a.label === 'Geste du premier onglet');
  assert.ok(e && e.off, 'le geste doit être éteint (et pas « Reprendre » : il ne peut pas se lancer)');
  assert.strictEqual(e.hint, 'Pas encore : il faut d\'abord une facture émise.');
  assert.ok(!e.fait);
});

t('S-03 : sur une pièce ouverte, « Guide-moi » ne propose que ce qui s\'y fait (app entreprise)', () => {
  const avant = globalThis.location;
  try {
    // La facture f1 est un brouillon : seul « Émettre » la concerne parmi les gestes de la fiche.
    globalThis.location = { hash: '#/doc/f1' };
    const ctx = { data: () => ({ clients: [], documents: [], catalog: [] }), estDemo: () => false, editeur: () => false, Visite: V, G: { INFO: {} },
      // Chaque sorte désigne une pièce de SA page : un achat vit sous #/achat/, une vente sous #/doc/.
      premier: sorte => (sorte === 'factureBrouillon' ? '#/doc/f1' : /achat/i.test(sorte) ? '#/achat/autre' : '#/doc/autre') };
    const vs = SV.parcours(ctx);
    const ici = ids(V.guideDeLaPage(vs, 'doc', { cleDe: cleEnt }).ici);
    const surDoc = vs.filter(v => v.type === 'faire' && V.pagesDuGeste(v, cleEnt).includes('doc')).map(v => v.id);
    assert.ok(surDoc.length >= 4, 'le jeu doit discriminer : plusieurs gestes vivent sur une pièce — ' + surDoc.join(', '));
    const emettre = vs.find(v => v.type === 'faire' && v.surLaPage && ici.includes(v.id));
    assert.ok(emettre, 'le geste qui s\'applique à ce brouillon n\'est pas proposé : ' + ici.join(', '));
    const autres = surDoc.filter(id => id !== emettre.id && ici.includes(id) && vs.find(v => v.id === id).surLaPage);
    assert.deepStrictEqual(autres, [], 'des gestes qui ne s\'appliquent pas à cette pièce sont proposés');
    // Sur la LISTE des factures, ils sont tous là : on choisira la pièce en route.
    const liste = ids(V.guideDeLaPage(vs, 'factures', { cleDe: cleEnt }).ici);
    assert.ok(surDoc.filter(id => V.pagesDuGeste(vs.find(v => v.id === id), cleEnt).includes('factures')).every(id => liste.includes(id)));
  } finally { if (avant === undefined) delete globalThis.location; else globalThis.location = avant; }
});

t('S-03 : sur l\'écran d\'un dossier, « Guide-moi » ne propose que les gestes qui s\'y feront (Cabinet)', () => {
  const avant = globalThis.location;
  try {
    let choisi = 'D1';
    const ctx = { state: () => ({ cabinet: {}, dossiers: [{ id: 'D1' }, { id: 'D2' }] }), dossier: () => choisi, estExemple: () => false,
      cleSecours: () => null, copieExterne: () => false, Visite: V };
    const vs = CV.parcours(ctx);
    globalThis.location = { hash: '#/dossier/D1/comptabilite/saisie' };
    const ici1 = ids(V.guideDeLaPage(vs, 'compta-saisie', { cleDe: cleCab }).ici);
    assert.ok(ici1.length >= 2, 'le dossier regardé doit recevoir ses gestes : ' + ici1.join(', '));
    // Le geste partirait dans un AUTRE dossier (celui que la visite choisirait) : il ne se propose pas.
    choisi = 'D2';
    const ici2 = ids(V.guideDeLaPage(vs, 'compta-saisie', { cleDe: cleCab }).ici);
    assert.deepStrictEqual(ici2.filter(id => ici1.includes(id)), [], 'un geste qui partirait dans le dossier d\'à côté est proposé');
    // Hors d'un écran de dossier, la règle ne cache rien.
    globalThis.location = { hash: '#/dossiers' };
    assert.ok(V.guideDeLaPage(vs, 'dossiers', { cleDe: cleCab }).ici.length >= 1);
  } finally { if (avant === undefined) delete globalThis.location; else globalThis.location = avant; }
});

// Les onglets d'une barre, lus dans la source de l'application : l'identifiant de la barre, puis la
// table qu'elle parcourt (`${PAIE_TABS.map(`), résolue jusqu'à son tableau.
function ongletsDe(src, barre) {
  const i = src.indexOf(`id="${barre.replace(/^#/, '')}"`);
  if (i < 0) return null;
  const m = /\$\{([A-Z_]+)\.(?:map|filter)\(/.exec(src.slice(i, i + 400));
  if (!m) return null;
  let nom = m[1];
  if (nom === 'TABS') { const av = src.slice(0, i); const k = av.lastIndexOf('const TABS = '); const r = /const TABS = ([A-Z_]+);/.exec(av.slice(k)); nom = r && r[1]; }
  const d = src.indexOf(`const ${nom} = [`);
  if (d < 0) return null;
  return [...src.slice(d, src.indexOf('];', d)).matchAll(/\['([a-z0-9-]+)',/g)].map(x => x[1]);
}

t('S-03 : chaque onglet qu\'un geste ouvre existe dans sa barre (les deux applications)', () => {
  const brut = { ent: lireSource('src', 'renderer', 'app.js'), cab: lireSource('src', 'cabinet', 'renderer', 'app.js') };
  const ctxE = { data: () => ({ clients: [], documents: [], catalog: [] }), premier: () => null, estDemo: () => false, editeur: () => false, Visite: V, G: { INFO: {} } };
  const ctxC = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D1', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V };
  const fautes = [];
  let vus = 0;
  [[SV.parcours(ctxE), brut.ent, 'SkanFact'], [CV.parcours(ctxC), brut.cab, 'Cabinet']].forEach(([vs, src, nom]) => {
    vs.forEach(v => (v.etapes || []).forEach(e => {
      if (!e) return;
      [e.avant, e.retablir].filter(f => f && f.barre && f.cle).forEach(f => {
        // Le Cabinet dessine ses onglets de comptabilité par groupes : ils se lisent dans ses ÉCRANS.
        const connus = src === brut.cab && f.barre === '#c-tabs' ? (CV.ECRANS || []).slice() : ongletsDe(src, f.barre);
        vus++;
        if (!connus) fautes.push(`${nom} · ${v.id} : la barre ${f.barre} est introuvable`);
        else if (!connus.includes(f.cle)) fautes.push(`${nom} · ${v.id} : l'onglet « ${f.cle} » n'existe pas dans ${f.barre} (${connus.join(', ')})`);
      });
    }));
  });
  assert.ok(vus >= 30, 'lecture suspecte : ' + vus + ' onglets ouverts par les visites');
  assert.deepStrictEqual(fautes, []);
});

t('S-03 : un geste qui clique un bouton d\'en-tête propre à un onglet ouvre d\'abord cet onglet', () => {
  // « Déclarer un salarié » était proposé sur l'onglet Congés, où « + Salarié » n'existe pas : la bulle
  // attendait un bouton absent (vu à la souris). Les boutons d'en-tête qui changent avec l'onglet sont
  // lus dans l'application (P_ACTION, ST_ACTION) — une table recopiée ici se périmerait.
  const brut = lireSource('src', 'renderer', 'app.js');
  const table = nom => {
    const i = brut.indexOf(`const ${nom} = {`);
    assert.ok(i > 0, nom + ' introuvable');
    const corps = brut.slice(i, brut.indexOf('};', i));
    const par = {};
    [...corps.matchAll(/([a-z]+): \['([a-z-]+)'/g)].forEach(([, onglet, id]) => { (par[id] = par[id] || []).push(onglet); });
    return par;
  };
  const boutons = [['#p-tabs', 'paie', table('P_ACTION')], ['#st-tabs', 'stock', table('ST_ACTION')]];
  assert.ok(Object.keys(boutons[0][2]).includes('new-emp') && Object.keys(boutons[1][2]).includes('st-adj'), 'tables mal lues');
  const vs = SV.parcours({ data: () => ({ clients: [], documents: [], catalog: [] }), premier: () => null, estDemo: () => false, editeur: () => false, Visite: V, G: { INFO: {} } });
  const fautes = [];
  let vus = 0;
  vs.forEach(v => {
    let ouvert = null;
    (v.etapes || []).forEach(e => {
      if (!e) return;
      const p = typeof e.page === 'string' ? cleEnt(e.page) : null;
      if (p) ouvert = null;
      const prep = [e.avant, e.retablir].find(f => f && f.barre && f.cle);
      if (prep) ouvert = prep;
      const cibles = [].concat(e.cible || []).filter(c => typeof c === 'string');
      boutons.forEach(([barre, page, par]) => Object.entries(par).forEach(([id, onglets]) => {
        if (!cibles.some(c => c.split(',').map(s => s.trim()).includes('#' + id))) return;
        vus++;
        if (!ouvert || ouvert.barre !== barre || !onglets.includes(ouvert.cle))
          fautes.push(`${v.id} vise #${id} (${page}) sans ouvrir l'onglet ${onglets.join(' ou ')}`);
      }));
    });
  });
  assert.ok(vus >= 1, 'aucune étape ne vise un bouton d\'en-tête d\'onglet : le test ne prouve rien');
  assert.deepStrictEqual(fautes, []);
});

t('S-03 : l\'article de « Guide-moi » suit l\'onglet ouvert, et retombe sur celui de la page (les deux applications)', () => {
  [[GE, lireSource('src', 'renderer', 'app.js'), 'SkanFact'], [GC, lireSource('src', 'cabinet', 'renderer', 'app.js'), 'Cabinet']].forEach(([G, src, nom]) => {
    const arts = new Set(G.ARTICLES.map(a => a.id));
    assert.ok(Object.keys(G.PAR_ONGLET).length >= 1, nom + ' : aucune page à onglets');
    Object.entries(G.PAR_ONGLET).forEach(([page, o]) => {
      const connus = ongletsDe(src, o.barre);
      assert.ok(connus, `${nom} · ${page} : la barre ${o.barre} est introuvable`);
      Object.entries(o.articles).forEach(([ong, art]) => {
        assert.ok(connus.includes(ong), `${nom} · ${page} : l'onglet « ${ong} » n'existe pas (${connus.join(', ')})`);
        assert.ok(arts.has(art), `${nom} · ${page}/${ong} : l'article « ${art} » n'existe pas`);
        let lu = null;
        assert.strictEqual(G.articleDeLaPage(page, b => { lu = b; return ong; }), art);
        assert.strictEqual(lu, o.barre, 'l\'onglet se lit dans SA barre');
      });
      // Un onglet absent de la table, une barre illisible, une lecture qui lève : l'article de la page.
      assert.strictEqual(G.articleDeLaPage(page, () => 'onglet-inconnu'), G.PAR_PAGE[page] || null);
      assert.strictEqual(G.articleDeLaPage(page, () => null), G.PAR_PAGE[page] || null);
      assert.strictEqual(G.articleDeLaPage(page, () => { throw new Error('x'); }), G.PAR_PAGE[page] || null);
    });
    Object.values(G.PAR_PAGE).forEach(art => assert.ok(arts.has(art), `${nom} : PAR_PAGE cite l'article « ${art} », qui n'existe pas`));
  });
  // Les Paramètres ne proposent plus « Tes données » sur l'onglet « Mon entreprise » (vu à la souris).
  assert.notStrictEqual(GE.articleDeLaPage('parametres', () => 'societe'), GE.PAR_PAGE.parametres);
});

t('S-03 : chaque écran du Cabinet qui a sa visite a son article (hors l\'Aide et « Me guider »)', () => {
  const vs = CV.parcours({ state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => null, estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V });
  const routes = vs.filter(v => v.type === 'page').map(v => v.route);
  assert.ok(routes.length >= 20, 'lecture suspecte : ' + routes.length + ' écrans');
  assert.deepStrictEqual(routes.filter(r => r !== 'aide' && r !== 'guide' && !GC.PAR_PAGE[r]), [], 'des écrans sans article');
  assert.deepStrictEqual(Object.keys(GC.PAR_PAGE).filter(k => !routes.includes(k)), [], 'PAR_PAGE cite un écran qui n\'existe pas');
});

t('S-03 : les deux applications ouvrent le menu par le MÊME moteur, reprise et onglet compris', () => {
  [[app, 'SkanFact'], [cab, 'Cabinet']].forEach(([src, nom]) => {
    const i = src.indexOf('function ouvrirGuideMoi(');
    const z = src.slice(i, src.indexOf('\n  }\n', i));
    assert.ok(i > 0 && z.length < 4500, nom + ' : ouvrirGuideMoi introuvable ou tranche trop large');
    assert.ok(/Visite\.guideDeLaPage\([^;]*\{[^;}]*ongletActif[^;}]*\}\);/.test(z), nom + ' : le rangement ne lit pas l\'onglet ouvert');
    assert.ok(/articleDeLaPage\([a-z]+, ongletActif\)/.test(z), nom + ' : l\'article ne suit pas l\'onglet ouvert');
    assert.ok(/Visite\.menuDuGuide\(g,/.test(z), nom + ' : le menu n\'est pas celui du moteur');
    assert.ok(/lancer: \(v, i\) => lancerVisite\(v, i\)/.test(z), nom + ' : le menu ne relance pas à l\'étape de la reprise');
    assert.ok(/reprise: v => \(et\.reprise && et\.reprise\.id === v\.id \? Visite\.pointDeReprise\(v, et\.reprise\) : null\)/.test(z),
      nom + ' : la reprise ne passe pas par Visite.pointDeReprise (le même calcul que « Me guider »)');
    assert.ok(/RowMenu\.ouvrir\(bouton, actions, \{ classe: 'guide-menu'/.test(z), nom + ' : le menu n\'est pas le menu partagé');
    // Et la reprise arrive jusqu'au moteur : `lancerVisite(p, depart)` passe l'étape à `Visite.lancer`.
    const l = src.indexOf('async function lancerVisite(p, depart)');
    assert.ok(l > 0 && /Visite\.lancer\(p, depart \|\| 0\)/.test(src.slice(l, src.indexOf('\n  }\n', l))), nom + ' : lancerVisite perd l\'étape de reprise');
  });
});

t('S-03 : la pause dit « Guide-moi » seulement quand « Guide-moi » propose la visite (les deux applications)', () => {
  [[app, 'SkanFact'], [cab, 'Cabinet']].forEach(([src, nom]) => {
    const i = src.indexOf('interrompu: (p, i, compte) => {');
    assert.ok(i > 0, nom + ' : le rappel de pause est introuvable');
    const z = src.slice(i, src.indexOf('\n    }', i + 10) > 0 ? src.indexOf('\n    }', i + 10) + 6 : i + 1200);
    assert.ok(/Visite\.guideDeLaPage\(/.test(z), nom + ' : la pause ne calcule pas ce que propose « Guide-moi »');
    // Le message qui nomme « Guide-moi » est la branche VRAIE d'un test qui porte `dansLeGuide`.
    const m = /toast\(([^?]+)\?\s*'([^']*)'\s*:\s*'([^']*)'\)/.exec(z);
    assert.ok(m, nom + ' : la pause n\'a plus deux phrases');
    assert.ok(/\$\('#guide-moi'\) && Visite\.dansLeGuide\(g, p\.id\)/.test(m[1]), nom + ' : la condition ne vérifie pas que « Guide-moi » propose la visite');
    assert.ok(/Guide-moi/.test(m[2]) && /Me guider/.test(m[2]), nom + ' : la branche vraie doit nommer les deux chemins');
    assert.ok(!/Guide-moi/.test(m[3]) && /Me guider/.test(m[3]), nom + ' : la branche fausse ne doit nommer que « Me guider »');
  });
});

t('S-03 : « Guide-moi » se pose dans l\'en-tête de chaque écran, et un observateur l\'y remet (les deux applications)', () => {
  [[app, 'SkanFact'], [cab, 'Cabinet']].forEach(([src, nom]) => {
    const p = src.indexOf('function poserGuideMoi()');
    const z = src.slice(p, src.indexOf('\n  }\n', p));
    assert.ok(/querySelector\('\.page-head'\)/.test(z) && /head\.querySelector\('\.guide-moi'\)/.test(z), nom + ' : pas dans l\'en-tête, ou posé deux fois');
    assert.ok(/actions\.insertBefore\(b, actions\.firstChild\)/.test(z), nom + ' : pas à la même place (en tête des actions)');
    assert.ok(/=== 'guide'\) return/.test(z) || /'guide' \|\|/.test(z) || /route === 'guide'/.test(z), nom + ' : « Guide-moi » se pose sur « Me guider » elle-même');
    assert.ok(/new MutationObserver\(\(\) => poserGuideMoi\(\)\)/.test(src), nom + ' : aucun observateur ne le repose');
    const r = src.indexOf('function render(');
    assert.ok(/surveillerGuideMoi\(\);/.test(src.slice(r, r + 1500)), nom + ' : render() ne branche pas l\'observateur');
  });
});

t('S-03 : l\'invitation « Première fois ? » flotte au-dessus de la page, accrochée à « Guide-moi » (elle ne pousse plus rien)', () => {
  const css = lireSource('src', 'renderer', 'style.css');
  const regle = /\.guide-appel \{([^}]*)\}/.exec(css);
  assert.ok(regle && /position: fixed/.test(regle[1]), 'l\'invitation n\'est plus en position fixe : elle pousserait l\'écran de travail');
  const z = Number((/z-index: (\d+)/.exec(regle[1]) || [])[1]);
  assert.ok(z > 0 && z < 60, 'l\'invitation doit rester sous la palette (60), les menus (70) et les fenêtres (400) : ' + z);
  [[app, 'SkanFact'], [cab, 'Cabinet']].forEach(([src, nom]) => {
    const i = src.indexOf('function appelGuide(');
    const f = src.slice(i, src.indexOf('\n  }\n', i));
    assert.ok(/document\.body\.appendChild\(el\)/.test(f), nom + ' : l\'invitation n\'est pas posée par-dessus la page');
    assert.ok(/const bouton = \$\('#guide-moi'\)/.test(f) && /appelEnAttente = /.test(f), nom + ' : l\'invitation ne s\'accroche pas à « Guide-moi » (ou n\'attend pas un en-tête asynchrone)');
    assert.ok(/Tu la retrouves dans « Guide-moi »/.test(lireSource(...(nom === 'Cabinet' ? ['src', 'cabinet', 'renderer', 'app.js'] : ['src', 'renderer', 'app.js']))), nom + ' : l\'invitation ne dit plus où se retrouve la visite');
  });
});

t('S-03 : un menu s\'ouvre VERS la page, sous son bouton quand il y tient, et jamais hors de l\'écran', () => {
  const ecran = [1440, 900];
  const menu = [360, 300];
  const pos = (l, t2, w, h) => RowMenu.placerMenu({ left: l, right: l + w, top: t2, bottom: t2 + h, width: w }, menu[1], menu[0], ...ecran);
  // Un bouton de la moitié GAUCHE (« Guide-moi » d'une fiche du Cabinet, juste après la barre
  // latérale) : le menu part vers la droite, calé sur son bord gauche — il ne couvre pas la barre.
  assert.deepStrictEqual(pos(260, 40, 120, 30), { top: 76, left: 260 });
  // Un bouton de la moitié droite (le bout d'une ligne) : calé sur le bord droit du bouton.
  assert.deepStrictEqual(pos(1200, 40, 120, 30), { top: 76, left: 960 });
  // Trop bas pour tenir dessous : au-dessus.
  assert.deepStrictEqual(pos(600, 800, 100, 30), { top: 494, left: 600 });
  // Jamais à moins de 8 px d'un bord, même collé au coin.
  const coin = pos(0, 0, 20, 20);
  assert.ok(coin.left >= 8 && coin.top >= 8, JSON.stringify(coin));
  const droite = pos(1430, 40, 10, 30);
  assert.ok(droite.left + menu[0] <= ecran[0] - 8, JSON.stringify(droite));
  // Et `ouvrir` s'en sert : une seule règle de placement.
  const rm = lireSource('src', 'renderer', 'rowmenu.js');
  assert.ok(/const pos = placerMenu\(bouton\.getBoundingClientRect\(\), m\.offsetHeight, m\.offsetWidth, window\.innerWidth, window\.innerHeight\);/.test(rm),
    'ouvrir() ne passe pas par placerMenu');
});

// ---------- ce qui passe devant l'écran de travail (10.14.1, e2e:cabinet-jour1) ----------
//
// Sur un portable (1280×800), la grille de saisie du Cabinet commençait à 573 px — seuil 480 — : le
// bandeau de l'exemple répétait sa phrase sur trois lignes en tête de CHAQUE écran, et l'en-tête de la
// fiche faisait passer ses gestes sur une seconde rangée. L'instrument mesure l'effet ; ces tests
// tiennent la règle, fonction jouée.
const fonctionBrute = (src, sig) => {
  const i = src.indexOf(sig);
  assert.ok(i > 0, 'introuvable : ' + sig);
  return src.slice(i, src.indexOf('\n  }\n', i) + 4);
};

t('10.14.1 : le bandeau de l\'exemple s\'EXPLIQUE sur la page d\'accueil et se RAPPELLE ailleurs, sur une ligne — dans les deux applications', () => {
  const vm = require('vm');
  // Le Cabinet : la page se lit dans l'adresse.
  const cabSrc = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const fCab = fonctionBrute(cabSrc, 'function htmlBandeauDemo() {');
  assert.ok(fCab.length > 600 && fCab.length < 5000, 'tranche du bandeau du Cabinet inattendue : ' + fCab.length);
  const cabinet = hash => vm.runInNewContext(fCab + '\nhtmlBandeauDemo();', {
    S: { dossiers: [{ demo: true }, { demo: true }, { id: 'vrai' }] }, exempleRefait: null,
    pl: (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s), esc: x => String(x),
    Visite: { enCours: () => false }, decouverteEnPause: () => null, location: { hash }
  });
  for (const hash of ['#/dossiers', '', '#/']) {
    const html = cabinet(hash);
    assert.ok(/class="banner demo-banner"/.test(html) && /Tu explores un cabinet d'exemple/.test(html), 'la page Dossiers (' + JSON.stringify(hash) + ') ne s\'explique plus');
  }
  for (const hash of ['#/dossier/MF:1/comptabilite/saisie', '#/relances', '#/reglages', '#/guide']) {
    const html = cabinet(hash);
    assert.ok(/class="banner demo-banner court"/.test(html), hash + ' : le bandeau se répète en entier');
    assert.ok(/<b>Cabinet d'exemple<\/b>/.test(html) && /tes vrais dossiers sont à l'abri/.test(html), hash + ' : le rappel ne dit plus ce qu\'il est');
    assert.ok(!/Tu explores un cabinet d'exemple —/.test(html.replace(/title="[^"]*"/, '')), hash + ' : la phrase entière est encore posée');
    assert.ok(/title="Tu explores un cabinet d'exemple/.test(html), hash + ' : la phrase entière n\'est plus au survol');
    // Les deux portes restent dans le rappel : se faire guider, et sortir.
    assert.ok(/id="demo-visite"/.test(html) && /id="demo-off"/.test(html), hash + ' : le rappel a perdu une de ses portes');
  }
  // L'app entreprise : la page arrive en argument, depuis render().
  const entSrc = lireSource('src', 'renderer', 'app.js');
  const fEnt = fonctionBrute(entSrc, 'function htmlBandeauDemo(route) {');
  assert.ok(fEnt.length > 600 && fEnt.length < 5000, 'tranche du bandeau de l\'entreprise inattendue : ' + fEnt.length);
  const entreprise = route => vm.runInNewContext(fEnt + '\nhtmlBandeauDemo(' + JSON.stringify(route) + ');', {
    exempleRefait: null, h: x => String(x), Visite: { enCours: () => false }, decouverteEnPause: () => null
  });
  const acc = entreprise('dashboard');
  assert.strictEqual(acc.court, false, 'l\'accueil ne s\'explique plus');
  assert.ok(/Tu explores une entreprise d'exemple/.test(acc.html));
  for (const route of ['factures', 'doc', 'paie', 'guide']) {
    const r = entreprise(route);
    assert.strictEqual(r.court, true, route + ' : le bandeau se répète en entier');
    assert.ok(/<b>Entreprise d'exemple<\/b>/.test(r.html) && /tes vraies données sont à l'abri/.test(r.html), route + ' : le rappel ne dit plus ce qu\'il est');
    assert.ok(/id="demo-visite"/.test(r.html) && /id="demo-out"/.test(r.html), route + ' : le rappel a perdu une de ses portes');
  }
  assert.ok(/el\.className = 'banner demo-banner' \+ \(court \? ' court' : ''\)/.test(entSrc), 'l\'entreprise ne pose pas la classe du rappel');
  assert.ok(/bandeauDemo\(name\);/.test(entSrc), 'render() ne donne pas la page au bandeau');
  // La feuille partagée : trois classes (`.banner.demo-banner` en a deux, 7.23.0), un rappel serré.
  const css = lireSource('src', 'renderer', 'style.css');
  assert.ok(/^\.banner\.demo-banner\.court \{[^}]*padding-block: 6px/m.test(css), 'le rappel n\'est pas serré dans la feuille partagée');
});

t('10.14.1 : l\'en-tête d\'une fiche du Cabinet — le nom et ses gestes sur UNE rangée, l\'identité et l\'état sur une ligne dessous', () => {
  const cabSrc = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = cabSrc.indexOf('<div class="page-head fiche-dossier">');
  assert.ok(i > 0, 'la fiche n\'a plus son en-tête nommé');
  const tete = cabSrc.slice(i, cabSrc.indexOf('<div class="print-only print-head">', i));
  assert.ok(tete.length > 300 && tete.length < 3500, 'tranche de l\'en-tête inattendue : ' + tete.length);
  const iTitre = tete.indexOf('<div class="fiche-titre">'), iActions = tete.indexOf('<div class="actions">'), iMeta = tete.indexOf('<div class="d-meta">');
  assert.ok(iTitre > 0 && iActions > iTitre && iMeta > iActions, 'l\'ordre titre → gestes → identité est perdu');
  // Le titre et les gestes sont des ENFANTS directs de l'en-tête : enfermés dans un bloc, la ligne
  // d'état élargit le titre et les gestes passent dessous.
  assert.ok(!/<div class="page-head fiche-dossier"><div>/.test(tete), 'le titre est encore enfermé avec l\'identité');
  assert.ok(/<div class="d-meta"><div class="d-ident">\$\{ident\}<\/div><div class="d-etat" id="d-etat">\$\{etat\}<\/div><\/div><\/div>/.test(tete),
    'l\'identité et l\'état ne partagent plus leur ligne');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/^\.fiche-dossier > \.fiche-titre \{[^}]*flex: 1 1 0;[^}]*min-width: 0/m.test(css), 'le titre ne part plus d\'une largeur nulle : les gestes passeraient dessous');
  assert.ok(/^\.fiche-dossier > \.d-meta \{[^}]*flex: 1 0 100%/m.test(css), 'l\'identité ne prend plus sa ligne entière');
});

t('10.14.1 : « Voir dans le paquet », seule sur sa ligne, porte son mot court — sinon elle recouvre le Crédit à 1280 px', () => {
  const cabSrc = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const actions = [...cabSrc.matchAll(/\{ icon: 'loupe', label: 'Voir dans le paquet'[^}]*\}/g)].map(m => m[0]);
  assert.ok(actions.length >= 2, 'les actions « Voir dans le paquet » sont introuvables : ' + actions.length);
  actions.forEach(a => assert.ok(/court: '[^']{3,12}'/.test(a), 'sans mot court : ' + a.slice(0, 90)));
});

};
