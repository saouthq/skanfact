'use strict';
// ============================================================================================
// La liasse et l'annuel (10.0.0)
//
// Le document où une erreur coûte le plus cher. Ce que ces tests tiennent, et c'est UNE règle
// déclinée : **rien ne s'invente**. Les rubriques sont une table modifiable et « À VÉRIFIER » ;
// aucun taux d'impôt n'existe dans le code ; une rubrique vide vaut « — » avec sa raison, jamais
// zéro ; et ce qu'aucune rubrique ne capte est MONTRÉ — une liasse qui perd un compte en silence
// est une liasse fausse, et personne ne s'en aperçoit avant le contrôle.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');
const C = require('../../src/cabinet/cabcore.js');

// Un exercice complet et équilibré : capital, immobilisation amortie, une vente avec TVA, un achat.
function exercice(annee) {
  const a = annee || 2026;
  const l = K.livreVide('D1', a, {
    plan: [
      { compte: '101', libelle: 'Capital' }, { compte: '22', libelle: 'Matériel' },
      { compte: '282', libelle: 'Amortissements du matériel' }, { compte: '411', libelle: 'Clients' },
      { compte: '401', libelle: 'Fournisseurs' }, { compte: '532', libelle: 'Banque' },
      { compte: '4367', libelle: 'TVA à décaisser' }, { compte: '706', libelle: 'Prestations' },
      { compte: '606', libelle: 'Achats' }, { compte: '681', libelle: 'Dotations' }
    ]
  });
  const p = (date, piece, lignes) => {
    const e = K.ajouterEcriture(l, { date, journal: 'OD', piece, libelle: piece, lignes }, 'Amine', 1);
    K.validerEcriture(l, e.id, 'Amine', 2);
  };
  p(`${a}-01-01`, 'AN', [{ compte: '22', debit: 10000 }, { compte: '532', debit: 5000 }, { compte: '101', credit: 15000 }]);
  p(`${a}-03-01`, 'V1', [{ compte: '411', debit: 1190 }, { compte: '706', credit: 1000 }, { compte: '4367', credit: 190 }]);
  p(`${a}-04-01`, 'A1', [{ compte: '606', debit: 400 }, { compte: '401', credit: 400 }]);
  p(`${a}-12-31`, 'AM', [{ compte: '681', debit: 1000 }, { compte: '282', credit: 1000 }]);
  return l;
}

const liasseDe = l => K.liasseDepuisLignes(
  K.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au }),
  K.soldesDepuisOuverture(l),
  { libelle: c => ((l.plan || []).find(x => x.compte === c) || {}).libelle || '' });

t('10.0.0 : la liasse tombe juste — actif = passif, et le résultat des deux côtés', () => {
  const li = liasseDe(exercice(2026));
  assert.ok(li.equilibre, `actif ${li.totalActif} ≠ passif ${li.totalPassif}`);
  assert.ok(li.coherent, `résultat du bilan ${li.resultat} ≠ résultat de l'état ${li.resultatEtat}`);
  assert.strictEqual(li.totalActif, 15190);
  assert.strictEqual(li.resultat, -400, 'produits 1000 − charges 1400');
  // La déduction se retranche : l'amortissement s'AFFICHE positif (c'est ainsi qu'une liasse
  // s'imprime) et s'enlève du total. La première version le stockait négatif ET le retranchait,
  // donc elle l'AJOUTAIT — actif et passif divergeaient de deux fois l'amortissement.
  const amort = li.etats[0].lignes.find(x => x.id === 'AC4');
  assert.strictEqual(amort.montant, 1000, 'un amortissement s\'affiche positif');
  assert.strictEqual(amort.deduit, true);
});

t('10.0.0 : aucun compte n\'est perdu, et un compte hors rubrique est MONTRÉ', () => {
  const l = exercice(2026);
  const li = liasseDe(l);
  assert.deepStrictEqual(li.orphelins, [], 'un exercice ordinaire ne doit rien laisser dehors');
  // Un compte qu'aucun préfixe ne réclame doit REMONTER : une liasse qui perd un compte en silence
  // est une liasse fausse, et c'est au contrôle qu'on s'en aperçoit.
  const modele = K.MODELE_LIASSE.filter(r => !(r.comptes || []).some(p => '532'.startsWith(p)));
  const sans = K.liasseDepuisLignes(K.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au }),
    K.soldesDepuisOuverture(l), { modele });
  assert.ok(sans.orphelins.some(o => o.compte === '532'), 'la banque sans rubrique doit être signalée');
});

