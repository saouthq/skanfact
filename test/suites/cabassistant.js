'use strict';
// ============================================================================================
// L'assistant de démarrage COMPLET du Cabinet (10.14.0, suite de l'assistant de l'app entreprise)
//
// Ce qui manquait pour que le premier jour d'un comptable aille jusqu'au bout :
//   le fichier d'appairage PART   il s'enregistrait sur le disque, puis « envoie-le à tes clients » :
//                                 le mail, les soixante adresses et l'explication étaient à écrire ;
//   l'équipe, la grille de saisie deux réglages d'une fois pour tout le cabinet, qui ne se demandent
//                                 pas au premier écran (un formulaire au premier écran se saute) et que
//                                 « Tes premiers pas » rappellent sans jamais les réclamer.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/cabinet/cabcore.js');
const CV = require('../../src/cabinet/renderer/cabvisites.js');
const V = require('../../src/renderer/visite.js');

// Le code sans ses commentaires de ligne : un commentaire qui cite la forme interdite ne fait pas
// tomber un test, et une forme décrite en commentaire ne le fait pas passer (6.8.0, 7.25.0).
const sansCommentaires = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const app = sansCommentaires(lireSource('src', 'cabinet', 'renderer', 'app.js'));
const main = sansCommentaires(lireSource('src', 'cabinet', 'main.js'));
const entreprise = lireSource('src', 'renderer', 'app.js');
// Le corps d'UNE fonction, de sa déclaration à son accolade fermante (tout vit dans la fermeture
// d'app.js, à deux espaces) : une tranche bornée sur un voisin grandit dès qu'il déménage (10.4.0).
const corps = (src, debut) => {
  const i = src.indexOf(debut);
  assert.ok(i >= 0, 'introuvable : ' + debut);
  const j = src.indexOf('\n  }\n', i);
  assert.ok(j > i, 'fin introuvable : ' + debut);
  return src.slice(i, j + 4);
};

// Un chemin « Réglages → Onglet → Panneau » est une PROMESSE (10.9.2) : il se confronte aux onglets
// et aux panneaux RÉELS de l'application qui l'affiche, jamais à une liste recopiée dans le test.
const cabApp = lireSource('src', 'cabinet', 'renderer', 'app.js');
const cheminOk = (chemin, source, entree, onglets, panneaux) => {
  const [porte, onglet, panneau] = chemin.split(' → ');
  assert.strictEqual(porte, entree, `le chemin « ${chemin} » ne commence pas par « ${entree} »`);
  const tabs = new RegExp(`const ${onglets} = \\[([\\s\\S]*?)\\];`).exec(source);
  assert.ok(tabs, onglets + ' introuvable');
  const id = [...tabs[1].matchAll(/\['([a-z]+)', '((?:[^'\\]|\\.)+)'\]/g)].find(m => m[2].replace(/\\'/g, '\'') === onglet);
  assert.ok(id, `l'onglet « ${onglet} » n'existe pas dans ${onglets}`);
  const pan = [...source.matchAll(new RegExp(`'${panneaux}-[a-z-]+': \\{ onglet: '([a-z]+)', titre: '((?:[^'\\\\]|\\\\.)+)'`, 'g'))]
    .find(m => m[1] === id[1] && m[2].replace(/\\'/g, '\'') === panneau);
  assert.ok(pan, `aucun panneau « ${panneau} » dans l'onglet « ${onglet} »`);
};

// Un portefeuille qui DISCRIMINE (10.0.0) : deux clients d'un même groupe partagent une boîte, une
// adresse en majuscules avec une espace (copiée d'un tableur), une adresse fausse, l'exemple, un
// archivé. Un jeu où chaque client a une adresse distincte et propre ne prouverait rien des comptes.
const PORTEFEUILLE = [
  { id: 'a', name: 'Alpha SARL', email: ' Compta@Alpha.tn ' },
  { id: 'b', name: 'Alpha Services', email: 'compta@alpha.tn' },
  { id: 'c', name: 'Gamma', email: '' },
  { id: 'd', name: 'Delta', email: 'pas-une-adresse' },
  { id: 'e', name: 'Garage de l\'exemple', email: 'exemple@demo.tn', demo: true },
  { id: 'f', name: 'Ancien client', email: 'ancien@client.tn', archived: true },
  { id: 'g', name: 'Zeta', email: 'zeta@zeta.tn' }
];
const CAB = { name: 'Cabinet Ben Salah' };
const EMPREINTE = '3F9A-2C1E-77B0-4D21-9E03';

t('10.14.0 Cabinet : le message du fichier d\'appairage part aux VRAIS clients, en copie cachée, une fois par boîte', () => {
  const m = K.mailAppairage(CAB, PORTEFEUILLE, EMPREINTE, 'cabinet-ben-salah.skanpair');
  // Ni l'exemple (des clients qui n'existent pas), ni l'archivé (un client parti) ; une boîte partagée
  // par deux dossiers ne reçoit qu'UN message ; une adresse copiée d'un tableur se nettoie.
  assert.deepStrictEqual(m.bcc, ['compta@alpha.tn', 'zeta@zeta.tn'], 'destinataires : ' + m.bcc.join(', '));
  // Deux comptes, qui ne disent pas la même chose : les CLIENTS joignables (ce que l'écran annonce
  // avant l'envoi) et les ADRESSES (ce qui part). Alpha et Alpha Services sont deux clients, une boîte.
  assert.strictEqual(m.avecAdresse, 3, 'clients qui ont une adresse : Alpha SARL, Alpha Services et Zeta');
  assert.strictEqual(m.sansAdresse, 2, 'clients sans adresse utilisable : Gamma (vide) et Delta (fausse)');
  // Un portefeuille vide, ou fait du seul exemple : personne à qui écrire, sans lever.
  const vide = K.mailAppairage(CAB, [PORTEFEUILLE[4]], EMPREINTE, 'x.skanpair');
  assert.deepStrictEqual([vide.bcc, vide.avecAdresse, vide.sansAdresse], [[], 0, 0], 'l\'exemple ne compte pas');
});

