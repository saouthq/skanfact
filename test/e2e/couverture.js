// SkanFact (l'application entreprise) — CHAQUE contrôle de CHAQUE écran a son explication (10.14.0).
//
// Skander : « une visite guidée complète, qui couvre la totalité des deux applications, qui couvre
// tous les boutons, bref tout ». La visite d'une page explique chaque bouton d'une zone (l'étape
// « liste » du moteur) en demandant à `SkanVisites.expliquer(el)` ce qu'il fait. Un bouton que le
// dictionnaire ne connaît pas disparaît de la bulle SANS UN MOT : elle liste les autres, et personne
// ne sait qu'il en manque un — c'est très exactement le défaut qu'aucune relecture ne voit.
//
// Cet instrument le dit. Il suit le parcours de `e2e:entreprise-rendu` (`ecrans-entreprise.js` :
// les pages lues dans le code, tous leurs onglets, une fiche par objet, une pièce par type ET par
// statut, les fenêtres ouvertes par leur vrai bouton, les menus de ligne et leurs entrées), sur une
// entreprise VIERGE puis sur l'exemple, et demande l'explication de chaque contrôle visible — dans
// la page, dans la fenêtre du dessus et dans le menu ouvert. Son premier passage, le 24/09/2026, en
// a trouvé 181 sans explication (30 distincts) : 81 entrées de menus « Actions », l'opération
// diverse ligne à ligne, le relevé de compte, le bulletin, la sortie d'un bien…
//
//   xvfb-run -a node test/e2e/couverture.js      → dist-e2e/couverture/manquants.json
const { fermer, playwright, RACINE, ELECTRON, journal, dossierCaptures } = require('./harnais');
const { creerParcours, neutraliserSysteme, traverserAssistant, chargerExemple, toutAfficher, pagesDuCode } = require('./ecrans-entreprise');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

// Le plancher de contrôles examinés : un instrument qui n'atteint pas ses écrans annonce « tout va
// bien » (T-55, 9.8.8). S'il en lit moins, c'est qu'une page, une fiche ou une fenêtre a cessé
// d'être atteinte — ou que le moteur de visite n'est plus chargé.
const PLANCHER = 3000;

// La sonde : le moteur désigne ce qui est un contrôle (`Visite.CONTROLES`, la liste même que l'étape
// « liste » parcourt) ; le dictionnaire dit ce qu'il fait. Les bulles « i » ne sont pas des gestes :
// elles SONT l'explication de leur champ.
const SONDE = () => {
  const V = window.Visite, S = window.SkanVisites;
  if (!V || !S) return { erreur: 'le moteur de visite n\'est pas chargé' };
  const fen = document.querySelector('#modal-root > .modal-bg:last-child');
  const racines = [fen || document.querySelector('#view')];
  const menu = document.querySelector('.row-menu'); if (menu) racines.push(menu);
  const manquants = []; let lus = 0;
  racines.forEach(rac => {
    if (!rac) return;
    rac.querySelectorAll(V.CONTROLES).forEach(el => {
      if (el.matches('button.i') || !V.visible(el)) return;
      lus++;
      let x = null; try { x = S.expliquer(el, { G: window.SkanGuide }); } catch (_) { x = null; }
      if (x && x.texte) return;
      const data = {}; [...el.attributes].forEach(a => { if (a.name.startsWith('data-')) data[a.name] = a.value.slice(0, 30); });
      manquants.push({ tag: el.tagName.toLowerCase(), id: el.id || '', name: el.getAttribute('name') || '', data,
        lib: S.libelleDe(el).slice(0, 60), fenetre: !!el.closest('#modal-root'), menu: !!el.closest('.row-menu') });
    });
  });
  return { route: location.hash, lus, manquants };
};

(async () => {
  const j = journal(); const bac = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'couverture-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'ent')}`, RACINE], executablePath: ELECTRON, env: { ...process.env } });
  await neutraliserSysteme(app);
  const win = await app.firstWindow();
  let ici = 'démarrage';
  win.on('pageerror', e => bac.push(`${ici} — PAGEERROR: ${e.message}`));
  await win.setViewportSize({ width: 1440, height: 900 });
  const OUT = dossierCaptures('couverture');

  const res = []; let lus = 0;
  const visiter = async nom => {
    ici = nom;
    const r = await win.evaluate(SONDE);
    if (r.erreur) throw new Error(`${nom} : ${r.erreur}`);
    lus += r.lus;
    res.push({ nom, ...r });
  };
  const passe = async (etat) => {
    const p = creerParcours(win, (nom, ctx) => visiter(`${etat} · ${nom}`, ctx), {});
    await p.toutesLesPages();
    await p.toutesLesFiches();
    await p.fermerTout();
    if (p.fautes.length) bac.push(...p.fautes.map(f => `${etat} — ${f}`));
  };

  j.etape('Une entreprise vierge, juste après l\'assistant : les états vides et leurs gestes');
  await traverserAssistant(win, null);
  await passe('vierge');
  j.ok(`${res.length} écrans`);

  j.etape('Le jeu d\'exemple, avec tous les modules : chaque liste pleine, chaque menu de ligne');
  await chargerExemple(win);
  await toutAfficher(win);
  const avant = res.length;
  await passe('exemple');
  j.ok(`${res.length - avant} écrans`);

  // La couverture se prouve aussi dans l'autre sens : chaque page lue dans le code a été ouverte.
  const pasVues = pagesDuCode().filter(r => !res.some(x => x.nom.includes(`page ${r}`)));
  await fermer(app);
  if (pasVues.length) throw new Error(`pages jamais atteintes : ${pasVues.join(', ')}`);

  fs.writeFileSync(path.join(OUT, 'manquants.json'), JSON.stringify(res.filter(r => r.manquants.length), null, 1));
  const tous = res.flatMap(r => r.manquants.map(m => ({ ...m, ecran: r.nom })));
  const cles = new Map();
  tous.forEach(m => {
    const k = m.id ? '#' + m.id : m.name ? `[name=${m.name}]` : Object.keys(m.data)[0] ? `[${Object.entries(m.data)[0].join('=')}]` : `${m.tag} « ${m.lib} »`;
    if (!cles.has(k)) cles.set(k, { n: 0, ex: m }); cles.get(k).n++;
  });
  if (bac.length) { console.error('\nErreurs pendant le parcours :\n  ' + [...new Set(bac)].join('\n  ')); process.exit(2); }
  if (lus < PLANCHER) { console.error(`\n${lus} contrôles lus seulement (plancher : ${PLANCHER}) — le parcours n'a pas atteint ses écrans.`); process.exit(2); }
  if (cles.size) {
    console.error(`\n${tous.length} contrôle(s) sans explication, ${cles.size} distinct(s) (liste complète : ${path.join(OUT, 'manquants.json')}) :\n  `
      + [...cles.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${v.n} × ${k} — « ${v.ex.lib} » — ${v.ex.ecran}`).join('\n  '));
    process.exit(1);
  }
  console.log(`\n${j.total()} étapes — ${res.length} écrans, ${lus} contrôles lus : chacun dit ce qu'il fait.`);
})().catch(e => { console.error(e); process.exit(1); });
