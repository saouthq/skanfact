'use strict';
// ============================================================================================
// Le moteur partagé (9.6.1) — ce qui a fini de déménager de core.js vers compta.js
//
// La règle de découpage, posée en 9.1.0 et jamais changée : une fonction qui prend `data` reste
// dans core.js ; une fonction qui prend un OBJET — des lignes, une pièce, un bien — vit dans
// compta.js. Le moteur d'amortissement et le constructeur de pièce équilibrée étaient du second
// genre et vivaient du premier côté depuis la 3.5.0 et la 6.3.0.
//
// Ce que ces tests tiennent : que le déménagement est RÉEL (core.js ne les définit plus), qu'il est
// invisible pour les appelants (mêmes fonctions, au même nom), et que le Cabinet — qui ne charge
// pas core.js, et ne doit jamais le charger — peut désormais amortir tout seul.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');

// ---------------------------------------------------------------- le déménagement est réel

t('9.6.1 : le moteur d\'amortissement et la pièce équilibrée ne sont plus DÉFINIS dans core.js', () => {
  const src = lireSource('src', 'renderer', 'core.js');
  // On cherche la DÉFINITION, pas la mention : `const x = Compta.x;` est une réexportation,
  // `function x(` est une seconde vie du moteur — et deux moteurs divergent, toujours (6.8.0).
  const DEMENAGEES = [
    'entrySet', 'days360', 'assetSchedule', 'assetYear',
    'assetCumulated', 'assetNBV', 'disposalResult', 'cappedCumulated'
  ];
  const restees = DEMENAGEES.filter(n => new RegExp('\\bfunction\\s+' + n + '\\s*\\(').test(src));
  assert.deepStrictEqual(restees, [], 'core.js redéfinit un moteur qui vit dans compta.js');
  assert.ok(!/const DEFAULT_ASSET_CLASSES = \[/.test(src),
    'la table des familles de biens ne doit plus être écrite dans core.js');
});

t('9.6.1 : core.js réexporte le moteur à l\'identique — les appelants n\'ont pas bougé', () => {
  const C = require('../../src/renderer/core.js');
  // Identité d'objet : ce n'est pas « une copie qui fait pareil », c'est la MÊME fonction.
  ['days360', 'assetSchedule', 'assetYear', 'assetCumulated',
    'assetNBV', 'disposalResult', 'cappedCumulated', 'DEFAULT_ASSET_CLASSES'].forEach(n => {
    assert.ok(C[n], 'core.js n\'exporte plus ' + n);
    assert.strictEqual(C[n], K[n], n + ' : core.js en rend une COPIE, pas la fonction de compta.js');
  });
  // `entrySet` n'a jamais été exporté — il ne sert qu'à `journalEntries`, à l'intérieur de core.js.
  // Il se prouve donc par la source : la ligne qui le fait venir de compta.js doit exister.
  assert.ok(/const entrySet = Compta\.entrySet;/.test(lireSource('src', 'renderer', 'core.js')),
    'core.js doit prendre entrySet dans compta.js, pas en écrire un second');
});

// ---------------------------------------------------------------- le Cabinet peut amortir seul

t('9.6.1 : le Cabinet amortit sans core.js — le plan tombe juste, à la main', () => {
  // Un bien de 3 600 DT, cinq ans, mis en service le 1er juillet 2026. Annuité pleine = 720.
  // 2026 n'en porte qu'une moitié : en base 360, du 1er juillet au 31 décembre il y a six mois de
  // trente jours — le 31 est ramené à 30, et le +1 du jour de mise en service tombe dessus — donc
  // 180 jours, donc 360 DT. Le calcul se fait À LA MAIN (règle 7.0.1) : recopier la sortie du code
  // graverait son défaut au lieu de le trouver. Ma première version écrivait 181 : c'est
  // l'assertion qui était fausse, pas le moteur.
  const plan = K.assetSchedule({ amount: 3600, years: 5, date: '2026-07-01' });
  assert.strictEqual(plan.length, 6, 'un bien mis en service en cours d\'année touche six exercices');
  assert.strictEqual(plan[0].year, 2026);
  assert.strictEqual(plan[0].days, 180);
  assert.strictEqual(plan[0].annuity, K.round3(720 * 180 / 360));
  // Et la première moitié plus la dernière font exactement une annuité pleine.
  assert.strictEqual(K.round3(plan[0].annuity + plan[plan.length - 1].annuity), 720);
  assert.strictEqual(plan[1].annuity, 720);
  assert.strictEqual(plan[plan.length - 1].nbv, 0);
  assert.strictEqual(plan[plan.length - 1].cumulated, 3600);
  const somme = K.round3(plan.reduce((s, r) => s + r.annuity, 0));
  assert.strictEqual(somme, 3600, 'la somme des annuités doit valoir la base, au millime');
});

t('9.6.1 : la DERNIÈRE annuité absorbe les arrondis — la VNC finit à zéro, pas à un millime', () => {
  // 1 000 DT sur trois ans ne tombe pas rond : 333,333 × 3 = 999,999. Sans l'absorbeur, le bien
  // reste éternellement à 0,001 DT au bilan, et aucun écran ne le montre.
  //
  // Ma première version de ce test prenait 3 600 sur cinq ans — 720 pile. Retirer l'absorbeur ne
  // faisait donc RIEN tomber : le test ne pouvait pas échouer, et je ne l'ai su qu'en essayant.
  // Un montant qui se divise sans reste ne prouve rien d'un arrondi (règle 7.2.0).
  const plan = K.assetSchedule({ amount: 1000, years: 3, date: '2026-01-01' });
  assert.strictEqual(plan.length, 3);
  assert.strictEqual(K.round3(plan[0].annuity + plan[1].annuity), 666.666,
    'les deux premières annuités sont celles du calcul, sans correction');
  assert.strictEqual(plan[2].annuity, 333.334, 'la dernière porte le millime qui manque');
  assert.strictEqual(plan[2].nbv, 0, 'la VNC doit finir exactement à zéro');
  assert.strictEqual(K.round3(plan.reduce((s, r) => s + r.annuity, 0)), 1000);
});

t('9.6.1 : une valeur résiduelle ne s\'amortit pas, et une cession fige le cumul', () => {
  const bien = { amount: 10000, residual: 1000, years: 4, date: '2026-01-01' };
  const plan = K.assetSchedule(bien);
  assert.strictEqual(K.round3(plan.reduce((s, r) => s + r.annuity, 0)), 9000,
    'on n\'amortit que acquisition − valeur résiduelle');
  assert.strictEqual(K.assetNBV(bien, '2029-12-31'), 1000, 'la VNC finit sur la valeur résiduelle');

  const cede = { ...bien, disposal: { date: '2027-06-30', amount: 6000 } };
  const apres = K.assetYear(cede, 2028);
  assert.strictEqual(apres.annuity, 0, 'après la sortie, plus rien ne s\'amortit');
  assert.strictEqual(K.cappedCumulated(cede, '2029-12-31'), K.assetCumulated(cede, '2027-06-30'),
    'le cumul reste figé au jour de la cession');
  const r = K.disposalResult(cede);
  assert.strictEqual(r.result, K.round3(6000 - K.assetNBV(cede, '2027-06-30')),
    'le résultat de cession est le prix moins la VNC du jour de la sortie');
});

t('9.6.1 : les dates du moteur d\'amortissement sont en UTC pur', () => {
  // Règle 5.2.3. Le seul moyen de le prouver est de changer de fuseau à chaud : sur la machine de
  // test (UTC), une faute d'heure locale ne se voit jamais.
  const tz = process.env.TZ;
  const attendu = JSON.stringify(K.assetSchedule({ amount: 1200, years: 1, date: '2026-03-01' }));
  ['Africa/Tunis', 'Pacific/Kiritimati', 'Pacific/Niue', 'Asia/Kolkata'].forEach(z => {
    process.env.TZ = z;
    assert.strictEqual(JSON.stringify(K.assetSchedule({ amount: 1200, years: 1, date: '2026-03-01' })),
      attendu, 'le plan d\'amortissement change avec le fuseau horaire : ' + z);
  });
  if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
});

// ---------------------------------------------------------------- la pièce équilibrée

t('9.6.1 : un montant négatif change de COLONNE, il ne garde pas son signe', () => {
  // Règle 6.3.0 : aucun logiciel comptable n'accepte un débit négatif. C'est ce qui fait qu'un
  // avoir s'écrit à l'envers d'une facture — et ce qui aurait fait refuser le fichier à l'import.
  const set = K.entrySet({ date: '2026-03-01', journal: 'VT', piece: 'AVO-1' });
  set.debit('411', 'Client', -120);
  set.credit('707', 'Ventes', -100);
  set.credit('4367', 'TVA', -20);
  const lignes = set.done();
  assert.ok(lignes.every(l => l.debit >= 0 && l.credit >= 0), 'une ligne porte un montant négatif');
  assert.strictEqual(lignes.find(l => l.account === '411').credit, 120);
  assert.strictEqual(lignes.find(l => l.account === '707').debit, 100);
  const b = K.entriesBalance(lignes);
  assert.strictEqual(b.debit, b.credit, 'la pièce doit rester équilibrée');
});

t('9.6.1 / 10.14.1 : l\'écart d\'arrondi s\'absorbe sur la plus grosse ligne hors tiers, dans SA colonne', () => {
  const set = K.entrySet({ date: '2026-03-01', journal: 'VT', piece: 'FAC-1' });
  set.debit('411', 'Client', 119.005, { role: 'clients' });
  set.credit('707', 'Ventes', 100);
  set.credit('4367', 'TVA', 19);
  const lignes = set.done();
  const b = K.entriesBalance(lignes);
  assert.strictEqual(b.debit, b.credit, 'un écart de quelques millimes ne doit jamais sortir de là');
  assert.strictEqual(K.round3(b.debit), 119.005, 'le client garde ce qu\'il doit : le lettrage ne laisse pas de millime');
  assert.strictEqual(lignes.find(l => l.account === '707').credit, 100.005, 'l\'écart va aux ventes, la plus grosse ligne hors tiers');
  assert.strictEqual(lignes.find(l => l.account === '4367').credit, 19, 'la TVA déclarée ne bouge pas');
  // Le défaut de la 10.14.0 (DEV-01) : un écart NÉGATIF sur une dernière ligne au crédit partait
  // dans la colonne d'en face — « D 0,001 C 1,002 », une ligne que le Cabinet refuse de valider.
  const set2 = K.entrySet({ date: '2026-03-01', journal: 'VT', piece: 'FAC-2' });
  set2.debit('411', 'Client', 924.461, { role: 'clients' });
  set2.credit('706', 'Ventes', 925.462);
  set2.credit('4368', 'Timbre', 1);
  const l2 = set2.done();
  assert.ok(l2.every(l => !(l.debit > 0 && l.credit > 0)), 'une ligne porte un débit ET un crédit : ' + JSON.stringify(l2.map(l => [l.account, l.debit, l.credit])));
  assert.strictEqual(l2.find(l => l.account === '4368').credit, 1, 'le timbre, droit fixe, ne reçoit jamais l\'écart');
  assert.strictEqual(l2.find(l => l.account === '706').credit, 923.461);
  // Une ligne nulle n'entre pas : elle n'apprend rien et alourdit chaque journal.
  const vide = K.entrySet({ date: '2026-03-01' });
  vide.debit('606', 'Rien', 0);
  assert.deepStrictEqual(vide.done(), []);
});
};