t('10.14.0 Cabinet : le message dit quoi faire, où, et quelle empreinte vérifier — en vouvoyant', () => {
  const m = K.mailAppairage(CAB, PORTEFEUILLE, EMPREINTE, 'cabinet-ben-salah.skanpair');
  assert.ok(m.subject.includes('Cabinet Ben Salah'), 'l\'objet nomme le cabinet : ' + m.subject);
  assert.ok(m.body.includes(EMPREINTE), 'le message porte l\'empreinte à vérifier');
  assert.ok(m.body.includes('« cabinet-ben-salah.skanpair »'), 'le message nomme le fichier à importer');
  assert.ok(/n'allez pas plus loin/.test(m.body), 'une empreinte différente dit de s\'arrêter : c\'est tout l\'intérêt de la vérifier');
  assert.ok(/Vous n'utilisez pas SkanFact \?/.test(m.body), 'un client hors SkanFact sait qu\'il n\'a rien à faire');
  assert.ok(/Bien à vous,\nCabinet Ben Salah$/.test(m.body), 'le message est signé du cabinet');
  // Le comptable écrit à ses clients : il les vouvoie (comme une relance). Les libellés de l'application
  // cités entre guillemets restent ce qu'ils sont — « Ton cabinet comptable » est le titre d'un panneau.
  const prose = m.body.replace(/«[^»]*»/g, '');
  assert.ok(!/\b(tu|ton|ta|tes|toi|te)\b/i.test(prose), 'un tutoiement dans le message aux clients : ' + (/\b(tu|ton|ta|tes|toi|te)\b/i.exec(prose) || [])[0]);
  // Sans empreinte (un fichier qu'on n'a pas su lire), le message ne ment pas en montrant un vide.
  assert.ok(K.mailAppairage(CAB, [], '', 'x.skanpair').body.includes('celle-ci : —'));
});

t('10.14.0 Cabinet : le chemin que le message donne au client EXISTE dans SkanFact (une phrase qui dit où est une promesse, 10.9.2)', () => {
  const m = K.mailAppairage(CAB, PORTEFEUILLE, EMPREINTE, 'f.skanpair');
  // L'onglet, le panneau et le bouton, lus dans l'application entreprise — jamais recopiés ici.
  const onglet = /\['envois', '([^']+)'\]/.exec(entreprise);
  const panneau = /'p-cabinet': \{ onglet: '([a-z]+)', titre: '([^']+)'/.exec(entreprise);
  const bouton = /id="cab-import">([^<]+)<\/button>/.exec(entreprise);
  assert.ok(onglet && panneau && bouton, 'l\'onglet, le panneau ou le bouton d\'import ont changé de forme dans l\'app entreprise');
  assert.strictEqual(panneau[1], 'envois', 'le panneau du cabinet a changé d\'onglet');
  const chemin = `« Paramètres → ${onglet[1]} → ${panneau[2]} »`;
  assert.ok(m.body.includes(chemin), `le message ne donne pas le chemin réel ${chemin}`);
  assert.ok(m.body.includes(`« ${bouton[1]} »`), `le message ne nomme pas le bouton réel « ${bouton[1]} »`);
  // Et SkanFact montre bien une empreinte après l'import, comme le message l'annonce.
  assert.ok(/Empreinte de sa clé/.test(entreprise), 'SkanFact ne montre plus l\'empreinte après l\'import : le message promettrait ce qui n\'existe pas');
});

t('10.14.0 Cabinet : un lien mailto garde les adresses tant qu\'il TIENT, et le message part toujours', () => {
  // Quelques adresses : elles entrent dans le lien.
  const petit = K.mailtoUrl({ subject: 'Objet', body: 'Corps', bcc: ['a@b.tn', 'c@d.tn'] });
  assert.strictEqual(petit.bccInclus, true);
  assert.ok(petit.url.startsWith('mailto:?') && petit.url.includes('bcc=a%40b.tn,c%40d.tn'), petit.url);
  assert.ok(petit.url.includes('subject=Objet') && petit.url.includes('body=Corps'));
  // Sans adresse : pas de paramètre vide, et rien à dire de la copie cachée.
  const sans = K.mailtoUrl({ subject: 'Objet', body: 'Corps', bcc: [] });
  assert.strictEqual(sans.bccInclus, false);
  assert.ok(!sans.url.includes('bcc='), sans.url);
  // Un vrai portefeuille : soixante clients, le vrai message (accentué : chaque « é » vaut six caractères).
  const soixante = Array.from({ length: 60 }, (_, i) => ({ id: 'd' + i, name: 'Client ' + i, email: `comptabilite@entreprise-${i}.com.tn` }));
  const m = K.mailAppairage(CAB, soixante, EMPREINTE, 'cabinet-ben-salah.skanpair');
  const avec = `mailto:?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}&bcc=${m.bcc.map(encodeURIComponent).join(',')}`;
  assert.ok(avec.length > K.LIMITE_MAILTO, 'les données du test ne dépassent pas la limite : elles ne prouveraient rien (' + avec.length + ')');
  const u = K.mailtoUrl(m);
  assert.strictEqual(u.bccInclus, false, 'un lien trop long est coupé par Windows, sans une erreur');
  assert.ok(!u.url.includes('bcc='), 'les adresses sont restées dans un lien trop long');
  assert.ok(u.url.includes(encodeURIComponent(m.subject)) && u.url.includes(encodeURIComponent(m.body)), 'le message doit partir, lui');
  // Le MESSAGE seul doit tenir : le jour où il grandit au-delà, c'est lui que Windows couperait.
  assert.ok(u.url.length <= K.LIMITE_MAILTO, `le message seul dépasse la limite d'un lien mailto (${u.url.length})`);
  // Et un lien qui garde ses adresses tient toujours dans la limite.
  const dix = K.mailtoUrl(K.mailAppairage(CAB, soixante.slice(0, 10), EMPREINTE, 'f.skanpair'));
  assert.ok(dix.bccInclus && dix.url.length <= K.LIMITE_MAILTO, 'dix adresses tiennent : ' + dix.url.length);
});

