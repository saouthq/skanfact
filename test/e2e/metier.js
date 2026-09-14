// Le métier (7.22.0).
//
// Quatre choses qui ne se prouvent que dans l'application réelle :
//
//   1. Quinze métiers sont proposés, et plus aucun n'annonce un taux de TVA deviné.
//   2. Le RÉGIME FISCAL se demande dans l'assistant, s'enregistre, et se relit dans les Paramètres.
//   3. Un non-assujetti voit le taux de TVA grisé et la mention légale annoncée à l'écran.
//   4. Un métier encaissé sur place ne se voit pas réclamer de RIB.
//
// C'est ce parcours qui a attrapé un `C.pl(...)` inexistant : l'écran « Ton activité » restait
// blanc, sans une ligne en console, et `node --check` ne voyait rien.
//
//   xvfb-run -a node test/e2e/metier.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-metier-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(320); };

  // -------------------------------------------------- 1. quinze métiers, sans taux deviné
  j.etape('L\'assistant propose quinze métiers, et n\'annonce plus de TVA devinée');
  await win.waitForSelector('#setup');
  // On avance jusqu'à l'écran du métier, en le reconnaissant à ce qu'il CONTIENT (jamais à son
  // numéro : un écran de plus ferait passer le test « à côté » sans un mot).
  for (let g = 0; g < 15 && !(await win.$('[data-act]')); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Café des Jasmins SUARL');
      await win.fill('#sf-form input[name=matricule]', '5566778B/A/M/000');
    }
    await win.click('#sf-next'); await win.waitForTimeout(140);
  }
  await win.waitForSelector('[data-act]');
  const metiers = await win.evaluate(() => [...document.querySelectorAll('[data-act]')].map(b => ({
    id: b.dataset.act, texte: b.textContent.replace(/\s+/g, ' ').trim()
  })));
  if (metiers.length !== 16) throw new Error(`${metiers.length} métiers affichés au lieu de 16 (15 + « Autre »)`);
  const devine = metiers.filter(m => /TVA\s*\d|TVA\s*undefined/.test(m.texte));
  if (devine.length) throw new Error(`un métier annonce encore un taux de TVA : « ${devine[0].texte} »`);
  const honoraires = metiers.filter(m => /note d'honoraires/i.test(m.texte));
  if (!honoraires.length) throw new Error('aucun métier ne s\'annonce en note d\'honoraires');
  j.ok(`${metiers.length - 1} métiers + « Autre » — ${honoraires.length} en note d'honoraires, aucun taux deviné`);

  // -------------------------------------------------- 1 bis. le métier propose son régime (7.25.0)
  // En remplaçant le taux de TVA porté par le métier par un régime fiscal, la 7.22.0 avait perdu ce
  // que le métier savait : la santé est exonérée. L'application proposait 19 % de TVA à un
  // kinésithérapeute qui venait de cliquer « Santé et paramédical ».
  j.etape('Choisir « Santé » propose l\'exonération, sans l\'imposer');
  if (!await win.$('#sf-regime')) throw new Error('l\'assistant ne demande pas le régime fiscal');
  await win.click('[data-act="sante"]');
  await win.waitForSelector('[data-act="sante"].sel');
  const propose = await win.$eval('#sf-regime', e => e.value);
  if (propose !== 'exonere') throw new Error(`« Santé et paramédical » propose « ${propose} » au lieu de l'exonération`);
  // Et un métier ordinaire ne traîne pas la proposition du précédent.
  await win.click('[data-act="batiment"]');
  await win.waitForSelector('[data-act="batiment"].sel');
  const apres = await win.$eval('#sf-regime', e => e.value);
  if (apres === 'exonere') throw new Error('la proposition de la santé est restée collée à un autre métier');
  j.ok('proposée pour la santé, retirée pour le bâtiment');

  // -------------------------------------------------- 2. le régime se demande et s'enregistre
  j.etape('Le régime fiscal se demande dans l\'assistant et survit au changement de métier');
  await win.selectOption('#sf-regime', 'forfaitaire');
  const aideAvant = await win.$eval('#sf-regime-aide', e => e.textContent.trim());
  if (!/ne factures pas de TVA/i.test(aideAvant)) throw new Error(`l'explication ne suit pas le régime : « ${aideAvant} »`);
  // On choisit le métier APRÈS le régime : l'écran se redessine, et le régime ne doit pas repartir.
  await win.click('[data-act="restauration"]');
  await win.waitForSelector('[data-act="restauration"].sel');
  const garde = await win.$eval('#sf-regime', e => e.value);
  if (garde !== 'forfaitaire') throw new Error(`choisir un métier a effacé le régime : « ${garde} »`);
  j.ok('régime « forfaitaire » posé, puis conservé malgré le redessin');

  // On termine l'assistant.
  for (let g = 0; g < 15 && await win.$('#setup'); g++) { await win.click('#sf-next'); await win.waitForTimeout(140); }
  await win.waitForFunction(() => !document.querySelector('#setup'));

  const enregistre = await win.evaluate(() => window.__data && window.__data.company.taxRegime);
  if (enregistre !== 'forfaitaire') throw new Error(`le régime enregistré est « ${enregistre} »`);
  j.ok('régime écrit dans les données de la société');

  // -------------------------------------------------- 3. les Paramètres le disent
  j.etape('Les Paramètres relisent le régime, grisent la TVA et annoncent la mention');
  await aller('#/parametres');
  await win.waitForSelector('#set-tabs');
  // Le régime a quitté « Règles de facturation » en 7.30.0 : ce n'est pas une règle de document,
  // c'est ce que l'entreprise EST. Il vit sous son identité, dans « Mon entreprise ».
  await win.click('#set-tabs button[data-tab="societe"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="societe"]'); return p && !p.hidden; });
  const etat = await win.evaluate(() => {
    const p = document.querySelector('[data-pane="societe"]');
    const reg = p.querySelector('select[name=taxRegime]');
    const tva = p.querySelector('select[name=defaultVatRate]');
    return { regime: reg && reg.value, tvaGrisee: tva && tva.disabled, texte: p.textContent.replace(/\s+/g, ' ') };
  });
  if (etat.regime !== 'forfaitaire') throw new Error(`les Paramètres affichent « ${etat.regime} »`);
  if (!etat.tvaGrisee) throw new Error('le taux de TVA reste modifiable alors que l\'entreprise n\'est pas assujettie');
  if (!/TVA non applicable/.test(etat.texte)) throw new Error('la mention légale n\'est annoncée nulle part');
  j.ok('régime relu, taux grisé, mention annoncée');

  // -------------------------------------------------- 4. le RIB n'est pas réclamé
  j.etape('Un métier encaissé sur place ne se voit pas réclamer de RIB');
  const manques = await win.evaluate(() => window.SkanCore.companyGaps(window.__data.company));
  if (manques.includes('le RIB')) throw new Error('le RIB est réclamé à un restaurant : ' + manques.join(', '));
  // Et la règle inverse tient toujours : un prestataire payé par virement, lui, le voit manquer.
  const pourUnConseil = await win.evaluate(() =>
    window.SkanCore.companyGaps({ ...window.__data.company, activity: 'conseil', rib: '' }));
  if (!pourUnConseil.includes('le RIB')) throw new Error('le RIB n\'est plus réclamé à personne : la règle est morte');
  j.ok(`aucun RIB réclamé au restaurant — et toujours réclamé à un prestataire (${pourUnConseil.join(', ')})`);

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — le métier décide de ce qu'on montre, le régime de ce qu'on facture.`);
})().catch(e => { console.error(e); process.exit(1); });
