// Le plan de contrôle (8.4.0), de bout en bout : l'application réelle contre le VRAI worker.
//
// Ce que ce parcours prouve, dans l'ordre :
//   1. une clé émise en 8.0.0 — sans `kid` — est toujours acceptée ;
//   2. l'installation s'ANNONCE : la plateforme voit l'ordinateur, sa plateforme et sa version ;
//   3. une révocation signée, datée et adressée ferme la création — et laisse tout le reste ouvert ;
//   4. la même révocation SANS signature valable est ignorée ;
//   5. la même révocation REJOUÉE (signée, mais vieille de trois mois) est ignorée ;
//   6. le serveur éteint : l'application fonctionne, sans un mot rouge à l'écran ;
//   7. une installation neuve SANS réseau du tout : l'assistant, la clé, et l'application démarre.
//
// Le serveur n'est pas une imitation : c'est `plateforme/skanfact-api.mjs`, le fichier déployé sur
// Cloudflare, posé derrière un `http.createServer` avec une base minimale. Une imitation écrite à
// côté du vrai finirait par en diverger, et c'est très exactement la divergence qu'on cherche à
// attraper — un champ nommé autrement, un `null` écrit `''`, et la signature paraît fausse sur une
// réponse parfaitement valide.
//
// Les deux altérations (signature abîmée, réponse rejouée) sont faites dans le TRANSPORT, entre le
// serveur et l'application : c'est là qu'un attaquant se place, pas dans le code du serveur.
//
//   xvfb-run -a node test/e2e/plateforme.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os'); const http = require('http');
const L = require('../../src/licence.js');
const { baseD1 } = require('../d1-sqlite');

