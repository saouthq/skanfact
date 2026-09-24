// SkanFact 9.8.0 — la clôture d'exercice et le FLUX RETOUR, dans les DEUX applications réelles.
//
// C'est le jumeau du test de parité, dans l'autre sens : le cabinet clôture, produit son fichier,
// le client l'importe — et les deux doivent dire le même résultat. Sans ce flux, le bilan du
// cabinet et celui du client divergent pour toujours, et personne ne s'en aperçoit avant le
// contrôle.
//
// Ce qu'aucun test pur ne peut prouver : que le fichier écrit sur le DISQUE par une application est
// relu par l'autre, signature comprise ; que l'exercice se verrouille vraiment chez le client ; et
// qu'un dossier non signé le DIT au lieu de passer en silence.
const { fermer, playwright, RACINE, ELECTRON, ongletCompta, ongletComptaPresent } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'cloture');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-cloture-'));
const errors = [];
let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };
const MDP = 'mot-de-passe-cabinet';
// Une phrase de l'écran est coupée par les retours à la ligne de la SOURCE : `textContent` les
// garde, donc « liasse fiscale » y devient « liasse\n      fiscale ». On aplatit les espaces avant
// de juger — sinon le test accuse du texte parfaitement juste.
const plat = s => String(s || '').replace(/\s+/g, ' ');

// Le fichier de clôture est écrit par une boîte de dialogue « Enregistrer sous ». On la remplace
// dans le PROCESSUS PRINCIPAL, comme le fait e2e:justificatif pour le sélecteur de fichier : c'est
// le seul moyen de faire passer un parcours par le VRAI chemin d'écriture.
const CIBLE = path.join(dir, 'cloture.skanclose');

