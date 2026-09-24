// Les listes déroulantes, dans les DEUX applications (10.13.0).
//
// Skander, avant la mise en production : « les dropdown, y en a qui sont natifs et y en a qui sont
// modernes. Il faut que tout soit moderne. » Cent quarante `<select>` ouvraient la liste du
// SYSTÈME pendant que les clients et le catalogue ouvraient celle de SkanFact. `listes.js` ouvre la
// même liste partout, sans remplacer un seul `<select>` : la valeur, `formValues()`, les `onchange`
// et `selectOption` restent ce qu'ils étaient.
//
// Ce parcours clique à la SOURIS (coordonnées de l'élément, jamais `selectOption`, qui ne passe pas
// par le geste qu'on vient de changer) et au CLAVIER, et il vérifie ce que le geste FAIT :
//   1. un clic ouvre la liste de SkanFact — et choisir une ligne pose la valeur ET envoie `change`
//      (la liste des factures se filtre vraiment) ;
//   2. Espace ouvre, les flèches descendent, Entrée choisit — et le thème SOMBRE posé ainsi
//      s'applique : c'est l'`onchange` de l'application qui l'a reçu ;
//   3. chaque liste visible, en clair et en sombre, a perdu la flèche du système et porte le
//      chevron — y compris dans une barre de filtres, dont la règle du thème sombre remettait le
//      fond à zéro ;
//   4. dans une fenêtre : une longue liste propose une recherche, Entrée choisit SANS valider la
//      fenêtre, Échap ferme la liste et pas la fenêtre ;
//   5. le Cabinet charge le même fichier et ouvre la même liste.
//
//   xvfb-run -a node test/e2e/listes.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

// Clique au CENTRE d'un élément avec la vraie souris : c'est le `mousedown` qui ouvrait la liste du
// système, et c'est lui que `listes.js` intercepte.
async function cliquer(win, sel) {
  await win.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
  const b = await win.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await win.mouse.click(b.x, b.y);
}
async function cliquerLigne(win, texte) {
  const b = await win.evaluate(t => {
    const d = [...document.querySelectorAll('.lm-pop .combo-it')].find(x => x.textContent.trim() === t);
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, dessus: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === d || d.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
  }, texte);
  if (!b) throw new Error(`la ligne « ${texte} » n'est pas dans la liste ouverte`);
  // Une liste posée SOUS une fenêtre serait visible et inerte : le point cliqué doit être la ligne.
  if (!b.dessus) throw new Error(`la ligne « ${texte} » est recouverte : le clic tomberait ailleurs`);
  await win.mouse.click(b.x, b.y);
}
// Clique sur les MOTS d'un libellé (pas sur sa bulle) : c'est le geste qui doit poser le curseur
// dans la case — il ouvrait l'explication quand la bulle précédait le champ.
async function cliquerMots(win, selLibelle) {
  const b = await win.evaluate(s => {
    const l = document.querySelector(s); l.scrollIntoView({ block: 'center' });
    const t = [...(l.querySelector('.fl') || l).childNodes].find(n => n.nodeType === 3 && n.data.trim());
    const r = document.createRange(); r.selectNodeContents(t); const q = r.getBoundingClientRect();
    return { x: q.x + 6, y: q.y + q.height / 2 };
  }, selLibelle);
  await win.mouse.click(b.x, b.y);
}
// Chaque liste visible de l'écran : sans la flèche du système, avec le chevron.
const SONDE_CHEVRON = () => [...document.querySelectorAll('select:not([multiple]):not([size]):not([data-natif])')]
  .filter(s => s.getClientRects().length)
  .map(s => { const c = getComputedStyle(s); return { nom: s.name || s.id || s.getAttribute('aria-label') || '?', appearance: c.appearance, chevron: /svg/.test(c.backgroundImage) }; })
  .filter(x => x.appearance !== 'none' || !x.chevron);

