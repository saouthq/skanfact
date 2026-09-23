'use strict';
// ============================================================================================
// L'audit UI/UX du Cabinet, corrigé (10.12.0) — U-01 à U-30, l'audit du 23/09/2026 (sorti
// d'`A-FAIRE.md` une fois corrigé, comme toute ligne du carnet ; les règles sont dans CLAUDE.md).
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

// Trouvé en passant par e2e:aide, dans l'app ENTREPRISE : deux panneaux asynchrones des Paramètres
// écrivaient dans un élément APRÈS une attente, alors que la page avait changé — « Cannot set
// properties of null », une exception qui échappait à tout le monde (règle 7.6.0).
t('Un panneau asynchrone des Paramètres n\'écrit que dans une page encore affichée (7.6.0)', () => {
  const app = code('src', 'renderer', 'app.js');
  ['async function drawDossiers(', 'const drawExternal = async () =>'].forEach(debut => {
    const i = app.indexOf(debut);
    assert.ok(i > 0, 'introuvable : ' + debut);
    const apres = app.slice(app.indexOf('await bridge.listDossiers()', i), app.indexOf('await bridge.listDossiers()', i) + 900);
    const garde = apres.indexOf('if (!el.isConnected) return;');
    const ecriture = apres.search(/\$\('#[a-z-]+'\)\.(value|hidden|innerHTML|textContent) =/);
    assert.ok(garde > 0, `${debut} écrit après son attente sans vérifier que la page est encore là`);
    assert.ok(ecriture < 0 || garde < ecriture, `${debut} écrit dans la page AVANT de vérifier qu'elle est encore là`);
  });
});

// ================================================================ lot D — trouver

// U-07 : « balance » rendait « Rien ne correspond. » La palette cherche désormais dans les quatorze
// écrans de comptabilité — sur les VRAIES tables de l'écran, évaluées, jamais recopiées ici.
t('U-07 : la palette connaît les écrans de comptabilité, et les couples « client + écran »', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const { ONGLETS_COMPTA } = tablesCompta(app);
  const m = /const MOTS_COMPTA = (\{[\s\S]*?\n  \});/.exec(app);
  assert.ok(m, 'la table des synonymes des écrans a disparu');
  const MOTS = donnees(m[1]);
  // Deux tables séparées divergent toujours : chaque écran a ses mots, et aucun mot ne vise un
  // écran qui n'existe pas.
  assert.deepStrictEqual(Object.keys(MOTS).sort(), Object.keys(ONGLETS_COMPTA).sort(),
    'MOTS_COMPTA et ONGLETS_COMPTA ne nomment pas les mêmes écrans : un écran naîtrait introuvable');
  const ecrans = Object.fromEntries(Object.keys(ONGLETS_COMPTA).map(k => [k, { label: ONGLETS_COMPTA[k], mots: MOTS[k] }]));
  const dossiers = [
    { id: 'A', name: 'Garage Ben Salem', matricule: '1111111A' },
    { id: 'B', name: 'Société Béji Frères', matricule: '2222222B' },
    { id: 'C', name: 'Pharmacie El Menzah', matricule: '3333333C' },
    { id: 'Z', name: 'Béji Archivé', matricule: '9999999Z', archived: true }
  ];
  const vues = r => r.map(x => x.dossierId + ':' + x.ecran);
  // Sur la fiche ouverte, « balance » ouvre SA balance — et d'elle seule.
  assert.deepStrictEqual(vues(C.paletteCompta('balance', ecrans, dossiers, 'C')), ['C:balance']);
  // « béji balance » : les autres mots nomment le client, accents ignorés, archivés exclus.
  assert.deepStrictEqual(vues(C.paletteCompta('beji balance', ecrans, dossiers, 'C')), ['B:balance']);
  assert.deepStrictEqual(vues(C.paletteCompta('Béji BALANCE', ecrans, dossiers, null)), ['B:balance']);
  // Hors d'une fiche, « balance » propose le portefeuille actif, par nom, borné.
  assert.deepStrictEqual(vues(C.paletteCompta('balance', ecrans, dossiers, null)), ['A:balance', 'C:balance', 'B:balance'],
    'hors d\'une fiche, chaque client actif est proposé, par ordre alphabétique');
  assert.ok(C.paletteCompta('saisie', ecrans, Array.from({ length: 40 }, (_, i) => ({ id: 'D' + i, name: 'Client ' + i })), null).length <= 8, 'la liste est bornée');
  // Les mots qu'un comptable tape, qui ne sont pas des libellés.
  assert.deepStrictEqual(vues(C.paletteCompta('rapprochement', ecrans, dossiers, 'C')), ['C:banque']);
  assert.deepStrictEqual(vues(C.paletteCompta('tva', ecrans, dossiers, 'C')), ['C:declaration']);
  assert.deepStrictEqual(vues(C.paletteCompta('amortissements', ecrans, dossiers, 'C')), ['C:immobilisations']);
  assert.deepStrictEqual(vues(C.paletteCompta('grand livre', ecrans, dossiers, 'C')), ['C:grand-livre'], '« grand livre » ne vise que le grand livre');
  assert.deepStrictEqual(vues(C.paletteCompta('clôture', ecrans, dossiers, 'C')), ['C:exercice']);
  // Ce qui n'est pas un écran ne rend rien ici — la recherche de clients s'en charge.
  assert.deepStrictEqual(C.paletteCompta('garage', ecrans, dossiers, 'C'), []);
  assert.deepStrictEqual(C.paletteCompta('ba', ecrans, dossiers, 'C'), [], 'deux lettres ne désignent pas un écran');
  assert.deepStrictEqual(C.paletteCompta('', ecrans, dossiers, 'C'), []);
  // Et la palette s'en sert : elle ne cherche plus seulement des clients et des réglages.
  const pal = tranche(app, 'function openPalette(');
  assert.ok(/K\.paletteCompta\(/.test(pal), 'la palette ne cherche pas dans les écrans de comptabilité');
  assert.ok(!/kind: 'action', main: `Réglages/.test(pal), 'un réglage est encore étiqueté « action »');
});

// Vu au test humain : « rapprochement » dans Cmd+K rendait l'écran Banque et jamais l'article qui
// explique comment on rapproche. La palette de l'app entreprise liste ses articles depuis toujours :
// le jumeau manquant (7.3.0). On juge le VRAI morceau de la palette, évalué sur le vrai corpus.
t('La palette propose les articles d\'Aide — cherchés dans leur corps, classés, bornés, et seulement sur une question', () => {
  const G = require('../../src/cabinet/renderer/cabguide.js');
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const pal = tranche(app, 'function openPalette(');
  const bloc = (/(const articlesPalette = [\s\S]*?const aidesPour = [\s\S]*?\}\)\);)\n/.exec(pal) || [])[1];
  assert.ok(bloc, 'la palette ne connaît plus les articles d\'Aide');
  const ctx = { G, K: { sansAccents: C.sansAccents }, location: { hash: '' } };
  const aidesPour = require('vm').runInNewContext(`(() => { let aideQ = 'reste'; ${bloc} return { aidesPour, lire: () => aideQ }; })()`, ctx);
  const titres = q => aidesPour.aidesPour(q).map(x => x.main);
  const banque = G.ARTICLES.find(a => /rapprochement/i.test(a.t));
  assert.ok(banque, 'le corpus n\'a plus d\'article sur le rapprochement');
  // Le classement se prouve sur un mot dont le PREMIER article du corpus ne le porte que dans son
  // corps : sur « rapprochement », l'article de la banque vient déjà en tête sans classer, et le
  // test restait vert avec le tri retiré (des données qui ne discriminent pas, 10.0.0).
  const naturel = G.ARTICLES.find(a => /banque/i.test(C.sansAccents(a.t + ' ' + a.s + ' ' + a.d)));
  assert.ok(naturel && naturel.id !== banque.id, 'le jeu ne discrimine plus : le premier article qui parle de banque est déjà celui de la banque');
  assert.strictEqual(titres('banque')[0], banque.t, 'l\'article dont le TITRE porte le mot doit venir en tête');
  // « lettrage » n'est dans aucun titre : c'est le CORPS qui répond (7.27.0).
  const corps = G.ARTICLES.filter(a => !/lettrage/i.test(a.t + ' ' + a.s) && /lettrage/i.test(a.d));
  assert.ok(corps.length, 'le jeu ne discrimine plus : il faut un article qui ne parle de lettrage que dans son corps');
  assert.ok(corps.some(a => titres('lettrage').includes(a.t)), 'la palette ne cherche que dans les titres : « lettrage » ne trouve pas son article');
  assert.ok(G.ARTICLES.some(a => /é/.test(a.d)) && titres('ecriture').length, 'les accents empêchent de trouver un article');
  assert.ok(aidesPour.aidesPour('e').length <= 4, 'la palette montre d\'abord ce qu\'on OUVRE : quatre articles au plus');
  // Ouvrir un article vide la recherche de l'Aide, sinon l'article s'ouvre filtré (7.23.0).
  aidesPour.aidesPour('rapprochement')[0].go();
  assert.strictEqual(aidesPour.lire(), '', 'ouvrir un article depuis la palette garde la recherche de l\'Aide : la page peut s\'ouvrir vide');
  assert.strictEqual(ctx.location.hash, '#/aide/' + banque.id);
  // Sans question, rien : la liste de départ reste celle des gestes.
  assert.ok(/items = ecrans\.concat\(rows, acts, qa \? aidesPour\(qa\) : \[\]\)/.test(pal), 'les articles s\'affichent sans question, ou ne s\'affichent plus du tout');
  // Le titre passe avant sa description : le Cabinet pose `.sub` À CÔTÉ de `.main`.
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.palette \.res \.main:has\(\+ \.sub\) \{ flex: 0 1 auto; \}/.test(css), 'le titre d\'une ligne de palette se coupe encore avant sa description');
  assert.ok(/\.palette \.res \.main \+ \.sub \{[^}]*flex: 1 1 0;[^}]*min-width: 0;[^}]*text-overflow: ellipsis/.test(css), 'la description ne cède pas sa place au titre');
});

// U-08 : dix articles, et aucun ne couvrait Banque, Déclaration, Immobilisations, Paie, Révision,
// Exercice ni Liasse — « rapprochement » ne trouvait rien. Un article par écran, qui finit par son
// geste, et la bulle du titre de l'écran y mène. La recherche est jugée par la VRAIE fonction de
// l'Aide, évaluée sur le vrai corpus.
t('U-08 : un article par écran de comptabilité, qui finit par son geste — et la bulle de l\'écran y mène', () => {
  const G = require('../../src/cabinet/renderer/cabguide.js');
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const f = /function aideTrouves\(q\) \{[\s\S]*?\n  \}/.exec(app);
  const sb = /const sansBalises = (x => [^\n]*);/.exec(app);
  assert.ok(f && sb, 'la recherche de l\'Aide est introuvable');
  const trouver = evaluer(`(function () { const sansBalises = ${sb[1]}; ${f[0]}; return aideTrouves; })()`, { G, K: C });
  const premier = q => (trouver(q)[0] || {}).id;
  assert.strictEqual(premier('rapprochement'), 'banque', '« rapprochement » ne mène pas à l\'article de la banque');
  assert.ok(trouver('declaration').some(a => a.id === 'declaration'), 'un mot tapé sans accent ne trouve pas son article');
  assert.ok(trouver('tva').some(a => a.id === 'declaration'));
  assert.ok(trouver('amortissement').some(a => a.id === 'immobilisations'));
  assert.ok(trouver('liasse').some(a => a.id === 'liasse'));
  const ECRANS = { banque: 'vueBanque', declaration: 'vueDeclaration', revision: 'vueRevision', paie: 'vuePaie',
    immobilisations: 'vueImmobilisations', exercice: 'vueCloture', liasse: 'vueLiasse' };
  Object.entries(ECRANS).forEach(([ecran, vue]) => {
    const a = G.ARTICLES.find(x => x.geste && x.geste.ecran === ecran);
    assert.ok(a, `aucun article ne mène à l'écran « ${ecran} »`);
    assert.ok(a.d.length > 600 && a.t && a.s, `l'article de « ${ecran} » est trop court pour expliquer quoi que ce soit`);
    // La bulle posée DANS l'écran mène à son article : sans elle, l'article existe et personne ne le trouve.
    const corps = tranche(app, `function ${vue}(`);
    const cles = [...corps.matchAll(/info\('([^']+)'\)/g)].map(m => m[1]);
    assert.ok(cles.some(k => G.INFO[k] && G.INFO[k].a === a.id), `aucune bulle de l'écran « ${ecran} » ne mène à « ${a.t} »`);
  });
  // Toute bulle qui promet un article le trouve.
  Object.entries(G.INFO).filter(([, v]) => v.a).forEach(([k, v]) =>
    assert.ok(G.ARTICLES.some(x => x.id === v.a), `la bulle « ${k} » mène à un article qui n'existe pas : ${v.a}`));
  // Et une phrase fausse depuis la 9.9.0 a disparu.
  assert.ok(!G.ARTICLES.some(x => /ne gère pas encore plusieurs collaborateurs/.test(x.d)),
    'l\'Aide dit encore que le Cabinet ne gère pas plusieurs collaborateurs');
  // Le geste d'un écran de dossier vise le dossier ouvert, ou fait CHOISIR le dossier — jamais un écran vide.
  assert.ok(/function gesteAide\(g\)[\s\S]*?livresState\.dossierId[\s\S]*?Choisir le dossier/.test(app),
    'le geste d\'un article ne sait pas mener à l\'écran d\'un dossier');
  // La bulle ouvre l'article, et se referme en le faisant.
  assert.ok(/ip-more[\s\S]{0,400}lien\.onclick = \(\) => closeInfoPop\(\)/.test(tranche(app, 'function openInfoPop(')),
    'la bulle ne mène pas à son article, ou reste ouverte par-dessus');
});

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
  const expr = (/etape: ([^\n]*'recu'[^\n]*)/.exec(cab) || [])[1];
  assert.ok(expr, 'l\'expression qui décide de l\'étape de production est introuvable');
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

// Vu au test humain, après la contre-passation de PAIE-2026-08 : l'originale ne garde qu'une action,
// le miroir porte « contre-passation ↩ n° 65 », et les deux élargissaient le livre-journal jusqu'à ce
// que la colonne d'actions collante recouvre le Crédit. `e2e:cabinet-rendu` contre-passe désormais
// une pièce par les vrais boutons et mesure ce journal-là ; ces deux tests tiennent les deux causes.
t('Une action SEULE porte son mot court quand elle en a un — la phrase entière reste lue et survolée', () => {
  const RM = chargerRowMenu();
  const El = fauxDom();
  const racine = new El(null, {});
  const b = new El(racine, { 'data-rowmenu': 'E:cp' });
  let fait = 0;
  RM.brancherMenus(racine, () => [{ icon: 'texte', label: 'Joindre un justificatif…', court: 'Justificatif…',
    hint: 'Le fichier est copié dans le dossier du client', run: () => { fait++; } }]);
  assert.ok(/<span>Justificatif…<\/span>/.test(b.innerHTML), 'le bouton seul porte encore la phrase entière : 203 px dans la colonne d\'actions, le Crédit dessous');
  assert.strictEqual(b.attrs['aria-label'], 'Joindre un justificatif…', 'un lecteur d\'écran doit entendre la phrase entière, pas le mot court');
  assert.ok(b.title.includes('Joindre un justificatif…') && b.title.includes('copié'), 'l\'infobulle doit dire la phrase ET son explication');
  b.onclick({ stopPropagation: () => {} });
  assert.strictEqual(fait, 1, 'le bouton court n\'exécute plus son action');
  // Sans mot court, rien ne change : la phrase EST le bouton (7.29.0).
  const autre = new El(null, {});
  const b2 = new El(autre, { 'data-rowmenu': 'X:1' });
  RM.brancherMenus(autre, () => [{ icon: 'loupe', label: 'Ouvrir le paquet', hint: 'Dans le Finder', run: () => {} }]);
  assert.ok(/<span>Ouvrir le paquet<\/span>/.test(b2.innerHTML) && !('aria-label' in b2.attrs), 'une action sans mot court a changé de forme');
  // Et le Cabinet s'en sert là où la phrase coûtait le Crédit : l'action du justificatif.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const actions = tranche(app, 'function actionsEcriture(');
  assert.ok(/label: e\.pieceJointe \? 'Remplacer le justificatif…' : 'Joindre un justificatif…',\s*court: '[^']{6,}'/.test(actions),
    'l\'action du justificatif n\'a plus de mot court : seule sur une pièce contre-passée, elle élargit le journal');
});

t('Le badge d\'un miroir passe SOUS sa référence — jamais dans une cellule qui interdit le retour à la ligne', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const usages = [...app.matchAll(/miroirBadge\(e\)/g)].map(m => m.index);
  assert.ok(usages.length >= 2, 'le journal ET le grand livre doivent montrer le miroir');
  usages.forEach(i => {
    const cellule = app.slice(app.lastIndexOf('<td', i), i);
    assert.ok(!/^<td[^>]*class="[^"]*\bnw\b/.test(cellule), `le badge d'un miroir vit dans une cellule « nw » : « contre-passation ↩ n° 65 » élargit la colonne Pièce (${cellule.slice(0, 60)})`);
    assert.ok(/<span class="nw">\$\{esc\(e\.piece\)\}<\/span>/.test(cellule), 'la référence d\'une pièce peut se couper à ses tirets : elle doit rester d\'un bloc');
  });
  // La colonne collante porte la teinte de sa ligne : son fond opaque coupait la bande d'un miroir
  // ou d'un brouillard juste avant le bouton.
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css').replace(/\/\*[\s\S]*?\*\//g, '');
  ['br-ligne', 'cp-miroir'].forEach(k => assert.ok(new RegExp(`\\.scroll-x table\\.list tr\\.${k} td\\.row-actions[^{]*\\{[^}]*background: var\\(--info-soft\\)`).test(css),
    `la colonne d'actions d'une ligne « ${k} » garde le fond du panneau : la bande de la ligne s'arrête avant son bouton`));
});

