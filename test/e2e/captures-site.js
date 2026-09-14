// Les captures destinées au SITE WEB, pas à l'audit.
//
// Différence avec `captures.js` : ici on photographie ce que voit un utilisateur qui a ses propres
// données. Le jeu de démonstration sert de matière (il est réaliste et couvre tous les écrans), mais
// ses deux marqueurs — le bandeau « jeu d'exemple » et le tampon EXEMPLE sur les documents — sont
// masqués : ils n'existent que parce que les données sont fictives, et les montrer sur un site
// donnerait une image FAUSSE du produit, dans l'autre sens.
//
//   xvfb-run -a node test/e2e/captures-site.js [dossier de sortie]
const { playwright, RACINE, ELECTRON, journal, surveiller, dossierCaptures } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Les écrans qui servent à vendre : chacun doit prouver quelque chose à quelqu'un qui hésite.
const ECRANS = [
  { nom: 'accueil', route: 'dashboard' },
  { nom: 'factures', route: 'factures' },
  { nom: 'relances', route: 'relances' },
  { nom: 'clients', route: 'clients' },
  { nom: 'tresorerie', route: 'tresorerie', onglet: 'prevision' },
  { nom: 'comptable', route: 'compta', onglet: 'cabinet' },
  { nom: 'tva', route: 'compta', onglet: 'tva' },
  { nom: 'marges', route: 'marges' },
  { nom: 'stock', route: 'stock' },
  { nom: 'paie', route: 'paie', onglet: 'bulletins' },
];

const SANS_MARQUEURS = `
  .demo-banner { display: none !important; }
  .stamp { display: none !important; }
`;

(async () => {
  const j = journal();
  const bac = [];
  const sortie = process.argv[2] || dossierCaptures('site');
  fs.mkdirSync(sortie, { recursive: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-site-'));

  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE],
    executablePath: ELECTRON,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  });
  const win = await app.firstWindow();
  surveiller(win, 'site', bac);
  await win.setViewportSize({ width: 1440, height: 900 });

  // L'assistant, déroulé avec une société plausible : c'est son nom qui apparaîtra sur les documents
  // photographiés. On reconnaît chaque écran à ce qu'il contient, jamais à son rang.
  await win.waitForSelector('#setup');
  for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Ben Salah SUARL');
      await win.fill('#sf-form input[name=matricule]', '1234567X/A/M/000');
      await win.fill('#sf-form textarea[name=address]', 'Rue de Carthage\n2080 Ariana');
    }
    if (await win.$('[data-act="batiment"]')) {
      await win.click('[data-act="batiment"]');
      await win.waitForSelector('[data-act="batiment"].sel');
    }
    await win.click('#sf-next');
    await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  j.ok('assistant terminé');

  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForSelector('#load-demo');
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 2500 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
  await win.waitForFunction(() => location.hash === '#/dashboard');
  j.ok('jeu de démonstration chargé');

  await win.addStyleTag({ content: SANS_MARQUEURS });

  for (const e of ECRANS) {
    await win.evaluate(r => { location.hash = '#/' + r; }, e.route);
    await win.waitForSelector('#view h1');
    if (e.onglet) {
      const t = await win.$(`[data-tab="${e.onglet}"]`);
      if (t && await t.isVisible().catch(() => false)) {
        await t.click({ timeout: 1500 }).catch(() => {});
      }
    }
    await win.waitForTimeout(350);
    await win.addStyleTag({ content: SANS_MARQUEURS });
    await win.screenshot({ path: path.join(sortie, e.nom + '.png') });
  }
  j.ok(`${ECRANS.length} écrans`);

  // L'éditeur : c'est l'image du hero. L'aperçu vit dans une iframe, et le tampon y est dessiné —
  // il faut donc masquer dans la frame, pas seulement dans la page.
  // Un devis NEUF est vide : il ne montre rien. On ouvre une pièce existante du jeu, en cliquant
  // la première ligne de la liste comme le ferait un utilisateur.
  await win.evaluate(() => { location.hash = '#/devis'; });
  await win.waitForSelector('#view table.list tbody tr');
  await win.click('#view table.list tbody tr');
  await win.waitForSelector('#f-head');
  await win.waitForTimeout(500);
  await win.addStyleTag({ content: SANS_MARQUEURS });
  for (const f of win.frames()) {
    await f.addStyleTag({ content: SANS_MARQUEURS }).catch(() => {});
  }
  await win.waitForTimeout(250);
  await win.screenshot({ path: path.join(sortie, 'editeur.png') });
  j.ok('éditeur');

  await app.close();
  if (bac.length) { console.error('\nERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  console.log(`\n>>> CAPTURES SITE OK — ${sortie}`);
  process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
