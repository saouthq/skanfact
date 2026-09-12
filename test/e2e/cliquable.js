// Tout ce qui se lit se clique (7.15.0).
//
// Skander : « dans comptabilité section manquant on ne peut pas sélectionner afin de voir
// directement ».
//
// Le panneau « Ce qui manque » (Comptabilité → Cabinet) dit exactement ce qu'il faut aller
// regarder — « 3 achats sans justificatif », « 2 mouvements non pointés » — et c'étaient des lignes
// de texte inerte : un libellé, un compteur, rien à cliquer. Même chose pour les quatre chiffres du
// tableau de bord : « Reste à encaisser : 6 factures » est une QUESTION, et aucun filtre de la liste
// ne rendait ces six-là.
//
// Et une découverte du même parcours : le filtre « Émis » de la liste des factures comparait un
// statut qui n'existe pas — il rendait les AVOIRS. Une liste vide se remarque, une liste fausse non.
//
//   xvfb-run -a node test/e2e/cliquable.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-clic-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Clic SUARL');
      await win.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner');
  j.ok('prêt');

  // Les listes sont paginées : compter les lignes AFFICHÉES ne dit rien. Le bandeau « n sur N »
  // donne la sélection entière, et c'est lui qui fait foi (règle des listes depuis la 2.2.0).
  const retenues = async () => Number((await win.$eval('#f-note', e => e.textContent)).match(/(\d+) sur/)[1]);

  j.etape('Le filtre « Émis » rend des FACTURES, pas des avoirs');
  await win.evaluate(() => { location.hash = '#/factures'; });
  await win.waitForSelector('#list-wrap tbody tr');
  await win.selectOption('#st', 'brouillon');
  await win.waitForTimeout(500);
  const brouillons = await retenues();
  await win.selectOption('#st', 'émis');
  await win.waitForTimeout(500);
  const emis = await retenues();
  const types = await win.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('#list-wrap tbody tr'));
    return { brouillons: trs.filter(t => /Brouillon/.test(t.textContent)).length, avoirs: trs.filter(t => /Avoir/.test(t.textContent)).length, n: trs.length };
  });
  if (emis < 2) throw new Error(`« Émis » ne retient que ${emis} pièce(s) : le filtre ne filtre rien de juste`);
  if (types.n && types.n === types.avoirs) throw new Error('« Émis » ne rend que des avoirs — c\'est exactement le défaut d\'origine');
  if (types.brouillons) throw new Error('« Émis » laisse passer des brouillons');
  if (!brouillons) throw new Error('le jeu d\'exemple n\'a aucun brouillon : le test ne prouve rien');
  j.ok(`${emis} pièces émises, aucun des ${brouillons} brouillon(s) parmi elles`);

  j.etape('Le filtre « À encaisser » existe et rend le compte du tableau de bord');
  await win.selectOption('#st', 'à encaisser');
  await win.waitForTimeout(500);
  const aEncaisser = await retenues();
  if (!aEncaisser) throw new Error('« À encaisser » ne rend rien');
  await win.evaluate(() => { location.hash = '#/dashboard'; });
  await win.waitForSelector('[data-stat="encaisser"]');
  const annonce = await win.$eval('[data-stat="encaisser"] .sub', e => Number((e.textContent.match(/(\d+) facture/) || [])[1]));
  if (annonce !== aEncaisser) throw new Error(`la carte annonce ${annonce} factures et la liste en montre ${aEncaisser} : les deux ne se calculent pas pareil`);
  j.ok(`${annonce} factures annoncées, ${aEncaisser} listées`);

  j.etape('Les quatre chiffres du tableau de bord mènent quelque part');
  const cartes = await win.$$eval('[data-stat]', c => c.map(x => x.dataset.stat));
  if (cartes.length < 4) throw new Error('seulement ' + cartes.length + ' carte(s) cliquable(s)');
  for (const k of cartes) {
    await win.evaluate(() => { location.hash = '#/dashboard'; });
    await win.waitForSelector(`[data-stat="${k}"]`);
    const chevron = await win.evaluate(s => {
      const el = document.querySelector(`[data-stat="${s}"]`);
      return { curseur: getComputedStyle(el).cursor, apres: getComputedStyle(el, '::after').content };
    }, k);
    if (chevron.curseur !== 'pointer') throw new Error(`la carte « ${k} » n'a pas de curseur de clic`);
    if (!/›/.test(chevron.apres)) throw new Error(`la carte « ${k} » n'a pas de chevron : rien ne dit qu'elle mène quelque part`);
    await win.click(`[data-stat="${k}"]`);
    await win.waitForTimeout(500);
    const ou = await win.evaluate(() => location.hash);
    if (ou === '#/dashboard') throw new Error(`la carte « ${k} » avale le clic sans rien ouvrir`);
    j.ok(`« ${k} » → ${ou}`);
  }

  j.etape('« Ce qui manque » : chaque ligne mène aux pièces');
  await win.evaluate(() => { location.hash = '#/compta'; });
  await win.waitForSelector('#c-tabs');
  await win.click('#c-tabs button[data-tab=cabinet]');
  await win.waitForTimeout(700);
  const manques = await win.$$eval('[data-check]', b => b.map(x => ({ id: x.dataset.check, texte: x.textContent.trim() })));
  if (!manques.length) throw new Error('aucune ligne de « Ce qui manque » n\'est cliquable');
  for (const m of manques) {
    await win.evaluate(() => { location.hash = '#/compta'; });
    await win.waitForSelector('#c-tabs');
    await win.click('#c-tabs button[data-tab=cabinet]');
    await win.waitForSelector(`[data-check="${m.id}"]`);
    await win.click(`[data-check="${m.id}"]`);
    await win.waitForTimeout(600);
    const ou = await win.evaluate(() => location.hash);
    const bouge = ou !== '#/compta' || await win.evaluate(() => {
      const a = document.querySelector('#c-tabs button.active');
      return a && a.dataset.tab !== 'cabinet';
    });
    if (!bouge) throw new Error(`« ${m.texte} » (${m.id}) n'ouvre rien`);
    j.ok(`« ${m.texte} » → ${ou}`);
  }

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — ce qui se lit se clique.`);
})().catch(e => { console.error(e); process.exit(1); });
