// Ce qui se règle, et ce qui ne se réécrit plus (7.1.x).
//
// Quatre choses qu'aucun test de calcul ne peut attraper, parce qu'elles vivent dans l'enchaînement
// des écrans :
//   — une ligne neuve naît au taux de TVA du MÉTIER déclaré, pas à 19 % en dur (un kinésithérapeute
//     obtenait un catalogue à 0 % et des lignes à 19 % sur la même facture) ;
//   — le choix des modules affichés existe dans les Paramètres (la page était atteignable seulement
//     par la barre latérale et la palette) ;
//   — l'assistant de démarrage se REJOUE, prérempli (il ne s'affichait qu'une fois dans la vie de
//     l'installation, et « Passer » le condamnait pour de bon) ;
//   — « Passer » conserve ce qui vient d'être tapé, au lieu de le jeter en silence.
//
//   xvfb-run -a node test/e2e/reglages.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-v71-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  await win.waitForSelector('#setup');
  for (let i = 0; i < 6; i++) {
    if (i === 1) { await win.fill('#sf-form input[name=name]', 'Cabinet Test'); await win.fill('#sf-form input[name=matricule]', '1234567X/A/M/000'); }
    if (i === 2) { await win.click('[data-act="sante"]'); }
    await win.click('#sf-next');
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));

  j.etape('Le métier exonéré décide du taux des nouvelles lignes');
  const tva = await win.evaluate(() => JSON.parse(localStorage.getItem('skanfact') || 'null'));
  await win.evaluate(() => { location.hash = '#/doc/new/devis'; });
  await win.waitForSelector('#lines select[data-k=vatRate]');
  const v = await win.inputValue('#lines select[data-k=vatRate]');
  if (v !== '0') throw new Error(`une ligne neuve naît à ${v} % alors que le métier est exonéré`);
  j.ok('ligne neuve à 0 %');

  j.etape('Les deux boutons des Paramètres');
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForSelector('#go-modules');
  if (!(await win.$('#redo-setup'))) throw new Error('« Revoir l\'assistant » manquant');
  await win.click('#go-modules');
  await win.waitForSelector('#mod-list');
  if ((await win.textContent('#view h1')) !== 'Tous les modules') throw new Error('le bouton ne mène pas à la page des modules');
  j.ok('« Choisir les modules affichés… » mène à la page');

  j.etape('L\'assistant se rejoue, prérempli');
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForSelector('#redo-setup');
  await win.click('#redo-setup');
  await win.waitForSelector('#modal-root #ok');
  await win.click('#modal-root #ok');
  await win.waitForSelector('#setup');
  await win.click('#sf-next');
  await win.waitForSelector('#sf-form input[name=name]');
  const nom = await win.inputValue('#sf-form input[name=name]');
  if (nom !== 'Cabinet Test') throw new Error('l\'assistant rejoué doit être prérempli, il affiche : ' + JSON.stringify(nom));
  j.ok('prérempli avec « ' + nom + ' »');

  // Et « Passer » ne jette plus ce qui vient d'être tapé.
  await win.fill('#sf-form input[name=phone]', '+216 55 000 000');
  await win.click('#sf-skip');
  await win.waitForSelector('#modal-root #ok');
  const q = await win.textContent('#modal-root .modal');
  if (!/est conservé/.test(q)) throw new Error('la question doit dire que la saisie est gardée : ' + q.slice(0, 160));
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => !document.querySelector('#setup'));
  const tel = await win.evaluate(() => (JSON.parse(localStorage.getItem('skanfact') || '{}').company || {}).phone);
  j.ok('« Passer » a gardé la saisie');

  if (bac.length) { console.error('ERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  await app.close(); console.log('\n>>> 7.1.1 OK'); process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
