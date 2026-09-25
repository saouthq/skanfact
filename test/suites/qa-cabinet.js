'use strict';
// ============================================================================================
// Le rapport QA du 23/09/2026 — un expert-comptable a tenu le Cabinet comme s'il l'utilisait depuis
// des mois (10.10.0)
//
// Chaque test porte le numéro du constat qu'il tient (C-nn) et se prouve en réintroduisant le
// défaut : un test qui ne peut pas échouer est pire que pas de test (7.2.0). Les tests purs bâtissent
// un vrai livre depuis les paquets de l'exemple — c'est sur ce livre-là que la liasse tombait à côté.
module.exports = ({ t, assert, lireSource }) => {
const fs = require('fs'), path = require('path');
const K = require('../../src/renderer/compta.js');
const core = require('../../src/renderer/core.js');

function livreDeLExemple() {
  const commis = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'cabinet', 'exemple-paquets.json'), 'utf8'));
  const annee = Number(commis.mois[0].mois.slice(0, 4));
  const livre = K.livreVide('MF:TEST', annee);
  commis.mois.slice().sort((a, b) => a.mois.localeCompare(b.mois)).forEach((m, i) => {
    const csv = m.fichiers.find(f => f.chemin === 'journaux/ecritures.csv').texte;
    K.importerPaquet(livre, m.mois, K.piecesDepuisLignes(K.entreesDepuisCsv(csv)), true, 'test', 1000 + i);
  });
  return livre;
}
const sansComm = src => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const cabApp = () => {
  const src = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const net = sansComm(src);
  assert.ok(net.includes('function drawLivres('), 'le nettoyage des commentaires a mangé le code');
  return net;
};

// ---------------------------------------------------------------- C-08 · la liasse

t('C-08 : la liasse d\'un dossier alimenté par SkanFact tombe juste, et ne laisse AUCUN compte dehors', () => {
  const l = livreDeLExemple();
  const lignes = K.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au });
  const li = K.liasseDepuisLignes(lignes, K.soldesDepuisOuverture(l), {});
  // Les deux orphelins du rapport : le 28 nu (le moteur écrit ses dotations sur « 28 », la liasse
  // cherchait 281/282/283) et le 13 DÉBITEUR (une perte reportée, que la rubrique n'acceptait pas
  // parce qu'elle ne prenait qu'un sens). Ensemble, ils faisaient l'écart au millime.
  assert.deepStrictEqual(li.orphelins, [], 'des comptes sortent de la liasse : ' + JSON.stringify(li.orphelins));
  assert.ok(li.equilibre, `actif ${li.totalActif} ≠ passif ${li.totalPassif}`);
  assert.ok(li.coherent);
  // Et la liasse dit la MÊME chose que les états financiers de l'onglet Exercice — le contre-exemple
  // du rapport, qui tombait juste pendant que la liasse ne tombait pas.
  const etats = K.etatsDepuisLignes(lignes, K.soldesDepuisOuverture(l), {});
  assert.strictEqual(li.totalActif, etats.totalActif, 'la liasse et les états financiers divergent');
});

t('C-08 : une perte reportée reste dans les résultats reportés, en négatif — et la rubrique dit juste', () => {
  const r13 = K.rubriqueDuCompte('13', 13664.833);
  assert.ok(r13 && r13.id === 'CP3', '13 débiteur doit rester dans les résultats reportés');
  assert.strictEqual(K.rubriqueDuCompte('12', -65800).id, 'CP3', '12 s\'appelle « Résultats reportés » : il n\'a rien à faire dans les réserves');
  assert.strictEqual(K.rubriqueDuCompte('11', -100).id, 'CP2');
  assert.strictEqual(K.rubriqueDuCompte('28', -12945.333).id, 'AC4', 'le 28 NU est un amortissement');
  assert.strictEqual(K.rubriqueDuCompte('280', -10).id, 'AC2', 'le préfixe le plus long gagne toujours');
  // Un fournisseur débiteur (avoir non imputé, 10.2.0) et un client créditeur (avance reçue) ont
  // chacun leur place, par le SENS du solde.
  assert.strictEqual(K.rubriqueDuCompte('401', 300).etat, 'bilan-actif');
  assert.strictEqual(K.rubriqueDuCompte('411', -300).etat, 'bilan-passif');
  // Un compte de gestion qui change de sens garde sa rubrique.
  assert.strictEqual(K.rubriqueDuCompte('706', 50).id, 'RE1');
  assert.strictEqual(K.rubriqueDuCompte('603', -50).id, 'RE3');
  // La raison d'une rubrique vide nomme le SENS quand elle n'en prend qu'un : « aucun compte 13
  // n'est mouvementé » contredisait le bandeau qui annonçait ce 13, débiteur.
  const vide = K.liasseDepuisLignes([], {}, {}).etats.flatMap(e => e.lignes).find(x => x.id === 'AC1');
  assert.ok(/solde débiteur/.test(vide.raison), vide.raison);
});

