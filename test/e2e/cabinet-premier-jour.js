// SkanFact Cabinet — LE PREMIER JOUR D'UN COMPTABLE.
//
// Pourquoi ce parcours existe, alors que `e2e:cabinet` ouvre déjà l'application : celui-là vérifie
// que les GESTES fonctionnent. Celui-ci regarde ce qu'un comptable VOIT, dans l'ordre où il le voit,
// la première fois — et il le mesure. C'est le comptable de Skander qui essaie l'application : s'il
// se perd, il ne le dira pas, il arrêtera.
//
// La méthode est celle qui a payé en 7.0.0 et en 7.30.0 : mesurer AVANT de juger. Une relecture du
// code ne montre ni un champ sans explication, ni un écran vide qui n'offre aucun geste, ni un
// bouton hors de l'écran, ni une page de dix écrans de haut. Tout est écrit dans
// `dist-e2e/cabinet-premier-jour/mesures.json`, avec une capture par écran à côté.
//
// Ce n'est pas qu'un instrument : les assertions à la fin sont des règles du projet, et elles
// doivent tomber si quelqu'un les recasse.
const { playwright, RACINE, ELECTRON } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'cabinet-premier-jour');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-jour1-'));
const errors = [];
const mesures = { ecrans: [], defauts: [] };
let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };
const dit = m => console.log('    · ' + m);

// Une largeur de portable (1280×800) : c'est l'écran d'un comptable, pas un 27 pouces. Les défauts
// de place ne se voient qu'ici (7.13.0).
const LARGE = 1440, HAUT = 900;

