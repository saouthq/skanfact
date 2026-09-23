// Les écrans qui ne répondent pas (7.17.0).
//
// Un bouton absent se voit. Un bouton qui accepte le clic et n'en fait rien ne se voit nulle part :
// aucune console, aucune erreur, aucun test de calcul. On croit avoir mal cliqué, on recommence, on
// doute de soi, puis du logiciel. Ce test refait les six gestes dans l'application réelle.
//
//   1. Pointer un mouvement par erreur : la ligne disparaît à l'instant — « Annuler » doit exister,
//      et le panneau « Déjà pointés » doit permettre de le dépointer un mois plus tard.
//   2. Le solde de tout compte : taper un libellé sans que le curseur saute à chaque caractère.
//   3. Le sélecteur d'année disparaît des onglets qui ne le lisent pas.
//   4. Les six colonnes de Trésorerie → Mouvements trient vraiment.
//   5. Trésorerie et Stock laissent choisir l'année.
//   6. Les deux compteurs rouges du Stock ouvrent la liste des articles concernés.
//
//   xvfb-run -a node test/e2e/repondre.js
const { playwright, RACINE, ELECTRON, journal, surveiller, montant } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-repondre-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(260); };

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Répondre SUARL');
      await win.fill('#sf-form input[name=matricule]', '1122334Z/A/P/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await aller('#/parametres');
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner');
  j.ok('prêt');

  // ---------------------------------------------------------------- 1. le pointage se défait
  j.etape('Pointer un mouvement par erreur n\'est plus définitif');
  await aller('#/tresorerie');
  await win.waitForSelector('#t-tabs');
  await win.click('#t-tabs button[data-tab=rapprochement]');
  await win.waitForSelector('[data-rec]');
  const avant = await win.$$eval('[data-rec]', els => els.filter(e => !e.checked).length);
  if (avant < 2) throw new Error('pas assez de mouvements à pointer dans le jeu d\'exemple : le test ne prouve rien');
  // `check()` revérifie l'élément après le clic ; le panneau se redessine et l'élément est détaché.
  await win.evaluate(() => {
    const cb = [...document.querySelectorAll('[data-rec]')].find(x => !x.checked);
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.waitForSelector('#toast-undo', { timeout: 3000 });
  const apres = await win.$$eval('[data-rec]', els => els.filter(e => !e.checked).length);
  if (apres !== avant - 1) throw new Error(`le pointage n'a pas pris : ${apres} non pointés au lieu de ${avant - 1}`);
  await win.click('#toast-undo');
  await win.waitForTimeout(320);
  const rendu = await win.$$eval('[data-rec]', els => els.filter(e => !e.checked).length);
  if (rendu !== avant) throw new Error(`« Annuler » n'a pas rendu le mouvement : ${rendu} non pointés au lieu de ${avant}`);
  j.ok(`pointé (${avant} → ${apres}) puis rendu par « Annuler » (${rendu})`);

  j.etape('Ce qui a été pointé se relit et se dépointe');
  await win.evaluate(() => {
    const cb = [...document.querySelectorAll('[data-rec]')].find(x => !x.checked);
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.waitForSelector('#t-vus', { timeout: 3000 });
  await win.click('#t-vus');
  await win.waitForTimeout(260);
  const pointes = await win.$$eval('[data-rec]', els => els.filter(e => e.checked).length);
  if (pointes < 1) throw new Error('le panneau « Déjà pointés » ne montre aucune case cochée');
  // On dépointe DEPUIS ce panneau : c'est le chemin qui n'existait pas.
  await win.evaluate(() => {
    const cb = [...document.querySelectorAll('[data-rec]')].find(x => x.checked);
    cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.waitForTimeout(320);
  const refait = await win.$$eval('[data-rec]', els => els.filter(e => !e.checked).length);
  if (refait !== avant) throw new Error(`dépointer depuis le panneau n'a pas marché : ${refait} au lieu de ${avant}`);
  j.ok(`${pointes} mouvement(s) relisible(s), et le dépointage depuis le panneau fonctionne`);

  // ---------------------------------------------------------------- 2. le curseur ne saute plus
  j.etape('Le solde de tout compte se tape sans perdre le curseur');
  // Un salarié sorti, pour que le document ait un sens.
  await win.evaluate(() => {
    const d = window.__data;
    if (!d.employees.length) d.employees.push({ id: 'e-test', name: 'Salarié Témoin', grossSalary: 1200, contract: 'cdi', hireDate: '2024-01-01' });
    d.employees[0].endDate = window.SkanCore.today();
  });
  await aller('#/paie');
  await win.waitForSelector('#p-tabs');
  await win.click('#p-tabs button[data-tab=registre]');
  await win.waitForSelector('[data-hr]');
  await win.click('[data-hr]');
  await win.waitForSelector('#hf');
  await win.selectOption('#hf select[name=kind]', 'solde');
  await win.waitForFunction(() => { const p = document.querySelector('#hf-solde'); return p && !p.hidden; });
  const champ = await win.$('#hf-lines input[data-f=label]');
  await champ.click();
  await win.evaluate(() => { const e = document.querySelector('#hf-lines input[data-f=label]'); e.value = ''; });
  const mot = 'Prime de départ';
  for (const c of mot) { await win.keyboard.type(c); await win.waitForTimeout(12); }
  const etat = await win.evaluate(() => {
    const e = document.querySelector('#hf-lines input[data-f=label]');
    return { valeur: e.value, focus: document.activeElement === e, total: (document.querySelector('#hf-total') || {}).textContent };
  });
  if (etat.valeur !== mot) throw new Error(`le champ a perdu des caractères : « ${etat.valeur} » au lieu de « ${mot} »`);
  if (!etat.focus) throw new Error('le curseur a quitté le champ pendant la frappe');
  // Et le total suit quand même, sans redessiner : on change une ligne et on vérifie l'écart exact.
  const nb0 = montant;
  const t0 = nb0(etat.total);
  const ligne0 = nb0(await win.$eval('#hf-lines input[data-f=amount]', e => e.value));
  await win.fill('#hf-lines input[data-f=amount]', '250');
  await win.waitForTimeout(120);
  const total = await win.$eval('#hf-total', e => e.textContent);
  const attendu = t0 - ligne0 + 250;
  if (Math.abs(nb0(total) - attendu) > 0.01) throw new Error(`le total ne suit pas la saisie : « ${total} » au lieu de ${attendu.toFixed(3)}`);
  if (!(await win.evaluate(() => document.activeElement === document.querySelector('#hf-lines input[data-f=amount]'))))
    throw new Error('le curseur a quitté le champ montant');
  j.ok(`« ${etat.valeur} » tapé lettre par lettre sans perdre le curseur, total à jour (${total.trim()})`);
  // 10.12.0 — on vient de taper dans ce formulaire : « Annuler » DEMANDE avant de jeter la saisie.
  await win.click('#modal-root [data-close]');
  await win.waitForFunction(() => /Abandonner cette saisie/.test((document.querySelector('#modal-root .modal-bg:last-child') || {}).textContent || ''));
  await win.click('#modal-root .modal-bg:last-child #ok');
  await win.waitForFunction(() => !document.querySelector('#modal-root .modal-bg'));

  // ---------------------------------------------------------------- 3. le sélecteur d'année
  j.etape('Le sélecteur d\'année disparaît des onglets qui ne le lisent pas');
  const visible = async sel => win.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
  const vus = [];
  for (const [tab, attendu] of [['bulletins', true], ['salaries', false], ['avances', false], ['registre', false], ['declarations', true]]) {
    await win.click(`#p-tabs button[data-tab=${tab}]`); await win.waitForTimeout(200);
    const v = await visible('#p-year');
    if (v !== attendu) throw new Error(`Paie → ${tab} : sélecteur d'année ${v ? 'visible' : 'absent'}, attendu ${attendu ? 'visible' : 'absent'}`);
    vus.push(`${tab}:${v ? 'oui' : 'non'}`);
  }
  await aller('#/marges');
  await win.waitForSelector('#mg-tabs');
  for (const [tab, attendu] of [['affaires', false], ['analyse', true], ['contrats', false], ['seuil', true]]) {
    await win.click(`#mg-tabs button[data-tab=${tab}]`); await win.waitForTimeout(200);
    const v = await visible('#mg-year');
    if (v !== attendu) throw new Error(`Marges → ${tab} : sélecteur d'année ${v ? 'visible' : 'absent'}, attendu ${attendu ? 'visible' : 'absent'}`);
    vus.push(`${tab}:${v ? 'oui' : 'non'}`);
  }
  j.ok(vus.join(' · '));

  // ---------------------------------------------------------------- 4. le tri des mouvements
  j.etape('Les colonnes de Trésorerie → Mouvements trient vraiment');
  await aller('#/tresorerie');
  await win.waitForSelector('#t-tabs');
  await win.click('#t-tabs button[data-tab=mouvements]');
  await win.waitForSelector('#m-wrap th[data-sort=amount]');
  const lire = () => win.$$eval('#m-wrap tbody tr', trs => trs.map(t => t.cells[t.cells.length - 1].textContent.trim()));
  const depart = await lire();
  if (depart.length < 3) throw new Error('trop peu de mouvements pour juger d\'un tri');
  await win.click('#m-wrap th[data-sort=amount]');
  await win.waitForTimeout(260);
  const trie = await lire();
  const nb = montant;
  if (JSON.stringify(depart) === JSON.stringify(trie)) throw new Error('la liste est identique après le clic : le tri est inerte');
  // La flèche dit le sens ; la liste doit vraiment être monotone dans CE sens-là.
  const fleche = await win.$eval('#m-wrap th[data-sort=amount] .sort-ar', e => e.textContent);
  if (fleche === '⇅') throw new Error('l\'en-tête n\'affiche pas le sens du tri');
  const monotone = trie.map(nb).every((v, i, a) => i === 0 || (fleche === '↑' ? a[i - 1] <= v : a[i - 1] >= v));
  if (!monotone) throw new Error(`« Montant » annonce ${fleche} et la liste ne l'est pas : ` + trie.slice(0, 4).join(' | '));
  // Et un second clic renverse le sens : sans ça, le tri ne serait qu'à sens unique.
  await win.click('#m-wrap th[data-sort=amount]');
  await win.waitForTimeout(260);
  const fleche2 = await win.$eval('#m-wrap th[data-sort=amount] .sort-ar', e => e.textContent);
  if (fleche2 === fleche) throw new Error('un second clic ne renverse pas le tri');
  j.ok(`« Montant » trie ${fleche} puis ${fleche2} : ${trie.slice(0, 3).join(' → ')}`);

  // ---------------------------------------------------------------- 5. l'année se choisit
  j.etape('Trésorerie et Stock laissent choisir l\'année');
  const annees = await win.$$eval('#t-year option', os2 => os2.map(o => o.value));
  if (annees.length < 2) throw new Error(`un seul exercice proposé (${annees.join(',')}) : le jeu d'exemple devrait en couvrir deux`);
  const compte = () => win.$eval('#t-body .filters .small', e => e.textContent);
  const c1 = await compte();
  await win.selectOption('#t-year', annees[1]);
  await win.waitForTimeout(300);
  const c2 = await compte();
  if (c1 === c2) throw new Error(`changer d'année ne change rien : « ${c1} » des deux côtés`);
  const titre = await win.$eval('#t-body .panel h2', e => e.textContent);
  if (!titre.includes(annees[1])) throw new Error(`le panneau ne dit pas quelle année il montre : « ${titre} »`);
  j.ok(`${annees.join(' / ')} — ${c1.trim()} puis ${c2.trim()}`);

  await aller('#/stock');
  await win.waitForSelector('#st-tabs');
  await win.click('#st-tabs button[data-tab=mouvements]');
  await win.waitForSelector('#st-year');
  const sAnnees = await win.$$eval('#st-year option', os2 => os2.map(o => o.value));
  const sTitre = await win.$eval('#st-body .panel h2', e => e.textContent);
  if (!sTitre.includes(sAnnees[0])) throw new Error(`le Stock ne dit pas quelle année il montre : « ${sTitre} »`);
  if (sAnnees.length > 1) {
    await win.selectOption('#st-year', sAnnees[1]);
    await win.waitForTimeout(300);
    const t2 = await win.$eval('#st-body .panel h2', e => e.textContent);
    if (!t2.includes(sAnnees[1])) throw new Error('changer d\'année sur le Stock ne change pas le panneau');
  }
  j.ok(`Stock : ${sAnnees.join(' / ')}`);

  // ---------------------------------------------------------------- 6. les compteurs du Stock
  j.etape('Les compteurs rouges du Stock ouvrent la liste qu\'ils annoncent');
  await win.click('#st-tabs button[data-tab=etat]');
  await win.waitForSelector('#st-body .stat');
  const cartes = await win.$$eval('#st-body .stat[data-stat]', els => els.map(e => e.dataset.stat));
  if (!cartes.length) throw new Error('aucun compteur du Stock n\'est cliquable sur le jeu d\'exemple : le test ne prouve rien');
  await win.click(`#st-body .stat[data-stat=${cartes[0]}]`);
  await win.waitForTimeout(320);
  const onglet = await win.$eval('#st-tabs button.active', e => e.dataset.tab);
  if (onglet !== 'alertes') throw new Error(`le compteur mène à « ${onglet} » au lieu des alertes`);
  const lignes = await win.$$eval('#st-body tbody tr', trs => trs.length);
  if (!lignes) throw new Error('la liste ouverte par le compteur est vide');
  j.ok(`« ${cartes[0]} » ouvre les alertes (${lignes} ligne(s))`);

  // ---------------------------------------------------------------- 7. l'export suit l'onglet
  j.etape('L\'export CSV du Stock suit l\'onglet ouvert et le dit');
  // On n'ouvre pas la fenêtre du système : le bouton NOMME ce qu'il exporte, c'est ce qu'on lit.
  const libelles = {};
  for (const tab of ['etat', 'mouvements', 'series', 'inventaire', 'alertes']) {
    const b = await win.$(`#st-tabs button[data-tab=${tab}]`);
    if (!b) continue;
    await b.click(); await win.waitForTimeout(200);
    const btn = await win.evaluate(() => { const e = document.querySelector('#st-csv'); return e ? { txt: e.textContent.trim(), tab: e.dataset.csv } : null; });
    if (!btn) throw new Error(`pas de bouton d'export sur l'onglet ${tab}`);
    if (btn.tab !== tab) throw new Error(`le bouton d'export dit « ${btn.tab} » sur l'onglet ${tab}`);
    libelles[tab] = btn.txt;
  }
  const vals = Object.values(libelles);
  if (vals.length < 5) throw new Error(`seuls ${vals.length} onglets portent un export`);
  if (new Set(vals).size !== vals.length) throw new Error(`deux onglets annoncent le même export : ${vals.join(' | ')}`);
  j.ok(vals.join(' · '));

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — les écrans répondent.`);
})().catch(e => { console.error(e); process.exit(1); });
