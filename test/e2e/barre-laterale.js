// La barre latérale : ce qu'on voit sans faire défiler, et ce qui ne se perd jamais (7.0.0).
//
// Pourquoi ce test existe : avant la 7.0.0, `nav` contenait dix-neuf liens écrits à la main et avait
// besoin de 866 px. Sur un MacBook de 900 px de haut il en avait 705. « Paramètres » et « Aide »
// étaient donc hors champ — et « Aide » l'était même sur un écran de 1050 px. Le propriétaire de
// l'application a passé des semaines à chercher le bouton d'aide : il était sous le plancher, derrière
// une barre de défilement que macOS masque tant qu'on ne fait pas défiler.
//
// Ça ne se voit dans aucune console, et aucun test de calcul ne peut l'attraper : il faut mesurer
// dans l'application réelle (CLAUDE.md, leçon 6.8.0).
//
//   xvfb-run -a node test/e2e/barre-laterale.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Les tailles qui comptent : le Mac de Skander, le plus petit portable courant, et un grand écran.
const ECRANS = [[1680, 1050], [1440, 900], [1366, 768], [1280, 800]];

(async () => {
  const j = journal();
  const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-barre-'));
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE],
    executablePath: ELECTRON, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  });
  const win = await app.firstWindow();
  surveiller(win, '', bac);

  j.etape('L\'assistant de première utilisation, mené au plus court');
  await win.waitForSelector('#setup');
  for (let i = 0; i < 6; i++) {
    if (i === 1) {
      await win.fill('#sf-form input[name=name]', 'Atelier Ben Salah SUARL');
      await win.fill('#sf-form input[name=matricule]', '1234567X/A/M/000');
    }
    if (i === 2) { await win.click('[data-act="conseil"]'); await win.waitForSelector('[data-act="conseil"].sel'); }
    await win.click('#sf-next');
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  j.ok('entreprise créée');

  // Mesure : ce que `nav` demande, ce dont il dispose, et ce qui tombe hors champ.
  const mesurer = async () => win.evaluate(() => {
    const nav = document.querySelector('nav');
    const boite = nav.getBoundingClientRect();
    const hors = [...nav.querySelectorAll('a')]
      .filter(a => { const b = a.getBoundingClientRect(); return b.bottom > boite.bottom + 1 || b.top < boite.top - 1; })
      .map(a => a.textContent.trim());
    const visible = el => {
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= window.innerHeight + 1;
    };
    return {
      besoin: nav.scrollHeight, place: nav.clientHeight, hors,
      liens: nav.querySelectorAll('a').length,
      deborde: nav.classList.contains('deborde'),
      parametres: visible(document.querySelector('.sidebar-foot a[data-route="parametres"]')),
      aide: visible(document.querySelector('.sidebar-foot a[data-route="aide"]')),
      tousLesModules: !!document.querySelector('nav a[data-route="modules"]')
    };
  });

  j.etape('Le seul point qui ne se négocie pas : Aide et Paramètres, sur toutes les tailles d\'écran');
  for (const [L, H] of ECRANS) {
    await win.setViewportSize({ width: L, height: H });
    await win.waitForTimeout(200);
    const m = await mesurer();
    if (!m.aide) throw new Error(`${L}×${H} : « Aide » n'est pas visible sans faire défiler. C'est le bouton que cherche quelqu'un qui se perd.`);
    if (!m.parametres) throw new Error(`${L}×${H} : « Paramètres » n'est pas visible sans faire défiler, alors que l'aide y renvoie onze fois.`);
    if (!m.tousLesModules) throw new Error(`${L}×${H} : « Tous les modules » a disparu de la barre — plus aucune porte vers ce qui est masqué.`);
    j.ok(`${L}×${H} : Aide, Paramètres et « Tous les modules » atteignables · nav ${m.besoin}px / ${m.place}px`
      + (m.hors.length ? ` · ${m.hors.length} entrée(s) à faire défiler` : ' · tout tient'));
  }

  j.etape('Avec les modules d\'un débutant, la barre tient en entier sur le plus petit écran');
  await win.setViewportSize({ width: 1366, height: 768 });
  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#mod-list');
  // On décoche tout ce qui est décochable : c'est l'état « je fais du conseil, je facture, point ».
  // Le panneau se redessine à chaque case (les explications changent) : garder les poignées d'une
  // seule requête donnerait des éléments détachés du document. On reprend la première encore cochée
  // à chaque tour — c'est le même piège que celui noté en 3.3.0 pour `check()`.
  for (let garde = 0; garde < 20; garde++) {
    const c = await win.$('#mod-list input[type=checkbox]:checked');
    if (!c) break;
    await c.click();
    await win.waitForTimeout(80);
  }
  if (await win.$('#mod-list input[type=checkbox]:checked')) throw new Error('des modules restent cochés');
  await win.evaluate(() => { location.hash = '#/dashboard'; });
  await win.waitForSelector('#view h1');
  await win.waitForTimeout(200);
  const m = await mesurer();
  if (m.hors.length) throw new Error(`avec les modules du premier jour, ${m.hors.length} entrée(s) restent hors champ : ${m.hors.join(', ')} (nav ${m.besoin}px pour ${m.place}px)`);
  if (m.deborde) throw new Error('la barre se croit débordée alors que tout tient');
  j.ok(`${m.liens} entrées, ${m.besoin}px pour ${m.place}px — rien à faire défiler`);

  j.etape('Rien de masqué n\'est perdu');
  // La page d'un module retiré du menu s'ouvre normalement, et l'application dit où le retrouver.
  await win.evaluate(() => { location.hash = '#/paie'; });
  await win.waitForSelector('#view h1');
  if ((await win.textContent('#view h1')) !== 'Paie') throw new Error('la page d\'un module masqué doit s\'ouvrir normalement');
  await win.waitForSelector('.mod-banner');
  const texte = await win.textContent('.mod-banner');
  if (!/n'est pas dans ton menu/.test(texte)) throw new Error('bandeau : ' + texte);
  j.ok('la page s\'ouvre, et l\'app explique pourquoi elle n\'est pas au menu');

  // Le bouton du bandeau la remet au menu — sans quoi il faudrait retourner dans les réglages.
  await win.click('#mod-add');
  await win.waitForSelector('nav a[data-route="paie"]');
  j.ok('« Ajouter au menu » la fait apparaître tout de suite');

  j.etape('On ne masque jamais ce qui contient quelque chose');
  // On retire Paie du menu, puis on crée un salarié : le module doit revenir tout seul.
  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#mod-list');
  await win.click('#mod-list input[data-mod="paie"]');
  await win.waitForTimeout(120);
  if (await win.$('nav a[data-route="paie"]')) throw new Error('décoché, le module devrait quitter le menu');
  await win.evaluate(() => { location.hash = '#/paie'; });
  await win.waitForSelector('#view h1');
  await win.click('#view .page-head .btn-primary');           // + Salarié
  await win.waitForSelector('#modal-root input[name=name]');
  await win.fill('#modal-root input[name=name]', 'Fatma Trabelsi');
  await win.fill('#modal-root input[name=grossSalary]', '1200');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
  await win.evaluate(() => { location.hash = '#/dashboard'; });
  await win.waitForSelector('#view h1');
  if (!(await win.$('nav a[data-route="paie"]'))) {
    throw new Error('un module qui contient des données doit revenir au menu tout seul : sans ça, quelqu\'un qui a saisi puis décoché croirait avoir tout perdu');
  }
  j.ok('un salarié suffit à faire revenir « Paie » au menu');

  // Et il ne se laisse plus décocher : la case cède la place à une explication.
  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#mod-list');
  if (await win.$('#mod-list input[data-mod="paie"]')) throw new Error('un module rempli ne doit pas offrir de case à décocher');
  const ligne = await win.textContent('#mod-list');
  if (!/on ne masque pas ce que tu as saisi/.test(ligne)) throw new Error('l\'écran doit DIRE pourquoi le module est figé');
  j.ok('la case a cédé la place à la raison');

  if (bac.length) { console.error('\nERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  await app.close();
  console.log('\n>>> BARRE LATÉRALE OK');
  process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
