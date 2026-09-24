// Changer d'entreprise depuis le haut du menu (7.14.0).
//
// Skander : « faut que ça soit le plus facile possible, par exemple choisir son entreprise dans le
// haut du menu en sélectionnant dans une liste afin de basculer sans aller dans paramètres ».
//
// L'application gère plusieurs dossiers depuis la 3.2.0 — sa société, celle de son père, un dossier
// partagé à deux — et le seul chemin pour en changer était Paramètres → Sécurité et données →
// Dossiers, c'est-à-dire cinq clics et un onglet qu'il faut connaître. Pendant ce temps, le nom du
// dossier ouvert est écrit en permanence en haut à gauche de la fenêtre.
//
// L'endroit qui AFFICHE un état est l'endroit où on s'attend à le changer.
//
//   xvfb-run -a node test/e2e/entreprises.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-entreprises-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  let win = await app.firstWindow(); surveiller(win, '', bac);

  const assistant = async (nom, mf) => {
    await win.waitForSelector('#setup');
    for (let g = 0; g < 15 && await win.$('#setup'); g++) {
      if (await win.$('#sf-form input[name=name]')) {
        await win.fill('#sf-form input[name=name]', nom);
        await win.fill('#sf-form input[name=matricule]', mf);
      }
      if (await win.$('[data-act="conseil"]')) { await win.click('[data-act="conseil"]'); await win.waitForSelector('[data-act="conseil"].sel'); }
      await win.click('#sf-next'); await win.waitForTimeout(120);
    }
    await win.waitForFunction(() => !document.querySelector('#setup'));
  };

  j.etape('Une première entreprise');
  await assistant('Atelier Un SUARL', '1111111A/A/M/000');
  const nom1 = await win.$eval('#brand-company', e => e.textContent.trim());
  if (nom1 !== 'Atelier Un SUARL') throw new Error('le nom de l\'entreprise ne s\'affiche pas : ' + nom1);
  j.ok(nom1);

  j.etape('L\'en-tête de la barre est un bouton, et il s\'ouvre');
  const bouton = await win.$('#brand-btn');
  if (!bouton) throw new Error('l\'en-tête n\'est pas un bouton : rien ne permet de changer d\'entreprise depuis le menu');
  // Les trois signes qui font qu'on essaie de cliquer : un curseur, un chevron, un état au survol.
  const signes = await win.evaluate(() => {
    const b = document.querySelector('#brand-btn');
    const s = getComputedStyle(b);
    return { curseur: s.cursor, chevron: !!document.querySelector('.brand-chev'), tag: b.tagName };
  });
  if (signes.tag !== 'BUTTON') throw new Error('l\'en-tête n\'est pas un <button> : il ne sera pas atteignable au clavier');
  if (signes.curseur !== 'pointer') throw new Error('l\'en-tête n\'a pas de curseur de clic : rien ne dit qu\'on peut cliquer');
  if (!signes.chevron) throw new Error('aucun chevron : rien ne dit qu\'une liste va s\'ouvrir');
  await win.click('#brand-btn');
  await win.waitForSelector('#dos-menu:not([hidden])');
  const menu1 = await win.$eval('#dos-menu', e => e.textContent);
  if (!/Atelier Un SUARL/.test(menu1)) throw new Error('le menu ne montre pas l\'entreprise ouverte');
  if (!/Nouvelle entreprise/.test(menu1)) throw new Error('le menu ne propose pas de créer une seconde entreprise');
  // 10.12.0 — le menu prenait la largeur de l'en-tête et coupait ses propres gestes (« Partager
  // cette entre… », « Rejoindre un dossie… ») : un geste qu'on ne lit pas entier ne se choisit pas.
  const coupes = await win.$$eval('#dos-menu button:not([data-dos]) .dm-nom', els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
  if (coupes.length) throw new Error('le menu des entreprises coupe ses gestes : ' + coupes.join(', '));
  j.ok('le menu s\'ouvre, nomme l\'entreprise ouverte, et ses gestes se lisent en entier');

  j.etape('Échap le referme, un clic ailleurs aussi');
  await win.keyboard.press('Escape');
  await win.waitForFunction(() => document.querySelector('#dos-menu').hidden);
  await win.click('#brand-btn');
  await win.waitForSelector('#dos-menu:not([hidden])');
  await win.click('#view');
  await win.waitForFunction(() => document.querySelector('#dos-menu').hidden);
  j.ok('il se referme des deux façons');

  j.etape('Créer une seconde entreprise depuis le menu');
  await win.click('#brand-btn');
  await win.waitForSelector('#dos-menu:not([hidden])');
  await win.click('#dm-new');
  await win.waitForSelector('#modal-root input');
  await win.fill('#modal-root input', 'Darium SARL');
  await win.click('#modal-root #ok');
  // Créer un dossier recharge la fenêtre sur le dossier neuf : l'assistant s'ouvre pour lui.
  await win.waitForTimeout(1500);
  win = app.windows()[0]; surveiller(win, 'poste2', bac);
  await assistant('Darium SARL', '2222222B/B/M/000');
  const nom2 = await win.$eval('#brand-company', e => e.textContent.trim());
  if (!/Darium/.test(nom2)) throw new Error('la seconde entreprise ne s\'est pas ouverte : ' + nom2);
  j.ok(nom2);

  j.etape('Basculer vers la première, sans passer par les Paramètres');
  await win.click('#brand-btn');
  await win.waitForSelector('#dos-menu:not([hidden])');
  const menu2 = await win.$eval('#dos-menu', e => e.textContent);
  if (!/Basculer vers/.test(menu2)) throw new Error('le menu ne propose pas de basculer : ' + menu2.slice(0, 200));
  if (!/Atelier Un SUARL/.test(menu2)) throw new Error('la première entreprise n\'est pas dans la liste');
  const cible = await win.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#dos-menu [data-dos]')).find(x => /Atelier Un/.test(x.textContent));
    return b ? b.dataset.dos : null;
  });
  if (!cible) throw new Error('aucun bouton pour la première entreprise');
  await win.click(`#dos-menu [data-dos="${cible}"]`);
  await win.waitForTimeout(1800);
  win = app.windows()[0]; surveiller(win, 'retour', bac);
  await win.waitForSelector('#brand-company');
  await win.waitForFunction(() => /Atelier Un/.test(document.querySelector('#brand-company').textContent), null, { timeout: 8000 });
  j.ok('« ' + (await win.$eval('#brand-company', e => e.textContent.trim())) +' » en deux clics');

  j.etape('Le menu reste sous les fenêtres : une question posée par-dessus passe devant');
  await win.click('#brand-btn');
  await win.waitForSelector('#dos-menu:not([hidden])');
  const couches = await win.evaluate(() => {
    const m = getComputedStyle(document.querySelector('#dos-menu')).zIndex;
    return Number(m);
  });
  if (!(couches < 400)) throw new Error(`le menu des dossiers est à la couche ${couches} : il passerait devant une fenêtre modale`);
  j.ok('couche ' + couches + ', sous les fenêtres (400)');

  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — on change d'entreprise depuis le haut du menu.`);
})().catch(e => { console.error(e); process.exit(1); });
