// L'éditeur de SkanFact, et les offres de licence (7.33.0), dans l'application réelle.
//
// Ce que ce parcours prouve, dans l'ordre :
//   1. sans clé de signature, il n'y a ni page Licences, ni panneau Éditeur — un client ne voit rien ;
//   2. « Créer mes clés » écrit la clé privée dans le dossier de clés (isolé ici), la clé publique se
//      copie, et l'application du poste est ARMÉE avec cette clé : l'essai commence ;
//   3. « Émettre une licence » signe une clé (vérifiable avec la clé publique), crée un BROUILLON de
//      facture avec la bonne ligne, et l'inscrit dans l'historique ;
//   4. la clé collée dans Paramètres → Licence active l'offre Indépendant : l'Achat refuse la
//      création, les Statistiques restent ouvertes, le menu porte un cadenas ;
//   5. une clé émise pour un autre matricule est refusée en nommant les deux ;
//   6. « Renouveler » fabrique une seconde clé et une seconde facture, la première sort du compte ;
//   7. rien de ce qui passe le pont ne contient la clé privée.
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
    env: { ...process.env, SKANFACT_DOSSIER_CLES: cles }
  });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(350); };
  // L'onglet des Paramètres se reconnaît à ce qu'il CONTIENT, jamais à son rang.
  const ouvrirParametres = async (panneau) => {
    await aller('#/parametres');
    await win.waitForSelector('#set-tabs');
    const onglet = await win.evaluate(id => { const p = document.getElementById(id); const s = p && p.closest('[data-pane]'); return s ? s.dataset.pane : null; }, panneau);
    if (!onglet) throw new Error('panneau introuvable dans les Paramètres : ' + panneau);
    await win.click(`#set-tabs button[data-tab="${onglet}"]`);
    await win.waitForSelector('#' + panneau, { state: 'visible', timeout: 8000 });
    await win.waitForTimeout(250);
  };
  const MF = '3344556Z/A/P/000';

  // ---------------------------------------------------- 0. une entreprise, un client
  j.etape('Une entreprise et un client');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Licences SUARL');
      await win.fill('#sf-form input[name=matricule]', MF);
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
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
  if (apres.st.state !== 'essai' || !apres.st.editeur) throw new Error('le poste de l\'éditeur devrait être armé et en essai : ' + JSON.stringify(apres.st));
  if (apres.st.daysLeft !== 30) throw new Error('l\'essai doit compter depuis l\'armement (aujourd\'hui) : ' + apres.st.daysLeft + ' jours');
  if (!apres.ed.actif || apres.ed.armee || !Array.isArray(apres.ed.durees) || !apres.ed.offres.independant) throw new Error('état éditeur inattendu : ' + JSON.stringify(apres.ed).slice(0, 200));
  if (/PRIVATE KEY/.test(JSON.stringify(apres))) throw new Error('la clé privée traverse le pont');
  if (!await win.$('#p-editeur')) throw new Error('le panneau Éditeur n\'est pas posé après la création des clés');
  j.ok(`clé privée dans ${cles} · publique copiée · poste armé, essai de 30 jours · panneau Éditeur posé`);

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
  await win.selectOption('#modal-root select[name=duree]', '1a');
  await win.fill('#modal-root input[name=prix]', '390');
  await win.selectOption('#modal-root select[name=tva]', '19');
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => /^#\/doc\//.test(location.hash), null, { timeout: 15000 });
  await win.waitForTimeout(600);
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
  if (payload.exp !== L.addMonths(L.today(), 12)) throw new Error('« 1 an » doit finir le même jour l\'an prochain : ' + payload.exp);
  if (!emise.inv || emise.inv.type !== 'facture' || emise.inv.status !== 'brouillon' || emise.inv.number) throw new Error('la facture doit être un BROUILLON sans numéro : ' + JSON.stringify(emise.inv));
  if (emise.inv.clientId !== l1.clientId || emise.inv.lines.length !== 1 || emise.inv.lines[0].unitPrice !== 390 || emise.inv.lines[0].vatRate !== 19 || emise.inv.licenceId !== l1.id) {
    throw new Error('la ligne de la facture ne porte pas la licence : ' + JSON.stringify(emise.inv.lines));
  }
  if (/PRIVATE KEY/.test(JSON.stringify(emise))) throw new Error('la clé privée est dans les données');
  j.ok(`clé ${l1.id} vérifiée avec la clé publique · facture brouillon 390 DT HT · offre Indépendant jusqu'au ${payload.exp}`);

  // la page Licences la montre, et « À faire » ne la réclame pas encore (elle finit dans un an)
  await aller('#/licences');
  await win.waitForSelector('#lic-wrap table');
  const ligne = await win.textContent('#lic-wrap tbody tr');
  if (!/Trabelsi/.test(ligne) || !/Indépendant/.test(ligne) || !/Brouillon/.test(ligne)) throw new Error('la ligne de la licence est incomplète : ' + ligne.replace(/\s+/g, ' '));
  await win.click('#lic-wrap .row-menu-btn');
  await win.waitForSelector('.row-menu');
  const actions = await win.$$eval('.row-menu [role=menuitem], .row-menu button', els => els.map(e => e.textContent.trim()).filter(Boolean));
  for (const a of ['Copier la clé', 'Envoyer la clé par email', 'Ouvrir la facture', 'Renouveler']) {
    if (!actions.some(x => x.startsWith(a))) throw new Error(`action « ${a} » absente du menu : ${actions.join(' | ')}`);
  }
  await win.keyboard.press('Escape');
  j.ok('la page liste la licence, et le menu offre les quatre gestes');

  // ---------------------------------------------------- 4. la clé activée chez le client
  j.etape('La clé Indépendant, collée : Achats refuse de créer, Statistiques reste ouverte');
  // On change le matricule de la société pour celui du client : c'est SON dossier qu'on simule.
  await win.evaluate(async mf => { window.__data.company.matricule = mf; await window.skanfact.saveData(window.__data); }, '1234567A/M/P/000');
  await ouvrirParametres('p-licence');
  await win.fill('#lic-key', l1.key);
  await win.click('#lic-save');
  await win.waitForTimeout(800);
  const st1 = await win.evaluate(mf => window.skanfact.licenceStatus(mf), '1234567A/M/P/000');
  if (st1.state !== 'active' || st1.offre !== 'independant' || !st1.reserves.includes('achats')) throw new Error('la clé collée devrait activer l\'offre Indépendant : ' + JSON.stringify(st1).slice(0, 200));
  const panneau = await win.textContent('#lic-panel');
  if (!/Indépendant/.test(panneau)) throw new Error('le panneau Licence ne nomme pas l\'offre');
  const cadenas = await win.evaluate(() => ({
    achats: !!document.querySelector('nav a[data-route="achats"] svg.nav-lock'),
    stats: !!document.querySelector('nav a[data-route="stats"] svg.nav-lock'),
    devis: !!document.querySelector('nav a[data-route="devis"] svg.nav-lock')
  }));
  if (!cadenas.achats || cadenas.stats || cadenas.devis) throw new Error('cadenas mal posés : ' + JSON.stringify(cadenas));
  // Achats : le bandeau à l'entrée, et le refus à la création — sans rien masquer. La page reste,
  // la liste se lit ; c'est un NOUVEAU fournisseur qui est refusé, dans son propre formulaire.
  await aller('#/achats');
  await win.waitForSelector('#view .page-head');
  if (!await win.$('.offre-banner')) throw new Error('la page Achats ne prévient pas que la création fait partie de l\'offre Entreprise');
  const bandeau = (await win.textContent('.offre-banner')).replace(/\s+/g, ' ');
  if (!/Offre Indépendant/.test(bandeau) || !/tout lire/.test(bandeau)) throw new Error('le bandeau ne dit pas ce qui reste ouvert : ' + bandeau);
  await aller('#/fournisseurs');
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#modal-root #sf');
  const nAvant = await win.evaluate(() => window.__data.suppliers.length);
  await win.fill('#modal-root input[name=name]', 'Fournisseur Test');
  await win.click('#modal-root #sf ~ .modal-actions #ok, #modal-root .modal-actions #ok');
  await win.waitForFunction(() => document.querySelectorAll('#modal-root .modal-bg').length === 2, null, { timeout: 8000 });
  const refusTxt = (await win.textContent('#modal-root .modal-bg:last-child .modal')).replace(/\s+/g, ' ');
  if (!/Offre Indépendant/.test(refusTxt) || !/Entreprise/.test(refusTxt) || !/lisible/.test(refusTxt)) throw new Error('le refus ne dit pas l\'offre et ce qui reste ouvert : ' + refusTxt.slice(0, 160));
  await win.click('#modal-root .modal-bg:last-child [data-close]');
  await win.waitForFunction(() => document.querySelectorAll('#modal-root .modal-bg').length === 1);
  await win.click('#modal-root [data-close]');
  await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
  const nApres = await win.evaluate(() => window.__data.suppliers.length);
  if (nApres !== nAvant) throw new Error('un fournisseur a été créé malgré l\'offre Indépendant');
  await aller('#/stats');
  await win.waitForSelector('#view .page-head');
  await win.waitForTimeout(300);
  if (await win.$('.offre-banner')) throw new Error('les Statistiques ne doivent porter aucun bandeau d\'offre');
  const titre = await win.textContent('#view h1');
  if (!/Statistiques/.test(titre)) throw new Error('la page Statistiques ne s\'est pas ouverte : ' + titre);
  j.ok('bandeau sur Achats, refus nommé sur un nouveau fournisseur, rien créé, cadenas sur Achats seulement, Statistiques libres');

  // ---------------------------------------------------- 5. la clé d'un autre
  j.etape('Une clé émise pour un autre matricule est refusée, en nommant les deux');
  const autre = await win.evaluate(() => window.skanfact.licenceEmettre({ nom: 'Pharmacie El Menzah', matricule: '7654321B/A/M/000', offre: 'entreprise', duree: '1a' }));
  if (/PRIVATE KEY/.test(JSON.stringify(autre))) throw new Error('licenceEmettre rend la clé privée');
  const refus = await win.evaluate(async ({ key, mf }) => { try { await window.skanfact.licenceSet(key, mf); return null; } catch (e) { return String(e.message || e); } }, { key: autre.key, mf: '1234567A/M/P/000' });
  if (!refus || !/7654321B/.test(refus) || !/1234567A/.test(refus)) throw new Error('la clé d\'une autre entreprise devrait être refusée en nommant les deux matricules : ' + refus);
  const encore = await win.evaluate(mf => window.skanfact.licenceStatus(mf), '1234567A/M/P/000');
  if (encore.state !== 'active' || encore.offre !== 'independant') throw new Error('le refus a écrasé la licence en place');
  j.ok('refusée : « ' + refus.slice(0, 90) + '… »');

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
  await win.waitForFunction(() => /^#\/doc\//.test(location.hash), null, { timeout: 15000 });
  await win.waitForTimeout(500);
  const apresRenouv = await win.evaluate(() => {
    const d = window.__data; const [a, b] = d.licences;
    return { n: d.licences.length, remplaceePar: a.remplaceePar, exp2: b.exp, remplace: b.remplace, factures: d.documents.filter(x => x.type === 'facture').length, rows: window.SkanCore.licenceRows(d).map(r => r.id + ':' + r.etat + ':' + r.renouvelee) };
  });
  if (apresRenouv.n !== 2 || apresRenouv.remplaceePar !== apresRenouv.rows[1].split(':')[0] && apresRenouv.remplaceePar !== apresRenouv.rows[0].split(':')[0]) throw new Error('la première licence ne pointe pas vers sa remplaçante : ' + JSON.stringify(apresRenouv));
  if (apresRenouv.exp2 !== '' || apresRenouv.remplace !== l1.id || apresRenouv.factures !== 2) throw new Error('renouvellement incomplet : ' + JSON.stringify(apresRenouv));
  await aller('#/licences');
  const garde2 = await win.waitForSelector('#modal-root #b', { timeout: 3000 }).catch(() => null);
  if (garde2) await garde2.click();
  await win.waitForSelector('#lic-wrap table');
  const pied = (await win.textContent('#lic-wrap tfoot')).replace(/\s+/g, ' ');
  if (!/2 licences/.test(pied)) throw new Error('le pied devrait compter 2 licences : ' + pied);
  j.ok('deux licences, deux factures, « à vie » sur la seconde, la première marquée renouvelée');

  console.log('\nerreurs JS : ' + bac.length);
  bac.slice(0, 6).forEach(e => console.log('  - ' + e));
  await Promise.race([app.close(), new Promise((_, rej) => setTimeout(() => rej(new Error('l\'application ne se ferme pas : un garde-fou de sortie attend une réponse')), 20000))]);
  if (bac.length) { console.error('>>> ÉCHEC'); process.exit(2); }
  console.log(`\n${j.total()} étapes — L'ÉDITEUR ET LES OFFRES : OK`);
})().catch(e => { console.error('\n✕ ÉCHEC : ' + (e.stack || e.message)); process.exit(1); });
