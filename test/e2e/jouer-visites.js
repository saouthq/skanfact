'use strict';
// ============================================================================================
// Jouer une visite guidée, étape par étape, comme quelqu'un qui la suit (10.14.0).
//
// Partagé par `e2e:cabinet-visites` et `e2e:visites` : la même règle pour les deux applications, en
// un seul exemplaire (une règle recopiée d'un parcours à l'autre dérive, 7.29.0 ; 10.12.0, E-01).
//
// Pour chaque visite de « Me guider » : on la lance par son VRAI bouton, puis, étape par étape,
//   - la bulle doit être dans l'écran ;
//   - elle ne doit jamais se dire perdue (« On s'est perdus de vue ») ;
//   - un geste « faire » se JOUE (un clic réel sur la cible, ou la frappe de son essai) ; un geste
//     qui attend sa preuve — un fichier choisi, une fenêtre enregistrée — et que le sélecteur du
//     système « annulé » ne donnera jamais se passe par son bouton, comme un humain qui renonce ;
//   - chaque étape doit avancer — une visite qui reste sur place trois tours de suite est bloquée.
// ============================================================================================

const PAS_DE_TOUR_MAX = 80;

// L'état de la visite, vu par le moteur ET par l'écran.
const ETAT = () => {
  const V = window.Visite; const st = V && V.enCours();
  const b = document.querySelector('#visite-bulle');
  const r = b && !b.hidden ? b.getBoundingClientRect() : null;
  const e = V && V.etapeCourante ? V.etapeCourante() : null;
  const faire = e && V.estFaire(e);
  let cible = null;
  if (e && e.cible) { try { cible = !!V.resoudre(e.cible); } catch (_) { cible = false; } }
  return {
    st, titre: ((b && b.querySelector('#visite-titre')) || {}).textContent || '',
    bulle: r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null, W: window.innerWidth, H: window.innerHeight,
    faire: faire ? { mode: e.faire || 'fait', essai: e.essai || null, aFait: typeof e.fait === 'function' } : null,
    cible
  };
};

// `ouvrirGuide` : amène « Me guider » à l'écran (propre à chaque application). `apresLancement` :
// ce qu'il faut répondre à une question posée au lancement (quitter l'exemple, le charger).
async function jouer(win, id, { ouvrirGuide, apresLancement, fautes, compte }) {
  const attendre = (ms = 300) => win.waitForTimeout(ms);
  await ouvrirGuide();
  // L'impression du système bloquerait le parcours pour toujours (une boîte modale que personne ne
  // referme) — et elle le cachait : un geste qui imprime sans l'annoncer est une faute, qu'on NOMME.
  await win.evaluate(() => { if (!window.__imprStub) { window.__imprStub = true; window.__imprimes = 0; window.print = () => { window.__imprimes++; }; } });
  const b = await win.$(`#view [data-visite="${id}"]:not([disabled])`);
  const texte = b ? (await b.textContent()).trim() : '';
  if (!b || /^D.abord/.test(texte)) return { bloquee: true, texte };
  await b.scrollIntoViewIfNeeded().catch(() => {});
  await b.click();
  await attendre(700);
  if (apresLancement) await apresLancement();
  await attendre(400);
  let dernier = -1, surPlace = 0, tours = 0, vue = false;
  for (; tours < PAS_DE_TOUR_MAX; tours++) {
    const s = await win.evaluate(ETAT);
    if (!s.st) { if (!vue) fautes.push(`${id} : la visite ne s'est pas lancée (« ${texte} »)`); break; }
    vue = true;
    if (s.st.id !== id) { fautes.push(`${id} : une autre visite (${s.st.id}) a pris la place`); break; }
    if (s.st.fin) { compte.etapes++; break; }
    if (s.st.perdu) { fautes.push(`${id}, étape ${s.st.index + 1}/${s.st.total} : « On s'est perdus de vue » (${s.titre})`); break; }
    if (!s.bulle) { await attendre(500); if (++surPlace >= 4) { fautes.push(`${id}, étape ${s.st.index + 1} : aucune bulle à l'écran`); break; } continue; }
    if (s.bulle.l < -1 || s.bulle.t < -1 || s.bulle.r > s.W + 1 || s.bulle.b > s.H + 1) {
      fautes.push(`${id}, étape ${s.st.index + 1} « ${s.titre} » : la bulle sort de l'écran (${Math.round(s.bulle.l)},${Math.round(s.bulle.t)} → ${Math.round(s.bulle.r)},${Math.round(s.bulle.b)})`);
    }
    if (s.st.index === dernier) { if (++surPlace >= 3) { fautes.push(`${id}, étape ${s.st.index + 1} « ${s.titre} » : la visite n'avance plus`); break; } }
    else { dernier = s.st.index; surPlace = 0; compte.etapes++; }
    const passer = async () => { const p = await win.$('#visite-bulle [data-v="passer"]'); if (p) { await p.click(); compte.passees++; } };
    if (s.faire) {
      const essai = s.faire.essai || {};
      if (s.cible === false) { await attendre(700); continue; }       // la cible arrive (une fenêtre s'ouvre)
      const el = (await win.evaluateHandle(() => window.Visite.resoudre(window.Visite.etapeCourante().cible))).asElement();
      if (s.faire.mode === 'valeur' || essai.taper || essai.choisir != null) {
        if (el && essai.taper) { await el.click({ clickCount: 3 }).catch(() => {}); await win.keyboard.type(String(essai.taper)); }
        // Une liste : on choisit l'option par sa valeur, ou la première proposée quand la valeur est un identifiant tiré au hasard.
        if (el && essai.choisir != null) {
          // « premier » : la première option qui a une valeur et qu'on PROPOSE (une option cachée n'est pas un choix).
          const v = essai.choisir === 'premier'
            ? await el.evaluate(s => { const o = [...s.options].find(x => x.value && !x.hidden && !x.disabled); return o ? o.value : ''; })
            : String(essai.choisir);
          if (v) await el.selectOption(v).catch(() => {});
        }
        await attendre(300);
        const ok = await win.$('#visite-bulle [data-v="suiv"]:not([disabled])');
        if (ok) await ok.click(); else await passer();
      } else if (el) {
        await el.scrollIntoViewIfNeeded().catch(() => {});
        const imprAvant = await win.evaluate(() => window.__imprimes || 0);
        await el.click({ timeout: 3000 }).catch(async () => { await passer(); });
        await attendre(700);
        const imprApres = await win.evaluate(() => window.__imprimes || 0).catch(() => imprAvant);
        if (imprApres > imprAvant && !/imprim/i.test(s.titre)) fautes.push(`${id}, étape ${s.st.index + 1} « ${s.titre} » : le geste a ouvert l'impression`);
        const apres = await win.evaluate(ETAT);
        if (apres.st && !apres.st.fin && apres.st.index === s.st.index && s.faire.aFait) await passer();
      } else await passer();
      await attendre(500);
    } else {
      const suiv = await win.$('#visite-bulle [data-v="suiv"]');
      if (suiv) await suiv.click(); else await win.keyboard.press('ArrowRight');
      await attendre(450);
    }
  }
  if (tours >= PAS_DE_TOUR_MAX) fautes.push(`${id} : plus de ${PAS_DE_TOUR_MAX} tours sans finir`);
  // Une fenêtre ouverte par un geste ne doit pas rester sous la visite suivante.
  await win.evaluate(() => { if (window.Visite && window.Visite.enCours()) window.Visite.quitter(); });
  for (let k = 0; k < 4 && await win.$('#modal-root > .modal-bg'); k++) {
    await win.keyboard.press('Escape'); await attendre(250);
    // Seule la question « Abandonner cette saisie ? » se confirme : un autre #ok pourrait enregistrer.
    const aband = await win.evaluateHandle(() => {
      const top = document.querySelector('#modal-root > .modal-bg:last-child');
      if (!top || !/Abandonner cette saisie/.test(top.textContent)) return null;
      return top.querySelector('#ok, #a, button[data-v="abandonner"]');
    });
    const e = aband.asElement();
    if (e) { await e.click().catch(() => {}); await attendre(200); }
  }
  await win.keyboard.press('Escape').catch(() => {});
  return { bloquee: false };
}

