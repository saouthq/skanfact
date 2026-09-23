// Le menu d'actions d'une ligne, et la confirmation qui manquait (7.28.0).
//
// Skander : « dans les listes je n'aime pas les boutons en fin de ligne, faut faire une liste où on
// choisit dedans, un truc plus pro. Et il manque la confirmation : quand j'appuie sur un devis
// accepté ou refusé, ça ne me demande pas de confirmer, ça ne me redirige pas si j'accepte, et ça
// ne m'indique pas. »
//
// Ce parcours mesure les deux :
//
//   1. Chaque liste finit par UN bouton, et il ouvre un menu d'actions écrites en toutes lettres.
//   2. Le menu ne vole pas le clic de la ligne, se ferme avec Échap, et tient dans l'écran.
//   3. Refuser un devis pose une question — et répondre « Annuler » ne change vraiment rien.
//   4. Accepter un devis pose la question ET propose la suite ; « Accepter et facturer » ouvre le
//      brouillon de facture. C'est la redirection qui manquait.
//   5. Une fois accepté, le menu de la ligne propose « Facturer ce devis ».
//
//   xvfb-run -a node test/e2e/actions.js
const { fermer, playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-actions-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${ud}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(500); };
  const menuDe = async selecteurLigne => {
    await win.click(`${selecteurLigne} [data-rowmenu]`);
    await win.waitForSelector('.row-menu');
    return win.evaluate(() => [...document.querySelectorAll('.row-menu .rm-l')].map(x => x.textContent.trim()));
  };
  // On clique le VRAI bouton du menu, repéré par son rang : les sélecteurs à pseudo-classes
  // imbriquées ne passent pas partout, et un e2e qui rejoue le code qu'il teste ne prouve rien.
  const cliquerAction = async label => {
    const i = await win.evaluate(l => [...document.querySelectorAll('.row-menu .rm-l')]
      .findIndex(x => x.textContent.trim() === l), label);
    if (i < 0) throw new Error(`le menu ne propose pas « ${label} »`);
    await win.click(`.row-menu button >> nth=${i}`);
    await win.waitForTimeout(800);
    if (process.env.DBG) console.log('    [dbg] après clic, modales =', await win.evaluate(() => document.querySelectorAll('#modal-root > *').length));
  };

  j.etape('Une entreprise et le jeu d\'exemple');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Actions SUARL');
      await win.fill('#sf-form input[name=matricule]', '5555555A/A/M/000');
    }
    if (await win.$('[data-act="conseil"]')) { await win.click('[data-act="conseil"]'); await win.waitForSelector('[data-act="conseil"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  await aller('#/parametres');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForSelector('#load-demo');
  await win.click('#load-demo');
  await win.waitForSelector('.modal #ok');
  await win.click('.modal #ok');
  await win.waitForTimeout(1800);
  j.ok('prêt');

  // -------------------------------------------------- 1. un seul bouton par ligne, partout
  j.etape('Chaque liste finit par UN bouton, qui ouvre des actions écrites en toutes lettres');
  const pages = [['#/devis', 'Devis'], ['#/factures', 'Factures'], ['#/clients', 'Clients'],
                 ['#/fournisseurs', 'Fournisseurs'], ['#/achats', 'Achats'], ['#/relances', 'Relances'],
                 ['#/catalogue', 'Catalogue'], ['#/contrats', 'Contrats']];
  const resume = [];
  for (const [hash, nom] of pages) {
    await aller(hash);
    const n = await win.evaluate(() => document.querySelectorAll('tbody [data-rowmenu]').length);
    if (!n) throw new Error(`${nom} : aucune ligne ne porte de menu d'actions`);
    // Plus aucune rangée de boutons en fin de ligne : c'est précisément ce qu'on remplace.
    const restes = await win.evaluate(() => document.querySelectorAll('td.row-actions > span .btn').length);
    if (restes) throw new Error(`${nom} : ${restes} bouton(s) sont restés en fin de ligne`);
    const actions = await menuDe('tbody tr:first-child');
    if (actions.length < 2) throw new Error(`${nom} : le menu n'offre que ${actions.length} action(s)`);
    // Une action porte une phrase, pas un pictogramme ni une abréviation.
    const muettes = actions.filter(a => a.length < 6);
    if (muettes.length) throw new Error(`${nom} : action(s) trop courte(s) pour être comprises : ${muettes.join(', ')}`);
    // Et le menu tient dans la fenêtre, où que soit la ligne.
    const hors = await win.evaluate(() => {
      const r = document.querySelector('.row-menu').getBoundingClientRect();
      return Math.round(Math.max(0, r.right - document.documentElement.clientWidth, 8 - r.left, r.bottom - window.innerHeight));
    });
    if (hors > 0) throw new Error(`${nom} : le menu dépasse de ${hors}px`);
    // Chaque entrée porte son dessin : sans lui, le menu est un mur de phrases qu'on lit au lieu
    // de le parcourir du regard.
    const sansIcone = await win.evaluate(() => [...document.querySelectorAll('.row-menu button[data-i]')]
      .filter(b => !b.querySelector('svg.rm-i')).map(b => b.querySelector('.rm-l').textContent.trim()));
    if (sansIcone.length) throw new Error(`${nom} : action(s) sans icône : ${sansIcone.join(', ')}`);
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => !document.querySelector('.row-menu'), null, { timeout: 3000 });
    resume.push(`${nom} ${actions.length}`);
  }
  j.ok(resume.join(' · ') + ' — Échap referme partout, chaque action a son icône');

  // -------------------------------------------------- 1 bis. le bouton est un INTERRUPTEUR
  // Il fermait puis rouvrait : le `mousedown` global refermait le menu et le `click` le rouvrait
  // dans la foulée. On appuyait pour fermer, ça clignotait, et le menu restait ouvert.
  j.etape('Rappuyer sur le bouton referme le menu, au lieu de le rouvrir');
  await aller('#/devis');
  const btn = 'tbody tr:first-child [data-rowmenu]';
  await win.click(btn); await win.waitForSelector('.row-menu');
  await win.click(btn); await win.waitForTimeout(350);
  if (await win.$('.row-menu')) throw new Error('le menu est toujours ouvert après un second clic sur son bouton');
  // Et il se rouvre bien au troisième : fermer ne doit pas condamner le bouton.
  await win.click(btn); await win.waitForSelector('.row-menu', { timeout: 3000 });
  // Le libellé du bouton se lit, au lieu de trois points qu'il faut déjà connaître.
  const mot = await win.evaluate(s => document.querySelector(s).textContent.trim(), btn);
  if (!/actions/i.test(mot)) throw new Error(`le bouton de ligne ne se nomme pas : « ${mot} »`);
  await win.keyboard.press('Escape');
  await win.waitForFunction(() => !document.querySelector('.row-menu'));
  j.ok(`« ${mot} » ouvre, referme, et rouvre`);

  // -------------------------------------------------- 2. le menu ne vole pas le clic de la ligne
  j.etape('Le bouton du menu ne déclenche pas l\'ouverture de la ligne');
  await aller('#/factures');
  await win.click('tbody tr:first-child [data-rowmenu]');
  await win.waitForSelector('.row-menu');
  const hash = await win.evaluate(() => location.hash);
  if (hash !== '#/factures') throw new Error(`ouvrir le menu a navigué vers ${hash}`);
  await win.keyboard.press('Escape');
  await win.waitForFunction(() => !document.querySelector('.row-menu'));
  // Et la ligne elle-même s'ouvre toujours.
  await win.click('tbody tr:first-child td:first-child');
  await win.waitForTimeout(500);
  if (!/^#\/doc\//.test(await win.evaluate(() => location.hash))) throw new Error('la ligne ne s\'ouvre plus au clic');
  j.ok('le menu et la ligne ne se marchent pas dessus');

  // -------------------------------------------------- 3. refuser demande, et « Annuler » n'agit pas
  j.etape('Refuser un devis pose une question — et « Annuler » ne change rien');
  await aller('#/devis');
  // On cherche une ligne qui propose les réponses : seuls les devis envoyés ou expirés en ont.
  // On lit le badge de statut plutôt que d'ouvrir les menus un par un — un menu s'ancre sur SA
  // ligne, et ouvrir celui d'une ligne hors écran puis demander à Playwright d'y cliquer ferait
  // défiler la page… ce qui referme le menu, comme chez un vrai utilisateur.
  const cible = await win.evaluate(() => {
    const tr = [...document.querySelectorAll('tbody tr[data-id]')]
      .find(t => [...t.querySelectorAll('.badge')].some(b => /^(envoyé|expiré)$/.test(b.textContent.trim())));
    return tr ? tr.dataset.id : '';
  });
  if (!cible) throw new Error('aucun devis en attente dans le jeu d\'exemple : rien à répondre');
  const actionsDevis = await menuDe(`tbody tr[data-id="${cible}"]`);
  if (!actionsDevis.includes('Le client a refusé')) throw new Error(`le menu du devis en attente ne propose pas de répondre : ${actionsDevis.join(', ')}`);
  await win.waitForSelector('.row-menu');
  const avant = await win.evaluate(id => {
    const tr = document.querySelector(`tbody tr[data-id="${id}"]`);
    return tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 120);
  }, cible);
  await cliquerAction('Le client a refusé');
  // La question doit être posée AVANT que quoi que ce soit ne change.
  const q = await win.$('.modal');
  if (!q) throw new Error('refuser un devis ne pose aucune question : la ligne change sans qu\'on l\'ait dit');
  const texte = await win.$eval('.modal', e => e.textContent);
  if (!/refusé/i.test(texte)) throw new Error('la question ne dit pas ce qu\'elle va faire : ' + texte.slice(0, 80));
  await win.click('.modal [data-close]');                 // « Annuler »
  await win.waitForTimeout(500);
  const apres = await win.evaluate(id => {
    const tr = document.querySelector(`tbody tr[data-id="${id}"]`);
    return tr ? tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : 'DISPARUE';
  }, cible);
  if (apres !== avant) throw new Error(`« Annuler » a quand même changé la ligne :\n  avant ${avant}\n  après ${apres}`);
  j.ok('la question est posée, et refuser la question ne change rien');

  // -------------------------------------------------- 4. accepter propose la suite
  j.etape('Accepter propose la suite — et « Accepter et facturer » ouvre le brouillon');
  await menuDe(`tbody tr[data-id="${cible}"]`);
  await cliquerAction('Le client a accepté');
  await win.waitForSelector('.modal');
  const choix = await win.evaluate(() => [...document.querySelectorAll('.modal .modal-actions button')].map(b => b.textContent.trim()));
  if (!choix.some(x => /facturer/i.test(x))) throw new Error(`la fenêtre ne propose pas de facturer : ${choix.join(' / ')}`);
  const detail = await win.$eval('.modal', e => e.textContent);
  if (!/accepté/i.test(detail)) throw new Error('la fenêtre ne dit pas ce qui va se passer');
  await win.click('.modal .modal-actions button:has-text("Accepter et facturer")');
  await win.waitForTimeout(1200);
  const arrivee = await win.evaluate(() => location.hash);
  if (!/^#\/doc\//.test(arrivee)) throw new Error(`accepter et facturer n'ouvre rien : on reste sur ${arrivee}`);
  const type = await win.evaluate(() => {
    const t = document.querySelector('.page-head h1');
    return t ? t.textContent.trim() : '';
  });
  if (!/facture/i.test(type)) throw new Error(`on arrive sur « ${type} » au lieu d'une facture`);
  j.ok(`« Accepter et facturer » ouvre ${arrivee} — ${type}`);

  // -------------------------------------------------- 5. et le devis accepté propose Facturer
  // On vient de le facturer : le geste SUIVANT est de voir la facture, pas d'en refaire une. Le
  // menu proposait « Facturer ce devis » à l'identique — et un second clic fabriquait une facture
  // entière de plus, sans un mot. Refacturer reste possible, en rouge et derrière une question.
  j.etape('Un devis déjà facturé mène à SA facture, et ne la refait pas en silence');
  await aller('#/devis');
  const actionsAccepte = await menuDe(`tbody tr[data-id="${cible}"]`);
  if (actionsAccepte.includes('Facturer ce devis'))
    throw new Error(`le menu propose encore de facturer un devis déjà facturé : ${actionsAccepte.join(', ')}`);
  if (!actionsAccepte.some(a => /^Voir /.test(a)))
    throw new Error(`rien ne mène à la facture déjà établie : ${actionsAccepte.join(', ')}`);
  // Et si on insiste, on est prévenu.
  await cliquerAction('Refacturer la totalité…');
  const prevenu = await win.$('.modal');
  if (!prevenu) throw new Error('refacturer la totalité ne demande rien');
  const texteRefac = await win.$eval('.modal', e => e.textContent);
  if (!/déjà donné/.test(texteRefac)) throw new Error('la question ne nomme pas la facture qui existe déjà : ' + texteRefac.slice(0, 90));
  await win.click('.modal [data-close]');
  await win.waitForTimeout(400);
  j.ok(actionsAccepte.join(', '));

  await fermer(app);
  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  console.log(`\n${j.total()} étapes — une seule porte par ligne, et rien ne change sans qu'on l'ait dit.`);
})().catch(e => { console.error(e); process.exit(1); });
