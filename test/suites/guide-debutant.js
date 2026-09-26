'use strict';
// ============================================================================================
// Un comptable débutant, guidé par la bulle (10.14.1)
//
// Skander, 26/09 : « un comptable novice aurait appuyé sur le guide afin de le guider pour faire
// toutes les cases, et pas tout seul comme tu le fais ». Le Cabinet a donc été parcouru UNIQUEMENT
// par « Guide-moi » et « Me guider », bulle après bulle, sur un cabinet neuf et trois clients hors
// SkanFact. Ce que ces tests tiennent, c'est ce que ce parcours a trouvé :
//   - la bulle ne couvre plus un compte rendu (la fin attend la fenêtre) ;
//   - « Guide-moi » met en tête ce qu'on PEUT faire, et un geste bancaire attend son relevé ;
//   - le libellé de la ligne CLASSE les comptes proposés, il n'en ajoute aucun ;
//   - la déclaration fait préparer, dit son brouillard, et n'écrit rien sur un mois sans TVA ;
//   - une visite reprise après un changement de ses étapes retrouve son étape par son titre ;
//   - le panneau Sécurité ne menace pas un cabinet qui n'a reçu aucun paquet.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');
const V = require('../../src/renderer/visite.js');
const CV = require('../../src/cabinet/renderer/cabvisites.js');
const vm = require('vm');
const cab = lireSource('src', 'cabinet', 'renderer', 'app.js');
const moteur = lireSource('src', 'renderer', 'visite.js');

// Le plan de référence, tel que la grille et la fenêtre de la banque le proposent.
const plan = K.comptesProposables(Object.keys(K.PLAN_COMPTABLE).map(c => ({ compte: c, libelle: K.PLAN_COMPTABLE[c] })));
const comptes = (q, ctx) => K.comptesQuiCorrespondent(plan, q, 8, ctx).map(c => c.compte);

t('10.14.1 : le libellé de la ligne CLASSE les comptes proposés — il n\'en ajoute jamais un', () => {
  // « frais » tapé sur la ligne « FRAIS TENUE DE COMPTE » : 627 (services bancaires) en tête. Sans le
  // libellé, 627 n'est que cinquième — c'est exactement ce que le débutant voyait.
  assert.strictEqual(comptes('frais', 'FRAIS TENUE DE COMPTE')[0], '627');
  assert.notStrictEqual(comptes('frais')[0], '627', 'des données qui ne discriminent pas : sans libellé, 627 était déjà premier');
  assert.ok(K.comptesQuiCorrespondent(plan, 'frais', 8, 'FRAIS TENUE DE COMPTE')[0].parLibelle, 'le compte classé par le libellé ne le DIT pas');
  assert.strictEqual(comptes('client', 'VIR RECU CLIENT FACTURE 012')[0], '411');
  assert.strictEqual(comptes('steg', 'PRLV STEG FACTURE 2026-09')[0], '606');
  // Le libellé ne choisit pas : ce que la frappe n'a pas trouvé n'apparaît pas.
  assert.ok(!comptes('client', 'FRAIS TENUE DE COMPTE').includes('627'), 'le libellé a AJOUTÉ un compte que la frappe ne trouvait pas');
  // Sans libellé, rien ne bouge : l'ordre est celui d'avant.
  assert.deepStrictEqual(comptes('frais', ''), comptes('frais'));
});

