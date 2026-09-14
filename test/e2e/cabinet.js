// SkanFact Cabinet 2.0 — l'application RÉELLE, du premier lancement à tous les écrans neufs.
// C'est le seul test qui attrape les erreurs JS du renderer : le reste du code se teste sans DOM.
//
// Ce qu'il déroule : création du cabinet (mot de passe), réglages, dossier créé à la main, exemple,
// tri, pagination, recherche, Cmd+K, fiche complète, relance enregistrée, relance groupée,
// sauvegardes, restauration, changement de mot de passe, clé de secours, bulles « i ».
const { playwright, RACINE, ELECTRON, VERSION } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const root = RACINE;
const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'cabinet');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab2-'));
const userData = path.join(dir, 'cab');
const errors = [];
let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };

(async () => {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, path.join(root, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const shot = async (nom, w = 1440, h = 900) => {
    await win.setViewportSize({ width: w, height: h });
    await win.waitForTimeout(300);
    await win.screenshot({ path: path.join(OUT, `${nom}.png`) });
  };
  const attendre = (ms = 350) => win.waitForTimeout(ms);

  // Ouvre les Réglages SUR le panneau demandé. On reconnaît l'onglet à ce qu'il CONTIENT, jamais à
  // son rang ni à son identifiant : un onglet renommé ou déplacé demain ne doit pas faire passer ce
  // parcours « à côté » sans un mot (c'est arrivé trois fois dans ce projet).
  const ouvrirReglages = async (panneau) => {
    await win.evaluate(() => { location.hash = '#/reglages'; });
    await win.waitForSelector('#set-tabs');
    await attendre(400);
    if (!panneau) return;
    const onglet = await win.evaluate(id => {
      const p = document.getElementById(id);
      const sec = p && p.closest('[data-pane]');
      return sec ? sec.dataset.pane : null;
    }, panneau);
    if (!onglet) throw new Error('panneau introuvable dans les Réglages : ' + panneau);
    await win.click(`#set-tabs button[data-tab="${onglet}"]`);
    await win.waitForSelector(`#${panneau}`, { state: 'visible', timeout: 8000 });
    await attendre(250);
  };

  // 1 — l'écran de verrouillage : étiquettes, bouton « Afficher », avertissement visible
  étape('Première ouverture');
  await win.waitForSelector('#lock-form');
  const labels = await win.evaluate(() => [...document.querySelectorAll('.lock-field')].map(l => l.textContent.trim().split('\n')[0]));
  if (!labels.length) throw new Error('les champs du verrou n\'ont toujours pas d\'étiquette');
  ok('champs étiquetés : ' + labels.join(' · '));
  if (!await win.$('#lock-eye')) throw new Error('pas de bouton « Afficher le mot de passe »');
  await win.click('#lock-eye');
  if (await win.getAttribute('#lock-pw', 'type') !== 'text') throw new Error('« Afficher » ne montre rien');
  await win.click('#lock-eye');
  ok('le mot de passe se relit');
  const warn = await win.evaluate(() => !!document.querySelector('.lock-warn'));
  if (!warn) throw new Error('l\'avertissement « aucun moyen de le récupérer » n\'est pas mis en avant');
  ok('avertissement mis en avant');
  await shot('01-verrou');

  // un mot de passe trop court est refusé
  await win.fill('#lock-pw', 'court');
  await win.fill('#lock-pw2', 'court');
  await win.click('#lock-go');
  await attendre();
  if (await win.isHidden('#lock-err')) throw new Error('un mot de passe de 5 caractères a été accepté');
  ok('mot de passe trop court refusé : ' + (await win.textContent('#lock-err')).slice(0, 60));

  await win.fill('#lock-pw', 'mot-de-passe-cabinet');
  await win.fill('#lock-pw2', 'mot-de-passe-cabinet');
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  ok('cabinet créé');

  // 2 — l'assistant de première utilisation
  étape('Assistant de première utilisation');
  await win.waitForSelector('#setup', { timeout: 10000 });
  ok('l\'assistant s\'ouvre au lieu d\'un formulaire de réglages');
  await shot('02a-assistant-1');
  await win.click('#w-next');                                  // 1. bienvenue
  await win.waitForSelector('#w-name');
  await win.fill('#w-name', 'Cabinet Elyes Gharbi');
  await win.fill('#w-email', 'contact@cabinet-gharbi.tn');
  await win.fill('#w-phone', '+216 71 000 000');
  await win.fill('#w-day', '12');
  await shot('02b-assistant-cabinet');
  await win.click('#w-next');                                  // 2. le cabinet
  await win.waitForSelector('#w-clients');
  await win.fill('#w-clients', [
    'Nom ; Matricule ; Email ; Téléphone',
    'Boulangerie Hamdi ; 7654321Z/A/M/000 ; hamdi@example.tn ; +216 98 111 222',
    'Garage Zouari',
    'Clinique Ennour ; 8899001W/A/M/000 ; ; +216 71 555 666'
  ].join('\n'));
  await shot('02c-assistant-clients');
  await win.click('#w-next');                                  // 3. les clients
  await attendre(1200);
  await win.waitForSelector('#w-rec');
  ok('étape « ne rien perdre » proposée avant toute autre chose');
  await shot('02d-assistant-filets');
  await win.click('#w-skip');                                  // 4. filets (on les testera après)
  await win.waitForSelector('#w-pair');
  await shot('02e-assistant-appairage');
  await win.click('#w-next');                                  // 5. appairage → fin
  await win.waitForSelector('#app:not([hidden])');
  await attendre(600);
  if (await win.$('#setup')) throw new Error('l\'assistant ne se ferme pas');
  const apresSetup = await win.textContent('#view');
  if (!/Boulangerie Hamdi/.test(apresSetup)) throw new Error('les clients collés dans l\'assistant ne sont pas arrivés');
  if (!/Garage Zouari/.test(apresSetup) || !/Clinique Ennour/.test(apresSetup)) throw new Error('l\'import en masse a perdu des lignes');
  ok('3 clients collés d\'un coup, tous arrivés');
  await shot('02f-apres-assistant');

  // les réglages ont bien été enregistrés par l'assistant
  étape('Réglages du cabinet');
  await ouvrirReglages('pan-cabinet');
  await win.waitForSelector('#c-name');
  if (await win.inputValue('#c-name') !== 'Cabinet Elyes Gharbi') throw new Error('l\'assistant n\'a pas enregistré le cabinet');
  if (await win.inputValue('#c-day') !== '12') throw new Error('le jour de relance de l\'assistant est perdu');
  ok('cabinet et jour de relance enregistrés par l\'assistant');
  await win.click('#c-save');
  await attendre(500);
  if (await win.isHidden('#c-saved')) throw new Error('« ✓ enregistré » ne s\'affiche pas à côté du bouton');
  ok('enregistré, sans message passager par-dessus le bouton');
  await shot('02-reglages');

  // les panneaux de filets sont là (onglet « Données et sécurité »)
  await ouvrirReglages('pan-secu');
  for (const sel of ['#pan-backup', '#pan-secu']) {
    if (!await win.$(sel)) throw new Error('panneau manquant : ' + sel);
  }
  const secu = await win.textContent('#pan-secu');
  if (!/clé de secours/i.test(secu)) throw new Error('la clé de secours n\'est pas proposée');
  if (!/jamais enregistré de clé de secours/i.test(secu)) throw new Error('l\'absence de clé de secours n\'est pas signalée');
  ok('absence de clé de secours signalée en rouge');
  const sauv = await win.textContent('#pan-backup');
  if (!/Aucune copie hors de cet ordinateur/i.test(sauv)) throw new Error('l\'absence de copie externe n\'est pas signalée');
  ok('absence de copie externe signalée');
  await shot('03-filets');

  // 3 — un dossier créé à la main
  étape('Dossier client créé à la main');
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await attendre(400);
  await win.click('#new-d');
  await win.waitForSelector('#f-name');
  await win.fill('#f-name', 'Imprimerie Ksar Hellal');
  await win.fill('#f-mat', '5544332K/A/M/000');
  await win.fill('#f-phone', '+216 98 777 888');
  await win.fill('#f-contact', 'M. Ksar');
  await win.selectOption('#f-regime', 'reel');
  await win.selectOption('#f-tva', 'trimestrielle');
  await win.fill('#f-fees', '220');
  await shot('04-nouveau-dossier');
  await win.click('#modal-root .modal-bg:last-child .modal-actions .btn-primary');
  await win.waitForTimeout(700);
  if (!/dossier\//.test(await win.evaluate(() => location.hash))) throw new Error('la création n\'ouvre pas la fiche');
  const fiche = await win.textContent('#view');
  if (!/pas encore sur SkanFact/.test(fiche)) throw new Error('un client hors SkanFact n\'est pas signalé comme tel');
  if (!/\+216 98 777 888/.test(fiche)) throw new Error('le téléphone n\'apparaît pas sur la fiche');
  ok('fiche complète, client marqué hors SkanFact');
  await shot('05-fiche-hors-skanfact');

  // 3bis — corriger le matricule d'un dossier sans paquet change son identifiant
  étape('Corriger un matricule avant le premier paquet');
  const idAvant = decodeURIComponent((await win.evaluate(() => location.hash)).split('/')[2] || '');
  await win.click('#edit');
  await win.waitForSelector('#f-mat');
  await win.fill('#f-mat', '6677889P/A/M/000');
  await win.click('#modal-root .modal-bg:last-child .modal-actions .btn-primary');
  await attendre(900);
  const idApres = decodeURIComponent((await win.evaluate(() => location.hash)).split('/')[2] || '');
  if (idApres === idAvant) throw new Error('le matricule a changé mais pas l\'identifiant : le premier paquet créerait un doublon');
  if (!/6677889P/.test(idApres)) throw new Error('identifiant inattendu : ' + idApres);
  const encoreLa = await win.textContent('#view');
  if (/n'existe plus/.test(encoreLa)) throw new Error('la fiche a disparu après le changement d\'identifiant');
  ok(`identifiant suivi : ${idAvant} → ${idApres}`);

  // 4 — l'exemple, puis les listes
  étape('Jeu d\'exemple, tri, pagination, recherche');
  await ouvrirReglages('pan-exemple');
  await win.click('#r-demo-on');
  await win.waitForTimeout(900);
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await attendre(500);
  const stats = await win.$$('.stat');
  if (stats.length < 4) throw new Error('le tableau de bord du portefeuille manque');
  ok('portefeuille : ' + (await win.textContent('.stats')).replace(/\s+/g, ' ').slice(0, 110));
  await shot('06-dossiers');

  const noms = async () => win.evaluate(() => [...document.querySelectorAll('tr[data-id] td:first-child')].map(t => t.textContent.trim()));
  const avant = await noms();
  await win.click('th[data-sort="nom"]');
  await attendre(400);
  const triés = await noms();
  if (JSON.stringify(avant) === JSON.stringify(triés)) throw new Error('le tri par nom ne change rien');
  if (triés.length !== avant.length) throw new Error('le tri perd des lignes');
  ok('tri par nom : ' + triés.slice(0, 3).join(' · '));
  await win.click('th[data-sort="nom"]');
  await attendre(400);
  const inverse = await noms();
  if (inverse[0] !== triés[triés.length - 1]) throw new Error('le second clic n\'inverse pas le tri');
  ok('second clic : tri inversé');

  await win.fill('#q', '98 777');
  await attendre(450);
  const cherche = await noms();
  if (cherche.length !== 1 || !/Ksar/.test(cherche[0])) throw new Error('la recherche par téléphone ne marche pas : ' + JSON.stringify(cherche));
  ok('recherche par téléphone');
  await win.fill('#q', '');
  await attendre(400);

  // 5 — Cmd+K
  étape('Recherche rapide (Cmd+K)');
  await win.keyboard.press('Control+k');
  await win.waitForSelector('#palette-root', { timeout: 4000 });
  await win.fill('#pal-q', 'Ksar');
  await attendre(350);
  const res = await win.evaluate(() => [...document.querySelectorAll('#pal-res .res .main')].map(e => e.textContent));
  if (!res.some(r => /Ksar/.test(r))) throw new Error('la palette ne trouve pas le client : ' + JSON.stringify(res));
  ok('palette : ' + res.slice(0, 3).join(' · '));
  await shot('07-palette');
  await win.keyboard.press('Escape');
  await attendre(350);
  if (await win.$('#palette-root')) throw new Error('Échap ne ferme pas la palette');

  // 6 — la fiche d'un vrai dossier, avec ses paquets
  étape('Fiche d\'un dossier qui a envoyé des paquets');
  await win.evaluate(() => {
    const tr = [...document.querySelectorAll('tr[data-id]')].find(t => /Trabelsi|Pharmacie|Studio|Transports|Jasmins/.test(t.textContent));
    location.hash = '#/dossier/' + encodeURIComponent(tr.dataset.id);
  });
  await attendre(600);
  const f2 = await win.textContent('#view');
  if (!/Paquets reçus/.test(f2)) throw new Error('le tableau des paquets manque');
  if (!/Relances/.test(f2)) throw new Error('le panneau des relances manque');
  const annees = await win.$$('.year-row');
  if (!annees.length) throw new Error('les mois ne sont pas groupés par année');
  ok('mois groupés par année, paquets et relances présents');
  const barres = await win.$$('.ca-col');
  if (barres.length !== 12) throw new Error('la courbe doit dessiner les douze mois, pas seulement ceux reçus (' + barres.length + ')');
  const off = await win.evaluate(() => document.querySelectorAll('.ca-col.off').length);
  if (!off) throw new Error('les mois non reçus ne sont pas estompés');
  ok(`chiffre d'affaires : 12 mois dessinés, ${off} non reçus estompés`);
  if (!await win.$('#print')) throw new Error('pas de bouton Imprimer sur la fiche');
  await shot('08-fiche-complete');

  // une bulle « i » s'ouvre vraiment
  const bulle = await win.$('button.i[data-info]');
  if (!bulle) throw new Error('aucune bulle « i » sur la fiche');
  await bulle.click();
  await attendre(350);
  if (!await win.$('#info-pop')) throw new Error('la bulle ne s\'ouvre pas');
  ok('bulle « i » : ' + (await win.textContent('#info-pop .ip-head')).slice(0, 40));
  await shot('09-bulle');
  await win.keyboard.press('Escape');
  await win.evaluate(() => { const p = document.querySelector('#info-pop'); if (p) p.remove(); });

  // 7 — noter une relance, et la voir dans l'historique
  étape('Relance enregistrée');
  await win.click('#note-rel');
  await win.waitForSelector('#n-via');
  await win.selectOption('#n-via', 'tel');
  await win.fill('#n-note', 'promet d\'envoyer vendredi');
  await win.click('#modal-root .modal-bg:last-child .modal-actions .btn-primary');
  await attendre(800);
  const apres = await win.textContent('#view');
  if (!/promet d'envoyer vendredi/.test(apres)) throw new Error('la relance n\'apparaît pas dans l\'historique');
  if (!/Téléphone/.test(apres)) throw new Error('le moyen de relance n\'est pas affiché');
  ok('relance enregistrée et visible dans la fiche');
  await shot('10-relance-historique');

  // 8 — la page Relances et la cohérence de la pastille
  étape('Page Relances et pastille');
  await win.evaluate(() => { location.hash = '#/relances'; });
  await attendre(600);
  const lignes = await win.evaluate(() => document.querySelectorAll('#view tbody tr').length);
  const pastille = await win.evaluate(() => {
    const p = document.querySelector('#nav-relances');
    return p && !p.hidden ? Number(p.textContent) : 0;
  });
  if (lignes !== pastille) throw new Error(`la pastille (${pastille}) et la page (${lignes}) ne comptent pas la même chose`);
  ok(`pastille et page d'accord : ${lignes}`);
  const relTxt = await win.textContent('#view');
  if (!/Dernière relance/.test(relTxt)) throw new Error('la colonne « dernière relance » manque');
  ok('colonne « dernière relance » présente');
  await shot('11-relances');

  // 9 — sauvegardes : en prendre une, la lire, restaurer
  étape('Sauvegardes et restauration');
  await ouvrirReglages('pan-backup');
  await win.click('#b-now');
  await attendre(1200);
  const nbSauv = await win.evaluate(() => document.querySelectorAll('[data-restore]').length);
  if (!nbSauv) throw new Error('aucune sauvegarde listée après « Sauvegarder maintenant »');
  ok(nbSauv + ' sauvegarde(s) listée(s), restaurables');
  await shot('12-sauvegardes');

  // Le scénario qui compte vraiment : on supprime un dossier par erreur, et on le récupère.
  const compte = () => win.evaluate(() => document.querySelectorAll('tr[data-id]').length);
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await attendre(500);
  const avantSuppr = await compte();
  const victime = await win.evaluate(() => {
    const tr = [...document.querySelectorAll('tr[data-id]')].find(t => /Garage Zouari/.test(t.textContent));
    if (tr) tr.click();
    return tr ? tr.dataset.id : '';
  });
  if (!victime) throw new Error('client de test introuvable');
  await attendre(600);
  await win.click('#edit');
  await win.waitForSelector('#modal-root .btn-danger');
  await win.click('#modal-root .btn-danger');
  await win.waitForSelector('#modal-root .modal-bg:last-child #w');
  // La suppression exige de recopier le mot : un dossier supprimé emporte les pièces d'un client.
  const okDesactive = await win.evaluate(() => document.querySelector('#modal-root .modal-bg:last-child #ok').disabled);
  if (!okDesactive) throw new Error('la suppression d\'un dossier ne demande aucune confirmation écrite');
  await win.fill('#modal-root .modal-bg:last-child #w', 'SUPPRIMER');
  await win.click('#modal-root .modal-bg:last-child #ok');
  await attendre(1500);
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await attendre(600);
  const apresSuppr = await compte();
  if (apresSuppr !== avantSuppr - 1) throw new Error(`la suppression n'a pas eu lieu (${avantSuppr} → ${apresSuppr})`);
  ok(`dossier supprimé après confirmation écrite (${avantSuppr} → ${apresSuppr})`);

  await ouvrirReglages('pan-backup');
  await attendre(400);
  const nomSauv = await win.evaluate(() => {
    const lignes = [...document.querySelectorAll('[data-restore]')];
    const i = lignes.findIndex(b => /avant-suppression/i.test(b.closest('tr').textContent));
    return i >= 0 ? String(i) : '';
  });
  if (!nomSauv) throw new Error('aucune sauvegarde « avant suppression » n\'a été prise');
  await win.click(`[data-restore="${nomSauv}"]`);
  await win.waitForSelector('#modal-root .modal', { timeout: 5000 });
  const dlg = await win.textContent('#modal-root .modal');
  if (!/La sauvegarde/.test(dlg) || !/Maintenant/.test(dlg)) throw new Error('la restauration ne montre pas ce qu\'on perdrait');
  ok('la restauration annonce ce qu\'elle contient et ce qu\'on a maintenant');
  await shot('13-restauration');
  await win.click('#modal-root .modal-bg:last-child .btn-primary');
  await attendre(2500);
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await attendre(700);
  const apresRestau = await compte();
  if (apresRestau !== avantSuppr) throw new Error(`la restauration n'a pas rendu le dossier (${apresSuppr} → ${apresRestau}, attendu ${avantSuppr})`);
  const revenu = await win.textContent('#view');
  if (!/Garage Zouari/.test(revenu)) throw new Error('le dossier restauré n\'est pas le bon');
  ok(`dossier récupéré par la sauvegarde (${apresSuppr} → ${apresRestau})`);
  await shot('13b-restaure');

  // 10 — changement de mot de passe (refus si l'ancien est faux, puis succès)
  étape('Changement de mot de passe');
  await ouvrirReglages('pan-secu');
  await win.waitForSelector('#s-pw', { timeout: 8000 });
  await win.click('#s-pw');
  await win.waitForSelector('#p0');
  await win.fill('#p0', 'mauvais-mot-de-passe');
  await win.fill('#p1', 'nouveau-mot-de-passe');
  await win.fill('#p2', 'nouveau-mot-de-passe');
  await win.click('#modal-root .modal-bg:last-child .modal-actions .btn-primary');
  await attendre(2500);
  const t1 = await win.textContent('#toast');
  if (!/incorrect/i.test(t1)) throw new Error('un mauvais mot de passe actuel a été accepté : ' + t1);
  ok('mauvais mot de passe actuel refusé');
  await win.fill('#p0', 'mot-de-passe-cabinet');
  await win.click('#modal-root .modal-bg:last-child .modal-actions .btn-primary');
  await attendre(3000);
  const t2 = await win.textContent('#toast');
  if (!/changé/i.test(t2)) throw new Error('le changement de mot de passe a échoué : ' + t2);
  ok('mot de passe changé, sauvegardes rechiffrées');

  // 10bis — les deux nouvelles pages
  étape('Échéances et Écritures');
  await win.evaluate(() => { location.hash = '#/echeances'; });
  await attendre(700);
  const ech = await win.textContent('#view');
  if (!/À VÉRIFIER/.test(ech)) throw new Error('les dates fiscales ne portent pas « À VÉRIFIER »');
  const cartes = await win.$$('.ech');
  if (!cartes.length) throw new Error('aucune échéance affichée alors qu\'il y a des clients');
  const bar = await win.textContent('.ech-bar');
  if (!/prêt|sans le mois|provisoire/.test(bar)) throw new Error('une échéance ne dit pas qui a envoyé et qui non : ' + bar);
  ok(`${cartes.length} échéances, rattachées aux paquets manquants`);
  await shot('16-echeances');

  await win.evaluate(() => { location.hash = '#/ecritures'; });
  await attendre(700);
  const ecr = await win.textContent('#view');
  // Le jeu d'exemple n'a pas de fichier de paquet : la page doit le dire proprement, pas planter.
  if (!/Rien à regrouper|La période/.test(ecr)) throw new Error('la page Écritures n\'affiche rien de compréhensible');
  ok('page Écritures : ' + ecr.replace(/\s+/g, ' ').slice(0, 70));
  await shot('17-ecritures');

  // 10ter — la boîte de réception
  étape('Boîte de réception surveillée');
  const boite = path.join(dir, 'boite');
  fs.mkdirSync(boite, { recursive: true });
  fs.writeFileSync(path.join(boite, 'trabelsi-2026-08.skanpack'), 'pas un vrai paquet');
  fs.writeFileSync(path.join(boite, 'menzah-2026-08.skanpack'), 'pas un vrai paquet non plus');
  fs.writeFileSync(path.join(boite, 'notes.txt'), 'un fichier qui ne nous regarde pas');
  await app.evaluate(({ dialog }, d) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] }); }, boite);
  await ouvrirReglages('pan-inbox');
  await win.waitForSelector('#i-pick', { timeout: 8000 });
  await win.click('#i-pick');
  await attendre(1200);
  // La boîte de réception a son PROPRE panneau depuis la 7.30.0 : ce n'est pas un filet, c'est la
  // porte par laquelle les paquets arrivent.
  const reglagesBoite = await win.textContent('#pan-inbox');
  if (!/2 paquets en attente/.test(reglagesBoite)) throw new Error('la boîte ne compte pas les paquets : ' + reglagesBoite.slice(0, 200));
  ok('dossier surveillé, 2 paquets vus (le .txt est ignoré)');

  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await attendre(800);
  if (!await win.$('#inbox-go')) throw new Error('aucun bandeau sur la page Dossiers');
  const bandeau = await win.textContent('.banner');
  if (!/2 nouveaux paquets/.test(bandeau)) throw new Error('bandeau inattendu : ' + bandeau);
  ok('bandeau : ' + bandeau.replace(/\s+/g, ' ').trim().slice(0, 80));
  await shot('16-boite');

  // « Ignorer » ne doit rien effacer : ce sont les pièces d'un client.
  await win.click('#inbox-skip');
  await win.waitForSelector('#modal-root .modal');
  await win.click('#modal-root .modal-bg:last-child .btn-primary');
  await attendre(1200);
  if (await win.$('#inbox-go')) throw new Error('« Ignorer » ne fait pas disparaître le bandeau');
  if (!fs.existsSync(path.join(boite, 'trabelsi-2026-08.skanpack'))) throw new Error('« Ignorer » a EFFACÉ un fichier du client');
  ok('« Ignorer » cesse de proposer, sans rien effacer');

  // 11 — l'aide ne parle plus du jeton
  étape('Aide');
  await win.evaluate(() => { location.hash = '#/aide'; });
  await attendre(600);
  // Depuis la 7.28.0 l'aide du cabinet est un PLAN : huit cartes colorées, une recherche, et un
  // article qui s'ouvre avec son fil d'Ariane et son geste. Avant, c'était les huit articles
  // dépliés à la suite sur cinq écrans de prose grise.
  await win.waitForSelector('.help-art');
  const G = require(path.join(root, 'src', 'cabinet', 'renderer', 'cabguide.js'));
  const fiches = await win.evaluate(() => [...document.querySelectorAll('.help-art')].map(b => ({
    id: b.dataset.art, titre: (b.querySelector('.ht') || {}).textContent.trim(),
    sous: (b.querySelector('.hs') || {}).textContent.trim(),
    couleur: getComputedStyle(b).getPropertyValue('--th').trim()
  })));
  if (fiches.length !== G.ARTICLES.length) throw new Error(`${fiches.length} fiches pour ${G.ARTICLES.length} articles`);
  fiches.forEach(c => {
    if (!c.sous) throw new Error(`l'article « ${c.titre} » n'annonce pas ce qu'il contient`);
    if (!c.couleur) throw new Error(`l'article « ${c.titre} » n'a pas de couleur`);
  });
  // La recherche traverse le CORPS des articles : « empreinte » n'est dans aucun titre.
  await win.fill('#aide-q', 'empreinte');
  await attendre(350);
  const trouves = await win.evaluate(() => [...document.querySelectorAll('#aide-res .help-art')].map(b => b.dataset.art));
  if (!trouves.length) throw new Error('la recherche de l\'aide ne trouve rien');
  await win.fill('#aide-q', '');
  await attendre(300);
  // Un article s'ouvre, dit d'où il vient, et mène quelque part.
  await win.click('.help-art[data-art="filets"]');
  await win.waitForSelector('.help-body');
  const corps = await win.textContent('.help-body');
  if (!/clé de secours/i.test(corps)) throw new Error('l\'article sur les filets manque');
  const fil = await win.evaluate(() => {
    const f = document.querySelector('.help-fil');
    return { lignes: new Set([...f.children].map(x => Math.round(x.getBoundingClientRect().top))).size, h: Math.round(f.getBoundingClientRect().height) };
  });
  if (fil.lignes !== 1 || fil.h > 40) throw new Error(`le fil d'Ariane s'étale sur ${fil.lignes} ligne(s), ${fil.h}px`);
  const geste = await win.$('.help-geste [data-geste]');
  if (!geste) throw new Error('l\'article ne mène nulle part');
  await geste.click();
  await win.waitForFunction(() => location.hash === '#/reglages', null, { timeout: 4000 });
  ok(`plan de ${fiches.length} cartes colorées, recherche (${trouves.length} sur « empreinte »), fil sur une ligne, geste qui mène aux Réglages`);
  await win.evaluate(() => { location.hash = '#/aide'; });
  await attendre(400);
  await shot('14-aide');

  // 12 — la fenêtre étroite ne déborde pas
  étape('Fenêtre étroite (960 px, le minimum)');
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.setViewportSize({ width: 960, height: 620 });
  await attendre(600);
  const debord = await win.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (debord > 2) throw new Error('la page déborde de ' + debord + ' px à 960 de large');
  ok('aucun débordement horizontal');
  await shot('15-etroit', 960, 620);

  console.log('\n' + '─'.repeat(60));
  console.log('erreurs JS : ' + errors.length);
  errors.slice(0, 10).forEach(e => console.log('  ✕ ' + e));
  await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]);
  console.log('captures : ' + OUT);
  process.exit(errors.length ? 3 : 0);
})().catch(e => { console.error('\n✕ ÉCHEC : ' + (e.stack || e.message)); console.error('erreurs JS : ' + errors.length); errors.slice(0, 6).forEach(x => console.error('  ' + x)); process.exit(2); });
