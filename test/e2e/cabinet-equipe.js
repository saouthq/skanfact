// SkanFact Cabinet 9.9.0 — DEUX postes, DEUX collaborateurs, dans les applications RÉELLES.
//
// Ce qu'il prouve, et qu'aucun test pur ne peut prouver : que les droits ferment ce qu'ils doivent
// fermer et RIEN d'autre, que la piste d'audit porte le NOM de la personne et pas celui du poste,
// et qu'une écriture validée par l'un n'est jamais perdue par l'autre. Le danger du partage n'est
// pas la panne, c'est le silence (3.2.0) — et un silence ne se voit que dans l'application.
//
// Deux postes de bureau du MÊME cabinet : le second reprend la base du premier par le vrai chemin
// (copie externe → « j'ai déjà un cabinet ailleurs »), sans quoi il ne pourrait pas déchiffrer ses
// livres — deux cabinets créés séparément ont deux sels, donc deux clés.
//
//   xvfb-run -a node test/e2e/cabinet-equipe.js
const { fermer, playwright, RACINE, ELECTRON, ongletComptaPresent } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'cabinet-equipe');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-equipe-'));
const POSTE1 = path.join(dir, 'poste-sonia');
const POSTE2 = path.join(dir, 'poste-amine');
const CLE_USB = path.join(dir, 'cle-usb');
fs.mkdirSync(CLE_USB, { recursive: true });
const MDP = 'mot-de-passe-cabinet';

let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };
const errors = [];

async function lancer(userData, tag) {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push(tag + ' PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push(tag + ' CONSOLE: ' + m.text()); });
  await win.setViewportSize({ width: 1440, height: 900 });
  return { app, win };
}
const attendre = (win, ms = 400) => win.waitForTimeout(ms);

// Les fichiers de livre d'un poste, où qu'ils soient rangés.
function livresDe(userData) {
  const out = [];
  (function marche(p) {
    let e; try { e = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const x of e) {
      const q = path.join(p, x.name);
      if (x.isDirectory()) marche(q);
      else if (/^livre-\d{4}\.json$/.test(x.name)) out.push(q);
    }
  })(userData);
  return out;
}

// Ajouter un collaborateur par le VRAI écran : le panneau des Réglages, sa fenêtre, ses champs.
async function ajouter(win, nom, role) {
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="cabinet"]');
  await win.waitForSelector('#eq-add:not([disabled])', { timeout: 10000 });
  await win.click('#eq-add');
  await win.waitForSelector('#modal-root #eq-nom');
  await win.fill('#modal-root #eq-nom', nom);
  await win.selectOption('#modal-root #eq-role', role);
  // Le détail du rôle suit la liste : choisir sans savoir ce que ça ouvre, c'est choisir au hasard.
  const detail = (await win.textContent('#modal-root #eq-detail') || '').trim();
  if (!detail) throw new Error(`le rôle « ${role} » ne dit pas ce qu'il ouvre`);
  await win.click('#modal-root #eq-ok');
  await win.waitForFunction(() => !document.querySelector('#modal-root #eq-nom'), null, { timeout: 8000 });
  await attendre(win, 500);
  ok(`${nom} — ${role} · « ${detail} »`);
}

async function jeSuis(win, nom) {
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="cabinet"]');
  await win.waitForSelector('#eq-je-suis', { timeout: 10000 });
  const id = await win.evaluate(n => {
    const o = [...document.querySelectorAll('#eq-je-suis option')].find(x => x.textContent.trim() === n);
    return o ? o.value : '';
  }, nom);
  if (!id) throw new Error(`« ${nom} » n'est pas proposé comme identité de ce poste`);
  await win.selectOption('#eq-je-suis', id);
  await attendre(win, 700);
  const dit = await win.textContent('#eq-moi');
  if (!dit.includes(nom)) throw new Error(`le bandeau ne dit pas qui travaille ici : « ${dit.trim()}  »`);
  ok(`ce poste est celui de ${nom}`);
}

