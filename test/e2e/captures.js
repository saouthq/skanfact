// L'instrument d'audit : il photographie TOUS les écrans de l'application entreprise, dans les deux
// états qui comptent, aux deux largeurs qui comptent — EN ENTIER.
//
// Pourquoi il existe : la méthode qui a trouvé les vrais défauts d'ergonomie (audits de 1.8.0 à 2.1.0)
// était « lire chaque capture, puis relire le code correspondant ».
//
// 10.12.0 — il photographiait un QUART de l'application en croyant la photographier toute :
//   · `fullPage: true` sur un cadre fixe (`#app { height: 100vh }`, c'est `#view` qui défile) rend
//     exactement une capture d'écran — la leçon de la 9.4.3, portée au Cabinet et jamais ici ;
//   · sa table d'onglets était écrite à la main et PÉRIMÉE (`journal`, `cloture`, `comptes`,
//     `rappro`, `clients`, `liste`, `plan`… n'existent plus), et l'instrument sautait en silence tout
//     onglet introuvable — le défaut de `#stk-tabs` (7.23.0) ;
//   · aucune fiche, aucune pièce par statut, aucun onglet des Paramètres.
// Il suit désormais le parcours PARTAGÉ (`ecrans-entreprise.js`), celui que `entreprise-rendu.js`
// mesure : ce qui est photographié est ce qui est mesuré, écran pour écran (10.6.0).
//
// Les deux états :
//   vierge — juste après l'assistant de première utilisation. Tous les défauts « je ne sais pas par
//            où commencer » vivent là.
//   demo   — le jeu de démonstration, tous les modules affichés. Là vivent les défauts de densité,
//            de vocabulaire et de listes.
//
// Les deux largeurs : 1440×900 (le MacBook de Skander) et 1280×800 (le plus petit écran courant).
//
//   xvfb-run -a node test/e2e/captures.js            → dist-e2e/captures/
//   xvfb-run -a node test/e2e/captures.js vierge     → un seul état
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller, dossierCaptures, capturePleine } = require('./harnais');
const { creerParcours, neutraliserSysteme, traverserAssistant, chargerExemple, toutAfficher, slug } = require('./ecrans-entreprise');
const { _electron: electron } = playwright();
const path = require('path');
const fs = require('fs');
const os = require('os');

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
    await neutraliserSysteme(app);
    const win = await app.firstWindow();
    surveiller(win, etat, bac);
    await win.setViewportSize({ width: 1440, height: 900 });

    const photographe = dossier => async (nom, ctx) => {
      const d = path.join(racine, dossier); fs.mkdirSync(d, { recursive: true });
      await capturePleine(win, path.join(d, ((ctx && ctx.cle) || slug(nom)) + '.png'));
    };
    await traverserAssistant(win, photographe(`${etat}-assistant`));
    j.ok('assistant terminé');
    if (etat === 'demo') {
      await chargerExemple(win);
      await toutAfficher(win);
      j.ok('jeu de démonstration chargé, tous les modules affichés');
    }

    for (const [L, H] of LARGEURS) {
      await win.setViewportSize({ width: L, height: H });
      await win.waitForTimeout(250);
      const p = creerParcours(win, photographe(`${etat}-${L}`), { gestes: true });
      await p.toutesLesPages();
      await p.toutesLesFiches();
      if (etat === 'demo') { await p.articlesAide(); await p.palette(); }
      await p.fermerTout();
      if (p.fautes.length) console.log(p.fautes.map(f => '  · ' + f).join('\n'));
      j.ok(`${L}×${H} : ${p.ecrans} écrans photographiés en entier`);
    }
    await fermer(app);
  }

  if (bac.length) { console.error('\nERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  console.log(`\n>>> CAPTURES OK — ${racine}`);
  process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
