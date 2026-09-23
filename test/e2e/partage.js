// Partager une entreprise DÉJÀ SAISIE avec un second ordinateur (7.28.0).
//
// Skander : « je viens de faire mon vrai dossier entreprise. Je veux le partager avec mon père,
// comment faire ? Quand je fais "dossier partagé à deux", ça me recrée une autre entreprise, car ça
// me propose d'écrire le nom de l'entreprise — alors que je suis déjà dessus. »
//
// Il avait raison, et c'était pire que ça : le bouton fabriquait un dossier VIDE, et il n'existait
// aucun moyen de rejoindre un dossier posé par l'autre poste. Le travail à deux n'était donc
// utilisable que par quelqu'un qui n'avait encore rien saisi.
//
// Ce parcours fait la boucle en entier, avec DEUX applications et DEUX profils différents :
//
//   1. Poste A saisit une entreprise et un client.
//   2. Poste A partage le dossier : les fichiers arrivent dans l'emplacement commun, et l'ancien
//      emplacement reste intact.
//   3. Poste B — installation neuve — rejoint ce dossier et retrouve l'entreprise ET le client,
//      sans passer par l'assistant de première utilisation.
//   4. Ce que B enregistre, A le voit.
//
//   xvfb-run -a node test/e2e/partage.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

const NOM = 'Maison Ben Amor SUARL';
const MF = '1234567X/A/M/000';

