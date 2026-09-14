// Public ou privé : un seul interrupteur (7.26.0).
//
// Le dépôt de SkanFact a été rendu public pour que les publications soient gratuites. Il
// redeviendra peut-être privé — et ce jour-là, tout doit suivre : GitHub refuse tout sans jeton
// d'accès sur un dépôt privé, il faut donc un champ où le coller et des phrases qui l'expliquent.
//
// Ce test BASCULE VRAIMENT le drapeau, ouvre l'application, et regarde l'écran. C'est la seule
// façon de savoir : relire le code ne dit pas si le champ apparaît, et la 7.24.0 l'avait supprimé
// purement et simplement — basculer n'aurait plus rien réarmé, et l'écran aurait affiché « colle
// ton jeton ci-dessous » au-dessus de rien du tout.
//
// Le fichier est remis dans son état d'origine quoi qu'il arrive (`finally`), et le test refuse de
// démarrer s'il n'est pas propre au départ.
//
//   xvfb-run -a node test/e2e/depot.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

const DEPOT = path.join(RACINE, 'src', 'depot.js');
const ORIGINE = fs.readFileSync(DEPOT, 'utf8');

// Ouvre l'application, va sur Paramètres → Mises à jour, et rend ce que l'écran montre.
async function regarder(j, etiquette) {
  const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-depot-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, etiquette, bac);
  await win.setViewportSize({ width: 1440, height: 900 });
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Dépôt SUARL');
      await win.fill('#sf-form input[name=matricule]', '9988776Z/A/M/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(110);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="app"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="app"]'); return p && !p.hidden; });
  await win.waitForSelector('#update-panel');
  const vu = await win.evaluate(() => {
    const p = document.querySelector('#update-panel');
    return {
      champ: !!p.querySelector('#upd-token'),
      enregistrer: !!p.querySelector('#upd-token-save'),
      texte: p.textContent.replace(/\s+/g, ' ').trim(),
      prive: !!(window.__updApp && window.__updApp.private),
    };
  });
  await app.close();
  if (bac.length) throw new Error(`Erreurs du renderer (${etiquette}) :\n` + bac.join('\n'));
  return vu;
}

(async () => {
  const j = journal();
  if (!/private:\s*false/.test(ORIGINE)) {
    throw new Error('src/depot.js n\'est pas dans son état normal (private: false) — refus de continuer');
  }
  try {
    // -------------------------------------------------- dépôt PUBLIC (l'état du jour)
    j.etape('Dépôt public : aucun jeton réclamé');
    const pub = await regarder(j, 'public');
    if (pub.champ || pub.enregistrer) throw new Error('le champ jeton s\'affiche alors que le dépôt est public');
    if (/un jeton de lecture est nécessaire/i.test(pub.texte)) {
      throw new Error('l\'écran réclame un jeton sur un dépôt public : « ' + pub.texte.slice(0, 140) + ' »');
    }
    j.ok('rien à saisir, et rien qui le réclame');

    // -------------------------------------------------- on bascule POUR DE VRAI
    j.etape('On bascule src/depot.js en privé — une seule ligne');
    fs.writeFileSync(DEPOT, ORIGINE.replace('private: false', 'private: true'), 'utf8');
    const priv = await regarder(j, 'privé');
    if (!priv.champ) throw new Error('dépôt privé et AUCUN champ où coller un jeton : c\'est un cul-de-sac');
    if (!priv.enregistrer) throw new Error('le champ est là mais aucun bouton pour l\'enregistrer');
    if (!/privé/i.test(priv.texte)) throw new Error('l\'écran ne dit pas que le dépôt est privé : « ' + priv.texte.slice(0, 140) + ' »');
    j.ok('le champ est revenu, et la phrase avec');

    // -------------------------------------------------- et on revient
    j.etape('On repasse en public : le champ repart');
    fs.writeFileSync(DEPOT, ORIGINE, 'utf8');
    const retour = await regarder(j, 'retour');
    if (retour.champ) throw new Error('le champ jeton reste après le retour au public');
    j.ok('symétrique dans les deux sens');
  } finally {
    // Quoi qu'il arrive, le dépôt repart dans l'état où on l'a trouvé. Un test qui laisse le code
    // modifié derrière lui est pire qu'un test absent.
    fs.writeFileSync(DEPOT, ORIGINE, 'utf8');
  }

  console.log('\nUn seul interrupteur : `private` dans src/depot.js, et les deux écrans suivent.');
})().catch(e => { try { fs.writeFileSync(DEPOT, ORIGINE, 'utf8'); } catch {} console.error(e); process.exit(1); });
