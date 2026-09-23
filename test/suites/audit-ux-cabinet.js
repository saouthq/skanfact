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
  const bouton = /\$\{(row\.missingCount \|\| row\.provisionalCount) \? '<button class="btn btn-primary" id="rel">Relancer<\/button>'/.exec(fiche);
  assert.ok(bouton, 'le bouton « Relancer » et sa condition sont introuvables');
  const i = fiche.indexOf('Le bouton « Relancer », en haut');
  assert.ok(i > 0, 'la phrase est introuvable');
  const avant = fiche.slice(Math.max(0, i - 200), i);
  assert.ok(avant.includes('${' + bouton[1]), 'la phrase doit être gardée par la MÊME condition que le bouton');
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

};
