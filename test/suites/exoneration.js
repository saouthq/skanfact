'use strict';
// ============================================================================================
// Les attestations d'exonération de retenue à la source (10.15.0, H7 de l'étude Hesabi)
//
// Ce que ces tests tiennent :
//   • une attestation couvre ses deux bornes, et rien au-delà ; sans fin, elle n'existe pas ;
//   • un achat chez un fournisseur exonéré PROPOSE 0 %, et l'écran prévient dans les deux sens ;
//   • la facture d'une entreprise exonérée porte la mention seulement quand elle ne retient rien —
//     et la mention se FIGE à l'émission (règle 7.1.x) ;
//   • « À faire » réclame la suivante trente jours avant, jamais pour un fournisseur délaissé ;
//   • SkanFact ne réécrit jamais un taux tout seul.
module.exports = ({ t, assert, lireSource }) => {
  const C = require('../../src/renderer/core.js');
  const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
  const tranche = (debut, longueur) => {
    const i = app.indexOf(debut);
    assert.ok(i >= 0, 'introuvable : ' + debut);
    return app.slice(i, i + longueur);
  };
  const sup = (liste, taux) => ({ id: 's1', name: 'Cabinet Kallel', withholdingRate: taux == null ? 1.5 : taux, exonerationsRS: liste });

  t('H7 : une attestation couvre ses deux bornes, et rien au-delà', () => {
    const s = sup([{ numero: 'A', du: '2026-01-01', au: '2026-06-30' }]);
    assert.strictEqual(C.exonerationRS(s, '2025-12-31'), null, 'la veille du début');
    assert.ok(C.exonerationRS(s, '2026-01-01'), 'le premier jour');
    assert.ok(C.exonerationRS(s, '2026-06-30'), 'le dernier jour');
    assert.strictEqual(C.exonerationRS(s, '2026-07-01'), null, 'le lendemain de la fin');
    // Sans début, elle vaut depuis toujours jusqu'à sa fin.
    assert.ok(C.exonerationRS(sup([{ numero: 'B', au: '2026-06-30' }]), '2019-03-04'));
    // Sans fin, ce n'est pas une attestation : on ne saurait jamais quand reprendre la retenue.
    assert.strictEqual(C.exonerationRS(sup([{ numero: 'C', du: '2026-01-01' }]), '2026-02-01'), null);
    assert.deepStrictEqual(C.attestationsRS(sup([{ numero: 'C', du: '2026-01-01' }])), []);
    // Deux qui se chevauchent (un renouvellement reçu avant la fin) : celle qui va le plus loin.
    const deux = sup([{ numero: 'N', du: '2026-06-01', au: '2026-12-31' }, { numero: 'A', du: '2026-01-01', au: '2026-06-30' }]);
    assert.strictEqual(C.exonerationRS(deux, '2026-06-15').numero, 'N');
    assert.strictEqual(C.derniereAttestationRS(deux).numero, 'N');
  });

  t('H7 : le taux PROPOSÉ vaut 0 pendant l\'exonération, celui de la fiche avant et après', () => {
    const s = sup([{ numero: 'A', du: '2026-01-01', au: '2026-06-30' }], 1.5);
    assert.strictEqual(C.tauxRetenueFournisseur(s, '2026-03-10'), 0);
    assert.strictEqual(C.tauxRetenueFournisseur(s, '2026-07-01'), 1.5);
    assert.strictEqual(C.tauxRetenueFournisseur(s, '2025-12-31'), 1.5);
    assert.strictEqual(C.tauxRetenueFournisseur(sup([], 3), '2026-03-10'), 3, 'sans attestation, la fiche');
    assert.strictEqual(C.tauxRetenueFournisseur(null, '2026-03-10'), 0);
    // Le nouvel achat part de ce taux, pas du taux brut de la fiche.
    const na = tranche('function newPurchase(', 1600);
    assert.ok(/withholdingRate: sup \? C\.tauxRetenueFournisseur\(sup, date\) : 0/.test(na), 'un achat neuf reprend le taux brut de la fiche');
    // Et changer de fournisseur dans l'éditeur aussi.
    const ch = tranche('if (e && e.target && e.target.name === \'supplierId\'', 2600);
    assert.ok(/p\.withholdingRate = C\.tauxRetenueFournisseur\(sup, p\.date\)/.test(ch), 'choisir le fournisseur reprend le taux brut');
  });

  t('H7 : la fiche corrige la dernière attestation, en ajoute une avec un autre numéro, la retire vidée', () => {
    let r = C.appliquerAttestationRS([], { numero: 'A', du: '2026-01-01', au: '2026-06-30' });
    assert.strictEqual(r.liste.length, 1);
    const idA = r.liste[0].id;
    assert.ok(idA, 'une attestation neuve reçoit un identifiant');
    // Le même numéro corrige (une date mal tapée ne fait pas un doublon), et garde l'identifiant.
    r = C.appliquerAttestationRS(r.liste, { numero: 'A', du: '2026-01-01', au: '2026-07-31' });
    assert.strictEqual(r.liste.length, 1);
    assert.strictEqual(r.liste[0].au, '2026-07-31');
    assert.strictEqual(r.liste[0].id, idA);
    // Un autre numéro ajoute : l'ancienne reste, elle explique les achats d'avant.
    r = C.appliquerAttestationRS(r.liste, { numero: 'B', du: '2026-08-01', au: '2027-07-31' });
    assert.deepStrictEqual(r.liste.map(x => x.numero), ['A', 'B']);
    // Les trois cases vidées retirent la DERNIÈRE seulement.
    r = C.appliquerAttestationRS(r.liste, {});
    assert.deepStrictEqual(r.liste.map(x => x.numero), ['A']);
    // Refus, en nommant la case.
    assert.strictEqual(C.appliquerAttestationRS([], { numero: 'X' }).champ, 'au');
    assert.strictEqual(C.appliquerAttestationRS([], { numero: 'X', du: '2026-09-01', au: '2026-01-01' }).champ, 'du');
    assert.ok(/fin/.test(C.appliquerAttestationRS([], { du: '2026-01-01' }).motif));
    // La fiche lit la règle AVANT la porte de licence, et avant d'écrire quoi que ce soit.
    const sf = tranche('function supplierForm(', 4000);
    const iLire = sf.indexOf('lireAttestationRS(s, v, root)'), iLic = sf.indexOf('licenceBlock('), iEcrit = sf.indexOf('Object.assign(s, v');
    assert.ok(iLire > 0 && iLire < iLic && iLic < iEcrit, 'l\'attestation se juge avant la licence et avant d\'écrire');
    // Les Paramètres aussi : un refus n'écrit rien du reste.
    const ap = tranche('const applySettings = () => {', 2600);
    const jLire = ap.indexOf('lireAttestationRS(data.company, v'), jEcrit = ap.indexOf('Object.assign(data.company');
    assert.ok(jLire > 0 && jLire < jEcrit, 'les Paramètres écrivent avant de juger l\'attestation');
    assert.ok(/exonerationsRS: exosCo/.test(ap), 'les Paramètres ne rangent pas l\'attestation');
  });

  t('H7 : l\'écran d\'un achat prévient dans les DEUX sens, sans jamais changer le taux', () => {
    const s = sup([{ numero: 'A', du: '2026-01-01', au: '2026-06-30' }], 1.5);
    const w = C.noteExonerationRS(s, '2026-03-10', 1.5);
    assert.strictEqual(w.ton, 'warn', 'une retenue sur un exonéré');
    assert.ok(/30\/06\/2026/.test(w.texte) && /n°\u00a0A/.test(w.texte));
    assert.strictEqual(C.noteExonerationRS(s, '2026-03-10', 0).ton, 'ok');
    const e = C.noteExonerationRS(s, '2026-09-10', 0);
    assert.strictEqual(e.ton, 'warn', 'une attestation expirée alors que la pièce ne retient plus rien');
    assert.ok(/1,5 %/.test(e.texte));
    assert.strictEqual(C.noteExonerationRS(s, '2026-09-10', 1.5), null, 'expirée et retenue appliquée : rien à dire');
    assert.strictEqual(C.noteExonerationRS(sup([], 1.5), '2026-03-10', 0), null, 'sans attestation : rien à dire');
    assert.strictEqual(C.noteExonerationRS(sup([{ numero: 'A', au: '2025-01-01' }], 0), '2026-03-10', 0), null, 'fiche sans retenue : rien à reprendre');
    // Le règlement se juge à SA date (la retenue naît au paiement, 10.14.0).
    const pf = tranche('function supplierPaymentForm(', 6000);
    assert.ok(/C\.noteExonerationRS\(supRs, d0, p\.withholdingRate\)/.test(pf), 'le règlement ne juge pas l\'exonération à sa date');
    // Et aucune des deux fenêtres ne modifie le taux de la pièce.
    assert.ok(!/p\.withholdingRate\s*=/.test(pf), 'la fenêtre de règlement réécrit le taux');
  });

  t('H7 : la facture d\'une entreprise exonérée porte la mention, seulement si elle ne retient rien', () => {
    const co = { name: 'Menuiserie Ben Salah', matricule: '1234567A', exonerationsRS: [{ numero: '2026/88', du: '2026-01-01', au: '2026-12-31' }] };
    const fac = { type: 'facture', date: '2026-05-02', status: 'brouillon', lines: [{ label: 'Porte', qty: 1, unitPrice: 100, vatRate: 19 }], withholdingRate: 0 };
    const html = C.documentHtml(fac, { name: 'Client' }, co, {});
    assert.ok(/Exonéré de la retenue à la source — attestation n°\u00a02026\/88, valable jusqu'au 31\/12\/2026\./.test(html), 'la mention manque');
    assert.ok(!/Exonéré de la retenue/.test(C.documentHtml({ ...fac, withholdingRate: 1 }, { name: 'Client' }, co, {})), 'mention sur une facture qui retient : la pièce se contredit');
    assert.ok(!/Exonéré de la retenue/.test(C.documentHtml({ ...fac, date: '2027-01-02' }, { name: 'Client' }, co, {})), 'mention hors validité');
    assert.ok(!/Exonéré de la retenue/.test(C.documentHtml({ ...fac, type: 'devis' }, { name: 'Client' }, co, {})), 'mention sur un devis');
    assert.ok(/Exempt from withholding tax — certificate no\.\u00a02026\/88/.test(C.documentHtml({ ...fac, lang: 'en' }, { name: 'Client' }, co, {})), 'la mention anglaise');
    // Une facture ÉMISE garde la mention de son émission — renouveler l'attestation ne la réécrit pas.
    const emise = { ...fac, status: 'envoyée', number: 'FAC-2026-001', exonerationRS: { numero: 'ANCIEN', au: '2026-06-30' } };
    assert.ok(/n°\u00a0ANCIEN/.test(C.documentHtml(emise, { name: 'Client' }, co, {})));
    assert.ok(!/Exonéré/.test(C.documentHtml({ ...emise, exonerationRS: null }, { name: 'Client' }, co, {})), 'émise sans mention : une attestation saisie après ne l\'ajoute pas');
    // Émise avant la 10.15.0 (rien de figé) : partie sans mention, elle le reste.
    const avant = { ...fac, status: 'envoyée', number: 'FAC-2025-009' };
    assert.strictEqual(C.mentionExonerationRS(avant, co), null);
    // L'émission la fige, avant le statut ; une copie ne l'emporte pas.
    const em = tranche('function issue()', 3000);
    const iFige = em.indexOf('doc.exonerationRS = C.mentionExonerationRS('), iSt = em.indexOf('doc.status = isInv');
    assert.ok(iFige > 0 && iFige < iSt, 'l\'émission ne fige pas la mention');
    assert.ok(/exonerationRS: undefined, payments: \[\]/.test(app), '« Dupliquer » emporte la mention figée');
    assert.ok(!('exonerationRS' in C.convertDoc({ ...emise, id: 'x' }, 'avoir', co, '2026-09-01')), 'une conversion emporte la mention figée');
  });

  t('H7 : une retenue sur la facture d\'une entreprise exonérée est signalée avant d\'émettre', () => {
    const iw = tranche('function issueWarnings()', 6000);
    assert.ok(/C\.exonerationRS\(co, doc\.date\)/.test(iw), 'l\'avertissement ne juge pas l\'exonération à la date de la pièce');
    assert.ok(/Number\(doc\.withholdingRate\) > 0/.test(iw.slice(iw.indexOf('exoCo'), iw.indexOf('exoCo') + 200)), 'l\'avertissement ne regarde pas la retenue');
  });

  t('H7 : « À faire » réclame la suivante trente jours avant — pas pour un fournisseur délaissé', () => {
    const today = '2026-12-10';
    const data = {
      suppliers: [
        { id: 'actif', name: 'Transports Gharbi', withholdingRate: 1.5, exonerationsRS: [{ numero: 'T1', au: '2026-12-31' }] },
        { id: 'oublie', name: 'Ancien fournisseur', withholdingRate: 1.5, exonerationsRS: [{ numero: 'O1', au: '2026-12-31' }] },
        { id: 'renouvele', name: 'Imprimerie Nour', withholdingRate: 1.5, exonerationsRS: [{ numero: 'R1', au: '2026-12-20' }, { numero: 'R2', du: '2026-12-21', au: '2027-12-31' }] },
        { id: 'vieux', name: 'Expirée depuis longtemps', withholdingRate: 1.5, exonerationsRS: [{ numero: 'V1', au: '2026-06-30' }] },
        { id: 'recente', name: 'Expirée le mois dernier', withholdingRate: 1.5, exonerationsRS: [{ numero: 'E1', au: '2026-11-20' }] }
      ],
      purchases: [
        { id: 'p1', supplierId: 'actif', date: '2026-10-01' }, { id: 'p2', supplierId: 'oublie', date: '2025-06-01' },
        { id: 'p3', supplierId: 'renouvele', date: '2026-11-01' }, { id: 'p4', supplierId: 'vieux', date: '2026-11-01' },
        { id: 'p5', supplierId: 'recente', date: '2026-11-01' }
      ]
    };
    const co = { name: 'X', exonerationsRS: [{ numero: 'CO', au: '2027-01-05' }] };
    const l = C.exonerationsAFaire(data, co, today);
    assert.deepStrictEqual(l.map(x => x.qui + ':' + (x.id || '') + ':' + x.etat), ['fournisseur:recente:expiree', 'fournisseur:actif:bientot', 'entreprise::bientot']);
    // La valeur par défaut est celle qui ne fait rien : sans attestation, aucune ligne.
    assert.deepStrictEqual(C.exonerationsAFaire({ suppliers: [], purchases: [] }, { name: 'X' }, today), []);
    // « À faire » porte les deux lignes, et l'interface sait les ouvrir.
    const todo = C.todoList({ ...data, documents: [], clients: [] }, co, today, {});
    assert.ok(todo.some(x => x.id === 'exoneration-entreprise'));
    const f = todo.find(x => x.id === 'exonerations-fournisseurs');
    assert.ok(f && f.count === 2 && /Transports Gharbi/.test(f.detail) && !/Ancien fournisseur/.test(f.detail));
    assert.ok(/'exoneration-entreprise': \{ label:/.test(app) && /'exonerations-fournisseurs': \{ label:/.test(app), 'une ligne d\'« À faire » sans bouton');
  });

  // Trouvé à la souris en saisissant « Valable du » : le masque des champs date jetait les barres
  // tapées et redécoupait les chiffres deux par deux. On TAPE, touche par touche, comme un humain.
  t('10.15.0 : un champ date respecte les barres qu\'on tape (« 1/1/2026 » reste le premier janvier)', () => {
    const taper = s => { let v = ''; for (const c of s) v = C.masqueDate(v + c); return v; };
    for (const [tape, attendu, iso] of [['1/1/2026', '1/1/2026', '2026-01-01'], ['12032026', '12/03/2026', '2026-03-12'],
      ['5/6/2026', '5/6/2026', '2026-06-05'], ['1/12/2026', '1/12/2026', '2026-12-01'], ['31/12/2026', '31/12/2026', '2026-12-31'],
      ['010126', '01/01/26', '2026-01-01']]) {
      assert.strictEqual(taper(tape), attendu, 'tapé « ' + tape + ' »');
      assert.strictEqual(C.parseDateInput(taper(tape)), iso, 'lu depuis « ' + tape + ' »');
    }
    assert.strictEqual(C.masqueDate('12 mars'), '12 mars', 'une date en lettres ne se masque pas');
    assert.ok(/txt\.oninput = \(\) => \{\s*const m = C\.masqueDate\(txt\.value\);/.test(app), 'le champ date ne passe pas par le masque');
  });

  t('H7 : chaque case neuve a sa bulle, et la bulle mène à l\'article fiscal', () => {
    const G = require('../../src/renderer/guide.js');
    ['sup.exoRS', 'co.exoRS', 'exo.numero', 'exo.du', 'exo.au'].forEach(k => {
      assert.ok(G.INFO[k] && G.INFO[k].d.length > 60, 'bulle absente ou vide : ' + k);
      assert.strictEqual(G.articleDe(k), 'fiscal', k + ' ne mène pas à l\'article fiscal');
    });
    const art = G.ARTICLES.find(a => a.id === 'fiscal');
    assert.ok(/L'attestation d'exonération/.test(art.body), 'l\'article fiscal ne dit rien de l\'exonération');
  });
};
