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
};
