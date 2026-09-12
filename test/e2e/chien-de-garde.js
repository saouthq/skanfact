// Le chien de garde, pour de vrai : on GÈLE l'interface avec une boucle infinie et on vérifie que
// le processus principal s'en aperçoit, écrit où ça bloque, interrompt la boucle et repart.
// C'est le test du bug de la 5.1.0 — celui qu'aucune console ne montrait.
const { playwright, RACINE, ELECTRON, VERSION } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const root = RACINE;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-'));
const log = path.join(dir, 'main.log');

(async () => {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${dir}`, root],
    executablePath: ELECTRON,
    env: { ...process.env }
  });
  const win = await app.firstWindow();
  await win.waitForSelector('#setup');
  console.log('1. application lancée');

  // On gèle : une boucle sans fin sur le fil principal du renderer. Exactement le symptôme de la
  // 5.1.0 — aucune erreur, aucun plantage, plus aucun clic possible.
  console.log('2. gel provoqué…');
  win.evaluate(() => { function boucleSansFin() { for (;;) { Math.sqrt(Date.now()); } } boucleSansFin(); }).catch(() => {});

  // L'application doit se débloquer toute seule et le DIRE.
  const t0 = Date.now();
  let dit = '';
  while (Date.now() - t0 < 70000) {
    await new Promise(r => setTimeout(r, 1500));
    dit = await win.evaluate(() => {
      const m = document.querySelector('#modal-root .modal');
      return m ? m.textContent.replace(/\s+/g, ' ').slice(0, 130) : '';
    }).catch(() => '');
    if (dit) break;
  }
  const delai = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`3. l'application s'est débloquée et s'explique en ${delai} s : ${dit ? 'oui' : 'NON'}`);
  if (dit) console.log('   « ' + dit + ' »');
  const vu = dit ? [dit] : [];

  // Le journal doit porter le gel ET la pile d'appels : c'est ce qui rend un rapport utile.
  const texte = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
  const aGel = /gel détecté/.test(texte);
  const aPile = /pile d'appels/.test(texte);
  const nomme = /boucleSansFin/.test(texte);
  console.log(`4. journal : gel=${aGel} · pile=${aPile} · fonction nommée=${nomme}`);
  if (aPile) {
    const bloc = texte.split('pile d\'appels]')[1] || '';
    bloc.split('\n').slice(0, 5).forEach(l => l.trim() && console.log('   ' + l.trim()));
  }

  // Et après ? L'application doit être vivante.
  let repond = false;
  try {
    await win.waitForSelector('#setup', { timeout: 20000 });
    repond = await win.evaluate(() => 1 + 1 === 2);
  } catch {}
  console.log('5. l\'interface répond à nouveau : ' + repond);

  const ok = vu.length > 0 && aGel && aPile && repond;
  console.log(ok ? '>>> CHIEN DE GARDE OK' : '>>> ÉCHEC');
  await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('ÉCHEC : ' + (e.stack || e.message)); process.exit(2); });