t('10.14.1 : un champ de compte VIDE propose ce que le libellé nomme, et Tab n\'y prend pas le premier compte du plan', () => {
  // Vu en guidant un débutant : « Écrire » la ligne « PRLV STEG 4455 » ouvrait la liste sur « 101 Capital
  // social » en surbrillance, et la bulle disait « Tab prend le premier ».
  const steg = K.comptesQuiCorrespondent(plan, '', 8, 'PRLV STEG 4455');
  assert.strictEqual(steg[0].compte, '606', 'le libellé ne passe pas devant sur un champ vide');
  assert.ok(steg[0].parLibelle, 'le compte proposé par le libellé ne le DIT pas');
  const rien = K.comptesQuiCorrespondent(plan, '', 8, 'VIR XYZ');
  assert.ok(rien.length && !rien.some(c => c.parLibelle), 'un libellé qui ne nomme rien invente une proposition');
  // Tab sur un champ vide ne choisit que ce que le libellé nomme ou ce qu'on a désigné aux flèches.
  const f = cab.slice(cab.indexOf('function suggererCompte('), cab.indexOf('function vueSaisie('));
  assert.ok(f.length > 1500 && f.length < 6000, 'tranche inattendue : ' + f.length);
  assert.ok(/if \(items\[sel\] && \(input\.value\.trim\(\) \|\| items\[sel\]\.parLibelle \|\| choisiAuClavier\)\)/.test(f), 'Tab prend le premier compte du plan sur un champ vide');
  assert.ok(/ArrowDown'\) \{ ev\.preventDefault\(\); choisiAuClavier = true;/.test(f), 'désigner aux flèches ne compte plus comme un choix');
});

t('10.14.1 : chaque mot courant désigne un compte que le plan connaît', () => {
  // Le plan de référence nomme par préfixe (le plus long gagne) : un compte « connu » est un compte
  // que ce plan sait NOMMER.
  const inconnus = Object.keys(K.MOTS_COURANTS).filter(c => !K.libelleDuPlan(c));
  assert.deepStrictEqual(inconnus, [], 'un mot courant renvoie à un compte hors plan');
  assert.ok(K.motsCourantsDe('627').some(m => /frais/.test(m)), 'les frais bancaires ne mènent plus au 627');
});

t('10.14.1 : la grille et la fenêtre de la banque passent le libellé de la ligne aux comptes proposés', () => {
  assert.ok(/KC\.comptesQuiCorrespondent\(planDe\(\), input\.value, 8, contexteDe \? contexteDe\(\) : ''\)/.test(cab), 'la liste ne reçoit pas le libellé');
  assert.ok(/suggererCompte\(champC, [^\n]+, \(\) => ligne\.libelle\);/.test(cab), 'la fenêtre de la banque ne passe pas le libellé du relevé');
  assert.ok(/\}, \(\) => \(p\.lignes\[i\] && p\.lignes\[i\]\.libelle\) \|\| p\.libelle \|\| ''\);/.test(cab), 'la grille ne passe pas le libellé de la ligne');
  // Et la contrepartie proposée suit le SENS de la ligne : un virement reçu n'appelle pas 606.
  assert.ok(/Number\(ligne\.montant\) >= 0 \? '411, ou tape « client »' : '627, ou tape « frais »'/.test(cab), 'l\'invite de la contrepartie ignore le sens');
  assert.ok(/if \(!contre\.compte\) setTimeout\(\(\) => \{ try \{ champC\.focus\(\);/.test(cab), 'le curseur ne va pas à la case qu\'on doit remplir');
});

t('10.14.1 : une liste de comptes ouverte dans une fenêtre passe AU-DESSUS de la fenêtre', () => {
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const z = Number((/\.sugg-pop\.sugg-fixe\s*\{[^}]*z-index:\s*(\d+)/.exec(css) || [])[1]);
  // Les fenêtres commencent à 400 et s'empilent ; la bulle « i » (900) et le bandeau (950) restent dessus.
  assert.ok(z > 400 && z < 900, 'z-index de la liste : ' + z);
});

t('10.14.1 : la fin d\'une visite attend que la fenêtre ouverte se ferme', () => {
  const pos = moteur.slice(moteur.indexOf('function positionner('), moteur.indexOf('function versLaReprise('));
  assert.ok(/const finAttend = !!cur\.fin && !!fenetreOuverte\(\);/.test(pos), 'la carte de fin se pose par-dessus le compte rendu');
  assert.ok(/const mini = finAttend \|\|/.test(pos), 'la fin qui attend ne se réduit pas');
  assert.ok(/if \(cur\.fin && cur\.mini\) \{ dessinerFinAttente\(p\); return; \}/.test(moteur), 'la bulle d\'attente n\'est pas dessinée');
  // La bulle d'attente nomme la visite, jamais « Étape n+1 sur n ».
  const att = moteur.slice(moteur.indexOf('function dessinerFinAttente('), moteur.indexOf('function dessinerFinAttente(') + 900);
  assert.ok(/p\.titre/.test(att) && !/enTete\(/.test(att), 'la bulle d\'attente recompte les étapes');
});

t('10.14.1 : « Guide-moi » met en tête ce qu\'on peut faire, et ce qui attend un préalable après', () => {
  const v = (id, titre) => ({ id, titre, type: 'faire', resume: '', etapes: [{ page: '#/x' }] });
  const g = { page: null, ici: [v('rapprocher', 'Rapprocher la banque'), v('importer', 'Importer le relevé'), v('ecrire', 'Écrire une ligne')], ailleurs: [] };
  const menu = V.menuDuGuide(g, { lancer: () => {}, manque: x => (x.id !== 'importer' ? { texte: 'Il faut d\'abord le relevé.' } : null) });
  const labels = menu.map(a => a.label).filter(Boolean);
  assert.deepStrictEqual(labels.slice(0, 3), ['Importer le relevé', 'Rapprocher la banque', 'Écrire une ligne'], 'ordre : ' + labels.join(' | '));
  // Le préalable manquant est GRISÉ, pas retiré, et dit pourquoi.
  const r = menu.find(a => a.label === 'Rapprocher la banque');
  assert.ok(r.off && /^Pas encore/.test(r.hint));
});

t('10.14.1 : un geste bancaire attend son relevé, et dit quelle visite l\'importe', () => {
  const avec = n => CV.parcours({ state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D1', estExemple: () => false,
    cleSecours: () => null, copieExterne: () => false, Visite: V, releves: () => n });
  for (const id of ['rapprocher', 'ecrire-ligne-releve']) {
    const sans = avec(0).find(x => x.id === id);
    assert.strictEqual(sans.si(), false, id + ' se lance sans relevé');
    assert.strictEqual(sans.manque.visite, 'importer-releve', id + ' ne renvoie pas à l\'import');
    assert.strictEqual(avec(2).find(x => x.id === id).si(), true, id + ' refusé avec deux relevés');
    // « Je ne sais pas » (livre pas encore lu) n'est pas « non » : on propose.
    assert.strictEqual(avec(null).find(x => x.id === id).si(), true, id + ' caché faute de savoir');
  }
});

t('10.14.1 : après « Rapprocher », une ligne « Sans réponse » se dit, et son écriture est proposée en premier', () => {
  // Vu en guidant un débutant : « Tu sais rapprocher » au-dessus d'une ligne que rien n'avait rapprochée,
  // et « Et maintenant ? » proposait la visite de la page et le lettrage — jamais l'écriture qui manque,
  // parce qu'elle avait déjà été apprise une fois.
  const vs = CV.parcours({ state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D1', estExemple: () => false,
    cleSecours: () => null, copieExterne: () => false, Visite: V, releves: () => 1 });
  const r = vs.find(x => x.id === 'rapprocher');
  const avant = global.document;
  try {
    global.document = { querySelector: s => (s === '#bq-sans-reponse' ? { textContent: '2' } : null), querySelectorAll: () => [] };
    assert.deepStrictEqual(r.pressee(), ['ecrire-ligne-releve'], 'l\'écriture qui manque n\'est pas proposée');
    assert.ok(/2 lignes restent[\s\S]*Sans réponse[\s\S]*manque/.test(r.conclusion()), 'la fin ne dit pas ce qui reste : ' + r.conclusion());
    global.document = { querySelector: s => (s === '#bq-sans-reponse' ? { textContent: '0' } : null), querySelectorAll: () => [] };
    assert.deepStrictEqual(r.pressee(), [], 'une écriture proposée quand tout est rapproché');
    assert.ok(!/Sans réponse/.test(r.conclusion()), 'la fin parle d\'une ligne qui n\'existe pas');
  } finally { if (avant === undefined) delete global.document; else global.document = avant; }
  // L'écran porte le compte que la visite lit, et « Me guider » garde ce qui est pressé même déjà fait.
  assert.ok(/id="bq-sans-reponse">\$\{parNiveau\.aucun\}/.test(cab), 'la carte « Sans réponse » ne porte plus son identifiant');
  const z = cab.slice(cab.indexOf('suites: p => {'), cab.indexOf('fete: p =>'));
  assert.ok(z.length > 200 && z.length < 1500, 'tranche inattendue : ' + z.length);
  assert.ok(/const ids = \[\.\.\.presse, pas,/.test(z), 'ce qui est pressé ne passe pas devant');
  assert.ok(/ids\.filter\(id => presse\.includes\(id\) \|\| !et\.faites\[id\]\)/.test(z), 'une visite déjà apprise est écartée même quand l\'écran la réclame');
});

t('10.14.1 : la réussite d\'une visite s\'enregistre dès sa carte de fin — pas au clic sur « Terminer »', () => {
  // Fermer l'application sur la carte « Tu sais rapprocher » laissait une visite « arrêtée à l'étape
  // 2 sur 2 » à reprendre dans « Guide-moi ». La carte de réussite enregistre le geste ; une fin ratée
  // (la branche `echec`, qui sort avant) ne l'enregistre jamais.
  const vj = moteur.replace(/\/\/[^\n]*/g, '');
  const f = vj.slice(vj.indexOf('function dessinerFin('), vj.indexOf('function feter('));
  assert.ok(f.length > 1500 && f.length < 9000, 'tranche inattendue : ' + f.length);
  const echec = f.indexOf('if (cur.echec) {'), retour = f.indexOf('return;', echec), fete = f.indexOf('hote.fete(p)');
  const fini = f.search(/if \(neuve\) \{ try \{ hote\.fini\(p\); \}/);
  assert.ok(echec >= 0 && retour > echec, 'la fin ratée ne sort plus avant la réussite');
  assert.ok(fini > retour, 'la carte de réussite n\'enregistre pas la visite (ou une fin ratée l\'enregistre)');
  assert.ok(fini > fete, 'la visite s\'enregistre avant les confettis, qui lisent « déjà fait »');
});

t('10.14.1 : « Tu peux cliquer ce qui est éclairé » ne se dit pas sur un bouton éteint', () => {
  // « Valider le brouillard » éclaire d'abord « Enregistrer et valider », grisé tant que la grille est
  // vide : la bulle promettait un essai qui ne fait rien.
  const vj = moteur.replace(/\/\/[^\n]*/g, '');
  const f = vj.slice(vj.indexOf('function noteEssai('), vj.indexOf('function lierNommes('));
  assert.ok(f.length > 150 && f.length < 900, 'tranche inattendue : ' + f.length);
  const eteint = f.search(/el\.disabled \|\| \(el\.getAttribute && el\.getAttribute\('aria-disabled'\) === 'true'\)\)\) return false/);
  assert.ok(eteint > 0, 'un bouton éteint reçoit la phrase de l\'essai');
  assert.ok(eteint < f.indexOf('cur.noteEssai = cur.i'), 'l\'étape éteinte consomme la phrase : elle ne se dirait plus nulle part');
});

t('10.14.1 : la visite de la TVA fait préparer, dit son brouillard, et saute l\'écriture d\'un mois sans TVA', () => {
  const vs = CV.parcours({ state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D1', estExemple: () => false,
    cleSecours: () => null, copieExterne: () => false, Visite: V });
  const d = vs.find(x => x.id === 'declarer-tva');
  const cible = e => [].concat(e.cible).join(' ');
  // La première étape dont la cible COMMENCE par ce sélecteur : « Les étapes du mois » cite aussi
  // `#dc-preparer` en repli, et ne doit pas passer pour l'étape qui fait préparer.
  const i = s => d.etapes.findIndex(e => cible(e).startsWith(s));
  assert.ok(i('#dc-controles') >= 0 && d.etapes[i('#dc-controles')].si, 'le brouillard du mois n\'est jamais dit');
  assert.ok(i('#dc-preparer') >= 0 && d.etapes.some(e => cible(e) === '#dc-preparer' && e.faire === 'clic'), 'la visite ne fait pas préparer');
  const ec = d.etapes.find(e => cible(e) === '#dc-ecriture');
  assert.ok(ec && ec.faire === 'clic' && ec.si, 'l\'écriture du mois n\'est pas guidée, ou pas sautée quand elle est éteinte');
  // L'ordre : le brouillard avant de préparer, préparer avant de copier, le dépôt en dernier.
  assert.ok(i('#dc-controles') < i('#dc-preparer') && i('#dc-preparer') < d.etapes.findIndex(e => cible(e).startsWith('#dc-formulaire [data-copier')) && i('#dc-deposee') === d.etapes.length - 1);
});

// Un livre minimal : un mois avec de la TVA, un autre sans.
function livreDeTest(ecritures) {
  const l = K.livreVide('D1', 2026, { plan: [
    { compte: '4367', libelle: 'TVA collectée', role: 'tvaCollectee' },
    { compte: '4366', libelle: 'TVA déductible', role: 'tvaDeductible' },
    { compte: '4365', libelle: 'TVA à décaisser', role: 'tvaAPayer' }
  ] });
  ecritures.forEach((e, n) => l.ecritures.push({ id: 'E' + n, numero: n + 1, statut: 'validee', journal: 'OD', piece: 'P' + n, source: 'saisie', ...e }));
  return l;
}

t('10.14.1 : un mois sans TVA n\'a pas d\'écriture à passer — le moteur le dit AVANT le clic', () => {
  const livre = livreDeTest([
    { date: '2026-03-10', libelle: 'Vente', lignes: [{ compte: '411', debit: 119, credit: 0 }, { compte: '706', debit: 0, credit: 100 }, { compte: '4367', debit: 0, credit: 19 }] },
    { date: '2026-10-31', libelle: 'Frais bancaires', lignes: [{ compte: '627', debit: 12, credit: 0 }, { compte: '532', debit: 0, credit: 12 }] }
  ]);
  const oct = K.declarationMensuelle(livre, '2026-10');
  assert.strictEqual(oct.rienAEcrire, true, 'octobre ne porte aucune TVA');
  assert.strictEqual(K.ecritureDeclaration(livre, oct).lignes.length, 0, 'le moteur qui écrira dit autre chose que le bouton');
  const mars = K.declarationMensuelle(livre, '2026-03');
  assert.strictEqual(mars.rienAEcrire, false, 'mars a 19 DT de TVA à écrire');
  // Le pont refuse par la MÊME phrase que le bouton, jamais une seconde.
  const main = lireSource('src', 'cabinet', 'main.js');
  assert.ok(/if \(d\.rienAEcrire\) throw erreur\('ERR-CAB-042', KC\.MOTIF_RIEN_A_ECRIRE\);/.test(main), 'le pont a sa propre phrase');
  assert.ok(/rien \? esc\(KC\.MOTIF_RIEN_A_ECRIRE\)/.test(cab), 'le bouton éteint ne dit pas pourquoi');
});

t('10.14.1 : un zéro de retenue se colle dans la case de la RUBRIQUE, pas dans une phrase', () => {
  const livre = livreDeTest([{ date: '2026-10-31', libelle: 'Frais', lignes: [{ compte: '627', debit: 12, credit: 0 }, { compte: '532', debit: 0, credit: 12 }] }]);
  const f = K.formulaireMensuel(livre, K.declarationMensuelle(livre, '2026-10'));
  const rs0 = f.rubriques.flatMap(r => r.lignes || []).find(l => l.cle === 'rs0');
  assert.ok(rs0, 'la ligne « aucune retenue » manque');
  assert.strictEqual(rs0.caseCopie, 'Retenue à la source');
  assert.ok(/boutonCopie\(l\.cle, l\.montant, l\.caseCopie \|\| l\.libelle\)/.test(cab), 'le bouton de copie ignore la case');
});

t('10.14.1 : un contrôle de brouillard porte le geste qui le débloque', () => {
  assert.ok(/id="dc-controles"/.test(cab) && /c\.id === 'brouillard'[\s\S]{0,80}data-vers-saisie/.test(cab), 'le bandeau du brouillard n\'a pas de bouton');
  assert.ok(/\$\$\('\[data-vers-saisie\]', el\)\.forEach\(b => \{ b\.onclick = \(\) => allerSousOnglet\(root, dossier, 'saisie'\); \}\);/.test(cab), 'le bouton n\'est pas branché');
});

t('10.14.1 : une visite reprise retrouve son étape par son TITRE, et repart du début si elle a disparu', () => {
  const v = { etapes: ['A', 'B', 'C', 'D'].map(titre => ({ titre, page: '#/x' })) };
  // Une étape ajoutée devant : le rang 1 désigne désormais « B », le titre retrouve « C ».
  assert.strictEqual(V.pointDeReprise(v, { i: 1, titre: 'C' }).i, 2);
  const perdue = V.pointDeReprise(v, { i: 2, titre: 'Z' });
  assert.strictEqual(perdue.i, 0);
  assert.ok(/a changé/.test(perdue.note), 'la reprise ne dit pas pourquoi elle recommence');
  // Un point d'arrêt d'avant (sans titre) se reprend comme avant.
  assert.strictEqual(V.pointDeReprise(v, { i: 2 }).i, 2);
  assert.ok(/titre: c && c\.p && c\.p\.etapes\[c\.i\]/.test(moteur), 'le point d\'arrêt ne retient pas le titre');
});

t('10.14.1 : sans paquet VRAI reçu, la clé de secours ne se réclame ni en orange ni en vert', () => {
  const s = cab.slice(cab.indexOf('s.innerHTML = `<h2>Sécurité</h2>'), cab.indexOf('id="s-rec-in"'));
  assert.ok(s.length > 200 && s.length < 4000, 'tranche : ' + s.length);
  assert.ok(/recoveryAt === null && !paquetsReelsRecus\(\) \?/.test(s), 'le panneau crie avant le premier paquet');
  assert.ok(/recoveryAt === null && paquetsReelsRecus\(\) \? ' btn-primary'/.test(s), 'le bouton est vert sur un cabinet sans paquet');
});

t('10.14.1 : « 4 / 9 » ne se lit plus au-dessus de « Tout est en place »', () => {
  const p = cab.slice(cab.indexOf('progres: p => {'), cab.indexOf('suites: p => {'));
  const texte = (/texte: ([\s\S]+?) \};\n/.exec(p) || [])[1];
  assert.ok(texte, 'la phrase de progression est introuvable');
  const lire = pp => vm.runInNewContext(texte, { pp, pl: (n, un, plur) => `${n} ${n > 1 ? plur || un + 's' : un}` });
  assert.strictEqual(lire({ faits: 9, total: 9, suivante: null }), 'Tout est en place : ton cabinet est prêt.');
  assert.ok(/facultatives/.test(lire({ faits: 4, total: 9, suivante: null })), 'des étapes restantes passent pour faites');
  assert.ok(/^Prochaine étape : mettre/.test(lire({ faits: 3, total: 9, suivante: { titre: 'Mettre ton cabinet à l\'abri' } })));
});

t('10.14.1 : le solde de fin d\'un relevé dit, pendant la frappe, s\'il tombe juste', () => {
  const f = cab.slice(cab.indexOf('function releveForm('), cab.indexOf('const barreLivres'));
  assert.ok(/const juste = [^\n]*KC\.releveValide\(\{/.test(f), 'le verdict ne passe pas par la règle qui refusera');
  assert.ok(/Ça tombe juste/.test(f), 'aucun verdict pendant la frappe');
  // Le verdict se JOUE : `releveValide` refuse un relevé sans compte avant de compter, donc un
  // appel qui l'oublie ne dit jamais « juste » — la forme de l'appel ne le montrait pas.
  const appel = (/KC\.releveValide\((\{[^;]*?lignes: lu\.lignes \})\)\.ok/.exec(f) || [])[1];
  assert.ok(appel, 'l\'appel du verdict est introuvable');
  const juge = require('vm').runInNewContext('(' + appel + ')', { v: n => ({ compte: '', debut: '7 260,500', fin: '8 140,100' })[n],
    KC: K, lu: { lignes: [{ montant: 980 }, { montant: -88.4 }, { montant: -12 }] } });
  assert.strictEqual(K.releveValide(juge).ok, true, 'un relevé qui boucle ne se dit pas juste : ' + K.releveValide(juge).motif);
  // Lus tous les deux dans le fichier, les soldes se jugent aussi — APRÈS le début, sinon la fin se
  // comparait à un 0.
  const lus = f.slice(f.indexOf('const soldesLus'), f.indexOf('const proposerDebut'));
  assert.ok(lus.length > 200, 'tranche soldesLus suspecte');
  const iDebut = lus.indexOf('champDebut.value ='), iVerdict = lus.indexOf("verdictFin('lu dans le relevé')");
  assert.ok(iDebut > 0 && iVerdict > iDebut, 'des soldes lus dans le relevé ne disent pas s\'ils tombent juste, ou le disent avant de connaître le début');
});
t('10.14.1 : cliquer dans une case pour y ÉCRIRE n\'ouvre pas l\'essai — cliquer un contrôle, si', () => {
  // Un faux DOM : chaque élément connaît ses ancêtres, `closest` et `matches` jouent les sélecteurs
  // dont le moteur se sert (la balise, le type d'un input).
  const el = (tag, attrs, parent) => {
    const e = { tagName: tag.toUpperCase(), type: (attrs || {}).type || '', parent, enfants: [] };
    if (parent) parent.enfants.push(e);
    const ok = sel => sel.split(',').map(x => x.trim()).some(x => {
      const m = /^([a-z]+)((?::not\(\[type=[a-z]+\]\))*)$/.exec(x) || /^([a-z]+)(\[type=[a-z]+\])$/.exec(x);
      if (!m) return false;
      if (m[1] !== tag) return false;
      if (!m[2]) return true;
      if (m[2].startsWith('[')) return m[2] === `[type=${e.type}]`;
      return !(m[2].match(/type=([a-z]+)/g) || []).some(n => n === `type=${e.type}`);
    });
    e.matches = ok;
    e.closest = sel => { for (let n = e; n; n = n.parent) if (n.matches(sel)) return n; return null; };
    e.querySelector = sel => { const f = n => { for (const c of n.enfants) { if (c.matches(sel)) return c; const r = f(c); if (r) return r; } return null; }; return f(e); };
    return e;
  };
  const lab = el('label', {}); const texte = el('input', { type: 'text' }, lab); const info = el('button', {}, lab);
  assert.strictEqual(V.ouvreEssai(texte), false, 'une case de texte dans son libellé ouvre l\'essai : la bulle part dans le coin au milieu de la saisie');
  assert.strictEqual(V.ouvreEssai(lab), false, 'cliquer le libellé d\'une case de texte ouvre l\'essai');
  assert.strictEqual(V.ouvreEssai(info), true, 'la bulle « i » posée dans le libellé n\'est plus un contrôle');
  const lab2 = el('label', {}); const liste = el('select', {}, lab2);
  assert.strictEqual(V.ouvreEssai(liste), true, 'une liste qui s\'ouvre est un essai');
  const lab3 = el('label', {}); const coche = el('input', { type: 'checkbox' }, lab3);
  assert.strictEqual(V.ouvreEssai(coche), true, 'une case à cocher est un geste');
  const zone = el('textarea', {}, el('label', {}));
  assert.strictEqual(V.ouvreEssai(zone), false);
  assert.strictEqual(V.ouvreEssai(el('div', {})), false, 'un clic sur du vide n\'est pas un essai');
});

t('10.14.1 : « Contre-passer ou extourner » ouvre le menu d\'une pièce ordinaire, jamais celui des à-nouveaux', () => {
  // Sur un livre repris, la première ligne du livre-journal est l'ouverture (AN) : son menu ne propose
  // pas l'extourne, et son miroir tombe au 1er janvier — la bulle, qui dit « aujourd'hui » et
  // « extourner », décrivait un autre menu que celui qu'elle éclairait (vu en guidant un débutant).
  const src = lireSource('src', 'cabinet', 'renderer', 'cabvisites.js');
  const debut = src.indexOf('const pieceOrdinaire = () => {');
  assert.ok(debut > 0, 'pieceOrdinaire introuvable');
  const fin = src.indexOf('\n    };', debut) + 7;
  const corps = src.slice(debut, fin);
  assert.ok(corps.length < 800, 'tranche inattendue');
  const visiteCp = src.slice(src.indexOf("id: 'contre-passer'"), src.indexOf("id: 'abonnement'"));
  assert.ok(/cible: pieceOrdinaire,[^\n]*faire: 'clic'/.test(visiteCp), 'le geste « Contre-passer ou extourner » ne vise plus la pièce ordinaire');
  const bouton = (journal, cle) => {
    const tr = { children: [{ textContent: '1' }, { textContent: '01/01/2026' }, { textContent: journal }] };
    return { cle, closest: () => tr };
  };
  const an = bouton('AN', 'E:an'), bq = bouton('BQ', 'E:bq');
  const document = { querySelectorAll: () => [an, bq], querySelector: () => an };
  const f = vm.runInNewContext('(' + corps.replace('const pieceOrdinaire = ', '').replace(/;\s*$/, '') + ')', { document });
  assert.strictEqual(f().cle, 'E:bq', 'le menu éclairé est celui des à-nouveaux');
  const seul = { querySelectorAll: () => [an], querySelector: () => an };
  assert.strictEqual(vm.runInNewContext('(' + corps.replace('const pieceOrdinaire = ', '').replace(/;\s*$/, '') + ')', { document: seul })().cle, 'E:an', 'sans pièce ordinaire, le premier menu reste éclairé');
});

t('10.14.1 : une étape qui MONTRE le menu ouvert garde sa bulle entière (la liste ouverte n\'est pas une gêne quand elle est la zone)', () => {
  // « Choisir, ou refermer » éclaire le menu d'actions ; la bulle se rangeait dans un coin parce qu'une
  // liste était ouverte — la seule étape faite pour expliquer ce menu ne se lisait jamais.
  const src = lireSource('src', 'renderer', 'visite.js');
  const debut = src.indexOf('const toutesListes = cur.fin ? [] : listesOuvertes();');
  assert.ok(debut > 0, 'la lecture des listes ouvertes a changé de forme');
  const zone = src.slice(src.lastIndexOf('const dansLaZone', debut), debut + 400);
  assert.ok(zone.length < 900, 'tranche inattendue');
  const dansLaZone = vm.runInNewContext('(' + /const dansLaZone = (l => [^;]+);/.exec(zone)[1] + ')', { zoneEl: null });
  const item = { contains: () => false }, liste = { contains: x => x === item }, autre = { contains: () => false };
  const avec = vm.runInNewContext('(' + /const dansLaZone = (l => [^;]+);/.exec(zone)[1] + ')', { zoneEl: item });
  assert.strictEqual(avec(liste), true, 'le menu qui contient la cible compte comme une gêne');
  assert.strictEqual(avec(autre), false, 'une autre liste ouverte ne range plus la bulle');
  assert.strictEqual(dansLaZone(liste), false, 'sans zone, toute liste doit ranger la bulle');
  assert.ok(/const listes = toutesListes\.filter\(l => !dansLaZone\(l\)\);/.test(zone), 'les listes qui rangent la bulle ne sont plus filtrées par la zone');
  assert.ok(/zoneEstUneListe\) cur\.defile = true;/.test(src), 'la page défile sous un menu ouvert — il se referme');
});

t('10.14.1 : le nom d\'un onglet lu par la visite ne porte pas son repère (« Comptabilité● »)', () => {
  // Le point « une pièce commencée n'est pas enregistrée » vit DANS le bouton de l'onglet ; la liste
  // des onglets l'écrivait collé au nom.
  const V = require('../../src/renderer/visite.js');
  let retire = false;
  const repere = { remove: () => { retire = true; } };
  const clone = {
    querySelectorAll: sel => (/\[role="img"\]/.test(sel) ? [repere] : []),
    get textContent() { return 'Comptabilité' + (retire ? '' : '●'); }
  };
  const el = { getAttribute: () => null, matches: () => false, classList: { contains: () => false }, cloneNode: () => clone };
  assert.strictEqual(V.libelleDe(el), 'Comptabilité');
});

t('10.14.1 : la visite d\'un écran de dossier explique CET onglet, sans chapitres sur les autres', () => {
  // La visite du livre-journal enchaînait sur « Suivi » (les relances du client), hors de l'écran.
  const moteur = lireSource('src', 'renderer', 'visite.js');
  const debut = moteur.indexOf('function etapesDeLaVue(opts) {');
  const corps = moteur.slice(debut, moteur.indexOf('\n  function ouvrirOnglet', debut));
  assert.ok(corps.length > 500 && corps.length < 5000, 'tranche inattendue');
  const actif = corps.indexOf("if (o.onglets === 'actif') continue;");
  const chapitres = corps.indexOf("chapitre: nom");
  assert.ok(actif > 0 && actif < chapitres, 'le mode « onglet ouvert » ne coupe plus les chapitres des autres onglets');
  const cv = lireSource('src', 'cabinet', 'renderer', 'cabvisites.js');
  assert.ok(/etapesDeLaVue\(\{ onglets: sorte \? 'actif' : true \}\)/.test(cv), 'la visite d\'un écran de dossier lit tous les onglets de la fiche');
});

t('10.14.1 : « Me guider » ne met pas la découverte devant un premier pas du métier (les deux apps)', () => {
  // Un cabinet qui tient déjà trois clients voyait « Pour commencer : Charger l'exemple et découvrir »
  // en vert, à la place de ce qui lui manquait — la découverte est FACULTATIVE (10.14.0).
  const lire = (src, nomPas) => {
    const m = src.match(/const decouvrirDabord = ([^;]+);/);
    assert.ok(m, 'la règle de la découverte a une seule ligne');
    const debut = src.indexOf('const decouvrirDabord');
    const suite = src.slice(debut, debut + 1200);
    assert.ok(/: decouvrirDabord\s*\n\s*\?/.test(suite), 'le héros suit cette règle');
    assert.ok(/titreHero = [^\n]*decouvrirDabord \?/.test(src), 'le titre du héros suit la même règle');
    return (ctx) => vm.runInNewContext(m[1], ctx);
  };
  const cabR = lire(cab, 'pasPret');
  const ent = lireSource('src', 'renderer', 'app.js');
  const entR = lire(ent, 'pas');
  const dec = { id: 'decouvrir' };
  const nonFaite = { faites: {} }, faite = { faites: { decouvrir: true } };
  // Cabinet : un premier pas prêt → pas la découverte ; exemple chargé → la découverte ; rien n'attend → la découverte.
  assert.strictEqual(cabR({ dec, et: nonFaite, exemple: false, pasPret: true }), false);
  assert.strictEqual(cabR({ dec, et: nonFaite, exemple: true, pasPret: true }), true);
  assert.strictEqual(cabR({ dec, et: nonFaite, exemple: false, pasPret: false }), true);
  assert.strictEqual(cabR({ dec, et: faite, exemple: true, pasPret: false }), false);
  // L'app entreprise, la même règle.
  assert.strictEqual(entR({ dec, et: nonFaite, exemple: false, pas: { visite: {} } }), false);
  assert.strictEqual(entR({ dec, et: nonFaite, exemple: true, pas: { visite: {} } }), true);
  assert.strictEqual(entR({ dec, et: nonFaite, exemple: false, pas: null }), true);
});

t('10.14.1 : un lien d\'une phrase se dit par la page où il mène — jamais « ce qui est nommé »', () => {
  // Les Échéances : « ils se règlent dans Réglages » — la bulle disait « Ouvre ce qui est nommé ».
  const lien = (href, txt) => ({ id: '', dataset: {}, textContent: txt,
    getAttribute: a => (a === 'href' ? href : null),
    matches: s => String(s).split(',').map(x => x.trim()).some(x => x === 'a[href^="#/"]'),
    classList: { contains: () => false }, closest: () => null, querySelector: () => null,
    cloneNode: () => ({ querySelectorAll: () => [], textContent: txt }) });
  const S = require('../../src/renderer/visites.js');
  const a = CV.expliquer(lien('#/reglages', 'Réglages'), { route: () => 'echeances', G: { INFO: {} } });
  const b = S.expliquer(lien('#/clients', 'Clients'), { route: () => 'dashboard', G: { INFO: {} } });
  assert.ok(a && /« Réglages »/.test(a.texte) && !/ce qui est nommé/.test(a.texte), JSON.stringify(a));
  assert.ok(b && /« Clients »/.test(b.texte), JSON.stringify(b));
});

t('10.14.1 : un client repris en cours d\'année ne se voit rien réclamer avant son début de mission', () => {
  // Un cabinet qui reprend la Boulangerie en septembre voyait mai, juin et juillet « à saisir » en
  // rouge sous « Déjà passées » : les déclarations de son prédécesseur. Le « Début de mission » de la
  // fiche promettait l'inverse (« rien n'est réclamé »), et ne changeait rien aux Échéances.
  const C = require('../../src/cabinet/cabcore.js');
  const index = { exercices: [{ annee: 2026, du: '2026-01-01', au: '2026-12-31', production: {
    '2026-03': { ecritures: 4, validees: 4, brouillards: 0 }
  } }] };
  const sans = { id: 'B', name: 'Boulangerie', matricule: 'B', manual: true, packs: [] };
  const avec = { ...sans, from: '2026-08' };
  const mois = d => C.productionDuDossier(d, index, '2026-09-26', 10).map(m => m.mois);
  // Sans début de mission : tout l'exercice, de janvier à août.
  assert.deepStrictEqual(mois(sans), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
  // Avec début de mission en août : août seulement — et mars, qui PORTE des écritures, reste.
  assert.deepStrictEqual(mois(avec), ['2026-03', '2026-08'], 'les mois d\'avant la mission restent à saisir');
  // Les Échéances lisent la même chose : la TVA de mai ne réclame plus la Boulangerie.
  const tva = (d, lab) => C.echeances(C.migrate({ dossiers: [d] }), '2026-09-26', { avant: 5, apres: 1, tenus: { B: index } })
    .find(e => e.label === lab);
  const mai = tva(sans, 'TVA de mai 2026');
  assert.ok(mai && mai.aSaisir.includes('Boulangerie'), 'sans début de mission, mai est bien à saisir : ' + JSON.stringify(mai));
  const maiAvec = tva(avec, 'TVA de mai 2026');
  assert.ok(!maiAvec || !maiAvec.aSaisir.includes('Boulangerie'), 'la TVA de mai réclame encore un client repris en août');
  const aout = tva(avec, 'TVA d\'août 2026');
  assert.ok(aout && aout.aSaisir.includes('Boulangerie'), 'août, lui, reste à saisir');
});

t('10.14.1 : « Déjà passées » dit comment écarter les mois du prédécesseur, et ouvre la fiche sur la case', () => {
  const debut = cab.indexOf('function aideDebutDeMission(');
  const zone = cab.slice(debut, cab.indexOf('// ---------- écritures regroupées', debut));
  assert.ok(debut > 0 && zone.length > 500 && zone.length < 16000, 'tranche inattendue');
  assert.ok(/const aideMission = aideDebutDeMission\(passees\);/.test(zone) && /brancherAideDebutDeMission\(view\);/.test(zone),
    'la page ne pose ni ne branche plus l\'aide');
  assert.ok(/filter\(d => d && !d\.from\)/.test(zone), 'l\'aide se montre même quand le début de mission est posé');
  assert.ok(/<h2>Déjà passées \$\{info\('ec\.passees'\)\}<\/h2>\$\{aideMission\}/.test(zone), 'l\'aide ne vit plus sous « Déjà passées »');
  assert.ok(/dossierForm\(d, \{ focus: '#f-from' \}\)/.test(zone), 'le bouton n\'ouvre pas la fiche sur « Début de mission »');
});

t('10.14.1 : une date remplie d\'office ne se dit pas « garde ce qui est écrit » — elle se vérifie sur la pièce', () => {
  // La saisie propose la date d'aujourd'hui : « Déjà rempli — garde ce qui est écrit » faisait passer
  // une facture d'août en septembre, sa TVA avec elle (vu au guide, parcours du comptable novice).
  assert.ok(/\$\{e\.rempli \|\| 'Cette case est déjà remplie/.test(moteur), 'le moteur ignore la phrase propre à l\'étape');
  assert.ok(/e\.rempli \? ICONE_INFO \+ 'À vérifier'/.test(moteur), 'une case à vérifier se coche « Déjà rempli » en vert');
  const vues = [];
  const faux = { dossier: () => ({ id: 'D' }), premier: () => null, exercices: () => [2026], Visite: V };
  CV.parcours(faux).filter(p => ['saisir-piece', 'saisir-vente', 'saisir-achat'].includes(p.id)).forEach(p => {
    const date = p.etapes.find(e => e.cible === '#sa-date');
    assert.ok(date && date.faire === 'valeur', p.id + ' : pas d\'étape de date');
    assert.ok(/aujourd.hui/.test(date.rempli || ''), p.id + ' : la date d\'aujourd\'hui se laisse garder sans un mot');
    vues.push(p.id);
  });
  assert.deepStrictEqual(vues.sort(), ['saisir-achat', 'saisir-piece', 'saisir-vente']);
});

t('10.14.1 : la date d\'une facture se tape jour/mois — « le jour seul » garde le mois déjà écrit', () => {
  // `dateTapee('12')` prend le mois de la case, c'est-à-dire aujourd'hui au début : « 12 » pour une
  // facture d'août donnait le 12 septembre (vu au guide). La bulle promettait « le mois vient de
  // l'exercice ».
  const Kc = require('../../src/cabinet/cabcore.js');
  assert.strictEqual(Kc.dateTapee('12', 2026, '2026-09-26'), '2026-09-12', 'le jour seul ne garde plus le mois de la case');
  assert.strictEqual(Kc.dateTapee('12/08', 2026, '2026-09-26'), '2026-08-12');
  const faux = { dossier: () => ({ id: 'D' }), premier: () => null, exercices: () => [2026], Visite: V };
  CV.parcours(faux).filter(p => ['saisir-piece', 'saisir-vente', 'saisir-achat'].includes(p.id)).forEach(p => {
    const date = p.etapes.find(e => e.cible === '#sa-date');
    assert.ok(/\//.test((date.essai || {}).taper || ''), p.id + ' : l\'essai tape le jour seul');
    assert.ok(!/jour seul suffit|viennent de l.exercice/.test(date.texte + ' ' + date.action), p.id + ' : la bulle promet que le jour seul suffit');
  });
  assert.ok(!/jour seul suffit/.test(lireSource('src', 'cabinet', 'renderer', 'cabvisites.js')), 'une bulle dit encore « le jour seul suffit »');
});

t('10.14.1 : une étape « tape ceci » sur une case y pose le curseur — Tab sur le compte tombait sur le libellé', () => {
  // Sans ça, « Dans la case Débit, tape 1190 » partait dans le libellé de la ligne.
  const d = moteur.slice(moteur.indexOf('function dessinerBulle('), moteur.indexOf('function noteEssai('));
  assert.ok(d.length > 2000 && d.length < 60000, 'tranche inattendue');
  assert.ok(/if \(faire && e\.faire === 'valeur' && champ && !cur\.perdu && !cur\.curseur\)/.test(d), 'le curseur n\'est pas posé dans la case');
  assert.ok(/c\.focus\(\{ preventScroll: true \}\)/.test(d));
  assert.ok(/cur\.curseur = false/.test(moteur), 'le curseur ne se repose pas à chaque étape');
  assert.ok(!/<kbd>Tab<\/kbd> la passe/.test(lireSource('src', 'cabinet', 'renderer', 'cabvisites.js')), 'une bulle demande encore de passer le libellé au Tab');
});

t('10.14.1 : une visite reprise revient à la première case que le temps a vidée', () => {
  // L'application refermée vide la grille ; la visite reprenait sur le montant d'une pièce sans compte.
  const et = [{ faire: 'valeur' }, { faire: 'valeur', rempli: 'x' }, { faire: 'valeur' }, { faire: 'valeur' }, { faire: 'valeur' }, { faire: 'clic' }];
  // 0 journal (fait), 1 date par défaut (toujours « remplie »), 2 pièce vide, 3 libellé vide, 4 montant
  assert.strictEqual(V.valeurDefaiteAvant(et, 4, j => j === 0 || j === 1), 1, 'la date par défaut, vidée avec la pièce, est sautée');
  assert.strictEqual(V.valeurDefaiteAvant(et, 4, j => j <= 3), -1, 'tout est rempli : la reprise reste où elle est');
  assert.strictEqual(V.valeurDefaiteAvant(et, 4, j => (j === 2 ? null : true)), -1, 'une case absente fait revenir en arrière');
  assert.strictEqual(V.valeurDefaiteAvant(et, 2, () => false), 0, 'au-delà de l\'étape visée');
  const lancer = moteur.slice(moteur.indexOf('function lancer('), moteur.indexOf('function entrer('));
  assert.ok(/valeurDefaiteAvant\(copie\.etapes, depuis,/.test(lancer), 'lancer ne regarde pas les cases vidées');
  assert.ok(/if \(vide >= 0\) depuis = vide;[\s\S]{0,40}entrer\(depuis, 1\)/.test(lancer), 'lancer ne reprend pas sur la case vidée');
});

t('10.14.1 : « 7 % » ne se coupe pas avant son signe — dans la bulle comme dans la prose', () => {
  const C = require('../../src/renderer/core.js');
  assert.strictEqual(C.typoFr('à 7 % ou'), 'à 7\u202f% ou');
  assert.strictEqual(V.typo('à 7 % ou'), 'à 7\u202f% ou');
});

// Joué à la souris : dans la déclaration, « ← » ne ramenait pas à « Le mois à déclarer » — l'étape
// d'entre les deux (« ce mois n'est pas fini ») est un geste qui ne s'applique pas sur un mois terminé.
t('10.14.1 : « ← » saute une étape qui ne s\'applique pas, comme « → » à l\'aller', () => {
  const debut = moteur.indexOf('function etapeAvant(');
  assert.ok(debut > 0, 'le retour ne cherche plus l\'étape qui s\'applique');
  const corps = moteur.slice(debut, moteur.indexOf('\n  function peutReculer(', debut));
  const cur = { p: { etapes: [{ titre: 'mois' }, { titre: 'pas fini', faire: 'clic', si: () => false }, { titre: 'étapes' }, { titre: 'boom', si: () => { throw new Error('x'); } }, { titre: 'fin' }] } };
  const ctx = { cur };
  vm.runInNewContext(corps + '\nthis.f = etapeAvant;', ctx);
  assert.strictEqual(ctx.f(2), 0, '« ← » depuis « Les étapes du mois » ne revient pas à « Le mois »');
  assert.strictEqual(ctx.f(4), 2, 'une étape dont la condition lève doit se sauter');
  assert.strictEqual(ctx.f(0), -1);
  const pr = moteur.slice(moteur.indexOf('function peutReculer('), moteur.indexOf('function peutReculer(') + 400);
  assert.ok(/const j = etapeAvant\(cur\.i\);/.test(pr) && /cur\.p\.etapes\[j\]/.test(pr), 'peutReculer juge encore l\'étape d\'à côté, même quand elle ne s\'applique pas');
  assert.ok(/entrer\(etapeAvant\(cur\.i\), -1\)/.test(moteur), '« ← » recule encore d\'un seul cran');
});

// Joué en novice : « Écrire l'écriture du mois » la pose au brouillard, et la fin de la visite n'en
// disait rien — « Et maintenant ? » proposait une visite de page.
t('10.14.1 : la fin de « Déclarer la TVA » dit le brouillard du mois et propose de le valider', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const v = CV.parcours(ctx).find(x => x.id === 'declarer-tva');
  const avant = global.document;
  try {
    global.document = { querySelector: sel => (sel === '#dc-controles [data-vers-saisie]' ? {} : null) };
    assert.deepStrictEqual(v.pressee(), ['valider-lot'], 'un brouillard du mois ne propose pas de le valider');
    assert.ok(/en brouillard/.test(v.conclusion()) && /validée/.test(v.conclusion()), 'la fin tait le brouillard du mois');
    global.document = { querySelector: () => null };
    assert.deepStrictEqual(v.pressee(), []);
    assert.ok(!/en brouillard/.test(v.conclusion()), 'la fin parle d\'un brouillard qui n\'existe pas');
    // Et la visite commence par le mois — on déclare un mois TERMINÉ.
    assert.strictEqual(v.etapes[0].cible, '#dc-mois');
    assert.ok(/terminé/.test(v.etapes[0].texte));
    // On copie un montant qui compte : la TVA collectée, pas la première case venue (souvent 0).
    const copier = v.etapes.find(e => e.titre === 'Copier un montant');
    assert.strictEqual([].concat(copier.cible)[0], '#dc-formulaire [data-copier="tvaI"]');
  } finally { if (avant === undefined) delete global.document; else global.document = avant; }
});

// Joué en novice, de retour du portail : « Déclarer la TVA » ne faisait pas noter le dépôt, le guide
// de la page la disait « Fait », et la page Échéances ignorait le dépôt noté dans la Déclaration —
// deux pense-bêtes pour une même déclaration, deux vérités.
t('10.14.1 : le dépôt noté dans la Déclaration d\'un client le compte « déposé » sur la page Échéances', () => {
  const KC = require('../../src/cabinet/cabcore.js');
  const jour = '2026-09-26';
  const S = KC.migrate({ settings: { relanceDay: 10 }, dossiers: [
    { id: 'a', name: 'Pharmacie Ennour', manual: true, from: '2026-01', packs: [] },
    { id: 'b', name: 'Café Sidi', manual: true, from: '2026-01', packs: [] }
  ] });
  const tenu = { exercices: [{ annee: 2026, du: '2026-01-01', au: '2026-12-31', production: { '2026-08': { ecritures: 3, validees: 3, brouillards: 0 } } }] };
  const tenus = { a: tenu, b: tenu };
  const aout = o => KC.echeances(S, jour, Object.assign({ tenus }, o)).find(e => e.id === 'tva-m' && e.mois.includes('2026-08'));
  // Personne n'a déposé : aucune carte n'est déposée d'office.
  const rien = aout({});
  assert.deepStrictEqual(rien.deposes, []);
  assert.strictEqual(rien.toutDepose, false);
  assert.strictEqual(rien.prets, 2);
  // Un client déposé dans sa Déclaration : il sort des « prêts », la carte ne l'est pas encore.
  const un = aout({ declares: { a: ['2026-08'] } });
  assert.deepStrictEqual(un.deposes, ['Pharmacie Ennour'], 'le dépôt noté dans la Déclaration ne compte pas sur la carte');
  assert.strictEqual(un.prets, 1);
  assert.strictEqual(un.toutDepose, false);
  // Un AUTRE mois déclaré ne vaut rien pour août.
  assert.deepStrictEqual(aout({ declares: { a: ['2026-07'] } }).deposes, [], 'un autre mois déposé compte pour août');
  // Les deux : la carte est déposée, sans second pointage.
  const tous = aout({ declares: { a: ['2026-08'], b: ['2026-08'] } });
  assert.strictEqual(tous.toutDepose, true, 'tous les clients déposés, et la carte réclame encore');
  // « À faire » lit la même donnée que la page (règle 6.8.1).
  assert.ok(/declares: \(opts \|\| \{\}\)\.declares/.test(lireSource('src', 'cabinet', 'cabcore.js')), '« À faire » ne lit pas les dépôts des Déclarations');
  assert.ok(/declares: declaresConnus\(\) \}\);/.test(cab) && /K\.echeances\(S, null, \{[^}]*declares: declaresConnus\(\)/.test(cab), 'la page ne passe pas les dépôts');
  assert.ok(/const depose = K\.echeanceDeposee\(S, e\) \|\| !!e\.toutDepose;/.test(cab), 'la carte ignore toutDepose');
  // Le pont rend les mois déclarés de TOUT dossier (tenu ou non), tirés des index.
  const main = lireSource('src', 'cabinet', 'main.js');
  assert.ok(/const declares = \[\]\.concat\(\.\.\.\(i\.exercices \|\| \[\]\)\.map\(e => Object\.keys\(e\.production \|\| \{\}\)\.filter\(m => \(e\.production\[m\] \|\| \{\}\)\.declare\)\)\)/.test(main));
  assert.ok(/\|\| r\.declares\.length\);/.test(main), 'un dossier qui n\'a que des dépôts est filtré du résumé');
});

t('10.14.1 : « Noter le dépôt et le paiement » est un geste guidé, prouvé sur le bouton, et il suit « Déclarer la TVA »', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const liste = CV.parcours(ctx);
  const v = liste.find(x => x.id === 'deposer-tva');
  assert.ok(v && v.type === 'faire', 'le retour du portail n\'a pas de geste guidé');
  const decl = liste.find(x => x.id === 'declarer-tva');
  assert.ok(decl.suite.includes('deposer-tva'));
  const avant = global.document;
  try {
    const bouton = (t2, off) => ({ textContent: t2, disabled: !!off });
    let dep = bouton('Marquer déposée');
    const pay = bouton('Marquer payée', true);
    global.document = { querySelector: sel => (sel === '#dc-deposee' ? dep : sel === '#dc-payee' ? pay : null) };
    assert.deepStrictEqual(decl.pressee(), ['deposer-tva'], 'la fin de « Déclarer la TVA » ne propose pas de noter le dépôt');
    assert.strictEqual(v.preuve(), false, 'la visite se dit réussie sans dépôt');
    const geste = v.etapes.find(e => e.cible === '#dc-deposee');
    assert.strictEqual(geste.faire, 'clic');
    assert.strictEqual(geste.si(), true);
    dep = bouton('✓ Déposée le 26/09/2026 — annuler');
    assert.strictEqual(v.preuve(), true);
    assert.strictEqual(geste.si(), false, 'le geste se redemande sur un mois déjà déposé');
    assert.deepStrictEqual(decl.pressee(), [], 'noter le dépôt se propose sur un mois déjà déposé');
    // Des chiffres à préparer d'abord : l'étape « Préparer » ne se montre QUE si le dépôt est éteint.
    const prep = v.etapes.find(e => e.cible === '#dc-preparer');
    dep = bouton('Marquer déposée', true);
    assert.strictEqual(prep.si(), true);
    dep = bouton('Marquer déposée');
    assert.strictEqual(prep.si(), false, 'on fait recalculer des chiffres déjà prêts');
    // Le paiement est facultatif : un débutant n'a pas forcément payé le jour du dépôt.
    assert.strictEqual(v.etapes.find(e => e.cible === '#dc-payee').facultatif, true);
    // La fin ne promet que ce que l'application tient : la page Échéances et la Production.
    assert.ok(/Échéances/.test(v.conclusion) && /déclaré/.test(v.conclusion) && !/calendrier tant qu/.test(v.conclusion));
  } finally { if (avant === undefined) delete global.document; else global.document = avant; }
});

t('10.14.1 : « Valider le brouillard » ne montre pas un bouton de grille éteint à qui vient seulement valider', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const v = CV.parcours(ctx).find(x => x.id === 'valider-lot');
  const e = v.etapes[0];
  assert.strictEqual(e.titre, 'Valider en enregistrant');
  const avant = global.document;
  try {
    global.document = { querySelector: () => ({ disabled: true }) };
    assert.strictEqual(e.si(), false, 'la bulle éclaire un bouton éteint');
    global.document = { querySelector: () => ({ disabled: false }) };
    assert.strictEqual(e.si(), true);
  } finally { if (avant === undefined) delete global.document; else global.document = avant; }
});

// Suivie au guide par un débutant, « Faire la paie » montrait trois boutons et le laissait seul
// devant deux fenêtres de dix cases. Chaque case OBLIGATOIRE de la fiche du salarié a maintenant
// son geste — lues dans le formulaire, jamais recopiées : une case obligatoire ajoutée demain sans
// sa bulle ferait tomber ce test —, et les deux « Enregistrer » sont des gestes prouvés.
t('10.14.1 : « Faire la paie » fait remplir chaque case obligatoire du salarié, puis le bulletin, au guide', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const v = CV.parcours(ctx).find(x => x.id === 'paie-cabinet');
  assert.ok(v && v.type === 'faire', 'la paie n\'est plus un parcours guidé');
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const f = app.indexOf('function salarieForm(');
  const form = app.slice(f, app.indexOf('function bulletinForm(', f));
  assert.ok(form.length > 1000 && form.length < 8000, 'tranche du formulaire suspecte : ' + form.length);
  const obligatoires = [...form.matchAll(/field obligatoire[^>]*>[\s\S]{0,200}?<input name="([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(obligatoires.sort(), ['brut', 'embauche', 'nom'], 'les cases obligatoires de la fiche ont changé : ' + obligatoires);
  obligatoires.forEach(n => {
    const e = v.etapes.find(x => x.cible === '#modal-root [name="' + n + '"]');
    assert.ok(e && e.faire === 'valeur' && !e.facultatif, 'la case obligatoire « ' + n + ' » n\'a pas de geste dans la visite');
  });
  // Deux fenêtres, deux « Enregistrer » prouvés par la fenêtre refermée — pas par le clic.
  const enreg = v.etapes.filter(e => e.cible === '#modal-root #ok');
  assert.strictEqual(enreg.length, 2);
  enreg.forEach(e => assert.ok(e.faire === 'clic' && typeof e.fait === 'function', 'un « Enregistrer » avance sur le clic seul'));
  ['#pa-salarie', '#pa-bulletin', '#pa-ecrire'].forEach(c =>
    assert.ok(v.etapes.some(e => e.cible === c && e.faire === 'clic'), 'le geste ' + c + ' manque'));
  // Le salarié déjà déclaré ne se redemande pas : « + Salarié » ne s'éclaire que si « + Bulletin » est éteint.
  const avant = global.document;
  try {
    global.document = { querySelector: sel => (sel === '#pa-bulletin' ? { disabled: false } : null) };
    assert.strictEqual(v.etapes.find(e => e.cible === '#pa-salarie').si(), false, 'on fait redéclarer un salarié qui existe');
    global.document = { querySelector: sel => (sel === '#pa-bulletin' ? { disabled: true } : null) };
    assert.strictEqual(v.etapes.find(e => e.cible === '#pa-salarie').si(), true);
  } finally { if (avant === undefined) delete global.document; else global.document = avant; }
});

// Le jumeau de la règle de l'app entreprise (10.12.0), jamais porté au Cabinet : « Jours d'absence »
// prérempli à 0, un clic à gauche du chiffre, « 2 » tapé… 20 jours. La règle est JOUÉE sur une fausse
// page : un champ de nombre ou un montant en texte (`.num`) se sélectionne quand la PERSONNE y entre.
t('10.14.1 : un champ de nombre prérempli du Cabinet se remplace à la frappe (clic ou Tab), jamais sur un focus du code', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('let nombreJusteEntre = null, entreeVoulue = false;');
  assert.ok(i > 0, 'le Cabinet n\'a plus la règle des champs de nombre');
  const fin = app.indexOf('nombreJusteEntre = null;\n  });', i);
  const bloc = app.slice(i, fin + 'nombreJusteEntre = null;\n  });'.length);
  assert.ok(bloc.length > 400 && bloc.length < 2000, 'tranche suspecte : ' + bloc.length);
  const ecoute = {};
  const document = { addEventListener: (type, fn) => { ecoute[type] = fn; } };
  vm.runInNewContext(bloc, { document });
  const champ = (type, cls, value, extra) => {
    const el = Object.assign({ tagName: 'INPUT', type, value, readOnly: false, disabled: false, choisi: 0,
      classList: { contains: c => (cls || '').split(' ').includes(c) } }, extra);
    el.select = () => { el.choisi++; };
    return el;
  };
  const entrer = (el, par) => {
    if (par === 'clic') ecoute.pointerdown({});
    else ecoute.keydown({ key: par });
    ecoute.focusin({ target: el });
    return el.choisi;
  };
  assert.strictEqual(entrer(champ('number', '', '0'), 'clic'), 1, 'un nombre prérempli ne se sélectionne pas au clic');
  assert.strictEqual(entrer(champ('text', 'num montant', '1 200,000'), 'clic'), 1, 'un montant en texte ne se sélectionne pas au clic');
  assert.strictEqual(entrer(champ('text', 'num', '26'), 'Tab'), 1, 'Tab n\'entre pas comme un clic');
  assert.strictEqual(entrer(champ('number', '', '0'), 'Enter'), 0, 'un focus rendu par le code (Entrée) sélectionne ce qu\'on vient de taper');
  assert.strictEqual(entrer(champ('text', '', 'Sami'), 'clic'), 0, 'un champ de texte ordinaire se sélectionne');
  assert.strictEqual(entrer(champ('number', '', ''), 'clic'), 0, 'un champ vide n\'a rien à sélectionner');
  assert.strictEqual(entrer(champ('number', '', '5', { readOnly: true }), 'clic'), 0, 'un champ en lecture seule se sélectionne');
  // Le `mouseup` du même clic ne défait pas la sélection ; le suivant, si.
  const el = champ('number', '', '0');
  entrer(el, 'clic');
  let bloque = 0;
  ecoute.mouseup({ target: el, preventDefault: () => { bloque++; } });
  ecoute.mouseup({ target: el, preventDefault: () => { bloque++; } });
  assert.strictEqual(bloque, 1, 'le relâchement du clic défait la sélection, ou le second clic ne place plus le curseur');
});

// Suivie au guide, « Préparer la CNSS » montrait « Le fichier CNSS attend 2 corrections » et se
// taisait : le matricule de l'employeur et le numéro d'assuré sont justement ce qu'un débutant ne sait
// pas où taper. Chaque correction que l'écran peut demander — lue dans le panneau, jamais recopiée — a
// son geste, et seulement quand elle est là.
t('10.14.1 : « Préparer la CNSS » fait corriger au guide ce qui bloque le fichier, et saute ce qui est déjà complet', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const v = CV.parcours(ctx).find(x => x.id === 'cnss');
  assert.ok(v && !v.sansGeste, 'la CNSS se dit encore « sans geste »');
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const f = app.indexOf('function panneauFichierCnss(');
  const panneau = app.slice(f, app.indexOf('function avertissementsCnss(', f));
  assert.ok(panneau.length > 500 && panneau.length < 4000, 'tranche suspecte : ' + panneau.length);
  // Les gestes que le panneau pose : les deux champs de l'employeur, et le numéro d'assuré.
  assert.ok(/data-pa-emp="\$\{esc\(r\.champ\)\}"/.test(panneau) && /cnss: 'cnss'/.test(panneau), 'le panneau ne pose plus ses gestes');
  const attendus = ['[data-pa-emp="employeur"]', '[data-pa-emp="code"]', '[data-pa-sal][data-pa-champ="cnss"]'];
  const avant = global.document;
  try {
    global.document = { querySelector: () => null };
    attendus.forEach(c => {
      const e = v.etapes.find(x => x.cible === c);
      assert.ok(e && e.faire === 'clic', 'la correction ' + c + ' n\'a pas de geste');
      assert.strictEqual(e.si(), false, 'on fait corriger ' + c + ' sur un dossier déjà complet');
    });
    const present = new Set(attendus);
    global.document = { querySelector: sel => (present.has(sel) ? {} : null) };
    attendus.forEach(c => assert.strictEqual(v.etapes.find(x => x.cible === c).si(), true));
    // Les cases à taper dans les deux fenêtres, puis leurs « Enregistrer » prouvés fenêtre refermée.
    ['#modal-root #f-cnss', '#modal-root [name="cnss"]'].forEach(c => {
      const e = v.etapes.find(x => x.cible === c);
      assert.ok(e && e.faire === 'valeur', 'la case ' + c + ' n\'a pas de geste');
    });
    const enreg = v.etapes.filter(e => e.cible === '#modal-root #ok');
    assert.strictEqual(enreg.length, 2);
    enreg.forEach(e => assert.ok(typeof e.fait === 'function', 'un « Enregistrer » avance sur le clic seul'));
  } finally { if (avant === undefined) delete global.document; else global.document = avant; }
});

// Suivie au guide, « Ajouter un bien et ses dotations » montrait « Ajouter un bien… » puis laissait le
// débutant seul devant seize cases. Chaque case OBLIGATOIRE de la fiche du bien — lue dans le
// formulaire — a son étape : à taper quand rien ne la remplit, expliquée quand elle est proposée
// (le compte 22). « Ajouter » est prouvé par la fenêtre refermée, et l'aperçu qui grandit réserve sa
// place : sans ça, « Ajouter » descendait de 41 px sous le curseur au moment où le plan paraissait.
t('10.14.1 : « Ajouter un bien » fait remplir au guide chaque case obligatoire de la fiche, et « Ajouter » ne bouge pas', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const v = CV.parcours(ctx).find(x => x.id === 'biens');
  assert.ok(v && v.type === 'faire', 'les biens ne sont plus un parcours guidé');
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const f = app.indexOf('function immoForm(');
  const form = app.slice(f, app.indexOf('function vuePaie(', f));
  assert.ok(form.length > 3000 && form.length < 14000, 'tranche du formulaire suspecte : ' + form.length);
  const obligatoires = [...form.matchAll(/field obligatoire[^>]*>[\s\S]{0,200}?<(?:input|select) name="([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(obligatoires.slice().sort(), ['compte', 'dateMiseEnService', 'duree', 'libelle', 'valeur'], 'les cases obligatoires de la fiche ont changé : ' + obligatoires);
  // Une case obligatoire que le formulaire propose (une valeur par défaut NON vide, `f.compte || '22'`)
  // s'explique ; les autres se tapent.
  const preremplie = n => new RegExp('<input name="' + n + '"[^>]*value="\\$\\{esc\\(f\\.' + n + ' \\|\\| \'[^\']').test(form);
  obligatoires.forEach(n => {
    const e = v.etapes.find(x => x.cible === '#modal-root [name="' + n + '"]');
    assert.ok(e, 'la case obligatoire « ' + n + ' » n\'a aucune étape dans la visite');
    if (!preremplie(n)) assert.ok(e.faire === 'valeur' && !e.facultatif, 'la case « ' + n + ' » est à taper, et la visite ne la fait pas taper');
  });
  assert.ok(preremplie('compte'), 'le compte du bien n\'est plus proposé : son étape doit le faire taper');
  const ajouter = v.etapes.filter(e => e.cible === '#modal-root #ok');
  assert.strictEqual(ajouter.length, 1);
  assert.ok(ajouter[0].faire === 'clic' && typeof ajouter[0].fait === 'function', '« Ajouter » avance sur le clic seul');
  assert.ok(v.etapes.some(e => e.cible === '#modal-root #im-apercu'), 'le plan n\'est plus montré avant d\'ajouter');
  // L'aperçu réserve la hauteur de son encadré (règle 10.12.0 des annonces vivantes).
  assert.ok(/<div id="im-apercu" class="[^"]*\bannonce-stable encadre\b/.test(form), 'l\'aperçu du plan ne réserve plus sa place : « Ajouter » bouge sous le curseur');
  const css = lireSource('src', 'renderer', 'style.css');
  assert.ok(/\.annonce-stable\.encadre > \.ok-box/.test(css), 'l\'encadré vert du plan garde sa marge et dépasse la place réservée');
});

// Suivie au guide, « Saisir l'inventaire » éclairait le bouton et s'arrêtait : un débutant sans
// tableur ouvert ne savait pas quoi mettre dans la zone des lignes. La zone a son geste (et dit qu'on
// peut TAPER, point-virgule entre les valeurs), « Enregistrer l'inventaire » est prouvé par la
// fenêtre refermée, la variation se lit avant d'être écrite, et l'aperçu réserve sa place.
t('10.14.1 : « Saisir l\'inventaire » fait taper les lignes au guide, et « Enregistrer » ne bouge pas', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const v = CV.parcours(ctx).find(x => x.id === 'inventaire');
  assert.ok(v && v.type === 'faire', 'l\'inventaire n\'est plus un parcours guidé');
  const lignes = v.etapes.find(e => e.cible === '#modal-root #iv-lignes');
  assert.ok(lignes && lignes.faire === 'valeur' && !lignes.facultatif, 'les lignes comptées ne se font pas taper au guide');
  assert.ok(/point-virgule/.test(lignes.texte), 'la bulle ne dit pas qu\'on peut taper les lignes sans tableur');
  // L'exemple donné se lit vraiment : sinon la bulle ferait taper une ligne que la fenêtre refuse.
  const ex = (lignes.essai && lignes.essai.taper) || '';
  const lu = require('../../src/renderer/compta.js').lignesInventaireDepuisTexte(ex);
  assert.ok(lu.lignes.length === 1 && !lu.refus.length, 'l\'exemple de la bulle est refusé par la fenêtre : ' + ex);
  const enreg = v.etapes.filter(e => e.cible === '#modal-root #ok');
  assert.strictEqual(enreg.length, 1);
  assert.ok(enreg[0].faire === 'clic' && typeof enreg[0].fait === 'function', '« Enregistrer l\'inventaire » avance sur le clic seul');
  const iVar = v.etapes.findIndex(e => e.cible === '#iv-variation');
  const iEcr = v.etapes.findIndex(e => e.cible === '#iv-ecrire');
  assert.ok(iVar > 0 && iVar < iEcr, 'la variation ne se lit pas avant d\'être écrite');
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const f = app.indexOf('function inventaireForm(');
  const form = app.slice(f, app.indexOf('const banqueState', f));
  assert.ok(form.length > 1500 && form.length < 8000, 'tranche du formulaire suspecte : ' + form.length);
  assert.ok(/<div id="iv-apercu" class="[^"]*\bannonce-stable encadre\b/.test(form), 'le total de l\'inventaire ne réserve plus sa place : « Enregistrer » bouge sous le curseur');
});
// Suivie au guide, « Réviser un dossier » s'arrêtait à « ouvre une feuille, signe » : ni la note ni la
// question ne se tapaient, et la première étape se sautait toute seule — elle comptait les menus du
// volet replié « comptes hors cycle », cachés mais présents. Une fois arrêtée, la révision n'avait
// plus aucun vert alors qu'une question attendait d'être envoyée.
t('10.14.1 : « Réviser un dossier » se fait au guide, du cycle à la question, et l\'envoi reste l\'étape suivante', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const v = CV.parcours(ctx).find(x => x.id === 'reviser');
  assert.ok(v && v.type === 'faire', 'la révision n\'est plus un parcours guidé');
  const cibles = v.etapes.map(e => [].concat(e.cible).join('|'));
  const ouvre = v.etapes[0];
  assert.ok([].concat(ouvre.cible).includes('#rv-suivant') && typeof ouvre.fait === 'function', 'le premier geste n\'ouvre plus un cycle, ou avance sur le clic seul');
  ['[data-act="signer-compte"]', '#modal-root #nv-texte', '#modal-root #nv-ok', '#modal-root #qf-texte', '#modal-root #qf-ok']
    .forEach(c => assert.ok(cibles.includes(c), 'la visite ne guide plus « ' + c + ' »'));
  ['#modal-root #nv-texte', '#modal-root #qf-texte'].forEach(c => {
    const e = v.etapes.find(x => x.cible === c);
    assert.ok(e.faire === 'valeur' && !e.facultatif, 'la case « ' + c + ' » ne se fait pas taper');
  });
  ['#modal-root #nv-ok', '#modal-root #qf-ok'].forEach(c => {
    const e = v.etapes.find(x => x.cible === c);
    assert.ok(typeof e.fait === 'function', '« ' + c + ' » avance sur le clic seul, même quand l\'enregistrement refuse');
  });
  // La première étape ne se juge que sur un menu VISIBLE : un <details> fermé cache ses lignes.
  const det = { open: false, parentElement: null };
  const fauxEl = o => ({ isConnected: true, closest: s => (s === 'details' ? det : null), getBoundingClientRect: () => ({ width: 80, height: 24 }), ...o });
  global.getComputedStyle = () => ({ visibility: 'visible', display: 'block', opacity: '1' });
  try {
    assert.strictEqual(V2.visible(fauxEl()), false, 'une ligne d\'un volet replié passe pour visible : la visite éclaire du vide');
    det.open = true;
    assert.strictEqual(V2.visible(fauxEl()), true);
  } finally { delete global.getComputedStyle; }
  // Le menu d'un compte pose la clé que la visite vise.
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/cle: c\.revu \? '[a-z-]+' : 'signer-compte'/.test(app), 'le menu d\'un compte ne pose plus « signer-compte » : la visite éclaire la troisième entrée');
  // Une note vide se MONTRE (refus), pas seulement un message.
  const nf = app.indexOf('function noteForm(');
  const note = app.slice(nf, app.indexOf('\n  function ', nf + 20));
  assert.ok(/if \(!t\) return refus\(/.test(note), 'une note vide ne montre pas sa case');
  // L'envoi d'une question en attente est l'étape suivante, révision arrêtée ou non.
  const m = app.match(/const suivante = (d\.faite \? [^;]+|aEnvoyer \? [^;]+);/);
  assert.ok(m, 'le calcul de l\'étape suivante de la révision a changé de forme');
  const vm = require('vm');
  const jouer = o => vm.runInNewContext(m[1], Object.assign({ ouvertIncomplet: false, prochain: null, horsARevoir: 0 }, o));
  assert.strictEqual(jouer({ aEnvoyer: true, d: { faite: true } }), 'envoyer', 'une révision arrêtée n\'a plus de vert alors qu\'une question attend');
  assert.strictEqual(jouer({ aEnvoyer: false, d: { faite: true } }), '');
  assert.strictEqual(jouer({ aEnvoyer: true, d: { faite: false } }), 'envoyer');
});
// Suivie au guide, la clôture n'était qu'un regard, et un contrôle « à voir » disait quoi faire
// (« Prépare-les dans l'onglet Déclaration ») sans porter le geste. Chaque contrôle mène à l'écran où
// il se règle ; la visite fait ouvrir la question, la fait relire, et laisse la clôture en CHOIX.
t('10.14.1 : « Clôturer un exercice » se fait au guide, et chaque contrôle « à voir » porte son geste', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const v = CV.parcours(ctx).find(x => x.id === 'cloturer');
  assert.ok(v && v.type === 'faire' && !v.sansGeste, 'la clôture n\'est plus un parcours guidé');
  const ouvre = v.etapes.find(e => e.cible === '#cl-cloturer');
  assert.ok(ouvre && ouvre.faire === 'clic' && typeof ouvre.fait === 'function', '« Clôturer l\'exercice… » avance sur le clic seul');
  const conf = v.etapes.find(e => e.cible === '#modal-root #ok');
  assert.ok(conf && conf.facultatif && typeof conf.fait === 'function', 'la confirmation de la clôture est imposée, ou avance sur le clic seul');
  assert.ok(/Annuler/.test(conf.texte) && /Passer cette étape/.test(conf.texte), 'la dernière étape ne dit pas comment ne PAS clôturer');
  // Chaque contrôle que le moteur produit a un libellé et un geste, vers un écran qui existe.
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const table = nom => { const i = app.indexOf('const ' + nom + ' = {'); return require('vm').runInNewContext('(' + app.slice(i + ('const ' + nom + ' = ').length, app.indexOf('};', i) + 1) + ')'); };
  const LIB = table('LIBELLE_CONTROLE'), GESTE = table('GESTE_CONTROLE');
  const i0 = app.indexOf('const GROUPES_COMPTA = [');
  const onglets = [...app.slice(i0, app.indexOf('];', i0)).matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
  const compta = lireSource('src', 'renderer', 'compta.js');
  const f = compta.indexOf('function controlesCloture(');
  const ids = [...compta.slice(f, compta.indexOf('\n  }\n', f)).matchAll(/id: '([a-z]+)'/g)].map(m => m[1]);
  assert.ok(ids.length >= 8, 'tranche des contrôles suspecte : ' + ids);
  ids.forEach(id => {
    assert.ok(LIB[id], 'le contrôle « ' + id + ' » n\'a pas de libellé : l\'écran affiche son identifiant');
    assert.ok(GESTE[id], 'le contrôle « ' + id + ' » n\'a pas de geste : l\'écran le nomme sans l\'ouvrir');
    assert.ok(onglets.includes(GESTE[id][0]), 'le geste du contrôle « ' + id + ' » mène à un écran qui n\'existe pas : ' + GESTE[id][0]);
  });
  // La ligne « à voir » POSE son bouton, et le bouton est branché.
  assert.ok(/!c\.ok && GESTE_CONTROLE\[c\.id\] \? [^:]*data-ctrl=/.test(app), 'une ligne « à voir » ne porte plus son bouton');
  assert.ok(/\$\$\('\[data-ctrl\]', el\)\.forEach\(b => \{ b\.onclick/.test(app), 'le bouton d\'un contrôle n\'est plus branché');
  // Un panneau nommé par le geste existe à l'arrivée.
  Object.values(GESTE).filter(g => g[2]).forEach(g => assert.ok(app.includes('id="' + g[2] + '"'), 'le geste vise un panneau qui n\'existe pas : ' + g[2]));
});
// Suivie au guide, la liasse demandait un taux par une consigne que le moteur n'affichait pas (une
// étape « regarder » ne montre pas son action), ajoutait un retraitement sans jamais le montrer, et
// finissait sur le modèle de rubriques recouvert par la carte de fin.
t('10.14.1 : « Établir la liasse » se fait au guide, taux, retraitement et modèle', () => {
  const V2 = require('../../src/renderer/visite.js');
  const ctx = { state: () => ({ cabinet: {}, dossiers: [] }), dossier: () => 'D', estExemple: () => false, cleSecours: () => null, copieExterne: () => false, Visite: V2 };
  const v = CV.parcours(ctx).find(x => x.id === 'liasse');
  assert.ok(v && v.type === 'faire', 'la liasse n\'est plus un parcours guidé');
  const et = v.etapes, idx = c => et.findIndex(e => (Array.isArray(e.cible) ? e.cible : [e.cible]).includes(c));
  // Le taux : aucune valeur proposée (le taux dépend du droit), et la consigne vit dans le TEXTE.
  const taux = et[idx('#li-taux')];
  assert.ok(taux && !taux.faire && !taux.essai, 'le taux d\'impôt est devenu un geste avec un essai : un taux serait proposé');
  assert.ok(/pour cent/.test(taux.texte), 'l\'étape du taux ne dit plus dans quelle unité le taper');
  const ok = et[idx('#li-taux-ok')];
  assert.ok(ok && typeof ok.si === 'function', '« Enregistrer le taux » est demandé même quand la case est vide');
  // Le retraitement ajouté se MONTRE, après « Ajouter », et la table porte l'identifiant visé.
  const ajout = idx('#modal-root #rt-ok'), table = idx('#li-rt-table');
  assert.ok(ajout >= 0 && table > ajout, 'la visite ne montre plus la ligne ajoutée');
  assert.ok(typeof et[table].si === 'function', 'la table des retraitements est visée même quand il n\'y en a aucune');
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(app.includes('id="li-rt-table"'), 'la table des retraitements ne porte plus l\'identifiant que la visite vise');
  // Le dernier geste ouvre le modèle : l'étape d'après le montre, et dit comment refermer.
  const der = et[et.length - 1];
  assert.ok(idx('#li-modele') === et.length - 2 && der.si && /Annuler/.test(der.texte), 'la fenêtre du modèle, ouverte en dernier, n\'a plus son étape');
});

t('10.14.1 : la fiche société fait taper la banque et le RIB, et la fiche client se remplit case par case (au guide)', () => {
  // Un débutant qui suit la bulle ne remplit que ce qu'elle lui fait remplir : le RIB se LISAIT
  // (« garde-le à jour »), la fiche client sautait le contact, la retenue, le timbre, la devise.
  const S = require('../../src/renderer/visites.js');
  const vs = S.parcours({ data: () => ({ clients: [], documents: [], catalog: [] }), premier: () => null,
    estDemo: () => false, editeur: () => false, Visite: V, G: { INFO: {} } });
  const etapes = id => { const v = vs.find(x => x.id === id); assert.ok(v, id); return v.etapes; };
  const geste = (et, cible) => { const e = et.find(x => String(x.cible).includes(cible)); assert.ok(e, 'aucune étape sur ' + cible); return e; };
  const soc = etapes('societe');
  ['input[name="bank"]', 'input[name="rib"]'].forEach(c => {
    const e = geste(soc, c);
    assert.ok(e.faire === 'valeur' && e.facultatif && e.action && e.essai && e.essai.taper, c + ' n\'est pas un geste facultatif qu\'on tape');
  });
  const cli = etapes('premier-client');
  ['name="name"', 'name="contact"', 'withholdingRate', 'stampExempt', 'name="currency"', 'name="email"', 'name="phone"', 'address'].forEach(c => geste(cli, c));
  // La retenue dit l'attestation, et que le taux reste à vérifier.
  assert.ok(/attestation/i.test(geste(cli, 'withholdingRate').texte) && /VÉRIFIER/.test(geste(cli, 'withholdingRate').texte));
  // Enregistrer vient en dernier.
  assert.ok(/Enregistrer/.test(cli[cli.length - 1].titre), cli[cli.length - 1].titre);
  // La prestation : chaque case de la fiche a son étape, dans l'ordre du formulaire.
  const art = etapes('article');
  const ordre = ['name="label"', 'textarea[name="description"]', 'name="unitPrice"', 'name="unitCost"', 'name="vatRate"', '#cat-unit', 'name="tracked"', 'name="serialized"', 'name="minStock"', 'name="location"', 'name="initialQty"', 'name="initialCost"']
    .map(c => art.indexOf(geste(art, c)));
  assert.deepStrictEqual(ordre.slice().sort((x, y) => x - y), ordre, 'les étapes de la prestation ne suivent pas le formulaire');
  assert.ok(/VÉRIFIER/.test(geste(art, 'vatRate').texte), 'le taux de TVA ne dit pas qu\'il se vérifie');
  // Le devis : chaque case de l'en-tête a son étape, dans l'ordre de l'écran.
  const dev = etapes('premier-devis');
  const ordreDev = ['clientId', 'name="date"', 'name="dueDate"', 'name="subject"', 'name="reference"', 'projectId', 'name="lang"', 'name="currency"', 'name="status"', 'name="discountRate"']
    .map(c => dev.indexOf(geste(dev, c)));
  assert.deepStrictEqual(ordreDev.slice().sort((x, y) => x - y), ordreDev, 'les étapes du devis ne suivent pas l\'en-tête');
  // Une autre devise choisie SUR l'étape de la devise fait paraître le taux, obligatoire : il a son
  // étape juste après, avant le statut (vu à la souris — sinon « Enregistrer » refusait une case
  // que la visite n'avait jamais montrée).
  // … et chaque case de la ligne, unité et TVA comprises, dans l'ordre de la ligne.
  const ordreLigne = ['data-k="label"', 'data-k="qty"', 'data-k="unit"', 'data-k="unitPrice"', 'data-k="vatRate"'].map(c => dev.indexOf(geste(dev, c)));
  assert.deepStrictEqual(ordreLigne.slice().sort((x, y) => x - y), ordreLigne, 'les étapes de la ligne ne suivent pas la ligne');
  assert.ok(/VÉRIFIER/.test(geste(dev, 'data-k="vatRate"').texte), 'la TVA de la ligne ne dit pas qu\'elle se vérifie');
  // Sous les lignes : la marge, les pièces jointes et les notes, avant « Enregistrer ».
  const iEnreg = dev.indexOf(geste(dev, '#save'));
  ['#totals', '#p-pj', '#notes'].forEach(c => assert.ok(dev.indexOf(geste(dev, c)) < iEnreg, c + ' n\'est pas guidé avant « Enregistrer »'));
  assert.ok(/marge estimée/i.test(geste(dev, '#totals').texte), 'la marge estimée, sous les totaux, n\'est pas expliquée');
  // Lancée depuis un devis neuf déjà ouvert, la visite ne ramène pas à la liste pour recliquer
  // « Nouveau devis » : on croyait le devis perdu (vu au guide).
  const avantLoc = globalThis.location;
  try {
    globalThis.location = { hash: '#/doc/new/devis' };
    assert.ok(typeof dev[0].si === 'function' && dev[0].si() === false, 'dans un devis neuf, la visite renvoie cliquer « Nouveau devis »');
    globalThis.location = { hash: '#/devis' };
    assert.strictEqual(dev[0].si(), true, 'depuis la liste, « Nouveau devis » n\'est plus demandé');
  } finally { if (avantLoc === undefined) delete globalThis.location; else globalThis.location = avantLoc; }
  const iDevise = ordreDev[7], iStatut = ordreDev[8];
  const tauxApres = dev.slice(iDevise + 1, iStatut).find(e => /exchangeRate/.test(String(e.cible)));
  assert.ok(tauxApres && tauxApres.faire === 'valeur' && typeof tauxApres.si === 'function',
    'après l\'étape de la devise, le taux de change qui paraît n\'est pas guidé');
  ['minStock', 'location', 'initialQty', 'initialCost'].forEach(c => assert.ok(geste(art, c).si, 'la case ' + c + ' s\'éclaire même quand le suivi en stock n\'est pas coché'));
});
};
