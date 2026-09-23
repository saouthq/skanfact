// Voir ce qu'on fabrique (7.13.0).
//
// Skander : « l'aperçu du document est bon mais quand on a un petit écran comme un Mac ou un Windows
// on ne voit rien — donc permettre de voir en plein écran le document qu'on édite ; et le bouton
// aperçu est en bas, on ne le voit même pas des fois. »
//
// Les deux moitiés du défaut :
//   — la colonne de droite fait 430 px (350 sous 1340 px) pour une page A4 de 794 : le document y
//     est affiché à 54 %, puis à 44 %. On distingue une mise en page ; on ne LIT ni un prix, ni une
//     désignation, ni une mention légale — la seule chose que le client, lui, verra ;
//   — une fois l'aperçu masqué, son bouton repartait à la FIN du formulaire, trois écrans plus bas.
//     Un interrupteur doit rester là où on l'a actionné.
//
// Ce test mesure les deux dans l'application réelle, à 1440 et à 1280.
//
//   xvfb-run -a node test/e2e/apercu.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-apercu-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Aperçu SUARL');
      await win.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner');
  await win.evaluate(() => { location.hash = '#/factures'; });
  await win.waitForSelector('#view table.list tbody tr[data-id]');
  const id = await win.$eval('#view table.list tbody tr[data-id]', tr => tr.dataset.id);
  j.ok('prêt');

  for (const [l, ht] of [[1440, 900], [1280, 800]]) {
    j.etape(`Le grand aperçu à ${l} px`);
    await win.setViewportSize({ width: l, height: ht });
    await win.evaluate(i => { location.hash = '#/doc/' + i; }, id);
    await win.waitForSelector('#preview');
    await win.waitForTimeout(700);

    // La commande de l'aperçu est dans la barre d'actions, en HAUT de la page — pas au bas du
    // formulaire. On le mesure : elle doit être visible sans faire défiler.
    const cmd = await win.evaluate(() => {
      const b = document.querySelector('#pv-big');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { y: Math.round(r.top), visible: r.top >= 0 && r.bottom <= window.innerHeight && r.right <= document.documentElement.clientWidth };
    });
    if (!cmd) throw new Error('le bouton « Agrandir » n\'existe pas dans la barre d\'actions');
    if (!cmd.visible) throw new Error(`« Agrandir » n'est pas visible sans défiler (haut à ${cmd.y} px)`);

    const colonne = await win.$eval('#preview', f => Math.round(f.getBoundingClientRect().width));

    await win.click('#pv-big');
    await win.waitForSelector('#pv-full-frame');
    await win.waitForTimeout(700);
    const grand = await win.$eval('#pv-full-frame', f => Math.round(f.getBoundingClientRect().width));
    if (grand < colonne * 2) throw new Error(`le grand aperçu ne fait que ${grand} px contre ${colonne} en colonne : il n'apporte rien`);

    // « Ajuster » montre la page ENTIÈRE, pas seulement sa largeur : sinon il faut défiler pour
    // voir le total, et un aperçu qu'on doit faire défiler n'est pas ajusté.
    const dedans = await win.evaluate(() => {
      const f = document.querySelector('#pv-full-frame');
      const d = f.contentDocument;
      return { deborde: d.documentElement.scrollHeight - d.documentElement.clientHeight, zoom: document.querySelector('#pv-zoom-val').textContent };
    });
    if (dedans.deborde > 8) throw new Error(`« Ajuster » laisse ${dedans.deborde} px de page hors de l'écran (${dedans.zoom})`);

    // Le zoom monte, descend, et « Ajuster » revient.
    await win.click('#pv-zoom-in'); await win.waitForTimeout(350);
    const z1 = await win.$eval('#pv-zoom-val', e => e.textContent);
    await win.click('#pv-zoom-in'); await win.waitForTimeout(350);
    const z2 = await win.$eval('#pv-zoom-val', e => e.textContent);
    const n = s => Number((s.match(/(\d+) %/) || [])[1]);
    if (!(n(z2) > n(z1))) throw new Error(`le zoom ne monte pas : ${z1} puis ${z2}`);
    // Et à 100 %, on lit vraiment : la page fait ses 794 px dans l'iframe.
    await win.click('#pv-zoom-out'); await win.waitForTimeout(350);
    if (!(n(await win.$eval('#pv-zoom-val', e => e.textContent)) < n(z2))) throw new Error('le zoom ne redescend pas');
    await win.click('#pv-fit'); await win.waitForTimeout(350);
    if (!/Ajusté/.test(await win.$eval('#pv-zoom-val', e => e.textContent))) throw new Error('« Ajuster » ne revient pas à la page entière');

    // Échap referme. Une fenêtre ouverte par-dessus garderait la priorité, mais il n'y en a pas ici.
    await win.keyboard.press('Escape');
    await win.waitForTimeout(300);
    if (await win.$('#pv-full')) throw new Error('Échap ne referme pas le grand aperçu');
    j.ok(`colonne ${colonne} px → grand ${grand} px (${dedans.zoom}), zoom ${z1} → ${z2}, Échap referme`);
  }

  j.etape('Masquer l\'aperçu : la colonne part, l\'interrupteur reste en haut');
  await win.setViewportSize({ width: 1440, height: 900 });
  await win.waitForTimeout(200);
  await win.click('#pv-toggle');
  await win.waitForTimeout(400);
  const etat = await win.evaluate(() => {
    const t = document.querySelector('#pv-toggle');
    const r = t.getBoundingClientRect();
    const col = document.querySelector('.preview');
    return { texte: t.textContent.trim(), haut: Math.round(r.top), colonne: !!(col && col.offsetParent) };
  });
  if (etat.colonne) throw new Error('la colonne de l\'aperçu est encore là, réduite à son bouton — c\'est exactement le défaut');
  if (etat.haut > 260) throw new Error(`l'interrupteur est descendu à ${etat.haut} px : on ne le retrouvera pas`);
  if (!/Afficher/.test(etat.texte)) throw new Error('l\'interrupteur ne dit pas ce qu\'il fera : ' + etat.texte);
  // Et il revient.
  await win.click('#pv-toggle');
  await win.waitForSelector('#preview');
  j.ok(`« ${etat.texte} » reste à ${etat.haut} px du haut, et ramène l'aperçu`);

  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — on voit ce qu'on fabrique.`);
})().catch(e => { console.error(e); process.exit(1); });