(async () => {
  const j = journal(); const bac = [];
  const commun = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-icloud-'));   // le « iCloud Drive » des deux postes
  const udA = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-posteA-'));
  const udB = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-posteB-'));

  // Le sélecteur de dossier du système ne s'automatise pas : on répond à sa place, dans le processus
  // principal. C'est la seule chose qu'on simule — tout le reste passe par les vrais écrans.
  const repondreAuSelecteur = async (app, dir) => {
    await app.evaluate(async ({ dialog }, d) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] });
    }, dir);
  };
  const assistant = async (win, nom, mf) => {
    await win.waitForSelector('#setup');
    for (let g = 0; g < 15 && await win.$('#setup'); g++) {
      if (await win.$('#sf-form input[name=name]')) {
        await win.fill('#sf-form input[name=name]', nom);
        await win.fill('#sf-form input[name=matricule]', mf);
      }
      if (await win.$('[data-act="conseil"]')) { await win.click('[data-act="conseil"]'); await win.waitForSelector('[data-act="conseil"].sel'); }
      await win.click('#sf-next'); await win.waitForTimeout(120);
    }
    await win.waitForFunction(() => !document.querySelector('#setup'));
  };
  const confirmer = async win => {
    await win.waitForSelector('.modal #ok');
    await win.click('.modal #ok');
  };

  // ---------------------------------------------------------------- 1. poste A
  j.etape('Poste A : une vraie entreprise, avec un client');
  const appA = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${udA}`, RACINE], executablePath: ELECTRON });
  let winA = await appA.firstWindow(); surveiller(winA, 'A', bac);
  await assistant(winA, NOM, MF);
  await winA.evaluate(() => { location.hash = '#/clients'; });
  await winA.waitForTimeout(300);
  await winA.click("#new");
  await winA.waitForSelector('.modal input[name=name]');
  await winA.fill('.modal input[name=name]', 'Client du père');
  await winA.click('.modal .modal-actions .btn-primary');
  await winA.waitForTimeout(400);
  const clientsA = await winA.evaluate(() => document.body.textContent.includes('Client du père'));
  if (!clientsA) throw new Error('le client n\'a pas été enregistré sur le poste A');
  j.ok(`${NOM} + 1 client`);

  // ---------------------------------------------------------------- 2. le partage
  j.etape('Poste A partage le dossier tel quel — sans rien ressaisir');
  await repondreAuSelecteur(appA, commun);
  await winA.evaluate(() => { location.hash = '#/parametres'; });
  await winA.waitForTimeout(400);
  await winA.click('#set-tabs button[data-tab="donnees"]');
  await winA.waitForSelector('#dos-share');
  // Le bouton NOMME le dossier ouvert : c'est ce qui manquait. « + Dossier partagé à deux… »
  // demandait un nom d'entreprise, donc en promettait une nouvelle.
  const libelle = await winA.$eval('#dos-share', b => b.textContent.trim());
  if (/nom de l'entreprise/i.test(libelle)) throw new Error('le bouton demande encore un nom : il crée un dossier vide');
  await winA.click('#dos-share');
  await confirmer(winA);                       // la fenêtre qui explique ce qui va se passer
  // L'application se recharge sur le nouvel emplacement.
  await winA.waitForTimeout(2500);
  winA = await appA.firstWindow(); surveiller(winA, 'A2', bac);
  await winA.waitForFunction(() => !!document.querySelector('#brand-company'), null, { timeout: 15000 });

  const dossiers = fs.readdirSync(commun).filter(n => fs.existsSync(path.join(commun, n, 'skanfact-data.json')));
  if (dossiers.length !== 1) throw new Error(`${dossiers.length} dossier(s) posé(s) dans l'emplacement commun, attendu 1 : ${fs.readdirSync(commun).join(', ')}`);
  const partage = path.join(commun, dossiers[0]);
  const donnees = JSON.parse(fs.readFileSync(path.join(partage, 'skanfact-data.json'), 'utf8'));
  if ((donnees.company || {}).name !== NOM) throw new Error(`le dossier partagé n'a pas l'entreprise : ${(donnees.company || {}).name}`);
  if (!(donnees.clients || []).some(c => c.name === 'Client du père')) throw new Error('le client n\'a pas suivi dans le dossier partagé');
  // L'ancien emplacement reste intact : c'est le filet, comme la reprise de 3.2.0.
  const ancien = path.join(udA, 'dossiers', 'principal', 'skanfact-data.json');
  if (!fs.existsSync(ancien)) throw new Error('l\'ancien emplacement a été vidé : il n\'y a plus de filet');
  j.ok(`posé dans ${dossiers[0]} — entreprise et client transportés, ancienne copie intacte`);

  // ---------------------------------------------------------------- 3. poste B
  j.etape('Poste B, installation neuve : il rejoint, il ne recrée pas');
  const appB = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${udB}`, RACINE], executablePath: ELECTRON });
  let winB = await appB.firstWindow(); surveiller(winB, 'B', bac);
  await winB.waitForSelector('#setup');
  // On passe l'assistant : le second poste n'a rien à saisir, il vient chercher ce qui existe.
  // « Passer » pose une question (7.1.x : il ne jette pas ce qui vient d'être tapé) — il faut donc
  // y répondre, et la fenêtre qui la porte couvre l'assistant.
  await winB.click('#sf-skip');
  await confirmer(winB);
  await winB.waitForFunction(() => !document.querySelector('#setup'), null, { timeout: 10000 });
  // On désigne le dossier PARENT exprès : c'est l'erreur qu'on fait la première fois, et
  // l'application doit la rattraper tant qu'il n'y a pas d'ambiguïté.
  await repondreAuSelecteur(appB, commun);
  await winB.evaluate(() => { location.hash = '#/parametres'; });
  await winB.waitForTimeout(400);
  await winB.click('#set-tabs button[data-tab="donnees"]');
  await winB.waitForSelector('#dos-join');
  await winB.click('#dos-join');
  await confirmer(winB);
  await winB.waitForTimeout(2500);
  winB = await appB.firstWindow(); surveiller(winB, 'B2', bac);
  await winB.waitForFunction(() => !!document.querySelector('#brand-company'), null, { timeout: 15000 });
  if (await winB.$('#setup')) throw new Error('le poste B retombe sur l\'assistant de première utilisation');
  const nomB = await winB.$eval('#brand-company', e => e.textContent.trim());
  if (nomB !== NOM) throw new Error(`le poste B affiche « ${nomB} » au lieu de « ${NOM} »`);
  await winB.evaluate(() => { location.hash = '#/clients'; });
  await winB.waitForTimeout(400);
  if (!await winB.evaluate(() => document.body.textContent.includes('Client du père')))
    throw new Error('le poste B ne voit pas le client saisi par le poste A');
  j.ok(`le poste B ouvre « ${nomB} » et voit son client, sans assistant`);

  // ---------------------------------------------------------------- 4. l'aller-retour
  j.etape('Ce que B enregistre, A le voit');
  await winB.click("#new");
  await winB.waitForSelector('.modal input[name=name]');
  await winB.fill('.modal input[name=name]', 'Client du fils');
  await winB.click('.modal .modal-actions .btn-primary');
  await winB.waitForTimeout(800);
  await fermer(appB);

  // D'abord le FICHIER : s'il ne contient rien, c'est l'enregistrement de B qui est en cause, pas
  // la relecture de A. Séparer les deux moitiés avant de chercher (règle 6.7.2).
  const surDisque = JSON.parse(fs.readFileSync(path.join(partage, 'skanfact-data.json'), 'utf8'));
  if (!(surDisque.clients || []).some(c => c.name === 'Client du fils'))
    throw new Error('le poste B a enregistré ailleurs que dans le dossier partagé');
  // Puis l'écran de A, qui relit le dossier partagé au rechargement.
  await winA.reload();
  await winA.waitForFunction(() => !!document.querySelector('#brand-company'), null, { timeout: 20000 });
  await winA.evaluate(() => { location.hash = '#/clients'; });
  await winA.waitForTimeout(800);
  const vuParA = await winA.evaluate(() => document.body.textContent.includes('Client du fils'));
  if (!vuParA) throw new Error('le poste A ne voit pas ce que le poste B a enregistré : le dossier n\'est pas vraiment partagé');
  j.ok('les deux postes travaillent sur le même dossier');

  await fermer(appA);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — une entreprise déjà saisie se partage, et le second poste la rejoint.`);
})().catch(e => { console.error(e); process.exit(1); });
