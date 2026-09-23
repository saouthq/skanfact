// SkanFact Cabinet 9.5.0 — la banque, dans l'application RÉELLE.
//
// Ce que ce parcours prouve et qu'aucun test pur ne peut prouver : qu'un vrai fichier CSV, choisi
// par le sélecteur du système, traverse l'écran d'import, entre dans le livre, et que le
// rapprochement automatique ne pose QUE ce dont il est sûr.
//
// Il joue trois banques différentes avec trois formats de colonnes : c'est la réponse au « quelles
// banques, et quel format chacune exporte ? » qui bloquait cette version — on ne connaît aucun
// format, donc on n'en code aucun, et on prouve que l'association par NOM les absorbe.
const { playwright, RACINE, ELECTRON, montant, ongletCompta, ongletComptaPresent } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'banque');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-banque-'));
const userData = path.join(dir, 'cab');
const errors = [];
let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };

// Trois exports de banque, trois conventions. Aucune n'est celle d'une banque réelle : ce sont les
// trois FORMES qu'on rencontre — montant signé, débit/crédit séparés, et un fichier dont les
// en-têtes ne ressemblent à rien de connu.
const CSV_SIGNE = 'Date opération;Libellé;Référence;Montant\n'
  + '04/03/2026;VIREMENT RECU SARL TRABELSI;VIR-77;1 200,000\n'
  + '05/03/2026;PRELEVEMENT STEG MARS;;-89,300\n'
  + '06/03/2026;CHEQUE 4412;CH-4412;-250,000\n';
const CSV_DC = 'Date;Intitulé;Débit;Crédit\n'
  + '10/04/2026;REMISE CHEQUE;;500,000\n'
  + '12/04/2026;FRAIS DE TENUE DE COMPTE;12,500;\n';
const CSV_INCONNU = 'Jour;Ce que c\'est;Combien\n'
  + '03/05/2026;VIREMENT DIVERS;300,000\n';

