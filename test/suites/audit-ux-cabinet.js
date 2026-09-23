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
  assert.ok(/p\.ca \|\| \{\}/.test(carte) && /de CA en \$\{esc\(K\.monthLabel\(ca\.mois\)\)\}/.test(carte),
    'la carte doit NOMMER le mois de son chiffre');
  const pied = tranche(src, 'function totalCA(');
  assert.ok(/K\.caDuPortefeuille\(/.test(pied), 'le pied du tableau lit la même fonction que la carte (6.8.1)');
  assert.ok(/K\.monthLabel\(ca\.mois\)/.test(pied), 'et il nomme son mois');
  assert.ok(/sortHead\('CA du dernier mois', 'ca'/.test(src), 'la colonne dit de quel mois est son chiffre, et se trie');
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
  const bouton = /\$\{(row\.missingCount \|\| row\.provisionalCount) \? '<button class="btn btn-primary" id="rel">Relancer<\/button>'/.exec(fiche);
  assert.ok(bouton, 'le bouton « Relancer » et sa condition sont introuvables');
  const i = fiche.indexOf('Le bouton « Relancer », en haut');
  assert.ok(i > 0, 'la phrase est introuvable');
  const avant = fiche.slice(Math.max(0, i - 200), i);
  assert.ok(avant.includes('${' + bouton[1]), 'la phrase doit être gardée par la MÊME condition que le bouton');
});

};
