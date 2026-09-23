// L'Aide (refonte 7.23.0, mise en page revue en 7.27.0).
//
// Avant la 7.23.0 : trente-deux titres dans une liste plate. Avant la 7.27.0 : sept cartes grises
// qui n'annonçaient qu'un NOMBRE, la liste des sept thèmes redessinée sous le thème qu'on venait
// d'ouvrir, un fil d'Ariane empilé VERTICALEMENT au milieu de la page, et « article suivant » posé
// à l'extrémité droite de l'écran. Rien de tout ça n'apparaît en console : ça se MESURE.
//
//   1. `#/aide` ouvre un plan : sept thèmes colorés, leurs trente-deux articles visibles.
//   2. Une pastille mène à sa section — sans redessiner la liste des thèmes par-dessus.
//   3. Le fil d'Ariane tient sur UNE ligne, et « suivant » reste dans la colonne de l'article.
//   4. Le geste au bout de l'article ouvre vraiment la page qu'il annonce.
//   5. La recherche classe ses résultats, et « Comprendre cette page » ouvre l'article de LA page.
//   6. Un article long porte son sommaire, et le sommaire mène à son intertitre.
//
//   xvfb-run -a node test/e2e/aide.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-aide-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(320); };

  j.etape('Une entreprise');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Aide SUARL');
      await win.fill('#sf-form input[name=matricule]', '7788990D/A/M/000');
    }
    if (await win.$('[data-act="conseil"]')) { await win.click('[data-act="conseil"]'); await win.waitForSelector('[data-act="conseil"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  j.ok('prêt');

  // -------------------------------------------------- 1. le plan
  j.etape('#/aide ouvre un plan : sept thèmes colorés, leurs articles visibles');
  const G = require(path.join(RACINE, 'src', 'renderer', 'guide.js'));
  await aller('#/aide');
  await win.waitForSelector('.help-sec');
  const plan = await win.evaluate(() => ({
    chips: [...document.querySelectorAll('.help-chip')].map(b => b.dataset.theme),
    sections: [...document.querySelectorAll('.help-sec')].map(s => ({
      id: s.dataset.sec,
      arts: [...s.querySelectorAll('.help-art')].map(b => b.dataset.art),
      // La couleur : un thème gris au milieu de six colorés est un thème qu'on a oublié.
      couleur: getComputedStyle(s).getPropertyValue('--th').trim()
    })),
    article: !!document.querySelector('.help-body')
  }));
  if (plan.article) throw new Error('#/aide ouvre d\'office un article : on ne voit jamais le plan');
  if (plan.chips.length !== G.THEMES.length) throw new Error(`${plan.chips.length} pastilles pour ${G.THEMES.length} thèmes`);
  if (plan.sections.length !== G.THEMES.length) throw new Error(`${plan.sections.length} sections pour ${G.THEMES.length} thèmes`);
  // Chaque section liste EXACTEMENT les articles de son thème : ni oubli, ni article en trop.
  const couleurs = new Set();
  G.THEMES.forEach((t, i) => {
    const s = plan.sections[i];
    if (s.id !== t.id) throw new Error(`section ${i} : « ${s.id} » au lieu de « ${t.id} »`);
    if (s.arts.join('|') !== t.articles.join('|')) throw new Error(`« ${t.label} » affiche ${s.arts.join(', ')} au lieu de ${t.articles.join(', ')}`);
    if (!s.couleur) throw new Error(`« ${t.label} » n'a aucune couleur : il sortira gris au milieu des autres`);
    couleurs.add(s.couleur);
  });
  if (couleurs.size !== G.THEMES.length) throw new Error(`${couleurs.size} couleurs distinctes pour ${G.THEMES.length} thèmes : deux thèmes se ressemblent`);
  const nArts = plan.sections.reduce((n, s) => n + s.arts.length, 0);
  if (nArts !== G.ARTICLES.length) throw new Error(`${nArts} articles affichés sur ${G.ARTICLES.length}`);
  j.ok(`${plan.sections.length} thèmes, ${nArts} articles visibles, ${couleurs.size} couleurs`);

  // -------------------------------------------------- 2. une pastille mène à sa section
  j.etape('Une pastille descend à sa section, sans redessiner le plan par-dessus');
  const avant = await win.evaluate(() => document.querySelector('main').scrollTop);
  await win.click('.help-chip[data-theme="piloter"]');
  // Le défilement est animé : on attend qu'il se STABILISE plutôt qu'un délai au jugé — sinon le
  // test mesure le milieu de l'animation et accuse un code juste.
  let dernier = -1;
  for (let k = 0; k < 40; k++) {
    const v = await win.evaluate(() => document.querySelector('main').scrollTop);
    if (v === dernier && v > 0) break;
    dernier = v; await win.waitForTimeout(200);
  }
  const apres = await win.evaluate(() => {
    const m = document.querySelector('main'), sec = document.querySelector('#sec-piloter');
    return {
      scroll: m.scrollTop, max: m.scrollHeight - m.clientHeight,
      haut: Math.round(sec.getBoundingClientRect().top),
      sections: document.querySelectorAll('.help-sec').length
    };
  });
  if (apres.scroll <= avant) throw new Error('la pastille ne descend nulle part : le clic est avalé');
  // La section arrive en haut — autant que la page le permet : la DERNIÈRE ne peut pas y monter,
  // il n'y a plus rien à faire défiler sous elle. La règle couvre les deux cas.
  const enHaut = apres.haut >= -20 && apres.haut <= 60;
  const aFond = apres.scroll >= apres.max - 2;
  if (!enHaut && !aFond) throw new Error(`la section visée est à ${apres.haut}px du haut (défilement ${apres.scroll}/${apres.max}) : on n'atterrit pas dessus`);
  // Le défaut de la 7.23.0 : ouvrir un thème réaffichait les sept thèmes juste en dessous.
  if (apres.sections !== G.THEMES.length) throw new Error(`${apres.sections} sections après le clic : le plan a été dupliqué`);
  j.ok(`« Piloter et protéger » à ${apres.haut}px du haut, toujours ${apres.sections} sections`);

  // -------------------------------------------------- 3. le fil d'Ariane et la colonne
  j.etape('Le fil tient sur une ligne, et « suivant » reste dans la colonne de l\'article');
  const theme = G.THEMES.find(t => t.articles.length >= 3);
  await aller('#/aide/' + theme.articles[1]);
  await win.waitForSelector('.help-body');
  const mise = await win.evaluate(() => {
    const fil = document.querySelector('.help-fil');
    const lignes = new Set([...fil.children].map(x => Math.round(x.getBoundingClientRect().top)));
    const corps = document.querySelector('.help-body').getBoundingClientRect();
    const suite = document.querySelector('.help-suite').getBoundingClientRect();
    return {
      texte: [...fil.children].filter(x => !x.classList.contains('sep')).map(x => x.textContent.trim()).filter(Boolean),
      lignes: lignes.size, hauteur: Math.round(fil.getBoundingClientRect().height),
      corps: [Math.round(corps.left), Math.round(corps.right)],
      suite: [Math.round(suite.left), Math.round(suite.right)],
      voisins: [...document.querySelectorAll('.help-suite [data-art]')].map(b => b.dataset.art)
    };
  });
  // LE défaut de la 7.23.0 : `.help-fil` était un <nav>, et `nav { flex-direction: column }` de la
  // barre latérale l'emportait. Trois niveaux empilés verticalement, centrés, sur chaque article.
  if (mise.lignes !== 1) throw new Error(`le fil d'Ariane s'étale sur ${mise.lignes} lignes : ${mise.texte.join(' / ')}`);
  if (mise.hauteur > 40) throw new Error(`le fil d'Ariane fait ${mise.hauteur}px de haut : il n'est pas sur une ligne`);
  if (mise.texte[0] !== 'Aide') throw new Error(`le fil ne commence pas par « Aide » : ${mise.texte.join(' / ')}`);
  // Et les boutons suivant/précédent prolongent l'article : ils vivaient 250px à sa droite.
  if (Math.abs(mise.suite[0] - mise.corps[0]) > 4 || mise.suite[1] > mise.corps[1] + 4)
    throw new Error(`« suivant » est hors de la colonne : article ${mise.corps.join('→')}, boutons ${mise.suite.join('→')}`);
  if (!mise.voisins.length) throw new Error('aucun article suivant ni précédent : il faut repasser par le plan');
  // Le voisin appartient au MÊME thème : on lit un domaine, on ne saute pas de la paie au stock.
  const dehors = mise.voisins.filter(id => !theme.articles.includes(id));
  if (dehors.length) throw new Error(`l'article voisin sort du thème : ${dehors.join(', ')}`);
  j.ok(`fil « ${mise.texte.join(' › ')} » sur une ligne (${mise.hauteur}px) — voisins ${mise.voisins.join(', ')}`);

  // -------------------------------------------------- 4. le geste mène vraiment quelque part
  j.etape('Le geste au bout de l\'article ouvre la page qu\'il annonce');
  // On prend un article qui en a un : tous n'en ont pas (glossaire, raccourcis).
  const avecGeste = Object.keys(G.GESTES)[0];
  await aller('#/aide/' + avecGeste);
  await win.waitForSelector('.help-geste [data-geste]');
  const cible = await win.$eval('.help-geste [data-geste]', b => b.dataset.geste);
  await win.click('.help-geste [data-geste]');
  await win.waitForFunction(x => location.hash === x, cible, { timeout: 4000 });
  j.ok(`« ${avecGeste} » mène à ${cible}`);

  // -------------------------------------------------- 5. recherche et aide contextuelle
  j.etape('La recherche traverse tout, et chaque page mène à SON article');
  await aller('#/aide');
  await win.fill('#aide-q', 'timbre');
  await win.waitForTimeout(400);
  const res = await win.evaluate(() => ({
    caches: document.querySelector('#aide-vue').hidden,
    trouves: [...document.querySelectorAll('#aide-res .help-art')].map(b => b.dataset.art),
    compte: (document.querySelector('#aide-n') || {}).textContent
  }));
  if (!res.trouves.length) throw new Error('« timbre » ne trouve aucun article');
  if (!res.caches) throw new Error('le plan reste affiché sous les résultats de recherche');
  j.ok(`« timbre » → ${res.compte.trim()}`);

  // Le classement (7.27.0). « tva » rendait dix-sept articles sur trente-deux dans l'ordre où ils
  // sont écrits : « Démarrer : tes premiers pas » arrivait premier, et l'article qui PORTE le mot
  // dans son titre quatrième. Une liste de dix-sept titres non classés ne vaut pas mieux que la
  // liste des trente-deux qu'elle remplace.
  await win.fill('#aide-q', 'tva');
  await win.waitForTimeout(400);
  const rang = await win.evaluate(() => [...document.querySelectorAll('#aide-res .help-art')].map(b => ({
    id: b.dataset.art,
    titre: (b.querySelector('.ht') || {}).textContent.trim(),
    theme: (b.querySelector('.hth') || {}).textContent.trim(),
    marques: b.querySelectorAll('mark').length
  })));
  if (rang.length < 5) throw new Error(`« tva » ne trouve que ${rang.length} article(s)`);
  if (!/tva/i.test(rang[0].titre))
    throw new Error(`le premier résultat de « tva » est « ${rang[0].titre} » : le classement ne remonte pas les titres`);
  if (!rang[0].theme) throw new Error('un résultat ne dit pas de quel thème il vient');
  // L'extrait surligné : sans lui, un résultat dont le mot n'est ni dans le titre ni dans le
  // sous-titre n'explique pas pourquoi il est là.
  const sansMarque = rang.filter(r => !r.marques);
  if (sansMarque.length) throw new Error(`${sansMarque.length} résultat(s) sans le mot surligné : ${sansMarque.map(r => r.id).join(', ')}`);
  j.ok(`« tva » → « ${rang[0].titre} » en tête, ${rang.length} résultats tous surlignés`);
  await win.fill('#aide-q', '');
  await win.waitForTimeout(250);

  // Le lien contextuel : on ouvre une page, et « Comprendre cette page » doit viser SON article.
  await aller('#/tresorerie');
  const lien = await win.$('.page-help');
  if (!lien) throw new Error('la page Trésorerie n\'offre aucun lien vers son article');
  const href = await lien.getAttribute('href');
  if (href !== '#/aide/' + G.PAR_PAGE.tresorerie) throw new Error(`le lien vise ${href} au lieu de l'article de la page`);
  await lien.click();
  await win.waitForSelector('.help-body');
  const titre = await win.$eval('.help-h', e => e.textContent.trim());
  j.ok(`Trésorerie → « ${titre} »`);

  // -------------------------------------------------- 6. le sommaire d'un article long
  j.etape('Un article long porte son sommaire, et le sommaire mène à son intertitre');
  await aller('#/aide/vocabulaire');
  await win.waitForSelector('.help-toc button');
  const som = await win.evaluate(() => ({
    entrees: [...document.querySelectorAll('.help-toc button')].map(b => ({ h: b.dataset.h, t: b.textContent.trim() })),
    titres: [...document.querySelectorAll('.help-body h3')].map(x => ({ id: x.id, t: x.textContent.trim() }))
  }));
  if (som.entrees.length !== som.titres.length)
    throw new Error(`${som.entrees.length} entrées de sommaire pour ${som.titres.length} intertitres`);
  som.entrees.forEach((e, i) => {
    if (e.h !== som.titres[i].id) throw new Error(`l'entrée « ${e.t} » vise « ${e.h} » au lieu de « ${som.titres[i].id} »`);
    if (e.t !== som.titres[i].t) throw new Error(`l'entrée « ${e.t} » ne porte pas le titre « ${som.titres[i].t} »`);
  });
  const derniere = som.entrees[som.entrees.length - 1];
  await win.evaluate(() => { document.querySelector('main').scrollTop = 0; });
  await win.click(`.help-toc button[data-h="${derniere.h}"]`);
  await win.waitForTimeout(900);
  const arrivee = await win.evaluate(x => Math.round(document.getElementById(x).getBoundingClientRect().top), derniere.h);
  if (arrivee < -30 || arrivee > 200) throw new Error(`« ${derniere.t} » est à ${arrivee}px du haut après le clic : le sommaire ne mène nulle part`);
  // Et un article court n'en porte pas : trois lignes de sommaire sur quinze lignes de texte,
  // c'est du bruit.
  await aller('#/aide/acompte');
  await win.waitForSelector('.help-body');
  if (await win.$('.help-toc')) throw new Error('un article court porte un sommaire');
  j.ok(`${som.entrees.length} entrées, la dernière atterrit à ${arrivee}px — et l'article court n'en a pas`);

  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — l'Aide se parcourt par territoire, et chaque article mène quelque part.`);
})().catch(e => { console.error(e); process.exit(1); });
