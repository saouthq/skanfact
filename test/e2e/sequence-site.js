// La SÉQUENCE du site : le parcours devis → facture → PDF, filmé dans la vraie application.
//
// Pourquoi des images et pas une vidéo : aucun encodeur n'est disponible ici, et une vidéo de
// 1,5 Mo pour montrer douze états d'un écran est de toute façon du gâchis. Le site rejoue ces
// images avec une légende par étape ; chacune est un ÉCRAN RÉEL, pas une maquette.
//
// Même règle que `captures-site.js` : le bandeau « jeu d'exemple » et le tampon EXEMPLE sont
// masqués — ils n'existent que parce que les données sont fictives, et les montrer donnerait
// une image fausse du produit dans l'autre sens.
//
//   xvfb-run -a node test/e2e/sequence-site.js [dossier de sortie]
const { playwright, RACINE, ELECTRON, journal, surveiller, dossierCaptures } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path');
const fs = require('fs');
const os = require('os');

// 1440 et non 1280 : avec la colonne d'aperçu ouverte, les colonnes QTÉ et P.U. HT de l'éditeur
// tombent à une trentaine de pixels et TRONQUENT leur contenu — « 12 » s'affiche « 1 », « 145 »
// s'affiche « 14 ». Sur un site, une image qui montre une quantité fausse à côté d'un total juste
// ne se rattrape par aucune légende. Constaté sur l'image, pas déduit.
const VUE = { width: 1440, height: 900 };
const QUALITE = 72;

const SANS_MARQUEURS = `
  .demo-banner { display: none !important; }
  .stamp { display: none !important; }
  #toast { display: none !important; }
  /* Le numéro de version se graverait dans des images qui vivront des mois : elles annonceraient
     une version périmée à côté de la page Téléchargement, qui, elle, est à jour. */
  #app-version { visibility: hidden !important; }
`;

