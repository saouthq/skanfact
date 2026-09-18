// SkanFact Cabinet — LE RENDU, MESURÉ (9.4.3).
//
// Pourquoi ce parcours existe, et pourquoi il aurait dû exister depuis la 6.8.0 : l'application
// entreprise est tenue par quatre instruments qui mesurent ce qui s'AFFICHE — `e2e:contraste`
// (475 boutons), `e2e:colonnes` (392 colonnes), `e2e:entetes` (21 pages), `e2e:barre`. Aucun des
// quatre ne regardait l'app Cabinet. Pas un. Elle a donc hérité des fonctionnalités de sa jumelle
// et d'aucun de ses garde-fous visuels, et elle a dérivé exactement là où personne ne mesurait :
// six onglets qui ne montraient pas lequel était ouvert pendant trois versions, huit champs sans
// la moindre étiquette, et pas la moindre règle de thème sombre — l'application n'en avait aucun.
//
// Les sondes sont celles de l'app entreprise, en un seul exemplaire dans `harnais.js` : un
// mécanisme recopié diverge toujours (7.29.0), et c'est précisément la faute que ce parcours
// répare.
//
// Ce qu'il mesure, sur CHAQUE écran du Cabinet, sous-onglets compris, en clair ET en sombre,
// à 1440 et à 1280 :
//   1. aucun bouton illisible (contraste texte/fond sous 2,0) ni coupé par le bord de la fenêtre
//   2. aucun en-tête de colonne aligné autrement que ses valeurs
//   3. aucun contrôle d'en-tête étiré, aucune barre d'actions empilée sur trois rangées
//
//   xvfb-run -a node test/e2e/cabinet-rendu.js
const { playwright, RACINE, ELECTRON, journal, surveiller, dossierCaptures, capturePleine,
  SONDE_BOUTONS, SONDE_COLONNES, SONDE_ENTETES, SONDE_ESPACEMENT } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

const SEUIL = 2.0;                       // le seuil de contraste : il n'est pas esthétique, il attrape l'illisible
const LARGEUR_MAX = 300, LARGEUR_MAX_RECHERCHE = 400, HAUTEUR_MAX = 100;

// L'écart minimum entre un bouton et ce qui le touche. QUATRE pixels, et ce n'est pas un goût :
// c'est la ligne que le code trace déjà tout seul. Au-dessus, l'espace vient d'un `gap` DÉCIDÉ en
// CSS — `td.row-actions > span { gap: 4px }`, `.pv-cmd { gap: 4px }`, `.inline { gap: 8px }`. En
// dessous, il ne vient de nulle part : 3,6 px et 3,9 px sont la largeur d'une espace laissée entre
// deux balises du gabarit, et 0 px est l'absence pure. Un premier jet à 6 px accusait des
// espacements que le projet avait explicitement choisis — un test trop large accuse du code juste,
// ce qui est aussi grave qu'un test trop étroit (9.1.0, 9.4.7).
// Les trois conteneurs où des boutons se touchent par construction, nommés parce qu'une exception
// anonyme est un trou : les onglets, le menu d'une ligne, la pagination.
const ECART_MIN = 4;
const SEGMENTS = ['.tabs', '.row-menu', '.pager'];

// Les pages du Cabinet. Une page qui en gagnera une demain sera mesurée sans que personne y pense,
// à condition de l'ajouter ici — et le parcours REFUSE une page qui ne s'ouvre pas, plutôt que de
// l'ignorer en annonçant quand même son total (le défaut de `#stk-tabs` en 7.23.0).
const PAGES = ['#/dossiers', '#/relances', '#/echeances', '#/ecritures', '#/reglages', '#/aide'];