(async () => {
  const j = journal(); const bac = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-listes-'));

  // ================================================================ l'application entreprise
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'ent')}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  await win.setViewportSize({ width: 1440, height: 900 });
  const attendre = (ms = 300) => win.waitForTimeout(ms);

  j.etape('Une entreprise, et l\'exemple chargé');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) await win.fill('#sf-form input[name=name]', 'Atelier Listes SUARL');
    if (await win.$('[data-act="conseil"]')) { await win.click('[data-act="conseil"]'); await win.waitForSelector('[data-act="conseil"].sel'); }
    await win.click('#sf-next'); await attendre(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await win.evaluate(() => { location.hash = '#/factures'; });
  await win.waitForSelector('#vide-demo');
  await win.click('#vide-demo');
  const ok0 = await win.$('#modal-root #ok'); if (ok0) await ok0.click();
  await win.waitForFunction(() => window.__data && window.__data.documents && window.__data.documents.length > 10, null, { timeout: 15000 })
    .catch(async () => { await win.waitForFunction(() => document.querySelectorAll('table.list tbody tr').length > 3, null, { timeout: 10000 }); });
  j.ok('exemple chargé');

  j.etape('Un clic ouvre la liste de SkanFact, et choisir filtre vraiment');
  await win.evaluate(() => { location.hash = '#/factures'; });
  await win.waitForSelector('#st');
  await cliquer(win, '#st');
  await win.waitForSelector('.lm-pop', { timeout: 2000 }).catch(() => { throw new Error('un clic sur le filtre des statuts n\'ouvre pas la liste de SkanFact : c\'est encore celle du système'); });
  const lignes = await win.evaluate(() => ({ n: document.querySelectorAll('.lm-pop .combo-it').length, opts: document.querySelector('#st').options.length, focus: document.activeElement && document.activeElement.id }));
  if (lignes.n !== lignes.opts) throw new Error(`la liste montre ${lignes.n} lignes pour ${lignes.opts} options`);
  if (lignes.focus !== 'st') throw new Error('le focus n\'est pas resté sur la liste qu\'on vient d\'ouvrir : Tab repartirait du début de la page');
  await cliquerLigne(win, 'Payée');
  await win.waitForFunction(() => !document.querySelector('.lm-pop'));
  const filtre = await win.evaluate(() => ({
    v: document.querySelector('#st').value,
    badges: [...document.querySelectorAll('table.list tbody .badge')].map(b => b.textContent.trim())
  }));
  if (filtre.v !== 'payée') throw new Error('choisir « Payée » n\'a pas posé la valeur : ' + filtre.v);
  if (!filtre.badges.length || filtre.badges.some(b => b !== 'payée')) throw new Error('la liste ne s\'est pas filtrée : `change` n\'est pas parvenu à l\'application (' + filtre.badges.slice(0, 4).join(', ') + ')');
  j.ok(`${lignes.n} lignes, « Payée » choisie : ${filtre.badges.length} factures payées, et rien d'autre`);

  j.etape('Au clavier : Espace ouvre, ↓ descend, Entrée choisit — et le thème sombre s\'applique');
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.evaluate(() => {
    const sec = document.querySelector('#pf select[name=theme]').closest('[data-pane]');
    [...document.querySelectorAll('#set-tabs button')].find(x => x.dataset.tab === sec.dataset.pane).click();
  });
  await attendre();
  await win.focus('#pf select[name=theme]');
  await win.keyboard.press('Space');
  await win.waitForSelector('.lm-pop', { timeout: 2000 }).catch(() => { throw new Error('Espace sur une liste fermée n\'ouvre pas la liste de SkanFact'); });
  await win.keyboard.press('ArrowDown');
  await win.keyboard.press('Enter');
  await win.waitForFunction(() => !document.querySelector('.lm-pop'));
  const theme = await win.evaluate(() => ({ v: document.querySelector('#pf select[name=theme]').value, sombre: document.body.classList.contains('dark'), barre: !document.querySelector('#save-bar').hidden }));
  if (theme.v !== 'dark') throw new Error('↓ puis Entrée n\'a pas choisi « Sombre » : ' + theme.v);
  if (!theme.sombre) throw new Error('le thème choisi ne s\'applique pas : l\'`onchange` de l\'application n\'a rien reçu');
  if (!theme.barre) throw new Error('la barre « Enregistrer » n\'est pas apparue : le changement n\'a pas été vu comme une modification');
  await win.click('#save'); await attendre(500);
  j.ok('« Sombre » choisi au clavier, appliqué, enregistré');

  j.etape('Le libellé pose le curseur dans SA case, et chaque bulle mène à son article');
  // Le libellé de la raison sociale, reconnu par la case qu'il contient — jamais par son rang.
  await win.evaluate(() => {
    const sec = document.querySelector('#pf input[name=name]').closest('[data-pane]');
    [...document.querySelectorAll('#set-tabs button')].find(x => x.dataset.tab === sec.dataset.pane).click();
    document.querySelector('#pf input[name=name]').closest('label').id = 'lb-nom-e2e';
  });
  await attendre();
  await cliquerMots(win, '#lb-nom-e2e');
  await attendre(250);
  const apresMots = await win.evaluate(() => ({ pop: !!document.querySelector('#info-pop'), focus: document.activeElement && document.activeElement.name }));
  if (apresMots.pop) throw new Error('cliquer les mots « Raison sociale » ouvre l\'explication au lieu de poser le curseur dans la case');
  if (apresMots.focus !== 'name') throw new Error('cliquer les mots du libellé ne pose pas le curseur dans sa case (focus : ' + apresMots.focus + ')');
  // Une bulle SANS article écrit à la main (`co.rc`) mène désormais à celui de sa famille.
  await cliquer(win, '#pf button.i[data-info="co.rc"]');
  await win.waitForSelector('#info-pop .ip-more a', { timeout: 2000 }).catch(() => { throw new Error('la bulle « Registre de commerce » s\'arrête à sa dernière phrase : aucun article'); });
  await win.click('#info-pop .ip-more a');
  await win.waitForFunction(() => /^#\/aide\//.test(location.hash) && !document.querySelector('#info-pop'));
  j.ok('« Raison sociale » cliqué : curseur dans la case ; la bulle du RC mène à ' + await win.evaluate(() => location.hash));

  j.etape('Chaque liste porte le chevron de SkanFact, en sombre et en clair');
  const PAGES = ['#/factures', '#/devis', '#/achats', '#/tresorerie', '#/stats', '#/paie', '#/parametres'];
  let vues = 0;
  for (const theme of ['sombre', 'clair']) {
    for (const p of PAGES) {
      await win.evaluate(x => { location.hash = x; }, p); await attendre(450);
      const n = await win.evaluate(() => [...document.querySelectorAll('select')].filter(s => s.getClientRects().length).length);
      vues += n;
      const fautes = await win.evaluate(SONDE_CHEVRON);
      if (fautes.length) throw new Error(`${p} (${theme}) : ${fautes.length} liste(s) sans le chevron de SkanFact — ${fautes.map(f => `${f.nom} (${f.appearance}${f.chevron ? '' : ', pas de chevron'})`).join(', ')}`);
    }
    if (theme === 'sombre') {
      // Retour au clair par le vrai réglage : c'est aussi la preuve qu'on sort de l'état choisi.
      await win.evaluate(() => { location.hash = '#/parametres'; });
      await win.waitForSelector('#set-tabs');
      await win.evaluate(() => {
        const sec = document.querySelector('#pf select[name=theme]').closest('[data-pane]');
        [...document.querySelectorAll('#set-tabs button')].find(x => x.dataset.tab === sec.dataset.pane).click();
      });
      await attendre();
      await cliquer(win, '#pf select[name=theme]');
      await win.waitForSelector('.lm-pop');
      await cliquerLigne(win, 'Clair');
      await win.click('#save'); await attendre(500);
      if (await win.evaluate(() => document.body.classList.contains('dark'))) throw new Error('« Clair » choisi à la souris n\'a pas quitté le thème sombre');
    }
  }
  if (vues < 20) throw new Error(`seulement ${vues} listes vues sur ${PAGES.length} pages : l'instrument n'atteint pas ce qu'il prétend mesurer`);
  j.ok(`${vues} listes mesurées sur ${PAGES.length} pages, dans les deux thèmes`);

  j.etape('Dans une fenêtre : la recherche, Entrée qui choisit sans valider, Échap qui ne ferme que la liste');
  await win.evaluate(() => { location.hash = '#/clients'; });
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#modal-root select[name=withholdingRate]');
  await cliquer(win, '#modal-root select[name=withholdingRate]');
  await win.waitForSelector('.lm-pop .lm-q', { timeout: 2000 }).catch(() => { throw new Error('une liste de treize taux n\'offre pas de recherche'); });
  if (!await win.evaluate(() => document.activeElement && document.activeElement.classList.contains('lm-q'))) throw new Error('la recherche n\'a pas le curseur : on taperait dans le vide');
  await win.keyboard.type('1,5');
  const trouves = await win.$$eval('.lm-pop .combo-it', l => l.map(d => d.textContent.trim()));
  if (trouves.length !== 1 || trouves[0] !== '1,5 %') throw new Error('la recherche « 1,5 » ne rend pas le seul taux 1,5 % : ' + trouves.join(' | '));
  await win.keyboard.press('Enter');
  await win.waitForFunction(() => !document.querySelector('.lm-pop'));
  const apres = await win.evaluate(() => ({
    v: document.querySelector('#modal-root select[name=withholdingRate]').value,
    couches: document.querySelectorAll('#modal-root .modal-bg').length,
    focus: document.activeElement && document.activeElement.name,
    refus: !!document.querySelector('#modal-root .champ-faute, #modal-root [aria-invalid="true"]')
  }));
  if (apres.v !== '1.5') throw new Error('Entrée n\'a pas choisi 1,5 % : ' + apres.v);
  // Sans le `stopPropagation`, Entrée validait AUSSI la fenêtre : « Enregistrer » sur un client sans
  // nom, donc un refus qui emporte le curseur sur le champ Nom.
  if (apres.couches !== 1 || apres.refus || apres.focus !== 'withholdingRate') throw new Error('Entrée dans la liste a aussi validé la fenêtre');
  // Une liste COURTE n'a pas de recherche : le curseur reste sur le `<select>`, DANS la fenêtre —
  // c'est là qu'Entrée et Échap pourraient remonter jusqu'à elle.
  await win.focus('#modal-root select[name=lang]');
  const langAvant = await win.$eval('#modal-root select[name=lang]', s => s.value);
  await win.keyboard.press('Space');
  await win.waitForSelector('.lm-pop', { timeout: 2000 });
  if (await win.$('.lm-pop .lm-q')) throw new Error('une liste de trois langues offre une recherche : c\'est une décoration');
  await win.keyboard.press('ArrowDown');
  await win.keyboard.press('Enter');
  await win.waitForFunction(() => !document.querySelector('.lm-pop'));
  const court = await win.evaluate(() => ({
    v: document.querySelector('#modal-root select[name=lang]').value,
    couches: document.querySelectorAll('#modal-root .modal-bg').length,
    focus: document.activeElement && document.activeElement.name,
    refus: !!document.querySelector('#modal-root .champ-faute, #modal-root [aria-invalid="true"]')
  }));
  if (court.v === langAvant) throw new Error('↓ puis Entrée sur une liste courte n\'a rien choisi');
  if (court.couches !== 1 || court.refus || court.focus !== 'lang') throw new Error('Entrée sur une liste courte a aussi validé la fenêtre');
  await win.keyboard.press('Space');
  await win.waitForSelector('.lm-pop');
  await win.keyboard.press('Escape');
  await win.waitForFunction(() => !document.querySelector('.lm-pop'));
  if (await win.evaluate(() => document.querySelectorAll('#modal-root .modal-bg').length) !== 1) throw new Error('Échap sur la liste ouverte a fermé la fenêtre (ou posé une question) au lieu de la seule liste');
  j.ok('recherche, Entrée et Échap ne touchent que la liste');
  await fermer(app);

  // ================================================================ l'application du comptable
  j.etape('Le Cabinet ouvre la même liste');
  const cab = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'cab')}`, path.join(RACINE, 'src', 'cabinet', 'main.js')], executablePath: ELECTRON, env: { ...process.env } });
  const cw = await cab.firstWindow(); surveiller(cw, 'cabinet', bac);
  await cw.setViewportSize({ width: 1440, height: 900 });
  await cw.waitForSelector('#lock-form');
  await cw.fill('#lock-pw', 'listes-2026'); await cw.fill('#lock-pw2', 'listes-2026');
  await cw.click('#lock-go');
  await cw.waitForSelector('#app', { state: 'visible', timeout: 15000 });
  await cw.waitForTimeout(600);
  for (let g = 0; g < 12 && await cw.$('#setup'); g++) {
    const nom = await cw.$('#setup input[name=name], #w-name'); if (nom) await nom.fill('Cabinet Listes');
    const s = await cw.$('#w-next'); if (!s) break; await s.click(); await cw.waitForTimeout(300);
  }
  await cw.waitForFunction(() => !document.querySelector('#setup'), null, { timeout: 8000 });
  await cw.evaluate(() => { location.hash = '#/reglages'; });
  await cw.waitForSelector('#set-tabs');
  await cw.click('#set-tabs button[data-tab="app"]'); await cw.waitForTimeout(300);
  const charger = await cw.$('#r-demo-on'); if (charger) { await charger.click(); await cw.waitForTimeout(1500); }
  await cw.evaluate(() => { location.hash = '#/reglages'; });
  await cw.waitForSelector('#set-tabs');
  // Une liste des Réglages, trouvée par ce qu'elle EST (un `<select>` d'un onglet), jamais par son
  // nom : l'onglet qui la porte s'ouvre par son contenu.
  const cible = await cw.evaluate(() => {
    const s = [...document.querySelectorAll('#view [data-pane] select')].find(x => x.id && x.options.length > 1);
    if (!s) return null;
    [...document.querySelectorAll('#set-tabs button')].find(b => b.dataset.tab === s.closest('[data-pane]').dataset.pane).click();
    return '#' + s.id;
  });
  if (!cible) throw new Error('les Réglages du Cabinet n\'ont aucune liste : le parcours ne prouverait rien');
  await cw.waitForTimeout(300);
  const avant = await cw.$eval(cible, s => s.value);
  await cliquer(cw, cible);
  await cw.waitForSelector('.lm-pop', { timeout: 2000 }).catch(() => { throw new Error(`le Cabinet ouvre encore la liste du système sur ${cible} : listes.js n'est pas chargé`); });
  const autre = await cw.$eval(cible, s => [...s.options].find(o => o.value !== s.value && !o.disabled).textContent.trim());
  await cliquerLigne(cw, autre);
  await cw.waitForFunction(() => !document.querySelector('.lm-pop'));
  if (await cw.$eval(cible, s => s.value) === avant) throw new Error('choisir une autre ligne dans le Cabinet n\'a rien changé');
  const fautesCab = await cw.evaluate(SONDE_CHEVRON);
  if (fautesCab.length) throw new Error('Cabinet : liste(s) sans le chevron — ' + fautesCab.map(f => f.nom).join(', '));
  j.ok(`${cible} : « ${autre} » choisi à la souris, dans la liste de SkanFact`);
  // Le même libellé, la même bulle, chez le comptable.
  await cw.evaluate(c => { document.querySelector(c).closest('label').id = 'lb-cab-e2e'; }, cible);
  await cliquerMots(cw, '#lb-cab-e2e');
  await cw.waitForTimeout(250);
  const motsCab = await cw.evaluate(c => ({ pop: !!document.querySelector('#info-pop'), focus: document.activeElement === document.querySelector(c) }), cible);
  if (motsCab.pop || !motsCab.focus) throw new Error('Cabinet : cliquer les mots du libellé ne pose pas le curseur dans sa liste');
  const bulleCab = await cw.evaluate(c => { const b = document.querySelector(c).closest('label').querySelector('button.i'); return b ? '[data-info="' + b.dataset.info + '"]' : null; }, cible);
  if (bulleCab) {
    await cliquer(cw, 'button.i' + bulleCab);
    await cw.waitForSelector('#info-pop .ip-more a', { timeout: 2000 }).catch(() => { throw new Error('Cabinet : la bulle ' + bulleCab + ' ne mène à aucun article'); });
  }
  await fermer(cab, { quoi: 'le Cabinet' });

  if (bac.length) throw new Error('erreurs JavaScript pendant le parcours :\n' + bac.join('\n'));
  console.log(`\n${j.total()} étapes, toutes vertes.`);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
