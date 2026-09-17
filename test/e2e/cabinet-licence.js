// SkanFact Cabinet 9.4.0 — la licence, dans l'application RÉELLE. Jumeau de `e2e:licence`.
//
// Ce qu'il prouve, et qu'aucun test pur ne peut prouver : que le verrou ferme ce qu'il doit fermer
// (la validation d'une écriture) et RIEN d'autre — lire un livre, importer, exporter et relancer
// restent ouverts même bloqué. Jamais de données en otage, et ici ce sont les pièces de soixante
// entreprises qui dorment dans l'application.
//
// L'application est ARMÉE pour de vrai : une clé publique d'essai est embarquée par
// `SKANFACT_CLE_EMBARQUEE` (honoré en développement seulement, règle 8.0.0), et les licences du
// parcours sont signées par sa moitié privée, qui ne quitte jamais le dossier temporaire du test.
const { playwright, RACINE, ELECTRON } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const L = require(path.join(RACINE, 'src', 'licence.js'));
const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'cabinet-licence');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-lic-'));
const userData = path.join(dir, 'cab');
const errors = [];
let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };

// La paire d'essai. La privée reste ici : elle ne va ni dans le dépôt, ni dans `~/.skanfact`, qui
// appartient à l'éditeur (piège 7.33.0).
const paire = L.generateKeys();
const fichierCles = path.join(dir, 'cles-essai.json');
fs.writeFileSync(fichierCles, JSON.stringify({ cles: [{ kid: 'master', publicKey: paire.publicKey, creeLe: '2026-01-01' }] }, null, 2));

const signer = (o) => L.signLicence({
  id: o.id || 'test', nom: o.nom || 'Cabinet Essai', matricule: '', offre: 'cabinet',
  exp: o.exp === undefined ? '2099-12-31' : o.exp, cabinet: String(o.cabinet || '').toUpperCase(),
  note: '', emisLe: '2026-09-17', type: o.type || 'cabinet', dossiersHors: o.dossiersHors == null ? 10 : o.dossiersHors
}, paire.privateKey);

