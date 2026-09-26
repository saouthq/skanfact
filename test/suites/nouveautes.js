'use strict';
// ============================================================================================
// S-06 (10.14.1) — le chargement visible, la page qui se voit changer, et les nouveautés d'une
// version dites au premier lancement.
//
// Skander : « mesuré 15,5 s pour dix ans — mettre un loading et pas laisser une page blanche » ;
// « on ne voit pas forcément la transition, alors on s'y perd » ; « à chaque nouvelle version, quand
// on relance l'application, un toast qui présente la nouvelle version avec ses modifications,
// compréhensibles par tous ». À la souris, dans les deux applications : le voile « Chargement… » vu
// pendant un calcul rendu lent, l'entrée d'une page vue en cours d'animation, la carte des nouveautés
// vue au lancement d'une version et plus jamais ensuite (CHANGELOG 10.14.1).
module.exports = ({ t, assert, lireSource }) => {
const N = require('../../src/renderer/nouveautes.js');
const pkg = JSON.parse(lireSource('package.json'));
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

t('nouveautés : une fois par version, jamais à une installation neuve, jamais en arrière', () => {
  const v = N.NOTES[0].version;
  // Une installation neuve : tout est nouveau, rien ne change.
  assert.deepStrictEqual(N.aMontrer('', v, 'entreprise', true), []);
  // Une installation d'avant le mécanisme (rien de vu) : la version en cours seule, pas l'histoire.
  const a = N.aMontrer('', v, 'entreprise', false);
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].version, v);
  // Déjà vue : plus rien. Une bêta compte comme sa version.
  assert.deepStrictEqual(N.aMontrer(v, v, 'entreprise', false), []);
  assert.deepStrictEqual(N.aMontrer(v, v + '-beta.3', 'entreprise', false), []);
  assert.strictEqual(N.aMontrer('10.14.0', v + '-beta.3', 'entreprise', false).length, 1);
  // Revenir en arrière (sortie de la bêta) ne remontre rien.
  assert.deepStrictEqual(N.aMontrer('99.0.0', v, 'entreprise', false), []);
  // Les versions comparées en NOMBRES : 10.14.1 est plus récente que 9.99.9.
  assert.ok(N.comparer('10.14.1', '9.99.9') > 0);
  assert.strictEqual(N.comparer('10.14.1-beta.2', '10.14.1'), 0);
});

t('nouveautés : chaque application ne lit que ses phrases, et les communes', () => {
  const n = N.NOTES[0];
  const e = N.aMontrer('', n.version, 'entreprise', false)[0].points;
  const c = N.aMontrer('', n.version, 'cabinet', false)[0].points;
  assert.deepStrictEqual(e, n.commun.concat(n.entreprise));
  assert.deepStrictEqual(c, n.commun.concat(n.cabinet));
  // Plusieurs versions sautées : la plus récente d'abord, et seulement celles d'après la dernière vue.
  const vieux = { version: '10.13.9', commun: ['a'] };
  N.NOTES.push(vieux);
  try {
    const r = N.aMontrer('10.13.0', n.version, 'cabinet', false);
    assert.deepStrictEqual(r.map(x => x.version), [n.version, '10.13.9']);
    assert.deepStrictEqual(N.aMontrer('10.13.9', n.version, 'cabinet', false).map(x => x.version), [n.version]);
    // Une installation d'avant le mécanisme ne remonte pas l'histoire, même quand elle existe.
    assert.deepStrictEqual(N.aMontrer('', n.version, 'cabinet', false).map(x => x.version), [n.version]);
  } finally { N.NOTES.pop(); }
});