// Ramener « Me guider » à l'écran, quoi qu'ait laissé la visite précédente : une fenêtre ouverte, une
// question « modifications non enregistrées », l'écran de verrouillage. Trois essais ; au troisième
// échec, l'état de l'écran part dans l'erreur ET dans une capture — un parcours qui tombe sur « délai
// dépassé » sans dire où il était ne se répare pas.
async function amenerGuide(win, { deverrouiller, dossier = 'dist-e2e/visites', precedente = '' } = {}) {
  const attendre = (ms = 300) => win.waitForTimeout(ms);
  let dernier = null;
  for (let essai = 0; essai < 3; essai++) {
    await win.evaluate(() => { if (window.Visite && window.Visite.enCours()) window.Visite.quitter(); }).catch(() => {});
    for (let k = 0; k < 4 && await win.$('#modal-root > .modal-bg'); k++) {
      const quitter = await win.evaluateHandle(() => {
        const top = document.querySelector('#modal-root > .modal-bg:last-child');
        if (!top) return null;
        // Une question de sortie se répond par « quitter sans enregistrer » ; toute autre se referme.
        if (/Abandonner cette saisie|non enregistr/i.test(top.textContent)) {
          return [...top.querySelectorAll('button')].find(b => /abandonner|quitter|sans enregistrer|ne pas enregistrer/i.test(b.textContent)) || null;
        }
        return null;
      });
      const q = quitter.asElement();
      if (q) await q.click().catch(() => {}); else await win.keyboard.press('Escape');
      await attendre(250);
    }
    if (deverrouiller) await deverrouiller();
    await win.evaluate(() => { location.hash = '#/guide'; }).catch(() => {});
    try {
      await win.waitForSelector('#view [data-visite]', { timeout: 5000 });
      await attendre(250);
      return;
    } catch (e) { dernier = e; }
  }
  const etat = await win.evaluate(() => ({
    hash: location.hash,
    fenetre: ((document.querySelector('#modal-root > .modal-bg:last-child') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 200),
    verrou: !!document.querySelector('#lock-screen:not([hidden])'),
    setup: !!document.querySelector('#setup'),
    vue: ((document.querySelector('#view') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 200)
  })).catch(() => ({}));
  const fs = require('fs'); const path = require('path');
  fs.mkdirSync(dossier, { recursive: true });
  await win.screenshot({ path: path.join(dossier, 'guide-introuvable.png') }).catch(() => {});
  throw new Error(`« Me guider » ne revient pas après la visite ${precedente || '?'} : ${JSON.stringify(etat)} (${dernier && dernier.message.split('\n')[0]})`);
}

module.exports = { jouer, amenerGuide, ETAT, PAS_DE_TOUR_MAX };
