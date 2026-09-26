// L'éditeur de document (7.19.0).
//
// L'écran le plus utilisé de l'application, et sept endroits où il laissait faire une erreur sans
// rien dire : un timbre annoncé dans la mauvaise devise, une échéance qui reste sur l'ancienne date,
// une quantité effacée qui vaut zéro, un client qu'on ne peut pas corriger, un bouton qui invite à
// payer une facture déjà soldée, une suppression qui laisse des liens morts, un acompte qu'on ne
// peut demander qu'en pourcentage.
//
//   xvfb-run -a node test/e2e/editeur.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller, montant } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-editeur-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(300); };
  const nb = montant;

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Éditeur SUARL');
      await win.fill('#sf-form input[name=matricule]', '7788990Z/A/P/000');
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

  // ------------------------------------------------------------- 1. le timbre suit la devise
  j.etape('Le timbre annoncé est celui qui sera compté, dans la devise de la pièce');
  await aller('#/doc/new/facture');
  await win.waitForSelector('#stamp-lbl');
  const enDT = nb(await win.$eval('#stamp-lbl', e => e.textContent));
  await win.selectOption('#f-head select[name=currency]', 'EUR');
  await win.waitForTimeout(280);
  await win.fill('#f-head input[name=exchangeRate]', '3.4');
  await win.evaluate(() => document.querySelector('#f-head input[name=exchangeRate]').dispatchEvent(new Event('input', { bubbles: true })));
  await win.waitForTimeout(280);
  const enEUR = await win.$eval('#stamp-lbl', e => e.textContent);
  const attendu = enDT / 3.4;
  if (Math.abs(nb(enEUR) - attendu) > 0.01) {
    throw new Error(`l'étiquette annonce « ${enEUR} » là où le timbre vaut ${attendu.toFixed(3)} EUR (1 DT au taux 3,4)`);
  }
  // Et c'est bien le montant que les totaux comptent.
  const dansTotaux = await win.evaluate(() => {
    const tr = [...document.querySelectorAll('#totals tr')].find(x => /Timbre/.test(x.textContent));
    return tr ? tr.cells[1].textContent : '';
  });
  if (dansTotaux && Math.abs(nb(dansTotaux) - nb(enEUR)) > 0.001) {
    throw new Error(`l'étiquette dit « ${enEUR} » et le total « ${dansTotaux} »`);
  }
  j.ok(`${enDT} DT → ${enEUR.trim()} au taux 3,4, et les totaux disent la même chose`);

  // ------------------------------------------------------------- 2. l'échéance suit la date
  j.etape('Changer la date recalcule l\'échéance — sauf si elle a été saisie à la main');
  await win.selectOption('#f-head select[name=currency]', 'DT');
  await win.waitForTimeout(220);
  const lireDue = () => win.$eval('#f-head input[name=dueDate]', e => e.value);
  const posObjet = () => win.$eval('#f-head input[name=subject]', e => { const r = e.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}`; });
  const objet0 = await posObjet();
  const due0 = await lireDue();
  // On recule la date d'un mois par le champ visible, comme un utilisateur.
  const nouvelleDate = await win.evaluate(() => {
    const d = new Date(Date.now() - 40 * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  });
  const poserDate = (sel, iso) => win.evaluate(([s, x]) => {
    const hid = document.querySelector(s);
    hid.value = x;
    hid.dispatchEvent(new Event('input', { bubbles: true }));
  }, [sel, iso]);
  await poserDate('#f-head input[name=date]', nouvelleDate);
  await win.waitForTimeout(300);
  const due1 = await lireDue();
  if (due1 === due0) throw new Error(`l'échéance est restée au ${due0} alors que la date est passée au ${nouvelleDate}`);
  // 10.14.1 — on le dit par un message passager qui porte « Annuler » : la note de la 7.19.0 naissait
  // dans une cellule de la grille et poussait tout le formulaire d'une rangée (H-E1).
  const annonceDue = await win.evaluate(() => { const t = document.querySelector('#toast'); return t ? t.textContent : ''; });
  if (!/recalculée/.test(annonceDue)) throw new Error('rien ne dit que l\'échéance vient de bouger');
  if (!await win.$('#toast #toast-undo')) throw new Error('le message n\'offre pas de revenir en arrière');
  const objet1 = await posObjet();
  if (objet1 !== objet0) throw new Error(`le formulaire a bougé sous le curseur : « Objet » ${objet0} → ${objet1}`);
  // Le champ visible suit aussi (c'est un COUPLE hidden + texte).
  const texteVisible = await win.evaluate(() => {
    const hid = document.querySelector('#f-head input[name=dueDate]');
    return hid.closest('.datefield').querySelector('.d-txt').value;
  });
  if (!texteVisible) throw new Error('l\'échéance a changé dans les données mais pas à l\'écran');
  // « Annuler » rend l'ancienne échéance, et la tient pour choisie : elle ne suit plus la date.
  await win.click('#toast #toast-undo');
  await win.waitForTimeout(200);
  if (await lireDue() !== due0) throw new Error(`« Annuler » n'a pas rendu l'échéance d'avant (${await lireDue()} au lieu de ${due0})`);
  await poserDate('#f-head input[name=date]', '2029-06-01');
  await win.waitForTimeout(280);
  if (await lireDue() !== due0) throw new Error('une échéance rendue par « Annuler » s\'est remise à suivre la date');
  // Maintenant on la saisit À LA MAIN : elle ne doit plus bouger.
  await win.evaluate(() => {
    const hid = document.querySelector('#f-head input[name=dueDate]');
    hid.value = '2030-01-15';
    hid.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.waitForTimeout(200);
  await poserDate('#f-head input[name=date]', '2029-07-01');
  await win.waitForTimeout(280);
  const due2 = await lireDue();
  if (due2 !== '2030-01-15') throw new Error(`une échéance saisie à la main a été écrasée (${due2})`);
  j.ok(`${due0} → ${due1} avec la date, sans rien pousser ; « Annuler » la rend ; 2030-01-15 gardée telle quelle`);

  // ------------------------------------------------------------- 2 bis. et dans un achat (10.14.1)
  j.etape('L\'échéance d\'un achat suit aussi la date de la pièce');
  // L'éditeur de document est modifié : on répond à la question en partant, comme un humain.
  await win.evaluate(() => { location.hash = '#/achat/new'; });
  const quitter = await win.waitForSelector('#modal-root #b', { timeout: 2500 }).catch(() => null);
  if (quitter) await quitter.click();
  // Le champ est un COUPLE : l'input nommé est caché, on attend qu'il existe, pas qu'il se voie.
  await win.waitForSelector('#b-head input[name=dueDate]', { state: 'attached' });
  const lireDueA = () => win.$eval('#b-head input[name=dueDate]', e => e.value);
  const dA0 = await lireDueA();
  await poserDate('#b-head input[name=date]', '2023-01-10');
  await win.waitForTimeout(300);
  const dA1 = await lireDueA();
  if (dA1 !== '2023-02-09') throw new Error(`l'achat redaté au 10/01/2023 reste dû au ${dA1} (au lieu du 09/02/2023 — il était au ${dA0})`);
  const annonceA = await win.evaluate(() => { const t = document.querySelector('#toast'); return t ? t.textContent : ''; });
  if (!/recalculée au 09\/02\/2023/.test(annonceA)) throw new Error(`rien ne dit que l'échéance de l'achat a bougé (« ${annonceA} »)`);
  // Recopiée de la facture du fournisseur, elle ne bouge plus.
  await win.evaluate(() => {
    const hid = document.querySelector('#b-head input[name=dueDate]');
    hid.value = '2023-03-31';
    hid.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.waitForTimeout(200);
  await poserDate('#b-head input[name=date]', '2023-01-12');
  await win.waitForTimeout(280);
  if (await lireDueA() !== '2023-03-31') throw new Error(`l'échéance recopiée de la facture a été écrasée (${await lireDueA()})`);
  j.ok(`${dA0} → 2023-02-09 avec la date du 10/01/2023, puis 2023-03-31 gardée telle quelle`);
  // On rend l'éditeur de document à l'étape suivante, qui l'attend.
  await win.evaluate(() => { location.hash = '#/doc/new/facture'; });
  const quitter2 = await win.waitForSelector('#modal-root #b', { timeout: 2500 }).catch(() => null);
  if (quitter2) await quitter2.click();
  await win.waitForSelector('#f-head input[name=dueDate]', { state: 'attached' });

  // ------------------------------------------------------------- 3. une quantité effacée
  j.etape('Effacer une quantité ne la met pas à zéro');
  await win.fill('#lines input[data-k=label]', 'Prestation témoin');
  await win.fill('#lines input[data-k=unitPrice]', '1000');
  await win.fill('#lines input[data-k=qty]', '2');
  await win.waitForTimeout(220);
  const avant = await win.$eval('#totals', e => e.textContent);
  await win.fill('#lines input[data-k=qty]', '');
  await win.waitForTimeout(250);
  const apres = await win.evaluate(() => ({
    totaux: document.querySelector('#totals').textContent,
    marque: document.querySelector('#lines input[data-k=qty]').classList.contains('champ-faute'),
    retenu: window.__docEdit ? null : undefined
  }));
  if (apres.totaux !== avant) throw new Error('effacer la quantité a changé les totaux : la ligne est tombée à zéro');
  if (!apres.marque) throw new Error('le champ vide n\'est pas marqué : rien ne dit que la valeur affichée n\'est pas celle qui est retenue');
  await win.fill('#lines input[data-k=qty]', '3');
  await win.waitForTimeout(220);
  const repris = await win.evaluate(() => ({
    marque: document.querySelector('#lines input[data-k=qty]').classList.contains('champ-faute'),
    totaux: document.querySelector('#totals').textContent
  }));
  if (repris.marque) throw new Error('le marquage ne disparaît pas quand on retape une valeur');
  if (repris.totaux === avant) throw new Error('retaper la quantité n\'a pas mis les totaux à jour');
  j.ok('les totaux ne bougent pas pendant l\'effacement, et reprennent à la saisie suivante');

  // ------------------------------------------------------------- 4. la fiche du client
  j.etape('La fiche du client se corrige depuis le document');
  const cache = await win.evaluate(() => { const b = document.querySelector('#cl-edit'); return !b || b.hidden; });
  if (!cache) throw new Error('le bouton « Fiche du client » est offert alors qu\'aucun client n\'est choisi');
  // 10.12.0 — et il apparaît SANS RIEN DÉPLACER. Posé sous le champ, il poussait tout le formulaire
  // de 45 px au choix du client : le clic visé sur « Objet » tombait dans le vide, et la frappe
  // avec (test humain). On mesure où est le champ suivant avant et après.
  const objetAvant = await win.$eval('#f-head input[name=subject]', e => Math.round(e.getBoundingClientRect().top));
  await win.evaluate(() => {
    const d = window.__data;
    const hid = document.querySelector('[data-combo=clientId] input[type=hidden]');
    hid.value = d.clients[0].id;
    hid.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.waitForTimeout(320);
  const visible = await win.evaluate(() => { const b = document.querySelector('#cl-edit'); return !!b && !b.hidden; });
  if (!visible) throw new Error('le bouton « Fiche du client » n\'apparaît pas une fois le client choisi');
  const objetApres = await win.$eval('#f-head input[name=subject]', e => Math.round(e.getBoundingClientRect().top));
  if (Math.abs(objetApres - objetAvant) > 1) {
    throw new Error(`choisir le client a déplacé le champ « Objet » de ${objetApres - objetAvant} px : le clic suivant tombe à côté`);
  }
  await win.click('#cl-edit');
  await win.waitForSelector('#modal-root input[name=name]', { timeout: 4000 });
  const nomOuvert = await win.$eval('#modal-root input[name=name]', e => e.value);
  const nomAttendu = await win.evaluate(() => window.__data.clients[0].name);
  if (nomOuvert !== nomAttendu) throw new Error(`la fenêtre a ouvert « ${nomOuvert} » au lieu de « ${nomAttendu} »`);
  await win.click('#modal-root [data-close]');
  await win.waitForTimeout(200);
  j.ok(`« ${nomAttendu} » s'ouvre sans quitter le document`);

  // ------------------------------------------------------------- 5. l'acompte en dinars
  j.etape('Un acompte se demande en dinars, et le montant obtenu s\'annonce avant');
  // 10.14.1 — sur l'exemple de cinq ans, « le premier devis venu » date de 2022, dans un mois
  // clôturé : il s'ouvre fermé (10.14.0) et n'offre ni « Supprimer » ni rien à modifier. Le parcours
  // choisit par ce qui DISCRIMINE — un devis d'un mois encore ouvert.
  const devis = await win.evaluate(() => {
    const d = window.__data, C = window.SkanCore;
    const factures = new Set(d.documents.filter(x => x.type === 'facture' && x.fromQuoteId).map(x => x.fromQuoteId));
    const q = d.documents.find(x => x.type === 'devis' && x.number && x.clientId && !factures.has(x.id) && !C.isClosedDate(d, x.date));
    return q ? q.id : null;
  });
  if (!devis) throw new Error('aucun devis non facturé d\'un mois ouvert dans le jeu d\'exemple');
  // On quitte un brouillon modifié : le garde-fou « modifications non enregistrées » pose sa
  // question et REMET la page précédente dans la barre d'adresse pour le faire (2.4.0). Sans y
  // répondre, la navigation suivante n'a tout simplement pas lieu — et le test cherche un bouton
  // sur un écran qu'il n'a jamais quitté.
  await aller('#/doc/' + devis);
  const garde = await win.waitForSelector('#modal-root button', { timeout: 2000 }).catch(() => null);
  if (garde) {
    const jeter = await win.evaluate(() => {
      const b = [...document.querySelectorAll('#modal-root button')].find(x => /Ne pas enregistrer|Quitter|Abandonner/i.test(x.textContent));
      if (b) { b.click(); return b.textContent.trim(); }
      return '';
    });
    if (!jeter) throw new Error('le garde-fou s\'ouvre sans bouton pour abandonner les modifications');
    await win.waitForTimeout(400);
    await aller('#/doc/' + devis);
  }
  await win.waitForSelector('.page-head .actions');
  // « Facture d'acompte… » vit dans le menu ▾ des autres façons de facturer.
  await win.click('#bill-btn');
  await win.waitForFunction(() => { const l = document.querySelector('#bill-list'); return l && !l.hidden; });
  await win.click('#deposit');
  await win.waitForSelector('#df select[name=mode]');
  await win.selectOption('#df select[name=mode]', 'dt');
  await win.waitForTimeout(220);
  const champVisible = await win.evaluate(() => {
    const dt = document.querySelector('#dp-dt'), p = document.querySelector('#dp-pct');
    return { montant: !dt.hidden, pourcent: !p.hidden };
  });
  if (!champVisible.montant || champVisible.pourcent) throw new Error('le mode « montant » n\'échange pas les deux champs');
  await win.fill('#df input[name=montant]', '500');
  await win.waitForTimeout(250);
  const apercu = await win.$eval('#dp-apercu', e => e.textContent);
  if (!/à payer/.test(apercu)) throw new Error(`l'aperçu n'annonce pas le montant obtenu : « ${apercu} »`);
  const annonce = nb((apercu.match(/([\d\s.,]+)\s*(DT|EUR|USD)/) || [])[0] || '0');
  if (Math.abs(annonce - 500) > 5) throw new Error(`un acompte de 500 annonce ${annonce} : l'écart dépasse le timbre et les arrondis`);
  // Un montant aberrant est refusé AVANT de fabriquer un brouillon.
  await win.fill('#df input[name=montant]', '999999');
  await win.waitForTimeout(220);
  await win.click('#modal-root #ok');
  await win.waitForTimeout(320);
  const encore = await win.evaluate(() => !!document.querySelector('#df'));
  if (!encore) throw new Error('un acompte supérieur au devis a créé un brouillon au lieu d\'être refusé');
  await win.fill('#df input[name=montant]', '500');
  await win.waitForTimeout(220);
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => /#\/doc\//.test(location.hash) && !document.querySelector('#df'), { timeout: 5000 });
  const cree = await win.evaluate(() => {
    const id = location.hash.split('/').pop();
    const d = window.__data.documents.find(x => x.id === id);
    const t = d && window.SkanCore.computeTotals(d, window.__data.company);
    return d ? { deposit: d.deposit, ttc: t.netToPay, horsTimbre: t.totalTTC - t.stamp } : null;
  });
  if (!cree || !cree.deposit) throw new Error('aucune facture d\'acompte créée');
  if (Math.abs(cree.ttc - annonce) > 0.0005) throw new Error(`la facture vaut ${cree.ttc} là où la fenêtre annonçait ${annonce}`);
  // 10.14.1 (ACP-01) — 500 demandés font 500 TTC, au millime : un pourcentage arrondi au millième
  // donnait 500,002 et le client payait deux millimes de plus que ce qu'on lui avait annoncé au
  // téléphone. Le timbre (et une retenue éventuelle) s'y ajoutent ensuite, comme sur toute facture.
  if (Math.abs(cree.horsTimbre - 500) > 1e-9) throw new Error(`500 DT demandés font ${cree.horsTimbre} TTC hors timbre au lieu de 500 exactement`);
  if (Number(cree.deposit.montant) !== 500) throw new Error('la facture d\'acompte ne retient pas le montant demandé (500) : elle ne pourra pas le dire');
  j.ok(`500 DT demandés → ${cree.horsTimbre} TTC hors timbre, ${cree.ttc} à payer, comme annoncé`);

  // ------------------------------------------------------------- 6. la suppression nomme les liens
  j.etape('Supprimer le devis nomme la facture d\'acompte qui en est issue');
  await aller('#/doc/' + devis);
  await win.waitForSelector('.page-head .actions');
  // « Supprimer » vit dans le menu « Plus ▾ ».
  const dejaVisible = await win.evaluate(() => { const b = document.querySelector('#del'); return !!b && b.offsetParent !== null; });
  if (!dejaVisible) {
    await win.click('#more-btn');
    await win.waitForFunction(() => { const l = document.querySelector('#more-list'); return l && !l.hidden; });
  }
  await win.click('#del');
  await win.waitForSelector('#modal-root #ok', { timeout: 4000 });
  const question = await win.$eval('#modal-root', e => e.textContent);
  if (!/en est issue|en sont issues/.test(question)) throw new Error(`la question ne nomme pas les pièces liées : « ${question.slice(0, 160)} »`);
  if (!/acompte/.test(question)) throw new Error(`la question ne dit pas de quelle sorte de pièce il s'agit : « ${question.slice(0, 160)} »`);
  await win.click('#modal-root [data-close]');
  await win.waitForTimeout(200);
  j.ok('la question nomme la facture d\'acompte et annonce le lien rompu');

  // ------------------------------------------------------------- 7. la facture soldée
  j.etape('Une facture soldée n\'invite plus à enregistrer un paiement');
  const soldee = await win.evaluate(() => {
    const d = window.__data, C = window.SkanCore;
    return (d.documents.find(x => x.type === 'facture' && x.status !== 'brouillon'
      && C.invoiceBalance(x, d, d.company).remaining <= 0.0005) || {}).id || null;
  });
  if (!soldee) throw new Error('aucune facture soldée dans le jeu d\'exemple : le test ne prouve rien');
  await aller('#/doc/' + soldee);
  await win.waitForSelector('.page-head .actions');
  if (await win.$('#pay')) throw new Error('« Enregistrer un paiement » est encore proposé sur une facture soldée');
  // Et sur une facture qui reste due, il est là.
  const due = await win.evaluate(() => {
    const d = window.__data, C = window.SkanCore;
    return (d.documents.find(x => x.type === 'facture' && x.status !== 'brouillon' && x.status !== 'annulée'
      && C.invoiceBalance(x, d, d.company).remaining > 0.0005) || {}).id || null;
  });
  if (due) {
    await aller('#/doc/' + due);
    await win.waitForSelector('.page-head .actions');
    if (!(await win.$('#pay'))) throw new Error('le bouton a disparu aussi des factures qui restent dues');
  }
  j.ok('absent sur une facture soldée, présent sur une facture qui reste due');

  // ------------------------------------------------------------- 8. la grille des lignes (10.12.0)
  // Test humain : à côté de l'aperçu, la désignation avait 98 px à 1440 et 84 px à 1280, le prix
  // 45 px — on lisait « ence murale » de ce qu'on venait de taper. On MESURE, aux deux largeurs,
  // avec et sans l'aperçu, et on exige que chaque en-tête tombe sur sa colonne.
  j.etape('La grille des lignes laisse lire la désignation et le prix, et ses en-têtes tombent sur leurs colonnes');
  const grille = () => win.evaluate(() => {
    const lab = document.querySelector('#lines tr input[data-k=label]');
    const pu = document.querySelector('#lines tr input[data-k=unitPrice]');
    const th = [...document.querySelectorAll('table.lignes-doc thead th')];
    const td = [...document.querySelector('#lines tr').children];
    const decales = th.map((t, i) => ({ t: t.textContent.trim(), dx: Math.round(t.getBoundingClientRect().left - td[i].getBoundingClientRect().left) }))
      .filter(x => x.t && Math.abs(x.dx) > 1);
    return { lab: Math.round(lab.getBoundingClientRect().width), pu: Math.round(pu.getBoundingClientRect().width), decales };
  });
  const mesures = [];
  for (const [w, h] of [[1440, 900], [1280, 800]]) {
    await win.setViewportSize({ width: w, height: h });
    await aller('#/doc/new/devis');
    await win.waitForSelector('#lines tr input[data-k=label]');
    await win.waitForTimeout(250);
    for (const apercu of [true, false]) {
      const masque = await win.evaluate(() => document.querySelector('.editor').classList.contains('no-preview'));
      if (masque === apercu) { await win.click('#pv-toggle'); await win.waitForTimeout(250); }
      const m = await grille();
      const quoi = `${w} px ${apercu ? 'avec' : 'sans'} l'aperçu`;
      if (m.lab < 300) throw new Error(`${quoi} : la désignation n'a que ${m.lab} px`);
      if (m.pu < 80) throw new Error(`${quoi} : le prix unitaire n'a que ${m.pu} px`);
      if (m.decales.length) throw new Error(`${quoi} : en-têtes décalés de leur colonne — ${m.decales.map(x => x.t + ' ' + x.dx + ' px').join(', ')}`);
      mesures.push(`${quoi} : ${m.lab}/${m.pu} px`);
    }
    // on laisse l'aperçu affiché, comme on l'a trouvé
    if (await win.evaluate(() => document.querySelector('.editor').classList.contains('no-preview'))) { await win.click('#pv-toggle'); await win.waitForTimeout(200); }
  }
  await win.setViewportSize({ width: 1440, height: 900 });
  j.ok('désignation / prix — ' + mesures.join(' · '));

  // ------------------------------------------------------------- 9. après « Enregistrer » (10.12.0)
  // Test humain : enregistrer un devis NEUF laissait « ← le document » en bouton retour, et il
  // menait à #/doc/new/devis — un devis VIERGE. La page enregistrée remplace celle de création.
  j.etape('Après avoir enregistré un devis neuf, le retour mène à la liste et l\'étape suivante est l\'envoi');
  await aller('#/devis');
  await win.waitForSelector('#new');
  await win.click('#new');
  await win.waitForSelector('#lines tr input[data-k=label]');
  await win.evaluate(() => {
    const hid = document.querySelector('[data-combo=clientId] input[type=hidden]');
    hid.value = window.__data.clients[0].id;
    hid.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.fill('#f-head input[name=subject]', 'Devis du parcours de l\'éditeur');
  await win.fill('#lines tr input[data-k=label]', 'Prestation mesurée');
  await win.fill('#lines tr input[data-k=unitPrice]', '120');
  await win.waitForTimeout(250);
  await win.click('#save');
  await win.waitForFunction(() => /^#\/doc\/(?!new)/.test(location.hash), { timeout: 5000 });
  await win.waitForSelector('#back');
  const retour = await win.evaluate(() => ({ texte: document.querySelector('#back').textContent.trim(), pile: window.__navStack.slice(-3) }));
  if (!/Devis/.test(retour.texte)) throw new Error(`le bouton retour dit « ${retour.texte} » au lieu de mener aux Devis`);
  // Le SOMMET de la pile est la page d'avant la création : une page de création visitée plus tôt
  // et quittée sans enregistrer reste, elle, un endroit où l'on est vraiment passé.
  if (retour.pile[retour.pile.length - 1] !== '#/devis') throw new Error(`la page de création est restée au sommet de la pile : ${retour.pile.join(' → ')}`);
  // UN seul bouton principal : l'envoi. « Enregistrer » ne l'est plus tant que rien n'a bougé.
  const primaires = () => win.evaluate(() => [...document.querySelectorAll('.page-head .actions .btn-primary')].map(b => b.id));
  const p1 = await primaires();
  if (p1.length !== 1 || p1[0] !== 'email') throw new Error(`devis enregistré et inchangé : boutons principaux ${JSON.stringify(p1)} au lieu de l'envoi seul`);
  await win.fill('#f-head input[name=subject]', 'Devis du parcours de l\'éditeur (modifié)');
  await win.waitForTimeout(200);
  const p2 = await primaires();
  if (p2.length !== 1 || p2[0] !== 'save') throw new Error(`après une modification : boutons principaux ${JSON.stringify(p2)} au lieu de « Enregistrer » seul`);
  await win.click('#save');
  await win.waitForTimeout(300);
  await win.click('#back');
  await win.waitForFunction(() => location.hash === '#/devis', { timeout: 4000 });
  j.ok(`« ${retour.texte} » mène à la liste ; principal : l'envoi, puis « Enregistrer » dès qu'on modifie`);

  // ------------------------------------------------------------- 10. le titre de la fenêtre (10.12.0)
  j.etape('La fenêtre porte le titre de la page, pièce neuve et achat compris');
  await aller('#/doc/new/devis');
  await win.waitForFunction(() => /Nouveau devis — SkanFact/.test(document.title), { timeout: 3000 })
    .catch(async () => { throw new Error(`titre sur un devis neuf : « ${await win.evaluate(() => document.title)} »`); });
  await aller('#/achat/new');
  await win.waitForFunction(() => /Nouvelle facture d.achat — SkanFact/.test(document.title), { timeout: 3000 })
    .catch(async () => { throw new Error(`titre sur un achat neuf : « ${await win.evaluate(() => document.title)} »`); });
  // Et la bulle d'un bouton caché se cache avec lui : la lecture de photo est en pause.
  const orpheline = await win.evaluate(() => {
    const b = document.querySelector('#photo'); if (!b || !b.hidden) return null;
    const i = b.nextElementSibling; return i && i.matches('button.i') ? getComputedStyle(i).display : 'aucune bulle';
  });
  if (orpheline !== 'none' && orpheline !== 'aucune bulle') throw new Error(`la bulle de « Lire une photo… » reste affichée (${orpheline}) alors que le bouton est caché`);
  j.ok('« Nouveau devis », « Nouvelle facture d\'achat », et aucune bulle orpheline');

  // ------------------------------------------------------------- 11. une bulle dans un menu (10.12.0)
  // Une bulle posée DANS un bouton fait un bouton dans un bouton : le navigateur ferme le premier,
  // et la bulle tombait seule sur la ligne suivante du menu « Facturer ▾ ».
  j.etape('Dans le menu « Facturer ▾ », chaque bulle reste sur la ligne de son entrée');
  const brouillonDevis = await win.evaluate(() => {
    const d = window.__data;
    const q = d.documents.find(x => x.type === 'devis' && x.status === 'brouillon' && x.number);
    return q ? q.id : null;
  });
  if (!brouillonDevis) throw new Error('aucun devis en brouillon : le menu ne peut pas être ouvert');
  await aller('#/doc/' + brouillonDevis);
  await win.waitForSelector('#bill-btn');
  await win.click('#bill-btn');
  await win.waitForFunction(() => { const l = document.querySelector('#bill-list'); return l && !l.hidden; });
  const lignes = await win.evaluate(() => [...document.querySelectorAll('#bill-list button.i')].map(i => {
    const voisin = i.previousElementSibling;
    const a = i.getBoundingClientRect(), b = voisin ? voisin.getBoundingClientRect() : null;
    return { entree: voisin ? voisin.textContent.trim() : '(rien)', ecart: b ? Math.round(Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2)) : 999 };
  }));
  if (!lignes.length) throw new Error('aucune bulle dans le menu « Facturer ▾ » : le test ne prouve rien');
  const seules = lignes.filter(x => x.ecart > 6);
  if (seules.length) throw new Error('bulles tombées sous leur entrée : ' + seules.map(x => `${x.entree} (${x.ecart} px)`).join(', '));
  j.ok(lignes.map(x => x.entree).join(' · '));

  // ------------------------------------------------------------- 12. le retour nomme la pièce (10.12.0)
  // Test humain : sur la facture tirée d'un devis, le bouton disait « ← le document ». Lequel, quand
  // on est soi-même sur un document ? Il nomme maintenant la pièce, le client ou le fournisseur.
  j.etape('Sur la facture tirée d\'un devis, le bouton retour nomme le devis');
  const aFacturer = await win.evaluate(() => {
    const d = window.__data;
    const tires = new Set(d.documents.flatMap(x => [x.fromQuoteId, x.deposit && x.deposit.quoteId]).filter(Boolean));
    const q = d.documents.find(x => x.type === 'devis' && x.number && x.clientId && (x.status === 'envoyé' || x.status === 'accepté') && !tires.has(x.id));
    return q ? { id: q.id, number: q.number } : null;
  });
  if (!aFacturer) throw new Error('aucun devis envoyé ou accepté sans facture : le test ne prouve rien');
  await aller('#/doc/' + aFacturer.id);
  await win.waitForSelector('#convert');
  await win.click('#convert');
  await win.waitForFunction(id => /^#\/doc\//.test(location.hash) && !location.hash.endsWith(id), aFacturer.id, { timeout: 5000 });
  await win.waitForSelector('#back');
  const r12 = await win.evaluate(() => ({ texte: document.querySelector('#back').textContent.trim(), bulle: document.querySelector('#back').title }));
  if (!r12.texte.includes('Devis ' + aFacturer.number)) throw new Error(`le bouton retour dit « ${r12.texte} » au lieu de nommer ${aFacturer.number}`);
  if (!r12.bulle.includes('Revenir à Devis ' + aFacturer.number)) throw new Error(`la bulle du bouton retour dit « ${r12.bulle} »`);
  j.ok(`« ${r12.texte} »`);

  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — l'éditeur ne laisse plus passer.`);
})().catch(e => { console.error(e); process.exit(1); });
