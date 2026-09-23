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
  SONDE_CONTRASTE, SONDE_COLONNES, SONDE_ENTETES, SONDE_ESPACEMENT, SONDE_COLLANT, ongletCompta, ongletsCompta } = require('./harnais');
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
// `.c-groupes` (10.12.0, U-06) : le contrôle segmenté des trois groupes de la comptabilité — ses
// boutons se touchent PAR CONSTRUCTION, comme les onglets d'une barre.
const SEGMENTS = ['.tabs', '.row-menu', '.pager', '.c-groupes'];

// Les pages du Cabinet. Une page qui en gagnera une demain sera mesurée sans que personne y pense,
// à condition de l'ajouter ici — et le parcours REFUSE une page qui ne s'ouvre pas, plutôt que de
// l'ignorer en annonçant quand même son total (le défaut de `#stk-tabs` en 7.23.0).
const PAGES = ['#/dossiers', '#/relances', '#/echeances', '#/ecritures', '#/production', '#/reglages', '#/aide'];

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

  let boutons = 0, champs = 0, colonnes = 0, controles = 0, ecarts = 0, collants = 0;

  // Les trois sondes sur l'écran courant. `ou` nomme l'endroit ET le contexte (largeur, thème) :
  // une faute qui n'existe qu'en sombre à 1280 doit se lire comme telle, sinon on la cherche à
  // l'endroit où elle ne se produit pas.
  const mesurer = async ou => {
    const { boutons: bs, champs: chs } = await win.evaluate(SONDE_CONTRASTE);
    boutons += bs.length; champs += chs.length;
    [...bs, ...chs].filter(b => b.ratio < SEUIL).forEach(b =>
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

    // U-02 : aucune donnée sous une colonne collante.
    const k = await win.evaluate(SONDE_COLLANT);
    collants += k.tables;
    k.couverts.forEach(x => fautes.push(`${ou} — la colonne collante recouvre « ${x.cellule} » (${x.px} px, tableau ${x.table || 'sans classe'})`));

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
      // Neuf onglets sur treize — Saisie, Déclaration, Banque, Immobilisations, Inventaire, Paie,
      // Révision, Exercice, Liasse et Recherche — n'existent QUE si le dossier a un livre, et un
      // dossier neuf n'en a pas. Sans ce geste, l'instrument mesurait quatre écrans et déclarait
      // le Cabinet propre :
      // c'est pour ça que « + Ajouter une ligne » collé au titre (T-49) a été trouvé sur une
      // capture et pas ici, et c'est la leçon de la 9.4.3 (un parcours qui n'ouvre que l'onglet par
      // défaut juge un sixième de la page), une couche plus bas.
      if (await win.$('#lv-relire')) {
        await win.click('#lv-relire');
        await win.waitForSelector('.modal-bg', { timeout: 30000 });
        await win.click('.modal-bg .btn-primary');
        await attendre(700);
      }
      // Le sélecteur de groupes n'existe qu'avec un livre (10.12.0, U-06).
      await win.waitForSelector('#c-groupes', { timeout: 25000 });
      // QUATORZE écrans, rangés en trois groupes depuis la 10.12.0 : la barre visible ne montre
      // que ceux du groupe ouvert, donc on les lit groupe par groupe. Le seuil dit ce que le livre
      // DOIT ouvrir — s'il n'est pas créé, quatre écrans seulement existent, et l'instrument
      // déclarerait le Cabinet propre sans avoir vu l'écran où un comptable passe ses journées
      // (T-55) ; s'il ne lisait que le groupe ouvert, il en verrait cinq (la même faute, un cran
      // plus bas).
      const ecrans = await ongletsCompta(win);
      if (ecrans.length < 14) throw new Error(`la comptabilité n'offre que ${ecrans.length} écrans : le livre n'a pas été créé, ou un groupe n'a pas été ouvert`);
      for (const o of ecrans) {
        await ongletCompta(win, o.tab);
        await attendre(450);
        await mesurer(`${etiquette} fiche · compta · ${o.tab}`);
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
  j.ok(`${boutons} boutons, ${champs} champs, ${colonnes} colonnes, ${controles} contrôles`);

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
  if (!boutons || !champs || !colonnes || !ecarts || !collants) { console.error('\nRien n\'a été mesuré : le parcours ne prouve rien.'); process.exit(2); }
  if (fautes.length) {
    const u = [...new Set(fautes)];
    console.error(`\n${u.length} défaut(s) de rendu dans l'app Cabinet :\n  ` + u.join('\n  '));
    process.exit(1);
  }
  console.log(`\n${j.total()} étapes — ${boutons} boutons, ${champs} champs, ${colonnes} colonnes, ${controles} contrôles,`
    + ` ${ecarts} écarts, ${collants} tableaux sous colonne collante, mesurés en clair et en sombre, à 1440 et à 1280 :`
    + ' rien d\'illisible, rien de désaligné, rien d\'étiré, rien de collé, rien de recouvert.');
})().catch(e => { console.error(e); process.exit(1); });
