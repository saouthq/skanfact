// L'instrument d'audit : il photographie TOUTES les pages de l'application entreprise, dans les deux
// états qui comptent, aux deux largeurs qui comptent.
//
// Pourquoi il existe : la méthode qui a trouvé les vrais défauts d'ergonomie (audits de 1.8.0 à 2.1.0)
// était « lire chaque capture, puis relire le code correspondant ». Cette méthode est décrite dans
// CLAUDE.md comme si `e2e:entreprise` la fournissait — elle ne la fournit plus : ce parcours vérifie
// des comportements, il ne photographie rien. Il fallait donc réécrire le photographe à chaque audit,
// et c'est exactement ce que le harnais était censé faire disparaître.
//
// Les deux états :
//   vierge — juste après l'assistant de première utilisation. C'est l'écran que voit quelqu'un qui
//            vient d'installer. Tous les défauts « je ne sais pas par où commencer » vivent là.
//   demo   — le jeu de démonstration : une entreprise qui tourne depuis deux ans. C'est là que vivent
//            les défauts de densité, de vocabulaire et de listes.
//
// Les deux largeurs : 1440×900 (le MacBook de Skander) et 1280×800 (le plus petit écran courant).
//
//   xvfb-run -a node test/e2e/captures.js            → dist-e2e/captures/
//   xvfb-run -a node test/e2e/captures.js vierge     → un seul état
const { playwright, RACINE, ELECTRON, journal, surveiller, dossierCaptures } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Chaque page de la barre latérale, plus les pages de détail qu'on n'atteint que par un clic.
// `attend` est le sélecteur qui prouve que la page est dessinée (sinon on photographie du vide).
const PAGES = [
  { route: 'dashboard', nom: 'accueil' },
  { route: 'devis' }, { route: 'factures' }, { route: 'relances' },
  { route: 'autres' }, { route: 'contrats' },
  { route: 'achats' }, { route: 'fournisseurs' },
  { route: 'clients' }, { route: 'catalogue' },
  { route: 'tresorerie' }, { route: 'marges' }, { route: 'paie' },
  { route: 'stock' }, { route: 'immos' }, { route: 'garanties' },
  { route: 'stats' }, { route: 'compta' },
  { route: 'parametres' }, { route: 'aide' }
];

// Les onglets internes : une page à quatre onglets ne se juge pas sur son premier onglet.
const ONGLETS = {
  compta: ['journal', 'tva', 'cabinet', 'cloture', 'ecritures'],
  tresorerie: ['comptes', 'mouvements', 'prevision', 'rappro'],
  paie: ['salaries', 'bulletins', 'conges', 'avances', 'registre', 'declarations'],
  stock: ['etat', 'mouvements', 'inventaire', 'series'],
  marges: ['clients', 'prestations', 'affaires', 'seuil'],
  catalogue: ['prestations', 'modeles', 'textes'],
  immos: ['liste', 'plan', 'attente'],
  stats: [], autres: ['proforma', 'commande', 'livraison', 'contrat']
};

const LARGEURS = [[1440, 900], [1280, 800]];

