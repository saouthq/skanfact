// Ce que le cabinet fait des cas tordus : un fichier qui n'est pas un paquet, le même mois reçu
// deux fois, un paquet adressé à quelqu'un d'autre, un paquet protégé par mot de passe, et un
// paquet qui contient un fichier que son manifeste n'annonce pas. Ce sont les situations qu'un
// comptable rencontrera pour de vrai, et dans lesquelles un mauvais message coûte un appel.
const { playwright, RACINE, ELECTRON } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const root = RACINE;
const Z = require(path.join(root, 'src', 'zip.js'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refus-'));
const errors = [];

// Un paquet minimal mais authentique : manifeste + page de garde, empreintes correctes.
function paquet(nom, matricule, mois, definitif) {
  const cover = Buffer.from('%PDF-1.4 page de garde');
  const man = {
    format: 1, app: 'SkanFact',
    entreprise: { nom, matricule, devise: 'DT' },
    periode: { mois, du: mois + '-01', au: mois + '-28', libelle: mois },
    definitif, genereLe: new Date().toISOString(), poste: 'test',
    manques: [], absents: [],
    fichiers: [{ chemin: '00-page-de-garde.pdf', empreinte: Z.sha256(cover) }]
  };
  return Z.zipBuffer([
    { name: 'manifeste.json', data: Buffer.from(JSON.stringify(man, null, 2)) },
    { name: '00-page-de-garde.pdf', data: cover }
  ]);
}

// Le même paquet, mais avec un fichier glissé dedans APRÈS coup : il est dans le ZIP, il n'est pas
// dans le manifeste. C'est le cas C6 — l'application comptait « 1 pièce vérifiée, intacte » pour un
// paquet qui en contenait deux, et la seconde s'ouvrait d'un clic sans que personne l'ait regardée.
function paquetAvecIntrus(nom, matricule, mois) {
  const cover = Buffer.from('%PDF-1.4 page de garde');
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
    { name: '00-page-de-garde.pdf', data: cover },
    { name: 'bonus/lisez-moi.pdf', data: Buffer.from('%PDF-1.4 personne ne m a verifie') }
  ]);
}

const ecrire = (nom, buf) => { const p = path.join(dir, nom); fs.writeFileSync(p, buf); return p; };

