// La boucle complète, dans deux VRAIES applications Electron :
//   cabinet : créer le cabinet → exporter le fichier d'appairage
//   entreprise : importer l'appairage → clôturer un mois → fabriquer le paquet
//   cabinet : importer le paquet → le dossier apparaît, les mois se lisent, une pièce s'ouvre
// C'est le seul test qui prouve que le plan tient debout de bout en bout.
const { playwright, RACINE, ELECTRON } = require('./harnais');
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
// On clique le VRAI bouton du menu d'actions, repéré par son rang : un e2e qui rejoue le code
// qu'il teste ne prouve rien, et les sélecteurs à pseudo-classes imbriquées ne passent pas partout.
async function cliquerAction(win, libelle) {
  const i = await win.evaluate(l => [...document.querySelectorAll('.row-menu .rm-l')]
    .findIndex(x => x.textContent.trim() === l), libelle);
  if (i < 0) {
    const dispo = await win.evaluate(() => [...document.querySelectorAll('.row-menu .rm-l')].map(x => x.textContent.trim()));
    throw new Error(`le menu ne propose pas « ${libelle} » — il offre : ${dispo.join(', ')}`);
  }
  await win.click(`.row-menu button >> nth=${i}`);
  await win.waitForTimeout(500);
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
  // On reconnaît chaque écran de l'assistant à CE QU'IL CONTIENT, jamais à son numéro : compter les
  // « Suivant » se périme à la version suivante. Ce test-ci comptait, et il était cassé depuis que
  // la 7.22.0 a inséré l'écran du régime fiscal — personne ne s'en est aperçu parce qu'on ne l'avait
  // pas relancé. C'est la règle de la 7.28.0, apprise sur `e2e:entreprise`, à appliquer partout.
  for (let g = 0; g < 15 && await ew.$('#setup'); g++) {
    if (await ew.$('#sf-form input[name=name]')) {
      await ew.fill('#sf-form input[name=name]', 'Ébénisterie Test SUARL');
      await ew.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
      await ew.fill('#sf-form textarea[name=address]', 'Rue des Oliviers\n2000 Tunis');
    }
    if (await ew.$('[data-act="batiment"]')) { await ew.click('[data-act="batiment"]'); await ew.waitForSelector('[data-act="batiment"].sel'); }
    await ew.click('#sf-next'); await ew.waitForTimeout(150);
  }
  await ew.waitForFunction(() => !document.querySelector('#setup'));

  await ew.evaluate(() => { location.hash = '#/parametres'; });
  await ew.waitForSelector('#set-tabs');
  // On reconnaît l'onglet à ce qu'il CONTIENT, jamais à son libellé : les onglets des Paramètres
  // ont été renommés et réorganisés en 7.30.0, et un test qui les nomme se périme à chaque refonte.
  await ew.evaluate(() => {
    const cible = document.querySelector('#p-exemple');
    const sec = cible && cible.closest('[data-pane]');
    const b = sec && [...document.querySelectorAll('#set-tabs button')].find(x => x.dataset.tab === sec.dataset.pane);
    if (b) b.click();
  });
  await ew.waitForTimeout(400);
  await ew.click('#load-demo'); await ew.waitForTimeout(400);
  const ok0 = await ew.$('#modal-root #ok'); if (ok0) await ok0.click();
  await ew.waitForFunction(() => location.hash === '#/dashboard');
  console.log('4. entreprise installée, démo chargée');

  // appairage du cabinet
  await ent.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] }); }, pairFile);
  await ew.evaluate(() => { location.hash = '#/parametres'; });
  await ew.waitForSelector('#set-tabs');
  await ew.evaluate(() => {
    const cible = document.querySelector('#p-cabinet');
    const sec = cible && cible.closest('[data-pane]');
    const b = sec && [...document.querySelectorAll('#set-tabs button')].find(x => x.dataset.tab === sec.dataset.pane);
    if (b) b.click();
  });
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
  // Fabriquer un paquet pose jusqu'à DEUX questions, et elles n'ont pas la même forme :
  //   1. `demoBlock` (7.6.0) — trois sorties, « Continuer quand même » est `#b` ;
  //   2. le mois non clôturé — deux sorties, « Fabriquer » est `#ok`.
  // Ce test ne répondait qu'à `#ok` : depuis la 7.6.0 il restait planté devant la première, et son
  // attente de trois minutes finissait par expirer. Personne ne l'a vu, parce qu'il n'avait pas
  // été relancé — et c'est pourtant LE parcours qui prouve la chaîne entreprise → paquet → cabinet.
  for (let q = 0; q < 3; q++) {
    const modale = await ew.waitForSelector('#modal-root .modal', { timeout: 4000 }).catch(() => null);
    if (!modale) break;
    const b = await ew.$('#modal-root #b');
    const ok = b || await ew.$('#modal-root #ok');
    if (!ok) break;
    await ok.click(); await ew.waitForTimeout(500);
  }
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

  // La clé de secours est réclamée au PREMIER import (9.1.0) : c'est la seconde où le cabinet a
  // quelque chose à perdre. Elle n'est jamais bloquante — « Plus tard » existe, l'import est fait.
  // On la reconnaît à ce qu'elle CONTIENT, jamais à son rang (règle 7.29.0).
  await win.waitForTimeout(400);
  const demandeCle = await win.evaluate(() => {
    const m = document.querySelector('#modal-root .modal-bg');
    return m && /clé de secours/i.test(m.textContent) ? m.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  });
  if (demandeCle) {
    const plusTard = (await win.textContent('#modal-root #no')).trim();
    if (plusTard === 'Annuler') throw new Error('« Annuler » n\'annule rien ici : l\'import est déjà fait — le bouton doit dire « Plus tard »');
    await win.click('#modal-root #no');
    console.log(`9 bis. clé de secours réclamée au premier import, « ${plusTard} » disponible`);
  } else {
    throw new Error('la clé de secours n\'a pas été réclamée au premier import');
  }

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

  // ---- Les livres du dossier (9.1.0) : le cabinet LIT une comptabilité dans le paquet reçu.
  // C'est la démonstration de la version : le comptable ouvre la fiche de son client et voit un
  // livre-journal, un grand livre, une balance et un lettrage — sans ouvrir un seul CSV.
  // Depuis la 9.2.2 la fiche est en trois onglets : la comptabilité vit dans le sien. On clique
  // l'onglet comme un comptable — reconnu à ce qu'il porte, pas à son rang.
  await win.click('#d-tabs button[data-tab=comptabilite]');
  await win.waitForSelector('#c-compta', { timeout: 10000 });
  await win.waitForSelector('#c-tabs button[data-tab=journal]', { timeout: 20000 });
  const journal = await win.evaluate(() => {
    const t = document.querySelector('#c-livres table.list');
    if (!t) return null;
    const pied = [...t.querySelectorAll('tfoot td')].map(td => td.textContent.trim());
    return { lignes: t.querySelectorAll('tbody tr').length, pied, entetes: [...t.querySelectorAll('thead th')].map(th => th.textContent.trim()) };
  });
  if (!journal || !journal.lignes) throw new Error('le livre-journal du dossier est vide');
  // Débit = crédit sur le total de la sélection entière : c'est la seule chose que ce livre affirme.
  const [dJ, cJ] = journal.pied.slice(-3, -1);
  if (dJ !== cJ) throw new Error(`le livre-journal ne tombe pas juste : ${dJ} ≠ ${cJ}`);
  console.log(`12 bis. livre-journal : ${journal.lignes} lignes, débit = crédit = ${dJ}`);
  await shot(win, 'livres-journal');

  // La balance, et son verdict écrit en toutes lettres.
  await win.click('#c-tabs button[data-tab=balance]');
  await win.waitForSelector('#lv-verdict');
  const bal = await win.evaluate(() => {
    const v = document.querySelector('#lv-verdict');
    const t = document.querySelector('#c-livres table.list');
    return { verdict: v ? v.textContent.trim() : '', comptes: t ? t.querySelectorAll('tbody tr').length : 0,
      pied: t ? [...t.querySelectorAll('tfoot td')].map(x => x.textContent.trim()) : [] };
  });
  if (!/Équilibrée/.test(bal.verdict)) throw new Error('la balance du cabinet n\'est pas équilibrée : ' + bal.verdict);
  console.log(`12 ter. balance : ${bal.comptes} comptes · ${bal.verdict}`);
  await shot(win, 'livres-balance');

  // Le grand livre et le lettrage s'ouvrent, et disent ce qu'ils savent — y compris ce qu'ils ne
  // savent PAS : il n'y a pas d'à-nouveau dans un livre lu mois par mois, et l'écran l'écrit.
  await win.click('#c-tabs button[data-tab=grand-livre]');
  // On reconnaît un compte à ce qu'il EST (`.gl-compte`), jamais à la balise qui le titrait : depuis
  // la 9.4.5 chaque compte est replié sur sa ligne de synthèse, et le `h2` que ce parcours attendait
  // n'existe plus. C'est le motif de la 7.28.0, une fois de plus — un e2e ancré sur une forme se
  // périme à la refonte suivante.
  await win.waitForSelector('#c-livres .gl-compte .gl-nom');
  const gl = await win.evaluate(() => ({
    comptes: document.querySelectorAll('#c-livres .gl-compte').length,
    // Replié, un compte doit quand même porter son solde : un plan de comptes sans chiffres
    // n'apprend rien, et c'est toute la raison d'être du repli.
    soldes: [...document.querySelectorAll('#c-livres .gl-compte .gl-solde')].filter(x => /Solde/.test(x.textContent)).length,
    ouverture: /ouverture inconnue/i.test(document.querySelector('#c-livres').textContent)
  }));
  if (!gl.comptes) throw new Error('le grand livre est vide');
  if (gl.soldes !== gl.comptes) throw new Error(`${gl.comptes} comptes mais ${gl.soldes} soldes visibles : un compte replié sans son chiffre n'apprend rien`);
  if (!gl.ouverture) throw new Error('le grand livre doit DIRE qu\'il n\'a pas d\'à-nouveau');
  await win.click('#c-tabs button[data-tab=lettrage]');
  await win.waitForSelector('#lv-verdict');
  const let1 = (await win.textContent('#lv-verdict')).trim();
  // Un écart de lettrage est ATTENDU sur un livre lu mois par mois, sans à-nouveau : un règlement
  // reçu ce mois-ci pour une facture d'un mois précédent n'a pas sa facture en face. L'écran doit
  // l'EXPLIQUER, pas le crier — du orange sur une situation normale apprend à ignorer l'orange.
  const tonLettrage = await win.evaluate(() => (document.querySelector('#lv-verdict') || {}).className || '');
  if (/warn-box/.test(tonLettrage)) throw new Error('un écart normal ne se dit pas en avertissement : ' + let1);
  if (!/ok-box|info-box/.test(tonLettrage)) throw new Error('le verdict du lettrage n\'a pas de ton : ' + tonLettrage);
  if (/info-box/.test(tonLettrage) && !/mois par mois/.test(let1)) throw new Error('l\'écart doit être EXPLIQUÉ, pas seulement affiché');
  console.log(`12 quater. grand livre : ${gl.comptes} comptes, ouverture annoncée inconnue · lettrage : ${let1.slice(0, 80)}`);
  await shot(win, 'livres-lettrage');
  await win.click('#c-tabs button[data-tab=journal]');

  // Les cinq boutons fantômes de la ligne d'un paquet sont devenus un menu d'actions (7.29.0) :
  // on passe par le VRAI bouton et le VRAI menu, comme un comptable.
  // On vise le menu de la ligne d'un PAQUET, pas « le premier menu de la page » : depuis la 9.1.0
  // le bloc Comptabilité s'insère avant, et ses lignes portent leur propre menu. Cinquième fois
  // que `nth=0` se périme sur un écran qui gagne un tableau — on ancre sur ce que la page CONTIENT.
  // Les paquets ont leur onglet (9.2.2) : le menu ne se clique que visible.
  await win.click('#d-tabs button[data-tab=paquets]');
  await win.waitForTimeout(500);
  const menuPaquet = await win.evaluate(() => {
    const panneaux = [...document.querySelectorAll('.panel')];
    const p = panneaux.find(x => /Paquets reçus/.test(x.querySelector('h2') ? x.querySelector('h2').textContent : ''));
    if (!p) return '';
    const b = p.querySelector('[data-rowmenu]');
    if (!b) return '';
    b.id = 'e2e-menu-paquet';
    return b.id;
  });
  if (!menuPaquet) throw new Error('aucun menu d\'actions dans le panneau « Paquets reçus »');
  await win.click('#e2e-menu-paquet');
  await win.waitForSelector('.row-menu');
  await cliquerAction(win, 'Ouvrir le paquet');
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
  let trouve = false;
  for (const id of ids) {
    // L'onglet Paquets, par son ADRESSE : le menu qu'on cherche est celui d'une LIGNE de paquet.
    // Depuis la 9.4.8 l'en-tête de la fiche porte lui aussi un menu (les gestes rares), et prendre
    // « le premier [data-rowmenu] venu » tombait dessus — un menu qui n'a pas d'« Accuser
    // réception », dans un onglet où les lignes sont masquées. On vise ce qu'on cherche.
    await win.evaluate(i => { location.hash = '#/dossier/' + encodeURIComponent(i) + '/paquets'; }, id);
    await win.waitForTimeout(500);
    const b = await win.$('section[data-onglet=paquets] table.list [data-rowmenu]');
    if (!b) continue;
    await b.click();
    await win.waitForSelector('.row-menu');
    const dispo = await win.evaluate(() => [...document.querySelectorAll('.row-menu .rm-l')].map(x => x.textContent.trim()));
    if (dispo.includes('Accuser réception')) { await cliquerAction(win, 'Accuser réception'); trouve = true; break; }
    await win.keyboard.press('Escape'); await win.waitForTimeout(200);
  }
  if (!trouve) throw new Error('aucune action « Accuser réception » sur la fiche du client qui vient d\'envoyer');
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

  // ---------- 13 ter. LA SIGNATURE, et le LIVRE (9.2.0) ----------
  //
  // Les deux nouveautés de la 9.2.0, dans l'application réelle et par les vrais écrans. C'est le
  // seul endroit qui prouve que la chaîne tient de bout en bout : l'entreprise a signé, le cabinet
  // a vérifié et épinglé, et le livre se crée à partir de ce qui a été reçu.
  // On lit par le VRAI pont, pas par une globale posée pour le test : une variable de débogage en
  // production est du code qui ne sert qu'ici, et un test qui rejoue le code qu'il teste ne prouve
  // rien (6.8.1).
  const dossierSigne = await win.evaluate(async () => {
    const st = await window.cabinet.state();
    const x = (st.dossiers || []).find(y => !y.demo) || (st.dossiers || [])[0] || {};
    return { id: x.id || '', empreinte: x.cleEmpreinte || '', epingleLe: x.cleEpingleeLe || '', paquets: (x.packs || []).length };
  });
  if (!dossierSigne.empreinte) throw new Error('le cabinet n\'a pas épinglé la clé du client : le paquet n\'était pas signé, ou la vérification ne s\'est pas faite');
  if (!/^[0-9A-F]{4}(-[0-9A-F]{4}){4}$/.test(dossierSigne.empreinte)) throw new Error('empreinte de clé mal formée : ' + dossierSigne.empreinte);
  if (!dossierSigne.epingleLe) throw new Error('l\'épinglage doit être daté');
  console.log(`13 ter. signature : le cabinet a épinglé la clé du client — ${dossierSigne.empreinte}`);

  // Le livre n'existe pas encore : l'écran doit le DIRE et offrir les deux gestes, jamais créer
  // un livre en silence.
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForTimeout(300);
  // L'adresse profonde (9.2.2) : `#/dossier/<id>/comptabilite` ouvre la fiche SUR son onglet —
  // c'est ce qui permet à une autre page d'y emmener directement.
  await win.evaluate(id => { location.hash = '#/dossier/' + id + '/comptabilite'; }, dossierSigne.id);
  await win.waitForSelector('#c-livres #c-tabs', { timeout: 15000 });
  const avantLivre = await win.evaluate(() => ({
    relire: !!document.querySelector('#lv-relire'),
    reprendre: !!document.querySelector('#lv-reprendre'),
    dit: /n'a pas encore de livre/.test(document.querySelector('#c-livres').textContent)
  }));
  if (!avantLivre.dit) throw new Error('un dossier sans livre doit le dire');
  if (!avantLivre.relire || !avantLivre.reprendre) throw new Error('les deux gestes doivent être là : relire les paquets, ou reprendre le dossier');
  await shot(win, 'livre-absent');

  // « Créer le livre à partir des paquets reçus » : le geste que fera tout cabinet dont le client
  // est déjà sur SkanFact.
  await win.click('#lv-relire');
  await win.waitForSelector('#modal-root .modal', { timeout: 20000 });
  const rapportLivre = (await win.textContent('#modal-root .modal')).replace(/\s+/g, ' ');
  if (!/écriture/.test(rapportLivre)) throw new Error('le compte rendu ne dit pas ce qui est entré : ' + rapportLivre.slice(0, 120));
  await win.click('#modal-root #ok');
  await win.waitForTimeout(500);
  const livre = await win.evaluate(() => {
    const t = document.querySelector('#c-livres').textContent;
    return {
      bandeau: /Le livre de/.test(t),
      brouillard: !!document.querySelector('#lv-brouillard'),
      lignesBr: document.querySelectorAll('#c-livres tr.br-ligne').length
    };
  });
  if (!livre.bandeau) throw new Error('l\'écran doit dire qu\'il montre désormais LE LIVRE, pas les paquets');
  if (!livre.brouillard) throw new Error('la case « Voir le brouillard » manque');
  console.log(`13 quater. le livre est créé à partir des paquets reçus — ${rapportLivre.slice(0, 90)}`);
  await shot(win, 'livre-cree');

  // Le mois reçu était PROVISOIRE : ses écritures entrent donc en brouillard, et un brouillard
  // n'entre dans aucune balance tant qu'on ne le demande pas.
  const brAvant = await win.evaluate(() => {
    const cb = document.querySelector('#lv-brouillard');
    return { coche: cb.checked, lignes: document.querySelectorAll('#c-livres tbody tr').length };
  });
  await win.click('#lv-brouillard');
  await win.waitForTimeout(400);
  const brApres = await win.evaluate(() => document.querySelectorAll('#c-livres tbody tr').length);
  if (brAvant.coche) throw new Error('le brouillard ne doit pas être affiché par défaut');
  if (brApres <= brAvant.lignes) throw new Error(`cocher « Voir le brouillard » doit montrer PLUS de lignes (${brAvant.lignes} → ${brApres})`);
  const nbBr = await win.evaluate(() => document.querySelectorAll('#c-livres tr.br-ligne').length);
  if (!nbBr) throw new Error('une écriture en brouillard doit se distinguer à l\'œil (classe .br-ligne)');
  console.log(`13 quinquies. brouillard : ${brAvant.lignes} ligne(s) sans, ${brApres} avec — ${nbBr} marquée(s)`);
  await shot(win, 'livre-brouillard');

  // Valider une écriture, par le VRAI menu de ligne. Elle prend son numéro et ne se modifie plus.
  await win.evaluate(() => {
    const tr = document.querySelector('#c-livres tr.br-ligne');
    tr.scrollIntoView({ block: 'center' });
  });
  await win.click('#c-livres tr.br-ligne [data-rowmenu]');
  await win.waitForSelector('.row-menu', { timeout: 5000 });
  const actions = await win.evaluate(() => [...document.querySelectorAll('.row-menu button')].map(b => b.textContent.trim()));
  if (!actions.some(a => /Valider/.test(a))) throw new Error('le menu d\'une écriture en brouillard doit offrir « Valider » : ' + actions.join(' · '));
  // Un BROUILLARD se supprime : il n'a pas de numéro, il ne laisse aucun trou, et c'est toute la
  // raison d'être d'un brouillard (9.3.0). L'assertion d'avant exigeait le contraire — elle décrivait
  // l'état du jour, où rien ne se supprimait encore, pas la règle. Ce qui ne se supprime JAMAIS,
  // c'est une VALIDÉE, et c'est vérifié plus bas, après la validation.
  if (!actions.some(a => /Supprimer ce brouillard/.test(a))) {
    throw new Error('un brouillard doit pouvoir se supprimer : ' + actions.join(' · '));
  }
  await shot(win, 'livre-menu');
  await win.evaluate(() => {
    [...document.querySelectorAll('.row-menu button')].find(b => /Valider/.test(b.textContent)).click();
  });
  await win.waitForSelector('#modal-root #ok', { timeout: 5000 });
  const question = (await win.textContent('#modal-root .modal')).replace(/\s+/g, ' ');
  if (!/contre-passant|contre-passer/i.test(question)) throw new Error('la question doit dire comment on corrige après : ' + question.slice(0, 120));
  await win.click('#modal-root #ok');
  await win.waitForTimeout(600);
  // L'ANNÉE est celle que l'écran affiche, jamais l'année courante : le paquet de ce parcours est
  // de 2025, et lire le livre de 2026 aurait rendu un livre vide — une assertion qui échoue sur du
  // code juste (piège de la période écrite en dur, 7.17.0).
  const anneeLivre = await win.evaluate(() => {
    const m = (document.querySelector('#c-livres') || {}).textContent || '';
    return (m.match(/Le livre de (\d{4})/) || [])[1] || ((document.querySelector('#lv-annee') || {}).value || '');
  });
  if (!/^\d{4}$/.test(anneeLivre)) throw new Error('impossible de savoir quel exercice l\'écran montre : ' + anneeLivre);
  const apresValidation = await win.evaluate(async ([id, annee]) => {
    const r = await window.cabinet.livre(id, annee);
    const l = r.livre || { ecritures: [] };
    return {
      validees: l.ecritures.filter(e => e.statut === 'validee').length,
      numeros: l.ecritures.filter(e => e.numero).map(e => e.numero).sort((a, b) => a - b)
    };
  }, [dossierSigne.id, anneeLivre]);
  // Le numéro naît à la validation, et la suite est 1..n sans trou : c'est l'invariant du livre.
  if (!apresValidation.validees) throw new Error('la validation n\'a rien validé');
  apresValidation.numeros.forEach((n, i) => {
    if (n !== i + 1) throw new Error(`la numérotation a un trou : ${apresValidation.numeros.join(',')}`);
  });
  console.log(`13 sexies. validation : ${apresValidation.validees} validée(s), n° ${apresValidation.numeros.join(',')}`);
  await shot(win, 'livre-validee');

  // Et l'autre moitié de la règle : une VALIDÉE ne se modifie ni ne se supprime — jamais, par aucun
  // chemin. On le demande au pont lui-même, c'est-à-dire au vrai chemin, pas à ce que l'écran
  // affiche : un bouton absent ne prouve rien si la porte, elle, reste ouverte.
  const refus = await win.evaluate(async ([id, annee]) => {
    const r = await window.cabinet.livre(id, annee);
    const v = (r.livre.ecritures || []).find(e => e.statut === 'validee');
    if (!v) return { pas: 'aucune validée à éprouver' };
    const essai = async fn => { try { await fn(); return 'PASSÉ'; } catch (e) { return String(e.message || e); } };
    return {
      mod: await essai(() => window.cabinet.modifierEcriture(id, annee, v.id, { libelle: 'trafiquée' })),
      sup: await essai(() => window.cabinet.supprimerEcriture(id, annee, v.id))
    };
  }, [dossierSigne.id, anneeLivre]);
  if (refus.pas) throw new Error(refus.pas);
  if (refus.mod === 'PASSÉ') throw new Error('une écriture VALIDÉE s\'est laissée modifier');
  if (refus.sup === 'PASSÉ') throw new Error('une écriture VALIDÉE s\'est laissée supprimer');
  if (!/contre-passe/.test(refus.mod)) throw new Error('le refus ne dit pas par quoi remplacer le geste : ' + refus.mod);
  console.log('13 septies. une validée ne se modifie ni ne se supprime — elle se contre-passe');

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
