// Le droit à l'erreur (7.12.0).
//
// Deux choses signalées en ouvrant l'application :
//
//   « dans tous les modules quand je décoche, ça disparaît pas du menu et je peux pas le recocher »
//   « quand on fait une action en se trompant on ne peut pas revenir en arrière, comme marquer
//     déposé : il n'y a pas de confirmation et pas de droit à l'erreur »
//
// Le premier était un piège : un module qui contient quelque chose se rallumait tout seul, donc la
// case se changeait en cadenas sous le doigt — le module restait dans le menu ET ne pouvait plus
// être recoché. Le second est la règle générale : ce qui détruit demande, ce qui se répare laisse
// un « Annuler » sous la main, là où on vient de cliquer.
//
// Ces deux défauts ne plantent pas, n'écrivent rien dans la console, et aucun test de calcul ne les
// voit : il faut faire les gestes dans l'application réelle.
//
//   xvfb-run -a node test/e2e/erreur.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-erreur-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const lu = () => JSON.parse(fs.readFileSync(path.join(userData, 'dossiers', 'principal', 'skanfact-data.json'), 'utf8'));
  const menu = () => win.$$eval('#nav a', as => as.map(a => a.textContent.trim()));

  j.etape('Une entreprise, un choix de modules enregistré');
  await win.waitForSelector('#setup');
  for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Erreur SUARL');
      await win.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
    }
    if (await win.$('[data-act="commerce"]')) { await win.click('[data-act="commerce"]'); await win.waitForSelector('[data-act="commerce"].sel'); }
    await win.click('#sf-next');
    await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  if (!Array.isArray(lu().company.modules)) throw new Error('l\'assistant n\'a enregistré aucun choix de modules : le test ne prouverait rien');
  j.ok('« Commerce et vente de produits » · ' + (await menu()).length + ' entrées de menu');

  j.etape('Un module VIDE se décoche : il quitte le menu, et sa case reste');
  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#mod-list [data-mod]');
  // On prend un module coché dont le compteur est à zéro : décocher ne doit rien demander.
  const vide = await win.evaluate(() => {
    const cb = Array.from(document.querySelectorAll('#mod-list [data-mod]')).find(x => x.checked && x.dataset.n === '0');
    return cb ? cb.dataset.mod : null;
  });
  if (!vide) throw new Error('aucun module coché et vide : impossible de tester le cas simple');
  const avant = (await menu()).length;
  await win.click(`[data-mod="${vide}"]`);
  await win.waitForFunction(n => document.querySelectorAll('#nav a').length < n, avant);
  if (!(await win.$(`[data-mod="${vide}"]`))) throw new Error(`la case de « ${vide} » a disparu après le clic : impossible de revenir en arrière`);
  if (await win.$eval(`[data-mod="${vide}"]`, c => c.checked)) throw new Error('la case est restée cochée alors que le module est masqué');
  j.ok(`« ${vide} » retiré (${avant} → ${(await menu()).length} entrées), la case est toujours là`);

  j.etape('… et se RECOCHE');
  await win.click(`[data-mod="${vide}"]`);
  await win.waitForFunction(n => document.querySelectorAll('#nav a').length === n, avant);
  if (!await win.$eval(`[data-mod="${vide}"]`, c => c.checked)) throw new Error('recocher la case n\'a pas ramené le module');
  j.ok('le menu est revenu à ' + avant + ' entrées');

  j.etape('Un module qui CONTIENT quelque chose : la question, puis le retrait — et la case reste');
  // On remplit « Achats » par le vrai formulaire, puis on le masque.
  await win.evaluate(() => { location.hash = '#/fournisseurs'; });
  await win.waitForSelector('#view .page-head #new');
  await win.click('#view .page-head #new');   // par ce qu'il FAIT : sur une liste vide, le vert est celui de l'état vide (U-11)
  await win.waitForSelector('#modal-root input[name=name]');
  await win.fill('#modal-root input[name=name]', 'Quincaillerie du Centre');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);

  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#mod-list [data-mod]');
  const n1 = await win.$eval('[data-mod="achats"]', c => c.dataset.n);
  if (n1 === '0') throw new Error('le fournisseur n\'a pas été compté dans le module Achats');
  await win.click('[data-mod="achats"]');
  await win.waitForSelector('#modal-root .modal-actions');
  const question = await win.$eval('#modal-root', el => el.textContent);
  if (!/Rien n'est supprimé|rien n'est supprimé/.test(question)) throw new Error('la question ne dit pas que rien n\'est supprimé : ' + question.slice(0, 160));
  // On refuse d'abord : la case doit se remettre, sinon l'écran ment.
  await win.click('#modal-root [data-close]');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
  if (!await win.$eval('[data-mod="achats"]', c => c.checked)) throw new Error('refuser la question a quand même décoché la case');
  j.ok('la question prévient, et un refus remet la case');

  await win.click('[data-mod="achats"]');
  await win.waitForSelector('#modal-root #ok');
  // Rien n'est détruit : le bouton ne doit pas être rouge, sinon la question ment sur sa gravité.
  if (await win.$eval('#modal-root #ok', b => b.classList.contains('btn-danger'))) {
    throw new Error('masquer un module se présente comme une destruction');
  }
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => !document.querySelectorAll('#nav a').length || !Array.from(document.querySelectorAll('#nav a')).some(a => /Fournisseurs/.test(a.textContent)));
  if (!(await win.$('[data-mod="achats"]'))) throw new Error('la case « Achats » a disparu : le piège est revenu');
  j.ok('« Achats » est hors du menu, et sa case attend qu\'on la recoche');

  j.etape('Le filet : enregistrer dans un module masqué le ramène, et l\'application le DIT');
  await win.evaluate(() => { location.hash = '#/fournisseurs'; });
  await win.waitForSelector('#view .page-head #new');
  await win.click('#view .page-head #new');   // par ce qu'il FAIT : sur une liste vide, le vert est celui de l'état vide (U-11)
  await win.waitForSelector('#modal-root input[name=name]');
  await win.fill('#modal-root input[name=name]', 'Câbles & Co');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
  await win.waitForFunction(() => Array.from(document.querySelectorAll('#nav a')).some(a => /Fournisseurs/.test(a.textContent)), null, { timeout: 4000 });
  const dit = await win.$eval('#toast', t => t.textContent);
  if (!/revient dans ton menu/.test(dit)) throw new Error('le module revient sans rien dire : ' + dit);
  if (!(lu().company.modules || []).includes('achats')) throw new Error('le retour n\'a pas été enregistré');
  j.ok(dit.trim());

  j.etape('« Marquer déposée » : le bandeau porte un « Annuler », et il défait vraiment');
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner');

  await win.evaluate(() => { location.hash = '#/paie'; });
  await win.waitForSelector('#p-tabs');
  await win.click('#p-tabs button[data-tab="declarations"]');
  await win.waitForSelector('#cn-file', { timeout: 5000 });
  // On cherche un trimestre qui porte des bulletins ET qui est TERMINÉ : depuis la 10.12.0, le
  // trimestre en cours ne se marque pas déposé (il manquerait ses derniers bulletins), et son bouton
  // est éteint. En janvier, aucun trimestre de l'année n'est fini : on remonte d'une année.
  let trouve = false;
  const annees = await win.$$eval('#p-year option', os => os.map(o => o.value));
  for (const an of annees) {
    await win.selectOption('#p-year', an);
    await win.waitForSelector('#d-quarter');
    for (const q of ['1', '2', '3', '4']) {
      await win.selectOption('#d-quarter', q);
      await win.waitForTimeout(200);
      if (await win.$('#cn-file:not([disabled])')) { trouve = true; break; }
    }
    if (trouve) break;
  }
  if (!trouve) throw new Error('aucun trimestre terminé ne porte de bulletin dans l\'exemple');
  const libelle = await win.$eval('#cn-file', b => b.textContent.trim());
  if (libelle !== 'Marquer déposée') throw new Error('le trimestre est déjà noté déposé : ' + libelle);
  await win.click('#cn-file');
  await win.waitForSelector('#toast.avec-bouton #toast-undo', { timeout: 4000 });
  if ((lu().socialFilings || []).length !== 1) throw new Error('la déclaration n\'a pas été notée');
  // Le bouton doit être CLIQUABLE : `#toast` vit en pointer-events:none le reste du temps.
  const recoit = await win.$eval('#toast-undo', b => {
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(el && (el.id === 'toast-undo' || el.closest('#toast-undo')));
  });
  if (!recoit) throw new Error('le bouton « Annuler » est visible mais ne reçoit pas les clics');
  await win.click('#toast-undo');
  await win.waitForTimeout(400);
  if ((lu().socialFilings || []).length !== 0) throw new Error('« Annuler » n\'a rien défait');
  await win.waitForSelector('#cn-file');
  if ((await win.$eval('#cn-file', b => b.textContent.trim())) !== 'Marquer déposée') throw new Error('l\'écran n\'est pas revenu à son état d\'avant');
  j.ok('noté, puis défait — et l\'écran est revenu comme avant');

  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — le droit à l'erreur est tenu.`);
})().catch(e => { console.error(e); process.exit(1); });
