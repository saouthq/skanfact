// L'accueil tient ses promesses (7.18.0).
//
// Un écran qui NOMME un ensemble et n'ouvre pas le bon, un compteur qui se coche parce qu'un
// assistant l'a rempli, un total calculé sur un extrait : rien de tout ça ne plante, et rien ne se
// voit dans une console. Ce test refait les gestes dans l'application réelle.
//
//   1. « n devis acceptés à facturer » : la liste d'arrivée les montre TOUS, y compris ceux de
//      l'année dernière (le filtre d'année ne doit pas se rearmer tout seul).
//   2. « n attestations à réclamer » amène au panneau des retenues, pas en haut de la page.
//   3. « Documents récents » est un extrait : pas de total.
//   4. « Générer maintenant » sur un contrat suspendu demande, et se défait.
//   5. La recherche des Relances filtre les quatre tableaux.
//   6. On répond à un devis depuis la liste, et on peut revenir en arrière.
//
//   xvfb-run -a node test/e2e/accueil.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-accueil-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(280); };

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Accueil SUARL');
      await win.fill('#sf-form input[name=matricule]', '5566778Z/A/P/000');
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

  // ------------------------------------------------------ 1. le filtre d'année ne se rearme pas
  j.etape('« Facturer » montre TOUS les devis acceptés, même ceux de l\'an dernier');
  // On s'assure qu'il en existe de deux années différentes, et qu'ils sont assez nombreux pour que
  // le re-filtrage automatique (> 25 pièces) se déclenche.
  const prep = await win.evaluate(() => {
    const d = window.__data, C = window.SkanCore;
    const an = Number(C.today().slice(0, 4));
    // Le jeu d'exemple n'a qu'une douzaine de devis : le re-filtrage automatique se déclenche
    // au-delà de 25 pièces du type. On en fabrique assez, sur deux exercices, sinon le défaut ne
    // peut pas se produire et le test passerait sans rien prouver.
    const modele = d.documents.find(x => x.type === 'devis');
    for (let i = 0; i < 30; i++) {
      d.documents.push({ ...modele, id: 'q-test-' + i, number: `DEV-TEST-${i}`,
        status: 'accepté', date: `${i % 2 ? an : an - 1}-0${(i % 9) + 1}-1${i % 9}`, payments: [] });
    }
    const acceptes = d.documents.filter(x => x.type === 'devis' && x.status === 'accepté');
    return { total: acceptes.length, vieux: acceptes.filter(x => (x.date || '').startsWith(String(an - 1))).length,
      devis: d.documents.filter(x => x.type === 'devis').length };
  });
  if (prep.devis <= 25 || !prep.vieux) throw new Error(`le jeu d'exemple ne permet pas ce test (${prep.devis} devis, ${prep.vieux} acceptés anciens)`);
  await aller('#/dashboard');
  await win.waitForSelector('#todo-list');
  const ligne = await win.evaluate(() => {
    const li = [...document.querySelectorAll('#todo-list li')].find(l => /à facturer/.test(l.textContent));
    if (li && li.hidden) { const m = document.querySelector('#todo-more'); if (m) m.click(); }
    return !!li;
  });
  if (!ligne) throw new Error('la ligne « devis acceptés à facturer » n\'apparaît pas');
  await win.waitForTimeout(220);
  await win.evaluate(() => {
    const li = [...document.querySelectorAll('#todo-list li')].find(l => /à facturer/.test(l.textContent));
    li.querySelector('button').click();
  });
  await win.waitForTimeout(400);
  const arrivee = await win.evaluate(() => ({
    hash: location.hash,
    annee: (document.querySelector('#yr') || {}).value,   // le sélecteur d'année de la liste s'appelle « yr »
    note: (document.querySelector('.f-note') || {}).textContent || '',
    lignes: document.querySelectorAll('table.list tbody tr').length
  }));
  if (!/devis/.test(arrivee.hash)) throw new Error('la ligne ne mène pas aux devis : ' + arrivee.hash);
  if (arrivee.annee) throw new Error(`la liste s'est re-filtrée toute seule sur l'année « ${arrivee.annee} » et cache une partie des devis annoncés`);
  // Le bandeau porte la sélection entière (les listes sont paginées depuis la 2.2.0) : c'est lui
  // qu'on lit, jamais le nombre de <tr> affichés.
  const montres = Number((arrivee.note.match(/(\d+) sur/) || [, 0])[1]);
  if (montres < prep.total) throw new Error(`la liste n'annonce que ${montres} devis alors que « À faire » en comptait ${prep.total}`);
  j.ok(`${prep.devis} devis dont ${prep.total} acceptés (${prep.vieux} de l'an dernier) — aucun filtre d'année à l'arrivée`);

  // ------------------------------------------------------ 2. le raccourci vise un panneau
  j.etape('« Attestations à réclamer » amène AU panneau des retenues');
  await win.evaluate(() => {
    // On s'assure qu'il y a de quoi : une facture émise avec retenue à la source, sans attestation.
    const d = window.__data;
    const f = d.documents.find(x => x.type === 'facture' && x.status !== 'brouillon' && x.status !== 'annulée');
    if (f) { f.withholdingRate = 5; f.withholdingCertificate = ''; }
  });
  await aller('#/dashboard');
  await win.waitForSelector('#todo-list');
  const attest = await win.evaluate(() => {
    const m = document.querySelector('#todo-more'); if (m) m.click();
    const li = [...document.querySelectorAll('#todo-list li')].find(l => /attestation/i.test(l.textContent));
    if (!li) return false;
    li.querySelector('button').click(); return true;
  });
  if (!attest) throw new Error('aucune ligne « attestations » : le test ne prouve rien');
  await win.waitForSelector('#p-rs-clients', { timeout: 4000 });
  const marque = await win.evaluate(() => {
    const el = document.querySelector('#p-rs-clients');
    return { flash: el.classList.contains('flash'), haut: Math.round(el.getBoundingClientRect().top) };
  });
  if (!marque.flash) throw new Error('le panneau visé n\'est pas marqué : rien ne dit où on vient d\'atterrir');
  j.ok(`panneau des retenues amené à ${marque.haut} px du haut et marqué`);

  // ------------------------------------------------------ 3. l'extrait n'a pas de total
  j.etape('« Documents récents » est un extrait : aucun total');
  await aller('#/dashboard');
  await win.waitForSelector('.panel h2');
  const recents = await win.evaluate(() => {
    const p = [...document.querySelectorAll('.panel')].find(x => /Documents récents/.test((x.querySelector('h2') || {}).textContent || ''));
    if (!p) return null;
    return { titre: p.querySelector('h2').textContent.replace(/\s+/g, ' ').trim(), pied: !!p.querySelector('tfoot'), liens: p.querySelectorAll('a.btn').length };
  });
  if (!recents) throw new Error('le panneau « Documents récents » n\'existe pas sur le jeu d\'exemple');
  if (recents.pied) throw new Error('« Documents récents » affiche encore un total sur un extrait de huit pièces');
  if (!/sur \d+/.test(recents.titre)) throw new Error(`le titre ne dit pas que c'est un extrait : « ${recents.titre} »`);
  if (recents.liens < 2) throw new Error('rien ne mène aux listes complètes');
  j.ok(`« ${recents.titre} », sans pied, ${recents.liens} liens vers les listes`);

  // ------------------------------------------------------ 4. générer un contrat suspendu
  j.etape('« Générer maintenant » sur un contrat suspendu demande, puis se défait');
  const contrat = await win.evaluate(() => {
    const d = window.__data;
    const r = (d.recurring || [])[0];
    if (!r) return null;
    r.active = false;
    return { id: r.id, nextDate: r.nextDate, lastIssued: r.lastIssued || '', docs: d.documents.length };
  });
  if (!contrat) throw new Error('le jeu d\'exemple n\'a aucun contrat récurrent');
  await aller('#/contrats');
  await win.waitForSelector('[data-gen]');
  await win.evaluate(i => { document.querySelector(`[data-gen="${i}"]`).click(); }, contrat.id);
  const question = await win.waitForSelector('#modal-root #ok', { timeout: 4000 }).catch(() => null);
  if (!question) throw new Error('générer un contrat suspendu ne demande rien');
  const texte = await win.$eval('#modal-root', e => e.textContent);
  if (!/suspendu/.test(texte)) throw new Error('la question ne dit pas que le contrat est suspendu : ' + texte.slice(0, 120));
  await question.click();
  await win.waitForSelector('#toast-undo', { timeout: 4000 });
  const cree = await win.evaluate(i => {
    const d = window.__data, r = d.recurring.find(x => x.id === i);
    return { docs: d.documents.length, nextDate: r.nextDate };
  }, contrat.id);
  if (cree.docs !== contrat.docs + 1) throw new Error(`aucun brouillon créé (${cree.docs} au lieu de ${contrat.docs + 1})`);
  if (cree.nextDate === contrat.nextDate) throw new Error('l\'échéance n\'a pas été repoussée : le test ne prouve rien');
  await win.click('#toast-undo');
  await win.waitForTimeout(400);
  const defait = await win.evaluate(i => {
    const d = window.__data, r = d.recurring.find(x => x.id === i);
    return { docs: d.documents.length, nextDate: r.nextDate, lastIssued: r.lastIssued || '' };
  }, contrat.id);
  if (defait.docs !== contrat.docs) throw new Error(`« Annuler » n'a pas supprimé le brouillon (${defait.docs})`);
  if (defait.nextDate !== contrat.nextDate) throw new Error(`« Annuler » n'a pas remis l'échéance (${defait.nextDate} au lieu de ${contrat.nextDate})`);
  if (defait.lastIssued !== contrat.lastIssued) throw new Error('« Annuler » n\'a pas remis la dernière émission');
  j.ok(`brouillon créé (échéance repoussée au ${cree.nextDate}) puis entièrement défait`);

  // ------------------------------------------------------ 5. la recherche des Relances
  j.etape('La recherche des Relances filtre les quatre tableaux');
  await aller('#/relances');
  await win.waitForSelector('#rel-q');
  const compter = () => win.$$eval('table.list tbody tr', trs => trs.length);
  const avant = await compter();
  if (avant < 3) throw new Error('trop peu de lignes dans les Relances pour juger d\'un filtre');
  await win.fill('#rel-q', 'zzzzznexistepas');
  await win.waitForTimeout(320);
  const apres = await compter();
  if (apres !== 0) throw new Error(`une recherche sans résultat laisse ${apres} ligne(s) : un tableau ignore le filtre`);
  await win.fill('#rel-q', '');
  await win.waitForTimeout(320);
  j.ok(`${avant} ligne(s) au départ, 0 sur une recherche sans résultat`);

  // ------------------------------------------------------ 6. répondre à un devis depuis la liste
  j.etape('On répond à un devis depuis la liste, et on revient en arrière');
  await win.evaluate(() => {
    const d = window.__data;
    const q = d.documents.find(x => x.type === 'devis' && x.number);
    if (q) q.status = 'envoyé';
  });
  await aller('#/devis');
  await win.waitForSelector('#st');
  // La liste est paginée et triée : on la filtre sur « envoyé » pour que la pièce visée soit à l'écran.
  await win.selectOption('#st', 'envoyé');
  await win.waitForTimeout(300);
  await win.waitForSelector('tbody [data-rowmenu]');
  const cible = await win.evaluate(() => {
    const b = document.querySelector('tbody [data-rowmenu]');
    return { id: b.dataset.rowmenu, statut: window.__data.documents.find(x => x.id === b.dataset.rowmenu).status };
  });
  if (cible.statut !== 'envoyé') throw new Error(`le devis visé est « ${cible.statut} », pas « envoyé »`);
  // Depuis la 7.28.0 la réponse vit dans le menu de la ligne, et elle pose une question : c'est le
  // geste demandé par le propriétaire — « ça ne me demande pas de confirmer mon choix ».
  await win.click('tbody tr:first-child [data-rowmenu]');
  await win.waitForSelector('.row-menu');
  const iAccepte = await win.evaluate(() => [...document.querySelectorAll('.row-menu .rm-l')]
    .findIndex(x => x.textContent.trim() === 'Le client a accepté'));
  if (iAccepte < 0) throw new Error('le menu de la ligne ne propose pas de répondre au devis');
  await win.click(`.row-menu button >> nth=${iAccepte}`);
  await win.waitForSelector('.modal');
  // « Accepter seulement » : on reste sur la liste, et le retour en arrière doit être offert.
  await win.click('.modal .modal-actions button:nth-of-type(2)');
  await win.waitForSelector('#toast-undo', { timeout: 4000 });
  const apresClic = await win.evaluate(i => window.__data.documents.find(x => x.id === i).status, cible.id);
  if (apresClic !== 'accepté') throw new Error(`le devis est resté « ${apresClic} »`);
  await win.click('#toast-undo');
  await win.waitForTimeout(400);
  const rendu = await win.evaluate(i => window.__data.documents.find(x => x.id === i).status, cible.id);
  if (rendu !== 'envoyé') throw new Error(`« Annuler » n'a pas remis le statut (« ${rendu} »)`);
  j.ok('envoyé → accepté → envoyé, sans jamais ouvrir la pièce');

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — l'accueil tient ses promesses.`);
})().catch(e => { console.error(e); process.exit(1); });
