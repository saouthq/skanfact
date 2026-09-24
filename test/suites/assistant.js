'use strict';
// ============================================================================================
// L'assistant de démarrage COMPLET de SkanFact (10.14.0, suite)
//
// La 10.14.0 a retourné l'assistant : une porte d'abord, trois questions ensuite, le reste au moment
// où il sert. Ce qui manquait pour qu'un premier jour aille jusqu'au bout — noté dans A-FAIRE.md § 4 bis
// et demandé par Skander (« on va passer à l'assistant de démarrage complet ») :
//   A2–A4        les devises par leur nom, l'étoile des champs obligatoires, le compteur en toutes lettres ;
//   numérotation continuer à FAC-2026-048 au lieu de repartir à 001 ;
//   la porte     « j'ai déjà une clé de licence », « je rejoins un dossier partagé » ;
//   le reste     le compte bancaire depuis le RIB, le mot de passe avec la copie, la messagerie,
//                l'import depuis un tableur, et la facture « à ton image » avec son aperçu.
module.exports = ({ t, assert, lireSource }) => {
const C = require('../../src/renderer/core.js');
const app = lireSource('src', 'renderer', 'app.js');
// Le code sans ses commentaires : un commentaire qui cite la forme interdite ne doit pas faire tomber
// le test, ni une forme décrite en commentaire le faire passer (6.8.0, 7.25.0).
const code = app.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

// ------------------------------------------------------------------ A2, A3, A4
t('10.14.0 (A2) : chaque devise proposée porte son NOM, dans chaque liste de devises', () => {
  // « MAD » et « DZD » ne disent rien à qui n'a jamais facturé au Maroc ou en Algérie, et une devise
  // choisie par erreur fausse toute la pièce (7.0.1).
  C.CURRENCIES.forEach(c => {
    const l = C.libelleDevise(c);
    assert.ok(l.startsWith(c + ' — ') && l.length > c.length + 5, `la devise ${c} n'a pas de nom : « ${l} »`);
  });
  assert.strictEqual(C.libelleDevise('DT'), 'DT — dinar tunisien');
  // Et CHAQUE liste passe par lui — un compte « au moins N » laisserait passer la cinquième (10.12.0).
  const listes = code.split('C.CURRENCIES.map(').slice(1).map(x => x.slice(0, 160));
  assert.ok(listes.length >= 4, 'les listes de devises n\'ont pas été trouvées');
  listes.forEach(x => assert.ok(/C\.libelleDevise\(/.test(x), 'une liste de devises montre le code nu : ' + x.slice(0, 90)));
});

t('10.14.0 (A3) : un champ obligatoire porte l\'étoile — nulle part « OBLIGATOIRE » en orange — et l\'assistant pose sa légende', () => {
  assert.ok(!/class="req"/.test(code), 'il reste un « obligatoire » en toutes lettres à côté d\'un champ');
  assert.ok(!/^\.req\s*\{/m.test(lireSource('src', 'renderer', 'style.css')), 'la règle `.req` n\'a plus rien à styler');
  // Les trois champs qui le portaient : la raison sociale de l'assistant, et les deux taux de change.
  assert.ok(/<label class="field span-2 obligatoire">\$\{lbl\('Raison sociale', 'co\.name'\)\}/.test(code), 'la raison sociale de l\'assistant n\'a plus son étoile');
  ['rate-field', 'b-rate-field'].forEach(id => assert.ok(new RegExp(`<label class="field obligatoire" id="${id}"`).test(code), `le taux de change (#${id}) n'a plus son étoile`));
  // La légende se DÉDUIT de l'étoile, dans l'assistant comme dans une fenêtre (7.20.0).
  const i = code.indexOf('function runSetup(');
  const z = code.slice(i, code.indexOf('\n  }\n', i));
  assert.ok(/if \(\$\('\.field\.obligatoire', root\) && !\$\('\.oblig-note', root\)\)/.test(z), 'l\'assistant ne pose plus la légende de l\'étoile');
});

t('10.14.0 (A4) : le compteur de l\'assistant se lit « Question n sur N », comme dans le Cabinet', () => {
  const i = code.indexOf('function runSetup(');
  const z = code.slice(i, code.indexOf('\n  }\n', i));
  assert.ok(/<div class="setup-step">Question \$\{i\} sur \$\{questions\.length\}<\/div>/.test(z), '« 2 / 3 » se lit comme une date ou une fraction');
  const cab = lireSource('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/Question \$\{/.test(cab), 'le Cabinet, modèle de ce compteur, ne l\'écrit plus ainsi');
});

// ------------------------------------------------------------------ la numérotation continue
// Quelqu'un qui facturait déjà — dans un autre logiciel, sur un carnet — voyait sa première facture
// SkanFact porter FAC-2026-001 : un doublon avec sa vraie 001 de l'année, sur une pièce légale.
// La suite se règle par le numéro qu'on a sous les yeux (celui de sa DERNIÈRE pièce), et
// `nextNumber` — la fonction de l'émission — fait la suivante.
const vierge = () => ({ documents: [], counters: {} });
const piece = (type, number, status) => ({ id: 'd-' + number, type, number, status: status || 'envoyée', date: '2026-03-10' });

t('10.14.0 : continuer sa numérotation — 47 donne FAC-2026-048, par la MÊME fonction que l\'émission', () => {
  const d = vierge();
  const e0 = C.etatNumerotation(d, 'facture', '2026');
  assert.strictEqual(e0.prochaine, 'FAC-2026-001');
  assert.strictEqual(e0.verrouillee, false);
  const r = C.poserNumerotation(d, 'facture', '2026', '47');
  assert.ok(r.ok && r.change, 'une suite neuve doit s\'accepter : ' + JSON.stringify(r));
  assert.strictEqual(r.etat.prochaine, 'FAC-2026-048');
  assert.strictEqual(r.etat.derniereNumero, 'FAC-2026-047');
  // Ce que l'écran annonce est ce que l'émission donne : `nextNumber`, pas une seconde règle.
  assert.strictEqual(C.nextNumber(d, 'facture', '2026-03-10'), 'FAC-2026-048');
  // Une autre année ne bouge pas : la série de 2027 repart à 001.
  assert.strictEqual(C.etatNumerotation(d, 'facture', '2027').prochaine, 'FAC-2027-001');
  // Rien d'autre n'est touché : les avoirs gardent leur propre série.
  assert.strictEqual(C.etatNumerotation(d, 'avoir', '2026').prochaine, 'AVO-2026-001');
});

t('10.14.0 : une série de factures déjà numérotée ICI ne se règle plus — et le refus le dit sans rien écrire', () => {
  const d = vierge();
  d.documents.push(piece('facture', 'FAC-2026-012'));
  const e = C.etatNumerotation(d, 'facture', '2026');
  assert.strictEqual(e.verrouillee, true, 'une facture numérotée ici doit fermer le réglage de sa série');
  assert.strictEqual(e.prochaine, 'FAC-2026-013');
  const avant = JSON.stringify(d.counters);
  const r = C.poserNumerotation(d, 'facture', '2026', '60');
  assert.ok(!r.ok, 'une série tenue par SkanFact ne doit plus se déplacer');
  assert.ok(/Tes factures de 2026 sont déjà numérotées/.test(r.motif) && /FAC-2026-012/.test(r.motif), 'le refus ne nomme pas la série : ' + r.motif);
  assert.strictEqual(JSON.stringify(d.counters), avant, 'un refus a écrit dans les compteurs');
  // Redire la même valeur n'est pas un changement : ce n'est pas un refus.
  const meme = C.poserNumerotation(d, 'facture', '2026', '12');
  assert.ok(meme.ok && !meme.change, 'retaper la valeur actuelle doit passer sans rien changer');
  // L'avoir porte son propre verrou, accordé — « tes avoirs … numérotés ».
  d.documents.push(piece('avoir', 'AVO-2026-002'));
  const ra = C.poserNumerotation(d, 'avoir', '2026', '9');
  assert.ok(!ra.ok && /Tes avoirs de 2026 sont déjà numérotés/.test(ra.motif), 'le refus des avoirs n\'est pas accordé : ' + ra.motif);
});

t('10.14.0 : un devis se règle même numéroté ici, jamais sous une pièce existante ; une saisie illisible est refusée', () => {
  const d = vierge();
  d.documents.push(piece('devis', 'DEV-2026-005', 'accepté'));
  assert.strictEqual(C.etatNumerotation(d, 'devis', '2026').verrouillee, false, 'un devis n\'a pas la valeur légale d\'une facture');
  const bas = C.poserNumerotation(d, 'devis', '2026', 3);
  assert.ok(!bas.ok && /DEV-2026-005 existe déjà/.test(bas.motif), 'on doit refuser de descendre sous une pièce existante : ' + bas.motif);
  const haut = C.poserNumerotation(d, 'devis', '2026', 10);
  assert.ok(haut.ok && haut.etat.prochaine === 'DEV-2026-011', 'un devis doit pouvoir suivre un ancien carnet');
  // Une saisie qui n'est pas un entier entre 0 et 99 999 ne s'écrit pas.
  const f = vierge();
  for (const x of ['4,7', '-1', 'abc', '100000', '2.5']) {
    const r = C.poserNumerotation(f, 'facture', '2026', x);
    assert.ok(!r.ok && /nombre entier/.test(r.motif), `« ${x} » ne devait pas s'accepter`);
  }
  assert.deepStrictEqual(f.counters, {}, 'une saisie refusée a écrit un compteur');
  // Vider la case rend la série à 001 — tant que rien n'est numéroté ici.
  C.poserNumerotation(f, 'facture', '2026', 47);
  const vide = C.poserNumerotation(f, 'facture', '2026', '');
  assert.ok(vide.ok && vide.etat.prochaine === 'FAC-2026-001', 'vider la case ne ramène pas la série à 001');
});

t('10.14.0 : la question « tu facturais déjà ? » ne se pose qu\'à la toute première facture (ou au premier avoir)', () => {
  const d = vierge();
  assert.strictEqual(C.premiereNumerotation(d, 'facture', '2026'), true);
  assert.strictEqual(C.premiereNumerotation(d, 'avoir', '2026'), true);
  assert.strictEqual(C.premiereNumerotation(d, 'devis', '2026'), false, 'un devis n\'a pas de numéro à l\'émission : la question n\'y a pas sa place');
  C.poserNumerotation(d, 'facture', '2026', 47);
  assert.strictEqual(C.premiereNumerotation(d, 'facture', '2026'), false, 'une suite déjà réglée ne se redemande pas');
  // Une facture numérotée une autre année : on utilise SkanFact, la question n'a plus de sens.
  const e = vierge();
  e.documents.push(piece('facture', 'FAC-2025-031'));
  assert.strictEqual(C.premiereNumerotation(e, 'facture', '2026'), false, 'la question revient au 1er janvier chez quelqu\'un qui facture déjà ici');
});

t('10.14.0 : Paramètres → Documents → Numérotation — l\'aperçu ne touche pas aux données, et un refus n\'enregistre RIEN du reste', () => {
  assert.ok(/'p-numerotation': \{ onglet: 'documents'/.test(code), 'le panneau n\'est pas déclaré dans les Documents');
  assert.ok(/\$\{panneau\('p-numerotation', info\('doc\.numerotation'\)\)\}/.test(code), 'le panneau n\'est pas posé avec sa bulle');
  assert.ok(/\$\{C\.TYPES_NUMEROTES\.map\(type => \{/.test(code), 'le tableau ne se déduit plus des types numérotés');
  // L'essai tourne sur une COPIE des compteurs : taper une valeur ne doit rien écrire avant « Enregistrer ».
  assert.ok(/const numEssai = el => C\.poserNumerotation\(\{ documents: data\.documents, counters: \{ \.\.\.data\.counters \} \}, /.test(code), 'l\'aperçu de la numérotation écrit dans les données');
  const i = code.indexOf('const applySettings = () => {');
  const z = code.slice(i, i + 2400);
  const controle = z.indexOf('if (!r.ok) { refus(el, r.motif); return false; }');
  assert.ok(controle > 0, 'l\'enregistrement ne refuse plus une numérotation fausse');
  assert.ok(controle < z.indexOf('Object.assign(data.company'), 'le contrôle de la numérotation doit passer AVANT toute écriture (6.0.0)');
  assert.ok(/\$\('#save'\)\.onclick = \(\) => \{ if \(applySettings\(\)\) toast\(/.test(code), '« Enregistrer » annonce « enregistré » après un refus');
  // Trouvé à la souris : le motif posé DANS la ligne élargissait la dernière colonne, le tableau
  // redistribuait les autres, et le champ où l'on tapait partait de 220 px sous le curseur (H-E1).
  // Il vit dans une place réservée, AU-DESSUS du tableau — dessous, la barre « Modifications non
  // enregistrées » le recouvrait —, et les colonnes se décident sur l'en-tête.
  assert.ok(!/data-num-motif/.test(code), 'le motif d\'un refus est revenu dans la ligne du tableau');
  const motif = code.indexOf('<p class="small num-motif" id="num-motif" aria-live="polite"></p>');
  assert.ok(motif > 0 && motif < code.indexOf('<table class="list compact" id="num-table">'), 'le motif doit avoir sa place réservée AVANT le tableau');
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/#num-table \{ table-layout: fixed; \}/.test(css), 'les colonnes de la numérotation suivent encore ce qu\'on tape');
  assert.ok(/#num-motif, #nf-motif \{ min-height: 1\.5em;/.test(css), 'la place du motif n\'est plus réservée : il pousse ce qui suit en apparaissant');
  assert.ok(/\.num-prefixe \{ white-space: nowrap;/.test(css), 'le préfixe « FAC-2026- » peut de nouveau se couper sur deux lignes');
});

t('10.14.0 : la première émission propose de continuer la numérotation, et « Exporter en PDF » passe par le même récapitulatif', () => {
  const i = code.indexOf('function confirmerEmission(');
  const r = code.slice(i, code.indexOf('\n  function ', i + 10));
  assert.ok(/const premiere = !doc\.number && C\.premiereNumerotation\(data, doc\.type, annee\);/.test(r), 'la première émission n\'est plus reconnue');
  assert.ok(/\$\{premiere \? `[\s\S]{0,400}id="num-suite"/.test(r), 'l\'offre de continuer la numérotation n\'est plus liée à la PREMIÈRE émission');
  // Le numéro annoncé se recalcule par `peekNumber` — la même règle que l'émission.
  assert.ok(/numerotationForm\(doc\.type, annee, \(\) => \{\s*const n = peekNumber\(doc\.type, doc\.date\);/.test(r), 'le titre ne se recalcule pas après le réglage');
  // Le chemin PDF émettait par une boîte à deux choix : sans récapitulatif, sans avertissements.
  const p = code.slice(code.indexOf("$('#pdf').onclick = async () => {"), code.indexOf("$('#pdf').onclick = async () => {") + 1800);
  assert.ok(/await confirmerEmission\(doc, n, issueWarnings\(\), \{ exporter: true \}\)/.test(p), '« Exporter en PDF » émet sans le récapitulatif ni les avertissements');
  assert.ok(!/choiceDialog\(/.test(p.slice(0, p.indexOf('exportPdf(docById(doc.id))'))), 'une boîte à deux choix émet encore à côté du récapitulatif');
  assert.ok(/if \(c === 'emettre'\) \{ if \(!issue\(\)\) return; \}/.test(p), 'le choix « Émettre et exporter » n\'émet plus');
  assert.ok(/id="em-brouillon">Exporter le brouillon/.test(r) && /finish\(close, 'brouillon'\)/.test(r), 'le brouillon ne s\'exporte plus depuis le récapitulatif');
  // La fenêtre de réglage : l'aperçu sur une copie, l'écriture au seul bouton, le refus montré.
  const j = code.indexOf('function numerotationForm(');
  const f = code.slice(j, code.indexOf('\n  function ', j + 10));
  assert.ok(/const essai = \(\) => C\.poserNumerotation\(\{ documents: data\.documents, counters: \{ \.\.\.data\.counters \} \}/.test(f), 'l\'aperçu de la fenêtre écrit dans les données');
  assert.ok(/if \(!r\.ok\) return refus\(champ, r\.motif\);/.test(f), 'un refus de la fenêtre ne montre pas la case');
  assert.ok(/C\.poserNumerotation\(data, type, annee, champ\.value\);\s*if \(!r\.ok\) return refus/.test(f) && /save\(true\)/.test(f), 'la fenêtre n\'enregistre pas la suite réglée');
});
};