(async () => {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${path.join(dir, 'cab')}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const attendre = (ms = 350) => win.waitForTimeout(ms);

  // ------------------------------------------------------------------ la mesure d'un écran
  //
  // Tout ce qui suit se lit dans l'application RÉELLE, jamais déduit du code : c'est la seule façon
  // de voir une règle CSS qui perd, un bouton rogné par le bord, ou une explication absente.
  const mesurer = async (nom, titre) => {
    const m = await win.evaluate(() => {
      const vu = el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      };
      const view = document.getElementById('view') || document.body;
      const largeur = document.documentElement.clientWidth;

      // Les boutons visibles : leur libellé, et s'ils tiennent dans la fenêtre. On mesure le BOUTON
      // (7.13.0) : un ancêtre qui rogne ne se voit pas dans le scrollWidth de la page.
      //
      // Et surtout : EST-CE QUE ÇA RESSEMBLE À UN BOUTON ? « Un bouton sans bordure ni couleur n'est
      // pas un bouton » (Cabinet 1.0.0) — Skander avait ouvert l'application et dit « elle est vide »
      // devant un bouton parfaitement fonctionnel. Un bouton se distingue du texte par au moins un
      // signe AU REPOS : un fond, une bordure, un soulignement, ou une couleur qui n'est pas celle du
      // texte courant. Le survol ne compte pas : personne ne survole ce qu'il ne voit pas.
      const transparent = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\s*\)$/.test(c);
      const texteCourant = getComputedStyle(document.body).color;
      const boutons = [...document.querySelectorAll('button')].filter(vu).map(b => {
        const r = b.getBoundingClientRect();
        const s = getComputedStyle(b);
        const bord = ['Top', 'Right', 'Bottom', 'Left'].some(c =>
          parseFloat(s['border' + c + 'Width']) > 0 && !transparent(s['border' + c + 'Color']));
        return {
          texte: (b.textContent || '').trim().replace(/\s+/g, ' '),
          id: b.id || '', classe: b.className,
          deborde: Math.round(Math.max(0, r.right - largeur)),
          hauteur: Math.round(r.height),
          // Une icône seule (la bulle « i », une croix) n'a pas de texte : elle se reconnaît à son
          // dessin, on ne lui demande pas de ressembler à un bouton de formulaire.
          seVoit: !!(!transparent(s.backgroundColor) || bord
            || (s.textDecorationLine && s.textDecorationLine !== 'none')
            || s.color !== texteCourant || !(b.textContent || '').trim())
        };
      });

      // Les champs de SAISIE : ceux qui portent une donnée du cabinet ou d'un dossier. La convention
      // du projet est `label.field` + `lbl(titre, clé)`, donc chacun doit porter sa bulle « i ».
      // Une recherche ou une case de filtre n'en a pas besoin : son étiquette EST son explication —
      // mais elle doit alors en avoir une (étiquette ou placeholder), sinon c'est une boîte muette.
      const decrire = e => {
        const lab = e.closest('label') || (e.id && document.querySelector('label[for="' + e.id + '"]'));
        const bloc = e.closest('label, .field, .kv, .filters, .lock-field, tr') || e.parentElement;
        return {
          nom: e.name || e.id || '', type: e.type || e.tagName.toLowerCase(),
          etiquette: lab ? (lab.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) : '',
          placeholder: e.placeholder || '', aria: e.getAttribute('aria-label') || '',
          bulle: !!(bloc && bloc.querySelector('.i[data-info]'))
        };
      };
      const saisies = [...document.querySelectorAll('input, select, textarea')].filter(vu)
        .filter(e => !['hidden', 'submit', 'button'].includes(e.type));
      // L'écran de mot de passe est la PORTE, pas un formulaire de l'application : il explique en
      // toutes lettres ce qu'on y fait et ce qu'on risque, juste au-dessus des deux champs. Une bulle
      // « i » y serait une explication de plus à aller chercher là où tout est déjà écrit. Ce qu'on
      // lui demande, c'est de s'expliquer — et c'est vérifié à part, à l'étape 1.
      const champs = saisies.filter(e => e.closest('.field') && !e.closest('#lock-screen')).map(decrire);
      const libres = saisies.filter(e => !e.closest('.field')).map(decrire);

      // Les états vides : une phrase seule n'est pas une interface (7.0.0). Chacun doit porter un
      // geste, sinon on lit une notice de montage.
      // Le geste peut vivre juste sous la phrase, dans le même panneau : ce qui compte est qu'il soit
      // SOUS LES YEUX, pas qu'il soit dans la même balise.
      const vides = [...document.querySelectorAll('.vide, .empty, .placeholder')].filter(vu).map(e => {
        const cadre = e.closest('.panel, .modal, section') || e.parentElement;
        return {
          texte: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 140),
          bouton: !!(e.querySelector('button, a') || (cadre && cadre.querySelector('button, a')))
        };
      });

      // Ce qui déborde horizontalement : à 1280 px, une page qui se fait défiler de côté est un
      // défaut, sauf dans un `.scroll-x` qui est le marqueur explicite du projet.
      const deborde = [...document.querySelectorAll('#view *')].filter(vu).filter(e => {
        if (e.closest('.scroll-x')) return false;
        return e.scrollWidth - e.clientWidth > 4 && getComputedStyle(e).overflowX !== 'auto';
      }).map(e => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''));

      const mesurable = document.getElementById('app') && !document.getElementById('app').hidden ? view : document.body;
      return {
        hauteur: Math.round(mesurable.scrollHeight),
        ecrans: +(mesurable.scrollHeight / window.innerHeight).toFixed(2),
        titre: ((document.querySelector('.page-head h1, #setup h2, .lock h2, h1, h2') || {}).textContent || '').trim(),
        boutons, champs, libres, vides, deborde: [...new Set(deborde)],
        motsDuTexte: (mesurable.innerText || '').trim().split(/\s+/).length
      };
    });
    m.nom = nom; m.quoi = titre;
    mesures.ecrans.push(m);
    await win.screenshot({ path: path.join(OUT, nom + '.png') });
    const sansBulle = m.champs.filter(c => !c.bulle);
    dit(`${m.ecrans} écran(s) de haut · ${m.boutons.length} boutons · ${m.champs.length} champs`
      + (sansBulle.length ? ` · ${sansBulle.length} sans bulle` : '')
      + (m.vides.length ? ` · ${m.vides.length} état(s) vide(s)` : ''));
    return m;
  };

  const aller = async (hash, attente) => {
    await win.evaluate(h => { location.hash = h; }, hash);
    if (attente) await win.waitForSelector(attente, { timeout: 8000 });
    await attendre(500);
  };

  await win.setViewportSize({ width: LARGE, height: HAUT });

  // ================================================================ 1 — l'écran de mot de passe
  étape('Ce qu\'il voit en tout premier : l\'écran de mot de passe');
  await win.waitForSelector('#lock-form');
  await attendre(400);
  await mesurer('01-verrou', 'écran de mot de passe, cabinet neuf');
  const verrou = await win.evaluate(() => ({
    titre: ((document.querySelector('.lock-card h1, .lock-card h2') || {}).textContent || '').trim(),
    explique: ((document.getElementById('lock-sub') || {}).textContent || '').trim(),
    avertit: ((document.querySelector('.lock-warn') || {}).textContent || '').trim()
  }));
  dit('titre : ' + verrou.titre + ' — « ' + verrou.explique.slice(0, 70) + ' »');
  mesures.verrou = verrou;
  // La porte n'a pas de bulles « i », et c'est voulu : elle s'explique en toutes lettres. Encore
  // faut-il qu'elle le fasse — c'est le seul écran où une phrase manquante coûte le cabinet entier.
  if (!verrou.titre) mesures.defauts.push('l\'écran de mot de passe n\'a pas de titre');
  if (verrou.explique.length < 40) mesures.defauts.push('l\'écran de mot de passe n\'explique pas ce qu\'on y fait');
  if (!/récupérer|perdu|oubli/i.test(verrou.avertit)) {
    mesures.defauts.push('l\'écran de mot de passe ne dit pas qu\'un mot de passe perdu l\'est pour de bon');
  }
  // Et il se lit AVANT le bouton. Un avertissement posé en dessous est un avertissement qu'on lit
  // après avoir agi — c'est la règle des refus (7.0.0), appliquée à la porte d'entrée.
  const avant = await win.evaluate(() => {
    const w = document.querySelector('.lock-warn'), b = document.getElementById('lock-go');
    if (!w || !b) return false;
    return w.getBoundingClientRect().top < b.getBoundingClientRect().top;
  });
  if (!avant) mesures.defauts.push('l\'avertissement du mot de passe se lit SOUS le bouton qui crée le cabinet');

  await win.fill('#lock-pw', 'comptable-2026');
  await win.fill('#lock-pw2', 'comptable-2026');
  await win.click('#lock-go');
  await win.waitForSelector('#app', { state: 'visible', timeout: 15000 });
  await attendre(900);

  // ================================================================ 2 — l'assistant
  étape('L\'assistant de première utilisation');
  const aWizard = await win.$('#wiz, .wiz-card, #setup');
  if (aWizard) {
    let tour = 0; const vus = [];
    while (tour < 12) {
      await attendre(400);
      const e = await win.evaluate(() => {
        const w = document.getElementById('setup');
        if (!w) return null;
        return {
          titre: ((w.querySelector('h1, h2, h3') || {}).textContent || '').trim(),
          texte: (w.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 220),
          boutons: [...w.querySelectorAll('button')].filter(b => b.offsetParent)
            .map(b => ({ id: b.id, t: (b.textContent || '').trim() })),
          champs: [...w.querySelectorAll('input, textarea')].filter(b => b.offsetParent)
            .map(i => ({ id: i.id, type: i.type, place: i.placeholder || '' }))
        };
      });
      if (!e) break;
      tour++;
      vus.push(e.titre || ('écran ' + tour));
      await mesurer('02-assistant-' + String(tour).padStart(2, '0'), 'assistant · ' + (e.titre || tour));
      dit('« ' + e.titre + ' » — ' + e.texte.slice(0, 90));
      // On remplit DANS l'assistant : le même nom de champ peut exister dans la page du dessous, et
      // remplir celui-là laisse l'assistant vide — il refuse alors, à juste titre, et le parcours
      // tourne en rond sur le même écran sans jamais le dire. (C'est ce qui est arrivé au premier
      // essai : douze tours sur « Ton cabinet ».)
      for (const c of e.champs) {
        if (!c.id) continue;
        if (c.type === 'number') continue;
        const val = /mail/i.test(c.id) ? 'contact@cabinet-bensalah.tn'
          : /phone|tel/i.test(c.id) ? '+216 71 000 000'
            : /client/i.test(c.id) ? '' : 'Cabinet Ben Salah';
        if (val) await win.fill('#setup #' + c.id, val);
      }
      const suivant = e.boutons.find(b => /suivant|continuer|commencer|terminer|c'est parti|démarrer|j'ai compris/i.test(b.t));
      if (!suivant) { mesures.defauts.push('assistant « ' + e.titre + ' » : aucun bouton pour avancer'); break; }
      await win.click(suivant.id ? '#setup #' + suivant.id : `#setup button:has-text("${suivant.t}")`);
      // Si l'écran n'a pas changé au bout d'une seconde, c'est un refus muet ou un bouton inerte.
      await attendre(700);
      const encore = await win.evaluate(t => {
        const w = document.getElementById('setup');
        return w ? ((w.querySelector('h1, h2, h3') || {}).textContent || '').trim() === t : false;
      }, e.titre);
      if (encore) { mesures.defauts.push('assistant : « ' + suivant.t +' » ne quitte pas l\'écran « ' + e.titre + ' »'); break; }
    }
    ok('assistant parcouru : ' + vus.join(' → '));
    mesures.assistant = vus;
  } else {
    mesures.defauts.push('aucun assistant de première utilisation à l\'ouverture');
    ok('pas d\'assistant');
  }
  await attendre(700);

  // ================================================================ 3 — le portefeuille VIDE
  étape('La page Dossiers, avant d\'avoir le moindre client');
  await aller('#/dossiers', '#view');
  await mesurer('03-dossiers-vide', 'Dossiers, portefeuille vide');

  // ================================================================ 4 — toutes les pages, à vide
  étape('Toutes les pages, à vide : ce qu\'il trouve s\'il clique partout');
  const menu = await win.evaluate(() => [...document.querySelectorAll('nav a[href^="#/"]')]
    .map(a => ({ hash: a.getAttribute('href'), texte: (a.textContent || '').trim().replace(/\s+/g, ' ') })));
  mesures.menu = menu;
  dit('menu : ' + menu.map(x => x.texte).join(' · '));
  for (const p of menu) {
    await aller(p.hash, '#view');
    await mesurer('04-vide-' + p.hash.replace(/[#/]/g, '') , p.texte + ' (vide)');
  }

  // ================================================================ 5 — l'exemple
  étape('Il charge l\'exemple : c\'est le premier contact avec une application PLEINE');
  await aller('#/dossiers', '#view');
  const bouton = await win.$('#demo-on');
  if (!bouton) throw new Error('la page Dossiers vide ne propose pas de charger un exemple');
  await win.click('#demo-on');
  await win.waitForTimeout(4000);
  await win.waitForSelector('table.list, .banner', { timeout: 20000 });
  await attendre(800);
  await mesurer('05-dossiers-exemple', 'Dossiers, avec l\'exemple');

  // ================================================================ 6 — toutes les pages, pleines
  étape('Toutes les pages, pleines');
  for (const p of menu) {
    await aller(p.hash, '#view');
    await mesurer('06-plein-' + p.hash.replace(/[#/]/g, ''), p.texte + ' (exemple)');
  }

  // ================================================================ 7 — la fiche d'un dossier
  étape('La fiche d\'un client, ses trois onglets');
  await aller('#/dossiers', 'table.list');
  // La ligne entière est cliquable (`tr.clickable`). On clique comme un comptable plutôt que de
  // fabriquer l'adresse : c'est le geste qui se teste, pas le routeur.
  const laLigne = await win.$('table.list tbody tr.clickable[data-id]');
  if (!laLigne) throw new Error('aucune ligne de dossier ne mène à sa fiche');
  await laLigne.click();
  await win.waitForSelector('#view', { timeout: 8000 });
  await attendre(700);
  const base = await win.evaluate(() => location.hash.replace(/\/(suivi|comptabilite|paquets)$/, ''));
  if (!/^#\/dossier\//.test(base)) throw new Error('cliquer une ligne n\'ouvre pas la fiche : ' + base);
  ok('la ligne ouvre ' + base);
  for (const onglet of ['suivi', 'comptabilite', 'paquets']) {
    await aller(base + '/' + onglet, '#view');
    await mesurer('07-fiche-' + onglet, 'fiche client, onglet ' + onglet);
  }

  // ================================================================ 8 — les Réglages, onglet par onglet
  étape('Les Réglages, onglet par onglet');
  await aller('#/reglages', '#set-tabs');
  const onglets = await win.evaluate(() => [...document.querySelectorAll('#set-tabs button')]
    .map(b => ({ tab: b.dataset.tab, t: (b.textContent || '').trim() })));
  mesures.onglets = onglets;
  for (const o of onglets) {
    await win.click(`#set-tabs button[data-tab="${o.tab}"]`);
    await attendre(500);
    await mesurer('08-reglages-' + o.tab, 'Réglages · ' + o.t);
  }

  // ================================================================ 9 — l'Aide
  étape('L\'Aide : le plan, puis un article');
  await aller('#/aide', '#view');
  await mesurer('09-aide-plan', 'Aide, le plan');
  // Les articles du plan sont de vrais `<button>` (donc atteignables au clavier), pas des liens :
  // on clique comme un comptable au lieu de fabriquer l'adresse.
  const carte = await win.$('#view button[data-art]');
  if (!carte) mesures.defauts.push('l\'Aide n\'offre aucun article cliquable depuis son plan');
  else {
    await carte.click();
    await attendre(600);
    await mesurer('09-aide-article', 'Aide, un article');
  }

  // ================================================================ 10 — la même chose en petit
  étape('Le même parcours sur un écran de portable (1280×800)');
  await win.setViewportSize({ width: 1280, height: 800 });
  await attendre(500);
  for (const p of menu) {
    await aller(p.hash, '#view');
    await mesurer('10-petit-' + p.hash.replace(/[#/]/g, ''), p.texte + ' à 1280');
  }

  // ================================================================ le rapport
  const tousChamps = mesures.ecrans.flatMap(e => e.champs);
  const sansBulle = tousChamps.filter(c => !c.bulle);
  // Une boîte de saisie sans étiquette, sans placeholder et sans `aria-label` : personne ne sait ce
  // qu'on y attend, et un lecteur d'écran non plus.
  const muets = mesures.ecrans.flatMap(e => e.libres
    .filter(c => !c.etiquette && !c.placeholder && !c.aria && c.type !== 'checkbox' && c.type !== 'radio')
    .map(c => e.nom + ' → ' + (c.nom || c.type)));
  const debordent = mesures.ecrans.flatMap(e => e.boutons.filter(b => b.deborde > 0).map(b => e.nom + ' → ' + b.texte + ' (+' + b.deborde + 'px)'));
  const invisibles = [...new Set(mesures.ecrans.flatMap(e => e.boutons.filter(b => !b.seVoit)
    .map(b => '« ' + b.texte.slice(0, 46) + ' » (' + (b.classe || 'sans classe') + ')')))];
  const videsSansGeste = mesures.ecrans.flatMap(e => e.vides.filter(v => !v.bouton).map(v => e.nom + ' → ' + v.texte));
  const debordements = mesures.ecrans.filter(e => e.deborde.length).map(e => e.nom + ' → ' + e.deborde.join(', '));
  const hautes = mesures.ecrans.filter(e => e.ecrans > 3).map(e => e.nom + ' (' + e.ecrans + ' écrans)');

  mesures.resume = {
    ecrans: mesures.ecrans.length,
    champs: tousChamps.length,
    champsSansBulle: [...new Set(sansBulle.map(c => c.nom + (c.etiquette ? ' « ' + c.etiquette + ' »' : '')))],
    champsMuets: [...new Set(muets)],
    boutonsHorsEcran: debordent,
    boutonsQuiNeRessemblentPasAUnBouton: invisibles,
    etatsVidesSansGeste: videsSansGeste,
    debordementsHorizontaux: debordements,
    pagesDePlusDeTroisEcrans: hautes,
    erreursJS: errors
  };
  fs.writeFileSync(path.join(OUT, 'mesures.json'), JSON.stringify(mesures, null, 2));

  console.log('\n---------------- ce que la mesure dit ----------------');
  console.log(`  ${mesures.ecrans.length} écrans photographiés, ${tousChamps.length} champs vus`);
  console.log(`  champs sans bulle « i »      : ${mesures.resume.champsSansBulle.length}`);
  console.log(`  champs sans la moindre étiq. : ${mesures.resume.champsMuets.length}`);
  console.log(`  boutons hors de l'écran      : ${debordent.length}`);
  console.log(`  boutons qui n'en ont pas l'air: ${invisibles.length}`);
  console.log(`  états vides sans geste       : ${videsSansGeste.length}`);
  console.log(`  débordements horizontaux     : ${debordements.length}`);
  console.log(`  pages de plus de 3 écrans    : ${hautes.length}`);
  console.log(`  erreurs JS                   : ${errors.length}`);
  console.log(`  → ${path.join(OUT, 'mesures.json')}`);

  await app.close();

  // ---------------------------------------------------------------- les règles, elles, tombent
  const casse = [];
  if (errors.length) casse.push('erreurs JS dans le renderer :\n    ' + errors.slice(0, 8).join('\n    '));
  // Un bouton hors de l'écran n'existe pas (7.13.0).
  if (debordent.length) casse.push('boutons hors de l\'écran :\n    ' + debordent.join('\n    '));
  // Un bouton sans bordure ni couleur n'est pas un bouton (Cabinet 1.0.0).
  if (invisibles.length) casse.push('boutons qui ressemblent à du texte :\n    ' + invisibles.join('\n    '));
  // Un état vide qui explique le geste en prose n'est pas une interface (7.0.0).
  if (videsSansGeste.length) casse.push('états vides sans aucun geste :\n    ' + videsSansGeste.join('\n    '));
  // Une page qui se fait défiler de côté a perdu une colonne, ou un bouton.
  if (debordements.length) casse.push('débordements horizontaux hors .scroll-x :\n    ' + debordements.join('\n    '));
  // Un champ qu'il faut deviner est un champ qu'on remplit de travers.
  if (sansBulle.length) casse.push('champs de saisie sans bulle « i » :\n    ' + mesures.resume.champsSansBulle.join('\n    '));
  if (muets.length) casse.push('champs sans étiquette ni placeholder :\n    ' + mesures.resume.champsMuets.join('\n    '));
  if (mesures.defauts.length) casse.push(mesures.defauts.join('\n    '));

  if (casse.length) {
    console.error('\n✗ LE PREMIER JOUR N\'EST PAS PROPRE :\n  - ' + casse.join('\n  - '));
    process.exit(1);
  }
  console.log(`\n${pas} étapes — LE PREMIER JOUR D'UN COMPTABLE : OK`);
})().catch(e => { console.error('\n✗ ' + (e && e.stack || e)); process.exit(1); });
