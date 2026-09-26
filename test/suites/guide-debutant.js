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
  assert.ok(i('#dc-controles') < i('#dc-preparer') && i('#dc-preparer') < i('#dc-formulaire [data-copier]') && i('#dc-deposee') === d.etapes.length - 1);
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
};
