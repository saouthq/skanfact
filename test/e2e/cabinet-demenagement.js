// SkanFact Cabinet — changer d'ordinateur, pour de vrai.
//
// Le pire des défauts est celui qui punit quelqu'un qui a tout bien fait. Le comptable avait sa copie
// sur clé USB et sa clé de secours, comme l'application le lui répétait. Sur le Mac neuf, elle
// répondait « Bienvenue », lui fabriquait une clé NEUVE — donc une autre empreinte — et les paquets
// que ses clients enverraient ensuite étaient refusés : « adressé à un autre cabinet ». Huit cents
// paquets lisibles sur la table, et aucun bouton pour les reprendre (constat A6).
//
// Ce test lance DEUX applications à la suite, sur deux dossiers de données différents : le poste
// d'origine, qui travaille et fait sa copie externe ; puis le poste neuf, qui ne connaît rien et
// reprend tout par les vrais boutons. Ce qu'il vérifie à la fin est la seule chose qui compte :
// l'empreinte du cabinet est la MÊME.
const { fermer, playwright, RACINE, ELECTRON } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const Z = require(path.join(RACINE, 'src', 'zip.js'));

const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'demenagement');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-demenage-'));
const POSTE1 = path.join(dir, 'ancien-mac');
const POSTE2 = path.join(dir, 'mac-neuf');
const CLE_USB = path.join(dir, 'cle-usb');
fs.mkdirSync(CLE_USB, { recursive: true });
const MDP = 'mot-de-passe-cabinet';

let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };
const errors = [];

// Un paquet minimal mais authentique, comme dans e2e:refus.
function paquet(nom, matricule, mois) {
  const cover = Buffer.from('%PDF-1.4 page de garde ' + mois);
  const man = {
    format: 1, app: 'SkanFact',
    entreprise: { nom, matricule, devise: 'DT' },
    periode: { mois, du: mois + '-01', au: mois + '-28', libelle: mois },
    definitif: true, genereLe: new Date().toISOString(), poste: 'test',
    manques: [], absents: [],
    fichiers: [{ chemin: '00-page-de-garde.pdf', empreinte: Z.sha256(cover) }]
  };
  return Z.zipBuffer([
    { name: 'manifeste.json', data: Buffer.from(JSON.stringify(man, null, 2)) },
    { name: '00-page-de-garde.pdf', data: cover }
  ]);
}

