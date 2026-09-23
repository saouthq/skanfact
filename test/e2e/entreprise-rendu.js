// SkanFact (l'application entreprise) — LE RENDU, MESURÉ PARTOUT (10.12.0).
//
// Le jumeau de `cabinet-rendu.js`, qui manquait depuis la 9.4.3. Les sondes sont les mêmes, en un
// seul exemplaire dans `harnais.js` ; le PARCOURS vit dans `ecrans-entreprise.js`, partagé avec le
// photographe (`captures.js`) : ce qui est mesuré est ce qui est photographié, écran pour écran.
//
// Ce qu'il mesure, sur CHAQUE écran — les pages lues dans le code, tous leurs onglets et ceux que
// leurs onglets font apparaître, une fiche par objet, une pièce par type ET par statut, un achat par
// nature ET par statut, les pièces neuves, les trente-deux articles d'aide, la palette, et les
// fenêtres ouvertes par leur vrai bouton (« + … », menus de ligne, menus déroulants, édition) —,
// d'abord sur une entreprise VIERGE (juste après l'assistant : les états vides et leurs gestes),
// puis sur le jeu d'exemple avec TOUS les modules et l'option Comptabilité, en clair et en sombre,
// à 1440 et à 1280 :
//   1. aucun bouton ni champ illisible (contraste sous 2,0), aucun bouton hors de la fenêtre
//   2. aucun en-tête de colonne aligné autrement que ses valeurs
//   3. aucun contrôle d'en-tête ou de filtre étiré, aucune barre d'actions empilée
//   4. aucun bouton collé à ce qui le touche, dans la page et dans la fenêtre du dessus
//   5. aucune donnée sous une colonne collante
//   6. aucun texte coupé à côté d'une colonne qui garde du vide, aucune fenêtre qui défile de côté
//   7. aucun geste qui accepte le clic sans rien produire
//
//   xvfb-run -a node test/e2e/entreprise-rendu.js             → mesure + captures pleines
//   xvfb-run -a node test/e2e/entreprise-rendu.js --rapide    → une passe claire à 1440, sans captures
const { fermer, playwright, RACINE, ELECTRON, journal, dossierCaptures, capturePleine,
  SONDE_CONTRASTE, SONDE_COLONNES, SONDE_ENTETES, SONDE_ESPACEMENT, SONDE_COLLANT, SONDE_TRONQUE, SONDE_DEFILEMENT,
  FENETRE } = require('./harnais');
const { creerParcours, neutraliserSysteme, traverserAssistant, chargerExemple, toutAfficher, poserTheme, pagesDuCode, slug } = require('./ecrans-entreprise');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

const RAPIDE = process.argv.includes('--rapide');
const SEUIL = 2.0;
const LARGEUR_MAX = 300, LARGEUR_MAX_RECHERCHE = 400, HAUTEUR_MAX = 100, LARGEUR_MAX_RECHERCHE_FILTRE = 460;
const ECART_MIN = 4;                                         // voir cabinet-rendu.js
const SEGMENTS = ['.tabs', '.row-menu', '.pager'];
const VIDE_MAX = 40;
// Le plancher d'écrans par passe, sur le jeu d'exemple. Il dit ce que le parcours DOIT atteindre :
// s'il en voit moins, c'est qu'une page, un onglet ou une fiche a cessé d'être atteinte, et
// l'instrument déclarerait propre une application qu'il n'a pas regardée (T-55).
const PLANCHER_DEMO = 200;

