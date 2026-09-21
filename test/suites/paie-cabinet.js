'use strict';
// ============================================================================================
// La paie des clients, dans le Cabinet (10.3.0)
//
// Ce que le Cabinet ne savait pas faire, et que ses clients lui demandent tous les mois. Un cabinet
// a soixante clients dont deux utilisent SkanFact : pour les cinquante-huit autres — ceux qui
// PAIENT — il n'existait aucun moyen de tenir la paie. Le comptable établissait les bulletins
// ailleurs et RETAPAIT l'écriture à la main.
//
// Ce que ces tests tiennent : que le moteur a VRAIMENT déménagé (core.js ne le redéfinit plus et
// le réexporte par identité, jamais par copie — règle 9.6.1), que le Cabinet calcule un bulletin
// sans core.js, et que l'écriture qu'il propose est EXACTEMENT celle que l'app entreprise produit
// pour le même bulletin. Deux moteurs divergent, et le client et son comptable auraient alors deux
// écritures pour le même mois sans savoir laquelle croire.
module.exports = ({ t, assert, lireSource }) => {
  const K = require('../../src/renderer/compta.js');
  const C = require('../../src/renderer/core.js');

  // ------------------------------------------------------------ le déménagement est réel

  t('10.3.0 : le moteur de paie n\'est plus DÉFINI dans core.js', () => {
    const src = lireSource('src', 'renderer', 'core.js');
    ['irppAnnual', 'computePayslip'].forEach(n => {
      assert.ok(!new RegExp('\\bfunction\\s+' + n + '\\s*\\(').test(src),
        'core.js redéfinit ' + n + ' : deux moteurs de paie divergent, toujours');
    });
    assert.ok(!/const DEFAULT_PAYROLL = \{/.test(src), 'les barèmes ne doivent plus être écrits dans core.js');
    assert.ok(!/const CONTRACT_TYPES = \[/.test(src), 'la table des contrats non plus');
  });

  t('10.3.0 : core.js réexporte le moteur de paie à l\'identique', () => {
    // Identité d'objet : ce n'est pas « une copie qui fait pareil », c'est la MÊME fonction (9.6.1).
    ['irppAnnual', 'computePayslip', 'employerChargesOf', 'DEFAULT_PAYROLL', 'CONTRACT_TYPES'].forEach(n => {
      assert.ok(C[n], 'core.js n\'exporte plus ' + n);
      assert.strictEqual(C[n], K[n], n + ' : core.js en rend une COPIE, pas la fonction de compta.js');
    });
    // `contractLabel` n'est pas exporté par core.js : il se prouve par la source.
    assert.ok(/const contractLabel = Compta\.contractLabel;/.test(lireSource('src', 'renderer', 'core.js')),
      'core.js doit prendre contractLabel dans compta.js, pas en écrire un second');
  });

  t('10.3.0 : payrollSettings garde sa proposition de TFP et délègue la fusion', () => {
    // La moitié qui reste du côté de l'entreprise : la TFP PROPOSÉE par le métier (9.1.1) demande
    // `data.company`, donc elle ne peut pas vivre dans compta.js.
    const base = K.baremesPaie({});
    assert.strictEqual(base.cnssEmployee, K.DEFAULT_PAYROLL.cnssEmployee);
    assert.strictEqual(K.baremesPaie({ cnssEmployee: 7 }).cnssEmployee, 7, 'ce qui est réglé écrase ce qui est livré');
    assert.deepStrictEqual(K.baremesPaie({ brackets: [] }).brackets, K.DEFAULT_PAYROLL.brackets,
      'un barème vide retombe sur celui qui est livré, sinon l\'impôt vaudrait zéro pour tout le monde');
    const r = C.payrollSettings({ payrollSettings: { cnssEmployee: 8 }, company: {} });
    assert.strictEqual(r.cnssEmployee, 8);
    assert.ok(/Compta\.baremesPaie\(/.test(lireSource('src', 'renderer', 'core.js')),
      'payrollSettings doit passer par compta.js, pas refaire la fusion');
  });

  // ------------------------------------------------------------ le Cabinet tient une paie seul

  const livreAvecPaie = () => {
    const L = K.livreVide('d1', 2026);
    K.ajouterSalarie(L, {
      id: 's1', nom: 'Mohamed Trabelsi', cnss: '112233-44', poste: 'Boulanger',
      contrat: 'cdi', embauche: '2024-03-01', brut: 1200, chefDeFamille: true, enfants: 2
    }, 'Amine', 1000);
    K.ajouterSalarie(L, {
      id: 's2', nom: 'Sonia Khelifi', cnss: '', poste: 'Vendeuse',
      contrat: 'cdd', embauche: '2026-01-15', brut: 800
    }, 'Amine', 1001);
    return L;
  };

  t('10.3.0 : un salarié se refuse quand il manque ce sans quoi aucun bulletin n\'est possible', () => {
    const L = K.livreVide('d1', 2026);
    assert.strictEqual(K.salarieValide({ embauche: '2026-01-01', brut: 900 }).ok, false, 'sans nom');
    assert.strictEqual(K.salarieValide({ nom: 'X', brut: 900 }).ok, false, 'sans date d\'embauche');
    assert.strictEqual(K.salarieValide({ nom: 'X', embauche: '2026-01-01', brut: 0 }).ok, false, 'sans brut');
    assert.strictEqual(K.salarieValide({ nom: 'X', embauche: '2026-01-01', brut: 900, sortie: '2025-01-01' }).ok, false,
      'une sortie avant l\'embauche');
    // Le reste se complète plus tard : on ne bloque pas une paie parce qu'un numéro CNSS manque.
    const ok = K.ajouterSalarie(L, { nom: 'X', embauche: '2026-01-01', brut: 900 }, 'Amine', 1);
    assert.strictEqual(ok.ok, true, 'un salarié sans numéro CNSS entre quand même');
    assert.strictEqual(ok.salarie.cnss, '');
    // Un salarié qui part ne s'EFFACE pas : son nom vit sur des bulletins déjà établis.
    K.retirerSalarie(L, ok.salarie.id, 'Amine', 2);
    assert.strictEqual(L.salaries.length, 1, 'le salarié reste dans la liste');
    assert.strictEqual(L.salaries[0].actif, false, 'il devient inactif');
  });

  t('10.3.0 : un bulletin garde une COPIE de son calcul, et ne se double pas', () => {
    const L = livreAvecPaie();
    const r = K.ajouterBulletin(L, { salarieId: 's1', annee: 2026, mois: 3, brut: 1200 }, {}, 'Amine', 10);
    assert.strictEqual(r.ok, true, r.motif);
    assert.ok(r.bulletin.calcul && r.bulletin.calcul.net > 0, 'le calcul est figé sur le bulletin');
    assert.ok(r.bulletin.calcul.rates, 'les taux qui ont servi sont figés avec lui');
    // Le même salarié, le même mois : refusé, en le NOMMANT.
    const deux = K.ajouterBulletin(L, { salarieId: 's1', annee: 2026, mois: 3, brut: 1200 }, {}, 'Amine', 11);
    assert.strictEqual(deux.ok, false);
    assert.ok(/déjà un bulletin pour mars 2026/.test(deux.motif), deux.motif);
    // Un bulletin d'un AUTRE exercice n'entre pas dans ce livre.
    const ailleurs = K.ajouterBulletin(L, { salarieId: 's1', annee: 2025, mois: 3, brut: 1200 }, {}, 'Amine', 12);
    assert.strictEqual(ailleurs.ok, false);
    assert.ok(/exercice 2026/.test(ailleurs.motif), ailleurs.motif);
  });

  t('10.3.0 : le bulletin du Cabinet est EXACTEMENT celui de l\'app entreprise', () => {
    // Deux chemins, un seul résultat — la même exigence que la parité des balances (9.1.0).
    const L = livreAvecPaie();
    const saisie = { brut: 1200, joursTravailles: 26, joursAbsence: 3,
      primes: [{ label: 'Prime de rendement', amount: 200, taxable: true }],
      retenues: [{ label: 'Avance', amount: 50 }] };
    const r = K.ajouterBulletin(L, { salarieId: 's1', annee: 2026, mois: 4, ...saisie }, {}, 'Amine', 20);
    assert.strictEqual(r.ok, true, r.motif);
    // Le même salarié, la même saisie, par le chemin de l'app entreprise.
    const cote = C.computePayslip(
      { grossSalary: 1200, headOfFamily: true, children: 2 },
      { gross: 1200, workedDays: 26, absentDays: 3,
        bonuses: [{ label: 'Prime de rendement', amount: 200, taxable: true }],
        deductions: [{ label: 'Avance', amount: 50 }] },
      C.payrollSettings({}));
    assert.deepStrictEqual(r.bulletin.calcul, cote, 'les deux applications doivent rendre le MÊME bulletin');
    // Et le net n'est pas un chiffre rond : le jeu discrimine (9.6.1).
    assert.ok(r.bulletin.calcul.net !== Math.round(r.bulletin.calcul.net),
      'un net qui tombe rond ne prouverait rien du barème');
  });

  t('10.3.0 : l\'écriture de paie est équilibrée, et identique à celle de l\'app entreprise', () => {
    const L = livreAvecPaie();
    K.ajouterBulletin(L, { salarieId: 's1', annee: 2026, mois: 5, brut: 1200 }, {}, 'Amine', 30);
    K.ajouterBulletin(L, { salarieId: 's2', annee: 2026, mois: 5, brut: 800 }, {}, 'Amine', 31);
    const prop = K.ecritureDePaie(L, 2026, 5, {});
    assert.strictEqual(prop.ok, true, prop.motif);
    assert.strictEqual(prop.date, '2026-05-31', 'une écriture de paie tombe au dernier jour du mois');
    assert.strictEqual(prop.lot.length, 2);
    const lignes = prop.ecriture.lignes;
    const deb = K.round3(lignes.reduce((s, l) => s + l.debit, 0));
    const cre = K.round3(lignes.reduce((s, l) => s + l.credit, 0));
    assert.strictEqual(deb, cre, 'débit = crédit');
    assert.ok(lignes.every(l => l.debit >= 0 && l.credit >= 0), 'aucun débit ni crédit négatif (règle 6.3.0)');
    // Les comptes sont ceux de l'app entreprise : un schéma recopié divergerait au premier ajustement.
    const acc = C.DEFAULT_ACCOUNTS;
    assert.strictEqual(K.COMPTES_PAIE.salairesBruts, acc.salairesBruts);
    assert.strictEqual(K.COMPTES_PAIE.chargesPatronales, acc.chargesPatronales);
    assert.strictEqual(K.COMPTES_PAIE.taxesSalaires, acc.taxesSalaires);
    assert.strictEqual(K.COMPTES_PAIE.tfpFoprolos, acc.tfpFoprolos);
    assert.strictEqual(K.COMPTES_PAIE.cnss, acc.cnss);
    assert.strictEqual(K.COMPTES_PAIE.irpp, acc.irpp);
    assert.strictEqual(K.COMPTES_PAIE.personnel, acc.personnel);
    // Le brut débité est celui des deux bulletins, et le net crédité celui qu'on versera.
    const masse = K.masseSalariale(K.bulletinsDuMois(L, 2026, 5));
    const surCompte = c => K.round3(lignes.filter(l => l.compte === c).reduce((s, l) => s + l.debit - l.credit, 0));
    assert.strictEqual(surCompte(K.COMPTES_PAIE.salairesBruts), masse.brut);
    assert.strictEqual(surCompte(K.COMPTES_PAIE.personnel), K.round3(-(masse.net + masse.retenues)));
    assert.strictEqual(surCompte(K.COMPTES_PAIE.cnss), K.round3(-(masse.cnssSalarie + masse.cnssEmployeur + masse.accident)));
  });

  t('10.3.0 : une paie passée ne se repasse pas, et un bulletin écrit ne se réécrit pas', () => {
    const L = livreAvecPaie();
    K.ajouterBulletin(L, { salarieId: 's1', annee: 2026, mois: 6, brut: 1200 }, {}, 'Amine', 40);
    const prop = K.ecritureDePaie(L, 2026, 6, {});
    const e = K.ajouterEcriture(L, prop.ecriture, 'Amine', 41);
    K.noterEcriturePaie(L, prop.lot, e.id, 'Amine', 41);
    // Sans le report, le bouton se rallumerait et la paie du mois serait comptée deux fois (9.7.0).
    assert.strictEqual(K.bulletinsDuMois(L, 2026, 6)[0].ecritureId, e.id);
    const encore = K.ecritureDePaie(L, 2026, 6, {});
    assert.strictEqual(encore.ok, false);
    assert.ok(/Aucun bulletin à passer/.test(encore.motif), encore.motif);
    // Et le bulletin lui-même est figé tant que l'écriture n'est pas contre-passée.
    const id = K.bulletinsDuMois(L, 2026, 6)[0].id;
    const maj = K.ajouterBulletin(L, { id, salarieId: 's1', annee: 2026, mois: 6, brut: 1500 }, {}, 'Amine', 42);
    assert.strictEqual(maj.ok, false);
    assert.ok(/contre-passe/.test(maj.motif), maj.motif);
    assert.strictEqual(K.supprimerBulletin(L, id, 'Amine', 43).ok, false, 'et il ne se supprime pas non plus');
  });

  t('10.3.0 : la déclaration CNSS additionne le trimestre, et dit son échéance', () => {
    const L = livreAvecPaie();
    [10, 11, 12].forEach((m, i) => {
      K.ajouterBulletin(L, { salarieId: 's1', annee: 2026, mois: m, brut: 1200 }, {}, 'Amine', 50 + i);
      K.ajouterBulletin(L, { salarieId: 's2', annee: 2026, mois: m, brut: 800 }, {}, 'Amine', 60 + i);
    });
    const d = K.cnssDuTrimestre(L, 2026, 4);
    assert.strictEqual(d.salaries, 2, 'un salarié par ligne');
    assert.strictEqual(d.bulletins, 6);
    assert.strictEqual(d.lignes[0].mois, 3, 'trois mois par salarié');
    // Les totaux tombent sur ceux des bulletins : deux chemins, un seul chiffre.
    const masse = K.masseSalariale((L.bulletins || []).filter(b => [10, 11, 12].includes(b.mois)));
    assert.strictEqual(d.assiette, masse.assiette);
    assert.strictEqual(d.partSalarie, masse.cnssSalarie);
    assert.strictEqual(d.partEmployeur, masse.cnssEmployeur);
    assert.strictEqual(d.total, K.round3(masse.cnssSalarie + masse.cnssEmployeur + masse.accident));
    // Le 4e trimestre bascule sur l'année suivante : une échéance en 2026-13-15 n'existe pas.
    assert.strictEqual(d.echeance, '2027-01-15');
    assert.strictEqual(K.cnssDuTrimestre(L, 2026, 1).echeance, '2026-04-15');
    // Un trimestre sans bulletin n'est jamais réclamé : il rend une déclaration vide, pas un zéro.
    assert.strictEqual(K.cnssDuTrimestre(L, 2026, 2).lignes.length, 0);
  });

  t('10.3.0 : les contrôles NOMMENT ce qui manque, et ne bloquent rien', () => {
    const L = livreAvecPaie();
    K.ajouterBulletin(L, { salarieId: 's1', annee: 2026, mois: 7, brut: 1200 }, {}, 'Amine', 70);
    const ctrl = K.controlesPaie(L, 2026, 7);
    const ids = ctrl.map(c => c.id);
    assert.ok(ids.includes('bulletins-manquants'), 'Sonia n\'a pas de bulletin en juillet');
    assert.ok(ctrl.find(c => c.id === 'bulletins-manquants').detail.includes('Sonia Khelifi'),
      'le contrôle NOMME le salarié : un compte sans les noms ne se traduit en aucun geste');
    assert.ok(ids.includes('cnss-manquant'), 'Sonia n\'a pas de numéro CNSS');
    assert.ok(ids.includes('non-payes'), 'le bulletin de Mohamed n\'est pas réglé');
    // Et l'écriture passe QUAND MÊME : un mois traité avec deux manques signalés vaut mieux qu'un
    // mois jamais traité (règle 6.0.0).
    assert.strictEqual(K.ecritureDePaie(L, 2026, 7, {}).ok, true);
  });

  t('10.3.0 : le livre porte ses salariés et ses bulletins, et un livre ancien ne tombe pas', () => {
    const L = K.livreVide('d1', 2026);
    assert.ok(Array.isArray(L.salaries) && Array.isArray(L.bulletins), 'les deux listes sont posées');
    // Un livre écrit par une version d'avant n'en porte pas : la lecture les rend, sans réécrire le
    // fichier (une liste ajoutée est compatible, un champ renommé ne l'est pas — 9.7.0).
    const ancien = K.livreVide('d1', 2026);
    delete ancien.salaries; delete ancien.bulletins;
    const migre = K.migrerLivre(ancien);
    assert.deepStrictEqual(migre.salaries, []);
    assert.deepStrictEqual(migre.bulletins, []);
    assert.strictEqual(K.isValidLivre(migre), true, 'un livre migré reste un livre valable');
  });

  t('10.3.0 : le Cabinet n\'écrit rien chez le client, la paie comprise', () => {
    // La règle qui ne bouge pas depuis Cabinet 1.0.0. On relit la tranche de la 10.3.0 et on exige
    // qu'elle ne contienne aucun appel d'écriture vers les données du client.
    const src = lireSource('src', 'cabinet', 'main.js');
    const i = src.indexOf("ipcMain.handle('cab:paie'");
    const j = src.indexOf("ipcMain.handle('cab:inventaire'");
    assert.ok(i > 0 && j > i, 'la tranche de la paie n\'a pas été trouvée');
    const zone = src.slice(i, j);
    assert.ok(zone.length > 1500, 'découpage raté');
    ['data:save', 'pack:build'].forEach(x => assert.ok(!zone.includes(x), 'la paie écrit chez le client : ' + x));
    // Tout passe par la porte UNIQUE d'écriture du livre (9.2.0) : verrou, écriture et piste
    // d'audit dans le même mouvement. Deux portes, c'est la garantie qu'un jour l'une oubliera
    // l'audit — et un livre comptable sans piste d'audit ne vaut rien devant un contrôle.
    assert.ok(!/getStore\(\)\.ecrireLivre/.test(zone), 'un handler de paie écrit le livre sans passer par ecrireLeLivre');
    const ecritures = (zone.match(/ecrireLeLivre\(/g) || []).length;
    assert.strictEqual(ecritures, 5, 'les cinq gestes qui modifient le livre passent par la porte unique');
    // Et les droits : ce qui SAISIT demande « saisie », ce qui écrit une pièce demande « validation ».
    assert.ok(/droitBlock\(dossierId, 'validation'\)/.test(zone.slice(zone.indexOf("cab:ecrirePaie"))),
      'passer l\'écriture de paie doit demander le droit de valider');
    // La LECTURE reste ouverte à tous : des données en otage seraient pires que le refus (6.4.0).
    const lecture = zone.slice(zone.indexOf("cab:paie'"), zone.indexOf("cab:saveSalarie"));
    assert.ok(!/droitBlock/.test(lecture), 'lire la paie d\'un dossier ne demande aucun droit');
  });
};
