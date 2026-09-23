// Photographie et MESURE les pages de réglages des DEUX applications.
//
// Ce n'est pas un test qui échoue : c'est un INSTRUMENT. Les défauts d'organisation d'une page de
// réglages ne se voient dans aucune console et aucun test de calcul — ils se voient dans des
// chiffres (combien de champs par onglet, combien d'écrans de haut, combien de bulles) et sur des
// captures. Il rend `dist-e2e/parametres/mesures.json` et une image par onglet, en clair, en
// sombre et à 1280 px.
//
// Écrit pour l'audit des Paramètres, gardé pour pouvoir MESURER À NOUVEAU après la refonte : un
// instrument qu'on doit réécrire pour s'en servir n'en est pas un (leçon des e2e perdus).
//
//   xvfb-run -a npm run e2e:parametres
const { fermer, playwright, RACINE, ELECTRON, dossierCaptures } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const dossier = dossierCaptures('parametres');
  const mesures = { entreprise: {}, cabinet: {} };
  const bac = [];

  // ---------------------------------------------------------------- app entreprise
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-param-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${ud}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow();
  win.on('pageerror', e => bac.push('ENT ' + e.message));
  win.on('console', m => { if (m.type() === 'error') bac.push('ENT ' + m.text()); });
  await win.setViewportSize({ width: 1440, height: 900 });
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Réglages SUARL');
      await win.fill('#sf-form input[name=matricule]', '5555555A/A/M/000');
    }
    if (await win.$('[data-act="conseil"]')) { await win.click('[data-act="conseil"]'); await win.waitForSelector('[data-act="conseil"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForSelector('#load-demo'); await win.click('#load-demo');
  await win.waitForSelector('.modal #ok'); await win.click('.modal #ok');
  await win.waitForTimeout(1800);

  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  const ids = await win.evaluate(() => [...document.querySelectorAll('#set-tabs button')].map(b => ({ id: b.dataset.tab, label: b.textContent.trim() })));
  mesures.entreprise.onglets = ids;

  for (const { id, label } of ids) {
    await win.click(`#set-tabs button[data-tab="${id}"]`);
    await win.waitForTimeout(500);
    // Un onglet peut s'écrire en DEUX sections depuis la 7.30.0 (ce qui vit dans le formulaire et
    // ce qui vit dehors) : on additionne, sinon la mesure ne voit que la première moitié.
    const m = await win.evaluate(t => {
      const panes = [...document.querySelectorAll(`section[data-pane="${t}"]`)];
      const vue = document.querySelector('#view');
      if (!panes.length) return { absent: true };
      const tous = sel => panes.flatMap(p => [...p.querySelectorAll(sel)]);
      const hauteur = panes.reduce((s, p) => s + p.getBoundingClientRect().height, 0);
      return {
        champs: tous('input:not([type=hidden]), select, textarea').length,
        bulles: tous('button.i').length,
        panneaux: tous('.panel > h2').map(h => h.textContent.replace(/\s+/g, ' ').trim()),
        boutons: tous('button:not(.i)').map(b => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
        sommaire: [...document.querySelectorAll('#set-somm .somm-chip')].map(b => b.textContent.trim()),
        hauteur: Math.round(hauteur),
        ecrans: Math.round(hauteur / vue.clientHeight * 10) / 10
      };
    }, id);
    mesures.entreprise[id] = { label, ...m };
    await win.evaluate(() => { document.querySelector('#view').scrollTop = 0; });
    await win.screenshot({ path: path.join(dossier, `ent-${id}.png`) });
  }
  // La barre d'enregistrement : est-elle visible en bas de page ?
  mesures.entreprise.barre = await win.evaluate(() => {
    const b = document.querySelector('.save-bar, #save-bar, .settings-save');
    if (!b) return 'aucune barre repérée';
    const r = b.getBoundingClientRect();
    return { classe: b.className, fixe: getComputedStyle(b).position, bas: Math.round(r.bottom), hauteurFenetre: window.innerHeight };
  });
  // Le panneau des mises à jour, tel qu'il s'ouvre.
  await win.click('#set-tabs button[data-tab="app"]');
  await win.waitForTimeout(1200);
  mesures.entreprise.maj = await win.evaluate(() => {
    const p = document.querySelector('#p-maj');
    return { texte: p ? p.textContent.replace(/\s+/g, ' ').trim().slice(0, 700) : '(absent)' };
  });
  await win.screenshot({ path: path.join(dossier, 'ent-maj-detail.png') });

  // La recherche : ce qu'elle trouve, et où elle dit que ça se trouve.
  mesures.entreprise.recherche = {};
  for (const mot of ['timbre', 'sauvegarde', 'beta', 'photo', 'rib', 'mot de passe']) {
    await win.fill('#set-q', mot);
    await win.waitForTimeout(250);
    mesures.entreprise.recherche[mot] = await win.evaluate(() =>
      [...document.querySelectorAll('.set-hit')].map(b => b.querySelector('.set-hit-ou').textContent.trim() + ' → ' + b.querySelector('.set-hit-t').textContent.trim()));
  }
  await win.fill('#set-q', 'sauvegarde');
  await win.waitForTimeout(250);
  await win.screenshot({ path: path.join(dossier, 'ent-recherche.png') });
  await win.fill('#set-q', '');
  await win.waitForTimeout(250);
  // Mode sombre, sur l'onglet le plus chargé.
  await win.evaluate(() => document.body.classList.add('dark'));
  await win.click('#set-tabs button[data-tab="societe"]');
  await win.waitForTimeout(400);
  await win.screenshot({ path: path.join(dossier, 'ent-societe-sombre.png') });
  // 1280 : la largeur qui casse.
  await win.evaluate(() => document.body.classList.remove('dark'));
  await win.setViewportSize({ width: 1280, height: 800 });
  await win.waitForTimeout(400);
  await win.screenshot({ path: path.join(dossier, 'ent-societe-1280.png') });
  mesures.entreprise.debordement1280 = await win.evaluate(() =>
    [...document.querySelectorAll('#view button, #view input, #view select')]
      .filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length);
  await fermer(app);

  // ---------------------------------------------------------------- app cabinet
  const udc = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-paramcab-'));
  const cab = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${udc}`, path.join(RACINE, 'src', 'cabinet', 'main.js')], executablePath: ELECTRON });
  const cw = await cab.firstWindow();
  cw.on('pageerror', e => bac.push('CAB ' + e.message));
  cw.on('console', m => { if (m.type() === 'error') bac.push('CAB ' + m.text()); });
  await cw.setViewportSize({ width: 1440, height: 900 });
  await cw.waitForSelector('#lock-form');
  await cw.fill('#lock-pw', 'motdepasse-cabinet');
  await cw.fill('#lock-pw2', 'motdepasse-cabinet');
  await cw.click('#lock-go');
  await cw.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  // On traverse l'assistant en reconnaissant ses écrans, jamais en comptant les « Suivant ».
  for (let g = 0; g < 15 && await cw.$('#setup'); g++) {
    if (await cw.$('#w-name')) { await cw.fill('#w-name', 'Cabinet Audit'); await cw.fill('#w-email', 'contact@audit.tn'); }
    const suivant = await cw.$('#w-next') || await cw.$('#w-skip');
    if (!suivant) break;
    await suivant.click(); await cw.waitForTimeout(200);
  }
  await cw.evaluate(() => { location.hash = '#/reglages'; });
  await cw.waitForSelector('#c-name');
  await cw.waitForTimeout(800);
  // L'app cabinet a elle aussi des onglets depuis la 7.32.0 : on mesure comme l'app entreprise,
  // onglet par onglet. Un panneau masqué mesure ZÉRO pixel — mesurer la page entière annoncerait
  // donc des onglets parfaits sur un écran cassé.
  await cw.waitForSelector('#set-tabs');
  mesures.cabinet.onglets = await cw.evaluate(() =>
    [...document.querySelectorAll('#set-tabs button')].map(b => ({ id: b.dataset.tab, label: b.textContent.trim() })));
  for (const { id, label } of mesures.cabinet.onglets) {
    await cw.click(`#set-tabs button[data-tab="${id}"]`);
    await cw.waitForTimeout(450);
    mesures.cabinet[id] = await cw.evaluate(t => {
      const v = document.querySelector('#view');
      const sec = document.querySelector(`section[data-pane="${t}"]`);
      if (!sec || sec.hidden) return { absent: true };
      const h = sec.getBoundingClientRect().height;
      return {
        champs: sec.querySelectorAll('input:not([type=hidden]), select, textarea').length,
        bulles: sec.querySelectorAll('button.i').length,
        boutons: [...sec.querySelectorAll('button:not(.i)')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
        sommaire: [...document.querySelectorAll('#set-somm .somm-chip')].map(b => b.textContent.trim()),
        panneaux: [...sec.querySelectorAll('.panel')].map(p => ({
          id: p.id,
          titre: (p.querySelector('h2') ? p.querySelector('h2').textContent : '').replace(/\s+/g, ' ').trim(),
          ecrans: Math.round(p.getBoundingClientRect().height / v.clientHeight * 100) / 100
        })),
        hauteur: Math.round(h), ecrans: Math.round(h / v.clientHeight * 10) / 10
      };
    }, id);
    mesures.cabinet[id].label = label;
    await cw.evaluate(() => { document.querySelector('#view').scrollTop = 0; });
    await cw.screenshot({ path: path.join(dossier, `cab-${id}.png`) });
  }
  // Le bandeau de la clé de secours doit rester visible QUEL QUE SOIT l'onglet : c'est la
  // contrepartie du rangement en onglets.
  mesures.cabinet.bandeauCle = await cw.evaluate(() => {
    const b = document.querySelector('.banner.danger');
    return b ? { visible: b.getBoundingClientRect().height > 0, texte: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) } : 'absent';
  });
  mesures.cabinet.maj = await cw.evaluate(() => {
    const t = document.querySelector('#view').textContent;
    const i = t.indexOf('ise à jour');
    return i < 0 ? '(aucune mention des mises à jour)' : t.slice(Math.max(0, i - 80), i + 600).replace(/\s+/g, ' ').trim();
  });
  await fermer(cab);

  fs.writeFileSync(path.join(dossier, 'mesures.json'), JSON.stringify(mesures, null, 2));
  console.log(JSON.stringify(mesures, null, 2));
  if (bac.length) console.log('\nERREURS JS :\n' + bac.join('\n'));
  console.log('\ncaptures dans ' + dossier);
})().catch(e => { console.error(e); process.exit(1); });
