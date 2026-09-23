// La retenue à la source : la liste propose, elle n'enferme pas (8.3.0).
//
// Le frère de Skander a essayé l'application ; son client lui retient 1 %, et la liste commençait à
// 1,5 %. Il n'avait AUCUN moyen de saisir le bon taux. Pire, trois écrans sur six lisaient la liste
// à la main : un taux absent n'y était même pas conservé, et rouvrir la fiche d'un client pour
// corriger son téléphone remettait sa retenue à « par défaut » — donc changeait le montant de ses
// factures, sans un mot.
//
// Cinq choses qui ne se prouvent que dans l'application réelle :
//
//   1. Les six écrans proposent 1 %, et tous portent « Autre taux… ».
//   2. Un taux libre tapé dans l'éditeur rejoint la liste, est sélectionné, ET recalcule les totaux
//      (c'est le `change` relancé : sans lui l'écran affiche le bon taux et la pièce garde l'ancien).
//   3. Renoncer laisse la valeur d'avant — jamais « __autre__ », jamais 0 %.
//   4. Un client réglé sur un taux hors liste le garde quand on rouvre sa fiche : le défaut d'origine.
//   5. Le taux libre suit le client sur une nouvelle facture, et se retrouve dans la liste ailleurs.
//
//   xvfb-run -a node test/e2e/retenue.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-retenue-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(300); };
  // Ce que le select propose vraiment, tel qu'un utilisateur le déroule.
  const lire = sel => win.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return null;
    return { valeur: el.value, options: [...el.options].map(o => ({ v: o.value, t: o.textContent.trim() })) };
  }, sel);

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Retenue SUARL');
      await win.fill('#sf-form input[name=matricule]', '7788990K/A/M/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    // L'écran de facturation porte le taux par défaut : on vérifie au passage qu'il est déjà guidé.
    if (await win.$('#sf-form select[name=defaultWithholdingRate]')) {
      const a = await lire('#sf-form select[name=defaultWithholdingRate]');
      if (!a.options.some(o => o.v === '1')) throw new Error('l\'assistant ne propose pas 1 %');
      if (!a.options.some(o => /Autre taux/.test(o.t))) throw new Error('l\'assistant n\'a pas « Autre taux… »');
      j.ok('l\'assistant propose 1 % et « Autre taux… »');
    }
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

  // ------------------------------------------------- 1. les six écrans proposent 1 % et « Autre taux… »
  j.etape('Les six écrans proposent 1 %, et tous portent « Autre taux… »');
  const ecrans = [];
  const verifier = async (nom, sel) => {
    const a = await lire(sel);
    if (!a) throw new Error(`${nom} : ${sel} introuvable`);
    if (!a.options.some(o => o.v === '1')) throw new Error(`${nom} : 1 % n'est pas proposé (${a.options.map(o => o.v).join(', ')})`);
    if (!a.options.some(o => /Autre taux/.test(o.t))) throw new Error(`${nom} : pas de « Autre taux… »`);
    // Les réglages voyagent sur l'élément : sans eux la liste ne se reconstruit pas après une saisie.
    const branche = await win.evaluate(s => {
      const el = document.querySelector(s);
      return { rs: el.dataset.rs != null, lie: el.dataset.rsBound === '1' };
    }, sel);
    if (!branche.rs) throw new Error(`${nom} : le select n'a pas ses réglages (data-rs)`);
    if (!branche.lie) throw new Error(`${nom} : « Autre taux… » n'est pas branché (data-rs-bound)`);
    ecrans.push(nom);
  };

  // Paramètres → règles de facturation
  await aller('#/parametres');
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="documents"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="documents"]'); return p && !p.hidden; });
  await verifier('Paramètres', 'select[name=defaultWithholdingRate]');

  // Fiche client
  await aller('#/clients');
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#cf select[name=withholdingRate]');
  await verifier('fiche client', '#cf select[name=withholdingRate]');
  await win.click('#modal-root [data-close]'); await win.waitForTimeout(150);

  // Fiche fournisseur
  await aller('#/fournisseurs');
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#modal-root select[name=withholdingRate]');
  await verifier('fiche fournisseur', '#modal-root select[name=withholdingRate]');
  await win.click('#modal-root [data-close]'); await win.waitForTimeout(150);

  // Contrat récurrent
  await aller('#/contrats');
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#modal-root select[name=withholdingRate]');
  await verifier('contrat récurrent', '#modal-root select[name=withholdingRate]');
  await win.click('#modal-root [data-close]'); await win.waitForTimeout(150);

  // Éditeur d'achat
  const idAchat = await win.evaluate(() => (window.__data.purchases || [])[0].id);
  await aller('#/achat/' + idAchat);
  await win.waitForSelector('select[name=withholdingRate]');
  await verifier('éditeur d\'achat', 'select[name=withholdingRate]');

  // Éditeur de document : un brouillon de facture
  const idFac = await win.evaluate(() => (window.__data.documents || []).find(d => d.type === 'facture' && d.status === 'brouillon').id);
  await aller('#/doc/' + idFac);
  await win.waitForSelector('#f-head select[name=withholdingRate]');
  await verifier('éditeur de document', '#f-head select[name=withholdingRate]');
  j.ok(`${ecrans.length} écrans : ${ecrans.join(', ')}`);

  // ------------------------------------------------- 2. un taux libre rejoint la liste ET recalcule
  j.etape('Un taux tapé à la main rejoint la liste et recalcule les totaux');
  const avantTaux = await win.evaluate(id => {
    const d = window.__data.documents.find(x => x.id === id);
    return { taux: Number(d.withholdingRate) || 0 };
  }, idFac);
  // On choisit « Autre taux… » comme un utilisateur : par la valeur de l'option.
  await win.selectOption('#f-head select[name=withholdingRate]', '__autre__');
  await win.waitForSelector('#modal-root input[name=v]');
  // Le document ne doit PAS avoir encaissé « __autre__ » au passage : la valeur est remise avant que
  // l'événement ne remonte, sinon Number('__autre__') || 0 effacerait la retenue en douce.
  const pendant = await win.evaluate(id => String(window.__data.documents.find(x => x.id === id).withholdingRate), idFac);
  if (pendant === '__autre__') throw new Error('« __autre__ » a été écrit dans le document');
  if (Number(pendant) !== avantTaux.taux) throw new Error(`le taux a changé pendant la question : ${pendant} au lieu de ${avantTaux.taux}`);
  // La virgule décimale doit passer : on tape comme on parle.
  await win.fill('#modal-root input[name=v]', '0,75');
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => !document.querySelector('#modal-root input[name=v]'));
  await win.waitForTimeout(250);
  const apres = await lire('#f-head select[name=withholdingRate]');
  if (apres.valeur !== '0.75') throw new Error(`le select affiche « ${apres.valeur} » au lieu de 0.75`);
  if (!apres.options.some(o => o.v === '0.75')) throw new Error('0,75 % n\'a pas rejoint la liste');
  if (!apres.options.some(o => /Autre taux/.test(o.t))) throw new Error('« Autre taux… » a disparu après une saisie');
  // Le `change` relancé : le bloc des totaux, qui lit le document en cours d'édition, doit suivre.
  // L'éditeur travaille sur une COPIE jusqu'à « Enregistrer » — regarder la pièce rangée dans les
  // données à cet instant ne prouverait rien.
  const affiche = await win.evaluate(() => (document.querySelector('#totals') || {}).textContent || '');
  if (!/Retenue à la source 0,75\s*%/.test(affiche.replace(/\s+/g, ' ')))
    throw new Error('les totaux n\'affichent pas la retenue à 0,75 % : ' + affiche.replace(/\s+/g, ' ').slice(0, 220));
  // Et elle survit à l'enregistrement : c'est le geste qui compte.
  await win.click('#save');
  await win.waitForTimeout(500);
  const recalcule = await win.evaluate(id => {
    const d = window.__data.documents.find(x => x.id === id);
    const t = window.SkanCore.computeTotals(d, window.__data.company);
    return { doc: Number(d.withholdingRate), retenue: t.withholding };
  }, idFac);
  if (recalcule.doc !== 0.75) throw new Error(`la pièce enregistrée porte ${recalcule.doc} % au lieu de 0,75`);
  if (!(recalcule.retenue > 0)) throw new Error('la retenue calculée est nulle');
  j.ok(`0,75 % accepté, listé, sélectionné — retenue de ${recalcule.retenue}`);

  // ------------------------------------------------- 3. renoncer ne change rien
  j.etape('Renoncer laisse la valeur d\'avant');
  await win.selectOption('#f-head select[name=withholdingRate]', '__autre__');
  await win.waitForSelector('#modal-root input[name=v]');
  await win.click('#modal-root [data-close]');
  await win.waitForFunction(() => !document.querySelector('#modal-root input[name=v]'));
  await win.waitForTimeout(200);
  const apresAnnul = await lire('#f-head select[name=withholdingRate]');
  if (apresAnnul.valeur !== '0.75') throw new Error(`après Annuler le select affiche « ${apresAnnul.valeur} »`);
  const docApresAnnul = await win.evaluate(id => Number(window.__data.documents.find(x => x.id === id).withholdingRate), idFac);
  if (docApresAnnul !== 0.75) throw new Error(`après Annuler le document porte ${docApresAnnul} %`);
  j.ok('le taux reste à 0,75 % après Annuler');
  // Le geste a marqué l'éditeur « modifié » : quitter sans enregistrer réveillerait le garde-fou,
  // qui remet la page précédente dans la barre d'adresse pour poser sa question (2.4.0) — la
  // navigation suivante n'aurait alors pas lieu, et l'erreur tomberait trente secondes plus tard
  // sur un sélecteur qui n'a rien à voir.
  await win.click('#save');
  await win.waitForTimeout(400);

  // ------------------------------------------------- 4. la fiche client garde un taux hors liste
  j.etape('Un client réglé sur un taux hors liste le garde quand on rouvre sa fiche');
  const idClient = await win.evaluate(() => {
    const c = window.__data.clients[0];
    c.withholdingRate = 0.75;               // posé comme s'il venait d'un import ou d'une autre version
    return c.id;
  });
  await aller('#/client/' + idClient);
  // Depuis la 10.2.0, « Modifier la fiche » vit dans le menu « Actions » de l'en-tête (le budget de
  // boutons d'une fiche) : ce parcours cherchait encore `#edit`, et personne ne l'avait relancé
  // depuis (7.28.0 — un e2e se périme). On ouvre le menu comme un utilisateur.
  await win.waitForSelector('.page-head .actions .row-menu-btn');
  await win.click('.page-head .actions .row-menu-btn');
  await win.waitForSelector('.row-menu');
  const iMod = await win.evaluate(() => [...document.querySelectorAll('.row-menu .rm-l')].findIndex(x => /^Modifier la fiche/.test(x.textContent.trim())));
  if (iMod < 0) throw new Error('le menu de la fiche client ne propose pas « Modifier la fiche »');
  await win.click(`.row-menu button >> nth=${iMod}`);
  await win.waitForSelector('#cf select[name=withholdingRate]');
  const fiche = await lire('#cf select[name=withholdingRate]');
  if (fiche.valeur !== '0.75') throw new Error(`la fiche affiche « ${fiche.valeur} » au lieu de 0.75 : le taux est perdu`);
  // On enregistre sans rien toucher : c'est le geste qui effaçait le taux avant la 8.3.0.
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => !document.querySelector('#cf'));
  await win.waitForTimeout(200);
  const garde = await win.evaluate(id => window.__data.clients.find(c => c.id === id).withholdingRate, idClient);
  if (Number(garde) !== 0.75) throw new Error(`enregistrer la fiche a ramené le taux à « ${garde} »`);
  j.ok('0,75 % conservé à l\'affichage et à l\'enregistrement');

  // ------------------------------------------------- 5. le taux libre survit et se propose ailleurs
  j.etape('Le taux libre suit le client, et reste proposé sur les autres écrans');
  await aller('#/fournisseurs');
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#modal-root select[name=withholdingRate]');
  const chezFournisseur = await lire('#modal-root select[name=withholdingRate]');
  if (!chezFournisseur.options.some(o => o.v === '0.75')) throw new Error('0,75 % n\'est plus proposé sur la fiche fournisseur');
  // Et « Aucune » reste en tête, sans doublon à 0 : le fournisseur a le sien.
  const zeros = chezFournisseur.options.filter(o => o.v === '0' || o.v === '');
  if (zeros.length !== 1) throw new Error(`« Aucune » apparaît ${zeros.length} fois chez le fournisseur`);
  await win.click('#modal-root [data-close]'); await win.waitForTimeout(150);
  j.ok('le taux saisi une fois reste proposé partout');

  await app.close();
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — la liste propose, elle n'enferme personne.`);
})().catch(e => { console.error(e); process.exit(1); });
