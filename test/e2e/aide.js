// L'Aide refondue (7.23.0).
//
// Avant : trente-deux titres dans une liste plate, un pavé de prose à droite, et six liens vers
// l'application dans 99 Ko de texte — un cul-de-sac à chaque fois. Ce parcours vérifie les cinq
// gestes que la refonte promet :
//
//   1. `#/aide` ouvre un ACCUEIL par thèmes, pas le premier article d'une liste.
//   2. Un thème s'ouvre et montre ses articles.
//   3. Un article dit d'où il vient (fil d'Ariane) et mène à l'article suivant DE SON THÈME.
//   4. Le geste au bout de l'article ouvre vraiment la page qu'il annonce.
//   5. La recherche traverse tout, et « Comprendre cette page » ouvre l'article de LA page ouverte.
//
//   xvfb-run -a node test/e2e/aide.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-aide-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(320); };

  j.etape('Une entreprise');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Aide SUARL');
      await win.fill('#sf-form input[name=matricule]', '7788990D/A/M/000');
    }
    if (await win.$('[data-act="conseil"]')) { await win.click('[data-act="conseil"]'); await win.waitForSelector('[data-act="conseil"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  j.ok('prêt');

  // -------------------------------------------------- 1. l'accueil par thèmes
  j.etape('#/aide ouvre un accueil par thèmes, pas un article');
  await aller('#/aide');
  await win.waitForSelector('.help-theme');
  const themes = await win.evaluate(() => [...document.querySelectorAll('.help-theme')].map(b => ({
    id: b.dataset.theme, titre: (b.querySelector('.ht-l') || {}).textContent, n: (b.querySelector('.ht-n') || {}).textContent
  })));
  if (themes.length < 5) throw new Error(`${themes.length} thème(s) affiché(s) : l'accueil ne range rien`);
  if (await win.$('.help-body')) throw new Error('#/aide ouvre d\'office un article : on ne voit jamais la carte du domaine');
  j.ok(`${themes.length} thèmes — « ${themes[0].titre} » (${(themes[0].n || '').trim()})`);

  // -------------------------------------------------- 2. un thème s'ouvre
  j.etape('Un thème montre ses articles');
  await win.click('.help-theme');
  await win.waitForSelector('.help-art');
  const arts = await win.evaluate(() => [...document.querySelectorAll('.help-art')].map(b => b.dataset.art));
  if (!arts.length) throw new Error('le thème ouvert ne liste aucun article');
  j.ok(`${arts.length} article(s) listé(s)`);

  // -------------------------------------------------- 3. fil d'Ariane et article suivant
  j.etape('Un article dit d\'où il vient, et mène au suivant de son thème');
  await win.click(`.help-art[data-art="${arts[0]}"]`);
  await win.waitForSelector('.help-body');
  const fil = await win.evaluate(() => [...document.querySelectorAll('.help-fil button, .help-fil span')].map(x => x.textContent.trim()));
  if (fil.length < 3) throw new Error(`le fil d'Ariane n'a que ${fil.length} niveau(x) : ${fil.join(' / ')}`);
  if (fil[0] !== 'Aide') throw new Error(`le fil ne commence pas par « Aide » : ${fil.join(' / ')}`);
  const suite = await win.evaluate(() => [...document.querySelectorAll('.help-suite [data-art]')].map(b => b.dataset.art));
  if (!suite.length) throw new Error('aucun article suivant ni précédent : il faut repasser par la liste');
  // Le suivant doit appartenir au MÊME thème : on lit un domaine, on ne saute pas de la paie au stock.
  const memeTheme = suite.every(id => arts.includes(id));
  if (!memeTheme) throw new Error(`l'article suivant sort du thème : ${suite.join(', ')} hors de ${arts.join(', ')}`);
  j.ok(`fil « ${fil.join(' › ')} » — voisins dans le thème : ${suite.join(', ')}`);

  // -------------------------------------------------- 4. le geste mène vraiment quelque part
  j.etape('Le geste au bout de l\'article ouvre la page qu\'il annonce');
  // On prend un article qui en a un : tous n'en ont pas (glossaire, raccourcis).
  const G = require(path.join(RACINE, 'src', 'renderer', 'guide.js'));
  const avecGeste = Object.keys(G.GESTES)[0];
  await aller('#/aide/' + avecGeste);
  await win.waitForSelector('.help-geste [data-geste]');
  const cible = await win.$eval('.help-geste [data-geste]', b => b.dataset.geste);
  await win.click('.help-geste [data-geste]');
  await win.waitForFunction(x => location.hash === x, cible, { timeout: 4000 });
  j.ok(`« ${avecGeste} » mène à ${cible}`);

  // -------------------------------------------------- 5. recherche et aide contextuelle
  j.etape('La recherche traverse tout, et chaque page mène à SON article');
  await aller('#/aide');
  await win.fill('#aide-q', 'timbre');
  await win.waitForTimeout(400);
  const res = await win.evaluate(() => ({
    caches: document.querySelector('#aide-vue').hidden,
    trouves: [...document.querySelectorAll('#aide-res .help-art')].map(b => b.dataset.art),
    compte: (document.querySelector('#aide-n') || {}).textContent
  }));
  if (!res.trouves.length) throw new Error('« timbre » ne trouve aucun article');
  if (!res.caches) throw new Error('les thèmes restent affichés sous les résultats de recherche');
  j.ok(`« timbre » → ${res.compte.trim()}`);

  // Le lien contextuel : on ouvre une page, et « Comprendre cette page » doit viser SON article.
  await aller('#/tresorerie');
  const lien = await win.$('.page-help');
  if (!lien) throw new Error('la page Trésorerie n\'offre aucun lien vers son article');
  const href = await lien.getAttribute('href');
  if (href !== '#/aide/' + G.PAR_PAGE.tresorerie) throw new Error(`le lien vise ${href} au lieu de l'article de la page`);
  await lien.click();
  await win.waitForSelector('.help-body');
  const titre = await win.$eval('.help-h', e => e.textContent.trim());
  j.ok(`Trésorerie → « ${titre} »`);

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — l'Aide se parcourt par territoire, et chaque article mène quelque part.`);
})().catch(e => { console.error(e); process.exit(1); });
