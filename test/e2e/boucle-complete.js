// La boucle complète, dans deux VRAIES applications Electron :
//   cabinet : créer le cabinet → exporter le fichier d'appairage
//   entreprise : importer l'appairage → clôturer un mois → fabriquer le paquet
//   cabinet : importer le paquet → le dossier apparaît, les mois se lisent, une pièce s'ouvre
// C'est le seul test qui prouve que le plan tient debout de bout en bout.
const { playwright, RACINE, ELECTRON, VERSION } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const root = RACINE;
const elec = ELECTRON;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-loop-'));
const cabData = path.join(tmp, 'cab'); const entData = path.join(tmp, 'ent');
const pairFile = path.join(tmp, 'cabinet.skanpair');
const packFile = path.join(tmp, 'paquet.skanpack');
const PW = 'motdepasse-cabinet';
const shots = process.env.SHOTS || '';
let shotN = 0;
async function shot(win, name) {
  if (!shots) return;
  fs.mkdirSync(shots, { recursive: true });
  await win.screenshot({ path: path.join(shots, `${String(++shotN).padStart(2, '0')}-${name}.png`) });
}
const errors = [];

function watch(win, tag) {
  win.on('pageerror', e => errors.push(`${tag} PAGEERROR: ${e.message}`));
  win.on('console', m => { if (m.type() === 'error') errors.push(`${tag} CONSOLE: ${m.text()}`); });
}

