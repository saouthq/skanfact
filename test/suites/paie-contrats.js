'use strict';
// ============================================================================================
// Les contrats aux règles particulières — saisonnier, CIVP, Karama (10.15.0, H4 de l'étude Hesabi)
//
// Un CIVP ou un contrat Karama peut exonérer l'employeur d'une partie des charges, ou le salarié de
// l'IRPP ; un saisonnier a son propre contrat. Aucune de ces règles n'est ÉCRITE : elles changent
// d'un dispositif et d'une année à l'autre (règle 9.1.1). La table part vide, se règle par contrat,
// et chaque bulletin la suit et la garde avec son calcul.
//
// Ce que ces tests tiennent :
//   • un montant calculé À LA MAIN pour un CIVP exonéré (le jeu discrimine : rien de rond) ;
//   • une case VIDE n'est pas un zéro, un taux hors 0..100 et un contrat inconnu ne sont pas gardés ;
//   • le CDI suit toujours le barème ;
//   • le régime est figé dans le calcul du bulletin ;
//   • les deux applications rendent le MÊME bulletin pour le même régime ;
//   • le Cabinet GARDE les taux d'un dossier (migrateDossier), et la même porte les normalise.
module.exports = ({ t, assert, lireSource }) => {
  const K = require('../../src/renderer/compta.js');
  const C = require('../../src/renderer/core.js');
  const KC = require('../../src/cabinet/cabcore.js');
  const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

  const CIVP = { civp: { cnssEmployer: 0, tfpRate: 0, foprolosRate: 0, sansIrpp: true } };

  t('H4 : la liste des contrats connaît le saisonnier et le CIVP', () => {
    const cles = K.CONTRACT_TYPES.map(c => c[0]);
    ['cdi', 'cdd', 'saisonnier', 'civp', 'karama'].forEach(k => assert.ok(cles.includes(k), 'contrat absent : ' + k));
    assert.strictEqual(C.CONTRACT_TYPES, K.CONTRACT_TYPES, 'core.js doit réexporter LA table, pas une copie');
  });

  t('H4 : un CIVP exonéré — le bulletin calculé à la main', () => {
    // Brut 1 000, CNSS salarié 9,18 % (le taux général : la case est vide), solidarité 1 %.
    //   CNSS salarié = 91,800 ; imposable annuel = (1 000 − 91,8) × 12 − 10 % = 9 808,560
    //   IRPP = 0 (sans IRPP) ; CSS = 9 808,56 × 1 % ÷ 12 = 8,174
    //   Net = 1 000 − 91,800 − 8,174 = 900,026
    //   Charges : CNSS employeur 0, accident 0,4 % = 4, TFP 0, FOPROLOS 0 → coût 1 004,000
    const s = K.baremesPaie({ regimesContrat: CIVP });
    const c = K.computePayslip({ grossSalary: 1000, contrat: 'civp' }, {}, s);
    assert.strictEqual(c.cnssEmployee, 91.8);
    assert.strictEqual(c.irpp, 0, 'sans IRPP : aucun impôt retenu');
    assert.strictEqual(c.css, 8.174, 'la solidarité n\'est pas réglée : elle garde le taux général');
    assert.strictEqual(c.net, 900.026);
    assert.strictEqual(c.cnssEmployer, 0);
    assert.strictEqual(c.accident, 4, 'l\'accident n\'est pas réglé : taux général');
    assert.strictEqual(c.tfp, 0);
    assert.strictEqual(c.foprolos, 0);
    assert.strictEqual(c.employerCost, 1004);
    assert.strictEqual(c.contrat, 'civp');
    assert.deepStrictEqual(c.regime, { cnssEmployer: 0, tfpRate: 0, foprolosRate: 0, sansIrpp: true }, 'le régime est FIGÉ dans le calcul');
    assert.strictEqual(c.rates.cnssEmployer, 0, 'les taux figés sont ceux APPLIQUÉS');
  });

  t('H4 : un CDD sous le même réglage suit le barème général', () => {
    const s = K.baremesPaie({ regimesContrat: CIVP });
    const cdd = K.computePayslip({ grossSalary: 1000, contrat: 'cdd' }, {}, s);
    const base = K.computePayslip({ grossSalary: 1000, contrat: 'cdd' }, {}, K.baremesPaie({}));
    assert.deepStrictEqual(cdd, base);
    assert.strictEqual(cdd.cnssEmployer, 165.7);
    assert.ok(cdd.irpp > 0);
    assert.strictEqual(cdd.regime, null);
  });

  t('H4 : le CDI n\'est jamais réglé, même si la table le nomme', () => {
    const s = K.baremesPaie({ regimesContrat: { cdi: { cnssEmployer: 0, sansIrpp: true } } });
    assert.deepStrictEqual(K.regimeDuContrat(s, 'cdi'), {});
    const c = K.computePayslip({ grossSalary: 1000, contract: 'cdi' }, {}, s);
    assert.strictEqual(c.cnssEmployer, 165.7);
    assert.strictEqual(c.regime, null);
    // Un salarié SANS contrat est un CDI : les deux applications le lisent pareil.
    assert.strictEqual(K.computePayslip({ grossSalary: 1000 }, {}, s).contrat, 'cdi');
  });

  t('H4 : une case VIDE garde le taux général ; un taux hors bornes et un contrat inconnu ne sont pas gardés', () => {
    assert.deepStrictEqual(K.regimeDuContrat({ regimesContrat: { civp: { cnssEmployer: '', tfpRate: null } } }, 'civp'), {},
      'une case vide n\'est pas un zéro : elle laisse le taux général');
    assert.deepStrictEqual(K.regimeDuContrat({ regimesContrat: { civp: { cnssEmployer: 0 } } }, 'civp'), { cnssEmployer: 0 },
      'zéro est une valeur : l\'exonération');
    assert.deepStrictEqual(K.regimeDuContrat({ regimesContrat: { civp: { cnssEmployer: 150, tfpRate: -1, accidentRate: 'abc' } } }, 'civp'), {});
    assert.deepStrictEqual(K.regimeDuContrat({ regimesContrat: { civp: { sansIrpp: 'oui' } } }, 'civp'), {}, 'seul true coche « sans IRPP »');
    assert.deepStrictEqual(K.normaliserRegimes({ civp: { cnssEmployer: '' }, inconnu: { tfpRate: 0 }, cdi: { tfpRate: 0 }, karama: { tfpRate: 0.5 } }),
      { karama: { tfpRate: 0.5 } }, 'on ne garde que les régimes qui changent quelque chose, sur des contrats réglables');
    assert.strictEqual(K.libelleRegime({ cnssEmployer: 0, tfpRate: 0.5, sansIrpp: true }), 'CNSS employeur 0 %, TFP 0,5 %, sans IRPP');
  });

  t('H4 : les deux applications rendent le MÊME bulletin pour un CIVP', () => {
    // L'app entreprise : la fiche porte `contract`, les réglages vivent dans data.payrollSettings.
    const data = { company: {}, payrollSettings: { regimesContrat: CIVP } };
    const e = C.computePayslip({ grossSalary: 1234.5, contract: 'civp', children: 1, headOfFamily: true },
      { gross: 1234.5, workedDays: 26, absentDays: 2 }, C.payrollSettings(data));
    // Le Cabinet : la fiche porte `contrat`, les réglages vivent sur le dossier.
    const L = K.livreVide('d1', 2026);
    K.ajouterSalarie(L, { id: 's1', nom: 'Yosra Ben Salah', contrat: 'civp', embauche: '2026-01-01', brut: 1234.5, chefDeFamille: true, enfants: 1 }, 'Amine', 1);
    const r = K.ajouterBulletin(L, { salarieId: 's1', annee: 2026, mois: 3, brut: 1234.5, joursTravailles: 26, joursAbsence: 2 },
      { regimesContrat: CIVP }, 'Amine', 2);
    assert.strictEqual(r.ok, true, r.motif);
    assert.deepStrictEqual(r.bulletin.calcul, e, 'deux applications, deux bulletins différents pour le même CIVP');
    assert.strictEqual(r.bulletin.calcul.cnssEmployer, 0, 'le Cabinet passe bien le contrat du salarié au moteur');
  });

  t('H4 : le Cabinet GARDE les taux par contrat d\'un dossier, et les normalise par le moteur', () => {
    const d = KC.migrateDossier({ id: 'x', name: 'Café', paie: { regimesContrat: CIVP } });
    assert.deepStrictEqual(d.paie, { regimesContrat: CIVP }, 'absent de migrateDossier, le réglage serait jeté au prochain chargement');
    assert.deepStrictEqual(KC.migrateDossier({ id: 'x' }).paie, {});
    assert.deepStrictEqual(KC.migrateDossier({ id: 'x', paie: [1] }).paie, {});
    const main = sansCommentaires(lireSource('src', 'cabinet', 'main.js'));
    const i = main.indexOf("ipcMain.handle('cab:savePaie'");
    assert.ok(i > 0, 'le handler cab:savePaie manque');
    const zone = main.slice(i, main.indexOf('ipcMain.handle(', i + 10));
    assert.ok(/droitBlock\(dossierId, 'saisie'\)/.test(zone), 'régler la paie d\'un dossier est un geste de saisie');
    assert.ok(/KC\.normaliserRegimes\(/.test(zone), 'la porte normalise par le moteur de paie');
    assert.ok(/return save\(\)/.test(zone), 'la porte rend l\'état entier (S = await api.savePaie)');
    assert.ok(/savePaie: \(dossierId, regimesContrat\) => ipcRenderer\.invoke\('cab:savePaie'/.test(lireSource('src', 'cabinet', 'preload.js')));
  });

  t('H4 : les deux écrans lisent une case vide comme « taux général », et disent le régime sur le bulletin', () => {
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    const r = app.slice(app.indexOf('const readRates = () =>'), app.indexOf('const readRates = () =>') + 1500);
    assert.ok(/i\.value\.trim\(\) !== ''/.test(r), 'l\'app entreprise ne garde pas une case vide');
    assert.ok(/C\.normaliserRegimes\(rc\)/.test(r));
    assert.ok(/id="bf-regime"/.test(app) && /C\.libelleRegime\(c\.regime\)/.test(app), 'l\'aperçu du bulletin entreprise dit le régime');
    const cab = sansCommentaires(lireSource('src', 'cabinet', 'renderer', 'app.js'));
    const f = cab.slice(cab.indexOf('function regimesForm('), cab.indexOf('function salarieForm('));
    assert.ok(f.length > 500 && f.length < 5000, 'tranche inattendue : ' + f.length);
    assert.ok(/if \(!t\) continue;/.test(f), 'le Cabinet ne garde pas une case vide');
    assert.ok(/refus\(i,/.test(f), 'un taux illisible se refuse en montrant sa case');
    assert.ok(/api\.savePaie\(dossier\.id, rc\)/.test(f));
    assert.ok(/id="bf-regime"/.test(cab) && /KC\.libelleRegime\(c\.regime\)/.test(cab), 'l\'aperçu du bulletin du Cabinet dit le régime');
    assert.ok(/contrat: sal\.contrat/.test(cab), 'l\'aperçu du Cabinet passe le contrat du salarié au moteur');
    // Vu à la souris : « Contrat Contrat Karama » — le nom du contrat porte déjà le mot. La phrase
    // commence par le NOM, jamais par « Contrat » suivi du nom.
    [app, cab].forEach(src => assert.ok(!/id="bf-regime">Contrat /.test(src) && !/— contrat \$\{/.test(src),
      'la phrase du régime redit « Contrat » devant « Contrat Karama »'));
  });
};
