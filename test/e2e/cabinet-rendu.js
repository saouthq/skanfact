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
//   4. aucun bouton collé à ce qui le touche (9.8.3), dans la page et dans la fenêtre du dessus
//   5. aucune donnée sous une colonne collante (10.12.0, U-02)
//   6. aucun texte coupé à côté d'une colonne qui garde du vide, et aucune fenêtre qui défile de
//      côté (10.12.0, vus au test humain de la Banque) — sur le premier dossier ET sur les deux
//      vitrines de l'exemple, les seuls dont les écrans de comptabilité sont pleins
//
//   xvfb-run -a node test/e2e/cabinet-rendu.js
//
// Avec `--couverture` (10.14.0, `npm run e2e:cabinet-couverture`) : le MÊME parcours, une passe, et à
// chaque écran — la page, la fenêtre du dessus, le menu d'une ligne de chaque sorte — l'explication
// que la visite guidée lira pour chaque contrôle visible (`CabVisites.expliquer`). Un contrôle sans
// explication disparaîtrait de la bulle SANS UN MOT ; il fait tomber le parcours. Le parcours n'est
// pas recopié : un second parcours des mêmes écrans aurait dérivé du premier (7.29.0).
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller, dossierCaptures, capturePleine,
  SONDE_CONTRASTE, SONDE_COLONNES, SONDE_ENTETES, SONDE_ESPACEMENT, SONDE_COLLANT, SONDE_TRONQUE, SONDE_DEFILEMENT, SONDE_RANGEE, SONDE_BULLE,
  FENETRE, ongletCompta, ongletsCompta } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
// Les deux VITRINES de l'exemple (10.12.0, U-10) : le client sur SkanFact dont le cabinet rapproche la
// banque et révise l'exercice, le client hors SkanFact dont il tient les biens et la paie. Ce sont
// les seuls dossiers dont les écrans de comptabilité sont PLEINS — relevé, suspens, biens, salariés,
// révision entamée. Le parcours ne mesurait que le premier dossier de la liste, dont le livre naît
// vide de tout cela : les deux tableaux de suspens, qui coupaient leurs libellés à huit lettres, ont
// été trouvés à l'œil et jamais ici (T-55, un écran plus loin). Les identifiants se DÉDUISENT du
// scénario, jamais écrits à la main : une vitrine renommée demain ne sortirait pas de la mesure.
const VITRINES = require(path.join(RACINE, 'src', 'cabinet', 'cabcore.js')).demoDossiers()
  .filter(d => d.vitrine).map(d => ({ id: d.id, vitrine: d.vitrine }));
// Le vide qu'une colonne peut garder pendant qu'une voisine coupe son texte. Quarante pixels : sous
// ce seuil, c'est la marge d'une cellule ; au-dessus, c'est un mot de plus qu'on aurait pu lire.
const VIDE_MAX = 40;

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
// 10.14.0 : « Me guider » est une page du menu comme les autres.
const PAGES = ['#/dossiers', '#/relances', '#/echeances', '#/ecritures', '#/production', '#/reglages', '#/guide', '#/aide'];
const COUVERTURE = process.argv.includes('--couverture');
// Le plancher de contrôles lus en mode couverture : un instrument qui n'atteint pas ses écrans
// annonce « tout va bien » (T-55).
const PLANCHER_COUVERTURE = 1500;
// Les boutons qui ouvrent une FENÊTRE sans rien écrire ni ouvrir de sélecteur du système : aucune
// adresse ne mène à une fenêtre (10.6.0), le parcours la fait naître par son vrai bouton.
const OUVRE_FENETRE = ['#new-d', '#edit', '#note-rel', '#eq-add', '#ab-new', '#pa-salarie', '#pa-salarie2', '#pa-bulletin',
  '#pa-bulletin2', '#im-neuf', '#im-neuf2', '#iv-saisir', '#iv-saisir2', '#s-pw', '#rv-question'];