t('10.14.0 Cabinet : « Déclarer ton équipe » et « Régler ta grille » se cochent sur un GESTE et ne passent jamais devant le métier', () => {
  // Un cabinet neuf passé par `migrate` : la grille de saisie a ses réglages PAR DÉFAUT — leur présence
  // ne prouve rien (10.12.0 : un prix posé par le logiciel n'est pas un prix décidé).
  const neuf = K.migrate({ cabinet: { name: 'Cabinet Ben Salah' }, dossiers: [] });
  assert.ok(neuf.settings.saisie && neuf.settings.saisie.touches, 'migrate ne remplit plus la grille : le test ne discrimine plus');
  const p = K.premiersPas(neuf, {});
  const de = (pp, id) => pp.etapes.find(e => e.id === id);
  assert.strictEqual(de(p, 'saisie').fait, false, 'la grille se dit réglée alors que personne n\'y a touché');
  assert.strictEqual(de(p, 'equipe').fait, false, 'l\'équipe se dit déclarée alors que personne ne l\'est');
  assert.ok(de(p, 'saisie').facultatif && de(p, 'equipe').facultatif, 'une étape d\'organisation n\'est pas une étape du métier');
  // L'équipe est posée AVANT les clients dans la liste : l'étape suivante la saute.
  assert.strictEqual(p.suivante.id, 'clients', 'l\'étape suivante d\'un cabinet nommé est d\'ajouter ses clients : ' + (p.suivante && p.suivante.id));
  // Le geste : enregistrer la grille laisse `regleLe`, et `migrate` (au prochain démarrage) le garde.
  const regle = K.migrate({ ...neuf, settings: { ...neuf.settings, saisie: { ...neuf.settings.saisie, regleLe: '2026-09-25T09:00:00.000Z' } } });
  assert.strictEqual(regle.settings.saisie.regleLe, '2026-09-25T09:00:00.000Z', 'migrate jette la trace du geste : l\'étape se décocherait au démarrage suivant');
  assert.strictEqual(de(K.premiersPas(regle, {}), 'saisie').fait, true);
  // L'équipe : un collaborateur ACTIF la coche ; un collaborateur retiré (9.9.0) ne compte pas.
  const avecUn = { ...neuf, collaborateurs: [{ id: 'x', nom: 'Amine', role: 'saisie', actif: true }] };
  assert.strictEqual(de(K.premiersPas(avecUn, {}), 'equipe').fait, true);
  const retire = { ...neuf, collaborateurs: [{ id: 'x', nom: 'Amine', role: 'saisie', actif: false }] };
  assert.strictEqual(de(K.premiersPas(retire, {}), 'equipe').fait, false, 'un collaborateur retiré coche encore l\'équipe');
});

