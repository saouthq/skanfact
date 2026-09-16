// Les fiches et les formulaires (7.20.0).
//
// Cinq endroits où l'application savait quelque chose et ne le montrait pas : ce qui est obligatoire
// avant d'appuyer sur Enregistrer, la fiche de l'article suivi qu'on ne pouvait pas ouvrir depuis le
// Catalogue, le catalogue qu'on ne pouvait pas choisir dans un achat (avant de se le voir reprocher),
// une ligne en immobilisation qui n'est déduite nulle part sans le dire, et l'historique d'un client
// qui s'arrêtait aux documents.
//
//   xvfb-run -a node test/e2e/fiches.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-fiches-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(300); };

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Fiches SUARL');
      await win.fill('#sf-form input[name=matricule]', '3344556Z/A/P/000');
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
  j.ok('prêt');

  // ---------------------------------------------------- 1. l'obligatoire se voit, et le refus montre
  j.etape('Ce qui est obligatoire se voit, et le refus amène au champ');
  await aller('#/clients');
  await win.waitForSelector('#new');
  await win.click('#new');
  await win.waitForSelector('#cf');
  const vu = await win.evaluate(() => {
    const champ = document.querySelector('#cf input[name=name]').closest('.field');
    const apres = getComputedStyle(champ.querySelector('span, .fl') || champ, '::after').content;
    return {
      marque: champ.classList.contains('obligatoire'),
      etoile: apres,
      legende: (document.querySelector('#modal-root .oblig-note') || {}).textContent || ''
    };
  });
  if (!vu.marque) throw new Error('le champ « Nom » ne porte pas la marque « obligatoire »');
  if (!/obligatoire/.test(vu.legende)) throw new Error('la légende « * obligatoire » n\'apparaît pas dans la fenêtre');
  // On enregistre à vide : le champ doit être marqué en rouge ET recevoir le curseur.
  await win.click('#modal-root #ok');
  await win.waitForTimeout(320);
  const refuse = await win.evaluate(() => {
    const el = document.querySelector('#cf input[name=name]');
    return { focus: document.activeElement === el, rouge: !!el.closest('.champ-faute'), ouverte: !!document.querySelector('#cf') };
  });
  if (!refuse.ouverte) throw new Error('la fenêtre s\'est fermée sur un formulaire incomplet');
  if (!refuse.focus) throw new Error('le refus ne met pas le curseur dans le champ fautif');
  if (!refuse.rouge) throw new Error('le champ fautif n\'est pas marqué');
  // Le rouge s'efface dès qu'on corrige.
  await win.fill('#cf input[name=name]', 'Client Témoin');
  await win.waitForTimeout(200);
  const corrige = await win.evaluate(() => !!document.querySelector('#cf input[name=name]').closest('.champ-faute'));
  if (corrige) throw new Error('le champ reste accusé après correction');
  await win.click('#modal-root [data-close]');
  await win.waitForTimeout(220);
  j.ok(`étoile posée, légende « ${vu.legende.trim()} », curseur ramené sur le champ vide`);

  // ---------------------------------------------------- 2. le Catalogue mène à la fiche de l'article
  j.etape('Le Catalogue ouvre la fiche de l\'article suivi');
  await aller('#/catalogue');
  await win.waitForSelector('#list-wrap');
  // Le geste vit dans le MENU d'actions de la ligne depuis la 7.29.0 : `data-fiche` a disparu du
  // code ce jour-là, et ce parcours ne l'avait pas été relancé depuis — il accusait le jeu d'exemple
  // d'être vide. On ouvre le menu comme un utilisateur, sur la ligne d'un article suivi en stock.
  const suivis = await win.evaluate(() => (window.__data.catalog || []).filter(c => c.tracked).length);
  if (!suivis) throw new Error('aucun article suivi dans le jeu d\'exemple : le test ne prouve rien');
  // Les lignes du catalogue ne portent pas d'identifiant : on reconnaît la ligne à son LIBELLÉ,
  // comme un utilisateur, et on lit son rang pour la cliquer pour de vrai.
  const rang = await win.evaluate(() => {
    const suivi = (window.__data.catalog || []).filter(c => c.tracked).map(c => c.label);
    const trs = [...document.querySelectorAll('#list-wrap tbody tr')];
    const i = trs.findIndex(tr => suivi.some(l => tr.textContent.includes(l)));
    if (i >= 0) trs[i].scrollIntoView({ block: 'center' });
    return i;
  });
  if (rang < 0) throw new Error('aucune ligne d\'article suivi sur la page affichée');
  await win.waitForTimeout(300);
  const boutons = await win.$$('#list-wrap tbody tr .row-menu-btn');
  await boutons[rang].click();
  await win.waitForSelector('.row-menu', { timeout: 4000 });
  // Et jamais sur un article NON suivi : sa fiche n'aurait rien à montrer.
  const sansSuivi = await win.evaluate(() => {
    const pas = (window.__data.catalog || []).filter(c => !c.tracked).map(c => c.label);
    return [...document.querySelectorAll('#list-wrap tbody tr')].filter(tr => pas.some(l => tr.textContent.includes(l))).length;
  });
  const fiche = await win.$('.row-menu button:has-text("Voir la fiche stock")');
  if (!fiche) throw new Error('le menu d\'un article suivi n\'offre pas sa fiche stock');
  await fiche.click();
  await win.waitForFunction(() => location.hash.startsWith('#/article/'), { timeout: 4000 });
  // Le retour ramène au Catalogue, d'où l'on vient — pas au Stock.
  await win.click('#back');
  await win.waitForFunction(() => location.hash === '#/catalogue', { timeout: 4000 });
  j.ok(`${suivis} article${suivis > 1 ? 's' : ''} suivi${suivis > 1 ? 's' : ''} — la fiche s'ouvre et le retour ramène au Catalogue (${sansSuivi} ligne(s) non suivie(s) sur la page)`);

  // ---------------------------------------------------- 3. le catalogue dans l'éditeur d'achat
  j.etape('L\'éditeur d\'achat propose le catalogue, au coût d\'achat');
  await aller('#/achat/new');
  await win.waitForSelector('#b-cat');
  const article = await win.evaluate(() => {
    const c = window.__data.catalog.find(x => x.tracked) || window.__data.catalog[0];
    return c ? { id: c.id, label: c.label, cost: Number(c.unitCost) || 0, price: Number(c.unitPrice) || 0, tracked: !!c.tracked } : null;
  });
  if (!article) throw new Error('catalogue vide');
  await win.click('#b-cat .combo-btn');
  await win.waitForSelector('#b-cat .combo-it', { timeout: 4000 });
  // On tape dans la recherche puis on clique la ligne : c'est le vrai geste, et ça évite de dépendre
  // de l'ordre de la liste.
  await win.fill('#b-cat .combo-q', article.label.slice(0, 12));
  await win.waitForTimeout(260);
  await win.click('#b-cat .combo-it');
  await win.waitForTimeout(360);
  const ligne = await win.evaluate(() => {
    // Un achat neuf commence avec une ligne vide : celle du catalogue est AJOUTÉE en dessous.
    const trs = [...document.querySelectorAll('#b-lines tr')];
    const tr = trs.reverse().find(x => x.querySelector('[data-k=label]').value.trim()) || trs[0];
    if (!tr) return null;
    return {
      label: tr.querySelector('[data-k=label]').value,
      prix: Number(tr.querySelector('[data-k=unitPrice]').value),
      destination: tr.querySelector('[data-k=destination]').value
    };
  });
  if (!ligne || ligne.label !== article.label) throw new Error(`la ligne porte « ${ligne && ligne.label} » au lieu de « ${article.label} »`);
  const prixAttendu = article.cost || article.price;
  if (Math.abs(ligne.prix - prixAttendu) > 0.001) throw new Error(`la ligne reprend ${ligne.prix} au lieu du coût d'achat ${prixAttendu}`);
  if (article.tracked && ligne.destination !== 'stock') throw new Error(`un article suivi arrive en destination « ${ligne.destination} »`);
  j.ok(`« ${ligne.label} » à ${ligne.prix} (coût d'achat), destination « ${ligne.destination} »`);

  // ---------------------------------------------------- 3 bis. la désignation cherche dans le catalogue (9.2.1)
  // Skander : l'éditeur lui reprochait qu'une ligne « memoire 16go » ne correspond à aucun article
  // suivi, et le laissait chercher à la main l'orthographe exacte. On tape donc SANS accent et on
  // attend que le catalogue se propose ; puis on met une désignation qui n'existe pas, et
  // l'avertissement doit porter le bouton qui débloque — jusqu'à la création de l'article.
  j.etape('La désignation propose le catalogue, et « aucun article suivi » débloque');
  const cible = await win.evaluate(deja => {
    const suivis = (window.__data.catalog || []).filter(x => x.tracked);
    const c = suivis.find(x => x.label !== deja) || suivis[0];
    return c ? { label: c.label, cost: Number(c.unitCost) || Number(c.unitPrice) || 0 } : null;
  }, article.label);
  if (!cible) throw new Error('aucun article suivi à chercher');
  await win.click('#add-line');
  await win.waitForTimeout(200);
  const tape = cible.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().slice(0, 6);
  const champs = await win.$$('#b-lines input[data-k=label]');
  await champs[champs.length - 1].type(tape, { delay: 25 });
  await win.waitForSelector('.sugg-pop:not([hidden]) .sugg-it', { timeout: 4000 });
  const proposee = win.locator('.sugg-pop:not([hidden]) .sugg-it', { hasText: cible.label }).first();
  if (!await proposee.count()) throw new Error(`« ${tape} » tapé sans accent ne propose pas « ${cible.label} »`);
  await proposee.click();
  await win.waitForTimeout(350);
  const rattachee = await win.evaluate(() => {
    const trs = [...document.querySelectorAll('#b-lines tr')]; const tr = trs[trs.length - 1];
    return { label: tr.querySelector('[data-k=label]').value, prix: Number(tr.querySelector('[data-k=unitPrice]').value),
      destination: tr.querySelector('[data-k=destination]').value,
      curseurQte: document.activeElement === tr.querySelector('[data-k=qty]'),
      listeFermee: !document.querySelector('.sugg-pop:not([hidden])') };
  });
  if (rattachee.label !== cible.label) throw new Error(`choisir a écrit « ${rattachee.label} » au lieu de « ${cible.label} »`);
  if (Math.abs(rattachee.prix - cible.cost) > 0.001) throw new Error(`choisir reprend ${rattachee.prix} au lieu du coût ${cible.cost}`);
  if (rattachee.destination !== 'stock') throw new Error(`un article suivi choisi laisse la ligne en « ${rattachee.destination} »`);
  if (!rattachee.curseurQte) throw new Error('après le choix, le curseur ne passe pas à la quantité');
  if (!rattachee.listeFermee) throw new Error('la liste reste ouverte après le choix');
  j.ok(`« ${tape} » → « ${cible.label} » à ${cible.cost}, en stock, curseur sur la quantité`);

  // Une désignation qui n'existe pas, en destination stock : le refus porte le bouton, le bouton
  // ouvre la liste, la liste propose de créer, la fiche arrive préremplie ET cochée « suivi ».
  await win.click('#add-line');
  await win.waitForTimeout(200);
  const champs2 = await win.$$('#b-lines input[data-k=label]');
  await champs2[champs2.length - 1].type('zzz inexistant', { delay: 15 });
  await win.keyboard.press('Escape');
  await win.evaluate(() => {
    const trs = [...document.querySelectorAll('#b-lines tr')]; const sel = trs[trs.length - 1].querySelector('[data-k=destination]');
    sel.value = 'stock'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.waitForTimeout(350);
  const alerte = await win.evaluate(() => { const b = document.querySelector('#b-stock-hint'); return { visible: !!b && !b.hidden, bouton: !!(b && b.querySelector('[data-orph]')) }; });
  if (!alerte.visible) throw new Error('une ligne « stock » sans article ne dit plus rien');
  if (!alerte.bouton) throw new Error('l\'avertissement ne porte pas « Choisir l\'article… » : il reproche sans débloquer');
  await win.click('#b-stock-hint [data-orph]');
  await win.waitForSelector('.sugg-pop:not([hidden]) .sugg-add', { timeout: 4000 });
  const auChamp = await win.evaluate(() => !!document.activeElement && document.activeElement.dataset.k === 'label');
  if (!auChamp) throw new Error('« Choisir l\'article… » n\'amène pas le curseur dans la désignation');
  await win.click('.sugg-pop:not([hidden]) .sugg-add');
  await win.waitForSelector('#modal-root #kf', { timeout: 4000 });
  const fiche2 = await win.evaluate(() => ({ label: document.querySelector('#kf input[name=label]').value, suivi: document.querySelector('#kf input[name=tracked]').checked }));
  if (fiche2.label !== 'zzz inexistant') throw new Error(`la fiche arrive avec « ${fiche2.label} » au lieu de la désignation tapée`);
  if (!fiche2.suivi) throw new Error('l\'article créé depuis une ligne « stock » n\'est pas coché « suivi en stock »');
  await win.click('#modal-root #ok');
  await win.waitForTimeout(450);
  const apres = await win.evaluate(() => {
    const b = document.querySelector('#b-stock-hint');
    return { encoreAccusee: !!b && !b.hidden && !!b.querySelector('[data-orph]'),
      auCatalogue: (window.__data.catalog || []).some(c => c.label === 'zzz inexistant' && c.tracked) };
  });
  if (!apres.auCatalogue) throw new Error('l\'article créé depuis la liste n\'est pas au catalogue');
  if (apres.encoreAccusee) throw new Error('la ligne reste accusée alors que son article vient d\'être créé');
  j.ok('« zzz inexistant » : bouton dans l\'avertissement → liste → « Créer » → fiche préremplie et suivie → ligne rattachée');

  // ---------------------------------------------------- 4. la ligne en immobilisation le dit
  j.etape('Une ligne en immobilisation dit qu\'elle n\'est déduite nulle part');
  await win.evaluate(() => {
    const trs = [...document.querySelectorAll('#b-lines tr')];
    const tr = trs.reverse().find(x => x.querySelector('[data-k=label]').value.trim()) || trs[0];
    const sel = tr.querySelector('[data-k=destination]');
    sel.value = 'immobilisation';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const pu = tr.querySelector('[data-k=unitPrice]');
    pu.value = '4500'; pu.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await win.waitForTimeout(350);
  const rappel = await win.evaluate(() => {
    const b = document.querySelector('#b-stock-hint');
    return { visible: b && !b.hidden, texte: b ? b.textContent : '', bouton: !!document.querySelector('#b-immo') };
  });
  if (!rappel.visible) throw new Error('choisir « Immobilisation » ne dit toujours rien');
  if (!/amortissement/.test(rappel.texte)) throw new Error(`le rappel ne dit pas ce qui manque : « ${rappel.texte.slice(0, 120)} »`);
  if (!rappel.bouton) throw new Error('le rappel ne mène pas aux biens à créer');
  await win.click('#b-immo');
  const garde = await win.waitForSelector('#modal-root button', { timeout: 2000 }).catch(() => null);
  if (garde) {
    await win.evaluate(() => {
      const b = [...document.querySelectorAll('#modal-root button')].find(x => /Ne pas enregistrer|Quitter|Abandonner/i.test(x.textContent));
      if (b) b.click();
    });
    await win.waitForTimeout(400);
  }
  await win.waitForFunction(() => location.hash === '#/immos', { timeout: 5000 });
  j.ok('le rappel nomme l\'amortissement manquant et mène aux biens à créer');

  // ---------------------------------------------------- 5. la fiche client au complet
  j.etape('La fiche client montre ses affaires et ses contrats');
  const client = await win.evaluate(() => {
    const d = window.__data;
    // Un client qui a au moins une affaire ET un contrat : sinon le test ne prouve qu'une moitié.
    const avecAffaire = new Set((d.projects || []).map(p => p.clientId));
    const avecContrat = new Set((d.recurring || []).map(r => r.clientId));
    const deux = [...avecAffaire].find(id => avecContrat.has(id));
    if (deux) return { id: deux, deux: true };
    // Sinon on rattache un contrat au client de la première affaire.
    const p = (d.projects || [])[0];
    if (p && d.recurring && d.recurring[0]) { d.recurring[0].clientId = p.clientId; return { id: p.clientId, deux: true }; }
    return p ? { id: p.clientId, deux: false } : null;
  });
  if (!client) throw new Error('le jeu d\'exemple n\'a ni affaire ni contrat');
  await aller('#/client/' + client.id);
  await win.waitForSelector('.page-head');
  const panneaux = await win.evaluate(() => {
    const titres = [...document.querySelectorAll('.panel h2')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    return {
      titres,
      affaires: document.querySelectorAll('tr[data-pid]').length,
      contrats: document.querySelectorAll('tr[data-rid]').length
    };
  });
  if (!panneaux.affaires) throw new Error(`aucune affaire sur la fiche : ${panneaux.titres.join(' | ')}`);
  if (client.deux && !panneaux.contrats) throw new Error(`aucun contrat sur la fiche : ${panneaux.titres.join(' | ')}`);
  // Et les deux s'ouvrent.
  await win.click('tr[data-pid]');
  await win.waitForFunction(() => location.hash.startsWith('#/affaire/'), { timeout: 4000 });
  await aller('#/client/' + client.id);
  await win.waitForSelector('tr[data-rid]');
  await win.click('tr[data-rid]');
  await win.waitForFunction(() => location.hash.startsWith('#/contrat/'), { timeout: 4000 });
  j.ok(`${panneaux.affaires} affaire(s), ${panneaux.contrats} contrat(s), les deux cliquables`);

  // Un client sans affaire ni contrat n'affiche PAS deux panneaux vides.
  j.etape('Un client sans affaire ni contrat n\'affiche pas de panneau vide');
  const nu = await win.evaluate(() => {
    const d = window.__data;
    const pris = new Set([...(d.projects || []).map(p => p.clientId), ...(d.recurring || []).map(r => r.clientId)]);
    const c = d.clients.find(x => !pris.has(x.id));
    return c ? c.id : null;
  });
  if (!nu) throw new Error('tous les clients ont une affaire ou un contrat : le test ne prouve rien');
  await aller('#/client/' + nu);
  await win.waitForSelector('.page-head');
  const vide = await win.evaluate(() => ({
    affaires: document.querySelectorAll('tr[data-pid]').length,
    titres: [...document.querySelectorAll('.panel h2')].map(x => x.textContent.trim())
  }));
  if (vide.affaires) throw new Error('un client sans affaire en affiche quand même');
  if (vide.titres.some(t => /^Affaires/.test(t) || /^Contrats récurrents/.test(t))) {
    throw new Error(`des panneaux vides s'affichent : ${vide.titres.join(' | ')}`);
  }
  j.ok('aucun panneau vide sur un client qui n\'a ni affaire ni contrat');

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — les fiches montrent ce que l'application sait.`);
})().catch(e => { console.error(e); process.exit(1); });
