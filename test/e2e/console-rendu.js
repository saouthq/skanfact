// La console de l'éditeur — LE RENDU, MESURÉ.
//
// Pourquoi ce parcours existe, et pourquoi il est le troisième du même genre : l'app entreprise a
// été tenue par quatre instruments de mesure à partir de la 7.12.0, l'app Cabinet ne les a reçus
// qu'en 9.4.3 — et elle avait dérivé exactement là où personne ne mesurait (six onglets qui ne
// montraient pas lequel était ouvert pendant trois versions, huit champs sans étiquette, aucun
// thème sombre). La console est la TROISIÈME surface du produit, et elle n'a jamais été mesurée
// une seule fois. C'est la règle 9.4.3 d'un cran plus haut : un instrument qui ne couvre que deux
// des trois surfaces n'en protège que deux.
//
// Les sondes sont celles des deux applications, en un seul exemplaire dans `harnais.js` — un
// mécanisme recopié diverge toujours (7.29.0), et c'est précisément la faute que ce parcours
// répare. Deux d'entre elles étaient bornées à `#view`, le cadre des applications ; elles prennent
// désormais leur racine en argument. La console n'a pas de `#view` : sans ce paramètre, elles
// auraient mesuré ZÉRO bouton et annoncé que tout va bien (T-55 — un instrument qui n'atteint pas
// l'écran est pire qu'un instrument absent).
//
// Le serveur n'est PAS une imitation : c'est `plateforme/skanfact-api.mjs`, le fichier déployé sur
// Cloudflare, posé derrière un `http.createServer` avec une vraie base SQLite sur le vrai schéma —
// partagé avec `e2e:console` (`console-serveur.js`).
//
// Ce qu'il mesure, sur les HUIT onglets et les deux formulaires, en clair ET en sombre, à 1440 et
// à 1280 :
//   1. aucun bouton illisible (contraste texte/fond sous 2,0) ni coupé par le bord de la fenêtre
//   2. aucun en-tête de colonne aligné autrement que ses valeurs
//   3. aucun contrôle de barre d'actions étiré, aucune barre empilée sur trois rangées
//   4. aucun bouton collé à ce qui le touche
//
//   npm run e2e:console-rendu

const { playwright, ouvrirChromium, journal, dossierCaptures,
  SONDE_BOUTONS, SONDE_COLONNES, SONDE_ENTETES, SONDE_ESPACEMENT } = require('./harnais');
const { servir, SECRET } = require('./console-serveur');
const path = require('path');

const SEUIL = 2.0;                       // le seuil de contraste : il n'est pas esthétique, il attrape l'illisible
const LARGEUR_MAX = 300, LARGEUR_MAX_RECHERCHE = 400, HAUTEUR_MAX = 100;

// L'écart minimum entre un bouton et ce qui le touche : QUATRE pixels, la même ligne que les deux
// applications, et pour la même raison — au-dessus, l'espace vient d'un `gap` DÉCIDÉ en CSS ; en
// dessous, il ne vient de nulle part (9.8.3).
const ECART_MIN = 4;
// Les exceptions, NOMMÉES — une exception anonyme est un trou (9.4.10). `.tabs` est un contrôle
// segmenté : ses boutons se touchent par construction, et l'onglet actif se reconnaît à sa pastille
// pleine, pas à son écart. `td.acts` porte déjà sa propre marge (`margin:2px 4px 2px 0`), décidée
// en CSS comme le `gap` d'un conteneur flex.
const SEGMENTS = ['.tabs', 'td.acts'];

// Les huit onglets, dans l'ordre où la console les range. Le parcours REFUSE un onglet vide : un
// tableau sans lignes n'a pas de colonnes à comparer, et un instrument qui mesure le vide annonce
// que tout va bien. C'est la leçon T-55, appliquée d'avance.
const ONGLETS = ['alertes', 'licences', 'ventes', 'parc', 'cabinets', 'activations', 'clients', 'evenements'];

// Ce qu'un onglet DOIT contenir après le garnissage. « Le premier venu » ne suffit pas : c'est
// exactement ce qui a fait mesurer quatre écrans sur onze au Cabinet pendant six versions.
const APP_SECRET = 'secret-de-test-' + 'x'.repeat(20);

