// La barre latérale : ce qu'on voit sans faire défiler, et ce qui ne se perd jamais (7.0.0).
//
// Pourquoi ce test existe : avant la 7.0.0, `nav` contenait dix-neuf liens écrits à la main et avait
// besoin de 866 px. Sur un MacBook de 900 px de haut il en avait 705. « Paramètres » et « Aide »
// étaient donc hors champ — et « Aide » l'était même sur un écran de 1050 px. Le propriétaire de
// l'application a passé des semaines à chercher le bouton d'aide : il était sous le plancher, derrière
// une barre de défilement que macOS masque tant qu'on ne fait pas défiler.
//
// Ça ne se voit dans aucune console, et aucun test de calcul ne peut l'attraper : il faut mesurer
// dans l'application réelle (CLAUDE.md, leçon 6.8.0).
//
//   xvfb-run -a node test/e2e/barre-laterale.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Les tailles qui comptent : le Mac de Skander, le plus petit portable courant, et un grand écran.
const ECRANS = [[1680, 1050], [1440, 900], [1366, 768], [1280, 800]];

(async () => {
  const j = journal();
  const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-barre-'));
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE],
    executablePath: ELECTRON, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  });
  const win = await app.firstWindow();
  surveiller(win, '', bac);

  j.etape('L\'assistant de première utilisation, mené au plus court');
  await win.waitForSelector('#setup');
  // On reconnaît chaque écran à ce qu'il contient plutôt qu'à son numéro : l'assistant a gagné un
  // septième écran en 7.2.0, et une boucle « six fois Continuer » se serait arrêtée avant la fin.
  let propose = null;
  for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Ben Salah SUARL');
      await win.fill('#sf-form input[name=matricule]', '1234567X/A/M/000');
    }
    if (await win.$('[data-act="conseil"]')) { await win.click('[data-act="conseil"]'); await win.waitForSelector('[data-act="conseil"].sel'); }
    if (await win.$('#sf-mods')) {
      propose = await win.evaluate(() => ({
        coches: [...document.querySelectorAll('[data-sfmod]')].filter(c => c.checked).length,
        total: document.querySelectorAll('[data-sfmod]').length
      }));
      // On coche TOUT : la suite mesure le pire cas, celui du menu complet. C'est l'état d'avant la
      // 7.2.0, et c'est celui qu'il faut continuer à mesurer — sinon le test deviendrait vert parce
      // que le menu a rétréci, et il ne dirait plus rien sur ce qui se passe quand il ne rétrécit pas.
      for (let k = 0; k < 20; k++) {
        const c = await win.$('#sf-mods input[type=checkbox]:not(:checked)');
        if (!c) break;
        await c.click();
      }
    }
    await win.click('#sf-next');
    await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  if (!propose) throw new Error('l\'assistant n\'a jamais montré l\'écran « De quoi as-tu besoin ? »');
  if (!(propose.coches < propose.total)) throw new Error(`l'assistant propose ${propose.coches} modules sur ${propose.total} : il ne trie rien`);
  j.ok(`entreprise créée · l'assistant proposait ${propose.coches} modules sur ${propose.total} pour « conseil », on les a tous pris`);

  // Mesure : ce que `nav` demande, ce dont il dispose, et ce qui tombe hors champ.
  const mesurer = async () => win.evaluate(() => {
    const nav = document.querySelector('nav');
    const boite = nav.getBoundingClientRect();
    const hors = [...nav.querySelectorAll('a')]
      .filter(a => { const b = a.getBoundingClientRect(); return b.bottom > boite.bottom + 1 || b.top < boite.top - 1; })
      .map(a => a.textContent.trim());
    const visible = el => {
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= window.innerHeight + 1;
    };
    return {
      besoin: nav.scrollHeight, place: nav.clientHeight, hors,
      liens: nav.querySelectorAll('a').length,
      deborde: nav.classList.contains('deborde'),
      parametres: visible(document.querySelector('.sidebar-foot a[data-route="parametres"]')),
      aide: visible(document.querySelector('.sidebar-foot a[data-route="aide"]')),
      // VISIBLE, pas seulement présent : « Tous les modules » était la dernière entrée de <nav>,
      // donc la première à passer sous la coupe — mesurée hors champ dès 1366×768. Le test se
      // contentait de sa présence dans le document, et restait donc vert sur une porte de sortie
      // qu'on ne pouvait pas voir. Il vit maintenant dans le pied, qui ne défile jamais.
      tousLesModules: visible(document.querySelector('.sidebar-foot a[data-route="modules"]')),
      recherche: visible(document.querySelector('#nav-search'))
    };
  });

  j.etape('Le seul point qui ne se négocie pas : Aide et Paramètres, sur toutes les tailles d\'écran');
  for (const [L, H] of ECRANS) {
    await win.setViewportSize({ width: L, height: H });
    await win.waitForTimeout(200);
    const m = await mesurer();
    if (!m.aide) throw new Error(`${L}×${H} : « Aide » n'est pas visible sans faire défiler. C'est le bouton que cherche quelqu'un qui se perd.`);
    if (!m.parametres) throw new Error(`${L}×${H} : « Paramètres » n'est pas visible sans faire défiler, alors que l'aide y renvoie onze fois.`);
    if (!m.tousLesModules) throw new Error(`${L}×${H} : « Tous les modules » n'est pas visible sans faire défiler — une porte de sortie hors champ n'est pas une porte de sortie.`);
    if (!m.recherche) throw new Error(`${L}×${H} : le champ « Rechercher… » n'est pas visible. Sans lui, la recherche générale n'existe que pour qui connaît déjà le raccourci.`);
    j.ok(`${L}×${H} : Aide, Paramètres, « Tous les modules » et la recherche atteignables · nav ${m.besoin}px / ${m.place}px`
      + (m.hors.length ? ` · ${m.hors.length} entrée(s) à faire défiler` : ' · tout tient'));
  }

  j.etape('L\'entrée allumée est toujours dans le champ');
  // `drawNav` réécrit nav.innerHTML à chaque navigation, ce qui remet le défilement à zéro : sur les
  // quatre dernières pages, l'entrée marquée « active » était cent pixels sous le bord et AUCUNE
  // entrée en vert n'était visible. On arrivait au bon écran sans apprendre où il vit dans le menu.
  await win.setViewportSize({ width: 1280, height: 800 });
  for (const route of ['compta', 'paie', 'stats', 'devis']) {
    await win.evaluate(r => { location.hash = '#/' + r; }, route);
    await win.waitForSelector('#view h1');
    await win.waitForTimeout(180);
    const vu = await win.evaluate(() => {
      const a = document.querySelector('nav a.active');
      if (!a) return { manque: true };
      const nav = document.querySelector('nav');
      const b = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
      return { dedans: b.top >= n.top - 1 && b.bottom <= n.bottom + 1, texte: a.textContent.trim() };
    });
    if (vu.manque) throw new Error(`#/${route} : aucune entrée du menu n'est allumée`);
    if (!vu.dedans) throw new Error(`#/${route} : l'entrée allumée (« ${vu.texte} ») est hors du champ de la barre — rien ne montre où vit cette page`);
  }
  j.ok('sur les quatre pages, l\'entrée du menu est visible et allumée');

  j.etape('Avec les modules d\'un débutant, la barre tient en entier sur le plus petit écran');
  await win.setViewportSize({ width: 1366, height: 768 });
  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#mod-list');
  // On décoche tout ce qui est décochable : c'est l'état « je fais du conseil, je facture, point ».
  // Le panneau se redessine à chaque case (les explications changent) : garder les poignées d'une
  // seule requête donnerait des éléments détachés du document. On reprend la première encore cochée
  // à chaque tour — c'est le même piège que celui noté en 3.3.0 pour `check()`.
  for (let garde = 0; garde < 20; garde++) {
    const c = await win.$('#mod-list input[type=checkbox]:checked');
    if (!c) break;
    await c.click();
    await win.waitForTimeout(80);
  }
  if (await win.$('#mod-list input[type=checkbox]:checked')) throw new Error('des modules restent cochés');
  await win.evaluate(() => { location.hash = '#/dashboard'; });
  await win.waitForSelector('#view h1');
  await win.waitForTimeout(200);
  const m = await mesurer();
  if (m.hors.length) throw new Error(`avec les modules du premier jour, ${m.hors.length} entrée(s) restent hors champ : ${m.hors.join(', ')} (nav ${m.besoin}px pour ${m.place}px)`);
  if (m.deborde) throw new Error('la barre se croit débordée alors que tout tient');
  j.ok(`${m.liens} entrées, ${m.besoin}px pour ${m.place}px — rien à faire défiler`);

  j.etape('Rien de masqué n\'est perdu');
  // La page d'un module retiré du menu s'ouvre normalement, et l'application dit où le retrouver.
  await win.evaluate(() => { location.hash = '#/paie'; });
  await win.waitForSelector('#view h1');
  if ((await win.textContent('#view h1')) !== 'Paie') throw new Error('la page d\'un module masqué doit s\'ouvrir normalement');
  await win.waitForSelector('.mod-banner');
  const texte = await win.textContent('.mod-banner');
  if (!/n'est pas dans ton menu/.test(texte)) throw new Error('bandeau : ' + texte);
  j.ok('la page s\'ouvre, et l\'app explique pourquoi elle n\'est pas au menu');

  // Le bouton du bandeau la remet au menu — sans quoi il faudrait retourner dans les réglages.
  await win.click('#mod-add');
  await win.waitForSelector('nav a[data-route="paie"]');
  j.ok('« Ajouter au menu » la fait apparaître tout de suite');

  j.etape('On ne masque jamais ce qui contient quelque chose');
  // On retire Paie du menu, puis on crée un salarié : le module doit revenir tout seul.
  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#mod-list');
  await win.click('#mod-list input[data-mod="paie"]');
  await win.waitForTimeout(120);
  if (await win.$('nav a[data-route="paie"]')) throw new Error('décoché, le module devrait quitter le menu');
  await win.evaluate(() => { location.hash = '#/paie'; });
  await win.waitForSelector('#view h1');
  // Depuis la 7.7.0, le bouton vert de l'en-tête suit l'onglet ouvert — SAUF quand la page est
  // vide : les onglets sont alors masqués, et un écran qui dit « commence par créer la fiche d'un
  // salarié » doit offrir de quoi le faire. Ce test l'a attrapé le jour même.
  await win.waitForSelector('#view .page-head .btn-primary');
  await win.click('#view .page-head .btn-primary');           // + Salarié
  await win.waitForSelector('#modal-root input[name=name]');
  await win.fill('#modal-root input[name=name]', 'Fatma Trabelsi');
  await win.fill('#modal-root input[name=grossSalary]', '1200');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
  await win.evaluate(() => { location.hash = '#/dashboard'; });
  await win.waitForSelector('#view h1');
  if (!(await win.$('nav a[data-route="paie"]'))) {
    throw new Error('un module qui contient des données doit revenir au menu tout seul : sans ça, quelqu\'un qui a saisi puis décoché croirait avoir tout perdu');
  }
  j.ok('un salarié suffit à faire revenir « Paie » au menu');

  // Et sa case est toujours là (7.12.0). Jusque-là elle cédait la place à un cadenas, ce qui voulait
  // dire : le module reste dans le menu ET on ne peut plus le décocher. Une case qui se retire au
  // moment où on s'en sert est pire que pas de case — c'est ce que Skander a rencontré en ouvrant
  // l'application (« ça disparaît pas du menu et je peux pas le recocher »).
  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#mod-list');
  const casePaie = await win.$('#mod-list input[data-mod="paie"]');
  if (!casePaie) throw new Error('la case « Paie » a disparu : on ne peut plus revenir en arrière');
  if (!await casePaie.isChecked()) throw new Error('le module est revenu au menu sans que sa case le dise');
  const ecran = await win.textContent('#view');
  if (!/revient tout seul/.test(ecran)) throw new Error('l\'écran doit DIRE ce qui ramène un module masqué');
  j.ok('la case est là, cochée, et l\'écran dit ce qui ramène un module');

  j.etape('Allumer une entrée ne change pas sa hauteur — sans compteur, puis avec');
  // 10.12.0 — l'entrée active passait en gras, et « Facturation récurrente » passait à la ligne :
  // 34 px au repos, 48 une fois cliquée. Tout ce qui la suit descendait de 14 px sous le curseur, au
  // moment précis du clic. On allume chaque entrée à son tour et on compare sa hauteur au repos.
  // La preuve par réintroduction est restée VERTE trois fois, et chaque fois pour la même raison :
  // l'entrée était DÉJÀ sur deux lignes au repos, donc le gras ne changeait rien. Seize entrées
  // débordaient d'un écran de 900 px (la barre de défilement rétrécit la barre), puis, avec
  // l'exemple, son compteur « 1 » la faisait passer à la ligne. Le saut n'existe que SANS compteur et
  // SANS défilement — l'état de l'app de quelqu'un qui n'a encore aucun contrat. On mesure donc là, sur
  // une fenêtre haute, puis avec l'exemple pour les entrées qui portent un compteur.
  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#mod-list');
  for (let garde = 0; garde < 20; garde++) {
    const c = await win.$('#mod-list input[type=checkbox]:not(:checked):not(:disabled)');
    if (!c) break;
    await c.click();
    await win.waitForTimeout(80);
    const oui = await win.$('#modal-root #ok');
    if (oui) { await oui.click(); await win.waitForTimeout(80); }
  }
  const allumerTour = async (quand, L, H) => {
    await win.setViewportSize({ width: L, height: H });
    await win.evaluate(() => { location.hash = '#/dashboard'; });
    await win.waitForSelector('#view h1');
    await win.waitForTimeout(300);
    const defile = await win.evaluate(() => { const n = document.querySelector('nav'); return n.scrollHeight > n.clientHeight + 1; });
    if (defile) throw new Error(`${quand}, ${L}×${H} : la barre défile — une entrée peut y être sur deux lignes au repos, et la mesure ne verrait plus le gras`);
    const auRepos = await win.evaluate(() => [...document.querySelectorAll('nav a[href^="#/"]')].filter(a => a.offsetParent && !a.classList.contains('active'))
      .map(a => ({ href: a.getAttribute('href'), texte: (a.innerText || a.textContent).trim().replace(/\s+/g, ' '), h: Math.round(a.getBoundingClientRect().height),
        compteur: !!a.querySelector('.nav-count:not([hidden])') })));
    if (auRepos.length < 10) throw new Error(`${quand}, ${L}×${H} : trop peu d'entrées mesurées : ${auRepos.length}`);
    const sautent = [];
    for (const e of auRepos) {
      await win.evaluate(x => { location.hash = x; }, e.href);
      await win.waitForTimeout(150);
      const hAct = await win.evaluate(x => { const a = [...document.querySelectorAll('nav a')].find(y => y.getAttribute('href') === x); return a ? Math.round(a.getBoundingClientRect().height) : null; }, e.href);
      if (hAct !== null && Math.abs(hAct - e.h) > 1) sautent.push(`« ${e.texte} » ${e.h} → ${hAct} px`);
    }
    if (sautent.length) throw new Error(`${quand}, ${L}×${H} : une entrée change de hauteur quand elle s'allume : ` + sautent.join(' · '));
    return auRepos;
  };
  for (const [L, H] of [[1440, 1300], [1280, 1300]]) {
    const vus = await allumerTour('sans données', L, H);
    // Sans compteur, et c'est la condition du test : sinon on retomberait sur l'entrée déjà repliée.
    const recurrente = vus.find(e => /récurrente/.test(e.texte));
    if (!recurrente) throw new Error('« Facturation récurrente » n\'est pas au menu : la mesure ne voit pas l\'entrée qui sautait');
    if (recurrente.compteur) throw new Error('« Facturation récurrente » porte déjà un compteur : elle est repliée au repos, et le gras ne se verrait pas');
    j.ok(`sans données, ${L}×${H} : ${vus.length} entrées allumées tour à tour, aucune ne change de hauteur`);
  }
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const okDemo = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (okDemo) await okDemo.click();
  await win.waitForSelector('.demo-banner');
  for (const [L, H] of [[1440, 1300], [1280, 1300]]) {
    const vus = await allumerTour('avec l\'exemple', L, H);
    const avecCompteur = vus.filter(e => e.compteur).length;
    if (!avecCompteur) throw new Error(`avec l'exemple, ${L}×${H} : aucune entrée ne porte de compteur`);
    j.ok(`avec l'exemple, ${L}×${H} : ${vus.length} entrées (${avecCompteur} avec leur compteur), aucune ne change de hauteur`);
  }

  if (bac.length) { console.error('\nERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  await app.close();
  console.log('\n>>> BARRE LATÉRALE OK');
  process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