(async () => {
  const j = journal(); const bac = [];
  const P = await import('../../plateforme/skanfact-api.mjs');

  // ---------- les clés : celles de l'éditeur imaginaire de ce test, jamais les vraies ----------
  const master = L.generateKeys();          // signe les licences (le rôle de la clé de Skander)
  const reponse = L.generateKeys();         // signe les réponses du serveur
  const srv = L.generateKeys();             // signe les ventes courantes depuis la console (P 0.2)
  const SECRET = 'secret-de-test-' + 'x'.repeat(20);
  const ADMIN = 'admin-de-test-' + 'y'.repeat(20);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-plateforme-'));
  const clesVides = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-cles-vides-'));
  // Le fichier que l'application embarque : la clé maître, et la clé qui vérifie les réponses.
  const fichierCles = path.join(tmp, 'licences-publiques.json');
  fs.writeFileSync(fichierCles, JSON.stringify({
    format: 2,
    cles: [{ kid: 'master', publicKey: master.publicKey, depuis: '2026-09-14' },
           { kid: 'srv-1', publicKey: srv.publicKey, depuis: '2026-09-15' }],
    reponse: { publicKey: reponse.publicKey, depuis: '2026-09-15' }
  }, null, 2));

  // ---------- le serveur : le vrai worker, une base minimale, et un transport qu'on peut abîmer ----
  const etatServeur = { alteration: null };

  // La base est la VRAIE : SQLite sur `plateforme/schema-a-coller.sql`, le fichier qu'on demande à
  // Skander de coller dans D1. Jusqu'à la 10.7.0, ce parcours portait une base écrite À LA MAIN —
  // un objet qui n'implémentait que `first()` et `run()`. C'est exactement ce que la 8.5.0 avait
  // condamné et corrigé pour `e2e:console` (« les tests ne rejouent plus le worker, ils le font
  // tourner »), et la leçon n'avait jamais été portée ici : le jumeau manquant (7.3.0), appliqué à
  // un INSTRUMENT. Le prix s'est payé en 10.5.0, quand `lireReglages` a commencé à appeler `.all()`
  // — le parcours est mort sur `env.DB.prepare(...).all is not a function`, et personne ne l'a vu,
  // parce qu'un parcours rouge qu'on ne relance pas cesse d'exister.
  const DB = baseD1();
  const sql = (q, ...a) => DB.prepare(q).bind(...a).run();
  const lire = (q, ...a) => DB.prepare(q).bind(...a).all().then(r => r.results || []);

  // L'empreinte que les étapes suivent, et les lignes que la plateforme connaît — posées par de
  // VRAIES écritures, celles que la console aurait faites en vendant. Sans la ligne de licence, le
  // serveur ne retrouverait rien et « pas de révocation » serait vrai pour une mauvaise raison.
  let empreinteSuivie = '';
  const suivre = async (cle, mf, offre) => {
    empreinteSuivie = L.empreinteCle(cle);
    const client = await lire('SELECT id FROM clients WHERE id = ?', 'cli_1');
    if (!client.length) {
      await sql('INSERT INTO clients (id, nom, matricule, cree_le) VALUES (?, ?, ?, ?)',
        'cli_1', 'Atelier Plateforme SUARL', mf, '2026-09-01T08:00:00.000Z');
    }
    const deja = await lire('SELECT id FROM licences WHERE empreinte = ?', empreinteSuivie);
    if (!deja.length) {
      await sql('INSERT INTO licences (id, client_id, kid, empreinte, offre, debut, fin, prix, devise, emise_le)'
        + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'lic_' + empreinteSuivie.slice(0, 8), 'cli_1', 'master', empreinteSuivie, offre || 'entreprise',
        '2026-09-01', '2027-09-01', 690, 'TND', '2026-09-01T08:00:00.000Z');
    }
  };
  // Poser et lever la révocation se font par de vraies écritures, comme la console les ferait.
  const revoquer = (oui, motif) => sql(
    'UPDATE licences SET revoquee_le = ?, revoquee_motif = ? WHERE empreinte = ?',
    oui ? '2026-10-01T00:00:00.000Z' : null, oui ? (motif || 'rétractation') : null, empreinteSuivie);
  // Les annonces ne sont plus poussées dans un tableau : elles sont LUES dans la table que le
  // worker écrit. C'est la moitié qui compte — un tableau nourri par une fausse base prouve que le
  // parcours sait intercepter un INSERT, pas que le worker sait en écrire un.
  const annoncesDeLaBase = () => lire('SELECT empreinte, device_id AS deviceId, device_nom AS deviceNom,'
    + ' plateforme, version, app, derniere_fois FROM activations ORDER BY rowid');

  const env = { DB, APP_SECRET: SECRET, ADMIN_SECRET: ADMIN, REPONSE_PRIVATE_KEY: reponse.privateKey, SRV_PRIVATE_KEY: srv.privateKey,
    LICENCE_PUBLIC_KEYS: JSON.stringify({ cles: [{ kid: 'master', publicKey: master.publicKey }, { kid: 'srv-1', publicKey: srv.publicKey }] }) };

  const serveur = http.createServer(async (req, res) => {
    const morceaux = [];
    req.on('data', c => morceaux.push(c));
    req.on('end', async () => {
      let reponseWorker;
      try {
        reponseWorker = await P.default.fetch(new Request('https://api.exemple.tn' + req.url, {
          method: req.method, headers: req.headers, body: morceaux.length ? Buffer.concat(morceaux) : undefined
        }), env);
      } catch (e) { res.writeHead(500); return res.end(String(e && e.message)); }
      let texte = await reponseWorker.text();

      // Les deux attaques, posées sur le fil.
      if (etatServeur.alteration === 'signature') {
        const o = JSON.parse(texte);
        // Un seul caractère : c'est tout ce qu'il faut, et c'est tout ce qu'un attaquant contrôle
        // s'il n'a pas la clé privée du serveur.
        if (o.signature) o.signature = (o.signature[0] === 'A' ? 'B' : 'A') + o.signature.slice(1);
        texte = JSON.stringify(o);
      } else if (etatServeur.alteration === 'rejeu') {
        // Une réponse que le serveur a VRAIMENT signée — il y a trois mois. C'est le rejeu : sans
        // la date dans le corps signé, elle serait indiscernable d'une réponse d'aujourd'hui.
        const o = JSON.parse(texte);
        const vieux = new Date(Date.now() - 90 * 86400000).toISOString();
        const resigne = await P.signerReponse(P.corpsReponse({
          sujet: o.sujet, etat: o.etat, contenu: { offre: o.offre, exp: o.exp, postes: o.postes },
          motif: o.motif, emisLe: vieux
        }), reponse.privateKey);
        texte = JSON.stringify({ ...resigne.corps, signature: resigne.signature });
      }
      res.writeHead(reponseWorker.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(texte);
    });
  });
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  const PORT = serveur.address().port;
  const BASE = `http://127.0.0.1:${PORT}`;

  // ---------- l'application ----------
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-pf-'));
  const envApp = { ...process.env, SKANFACT_DOSSIER_CLES: clesVides, SKANFACT_CLE_EMBARQUEE: fichierCles,
    SKANFACT_PLATEFORME_BASE: BASE, SKANFACT_PLATEFORME_SECRET: SECRET };
  let app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON, env: envApp });
  let win = await app.firstWindow(); surveiller(win, '', bac);

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
  // Coller la clé déclenche une annonce immédiate (`licence:set`), donc on attend que le serveur
  // l'ait vraiment reçue avant de juger — jamais un `waitForTimeout` au hasard.
  // Sur la VRAIE base, une annonce du même poste pour la même clé ne crée pas une ligne de plus :
  // elle MET À JOUR celle qui existe (c'est tout l'intérêt — on compte des ordinateurs, pas des
  // démarrages). La fausse base, elle, empilait un élément à chaque INSERT, et le parcours comptait
  // les lignes. On attend donc ce que la plateforme a vraiment enregistré : un poste de plus, OU le
  // même poste revu — `derniere_fois` qui bouge. C'est plus fidèle, et c'est ce qui l'a révélé.
  const vuPar = async () => {
    const r = await annoncesDeLaBase();
    return { n: r.length, dernier: r.map(x => x.empreinte + '@' + (x.derniere_fois || '')).join('|') };
  };
  const collerLaCle = async cle => {
    const avant = await vuPar();
    await ouvrirParametres('p-licence');
    await win.fill('#lic-key', cle);
    await win.click('#lic-save');
    let apres = avant;
    for (let i = 0; i < 100; i++) {
      apres = await vuPar();
      if (apres.n !== avant.n || apres.dernier !== avant.dernier) break;
      await win.waitForTimeout(100);
    }
    if (apres.n === avant.n && apres.dernier === avant.dernier) throw new Error('la plateforme n\'a jamais reçu l\'annonce');
    await win.waitForTimeout(200);   // le temps que le verdict soit écrit sur le disque
  };
  // Ce que l'application dit APRÈS avoir relu : le rechargement est le moment où un utilisateur
  // rouvre son logiciel, et c'est là que le verdict reçu entre en vigueur.
  const relireEtat = async () => {
    await win.reload();
    await win.waitForSelector('nav', { timeout: 20000 });
    await win.waitForTimeout(600);
    await ouvrirParametres('p-licence');
    return (await win.textContent('#p-licence')).replace(/\s+/g, ' ');
  };
  const rouge = async () => win.evaluate(() => {
    const t = document.getElementById('toast');
    return t && !t.hidden && t.classList.contains('err') ? t.textContent : '';
  });
  // Le geste qu'une licence peut fermer : créer une PIÈCE. Créer un client n'en est pas une — un
  // contact n'est pas un document comptable, et le garde-fou ne l'a jamais visé. C'est en écrivant
  // ce test que ça s'est vu : la première version cliquait « Nouveau client » et concluait que la
  // révocation ne bloquait rien.
  const tenterUnDevis = async () => {
    await aller('#/doc/new/devis');
    await win.waitForSelector('#lines input[data-k=label]', { timeout: 10000 });
    await win.evaluate(() => {
      const hid = document.querySelector('[data-combo=clientId] input[type=hidden]');
      hid.value = window.__data.clients[0].id;
      hid.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await win.fill('#lines input[data-k=label]', 'Prestation témoin');
    await win.fill('#lines input[data-k=unitPrice]', '1000');
    await win.waitForTimeout(260);
    const avant = await win.evaluate(() => window.__data.documents.length);
    await win.click('#save');
    await win.waitForTimeout(600);
    const modale = await win.$('#modal-root .modal');
    const titre = modale ? (await win.textContent('#modal-root .modal h2')).trim() : '';
    const apres = await win.evaluate(() => window.__data.documents.length);
    // On recharge plutôt que de naviguer : un brouillon refusé laisse l'éditeur « modifié », et le
    // garde-fou des modifications non enregistrées ferait échouer la navigation suivante trente
    // secondes plus tard, sur un sélecteur qui n'a rien à voir (piège 7.19.0).
    await win.reload();
    await win.waitForSelector('nav', { timeout: 20000 });
    await win.waitForTimeout(400);
    return { refus: apres === avant, titre, cree: apres > avant };
  };

  // Un client, parce qu'un devis en a besoin. Le créer n'est PAS un geste que la licence ferme :
  // un contact n'est pas une pièce comptable, et le garde-fou ne l'a jamais visé.
  const creerUnClient = async () => {
    await aller('#/clients');
    await win.waitForSelector('#new'); await win.click('#new');
    await win.waitForSelector('#modal-root input[name=name]');
    await win.fill('#modal-root input[name=name]', 'Menuiserie Trabelsi SUARL');
    await win.fill('#modal-root input[name=matricule]', '1234567A/M/P/000');
    await win.click('#modal-root .modal-actions .btn-primary');
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
  };

  const MF = '3344556Z/A/P/000';
  const cleValide = L.signLicence({
    nom: 'Atelier Plateforme SUARL', matricule: MF, offre: 'entreprise', exp: '2030-01-01', createdAt: L.today()
  }, master.privateKey);

  try {
    // ------------------------------------------------ 1. une clé de la 8.0.0, sans kid
    j.etape('Une clé émise en 8.0.0 — sans kid — reste acceptée');
    await traverserAssistant(win, 'Atelier Plateforme SUARL', MF);
    await creerUnClient();
    if (L.parseKey(cleValide).payload.kid) throw new Error('la clé du test ne doit porter aucun kid');
    await suivre(cleValide, MF, 'entreprise');
    await collerLaCle(cleValide);
    let txt = (await win.textContent('#p-licence')).replace(/\s+/g, ' ');
    if (!/Licence active/.test(txt)) throw new Error('la clé sans kid a été refusée : ' + txt.slice(0, 200));
    j.ok('acceptée par la clé maître, sans que la clé nomme laquelle');

    // ------------------------------------------------ 2. l'installation s'annonce
    j.etape('L\'installation s\'annonce : la plateforme voit l\'ordinateur');
    const toutes = await annoncesDeLaBase();
    const a = toutes[toutes.length - 1];
    if (!a || !a.deviceId) throw new Error('aucune activation enregistrée');
    if (a.empreinte !== L.empreinteCle(cleValide)) throw new Error('l\'empreinte annoncée ne désigne pas cette licence');
    if (!['darwin', 'win32', 'linux'].includes(a.plateforme)) throw new Error('plateforme non transmise : ' + a.plateforme);
    if (!/^\d+\.\d+\.\d+/.test(a.version || '')) throw new Error('version non transmise : ' + a.version);
    j.ok(`empreinte ${a.empreinte.slice(0, 8)}…, ${a.plateforme}, version ${a.version}`);
    j.ok('et rien d\'autre : ni client, ni facture, ni montant, ni chemin de dossier');

    // ------------------------------------------------ 3. une révocation signée ferme la création
    j.etape('Une révocation signée, datée et adressée ferme la création');
    await revoquer(true);
    await collerLaCle(cleValide);
    txt = await relireEtat();
    if (!/révoquée/i.test(txt)) throw new Error('la révocation n\'a pas été appliquée : ' + txt.slice(0, 200));
    if (!/rétractation/.test(txt)) throw new Error('le motif de la révocation n\'est pas affiché');
    j.ok('l\'écran dit « révoquée », avec le motif');
    const r3 = await tenterUnDevis();
    if (!r3.refus) throw new Error('un devis a pu être créé malgré la révocation');
    j.ok('créer un devis est refusé : « ' + r3.titre + ' »');
    // …et tout le reste reste ouvert. C'est la moitié qui compte le plus : jamais de données en otage.
    for (const page of ['#/factures', '#/compta', '#/clients']) {
      await aller(page);
      await win.waitForSelector('#view');
      if (await win.$('#modal-root .modal')) throw new Error('la lecture a été bloquée sur ' + page);
      const contenu = (await win.textContent('#view') || '').trim();
      if (contenu.length < 100) throw new Error('la page ' + page + ' est vide sous révocation');
    }
    j.ok('lire les factures, la comptabilité et les clients reste possible');

    // ------------------------------------------------ 3 bis. et elle se lève avec la même preuve
    j.etape('Lever la révocation exige exactement la même preuve que la poser');
    await revoquer(false);
    await collerLaCle(cleValide);
    txt = await relireEtat();
    if (!/Licence active/.test(txt)) throw new Error('la révocation n\'a pas été levée : ' + txt.slice(0, 200));
    j.ok('le serveur reprend sa révocation, et l\'application rouvre');

    // ------------------------------------------------ 3 ter. une clé vendue DEPUIS LA CONSOLE
    j.etape('Une clé émise par la console (srv-1) est acceptée par l\'application, et se révoque pareil');
    const emis = await fetch(BASE + '/v1/admin/licences', {
      method: 'POST', headers: { 'X-SkanFact-Admin': ADMIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'cli_1', offre: 'independant', duree: '1a', prix: 390 })
    }).then(r => r.json());
    if (!emis.cle) throw new Error('la console n\'a pas émis de clé : ' + JSON.stringify(emis));
    if ((L.parseKey(emis.cle).payload || {}).kid !== 'srv-1') throw new Error('la clé de la console doit nommer srv-1');
    // Celle-ci, la VRAIE route d'émission l'a déjà écrite en base : on la suit, on ne la réinsère
    // pas. C'est la moitié qui prouve que la console et l'application parlent de la même ligne.
    await suivre(emis.cle, MF, 'independant');
    await collerLaCle(emis.cle);
    txt = (await win.textContent('#p-licence')).replace(/\s+/g, ' ');
    if (!/Licence active/.test(txt)) throw new Error('la clé signée par le serveur a été refusée : ' + txt.slice(0, 200));
    if (!/Indépendant/.test(txt)) throw new Error('l\'offre écrite dans la clé n\'est pas celle affichée');
    j.ok('signée par srv-1, reconnue par la version qui embarque cette clé, offre Indépendant appliquée');
    await revoquer(true);
    await collerLaCle(emis.cle);
    txt = await relireEtat();
    if (!/révoquée/i.test(txt)) throw new Error('la révocation n\'atteint pas une clé vendue par la console : ' + txt.slice(0, 200));
    j.ok('et une révocation la ferme comme n\'importe quelle autre');
    await revoquer(false);
    // Les étapes suivantes reprennent la clé maître : on rebascule l'empreinte suivie, sinon on
    // révoquerait la licence de la console en croyant révoquer celle-là.
    await suivre(cleValide, MF, 'entreprise');

    // ------------------------------------------------ 4. signature abîmée → ignorée
    j.etape('La même révocation, signature abîmée : ignorée');
    await revoquer(true); etatServeur.alteration = 'signature';
    await collerLaCle(cleValide);
    txt = await relireEtat();
    if (/révoquée/i.test(txt)) throw new Error('une réponse mal signée a restreint l\'application');
    j.ok('un seul octet retouché, et la réponse ne restreint plus rien');
    const r4 = await tenterUnDevis();
    if (r4.refus) throw new Error('la création est restée fermée sur une réponse mal signée');
    j.ok('la création reste ouverte');

    // ------------------------------------------------ 5. réponse rejouée → ignorée
    j.etape('La même révocation, signée mais vieille de trois mois : ignorée');
    etatServeur.alteration = 'rejeu';
    await collerLaCle(cleValide);
    txt = await relireEtat();
    if (/révoquée/i.test(txt)) throw new Error('une réponse rejouée a restreint l\'application');
    j.ok('une réponse authentique mais périmée ne vaut rien : sans ça, on ressusciterait une révocation annulée');

    // ------------------------------------------------ 6. serveur éteint
    j.etape('Le serveur éteint : l\'application fonctionne, sans un mot rouge');
    etatServeur.alteration = null;
    await new Promise(r => serveur.close(r));
    await win.reload();
    await win.waitForSelector('nav', { timeout: 20000 });
    await win.waitForTimeout(1500);
    await ouvrirParametres('p-licence');
    txt = (await win.textContent('#p-licence')).replace(/\s+/g, ' ');
    if (!/Licence active/.test(txt)) throw new Error('le serveur éteint a changé l\'état de la licence : ' + txt.slice(0, 200));
    const msg = await rouge();
    if (msg) throw new Error('un message rouge est apparu alors que rien n\'est cassé : ' + msg);
    const r6 = await tenterUnDevis();
    if (r6.refus) throw new Error('la création a été fermée parce que le serveur ne répond pas');
    j.ok('licence active, création ouverte, aucun message : la panne du serveur n\'est pas la nôtre');
    await app.close();

    // ------------------------------------------------ 7. une installation neuve, sans réseau
    j.etape('Une installation neuve sans réseau : l\'assistant, la clé, et l\'application démarre');
    const userData2 = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-pf2-'));
    app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData2}`, RACINE], executablePath: ELECTRON, env: envApp });
    win = await app.firstWindow(); surveiller(win, 'hors-ligne', bac);
    await traverserAssistant(win, 'Atelier Hors Ligne SUARL', MF);
    await creerUnClient();
    await ouvrirParametres('p-licence');
    await win.fill('#lic-key', cleValide);
    await win.click('#lic-save');
    await win.waitForTimeout(2500);   // le temps que l'annonce échoue, sans réseau
    txt = (await win.textContent('#p-licence')).replace(/\s+/g, ' ');
    if (!/Licence active/.test(txt)) throw new Error('la clé ne s\'installe pas sans réseau : ' + txt.slice(0, 200));
    const msg7 = await rouge();
    if (msg7) throw new Error('un message rouge sur une première installation sans réseau : ' + msg7);
    const r7 = await tenterUnDevis();
    if (r7.refus) throw new Error('la création est fermée sur une installation qui n\'a jamais vu le serveur');
    j.ok('la clé s\'installe, la création est ouverte, et le serveur n\'a jamais été joint');

    if (bac.length) throw new Error('erreurs dans le renderer :\n' + bac.join('\n'));
    console.log(`\n${j.total()} étapes — le plan de contrôle tient : il n'accorde rien, il ne bloque que sur preuve, et son absence ne coûte rien.`);
  } finally {
    try { await app.close(); } catch {}
    try { serveur.close(); } catch {}
  }
})().catch(e => { console.error('\nÉCHEC :', e && e.message || e); process.exit(1); });