t('nouveautés : la version de package.json a ses phrases, simples, et ce qu\'elles citent existe', () => {
  const base = N.base(pkg.version);
  // La version publiée a ses phrases ; la tête de la table peut être la version EN PRÉPARATION (le
  // numéro de package.json ne bouge qu'à la publication).
  assert.ok(N.NOTES.some(n => n.version === base) || N.comparer(N.NOTES[0].version, base) > 0,
    `la version ${base} n'a pas d'entrée dans src/renderer/nouveautes.js — chaque version dit ce qu'elle change (une liste vide si rien de visible)`);
  // Les plus récentes en tête : c'est l'ordre que la carte affiche.
  for (let i = 1; i < N.NOTES.length; i++) assert.ok(N.comparer(N.NOTES[i - 1].version, N.NOTES[i].version) > 0, 'NOTES doit aller de la plus récente à la plus ancienne');
  const sources = {
    entreprise: ['src/renderer/app.js', 'src/renderer/visite.js', 'src/renderer/core.js'].map(f => lireSource(f)).join('\n'),
    cabinet: ['src/cabinet/renderer/app.js', 'src/renderer/visite.js', 'src/cabinet/cabcore.js'].map(f => lireSource(f)).join('\n')
  };
  const JARGON = /\b(renderer|IPC|CSS|JSON|HTML|refactor|bug|commit|e2e|API)\b/i;
  N.NOTES.forEach(n => ['commun', 'entreprise', 'cabinet'].forEach(cle => (n[cle] || []).forEach(p => {
    assert.ok(!JARGON.test(p), `phrase technique dans les nouveautés ${n.version} : « ${p} »`);
    assert.ok(p.length <= 170, `phrase trop longue (${p.length}) : « ${p} »`);
    const apps = cle === 'commun' ? ['entreprise', 'cabinet'] : [cle];
    (p.match(/«\s*([^»]+?)\s*»/g) || []).forEach(q => {
      const mot = q.replace(/[«»]/g, '').trim();
      apps.forEach(a => assert.ok(sources[a].includes(mot), `« ${mot} » (nouveautés ${n.version}) n'existe pas dans l'application ${a}`));
    });
  })));
});

t('nouveautés : revenir sur une version plus ancienne n\'oublie pas ce qu\'on a lu', () => {
  const mem = { 'skanfact-nouveautes-vue-entreprise': '10.14.1' };
  const avant = global.localStorage;
  global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  try {
    // Sortie de la bêta : l'application tourne sur une version plus ancienne que la dernière vue.
    assert.strictEqual(N.presenter({ app: 'entreprise', nomApp: 'SkanFact', version: '10.14.0', installationNeuve: false }), false);
    assert.strictEqual(mem['skanfact-nouveautes-vue-entreprise'], '10.14.1', 'la version vue a reculé : la carte se remontrerait');
    // Une installation neuve retient sa version sans rien montrer.
    delete mem['skanfact-nouveautes-vue-entreprise'];
    assert.strictEqual(N.presenter({ app: 'entreprise', nomApp: 'SkanFact', version: '10.14.1-beta.2', installationNeuve: true }), false);
    assert.strictEqual(mem['skanfact-nouveautes-vue-entreprise'], '10.14.1');
  } finally { global.localStorage = avant; }
});

t('nouveautés : la carte échappe ses phrases, et la typographie tient le guillemet à son mot', () => {
  assert.strictEqual(N.typo('« Chargement… » : oui ?'), '«\u202fChargement…\u202f»\u202f: oui\u202f?');
  const html = N.carteHtml([{ version: '1.0.0', points: ['<b>x</b> & y'] }], 'SkanFact');
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt; &amp; y') && !html.includes('<b>x</b>'));
  assert.ok(html.includes('id="nouv-ok"'));
});

