// Le pont comptable (8.7.0), de bout en bout : la console vend, SkanFact facture.
//
// Ce que ce parcours prouve, dans l'ordre :
//   1. le poste de l'éditeur BRANCHE la console en collant le secret d'administration — essayé tout
//      de suite, refusé s'il est faux, jamais écrit dans les données ;
//   2. la page Licences TIRE les ventes sans facture et crée un BROUILLON par vente (le client
//      retrouvé par matricule, ou créé) — sans numéro, et pas deux fois ;
//   3. une licence vendue par la console ne se renouvelle ni ne se révoque ici ;
//   4. à l'émission, le numéro est RENDU à la console : la vente sort de la liste, la base le porte ;
//   5. la console éteinte : la page Licences le dit en français, rien ne plante.
//
// Le serveur n'est pas une imitation : c'est `plateforme/skanfact-api.mjs`, le fichier déployé sur
// Cloudflare, posé derrière un `http.createServer` avec une vraie base SQLite sur le vrai schéma.
//
//   xvfb-run -a node test/e2e/pont.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os'); const http = require('http');
const L = require('../../src/licence.js');
const { baseD1 } = require('../d1-sqlite');

(async () => {
  const j = journal(); const bac = [];
  const P = await import('../../plateforme/skanfact-api.mjs');

  // ---------- les clés : celles de l'éditeur imaginaire de ce test, jamais les vraies ----------
  const master = L.generateKeys();
  const srv = L.generateKeys();
  const SECRET = 'secret-de-test-' + 'x'.repeat(20);
  const ADMIN = 'admin-de-test-' + 'y'.repeat(20);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-pont-'));
  // La clé PRIVÉE de l'éditeur du test, dans un dossier isolé : c'est elle qui met le poste en état
  // « éditeur » — et la publique embarquée est la sienne, donc il n'a ni essai ni verrou (8.0.0).
  const cles = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-cles-pont-'));
  fs.writeFileSync(path.join(cles, 'licence-privee.pem'), master.privateKey, { mode: 0o600 });
  const fichierCles = path.join(tmp, 'licences-publiques.json');
  fs.writeFileSync(fichierCles, JSON.stringify({
    format: 2,
    cles: [{ kid: 'master', publicKey: master.publicKey, depuis: '2026-09-14' },
           { kid: 'srv-1', publicKey: srv.publicKey, depuis: '2026-09-15' }],
    reponse: null
  }, null, 2));

  // ---------- le serveur : le vrai worker, une vraie base ----------
  const db = baseD1();
  const env = { DB: db, ADMIN_SECRET: ADMIN, APP_SECRET: SECRET, SRV_PRIVATE_KEY: srv.privateKey,
    LICENCE_PUBLIC_KEYS: JSON.stringify([{ kid: 'master', publicKey: master.publicKey }, { kid: 'srv-1', publicKey: srv.publicKey }]) };
  let eteint = false;
  const serveur = http.createServer((req, res) => {
    const morceaux = [];
    req.on('data', c => morceaux.push(c));
    req.on('end', async () => {
      if (eteint) { req.socket.destroy(); return; }
      let rep;
      try {
        rep = await P.default.fetch(new Request('https://api.exemple.tn' + req.url, {
          method: req.method, headers: req.headers, body: morceaux.length ? Buffer.concat(morceaux) : undefined
        }), env);
      } catch (e) { res.writeHead(500); return res.end(String(e && e.message)); }
      const texte = await rep.text();
      res.writeHead(rep.status, { 'Content-Type': rep.headers.get('Content-Type') || 'application/json' });
      res.end(texte);
    });
  });
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${serveur.address().port}`;
  const admin = async (m, p2, corps) => {
    const r = await P.default.fetch(new Request('https://x' + p2, { method: m, headers: { 'x-skanfact-admin': ADMIN }, body: corps ? JSON.stringify(corps) : undefined }), env);
    return { status: r.status, j: await r.json() };
  };

  // Deux ventes dans la console AVANT d'ouvrir SkanFact : un client qui existe déjà dans SkanFact
  // (même matricule, autre graphie), payé ; et un client inconnu, pas encore payé.
  const MF_TRABELSI = '1234567A/M/P/000';
  const c1 = await admin('POST', '/v1/admin/clients', { nom: 'Menuiserie Trabelsi', matricule: '1234567A', email: 'contact@trabelsi.tn' });
  const c2 = await admin('POST', '/v1/admin/clients', { nom: 'Pharmacie El Amen', matricule: '7654321B', email: 'pharmacie@elamen.tn' });
  if (c1.status !== 201 || c2.status !== 201) throw new Error('la console refuse les clients : ' + JSON.stringify([c1.j, c2.j]));
  const v1 = await admin('POST', '/v1/admin/licences', { clientId: c1.j.client.id, offre: 'entreprise', duree: '1a', prix: 690, payeeLe: '2026-09-14', moyen: 'virement' });
  const v2 = await admin('POST', '/v1/admin/licences', { clientId: c2.j.client.id, offre: 'independant', duree: '1a', prix: 390, remise: 20 });
  if (v1.status !== 201 || v2.status !== 201) throw new Error('la console refuse les ventes : ' + JSON.stringify([v1.j, v2.j]));

  // ---------- l'application ----------
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-pont-ud-'));
  const envApp = { ...process.env, SKANFACT_DOSSIER_CLES: cles, SKANFACT_CLE_EMBARQUEE: fichierCles,
    SKANFACT_PLATEFORME_BASE: BASE, SKANFACT_PLATEFORME_SECRET: SECRET };
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON, env: envApp });
  const win = await app.firstWindow(); surveiller(win, '', bac);

  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(350); };
  const ouvrirParametres = async panneau => {
    await aller('#/parametres');
    await win.waitForSelector('#set-tabs');
    const onglet = await win.evaluate(id => { const p = document.getElementById(id); const s = p && p.closest('[data-pane]'); return s ? s.dataset.pane : null; }, panneau);
    if (!onglet) throw new Error('panneau introuvable dans les Paramètres : ' + panneau);
    await win.click(`#set-tabs button[data-tab="${onglet}"]`);
    await win.waitForSelector('#' + panneau, { state: 'visible', timeout: 8000 });
    await win.waitForTimeout(250);
  };
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
  const texte = async sel => (await win.textContent(sel)).replace(/\s+/g, ' ');
  const toastDit = async () => { const t = await win.$('#toast'); return t ? (await t.textContent()).replace(/\s+/g, ' ') : ''; };

  // ---------------------------------------------------- 0. une entreprise et un client existant
  j.etape('L\'entreprise de l\'éditeur, et un client qui existe déjà (Trabelsi, autre graphie du matricule)');
  await traverserAssistant(win, 'Éditeur SkanFact SUARL', '9988776C/A/M/000');
  await aller('#/clients');
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#modal-root .modal');
  await win.fill('#modal-root input[name=name]', 'Menuiserie Trabelsi SUARL');
  await win.fill('#modal-root input[name=matricule]', MF_TRABELSI);
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
  const etat0 = await win.evaluate(async () => ({ st: await window.skanfact.licenceStatus(''), pont: await window.skanfact.pontStatus() }));
  if (etat0.st.state !== 'editeur') throw new Error('le poste devrait être en état éditeur : ' + JSON.stringify(etat0.st));
  if (!etat0.pont.editeur || etat0.pont.configure || etat0.pont.base !== BASE) throw new Error('état du pont inattendu au départ : ' + JSON.stringify(etat0.pont));
  j.ok('poste éditeur, client Trabelsi créé, pont pas encore branché');

  // ---------------------------------------------------- 1. brancher la console
  j.etape('Brancher la console : un secret faux est refusé, le bon est essayé et gardé hors des données');
  await ouvrirParametres('p-editeur');
  let bloc = await texte('#editeur-panel');
  if (!/Pas encore branché/.test(bloc) || !await win.$('#ed-pont-secret')) throw new Error('le panneau du pont manque ou ne dit pas « pas encore branché » : ' + bloc.slice(-300));
  if (await win.$('#lic-console')) throw new Error('le bloc console ne doit exister que sur la page Licences');
  await win.fill('#ed-pont-secret', 'un-secret-faux-mais-assez-long-pour-passer');
  await win.click('#ed-pont-save');
  await win.waitForTimeout(1200);
  const refus = await toastDit();
  if (!/refuse ce secret/.test(refus)) throw new Error('un secret faux doit être refusé en français : ' + refus);
  if (fs.existsSync(path.join(cles, 'plateforme-admin.json'))) throw new Error('un secret refusé ne doit pas rester écrit');
  if ((await win.evaluate(() => window.skanfact.pontStatus())).configure) throw new Error('un secret refusé ne doit pas passer pour branché');
  bloc = await texte('#editeur-panel');
  if (/Branché/.test(bloc.replace('Pas encore branché', ''))) throw new Error('un secret refusé ne doit pas afficher « Branché »');
  await win.fill('#ed-pont-secret', ADMIN);
  await win.click('#ed-pont-save');
  await win.waitForFunction(() => /Branché/.test((document.querySelector('#editeur-panel') || {}).textContent || '') && !/Pas encore branché/.test((document.querySelector('#editeur-panel') || {}).textContent || ''), null, { timeout: 8000 });
  const fichierSecret = path.join(cles, 'plateforme-admin.json');
  if (!fs.existsSync(fichierSecret)) throw new Error('le secret n\'a pas été écrit à côté des clés');
  if (process.platform !== 'win32' && (fs.statSync(fichierSecret).mode & 0o077)) throw new Error('le fichier du secret est lisible par d\'autres comptes');
  const donnees = fs.readFileSync(path.join(userData, 'dossiers', fs.readdirSync(path.join(userData, 'dossiers'))[0], 'skanfact-data.json'), 'utf8');
  if (donnees.includes(ADMIN)) throw new Error('le secret d\'administration est dans les DONNÉES');
  if (!await win.$('#ed-pont-ventes')) throw new Error('le bouton « Voir les ventes à facturer » manque une fois branché');
  if (await win.$('#ed-pont-import')) throw new Error('sans licence émise ici, « Envoyer l\'historique » n\'a rien à envoyer et ne doit pas s\'afficher');
  j.ok('secret faux refusé, bon secret gardé en 0600 à côté des clés, absent des données');

  // ---------------------------------------------------- 2. les ventes → des brouillons
  j.etape('La page Licences tire les deux ventes et crée un brouillon par vente');
  await win.click('#ed-pont-ventes');
  await win.waitForSelector('#lic-console-brouillons', { timeout: 10000 });
  bloc = await texte('#lic-console');
  if (!/2 ventes sans facture/.test(bloc)) throw new Error('les deux ventes devraient être listées : ' + bloc);
  if (!/Menuiserie Trabelsi/.test(bloc) || !/Pharmacie El Amen/.test(bloc)) throw new Error('les deux clients doivent être nommés : ' + bloc);
  if ((bloc.match(/nouveau client/g) || []).length !== 1) throw new Error('un seul des deux clients est nouveau (Trabelsi existe, autre graphie) : ' + bloc);
  if (!/14\/09\/2026 · virement/.test(bloc) || !/pas encore/.test(bloc)) throw new Error('la vente payée et la vente impayée doivent se distinguer : ' + bloc);
  const nAvant = await win.evaluate(() => ({ docs: window.__data.documents.length, clients: window.__data.clients.length, lic: window.__data.licences.length }));
  await win.click('#lic-console-brouillons');
  await win.waitForTimeout(800);
  const apres = await win.evaluate(() => {
    const d = window.__data;
    const docs = d.documents.filter(x => x.venteConsoleId);
    return {
      docs: d.documents.length, clients: d.clients.length, lic: d.licences.length,
      brouillons: docs.map(x => ({ number: x.number, status: x.status, clientId: x.clientId, prix: x.lines[0].unitPrice, tva: x.lines[0].vatRate, remise: x.discountRate, licenceId: x.licenceId, label: x.lines[0].label })),
      licences: d.licences.map(l => ({ id: l.id, origine: l.origine, key: (l.key || '').slice(0, 6), invoiceId: l.invoiceId, envoyee: l.envoyeeConsoleLe, payee: l.payeeConsoleLe })),
      trabelsi: d.clients.filter(c => /Trabelsi/.test(c.name)).length,
      elamen: d.clients.find(c => /El Amen/.test(c.name))
    };
  });
  if (apres.docs !== nAvant.docs + 2 || apres.brouillons.length !== 2) throw new Error('deux brouillons attendus : ' + JSON.stringify(apres.brouillons));
  if (apres.brouillons.some(b => b.number || b.status !== 'brouillon')) throw new Error('un brouillon ne porte pas de numéro : ' + JSON.stringify(apres.brouillons));
  if (apres.trabelsi !== 1) throw new Error('Trabelsi (même matricule, autre graphie) ne doit pas être créé une seconde fois : ' + apres.trabelsi);
  if (!apres.elamen || apres.elamen.matricule !== '7654321B' || apres.elamen.email !== 'pharmacie@elamen.tn') throw new Error('la Pharmacie El Amen devait être créée avec matricule et email : ' + JSON.stringify(apres.elamen));
  const bTrab = apres.brouillons.find(b => b.prix === 690), bAmen = apres.brouillons.find(b => b.prix === 312);
  if (!bTrab || !bAmen) throw new Error('les montants HT de la console doivent être repris tels quels (690, et 390 − 20 % = 312) : ' + JSON.stringify(apres.brouillons));
  if (bTrab.tva !== 19 || !/Entreprise/.test(bTrab.label) || !/Indépendant/.test(bAmen.label)) throw new Error('TVA du régime et libellé de l\'offre attendus : ' + JSON.stringify(apres.brouillons));
  if (apres.licences.length !== 2 || apres.licences.some(l => l.origine !== 'console' || l.key !== 'SKAN1.' || !l.invoiceId)) throw new Error('deux licences miroir, origine console, avec leur clé et leur facture : ' + JSON.stringify(apres.licences));
  // Sans clé Resend dans ce test, la console n'a envoyé aucun mail : le miroir ne doit PAS dire
  // « envoyée » — il sait en revanche que la vente est payée.
  const miroirTrab = apres.licences.find(l => l.id === v1.j.licence.id);
  if (miroirTrab.envoyee) throw new Error('la console n\'a rien envoyé (pas de service de mail) : le miroir ne doit pas l\'affirmer');
  if (miroirTrab.payee !== '2026-09-14') throw new Error('le miroir doit porter la date de paiement de la console : ' + JSON.stringify(miroirTrab));
  // Une seconde ouverture ne refait pas les brouillons.
  await aller('#/dashboard'); await aller('#/licences');
  await win.waitForFunction(() => /déjà créés|Aucune vente/.test((document.querySelector('#lic-console') || {}).textContent || ''), null, { timeout: 10000 });
  bloc = await texte('#lic-console');
  if (await win.$('#lic-console-brouillons')) throw new Error('les ventes déjà tirées ne doivent pas se proposer une seconde fois : ' + bloc);
  if (!/2 brouillons déjà créés/.test(bloc)) throw new Error('la page doit dire que les brouillons existent et mener vers eux : ' + bloc);
  const docsApres = await win.evaluate(() => window.__data.documents.filter(x => x.venteConsoleId).length);
  if (docsApres !== 2) throw new Error('rouvrir la page a refait des brouillons : ' + docsApres);
  j.ok('2 brouillons (690 et 312 HT, sans numéro), Trabelsi retrouvé, El Amen créée, 2 licences miroir — et pas deux fois');

  // ---------------------------------------------------- 3. le menu d'une licence de la console
  j.etape('Une licence vendue par la console ne se renouvelle ni ne se révoque ici');
  await win.waitForSelector('#lic-wrap .row-actions button');
  await win.click('#lic-wrap tbody tr:first-child .row-actions .row-menu-btn');
  await win.waitForSelector('.row-menu', { timeout: 3000 });
  const menu = await win.evaluate(() => {
    const m = document.querySelector('.row-menu');
    return m ? [...m.querySelectorAll('button .rm-l')].map(b => b.textContent.trim()) : null;
  });
  if (!menu) throw new Error('le menu d\'actions de la ligne ne s\'ouvre pas');
  if (menu.some(l => /Renouveler|Révoquer|Changer l'offre|Corriger/.test(l))) throw new Error('le menu offre un geste qui appartient à la console : ' + menu.join(' | '));
  if (!menu.some(l => /Voir la clé/.test(l)) || !menu.some(l => /Ouvrir la facture/.test(l))) throw new Error('voir la clé et ouvrir la facture doivent rester : ' + menu.join(' | '));
  await win.keyboard.press('Escape'); await win.waitForTimeout(200);
  j.ok('menu : ' + menu.join(' · '));

  // ---------------------------------------------------- 4. émettre → le numéro est rendu
  j.etape('Émettre la facture de Trabelsi : le numéro est rendu à la console, la vente sort de la liste');
  const idTrab = await win.evaluate(() => window.__data.documents.find(x => x.venteConsoleId && x.lines[0].unitPrice === 690).id);
  await aller('#/doc/' + idTrab);
  await win.waitForSelector('#issue');
  await win.click('#issue');
  const okVisible = await win.waitForSelector('#modal-root #ok', { timeout: 4000 }).catch(() => null);
  if (!okVisible) {
    const diag = await win.evaluate(() => ({ toast: (document.querySelector('#toast') || {}).textContent, refus: (document.querySelector('.refus, .invalid, [aria-invalid="true"]') || {}).outerHTML, modal: (document.querySelector('#modal-root') || {}).innerHTML, hash: location.hash, issue: !!document.querySelector('#issue') }));
    throw new Error('la confirmation d\'émission ne s\'ouvre pas : ' + JSON.stringify(diag).slice(0, 1200));
  }
  await win.click('#modal-root #ok');
  await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
  await win.waitForTimeout(1500);
  const emise = await win.evaluate(id => { const d = window.__data.documents.find(x => x.id === id); return { number: d.number, annoncee: d.factureeAnnoncee }; }, idTrab);
  if (!/^FAC-\d{4}-\d{3}$/.test(emise.number)) throw new Error('la facture n\'a pas reçu de numéro : ' + JSON.stringify(emise));
  if (!emise.annoncee) throw new Error('le numéro n\'a pas été annoncé à la console à l\'émission');
  const enBase = db.lire('SELECT facture_skanfact FROM ventes WHERE id = ?', v1.j.vente.id)[0];
  if (!enBase || enBase.facture_skanfact !== emise.number) throw new Error('la console ne porte pas le numéro rendu : ' + JSON.stringify(enBase));
  if (!db.lire("SELECT id FROM evenements WHERE quoi = 'vente.facturee'").length) throw new Error('le journal de la console ne note pas le numéro reçu');
  const restantes = await admin('GET', '/v1/admin/ventes?non_facturees=1');
  if (restantes.j.lignes.length !== 1 || restantes.j.lignes[0].id !== v2.j.vente.id) throw new Error('seule la vente d\'El Amen devrait rester sans facture : ' + JSON.stringify(restantes.j.lignes.map(l => l.id)));
  j.ok(`${emise.number} rendue à la console · il reste la vente d'El Amen`);

  // ---------------------------------------------------- 5. la console éteinte
  j.etape('Console éteinte : la page Licences le dit, en français, et l\'application reste entière');
  eteint = true;
  await aller('#/dashboard'); await aller('#/licences');
  await win.waitForFunction(() => /ne répond pas/.test((document.querySelector('#lic-console') || {}).textContent || ''), null, { timeout: 20000 });
  bloc = await texte('#lic-console');
  if (/Error|ECONNRESET|socket|hang up/i.test(bloc)) throw new Error('un message brut remonte à l\'écran : ' + bloc);
  if (!await win.$('#lic-wrap table')) throw new Error('l\'historique local doit rester lisible sans la console');
  const fautes = bac.filter(m => /PAGEERROR/.test(m));
  if (fautes.length) throw new Error('erreurs JavaScript pendant le parcours :\n' + fautes.join('\n'));
  j.ok('« La console ne répond pas : … », l\'historique reste');

  await Promise.race([app.close(), new Promise((_, rej) => setTimeout(() => rej(new Error('l\'application ne se ferme pas : un garde-fou de sortie attend une réponse')), 20000))]);
  serveur.close(); db.fermer();
  console.log(`\n✓ pont comptable : ${j.total()} étapes`);
  process.exit(0);
})().catch(e => { console.error('\n✗ ' + (e && e.stack || e)); process.exit(1); });