(async () => {
  const j = journal();
  const bac = [];
  const sortie = process.argv[2] || dossierCaptures('sequence');
  fs.mkdirSync(sortie, { recursive: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-seq-'));

  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE],
    executablePath: ELECTRON,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  });
  const win = await app.firstWindow();
  surveiller(win, 'sequence', bac);
  await win.setViewportSize(VUE);

  let n = 0;
  const noms = [];
  // Une image de la séquence. Les marqueurs sont reposés AVANT chaque prise : un redessin de
  // route emporte la balise de style, et le bandeau reviendrait sur une image sur deux.
  async function image(nom, attente = 320) {
    await win.waitForTimeout(attente);
    await win.addStyleTag({ content: SANS_MARQUEURS });
    for (const f of win.frames()) await f.addStyleTag({ content: SANS_MARQUEURS }).catch(() => {});
    await win.waitForTimeout(120);
    const fichier = `seq-${String(++n).padStart(2, '0')}.jpg`;
    await win.screenshot({ path: path.join(sortie, fichier), type: 'jpeg', quality: QUALITE });
    noms.push(`${fichier}  ${nom}`);
    j.ok(`${fichier} — ${nom}`);
  }

  // Une fenêtre qui s'interpose (avertissement d'émission, confirmation) : on répond oui.
  async function passerQuestion() {
    const ok = await win.waitForSelector('#modal-root #ok, #modal-root .btn-primary', { timeout: 1200 }).catch(() => null);
    if (!ok) return false;
    await ok.click();
    await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
    return true;
  }

  // ---------------------------------------------------------------- l'assistant
  await win.waitForSelector('#setup');
  for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Ben Salah SUARL');
      await win.fill('#sf-form input[name=matricule]', '1234567X/A/M/000');
      await win.fill('#sf-form textarea[name=address]', 'Rue de Carthage\n2080 Ariana');
    }
    if (await win.$('[data-act="batiment"]')) {
      await win.click('[data-act="batiment"]');
      await win.waitForSelector('[data-act="batiment"].sel');
    }
    await win.click('#sf-next');
    await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));

  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForSelector('#load-demo');
  await win.click('#load-demo');
  await passerQuestion();
  await win.waitForFunction(() => location.hash === '#/dashboard');
  j.ok('jeu de démonstration chargé');

  // ---------------------------------------------------------------- 1. la liste des devis
  await win.evaluate(() => { location.hash = '#/devis'; });
  await win.waitForSelector('#view table.list tbody tr');
  await image('la liste des devis');

  // ---------------------------------------------------------------- 2. un devis neuf
  await win.click('#new');
  await win.waitForSelector('#f-head');
  await win.waitForSelector('#lines tr[data-i="0"]');
  await image('un devis neuf');

  // ---------------------------------------------------------------- 3. choisir le client
  await win.click('#f-head [data-combo=clientId] .combo-btn');
  await win.waitForSelector('#f-head [data-combo=clientId] .combo-pop:not([hidden])');
  await win.waitForSelector('#f-head [data-combo=clientId] .combo-list .combo-it');
  await image('le client se cherche au nom, au contact ou au matricule');

  const premier = await win.$('#f-head [data-combo=clientId] .combo-list .combo-it');
  if (!premier) throw new Error('aucun client dans la liste du combo');
  await premier.click();
  await win.waitForFunction(() =>
    document.querySelector('#f-head [data-combo=clientId] input[name=clientId]').value !== '');

  // ---------------------------------------------------------------- 4. la première ligne
  await win.fill('#lines tr[data-i="0"] input[data-k=label]', 'Pose de menuiserie aluminium');
  await win.fill('#lines tr[data-i="0"] input[data-k=qty]', '12');
  await win.fill('#lines tr[data-i="0"] input[data-k=unitPrice]', '145');
  await win.press('#lines tr[data-i="0"] input[data-k=unitPrice]', 'Tab');
  await image('une ligne, et le total suit la frappe', 700);

  // ---------------------------------------------------------------- 5. une deuxième ligne
  await win.click('#add-line');
  await win.waitForSelector('#lines tr[data-i="1"]');
  await win.fill('#lines tr[data-i="1"] input[data-k=label]', 'Déplacement et mise en service');
  await win.fill('#lines tr[data-i="1"] input[data-k=qty]', '1');
  await win.fill('#lines tr[data-i="1"] input[data-k=unitPrice]', '180');
  await win.press('#lines tr[data-i="1"] input[data-k=unitPrice]', 'Tab');
  await image('la TVA se ventile par taux, le document se dessine à droite', 900);

  // ---------------------------------------------------------------- 6. enregistrer
  await win.click('#save');
  await passerQuestion();
  await win.waitForFunction(() =>
    /DEV-\d{4}-\d+/.test(document.querySelector('#view h1') ? document.querySelector('#view h1').textContent : ''),
    null, { timeout: 6000 });
  await image('le devis est numéroté à l’enregistrement', 600);

  // ---------------------------------------------------------------- 7. facturer le devis
  // Sur un devis qui n'a pas encore reçu de réponse du client, « Facturer » est un menu : le bouton
  // coloré « Facturer ce devis » n'apparaît qu'une fois le devis accepté ou envoyé (7.16.0). On
  // passe donc par le menu, comme un utilisateur — c'est aussi lui qui montre l'acompte.
  await win.click('#bill-btn');
  await win.waitForSelector('#bill-list:not([hidden]) #convert');
  await image('facturer en totalité, ou n’émettre qu’un acompte');

  await win.click('#bill-list #convert');
  await passerQuestion();
  await win.waitForSelector('#issue', { timeout: 6000 });
  await image('la facture reprend le devis : client, lignes, taux, affaire', 800);

  // ---------------------------------------------------------------- 8. émettre
  await win.click('#issue');
  await passerQuestion();
  await win.waitForFunction(() =>
    /FAC-\d{4}-\d+/.test(document.querySelector('#view h1') ? document.querySelector('#view h1').textContent : ''),
    null, { timeout: 8000 });
  await image('émise : numérotée, verrouillée, le timbre posé', 800);

  // ---------------------------------------------------------------- 9. le document en grand
  // « Agrandir » (#pv-big), pas « Aperçu » (#pv-toggle) : le second ne fait que replier la colonne
  // de droite. Un sélecteur à plusieurs chances rend la PREMIÈRE du document, pas la bonne.
  const grand = await win.$('#pv-big');
  if (!grand) throw new Error('le bouton « Agrandir » est absent de la facture émise');
  await grand.click();
  await win.waitForSelector('#pv-full-frame', { timeout: 5000 });
  await image('le document tel que le client le recevra', 1200);

  await app.close();
  fs.writeFileSync(path.join(sortie, 'sequence.txt'), noms.join('\n') + '\n');
  if (bac.length) { console.error('\nERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  console.log(`\n>>> SÉQUENCE OK — ${n} images dans ${sortie}\n` + noms.join('\n'));
  process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