(async () => {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON,
    env: { ...process.env, SKANFACT_CLE_EMBARQUEE: fichierCles }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const attendre = (ms = 350) => win.waitForTimeout(ms);
  const shot = async n => { await attendre(250); await win.screenshot({ path: path.join(OUT, n + '.png') }); };
  await win.setViewportSize({ width: 1440, height: 900 });
  const etat = () => win.evaluate(() => window.cabinet.licenceStatus());

  // ---------------------------------------------------------------- 1. ouvrir
  étape('Ouvrir le cabinet');
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', 'mot-de-passe-cabinet');
  await win.fill('#lock-pw2', 'mot-de-passe-cabinet');
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  const passerAssistant = async () => {
    for (let g = 0; g < 14 && await win.$('#setup'); g++) {
      if (await win.$('#w-name')) await win.fill('#w-name', 'Cabinet Essai');
      if (await win.$('#w-skip')) await win.click('#w-skip'); else if (await win.$('#w-next')) await win.click('#w-next');
      await attendre(300);
    }
    await win.waitForFunction(() => !document.querySelector('#setup'), { timeout: 15000 });
  };
  await win.waitForSelector('#setup', { timeout: 10000 });
  await passerAssistant();

  // Le nom du cabinet, enregistré pour de vrai : sans lui il n'y a pas d'empreinte, et sans
  // empreinte il n'y a pas de licence possible.
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#c-name', { timeout: 8000 });
  await win.fill('#c-name', 'Cabinet Essai');
  await win.fill('#c-email', 'essai@cabinet.tn');
  await win.click('#c-save');
  await attendre(600);
  const empreinte = await win.evaluate(async () => (await window.cabinet.state()).cabinet.fingerprint);
  if (!/^[0-9A-F]{4}(-[0-9A-F]{4}){4}$/.test(empreinte || '')) throw new Error('empreinte du cabinet illisible : ' + empreinte);
  ok('cabinet ouvert, empreinte ' + empreinte);

  // ---------------------------------------------------------------- 2. gratuit
  étape('Sans clé : trois dossiers hors SkanFact sont gratuits');
  let e = await etat();
  if (e.state !== 'gratuit') throw new Error('l\'état de départ devrait être « gratuit », pas ' + e.state);
  if (e.locked) throw new Error('un cabinet sans dossier est verrouillé');
  if (e.gratuits !== 3) throw new Error('le nombre de dossiers gratuits a changé : ' + e.gratuits);
  ok('état « gratuit », ' + e.gratuits + ' dossiers hors SkanFact offerts');

  // L'exemple donne des dossiers AVEC des paquets : ils ne comptent pas (jeu d'exemple), mais ils
  // donnent un livre sur lequel valider — c'est ce qu'on veut éprouver.
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#demo-on', { timeout: 8000 });
  await win.click('#demo-on');
  await win.waitForSelector('tr[data-id]', { timeout: 20000 });
  e = await etat();
  if (e.comptage.comptes !== 0) throw new Error('le jeu d\'exemple est compté dans la licence : ' + e.comptage.comptes);
  ok('les cinq dossiers d\'exemple ne comptent pas');

  // ---------------------------------------------------------------- 3. dépasser le quota
  étape('Cinq clients hors SkanFact : le quota gratuit est dépassé');
  const ids = [];
  for (const nom of ['Alpha SARL', 'Beta SUARL', 'Gamma SA', 'Delta SARL', 'Epsilon SUARL']) {
    const r = await win.evaluate(n => window.cabinet.newDossier({ name: n }), nom);
    ids.push(r.id);
  }
  e = await etat();
  if (e.comptage.comptes !== 5) throw new Error('cinq clients hors SkanFact devraient compter 5, pas ' + e.comptage.comptes);
  if (!e.locked) throw new Error('cinq dossiers pour trois gratuits : le verrou devrait être posé');
  if (e.depasse !== 2) throw new Error('le dépassement devrait être de 2, pas ' + e.depasse);
  ok('5 comptés, 3 couverts, dépassement de ' + e.depasse + ' — verrouillé');

  // Chaque dossier compté est NOMMÉ avec sa raison : un chiffre qui décide d'une facture doit
  // pouvoir s'expliquer.
  if (e.comptage.liste.length !== 5) throw new Error('les dossiers comptés ne sont pas nommés');
  if (!e.comptage.liste.every(d => d.name && d.raison)) throw new Error('un dossier compté sans nom ou sans raison');
  ok('chacun est nommé avec sa raison : ' + e.comptage.liste[0].name + ' — ' + e.comptage.liste[0].raison);

  // ---------------------------------------------------------------- 4. ce que le verrou ferme
  étape('Le verrou ferme la VALIDATION, et rien d\'autre');
  const cible = await win.evaluate(() => [...document.querySelectorAll('tr[data-id]')].map(t => t.dataset.id)
    .find(id => !id.startsWith('MAT:')) || document.querySelector('tr[data-id]').dataset.id);
  await win.evaluate(id => { location.hash = '#/dossier/' + encodeURIComponent(id) + '/comptabilite'; }, cible);
  await win.waitForSelector('#c-livres', { timeout: 15000 });
  await win.waitForFunction(() => {
    const x = document.querySelector('#c-livres');
    return x && !x.textContent.includes('Lecture des paquets');
  }, { timeout: 30000 });

  // Créer le livre depuis les paquets : c'est un IMPORT, il doit passer malgré le verrou.
  if (await win.$('#lv-relire')) {
    await win.click('#lv-relire');
    await win.waitForSelector('.modal-bg', { timeout: 30000 });
    await win.click('.modal-bg .btn-primary');
    await attendre(600);
  }
  await win.waitForFunction(() => {
    const t = document.querySelector('#c-tabs');
    return t && t.textContent.includes('Saisie');
  }, { timeout: 25000 });
  ok('relire les paquets et créer le livre : ouvert, malgré le verrou');

  const annee = await win.evaluate(() => (document.querySelector('#lv-annee') || {}).value || '');
  const essai = (fn) => win.evaluate(async ([a, f]) => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    try { return { ok: true, r: await window.cabinet[f](d, a) }; } catch (x) { return { ok: false, motif: String(x.message || x) }; }
  }, [annee, fn]);

  // Ce qui doit rester OUVERT.
  const lecture = await essai('livre');
  if (!lecture.ok) throw new Error('lire un livre est refusé : des données en otage — ' + lecture.motif);
  ok('lire le livre : ouvert');
  const exportOk = await win.evaluate(async () => {
    try { await window.cabinet.ecrituresPlan({ du: '2026-01', au: '2026-12' }); return { ok: true }; }
    catch (x) { return { ok: false, motif: String(x.message || x) }; }
  });
  if (!exportOk.ok) throw new Error('préparer un export est refusé : des données en otage — ' + exportOk.motif);
  ok('préparer l\'export d\'écritures : ouvert');

  // Ce qui doit être FERMÉ : valider.
  // SAISIR reste ouvert : ce n'est pas la saisie qui se vend, c'est la validation. Un comptable
  // bloqué doit pouvoir continuer à travailler et valider le jour où il a sa clé — l'inverse
  // reviendrait à lui prendre sa journée en otage.
  const saisie = await win.evaluate(async a => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    try {
      const r = await window.cabinet.saisir(d, a, {
        date: a + '-06-15', journal: 'OD', piece: 'LIC-1', libelle: 'Pièce du parcours licence',
        lignes: [{ compte: '613', debit: 100 }, { compte: '401', credit: 100 }]
      });
      return { ok: true, id: r.id };
    } catch (x) { return { ok: false, motif: String(x.message || x) }; }
  }, annee);
  if (!saisie.ok) throw new Error('saisir est refusé alors que seule la validation se vend : ' + saisie.motif);
  ok('saisir une écriture : ouvert');
  const brouillard = saisie.id;
  const refus = await win.evaluate(async ([a, id]) => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    try { await window.cabinet.valider(d, a, id); return { ok: true }; }
    catch (x) { return { ok: false, motif: String(x.message || x) }; }
  }, [annee, brouillard]);
  if (refus.ok) throw new Error('la validation est passée alors que le quota est dépassé');
  if (!/licence/i.test(refus.motif)) throw new Error('le refus ne parle pas de licence : ' + refus.motif);
  // Un refus dit TROIS choses : ce qui est refusé, pourquoi, et le bouton qui débloque (7.0.0).
  if (!/5 dossiers|3 sont couverts|3 est couvert/.test(refus.motif)) throw new Error('le refus ne dit pas COMBIEN : ' + refus.motif);
  if (!/Réglages/.test(refus.motif)) throw new Error('le refus ne dit pas où aller : ' + refus.motif);
  if (!/reste ouvert/.test(refus.motif)) throw new Error('le refus ne dit pas ce qui reste ouvert : ' + refus.motif);
  ok('valider : refusé, et le refus dit combien, où aller, et ce qui reste ouvert');
  await shot('01-verrouille');

  // ---------------------------------------------------------------- 5. archiver
  étape('Un dossier archivé ne compte plus');
  await win.evaluate(id => window.cabinet.saveDossier(id, { archived: true }), ids[0]);
  await win.evaluate(id => window.cabinet.saveDossier(id, { archived: true }), ids[1]);
  e = await etat();
  if (e.comptage.comptes !== 3) throw new Error('deux dossiers archivés devraient ramener le compte à 3, pas ' + e.comptage.comptes);
  if (e.locked) throw new Error('trois dossiers pour trois gratuits : plus de verrou');
  ok('deux archivés → 3 comptés, plus de verrou');
  // Et la validation repasse.
  const reprise = await win.evaluate(async ([a, id]) => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    try { await window.cabinet.valider(d, a, id); return { ok: true }; } catch (x) { return { ok: false, motif: String(x.message || x) }; }
  }, [annee, brouillard]);
  if (!reprise.ok) throw new Error('la validation devrait repasser : ' + reprise.motif);
  ok('la validation repasse');

  // ---------------------------------------------------------------- 6. la clé
  étape('Coller une clé — la bonne, et les mauvaises');
  await win.evaluate(id => window.cabinet.saveDossier(id, { archived: false }), ids[0]);
  await win.evaluate(id => window.cabinet.saveDossier(id, { archived: false }), ids[1]);

  const poser = (k) => win.evaluate(async key => {
    try { return { ok: true, e: await window.cabinet.licenceSet(key) }; }
    catch (x) { return { ok: false, motif: String(x.message || x) }; }
  }, k);

  // Une clé d'un AUTRE cabinet : refusée, et le refus nomme les DEUX empreintes.
  const autre = await poser(signer({ cabinet: 'AAAA-BBBB-CCCC-DDDD-EEEE' }));
  if (autre.ok) throw new Error('la clé d\'un autre cabinet a été acceptée');
  if (!autre.motif.includes('AAAA-BBBB-CCCC-DDDD-EEEE') || !autre.motif.includes(empreinte)) {
    throw new Error('le refus doit nommer les deux empreintes : ' + autre.motif);
  }
  ok('clé d\'un autre cabinet : refusée en nommant les deux empreintes');

  // Une clé d'ENTREPRISE, même émise avec l'empreinte de ce cabinet (le cas du client parrainé).
  const cliente = await poser(signer({ cabinet: empreinte, type: 'entreprise', dossiersHors: 0 }));
  if (cliente.ok) throw new Error('une clé d\'entreprise a été acceptée comme licence de cabinet');
  ok('clé d\'un client parrainé : refusée aussi');

  // Du charabia.
  const nimp = await poser('SKAN1.pas.une.cle');
  if (nimp.ok) throw new Error('une clé illisible a été enregistrée');
  ok('clé illisible : refusée, pas rangée');

  // La bonne.
  const bonne = await poser(signer({ cabinet: empreinte, dossiersHors: 10 }));
  if (!bonne.ok) throw new Error('la bonne clé a été refusée : ' + bonne.motif);
  e = bonne.e;
  if (e.state !== 'active') throw new Error('la bonne clé devrait donner « active », pas ' + e.state);
  if (e.quota !== 10) throw new Error('le quota devrait être 10, pas ' + e.quota);
  if (e.autorises !== 13) throw new Error('3 gratuits + 10 = 13, pas ' + e.autorises);
  if (e.locked) throw new Error('5 dossiers pour 13 couverts : il ne devrait plus y avoir de verrou');
  ok('bonne clé : active, quota 10, 13 couverts, plus de verrou');

  // ---------------------------------------------------------------- 7. l'écran
  étape('L\'écran dit ce qui est compté, et pourquoi');
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#set-tabs', { timeout: 8000 });
  const onglet = await win.evaluate(() => {
    const p = document.getElementById('pan-licence');
    const s = p && p.closest('[data-pane]');
    return s ? s.dataset.pane : null;
  });
  if (!onglet) throw new Error('le panneau Licence n\'est dans aucun onglet des Réglages');
  await win.click(`#set-tabs button[data-tab="${onglet}"]`);
  await win.waitForSelector('#lic-panel', { state: 'visible', timeout: 8000 });
  await attendre(700);
  const texte = await win.textContent('#lic-panel');
  ['Alpha SARL', 'hors SkanFact'].forEach(x => {
    if (!texte.includes(x)) throw new Error('le panneau ne montre pas « ' + x + ' »');
  });
  if (!/Comptés/.test(texte) || !/Couverts/.test(texte)) throw new Error('le panneau ne montre pas les deux chiffres');
  ok('le panneau nomme les dossiers comptés et affiche les deux chiffres');
  await shot('02-panneau');

  // ---------------------------------------------------------------- 8. rien de cassé
  étape('Aucune erreur JavaScript');
  if (errors.length) {
    console.log(errors.slice(0, 10).map(x => '    ' + x).join('\n'));
    throw new Error(errors.length + ' erreur(s) JS pendant le parcours');
  }
  ok('zéro erreur');

  console.log('\nTOUT EST VERT — captures dans ' + OUT);
  await Promise.race([app.close(), new Promise(r => setTimeout(r, 15000))
    .then(() => { throw new Error('l\'application ne se ferme pas : une fenêtre attend une réponse'); })]);
  fs.rmSync(dir, { recursive: true, force: true });
})().catch(err => {
  console.error('\n✗ ' + err.message);
  if (errors.length) console.error(errors.slice(0, 10).join('\n'));
  process.exit(1);
});