t('nouveautés : les deux applications la présentent, après le démarrage, jamais par-dessus une question', () => {
  const app = sansCommentaires(lireSource('src/renderer/app.js'));
  const cab = sansCommentaires(lireSource('src/cabinet/renderer/app.js'));
  [[app, 'entreprise'], [cab, 'cabinet']].forEach(([src, nom]) => {
    const i = src.indexOf('Nouveautes.presenter(');
    assert.ok(i > 0, `${nom} : Nouveautes.presenter n'est jamais appelé`);
    const appel = src.slice(i, i + 700);
    assert.ok(new RegExp(`app: '${nom}'`).test(appel), `${nom} : l'appel ne nomme pas son application`);
    assert.ok(/installationNeuve:/.test(appel) && /peutMontrer:/.test(appel), `${nom} : ni installation neuve, ni écran libre`);
    assert.ok(/modal/.test(appel) && /#setup/.test(appel) && /Visite\.enCours/.test(appel), `${nom} : la carte passerait par-dessus une fenêtre, l'assistant ou une visite`);
  });
  const ie = lireSource('src/renderer/index.html'), ic = lireSource('src/cabinet/renderer/index.html');
  assert.ok(ie.indexOf('nouveautes.js') > 0 && ie.indexOf('nouveautes.js') < ie.indexOf('src="app.js"'));
  assert.ok(ic.indexOf('renderer/nouveautes.js') > 0 && ic.indexOf('renderer/nouveautes.js') < ic.indexOf('src="app.js"'));
  assert.ok(/'src\/renderer\/nouveautes\.js'/.test(lireSource('build/cabinet.config.js')), 'le Cabinet construit n\'embarquerait pas nouveautes.js');
});

t('chargement : la navigation pose « Chargement… » AVANT de dessiner, dans les deux applications', () => {
  [['src/renderer/app.js', 'entreprise'], ['src/cabinet/renderer/app.js', 'cabinet']].forEach(([f, nom]) => {
    const s = sansCommentaires(lireSource(f));
    const h = s.indexOf("addEventListener('hashchange'");
    const corps = s.slice(h, s.indexOf('});', h));
    assert.ok(/renderAvecChargement\(\)/.test(corps) && !/\brender\(\)/.test(corps), `${nom} : la navigation dessine sans montrer le chargement`);
    const i = s.indexOf('function renderAvecChargement');
    const f2 = s.slice(i, s.indexOf('\n  }', i));
    // Le voile d'abord, une image peinte, puis le dessin — et un filet si l'image ne vient pas.
    assert.ok(f2.indexOf('annoncerChargement()') < f2.indexOf('requestAnimationFrame'), `${nom} : le voile doit être posé avant d'attendre l'image`);
    assert.ok(/setTimeout\(dessiner, \d+\)/.test(f2), `${nom} : sans filet, une image qui ne vient pas bloquerait la navigation`);
    assert.ok(/finally \{ retirerChargement\(\); \}/.test(f2), `${nom} : une erreur de dessin laisserait le voile pour toujours`);
    assert.ok(/document\.hidden/.test(f2), `${nom} : une fenêtre cachée n'appelle pas requestAnimationFrame`);
  });
  const css = lireSource('src/renderer/style.css');
  const r = css.slice(css.indexOf('#chargement-page {'), css.indexOf('#chargement-page .cp-roue'));
  // Une page rapide ne le montre jamais : il n'apparaît qu'après un délai, par le compositeur.
  assert.ok(/animation: cp-apparait [^;]*\.2\ds/.test(r) && /opacity: 0/.test(r), 'le voile doit apparaître par une animation retardée');
  assert.ok(/pointer-events: none/.test(r));
});

t('transition : une page qui change s\'anime, un redessin sur place non, et « réduire les animations » est respecté', () => {
  const app = sansCommentaires(lireSource('src/renderer/app.js'));
  const rd = app.slice(app.indexOf('function render(keepScroll)'), app.indexOf('function setHashSilently'));
  assert.ok(/if \(pageChange && !keepScroll\) marquerEntree\(view\)/.test(rd), 'entreprise : l\'entrée ne dépend pas du changement de page');
  const cab = sansCommentaires(lireSource('src/cabinet/renderer/app.js'));
  assert.ok(/if \(ecranChange\) marquerEntree\(view\)/.test(cab), 'Cabinet : l\'entrée ne dépend pas du changement d\'écran');
  [app, cab].forEach(s => {
    const m = s.slice(s.indexOf('function marquerEntree'), s.indexOf('function marquerEntree') + 400);
    assert.ok(/setTimeout\(\(\) => view\.classList\.remove\('entree'\)/.test(m), 'la classe resterait : chaque redessin rejouerait l\'entrée');
  });
  const css = lireSource('src/renderer/style.css');
  assert.ok(/#view\.entree > \* \{ animation: page-entree [^;]*backwards; \}/.test(css), 'l\'entrée doit être `backwards` : une transformation laissée en place change le bloc de référence');
  const reduit = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('#view.entree > * { animation: none')));
  assert.ok(/#view\.entree > \* \{ animation: none; \}/.test(reduit));
});
};
