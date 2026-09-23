// Les chiffres qui mentent (7.16.0).
//
// Cinq défauts trouvés par un audit page par page, chacun re-vérifié par un contradicteur, puis
// mesuré à la main avant d'être corrigé. Ce sont les plus graves qu'on puisse avoir : ils ne
// plantent pas, ne s'affichent pas en rouge, et donnent un chiffre faux tous les jours.
//
//   1. L'accueil additionnait des euros à des dinars. Sur le jeu d'exemple, « CA de l'année »
//      annonçait 41 307 DT là où le total vaut 43 892 DT — pendant que le graphique dix centimètres
//      plus bas, lui, convertit depuis toujours. Deux chiffres du même écran, deux années.
//   2. La page Marges calculait ses trois cartes sur un tableau tronqué à vingt lignes.
//   3. Facturer un devis perdait son affaire : la fiche d'affaire montrait 0 facturé et les achats
//      rattachés, eux, comptés — l'affaire paraissait perdre de l'argent.
//   4. Saisir deux fois la même facture fournisseur ne disait rien : TVA déductible et charge
//      comptées deux fois.
//   5. « Facturer ce devis » restait proposé sur un devis déjà facturé.
//
//   xvfb-run -a node test/e2e/chiffres.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller, montant } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-chiffres-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const nb = montant;

  j.etape('Une entreprise et le jeu d\'exemple (qui contient des pièces en euros)');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Chiffres SUARL');
      await win.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner');
  j.ok('prêt');

  j.etape('L\'accueil et son graphique racontent la MÊME année');
  await win.evaluate(() => { location.hash = '#/dashboard'; });
  await win.waitForSelector('[data-stat="ca-annee"]');
  // Le chiffre affiché, et celui que `core` calcule en convertissant : ils doivent coïncider.
  const compare = await win.evaluate(() => {
    const C = window.SkanCore, d = window.__data, co = d.company;
    const an = new Date().getFullYear() + '';
    const issued = d.documents.filter(x => (x.type === 'facture' || x.type === 'avoir')
      && x.status !== 'brouillon' && x.status !== 'annulée' && (x.date || '').startsWith(an));
    const sign = x => x.type === 'avoir' ? -1 : 1;
    return {
      affiche: document.querySelector('[data-stat="ca-annee"] .val').textContent,
      brut: issued.reduce((s, x) => s + sign(x) * C.computeTotals(x, co).netHT, 0),
      converti: issued.reduce((s, x) => s + sign(x) * C.toBase(x, C.computeTotals(x, co).netHT, co), 0),
      devises: [...new Set(d.documents.map(x => x.currency).filter(c => c && c !== co.currency))]
    };
  });
  if (!compare.devises.length) throw new Error('le jeu d\'exemple ne contient aucune pièce en devise : le test ne prouve rien');
  const affiche = nb(compare.affiche);
  const ecart = Math.abs(affiche - compare.converti);
  if (ecart > 1) throw new Error(`la carte affiche ${affiche} alors que le total converti vaut ${compare.converti.toFixed(3)}`);
  if (Math.abs(compare.converti - compare.brut) < 1) throw new Error('aucun écart entre brut et converti : le jeu d\'exemple ne teste rien');
  j.ok(`${affiche} DT affichés = ${compare.converti.toFixed(0)} convertis (et non ${compare.brut.toFixed(0)} en brut, ${compare.devises.join('/')} présent)`);

  j.etape('Marges : la carte et le tableau portent sur les mêmes lignes');
  await win.evaluate(() => { location.hash = '#/marges'; });
  await win.waitForSelector('#mg-tabs');
  await win.click('#mg-tabs button[data-tab=analyse]');
  await win.waitForSelector('#mg-body .stat');
  const marges = await win.evaluate(() => {
    const C = window.SkanCore, d = window.__data, co = d.company;
    const an = document.querySelector('#mg-year') ? document.querySelector('#mg-year').value : new Date().getFullYear() + '';
    const toutes = C.marginBy(d, co, an + '-01-01', an + '-12-31', 'client', 0);
    return {
      carte: document.querySelector('#mg-body .stat .val').textContent,
      total: toutes.reduce((s, r) => s + r.revenue, 0),
      lignes: toutes.length
    };
  });
  if (Math.abs(nb(marges.carte) - marges.total) > 1) {
    throw new Error(`la carte annonce ${nb(marges.carte)} et le total des ${marges.lignes} lignes vaut ${marges.total.toFixed(3)}`);
  }
  j.ok(`${marges.lignes} ligne(s), carte et total d'accord (${marges.carte.trim()})`);

  j.etape('L\'affaire suit le devis jusqu\'à la facture');
  // On prend une affaire de l'exemple, on lui rattache un devis, on le facture, et on vérifie que la
  // fiche d'affaire compte la facture.
  const prep = await win.evaluate(() => {
    const d = window.__data;
    const p = (d.projects || [])[0];
    // Un devis PAS encore facturé : sur un devis déjà facturé, « Facturer » vit désormais dans le
    // menu ▾ (c'est précisément ce que la 7.16.0 corrige), et le test se piégerait tout seul.
    const factures = new Set(d.documents.filter(x => x.type === 'facture' && x.fromQuoteId).map(x => x.fromQuoteId));
    const q = d.documents.find(x => x.type === 'devis' && x.status !== 'brouillon' && x.clientId && !factures.has(x.id));
    return p && q ? { projet: p.id, devis: q.id, client: q.clientId } : null;
  });
  if (!prep) throw new Error('le jeu d\'exemple n\'a ni affaire ni devis : le test ne prouve rien');
  await win.evaluate(o => {
    const d = window.__data;
    const q = d.documents.find(x => x.id === o.devis);
    q.projectId = o.projet; q.status = 'accepté';
    const p = d.projects.find(x => x.id === o.projet);
    p.clientId = q.clientId;
  }, prep);
  await win.evaluate(i => { location.hash = '#/doc/' + i; }, prep.devis);
  await win.waitForSelector('#convert');
  await win.click('#convert');
  await win.waitForTimeout(900);
  const suivi = await win.evaluate(o => {
    const d = window.__data;
    const inv = d.documents.filter(x => x.type === 'facture' && x.fromQuoteId === o.devis)[0];
    return inv ? { id: inv.id, projectId: inv.projectId || '' } : null;
  }, prep);
  if (!suivi) throw new Error('aucune facture n\'a été créée');
  if (suivi.projectId !== prep.projet) throw new Error(`la facture est arrivée sans affaire (projectId = « ${suivi.projectId} »)`);
  j.ok('la facture porte l\'affaire du devis');

  j.etape('Le même devis ne propose plus « Facturer ce devis » en bouton coloré');
  await win.evaluate(i => { location.hash = '#/doc/' + i; }, prep.devis);
  await win.waitForSelector('.page-head .actions');
  const apres = await win.evaluate(() => ({
    colore: !!document.querySelector('#convert.btn-primary'),
    voir: !!document.querySelector('#voir-facture'),
    texte: (document.querySelector('#voir-facture') || {}).textContent || ''
  }));
  if (apres.colore) throw new Error('le bouton coloré « Facturer ce devis » est encore là sur un devis déjà facturé');
  if (!apres.voir) throw new Error('rien ne mène à la facture déjà établie');
  j.ok('« ' + apres.texte.trim() +' » remplace le bouton de facturation');

  j.etape('Une facture fournisseur saisie deux fois est signalée');
  const achat = await win.evaluate(() => {
    const d = window.__data;
    const a = (d.purchases || []).find(p => p.kind !== 'depense' && (p.number || '').trim() && p.supplierId);
    return a ? { number: a.number, supplierId: a.supplierId } : null;
  });
  if (!achat) throw new Error('le jeu d\'exemple n\'a aucune facture d\'achat numérotée');
  await win.evaluate(() => { location.hash = '#/achat/new'; });
  await win.waitForSelector('#b-lines');
  await win.evaluate(s => {
    document.querySelector('[data-combo=supplierId] input[type=hidden]').value = s;
  }, achat.supplierId);
  await win.fill('[name=number]', achat.number);
  await win.fill('#b-lines input[data-k=label]', 'Ressaisie de bonne foi');
  await win.fill('#b-lines input[data-k=unitPrice]', '100');
  await win.click('#save');
  const question = await win.waitForSelector('#modal-root #ok', { timeout: 4000 }).catch(() => null);
  if (!question) throw new Error('saisir deux fois la même facture fournisseur ne déclenche aucune question');
  const dit = await win.$eval('#modal-root', e => e.textContent);
  if (!/déjà saisie/.test(dit)) throw new Error('la question ne nomme pas la pièce déjà saisie : ' + dit.slice(0, 140));
  await win.click('#modal-root [data-close]');
  j.ok('la question nomme la pièce, sa date et son montant');

  // On quitte l'éditeur AVANT de fermer l'application. Sans ça, `app.close()` ne rend jamais la
  // main : le garde-fou de fermeture de fenêtre ouvre une boîte SYSTÈME que personne ne vient
  // refermer, et le processus principal reste bloqué dedans. Le test ne plantait pas — il restait
  // en vie pour toujours, ce qui est pire : on ne le relance plus, donc il ne sert plus à rien.
  //
  // Le garde-fou est une boîte à TROIS choix (`choiceDialog`) : « Enregistrer et continuer » (#a),
  // « Quitter sans enregistrer » (#b), Annuler. Ce n'est pas un `confirmDialog`, son bouton ne
  // s'appelle donc pas `#ok`.
  await win.evaluate(() => { location.hash = '#/dashboard'; });
  const garde = await win.waitForSelector('#modal-root #b', { timeout: 3000 }).catch(() => null);
  if (garde) await win.click('#modal-root #b');
  await win.waitForFunction(() => location.hash === '#/dashboard', null, { timeout: 5000 });
  await win.waitForTimeout(300);

  // Et la fermeture est BORNÉE. Un test qui reste bloqué pour toujours est pire qu'un test qui
  // échoue : il ne dit rien, on finit par ne plus le lancer, et il ne sert plus à rien. Même
  // principe que les commandes du chien de garde, chacune sous `Promise.race` (règle 6.5.0).
  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — les chiffres disent la vérité.`);
})().catch(e => { console.error(e); process.exit(1); });
