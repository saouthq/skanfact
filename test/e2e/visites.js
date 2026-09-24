'use strict';
// ============================================================================================
// e2e:visites — chaque étape de chaque visite de SkanFact (l'application entreprise), JOUÉE (10.14.0)
//
// Le jumeau de `e2e:cabinet-visites` (7.3.0 : un instrument qui ne couvre qu'une des deux
// applications ne protège qu'une des deux). `e2e:couverture` vérifie que chaque contrôle a son
// explication ; rien ne vérifiait que chaque étape tombe sur sa cible — une étape qui vise un
// sélecteur disparu se tait sans rien casser, et la bulle dit « On s'est perdus de vue » à un
// débutant.
//
// Deux passes, parce que les visites n'ont pas toutes le même terrain :
//   1. sur l'EXEMPLE, toutes les visites sauf celles de la vraie entreprise (`reel`) — leur bouton
//      dit « Quitter l'exemple et… », et les lancer ici changerait de données au milieu du parcours ;
//   2. dans la vraie entreprise (celle de l'assistant), les visites `reel`.
// Une visite qui ne se lance pas sur l'exemple (« D'abord : … ») est une faute ; dans la vraie
// entreprise, qui est neuve, c'est normal et c'est seulement compté.
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { neutraliserSysteme, traverserAssistant, chargerExemple, toutAfficher } = require('./ecrans-entreprise');
const { jouer } = require('./jouer-visites');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = []; const fautes = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visites-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'ent')}`, RACINE], executablePath: ELECTRON, env: { ...process.env } });
  await neutraliserSysteme(app);
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const attendre = (ms = 300) => win.waitForTimeout(ms);
  await win.setViewportSize({ width: 1440, height: 900 });

  j.etape('Une entreprise neuve, puis l\'exemple avec tous ses modules');
  await traverserAssistant(win, null);
  await chargerExemple(win);
  await toutAfficher(win);
  j.ok('exemple chargé');

  const ouvrirGuide = async () => {
    await win.evaluate(() => { if (window.Visite && window.Visite.enCours()) window.Visite.quitter(); location.hash = '#/guide'; });
    await win.waitForSelector('#view [data-visite]', { timeout: 8000 });
    await attendre(250);
  };
  // Au lancement, une visite de la vraie entreprise demande de quitter l'exemple : on accepte.
  const apresLancement = async () => {
    const ok = await win.$('#modal-root > .modal-bg:last-child #ok');
    if (ok) { await ok.click(); await attendre(1200); }
  };
  await ouvrirGuide();
  const lire = () => win.evaluate(() => {
    const vus = new Map();
    document.querySelectorAll('#view [data-visite]').forEach(b => { if (!vus.has(b.dataset.visite)) vus.set(b.dataset.visite, b.textContent.trim()); });
    return [...vus.entries()];
  });
  const tous = await lire();
  if (tous.length < 50) throw new Error(`« Me guider » n'offre que ${tous.length} visites : le parcours n'a pas atteint la liste`);
  const reels = tous.filter(([, t]) => /^Quitter l.exemple/.test(t)).map(([id]) => id);
  const surExemple = tous.map(([id]) => id).filter(id => !reels.includes(id));
  j.ok(`${tous.length} visites : ${surExemple.length} sur l'exemple, ${reels.length} dans la vraie entreprise`);

  const compte = { etapes: 0, passees: 0 };
  let jouees = 0;
  const bloqueesExemple = [], attendent = [];
  const passe = async (ids, bloquees, lancer) => {
    for (const id of ids) {
      process.stdout.write(`  · ${id}\n`);
      try {
        const r = await jouer(win, id, { ouvrirGuide, apresLancement: lancer, fautes, compte });
        if (r.bloquee) bloquees.push(id); else jouees++;
      } catch (e) {
        const m = String(e && e.message || e);
        if (!/context was destroyed|navigation|Target closed/.test(m)) throw e;
        fautes.push(`${id} : un geste a rechargé la fenêtre au milieu de la visite`);
        await win.waitForLoadState('domcontentloaded').catch(() => {});
        await attendre(1500);
      }
    }
  };

  j.etape('Sur l\'exemple : chaque visite, étape par étape');
  await passe(surExemple, bloqueesExemple, null);
  j.ok(`${jouees} visites jouées`);

  j.etape('Dans la vraie entreprise : les visites qui s\'y font');
  const avant = jouees;
  await passe(reels, attendent, apresLancement);
  j.ok(`${jouees - avant} visites jouées${attendent.length ? `, ${attendent.length} attendent un préalable (entreprise neuve) : ${attendent.join(', ')}` : ''}`);

  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  if (bloqueesExemple.length) fautes.push(`${bloqueesExemple.length} visite(s) ne se lancent pas sur l'exemple : ${bloqueesExemple.join(', ')}`);
  if (fautes.length) { console.error(`\n${fautes.length} faute(s) :\n  ` + fautes.join('\n  ')); process.exit(1); }
  console.log(`\n${jouees} visites jouées, ${compte.etapes} étapes, ${compte.passees} geste(s) passé(s) faute de sélecteur du système : aucune bulle perdue, aucune hors de l'écran.`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
