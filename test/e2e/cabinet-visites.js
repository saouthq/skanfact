'use strict';
// ============================================================================================
// e2e:cabinet-visites — chaque étape de chaque visite du Cabinet, JOUÉE (10.14.0)
//
// Skander : « il manque encore beaucoup de parcours… ». Quarante-neuf gestes guidés et vingt-cinq
// visites d'écran : `e2e:cabinet-couverture` vérifie que chaque contrôle a son explication, mais RIEN
// ne vérifiait que chaque étape tombe sur sa cible. Une étape qui vise un sélecteur disparu ne casse
// rien : la bulle annonce « On s'est perdus de vue », et personne ne le voit avant un comptable.
// C'est exactement ce que le test à la souris a trouvé (le clic sur la sixième ligne de la
// Production), et il n'avait joué que cinq parcours sur quarante-neuf.
//
// Pour chaque visite de « Me guider » : on la lance par son VRAI bouton, puis, étape par étape,
//   - la bulle doit être dans l'écran ;
//   - elle ne doit jamais se dire perdue ;
//   - un geste « faire » se JOUE (un clic réel sur la cible, ou la frappe de son essai) ; un geste
//     qui ouvre un sélecteur du système se passe (le sélecteur est remplacé par « annulé ») ;
//   - chaque étape doit avancer — une visite qui reste sur place trois tours de suite est bloquée.
// Une visite qui ne se lance pas sur l'exemple (« D'abord : … ») est COMPTÉE, jamais ignorée : sur
// l'exemple, toutes doivent pouvoir se lancer.
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

// Les gestes qui ouvrent un sélecteur de fichier ou de dossier du système : dans ce parcours, le
// sélecteur répond « annulé », et l'étape se passe par son bouton — c'est ce qu'un humain ferait.
const PAS_DE_TOUR_MAX = 60;

