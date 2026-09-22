'use strict';
// ============================================================================================
// L'espace de gestion des DEUX plateformes (10.4.0)
//
// Jusqu'ici la console ne voyait qu'une des deux applications : SkanFact seule s'annonçait, et
// l'app du comptable — qui porte pourtant sa licence depuis la 9.4.0 et son canal d'essai depuis
// la 9.1.0 — n'existait nulle part. Et rien ne rangeait la base : D1 est le SEUL endroit où vit
// « qui a acheté quelle clé », le contenu signé compris, celui qui permet de refabriquer une clé à
// l'identique (8.5.0). La perdre emporte toutes les ventes.
//
// Ce que ces tests tiennent : que les deux applications se comptent séparément, qu'une annonce
// d'avant la 10.4.0 reste comptée comme SkanFact, qu'« endormi » ne se confond pas avec « perdu »,
// que ce qui demande une décision se trie par urgence et jamais par ordre d'écriture, que l'export
// porte un compte par table, que la santé des canaux se DIT quand on ne peut pas la lire, et que
// ce qui part du Cabinet vers le plan de contrôle est exactement ce qui est écrit — rien de plus.
// La suite est ASYNCHRONE et chacun de ses `ta` est attendu : `ta()` sans `await` part détaché,
// son « ok » s'affiche après le total, et une assertion qui tombe ne fait plus échouer la commande
// (8.4.0). Le lanceur compte les `ta` en cours et refuse de conclure s'il en reste.
module.exports = async ({ t, ta, assert, lireSource }) => {
  const path = require('path');
  const fs = require('fs');
  const C = require('../../src/renderer/core.js');

  const API = () => import('../../plateforme/skanfact-api.mjs');
  const RELAIS = () => import('../../worker/skanfact-maj.mjs');

  // ------------------------------------------------------------------ le parc, des DEUX côtés

  await ta('10.4.0 : le parc sépare les deux applications, jamais une seule ligne pour les deux', async () => {
    const P = await API();
    const r = P.resumeParc([
      { app: 'entreprise', version: '10.3.0', plateforme: 'darwin', empreinte: 'a', derniere_fois: '2026-09-20T10:00:00Z' },
      { app: 'cabinet', version: '10.3.0', plateforme: 'darwin', empreinte: 'b', derniere_fois: '2026-09-20T10:00:00Z' }
    ], '2026-09-21');
    assert.strictEqual(r.length, 2, 'deux applications sur la même version font DEUX lignes');
    const noms = r.map(x => x.appNom).sort();
    assert.deepStrictEqual(noms, ['SkanFact', 'SkanFact Cabinet']);
    r.forEach(x => assert.strictEqual(x.postes, 1));
  });

  await ta('10.4.0 : une annonce sans « app » est comptée comme SkanFact (tout ce qui précède la 10.4.0)', async () => {
    const P = await API();
    // Avant la 10.4.0, seule l'app entreprise s'annonçait : une ligne sans `app` ne peut venir que
    // d'elle. La ranger ailleurs — ou l'écarter — ferait disparaître le parc historique.
    const r = P.resumeParc([{ version: '9.8.8', plateforme: 'win32', empreinte: 'x', derniere_fois: '2026-09-20T10:00:00Z' }], '2026-09-21');
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].app, 'entreprise');
    assert.strictEqual(P.appDe('mars'), 'entreprise', 'une valeur inconnue ne crée jamais une troisième application');
    assert.strictEqual(P.appDe('cabinet'), 'cabinet');
  });

  await ta('10.4.0 : « endormi » se compte À PART, il ne se retranche pas', async () => {
    const P = await API();
    // Une installation qu'on n'a pas vue depuis trente jours peut être un portable refermé pour les
    // vacances. La retrancher ferait passer un mois d'août pour un parc qui rétrécit.
    const r = P.resumeParc([
      { app: 'entreprise', version: '10.3.0', plateforme: 'darwin', empreinte: 'a', derniere_fois: '2026-09-20T10:00:00Z' },
      { app: 'entreprise', version: '10.3.0', plateforme: 'darwin', empreinte: 'b', derniere_fois: '2026-05-01T10:00:00Z' }
    ], '2026-09-21');
    assert.strictEqual(r[0].postes, 2, 'les deux postes comptent');
    assert.strictEqual(r[0].vus, 1);
    assert.strictEqual(r[0].endormis, 1);
    assert.strictEqual(r[0].vus + r[0].endormis, r[0].postes, 'la somme des deux EST le total : rien ne disparaît');
  });

  await ta('10.4.0 : une version se compare en nombres, et une préversion passe avant la sienne', async () => {
    const P = await API();
    // `10.3.0` est plus récent que `9.8.8`, ce qu'un tri de chaînes dit exactement à l'envers.
    assert.ok(P.compVersion('10.3.0', '9.8.8') > 0, '10.3.0 doit être plus récent que 9.8.8');
    assert.ok(P.compVersion('10.4.0-beta.1', '10.4.0') < 0, 'une préversion prépare sa version, elle ne la suit pas');
    assert.strictEqual(P.compVersion('10.3.0', '10.3.0'), 0);
    // Le tri du parc : la plus récente en tête, parce que la question est « combien l'ont déjà ? ».
    const r = P.resumeParc([
      { app: 'entreprise', version: '9.8.8', empreinte: 'a', derniere_fois: '2026-09-20T10:00:00Z' },
      { app: 'entreprise', version: '10.3.0', empreinte: 'b', derniere_fois: '2026-09-20T10:00:00Z' }
    ], '2026-09-21');
    assert.strictEqual(r[0].version, '10.3.0');
  });

  // ------------------------------------------------------------ ce qui demande une décision

  await ta('10.4.0 : les alertes se trient par URGENCE, jamais par ordre d\'écriture', async () => {
    const P = await API();
    // Les DONNÉES du test comptent autant que sa forme (9.6.1, 10.0.0) : la seule « alerte » est
    // produite en DERNIER par le code (la copie de la base s'écrit après les licences et les
    // ventes). Si l'ordre d'écriture décidait, elle finirait troisième — d'où ce jeu-là, et pas un
    // autre : avec une clé jamais envoyée en tête, la liste non triée serait déjà dans le bon ordre
    // et le test ne pourrait pas tomber.
    const l = P.alertesPlateforme({
      licences: [{ id: 'l1', client: 'A', envoyee_le: '2026-01-01', fin: '2026-09-25' }],
      ventes: [{ id: 'v1', client: 'B' }],
      dernierExport: ''
    }, '2026-09-21');
    assert.strictEqual(l.length, 3);
    assert.strictEqual(l[0].niveau, 'alerte', 'la copie de la base passe devant, quoique écrite en dernier');
    assert.strictEqual(l[0].id, 'exp:base');
    assert.ok(l.every((x, i) => i === 0 || ['alerte', 'attention', 'calme'].indexOf(l[i - 1].niveau) <= ['alerte', 'attention', 'calme'].indexOf(x.niveau)),
      'la liste doit être triée du plus urgent au moins urgent');
  });

  await ta('10.4.0 : une licence révoquée ou remplacée ne réclame plus rien', async () => {
    const P = await API();
    const l = P.alertesPlateforme({
      licences: [
        { id: 'l1', client: 'A', envoyee_le: '', revoquee_le: '2026-01-01', fin: '2026-09-25' },
        { id: 'l2', client: 'B', envoyee_le: '', remplacee_par: 'l3', fin: '2026-09-25' }
      ],
      ventes: [], dernierExport: '2026-09-20'
    }, '2026-09-21');
    assert.ok(!l.some(x => x.sujet === 'A'), 'une licence révoquée n\'a plus de clé à envoyer');
    assert.ok(!l.some(x => x.sujet === 'B'), 'une licence remplacée non plus : c\'est la remplaçante qui compte');
  });

  await ta('10.4.0 : la base jamais exportée est une ALERTE — mais seulement si elle porte quelque chose', async () => {
    const P = await API();
    // Une licence vendue, envoyée, en cours : rien d'autre à décider que la copie de la base.
    const vendue = [{ id: 'l1', client: 'A', envoyee_le: '2026-01-01', fin: '' }];
    const jamais = P.alertesPlateforme({ licences: vendue, ventes: [], dernierExport: '' }, '2026-09-21');
    assert.strictEqual(jamais.length, 1);
    assert.strictEqual(jamais[0].niveau, 'alerte', '« jamais » n\'est pas un retard, c\'est un filet qui n\'existe pas');
    const hier = P.alertesPlateforme({ licences: vendue, ventes: [], dernierExport: '2026-09-20' }, '2026-09-21');
    assert.strictEqual(hier.length, 0, 'un export d\'hier ne demande aucune décision');
    const vieux = P.alertesPlateforme({ licences: vendue, ventes: [], dernierExport: '2026-06-01' }, '2026-09-21');
    assert.strictEqual(vieux.length, 1);
    assert.strictEqual(vieux[0].niveau, 'attention');
    // Et l'univers vide : on vérifie qu'il y a quelque chose à perdre avant de crier (7.0.0). Une
    // console qu'on vient d'installer n'a rien vendu, et réclamer la copie du néant sur son premier
    // écran apprend à ignorer les alertes.
    assert.strictEqual(P.alertesPlateforme({ licences: [], ventes: [], dernierExport: '' }, '2026-09-21').length, 0,
      'une base où rien n\'a été vendu n\'a rien à perdre');
  });

  await ta('10.4.0 : chaque alerte nomme l\'onglet qui l\'ouvre', async () => {
    const P = await API();
    // Une alerte qu'on ne peut pas ouvrir est une inquiétude, pas une tâche (7.15.0). Les onglets
    // nommés doivent exister dans la console, sinon le bouton mène nulle part.
    // La table des écrans porte désormais, pour chacun, son groupe dans le rail, son titre de page
    // et ce à quoi il sert : `TITRES` en est DÉDUIT. Ce test lisait `TITRES` quand c'était une
    // liste plate ; il aurait continué de passer sur une liste vide (`{}`), donc sur rien. On lit
    // la source de vérité, et on vérifie d'abord qu'elle n'est pas vide — un test qui compare à une
    // liste vide accepte tout.
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'plateforme', 'skanfact-api.mjs'), 'utf8');
    const d = src.indexOf('var ECRANS = {');
    assert.ok(d > 0, 'la table des écrans de la console doit se lire');
    const bloc = src.slice(d, src.indexOf('\n  };', d));
    const onglets = [...bloc.matchAll(/^\s{4}(\w+): \{ g: /gm)].map(x => x[1]);
    assert.ok(onglets.length >= 8, 'huit écrans au moins : lus ' + onglets.length);
    const l = P.alertesPlateforme({
      licences: [{ id: 'l1', client: 'A', envoyee_le: '', fin: '2026-09-25' }],
      ventes: [{ id: 'v1', client: 'B' }], dernierExport: ''
    }, '2026-09-21');
    assert.ok(l.length >= 3);
    l.forEach(x => assert.ok(onglets.includes(x.onglet), 'onglet inconnu de la console : ' + x.onglet));
  });

  // ------------------------------------------------------------------------------ l'argent

  await ta('10.4.0 : l\'argent se groupe par DEVISE, et « encaissé » porte son année', async () => {
    const P = await API();
    const a = P.resumeArgent([
      { montant_ht: 690, devise: 'DT', payee_le: '2026-03-01' },
      { montant_ht: 390, devise: 'DT', payee_le: '2025-11-01' },   // l'an dernier : hors de l'année
      { montant_ht: 500, devise: 'DT', payee_le: '' },             // en attente, sans année
      { montant_ht: 200, devise: 'EUR', payee_le: '2026-04-01' }
    ], '2026-09-21');
    assert.strictEqual(a.annee, '2026');
    const dt = a.lignes.find(x => x.devise === 'DT');
    const eur = a.lignes.find(x => x.devise === 'EUR');
    // Additionner des dinars et des euros est la faute de la 7.16.0, et elle ne se voit pas.
    assert.ok(dt && eur, 'deux devises font DEUX lignes');
    assert.strictEqual(dt.encaisse, 690, 'la vente de l\'an dernier n\'entre pas dans l\'année en cours');
    assert.strictEqual(dt.attente, 500);
    assert.strictEqual(dt.nbAttente, 1);
    assert.strictEqual(eur.encaisse, 200);
    assert.strictEqual(eur.attente, 0);
    assert.strictEqual(P.resumeArgent([], '2026-09-21').lignes.length, 0, 'sans vente, aucune ligne à montrer');
  });

  // --------------------------------------------------------------------------- l'export

  await ta('10.4.0 : l\'export porte un COMPTE par table, et une table absente vaut 0', async () => {
    const P = await API();
    const e = P.enveloppeExport({ clients: [{ id: 'c1' }, { id: 'c2' }], licences: [{ id: 'l1' }] }, '2026-09-21T10:00:00Z');
    // Un export tronqué qui ressemble à un export complet est pire qu'un export absent : c'est ce
    // compte qui le dit au moment de le relire.
    assert.strictEqual(e.comptes.clients, 2);
    assert.strictEqual(e.comptes.licences, 1);
    assert.strictEqual(e.comptes.ventes, 0, 'une table absente vaut 0, jamais undefined');
    P.EXPORT_TABLES.forEach(n => assert.ok(Array.isArray(e.tables[n]), 'la table ' + n + ' doit être là, même vide'));
    assert.strictEqual(e.v, 1);
  });

  await ta('10.4.0 : l\'empreinte de l\'export ne porte pas sur elle-même', async () => {
    // Un manifeste ne peut pas contenir sa propre empreinte (6.1.0) : la somme est calculée sur
    // l'enveloppe, puis AJOUTÉE à côté. Le test relit la source parce que c'est l'ORDRE des deux
    // lignes qui fait la règle, et qu'une inversion ne se verrait nulle part.
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'plateforme', 'skanfact-api.mjs'), 'utf8');
    const i = src.indexOf('const texte = JSON.stringify(env1);');
    const j = src.indexOf('sha256: somme');
    assert.ok(i > 0 && j > i, 'la somme se calcule sur l\'enveloppe AVANT d\'y être ajoutée');
    assert.ok(!/JSON\.stringify\(\{ \.\.\.env1, sha256[^)]*\)\s*\)\s*;?\s*const somme/.test(src),
      'la somme ne doit jamais porter sur un objet qui la contient déjà');
  });

  await ta('10.4.0 : le journal se filtre, et un filtre inventé ne passe pas', async () => {
    const P = await API();
    const ok = P.clauseJournal({ client: 'cli_42', quoi: 'licence.revoquee', depuis: '2026-01-01' });
    assert.ok(/e\.client_id = \?/.test(ok.where) && /e\.quoi = \?/.test(ok.where) && /e\.quand >= \?/.test(ok.where));
    assert.deepStrictEqual(ok.args, ['cli_42', 'licence.revoquee', '2026-01-01']);
    // Ce qui vient de l'extérieur se valide AVANT de toucher au SQL (6.8.1).
    const sale = P.clauseJournal({ client: "x' OR 1=1 --", quoi: 'DROP TABLE', depuis: '2026-13-99' });
    assert.strictEqual(sale.where, '', 'aucun filtre inventé ne doit entrer dans la requête');
    assert.strictEqual(sale.args.length, 0);
    assert.strictEqual(P.clauseJournal({}).where, '', 'sans filtre, la clause est vide');
  });

  await ta('10.4.0 : une date impossible se REFUSE, elle ne fait pas tomber le worker', async () => {
    const P = await API();
    // « 2026-13-99 » passe la forme et ne fait pas une date : `toISOString` LÈVE dessus. Avant ce
    // correctif, un jour tapé de travers dans le champ de date libre de la console ne rendait pas
    // un refus — il rendait un 500. Trouvé en écrivant le test du filtre de journal, jamais
    // autrement : aucun écran ne montre une exception du worker.
    ['2026-13-99', '2026-02-30', '9999-99-99'].forEach(d => {
      assert.strictEqual(P.dateValide(d), false, d + ' doit être refusée, pas levée');
    });
    assert.strictEqual(P.dateValide('2026-02-28'), true);
    assert.strictEqual(P.expirationPour('2026-01-01', 'date', '2026-13-99'), null);
  });

  // ------------------------------------------------------------- la santé des canaux

  await ta('10.4.0 : un index STABLE servi par une préversion n\'est jamais servi', async () => {
    const R = await RELAIS();
    const rels = [
      { tag_name: 'v10.4.0-beta.1', prerelease: true, published_at: '2026-09-21', assets: [{ name: 'latest.yml' }, { name: 'beta.yml' }] },
      { tag_name: 'v10.3.0', prerelease: false, published_at: '2026-09-20', assets: [{ name: 'latest.yml' }] }
    ];
    const c = R.resumeCanaux(rels);
    const latest = c.find(x => x.fichier === 'latest.yml');
    // C'est le défaut de la 9.8.8, celui qui a proposé une bêta à toutes les installations stables.
    assert.strictEqual(latest.tag, 'v10.3.0', 'le latest.yml d\'une préversion ne doit jamais être servi');
    assert.strictEqual(latest.prerelease, false);
    const beta = c.find(x => x.fichier === 'beta.yml');
    assert.strictEqual(beta.tag, 'v10.4.0-beta.1', 'le canal d\'essai, lui, sert bien la préversion');
    assert.strictEqual(beta.essai, true);
  });

  await ta('10.4.0 : un canal que rien ne sert est MUET, et il se dit', async () => {
    const R = await RELAIS();
    const c = R.resumeCanaux([{ tag_name: 'v10.3.0', prerelease: false, assets: [{ name: 'latest.yml' }] }]);
    const mac = c.find(x => x.fichier === 'latest-mac.yml');
    assert.strictEqual(mac.servi, false, 'un index qu\'aucune release ne porte rend 404 chez le client');
    assert.strictEqual(mac.tag, '');
    // Les deux canaux du Cabinet sont là aussi : c'est la moitié qu'on ne regardait jamais.
    assert.ok(c.some(x => x.canal === 'cabinet' && x.fichier === 'cabinet.yml'));
    assert.ok(c.some(x => x.canal === 'cabinet' && x.fichier === 'cabinet-beta.yml'));
  });

  await ta('10.4.0 : le verdict des canaux dit l\'alerte, pas un vert rassurant', async () => {
    const P = await API();
    const melange = P.verdictCanaux([{ fichier: 'latest.yml', essai: false, servi: true, prerelease: true }]);
    assert.strictEqual(melange.niveau, 'alerte');
    assert.ok(/préversion/.test(melange.phrase), melange.phrase);
    const muet = P.verdictCanaux([
      { fichier: 'latest.yml', essai: false, servi: true, prerelease: false },
      { fichier: 'latest-mac.yml', essai: false, servi: false, prerelease: false }
    ]);
    assert.strictEqual(muet.niveau, 'attention');
    assert.ok(/latest-mac\.yml/.test(muet.phrase), muet.phrase);
    const bon = P.verdictCanaux([{ fichier: 'latest.yml', essai: false, servi: true, prerelease: false }]);
    assert.strictEqual(bon.niveau, 'calme');
  });

  await ta('10.4.0 : sans relais branché, la console le DIT au lieu d\'afficher un vert', async () => {
    const P = await API();
    const s = await P.santeCanaux({});
    assert.strictEqual(s.ok, false);
    assert.ok(/RELAIS_BASE/.test(s.raison), 'la raison doit nommer le réglage qui manque : ' + s.raison);
    assert.deepStrictEqual(s.canaux, [], 'on n\'invente aucun canal quand on ne peut pas les lire');
    assert.ok(!s.verdict, 'pas de verdict sans mesure');
  });

  // ------------------------------------------------- ce que le Cabinet envoie, et rien d'autre

  t('10.4.0 : ce qui part du Cabinet au plan de contrôle est exactement ce qui est écrit', () => {
    const src = lireSource('src', 'cabinet', 'main.js');
    const i = src.indexOf('async function annoncerPlateforme()');
    assert.ok(i > 0, 'le Cabinet doit savoir s\'annoncer');
    const zone = src.slice(i, i + 2500);
    const m = /JSON\.stringify\(\{([\s\S]{0,400}?)\}\)/.exec(zone);
    assert.ok(m, 'le corps de l\'annonce doit se lire');
    const champs = m[1].split(',').map(x => x.split(':')[0].trim()).filter(Boolean).sort();
    // L'app du comptable détient la comptabilité de dizaines d'entreprises. Un jour quelqu'un
    // voudra « juste ajouter » un compteur de dossiers pour s'y retrouver : c'est ce test qui doit
    // l'arrêter. Rien d'un client, rien d'un dossier, rien d'un chiffre.
    assert.deepStrictEqual(champs, ['app', 'cle', 'deviceId', 'deviceNom', 'plateforme', 'version'].sort());
    assert.ok(/app: 'cabinet'/.test(zone), 'le Cabinet doit se nommer, sinon il est compté comme SkanFact');
  });

  t('10.4.0 : le Cabinet ne s\'annonce qu\'APRÈS l\'ouverture', () => {
    // Avant, il n'y a pas de clé de licence à présenter : le poste s'annoncerait comme un essai
    // alors qu'il est peut-être sous licence.
    //
    // Le test ne regarde PAS « ce qui précède cab:unlock » : une première version le faisait, et un
    // appel posé plus bas dans le fichier — au chargement du module, par exemple — lui échappait en
    // silence. Un test trop étroit laisse passer le défaut aussi sûrement qu'un test trop large en
    // accuse un qui n'existe pas (9.4.7, 9.8.8). On juge donc CHAQUE point d'appel : il vit dans un
    // des deux handlers qui viennent de charger l'état, et dans aucun autre.
    const src = lireSource('src', 'cabinet', 'main.js');
    const PORTES = ['cab:unlock', 'cab:adopt'];
    const appels = [];
    const re = /demarrerPlateforme\(\)/g;
    let m;
    while ((m = re.exec(src))) {
      // La déclaration elle-même n'est pas un appel.
      if (/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index))) continue;
      appels.push(m.index);
    }
    assert.ok(appels.length >= 2, 'les deux portes doivent armer l\'annonce (' + appels.length + ' appel(s))');
    const handlers = [...src.matchAll(/ipcMain\.handle\('([^']+)'/g)].map(h => ({ i: h.index, nom: h[1] }));
    const vues = new Set();
    appels.forEach(i => {
      const avant = handlers.filter(h => h.i < i).pop();
      assert.ok(avant && PORTES.includes(avant.nom),
        'un appel à demarrerPlateforme() vit hors des portes qui chargent l\'état : ' + ((avant && avant.nom) || 'au niveau du module'));
      vues.add(avant.nom);
    });
    PORTES.forEach(p => assert.ok(vues.has(p), p + ' doit armer l\'annonce'));
  });

  t('10.4.0 : SkanFact nomme aussi son application', () => {
    const src = lireSource('src', 'main.js');
    const i = src.indexOf('async function annoncerPlateforme()');
    assert.ok(i > 0);
    assert.ok(/app: 'entreprise'/.test(src.slice(i, i + 1500)),
      'sans ce champ, le parc mélangerait les deux applications sur la même ligne de version');
  });

  // ------------------------------------------------- l'export côté SkanFact

  t('10.4.0 : l\'export de la base se range à côté des clés, en 0600', () => {
    const src = lireSource('src', 'main.js');
    const i = src.indexOf("ipcMain.handle('pont:exporterBase'");
    assert.ok(i > 0, 'le handler d\'export doit exister');
    const zone = src.slice(i, i + 1600);
    assert.ok(/CLES_DIR\(\)/.test(zone), 'le fichier va dans ~/.skanfact/, jamais dans les données ni dans une sauvegarde');
    assert.ok(/mode: 0o600/.test(zone), 'il porte la liste des clients et des ventes de l\'éditeur');
    assert.ok(/renameSync/.test(zone), 'écriture atomique : un export à moitié écrit ressemble à un export');
  });

  t('10.4.0 : l\'export jamais fait se réclame tout de suite', () => {
    const jamais = C.exportConsoleAFaire({}, '2026-09-21');
    assert.strictEqual(jamais.reclame, true, '« jamais » n\'est pas un retard : le filet n\'existe pas');
    assert.strictEqual(jamais.du, '');
    assert.strictEqual(C.exportConsoleAFaire({ exportConsole: '2026-09-20' }, '2026-09-21').reclame, false);
    const vieux = C.exportConsoleAFaire({ exportConsole: '2026-06-01' }, '2026-09-21');
    assert.strictEqual(vieux.reclame, true);
    assert.strictEqual(vieux.jours, 112);
  });

  t('10.4.0 : la ligne « À faire » de l\'export ne vit que chez l\'éditeur', () => {
    // Chez un client, elle parlerait d'une console qu'il n'a pas.
    const base = { ...C.DEFAULT_DATA, licences: [] };
    const chez = C.todoList(JSON.parse(JSON.stringify(base)), {}, '2026-09-21', {});
    assert.ok(!chez.some(x => x.id === 'console-export'), 'aucune ligne d\'éditeur chez un client');
    const ed = C.todoList(JSON.parse(JSON.stringify(base)), {}, '2026-09-21', { editeur: true });
    assert.ok(ed.some(x => x.id === 'console-export'), 'sur le poste de l\'éditeur, la ligne existe');
  });

  // ------------------------------------------------- la base : la colonne, et la route

  await ta('10.4.0 : une annonce du Cabinet est écrite comme telle, et le parc les sépare', async () => {
    const { baseD1 } = require('../d1-sqlite');
    const P = await API();
    const ADMIN = 'Z'.repeat(30), APP = 'app-secret-zzzzzzzzzzzz';
    const db = baseD1();
    const env = { DB: db, ADMIN_SECRET: ADMIN, APP_SECRET: APP };
    try {
      const annonce = (app, version) => P.default.fetch(new Request('https://x/v1/licence/etat', {
        method: 'POST', headers: { 'x-skanfact-app': APP, 'content-type': 'application/json' },
        body: JSON.stringify({ cle: '', deviceId: 'poste-' + app + '-1234', deviceNom: 'Mac', plateforme: 'darwin', version, app })
      }), env);
      assert.strictEqual((await annonce('cabinet', '10.4.0')).status, 200);
      assert.strictEqual((await annonce('entreprise', '10.3.0')).status, 200);
      const lignes = db.lire('SELECT app, version FROM activations ORDER BY app');
      assert.deepStrictEqual(lignes.map(x => x.app), ['cabinet', 'entreprise'],
        'la colonne app doit être ÉCRITE : sans elle, la moitié du parc est invisible');
      const r = await P.default.fetch(new Request('https://x/v1/admin/parc', { headers: { 'x-skanfact-admin': ADMIN } }), env);
      const j = await r.json();
      assert.strictEqual(r.status, 200);
      assert.strictEqual(j.lignes.length, 2);
      assert.deepStrictEqual(j.lignes.map(x => x.appNom).sort(), ['SkanFact', 'SkanFact Cabinet']);
    } finally { db.fermer(); }
  });

  await ta('10.4.0 : l\'export écrit sa trace dans le journal, et c\'est elle qui date l\'alerte', async () => {
    const { baseD1 } = require('../d1-sqlite');
    const P = await API();
    const ADMIN = 'W'.repeat(30);
    const db = baseD1();
    const env = { DB: db, ADMIN_SECRET: ADMIN };
    try {
      // Une vente, pour que la base ait quelque chose à perdre : sur une console où rien n'a été
      // vendu, la copie n'est pas réclamée (on vérifie que l'univers est non vide, 7.0.0).
      db.lire("INSERT INTO clients (id, nom, cree_le) VALUES ('cli_1', 'Menuiserie', '2026-01-01')");
      db.lire("INSERT INTO licences (id, client_id, kid, empreinte, offre, debut, emise_le, envoyee_le)"
        + " VALUES ('lic_1', 'cli_1', 'srv-1', 'abc', 'independant', '2026-01-01', '2026-01-01', '2026-01-02')");
      const avant = await P.default.fetch(new Request('https://x/v1/admin/alertes', { headers: { 'x-skanfact-admin': ADMIN } }), env);
      const ja = await avant.json();
      // La route rend désormais des alertes GROUPÉES : on reconnaît la ligne à ce qu'elle DIT, pas
      // à un identifiant interne que le repli a dû recomposer. Et on vérifie que le repli n'a rien
      // jeté — l'identifiant d'origine vit dans `ids`.
      const expBase = ja.lignes.find(x => /jamais été exportée/.test(x.quoi));
      assert.ok(expBase && expBase.niveau === 'alerte', 'avant tout export, l\'alerte est là');
      assert.ok(expBase.ids.includes('exp:base'), 'le groupe garde l\'identifiant de son alerte');

      const r = await P.default.fetch(new Request('https://x/v1/admin/export', { headers: { 'x-skanfact-admin': ADMIN } }), env);
      assert.strictEqual(r.status, 200);
      assert.ok(/attachment; filename=/.test(r.headers.get('content-disposition') || ''), 'l\'export se télécharge');
      const j = await r.json();
      assert.ok(j.sha256 && j.sha256.length === 64, 'l\'export porte son empreinte');
      assert.ok(j.comptes && typeof j.comptes.licences === 'number');

      const evt = db.lire("SELECT quoi FROM evenements WHERE quoi = 'base.exportee'");
      assert.strictEqual(evt.length, 1, 'l\'export laisse une trace : c\'est elle qui date l\'alerte');
      const apres = await P.default.fetch(new Request('https://x/v1/admin/alertes', { headers: { 'x-skanfact-admin': ADMIN } }), env);
      const jb = await apres.json();
      assert.ok(!jb.lignes.some(x => x.id === 'exp:base'), 'la base vient d\'être exportée : plus rien à décider');
    } finally { db.fermer(); }
  });

  await ta('10.4.0 : les nouvelles routes existent, et une route inventée reste refusée', async () => {
    const P = await API();
    ['parc', 'cabinets', 'alertes', 'sante', 'export'].forEach(a => {
      assert.ok(P.routeApi('/v1/admin/' + a), 'la route ' + a + ' doit être connue');
    });
    assert.strictEqual(P.routeApi('/v1/admin/vider'), null, 'tout le reste est refusé avant de regarder qui demande');
    assert.strictEqual(P.routeApi('/v1/admin/export/../..'), null);
  });

  await ta('10.4.0 : l\'activation ne retient jamais une application inconnue', async () => {
    const P = await API();
    assert.strictEqual(P.nettoyerActivation({ deviceId: 'abcdefgh', app: 'cabinet' }).app, 'cabinet');
    assert.strictEqual(P.nettoyerActivation({ deviceId: 'abcdefgh', app: 'pirate' }).app, 'entreprise');
    assert.strictEqual(P.nettoyerActivation({ deviceId: 'abcdefgh' }).app, 'entreprise');
  });

  // ---------------------------------------------------------------- le relais, sa porte

  t('10.4.0 : /sante passe AVANT le filtre de route, et derrière le secret', () => {
    const src = lireSource('worker', 'skanfact-maj.mjs');
    const i = src.indexOf("url.pathname === '/sante'");
    const j = src.indexOf('const r = route(url.pathname);');
    assert.ok(i > 0 && j > i, '/sante ne fait qu\'un segment : après route(), il rendrait 404');
    const k = src.indexOf('async function servirSante');
    const zone = src.slice(k, k + 900);
    assert.ok(/memeSecret\(request\.headers\.get\('x-skanfact-app'\)/.test(zone),
      'même porte que les fichiers : sans elle, n\'importe qui brûle le quota GitHub');
    assert.ok(/APP_SECRET/.test(zone));
  });

  // ---------------------------------------------------------------- 10.4.1 : ce qu'on PUBLIE

  // Le 22/09/2026, la ligne de santé — branchée depuis dix minutes — annonçait « 2 canaux stables
  // muets : latest-linux.yml, cabinet-linux.yml ». Vrai au pied de la lettre, et faux comme
  // signal : aucune construction ne produit de fichier Linux. Un orange qui ne peut jamais
  // s'éteindre apprend à ignorer la barre entière (8.0.1), et l'instrument accusait du code juste
  // (9.4.7). Ce que `attendus` sépare : ce que le relais a le DROIT de servir, et ce que le projet
  // PUBLIE.
  await ta('10.4.1 : « attendus » du relais = les ATTENDUS du workflow de publication', async () => {
    const R = await RELAIS();
    const wf = lireSource('.github/workflows', 'release.yml');
    const listes = [...wf.matchAll(/ATTENDUS="([^"]+)"/g)].map(m => m[1].trim().split(/\s+/));
    assert.strictEqual(listes.length, 2,
      'le workflow doit porter exactement deux listes ATTENDUS (bêta, stable) — ' + listes.length + ' trouvée(s)');
    const duWorkflow = [...new Set(listes.flat())].sort();
    const duRelais = Object.keys(R.CANAUX)
      .flatMap(c => R.CANAUX[c].attendus || []).sort();
    assert.deepStrictEqual(duRelais, duWorkflow,
      'deux tables séparées divergent, toujours (6.8.0) : le relais et le workflow doivent nommer ' +
      'les MÊMES index attendus.\n  relais   : ' + duRelais.join(' ') + '\n  workflow : ' + duWorkflow.join(' '));
    // Et la preuve que la distinction sert à quelque chose : `yml` est plus large qu'`attendus`.
    for (const c of Object.keys(R.CANAUX)) {
      const sup = R.CANAUX[c].yml.filter(f => !R.CANAUX[c].attendus.includes(f));
      assert.ok(sup.length, 'canal ' + c + ' : `yml` doit rester plus permissif qu\'`attendus`');
      assert.ok(sup.every(f => /-linux\.yml$/.test(f)),
        'canal ' + c + ' : seuls les index Linux sont permis sans être attendus, ' + sup.join(', ') + ' trouvés');
    }
  });

  await ta('10.4.1 : un index qu\'on ne publie pas ne compte pas comme un canal muet', async () => {
    const P = await API();
    // Le cas réel du 22/09/2026 : les quatre index attendus servent, les deux Linux ne servent
    // pas — parce qu'ils n'existent pas.
    const lignes = [
      { fichier: 'latest.yml', essai: false, attendu: true, servi: true, prerelease: false },
      { fichier: 'latest-mac.yml', essai: false, attendu: true, servi: true, prerelease: false },
      { fichier: 'latest-linux.yml', essai: false, attendu: false, servi: false, prerelease: false },
      { fichier: 'cabinet.yml', essai: false, attendu: true, servi: true, prerelease: false },
      { fichier: 'cabinet-mac.yml', essai: false, attendu: true, servi: true, prerelease: false },
      { fichier: 'cabinet-linux.yml', essai: false, attendu: false, servi: false, prerelease: false },
      { fichier: 'beta.yml', essai: true, attendu: true, servi: true, prerelease: true }
    ];
    const v = P.verdictCanaux(lignes);
    assert.strictEqual(v.niveau, 'calme', 'les Linux ne se publient pas : rien à signaler — ' + v.phrase);
    assert.ok(/ 4 /.test(v.phrase), 'quatre canaux stables attendus, pas six : ' + v.phrase);

    // Et l'autre sens : un index VRAIMENT attendu qui ne sert pas doit toujours crier.
    const manque = lignes.map(c => c.fichier === 'latest-mac.yml' ? { ...c, servi: false } : c);
    const v2 = P.verdictCanaux(manque);
    assert.strictEqual(v2.niveau, 'attention', 'un index attendu et muet reste un avertissement');
    assert.ok(v2.phrase.includes('latest-mac.yml'), v2.phrase);
  });

  await ta('10.4.1 : un relais d\'AVANT ne rend pas la ligne muette', async () => {
    const P = await API();
    // Pas de champ `attendu` : c'est ce que renvoie un relais non redéployé. On préfère qu'il juge
    // trop que de se taire — un instrument muet annonce que tout va bien (9.8.8, T-55).
    const vieux = [
      { fichier: 'latest.yml', essai: false, servi: true, prerelease: false },
      { fichier: 'latest-mac.yml', essai: false, servi: true, prerelease: false }
    ];
    const v = P.verdictCanaux(vieux);
    assert.strictEqual(v.niveau, 'calme');
    assert.ok(/ 2 /.test(v.phrase), 'les deux lignes doivent être jugées, pas ignorées : ' + v.phrase);
  });

  await ta('10.4.1 : resumeCanaux marque « attendu » sur les bons fichiers', async () => {
    const R = await RELAIS();
    const lignes = R.resumeCanaux([]);
    const att = lignes.filter(c => c.attendu).map(c => c.fichier).sort();
    assert.deepStrictEqual(att,
      ['beta-mac.yml', 'beta.yml', 'cabinet-beta-mac.yml', 'cabinet-beta.yml',
        'cabinet-mac.yml', 'cabinet.yml', 'latest-mac.yml', 'latest.yml'].sort());
    assert.ok(lignes.some(c => !c.attendu), 'les Linux doivent rester DANS la réponse, marqués non attendus');
    assert.ok(lignes.every(c => 'servi' in c && 'essai' in c), 'la forme d\'une ligne ne change pas');
  });

  // ---------------------------------------------------------------- les alertes groupées (9.4.6)
  await ta('console : une explication qui décrit la RÈGLE se replie, une qui nomme un FAIT reste', async () => {
    const P = await API();
    const brutes = [
      { niveau: 'alerte', quoi: 'Clé jamais envoyée', sujet: 'Trabelsi', detail: 'La licence est signée et n\'est jamais partie.', onglet: 'licences' },
      { niveau: 'alerte', quoi: 'Clé jamais envoyée', sujet: 'El Amen', detail: 'La licence est signée et n\'est jamais partie.', onglet: 'licences' },
      { niveau: 'alerte', quoi: 'Clé jamais envoyée', sujet: 'Ben Youssef', detail: 'La licence est signée et n\'est jamais partie.', onglet: 'licences' },
      // Deux licences expirées : même titre, mais le détail nomme une DATE différente. Les replier
      // ferait disparaître une information — ce n'est pas une explication redite, c'est un fait.
      { niveau: 'attention', quoi: 'Licence expirée', sujet: 'Trabelsi', detail: 'Finie le 2026-09-01.', onglet: 'licences' },
      { niveau: 'attention', quoi: 'Licence expirée', sujet: 'El Amen', detail: 'Finie le 2026-07-15.', onglet: 'licences' }
    ];
    const g = P.grouperAlertes(brutes);
    assert.strictEqual(g.length, 3, 'trois clés jamais envoyées font UNE ligne, deux dates différentes en font deux');
    assert.strictEqual(g[0].n, 3);
    assert.strictEqual(g[0].sujets, 'Trabelsi, El Amen, Ben Youssef');
    assert.strictEqual(g[1].n, 1, 'une expiration datée ne se replie pas avec l\'autre');
    assert.strictEqual(g[2].n, 1);
    // L'ordre de `alertesPlateforme` (niveau puis quoi) doit survivre au groupement.
    assert.deepStrictEqual(g.map(x => x.niveau), ['alerte', 'attention', 'attention']);
    // Rien ne se perd : chaque groupe garde son onglet, donc « Ouvrir » sait où aller (7.15.0).
    assert.ok(g.every(x => x.onglet && x.detail && x.quoi), 'un groupe garde de quoi s\'afficher ET s\'ouvrir');
  });

  await ta('console : au-delà de trois sujets on COMPTE le reste, on ne l\'énumère pas', async () => {
    const P = await API();
    const cinq = ['A', 'B', 'C', 'D', 'E'].map(s => ({
      niveau: 'attention', quoi: 'Vente à encaisser', sujet: s, detail: 'Licence livrée, rien d\'encaissé.', onglet: 'ventes'
    }));
    const g = P.grouperAlertes(cinq);
    assert.strictEqual(g.length, 1);
    assert.strictEqual(g[0].n, 5);
    assert.strictEqual(g[0].sujets, 'A, B, C et 2 autres');
    // Le singulier s'accorde : « et 1 autre », jamais « et 1 autres » (Cabinet 1.0.0).
    assert.strictEqual(P.grouperAlertes(cinq.slice(0, 4))[0].sujets, 'A, B, C et 1 autre');
    // Le même client deux fois ne se nomme qu'une fois, mais compte deux fois.
    const bis = P.grouperAlertes([cinq[0], cinq[0], cinq[1]]);
    assert.strictEqual(bis[0].sujets, 'A, B');
    assert.strictEqual(bis[0].n, 3, 'le compte suit les occurrences, pas les noms distincts');
  });
};
