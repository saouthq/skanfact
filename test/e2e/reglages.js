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
  // On avance en reconnaissant chaque écran à ce qu'il contient, pas à son numéro : l'assistant a
  // gagné un septième écran en 7.2.0, et une boucle « six fois Continuer » se serait arrêtée avant
  // la fin sans rien dire. Le compteur de garde n'est là que pour ne pas boucler à l'infini.
  let vuModules = false;
  for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Cabinet Test');
      await win.fill('#sf-form input[name=matricule]', '1234567X/A/M/000');
    }
    if (await win.$('[data-act="sante"]')) await win.click('[data-act="sante"]');
    if (await win.$('#sf-mods')) {
      vuModules = true;
      // « Santé et paramédical » ne propose ni stock, ni paie, ni immobilisations : les cases
      // arrivent décochées, et on les laisse telles quelles.
      const coches = await win.evaluate(() => [...document.querySelectorAll('[data-sfmod]')].filter(c => c.checked).map(c => c.dataset.sfmod));
      if (coches.includes('paie')) throw new Error('la Paie ne devrait pas être proposée à un cabinet de santé');
    }
    await win.click('#sf-next');
    await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  if (!vuModules) throw new Error('l\'assistant n\'a jamais montré l\'écran « De quoi as-tu besoin ? »');

  j.etape('L\'assistant a VRAIMENT rangé le menu');
  // Le défaut : tout le mécanisme existait depuis la 7.0.0 et personne ne l'armait. `company.modules`
  // restait à null, donc le menu affichait ses dix-sept entrées à quelqu'un qui venait de déclarer
  // son métier à l'écran précédent.
  const lire = () => JSON.parse(fs.readFileSync(path.join(userData, 'dossiers', 'principal', 'skanfact-data.json'), 'utf8'));
  const mods = (lire().company || {}).modules;
  if (!Array.isArray(mods)) throw new Error('l\'assistant n\'a rien enregistré : company.modules = ' + JSON.stringify(mods));
  const liens = await win.evaluate(() => [...document.querySelectorAll('nav a')].map(a => a.dataset.route));
  if (liens.includes('paie')) throw new Error('« Paie » est dans le menu alors que le métier ne la demande pas');
  if (!liens.includes('devis') || !liens.includes('compta')) throw new Error('le cœur du métier a disparu du menu : ' + liens.join(','));
  j.ok(liens.length + ' entrées au menu au lieu de dix-sept · modules enregistrés : ' + mods.join(', '));

  j.etape('Le métier exonéré décide du taux des nouvelles lignes');
  await win.evaluate(() => { location.hash = '#/doc/new/devis'; });
  await win.waitForSelector('#lines select[data-k=vatRate]');
  const v = await win.inputValue('#lines select[data-k=vatRate]');
  if (v !== '0') throw new Error(`une ligne neuve naît à ${v} % alors que le métier est exonéré`);
  j.ok('ligne neuve à 0 %');

  j.etape('Les deux boutons des Paramètres');
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  // Les modules et l'assistant ne sont plus dans « Données et sécurité » — ils n'y étaient ni de
  // la sécurité ni des données. Ils vivent dans « L'application » depuis la refonte 7.30.0.
  await win.click('#set-tabs button[data-tab="app"]');
  await win.waitForSelector('#go-modules');
  if (!(await win.$('#redo-setup'))) throw new Error('« Revoir l\'assistant » manquant');
  await win.click('#go-modules');
  await win.waitForSelector('#mod-list');
  if ((await win.textContent('#view h1')) !== 'Tous les modules') throw new Error('le bouton ne mène pas à la page des modules');
  j.ok('« Choisir les modules affichés… » mène à la page');

  j.etape('L\'assistant se rejoue, prérempli');
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="app"]');
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
  // Ce contrôle lisait `localStorage`, où l'application n'écrit rien : il renvoyait `undefined` et
  // affichait « ok » sans rien vérifier. Un test qui ne peut pas échouer est pire que pas de test —
  // celui-là couvrait depuis la 7.1.1 un défaut qu'il aurait laissé revenir sans un mot.
  const tel = (lire().company || {}).phone;
  if (tel !== '+216 55 000 000') throw new Error('« Passer » a jeté ce qui venait d\'être tapé : phone = ' + JSON.stringify(tel));
  j.ok('« Passer » a gardé la saisie (' + tel + ')');

  j.etape('Ce qu\'on ne pouvait pas faire, et qu\'on ne comprenait pas');
  // La case « numéro de série » vivait DANS le bloc masqué par « Suivi en stock » : le message qui
  // envoyait la chercher décrivait une case qui n'existait pas à l'écran.
  await win.evaluate(() => { location.hash = '#/catalogue'; });
  await win.waitForSelector('#view .page-head');
  await win.click('#view .page-head .btn-primary');
  await win.waitForSelector('#modal-root input[name=serialized]');
  if (!(await win.isVisible('#modal-root input[name=serialized]'))) {
    throw new Error('la case « numéro de série » doit être visible sans avoir coché autre chose d\'abord');
  }
  // Et la cocher coche « Suivi en stock », dont elle dépend — au lieu d'être annulée en silence.
  await win.check('#modal-root input[name=serialized]');
  if (!(await win.isChecked('#modal-root input[name=tracked]'))) {
    throw new Error('cocher le suivi par numéro doit cocher le suivi en stock : sinon l\'enregistrement l\'annule sans un mot');
  }
  await win.click('#modal-root [data-close]');
  j.ok('la case des numéros de série est visible, et elle entraîne le suivi en stock');

  // Le panneau « Pièces jointes » existe même sur une pièce neuve.
  await win.evaluate(() => { location.hash = '#/doc/new/facture'; });
  await win.waitForSelector('#att-save-first');
  j.ok('« Pièces jointes » existe sur une pièce neuve, avec le geste qui débloque');

  j.etape('Les Paramètres : on voit, on trouve, et rien ne se jette sans un mot');
  // Le thème se voyait seulement après avoir trouvé « Enregistrer » tout en bas d'une page de six
  // panneaux — donc on ne l'essayait pas.
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab=app]');
  await win.selectOption('#pf select[name=theme]', 'dark');
  if (!(await win.evaluate(() => document.body.classList.contains('dark')))) {
    throw new Error('le thème sombre ne se voit pas avant d\'être enregistré');
  }
  if (await win.isHidden('#save-bar')) throw new Error('un aperçu ne dispense pas d\'enregistrer : la barre doit apparaître');
  j.ok('le thème se voit tout de suite, et reste à enregistrer');

  // Les couleurs et le logo vivaient dans l'onglet Société, entre le matricule fiscal et le RIB.
  // Elles ont fait un second voyage en 7.30.0 : le titre du panneau dit « sur tes documents », et
  // l'onglet Apparence, réduit à deux listes déroulantes, ne pesait plus un onglet.
  await win.click('#set-tabs button[data-tab=documents]');
  await win.waitForSelector('#p-marque');
  if (!(await win.isVisible('#p-marque'))) throw new Error('« Image de marque » n\'est pas dans l\'onglet Documents');
  j.ok('les couleurs et le logo sont rangés avec les documents'); 

  // « Annuler », collé à « Enregistrer », jetait sans un mot — et laissait l'aperçu en place.
  await win.click('#cancel-set');
  await win.waitForSelector('#modal-root #ok');
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => !document.querySelector('#modal-root #ok'));
  if (await win.evaluate(() => document.body.classList.contains('dark'))) {
    throw new Error('renoncer doit défaire l\'aperçu : l\'application reste habillée d\'un réglage refusé');
  }
  j.ok('« Abandonner » demande, et défait l\'aperçu');

  // Un lien qui promet un réglage précis doit l'amener sous les yeux, pas en haut d'une pile.
  await win.evaluate(() => { location.hash = '#/dashboard'; });
  await win.waitForSelector('#view');
  await win.evaluate(() => { document.querySelector('#update-pill').click(); });
  await win.waitForSelector('#p-maj.flash');
  j.ok('le lien des mises à jour désigne son panneau');

  if (bac.length) { console.error('ERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  await app.close(); console.log('\n>>> RÉGLAGES ET GESTES BLOQUÉS : OK'); process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