// Ouvrir le premier dossier qui a des paquets, et créer son livre par le vrai geste.
async function ouvrirLivre(win) {
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#view table.list tbody tr[data-id]', { timeout: 15000 });
  const id = await win.evaluate(() => document.querySelector('#view table.list tbody tr[data-id]').dataset.id);
  await win.evaluate(x => { location.hash = `#/dossier/${x}/comptabilite`; }, id);
  await attendre(win, 900);
  if (await win.$('#lv-relire')) {
    await win.click('#lv-relire');
    await win.waitForSelector('.modal-bg', { timeout: 30000 });
    await win.click('.modal-bg .btn-primary');
    await attendre(win, 1500);
  }
  // 10.12.0 (U-06) — les écrans du livre sont rangés en groupes : on attend que le livre soit là
  // (le sélecteur de groupes n'existe qu'avec un livre), puis on trouve l'écran par ses groupes.
  await win.waitForSelector('#c-groupes', { timeout: 30000 });
  if (!(await ongletComptaPresent(win, 'saisie'))) throw new Error('le livre est ouvert et l\'écran « Saisie » reste introuvable');
  const annee = await win.evaluate(() => Number((document.querySelector('#lv-annee') || {}).value) || new Date().getFullYear());
  return { id, annee };
}

// Une pièce équilibrée, écrite par le PONT — c'est la porte de l'application, et c'est elle qui
// porte le garde-fou des droits. Rend l'erreur telle qu'un écran la recevrait.
const saisir = (win, d, libelle, compte) => win.evaluate(async o => {
  try {
    await window.cabinet.saisir(o.id, o.annee, {
      date: o.annee + '-03-04', journal: 'OD', piece: o.piece, libelle: o.libelle,
      lignes: [{ compte: o.compte, debit: 100 }, { compte: '706', credit: 100 }]
    });
    return { ok: true };
  } catch (e) { return { ok: false, message: String(e.message || e) }; }
}, { id: d.id, annee: d.annee, piece: libelle, libelle, compte: compte || '411' });

const valider = (win, d, ecritureId) => win.evaluate(async o => {
  try { const r = await window.cabinet.valider(o.id, o.annee, o.e); return { ok: true, numero: r.numero }; }
  catch (e) { return { ok: false, message: String(e.message || e) }; }
}, { id: d.id, annee: d.annee, e: ecritureId });

const dernierBrouillard = (win, d) => win.evaluate(async o => {
  const r = await window.cabinet.livre(o.id, o.annee);
  const b = (r.livre.ecritures || []).filter(e => e.statut === 'brouillard');
  return b.length ? b[b.length - 1].id : '';
}, { id: d.id, annee: d.annee });

