// SkanFact Cabinet 9.7.0 — les immobilisations et l'inventaire, dans l'application RÉELLE.
//
// Ce que ce parcours prouve et qu'aucun test pur ne peut prouver : qu'une ligne d'acquisition
// venue d'un PAQUET remonte à l'écran sans fiche et propose de la créer (jamais d'office), que le
// plan d'amortissement se voit avant d'être enregistré, que les écritures d'inventaire arrivent en
// brouillard et ne se repassent pas deux fois, et que l'inventaire de stock se colle depuis un
// tableur et produit sa variation dans le bon sens.
const { playwright, RACINE, ELECTRON, ongletCompta, ongletComptaPresent } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'immobilisations');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-immo-'));
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
  const onglet = async nom => {
    await ongletCompta(win, nom);
    await attendre(500);
  };

  // ---------------------------------------------------------------- 1. ouvrir un livre
  étape('Ouvrir le cabinet, charger l\'exemple, ouvrir le livre d\'un client');
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', 'mot-de-passe-cabinet');
  await win.fill('#lock-pw2', 'mot-de-passe-cabinet');
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  for (let g = 0; g < 14 && await win.$('#setup'); g++) {
    if (await win.$('#w-name')) await win.fill('#w-name', 'Cabinet Immobilisations');
    if (await win.$('#w-skip')) await win.click('#w-skip'); else if (await win.$('#w-next')) await win.click('#w-next');
    await attendre(300);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'), { timeout: 15000 });
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#demo-on', { timeout: 8000 });
  await win.click('#demo-on');
  await win.waitForSelector('tr[data-id]', { timeout: 20000 });
  // On choisit le dossier par ce qu'il CONTIENT, jamais par son rang (règle 7.3.0). Les clients de
  // l'exemple n'ont pas tous reçu le même nombre de mois : « le premier de la liste » n'en portait
  // qu'un, sans la moindre acquisition d'immobilisation — et le parcours passait alors en sautant
  // très exactement ce qu'il devait prouver (règle 9.4.7).
  const cible = await win.evaluate(async () => {
    const ids = [...document.querySelectorAll('tr[data-id]')].map(t => t.dataset.id);
    const annee = String(new Date().getFullYear());
    let meilleur = null;
    for (const id of ids) {
      await window.cabinet.relireLesPaquets(id, annee).catch(() => null);
      const im = await window.cabinet.immobilisations({ dossierId: id, annee }).catch(() => null);
      const n = im ? im.aCreer.length : 0;
      if (!meilleur || n > meilleur.n) meilleur = { id, n };
      if (n) break;
    }
    return meilleur;
  });
  if (!cible || !cible.n) {
    throw new Error('aucun dossier de l\'exemple ne porte d\'acquisition au compte d\'immobilisation : '
      + 'ce parcours ne prouverait alors rien de ce pour quoi il existe');
  }
  await win.evaluate(o => { location.hash = '#/dossier/' + encodeURIComponent(o.id) + '/comptabilite'; }, cible);
  await win.waitForSelector('#c-livres', { timeout: 15000 });
  await win.waitForFunction(() => {
    const e = document.querySelector('#c-livres');
    return e && !e.textContent.includes('Lecture des paquets');
  }, { timeout: 30000 });
  if (await win.$('#lv-relire')) {
    // Sans livre, PAS d'onglet Immobilisations : un dossier permanent sans livre n'a nulle part où
    // ranger ses fiches, et un onglet qui s'ouvre sur rien est un bouton mort.
    if (await ongletComptaPresent(win, 'immobilisations')) {
      throw new Error('l\'onglet Immobilisations s\'affiche alors que le dossier n\'a pas de livre');
    }
    await win.click('#lv-relire');
    await win.waitForSelector('.modal-bg', { timeout: 30000 });
    await win.click('.modal-bg .btn-primary');
    await attendre(600);
  }
  // 10.12.0 (U-06) — les écrans du livre sont rangés en groupes : on attend que le livre soit là
  // (le sélecteur de groupes n'existe qu'avec un livre), puis on trouve l'écran par ses groupes.
  await win.waitForSelector('#c-groupes', { timeout: 25000 });
  if (!(await ongletComptaPresent(win, 'immobilisations'))) throw new Error('le livre est ouvert et l\'écran « Immobilisations » reste introuvable');
  ok('livre ouvert, et les deux onglets neufs sont là');

  // ------------------------------------------- 2. ce que le paquet a apporté et qui n'a pas de fiche
  étape('Une acquisition venue du paquet remonte SANS fiche, et propose de la créer');
  await onglet('immobilisations');
  await win.waitForFunction(() => {
    const e = document.querySelector('#c-livres');
    return e && !e.textContent.includes('Lecture des immobilisations');
  }, { timeout: 20000 });
  await shot('01-immobilisations-vide');
  const vide = await win.evaluate(() => (document.querySelector('#c-livres') || {}).textContent || '');
  if (!/Aucun bien sur cet exercice/.test(vide)) {
    throw new Error('l\'exemple devrait commencer sans aucune fiche de bien');
  }
  // 10.12.0 (U-20) — les réserves (taux dégressif, bascule, subvention, dérogatoire) ne vivent plus
  // dans un panneau permanent sous le tableau : la bulle de l'écran les annonce, et la fiche les
  // rappelle au moment où on les choisit (étape 3). Le panneau qui revient fait tomber le parcours.
  if (/Ce que cet écran ne décide pas/.test(vide)) throw new Error('le panneau permanent des réserves est revenu (U-20)');
  await win.click('#c-livres .i[data-info="im.etat"]');
  await attendre(300);
  const bulle = await win.evaluate(() => (document.querySelector('#info-pop') || {}).textContent || '');
  if (!/À VÉRIFIER/.test(bulle)) throw new Error('la bulle de l\'écran doit dire ce qui reste À VÉRIFIER : ' + bulle);
  await win.click('#info-pop .ip-close');
  const propositions = await win.$$eval('[data-creer]', b => b.length);
  if (!propositions) throw new Error('les acquisitions du paquet devraient remonter avec leur bouton');
  // U-11 — un seul bouton en couleur, et c'est l'étape suivante : la première acquisition sans
  // fiche. « Ajouter un bien… » était vert en permanence, à côté de ce qui attendait vraiment.
  const verts = await win.evaluate(() => [...document.querySelectorAll('#c-livres .btn-primary')]
    .filter(b => b.offsetParent).map(b => b.id || (b.dataset.creer ? 'creer' : '') || b.textContent.trim()));
  if (verts.length !== 1 || verts[0] !== 'creer') throw new Error(`un seul vert, sur « Créer la fiche du bien… », attendu — vu : ${verts.join(' | ') || 'aucun'}`);
  ok(`${propositions} ligne(s) d'acquisition sans fiche, chacune avec son bouton « Créer la fiche du bien… »`);

  // ---------------------------------------------------------------- 3. créer un bien, en le VOYANT
  étape('Créer un bien : le plan s\'affiche PENDANT la saisie');
  await win.click('[data-creer]');
  await win.waitForSelector('#im', { timeout: 10000 });
  await win.fill('.modal-bg [name=libelle]', 'Serveur de sauvegarde');
  await win.fill('.modal-bg [name=valeur]', '4800');
  await win.fill('.modal-bg [name=duree]', '4');
  await win.fill('.modal-bg [name=dateMiseEnService]', '2026-01-01');
  await win.fill('.modal-bg [name=dateAcquisition]', '2026-01-01');
  await attendre(400);
  const apercu = await win.evaluate(() => (document.querySelector('#im-apercu') || {}).textContent || '');
  if (!/exercice/.test(apercu)) throw new Error('le plan doit se voir avant d\'enregistrer : ' + apercu);
  await shot('02-fiche-lineaire');

  // Le dégressif SANS taux est refusé : l'application ne devine pas un coefficient.
  await win.selectOption('.modal-bg [name=methode]', 'degressif');
  await attendre(400);
  const sansTaux = await win.evaluate(() => (document.querySelector('#im-apercu') || {}).textContent || '');
  if (!/TAUX|taux/.test(sansTaux)) throw new Error('un dégressif sans taux doit être refusé en nommant le taux : ' + sansTaux);
  await shot('03-degressif-sans-taux');
  // U-20 — la réserve du dégressif se lit là où on le choisit, et seulement quand on l'a choisi.
  const note = await win.evaluate(() => { const n = document.querySelector('#im-degr-n'); return n && n.offsetParent ? n.textContent : ''; });
  if (!/À VÉRIFIER/.test(note)) throw new Error('choisir le dégressif doit montrer sa réserve sous le taux : « ' + note + ' »');
  if (!(await win.evaluate(() => !!document.querySelector('.modal-bg .i[data-info="im.verifier"]')))) {
    throw new Error('la méthode doit porter la bulle de ce qui reste À VÉRIFIER');
  }
  await win.selectOption('.modal-bg [name=methode]', 'lineaire');
  await attendre(300);
  if (!(await win.evaluate(() => { const n = document.querySelector('#im-degr-n'); return !n || !n.offsetParent; }))) {
    throw new Error('la réserve du dégressif reste affichée sur un bien linéaire');
  }
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 10000 });
  await attendre(800);
  const L1 = await livre();
  if ((L1.immobilisations || []).length !== 1) throw new Error('la fiche n\'a pas été enregistrée');
  const f1 = L1.immobilisations[0];
  if (f1.plan.length !== 4) throw new Error('le plan devrait porter quatre exercices, vu ' + f1.plan.length);
  if (f1.plan[0].dotation !== 1200) throw new Error('la dotation 2026 devrait valoir 1 200, vue ' + f1.plan[0].dotation);
  ok('bien enregistré, plan de 4 exercices, dotation 1 200,000 DT');

  // ---------------------------------------------------------------- 4. le plan s'ouvre
  // On vise le menu de la LIGNE (`IM:`), jamais « le premier [data-rowmenu] venu » : l'en-tête de
  // la fiche du dossier en porte un aussi depuis la 9.4.8, et il vient avant dans le document.
  // C'est la septième fois que ce piège revient — on reconnaît un élément à ce qu'il DÉSIGNE.
  étape('Le plan d\'amortissement s\'ouvre depuis la ligne');
  await win.click('[data-rowmenu^="IM:"]');
  await attendre(500);
  const ouvert = await win.evaluate(() => {
    const b = [...document.querySelectorAll('.row-menu button, .row-menu [role=menuitem]')]
      .find(x => /plan d'amortissement/i.test(x.textContent));
    if (b) { b.click(); return true; }
    return false;
  });
  if (!ouvert) throw new Error('l\'entrée « Voir le plan d\'amortissement » est introuvable dans le menu de la ligne');
  await attendre(700);
  const planVisible = await win.evaluate(() => !!document.querySelector('#im-plan'));
  if (!planVisible) throw new Error('le plan d\'amortissement ne s\'ouvre pas depuis la ligne');
  const lignesPlan = await win.$$eval('#im-plan tbody tr', t => t.length);
  if (lignesPlan !== 4) throw new Error('le plan affiché devrait porter quatre exercices, vu ' + lignesPlan);
  await shot('04-plan');
  ok(lignesPlan + ' exercices affichés, avec l\'écriture de chacun');

  // ---------------------------------------------------------------- 5. les écritures d'inventaire
  étape('Passer les dotations : en brouillard, au 31/12, et pas deux fois');
  await win.click('#im-ecrire');
  await win.waitForFunction(() => /brouillard/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 15000 });
  await attendre(900);
  const L2 = await livre();
  const dot = (L2.ecritures || []).filter(e => e.source === 'inventaire');
  if (!dot.length) throw new Error('aucune écriture d\'inventaire n\'a été passée');
  const d0 = dot[0];
  if (d0.statut !== 'brouillard') throw new Error('une dotation proposée doit arriver en brouillard, vue ' + d0.statut);
  if (!/-12-31$/.test(d0.date)) throw new Error('une dotation est une écriture d\'inventaire : au dernier jour, vue ' + d0.date);
  const deb = d0.lignes.reduce((s, l) => s + (l.debit || 0), 0);
  const cre = d0.lignes.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(deb - cre) > 0.001) throw new Error('la dotation n\'est pas équilibrée');
  const eteint = await win.evaluate(() => !!(document.querySelector('#im-ecrire') || {}).disabled);
  if (!eteint) throw new Error('le bouton doit s\'éteindre : repasser la dotation la compterait deux fois');
  // U-23 — et il dit POURQUOI, à côté de lui : l'infobulle ne se voit ni au clavier ni au doigt.
  const motifIm = await win.evaluate(() => { const m = document.querySelector('#im-motifs'); return m && m.offsetParent ? m.textContent : ''; });
  if (!/passées/.test(motifIm)) throw new Error('le bouton éteint doit dire pourquoi, en clair (U-23) : « ' + motifIm + ' »');
  await shot('05-dotations-passees');
  ok(`${dot.length} écriture(s) d'inventaire au ${d0.date}, et le bouton s'éteint`);

  // ------------------------------------------ 6. une dotation écrite se défend d'être recalculée
  étape('Modifier un bien dont la dotation est écrite est REFUSÉ, en nommant le geste');
  await win.click('[data-rowmenu^="IM:"]');
  await attendre(500);
  const modif = await win.evaluate(() => {
    const b = [...document.querySelectorAll('.row-menu button, .row-menu [role=menuitem]')]
      .find(x => /Modifier/.test(x.textContent));
    if (b) { b.click(); return true; }
    return false;
  });
  if (!modif) throw new Error('l\'entrée « Modifier la fiche » est introuvable dans le menu');
  await win.waitForSelector('#im', { timeout: 10000 });
  await win.fill('.modal-bg [name=valeur]', '9600');
  await attendre(300);
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => /Contre-passe|déjà passée/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 10000 });
  const refus = await win.evaluate(() => document.querySelector('#toast').textContent);
  if (!/Contre-passe/.test(refus)) throw new Error('le refus doit nommer le geste qui débloque : ' + refus);
  await shot('06-refus-recalcul');
  await win.evaluate(() => { const b = document.querySelector('.modal-bg [data-close]'); if (b) b.click(); });
  await win.keyboard.press('Escape');
  await attendre(500);
  ok('refus nommé : ' + refus.slice(0, 90));

  // ---------------------------------------------------------------- 7. l'inventaire de stock
  étape('L\'inventaire se colle depuis un tableur, et la variation part dans le bon sens');
  await onglet('inventaire');
  await win.waitForFunction(() => {
    const e = document.querySelector('#c-livres');
    return e && !e.textContent.includes('Lecture de l\'inventaire');
  }, { timeout: 20000 });
  await shot('07-inventaire-vide');
  const videInv = await win.evaluate(() => (document.querySelector('#c-livres') || {}).textContent || '');
  if (!/Aucun inventaire saisi/.test(videInv)) throw new Error('l\'écran vide de l\'inventaire ne s\'annonce pas');
  // U-11 — le geste vit dans l'état vide, qui est le corps de l'écran : un seul « Saisir
  // l'inventaire… », en couleur. Il était montré deux fois, en vert les deux fois.
  const vertsInv = await win.evaluate(() => [...document.querySelectorAll('#c-livres .btn-primary')].filter(b => b.offsetParent).map(b => b.id));
  if (vertsInv.join() !== 'iv-saisir2') throw new Error('un seul vert attendu sur l\'inventaire vide, dans l\'état vide — vu : ' + (vertsInv.join(' | ') || 'aucun'));
  await win.click('#iv-saisir, #iv-saisir2');
  await win.waitForSelector('#iv-lignes', { timeout: 10000 });
  await win.fill('.modal-bg #iv-lignes', 'REF-01\tCâble HDMI 2 m\t24\t7.500\nREF-02\tOnduleur 650 VA\t3\t180.000');
  await attendre(400);
  const apercuInv = await win.evaluate(() => (document.querySelector('#iv-apercu') || {}).textContent || '');
  // 24 × 7,500 = 180 ; 3 × 180 = 540 ; total 720.
  if (!/720/.test(apercuInv)) throw new Error('le total de l\'inventaire devrait valoir 720,000 : ' + apercuInv);
  await shot('08-inventaire-saisi');
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 10000 });
  await attendre(900);
  const L3 = await livre();
  if (!(L3.inventaires || []).length) throw new Error('l\'inventaire n\'a pas été enregistré');
  if (L3.inventaires[0].total !== 720) throw new Error('le total rangé devrait valoir 720, vu ' + L3.inventaires[0].total);
  const ecranVar = await win.evaluate(() => (document.querySelector('#c-livres') || {}).textContent || '');
  if (!/Variation/.test(ecranVar)) throw new Error('la variation ne s\'affiche pas');
  await shot('09-variation');
  ok('deux lignes collées, total 720,000 DT, variation affichée');

  // ---------------------------------------------------------------- 8. la variation ne passe qu'une fois
  étape('La variation de stock s\'écrit une fois, et une seule');
  const peut = await win.evaluate(() => !(document.querySelector('#iv-ecrire') || {}).disabled);
  if (peut && !(await win.evaluate(() => document.querySelector('#iv-ecrire').classList.contains('btn-primary')))) {
    throw new Error('une variation à écrire est l\'étape suivante : son bouton doit être le vert (U-11)');
  }
  if (peut) {
    await win.click('#iv-ecrire');
    await win.waitForFunction(() => /brouillard|stock/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 15000 });
    await attendre(900);
    const L4 = await livre();
    const stk = (L4.ecritures || []).filter(e => e.piece && e.piece.startsWith('STK-'));
    if (stk.length !== 1) throw new Error('il devrait y avoir exactement une écriture de variation, vu ' + stk.length);
    if (stk[0].statut !== 'brouillard') throw new Error('la variation doit arriver en brouillard');
    const re = await win.evaluate(() => !!(document.querySelector('#iv-ecrire') || {}).disabled);
    if (!re) throw new Error('le bouton doit s\'éteindre : repasser la variation compterait le stock deux fois');
    const motifIv = await win.evaluate(() => { const m = document.querySelector('#iv-motifs'); return m && m.offsetParent ? m.textContent : ''; });
    if (!/passée/.test(motifIv)) throw new Error('le bouton éteint doit dire pourquoi, sous lui (U-23) : « ' + motifIv + ' »');
    ok('une écriture STK en brouillard, et le bouton s\'éteint');
  } else {
    // Le stock compté vaut exactement celui des comptes : c'est un cas légitime, et l'écran doit
    // le DIRE plutôt que de proposer un bouton qui ne ferait rien.
    const motif = await win.evaluate(() => (document.querySelector('#c-livres') || {}).textContent || '');
    if (!/aucune écriture à passer|exactement celui des comptes/.test(motif)) {
      throw new Error('le bouton est éteint sans que l\'écran dise pourquoi');
    }
    ok('rien à écrire, et l\'écran dit pourquoi');
  }
  await shot('10-fin');

  console.log('\n' + '─'.repeat(60));
  if (errors.length) { console.log('erreurs JS :'); errors.forEach(e => console.log('  ' + e)); }
  console.log('erreurs JS : ' + errors.length);
  console.log('captures : ' + OUT);
  await app.close();
  if (errors.length) process.exit(1);
  console.log('\n' + pas + ' étapes — les biens s\'amortissent, et le stock se compte.');
})().catch(async e => { console.error(e); process.exit(1); });
