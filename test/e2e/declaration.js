// SkanFact Cabinet 9.6.0 — la déclaration du mois, dans l'application RÉELLE.
//
// Ce que ce parcours prouve et qu'aucun test pur ne peut prouver : qu'une case dont la règle n'est
// pas connue s'affiche « — » avec sa raison et non « 0,000 » — c'est-à-dire qu'on ne recopie pas un
// zéro inventé sur un formulaire fiscal —, que chaque chiffre s'ouvre sur les pièces qui le font, et
// que les deux pense-bêtes se pointent ET se dé-pointent.
const { playwright, RACINE, ELECTRON, montant, ongletCompta, ongletComptaPresent } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'declaration');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-decl-'));
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
    if (await win.$('#w-name')) await win.fill('#w-name', 'Cabinet Déclaration');
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
    if (await ongletComptaPresent(win, 'declaration')) {
      throw new Error('l\'onglet Déclaration s\'affiche alors que le dossier n\'a pas encore de livre');
    }
    await win.click('#lv-relire');
    await win.waitForSelector('.modal-bg', { timeout: 30000 });
    await win.click('.modal-bg .btn-primary');
    await attendre(600);
  }
  // 10.12.0 (U-06) — les écrans du livre sont rangés en groupes : on attend que le livre soit là
  // (le sélecteur de groupes n'existe qu'avec un livre), puis on trouve l'écran par ses groupes.
  await win.waitForSelector('#c-groupes', { timeout: 25000 });
  if (!(await ongletComptaPresent(win, 'declaration'))) throw new Error('le livre est ouvert et l\'écran « Déclaration » reste introuvable');
  ok('livre ouvert, et l\'onglet Déclaration est là');

  // ---------------------------------------------------------------- 2. les cases
  étape('L\'écran s\'ouvre sur le DERNIER mois saisi, et dit ce qu\'il ne fera jamais');
  await ongletCompta(win, 'declaration');
  await win.waitForSelector('#dc-mois', { timeout: 15000 });
  const mois = await win.evaluate(() => document.querySelector('#dc-mois').value);
  const L0 = await livre();
  const dernier = L0.ecritures.map(e => e.date).sort().pop().slice(0, 7);
  if (mois !== dernier) throw new Error(`le mois proposé devrait être le dernier saisi (${dernier}), vu ${mois}`);
  const promesse = await win.evaluate(() => (document.querySelector('#c-livres .info-box') || {}).textContent || '');
  if (!/ne dépose rien/.test(promesse)) throw new Error('l\'écran doit dire que l\'application ne dépose rien');
  await shot('01-declaration');
  ok('mois proposé ' + mois + ', et la limite est écrite à l\'écran');

  // ------------------------------------------- 3. une case inconnue vaut « — », jamais « 0,000 »
  étape('Une case dont la règle n\'est pas connue affiche « — » et sa raison');
  const inconnues = await win.$$eval('#c-livres tbody tr', trs => trs
    .filter(tr => /TFP|FOPROLOS|TCL|Acomptes/.test(tr.cells[0].textContent))
    .map(tr => ({ nom: tr.cells[0].textContent.trim(), montant: tr.cells[1].textContent.trim(), raison: tr.cells[2].textContent.trim() })));
  if (inconnues.length !== 4) throw new Error('les quatre cases à vérifier devraient être là, vu ' + inconnues.length);
  inconnues.forEach(c => {
    if (c.montant !== '—') throw new Error(`${c.nom} affiche « ${c.montant} » : un zéro se recopierait sur le formulaire`);
    if (!c.raison) throw new Error(`${c.nom} ne dit pas POURQUOI elle est vide`);
  });
  ok('quatre cases « — », chacune avec sa raison');

  // ------------------------------------------------------ 4. un chiffre s'ouvre sur ses pièces
  étape('Un chiffre s\'ouvre sur les écritures qui le font');
  const aOuvrir = await win.$('[data-cases]');
  if (!aOuvrir) throw new Error('aucune case traçable : un chiffre qu\'on ne peut pas ouvrir se croit ou ne se croit pas');
  const collectee = await win.evaluate(() => {
    const tr = [...document.querySelectorAll('#c-livres tbody tr')].find(x => /TVA collectée/.test(x.cells[0].textContent));
    return tr ? tr.cells[1].textContent.trim() : '';
  });
  await aOuvrir.click();
  await win.waitForFunction(() => /les pièces/.test((document.querySelector('#c-livres') || {}).textContent || ''), { timeout: 8000 });
  const pieces = await win.$$eval('#dc-pieces tbody tr', trs => trs.length);
  if (!pieces) throw new Error('le panneau des pièces est vide');
  await shot('02-pieces');
  ok(`TVA collectée ${collectee} → ${pieces} pièce(s) montrée(s)`);

  // ---------------------------------------------------------------- 5. préparer
  étape('Préparer : la déclaration entre dans le livre');
  await win.click('#dc-preparer');
  await win.waitForFunction(() => /préparée/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 10000 });
  await attendre(600);
  let L = await livre();
  const d = (L.declarations || []).find(x => x.periode === mois);
  if (!d) throw new Error('la déclaration n\'est pas sur le disque');
  if (d.cases.tfp.montant !== null) throw new Error('une case inconnue doit être enregistrée à null, jamais à 0');
  const attendu = montant(collectee);
  if (Math.abs(d.cases.tvaCollectee.montant - attendu) > 0.001) {
    throw new Error(`l'écran affiche ${collectee} et le disque ${d.cases.tvaCollectee.montant}`);
  }
  ok('déclaration enregistrée, l\'écran et le disque disent la même chose');

  // ------------------------------------------ 6. un mois DÉJÀ déclaré par le client
  // Le jeu d'exemple porte les livres d'un client à jour : sa propre écriture de déclaration est
  // déjà là, avec SON libellé (« TVA-2026-03 »). L'application la reconnaît à sa FORME — elle
  // touche le compte à décaisser ET un compte de TVA — et refuse d'en passer une seconde.
  étape('Un mois déjà déclaré par le client : le bouton s\'éteint, et dit pourquoi');
  const dejaLa = await win.evaluate(() => {
    const b = document.querySelector('#dc-ecriture');
    return { off: b.disabled, why: b.title };
  });
  if (!dejaLa.off) throw new Error('le client a déjà passé son écriture : le bouton doit être éteint');
  if (!/deux fois/.test(dejaLa.why)) throw new Error('un bouton éteint dit POURQUOI : ' + dejaLa.why);
  // Et malgré cette écriture qui SOLDE la TVA du mois, la collectée affichée n'est pas zéro.
  if (montant(collectee) === 0) {
    throw new Error('un mois plein paraît vide : l\'écriture de déclaration a été comptée dans ce qu\'elle déclare');
  }
  ok('bouton éteint avec sa raison, et la collectée reste ' + collectee);

  // ------------------------------------------ 7. un mois NON déclaré : l'écriture se passe
  étape('Un mois non déclaré : l\'écriture arrive en BROUILLARD, au dernier jour');
  // On saisit une vente dans un mois libre de l'exercice, par le pont — c'est le DÉCOR du test, pas
  // ce qu'il éprouve ; ce qu'il éprouve, c'est l'écran de déclaration.
  const moisLibre = await win.evaluate(async () => {
    const id = decodeURIComponent((location.hash.split('/')[2] || ''));
    const a = document.querySelector('#lv-annee').value;
    const r = await window.cabinet.livre(id, a);
    const pris = new Set((r.livre.ecritures || []).map(e => e.date.slice(0, 7)));
    const m = [...Array(12)].map((_, i) => a + '-' + String(i + 1).padStart(2, '0')).find(x => !pris.has(x));
    if (!m) return '';
    const ec = {
      journal: 'VT', date: m + '-10', piece: 'FAC-E2E-DECL', libelle: 'Vente de test',
      lignes: [
        { compte: '411', libelle: 'Client', debit: 1190, credit: 0 },
        { compte: '706', libelle: 'Vente', debit: 0, credit: 1000 },
        { compte: '4367', libelle: 'TVA collectée', debit: 0, credit: 190 }
      ]
    };
    const s2 = await window.cabinet.saisir(id, a, ec);
    await window.cabinet.valider(id, a, s2.id);
    return m;
  });
  if (!moisLibre) throw new Error('aucun mois libre dans l\'exercice : le parcours ne peut pas prouver ce chemin');
  await win.selectOption('#dc-mois', moisLibre);
  // Le bouton reste éteint tant que la déclaration n'est pas préparée — préparer vient d'abord,
  // et c'est l'ordre que l'écran impose.
  await win.waitForFunction(m => document.querySelector('#dc-mois') && document.querySelector('#dc-mois').value === m, moisLibre, { timeout: 15000 });
  if (!(await win.evaluate(() => document.querySelector('#dc-ecriture').disabled))) {
    throw new Error('on ne passe pas l\'écriture d\'une déclaration qu\'on n\'a pas préparée');
  }
  await win.click('#dc-preparer');
  await win.waitForFunction(() => /préparée/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 10000 });
  await win.waitForFunction(() => { const b2 = document.querySelector('#dc-ecriture'); return b2 && !b2.disabled; }, { timeout: 10000 });
  const avant = (await livre()).ecritures.length;
  await win.click('#dc-ecriture');
  await win.waitForFunction(() => /brouillard/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 10000 });
  await attendre(600);
  L = await livre();
  if (L.ecritures.length !== avant + 1) throw new Error('aucune écriture créée');
  const ecr = L.ecritures.find(e => e.piece === 'DECL-' + moisLibre);
  if (!ecr) throw new Error('l\'écriture de déclaration est introuvable');
  if (ecr.statut !== 'brouillard') throw new Error('elle doit arriver en brouillard : c\'est le comptable qui valide');
  if (!ecr.date.startsWith(moisLibre)) throw new Error('elle doit tomber dans le mois déclaré : ' + ecr.date);
  const somme = ecr.lignes.reduce((s2, l) => s2 + l.debit - l.credit, 0);
  if (Math.abs(somme) > 0.001) throw new Error('l\'écriture de déclaration ne s\'équilibre pas : ' + somme);
  await shot('03-ecriture');
  ok('brouillard équilibré au ' + ecr.date + ', sur ' + moisLibre);

  // ---------------------------------------------------------------- 7. les deux pense-bêtes
  étape('« Déposée » puis « payée » — dans cet ordre, et les deux se défont');
  const payeAvant = await win.evaluate(() => {
    const b = document.querySelector('#dc-payee');
    return { off: b.disabled, why: b.title };
  });
  if (!payeAvant.off) throw new Error('on ne paie pas ce qu\'on n\'a pas déposé : le bouton doit être éteint');
  if (!/déposé/.test(payeAvant.why)) throw new Error('et il doit dire pourquoi : ' + payeAvant.why);
  await win.click('#dc-deposee');
  await win.waitForFunction(() => /pense-bête/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 10000 });
  await attendre(500);
  let etat = await win.evaluate(() => (document.querySelector('#c-livres .filters .badge') || {}).textContent || '');
  if (etat.trim() !== 'déclaré') throw new Error('l\'état du mois devrait passer à « déclaré », vu « ' + etat + ' »');
  await win.click('#dc-payee');
  await win.waitForFunction(() => /payée/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 10000 });
  await attendre(500);
  etat = await win.evaluate(() => (document.querySelector('#c-livres .filters .badge') || {}).textContent || '');
  if (etat.trim() !== 'payé') throw new Error('l\'état devrait passer à « payé », vu « ' + etat + ' »');
  await shot('04-pointe');
  // Et tout se défait : ce qui se coche par erreur se décoche (7.12.0).
  await win.click('#dc-payee');
  await win.waitForFunction(() => /annulé/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 10000 });
  await attendre(500);
  L = await livre();
  const d2 = L.declarations.find(x => x.periode === moisLibre);
  if (d2.payee.le) throw new Error('le pointage « payée » ne s\'est pas défait');
  if (!d2.deposee.le) throw new Error('et défaire « payée » ne doit pas défaire « déposée »');
  ok('pointé dans l\'ordre, dé-pointé sans emporter l\'autre');

  // ---------------------------------------------------------------- 8. refaire une déposée
  étape('Une déclaration déposée ne se refait pas en silence');
  await win.click('#dc-preparer');
  await win.waitForFunction(() => /déposée|Dé-pointe/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 10000 });
  const refus = await win.evaluate(() => document.querySelector('#toast').textContent);
  if (!/Dé-pointe/.test(refus)) throw new Error('le refus doit nommer le geste qui débloque : ' + refus);
  ok('refus nommé : ' + refus.slice(0, 80));

  console.log('\n' + '─'.repeat(60));
  if (errors.length) { console.log('erreurs JS :'); errors.forEach(e => console.log('  ' + e)); }
  console.log('erreurs JS : ' + errors.length);
  console.log('captures : ' + OUT);
  await app.close();
  if (errors.length) process.exit(1);
  console.log('\n' + pas + ' étapes — la déclaration prépare, et ne dépose rien.');
})().catch(async e => { console.error(e); process.exit(1); });