(async () => {
  // =============================================================== LE POSTE DE SONIA
  étape('Le poste de Sonia : un cabinet, l\'exemple, un livre');
  let { app, win } = await lancer(POSTE1, '[sonia]');
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', MDP); await win.fill('#lock-pw2', MDP);
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  // On traverse l'assistant comme un comptable : le NOM se remplit et se valide par « Suivant ».
  // « Passer » sur cet écran-là laisse le cabinet sans nom — c'est légitime, il se règle plus tard
  // — mais le poste qui reprendrait ce cabinet rouvrirait alors l'assistant, et ce n'est pas ce
  // que ce parcours est venu prouver.
  for (let g = 0; g < 14 && await win.$('#setup'); g++) {
    if (await win.$('#w-name')) {
      await win.fill('#w-name', 'Cabinet Ben Salah');
      await win.click('#w-next');
    } else if (await win.$('#w-skip')) await win.click('#w-skip');
    else if (await win.$('#w-next')) await win.click('#w-next');
    else if (await win.$('#setup .wiz-actions .btn-primary')) await win.click('#setup .wiz-actions .btn-primary');
    await attendre(win, 350);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'), null, { timeout: 10000 }).catch(() => {});
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="app"]');
  await attendre(win, 400);
  if (await win.$('#r-demo-on')) { await win.click('#r-demo-on'); await attendre(win, 2000); }
  const d = await ouvrirLivre(win);
  ok('livre ouvert · dossier ' + d.id + ' · exercice ' + d.annee);

  // =============================================================== 2. L'ÉQUIPE
  étape('Tant que personne n\'est déclaré, RIEN n\'est restreint');
  // La valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien (9.1.1) :
  // tous les cabinets d'aujourd'hui sont à une personne, et une mise à jour ne doit enfermer
  // personne dehors.
  const avantEquipe = await saisir(win, d, 'AVANT-EQUIPE');
  if (!avantEquipe.ok) throw new Error('un cabinet d\'une personne s\'est retrouvé restreint : ' + avantEquipe.message);
  ok('on saisit sans avoir rien déclaré');
  // Et l'écran ne montre aucune grille de droits sur un cabinet d'une personne.
  await win.evaluate(x => { location.hash = `#/dossier/${x}/suivi`; }, d.id);
  await attendre(win, 700);
  if (await win.$('#d-droits')) throw new Error('la grille des droits s\'affiche alors que personne n\'est déclaré');
  ok('la fiche ne propose aucune grille de droits : il n\'y a personne à qui en donner');

  étape('Déclarer deux collaborateurs, par le vrai écran');
  await ajouter(win, 'Sonia Ben Salah', 'supervision');
  await ajouter(win, 'Amine Gharbi', 'saisie');
  await jeSuis(win, 'Sonia Ben Salah');
  await win.screenshot({ path: path.join(OUT, '01-equipe.png') });

  étape('Sonia valide, et la piste d\'audit porte SON nom — pas celui du poste');
  const s1 = await saisir(win, d, 'SONIA-1');
  if (!s1.ok) throw new Error('la supervision ne peut pas saisir : ' + s1.message);
  const bSonia = await dernierBrouillard(win, d);
  const v1 = await valider(win, d, bSonia);
  if (!v1.ok) throw new Error('la supervision ne peut pas valider : ' + v1.message);
  ok('écriture validée n° ' + v1.numero);
  const qui = await win.evaluate(async o => {
    const r = await window.cabinet.livre(o.id, o.annee);
    const a = (r.livre.audit || []).filter(x => x.quoi === 'saisie');
    return a.length ? { qui: a[a.length - 1].qui, poste: a[a.length - 1].poste } : null;
  }, { id: d.id, annee: d.annee });
  if (!qui || qui.qui !== 'Sonia Ben Salah') {
    throw new Error('la piste d\'audit ne porte pas le nom de la personne : ' + JSON.stringify(qui));
  }
  ok('la piste d\'audit dit « ' + qui.qui + ' », depuis « ' + (qui.poste || '—') + ' »');

  étape('Le tableau de production existe, et se lit');
  await win.evaluate(() => { location.hash = '#/production'; });
  await win.waitForSelector('#view table.prod tbody tr[data-id]', { timeout: 15000 });
  const prod = await win.evaluate(() => ({
    lignes: document.querySelectorAll('#view table.prod tbody tr[data-id]').length,
    legende: document.querySelectorAll('#view .prod-leg span').length,
    pastilles: document.querySelectorAll('#view .prod-p').length
  }));
  if (!prod.lignes) throw new Error('le tableau de production est vide alors que le portefeuille ne l\'est pas');
  // Une couleur seule n'est pas une information (9.4.4) : chaque état a son signe ET sa légende.
  if (prod.legende < 5) throw new Error('la légende ne nomme pas les étapes : ' + prod.legende);
  ok(`${prod.lignes} clients, ${prod.pastilles} mois, ${prod.legende} états nommés dans la légende`);
  await win.screenshot({ path: path.join(OUT, '02-production.png') });

  étape('La copie externe : c\'est elle que le second poste reprendra');
  await app.evaluate(({ dialog }, x) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [x] }); }, CLE_USB);
  await win.evaluate(async () => { await window.cabinet.pickExternal(); });
  await attendre(win, 2500);
  if (!fs.existsSync(path.join(CLE_USB, 'SkanFact Cabinet'))) throw new Error('la copie externe n\'a rien écrit');
  ok('base, sauvegardes, paquets et livres sur la clé');
  await fermer(app);

  // =============================================================== LE POSTE D'AMINE
  étape('Le poste d\'Amine reprend le cabinet, et se déclare');
  ({ app, win } = await lancer(POSTE2, '[amine]'));
  await win.waitForSelector('#lock-form');
  await win.click('#lock-move');
  await win.waitForSelector('#modal-root .reprise-list', { timeout: 10000 });
  await app.evaluate(({ dialog }, x) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [x] }); }, CLE_USB);
  await win.click('#modal-root #rp-dir');
  await win.waitForSelector('#modal-root #rp-pw', { timeout: 15000 });
  await win.fill('#modal-root #rp-pw', MDP);
  await win.click('#modal-root #rp-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 30000 });
  // Le bilan de la reprise, puis sa proposition de copie externe : on la refuse, ce test ne
  // rebranche pas de clé.
  await win.waitForSelector('#modal-root .modal', { timeout: 15000 });
  const bilan = (await win.textContent('#modal-root .modal')).replace(/\s+/g, ' ');
  ok('repris : ' + bilan.slice(0, 120));
  await win.click('#modal-root .modal-bg:last-child .modal-actions .btn:not(.btn-primary)');
  await attendre(win, 1200);
  // Un poste qui vient de REPRENDRE un cabinet complet n'a rien à faire dans l'assistant de
  // bienvenue — mais s'il s'y trouve quand même, on le dit plutôt que de le contourner en silence.
  if (await win.$('#setup')) {
    const nom = await win.evaluate(async () => (await window.cabinet.state()).cabinet.name);
    await win.screenshot({ path: path.join(OUT, 'X-assistant-apres-reprise.png') });
    throw new Error(`l'assistant de bienvenue s'ouvre sur un poste qui vient de reprendre le cabinet « ${nom} »`);
  }
  // Les livres ont suivi : sans eux, le second poste ne pourrait rien lire du travail du premier.
  if (!livresDe(POSTE2).length) throw new Error('la reprise n\'a pas rapporté les livres');
  ok(livresDe(POSTE2).length + ' livre repris au moins sur ce poste');
  await jeSuis(win, 'Amine Gharbi');

  étape('Un saisisseur SAISIT, et ne valide pas — et le refus nomme qui peut');
  const a1 = await saisir(win, d, 'AMINE-1');
  if (!a1.ok) throw new Error('un saisisseur ne peut pas saisir : ' + a1.message);
  ok('la saisie passe');
  const bAmine = await dernierBrouillard(win, d);
  const refus = await valider(win, d, bAmine);
  if (refus.ok) throw new Error('UN SAISISSEUR A VALIDÉ UNE ÉCRITURE');
  if (!/Amine/.test(refus.message)) throw new Error('le refus ne nomme pas qui est refusé : ' + refus.message);
  if (!/Sonia/.test(refus.message)) throw new Error('le refus ne dit pas qui peut le faire : ' + refus.message);
  ok('refusé : « ' + refus.message.replace(/\s+/g, ' ').slice(0, 140) + ' »');

  étape('Et rien de ce qui LIT n\'est fermé : jamais de données en otage');
  const lectures = await win.evaluate(async o => {
    const r = {};
    for (const [nom, f] of [
      ['livre', () => window.cabinet.livre(o.id, o.annee)],
      ['livreIndex', () => window.cabinet.livreIndex(o.id)],
      ['production', () => window.cabinet.production({})],
      ['état du cabinet', () => window.cabinet.state()]
    ]) {
      try { await f(); r[nom] = 'ouvert'; } catch (e) { r[nom] = 'FERMÉ — ' + e.message; }
    }
    return r;
  }, { id: d.id, annee: d.annee });
  const fermees = Object.keys(lectures).filter(k => lectures[k] !== 'ouvert');
  if (fermees.length) throw new Error('des lectures sont fermées : ' + JSON.stringify(lectures));
  ok('lire le livre, son index, la production et l\'état : tout reste ouvert');

  étape('Un droit posé sur CE dossier ouvre la validation, sans toucher au rôle général');
  await win.evaluate(x => { location.hash = `#/dossier/${x}/suivi`; }, d.id);
  await win.waitForSelector('#d-droits', { timeout: 15000 });
  // On ne peut pas poser un droit soi-même quand on n'est pas superviseur : l'écran le dit, et
  // l'enregistrement refuse. On repasse donc par Sonia, comme dans la vraie vie.
  const refusDroits = await win.evaluate(async o => {
    try { await window.cabinet.saveDroits(o.id, {}); return { ok: true }; }
    catch (e) { return { ok: false, message: String(e.message || e) }; }
  }, { id: d.id });
  if (refusDroits.ok) throw new Error('un saisisseur a modifié les droits d\'un dossier');
  ok('un saisisseur ne se donne pas de droits : « ' + refusDroits.message.replace(/\s+/g, ' ').slice(0, 90) + ' »');
  await win.screenshot({ path: path.join(OUT, '03-droits.png') });

  étape('Amine devient Sonia le temps de valider : chaque geste porte le nom de qui l\'a fait');
  await jeSuis(win, 'Sonia Ben Salah');
  const v2 = await valider(win, d, bAmine);
  if (!v2.ok) throw new Error('la supervision ne peut toujours pas valider : ' + v2.message);
  ok('validée n° ' + v2.numero + ' sur le second poste');
  await fermer(app);

  // =============================================================== RÉUNIR LES DEUX
  étape('Réunir les deux livres : rien de validé ne se perd');
  const livreAmine = livresDe(POSTE2)[0];
  if (!livreAmine) throw new Error('le second poste n\'a écrit aucun livre');
  const copie = path.join(dir, 'livre-du-poste-amine.json');
  fs.copyFileSync(livreAmine, copie);
  const tailleAvant = fs.statSync(copie).size;

  ({ app, win } = await lancer(POSTE1, '[sonia-2]'));
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', MDP);
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await attendre(win, 1200);
  // Le poste de Sonia a travaillé de son côté pendant ce temps-là.
  const s2 = await saisir(win, d, 'SONIA-2');
  if (!s2.ok) throw new Error('le premier poste ne peut plus saisir : ' + s2.message);

  await app.evaluate(({ dialog }, x) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [x] }); }, copie);
  const fusion = await win.evaluate(async o => {
    try { return { ok: true, r: await window.cabinet.fusionner(o.id, o.annee) }; }
    catch (e) { return { ok: false, message: String(e.message || e) }; }
  }, { id: d.id, annee: d.annee });
  if (!fusion.ok) throw new Error('la fusion a échoué : ' + fusion.message);
  ok('fusion : ' + JSON.stringify(fusion.r.rapport.valideesAjoutees.length) + ' validée(s) reprise(s), '
    + fusion.r.rapport.aRegarder + ' à regarder');

  const final = await win.evaluate(async o => {
    const r = await window.cabinet.livre(o.id, o.annee);
    return (r.livre.ecritures || []).map(e => ({ libelle: e.libelle, statut: e.statut, numero: e.numero }));
  }, { id: d.id, annee: d.annee });
  const nomme = l => final.some(e => e.libelle === l);
  ['SONIA-1', 'AMINE-1', 'SONIA-2'].forEach(l => {
    if (!nomme(l)) throw new Error(`« ${l} » a été PERDU par la fusion : ` + JSON.stringify(final));
  });
  ok('les trois travaux sont là : ' + final.map(e => e.libelle + (e.numero ? ' n°' + e.numero : ' (brouillard)')).join(' · '));
  if (fs.statSync(copie).size !== tailleAvant) throw new Error('la fusion a réécrit le fichier de l\'autre poste');
  ok('le livre de l\'autre poste n\'a pas été touché');
  await win.screenshot({ path: path.join(OUT, '04-fusion.png') });
  await fermer(app);

  if (errors.length) { console.error('\nErreurs du renderer :\n' + errors.join('\n')); process.exit(2); }
  console.log(`\n${pas} étapes, deux postes, deux collaborateurs — et rien de perdu.`);
})().catch(e => { console.error('\n' + e.stack || e); process.exit(1); });
