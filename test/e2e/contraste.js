// Aucun bouton n'est invisible (7.11.1).
//
// Pourquoi ce test existe : Skander a ouvert une facture émise et a vu « un bouton tout blanc ».
// C'était « Corriger par un avoir… », la SEULE sortie que le bandeau de verrouillage propose — un
// rectangle de 155 × 32 px, blanc sur blanc. La cause est une règle CSS de portée trop large :
// `.banner .btn { background: #fff }` existe pour que le bouton NEUTRE ne paraisse pas sale sur un
// bandeau teinté, et elle repeignait aussi le bouton primaire, qui garde son texte blanc.
//
// Le point important : ça ne plante pas, ça n'apparaît dans aucune console, aucun test de calcul ne
// le voit, et relire le CSS ne suffit pas — c'est une question de spécificité entre deux règles
// éloignées de 250 lignes. La seule façon fiable de le savoir est de MESURER dans l'application.
//
// Alors on ne mesure pas ce bouton-là, on les mesure tous : ce test parcourt les écrans, calcule
// pour chaque bouton visible le contraste entre son texte et le fond réellement peint derrière lui,
// et refuse tout ce qui est illisible. Le seuil est très bas (2,0) exprès : il ne juge pas
// l'esthétique, il attrape ce qu'on ne peut pas lire du tout.
//
//   xvfb-run -a node test/e2e/contraste.js
const { playwright, RACINE, ELECTRON, journal, surveiller, SONDE_CONTRASTE, SONDE_ESPACEMENT, SONDE_COLLANT, FENETRE } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

// La sonde vit dans `harnais.js` depuis la 9.4.3 : elle est partagée avec le parcours de rendu du
// Cabinet, qui mesure exactement la même chose. Recopiée, elle aurait divergé (7.29.0).
const SONDE = SONDE_CONTRASTE;
// Le seuil est très bas exprès : il ne juge pas l'esthétique, il attrape ce qu'on ne peut pas lire
// du tout — du blanc sur du blanc, comme le « Corriger par un avoir… » de la 7.12.0.
const SEUIL = 2.0;
// L'ESPACEMENT, braqué ici aussi (9.8.3). Il a été écrit pour l'app Cabinet, où Skander a vu des
// boutons collés au contenu — et la règle du projet est qu'un instrument qui ne couvre qu'une des
// deux applications n'en protège qu'une (9.4.3). Les trois exceptions sont les mêmes des deux
// côtés : elles décrivent des composants PARTAGÉS.
const ECART_MIN = 4;   // voir la justification dans cabinet-rendu.js
const SEGMENTS = ['.tabs', '.row-menu', '.pager'];

