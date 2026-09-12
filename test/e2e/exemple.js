// Charger le jeu d'exemple, et en revenir (7.0.0).
//
// Pourquoi ce test existe : jusqu'à la 7.0.0, rien à l'écran ne distinguait treize mois d'activité
// fictive de vraies données, et il n'y avait aucun chemin de retour depuis l'interface — l'app
// entreprise n'avait même pas de fonction de restauration, alors que celle du cabinet en a une depuis
// la 6.8.0. Deux conséquences, qui se produisent dans cet ordre chez quelqu'un qui découvre :
//
//   1. il charge l'exemple avant d'avoir rempli sa fiche société → son entreprise s'appelle
//      « DÉMO — Société de services SUARL », avec un matricule et un RIB inventés ;
//   2. il clique « Tout effacer » pour se mettre au travail → l'effacement ne vidait que sept listes
//      sur trente ET conservait la fiche société. Sa première vraie facture partait donc au nom
//      d'une société qui n'existe pas, avec un compte bancaire où l'argent n'arrive jamais.
//
//   xvfb-run -a node test/e2e/exemple.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path');
const fs = require('fs');
const os = require('os');

(async () => {
  const j = journal();
  const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-exemple-'));
  const fichier = () => path.join(userData, 'dossiers', 'principal', 'skanfact-data.json');
  const lu = () => JSON.parse(fs.readFileSync(fichier(), 'utf8'));

  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE],
    executablePath: ELECTRON, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  });
  const win = await app.firstWindow();
  surveiller(win, '', bac);

  const versDonnees = async () => {
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await win.waitForSelector('#set-tabs');
    await win.click('#set-tabs button[data-tab="donnees"]');
    await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  };

  j.etape('Une vraie entreprise, avec une vraie pièce');
  await win.waitForSelector('#setup');
  // On reconnaît chaque écran à son contenu : l'assistant a gagné un septième écran en 7.2.0, et
  // une boucle comptée s'arrêterait avant la fin sans rien dire.
  for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Ben Salah SUARL');
      await win.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
    }
    if (await win.$('[data-act="batiment"]')) { await win.click('[data-act="batiment"]'); await win.waitForSelector('[data-act="batiment"].sel'); }
    await win.click('#sf-next');
    await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  // Un client bien à lui : c'est lui qu'on devra retrouver à la sortie de l'exemple.
  await win.evaluate(() => { location.hash = '#/clients'; });
  await win.waitForSelector('#view .page-head #new');
  await win.click('#view .page-head #new');
  await win.waitForSelector('#modal-root input[name=name]');
  await win.fill('#modal-root input[name=name]', 'Clinique du Lac');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
  j.ok('« Atelier Ben Salah SUARL » · 1 client');

  j.etape('On charge l\'exemple : l\'application le DIT, sur chaque page');
  await versDonnees();
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForFunction(() => location.hash === '#/dashboard');
  await win.waitForSelector('.demo-banner');
  for (const page of ['devis', 'clients', 'compta', 'tresorerie']) {
    await win.evaluate(p => { location.hash = '#/' + p; }, page);
    await win.waitForSelector('#view h1');
    if (!(await win.$('.demo-banner'))) throw new Error(`page ${page} : aucun bandeau ne dit que ce sont des données d'exemple`);
  }
  // Sa fiche société n'a pas été touchée : elle était remplie.
  const pendant = lu();
  if (pendant.company.name !== 'Atelier Ben Salah SUARL') throw new Error('l\'exemple a écrasé sa raison sociale : ' + pendant.company.name);
  if (pendant.company.demo) throw new Error('son identité à lui ne doit pas être marquée comme empruntée');
  if (!pendant.demo) throw new Error('les données ne se déclarent pas comme un jeu d\'exemple');
  j.ok('bandeau présent sur quatre pages · sa société intacte');

  j.etape('On en revient, et ses données reviennent avec');
  await win.evaluate(() => { location.hash = '#/dashboard'; });
  await win.waitForSelector('#demo-out');
  await win.click('#demo-out');
  await win.waitForSelector('#modal-root #ok');
  const question = await win.textContent('#modal-root .modal');
  if (!/1 client/.test(question)) throw new Error('la question doit annoncer ce qu\'on va retrouver : ' + question.slice(0, 200));
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => !document.querySelector('.demo-banner'));
  const apres = lu();
  if (apres.demo) throw new Error('les données restaurées se croient encore un exemple');
  if (apres.clients.length !== 1 || apres.clients[0].name !== 'Clinique du Lac') {
    throw new Error('son client n\'est pas revenu : ' + JSON.stringify(apres.clients.map(c => c.name)));
  }
  if (apres.documents.length) throw new Error('des pièces de l\'exemple ont survécu : ' + apres.documents.length);
  j.ok('« Clinique du Lac » est revenu, les treize mois fictifs sont partis');

  j.etape('Le cas qui fait mal : l\'exemple chargé AVANT d\'avoir rempli sa fiche');
  // On efface tout pour repartir d'une installation neuve, puis on charge l'exemple : l'app emprunte
  // alors une identité, et c'est cette identité qui ne doit pas survivre à « Tout effacer ».
  await versDonnees();
  await win.click('#wipe-data');
  await win.waitForSelector('#modal-root input[name=w]');
  await win.fill('#modal-root input[name=w]', 'EFFACER');
  await win.click('#modal-root #ok');
  await win.waitForTimeout(400);
  // La raison sociale est la sienne : l'effacement la garde.
  if (lu().company.name !== 'Atelier Ben Salah SUARL') throw new Error('on ne jette pas l\'identité de quelqu\'un en effaçant des factures');
  // On la vide à la main pour simuler l'installation neuve.
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="societe"]');   // on arrive sur l'onglet « données »
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="societe"]'); return p && !p.hidden; });
  await win.fill('#pf input[name=name]', '');
  await win.click('#save');
  await win.waitForTimeout(400);

  await versDonnees();
  await win.click('#load-demo');
  const ok2 = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok2) await ok2.click();
  await win.waitForFunction(() => location.hash === '#/dashboard');
  const empruntee = lu();
  if (!/DÉMO/.test(empruntee.company.name)) throw new Error('l\'exemple devrait fournir une société : ' + empruntee.company.name);
  if (!empruntee.company.demo) throw new Error('une identité empruntée doit être marquée');
  j.ok('identité empruntée : « ' + empruntee.company.name +' »');

  j.etape('« Tout effacer » emporte alors la fausse identité');
  await versDonnees();
  await win.click('#wipe-data');
  await win.waitForSelector('#modal-root input[name=w]');
  const avertissement = await win.textContent('#modal-root .modal');
  if (!/La fiche société part également/.test(avertissement)) {
    throw new Error('la fenêtre doit prévenir que la fiche société part aussi : ' + avertissement.slice(0, 260));
  }
  await win.fill('#modal-root input[name=w]', 'EFFACER');
  await win.click('#modal-root #ok');
  await win.waitForTimeout(600);
  const net = lu();
  for (const [champ, valeur] of [['name', net.company.name], ['matricule', net.company.matricule], ['rib', net.company.rib]]) {
    if (valeur) throw new Error(`« ${champ} » de l'exemple a survécu à l'effacement : « ${valeur} » — la première vraie facture partirait avec.`);
  }
  // Et tout le reste aussi : c'est le défaut qui laissait de faux fournisseurs et de faux salariés.
  for (const liste of ['suppliers', 'purchases', 'employees', 'payslips', 'assets', 'serials', 'accounts', 'movements', 'projects', 'leaves', 'advances']) {
    if ((net[liste] || []).length) throw new Error(`« ${liste} » survit à « Tout effacer » : ${net[liste].length} élément(s) de l'exemple restent`);
  }
  if (net.demo) throw new Error('les données effacées se croient encore un exemple');
  j.ok('société, fournisseurs, salariés, immobilisations, comptes : tout est parti');

  j.etape('Revenir en arrière : la restauration existait, aucun écran ne l\'appelait');
  // `backups:peek` et `backups:restore` vivent dans main.js depuis la 7.0.0, et seule la sortie du
  // jeu d'exemple s'en servait. Le seul chemin proposé à quelqu'un qui vient de perdre quelque chose
  // était « Importer et choisis un fichier de ce dossier » : naviguer dans un dossier caché, y
  // reconnaître un nom, et remplacer tout sans savoir ce qu'on perd.
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForSelector('#backup-list');
  await win.waitForTimeout(300);
  if (!(await win.$('#backup-list [data-restore]'))) {
    throw new Error('aucune sauvegarde restaurable à l\'écran : la seule issue reste « Importer », dans un dossier caché');
  }
  // On ajoute un client, on restaure, il doit disparaître — et la fenêtre doit DIRE ce qu'on perd.
  const avantNom = await win.evaluate(() => window.__data.clients.length);
  await win.evaluate(() => { location.hash = '#/clients'; });
  await win.waitForSelector('#view .page-head');
  await win.click('#view .page-head .btn-primary');
  await win.waitForSelector('#modal-root input[name=name]');
  await win.fill('#modal-root input[name=name]', 'Client de trop');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);

  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForSelector('#backup-list [data-restore]');
  await win.click('#backup-list [data-restore]');
  await win.waitForSelector('#modal-root .modal');
  const q2 = await win.textContent('#modal-root .modal');
  if (!/Aujourd'hui tu as/.test(q2)) throw new Error('la question doit dire ce qu\'on va perdre : ' + q2.slice(0, 200));
  if (!/se défait/.test(q2)) throw new Error('elle doit dire que le geste est réversible : ' + q2.slice(0, 200));
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForTimeout(900);
  const restes = await win.evaluate(() => window.__data.clients.map(c => c.name));
  if (restes.includes('Client de trop')) throw new Error('la restauration n\'a rien remis : ' + restes.join(', '));
  // À ce point du test, « Tout effacer » vient de passer : la sauvegarde la plus récente est le filet
  // pris juste avant. La restaurer défait donc l'effacement — ce qui est précisément ce qu'on veut
  // pouvoir faire le jour où on a cliqué trop vite.
  j.ok(`l'effacement est défait : ${restes.length} client(s) sont revenus`);

  if (bac.length) { console.error('\nERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  await app.close();
  console.log('\n>>> JEU D\'EXEMPLE OK');
  process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
