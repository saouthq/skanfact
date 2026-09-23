// Les barres d'actions mesurées (7.23.1).
//
// Signalé sur la page Statistiques : les trois sélecteurs — période, année, mois — s'empilaient sur
// trois rangées, étirés d'un bord à l'autre de l'écran. L'en-tête occupait un tiers de la page.
//
// La cause n'est pas dans le HTML : c'est la règle générale des champs de formulaire,
// `select { width: 100% }`. Dans une barre d'actions — un conteneur FLEX — chaque `select` réclame
// donc toute la ligne, et le voisin passe en dessous. `.filters` avait son `width: auto` depuis
// longtemps ; les barres d'actions ne l'avaient jamais eu.
//
// Comme pour les colonnes, ça ne se voit pas en relisant le code : **on mesure**.
//
//   xvfb-run -a node test/e2e/entetes.js
const { playwright, RACINE, ELECTRON, journal, surveiller, SONDE_ENTETES } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

// Toutes les pages, y compris celles qui n'ont pas de contrôle dans leur en-tête : une page qui en
// gagne un demain sera mesurée sans que personne ait à y penser.
const PAGES = ['#/dashboard', '#/devis', '#/factures', '#/relances', '#/clients', '#/catalogue',
  '#/autres', '#/contrats', '#/achats', '#/fournisseurs', '#/stock', '#/garanties', '#/immos',
  '#/tresorerie', '#/marges', '#/stats', '#/paie', '#/compta', '#/modules', '#/parametres', '#/aide'];

// Un sélecteur de période, c'est ~200 px. À 280 on laisse de la marge pour un libellé long
// (« 1ᵉʳ trimestre · janv.–mars ») ; au-delà, le contrôle est étiré, pas large.
const LARGEUR_MAX = 300;
// Un champ de RECHERCHE n'est pas un sélecteur : on y tape des mots, et 300 px coupent l'indice de
// ce qu'on peut chercher au milieu d'un mot. Il a sa propre borne — assez large pour être utile,
// assez étroite pour qu'un champ étiré d'un bord à l'autre reste un défaut.
const LARGEUR_MAX_RECHERCHE = 400;
// Une barre d'actions tient sur une rangée, deux au pire quand elle porte neuf commandes à 1280 px.
// Trois rangées, c'est le défaut qu'on cherche.
const HAUTEUR_MAX = 100;
// La recherche d'une barre de filtres est souple (260 à 440 px) : au-delà, elle a pris la ligne.
const LARGEUR_MAX_RECHERCHE_FILTRE = 460;

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-entetes-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  await win.setViewportSize({ width: 1440, height: 900 });
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(300); };

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Entêtes SUARL');
      await win.fill('#sf-form input[name=matricule]', '4455667E/A/M/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await aller('#/parametres');
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner');
  j.ok('prêt — les pages ont des années et des périodes à proposer');

  let controles = 0, filtres = 0; const fautes = [];
  for (const hash of PAGES) {
    await aller(hash);
    // La sonde vit dans `harnais.js` depuis la 9.4.3, partagée avec le Cabinet.
    const r = await win.evaluate(SONDE_ENTETES, { maxL: LARGEUR_MAX, maxR: LARGEUR_MAX_RECHERCHE, maxH: HAUTEUR_MAX });
    controles += r.n;
    r.larges.forEach(x => fautes.push(`${hash} — ${x.tag} « ${x.id} » fait ${x.w} px (borne ${x.borne}) : il est étiré, pas large`));
    if (r.n && r.hauteur > HAUTEUR_MAX) {
      fautes.push(`${hash} — la barre d'actions fait ${r.hauteur} px de haut : ses contrôles s'empilent`);
    }
    // 10.12.0 — les barres de FILTRES aussi. Leur recherche devait faire 300 px et prenait toute la
    // ligne (la règle générale des champs gagnait) : filtres, bulle et compteur passaient sur une
    // seconde rangée au-dessus de chaque liste. Aucune mesure ne regardait ces barres-là. On n'y
    // juge que la largeur : un filtre actif allonge légitimement la barre de son compteur.
    const f = await win.evaluate(SONDE_ENTETES, { maxL: LARGEUR_MAX, maxR: LARGEUR_MAX_RECHERCHE_FILTRE, maxH: 9999,
      barres: '#view .filters', recherche: '#q, .q, [type=search]' });
    controles += f.n; filtres += f.n;
    f.larges.forEach(x => fautes.push(`${hash} — filtre ${x.tag} « ${x.id} » fait ${x.w} px (borne ${x.borne}) : il prend toute la ligne`));
  }
  j.etape(`${PAGES.length} en-têtes mesurés`);
  j.ok(`${controles} contrôle(s) dans les barres d'actions et de filtres, dont ${filtres} dans les filtres`);
  if (!filtres) { console.error('\nAucune barre de filtres mesurée : la seconde moitié du test ne prouve rien.'); process.exit(2); }

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  if (!controles) { console.error('\nAucun contrôle mesuré : le test ne prouve rien.'); process.exit(2); }
  if (fautes.length) {
    console.error(`\n${fautes.length} défaut(s) de mise en page :\n  ` + fautes.join('\n  '));
    process.exit(1);
  }
  console.log(`\n${controles} contrôles mesurés sur ${PAGES.length} en-têtes — aucun étiré, aucune barre empilée.`);
})().catch(e => { console.error(e); process.exit(1); });