(async () => {
  // ============================================================ le cabinet
  étape('Le cabinet : ouvrir un livre et le clôturer');
  const cab = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'cab')}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  await cab.evaluate(({ dialog }, cible) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: cible });
  }, CIBLE);
  const wc = await cab.firstWindow();
  wc.on('pageerror', e => errors.push('CABINET PAGEERROR: ' + e.message));
  wc.on('console', m => { if (m.type() === 'error') errors.push('CABINET CONSOLE: ' + m.text()); });
  const attendreC = (ms = 350) => wc.waitForTimeout(ms);
  await wc.setViewportSize({ width: 1440, height: 900 });
  await wc.waitForSelector('#lock-form');
  await wc.fill('#lock-pw', MDP); await wc.fill('#lock-pw2', MDP); await wc.click('#lock-go');
  await wc.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  for (let g = 0; g < 14 && await wc.$('#setup'); g++) {
    if (await wc.$('#w-name')) await wc.fill('#w-name', 'Cabinet Clôture');
    if (await wc.$('#w-skip')) await wc.click('#w-skip'); else if (await wc.$('#w-next')) await wc.click('#w-next');
    await attendreC(300);
  }
  await wc.waitForFunction(() => !document.querySelector('#setup'), { timeout: 15000 });
  await wc.evaluate(() => { location.hash = '#/dossiers'; });
  await wc.waitForSelector('#demo-on', { timeout: 8000 });
  await wc.click('#demo-on');
  await wc.waitForSelector('tr[data-id]', { timeout: 20000 });
  // Le dossier qui porte le plus d'écritures : « le premier de la liste » n'en porte qu'un mois, et
  // un exercice d'un mois ne prouve pas grand-chose d'une clôture (règle 9.4.7).
  const cible = await wc.evaluate(async () => {
    const ids = [...document.querySelectorAll('tr[data-id]')].map(t => t.dataset.id);
    const annee = String(new Date().getFullYear());
    let best = null;
    for (const id of ids) {
      await window.cabinet.relireLesPaquets(id, annee).catch(() => null);
      const r = await window.cabinet.livre(id, annee).catch(() => null);
      const n = r && r.livre ? (r.livre.ecritures || []).length : 0;
      if (!best || n > best.n) best = { id, n };
    }
    return best;
  });
  if (!cible || !cible.n) throw new Error('aucun dossier de l\'exemple ne porte d\'écritures');
  await wc.evaluate(o => { location.hash = '#/dossier/' + encodeURIComponent(o.id) + '/comptabilite'; }, cible);
  await wc.waitForSelector('#c-livres', { timeout: 15000 });
  // 10.12.0 (U-06) — les écrans du livre sont rangés en groupes : on attend que le livre soit là
  // (le sélecteur de groupes n'existe qu'avec un livre), puis on trouve l'écran par ses groupes.
  await wc.waitForSelector('#c-groupes', { timeout: 30000 });
  if (!(await ongletComptaPresent(wc, 'exercice'))) throw new Error('le livre est ouvert et l\'écran « Exercice » reste introuvable');
  ok(`dossier ouvert — ${cible.n} écritures`);

  // ------------------------------------------------ les contrôles nomment sans bloquer
  étape('Les contrôles NOMMENT, et la clôture passe quand même');
  await ongletCompta(wc, 'exercice');
  await wc.waitForFunction(() => {
    const e = document.querySelector('#c-livres');
    return e && !e.textContent.includes('Lecture de l\'exercice');
  }, { timeout: 20000 });
  await attendreC(400);
  await wc.screenshot({ path: path.join(OUT, '01-exercice.png') });
  const ecran = plat(await wc.evaluate(() => (document.querySelector('#c-livres') || {}).textContent || ''));
  // RETOURNÉE en 10.0.0, et c'est la dix-septième fois que ce motif revient : l'assertion exigeait
  // « ce n'est pas la liasse fiscale NCT 01 ». Elle décrivait l'ÉTAT du jour — la liasse n'existait
  // pas — et la 10.0.0 l'a livrée : garder la phrase la ferait dire faux (7.3.0, vu de l'autre
  // côté). La RÈGLE, elle, ne bouge pas : **cet écran ne prétend pas être la liasse**. Il dit ce
  // qu'il est (des états déduits de la balance), il porte son « À VÉRIFIER », et il MÈNE à la
  // liasse plutôt que de la nier.
  if (!/déduits de la balance/i.test(ecran) || !/À VÉRIFIER/i.test(ecran)) {
    throw new Error('l\'écran des états doit dire d\'où viennent ses chiffres, et porter son « À VÉRIFIER »');
  }
  if (!(await wc.$('#cl-liasse'))) throw new Error('l\'écran des états doit mener à la liasse');
  const controles = await wc.$$eval('#c-livres .panel table tbody tr', trs => trs.length);
  if (controles < 6) throw new Error('les six contrôles devraient être affichés, vu ' + controles);
  // La RÈGLE : actif = passif, et l'écran le dit. Deux formes légitimes (T-23) : le vert « Actif =
  // passif, au millime » sur un exercice qui a ses à-nouveaux, ou l'avertissement « livre sans
  // à-nouveaux » — qui affirme lui aussi l'équilibre, sans prétendre que le bilan se montre à une
  // banque. Un déséquilibre, lui, s'écrit « Actif et passif diffèrent ».
  if (/Actif et passif diffèrent/.test(ecran)) throw new Error('le bilan de ce dossier ne s\'équilibre pas');
  const equilibre = /Actif = passif, au millime/.test(ecran) || /Actif et passif s'équilibrent/.test(ecran);
  if (!equilibre) throw new Error('l\'écran ne dit pas si le bilan s\'équilibre');
  const sansAN = await wc.$('#cl-sans-ouverture');
  ok(`six contrôles affichés, bilan équilibré${sansAN ? ' (livre sans à-nouveaux, et l\'écran le dit)' : ''}, et la limite des états est écrite`);

  // ------------------------------------------------ la liasse (C-08, C-09 — 10.10.0)
  étape('La liasse tombe juste, et chaque rubrique s\'ouvre sur un VRAI tableau');
  await wc.click('#cl-liasse');
  await wc.waitForFunction(() => {
    const e = document.querySelector('#c-livres');
    return e && !e.textContent.includes('Lecture de la liasse') && e.querySelector('[data-rub]');
  }, { timeout: 20000 });
  const liasse = await wc.evaluate(() => ({
    juste: /Actif = passif, et le résultat du bilan est celui de l'état de résultat/.test(document.querySelector('#c-livres').textContent),
    orphelins: !!document.querySelector('#li-orphelins'),
    texte: document.querySelector('#c-livres').textContent.replace(/\s+/g, ' ').slice(0, 300)
  }));
  if (!liasse.juste || liasse.orphelins) throw new Error('la liasse de l\'exemple ne tombe pas juste : ' + liasse.texte);
  await wc.click('#c-livres [data-rub]');
  await wc.waitForSelector('.modal-bg', { timeout: 10000 });
  const fen = await wc.evaluate(() => {
    const m = document.querySelector('.modal-bg');
    return { tableau: !!m.querySelector('table td'), brut: /<table|&lt;/.test(m.textContent) };
  });
  if (!fen.tableau || fen.brut) throw new Error('« Voir les comptes » n\'affiche pas un vrai tableau : ' + JSON.stringify(fen));
  await wc.screenshot({ path: path.join(OUT, '01b-liasse-comptes.png') });
  await wc.click('.modal-bg #ok');
  await wc.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 10000 });
  await ongletCompta(wc, 'exercice');
  await wc.waitForSelector('#cl-liasse', { timeout: 20000 });
  ok('liasse équilibrée sans compte orphelin, et une rubrique s\'ouvre sur son tableau de comptes');

  // ------------------------------------------------ clôturer
  étape('Clôturer : définitif, tracé, et impossible deux fois');
  await wc.click('#cl-cloturer');
  await wc.waitForSelector('.modal-bg', { timeout: 10000 });
  await wc.screenshot({ path: path.join(OUT, '02-question.png') });
  const question = plat(await wc.evaluate(() => (document.querySelector('.modal-bg') || {}).textContent || ''));
  if (!/motif/i.test(question)) throw new Error('la question doit annoncer que rouvrir exigera un motif');
  await wc.click('.modal-bg .btn-primary');
  await wc.waitForFunction(() => /clos/i.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 15000 });
  await attendreC(900);
  const clos = await wc.evaluate(async () => {
    const id = decodeURIComponent((location.hash.split('/')[2] || ''));
    const a = document.querySelector('#lv-annee');
    const r = await window.cabinet.livre(id, a ? a.value : String(new Date().getFullYear()));
    return { clos: r.livre.exercice.clos, par: r.livre.exercice.closPar, audit: (r.livre.audit || []).some(x => x.quoi === 'clôture') };
  });
  if (!clos.clos) throw new Error('l\'exercice n\'est pas clos');
  if (!clos.audit) throw new Error('la clôture ne laisse pas de trace d\'audit');
  // 10.10.0 — un exercice clos ne propose plus « Clôturer » (un bouton éteint dont le motif ne
  // vivait que dans une infobulle) : c'est « Rouvrir » qui prend sa place.
  const boutons = await wc.evaluate(() => ({ clore: !!document.querySelector('#cl-cloturer'), rouvrir: !!document.querySelector('#cl-rouvrir') }));
  if (boutons.clore || !boutons.rouvrir) throw new Error('un exercice clos doit proposer « Rouvrir » et plus « Clôturer » : ' + JSON.stringify(boutons));
  ok('exercice clos, tracé, et « Rouvrir » remplace « Clôturer »');

  // ------------------------------------------------ rouvrir exige un motif
  étape('Rouvrir sans motif est refusé ; avec un motif, c\'est écrit');
  await wc.click('#cl-rouvrir');
  await wc.waitForSelector('#cl-motif', { timeout: 10000 });
  await wc.click('.modal-bg #ok');
  await wc.waitForFunction(() => /motif/i.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 10000 });
  const refus = await wc.evaluate(() => document.querySelector('#toast').textContent);
  if (!/motif/i.test(refus)) throw new Error('le refus doit nommer le motif : ' + refus);
  // C-14 : le refus se MONTRE — le champ a le curseur et se dit invalide, pas seulement un message.
  const champ = await wc.evaluate(() => {
    const t = document.querySelector('.modal-bg #cl-motif');
    return { focus: document.activeElement === t, aria: t.getAttribute('aria-invalid'), faute: !!t.closest('.champ-faute') };
  });
  if (!champ.focus || champ.aria !== 'true' || !champ.faute) throw new Error('le refus sans motif ne montre pas le champ : ' + JSON.stringify(champ));
  await wc.fill('.modal-bg #cl-motif', 'Facture d\'électricité de décembre reçue après la clôture');
  await wc.click('.modal-bg #ok');
  await wc.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 10000 });
  await attendreC(900);
  // Puis on re-clôture : c'est l'état dans lequel le fichier doit partir.
  await wc.click('#cl-cloturer');
  await wc.waitForSelector('.modal-bg', { timeout: 10000 });
  await wc.click('.modal-bg .btn-primary');
  await wc.waitForFunction(() => /clos/i.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 15000 });
  await attendreC(900);
  ok('refus sans motif, réouverture tracée, puis re-clôturé : ' + refus.slice(0, 60));

  // ------------------------------------------------ l'exercice suivant s'ouvre
  étape('L\'exercice suivant s\'ouvre pendant que celui-ci se termine');
  // 10.10.0 (C-12) — le geste finit sur une question : aller à l'exercice qu'on vient d'ouvrir. On
  // reste ici pour la suite du parcours, et on vérifie que le sélecteur propose désormais N+1.
  const anneeAvant = await wc.evaluate(() => (document.querySelector('#lv-annee') || {}).value);
  await wc.click('#cl-suivant');
  await wc.waitForFunction(() => /nouveaux/i.test((document.querySelector('.modal-bg h2') || {}).textContent || ''), { timeout: 15000 });
  await wc.click('.modal-bg #no');
  await wc.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 10000 });
  await attendreC(600);
  const options = await wc.evaluate(() => [...document.querySelectorAll('#lv-annee option')].map(o => o.value));
  if (!options.includes(String(Number(anneeAvant) + 1))) throw new Error(`le sélecteur ne propose pas ${Number(anneeAvant) + 1} après l'avoir ouvert : ${options.join(', ')}`);
  const suivant = await wc.evaluate(async () => {
    const id = decodeURIComponent((location.hash.split('/')[2] || ''));
    const y = Number((document.querySelector('#lv-annee') || {}).value || new Date().getFullYear()) + 1;
    const r = await window.cabinet.livre(id, String(y));
    const an = ((r.livre || {}).ecritures || []).filter(e => e.source === 'an');
    return { n: an.length, statut: (an[0] || {}).statut, date: (an[0] || {}).date, lignes: (an[0] || {}).lignes.length };
  });
  if (suivant.n !== 1) throw new Error('il devrait y avoir une pièce d\'à-nouveaux, vu ' + suivant.n);
  if (suivant.statut !== 'brouillard') throw new Error('les à-nouveaux arrivent en brouillard, vu ' + suivant.statut);
  if (!/-01-01$/.test(suivant.date)) throw new Error('les à-nouveaux tombent au 1er janvier, vu ' + suivant.date);
  // Les REFAIRE ne doit pas les doubler : un exercice qui bouge encore change son report.
  await wc.click('#cl-suivant');
  await wc.waitForFunction(() => /refaits|posés/i.test((document.querySelector('.modal-bg h2') || {}).textContent || ''), { timeout: 15000 });
  // Cette fois on y VA : le geste doit mener au livre de N+1, sur son brouillard.
  await wc.click('.modal-bg #ok');
  await wc.waitForFunction(y => (document.querySelector('#lv-annee') || {}).value === y, String(Number(anneeAvant) + 1), { timeout: 15000 });
  await attendreC(900);
  const apres = await wc.evaluate(async y => {
    const id = decodeURIComponent((location.hash.split('/')[2] || ''));
    const r = await window.cabinet.livre(id, String(y));
    return ((r.livre || {}).ecritures || []).filter(e => e.source === 'an').length;
  }, Number(anneeAvant) + 1);
  if (apres !== 1) throw new Error('refaire les à-nouveaux les a doublés : ' + apres);
  // Et on revient sur l'exercice clos pour la suite (le fichier de clôture).
  await wc.selectOption('#lv-annee', String(anneeAvant));
  await wc.waitForFunction(y => (document.querySelector('#lv-annee') || {}).value === y, String(anneeAvant), { timeout: 10000 });
  await attendreC(1200);
  await ongletCompta(wc, 'exercice');
  await wc.waitForSelector('#cl-fichier', { timeout: 15000 });
  ok(`${suivant.lignes} lignes d'à-nouveaux en brouillard au ${suivant.date}, ${Number(anneeAvant) + 1} atteignable depuis le sélecteur, et les refaire ne double rien`);

  // ------------------------------------------------ le fichier de clôture
  étape('Produire le dossier de clôture pour le client');
  await wc.click('#cl-fichier');
  await wc.waitForSelector('#cl-mdp', { timeout: 10000 });
  await wc.click('.modal-bg #ok');
  await wc.waitForFunction(() => /clôture écrit|PDF/i.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 30000 });
  await attendreC(600);
  if (!fs.existsSync(CIBLE)) throw new Error('le fichier .skanclose n\'a pas été écrit');
  const taille = fs.statSync(CIBLE).size;
  const Z = require(path.join(RACINE, 'src', 'zip.js'));
  const contenu = Z.zipRead(fs.readFileSync(CIBLE)).map(f => f.name).sort();
  ['cloture.json', 'etats.html', 'manifeste.json', 'signature.json'].forEach(n => {
    if (!contenu.includes(n)) throw new Error('le dossier de clôture ne contient pas ' + n);
  });
  // C-13 : le document qui part chez le client s'écrit comme l'écran — virgule décimale, devise,
  // dates JJ/MM/AAAA. Il sortait en « 76 493.448 », sans « DT », avec des dates ISO.
  const etatsHtml = Z.zipRead(fs.readFileSync(CIBLE)).find(f => f.name === 'etats.html').data().toString('utf8');
  const points = (etatsHtml.match(/\d[\d\u202f\u00a0 ]*\.\d{3}\b/g) || []).length;
  const virgules = (etatsHtml.match(/\d[\d\u202f\u00a0 ]*,\d{3}\b/g) || []).length;
  if (points || !virgules || !/ DT</.test(etatsHtml) || /du \d{4}-\d{2}-\d{2}/.test(etatsHtml)) {
    throw new Error(`les états du client ne sont pas à la française : ${points} montants à point, ${virgules} à virgule`);
  }
  await wc.screenshot({ path: path.join(OUT, '03-fichier.png') });
  const resultatCabinet = JSON.parse(Z.zipRead(fs.readFileSync(CIBLE)).find(f => f.name === 'cloture.json').data().toString('utf8')).resultat;
  ok(`${contenu.length} fichiers, ${Math.round(taille / 1024)} Ko${contenu.includes('etats.pdf') ? ', PDF compris' : ' (sans PDF)'} — résultat ${resultatCabinet}`);
  await fermer(cab);

  // ============================================================ le client
  étape('Le client : importer le dossier, et voir son exercice se VERROUILLER');
  const ent = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'ent')}`, path.join(RACINE, 'src', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  await ent.evaluate(({ dialog }, cible) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [cible] });
  }, CIBLE);
  const we = await ent.firstWindow();
  we.on('pageerror', e => errors.push('ENTREPRISE PAGEERROR: ' + e.message));
  we.on('console', m => { if (m.type() === 'error') errors.push('ENTREPRISE CONSOLE: ' + m.text()); });
  const attendreE = (ms = 350) => we.waitForTimeout(ms);
  await we.setViewportSize({ width: 1440, height: 900 });
  await we.waitForSelector('#setup', { timeout: 30000 });
  // On reconnaît chaque écran de l'assistant à CE QU'IL CONTIENT, jamais à son rang (règle 7.28.0).
  for (let g = 0; g < 16 && await we.$('#setup'); g++) {
    if (await we.$('#sf-form input[name=name]')) {
      await we.fill('#sf-form input[name=name]', 'Client Clôture SUARL');
      await we.fill('#sf-form input[name=matricule]', '1234567X/A/P/000');
    }
    if (await we.$('[data-act="batiment"]')) { await we.click('[data-act="batiment"]'); await we.waitForSelector('[data-act="batiment"].sel'); }
    await we.click('#sf-next'); await attendreE(180);
  }
  await we.waitForFunction(() => !document.querySelector('#setup'), { timeout: 20000 });
  await we.evaluate(() => { location.hash = '#/compta'; });
  await attendreE(700);
  // L'onglet Clôtures — reconnu par ce qu'il CONTIENT, jamais par son rang (règle 7.30.0).
  await we.evaluate(() => {
    const b = [...document.querySelectorAll('#c-tabs button, .tabs button')].find(x => /Clôture/i.test(x.textContent));
    if (b) b.click();
  });
  await we.waitForSelector('#cl-import', { timeout: 15000 });
  await we.screenshot({ path: path.join(OUT, '04-client-avant.png') });
  const avant = plat(await we.evaluate(() => (document.querySelector('#view') || {}).textContent || ''));
  if (!/Aucune clôture reçue/.test(avant)) throw new Error('l\'état vide de la clôture reçue ne s\'annonce pas');
  await we.click('#cl-import');
  await we.waitForSelector('.modal-bg', { timeout: 20000 });
  const annonce = plat(await we.evaluate(() => (document.querySelector('.modal-bg') || {}).textContent || ''));
  if (!/VERROUILL/i.test(annonce)) throw new Error('la question doit annoncer le verrouillage AVANT d\'écrire : ' + annonce.slice(0, 120));
  if (!/à-nouveaux? officiels?/i.test(annonce)) throw new Error('la question doit annoncer les à-nouveaux officiels');
  // L'origine : le fichier EST signé, donc l'écran doit le dire — et pas l'inverse. Depuis la 10.13.0
  // c'est la PREMIÈRE signature reçue de ce cabinet : l'écran dit qu'elle sera retenue, et « origine
  // vérifiée » ne se dira qu'aux envois suivants, quand elle aura quelque chose à quoi se comparer.
  if (!/Signé par ton cabinet/.test(annonce) || !/première signature/.test(annonce)) throw new Error('la première signature du cabinet ne se dit pas retenue : ' + annonce.slice(0, 260));
  if (/Origine vérifiée/.test(annonce)) throw new Error('« Origine vérifiée » sur un premier fichier : il n\'y a encore rien à quoi le comparer');
  await we.screenshot({ path: path.join(OUT, '05-client-question.png') });
  await we.click('.modal-bg .btn-primary');
  await we.waitForFunction(() => /reprise/i.test((document.querySelector('#toast') || {}).textContent || ''), { timeout: 15000 });
  await attendreE(900);
  const etat = await we.evaluate(() => ({
    clotures: (window.__data && window.__data.clotures || []).length,
    closedUntil: (window.__data || {}).closedUntil || '',
    resultat: ((window.__data && window.__data.clotures || [])[0] || {}).resultat,
    origine: ((window.__data && window.__data.clotures || [])[0] || {}).origine,
    verrouille: ((window.__data && window.__data.clotures || [])[0] || {}).verrouille,
    au: ((window.__data && window.__data.clotures || [])[0] || {}).au,
    ecran: ((document.querySelector('#view') || {}).textContent || '').replace(/\s+/g, ' ')
  }));
  if (etat.clotures !== 1) throw new Error('la clôture n\'a pas été enregistrée');
  if (etat.origine !== 'prouvee') throw new Error('l\'origine devrait être prouvée, vue ' + etat.origine);
  const retenue = await we.evaluate(() => ((window.__data || {}).cabinetSignature || {}).empreinte || '');
  if (!/^[0-9A-F]{4}(-[0-9A-F]{4}){4}$/.test(retenue)) throw new Error('la signature du cabinet n\'a pas été retenue à l\'import : « ' + retenue + ' »');
  if (!/signée/.test(etat.ecran)) throw new Error('l\'écran doit montrer que le dossier est signé');
  // LE VERROU, et le défaut que ce parcours a trouvé : le jeu d'exemple porte l'exercice EN COURS,
  // donc sa fin est dans le futur — et on ne verrouille pas une période qui n'est pas terminée.
  // Les deux issues sont légitimes ; ce qui ne l'est pas, c'est d'avaler un refus en silence et de
  // laisser croire que l'exercice est verrouillé alors qu'il ne l'est pas.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (etat.au <= aujourdhui) {
    if (!etat.closedUntil) throw new Error('un exercice TERMINÉ doit être verrouillé chez le client');
    if (etat.verrouille !== true) throw new Error('le verrou devrait être posé');
    if (!/verrouillé/.test(etat.ecran)) throw new Error('l\'écran doit montrer le verrou');
    ok(`clôture reprise, signée, verrouillé jusqu'au ${etat.closedUntil}`);
  } else {
    if (etat.verrouille !== false) throw new Error('un exercice non terminé ne peut pas être verrouillé');
    if (!/verrou en attente/.test(etat.ecran)) throw new Error('l\'écran doit DIRE que le verrou attend : ' + etat.ecran.slice(0, 200));
    if (!/pas encore terminé/.test(etat.ecran)) throw new Error('l\'écran doit dire POURQUOI le verrou attend');
    ok(`clôture reprise et signée ; l'exercice finit le ${etat.au}, le verrou attend — et l'écran le dit`);
  }
  await we.screenshot({ path: path.join(OUT, '06-client-apres.png') });

  // ------------------------------------------------ un faux cabinet (10.13.0)
  // Le même dossier, re-signé par une AUTRE clé : exactement ce que fabriquerait quelqu'un qui
  // connaît le matricule du client (il est public). Avant la 10.13.0, l'écran disait « Origine
  // vérifiée » — la signature correspond à la clé que le fichier présente, et c'était tout.
  étape('Un fichier signé par une AUTRE clé est refusé, en nommant les deux empreintes');
  const brut = fs.readFileSync(CIBLE);
  const fichiers = Z.zipRead(brut).map(f => ({ name: f.name, data: f.data() }));
  const man = fichiers.find(f => f.name === 'manifeste.json');
  if (!man) throw new Error('le dossier de clôture n\'a pas de manifeste : le faux ne peut pas se fabriquer');
  const intrus = Z.generateClientKeys();
  const faux = fichiers.map(f => f.name === 'signature.json'
    ? { name: f.name, data: Buffer.from(JSON.stringify(Z.signManifest(man.data, intrus.privateKey, intrus.publicKey)), 'utf8') } : f);
  const FAUX = path.join(dir, 'faux.skanclose');
  fs.writeFileSync(FAUX, Z.zipBuffer(faux));
  await ent.evaluate(({ dialog }, cible) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [cible] }); }, FAUX);
  await we.click('#cl-import');
  await we.waitForSelector('.modal-bg', { timeout: 20000 });
  const refusFaux = plat(await we.evaluate(() => (document.querySelector('.modal-bg') || {}).textContent || ''));
  if (!/autre clé/.test(refusFaux) || !refusFaux.includes(retenue) || !refusFaux.includes(Z.keyFingerprint(intrus.publicKey))) {
    throw new Error('le faux cabinet n\'est pas refusé en nommant les deux empreintes : ' + refusFaux.slice(0, 300));
  }
  if (/Reprendre la clôture/.test(refusFaux)) throw new Error('le faux cabinet arrive jusqu\'à la question « Reprendre la clôture »');
  // Le réflexe : Entrée. Sur cette question-là, il ANNULE (le curseur est sur « Annuler ») — un
  // « oui » par habitude est exactement ce qu'un imposteur espère. Rien ne change, la signature
  // retenue reste la bonne.
  // « Rien n'a changé » ne suffit pas (10.9.1) : accepter la clé n'importe rien tout de suite — une
  // seconde question suit —, et un Entrée qui re-clique le bouton de la page rouvre l'import. Les
  // deux laissent une fenêtre ouverte : on exige qu'il n'en reste AUCUNE.
  await we.keyboard.press('Enter');
  await attendreE(600);
  const apresFaux = await we.evaluate(() => ({ n: (window.__data.clotures || []).length, sig: ((window.__data || {}).cabinetSignature || {}).empreinte,
    fenetres: [...document.querySelectorAll('#modal-root .modal-bg')].map(x => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 80)) }));
  if (apresFaux.fenetres.length) throw new Error('Entrée n\'a pas annulé la question sur l\'autre clé : ' + JSON.stringify(apresFaux.fenetres));
  if (apresFaux.n !== 1 || apresFaux.sig !== retenue) throw new Error('refuser le faux a changé quelque chose : ' + JSON.stringify(apresFaux));
  ok(`faux cabinet refusé (attendue ${retenue}, reçue ${Z.keyFingerprint(intrus.publicKey)}) ; Entrée annule, rien n'a changé`);

  // ------------------------------------------------ LA parité : le même résultat des deux côtés
  étape('Le jumeau du test de parité : le MÊME résultat des deux côtés');
  if (Math.abs(Number(etat.resultat) - Number(resultatCabinet)) > 0.001) {
    throw new Error(`le résultat diverge : ${resultatCabinet} chez le cabinet, ${etat.resultat} chez le client`);
  }
  ok(`résultat ${resultatCabinet} des deux côtés, au millime`);

  await fermer(ent);
  console.log('\n' + '─'.repeat(60));
  if (errors.length) { console.log('erreurs JS :'); errors.forEach(e => console.log('  ' + e)); }
  console.log('erreurs JS : ' + errors.length);
  console.log('captures : ' + OUT);
  if (errors.length) process.exit(1);
  console.log('\n' + pas + ' étapes — le cabinet clôture, le client reprend, et les deux disent la même chose.');
})().catch(async e => { console.error(e); process.exit(1); });
