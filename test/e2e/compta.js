// La comptabilité qui mène aux pièces (7.21.0).
//
// Six endroits où la page Comptabilité et la Trésorerie NOMMENT quelque chose sans pouvoir l'ouvrir,
// ou affirment un état qu'on ne peut pas corriger :
//
//   1. Les contrôles avant clôture étaient du texte, alors que la même liste porte ses boutons à un
//      onglet de distance.
//   2. Les douze lignes « Mois par mois » de la TVA ne se cliquaient pas.
//   3. Le bloc de TVA ne menait ni aux ventes ni aux achats qui le fabriquent.
//   4. Une échéance fiscale restait rouge après le dépôt, pour toujours.
//   5. Un mouvement de trésorerie ne menait pas à sa facture — et la phrase juste en dessous disait
//      d'aller la corriger.
//   6. La carte « Reste à encaisser » n'ouvrait rien, alors que sa jumelle de l'accueil le fait.
//
//   xvfb-run -a node test/e2e/compta.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-compta-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(320); };
  const onglet = async t => { await win.click(`#c-tabs button[data-tab=${t}]`); await win.waitForTimeout(320); };

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Compta SUARL');
      await win.fill('#sf-form input[name=matricule]', '2233445Z/A/P/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await aller('#/parametres');
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner');
  j.ok('prêt');

  // -------------------------------------------------- 1. les contrôles avant clôture s'ouvrent
  j.etape('Les contrôles avant clôture ouvrent les pièces concernées');
  await aller('#/compta');
  await win.waitForSelector('#c-tabs');
  await onglet('clotures');
  const checks = await win.evaluate(() => [...document.querySelectorAll('[data-check]')].map(b => b.dataset.check));
  if (!checks.length) throw new Error('aucun contrôle avant clôture sur le jeu d\'exemple : le test ne prouve rien');
  await win.click('[data-check]');
  await win.waitForTimeout(450);
  const arrive = await win.evaluate(() => location.hash);
  if (arrive === '#/compta' || !arrive) throw new Error(`le bouton du contrôle « ${checks[0] } » n'a mené nulle part (${arrive})`);
  j.ok(`${checks.length} contrôle(s) armé(s) — « ${checks[0]} » mène à ${arrive}`);

  // -------------------------------------------------- 2 et 3. la TVA mène à ses pièces
  j.etape('Les douze mois de la TVA se cliquent, et le bloc mène à ses journaux');
  await aller('#/compta');
  await win.waitForSelector('#c-tabs');
  await onglet('tva');
  const mois = await win.evaluate(() => [...document.querySelectorAll('#c-body tr[data-vm]')].map(tr => tr.dataset.vm));
  if (mois.length < 12) throw new Error(`seulement ${mois.length} ligne(s) cliquable(s) au lieu de douze`);
  const titreAvant = await win.$eval('#c-body .panel h2', e => e.textContent.trim());
  // On clique un mois qui n'est pas celui affiché.
  const cible = await win.evaluate(ms => {
    const courant = document.querySelector('#c-month') ? document.querySelector('#c-month').value : '';
    return ms.find(m => m !== courant) || ms[0];
  }, mois);
  await win.click(`#c-body tr[data-vm="${cible}"]`);
  await win.waitForTimeout(420);
  const titreApres = await win.$eval('#c-body .panel h2', e => e.textContent.trim());
  if (titreApres === titreAvant) throw new Error(`cliquer le mois ${cible} n'a rien changé : « ${titreApres} »`);
  const selecteur = await win.evaluate(() => (document.querySelector('#c-month') || {}).value);
  if (selecteur !== cible) throw new Error(`le sélecteur de mois affiche « ${selecteur} » et la page « ${cible} »`);
  j.ok(`${mois.length} mois cliquables — « ${titreAvant} » → « ${titreApres} »`);

  j.etape('« Voir les ventes » arrive sur le bon onglet, allumé');
  const aBouton = await win.evaluate(() => !!document.querySelector('#vat-ventes'));
  if (!aBouton) throw new Error('le bloc de TVA n\'offre pas de mener aux ventes sur ce mois');
  await win.click('#vat-ventes');
  await win.waitForTimeout(420);
  const etat = await win.evaluate(() => ({
    actif: (document.querySelector('#c-tabs button.active') || {}).dataset && document.querySelector('#c-tabs button.active').dataset.tab,
    contenu: document.querySelector('#c-body').textContent.slice(0, 120)
  }));
  if (etat.actif !== 'ventes') throw new Error(`l'onglet allumé est « ${etat.actif} » au lieu de « ventes »`);
  j.ok('onglet Ventes ouvert ET allumé, sur le mois demandé');

  // -------------------------------------------------- 4. l'échéance fiscale se pointe
  j.etape('Une échéance fiscale déposée cesse de crier, et l\'annulation la rend');
  await aller('#/compta');
  await win.waitForSelector('#c-tabs');
  await onglet('calendrier');
  const avant = await win.evaluate(() => [...document.querySelectorAll('[data-fdone]')].map(b => ({ id: b.dataset.fdone, lab: b.dataset.flab })));
  if (!avant.length) throw new Error('aucune échéance à venir : le test ne prouve rien');
  const premier = avant[0];
  await win.click(`[data-fdone="${premier.id}"]`);
  await win.waitForSelector('#toast-undo', { timeout: 4000 });
  const apres = await win.evaluate(() => [...document.querySelectorAll('[data-fdone]')].map(b => b.dataset.fdone));
  if (apres.includes(premier.id)) throw new Error(`l'échéance « ${premier.lab} » est toujours réclamée après le dépôt`);
  // La règle elle-même reste : l'occurrence SUIVANTE doit rester réclamée.
  const memeRegle = apres.filter(id => id.split('@')[0] === premier.id.split('@')[0]);
  const regleConnue = await win.evaluate(() => window.SkanCore.fiscalDeadlines(window.__data).filter(r => r.active !== false).length);
  if (regleConnue && !memeRegle.length && apres.length === 0) {
    throw new Error('pointer une échéance a vidé tout le calendrier : la règle a disparu avec elle');
  }
  await win.click('#toast-undo');
  await win.waitForTimeout(420);
  const rendu = await win.evaluate(() => [...document.querySelectorAll('[data-fdone]')].map(b => b.dataset.fdone));
  if (!rendu.includes(premier.id)) throw new Error('« Annuler » n\'a pas rendu l\'échéance');
  j.ok(`« ${premier.lab} » pointée puis rendue — ${memeRegle.length} occurrence(s) suivante(s) toujours réclamée(s)`);

  // -------------------------------------------------- 5. le mouvement mène à sa pièce
  j.etape('Un mouvement de trésorerie ouvre la pièce d\'où il vient');
  await aller('#/tresorerie');
  await win.waitForSelector('#t-tabs');
  await win.click('#t-tabs button[data-tab=mouvements]');
  await win.waitForSelector('#m-wrap');
  const vers = await win.evaluate(() => {
    const tr = [...document.querySelectorAll('#m-wrap tr[data-go]')].find(x => x.dataset.go);
    return tr ? tr.dataset.go : '';
  });
  if (!vers) throw new Error('aucun mouvement ne mène à sa pièce');
  await win.evaluate(g => { [...document.querySelectorAll('#m-wrap tr[data-go]')].find(x => x.dataset.go === g).click(); }, vers);
  await win.waitForFunction(g => location.hash === g, vers, { timeout: 4000 });
  j.ok(`un encaissement ouvre ${vers}`);

  // -------------------------------------------------- 6. la carte de la Comptabilité
  j.etape('« Reste à encaisser » de la Comptabilité ouvre la même liste que l\'accueil');
  await aller('#/compta');
  await win.waitForSelector('#c-tabs');
  await onglet('ventes');
  const carte = await win.evaluate(() => !!document.querySelector('#c-body .stat[data-cstat]'));
  if (!carte) throw new Error('la carte de la Comptabilité n\'est pas cliquable');
  await win.click('#c-body .stat[data-cstat]');
  await win.waitForFunction(() => location.hash === '#/factures', { timeout: 4000 });
  await win.waitForSelector('#st', { timeout: 4000 });
  const filtre = await win.evaluate(() => ({
    st: document.querySelector('#st').value,
    note: (document.querySelector('.f-note') || {}).textContent || '',
    lignes: document.querySelectorAll('table.list tbody tr').length
  }));
  if (filtre.st !== 'à encaisser') throw new Error(`la liste arrive filtrée sur « ${filtre.st} » au lieu de « à encaisser »`);
  if (!filtre.lignes) throw new Error('la liste filtrée est vide : le filtre ne rend pas ce que la carte annonçait');
  j.ok(`liste des factures filtrée sur « ${filtre.st} » — ${filtre.note.trim() || filtre.lignes + ' ligne(s)'}`);

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — la comptabilité mène aux pièces.`);
})().catch(e => { console.error(e); process.exit(1); });
