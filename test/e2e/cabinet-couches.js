// SkanFact Cabinet — l'ordre des couches et le clavier, dans l'application RÉELLE.
//
// Pourquoi ce test existe séparément : ce sont les défauts qui ne laissent AUCUNE trace. Rien ne
// plante, rien n'apparaît en console, et `npm test` ne peut que relire la source. Il faut ouvrir
// vraiment deux fenêtres l'une sur l'autre, appuyer vraiment sur Échap, et regarder ce qui reste.
//
// Règle qu'on s'applique ici : le test passe par les VRAIS écrans et les VRAIS boutons. Rejouer
// `modal()` à l'intérieur d'un `evaluate()` produirait un test qui ne peut pas échouer — le défaut
// exact qu'on vient de corriger dans trois tests de `npm test` (constats I1, I2 et I3).
//
// Les trois défauts qu'il attrape (constats G6 et G7 du second audit) :
//   1. Échap fermait TOUTES les fenêtres empilées d'un coup. Le comptable remplissait la fiche d'un
//      client, cliquait « Supprimer… » par erreur, faisait Échap pour annuler la question — et
//      perdait aussi les champs qu'il venait de taper.
//   2. Entrée ne validait rien, et le focus se posait sur « Annuler ».
//   3. Cmd+K ouvrait la palette DERRIÈRE la fenêtre (z-index 60 contre 400) et lui volait le
//      clavier : la frappe suivante partait dans un champ invisible.
const { fermer, playwright, RACINE, ELECTRON } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'couches');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-couches-'));
const errors = [];
let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };

