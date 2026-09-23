// Où tombe l'argent (7.3.0).
//
// Pourquoi ce test existe : depuis la 3.3.0, `cashMovements` lit `p.accountId` sur chaque paiement
// client et chaque règlement fournisseur. RIEN ne l'écrivait — aucun des deux formulaires n'avait le
// champ. Tout ce qui venait d'une facture ou d'un achat tombait donc sur le compte par défaut, quel
// que soit le mode de paiement : un client qui règle 300 DT en espèces faisait monter le compte
// BANCAIRE de 300 DT, et la caisse ne bougeait pas. Le rapprochement bancaire ne tombait jamais
// juste, et rien à l'écran ne disait pourquoi — pendant que la bulle « Compte par défaut » parlait
// des paiements « pour lesquels tu n'as rien précisé » et que la page Trésorerie renvoyait sur la
// facture en disant « ils se modifient là-bas », c'est-à-dire là où le champ n'existait pas.
//
// Un champ lu mais jamais écrit ne plante pas, ne casse aucun test de calcul, et donne un chiffre
// faux tous les jours. Ce test fait le geste en entier dans l'application réelle.
//
//   xvfb-run -a node test/e2e/argent.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-argent-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const lire = () => JSON.parse(fs.readFileSync(path.join(userData, 'dossiers', 'principal', 'skanfact-data.json'), 'utf8'));

  j.etape('Une entreprise, deux comptes');
  await win.waitForSelector('#setup');
  for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Quincaillerie Test SUARL');
      await win.fill('#sf-form input[name=matricule]', '1234567X/A/M/000');
    }
    if (await win.$('[data-act="commerce"]')) { await win.click('[data-act="commerce"]'); await win.waitForSelector('[data-act="commerce"].sel'); }
    await win.click('#sf-next');
    await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));

  const creerCompte = async (nom) => {
    await win.evaluate(() => { location.hash = '#/tresorerie'; });
    await win.waitForSelector('#view h1');
    // Sans aucun compte, la page n'affiche que « + Créer mon premier compte » ; ensuite c'est
    // « + Compte » dans la barre d'actions.
    await win.click(await win.$('#first-acc') ? '#first-acc' : '#new-acc');
    await win.waitForSelector('#modal-root input[name=name]');
    await win.fill('#modal-root input[name=name]', nom);
    await win.fill('#modal-root input[name=opening]', '0');
    await win.click('#modal-root .modal-actions .btn-primary');
    await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
  };
  await creerCompte('BIAT — compte courant');
  await creerCompte('Caisse espèces');
  const comptes = lire().accounts;
  if (comptes.length !== 2) throw new Error('deux comptes attendus, ' + comptes.length + ' créés');
  j.ok(comptes.map(c => c.name).join(' · '));

  j.etape('Un client, une facture émise');
  await win.evaluate(() => { location.hash = '#/clients'; });
  await win.waitForSelector('#view .page-head');
  await win.click('#view .page-head .btn-primary');
  await win.waitForSelector('#modal-root input[name=name]');
  await win.fill('#modal-root input[name=name]', 'Société Dupont');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);

  await win.evaluate(() => { location.hash = '#/doc/new/facture'; });
  await win.waitForSelector('#lines');
  await win.click('[data-combo=clientId] .combo-btn');
  await win.waitForSelector('.combo-it');
  await win.click('.combo-it');
  await win.fill('#lines input[data-k=label]', 'Fourniture');
  await win.fill('#lines input[data-k=unitPrice]', '300');
  await win.selectOption('#lines select[data-k=vatRate]', '0');
  await win.click('#issue');
  await win.waitForSelector('#modal-root .modal-actions .btn-primary');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForTimeout(400);
  const num = (lire().documents[0] || {}).number;
  if (!num) throw new Error('la facture n\'a pas été émise');
  j.ok(num + ' émise, 300 DT');

  j.etape('Il paie en espèces — et l\'argent doit aller dans la CAISSE');
  await win.click('#pay2');
  await win.waitForSelector('#modal-root #pf2');
  // Le champ qui n'existait pas.
  if (!(await win.$('#modal-root select[name=accountId]'))) {
    throw new Error('aucun champ « Compte » dans le formulaire de paiement : l\'argent tombera sur le compte par défaut quoi qu\'on fasse');
  }
  await win.selectOption('#modal-root select[name=method]', 'especes');
  const idCaisse = comptes.find(c => /caisse/i.test(c.name)).id;
  await win.selectOption('#modal-root select[name=accountId]', idCaisse);
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);

  const pay = lire().documents[0].payments[0];
  if (pay.accountId !== idCaisse) throw new Error('le paiement a été enregistré sans son compte : ' + JSON.stringify(pay));
  j.ok('le paiement porte son compte');

  // Et les soldes, lus par la page Trésorerie elle-même.
  await win.evaluate(() => { location.hash = '#/tresorerie'; });
  await win.waitForSelector('#view h1');
  await win.waitForTimeout(250);
  const soldes = await win.evaluate(() => {
    const d = window.__data;
    const C = window.SkanCore;
    return (d.accounts || []).map(a => [a.name, C.accountBalance(d, d.company, a.id).balance]);
  });
  const caisse = soldes.find(s => /caisse/i.test(s[0]));
  const banque = soldes.find(s => /BIAT/i.test(s[0]));
  // 300 HT + le timbre fiscal de 1 DT : on lit le montant réellement encaissé plutôt que de le
  // recopier à la main — une assertion écrite de mémoire se trompe, et graverait son erreur.
  const du = Number(pay.amount);
  if (Math.abs(caisse[1] - du) > 0.001) throw new Error(`la caisse devrait porter ${du} DT, elle porte ${caisse[1]}`);
  if (Math.abs(banque[1]) > 0.001) throw new Error(`la banque ne devrait pas bouger, elle porte ${banque[1]}`);
  j.ok(`caisse ${caisse[1]} DT · banque ${banque[1]} DT`);

  j.etape('Et on peut se corriger : un paiement se modifie');
  await win.evaluate(n => { location.hash = '#/doc/' + window.__data.documents[0].id; }, 0);
  // Depuis la 10.12.0, la ligne d'un paiement porte un menu (« Modifier ce paiement »), plus un
  // pictogramme « ✎ » muet : on l'ouvre comme un humain, par son bouton.
  await win.waitForSelector('#pay-body [data-rowmenu]');
  await win.click('#pay-body [data-rowmenu]');
  await win.waitForSelector('.row-menu button');
  await win.click('.row-menu button:has-text("Modifier ce paiement")');
  await win.waitForSelector('#modal-root #pf2');
  const idBanque = comptes.find(c => /BIAT/i.test(c.name)).id;
  await win.selectOption('#modal-root select[name=accountId]', idBanque);
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root').children.length);
  const pay2 = lire().documents[0].payments[0];
  if (pay2.accountId !== idBanque) throw new Error('la modification n\'a pas pris : ' + JSON.stringify(pay2));
  if (lire().documents[0].payments.length !== 1) throw new Error('modifier un paiement ne doit pas en créer un second');
  j.ok('le paiement a changé de compte, sans doublon');

  j.etape('Le paquet du comptable ne félicite pas un mois vide');
  // Le mois d'il y a onze mois ne contient rien : l'écran écrivait pourtant en vert « Rien à
  // signaler : le dossier du mois est complet », annonçait neuf fichiers et armait l'envoi.
  await win.evaluate(() => { location.hash = '#/compta'; });
  await win.waitForSelector('#view h1');
  await win.click('#c-tabs button[data-tab="cabinet"]');
  await win.waitForSelector('#cab-build');
  const mois = await win.evaluate(() => [...document.querySelectorAll('#cab-month option')].map(o => o.value));
  await win.selectOption('#cab-month', mois[mois.length - 1]);
  await win.waitForTimeout(300);
  const etat = await win.evaluate(() => ({
    texte: document.querySelector('#c-body').textContent,
    arme: !document.querySelector('#cab-build').disabled
  }));
  if (/le dossier du mois est complet/.test(etat.texte)) throw new Error('un mois vide ne doit pas être déclaré complet');
  if (!/aucune pièce/.test(etat.texte)) throw new Error('l\'écran doit dire que le mois est vide : ' + etat.texte.slice(0, 200));
  if (etat.arme) throw new Error('le bouton « Fabriquer le paquet » ne doit pas être armé sur un mois sans pièce');
  j.ok('le mois vide est nommé, et l\'envoi refusé');

  if (bac.length) { console.error('ERREURS JS :\n' + bac.join('\n')); process.exit(1); }
  await app.close(); console.log('\n>>> OÙ TOMBE L\'ARGENT : OK'); process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
