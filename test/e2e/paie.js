// SkanFact Cabinet 10.3.0 — la paie d'un client, dans l'application RÉELLE.
//
// Ce que ce parcours prouve et qu'aucun test pur ne peut prouver : qu'un comptable peut déclarer un
// salarié, établir son bulletin en voyant le net se calculer pendant qu'il tape, passer l'écriture
// de paie du mois, se voir REFUSER de la repasser, et lire la déclaration CNSS du trimestre — en
// partant d'un dossier qui n'a jamais eu de paie.
//
// Le geste qui compte : un dossier HORS SkanFact. C'est lui qui paie le cabinet, et c'est très
// exactement celui pour lequel rien n'existait avant cette version.
const { playwright, RACINE, ELECTRON } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'paie');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-paie-'));
const userData = path.join(dir, 'cab');
const errors = [];
let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };

(async () => {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const attendre = (ms = 350) => win.waitForTimeout(ms);
  const shot = async nom => { await attendre(250); await win.screenshot({ path: path.join(OUT, nom + '.png') }); };
  await win.setViewportSize({ width: 1440, height: 900 });
  const livre = () => win.evaluate(async () => {
    const id = decodeURIComponent((location.hash.split('/')[2] || ''));
    const a = document.querySelector('#lv-annee');
    const r = await window.cabinet.livre(id, a ? a.value : String(new Date().getFullYear()));
    return r.livre;
  });

  // ---------------------------------------------------------------- 1. ouvrir et poser un livre
  étape('Ouvrir le cabinet, charger l\'exemple, ouvrir le livre d\'un client');
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', 'mot-de-passe-cabinet');
  await win.fill('#lock-pw2', 'mot-de-passe-cabinet');
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  for (let g = 0; g < 14 && await win.$('#setup'); g++) {
    if (await win.$('#w-name')) await win.fill('#w-name', 'Cabinet Paie');
    if (await win.$('#w-skip')) await win.click('#w-skip'); else if (await win.$('#w-next')) await win.click('#w-next');
    await attendre(300);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'), { timeout: 15000 });
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#demo-on', { timeout: 8000 });
  await win.click('#demo-on');
  await win.waitForSelector('tr[data-id]', { timeout: 20000 });
  const cible = await win.evaluate(() => [...document.querySelectorAll('tr[data-id]')][0].dataset.id);
  await win.evaluate(id => { location.hash = '#/dossier/' + encodeURIComponent(id) + '/comptabilite'; }, cible);
  await win.waitForSelector('#c-livres', { timeout: 15000 });
  await win.waitForFunction(() => {
    const e = document.querySelector('#c-livres');
    return e && !e.textContent.includes('Lecture des paquets');
  }, { timeout: 30000 });
  if (await win.$('#lv-relire')) {
    if (await win.$('#c-tabs button[data-tab="paie"]')) {
      throw new Error('l\'onglet Paie s\'affiche alors que le dossier n\'a pas encore de livre');
    }
    await win.click('#lv-relire');
    await win.waitForSelector('.modal-bg', { timeout: 30000 });
    await win.click('.modal-bg .btn-primary');
    await attendre(600);
  }
  await win.waitForFunction(() => {
    const t = document.querySelector('#c-tabs');
    return t && t.textContent.includes('Paie');
  }, { timeout: 25000 });
  ok('livre ouvert, et l\'onglet Paie est là');


  // ---------------------------------------------------------------- 2. un dossier sans paie le DIT
  étape('Un dossier sans salarié ne prétend rien : il dit par où commencer');
  await win.click('#c-tabs button[data-tab="paie"]');
  await win.waitForSelector('#pa-mois', { timeout: 15000 });
  await shot('01-paie-vide');
  const vide = await win.evaluate(() => ({
    texte: document.querySelector('#view').textContent,
    bulletinEteint: !!(document.querySelector('#pa-bulletin') || {}).disabled,
    ecrireEteint: !!(document.querySelector('#pa-ecrire') || {}).disabled,
    titre: (document.querySelector('#pa-bulletin') || {}).title || ''
  }));
  if (!/Aucun salarié déclaré/.test(vide.texte)) throw new Error('l\'état vide des salariés ne dit rien');
  if (!vide.bulletinEteint) throw new Error('on ne peut pas établir un bulletin sans salarié : le bouton doit être éteint');
  if (!/salarié/i.test(vide.titre)) throw new Error('un bouton éteint doit dire POURQUOI : ' + vide.titre);
  if (!vide.ecrireEteint) throw new Error('rien à écrire : le bouton de l\'écriture doit être éteint');
  ok('« Aucun salarié déclaré », et les deux boutons éteints DISENT pourquoi');

  // ---------------------------------------------------------------- 3. déclarer un salarié
  étape('Déclarer un salarié — le nom et le brut suffisent, le CNSS se signale sans bloquer');
  await win.click('#pa-salarie');
  await win.waitForSelector('#sf', { timeout: 8000 });
  await win.fill('#sf [name=nom]', 'Mohamed Trabelsi');
  await win.fill('#sf [name=poste]', 'Boulanger');
  await win.fill('#sf [name=brut]', '1200');
  await win.fill('#sf [name=embauche]', '2024-03-01');
  await win.check('#sf [name=chefDeFamille]');
  await win.fill('#sf [name=enfants]', '2');
  await shot('02-salarie');
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => !document.querySelector('#sf'), { timeout: 10000 });
  await attendre(500);
  const apres = await win.evaluate(() => ({
    texte: document.querySelector('#view').textContent,
    bulletinOk: !(document.querySelector('#pa-bulletin') || {}).disabled
  }));
  if (!/Mohamed Trabelsi/.test(apres.texte)) throw new Error('le salarié n\'apparaît pas dans la liste');
  if (!/à renseigner/.test(apres.texte)) throw new Error('le numéro CNSS manquant doit se SIGNALER, sans bloquer');
  if (!apres.bulletinOk) throw new Error('avec un salarié, « + Bulletin » doit s\'allumer');
  ok('salarié déclaré, CNSS signalé sans bloquer, « + Bulletin » allumé');

  // ---------------------------------------------------------------- 4. le bulletin, net en direct
  étape('Établir un bulletin — le net se recalcule PENDANT la frappe');
  await win.click('#pa-bulletin');
  await win.waitForSelector('#bf', { timeout: 8000 });
  const net1 = await win.evaluate(() => document.querySelector('#bf-apercu').textContent);
  await win.fill('#bf [name=primeAmount]', '200');
  await win.fill('#bf [name=primeLabel]', 'Prime de rendement');
  await attendre(250);
  const net2 = await win.evaluate(() => document.querySelector('#bf-apercu').textContent);
  if (net1 === net2) throw new Error('le net n\'a pas bougé après une prime de 200 : l\'aperçu ne calcule rien');
  if (!/Net à payer/.test(net2)) throw new Error('l\'aperçu doit NOMMER le net : ' + net2);
  await shot('03-bulletin');
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => !document.querySelector('#bf'), { timeout: 10000 });
  await attendre(500);
  const table = await win.evaluate(() => document.querySelector('#view').textContent);
  if (!/Coût employeur/.test(table)) throw new Error('la table des bulletins doit montrer le coût employeur');
  if (!/brouillon/.test(table)) throw new Error('un bulletin sans écriture doit le DIRE');
  ok('bulletin établi, net recalculé en direct, coût employeur affiché');

  // ---------------------------------------------------------------- 5. l'écriture de paie
  étape('Passer l\'écriture de paie, puis se voir refuser de la repasser');
  const avant = await livre();
  const ecrAvant = (avant.ecritures || []).length;
  await win.click('#pa-ecrire');
  await win.waitForFunction(() => /brouillard/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 12000 });
  await attendre(600);
  const apresEcr = await livre();
  const neuves = (apresEcr.ecritures || []).filter(e => e.journal === 'PAIE');
  if ((apresEcr.ecritures || []).length !== ecrAvant + 1) throw new Error('l\'écriture de paie n\'a pas été écrite');
  const paie = neuves[neuves.length - 1];
  if (paie.statut !== 'brouillard') throw new Error('une écriture de paie arrive en BROUILLARD, elle se relit avant d\'être validée');
  if (paie.numero) throw new Error('un brouillard ne porte aucun numéro');
  const deb = paie.lignes.reduce((s, l) => s + l.debit, 0);
  const cre = paie.lignes.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(deb - cre) > 0.0005) throw new Error(`l'écriture de paie n'est pas équilibrée : ${deb} / ${cre}`);
  if (paie.lignes.some(l => l.debit < 0 || l.credit < 0)) throw new Error('aucun débit ni crédit négatif (règle 6.3.0)');
  if (!/^\d{4}-\d{2}-(28|29|30|31)$/.test(paie.date)) throw new Error('une écriture de paie tombe au dernier jour du mois : ' + paie.date);
  // Le bulletin retient l'écriture : sans ce report, le bouton se rallumerait et la paie serait
  // comptée deux fois (défaut de la dotation, 9.7.0).
  const bul = (apresEcr.bulletins || [])[0];
  if (!bul.ecritureId) throw new Error('le bulletin ne retient pas l\'écriture qui le porte');
  await attendre(400);
  const bouton = await win.evaluate(() => ({
    eteint: !!(document.querySelector('#pa-ecrire') || {}).disabled,
    titre: (document.querySelector('#pa-ecrire') || {}).title || '',
    texte: document.querySelector('#view').textContent
  }));
  if (!bouton.eteint) throw new Error('la paie du mois est passée : le bouton doit s\'éteindre');
  if (!/deux fois/.test(bouton.titre)) throw new Error('le bouton éteint doit dire POURQUOI : ' + bouton.titre);
  if (!/écrite/.test(bouton.texte)) throw new Error('le bulletin doit afficher qu\'il est écrit');
  await shot('04-ecriture');
  ok(`écriture ${paie.piece} en brouillard, équilibrée à ${deb.toFixed(3)}, et le bouton s'éteint en disant pourquoi`);

  // ---------------------------------------------------------------- 6. un bulletin écrit est figé
  étape('Un bulletin dont l\'écriture est passée ne se modifie plus');
  // Une action UNIQUE devient un vrai bouton qui la NOMME, pas un menu (règle 7.29.0) : c'est
  // justement la preuve que « Modifier » et « Supprimer » ont disparu. Le parcours accepte les deux
  // formes — en connaître une seule accuserait du code juste au premier bulletin non écrit.
  await win.click(`[data-rowmenu="PAIE:${bul.id}"]`);
  await attendre(350);
  const actions = await win.evaluate(id => {
    const b = document.querySelector(`[data-rowmenu="PAIE:${id}"]`);
    const menu = document.querySelector('.row-menu');
    return menu ? [...menu.querySelectorAll('button')].map(x => x.textContent.trim())
      : [(b || {}).textContent ? b.textContent.trim() : ''];
  }, bul.id);
  if (!actions.some(a => /détail du calcul/i.test(a))) throw new Error('le détail du calcul doit rester ouvert : ' + actions.join(' | '));
  if (actions.some(a => /Modifier le bulletin/i.test(a))) throw new Error('un bulletin écrit ne doit plus proposer « Modifier »');
  if (actions.some(a => /Supprimer/i.test(a))) throw new Error('ni « Supprimer »');
  // Et le détail s'OUVRE : un chiffre qu'on ne peut pas ouvrir se croit ou ne se croit pas.
  if (await win.$('.row-menu')) {
    const det = await win.evaluateHandle(() => [...document.querySelectorAll('.row-menu button')].find(b => /détail du calcul/i.test(b.textContent)));
    await det.asElement().click();
  }
  await win.waitForSelector('.modal-bg', { timeout: 8000 });
  const detail = await win.evaluate(() => document.querySelector('.modal-bg').textContent);
  ['Brut du mois', 'CNSS part salarié', 'IRPP', 'Net à payer', 'Coût employeur'].forEach(m => {
    if (!detail.includes(m)) throw new Error(`le détail du bulletin ne montre pas « ${m} »`);
  });
  if (!/À VÉRIFIER/.test(detail)) throw new Error('le détail doit rappeler que les barèmes ne font pas foi');
  await shot('05-detail');
  await win.click('.modal-bg .btn-primary');
  await attendre(300);
  ok('le calcul s\'ouvre ligne par ligne ; ni « Modifier » ni « Supprimer » sur un bulletin écrit');

  // ---------------------------------------------------------------- 7. la CNSS du trimestre
  étape('La déclaration CNSS du trimestre, et ce qu\'elle refuse de prétendre');
  const cnss = await win.evaluate(() => {
    const t = document.querySelector('#pa-trim');
    return { options: [...t.options].map(o => o.textContent.trim()), texte: document.querySelector('#view').textContent };
  });
  if (cnss.options.length !== 4) throw new Error('quatre trimestres, pas ' + cnss.options.length);
  if (!/Total à verser/.test(cnss.texte)) throw new Error('la déclaration doit porter son total');
  if (!/ne dépose rien/.test(cnss.texte)) throw new Error('l\'écran doit DIRE que SkanFact ne dépose rien (règle 5.2.0)');
  if (!/À VÉRIFIER/.test(cnss.texte)) throw new Error('l\'échéance proposée doit porter son « À VÉRIFIER »');
  if (!/Coût employeur/.test(cnss.texte)) throw new Error('la masse salariale de l\'exercice doit finir sur le coût employeur');
  await shot('06-cnss');
  ok('quatre trimestres, un total, et l\'écran dit ce qu\'il ne fera jamais');

  console.log('\n' + '─'.repeat(60));
  if (errors.length) { console.log('erreurs JS :'); errors.forEach(e => console.log('  ' + e)); }
  console.log('erreurs JS : ' + errors.length);
  console.log('captures : ' + OUT);
  await app.close();
  if (errors.length) process.exit(1);
  console.log('\n' + pas + ' étapes — le Cabinet tient la paie d\'un client qui n\'a pas SkanFact.');
})().catch(async e => { console.error(e); process.exit(1); });