(async () => {
  const j = journal(); const bac = []; const fautes = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ent-rendu-'));
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'ent')}`, RACINE],
    executablePath: ELECTRON, env: { ...process.env }
  });
  await neutraliserSysteme(app);
  const win = await app.firstWindow();
  // Une erreur se rattache à l'ÉCRAN où elle est tombée, et à sa pile : « Cannot read properties of
  // null » sans l'endroit ne se corrige pas.
  let ici = 'démarrage';
  win.on('pageerror', e => bac.push(`${ici} — PAGEERROR: ${e.message}\n      ${String(e.stack || '').split('\n').slice(1, 4).join('\n      ')}`));
  win.on('console', m => { if (m.type() === 'error') bac.push(`${ici} — CONSOLE: ${m.text()}`); });
  await win.setViewportSize({ width: 1440, height: 900 });
  const OUT = dossierCaptures('entreprise-rendu');
  const noms = new Map();                   // nom de fichier → écran, pour refuser deux écrans sous le même nom

  let boutons = 0, champs = 0, colonnes = 0, controles = 0, filtres = 0, ecarts = 0, collants = 0, tableaux = 0, fenetres = 0;

  const mesurer = async ou => {
    const { boutons: bs, champs: chs } = await win.evaluate(SONDE_CONTRASTE);
    boutons += bs.length; champs += chs.length;
    [...bs, ...chs].filter(b => b.ratio < SEUIL).forEach(b =>
      fautes.push(`${ou} → « ${b.texte} » (${b.id || b.cls}) : contraste ${b.ratio} — ${b.color} sur ${b.bg}`));
    // Un bouton dans un conteneur qui défile vraiment de côté est à une molette, pas hors de l'écran
    // (7.13.0, 9.4.4) : la sonde le dit, et on ne l'accuse pas.
    bs.filter(b => b.hors > 2 && !b.defilant).forEach(b =>
      fautes.push(`${ou} → « ${b.texte} » (${b.id || b.cls}) dépasse de ${b.hors} px hors de la fenêtre`));

    const c = await win.evaluate(SONDE_COLONNES);
    colonnes += c.colonnes;
    c.ecarts.forEach(e => fautes.push(`${ou} — colonne « ${e.colonne} » : en-tête ${e.entete}, valeurs ${e.cellules}`));

    const e = await win.evaluate(SONDE_ESPACEMENT, { min: ECART_MIN, exceptions: SEGMENTS });
    ecarts += e.mesures;
    e.colles.forEach(x => fautes.push(`${ou} — « ${x.bouton} » touche « ${x.voisin} » (${x.cote}, ${x.sens}) : ${x.ecart} px, minimum ${ECART_MIN}`));
    const fenetre = await win.$(FENETRE);
    if (fenetre) {
      fenetres++;
      const f = await win.evaluate(SONDE_ESPACEMENT, { min: ECART_MIN, exceptions: SEGMENTS, racine: FENETRE });
      ecarts += f.mesures;
      f.colles.forEach(x => fautes.push(`${ou} (fenêtre) — « ${x.bouton} » touche « ${x.voisin} » (${x.cote}, ${x.sens}) : ${x.ecart} px, minimum ${ECART_MIN}`));
      (await win.evaluate(SONDE_DEFILEMENT, { racine: FENETRE })).forEach(x => fautes.push(`${ou} (fenêtre) — `
        + `le contenu défile de côté : ${x.cache} px cachés à droite${x.contenu ? `, à partir de « ${x.contenu} »` : ''}`));
    }

    const k = await win.evaluate(SONDE_COLLANT);
    collants += k.tables;
    k.couverts.forEach(x => fautes.push(`${ou} — la colonne collante recouvre « ${x.cellule} » (${x.px} px, tableau ${x.table || 'sans classe'})`));

    const tq = await win.evaluate(SONDE_TRONQUE, { vide: VIDE_MAX, racines: fenetre ? ['#view', FENETRE] : ['#view'] });
    tableaux += tq.tables;
    tq.gaspillages.forEach(x => fautes.push(`${ou} — « ${x.coupee} » coupé à ${x.visible} px pendant que la colonne`
      + ` « ${x.colonne} » garde ${x.libre} px vides (maximum ${VIDE_MAX})`));

    const h = await win.evaluate(SONDE_ENTETES, { maxL: LARGEUR_MAX, maxR: LARGEUR_MAX_RECHERCHE, maxH: HAUTEUR_MAX });
    controles += h.n;
    h.larges.forEach(x => fautes.push(`${ou} — ${x.tag} « ${x.id} » fait ${x.w} px (borne ${x.borne}) : il est étiré, pas large`));
    if (h.n && h.hauteur > HAUTEUR_MAX) fautes.push(`${ou} — la barre d'actions fait ${h.hauteur} px de haut : ses contrôles s'empilent`);
    const fl = await win.evaluate(SONDE_ENTETES, { maxL: LARGEUR_MAX, maxR: LARGEUR_MAX_RECHERCHE_FILTRE, maxH: 9999,
      barres: '#view .filters', recherche: '#q, .q, [type=search]' });
    controles += fl.n; filtres += fl.n;
    fl.larges.forEach(x => fautes.push(`${ou} — filtre ${x.tag} « ${x.id} » fait ${x.w} px (borne ${x.borne}) : il prend toute la ligne`));
  };

  // `visiter` : mesurer, et photographier en entier si la passe le demande.
  const visiteur = (etiquette, dossier) => async (nom, ctx) => {
    ici = `${etiquette} ${nom} (${(ctx && ctx.hash) || ''})`;
    await mesurer(`${etiquette} ${nom}`);
    if (!dossier || RAPIDE) return;
    const fichier = (ctx && ctx.cle) || slug(nom);
    const cle = dossier + '/' + fichier;
    if (noms.has(cle) && noms.get(cle) !== nom) {
      throw new Error(`deux écrans sous le même nom de capture « ${fichier} » : « ${noms.get(cle)} » et « ${nom} » — l'un écraserait l'autre`);
    }
    noms.set(cle, nom);
    const d = path.join(OUT, dossier); fs.mkdirSync(d, { recursive: true });
    await capturePleine(win, path.join(d, fichier + '.png'));
  };

  const passe = async (etiquette, dossier, { vierge = false } = {}) => {
    const p = creerParcours(win, visiteur(etiquette, dossier), { surGeste: g => { ici = `${etiquette} ${g}`; } });
    const nPages = await p.toutesLesPages();
    const nFiches = await p.toutesLesFiches();
    const nAide = vierge ? 0 : await p.articlesAide();
    if (!vierge) await p.palette();
    await p.fermerTout();
    p.fautes.forEach(f => fautes.push(`${etiquette} ${f}`));
    return { ecrans: p.ecrans, nPages, nFiches, nAide };
  };

  // ------------------------------------------------------------------ vierge
  j.etape('Une entreprise VIERGE, juste après l\'assistant');
  await traverserAssistant(win, RAPIDE ? null : visiteur('vierge 1440', 'vierge-1440'));
  const v = await passe('vierge 1440', 'vierge-1440', { vierge: true });
  j.ok(`${v.ecrans} écrans — ${v.nPages} pages lues dans le code, ${v.nFiches} pièces neuves`);

  // ------------------------------------------------------------------ l'exemple, tout affiché
  j.etape('Le jeu d\'exemple, tous les modules et l\'option Comptabilité');
  await chargerExemple(win);
  await toutAfficher(win);
  const cachees = await win.evaluate(() => [...document.querySelectorAll('#view input[data-mod]:not(:checked)')].length);
  if (cachees) throw new Error(`${cachees} module(s) restent hors du menu : leurs écrans seraient mesurés sous un bandeau que personne ne voit`);
  j.ok('chargé, tout affiché');

  j.etape('Tout, en clair, à 1440');
  const a = await passe('clair 1440', 'demo-1440');
  if (a.ecrans < PLANCHER_DEMO) throw new Error(`seulement ${a.ecrans} écrans atteints sur le jeu d'exemple (plancher ${PLANCHER_DEMO}) : une page, un onglet ou une fiche a cessé d'être atteint`);
  j.ok(`${a.ecrans} écrans — ${a.nPages} pages, ${a.nFiches} fiches et pièces, ${a.nAide} articles d'aide`);

  if (!RAPIDE) {
    j.etape('Tout, en SOMBRE, à 1440 — par le vrai réglage');
    await poserTheme(win, 'dark');
    const b = await passe('sombre 1440', 'sombre-1440');
    j.ok(`${b.ecrans} écrans`);

    j.etape('Tout, en sombre, sur un portable de 1280 px');
    await win.setViewportSize({ width: 1280, height: 800 });
    await win.waitForTimeout(300);
    const c = await passe('sombre 1280', null);
    j.ok(`${c.ecrans} écrans`);

    j.etape('Tout, en clair, à 1280');
    await poserTheme(win, 'light');
    const d = await passe('clair 1280', null);
    j.ok(`${d.ecrans} écrans`);
  }

  // La couverture se prouve aussi dans l'autre sens : chaque page lue dans le code a été ouverte.
  const pages = pagesDuCode();
  const pasVues = pages.filter(r => ![...noms.values()].some(n => n.includes(`page ${r}`)) && !RAPIDE);
  if (pasVues.length) throw new Error(`pages jamais photographiées : ${pasVues.join(', ')}`);

  await fermer(app);

  // Les deux listes se disent TOUJOURS : une erreur JavaScript ne doit pas cacher les défauts de
  // rendu mesurés sur les trois cents autres écrans, et inversement.
  const u = [...new Set(fautes)];
  if (u.length) {
    fs.writeFileSync(path.join(OUT, 'fautes.txt'), u.join('\n') + '\n');
    console.error(`\n${u.length} défaut(s) de rendu dans l'application entreprise (liste complète : ${path.join(OUT, 'fautes.txt')}) :\n  `
      + u.slice(0, 200).join('\n  '));
  }
  if (bac.length) { console.error('\nErreurs du renderer :\n' + [...new Set(bac)].join('\n')); process.exit(2); }
  if (!boutons || !champs || !colonnes || !ecarts || !tableaux || !fenetres || !filtres) {
    console.error('\nRien n\'a été mesuré d\'une des familles : le parcours ne prouve rien.'); process.exit(2);
  }
  if (u.length) process.exit(1);
  console.log(`\n${j.total()} étapes — ${boutons} boutons, ${champs} champs, ${colonnes} colonnes, ${controles} contrôles`
    + ` (dont ${filtres} de filtres), ${ecarts} écarts, ${collants} tableaux sous colonne collante, ${tableaux} tableaux`
    + ` jugés pour le texte coupé, ${fenetres} fenêtres ouvertes : rien d'illisible, rien de désaligné, rien d'étiré,`
    + ' rien de collé, rien de recouvert, rien de coupé à côté du vide, aucun geste inerte.');
})().catch(e => { console.error(e); process.exit(1); });