t('10.14.0 Cabinet : l\'enregistrement de la grille laisse la trace du geste, et le pont la garde', () => {
  // Le bouton qui enregistre la grille (et lui seul) pose `regleLe` dans les réglages de saisie.
  const i = app.indexOf("const sr = $('#sr-save', view);");
  assert.ok(i > 0, 'le bouton d\'enregistrement de la grille a changé de forme');
  const gestionnaire = app.slice(i, app.indexOf('flash($(\'#sr-saved\', view));', i));
  assert.ok(gestionnaire.length > 200 && gestionnaire.length < 2500, 'tranche inattendue : ' + gestionnaire.length);
  assert.ok(/saisie: \{[\s\S]*regleLe: new Date\(\)\.toISOString\(\)[\s\S]*\}/.test(gestionnaire), 'l\'enregistrement de la grille ne laisse plus la trace du geste');
  // Le pont FUSIONNE les réglages de saisie (9.3.0) : un champ neuf envoyé par l'écran arrive donc
  // dans l'état — il ne passe pas par une liste de champs qui le jetterait.
  const pont = corps(main, "ipcMain.handle('cab:saveCabinet'");
  assert.ok(/state\.settings\.saisie = \{\s*\.\.\.avant, \.\.\.p\.settings\.saisie/.test(pont), 'le pont ne fusionne plus les réglages de saisie : regleLe serait jeté');
});

t('10.14.0 Cabinet : UNE porte pour remettre le fichier — les trois boutons y passent, et l\'écran dit ce qui est parti', () => {
  // Les trois boutons : le panneau des Réglages, l'état vide des Échéances, « Tes premiers pas ».
  assert.ok(/\$\('#c-pair'\)\.onclick = \(\) => remettreAppairage\(\);/.test(app), '#c-pair ne passe plus par la porte');
  assert.ok(/\$\('#ech-pair'\)\.onclick = \(\) => remettreAppairage\(\);/.test(app), '#ech-pair ne passe plus par la porte');
  assert.ok(/appairage: \['[^']+', \(\) => remettreAppairage\(\)\]/.test(app), 'l\'étape « appairage » ne passe plus par la porte');
  // Une seule exportation du fichier dans toute l'interface : deux portes divergent (7.29.0).
  const exports = (app.match(/api\.exportPairing\(/g) || []).length;
  assert.strictEqual(exports, 1, `le fichier s'exporte par ${exports} chemins`);
  const porte = corps(app, 'async function remettreAppairage()');
  assert.ok(porte.includes('api.exportPairing('), 'la porte n\'exporte plus le fichier');
  // Le message : préparé par le moteur pur (jamais recomposé ici), les adresses en copie cachée, et le
  // fichier montré — un lien mailto ne joint rien.
  assert.ok(/K\.mailAppairage\(S\.cabinet, S\.dossiers, r\.fingerprint,/.test(porte), 'le message n\'est plus préparé par K.mailAppairage');
  assert.ok(/api\.mail\(\{ bcc: m\.bcc, subject: m\.subject, body: m\.body, attachment: r\.path \}\)/.test(porte), 'la porte n\'envoie plus les destinataires ou la pièce au pont');
  // Ce qui est VRAIMENT parti (E-14) : trop d'adresses → le presse-papiers, en le disant ; pièce montrée
  // ou pas → la phrase le dit.
  assert.ok(/if \(m\.bcc\.length && !\(res && res\.bccInclus\)\)[\s\S]{0,120}navigator\.clipboard\.writeText\(m\.bcc\.join/.test(porte), 'les adresses qui ne tiennent pas dans le lien ne vont plus dans le presse-papiers');
  assert.ok(/copiees \?[^\n]*« Cci »/.test(porte), 'l\'écran ne dit pas où coller les adresses copiées');
  assert.ok(/res && res\.montre \?/.test(porte), 'l\'écran ne dit plus si le fichier a été montré');
  // U-11 : après le geste, l'étape suivante est de fermer — le vert passe sur « Fermer ».
  assert.ok(/b\.classList\.remove\('btn-primary'\)[\s\S]{0,160}\[data-close\]', layer\)\.classList\.add\('btn-primary'\)/.test(porte), 'le vert reste sur « Écrire » une fois le message ouvert');
  // Sans nom de cabinet, la porte refuse en MONTRANT où le nommer (7.0.0), avant tout sélecteur de fichier.
  // (REF-01 : le renvoi montre aussi la case du nom — on exige la règle, pas la forme de l'appel.)
  const renvoi = porte.search(/versReglages\('pan-cabinet'[^)]*#c-name/);
  assert.ok(renvoi > 0 && renvoi < porte.indexOf('api.exportPairing('),
    'la porte doit mener au nom du cabinet, en montrant sa case, AVANT de proposer d\'enregistrer');
  // La place de la réponse est réservée (H-E1, dans une fenêtre) : la phrase qui la remplace est plus longue.
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/\.ap-etat \{ min-height: [^;}]+; \}/.test(css), 'la place de la réponse n\'est plus réservée');
  assert.ok(/\.ap-etat > div \{ min-height: inherit;/.test(css), 'l\'encadré ne remplit plus la place réservée : la réponse la dépasse');
  assert.ok(/class="ap-etat[^"]*" id="ap-etat"[^>]*><div class="info-box">/.test(porte), 'la zone de réponse ne porte plus la classe qui la réserve, ou l\'annonce n\'est plus dans le même encadré que la réponse');
});

t('10.14.0 Cabinet : le pont compose le lien par le moteur, et ne montre qu\'une pièce qui existe', () => {
  const h = corps(main, "ipcMain.handle('cab:mail'");
  assert.ok(/K\.mailtoUrl\(\{ to, bcc: Array\.isArray\(bcc\) \? bcc : \[\], subject, body \}\)/.test(h), 'le lien n\'est plus composé par K.mailtoUrl');
  assert.ok(!/`mailto:/.test(h), 'le pont recompose un lien mailto à la main, sans garde de longueur');
  assert.ok(/if \(attachment && fs\.existsSync\(String\(attachment\)\)\) \{ shell\.showItemInFolder/.test(h), 'le pont montre une pièce sans vérifier qu\'elle existe');
  assert.ok(/return \{ state: 'mailto', bccInclus: m\.bccInclus, montre \}/.test(h), 'le pont ne dit plus ce qui est parti');
});

t('10.14.0 : un identifiant que la visite explique n\'a qu\'UN sens — dans les deux applications', () => {
  // `#pa-ecrire` existait (la Paie : « Passe l'écriture de paie du mois en brouillard ») quand la fenêtre
  // du fichier d'appairage l'a reposé pour « Écrire à mes clients… » : la visite aurait expliqué l'un par
  // l'autre. Une explication FAUSSE est pire qu'une absente (10.14.0). La règle : un identifiant que le
  // dictionnaire explique SANS le lier à une page est posé par UNE fonction de l'application. Les
  // exceptions sont NOMMÉES, chacune avec sa raison — une exception anonyme est un trou.
  const GENERIQUES = {
    cabinet: {
      ok: 'le bouton qui valide chaque fenêtre : il valide ce que CETTE fenêtre propose',
      no: 'le bouton qui ferme chaque fenêtre sans rien faire',
      imp: '« Importer un paquet… », le même geste sur la page Dossiers et sur la page Écritures'
    },
    entreprise: {
      q: 'la recherche de chaque liste', st: 'le filtre de statut de chaque liste', yr: 'le filtre d\'année de chaque liste',
      kind: 'le filtre de sorte de pièce des listes de pièces', f: 'le filtre des deux listes de tiers (clients, fournisseurs)'
    }
  };
  const juger = (nom, source, dictionnaire) => {
    // Les identifiants que le dictionnaire explique sans page (`b('#x', …)` sans `route`).
    const libres = new Set();
    for (const m of dictionnaire.matchAll(/\bb\('([^']+)',[^\n]*/g)) {
      if (/\broute:/.test(m[0])) continue;
      m[1].split(',').map(x => x.trim()).forEach(sel => { const r = /^#([\w-]+)$/.exec(sel); if (r) libres.add(r[1]); });
    }
    assert.ok(libres.size > 50, `${nom} : ${libres.size} identifiants lus — le dictionnaire a changé de forme`);
    // Le propriétaire de chaque identifiant posé : la fonction (ou la route) de premier niveau qui le pose.
    const proprio = {};
    let qui = '(en-tête)';
    source.split('\n').forEach(l => {
      const f = /^ {2}(?:async\s+)?function\s+(\w+)|^ {2}routes\.(\w+)\s*=/.exec(l);
      if (f) qui = f[1] || 'routes.' + f[2];
      for (const m of l.matchAll(/id="([\w-]+)"/g)) if (libres.has(m[1])) (proprio[m[1]] = proprio[m[1]] || new Set()).add(qui);
    });
    assert.ok(Object.keys(proprio).length > 50, `${nom} : ${Object.keys(proprio).length} identifiants posés — la lecture ne voit plus l'interface`);
    const doubles = Object.entries(proprio).filter(([id, s]) => s.size > 1 && !GENERIQUES[nom][id]).map(([id, s]) => `#${id} (${[...s].join(', ')})`);
    assert.deepStrictEqual(doubles, [], `${nom} : un identifiant expliqué sans page est posé par plusieurs fonctions — la visite l'expliquerait par l'autre`);
    // Une exception qui ne sert plus se retire, sinon la liste ment à son tour.
    const inutiles = Object.keys(GENERIQUES[nom]).filter(id => !proprio[id] || proprio[id].size < 2);
    assert.deepStrictEqual(inutiles, [], `${nom} : exception(s) qui ne servent plus`);
  };
  juger('cabinet', lireSource('src', 'cabinet', 'renderer', 'app.js'), lireSource('src', 'cabinet', 'renderer', 'cabvisites.js'));
  juger('entreprise', entreprise, lireSource('src', 'renderer', 'visites.js'));
});

t('10.14.0 : la pastille de licence envoie vers un chemin qui EXISTE dans l\'application qui l\'affiche — les deux', () => {
  // Vu au test humain : la barre latérale d'un cabinet de quatre clients hors SkanFact disait « voir
  // Paramètres → L'application → Licence ». La phrase vit dans `licence.js`, jumelle de celle de
  // SkanFact — où ce chemin est juste. Le Cabinet a des RÉGLAGES, et sa licence vit dans « Mon
  // cabinet ». Une phrase qui dit où cliquer est une promesse (10.9.2) : chaque application donne
  // le sien, et chacun se confronte aux onglets et aux panneaux RÉELS de son application.
  const L = require('../../src/licence.js');
  const C = require('../../src/renderer/core.js');
  // Le Cabinet : le chemin qu'il passe, et la pastille qui le porte vraiment.
  // Le chemin se lit avec ses apostrophes échappées : « L\'application » en est une, et une lecture
  // qui s'arrêterait à la première dirait « le Cabinet ne déclare plus son chemin » au lieu de le juger.
  const lu = /const CHEMIN_LICENCE = '((?:[^'\\]|\\.)+)';/.exec(main);
  assert.ok(lu, 'le Cabinet ne déclare plus le chemin de sa licence');
  const chemin = [lu[0], lu[1].replace(/\\'/g, '\'')];
  cheminOk(chemin[1], cabApp, 'Réglages', 'REG_TABS', 'pan');
  assert.ok(/pastille: L\.pastille\(etat, CHEMIN_LICENCE\)/.test(main), 'le Cabinet ne passe plus son chemin à la pastille');
  const cab = L.pastille({ locked: true, label: '4 dossiers hors SkanFact comptés' }, chemin[1]);
  assert.ok(cab.texte.endsWith('voir ' + chemin[1]) && !/Paramètres/.test(cab.texte), 'la pastille du Cabinet : ' + cab.texte);
  // SkanFact : le chemin par défaut, lu dans la pastille elle-même.
  const defaut = / — voir (.+)$/.exec(C.pastilleLicence({ locked: true, label: 'x' }).texte);
  assert.ok(defaut, 'la pastille de SkanFact ne dit plus où aller');
  cheminOk(defaut[1], entreprise, 'Paramètres', 'SETTINGS_TABS', 'p');
});

t('10.14.0 Cabinet : la visite « Remettre le fichier » montre la fenêtre qu\'elle ouvre, et chaque bouton neuf a son explication', () => {
  const ctx = { state: () => ({ cabinet: { name: 'X' }, dossiers: [] }), dossier: () => null, estExemple: () => false,
    cleSecours: () => null, copieExterne: () => false, Visite: V };
  const v = CV.parcours(ctx).find(x => x.id === 'appairage');
  assert.ok(v, 'la visite « appairage » n\'existe plus');
  const i = v.etapes.findIndex(e => e.cible === '#c-pair');
  assert.ok(i >= 0 && v.etapes[i].faire === 'clic', 'le geste « Remettre le fichier » n\'est plus joué');
  // Le dernier geste OUVRE une fenêtre : une étape la montre, sans rien y cliquer (écrire à soixante
  // clients ne se joue pas « pour voir »).
  const suite = v.etapes[i + 1];
  assert.ok(suite && /#ap-ecrire/.test(String(suite.cible)) && !suite.faire, 'la visite finit par-dessus la fenêtre qu\'elle vient d\'ouvrir');
  const dico = lireSource('src', 'cabinet', 'renderer', 'cabvisites.js');
  ['#ap-ecrire', '#ap-montrer', '#c-pair', '#ech-pair'].forEach(id =>
    assert.ok(dico.includes(`b('${id}',`), `${id} n'a pas son explication`));
});

t('10.14.0 Cabinet : un lien vers un panneau des Réglages l\'amène APRÈS le chargement de son onglet (la pastille de licence)', () => {
  // « L'équipe » et « Licence » s'affichent « Chargement… » au premier dessin, puis grandissent. Viser
  // tout de suite, c'était viser une page plus courte : la pastille ouvrait « Le fichier à remettre »,
  // le panneau Licence sous le bas de l'écran (vu à la souris). Une cible se pose après le chargement.
  const d = corps(app, 'function drawReglages(');
  const m = /Promise\.allSettled\(\[([^\]]*)\]\)\.then\(\(\) => \{([\s\S]*?)\}\);/.exec(d);
  assert.ok(m, 'drawReglages n\'attend plus le chargement de ses panneaux avant de viser');
  assert.ok(/dessinerEquipe\(view\)/.test(m[1]) && /dessinerLicence\(view\)/.test(m[1]), 'les panneaux attendus : ' + m[1]);
  assert.ok(/reg\.montrer\(vise\)/.test(m[2]), 'la cible ne se vise plus après le chargement');
  // … et jamais AVANT : un premier défilement tout de suite rendrait le défaut, sous le second.
  assert.ok(!/reg\.montrer\(/.test(d.slice(0, d.indexOf(m[0]))), 'drawReglages vise encore la cible avant le chargement');
});

t('10.14.0 Cabinet : le PREMIER collaborateur (ce poste) est proposé « Supervision », et un refus sans superviseur dit où changer le rôle', () => {
  // Vu au test humain : « Tes premiers pas » envoient le comptable déclarer son équipe ; le premier
  // déclaré devient le nom de cet ordinateur (9.9.0), et la liste proposait « Saisie » — il se
  // retirait la validation de ses propres écritures, et le refus l'envoyait chercher « un
  // superviseur » qui n'existait pas.
  assert.strictEqual(K.roleProposeCollab({ collaborateurs: [] }), 'supervision', 'le premier déclaré');
  // Un collaborateur RETIRÉ ne compte pas : son cabinet repart d'aucun collaborateur actif.
  assert.strictEqual(K.roleProposeCollab({ collaborateurs: [{ id: 'x', nom: 'Ancien', role: 'saisie', actif: false }] }), 'supervision', 'après un retrait');
  assert.strictEqual(K.roleProposeCollab({ collaborateurs: [{ id: 'a', nom: 'Karim', role: 'supervision', actif: true }] }), 'saisie', 'les suivants');
  // Le refus, SANS superviseur : il nomme l'endroit où le rôle se change — et cet endroit existe.
  const seul = { collaborateurs: [{ id: 'a', nom: 'Karim', role: 'saisie', actif: true }], dossiers: [{ id: 'd1' }] };
  const v = K.peut(seul, 'd1', 'a', 'validation');
  assert.ok(!v.ok && v.geste.includes(K.CHEMIN_EQUIPE) && !/un superviseur peut/.test(v.geste), 'sans superviseur : ' + v.geste);
  cheminOk(K.CHEMIN_EQUIPE, cabApp, 'Réglages', 'REG_TABS', 'pan');
  // AVEC un superviseur qui n'a pas ce dossier : c'est lui qui donne le rôle, dans la fiche.
  const avec = { collaborateurs: [...seul.collaborateurs, { id: 'b', nom: 'Sonia', role: 'supervision', actif: true }],
    dossiers: [{ id: 'd1', droits: { b: 'saisie' } }] };
  const w = K.peut(avec, 'd1', 'a', 'validation');
  assert.ok(!w.ok && /un superviseur peut le donner/.test(w.geste), 'avec superviseur : ' + w.geste);
  // Le formulaire propose ce rôle, et DIT au premier déclaré que ce sera son nom — avant d'enregistrer.
  const f = corps(app, 'function formCollaborateur(');
  assert.ok(/K\.roleProposeCollab\(/.test(f) && /\$\{role === r \? 'selected' : ''\}/.test(f), 'le formulaire ne propose plus le rôle calculé');
  assert.ok(/\$\{premier \? `<div class="info-box[^"]*" id="eq-premier">/.test(f), 'le premier déclaré n\'est plus prévenu avant d\'enregistrer');
});

t('10.14.0 : l\'explication de [data-close] est vraie d\'« Annuler » ET de « Fermer » — dans les deux applications', () => {
  // Les deux applications posent cet attribut sur « Annuler » (rien n'est gardé) ET sur le « Fermer »
  // d'une fenêtre dont le geste est fait — « Le fichier est prêt » : il est enregistré. « Sans rien
  // garder » était faux du second, et le nom imposé « Annuler » le rebaptisait dans la bulle. Une
  // explication fausse est pire qu'une explication absente (10.14.0).
  const ligne = src => {
    const l = src.split('\n').find(x => /^\s*b\('[^']*\[data-close\]/.test(x));
    assert.ok(l, 'aucune explication de [data-close]');
    return l;
  };
  [lireSource('src', 'renderer', 'visites.js'), lireSource('src', 'cabinet', 'renderer', 'cabvisites.js')].forEach(src => {
    const l = ligne(src);
    assert.ok(!/sans rien garder/.test(l), 'promet encore « sans rien garder » : ' + l.trim());
    assert.ok(!/nom: '/.test(l), 'impose encore un nom au bouton : ' + l.trim());
  });
  // Les deux formes existent bien : l'explication n'est juste que si elle vaut pour les deux.
  [app, entreprise].forEach(src => assert.ok(/data-close>Fermer</.test(src) && /data-close>Annuler</.test(src), 'un « Fermer » ou un « Annuler » a disparu'));
});

t('10.14.0 Cabinet : l\'écran des touches ne montre pas le nom INTERNE, et le champ de capture ne bouge pas sous le doigt', () => {
  // Vu au test humain, sur l'écran qu'ouvre « Régler ta grille de saisie » : chaque champ affichait
  // « Enter », « Control+Enter » à côté de la touche dessinée « ↵ Entrée » — le format interne fuit
  // dans l'écran de saisie (9.4.5). Il vit dans `data-code` ; le champ est la zone où l'on appuie.
  const f = corps(app, 'const champTouche = ');
  assert.ok(/data-code="\$\{esc\(v\)\}" value=""/.test(f), 'le champ affiche encore le nom interne de la touche');
  assert.ok(/placeholder="Changer…"/.test(f), 'le champ ne dit plus ce qu\'on y fait');
  const b = corps(app, 'function brancherReglagesCompta(');
  assert.ok(/inp\.dataset\.code = v/.test(b) && !/inp\.value = v/.test(b), 'la capture écrit encore dans le champ');
  assert.ok(/String\(i\.dataset\.code \|\| ''\)/.test(b), 'l\'enregistrement ne lit plus la touche capturée');
  // La largeur du champ porte la chaîne de `:not()` (la règle générale posait `width: 100%`, et
  // `.field.narrow input` le plafonnait à 120 px : sa largeur ne s'était jamais appliquée), et la
  // touche dessinée réserve la sienne — à gauche du champ, une touche plus large le poussait.
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/input\.touche-in:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="file"\]\):not\(\[type="range"\]\) \{[^}]*width: 22ch;[^}]*max-width: none/.test(css),
    'la largeur du champ de capture ne gagne plus contre la règle générale');
  assert.ok(/\.touche-vue \{[^}]*min-width: [0-9.]+rem/.test(css), 'la touche dessinée ne réserve plus sa largeur');
});

t('10.14.0 Cabinet : « Sur cet ordinateur, c\'est … » est UNE phrase, pas trois morceaux d\'un bandeau flex', () => {
  // Vu au test humain : dans `#eq-moi` (flex, écart de 14 px), le texte, le nom en gras et la suite
  // devenaient trois éléments — « c'est   Karim Ben Salah   qui travaille ». La règle de la 10.12.0
  // sur l'étiquette d'une case, dans un autre conteneur.
  const d = corps(app, 'async function dessinerEquipe(');
  const i = d.indexOf('id="eq-moi">');
  assert.ok(i > 0, 'le bandeau de l\'identité a disparu');
  const avant = d.slice(i, d.indexOf('<label', i));
  assert.ok(/<span class="eq-phrase">\$\{moi \?/.test(avant), 'la phrase n\'est plus un seul élément');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/#eq-moi > \.eq-phrase \{[^}]*flex: 1 1 100%/.test(css), 'le sélecteur « Je suis » ne passe plus sous la phrase');
});

// Vu à la souris sur le PREMIER écran du Cabinet : taper le mot de passe, Tab, la confirmation…
// Tab posait le curseur sur « Afficher », la confirmation partait dans le vide, et le refus disait
// « les deux mots de passe ne sont pas les mêmes » sans montrer aucune case. Trois défauts, un geste.
t('10.14.0 : un mot de passe à CONFIRMER — une confirmation vide se nomme, le refus montre SA case, et Entrée descend (les deux applications)', () => {
  const C = require('../../src/renderer/core.js');
  // Le verdict, dans les deux modules, avec des DONNÉES qui discriminent (10.0.0) : une confirmation
  // vide n'est pas « pas la même », et une confirmation fausse se refait — jamais le mot de passe.
  [[C, 6], [K, 8]].forEach(([M, min]) => {
    const court = 'x'.repeat(min - 1), bon = 'y'.repeat(min);
    assert.strictEqual(M.verdictMotDePasse(court, court, min).champ, 'motDePasse', 'un mot de passe trop court se refuse sur SA case');
    const vide = M.verdictMotDePasse(bon, '', min);
    assert.ok(!vide.ok && vide.champ === 'confirmation' && /Retape/.test(vide.message) && !/pas les mêmes|ne correspond/.test(vide.message),
      'une confirmation VIDE doit se nommer, pas se dire différente');
    const faux = M.verdictMotDePasse(bon, bon + 'z', min);
    assert.ok(!faux.ok && faux.champ === 'confirmation' && /ne correspond pas/.test(faux.message), 'une confirmation fausse se refait');
    assert.deepStrictEqual(M.verdictMotDePasse(bon, bon, min), { ok: true, champ: '', message: '' });
  });
  // Les deux applications refusent avec les MÊMES mots : les corps sont identiques (motif `exemplePerime`).
  const corpsDe = (src, nom) => (src.match(new RegExp(`function ${nom}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`)) || [''])[0];
  const vA = corpsDe(lireSource('src', 'renderer', 'core.js'), 'verdictMotDePasse');
  const vB = corpsDe(lireSource('src', 'cabinet', 'cabcore.js'), 'verdictMotDePasse');
  assert.ok(vA.length > 200 && vA === vB, 'les deux verdicts ont divergé');
  const eA = corpsDe(entreprise, 'enchainerConfirmation');
  const eB = corpsDe(cabApp, 'enchainerConfirmation');
  assert.ok(eA.length > 150 && eA === eB, 'les deux enchaînements ont divergé');
  // Entrée ne vole la main que tant que la confirmation est VIDE, et ne laisse pas la fenêtre valider.
  assert.ok(/confirmation\.value\) return;/.test(eA) && /stopPropagation\(\)/.test(eA) && /confirmation\.focus\(\)/.test(eA),
    'Entrée ne descend plus vers la confirmation, ou valide la fenêtre par-dessus');
  // CHAQUE formulaire à deux mots de passe neufs passe par le verdict et par l'enchaînement : la règle
  // se lit sur les formulaires, pas sur une liste recopiée (10.12.0 — un compte laisse passer le reste).
  const html = lireSource('src', 'cabinet', 'renderer', 'index.html');
  const paires = (html.match(/autocomplete="new-password"/g) || []).length + (cabApp.match(/autocomplete="new-password"/g) || []).length / 2;
  const verdictsCab = (app.match(/K\.verdictMotDePasse\(/g) || []).length;
  const chainesCab = (app.match(/enchainerConfirmation\((?!champ)/g) || []).length;
  assert.strictEqual(paires, 3, 'le Cabinet n\'a plus trois formulaires à deux mots de passe : relire ce test');
  assert.strictEqual(verdictsCab, paires, `${paires} formulaires à deux mots de passe, ${verdictsCab} passent par le verdict`);
  assert.strictEqual(chainesCab, paires, `${paires} formulaires à deux mots de passe, ${chainesCab} descendent sur Entrée`);
  const ent = sansCommentaires(entreprise);
  assert.strictEqual((entreprise.match(/autocomplete="new-password"/g) || []).length, 2, 'l\'app entreprise n\'a plus UNE paire de mots de passe neufs : relire ce test');
  assert.ok(/C\.verdictMotDePasse\(v\.password, v\.confirm, 6\)/.test(ent), 'la fenêtre du mot de passe de l\'app entreprise ne passe plus par le verdict');
  assert.ok(/enchainerConfirmation\(\$\('\[name=password\]', root\), \$\('\[name=confirm\]', root\)\)/.test(ent), 'Entrée ne descend plus vers la confirmation dans l\'app entreprise');
  // Le refus MONTRE la case : plus un seul toast, plus une seule phrase posée sans curseur.
  [app, ent].forEach(src => {
    // La PHRASE entière : « ils ne correspondent pas aux tiens » vit dans le mail des écritures, et
    // un test trop large accuse du code juste (9.4.7).
    assert.ok(!/mots de passe ne sont pas les mêmes|mots de passe ne correspondent pas/.test(src), 'la phrase qui disait faux sur une confirmation vide est revenue');
  });
  assert.ok(!/toast\('Huit caractères/.test(app), 'un refus de mot de passe du Cabinet ne fait plus qu\'un toast');
  assert.ok(/refus\(vm\.champ === 'confirmation' \? p2 : p1, vm\.message\)/.test(app), 'les fenêtres du Cabinet ne montrent plus la case refusée');
  const verrou = app.slice(app.indexOf('$(\'#lock-form\').onsubmit'), app.indexOf('const go = $(\'#lock-go\');'));
  assert.ok(verrou.length > 300 && verrou.length < 4000, 'la tranche de l\'écran du mot de passe est introuvable : ' + verrou.length);
  assert.ok(/champ\.focus\(\)/.test(verrou) && /champ-faute/.test(verrou) && /vm\.champ === 'confirmation' \? pw2 : pw/.test(verrou),
    'l\'écran de création ne montre plus la case refusée');
  // « Afficher » reste sur le chemin de Tab (règle 9.3.0) — donc il MONTRE qu'il a le curseur ; et la
  // ligne qui juge le mot de passe garde sa place avant d'avoir quelque chose à dire.
  assert.ok(!/id="lock-eye"[^>]*tabindex="-1"/.test(html), '« Afficher » est sorti de l\'ordre de tabulation : un chemin coupé au lieu d\'un ajouté');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/\.pw-eye:focus-visible \{[^}]*outline: 2px solid/.test(css), '« Afficher » ne montre pas qu\'il a le curseur');
  assert.ok(/\.ligne-reservee \{[^}]*min-block-size: 1lh/.test(css), 'la ligne de force ne réserve plus sa place');
  assert.ok(/\$\('#lock-strength'\)\.classList\.add\('ligne-reservee'\)/.test(app) && /class="muted small ligne-reservee" id="str"/.test(app),
    'une ligne de force pousse encore la confirmation pendant la frappe');
  assert.ok(/\.champ-faute > \.pw-wrap > input \{[^}]*border-color: var\(--danger\)/.test(css), 'une case refusée dans l\'enveloppe d\'« Afficher » ne se marque pas');
});
// 10.14.1 (#276) — le jumeau du test de l'app entreprise (10.14.0, 118 champs) : le Cabinet en avait
// 84 sans bulle — le salarié, le bulletin, le bien, le relevé, les mots de passe. Un comptable qui
// découvre l'écran d'un salarié se demande à quoi sert le poste, ce que fait la date de sortie : la
// bulle dit ce que le CODE fait du champ. La règle vaut pour tout le fichier ; les exceptions sont NOMMÉES.
t('10.14.1 : chaque champ du Cabinet porte sa bulle, et chaque bulle existe dans le guide', () => {
  const EXCEPTIONS = [
    /^\$\{lbl\(titre, cle\)\}/,           // les touches de la grille : la clé est portée par la ligne de la table TOUCHES
    /^<span>Recopie <b>/                   // confirmTyped : un mot de confirmation, pas un champ
  ];
  const champs = [...app.matchAll(/<(?:label|div) class="field[^"]*"[^>]*>([\s\S]{0,200}?)<(?:input|select|textarea)/g)].map(m => m[1].trim());
  assert.ok(champs.length > 100, 'la sonde ne voit plus les champs : ' + champs.length);
  const nus = champs.filter(x => !/info\(|\$\{lbl\([\s\S]*?,\s*'[a-zA-Z]+\.[a-zA-Z]+'\)\}/.test(x))
    .filter(x => !EXCEPTIONS.some(r => r.test(x)));
  assert.deepStrictEqual(nus, [], `${nus.length} champ(s) du Cabinet sans bulle — ${nus.map(x => x.slice(0, 50)).join(' · ')}`);
  EXCEPTIONS.forEach(r => assert.ok(champs.some(x => r.test(x)), 'exception sans objet : ' + r));
  const G = require('../../src/cabinet/renderer/cabguide.js');
  const cles = [...app.matchAll(/\blbl\([^\n]*?,\s*'([a-zA-Z]+\.[a-zA-Z]+)'\)/g)].map(m => m[1]);
  const absentes = [...new Set(cles)].filter(k => !G.INFO[k]);
  assert.deepStrictEqual(absentes, [], 'des bulles posées que le guide ne connaît pas');
  // Une bulle de paie mène à l'article de la paie, une de bien à celui des immobilisations.
  [['pa.sortie', 'paie'], ['pa.bAbsence', 'paie'], ['im.miseEnService', 'immobilisations'], ['bq.rDebut', 'banque'], ['li.rtMontant', 'liasse']]
    .forEach(([k, a]) => assert.strictEqual(G.articleDe(k), a, k + ' mène à « ' + G.articleDe(k) + ' »'));
});
};