// La sonde des explications : le moteur désigne ce qui est un contrôle (`Visite.CONTROLES`, la liste que
// l'étape « liste » parcourt) ; le dictionnaire du Cabinet dit ce qu'il fait. Une bulle « i » n'est pas
// un geste : elle EST l'explication de son champ.
const SONDE_EXPLIQUE = () => {
  const V = window.Visite, CV = window.CabVisites;
  if (!V || !CV) return { erreur: 'le moteur de visite n\'est pas chargé dans le Cabinet' };
  const fen = document.querySelector('#modal-root > .modal-bg:last-child');
  const racines = [fen || document.querySelector('#view')];
  const menu = document.querySelector('.row-menu'); if (menu) racines.push(menu);
  const manquants = []; let lus = 0;
  racines.forEach(rac => {
    if (!rac) return;
    rac.querySelectorAll(V.CONTROLES).forEach(el => {
      if (el.matches('button.i') || !V.visible(el)) return;
      lus++;
      let x = null; try { x = CV.expliquer(el, { G: window.CabGuide }); } catch (_) { x = null; }
      if (x && x.texte) return;
      const data = {}; [...el.attributes].forEach(a => { if (a.name.startsWith('data-')) data[a.name] = a.value.slice(0, 30); });
      manquants.push({ tag: el.tagName.toLowerCase(), id: el.id || '', name: el.getAttribute('name') || '', cls: String(el.className || '').slice(0, 40), data,
        lib: CV.libelleDe(el).slice(0, 60), fenetre: !!el.closest('#modal-root'), menu: !!el.closest('.row-menu') });
    });
  });
  return { route: location.hash, lus, manquants };
};

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

  let lusCouverture = 0; const couverture = [];
  // Mode couverture : la sonde des explications sur l'écran, puis sur un menu de ligne de chaque sorte.
  const expliquer = async ou => {
    const r = await win.evaluate(SONDE_EXPLIQUE);
    if (r.erreur) throw new Error(`${ou} : ${r.erreur}`);
    lusCouverture += r.lus;
    r.manquants.forEach(m => couverture.push({ ...m, ecran: ou }));
    if (await win.$(FENETRE)) return;
    const sortes = await win.evaluate(() => {
      const vus = new Set(), sel = [];
      document.querySelectorAll('#view [data-rowmenu]').forEach(b => {
        const r = b.getBoundingClientRect();
        const s = b.dataset.rowmenu.split(':')[0];
        if (r.width && r.height && !vus.has(s)) { vus.add(s); sel.push(b.dataset.rowmenu); }
      });
      return sel;
    });
    for (const rm of sortes) {
      const b = await win.$(`#view [data-rowmenu="${rm}"]`);
      if (!b) continue;
      await b.scrollIntoViewIfNeeded().catch(() => {});
      await b.click().catch(() => {});
      await attendre(220);
      // Une action UNIQUE est un bouton nommé qui agit tout de suite (7.29.0) : s'il a ouvert une
      // fenêtre, on la mesure et on la referme ; sinon le menu.
      if (await win.$(FENETRE)) { await mesurerFenetre(`${ou} · ${rm.split(':')[0]}`); continue; }
      if (await win.$('.row-menu')) {
        const m = await win.evaluate(SONDE_EXPLIQUE);
        lusCouverture += m.lus;
        m.manquants.forEach(x => couverture.push({ ...x, ecran: `${ou} · menu ${rm.split(':')[0]}` }));
        await win.keyboard.press('Escape');
        await attendre(150);
      }
    }
  };
  const mesurerFenetre = async ou => {
    const m = await win.evaluate(SONDE_EXPLIQUE);
    lusCouverture += m.lus;
    m.manquants.forEach(x => couverture.push({ ...x, ecran: ou + ' (fenêtre)' }));
    await win.keyboard.press('Escape');
    await attendre(200);
    // Le garde-fou de saisie peut demander — on ne jette rien de ce qu'on a tapé : on n'a rien tapé.
    const q = await win.$('#modal-root .modal #ok');
    if (q && await win.$(FENETRE)) { await win.keyboard.press('Escape'); await attendre(200); }
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal'), null, { timeout: 4000 })
      .catch(() => { throw new Error(`${ou} : la fenêtre ne se referme pas à Échap`); });
  };
  const fenetresDeLaPage = async ou => {
    for (const sel of OUVRE_FENETRE) {
      const b = await win.$(`#view ${sel}`);
      if (!b || !await b.isVisible() || await b.isDisabled()) continue;
      await b.click().catch(() => {});
      await attendre(300);
      if (await win.$(FENETRE)) await mesurerFenetre(`${ou} · fenêtre ${sel}`);
    }
  };

  let boutons = 0, champs = 0, liensMesures = 0, colonnes = 0, controles = 0, ecarts = 0, collants = 0, tableaux = 0, fenetres = 0, rangees = 0, bulles = 0;

  // Les trois sondes sur l'écran courant. `ou` nomme l'endroit ET le contexte (largeur, thème) :
  // une faute qui n'existe qu'en sombre à 1280 doit se lire comme telle, sinon on la cherche à
  // l'endroit où elle ne se produit pas.
  const mesurer = async ou => {
    if (COUVERTURE) {
      await expliquer(ou);
      if (!await win.$(FENETRE)) await fenetresDeLaPage(ou);
      return;
    }
    const { boutons: bs, champs: chs, liens: lks } = await win.evaluate(SONDE_CONTRASTE);
    boutons += bs.length; champs += chs.length;
    // 10.12.0 — les liens : lisibles, et stylés par l'application (jamais le bleu brut du navigateur).
    liensMesures += lks.length;
    lks.filter(l => l.ratio < SEUIL || l.brut).forEach(l => fautes.push(`${ou} → lien « ${l.texte} » : `
      + (l.brut ? `couleur brute du navigateur (${l.color}), stylé par personne` : `contraste ${l.ratio} — ${l.color} sur ${l.bg}`)));
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
    // Une fenêtre ouverte vit hors de `#view` (voir `FENETRE` dans le harnais) : on la mesure à part.
    if (await win.$(FENETRE)) {
      const f = await win.evaluate(SONDE_ESPACEMENT, { min: ECART_MIN, exceptions: SEGMENTS, racine: FENETRE });
      ecarts += f.mesures;
      f.colles.forEach(x => fautes.push(`${ou} (fenêtre) — « ${x.bouton} » touche « ${x.voisin} » (${x.cote},`
        + ` ${x.sens}) : ${x.ecart} px, minimum ${ECART_MIN}`));
    }

    // U-02 : aucune donnée sous une colonne collante.
    // 10.12.0 — les chiffres d'une rangée de cartes à la même hauteur.
    const rg = await win.evaluate(SONDE_RANGEE, { ecart: 1.5 });
    rangees += rg.rangees;
    // 10.12.0 — une bulle « i » ne passe jamais seule à la ligne : elle suit le mot qu'elle explique.
    const bl = await win.evaluate(SONDE_BULLE, { racines: ['#view', FENETRE] });
    bulles += bl.bulles;
    bl.orphelines.forEach(x => fautes.push(`${ou} — la bulle « i » (${x.cle}) passe seule à la ligne après « ${x.texte} »`));
    rg.escaliers.forEach(x => fautes.push(`${ou} — le chiffre de « ${x.bas} » est ${x.px} px plus bas que celui de « ${x.haut} », sur la même rangée`));

    const k = await win.evaluate(SONDE_COLLANT);
    collants += k.tables;
    k.couverts.forEach(x => fautes.push(`${ou} — la colonne collante recouvre « ${x.cellule} » (${x.px} px, tableau ${x.table || 'sans classe'})`));

    // 10.12.0 — aucun texte coupé à côté d'une colonne qui garde du vide, dans la page ET dans la
    // fenêtre du dessus ; et une fenêtre ne défile jamais de côté.
    const fenetre = await win.$(FENETRE);
    const tq = await win.evaluate(SONDE_TRONQUE, { vide: VIDE_MAX, racines: fenetre ? ['#view', FENETRE] : ['#view'] });
    tableaux += tq.tables;
    tq.gaspillages.forEach(x => fautes.push(`${ou} — « ${x.coupee} » coupé à ${x.visible} px pendant que la colonne`
      + ` « ${x.colonne} » garde ${x.libre} px vides (maximum ${VIDE_MAX})`));
    if (fenetre) {
      fenetres++;
      (await win.evaluate(SONDE_DEFILEMENT, { racine: FENETRE })).forEach(x => fautes.push(`${ou} (fenêtre) — `
        + `le contenu défile de côté : ${x.cache} px cachés à droite${x.contenu ? `, à partir de « ${x.contenu} »` : ''}`));
    }

    const h = await win.evaluate(SONDE_ENTETES, { maxL: LARGEUR_MAX, maxR: LARGEUR_MAX_RECHERCHE, maxH: HAUTEUR_MAX });
    controles += h.n;
    h.larges.forEach(x => fautes.push(`${ou} — ${x.tag} « ${x.id} » fait ${x.w} px (borne ${x.borne}) : il est étiré, pas large`));
    if (h.n && h.hauteur > HAUTEUR_MAX) {
      fautes.push(`${ou} — la barre d'actions fait ${h.hauteur} px de haut : ses contrôles s'empilent`);
    }
  };

  // Les deux fenêtres d'une ligne de relevé : « Choisir l'écriture en face » (une ligne sans
  // réponse) et « Voir l'écriture en face » (une ligne rapprochée). Aucune adresse n'y mène, un
  // geste seulement — la leçon de la 10.6.0. La banque d'un dossier sans relevé n'en a pas ; celle
  // de la vitrine DOIT en avoir, sinon la vitrine a cessé de montrer ce qu'elle promet, et la
  // fenêtre où « Rapprocher » vivait derrière un défilement de côté ne serait plus jamais mesurée.
  const fenetresBanque = async (ou, exiger) => {
    const lignes = await win.evaluate(() => [...document.querySelectorAll('#view tr[data-lig]')].map(tr => ({
      id: tr.dataset.lig, rapprochee: /Rapproché/.test((tr.querySelector('.badge') || {}).textContent || '') })));
    if (!lignes.length) {
      if (exiger) throw new Error(`${ou} : la vitrine n'a aucune ligne de relevé`);
      return;
    }
    for (const [geste, ligne] of [['Choisir l', lignes.find(l => !l.rapprochee)], ['Voir l', lignes.find(l => l.rapprochee)]]) {
      if (!ligne) {
        if (exiger) throw new Error(`${ou} : aucune ligne n'offre « ${geste}… »`);
        continue;
      }
      await win.click(`#view [data-rowmenu="LIG:${ligne.id}"]`);
      await win.locator('.row-menu button', { hasText: geste }).first().click({ timeout: 4000 });
      await win.waitForSelector(FENETRE, { timeout: 5000 });
      await attendre(300);
      await mesurer(`${ou} · fenêtre « ${geste}… »`);
      await win.keyboard.press('Escape');
      await win.waitForFunction(() => !document.querySelector('#modal-root .modal'), null, { timeout: 5000 })
        .catch(() => { throw new Error(`${ou} : la fenêtre « ${geste}… » ne se referme pas à Échap`); });
    }
  };

  // 10.12.0 (vu au test humain) — le livre-journal d'une pièce CONTRE-PASSÉE. L'originale ne garde
  // qu'une action (« Joindre un justificatif… », un bouton nommé de 203 px), le miroir porte
  // « contre-passation ↩ n° 65 » : les deux élargissaient le tableau, et la colonne d'actions
  // collante recouvrait le Crédit. Aucun parcours ne contre-passe : l'état n'était mesuré par
  // personne (T-55, un geste plus loin). On le fabrique par les VRAIS boutons, une fois, sur la
  // première pièce validée venue, puis chaque passe filtre le journal sur elle — l'originale et son
  // miroir, côte à côte, comme un comptable qui vérifie sa correction.
  let pieceCP = null, quiCP = null, cpMesures = 0;
  const journalContrePasse = async ou => {
    if (!pieceCP) {
      const cible = await win.evaluate(() => {
        const tr = [...document.querySelectorAll('#view tr')].find(x => !x.classList.contains('br-ligne')
          && !x.classList.contains('cp-ligne') && !x.classList.contains('cp-miroir') && x.querySelector('[data-rowmenu^="E:"]'));
        if (!tr) return null;
        return { menu: tr.querySelector('[data-rowmenu^="E:"]').dataset.rowmenu, piece: (tr.cells[3].querySelector('.nw') || tr.cells[3]).textContent.trim() };
      });
      if (!cible || !cible.piece) return false;
      await win.click(`#view [data-rowmenu="${cible.menu}"]`);
      const contre = win.locator('.row-menu button', { hasText: 'Contre-passer' }).first();
      if (!await contre.count()) { await win.keyboard.press('Escape'); return false; }
      await contre.click({ timeout: 4000 });
      await win.waitForSelector('#modal-root .modal #ok', { timeout: 5000 });
      await win.click('#modal-root .modal #ok');
      await win.waitForFunction(() => document.querySelector('#view tr.cp-ligne'), null, { timeout: 8000 })
        .catch(() => { throw new Error(`${ou} : la contre-passation de ${cible.piece} n'a rien barré dans le journal`); });
      pieceCP = cible.piece;
    }
    await win.fill('#lv-q', pieceCP);
    await win.waitForFunction(() => document.querySelector('#view tr.cp-ligne') && document.querySelector('#view tr.cp-miroir'), null, { timeout: 6000 })
      .catch(() => { throw new Error(`${ou} : le journal filtré sur ${pieceCP} ne montre pas l'originale ET son miroir`); });
    await attendre(250);
    await mesurer(`${ou} · une pièce contre-passée (${pieceCP}) et son miroir`);
    cpMesures++;
    await win.fill('#lv-q', '');
    await attendre(250);
    return true;
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
    // Le premier de la liste d'abord — son livre se CRÉE par le geste réel —, puis les deux
    // vitrines, dont les écrans sont pleins (voir `VITRINES`).
    for (const cible of [null, ...VITRINES]) {
      await aller('#/dossiers');
      const ligne = await win.$(cible ? `#view table.list tbody tr[data-id="${cible.id}"]` : '#view table.list tbody tr[data-id]');
      if (!ligne) {
        throw new Error(cible ? `la vitrine ${cible.id} n'est pas dans la liste : ses écrans pleins ne seraient jamais mesurés`
          : 'aucun dossier dans la liste : la fiche ne serait jamais mesurée');
      }
      const qui = cible ? `vitrine ${cible.vitrine}` : 'premier dossier';
      await ligne.click();
      await attendre(600);
      for (const onglet of ['suivi', 'comptabilite', 'paquets']) {
        const b = await win.$(`#d-tabs button[data-tab="${onglet}"]`);
        if (!b) throw new Error(`la fiche d'un dossier n'a pas d'onglet « ${onglet} »`);
        await b.click();
        await attendre(450);
        await mesurer(`${etiquette} fiche (${qui}) · ${onglet}`);
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
          await mesurer(`${etiquette} fiche (${qui}) · compta · ${o.tab}`);
          if (o.tab === 'journal' && (!pieceCP || quiCP === qui)
            && await journalContrePasse(`${etiquette} fiche (${qui}) · compta · journal`)) quiCP = qui;
          if (o.tab === 'banque') await fenetresBanque(`${etiquette} fiche (${qui}) · compta · banque`, cible && cible.vitrine === 'skanfact');
          // 10.12.0 (U-19) — l'Exercice se replie en sections, et une section FERMÉE cache ses
          // tableaux (soldes de gestion, à-nouveaux) à toutes les sondes. On les mesure aussi ouvertes :
          // la leçon T-55 un cran plus bas — l'état par défaut de ce qu'on ouvre cache la page.
          const fermees = await win.evaluate(() => {
            const d = [...document.querySelectorAll('#view details.pli:not([open])')];
            d.forEach(x => { x.open = true; });
            return d.length;
          });
          if (fermees) {
            await attendre(250);
            await mesurer(`${etiquette} fiche (${qui}) · compta · ${o.tab} (${fermees} section${fermees > 1 ? 's' : ''} rouverte${fermees > 1 ? 's' : ''})`);
          }
          // Le modèle de liasse vit dans une FENÊTRE depuis la 10.12.0 (U-19) : aucune adresse n'y
          // mène, seulement un geste — donc un instrument qui parcourt les onglets ne la verrait
          // jamais (la leçon de la 10.6.0 : huit surfaces qu'aucune adresse ne mène).
          if (o.tab === 'liasse') {
            const ouvrir = await win.$('#li-modele');
            if (!ouvrir) throw new Error('la liasse ne propose plus d\'ouvrir son modèle : la fenêtre ne serait jamais mesurée');
            await ouvrir.click();
            await win.waitForSelector('.modal.cab-large #sr-liasse table', { timeout: 6000 });
            await attendre(300);
            await mesurer(`${etiquette} fiche (${qui}) · compta · liasse · fenêtre du modèle`);
            await win.keyboard.press('Escape');
            await win.waitForFunction(() => !document.querySelector('.modal.cab-large'), null, { timeout: 5000 })
              .catch(() => { throw new Error('la fenêtre du modèle ne se referme pas à Échap sans modification'); });
          }
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
    // Le bouton se vise par ce qu'il EST (`#w-next`), jamais par sa couleur : depuis la 10.12.0
    // (U-11), « Continuer » n'est vert que quand le geste de l'écran est fait — viser le vert
    // arrêtait le parcours au premier écran à geste, l'assistant restait ouvert et volait tous les
    // clics suivants.
    const suivant = await win.$('#w-next');
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
  if (COUVERTURE) {
    await fermer(app);
    if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
    if (lusCouverture < PLANCHER_COUVERTURE) { console.error(`\n${lusCouverture} contrôles lus seulement (plancher : ${PLANCHER_COUVERTURE}) — le parcours n'a pas atteint ses écrans.`); process.exit(2); }
    const OUTC = dossierCaptures('cabinet-couverture');
    fs.writeFileSync(path.join(OUTC, 'manquants.json'), JSON.stringify(couverture, null, 1));
    const cles = new Map();
    couverture.forEach(m => {
      const k = m.id ? '#' + m.id : m.name ? `[name=${m.name}]` : Object.keys(m.data)[0] ? `[${Object.entries(m.data)[0].join('=')}]` : `${m.tag}.${m.cls} « ${m.lib} »`;
      if (!cles.has(k)) cles.set(k, { n: 0, ex: m }); cles.get(k).n++;
    });
    if (cles.size) {
      console.error(`\n${couverture.length} contrôle(s) sans explication, ${cles.size} distinct(s) (liste : ${path.join(OUTC, 'manquants.json')}) :\n  `
        + [...cles.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${v.n} × ${k} — « ${v.ex.lib} » — ${v.ex.ecran}`).join('\n  '));
      process.exit(1);
    }
    console.log(`\n${j.total()} étapes — ${lusCouverture} contrôles lus sur chaque écran du Cabinet : chacun dit ce qu'il fait.`);
    process.exit(0);
  }
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

  await fermer(app);

  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  // Un instrument qui ne mesure rien annonce « tout va bien » : il doit échouer, pas se taire.
  if (!boutons || !champs || !liensMesures || !colonnes || !ecarts || !collants || !tableaux || !fenetres || !rangees || !bulles) { console.error('\nRien n\'a été mesuré : le parcours ne prouve rien.'); process.exit(2); }
  // L'état fabriqué par un geste doit avoir été ATTEINT à chaque passe : sinon l'instrument dirait
  // « rien de recouvert » d'un journal qu'il n'a jamais regardé avec une pièce contre-passée.
  if (cpMesures < 4) { console.error(`\nLe journal d'une pièce contre-passée n'a été mesuré que ${cpMesures} fois sur 4 passes : le parcours ne prouve rien de cet état.`); process.exit(2); }
  if (fautes.length) {
    const u = [...new Set(fautes)];
    console.error(`\n${u.length} défaut(s) de rendu dans l'app Cabinet :\n  ` + u.join('\n  '));
    process.exit(1);
  }
  console.log(`\n${j.total()} étapes — ${boutons} boutons, ${champs} champs, ${liensMesures} liens, ${colonnes} colonnes, ${controles} contrôles,`
    + ` ${ecarts} écarts, ${collants} tableaux sous colonne collante, ${tableaux} tableaux jugés pour le texte coupé,`
    + ` ${fenetres} fenêtres ouvertes, ${rangees} rangées de cartes, ${bulles} bulles « i », mesurés en clair et en sombre, à 1440 et à 1280 :`
    + ' rien d\'illisible, rien de désaligné, rien d\'étiré, rien de collé, rien de recouvert, rien de coupé à côté du vide, aucun chiffre en escalier, aucune bulle orpheline.');
})().catch(e => { console.error(e); process.exit(1); });