(async () => {
  const f = (nom, contenu) => { const p = path.join(dir, nom); fs.writeFileSync(p, contenu, 'utf8'); return p; };
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
  const prochainFichier = async p => app.evaluate(({ dialog }, q) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [q] }); }, p);

  // Le livre relu depuis le processus principal : la vérité du DISQUE, pas ce que l'écran affiche.
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
    if (await win.$('#w-name')) await win.fill('#w-name', 'Cabinet Banque');
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
    // L'onglet Banque ne peut pas exister avant le livre : un relevé bancaire vit DANS le livre,
    // et un onglet qui mène à « il n'y a rien » est un onglet mort.
    if (await ongletComptaPresent(win, 'banque')) {
      throw new Error('l\'onglet Banque s\'affiche alors que le dossier n\'a pas encore de livre');
    }
    await win.click('#lv-relire');
    await win.waitForSelector('.modal-bg', { timeout: 30000 });
    await win.click('.modal-bg .btn-primary');
    await attendre(600);
  }
  // 10.12.0 (U-06) — les écrans du livre sont rangés en groupes : on attend que le livre soit là
  // (le sélecteur de groupes n'existe qu'avec un livre), puis on trouve l'écran par ses groupes.
  await win.waitForSelector('#c-groupes', { timeout: 25000 });
  if (!(await ongletComptaPresent(win, 'banque'))) throw new Error('le livre est ouvert et l\'écran « Banque » reste introuvable');
  ok('livre ouvert, et l\'onglet Banque est là');

  // ---------------------------------------------------------------- 2. l'état vide porte son geste
  étape('L\'onglet Banque, vide, propose l\'import');
  await ongletCompta(win, 'banque');
  await win.waitForSelector('#bq-import', { timeout: 10000 });
  const vide = await win.evaluate(() => (document.querySelector('#c-livres .empty') || {}).textContent || '');
  if (!/Aucun relevé/.test(vide)) throw new Error('l\'état vide doit dire ce qui manque : ' + vide.slice(0, 80));
  await shot('01-banque-vide');
  ok('état vide nommé, avec son bouton');

  // ---------------------------------------------------------------- 3. un relevé qui ne boucle pas
  étape('Un relevé dont le solde de fin est faux est REFUSÉ, avec l\'écart');
  await prochainFichier(f('mars.csv', CSV_SIGNE));
  await win.click('#bq-import');
  await win.waitForSelector('#rv-fichier', { timeout: 10000 });
  await win.fill('[name=banque]', 'Banque A');
  await win.click('#rv-fichier');
  await win.waitForFunction(() => /ligne/.test((document.querySelector('#rv-apercu') || {}).textContent || ''), { timeout: 10000 });
  const lues = await win.evaluate(() => (document.querySelector('#rv-apercu .ok-box') || {}).textContent || '');
  if (!/3 lignes lues/.test(lues)) throw new Error('trois lignes attendues, lu : ' + lues.trim().slice(0, 80));
  await shot('02-import-apercu');
  await win.fill('[name=debut]', '1000');
  await win.fill('[name=fin]', '2000');          // faux : 1000 + 860,700 = 1860,700
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => /ne se boucle pas/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 8000 });
  const refus = await win.evaluate(() => document.querySelector('#toast').textContent);
  if (!/139[.,]300/.test(refus)) throw new Error('le refus doit nommer l\'écart : ' + refus);
  ok('refus nommé : ' + refus.slice(0, 90));

  // ---------------------------------------------------------------- 4. le bon solde passe
  étape('Corrigé, le même relevé entre');
  await win.fill('[name=fin]', '1860,700');
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 10000 });
  await win.waitForSelector('#bq-releve', { timeout: 10000 });
  let L = await livre();
  if ((L.releves || []).length !== 1) throw new Error('le relevé n\'est pas sur le disque');
  if (L.releves[0].lignes.length !== 3) throw new Error('trois lignes attendues dans le livre');
  // Le signe est celui de la BANQUE : ce qui entre est positif, ce qui sort négatif.
  const signes = L.releves[0].lignes.map(l => Math.sign(l.montant));
  if (JSON.stringify(signes) !== JSON.stringify([1, -1, -1])) throw new Error('les signes de la banque sont perdus : ' + signes);
  await shot('03-releve-importe');
  ok('relevé importé, trois lignes, signes de la banque conservés');

  // ---------------------------------------------------------------- 5. deux fois le même fichier
  étape('Le MÊME fichier ne s\'importe pas deux fois');
  await prochainFichier(f('mars.csv', CSV_SIGNE));
  await win.click('#bq-import');
  await win.waitForSelector('#rv-fichier', { timeout: 10000 });
  await win.click('#rv-fichier');
  // T-08 : le doublon se voit DÈS le choix du fichier, avant qu'on ait tapé un solde, et le bouton
  // « Importer » s'éteint. Reprocher un solde faux sur un fichier déjà là faisait corriger un
  // chiffre pour rien. L'ancienne forme (cliquer, puis lire un refus) décrivait cet ordre-là.
  await win.waitForFunction(() => /déjà été importé/.test((document.querySelector('#rv-deja') || {}).textContent || ''), { timeout: 10000 });
  const okEteint = await win.evaluate(() => !!(document.querySelector('.modal-bg #ok') || {}).disabled);
  if (!okEteint) throw new Error('le bouton « Importer » reste allumé sur un doublon');
  // Échap ferme la fenêtre, comme chez un vrai utilisateur — et on ATTEND qu'elle ait disparu :
  // cliquer sur l'écran du dessous pendant qu'une fenêtre le couvre est le défaut de la 5.2.2,
  // et le parcours le reproduirait en accusant un bouton parfaitement sain.
  await win.keyboard.press('Escape');
  await win.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 8000 });
  L = await livre();
  if ((L.releves || []).length !== 1) throw new Error('un doublon est entré : ' + L.releves.length + ' relevés');
  ok('doublon refusé, un seul relevé sur le disque');

  // ------------------------------------------------------- 6. le rapprochement ne tranche pas seul
  étape('Rapprocher automatiquement : seul ce qui est certain se pose');
  await win.click('#bq-auto');
  await win.waitForFunction(() => /rapproch|Rien/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 15000 });
  const bilan = await win.evaluate(() => document.querySelector('#toast').textContent);
  await shot('04-rapprochement');
  L = await livre();
  const niveaux = L.releves[0].lignes.map(l => (l.rapprochement || {}).niveau);
  // Le jeu d'exemple ne porte pas forcément d'écriture au bon montant : ce qui est PROUVÉ ici, c'est
  // qu'aucune ligne n'est « certain » sans écriture en face, et qu'aucune n'est posée par « auto »
  // sur une ambiguïté. C'est la règle, pas un compte.
  L.releves[0].lignes.forEach(l => {
    const r = l.rapprochement || {};
    if (r.niveau === 'certain' && !r.ecritureId) throw new Error('« rapproché » sans écriture en face');
    if (r.niveau !== 'certain' && r.ecritureId) throw new Error('une ligne porte une écriture sans être rapprochée');
  });
  ok('états : ' + niveaux.join(', ') + ' — ' + bilan.slice(0, 60));

  // ----------------------------------------------------- 7. écrire l'écriture qui manque, et la lier
  étape('Une ligne sans réponse : écrire l\'écriture, la retenir, et la rapprocher du même geste');
  const sansReponse = await win.evaluate(() => {
    const tr = [...document.querySelectorAll('#c-livres tbody tr[data-lig]')]
      .find(x => /Sans réponse/.test(x.textContent));
    return tr ? tr.dataset.lig : '';
  });
  if (!sansReponse) throw new Error('aucune ligne « sans réponse » : le parcours ne prouve rien');
  await win.click(`tr[data-lig="${sansReponse}"] [data-rowmenu]`);
  await win.waitForSelector('.row-menu', { timeout: 5000 });
  await win.click('.row-menu button:has-text("Écrire l\'écriture manquante")');
  await win.waitForSelector('[name=compte]', { timeout: 8000 });
  // Sans règle connue, la contrepartie est VIDE : on ne verse pas d'office au 471. L'écran le dit.
  const contre = await win.evaluate(() => document.querySelector('.modal-bg [name=compte]').value);
  if (contre) throw new Error('la contrepartie devrait être vide tant qu\'aucune règle ne la donne : ' + contre);
  const message = await win.evaluate(() => (document.querySelector('.modal-bg .info-box') || {}).textContent || '');
  if (!/Aucune règle/.test(message)) throw new Error('l\'écran doit dire pourquoi le compte est vide');
  await shot('05-ecriture-proposee');
  await win.fill('.modal-bg [name=compte]', '6061');
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 10000 });
  await attendre(500);
  L = await livre();
  const ligneApres = L.releves[0].lignes.find(l => l.id === sansReponse);
  if ((ligneApres.rapprochement || {}).niveau !== 'certain') {
    throw new Error('l\'écriture créée doit rapprocher sa ligne du même geste');
  }
  const ecr = L.ecritures.find(e => e.id === ligneApres.rapprochement.ecritureId);
  if (!ecr || ecr.statut !== 'brouillard') throw new Error('l\'écriture proposée entre en BROUILLARD, jamais validée d\'office');
  if (!ecr.lignes.some(l => l.compte === '6061')) throw new Error('le compte choisi n\'est pas dans l\'écriture');
  ok('brouillard créé (jamais validé d\'office), ligne rapprochée');

  // ------------------------------------- 8. défaire, puis retrouver : le chemin heureux de l'auto
  // Sans cette étape, le parcours ne prouverait jamais qu'une ligne se rapproche VRAIMENT d'office
  // dans l'application réelle : le jeu d'exemple ne porte aucune écriture au montant d'un de nos
  // relevés, donc l'étape 6 n'a vu que des « sans réponse ». On défait le rapprochement qu'on vient
  // de poser — il DOIT se défaire, même « rapproché » — et on relance l'automatique : l'écriture
  // qu'on a créée est maintenant le seul candidat au bon montant, donc le verdict est « certain ».
  étape('Un rapprochement se défait, et l\'automatique le retrouve tout seul');
  await win.click(`tr[data-lig="${sansReponse}"] [data-rowmenu]`);
  await attendre(250);
  if (await win.$('.row-menu')) await win.click('.row-menu button:has-text("Défaire le rapprochement")');
  await attendre(600);
  L = await livre();
  if ((L.releves[0].lignes.find(l => l.id === sansReponse).rapprochement || {}).ecritureId) {
    throw new Error('« rapproché » doit se défaire : l\'automatique propose, le comptable décide');
  }
  await win.click('#bq-auto');
  await win.waitForFunction(() => /rapproch/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 15000 });
  L = await livre();
  const revenue = L.releves[0].lignes.find(l => l.id === sansReponse).rapprochement || {};
  if (revenue.niveau !== 'certain') throw new Error('un candidat unique doit revenir « certain », vu : ' + revenue.niveau);
  if (revenue.par !== 'auto') throw new Error('et posé par l\'automatique, pas à la main');
  ok('défait à la main, retrouvé « certain » par l\'automatique');

  // --------------------------------------------- 9. la règle retenue sert au relevé de la banque B
  étape('Le libellé retenu sert tout seul au relevé suivant');
  const retenu = await win.evaluate(async () => (await window.cabinet.state()).libelles || []);
  if (!retenu.length) throw new Error('rien n\'a été retenu : chaque relevé redemanderait le même travail');
  ok('retenu : ' + retenu.map(x => x.motif + ' → ' + x.compte).join(', '));

  // ------------------------------------------------- 9. une banque qui écrit Débit et Crédit
  étape('Une deuxième banque, deux colonnes Débit/Crédit — aucun code ne la connaît');
  await prochainFichier(f('avril.csv', CSV_DC));
  await win.click('#bq-import');
  await win.waitForSelector('#rv-fichier', { timeout: 10000 });
  await win.fill('[name=banque]', 'Banque B');
  await win.click('#rv-fichier');
  await win.waitForFunction(() => /ligne/.test((document.querySelector('#rv-apercu') || {}).textContent || ''), { timeout: 10000 });
  await win.fill('[name=debut]', '0');
  await win.fill('[name=fin]', '487,500');
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 10000 });
  L = await livre();
  const B = L.releves.find(r => r.banque === 'Banque B');
  if (!B) throw new Error('le relevé de la banque B n\'est pas entré');
  const mB = B.lignes.map(l => l.montant);
  if (JSON.stringify(mB) !== JSON.stringify([500, -12.5])) throw new Error('crédit moins débit : ' + JSON.stringify(mB));
  ok('deux colonnes lues par leur NOM : ' + mB.join(' / '));

  // ------------------------------------------------- 10. une banque dont on ne connaît rien
  étape('Une banque inconnue : l\'écran le DIT, et l\'association se fait à la main');
  await prochainFichier(f('mai.csv', CSV_INCONNU));
  await win.click('#bq-import');
  await win.waitForSelector('#rv-fichier', { timeout: 10000 });
  await win.fill('[name=banque]', 'Banque C');
  await win.click('#rv-fichier');
  await win.waitForFunction(() => /colonnes attendues/.test((document.querySelector('#rv-apercu') || {}).textContent || ''), { timeout: 10000 });
  await shot('06-csv-inconnu');
  const boutonImport = await win.evaluate(() => document.querySelector('.modal-bg #ok').disabled);
  if (!boutonImport) throw new Error('on ne doit pas pouvoir importer un fichier qu\'on n\'a pas su lire');
  // L'assistant : colonne → champ, une fois.
  await win.selectOption('[data-col=date]', '0');
  await win.selectOption('[data-col=libelle]', '1');
  await win.selectOption('[data-col=montant]', '2');
  await win.click('#rv-relire');
  await win.waitForFunction(() => /1 ligne lue/.test((document.querySelector('#rv-apercu') || {}).textContent || ''), { timeout: 10000 });
  await win.fill('[name=debut]', '0');
  await win.fill('[name=fin]', '300');
  await win.click('.modal-bg #ok');
  await win.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 10000 });
  L = await livre();
  if (!L.releves.some(r => r.banque === 'Banque C')) throw new Error('le relevé de la banque C n\'est pas entré');
  const memoire = await win.evaluate(async () => (await window.cabinet.state()).banques || {});
  if (!memoire['Banque C']) throw new Error('l\'association n\'a pas été retenue : chaque import la redemanderait');
  ok('association faite à la main puis RETENUE pour « Banque C »');

  // ------------------------------------------------- 11. retirer un relevé ne touche pas au journal
  étape('Retirer un relevé : les écritures qu\'il a servi à créer RESTENT');
  const avant = (await livre()).ecritures.length;
  await win.click('#bq-releve');
  await win.selectOption('#bq-releve', await win.evaluate(() => {
    const o = [...document.querySelectorAll('#bq-releve option')].find(x => /Banque C|05\//.test(x.textContent));
    return o ? o.value : document.querySelector('#bq-releve').value;
  }));
  await attendre(500);
  // Le bouton du relevé n'a qu'UNE action : `rowmenu.js` en fait alors un bouton NOMMÉ qui exécute
  // directement (règle 7.29.0 — deux clics et une lecture pour un choix unique, c'est ce qu'on
  // reprochait aux rangées de boutons). Le parcours accepte donc les deux formes : un test qui n'en
  // connaît qu'une accuserait du code juste le jour où une seconde action arrive.
  const btnRel = await win.$('[data-rowmenu^="REL:"]');
  const solo = await btnRel.evaluate(b => b.classList.contains('row-menu-solo'));
  if (solo && !/Retirer/.test(await btnRel.textContent())) {
    throw new Error('un bouton à action unique doit dire ce qu\'il fait : ' + (await btnRel.textContent()));
  }
  await btnRel.click();
  if (!solo) {
    await win.waitForSelector('.row-menu', { timeout: 5000 });
    await win.click('.row-menu button:has-text("Retirer ce relevé")');
  }
  await win.waitForSelector('.modal-bg', { timeout: 6000 });
  const question = await win.evaluate(() => document.querySelector('.modal-bg').textContent);
  if (!/RESTENT|restent/.test(question)) throw new Error('la question doit dire ce qui est gardé');
  await win.click('.modal-bg .btn-primary');
  await attendre(700);
  L = await livre();
  if (L.ecritures.length !== avant) throw new Error('des écritures ont disparu avec le relevé');
  ok('relevé retiré, ' + avant + ' écritures intactes');

  // ------------------------------------------------- 12. le lettrage, l'autre écran
  étape('Le lettrage est un AUTRE écran, avec sa balance âgée');
  await ongletCompta(win, 'lettrage');
  await win.waitForSelector('#lv-compte', { timeout: 10000 });
  const aAge = await win.evaluate(() => /par ancienneté/.test((document.querySelector('#c-livres') || {}).textContent || ''));
  const auto = await win.$('#lv-auto');
  if (!auto) throw new Error('le lettrage automatique doit être proposé quand un livre est ouvert');
  await auto.click();
  await win.waitForFunction(() => /lettre|Rien à lettrer/.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 15000 });
  const dit = await win.evaluate(() => document.querySelector('#toast').textContent);
  // Il DIT ce qu'il laisse : « 12 lignes traitées » laisserait croire que tout est réglé.
  if (!/ouverte/.test(dit)) throw new Error('le lettrage automatique doit dire ce qui RESTE ouvert : ' + dit);
  await shot('07-lettrage');
  ok((aAge ? 'balance âgée affichée ; ' : 'aucun impayé à vieillir ; ') + dit.slice(0, 70));

  // ------------------------------------------------- 13. les montants relus gardent leur signe
  étape('Les montants affichés se relisent avec leur signe');
  await ongletCompta(win, 'banque');
  await win.waitForSelector('#bq-releve', { timeout: 8000 });
  const affiches = await win.$$eval('#c-livres tbody tr[data-lig] td.r', tds => tds.map(t => t.textContent.trim()));
  const negatifs = affiches.map(montant).filter(v => v < 0);
  if (!negatifs.length) throw new Error('aucun montant négatif relu : le parcours ne prouve rien');
  ok(negatifs.length + ' montant(s) négatif(s) relus correctement');

  console.log('\n' + '─'.repeat(60));
  if (errors.length) { console.log('erreurs JS :'); errors.forEach(e => console.log('  ' + e)); }
  console.log('erreurs JS : ' + errors.length);
  console.log('captures : ' + OUT);
  await app.close();
  if (errors.length) process.exit(1);
  console.log('\n' + pas + ' étapes — la banque tient.');
})().catch(async e => { console.error(e); process.exit(1); });
