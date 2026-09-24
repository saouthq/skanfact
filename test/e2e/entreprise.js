// Test de bout en bout : lance l'app Electron réelle et parcourt les écrans.
const { fermer, playwright, RACINE, ELECTRON, VERSION } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path');
const fs = require('fs');
const os = require('os');

const root = RACINE;
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-e2e-'));
// Depuis la 3.2.0, chaque dossier (= une entreprise) a son propre emplacement sous userData/dossiers/.
const dossierDir = () => path.join(userData, 'dossiers', 'principal');
const dataFileOf = () => path.join(dossierDir(), 'skanfact-data.json');

(async () => {
  const errors = [];
  // SKANFACT_BIN=chemin de l'exécutable empaqueté (dist/linux-unpacked/skanfact) → test de l'app installée
  const packaged = process.env.SKANFACT_BIN;
  console.log(packaged ? 'mode : app empaquetée ' + packaged : 'mode : développement');
  const app = await electron.launch({
    args: packaged ? ['--no-sandbox', `--user-data-dir=${userData}`] : ['--no-sandbox', `--user-data-dir=${userData}`, root],
    executablePath: packaged || ELECTRON,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  });
  app.process().stderr.on('data', d => { const s = d.toString(); if (/Uncaught|TypeError|ReferenceError|SyntaxError/.test(s)) errors.push(s.trim()); });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push('pageerror: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const step = async (name, fn) => { await fn(); console.log('ok -', name); };

  await step('première utilisation : l\'assistant se déroule et remplit la société', async () => {
    await win.waitForSelector('#setup');
    if (!(await win.textContent('.setup-t')).includes('Bienvenue')) throw new Error('premier écran');
    await win.click('#sf-next');                                          // → entreprise
    await win.waitForSelector('#sf-form input[name=name]');
    await win.click('#sf-next');                                          // refusé : pas de raison sociale
    await win.waitForSelector('#toast.show.error');
    await win.fill('#sf-form input[name=name]', 'Menuiserie Test SUARL');
    await win.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
    await win.fill('#sf-form textarea[name=address]', 'Rue des Oliviers\n2000 Tunis');
    await win.click('#sf-next');                                          // → activité
    await win.waitForSelector('[data-act="batiment"]');
    await win.click('[data-act="batiment"]');
    await win.waitForSelector('[data-act="batiment"].sel');
    await win.click('#sf-next');                                          // → modules
    // L'écran ajouté en 7.2.0 : le tri des modules existait depuis la 7.0.0 et rien ne l'armait.
    await win.waitForSelector('#sf-mods');
    if (!(await win.$('#sf-mods input[data-sfmod="pieces"]:checked'))) {
      throw new Error('le bâtiment signe des devis et des bons : « pieces » devrait être proposé coché');
    }
    if (await win.$('#sf-mods input[data-sfmod="paie"]:checked')) {
      throw new Error('la Paie ne devrait pas être cochée d\'office pour un artisan sans salarié');
    }
    await win.click('#sf-next');                                          // → facturation
    await win.waitForSelector('#sf-form input[name=paymentTermsDays]');
    await win.fill('#sf-form input[name=paymentTermsDays]', '45');
    await win.click('#sf-next');                                          // → paiement
    await win.waitForSelector('#sf-form input[name=rib]');
    await win.fill('#sf-form input[name=bank]', 'BIAT');
    await win.fill('#sf-form input[name=rib]', '00 006 0000123456789 01');
    await win.click('#sf-next');                                          // → sauvegarde
    await win.waitForSelector('#sf-ext');
    await win.click('#sf-next');                                          // terminer
    await win.waitForFunction(() => !document.querySelector('#setup'));
    const brand = await win.textContent('#brand-company'); if (!brand.includes('Menuiserie')) throw new Error('marque : ' + brand);
    const d = JSON.parse(fs.readFileSync(dataFileOf(), 'utf8'));
    if (d.company.name !== 'Menuiserie Test SUARL' || d.company.paymentTermsDays !== 45) throw new Error(JSON.stringify(d.company).slice(0, 200));
    if (!d.catalog.length) throw new Error('catalogue du secteur non prérempli');
    if (!d.company.setupDone) throw new Error('setupDone');
  });
  await win.waitForSelector('#view h1');
  // Paramètres : ouvrir un onglet (1.8.0)
  const setTab = async (id) => { await win.waitForSelector('#set-tabs'); await win.click(`#set-tabs button[data-tab="${id}"]`); await win.waitForFunction(t => { const p = document.querySelector(`[data-pane="${t}"]`); return p && !p.hidden; }, id); };

  await step('dashboard affiché', async () => { if ((await win.textContent('#view h1')) !== 'Accueil') throw new Error('titre'); });
  await step('version affichée', async () => { const v = await win.textContent('#app-version'); if (v !== 'v' + VERSION) throw new Error(`version affichée ${v}, attendue v${VERSION}`); });
  await step('une liste vide n\'a qu\'un bouton principal : celui de son état vide', async () => {
    // 10.12.0 — « + Nouveau client » restait vert dans l'en-tête au-dessus de « + Ajouter mon premier
    // client », vert lui aussi : deux boutons principaux pour le même geste (U-11). On compte ce qui
    // est VISIBLE et allumé, sur chaque liste encore vide juste après l'assistant.
    const fautes = [];
    for (const [hash, etatVide] of [['#/devis', 1], ['#/factures', 1], ['#/clients', 1], ['#/fournisseurs', 1], ['#/achats', 1],
      ['#/autres/proforma', 1], ['#/contrats', 1], ['#/relances', 1], ['#/immos', 0],
      // La Paie et la Trésorerie posent un panneau écrit à la main plutôt qu'un `.vide-utile` : la
      // Paie y gardait deux verts (« + Salarié » en tête, « + Créer mon premier salarié » dessous).
      ['#/paie', 0], ['#/tresorerie', 0]]) {
      await win.evaluate(x => { location.hash = x; }, hash);
      await win.waitForTimeout(300);
      const r = await win.evaluate(() => ({
        verts: [...document.querySelectorAll('#view .btn-primary')].filter(b => b.offsetParent && !b.disabled).map(b => b.id || b.textContent.trim()),
        vide: !!document.querySelector('#view .vide-utile')
      }));
      if (etatVide && !r.vide) fautes.push(`${hash} : l'état vide n'est pas affiché`);
      if (r.verts.length > 1) fautes.push(`${hash} : ${r.verts.length} boutons principaux (${r.verts.join(', ')})`);
    }
    if (fautes.length) throw new Error(fautes.join(' · '));
    // 10.12.0 — un bouton ne se propose que s'il a de quoi agir : sur une entreprise sans facture,
    // « Partir d'une facture existante » acceptait le clic pour répondre qu'il n'y en avait pas
    // (le jumeau « Partir d'un devis existant » ne se montre qu'avec un devis, H-E30).
    await win.evaluate(() => { location.hash = '#/contrats'; });
    await win.waitForSelector('#rec-first');
    if (await win.$('#rec-depuis')) throw new Error('« Partir d\'une facture existante » est proposé à une entreprise qui n\'a aucune facture');
    await win.evaluate(() => { location.hash = '#/dashboard'; });
  });
  await step('menu : nouveau devis', async () => {
    await app.evaluate(({ Menu }) => {
      const find = (items, label) => { for (const i of items) { if (i.label === label) return i; if (i.submenu) { const r = find(i.submenu.items, label); if (r) return r; } } };
      find(Menu.getApplicationMenu().items, 'Nouveau devis').click();
    });
    await win.waitForSelector('#f-head');
    if (!(await win.textContent('#view h1')).includes('Nouveau devis')) throw new Error('éditeur');
  });
  await step('validation sans client', async () => { await win.click('#save'); await win.waitForSelector('#toast.show.error'); });
  await step('client rapide + ligne + enregistrer', async () => {
    await win.click('#f-head [data-combo=clientId] .combo-btn');
    await win.waitForSelector('#f-head [data-combo=clientId] .combo-add');
    // 10.12.0 (H-E22) — la liste vide disait « Aucun résultat » sous un champ où rien n'était tapé.
    const vide = await win.textContent('#f-head [data-combo=clientId] .combo-empty');
    if (vide.trim() !== 'Aucun client pour l\'instant') throw new Error('la liste des clients, vide, dit : « ' + vide.trim() + ' »');
    await win.click('#f-head [data-combo=clientId] .combo-add');
    await win.fill('#cf input[name=name]', 'Client Test');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => (document.querySelector('#f-head [data-combo=clientId] .combo-val') || {}).textContent === 'Client Test');
    await win.fill('#lines input[data-k=label]', 'Audit');
    await win.fill('#lines input[data-k=unitPrice]', '1000');
    await win.click('#save');
    await win.waitForFunction(() => /DEV-\d{4}-001/.test((document.querySelector('#view h1') || {}).textContent || ''), null, { timeout: 5000 });
    const tot = await win.textContent('#totals'); if (!tot.includes('1\u00a0190,000')) throw new Error(tot);
  });
  await step('aperçu rendu', async () => {
    const f = win.frameLocator('#preview');
    await f.locator('.grand .gv').waitFor();
    const s = await f.locator('.grand .gv').textContent(); if (!s.includes('1\u00a0190,000')) throw new Error(s);
  });
  await step('document en anglais + devise EUR dans l\'aperçu', async () => {
    await win.selectOption('#f-head select[name=lang]', 'en');
    await win.selectOption('#f-head select[name=currency]', 'EUR');
    await win.waitForFunction(() => !document.querySelector('#rate-field').hidden);
    await win.fill('#f-head input[name=exchangeRate]', '3.4');
    const f = win.frameLocator('#preview');
    await f.locator('.kind:has-text("Quote")').waitFor({ timeout: 8000 });
    const s = await f.locator('.grand .gv').textContent(); if (!s.includes('1,190.00') || !s.includes('EUR')) throw new Error(s);
    if (!(await win.textContent('#totals')).includes('1\u00a0190,00\u00a0EUR')) throw new Error(await win.textContent('#totals'));
    await win.selectOption('#f-head select[name=currency]', 'DT');
    await win.selectOption('#f-head select[name=lang]', 'fr');
    await f.locator('.kind:has-text("Devis")').waitFor({ timeout: 8000 });
    await win.click('#save'); await win.waitForSelector('#toast.show');
  });
  await step('convertir en facture → brouillon sans numéro', async () => {
    await win.click('#bill-btn'); await win.click('#convert');
    await win.waitForFunction(() => document.querySelector('#view h1') && document.querySelector('#view h1').textContent.includes('Facture (brouillon)'));
    const tot = await win.textContent('#totals'); if (!tot.includes('Timbre') || !tot.includes('1\u00a0191,000')) throw new Error(tot);
    if (!(await win.textContent('#f-head')).includes('numéro attribué')) throw new Error('statut brouillon');
  });
  await step('émettre la facture → FAC-…-001, verrouillée', async () => {
    // 10.12.0 (H-E23) — la phrase par défaut des conditions de paiement disait « à réception de la
    // facture » pendant que la pièce imprime « À régler avant le … » : deux délais sur une pièce
    // légale. Le défaut ne le dit plus ; une phrase restée ainsi se MONTRE à l'émission.
    const phraseDefaut = await win.evaluate(() => window.__data.company.paymentTerms);
    if (/r[ée]ception/i.test(phraseDefaut || '')) throw new Error('les conditions de paiement par défaut disent encore : ' + phraseDefaut);
    await win.evaluate(() => { window.__data.company.paymentTerms = 'Paiement par virement bancaire à réception de la facture.'; });
    await win.click('#issue');
    await win.waitForSelector('#modal-root #ok');
    const deuxDelais = await win.textContent('#modal-root');
    if (!/se contredisent/.test(deuxDelais)) throw new Error('l\'émission ne montre pas les deux délais qui se contredisent : ' + deuxDelais.replace(/\s+/g, ' ').slice(0, 300));
    await win.evaluate(p => { window.__data.company.paymentTerms = p; }, phraseDefaut);
    if (!(await win.textContent('#modal-root')).includes('FAC-')) throw new Error('aperçu du numéro');
    // 10.12.0 — le geste le plus irréversible passait par une « Confirmation » générique : on
    // confirmait sans pouvoir relire à qui, ni combien. Le récapitulatif nomme les deux.
    const recap = await win.evaluate(() => { const r = document.querySelector('#modal-root .recap-emission'); return r ? r.textContent.replace(/\s+/g, ' ') : ''; });
    if (!recap) throw new Error('l\'émission ne montre plus son récapitulatif');
    for (const attendu of ['Client Test', 'Net à payer', '1 191,000', 'Échéance']) {
      if (!recap.includes(attendu)) throw new Error(`le récapitulatif ne dit pas « ${attendu} » : ${recap}`);
    }
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => /Facture FAC-\d{4}-001/.test((document.querySelector('#view h1') || {}).textContent || ''));
    if (await win.$('#save')) throw new Error('bouton enregistrer présent sur une facture émise');
    if (!(await win.isDisabled('#f-head input[name=subject]'))) throw new Error('champ non verrouillé');
    // 10.12.0 — un champ texte fermé gardait le fond et l'encre d'un champ modifiable pendant que
    // les listes voisines se grisaient : `input:disabled` perdait contre la règle générale.
    const gris = await win.evaluate(() => {
      const i = document.querySelector('#f-head input[name=subject]'), s = document.querySelector('#f-head select:disabled');
      return s ? { i: getComputedStyle(i).backgroundColor, s: getComputedStyle(s).backgroundColor } : null;
    });
    if (!gris) throw new Error('aucune liste fermée sur la facture émise : le contrôle ne prouve rien');
    if (gris.i !== gris.s) throw new Error(`un champ texte fermé n'a pas le fond d'une liste fermée (${gris.i} contre ${gris.s})`);
    // 7.0.0 : vingt champs gris et une ligne d'explication de 12 px sous le titre, c'était une
    // application qui a l'air cassée. Le verrouillage s'annonce maintenant en toutes lettres, et la
    // sortie est SUR l'écran — pas dans un menu « Plus ▾ » qu'on n'a pas encore ouvert.
    await win.waitForSelector('.lock-banner');
    const txt = await win.textContent('.lock-banner');
    if (!/ne se modifie plus/.test(txt)) throw new Error('bandeau de verrouillage : ' + txt.slice(0, 160));
    if (!/avoir/.test(txt)) throw new Error('le bandeau doit nommer l\'avoir comme chemin de correction');
    if (!(await win.$('#lock-credit'))) throw new Error('le bandeau doit porter le bouton « Corriger par un avoir »');
    if (!(await win.$('#lock-unlock'))) throw new Error('une facture sans paiement ni avoir doit encore proposer « Modifier quand même »');
    if (!(await win.textContent('#pay-body')).includes('1\u00a0191,000')) throw new Error('situation');
    // 10.12.0 — émise et impayée, elle portait TROIS verts : « Enregistrer un paiement » en haut,
    // « Corriger par un avoir… » dans le bandeau, « + Enregistrer un paiement » dans le panneau.
    // L'étape suivante est le paiement, et seul le bouton de l'en-tête le dit en vert.
    const verts = await win.evaluate(() => [...document.querySelectorAll('#view .btn-primary')].filter(b => b.offsetParent && !b.disabled).map(b => b.id || b.textContent.trim()));
    if (verts.length !== 1 || verts[0] !== 'pay') throw new Error(`facture émise et impayée : boutons principaux ${JSON.stringify(verts)} au lieu du paiement seul`);
  });
  await step('paiement partiel puis solde → payée', async () => {
    await win.click('#pay');
    await win.fill('#pf2 input[name=amount]', '191');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => (document.querySelector('#pay-body') || {}).textContent.includes('1\u00a0000,000'));
    if (!(await win.textContent('#f-head')).includes('partiellement payée')) throw new Error(await win.textContent('#f-head'));
    // 10.12.0 — le bandeau disait « déjà payée en partie » sur une facture payée en ENTIER : il
    // confondait « un paiement existe » et « soldée ». Une seule fonction décide des deux phrases.
    const bandeau = () => win.evaluate(() => (document.querySelector('.lock-banner') || {}).textContent.replace(/\s+/g, ' '));
    if (!/Plus déverrouillable \(déjà payée en partie\)/.test(await bandeau())) throw new Error('payée à moitié : ' + (await bandeau()).slice(-120));
    // Et la ligne du paiement porte un menu nommé, plus deux pictogrammes muets.
    const ligne = await win.evaluate(() => [...document.querySelectorAll('#pay-body td.row-actions button')].map(b => b.textContent.trim()));
    if (ligne.length !== 1 || ligne[0].length < 6) throw new Error(`la ligne du paiement porte ${JSON.stringify(ligne)} au lieu d'un menu nommé`);
    await win.click('#pay2');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => (document.querySelector('#f-head') || {}).textContent.includes('payée') && !(document.querySelector('#f-head') || {}).textContent.includes('partiellement'));
    if (await win.$('#pay2')) throw new Error('bouton paiement encore présent');
    if (!/Plus déverrouillable \(entièrement payée\)/.test(await bandeau())) throw new Error('payée en entier : ' + (await bandeau()).slice(-120));
    // Payée : il n'y a plus de paiement à enregistrer, le seul geste qui reste est la correction.
    const verts2 = await win.evaluate(() => [...document.querySelectorAll('#view .btn-primary')].filter(b => b.offsetParent && !b.disabled).map(b => b.id || b.textContent.trim()));
    if (verts2.length !== 1 || verts2[0] !== 'lock-credit') throw new Error(`facture payée : boutons principaux ${JSON.stringify(verts2)} au lieu de la correction seule`);
  });
  await step('créer un avoir partiel et l\'émettre', async () => {
    await win.click('#more-btn'); await win.click('#credit');
    await win.waitForFunction(() => /Nouvel avoir/.test((document.querySelector('#view h1') || {}).textContent || ''));
    const sel = await win.inputValue('#f-head [data-combo=creditOf] input[type=hidden]'); if (!sel) throw new Error('facture non préremplie');
    if (!(await win.textContent('#f-head [data-combo=creditOf] .combo-val')).startsWith('FAC-')) throw new Error('libellé de la facture concernée');
    await win.fill('#lines input[data-k=unitPrice]', '100');
    await win.click('#issue'); await win.waitForSelector('#modal-root #ok');
    // 10.12.0 — un avoir sur une facture DÉJÀ PAYÉE ne se déduit plus de rien : il devient de
    // l'argent à rendre au client, et c'est avant d'émettre qu'il faut le savoir. 100 HT + 19 % = 119.
    const avRecap = await win.evaluate(() => (document.querySelector('#modal-root') || {}).textContent.replace(/\s+/g, ' '));
    // Le libellé et la valeur sont deux cellules : `textContent` les colle (« corrigéeFAC- »).
    if (!/Montant de l'avoir/.test(avRecap) || !/Facture corrigée\s*FAC-/.test(avRecap)) throw new Error('récapitulatif de l\'avoir : ' + avRecap.slice(0, 240));
    if (!/laisse 119,000 DT à rendre à Client Test/.test(avRecap)) throw new Error('l\'avoir ne dit pas ce qu\'il laisse à rendre : ' + avRecap.slice(0, 400));
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => /Avoir AVO-\d{4}-001/.test((document.querySelector('#view h1') || {}).textContent || ''));
  });
  await step('fiche du client : le pied n\'additionne pas un devis avec sa facture', async () => {
    // 10.12.0 (H-E24) — le pied du tableau des documents additionnait DEV-001 (1 190) avec FAC-001
    // (1 191) et l'avoir (− 119) : 2 262 DT « net à payer », le devis compté deux fois. Calculé à la
    // main : factures et avoirs seuls, 1 191 − 119 = 1 072 DT ; en HT, 1 000 − 100 = 900 DT.
    const idClient = await win.evaluate(() => (window.__data.clients.find(c => c.name === 'Client Test') || {}).id);
    if (!idClient) throw new Error('Client Test introuvable');
    await win.evaluate(i => { location.hash = '#/client/' + i; }, idClient);
    await win.waitForSelector('#view tfoot');
    const pied = await win.evaluate(() => [...document.querySelectorAll('#view tfoot')].map(t => t.textContent.replace(/\s+/g, ' ')).join(' | '));
    if (!/factures et avoirs : 900,000 DT HT/.test(pied)) throw new Error('le pied de la fiche client additionne encore le devis (HT attendu 900) : ' + pied);
    if (!/1 072,000 DT/.test(pied)) throw new Error('le net à payer du pied compte le devis (attendu 1 072) : ' + pied);
  });
  await step('comptabilité : journal, TVA, attestations', async () => {
    await win.evaluate(() => { location.hash = '#/compta'; });
    await win.waitForSelector('#c-body .stats');
    await win.selectOption('#c-month', '');
    await win.waitForFunction(() => (document.querySelector('#c-body') || {}).textContent.includes('année'));
    const body = await win.textContent('#c-body');
    if (!body.includes('FAC-') || !body.includes('AVO-') || !body.includes('TVA 19 %')) throw new Error(body.slice(0, 300));
    if (!body.includes('900,000')) throw new Error('CA HT attendu 1000 − 100 = 900 : ' + body.slice(0, 400));
  });
  await step('menu : aller aux factures (Cmd+3), avoir listé', async () => {
    await app.evaluate(({ Menu }) => { const find = (items, label) => { for (const i of items) { if (i.label === label) return i; if (i.submenu) { const r = find(i.submenu.items, label); if (r) return r; } } }; find(Menu.getApplicationMenu().items, 'Factures').click(); });
    await win.waitForFunction(() => document.querySelector('#view h1') && document.querySelector('#view h1').textContent === 'Factures');
    const l = await win.textContent('#list-wrap'); if (!l.includes('FAC-') || !l.includes('AVO-')) throw new Error('liste');
  });
  // 10.12.0 (H-E25, vu au test humain) — la palette recalculait le montant d'une pièce à sa façon :
  // l'avoir y valait « 119,000 DT » quand la liste, juste derrière, disait « − 119,000 DT ». Deux
  // écrans qui montrent la même pièce ne peuvent pas dire deux montants. Et un mot que seul le CORPS
  // d'un article contient (« assiette », l'exemple que l'Aide donne elle-même) rendait « Aucun
  // résultat » dans la palette et trois articles dans l'Aide.
  await step('palette Cmd+K : l\'avoir au même montant que la liste, et les mots du corps de l\'Aide', async () => {
    const liste = await win.evaluate(() => {
      const ths = [...document.querySelectorAll('#list-wrap thead th')].map(th => th.textContent.trim());
      const col = ths.findIndex(x => /^Net à payer/.test(x));
      const tr = [...document.querySelectorAll('#list-wrap tbody tr')].find(r => /AVO-\d{4}-\d{3}/.test(r.textContent));
      return tr && col >= 0 ? { num: tr.textContent.match(/AVO-\d{4}-\d{3}/)[0], montant: tr.children[col].textContent.trim() } : null;
    });
    if (!liste) throw new Error('l\'avoir ou sa colonne « Net à payer » est introuvable dans la liste des factures');
    if (!/^[−-]/.test(liste.montant)) throw new Error('la liste ne montre plus l\'avoir en négatif : ' + liste.montant);
    await win.keyboard.press('Control+k');
    await win.waitForSelector('#pal-q');
    await win.fill('#pal-q', liste.num.toLowerCase());
    await win.waitForFunction(n => [...document.querySelectorAll('#pal-res .res .main')].some(m => m.textContent.startsWith(n)), liste.num);
    const pal = await win.evaluate(n => { const r = [...document.querySelectorAll('#pal-res .res')].find(x => (x.querySelector('.main') || {}).textContent.startsWith(n)); return r && r.querySelector('.amt') ? r.querySelector('.amt').textContent.trim() : ''; }, liste.num);
    if (pal !== liste.montant) throw new Error(`la palette dit « ${pal} » pour ${liste.num}, la liste « ${liste.montant} »`);
    await win.fill('#pal-q', 'assiette');
    await win.waitForFunction(() => /Aide|Aucun résultat/.test((document.querySelector('#pal-res') || {}).textContent || ''));
    const aides = await win.evaluate(() => [...document.querySelectorAll('#pal-res .res')].filter(r => (r.querySelector('.kind') || {}).textContent === 'Aide').length);
    if (!aides) throw new Error('« assiette » ne rend aucun article dans la palette, alors que la page Aide en trouve');
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => document.querySelector('#palette-root').hidden);
  });
  // 10.12.0 (H-E27, vu au test humain) — sans article suivi, le seul vert de la page Stock était
  // « + Mouvement », un mouvement de rien ; et l'état vide disait le geste en prose (« ouvre le
  // Catalogue, modifie la prestation et coche… »). Le geste est dans la page, et il se fait d'un clic.
  await step('stock vide : le geste qui manque est dans la page, pas un « + Mouvement » de rien', async () => {
    await win.evaluate(() => { location.hash = '#/stock'; });
    await win.waitForSelector('#st-new');
    const etat = await win.evaluate(() => ({ adj: !!document.querySelector('#st-adj'), verts: [...document.querySelectorAll('#view .btn-primary')].map(b => b.id) }));
    if (etat.adj) throw new Error('sans article suivi, l\'en-tête propose encore « + Mouvement »');
    if (etat.verts.join() !== 'st-new') throw new Error('boutons principaux de la page Stock vide : ' + etat.verts.join());
    await win.click('#st-new');
    await win.waitForSelector('#modal-root input[name=tracked]');
    if (!await win.evaluate(() => document.querySelector('#modal-root input[name=tracked]').checked)) throw new Error('« + Nouvel article suivi » ouvre une fiche qui n\'est pas suivie en stock');
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal-bg'));
  });
  // 10.12.0 (trouvé par `e2e:entreprise-rendu`) — le bouton de l'état vide passait `null` au
  // formulaire, qui plantait sur `null.lines` : « + Créer mon premier contrat » acceptait le clic et
  // ne faisait RIEN, depuis la 7.8.0. Aucun parcours ne l'avait jamais cliqué.
  await step('facturation récurrente vide : « + Créer mon premier contrat » ouvre le formulaire', async () => {
    await win.evaluate(() => { location.hash = '#/contrats'; });
    await win.waitForSelector('#rec-first', { timeout: 4000 }).catch(() => { throw new Error('la page vide ne propose pas de créer le premier contrat'); });
    await win.click('#rec-first');
    await win.waitForFunction(() => /Nouveau contrat récurrent/.test((document.querySelector('#modal-root .modal-bg:last-child') || {}).textContent || ''), null, { timeout: 3000 })
      .catch(() => { throw new Error('« + Créer mon premier contrat » accepte le clic et n\'ouvre rien'); });
    await win.keyboard.press('Escape');
    const question = await win.waitForSelector('#modal-root .modal-bg:nth-child(2) #ok', { timeout: 1200 }).catch(() => null);
    if (question) await question.click();
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal-bg'));
  });
  // 10.12.0 (H-E29, vu au test humain) — « Partir d'une facture existante » emmenait à la liste des
  // factures, où rien ne disait quoi faire. On choisit la facture sur place, et le contrat s'ouvre
  // prérempli de son client et de ses lignes.
  await step('facturation récurrente : partir d\'une facture ouvre le contrat prérempli, sans quitter la page', async () => {
    await win.evaluate(() => { location.hash = '#/contrats'; });
    await win.waitForSelector('#rec-depuis');
    await win.click('#rec-depuis');
    await win.waitForSelector('#rec-depuis-ok', { timeout: 4000 }).catch(() => { throw new Error('« Partir d\'une facture existante » ne propose pas de choisir la facture'); });
    if (await win.evaluate(() => location.hash) !== '#/contrats') throw new Error('le bouton a quitté la page au lieu de proposer la facture');
    await win.click('#rec-depuis-ok');
    await win.waitForFunction(() => /Nouveau contrat récurrent/.test((document.querySelector('#modal-root .modal-bg:last-child') || {}).textContent || ''), null, { timeout: 4000 });
    const pre = await win.evaluate(() => {
      const m = document.querySelector('#modal-root .modal-bg:last-child');
      return { client: (m.querySelector('input[name=clientId]') || {}).value || '', remplis: [...m.querySelectorAll('input[type=text]')].filter(i => i.value.trim()).length };
    });
    if (!pre.client || pre.remplis < 2) throw new Error(`le contrat n'est pas prérempli depuis la facture (client « ${pre.client} », ${pre.remplis} champs remplis)`);
    await win.click('#modal-root .modal-bg:last-child [data-close]');
    const question = await win.waitForSelector('#modal-root .modal-bg:nth-child(2) #ok', { timeout: 1500 }).catch(() => null);
    if (question) await question.click();
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal-bg'));
  });
  // 10.12.0 (H-E30) — même famille : l'onglet Proformas vide renvoyait au menu « Transformer » d'un
  // devis. On part du devis sur place, et la proforma s'ouvre en brouillon.
  await step('proformas : partir d\'un devis existant crée la proforma sur place', async () => {
    await win.evaluate(() => { location.hash = '#/autres/proforma'; });
    await win.waitForSelector('#vide-depuis', { timeout: 4000 }).catch(() => { throw new Error('l\'onglet Proformas vide ne propose pas de partir d\'un devis existant'); });
    await win.click('#vide-depuis');
    await win.waitForSelector('#vide-depuis-ok');
    await win.click('#vide-depuis-ok');
    await win.waitForFunction(() => location.hash.startsWith('#/doc/') && /proforma/i.test((document.querySelector('#view h1') || {}).textContent || ''), null, { timeout: 4000 });
  });
  await step('paramètres + panneau mises à jour + sauvegarde', async () => {
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await setTab('app');
    await win.waitForSelector('#update-panel .ver');
    const up = await win.textContent('#update-panel');
    if (!(packaged ? up.includes('Vérifier maintenant') : up.includes('Mode développement'))) throw new Error('panneau maj: ' + up.slice(0, 120));
    if (packaged) { // dans l'app installée, la vérification manuelle doit répondre proprement (pas de token → message clair)
      await win.click('#upd-check');
      await win.waitForFunction(() => !document.querySelector('#update-panel').textContent.includes('Vérification en cours'), null, { timeout: 30000 });
      const after = await win.textContent('#update-panel');
      if (!/token|GitHub|dernière version/i.test(after)) throw new Error('après check: ' + after.slice(0, 200));
      console.log('   panneau après vérification :', after.replace(/\s+/g, ' ').slice(0, 110));
    }
    await setTab('donnees');
    await win.click('#backup-now');
    await win.waitForSelector('#toast.show');
    const b = fs.readdirSync(path.join(dossierDir(), 'backups')); if (!b.some(f => f.startsWith('manuelle-'))) throw new Error(b.join(','));
  });
  await step('nouveautés (changelog)', async () => {
    await setTab('app');
    await win.click('#upd-changelog');
    await win.waitForSelector('.changelog');
    if (!(await win.textContent('.changelog')).includes(VERSION)) throw new Error(`le changelog ne parle pas de la version ${VERSION}`);
    await win.click('#modal-root [data-close]');
  });
  await step('jeu de démo', async () => {
    await setTab('donnees');
    await win.click('#load-demo'); await win.click('#modal-root #ok');
    await win.waitForFunction(() => location.hash === '#/dashboard');
    const s = await win.textContent('.stats'); if (!s.includes('DT')) throw new Error(s);
  });
  await step('tableau de bord : graphique, top clients, KPI', async () => {
    await win.evaluate(() => { location.hash = '#/dashboard'; });
    await win.waitForSelector('svg.chart');
    if ((await win.$$('svg.chart rect.bar-inv')).length !== 12) throw new Error('12 barres attendues');
    if (!(await win.$$('.rank li')).length) throw new Error('top clients vide');
    const k = await win.textContent('.kpis'); if (!k.includes('%') || !k.includes('jours')) throw new Error(k);
  });
  await step('thème sombre', async () => {
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await setTab('app');
    if (!(await win.isHidden('#save-bar'))) throw new Error('barre Enregistrer visible sans modification');
    await win.selectOption('#pf select[name=theme]', 'dark');
    await win.waitForSelector('#save-bar:not([hidden])');
    await win.click('#save');
    await win.waitForFunction(() => document.body.classList.contains('dark'));
    if (!(await win.isHidden('#save-bar'))) throw new Error('barre Enregistrer encore visible après enregistrement');
    await win.selectOption('#pf select[name=theme]', 'light');
    await win.click('#save');
    await win.waitForFunction(() => !document.body.classList.contains('dark'));
  });
  await step('contrats : brouillon généré depuis le contrat de démo', async () => {
    await win.evaluate(() => { location.hash = '#/contrats'; });
    await win.waitForSelector('#c-wrap table');
    if (!(await win.textContent('#c-wrap')).includes('à générer')) throw new Error('contrat dû absent');
    if (await win.evaluate(() => document.querySelector('#nav-contrats').textContent) !== '1') throw new Error('compteur contrats');
    await win.click('#gen-due');
    // Depuis la 7.12.0, fabriquer plusieurs factures d'un coup annonce combien avant de le faire.
    await win.waitForSelector('#modal-root #ok');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
    await win.waitForSelector('#toast.show');
    if (!(await win.textContent('#toast')).includes('1 brouillon')) throw new Error(await win.textContent('#toast'));
    await win.evaluate(() => { location.hash = '#/factures'; });
    await win.waitForFunction(() => document.querySelectorAll('#list-wrap tbody tr').length >= 9 && document.querySelector('#list-wrap').textContent.includes('Brouillon'), null, { timeout: 10000 });
    const subjects = await win.evaluate(() => Array.from(document.querySelectorAll('#list-wrap tbody tr')).map(tr => tr.textContent).join(' | '));
    if (!subjects.includes('Pharmacie Centrale El Menzah')) throw new Error(subjects.slice(0, 300));
  });
  // Depuis la 7.28.0, les actions d'une ligne vivent dans un menu et non plus dans une rangée de
  // boutons : on ouvre le menu de la ligne visée, puis on clique l'action par son libellé.
  const actionLigne = async (ligne, libelle) => {
    await win.click(`${ligne} [data-rowmenu]`);
    await win.waitForSelector('.row-menu');
    const i = await win.evaluate(l => [...document.querySelectorAll('.row-menu .rm-l')]
      .findIndex(x => x.textContent.trim() === l), libelle);
    if (i < 0) throw new Error(`le menu de « ${ligne} » ne propose pas « ${libelle} »`);
    await win.click(`.row-menu button >> nth=${i}`);
  };

  await step('relances : facture en retard listée, email de relance prérempli', async () => {
    await win.evaluate(() => { location.hash = '#/relances'; });
    await win.waitForSelector('#r-wrap table');
    const r = await win.textContent('#r-wrap'); if (!r.includes('à relancer') || !r.includes('Relance')) throw new Error(r.slice(0, 300));
    const n = await win.textContent('#nav-relances'); if (!/^\d+$/.test(n)) throw new Error('compteur nav: ' + n);
    await actionLigne('#r-wrap tbody tr:first-child', 'Relancer par email');
    // Depuis la 7.6.0, un envoi depuis le jeu d'exemple prévient d'abord : les adresses des clients
    // fictifs ressemblent à de vraies adresses. Elle prévient, elle n'interdit pas — « Continuer
    // quand même » laisse passer, et c'est ce qu'on vérifie ici.
    await win.waitForSelector('#modal-root #b');
    await win.click('#modal-root #b');
    await win.waitForSelector('#mf');
    const subj = await win.inputValue('#mf input[name=subject]'); if (!subj.includes('FAC-')) throw new Error(subj);
    if (!(await win.inputValue('#mf textarea[name=body]')).includes('jours')) throw new Error('corps');
    await win.click('#modal-root [data-close]');
  });
  await step('palette Cmd+K : recherche clavier', async () => {
    await win.keyboard.press('Control+k');
    await win.waitForSelector('#pal-q');
    await win.fill('#pal-q', 'audit');
    await win.waitForFunction(() => (document.querySelector('#pal-res') || {}).textContent.includes('Prestation'));
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => document.querySelector('#palette-root').hidden);
  });
  await step('modèles : enregistrer un devis comme modèle puis le réutiliser', async () => {
    await win.evaluate(() => { location.hash = '#/devis'; });
    await win.waitForSelector('#list-wrap tr.clickable');
    await win.click('#list-wrap tr.clickable');
    await win.waitForSelector('#more-btn');
    await win.click('#more-btn'); await win.click('#as-template');
    await win.fill('#pr input[name=v]', 'Modèle E2E'); await win.click('#modal-root #ok');
    await win.waitForSelector('#toast.show');
    await win.evaluate(() => { location.hash = '#/catalogue'; });
    await win.click('#cat-tabs button[data-tab="modeles"]');
    await win.waitForSelector('#tpl-wrap table');
    if (!(await win.textContent('#tpl-wrap')).includes('Modèle E2E')) throw new Error('modèle absent');
    // Depuis la 7.29.0 « Nouveau devis » vit dans le menu d'actions de la ligne du modèle, pas sur
    // un bouton `data-use` : on ouvre le menu du DERNIER modèle et on clique l'entrée.
    const menus = await win.$$('#tpl-wrap [data-rowmenu]');
    await menus[menus.length - 1].click();
    await win.waitForSelector('.row-menu');
    const iNeuf = await win.evaluate(() => [...document.querySelectorAll('.row-menu .rm-l')]
      .findIndex(x => /^Nouveau /.test(x.textContent.trim())));
    if (iNeuf < 0) throw new Error('le menu du modèle ne propose pas de créer un document');
    await win.click(`.row-menu button >> nth=${iNeuf}`);
    await win.waitForSelector('#f-head');
    const first = await win.inputValue('#lines input[data-k=label]'); if (!first) throw new Error('lignes du modèle non appliquées');
    if (!(await win.$('#tpl-pick'))) throw new Error('sélecteur de modèle absent');
    if (!(await win.$('#snip-pick'))) throw new Error('sélecteur de texte absent');
  });
  await step('bulles « i » : ouverture, contenu, fermeture par Échap', async () => {
    await win.evaluate(() => { location.hash = '#/dashboard'; });
    await win.waitForSelector('.stats button.i');
    const n = (await win.$$('button.i')).length; if (n < 6) throw new Error('bulles sur l\'accueil : ' + n);
    await win.click('.stats button.i');
    await win.waitForSelector('#info-pop');
    const txt = await win.textContent('#info-pop'); if (txt.length < 80) throw new Error('bulle vide : ' + txt);
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => !document.querySelector('#info-pop'));
  });
  await step('aide : navigation entre articles, depuis le menu de l\'application', async () => {
    await app.evaluate(({ Menu }) => { const find = (items, label) => { for (const i of items) { if (i.label === label) return i; if (i.submenu) { const r = find(i.submenu.items, label); if (r) return r; } } }; find(Menu.getApplicationMenu().items, 'TVA, timbre et retenue à la source').click(); });
    await win.waitForSelector('.help-body');
    if (!(await win.textContent('.help-body')).includes('retenue à la source')) throw new Error('mauvais article');
    // Depuis la 7.27.0 un article ne porte plus la liste des trente-deux : il porte ses voisins DE
    // SON THÈME, et le fil d'Ariane remonte au plan. On vérifie le chemin réel.
    const voisins = (await win.$$('.help-suite [data-art]')).length;
    if (!voisins) throw new Error('aucun article voisin : il faudrait repasser par le plan à la main');
    await win.click('.help-fil [data-home]');
    await win.waitForSelector('.help-sec');
    const arts = (await win.$$('[data-art]')).length; if (arts < 10) throw new Error('le plan ne liste que ' + arts + ' article(s)');
    await win.click('[data-art="gestion"]');
    // `(el || {}).textContent` vaut `undefined` tant que l'article n'est pas dessiné, et
    // `undefined.includes` lève : le test accusait l'application d'un défaut qu'elle n'a pas.
    await win.waitForFunction(() => { const t = document.querySelector('.help-h'); return !!t && t.textContent.includes('première entreprise'); });
    if (!/SkanFact/.test(await win.title())) throw new Error('titre de fenêtre : ' + await win.title());
  });
  await step('unité : choisie dans une liste, « Autre… » pour une unité maison', async () => {
    await win.evaluate(() => { location.hash = '#/doc/new/devis'; });
    await win.waitForSelector('#lines select[data-k=unit]');
    const opts = await win.evaluate(() => Array.from(document.querySelectorAll('#lines select[data-k=unit] option')).map(o => o.value));
    if (!opts.includes('h') || !opts.includes('forfait') || !opts.includes('__autre__')) throw new Error('options : ' + opts.join(','));
    await win.selectOption('#lines select[data-k=unit]', 'j');
    if (await win.inputValue('#lines select[data-k=unit]') !== 'j') throw new Error('unité non retenue');
    // « Autre… » ouvre une saisie libre ; l'unité tapée devient la valeur choisie
    await win.selectOption('#lines select[data-k=unit]', '__autre__');
    await win.waitForSelector('#modal-root input[name=v]');
    await win.fill('#modal-root input[name=v]', 'rouleau');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => (document.querySelector('#lines select[data-k=unit]') || {}).value === 'rouleau');
    // annuler « Autre… » laisse l'unité précédente en place
    await win.selectOption('#lines select[data-k=unit]', '__autre__');
    await win.waitForSelector('#modal-root input[name=v]');
    await win.click('#modal-root [data-close]');
    if (await win.inputValue('#lines select[data-k=unit]') !== 'rouleau') throw new Error('annulation de « Autre… »');
  });
  await step('date : saisie tolérante, flèches, calendrier', async () => {
    const hidden = '#f-head .datefield:first-of-type input[type=hidden]';
    const txt = '#f-head .datefield:first-of-type .d-txt';
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(await win.inputValue(txt))) throw new Error('affichage JJ/MM/AAAA');
    // saisie sans séparateurs : ils s'écrivent tout seuls et la valeur ISO suit
    await win.fill(txt, '');
    await win.type(txt, '12032026');
    if (await win.inputValue(txt) !== '12/03/2026') throw new Error('séparateurs : ' + await win.inputValue(txt));
    await win.click('#f-head input[name=subject]');
    await win.waitForFunction(sel => document.querySelector(sel).value === '2026-03-12', hidden);
    // flèche haut : jour suivant
    await win.click(txt);
    await win.press(txt, 'ArrowUp');
    await win.waitForFunction(sel => document.querySelector(sel).value === '2026-03-13', hidden);
    // date impossible : refusée, l'ancienne valeur revient
    await win.fill(txt, '31/02/2026');
    await win.click('#f-head input[name=subject]');
    await win.waitForSelector('#toast.show.error');
    if (await win.inputValue(txt) !== '13/03/2026') throw new Error('date impossible acceptée');
    // calendrier : navigation et clic sur un jour
    await win.click('#f-head .datefield:first-of-type .d-btn');
    await win.waitForSelector('.cal-grid');
    if ((await win.$$('.cal-d')).length !== 42) throw new Error('grille du calendrier');
    await win.click('.cal-head [data-mv="1"]');
    await win.waitForFunction(() => document.querySelector('.cal-m').value === '4');
    await win.click('.cal-grid .cal-d:not(.out)');
    await win.waitForFunction(sel => /^2026-04-/.test(document.querySelector(sel).value), hidden);
    if (await win.$('.cal-pop:not([hidden])')) throw new Error('calendrier resté ouvert');
    // « Aujourd'hui » sur le champ Échéance, puis Échap referme
    await win.click('#f-head .datefield:nth-of-type(1) .d-btn');
    await win.waitForSelector('.cal-grid');
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => !document.querySelector('.cal-pop:not([hidden])'));
  });
  await step('une facture ouverte depuis la fiche d\'un client au nom long garde sa barre sur une rangée', async () => {
    // 10.12.0 — vu au test humain, à 1440 px : la longueur du retour dépend de la page d'où l'on
    // vient. « ← Factures » tenait sur la barre ; « ← Hôtel Dar El Marsa SARL » la faisait passer sur
    // deux rangées, « Plus ▾ » seul en dessous, et tout le formulaire descendait de 43 px — le clic
    // visé sur « Émettre » tombait sur « Enregistrer le brouillon ». Et « Agrandir » y était en double.
    const taille0 = await win.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    await win.setViewportSize({ width: 1440, height: 900 });
    // L'étape d'avant laisse une facture neuve modifiée : on répond à la question en l'abandonnant.
    await win.evaluate(() => { location.hash = '#/'; });
    await win.waitForTimeout(300);
    if (await win.$('#modal-root #b')) { await win.click('#modal-root #b'); }
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
    await win.evaluate(() => {
      const d = window.__data;
      d.clients.push({ id: 'e2e-nom-long', name: 'Société Méditerranéenne de Menuiserie et d\'Agencement SARL' });
      d.documents.push({ id: 'e2e-barre', type: 'facture', status: 'brouillon', clientId: 'e2e-nom-long', date: '2026-09-20', dueDate: '2026-10-20',
        subject: 'Portes', lines: [{ label: 'Porte', qty: 1, unit: 'u', unitPrice: 100, vatRate: 19 }], currency: 'DT', lang: 'fr',
        payments: [], reminders: [], emails: [], attachments: [], applyStamp: true });
      location.hash = '#/client/e2e-nom-long';
    });
    await win.waitForFunction(() => /Méditerranéenne/.test((document.querySelector('#view h1') || {}).textContent || ''));
    await win.evaluate(() => { location.hash = '#/doc/e2e-barre'; });
    await win.waitForSelector('#view .editor'); await win.waitForSelector('#view #back');
    await win.waitForTimeout(250);
    const r = await win.evaluate(() => {
      const els = [...document.querySelectorAll('#view .page-head .actions > *')].filter(e => e.offsetParent);
      const centres = els.map(e => { const b = e.getBoundingClientRect(); return { nom: e.id || (e.textContent || '').trim().slice(0, 16), c: Math.round(b.top + b.height / 2) }; });
      const agrandir = [...document.querySelectorAll('#view button')].filter(b => b.offsetParent && b.textContent.trim() === 'Agrandir').length;
      return { retour: document.querySelector('#back').textContent.trim(), centres, agrandir };
    });
    if (!/Société/.test(r.retour)) throw new Error('le retour ne mène pas à la fiche du client : ' + r.retour);
    const c0 = r.centres[0].c;
    const decales = r.centres.filter(x => Math.abs(x.c - c0) > 6);
    if (decales.length) throw new Error(`la barre passe sur deux rangées avec « ${r.retour} » : ${decales.map(x => x.nom).join(', ')} en dessous`);
    if (r.agrandir !== 1) throw new Error(`« Agrandir » visible ${r.agrandir} fois (une seule attendue)`);
    await win.evaluate(() => {
      const d = window.__data;
      d.documents = d.documents.filter(x => x.id !== 'e2e-barre');
      d.clients = d.clients.filter(x => x.id !== 'e2e-nom-long');
      location.hash = '#/';
    });
    await win.setViewportSize(taille0);
  });
  await step('facture neuve : choisir le client ne déplace rien, et « Émettre » reste le seul vert', async () => {
    // 10.12.0 (H-E19) — vu au test humain, à 1440 px : choisir le client (le tout premier geste)
    // allumait le marqueur « non enregistré » À CÔTÉ du titre ; l'en-tête, élargi, passait sur deux
    // rangées, et tout le formulaire descendait de 40 px sous le curseur — le clic suivant, visé sur
    // l'Objet, tombait à côté. Et « Enregistrer le brouillon » passait au vert à côté d'« Émettre ».
    // À 1280 px l'en-tête est déjà sur deux rangées : le défaut ne se voit qu'à 1440, d'où la taille.
    const taille0 = await win.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    await win.setViewportSize({ width: 1440, height: 900 });
    await win.evaluate(() => { location.hash = '#/doc/new/facture'; });
    if (await win.$('#modal-root #b')) { await win.click('#modal-root #b'); }
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
    await win.waitForSelector('#f-head [data-combo=clientId]');
    await win.waitForTimeout(150);
    const mesure = () => win.evaluate(() => {
      const boite = e => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height }; };
      const dot = document.querySelector('#dirty-dot');
      return {
        tete: boite(document.querySelector('#view .page-head')),
        objet: boite(document.querySelector('#f-head input[name=subject]')),
        editeur: boite(document.querySelector('#view .editor')),
        verts: [...document.querySelectorAll('#view .page-head .btn-primary')].filter(b => b.offsetParent).map(b => b.id || b.textContent.trim()),
        dot: dot && !dot.hidden ? boite(dot) : null,
        actions: [...document.querySelectorAll('#view .page-head .actions > *, #view .page-head h1')].filter(e => e.offsetParent).map(e => ({ nom: e.id || e.tagName, ...(({ top, bottom, left, right }) => ({ top, bottom, left, right }))(e.getBoundingClientRect()) }))
      };
    });
    const avant = await mesure();
    if (avant.verts.join() !== 'issue') throw new Error('facture neuve, avant tout geste : ' + JSON.stringify(avant.verts));
    await win.click('#f-head [data-combo=clientId] .combo-btn');
    await win.waitForSelector('#f-head [data-combo=clientId] .combo-it');
    await win.click('#f-head [data-combo=clientId] .combo-it');
    await win.waitForFunction(() => !document.querySelector('#dirty-dot').hidden);
    await win.waitForTimeout(150);
    const apres = await mesure();
    if (apres.verts.join() !== 'issue') throw new Error('après le choix du client, boutons principaux : ' + JSON.stringify(apres.verts) + ' — « Émettre » doit rester le seul');
    if (Math.abs(apres.tete.h - avant.tete.h) > 1) throw new Error(`l'en-tête passe de ${Math.round(avant.tete.h)} à ${Math.round(apres.tete.h)} px au premier geste`);
    if (Math.abs(apres.objet.top - avant.objet.top) > 1) throw new Error(`le champ Objet se déplace de ${Math.round(apres.objet.top - avant.objet.top)} px au premier geste : le clic suivant tombe à côté`);
    if (!apres.dot) throw new Error('le marqueur « modifications non enregistrées » ne s\'affiche pas');
    if (apres.dot.bottom > apres.editeur.top + 0.5) throw new Error(`le marqueur déborde sur le formulaire (${Math.round(apres.dot.bottom)} > ${Math.round(apres.editeur.top)})`);
    const touche = apres.actions.filter(a => a.nom !== 'H1' && a.left < apres.dot.right && a.right > apres.dot.left && a.top < apres.dot.bottom && a.bottom > apres.dot.top);
    if (touche.length) throw new Error('le marqueur recouvre ' + touche.map(a => a.nom).join(', '));
    await win.setViewportSize(taille0);
  });
  await step('désignation libre : aucune liste ne se pose sous la rangée quantité / prix', async () => {
    // 10.12.0 (H-E20) — vu au test humain : « Location salle de réunion », un libellé que le
    // catalogue ignore, ouvrait une liste d'une seule ligne, « + Créer … au catalogue », posée
    // EXACTEMENT sur la quantité et le prix. Le clic suivant ouvrait une fiche de prestation.
    const champ = '#lines tr[data-i="0"] input[data-k=label]';
    await win.click(champ);
    await win.type(champ, 'Location salle de réunion zq', { delay: 10 });
    await win.waitForTimeout(250);
    if (await win.$('.sugg-pop:not([hidden])')) throw new Error('une liste s\'ouvre sous une désignation que le catalogue ignore : elle recouvre la quantité et le prix');
    // Le prix, juste en dessous, reçoit bien le clic — c'est ce que le défaut volait.
    await win.click('#lines tr[data-i="0"] input[data-k=unitPrice]');
    const auPrix = await win.evaluate(() => document.activeElement && document.activeElement.dataset.k === 'unitPrice' && !document.querySelector('#modal-root .modal'));
    if (!auPrix) throw new Error('le clic sur le prix n\'arrive pas au prix');
    // Demandée (flèche du bas), la liste propose de créer l'article : rien n'est perdu.
    await win.click(champ);
    await win.keyboard.press('ArrowDown');
    await win.waitForSelector('.sugg-pop:not([hidden]) .sugg-add', { timeout: 3000 });
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => !document.querySelector('.sugg-pop:not([hidden])'));
  });
  await step('client : liste déroulante avec recherche au clavier', async () => {
    // le document précédent a été modifié : on quitte sans enregistrer
    await win.evaluate(() => { location.hash = '#/doc/new/facture'; });
    if (await win.$('#modal-root #b')) { await win.click('#modal-root #b'); }
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
    await win.waitForSelector('#f-head [data-combo=clientId]');
    await win.click('#f-head [data-combo=clientId] .combo-btn');
    await win.waitForSelector('#f-head [data-combo=clientId] .combo-q');
    await win.fill('#f-head [data-combo=clientId] .combo-q', 'lemon');
    await win.waitForFunction(() => document.querySelectorAll('#f-head [data-combo=clientId] .combo-it').length === 1);
    await win.keyboard.press('Enter');
    await win.waitForFunction(() => (document.querySelector('#f-head [data-combo=clientId] .combo-val') || {}).textContent.includes('Lemon Beach'));
    if (!(await win.inputValue('#f-head [data-combo=clientId] input[type=hidden]'))) throw new Error('valeur non posée');
    // recherche sans résultat
    await win.click('#f-head [data-combo=clientId] .combo-btn');
    await win.fill('#f-head [data-combo=clientId] .combo-q', 'zzzz');
    await win.waitForSelector('#f-head [data-combo=clientId] .combo-empty');
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => !document.querySelector('#f-head [data-combo=clientId] .combo-pop:not([hidden])'));
    // catalogue : liste d'action avec recherche, qui ne garde pas la valeur choisie
    await win.click('#cat-pick .combo-btn');
    await win.waitForSelector('#cat-pick .combo-it');
    await win.click('#cat-pick .combo-it');
    await win.waitForFunction(() => document.querySelectorAll('#lines tr').length >= 1);
    if (!(await win.textContent('#cat-pick .combo-val')).includes('catalogue')) throw new Error('la liste du catalogue garde la valeur choisie');
  });
  await step('éditeur : lignes déplaçables, description à la demande, aperçu masquable', async () => {
    await win.evaluate(() => { location.hash = '#/doc/new/devis'; });
    if (await win.$('#modal-root #b')) { await win.click('#modal-root #b'); }   // document précédent modifié
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
    await win.waitForSelector('#lines input[data-k=label]');
    await win.fill('#lines input[data-k=label]', 'Première');
    await win.click('#add-line');
    await win.fill('#lines tr[data-i="1"] input[data-k=label]', 'Deuxième');
    await win.click('#lines tr[data-i="1"] [data-up]');
    if (await win.inputValue('#lines tr[data-i="0"] input[data-k=label]') !== 'Deuxième') throw new Error('montée de ligne');
    await win.click('#lines tr[data-i="0"] [data-dup]');
    if ((await win.$$('#lines tr')).length !== 3) throw new Error('duplication');
    await win.click('#lines tr[data-i="0"] [data-rm]');
    if ((await win.$$('#lines tr')).length !== 2) throw new Error('suppression');
    if (await win.$('#lines textarea[data-k=description]')) throw new Error('description affichée sans contenu');
    await win.click('#lines tr[data-i="0"] [data-desc]');
    await win.waitForSelector('#lines textarea[data-k=description]');
    await win.waitForFunction(() => { const el = document.querySelector('#pv-pages'); return el && /page/.test(el.textContent); });
    // Depuis la 7.13.0 l'interrupteur vit dans la barre d'actions (#pv-toggle) : quand l'aperçu est
    // masqué, la colonne disparaît entièrement, donc un bouton posé DANS l'aperçu serait injoignable.
    await win.click('#pv-toggle');
    await win.waitForFunction(() => document.querySelector('.editor').classList.contains('no-preview'));
    await win.click('#pv-toggle');
    await win.waitForFunction(() => !document.querySelector('.editor').classList.contains('no-preview'));
  });
  await step('garde-fou : quitter un document modifié propose d\'enregistrer', async () => {
    await win.waitForFunction(() => !document.querySelector('#dirty-dot').hidden);
    await win.evaluate(() => { location.hash = '#/clients'; });
    await win.waitForSelector('#modal-root .modal');
    const m = await win.textContent('#modal-root'); if (!m.includes('non enregistr')) throw new Error(m.slice(0, 200));
    await win.click('#modal-root [data-close]');                       // annuler : on reste sur le document
    await win.waitForFunction(() => location.hash.startsWith('#/doc/'));
    await win.evaluate(() => { location.hash = '#/clients'; });
    await win.waitForSelector('#modal-root #b');
    await win.click('#modal-root #b');                                  // quitter sans enregistrer
    await win.waitForFunction(() => location.hash === '#/clients' && !document.querySelector('.modal'));
    const q = await win.evaluate(() => JSON.parse(localStorage.getItem('x') || 'null'));
    if (q !== null) throw new Error('localStorage inattendu');
  });
  await step('listes : tri par colonne, filtre année, totaux en pied', async () => {
    await win.evaluate(() => { location.hash = '#/factures'; });
    await win.waitForSelector('#list-wrap tfoot');
    const foot = await win.textContent('#list-wrap tfoot'); if (!/\d+ documents/.test(foot) || !foot.includes('HT')) throw new Error('pied : ' + foot);
    await win.click('th[data-sort="client"]');
    await win.waitForSelector('th[data-sort="client"].sorted');   // le repère « ⇅ » existe au repos : on attend la colonne triée
    const first = await win.textContent('#list-wrap tbody tr:first-child');
    await win.click('th[data-sort="client"]');                       // ordre inverse
    await win.waitForFunction(f => document.querySelector('#list-wrap tbody tr').textContent !== f, first);
    if (await win.$('#yr')) { await win.selectOption('#yr', { index: 1 }); await win.waitForSelector('#list-wrap tfoot'); await win.selectOption('#yr', ''); }
    const st = await win.$$('#list-wrap th'); if (st.length < 7) throw new Error('colonnes : ' + st.length);
    // tous les en-têtes triables portent le repère au repos
    const marks = await win.evaluate(() => document.querySelectorAll('#list-wrap th.sortable-h .sort-ar').length);
    if (marks < 5) throw new Error('repères de tri : ' + marks);
  });
  await step('listes : pagination, taille de page, filtres réinitialisables', async () => {
    await win.evaluate(() => { try { localStorage.removeItem('skanfact.rowsPerPage'); } catch (_) {} location.hash = '#/dashboard'; });
    await win.evaluate(() => { location.hash = '#/factures'; });
    await win.waitForSelector('#list-wrap .pager');
    const info1 = await win.textContent('#list-wrap .pg-info');
    if (!/^1–\d+ sur \d+/.test(info1)) throw new Error('compteur : ' + info1);
    const rows1 = (await win.$$('#list-wrap tbody tr')).length;
    if (rows1 > 25) throw new Error('page non découpée : ' + rows1);
    // page suivante
    await win.click('[data-pg="next"]');
    await win.waitForFunction(i => document.querySelector('#list-wrap .pg-info').textContent !== i, info1);
    const info2 = await win.textContent('#list-wrap .pg-info');
    if (info2.startsWith('1–')) throw new Error('page inchangée : ' + info2);
    // retour page 1, puis « Tout »
    await win.click('[data-pg="prev"]');
    await win.waitForFunction(() => document.querySelector('#list-wrap .pg-info').textContent.startsWith('1–'));
    await win.selectOption('.pg-size select', '0');
    await win.waitForFunction(() => !document.querySelector('#list-wrap .pager') || document.querySelector('#list-wrap .pg-page').textContent.includes('1 / 1'));
    const kept = await win.evaluate(() => { try { return localStorage.getItem('skanfact.rowsPerPage'); } catch (_) { return null; } });
    if (kept !== '0') throw new Error('taille de page non mémorisée : ' + kept);
    await win.selectOption('.pg-size select', '25');
    await win.waitForSelector('#list-wrap .pager');
    // le total du pied porte sur toute la sélection, pas sur la page
    const foot2 = await win.textContent('#list-wrap tfoot');
    const shown = (await win.$$('#list-wrap tbody tr')).length;
    const totalDocs = Number((foot2.match(/(\d+) documents/) || [])[1]);
    if (!(totalDocs > shown)) throw new Error('pied limité à la page : ' + foot2);
    // filtre actif signalé et réinitialisable
    await win.fill('#q', 'zzzz-introuvable');
    await win.waitForSelector('#list-wrap .empty');
    await win.waitForSelector('#reset-f');
    await win.click('#reset-f');
    await win.waitForSelector('#list-wrap tbody tr');
    if (await win.inputValue('#q')) throw new Error('recherche non effacée');
  });
  await step('catalogue et contrats : recherche et pagination ajoutées', async () => {
    await win.evaluate(() => { location.hash = '#/catalogue'; });
    await win.waitForSelector('#cat-tabs button[data-tab="presta"]');
    await win.click('#cat-tabs button[data-tab="presta"]');   // l'onglet ouvert est mémorisé d'un test à l'autre
    await win.waitForSelector('#list-wrap .filters .q');
    const before = (await win.$$('#list-wrap tbody tr')).length;
    await win.fill('#list-wrap .filters .q', 'zzzz-introuvable');
    await win.waitForSelector('#list-wrap .empty');
    await win.click('#list-wrap #reset-f');
    await win.waitForFunction(n => document.querySelectorAll('#list-wrap tbody tr').length === n, before);
    await win.evaluate(() => { location.hash = '#/contrats'; });
    await win.waitForSelector('#c-wrap .filters #st');
    const all = (await win.$$('#c-wrap tbody tr')).length;
    await win.selectOption('#c-wrap #st', 'suspendu');
    await win.waitForFunction(n => document.querySelectorAll('#c-wrap tbody tr').length !== n || document.querySelector('#c-wrap .empty'), all);
    await win.selectOption('#c-wrap #st', '');
    await win.waitForFunction(n => document.querySelectorAll('#c-wrap tbody tr').length === n, all);
  });
  await step('accueil : panneau « À faire » repliable, choix mémorisé', async () => {
    await win.evaluate(() => { location.hash = '#/dashboard'; });
    await win.waitForSelector('#todo-toggle');
    if (await win.isHidden('#todo-list')) throw new Error('liste déjà repliée');
    await win.click('#todo-toggle');
    await win.waitForSelector('#todo-list', { state: 'hidden' });
    if (!(await win.textContent('.todo-sum')).includes('à faire')) throw new Error('résumé manquant');
    if ((await win.getAttribute('#todo-toggle', 'aria-expanded')) !== 'false') throw new Error('aria-expanded');
    // le choix survit à un changement de page
    await win.evaluate(() => { location.hash = '#/clients'; });
    await win.waitForSelector('#list-wrap');
    await win.evaluate(() => { location.hash = '#/dashboard'; });
    await win.waitForSelector('#todo-toggle');
    if (!(await win.isHidden('#todo-list'))) throw new Error('repli non mémorisé');
    await win.click('#todo-toggle');
    await win.waitForSelector('#todo-list', { state: 'visible' });
  });
  await step('devis : état « expiré » et colonne de validité', async () => {
    await win.evaluate(() => { location.hash = '#/devis'; });
    await win.waitForSelector('#list-wrap table');
    const head = await win.textContent('#list-wrap thead'); if (!head.includes('Valable')) throw new Error(head);
    const opts = await win.evaluate(() => Array.from(document.querySelectorAll('#st option')).map(o => o.value));
    if (!opts.includes('expiré')) throw new Error(opts.join(','));
    await win.selectOption('#st', 'expiré');
    await win.waitForFunction(() => { const t = document.querySelector('#list-wrap'); return t && (t.querySelector('tbody tr') || t.querySelector('.empty')); });
    if (!(await win.textContent('#list-wrap')).includes('expiré')) throw new Error('aucun devis expiré dans la démo');
    await win.selectOption('#st', '');
  });
  await step('fiche client : chiffres, documents, nouveau devis prérempli', async () => {
    await win.evaluate(() => { location.hash = '#/clients'; });
    await win.waitForSelector('#list-wrap tr.clickable');
    await win.evaluate(() => { const tr = Array.from(document.querySelectorAll('#list-wrap tr.clickable')).find(t => t.textContent.includes('Lemon Beach')); tr.click(); });
    await win.waitForSelector('.kv');
    const s2 = await win.textContent('.stats'); if (!s2.includes('Facturé HT') || !s2.includes('Délai moyen')) throw new Error(s2.slice(0, 200));
    if (!(await win.textContent('#cl-docs')).includes('FAC-')) throw new Error('documents du client');
    if (!(await win.textContent('#view')).includes('Sami Gharbi')) throw new Error('contact absent');
    await win.click('#new-dev');
    await win.waitForSelector('#f-head');
    const cid = await win.inputValue('#f-head [data-combo=clientId] input[type=hidden]'); if (!cid) throw new Error('client non prérempli');
    if (!(await win.textContent('#f-head [data-combo=clientId] .combo-val')).includes('Lemon Beach')) throw new Error('mauvais client');
  });
  await step('retour : bouton dans l\'éditeur, dans l\'aide, et raccourci du menu', async () => {
    await win.evaluate(() => { location.hash = '#/clients'; });
    await win.waitForSelector('#list-wrap table');
    await win.evaluate(() => { location.hash = '#/factures'; });
    await win.waitForSelector('#list-wrap tr.clickable');
    await win.click('#list-wrap tr.clickable');
    await win.waitForSelector('#f-head');
    // le bouton dit d'où l'on vient
    if (!(await win.textContent('#back')).includes('Factures')) throw new Error('libellé du retour : ' + await win.textContent('#back'));
    await win.click('#back');
    await win.waitForFunction(() => location.hash === '#/factures');
    // l'aide ramène à ce qu'on faisait, en sautant les articles déjà lus
    await win.evaluate(() => { location.hash = '#/aide'; });
    await win.waitForSelector('#back');
    // `.help-nav` était la colonne de gauche de l'aide, supprimée par la refonte de la 7.23.0 : ce
    // clic ne visait plus rien. On ouvre un article depuis le plan, qui est le chemin réel.
    await win.waitForSelector('.help-sec .help-art');
    await win.click('.help-sec .help-art');
    await win.waitForFunction(() => location.hash.startsWith('#/aide/'));
    await win.waitForTimeout(300);
    // le retour de l'aide ne doit pas repasser par les articles déjà lus
    const lbl = await win.textContent('#back');
    if (/Aide/i.test(lbl)) throw new Error(`retour de l'aide = "${lbl}"`);
    await win.click('#back');
    await win.waitForFunction(() => !location.hash.startsWith('#/aide'));
  });
  await step('contrat : fiche, aperçu de la prochaine facture, factures générées', async () => {
    await win.evaluate(() => { location.hash = '#/contrats'; });
    await win.waitForSelector('#c-wrap tr.clickable');
    await win.click('#c-wrap tr.clickable');
    await win.waitForFunction(() => location.hash.startsWith('#/contrat/'));
    await win.waitForSelector('#preview');
    // l'aperçu montre bien une facture, avec le mois résolu
    await win.waitForFunction(() => {
      const f = document.querySelector('#preview');
      return f && f.contentDocument && /Facture/i.test(f.contentDocument.body.textContent || '');
    });
    const stats = await win.textContent('.stats');
    if (!stats.includes('Par facture') || !stats.includes('Facturé depuis le début')) throw new Error(stats.slice(0, 160));
    if (!(await win.$('#c-docs'))) throw new Error('liste des factures générées absente');
    // la barre latérale reste sur Contrats
    if (!(await win.$('nav a.active[data-route=contrats]'))) throw new Error('barre latérale');
    // le retour ramène à la liste des contrats
    await win.click('#back');
    await win.waitForFunction(() => location.hash === '#/contrats');
  });
  await step('facture d\'un contrat : le lien vers le contrat et la ligne d\'historique', async () => {
    await win.evaluate(() => { location.hash = '#/contrats'; });
    await win.waitForSelector('#c-wrap tr.clickable');
    // Le geste vit dans le menu d'actions de la ligne depuis la 7.29.0.
    await win.click('#c-wrap [data-rowmenu] >> nth=0');
    await win.waitForSelector('.row-menu');
    const iG = await win.evaluate(() => [...document.querySelectorAll('.row-menu .rm-l')]
      .findIndex(x => x.textContent.trim() === 'Générer maintenant'));
    if (iG < 0) throw new Error('le menu du contrat ne propose pas « Générer maintenant »');
    await win.click(`.row-menu button >> nth=${iG}`);
    // Depuis la 7.18.0, générer un contrat suspendu ou dont l'échéance n'est pas encore arrivée
    // pose d'abord la question : le geste avance le calendrier de facturation. Ici l'échéance a
    // déjà été consommée par l'étape « contrats », donc la question apparaît.
    const q = await win.waitForSelector('#modal-root #ok', { timeout: 2500 }).catch(() => null);
    if (q) await q.click();
    await win.waitForFunction(() => location.hash.startsWith('#/contrat/'));
    await win.waitForSelector('#c-docs tr.clickable');
    await win.click('#c-docs tr.clickable');
    await win.waitForSelector('#f-head');
    if (!(await win.textContent('.page-head')).includes('contrat récurrent')) throw new Error('mention du contrat absente de l\'en-tête');
    const tl = await win.textContent('.timeline');
    if (!tl.includes('Générée par un contrat')) throw new Error('historique : ' + tl.slice(0, 200));
    await win.click('.timeline a[href^="#/contrat/"]');
    await win.waitForFunction(() => location.hash.startsWith('#/contrat/'));
  });
  await step('fenêtres empilées : une confirmation ne détruit pas le formulaire dessous', async () => {
    await win.evaluate(() => { location.hash = '#/factures'; });
    await win.waitForSelector('#list-wrap tbody tr');
    await win.selectOption('#st', 'retard');
    await win.waitForFunction(() => document.querySelector('#list-wrap').textContent.includes('retard'));
    await actionLigne('#list-wrap tbody tr.clickable:first-child', 'Enregistrer un paiement');
    await win.waitForSelector('#pf2');
    // un montant supérieur au reste dû déclenche une confirmation par-dessus le formulaire
    await win.fill('#pf2 input[name=amount]', '999999');
    await win.click('#modal-root .modal-bg:last-child #ok');
    await win.waitForFunction(() => document.querySelectorAll('#modal-root .modal-bg').length === 2);
    if (!(await win.$('#pf2'))) throw new Error('le formulaire de paiement a été détruit par la confirmation');
    // annuler la confirmation laisse le formulaire et sa saisie intacts
    await win.click('#modal-root .modal-bg:last-child [data-close]');
    await win.waitForFunction(() => document.querySelectorAll('#modal-root .modal-bg').length === 1);
    if (await win.inputValue('#pf2 input[name=amount]') !== '999999') throw new Error('saisie perdue');
    // 10.12.0 — « Annuler » sur un formulaire qu'on vient de remplir DEMANDE avant de jeter la saisie :
    // le parcours répond, comme un humain (un e2e qui attendait la fermeture restait bloqué).
    await win.click('#modal-root .modal-bg:last-child [data-close]');
    await win.waitForFunction(() => /Abandonner cette saisie/.test((document.querySelector('#modal-root .modal-bg:last-child') || {}).textContent || ''));
    await win.click('#modal-root .modal-bg:last-child #ok');
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal-bg'));
    await win.selectOption('#st', '');
  });
  await step('catalogue : trois onglets', async () => {
    await win.evaluate(() => { location.hash = '#/catalogue'; });
    await win.waitForSelector('#cat-tabs');
    if ((await win.$$('#cat-tabs button')).length !== 3) throw new Error('onglets');
    await win.click('#cat-tabs button[data-tab="textes"]');
    await win.waitForFunction(() => !document.querySelector('[data-pane="textes"]').hidden && document.querySelector('[data-pane="presta"]').hidden);
    if (!(await win.textContent('#snip-wrap')).includes('Garantie')) throw new Error('textes prédéfinis');
    await win.click('#cat-tabs button[data-tab="presta"]');
  });
  await step('accueil : panneau « À faire » et ses actions', async () => {
    await win.evaluate(() => { location.hash = '#/dashboard'; });
    await win.waitForSelector('.panel.todo');
    const t = await win.textContent('.panel.todo');
    if (!t.includes('en retard') || !t.includes('attestation')) throw new Error(t.slice(0, 300));
    const n = (await win.$$('.panel.todo li')).length; if (n < 4) throw new Error('lignes à faire : ' + n);
    if (!(await win.$('.panel.todo li.lvl-danger'))) throw new Error('aucune ligne urgente');
    await win.click('[data-todo="retards"]');
    await win.waitForFunction(() => location.hash === '#/relances');
  });
  await step('relances : téléphone noté, report, devis sans réponse', async () => {
    await win.waitForSelector('#r-wrap table');
    const r = await win.textContent('#r-wrap');
    if (!r.includes('Reportées')) throw new Error('section reportées absente');
    if (!r.includes('téléphone')) throw new Error('relance téléphonique absente de la démo');
    if (!r.includes('Devis sans réponse')) throw new Error('section devis absente');
    // noter une relance téléphonique sur la première facture
    await actionLigne('#r-wrap tbody tr:first-child', 'Noter un appel téléphonique');
    await win.waitForSelector('#tf');
    await win.fill('#tf input[name=note]', 'Rappelé, paiement annoncé lundi');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => (document.querySelector('#r-wrap') || {}).textContent.includes('Rappelé, paiement annoncé lundi'));
    // relancer un devis
    await win.click('[data-qrem]');
    await win.waitForSelector('#modal-root #b');
    await win.click('#modal-root #b');               // « Continuer quand même » — voir ci-dessus
    await win.waitForSelector('#mf');
    if (!(await win.inputValue('#mf input[name=subject]')).includes('DEV-')) throw new Error('objet de la relance de devis');
    await win.click('#modal-root [data-close]');
  });
  await step('historique d\'un document', async () => {
    await win.evaluate(() => { location.hash = '#/factures'; });
    await win.waitForSelector('#list-wrap tr.clickable');
    // La liste est paginée : on passe par le filtre de statut plutôt que d'espérer la bonne page
    await win.selectOption('#st', 'partielle');
    await win.waitForFunction(() => (document.querySelector('#list-wrap') || {}).textContent.includes('partiellement'));
    await win.evaluate(() => { const tr = Array.from(document.querySelectorAll('#list-wrap tr.clickable')).find(t => t.textContent.includes('partiellement')); tr.click(); });
    await win.waitForSelector('.timeline');
    const tl = await win.textContent('.timeline');
    if (!tl.includes('émise') || !tl.includes('Paiement')) throw new Error(tl.slice(0, 300));
    if (!(await win.$$('.timeline li')).length) throw new Error('historique vide');
  });
  await step('comptabilité : envoi au comptable avec le journal joint', async () => {
    await win.evaluate(() => { location.hash = '#/compta'; });
    await win.waitForSelector('#exp-comptable');
    await win.selectOption('#c-month', '');
    await win.waitForFunction(() => (document.querySelector('#c-body') || {}).textContent.includes('année'));
    await win.click('#exp-comptable');
    await win.waitForSelector('#modal-root #b');
    await win.click('#modal-root #b');               // jeu d'exemple : on prévient, on n'interdit pas
    await win.waitForSelector('#cpf');
    await win.fill('#cpf input[name=to]', 'comptable@cabinet.tn');
    if (!(await win.inputValue('#cpf textarea[name=body]')).includes('journal des ventes')) throw new Error('corps du message');
    await win.click('#modal-root #ok');
    await win.waitForSelector('#toast.show');
    const sent = fs.readdirSync(path.join(userData, 'envois'));
    if (!sent.some(f => f.startsWith('journal-ventes-') && f.endsWith('.csv'))) throw new Error('CSV non écrit : ' + sent.join(','));
    const csv = fs.readFileSync(path.join(userData, 'envois', sent.find(f => f.startsWith('journal-ventes-'))), 'utf8');
    if (!csv.includes('Numéro') || !csv.includes('FAC-')) throw new Error('CSV incomplet');
  });
  await step('statistiques : périodes, comparaison N-1, objectif et export', async () => {
    await win.evaluate(() => { location.hash = '#/stats'; });
    await win.waitForSelector('#s-body .stats');
    if (!(await win.textContent('#s-body')).includes('Chiffre d\'affaires HT')) throw new Error('carte CA absente');
    // la démo couvre 13 mois : la comparaison à l'an dernier doit produire au moins une flèche
    if (!(await win.$$('#s-body .delta')).length) throw new Error('aucune comparaison à l\'an dernier');
    if (!(await win.$$('#s-body svg.chart rect.bar-inv')).length) throw new Error('graphique vide');
    // passage au trimestre : le sélecteur de rang apparaît et le contenu change
    if (!(await win.evaluate(() => document.querySelector('#s-n').hidden))) throw new Error('sélecteur de rang visible en mode année');
    await win.selectOption('#s-kind', 'trimestre');
    await win.waitForFunction(() => !document.querySelector('#s-n').hidden);
    await win.selectOption('#s-n', '1');
    await win.waitForFunction(() => (document.querySelector('#s-body') || {}).textContent.includes('trimestre'));
    if ((await win.$$('#s-body svg.chart text.lbl')).length < 3) throw new Error('graphique trimestriel vide');
    await win.selectOption('#s-kind', 'mois');
    await win.waitForFunction(() => !document.querySelector('#s-n').hidden);
    await win.selectOption('#s-kind', 'annee');
    await win.waitForFunction(() => document.querySelector('#s-n').hidden);
    // objectif : absent au départ, la modale l'enregistre et la jauge apparaît
    await win.click('#s-goal');
    await win.waitForSelector('#gf');
    await win.fill('#gf input[name=target]', '60000');
    await win.click('#modal-root #ok');
    await win.waitForSelector('#s-body .g-bar');
    if (!(await win.textContent('#s-body')).includes('de l\'objectif')) throw new Error('jauge sans légende');
    // le réglage est bien celui de la société, et il se retrouve dans Paramètres
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await setTab('documents');
    if (await win.inputValue('#pf input[name=revenueTarget]') !== '60000') throw new Error('objectif absent des paramètres');
    await win.evaluate(() => { location.hash = '#/stats'; });
    await win.waitForSelector('#s-export');
    await win.click('#s-export');
    await win.waitForSelector('#toast.show');
  });
  await step('autres documents : les quatre onglets, une transformation, une pièce jointe', async () => {
    await win.evaluate(() => { location.hash = '#/autres'; });
    await win.waitForSelector('#a-tabs');
    const tabs = await win.evaluate(() => Array.from(document.querySelectorAll('#a-tabs button')).map(b => b.textContent.replace(/\d+$/, '').trim()));
    if (tabs.length !== 4) throw new Error('onglets : ' + tabs.join(','));
    // la démo contient un exemple de chaque type
    for (const t of ['proforma', 'commande', 'livraison', 'contrat']) {
      await win.evaluate(h => { location.hash = h; }, '#/autres/' + t);
      await win.waitForSelector('#list-wrap table.list');
      const txt = await win.textContent('#list-wrap');
      if (!txt.includes('2026-') && !txt.includes('2025-')) throw new Error('liste vide pour ' + t + ' : ' + txt.slice(0, 200));
    }
    // ouvrir le bon de livraison : les prix sont masqués, l'aperçu n'en montre aucun
    await win.evaluate(() => { location.hash = '#/autres/livraison'; });
    await win.waitForSelector('#list-wrap tr.clickable');
    await win.click('#list-wrap tr.clickable');
    await win.waitForSelector('input[name=hidePrices]');
    if (!(await win.isChecked('input[name=hidePrices]'))) throw new Error('prix non masqués par défaut');
    await win.waitForFunction(() => { const f = document.querySelector('#preview'); return f && f.contentDocument && f.contentDocument.querySelector('.page'); });
    await win.waitForTimeout(300);
    const pv = await win.evaluate(() => document.querySelector('#preview').contentDocument.body.textContent);
    if (!pv.includes('Bon de livraison') || !pv.includes('Reçu conforme')) throw new Error('aperçu du BL : ' + pv.slice(0, 200));
    if (pv.includes('Prix unit')) throw new Error('prix visibles malgré la case cochée');
    // transformer en facture : un brouillon est créé, la filiation est enregistrée
    await win.click('#conv-btn');
    await win.waitForSelector('#conv-list button[data-conv=facture]');
    await win.click('#conv-list button[data-conv=facture]');
    await win.waitForFunction(() => /Facture/.test((document.querySelector('#view h1') || {}).textContent || ''));
    await win.waitForSelector('.timeline');
    if (!(await win.textContent('.timeline')).includes('BL-')) throw new Error('filiation absente de l\'historique');
    // pièces jointes : le panneau existe et annonce ce qu'il fait
    if (!(await win.textContent('#attachments')).includes('Joindre un fichier')) throw new Error('panneau pièces jointes absent');
  });
  await step('contrat à signer : clauses modifiables et imprimées', async () => {
    await win.evaluate(() => { location.hash = '#/autres/contrat'; });
    await win.waitForSelector('#list-wrap tr.clickable');
    await win.click('#list-wrap tr.clickable');
    await win.waitForSelector('#f-clauses textarea[name=objet]');
    await win.fill('#f-clauses textarea[name=preavis]', 'Préavis de soixante (60) jours.');
    await win.waitForFunction(() => { const f = document.querySelector('#preview'); return f && f.contentDocument && f.contentDocument.body
      && /soixante \(60\) jours/.test(f.contentDocument.body.textContent || ''); });
    // vider une clause la retire du document
    await win.fill('#f-clauses textarea[name=confidentialite]', '');
    await win.waitForFunction(() => { const f = document.querySelector('#preview'); return f && f.contentDocument && f.contentDocument.body
      && f.contentDocument.body.textContent && !/Confidentialité/.test(f.contentDocument.body.textContent); });
    await win.click('#save');
    await win.waitForSelector('#toast.show');
  });
  await step('nouvelle proforma : numérotée PRO à l\'enregistrement', async () => {
    await win.evaluate(() => { location.hash = '#/doc/new/proforma'; });
    await win.waitForSelector('#f-head');
    if (await win.$('#modal-root #b')) { await win.click('#modal-root #b'); }
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
    await win.waitForSelector('#f-head [data-combo=clientId]');
    await win.click('#f-head [data-combo=clientId] .combo-btn');
    await win.fill('#f-head [data-combo=clientId] .combo-q', 'lauriers');
    await win.waitForFunction(() => document.querySelectorAll('#f-head [data-combo=clientId] .combo-it').length === 1);
    await win.keyboard.press('Enter');
    await win.fill('input[name=subject]', 'Dossier de financement');
    await win.fill('#lines input[data-k=label]', 'Poste de travail complet');
    await win.fill('#lines input[data-k=unitPrice]', '1800');
    await win.click('#save');
    await win.waitForFunction(() => /PRO-\d{4}-\d{3}/.test((document.querySelector('#view h1') || {}).textContent || ''));
    // pas de timbre par défaut sur une proforma
    if (await win.isChecked('input[name=applyStamp]')) throw new Error('timbre coché par défaut sur une proforma');
    if ((await win.textContent('#totals')).includes('Timbre')) throw new Error('timbre compté sur une proforma');
  });
  await step('achats : fournisseur, facture d\'achat, TVA déductible et règlement', async () => {
    await win.evaluate(() => { location.hash = '#/fournisseurs'; });
    await win.waitForSelector('#list-wrap table.list');
    if (!(await win.textContent('#list-wrap')).includes('Tunisie Matériel')) throw new Error('fournisseurs de la démo absents');
    // fiche fournisseur
    await win.click('#list-wrap tr.clickable');
    await win.waitForSelector('#sup-docs table.list');
    if (!(await win.textContent('#view h1')).trim()) throw new Error('fiche fournisseur vide');
    await win.evaluate(() => { location.hash = '#/achats'; });
    await win.waitForSelector('#list-wrap table.list');
    // le panneau « À payer » est là et se replie
    await win.waitForSelector('#payables');
    await win.click('#pay-h');
    await win.waitForFunction(() => document.querySelector('#pay-body').hidden);
    await win.click('#pay-h');
    await win.waitForFunction(() => !document.querySelector('#pay-body').hidden);
    // créer une facture d'achat complète
    await win.click('#new');
    await win.waitForSelector('#b-head');
    await win.click('#b-head [data-combo=supplierId] .combo-btn');
    await win.fill('#b-head [data-combo=supplierId] .combo-q', 'comptable');
    await win.waitForFunction(() => document.querySelectorAll('#b-head [data-combo=supplierId] .combo-it').length === 1);
    await win.keyboard.press('Enter');
    // la retenue du fournisseur est reprise automatiquement
    await win.waitForFunction(() => document.querySelector('#b-head select[name=withholdingRate]').value === '3');
    await win.fill('#b-head input[name=number]', 'H-2026-099');
    await win.fill('#b-head input[name=subject]', 'Honoraires du mois');
    await win.fill('#b-lines input[data-k=label]', 'Tenue de comptabilité');
    await win.fill('#b-lines input[data-k=unitPrice]', '1000');
    await win.waitForFunction(() => (document.querySelector('#b-totals') || {}).textContent.includes('Retenue'));
    // net à payer = 1190 − 3 % = 1154,300
    if (!(await win.textContent('#b-totals')).includes('1\u00a0154,300')) throw new Error('net à payer : ' + await win.textContent('#b-totals'));
    // TVA non déductible : le total le dit
    await win.uncheck('#b-lines input[data-k=deductible]');
    await win.waitForFunction(() => (document.querySelector('#b-totals') || {}).textContent.includes('déductible'));
    await win.check('#b-lines input[data-k=deductible]');
    await win.click('#save');
    await win.waitForSelector('#b-pay');
    // régler partiellement : le statut devient « partiel »
    await win.click('#pay2');
    await win.waitForSelector('#spf');
    await win.fill('#spf input[name=amount]', '400');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => (document.querySelector('#b-pay') || {}).textContent.includes('partiel'));
    if (!(await win.textContent('#b-pay')).includes('754,300')) throw new Error('reste dû : ' + await win.textContent('#b-pay'));
    // l'attestation de retenue se coche
    await win.check('#rs-cert2');
    await win.waitForTimeout(200);
  });
  await step('achats : destination des lignes et filtres de la liste', async () => {
    await win.evaluate(() => { location.hash = '#/achats'; });
    await win.waitForSelector('#list-wrap table.list');
    const before = await win.evaluate(() => document.querySelectorAll('#list-wrap tbody tr').length);
    await win.selectOption('#kind', 'depense');
    await win.waitForFunction(n => document.querySelectorAll('#list-wrap tbody tr').length < n, before);
    if (!(await win.textContent('#list-wrap')).includes('dépense')) throw new Error('filtre dépense');
    await win.click('#reset-f');
    await win.waitForFunction(n => document.querySelectorAll('#list-wrap tbody tr').length === n, before);
    // une ligne en immobilisation existe bien dans la démo : elle prépare le module 3.4.0
    const dest = await win.evaluate(() => window.SkanCore.LINE_DESTINATIONS.map(d => d[0]));
    if (dest.join() !== 'charge,stock,immobilisation') throw new Error('destinations : ' + dest.join());
  });
  await step('accueil : les échéances fournisseurs apparaissent dans « À faire »', async () => {
    await win.evaluate(() => { location.hash = '#/dashboard'; });
    await win.waitForSelector('.todo');
    const t = await win.textContent('.todo');
    if (!t.includes('fournisseur')) throw new Error('rien sur les fournisseurs dans À faire : ' + t.slice(0, 300));
  });
  await step('comptabilité : les dix onglets, la TVA réelle et le calendrier', async () => {
    await win.evaluate(() => { location.hash = '#/compta'; });
    await win.waitForSelector('#c-tabs');
    const tabs = await win.evaluate(() => Array.from(document.querySelectorAll('#c-tabs button[data-tab]')).map(b => b.textContent.trim()));
    // 8.8.0 → 9.0.0 : Grand livre, Balance et États financiers se sont ajoutés entre Écritures et le
    // calendrier. **9.1.0 : ils sont MASQUÉS par défaut** — ce sont les écrans du comptable, et
    // l'app entreprise s'arrête à la gestion (DIRECTION.md). L'assertion a donc été retournée :
    // elle décrivait l'état du jour, pas la règle. Ce qui est garanti à tout le monde, c'est que les
    // sept autres ne se masquent jamais, et que la porte de l'option dit où les retrouver.
    // Le sélecteur porte `[data-tab]` : `#c-plus` est un bouton du même conteneur, pas un onglet.
    if (tabs.join(',') !== 'Ventes,Achats,TVA à payer,Écritures,Calendrier fiscal,Clôtures,Cabinet') throw new Error('onglets : ' + tabs.join(','));
    if (!(await win.$('#c-plus'))) throw new Error('un écran qui masque quelque chose doit dire où le retrouver');
    // onglet Écritures : équilibre annoncé, plan de comptes modifiable
    await win.click('#c-tabs button[data-tab=ecritures]');
    await win.waitForSelector('#ecr-csv');
    const eq = await win.evaluate(() => !!document.querySelector('.todo-ok') && document.querySelectorAll('#ecr-t tbody tr').length > 0);
    if (!eq) throw new Error('écritures : pas d\'équilibre annoncé ou aucune ligne');
    await win.click('#ecr-plan'); await win.waitForSelector('#chf');
    await win.fill('#chf input[name=clients]', '4111'); await win.click('#ch-ok');
    await win.waitForTimeout(400);
    // 8.9.0 : la colonne N° s'est mise en tête, le compte est la cinquième colonne.
    const chg = await win.evaluate(() => [...document.querySelectorAll('#ecr-t tbody tr td:nth-child(5)')].map(e => e.textContent.trim()));
    if (!chg.includes('4111') || chg.includes('411')) throw new Error('plan de comptes non appliqué : ' + chg.slice(0, 5).join(','));
    await win.click('#ecr-plan'); await win.waitForSelector('#chf'); await win.click('#ch-reset');
    // Depuis la 7.12.0, jeter les comptes que le cabinet a dictés demande d'abord.
    await win.waitForSelector('#modal-root #ok');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
    await win.waitForTimeout(400);

    // onglet Achats : journal et ventilation par catégorie
    await win.click('#c-tabs button[data-tab=achats]');
    await win.waitForSelector('#b-wrap table.list');
    const ach = await win.textContent('#c-body');
    if (!ach.includes('Où part ton argent')) throw new Error('ventilation par catégorie absente');
    if (!ach.includes('TVA déductible')) throw new Error('TVA déductible absente');
    // onglet TVA : la soustraction et le tableau mois par mois
    await win.click('#c-tabs button[data-tab=tva]');
    await win.waitForSelector('.vat-box');
    const tva = await win.textContent('#c-body');
    if (!tva.includes('TVA collectée') || !tva.includes('TVA déductible')) throw new Error('déclaration incomplète');
    if (!tva.includes('Résultat avant impôt')) throw new Error('résultat simplifié absent');
    // le total « à payer » de l'année est cohérent avec la somme des mois calculée par le cœur
    const ok = await win.evaluate(() => {
      const C = window.SkanCore;
      const d = window.__data, co = d.company;
      const year = new Date().toISOString().slice(0, 4);
      const chain = C.vatChain(d, co, year, 12);
      // un crédit ne doit jamais coexister avec un montant à payer sur le même mois
      return chain.every(m => !(m.toPay > 0 && m.carryOut > 0));
    });
    if (!ok) throw new Error('un mois affiche à la fois un montant à payer et un crédit');
    // crédit de TVA de l'année précédente
    await win.click('#set-carry');
    await win.waitForSelector('#pr');
    await win.fill('#pr input[name=v]', '250');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => (document.querySelector('#set-carry') || {}).textContent.includes('250'));
    // onglet Calendrier : activer une échéance la fait apparaître
    await win.click('#c-tabs button[data-tab=calendrier]');
    await win.waitForSelector('[data-active=tcl]');
    if (await win.isChecked('[data-active=tcl]')) throw new Error('TCL active par défaut');
    await win.check('[data-active=tcl]');
    await win.waitForFunction(() => (document.querySelector('#c-body') || {}).textContent.includes('TCL'));
    // le sélecteur de période est masqué sur le calendrier : il n'a pas de sens
    if (!(await win.evaluate(() => document.querySelector('#c-period').hidden))) throw new Error('période affichée sur le calendrier');
    await win.click('#c-tabs button[data-tab=ventes]');
    await win.waitForSelector('#j-wrap');
    if (await win.evaluate(() => document.querySelector('#c-period').hidden)) throw new Error('période masquée sur les ventes');
  });
  await step('dossiers : liste, création, bascule et retour', async () => {
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await setTab('donnees');
    await win.waitForSelector('#dossiers-list table.list');
    const first = await win.textContent('#dossiers-list');
    if (!first.includes('ouvert')) throw new Error('aucun dossier ouvert : ' + first.slice(0, 200));
    if ((await win.evaluate(() => document.querySelectorAll('#dossiers-list tbody tr').length)) !== 1) throw new Error('plus d\'un dossier au départ');
    // le nom du poste est modifiable
    await win.fill('#dev-name', 'PC du bureau');
    await win.click('#dev-save');
    await win.waitForSelector('#toast.show');
    // créer un second dossier : l'app se recharge dessus, vierge
    await win.click('#dos-add');
    await win.waitForSelector('#pr');
    await win.fill('#pr input[name=v]', 'Darium');
    await win.click('#modal-root #ok');
    // le nouveau dossier est vide : l'assistant de première utilisation reprend la main
    await win.waitForSelector('#setup', { timeout: 20000 });
    await win.click('#sf-next'); await win.waitForSelector('#sf-form input[name=name]');
    await win.fill('#sf-form input[name=name]', 'Darium SARL');
    await win.fill('#sf-form input[name=matricule]', '1111111A/A/000');
    await win.click('#sf-next'); await win.waitForSelector('[data-act="commerce"]'); await win.click('[data-act="commerce"]');
    await win.click('#sf-next'); await win.waitForSelector('#sf-mods');
    await win.click('#sf-next'); await win.waitForSelector('#sf-form input[name=paymentTermsDays]');
    await win.click('#sf-next'); await win.waitForSelector('#sf-form input[name=rib]');
    await win.click('#sf-next'); await win.waitForSelector('#sf-ext');
    await win.click('#sf-next'); await win.waitForFunction(() => !document.querySelector('#setup'));
    if (!(await win.textContent('#brand-company')).includes('Darium')) throw new Error('mauvais dossier ouvert');
    // les données de l'autre dossier ne sont PAS là : c'est tout l'intérêt
    const n = await win.evaluate(() => (window.__data.documents || []).length);
    if (n !== 0) throw new Error('le nouveau dossier contient ' + n + ' documents');
    // le nom du poste est propre à l'ordinateur, pas au dossier : il a survécu
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await setTab('donnees');
    await win.waitForSelector('#dossiers-list table.list');
    if ((await win.inputValue('#dev-name')) !== 'PC du bureau') throw new Error('nom du poste perdu au changement de dossier');
    if ((await win.evaluate(() => document.querySelectorAll('#dossiers-list tbody tr').length)) !== 2) throw new Error('le second dossier manque');
    // revenir au premier : la démo y est toujours
    await win.click('#dossiers-list [data-open]');
    await win.waitForFunction(() => window.__data && (window.__data.documents || []).length > 10, null, { timeout: 20000 });
    if (!(await win.textContent('#brand-company')).includes('Menuiserie')) throw new Error('retour sur le mauvais dossier');
  });
  await step('partage : un autre poste a écrit, la fusion reprend son travail sans perdre le nôtre', async () => {
    // On simule l'autre poste en écrivant directement dans le fichier du dossier, avec une révision plus haute.
    const dataFile = dataFileOf();
    const before = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const mien = await win.evaluate(() => JSON.parse(JSON.stringify(window.__data)));
    const theirs = JSON.parse(JSON.stringify(before));
    theirs.clients.push({ id: 'venu-dailleurs', name: 'Client de l\'autre poste', matricule: '', address: '', phone: '', email: '', notes: '', withholdingRate: '' });
    theirs.syncRevision = (Number(before.syncRevision) || 0) + 5;
    theirs.syncDeviceName = 'Mac de papa';
    theirs.syncWrittenAt = Date.now() + 60000;
    fs.writeFileSync(dataFile, JSON.stringify(theirs, null, 2));
    // de notre côté, on crée un client puis on enregistre : le conflit doit se résoudre tout seul
    await win.evaluate(() => { location.hash = '#/clients'; });
    await win.waitForSelector('#list-wrap');
    await win.click('#new');
    await win.waitForSelector('#cf');
    await win.fill('#cf input[name=name]', 'Client de ce poste');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => {
      const c = (window.__data.clients || []).map(x => x.name);
      return c.includes('Client de ce poste') && c.includes('Client de l\'autre poste');
    }, null, { timeout: 20000 });
    // le fichier sur le disque contient bien les deux
    const after = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const names = after.clients.map(c => c.name);
    if (!names.includes('Client de ce poste') || !names.includes('Client de l\'autre poste')) throw new Error('fusion incomplète : ' + names.join(', '));
    if ((Number(after.syncRevision) || 0) <= theirs.syncRevision) throw new Error('révision non incrémentée');
    if (mien.clients.length >= after.clients.length) throw new Error('la fusion n\'a rien ajouté');
  });
  await step('trésorerie : comptes, prévision, mouvement libre et rapprochement', async () => {
    await win.evaluate(() => { location.hash = '#/tresorerie'; });
    await win.waitForSelector('#t-tabs');
    const tabs = await win.evaluate(() => Array.from(document.querySelectorAll('#t-tabs button')).map(b => b.textContent.trim()));
    if (tabs.length !== 4) throw new Error('onglets : ' + tabs.join(','));
    await win.waitForSelector('#t-body table.list');
    const pos = await win.textContent('#t-body');
    if (!pos.includes('BIAT')) throw new Error('comptes de la démo absents');
    if (!pos.includes('Total disponible')) throw new Error('total absent');
    // le solde affiché est bien celui que le coeur calcule
    const ok = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      const pos = C.cashPosition(d, d.company, C.today());
      const recompose = C.round3(pos.accounts.reduce((s, a) => s + a.opening + a.movements, 0));
      return pos.total === recompose && pos.accounts.length === 2;
    });
    if (!ok) throw new Error('le total des comptes ne se recompose pas');
    // prévision : la courbe et le détail
    await win.click('#t-tabs button[data-tab=prevision]');
    await win.waitForSelector('svg.forecast');
    if (!(await win.$$('svg.forecast circle')).length) throw new Error('aucun point sur la courbe');
    await win.selectOption('#t-days', '30');
    await win.waitForTimeout(300);
    await win.selectOption('#t-days', '90');
    await win.waitForFunction(() => document.querySelector('svg.forecast'));
    // mouvements : en créer un libre, vérifier qu'il change le solde
    await win.click('#t-tabs button[data-tab=mouvements]');
    await win.waitForSelector('#m-wrap table.list');
    const avant = await win.evaluate(() => { const C = window.SkanCore, d = window.__data; return C.cashPosition(d, d.company, C.today()).total; });
    await win.click('#new-move');
    await win.waitForSelector('#mf2');
    await win.selectOption('#mf2 select[name=kind]', 'impot');
    await win.fill('#mf2 input[name=amount]', '1000');
    await win.fill('#mf2 input[name=label]', 'Acompte de test');
    await win.click('#modal-root #ok');
    await win.waitForFunction(a => {
      const C = window.SkanCore, d = window.__data;
      return C.round3(C.cashPosition(d, d.company, C.today()).total) === C.round3(a - 1000);
    }, avant);
    if (!(await win.textContent('#t-body')).includes('Acompte de test')) throw new Error('mouvement absent de la liste');
    // rapprochement : pointer un mouvement change le solde pointé
    await win.click('#t-tabs button[data-tab=rapprochement]');
    await win.waitForSelector('#stmt');
    const n0 = await win.evaluate(() => document.querySelectorAll('[data-rec]').length);
    if (!n0) throw new Error('rien à pointer');
    // `check()` revérifie l'élément après le clic ; or le panneau se redessine et l'élément est détaché,
    // ce qui fait recommencer Playwright sur la ligne suivante. Un simple clic suffit.
    await win.click('[data-rec]');
    await win.waitForFunction(n => document.querySelectorAll('[data-rec]').length < n, n0);
    // saisir le solde du relevé fait apparaître l'écart
    await win.fill('#stmt', '1');
    await win.evaluate(() => document.querySelector('#stmt').dispatchEvent(new Event('change', { bubbles: true })));
    await win.waitForFunction(() => (document.querySelector('#t-body') || {}).textContent.includes('Écart de'));
  });
  await step('marges : affaires, analyse, contrats, seuil de rentabilité', async () => {
    await win.evaluate(() => { location.hash = '#/marges'; });
    await win.waitForSelector('#mg-tabs');
    const tabs = await win.evaluate(() => Array.from(document.querySelectorAll('#mg-tabs button')).map(b => b.textContent.trim()));
    if (tabs.length !== 4) throw new Error('onglets : ' + tabs.join(','));
    await win.waitForSelector('#mg-body table.list');
    const aff = await win.textContent('#mg-body');
    if (!aff.includes('École Les Lauriers')) throw new Error('affaire de la démo absente');
    // la marge affichée est bien celle que le coeur calcule
    const exact = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      const p = d.projects.find(x => /Lauriers/.test(x.name));
      const m = C.projectMargin(d, d.company, p.id);
      return m.revenue > 0 && m.cost > 0 && C.round3(m.revenue - m.cost) === m.margin;
    });
    if (!exact) throw new Error('marge de l\'affaire incohérente');
    // fiche d'affaire : ventes et achats rattachés
    await win.click('#mg-body tr[data-pid]');
    await win.waitForSelector('#p-sales');            // la fiche est dessinée (le hash change avant le rendu)
    const fiche = await win.textContent('#view');
    if (!fiche.includes('Ventes rattachées') || !fiche.includes('Achats rattachés')) throw new Error('fiche incomplète');
    if (fiche.includes('Aucun achat rattaché')) throw new Error('achat non rattaché');
    await win.click('#view .actions .btn');           // Précédent
    await win.waitForFunction(() => location.hash === '#/marges');
    // où est la marge
    await win.click('#mg-tabs button[data-tab=analyse]');
    await win.waitForSelector('#mg-dim');
    if (!(await win.textContent('#mg-body')).includes('Marge par client')) throw new Error('analyse par client');
    await win.selectOption('#mg-dim', 'item');
    await win.waitForFunction(() => document.querySelector('#mg-body').textContent.includes('Marge par prestation'));
    // contrats
    await win.click('#mg-tabs button[data-tab=contrats]');
    await win.waitForSelector('#mg-body tr[data-rid]');
    // seuil de rentabilité : reclasser une catégorie change le seuil
    await win.click('#mg-tabs button[data-tab=seuil]');
    await win.waitForSelector('#mg-body .gauge');
    const seuil0 = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, y = C.today().slice(0, 4);
      return C.breakEven(d, d.company, { from: y + '-01-01', to: y + '-12-31' }).breakEven;
    });
    if (!(seuil0 > 0)) throw new Error('seuil non calculé');
    const box = await win.textContent('#mg-body');
    if (!box.includes('Charges fixes') || !box.includes('Charges variables')) throw new Error('bloc du seuil incomplet');
    await win.click('#mg-body [data-fix]');          // une catégorie fixe passe en variable
    await win.waitForFunction(s0 => {
      const C = window.SkanCore, d = window.__data, y = C.today().slice(0, 4);
      return C.breakEven(d, d.company, { from: y + '-01-01', to: y + '-12-31' }).breakEven !== s0;
    }, seuil0);
  });
  await step('affaire : rattacher un document depuis l\'éditeur', async () => {
    await win.evaluate(() => {
      const d = window.__data;
      // un devis d'un client qui a déjà une affaire : sinon la liste des affaires serait vide
      const ids = new Set(d.projects.map(p => p.clientId));
      const q = d.documents.find(x => x.type === 'devis' && !x.projectId && ids.has(x.clientId));
      location.hash = '#/doc/' + q.id;
    });
    await win.waitForSelector('#f-head [data-combo=projectId]');
    const before = await win.evaluate(() => document.querySelector('#f-head input[name=projectId]').value);
    await win.click('#f-head [data-combo=projectId] .combo-btn');
    await win.waitForSelector('#f-head [data-combo=projectId] .combo-it');
    await win.click('#f-head [data-combo=projectId] .combo-it');
    await win.waitForFunction(b => document.querySelector('#f-head input[name=projectId]').value !== b, before);
    // enregistrer : le rattachement doit tenir dans les données, et l'éditeur ne doit plus être « sale »
    await win.click('#save');
    await win.waitForSelector('#toast.show');
    const lie = await win.evaluate(() => {
      const d = window.__data, id = location.hash.split('/')[2];
      const doc = d.documents.find(x => x.id === id);
      return !!(doc && doc.projectId && d.projects.some(p => p.id === doc.projectId));
    });
    if (!lie) throw new Error('affaire non enregistrée sur le document');
  });
  await step('catalogue : coût de revient et marge en direct', async () => {
    await win.evaluate(() => { location.hash = '#/catalogue'; });
    // « Modifier la prestation » vit dans le menu d'actions de la ligne depuis la 7.29.0.
    await win.waitForSelector('#list-wrap [data-rowmenu]');
    await win.click('#list-wrap [data-rowmenu] >> nth=0');
    await win.waitForSelector('.row-menu');
    const iMod = await win.evaluate(() => [...document.querySelectorAll('.row-menu .rm-l')]
      .findIndex(x => /^Modifier la prestation/.test(x.textContent.trim())));
    if (iMod < 0) throw new Error('le menu du catalogue ne propose pas de modifier la prestation');
    await win.click(`.row-menu button >> nth=${iMod}`);
    await win.waitForSelector('#kf input[name=unitCost]');
    await win.fill('#kf input[name=unitCost]', '10');
    await win.fill('#kf input[name=unitPrice]', '100');
    await win.waitForFunction(() => (document.querySelector('#marge-hint') || {}).textContent.includes('90'));
    await win.fill('#kf input[name=unitCost]', '200');
    await win.waitForFunction(() => (document.querySelector('#marge-hint') || {}).textContent.includes('perte'));
    // 10.12.0 — la fiche a été modifiée : « Annuler » demande avant de jeter, et l'on abandonne.
    await win.click('#modal-root [data-close]');
    await win.waitForFunction(() => /Abandonner cette saisie/.test((document.querySelector('#modal-root .modal-bg:last-child') || {}).textContent || ''));
    await win.click('#modal-root .modal-bg:last-child #ok');
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal-bg'));
  });
  await step('immobilisations : tableau, fiche, création depuis un achat, cession', async () => {
    await win.evaluate(() => { location.hash = '#/immos'; });
    await win.waitForSelector('#im-tabs');
    const tabs = await win.evaluate(() => Array.from(document.querySelectorAll('#im-tabs button')).map(b => b.textContent.trim()));
    if (tabs.length !== 3) throw new Error('onglets : ' + tabs.join(','));
    await win.waitForSelector('#im-body table.list');
    const tab = await win.textContent('#im-body');
    if (!tab.includes('Camionnette')) throw new Error('immobilisations de la démo absentes');
    // le tableau affiché est bien ce que le coeur calcule
    const ok = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, y = Number(C.today().slice(0, 4));
      const t = C.assetTotals(d, y);
      const recompose = C.round3(t.rows.reduce((s, r) => s + r.annuity, 0));
      return t.annuity === recompose && t.count > 0;
    });
    if (!ok) throw new Error('le total des dotations ne se recompose pas');
    // fiche : plan d'amortissement complet, la dernière ligne solde la valeur
    await win.click('#im-body tr[data-aid]');
    // `#dispose` n'existe que sur la fiche : attendre un `table.list` matcherait la page de départ,
    // qui en a déjà un — le hash change avant le rendu, et le test devient une loterie.
    await win.waitForSelector('#dispose');
    const fiche = await win.textContent('#view');
    if (!fiche.includes('Plan d\'amortissement')) throw new Error('plan absent');
    const solde = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, id = location.hash.split('/')[2];
      const a = d.assets.find(x => x.id === id);
      const rows = C.assetSchedule(a);
      const last = rows[rows.length - 1];
      return C.round3(last.cumulated + (Number(a.residual) || 0)) === C.round3(Number(a.amount));
    });
    if (!solde) throw new Error('le plan ne solde pas la valeur d\'acquisition');
    await win.click('#view .actions .btn');            // Précédent
    await win.waitForFunction(() => location.hash === '#/immos');
    // à immobiliser : la ligne d'achat en attente devient une fiche
    await win.click('#im-tabs button[data-tab=attente]');
    await win.waitForSelector('#im-body [data-mk]');
    const avant = await win.evaluate(() => window.__data.assets.length);
    await win.click('#im-body [data-mk]');
    await win.waitForSelector('#imf input[name=label]');
    const pre = await win.evaluate(() => document.querySelector('#imf input[name=amount]').value);
    if (!(Number(pre) > 0)) throw new Error('valeur non reprise de la ligne d\'achat');
    await win.fill('#imf input[name=years]', '5');
    await win.click('#modal-root #ok');
    await win.waitForFunction(n => window.__data.assets.length === n + 1, avant);
    // la ligne ne revient plus en attente
    const reste = await win.evaluate(() => window.SkanCore.assetsToCreate(window.__data).length);
    if (reste !== 0) throw new Error('la ligne revient en attente : ' + reste);
    // cession : la plus-value est annoncée avant d'enregistrer
    await win.evaluate(() => {
      const d = window.__data;
      const a = d.assets.find(x => !x.disposal && x.amount >= 2000);
      location.hash = '#/immo/' + a.id;
    });
    await win.waitForSelector('#dispose');
    await win.click('#dispose');
    await win.waitForSelector('#dsf input[name=amount]');
    await win.fill('#dsf input[name=amount]', '500');
    await win.waitForFunction(() => /plus-value|moins-value/.test(document.querySelector('#dsf-hint').textContent));
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => document.querySelector('#view').textContent.includes('Sorti le'));
    // l'année suivante, plus aucune dotation pour ce bien
    const apres = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, id = location.hash.split('/')[2];
      const a = d.assets.find(x => x.id === id);
      return C.assetYear(a, Number(a.disposal.date.slice(0, 4)) + 1).annuity;
    });
    if (apres !== 0) throw new Error('le bien sorti continue de s\'amortir : ' + apres);
  });
  await step('résultat simplifié : la dotation pèse sur le résultat', async () => {
    await win.evaluate(() => { location.hash = '#/compta'; });
    await win.waitForSelector('#c-tabs');
    await win.click('#c-tabs button[data-tab=tva]');
    await win.waitForFunction(() => document.querySelector('#c-body').textContent.includes('Résultat simplifié'));
    const body = await win.textContent('#c-body');
    if (!body.includes('Dotation aux amortissements')) throw new Error('dotation absente du résultat');
    const coherent = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, y = C.today().slice(0, 4);
      const r = C.simpleResult(d, d.company, { from: y + '-01-01', to: y + '-12-31' });
      return r.depreciation > 0 && r.resultat === C.round3(r.produits - r.charges - r.cogs - r.depreciation - r.payroll);
    });
    if (!coherent) throw new Error('le résultat ne retire pas la dotation');
  });
  await step('stock : état, mouvements, alertes, inventaire', async () => {
    await win.evaluate(() => { location.hash = '#/stock'; });
    await win.waitForSelector('#st-tabs');
    const tabs = await win.evaluate(() => Array.from(document.querySelectorAll('#st-tabs button')).map(b => b.textContent.trim()));
    if (tabs.length !== 5) throw new Error('onglets : ' + tabs.join(','));
    await win.waitForSelector('#st-body table.list');
    const etat = await win.textContent('#st-body');
    if (!etat.includes('Pare-feu UTM')) throw new Error('articles suivis absents');
    // le stock affiché est bien celui que le coeur déduit des pièces
    const ok = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      const l = C.stockList(d);
      return l.length >= 3 && l.every(r => r.qty === C.runningStock(C.stockMovements(d, r.itemId)).qty);
    });
    if (!ok) throw new Error('le stock ne se recompose pas');
    // mouvements : cliquer une ligne ouvre la pièce d'origine
    await win.click('#st-tabs button[data-tab=mouvements]');
    await win.waitForSelector('#st-body table.list');
    if (!(await win.$$('#st-body tr[data-go]')).length) throw new Error('aucun mouvement rattaché à une pièce');
    // alertes : l'article sous son seuil est là
    await win.click('#st-tabs button[data-tab=alertes]');
    await win.waitForSelector('#st-body');
    const al = await win.textContent('#st-body');
    if (!/seuil|Rupture|négatif/i.test(al)) throw new Error('alertes : ' + al.replace(/\s+/g, ' ').slice(0, 200));
    // un mouvement de casse fait baisser le stock
    await win.click('#st-tabs button[data-tab=etat]');
    await win.waitForSelector('#st-body table.list');
    const avant = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      const it = d.catalog.find(c => c.tracked && C.stockOf(d, c.id).qty > 2);
      return { id: it.id, qty: C.stockOf(d, it.id).qty };
    });
    await win.click('#st-adj');
    await win.waitForSelector('#adf input[name=qty]');
    await win.evaluate(id => {
      const el = document.querySelector('#adf input[name=itemId]');
      el.value = id; el.dispatchEvent(new Event('change', { bubbles: true }));
    }, avant.id);
    await win.fill('#adf input[name=qty]', '-2');
    await win.click('#modal-root #ok');
    await win.waitForFunction(a => window.SkanCore.stockOf(window.__data, a.id).qty === a.qty - 2, avant);
    // inventaire : l'écart est annoncé, puis enregistré comme mouvement
    await win.click('#st-tabs button[data-tab=inventaire]');
    await win.waitForSelector('#st-body .inv-in');
    const cible = await win.evaluate(a => a.id, avant);
    await win.fill(`#st-body .inv-in[data-iid="${cible}"]`, '1');
    await win.waitForFunction(() => !document.querySelector('#inv-apply').disabled);
    const nAvant = await win.evaluate(() => window.__data.stockAdjustments.length);
    await win.click('#inv-apply');
    await win.waitForSelector('#modal-root #ok');
    await win.click('#modal-root #ok');
    await win.waitForFunction(n => window.__data.stockAdjustments.length > n, nAvant);
    const apres = await win.evaluate(id => window.SkanCore.stockOf(window.__data, id).qty, cible);
    if (apres !== 1) throw new Error('le stock n\'a pas été aligné sur le comptage : ' + apres);
  });
  await step('stock : on prévient avant d\'émettre une pièce qui vide le stock', async () => {
    // On part d'un brouillon de la démo : il a déjà toutes les propriétés que la validation attend.
    const id = await win.evaluate(() => {
      const d = window.__data;
      const it = d.catalog.find(c => c.tracked);
      const doc = d.documents.find(x => x.type === 'facture' && x.status === 'brouillon');
      doc.lines = [{ label: it.label, itemId: it.id, qty: 999, unit: it.unit || '', unitPrice: it.unitPrice || 100, vatRate: 19 }];
      return doc.id;
    });
    await win.evaluate(i => { location.hash = '#/doc/' + i; }, id);
    await win.waitForSelector('#issue');
    await win.click('#issue');
    await win.waitForSelector('#modal-root #ok');
    const box = await win.textContent('#modal-root');
    if (!/Stock insuffisant/.test(box)) throw new Error('pas d\'avertissement de stock : ' + box.replace(/\s+/g, ' ').slice(0, 250));
    await win.click('#modal-root [data-close]');
    await win.evaluate(() => { location.hash = '#/stock'; });
  });
  await step('résultat simplifié : le coût des marchandises vendues est une charge', async () => {
    await win.evaluate(() => { location.hash = '#/compta'; });
    await win.waitForSelector('#c-tabs');
    await win.click('#c-tabs button[data-tab=tva]');
    await win.waitForFunction(() => document.querySelector('#c-body').textContent.includes('Résultat simplifié'));
    // Le libellé est devenu « Coût des sorties de stock » en 10.12.0 : la matière utilisée et la casse
    // y entrent aussi. Ce qui compte est que la carte soit là ; son montant se vérifie juste après.
    if (!(await win.textContent('#c-body')).includes('Coût des sorties de stock')) throw new Error('le coût du stock est absent du résultat');
    const coherent = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, y = C.today().slice(0, 4);
      const p = { from: y + '-01-01', to: y + '-12-31' };
      const r = C.simpleResult(d, d.company, p);
      return r.cogs > 0 && r.resultat === C.round3(r.produits - r.charges - r.cogs - r.depreciation - r.payroll)
        && C.breakEven(d, d.company, p).cogs === r.cogs;
    });
    if (!coherent) throw new Error('le résultat ne retire pas le coût des marchandises vendues');
  });
  await step('numéros de série : entrée, attribution, parc client, garanties', async () => {
    await win.evaluate(() => { location.hash = '#/stock'; });
    await win.waitForSelector('#st-tabs');
    await win.click('#st-tabs button[data-tab=series]');
    await win.waitForSelector('#st-body table.list');
    const liste = await win.textContent('#st-body');
    if (!/UTM-|PC-/.test(liste)) throw new Error('numéros de la démo absents');
    // entrée : coller trois numéros
    const avant = await win.evaluate(() => window.__data.serials.length);
    await win.click('#se-add');
    await win.waitForSelector('#sif textarea[name=list]');
    await win.fill('#sif textarea[name=list]', 'TEST-001\nTEST-002\nTEST-002\n\nTEST-003');
    await win.click('#modal-root #ok');
    // le doublon dans la liste collée n'est enregistré qu'une fois
    await win.waitForFunction(n => window.__data.serials.length === n + 3, avant);
    // attribution depuis une facture : le parc du client s'en trouve enrichi
    const ctx = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      const it = d.catalog.find(c => c.serialized);
      const doc = d.documents.find(x => x.type === 'facture' && x.status !== 'brouillon' && x.status !== 'annulée'
        && (x.lines || []).some(l => C.itemOfLine(l, d) && C.itemOfLine(l, d).serialized));
      return { docId: doc.id, clientId: doc.clientId, itemId: it.id,
        parc: C.clientFleet(d, doc.clientId).length };
    });
    await win.evaluate(i => { location.hash = '#/doc/' + i; }, ctx.docId);
    await win.waitForSelector('#more-btn');
    await win.click('#more-btn');
    await win.waitForSelector('#serials');
    await win.click('#serials');
    await win.waitForSelector('#sa-body [data-pick]');
    // cocher une unité encore en stock
    const libre = await win.evaluate(() => {
      const row = Array.from(document.querySelectorAll('#sa-body [data-pick]')).find(cb => !cb.checked);
      return row ? row.dataset.pick : null;
    });
    if (!libre) throw new Error('aucune unité disponible à attribuer');
    await win.click(`#sa-body [data-pick="${libre}"]`);
    await win.click('#modal-root #ok');
    await win.waitForFunction(c => {
      const C = window.SkanCore, d = window.__data;
      return C.clientFleet(d, c.clientId).length === c.parc + 1;
    }, ctx);
    // la garantie de l'unité attribuée court bien de la date du document
    const okGar = await win.evaluate(a => {
      const C = window.SkanCore, d = window.__data;
      const x = d.serials.find(y => y.id === a.id);
      const doc = d.documents.find(y => y.id === a.docId);
      if (!x || x.status !== 'vendu' || x.outDate !== doc.date) return false;
      const end = C.warrantyEnd(x);
      return x.warrantyMonths ? !!end && end > doc.date : end === '';
    }, { id: libre, docId: ctx.docId });
    if (!okGar) throw new Error('la garantie ne démarre pas à la date du document');
    // la fiche client montre le parc
    await win.evaluate(i => { location.hash = '#/client/' + i; }, ctx.clientId);
    await win.waitForSelector('#cl-docs');
    if (!(await win.textContent('#view')).includes('Matériel installé chez ce client')) throw new Error('parc absent de la fiche client');
    // page Garanties
    await win.evaluate(() => { location.hash = '#/garanties'; });
    await win.waitForSelector('#g-days');
    const g = await win.textContent('#view');
    if (!/Garanties qui se terminent/.test(g)) throw new Error('page garanties incomplète');
    const coherent = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      return C.warrantiesEnding(d, 90).every(x => x.warrantyEndDate >= C.today());
    });
    if (!coherent) throw new Error('une garantie déjà expirée est annoncée comme à venir');
  });
  // Depuis la 8.7.0 la lecture est en PAUSE : le panneau ne se pose plus dans les Paramètres (ni
  // sommaire, ni recherche, ni Cmd+K), et le service refuse toujours de lire sans clé.
  await step('lecture de factures : en pause — aucun panneau, et rien ne sort', async () => {
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await setTab('donnees');
    await win.waitForSelector('#set-tabs');
    await win.waitForTimeout(400);
    const pose = await win.evaluate(() => ({
      panneau: !!document.querySelector('#p-ocr') || !!document.querySelector('#ocr-panel'),
      sommaire: [...document.querySelectorAll('[data-somm]')].some(el => /lecture de factures/i.test(el.textContent || ''))
    }));
    if (pose.panneau) throw new Error('le panneau de lecture de photo ne doit plus être posé pendant la pause');
    if (pose.sommaire) throw new Error('le sommaire des Paramètres propose encore la lecture de factures');
    // le service refuse de lire tant qu'aucune clé n'est enregistrée : c'est la garantie, pas un détail
    const refus = await win.evaluate(async () => {
      try { await window.skanfact.ocrRead('/tmp/inexistant.jpg'); return ''; }
      catch (e) { return String(e.message || e); }
    });
    if (!/clé/i.test(refus)) throw new Error('la lecture sans clé ne refuse pas clairement : ' + refus);
    const st = await win.evaluate(() => window.skanfact.ocrStatus());
    if (st.hasKey) throw new Error('une clé est enregistrée alors qu\'aucune n\'a été saisie');
    // la normalisation de ce qui serait lu est testable sans réseau
    const ok = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      const r = C.ocrToPurchase({ supplier: 'Inconnu', number: '', date: '18/07/2026', totalHT: '1 000,000',
        lines: [{ label: 'X', qty: '2', unitPrice: '400,000', vatRate: '19' }] }, d, C.today());
      return r.head.date === '2026-07-18' && r.computedHT === 800 && r.warnings.length === 3;
    });
    if (!ok) throw new Error('la normalisation de la lecture est incohérente');
  });
  await step('achat : « Joindre un justificatif » est là avant toute saisie, et « Lire une photo » n\'apparaît pas sans clé', async () => {
    await win.evaluate(() => { location.hash = '#/achat/new'; });
    await win.waitForSelector('#attach-top');
    const st = await win.evaluate(() => window.skanfact.ocrStatus());
    if (st.hasKey) throw new Error('clé inattendue');
    await win.waitForTimeout(300);
    if (!(await win.isHidden('#photo'))) throw new Error('sans clé de lecture, le bouton « Lire une photo » doit rester caché : il ne ferait que poser une question');
    // Le sélecteur de fichier est natif : on vérifie que le panneau offre le geste sur une pièce
    // NEUVE, sans fournisseur ni ligne, et sans « enregistre d'abord ».
    await win.waitForSelector('#attachments #add-att');
    if (await win.$('#att-save-first')) throw new Error('une pièce neuve ne doit plus exiger d\'enregistrer avant de joindre');
  });
  await step('paie : bulletins, barèmes paramétrables, coût employeur', async () => {
    await win.evaluate(() => { location.hash = '#/paie'; });
    await win.waitForSelector('#p-tabs');
    const tabs = await win.evaluate(() => Array.from(document.querySelectorAll('#p-tabs button')).map(b => b.textContent.trim()));
    if (tabs.length !== 7) throw new Error("onglets : " + tabs.join(","));
    // Depuis la 10.12.0 la Paie s'ouvre sur le mois où il y a quelque chose à faire : un tableau de
    // bulletins, ou le bouton qui établit ceux qui manquent — jamais un mois vide sans geste.
    await win.waitForSelector('#p-body table.list, #p-body #p-gen');
    // le calcul affiché est bien celui du coeur
    const ok = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      const s = C.payrollSettings(d);
      return d.payslips.every(p => {
        const e = d.employees.find(x => x.id === p.employeeId);
        const c = C.computePayslip(e, p, s);
        return Math.abs(c.net - p.computed.net) < 0.002;
      });
    });
    if (!ok) throw new Error('un bulletin ne se recalcule pas à l\'identique');
    // établir les bulletins manquants d'un mois vide
    // un mois sans bulletin : le bouton doit apparaître et les établir tous
    const vide = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, y = Number(C.today().slice(0, 4));
      for (let m = 12; m >= 1; m--) {
        if (!d.payslips.some(p => Number(p.year) === y && Number(p.month) === m)
          && C.missingPayslips(d, y, m).length) return String(m);
      }
      return '';
    });
    if (!vide) throw new Error('aucun mois sans bulletin dans la démo');
    await win.selectOption('#p-month', vide);
    await win.waitForSelector('#p-gen');
    const avant = await win.evaluate(() => window.__data.payslips.length);
    await win.click('#p-gen');
    await win.waitForSelector('#modal-root #ok');
    await win.click('#modal-root #ok');
    await win.waitForFunction(n => window.__data.payslips.length > n, avant);
    // modifier un bulletin : une prime augmente le net
    // Depuis la 10.12.0, « Modifier » vit dans le menu de la ligne ; le bouton visible est le geste
    // suivant, « Marquer payé ».
    await win.waitForSelector('#p-body [data-rowmenu]');
    const id = await win.evaluate(() => document.querySelector('#p-body [data-rowmenu]').dataset.rowmenu);
    const net0 = await win.evaluate(i => window.__data.payslips.find(p => p.id === i).computed.net, id);
    await actionLigne(`#p-body tr:has([data-rowmenu="${id}"])`, 'Modifier le bulletin');
    await win.waitForSelector('#bf input[name=gross]');
    await win.click('#add-bon');
    await win.waitForSelector('#bf-bon input[data-f=amount]');
    await win.fill('#bf-bon input[data-f=amount]', '300');
    await win.waitForFunction(() => /Net à payer/.test(document.querySelector('#bf-calc').textContent));
    await win.click('#modal-root #ok');
    await win.waitForFunction(a => {
      const p = window.__data.payslips.find(x => x.id === a.id);
      return p && p.computed.net > a.net;
    }, { id, net: net0 });
    // le geste suivant d'un bulletin établi : le marquer payé, depuis sa ligne
    const aPayer = await win.evaluate(() => { const b = document.querySelector('#p-body [data-payer]'); return b ? b.dataset.payer : ''; });
    if (!aPayer) throw new Error('un bulletin non payé ne propose pas « Marquer payé » sur sa ligne');
    await win.click(`#p-body [data-payer="${aPayer}"]`);
    await win.waitForFunction(i => !!(window.__data.payslips.find(p => p.id === i) || {}).paidDate, aPayer);
    // barèmes : changer un taux change les bulletins SUIVANTS, pas ceux déjà établis
    await win.click('#p-tabs button[data-tab=baremes]');
    await win.waitForSelector('#rf input[name=cnssEmployee]');
    const fige = await win.evaluate(i => window.__data.payslips.find(p => p.id === i).computed.cnssEmployee, id);
    await win.fill('#rf input[name=cnssEmployee]', '12');
    await win.click('#rf-save');
    await win.waitForFunction(() => window.SkanCore.payrollSettings(window.__data).cnssEmployee === 12);
    const apres = await win.evaluate(i => window.__data.payslips.find(p => p.id === i).computed.cnssEmployee, id);
    if (apres !== fige) throw new Error('un barème modifié a réécrit un bulletin déjà établi');
    await win.click('#rf-reset');
    await win.waitForSelector('#modal-root #ok');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => window.SkanCore.payrollSettings(window.__data).cnssEmployee === 9.18);
    // le barème progressif ne taxe jamais une tranche entière à tort
    const bareme = await win.evaluate(() => {
      const C = window.SkanCore, b = C.payrollSettings(window.__data).brackets;
      return C.irppAnnual(15000, b) === C.round3(750 + 5000 * 0.25) && C.irppAnnual(5000, b) === 0;
    });
    if (!bareme) throw new Error('le barème progressif est faux');
  });
  await step('paie : un bulletin payé sort l\'argent tout seul', async () => {
    const ok = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      const mv = C.cashMovements(d, d.company);
      const paie = mv.filter(m => m.source === 'paie');
      // aucun mouvement libre « Salaires » : il ferait double emploi
      const dbl = (d.movements || []).filter(m => m.kind === 'salaire');
      return paie.length > 0 && paie.every(m => m.amount < 0) && dbl.length === 0;
    });
    if (!ok) throw new Error('les salaires ne sortent pas correctement de la trésorerie');
  });
  await step('résultat simplifié : le coût de la paie est une charge fixe', async () => {
    await win.evaluate(() => { location.hash = '#/compta'; });
    await win.waitForSelector('#c-tabs');
    await win.click('#c-tabs button[data-tab=tva]');
    await win.waitForFunction(() => document.querySelector('#c-body').textContent.includes('Résultat simplifié'));
    if (!(await win.textContent('#c-body')).includes('Coût de la paie')) throw new Error('paie absente du résultat');
    const coherent = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, y = C.today().slice(0, 4);
      const p = { from: y + '-01-01', to: y + '-12-31' };
      const r = C.simpleResult(d, d.company, p);
      const b = C.breakEven(d, d.company, p);
      return r.payroll > 0 && r.resultat === C.round3(r.produits - r.charges - r.cogs - r.depreciation - r.payroll)
        && b.payroll === r.payroll && b.fixed >= b.payroll;
    });
    if (!coherent) throw new Error('le résultat ne retire pas le coût de la paie');
  });
  await step('congés : compteur, absence à cheval sur deux mois, effet sur le bulletin', async () => {
    await win.evaluate(() => { location.hash = '#/paie'; });
    await win.waitForSelector('#p-tabs');
    await win.click('#p-tabs button[data-tab=conges]');
    await win.waitForSelector('#p-body table.list');
    const t = await win.textContent('#p-body');
    if (!/Compteurs de congés/.test(t)) throw new Error('compteurs absents');
    // le compteur affiché est celui du coeur
    const ok = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, y = Number(C.today().slice(0, 4));
      return d.employees.every(e => {
        const b = C.leaveBalance(d, e.id, y);
        return b.remaining === C.round3(b.acquired + b.carry - b.taken);
      });
    });
    if (!ok) throw new Error('le compteur de congés ne se recompose pas');
    // une absence sans solde saisie à cheval sur deux mois se répartit
    const emp = await win.evaluate(() => window.SkanCore.activeEmployees(window.__data)[0].id);
    await win.click('#new-lv');
    await win.waitForSelector('#lf select[name=kind]');
    await win.evaluate(id => {
      const el = document.querySelector('#lf input[name=employeeId]');
      el.value = id; el.dispatchEvent(new Event('change', { bubbles: true }));
    }, emp);
    await win.selectOption('#lf select[name=kind]', 'sans-solde');
    await win.evaluate(() => {
      const y = window.SkanCore.today().slice(0, 4);
      const set = (name, v) => {
        const hid = document.querySelector(`#lf input[name=${name}]`);
        hid.value = v;
        const txt = hid.closest('.datefield').querySelector('.d-txt');
        if (txt) txt.value = window.SkanCore.fmtDateInput(v);
        hid.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('from', y + '-03-30');
      set('to', y + '-04-02');
    });
    await win.waitForFunction(() => /jours? ouvrable/.test(document.querySelector('#lf-hint').textContent));
    const n0 = await win.evaluate(() => window.__data.leaves.length);
    await win.click('#modal-root #ok');
    await win.waitForFunction(n => window.__data.leaves.length === n + 1, n0);
    const split = await win.evaluate(a => {
      const C = window.SkanCore, d = window.__data, y = Number(C.today().slice(0, 4));
      const l = d.leaves[d.leaves.length - 1];
      const mars = C.leaveDaysInMonth(l, y, 3), avril = C.leaveDaysInMonth(l, y, 4);
      const tot = C.workingDays(l.from, l.to, C.payrollSettings(d).offDays);
      // et le bulletin de mars reprend bien ces jours
      const e = d.employees.find(x => x.id === a);
      return mars > 0 && avril > 0 && mars + avril === tot
        && C.payslipInputFor(d, e, y, 3).absentDays >= mars;
    }, emp);
    if (!split) throw new Error('une absence à cheval ne se répartit pas sur les deux mois');
  });
  await step('avance : retenue automatique, dernière échéance ajustée', async () => {
    await win.click('#p-tabs button[data-tab=avances]');
    await win.waitForSelector('#new-av');
    const emp = await win.evaluate(() => window.SkanCore.activeEmployees(window.__data)[1].id);
    const n0 = await win.evaluate(() => window.__data.advances.length);
    await win.click('#new-av');
    await win.waitForSelector('#af2 input[name=amount]');
    await win.evaluate(id => {
      const el = document.querySelector('#af2 input[name=employeeId]');
      el.value = id; el.dispatchEvent(new Event('change', { bubbles: true }));
    }, emp);
    await win.fill('#af2 input[name=amount]', '500');
    await win.fill('#af2 input[name=monthly]', '200');
    await win.waitForFunction(() => /3 mois/.test(document.querySelector('#af2-hint').textContent));
    await win.click('#modal-root #ok');
    await win.waitForFunction(n => window.__data.advances.length === n + 1, n0);
    // la retenue arrive toute seule dans l'entrée du prochain bulletin, et ne dépasse jamais le reste dû
    const ok = await win.evaluate(a => {
      const C = window.SkanCore, d = window.__data, y = Number(C.today().slice(0, 4));
      const e = d.employees.find(x => x.id === a);
      const i = C.payslipInputFor(d, e, y, 12);
      const av = C.advancesOf(d, a).find(x => x.amount === 500);
      const ded = (i.deductions || []).find(x => x.advanceId === av.id);
      return !!ded && ded.amount === 200 && av.remaining === 500;
    }, emp);
    if (!ok) throw new Error('la retenue d\'avance ne se pose pas sur le bulletin');
  });
  await step('registre du personnel et document à remettre', async () => {
    await win.click('#p-tabs button[data-tab=registre]');
    await win.waitForSelector('#p-body table.list');
    const t = await win.textContent('#p-body');
    if (!/Registre du personnel/.test(t)) throw new Error('registre absent');
    await win.click('#p-body [data-hr]');
    await win.waitForSelector('#hf select[name=kind]');
    // l'attestation ne mentionne pas le salaire tant qu'on ne le demande pas
    const ok = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      const e = d.employees[0];
      const sans = C.hrDocumentHtml('attestation', e, d, d.company, { date: C.today() });
      const avec = C.hrDocumentHtml('attestation', e, d, d.company, { date: C.today(), withSalary: true });
      const cert = C.hrDocumentHtml('certificat', e, d, d.company, { date: C.today() });
      return !sans.includes('brut mensuel') && avec.includes('brut mensuel')
        && cert.includes('libre de tout engagement') && C.staffRegister(d).length === d.employees.length;
    });
    if (!ok) throw new Error('les documents du personnel sont incohérents');
    await win.click('#modal-root [data-close]');
  });
  await step('déclarations sociales : CNSS du trimestre, annuelle, rappels', async () => {
    await win.evaluate(() => { location.hash = '#/paie'; });
    await win.waitForSelector('#p-tabs');
    await win.click('#p-tabs button[data-tab=declarations]');
    await win.waitForSelector('#d-quarter');
    const t = await win.textContent('#p-body');
    if (!/Déclaration CNSS/.test(t) || !/Déclaration annuelle d'employeur/.test(t)) throw new Error('déclarations incomplètes');
    // le total CNSS est bien la somme des deux parts plus l'accident du travail
    const ok = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, y = Number(C.today().slice(0, 4));
      return [1, 2, 3, 4].every(q => {
        const c = C.cnssDeclaration(d, y, q);
        return c.total === C.round3(c.employee + c.employer + c.accident)
          && c.rows.every(r => r.total === C.round3(r.employee + r.employer + r.accident));
      });
    });
    if (!ok) throw new Error('le total CNSS ne se recompose pas');
    // changer de trimestre change le tableau
    await win.selectOption('#d-quarter', '1');
    await win.waitForTimeout(200);
    await win.selectOption('#d-quarter', '3');
    await win.waitForSelector('#p-body');
    // marquer déposée fait disparaître le rappel, et se retire
    const before = await win.evaluate(() => window.SkanCore.socialDue(window.__data).length);
    if (!before) throw new Error('aucune déclaration due dans la démo');
    await win.click('#p-body [data-file]');
    await win.waitForFunction(n => window.SkanCore.socialDue(window.__data).length === n - 1, before);
    // la déclaration annuelle sépare bien salaires et retenues sur fournisseurs
    const an = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data, y = Number(C.today().slice(0, 4));
      const a = C.employerAnnual(d, y, d.company);
      return a.rows.length > 0 && a.gross === C.round3(a.rows.reduce((s2, r) => s2 + r.gross, 0))
        && a.heldTotal === C.round3(a.held.reduce((s2, x) => s2 + x.amount, 0));
    });
    if (!an) throw new Error('la déclaration annuelle est incohérente');
    // l'échéance CNSS s'allume toute seule dès qu'il y a un salarié
    const cal = await win.evaluate(() => {
      const C = window.SkanCore, d = window.__data;
      return C.fiscalDeadlines(d).find(x => x.id === 'cnss').active === true
        && C.fiscalDeadlines(C.migrateData({})).find(x => x.id === 'cnss').active === false;
    });
    if (!cal) throw new Error('l\'échéance CNSS ne suit pas la présence de salariés');
  });
  await step('cabinet : le paquet du mois s\'annonce avant d\'être fabriqué', async () => {
    await win.evaluate(() => { location.hash = '#/compta'; });
    await win.waitForSelector('#c-tabs');
    await win.evaluate(() => { const b = [...document.querySelectorAll('#c-tabs button')].find(x => /cabinet/i.test(x.textContent)); if (b) b.click(); });
    await win.waitForSelector('#cab-build');

    // l'onglet annonce l'état du mois et ce qu'il contient, AVANT toute fabrication
    const body = await win.textContent('#c-body');
    if (!/provisoire/i.test(body)) throw new Error('un mois non clôturé doit être annoncé provisoire');
    if (!/Ce que contient le paquet/.test(body)) throw new Error('inventaire absent');
    if (!/Ce qui manque/.test(body)) throw new Error('liste des manques absente');

    // le mot de passe n'apparaît que si on le demande, et il est vérifié
    if (!(await win.evaluate(() => document.querySelector('#cab-pw').hidden))) throw new Error('le champ mot de passe devrait être caché');
    await win.click('#cab-seal');
    await win.waitForFunction(() => !document.querySelector('#cab-pw').hidden);
    await win.fill('#cab-pwv', 'court');
    await win.click('#cab-build');
    await win.waitForSelector('#toast.show.error');
    await win.click('#cab-seal');   // on retire la protection pour la suite

    // le plan calculé correspond bien au mois choisi
    const plan = await win.evaluate(() => {
      const m = document.querySelector('#cab-month').value;
      const C = window.SkanCore;
      const per = C.packPeriod(Number(m.slice(0, 4)), Number(m.slice(5, 7)));
      const p = C.packPlan(window.__data, window.__data.company, per, {});
      return { mois: per.month, entrees: p.entries.length, definitif: p.definitive, journaux: p.entries.filter(e => e.path.startsWith('journaux/')).length };
    });
    if (plan.journaux < 5) throw new Error('journaux attendus : ' + JSON.stringify(plan));
    if (plan.definitif !== false) throw new Error('le mois ne devrait pas être clôturé ici');
    if (!/^\d{4}-\d{2}$/.test(plan.mois)) throw new Error('mois : ' + plan.mois);
  });

  await step('clôture : on ferme un mois, et il refuse ensuite toute écriture', async () => {
    await win.evaluate(() => { location.hash = '#/compta'; });
    await win.waitForSelector('#c-tabs');
    await win.evaluate(() => { const b = [...document.querySelectorAll('#c-tabs button')].find(x => /clôtures/i.test(x.textContent)); if (b) b.click(); });
    await win.waitForSelector('#do-close');
    const before = await win.evaluate(() => window.__data.closedUntil || '');
    if (before) throw new Error('rien ne devrait être clôturé au départ : ' + before);

    // on clôture le premier mois proposé
    // Le bouton NOMME le mois qu'il va clôturer — « Clôturer » tout court demanderait lequel, sur
    // un geste irréversible. Le libellé était lu depuis toujours sans être comparé à rien (10.0.1).
    const label = (await win.textContent('#do-close')).trim();
    if (!/\d{4}/.test(label)) throw new Error('le bouton de clôture ne nomme pas la période : « ' + label + ' »');
    await win.click('#do-close');
    await win.waitForSelector('#modal-root #ok');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => !!window.__data.closedUntil);
    const until = await win.evaluate(() => window.__data.closedUntil);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error('closedUntil : ' + until);
    const logged = await win.evaluate(() => (window.__data.closureLog || []).length);
    if (logged !== 1) throw new Error('journal des clôtures : ' + logged);

    // une pièce datée dans le mois clos doit être refusée à l'enregistrement
    const target = until.slice(0, 8) + '15';
    await win.evaluate(() => { location.hash = '#/doc/new/devis'; });
    await win.waitForSelector('#f-head');
    await win.evaluate(d => {
      const hid = document.querySelector('#f-head input[name=date]');
      hid.value = d;
      const box = hid.closest('.datefield'); if (box) { const t = box.querySelector('.d-txt'); if (t) t.value = d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4); }
      hid.dispatchEvent(new Event('change', { bubbles: true }));
    }, target);
    await win.evaluate(() => { const c = document.querySelector('#f-head [name=clientId]'); if (c) { c.value = window.__data.clients[0].id; c.dispatchEvent(new Event('change', { bubbles: true })); } });
    // le document doit être VALIDE par ailleurs : le garde-fou de clôture vient après la validation
    await win.fill('#lines input[data-k=label]', 'Audit');
    await win.fill('#lines input[data-k=unitPrice]', '1000');
    const n0 = await win.evaluate(() => window.__data.documents.length);
    await win.click('#save');
    await win.waitForSelector('#modal-root .modal');
    const txt = await win.textContent('#modal-root .modal');
    if (!/clôtur/i.test(txt)) throw new Error('message attendu sur la clôture : ' + txt.slice(0, 120));
    const n1 = await win.evaluate(() => window.__data.documents.length);
    if (n1 !== n0) throw new Error('un document a été écrit malgré la clôture');
    await win.click('#modal-root [data-close]');

    // et le compteur de numérotation ne doit pas avoir été consommé
    const counters = await win.evaluate(() => JSON.stringify(window.__data.counters));
    await win.evaluate(() => { location.hash = '#/compta'; });
    // l'éditeur est « sale » : le garde-fou de navigation demande quoi faire, on quitte sans enregistrer
    const leave = await win.$('#modal-root #b');
    if (leave) await leave.click();
    await win.waitForSelector('#c-tabs');
    await win.evaluate(() => { const b = [...document.querySelectorAll('#c-tabs button')].find(x => /clôtures/i.test(x.textContent)); if (b) b.click(); });
    await win.waitForSelector('#do-reopen');
    const after = await win.evaluate(() => JSON.stringify(window.__data.counters));
    if (counters !== after) throw new Error('la numérotation a bougé sur un refus');
  });

  await step('clôture : rouvrir exige un motif, et la trace reste', async () => {
    await win.click('#do-reopen');
    await win.waitForSelector('#modal-root #ok');
    await win.click('#modal-root #ok');                       // sans motif → refus
    await win.waitForSelector('#toast.show.error');
    await win.fill('#modal-root input[name=reason]', 'facture d\'achat retrouvée');
    await win.check('#modal-root input[name=all]');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => !window.__data.closedUntil);
    const log = await win.evaluate(() => window.__data.closureLog);
    if (log.length !== 2 || log[1].action !== 'reouverture') throw new Error('journal : ' + JSON.stringify(log));
    if (log[1].reason !== 'facture d\'achat retrouvée') throw new Error('motif non gardé');
  });

  await step('barre latérale groupée', async () => {
    // Depuis la 7.0.0, les intertitres sont des VERBES et viennent de core.PAGES : « Fichiers » a
    // disparu parce que personne ne cherche un client dans « Fichiers ». On les compare à la source
    // plutôt qu'à une liste écrite ici, qui se périmerait au prochain module ajouté.
    const groups = await win.evaluate(() => Array.from(document.querySelectorAll('.nav-group')).map(g => g.textContent));
    const attendus = [...new Set(require('../../src/renderer/core.js').PAGES.filter(p => p.famille && !p.horsMenu).map(p => p.famille))];
    if (groups.join(',') !== attendus.join(',')) throw new Error(`intertitres « ${groups.join(',')} », attendus « ${attendus.join(',')} »`);
    // Paramètres et Aide ne doivent JAMAIS être dans nav : c'est ce qui les faisait sortir de l'écran.
    const dansNav = await win.evaluate(() => ['parametres', 'aide'].filter(r => document.querySelector(`nav a[data-route="${r}"]`)));
    if (dansNav.length) throw new Error('dans nav au lieu du pied : ' + dansNav.join(', '));
    // le contrat dû a déjà été généré plus haut : le compteur doit donc être masqué
    if (!(await win.evaluate(() => document.querySelector('#nav-contrats').hidden))) throw new Error('compteur contrats affiché sans échéance');
    if (await win.evaluate(() => document.querySelector('#nav-relances').hidden)) throw new Error('compteur relances masqué malgré des retards');
  });
  await step('copie externe : miroir dans un dossier choisi', async () => {
    const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-ext-'));
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await setTab('donnees');
    await win.waitForSelector('#ext-choose');
    await win.evaluate(d => window.skanfact.setExternalBackup(d), ext);
    await win.click('#backup-now');
    await win.waitForSelector('#toast.show');
    await win.waitForFunction(() => (document.querySelector('#ext-status') || {}).textContent.includes('Dernière copie'));
    if (!fs.existsSync(path.join(ext, 'SkanFact', 'skanfact-data.json'))) throw new Error('pas de copie externe');
    if (!fs.readdirSync(path.join(ext, 'SkanFact', 'backups')).length) throw new Error('sauvegardes non copiées');
    await win.evaluate(() => window.skanfact.setExternalBackup(null));
  });
  await step('mot de passe : activer, verrouiller, mauvais puis bon mot de passe, retirer', async () => {
    await setTab('donnees');
    await win.click('#sec-set');
    await win.fill('#pwf input[name=password]', 'secret123'); await win.fill('#pwf input[name=confirm]', 'secret123');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => (document.querySelector('#sec-status') || {}).textContent.includes('activé'));
    const raw = JSON.parse(fs.readFileSync(dataFileOf(), 'utf8'));
    if (raw['skanfact-encrypted'] !== 1 || JSON.stringify(raw).includes('Clinique')) throw new Error('fichier non chiffré');
    await win.click('#sec-lock');
    await win.waitForSelector('#lock-pw', { timeout: 15000 });
    await win.fill('#lock-pw', 'mauvais'); await win.click('#lock-ok');
    await win.waitForFunction(() => !document.querySelector('#lock-err').hidden);
    await win.fill('#lock-pw', 'secret123'); await win.click('#lock-ok');
    await win.waitForFunction(() => !document.querySelector('#lock-screen') && document.querySelector('#view h1'));
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await setTab('donnees');
    await win.waitForSelector('#sec-remove');
    await win.click('#sec-remove');
    await win.fill('#pwf input[name=current]', 'secret123'); await win.click('#modal-root #ok');
    await win.waitForFunction(() => (document.querySelector('#sec-status') || {}).textContent.includes('en clair'));
    const raw2 = JSON.parse(fs.readFileSync(dataFileOf(), 'utf8'));
    if (raw2['skanfact-encrypted'] || !raw2.documents) throw new Error('fichier toujours chiffré');
  });
  await step('zone sensible : « Tout effacer » exige d\'écrire EFFACER', async () => {
    await win.evaluate(() => { location.hash = '#/parametres'; });
    await setTab('donnees');
    await win.click('#wipe-data');
    await win.waitForSelector('#wf');
    if (!(await win.isDisabled('#modal-root #ok'))) throw new Error('bouton actif sans confirmation');
    await win.fill('#wf input[name=w]', 'oui');
    if (!(await win.isDisabled('#modal-root #ok'))) throw new Error('bouton actif avec un mauvais mot');
    await win.fill('#wf input[name=w]', 'EFFACER');
    if (await win.isDisabled('#modal-root #ok')) throw new Error('bouton inactif après EFFACER');
    await win.click('#modal-root [data-close]');                        // on n'efface pas : la suite du test en a besoin
  });
  await step('fichier de données écrit et valide', async () => {
    const d = JSON.parse(fs.readFileSync(dataFileOf(), 'utf8'));
    if (d.documents.length < 15) throw new Error('docs ' + d.documents.length);
    if (!d.recurring.length || !d.templates.length) throw new Error('recurring/templates');
    if (!fs.existsSync(path.join(userData, 'window-state.json'))) throw new Error('window-state');
  });
  await step('menu français complet', async () => {
    const labels = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(i => i.label));
    if (!labels.includes('Fichier') || !labels.includes('Édition') || !labels.includes('Aide')) throw new Error(labels.join(','));
  });

  await new Promise(r => setTimeout(r, 6000)); // laisse passer la vérification silencieuse des mises à jour (5 s)
  await fermer(app);
  if (fs.existsSync(path.join(userData, 'main.log'))) errors.push('main.log présent :\n' + fs.readFileSync(path.join(userData, 'main.log'), 'utf8'));
  if (errors.length) { console.error('\nERREURS JS :\n' + errors.join('\n')); process.exit(1); }
  console.log('\nE2E OK');
})().catch(e => { console.error('E2E FAILED:', e); process.exit(1); });