(async () => {
  const pw = 'mot-de-passe-cabinet';
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'cab')}`, path.join(root, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', pw); await win.fill('#lock-pw2', pw); await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])');
  // Depuis la 6.8.0, un assistant s'ouvre au premier lancement : on le traverse en ne renseignant
  // que le nom du cabinet, tout le reste se passe plus tard.
  await win.waitForSelector('#setup', { timeout: 10000 });
  await win.click('#w-next');
  await win.waitForSelector('#w-name');
  await win.fill('#w-name', 'Cabinet Ben Salah');
  await win.click('#w-next');
  await win.waitForSelector('#w-clients'); await win.click('#w-skip');
  await win.waitForSelector('#w-rec'); await win.click('#w-skip');
  await win.waitForSelector('#w-pair'); await win.click('#w-next');
  await win.waitForTimeout(600);

  const importer = async (fichiers) => {
    await app.evaluate(({ dialog }, fs2) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: fs2 }); }, fichiers);
    await win.evaluate(() => { location.hash = '#/dossiers'; });
    await win.waitForSelector('#imp');
    await win.click('#imp');
    await win.waitForSelector('#modal-root .imp-list', { timeout: 30000 });
    const t = (await win.textContent('#modal-root .imp-list')).replace(/\s+/g, ' ').trim();
    await win.click('#modal-root #ok');
    await win.waitForTimeout(300);
    // Depuis la 9.1.0, le PREMIER import réussi demande la clé de secours — c'est le moment où
    // elle protège encore, et c'est voulu. Elle reste donc ouverte par-dessus, et le clic suivant
    // tombait dans le vide. On la reconnaît à ce qu'elle CONTIENT, jamais à son rang, et on prend
    // « Pas maintenant » : ce parcours teste les refus d'import, pas les filets.
    for (let i = 0; i < 3 && await win.$('#modal-root .modal'); i++) {
      const texte = await win.textContent('#modal-root .modal');
      const bouton = /clé de secours/i.test(texte) ? '#modal-root #no' : '#modal-root #ok';
      if (!(await win.$(bouton))) break;
      await win.click(bouton);
      await win.waitForTimeout(250);
    }
    return t;
  };

  // 1. un fichier qui n'est pas un paquet
  const faux = ecrire('notes.skanpack', Buffer.from('ceci est une liste de courses, pas une comptabilité'));
  console.log('1. ' + (await importer([faux])).slice(0, 120));

  // 2. un vrai paquet, définitif
  const p1 = ecrire('mars.skanpack', paquet('Menuiserie Trabelsi SUARL', '1234567A/M/P/000', '2026-03', true));
  console.log('2. ' + (await importer([p1])).slice(0, 130));

  // 3. le MÊME mois renvoyé, cette fois provisoire : c'est l'information qui compte
  const p2 = ecrire('mars-bis.skanpack', paquet('Menuiserie Trabelsi SUARL', '1234567A/M/P/000', '2026-03', false));
  const renvoi = await importer([p2]);
  console.log('3. ' + renvoi.slice(0, 190));

  // 4. un paquet chiffré pour un AUTRE cabinet
  const autre = Z.generateCabinetKeys();
  const scelle = Z.sealForCabinet(paquet('Pharmacie El Menzah', '2233445B', '2026-04', true), autre.publicKey, {
    entreprise: 'Pharmacie El Menzah', periode: '2026-04', definitif: true, format: 1
  });
  const p3 = ecrire('pas-pour-moi.skanpack', scelle);
  console.log('4. ' + (await importer([p3])).slice(0, 140));

  // 5. un paquet protégé par mot de passe : la demande doit apparaître
  const motdepasse = Z.sealBuffer(paquet('Studio Sfax', '3344556C', '2026-05', true), 'secret-du-client', {
    entreprise: 'Studio Sfax', periode: '2026-05', definitif: true, format: 1
  });
  const p4 = ecrire('protege.skanpack', motdepasse);
  await app.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] }); }, p4);
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#imp');
  await win.click('#imp');
  await win.waitForSelector('#modal-root #pw', { timeout: 20000 });
  const demande = (await win.textContent('#modal-root .modal')).replace(/\s+/g, ' ').slice(0, 110);
  console.log('5. ' + demande);
  await win.fill('#modal-root #pw', 'secret-du-client');
  await win.click('#modal-root #ok');
  await win.waitForSelector('#modal-root .imp-list', { timeout: 20000 });
  const ouvert = (await win.textContent('#modal-root .imp-list')).replace(/\s+/g, ' ').slice(0, 110);
  console.log('6. ' + ouvert);
  await win.click('#modal-root #ok');

  // 7. un paquet qui contient un fichier que son manifeste n'annonce pas
  const p5 = ecrire('avec-intrus.skanpack', paquetAvecIntrus('Boulangerie Ariana', '4455667D', '2026-06'));
  const rapport = await importer([p5]);
  console.log('7. ' + rapport.slice(0, 170));
  let souci = '';
  if (!/non annoncé/.test(rapport)) souci = 'le rapport d\'import ne signale pas le fichier en trop';
  if (/2 pièces vérifiées/.test(rapport)) souci = 'le fichier en trop est compté comme une pièce vérifiée';
  // Et la liste des fichiers doit le montrer, marqué, avec une question avant l'ouverture.
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForTimeout(400);
  const versFiche = await win.$('table.list tr[data-id]:last-child');
  if (versFiche) {
    await versFiche.click();
    await win.waitForTimeout(500);
    const voir = await win.$('[data-open], .pack-open, tr[data-month] .btn');
    if (voir) {
      await voir.click();
      await win.waitForSelector('#modal-root .modal', { timeout: 10000 });
      const liste = (await win.textContent('#modal-root .modal')).replace(/\s+/g, ' ');
      // Le bandeau le dit, et la ligne du fichier porte un « ? » : on vérifie les deux.
      if (!/n'est pas annoncé|ne sont pas annoncés/.test(liste)) souci = souci || 'la liste des fichiers ne prévient pas';
      const marque = await win.evaluate(() => [...document.querySelectorAll('#modal-root tr[data-i]')]
        .filter(tr => tr.querySelector('.err-inline'))
        .map(tr => tr.querySelector('td').textContent.trim()));
      if (!marque.some(m => /lisez-moi/.test(m))) souci = souci || 'le fichier en trop ne porte pas de marque dans la liste';
      else console.log('   · marqué dans la liste : ' + marque.join(', '));
      console.log('8. liste : ' + liste.slice(0, 150));
      await win.keyboard.press('Escape');
      await win.waitForTimeout(400);
    }
  }
  if (souci) { console.log('   ✗ ' + souci); errors.push(souci); }
  else console.log('   ✓ le fichier non annoncé est signalé, et il ne compte pas comme vérifié');

  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForTimeout(400);
  const dossiers = await win.evaluate(() => [...document.querySelectorAll('table.list tr[data-id] td:first-child')].map(t => t.textContent.trim()));
  console.log('9. dossiers au final : ' + dossiers.join(' | '));

  // Trois dossiers attendus, et pas cinq : le fichier qui n'est pas un paquet et celui adressé à un
  // autre cabinet ne doivent EN CRÉER AUCUN. C'est le vrai résultat du test.
  const ok = dossiers.length === 3 && !errors.length;
  console.log('\nerreurs JS : ' + errors.length);
  errors.slice(0, 5).forEach(e => console.log('  - ' + e));
  console.log(ok ? '>>> CAS TORDUS OK' : '>>> À REGARDER');
  await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('ÉCHEC : ' + (e.stack || e.message)); process.exit(2); });
