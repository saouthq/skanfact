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
// Asynchrone depuis 213d : `messagerie()` est une fonction asynchrone, et un `ta` qu'on n'attend pas
// part détaché — son « ok » s'afficherait après le total, et une assertion qui tombe ne ferait plus
// échouer la commande (8.4.0). Le lanceur attend donc cette suite.
module.exports = async ({ t, ta, assert, lireSource }) => {
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
// ------------------------------------------------------------------ la porte : une clé, un dossier partagé
// Deux personnes n'ont rien à faire de la découverte ni des trois questions : celle qui a DÉJÀ acheté
// (sa clé porte son nom et son matricule) et celle qui rejoint un dossier posé par un associé.
const runSetupZone = () => {
  const i = code.indexOf('function runSetup(');
  return code.slice(i, code.indexOf('\n  }\n', i));
};

t('10.14.0 : la porte offre « j\'ai déjà une clé » et « je rejoins un dossier partagé », sans voler le vert', () => {
  const z = runSetupZone();
  const autres = z.slice(z.indexOf('<div class="sp-autres">'), z.indexOf('</div>', z.indexOf('<div class="sp-autres">')));
  assert.ok(autres.length > 50, 'la rangée des deux autres entrées a disparu de la porte');
  assert.ok(/<button type="button" class="btn btn-sm" id="sf-cle">J'ai déjà une clé de licence…<\/button>/.test(autres), '« J\'ai déjà une clé de licence… » n\'est plus sur la porte');
  assert.ok(/<button type="button" class="btn btn-sm" id="sf-rejoindre">Je rejoins un dossier partagé…<\/button>/.test(autres), '« Je rejoins un dossier partagé… » n\'est plus sur la porte');
  // Un seul vert sur la porte (U-11) : la découverte recommandée. Les deux autres entrées sont discrètes.
  assert.ok(!/btn-primary/.test(autres), 'une des deux autres entrées de la porte a pris le vert de la découverte');
  assert.ok(/\$\('#sf-cle', root\)\.onclick = cleALaPorte;/.test(z), 'la clé de la porte n\'est plus branchée');
  assert.ok(/\$\('#sf-rejoindre', root\)\.onclick = \(\) => rejoindreDossier\(\{ avant: porteVue, remplacerVierge: true,/.test(z), 'rejoindre depuis la porte ne marque plus la porte vue, ou garde le dossier vide');
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.setup-porte \.sp-autres \{ display: flex; flex-wrap: wrap;[^}]*gap:/.test(css), 'la rangée des deux entrées n\'a plus d\'écart décidé : ses boutons se collent');
});

t('10.14.0 : la clé collée à la porte passe par la MÊME porte que le panneau Licence, et l\'assistant reprend avec son nom', () => {
  const z = runSetupZone();
  const i = z.indexOf('const cleALaPorte = () => modal(');
  assert.ok(i > 0, 'la fenêtre de la clé a disparu de l\'assistant');
  const f = z.slice(i, z.indexOf('\n      });', i));
  assert.ok(/st = await bridge\.licenceSet\(k, ''\);/.test(f), 'la clé de la porte ne passe plus par `licence:set`, qui refuse une clé fausse ou celle d\'une autre entreprise');
  assert.ok(/catch \(e\) \{ return refus\(champ, plainError\(e\)\); \}/.test(f), 'un refus de la clé ne se MONTRE plus sur la case (7.0.0)');
  // Le nom de la clé est le nom légal : il remplace une étiquette de dossier, jamais un nom tapé.
  assert.ok(/if \(st\.name && \(!String\(a\.name \|\| ''\)\.trim\(\) \|\| a\.nomDuDossier\)\) \{ a\.name = st\.name; a\.nomDuDossier = false; \}/.test(f), 'le nom de la clé écrase une raison sociale tapée à la main');
  assert.ok(/if \(st\.matricule && !String\(a\.matricule \|\| ''\)\.trim\(\)\) a\.matricule = st\.matricule;/.test(f), 'le matricule de la clé écrase un matricule tapé');
  assert.ok(/a\.depuisLicence = true;/.test(f) && /\$\{a\.depuisLicence \? '<p class="small muted">La raison sociale et le matricule viennent de ta clé de licence/.test(z), 'l\'écran « Ton entreprise » ne dit plus d\'où viennent le nom et le matricule');
  assert.ok(/toast\(licenceEnregistree\(st\)\);\s*etape\(i \+ 1\); i\+\+; draw\(\);/.test(f), 'l\'assistant ne reprend pas à « Ton entreprise » après la clé');
  // Trouvé à la souris : `porteVue` vivait DANS `draw()`, et la fenêtre de la clé l'appelle depuis
  // l'assistant — ReferenceError, la fenêtre se fermait, la clé enregistrée, et l'écran restait sur la
  // porte sans un mot. Elle vit à la portée de l'assistant (et le lint l'aurait dit : no-undef).
  const decl = z.indexOf('const porteVue = ');
  assert.ok(decl > 0 && z.indexOf('const porteVue = ', decl + 1) < 0, 'porteVue est déclarée deux fois (ou plus du tout)');
  assert.ok(decl > z.indexOf('const collect = ') && decl < i, 'porteVue est retournée vivre dans `draw()` : la fenêtre de la clé ne la voit plus');
});

t('10.14.0 : « Licence enregistrée » se dit une fois, au même mot près depuis la porte et depuis le panneau', () => {
  const vm = require('vm');
  const m = code.match(/const licenceEnregistree = (st => [^\n]*);/);
  assert.ok(m, 'la phrase de la licence enregistrée n\'a plus UNE fonction');
  const f = vm.runInNewContext(m[1]);
  assert.strictEqual(f({ label: 'Licence active jusqu\'au 24/09/2027 — offre Entreprise' }),
    'Licence enregistrée : active jusqu\'au 24/09/2027 — offre Entreprise', '« Licence » se dit deux fois dans la même phrase');
  assert.strictEqual(f({ label: 'Licence sans limite de durée — offre Indépendant' }), 'Licence enregistrée : sans limite de durée — offre Indépendant');
  assert.ok((code.match(/licenceEnregistree\((st|licence)\)/g) || []).length >= 2, 'la porte ou le panneau recompose sa propre phrase');
  assert.ok(!/'Licence enregistrée : ' \+ licence\.label/.test(code) && !/Licence enregistrée — \$\{st\.label\}/.test(code), 'une ancienne phrase « Licence enregistrée » est revenue');
  // Et le panneau montre le refus sur la case, comme la porte : une clé mal collée reste là, marquée.
  assert.ok(/if \(key && \$\('#lic-key'\)\) refus\(\$\('#lic-key'\), plainError\(e\)\); else toast\(plainError\(e\), true\);/.test(code), 'le panneau Licence n\'affiche le refus que dans un bandeau');
});

t('10.14.0 : une date de licence se lit « 24/09/2027 », jamais « 2027-09-24 », dans les deux applications', () => {
  const L = require('../../src/licence.js');
  const { publicKey, privateKey } = L.generateKeys();
  const cles = JSON.stringify({ cles: [{ kid: 'master', publicKey }] });
  const key = L.signLicence({ nom: 'Menuiserie Ben Ali SARL', matricule: '7654321B', offre: 'entreprise', exp: '2027-09-24' }, privateKey);
  const active = L.licenceState({ cles, key, matricule: '7654321B', today: '2026-09-24' });
  assert.strictEqual(active.label, 'Licence active jusqu\'au 24/09/2027 — offre Entreprise');
  assert.strictEqual(active.exp, '2027-09-24', 'la DONNÉE reste en ISO : seules les phrases changent');
  const expiree = L.licenceState({ cles, key, matricule: '7654321B', today: '2028-01-05' });
  assert.strictEqual(expiree.label, 'Licence expirée le 24/09/2027');
  // La pastille de la barre reprend le libellé : elle aussi parle français.
  assert.ok(/24\/09\/2027/.test(L.pastille(expiree).texte) && !/2027-09-24/.test(L.pastille(expiree).texte), 'la pastille d\'une licence expirée écrit une date ISO');
  const cab = L.signLicence({ nom: 'Cabinet Test', type: 'cabinet', cabinet: '3F9A-2C1E-0000-1111-2222', dossiersHors: 2, exp: '2027-09-24' }, privateKey);
  const c = L.licenceCabinet({ cles, key: cab, empreinte: '3F9A-2C1E-0000-1111-2222', comptes: 1, today: '2026-09-24' });
  assert.ok(/jusqu'au 24\/09\/2027/.test(c.label) && !/\d{4}-\d{2}-\d{2}/.test(c.label), 'le Cabinet écrit une date ISO dans l\'état de sa licence : ' + c.label);
  // Et la raison d'un dossier compté dans le Cabinet, qui se lit dans le panneau Licence.
  const K = require('../../src/cabinet/cabcore.js');
  const r = K.dossierFacturable({ packs: [{ month: '2026-08' }], clientLicence: { etat: 'expiree', payee: true, exp: '2026-03-15' } }, '2026-09-24');
  assert.ok(/expirée le 15\/03\/2026/.test(r.raison), 'la raison d\'un dossier en grâce écrit une date ISO : ' + r.raison);
});

t('10.14.0 : « Rejoindre un dossier partagé » nomme l\'AUTRE geste comme il s\'appelle là où l\'on est', () => {
  // « C'est l'autre bouton : Partager ce dossier à deux » n'était vrai que dans les Paramètres. Chaque
  // phrase doit nommer un bouton qui existe DANS SON écran.
  const i = code.indexOf('async function rejoindreDossier(');
  const f = code.slice(i, code.indexOf('\n  }\n', i));
  assert.ok(/const autre = typeof o\.autre === 'string' \? o\.autre/.test(f), 'l\'appelant ne peut plus dire où est l\'autre geste');
  assert.ok(/Partager ce dossier à deux/.test(f) && /id="dos-share">↔ Partager ce dossier à deux…</.test(code), 'la phrase des Paramètres nomme un bouton qui n\'y est plus');
  // Le menu : le nom de SON entrée, lu avant de fermer (fermer vide le menu), et rien s'il n'y en a pas.
  const m = code.slice(code.indexOf("$('#dm-join', m).onclick = () => {"), code.indexOf("$('#dm-manage', m).onclick"));
  assert.ok(/const partageable = !!\$\('#dm-share', m\);\s*fermerDossiers\(\);/.test(m), 'le menu lit « Partager cette entreprise » APRÈS s\'être vidé : la phrase ne s\'affiche jamais');
  assert.ok(/Partager cette entreprise/.test(m) && /<span class="dm-nom">Partager cette entreprise…<\/span>/.test(code), 'la phrase du menu nomme une entrée qui n\'y est plus');
  // La porte : il n'y a rien à partager — on renvoie au battant qui existe.
  const z = runSetupZone();
  assert.ok(/Commencer avec mon entreprise/.test(z.slice(z.indexOf("$('#sf-rejoindre', root)"), z.indexOf("$('#sf-rejoindre', root)") + 400)), 'la porte renvoie à un bouton de partage qui n\'y est pas');
  assert.ok(/<button type="button" class="btn" id="sf-next">Commencer avec mon entreprise<\/button>/.test(z), 'la phrase de la porte cite un battant qui a changé de nom');
  // Le dossier vide que la première ouverture crée tout seul ne quitte la liste que depuis la porte.
  assert.strictEqual((code.match(/remplacerVierge: true/g) || []).length, 1, 'un autre geste que la porte retire le dossier ouvert de la liste');
});

t('10.14.0 : rejoindre depuis la porte retire de la LISTE le « Mon entreprise » vierge — sans jamais rien effacer', () => {
  const vm = require('vm'), fs = require('fs'), os = require('os'), path = require('path');
  const main = lireSource('src', 'main.js');
  const i = main.indexOf('function dossierVierge(dir) {');
  assert.ok(i > 0, 'la reconnaissance d\'un dossier vierge a disparu');
  const src = main.slice(i, main.indexOf('\n}\n', i) + 2);
  const ctx = { fs, path };
  vm.runInNewContext(src + '\nthis.dossierVierge = dossierVierge;', ctx);
  const dossierVierge = ctx.dossierVierge;
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'skf-vierge-'));
  const poser = (nom, contenu) => { const d = path.join(base, nom); fs.mkdirSync(d); if (contenu != null) fs.writeFileSync(path.join(d, 'skanfact-data.json'), contenu); return d; };
  try {
    assert.strictEqual(dossierVierge(poser('rien')), true, 'un dossier sans fichier de données est vierge (la porte n\'écrit rien)');
    assert.strictEqual(dossierVierge(poser('vide', JSON.stringify({ company: { name: '' }, documents: [], clients: [] }))), true);
    assert.strictEqual(dossierVierge(poser('nom', JSON.stringify({ company: { name: 'Ma SARL' } }))), false, 'une raison sociale n\'est pas du vide');
    assert.strictEqual(dossierVierge(poser('assistant', JSON.stringify({ company: { name: '', setupStarted: true } }))), false, 'un assistant commencé n\'est pas du vide');
    assert.strictEqual(dossierVierge(poser('client', JSON.stringify({ company: {}, clients: [{ id: 'c1' }] }))), false, 'un client n\'est pas du vide');
    assert.strictEqual(dossierVierge(poser('piece', JSON.stringify({ company: {}, documents: [{ id: 'd1' }] }))), false, 'une pièce n\'est pas du vide');
    assert.strictEqual(dossierVierge(poser('chiffre', JSON.stringify({ 'skanfact-encrypted': 1 }))), false, 'un dossier chiffré n\'est jamais « vierge » : on ne sait pas ce qu\'il contient');
    assert.strictEqual(dossierVierge(poser('abime', '{ pas du json')), false, 'un fichier illisible n\'est jamais « vierge » : dans le doute, on garde');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
  // Il quitte la LISTE seulement : aucune suppression de fichier dans le geste.
  const j = main.indexOf("ipcMain.handle('dossiers:join'");
  const h = main.slice(j, main.indexOf("ipcMain.handle('dossiers:restore'", j));
  assert.ok(/const quitte = \(opts \|\| \{\}\)\.remplacerVierge \? cfg\.dossiers\.find\(x => x\.id === cfg\.currentDossier\) : null;/.test(h), 'le dossier ouvert quitte la liste sans que l\'appelant l\'ait demandé');
  assert.ok(/if \(quitte && !quitte\.shared && dossierVierge\(quitte\.dir\)\)/.test(h), 'un dossier qui a servi (ou partagé) peut quitter la liste');
  assert.ok(!/rmSync|unlinkSync|rmdirSync/.test(h), 'rejoindre un dossier efface un fichier');
  assert.ok(/joinDossier: \(opts\) => ipcRenderer\.invoke\('dossiers:join', opts \|\| \{\}\)/.test(lireSource('src', 'preload.js')), 'le pont ne transmet plus l\'option');
});

t('10.14.0 : un dossier PARTAGÉ a déjà mis ses données à l\'abri — l\'étape se coche, et dit pourquoi', () => {
  const data = { documents: [], clients: [], catalog: [], company: {} };
  const etape = o => C.firstSteps(data, { name: 'X' }, o).etapes.find(x => x.id === 'sauvegarde');
  const sans = etape({ copieExterne: false });
  assert.ok(sans && !sans.fait, 'sans copie ni partage, l\'étape doit rester à faire');
  const part = etape({ copieExterne: false, partage: true });
  assert.ok(part.fait, 'un dossier partagé ne peut pas recevoir de copie externe : l\'étape ne pourrait JAMAIS se cocher');
  assert.ok(/partagé/.test(part.quoi), 'l\'étape cochée ne dit pas pourquoi : ' + part.quoi);
  const r = C.reussites(data, { name: 'X' }, { partage: true });
  assert.ok(r.liste.find(x => x.id === 'abri').fait, '« Tes réussites » ne voient pas le dossier partagé');
  // La moitié qui le SAIT vit dans le processus principal, et l'écran la lit aux deux endroits.
  assert.ok(/const externalInfo = \(\) => \(\{ \.\.\.storage\.state\.external, partage: !!\(currentDossier\(\) \|\| \{\}\)\.shared \}\);/.test(lireSource('src', 'main.js')), 'le processus principal ne dit plus qu\'un dossier est partagé');
  assert.ok((code.match(/dossierPartage = !!\(i && i\.partage\);/g) || []).length === 2, 'l\'état du partage n\'est plus relu au démarrage ET après le panneau de copie');
  assert.ok(/C\.firstSteps\(data, company\(\), \{ copieExterne, partage: dossierPartage,/.test(code) && /C\.reussites\(data, company\(\), \{ copieExterne, partage: dossierPartage \}\)/.test(code), 'les premiers pas ou les réussites ignorent le partage');
});

t('10.14.0 : le registre de commerce est aussi guidé dans l\'assistant que dans les Paramètres (7.3.0)', () => {
  const champs = (code.match(/\$\{field\(lbl\('Registre de commerce \(RC\)', 'co\.rc'\), 'rc', \w+\.rc \|\| '', 'text', 'placeholder="[^"]*"'\)\}/g) || []);
  assert.strictEqual(champs.length, 2, 'les deux champs du registre de commerce n\'ont pas été trouvés');
  const invites = champs.map(x => x.match(/'placeholder="([^"]*)"'/)[1]);
  assert.strictEqual(invites[0], invites[1], 'l\'assistant et les Paramètres ne disent pas la même chose du même champ : ' + invites.join(' / '));
});

// ------------------------------------------------------------------ 213d : le compte depuis le RIB
// La fiche société porte déjà la banque et le RIB ; la Trésorerie — la page faite pour ça — ouvrait
// un compte VIDE pendant que le paiement, lui, le préremplissait. UNE fonction pour les trois portes.
t('10.14.0 : le compte bancaire naît de la fiche société — une fois, et jamais en double', () => {
  const rib = '08 006 0123456789012 34';
  assert.strictEqual(C.compteDepuisFiche({}, []), null, 'une fiche vide ne propose rien');
  assert.strictEqual(C.compteDepuisFiche(null, null), null);
  assert.deepStrictEqual(C.compteDepuisFiche({ bank: ' BIAT ', rib }, []), { name: 'BIAT — compte courant', kind: 'banque', bank: 'BIAT', rib });
  assert.deepStrictEqual(C.compteDepuisFiche({ rib }, []), { name: 'Compte courant', kind: 'banque', bank: '', rib }, 'un RIB sans banque nomme quand même le compte');
  // Le même RIB, écrit autrement (sans espaces), ou dans un IBAN tunisien : c'est le même compte.
  assert.strictEqual(C.compteDepuisFiche({ bank: 'BIAT', rib }, [{ rib: '08006012345678901234' }]), null, 'le même RIB sans ses espaces est proposé une seconde fois');
  assert.strictEqual(C.compteDepuisFiche({ bank: 'BIAT', rib }, [{ rib: 'TN59 0800 6012 3456 7890 1234' }]), null, 'l\'IBAN du même compte n\'est pas reconnu');
  // Un AUTRE compte (une caisse sans RIB, un autre RIB) ne l'empêche pas.
  assert.ok(C.compteDepuisFiche({ bank: 'BIAT', rib }, [{ kind: 'caisse', name: 'Caisse', rib: '' }, { rib: '10 000 1111111111111 11' }]), 'une caisse ou un autre compte empêche de proposer la banque de la fiche');
  // Sans RIB sur la fiche, la BANQUE décide — à la casse près.
  assert.strictEqual(C.compteDepuisFiche({ bank: 'Attijari' }, [{ bank: 'attijari', rib: '' }]), null);
  assert.ok(C.compteDepuisFiche({ bank: 'Attijari' }, [{ bank: 'BIAT' }]));
});

t('10.14.0 : les TROIS portes d\'un compte passent par la même fonction, et le compte né de la fiche n\'attend que son solde', () => {
  assert.ok(/const modeleCompte = \(\) => C\.compteDepuisFiche\(company\(\), data\.accounts\);/.test(code), 'le modèle du compte ne vient plus de la fiche');
  // Le paiement, l'état vide de la Trésorerie, « + Compte » : chacun appelle le modèle au moment du clic.
  assert.ok(/\$\('#pf-compte', root\)\.onclick = \(\) => accountForm\(null, a => \{[\s\S]{0,200}\}, modeleCompte\(\)\);/.test(code), 'le paiement ne passe plus par le modèle');
  assert.ok(/\$\('#first-acc'\)\.onclick = \(\) => accountForm\(null, \(\) => render\(\), modeleCompte\(\)\);/.test(code), 'l\'état vide de la Trésorerie ouvre encore un compte vide');
  assert.ok(/\$\('#new-acc'\)\.onclick = \(\) => accountForm\(null, \(\) => render\(\), modeleCompte\(\)\);/.test(code), '« + Compte » ignore la fiche');
  assert.strictEqual((code.match(/accountForm\(null,/g) || []).length, 3, 'une quatrième porte vers un compte neuf est apparue sans le modèle');
  // Le bouton NOMME la banque, et l'état vide dit d'où vient ce qu'il propose.
  assert.ok(/id="first-acc">\+ \$\{libelleCompteDepuisFiche\('Créer le compte', 'Créer mon premier compte'\)\}/.test(code));
  assert.ok(/id="tre-depuis-fiche">Ta fiche société porte déjà/.test(code), 'l\'état vide ne dit pas que la fiche porte déjà la banque');
  const lib = require('vm').runInNewContext('(' + code.match(/const libelleCompteDepuisFiche = (\(avecBanque, sans\) => \{[^\n]+\})/)[1] + ')',
    { modeleCompte: () => ({ bank: 'BIAT & fils' }), h: s => String(s).replace(/&/g, '&amp;') });
  assert.strictEqual(lib('Créer le compte', 'Créer un compte'), 'Créer le compte « BIAT &amp; fils »', 'le nom de la banque n\'est pas échappé');
  // Le curseur va au SOLDE, la valeur proposée sélectionnée : la première frappe la remplace (9.4.5).
  const i = code.indexOf('function accountForm(');
  const f = code.slice(i, code.indexOf('\n  function ', i + 10));
  assert.ok(/const depuisFiche = !acc && !!\(modele && \(modele\.bank \|\| modele\.rib\)\);/.test(f), 'le compte né de la fiche ne se reconnaît plus');
  assert.ok(/if \(depuisFiche\) \{ const o = \$\('\[name=opening\]', root\); o\.focus\(\); o\.select\(\); \}/.test(f), 'le curseur ne va plus au solde de départ');
  assert.ok(/Banque et RIB viennent de ta fiche société/.test(f), 'la fenêtre ne dit pas d\'où viennent la banque et le RIB');
});

// ------------------------------------------------------------------ 213d : le mot de passe avec la copie
t('10.14.0 : le mot de passe se propose AVEC la copie externe — une fois la copie posée, et seulement si rien ne protège encore les données', () => {
  const i = code.indexOf('$(\'#ext-choose\').onclick = async () => {');
  const hnd = code.slice(i, code.indexOf('\n    };', i));
  assert.ok(i > 0 && hnd.length > 200, 'le geste « Choisir un dossier » n\'a pas été trouvé');
  // Une copie qui a échoué ne propose rien : elle ne protège encore rien.
  assert.ok(/if \(i\.lastError\) \{[^}]*return; \}/.test(hnd), 'une copie en échec enchaîne sur le mot de passe');
  // La question vient APRÈS le redessin (la page dit que la copie est là), et seulement sans mot de passe.
  const dessin = hnd.indexOf('await drawExternal();'), question = hnd.indexOf('passwordDialog(\'set\', { copie: i.dir })');
  assert.ok(dessin > 0 && question > dessin, 'la question du mot de passe ne suit plus la copie');
  assert.ok(/if \(security\.encrypted\) toast\('Copie externe activée'\);\s*else passwordDialog\('set', \{ copie: i\.dir \}\);/.test(hnd), 'la question se pose à des données déjà chiffrées');
  // Le bouton reste « occupé » jusqu'à la question : la visite l'attend.
  assert.ok(/b\.setAttribute\('aria-busy', 'true'\);\s*try \{[\s\S]*\} finally \{ b\.removeAttribute\('aria-busy'\); \}/.test(hnd), 'le bouton n\'est plus tenu occupé pendant que la question se prépare');
  // La porte du mot de passe dit pourquoi MAINTENANT, et « Pas maintenant » plutôt qu'« Annuler ».
  const p = code.slice(code.indexOf('function passwordDialog('), code.indexOf('\n  function ', code.indexOf('function passwordDialog(') + 10));
  assert.ok(/const copie = mode === 'set' && opts && opts\.copie \? String\(opts\.copie\) : '';/.test(p));
  assert.ok(/<p id="pw-copie">Ta copie est en place dans <code>\$\{h\(copie\)\}<\/code>\. Elle est <b>en clair<\/b>/.test(p), 'la fenêtre ne dit pas que la copie part en clair');
  assert.ok(/\$\{copie \? 'Pas maintenant' : 'Annuler'\}/.test(p), 'la copie est faite : « Annuler » laisserait croire qu\'on la défait');
});

t('10.14.0 : la visite « Mettre mes données à l\'abri » attend la question, en parle, puis conclut', () => {
  const V = require('../../src/renderer/visite.js');
  const S = require('../../src/renderer/visites.js');
  const liste = S.parcours({ data: () => ({ clients: [], documents: [], catalog: [] }), premier: () => null, estDemo: () => false, editeur: () => false, Visite: V, G: { INFO: {} } });
  const v = liste.find(x => x.id === 'sauvegarde');
  const [choisir, mdp, fin] = v.etapes;
  assert.strictEqual(choisir.cible, '#ext-choose');
  assert.strictEqual(mdp.cible, '#pw-copie', 'la visite ne parle pas de la question du mot de passe');
  assert.strictEqual(fin.titre, 'C\'est tout');
  // Joué sur un faux document : le geste n'est fait que la copie posée ET la question posée.
  const avant = global.document;
  const dom = sel => { global.document = { querySelector: s => sel[s] || null }; };
  try {
    dom({ '#ext-remove': { hidden: false }, '#ext-choose': { getAttribute: a => (a === 'aria-busy' ? 'true' : null) } });
    assert.strictEqual(choisir.fait(), false, 'la visite avance avant que la question du mot de passe soit posée');
    dom({ '#ext-remove': { hidden: false }, '#ext-choose': { getAttribute: () => null } });
    assert.strictEqual(choisir.fait(), true, 'la visite reste bloquée une fois la copie posée');
    dom({ '#pw-copie': {} });
    assert.ok(mdp.si() && !mdp.fait(), 'l\'étape du mot de passe ne s\'ouvre pas sur la question, ou se croit finie');
    dom({});
    assert.ok(!mdp.si() && mdp.fait(), 'des données déjà protégées voient quand même l\'étape du mot de passe');
  } finally { global.document = avant; }
});

// ------------------------------------------------------------------ 213d : une copie impossible se dit en français
t('10.14.0 : la cause d\'une copie externe impossible se dit en français, dans les DEUX applications', () => {
  const st = lireSource('src', 'storage.js'), cab = lireSource('src', 'cabinet', 'cabstore.js');
  const corps = s => { const i = s.indexOf('const CAUSES_COPIE = {'); return s.slice(i, s.indexOf('\n}\n', s.indexOf('function causeCopie(', i)) + 2); };
  assert.ok(corps(st).length > 300, 'le traducteur de l\'app entreprise n\'a pas été trouvé');
  assert.strictEqual(corps(st), corps(cab), 'les deux applications ne disent pas la même chose d\'une même panne de copie');
  [st, cab].forEach(s => assert.ok(!/lastError = e\.message/.test(s), 'un message brut de Node repart vers l\'écran'));
  const causeCopie = require('vm').runInNewContext(corps(st) + '\ncauseCopie;');
  assert.strictEqual(causeCopie(Object.assign(new Error('x'), { code: 'EACCES' })), 'l\'accès à ce dossier est refusé');
  assert.strictEqual(causeCopie(new Error('ENOSPC: no space left on device, write')), 'le support est plein', 'un code perdu en route n\'est plus relu dans le message');
  assert.ok(/^une erreur inattendue/.test(causeCopie(new Error('boom'))), 'une panne inconnue n\'a pas sa phrase');
  // En vrai : une copie vers un dossier qui n'existe pas.
  const fs = require('fs'), os = require('os'), path = require('path');
  const { createStorage } = require('../../src/storage.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-copie-'));
  try {
    const s = createStorage(dir, { externalDir: path.join(dir, 'cle-debranchee') });
    s.write(C.DEFAULT_DATA);
    assert.strictEqual(s.state.external.lastError, 'le dossier est introuvable (support débranché ?)');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------ 213d : une sauvegarde rechiffrée garde sa date
// Trouvé au test à la souris de ce lot : poser le mot de passe que la copie propose faisait passer
// « Début de journée, avant la première modification » de 23:17 à 23:22 — l'heure du mot de passe, sur
// la liste où l'on choisit quoi restaurer. Le rechiffrement garde la date ; et comme « même taille, même
// date » ne suffit plus alors à faire recopier la clé USB, ce qu'on vient de convertir y est recopié
// d'office. Les données du test DISCRIMINENT : la copie sur la clé a la même taille et la même date que
// la locale — c'est exactement le cas où, sans la recopie forcée, elle resterait sur l'ancien mot de passe.
t('10.14.0 : une sauvegarde rechiffrée garde sa date, et la clé USB reçoit quand même la version convertie — dans les DEUX applications', () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const pres = (p, d) => Math.abs(fs.statSync(p).mtimeMs - d.getTime()) < 2000;
  const matin = new Date('2026-09-24T09:12:00Z');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-date-'));
  try {
    // L'app entreprise.
    const { createStorage, isEncrypted, decryptData } = require('../../src/storage.js');
    const ext = path.join(dir, 'cle'); fs.mkdirSync(ext);
    const s = createStorage(path.join(dir, 'app'), { now: () => new Date('2026-09-24T09:00:00Z') });
    s.write({ ...C.DEFAULT_DATA, clients: [{ id: 'a', name: 'Premier' }] });
    s.write({ ...C.DEFAULT_DATA, clients: [{ id: 'a', name: 'Second' }] });          // la sauvegarde du jour
    const locale = s.listBackups()[0].path;
    fs.utimesSync(locale, matin, matin);
    s.setExternalDir(ext);
    const surCle = path.join(ext, 'SkanFact', 'backups', path.basename(locale));
    assert.ok(pres(surCle, matin), 'la copie sur la clé ne garde pas la date de l\'original : chaque enregistrement la recopie');
    // Le premier mot de passe (clair → chiffré : la taille change, la clé suit de toute façon)…
    s.setPassword(s.read(), 'premier-mot-de-passe');
    assert.ok(isEncrypted(JSON.parse(fs.readFileSync(locale, 'utf8'))), 'la sauvegarde locale n\'est pas chiffrée');
    assert.ok(pres(locale, matin), 'le rechiffrement a réécrit l\'heure de la sauvegarde du matin');
    assert.strictEqual(decryptData(JSON.parse(fs.readFileSync(surCle, 'utf8')), 'premier-mot-de-passe').clients[0].name, 'Premier');
    // … puis le CHANGEMENT : ancien chiffré → nouveau chiffré, même taille, même date. C'est le cas où,
    // sans la recopie forcée, la clé garderait la sauvegarde de l'ancien mot de passe.
    s.setPassword(s.read(), 'menuiserie2026');
    assert.ok(pres(locale, matin), 'le changement de mot de passe a réécrit l\'heure de la sauvegarde du matin');
    assert.strictEqual(decryptData(JSON.parse(fs.readFileSync(surCle, 'utf8')), 'menuiserie2026').clients[0].name, 'Premier',
      'la clé garde une sauvegarde que le nouveau mot de passe n\'ouvre pas');
    assert.throws(() => decryptData(JSON.parse(fs.readFileSync(surCle, 'utf8')), 'premier-mot-de-passe'));
    // Le Cabinet : pas de conversion sur place, tout passe par la recopie.
    const { createCabStore } = require('../../src/cabinet/cabstore.js');
    const cle2 = path.join(dir, 'cle2'); fs.mkdirSync(cle2);
    const cab = createCabStore(path.join(dir, 'cab'), { now: () => new Date('2026-09-24T09:00:00Z') });
    const etat = cab.create('mot-de-passe-assez-long', { cabinet: { name: 'Cabinet' }, dossiers: [] });
    const quotidienne = cab.snapshotDaily();
    assert.ok(quotidienne && fs.existsSync(quotidienne), 'la sauvegarde du jour du Cabinet n\'a pas été prise');
    fs.utimesSync(quotidienne, matin, matin);
    cab.setExternalDir(cle2);
    const cabCle = path.join(cle2, 'SkanFact Cabinet', 'sauvegardes', path.basename(quotidienne));
    assert.ok(pres(cabCle, matin), 'la copie du Cabinet ne garde pas la date de l\'original');
    cab.setPassword(etat, 'un-nouveau-mot-de-passe-long');
    assert.ok(pres(quotidienne, matin), 'le rechiffrement du Cabinet a réécrit l\'heure de la sauvegarde du matin');
    assert.ok(cab.peek(cabCle, 'un-nouveau-mot-de-passe-long'), 'la clé du Cabinet garde la version de l\'ancien mot de passe');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Vu en jouant la visite à la souris : « C'est tout — chaque enregistrement est recopié là » éclairait le
// panneau « Dossiers », le premier de l'onglet. Une étape qui dit « là » éclaire ce qu'elle désigne.
t('10.14.0 : la visite « Mettre mes données à l\'abri » conclut sur le panneau de la COPIE — celui qui porte le bouton du geste', () => {
  const V = lireSource('src', 'renderer', 'visites.js');
  const i = V.indexOf("id: 'sauvegarde'");
  const bloc = V.slice(i, V.indexOf('visite({', i));
  const derniere = bloc.slice(bloc.lastIndexOf('{ page:'));
  const cible = (derniere.match(/cible: '([^']+)'/) || [])[1];
  assert.ok(cible && cible !== '#view .panel', `la dernière étape éclaire « ${cible} », le premier panneau venu de l'onglet`);
  const deb = app.indexOf(`panneau('${cible.replace(/^#/, '')}'`);
  assert.ok(deb > 0, `aucun panneau « ${cible} » dans les Paramètres`);
  assert.ok(app.slice(deb, app.indexOf('panneau(', deb + 10)).includes('id="ext-choose"'), 'le panneau éclairé n\'est pas celui du bouton « Choisir un dossier… »');
});

// ------------------------------------------------------------------ 213d : un objet vide ne casse pas le message
// Vu au premier envoi d'une entreprise neuve (test à la souris) : l'objet d'un devis est facultatif,
// et le message partait avec « notre devis DEV-2026-001 (1 011,500 DT TTC) concernant : . ».
t('10.14.0 : un objet vide retire sa proposition du message — dans chaque modèle qui le porte, en français et en anglais', () => {
  const company = { name: 'Menuiserie El Bahri SARL', currency: 'DT', stampFee: 1 };
  const client = { name: 'Hôtel Dar El Marsa SARL', email: 'contact@darmarsa.tn' };
  const doc = (type, lang) => ({ type, lang, number: 'DEV-2026-001', date: '2026-09-24', dueDate: '2026-10-24', subject: '',
    lines: [{ label: 'Porte en chêne massif', qty: 1, price: 850, vat: 19 }] });
  const casse = /:\s*[.\n]|:\s*$|—\s*$|—\s*\n|for:\s*\./;
  [['fr', ['devis', 'relanceDevis', 'proforma', 'commande', 'livraison', 'contrat']], ['en', ['devis', 'relanceDevis']]].forEach(([lang, kinds]) => {
    kinds.forEach(k => {
      const m = C.emailFor(k, doc(k === 'relanceDevis' ? 'devis' : k, lang), client, company);
      assert.ok(!casse.test(m.body), `${lang}/${k} : le message garde une phrase coupée — ${JSON.stringify(m.body.split('\n')[2])}`);
      assert.ok(!casse.test(m.subject), `${lang}/${k} : l'objet du mail finit en suspens — « ${m.subject} »`);
      assert.ok(!/\{objet\}/.test(m.body + m.subject), `${lang}/${k} : la variable est restée écrite`);
    });
  });
  // Avec un objet, rien ne change : la phrase le porte.
  const plein = C.emailFor('devis', { ...doc('devis', 'fr'), subject: 'Porte d\'entrée du hall' }, client, company);
  assert.ok(/concernant : Porte d'entrée du hall\./.test(plein.body), 'un objet renseigné n\'apparaît plus dans le message');
  assert.strictEqual(C.emailFor('relanceDevis', doc('devis', 'fr'), client, company).subject, 'Notre devis DEV-2026-001');
  // Un modèle PERSONNEL : ce que la personne a écrit hors de `{objet}` reste le sien.
  const perso = { ...company, emailTemplates: { devis: { subject: 'Devis {numero}', body: 'Bonjour,\nConcernant : votre demande du mois, voici le devis {numero}.' } } };
  assert.ok(/Concernant : votre demande du mois/.test(C.emailFor('devis', doc('devis', 'fr'), client, perso).body), 'un texte écrit par la personne a été réécrit');
});

// ------------------------------------------------------------------ 213d : la messagerie au premier envoi
// Sur Mac, SkanFact ouvrait Mail d'office : quelqu'un qui écrit depuis Gmail voyait s'ouvrir, à son
// tout premier envoi, une application jamais configurée. La question se pose une fois, là où elle sert.
t('10.14.0 : chaque envoi passe par la porte de la messagerie AVANT de rien préparer', () => {
  const envois = [...code.matchAll(/bridge\.composeMail\(/g)].map(m => m.index);
  assert.ok(envois.length >= 10, 'les envois n\'ont pas été trouvés : ' + envois.length);
  const portes = [];
  envois.forEach(idx => {
    let p = 1, j = idx + 'bridge.composeMail('.length;
    while (p && j < code.length) { if (code[j] === '(') p++; else if (code[j] === ')') p--; j++; }
    const args = code.slice(idx, j);
    // « Écrire au client » ouvre la messagerie du système, sans fichier : rien à choisir.
    if (/mode: 'mailto'/.test(args)) return;
    assert.ok(/mode: modeEnvoi\(\)/.test(args), 'un envoi ne suit pas la messagerie choisie : ' + args.slice(0, 120));
    const porte = code.lastIndexOf('if (!await messagerie()) return;', idx);
    assert.ok(porte > 0, 'un envoi part sans avoir demandé la messagerie : ' + args.slice(0, 120));
    // Pas de frontière de fonction entre la porte et l'envoi : la porte est celle de CET envoi.
    assert.ok(!/\n  (async )?function |\n  routes\.\w+ = /.test(code.slice(porte, idx)), 'la porte trouvée appartient à une autre fonction : ' + args.slice(0, 120));
    portes.push(porte);
  });
  // Deux envois qui partagent UNE porte : l'un des deux l'a oubliée, et emprunte celle du voisin.
  assert.strictEqual(new Set(portes).size, portes.length, 'deux envois se partagent la même question — l\'un des deux ne la pose pas');
  // La fenêtre d'envoi d'une pièce demande AVANT de s'ouvrir : sa phrase dit ce qui va se passer.
  const s = code.slice(code.indexOf('async function sendByEmail('), code.indexOf('async function sendByEmail(') + 1200);
  assert.ok(s.indexOf('if (!await messagerie()) return;') < s.indexOf('modal(`'), 'la fenêtre d\'envoi s\'ouvre avant la question, et promet Mail à qui ne l\'a pas choisi');
});

await ta('10.14.0 : sur Mac, la messagerie se demande au PREMIER envoi — pas à qui envoyait déjà, jamais hors d\'un Mac', async () => {
  const src = code.match(/const dejaEnvoye = [^\n]+\n/)[0] + code.match(/async function messagerie\(\) \{[\s\S]*?\n  \}/)[0];
  const essai = async ({ mac, choisi, documents, reponse }) => {
    const ctx = { SUR_MAC: mac, data: { company: { mailClient: choisi }, documents: documents || [], licences: [] }, demandes: 0, sauvees: 0 };
    ctx.company = () => ctx.data.company;
    ctx.modeEnvoi = () => (ctx.data.company.mailClient === 'mailto' ? 'mailto' : 'auto');
    ctx.save = () => { ctx.sauvees++; };
    ctx.choisirMessagerie = async () => { ctx.demandes++; if (reponse) ctx.data.company.mailClient = reponse; return reponse || null; };
    const messagerie = require('vm').runInNewContext(src + '\nmessagerie;', ctx);
    const mode = await messagerie();
    return { mode, demandes: ctx.demandes, choisi: ctx.data.company.mailClient, sauvees: ctx.sauvees };
  };
  assert.deepStrictEqual(await essai({ mac: false }), { mode: 'auto', demandes: 0, choisi: undefined, sauvees: 0 }, 'hors d\'un Mac, rien ne se demande ni ne s\'écrit');
  assert.strictEqual((await essai({ mac: true, choisi: 'mailto' })).demandes, 0, 'un choix déjà fait se redemande');
  const premier = await essai({ mac: true, reponse: 'mailto' });
  assert.deepStrictEqual([premier.mode, premier.demandes], ['mailto', 1], 'le premier envoi ne pose pas la question, ou n\'écoute pas la réponse');
  assert.strictEqual((await essai({ mac: true, reponse: null })).mode, null, 'fermer la question envoie quand même — avec Mail');
  // Quelqu'un qui envoyait déjà depuis SkanFact ne se voit rien demander : Mail marchait pour lui.
  const ancien = await essai({ mac: true, documents: [{ emails: [{ date: '2026-01-02' }] }] });
  assert.deepStrictEqual(ancien, { mode: 'auto', demandes: 0, choisi: 'auto', sauvees: 1 }, 'la mise à jour fait douter d\'un geste qui marchait');
});

t('10.14.0 : la question de la messagerie a deux réponses de même poids, et les Paramètres disent quand rien n\'est choisi', () => {
  const q = code.slice(code.indexOf('function choisirMessagerie('), code.indexOf('async function messagerie('));
  assert.ok(/id="msg-mail"/.test(q) && /id="msg-autre"/.test(q), 'les deux réponses n\'ont pas été trouvées');
  assert.ok(!/btn-primary/.test(q), 'une des deux réponses est poussée en vert : ce n\'est pas à SkanFact de choisir la messagerie');
  // Sans bouton principal, le curseur doit entrer dans la question (10.13.0 : Entrée re-cliquait la page).
  assert.ok(/\$\('#msg-mail', root\)\.focus\(\);/.test(q), 'le curseur reste sur le bouton de la page, derrière la question');
  assert.ok(/\(\) => \{ if \(!fait\) resolve\(null\); \}/.test(q), 'fermer la question ne répond rien : l\'envoi resterait suspendu');
  // Dans les Paramètres, tant que rien n'est choisi, la liste le dit — sinon « Mail » s'enregistrait
  // d'office au premier « Enregistrer » de la fiche société, et la question n'arrivait jamais.
  assert.ok(/\$\{c\.mailClient \? '' : '<option value="" selected>Je choisirai au premier envoi<\/option>'\}/.test(code), 'la liste des Paramètres choisit Mail à la place de l\'utilisateur');
  assert.ok(/<option value="auto" \$\{c\.mailClient && c\.mailClient !== 'mailto' \? 'selected' : ''\}>/.test(code), '« Mail » reste coché quand rien n\'est choisi');
});

t('10.14.0 : la visite « Envoyer » connaît les deux questions qui peuvent précéder la fenêtre d\'envoi', () => {
  const V = require('../../src/renderer/visite.js');
  const S = require('../../src/renderer/visites.js');
  const v = S.parcours({ data: () => ({ clients: [], documents: [], catalog: [] }), premier: () => null, estDemo: () => false, editeur: () => false, Visite: V, G: { INFO: {} } }).find(x => x.id === 'envoyer');
  const cibles = v.etapes.map(e => e.cible);
  const iEx = cibles.indexOf('#demo-q'), iMsg = cibles.indexOf('#msg-choix'), iRelis = v.etapes.findIndex(e => /Relis avant/.test(e.titre));
  assert.ok(iEx > 0 && iMsg > iEx && iRelis > iMsg, 'l\'ordre des étapes ne suit plus celui des questions : ' + cibles.join(' → '));
  [v.etapes[iEx], v.etapes[iMsg]].forEach(e => assert.ok(typeof e.si === 'function' && typeof e.fait === 'function', 'une question qui n\'est pas toujours posée doit être une étape conditionnelle : ' + e.cible));
  // Le marqueur que l'étape attend est bien posé sur la question de l'exemple.
  assert.ok(/'Continuer quand même', null, \{ id: 'demo-q' \}\);/.test(code), 'la question de l\'exemple ne porte plus le nom que la visite reconnaît');
  assert.ok(/<h2\$\{opts && opts\.id \? ` id="\$\{h\(opts\.id\)\}"` : ''\}>/.test(code), '`choiceDialog` ne sait plus nommer sa question');
});
};
