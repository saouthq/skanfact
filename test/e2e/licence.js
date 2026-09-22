// L'éditeur de SkanFact, et les offres de licence (7.33.0), dans l'application réelle.
//
// Ce que ce parcours prouve, dans l'ordre :
//   1. sans clé de signature, il n'y a ni page Licences, ni panneau Éditeur — un client ne voit rien ;
//   2. « Créer mes clés » écrit la clé privée dans le dossier de clés (isolé ici), la clé publique se
//      copie, et l'application du poste est ARMÉE avec cette clé : l'essai commence ;
//   2 bis. (8.4.0) « Créer la clé de réponse » fabrique la paire qui signe les réponses du plan de
//      contrôle : deux moitiés, deux destinations, et le panneau DIT qu'elle n'est pas encore
//      embarquée — sans quoi on croirait la révocation en service alors qu'elle ne l'est pas ;
//   3. « Émettre une licence » signe une clé (vérifiable avec la clé publique), crée un BROUILLON de
//      facture avec la bonne ligne, et l'inscrit dans l'historique ;
//   4. la clé collée dans Paramètres → Licence active l'offre Indépendant : **Achats est OUVERT**
//      (10.7.0 — une offre peut fermer un confort, jamais une case de déclaration), les
//      Immobilisations refusent la création, les Statistiques restent ouvertes, le cadenas est là
//      et là seulement ;
//   5. une clé émise pour un autre matricule est refusée en nommant les deux ;
//   6. « Renouveler » fabrique une seconde clé et une seconde facture, la première sort du compte ;
//   7. rien de ce qui passe le pont ne contient la clé privée ;
//   8. (8.0.0) une SECONDE application, sans override et sans clé privée — c'est-à-dire l'application
//      telle qu'un client l'installe — est armée avec la vraie clé embarquée : essai de 30 jours,
//      aucune trace de l'éditeur, plus de porte « Créer mes clés », et la clé signée à l'étape 3 par
//      la clé d'essai de ce test y est REFUSÉE.
//
// Depuis la 8.0.0 le dépôt embarque la vraie clé publique (build/licence-public.json). Pour créer ses
// clés d'essai, ce parcours ouvre donc l'application DÉSARMÉE par `SKANFACT_CLE_EMBARQUEE` (un chemin
// qui n'existe pas), honoré en développement seulement — l'étape 8 tourne sans lui.
//
//   xvfb-run -a node test/e2e/licence.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const L = require('../../src/licence.js');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-lic-'));
  // La clé privée de l'e2e vit dans un dossier temporaire : jamais dans le vrai ~/.skanfact.
  const cles = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-cles-'));
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON,
    env: { ...process.env, SKANFACT_DOSSIER_CLES: cles, SKANFACT_CLE_EMBARQUEE: path.join(cles, 'aucune-cle-embarquee.json') }
  });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async (hash, w = win) => { await w.evaluate(x => { location.hash = x; }, hash); await w.waitForTimeout(350); };
  // L'onglet des Paramètres se reconnaît à ce qu'il CONTIENT, jamais à son rang.
  const ouvrirParametres = async (panneau, w = win) => {
    await aller('#/parametres', w);
    await w.waitForSelector('#set-tabs');
    const onglet = await w.evaluate(id => { const p = document.getElementById(id); const s = p && p.closest('[data-pane]'); return s ? s.dataset.pane : null; }, panneau);
    if (!onglet) throw new Error('panneau introuvable dans les Paramètres : ' + panneau);
    await w.click(`#set-tabs button[data-tab="${onglet}"]`);
    await w.waitForSelector('#' + panneau, { state: 'visible', timeout: 8000 });
    await w.waitForTimeout(250);
  };
  // L'assistant de première utilisation : chaque écran reconnu à ce qu'il contient, jamais à son rang.
  const traverserAssistant = async (w, nom, mf) => {
    await w.waitForSelector('#setup');
    for (let g = 0; g < 15 && await w.$('#setup'); g++) {
      if (await w.$('#sf-form input[name=name]')) {
        await w.fill('#sf-form input[name=name]', nom);
        await w.fill('#sf-form input[name=matricule]', mf);
      }
      if (await w.$('[data-act="informatique"]')) { await w.click('[data-act="informatique"]'); await w.waitForSelector('[data-act="informatique"].sel'); }
      await w.click('#sf-next'); await w.waitForTimeout(120);
    }
    await w.waitForFunction(() => !document.querySelector('#setup'));
  };
  const MF = '3344556Z/A/P/000';

  // ---------------------------------------------------- 0. une entreprise, un client
  j.etape('Une entreprise et un client');
  await traverserAssistant(win, 'Atelier Licences SUARL', MF);
  await aller('#/clients');
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#modal-root .modal');
  await win.fill('#modal-root input[name=name]', 'Menuiserie Trabelsi SUARL');
  await win.fill('#modal-root input[name=matricule]', '1234567A/M/P/000');
  await win.fill('#modal-root input[name=email]', 'contact@trabelsi.tn');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
  j.ok('client Trabelsi créé, matricule 1234567A');

  // ---------------------------------------------------- 1. sans clé : rien
  j.etape('Sans clé de signature, un client ne voit rien de l\'éditeur');
  const avant = await win.evaluate(() => ({
    nav: !!document.querySelector('nav a[data-route="licences"]'),
    libre: !!document.querySelector('#lic-banner') && document.querySelector('#lic-banner').hidden
  }));
  if (avant.nav) throw new Error('la page Licences est dans la barre sans clé privée');
  await ouvrirParametres('p-licence');
  const etat0 = await win.textContent('#lic-panel');
  if (!/non requise/i.test(etat0)) throw new Error('sans clé publique, la licence devrait être « non requise » : ' + etat0.slice(0, 80));
  if (await win.$('#p-editeur')) throw new Error('le panneau Éditeur est posé sans clé privée');
  if (!await win.$('#lic-devenir')) throw new Error('la porte « Créer mes clés » manque dans le panneau Licence');
  j.ok('ni page, ni panneau, ni cadenas — et l\'application est libre');

  // ---------------------------------------------------- 2. créer les clés
  j.etape('Créer mes clés : la privée reste, la publique se copie, le poste est armé');
  await win.click('#lic-devenir');
  await win.waitForSelector('#modal-root #a');
  await win.click('#modal-root #a');
  await win.waitForSelector('#modal-root #ed-copie', { timeout: 15000 });
  const priv = path.join(cles, 'licence-privee.pem');
  if (!fs.existsSync(priv)) throw new Error('la clé privée n\'a pas été écrite dans ' + priv);
  if (fs.existsSync(path.join(os.homedir(), '.skanfact', 'licence-privee.pem')) && !process.env.SKANFACT_E2E_TOLERE_HOME) {
    // Un vrai éditeur qui lance ce test aurait déjà une clé chez lui : on ne s'en mêle pas, mais
    // on vérifie au moins que CE test n'a rien écrit là-bas (mtime récent).
    const st = fs.statSync(path.join(os.homedir(), '.skanfact', 'licence-privee.pem'));
    if (Date.now() - st.mtimeMs < 60000) throw new Error('le test a écrit dans le vrai ~/.skanfact');
  }
  const pubJson = JSON.parse(fs.readFileSync(path.join(cles, 'licence-publique.json'), 'utf8'));
  if (!pubJson.publicKey || !/^\d{4}-\d{2}-\d{2}$/.test(pubJson.createdAt)) throw new Error('la clé publique de l\'éditeur est incomplète');
  // Ce qui part dans le presse-papiers est le fichier JSON entier (clé + date d'armement) : c'est
  // lui qui sera collé tel quel dans build/licence-public.json.
  const copie = await win.evaluate(() => window.skanfact.editeurCopierPublique());
  let colle = null; try { colle = JSON.parse(copie.texte); } catch (_) {}
  if (!colle || colle.publicKey !== pubJson.publicKey || colle.createdAt !== pubJson.createdAt) throw new Error('« Copier la clé publique » ne rend pas le fichier de clé publique : ' + String(copie && copie.texte).slice(0, 80));
  if (/PRIVATE KEY/.test(copie.texte)) throw new Error('la clé PRIVÉE est sortie par « Copier la clé publique »');
  await win.click('#modal-root [data-close]');
  await win.waitForTimeout(600);
  const apres = await win.evaluate(async () => ({
    nav: !!document.querySelector('nav a[data-route="licences"]'),
    st: await window.skanfact.licenceStatus(''),
    ed: await window.skanfact.editeurStatus()
  }));
  if (!apres.nav) throw new Error('la page Licences n\'est pas apparue dans la barre après la création des clés');
  // Celui qui signe n'achète pas (8.0.0) : le poste de l'éditeur n'est ni en essai, ni verrouillé.
  if (apres.st.state !== 'editeur' || apres.st.locked || !apres.st.editeur) throw new Error('le poste de l\'éditeur devrait être en état « editeur », sans essai ni verrou : ' + JSON.stringify(apres.st));
  // `armee`/`correspond` parlent de la clé EMBARQUÉE (absente ici, par l'override) : « en attente ».
  if (!apres.ed.actif || apres.ed.armee || apres.ed.correspond || !Array.isArray(apres.ed.durees) || !apres.ed.offres.independant) throw new Error('état éditeur inattendu : ' + JSON.stringify(apres.ed).slice(0, 200));
  if (/PRIVATE KEY/.test(JSON.stringify(apres))) throw new Error('la clé privée traverse le pont');
  if (!await win.$('#p-editeur')) throw new Error('le panneau Éditeur n\'est pas posé après la création des clés');
  await ouvrirParametres('p-licence');
  const panneauEd = await win.textContent('#lic-panel');
  if (!/Poste de l'éditeur/.test(panneauEd) || await win.$('#lic-devenir')) throw new Error('le panneau Licence doit dire « Poste de l\'éditeur » et ne plus offrir « Créer mes clés » : ' + panneauEd.slice(0, 120));
  j.ok(`clé privée dans ${cles} · publique copiée · poste éditeur (ni essai ni verrou) · panneau Éditeur posé`);

  // ---------------------------------------------------- 2 bis. la clé de réponse du plan de contrôle
  // Un écran ne se juge pas à la lecture : on clique vraiment le bouton, et on regarde ce qui
  // change. Sans cette clé, le serveur ne peut rien prouver et l'application ignore ses réponses —
  // le panneau doit le DIRE au lieu de laisser croire que la révocation fonctionne déjà.
  j.etape('La clé de réponse du plan de contrôle se crée depuis le panneau Éditeur');
  await ouvrirParametres('p-editeur');
  let bloc = (await win.textContent('#editeur-panel')).replace(/\s+/g, ' ');
  if (!/Pas encore créée/.test(bloc)) throw new Error('le panneau ne dit pas que la clé de réponse manque : ' + bloc.slice(-200));
  if (!/l'application les ignore toutes/.test(bloc)) throw new Error('le panneau ne dit pas que les réponses sont ignorées sans cette clé');
  if (!await win.$('#ed-rep-creer')) throw new Error('le bouton « Créer la clé de réponse » manque');
  await win.click('#ed-rep-creer');
  await win.waitForSelector('#modal-root .modal');
  const libelle = (await win.textContent('#modal-root #ok')).trim();
  if (libelle.length > 30) throw new Error('le bouton de confirmation porte un paragraphe au lieu d\'un libellé : ' + libelle);
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
  await win.waitForTimeout(400);
  bloc = (await win.textContent('#editeur-panel')).replace(/\s+/g, ' ');
  if (!/en attente d'embarquement/i.test(bloc)) throw new Error('le panneau ne passe pas en « en attente d\'embarquement » : ' + bloc.slice(-250));
  for (const b of ['#ed-rep-priv', '#ed-rep-pub']) if (!await win.$(b)) throw new Error('bouton manquant après création : ' + b);
  if (await win.$('#ed-rep-creer')) throw new Error('le bouton de création reste offert alors que la clé existe');
  const fichiers = fs.readdirSync(cles).sort();
  if (!fichiers.includes('reponse-privee.pem') || !fichiers.includes('reponse-publique.json')) {
    throw new Error('les fichiers de la clé de réponse ne sont pas écrits : ' + fichiers.join(', '));
  }
  const pubRep = JSON.parse(fs.readFileSync(path.join(cles, 'reponse-publique.json'), 'utf8'));
  if (!/BEGIN PUBLIC KEY/.test(pubRep.publicKey || '')) throw new Error('la clé publique de réponse n\'est pas une clé publique');
  if (/PRIVATE KEY/.test(JSON.stringify(pubRep))) throw new Error('la clé privée de réponse est dans le fichier public');
  // La privée ne traverse pas le pont : main.js la met au presse-papiers, l'écran n'en reçoit que
  // la confirmation.
  const retour = await win.evaluate(() => window.skanfact.cleReponseCopier('privee'));
  if (/PRIVATE KEY/.test(JSON.stringify(retour))) throw new Error('la clé privée de réponse traverse le pont');
  j.ok('créée sur le poste · deux moitiés, deux destinations · le panneau dit qu\'elle n\'est pas encore embarquée · rien de privé sur le pont');

  // ---------------------------------------------------- 3. émettre une licence
  j.etape('Émettre une licence : clé signée, brouillon de facture, historique');
  await aller('#/licences');
  await win.waitForSelector('#lic-new');
  if (!await win.$('#lic-first')) throw new Error('l\'état vide de la page Licences n\'offre pas le bouton d\'émission');
  await win.click('#lic-first');
  await win.waitForSelector('#modal-root #lf');
  // le client, par la liste déroulante
  await win.click('#modal-root [data-combo=clientId] .combo-btn');
  await win.fill('#modal-root [data-combo=clientId] .combo-q', 'trabelsi');
  await win.waitForSelector('#modal-root [data-combo=clientId] .combo-it');
  await win.click('#modal-root [data-combo=clientId] .combo-it');
  await win.selectOption('#modal-root select[name=offre]', 'independant');
  // Un mois : la licence finit dans 30 jours, donc elle est « à renouveler » DÈS son émission —
  // c'est ce qui permet de voir, à l'étape 7, qu'un renouvellement la sort du compte.
  await win.selectOption('#modal-root select[name=duree]', '1m');
  await win.fill('#modal-root input[name=prix]', '390');
  await win.selectOption('#modal-root select[name=tva]', '19');
  await win.click('#modal-root #ok');
  // 8.2.0 — le geste finit sur la CLÉ, plus sur la facture. L'assertion précédente attendait
  // `#/doc/…` : elle gravait le défaut que Skander a signalé — on atterrissait sur la facture et il
  // fallait revenir à la page Licences pour envoyer au client le produit qu'il attend.
  await win.waitForSelector('#modal-root #cle-txt', { timeout: 15000 });
  const panneauCle = await win.evaluate(() => ({
    cle: (document.querySelector('#cle-txt') || {}).textContent || '',
    copier: !!document.querySelector('#cle-copier'), mail: !!document.querySelector('#cle-mail'),
    facture: !!document.querySelector('#cle-fact'),
    brouillon: /brouillon/i.test((document.querySelector('#modal-root .modal') || document.body).textContent)
  }));
  if (!/^SKAN1\./.test(panneauCle.cle.trim())) throw new Error('le panneau doit montrer la clé : ' + panneauCle.cle.slice(0, 60));
  if (!panneauCle.copier || !panneauCle.mail || !panneauCle.facture) throw new Error('copier / envoyer / ouvrir la facture : il en manque — ' + JSON.stringify(panneauCle));
  if (!panneauCle.brouillon) throw new Error('le panneau doit dire que la facture est un brouillon à émettre');
  await win.click('#modal-root [data-close]');
  await win.waitForTimeout(400);
  const emise = await win.evaluate(() => {
    const d = window.__data;
    const l = d.licences[0];
    const inv = d.documents.find(x => x.id === l.invoiceId);
    return { n: d.licences.length, l, inv: inv && { type: inv.type, status: inv.status, number: inv.number, clientId: inv.clientId, lines: inv.lines, licenceId: inv.licenceId, subject: inv.subject } };
  });
  if (emise.n !== 1) throw new Error('l\'historique devrait compter une licence, pas ' + emise.n);
  const l1 = emise.l;
  if (l1.offre !== 'independant' || !/^SKAN1\./.test(l1.key) || !l1.exp) throw new Error('licence incomplète : ' + JSON.stringify(l1).slice(0, 200));
  const payload = L.verifyKey(l1.key, pubJson.publicKey);
  if (!payload || payload.offre !== 'independant' || payload.nom !== 'Menuiserie Trabelsi SUARL' || payload.matricule !== '1234567A/M/P/000' || payload.id !== l1.id) {
    throw new Error('la clé émise ne se vérifie pas avec la clé publique, ou ne porte pas les bons champs : ' + JSON.stringify(payload));
  }
  if (payload.exp !== L.addMonths(L.today(), 1)) throw new Error('« 1 mois » doit finir le même jour le mois prochain : ' + payload.exp);
  if (!emise.inv || emise.inv.type !== 'facture' || emise.inv.status !== 'brouillon' || emise.inv.number) throw new Error('la facture doit être un BROUILLON sans numéro : ' + JSON.stringify(emise.inv));
  if (emise.inv.clientId !== l1.clientId || emise.inv.lines.length !== 1 || emise.inv.lines[0].unitPrice !== 390 || emise.inv.lines[0].vatRate !== 19 || emise.inv.licenceId !== l1.id) {
    throw new Error('la ligne de la facture ne porte pas la licence : ' + JSON.stringify(emise.inv.lines));
  }
  if (/PRIVATE KEY/.test(JSON.stringify(emise))) throw new Error('la clé privée est dans les données');
  j.ok(`clé ${l1.id} vérifiée avec la clé publique · facture brouillon 390 DT HT · offre Indépendant jusqu'au ${payload.exp}`);

  // la page Licences la montre « à renouveler », le pied la compte, la barre la signale, et
  // « À faire » la réclame sur l'accueil
  await aller('#/licences');
  await win.waitForSelector('#lic-wrap table');
  const ligne = await win.textContent('#lic-wrap tbody tr');
  if (!/Trabelsi/.test(ligne) || !/Indépendant/.test(ligne) || !/Brouillon/.test(ligne) || !/À renouveler/.test(ligne)) throw new Error('la ligne de la licence est incomplète : ' + ligne.replace(/\s+/g, ' '));
  const pied1 = (await win.textContent('#lic-wrap tfoot')).replace(/\s+/g, ' ');
  if (!/1 à renouveler/.test(pied1)) throw new Error('le pied doit compter la licence à renouveler : ' + pied1);
  const pastille1 = await win.evaluate(() => { const e = document.querySelector('#nav-licences'); return e && !e.hidden ? e.textContent : null; });
  if (pastille1 !== '1') throw new Error('la barre doit signaler 1 licence à renouveler : ' + pastille1);
  await aller('#/dashboard');
  await win.waitForSelector('#view');
  await win.waitForTimeout(300);
  if (!await win.$('[data-todo="licences-expirent"]')) throw new Error('« À faire » ne réclame pas la licence qui expire dans 30 jours');
  await aller('#/licences');
  await win.waitForSelector('#lic-wrap table');
  await win.click('#lic-wrap .row-menu-btn');
  await win.waitForSelector('.row-menu');
  const actions = await win.$$eval('.row-menu [role=menuitem], .row-menu button', els => els.map(e => e.textContent.trim()).filter(Boolean));
  for (const a of ['Copier la clé', 'Envoyer la clé par email', 'Ouvrir la facture', 'Renouveler']) {
    if (!actions.some(x => x.startsWith(a))) throw new Error(`action « ${a} » absente du menu : ${actions.join(' | ')}`);
  }
  await win.keyboard.press('Escape');
  j.ok('la page liste la licence, et le menu offre les quatre gestes');

  // ---------------------------------------------------- 4. la clé activée chez le client
  j.etape('La clé Indépendant, collée : Achats reste OUVERT, les Immobilisations refusent, Statistiques reste ouverte');
  // On change le matricule de la société pour celui du client : c'est SON dossier qu'on simule.
  await win.evaluate(async mf => { window.__data.company.matricule = mf; await window.skanfact.saveData(window.__data); }, '1234567A/M/P/000');
  await ouvrirParametres('p-licence');
  await win.fill('#lic-key', l1.key);
  await win.click('#lic-save');
  await win.waitForTimeout(800);
  const st1 = await win.evaluate(mf => window.skanfact.licenceStatus(mf), '1234567A/M/P/000');
  // On exige la RÈGLE, pas la liste du jour : l'offre Indépendant réserve quelque chose (sinon elle
  // ne se distingue pas d'Entreprise) et ne réserve PAS « achats » — c'est le correctif de la
  // 10.7.0, et cette assertion est ce qui l'empêche de repartir en arrière.
  if (st1.state !== 'active' || st1.offre !== 'independant' || !st1.reserves.length) throw new Error('la clé collée devrait activer l\'offre Indépendant : ' + JSON.stringify(st1).slice(0, 200));
  if (st1.reserves.includes('achats')) throw new Error('l\'offre Indépendant ne doit plus réserver Achats : sans lui, la TVA déductible du paquet vaut zéro et le client déclare un chiffre faux (10.7.0)');
  const panneau = await win.textContent('#lic-panel');
  if (!/Indépendant/.test(panneau)) throw new Error('le panneau Licence ne nomme pas l\'offre');
  // 10.9.2 — l'empreinte de la clé s'AFFICHE, avec son bouton pour la prendre. La page
  // skanfact.tn/verifier envoyait la chercher ici, et rien ne l'y montrait : on demandait une
  // valeur impossible à obtenir. Et c'est bien CELLE de la clé collée — une empreinte affichée
  // qui ne serait pas la sienne enverrait vérifier la licence de quelqu'un d'autre.
  const attendue = require('../../src/licence.js').empreinteCle(l1.key);
  if (!panneau.includes(attendue)) throw new Error('le panneau Licence doit afficher l\'empreinte ' + attendue + ' : ' + panneau.slice(0, 200));
  if (!await win.$('#lic-copier-emp')) throw new Error('trente-deux caractères affichés sans bouton « Copier » se recopient à la main, donc faux');
  // Le métier « informatique » n'affiche pas le module Pilotage : on affiche TOUT (aucun choix de
  // modules enregistré = tout), sinon « pas de cadenas sur Statistiques » serait vrai faute de lien.
  await win.evaluate(async () => { delete window.__data.company.modules; await window.skanfact.saveData(window.__data); });
  await aller('#/dashboard');
  await win.waitForSelector('nav a[data-route="stats"]', { timeout: 8000 });
  const cadenas = await win.evaluate(() => ({
    achats: !!document.querySelector('nav a[data-route="achats"] svg.nav-lock'),
    tresorerie: !!document.querySelector('nav a[data-route="tresorerie"] svg.nav-lock'),
    paie: !!document.querySelector('nav a[data-route="paie"] svg.nav-lock'),
    statsLien: !!document.querySelector('nav a[data-route="stats"]'),
    stats: !!document.querySelector('nav a[data-route="stats"] svg.nav-lock'),
    devis: !!document.querySelector('nav a[data-route="devis"] svg.nav-lock')
  }));
  // Le cadenas se pose sur ce que l'offre ferme, et NULLE PART ailleurs. Achats en est sorti en
  // 10.7.0 : un cadenas resté là serait la trace visible du défaut qu'on vient de corriger.
  if (cadenas.achats) throw new Error('Achats ne doit plus porter de cadenas : l\'offre Indépendant ne le réserve plus (10.7.0)');
  if (!cadenas.tresorerie || !cadenas.paie || !cadenas.statsLien || cadenas.stats || cadenas.devis) throw new Error('cadenas mal posés : ' + JSON.stringify(cadenas));

  // Achats, OUVERT : ni bandeau, ni refus — et un fournisseur se crée VRAIMENT. C'est la moitié
  // qui compte : sans elle, « pas de cadenas » serait vrai sur une page qui refuse quand même.
  await aller('#/achats');
  await win.waitForSelector('#view .page-head');
  if (await win.$('.offre-banner')) throw new Error('la page Achats ne doit plus porter de bandeau d\'offre (10.7.0)');
  await aller('#/fournisseurs');
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#modal-root #sf');
  const nAvant = await win.evaluate(() => window.__data.suppliers.length);
  await win.fill('#modal-root input[name=name]', 'Fournisseur Test');
  await win.click('#modal-root #sf ~ .modal-actions #ok, #modal-root .modal-actions #ok');
  await win.waitForFunction(n => window.__data.suppliers.length === n + 1, nAvant, { timeout: 8000 });
  if (await win.$('#modal-root .modal-bg:last-child .modal h2')) {
    const t2 = await win.textContent('#modal-root .modal-bg:last-child .modal h2');
    if (/Offre/.test(t2)) throw new Error('créer un fournisseur ne doit plus être refusé : ' + t2);
  }
  await win.evaluate(() => { const b2 = document.querySelector('#modal-root [data-close]'); if (b2) b2.click(); });
  await win.waitForTimeout(300);

  // Les Immobilisations, elles, restent réservées : le bandeau à l'entrée et le refus à la
  // création, sans rien masquer. On prend un module ENCORE fermé, sinon le parcours ne prouverait
  // plus qu'une offre ferme quoi que ce soit — un test qui n'exerce plus son refus ne protège de
  // rien. Et c'est celui-là qui compte : avec Achats ouvert, un Indépendant peut désormais saisir
  // un achat en « immobilisation » sans pouvoir créer la fiche. C'est voulu, le cabinet la crée
  // depuis le paquet (9.7.0) — encore faut-il que l'app ne le lui REPROCHE pas.
  await aller('#/immos');
  await win.waitForSelector('#view .page-head');
  if (!await win.$('.offre-banner')) throw new Error('la page Immobilisations ne prévient pas que la création fait partie de l\'offre Entreprise');
  const bandeau = (await win.textContent('.offre-banner')).replace(/\s+/g, ' ');
  if (!/Offre Indépendant/.test(bandeau) || !/tout lire/.test(bandeau)) throw new Error('le bandeau ne dit pas ce qui reste ouvert : ' + bandeau);
  const immoAvant = await win.evaluate(() => window.__data.assets.length);
  await win.click('#new-imm');
  await win.waitForSelector('#modal-root #imf', { timeout: 8000 });
  // Le garde-fou vit DANS le formulaire, sur la branche création (7.33.0 : `assetForm` s'ouvre
  // depuis plusieurs pages). Le refus arrive donc à l'enregistrement, pas à l'ouverture — c'est
  // ce qui permet de remplir, de voir le plan d'amortissement, et de comprendre ce qu'on perd.
  await win.fill('#modal-root input[name=label]', 'Ordinateur portable');
  await win.fill('#modal-root input[name=amount]', '2400');
  await win.fill('#modal-root input[name=years]', '3');
  await win.evaluate(() => {
    const hid = document.querySelector('#modal-root input[name=date]');
    hid.value = '2026-03-04';
    const t = hid.closest('.datefield').querySelector('.d-txt');
    if (t) t.value = '04/03/2026';
  });
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => document.querySelectorAll('#modal-root .modal-bg').length === 2, null, { timeout: 8000 });
  const refusTxt = (await win.textContent('#modal-root .modal-bg:last-child .modal')).replace(/\s+/g, ' ');
  if (!/Offre Indépendant/.test(refusTxt) || !/Entreprise/.test(refusTxt) || !/lisible/.test(refusTxt)) throw new Error('le refus ne dit pas l\'offre et ce qui reste ouvert : ' + refusTxt.slice(0, 200));
  await win.evaluate(() => { const b2 = document.querySelector('#modal-root .modal-bg:last-child [data-close]'); if (b2) b2.click(); });
  await win.waitForTimeout(400);
  await win.evaluate(() => { const b2 = document.querySelector('#modal-root [data-close]'); if (b2) b2.click(); });
  await win.waitForTimeout(300);
  const nApres = await win.evaluate(() => window.__data.assets.length);
  if (nApres !== immoAvant) throw new Error('une immobilisation a été créée malgré l\'offre Indépendant');
  await aller('#/stats');
  await win.waitForSelector('#view .page-head');
  await win.waitForTimeout(300);
  if (await win.$('.offre-banner')) throw new Error('les Statistiques ne doivent porter aucun bandeau d\'offre');
  const titre = await win.textContent('#view h1');
  if (!/Statistiques/.test(titre)) throw new Error('la page Statistiques ne s\'est pas ouverte : ' + titre);
  j.ok('Achats ouvert (fournisseur créé, ni cadenas ni bandeau), Immobilisations réservées (bandeau, refus nommé, rien créé), Statistiques libres');

  // ---------------------------------------------------- 5. la clé d'un autre
  j.etape('Une clé émise pour un autre matricule est refusée, en nommant les deux');
  const autre = await win.evaluate(() => window.skanfact.licenceEmettre({ nom: 'Pharmacie El Menzah', matricule: '7654321B/A/M/000', offre: 'entreprise', duree: '1a' }));
  if (/PRIVATE KEY/.test(JSON.stringify(autre))) throw new Error('licenceEmettre rend la clé privée');
  // Par l'ÉCRAN, comme le ferait le client : on colle, on enregistre, et c'est le bandeau qui refuse.
  await ouvrirParametres('p-licence');
  await win.fill('#lic-key', autre.key);
  await win.click('#lic-save');
  await win.waitForFunction(() => { const t = document.querySelector('#toast'); return t && !t.hidden && /7654321B/.test(t.textContent); }, null, { timeout: 8000 });
  const refus = await win.textContent('#toast');
  if (!/7654321B/.test(refus) || !/1234567A/.test(refus)) throw new Error('la clé d\'une autre entreprise devrait être refusée en nommant les deux matricules : ' + refus);
  const encore = await win.evaluate(mf => window.skanfact.licenceStatus(mf), '1234567A/M/P/000');
  if (encore.state !== 'active' || encore.offre !== 'independant') throw new Error('le refus a écrasé la licence en place');
  if (!/Indépendant/.test(await win.textContent('#lic-panel'))) throw new Error('le panneau doit toujours montrer la licence en place');
  j.ok('refusée à l\'écran : « ' + refus.replace(/\s+/g, ' ').slice(0, 90) + '… »');

  // ---------------------------------------------------- 6. renouveler
  j.etape('Renouveler : une seconde clé, une seconde facture, la première sort du compte');
  await aller('#/licences');
  await win.waitForSelector('#lic-wrap .row-menu-btn');
  await win.click('#lic-wrap .row-menu-btn');
  await win.waitForSelector('.row-menu');
  const items = await win.$$('.row-menu [role=menuitem], .row-menu button');
  let cliquee = false;
  for (const it of items) { if (/^Renouveler/.test((await it.textContent()).trim())) { await it.click(); cliquee = true; break; } }
  if (!cliquee) throw new Error('« Renouveler » introuvable dans le menu');
  await win.waitForSelector('#modal-root #lf');
  const prerempli = await win.evaluate(() => ({ client: document.querySelector('#modal-root input[name=clientId]').value, offre: document.querySelector('#modal-root select[name=offre]').value, prix: document.querySelector('#modal-root input[name=prix]').value }));
  if (prerempli.client !== l1.clientId || prerempli.offre !== 'independant' || prerempli.prix !== '390') throw new Error('le renouvellement n\'est pas prérempli : ' + JSON.stringify(prerempli));
  await win.selectOption('#modal-root select[name=duree]', 'vie');
  await win.click('#modal-root #ok');
  // Un renouvellement finit lui aussi sur la CLÉ (8.2.0), plus sur la facture.
  await win.waitForSelector('#modal-root #cle-txt', { timeout: 15000 });
  const cle2 = (await win.textContent('#modal-root #cle-txt')).trim();
  if (!/^SKAN1\./.test(cle2) || cle2 === l1.key) throw new Error('le renouvellement doit montrer une clé NEUVE');
  await win.click('#modal-root [data-close]');
  await win.waitForTimeout(500);
  const apresRenouv = await win.evaluate(() => {
    const d = window.__data; const [a, b] = d.licences;
    return { n: d.licences.length, idA: a.id, idB: b.id, remplaceePar: a.remplaceePar, exp2: b.exp, remplace: b.remplace,
      factures: d.documents.filter(x => x.type === 'facture').length, expirant: window.SkanCore.licencesExpirant(d).length };
  });
  if (apresRenouv.n !== 2) throw new Error('il devrait y avoir deux licences : ' + JSON.stringify(apresRenouv));
  if (apresRenouv.remplaceePar !== apresRenouv.idB) throw new Error('la première licence doit pointer EXACTEMENT vers sa remplaçante : ' + JSON.stringify(apresRenouv));
  if (apresRenouv.exp2 !== '' || apresRenouv.remplace !== l1.id || apresRenouv.factures !== 2) throw new Error('renouvellement incomplet : ' + JSON.stringify(apresRenouv));
  if (apresRenouv.expirant !== 0) throw new Error('la licence renouvelée doit sortir du compte des choses à faire');
  await aller('#/licences');
  const garde2 = await win.waitForSelector('#modal-root #b', { timeout: 3000 }).catch(() => null);
  if (garde2) await garde2.click();
  await win.waitForSelector('#lic-wrap table');
  const pied = (await win.textContent('#lic-wrap tfoot')).replace(/\s+/g, ' ');
  if (!/2 licences/.test(pied) || /à renouveler/.test(pied)) throw new Error('le pied devrait compter 2 licences et plus rien à renouveler : ' + pied);
  const pastille2 = await win.evaluate(() => { const e = document.querySelector('#nav-licences'); return e && !e.hidden ? e.textContent : null; });
  if (pastille2 !== null) throw new Error('la pastille de la barre doit s\'éteindre après le renouvellement : ' + pastille2);
  // Et la licence renouvelée ne se renouvelle pas une seconde fois : son menu ne l'offre plus.
  const premiere = await win.$$eval('#lic-wrap tbody tr', trs => trs.findIndex(tr => /Renouvelée/.test(tr.textContent)));
  if (premiere < 0) throw new Error('la première licence doit se lire « Renouvelée »');
  await win.click(`#lic-wrap tbody tr:nth-child(${premiere + 1}) .row-menu-btn`);
  await win.waitForSelector('.row-menu');
  const actions2 = await win.$$eval('.row-menu [role=menuitem], .row-menu button', els => els.map(e => e.textContent.trim()).filter(Boolean));
  if (actions2.some(a => /^Renouveler$/.test(a)) || !actions2.some(a => /^Renouveler la suivante/.test(a))) throw new Error('une licence renouvelée ne doit offrir que « Renouveler la suivante » : ' + actions2.join(' | '));
  await win.keyboard.press('Escape');
  j.ok('deux licences, deux factures, « à vie » sur la seconde, la première marquée renouvelée et sortie du compte');
  await Promise.race([app.close(), new Promise((_, rej) => setTimeout(() => rej(new Error('l\'application ne se ferme pas : un garde-fou de sortie attend une réponse')), 20000))]);

  // ---------------------------------------------------- 8. l'application telle qu'un client l'installe
  j.etape('La vraie clé embarquée (8.0.0) : un client est en essai, ne voit rien de l\'éditeur, et la clé d\'essai de ce test est refusée');
  const embarquee = JSON.parse(fs.readFileSync(path.join(RACINE, 'build', 'licence-public.json'), 'utf8'));
  if (!embarquee.publicKey || embarquee.publicKey === pubJson.publicKey) throw new Error('build/licence-public.json doit porter une clé, et pas celle de ce test');
  if (L.verifyKey(l1.key, embarquee.publicKey)) throw new Error('la clé signée par la clé d\'essai ne doit pas se vérifier avec la clé embarquée');
  const userData2 = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-lic-client-'));
  const clesVides = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-cles-vides-'));
  // Sans override : c'est build/licence-public.json qui arme, comme chez tout le monde.
  const env2 = { ...process.env, SKANFACT_DOSSIER_CLES: clesVides };
  delete env2.SKANFACT_CLE_EMBARQUEE;
  const app2 = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData2}`, RACINE], executablePath: ELECTRON, env: env2 });
  const win2 = await app2.firstWindow(); surveiller(win2, 'client', bac);
  await traverserAssistant(win2, 'Menuiserie Trabelsi SUARL', '1234567A/M/P/000');
  const reel = await win2.evaluate(async mf => ({
    st: await window.skanfact.licenceStatus(mf), ed: await window.skanfact.editeurStatus(),
    nav: !!document.querySelector('nav a[data-route="licences"]'),
    banner: (() => { const b = document.querySelector('#lic-banner'); return b && !b.hidden ? { texte: b.textContent, calme: b.classList.contains('calme'), warn: b.classList.contains('warn') } : null; })()
  }), '1234567A/M/P/000');
  if (reel.st.state !== 'essai' || reel.st.locked || reel.st.daysLeft !== 30 || reel.st.editeur) throw new Error('avec la vraie clé embarquée, une installation neuve doit être en essai de 30 jours : ' + JSON.stringify(reel.st).slice(0, 200));
  if (reel.nav || reel.ed.actif || !reel.ed.armee) throw new Error('un client ne doit rien voir de l\'éditeur, et l\'application doit se savoir armée : ' + JSON.stringify({ nav: reel.nav, ed: reel.ed }).slice(0, 200));
  // 8.0.1 — l'assertion disait l'inverse jusqu'ici (« à 30 jours, aucun bandeau ») : elle décrivait
  // l'état du jour, pas la règle. Quelqu'un qui passe l'assistant et n'ouvre jamais les Paramètres
  // n'apprenait NULLE PART qu'il est en essai, ni que SkanFact se paie — il l'apprenait le
  // trente-et-unième matin, verrouillé. La pastille est là dès le premier jour, et calme.
  if (!reel.banner) throw new Error('un client en essai doit le voir dans la barre sans ouvrir les Paramètres');
  if (!/\b30 jours\b/.test(reel.banner.texte)) throw new Error('la pastille doit dire combien de jours il reste : ' + reel.banner.texte);
  if (!reel.banner.calme || reel.banner.warn) throw new Error('à 30 jours, la pastille informe, elle n\'alarme pas : ' + JSON.stringify(reel.banner));
  await ouvrirParametres('p-licence', win2);
  const panneauClient = await win2.textContent('#lic-panel');
  if (!/Période d'essai/.test(panneauClient) || /non requise/.test(panneauClient)) throw new Error('le panneau Licence d\'un client doit annoncer l\'essai : ' + panneauClient.slice(0, 120));
  if (await win2.$('#lic-devenir')) throw new Error('la porte « Créer mes clés » ne doit plus exister sur une application armée');
  if (await win2.$('#p-editeur')) throw new Error('le panneau Éditeur est posé chez un client');
  // La clé émise à l'étape 3 (par la clé d'essai de ce test, pour ce même matricule) n'est pas
  // signée par l'éditeur : refusée à l'écran, et rien n'est enregistré.
  await win2.fill('#lic-key', l1.key);
  await win2.click('#lic-save');
  await win2.waitForFunction(() => { const t = document.querySelector('#toast'); return t && !t.hidden && /pas reconnue/.test(t.textContent); }, null, { timeout: 8000 });
  const st2 = await win2.evaluate(mf => window.skanfact.licenceStatus(mf), '1234567A/M/P/000');
  if (st2.state !== 'essai' || st2.key) throw new Error('une clé refusée ne doit pas être enregistrée : ' + JSON.stringify(st2).slice(0, 120));
  // Et pendant l'essai, rien n'est fermé : un devis se crée.
  await aller('#/devis', win2);
  await win2.waitForSelector('#new'); await win2.click('#new');
  await win2.waitForFunction(() => /^#\/doc\//.test(location.hash), null, { timeout: 8000 });
  j.ok('essai de 30 jours · ni page, ni panneau, ni porte de l\'éditeur · clé d\'essai refusée (« pas reconnue ») · un devis se crée');
  await Promise.race([app2.close(), new Promise((_, rej) => setTimeout(() => rej(new Error('l\'application ne se ferme pas : un garde-fou de sortie attend une réponse')), 20000))]);

  // ---------------------------------------------------- 9. le contournement qui ne marche pas
  j.etape('Une AUTRE clé privée, avec la clé publique de SkanFact recopiée à côté : aucun passe-droit');
  // Le scénario trouvé par la relecture adversariale : un .pem quelconque (ici celui de ce test) et,
  // à côté, licence-publique.json recopié avec la clé EMBARQUÉE. Si l'application croyait le fichier,
  // ce poste serait « éditeur » — ni essai ni verrou — sans jamais avoir signé quoi que ce soit.
  fs.writeFileSync(path.join(cles, 'licence-publique.json'), JSON.stringify({ format: 1, publicKey: embarquee.publicKey, createdAt: '2026-09-14' }, null, 2));
  const userData3 = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-lic-imposteur-'));
  const app3 = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData3}`, RACINE], executablePath: ELECTRON, env: { ...process.env, SKANFACT_DOSSIER_CLES: cles } });
  const win3 = await app3.firstWindow(); surveiller(win3, 'imposteur', bac);
  await traverserAssistant(win3, 'Imposteur SUARL', MF);
  const imp = await win3.evaluate(async mf => ({ st: await window.skanfact.licenceStatus(mf), ed: await window.skanfact.editeurStatus() }), MF);
  if (imp.st.state !== 'essai' || imp.st.locked) throw new Error('une autre clé privée ne doit donner aucun passe-droit : ' + JSON.stringify(imp.st).slice(0, 160));
  if (!imp.ed.actif || !imp.ed.armee || imp.ed.correspond || imp.ed.publicKey !== pubJson.publicKey) throw new Error('l\'état éditeur doit être déduit de la clé PRIVÉE, pas du fichier : ' + JSON.stringify({ armee: imp.ed.armee, correspond: imp.ed.correspond }));
  const refait = JSON.parse(fs.readFileSync(path.join(cles, 'licence-publique.json'), 'utf8'));
  if (refait.publicKey !== pubJson.publicKey) throw new Error('le fichier public trafiqué doit être réécrit avec la clé déduite de la privée');
  await ouvrirParametres('p-editeur', win3);
  const pan3 = (await win3.textContent('#editeur-panel')).replace(/\s+/g, ' ');
  if (!/AUTRE clé/.test(pan3)) throw new Error('le panneau Éditeur doit dire que SkanFact est armé avec une AUTRE clé : ' + pan3.slice(0, 160));
  j.ok('essai, pas « éditeur » · fichier public réécrit depuis la clé privée · panneau « armée avec une AUTRE clé »');

  console.log('\nerreurs JS : ' + bac.length);
  bac.slice(0, 6).forEach(e => console.log('  - ' + e));
  await Promise.race([app3.close(), new Promise((_, rej) => setTimeout(() => rej(new Error('l\'application ne se ferme pas : un garde-fou de sortie attend une réponse')), 20000))]);
  if (bac.length) { console.error('>>> ÉCHEC'); process.exit(2); }
  console.log(`\n${j.total()} étapes — L'ÉDITEUR ET LES OFFRES : OK`);
})().catch(e => { console.error('\n✕ ÉCHEC : ' + (e.stack || e.message)); process.exit(1); });