t('10.0.0 : le SENS du solde départage deux rubriques de même préfixe', () => {
  // Le 44 débiteur est une créance sur l'État, le même 44 créditeur est une dette envers lui : les
  // deux rubriques existent et portent le même préfixe. Sans ce départage, la TVA à décaisser se
  // retrouverait à l'actif — et le bilan tomberait quand même juste, ce qui est le pire des cas.
  assert.strictEqual(K.rubriqueDuCompte('4367', -190).etat, 'bilan-passif');
  assert.strictEqual(K.rubriqueDuCompte('4367', 190).etat, 'bilan-actif');
  assert.strictEqual(K.rubriqueDuCompte('5', 100).id, 'AC10');
  assert.strictEqual(K.rubriqueDuCompte('5', -100).id, 'PA5');
  assert.strictEqual(K.rubriqueDuCompte('2812', -500).id, 'AC4');
  assert.strictEqual(K.rubriqueDuCompte('2154', 500).id, 'AC3');
  assert.strictEqual(K.rubriqueDuCompte('', 1), null);
  // Et le préfixe le PLUS LONG gagne, jamais l'ordre du tableau. Le modèle livré ne contient
  // aucun préfixe imbriqué du même sens — donc il ne peut PAS prouver cette règle, et j'ai failli
  // la croire tenue. La table d'un cabinet, elle, en aura : « 4 » pour tout, « 411 » pour les
  // clients, c'est la première chose qu'on écrit. Sans le départage, le rattachement dépendrait de
  // l'ordre dans lequel les rubriques ont été tapées.
  const imbrique = [
    { id: 'LARGE', etat: 'bilan-actif', label: 'Tous les tiers', comptes: ['4'], signe: 1 },
    { id: 'PRECIS', etat: 'bilan-actif', label: 'Clients', comptes: ['411'], signe: 1 }
  ];
  assert.strictEqual(K.rubriqueDuCompte('411001', 100, imbrique).id, 'PRECIS',
    '411 bat 4 : le préfixe le plus long gagne, quel que soit l\'ordre du tableau');
  assert.strictEqual(K.rubriqueDuCompte('401', 100, imbrique).id, 'LARGE');
  assert.strictEqual(K.rubriqueDuCompte('411001', 100, imbrique.slice().reverse()).id, 'PRECIS',
    'et le retournement du tableau ne change rien — c\'est bien la longueur qui tranche');
});

t('10.0.0 : une rubrique qu\'aucun compte n\'a remplie vaut « — », jamais 0', () => {
  // Un zéro se recopie sur un formulaire ; un « — » avec sa raison se demande au comptable
  // (règle des cases fiscales, 9.6.0). Le test TOMBE si quelqu'un remet un 0 par commodité.
  const li = liasseDe(exercice(2026));
  const vides = li.etats.flatMap(e => e.lignes).filter(x => x.montant === null);
  assert.ok(vides.length >= 5, 'un exercice simple laisse forcément des rubriques vides');
  vides.forEach(x => assert.ok(x.raison && /Aucun compte/.test(x.raison),
    `la rubrique ${x.id} est vide sans dire pourquoi`));
  assert.ok(li.etats.flatMap(e => e.lignes).every(x => x.montant !== 0 || x.id === 'CP4'),
    'seule la ligne de résultat a le droit d\'afficher un vrai zéro');
});

t('10.0.0 : le modèle de liasse se remplace ENTIÈREMENT, jamais en mélange', () => {
  assert.deepStrictEqual(C.DEFAULT_STATE.liasse, [], 'le modèle du cabinet part vide');
  assert.deepStrictEqual(K.modeleLiasse([]), K.MODELE_LIASSE, 'vide = celui que le moteur propose');
  const mien = [{ id: 'X', etat: 'bilan-actif', label: 'Tout', comptes: ['4'], signe: 1 }];
  assert.deepStrictEqual(K.modeleLiasse(mien), mien, 'une table écrite remplace celle du moteur');
  assert.strictEqual(K.rubriqueDuCompte('706', -100, mien), null,
    'un compte hors de MA table n\'est rattaché à rien — et il sera donc MONTRÉ comme orphelin');
  // Et la table du cabinet entre dans migrate : absente, elle serait jetée au prochain chargement
  // et le cabinet la referait chaque matin (défaut `matricule`, 6.8.0).
  const s = C.migrate({ liasse: [{ id: 'A', etat: 'resultat', label: 'A', comptes: ['70'], signe: -1 }, { id: '', label: 'sans id' }] });
  assert.strictEqual(s.liasse.length, 1, 'une rubrique sans identifiant ne se garde pas');
});

