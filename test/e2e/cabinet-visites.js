'use strict';
// ============================================================================================
// e2e:cabinet-visites — chaque étape de chaque visite du Cabinet, JOUÉE (10.14.0)
//
// Skander : « il manque encore beaucoup de parcours… ». Quarante-neuf gestes guidés et vingt-cinq
// visites d'écran : `e2e:cabinet-couverture` vérifie que chaque contrôle a son explication, mais RIEN
// ne vérifiait que chaque étape tombe sur sa cible. Une étape qui vise un sélecteur disparu ne casse
// rien : la bulle annonce « On s'est perdus de vue », et personne ne le voit avant un comptable.
// C'est exactement ce que le test à la souris a trouvé (le clic sur la sixième ligne de la
// Production), et il n'avait joué que cinq parcours sur quarante-neuf.
//
// Pour chaque visite de « Me guider » : on la lance par son VRAI bouton, puis, étape par étape,
//   - la bulle doit être dans l'écran ;
//   - elle ne doit jamais se dire perdue ;
//   - un geste « faire » se JOUE (un clic réel sur la cible, ou la frappe de son essai) ; un geste
//     qui ouvre un sélecteur du système se passe (le sélecteur est remplacé par « annulé ») ;
//   - chaque étape doit avancer — une visite qui reste sur place trois tours de suite est bloquée.
// Une visite qui ne se lance pas sur l'exemple (« D'abord : … ») est COMPTÉE, jamais ignorée : sur
// l'exemple, toutes doivent pouvoir se lancer.
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { jouer } = require('./jouer-visites');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');


(async () => {
  const j = journal(); const bac = []; const fautes = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-visites-'));
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'cab')}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  // Aucun sélecteur du système ne s'ouvre : il bloquerait le parcours pour toujours.
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    dialog.showSaveDialog = async () => ({ canceled: true });
    dialog.showMessageBox = async () => ({ response: 0 });
  });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const attendre = (ms = 300) => win.waitForTimeout(ms);
  await win.setViewportSize({ width: 1440, height: 900 });

  j.etape('Ouvrir un cabinet neuf, charger l\'exemple');
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', 'visites-2026');
  await win.fill('#lock-pw2', 'visites-2026');
  await win.click('#lock-go');
  await win.waitForSelector('#app', { state: 'visible', timeout: 15000 });
  await attendre(700);
  for (let g = 0; g < 12 && await win.$('#setup'); g++) {
    const nom = await win.$('#setup input[name=name], #w-name');
    if (nom) await nom.fill('Cabinet Visites');
    const suivant = await win.$('#w-next');
    if (!suivant) break;
    await suivant.click();
    await attendre(320);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'), null, { timeout: 8000 }).catch(() => {});
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="app"]');
  await attendre(320);
  const charger = await win.$('#r-demo-on');
  if (charger) { await charger.click(); await attendre(1500); }
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#view table.list tbody tr[data-id]', { timeout: 8000 });
  j.ok('exemple chargé');

  // ------------------------------------------------------------------ la liste, lue dans « Me guider »
  const ouvrirGuide = async () => {
    await win.evaluate(() => { if (window.Visite && window.Visite.enCours()) window.Visite.quitter(); location.hash = '#/guide'; });
    await win.waitForSelector('#view [data-visite]', { timeout: 8000 });
    await attendre(250);
  };
  // Après un rechargement, l'application redemande son mot de passe.
  const deverrouiller = async () => {
    await attendre(800);
    if (await win.$('#lock-screen:not([hidden]) #lock-pw')) {
      await win.fill('#lock-pw', 'visites-2026');
      await win.click('#lock-go');
      await win.waitForSelector('#app', { state: 'visible', timeout: 15000 }).catch(() => {});
      await attendre(600);
    }
  };
  await ouvrirGuide();
  const ids = await win.evaluate(() => [...new Set([...document.querySelectorAll('#view [data-visite]')].map(b => b.dataset.visite))]);
  if (ids.length < 60) throw new Error(`« Me guider » n'offre que ${ids.length} visites : le parcours n'a pas atteint la liste`);
  j.ok(`${ids.length} visites à jouer`);

  // Chaque visite est jouée par le harnais commun (`jouer-visites.js`, partagé avec l'app entreprise).
  // Un geste qui RECHARGE la fenêtre (verrouiller, restaurer) arrête la visite : on le dit, on attend
  // que l'application revienne, et on reprend à la suivante — sans perdre les autres.
  const compte = { etapes: 0, passees: 0 };
  let jouees = 0;
  const bloquees = [];
  for (const id of ids) {
    process.stdout.write(`  · ${id}\n`);
    try {
      const r = await jouer(win, id, { ouvrirGuide, fautes, compte });
      if (r.bloquee) bloquees.push(id); else jouees++;
    } catch (e) {
      const m = String(e && e.message || e);
      if (!/context was destroyed|navigation|Target closed/.test(m)) throw e;
      fautes.push(`${id} : un geste a rechargé la fenêtre au milieu de la visite`);
      await win.waitForLoadState('domcontentloaded').catch(() => {});
      await deverrouiller();
    }
  }

  await fermer(app);
  const passees = compte.passees, etapes = compte.etapes;
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  if (bloquees.length) fautes.push(`${bloquees.length} visite(s) ne se lancent pas sur l'exemple : ${bloquees.join(', ')}`);
  if (fautes.length) { console.error(`\n${fautes.length} faute(s) :\n  ` + fautes.join('\n  ')); process.exit(1); }
  console.log(`\n${jouees} visites jouées, ${etapes} étapes, ${passees} geste(s) passé(s) faute de sélecteur du système : aucune bulle perdue, aucune hors de l'écran.`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