(async () => {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'cab')}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const attendre = (ms = 350) => win.waitForTimeout(ms);
  const couches = () => win.evaluate(() => document.querySelectorAll('#modal-root .modal-bg').length);
  // Le bouton principal de la fenêtre du dessus, jamais d'une autre couche.
  const dessus = sel => `#modal-root .modal-bg:last-child ${sel}`;

  // ---- 1. mise en place : un cabinet, et un dossier créé à la main
  étape('Mise en place');
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', 'mot-de-passe-cabinet');
  await win.fill('#lock-pw2', 'mot-de-passe-cabinet');
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await win.waitForSelector('#setup', { timeout: 10000 });
  // On traverse l'assistant par ses vrais boutons : il en faut un dossier pour la suite.
  for (let i = 0; i < 8 && await win.$('#setup'); i++) {
    const suivant = await win.$('#w-next');
    if (!suivant) break;
    await suivant.click();
    await attendre(200);
  }
  await win.evaluate(() => { const s = document.querySelector('#setup'); if (s) s.remove(); });
  await attendre();
  ok('cabinet créé');

  // Un dossier créé à la main, par le vrai formulaire.
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await attendre();
  await win.click('#new-d');
  await win.waitForSelector('#modal-root .modal-bg', { timeout: 5000 });
  await win.fill(dessus('#f-name'), 'Boulangerie Essai');
  await win.fill(dessus('#f-mat'), '9988776Z/A/M/000');
  await win.click(dessus('.modal-actions .btn-primary'));
  await attendre(600);
  if (await couches() !== 0) throw new Error('le formulaire de création ne s\'est pas fermé');
  ok('dossier créé par le vrai formulaire');

  // ---- 2. Entrée valide, et le focus ne se pose pas sur « Annuler »
  étape('Le focus et la touche Entrée dans une vraie fenêtre');
  // La création nous a emmenés sur la fiche du nouveau dossier : on revient à la liste.
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await attendre();
  await win.click('#new-d');
  await win.waitForSelector('#modal-root .modal-bg', { timeout: 5000 });
  const focus = await win.evaluate(() => {
    const a = document.activeElement;
    return a ? { tag: a.tagName, type: a.type || '', texte: (a.textContent || '').trim().slice(0, 24) } : null;
  });
  if (!focus) throw new Error('aucun élément n\'a le focus à l\'ouverture');
  if (focus.tag === 'BUTTON' && /annuler/i.test(focus.texte)) {
    throw new Error('le focus se pose sur « Annuler » : Entrée referme la fenêtre sans rien faire');
  }
  if (focus.tag !== 'INPUT' && focus.tag !== 'TEXTAREA' && focus.tag !== 'SELECT') {
    throw new Error('le focus ne va pas sur un champ de saisie mais sur ' + focus.tag + ' « ' + focus.texte + ' »');
  }
  ok('le focus va sur le premier champ (' + focus.tag + '), pas sur « Annuler »');

  // Entrée depuis le champ doit valider, pas annuler.
  await win.fill(dessus('#f-name'), 'Épicerie Entrée');
  await win.keyboard.press('Enter');
  await attendre(700);
  if (await couches() !== 0) throw new Error('Entrée n\'a pas validé la fenêtre');
  const cree = await win.evaluate(() => document.body.textContent.includes('Épicerie Entrée'));
  if (!cree) throw new Error('Entrée a fermé la fenêtre sans enregistrer : c\'est « Annuler » qui a répondu');
  ok('Entrée valide le bouton principal et le dossier est enregistré');
  await win.screenshot({ path: path.join(OUT, '01-entree-valide.png') });

  // ---- 3. Échap ne ferme QUE la fenêtre du dessus
  // Le scénario exact du constat : la fiche d'un client, un « Supprimer… » cliqué par erreur,
  // et Échap pour revenir en arrière.
  étape('Échap sur la fiche d\'un client, après un « Supprimer… » cliqué par erreur');
  // Entrée vient de nous emmener sur la fiche du dossier créé : « Modifier la fiche » est là.
  await win.waitForSelector('#edit', { timeout: 10000 });
  await win.click('#edit');
  await attendre(500);
  if (await couches() !== 1) throw new Error('impossible d\'ouvrir la fiche d\'un dossier');

  // On tape quelque chose qu'on ne veut surtout pas perdre.
  const PRECIEUX = 'Interlocuteur : Mme Ben Salah, 12 rue du Lac';
  await win.fill(dessus('#f-note'), PRECIEUX);
  await win.screenshot({ path: path.join(OUT, '02-fiche-remplie.png') });

  // Le clic malheureux.
  await win.click(dessus('#del'));
  await win.waitForTimeout(600);
  if (await couches() !== 2) throw new Error('la question de suppression ne s\'est pas empilée sur la fiche');
  ok('deux fenêtres empilées : la fiche, et la question « Supprimer ce dossier ? »');
  await win.screenshot({ path: path.join(OUT, '03-deux-fenetres.png') });

  // Échap : c'est le geste de quelqu'un qui veut annuler LA QUESTION.
  await win.keyboard.press('Escape');
  await attendre(500);
  const restantes = await couches();
  if (restantes === 0) throw new Error('Échap a fermé la question ET la fiche : la saisie est perdue');
  if (restantes !== 1) throw new Error('après Échap il reste ' + restantes + ' fenêtres');
  const garde = await win.inputValue(dessus('#f-note'));
  if (garde !== PRECIEUX) throw new Error('la fiche a perdu sa saisie : « ' + garde + ' »');
  ok('la question se ferme, la fiche reste, la saisie est intacte');
  await win.screenshot({ path: path.join(OUT, '04-fiche-intacte.png') });

  // ---- 4. Cmd+K pendant qu'une fenêtre est ouverte
  étape('Cmd+K pendant que la fiche est ouverte');
  await win.click(dessus('#f-note'));
  await win.keyboard.press('Control+k');
  await attendre(500);
  if (await win.$('#palette-root')) throw new Error('la palette s\'est ouverte DERRIÈRE la fenêtre');
  ok('la palette refuse de s\'ouvrir par-dessus une fenêtre');
  // Et le clavier est resté dans la fiche : c'est ça, le vrai dégât.
  await win.keyboard.type(' — appeler lundi');
  const apres = await win.inputValue(dessus('#f-note'));
  if (!apres.includes('appeler lundi')) {
    const actif = await win.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
    throw new Error('la frappe est partie ailleurs (focus : ' + actif + ') — la fiche contient « ' + apres + ' »');
  }
  ok('la frappe reste dans la fiche : « …' + apres.slice(-20) + ' »');

  // ---- 5. Échap sur une fiche modifiée demande avant de jeter
  étape('Échap sur une fiche remplie : on prévient avant de jeter');
  await win.keyboard.press('Escape');
  await attendre(500);
  if (await couches() !== 2) throw new Error('Échap a jeté la saisie sans rien demander');
  const question = await win.textContent('#modal-root .modal-bg:last-child h2');
  if (!/abandonner/i.test(question || '')) throw new Error('la question posée n\'est pas la bonne : ' + question);
  ok('la question est posée : « ' + question.trim() + ' »');
  await win.screenshot({ path: path.join(OUT, '05-abandonner.png') });

  // « Annuler » (ou Échap) garde la saisie…
  await win.keyboard.press('Escape');
  await attendre(500);
  if (await couches() !== 1) throw new Error('refuser d\'abandonner a quand même fermé la fiche');
  if (await win.inputValue(dessus('#f-note')) !== apres) throw new Error('la saisie a bougé');
  ok('refuser d\'abandonner garde la fiche et sa saisie');

  // … et « Abandonner » ferme pour de bon.
  await win.keyboard.press('Escape');
  await attendre(500);
  await win.click('#modal-root .modal-bg:last-child .btn-danger');
  await attendre(600);
  if (await couches() !== 0) throw new Error('« Abandonner » n\'a pas fermé la fiche');
  ok('« Abandonner » ferme la fiche');

  // ---- 6. L'AUTRE sens : une fenêtre qui s'ouvre par-dessus une palette déjà ouverte.
  // La palette écoute le clavier en phase de CAPTURE : elle passe devant la fenêtre quoi qu'il
  // arrive, et lui vole Échap, Entrée et les flèches. Le garde de `openPalette` ne sert à rien ici,
  // puisque ce n'est pas la palette qui s'ouvre en second.
  étape('Une fenêtre s\'ouvre pendant que la palette est ouverte');
  await win.keyboard.press('Control+k');
  await attendre(500);
  if (!await win.$('#palette-root')) throw new Error('la palette ne s\'ouvre pas');
  // La palette couvre la page : on ne peut PAS cliquer derrière. Le vrai déclencheur est donc
  // ailleurs — le menu natif (Cmd+N), un paquet double-cliqué dans le Finder, un fichier déposé.
  // C'est exactement pour ça que le garde de `openPalette` ne suffisait pas : ce n'est pas la
  // palette qui s'ouvre en second.
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.webContents.send('menu:action', 'new-dossier');
  });
  await win.waitForSelector('#modal-root .modal-bg', { timeout: 8000 });
  await attendre(400);
  if (await win.$('#palette-root')) throw new Error('la palette est restée ouverte SOUS la fenêtre : elle lui vole le clavier');
  ok('la palette se referme quand une fenêtre s\'ouvre');
  // Et le clavier est bien à la fenêtre.
  await win.fill(dessus('#f-name'), 'Preuve clavier');
  if (await win.inputValue(dessus('#f-name')) !== 'Preuve clavier') throw new Error('la frappe n\'atteint pas la fenêtre');
  await win.keyboard.press('Escape');
  await attendre(500);
  // La saisie déclenche la question d'abandon : on répond « Abandonner ».
  if (await couches() === 2) { await win.click('#modal-root .modal-bg:last-child .btn-danger'); await attendre(400); }
  await attendre(300);

  // Et sans fenêtre ouverte, la palette s'ouvre toujours : on ne l'a pas cassée.
  étape('La palette, une fois la voie libre');
  await win.keyboard.press('Control+k');
  await attendre(500);
  if (!await win.$('#palette-root')) throw new Error('la palette ne s\'ouvre plus du tout');
  ok('sans fenêtre ouverte, la palette s\'ouvre normalement');
  await win.keyboard.press('Escape');
  await attendre(300);

  console.log('\n' + '─'.repeat(60));
  console.log('erreurs JS : ' + errors.length);
  errors.forEach(e => console.log('  ' + e));
  console.log('captures : ' + OUT);
  await fermer(app);
  if (errors.length) process.exit(1);
  console.log('\n>>> COUCHES ET CLAVIER : OK');
})().catch(e => {
  console.error('\n✗ ' + e.message);
  process.exit(1);
});