(async () => {
  const j = journal(); const bac = []; const fautes = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-visites-'));
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'cab')}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  // Aucun sélecteur du système ne s'ouvre : il bloquerait le parcours pour toujours.
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    dialog.showSaveDialog = async () => ({ canceled: true });
    dialog.showMessageBox = async () => ({ response: 0 });
  });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const attendre = (ms = 300) => win.waitForTimeout(ms);
  await win.setViewportSize({ width: 1440, height: 900 });

  j.etape('Ouvrir un cabinet neuf, charger l\'exemple');
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', 'visites-2026');
  await win.fill('#lock-pw2', 'visites-2026');
  await win.click('#lock-go');
  await win.waitForSelector('#app', { state: 'visible', timeout: 15000 });
  await attendre(700);
  for (let g = 0; g < 12 && await win.$('#setup'); g++) {
    const nom = await win.$('#setup input[name=name], #w-name');
    if (nom) await nom.fill('Cabinet Visites');
    const suivant = await win.$('#w-next');
    if (!suivant) break;
    await suivant.click();
    await attendre(320);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'), null, { timeout: 8000 }).catch(() => {});
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="app"]');
  await attendre(320);
  const charger = await win.$('#r-demo-on');
  if (charger) { await charger.click(); await attendre(1500); }
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#view table.list tbody tr[data-id]', { timeout: 8000 });
  j.ok('exemple chargé');

  // ------------------------------------------------------------------ la liste, lue dans « Me guider »
  const ouvrirGuide = async () => {
    await win.evaluate(() => { if (window.Visite && window.Visite.enCours()) window.Visite.quitter(); location.hash = '#/guide'; });
    await win.waitForSelector('#view [data-visite]', { timeout: 8000 });
    await attendre(250);
  };
  await ouvrirGuide();
  const ids = await win.evaluate(() => [...new Set([...document.querySelectorAll('#view [data-visite]')].map(b => b.dataset.visite))]);
  if (ids.length < 60) throw new Error(`« Me guider » n'offre que ${ids.length} visites : le parcours n'a pas atteint la liste`);
  j.ok(`${ids.length} visites à jouer`);

  // L'état de la visite, vu par le moteur ET par l'écran.
  const etat = () => win.evaluate(() => {
    const V = window.Visite; const st = V && V.enCours();
    const b = document.querySelector('#visite-bulle');
    const r = b && !b.hidden ? b.getBoundingClientRect() : null;
    const e = V && V.etapeCourante ? V.etapeCourante() : null;
    const faire = e && V.estFaire(e);
    return {
      st, titre: ((b && b.querySelector('#visite-titre')) || {}).textContent || '',
      bulle: r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null, W: innerWidth, H: innerHeight,
      faire: faire ? { mode: e.faire || 'fait', essai: e.essai || null, aFait: typeof e.fait === 'function' } : null,
      cible: e && e.cible ? !!V.resoudre(e.cible) : null
    };
  });

  let jouees = 0, etapes = 0, passees = 0;
  const bloquees = [];
  for (const id of ids) {
    await ouvrirGuide();
    const b = await win.$(`#view [data-visite="${id}"]:not([disabled])`);
    const texte = b ? (await b.textContent()).trim() : '';
    if (!b || /^D.abord/.test(texte)) { bloquees.push(id); continue; }
    await b.scrollIntoViewIfNeeded().catch(() => {});
    await b.click();
    await attendre(900);
    let dernier = -1, surPlace = 0, tours = 0;
    for (; tours < PAS_DE_TOUR_MAX; tours++) {
      const s = await etat();
      if (!s.st) break;                                   // la visite s'est terminée d'elle-même
      if (s.st.id !== id) { fautes.push(`${id} : une autre visite (${s.st.id}) a pris la place`); break; }
      if (s.st.fin) { etapes++; break; }
      if (s.st.perdu) { fautes.push(`${id}, étape ${s.st.index + 1}/${s.st.total} : « On s'est perdus de vue » (${s.titre})`); break; }
      if (!s.bulle) { fautes.push(`${id}, étape ${s.st.index + 1} : aucune bulle à l'écran`); break; }
      if (s.bulle.l < -1 || s.bulle.t < -1 || s.bulle.r > s.W + 1 || s.bulle.b > s.H + 1) {
        fautes.push(`${id}, étape ${s.st.index + 1} « ${s.titre} » : la bulle sort de l'écran (${Math.round(s.bulle.l)},${Math.round(s.bulle.t)} → ${Math.round(s.bulle.r)},${Math.round(s.bulle.b)})`);
      }
      if (s.st.index === dernier) { if (++surPlace >= 3) { fautes.push(`${id}, étape ${s.st.index + 1} « ${s.titre} » : la visite n'avance plus`); break; } }
      else { dernier = s.st.index; surPlace = 0; etapes++; }
      // Le geste : on le JOUE.
      if (s.faire) {
        const essai = s.faire.essai || {};
        const passer = async () => { const p = await win.$('#visite-bulle [data-v="passer"]'); if (p) { await p.click(); passees++; } };
        if (s.cible === false) { await attendre(700); continue; }     // la cible arrive (une fenêtre s'ouvre)
        if (s.faire.mode === 'valeur' || essai.taper) {
          const el = await win.evaluateHandle(() => window.Visite.resoudre(window.Visite.etapeCourante().cible));
          const e = el.asElement();
          if (e && essai.taper) { await e.click({ clickCount: 3 }).catch(() => {}); await win.keyboard.type(String(essai.taper)); }
          await attendre(300);
          const ok = await win.$('#visite-bulle [data-v="suiv"]:not([disabled])');
          if (ok) await ok.click(); else await passer();
        } else {
          const el = await win.evaluateHandle(() => window.Visite.resoudre(window.Visite.etapeCourante().cible));
          const e = el.asElement();
          if (e) {
            await e.scrollIntoViewIfNeeded().catch(() => {});
            await e.click({ timeout: 3000 }).catch(async () => { await passer(); });
            await attendre(700);
            // Un geste qui attend sa PREUVE (un fichier choisi, une fenêtre enregistrée) et que le
            // sélecteur « annulé » ne donnera jamais : on le passe, comme un humain qui renonce.
            const apres = await etat();
            if (apres.st && !apres.st.fin && apres.st.index === s.st.index && s.faire.aFait) await passer();
          } else await passer();
        }
        await attendre(600);
      } else {
        const suiv = await win.$('#visite-bulle [data-v="suiv"]');
        if (suiv) await suiv.click();
        else await win.keyboard.press('ArrowRight');
        await attendre(500);
      }
    }
    if (tours >= PAS_DE_TOUR_MAX) fautes.push(`${id} : plus de ${PAS_DE_TOUR_MAX} tours sans finir`);
    jouees++;
    // Une fenêtre ouverte par un geste ne doit pas rester sous la visite suivante.
    for (let k = 0; k < 3 && await win.$('#modal-root > .modal-bg'); k++) {
      await win.keyboard.press('Escape'); await attendre(250);
      const aband = await win.$('#modal-root button[data-v="abandonner"], #modal-root #a');
      if (aband) { await aband.click().catch(() => {}); await attendre(200); }
    }
    await win.keyboard.press('Escape').catch(() => {});
  }

  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  if (bloquees.length) fautes.push(`${bloquees.length} visite(s) ne se lancent pas sur l'exemple : ${bloquees.join(', ')}`);
  if (fautes.length) { console.error(`\n${fautes.length} faute(s) :\n  ` + fautes.join('\n  ')); process.exit(1); }
  console.log(`\n${jouees} visites jouées, ${etapes} étapes, ${passees} geste(s) passé(s) faute de sélecteur du système : aucune bulle perdue, aucune hors de l'écran.`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