(async () => {
  const j = journal(); const bac = []; const fautes = []; let ecarts = 0; let mesuresChamps = 0; let collants = 0;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-contraste-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);

  const sonder = async (ou) => {
    const { boutons, champs } = await win.evaluate(SONDE);
    [...boutons, ...champs].filter(b => b.ratio < SEUIL).forEach(b => fautes.push(`${ou} → « ${b.texte} » (${b.id || b.cls}) : contraste ${b.ratio} — ${b.color} sur ${b.bg}`));
    // Même famille : un bouton parfaitement lisible peut être COUPÉ par le bord de la fenêtre. À
    // 1280 px, la barre d'actions de l'éditeur poussait « Émettre la facture » 105 px hors champ
    // (corrigé en 7.13.0). Le document, lui, ne débordait pas — un ancêtre le rognait — donc
    // `scrollWidth` n'en savait rien : c'est le bouton qu'il faut mesurer, pas la page.
    boutons.filter(b => b.hors > 2).forEach(b =>
      fautes.push(`${ou} → « ${b.texte} » (${b.id || b.cls}) dépasse de ${b.hors} px hors de la fenêtre`));

    const e = await win.evaluate(SONDE_ESPACEMENT, { min: ECART_MIN, exceptions: SEGMENTS });
    ecarts += e.mesures;
    e.colles.forEach(x => fautes.push(`${ou} — « ${x.bouton} » touche « ${x.voisin} » (${x.cote},`
      + ` ${x.sens}) : ${x.ecart} px, minimum ${ECART_MIN}`));
    // Une fenêtre ouverte vit hors de `#view` (voir `FENETRE` dans le harnais) : on la mesure à part.
    if (await win.$(FENETRE)) {
      const f = await win.evaluate(SONDE_ESPACEMENT, { min: ECART_MIN, exceptions: SEGMENTS, racine: FENETRE });
      ecarts += f.mesures;
      f.colles.forEach(x => fautes.push(`${ou} (fenêtre) — « ${x.bouton} » touche « ${x.voisin} » (${x.cote},`
        + ` ${x.sens}) : ${x.ecart} px, minimum ${ECART_MIN}`));
    }
    mesuresChamps += champs.length;
    // U-02 (10.12.0) : la règle de la colonne collante vit dans la feuille PARTAGÉE — elle se mesure
    // donc dans les DEUX applications (9.4.3 : un instrument qui ne couvre qu'une application ne
    // protège qu'une application).
    const k = await win.evaluate(SONDE_COLLANT);
    collants += k.tables;
    k.couverts.forEach(x => fautes.push(`${ou} — la colonne collante recouvre « ${x.cellule} » (${x.px} px, tableau ${x.table || 'sans classe'})`));
    return boutons.length;
  };

  j.etape('L\'assistant de première utilisation');
  await win.waitForSelector('#setup');
  for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
    await sonder('assistant');
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Contraste SUARL');
      await win.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next');
    await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  j.ok('traversé');

  j.etape('Le jeu d\'exemple, pour que les écrans aient du contenu');
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner');
  j.ok('chargé');

  const PAGES = ['accueil', 'devis', 'factures', 'relances', 'clients', 'catalogue', 'autres', 'recurrentes',
    'achats', 'fournisseurs', 'stock', 'immos', 'tresorerie', 'marges', 'stats', 'compta', 'paie',
    'garanties', 'modules', 'parametres', 'aide'];

  j.etape(`Les ${PAGES.length} pages, en clair`);
  let n = 0;
  for (const p of PAGES) {
    await win.evaluate(x => { location.hash = '#/' + x; }, p);
    await win.waitForTimeout(160);
    n += await sonder('#/' + p);
  }
  j.ok(`${n} boutons mesurés`);

  // 10.12.0 — les FENÊTRES. La sonde d'espacement ne regardait que `#view`, et une fenêtre vit dans
  // `#modal-root` : aucun bouton d'une fenêtre n'avait jamais été mesuré dans cette application.
  // Trois des plus ouvertes, par leur vrai bouton ; chacune doit s'ouvrir, sinon le parcours tombe —
  // une fenêtre qu'on croit mesurée et qui ne s'est pas ouverte est le défaut de `#stk-tabs` (7.23.0).
  j.etape('Trois fenêtres parmi les plus ouvertes');
  for (const [page, bouton, nom] of [['clients', '#new', 'nouveau client'], ['catalogue', '#new', 'nouvelle prestation'],
    ['fournisseurs', '#new', 'nouveau fournisseur']]) {
    await win.evaluate(x => { location.hash = '#/' + x; }, page);
    await win.waitForSelector('#view ' + bouton, { timeout: 5000 });
    await win.click('#view ' + bouton);
    await win.waitForSelector(FENETRE, { timeout: 5000 })
      .catch(() => { throw new Error(`la fenêtre « ${nom} » ne s'ouvre pas : elle ne serait jamais mesurée`); });
    await win.waitForTimeout(200);
    await sonder('fenêtre ' + nom);
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal-bg'), null, { timeout: 5000 })
      .catch(() => { throw new Error(`la fenêtre « ${nom} » ne se referme pas à Échap`); });
  }
  j.ok('mesurées');

  // Le cas exact de la capture : une facture émise, dont le bandeau porte le seul bouton de sortie.
  j.etape('Le bandeau d\'une pièce émise');
  await win.evaluate(() => { location.hash = '#/factures'; });
  await win.waitForSelector('#view table.list');
  const ids = await win.$$eval('#view table.list tbody tr[data-id]', trs => trs.map(t => t.dataset.id));
  let vu = false;
  for (const id of ids) {
    await win.evaluate(i => { location.hash = '#/doc/' + i; }, id);
    await win.waitForTimeout(200);
    if (await win.$('.lock-banner')) { await sonder('facture émise'); vu = true; break; }
  }
  if (!vu) throw new Error('aucune facture émise trouvée : le bandeau de verrouillage n\'a pas été mesuré');
  j.ok('mesuré');

  j.etape('Les mêmes écrans sur un portable de 1280 px');
  await win.setViewportSize({ width: 1280, height: 800 });
  await win.waitForTimeout(200);
  let p = 0;
  for (const page of PAGES) {
    await win.evaluate(x => { location.hash = '#/' + x; }, page);
    await win.waitForTimeout(150);
    p += await sonder('1280 #/' + page);
  }
  // Et les éditeurs, qui portent le plus de boutons. Le pire cas n'est pas le premier document de la
  // liste : c'est le BROUILLON (« Émettre la facture » + « Transformer ▾ » + « Plus ▾ » en plus), et
  // un test qui n'ouvrirait qu'une pièce émise passerait à côté. On les parcourt donc tous.
  await win.evaluate(() => { location.hash = '#/doc/new/facture'; });
  await win.waitForTimeout(300);
  await sonder('1280 nouvelle facture');
  for (const id of ids) {
    await win.evaluate(i => { location.hash = '#/doc/' + i; }, id);
    await win.waitForTimeout(220);
    await sonder('1280 éditeur ' + id);
  }
  j.ok(`${p} boutons mesurés, largeur comprise`);
  await win.setViewportSize({ width: 1440, height: 900 });
  await win.waitForTimeout(200);

  j.etape('Les mêmes écrans en thème sombre');
  await win.evaluate(() => document.body.classList.add('dark'));
  let m = 0;
  for (const p of PAGES) {
    await win.evaluate(x => { location.hash = '#/' + x; }, p);
    await win.waitForTimeout(140);
    await win.evaluate(() => document.body.classList.add('dark'));
    m += await sonder('sombre #/' + p);
  }
  for (const id of ids) {
    await win.evaluate(i => { location.hash = '#/doc/' + i; }, id);
    await win.waitForTimeout(200);
    await win.evaluate(() => document.body.classList.add('dark'));
    if (await win.$('.lock-banner')) { await sonder('sombre facture émise'); break; }
  }
  j.ok(`${m} boutons mesurés`);

  await app.close();

  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  // Un instrument qui ne mesure rien annonce « tout va bien » : il doit échouer, pas se taire.
  if (!ecarts) { console.error('\nAucun écart mesuré : le parcours ne prouve plus rien de l\'espacement.'); process.exit(2); }
  // Et la même exigence sur les CHAMPS, parce que c'est très exactement ce qui est arrivé : la
  // moitié « champs » de la sonde a disparu en 9.4.3 et le parcours a continué d'annoncer « aucun
  // bouton illisible » pendant onze versions, sans qu'aucun compte ne manque à l'appel (9.7.0).
  if (!mesuresChamps) { console.error('\nAucun champ mesuré : le parcours ne prouve plus rien de leur lisibilité.'); process.exit(2); }
  if (fautes.length) {
    const u = [...new Set(fautes)];
    console.error(`\n${u.length} défaut(s) — bouton ou champ illisible, coupé, ou collé à son voisin :\n` + u.join('\n'));
    process.exit(1);
  }
  if (!collants) { console.error('\nAucun tableau mesuré : le parcours ne prouve plus rien des colonnes collantes.'); process.exit(2); }
  console.log(`\n${j.total()} étapes — aucun bouton ni champ illisible, aucun collé, aucune donnée recouverte `
    + `(${mesuresChamps} champs, ${ecarts} écarts, ${collants} tableaux mesurés).`);
})().catch(e => { console.error(e); process.exit(1); });