t('C-08 : une copie des rubriques de la 10.0.0 retrouve les comptes qu\'elles laissaient dehors — pas une rubrique réécrite', () => {
  const vieux = K.MODELE_LIASSE.map(r => {
    const x = { ...r, comptes: r.comptes.slice() };
    delete x.deuxSens;
    if (r.id === 'AC4') x.comptes = ['281', '282', '283'];
    if (r.id === 'CP2') x.comptes = ['11', '12'];
    if (r.id === 'CP3') x.comptes = ['13'];
    if (r.id === 'AC9' || r.id === 'PA4') x.comptes = ['42', '43', '44', '45', '46', '47'];
    if (r.id === 'RE10') x.comptes = ['76'];
    return x;
  });
  const m = K.migrerModeleLiasse(vieux);
  assert.deepStrictEqual(m.find(r => r.id === 'AC4').comptes, ['28']);
  assert.deepStrictEqual(m.find(r => r.id === 'CP3').comptes, ['12', '13']);
  assert.strictEqual(m.find(r => r.id === 'CP3').deuxSens, true);
  // Une rubrique que le cabinet a RÉÉCRITE est la sienne : on n'y touche pas.
  const mien = vieux.map(r => (r.id === 'AC4' ? { ...r, comptes: ['2815'] } : r));
  assert.deepStrictEqual(K.migrerModeleLiasse(mien).find(r => r.id === 'AC4').comptes, ['2815']);
  // Vide reste vide : le moteur propose son modèle.
  assert.deepStrictEqual(K.migrerModeleLiasse([]), []);
  // Et le Cabinet la relit À LA LECTURE (safeState et le calcul), comme un livre ancien.
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'));
  assert.ok(/s\.liasse = KC\.migrerModeleLiasse\(s\.liasse\);/.test(main), 'l\'écran des réglages montre encore la copie ancienne');
  assert.ok(/KC\.migrerModeleLiasse\(state\.liasse\)/.test(main), 'la liasse se calcule encore sur la copie ancienne');
  // Le drapeau survit au chargement et à l'enregistrement (défaut `matricule`, 6.8.0).
  const C = require('../../src/cabinet/cabcore.js');
  const s = C.migrate({ liasse: [{ id: 'X', etat: 'bilan-passif', label: 'X', comptes: ['13'], signe: -1, deuxSens: true }] });
  assert.strictEqual(s.liasse[0].deuxSens, true, 'migrate jette le drapeau des deux sens');
  assert.ok(/deuxSens: !!r\.deuxSens/.test(main), 'l\'enregistrement du modèle jette le drapeau des deux sens');
});

// ---------------------------------------------------------------- C-09 · du HTML à l'écran

