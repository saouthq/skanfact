// Le scénario catastrophe, dans l'application réelle : le fichier principal du cabinet disparaît.
//
// C'est ce qui justifie tout le travail de la 6.8.0. Avant elle, il n'y avait rien à faire : pas de
// sauvegarde, pas de copie, et la clé qui ouvre les paquets des clients partait avec le fichier.
//
// Ce test vérifie les deux moitiés :
//   1. l'application le DIT au lieu d'afficher « Bienvenue » comme au premier jour ;
//   2. les données reviennent vraiment, la clé du cabinet comprise.
const { playwright, RACINE, ELECTRON } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-perte-'));
const userData = path.join(tmp, 'cab');
const PW = 'mot-de-passe-cabinet';
const errors = [];
let n = 0;
const etape = m => { n++; console.log('\n' + n + '. ' + m); };
const ok = m => console.log('  ✓ ' + m);

async function lancer() {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await win.waitForSelector('#lock-form');
  return { app, win };
}

(async () => {
  // ---------- 1. un cabinet qui travaille ----------
  etape('Un cabinet avec des clients');
  let { app, win } = await lancer();
  await win.fill('#lock-pw', PW);
  await win.fill('#lock-pw2', PW);
  await win.click('#lock-go');
  await win.waitForSelector('#setup', { timeout: 15000 });
  await win.click('#w-next');
  await win.waitForSelector('#w-name');
  await win.fill('#w-name', 'Cabinet Ben Salah');
  await win.click('#w-next');
  await win.waitForSelector('#w-clients');
  await win.fill('#w-clients', 'Menuiserie Trabelsi SUARL ; 1122334A/M/P/000\nPharmacie El Menzah\nCafé des Jasmins');
  await win.click('#w-next');
  await win.waitForTimeout(1200);
  await win.waitForSelector('#w-rec'); await win.click('#w-skip');
  await win.waitForSelector('#w-pair'); await win.click('#w-next');
  await win.waitForTimeout(800);

  const empreinteAvant = await win.evaluate(async () => (await window.cabinet.state()).cabinet.fingerprint);
  const clientsAvant = await win.evaluate(async () => (await window.cabinet.state()).dossiers.map(d => d.name).sort());
  ok(`${clientsAvant.length} clients · empreinte ${empreinteAvant}`);

  // une sauvegarde nommée, comme en prendrait un comptable prudent
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#b-now');
  await win.click('#b-now');
  await win.waitForTimeout(1500);
  const sauvegardes = fs.readdirSync(path.join(userData, 'sauvegardes')).filter(f => f.endsWith('.json'));
  if (!sauvegardes.length) throw new Error('aucune sauvegarde sur le disque');
  ok(`${sauvegardes.length} sauvegarde(s) sur le disque`);
  await app.close();

  // ---------- 2. la catastrophe ----------
  etape('Le fichier principal disparaît');
  const fichier = path.join(userData, 'cabinet-data.json');
  if (!fs.existsSync(fichier)) throw new Error('le fichier de données est introuvable avant même la catastrophe');
  fs.unlinkSync(fichier);
  ok('cabinet-data.json supprimé (disque abîmé, effacement par erreur, restauration partielle…)');

  // ---------- 3. ce que voit le comptable ----------
  etape('Réouverture');
  ({ app, win } = await lancer());
  const message = await win.textContent('#lock-err').catch(() => '');
  const visible = await win.isVisible('#lock-err');
  if (!visible) throw new Error('l\'application ne dit RIEN : elle propose de créer un cabinet comme au premier jour');
  if (!/sauvegarde/i.test(message)) throw new Error('le message ne parle pas des sauvegardes : ' + message);
  if (!/ancien mot de passe/i.test(message)) throw new Error('le message ne dit pas de reprendre l\'ancien mot de passe : ' + message);
  ok('l\'application annonce la perte ET la présence des sauvegardes');
  console.log('     « ' + message.replace(/\s+/g, ' ').trim().slice(0, 150) + ' »');

  // ---------- 4. la récupération ----------
  etape('Récupération');
  await win.fill('#lock-pw', PW);
  await win.fill('#lock-pw2', PW);
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await win.waitForTimeout(1800);
  if (await win.$('#setup')) throw new Error('un assistant de bienvenue s\'ouvre alors qu\'il faut restaurer');
  if (!/reglages/.test(await win.evaluate(() => location.hash))) throw new Error('on n\'est pas emmené là où sont les sauvegardes');
  ok('emmené directement aux sauvegardes, sans assistant de bienvenue');

  await win.waitForSelector('[data-restore="0"]', { timeout: 8000 });
  await win.click('[data-restore="0"]');
  await win.waitForSelector('#modal-root .modal', { timeout: 8000 });
  const dlg = (await win.textContent('#modal-root .modal')).replace(/\s+/g, ' ');
  ok('la sauvegarde annonce son contenu : ' + dlg.slice(0, 90));
  await win.click('#modal-root .modal-bg:last-child .btn-primary');
  await win.waitForTimeout(3000);

  const clientsApres = await win.evaluate(async () => (await window.cabinet.state()).dossiers.map(d => d.name).sort());
  const empreinteApres = await win.evaluate(async () => (await window.cabinet.state()).cabinet.fingerprint);
  if (JSON.stringify(clientsApres) !== JSON.stringify(clientsAvant)) {
    throw new Error(`clients perdus : ${JSON.stringify(clientsApres)} au lieu de ${JSON.stringify(clientsAvant)}`);
  }
  ok(`${clientsApres.length} clients récupérés : ${clientsApres.join(', ')}`);
  // Le point qui compte le plus : la clé du cabinet. Sans elle, tous les paquets déjà reçus — et
  // tous ceux que les clients enverront avec l'ancien appairage — deviennent illisibles.
  if (empreinteApres !== empreinteAvant) {
    throw new Error(`la CLÉ DU CABINET a changé : ${empreinteApres} au lieu de ${empreinteAvant}. ` +
      'Tous les paquets déjà reçus seraient illisibles et les clients devraient réimporter un appairage.');
  }
  ok(`clé du cabinet intacte : ${empreinteApres}`);

  console.log('\nerreurs JS : ' + errors.length);
  errors.slice(0, 6).forEach(e => console.log('  - ' + e));
  await app.close().catch(() => {});
  console.log(errors.length ? '>>> ÉCHEC' : '>>> RÉCUPÉRATION APRÈS PERTE : OK');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('\n✕ ÉCHEC : ' + (e.stack || e.message)); process.exit(2); });
