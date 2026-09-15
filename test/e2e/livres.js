// Le grand livre et la balance (8.8.0).
//
// Les deux documents qu'un cabinet tire en premier, dans l'application réelle : le grand livre
// (un compte, ses mouvements, le solde qui avance), la balance (tous les comptes, des totaux qui
// tombent juste), la balance auxiliaire (les clients un par un), et le plan de comptes qui donne à
// chaque tiers son sous-compte — figé sur la fiche.
//
//   xvfb-run -a node test/e2e/livres.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-livres-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(320); };
  const onglet = async t => { await win.click(`#c-tabs button[data-tab=${t}]`); await win.waitForTimeout(400); };
  const nombre = s => Number(String(s).replace(/[^\d,.-]/g, '').replace(/\s/g, '').replace(',', '.')) || 0;

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Livres SUARL');
      await win.fill('#sf-form input[name=matricule]', '2233445Z/A/P/000');
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

  // -------------------------------------------------- 1. le grand livre, tous comptes
  j.etape('Le grand livre : chaque compte, et le solde qui avance jusqu\'au total du compte');
  await aller('#/compta');
  await win.waitForSelector('#c-tabs');
  // Toute l'année : c'est là que les comptes sont nombreux.
  await win.selectOption('#c-month', '');
  await win.waitForTimeout(300);
  await onglet('grandlivre');
  await win.waitForSelector('.gl-compte');
  const gl = await win.evaluate(() => [...document.querySelectorAll('.gl-compte')].map(p => {
    const soldes = [...p.querySelectorAll('.gl-solde')].map(td => td.textContent);
    const tot = p.querySelector('tfoot td:last-child').textContent;
    return { compte: p.dataset.compte, titre: p.querySelector('h2').textContent.trim(), lignes: soldes.length, dernier: soldes[soldes.length - 1] || '', total: tot, ouverture: p.querySelector('.gl-ouv') ? p.querySelector('.gl-ouv').textContent : '' };
  }));
  if (gl.length < 8) throw new Error(`seulement ${gl.length} compte(s) au grand livre de l'année`);
  gl.forEach(c => {
    if (!c.ouverture.includes('Solde d\'ouverture')) throw new Error(`${c.compte} : pas de ligne d'ouverture`);
    if (c.lignes && nombre(c.dernier) !== nombre(c.total)) throw new Error(`${c.compte} : le dernier solde progressif (${c.dernier}) n'est pas le total du compte (${c.total})`);
    if (/Compte hors plan/.test(c.titre)) throw new Error(`${c.compte} n'a pas d'intitulé : « ${c.titre} »`);
  });
  j.ok(`${gl.length} comptes — ${gl.map(c => c.compte).join(', ')}`);

  // -------------------------------------------------- 2. un seul compte, par le sélecteur
  j.etape('Choisir un compte ne garde que lui, et l\'export le nomme');
  await win.click('[data-combo=glCompte] .combo-btn');
  await win.waitForSelector('[data-combo=glCompte] .combo-pop:not([hidden])');
  await win.fill('[data-combo=glCompte] .combo-q', '411');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(450);
  const seul = await win.evaluate(() => [...document.querySelectorAll('.gl-compte')].map(p => p.dataset.compte));
  if (seul.length !== 1 || !seul[0].startsWith('411')) throw new Error(`le sélecteur devait ne garder que 411, il garde ${JSON.stringify(seul)}`);
  const lignes411 = await win.evaluate(() => document.querySelectorAll('.gl-compte tbody tr').length - 1);
  if (lignes411 < 5) throw new Error(`le compte Clients de l'année ne porte que ${lignes411} ligne(s)`);
  j.ok(`411 seul, ${lignes411} mouvements`);

  // -------------------------------------------------- 3. la balance
  j.etape('La balance tombe juste, et ses totaux sont ceux du grand livre');
  await onglet('balance');
  await win.waitForSelector('#bal-t');
  const bal = await win.evaluate(() => {
    const ok = !!document.querySelector('#bal-ok');
    const foot = [...document.querySelectorAll('#bal-t tfoot td')].map(td => td.textContent);
    const rows = [...document.querySelectorAll('#bal-t tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent));
    return { ok, foot, rows: rows.length, comptes: rows.map(r => r[0]) };
  });
  if (!bal.ok) throw new Error('la balance ne se dit pas équilibrée sur le jeu d\'exemple');
  if (bal.rows !== gl.length) throw new Error(`${bal.rows} comptes à la balance contre ${gl.length} au grand livre`);
  // Totaux : ouverture D = C, mouvements D = C, soldes D = C (les six cellules après « Totaux »).
  const t = bal.foot.slice(1).map(nombre);
  if (t[0] !== t[1] || t[2] !== t[3] || t[4] !== t[5]) throw new Error(`les totaux ne tombent pas juste : ${bal.foot.join(' | ')}`);
  j.ok(`${bal.rows} comptes, ouverture ${bal.foot[1]}, mouvements ${bal.foot[3]}, soldes ${bal.foot[5]}`);

  // -------------------------------------------------- 4. l'auxiliaire clients
  j.etape('La balance auxiliaire : un client par ligne, sur le compte collectif tant que rien n\'est réglé');
  await win.click('#bal-vues button[data-vue=clients]');
  await win.waitForSelector('#bal-aux');
  const aux1 = await win.evaluate(() => [...document.querySelectorAll('#bal-aux tbody tr')].map(tr => ({ compte: tr.children[0].textContent, tiers: tr.children[1].textContent })));
  if (aux1.length < 3) throw new Error(`seulement ${aux1.length} client(s) dans la balance auxiliaire`);
  if (!aux1.every(r => r.compte === '411')) throw new Error('avant réglage, tous les clients devraient être sur 411');
  j.ok(`${aux1.length} clients sur 411`);

  // -------------------------------------------------- 5. le plan de comptes active les sous-comptes
  j.etape('Le plan de comptes donne un sous-compte à chaque tiers, figé sur la fiche');
  await win.click('#bal-plan');
  await win.waitForSelector('#modal-root input[name=auxiliaires]');
  await win.click('#modal-root input[name=auxiliaires]');
  await win.click('#modal-root #ch-ok');
  await win.waitForSelector('#bal-aux');
  const aux2 = await win.evaluate(() => [...document.querySelectorAll('#bal-aux tbody tr')].map(tr => ({ compte: tr.children[0].textContent, tiers: tr.children[1].textContent })));
  if (!aux2.every(r => /^411\d{3}$/.test(r.compte))) throw new Error(`les clients devraient être sur 411xxx : ${aux2.map(r => r.compte).join(', ')}`);
  const fiches = await win.evaluate(() => ({ codes: window.__data.clients.filter(c => c.compteAux).length, total: window.__data.clients.length, actif: window.__data.auxiliaires }));
  if (!fiches.actif || fiches.codes !== fiches.total) throw new Error(`les codes ne sont pas figés sur les fiches : ${fiches.codes}/${fiches.total}`);
  // La balance générale tombe toujours juste, avec un sous-compte par client et son nom.
  await win.click('#bal-vues button[data-vue=generale]');
  await win.waitForSelector('#bal-t');
  const gen2 = await win.evaluate(() => ({
    ok: !!document.querySelector('#bal-ok'),
    sous: [...document.querySelectorAll('#bal-t tbody tr')].filter(tr => /^411\d{3}$/.test(tr.children[0].textContent)).map(tr => tr.children[1].textContent)
  }));
  if (!gen2.ok) throw new Error('la balance ne tombe plus juste avec les sous-comptes');
  if (gen2.sous.length < 3 || gen2.sous.some(l => l === 'Clients' || /hors plan/.test(l))) throw new Error(`les sous-comptes doivent porter le nom du client : ${gen2.sous.join(', ')}`);
  j.ok(`${aux2.length} clients sur ${aux2[0].compte}…${aux2[aux2.length - 1].compte}, nommés dans la balance générale`);

  // -------------------------------------------------- 6. le grand livre suit
  j.etape('Le grand livre montre les sous-comptes, et « 4 » donne tous les tiers');
  await onglet('grandlivre');
  await win.waitForSelector('.gl-compte');
  const apres = await win.evaluate(() => [...document.querySelectorAll('.gl-compte')].map(p => p.dataset.compte));
  if (!apres.some(c => /^411\d{3}$/.test(c))) throw new Error('le grand livre ne montre pas les sous-comptes clients');
  if (apres.includes('411')) throw new Error('le collectif 411 ne devrait plus porter de mouvement');
  await win.click('[data-combo=glCompte] .combo-btn');
  await win.waitForSelector('[data-combo=glCompte] .combo-pop:not([hidden])');
  // « Tous les comptes » est la première entrée : on la reprend pour vérifier l'export sans filtre.
  await win.fill('[data-combo=glCompte] .combo-q', 'Tous');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(400);
  const tous = await win.evaluate(() => document.querySelectorAll('.gl-compte').length);
  if (tous < apres.length) throw new Error('« Tous les comptes » en montre moins qu\'avant');
  j.ok(`${apres.filter(c => /^411\d{3}$/.test(c)).length} sous-comptes clients au grand livre, ${tous} comptes en tout`);

  // -------------------------------------------------- 8. le livre-journal (8.9.0)
  j.etape('Le livre-journal : un numéro continu par pièce, le centralisateur, et l\'OD de l\'exemple');
  await onglet('ecritures');
  await win.waitForSelector('#ecr-t');
  const lj = await win.evaluate(() => ({
    nums: [...document.querySelectorAll('#ecr-t tbody tr td:first-child')].map(td => Number(td.textContent)),
    central: document.querySelectorAll('#ecr-central tbody tr').length,
    ods: [...document.querySelectorAll('#ecr-ods tbody tr')].map(tr => tr.children[1].textContent),
    journaux: [...document.querySelectorAll('#ecr-central thead th')].map(th => th.textContent.trim().split(' ')[0])
  }));
  if (!lj.nums.length || lj.nums.some(n => !(n > 0))) throw new Error(`les écritures ne portent pas de numéro : ${lj.nums.slice(0, 5)}`);
  if (lj.central !== 12) throw new Error(`le centralisateur devrait avoir douze mois, il en a ${lj.central}`);
  if (!lj.journaux.includes('OD') || !lj.journaux.includes('BQ')) throw new Error(`journaux du centralisateur : ${lj.journaux.join(', ')}`);
  if (!lj.ods.some(p => /^OD-\d{4}-001$/.test(p))) throw new Error(`l'OD de l'exemple manque : ${lj.ods.join(', ')}`);
  j.ok(`numéros ${Math.min(...lj.nums)}…${Math.max(...lj.nums)}, centralisateur ${lj.journaux.filter(x => /^[A-Z]+$/.test(x)).join('/')}, OD ${lj.ods.join(', ')}`);

  // -------------------------------------------------- 9. saisir une OD
  j.etape('Une opération diverse déséquilibrée est refusée, puis enregistrée une fois juste');
  await win.click('#ecr-od');
  await win.waitForSelector('#modal-root #odf');
  await win.fill('#modal-root input[name=label]', 'Loyer du local, réglé par le gérant');
  const lignes = await win.$$('#modal-root #od-lignes tbody tr');
  await lignes[0].$eval('.od-compte', el => { el.value = '613'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await lignes[0].$eval('.od-debit', el => { el.value = '1200'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await lignes[1].$eval('.od-compte', el => { el.value = '4421'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await lignes[1].$eval('.od-credit', el => { el.value = '1000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const ecart = await win.$eval('#modal-root #od-ecart', e => e.textContent);
  if (!/Écart de 200/.test(ecart)) throw new Error(`l'écart n'est pas annoncé pendant la saisie : « ${ecart} »`);
  const intitule = await win.$eval('#modal-root #od-lignes tbody tr .od-lib', e => e.textContent);
  if (!/Locations/.test(intitule)) throw new Error(`le compte 613 n'est pas nommé pendant la saisie : « ${intitule} »`);
  await win.click('#modal-root #od-ok');
  await win.waitForTimeout(300);
  if (!await win.$('#modal-root #odf')) throw new Error('une OD déséquilibrée a été enregistrée');
  const avantOD = await win.evaluate(() => window.__data.ecrituresOD.length);
  await lignes[1].$eval('.od-credit', el => { el.value = '1200'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const juste = await win.$eval('#modal-root #od-ecart', e => e.textContent);
  if (!/tombe juste/.test(juste)) throw new Error(`l'équilibre n'est pas annoncé : « ${juste} »`);
  await win.click('#modal-root #od-ok');
  await win.waitForFunction(() => !document.querySelector('#modal-root #odf'));
  await win.waitForTimeout(300);
  const apresOD = await win.evaluate(() => ({ n: window.__data.ecrituresOD.length, derniere: window.__data.ecrituresOD[window.__data.ecrituresOD.length - 1],
    affichees: [...document.querySelectorAll('#ecr-ods tbody tr')].map(tr => tr.children[1].textContent),
    compte613: [...document.querySelectorAll('#ecr-t tbody tr')].some(tr => tr.children[4].textContent === '613') }));
  if (apresOD.n !== avantOD + 1) throw new Error('l\'OD équilibrée n\'a pas été enregistrée');
  if (!/^OD-\d{4}-002$/.test(apresOD.derniere.piece)) throw new Error(`numéro de pièce inattendu : ${apresOD.derniere.piece}`);
  if (!apresOD.affichees.includes(apresOD.derniere.piece)) throw new Error('l\'OD enregistrée n\'apparaît pas dans la liste');
  j.ok(`${apresOD.derniere.piece} enregistrée, 1 200 au 613 / 4421${apresOD.compte613 ? ', visible dans le détail' : ''}`);

  // -------------------------------------------------- 10. le lettrage
  j.etape('Le lettrage liste ce qui reste ouvert, et une ligne ouvre sa pièce');
  await onglet('balance');
  await win.waitForSelector('#bal-vues');
  await win.click('#bal-vues button[data-vue=lettrage]');
  await win.waitForSelector('#let-clients');
  const let1 = await win.evaluate(() => ({ lignes: document.querySelectorAll('#let-clients tbody tr').length, go: (document.querySelector('#let-clients tbody tr[data-go]') || {}).dataset && document.querySelector('#let-clients tbody tr[data-go]').dataset.go,
    retard: document.querySelectorAll('#let-clients tbody tr.b-late').length }));
  if (!let1.lignes) throw new Error('aucune pièce client ouverte dans le lettrage de l\'exemple');
  if (!let1.retard) throw new Error('les retards de l\'exemple ne sont pas marqués');
  await win.click('#let-clients tbody tr[data-go]');
  await win.waitForFunction(g => location.hash === g, let1.go, { timeout: 4000 });
  j.ok(`${let1.lignes} pièces ouvertes (${let1.retard} en retard) — la première ouvre ${let1.go}`);

  // -------------------------------------------------- 11. les états financiers (9.0.0)
  j.etape('Les états financiers : actif = passif, et le résultat des deux états est le même');
  await aller('#/compta');
  await win.waitForSelector('#c-tabs');
  await onglet('etats');
  await win.waitForSelector('#et-resultat');
  const et = await win.evaluate(() => ({
    ok: !!document.querySelector('#et-ok'), resultat: document.querySelector('#et-resultat').textContent,
    resultatBas: [...document.querySelectorAll('#c-body .panel p strong')].map(s => s.textContent).find(t => /^Résultat/.test(t)) || '',
    groupes: [...document.querySelectorAll('#c-body .total-row td:first-child')].map(td => td.textContent)
  }));
  if (!et.ok) throw new Error('le bilan de l\'exemple ne se dit pas équilibré');
  if (!et.resultatBas.includes(et.resultat.trim())) throw new Error(`le résultat du bilan (${et.resultat}) n'est pas celui de l'état de résultat (${et.resultatBas})`);
  if (!et.groupes.some(g => /Trésorerie/.test(g)) || !et.groupes.some(g => /Produits/.test(g))) throw new Error(`rubriques inattendues : ${et.groupes.join(' | ')}`);
  j.ok(`bilan équilibré, résultat ${et.resultat.trim()} des deux côtés — ${et.groupes.length} rubriques`);

  // -------------------------------------------------- 12. l'à-nouveau dans le grand livre
  j.etape('Le grand livre de janvier ouvre par la pièce d\'à-nouveau');
  await win.selectOption('#c-month', '01');
  await win.waitForTimeout(300);
  await onglet('grandlivre');
  await win.waitForSelector('.gl-compte');
  const an = await win.evaluate(() => [...document.querySelectorAll('.gl-compte tbody tr')].filter(tr => tr.children[1].textContent === 'AN').length);
  if (!an) throw new Error('aucune ligne AN en janvier');
  j.ok(`${an} lignes d'à-nouveau en janvier`);

  // -------------------------------------------------- 13. l'état de rapprochement (9.0.0)
  j.etape('L\'état de rapprochement se remplit dès que le solde du relevé est saisi');
  await aller('#/tresorerie');
  await win.waitForSelector('#t-tabs');
  await win.click('#t-tabs button[data-tab=rapprochement]');
  await win.waitForSelector('#stmt');
  const solde = await win.evaluate(() => window.SkanCore.reconciliation(window.__data, window.__data.company, document.querySelector('#t-acc2').value, window.SkanCore.today()).pointed);
  await win.fill('#stmt', String(solde));
  await win.dispatchEvent('#stmt', 'change');
  await win.waitForSelector('#t-etat');
  const ecartReco = await win.$eval('#t-ecart', e => e.textContent);
  if (!/^0[,.]000/.test(ecartReco.trim())) throw new Error(`le relevé égal au solde pointé devrait donner un écart nul, il donne ${ecartReco}`);
  j.ok(`relevé saisi à ${solde} : écart ${ecartReco.trim()}`);

  // -------------------------------------------------- 14. la TFP dans les barèmes
  j.etape('Les barèmes proposent la TFP et le FOPROLOS, et un bulletin les compte dans le coût');
  await aller('#/paie');
  await win.waitForSelector('#p-tabs');
  await win.click('#p-tabs button[data-tab=baremes]');
  await win.waitForSelector('#rf input[name=tfpRate]');
  const taux = await win.evaluate(() => ({ tfp: document.querySelector('#rf input[name=tfpRate]').value, fop: document.querySelector('#rf input[name=foprolosRate]').value,
    demo: [...document.querySelectorAll('#rf-demo tbody tr')].map(tr => tr.children[4].textContent) }));
  if (!(Number(taux.tfp) > 0) || !(Number(taux.fop) > 0)) throw new Error(`taux TFP/FOPROLOS absents : ${JSON.stringify(taux)}`);
  const coutMille = nombre(taux.demo[0]);
  if (!(coutMille > 1190)) throw new Error(`le coût employeur d'un brut de 1 000 devrait dépasser 1 190 avec TFP et FOPROLOS, il vaut ${taux.demo[0]}`);
  j.ok(`TFP ${taux.tfp} %, FOPROLOS ${taux.fop} % — 1 000 brut coûte ${taux.demo[0]}`);

  await Promise.race([app.close(), new Promise((_, rej) => setTimeout(() => rej(new Error('l\'application ne se ferme pas : un garde-fou est resté armé')), 8000))]);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — le grand livre et la balance tiennent debout.`);
})().catch(e => { console.error(e); process.exit(1); });