(async () => {
  const j = journal();
  const bac = [];
  const racine = dossierCaptures('captures');
  const etats = process.argv[2] ? [process.argv[2]] : ['vierge', 'demo'];

  for (const etat of etats) {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-shots-'));
    j.etape(`État « ${etat} »`);
    const app = await electron.launch({
      args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE],
      executablePath: ELECTRON,
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
    });
    const win = await app.firstWindow();
    surveiller(win, etat, bac);

    // L'assistant de première utilisation, déroulé comme le ferait quelqu'un de pressé : on renseigne
    // le strict minimum (la raison sociale est le seul champ refusé vide) et on enchaîne.
    await win.waitForSelector('#setup');
    // On reconnaît chaque écran à ce qu'il contient : le nombre d'écrans change au fil des versions
    // (sept depuis la 7.2.0), et une boucle comptée photographierait un assistant à moitié déroulé.
    // Les modules restent tels que l'assistant les propose : c'est ce que verrait quelqu'un de pressé.
    for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
      if (await win.$('#sf-form input[name=name]')) {
        await win.fill('#sf-form input[name=name]', 'Atelier Ben Salah SUARL');
        await win.fill('#sf-form input[name=matricule]', '1234567X/A/M/000');
        await win.fill('#sf-form textarea[name=address]', 'Rue de Carthage\n2080 Ariana');
      }
      if (await win.$('[data-act="batiment"]')) { await win.click('[data-act="batiment"]'); await win.waitForSelector('[data-act="batiment"].sel'); }
      if (await win.$('#sf-mods')) {
        const d = path.join(racine, `${etat}-assistant`);
        fs.mkdirSync(d, { recursive: true });
        await win.screenshot({ path: path.join(d, 'modules.png') });
      }
      await win.click('#sf-next');
      await win.waitForTimeout(120);
    }
    await win.waitForFunction(() => !document.querySelector('#setup'));
    j.ok('assistant terminé');

    if (etat === 'demo') {
      // Le jeu de démonstration se charge depuis Paramètres → Sécurité et données.
      await win.evaluate(() => { location.hash = '#/parametres'; });
      await win.waitForSelector('#set-tabs');
      await win.click('#set-tabs button[data-tab="donnees"]');
      await win.waitForSelector('#load-demo');
      await win.click('#load-demo');
      // Sur une installation neuve il n'y a rien à remplacer : l'app ne pose pas la question. La
      // confirmation n'apparaît que s'il existe déjà des documents ou des clients.
      const ok = await win.waitForSelector('#modal-root #ok', { timeout: 2500 }).catch(() => null);
      if (ok) await ok.click();
      await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
      await win.waitForFunction(() => location.hash === '#/dashboard');
      j.ok('jeu de démonstration chargé');
    }

    for (const [L, H] of LARGEURS) {
      await win.setViewportSize({ width: L, height: H });
      for (const p of PAGES) {
        const nom = p.nom || p.route;
        await win.evaluate(r => { location.hash = '#/' + r; }, p.route);
        await win.waitForSelector('#view h1');
        await win.waitForTimeout(220);                  // le temps des graphiques et des listes
        const dossier = path.join(racine, `${etat}-${L}`);
        fs.mkdirSync(dossier, { recursive: true });
        await win.screenshot({ path: path.join(dossier, `${nom}.png`), fullPage: true });

        // Les onglets internes, quand la page en a : le premier onglet ne dit pas tout.
        // Un onglet peut exister dans le DOM sans être cliquable (page vide, onglet masqué) : on le
        // saute au lieu d'attendre trente secondes qu'il devienne actionnable — c'est ce qui rendait
        // ce parcours interminable sur les pages sans données.
        for (const t of (ONGLETS[p.route] || [])) {
          const el = await win.$(`[data-tab="${t}"]`);
          if (!el || !(await el.isVisible().catch(() => false))) continue;
          if (!(await el.click({ timeout: 1500 }).then(() => true).catch(() => false))) continue;
          await win.waitForTimeout(200);
          await win.screenshot({ path: path.join(dossier, `${nom}-${t}.png`), fullPage: true });
        }
      }
      j.ok(`${L}×${H} : ${PAGES.length} pages`);

      // Les écrans qu'aucune adresse ne désigne, et où l'utilisateur passe pourtant son temps :
      // l'éditeur de document, une fenêtre modale, la palette de recherche.
      const dossier = path.join(racine, `${etat}-${L}`);
      const tir = async (nom, avant) => {
        try { await avant(); await win.waitForTimeout(260);
          await win.screenshot({ path: path.join(dossier, nom + '.png'), fullPage: true });
        } catch (e) { console.log(`  · ${nom} : ${e.message.split('\n')[0]}`); }
        await win.keyboard.press('Escape').catch(() => {});
        await win.evaluate(() => { location.hash = '#/dashboard'; }).catch(() => {});
        await win.waitForTimeout(150);
      };
      await tir('geste-editeur-devis', async () => {
        await win.evaluate(() => { location.hash = '#/doc/new/devis'; });
        await win.waitForSelector('#f-head');
      });
      await tir('geste-choix-client', async () => {
        await win.evaluate(() => { location.hash = '#/doc/new/devis'; });
        await win.waitForSelector('#f-head [data-combo=clientId] .combo-btn');
        await win.click('#f-head [data-combo=clientId] .combo-btn');
        await win.waitForSelector('#f-head [data-combo=clientId] .combo-pop');
      });
      await tir('geste-palette', async () => {
        await win.keyboard.press('Control+k');
        await win.waitForSelector('#palette-root input');
      });
      await tir('geste-nouveau-client', async () => {
        await win.evaluate(() => { location.hash = '#/clients'; });
        await win.waitForSelector('#view .page-head #new');
        await win.click('#view .page-head #new');
        await win.waitForSelector('#modal-root .modal');
      });
    }
    await app.close();
  }

  if (bac.length) { console.error('\nERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  console.log(`\n>>> CAPTURES OK — ${racine}`);
  process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
