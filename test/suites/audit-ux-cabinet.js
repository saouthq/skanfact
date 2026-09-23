'use strict';
// ============================================================================================
// L'audit UI/UX du Cabinet, corrigé (10.12.0) — U-01 à U-30 d'`A-FAIRE.md` § 4 bis.
//
// L'audit a été mené comme un comptable l'aurait vécu : l'application ouverte sur un écran
// virtuel, parcourue à la souris et au clavier, et chaque constat relu dans le code avant d'être
// retenu. Trois d'entre eux n'étaient pas des questions de goût mais des CHIFFRES faux (U-03,
// U-04, U-05) : ce sont eux qui ouvrent ce fichier. Chaque test se prouve en réintroduisant son
// défaut (règle 7.2.0).
module.exports = ({ t, assert, lireSource }) => {
// Évalue un morceau de source dans un contexte VIDE, où l'on ne pose que ce qu'il lit : une table
// ou une fonction pure se juge sur ce qu'elle rend, pas sur sa forme.
const evaluer = (src, ctx) => require('vm').runInNewContext('(' + src + ')', { ...(ctx || {}) });
// Une TABLE évaluée revient dans le monde des tests : un tableau né dans un autre contexte a un autre
// prototype, et `deepStrictEqual` compare aussi les prototypes.
const donnees = src => JSON.parse(JSON.stringify(evaluer(src)));
const KC = require('../../src/renderer/compta.js');
const C = require('../../src/cabinet/cabcore.js');

// Le code d'un fichier sans ses commentaires : un test qui lit du code doit lire du CODE (6.8.0).
// Les commentaires de gabarit `${/* … */''}` partent aussi (9.8.8).
function code(...chemin) {
  return lireSource(...chemin)
    .replace(/\$\{\/\*[\s\S]*?\*\/''\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
}
// La tranche d'une fonction : de sa déclaration à l'accolade fermante en colonne 2. On se borne sur
// la FIN de ce qu'on juge, jamais sur un voisin — un voisin déménage (10.4.0).
function tranche(src, debut) {
  const i = src.indexOf(debut);
  assert.ok(i >= 0, `introuvable : ${debut}`);
  const fin = src.indexOf('\n  }\n', i);
  assert.ok(fin > i, `fin introuvable : ${debut}`);
  return src.slice(i, fin + 4);
}

// Un livre avec une vraie paie et un vrai intérêt d'emprunt : c'est le jeu qui DISCRIMINE. Le
// modèle de liasse d'avant la 10.12.0 passait ses tests parce qu'aucun n'écrivait sur le 65.
function livreAvecPaie() {
  const l = KC.livreVide('D1', 2026, {
    plan: [
      { compte: '101', libelle: 'Capital' }, { compte: '532', libelle: 'Banque' },
      { compte: '640', libelle: 'Salaires' }, { compte: '645', libelle: 'Charges sociales' },
      { compte: '647', libelle: 'Charges sociales légales' }, { compte: '651', libelle: 'Intérêts' },
      { compte: '425', libelle: 'Personnel' }, { compte: '4531', libelle: 'CNSS' },
      { compte: '4321', libelle: 'IRPP retenu' }, { compte: '706', libelle: 'Prestations' },
      { compte: '411', libelle: 'Clients' }, { compte: '695', libelle: 'Impôt' }, { compte: '4351', libelle: 'État IS' }
    ]
  });
  const p = (date, piece, lignes) => {
    const e = KC.ajouterEcriture(l, { date, journal: 'OD', piece, libelle: piece, lignes }, 'Amine', 1);
    const v = KC.validerEcriture(l, e.id, 'Amine', 2);
    assert.ok(v.ok, `la pièce ${piece} doit se valider : ${v.motif || ''}`);
  };
  p('2026-01-01', 'AN', [{ compte: '532', debit: 20000 }, { compte: '101', credit: 20000 }]);
  p('2026-03-31', 'PAIE-03', [
    { compte: '640', debit: 1000 }, { compte: '645', debit: 165.7 }, { compte: '647', debit: 20 },
    { compte: '4321', credit: 80 }, { compte: '4531', credit: 277.5 }, { compte: '425', credit: 828.2 }
  ]);
  p('2026-04-30', 'INT-04', [{ compte: '651', debit: 50 }, { compte: '532', credit: 50 }]);
  p('2026-05-15', 'V1', [{ compte: '411', debit: 5000 }, { compte: '706', credit: 5000 }]);
  p('2026-12-31', 'IS', [{ compte: '695', debit: 300 }, { compte: '4351', credit: 300 }]);
  return l;
}
const liasseDe = l => KC.liasseDepuisLignes(
  KC.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au }),
  KC.soldesDepuisOuverture(l),
  { libelle: c => ((l.plan || []).find(x => x.compte === c) || {}).libelle || '' });
const rubrique = (liasse, id) => liasse.etats.flatMap(e => e.lignes).find(r => r.id === id);

// ---------------------------------------------------------------- U-03 — les charges de personnel

t('U-03 : une rubrique de la liasse porte le NOM que le plan donne à ses comptes', () => {
  // RE6 « Charges sociales » lisait le 65, que le plan de cette même application appelle
  // « Charges financières » : un intérêt d'emprunt devenait une charge sociale. RE11 « Charges
  // financières » lisait le 69, que le plan appelle « Impôt sur les bénéfices ».
  const lire = compte => KC.libelleDuPlan(compte);
  KC.MODELE_LIASSE.filter(r => r.etat === 'resultat' && (r.comptes || []).length === 1 && r.comptes[0].length === 2)
    .forEach(r => {
      const plan = lire(r.comptes[0]);
      assert.ok(plan, `le compte ${r.comptes[0]} doit être nommé par le plan`);
      if (['65', '69'].includes(r.comptes[0])) {
        assert.strictEqual(r.label, plan, `la rubrique ${r.id} lit le ${r.comptes[0]} : elle doit s'appeler « ${plan} »`);
      }
    });
  assert.ok(!KC.MODELE_LIASSE.some(r => r.label === 'Charges sociales'),
    'aucune rubrique « Charges sociales » à part : elles sont dans le 64, les charges de personnel');
});

t('U-03 : la paie tombe dans les charges de personnel, l\'intérêt dans les charges financières', () => {
  const x = liasseDe(livreAvecPaie());
  assert.strictEqual(rubrique(x, 'RE5').montant, 1185.7, 'charges de personnel = 640 + 645 + 647');
  assert.strictEqual(rubrique(x, 'RE6').label, 'Charges financières');
  assert.strictEqual(rubrique(x, 'RE6').montant, 50, 'l\'intérêt d\'emprunt est une charge FINANCIÈRE');
  assert.strictEqual(rubrique(x, 'RE11').label, 'Impôt sur les bénéfices');
  assert.strictEqual(rubrique(x, 'RE11').montant, 300);
  assert.ok(x.coherent && x.equilibre, 'et la liasse reste équilibrée et cohérente');
  // L'état de résultat se lit dans l'ordre : l'exploitation, puis le financier, puis l'impôt.
  const ordre = x.etats.find(e => e.id === 'resultat').lignes.map(r => r.id);
  assert.ok(ordre.indexOf('RE6') > ordre.indexOf('RE9') && ordre.indexOf('RE11') === ordre.length - 1,
    `l'impôt vient en dernier, le financier après l'exploitation : ${ordre.join(', ')}`);
});

t('U-03 : une copie du modèle renomme ce que la 10.11.0 nommait mal, jamais ce que le cabinet a écrit', () => {
  const copie = [
    { id: 'RE6', etat: 'resultat', label: 'Charges sociales', comptes: ['65'], signe: 1, charge: true, deuxSens: true },
    { id: 'RE11', etat: 'resultat', label: 'Charges financières', comptes: ['69'], signe: 1, charge: true, deuxSens: true }
  ];
  const m = KC.migrerModeleLiasse(copie);
  assert.strictEqual(m.find(r => r.id === 'RE6').label, 'Charges financières');
  assert.strictEqual(m.find(r => r.id === 'RE11').label, 'Impôt sur les bénéfices');
  // Un cabinet qui a renommé sa rubrique, ou qui l'a rattachée à d'autres comptes, garde la sienne.
  const a = KC.migrerModeleLiasse([{ id: 'RE6', etat: 'resultat', label: 'Frais financiers', comptes: ['65'], signe: 1 }]);
  assert.strictEqual(a[0].label, 'Frais financiers');
  const b = KC.migrerModeleLiasse([{ id: 'RE6', etat: 'resultat', label: 'Charges sociales', comptes: ['65', '66'], signe: 1 }]);
  assert.strictEqual(b[0].label, 'Charges sociales', 'une rubrique rattachée autrement est celle du cabinet');
});

t('U-03 : la déclaration d\'employeur ne compte pas deux fois les charges sociales', () => {
  const e = KC.employeurAnnuel(livreAvecPaie(), {});
  const cas = id => e.cases.find(c => c.id === id);
  // Calculé à la main : 640 = 1 000 ; 645 + 647 = 185,700. Le 64 entier fait 1 185,700.
  assert.strictEqual(cas('salaires').montant, 1000, 'les salaires sont le 64 HORS charges sociales');
  assert.strictEqual(cas('charges').montant, 185.7, 'les charges patronales se lisent sur 645 et 647');
  assert.deepStrictEqual(cas('charges').comptes, ['645', '647']);
  assert.strictEqual(KC.round3(cas('salaires').montant + cas('charges').montant), 1185.7,
    'les deux cases ensemble font le 64, sans rien compter deux fois');
  assert.ok(!cas('charges').comptes.includes('65'), 'le 65 est « charges financières » : il n\'a rien à faire ici');
  assert.strictEqual(cas('irpp').montant, 80);
});

// ---------------------------------------------------------------- U-28 — les mois en français

t('U-28 : un mois dans une phrase se dit « juillet 2026 », jamais « 2026-07 »', () => {
  assert.strictEqual(KC.fmtMois('2026-07'), 'juillet 2026');
  assert.strictEqual(KC.fmtMois('2026-12'), 'décembre 2026');
  assert.strictEqual(KC.fmtMois('n\'importe quoi'), 'n\'importe quoi', 'ce qui n\'est pas un mois reste tel quel');
  const l = livreAvecPaie();
  const decl = { ok: true, type: 'tva', periode: '2026-05', au: '2026-05-31', comptes: { collectee: '4367', deductible: '4366', aPayer: '4365' },
    cases: { tvaCollectee: { montant: 950 }, tvaDeductible: { montant: 0 }, creditReporte: { montant: 0 }, timbre: { montant: 0 }, retenuesOperees: { montant: 0 } } };
  assert.strictEqual(KC.ecritureDeclaration(l, decl).libelle, 'Déclaration de mai 2026');
  // Le contrôle de clôture qui nomme les mois sans déclaration.
  const tva = KC.controlesCloture(l, {}).find(c => c.id === 'tva');
  assert.ok(tva && !tva.ok, 'le livre a des mois sans déclaration');
  assert.ok(!/\b20\d\d-\d\d\b/.test(tva.detail), `aucun mois en forme machine : ${tva.detail}`);
  assert.ok(/mars 2026/.test(tva.detail), tva.detail);
  // Le refus de refaire une déclaration déposée.
  const posee = KC.poserDeclaration(l, decl, 'Amine', 5);
  assert.ok(posee.ok, posee.motif);
  KC.pointerDeclaration(l, '2026-05', 'deposee', { le: '2026-06-14' }, 'Amine', 6);
  const refus = KC.poserDeclaration(l, decl, 'Amine', 7);
  assert.ok(!refus.ok);
  assert.ok(/mai 2026/.test(refus.motif) && /14\/06\/2026/.test(refus.motif), refus.motif);
});

// ---------------------------------------------------------------- U-15 — l'intitulé des à-nouveaux

t('U-15 : le tableau des à-nouveaux porte le NOM du compte, par le résolveur unique', () => {
  const src = code('src', 'cabinet', 'renderer', 'app.js');
  const zone = tranche(src, 'function vueCloture(');
  assert.ok(/const nomAN = nomDeCompte\(\)/.test(zone), 'la vue doit prendre le résolveur unique (9.8.7)');
  const i = zone.indexOf('d.anouveaux.lignes.map(');
  assert.ok(i > 0, 'le tableau des à-nouveaux est introuvable');
  const ligne = zone.slice(i, i + 500);
  assert.ok(/<td class="tronq"[^>]*>\$\{esc\(nomAN\(l\.compte, l\.libelle\)\)\}<\/td>/.test(ligne),
    'la colonne « Intitulé » doit lire le nom du compte, pas le libellé vide de la ligne');
});

// ---------------------------------------------------------------- U-05 — les mois de la mission

t('U-05 : la fiche et sa comptabilité lisent le MÊME début de mission', () => {
  const pk = m => ({ month: m, definitive: true, receivedAt: 1, files: 3, missing: [] });
  const cas = [
    C.migrateDossier({ id: 'a', name: 'Repris en juillet', packs: [pk('2026-07'), pk('2026-08')] }),
    C.migrateDossier({ id: 'b', name: 'Mission posée', from: '2026-03', packs: [pk('2026-07')] }),
    C.migrateDossier({ id: 'c', name: 'Hors SkanFact', manual: true, packs: [] }),
    C.migrateDossier({ id: 'd', name: 'Vingt ans', from: '2006-01', packs: [] })
  ];
  const auj = '2026-09-23';
  cas.forEach(d => {
    const mois = C.dossierMonths(d, auj);
    const debut = C.debutDeMission(d, auj);
    // Le calendrier du Suivi dit « hors mission » tout mois AVANT son premier mois attendu : les
    // deux doivent venir de la même fonction.
    assert.strictEqual(mois.length ? mois[0].month : '', debut, `${d.name} : le Suivi et la Comptabilité divergent`);
  });
  assert.strictEqual(C.debutDeMission(cas[0], auj), '2026-07');
  assert.strictEqual(C.debutDeMission(cas[1], auj), '2026-03', 'le début de mission saisi passe avant le premier paquet');
  assert.strictEqual(C.debutDeMission(cas[2], auj), '', 'un client hors SkanFact sans début de mission n\'attend rien');
  assert.strictEqual(C.debutDeMission(cas[3], auj), '2021-09', 'borné à cinq ans, comme le calendrier');
  // Et le compte : un client repris en juillet n'a AUCUN mois manquant sur son exercice.
  assert.deepStrictEqual(C.moisManquants(['2026-07', '2026-08'], C.debutDeMission(cas[0], auj), '2026-12', auj), []);
  assert.strictEqual(C.moisManquants(['2026-07', '2026-08'], '2026-01', '2026-12', auj).length, 6,
    'sans la borne de mission, c\'était la fausse alerte « Il manque 6 mois »');
});

t('U-05 : la Comptabilité borne ses mois manquants par la mission, avec ou sans livre', () => {
  const src = code('src', 'cabinet', 'renderer', 'app.js');
  const zone = tranche(src, 'function lignesDeLaPeriode(');
  assert.ok(/function lignesDeLaPeriode\(dossier\)/.test(zone), 'la période doit connaître son dossier');
  assert.ok(/const mission = K\.debutDeMission\(dossier\)/.test(zone), 'elle lit le début de mission de cabcore');
  const appels = zone.match(/K\.moisManquants\([^;]*;/g) || [];
  assert.strictEqual(appels.length, 2, 'deux branches : le livre, et les paquets');
  appels.forEach(a => assert.ok(/mission/.test(a), `chaque compte des manques est borné par la mission : ${a}`));
  assert.ok(/lignesDeLaPeriode\(dossier\)/.test(tranche(src, 'function drawLivres(')),
    'et son unique appelant lui passe le dossier');
});

// ---------------------------------------------------------------- U-04 / U-25 — le CA nommé

t('U-04 : le CA du portefeuille porte sur UN mois nommé, jamais sur des mois différents', () => {
  const pk = (m, ca, devise) => ({ month: m, definitive: true, receivedAt: 1, files: 3, missing: [], figures: { ca, devise } });
  const d = [
    { id: 'a', name: 'A', packs: [pk('2026-07', 2000, 'DT'), pk('2026-08', '10000', 'DT')] },
    { id: 'b', name: 'B', packs: [pk('2026-03', 4000, 'DT')] },
    { id: 'c', name: 'C', packs: [pk('2026-08', 500.5, 'DT'), pk('2026-09', 99999, 'DT')] },
    { id: 'h', name: 'Hors', manual: true, packs: [] }
  ];
  const ca = C.caDuPortefeuille(d, '2026-09-23');
  // Août : A (10 000, en CHAÎNE — additionnée telle quelle elle se concaténerait) et C (500,5).
  // Septembre est le mois EN COURS : on ne le prend pas tant qu'un mois clos existe.
  assert.deepStrictEqual(ca, { mois: '2026-08', montant: 10500.5, devise: 'DT', clients: 2, sur: 3, devises: 1 });
  // Deux devises sur le même mois : pas de total, et on le dit par `null`, jamais 0.
  const deux = C.caDuPortefeuille([{ id: 'x', packs: [pk('2026-08', 100, 'DT')] }, { id: 'y', packs: [pk('2026-08', 100, 'EUR')] }], '2026-09-23');
  assert.strictEqual(deux.montant, null);
  assert.strictEqual(deux.devises, 2);
  // Aucun chiffre reçu : aucun mois, et rien d'inventé.
  assert.deepStrictEqual(C.caDuPortefeuille([{ id: 'z', packs: [{ month: '2026-08' }] }], '2026-09-23'),
    { mois: '', montant: null, devise: '', clients: 0, sur: 1, devises: 0 });
});

t('U-04 : la carte et le pied du tableau lisent la même fonction, et nomment le mois', () => {
  const src = code('src', 'cabinet', 'renderer', 'app.js');
  const carte = tranche(src, 'function portfolioPanel(');
  assert.ok(!/dernierCA|somme des derniers mois/.test(carte), 'la carte ne doit plus additionner les derniers mois reçus');
  // Le mois se lit sur la ligne du dessous (écrit dans l'étiquette, il poussait le chevron hors de
  // la carte au test humain) : la règle est qu'il soit NOMMÉ sur la carte, pas à quel étage.
  assert.ok(/p\.ca \|\| \{\}/.test(carte) && /esc\(K\.monthLabel\(ca\.mois\)\)/.test(carte),
    'la carte doit NOMMER le mois de son chiffre');
  const pied = tranche(src, 'function totalCA(');
  assert.ok(/K\.caDuPortefeuille\(/.test(pied), 'le pied du tableau lit la même fonction que la carte (6.8.1)');
  assert.ok(/K\.monthLabel\(ca\.mois\)/.test(pied), 'et il nomme son mois');
  assert.ok(/sortHead\('Dernier mois', 'dernier'\)[\s\S]{0,120}sortHead\('CA de ce mois', 'ca'/.test(src), 'la colonne dit de quel mois est son chiffre — celui de la colonne voisine —, et se trie');
});

t('U-25 : les quatre cartes du portefeuille ouvrent quelque chose', () => {
  const src = code('src', 'cabinet', 'renderer', 'app.js');
  const carte = tranche(src, 'function portfolioPanel(');
  const cles = [...carte.matchAll(/\$\{item\('([^']*)'/g)].map(m => m[1]);
  assert.strictEqual(cles.length, 4, `quatre cartes attendues, ${cles.length} trouvées`);
  cles.forEach(c => assert.ok(c, 'une carte sans clé ne s\'ouvre pas'));
  assert.ok(/<button type="button" class="stat ouvre" data-pf=/.test(carte), 'chaque carte est un vrai bouton');
  assert.ok(!/<\$\{cle \? 'button/.test(carte), 'plus de carte qui ressemble à un bouton sans en être un');
  // La couverture, comme celle de `TODO_ACTIONS` (7.0.0) : chaque carte a sa ligne dans la table.
  const i = src.indexOf('const CARTES_PORTEFEUILLE = {');
  assert.ok(i > 0, 'la table des cartes est introuvable');
  const table = src.slice(i, src.indexOf('};', i));
  cles.filter(c => c !== 'manquants').forEach(c => {
    assert.ok(new RegExp(`\\b${c}: \\{`).test(table), `la carte « ${c} » doit poser son filtre ou son tri`);
  });
  assert.ok(/if \(cle === 'manquants'\) \{ location\.hash = '#\/relances'/.test(tranche(src, 'function bindPortfolio(')),
    'les mois manquants mènent aux Relances');
});

t('U-25 : la fiche nomme la période de son CA, et ne colle plus deux bulles sur un titre', () => {
  const src = code('src', 'cabinet', 'renderer', 'app.js');
  const fiche = tranche(src, 'function drawDossier(');
  assert.ok(/CA \$\{esc\(periodeCA\)\}/.test(fiche), 'le CA de la fiche dit les mois qu\'il additionne');
  assert.ok(!/const totalCA\b/.test(fiche), 'une constante locale ne masque plus la fonction totalCA du module (10.8.0)');
  assert.ok(/row\.issues \?/.test(fiche) && /data-vers="paquets">\$\{esc\(pl\(row\.issues/.test(fiche),
    'les points signalés se nomment sur la fiche et mènent aux paquets');
});

// ---------------------------------------------------------------- U-22 — la phrase suit le bouton

t('U-22 : la phrase qui désigne « Relancer » suit la condition du bouton', () => {
  const src = code('src', 'cabinet', 'renderer', 'app.js');
  const fiche = tranche(src, 'function drawDossier(');
  // La couleur du bouton est l'affaire du test U-11 ci-dessous ; celui-ci ne juge que sa CONDITION.
  const bouton = /\$\{(row\.missingCount \|\| row\.provisionalCount) \? `<button class="[^"]*" id="rel">Relancer<\/button>`/.exec(fiche);
  assert.ok(bouton, 'le bouton « Relancer » et sa condition sont introuvables');
  const i = fiche.indexOf('Le bouton « Relancer », en haut');
  assert.ok(i > 0, 'la phrase est introuvable');
  const avant = fiche.slice(Math.max(0, i - 200), i);
  assert.ok(avant.includes('${' + bouton[1]), 'la phrase doit être gardée par la MÊME condition que le bouton');
});

// U-11 sur la fiche : « Relancer » n'est le bouton principal que là où il est l'étape suivante. Sur
// l'onglet Comptabilité, l'étape suivante est le geste du livre (« Créer le livre… ») : deux boutons
// verts l'un au-dessus de l'autre, et l'œil ne sait plus lequel est la suite. On ÉVALUE la classe du
// bouton pour chaque onglet, au lieu de recopier sa forme — une assertion qui recopie tombe sur du
// code juste au premier ajustement (7.16.0).
t('U-11 : sur la fiche, « Relancer » n\'est vert que sur les onglets où il est l\'étape suivante', () => {
  const src = code('src', 'cabinet', 'renderer', 'app.js');
  const fiche = tranche(src, 'function drawDossier(');
  const m = /`<button class="([^"]*)" id="rel">Relancer<\/button>`/.exec(fiche);
  assert.ok(m, 'le bouton « Relancer » de la fiche est introuvable');
  const classe = onglet => evaluer('`' + m[1] + '`', { onglet }).split(/\s+/);
  ['suivi', 'paquets'].forEach(o => assert.ok(classe(o).includes('btn-primary'),
    `sur l'onglet « ${o} », relancer EST l'étape suivante : le bouton doit rester principal`));
  assert.ok(!classe('comptabilite').includes('btn-primary'),
    'sur l\'onglet Comptabilité, « Relancer » est vert à côté du geste du livre : deux boutons principaux');
});

// Une liste de mois se dit par le formateur des relances (Cabinet 1.0.0 : « personne n'écrit
// juin 2026, juillet 2026 et août 2026 »), jamais recollée à la main. Le bandeau des livres
// incomplets écrivait « Il manque juin 2026 et juillet 2026 et août 2026 » — lu sur une capture du
// test humain ; quatre autres listes répétaient l'année à chaque mois. Une `<option>` par mois reste
// légitime : ce n'est pas une phrase.
t('Une liste de mois passe par K.monthListLabel ou K.missingLabel, jamais par un join', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const fautes = app.split('\n').filter(l =>
    /\.map\((?:K\.monthLabel|moisLabelCourt|\w+ => (?:K\.monthLabel|moisLabelCourt)\([^()]*\))\)\.join\(/.test(l));
  assert.deepStrictEqual(fautes.map(l => l.trim().slice(0, 100)), [], 'une liste de mois est recollée à la main');
  // L'instrument voit bien la faute qu'il interdit (un test qui ne peut pas échouer ne se garde pas).
  assert.ok(/\.map\((?:K\.monthLabel|moisLabelCourt|\w+ => (?:K\.monthLabel|moisLabelCourt)\([^()]*\))\)\.join\(/
    .test("manquants.map(moisLabelCourt).join(' et ')"), 'la sonde ne reconnaît plus la faute d\'origine');
  // Et le formateur dit ce qu'un humain écrit.
  assert.strictEqual(C.missingLabel(['2026-06', '2026-07', '2026-08']), 'juin, juillet et août 2026');
  assert.strictEqual(C.monthListLabel(['2026-04', '2026-05']), 'avril et mai 2026');
  assert.strictEqual(C.monthListLabel(['2025-12', '2026-01']), 'décembre 2025 et janvier 2026');
});

// U-06, trouvé par le test humain : l'adresse d'un écran du livre (« /comptabilite/banque ») sur un
// dossier qui n'a PAS de livre. La vue était calculée avant que l'écran indisponible ne soit ramené au
// livre-journal : `vueBanque` lisait `s.livre.releves` sur un livre absent, TypeError, et la page
// restait sur « Lecture de la comptabilité… » pour toujours. La garde passe AVANT tout ce qui lit
// l'écran demandé. `e2e:cabinet` refait le geste dans l'application.
t('U-06 : un écran du livre, demandé sur un dossier sans livre, se ramène au livre-journal AVANT d\'être dessiné', () => {
  const src = code('src', 'cabinet', 'renderer', 'app.js');
  const f = tranche(src, 'function drawLivres(');
  assert.ok(f.length > 3000 && f.includes('vueBanque(dossier)'), 'la tranche de drawLivres est trop courte ou ne contient pas ses vues : ' + f.length);
  const garde = f.indexOf('if (!ongletDispo(s.onglet))');
  const vue = f.indexOf('const corps =');
  assert.ok(garde > 0, 'la garde qui ramène un écran indisponible au livre-journal a disparu de drawLivres');
  assert.ok(vue > 0, 'le calcul de la vue est introuvable');
  assert.ok(garde < vue, 'la vue est calculée AVANT que l\'écran indisponible soit ramené au livre-journal : vueBanque lit un livre absent et la page reste figée');
  // Rien d'autre ne lit l'écran demandé avant la garde.
  assert.ok(!/s\.onglet\b/.test(f.slice(0, garde)), 'l\'écran demandé est lu avant d\'avoir été ramené à un écran qui existe');
});


// ================================================================ lot B — la saisie et le livre

// Les tables de la navigation de la comptabilité, ÉVALUÉES telles que l'application les porte.
function tablesCompta(app) {
  const pris = (re, quoi) => { const m = re.exec(app); assert.ok(m, quoi + ' a disparu'); return m[1]; };
  const ONGLETS_COMPTA = donnees(pris(/const ONGLETS_COMPTA = (\{[\s\S]*?\n  \});/, 'la table des écrans'));
  const GROUPES_COMPTA = donnees(pris(/const GROUPES_COMPTA = (\[[\s\S]*?\n  \]);/, 'la table des groupes'));
  const ONGLETS_SANS_LIVRE = donnees(pris(/const ONGLETS_SANS_LIVRE = (\[[^\]]*\]);/, 'la liste des écrans lus sans livre'));
  return { ONGLETS_COMPTA, GROUPES_COMPTA, ONGLETS_SANS_LIVRE };
}

t('U-06 : quatorze écrans, trois groupes dans l\'ordre du mois, chaque écran dans UN groupe', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const { ONGLETS_COMPTA, GROUPES_COMPTA, ONGLETS_SANS_LIVRE } = tablesCompta(app);
  const ecrans = Object.keys(ONGLETS_COMPTA);
  assert.ok(ecrans.length >= 14, 'les écrans de la comptabilité n\'ont pas été lus : ' + ecrans.length);
  // L'ordre du mois d'un comptable : il saisit, il consulte, il déclare et clôture.
  assert.deepStrictEqual(GROUPES_COMPTA.map(g => g.id), ['saisir', 'consulter', 'cloturer']);
  // Chaque écran vit dans UN groupe, et un groupe ne nomme que des écrans qui existent : un écran
  // oublié serait introuvable, un écran dans deux groupes allumerait deux groupes à la fois.
  ecrans.forEach(o => {
    const n = GROUPES_COMPTA.filter(g => g.onglets.includes(o)).length;
    assert.strictEqual(n, 1, `l'écran « ${ONGLETS_COMPTA[o]} » est dans ${n} groupe(s)`);
  });
  GROUPES_COMPTA.forEach(g => {
    assert.ok(g.onglets.length && g.label, `le groupe ${g.id} est vide ou sans nom`);
    g.onglets.forEach(o => assert.ok(ONGLETS_COMPTA[o], `le groupe ${g.id} nomme un écran inconnu : ${o}`));
  });
  // Sans livre, seuls les écrans lus dans les paquets existent — et ils tiennent dans UN groupe :
  // le sélecteur de groupes, qui n'aurait qu'un choix, ne se pose pas.
  const groupesSansLivre = GROUPES_COMPTA.filter(g => g.onglets.some(o => ONGLETS_SANS_LIVRE.includes(o)));
  assert.strictEqual(groupesSansLivre.length, 1, 'sans livre, les écrans lus dans les paquets doivent tenir dans un seul groupe');
  assert.ok(/\$\{groupes\.length > 1 \? `<div class="c-groupes" id="c-groupes"/.test(app), 'un sélecteur de groupes se pose même quand il n\'a qu\'un choix');
  // La saisie est le PREMIER écran du premier groupe : c'est là qu'un comptable passe ses journées.
  assert.strictEqual(GROUPES_COMPTA[0].onglets[0], 'saisie');
});

t('U-06 : l\'écran de la comptabilité vit dans l\'adresse, et « Précédent » y revient', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  // Le routeur passe le quatrième segment à la fiche, qui le respecte s'il désigne un écran.
  assert.ok(/drawDossier\(view, arg, hash\.split\('\/'\)\[2\], hash\.split\('\/'\)\[3\]\)/.test(app), 'le routeur ne transmet pas l\'écran de l\'adresse');
  assert.ok(/if \(sousOnglet && ONGLETS_COMPTA\[sousOnglet\]/.test(app), 'la fiche ignore l\'écran de l\'adresse');
  // Changer d'écran POUSSE une adresse — et redessine soi-même : `pushState` ne déclenche aucun
  // `hashchange`, donc sans ce dessin le clic ne ferait rien de visible (7.15.0).
  const aller = tranche(app, 'function allerSousOnglet(');
  assert.ok(/history\.pushState\(null, '', h\)/.test(aller) && /const h = adresseCompta\(dossier, onglet\)/.test(aller), 'changer d\'écran ne change pas l\'adresse');
  assert.ok(/drawLivres\(root, dossier\);\s*\}?$/.test(aller.trim()) || /\n    drawLivres\(root, dossier\);\n/.test(aller), 'changer d\'écran ne redessine pas');
  // Aucun autre chemin ne change d'écran sans l'adresse : chaque bouton passe par la même porte.
  // La remise en état au changement de DOSSIER n'est pas un geste : elle reprend l'écran qu'on
  // avait laissé sur ce dossier (H-5), et se juge à part — plus bas, par ce qu'elle rend.
  const reset = tranche(app, 'function changerDeDossierCompta(');
  const directs = [...app.replace(reset, '').matchAll(/\bs\.onglet = /g)].length;
  assert.ok(directs <= 3, `trop de chemins changent l'écran à la main (${directs}) : l'adresse ne suivrait plus`);
  // Une adresse qui promet un écran absent (sans livre) se corrige SANS entrée d'historique.
  assert.ok(/history\.replaceState\(null, '', adresseCompta\(dossier, 'journal'\)\)/.test(app), 'l\'adresse garde un écran qu\'on ne montre pas');
  // « Précédent » et « Suivant » existent — dans le menu, au clavier et aux boutons de la souris —,
  // et jamais sous une fenêtre ouverte.
  const main = code('src', 'cabinet', 'main.js');
  assert.ok(/label: 'Précédent', accelerator: 'CmdOrCtrl\+\[', click: act\('back'\)/.test(main), 'pas de « Précédent » dans le menu du Cabinet');
  assert.ok(/label: 'Suivant', accelerator: 'CmdOrCtrl\+\]', click: act\('forward'\)/.test(main), 'pas de « Suivant » dans le menu du Cabinet');
  const nav = tranche(app, 'function naviguerHistorique(');
  assert.ok(/#modal-root/.test(nav) && /children\.length\) return;/.test(nav), '« Précédent » change l\'écran sous une question ouverte');
  assert.ok(/history\.back\(\)/.test(nav) && /history\.forward\(\)/.test(nav), '« Précédent » ne passe pas par l\'historique');
  assert.ok(/e\.button === 3/.test(app) && /e\.button === 4/.test(app), 'les boutons latéraux de la souris ne font rien');
});

t('U-09 : une pièce commencée se voit, se nomme à la fermeture, et ne se jette pas sans retour', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const main = code('src', 'cabinet', 'main.js');
  // « Commencée » ET « touchée » : la date et le journal proposés ne comptent pas. Évalué, pas relu.
  // Les montants s'y lisent par la porte unique (H-3), évaluée elle aussi — jamais recopiée.
  const lireMontant = evaluer(/const lireMontant = (v => \{[^\n]*?\});/.exec(app)[1], { KC });
  const lignesReelles = evaluer(/const lignesReelles = (p => \(p\.lignes \|\| \[\]\)[\s\S]*?\}\)\);)/.exec(app)[1].replace(/;$/, ''), { lireMontant });
  const pieceCommencee = evaluer(/const pieceCommencee = (p => [\s\S]*?\|\| !!p\.pieceJointe\));/.exec(app)[1], { lignesReelles });
  const pieceEnCours = evaluer(/const pieceEnCours = (p => [^;]+);/.exec(app)[1], { pieceCommencee });
  const vide = { journal: 'VT', date: '2026-09-23', piece: '', libelle: '', lignes: [{ compte: '', debit: '', credit: '' }] };
  assert.strictEqual(pieceEnCours(vide), false, 'une pièce vide ne doit rien demander');
  assert.strictEqual(pieceEnCours({ ...vide, touchee: true }), false, 'une pièce touchée puis vidée ne doit rien demander');
  assert.strictEqual(pieceEnCours({ ...vide, lignes: [{ compte: '411' }] }), false, 'une pièce qu\'on n\'a pas touchée ne doit rien demander');
  assert.strictEqual(pieceEnCours({ ...vide, touchee: true, lignes: [{ compte: '411' }] }), true, 'un compte tapé est une pièce commencée');
  assert.strictEqual(pieceEnCours({ ...vide, touchee: true, libelle: 'Loyer' }), true, 'un libellé tapé est une pièce commencée');
  // La fermeture DEMANDE, « Annuler » par défaut, et nomme les dossiers.
  const ferme = main.slice(main.indexOf("mainWindow.on('close'"), main.indexOf("mainWindow.on('closed'"));
  assert.ok(/saisiesEnCours\.length && !fermerQuandMeme/.test(ferme) && /e\.preventDefault\(\)/.test(ferme), 'la fermeture ne s\'arrête pas sur une pièce commencée');
  assert.ok(/buttons: \['Annuler', 'Fermer sans enregistrer'\], defaultId: 0, cancelId: 0/.test(ferme), 'la question n\'a pas « Annuler » par défaut');
  // Une interface rechargée repart sans pièce : la liste de la précédente ne vaut plus rien.
  assert.ok(/webContents\.on\('did-navigate', \(\) => \{ saisiesEnCours = \[\]; \}\)/.test(main), 'un rechargement laisse une question pour une pièce disparue');
  assert.ok(/let dernierSignal = null;/.test(app), 'une interface qui redémarre ne redit pas qu\'elle n\'a rien en cours');
  // L'installation d'une mise à jour ferme l'application SANS passer par cette question : elle
  // refuse, sauf si l'interface a demandé et reçu « oui ».
  const inst = main.slice(main.indexOf("ipcMain.handle('upd:install'"), main.indexOf("ipcMain.handle('upd:openReleases'"));
  assert.ok(/if \(saisiesEnCours\.length && !\(opts && opts\.force\)\)/.test(inst), 'une mise à jour ferme l\'application sur une pièce commencée');
  const im = tranche(app, 'async function installerMaj(');
  assert.ok(/nomsDesSaisies\(\)/.test(im) && /confirmDialog\(/.test(im) && /force: true/.test(im), 'l\'interface n\'avertit pas avant de redémarrer pour une mise à jour');
  // Seuls des NOMS traversent le pont — jamais la pièce.
  const pre = code('src', 'cabinet', 'preload.js');
  assert.ok(/saisieEnCours: \(noms\) => ipcRenderer\.send\('cab:saisieEnCours', noms\)/.test(pre), 'le pont de la pièce en cours a changé de forme');
  // « Vider » laisse un « Annuler » (7.12.0).
  const vider = app.slice(app.indexOf("const vd = $('#sa-vider', el);"), app.indexOf("$$('[data-lot-journal]', el)"));
  assert.ok(/toastUndo\('Pièce vidée\.'/.test(vider) && /if \(pieceEnCours\(avant\)\)/.test(vider), '« Vider » jette une pièce sans retour possible');
  // Le point se met à jour pendant la frappe SANS redessiner (7.17.0).
  const sig = tranche(app, 'function signalerSaisies(');
  assert.ok(/x\.hidden = !saleDe\(x\.dataset\.sale\)/.test(sig) && !/drawLivres/.test(sig), 'le point de la pièce commencée redessine l\'écran pendant la frappe');
});

t('U-01 : la grille de saisie passe avant tout le reste', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  const style = lireSource('src', 'renderer', 'style.css');
  // Le retour vit sur la ligne du titre, pas une rangée au-dessus.
  assert.ok(/<div class="fiche-titre"><button class="btn btn-ghost btn-sm btn-back" id="back"/.test(app), 'le retour coûte encore une rangée au-dessus du titre');
  // L'état du livre vit dans la barre de la période : plus de bandeau vert entre l'onglet et la grille.
  assert.ok(/<span class="c-livre" id="c-livre-etat">/.test(app), 'l\'état du livre n\'est plus dans la barre de la période');
  assert.ok(!/<div class="ok-box mb box-gestes">/.test(app), 'le bandeau « Le livre de … » est revenu entre l\'onglet et la grille');
  // L'en-tête de la pièce tient sur UNE ligne, « Joindre » compris ; les guides n'ont leur rangée
  // que s'il y en a ; l'aide des touches vit SOUS la grille, repliable, et le choix est retenu.
  const vue = tranche(app, 'function vueSaisie(');
  const tete = vue.slice(vue.indexOf('<div class="sa-tete"'), vue.indexOf('<div class="scroll-x"><table class="list compact sa-grille">'));
  assert.ok(tete.length > 200 && tete.length < 6000, 'tranche de l\'en-tête suspecte : ' + tete.length);
  assert.ok(/id="sa-joindre"/.test(tete), '« Joindre » n\'est plus sur la ligne des champs');
  assert.ok(/\$\{guides\.length \? `<div class="sa-outils">/.test(tete), 'la rangée des guides s\'affiche sans guide');
  assert.ok(vue.indexOf('id="sa-touches"') > vue.indexOf('id="sa-lignes"'), 'l\'aide des touches repasse au-dessus de la grille');
  assert.ok(/<details class="sa-touches" id="sa-touches"/.test(vue) && /prefs\.set\('saTouches', tch\.open\)/.test(app), 'l\'aide des touches n\'est pas repliable, ou le choix n\'est pas retenu');
  // « Ces livres sont incomplets » parle de ce qu'on LIT : au-dessus de la grille, il repoussait les
  // lignes qu'on tape sous la ligne de flottaison. Sur les écrans de saisie, il se tait ; ailleurs il
  // porte son geste — la relance, préremplie sur les mois qui manquent (7.15.0).
  const al = /const alerte = ([^;]+);/.exec(app);
  assert.ok(al && /groupeCompta\(s\.onglet\)\.id === 'saisir' \? \[\] : avert/.test(al[1]), 'les alertes de complétude repassent au-dessus de la grille de saisie');
  assert.ok(/id="lv-relancer"/.test(app) && /writeRelance\(\{ \.\.\.r, missingMonths: manquants\.slice\(\) \}\)/.test(app), 'le manque nommé n\'a pas le geste qui le comble');
  // Des lignes de grille compactes : le sélecteur porte l'IDENTIFIANT, parce que la règle
  // générale des champs porte quatre `:not()` et qu'aucune classe ne la bat (7.27.0, 9.4.4).
  assert.ok(/^#sa-lignes input \{/m.test(css) && /^#sa-lignes td \{/m.test(css), 'la grille perd sa densité : une classe ne bat pas la règle générale des champs');
  // La barre des groupes reste en haut en défilant, collée au BORD de la fenêtre — un `top: 0`
  // collait sous le padding du conteneur, et les lignes passaient au-dessus d'elle.
  assert.ok(/^main \{ --main-haut: 32px;[^}]*padding: var\(--main-haut\)/m.test(style), 'le padding du conteneur n\'est pas nommé');
  const nav = css.slice(css.indexOf('.c-nav {'), css.indexOf('}', css.indexOf('.c-nav {')));
  assert.ok(/position: sticky; top: calc\(-1 \* var\(--main-haut/.test(nav), 'la barre des groupes colle sous le padding, et les lignes passent au-dessus');
});

t('U-02 / U-26 : aucune colonne collante sur une donnée, et des largeurs fixes dans la grille', () => {
  const style = lireSource('src', 'renderer', 'style.css');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  // SEULE la colonne d'actions colle : son en-tête est vide. La règle visait la dernière cellule
  // d'en-tête de TOUT tableau, et « À saisir » (une donnée) collait par-dessus juillet et août.
  const regles = style.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.scroll-x table\.list th:last-child:empty \{/.test(regles), 'la colonne collante n\'est plus limitée à l\'en-tête vide');
  assert.ok(!/\.scroll-x table\.list th:last-child[,\s{]/.test(regles), 'une colonne de données peut encore coller');
  // Les colonnes de texte cèdent la place aux montants au lieu de pousser Débit et Crédit sous la
  // colonne collante.
  assert.ok(/#c-livres table\.list:not\(\.sa-grille\) td\.tronq \{ max-width: 0;/.test(css), 'les libellés du journal repoussent encore les montants');
  assert.ok(/\.dl-table td\.dl-client \{[^}]*max-width: 0/.test(css), 'le nom du client repousse encore les colonnes de la liste');
  // U-26 : la grille a des largeurs FIXES, une par colonne — l'intitulé qui apparaît pendant la
  // frappe ne fait plus sauter les colonnes sous le curseur.
  const vue = tranche(app, 'function vueSaisie(');
  const cols = (/<colgroup>([\s\S]*?)<\/colgroup>/.exec(vue) || [])[1] || '';
  const nbCols = (cols.match(/<col /g) || []).length;
  const entete = /<thead><tr>([\s\S]*?)<\/tr><\/thead>/.exec(vue.slice(vue.indexOf('sa-grille')))[1];
  assert.strictEqual(nbCols, (entete.match(/<th/g) || []).length, 'la grille n\'a pas une largeur par colonne');
  assert.ok(/\.sa-grille \{[^}]*table-layout: fixed/.test(css), 'sans `table-layout: fixed`, les largeurs ne tiennent pas');
});

t('U-27 : créer le livre finit sur la suite, et le libellé dit l\'écran d\'arrivée', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/id="lv-relire">Créer le livre à partir des paquets reçus<\/button>/.test(app), 'le geste qui agit tout de suite promet encore une fenêtre (points de suspension)');
  const cr = tranche(app, 'function compteRendu(');
  assert.ok(/id="cr-fermer">Fermer/.test(cr), 'le compte rendu ne se ferme plus');
  assert.ok(/g\.primaire \? ' id="ok"'/.test(cr), 'Entrée ne mène plus au geste principal');
  const relire = tranche(app, 'async function relireLesPaquets(');
  const gestes = /await compteRendu\([\s\S]*?\[([\s\S]*?)\]\);/.exec(relire);
  assert.ok(gestes, 'le compte rendu ne propose aucune suite');
  assert.ok(/label: 'Voir le livre-journal', onglet: 'journal', primaire: !br/.test(gestes[1]), 'la suite « livre-journal » a disparu');
  assert.ok(/`Voir le brouillard \(\$\{br\}\)`/.test(gestes[1]) && !/Valider le brouillard/.test(gestes[1]), 'le geste ouvre la Saisie : il ne peut pas promettre de valider');
  assert.ok(/primaire: !!br/.test(gestes[1]), 'le brouillard qui attend une décision n\'est pas le geste principal');
  assert.ok(/allerSousOnglet\(root, dossier, suite\.onglet\)/.test(relire), 'la suite choisie ne mène nulle part');
});

t('U-17 / U-29 : une forme par état de production, et le badge hors de la cellule tronquée', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const cab = lireSource('src', 'cabinet', 'cabcore.js');
  const signes = donnees(/const SIGNE_PRODUCTION = (\{[^}]*\});/.exec(app)[1]);
  const legende = donnees(/const LEGENDE_PRODUCTION = (\[[\s\S]*?\]);/.exec(app)[1]);
  // Chaque étape que le MOTEUR peut rendre a sa forme et son mot, lus dans cabcore — jamais recopiés.
  const expr = /etape: (!recu \? '[^\n]*)/.exec(cab)[1];
  const etapes = [...expr.matchAll(/'([a-z]+)'/g)].map(m => m[1]).concat(['hors']);
  etapes.forEach(e => {
    assert.ok(signes[e], `l'étape « ${e} » n'a pas de forme`);
    assert.ok(legende.some(([k]) => k === e), `l'étape « ${e} » n'est pas dans la légende`);
  });
  // Une FORME par état : une couleur seule n'est pas une information (9.4.4).
  const formes = Object.values(signes);
  assert.strictEqual(new Set(formes).size, formes.length, 'deux états partagent la même forme');
  // La légende se DÉDUIT de la table : écrite à la main, elle oublierait l'étape suivante.
  assert.ok(/\$\{LEGENDE_PRODUCTION\.map\(\(\[etape, mot\]\) =>/.test(app), 'la légende n\'est plus engendrée depuis la table');
  // U-29 : le nom se tronque, jamais le badge qui le suit.
  assert.ok(/<td class="prod-client"><span class="prod-nom" title=/.test(app), 'le nom du client et son badge sont redevenus une seule cellule tronquée');
});

// ============================================================================================
// Lot B bis — ce que le test « comme un humain » a trouvé APRÈS le lot B (23/09/2026).
//
// Le lot B passait ses 829 tests, ses 37 preuves par réintroduction et ses douze parcours. Puis
// l'application a été ouverte sur un écran virtuel et parcourue à la souris et au clavier — xdotool,
// Browser Use, Playwright branché sur la même fenêtre — comme un comptable. Sept défauts de plus,
// dont un chiffre qui se lit faux (« 250.000 ») et des pièces sans leurs actions. Aucun ne se voyait
// dans un test : ils vivaient dans l'ORDRE des gestes et dans ce que l'œil lit.
// ============================================================================================

// Un faux DOM minimal : ce que `brancherMenus` touche, et rien d'autre. Un sélecteur inattendu fait
// tomber le test au lieu d'être imité à moitié.
function fauxDom() {
  return class El {
    constructor(parent, attrs) {
      this.attrs = { ...(attrs || {}) }; this.enfants = []; this.parentElement = parent || null;
      this.dataset = {}; if (this.attrs['data-rowmenu'] != null) this.dataset.rowmenu = this.attrs['data-rowmenu'];
      this.classList = { add: () => {} }; this.retire = false; this.onclick = null;
      if (parent) parent.enfants.push(this);
    }
    setAttribute(k, v) { this.attrs[k] = v; }
    removeAttribute(k) { delete this.attrs[k]; }
    remove() { this.retire = true; if (this.parentElement) this.parentElement.enfants = this.parentElement.enfants.filter(e => e !== this); }
    closest(sel) {
      assert.strictEqual(sel, '[data-menus]', 'le faux DOM ne connaît que ce sélecteur : ' + sel);
      for (let e = this; e; e = e.parentElement) if ('data-menus' in e.attrs) return e;
      return null;
    }
    querySelectorAll(sel) {
      assert.strictEqual(sel, '[data-rowmenu]', 'le faux DOM ne connaît que ce sélecteur : ' + sel);
      const out = [];
      const tour = e => e.enfants.forEach(c => { if ('data-rowmenu' in c.attrs) out.push(c); tour(c); });
      tour(this);
      return out;
    }
  };
}
const chargerRowMenu = () => {
  const ctx = { window: {} };
  require('vm').runInNewContext(lireSource('src', 'renderer', 'rowmenu.js'), ctx);
  return ctx.window.RowMenu;
};

t('H-4 : une racine ne juge que SES lignes — la fiche ne retire plus les actions du livre-journal', () => {
  const RM = chargerRowMenu();
  const El = fauxDom();
  const action = label => ({ icon: 'loupe', label, run: () => {} });
  const tableFiche = id => id === 'F:D1' ? [action('Imprimer la fiche'), action('Appeler le client')] : [];
  const tableJournal = id => id === 'E:e1' ? [action('Contre-passer'), action('Voir dans le paquet')] : [];
  // L'ordre qui cassait, celui d'un livre déjà en mémoire : le journal se dessine et se lie
  // d'abord, la fiche se lie ensuite, sur toute la vue qui le CONTIENT.
  const vue = new El(null, {});
  const entete = new El(vue, { 'data-rowmenu': 'F:D1' });
  const livres = new El(vue, {});
  const piece = new El(livres, { 'data-rowmenu': 'E:e1' });
  RM.brancherMenus(livres, tableJournal);
  RM.brancherMenus(vue, tableFiche);
  assert.ok(!piece.retire, 'la table de la fiche a retiré le bouton d\'une pièce du journal');
  assert.strictEqual(typeof piece.onclick, 'function', 'la pièce a perdu son menu d\'actions');
  assert.ok(!entete.retire && typeof entete.onclick === 'function', 'l\'en-tête de la fiche doit garder son menu');
  // La règle d'origine tient toujours, dans chaque racine : une ligne sans action perd son bouton.
  const mort = new El(vue, { 'data-rowmenu': 'F:inconnu' });
  const orphelin = new El(livres, { 'data-rowmenu': 'E:inconnu' });
  RM.brancherMenus(livres, tableJournal);
  RM.brancherMenus(vue, tableFiche);
  assert.ok(mort.retire && orphelin.retire, 'une ligne sans action doit perdre son bouton (7.29.0)');
  // L'autre ordre — la fiche d'abord, le journal ensuite — marchait déjà : il marche encore.
  const vue2 = new El(null, {});
  const livres2 = new El(vue2, {});
  RM.brancherMenus(vue2, tableFiche);
  const piece2 = new El(livres2, { 'data-rowmenu': 'E:e1' });
  RM.brancherMenus(livres2, tableJournal);
  assert.strictEqual(typeof piece2.onclick, 'function', 'le journal dessiné après la fiche doit avoir ses actions');
});

t('H-5 : chaque dossier rouvre sur l\'écran de comptabilité où on l\'a laissé', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const livresState = { dossierId: '', onglet: 'journal', dernierParGroupe: {} };
  const changer = evaluer(tranche(app, 'function changerDeDossierCompta('), { livresState, ecransCompta: {} });
  changer('BEJI');
  assert.strictEqual(livresState.onglet, 'journal', 'un dossier jamais ouvert s\'ouvre sur le livre-journal');
  livresState.onglet = 'saisie'; livresState.dernierParGroupe = { saisir: 'saisie' };
  changer('CAFE');
  assert.strictEqual(livresState.onglet, 'journal', 'un AUTRE dossier ne reprend pas l\'écran du premier');
  livresState.onglet = 'balance'; livresState.dernierParGroupe = { consulter: 'balance' };
  changer('BEJI');
  assert.strictEqual(livresState.onglet, 'saisie', 'Béji doit rouvrir sur la Saisie où sa pièce attend');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(livresState.dernierParGroupe)), { saisir: 'saisie' }, 'la mémoire des groupes suit le dossier');
  changer('CAFE');
  assert.strictEqual(livresState.onglet, 'balance', 'le second dossier retrouve aussi le sien');
  // Le reste repart à zéro : un filtre qu'on ne voit pas cache ce qu'on est venu chercher (9.4.6).
  livresState.q = 'loyer'; livresState.journal = 'AC';
  changer('BEJI');
  assert.strictEqual(livresState.q, '', 'une recherche d\'un dossier ne suit pas dans l\'autre');
  assert.strictEqual(livresState.journal, '', 'un filtre de journal ne suit pas dans l\'autre');
  assert.ok(/changerDeDossierCompta\(dossier\.id\);/.test(app), 'la fiche ne passe pas par la mémoire par dossier');
});

t('H-6 : la barre des groupes ne saute pas d\'un groupe à l\'autre', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('el.innerHTML = `${sansLivre}');
  assert.ok(i > 0, 'le gabarit de la comptabilité est introuvable');
  // Bornée sur la FIN du gabarit (`${corps}`), jamais sur le premier « `; » : un gabarit imbriqué
  // (le bouton d'un groupe) en porte un, et la tranche s'arrêtait au milieu de la barre.
  const fin = app.indexOf('${corps}`;', i);
  const z = app.slice(i, fin);
  assert.ok(fin > i && z.length > 400 && z.length < 6000, 'tranche suspecte : ' + z.length);
  const iNav = z.indexOf('<div class="c-nav">'), iAlerte = z.indexOf('${alerteHtml}');
  assert.ok(iNav > 0 && iAlerte > 0, 'la barre ou l\'alerte ont disparu du gabarit');
  assert.ok(iAlerte > iNav, 'l\'alerte des mois manquants est posée AU-DESSUS de la barre : elle la fait sauter d\'un groupe à l\'autre');
});

t('H-2 : le point « non enregistrée » ne pousse rien pendant la frappe', () => {
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const regle = /\n\.sa-sale \{([^}]*)\}/.exec(css);
  assert.ok(regle, 'la règle du point a disparu');
  assert.ok(/position: absolute/.test(regle[1]), 'le point vit dans le flux : il décale la rangée d\'onglets à la première frappe');
  assert.ok(/#d-tabs button, \.c-groupes button, #c-tabs button \{ position: relative; \}/.test(css),
    'le point n\'a plus d\'ancre : il partirait dans le coin de la page');
});

t('H-3 : un montant s\'écrit en français dans un champ, et se relit tel que le comptable le tape', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const dinar = evaluer(/const dinar = (cur => [^;]+);/.exec(app)[1]);
  const money = evaluer(/const money = (\(n, cur\) => \{[\s\S]*?\n  \});/.exec(app)[1], { dinar });
  const montant = evaluer(/const montant = (n => [^;]+);/.exec(app)[1], { money });
  const montantChamp = evaluer(/const montantChamp = (n => \{[^\n]*?\});/.exec(app)[1], { montant });
  const lireMontant = evaluer(/const lireMontant = (v => \{[^\n]*?\});/.exec(app)[1], { KC });
  // Le défaut vu : Tab soldait en écrivant « 250.000 » — deux cent cinquante mille, en français.
  assert.strictEqual(montantChamp(250), '250,000', 'un champ rempli par l\'application porte encore le point décimal');
  assert.strictEqual(montantChamp(0), '', 'un zéro ne se tape pas dans une colonne vide');
  // Aller-retour : ce que l'application écrit, elle le relit au millime — y compris un découvert,
  // dont le moins doit rester lisible (le moins typographique, lui, se perdrait).
  [250, 1250.5, 3247560, 0.001, 399.531, -120.5].forEach(x =>
    assert.strictEqual(lireMontant(montantChamp(x)), x, `${x} ne revient pas de son champ (« ${montantChamp(x)} »)`));
  // Et ce qu'un comptable tape. L'espace des milliers valait ZÉRO avant, en silence.
  assert.strictEqual(lireMontant('1 250,500'), 1250.5, 'l\'espace des milliers fait lire zéro');
  assert.strictEqual(lireMontant('1.250,500'), 1250.5, 'le point des milliers fait lire faux');
  assert.strictEqual(lireMontant('1250.5'), 1250.5);
  assert.strictEqual(lireMontant('1.250.000'), 1250000, 'plusieurs points et aucune virgule : des milliers');
  assert.strictEqual(lireMontant('12a'), 0);
  // Ce qui ne se lit pas du tout se NOMME dans la grille, jamais « aucun montant ».
  const montantIllisible = evaluer(/const montantIllisible = (v => \{[^\n]*?\});/.exec(app)[1], { KC });
  const illisibles = evaluer(/const montantsIllisibles = (p => \{[\s\S]*?\n  \});/.exec(app)[1], { montantIllisible });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(illisibles({ lignes: [{ debit: '1 250,500' }, { credit: '12a' }] }))),
    ['Ligne 2 : « 12a » n\'est pas un montant (crédit).'], 'un montant illisible n\'est pas nommé');
  // Et la porte qui NOMME est celle qui juge, en direct comme à l'enregistrement (9.4.5) — jugée sur
  // ce qu'elle REND, pas sur ce qu'elle mentionne : une assertion sur la mention restait verte avec
  // la branche retirée (7.2.0, trouvé en essayant de la faire tomber).
  const lignesReelles = evaluer(/const lignesReelles = (p => \(p\.lignes \|\| \[\]\)[\s\S]*?\}\)\);)/.exec(app)[1].replace(/;$/, ''), { lireMontant });
  const ecritureSaisie = evaluer(/const ecritureSaisie = (p => \(\{[\s\S]*?\}\));/.exec(app)[1], { lignesReelles });
  const verdictSaisie = evaluer(/const verdictSaisie = (\(p, plan, opts\) => \{[\s\S]*?\n  \});/.exec(app)[1],
    { montantsIllisibles: illisibles, KC, ecritureSaisie });
  const plan = ['606', '532'];
  const piece = lignes => ({ date: '2026-09-23', journal: 'AC', piece: 'F-1', libelle: 'Loyer de septembre', lignes });
  // Le cas vu à l'écran : « 12a » au débit et « 1 250,500 » au crédit. Avant, la phrase disait
  // « Ligne 1 : aucun montant » — sous les yeux de qui venait de taper quelque chose.
  const refus = verdictSaisie(piece([{ compte: '606', debit: '12a', credit: '' }, { compte: '532', debit: '', credit: '1 250,500' }]), plan);
  assert.strictEqual(refus.ok, false, 'une pièce qui porte un montant illisible est acceptée');
  assert.strictEqual(refus.motif, 'Ligne 1 : « 12a » n\'est pas un montant (débit).', 'le refus ne nomme pas la case illisible');
  assert.strictEqual(verdictSaisie(piece([{ compte: '606', debit: '12a' }, { compte: '532', credit: '1 250,500' }]), plan, { valider: true }).motif,
    refus.motif, 'la validation juge par une autre porte que le brouillard');
  // Une pièce juste, tapée comme un comptable tape — espace ET point des milliers —, passe.
  const juste = verdictSaisie(piece([{ compte: '606', debit: '1 250,500' }, { compte: '532', credit: '1.250,500' }]), plan, { valider: true });
  assert.ok(juste.ok, 'une pièce juste tapée en français est refusée : ' + juste.motif);
  assert.strictEqual(juste.debit, 1250.5, 'la pièce juste est lue à un autre montant que celui tapé');
  // Une vraie cession tapée « 1 500,000 » s'écrivait « mise au rebut » : le motif suit le prix LU.
  assert.ok(!/Number\(v\('cessionPrix'\)\)/.test(app), 'le motif d\'une cession se lit encore sur le texte');
});

// La spécificité d'un sélecteur, calculée — c'est elle qui décide, jamais l'ordre dans lequel on
// relit la feuille (7.23.0, 7.27.0, 7.30.0, 9.4.4, U-01, H-3 bis). `:not(X)` vaut ce que vaut X.
function specificite(sel) {
  const s = sel.replace(/::[\w-]+/g, '');
  const a = (s.match(/#[\w-]+/g) || []).length;
  const b = (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]+\]/g) || []).length
    + (s.match(/:(?!not\()[\w-]+/g) || []).length;
  const c = (s.match(/(?:^|[\s>+~(])[a-z][a-z0-9-]*/gi) || []).length;
  return [a, b, c];
}
const plusFort = (x, y) => x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2];
// Les règles d'une feuille, sans commentaires : [{ selecteurs: [...], corps }].
const regles = css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(m => ({ selecteurs: m[1].split(',').map(x => x.trim()).filter(Boolean), corps: m[2] }));

t('H-3 bis : une case refusée reste ROUGE — au repos, au survol et sous le curseur', () => {
  // Contre-preuve de l'outil avant de juger le vrai code : il doit classer ce que le navigateur classe.
  assert.deepStrictEqual(specificite('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range])'), [0, 4, 1]);
  assert.deepStrictEqual(specificite('#sa-lignes tr:hover input'), [1, 1, 2]);
  assert.deepStrictEqual(specificite('#sa-lignes input.sa-ko'), [1, 1, 1]);
  const style = lireSource('src', 'renderer', 'style.css');
  const cab = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  // Ce que la marque doit battre : la règle générale des champs, en clair ET en sombre — LUES dans la
  // feuille partagée, jamais recopiées (elles gagneront un `:not()` un jour).
  const generales = regles(style).flatMap(r => r.selecteurs)
    .filter(sel => /^(body\.dark )?input:not\(\[type=checkbox\]\)(:not\(\[type=[a-z]+\]\))*$/.test(sel));
  assert.ok(generales.length >= 2, 'la règle générale des champs est introuvable dans la feuille partagée');
  const aBattre = generales.map(specificite).reduce((m, x) => (plusFort(x, m) ? x : m));
  // Chaque règle qui peint une case refusée en rouge doit l'emporter.
  const rouges = regles(cab).filter(r => /border-color: var\(--danger\)/.test(r.corps))
    .flatMap(r => r.selecteurs).filter(sel => /\.sa-ko\b/.test(sel) && !/:not\(\.sa-ko\)/.test(sel));
  assert.ok(rouges.length >= 2, 'les marques rouges de la saisie ont disparu de la feuille du Cabinet');
  rouges.forEach(sel => assert.ok(plusFort(specificite(sel), aBattre),
    `« ${sel} » (${specificite(sel)}) perd contre la règle générale des champs (${aBattre}) : la case refusée ne devient jamais rouge`));
  // Le survol et le focus d'une ligne ne repeignent JAMAIS la case refusée : la règle du survol
  // battait celle de l'erreur, et le rouge disparaissait au moment où l'on venait corriger.
  const survols = regles(cab).filter(r => /border-color/.test(r.corps)).flatMap(r => r.selecteurs)
    .filter(sel => /#sa-lignes/.test(sel) && /:hover/.test(sel));
  assert.ok(survols.length >= 1, 'la règle du survol de la grille a disparu');
  survols.forEach(sel => {
    assert.ok(/:not\(\.sa-ko\)/.test(sel), `le survol repeint une case refusée : « ${sel} »`);
    assert.ok(/:not\(:focus\)/.test(sel), `le survol repeint la case sous le curseur : « ${sel} »`);
  });
  // L'en-tête porte l'identifiant que la règle vise.
  assert.ok(/<div class="sa-tete" id="sa-tete">/.test(code('src', 'cabinet', 'renderer', 'app.js')), 'l\'en-tête a perdu l\'identifiant de sa règle d\'erreur');
});

t('H-3 ter : une case illisible reste marquée après un redessin, par la MÊME définition', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const montantIllisible = evaluer(/const montantIllisible = (v => \{[^\n]*?\});/.exec(app)[1], { KC });
  ['12a', 'abc', '-', '1 25O,000'].forEach(v => assert.strictEqual(montantIllisible(v), true, `« ${v} » passe pour un montant`));
  ['', '   ', '0', '1 250,500', '1.250,500', '-120,500', '250.5'].forEach(v => assert.strictEqual(montantIllisible(v), false, `« ${v} » est lu comme illisible`));
  // La case REDESSINÉE porte la marque — la pièce qu'on rouvre, la ligne qu'on ajoute : la marque ne
  // se posait qu'à la frappe, et « 12a » revenait gris pendant que la phrase le nommait.
  const grille = tranche(app, 'function lignesSaisieHtml(');
  ['debit', 'credit'].forEach(k => {
    const inp = new RegExp(`<input data-k="${k}"[^\\n]*`).exec(grille);
    assert.ok(inp, `la case ${k} de la grille est introuvable`);
    assert.ok(inp[0].includes(`montantIllisible(l.${k}) ? ' sa-ko' : ''`), `la case ${k} redessinée perd sa marque rouge`);
    assert.ok(inp[0].includes(`montantIllisible(l.${k}) ? ' aria-invalid="true"' : ''`), `la case ${k} redessinée ne se dit plus fautive au lecteur d'écran`);
  });
  // La frappe, la phrase et le dessin : UNE définition. Une seconde divergerait au premier ajustement.
  assert.ok(/inp\.classList\.toggle\('sa-ko', montantIllisible\(inp\.value\)\)/.test(app), 'la frappe juge avec sa propre définition');
  const phrase = /const montantsIllisibles = (p => \{[\s\S]*?\n  \});/.exec(app)[1];
  assert.ok(/montantIllisible\(l\[k\]\)/.test(phrase) && !/nombreStrict/.test(phrase), 'la phrase juge avec sa propre définition');
  // Deux portes et deux seulement lisent un montant tapé : `lireMontant` (ce qu'il vaut) et
  // `montantIllisible` (s'il se lit). Un troisième appel serait une troisième définition.
  const appels = app.split('\n').filter(l => /KC\.nombreStrict\(/.test(l));
  assert.strictEqual(appels.length, 2, 'une autre lecture des montants s\'est glissée dans l\'écran : ' + appels.map(l => l.trim().slice(0, 60)).join(' | '));
  assert.ok(appels.some(l => /const lireMontant = /.test(l)) && appels.some(l => /const montantIllisible = /.test(l)),
    'les deux portes de lecture des montants ont changé de place');
  // Le refus envoie à la CASE fautive avant de regarder les mots : « « date » n'est pas un montant »
  // amenait le curseur dans le champ Date.
  const enr = app.slice(app.indexOf('const enregistrer = async (puisValider) => {'));
  const iIll = enr.indexOf('if (illisible && ligneFautive)'), iDate = enr.indexOf("else if (/date/i.test(premier)");
  assert.ok(iIll > 0 && iDate > iIll, 'le refus d\'un montant illisible peut envoyer le curseur dans le mauvais champ');
});

t('H-8 : une fenêtre qui se ferme rend le curseur là d\'où il venait, dans les deux applications', () => {
  [['cabinet', code('src', 'cabinet', 'renderer', 'app.js')], ['entreprise', code('src', 'renderer', 'app.js')]].forEach(([quoi, app]) => {
    const m = tranche(app, 'function modal(');
    assert.ok(m.length > 800 && m.length < 9000, `app ${quoi} : tranche de modal() suspecte (${m.length})`);
    // Retenu AVANT que la fenêtre ne prenne le curseur pour elle — sinon on retient son propre champ.
    const iAvant = m.indexOf('const avant = document.activeElement;');
    const iPrise = m.search(/\b(cible|first)\.focus\(\)/);
    assert.ok(iAvant > 0, `app ${quoi} : la fenêtre ne retient pas d'où vient le curseur`);
    assert.ok(iPrise > iAvant, `app ${quoi} : le curseur est retenu APRÈS que la fenêtre l'a pris`);
    // Jugé AVANT de se retirer : après, le curseur est toujours sur la page, et la règle rendrait le
    // curseur même à qui l'a déjà posé ailleurs.
    const close = m.slice(m.indexOf('const close = () =>'));
    const iDedans = close.indexOf('layer.contains(document.activeElement)');
    const iRetrait = close.indexOf('layer.remove()');
    const iRendu = close.indexOf('avant.focus()');
    assert.ok(iDedans > 0 && iRetrait > iDedans, `app ${quoi} : la fenêtre regarde où est le curseur après s'être retirée`);
    assert.ok(iRendu > iRetrait, `app ${quoi} : la fenêtre ne rend pas le curseur en se fermant`);
    assert.ok(/if \(curseurDedans && avant && avant !== document\.body && avant\.isConnected/.test(close),
      `app ${quoi} : la fenêtre rend le curseur sans vérifier qu'il était chez elle, ou à un élément disparu`);
  });
});

t('H-9 : une colonne SOUPLE garde un plancher — un nom ne tombe jamais à quatre lettres', () => {
  // `max-width: 0` laisse une cellule descendre sous la largeur de son texte (U-02) : c'est ce qui
  // fait TENIR un tableau. Sans plancher, quand le tableau déborde quand même, la colonne de texte
  // paie pour rien — la liste des dossiers est tombée à « Phar… », « Tran… » dès qu'une colonne de
  // plus est apparue, et le Tiers du journal à « Cli… » à 960 px. Chaque colonne souple des deux
  // feuilles déclare donc un plancher, en pixels, qui laisse lire un nom.
  const feuilles = [['cabinet.css', lireSource('src', 'cabinet', 'renderer', 'cabinet.css')], ['style.css', lireSource('src', 'renderer', 'style.css')]];
  let vues = 0;
  feuilles.forEach(([nom, css]) => regles(css).forEach(r => {
    if (!/(^|;|\s)max-width:\s*0\s*(;|$)/.test(r.corps) || !r.selecteurs.some(s => /\btd\b/.test(s))) return;
    vues++;
    const plancher = /min-width:\s*(\d+)px/.exec(r.corps);
    assert.ok(plancher, `${nom} : « ${r.selecteurs.join(', ')} » peut descendre à zéro sans plancher`);
    assert.ok(Number(plancher[1]) >= 80, `${nom} : « ${r.selecteurs.join(', ')} » a un plancher de ${plancher[1]} px — trop étroit pour lire un nom`);
  }));
  assert.ok(vues >= 2, 'les colonnes souples ont disparu des feuilles : le test ne regarderait plus rien');
  // Le nom d'un client tient en entier dans la liste, jusqu'à la raison sociale la plus longue de
  // l'exemple — une largeur qu'on pose se RELIT contre ce qu'elle doit contenir.
  const liste = regles(lireSource('src', 'cabinet', 'renderer', 'cabinet.css')).find(r => r.selecteurs.includes('.dl-table td.dl-client'));
  assert.ok(liste && Number((/min-width:\s*(\d+)px/.exec(liste.corps) || [])[1]) >= 200, 'la colonne Client de la liste peut redescendre sous 200 px');
});

t('H-1 : le nom d\'un client hors SkanFact n\'est plus coupé par son étiquette', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const cellule = /<td class="dl-client">[\s\S]*?<\/td>/.exec(app);
  assert.ok(cellule, 'la cellule du nom a disparu');
  assert.ok(!/b-hors/.test(cellule[0]), 'l\'étiquette « hors SkanFact » vit encore dans la cellule qui se tronque');
  const suite = app.slice(cellule.index + cellule[0].length, cellule.index + cellule[0].length + 500);
  assert.ok(/r\.manual && !r\.lastLabel \? '<span class="badge b-hors"/.test(suite),
    '« hors SkanFact » ne vient plus expliquer le tiret de « Dernier mois »');
});

t('H-7 : chaque barre d\'onglets porte un nom, dans les deux applications', () => {
  [['cabinet', lireSource('src', 'cabinet', 'renderer', 'app.js')], ['entreprise', lireSource('src', 'renderer', 'app.js')]].forEach(([quoi, src]) => {
    const barres = [...src.matchAll(/<[a-z]+ [^>]*role="tablist"[^>]*>/g)].map(m => m[0]);
    assert.ok(barres.length >= 4, `app ${quoi} : seulement ${barres.length} barre(s) d'onglets trouvée(s)`);
    barres.forEach(b => assert.ok(/aria-label="[^"]+"/.test(b),
      `app ${quoi} : une barre d'onglets n'a pas de nom, un lecteur d'écran dit seulement « liste d'onglets » — ${b.slice(0, 90)}`));
  });
});

// ============================================================================================
// Lot C — la hiérarchie : ce qui se lit comme une valeur, ce qui se lit comme un exemple, et ce
// que dit un écran quand il ne trouve rien.
// ============================================================================================

t('U-18 : un texte d\'exemple se lit comme un exemple — gris, en graisse normale, dans les deux thèmes', () => {
  const style = lireSource('src', 'renderer', 'style.css');
  const commune = regles(style).find(r => r.selecteurs.includes('input::placeholder') && r.selecteurs.includes('textarea::placeholder')
    && !r.selecteurs.some(s => /dark/.test(s)));
  assert.ok(commune, 'aucune règle commune pour le texte d\'exemple des champs');
  // Un champ hérite du gras de son étiquette (`font: inherit`) : « +216 … » en 600 se lisait comme
  // un numéro déjà saisi. Mesuré dans les Réglages du Cabinet : poids 600, texte et exemple.
  assert.ok(/font-weight:\s*400/.test(commune.corps), 'le texte d\'exemple hérite encore du gras de son étiquette');
  assert.ok(/color:\s*var\(--muted\)/.test(commune.corps), 'le texte d\'exemple n\'est pas gris en thème clair');
  const sombre = regles(style).find(r => r.selecteurs.includes('body.dark input::placeholder'));
  assert.ok(sombre && /color:/.test(sombre.corps), 'le thème sombre a perdu le gris de son texte d\'exemple');
});

t('U-30 : la loupe vit avec le champ, et « rien trouvé » suit ce qu\'on a tapé — dans les deux applications', () => {
  [['cabinet', code('src', 'cabinet', 'renderer', 'app.js')], ['entreprise', code('src', 'renderer', 'app.js')]].forEach(([quoi, app]) => {
    const i = app.indexOf('<div class="help-search">');
    assert.ok(i > 0, `app ${quoi} : la recherche de l'Aide a disparu`);
    const bloc = app.slice(i, app.indexOf('id="aide-n"', i));
    assert.ok(bloc.length > 100 && bloc.length < 1200, `app ${quoi} : tranche suspecte (${bloc.length})`);
    // La loupe et le champ dans UNE enveloppe, que le compte des résultats ne fait pas grandir.
    assert.ok(/<span class="hs-champ"><svg class="hs-loupe"[\s\S]*?id="aide-q"[^>]*><\/span>/.test(bloc),
      `app ${quoi} : la loupe se centre sur un bloc qui grandit — elle descendra sous le texte dès qu'un compte s'affiche`);
  });
  const css = regles(lireSource('src', 'renderer', 'style.css')).find(r => r.selecteurs.includes('.help-search .hs-champ'));
  assert.ok(css && /position:\s*relative/.test(css.corps), 'l\'enveloppe de la loupe n\'est pas son repère');
  // La phrase d'une recherche vide des Réglages, écrite UNE fois pour les deux applications, jugée
  // sur ce qu'elle rend : un mot se NOMME, plusieurs mots se disent chacun nécessaires.
  const reg = lireSource('src', 'renderer', 'reglages.js');
  const ech = evaluer(/const ech = (s => String[\s\S]*?\.replace\(\/'\/g, '&#39;'\));/.exec(reg)[1]);
  const phraseRien = evaluer(/const phraseRien = (mots => \([\s\S]*?`\));/.exec(reg)[1], { ech });
  const un = phraseRien(['rapprochement']);
  assert.ok(/« rapprochement »/.test(un) && !/seul mot/.test(un), 'après un seul mot, la phrase demande encore d\'essayer « un seul mot » : ' + un);
  assert.ok(/un par un/.test(phraseRien(['banque', 'relevé'])), 'après plusieurs mots, la phrase ne dit pas que chacun doit s\'y trouver');
  assert.ok(/&lt;b&gt;/.test(phraseRien(['<b>'])), 'le mot tapé revient dans la page sans être échappé');
  assert.ok(/opts\.rienTrouve\(bruts, phraseRien\(bruts\)\)/.test(reg), 'les applications ne reçoivent plus la phrase calculée');
  // Nulle part la vieille phrase : elle a vécu dans quatre endroits des deux applications.
  // (du CODE : le commentaire qui explique le correctif cite la phrase, et accuserait du code juste.)
  [['cabinet', code('src', 'cabinet', 'renderer', 'app.js')], ['entreprise', code('src', 'renderer', 'app.js')], ['reglages.js', code('src', 'renderer', 'reglages.js')]].forEach(([quoi, src]) =>
    assert.ok(!/Essaie un seul mot/.test(src), `${quoi} : « Essaie un seul mot » s'affiche encore sans regarder ce qu'on a tapé`));
});

t('U-11 / U-13 / U-14 : la déclaration — ses étapes dans l\'ordre, un seul vert, des raisons entières', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const vue = tranche(app, 'function vueDeclaration(');
  assert.ok(vue.length > 3000 && vue.length < 12000, 'tranche suspecte : ' + vue.length);
  // U-11 — l'étape suivante, jugée sur ce qu'elle REND dans les cinq états du mois : « Préparer la
  // déclaration » était deux fois à l'écran, et une fois préparée plus rien ne disait la suite.
  const m = /const suivante = ([^;]+);/.exec(vue);
  assert.ok(m, 'l\'étape suivante n\'est plus calculée');
  const suivante = (posee, ecrite, deposee, payee) => evaluer(m[1], { posee, ecrite, deposee, payee });
  assert.strictEqual(suivante(null, false, false, false), 'preparer', 'avant tout, l\'étape suivante est « Préparer »');
  assert.strictEqual(suivante({}, false, false, false), 'ecriture', 'une déclaration préparée attend son écriture avant le dépôt');
  assert.strictEqual(suivante({}, true, false, false), 'deposee', 'une écriture déjà passée par le client ne doit pas rester l\'étape suivante');
  assert.strictEqual(suivante({}, true, true, false), 'payee', 'une déclaration déposée attend son paiement');
  assert.strictEqual(suivante({}, true, true, true), '', 'un mois payé n\'a plus d\'étape suivante');
  // Chaque bouton ne prend la couleur que si c'est SON étape.
  [['dc-preparer', 'preparer'], ['dc-ecriture', 'ecriture'], ['dc-deposee', 'deposee'], ['dc-payee', 'payee']].forEach(([id, pas]) =>
    assert.ok(new RegExp(`class="\\$\\{cls\\('${pas}'\\)\\}" id="${id}"`).test(vue), `${id} ne prend pas la couleur de SON étape`));
  const cls = evaluer(/const cls = (pas => [^;]+);/.exec(vue)[1], { suivante: 'deposee' });
  assert.ok(/btn-primary/.test(cls('deposee')) && !/btn-primary/.test(cls('payee')), 'la couleur ne suit pas l\'étape suivante');
  assert.ok(!/btn-primary/.test(vue.replace(/' btn-primary'/, '')), 'un second bouton principal est écrit en dur dans la déclaration');
  // Les étapes passent AVANT les cases : la suite se voit sans descendre sous quatorze lignes.
  const iSuite = vue.indexOf('id="dc-suite"'), iCases = vue.indexOf('<h2>Les cases');
  assert.ok(iSuite > 0 && iSuite < iCases, 'les étapes vivent encore sous les cases');
  // U-13 — aucun bandeau vert ni bleu avant les chiffres ; seul un contrôle qui ÉCHOUE en garde un
  // (orange, avec son geste). La promesse « ne dépose rien » vit avec les pense-bêtes qu'elle décrit.
  const avantCases = vue.slice(0, iCases);
  assert.ok(!/ok-box|info-box/.test(avantCases), 'un bandeau vert ou bleu est revenu avant les chiffres');
  assert.ok(/echecs\.length \? `<div class="warn-box/.test(avantCases), 'un contrôle qui échoue ne dit plus rien');
  assert.ok(/ne dépose rien/.test(vue.slice(iSuite, iCases)), 'la promesse a quitté les pense-bêtes qu\'elle décrit');
  // U-14 — la raison d'une case se lit en entier, sous son libellé, jamais coupée par une ellipse.
  assert.ok(!/\.slice\(0, 60\)/.test(vue), 'la raison d\'une case est encore coupée à soixante caractères');
  assert.ok(/<div class="small muted dc-raison">\$\{esc\(raison\)\}<\/div>/.test(vue), 'la raison ne vit plus sous le libellé');
  assert.ok(!/<td class="tronq"/.test(vue), 'une cellule tronquée est revenue dans le tableau des cases');
});

t('U-12 : un écran de travail s\'ouvre sur le dernier mois qui a des données, sinon le mois courant — jamais un mois futur', () => {
  // La règle, jugée sur ce qu'elle REND : la Paie s'ouvrait sur décembre et le 4e trimestre en
  // septembre, la Déclaration sur janvier faute d'écriture.
  assert.strictEqual(C.moisDeTravail([3, 8], 2026, '2026-09-23'), 8, 'le dernier mois qui a des données doit l\'emporter');
  assert.strictEqual(C.moisDeTravail([], 2026, '2026-09-23'), 9, 'sans données, l\'écran doit s\'ouvrir sur le mois courant');
  assert.strictEqual(C.moisDeTravail([], 2025, '2026-09-23'), 12, 'un exercice passé sans données s\'ouvre sur son dernier mois');
  assert.strictEqual(C.moisDeTravail([], 2027, '2026-09-23'), 1, 'un exercice futur s\'ouvre sur son premier mois, jamais sur un mois qui n\'existe pas');
  assert.strictEqual(C.moisDeTravail([13, 0, 'x'], 2026, '2026-02-10'), 2, 'un mois hors bornes ne doit pas passer pour une donnée');
  // Et les DEUX écrans passent par elle — une seconde règle écrite ailleurs divergerait.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const paie = tranche(app, 'function vuePaie(');
  assert.ok(/s\.paieMois = K\.moisDeTravail\(/.test(paie), 'la Paie ne choisit plus son mois par la règle commune');
  assert.ok(!/exercice\.au[^\n]*slice\(5, 7\)\)\s*\|\|\s*12/.test(paie), 'la Paie s\'ouvre encore sur le dernier mois de l\'exercice');
  const propose = tranche(app, 'function moisPropose(');
  assert.ok(/K\.moisDeTravail\(/.test(propose), 'la Déclaration ne choisit plus son mois par la règle commune');
});

t('U-11 / U-13 / U-23 / U-24 : la Paie — un seul vert à l\'étape suivante, des raisons visibles, des états vides qui disent quoi faire', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const vue = tranche(app, 'function vuePaie(');
  assert.ok(vue.length > 3000 && vue.length < 16000, 'tranche suspecte : ' + vue.length);
  // U-11 — jugée sur ce qu'elle rend : « + Bulletin… » était vert sur un dossier sans salarié.
  const m = /const suivante = ([^;]+);/.exec(vue);
  assert.ok(m, 'l\'étape suivante de la Paie n\'est plus calculée');
  const suivante = (actifs, manquants, aPasser) => evaluer(m[1], { actifs, manquants, aPasser });
  assert.strictEqual(suivante([], 0, 0), 'salarie', 'sans salarié, l\'étape suivante est de le déclarer');
  assert.strictEqual(suivante([{}], 1, 0), 'bulletin', 'un salarié sans bulletin : l\'étape suivante est le bulletin');
  assert.strictEqual(suivante([{}], 0, 1), 'ecrire', 'les bulletins faits : l\'étape suivante est l\'écriture');
  assert.strictEqual(suivante([{}], 0, 0), '', 'un mois écrit n\'a plus d\'étape suivante');
  [['pa-salarie', 'salarie'], ['pa-bulletin', 'bulletin'], ['pa-ecrire', 'ecrire']].forEach(([id, pas]) =>
    assert.ok(new RegExp(`class="\\$\\{cls\\('${pas}'\\)\\}" id="${id}"`).test(vue), `${id} ne prend pas la couleur de SON étape`));
  assert.ok(!/btn-primary/.test(vue.replace(/' btn-primary'/, '')), 'un second bouton principal est écrit en dur dans la Paie');
  // U-23 — la raison d'un bouton éteint se LIT à côté, pas seulement dans son infobulle.
  assert.ok(/id="pa-motifs"/.test(vue) && /pourquoiBulletin && /.test(vue) && /pourquoiEcrire && /.test(vue), 'les raisons des boutons éteints ne s\'affichent plus');
  assert.ok(/title="\$\{esc\(pourquoiBulletin\)\}"/.test(vue) && /title="\$\{esc\(pourquoiEcrire\)\}"/.test(vue), 'l\'infobulle et la phrase ne disent plus la même chose');
  // U-13 — l'orange pour ce qui demande un geste ; l'état normal (« non réglé ») en gris.
  assert.ok(/const aFaire = controles\.filter\(c => c\.niveau !== 'info'\)/.test(vue) && /aFaire\.length \? `<div class="warn-box/.test(vue),
    'un état normal repasse en orange dans les contrôles de la Paie');
  // U-24 — le panneau des salariés porte son geste, et une année sans bulletin ne montre pas des zéros.
  assert.ok(/Aucun salarié déclaré[\s\S]{0,160}id="pa-salarie2"/.test(vue), 'le panneau des salariés vide n\'a pas de bouton');
  assert.ok(/!anneeEntiere\.count \? `<div class="empty mini">/.test(vue), 'la masse salariale d\'une année sans bulletin est un tableau de zéros');
  // Deux tableaux côte à côte débordaient chacun de leur moitié (règle 3.4.0) : ils sont empilés.
  assert.ok(!/<div class="split mt">\s*<div class="panel"><h2>Les salariés/.test(vue), 'les salariés et la CNSS sont revenus côte à côte');
});

t('La règle H-3 portée à la Paie et à la fiche : montants en français, dates JJ/MM/AAAA, et un brut qui suit le salarié', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const sal = tranche(app, 'function salarieForm(');
  const bul = tranche(app, 'function bulletinForm(');
  // Un champ numérique du navigateur refuse la virgule sans un mot : « 1 250,500 » y valait zéro.
  [['salarié', sal, ['brut']], ['bulletin', bul, ['brut', 'primeAmount', 'retAmount']]].forEach(([quoi, src, noms]) => noms.forEach(n => {
    const champ = new RegExp(`<input name="${n}"[^>]*>`).exec(src);
    assert.ok(champ, `${quoi} : le champ ${n} a disparu`);
    assert.ok(!/type="number"/.test(champ[0]), `${quoi} : ${n} est encore un champ numérique, qui refuse la virgule`);
    assert.ok(/montantChamp\(/.test(champ[0]), `${quoi} : ${n} ne s'écrit pas en français`);
    assert.ok(new RegExp(`lireMontant\\(\\$\\('\\[name=${n}\\]', f\\)\\.value\\)`).test(src), `${quoi} : ${n} ne se relit pas par la porte commune`);
  }));
  const fiche = /<input[^>]*id="f-fees"[^>]*>/.exec(app);
  assert.ok(fiche && !/type="number"/.test(fiche[0]) && /lireMontant\(\$\('#f-fees', layer\)\.value\)/.test(app), 'les honoraires mensuels refusent encore la virgule');
  // Le format interne ne sort jamais sur un écran de saisie (règle 9.4.5).
  assert.ok(!/placeholder="AAAA-MM-JJ"/.test(app), 'un champ de date affiche encore le format interne');
  assert.ok(/K\.dateTapee\(t, s\.annee\)/.test(sal) && /refus\(champ, /.test(sal), 'une date tapée ne se lit pas en français, ou se refuse sans montrer son champ');
  // Un chiffre pré-rempli suit ce dont il dépend (règle 10.6.0), tant qu'on n'y a pas touché.
  assert.ok(/brutTouche = true/.test(bul) && /if \(brutTouche\) return;[\s\S]{0,160}\[name=brut\]', f\)\.value = montantChamp\(sal\.brut\)/.test(bul),
    'changer de salarié garde le brut du premier de la liste');
});

t('Un montant ne se coupe jamais en fin de ligne : milliers et devise insécables, comme le moteur', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const dinar = evaluer(/const dinar = (cur => [^;]+);/.exec(app)[1]);
  const money = evaluer(/const money = (\(n, cur\) => \{[\s\S]*?\n  \});/.exec(app)[1], { dinar });
  const ecrit = money(1500.225);
  assert.ok(!/ /.test(ecrit), `« ${ecrit} » porte une espace sécable : « 1 » en fin de ligne, « 500,225 DT » sur la suivante`);
  assert.strictEqual(ecrit.replace(/[\u202f\u00a0]/g, ' '), '1 500,225 DT', 'le montant ne s\'écrit plus en français');
  // L'espace des milliers est celle du moteur : deux formateurs, deux espaces, et un seul se coupait.
  assert.strictEqual(money(1234567.891).replace(/\u00a0DT$/, ''), KC.fmtMontant(1234567.891), 'l\'écran et le moteur n\'écrivent plus les milliers de la même façon');
  // Ce qui retirait la devise en cherchant une espace ORDINAIRE ne la trouvait plus.
  assert.ok(!/replace\(' ' \+ devise, ''\)/.test(app), 'la devise se retire encore par une espace ordinaire');
});

t('H-9 bis : la liste des dossiers tient sa largeur sans écraser les noms — le badge passe sous le mois', () => {
  const css = regles(lireSource('src', 'cabinet', 'renderer', 'cabinet.css'));
  const mois = css.find(r => r.selecteurs.includes('.dl-table td.dl-mois'));
  assert.ok(mois && /white-space:\s*normal/.test(mois.corps), 'la cellule « Dernier mois » ne peut plus passer à la ligne : le tableau déborde à 1280');
  const badge = css.find(r => r.selecteurs.includes('.dl-table td.dl-mois .badge'));
  assert.ok(badge && /white-space:\s*nowrap/.test(badge.corps), 'le badge peut se couper au milieu');
  const client = css.find(r => r.selecteurs.includes('.dl-table td.dl-client'));
  const pc = Number((/width:\s*(\d+)%/.exec(client.corps) || [])[1]);
  assert.ok(pc > 0 && pc <= 22, `la colonne Client réclame ${pc} % : elle prend la place avant que « Dernier mois » ait la sienne, et le badge passe à la ligne sur un écran où il tenait`);
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/<td class="dl-mois">[^\n]*<span class="nw">\$\{esc\(r\.lastLabel \|\| '—'\)\}<\/span>/.test(app), 'le mois lui-même peut se couper (« août » / « 2026 »)');
});

t('U-11 / U-20 / U-23 : Immobilisations et Inventaire — un seul vert à l\'étape suivante, des raisons en clair, les réserves là où on décide', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const im = tranche(app, 'function vueImmobilisations(');
  assert.ok(im.length > 2500 && im.length < 12000, 'tranche suspecte : ' + im.length);
  // U-11 — jugée sur ce qu'elle REND : « Ajouter un bien… » était vert en permanence, à côté
  // d'acquisitions sans fiche et d'écritures en attente.
  const m = /const suivante = ([^;]+);/.exec(im);
  assert.ok(m, 'l\'étape suivante des immobilisations n\'est plus calculée');
  const suivante = (aCreer, aEcrire, rows) => evaluer(m[1], { d: { aCreer }, e: { aEcrire, rows } });
  assert.strictEqual(suivante([{}], 2, [{}]), 'creer', 'une acquisition sans fiche passe avant tout : elle ne s\'amortit nulle part');
  assert.strictEqual(suivante([], 2, [{}]), 'ecrire', 'des dotations en attente : l\'étape suivante est de les écrire');
  assert.strictEqual(suivante([], 0, []), 'neuf', 'un exercice sans bien : l\'étape suivante est le premier bien');
  assert.strictEqual(suivante([], 0, [{}]), '', 'tout est écrit : plus rien n\'est vert');
  [['im-neuf', 'neuf'], ['im-ecrire', 'ecrire']].forEach(([id, pas]) =>
    assert.ok(new RegExp(`class="\\$\\{cls\\('${pas}'\\)\\}" id="${id}"`).test(im), `${id} ne prend pas la couleur de SON étape`));
  // Le seul vert écrit en dur est celui de la PREMIÈRE acquisition sans fiche — il n'existe que
  // quand l'étape suivante est de la créer.
  assert.ok(/data-creer=[^>]*>/.test(im) && /k === 0 \? ' btn-primary' : ''/.test(im), 'la première acquisition sans fiche ne porte plus le vert');
  assert.strictEqual((im.replace(/' btn-primary'/g, '').match(/btn-primary/g) || []).length, 0, 'un bouton principal est écrit en dur dans les immobilisations');
  // U-23 — la raison d'un bouton éteint se LIT, et « passées » seulement si une écriture l'est.
  assert.ok(/id="im-motifs"/.test(im) && /title="\$\{esc\(pourquoiEcrire\)\}"/.test(im), 'le bouton éteint ne dit plus pourquoi, en clair');
  const pq = /const pourquoiEcrire = ([\s\S]+?);\n/.exec(im);
  const pourquoi = (aEcrire, rows) => evaluer(pq[1], { e: { aEcrire, rows }, s: { annee: 2026 } });
  assert.strictEqual(pourquoi(1, [{}]), '', 'un bouton allumé n\'a pas de raison d\'être éteint');
  assert.ok(/passées/.test(pourquoi(0, [{ ecrite: true }])), 'des écritures passées ne se disent pas');
  assert.ok(!/passées/.test(pourquoi(0, [{ ecrite: false }])), 'un parc entièrement amorti prétend avoir « déjà passé » ses écritures');
  // U-20 — plus de panneau permanent de réserves : la bulle de la méthode, et la fiche qui les
  // rappelle au moment du choix, depuis la SEULE source (compta.js).
  assert.ok(!/Ce que cet écran ne décide pas/.test(im), 'le panneau permanent des réserves est revenu sous le tableau');
  assert.ok(/Méthode \$\{info\('im\.verifier'\)\}/.test(im), 'la colonne Méthode ne porte plus la bulle des réserves');
  const fiche = tranche(app, 'function immoForm(');
  assert.ok(/lbl\('Méthode', 'im\.verifier'\)/.test(fiche), 'la fiche ne porte plus la bulle au moment du choix');
  assert.ok(/id="im-degr-n">\$\{esc\(KC\.IMMO_A_VERIFIER\.tauxDegressif\)\}/.test(fiche), 'la réserve du dégressif ne vient plus du moteur');
  assert.ok(/\$\('#im-degr-n', rootModal\)\.style\.display = deg \? '' : 'none'/.test(fiche), 'la réserve du dégressif s\'affiche sur un bien linéaire');
  assert.ok(/KC\.IMMO_A_VERIFIER\.subvention/.test(fiche), 'la réserve de la subvention n\'est plus dite nulle part');
  // H-3 — ce qu'on rouvre se relit en français : « 1500.5 », c'est quinze cent mille pour qui lit.
  ['valeur', 'residuelle', 'subvention', 'cessionPrix'].forEach(n => {
    const champ = new RegExp(`<input name="${n}"[^>]*>`).exec(fiche);
    assert.ok(champ && /montantChamp\(/.test(champ[0]), `fiche d'un bien : ${n} ne s'écrit pas en français`);
  });

  const iv = tranche(app, 'function vueInventaire(');
  assert.ok(iv.length > 1500 && iv.length < 9000, 'tranche suspecte : ' + iv.length);
  // U-11 — sans inventaire, le geste vit dans l'état vide : un seul « Saisir l'inventaire… ».
  assert.ok(/\$\{inv \? `<button class="\$\{cls\('reprendre'\)\}" id="iv-saisir">/.test(iv), 'la barre montre encore « Saisir » à côté de l\'état vide qui le porte');
  assert.ok(/class="\$\{cls\('ecrire'\)\}" id="iv-ecrire"/.test(iv), 'la variation à écrire ne prend plus la couleur de son étape');
  const mi = /const suivante = ([^;]+);/.exec(iv);
  assert.strictEqual(evaluer(mi[1], { ecrivable: true }), 'ecrire');
  assert.strictEqual(evaluer(mi[1], { ecrivable: false }), '');
  // U-23 / U-13 — le panneau de la variation vient AVANT les lignes comptées (le résumé avant le
  // détail), et sa ligne d'état — grise, jamais un encadré vert — est la raison du bouton éteint.
  assert.ok(iv.indexOf('id="iv-variation"') > 0 && iv.indexOf('id="iv-variation"') < iv.indexOf('Ce qui a été compté'), 'la variation vit encore sous deux cents lignes comptées');
  assert.ok(/<p class="small ligne-ok mt" id="iv-motifs">/.test(iv), 'la raison du bouton éteint n\'est plus une ligne d\'état grise');
  assert.ok(!/ok-box/.test(iv), 'un encadré vert est revenu sur un état normal de l\'inventaire');
});

t('U-11 / U-13 : la Révision — le vert ouvre le cycle suivant, puis l\'arrêt ; l\'orange seulement pour un geste', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const vue = tranche(app, 'function vueRevision(');
  assert.ok(vue.length > 4000 && vue.length < 16000, 'tranche suspecte : ' + vue.length);
  // L'étape suivante, jugée sur ce qu'elle REND dans ses cinq états. À 0 compte signé sur 19, le
  // vert de l'écran était « Arrêter la révision… » : le geste de la fin, proposé au début.
  const bloc = /(const ouvertIncomplet = [\s\S]+?const suivante = [^;]+;)/.exec(vue);
  assert.ok(bloc, 'l\'étape suivante de la révision n\'est plus calculée');
  // Un objet né dans un autre contexte n'a pas le même prototype : on compare ce qu'il PORTE.
  const etape = (d, cycle) => JSON.parse(JSON.stringify(evaluer(`(() => { ${bloc[1]} return { suivante, prochain: prochain && prochain.cycle }; })()`, { d, cycle })));
  const f = (c, revus, total) => ({ cycle: c, label: c, revus, total });
  const d0 = { faite: false, hors: [], feuilles: [f('ventes', 0, 5), f('achats', 0, 4), f('tresorerie', 2, 2)] };
  assert.deepStrictEqual(etape(d0, ''), { suivante: 'cycle', prochain: 'ventes' }, 'au départ, le vert doit ouvrir le premier cycle qui a des comptes à revoir');
  assert.deepStrictEqual(etape(d0, 'ventes'), { suivante: 'signer', prochain: 'achats' }, 'dans un cycle qui a encore des comptes à revoir, ce sont ses lignes qui sont la suite — rien de vert au-dessus');
  const d1 = { ...d0, feuilles: [f('ventes', 5, 5), f('achats', 1, 4), f('tresorerie', 2, 2)] };
  assert.deepStrictEqual(etape(d1, 'ventes'), { suivante: 'cycle', prochain: 'achats' }, 'un cycle terminé : le vert passe au cycle SUIVANT qui en a');
  const d2 = { ...d0, feuilles: [f('ventes', 5, 5), f('achats', 4, 4), f('tresorerie', 2, 2)], hors: [{ revu: false }] };
  assert.strictEqual(etape(d2, '').suivante, 'hors', 'des comptes hors cycle à revoir : le vert les ouvre');
  const d3 = { ...d2, hors: [{ revu: true }] };
  assert.strictEqual(etape(d3, '').suivante, 'arreter', 'tout est signé : l\'étape suivante est l\'arrêt');
  assert.strictEqual(etape({ ...d3, faite: true }, '').suivante, '', 'une révision arrêtée n\'a plus d\'étape suivante');
  // Aucun vert écrit en dur : chacun ne naît que de SON étape.
  assert.ok(/class="btn btn-sm\$\{suivante === 'arreter' \? ' btn-primary' : ''\}" id="rv-arreter"/.test(vue), '« Arrêter la révision… » ne suit plus l\'étape suivante');
  assert.ok(/suivante === 'cycle' \? `<button class="btn btn-sm btn-primary" id="rv-suivant"/.test(vue), 'le cycle suivant n\'est plus proposé en couleur');
  assert.ok(/suivante === 'hors' \? `<button class="btn btn-sm btn-primary" id="rv-voir-hors"/.test(vue), 'les comptes hors cycle ne sont plus proposés en couleur');
  const verts = (vue.match(/btn-primary/g) || []).length;
  assert.strictEqual(verts, 3, `un vert de trop est écrit en dur dans la révision (${verts})`);
  assert.ok(/id="rv-poser">/.test(vue) && !/btn-primary" id="rv-poser"/.test(vue), '« Poser les questions de ton cabinet » est redevenu un second vert');
  // U-13 — l'orange pour ce qui demande un geste ; l'état de départ (« 19 comptes ne sont pas
  // signés ») ne s'y répète pas, l'avancement le dit déjà.
  assert.ok(/const aFaire = controles\.filter\(c => c\.gravite !== 'info'\)/.test(vue) && /aFaire\.length \? `<div class="warn-box/.test(vue),
    'un état normal repasse en orange dans la révision');
  assert.ok(/c\.id !== 'comptes'/.test(vue), 'les comptes non signés se répètent sous l\'avancement qui les compte déjà');
  // Une révision arrêtée se dit une fois, sur le badge — plus d'encadré vert qui le répète.
  assert.ok(!/ok-box/.test(vue), 'un encadré vert est revenu sur un état normal de la révision');
  assert.ok(/id="rv-arretee"/.test(vue), 'la date et le nom de l\'arrêt ne se lisent plus à côté du badge');
  // U-28 — la question d'arrêt nomme la période, jamais « 2026-08 ».
  const br = tranche(app, 'function brancherRevision(');
  assert.ok(/K\.de\(moisLabelCourt\(per\)\)/.test(br) && !/Arrêter la révision de \$\{esc\(s\.revision\.dossier\.periode\)\}/.test(br),
    'la question d\'arrêt écrit encore la période au format du fichier');
  // Le vert des comptes hors cycle ouvre le volet ET l'amène à l'écran.
  assert.ok(/s\.revHors = true; pageFocus = 'rv-hors'/.test(br) && /id="rv-hors" \$\{s\.revHors \? 'open' : ''\}/.test(vue), 'le volet des comptes hors cycle ne s\'ouvre pas sous le doigt');
});

t('U-11 / U-13 : les Relances — un seul vert (le groupe, ou la ligne quand elle est seule), l\'explication dans la bulle du titre', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const vue = tranche(app, 'function drawRelances(');
  assert.ok(vue.length > 3000 && vue.length < 14000, 'tranche suspecte : ' + vue.length);
  // Chaque ligne portait son « Écrire » en vert : quatre verts pour trois clients.
  const m = /const vertLigne = ([^;]+);/.exec(vue);
  assert.ok(m, 'la couleur du bouton de ligne n\'est plus décidée');
  assert.ok(/btn-primary/.test(evaluer(m[1], { rows: [{}] })), 'un seul client : son « Écrire » EST l\'étape suivante, il doit être vert');
  assert.ok(!/btn-primary/.test(evaluer(m[1], { rows: [{}, {}, {}] })), 'plusieurs clients : chaque « Écrire » redevient un second vert à côté du geste de groupe');
  assert.ok(/<button class="\$\{vertLigne\}" data-rel=/.test(vue), 'le bouton de ligne ne suit plus la règle');
  assert.ok(/rows\.length > 1 \? `<div class="actions"><button class="btn btn-primary" id="group">/.test(vue), 'le geste de groupe n\'est plus le vert d\'une liste de plusieurs clients');
  // La bulle du groupe vit À CÔTÉ de son bouton : un bouton dans un bouton n'est pas du HTML.
  assert.ok(!/id="group">[^<]*\$\{[^}]*info\('r\.group'\)[^<]*<\/button>/.test(vue), 'la bulle est encore posée DANS le bouton de groupe');
  // U-13 — l'explication permanente vit dans la bulle du titre, pas entre deux bandeaux.
  assert.ok(/<h1>Relances \$\{info\('r\.page'\)\}<\/h1>/.test(vue), 'le titre des Relances ne porte plus son explication');
  assert.ok(!/Un message qui nomme les mois manquants fait bouger/.test(vue), 'le paragraphe permanent est revenu sous le titre');
  const G = require('../../src/cabinet/renderer/cabguide.js');
  assert.ok(G.INFO['r.page'] && /nomme les mois/.test(G.INFO['r.page'].d), 'la bulle du titre ne porte pas l\'explication retirée de l\'écran');
  // `rel.due` veut dire « jour ATTEINT » : la phrase ne dit « ton jour de relance » que le jour même
  // (trouvé en testant comme un humain : « On est le 23, ton jour de relance » avec un jour au 10).
  assert.ok(/rel\.jour === rel\.day\s*\?\s*', ton jour de relance\.'\s*:\s*` : ton jour de relance, le \$\{rel\.day\}, est passé\.`/.test(vue),
    'la ligne du jour de relance affirme que c\'est aujourd\'hui alors que le jour est seulement atteint');
});

t('U-11 : l\'assistant — un seul vert par écran, sur le geste tant qu\'il n\'est pas fait, puis sur « Continuer »', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('function runSetup(');
  const fin = app.indexOf('function palettePossible(', i);
  assert.ok(i > 0 && fin > i, 'l\'assistant est introuvable');
  const asst = app.slice(i, fin);
  assert.ok(asst.length > 4000 && asst.length < 30000, 'tranche suspecte : ' + asst.length);
  // Le geste de l'écran et « Continuer » étaient verts ensemble : deux flèches vers deux endroits.
  const vert = evaluer(/const vert = (id => [^;]+);/.exec(asst)[1], { faits: new Set() });
  assert.strictEqual(vert('w-rec'), 'btn btn-primary', 'un geste pas encore fait doit porter le vert');
  const vertFait = evaluer(/const vert = (id => [^;]+);/.exec(asst)[1], { faits: new Set(['w-rec']) });
  assert.strictEqual(vertFait('w-rec'), 'btn', 'un geste fait garde son vert à côté de « Continuer »');
  ['w-rec', 'w-pair'].forEach(id => {
    assert.ok(new RegExp(`<button class="\\$\\{vert\\('${id}'\\)\\}" id="${id}"`).test(asst), `${id} ne suit plus la règle du vert`);
    assert.ok(new RegExp(`geste: '${id}'`).test(asst), `l'écran de ${id} ne dit plus quel geste porte le vert`);
  });
  assert.ok(/<button class="\$\{e\.geste && !faits\.has\(e\.geste\) \? 'btn' : 'btn btn-primary'\}" id="w-next">/.test(asst),
    '« Continuer » est vert pendant que le geste de l\'écran attend encore');
  // Le geste fait fait PASSER le vert : il le retire au geste et le donne à « Continuer ».
  const passe = /const fait = id => \{([\s\S]+?)\n      \};/.exec(asst);
  assert.ok(passe && /classList\.remove\('btn-primary'\)/.test(passe[1]) && /#w-next[\s\S]*classList\.add\('btn-primary'\)/.test(passe[1]),
    'le vert ne passe plus du geste fait à « Continuer »');
  assert.ok(/exportRecovery\(\(\) => fait\('w-rec'\)\)/.test(asst) && /fait\('w-pair'\)/.test(asst), 'un geste fait ne le dit plus');
  // Aucun autre vert écrit en dur dans l'assistant.
  assert.ok(!/class="btn btn-primary" id="w-(rec|pair)"/.test(asst), 'un second vert est écrit en dur dans l\'assistant');
});

t('U-13 : la clé de secours se dit UNE fois sur « Données et sécurité », en orange seulement quand elle manque', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const pan = tranche(app, 'function drawBackupPanels(');
  // Le panneau la disait dans un encadré orange MÊME une fois enregistrée, puis une seconde fois
  // dans sa ligne d'état.
  assert.ok(!/recoveryLine\(/.test(app), 'la seconde phrase sur la clé est revenue dans le panneau');
  assert.ok(/\$\{recoveryAt === null \? `<div class="warn-box mt">/.test(pan), 'l\'encadré orange ne dépend plus de l\'absence de clé');
  assert.ok(/: recoveryAt \? `<p class="small ligne-ok mt" id="s-rec-ok">/.test(pan), 'une clé enregistrée ne se dit plus sur une ligne grise');
  assert.ok(/<button class="btn\$\{recoveryAt === null \? ' btn-primary' : ''\}" id="s-rec">/.test(pan), 'le bouton de la clé reste vert une fois la clé enregistrée');
  // Le bandeau au-dessus des onglets se tait sur l'onglet qui porte le panneau Sécurité.
  const reg = tranche(app, 'function drawReglages(');
  assert.ok(/<div id="rec-banniere">\$\{recoveryBanner\(\)\}<\/div>/.test(reg), 'le bandeau de la clé n\'est plus isolé');
  assert.ok(/rb\.hidden = id === REG_PANNEAUX\['pan-secu'\]\.onglet/.test(reg), 'le bandeau se répète sur l\'onglet qui dit déjà tout');
});

t('U-11 : les Réglages n\'ont AUCUN bouton principal au repos — « Enregistrer » prend la couleur à la première modification', () => {
  // Mesuré dans l'application (10.12.0) : six boutons verts sur « Mon cabinet », six sur
  // « Comptabilité ». Un vert qui ne désigne rien ne se remarque plus, y compris le jour où il compte.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const zones = ['function drawReglages(', 'function dessinerEquipe(', 'function dessinerLicence('].map(d => tranche(app, d));
  zones.forEach((z, i) => assert.ok(z.length > 400, 'tranche suspecte n° ' + i + ' : ' + z.length));
  zones.forEach((z, i) => assert.strictEqual((z.match(/btn-primary/g) || []).length, 0,
    'un bouton principal est écrit en dur dans les Réglages (zone ' + i + ') : ' + ((z.match(/.{60}btn-primary.{40}/) || [''])[0])));
  // Chaque « Enregistrer » qui a son « ✓ enregistré » porte `data-enreg`, sinon `flash` ne le rend pas au repos.
  const paires = [...zones.join('\n').matchAll(/<span class="saved" id="[\w-]+" hidden><\/span><button ([^>]*)>/g)];
  assert.ok(paires.length >= 5, 'les boutons d\'enregistrement des panneaux ne sont plus trouvés : ' + paires.length);
  paires.forEach(m => assert.ok(/\bdata-enreg\b/.test(m[1]), 'un « Enregistrer » ne porte pas data-enreg : ' + m[1]));
  assert.ok(/id="lic-save" data-enreg/.test(zones[2]), '« Enregistrer la clé » ne suit plus la modification');
  // Le mécanisme lui-même, jugé sur ce qu'il FAIT : une frappe dans le panneau colore son bouton,
  // « ✓ enregistré » le rend au repos.
  const iS = app.indexOf('const sale = el =>');
  const sale = evaluer(app.slice(app.indexOf('el =>', iS), app.indexOf('\n  };', iS) + 4).replace(/;\s*$/, ''));
  const classes = new Set();
  const bouton = { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } };
  const panneau = { querySelector: q => (q === '[data-enreg]' ? bouton : null) };
  sale({ closest: q => (q === '.panel' ? panneau : null) });
  assert.ok(classes.has('btn-primary'), 'une modification ne rend plus son « Enregistrer » principal');
  const flash = evaluer(tranche(app, 'function flash(el, text)'), { clearTimeout() {}, setTimeout() {} });
  flash({ textContent: '', hidden: true, parentElement: panneau });
  assert.ok(!classes.has('btn-primary'), '« ✓ enregistré » laisse le bouton en couleur');
  // Les deux portes par lesquelles une modification arrive : les champs (délégation sur le corps) et
  // les brouillons de table (ajout, retrait, reprise d'un modèle).
  assert.ok(/corps\.addEventListener\('input', e => sale\(e\.target\)\)/.test(zones[0]) && /corps\.addEventListener\('change', e => sale\(e\.target\)\)/.test(zones[0]),
    'une frappe dans un panneau ne le marque plus modifié');
  for (const [f, b] of [['dessinerRegimes', 'regBrouillon'], ['dessinerCorrespondance', 'corrBrouillon'], ['dessinerCycles', 'cyclesBrouillon'],
    ['dessinerQuestionnaire', 'questBrouillon']]) {
    assert.ok(new RegExp(`if \\(${b} !== null\\) sale\\(box\\);`).test(tranche(app, `function ${f}(`)), f + ' : une ligne ajoutée ou retirée ne marque plus le panneau');
  }
});

t('L\'empreinte du cabinet se COPIE, là où elle s\'affiche — Réglages et assistant', () => {
  // Elle se dicte au téléphone et se colle dans un mail : vingt caractères sans bouton se recopient
  // à la main, donc faux (10.9.2). La licence avait son « Copier » ; l'empreinte du cabinet, non.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const reg = tranche(app, 'function drawReglages(');
  assert.ok(/<span class="fingerprint">\$\{esc\(c\.fingerprint \|\| '—'\)\}<\/span>\$\{c\.fingerprint\s*\? '<button type="button" class="btn btn-sm" id="c-copier-emp">Copier<\/button>'/.test(reg), 'Réglages : l\'empreinte n\'a plus son bouton « Copier »');
  assert.ok(/\$\('#c-copier-emp'\)\.onclick = \(\) => copierEmpreinte\(S\.cabinet\.fingerprint\)/.test(reg), 'Réglages : le bouton « Copier » ne copie plus l\'empreinte');
  assert.ok(/id="w-copier-emp">Copier<\/button>/.test(app) && /\$\('#w-copier-emp', el\)\.onclick = \(\) => copierEmpreinte\(S\.cabinet\.fingerprint\)/.test(app), 'assistant : l\'empreinte n\'a plus son bouton « Copier »');
  // Une seule porte pour copier une empreinte : trois copies du même bloc divergeraient.
  assert.strictEqual((app.match(/navigator\.clipboard\.writeText\(texte/g) || []).length, 1, 'la copie d\'empreinte n\'a plus une seule porte');
  assert.ok(/cp\.onclick = \(\) => copierEmpreinte\(licCab\.empreinte\)/.test(app), 'la licence a repris sa propre copie');
});

t('U-16 : la liasse masque ses rubriques vides (et le dit), le MONTANT ouvre ses comptes, et la réserve se dit sur une ligne', () => {
  // 17 rubriques vides sur 26, chacune avec sa phrase grise, noyaient les 9 qui portent un montant ;
  // une colonne entière répétait « Voir les comptes ». Jugé sur ce que la VRAIE vue rend, sur une
  // liasse calculée par le moteur.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const L = {
    liasse: liasseDe(livreAvecPaie()), clos: false, natures: [], retraitements: [], tauxImpot: null,
    fiscal: { resultatComptable: 0, reintegrations: 0, deductions: 0, base: 0, deficitaire: false, taux: null, impot: null, raisonImpot: '' },
    employeur: { cases: [], raisonNominatif: '' }
  };
  const lignes = L.liasse.etats.flatMap(e => e.lignes);
  const vides = lignes.filter(x => x.montant === null).length, pleines = lignes.length - vides;
  assert.ok(vides >= 5 && pleines >= 3, `le jeu ne discrimine pas : ${pleines} pleines, ${vides} vides`);
  const rendre = liasseVides => evaluer(tranche(app, 'function vueLiasse('), {
    livresState: { liasse: L, annee: 2026, liasseVides },
    esc: s => String(s == null ? '' : s), money: n => String(n), info: () => '', pl: (n, a, b) => `${n} ${n > 1 ? (b || a + 's') : a}`
  })({ id: 'D1' });
  const masque = rendre(undefined), tout = rendre(true);
  // Par défaut : aucune ligne vide, et la case dit combien elle en cache.
  assert.strictEqual((masque.match(/<tr class="row-muted">/g) || []).length, 0, 'des rubriques vides s\'affichent encore par défaut');
  assert.ok(new RegExp(`<input type="checkbox" id="li-masquer" checked> Masquer les rubriques vides \\(${vides}\\)`).test(masque), 'la case ne dit plus combien de rubriques elle cache');
  // Décochée : toutes reviennent, avec leur raison.
  assert.strictEqual((tout.match(/<tr class="row-muted">/g) || []).length, vides, 'décocher ne rend pas toutes les rubriques vides');
  assert.ok(!/id="li-masquer" checked/.test(tout), 'la case reste cochée alors que tout est affiché');
  // Le montant est le lien, et il n'existe plus de colonne de boutons.
  assert.ok(!/Voir les comptes<\/button>/.test(masque), 'la colonne « Voir les comptes » est revenue');
  const liens = (masque.match(/<button type="button" class="montant-lien" data-rub="[^"]+"/g) || []).length;
  assert.strictEqual(liens, lignes.filter(x => x.montant !== null && x.detail.length).length, 'un montant qui a des comptes ne s\'ouvre plus d\'un clic');
  // U-13 — la réserve À VÉRIFIER reste, sur une ligne grise ; un état juste ne se dit plus dans un encadré vert.
  assert.ok(/id="li-regle"><b>À VÉRIFIER<\/b>/.test(masque) && !/<div class="warn-box mb"><b>À VÉRIFIER/.test(masque), 'la réserve est redevenue un encadré orange permanent');
  assert.ok(!/ok-box/.test(masque), 'un encadré vert est revenu sur une liasse qui tombe juste');
  // La case agit, et le lien se reconnaît au repos (couleur, soulignement).
  assert.ok(/mq\.onchange = \(\) => \{ s\.liasseVides = !mq\.checked; drawLivres\(root, dossier\); \}/.test(tranche(app, 'function brancherLiasse(')), 'la case ne redessine plus la liasse');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/\.montant-lien \{[^}]*color: var\(--primary\)[^}]*text-decoration: underline/.test(css), 'le montant cliquable ne se reconnaît plus au repos');
});

t('U-19 : les pages longues se replient — l\'Exercice en sections qui portent leur chiffre, le modèle de liasse dans une fenêtre', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  // L'Exercice : 3 037 px d'un bloc. Quatre sections repliables, chacune nommée par le sommaire.
  const vue = tranche(app, 'function vueCloture(');
  const pl = [...vue.matchAll(/section\('(\w+)', 'cl-sec-\w+'/g)].map(m => m[1]);
  assert.deepStrictEqual(pl, ['controles', 'etats', 'sig', 'an'], 'les quatre sections de l\'Exercice ne se replient plus : ' + pl.join(','));
  assert.ok(/<details class="panel mt pli" id="\$\{id\}" data-pli="\$\{k\}"/.test(vue) && /<span class="pli-chiffre small muted">\$\{chiffre\}<\/span>/.test(vue),
    'une section repliée ne porte plus son chiffre');
  // Le sommaire est un <div> (le piège du <nav> de la barre latérale, 7.27.0) qui nomme chaque section.
  assert.ok(/<div class="set-somm cl-somm" role="navigation"/.test(vue) && !/<nav class="set-somm/.test(vue), 'le sommaire est redevenu un <nav>, que la barre latérale empile');
  assert.ok(/data-cl-sec="\$\{k\}"/.test(vue), 'le sommaire ne nomme plus les sections');
  // Une section qui porte une ALERTE s'ouvre toujours, même repliée à la main.
  const ouvert = /const ouvert = (k => [^;]+);/.exec(vue);
  assert.ok(ouvert, 'la règle d\'ouverture des sections n\'est plus écrite');
  const o = (ctx, k) => evaluer(ouvert[1], ctx)(k);
  const repli = { plis: { controles: false, etats: false, sig: false, an: false }, echecs: [], ex: { clos: false }, alerteEtats: false };
  assert.strictEqual(o(repli, 'etats'), false, 'une section repliée à la main se rouvre sans raison');
  assert.strictEqual(o({ ...repli, alerteEtats: true }, 'etats'), true, 'un déséquilibre reste caché dans une section repliée');
  assert.strictEqual(o({ ...repli, echecs: [{}] }, 'controles'), true, 'des contrôles à voir restent cachés avant la clôture');
  const br = tranche(app, 'function brancherCloture(');
  assert.ok(/dt\.ontoggle = \(\) => \{ plis\[dt\.dataset\.pli\] = dt\.open; \}/.test(br), 'une section repliée ne le reste pas au prochain dessin');
  assert.ok(/dt\.open = true; plis\[b\.dataset\.clSec\] = true;\s*pageFocus = dt\.id; focaliser\(el\);/.test(br), 'le sommaire mène à un titre replié, sans l\'ouvrir ni l\'amener à l\'écran');
  // Les ratios s'écrivent comme des montants : deux décimales, le vrai signe moins.
  const pc = evaluer(/const pourcent = (v => \{[^\n]+\});/.exec(app)[1]);
  assert.strictEqual(pc(56.33), '56,33\u00a0%');
  assert.strictEqual(pc(-3.998), '−4,00\u00a0%', 'un ratio négatif s\'écrit encore avec un tiret et trois décimales');
  assert.strictEqual(pc(null), '—');
  assert.ok(/r\.unite === '%' \? pourcent\(r\.valeur\)/.test(vue), 'les ratios ne passent plus par le formateur de pourcentage');
  // Réglages → Comptabilité : la grille du modèle de liasse (1 998 px) quitte la page pour une fenêtre.
  const reg = tranche(app, 'function drawReglages(');
  assert.ok(!/id="sr-liasse"><\/div>/.test(reg) && /id="sr-liasse-resume">\$\{resumeLiasse\(\)\}/.test(reg), 'la grille du modèle de liasse est revenue dans la page des Réglages');
  const f = tranche(app, 'function modeleLiasseForm(');
  assert.ok(f.indexOf('let change = () => false;') > 0 && f.indexOf('let change = () => false;') < f.indexOf('modal('), 'la garde de la fenêtre est lue avant sa déclaration (zone morte)');
  assert.ok(/<div id="sr-liasse"><\/div>/.test(f) && /data-close>Annuler/.test(f), 'la fenêtre du modèle ne porte plus sa grille ou son « Annuler »');
  assert.ok(/mod\.onclick = \(\) => modeleLiasseForm\(relire\)/.test(tranche(app, 'function brancherLiasse(')), 'la liasse d\'un dossier renvoie encore aux Réglages au lieu d\'ouvrir le modèle');
});

t('Un bouton principal ÉTEINT perd sa couleur, dans les deux thèmes et au survol — il ne reste pas le bloc le plus visible de l\'écran', () => {
  // Vu au test humain (10.12.0) : « Enregistrer et valider », éteint sur une pièce vide, restait un
  // pavé vert d'eau à 50 % — en thème sombre, il se lisait comme un bouton qu'on peut cliquer.
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const regle = /(\.btn-primary:disabled[^{]*)\{([^}]*)\}/.exec(css);
  assert.ok(regle, 'le bouton principal éteint n\'a plus de règle à lui');
  ['.btn-primary:disabled:hover', 'body.dark .btn-primary:disabled', 'body.dark .btn-primary:disabled:hover'].forEach(sel =>
    assert.ok(regle[1].split(',').map(x => x.trim()).includes(sel), `« ${sel} » n'est pas couvert : le vert revient ${/hover/.test(sel) ? 'au survol' : 'en thème sombre'}`));
  assert.ok(/background:\s*var\(--panel\)/.test(regle[2]) && /color:\s*var\(--muted\)/.test(regle[2]), 'le bouton principal éteint garde sa couleur');
});

t('U-21 : la CNSS ne vise que les employeurs que les livres connaissent — et ne pas savoir n\'est pas « non »', () => {
  // Le moteur : ce que le livre SAIT, mois par mois.
  const livre = {
    plan: [{ compte: '6411', role: 'salairesBruts' }],
    ecritures: [
      { date: '2026-07-31', statut: 'validee', lignes: [{ compte: '6411', debit: 900 }, { compte: '425', credit: 900 }] },
      { date: '2026-08-31', statut: 'validee', lignes: [{ compte: '706', credit: 100 }, { compte: '411', debit: 100 }] },
      { date: '2026-06-30', statut: 'contrepassee', lignes: [{ compte: '6411', debit: 50 }, { compte: '425', credit: 50 }] }
    ],
    bulletins: [{ annee: 2026, mois: 9 }]
  };
  const m = KC.moisEmployeur(livre);
  assert.strictEqual(m['2026-07'], true, 'une écriture sur le compte de rémunération du plan fait un employeur');
  assert.strictEqual(m['2026-08'], false, 'un mois saisi sans ligne de personnel dit « non » pour ce mois');
  assert.strictEqual(m['2026-09'], true, 'un bulletin fait un employeur');
  assert.ok(!('2026-06' in m), 'une écriture contre-passée ne dit rien');
  assert.ok(!('2026-10' in m), 'un mois sans écriture n\'a pas de clé : ne pas savoir n\'est pas « non »');
  assert.deepStrictEqual(KC.moisEmployeur(null), {}, 'sans livre, rien n\'est su');

  // Le calendrier : un client ne sort de la CNSS que sur un trimestre ENTIÈREMENT saisi sans
  // personnel ; un trimestre incomplet ou sans livre reste compté, par prudence, et la carte le dit.
  const p = mo => ({ month: mo, label: C.monthLabel(mo), definitive: true, missing: [] });
  const packs = [p('2026-07'), p('2026-08'), p('2026-09')];
  const S = C.migrate({ settings: { relanceDay: 10 }, dossiers: ['emp', 'non', 'part', 'rien'].map(id => ({ id, name: id, tvaPeriod: 'trimestrielle', packs })) });
  const cnss = opts => C.echeances(S, '2026-10-05', opts).find(e => e.id === 'cnss');
  const sans = cnss();
  assert.strictEqual(sans.clients, 4, 'sans connaissance, tout le monde reste compté');
  const employeurs = {
    emp: { '2026-07': false, '2026-08': true },
    non: { '2026-07': false, '2026-08': false, '2026-09': false },
    part: { '2026-07': false }
  };
  const avec = cnss({ employeurs });
  assert.strictEqual(avec.clients, 3, 'un trimestre entièrement saisi sans une ligne de personnel doit sortir de la CNSS');
  assert.ok(/2 clients dont le trimestre n'est pas encore saisi ici sont comptés par prudence/.test(avec.detail), 'la prudence ne se dit plus : ' + avec.detail);
  assert.ok(/1 client d'après sa Paie/.test(avec.detail), 'le client connu n\'est plus nommé comme tel : ' + avec.detail);
  // Tous inconnus : la carte ne prétend pas que « leur Paie le dit » (trouvé en testant comme un humain),
  // et ne répète pas deux fois « pas saisi ici » dans la même phrase (trouvé en la relisant à l'écran).
  const inconnusSeuls = cnss({ employeurs: { part: { '2026-07': false } } });
  assert.ok(!/le disent/.test(inconnusSeuls.detail) && /Le trimestre de ces 4 clients n'est pas encore saisi ici : ils sont comptés par prudence\.$/.test(inconnusSeuls.detail),
    'la carte affirme ce que la Paie dit alors qu\'aucun client n\'est connu : ' + inconnusSeuls.detail);
  assert.strictEqual((inconnusSeuls.detail.match(/saisi ici/g) || []).length, 1, 'la phrase répète « saisi ici » : ' + inconnusSeuls.detail);
  const unSeul = C.echeances(C.migrate({ settings: { relanceDay: 10 }, dossiers: [{ id: 'x', name: 'x', tvaPeriod: 'trimestrielle', packs }] }), '2026-10-05', { employeurs: {} }).find(e => e.id === 'cnss');
  assert.ok(/Le trimestre de ce client n'est pas encore saisi ici : il est compté par prudence\.$/.test(unSeul.detail), 'le singulier ne s\'accorde plus : ' + unSeul.detail);
  // Tous connus : aucune prudence à annoncer.
  const tousConnus = C.echeances(C.migrate({ settings: { relanceDay: 10 }, dossiers: [{ id: 'emp', name: 'emp', tvaPeriod: 'trimestrielle', packs }] }), '2026-10-05', { employeurs: { emp: { '2026-08': true } } }).find(e => e.id === 'cnss');
  assert.ok(/le disent\.$/.test(tousConnus.detail) && !/prudence/.test(tousConnus.detail), 'une prudence est annoncée sur des clients tous connus : ' + tousConnus.detail);
  assert.ok(!/ne sait pas lesquels/.test(avec.detail + sans.detail), 'l\'aveu d\'ignorance est revenu alors que les livres savent');
  // « À faire » lit la MÊME connaissance que la page (règle 6.8.1).
  const cc = lireSource('src', 'cabinet', 'cabcore.js');
  assert.ok(/echeances\(state, todayIso, \{ avant: 1, apres: 1, employeurs: \(opts \|\| \{\}\)\.employeurs \}\)/.test(cc), '« À faire » compte la CNSS sans la connaissance des employeurs');
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/K\.echeances\(S, null, \{ employeurs: employeursConnus\(\) \}\)/.test(app), 'la page Échéances ne passe plus la connaissance des employeurs');
  assert.ok(/K\.cabinetTodo\(S, null, \{[^}]*employeurs: employeursConnus\(\) \}\)/.test(app), '« À faire » ne reçoit plus la connaissance des employeurs');
  // Et l'index la range, sinon rien ne la porte jusqu'à l'écran.
  assert.ok(/employeur: KC\.moisEmployeur\(livre\)/.test(lireSource('src', 'cabinet', 'cabstore.js')), 'l\'index des livres ne range plus ce qu\'il sait des employeurs');
});

t('U-21 : un index écrit avant la 10.12.0 se relit une fois — sinon la CNSS est réclamée à tout le monde le matin de la mise à jour', () => {
  // Trouvé en redémarrant l'application sur le code du jour : l'index n'est réécrit que lorsqu'un
  // livre l'est. Sans relecture, un cabinet qui met à jour voit tous ses clients « comptés par
  // prudence », et la carte écrit « trimestre pas saisi ici » sur des trimestres saisis.
  const fs = require('fs'), os = require('os'), path = require('path');
  const { createCabStore } = require('../../src/cabinet/cabstore.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-index-'));
  try {
    const s = createCabStore(dir);
    s.create('mot-de-passe-du-test', C.migrate({ cabinet: { name: 'Test' } }));
    const d = { id: 'MF:1234567A', name: 'Salaries SARL' };
    const livre = KC.livreVide(d.id, 2026, { plan: [{ compte: '640', libelle: 'Salaires' }, { compte: '425', libelle: 'Personnel' }] });
    const e = KC.ajouterEcriture(livre, { date: '2026-07-31', journal: 'OD', piece: 'PAIE-07', libelle: 'Paie de juillet',
      lignes: [{ compte: '640', debit: 900 }, { compte: '425', credit: 900 }] }, 'Amine', 1);
    assert.ok(KC.validerEcriture(livre, e.id, 'Amine', 2).ok, 'la pièce du test ne se valide pas');
    assert.ok(s.ecrireLivre(d, livre, null).ok, 'le livre du test ne s\'écrit pas');
    const f = path.join(s.livreDir(d, null), 'livre-index.json');
    const ancien = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.strictEqual(ancien.exercices[0].employeur['2026-07'], true, 'le livre neuf ne range pas ce qu\'il sait');
    // L'index tel que l'écrivait la 10.11.0 : sans la case.
    delete ancien.exercices[0].employeur;
    fs.writeFileSync(f, JSON.stringify(ancien));
    assert.strictEqual(s.relireIndexAncien(d, null), 1, 'l\'exercice d\'avant n\'a pas été relu');
    assert.strictEqual((s.lireIndexLivres(d, null).exercices[0].employeur || {})['2026-07'], true, 'la relecture n\'a pas rendu la case à l\'index');
    // Une fois relu, il ne se relit plus : la condition est l'ABSENCE de la case, pas son contenu.
    assert.strictEqual(s.relireIndexAncien(d, null), 0, 'un index à jour se relit encore à chaque appel');
    // Et la relecture ne réécrit JAMAIS le livre : seule la révision du disque le prouve.
    assert.strictEqual(s.enteteLivre(s.livrePath(d, 2026, null)).revision, 1, 'la relecture a réécrit le livre');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  // Le résumé que les deux écrans lisent attend la relecture AVANT de lire les index.
  const main = lireSource('src', 'cabinet', 'main.js');
  const i = main.indexOf("ipcMain.handle('cab:questionsEnAttente'");
  const h = main.slice(i, main.indexOf('ipcMain.handle(', i + 10));
  assert.ok(h.length > 200 && h.length < 2500, 'tranche du handler suspecte : ' + h.length);
  assert.ok(h.indexOf('await relireIndexAnciens()') > 0 && h.indexOf('await relireIndexAnciens()') < h.indexOf('lireIndexLivres'),
    'le résumé lit les index sans avoir relu ceux d\'avant');
});

t('Aucun « Relancer ces 1 client » : un déterminant pluriel devant un compte se garde du singulier, dans les deux applications', () => {
  // Trouvé par Browser Use, qui lit le NOM de chaque bouton : « Relancer ces 1 client » sur une
  // échéance à un seul client. La capture ne le montrait pas — la carte était sous la ligne de
  // flottaison. Le même motif dormait à cinq autres endroits : « ses 1 paquet », « Les 1 livre de la
  // sauvegarde », « Établir les 1 bulletin manquant », « Voir les 1 facture », « Ces 1 dossier ».
  // `pl()` accorde le NOM ; le déterminant, lui, reste au pluriel — seule une branche `> 1` le garde.
  const fichiers = [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js'], ['src', 'cabinet', 'cabcore.js'], ['src', 'renderer', 'core.js'], ['src', 'renderer', 'compta.js']];
  const motif = /\b(?:[Cc]es|[Ll]es|[Ss]es|[Ll]eurs|mêmes|[Tt]ous les|[Tt]outes les) \$\{(?:pl|plFr|K\.pl|C\.pl|KC\.plFr)\(/g;
  const fautes = [];
  let vus = 0;
  for (const f of fichiers) {
    const src = code(...f);
    let m;
    while ((m = motif.exec(src))) {
      vus++;
      // La garde : on est DANS la branche « > 1 » d'un ternaire, sans backtick entre les deux.
      if (!/> 1 \? `[^`]*$/.test(src.slice(Math.max(0, m.index - 200), m.index))) {
        fautes.push(f.join('/') + ' : …' + src.slice(m.index - 30, m.index + 60).replace(/\s+/g, ' '));
      }
    }
  }
  assert.ok(vus >= 6, 'le motif ne voit plus les phrases qu\'il doit garder : ' + vus);
  assert.deepStrictEqual(fautes, [], 'un déterminant pluriel devant un compte qui peut valoir 1');
});

t('Chaque bulle « i » porte un NOM qui dit ce qu\'elle explique — plus trois « Qu\'est-ce que c\'est ? » par page', () => {
  // Trouvé par Browser Use : l'arbre d'accessibilité des Échéances nommait ses trois bulles de la
  // même façon, et le titre de la page devenait « Échéances Qu'est-ce que c'est ? ». Un lecteur
  // d'écran ne distingue pas trois boutons qui portent le même nom (règle 9.4.4, vue par l'oreille).
  const escTest = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const G = { INFO: { 'ec.dates': { t: 'D\'où viennent <ces> dates', d: '' } } };
  for (const [nom, chemin, ctx] of [
    ['Cabinet', ['src', 'cabinet', 'renderer', 'app.js'], { G, esc: escTest }],
    ['entreprise', ['src', 'renderer', 'app.js'], { G, h: escTest }]
  ]) {
    const info = evaluer(tranche(code(...chemin), 'function info(key)'), ctx);
    const html = info('ec.dates');
    assert.ok(/aria-label="Explication : D'où viennent &lt;ces> dates"/.test(html), nom + ' : la bulle ne porte plus le titre de ce qu\'elle explique : ' + html);
    assert.strictEqual(info('inconnue'), '', nom + ' : une clé sans texte pose encore une bulle');
  }
  // Et chaque bulle a un titre, sinon son nom retomberait sur la clé technique (« ec.dates »).
  for (const g of [require('../../src/renderer/guide.js'), require('../../src/cabinet/renderer/cabguide.js')]) {
    const sans = Object.keys(g.INFO).filter(k => !String((g.INFO[k] || {}).t || '').trim());
    assert.deepStrictEqual(sans, [], 'des bulles sans titre');
  }
});

t('U-21 / U-13 : les Échéances disent leur règle UNE fois, en tête — plus sous chaque carte, plus en orange', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('function drawEcheances(');
  const z = app.slice(i, app.indexOf('\n  }\n', i));
  // La page a un premier `view.innerHTML` (aucun client) AVANT la carte : on borne après elle.
  const iCarte = z.indexOf('const carte = e =>');
  const carte = z.slice(iCarte, z.indexOf('view.innerHTML', iCarte));
  assert.ok(carte.length > 800, 'tranche de la carte suspecte : ' + carte.length);
  assert.ok(!/ne dépose rien/.test(carte) && !/info\('ec\.depot'\)/.test(carte), 'la règle du pense-bête se répète encore sous chaque carte');
  assert.ok((z.match(/ne dépose rien à ta place/g) || []).length === 1, 'la règle du pense-bête doit se dire exactement une fois');
  assert.ok(/id="ec-regle"/.test(z) && /À VÉRIFIER/.test(z.slice(z.indexOf('id="ec-regle"'))), 'les jours proposés ne disent plus qu\'ils sont À VÉRIFIER');
  assert.ok(!/warn-box/.test(z), 'un encadré orange permanent est revenu sur les Échéances');
  assert.ok(/<h1>Échéances \$\{info\('ec\.dates'\)\}<\/h1>/.test(z), 'l\'explication de la page a quitté la bulle du titre');
  assert.ok(/<h2>Déjà passées \$\{info\('ec\.passees'\)\}<\/h2>/.test(z), 'la note des échéances passées est revenue en prose sous le titre');
  // Les deux gestes d'une carte NOMMENT leur échéance pour un lecteur d'écran (vu par Browser Use) :
  // cinq « Marquer déposée » identiques ne disent pas lequel on déclenche.
  for (const attr of ['data-relq', 'data-depot']) {
    const b = carte.slice(carte.indexOf(attr + '='), carte.indexOf('</button>', carte.indexOf(attr + '=')));
    assert.ok(/aria-label="\$\{esc\(\w+ \+ ' — ' \+ e\.label\)\}"/.test(b), attr + ' : le bouton ne nomme plus son échéance : ' + b);
  }
});

t('Aucune variable CSS utilisée sans être définie : une variable inconnue rend sa déclaration invalide, en silence', () => {
  // Trouvé en testant comme un humain (10.12.0) : « Exporter le tableau », ÉTEINT, portait en thème
  // sombre une bordure blanche plus vive que celle d'un bouton actif. `.btn-ghost` lisait `--line`,
  // qu'aucune feuille ne définissait depuis la 9.4.2 : la déclaration devenait invalide et la
  // bordure retombait sur la couleur du texte. Trois autres dormaient de même (`--accent` sur le
  // repère d'un panneau visé, `--card` sur les champs de la saisie au focus et les pastilles de la
  // production, `--hover` sur la ligne « moi » de l'équipe, qui ne s'est jamais vue).
  const fs = require('fs'), path = require('path');
  const racine = path.resolve(__dirname, '..', '..');
  const feuilles = ['src/renderer/style.css', 'src/cabinet/renderer/cabinet.css'].map(f => fs.readFileSync(path.join(racine, f), 'utf8'));
  const definies = new Set(feuilles.flatMap(css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1])));
  const sources = feuilles.slice();
  ['src/renderer', 'src/cabinet/renderer'].forEach(d => fs.readdirSync(path.join(racine, d))
    .filter(f => /\.(js|html)$/.test(f)).forEach(f => sources.push(fs.readFileSync(path.join(racine, d, f), 'utf8'))));
  const utilisees = new Set(sources.flatMap(src => [...src.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1])));
  assert.ok(definies.size > 15 && utilisees.size > 15, `lecture suspecte : ${definies.size} définies, ${utilisees.size} utilisées`);
  const inconnues = [...utilisees].filter(v => !definies.has(v));
  assert.deepStrictEqual(inconnues, [], 'variable CSS utilisée et définie nulle part : ' + inconnues.join(', '));
  // Et le trait discret existe dans les DEUX thèmes : défini en clair seulement, le sombre
  // hériterait d'un gris clair qui crie sur un fond noir.
  const css = feuilles[0];
  assert.ok(/:root\s*\{[^}]*--line:/.test(css) && /body\.dark\s*\{[^}]*--line:/.test(css), 'le trait des boutons discrets n\'est pas défini dans les deux thèmes');
});

t('Aucun caractère combinant écrit en dur dans le code : l\'intervalle des accents s\'écrit ÉCHAPPÉ (9.2.1)', () => {
  // Un intervalle écrit avec les VRAIS caractères combinants (U+0300 à U+036F, invisibles) fonctionne — et personne ne peut le relire, et un
  // éditeur qui normalise le texte le casse en silence. Six endroits l'avaient, dans cinq fichiers.
  const fs = require('fs'), path = require('path');
  const racine = path.resolve(__dirname, '..', '..');
  const fichiers = [];
  const parcourir = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|dist|\.git)/.test(e.name)) parcourir(p); } else if (/\.(js|mjs)$/.test(e.name)) fichiers.push(p);
  });
  ['src', 'test', 'scripts', 'plateforme', 'worker'].forEach(d => { if (fs.existsSync(path.join(racine, d))) parcourir(path.join(racine, d)); });
  assert.ok(fichiers.length > 50, 'le parcours des sources ne voit presque rien : ' + fichiers.length);
  const fautifs = fichiers.filter(f => /[\u0300-\u036f]/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(racine, f));
  assert.deepStrictEqual(fautifs, [], 'un caractère combinant écrit en dur : ' + fautifs.join(', '));
});

};