t('10.0.0 : aucun taux d\'impôt n\'est écrit dans le code', () => {
  // Le taux dépend de la forme juridique, du secteur et de la loi de finances de l'année : trois
  // choses qu'un logiciel écrit en 2026 ne peut pas suivre (règle 5.0.0, 9.1.1). Tant qu'il n'est
  // pas saisi, l'impôt vaut `null` — et la RAISON s'affiche à sa place.
  const sans = K.resultatFiscal(10000, [], {});
  assert.strictEqual(sans.taux, null);
  assert.strictEqual(sans.impot, null);
  assert.ok(/À VÉRIFIER/.test(sans.raisonImpot), 'l\'absence de taux doit dire pourquoi');
  const avec = K.resultatFiscal(10000, [], { taux: 15 });
  assert.strictEqual(avec.impot, 1500);
  assert.strictEqual(avec.raisonImpot, '');
  // Et le code lui-même n'en porte aucun : le test lit la SOURCE, parce qu'un taux écrit en dur
  // se glisse dans une valeur par défaut sans que le résultat change tout de suite.
  const src = lireSource('src', 'renderer', 'compta.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const i = src.indexOf('function resultatFiscal');
  const zone = src.slice(i, src.indexOf('function employeurAnnuel'));
  assert.ok(zone.length > 400, 'la tranche de resultatFiscal est vide');
  assert.ok(!/taux\s*[:=]\s*\d/.test(zone), 'un taux d\'impôt est écrit en dur dans resultatFiscal');
  assert.ok(!/\b(15|25|35)\s*\/\s*100\b/.test(zone), 'un taux d\'impôt est écrit en dur dans resultatFiscal');
});

t('10.0.0 : un retraitement dit sa NATURE, et le sens vient d\'elle', () => {
  // Le montant est toujours POSITIF : c'est la nature qui dit s'il s'ajoute ou se retranche. Un
  // montant signé laisserait saisir « −200 » en réintégration, donc une déduction déguisée que
  // personne ne relirait comme telle.
  assert.ok(!K.retraitementValide({ nature: 'reintegration', libelle: 'x', montant: -5 }).ok);
  assert.ok(!K.retraitementValide({ nature: 'reintegration', libelle: '', montant: 5 }).ok);
  assert.ok(!K.retraitementValide({ nature: 'inconnue', libelle: 'x', montant: 5 }).ok);
  assert.ok(K.retraitementValide({ nature: 'deduction', libelle: 'Dividendes', montant: 5 }).ok);
  const r = K.resultatFiscal(1000, [
    { nature: 'reintegration', libelle: 'Amende', montant: 200 },
    { nature: 'deduction', libelle: 'Produit exonéré', montant: 300 },
    { nature: 'deficit', libelle: 'Report 2025', montant: 100 },
    { nature: 'inconnue', libelle: 'Ignorée', montant: 9999 }
  ], { taux: 10 });
  assert.strictEqual(r.reintegrations, 200);
  assert.strictEqual(r.deductions, 400, 'déduction et report se cumulent');
  assert.strictEqual(r.base, 800);
  assert.strictEqual(r.impot, 80);
  // Un exercice déficitaire n'a pas de base imposable NÉGATIVE : elle est nulle, et le déficit se
  // reporte. Un impôt négatif serait un crédit d'impôt inventé.
  const d = K.resultatFiscal(-500, [], { taux: 10 });
  assert.strictEqual(d.base, -500);
  assert.strictEqual(d.imposable, 0);
  assert.strictEqual(d.impot, 0);
  assert.strictEqual(d.deficitaire, true);
});

t('10.0.0 : la déclaration d\'employeur porte DEUX choses, et dit ce qu\'elle ne sait pas', () => {
  // Les salaires versés ET les retenues sur fournisseurs : les deux figurent sur le même
  // formulaire, et les confondre est l'erreur la plus courante (règle 5.2.0).
  const l = exercice(2026);
  const e = K.employeurAnnuel(l, {});
  assert.deepStrictEqual(e.cases.map(c => c.id), ['salaires', 'charges', 'irpp', 'rsFournisseurs']);
  e.cases.forEach(c => assert.ok(c.montant === null && c.raison,
    `la case ${c.id} doit valoir « — » avec sa raison sur un exercice sans paie`));
  // Ce qu'elle NE peut pas donner, elle le dit : un état nominatif demande les bulletins, que le
  // cabinet ne reçoit pas. Prétendre le contraire serait « 7 pièces vérifiées » sans les compter.
  assert.strictEqual(e.nominatif, false);
  assert.ok(/bulletins/.test(e.raisonNominatif));
});

// ---------------------------------------------------------------- le calendrier par régime

t('F-9.6.0-12 : sans régime déclaré, le calendrier ne change pas d\'un pixel', () => {
  // La valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien (9.1.1).
  const pk = m => ({ month: m, definitive: true, receivedAt: Date.parse(m + '-15T09:00:00Z'), files: 5, missing: [], path: '' });
  const dossiers = () => [
    { id: 'a', name: 'A', matricule: '1', regime: 'forfaitaire', packs: [pk('2026-05'), pk('2026-06')] },
    { id: 'b', name: 'B', matricule: '2', regime: 'reel', packs: [pk('2026-05'), pk('2026-06')] }
  ];
  assert.deepStrictEqual(C.migrate({}).settings.regimes, [], 'la table des régimes part vide');
  const sans = C.migrate({ dossiers: dossiers() });
  const avant = C.echeances(sans, '2026-09-21');
  assert.ok(avant.every(e => e.clients === 2), 'sans régime déclaré, tous les clients sont concernés');
  assert.strictEqual(C.periodeTva(sans, sans.dossiers[0]), 'mensuelle');
  assert.strictEqual(C.deposeCnss(sans, sans.dossiers[0]), true);
});

t('F-9.6.0-12 : un régime déclaré décide de ce que son client dépose', () => {
  const pk = m => ({ month: m, definitive: true, receivedAt: Date.parse(m + '-15T09:00:00Z'), files: 5, missing: [], path: '' });
  const s = C.migrate({
    dossiers: [
      { id: 'a', name: 'Forfait', matricule: '1', regime: 'forfaitaire', packs: [pk('2026-05'), pk('2026-06')] },
      { id: 'b', name: 'Réel', matricule: '2', regime: 'reel', packs: [pk('2026-05'), pk('2026-06')] }
    ],
    settings: { regimes: [
      { id: 'forfaitaire', label: 'Forfaitaire', tva: 'aucune', cnss: false,
        annuelles: [{ id: 'irpp', label: 'Déclaration annuelle', mois: 4, jour: 25 }] },
      { id: 'reel', label: 'Réel', tva: 'mensuelle', cnss: true }
    ] }
  });
  const ech = C.echeances(s, '2026-09-21');
  // Un forfaitaire ne se voit plus réclamer une TVA qu'il ne dépose pas — c'est TOUT le point.
  assert.ok(ech.filter(e => e.id === 'tva-m').every(e => e.clients === 1), 'seul le réel dépose une TVA mensuelle');
  assert.ok(ech.filter(e => e.id === 'cnss').every(e => e.clients === 1), 'le forfaitaire déclaré sans CNSS n\'y figure plus');
  // L'échéance ANNUELLE que le cabinet a écrite lui-même, sur l'exercice ÉCOULÉ.
  const an = ech.find(e => e.id === 'an-forfaitaire-irpp');
  assert.ok(an, 'l\'échéance annuelle déclarée doit apparaître');
  assert.strictEqual(an.date, '2027-04-25');
  assert.ok(/2026/.test(an.label), 'elle porte sur l\'exercice écoulé, pas sur l\'année du dépôt');
  // Le régime PRIME sur le réglage de la fiche : un `tvaPeriod` oublié ne doit pas le contredire.
  const d = { regime: 'forfaitaire', tvaPeriod: 'mensuelle' };
  assert.strictEqual(C.periodeTva(s, d), 'aucune', 'le régime prime sur un réglage oublié (7.22.0)');
});

t('F-9.6.0-12 : une échéance annuelle mal écrite n\'entre pas dans les données', () => {
  // Ce qui vient d'un champ de saisie se borne AVANT de toucher au disque : un « 31-02 » ne peut
  // désigner aucune date réelle, il n'a donc rien à faire là — il y traînerait pour toujours.
  const r = C.migrateRegime({ id: 'x', label: 'X', tva: 'inventee', cnss: true, annuelles: [
    { id: 'a', label: 'Bonne', mois: 4, jour: 25 },
    { id: 'b', label: 'Sans mois', mois: 0, jour: 25 },
    { id: 'c', label: '', mois: 4, jour: 25 },
    { id: 'd', label: 'Mois absurde', mois: 99, jour: 99 }
  ] });
  assert.strictEqual(r.tva, '', 'une périodicité inconnue retombe sur « comme le dossier le dit »');
  assert.deepStrictEqual(r.annuelles.map(a => a.id), ['a', 'd']);
  assert.strictEqual(r.annuelles[1].mois, 12, 'le mois est BORNÉ, pas refusé au hasard');
  assert.strictEqual(r.annuelles[1].jour, 31);
});

// ---------------------------------------------------------------- les écrans et l'exemple

t('10.0.0 : « ce n\'est pas la liasse » a disparu, et l\'écran renvoie à la liasse', () => {
  // La phrase existait parce que la liasse n'existait pas (9.0.0). La garder maintenant serait
  // « une phrase affichée que rien ne tient » (7.3.0), vue de l'autre côté : elle dirait faux.
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(!/Ce n'est pas la liasse/.test(app), 'l\'écran des états nie encore une liasse qui existe');
  assert.ok(/id="cl-liasse"/.test(app), 'l\'écran des états doit mener à la liasse');
  const main = lireSource('src', 'cabinet', 'main.js');
  assert.ok(!/Ce n'est pas la\nliasse fiscale NCT 01/.test(main), 'le PDF de clôture nie encore la liasse');
  // Des états financiers qui partent chez un client sans dire QUI les a établis n'engagent
  // personne : le PDF porte son cadre de signature (F-10.0.0-04).
  assert.ok(/class="sigbox"/.test(main) && /Signature et cachet/.test(main),
    'les états envoyés au client doivent porter un cadre de signature');
});

t('10.0.0 : le jeu d\'exemple porte un exercice entier et un client hors SkanFact', () => {
  const ds = C.demoDossiers('2026-09-21');
  const total = ds.reduce((s, d) => s + d.packs.length, 0);
  assert.ok(total >= 19, `l'exemple a maigri : ${total} paquets`);
  assert.ok(ds.some(d => d.packs.length >= 12),
    'un dossier doit porter DOUZE mois : une liasse sur huit mois n\'est pas une liasse');
  const hors = ds.filter(d => d.manual);
  assert.strictEqual(hors.length, 1);
  assert.strictEqual(hors[0].packs.length, 0, 'un client hors SkanFact n\'envoie rien');
  // Et il se pose vraiment : sans paquet, aucun `ingest` ne le crée — la branche existe.
  const main = lireSource('src', 'cabinet', 'main.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const i = main.indexOf('function chargerExemple');
  const zone = main.slice(i, main.indexOf('function rafraichirExemple'));
  assert.ok(zone.length > 800, 'la tranche de chargerExemple est vide');
  assert.ok(/if \(!\(d\.packs \|\| \[\]\)\.length\)/.test(zone),
    'un dossier sans paquet doit être posé à la main, sinon il n\'existe pas');
});

t('10.0.0 : le Cabinet n\'embarque toujours pas le moteur de l\'app entreprise', () => {
  // La règle qui ne bouge pas : l'application gratuite du comptable n'emporte pas le produit
  // qu'on vend. La liasse vit dans compta.js (partagé), jamais dans core.js.
  const cfg = require('../../build/cabinet.config.js');
  const files = cfg.files.map(String).join(' ');
  assert.ok(!/renderer\/core\.js/.test(files) && !/renderer\/app\.js/.test(files),
    'core.js ou app.js sont entrés dans l\'app du comptable');
  assert.ok(/renderer\/compta\.js/.test(files), 'compta.js doit y être : c\'est le moteur partagé');
  // Et les fonctions de la liasse sont bien dans le module PARTAGÉ, pas dans core.js.
  ['liasseDepuisLignes', 'resultatFiscal', 'employeurAnnuel'].forEach(f =>
    assert.strictEqual(typeof K[f], 'function', `${f} doit vivre dans compta.js`));
});

// ---------------------------------------------------------------- le plan de l'application, rubrique par rubrique (10.14.0)

// Le sens NATUREL d'un compte du plan : ce qu'il porte quand rien n'est anormal. Un compte « des
// deux sens » (12, 42 à 48, 5) doit trouver sa place dans les deux.
const sensNaturel = c => {
  if (/^18/.test(c)) return null;                 // comptes de liaison : se soldent entre établissements
  if (/^6/.test(c)) return [1];
  if (/^7/.test(c)) return [-1];
  if (/^1[23]/.test(c)) return [1, -1];
  if (/^1/.test(c)) return [-1];
  if (/^(28|29|39|49|59)/.test(c)) return [-1];
  if (/^[23]/.test(c)) return [1];
  if (/^40/.test(c)) return [-1];
  if (/^41/.test(c)) return [1];
  if (/^4/.test(c)) return [1, -1];
  if (/^5/.test(c)) return [1, -1];
  return null;
};

t('10.14.0 : chaque compte du plan de l\'application trouve sa rubrique dans son sens naturel', () => {
  // Un compte que le plan NOMME et qu'aucune rubrique ne lit sort de la liasse : 24 (crédit-bail),
  // 29 et 49 (provisions), 48 (charges et produits constatés d'avance, la première écriture
  // d'inventaire d'un cabinet), 72 (production immobilisée). Le bilan ne tombait plus juste, et le
  // comptable apprenait qu'il fallait réécrire le modèle au moment de clôturer.
  const plan = K.PLAN_COMPTABLE.filter(([c]) => c.length >= 2);
  assert.ok(plan.length > 60, 'le plan de référence a maigri');
  const manquent = [];
  plan.forEach(([c, nom]) => (sensNaturel(c) || []).forEach(s => {
    if (!K.rubriqueDuCompte(c, s * 100)) manquent.push(`${c} ${nom} (${s > 0 ? 'débiteur' : 'créditeur'})`);
  }));
  assert.deepStrictEqual(manquent, [], 'des comptes du plan n\'ont aucune rubrique');
  // L'exception est NOMMÉE et elle désigne encore quelque chose : un solde sur un compte de
  // liaison est une anomalie, et une liasse qui la montre en orphelin dit vrai.
  assert.ok(K.PLAN_COMPTABLE.some(([c]) => c === '18'), 'l\'exception « 18 » ne désigne plus rien');
  assert.strictEqual(K.rubriqueDuCompte('18', -100), null);
});

t('10.14.0 : une rubrique ne contredit pas le nom que le plan donne à son compte', () => {
  const r = (c, s) => (K.rubriqueDuCompte(c, s) || {});
  // Le financier est financier, l'extraordinaire extraordinaire — dans les deux sens de la phrase.
  const plan = K.PLAN_COMPTABLE.filter(([c]) => /^[67]\d$/.test(c));
  plan.forEach(([c, nom]) => {
    const rub = r(c, c[0] === '6' ? 1 : -1);
    ['financi', 'extraordinaire'].forEach(mot => assert.strictEqual(
      new RegExp(mot, 'i').test(rub.label || ''), new RegExp(mot, 'i').test(nom),
      `${c} « ${nom} » est rangé sous « ${rub.label} »`));
  });
  // Les comptes que le moteur des deux applications écrit, un par un.
  assert.strictEqual(r('755', -1).id, 'RE10', 'un gain de change est un produit financier');
  assert.strictEqual(r('655', 1).id, 'RE6', 'une perte de change est une charge financière');
  assert.strictEqual(r('651', 1).id, 'RE6', 'un intérêt d\'emprunt est une charge financière');
  assert.strictEqual(r('775', -1).id, 'RE13', 'le prix d\'un bien cédé est un gain extraordinaire');
  assert.strictEqual(r('675', 1).id, 'RE14', 'la valeur d\'un bien cédé est une perte extraordinaire');
  assert.strictEqual(r('781', -1).id, 'RE12', 'une reprise vient en face des dotations');
  assert.strictEqual(r('72', -1).id, 'RE2', 'la production immobilisée est un produit d\'exploitation');
  // Le bilan : les capitaux propres sont 10 à 14, et une provision vient en MOINS de ce qu'elle déprécie.
  assert.strictEqual(r('14', -1).id, 'CP5', 'le 14 est « Autres capitaux propres » au plan');
  assert.ok(/^CP/.test(r('14', -1).id) && !/Provision/.test(r('14', -1).label));
  assert.strictEqual(r('15', -1).id, 'PA2');
  assert.strictEqual(r('16', -1).id, 'PA1');
  ['29', '291', '49', '491', '59'].forEach(c => {
    assert.strictEqual(r(c, -1).etat, 'bilan-actif', `${c} doit venir en moins de l'actif`);
    assert.strictEqual(r(c, -1).deduit, true, `${c} se retranche`);
  });
  assert.strictEqual(r('486', 1).id, 'AC9', 'une charge constatée d\'avance est un actif courant');
  assert.strictEqual(r('487', -1).id, 'PA4', 'un produit constaté d\'avance est un passif courant');
  assert.strictEqual(r('24', 1).id, 'AC3');
});

// Le modèle tel qu'il était livré jusqu'à la 10.13.0, reconstitué depuis celui d'aujourd'hui : les
// rubriques nées depuis retirées, les sept rubriques changées remises dans leur état d'alors.
function modele1013() {
  const alors = {
    AC3: ['21', '22', '23'], AC9: ['40', '42', '43', '44', '45', '46', '47'], PA2: ['14', '15'],
    PA4: ['41', '42', '43', '44', '45', '46', '47'], RE2: ['73', '74', '75'], RE9: ['63', '67'], RE10: ['76', '77', '78', '79']
  };
  return K.MODELE_LIASSE.filter(r => !['AC11', 'AC12', 'AC13', 'CP5', 'RE12', 'RE13', 'RE14'].includes(r.id))
    .map(r => ({ ...r, comptes: (alors[r.id] || r.comptes).slice() }));
}

t('10.14.0 : une copie du modèle de la 10.13.0 rejoint le modèle d\'aujourd\'hui, rubrique par rubrique', () => {
  const m = K.migrerModeleLiasse(modele1013());
  assert.deepStrictEqual(m.map(r => r.id), K.MODELE_LIASSE.map(r => r.id),
    'les rubriques ajoutées se posent à la place qu\'elles ont dans le modèle');
  m.forEach(r => assert.deepStrictEqual(r.comptes, K.MODELE_LIASSE.find(x => x.id === r.id).comptes, r.id));
  // Et une liasse calculée sur la copie migrée est celle du modèle : le 14 est aux capitaux propres.
  const l = exercice(2026);
  const e = K.ajouterEcriture(l, { date: '2026-06-30', journal: 'OD', piece: 'SUB', libelle: 'Subvention',
    lignes: [{ compte: '532', debit: 2000 }, { compte: '14', credit: 2000 }] }, 'Amine', 3);
  K.validerEcriture(l, e.id, 'Amine', 4);
  const opts = modele => ({ modele, libelle: () => '' });
  const lignes = K.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au });
  const avant = K.liasseDepuisLignes(lignes, K.soldesDepuisOuverture(l), opts(modele1013()));
  const apres = K.liasseDepuisLignes(lignes, K.soldesDepuisOuverture(l), opts(m));
  const rub = (li, id) => li.etats.flatMap(x => x.lignes).find(x => x.id === id);
  assert.strictEqual(rub(avant, 'PA2').montant, 2000, 'la copie d\'hier rangeait la subvention sous « Provisions »');
  assert.strictEqual(rub(apres, 'CP5').montant, 2000);
  assert.ok(apres.equilibre && apres.coherent);
});

t('10.14.0 : une rubrique que le cabinet a réécrite reste la sienne, et rien ne vient lui disputer ses comptes', () => {
  const copie = modele1013().map(r => {
    if (r.id === 'RE10') return { ...r, comptes: ['76', '77'] };
    if (r.id === 'PA2') return { ...r, label: 'Provisions et subventions', comptes: ['14', '15', '16'] };
    return r;
  });
  const m = K.migrerModeleLiasse(copie);
  assert.deepStrictEqual(m.find(r => r.id === 'RE10').comptes, ['76', '77']);
  assert.ok(!m.some(r => r.id === 'RE13'), 'le 77 est déjà lu par le cabinet : pas de seconde rubrique');
  assert.deepStrictEqual(m.find(r => r.id === 'PA2').comptes, ['14', '15', '16']);
  assert.ok(!m.some(r => r.id === 'CP5'), 'le 14 est déjà lu par le cabinet : pas de seconde rubrique');
  // Les autres rubriques neuves, elles, arrivent : aucune ligne du cabinet ne lit leurs comptes.
  ['AC11', 'AC12', 'AC13', 'RE12', 'RE14'].forEach(id => assert.ok(m.some(r => r.id === id), id));
});

t('10.14.0 : les états rangent un emprunt hors des capitaux propres, et une provision en moins de l\'actif', () => {
  // Les deux applications rangeaient la classe 1 ENTIÈRE sous « Capitaux propres » : un emprunt de
  // 50 000 y gonflait les fonds propres, sur le PDF de clôture envoyé au client. Et une provision
  // sur créances passait au passif comme une dette. Les totaux tombaient juste — c'est ce qui
  // rendait la faute invisible.
  const l = exercice(2026);
  const p = (date, piece, lignes) => {
    const e = K.ajouterEcriture(l, { date, journal: 'OD', piece, libelle: piece, lignes }, 'Amine', 5);
    K.validerEcriture(l, e.id, 'Amine', 6);
  };
  p('2026-02-01', 'EMP', [{ compte: '532', debit: 50000 }, { compte: '164', credit: 50000 }]);
  p('2026-12-31', 'PROV', [{ compte: '681', debit: 300 }, { compte: '491', credit: 300 }]);
  const e = K.etatsDepuisLignes(K.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au }), K.soldesDepuisOuverture(l));
  const g = (cote, re) => e[cote].find(x => re.test(x.titre));
  // Calculé à la main : capital 15 000 seul aux capitaux propres ; l'emprunt 50 000 à part.
  assert.strictEqual(g('passif', /^Capitaux/).total, 15000, 'l\'emprunt est entré dans les capitaux propres');
  assert.strictEqual(g('passif', /non courants/).total, 50000);
  // Clients 1 190 − provision 300 = 890 ; la provision n'est pas une dette.
  assert.strictEqual(g('actif', /Clients/).total, 890);
  assert.ok(!g('passif', /Fournisseurs/).lignes.some(x => x.compte === '491'), 'une provision sur clients n\'est pas une dette');
  assert.ok(e.equilibre, `actif ${e.totalActif} ≠ passif ${e.totalPassif}`);
  // Et l'app entreprise range par la MÊME fonction : deux copies avaient la même faute.
  const core = require('../../src/renderer/core.js');
  const src = lireSource('src', 'renderer', 'core.js');
  const i = src.indexOf('function etatsFinanciers(');
  const f = src.slice(i, src.indexOf('\n  }\n', i));
  assert.ok(f.length > 400 && /Compta\.groupesDesEtats\(/.test(f), 'l\'app entreprise range ses états elle-même');
  assert.ok(!/Capitaux propres/.test(f), 'une seconde liste de rubriques vit encore dans core.js');
  assert.strictEqual(typeof core.etatsFinanciers, 'function');
});