t('C-09 : une fenêtre qui reçoit un tableau le reçoit par la porte HTML — jamais par celle qui échappe', () => {
  const app = cabApp();
  // `infoDialog` échappe son texte : c'est juste pour une phrase. Un appel qui lui passe une balise
  // affiche la balise — « <table class="list compact"> » à la place des comptes d'une rubrique.
  const appels = [...app.matchAll(/infoDialog\(([^;]{0,400})/g)].map(m => m[1]);
  assert.ok(appels.length > 20, 'les appels à infoDialog n\'ont pas été lus : ' + appels.length);
  appels.forEach(a => assert.ok(!/^[^,]+,\s*`\s*<(table|p|ul|div)\b/.test(a), 'infoDialog reçoit du HTML : ' + a.slice(0, 90)));
  assert.ok(/infoHtml\(`\$\{x\.id\} — \$\{x\.label\}`/.test(app), 'les comptes d\'une rubrique de liasse ne passent plus par infoHtml');
  assert.ok(/infoHtml\(`Les deux livres sont réunis`/.test(app), 'le rapport de fusion affiche encore son HTML');
});

// ---------------------------------------------------------------- C-11 · la paie négative

t('C-11 : un bulletin à salaire négatif est refusé, en nommant les DEUX chiffres — dans les deux applications', () => {
  const l = K.livreVide('D', 2026, {});
  K.ajouterSalarie(l, { nom: 'Mohamed Trabelsi', cin: '09876543', cnss: '123456789', brut: 1200, embauche: '2024-03-01', chefDeFamille: true, enfants: 2 }, 'a', 1);
  const s = l.salaries[0];
  const base = { salarieId: s.id, annee: 2026, mois: 11, brut: 1200, joursTravailles: 26, primes: [], retenues: [] };
  const quarante = K.bulletinValide({ ...base, joursAbsence: 40 }, l, {});
  assert.strictEqual(quarante.ok, false, 'quarante jours d\'absence sur vingt-six passent encore');
  assert.ok(/40 jours/.test(quarante.motif) && /26 jours ouvrables/.test(quarante.motif), quarante.motif);
  // La retenue plus grosse que le salaire : rien d'autre ne la voit que le calcul lui-même.
  const avance = K.bulletinValide({ ...base, joursAbsence: 0, retenues: [{ label: 'Avance', amount: 5000 }] }, l, {});
  assert.strictEqual(avance.ok, false);
  assert.ok(/net serait négatif/.test(avance.motif) && /,/.test(avance.motif), 'le motif doit porter les montants à la française : ' + avance.motif);
  // Le bulletin juste passe — sinon le garde-fou refuserait tout.
  assert.ok(K.bulletinValide({ ...base, joursAbsence: 2 }, l, {}).ok);
  assert.strictEqual(K.ajouterBulletin(l, { ...base, joursAbsence: 40 }, {}, 'a', 2).ok, false, 'l\'enregistrement doit refuser aussi');
  // L'app entreprise : même moteur, même garde-fou (le jumeau manquant, 7.3.0).
  assert.strictEqual(core.saisiePaieValide, K.saisiePaieValide, 'core.js doit réexporter le garde-fou, pas le recopier');
  assert.strictEqual(core.saisiePaieValide({ gross: 1200, workedDays: 26, absentDays: 40 }, { grossSalary: 1200 }, core.payrollSettings({})).ok, false);
  const app = sansComm(lireSource('src', 'renderer', 'app.js'));
  const pf = app.slice(app.indexOf('function payslipForm('), app.indexOf('async function exportPayslip('));
  assert.ok(pf.length > 2000 && pf.length < 12000, 'tranche payslipForm suspecte : ' + pf.length);
  assert.ok(/C\.saisiePaieValide\(input\(\), emp, s\)/.test(pf) && /okBtn\.disabled = !v\.ok/.test(pf) && /if \(!juge\.ok\) return toast/.test(pf),
    'le bulletin de l\'app entreprise ne s\'éteint pas, ou n\'est pas refusé');
});

t('C-11 : un bulletin négatif d\'avant la 10.10.0 ne devient jamais une écriture, et le contrôle le nomme', () => {
  const l = K.livreVide('D', 2026, {});
  K.ajouterSalarie(l, { nom: 'Sonia', cin: '1', cnss: '2', brut: 1200, embauche: '2024-01-01' }, 'a', 1);
  const s = l.salaries[0];
  // Posé à la main, comme l'aurait laissé la 10.9.x.
  l.bulletins.push({ id: 'b1', salarieId: s.id, annee: 2026, mois: 11, brut: 1200, joursTravailles: 26, joursAbsence: 40,
    primes: [], retenues: [], calcul: K.computePayslip({ grossSalary: 1200 }, { gross: 1200, workedDays: 26, absentDays: 40 }, K.baremesPaie({})), ecritureId: null });
  assert.ok(l.bulletins[0].calcul.gross < 0, 'le jeu de données doit porter un brut négatif');
  const e = K.ecritureDePaie(l, 2026, 11, {});
  assert.strictEqual(e.ok, false, 'une paie négative devient encore une écriture');
  assert.ok(/Sonia/.test(e.motif), e.motif);
  const c = K.controlesPaie(l, 2026, 11).find(x => x.id === 'bulletin-negatif');
  assert.ok(c && /Sonia/.test(c.detail), 'le contrôle de paie ne nomme pas le bulletin négatif');
});

t('C-11 : le bulletin du Cabinet s\'éteint pendant la frappe, par la fonction qui refusera', () => {
  const app = cabApp();
  const f = app.slice(app.indexOf('function bulletinForm('), app.indexOf('function vueInventaire('));
  assert.ok(f.length > 2000 && f.length < 12000, 'tranche bulletinForm suspecte : ' + f.length);
  assert.ok(/const verdict = KC\.bulletinValide\(v, L, baremes\);/.test(f), 'le bouton ne se juge pas par bulletinValide');
  assert.ok(/bouton\.disabled = !verdict\.ok;/.test(f), 'le bouton ne s\'éteint pas');
  assert.ok(/KC\.baremesPaie\(baremes\)/.test(f) && /const baremes = dossier\.paie \|\| \{\};/.test(f),
    'l\'aperçu calcule encore avec les barèmes par défaut, pas ceux du dossier');
});

// ---------------------------------------------------------------- C-12 / C-07 · les exercices

t('C-12 / C-07 : les exercices se lisent aussi dans les LIVRES, et un dossier sans paquet se tient ici', () => {
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'));
  const h = main.slice(main.indexOf("ipcMain.handle('cab:livres'"), main.indexOf('function exercicesDuDossier'));
  assert.ok(h.length > 400 && h.length < 4000, 'tranche cab:livres suspecte : ' + h.length);
  assert.ok(/exercices: exercicesDuDossier\(d\)/.test(h), 'cab:livres ne rend pas les exercices du cabinet');
  assert.ok(/lireIndexLivres\(d, indexDossiers\(\)\)/.test(main.slice(main.indexOf('function exercicesDuDossier'))), 'les exercices ne se lisent pas dans l\'index');
  const app = cabApp();
  const z = app.slice(app.indexOf('function anneesDuDossier('), app.indexOf('function exerciceConnu('));
  assert.ok(/d\.tousLesMois/.test(z) && /d\.exercices/.test(z), 'le sélecteur ne réunit pas paquets ET livres');
  // Les deux gestes qui CRÉENT un exercice l'ajoutent au sélecteur eux-mêmes.
  assert.ok(/exerciceConnu\(v\.annee\);/.test(app), 'la reprise ne rend pas son exercice atteignable');
  assert.ok(/exerciceConnu\(r\.annee\);/.test(app), 'Ouvrir N+1 ne rend pas son exercice atteignable');
  assert.ok(/ouvrirExercice\(root, dossier, String\(r\.annee\), 'saisie'\)/.test(app), 'Ouvrir N+1 ne mène pas à N+1');
  // Et le panneau de comptabilité ne dépend plus des paquets.
  const fiche = app.slice(app.indexOf('function drawDossier('), app.indexOf('const labelOf = (list, id) =>'));
  assert.ok(!/\$\{packs\.length \? `<div class="panel" id="c-compta">/.test(fiche), 'la comptabilité dépend encore des paquets');
  const dl = app.slice(app.indexOf('function drawLivres('), app.indexOf('const periode = lignesDeLaPeriode();'));
  assert.ok(/if \(s\.data\.aucunPaquet && s\.livreEtat === 'absent'\)/.test(dl) && /id="lv-reprendre">Commencer le livre de/.test(dl),
    'un dossier sans paquet ne propose pas de commencer son livre');
});

// ---------------------------------------------------------------- C-13 · le document du client

t('C-13 : les états remis au client s\'écrivent à la française, avec leur devise', () => {
  assert.strictEqual(K.fmtMontant(76493.448, 'DT'), '76 493,448 DT');
  assert.strictEqual(K.fmtMontant(-12945.333), '−12 945,333');
  assert.strictEqual(K.fmtMontant(0), '0,000');
  assert.strictEqual(K.fmtJour('2026-12-31'), '31/12/2026');
  const main = sansComm(lireSource('src', 'cabinet', 'main.js'));
  const h = main.slice(main.indexOf('function htmlDeCloture('), main.indexOf('async function pdfDeCloture('));
  assert.ok(h.length > 1500 && h.length < 8000, 'tranche htmlDeCloture suspecte : ' + h.length);
  assert.ok(/const m = n => KC\.fmtMontant\(n, 'DT'\);/.test(h), 'le document du client a encore son propre formateur');
  assert.ok(!/toFixed\(/.test(h), 'le document du client formate encore à la machine');
  assert.ok(/du \$\{e\(j\(dos\.exercice\.du\)\)\}/.test(h), 'les dates du document sont encore en ISO');
});

// ---------------------------------------------------------------- C-04 · les formats machine

t('C-04 : aucune phrase du moteur n\'écrit un montant à la machine', () => {
  // Le refus d'une pièce déséquilibrée — celui qu'un comptable lit « cent mille contre cinquante mille ».
  const v = K.ecritureValide({ date: '2026-03-04', journal: 'OD', lignes: [{ compte: '606', debit: 100 }, { compte: '401', credit: 50 }] }, []);
  assert.ok(v.motifs.some(m => /Débit 100,000 ≠ crédit 50,000/.test(m)), v.motifs.join(' | '));
  // Et la règle, dans la SOURCE : aucun `toFixed(` hors du formateur lui-même.
  const src = sansComm(lireSource('src', 'renderer', 'compta.js'));
  const hors = src.split('\n').filter(l => /toFixed\(/.test(l) && !/const corps = Math\.abs\(v\)\.toFixed\(3\)/.test(l));
  assert.deepStrictEqual(hors, [], 'un montant sort encore du moteur à la machine');
  // Le refus d'une extourne de décembre écrit ses dates en français.
  const l = K.livreVide('D', 2026, {});
  const e = K.ajouterEcriture(l, { date: '2026-12-31', journal: 'AC', piece: 'X', libelle: 'Charge', lignes: [{ compte: '606', debit: 500 }, { compte: '401', credit: 500 }] }, 'a', 1);
  K.validerEcriture(l, e.id, 'a', 2);
  const r = K.extourner(l, e.id, 'a', 3);
  assert.ok(/01\/01\/2027/.test(r.motif) && /31\/12\/2026/.test(r.motif) && !/2027-01-01/.test(r.motif), r.motif);
});

// ---------------------------------------------------------------- C-06 · l'extourne de décembre

t('C-06 : l\'extourne de décembre se PRÉVOIT, et « Ouvrir N+1 » la pose', () => {
  const l = K.livreVide('D', 2026, {});
  const e = K.ajouterEcriture(l, { date: '2026-12-31', journal: 'AC', piece: 'FNP', libelle: 'Charge à payer', lignes: [{ compte: '606', debit: 500 }, { compte: '408', credit: 500 }] }, 'a', 1);
  K.validerEcriture(l, e.id, 'a', 2);
  const avant = JSON.stringify(l.ecritures.find(x => x.id === e.id).lignes);
  const r = K.prevoirExtourne(l, e.id, 'a', 3);
  assert.ok(r.ok, r.motif);
  assert.strictEqual(r.annee, 2027);
  assert.strictEqual(JSON.stringify(l.ecritures.find(x => x.id === e.id).lignes), avant, 'prévoir une extourne a touché un chiffre d\'une validée');
  assert.ok((l.audit || []).some(a => /extourne prévue/.test(a.quoi || a.action || JSON.stringify(a))), 'le geste n\'est pas tracé');
  const ext = K.extournesDe(l, 2027);
  assert.strictEqual(ext.length, 1, 'Ouvrir 2027 ne poserait pas l\'extourne');
  assert.strictEqual(ext[0].date, '2027-01-01');
  assert.strictEqual(K.prevoirExtourne(l, e.id, 'a', 4).ok, false, 'on la prévoit deux fois');
  // Une écriture de MARS ne se « prévoit » pas : elle s'extourne dans son livre.
  const m = K.ajouterEcriture(l, { date: '2026-03-31', journal: 'AC', piece: 'M', libelle: 'M', lignes: [{ compte: '606', debit: 1 }, { compte: '408', credit: 1 }] }, 'a', 5);
  K.validerEcriture(l, m.id, 'a', 6);
  assert.strictEqual(K.prevoirExtourne(l, m.id, 'a', 7).ok, false);
  // Et l'écran ne PROPOSE plus le geste qui sera refusé.
  const app = cabApp();
  const a = app.slice(app.indexOf('function actionsEcriture('), app.indexOf('async function extournerEcriture('));
  // La RÈGLE, pas la forme de la ligne (10.14.0 — elle a gagné une condition légitime, « extournable ») :
  // l'extourne directe n'est proposée que si elle tombe DANS l'exercice.
  assert.ok(/if \([^)]*!auSuivant\) \{\s*a\.push\(\{ icon: 'horloge', label: 'Extourner au 1er du mois suivant'/.test(a)
    && /label: `Extourner à l'ouverture de \$\{suivante\}`/.test(a),
    'le menu propose encore une extourne que le moteur refusera');
});

// ---------------------------------------------------------------- C-10 · la reprise d'un parc

t('C-10 : le tableau d\'amortissement se rapproche du compte 28, et l\'écart se nomme', () => {
  const l = K.livreVide('D', 2026, {});
  const an = K.ajouterEcriture(l, { date: '2026-01-01', journal: 'AN', piece: 'AN', libelle: 'À-nouveau', source: 'an',
    lignes: [{ compte: '22', debit: 53400 }, { compte: '28', credit: 12945.333 }, { compte: '12', credit: 40454.667 }] }, 'a', 1);
  K.validerEcriture(l, an.id, 'a', 2);
  // Le parc repris à sa date de reprise : il repart de zéro — c'est le cas du rapport.
  const r = K.ajouterImmobilisation(l, { libelle: 'Parc', duree: 10, dateMiseEnService: '2026-01-01', valeur: 53400, methode: 'lineaire', compte: '22', compteAmort: '28', compteDotation: '681' }, 'a', 3);
  assert.ok(r.ok, r.motif);
  const c = K.controlesCloture(l).find(x => x.id === 'amortissements');
  assert.ok(c && !c.ok, 'le rapprochement tableau / compte 28 ne voit pas le parc qui repart de zéro');
  assert.ok(/12 945,333 DT/.test(c.detail) && /0,000 DT/.test(c.detail) && /date de mise en service/.test(c.detail), c.detail);
  // Sans fiche, pas de contrôle : les biens d'un client sur SkanFact vivent chez lui.
  const sans = K.livreVide('D', 2026, {});
  assert.ok(!K.controlesCloture(sans).some(x => x.id === 'amortissements'));
  // Le libellé du contrôle existe à l'écran (sinon il s'afficherait sous son identifiant).
  assert.ok(/amortissements: 'Le tableau d\\'amortissement et le compte 28'/.test(lireSource('src', 'cabinet', 'renderer', 'app.js')));
});

// ---------------------------------------------------------------- C-16 · l'inventaire collé

t('C-16 : une quantité illisible est refusée en nommant la ligne — jamais un zéro en silence', () => {
  const r = K.lignesInventaireDepuisTexte('REF-001\tPlanche chêne 2m\t120\t38,500\nREF-002\tVis inox 4x40 (boîte)\tdouze\t12,000\nREF-003\tVernis mat 5L\t18\t64,750');
  assert.strictEqual(r.lignes.length, 3);
  assert.strictEqual(r.refus.length, 1, JSON.stringify(r.refus));
  assert.ok(/Ligne 2/.test(r.refus[0].motif) && /« douze »/.test(r.refus[0].motif), r.refus[0].motif);
  const v = K.inventaireValide({ date: '2026-12-31', lignes: r.lignes, refus: r.refus });
  assert.strictEqual(v.ok, false, 'l\'inventaire passe avec une quantité illisible');
  // Les formats d'un tableur français passent : virgule décimale, espace des milliers.
  const ok = K.lignesInventaireDepuisTexte('A;Truc;1 200;7,5\nB;Machin;3;');
  assert.deepStrictEqual(ok.refus, []);
  assert.strictEqual(ok.lignes[0].quantite, 1200);
  assert.strictEqual(ok.lignes[1].cout, 0, 'un coût vide se compte à zéro, et ça se voit sur la ligne');
  assert.strictEqual(K.lignesInventaireDepuisTexte('A;Truc;;5').refus.length, 1, 'une quantité VIDE passe');
});

// ---------------------------------------------------------------- les petits

t('C-01 / C-14 : un refus se MONTRE — le champ, le curseur, et aria-invalid', () => {
  const app = cabApp();
  assert.ok(/if \(!nom\) return refus\(\$\('#w-name', el\)/.test(app), 'l\'assistant refuse encore sans montrer le champ (C-01)');
  assert.ok(/<label class="field obligatoire span-2">\$\{lbl\('Nom du cabinet'/.test(app), 'le nom du cabinet ne dit pas qu\'il est obligatoire');
  assert.ok(/if \(!motif\) return refus\(\$\('#cl-motif', rootModal\)/.test(app), 'rouvrir sans motif ne montre pas le champ (C-14)');
  const r = app.slice(app.indexOf('function refus('), app.indexOf('function refus(') + 1200);
  assert.ok(/setAttribute\('aria-invalid', 'true'\)/.test(r) && /removeAttribute\('aria-invalid'\)/.test(r), 'refus() ne pose pas aria-invalid');
});

t('C-02 / C-15 / C-03 : ce qui se compte se DÉDUIT, et le premier écran dit ce qu\'est le logiciel', () => {
  // Commentaires retirés : celui qui explique le défaut CITE la phrase fautive (6.8.0, 9.4.10).
  const src = cabApp().replace(/\$\{\/\*[\s\S]*?\*\/''\}/g, '');
  assert.ok(!/Cinq dossiers/.test(src) && !/cinq clients fictifs/.test(src) && !/\(5 clients fictifs\)/.test(src), 'un compte de l\'exemple est encore écrit à la main (C-15)');
  assert.ok(/nbExemple\(\)/.test(src));
  assert.ok(!/Créer le livre ouvre sept onglets/.test(src), 'le nombre d\'onglets est encore écrit à la main (C-02)');
  // C-03 : l'écran de bienvenue décrivait un récepteur de paquets gratuit sans condition.
  assert.ok(!/répond à une seule question/.test(src) && !/Rien\. C'est ton client qui paie SkanFact/.test(src), 'l\'assistant décrit encore le Cabinet de la 6.8.0');
  assert.ok(/Le logiciel de comptabilité de ton cabinet/.test(src));
});

t('T-09 bis : chaque « Annuler » d\'une fenêtre porte l\'attribut que modal() relie — dans les deux applications', () => {
  // Sept « Annuler » du Cabinet portaient `dismiss` nu, que rien ne lit : parfaitement visibles,
  // parfaitement inertes (5.2.2), écrits en 9.10.0, 10.0.0 et 10.3.0 — APRÈS le correctif T-09, dont
  // le test ne regardait que `modal()`. On regarde maintenant chaque bouton.
  [['src', 'cabinet', 'renderer', 'app.js'], ['src', 'renderer', 'app.js']].forEach(f => {
    const src = lireSource(...f);
    const boutons = [...src.matchAll(/<button\b[^>]*>Annuler<\/button>/g)].map(m => m[0]);
    assert.ok(boutons.length > 5, f.join('/') + ' : aucun bouton Annuler lu');
    boutons.forEach(b => assert.ok(/data-close|id="/.test(b), `${f.join('/')} : un « Annuler » n'est relié à rien : ${b}`));
  });
});

t('C-05 bis : l\'accord suit le nombre, et une fenêtre ne cite pas un numéro de version', () => {
  const src = cabApp();
  assert.ok(!/, signées' :/.test(src), '« 1 question envoyée, signées »');
  assert.ok(!/depuis la 9\.8\.8/.test(src), 'la fenêtre de restauration cite encore une version');
});
};