(async () => {
  const j = journal(); const bac = []; const fautes = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-rendu-'));
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'cab')}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const attendre = (ms = 280) => win.waitForTimeout(ms);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await attendre(350); };

  let boutons = 0, colonnes = 0, controles = 0, ecarts = 0;

  // Les trois sondes sur l'écran courant. `ou` nomme l'endroit ET le contexte (largeur, thème) :
  // une faute qui n'existe qu'en sombre à 1280 doit se lire comme telle, sinon on la cherche à
  // l'endroit où elle ne se produit pas.
  const mesurer = async ou => {
    const bs = await win.evaluate(SONDE_BOUTONS);
    boutons += bs.length;
    bs.filter(b => b.ratio < SEUIL).forEach(b =>
      fautes.push(`${ou} → « ${b.texte} » (${b.id || b.cls}) : contraste ${b.ratio} — ${b.color} sur ${b.bg}`));
    bs.filter(b => b.hors > 2).forEach(b =>
      fautes.push(`${ou} → « ${b.texte} » (${b.id || b.cls}) dépasse de ${b.hors} px hors de la fenêtre`));

    const c = await win.evaluate(SONDE_COLONNES);
    colonnes += c.colonnes;
    c.ecarts.forEach(e => fautes.push(`${ou} — colonne « ${e.colonne} » : en-tête ${e.entete}, valeurs ${e.cellules}`));

    const e = await win.evaluate(SONDE_ESPACEMENT, { min: ECART_MIN, exceptions: SEGMENTS });
    ecarts += e.mesures;
    e.colles.forEach(x => fautes.push(`${ou} — « ${x.bouton} » touche « ${x.voisin} » (${x.cote},`
      + ` ${x.sens}) : ${x.ecart} px, minimum ${ECART_MIN}`));

    const h = await win.evaluate(SONDE_ENTETES, { maxL: LARGEUR_MAX, maxR: LARGEUR_MAX_RECHERCHE, maxH: HAUTEUR_MAX });
    controles += h.n;
    h.larges.forEach(x => fautes.push(`${ou} — ${x.tag} « ${x.id} » fait ${x.w} px (borne ${x.borne}) : il est étiré, pas large`));
    if (h.n && h.hauteur > HAUTEUR_MAX) {
      fautes.push(`${ou} — la barre d'actions fait ${h.hauteur} px de haut : ses contrôles s'empilent`);
    }
  };

  // Un onglet peut en cacher d'autres, et c'est exactement ce qui a caché les défauts jusqu'ici :
  // on ouvre CHAQUE onglet de CHAQUE barre présente sur la page.
  const barres = () => win.evaluate(() => [...document.querySelectorAll('#view .tabs[id]')]
    .filter(t => t.getBoundingClientRect().height > 0)
    .map(t => ({ sel: '#' + t.id, tabs: [...t.querySelectorAll('button[data-tab]')].map(b => b.dataset.tab) })));

  const parcourir = async etiquette => {
    for (const hash of PAGES) {
      await aller(hash);
      if (!await win.$('#view')) throw new Error(`${hash} ne s'ouvre pas : le parcours sauterait cette page en silence`);
      await mesurer(`${etiquette} ${hash}`);
      for (const b of await barres()) {
        for (const t of b.tabs) {
          const bouton = await win.$(`${b.sel} button[data-tab="${t}"]`);
          if (!bouton) throw new Error(`${hash} : l'onglet « ${t} » de ${b.sel} a disparu entre sa lecture et son clic`);
          await bouton.click();
          await attendre(320);
          await mesurer(`${etiquette} ${hash} · ${t}`);
        }
      }
    }
    // La fiche d'un dossier : trois onglets, dont la Comptabilité qui porte SA propre barre. C'est
    // la page la plus longue et la plus dense de l'application, et elle n'est atteignable que par
    // un clic sur une ligne — une adresse écrite à la main manquerait le geste réel.
    await aller('#/dossiers');
    const ligne = await win.$('#view table.list tbody tr[data-id]');
    if (!ligne) throw new Error('aucun dossier dans la liste : la fiche ne serait jamais mesurée');
    await ligne.click();
    await attendre(600);
    for (const onglet of ['suivi', 'comptabilite', 'paquets']) {
      const b = await win.$(`#d-tabs button[data-tab="${onglet}"]`);
      if (!b) throw new Error(`la fiche d'un dossier n'a pas d'onglet « ${onglet} »`);
      await b.click();
      await attendre(450);
      await mesurer(`${etiquette} fiche · ${onglet}`);
      if (onglet !== 'comptabilite') continue;
      for (const b2 of await barres()) {
        if (b2.sel !== '#c-tabs') continue;
        for (const t of b2.tabs) {
          await win.click(`#c-tabs button[data-tab="${t}"]`);
          await attendre(450);
          await mesurer(`${etiquette} fiche · compta · ${t}`);
        }
      }
    }
  };

  // ------------------------------------------------------------------ ouvrir, et remplir
  j.etape('Ouvrir un cabinet neuf et charger l\'exemple');
  await win.setViewportSize({ width: 1440, height: 900 });
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', 'rendu-2026');
  await win.fill('#lock-pw2', 'rendu-2026');
  await win.click('#lock-go');
  await win.waitForSelector('#app', { state: 'visible', timeout: 15000 });
  await attendre(700);
  for (let g = 0; g < 12 && await win.$('#setup'); g++) {
    const nom = await win.$('#setup input[name=name], #w-name');
    if (nom) await nom.fill('Cabinet Rendu');
    const suivant = await win.$('#setup .wiz-actions .btn-primary');
    if (!suivant) break;
    await suivant.click();
    await attendre(320);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'), null, { timeout: 8000 }).catch(() => {});
  // L'exemple, pour que les tableaux aient des lignes : une colonne sans valeur n'a pas
  // d'alignement à comparer, et un parcours sur des pages vides ne prouve rien.
  await aller('#/reglages');
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="app"]');
  await attendre(320);
  const charger = await win.$('#r-demo-on');
  if (charger) { await charger.click(); await attendre(1400); }
  await aller('#/dossiers');
  await win.waitForSelector('#view table.list tbody tr[data-id]', { timeout: 8000 });
  j.ok('cabinet ouvert, exemple chargé');

  // ------------------------------------------------------------------ les quatre passes
  j.etape('Toutes les pages et tous leurs onglets, en clair, à 1440');
  await parcourir('clair 1440');
  j.ok(`${boutons} boutons, ${colonnes} colonnes, ${controles} contrôles`);

  j.etape('Les mêmes, en thème SOMBRE');
  // Le thème se pose par le vrai réglage, pas par une classe injectée : c'est le chemin qu'un
  // comptable emprunte, et c'est lui qui doit marcher. Un test qui ajoute `dark` à la main
  // prouverait la feuille de style et pas l'application.
  await aller('#/reglages');
  await win.click('#set-tabs button[data-tab="app"]');
  await attendre(320);
  // On clique la CARTE, pas la case : la case est masquée (c'est la carte qui la porte), et c'est
  // la carte qu'un comptable clique. Un test qui viserait l'input prouverait un élément que
  // personne ne voit.
  await win.click('.theme-op:has(input[value="dark"])');
  await attendre(500);
  const sombre = await win.evaluate(() => document.body.classList.contains('dark'));
  if (!sombre) throw new Error('le réglage « Sombre » ne pose pas le thème : rien ne serait mesuré en sombre');
  j.ok('le réglage pose vraiment le thème');
  // Trois captures du sombre, en entier : un contraste au-dessus du seuil dit qu'on peut LIRE,
  // il ne dit pas que c'est regardable. Ces images-là se relisent à l'œil.
  const OUT = dossierCaptures('cabinet-rendu');
  for (const [hash, nom] of [['#/dossiers', 'sombre-dossiers'], ['#/echeances', 'sombre-echeances'],
    ['#/reglages', 'sombre-reglages']]) {
    await aller(hash);
    await capturePleine(win, path.join(OUT, nom + '.png'));
  }
  const avant = boutons;
  await parcourir('sombre 1440');
  if (boutons === avant) throw new Error('aucun bouton mesuré en sombre : le parcours ne prouve rien');
  j.ok(`${boutons - avant} boutons mesurés en sombre`);

  j.etape('Les mêmes, sur un portable de 1280 px');
  await win.setViewportSize({ width: 1280, height: 800 });
  await attendre(400);
  await parcourir('sombre 1280');
  await aller('#/reglages');
  await win.click('#set-tabs button[data-tab="app"]');
  await attendre(320);
  await win.click('.theme-op:has(input[value="light"])');
  await attendre(400);
  await parcourir('clair 1280');
  j.ok('mesuré aux deux largeurs');

  await app.close();

  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  // Un instrument qui ne mesure rien annonce « tout va bien » : il doit échouer, pas se taire.
  if (!boutons || !colonnes || !ecarts) { console.error('\nRien n\'a été mesuré : le parcours ne prouve rien.'); process.exit(2); }
  if (fautes.length) {
    const u = [...new Set(fautes)];
    console.error(`\n${u.length} défaut(s) de rendu dans l'app Cabinet :\n  ` + u.join('\n  '));
    process.exit(1);
  }
  console.log(`\n${j.total()} étapes — ${boutons} boutons, ${colonnes} colonnes, ${controles} contrôles,`
    + ` ${ecarts} écarts mesurés en clair et en sombre, à 1440 et à 1280 : rien d'illisible, rien de`
    + ' désaligné, rien d\'étiré, rien de collé.');
})().catch(e => { console.error(e); process.exit(1); });