t('10.14.0 : l\'excédent brut d\'exploitation ne compte pas les charges financières', () => {
  // Le SIG lisait « personnel » sur 64 ET 65 : un intérêt d'emprunt (651) faisait baisser l'EBE,
  // qui existe précisément pour ne pas le compter.
  const l = exercice(2026);
  const e = K.ajouterEcriture(l, { date: '2026-06-30', journal: 'OD', piece: 'INT', libelle: 'Intérêts',
    lignes: [{ compte: '651', debit: 120 }, { compte: '532', credit: 120 }] }, 'Amine', 7);
  K.validerEcriture(l, e.id, 'Amine', 8);
  const sig = K.sigDepuisLignes(K.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au }), K.soldesDepuisOuverture(l));
  const v = id => sig.lignes.find(x => x.id === id).montant;
  // À la main : CA 1 000, achats 400 → VA 600 ; aucun salaire, aucun impôt → EBE 600 ; dotation 1 000.
  assert.strictEqual(v('personnel'), 0, 'un intérêt d\'emprunt compté comme une charge de personnel');
  assert.strictEqual(v('ebe'), 600);
  assert.strictEqual(v('rex'), -400);
  assert.strictEqual(v('net'), -520, 'le résultat net, lui, compte les intérêts : 1 000 − 400 − 1 000 − 120');
  assert.strictEqual(sig.lignes.find(x => x.id === 'personnel').formule, 'compte 64');
});
};