t('H-5 : chaque dossier rouvre sur l\'écran de comptabilité où on l\'a laissé', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const livresState = { dossierId: '', onglet: 'journal', dernierParGroupe: {} };
  const declState = { mois: '', ouverte: '' };
  const changer = evaluer(tranche(app, 'function changerDeDossierCompta('), { livresState, ecransCompta: {}, declState });
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
  // Le mois de déclaration choisi chez l'un (10.12.0) : juillet 2026 du garage ouvrait la
  // déclaration de juillet 2026 d'un client dont on regarde 2025.
  declState.mois = '2026-07'; declState.ouverte = 'tva';
  changer('BEJI');
  assert.strictEqual(livresState.q, '', 'une recherche d\'un dossier ne suit pas dans l\'autre');
  assert.strictEqual(livresState.journal, '', 'un filtre de journal ne suit pas dans l\'autre');
  assert.strictEqual(declState.mois, '', 'le mois de déclaration d\'un dossier suit dans l\'autre');
  assert.strictEqual(declState.ouverte, '', 'la case ouverte d\'un dossier suit dans l\'autre');
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
  const suivante = (actifs, manquants, aPasser, auBrouillard) => evaluer(m[1], { actifs, manquants, aPasser, auBrouillard: !!auBrouillard });
  assert.strictEqual(suivante([], 0, 0), 'salarie', 'sans salarié, l\'étape suivante est de le déclarer');
  assert.strictEqual(suivante([{}], 1, 0), 'bulletin', 'un salarié sans bulletin : l\'étape suivante est le bulletin');
  assert.strictEqual(suivante([{}], 0, 1), 'ecrire', 'les bulletins faits : l\'étape suivante est l\'écriture');
  // 10.12.0 — une écriture de paie au BROUILLARD n'est pas encore dans les livres : l'étape suivante
  // est de la valider, pas « rien » (la Paie disait « écrite » pendant que la déclaration l'attendait).
  assert.strictEqual(suivante([{}], 0, 0, true), 'valider', 'une paie au brouillard n\'a pas d\'étape suivante');
  assert.strictEqual(suivante([{}], 0, 0), '', 'un mois écrit et validé n\'a plus d\'étape suivante');
  [['pa-salarie', 'salarie'], ['pa-bulletin', 'bulletin'], ['pa-ecrire', 'ecrire'], ['pa-valider', 'valider']].forEach(([id, pas]) =>
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
  // 10.12.0 — retourné vers la règle : le vert suit ce qui est DÛ (`dues`, la fonction du moteur),
  // plus ce qui est seulement préparable — en septembre, la dotation de décembre ne l'est pas.
  const suivante = (aCreer, dues, rows) => evaluer(m[1], { d: { aCreer }, dues, e: { aEcrire: dues, rows } });
  assert.strictEqual(suivante([{}], 2, [{}]), 'creer', 'une acquisition sans fiche passe avant tout : elle ne s\'amortit nulle part');
  assert.strictEqual(suivante([], 2, [{}]), 'ecrire', 'des écritures dues en attente : l\'étape suivante est de les écrire');
  assert.strictEqual(suivante([], 0, []), 'neuf', 'un exercice sans bien : l\'étape suivante est le premier bien');
  assert.strictEqual(suivante([], 0, [{}]), '', 'rien de dû : plus rien n\'est vert');
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
  // (La règle, pas la forme : l'appel peut porter d'autres connaissances — les livres des dossiers
  // tenus au cabinet l'ont rejoint en 10.12.0 —, il doit porter CELLE-CI.)
  assert.ok(/echeances\(state, todayIso, \{ avant: 1, apres: 1, employeurs: \(opts \|\| \{\}\)\.employeurs[,\s]/.test(cc), '« À faire » compte la CNSS sans la connaissance des employeurs');
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/K\.echeances\(S, null, \{ employeurs: employeursConnus\(\)[,\s]/.test(app), 'la page Échéances ne passe plus la connaissance des employeurs');
  assert.ok(/K\.cabinetTodo\(S, null, \{[^}]*employeurs: employeursConnus\(\)[,\s]/.test(app), '« À faire » ne reçoit plus la connaissance des employeurs');
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

// ================================================================ lot D — U-10 : l'exemple qui montre

// Le livre d'un client SUR SkanFact, bâti comme l'exemple le bâtit : une ouverture, puis ses
// paquets relus par le moteur. Les gabarits sont figés (2025-09 → 2026-08) : la date est fixée
// aussi, et le test ne dépend pas du jour où il tourne.
const V = require('../../src/cabinet/exemple-vitrine.js');
function livreVitrine() {
  const G = require('../../src/cabinet/exemple-paquets.json');
  const l = KC.livreVide('MF:TEST', 2026);
  const o = V.ouvrirClientSkanfact(l, { qui: 'test', quand: 1 });
  assert.ok(o.ok && !o.deja, 'l\'ouverture de la vitrine n\'a pas été posée');
  // Un client venu à SkanFact APRÈS janvier, comme celui de l'exemple : son paquet de janvier (et
  // l'à-nouveau qu'il porte) n'existe pas — c'est le cabinet qui pose l'ouverture.
  G.mois.filter(m => m.mois >= '2026-02' && m.mois <= '2026-12').sort((a, b) => a.mois.localeCompare(b.mois)).forEach((m, i) => {
    const csv = m.fichiers.find(f => f.chemin === 'journaux/ecritures.csv').texte;
    KC.importerPaquet(l, m.mois, KC.piecesDepuisLignes(KC.entreesDepuisCsv(csv)), true, 'import', 10 + i);
  });
  return l;
}

t('U-10 : la banque de l\'exemple — des relevés qui se bouclent, une ambiguïté jamais posée, un suspens de chaque côté, et un écart tout entier expliqué', () => {
  const l = livreVitrine();
  // Un livre qui porte déjà un à-nouveau n'en reçoit pas un second : l'ouverture compterait deux fois.
  const nAN = l.ecritures.filter(e => e.journal === 'AN').length;
  assert.ok(V.ouvrirClientSkanfact(l, { qui: 'test', quand: 2 }).deja, 'une seconde ouverture a été tentée');
  assert.strictEqual(l.ecritures.filter(e => e.journal === 'AN').length, nAN);
  const b = V.garnirBanque(l, { qui: 'test', quand: 100, aujourdhui: '2026-09-23' });
  assert.ok(b.ok, b.motif);
  assert.strictEqual(b.mois, '2026-08', 'le relevé montré est celui du dernier mois TERMINÉ');
  assert.ok(b.precedents.length >= 3, 'la banque doit être rapprochée depuis le début de l\'exercice');
  const R = b.releve;
  assert.strictEqual(l.releves[0].id, R.id, 'le mois montré s\'importe en premier : c\'est lui que l\'écran ouvre');
  // L'ambiguïté : deux candidats du même montant, et l'automatique ne pose RIEN (9.5.0).
  const amb = (b.auto.detail || []).find(x => x.candidats.some(c => c.ecritureId === b.ambigu.ecritureId));
  assert.ok(amb, 'le règlement annoncé n\'est candidat d\'aucune ligne : l\'ambiguïté n\'existe pas');
  assert.ok(amb.candidats.length >= 2 && amb.niveau !== 'certain', 'une ambiguïté n\'est jamais « certaine »');
  const ligneAmb = R.lignes.find(x => x.id === amb.ligneId);
  assert.strictEqual(ligneAmb.rapprochement.ecritureId, '', 'l\'automatique a posé une ligne ambiguë');
  assert.ok(['probable', 'a-confirmer'].includes(ligneAmb.rapprochement.niveau),
    'la ligne ambiguë se dit « sans réponse » : l\'écran affirmerait qu\'il n\'y a rien en face');
  assert.strictEqual(l.ecritures.find(e => e.id === b.ambigu.ecritureId).statut, 'brouillard');
  assert.ok(b.auto.compte.certain >= 3, 'rien de certain : le relevé ne montre pas ce que le moteur sait faire');
  // Une ligne que le livre n'a pas (la commission), et un encaissement que la banque n'a pas encore.
  const S = KC.suspens(l, R.id);
  assert.ok(S.banque.some(x => /COMMISSION/.test(x.libelle) && x.montant < 0), 'la commission sans écriture manque');
  assert.ok(S.livre.some(x => x.date === b.tardive.date && x.montant === b.tardive.montant), 'l\'encaissement crédité le mois suivant manque');
  assert.strictEqual(S.avant, 0, 'l\'écart doit s\'expliquer tout entier par les suspens du mois');
  assert.strictEqual(KC.round3(S.ecart - S.ecartSuspens), 0);
  // Les mois d'avant : entiers et rapprochés, sans rien d'« avant ».
  l.releves.filter(r => r.id !== R.id).forEach(r => {
    const s = KC.suspens(l, r.id);
    assert.deepStrictEqual([s.ecart, s.avant, s.banque.length, s.livre.length], [0, 0, 0, 0], `le relevé ${r.du} ne tombe pas juste`);
  });
  assert.ok(KC.balanceDepuisLignes(KC.lignesDuLivre(l), KC.soldesDepuisOuverture(l)).ok, 'la vitrine a déséquilibré le livre');
  // Et une suggestion se REJUGE : le doublon supprimé, l'automatique pose la bonne écriture.
  KC.supprimerEcriture(l, b.ambigu.ecritureId, 'test', 101);
  KC.rapprocherAuto(l, R.id, { date: '2026-09-23' });
  assert.strictEqual(R.lignes.find(x => x.id === amb.ligneId).rapprochement.niveau, 'certain', 'une ambiguïté levée ne se rejuge jamais');
});

// Vu au test humain sur le garage de l'exemple, en septembre : « Immobilisations 2 » sur l'onglet et
// « Passer les écritures d'inventaire » en vert, pour des dotations qui ne s'écrivent qu'au 31
// décembre (9.0.0). Un compteur qui réclame un geste pas encore dû apprend à ignorer les compteurs.
t('Une dotation ne se RÉCLAME qu\'au dernier mois de l\'exercice ; une sortie d\'actif, tout de suite', () => {
  const l = KC.livreVide('MF:TEST', 2026);
  const bien = x => ({ libelle: 'Bien', compte: '2241', compteAmort: '2841', compteDotation: '681', valeur: 3600, duree: 3,
    dateAcquisition: '2026-02-01', dateMiseEnService: '2026-02-01', ...x });
  assert.ok(KC.ajouterImmobilisation(l, bien({ libelle: 'Compresseur' }), 'test', 1).ok);
  const ex = l.exercice;
  const du = jour => KC.aReclamerImmobilisations(KC.etatImmobilisations(l, 2026), ex, jour);
  assert.strictEqual(KC.etatImmobilisations(l, 2026).aEcrire, 1, 'la dotation doit rester PRÉPARABLE : le bouton s\'arme sur aEcrire');
  assert.strictEqual(du('2026-09-23'), 0, 'en septembre, la dotation de décembre est réclamée');
  assert.strictEqual(du('2026-11-30'), 0, 'la veille du dernier mois, la dotation est réclamée');
  assert.strictEqual(du('2026-12-01'), 1, 'au dernier mois, la dotation doit être réclamée');
  assert.strictEqual(du('2027-02-15'), 1, 'après la fin de l\'exercice, la dotation doit être réclamée');
  // Une sortie d'actif s'écrit à sa date : elle se réclame tout de suite.
  assert.ok(KC.ajouterImmobilisation(l, bien({ libelle: 'Camion', cession: { date: '2026-06-30', prix: 0, motif: 'rebut' } }), 'test', 2).ok);
  assert.strictEqual(du('2026-09-23'), 1, 'une sortie d\'actif de juin n\'est pas réclamée en septembre');
  // Une écriture passée ne se réclame plus, quelle que soit la date.
  l.immobilisations.forEach(f => assert.ok(KC.noterEcritureImmo(l, f.id, 2026, 'E-' + f.id).ok));
  assert.strictEqual(du('2027-02-15'), 0, 'une écriture déjà passée est encore réclamée : elle serait comptée deux fois');
  // L'écran : la pastille ET le bouton vert lisent la MÊME fonction — un compteur et le geste qu'il
  // annonce ne peuvent pas se contredire (6.8.1).
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const vue = tranche(app, 'function vueImmobilisations(');
  assert.ok(/const dues = KC\.aReclamerImmobilisations\(e,/.test(vue) && /dues \? 'ecrire'/.test(vue), 'le bouton vert ne suit pas ce qui est dû');
  assert.ok(/id="im-ecrire" \$\{e\.aEcrire \? '' : 'disabled'\}/.test(vue), 'préparer l\'inventaire plus tôt doit rester possible');
  assert.ok(/!dues \? \[`Les dotations de \$\{s\.annee\} s'écrivent à l'inventaire/.test(vue), 'le bouton qui n\'est plus vert ne dit pas pourquoi');
});

// Vu au test humain sur la vitrine : −3 650,591 en rouge sur la carte, deux listes de suspens sans
// total, et rien pour dire que la banque moins le livre redonne l'écart au millime — un comptable
// refaisait l'addition à la main pour savoir s'il restait un mystère.
t('Les suspens se TOTALISENT, et l\'écran dit s\'ils expliquent tout l\'écart — ou ce qui vient d\'avant les relevés', () => {
  const l = livreVitrine();
  const b = V.garnirBanque(l, { qui: 'test', quand: 100, aujourdhui: '2026-09-23' });
  const S = KC.suspens(l, b.releve.id);
  const somme = xs => KC.round3(xs.reduce((s, x) => s + x.montant, 0));
  // Des montants qui ne se divisent pas en rond : un total arrondi ailleurs se verrait (9.6.1).
  assert.ok(S.banque.length && S.livre.length, 'la vitrine n\'a plus de suspens des deux côtés : le test ne discrimine plus');
  assert.strictEqual(S.totalBanque, somme(S.banque), 'le total côté banque n\'est pas la somme de sa liste');
  assert.strictEqual(S.totalLivre, somme(S.livre), 'le total côté livre n\'est pas la somme de sa liste');
  assert.strictEqual(KC.round3(S.totalBanque - S.totalLivre), S.ecartSuspens, 'banque − livre ne redonne pas la part expliquée de l\'écart');
  assert.strictEqual(KC.round3(S.ecartSuspens + S.avant), S.ecart, 'la part expliquée et la part d\'avant ne refont pas l\'écart');
  // L'écran : un pied sous chaque côté, lu dans le moteur (jamais recalculé), et le verdict dans
  // ses DEUX formes — tout expliqué, ou la part d'avant les relevés nommée.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('<h2>Les suspens');
  const panneau = app.slice(i, app.indexOf('function brancherBanque(', i));
  assert.ok(i > 0 && panneau.length > 800 && panneau.length < 6000, 'la tranche du panneau des suspens est introuvable : ' + panneau.length);
  assert.ok(/<tfoot>[\s\S]{0,160}money\(sus\.totalBanque\)/.test(panneau), 'le côté banque n\'a pas de total');
  assert.ok(/<tfoot>[\s\S]{0,160}money\(sus\.totalLivre\)/.test(panneau), 'le côté livre n\'a pas de total');
  assert.ok(!/\.reduce\(/.test(panneau), 'l\'écran refait une somme : deux arrondis finiraient par diverger (9.3.0)');
  assert.ok(/sus\.avant\s*\?[\s\S]{0,400}money\(sus\.avant\)[\s\S]{0,300}Les suspens expliquent tout l'écart/.test(panneau),
    'le verdict n\'a pas ses deux formes : tout expliqué, ou la part d\'avant les relevés');
});

t('U-10 : la révision de l\'exemple est ENTAMÉE — deux comptes signés, une note, une question posée sur une pièce', () => {
  const l = livreVitrine();
  const b = V.garnirBanque(l, { qui: 'test', quand: 100, aujourdhui: '2026-09-23' });
  const r = V.garnirRevision(l, { qui: 'test', quand: 200, periode: '2026', banque: b });
  assert.deepStrictEqual(r.signes, ['706', '4367']);
  const d = KC.dossierDeRevision(l, { periode: '2026' });
  assert.strictEqual(d.revus, 2, 'deux comptes signés');
  assert.ok(d.reste > 0, 'une révision FINIE ne montre pas qu\'elle se fait');
  assert.strictEqual(d.notes.filter(n => !n.levee).length, 1);
  assert.ok(/3 247,560|double la remise/.test(d.notes[0].texte), 'la note parle de la banque');
  // La question naît d'une LIGNE : elle porte l'écriture, donc elle s'affichera en face de la pièce.
  const q = (l.questions || [])[0];
  assert.ok(q && q.ecritureId && q.attendu === 'piece' && q.statut === 'ouverte', 'la question n\'est pas posée sur une pièce');
  assert.ok(/^6/.test(q.compte) && !/^64/.test(q.compte), 'la question vise une charge, jamais la paie');
  assert.ok(KC.controlesRevision(l, '2026').some(c => c.id === 'questions'), 'la question ouverte doit se lire avant d\'arrêter la révision');
});

t('U-10 : le client hors SkanFact tient une ANNÉE — aucun mois vide, chaque mois terminé écrit, déclaré et payé ; seul le dernier attend', () => {
  const h = V.livreHorsSkanfact('MF:TEST2', { qui: 'test', quand: 1, aujourdhui: '2026-09-23' });
  assert.deepStrictEqual(h.motifs, [], 'un moteur a refusé la vitrine');
  const l = h.livre;
  assert.strictEqual(h.annee, 2026);
  assert.strictEqual(h.biens.length, 2);
  assert.deepStrictEqual(KC.immobilisationsACreer(l, 2026), [], 'une fiche rattachée ne se repropose pas');
  // Le parc repris et le 28 disent la même chose (C-10) : c'est ce contrôle qui a trouvé la double
  // ouverture — il doit rester silencieux sur un exemple juste.
  const c = KC.controlesCloture(l, {});
  assert.ok(!c.some(x => x.id === 'amortissements' && !x.ok), 'le tableau des biens et le 28 divergent');
  assert.strictEqual(h.salaries.length, 2);
  assert.ok(KC.controlesPaie(l, 2026, 8).some(x => x.id === 'cnss-manquant'), 'le numéro CNSS manquant doit se nommer');
  // La paie : un bulletin chaque mois pour le mécanicien, écrit et réglé jusqu'au mois d'avant ; le
  // dernier mois attend son écriture — l'étape suivante que l'écran met en vert.
  assert.deepStrictEqual([...new Set(l.bulletins.filter(x => x.salarieId === 'sal-exemple-1').map(x => x.mois))], [1, 2, 3, 4, 5, 6, 7, 8],
    'le mécanicien, embauché depuis trois ans, n\'est pas payé tous les mois');
  assert.ok(l.bulletins.filter(x => x.mois < 8).every(x => x.ecritureId), 'un mois terminé garde une paie sans écriture');
  assert.ok(l.bulletins.filter(x => x.mois === 8).every(x => !x.ecritureId), 'la paie du dernier mois n\'attend plus rien');
  const bal = KC.balanceDepuisLignes(KC.lignesDuLivre(l, { brouillard: true }), KC.soldesDepuisOuverture(l));
  assert.ok(bal.ok);
  const solde = c2 => ((bal.rows.find(r => r.account === c2) || {}).solde) || 0;
  assert.ok(solde('532') > 0, 'la banque de l\'exemple est à découvert');
  // Réglé, déclaré, payé : les comptes qui disent qu'un mois est FINI sont soldés.
  assert.strictEqual(solde('425'), 0, 'des salaires restent dus au personnel');
  assert.strictEqual(solde('4365'), 0, 'une déclaration déposée n\'est pas payée');
  assert.strictEqual(solde('401'), 0, 'un fournisseur de pièces reste à payer');
  // Aucun mois VIDE : c'est ce que le bandeau « aucune écriture sur … » montrait au comptable.
  assert.deepStrictEqual(C.moisManquants(l.ecritures.map(e => e.date), '2026-01', '2026-08', '2026-09-23'), [], 'un mois de l\'exemple n\'a aucune écriture');
  // Chaque mois terminé est déclaré, déposé et payé ; le dernier est l'étape suivante.
  assert.deepStrictEqual(h.declarations, ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
  (l.declarations || []).forEach(d => assert.ok(d.deposee.le && d.payee.le && d.ecritureId, `la déclaration de ${d.periode} n'est pas menée au bout`));
  assert.ok(!KC.declarationMensuelle(l, '2026-08').ecritureExistante, 'la déclaration du dernier mois est déjà faite : l\'exemple n\'a plus d\'étape suivante');
  assert.deepStrictEqual(h.cnss, [1, 2], 'la CNSS des trimestres échus n\'est pas versée');
  // L'IRPP de juillet est CE QUI A ÉTÉ RETENU en juillet — le reversement de juin, payé en juillet,
  // ne le diminue pas (le défaut que cette année complète a trouvé dans le moteur).
  const retenuJuillet = KC.round3(l.bulletins.filter(x => x.mois === 7).reduce((s, x) => s + x.calcul.irpp + x.calcul.css, 0));
  assert.strictEqual(KC.declarationMensuelle(l, '2026-07').cases.irpp.montant, retenuJuillet);
  // Relatif au jour, et jamais dans le futur — y compris en février (un seul mois) et en janvier
  // (l'exercice qui vient de finir, jamais un exercice vide).
  [['2026-02-10', 2026, 1], ['2027-01-15', 2026, 12], ['2026-09-23', 2026, 8]].forEach(([jour, annee, mois]) => {
    const x = V.livreHorsSkanfact('MF:T', { qui: 't', quand: 1, aujourdhui: jour });
    assert.deepStrictEqual(x.motifs, [], jour + ' : ' + x.motifs.join(' ; '));
    assert.strictEqual(x.annee, annee, jour);
    assert.strictEqual(new Set(x.bulletins.map(b => b.mois)).size, mois, jour);
    assert.strictEqual(x.paie.attend, mois, jour + ' : ce n\'est pas le dernier mois terminé qui attend');
    x.livre.ecritures.forEach(e => assert.ok(e.date <= jour, `${jour} : une écriture datée du ${e.date}`));
  });
});

t('Ce qu\'on RETIENT dans le mois n\'est pas diminué de ce qu\'on REVERSE pour le mois d\'avant (trouvé en complétant l\'exemple)', () => {
  // Deux mois de paie, et l'IRPP de juin reversé en juillet. Les DONNÉES discriminent (9.6.1) : sans
  // le reversement, l'ancienne lecture (mouvement net du 4321) et la nouvelle diraient la même chose.
  const l = KC.livreVide('MAT:1', 2026);
  KC.ajouterSalarie(l, { id: 's', nom: 'Salah', embauche: '2024-01-01', brut: 1150, cnss: '1', chefDeFamille: true, enfants: 2 }, 'moi', 1);
  const paie = mois => {
    KC.ajouterBulletin(l, { salarieId: 's', annee: 2026, mois, brut: 1150, joursTravailles: 26 }, {}, 'moi', 2);
    const p = KC.ecritureDePaie(l, 2026, mois, {});
    const e = KC.ajouterEcriture(l, p.ecriture, 'moi', 3);
    KC.noterEcriturePaie(l, p.lot, e.id, 'moi', 4);
    KC.validerEcriture(l, e.id, 'moi', 5);
    return p;
  };
  paie(6);
  const juillet = paie(7);
  const irppMois = KC.round3(juillet.ecriture.lignes.filter(x => x.compte === '4321').reduce((s, x) => s + x.credit, 0));
  const rev = KC.ajouterEcriture(l, { date: '2026-07-20', journal: 'BQ', piece: 'RSAL-06', libelle: 'Retenues de juin',
    lignes: [{ compte: '4321', debit: irppMois }, { compte: '532', credit: irppMois }] }, 'moi', 6);
  KC.validerEcriture(l, rev.id, 'moi', 7);
  const d = KC.declarationMensuelle(l, '2026-07');
  assert.strictEqual(d.cases.irpp.montant, irppMois, `la case IRPP de juillet vaut ${d.cases.irpp.montant} : le reversement de juin la diminue`);
  assert.ok(!d.cases.irpp.ecritures.includes(rev.id), 'le reversement se donne pour une pièce de la retenue');
  // Une CORRECTION, elle, compte — sur un livre venu des paquets (la paie vit chez le client, le livre
  // n'a que l'écriture) : la contre-passation d'une paie ramène la case à zéro.
  const p2 = KC.livreVide('MAT:2', 2026);
  const od = KC.ajouterEcriture(p2, { date: '2026-07-31', journal: 'OD', piece: 'PAIE-07', libelle: 'Paie de juillet',
    lignes: [{ compte: '640', debit: 1000 }, { compte: '4321', credit: 80 }, { compte: '425', credit: 920 }] }, 'moi', 1);
  KC.validerEcriture(p2, od.id, 'moi', 2);
  assert.strictEqual(KC.declarationMensuelle(p2, '2026-07').cases.irpp.montant, 80);
  assert.ok(KC.contrepasser(p2, od.id, 'moi', '2026-07-31', 3).ok);
  assert.strictEqual(KC.declarationMensuelle(p2, '2026-07').cases.irpp.montant, 0, 'une paie contre-passée garde son IRPP dans la déclaration');
});

t('Une écriture contre-passée LIBÈRE ce qu\'elle portait — la paie, la dotation, la déclaration, l\'inventaire (« contre-passe d\'abord » menait à une impasse)', () => {
  // La paie : établie, écrite, validée, puis contre-passée pour corriger un brut.
  const l = KC.livreVide('MAT:1', 2026);
  KC.ajouterSalarie(l, { id: 's', nom: 'Salah', embauche: '2024-01-01', brut: 1150, cnss: '1' }, 'moi', 1);
  KC.ajouterBulletin(l, { id: 'b7', salarieId: 's', annee: 2026, mois: 7, brut: 1150, joursTravailles: 26 }, {}, 'moi', 2);
  const p = KC.ecritureDePaie(l, 2026, 7, {});
  const e = KC.ajouterEcriture(l, p.ecriture, 'moi', 3);
  KC.noterEcriturePaie(l, p.lot, e.id, 'moi', 4);
  KC.validerEcriture(l, e.id, 'moi', 5);
  const refus = KC.ajouterBulletin(l, { id: 'b7', salarieId: 's', annee: 2026, mois: 7, brut: 1200 }, {}, 'moi', 6);
  assert.ok(!refus.ok && /contre-passe/.test(refus.motif), 'le bulletin écrit se modifie sans contre-passation');
  // Ce que le geste va rendre « à passer » se DIT avant lui, avec les mêmes objets que ce qu'il libère.
  assert.deepStrictEqual(KC.ceQuePorte(l, e.id), ['la paie de juillet 2026'], 'la question ne nomme pas ce que l\'écriture porte');
  assert.deepStrictEqual(KC.ceQuePorte(l, 'inconnue'), []);
  const cp = KC.contrepasser(l, e.id, 'moi', '2026-07-31', 7);
  assert.deepStrictEqual(KC.ceQuePorte(l, e.id), [], 'une fois libérée, l\'écriture porte encore quelque chose');
  assert.ok(cp.ok && cp.liberes === 1, 'la contre-passation ne dit pas ce qu\'elle a libéré');
  assert.ok(KC.ajouterBulletin(l, { id: 'b7', salarieId: 's', annee: 2026, mois: 7, brut: 1200 }, {}, 'moi', 8).ok,
    'après la contre-passation, le bulletin refuse encore d\'être corrigé : le refus promettait une sortie qui n\'existe pas');
  assert.ok(KC.ecritureDePaie(l, 2026, 7, {}).ok, 'la paie corrigée ne peut plus être repassée');
  // Et la déclaration ATTEND la nouvelle paie, au lieu de déclarer ce qui a été annulé.
  const irpp = KC.declarationMensuelle(l, '2026-07').cases.irpp;
  assert.ok(irpp.montant === null && irpp.attente === 'paie', 'la case IRPP ne dit pas qu\'elle attend la paie');

  // La dotation d'un bien : passée, validée, contre-passée → la fiche se corrige, la dotation se repropose.
  const I = KC.livreVide('MAT:2', 2026);
  const f = KC.ajouterImmobilisation(I, { libelle: 'Four', compte: '223', valeur: 12000, dateAcquisition: '2025-01-01',
    dateMiseEnService: '2025-01-01', duree: 10, methode: 'lineaire' }, 'moi', 1).fiche;
  const dot = KC.ecrituresImmobilisations(I, 2026).find(x => x.genre === 'dotation');
  const ed = KC.ajouterEcriture(I, dot, 'moi', 2);
  KC.validerEcriture(I, ed.id, 'moi', 3);
  KC.noterEcritureImmo(I, f.id, 2026, ed.id);
  assert.ok(!KC.modifierImmobilisation(I, f.id, { duree: 8 }, 'moi', 4).ok, 'une dotation écrite laisse changer le plan');
  assert.deepStrictEqual(KC.ceQuePorte(I, ed.id), ['la dotation 2026 de « Four »']);
  assert.ok(KC.contrepasser(I, ed.id, 'moi', '2026-12-31', 5).ok);
  assert.ok(KC.modifierImmobilisation(I, f.id, { duree: 8 }, 'moi', 6).ok, 'la fiche reste verrouillée après la contre-passation de sa dotation');
  assert.ok(KC.ecrituresImmobilisations(I, 2026).some(x => x.genre === 'dotation'), 'la dotation corrigée ne se repropose pas');

  // La déclaration : un BROUILLARD compte déjà (pas de seconde écriture au second clic) ; une
  // écriture contre-passée ne compte plus (on la refait).
  const D = KC.livreVide('MAT:3', 2026);
  const v = KC.ajouterEcriture(D, { date: '2026-05-31', journal: 'VT', piece: 'R', libelle: 'Recettes',
    lignes: [{ compte: '532', debit: 119 }, { compte: '706', credit: 100 }, { compte: '4367', credit: 19 }] }, 'moi', 1);
  KC.validerEcriture(D, v.id, 'moi', 2);
  const decl = KC.declarationMensuelle(D, '2026-05');
  KC.poserDeclaration(D, decl, 'moi', 3);
  const b = KC.ajouterEcriture(D, KC.ecritureDeclaration(D, decl), 'moi', 4);
  assert.strictEqual(KC.declarationMensuelle(D, '2026-05').ecritureExistante, b.id, 'une écriture de déclaration au brouillard ne compte pas : un second clic en fabrique une seconde');
  KC.validerEcriture(D, b.id, 'moi', 5);
  const posee = (D.declarations || []).find(x => x.periode === '2026-05');
  if (posee && !posee.ecritureId) posee.ecritureId = b.id;
  assert.deepStrictEqual(KC.ceQuePorte(D, b.id), ['la déclaration de mai 2026'], 'la déclaration portée n\'est pas nommée');
  assert.ok(KC.contrepasser(D, b.id, 'moi', '2026-05-31', 6).ok);
  assert.strictEqual(KC.declarationMensuelle(D, '2026-05').ecritureExistante, '', 'la déclaration contre-passée ne peut plus être réécrite');

  // Un livre ANCIEN qui garde un lien mort se répare à la lecture, sans toucher une écriture.
  const A = KC.livreVide('MAT:4', 2026);
  A.bulletins = [{ id: 'x', salarieId: 's', annee: 2026, mois: 1, ecritureId: 'e-disparue' }];
  A.inventaires = [{ id: 'i', date: '2026-12-31', ecritureId: 'e-disparue' }];
  const avant = JSON.stringify(A.ecritures);
  KC.migrerLivre(A);
  assert.ok(A.bulletins[0].ecritureId === null && A.inventaires[0].ecritureId === '', 'un lien mort d\'un livre ancien verrouille encore');
  assert.strictEqual(JSON.stringify(A.ecritures), avant, 'la migration a touché une écriture');
  // L'inventaire, quatrième objet : nommé par sa date, et son refus dit le geste selon l'écriture.
  const V2 = KC.livreVide('MAT:5', 2026);
  V2.inventaires = [{ id: 'inv', date: '2026-12-31', ecritureId: 'e-inv', lignes: [] }];
  V2.ecritures = [{ id: 'e-inv', statut: 'brouillard', lignes: [] }];
  assert.deepStrictEqual(KC.ceQuePorte(V2, 'e-inv'), ['l\'inventaire du 31/12/2026']);
  const refusInv = KC.poserInventaire(V2, { date: '2026-12-31', lignes: [{ compte: '31', libelle: 'Pièces', quantite: 1, prixUnitaire: 10 }] }, 'moi', 1);
  assert.ok(!refusInv.ok && /supprime-la/.test(refusInv.motif) && !/Contre-passe/.test(refusInv.motif),
    'le refus d\'un inventaire au brouillard conseille encore une contre-passation impossible : ' + refusInv.motif);
  // Les deux questions — supprimer un brouillard, contre-passer — le disent AVANT le geste.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  // Le pronom suit le titre : « ce brouillard » → il, « cette écriture » → elle.
  assert.ok(/\$\{ceQuellePorte\(e, 'elle'\)\}/.test(tranche(app, 'async function contrepasserEcriture(')), 'la contre-passation ne dit pas ce qu\'elle rendra « à passer »');
  assert.ok(/\$\{ceQuellePorte\(e, 'il'\)\}/.test(tranche(app, 'async function supprimerBrouillard(')), 'la suppression d\'un brouillard ne dit pas ce qu\'il rendra « à passer »');
});

t('TFP et FOPROLOS se lisent sur les bulletins du mois quand le Cabinet tient la paie — et la raison dit la vérité sinon', () => {
  const h = V.livreHorsSkanfact('MF:TEST4', { qui: 'test', quand: 1, aujourdhui: '2026-09-23' });
  const d = KC.declarationMensuelle(h.livre, '2026-07');
  const b = h.livre.bulletins.filter(x => x.mois === 7);
  assert.strictEqual(d.cases.tfp.montant, KC.round3(b.reduce((s, x) => s + x.calcul.tfp, 0)), 'la TFP de juillet n\'est pas celle des bulletins');
  assert.strictEqual(d.cases.foprolos.montant, KC.round3(b.reduce((s, x) => s + x.calcul.foprolos, 0)));
  assert.ok(/À VÉRIFIER/.test(d.cases.tfp.horsTotal) && /total/.test(d.cases.tfp.horsTotal), 'une ligne hors du total doit le dire (9.8.8)');
  assert.ok(d.cases.tfp.ecritures.length === 1, 'la TFP ne mène pas à l\'écriture de paie');
  // Le dernier mois : bulletins établis, écriture pas encore passée — la raison le dit, sans parler
  // d'un compte « que le plan ne porte pas ».
  const a = KC.declarationMensuelle(h.livre, '2026-08').cases.tfp;
  assert.ok(a.montant === null && /pas encore d'écriture validée/.test(a.motif), 'raison : ' + a.motif);
  // Un livre venu des PAQUETS (la paie reste dans l'app entreprise) : le 4335 porte les deux ensemble.
  const l = KC.livreVide('MAT:2', 2026);
  const e = KC.ajouterEcriture(l, { date: '2026-05-31', journal: 'OD', piece: 'PAIE-05', libelle: 'Paie',
    lignes: [{ compte: '640', debit: 1000 }, { compte: '661', debit: 30 }, { compte: '4335', credit: 30 }, { compte: '425', credit: 1000 }] }, 'moi', 1);
  KC.validerEcriture(l, e.id, 'moi', 2);
  const p = KC.declarationMensuelle(l, '2026-05').cases;
  assert.ok(p.tfp.montant === null && /4335/.test(p.tfp.motif) && /ENSEMBLE/.test(p.tfp.motif), 'raison : ' + p.tfp.motif);
  assert.ok(!/aucun compte du plan/.test(p.tfp.motif), 'la raison nie un compte que le livre porte');
});

t('La balance d\'ouverture ne compte qu\'UNE fois — balance, états et à-nouveaux (défaut révélé par U-10)', () => {
  const l = KC.livreVide('MAT:1', 2026);
  assert.ok(KC.balanceOuverture(l, [{ compte: '532', debit: 10000 }, { compte: '101', credit: 10000 }], '2026-01-01', 'balance', 'moi', 1).ok);
  const e = KC.ajouterEcriture(l, { date: '2026-03-10', journal: 'BQ', piece: 'X', libelle: 'Frais', lignes: [{ compte: '627', debit: 25 }, { compte: '532', credit: 25 }] }, 'moi', 2);
  KC.validerEcriture(l, e.id, 'moi', 3);
  const lignes = KC.lignesDuLivre(l, { du: l.exercice.du, au: l.exercice.au });
  const bq = KC.balanceDepuisLignes(lignes, KC.soldesDepuisOuverture(l)).rows.find(r => r.account === '532');
  assert.strictEqual(bq.solde, 9975, `la banque vaut ${bq.solde} : l'ouverture est comptée deux fois`);
  assert.strictEqual(KC.etatsDepuisLignes(lignes, KC.soldesDepuisOuverture(l), {}).totalActif, 9975);
  assert.strictEqual(KC.anouveauxDe(l).lignes.find(x => x.compte === '532').debit, 9975, 'les à-nouveaux de l\'an prochain doubleraient la reprise');
  // La SOURCE de la reprise reste lisible : l'auxiliaire en a besoin pour expliquer un écart.
  assert.deepStrictEqual(KC.soldesRepris(l), { 532: 10000, 101: -10000 });
});

t('L\'à-nouveau n\'est jamais un suspens de banque, ni un mois à déclarer (défauts révélés par U-10)', () => {
  const l = KC.livreVide('MAT:1', 2026);
  assert.ok(KC.balanceOuverture(l, [{ compte: '532', debit: 10000 }, { compte: '101', credit: 10000 }], '2026-01-01', 'balance', 'moi', 1).ok);
  const e = KC.ajouterEcriture(l, { date: '2026-06-10', journal: 'VT', piece: 'F1', libelle: 'Vente', lignes: [{ compte: '532', debit: 119 }, { compte: '706', credit: 100 }, { compte: '4367', credit: 19 }] }, 'moi', 2);
  KC.validerEcriture(l, e.id, 'moi', 3);
  const r = KC.ajouterReleve(l, { compte: '532', du: '2026-01-01', au: '2026-06-30', soldeDebut: 10000, soldeFin: 10119,
    empreinte: 'x', lignes: [{ date: '2026-06-10', libelle: 'VERSEMENT', montant: 119 }] }, 'moi', 4);
  assert.ok(r.ok, r.motif);
  KC.rapprocherAuto(l, r.releve.id, {});
  const s = KC.suspens(l, r.releve.id);
  assert.deepStrictEqual([s.ecart, s.avant, s.livre.length], [0, 0, 0], 'un rapprochement parfait depuis le 1er janvier affiche l\'ouverture en suspens');
  // Et la TVA de janvier n'est pas réclamée pour la seule balance d'ouverture.
  const tva = KC.controlesCloture(l, {}).find(x => x.id === 'tva');
  assert.ok(!/janvier/.test(tva.detail) && /juin/.test(tva.detail), 'contrôle TVA : ' + tva.detail);
});

t('U-10 : les vitrines passent par les VRAIES portes, et le scénario les nomme', () => {
  const vit = C.demoDossiers('2026-09-23').filter(d => d.vitrine);
  assert.deepStrictEqual(vit.map(d => d.vitrine).sort(), ['hors', 'skanfact'], 'deux vitrines, une de chaque sorte');
  assert.ok(vit.find(d => d.vitrine === 'skanfact').packs.length, 'la vitrine SkanFact doit avoir ses paquets');
  assert.ok(vit.find(d => d.vitrine === 'hors').manual, 'la vitrine hors SkanFact doit être un dossier tenu à la main');
  const main = code('src', 'cabinet', 'main.js');
  // main.js ferme ses fonctions en colonne 0 : la tranche va jusqu'à la fonction suivante.
  const charge = main.slice(main.indexOf('function chargerExemple()'), main.indexOf('function rafraichirExemple()'));
  assert.ok(charge.length > 800 && charge.length < 6000, 'tranche chargerExemple suspecte : ' + charge.length);
  assert.ok(/garnirVitrines\(scenario\)/.test(charge), 'l\'exemple ne remplit plus ses vitrines');
  const g = main.slice(main.indexOf('function garnirVitrines('), main.indexOf('function retirerExemple('));
  assert.ok(g.length > 400 && g.length < 4000, 'tranche garnirVitrines suspecte : ' + g.length);
  assert.ok(/ecrireLeLivre\(d\.id, livre, 'exemple'/.test(g), 'la vitrine doit écrire par la porte unique (verrou, audit)');
  assert.ok(!/getStore\(\)\.ecrireLivre/.test(g), 'la vitrine contourne la porte unique');
  assert.ok(/importerPaquetsDans\(d, livre, annee\)/.test(g), 'la vitrine doit relire ses paquets comme le geste réel');
  const h = main.slice(main.indexOf("ipcMain.handle('cab:relireLesPaquets'"), main.indexOf('function importerPaquetsDans('));
  assert.ok(/importerPaquetsDans\(d, livre, annee\)/.test(h), '« Créer le livre » et l\'exemple doivent partager la relecture');
});

// ================================================================ lot D — ce que le test humain de la Banque a vu

// Un compte 532 qui s'ouvre à 500, deux règlements de 300 à un jour d'écart, et trois lignes de
// relevé : un chèque dont le libellé désigne l'un des deux, un VERSEMENT de 500 le lendemain de
// l'ouverture (le montant de l'à-nouveau, à ± 3 jours : l'appât), et un virement qui ne ressemble à
// rien. Les DONNÉES discriminent (9.6.1, 10.0.0) : sans elles, « l'à-nouveau n'est jamais candidat »
// serait vrai par hasard.
function livreDeBanque() {
  const l = KC.livreVide('MAT:1', 2026);
  assert.ok(KC.balanceOuverture(l, [{ compte: '532', debit: 500 }, { compte: '101', credit: 500 }], '2026-01-01', 'balance', 'moi', 1).ok);
  const ecr = (date, piece, libelle) => {
    const e = KC.ajouterEcriture(l, { date, journal: 'BQ', piece, libelle, lignes: [{ compte: '532', debit: 300 }, { compte: '411', credit: 300 }] }, 'moi', 2);
    KC.validerEcriture(l, e.id, 'moi', 3);
    return e;
  };
  const a = ecr('2026-01-02', 'F1', 'Règlement Dupont chèque 111');
  const b = ecr('2026-01-03', 'F2', 'Règlement Martin');
  const r = KC.ajouterReleve(l, { compte: '532', du: '2026-01-01', au: '2026-01-31', soldeDebut: 500, soldeFin: 1600, empreinte: 'x', lignes: [
    { date: '2026-01-02', libelle: 'REMISE CHEQUE DUPONT', montant: 300 },
    { date: '2026-01-02', libelle: 'VERSEMENT', montant: 500 },
    { date: '2026-01-03', libelle: 'VIR RECU', montant: 300 }] }, 'moi', 4);
  assert.ok(r.ok, r.motif);
  return { l, a, b, R: r.releve };
}

t('L\'à-nouveau n\'est jamais un candidat de rapprochement — ni pour l\'automatique, ni dans la fenêtre (vu au test humain)', () => {
  const { l, R } = livreDeBanque();
  const tout = KC.lignesBancaires(l, '532'), aPointer = KC.lignesARapprocher(l, '532');
  assert.strictEqual(tout.length, 3, 'les soldes lisent l\'à-nouveau : il doit rester dans lignesBancaires');
  assert.strictEqual(aPointer.length, 2);
  assert.ok(aPointer.every(c => c.journal !== 'AN'), 'l\'à-nouveau est proposé en face d\'une ligne de relevé');
  const auto = KC.rapprocherAuto(l, R.id, { date: '2026-02-01' });
  const versement = R.lignes.find(x => x.libelle === 'VERSEMENT');
  assert.strictEqual(versement.rapprochement.niveau, 'aucun', 'un versement de 500 a été apparié au solde reporté');
  assert.ok(!(auto.detail.find(x => x.ligneId === versement.id).candidats || []).length);
  assert.ok(!KC.candidatsDeLigne(l, R.id, versement.id).libres.some(c => c.journal === 'AN'), 'la fenêtre propose encore l\'ouverture');
  // Et le solde, lui, la compte toujours : l'écart de ce relevé parfait est nul.
  assert.strictEqual(KC.suspens(l, R.id).soldeComptable, 1100);
});

t('La fenêtre qui fait trancher dit ce que l\'automatique a jugé — le MÊME jugement, le plus probable en tête (vu au test humain)', () => {
  const { l, a, R } = livreDeBanque();
  const auto = KC.rapprocherAuto(l, R.id, { date: '2026-02-01' });
  const cheque = R.lignes.find(x => x.libelle === 'REMISE CHEQUE DUPONT');
  const vir = R.lignes.find(x => x.libelle === 'VIR RECU');
  const jc = KC.candidatsDeLigne(l, R.id, cheque.id);
  assert.strictEqual(jc.niveau, 'probable');
  assert.strictEqual(jc.meilleur && jc.meilleur.ecritureId, a.id, 'le chèque de Dupont ne désigne pas le règlement de Dupont');
  const jv = KC.candidatsDeLigne(l, R.id, vir.id);
  assert.strictEqual(jv.niveau, 'a-confirmer');
  assert.strictEqual(jv.meilleur, null, 'une égalité a désigné un gagnant');
  // Un seul jugement : ce que la fenêtre dit est ce que l'automatique a rangé, ligne par ligne.
  R.lignes.forEach(x => assert.strictEqual(KC.candidatsDeLigne(l, R.id, x.id).niveau, auto.detail.find(d => d.ligneId === x.id).niveau, x.libelle));
  // L'écran lit le moteur, sans refaire le tri des déjà-prises ; il met le plus probable en tête et
  // en couleur, s'élargit, et finit par le geste suivant.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const f = tranche(app, 'function choisirEcritureForm(');
  assert.ok(f.length > 1200 && f.length < 7000, 'tranche suspecte : ' + f.length);
  assert.ok(/KC\.candidatsDeLigne\(s\.livre, R\.id, ligne\.id/.test(f), 'la fenêtre ne lit pas le jugement du moteur');
  assert.ok(!/prises\.add/.test(f), 'la fenêtre refait son propre tri des écritures déjà prises');
  assert.ok(/cle\(c\) === prefere \? ' btn-primary'/.test(f), 'le plus probable n\'est pas le seul bouton en couleur');
  assert.ok(/classList\.add\('cab-moyen'\)/.test(f), 'la fenêtre garde la largeur où « Rapprocher » défilait de côté');
  assert.ok(/id="ce-ecrire"/.test(f) && /ecrireDepuisBanque\(root, dossier, R, ligne\)/.test(f), 'la fenêtre ne finit pas par « Écrire l\'écriture manquante »');
});

t('Le texte coupé à côté du vide se MESURE, sur les vitrines et dans les fenêtres — et une fenêtre ne défile jamais de côté', () => {
  const harnais = code('test', 'e2e', 'harnais.js');
  assert.ok(/const SONDE_TRONQUE = /.test(harnais) && /const SONDE_DEFILEMENT = /.test(harnais), 'les deux sondes manquent au harnais');
  const rendu = code('test', 'e2e', 'cabinet-rendu.js');
  assert.ok(/SONDE_TRONQUE, \{ vide: VIDE_MAX, racines: fenetre \? \['#view', FENETRE\] : \['#view'\] \}/.test(rendu), 'cabinet-rendu ne mesure pas le texte coupé, ou pas dans la fenêtre');
  assert.ok(/SONDE_DEFILEMENT, \{ racine: FENETRE \}/.test(rendu), 'cabinet-rendu ne juge pas une fenêtre qui défile de côté');
  // Les vitrines se DÉDUISENT du scénario, jamais écrites à la main — et le parcours les ouvre.
  assert.ok(/demoDossiers\(\)\s*\.filter\(d => d\.vitrine\)/.test(rendu), 'les vitrines ne sont pas lues dans le scénario');
  assert.ok(!/MF:\d/.test(rendu), 'un identifiant de dossier écrit à la main se périmera au premier renommage');
  assert.ok(/for \(const cible of \[null, \.\.\.VITRINES\]\)/.test(rendu), 'le parcours ne mesure pas les vitrines');
  assert.ok(/fenetresBanque\([\s\S]{0,120}?, cible && cible\.vitrine === 'skanfact'\)/.test(rendu), 'les fenêtres de la banque de la vitrine ne sont pas exigées');
  // Le même instrument sur la troisième surface (règle 9.4.3 : un instrument qui ne couvre qu'une
  // surface n'en protège qu'une).
  assert.ok(/SONDE_TRONQUE, \{ vide: VIDE_MAX, racines: \['body'\] \}/.test(code('test', 'e2e', 'console-rendu.js')), 'la console n\'est pas mesurée');
});

t('Un paquet DÉJÀ parti n\'est pas une panne au journal — une vraie panne, si (vu en rechargeant l\'exemple)', () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-rm-'));
  const journalise = [];
  const S = require('../../src/cabinet/cabstore.js').createCabStore(dir, { log: (quoi, e) => journalise.push(`${quoi} ${e && e.code}`) });
  // `removeDossierFiles` supprime le dossier entier, puis repasse sur chaque paquet : dix-neuf
  // « erreurs » au journal à chaque exemple rechargé, et la ligne qui compte ne se voyait plus.
  assert.strictEqual(S.removePack(path.join(dir, 'paquets', 'client', 'absent.skanpack')), true, 'un paquet déjà parti ne compte pas comme retiré');
  assert.deepStrictEqual(journalise, [], 'un paquet déjà parti a été écrit au journal comme une panne');
  // Une vraie panne reste une panne : un dossier ne s'efface pas comme un fichier.
  const d = path.join(dir, 'paquets', 'pas-un-fichier.skanpack');
  fs.mkdirSync(d, { recursive: true });
  assert.strictEqual(S.removePack(d), false);
  assert.strictEqual(journalise.length, 1, 'une vraie panne ne va plus au journal');
});

t('Le message de l\'exemple COMPTE ses dossiers : il en annonçait cinq, le scénario en porte six (vu au test humain)', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const f = /function phraseExemple\(\) \{[\s\S]*?\n  \}/.exec(app);
  assert.ok(f, 'phraseExemple introuvable');
  const dossiers = C.demoDossiers('2026-09-23');
  const phrase = evaluer(`(function () { ${f[0]}; return phraseExemple; })()`, { S: { dossiers } })();
  assert.ok(phrase.includes(`ces ${dossiers.length} dossiers`), phrase);
  // Les deux portes qui chargent l'exemple disent la même phrase — et aucune ne l'écrit en dur.
  assert.strictEqual((app.match(/toast\(phraseExemple\(\)\)/g) || []).length, 2, 'une porte de l\'exemple a sa propre phrase');
  assert.ok(!/Exemple chargé : ces (cinq|six|\d+) dossiers/.test(app), 'un compte de dossiers est écrit en dur dans une phrase');
});

t('La Paie NOMME le salarié sans numéro CNSS et ouvre sa fiche (règle 10.3.0, vu au test humain)', () => {
  const h = V.livreHorsSkanfact('MF:TEST3', { qui: 'test', quand: 1, aujourdhui: '2026-09-23' });
  const c = KC.controlesPaie(h.livre, 2026, 8).find(x => x.id === 'cnss-manquant');
  const sans = h.livre.salaries.filter(s => !s.cnss);
  assert.ok(c && sans.length && sans.every(s => c.detail.includes(s.nom)), 'le contrôle compte les salariés sans les nommer : ' + (c && c.detail));
  assert.deepStrictEqual(c.ids, sans.map(s => s.id), 'l\'écran ne saurait pas quelle fiche ouvrir');
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/data-sal-cnss="\$\{esc\(id\)\}"/.test(tranche(app, 'function vuePaie(')), 'le contrôle ne porte pas le geste qui le lève');
  assert.ok(/\[data-sal-cnss\][\s\S]{0,220}salarieForm\(root, dossier, x, \{ focus: 'cnss' \}\)/.test(tranche(app, 'function brancherPaie(')), 'le geste n\'ouvre pas la fiche du salarié sur son numéro');
  // Et la fenêtre respecte le curseur que son appelant a posé : sinon le focus repart au premier champ.
  assert.ok(/if \(cible && !layer\.contains\(document\.activeElement\)\) cible\.focus\(\);/.test(tranche(app, 'function modal(')), 'modal() reprend le curseur posé par l\'appelant');
});

t('Une pastille ne se coupe jamais ; un dossier tenu au cabinet ne répète pas son badge et ne propose pas de relire des paquets qu\'il ne reçoit pas', () => {
  // Du CSS, lu tel quel : la règle vit sur la classe, pour toutes les pastilles des deux applications.
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/^\.badge \{[^}]*white-space: nowrap/m.test(css), '« en attente » repasse sur deux lignes dans sa pastille');
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(!/dossier\.manual \? 'pas encore sur SkanFact'/.test(app), 'la phrase d\'état répète le badge du titre');
  assert.ok(/\(dossier\.packs \|\| \[\]\)\.length \? `<span class="nw"><button class="btn btn-sm" id="lv-relire2"/.test(app),
    '« Relire les paquets reçus » s\'offre à un dossier qui n\'en reçoit aucun');
});

t('Un dossier tenu AU CABINET ne se voit jamais relancer : ses mois vides sont une saisie à faire (règle 6.8.0, vu au test humain)', () => {
  // Le bandeau des mois sans écriture proposait « Relancer le client pour ces mois » au garage de
  // l'exemple — un client qui n'est pas sur SkanFact, à qui l'on ne réclame jamais rien. Son geste,
  // c'est la saisie.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const dl = tranche(app, 'function drawLivres(');
  assert.ok(dl.length > 4000 && dl.length < 30000, 'tranche drawLivres suspecte : ' + dl.length);
  assert.ok(/const tenuAuCabinet = !!dossier\.manual && source === 'livre';/.test(dl), 'le bandeau ne sait plus qu\'un dossier est tenu au cabinet');
  const geste = (/const relancerManquants = [\s\S]*?;\n/.exec(dl) || [''])[0];
  assert.ok(/tenuAuCabinet\s*\?\s*'[^']*id="lv-saisir"[^']*'\s*:\s*'[^']*id="lv-relancer"/.test(geste),
    'un dossier tenu au cabinet se voit proposer « Relancer le client »');
  assert.ok(/tenuAuCabinet\s*\?\s*`Aucune écriture sur \$\{K\.missingLabel\(manquants\)\}[^`]*à saisir\.`/.test(dl),
    'le bandeau d\'un dossier tenu au cabinet parle encore d\'un livre « incomplet » à réclamer');
  assert.ok(/const sm = \$\('#lv-saisir', el\);\s*if \(sm\) sm\.onclick = \(\) => allerSousOnglet\(root, dossier, 'saisie'\);/.test(dl),
    '« Ouvrir la saisie » n\'ouvre pas la saisie');
  // Et la relance n'est posée QUE par ce bouton : aucun autre chemin du livre ne relance un dossier.
  assert.strictEqual((dl.match(/id="lv-relancer"/g) || []).length, 1, 'un second bouton de relance est apparu dans le livre');
});

t('Un dossier TENU AU CABINET montre ses mois : ceux de son livre, jamais « hors mission » ni « pas reçu » (vu au test humain)', () => {
  // Le garage de l'exemple — sept déclarations déposées et payées — était « hors mission » sur toute
  // sa ligne de la Production, et son Suivi l'invitait à « commencer à attendre ses mois ».
  const garage = { id: 'G', name: 'Garage', matricule: 'G', manual: true, packs: [] };
  const index = { exercices: [{ annee: 2026, du: '2026-01-01', au: '2026-12-31', production: {
    '2026-01': { ecritures: 9, validees: 9, brouillards: 0, declare: true },
    '2026-02': { ecritures: 5, validees: 5, brouillards: 0 }
  } }] };
  const mois = C.productionDuDossier(garage, index, '2026-04-10', 10);
  // Du premier mois de l'exercice à celui qui vient de finir : avril, le mois en cours, n'est pas dû.
  assert.deepStrictEqual(mois.map(m => m.mois), ['2026-01', '2026-02', '2026-03'], 'les mois d\'un dossier tenu ne viennent pas de son livre');
  assert.deepStrictEqual(mois.map(m => m.etape), ['fini', 'revise', 'saisi'], 'la chaîne d\'un dossier tenu est fausse');
  // « Pas reçu » ne se dit pas d'un client à qui l'on ne réclame rien : null, jamais false (9.6.0).
  assert.ok(mois.every(m => m.recu === null), 'un dossier tenu se voit attribuer un « reçu »');
  // Sans livre, rien à tenir : pas de mois inventés.
  assert.deepStrictEqual(C.productionDuDossier(garage, { exercices: [] }, '2026-04-10', 10), []);
  // Un dossier SUR SkanFact ne prend pas ses mois dans son livre : on ne lui compte pas en retard
  // des mois qu'on ne lui a jamais réclamés.
  const client = { ...garage, manual: false, packs: [{ month: '2026-03', definitive: true }] };
  assert.deepStrictEqual(C.productionDuDossier(client, index, '2026-04-10', 10).map(m => m.mois), ['2026-03'],
    'un dossier sur SkanFact prend ses mois dans son livre');
  // Le tableau entier compte la saisie à faire du dossier tenu, sans lui compter aucun « reçu ».
  const lignes = C.production(C.migrate({ dossiers: [garage] }), { G: index }, { today: '2026-04-10' });
  assert.strictEqual(lignes[0].aSaisir, 1, 'la saisie à faire d\'un dossier tenu ne compte pas');
  assert.strictEqual(lignes[0].recus, 0);

  const app = code('src', 'cabinet', 'renderer', 'app.js');
  // La Production le DIT : « tenu au cabinet » dans la bulle d'un mois, et une phrase qui compte ce
  // que la colonne compte — « reçus et pas encore saisis » ne se dit pas d'un dossier tenu.
  assert.ok(/c\.recu === null \? 'tenu au cabinet'/.test(app), 'la bulle d\'un mois tenu dit « pas reçu »');
  const prod = tranche(app, 'async function drawProduction(');
  assert.ok(!/sont reçus et pas encore saisis|est reçu et pas encore saisi/.test(prod), 'le bandeau de production compte les mois tenus comme « reçus »');
  // Le Suivi lit la MÊME fonction que la Production, et chaque mois porte son geste.
  const tenus = tranche(app, 'async function dessinerMoisTenus(');
  assert.ok(tenus.length > 1500 && tenus.length < 6000, 'tranche dessinerMoisTenus suspecte : ' + tenus.length);
  assert.ok(/K\.productionDuDossier\(dossier, index,/.test(tenus), 'le Suivi d\'un dossier tenu ne lit pas la fonction de la Production');
  assert.ok(/zone\.dataset\.id !== dossier\.id/.test(tenus), 'la zone n\'est pas redemandée après la lecture (7.6.0)');
  assert.ok(/ouvrirMoisTenu\(dossier, b\.dataset\.tenu, b\.dataset\.etape\)/.test(tenus), 'un mois tenu ne mène nulle part');
  const ouvrir = tranche(app, 'function ouvrirMoisTenu(');
  assert.ok(/etape === 'saisi' \? 'saisie' : 'declaration'/.test(ouvrir) && /declState\.mois = mois/.test(ouvrir) && /livresState\.annee = mois\.slice\(0, 4\)/.test(ouvrir),
    'un mois tenu n\'ouvre pas la saisie ou la déclaration de CE mois, sur SON exercice');
  const fiche = tranche(app, 'function drawDossier(');
  assert.ok(/if \(dossier\.manual\) dessinerMoisTenus\(dossier\);/.test(fiche), 'la fiche d\'un dossier tenu ne dessine pas ses mois');
  assert.ok(!/commencer à attendre ses mois/.test(fiche), 'la fiche invite encore à « attendre » les mois d\'un client qui n\'envoie rien');
  // L'exemple a six dossiers : « les quatre situations », écrit à l'époque des quatre, était une
  // phrase que rien ne tenait plus (7.3.0). Un compte écrit à la main se périme au dossier suivant.
  assert.ok(!/\b(deux|trois|quatre|cinq|six|sept|huit) situations\b/.test(app), 'l\'écran annonce un nombre de situations écrit à la main');
  assert.ok(/client hors SkanFact dont tu tiens toute la comptabilité/.test(app), 'le premier écran ne dit plus ce que montre le dossier tenu au cabinet');
});

t('Un dossier TENU AU CABINET entre dans les échéances : son mois vide se SAISIT, il ne se relance pas (vu au test humain)', () => {
  // Le calendrier comptait « sur 5 clients » un portefeuille de six : le garage de l'exemple, dont le
  // cabinet dépose lui-même la TVA, n'y figurait jamais.
  const garage = { id: 'G', name: 'Garage', matricule: 'G', manual: true, packs: [], tvaPeriod: 'mensuelle' };
  const S = C.migrate({ settings: { relanceDay: 10 }, dossiers: [garage] });
  const tenus = { G: { exercices: [{ annee: 2026, du: '2026-01-01', au: '2026-12-31', production: {
    '2026-07': { ecritures: 12, validees: 12, brouillards: 0, declare: true } } }] } };
  // Sans le résumé des livres, le calendrier ne sait rien de lui : c'est l'état d'avant.
  assert.ok(!C.echeances(S, '2026-09-20', {}).some(e => e.label === 'TVA d\'août 2026'), 'le décor du test est faux');
  const ech = C.echeances(S, '2026-09-20', { tenus });
  const aout = ech.find(e => e.label === 'TVA d\'août 2026');
  assert.ok(aout, 'la TVA d\'août d\'un dossier tenu au cabinet n\'est pas au calendrier');
  assert.deepStrictEqual(aout.aSaisir, ['Garage'], 'un mois tenu sans écriture n\'est pas « à saisir »');
  assert.deepStrictEqual(aout.aSaisirIds, ['G'], 'le geste ne sait pas quel dossier ouvrir');
  assert.deepStrictEqual(aout.manquants, [], 'un dossier tenu au cabinet se voit RELANCER');
  assert.strictEqual(aout.prets, 0);
  assert.strictEqual(aout.level, 'danger', 'une échéance à huit jours dont le mois reste à saisir ne crie pas');
  const juillet = ech.find(e => e.label === 'TVA de juillet 2026');
  assert.ok(juillet && juillet.prets === 1 && !juillet.aSaisir.length, 'un mois tenu déjà saisi n\'est pas « prêt »');
  // « À faire » le dit dans ses mots — pas « n'a pas envoyé » —, et sa date en lettres.
  const ligne = C.cabinetTodo(S, '2026-09-20', { tenus }).find(x => x.id === 'echeance');
  assert.ok(ligne, '« À faire » ne remonte pas l\'échéance d\'un mois tenu encore à saisir');
  assert.ok(/1 client tenu au cabinet est encore à saisir/.test(ligne.label) && !/envoyé/.test(ligne.label), 'la ligne parle d\'envoi pour un client qui n\'envoie rien : ' + ligne.label);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(ligne.detail), 'la date de la ligne est au format machine : ' + ligne.detail);
  // L'accord suit les clients : deux clients n'ont pas envoyé LEUR mois, jamais « son mois ».
  const deux = C.migrate({ settings: { relanceDay: 10 }, dossiers: ['A', 'B'].map(id => ({ id, name: id, matricule: id, from: '2026-07', tvaPeriod: 'mensuelle', packs: [{ month: '2026-07', definitive: true }] })) });
  const l2 = C.cabinetTodo(deux, '2026-09-20', {}).find(x => x.id === 'echeance');
  assert.ok(l2 && /2 clients n'ont pas envoyé leur mois/.test(l2.label), 'l\'accord ne suit pas les clients : ' + (l2 && l2.label));
  // Et « 1 dossier… Leur mois », « leur paquet » se lisaient dans « À faire » de l'exemple, qui a UN
  // dossier provisoire et UN dossier aux pièces signalées.
  const exemple = C.migrate({ settings: { relanceDay: 10 }, dossiers: C.demoDossiers('2026-09-23') });
  const todoEx = C.cabinetTodo(exemple, '2026-09-23', {});
  const prov = todoEx.find(x => x.id === 'provisoires'), pieces = todoEx.find(x => x.id === 'pieces');
  assert.ok(prov && /^1 dossier/.test(prov.label) && /^Son mois/.test(prov.detail), 'un seul dossier provisoire : « Leur mois » — ' + (prov && prov.detail));
  assert.ok(pieces && /^1 dossier/.test(pieces.label) && /de son paquet/.test(pieces.detail), 'un seul dossier aux pièces signalées : « leur paquet » — ' + (pieces && pieces.detail));
  // L'écran : le mois à saisir porte son geste, jamais celui de la relance.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const carte = tranche(app, 'function drawEcheances(');
  assert.ok(/data-saisir-tenu=/.test(carte) && /data-vers-production=/.test(carte), 'un mois tenu à saisir n\'a pas de geste sur la carte');
  assert.ok(/tenus: tenusConnus\(\)/.test(carte), 'la page Échéances ne reçoit pas les livres des dossiers tenus');
  assert.ok(/tenus: tenusConnus\(\)/.test(tranche(app, 'function drawDossiers(')), '« À faire » ne reçoit pas les livres des dossiers tenus');
  // Et le résumé se relit en ENTRANT sur ces pages : lu une fois au démarrage, il se périmait.
  assert.ok(/route !== routeLue && \(route === 'echeances' \|\| route === 'dossiers'\)\) chargerQuestionsAttente\(true\)/.test(tranche(app, 'function render(')),
    'le résumé des livres n\'est relu qu\'au démarrage');
});

t('La recherche du livre-journal garde la frappe, le curseur, et des PIÈCES entières (vu au test humain)', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  // (1) Le curseur : « PAIE-2026-08 » tapé devenait « P ». La parade, exécutée sur un faux document :
  // le champ neuf reprend le focus ET la sélection d'avant, pas le bout du champ.
  let actif = null;
  const neuf = { id: 'lv-q', focus() { actif = neuf; }, setSelectionRange(a, b) { neuf.sel = [a, b]; } };
  const doc = { getElementById: id => (id === 'lv-q' ? neuf : null), get activeElement() { return actif; } };
  const garder = evaluer(tranche(app, 'function sansPerdreLaFrappe('), { document: doc });
  let dessins = 0;
  garder({ id: 'lv-q', selectionStart: 3, selectionEnd: 5 }, () => { dessins++; });
  assert.strictEqual(dessins, 1, 'la recherche ne redessine plus');
  assert.strictEqual(actif, neuf, 'le champ redessiné ne reprend pas le curseur : on n\'y tape qu\'une lettre');
  assert.deepStrictEqual(neuf.sel, [3, 5], 'le curseur repart au bout du champ au lieu de rester à sa place');
  // Les trois champs qui se redessinent à la frappe passent par elle — celui du livre-journal l'avait oubliée.
  assert.ok(/s\.q = q\.value; s\.page = 1; sansPerdreLaFrappe\(q, redraw\)/.test(app), 'la recherche du livre-journal perd encore la frappe');
  assert.ok(/rechState\.q = q\.value; sansPerdreLaFrappe\(q,/.test(app), 'la Recherche a perdu sa parade');
  assert.ok(/listState\.q = q\.value; listState\.page = 1; sansPerdreLaFrappe\(q, render\)/.test(app), 'la recherche des Dossiers a perdu sa parade');
  // Et aucun AUTRE champ ne redessine son écran à la frappe sans elle.
  [...app.matchAll(/\.oninput = \(\) => \{([^\n]*)\};/g)].forEach(m => {
    if (/\b(render|redraw|drawLivres)\(/.test(m[1])) assert.ok(/sansPerdreLaFrappe\(/.test(m[1]), 'un champ redessine son écran à la frappe sans rendre le curseur : ' + m[0]);
  });
  // (2) Le filtre : une pièce dont UNE ligne correspond sort ENTIÈRE. Le vrai code du filtre, exécuté.
  const vj = tranche(app, 'function vueJournal(');
  const i = vj.indexOf('const duJournal'), j = vj.indexOf('const lj = ');
  assert.ok(i > 0 && j > i, 'le filtre du livre-journal est introuvable');
  const filtre = evaluer(`function (lignes, s, q, KC) { ${vj.slice(i, j)} return gardees; }`, {});
  const L = [
    { journal: 'AC', piece: 'LOY-08', date: '2026-08-01', account: '613', label: 'Loyer d\'août', tiers: '', debit: 800, credit: 0 },
    { journal: 'AC', piece: 'LOY-08', date: '2026-08-01', account: '401', label: 'Agence Le Lac', tiers: 'Le Lac', debit: 0, credit: 800 },
    { journal: 'VT', piece: 'REC-08', date: '2026-08-31', account: '532', label: 'Recettes', tiers: '', debit: 100, credit: 0 },
    { journal: 'VT', piece: 'REC-08', date: '2026-08-31', account: '706', label: 'Réparations', tiers: '', debit: 0, credit: 100 }
  ];
  const g = filtre(L, { journal: '' }, 'loyer', KC);
  assert.deepStrictEqual(g.map(l => l.account), ['613', '401'], 'la pièce trouvée sort coupée, ou une autre pièce la suit');
  assert.strictEqual(KC.journalDepuisLignes(g).off.length, 0, 'une pièce juste est annoncée déséquilibrée par le filtre');
  assert.strictEqual(filtre(L, { journal: 'VT' }, '', KC).length, 2, 'le filtre par journal ne garde plus son journal');
});

t('Un message du Cabinet écrit ses dates comme l\'écran, et accorde ce qu\'il compte — la validation d\'un lot, la fusion de deux livres (vu en relisant)', () => {
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  // Aucune date interpolée BRUTE après « du », « le » ou « au » : « … du 2026-08-31 » se lisait dans
  // le compte rendu d'un lot et dans celui de la fusion des deux livres (U-28, jamais porté ici).
  const bruts = [...app.matchAll(/\b(?:du|le|au) \$\{[a-zA-Z_.]*\bdate\}/g)].map(m => m[0]);
  assert.deepStrictEqual(bruts, [], 'une date part au format machine dans une phrase : ' + bruts.join(' | '));
  assert.ok((app.match(/du \$\{fmtJour\(x\.date\)\}/g) || []).length >= 4, 'le décor du test est faux : les quatre messages corrigés ont disparu');
  // L'accord suit le nombre : « Valider 1 écriture » ne dit pas « Chacune… Celles qui… », et « 1
  // écriture n'est pas entrée » ne dit pas « elles restent en brouillard ».
  const lot = tranche(app, 'async function validerUnLot(');
  assert.ok(/const une = cibles\.length === 1;/.test(lot) && /'<p>Elle prend son numéro/.test(lot) && /'<p>Chacune prend son numéro/.test(lot),
    'la question de la validation d\'un lot ne s\'accorde plus au nombre de pièces');
  assert.ok(/\$\{plus \? 'elles restent' : 'elle reste'\} en brouillard/.test(lot), 'une seule pièce refusée « restent en brouillard »');
});

t('Le bandeau des paquets provisoires s\'accorde à son compte — « 1 paquet… Son mois… Il est exporté » (vu au test humain, page Écritures)', () => {
  // L'exemple en a UN (Studio Sfax Design, août) : l'écran disait « 1 paquet n'est pas définitif … Leur
  // mois n'a pas été clôturé … Ils sont quand même exportés ». Le verbe s'accordait, pas la phrase suivante.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const de = tranche(app, 'function drawEcritures(');
  assert.ok(de.length > 2000 && de.length < 20000, 'tranche drawEcritures suspecte : ' + de.length);
  const i = de.indexOf("info('e.provisoire')");
  assert.ok(i > 0, 'le bandeau des provisoires est introuvable');
  const bandeau = de.slice(i, de.indexOf('</div>', i));
  assert.ok(/const provPlus = plan\.provisoires\.length > 1;/.test(de), 'l\'accord ne suit pas le compte des provisoires');
  // Chaque pluriel n'existe QUE dans la branche « plusieurs » : écrit en dur, il se lirait sur un paquet seul.
  [['Leur mois', 'Son mois'], ['Ils sont quand même exportés', 'Il est quand même exporté']].forEach(([plur, sing]) => {
    assert.strictEqual(bandeau.split(plur).length - 1, 1, `« ${plur} » est écrit hors de sa branche : ${bandeau.replace(/\s+/g, ' ')}`);
    assert.ok(new RegExp(`provPlus \\? '${plur}[^']*(?:\\\\'[^']*)*' : '${sing}`).test(bandeau), `« ${plur} » n'a pas sa forme au singulier (« ${sing} »)`);
  });
});

t('Un AUTRE écran commence en haut : un changement d\'adresse remet la vue du Cabinet à zéro (le jumeau de l\'app entreprise, vu au test humain)', () => {
  // L'app entreprise remet `#view` en haut à chaque route (7.27.0) ; le Cabinet gardait la position
  // de l'écran quitté, et la Paie ouverte depuis une Saisie défilée arrivait à mi-page.
  const app = code('src', 'cabinet', 'renderer', 'app.js');
  const m = /window\.addEventListener\('hashchange', \(\) => \{([\s\S]*?)\n    \}\);/.exec(app);
  assert.ok(m, 'le changement d\'adresse ne passe plus par un gestionnaire qui remet la vue en haut');
  const corps = m[1];
  assert.ok(/vue\.scrollTop = 0/.test(corps) && corps.indexOf('vue.scrollTop = 0') < corps.indexOf('render()'),
    'la vue n\'est pas remise en haut AVANT le dessin du nouvel écran');
  assert.ok(!/window\.addEventListener\('hashchange', render\)/.test(app), 'un second gestionnaire redessine sans remettre la vue en haut');
  // Les sous-onglets de la comptabilité ne passent PAS par là : ils ont leur règle, sous la barre collante.
  assert.ok(/history\.pushState\(null, '', h\)/.test(tranche(app, 'function allerSousOnglet(')), 'les sous-onglets changent l\'adresse par hashchange : ils remonteraient au haut de la fiche');
});

t('Le geste qui DÉTRUIT vit tout en bas d\'un menu, après un trait, dans les DEUX applications (7.29.0, vu au test humain)', () => {
  // « Supprimer ce brouillard » était la ligne juste au-dessus de « Joindre un justificatif… » : un
  // clic qui glisse d'une ligne effaçait une pièce au lieu d'y joindre un scan. La règle datait de la
  // 7.29.0 et rien ne la tenait. Chaque action `danger: true` doit suivre un trait, et rien ne doit
  // venir après elle dans son menu.
  ['src/renderer/app.js', 'src/cabinet/renderer/app.js'].forEach(f => {
    const src = code(...f.split('/'));
    const places = [...src.matchAll(/danger: true/g)].map(m => m.index);
    assert.ok(places.length >= 2, `${f} : le décor du test est faux, aucune action destructive trouvée`);
    places.forEach(i => {
      const ligne = src.slice(0, i).split('\n').length;
      const avant = src.slice(Math.max(0, i - 420), i);
      assert.ok(/sep: true/.test(avant) || /detruire = \{[^\n]*$/.test(avant), `${f}:${ligne} : une action destructive sans trait au-dessus d'elle`);
    });
  });
  // Les actions d'une écriture : le brouillard se supprime EN DERNIER, après le justificatif.
  const cab = code('src', 'cabinet', 'renderer', 'app.js');
  const ae = tranche(cab, 'function actionsEcriture(');
  const iJust = ae.indexOf('Joindre un justificatif'), iFin = ae.indexOf('if (detruire) a.push({ sep: true }, detruire);');
  assert.ok(iJust > 0 && iFin > iJust && ae.indexOf('return a;') > iFin, 'la suppression d\'un brouillard n\'est plus le dernier geste de son menu');
});

t('Une fenêtre qui porte un FORMULAIRE garde sa saisie, dans les DEUX applications (vu au test humain)', () => {
  // Le Cabinet : cinq fenêtres posaient leur garde-fou à la main, sept formulaires du livre n'en
  // avaient aucun. La règle vit dans modal(), prise APRÈS le montage, et n'écrase pas celle d'une
  // fenêtre qui pose la sienne.
  const cab = code('src', 'cabinet', 'renderer', 'app.js');
  const mc = tranche(cab, 'function modal(');
  assert.ok(mc.length > 1500 && mc.length < 9000, 'tranche modal() suspecte : ' + mc.length);
  assert.ok(/const garde = \(opts && opts\.garde\) \|\| gardeAuto;/.test(mc), 'la question ne lit pas le garde-fou d\'office');
  const iMount = mc.indexOf('if (onMount) onMount(layer, close);'), iAuto = mc.indexOf("gardeAuto = suivreSaisie(layer)");
  assert.ok(iMount > 0 && iAuto > iMount, 'l\'instantané se prend avant le montage : ce que la fenêtre préremplit passerait pour une saisie');
  assert.ok(/!\(opts && 'garde' in opts\) && layer\.querySelector\('form'\)/.test(mc), 'le garde-fou d\'office ne vise pas les fenêtres à formulaire, ou écrase celui d\'une fenêtre');
  // Les sept formulaires du livre sont bien des <form> — sinon la règle ne les atteindrait pas.
  ['repriseForm', 'immoForm', 'salarieForm', 'bulletinForm', 'inventaireForm', 'ecrireDepuisBanque', 'releveForm'].forEach(f =>
    assert.ok(/<form id="/.test(tranche(cab, `function ${f}(`)), `${f} n'est plus un formulaire : le garde-fou d'office ne le voit pas`));
  // L'app entreprise : AUCUNE fenêtre n'avait de garde-fou. Le jumeau, et le même instantané, au caractère près.
  const ent = code('src', 'renderer', 'app.js');
  const me = tranche(ent, 'function modal(');
  assert.ok(/modalClose = dismiss;/.test(me) && /if \(e\.target === layer\) dismiss\(\)/.test(me) && /\$\$\('\[data-close\]', layer\)\.forEach\(b => b\.addEventListener\('click', dismiss\)\)/.test(me),
    'Échap, le clic à côté ou « Annuler » ferment encore sans demander');
  assert.ok(/!\(opts && opts\.garde === false\) && layer\.querySelector\('form'\)\) garde = suivreSaisie\(layer\)/.test(me), 'le garde-fou d\'office manque à l\'app entreprise');
  const corps = src => (/function suivreSaisie\(layer\) \{[\s\S]*?\n  \}/.exec(src) || [''])[0];
  assert.ok(corps(cab) && corps(cab) === corps(ent), 'les deux instantanés ne sont plus identiques : les deux applications ne répondraient pas la même chose');
  // Un mot de CONFIRMATION n'est pas un travail à protéger : renoncer à « Tout effacer » après avoir
  // tapé EFFACER ne demande pas « Abandonner cette saisie ? » (trouvé en relançant les parcours). Le
  // jumeau du Cabinet (`confirmTyped`) n'a pas de formulaire, donc pas de garde-fou d'office.
  const i = ent.indexOf('<form id="wf">');
  const efface = ent.slice(i, ent.indexOf('\n  };', i));
  assert.ok(i > 0 && efface.length > 400 && efface.length < 4000 && /Pour confirmer, écris <b>EFFACER<\/b>/.test(efface), 'la fenêtre « Tout effacer » est introuvable : ' + efface.length);
  assert.ok(/null, \{ garde: false \}\);/.test(efface), '« Tout effacer » demande d\'abandonner un simple mot de confirmation');
  assert.ok(!/<form/.test(tranche(cab, 'function confirmTyped(')), 'la confirmation recopiée du Cabinet est devenue un formulaire : elle demanderait d\'abandonner un mot');
});

t('Les deux instruments de rendu mesurent aussi la FENÊTRE ouverte (la sonde s\'arrêtait à #view)', () => {
  const harnais = code('test', 'e2e', 'harnais.js');
  assert.ok(/const FENETRE = '#modal-root/.test(harnais), 'la racine d\'une fenêtre doit être nommée dans le harnais');
  ['cabinet-rendu.js', 'contraste.js'].forEach(f => {
    const src = code('test', 'e2e', f);
    assert.ok(/SONDE_ESPACEMENT, \{ min: ECART_MIN, exceptions: SEGMENTS, racine: FENETRE \}/.test(src), f + ' ne mesure pas la fenêtre ouverte');
  });
  // Et l'app entreprise en OUVRE : une branche que rien ne déclenche ne mesure rien.
  assert.ok(/waitForSelector\(FENETRE/.test(code('test', 'e2e', 'contraste.js')), 'contraste.js n\'ouvre aucune fenêtre');
});

// Trouvé au test humain de l'app entreprise : le lanceur l'ouvrait par `src/main.js`, Electron ne
// trouvait pas le package.json, et `app.getVersion()` rendait SA version — « v44.4.1 » en bas de la
// barre latérale, et un écran des mises à jour qui comparait une version inexistante. Le test
// humain regardait une application qu'aucun client n'a. Le Cabinet, lui, lit sa version dans
// package.json (son en-tête le dit depuis la 6.6.0) — sauf à deux endroits : la demande de licence
// et l'annonce à la plateforme, qui portaient donc « 44.4.1 » en développement.
// Trouvé au même test humain, à 1440×900 : la barre latérale de l'app entreprise débordait d'UN
// pixel. En `overflow-y: auto`, ce pixel faisait paraître une barre de défilement de 10 px (Linux,
// Windows) ; « Facturation récurrente » perdait autant de large, passait sur deux lignes, et ces
// 14 px de plus entretenaient le débordement. Deux mises en page stables : on tombait sur l'une ou
// l'autre selon l'ordre du dessin. La décision se prend donc sur la mise en page SANS barre, et se
// reprend quand la fenêtre change de taille.
t('La barre latérale décide de défiler sur sa mise en page SANS barre de défilement', () => {
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/#nav:not\(\.deborde\) \{ overflow-y: hidden; \}/.test(css), 'la barre latérale défile encore pour un pixel');
  const ent = code('src', 'renderer', 'app.js');
  const ajuste = tranche(ent, 'function ajusterNav(');
  assert.ok(ajuste.length > 60 && ajuste.length < 600, 'tranche de ajusterNav : ' + ajuste.length);
  assert.ok(/classList\.remove\('deborde'\);\s*nav\.classList\.toggle\('deborde', nav\.scrollHeight > nav\.clientHeight \+ 1\)/.test(ajuste),
    'la mesure se fait avec la barre de défilement encore là : elle compte les libellés qu\'elle a elle-même fait passer à la ligne');
  assert.ok(/addEventListener\('resize', \(\) => \{ clearTimeout\(navTimer\); navTimer = setTimeout\(ajusterNav, \d+\); \}\)/.test(ent),
    'une fenêtre qu\'on rétrécit cacherait le bas de la liste sans rien pour la faire défiler');
  assert.ok(/nav\.innerHTML = html;\s*ajusterNav\(\);/.test(ent), 'le dessin de la barre ne la mesure plus');
});

// Trouvé au test humain de l'app entreprise, sur la fiche « Nouveau client » : la légende
// « * obligatoire » s'affichait en pied, et AUCUNE étoile dans la fenêtre. L'étoile est posée par
// `.field.obligatoire > span:first-child::after` : un libellé écrit en nœud texte nu ne la reçoit
// pas (piège déjà noté en 8.1.0). Neuf fenêtres étaient dans ce cas — client, fournisseur, salarié,
// affaire, modèle, texte, compte, opération —, c'est-à-dire la moitié de celles qui déclarent un champ
// obligatoire : une légende qui renvoie à une marque absente.
t('Un champ obligatoire MONTRE son étoile : son libellé est un élément, jamais un texte nu', () => {
  ['src/renderer/app.js', 'src/cabinet/renderer/app.js'].forEach(f => {
    const src = code(...f.split('/'));
    const champs = [...src.matchAll(/class="field[^"]*\bobligatoire\b[^"]*">\s*([\s\S]{0,12})/g)];
    assert.ok(champs.length >= 5, f + ' : les champs obligatoires ne sont plus trouvés (' + champs.length + ')');
    const nus = champs.filter(m => !/^(<span|\$\{lbl\()/.test(m[1])).map(m => m[0].slice(0, 70));
    assert.deepStrictEqual(nus, [], f + ' : un libellé nu ne porte pas l\'étoile que la légende annonce');
  });
  // Et `lbl(texte)` sans clé de bulle rend le texte NU : il ne compte pas comme un élément.
  const ent = code('src', 'renderer', 'app.js');
  const sansCle = [...ent.matchAll(/obligatoire[^"]*">\$\{lbl\('[^']*'\)\}/g)].map(m => m[0]);
  assert.deepStrictEqual(sansCle, [], 'lbl() sans clé rend un texte nu : ' + sansCle.join(' · '));
});

t('Le test humain ouvre l\'application que les clients ont : sa VRAIE version', () => {
  const lanceur = lireSource('scripts', 'humain', 'lancer.sh');
  assert.ok(/entreprise\) MAIN=\.;/.test(lanceur), 'l\'app entreprise doit se lancer par la racine du dépôt, comme `npm start`');
  assert.ok(/"\$RACINE\/\$MAIN"/.test(lanceur), 'le lanceur ne lance plus ce que MAIN désigne');
  const cab = code('src', 'cabinet', 'main.js');
  assert.ok(!/app\.getVersion\(\)/.test(cab), 'le Cabinet rend encore la version d\'Electron en développement');
  assert.ok(/const VERSION = PKG\.version;/.test(cab), 'le Cabinet ne lit plus sa version dans package.json');
});

// ---------------------------------------------------------------------------------------------
// L'éditeur de l'app entreprise, parcouru au test humain (10.12.0). Six défauts qu'aucun parcours
// ne voyait : ils vivaient dans l'ORDRE des gestes et dans ce que l'écran montre, pas dans un calcul.

// Enregistrer un devis NEUF laissait « ← le document » en bouton retour, et il menait à
// « #/doc/new/devis » — un devis VIERGE. La pile retenait la page de création comme une page où
// revenir. Même chose à l'émission, à l'export PDF, et pour un achat neuf.
t('Enregistrer une pièce NEUVE remplace sa page de création : le retour ne rouvre pas une pièce vierge', () => {
  const ent = code('src', 'renderer', 'app.js');
  const nus = [...ent.matchAll(/if \(isNew\) navigate\(/g)].length;
  assert.strictEqual(nus, 0, nus + ' navigation(s) après enregistrement empilent encore la page « …/new »');
  const remplace = [...ent.matchAll(/if \(isNew\) remplacerPage\('#\/(doc|achat)\/'/g)].map(m => m[1]);
  assert.ok(remplace.filter(x => x === 'doc').length >= 4 && remplace.includes('achat'),
    'enregistrer, émettre, exporter (document) et enregistrer (achat) : ' + remplace.join(','));
  // `remplacerPage` ne vaut que si `pushHistory` saute vraiment la page remplacée.
  const push = tranche(ent, 'function pushHistory(');
  assert.ok(push.length < 700, 'tranche de pushHistory : ' + push.length);
  assert.ok(/if \(remplacee && previous === remplacee\) return;/.test(push), 'pushHistory empile encore la page qu\'on vient de remplacer');
  assert.ok(/function remplacerPage\(hash\) \{ pageRemplacee = currentHash; navigate\(hash\); \}/.test(ent),
    'remplacerPage ne retient plus la page à remplacer : ce ne serait qu\'un navigate');
});

// Une bulle « i » posée À L'INTÉRIEUR d'un bouton fait un bouton dans un bouton, qui n'existe pas
// en HTML : le navigateur ferme le premier au second. Dans le menu « Facturer ▾ », chaque bulle
// tombait seule sur la ligne suivante ; celle de « Lire une photo… » restait affichée alors que
// le bouton est caché (la lecture est en pause). Huit dans l'app entreprise, une dans le Cabinet.
t('Aucun bouton n\'en contient un autre : une bulle « i » vit À CÔTÉ du bouton qu\'elle explique', () => {
  const fautes = [];
  ['src/renderer/app.js', 'src/cabinet/renderer/app.js', 'src/renderer/rowmenu.js', 'src/renderer/reglages.js', 'src/renderer/majui.js'].forEach(f => {
    const src = code(...f.split('/')).replace(/<!--[\s\S]*?-->/g, '');
    const re = /<button\b/g; let m, vus = 0;
    while ((m = re.exec(src))) {
      // Fin de la balise ouvrante : le premier « > » hors des ${…} (un attribut calculé en porte).
      let i = m.index + 7, prof = 0;
      for (; i < src.length; i++) {
        const c = src[i];
        if (c === '$' && src[i + 1] === '{') { prof++; i++; continue; }
        if (prof && c === '{') prof++;
        else if (prof && c === '}') prof--;
        else if (!prof && c === '>') break;
      }
      const fin = src.indexOf('</button>', i);
      if (fin < 0) continue;
      vus++;
      const corps = src.slice(i + 1, fin);
      if (/<button\b|\$\{info\(|\blbl\([^)]*,\s*'/.test(corps)) fautes.push(f + ' : ' + src.slice(m.index, fin + 9).replace(/\s+/g, ' ').slice(0, 120));
    }
    if (/app\.js$/.test(f)) assert.ok(vus > 100, f + ' : les boutons ne sont plus trouvés (' + vus + ')');
  });
  assert.deepStrictEqual(fautes, [], 'un bouton en contient un autre');
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.btn\[hidden\] \+ button\.i \{ display: none; \}/.test(css), 'la bulle d\'un bouton caché reste affichée');
  assert.ok(/\.more-list \.ml-ligne \{ display: flex;/.test(css), 'une entrée de menu et sa bulle ne tiennent plus sur une ligne');
});

// Choisir un client faisait apparaître « Fiche du client » SOUS le champ : tout le formulaire
// descendait de 45 px, et le clic visé sur « Objet » tombait dans le vide — la frappe avec. Ce qui
// apparaît selon une valeur vit dans la ligne du libellé, où il ne déplace rien.
t('Choisir un client ne déplace aucun champ : le lien vers sa fiche vit dans la ligne du libellé', () => {
  const ent = code('src', 'renderer', 'app.js');
  const i = ent.indexOf('id="cl-edit"');
  assert.ok(i > 0, 'le lien vers la fiche du client a disparu');
  const ligne = ent.slice(ent.lastIndexOf('<span class="fl-ligne">', i), i);
  assert.ok(ligne.length > 0 && ligne.length < 120 && !/<\/span>\s*<\/span>|combo\(/.test(ligne.replace(/\$\{lbl\([^}]*\}/, '')),
    'le lien n\'est plus dans la ligne du libellé : ' + ligne.slice(0, 120));
  const apres = ent.slice(i, i + 600);
  assert.ok(apres.indexOf('</span>') < apres.indexOf("combo({ name: 'clientId'"), 'le lien doit précéder le champ, dans son libellé');
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.lien-fl \{[^}]*color: var\(--primary\);[^}]*text-decoration: underline;/.test(css),
    'un lien qui ne se souligne ni ne se colore au repos ne se reconnaît pas (9.4.2)');
});

// À côté de l'aperçu, la désignation d'une ligne avait 98 px à 1440 et 84 px à 1280 — la colonne la
// plus importante de la pièce était celle qui cédait —, et le prix 45 px. Chaque ligne devient une
// grille qui se range selon la largeur de son CADRE. Et parce que chaque ligne est SA grille, une
// colonne « auto » y vaudrait la largeur de son propre contenu : 126 px dans une ligne, 0 dans
// l'en-tête — tous les titres se décalaient d'une colonne (vu à l'écran, pas à la relecture).
t('La grille des lignes d\'un document : la désignation a sa place, et aucune colonne ne se règle ligne par ligne', () => {
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.lignes-cadre \{ container-type: inline-size; \}/.test(css), 'la grille ne se règle plus sur la largeur de son cadre');
  const gabarits = [...css.matchAll(/table\.lignes-doc tr \{[^}]*grid-template-columns:([^;]+);/g)].map(m => m[1].trim());
  assert.strictEqual(gabarits.length, 2, 'deux dispositions attendues (étroite, large) : ' + gabarits.length);
  gabarits.forEach(g => assert.ok(!/\bauto\b/.test(g), 'colonne « auto » : elle vaudrait 0 dans l\'en-tête et décalerait tous les titres — ' + g));
  assert.ok(/grid-template-areas: "lab lab lab lab lab outils" "qte unite pu tva total total"/.test(css),
    'à côté de l\'aperçu, la désignation ne prend plus toute la largeur');
  assert.ok(/@container \(min-width: \d+px\) \{\s*table\.lignes-doc tr \{/.test(css), 'la disposition large ne dépend plus de la place du cadre');
  const ent = code('src', 'renderer', 'app.js');
  assert.ok(/<div class="lignes-cadre"><table class="lines-edit lignes-doc">/.test(ent), 'l\'éditeur de document ne pose plus la grille');
});

// Un devis enregistré et inchangé gardait « Enregistrer » en vert : il disait qu'il restait quelque
// chose à enregistrer, quand l'étape suivante est de l'ENVOYER (la règle U-11 du Cabinet).
t('Une pièce enregistrée a UN bouton principal, l\'étape suivante ; « Enregistrer » le redevient dès qu\'on modifie', () => {
  const ent = code('src', 'renderer', 'app.js');
  assert.ok(/<button class="btn \$\{isNew && \(isQ \|\| isExtra\) \? 'btn-primary' : ''\}" id="save">/.test(ent),
    '« Enregistrer » reste principal sur une pièce déjà enregistrée et inchangée');
  assert.ok(/<button class="btn \$\{envoiSuivant \? 'btn-primary' : ''\}" id="email">/.test(ent), 'l\'envoi n\'est plus l\'étape suivante d\'un devis enregistré');
  assert.ok(/const envoiSuivant = !isNew && !locked && !devisFacturable && doc\.status === 'brouillon'/.test(ent),
    'l\'envoi ne peut être principal ni sur une pièce neuve, ni sur un devis déjà facturable');
  const touch = ent.slice(ent.indexOf('function touch() {'), ent.indexOf('function untouch('));
  assert.ok(touch.length > 50 && touch.length < 900, 'tranche de touch : ' + touch.length);
  // Retourné vers la RÈGLE (10.12.0, H-E19) : l'assertion recopiait les deux lignes de touch() et
  // serait tombée sur le correctif. On JOUE touch() sur des en-têtes réels et on compte les verts.
  const verts = entete => {
    const btns = entete.map(([id, vert]) => { const cls = new Set(vert ? ['btn-primary'] : []);
      return { id, cls, classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) } }; });
    const ctx = { dirty: false, locked: false, reportDirty: () => {},
      $: sel => sel === '#dirty-dot' ? { hidden: true } : (btns.find(b => '#' + b.id === sel) || null),
      $$: () => btns.filter(b => b.cls.has('btn-primary')) };
    require('vm').runInNewContext(aide + '\n' + touch + '\ntouch();', ctx);
    return btns.filter(b => b.cls.has('btn-primary')).map(b => b.id);
  };
  // La règle vit dans UNE fonction que les deux éditeurs appellent (H-E21) : on la joue avec touch().
  const aide = (/\n  (function enregistrerDevientPrincipal\(\) \{[\s\S]*?\n  \})\n/.exec(ent) || [])[1];
  assert.ok(aide, 'la règle « Enregistrer devient principal » n\'est plus une fonction partagée');
  assert.deepStrictEqual(verts([['email', true], ['pdf', false], ['save', false]]), ['save'],
    'modifier un devis enregistré doit rendre « Enregistrer » principal ET éteindre l\'envoi — deux principaux n\'en font aucun');
  assert.deepStrictEqual(verts([['convert', true], ['save', false]]), ['save'],
    'un devis modifié garde « Facturer ce devis » en vert à côté d\'« Enregistrer »');
  assert.deepStrictEqual(verts([['pdf', false], ['save', false], ['issue', true]]), ['issue'],
    'le premier geste sur une facture allume « Enregistrer le brouillon » à côté d\'« Émettre » : deux verts (H-E19)');
  assert.deepStrictEqual(verts([['save', true]]), ['save'], 'une pièce neuve perd son seul vert');
});

// On tape « Location salle de réunion », un libellé libre que le catalogue ignore : une liste d'une
// seule ligne, « + Créer … au catalogue », se posait EXACTEMENT sur la rangée quantité / prix, et le
// clic suivant, visé sur le prix, ouvrait une fiche de prestation (vu au test humain). « Créer » ne
// s'offre seul que si la liste est DEMANDÉE ; il reste en bout de liste quand elle a de quoi s'ouvrir.
t('H-E20 : « Créer … au catalogue » ne se pose seul sous une désignation que si la liste est DEMANDÉE', () => {
  const ent = code('src', 'renderer', 'app.js');
  const sa = /const sansAccents = (s => [^\n]+);/.exec(ent);
  const f = /\n  (function propositionsCatalogue\([\s\S]*?\n  \})\n/.exec(ent);
  assert.ok(sa && f, 'la décision de la liste n\'est plus trouvée');
  const prop = require('vm').runInNewContext('(' + f[1] + ')', { sansAccents: evaluer(sa[1]) });
  const cat = [{ label: 'Mémoire 16 Go' }, { label: 'Location vidéoprojecteur' }];
  let p = prop(cat, 'Location salle de réunion', true, false);
  assert.strictEqual(p.shown.length, 0);
  assert.strictEqual(p.creer, false, 'pendant la frappe, une ligne « Créer … » seule se pose sous la rangée quantité / prix');
  assert.strictEqual(prop(cat, 'Location salle de réunion', true, true).creer, true, 'la liste DEMANDÉE ne propose plus de créer l\'article');
  p = prop(cat, 'location', true, false);
  assert.strictEqual(p.shown.length, 1, 'la recherche ne trouve plus l\'article qui correspond');
  assert.strictEqual(p.creer, true, 'avec des correspondances, « Créer » ne reste plus en bout de liste');
  assert.strictEqual(prop(cat, 'memoire 16go', true, false).shown.length, 1, 'accents ou espaces : la recherche ne trouve plus (9.2.1)');
  assert.strictEqual(prop(cat, 'mémoire 16 go', true, true).creer, false, 'un libellé déjà au catalogue propose de se recréer');
  assert.strictEqual(prop(cat, 'Location salle', false, true).creer, false, 'une liste sans création en propose une');
  assert.ok(/addEventListener\('input', \(\) => \{[^}]*demandee = false;/.test(ent), 'la frappe ne remet plus la demande à zéro : « Créer » resterait posé sous le prix');
});

// Un achat qu'on venait d'enregistrer gardait « Enregistrer » en vert, et son panneau portait un
// second vert, « + Enregistrer un règlement » : deux principaux dont aucun n'était l'étape suivante
// — la règle H-E5 des documents n'avait jamais été portée à l'éditeur d'achat (vu au test humain).
t('H-E21 : un achat enregistré a UN bouton principal, le règlement ; « Enregistrer » le redevient dès qu\'on modifie', () => {
  const ent = code('src', 'renderer', 'app.js');
  const i = ent.indexOf("id=\"attach-top\">Joindre un justificatif…</button>");
  assert.ok(i > 0, 'l\'en-tête de l\'éditeur d\'achat n\'est plus trouvé');
  const tete = ent.slice(i - 400, i + 500);
  assert.ok(/<button class="btn \$\{isNew \? 'btn-primary' : ''\}" id="save">Enregistrer<\/button>/.test(tete),
    '« Enregistrer » reste vert sur un achat déjà enregistré et inchangé');
  assert.ok(/<button class="btn btn-primary" id="pay">Enregistrer un règlement<\/button>/.test(tete), 'le règlement n\'est plus l\'étape suivante d\'un achat dû');
  assert.ok(/<button class="btn \$\{\$\('#pay'\) \? '' : 'btn-primary'\}" id="pay2">\+ Enregistrer un règlement<\/button>/.test(ent),
    'le panneau des règlements pose un second vert à côté de celui de l\'en-tête');
  // Et modifier la pièce rend « Enregistrer » principal : on JOUE le touch() de l'éditeur d'achat.
  const aide = (/\n  (function enregistrerDevientPrincipal\(\) \{[\s\S]*?\n  \})\n/.exec(ent) || [])[1];
  const touch = (/const touch = (\(\) => \{ if \(dirty\) return;[^\n]*\});/.exec(ent) || [])[1];
  assert.ok(aide && touch, 'le touch() de l\'éditeur d\'achat n\'est plus trouvé');
  const btns = [['pay', true], ['attach-top', false], ['save', false]].map(([id, vert]) => { const cls = new Set(vert ? ['btn-primary'] : []);
    return { id, cls, classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) } }; });
  const ctx = { dirty: false, reportDirty: () => {},
    $: sel => sel === '#dirty-dot' ? { hidden: true } : (btns.find(b => '#' + b.id === sel) || null),
    $$: () => btns.filter(b => b.cls.has('btn-primary')) };
  require('vm').runInNewContext(aide + '\nvar touch = ' + touch + ';\ntouch();', ctx);
  assert.deepStrictEqual(btns.filter(b => b.cls.has('btn-primary')).map(b => b.id), ['save'],
    'modifier un achat enregistré ne rend pas « Enregistrer » principal, ou laisse le règlement vert à côté');
});

// La liste des fournisseurs d'une entreprise neuve disait « Aucun résultat » sous un champ où l'on
// n'avait rien tapé : on cherche alors ce qu'on a mal écrit. Une liste VIDE le dit (vu au test humain).
t('H-E22 : une liste déroulante vide dit qu\'elle est vide, pas qu\'une recherche a échoué', () => {
  const ent = code('src', 'renderer', 'app.js');
  assert.ok(/<div class="combo-empty">\$\{el\._items\.length \? 'Aucun résultat' : h\(o\.vide \|\| /.test(ent),
    'la liste vide et la recherche sans réponse disent la même chose');
  assert.ok(/placeholder: '— Choisir un client —', vide: 'Aucun client pour l\\'instant'/.test(ent), 'l\'éditeur de document ne nomme plus sa liste vide');
  assert.ok(/placeholder: '— Choisir un fournisseur —', vide: 'Aucun fournisseur pour l\\'instant'/.test(ent), 'l\'éditeur d\'achat ne nomme plus sa liste vide');
});

// Une facture neuve imprimait « À régler avant le 23/10/2026 » ET « Paiement par virement bancaire à
// réception de la facture » : deux délais sur une pièce légale, et c'était NOTRE défaut (vu au test
// humain, dans l'aperçu). La phrase de l'utilisateur ne se réécrit jamais — elle se MONTRE à l'émission.
t('H-E23 : une facture ne porte pas deux délais qui se contredisent', () => {
  const Core = require('../../src/renderer/core.js');
  assert.ok(!/r[ée]ception/i.test(Core.DEFAULT_COMPANY.paymentTerms), 'le défaut des conditions de paiement dit encore « à réception »');
  assert.ok(!/receipt/i.test(Core.DEFAULT_COMPANY.paymentTermsEn), 'le défaut anglais dit encore « upon receipt »');
  const doc = { type: 'facture', date: '2026-09-23', dueDate: '2026-10-23', lang: 'fr' };
  const ancien = 'Paiement par virement bancaire à réception de la facture.';
  assert.strictEqual(Core.delaisContradictoires({ paymentTerms: ancien }, doc), ancien, 'la contradiction n\'est plus vue');
  assert.strictEqual(Core.delaisContradictoires({ paymentTerms: 'Paiement par virement bancaire.' }, doc), '', 'une phrase sans délai est accusée');
  assert.strictEqual(Core.delaisContradictoires({ paymentTerms: ancien }, Object.assign({}, doc, { dueDate: doc.date })), '',
    'une facture payable le jour même contredit « à réception »');
  assert.ok(Core.delaisContradictoires({ paymentTermsEn: 'Payment upon receipt of invoice.' }, Object.assign({}, doc, { lang: 'en' })), 'la phrase anglaise n\'est pas lue');
  assert.strictEqual(Core.delaisContradictoires({ paymentTerms: ancien }, Object.assign({}, doc, { type: 'devis' })), '', 'un devis n\'a pas d\'échéance de paiement');
  const ent = code('src', 'renderer', 'app.js');
  const iw = ent.slice(ent.indexOf('function issueWarnings()'), ent.indexOf('return w;', ent.indexOf('function issueWarnings()')));
  assert.ok(iw.length > 200 && iw.length < 6000, 'tranche de issueWarnings : ' + iw.length);
  assert.ok(/C\.delaisContradictoires\(co, doc\)/.test(iw), 'l\'émission ne montre plus les deux délais qui se contredisent');
});

// Sur la fiche d'un client, le pied du tableau des documents additionnait le devis DÉJÀ facturé avec
// sa facture et son avoir : « 1 520,440 DT » sous « Net à payer », le devis compté deux fois (vu au
// test humain). La règle 7.18.0 — un total n'additionne que des pièces de même nature — portée ici.
t('H-E24 : le pied d\'une liste mêlée ne totalise que les factures et les avoirs, et le dit', () => {
  const ent = code('src', 'renderer', 'app.js');
  const f = tranche(ent, 'function docTable(list, opts) {');
  assert.ok(/const comptent = sorted\.filter\(d => d\.type === 'facture' \|\| d\.type === 'avoir'\);/.test(f), 'le pied ne distingue plus les pièces qui comptent');
  assert.ok(/const base = melange \? comptent : sorted;/.test(f), 'un devis compte de nouveau dans les totaux d\'une liste mêlée');
  ['totalHT', 'totalAmount', 'totalRest'].forEach(k =>
    assert.ok(new RegExp('const ' + k + ' = base\\.reduce').test(f), k + ' additionne encore toute la liste'));
  assert.ok(/\$\{melange \? 'factures et avoirs : ' : ''\}/.test(f), 'le pied ne dit plus sur quoi porte son total');
});

// Le marqueur « non enregistré » vivait À CÔTÉ du titre : au premier geste il élargissait l'en-tête,
// qui passait sur deux rangées à 1440 px, et tout le formulaire descendait de 40 px sous le curseur
// (le clic suivant tombait à côté). Le point de la grille du Cabinet avait appris la leçon en H-2 :
// ce qui APPARAÎT ne pousse rien. `e2e:entreprise` mesure l'en-tête et le champ Objet avant/après.
t('Le marqueur « modifications non enregistrées » ne pousse rien : il vit hors du flux, sous l\'en-tête', () => {
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const regle = /\n\.dirty-dot \{([^}]*)\}/.exec(css);
  assert.ok(regle, 'la règle du marqueur a disparu');
  assert.ok(/position: absolute/.test(regle[1]), 'le marqueur vit dans le flux : il élargit l\'en-tête au premier geste');
  assert.ok(/inset-block-start: 100%/.test(regle[1]), 'le marqueur n\'est plus SOUS l\'en-tête : posé à côté du titre, il recouvrirait les actions');
  assert.ok(/\n\.page-head \{ position: relative; \}/.test(css), 'le marqueur n\'a plus d\'ancre : il partirait dans le coin de la page');
});

// La fenêtre s'appelait « Nouveau document » au-dessus d'une page qui dit « Nouveau devis », et
// « SkanFact » tout court sur un achat, la fiche d'un fournisseur, d'un salarié, d'un bien.
t('Une page hors du catalogue prend le titre qu\'elle affiche pour nommer la fenêtre', () => {
  const ent = code('src', 'renderer', 'app.js');
  const f = ent.slice(ent.indexOf('function setWindowTitle('), ent.indexOf('document.title = title;'));
  assert.ok(f.length > 100 && f.length < 1600, 'tranche de setWindowTitle : ' + f.length);
  assert.ok(!/'Nouveau document'/.test(f), 'le titre générique « Nouveau document » revient');
  assert.ok(/if \(!t\) \{[\s\S]{0,160}\$\('#view \.page-head h1'\)[\s\S]{0,120}innerText/.test(f),
    'sans titre au catalogue, la fenêtre doit prendre celui de la page (et ignorer ce qui est caché)');
});

// La recherche d'une barre de filtres devait faire 300 px : la règle générale des champs porte
// quatre :not() et gagnait, la recherche prenait toute la ligne et renvoyait filtres, bulle et
// compteur sur une seconde rangée, au-dessus de chaque liste — sur le Catalogue, une bulle « i »
// restait seule sous la recherche. Même famille que .help-search (7.27.0).
t('La recherche d\'une barre de filtres ne prend pas toute la ligne : sa règle bat celle des champs', () => {
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const general = (css.match(/^input((?::not\(\[type=\w+\]\))+), select, textarea \{[^}]*width: 100%/m) || [])[1] || '';
  const nGeneral = (general.match(/:not\(/g) || []).length;
  assert.ok(nGeneral >= 4, 'la règle générale des champs n\'est plus trouvée : ' + nGeneral);
  const m = css.match(/^\.filters > input((?::not\(\[type=\w+\]\))+) \{([^}]*)\}/m);
  assert.ok(m, 'la règle de la recherche des filtres a disparu');
  assert.ok((m[1].match(/:not\(/g) || []).length >= nGeneral,
    'la règle des filtres porte moins de :not() que la règle générale : elle perd, et la recherche reprend toute la ligne');
  assert.ok(/max-width: \d+px/.test(m[2]), 'la recherche n\'a plus de borne : elle reprend toute la ligne');
  assert.ok(!/background/.test(m[2]), 'un fond posé par cette règle, plus spécifique que celle du thème sombre, mettrait du blanc sous un texte clair');
});

// ================================================================ l'app entreprise, lot 2 (10.12.0)
// Le parcours devis → facture → émission → paiement → avoir, joué à la souris comme un artisan.

// `.check` est un conteneur FLEX : chaque morceau de texte y devient un élément séparé de 8 px.
// « Timbre fiscal (1,000 DT) » s'écrivait en quatre morceaux sur deux lignes, la parenthèse
// ouvrante seule sous le mot « Timbre ». Le libellé d'une case tient donc dans UN élément.
t('Le libellé d\'une case à cocher tient en UN élément, dans les deux applications', () => {
  for (const [nom, chemin] of [['app entreprise', ['src', 'renderer', 'app.js']], ['Cabinet', ['src', 'cabinet', 'renderer', 'app.js']]]) {
    const src = code(...chemin);
    let n = 0; const fautes = [];
    for (const m of src.matchAll(/<label class="(?:[^"]*\s)?check(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/label>/g)) {
      n++;
      const apres = m[1].replace(/<input[^>]*>/, '').replace(/\$\{info\([^)]*\)\}/g, '').trim();
      if (!/<(span|b|strong|em|a|code|small)\b/.test(apres)) continue;
      if (!/^<span\b[^>]*>[\s\S]*<\/span>$/.test(apres)) fautes.push(apres.slice(0, 90));
    }
    assert.ok(n >= 10, `${nom} : les cases à cocher ne sont plus trouvées (${n})`);
    assert.deepStrictEqual(fautes, [], `${nom} : un libellé en plusieurs morceaux se casse dans un conteneur flex — ${fautes.join(' | ')}`);
  }
});

// « ← le document » sur la facture tirée d'un devis : lequel, quand on est soi-même sur un document ?
t('Le bouton retour nomme la pièce, le client ou le fournisseur où il mène', () => {
  const ent = code('src', 'renderer', 'app.js');
  const f = ent.slice(ent.indexOf('const pageLabel = '), ent.indexOf('function remplacerPage('));
  assert.ok(f.length > 200 && f.length < 2000, 'tranche de pageLabel : ' + f.length);
  assert.ok(/route === 'doc'\) \{ const d = docById\(id\); if \(d\) return docLabel\(d\); \}/.test(f), 'le retour vers une pièce ne la nomme plus');
  assert.ok(/route === 'client'\)[^\n]*c\.name/.test(f), 'le retour vers une fiche client ne nomme plus le client');
  assert.ok(/route === 'fournisseur'\)[^\n]*f\.name/.test(f), 'le retour vers une fiche fournisseur ne nomme plus le fournisseur');
  const b = tranche(ent, 'function backButton(');
  assert.ok(/title="Revenir à \$\{h\(pageLabel\(cible, true\)\)\}"/.test(b), 'la bulle du bouton doit garder le nom ENTIER');
  assert.ok(/← \$\{h\(pageLabel\(cible\)\)\}/.test(b), 'le bouton doit porter le nom (abrégé)');
});

// L'émission était une « Confirmation » générique qui floutait le document : on confirmait sans
// pouvoir relire à qui, ni combien — sur le geste le plus irréversible de l'application.
t('Émettre une facture ou un avoir passe par un récapitulatif : client, dates, montant, et ce qu\'un avoir laisse à rendre', () => {
  const ent = code('src', 'renderer', 'app.js');
  const issue = ent.slice(ent.indexOf("if ($('#issue')) $('#issue').onclick"), ent.indexOf("if ($('#serials'))"));
  assert.ok(issue.length > 200 && issue.length < 2500, 'tranche du bouton « Émettre » : ' + issue.length);
  assert.ok(/await confirmerEmission\(doc, n, warn\)/.test(issue), 'l\'émission ne passe plus par son récapitulatif');
  assert.ok(!/confirmDialog\(/.test(issue), 'une question générique est revenue sur l\'émission');
  const r = tranche(ent, 'function confirmerEmission(');
  // Un libellé peut passer par un ternaire (`ligne(isAv ? 'Montant…' : 'Net à payer', …)`) : on
  // exige qu'il soit l'argument d'une ligne du récapitulatif, pas qu'il suive `ligne('` au caractère près.
  ['Client', 'Date', 'Échéance', 'Facture corrigée', 'Montant de l\\\'avoir', 'Net à payer'].forEach(k =>
    assert.ok(new RegExp(`ligne\\([^)]*'${k.replace(/[\\']/g, m => '\\' + m)}'`).test(r), 'le récapitulatif ne dit plus : ' + k));
  assert.ok(/const bInv = inv \? balance\(inv\) : null;/.test(r), 'le récapitulatif ne lit plus la situation de la facture corrigée');
  assert.ok(/à rendre à/.test(r), 'un avoir sur une facture payée ne dit plus ce qu\'il laisse à rendre au client');
  // « Déjà payée » d'une facture qu'un autre avoir a couverte, c'était écrire le contraire du vrai :
  // la phrase dépend de ce que le client a PAYÉ, et un avoir de trop sans paiement se dit autrement.
  assert.ok(/bInv\.paid > 0\s*\?/.test(r) && /la dépasse de/.test(r), 'un avoir plus gros que la facture, sans paiement, ne se dit plus « à rendre »');
  // Les avertissements se lisent AVANT le bouton (9.4.2) : la boîte précède `modal-actions`.
  assert.ok(r.indexOf('avertissements.map') < r.indexOf('modal-actions'), 'les avertissements doivent précéder les boutons');
  assert.ok(/id="ok"/.test(r) && /data-close/.test(r), 'les parcours cliquent #ok et [data-close] : ils doivent exister');
});

// Le bandeau disait « déjà payée en partie » sur une facture payée en ENTIER, et sa bulle
// « soldée » sur une facture payée à moitié : il confondait « un paiement existe » et « soldée ».
t('Pourquoi une facture émise ne se déverrouille plus : trois causes, trois phrases, une seule fonction', () => {
  const Core = require('../../src/renderer/core.js');
  const co = { ...Core.DEFAULT_COMPANY, name: 'Test SARL', matricule: '1234567A/A/M/000', currency: 'DT', stampFee: 1 };
  const inv = { id: 'F1', type: 'facture', number: 'FAC-2026-001', status: 'envoyée', date: '2026-09-01', clientId: 'C1',
    applyStamp: true, stampFee: 1, lines: [{ label: 'Pose', qty: 1, unitPrice: 100, vatRate: 19 }], payments: [] };
  const data = Core.migrateData({ version: 6, company: co, clients: [{ id: 'C1', name: 'Client' }], documents: [inv] });
  const doc = data.documents[0];
  const net = Core.computeTotals(doc, co).netToPay;
  assert.strictEqual(net, 120, 'jeu de données : 100 HT + 19 % + 1 DT de timbre');
  assert.strictEqual(Core.motifVerrou(Core.invoiceBalance(doc, data, co)).court, '', 'sans paiement ni avoir, aucune raison de verrouiller');
  doc.payments = [{ id: 'P1', date: '2026-09-02', amount: 50 }];
  const partiel = Core.motifVerrou(Core.invoiceBalance(doc, data, co));
  assert.strictEqual(partiel.court, 'déjà payée en partie');
  assert.ok(!/soldée|entièrement/.test(partiel.long), 'une facture payée à moitié n\'est pas « soldée » : ' + partiel.long);
  doc.payments.push({ id: 'P2', date: '2026-09-03', amount: 70 });
  assert.strictEqual(Core.motifVerrou(Core.invoiceBalance(doc, data, co)).court, 'entièrement payée', 'une facture payée en entier ne se dit pas « payée en partie »');
  data.documents.push({ id: 'A1', type: 'avoir', number: 'AVO-2026-001', status: 'émis', creditOf: 'F1', date: '2026-09-04', clientId: 'C1', lines: [{ label: 'Remise', qty: 1, unitPrice: 10, vatRate: 19 }] });
  assert.strictEqual(Core.motifVerrou(Core.invoiceBalance(doc, data, co)).court, 'un avoir existe', 'l\'avoir prime : c\'est lui qui corrige la pièce');
  const ent = code('src', 'renderer', 'app.js');
  assert.ok(/const verrou = C\.motifVerrou\(bal\);/.test(ent), 'le bandeau ne lit plus sa raison dans motifVerrou');
  assert.ok(!/déjà payée en partie/.test(ent), 'la phrase est revenue écrite en dur dans le bandeau');
  // Une facture que ses avoirs couvrent EN ENTIER n'a plus rien à corriger : le bandeau proposait
  // encore « Corriger par un avoir… » en vert — un avoir de trop. Un avoir qui porte le timbre
  // couvre les 120 DT au millime ; celui qui ne le porte pas (119) laisse la facture due d'un dinar.
  const co2 = { ...co };
  const inv2 = { ...inv, id: 'F2', number: 'FAC-2026-002', payments: [] };
  const data2 = Core.migrateData({ version: 6, company: co2, clients: [{ id: 'C1', name: 'Client' }], documents: [inv2,
    { id: 'A2', type: 'avoir', number: 'AVO-2026-002', status: 'émis', creditOf: 'F2', date: '2026-09-05', clientId: 'C1', applyStamp: true, stampFee: 1, lines: [{ label: 'Annulation', qty: 1, unitPrice: 100, vatRate: 19 }] }] });
  const b2 = Core.invoiceBalance(data2.documents[0], data2, co2);
  assert.strictEqual(b2.credited, 120, 'jeu de données : l\'avoir porte le timbre, 119 + 1');
  const tout = Core.motifVerrou(b2);
  assert.ok(tout.annulee && tout.court === 'annulée par un avoir', 'une facture annulée en entier par ses avoirs doit le dire : ' + JSON.stringify(tout));
  data2.documents[1].applyStamp = false;
  assert.ok(!Core.motifVerrou(Core.invoiceBalance(data2.documents[0], data2, co2)).annulee, 'un avoir de 119 sur 120 n\'annule pas toute la facture');
  assert.ok(/!verrou\.annulee[\s\S]{0,500}?id="lock-credit"/.test(ent), 'le bandeau d\'une facture entièrement annulée propose encore un avoir');
  // Et « Corriger par un avoir… » n'est vert que si rien n'est dû et qu'aucun avoir n'existe : une
  // facture émise et impayée montrait TROIS boutons principaux (U-11). `e2e:entreprise` les compte.
  assert.ok(/bal && bal\.remaining <= 0\.0005 && !bal\.credits\.length \? 'btn-primary' : ''\}" id="lock-credit"/.test(ent), 'le bandeau garde son vert à côté du paiement à enregistrer');
  assert.ok(/class="btn \$\{\$\('#pay'\) \? '' : 'btn-primary'\}" id="pay2"/.test(ent), 'le paiement du panneau est vert en même temps que celui de l\'en-tête');
});

// « FAC-2026- / 001 » : le navigateur coupe après un trait d'union, et un numéro de pièce coupé en
// fin de ligne se lit comme deux choses (vu au test humain, dans la question qui supprime un paiement).
t('Un numéro de pièce ne se coupe pas en fin de ligne dans une question', () => {
  const ent = code('src', 'renderer', 'app.js');
  const m = ent.match(/const numerosInsecables = (html => [^\n]+);/);
  assert.ok(m, 'le garde des numéros de pièce n\'est plus trouvé');
  const garde = require('vm').runInNewContext(m[1]);
  assert.strictEqual(garde('FAC-2026-001 redeviendra due'), '<span class="nw">FAC-2026-001</span> redeviendra due');
  assert.strictEqual(garde('AVO-2026-012 et DEV-2025-104'), '<span class="nw">AVO-2026-012</span> et <span class="nw">DEV-2025-104</span>');
  assert.strictEqual(garde('<strong>1 191,000 DT</strong> du 23/09/2026'), '<strong>1 191,000 DT</strong> du 23/09/2026', 'une date ou un montant ne sont pas des numéros de pièce');
  for (const d of ['function confirmDialog(', 'function choiceDialog(']) {
    assert.ok(/<p>\$\{numerosInsecables\(/.test(tranche(ent, d)), d + ' ne protège plus les numéros de pièce');
  }
});

// En gras, l'entrée active « Facturation récurrente » passait à la ligne : tout le menu sous elle
// descendait de 14 px au moment du clic. L'état actif se dit par le fond et la couleur, jamais par
// ce qui change la place d'une entrée. `e2e:barre` allume chaque entrée et compare sa hauteur.
t('Une entrée de la barre latérale ne change pas de géométrie en s\'allumant', () => {
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // Le pied de la barre (Paramètres, Aide) est une entrée comme les autres : il passait encore en gras.
  const regles = [...css.matchAll(/^(?:nav a|\.sidebar-foot \.foot-link)\.active \{([^}]*)\}/gm)].map(m => m[1]);
  assert.ok(regles.length >= 2, 'les règles de l\'entrée active (menu ET pied de la barre) ne sont plus trouvées');
  regles.forEach(r => assert.ok(!/font-weight|font-size|padding|letter-spacing|border(?!-radius)/.test(r),
    'l\'entrée active change de géométrie : ' + r.trim()));
});

// « + Nouveau client » en vert dans l'en-tête, et « + Ajouter mon premier client » en vert dans
// l'état vide juste en dessous : deux boutons principaux pour le même geste (U-11). Tant que la
// liste est vide, l'en-tête cède le sien. On lit chaque route qui pose un état vide à bouton
// principal ; `e2e:entreprise` compte ce qui s'AFFICHE.
t('Une liste vide n\'a qu\'un bouton principal : l\'en-tête cède le sien à l\'état vide', () => {
  const ent = code('src', 'renderer', 'app.js');
  // Une page vit dans une route OU dans une fonction de premier niveau qu'une route appelle
  // (`listView` sert les Devis et les Factures) : on découpe sur les deux.
  const routes = [...ent.matchAll(/\n  (?:routes\.(\w+) = |(?:async )?function (\w+)\()/g)].map(m => ({ nom: m[1] || m[2], i: m.index }));
  let vus = 0; const fautes = [];
  routes.forEach((r, k) => {
    const corps = ent.slice(r.i, k + 1 < routes.length ? routes[k + 1].i : ent.length);
    if (!/etatVide\([\s\S]*?, true\]/.test(corps)) return;
    // Une page peut poser PLUSIEURS en-têtes (Licences : sans clé, puis avec) : on les lit tous,
    // chacun jusqu'à la fin de son bloc — borné, pour ne jamais déborder sur l'en-tête suivant.
    const tetes = [...corps.matchAll(/<div class="page-head">/g)].map(m => {
      const s = corps.slice(m.index, m.index + 700); const fin = s.indexOf('</div></div>');
      return fin > 0 ? s.slice(0, fin) : s;
    });
    if (!tetes.length) return;
    vus++;
    const fixe = tetes.some(t2 => /class="btn btn-primary"/.test(t2));
    const bascule = /classList\.toggle\('btn-primary'/.test(corps);
    if (fixe && !bascule) fautes.push(r.nom);
  });
  assert.ok(vus >= 6, 'les routes à état vide ne sont plus trouvées : ' + vus);
  assert.deepStrictEqual(fautes, [], 'l\'en-tête garde son bouton vert au-dessus d\'un état vide qui porte le sien : ' + fautes.join(', '));
});

// Sur une facture émise, les champs texte gardaient le fond et l'encre d'un champ modifiable
// (#fbfcfd, texte foncé) pendant que les listes voisines se grisaient : `input:disabled` (0,1,1)
// perdait contre la règle générale des champs (0,4,1) — la septième fois.
t('Un champ texte désactivé se grise comme une liste : sa règle porte la chaîne de :not() de la règle générale', () => {
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const general = (css.match(/^input((?::not\(\[type=\w+\]\))+), select, textarea \{/m) || [])[1] || '';
  assert.ok((general.match(/:not\(/g) || []).length >= 4, 'la règle générale des champs n\'est plus trouvée');
  const m = css.match(/^input((?::not\(\[type=\w+\]\))+):disabled,\s*select:disabled, textarea:disabled \{([^}]*)\}/m);
  assert.ok(m, 'la règle des champs désactivés ne porte plus la chaîne de :not() : `input:disabled` perd, et le champ a l\'air modifiable');
  assert.ok(/background: #f3f5f7/.test(m[2]) && /color: #5b6673/.test(m[2]), 'le champ désactivé n\'a plus le fond et l\'encre d\'un champ fermé');
});

// Une classe que la feuille ne connaît pas ne se voit nulle part (6.8.0, 7.23.0, 7.27.0, 8.1.0,
// 9.4.3) — et l'app entreprise en posait encore cinq : `.warn-box` et `.grave` (la question du
// comptable), `.code-box` (la clé d'une licence) vivaient dans la feuille du CABINET ; `.span-3`
// (le formulaire d'un contrat récurrent) et `.mod-sub` (une option de module) n'existaient nulle
// part. Chaque classe écrite dans un gabarit a donc une règle, ou elle est un CROCHET déclaré ici :
// une classe qui existe pour être TROUVÉE (par le code ou par un parcours), pas pour être stylée.
t('Chaque classe posée par l\'app entreprise a une règle dans sa feuille, ou c\'est un crochet déclaré', () => {
  const src = code('src', 'renderer', 'app.js');
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const definies = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  const CROCHETS = {
    q: 'la recherche d\'une liste générique (drawList)', rows: 'le conteneur de ses lignes', sortable: 'une table triable (bindSort)',
    solo: 'un lien de la barre latérale sans famille', 'att-mark': 'le trombone d\'un achat', 'inv-in': 'une case de l\'inventaire',
    'gl-compte': 'le grand livre (e2e:livres)', 'gl-ouv': 'le grand livre', 'gl-solde': 'le grand livre', 'gl-t': 'le grand livre',
    'od-compte': 'la saisie d\'une OD', 'od-lib': 'la saisie d\'une OD', 'od-label': 'la saisie d\'une OD', 'od-debit': 'la saisie d\'une OD',
    'od-credit': 'la saisie d\'une OD', 'od-del': 'la saisie d\'une OD', 'mod-go': 'une colonne de .mod-row', 'mod-txt': 'une colonne de .mod-row',
    'pp-go': 'une cellule des premiers pas', 'rate-lbl': 'le libellé du taux, réécrit par le code', 'b-rate-lbl': 'le même, sur un achat',
    'set-res': 'les résultats de recherche des Paramètres, stylés par leur identifiant'
  };
  // Une classe COLLÉE à une expression (`l${niveau}`, `bal-c${classe}`) est un préfixe dynamique : on
  // remplace chaque `${…}` par une marque, et un mot qui la touche n'est pas jugé ici.
  const sansExpr = v => { let out = '', i = 0; while (i < v.length) { if (v.startsWith('${', i)) { let p = 1; i += 2; while (i < v.length && p) { if (v[i] === '{') p++; else if (v[i] === '}') p--; i++; } out += '§'; continue; } out += v[i++]; } return out; };
  const utilisees = new Set();
  for (const m of src.matchAll(/class="([^"]*)"/g)) sansExpr(m[1]).split(/\s+/).forEach(k => { if (/^[a-z][\w-]*$/.test(k)) utilisees.add(k); });
  assert.ok(utilisees.size > 200, 'les classes des gabarits ne sont plus lues : ' + utilisees.size);
  const orphelines = [...utilisees].filter(k => !definies.has(k) && !CROCHETS[k]).sort();
  assert.deepStrictEqual(orphelines, [], 'classes posées par l\'app entreprise sans aucune règle dans sa feuille (ni crochet déclaré) : ' + orphelines.join(', '));
  // Un crochet qui a GAGNÉ une règle n'est plus un crochet : la liste ne doit pas mentir non plus.
  const perimes = Object.keys(CROCHETS).filter(k => definies.has(k));
  assert.deepStrictEqual(perimes, [], 'crochets déclarés qui ont désormais une règle : ' + perimes.join(', '));
  // Et la feuille du Cabinet ne redéfinit pas ce que la feuille partagée porte désormais (6.8.0).
  const cab = lireSource('src', 'cabinet', 'renderer', 'cabinet.css').replace(/\/\*[\s\S]*?\*\//g, '');
  ['warn-box', 'code-box'].forEach(k => assert.ok(!new RegExp('\\.' + k + '\\b').test(cab), `.${k} est redéfinie dans la feuille du Cabinet`));
});

// La fenêtre « Régler » d'un achat en euros annonçait son reste en DINARS (le jumeau de la 10.1.0),
// et un règlement fournisseur ne se modifiait pas — un paiement client, si, depuis la 7.3.0.
t('Un règlement fournisseur se corrige, dans la devise de l\'achat', () => {
  const ent = code('src', 'renderer', 'app.js');
  const f = tranche(ent, 'function supplierPaymentForm(');
  assert.ok(/function supplierPaymentForm\(p, done, pay\)/.test(f), 'le formulaire ne sait plus modifier un règlement');
  assert.ok(/const cur = p\.currency \|\| company\(\)\.currency;/.test(f), 'le formulaire compte de nouveau un achat en euros en dinars');
  assert.ok(/closedBlock\(r0 \? \[r0\.date, v\.date\] : v\.date, 'Ce règlement'\)/.test(f), 'corriger la date d\'un règlement doit tester l\'ancienne ET la nouvelle');
  assert.ok(/if \(cible\) Object\.assign\(cible, champs\);/.test(f), 'modifier doit corriger le règlement, pas en ajouter un second');
});

// « Ce paiement ne peut pas être supprimé porte la date du… » : closedBlock reçoit un NOM, pas une
// phrase ; et la clôture se juge AVANT la question (7.6.0), sinon on répond « oui » pour rien.
t('Supprimer un paiement ou un règlement : la clôture d\'abord, puis une question qui nomme le montant', () => {
  const ent = code('src', 'renderer', 'app.js');
  assert.ok(!/closedToast|ne peut pas être supprimé'\)/.test(ent), 'une phrase entière est de nouveau passée à la porte de clôture');
  for (const lab of ['Supprimer ce paiement', 'Supprimer ce règlement']) {
    const i = ent.indexOf(`label: '${lab}'`);
    assert.ok(i > 0, `l'action « ${lab} » a disparu`);
    const bloc = ent.slice(i, i + 700);
    assert.ok(bloc.indexOf('closedBlock(') > 0 && bloc.indexOf('closedBlock(') < bloc.indexOf('confirmDialog('), `« ${lab} » : la clôture doit passer avant la question`);
    assert.ok(/danger: true/.test(bloc), `« ${lab} » doit s'annoncer comme un geste qui détruit`);
    assert.ok(/C\.money\([a-z]\.amount, cur\)[^\n]*C\.fmtDate\([a-z]\.date\)/.test(bloc), `la question de « ${lab} » doit nommer le montant et la date`);
  }
});

// Un trop-perçu — un avoir émis après le paiement — s'affichait « Reste à payer 0,000 DT » en VERT,
// avec la somme due au client en petit gris dessous : la situation la plus inconfortable de la
// facture avait l'air de la plus tranquille.
t('Un trop-perçu se lit comme de l\'argent à rendre, pas comme un reste à payer à zéro', () => {
  const ent = code('src', 'renderer', 'app.js');
  const i = ent.indexOf('function drawPayments()');
  const bloc = ent.slice(i, i + 4000);
  assert.ok(/b\.remaining < -0\.0005\s*\?\s*`<div><div class="k-label">Trop-perçu \$\{info\('ed\.tropPercu'\)\}<\/div><div class="v due">/.test(bloc),
    'le trop-perçu ne prend plus sa carte, dans la couleur d\'alerte');
  assert.ok(/à rendre au client/.test(bloc), 'la carte ne dit plus quoi faire de cet argent');
});

// Une liste déroulante de statuts : « brouillon » entre « Tous les statuts » et « Français » se
// lisait comme une valeur oubliée. Le badge garde sa minuscule d'étiquette ; la liste, non.
t('Les statuts d\'une liste déroulante commencent par une majuscule, sans changer leur valeur', () => {
  const ent = code('src', 'renderer', 'app.js');
  const selects = [...ent.matchAll(/(?:STATUSES(?:\[[^\]]+\])?|statuses)\.map\((\w+) => `<option([^>]*)>([^<]*)<\/option>`\)/g)];
  assert.ok(selects.length >= 5, 'les listes de statuts ne sont plus trouvées : ' + selects.length);
  selects.forEach(([tout, v, attrs, lib]) => {
    assert.ok(new RegExp(`value="\\$\\{(?:h\\()?${v}\\)?\\}"`).test(attrs), 'une option de statut sans valeur explicite : le libellé partirait dans les données — ' + tout.slice(0, 80));
    assert.ok(new RegExp(`optionStatut\\(${v}\\)`).test(lib), 'une liste de statuts affiche encore la valeur brute : ' + tout.slice(0, 80));
  });
});

};