async function lancer(userData, tag) {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push(tag + ' PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push(tag + ' CONSOLE: ' + m.text()); });
  return { app, win };
}

const attendre = (win, ms = 400) => win.waitForTimeout(ms);
const dessus = sel => `#modal-root .modal-bg:last-child ${sel}`;

(async () => {
  // =================== LE POSTE D'ORIGINE ===================
  étape('Le poste d\'origine : un cabinet, deux clients, deux paquets, une copie sur clé USB');
  let { app, win } = await lancer(POSTE1, '[ancien]');
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', MDP); await win.fill('#lock-pw2', MDP);
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await win.waitForSelector('#setup', { timeout: 10000 });
  await win.click('#w-next');
  await win.waitForSelector('#w-name');
  await win.fill('#w-name', 'Cabinet Ben Salah');
  await win.click('#w-next');
  // 10.14.0 : la porte, le nom, les clients — « Passer » ferme l'assistant.
  await win.waitForSelector('#w-clients'); await win.click('#w-skip');
  await win.waitForFunction(() => !document.querySelector('#setup'), null, { timeout: 10000 });
  await attendre(win, 700);

  const empreinteAvant = await win.evaluate(() => {
    const el = document.querySelector('.fingerprint');
    return el ? el.textContent.trim() : null;
  }) || await win.evaluate(async () => (await window.cabinet.state()).cabinet.fingerprint);
  ok('cabinet créé · empreinte ' + empreinteAvant);

  // Deux paquets importés par le vrai chemin.
  const p1 = path.join(dir, 'trabelsi-2026-08.skanpack');
  const p2 = path.join(dir, 'menzah-2026-08.skanpack');
  fs.writeFileSync(p1, paquet('Menuiserie Trabelsi SUARL', '1122334A/M/P/000', '2026-08'));
  fs.writeFileSync(p2, paquet('Pharmacie El Menzah', '2233445B/A/M/000', '2026-08'));
  await app.evaluate(({ dialog }, fs2) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: fs2 }); }, [p1, p2]);
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#imp');
  await win.click('#imp');
  await win.waitForSelector('#modal-root .imp-list', { timeout: 30000 });
  await win.click('#modal-root #ok');
  await attendre(win, 600);
  const avant = await win.evaluate(() => [...document.querySelectorAll('table.list tr[data-id] td:first-child')].map(t => t.textContent.trim()));
  if (avant.length !== 2) throw new Error('les deux paquets n\'ont pas créé deux dossiers : ' + JSON.stringify(avant));
  ok('deux clients : ' + avant.join(' | '));

  // La copie externe : c'est ce que le comptable emporte.
  await app.evaluate(({ dialog }, d) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] }); }, CLE_USB);
  await win.evaluate(async () => { await window.cabinet.pickExternal(); });
  await attendre(win, 1500);
  const surLaCle = fs.existsSync(path.join(CLE_USB, 'SkanFact Cabinet'));
  if (!surLaCle) throw new Error('la copie externe n\'a rien écrit sur la clé');
  const paquetsSurLaCle = [];
  (function marche(p) {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, e.name);
      if (e.isDirectory()) marche(q); else if (q.endsWith('.skanpack')) paquetsSurLaCle.push(q);
    }
  })(path.join(CLE_USB, 'SkanFact Cabinet'));
  if (paquetsSurLaCle.length !== 2) throw new Error('la clé ne porte pas les paquets : ' + paquetsSurLaCle.length);
  ok('copie sur la clé USB : la base, les sauvegardes et ' + paquetsSurLaCle.length + ' paquets');
  await win.screenshot({ path: path.join(OUT, '01-ancien-poste.png') });
  await fermer(app);

  // =================== LE POSTE NEUF ===================
  // Il ne connaît rien : ni fichier, ni clé. C'est exactement l'écran du Mac qu'on vient d'acheter.
  étape('Le poste neuf : il ne connaît rien');
  ({ app, win } = await lancer(POSTE2, '[neuf]'));
  await win.waitForSelector('#lock-form');
  const proposition = await win.textContent('#lock-move');
  if (!proposition) throw new Error('aucun bouton « j\'ai déjà un cabinet ailleurs » sur l\'écran de mot de passe');
  ok('l\'écran propose : « ' + proposition.trim() + ' »');
  await win.screenshot({ path: path.join(OUT, '02-poste-neuf.png') });

  étape('Reprendre depuis la clé USB');
  await win.click('#lock-move');
  await win.waitForSelector('#modal-root .reprise-list', { timeout: 5000 });
  ok('trois chemins proposés : le dossier de copie, le fichier seul, la clé de secours');
  await win.screenshot({ path: path.join(OUT, '03-reprise.png') });

  // On désigne la clé USB, et l'application doit dire ce qu'elle y trouve AVANT de demander le mot
  // de passe : on ne fait pas taper un mot de passe pour apprendre ensuite qu'on s'est trompé.
  await app.evaluate(({ dialog }, d) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] }); }, CLE_USB);
  await win.click('#modal-root #rp-dir');
  await win.waitForSelector('#modal-root #rp-pw', { timeout: 10000 });
  const annonce = (await win.textContent('#modal-root .modal')).replace(/\s+/g, ' ');
  if (!/2 paquets/.test(annonce)) throw new Error('l\'application n\'annonce pas ce qu\'elle a trouvé : ' + annonce.slice(0, 200));
  ok('elle annonce ce qu\'elle a trouvé avant de demander quoi que ce soit : ' + (annonce.match(/On y trouve\s*(.*?)\s*Le mot de passe/) || [, '?'])[1]);
  await win.screenshot({ path: path.join(OUT, '04-ce-quon-trouve.png') });

  // Un mot de passe faux ne doit RIEN laisser derrière lui.
  await win.fill('#modal-root #rp-pw', 'pas-le-bon-mot-de-passe');
  await win.click('#modal-root #rp-go');
  await attendre(win, 1200);
  if (!await win.$('#modal-root #rp-pw')) throw new Error('un mot de passe faux a fait quelque chose');
  ok('un mot de passe faux est refusé, et la fenêtre reste');

  await win.fill('#modal-root #rp-pw', MDP);
  await win.click('#modal-root #rp-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await win.waitForSelector('#modal-root .modal', { timeout: 15000 });
  const bilan = (await win.textContent('#modal-root .modal')).replace(/\s+/g, ' ');
  ok('bilan : ' + bilan.slice(0, 160));
  await win.screenshot({ path: path.join(OUT, '05-repris.png') });
  // On refuse la proposition de copie externe (le test ne va pas rebrancher une clé).
  await win.click(dessus('.modal-actions .btn:not(.btn-primary)'));
  await attendre(win, 800);

  // =================== CE QUI COMPTE ===================
  étape('Ce qui compte : la même empreinte, les mêmes clients, les paquets lisibles ICI');
  const st = await win.evaluate(async () => await window.cabinet.state());
  if (st.cabinet.fingerprint !== empreinteAvant) {
    throw new Error(`l'empreinte a changé : ${empreinteAvant} → ${st.cabinet.fingerprint}. Les clients seraient refusés.`);
  }
  ok('empreinte identique : ' + st.cabinet.fingerprint);
  if (st.cabinet.name !== 'Cabinet Ben Salah') throw new Error('le nom du cabinet n\'a pas suivi');
  if (st.dossiers.length !== 2) throw new Error('les dossiers n\'ont pas suivi : ' + st.dossiers.length);
  ok('les deux clients sont là : ' + st.dossiers.map(d => d.name).join(' | '));

  // Les chemins doivent désigner CE poste-ci, pas la clé USB qu'on va débrancher.
  const chemins = st.dossiers.flatMap(d => (d.packs || []).map(p => p.path)).filter(Boolean);
  if (chemins.length !== 2) throw new Error('les paquets n\'ont pas suivi : ' + chemins.length);
  const dehors = chemins.filter(p => !p.startsWith(POSTE2));
  if (dehors.length) throw new Error('un paquet pointe encore ailleurs qu\'ici : ' + dehors.join(', '));
  const absents = chemins.filter(p => !fs.existsSync(p));
  if (absents.length) throw new Error('un paquet enregistré n\'existe pas : ' + absents.join(', '));
  ok('les 2 paquets sont sur CE poste, pas sur la clé : ' + chemins.map(p => path.basename(p)).join(', '));
  const marques = st.dossiers.flatMap(d => (d.packs || [])).filter(p => p.missingFile);
  if (marques.length) throw new Error(marques.length + ' paquet(s) marqués « fichier disparu » alors qu\'ils sont là');
  ok('aucun paquet marqué perdu');

  // Et il s'ouvre vraiment : c'est la preuve que la clé du cabinet est la bonne.
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await attendre(win, 500);
  const listes = await win.evaluate(() => [...document.querySelectorAll('table.list tr[data-id] td:first-child')].map(t => t.textContent.trim()));
  if (listes.length !== 2) throw new Error('la liste ne montre pas les deux clients');
  ok('la liste affiche : ' + listes.join(' | '));
  await win.screenshot({ path: path.join(OUT, '06-poste-neuf-complet.png') });

  console.log('\n' + '─'.repeat(60));
  console.log('erreurs JS : ' + errors.length);
  errors.forEach(e => console.log('  ' + e));
  console.log('captures : ' + OUT);
  await fermer(app);
  if (errors.length) process.exit(1);
  console.log('\n>>> DÉMÉNAGEMENT : OK');
  process.exit(0);
})().catch(e => {
  console.error('\n✗ ' + (e.stack || e.message));
  process.exit(1);
});