async function launchCabinet() {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${cabData}`, path.join(root, 'src', 'cabinet', 'main.js')],
    executablePath: elec, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  });
  const win = await app.firstWindow();
  watch(win, 'CAB');
  await win.waitForSelector('#lock-form');
  return { app, win };
}

(async () => {
  // ---------- 1. le cabinet se crée ----------
  let { app, win } = await launchCabinet();
  const premiere = await win.isVisible('#lock-pw2');
  await shot(win, 'ouverture');
  await win.fill('#lock-pw', PW);
  await win.fill('#lock-pw2', PW);
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  console.log(`1. cabinet créé (mot de passe demandé deux fois : ${premiere})`);

  // depuis la 6.8.0, un assistant s'ouvre au premier lancement : on le traverse
  await win.waitForSelector('#setup', { timeout: 10000 });
  await win.click('#w-next');
  await win.waitForSelector('#w-name');
  await win.fill('#w-name', 'Cabinet Ben Salah');
  await win.fill('#w-email', 'contact@bensalah.tn');
  await win.click('#w-next');
  await win.waitForSelector('#w-clients');
  await win.click('#w-skip');
  await win.waitForSelector('#w-rec');
  await win.click('#w-skip');
  await win.waitForSelector('#w-pair');
  await win.click('#w-next');
  await win.waitForTimeout(600);

  // réglages : nom du cabinet, puis fichier d'appairage
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#c-name');
  await win.click('#c-save');
  await win.waitForTimeout(300);
  await shot(win, 'reglages');
  const fp = (await win.textContent('.fingerprint')).trim();
  console.log(`2. empreinte du cabinet : ${fp}`);

  await app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }); }, pairFile);
  await win.click('#c-pair');
  await win.waitForSelector('#modal-root .modal', { timeout: 8000 });
  await win.click('#modal-root #no');
  const pair = JSON.parse(fs.readFileSync(pairFile, 'utf8'));
  const pairOk = pair.fingerprint === fp && !!pair.publicKey && !pair.privateKey && pair.name === 'Cabinet Ben Salah';
  console.log(`3. appairage exporté : clé publique seule = ${pairOk}`);
  await app.close();

  // ---------- 2. l'entreprise appaire, clôture et fabrique ----------
  const ent = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${entData}`, root],
    executablePath: elec, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  });
  const ew = await ent.firstWindow();
  watch(ew, 'ENT');
  await ew.waitForSelector('#setup');
  await ew.click('#sf-next'); await ew.waitForSelector('#sf-form input[name=name]');
  await ew.fill('#sf-form input[name=name]', 'Ébénisterie Test SUARL');
  await ew.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
  await ew.fill('#sf-form textarea[name=address]', 'Rue des Oliviers\n2000 Tunis');
  await ew.click('#sf-next'); await ew.waitForSelector('[data-act="batiment"]');
  await ew.click('[data-act="batiment"]'); await ew.click('#sf-next');
  await ew.waitForSelector('#sf-form input[name=paymentTermsDays]'); await ew.click('#sf-next');
  await ew.waitForSelector('#sf-form input[name=rib]'); await ew.click('#sf-next');
  await ew.waitForSelector('#sf-ext'); await ew.click('#sf-next');
  await ew.waitForFunction(() => !document.querySelector('#setup'));

  await ew.evaluate(() => { location.hash = '#/parametres'; });
  await ew.waitForSelector('#set-tabs');
  await ew.evaluate(() => { const b = [...document.querySelectorAll('#set-tabs button')].find(x => /données|sécurité/i.test(x.textContent)); if (b) b.click(); });
  await ew.waitForTimeout(400);
  await ew.click('#load-demo'); await ew.waitForTimeout(400);
  const ok0 = await ew.$('#modal-root #ok'); if (ok0) await ok0.click();
  await ew.waitForFunction(() => location.hash === '#/dashboard');
  console.log('4. entreprise installée, démo chargée');

  // appairage du cabinet
  await ent.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] }); }, pairFile);
  await ew.evaluate(() => { location.hash = '#/parametres'; });
  await ew.waitForSelector('#set-tabs');
  await ew.evaluate(() => { const b = [...document.querySelectorAll('#set-tabs button')].find(x => /cabinet/i.test(x.textContent)); if (b) b.click(); });
  await ew.waitForSelector('#cab-import');
  await ew.click('#cab-import');
  await ew.waitForFunction(() => !!(window.__data.company.cabinet || {}).publicKey, null, { timeout: 15000 });
  const vu = await ew.evaluate(() => window.__data.company.cabinet);
  console.log(`5. l'entreprise voit « ${vu.name} » · empreinte identique : ${vu.fingerprint === fp}`);

  // un mois qui contient des pièces, puis on le CLÔTURE pour que le paquet soit définitif
  await ew.evaluate(() => { location.hash = '#/compta'; });
  await ew.waitForSelector('#c-tabs');
  await ew.evaluate(() => { const b = [...document.querySelectorAll('#c-tabs button')].find(x => /cabinet/i.test(x.textContent)); if (b) b.click(); });
  await ew.waitForSelector('#cab-month');
  const choisi = await ew.evaluate(() => {
    const sel = document.querySelector('#cab-month'), C = window.SkanCore, d = window.__data;
    for (const o of [...sel.options].reverse()) {
      const per = C.packPeriod(Number(o.value.slice(0, 4)), Number(o.value.slice(5, 7)));
      const p = C.packPlan(d, d.company, per, {});
      if (p.totaux.pieces > 0) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return o.value; }
    }
    return null;
  });
  if (!choisi) throw new Error('aucun mois avec des pièces');
  console.log(`6. mois retenu : ${choisi}`);

  await ent.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }); }, packFile);
  await ew.click('#cab-build');
  const conf = await ew.waitForSelector('#modal-root #ok', { timeout: 4000 }).catch(() => null);
  if (conf) await conf.click();
  await ew.waitForFunction(() => (window.__data.packs || []).length > 0, null, { timeout: 180000 });
  const taille = fs.statSync(packFile).size;
  console.log(`7. paquet fabriqué : ${(taille / 1024).toFixed(0)} Ko`);
  await ent.close();

  // ---------- 3. le cabinet reçoit ----------
  ({ app, win } = await launchCabinet());
  await win.fill('#lock-pw', PW);
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  // mauvais mot de passe d'abord ? on vérifie au moins que l'état est bien retrouvé
  const nomRetrouve = await win.textContent('#brand-cab');
  console.log(`8. cabinet rouvert : « ${nomRetrouve.trim()} »`);

  await app.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] }); }, packFile);
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#imp');
  await shot(win, 'dossiers-vide');
  await win.click('#imp');
  await win.waitForSelector('#modal-root .imp-list', { timeout: 30000 });
  await shot(win, 'import-rapport');
  const rapportImport = (await win.textContent('#modal-root .imp-list')).replace(/\s+/g, ' ').trim();
  console.log(`9. rapport d'import : ${rapportImport.slice(0, 190)}`);
  await win.click('#modal-root #ok');

  await win.waitForSelector('table.list tr[data-id]');
  const ligne = await win.evaluate(() => {
    const tr = document.querySelector('table.list tr[data-id]');
    return [...tr.children].map(td => td.textContent.trim());
  });
  console.log(`10. dossier listé : ${JSON.stringify(ligne)}`);

  await shot(win, 'dossiers');
  await win.click('table.list tr[data-id]');
  await win.waitForSelector('.mgrid');
  const mois = await win.evaluate(() => [...document.querySelectorAll('.mcell')].map(c => c.className.replace('mcell ', '') + ':' + c.querySelector('.m-lab').textContent));
  console.log(`11. mois du dossier : ${mois.join(' · ')}`);

  await shot(win, 'fiche-dossier');
  // ouvrir le paquet et lister ce qu'il contient
  await win.click('[data-open]');
  await win.waitForSelector('#modal-root tr[data-i]', { timeout: 20000 });
  await shot(win, 'contenu-paquet');
  const fichiers = await win.evaluate(() => [...document.querySelectorAll('#modal-root tr[data-i] td:first-child')].map(td => td.textContent));
  console.log(`12. ${fichiers.length} fichiers lisibles sans mot de passe : ${fichiers.slice(0, 4).join(', ')}…`);
  await win.click('#modal-root #ok');

  // la relance
  await win.evaluate(() => { location.hash = '#/relances'; });
  await win.waitForTimeout(400);
  await shot(win, 'relances');
  const relance = await win.evaluate(() => {
    const b = document.querySelector('[data-rel]');
    if (!b) return null;
    b.click();
    return new Promise(r => setTimeout(() => r({
      sujet: (document.querySelector('#r-sub') || {}).value,
      corps: ((document.querySelector('#r-body') || {}).value || '').slice(0, 90)
    }), 300));
  });
  console.log(`13. relance préparée : ${relance ? relance.sujet : 'aucune (tout est à jour)'}`);

  await shot(win, 'relance-mail');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(300);

  // ---------- 13 bis. accuser réception, sur un VRAI paquet ----------
  // Cette fenêtre n'était parcourue par AUCUN test, et c'est comme ça qu'une ReferenceError dans son
  // `onMount` est passée : elle s'affichait, et plus aucun bouton n'était branché. Rien en console,
  // rien qui plante — juste des boutons morts. C'est aussi le dernier maillon de la boucle : le
  // client envoie son mois, et il doit savoir que c'est arrivé.
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForTimeout(500);
  const ids = await win.evaluate(() => [...document.querySelectorAll('table.list tr[data-id]')].map(r => r.dataset.id));
  let boutonAcc = null;
  for (const id of ids) {
    await win.evaluate(i => { location.hash = '#/dossier/' + encodeURIComponent(i); }, id);
    await win.waitForTimeout(500);
    boutonAcc = await win.$('[data-acc]');
    if (boutonAcc) break;
  }
  if (!boutonAcc) throw new Error('aucun bouton « accuser réception » sur la fiche du client qui vient d\'envoyer');
  await boutonAcc.click();
  await win.waitForSelector('#modal-root .modal-bg', { timeout: 8000 });
  const accBranche = await win.evaluate(() =>
    ['#no', '#copy', '#ok'].filter(id => {
      const b = document.querySelector('#modal-root .modal-bg:last-child ' + id);
      return b && typeof b.onclick === 'function';
    }));
  if (accBranche.length !== 3) {
    throw new Error('les boutons de l\'accusé de réception ne sont pas branchés : ' + JSON.stringify(accBranche));
  }
  const accTexte = (await win.textContent('#modal-root .modal-bg:last-child')).replace(/\s+/g, ' ');
  if (!/bien reçu/i.test(accTexte)) throw new Error('le message ne ressemble pas à un accusé de réception : ' + accTexte.slice(0, 120));
  console.log(`13 bis. accusé de réception : 3 boutons branchés · « ${(accTexte.match(/Bien reçu[^«]{0,60}/i) || ['?'])[0].trim()} »`);
  await shot(win, 'accuse-reception');
  // Un message retouché ne se jette pas en silence.
  await win.fill('#modal-root .modal-bg:last-child #a-body', 'Bonjour, bien reçu — je vous rappelle demain.');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(500);
  const q = await win.textContent('#modal-root .modal-bg:last-child h2');
  if (!/abandonner/i.test(q || '')) throw new Error('un message retouché est jeté sans un mot : ' + q);
  await win.click('#modal-root .modal-bg:last-child .btn-danger');
  await win.waitForTimeout(400);
  await win.keyboard.press('Escape');
  await win.waitForTimeout(300);

  // ---------- 14. les écritures regroupées, sur le VRAI paquet ----------
  const csvFile = path.join(tmp, 'ecritures.csv');
  await app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }); }, csvFile);
  await win.evaluate(() => { location.hash = '#/ecritures'; });
  await win.waitForSelector('#e-go', { timeout: 8000 });
  await shot(win, 'ecritures');
  await win.click('#e-go');
  await win.waitForSelector('#modal-root .modal', { timeout: 20000 });
  const rapportEcr = (await win.textContent('#modal-root .modal')).replace(/\s+/g, ' ').slice(0, 90);
  const csv = fs.readFileSync(csvFile, 'utf8');
  const tete = csv.replace(/^﻿/, '').split('\r\n')[0];
  const nbLignes = csv.trim().split('\r\n').length - 1;
  const csvOk = tete.startsWith('Client;Matricule;Mois;') && nbLignes > 0 && csv.includes('Ébénisterie Test SUARL');
  console.log(`14. écritures regroupées : ${nbLignes} lignes · entête « ${tete.slice(0, 60)} » · ok = ${csvOk}`);
  console.log(`    rapport : ${rapportEcr}`);
  await shot(win, 'ecritures-rapport');
  await win.keyboard.press('Escape');

  await win.evaluate(() => { location.hash = '#/aide'; });
  await win.waitForTimeout(500); await shot(win, 'aide');
  const okAll = pairOk && vu.fingerprint === fp && ligne.length >= 7 && fichiers.length > 5 && csvOk && !errors.length;
  console.log('\nerreurs JS : ' + errors.length);
  errors.slice(0, 6).forEach(e => console.log('  - ' + e));
  console.log(okAll ? '>>> BOUCLE COMPLÈTE OK' : '>>> ÉCHEC');
  await app.close().catch(() => {});
  process.exit(okAll ? 0 : 1);
})().catch(e => { console.error('ÉCHEC :', e.stack || e.message); process.exit(2); });
