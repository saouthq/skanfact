'use strict';
// ============================================================================================
// Le calculateur de prix (10.15.0, H6 de l'étude Hesabi)
//
// Un prix de vente se DÉDUIT d'un coût et d'une règle. Ce que ces tests tiennent :
//   • les quatre règles donnent les montants calculés À LA MAIN, et disent la même marge de trois façons ;
//   • l'arrondi porte sur le prix que voit le client (le TTC), toujours AU-DESSUS, et le HT retombe
//     exactement sur lui quand c'est possible — sinon la fenêtre le dit ;
//   • les frais par unité entrent dans le coût, et le coût rendu à la fiche les comprend ;
//   • ce qui ne peut pas donner un prix se refuse en le disant (coût absent, marque à 100 %) ;
//   • hors régime de TVA, le calculateur ne touche jamais au taux (10.14.0 : un taux grisé n'est pas
//     un taux choisi) ;
//   • la règle choisie est retenue, et seulement quand on applique.
module.exports = ({ t, assert, lireSource }) => {
  const C = require('../../src/renderer/core.js');
  const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const tranche = (src, debut) => {
    const i = src.indexOf(debut);
    assert.ok(i >= 0, 'introuvable : ' + debut);
    return src.slice(i, src.indexOf('\n  }\n', i));
  };

  t('H6 : les quatre règles, calculées à la main, et la même marge dite de trois façons', () => {
    // Coût 100, TVA 19 % : × 1,6 = 160 HT = 190,400 TTC ; marge 60, soit 60 % du coût et 37,5 % du prix.
    for (const [mode, valeur] of [['coef', 1.6], ['marge', 60], ['marque', 37.5]]) {
      const r = C.calculPrix({ cout: 100, tva: 19, mode, valeur });
      assert.ok(r.ok, mode);
      assert.strictEqual(r.ht, 160, mode + ' : HT');
      assert.strictEqual(r.ttc, 190.4, mode + ' : TTC');
      assert.strictEqual(r.marge, 60, mode + ' : marge');
      assert.strictEqual(r.tauxMarge, 60, mode + ' : taux de marge');
      assert.strictEqual(r.tauxMarque, 37.5, mode + ' : taux de marque');
      assert.strictEqual(r.coef, 1.6, mode + ' : coefficient');
    }
    // Un coût qui ne tombe pas rond : 37,420 × 1,35 = 50,517 HT ; × 1,07 = 54,05319 → 54,053 TTC.
    const r = C.calculPrix({ cout: 37.42, tva: 7, mode: 'coef', valeur: 1.35 });
    assert.strictEqual(r.ht, 50.517);
    assert.strictEqual(r.ttc, 54.053);
    assert.strictEqual(r.marge, 13.097);
    // Le coefficient tapé « à la française » est lu.
    assert.strictEqual(C.calculPrix({ cout: 100, tva: 0, mode: 'coef', valeur: '1,25' }).ht, 125);
  });

  t('H6 : le prix TTC visé retire la TVA, et le HT retombe EXACTEMENT sur le prix d\'étiquette', () => {
    // 190 / 1,19 = 159,6638… → 159,664 ; 159,664 × 1,19 = 190,00016 → 190,000.
    const r = C.calculPrix({ cout: 100, tva: 19, mode: 'ttc', valeur: 190 });
    assert.strictEqual(r.ht, 159.664);
    assert.strictEqual(r.ttc, 190);
    assert.ok(r.exact);
    // Sans coût, un prix visé se calcule quand même : il ne dépend pas du coût (la marge, si).
    const s = C.calculPrix({ cout: 0, tva: 7, mode: 'ttc', valeur: 10.7 });
    assert.ok(s.ok); assert.strictEqual(s.ht, 10); assert.strictEqual(s.tauxMarge, null);
  });

  t('H6 : l\'arrondi porte sur le TTC, toujours au-dessus, et ne rogne jamais la marge demandée', () => {
    // 12,350 × 1,8 = 22,230 HT → 26,4537 TTC → arrondi au 0,500 supérieur : 26,500 ;
    // 26,5 / 1,19 = 22,2689 → 22,269 HT, et 22,269 × 1,19 = 26,50011 → 26,500 : exact.
    const r = C.calculPrix({ cout: 12.35, tva: 19, mode: 'coef', valeur: 1.8, arrondi: 0.5 });
    assert.strictEqual(r.ttc, 26.5);
    assert.strictEqual(r.ht, 22.269);
    assert.ok(r.ht >= 22.23, 'l\'arrondi a rogné la marge');
    // Au dinar : 30 TTC.
    assert.strictEqual(C.calculPrix({ cout: 12.35, tva: 19, mode: 'coef', valeur: 1.8, arrondi: 1 }).ttc, 27);
    // Sur mille coûts et coefficients tirés d'une suite fixe : TTC multiple du pas, jamais sous le prix
    // demandé, et HT × (1 + TVA) = TTC chaque fois que le calculateur dit « exact ».
    let g = 7;
    const hasard = () => { g = (g * 48271) % 2147483647; return g / 2147483647; };
    for (let n = 0; n < 1000; n++) {
      const cout = Math.round(hasard() * 500000) / 1000, valeur = 1 + Math.round(hasard() * 200) / 100;
      const tva = C.VAT_RATES[Math.floor(hasard() * 4)], arrondi = C.ARRONDIS_PRIX[1 + Math.floor(hasard() * 5)];
      const x = C.calculPrix({ cout, tva, mode: 'coef', valeur, arrondi });
      if (!x.ok) continue;
      const ttcM = Math.round(x.ttc * 1000), pasM = Math.round(arrondi * 1000);
      if (x.exact) assert.strictEqual(ttcM % pasM, 0, `TTC ${x.ttc} n'est pas un multiple de ${arrondi}`);
      assert.ok(x.ttc + 1e-9 >= Math.round(cout * valeur * (1 + tva / 100) * 1000) / 1000 - 0.001, `TTC ${x.ttc} sous le prix demandé (coût ${cout} × ${valeur})`);
      if (x.exact) assert.strictEqual(Math.round(x.ht * 1000 * (1 + tva / 100)), ttcM, `HT ${x.ht} ne retombe pas sur ${x.ttc}`);
    }
  });

  t('H6 : un TTC qu\'aucun HT n\'atteint au millime près se dit « le plus proche »', () => {
    // À 19 %, un millime de HT fait 1,19 millime de TTC : certains TTC n'ont aucun HT. On le cherche,
    // plutôt que de l'écrire, et on exige que le calculateur le dise.
    let trouve = null;
    for (let m = 10000; m < 10100 && !trouve; m++) {
      const ttc = m / 1000;
      const r = C.calculPrix({ cout: 1, tva: 19, mode: 'ttc', valeur: ttc });
      if (!r.exact) trouve = { ttc, r };
    }
    assert.ok(trouve, 'aucun TTC inatteignable trouvé : les données ne discriminent pas');
    assert.ok(Math.abs(trouve.r.ttc - trouve.ttc) <= 0.001, 'le plus proche est loin');
  });

  t('H6 : les frais par unité entrent dans le coût, et en deux décimales pour une devise qui en a deux', () => {
    const r = C.calculPrix({ cout: 12.35, frais: 1.2, tva: 19, mode: 'coef', valeur: 1.8 });
    assert.strictEqual(r.coutComplet, 13.55);
    assert.strictEqual(r.ht, 24.39);   // 13,55 × 1,8
    const e = C.calculPrix({ cout: 10, tva: 7, mode: 'coef', valeur: 1.5, decimales: 2, arrondi: 0.1 });
    // 15 × 1,07 = 16,05 → 16,10 au 0,10 supérieur ; 16,1 / 1,07 = 15,046 → 15,05 ; 15,05 × 1,07 = 16,1035 → 16,10.
    assert.strictEqual(e.ttc, 16.1); assert.strictEqual(e.ht, 15.05);
  });

  t('H6 : ce qui ne peut pas donner un prix se refuse en le disant ; vendre à perte se dit sans refuser', () => {
    assert.ok(/coût/.test(C.calculPrix({ cout: 0, mode: 'coef', valeur: 2 }).motif));
    assert.ok(/100 %/.test(C.calculPrix({ cout: 50, mode: 'marque', valeur: 100 }).motif));
    assert.ok(!C.calculPrix({ cout: 50, mode: 'coef', valeur: '' }).ok);
    assert.ok(!C.calculPrix({ cout: -5, mode: 'coef', valeur: 2 }).ok);
    const p = C.calculPrix({ cout: 100, tva: 0, mode: 'coef', valeur: 0.8 });
    assert.ok(p.ok && p.perte && p.marge === -20);
  });

  t('H6 : la fenêtre applique, retient la règle au seul « Appliquer », et hors régime ne touche jamais au taux', () => {
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    const f = tranche(app, 'function prixCalculForm(');
    assert.ok(f.length > 3000 && f.length < 14000, 'tranche inattendue : ' + f.length);
    assert.ok(/C\.calculPrix\(/.test(f), 'la fenêtre recalcule elle-même le prix');
    assert.ok(!/toFixed\(/.test(f), 'un montant s\'écrit par C.money, jamais toFixed');
    // La règle ne s'écrit que dans le clic d'« Appliquer ».
    const clic = f.slice(f.indexOf('ok.onclick'));
    assert.ok(/data\.company\.calculPrix = \{ mode, valeur, arrondi \}/.test(clic), 'la règle n\'est pas retenue à l\'application');
    assert.strictEqual((f.match(/company\.calculPrix =/g) || []).length, 1, 'la règle s\'écrit ailleurs qu\'à l\'application');
    // Chaque calcul de la fenêtre (une ligne, toutes les lignes) passe par le taux figé hors régime.
    const calculs = f.match(/C\.calculPrix\(Object\.assign\(\{\}, regleV, \{[^}]*\}/g) || [];
    assert.strictEqual(calculs.length, 2, 'la fenêtre a ' + calculs.length + ' calculs, deux attendus');
    calculs.forEach(c => assert.ok(/tva: o\.tvaFigee \? 0 :/.test(c), 'hors régime, un calcul prend encore le taux : ' + c));
    // Les deux appelants ne rendent le taux qu'au régime réel.
    const cat = tranche(app, 'function catalogForm(');
    assert.ok(/if \(!figee\) \{\s*\$\('select\[name=vatRate\]'/.test(cat), 'la fiche réécrit le taux hors régime');
    const i = app.indexOf("$('#calc-prix').onclick");
    assert.ok(i > 0, 'l\'éditeur n\'a pas son calculateur');
    const ed = app.slice(i, i + 2500);
    assert.ok(/if \(!figee\) l\.vatRate = r\.tva/.test(ed), 'l\'éditeur réécrit le taux hors régime');
    assert.ok(/C\.lineCost\(/.test(ed), 'le coût d\'une ligne sans coût ne vient pas du catalogue');
    // Vu à la souris : la ligne proposée à l'ouverture doit apporter son coût, pas attendre qu'on la rechoisisse.
    assert.ok(/if \(lignes\) surCible\(\); else calculer\(\);/.test(f), 'la ligne proposée à l\'ouverture n\'apporte pas son coût');
    // Pas de calculateur sur un avoir : ses prix viennent de la facture qu'il corrige.
    assert.ok(/isAv \? '' : '<button class="btn btn-sm" id="calc-prix">/.test(app), 'un avoir propose un calcul de prix');
  });

  t('H6 : le résultat a une hauteur FIXE, et « Appliquer » a sa largeur réservée (H-E1)', () => {
    const css = lireSource('src', 'renderer', 'style.css');
    const regle = (css.match(/\.pc-resultat \{[^}]*\}/) || [''])[0];
    assert.ok(/(^|[\s;{])height: \d+px/.test(regle) && /overflow-y: auto/.test(regle), 'le résultat grandit avec son contenu : ' + regle);
    const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
    const f = tranche(app, 'function prixCalculForm(');
    assert.ok(/id="ok" style="min-width:\d+em;justify-content:center"/.test(f), 'le bouton change de largeur avec son libellé');
  });
};