(async () => {
  const j = journal();
  const fautes = [];
  // Ce qui n'est pas un défaut au sens des sondes, mais que la refonte doit savoir : la densité.
  const densite = [];
  const flottaison = [];
  const repetitions = {};
  const { srv, base, restaurer } = await servir();
  const nav = await ouvrirChromium(playwright());
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Toute exception de la page fait échouer le parcours : une ReferenceError pendant la
  // construction d'un gabarit laisse un écran blanc et une console vide chez l'utilisateur
  // (7.20.0, 7.22.0, 7.23.0). Les ressources refusées, elles, sont le bruit normal d'un favicon.
  const bac = [];
  page.on('pageerror', e => bac.push('exception : ' + (e && e.message)));
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) bac.push(m.text());
  });

  const admin = (chemin, corps) => fetch(base + '/v1/admin/' + chemin, {
    method: corps ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-SkanFact-Admin': SECRET },
    body: corps ? JSON.stringify(corps) : undefined
  }).then(async r => { const t = await r.json(); if (!r.ok) throw new Error(chemin + ' → ' + (t.erreur || r.status)); return t; });

  const annonce = (app, version, poste, nom) => fetch(base + '/v1/licence/etat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SkanFact-App': APP_SECRET },
    body: JSON.stringify({ deviceId: poste, deviceNom: nom, plateforme: 'darwin', version, app })
  });

  let boutons = 0, colonnes = 0, controles = 0, ecarts = 0;

  // Les quatre sondes sur l'écran courant. `ou` nomme l'endroit ET le contexte (largeur, thème) :
  // une faute qui n'existe qu'en sombre à 1280 doit se lire comme telle, sinon on la cherche à
  // l'endroit où elle ne se produit pas.
  const mesurer = async ou => {
    const bs = await page.evaluate(SONDE_BOUTONS);
    boutons += bs.length;
    bs.filter(b => b.ratio < SEUIL).forEach(b =>
      fautes.push(`${ou} → « ${b.texte} » (${b.id || b.cls}) : contraste ${b.ratio} — ${b.color} sur ${b.bg}`));
    // Un bouton qui dépasse DANS un conteneur qui défile n'est pas hors de l'écran, il est à une
    // molette : le projet l'a tranché en 7.13.0 et re-tranché en 9.4.4, et l'accuser reviendrait à
    // accuser du code juste. Mais ce n'est pas rien pour autant — un geste qu'on doit aller
    // chercher de côté est un geste qu'on ne fait pas. On le COMPTE, sans en faire un échec, et
    // c'est ce chiffre-là que la refonte devra faire tomber.
    bs.filter(b => b.hors > 2 && !b.defilant).forEach(b =>
      fautes.push(`${ou} → « ${b.texte} » (${b.id || b.cls}) dépasse de ${b.hors} px hors de la fenêtre`));
    bs.filter(b => b.hors > 2 && b.defilant).forEach(b =>
      densite.push(`${ou} → « ${b.texte} » n'est atteignable qu'en faisant défiler le tableau de ${b.hors} px`));

    const c = await page.evaluate(SONDE_COLONNES);
    colonnes += c.colonnes;
    c.ecarts.forEach(e => fautes.push(`${ou} — colonne « ${e.colonne} » : en-tête ${e.entete}, valeurs ${e.cellules}`));

    const e = await page.evaluate(SONDE_ESPACEMENT, { min: ECART_MIN, exceptions: SEGMENTS, racine: 'body' });
    ecarts += e.mesures;
    e.colles.forEach(x => fautes.push(`${ou} — « ${x.bouton} » touche « ${x.voisin} » (${x.cote},`
      + ` ${x.sens}) : ${x.ecart} px, minimum ${ECART_MIN}`));

    // La sonde juge une BARRE D'ACTIONS — un conteneur flex où chaque contrôle réclame toute la
    // ligne (7.23.0). Elle ne juge PAS un formulaire : un champ de `#form .grid` est censé remplir
    // sa colonne, c'est ce qu'une grille de saisie fait. Ma première version la braquait sur les
    // deux, et elle a porté soixante accusations sur du code parfaitement juste — un test trop
    // large accuse du code juste, aussi sûrement qu'un test trop étroit laisse passer le défaut
    // (9.1.0, 9.4.7).
    const h = await page.evaluate(SONDE_ENTETES,
      { maxL: LARGEUR_MAX, maxR: LARGEUR_MAX_RECHERCHE, maxH: HAUTEUR_MAX, barres: 'main .bar' });
    controles += h.n;
    h.larges.forEach(x => fautes.push(`${ou} — ${x.tag} « ${x.id} » fait ${x.w} px (borne ${x.borne}) : il est étiré, pas large`));
    if (h.n && h.hauteur > HAUTEUR_MAX) {
      fautes.push(`${ou} — la barre d'actions fait ${h.hauteur} px de haut : ses contrôles s'empilent`);
    }
  };

  // Deux mesures que les quatre sondes ne portent pas, et qui sont celles dont la refonte parle.
  // Elles ne font pas échouer le parcours aujourd'hui : ce sont des CONSTATS, pas des régressions,
  // et un instrument rouge en permanence cesse d'être lu (9.1.0). Elles deviennent des garde-fous
  // le jour où la refonte les fait tomber — pas avant, sinon on grave l'état du jour (7.12.0).
  const mesurerDensite = async ou => {
    const d = await page.evaluate(() => {
      const out = {};
      // 1. La ligne de flottaison (9.4.4) : sur un portable, à quelle hauteur commence le PRODUIT ?
      //    Sur la page Dossiers du Cabinet, quatre cartes, un panneau et deux barres repoussaient
      //    la liste des clients à 800 px — le bas de l'écran. Ici, c'est le tableau qui est le
      //    produit : tout ce qui passe devant lui se paie.
      const th = document.querySelector('#table thead');
      out.flottaison = th ? Math.round(th.getBoundingClientRect().top) : null;
      // 2. La répétition (9.4.6) : une explication se lit UNE fois. Quand le `detail` décrit la
      //    RÈGLE et non l'occurrence, la même phrase s'imprime sur chaque ligne de même nature —
      //    et à la troisième, la colonne n'est plus lue du tout.
      //    La colonne visée est NOMMÉE, jamais devinée. Ma première version jugeait toute colonne
      //    dont le texte dépasse 25 caractères, et elle a accusé « aujourd'hui 22/09/2026 à 10:50 »
      //    répété sur deux postes vus à la même minute : ce n'est pas une explication redite, c'est
      //    un FAIT, et deux ordinateurs ont le droit d'avoir été ouverts en même temps. Un test
      //    trop large accuse du code juste, aussi sûrement qu'un test trop étroit laisse passer le
      //    défaut (9.4.7, 9.8.8). Une colonne qui EXPLIQUE, elle, n'a aucune raison de se répéter.
      const EXPLICATIVES = ['Pourquoi ça compte'];
      const cols = [...document.querySelectorAll('#table thead th')].map(x => x.textContent.trim());
      out.repetitions = [];
      cols.forEach((titre, i) => {
        if (!EXPLICATIVES.includes(titre)) return;
        const vus = {};
        document.querySelectorAll('#table tbody tr').forEach(tr => {
          const td = tr.children[i];
          const t = td ? (td.textContent || '').trim() : '';
          if (t) vus[t] = (vus[t] || 0) + 1;
        });
        Object.keys(vus).filter(t => vus[t] > 1)
          .forEach(t => out.repetitions.push({ colonne: titre, n: vus[t], phrase: t.slice(0, 48) }));
      });
      return out;
    });
    if (d.flottaison != null) flottaison.push({ ou, y: d.flottaison });
    // On garde le PIRE compte par phrase, pas une ligne par passe : chaque passe émet une licence
    // de plus (le panneau de résultat n'existe qu'après une émission), donc le même constat
    // remonterait quatre fois avec quatre chiffres différents — et on lirait une aggravation là où
    // il n'y a qu'un instrument qui garnit sa base.
    d.repetitions.forEach(r => {
      const cle = r.colonne + ' | ' + r.phrase;
      if (!repetitions[cle] || repetitions[cle] < r.n) repetitions[cle] = r.n;
    });
  };

  const onglet = async nom => {
    await page.click('#tabs button[data-t="' + nom + '"]');
    await page.waitForFunction(n => {
      const b = document.querySelector('#tabs button[data-t="' + n + '"]');
      return b && b.getAttribute('aria-selected') === 'true';
    }, nom);
    await page.waitForSelector('#table .wrap, #table .vide');
    await page.waitForTimeout(160);
  };

  const parcourir = async etiquette => {
    for (const t of ONGLETS) {
      await onglet(t);
      const lignes = await page.$$eval('#table tbody tr', ls => ls.length).catch(() => 0);
      if (!lignes) throw new Error(`l'onglet « ${t} » est vide : sans lignes, ses colonnes ne sont pas mesurées`
        + ' et l\'instrument annoncerait que tout va bien');
      await mesurer(`${etiquette} · ${t}`);
      await mesurerDensite(`${etiquette} · ${t}`);
    }
    // Les deux formulaires : ce sont les seuls écrans de SAISIE de la console, et c'est là que les
    // champs vivent. Un parcours qui ne fait que lire des tableaux ne les verrait jamais.
    for (const [bouton, nom] of [['#emettre', 'émettre'], ['#nouveau-client', 'client']]) {
      await page.click(bouton);
      await page.waitForSelector('#form:not([hidden])');
      await page.waitForTimeout(220);
      await mesurer(`${etiquette} · formulaire ${nom}`);
      // On referme par le VRAI bouton. Ma première version visait `#f-annuler, #f-fermer` — deux
      // identifiants qui n'existent pas — sous un `.catch(() => {})`, puis posait `hidden` à la
      // main quand le clic avait échoué. Deux fautes d'un coup : un refus avalé en silence (9.8.0),
      // qui coûtait trente secondes d'attente Playwright par formulaire et par passe, et un e2e qui
      // rejoue le code qu'il teste au lieu de passer par l'écran (6.8.1). Sans `.catch` : si le
      // bouton change de nom, le parcours TOMBE, et c'est ce qu'on veut.
      await page.click('#f-non');
      await page.waitForFunction(() => document.getElementById('form').hidden, null, { timeout: 5000 });
    }
    // Le panneau de résultat : l'écran que l'éditeur voit à CHAQUE vente, celui qui porte la clé.
    // Il n'existe qu'après une émission réussie — donc on émet, pour de vrai, par le formulaire.
    // Un instrument qui s'arrête aux écrans qu'une adresse ouvre ne verrait jamais celui-là (T-55).
    await page.click('#emettre');
    await page.waitForSelector('#form:not([hidden]) [name=clientId]');
    await page.selectOption('#form [name=offre]', 'independant');
    await page.click('#f-ok');
    await page.waitForSelector('#resultat:not([hidden]) #cle', { timeout: 15000 });
    await page.waitForTimeout(260);
    await mesurer(`${etiquette} · la clé émise`);
    await page.click('#cle-fermer');
    await page.waitForTimeout(200);
  };

  try {
    // ---------------------------------------------------------------- garnir, par la VRAIE porte
    j.etape('Garnir la base par les vraies routes d\'administration');
    // Jamais un INSERT écrit à la main : les lignes doivent être celles que le worker écrit, sinon
    // l'instrument mesure un écran nourri de données qui n'existent pas en production.
    const c1 = (await admin('clients', { nom: 'Trabelsi Informatique', matricule: '1234567A',
      email: 'contact@trabelsi.tn', tel: '+216 71 000 000' })).client;
    const c2 = (await admin('clients', { nom: 'El Amen Services', matricule: '7654321B',
      email: 'gerant@elamen.tn' })).client;
    const c3 = (await admin('clients', { nom: 'Cabinet Ben Youssef', matricule: '5551234C',
      email: 'compta@benyoussef.tn' })).client;
    // Trois ventes dans trois états : une payée (donc envoyée), une qui attend son paiement, une
    // révoquée. Sans les trois, la colonne « État » n'a qu'une valeur et l'onglet « À décider » est
    // vide — c'est-à-dire que rien ne serait mesuré là où tout commence.
    const l1 = (await admin('licences', { clientId: c1.id, offre: 'entreprise', duree: '1a',
      prix: 690, devise: 'TND', payeeLe: '2026-09-01', moyen: 'virement' })).licence;
    await admin('licences', { clientId: c2.id, offre: 'independant', duree: '1a', prix: 390, devise: 'TND' });
    await admin('licences', { clientId: c3.id, type: 'cabinet', duree: '1a', prix: 0,
      cabinet: '3f9a2c1e88b7d4056a12', dossiersHors: 10 });
    await admin('licences/' + l1.id + '/revoquer', { motif: 'rétractation sous quatorze jours' });
    // Le parc : les DEUX applications s'annoncent. C'est la moitié que la console ne voyait pas
    // avant la 10.4.0, et un instrument qui ne la garnit pas ne la mesurerait pas non plus.
    await annonce('entreprise', '10.4.0', 'poste-entreprise-A', 'MacBook de Skander');
    await annonce('cabinet', '10.4.0', 'poste-cabinet-B', 'PC du cabinet');
    await annonce('entreprise', '10.0.1', 'poste-entreprise-C', 'iMac du bureau');
    j.ok('3 clients, 3 licences (dont une révoquée et un cabinet), 3 postes');

    // ---------------------------------------------------------------- ouvrir
    j.etape('Ouvrir la console');
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#lock', { state: 'visible' });
    await mesurer('clair 1440 · verrou');
    await page.fill('#sec', SECRET);
    await page.press('#sec', 'Enter');
    await page.waitForSelector('#app', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#tabs button');
    await page.waitForTimeout(400);
    const n = await page.$$eval('#tabs button', bs => bs.length);
    if (n !== ONGLETS.length) throw new Error(`la console offre ${n} onglets et le parcours en connaît `
      + `${ONGLETS.length} : un onglet neuf ne serait mesuré par personne`);
    j.ok(`la console s'ouvre sur ses ${n} onglets`);

    // ---------------------------------------------------------------- les quatre passes
    const OUT = dossierCaptures('console-rendu');
    const capturer = async nom => page.screenshot({ path: path.join(OUT, nom + '.png'), fullPage: true });

    j.etape('Les huit onglets et les deux formulaires, en clair, à 1440');
    await parcourir('clair 1440');
    await onglet('alertes'); await capturer('clair-alertes');
    await onglet('licences'); await capturer('clair-licences');
    j.ok(`${boutons} boutons, ${colonnes} colonnes, ${controles} contrôles, ${ecarts} écarts`);

    j.etape('Les mêmes, en thème SOMBRE');
    // Le thème de la console suit le système (`prefers-color-scheme`) : elle n'a pas de réglage, et
    // c'est ce chemin-là qu'il faut emprunter. Un test qui poserait une classe à la main prouverait
    // la feuille de style et pas ce qu'un éditeur voit sur son Mac en soirée.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(300);
    const sombre = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (/255,\s*255,\s*255/.test(sombre) || /245,\s*247/.test(sombre)) {
      throw new Error('le thème sombre ne s\'applique pas (fond ' + sombre + ') : rien ne serait mesuré en sombre');
    }
    const avant = boutons;
    await parcourir('sombre 1440');
    if (boutons === avant) throw new Error('aucun bouton mesuré en sombre : le parcours ne prouve rien');
    await onglet('alertes'); await capturer('sombre-alertes');
    await onglet('parc'); await capturer('sombre-parc');
    j.ok(`${boutons - avant} boutons mesurés en sombre (fond ${sombre})`);

    j.etape('Les mêmes, sur un portable de 1280 px');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    await parcourir('sombre 1280');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(300);
    await parcourir('clair 1280');
    await onglet('alertes'); await capturer('clair-1280-alertes');
    j.ok('mesuré aux deux largeurs');
  } finally {
    await nav.close().catch(() => {});
    srv.close();
    restaurer();
  }

  if (bac.length) { console.error('\nErreurs de la page :\n' + bac.join('\n')); process.exit(2); }
  // Un instrument qui ne mesure rien annonce « tout va bien » : il doit échouer, pas se taire.
  if (!boutons || !colonnes || !ecarts) { console.error('\nRien n\'a été mesuré : le parcours ne prouve rien.'); process.exit(2); }
  const f1280 = flottaison.filter(x => / 1280 /.test(x.ou));
  if (f1280.length) {
    const pire = f1280.reduce((a, b) => (b.y > a.y ? b : a));
    console.log(`\nLigne de flottaison à 1280×800 — le tableau commence au plus bas à ${pire.y} px`
      + ` (${pire.ou}) : tout ce qui passe devant le produit se paie (9.4.4).`);
  }
  Object.keys(repetitions).sort().forEach(cle => densite.push(
    `la colonne « ${cle.split(' | ')[0]} » imprime jusqu'à ${repetitions[cle]} fois`
    + ` « ${cle.split(' | ')[1]}… » : une explication se lit une fois (9.4.6)`));
  if (densite.length) {
    const d = [...new Set(densite)];
    console.log(`\nDensité — ${d.length} constat(s) :\n  ` + d.join('\n  '));
  }
  if (fautes.length) {
    const u = [...new Set(fautes)];
    console.error(`\n${u.length} défaut(s) de rendu dans la console :\n  ` + u.join('\n  '));
    process.exit(1);
  }
  // `controles` vaut 0 aujourd'hui, et c'est la vérité : aucune barre d'actions de la console ne
  // porte de champ — ni recherche, ni filtre, ni sélecteur de période. La sonde reste branchée
  // parce que c'est exactement ce que la refonte va ajouter, et qu'un `select` posé dans un
  // conteneur flex réclame toute la ligne sans qu'on le voie (7.23.0). On l'ÉCRIT plutôt que de
  // laisser un zéro passer pour une mesure.
  console.log(`\n${j.total()} étapes — ${boutons} boutons, ${colonnes} colonnes, ${ecarts} écarts`
    + ` mesurés sur les huit onglets, les deux formulaires et la clé émise, en clair et en sombre,`
    + ' à 1440 et à 1280 : rien d\'illisible, rien de désaligné, rien de collé.'
    + `\n${controles} champ(s) dans une barre d'actions`
    + (controles ? ', aucun étiré.' : ' : la console n\'en a aucun aujourd\'hui — la sonde attend la refonte.'));
})().catch(e => { console.error(e); process.exit(1); });
