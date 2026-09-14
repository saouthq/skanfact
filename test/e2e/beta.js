// Le canal bêta (7.25.0), dans l'application réelle.
//
// Ce qu'on prouve, et pourquoi ça ne se lit pas dans le code :
//
//   1. La case arrive DÉCOCHÉE. Une mise à jour ne met personne sur le canal d'essai.
//   2. Cocher POSE UNE QUESTION, et refuser laisse la case décochée — une case qui reste cochée
//      après un « Annuler » ment sur l'état réel de l'installation.
//   3. Accepter arme le canal ET prend la sauvegarde « avant-beta ». Le filet doit exister au
//      moment où la bêta s'installera, pas au moment où on y repensera.
//   4. Décocher revient au canal normal, sans question (revenir en arrière ne se négocie pas).
//   5. Le repère « bêta » du menu suit la VERSION INSTALLÉE, pas le canal choisi : on tourne encore
//      sur une stable juste après avoir coché.
//
//   xvfb-run -a node test/e2e/beta.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-beta-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  await win.setViewportSize({ width: 1440, height: 900 });

  j.etape('Une entreprise');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Bêta SUARL');
      await win.fill('#sf-form input[name=matricule]', '1122334C/A/M/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  j.ok('prêt');

  const ouvrirMaj = async () => {
    await win.evaluate(() => { location.hash = '#/dashboard'; });
    await win.waitForTimeout(150);
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await win.waitForSelector('#set-tabs');
    await win.click('#set-tabs button[data-tab="maj"]');
    await win.waitForFunction(() => { const p = document.querySelector('[data-pane="maj"]'); return p && !p.hidden; });
    await win.waitForSelector('#upd-beta');
  };

  // -------------------------------------------------- 1. décochée au départ
  j.etape('La case arrive décochée');
  await ouvrirMaj();
  if (await win.isChecked('#upd-beta')) throw new Error('le canal bêta est armé sur une installation neuve');
  if (!(await win.$('#beta-tag[hidden]'))) throw new Error('le repère « bêta » s\'affiche sur une version stable');
  j.ok('canal normal, aucun repère');

  // -------------------------------------------------- 2. cocher pose une question, et Annuler tient
  j.etape('Cocher pose une question — et « Annuler » laisse la case décochée');
  await win.click('#upd-beta');
  await win.waitForSelector('#modal-root .modal');
  const txt = await win.textContent('#modal-root .modal');
  if (!/essai/i.test(txt) || !/sauvegarde/i.test(txt)) {
    throw new Error('la question ne dit pas ce qu\'est une bêta ni qu\'une sauvegarde est prise : ' + txt.slice(0, 160));
  }
  await win.click('#modal-root [data-close]');
  await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
  await win.waitForTimeout(150);
  if (await win.isChecked('#upd-beta')) throw new Error('la case reste cochée après un refus : elle ment sur l\'état réel');
  j.ok('refus respecté');

  // -------------------------------------------------- 3. accepter arme le canal et prend le filet
  j.etape('Accepter arme le canal et prend la sauvegarde « avant-beta »');
  await win.click('#upd-beta');
  await win.waitForSelector('#modal-root #ok');
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => {
    const b = document.querySelector('#upd-beta'); return b && b.checked;
  }, null, { timeout: 8000 });
  // Le réglage vit dans update-config.json, à côté des données : c'est un réglage de l'ordinateur,
  // pas de l'entreprise — il ne part donc pas dans un export ni dans un paquet du comptable.
  const cfg = JSON.parse(fs.readFileSync(path.join(userData, 'update-config.json'), 'utf8'));
  if (cfg.beta !== true) throw new Error('le canal n\'est pas écrit dans update-config.json');
  // Les sauvegardes vivent dans le dossier de l'entreprise ouverte (userData/dossiers/<id>/backups
  // depuis la 3.2.0), pas à la racine : on cherche sans présumer de l'identifiant.
  const dossiers = path.join(userData, 'dossiers');
  const sauv = fs.readdirSync(dossiers)
    .map(d => path.join(dossiers, d, 'backups'))
    .filter(p2 => fs.existsSync(p2))
    .flatMap(p2 => fs.readdirSync(p2))
    .filter(f => f.includes('avant-beta'));
  if (!sauv.length) throw new Error('aucune sauvegarde « avant-beta » : le filet manque au moment où il compte');
  j.ok(`canal armé, filet pris (${sauv[0]})`);

  // -------------------------------------------------- 4. le repère suit la version, pas le canal
  j.etape('Le repère « bêta » suit la version installée, pas la case');
  if (!(await win.$('#beta-tag[hidden]'))) {
    throw new Error('le repère s\'allume alors que la version installée est encore une stable');
  }
  j.ok('la case est cochée, la version reste stable, aucun repère');

  // -------------------------------------------------- 5. revenir en arrière ne se négocie pas
  j.etape('Décocher revient au canal normal, sans question');
  await win.click('#upd-beta');
  await win.waitForFunction(() => {
    const b = document.querySelector('#upd-beta'); return b && !b.checked;
  }, null, { timeout: 8000 });
  if (await win.$('#modal-root .modal')) throw new Error('sortir du canal bêta ne doit rien demander');
  const cfg2 = JSON.parse(fs.readFileSync(path.join(userData, 'update-config.json'), 'utf8'));
  if ('beta' in cfg2) throw new Error('le réglage reste écrit après décochage');
  j.ok('retour au canal normal');

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log('\nLe canal bêta : décoché par défaut, prévenu, sauvegardé, et réversible.');
})().catch(e => { console.error(e); process.exit(1); });
