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
      // 10.6.0 — la vente porte un MONTANT. Une vente à zéro n'a rien à encaisser et sort des
      // alertes (une licence de cabinet part à zéro tant que les tarifs du Cabinet ne sont pas
      // fixés) : sans prix, cette ligne ne produirait plus d'alerte et le test compterait deux
      // au lieu de trois. Les DONNÉES d'un test comptent autant que sa forme (9.6.1, 10.0.0).
      ventes: [{ id: 'v1', client: 'B', montant_ht: 390 }],
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
      ventes: [{ id: 'v1', client: 'B', montant_ht: 390 }], dernierExport: ''
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
    // La règle vaut pour CHAQUE endroit qui empreint un export — il y en a deux depuis la 10.5.0
    // (le bouton, et la copie automatique de nuit). Une assertion ancrée sur la première
    // occurrence venue jugeait un seul des deux, et l'ordre des fonctions dans le fichier
    // décidait lequel : c'est exactement la tranche qui se périme quand une fonction déménage.
    const sites = [...src.matchAll(/const (\w+) = hex\(await crypto\.subtle\.digest\('SHA-256', enc\.encode\((\w+)\)\)\);/g)];
    assert.ok(sites.length >= 2, 'les deux chemins d\'export doivent empreindre : ' + sites.length);
    sites.forEach(m => {
      const nom = m[2];
      const decl = src.lastIndexOf('const ' + nom + ' = ', m.index);
      assert.ok(decl > 0, 'la variable empreinte (' + nom + ') doit être déclarée juste avant');
      const ligne = src.slice(decl, src.indexOf('\n', decl));
      assert.ok(/JSON\.stringify\(/.test(ligne), 'on empreint une sérialisation, pas autre chose : ' + ligne.trim());
      assert.ok(!/sha256/.test(ligne), 'la somme ne doit jamais porter sur un objet qui la contient déjà : ' + ligne.trim());
      // …et elle est AJOUTÉE à côté, après coup.
      assert.ok(/sha256: somme/.test(src.slice(m.index, m.index + 600)), 'la somme se range à côté de l\'enveloppe');
    });
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

  // `app` ENTRE dans la clé d'unicité. Sans elle, deux applications qui partagent une identité de
  // poste se battent pour la même ligne : la seconde ÉCRASE la première, et le parc perd une moitié
  // en silence. Ça tenait par accident — chaque application a son propre dossier `userData`, donc
  // son propre deviceId — mais un accident n'est pas un garde-fou.
  //
  // Et COALESCE, jamais `app` nu : dans un index UNIQUE de SQLite, deux NULL sont DISTINCTS. Sur la
  // clé nue, une annonce de l'app entreprise arrivant sur une ligne d'AVANT la 10.4.0 (app NULL) ne
  // trouverait aucun conflit et créerait un DOUBLON — le poste compterait deux fois, et le premier
  // chiffre que cette version existe pour donner serait faux.
  await ta('10.4.0-beta.3 : deux applications sur un poste font deux lignes, et l\'ancienne se met à jour', async () => {
    const { baseD1 } = require('../d1-sqlite');
    const P = await API();
    const ADMIN = 'K'.repeat(30), APP = 'app-secret-kkkkkkkkkkkk';
    const db = baseD1();
    const env = { DB: db, ADMIN_SECRET: ADMIN, APP_SECRET: APP };
    try {
      // Un identifiant de poste est un UUID tiré au hasard par l'application (src/main.js) : le
      // test en pose un vrai. Une chaîne de fantaisie est REFUSÉE par `nettoyerActivation` — et
      // refusée, elle n'écrit rien du tout, donc le test passerait à côté de ce qu'il mesure.
      const POSTE = '3f9a2c1e-4b5d-4e77-9a10-2c1e4b5d4e77';
      const annonce = (app, version) => P.default.fetch(new Request('https://x/v1/licence/etat', {
        method: 'POST', headers: { 'x-skanfact-app': APP, 'content-type': 'application/json' },
        body: JSON.stringify({ cle: '', deviceId: POSTE, deviceNom: 'Le Mac', plateforme: 'darwin', version, app })
      }), env);

      // Le cas de Skander : les deux applications sur le même Mac.
      assert.strictEqual((await annonce('entreprise', '10.4.0')).status, 200);
      assert.strictEqual((await annonce('cabinet', '10.4.0')).status, 200);
      assert.strictEqual(db.lire('SELECT id FROM activations').length, 2,
        'deux applications sur un poste sont deux postes du parc, pas un seul');

      // La même application qui se réannonce met SA ligne à jour, elle n'en crée pas une seconde.
      assert.strictEqual((await annonce('cabinet', '10.4.1')).status, 200);
      const lignes = db.lire('SELECT app, version FROM activations ORDER BY app');
      assert.strictEqual(lignes.length, 2, 'une réannonce met à jour, elle ne duplique pas');
      assert.strictEqual(lignes.find(x => x.app === 'cabinet').version, '10.4.1',
        '`derniere_fois` et la version sont les seuls champs qui se réécrivent');
      assert.strictEqual(lignes.find(x => x.app === 'entreprise').version, '10.4.0',
        'et la ligne de l\'AUTRE application ne bouge pas');

      // Le cas dangereux : une ligne d'AVANT la 10.4.0, écrite quand l'app entreprise était seule à
      // s'annoncer et que la colonne n'existait pas. Elle vaut 'entreprise' — ce qu'elle est
      // vraiment — donc l'annonce suivante la MET À JOUR au lieu de doubler le poste.
      const ANCIEN = '0011aabb-ccdd-4eff-8899-001122334455';
      db.lire("INSERT INTO activations (id, empreinte, device_id, device_nom, version, app, premiere_fois, derniere_fois)"
        + " VALUES ('act_vieux', 'ESSAI', '" + ANCIEN + "', 'Vieux PC', '9.8.8', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')");
      const r = await P.default.fetch(new Request('https://x/v1/licence/etat', {
        method: 'POST', headers: { 'x-skanfact-app': APP, 'content-type': 'application/json' },
        body: JSON.stringify({ cle: '', deviceId: ANCIEN, deviceNom: 'Vieux PC', plateforme: 'win32', version: '10.4.0', app: 'entreprise' })
      }), env);
      assert.strictEqual(r.status, 200);
      const anciennes = db.lire("SELECT id, app, version FROM activations WHERE device_id = '" + ANCIEN + "'");
      assert.strictEqual(anciennes.length, 1,
        'une ligne d\'avant la colonne n\'est pas un second poste : COALESCE la range du côté de l\'entreprise');
      assert.strictEqual(anciennes[0].id, 'act_vieux', 'c\'est bien la ligne d\'origine qui se met à jour');
      assert.strictEqual(anciennes[0].version, '10.4.0');
    } finally { db.fermer(); }
  });

  // L'écran qui répond à « lequel de ces deux postes est le Cabinet ? » est celui des Activations,
  // et c'était très exactement celui qui ne le disait pas : le champ était écrit en base depuis la
  // 10.4.0 et affiché NULLE PART. Une donnée enregistrée et jamais affichée n'existe pas (7.21.0),
  // et ici elle manquait à l'écran fait pour le diagnostic.
  //
  // Les TROIS moitiés se tiennent, et aucune ne suffit : la colonne déclarée, la requête qui la
  // remplit, et la route qui rend le champ. Retirer `a.app` du SELECT laisserait la colonne dire
  // « SkanFact » pour toujours — juste en apparence, faux pour toujours.
  await ta('10.4.0-beta.3 : l\'écran des Activations dit QUELLE application, et la route la lui donne', async () => {
    const { baseD1 } = require('../d1-sqlite');
    const P = await API();
    const ADMIN = 'Q'.repeat(30), APP = 'app-secret-qqqqqqqqqqqq';
    const db = baseD1();
    const env = { DB: db, ADMIN_SECRET: ADMIN, APP_SECRET: APP };
    try {
      // La colonne est DÉCLARÉE sur l'écran.
      const src = fs.readFileSync(path.join(__dirname, '..', '..', 'plateforme', 'skanfact-api.mjs'), 'utf8');
      const i = src.indexOf('    activations: [');
      assert.ok(i > 0, 'les colonnes de l\'écran Activations sont introuvables');
      const cols = src.slice(i, src.indexOf('\n    ],', i));
      // La borne dit ce que la tranche NE contient PAS, pas combien elle pèse : un nombre se
      // « répare » en le changeant, donc il ne prouve rien (7.13.0). Ce qu'on garde, c'est
      // qu'elle s'arrête avant l'écran suivant — sinon elle jugerait les colonnes d'un autre
      // tableau et resterait verte sur celui-ci (7.21.0).
      assert.ok(!/^\s{4}[a-z]+: \[/m.test(cols.slice(20)), 'la tranche déborde sur l\'écran suivant');
      assert.ok(/\{ k: 'appNom', t: 'Application' \}/.test(cols),
        'sans colonne Application, l\'écran du diagnostic ne dit pas laquelle des deux applications');
      // Et elle lit le NOM rendu par le serveur : `APPS` et `appDe` vivent dans le module, pas
      // dans la page. Les appeler depuis le gabarit lève une ReferenceError PENDANT sa
      // construction — l'écran reste sur « Chargement… », rien en console, et la colonne n'est
      // jamais dessinée (7.22.0). C'est `e2e:console` qui l'a attrapé, jamais la relecture.
      assert.ok(!/APPS\[|appDe\(/.test(cols),
        'la page ne doit appeler aucune fonction du module : elle affiche ce que la route lui donne');

      // Et la route la REMPLIT : deux applications s'annoncent, la route rend le champ pour les deux.
      const annonce = app => P.default.fetch(new Request('https://x/v1/licence/etat', {
        method: 'POST', headers: { 'x-skanfact-app': APP, 'content-type': 'application/json' },
        body: JSON.stringify({
          cle: '', deviceId: '77aa1122-3344-4556-8899-aabbccdd' + (app === 'cabinet' ? '11' : '22'),
          deviceNom: 'Mac', plateforme: 'darwin', version: '10.4.0', app
        })
      }), env);
      await annonce('entreprise');
      await annonce('cabinet');
      const r = await P.default.fetch(new Request('https://x/v1/admin/activations', { headers: { 'x-skanfact-admin': ADMIN } }), env);
      const j = await r.json();
      assert.strictEqual(r.status, 200);
      assert.strictEqual(j.lignes.length, 2);
      assert.deepStrictEqual(j.lignes.map(x => x.app).sort(), ['cabinet', 'entreprise'],
        'la route doit RENDRE l\'application : sans elle, la colonne dirait « SkanFact » pour toujours');
      assert.deepStrictEqual(j.lignes.map(x => x.appNom).sort(), ['SkanFact', 'SkanFact Cabinet'],
        'et son NOM, parce que c\'est le serveur qui nomme et la page qui affiche');
    } finally { db.fermer(); }
  });

  // ------------------------------------------------------------------ relancer un client

  // C'était le seul geste commercial que la console ne savait pas faire : elle signe, elle envoie
  // la clé, elle encaisse — et devant « licence qui se termine dans douze jours », il n'y avait
  // rien à cliquer. Un écran qui NOMME une échéance doit porter le geste qui va avec (7.15.0).
  await ta('10.4.0-beta.3 : une relance se COMPOSE, elle ne s\'envoie pas toute seule', async () => {
    const P = await API();
    const fin = P.mailRelance('fin', { client: 'Trabelsi Informatique', email: 'a@b.tn', offre: 'Indépendant', fin: '2026-10-14' });
    assert.strictEqual(fin.a, 'a@b.tn');
    // Le client lit une date FRANÇAISE : une date ISO dans un mail commercial donne l'impression
    // d'un envoi automatique, ce que ce mail n'est justement pas.
    assert.ok(/14\/10\/2026/.test(fin.corps) && /14\/10\/2026/.test(fin.sujet),
      'la date doit être lisible par un client : ' + fin.sujet);
    assert.ok(!/2026-10-14/.test(fin.corps + fin.sujet), 'aucune date ISO dans un mail');
    assert.ok(fin.corps.startsWith('Bonjour Trabelsi Informatique,'));
    assert.ok(/Indépendant/.test(fin.corps), 'l\'offre du client est un fait de sa ligne');
    // La promesse du produit se répète ici, parce que c'est le moment où le client se demande ce
    // qu'il perd : jamais de données en otage (6.4.0).
    assert.ok(/lisibles, imprimables et exportables/.test(fin.corps));

    // Rien ne s'invente : ce qui manque DISPARAÎT de la phrase, il n'est pas remplacé par un vide.
    const nu = P.mailRelance('fin', {});
    assert.strictEqual(nu.a, '');
    assert.ok(nu.corps.startsWith('Bonjour,'), 'sans nom, on ne salue pas un blanc');
    assert.ok(!/\(\)/.test(nu.corps) && !/undefined|null|NaN/.test(nu.corps), 'aucun trou dans le texte : ' + nu.corps);
    assert.ok(!/le \./.test(nu.corps), 'sans date, la phrase se réécrit au lieu de garder son « le »');

    const im = P.mailRelance('impayee', { client: 'El Amen', montant: 690, devise: 'TND' });
    assert.ok(/690,000 TND/.test(im.corps), 'le montant porte sa devise (7.16.0) : ' + im.corps);
    // On relance sans accuser : le règlement a pu se croiser avec le mail.
    assert.ok(/ne tenez pas compte/.test(im.corps));
    assert.ok(!/690/.test(P.mailRelance('impayee', { client: 'X' }).corps),
      'sans montant connu, on ne cite aucun chiffre');

    const ex = P.mailRelance('expiree', { client: 'X', fin: '2026-01-05' });
    assert.ok(/s’est terminée le 05\/01\/2026/.test(ex.corps), ex.corps);
    assert.ok(/données sont intactes/.test(ex.corps));

    // Et la console COMPOSE : elle n'appelle pas Resend pour une relance. Un mail parti sans être
    // relu n'est pas une relance, c'est un automate — et le ton d'une relance dépend du client.
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'plateforme', 'skanfact-api.mjs'), 'utf8');
    const i = src.indexOf('function ecrire(r)');
    assert.ok(i > 0, 'le geste « Écrire… » de la console est introuvable');
    const geste = src.slice(i, src.indexOf('\n  function envoyer(', i));
    assert.ok(geste.length < 2600, 'tranche trop large : ' + geste.length);
    assert.ok(/mailto:/.test(geste), 'la relance s\'ouvre dans la messagerie de l\'éditeur');
    assert.ok(!/envoyer|resend/i.test(geste), 'la console ne doit pas envoyer une relance elle-même');
  });

  await ta('10.4.0-beta.3 : la route de relance lit les dates avec la règle de l\'alerte', async () => {
    const { baseD1 } = require('../d1-sqlite');
    const P2 = await API();
    const ADMIN = 'R'.repeat(30);
    const db = baseD1();
    const env = { DB: db, ADMIN_SECRET: ADMIN };
    const get = ch => P2.default.fetch(new Request('https://x/v1/admin/' + ch, { headers: { 'x-skanfact-admin': ADMIN } }), env);
    try {
      const an = new Date().getUTCFullYear();
      db.lire("INSERT INTO clients (id, nom, email, cree_le) VALUES ('cli_1', 'Trabelsi', 'a@b.tn', '2026-01-01')");
      // Une licence FINIE et une licence qui COURT : c'est le serveur qui décide du texte, avec la
      // même règle que l'alerte. Deux règles — l'une pour l'alerte, l'autre pour le mail — finiraient
      // par se contredire, et on relancerait « votre licence se termine » sur une licence terminée.
      db.lire("INSERT INTO licences (id, client_id, kid, empreinte, offre, debut, fin, emise_le)"
        + " VALUES ('lic_finie', 'cli_1', 'srv-1', 'e1', 'independant', '2020-01-01', '2021-01-01', '2020-01-01')");
      db.lire("INSERT INTO licences (id, client_id, kid, empreinte, offre, debut, fin, emise_le)"
        + " VALUES ('lic_court', 'cli_1', 'srv-1', 'e2', 'entreprise', '" + an + "-01-01', '" + (an + 5) + "-01-01', '" + an + "-01-01')");
      const f = await (await get('licences/lic_finie/relance')).json();
      assert.ok(/est arrivée à son terme|s’est terminée/.test(f.sujet + f.corps), f.sujet);
      const c = await (await get('licences/lic_court/relance')).json();
      assert.ok(/se termine/.test(c.sujet), c.sujet);
      assert.strictEqual(c.a, 'a@b.tn', 'la route rend l\'adresse du client');

      // Une vente payée n'a rien à relancer, et le refus le DIT avec sa date.
      db.lire("INSERT INTO ventes (id, client_id, licence_id, montant_ht, devise, payee_le)"
        + " VALUES ('v_payee', 'cli_1', 'lic_court', 690, 'TND', '2026-02-02')");
      db.lire("INSERT INTO ventes (id, client_id, licence_id, montant_ht, devise)"
        + " VALUES ('v_due', 'cli_1', 'lic_court', 690, 'TND')");
      const rp = await get('ventes/v_payee/relance');
      assert.strictEqual(rp.status, 409);
      assert.ok(/payée depuis le 2026-02-02/.test((await rp.json()).erreur));
      const rd = await (await get('ventes/v_due/relance')).json();
      assert.ok(/690,000 TND/.test(rd.corps), rd.corps);

      // Une relance ne change RIEN : elle lit. Le journal n'a pas à s'en souvenir, et surtout
      // aucune ligne ne doit avoir bougé.
      assert.strictEqual(db.lire("SELECT id FROM ventes WHERE payee_le IS NULL").length, 1);
    } finally { db.fermer(); }
  });

  // Le schéma est la seule chose qu'une migration seule peut corriger : la règle se lit AUSSI dans
  // le fichier qu'on demande à Skander de coller, sinon une base neuve repartirait sans la clé.
  t('10.4.0-beta.3 : la clé d\'unicité du parc porte l\'application, COALESCE comprise', () => {
    ['schema.sql', 'schema-a-coller.sql'].forEach(f => {
      const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'plateforme', f), 'utf8')
        .replace(/--[^\n]*/g, '');
      const i = sql.indexOf('idx_activ_unique');
      assert.ok(i > 0, f + ' : la clé d\'unicité du parc a disparu');
      const idx = sql.slice(i, sql.indexOf(';', i));
      assert.ok(/empreinte/.test(idx) && /device_id/.test(idx), f + ' : la clé perd un de ses termes');
      assert.ok(/COALESCE\(\s*app\s*,\s*'entreprise'\s*\)/.test(idx),
        f + ' : `app` nu laisserait deux NULL distincts, donc un doublon sur chaque ligne d\'avant la 10.4.0');
    });
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

  // ==========================================================================================
  // 10.5.0 — les réglages, le suivi commercial, et ce qui garde la boutique
  // ==========================================================================================
  // Le constat qui commande tout : la console savait ce qui EXISTE, et ne retenait rien de ce
  // qu'on en FAISAIT. Un essai se terminait, l'alerte se levait, on appelait — et le lendemain la
  // même alerte se relevait à l'identique. Une alerte qui ne se referme pas cesse d'être lue au
  // cinquième prospect, et emmène avec elle celles qui comptaient.
  // Et un prix qui se change en modifiant le code n'est pas un prix : c'est une constante.

  await ta('10.5.0 : un réglage se nettoie selon son TYPE, et un refus dit la forme attendue', async () => {
    const P = await API();
    assert.strictEqual(P.valeurReglage('prix_entreprise', '880'), 880);
    assert.strictEqual(P.valeurReglage('prix_entreprise', '880,5'), 880.5, 'la virgule décimale est celle qu\'on tape');
    assert.strictEqual(P.valeurReglage('prix_entreprise', '-1'), null, 'un prix négatif n\'existe pas');
    assert.strictEqual(P.valeurReglage('remise_parrainage', '120'), null, 'un pourcentage ne dépasse pas 100');
    assert.strictEqual(P.valeurReglage('alerte_fin', '30,7'), 31, 'un seuil est un nombre de JOURS entiers : un demi-jour ne veut rien dire');
    assert.strictEqual(P.valeurReglage('alerte_fin', '0'), 0, 'zéro est une valeur légitime : « pas d\'alerte »');
    // Une devise est un code à trois lettres. « dinar » accepté en silence ferait passer toutes
    // les factures à deux décimales au lieu de trois (7.30.0).
    assert.strictEqual(P.valeurReglage('devise', 'eur'), 'EUR');
    assert.strictEqual(P.valeurReglage('devise', 'dinar'), null);
    // Une adresse qui ne s'analyse pas n'est pas une adresse : la poser la ferait partir telle
    // quelle dans un mail (6.7.2 — le secret avec une espace en fin).
    assert.strictEqual(P.valeurReglage('lien_paiement', 'paiement.tn'), null);
    assert.strictEqual(P.valeurReglage('lien_paiement', 'https://paiement.tn/a'), 'https://paiement.tn/a');
    assert.strictEqual(P.valeurReglage('lien_paiement', ''), '', 'un champ de texte vidé RESTE vide : c\'est une décision');
    assert.strictEqual(P.valeurReglage('prix_entreprise', ''), null, 'un champ numérique vidé retombe au rang suivant');
    assert.ok(/pourcentage entre 0 et 100/.test(P.refusReglage({ type: 'pourcent' }, '250')),
      'le refus donne la FORME attendue : « valeur invalide » oblige à deviner');
  });

  await ta('10.5.0 : les trois rangs d\'un réglage, dans cet ordre, et la source part avec la valeur', async () => {
    const P = await API();
    const sans = P.reglagesEffectifs({}, {});
    assert.strictEqual(sans.valeurs.prix_entreprise, 690);
    assert.strictEqual(sans.sources.prix_entreprise, 'defaut',
      'la source part AVEC la valeur : un écran de nombres laisse croire qu\'ils ont tous été décidés');
    const worker = P.reglagesEffectifs({ PRIX_ENTREPRISE: '750' }, {});
    assert.strictEqual(worker.valeurs.prix_entreprise, 750);
    assert.strictEqual(worker.sources.prix_entreprise, 'worker');
    const base = P.reglagesEffectifs({ PRIX_ENTREPRISE: '750' }, { prix_entreprise: '880' });
    assert.strictEqual(base.valeurs.prix_entreprise, 880, 'l\'écran CORRIGE le worker, jamais l\'inverse');
    assert.strictEqual(base.sources.prix_entreprise, 'base');
    // Chaque réglage déclaré doit être calculable : un identifiant oublié dans la table rendrait
    // un champ qui s'affiche, s'enregistre, et n'est jamais lu (le défaut de `matricule`, 6.8.0).
    P.REGLAGES.forEach(def => {
      assert.ok(Object.prototype.hasOwnProperty.call(sans.valeurs, def.id), 'réglage sans valeur : ' + def.id);
      assert.ok(def.label && def.aide && def.groupe, 'un réglage dit ce qu\'il fait : ' + def.id);
    });
    // La durée de l'essai n'est PAS réglable, et c'est une décision : c'est la règle de
    // l'application, pas une politique de la console. Réglée ici, elle annoncerait des fins
    // d'essai fausses. Le test tombe si quelqu'un l'ajoute sans y penser.
    assert.ok(!P.REGLAGES.some(d => /essai_jours|duree_essai/.test(d.id)),
      'la durée de l\'essai se compte sur la machine du client : la console ne la décide pas');
  });

  await ta('10.5.0 : les seuils par défaut sont ceux de la table — deux listes divergeraient', async () => {
    const P = await API();
    const parId = new Map(P.REGLAGES.map(r => [r.id, r.defaut]));
    Object.keys(P.SEUILS_DEFAUT).forEach(k => {
      assert.ok(parId.has(k), 'seuil sans réglage : ' + k);
      assert.strictEqual(P.SEUILS_DEFAUT[k], parId.get(k), 'le défaut de ' + k + ' diverge entre la table et les alertes');
    });
    // Et les seuils historiques n'ont pas bougé : `alertesPlateforme(d, jour)` sans troisième
    // argument doit se comporter EXACTEMENT comme en 10.4.0.
    assert.strictEqual(P.SEUILS_DEFAUT.alerte_fin, P.ALERTE_FIN);
    assert.strictEqual(P.SEUILS_DEFAUT.alerte_essai, P.ALERTE_ESSAI);
    assert.strictEqual(P.SEUILS_DEFAUT.alerte_export, P.ALERTE_EXPORT);
  });

  await ta('10.5.0 : un sujet SUIVI ne redemande rien — et seulement lui', async () => {
    const P = await API();
    const jour = '2026-09-22';
    const base = {
      licences: [{ id: 'l1', client_id: 'c1', client: 'Alpha', fin: '2026-10-01', envoyee_le: 'x' },
                 { id: 'l2', client_id: 'c2', client: 'Beta', fin: '2026-10-01', envoyee_le: 'x' }],
      ventes: [{ id: 'v1', client_id: 'c1', client: 'Alpha' }]
    };
    const sans = P.alertesPlateforme(base, jour);
    assert.ok(sans.some(a => a.sujet === 'Alpha'), 'sans suivi, le client crie');
    // Rappelé plus tard : il se tait JUSQU'À la date, pas au-delà.
    const tait = P.alertesPlateforme({ ...base, suivis: { 'client:c1': { rappel: '2026-10-05' } } }, jour);
    assert.ok(!tait.some(a => a.sujet === 'Alpha'), 'un rappel dans le futur fait taire ce client');
    assert.ok(tait.some(a => a.sujet === 'Beta'), 'et SEULEMENT lui : les autres crient toujours');
    const echu = P.alertesPlateforme({ ...base, suivis: { 'client:c1': { rappel: '2026-09-20', nom: 'Alpha' } } }, jour);
    assert.ok(echu.some(a => a.sujet === 'Alpha'), 'un rappel échu rend le client à l\'écran');
    assert.ok(echu.some(a => /Rappel prévu/.test(a.quoi)),
      'et le rappel lui-même devient une ligne : un prospect mis en attente ne doit pas disparaître pour toujours');
    // « Perdu » ferme définitivement ; « gagné » aussi.
    ['perdu', 'gagne'].forEach(issue => {
      const f = P.alertesPlateforme({ ...base, suivis: { 'client:c1': { issue } } }, jour);
      assert.ok(!f.some(a => a.sujet === 'Alpha'), issue + ' ferme le sujet');
    });
    // Ce qui n'est PAS un geste vers le client ne se fait jamais taire par un coup de téléphone.
    const cle = P.alertesPlateforme({
      licences: [{ id: 'l3', client_id: 'c1', client: 'Alpha', envoyee_le: null }],
      suivis: { 'client:c1': { issue: 'perdu' } }
    }, jour);
    assert.ok(cle.some(a => /Clé jamais envoyée/.test(a.quoi)),
      'une clé signée et jamais partie reste à FAIRE : c\'est un geste de l\'éditeur, pas une conversation');
  });

  await ta('10.5.0 : un client payant devenu muet, et un poste resté en arrière', async () => {
    const P = await API();
    const jour = '2026-09-22';
    const postes = [
      { device_id: 'd1', device_nom: 'Mac de Leïla', app: 'entreprise', empreinte: 'abc', version: '10.4.0', derniere_fois: '2026-07-01T09:00:00Z', client_id: 'c9', client: 'Leïla SARL' },
      { device_id: 'd2', device_nom: 'PC', app: 'cabinet', empreinte: 'def', version: '8.4.1', derniere_fois: '2026-09-21T09:00:00Z', client_id: 'c8', client: 'Cabinet Nord' },
      { device_id: 'd3', device_nom: 'essai', app: 'entreprise', empreinte: P.ESSAI, version: '8.4.1', derniere_fois: '2026-07-01T09:00:00Z' }
    ];
    const a = P.alertesPlateforme({ postes }, jour);
    const muet = a.filter(x => /devenu muet/.test(x.quoi));
    assert.strictEqual(muet.length, 1, 'un seul poste sous licence est muet — l\'essai abandonné n\'est pas un client qui part');
    assert.strictEqual(muet[0].sujet, 'Leïla SARL');
    assert.ok(/83 jours|8\d jours/.test(muet[0].detail), 'et l\'alerte dit depuis COMBIEN de temps : ' + muet[0].detail);
    // Le seuil à zéro éteint l'alerte : la valeur par défaut d'une règle qu'on ne veut pas est
    // celle qui ne fait rien (9.1.1).
    assert.ok(!P.alertesPlateforme({ postes }, jour, { silence_client: 0 }).some(x => /devenu muet/.test(x.quoi)));
    // La version minimale : rien tant qu'elle n'est pas réglée. La console n'écrit aucune règle.
    assert.ok(!a.some(x => /version ancienne/.test(x.quoi)), 'sans version minimale réglée, aucune alerte');
    const vieux = P.alertesPlateforme({ postes }, jour, { version_minimale: '10.0.0', version_motif: 'la TVA par taux a été corrigée.' });
    const vs = vieux.filter(x => /version ancienne/.test(x.quoi));
    assert.strictEqual(vs.length, 2, 'les deux postes en 8.4.1 sont signalés, quelle que soit leur application');
    assert.ok(/la TVA par taux a été corrigée/.test(vs[0].detail),
      'et le MOTIF est dans l\'alerte : une mise à jour réclamée sans raison ne se fait pas');
  });

  await ta('10.5.0 : le jalon de renouvellement prépare, il ne presse pas', async () => {
    const P = await API();
    const jour = '2026-09-22';
    const lic = c => ({ licences: [{ id: 'l1', client_id: 'c1', client: 'Alpha', fin: c, envoyee_le: 'x' }] });
    const loin = P.alertesPlateforme(lic('2026-11-10'), jour).filter(a => /Renouvellement à préparer/.test(a.quoi));
    assert.strictEqual(loin.length, 1, 'à cinquante jours, on prépare');
    assert.strictEqual(loin[0].niveau, 'calme', 'et calmement : une occasion criée en rouge apprend à ignorer le rouge');
    const proche = P.alertesPlateforme(lic('2026-10-10'), jour);
    assert.ok(proche.some(a => /Licence qui se termine/.test(a.quoi)), 'à dix-huit jours, on presse');
    assert.ok(!proche.some(a => /Renouvellement à préparer/.test(a.quoi)),
      'et les deux ne se doublent JAMAIS : deux lignes pour la même licence, c\'est du bruit');
    assert.ok(!P.alertesPlateforme(lic('2026-11-10'), jour, { jalon_renouvellement: 0 })
      .some(a => /Renouvellement à préparer/.test(a.quoi)), 'à zéro, le jalon n\'existe pas');
  });

  await ta('10.5.0 : le mail porte le lien de paiement et la signature réglée, et rien d\'autre', async () => {
    const P = await API();
    const avec = P.mailRelance('impayee', { client: 'Alpha', montant: 690, devise: 'TND', lien: 'https://pay.tn/x', signature: 'Moi — SkanFact' });
    assert.ok(/https:\/\/pay\.tn\/x/.test(avec.corps), 'le lien réglé est dans la relance');
    assert.ok(/Moi — SkanFact$/.test(avec.corps.trim()), 'et la signature vient du réglage, plus du code');
    const sans = P.mailRelance('impayee', { client: 'Alpha', montant: 690, devise: 'TND' });
    assert.ok(!/régler en ligne/.test(sans.corps), 'sans lien, la phrase DISPARAÎT — pas un vide, pas un « … »');
    assert.ok(/Skander Ben Amor/.test(sans.corps), 'et la signature par défaut ne change rien pour qui n\'y a pas touché');
    assert.strictEqual(P.mailRelance('impayee', { client: 'A', signature: '' }).corps.trim().split('\n').pop(), 'Bien cordialement,',
      'une signature vidée arrête le mail à la formule de politesse');
    // Le DEVIS : ce que la console ne savait pas faire — parler à quelqu'un qui n'a rien acheté.
    const devis = P.mailRelance('devis', { client: 'Beta', offre: 'Entreprise', montant: 880, devise: 'TND' });
    assert.ok(/880,000 TND HT par an/.test(devis.corps), 'le devis porte le prix RÉGLÉ : ' + devis.corps.slice(0, 200));
    assert.ok(/proposition/.test(devis.sujet));
  });

  await ta('10.5.0 : l\'export nomme ses tables en français, et le pluriel s\'accorde', async () => {
    const P = await API();
    const r = P.resumeExport({ clients: 1, licences: 2, activations: 4, ventes: 0, jetons: 0, evenements: 3 });
    // L'écran écrivait « evenements : 3 · jetons : 0 » — les noms de tables SQL tels quels, accent
    // manquant compris. Ça ne casse rien, et ça dit à celui qui lit que personne n'a regardé.
    assert.ok(/1 client\b/.test(r) && /2 licences/.test(r) && /3 événements/.test(r), r);
    assert.ok(!/evenements|jetons :/.test(r), 'aucun nom de table SQL à l\'écran : ' + r);
    // `pl` accorde : une étiquette écrite au pluriel donnerait « 0 clientss » au premier export vide.
    assert.ok(/0 vente\b/.test(P.resumeExport({})) && !/ss\b/.test(P.resumeExport({ clients: 2, licences: 2, activations: 2, ventes: 2, jetons: 2, evenements: 2 })),
      'le singulier est ce qu\'on écrit, l\'accord est ce que la fonction fait');
    assert.ok(/2 jetons de poste/.test(P.resumeExport({ jetons: 2 })),
      'et le pluriel irrégulier s\'écrit à côté : « jeton de postes » serait faux');
  });

  await ta('10.5.0 : le pli scellé est une procédure, et aucune clé privée n\'en sort', async () => {
    const P = await API();
    const texte = P.pliScelle({ comptes: { clients: 3, licences: 4, activations: 5, ventes: 4, jetons: 0, evenements: 12 }, kid: 'srv-1', quand: '2026-09-22' });
    assert.ok(/une seule personne peut émettre/.test(texte), 'le pli nomme le vrai risque');
    assert.ok(/3 clients/.test(texte) && /12 événements/.test(texte), 'et compte ce qui serait perdu, en français');
    assert.ok(!/PRIVATE KEY|BEGIN /.test(texte), 'aucune clé privée : ce qui sort est une PROCÉDURE');
    assert.ok(/chez une personne, le mot de passe chez une AUTRE/.test(texte),
      'et il dit comment sceller : un pli dont les deux moitiés voyagent ensemble n\'est pas scellé');
    assert.ok(/continuent de fonctionner/.test(texte),
      'il dit aussi ce qui reste vrai sans lui : un client ne perd jamais son logiciel');
  });

  await ta('10.5.0 : la copie automatique DIT ce qui lui manque, et écrit quand elle le peut', async () => {
    const P = await API();
    const rien = P.etatSauvegarde({}, '');
    assert.strictEqual(rien.auto, false);
    assert.ok(/bucket R2/.test(rien.raison), 'non branchée, elle le dit — jamais un vert rassurant (10.4.0)');
    assert.ok(/cron|déclencheur/.test(rien.quoi), 'et elle dit quoi faire pour la brancher');
    const seau = { fiches: {}, async put(nom, corps) { this.fiches[nom] = corps; } };
    assert.strictEqual(P.etatSauvegarde({ [P.R2_BINDING]: seau }, '2026-09-01').auto, true);
    // Sans base, elle refuse proprement : ce code tourne la nuit, une panne muette y est pire.
    assert.strictEqual((await P.exporterVersR2({ [P.R2_BINDING]: seau }, '2026-09-22T00:00:00Z')).ok, false);
    const { baseD1 } = require('../d1-sqlite');
    const db = baseD1();
    try {
      db.lire("INSERT INTO clients (id, nom, cree_le) VALUES ('c1', 'Alpha', '2026-01-01T00:00:00Z')");
      const r = await P.exporterVersR2({ DB: db, [P.R2_BINDING]: seau }, '2026-09-22T00:00:00Z');
      assert.ok(r.ok, 'la copie part : ' + (r.raison || ''));
      assert.strictEqual(r.nom, 'console-2026-09-22.json');
      const doc = JSON.parse(seau.fiches['console-2026-09-22.json']);
      assert.strictEqual(doc.comptes.clients, 1, 'et elle porte un COMPTE par table');
      assert.strictEqual(doc.sha256, r.sha256);
      assert.ok(Array.isArray(doc.tables.licences), 'toutes les tables y sont, même vides');
    } finally { db.fermer(); }
  });

  await ta('10.5.0 : un second secret ouvre la console le temps d\'une rotation, aux mêmes exigences', async () => {
    const P = await API();
    const A = 'A'.repeat(30), B = 'B'.repeat(30);
    const h = v => ({ get: n => (n === 'x-skanfact-admin' ? v : null) });
    assert.strictEqual(P.autoriseAdmin(h(A), { ADMIN_SECRET: A }).ok, true);
    assert.strictEqual(P.autoriseAdmin(h(B), { ADMIN_SECRET: A }).ok, false, 'sans rotation, un seul secret ouvre');
    const deux = { ADMIN_SECRET: A, ADMIN_SECRET_2: B };
    assert.strictEqual(P.autoriseAdmin(h(A), deux).secret, 'principal');
    assert.strictEqual(P.autoriseAdmin(h(B), deux).secret, 'rotation',
      'pendant la rotation, les deux ouvrent — sinon remplacer le secret ferme la console à la seconde où on le remplace');
    // Un secret de rotation court serait une porte de service : refusé À LA CONFIGURATION.
    const court = P.autoriseAdmin(h(A), { ADMIN_SECRET: A, ADMIN_SECRET_2: 'court' });
    assert.strictEqual(court.ok, false);
    assert.strictEqual(court.code, 503, 'mal réglé se DIT (503), ne se refuse pas (403)');
    assert.ok(/ADMIN_SECRET_2/.test(court.message));
    assert.strictEqual(P.etatSecret({ ADMIN_SECRET: A }).rotation, false);
    assert.ok(/SUPPRIME/.test(P.etatSecret(deux).quoi), 'et la console rappelle de FINIR la rotation');
  });

  await ta('10.5.0 : la vérification publique dit l\'état, et jamais à qui la licence appartient', async () => {
    const { baseD1 } = require('../d1-sqlite');
    const P = await API();
    const db = baseD1();
    const env = { DB: db };
    try {
      db.lire("INSERT INTO clients (id, nom, matricule, cree_le) VALUES ('c1','Menuiserie Trabelsi','1234567A','2026-01-01T00:00:00Z')");
      const pose = (id, emp, fin, rev) => db.lire(
        "INSERT INTO licences (id, client_id, kid, empreinte, offre, debut, fin, emise_le, revoquee_le) VALUES (?,?,?,?,?,?,?,?,?)",
        id, 'c1', 'srv-1', emp, 'entreprise', '2026-01-01', fin, '2026-01-01T00:00:00Z', rev);
      pose('l1', 'aaaa1111bbbb2222cccc', '2099-01-01', null);
      pose('l2', 'dddd3333eeee4444ffff', '2020-01-01', null);
      pose('l3', '11112222333344445555', '2099-01-01', '2026-02-02');
      const verif = async emp => (await (await P.default.fetch(new Request('https://x/v1/verif/licence', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ empreinte: emp })
      }), env)).json());
      const ok = await verif('AAAA-1111-BBBB-2222-CCCC');
      assert.strictEqual(ok.etat, 'valable', 'l\'empreinte se lit avec ou sans ses séparateurs');
      assert.ok(!/Trabelsi|1234567A/.test(JSON.stringify(ok)),
        'et la réponse ne dit JAMAIS à qui elle appartient : celui qui présente une clé ne doit rien apprendre de plus');
      // Ce qui PROTÈGE, c'est que la requête ne va jamais chercher le client — pas la forme de la
      // réponse. Une assertion sur la seule réponse restait verte quand on étalait la ligne dans
      // le JSON « pour avoir tout sous la main », parce qu'il n'y avait rien à étaler. On garde
      // donc la CAUSE : cette route ne lit pas la table des clients, et ne la joint pas.
      const src = fs.readFileSync(path.join(__dirname, '..', '..', 'plateforme', 'skanfact-api.mjs'), 'utf8');
      const i = src.indexOf('async function repondreVerif(');
      assert.ok(i > 0, 'la route publique est introuvable');
      const corps = src.slice(i, src.indexOf('\n}', i));
      assert.ok(corps.length > 400 && corps.length < 4000, 'tranche de repondreVerif inattendue : ' + corps.length);
      assert.ok(!/\bclients\b/.test(corps),
        'la vérification publique ne LIT jamais la table des clients : c\'est la requête qui protège, pas la forme de la réponse');
      assert.ok(!/JOIN/i.test(corps), 'ni ne joint quoi que ce soit');
      assert.strictEqual((await verif('dddd3333eeee4444ffff')).etat, 'expiree');
      assert.strictEqual((await verif('11112222333344445555')).etat, 'revoquee');
      assert.strictEqual((await verif('0000000000000000ffff')).etat, 'inconnue',
        'une empreinte inconnue est dite inconnue : répondre « valable » par prudence serait un mensonge');
      // Un G tapé pour un 6 doit rester une faute VISIBLE (8.1.0) : on retire les séparateurs,
      // jamais « tout ce qui n'est pas hexadécimal ».
      assert.strictEqual((await verif('GGGG-1111-BBBB-2222-CCCC')).etat, 'illisible');
      // Et cette route est la SEULE ouverte : elle n'écrit rien, et ne répond qu'en POST.
      assert.strictEqual((await P.default.fetch(new Request('https://x/v1/verif/licence'), env)).status, 405);
    } finally { db.fermer(); }
  });

  await ta('10.5.0 : régler un prix depuis l\'écran, et le suivi qui fait taire une alerte', async () => {
    const { baseD1 } = require('../d1-sqlite');
    const P = await API();
    const ADMIN = 'R'.repeat(30);
    const db = baseD1();
    const env = { DB: db, ADMIN_SECRET: ADMIN };
    const appel = (chemin, corps) => P.default.fetch(new Request('https://x/v1/admin/' + chemin, corps
      ? { method: 'POST', headers: { 'x-skanfact-admin': ADMIN, 'content-type': 'application/json' }, body: JSON.stringify(corps) }
      : { headers: { 'x-skanfact-admin': ADMIN } }), env);
    try {
      // Un réglage refusé est NOMMÉ, et le reste passe quand même : un formulaire tout-ou-rien
      // ferait recommencer quinze champs pour une virgule.
      const r1 = await appel('reglages', { valeurs: { prix_entreprise: '880', remise_parrainage: '250' } });
      assert.strictEqual(r1.status, 400);
      const j1 = await r1.json();
      assert.strictEqual(j1.refuses.length, 1);
      assert.strictEqual(j1.refuses[0].id, 'remise_parrainage');
      assert.ok(/Remise de parrainage/.test(j1.erreur), 'le refus porte une PHRASE, pas seulement une liste');
      assert.strictEqual(j1.valeurs.prix_entreprise, 880, 'et ce qui était bon est enregistré');
      // Vider un champ NUMÉRIQUE le rend à son rang suivant : c'est le seul moyen de défaire une
      // valeur sans avoir à deviner ce qu'elle valait avant.
      const j2 = await (await appel('reglages', { valeurs: { prix_entreprise: '' } })).json();
      assert.strictEqual(j2.valeurs.prix_entreprise, 690);
      assert.strictEqual(j2.sources.prix_entreprise, 'defaut');
      assert.strictEqual(db.lire("SELECT cle FROM reglages WHERE cle = 'prix_entreprise'").length, 0);
      // Le journal dit CE QUI a changé : c'est la seule trace qui explique, six mois plus tard,
      // pourquoi une vente porte ce montant-là.
      const trace = db.lire("SELECT detail FROM evenements WHERE quoi = 'reglages.changes' ORDER BY id");
      assert.ok(trace.length >= 2 && /Entreprise/.test(trace[0].detail), 'le journal nomme le réglage : ' + trace[0].detail);

      // Le SUIVI : un « perdu » sans motif est refusé — c'est la seule chose que ce suivi apprend.
      db.lire("INSERT INTO clients (id, nom, cree_le) VALUES ('c1','Alpha','2026-01-01T00:00:00Z')");
      assert.strictEqual((await appel('clients/c1/suivi', { issue: 'perdu' })).status, 400);
      assert.strictEqual((await appel('clients/c1/suivi', { rappel: '2026-13-99' })).status, 400, 'une date impossible se refuse');
      assert.strictEqual((await appel('clients/c1/suivi', { moyen: 'appel', note: 'rappelle vendredi', rappel: '2099-01-15' })).status, 201);
      assert.strictEqual((await appel('clients/c1/suivi', { moyen: 'appel', note: 'relancé' })).status, 201);
      assert.strictEqual(db.lire('SELECT id FROM suivis').length, 2,
        'rien ne s\'écrase : chaque contact est une ligne de plus — « je l\'ai déjà appelé deux fois » est ce qu\'on vient chercher');
      // …et c'est le PLUS RÉCENT qui décide de ce que l'alerte fait.
      const dernier = await P.lireSuivis(async (sql, ...p) => db.lire(sql, ...p));
      assert.strictEqual(dernier['client:c1'].note, 'relancé');
      assert.strictEqual(dernier['client:c1'].nom, 'Alpha', 'et il porte le nom du client, pour la ligne « Rappel prévu »');
      assert.strictEqual((await appel('clients/c404/suivi', { moyen: 'appel' })).status, 404);
    } finally { db.fermer(); }
  });

  await ta('10.5.0 : la fiche d\'un client rassemble les cinq écrans, et les essais se nomment', async () => {
    const { baseD1 } = require('../d1-sqlite');
    const P = await API();
    const ADMIN = 'F'.repeat(30), APP = 'app-secret-ffffffffffff';
    const db = baseD1();
    const env = { DB: db, ADMIN_SECRET: ADMIN, APP_SECRET: APP };
    try {
      db.lire("INSERT INTO clients (id, nom, email, cree_le) VALUES ('c1','Alpha','a@b.tn','2026-01-01T00:00:00Z')");
      db.lire("INSERT INTO licences (id, client_id, kid, empreinte, offre, debut, fin, emise_le) VALUES ('l1','c1','srv-1','aa11','entreprise','2026-01-01','2099-01-01','2026-01-01T00:00:00Z')");
      db.lire("INSERT INTO ventes (id, client_id, licence_id, montant_ht, devise) VALUES ('v1','c1','l1',690,'TND')");
      db.lire("INSERT INTO activations (id, licence_id, empreinte, device_id, device_nom, plateforme, version, app, premiere_fois, derniere_fois) VALUES ('a1','l1','aa11','poste-1','Mac','darwin','10.4.0','entreprise','2026-02-01T00:00:00Z','2026-09-01T00:00:00Z')");
      db.lire("INSERT INTO evenements (quand, quoi, client_id, detail) VALUES ('2026-01-01T00:00:00Z','licence.emise','c1','Entreprise')");
      const f = await (await P.default.fetch(new Request('https://x/v1/admin/clients/c1', { headers: { 'x-skanfact-admin': ADMIN } }), env)).json();
      assert.strictEqual(f.client.nom, 'Alpha');
      ['licences', 'ventes', 'postes', 'suivis', 'journal'].forEach(k =>
        assert.ok(Array.isArray(f[k]), 'la fiche porte ' + k + ' : cinq écrans en un'));
      assert.strictEqual(f.licences.length, 1);
      assert.strictEqual(f.postes[0].appNom, 'SkanFact', 'le NOM vient du serveur : la page affiche, elle ne retraduit pas');
      assert.strictEqual(f.journal.length, 1);
      assert.strictEqual((await P.default.fetch(new Request('https://x/v1/admin/clients/c404', { headers: { 'x-skanfact-admin': ADMIN } }), env)).status, 404);

      // Les ESSAIS : nommés un par un, avec ce qu'il leur reste. Le Parc les agrège par version —
      // utile pour compter, inutile pour décrocher son téléphone.
      await P.default.fetch(new Request('https://x/v1/licence/etat', {
        method: 'POST', headers: { 'x-skanfact-app': APP, 'content-type': 'application/json' },
        body: JSON.stringify({ cle: '', deviceId: 'poste-essai-9', deviceNom: 'PC de Sonia', plateforme: 'win32', version: '10.4.0', app: 'cabinet' })
      }), env);
      const e = await (await P.default.fetch(new Request('https://x/v1/admin/essais', { headers: { 'x-skanfact-admin': ADMIN } }), env)).json();
      assert.strictEqual(e.lignes.length, 1);
      assert.strictEqual(e.lignes[0].appNom, 'SkanFact Cabinet');
      assert.strictEqual(e.lignes[0].sujet, 'essai:poste-essai-9:cabinet',
        'le sujet du suivi est le MÊME identifiant que celui de l\'alerte — deux façons de nommer le même prospect ne referment rien');
      assert.ok(e.lignes[0].fin && e.lignes[0].reste !== null, 'la fin estimée et ce qu\'il reste sont calculés');
      assert.strictEqual(e.lignes[0].suivi_le, null, 'et la console dit qu\'on ne lui a jamais parlé');
      // Un essai se suit par son POSTE et son APPLICATION : le même ordinateur peut essayer les
      // deux, et les confondre ferait taire une alerte qu'on n'a pas traitée.
      const su = (app) => P.default.fetch(new Request('https://x/v1/admin/essais/poste-essai-9/suivi', {
        method: 'POST', headers: { 'x-skanfact-admin': ADMIN, 'content-type': 'application/json' },
        body: JSON.stringify({ app, moyen: 'appel', note: 'intéressé', source: 'bouche-à-oreille' })
      }), env);
      assert.strictEqual((await su('entreprise')).status, 404, 'aucun essai de CETTE application sur ce poste');
      assert.strictEqual((await su('cabinet')).status, 201);
      assert.strictEqual(db.lire("SELECT sujet FROM suivis")[0].sujet, 'essai:poste-essai-9:cabinet');
    } finally { db.fermer(); }
  });

  await ta('10.5.0 : le parrainage est CHIFFRÉ — amené n\'est pas payé', async () => {
    const { baseD1 } = require('../d1-sqlite');
    const P = await API();
    const ADMIN = 'P'.repeat(30);
    const db = baseD1();
    const env = { DB: db, ADMIN_SECRET: ADMIN };
    try {
      const emp = 'abcdef0123456789abcd';
      db.lire("INSERT INTO clients (id, nom, cree_le) VALUES ('cab','Cabinet Nord','2026-01-01T00:00:00Z')");
      db.lire("INSERT INTO clients (id, nom, cree_le) VALUES ('c1','Alpha','2026-01-01T00:00:00Z')");
      db.lire("INSERT INTO clients (id, nom, cree_le) VALUES ('c2','Beta','2026-01-01T00:00:00Z')");
      db.lire("INSERT INTO licences (id, client_id, kid, empreinte, offre, debut, emise_le, type, dossiers_hors, cabinet_empreinte) VALUES ('lc','cab','srv-1','k0','cabinet','2026-01-01','2026-01-01T00:00:00Z','cabinet',10,?)", emp);
      db.lire("INSERT INTO licences (id, client_id, kid, empreinte, offre, debut, emise_le, cabinet_empreinte) VALUES ('l1','c1','srv-1','k1','entreprise','2026-01-01','2026-01-01T00:00:00Z',?)", emp);
      db.lire("INSERT INTO licences (id, client_id, kid, empreinte, offre, debut, emise_le, cabinet_empreinte) VALUES ('l2','c2','srv-1','k2','entreprise','2026-01-01','2026-01-01T00:00:00Z',?)", emp);
      db.lire("INSERT INTO ventes (id, client_id, licence_id, montant_ht, devise, payee_le) VALUES ('v1','c1','l1',552,'TND','2026-02-01')");
      db.lire("INSERT INTO ventes (id, client_id, licence_id, montant_ht, devise) VALUES ('v2','c2','l2',690,'TND')");
      const j = await (await P.default.fetch(new Request('https://x/v1/admin/cabinets', { headers: { 'x-skanfact-admin': ADMIN } }), env)).json();
      assert.strictEqual(j.lignes.length, 1);
      assert.strictEqual(j.lignes[0].parraines, 2, 'deux clients amenés');
      assert.strictEqual(j.lignes[0].payants, 1, 'un seul a payé — « amené » et « payé » ne sont pas la même nouvelle');
      assert.strictEqual(j.lignes[0].ca_amene, 552, 'et le CA attribué ne compte que ce qui est ENCAISSÉ');
    } finally { db.fermer(); }
  });

};
