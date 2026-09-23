// Les colonnes qui ne s'alignent pas (7.22.1).
//
// Signalé sur la page Stock : « En stock », « Seuil » et « À commander » étaient écrits à gauche
// au-dessus de chiffres écrits à droite. L'en-tête finissait quatre-vingts pixels à gauche de sa
// propre valeur, et on lisait la ligne de travers.
//
// La cause n'est PAS dans le HTML — `<th class="r">` est écrit correctement, 153 fois. Elle est
// dans la SPÉCIFICITÉ CSS : `table.list th` (une classe, deux éléments) l'emporte sur `th.r` (une
// classe, un élément), donc l'alignement à droite de l'en-tête n'était jamais appliqué. Relire le
// HTML ne pouvait pas le montrer ; relire le CSS demandait de comparer deux règles séparées de
// deux cents lignes. **On mesure dans l'application réelle** (règle apprise en 6.8.0).
//
// Ce test parcourt toutes les pages et tous les onglets, et compare, colonne par colonne,
// l'alignement calculé de l'en-tête à celui de ses cellules.
//
//   xvfb-run -a node test/e2e/colonnes.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller, SONDE_COLONNES } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

// Toutes les pages qui portent des tableaux, avec leurs onglets quand elles en ont.
// Les identifiants des barres d'onglets sont ceux du code (`grep 'id="…-tabs"'`), pas des noms
// devinés : ma première version visait `#stk-tabs` là où l'application écrit `#st-tabs`, et le test
// sautait TOUS les onglets du Stock — en silence, en annonçant quand même « 338 colonnes mesurées ».
// Un sélecteur d'onglets annoncé et introuvable fait donc échouer le test, il ne s'ignore plus.
const PAGES = [
  ['#/dashboard', null], ['#/devis', null], ['#/factures', null], ['#/relances', null],
  ['#/clients', null], ['#/catalogue', '#cat-tabs'], ['#/contrats', null], ['#/autres', '#a-tabs'],
  ['#/achats', null], ['#/fournisseurs', null],
  ['#/stock', '#st-tabs'], ['#/immos', '#im-tabs'], ['#/tresorerie', '#t-tabs'],
  ['#/marges', '#mg-tabs'], ['#/paie', '#p-tabs'], ['#/compta', '#c-tabs'],
  ['#/stats', null], ['#/garanties', null], ['#/parametres', '#set-tabs']
];

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-colonnes-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(300); };

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Colonnes SUARL');
      await win.fill('#sf-form input[name=matricule]', '1122334C/A/M/000');
    }
    if (await win.$('[data-act="commerce"]')) { await win.click('[data-act="commerce"]'); await win.waitForSelector('[data-act="commerce"].sel'); }
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
  j.ok('prêt — le jeu d\'exemple remplit tous les tableaux');

  // La mesure vit dans `harnais.js` depuis la 9.4.3, partagée avec le parcours de rendu du
  // Cabinet : pour chaque tableau visible, chaque colonne, elle compare l'alignement CALCULÉ
  // de l'en-tête à celui de ses cellules, et ne juge que les colonnes qui portent du texte
  // des deux côtés — un en-tête vide (colonne d'actions) n'a rien à aligner.
  const mesurer = () => win.evaluate(SONDE_COLONNES);

  const onglets = async (sel, hash) => {
    if (!sel) return [null];
    if (!await win.$(sel)) throw new Error(`${hash} : la barre d'onglets « ${sel} » est introuvable — le test sauterait cette page en silence`);
    const ids = await win.evaluate(s => [...document.querySelectorAll(s + ' button[data-tab]')].map(b => b.dataset.tab), sel);
    if (!ids.length) throw new Error(`${hash} : aucun onglet lu dans « ${sel} »`);
    return ids;
  };

  let colonnes = 0; const fautes = [];
  for (const [hash, tabsSel] of PAGES) {
    j.etape(`Colonnes de ${hash}`);
    await aller(hash);
    for (const tab of await onglets(tabsSel, hash)) {
      if (tab) {
        // Pas de `.catch(() => {})` : un clic d'onglet qui échoue doit faire tomber le test, pas
        // le laisser annoncer un parcours qu'il n'a pas fait.
        await win.click(`${tabsSel} button[data-tab="${tab}"]`);
        await win.waitForTimeout(260);
      }
      const m = await mesurer();
      colonnes += m.colonnes;
      m.ecarts.forEach(e => fautes.push(`${hash}${tab ? ' · ' + tab : ''} — « ${e.colonne} » : en-tête ${e.entete}, valeurs ${e.cellules}`));
    }
    j.ok(`${hash} parcourue`);
  }

  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  if (!colonnes) { console.error('\nAucune colonne mesurée : le test ne prouve rien.'); process.exit(2); }
  if (fautes.length) {
    console.error(`\n${fautes.length} colonne(s) désalignée(s) sur ${colonnes} mesurée(s) :\n  ` + fautes.join('\n  '));
    process.exit(1);
  }
  console.log(`\n${colonnes} colonnes mesurées sur ${PAGES.length} pages — chaque en-tête est aligné sur ses valeurs.`);
})().catch(e => { console.error(e); process.exit(1); });
