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
// Le corps d'UNE fonction de l'application, de sa déclaration à son accolade fermante (deux espaces :
// tout vit dans la fermeture d'app.js). Une tranche bornée sur la déclaration VOISINE grandit dès
// qu'une fonction s'insère entre les deux — la leçon de la 10.4.0, re-rencontrée ici en 213f.
const corps = debut => {
  const i = code.indexOf(debut);
  if (i < 0) return '';
  const j = code.indexOf('\n  }\n', i);
  return j < 0 ? '' : code.slice(i, j + 4);
};

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
  // Dans le PIED, à côté des boutons, comme dans une fenêtre : posée sous le formulaire, elle ajoutait
  // une ligne au corps de « Ton entreprise », qui défilait pour 7 pixels à 1440×900 (vu à la souris).
  const pose = z.slice(z.indexOf("note.className = 'oblig-note';"), z.indexOf("note.className = 'oblig-note';") + 400);
  assert.ok(/\$\('\.setup-foot', root\)/.test(pose) && !/\$\('\.setup-body', root\)\.appendChild\(note\)/.test(pose), 'la légende de l\'étoile s\'ajoute au corps de l\'assistant, qui défile pour elle');
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
  // La question de l'exemple se reconnaît à ce qui la fait paraître (`si`), pas à sa cible : depuis la
  // 10.14.1 la cible est le bouton que la bulle demande de cliquer (« Continuer quand même », #b).
  const iEx = v.etapes.findIndex(e => typeof e.si === 'function' && /#demo-q/.test(String(e.si)));
  const iMsg = cibles.indexOf('#msg-choix'), iRelis = v.etapes.findIndex(e => /Relis avant/.test(e.titre));
  assert.strictEqual(iEx > 0 && v.etapes[iEx].cible, '#modal-root .modal #b', 'l\'anneau de la question de l\'exemple n\'est plus sur « Continuer quand même »');
  assert.ok(iEx > 0 && iMsg > iEx && iRelis > iMsg, 'l\'ordre des étapes ne suit plus celui des questions : ' + cibles.join(' → '));
  [v.etapes[iEx], v.etapes[iMsg]].forEach(e => assert.ok(typeof e.si === 'function' && typeof e.fait === 'function', 'une question qui n\'est pas toujours posée doit être une étape conditionnelle : ' + e.cible));
  // Le marqueur que l'étape attend est bien posé sur la question de l'exemple.
  assert.ok(/'Continuer quand même', null, \{ id: 'demo-q' \}\);/.test(code), 'la question de l\'exemple ne porte plus le nom que la visite reconnaît');
  assert.ok(/<h2\$\{opts && opts\.id \? ` id="\$\{h\(opts\.id\)\}"` : ''\}>/.test(code), '`choiceDialog` ne sait plus nommer sa question');
});

// ------------------------------------------------------------------ l'import depuis un tableur (213e)
// Une entreprise qui démarre a déjà une liste : clients dans un tableur, prix dans un fichier. Les
// retaper un à un, personne ne le fait. Le moteur est pur (`planImport`, `appliquerImport`) ; les
// données de ces tests DISCRIMINENT (10.0.0) : des titres accentués et ponctués comme ceux d'un vrai
// tableur, une adresse en trois colonnes, un homonyme au matricule différent, une ligature.
const entreprise = (extra) => {
  const d = C.migrateData({ company: Object.assign({ name: 'Menuiserie du Lac', currency: 'DT', taxRegime: 'reel' }, extra || {}) });
  return d;
};

t('10.14.0 : un tableur collé — les colonnes se reconnaissent à leurs titres, accents et ponctuation compris', () => {
  const texte = 'Raison sociale\tMatricule fiscal\tTél.\tAdresse e-mail\tAdresse\tCode postal\tVille\n'
    + 'Café des Arts\t7654321/B/M/000\t98 111 222\tcafe@arts.tn\tAvenue Habib Bourguiba\t1000\tTunis\n';
  const d = entreprise();
  const p = C.planImport('clients', texte, d, d.company);
  assert.strictEqual(p.sep, '\t', 'une copie de tableur arrive en tabulations');
  assert.strictEqual(p.entete, true);
  // « Adresse e-mail » est un EMAIL, pas une adresse : le titre exact d'abord, puis les mots dans l'ordre.
  assert.deepStrictEqual(p.colonnes, ['name', 'matricule', 'phone', 'email', 'address', 'complement', 'complement']);
  assert.strictEqual(p.lignes.length, 1, 'la ligne des titres ne devient pas un client');
  const o = p.lignes[0].objet;
  assert.strictEqual(o.address, 'Avenue Habib Bourguiba\n1000 Tunis', 'une adresse en trois colonnes se rassemble : la rue, puis « code postal ville »');
  assert.strictEqual(o.email, 'cafe@arts.tn');
  // Les titres du catalogue : un prix TTC n'est pas un prix HT.
  assert.strictEqual(C.champDeEntete('catalogue', 'Prix TTC'), 'unitPriceTTC');
  assert.strictEqual(C.champDeEntete('catalogue', 'P.U. HT'), 'unitPrice');
  assert.strictEqual(C.champDeEntete('catalogue', 'Taux de TVA (%)'), 'vatRate');
  assert.strictEqual(C.champDeEntete('catalogue', 'Prix d\'achat'), 'unitCost');
  assert.strictEqual(C.champDeEntete('clients', 'Code TVA'), 'matricule');
  // « Code client » est un CODE : joint au nom, il donnerait « Dupont C-0042 » sur chaque facture.
  assert.strictEqual(C.champDeEntete('clients', 'Code client'), '', 'un titre qui parle d\'un code ne devient pas le nom');
  assert.strictEqual(C.champDeEntete('catalogue', 'Réf. produit'), '', 'une référence ne devient pas la désignation');
  // Une cellule qui porte un email ou un numéro est une donnée, jamais un titre.
  assert.strictEqual(C.champDeEntete('clients', 'contact@darelmarsa.tn'), '');
});

t('10.14.0 : un guillemet au milieu d\'une cellule reste un caractère — il n\'avale pas le reste du tableur', () => {
  // « Écran 24" » et « "Premium" pack » : un guillemet seul qui n'est pas suivi d'un séparateur dit
  // que le champ n'était pas protégé. Les lignes suivantes restent des lignes.
  const rows = C.decouperTableau('Écran 24" noir\t350\n"Premium" pack\t25\n"Autre"\t30\n', '\t');
  assert.deepStrictEqual(rows, [['Écran 24" noir', '350'], ['"Premium" pack', '25'], ['Autre', '30']]);
  // Un vrai champ protégé garde ses retours à la ligne et ses guillemets doublés.
  assert.deepStrictEqual(C.decouperTableau('"12 rue X\nImmeuble ""B"""\t1000\n', '\t'), [['12 rue X\nImmeuble "B"', '1000']]);
  // Une liste d'UNE colonne dont certains noms portent une virgule ne se découpe pas sur ses virgules.
  assert.strictEqual(C.separateurTableau('Ben Salah, Ali\nTrabelsi Mohamed\nKarim Jlassi'), null);
  assert.strictEqual(C.separateurTableau('Nom;Prix\nCâble, 5 m;12,500\nVis;0,200'), ';', 'un CSV à la française se lit au point-virgule, même avec des virgules dans les cellules');
});

t('10.14.0 : un nombre de tableur se lit en français, et une cellule illisible REFUSE sa ligne en la nommant', () => {
  const d = entreprise();
  const texte = 'Désignation;Prix HT;TVA;Coût;Stock\n'
    + 'Planche chêne;1 250,500;19;980,000;12\n'
    + 'Pose;25DT;0,07;;\n'
    + 'Lot de vis;douze;19;;\n'
    + 'Colle;-4;19;;\n'
    + 'Vernis;18,000;18;;\n'
    + 'Porte;400;;;-2\n';
  const p = C.planImport('catalogue', texte, d, d.company);
  const l = n => p.lignes.find(x => x.n === n);
  assert.strictEqual(l(2).objet.unitPrice, 1250.5, '« 1 250,500 » vaut mille deux cent cinquante dinars et cinq cents millimes');
  assert.deepStrictEqual([l(2).objet.tracked, l(2).objet.initialQty, l(2).objet.initialCost], [true, 12, 980], 'un stock de départ suit l\'article, à son coût');
  assert.strictEqual(l(3).objet.unitPrice, 25, '« 25DT » : l\'unité collée au nombre se retire');
  // « 0,07 », pas « 0,19 » : la TVA par défaut vaut 19, et un taux refusé qui retombe sur le défaut
  // passerait pour un taux lu (des données qui ne discriminent pas ne prouvent rien, 10.0.0).
  assert.strictEqual(l(3).statut, 'nouveau', 'un taux écrit en fraction entre');
  assert.strictEqual(l(3).objet.vatRate, 7, '« 0,07 » est un taux écrit en fraction');
  assert.strictEqual(l(4).statut, 'refus');
  assert.ok(/Ligne 4 \(Lot de vis/.test(l(4).motifs[0]) && /« douze » n'est pas un prix/.test(l(4).motifs[0]), 'le refus nomme la ligne ET ce qui y est écrit : ' + l(4).motifs[0]);
  assert.strictEqual(l(5).statut, 'refus', 'un prix négatif n\'existe pas');
  assert.ok(/un prix négatif/.test(l(5).motifs[0]));
  assert.strictEqual(l(6).statut, 'refus', 'une TVA inconnue n\'est jamais « arrondie » vers un taux voisin');
  assert.ok(/TVA « 18 » inconnue/.test(l(6).motifs[0]) && /0 %, 7 %, 13 % et 19 %/.test(l(6).motifs[0]), l(6).motifs[0]);
  assert.strictEqual(l(7).statut, 'refus');
  assert.ok(/un stock de départ négatif/.test(l(7).motifs[0]), 'le refus s\'accorde à ce qu\'il nomme : ' + l(7).motifs[0]);
  // Une TVA vide prend celle des nouvelles lignes — le régime décide (7.22.0).
  const q = C.planImport('catalogue', 'Désignation\tPrix HT\nConseil\t100', d, d.company);
  assert.strictEqual(q.lignes[0].objet.vatRate, C.defaultVat(d.company));
});

t('10.14.0 : un prix TTC se convertit en HT avec la TVA de SA ligne — et le régime qui ne facture pas de TVA la ramène à 0 en le disant', () => {
  const d = entreprise();
  const p = C.planImport('catalogue', 'Désignation\tPrix TTC\tTVA\nMain-d\'oeuvre\t23,800\t19\nLivre\t10,700\t7\n', d, d.company);
  assert.strictEqual(p.lignes[0].objet.unitPrice, 20, '23,800 TTC à 19 % = 20,000 HT');
  assert.strictEqual(p.lignes[1].objet.unitPrice, 10, '10,700 TTC à 7 % = 10,000 HT : chaque ligne avec SA TVA');
  const f = entreprise({ taxRegime: 'forfaitaire' });
  assert.ok(!C.assujettiTVA(f.company), 'le jeu de données doit porter un régime sans TVA');
  const r = C.planImport('catalogue', 'Désignation\tPrix HT\tTVA\nConseil\t100\t19\n', f, f.company);
  assert.strictEqual(r.lignes[0].objet.vatRate, 0, 'un régime sans TVA ne facture pas 19 % parce qu\'un vieux tableur le dit');
  assert.ok(/TVA mise à 0 % au lieu de 19 %/.test(r.lignes[0].avert[0]), 'et il le DIT, ligne par ligne');
});

t('10.14.0 : un client déjà là se COMPLÈTE — jamais rien de rempli ne change ; un homonyme au matricule différent est un autre client', () => {
  const d = entreprise();
  d.clients.push(C.clientVierge({ id: 'c1', name: 'Hôtel Dar El Marsa SARL', matricule: '1234567/A/M/000', phone: '71 000 000', email: '' }));
  d.clients.push(C.clientVierge({ id: 'c2', name: 'Boulangerie Ennour', matricule: '1111111/B' }));
  const texte = 'Nom\tMatricule\tTéléphone\tEmail\n'
    + 'HOTEL DAR EL MARSA sarl\t1234567A\t71 234 567\tcontact@darelmarsa.tn\n'
    + 'Boulangerie Ennour\t2222222/C\t\t\n'
    + 'Café des Arts\t\t98 111 222\t\n'
    + 'Café des arts\t\t\t\n'
    + '\t\t55 000 000\tsansnom@x.tn\n';
  const p = C.planImport('clients', texte, d, d.company);
  const [hotel, homonyme, cafe, double, sansNom] = p.lignes;
  assert.strictEqual(hotel.statut, 'existe', 'le même matricule (sept chiffres) désigne le même client, quelle que soit sa graphie');
  assert.deepStrictEqual(hotel.complete, ['email'], 'on ne comble que ce qui est VIDE : le téléphone déjà rempli ne change pas');
  assert.strictEqual(homonyme.statut, 'nouveau', 'deux matricules différents sont deux clients, même sous le même nom');
  assert.strictEqual(cafe.statut, 'nouveau');
  assert.strictEqual(double.statut, 'doublon');
  assert.strictEqual(double.motifs[0], 'même client que la ligne 4');
  assert.strictEqual(sansNom.statut, 'refus');
  assert.ok(/Ligne 6 \(55 000 000, sansnom@x\.tn\) : le nom manque/.test(sansNom.motifs[0]), sansNom.motifs[0]);
  const r = C.appliquerImport(d, p, d.company);
  assert.strictEqual(r.crees.length, 2);
  assert.strictEqual(r.completes, 1);
  const h1 = d.clients.find(c => c.id === 'c1');
  assert.deepStrictEqual([h1.name, h1.phone, h1.email], ['Hôtel Dar El Marsa SARL', '71 000 000', 'contact@darelmarsa.tn'], 'la fiche existante garde son nom et son téléphone, et gagne l\'email qui lui manquait');
  // Un client créé par l'import a la forme d'un client créé par la fiche : le même modèle vierge.
  const cree = d.clients.find(c => c.id === r.crees[1]);
  assert.deepStrictEqual(Object.keys(C.clientVierge()).filter(k => !(k in cree)), [], 'un champ du modèle manque au client importé');
  // Rejouer le MÊME collage ne crée rien : tout est déjà là.
  const encore = C.planImport('clients', texte, d, d.company);
  assert.strictEqual(encore.nouveaux, 0, 'coller deux fois la même liste doublait les clients');
});

t('10.14.0 : sans titres, les colonnes se devinent à leur contenu — un email, un matricule, un taux de TVA se reconnaissent', () => {
  const d = entreprise();
  const p = C.planImport('clients', 'Hôtel Dar El Marsa\t1234567/A/M/000\tcontact@darelmarsa.tn\t71 234 567\nCafé des Arts\t7654321B\tcafe@arts.tn\t+216 98 111 222\n', d, d.company);
  assert.strictEqual(p.entete, false, 'une première ligne sans aucun titre connu est une donnée');
  assert.deepStrictEqual(p.colonnes, ['name', 'matricule', 'email', 'phone']);
  assert.strictEqual(p.nouveaux, 2, 'la première ligne est un client, pas un titre');
  // Un seul mot reconnu dans une ligne de DONNÉES (« Contact Pro SARL ») ne suffit pas à la faire
  // passer pour la ligne des titres : il en faut plus de la moitié.
  const u = C.planImport('clients', 'Contact Pro SARL\tTunis\nBoulangerie Ennour\tSfax\n', d, d.company);
  assert.strictEqual(u.entete, false, '« Contact Pro SARL » a disparu dans l\'en-tête');
  assert.strictEqual(u.nouveaux, 2);
  const q = C.planImport('catalogue', 'Pose de carrelage\t35\t19\nPlinthe\t8,5\t19\n', d, d.company);
  assert.deepStrictEqual(q.colonnes, ['label', 'unitPrice', 'vatRate']);
  // Et le choix de la personne l'emporte : une colonne remise sur « Ignorer » n'entre pas.
  const r = C.planImport('clients', 'Nom\tTéléphone\nCafé des Arts\t98 111 222\n', d, d.company, { champs: ['name', ''] });
  assert.strictEqual(r.lignes[0].objet.phone, '', 'une colonne ignorée n\'entre pas');
  // Un champ NOMBRE n'a qu'une colonne : la seconde repasse sur « Ignorer ».
  const s = C.planImport('catalogue', 'Désignation\tPrix\tTarif\nPose\t10\t12\n', d, d.company);
  assert.deepStrictEqual(s.colonnes, ['label', 'unitPrice', ''], 'deux colonnes de prix pour une ligne');
});

t('10.14.0 : un exemple de l\'assistant que la liste reprend prend TES prix — « oeuvre » reconnaît « œuvre »', () => {
  const d = entreprise({ activity: 'artisanat' });
  d.catalog.push(C.articleVierge(d.company, { id: 'ex1', label: 'Main-d\'œuvre', unitPrice: 20, unit: 'h', fromSetup: true }));
  d.catalog.push(C.articleVierge(d.company, { id: 'ex2', label: 'Déplacement', unitPrice: 15, fromSetup: true }));
  d.catalog.push(C.articleVierge(d.company, { id: 'ex3', label: 'Petites fournitures', unitPrice: 5, fromSetup: true }));
  d.catalog.push(C.articleVierge(d.company, { id: 'mien', label: 'Placard sur mesure', unitPrice: 0, description: '' }));
  // Un exemple déjà porté par une pièce ne part jamais, même proposé au retrait.
  d.documents.push({ id: 'dv1', type: 'devis', lines: [{ itemId: 'ex3', label: 'Petites fournitures', qty: 1, unitPrice: 5 }] });
  const texte = 'Désignation\tPrix HT\tDescription\tCoût\n'
    + 'Main d\'oeuvre\t25\tHeure en atelier\t\n'
    + 'Placard sur mesure\t900\tChêne massif\t400\n'
    + 'Porte coulissante\t650\t\t\n';
  const p = C.planImport('catalogue', texte, d, d.company);
  assert.strictEqual(p.lignes[0].statut, 'remplace', 'la ligature « œ » n\'est pas un « o » accentué : sans le pli, l\'exemple restait et la liste créait un doublon');
  assert.strictEqual(p.lignes[1].statut, 'existe', 'une prestation DÉCIDÉE n\'est jamais remplacée');
  assert.deepStrictEqual(p.lignes[1].complete, ['description', 'unitCost'], 'elle gagne seulement ce qui lui manquait — pas le prix : 0 est une décision (« sur devis »)');
  assert.deepStrictEqual(p.exemples.map(e => e.id), ['ex2'], 'seul l\'exemple ignoré ET sans usage se propose au retrait');
  const r = C.appliquerImport(d, p, d.company, { retirerExemples: true });
  const mo = d.catalog.find(c => c.id === 'ex1');
  assert.deepStrictEqual([mo.unitPrice, mo.fromSetup, mo.description], [25, undefined, 'Heure en atelier'], 'l\'exemple repris devient TA prestation');
  assert.strictEqual(d.catalog.find(c => c.id === 'mien').unitPrice, 0, 'le prix décidé ne change pas');
  assert.ok(!d.catalog.some(c => c.id === 'ex2') && d.catalog.some(c => c.id === 'ex3'), 'l\'exemple retiré part, l\'exemple utilisé reste');
  assert.ok((d.deleted || []).some(x => x.id === 'ex2' && x.kind === 'catalog'), 'un retrait se dit à l\'autre poste d\'un dossier partagé (trackDeletion)');
  assert.deepStrictEqual([r.crees.length, r.remplaces, r.completes, r.retires], [1, 1, 1, 1]);
  // Le pli sert TOUTE recherche : « main d'oeuvre » trouve enfin la prestation que l'assistant pose.
  assert.ok(C.correspondRecherche('Main-d\'œuvre', 'oeuvre'), 'la recherche tapée ne trouve pas « Main-d\'œuvre » en tapant « oeuvre »');
});

t('10.14.0 : un fichier CSV se lit dans SON encodage — Windows-1252 d\'Excel, UTF-8, UTF-16 — et un classeur .xlsx se reconnaît', () => {
  const cp1252 = C.lireFichierTexte(Buffer.from([0x48, 0xf4, 0x74, 0x65, 0x6c, 0x3b, 0x31, 0x32]), 'clients.csv');
  assert.deepStrictEqual(cp1252, { ok: true, texte: 'Hôtel;12' }, 'un CSV enregistré par Excel sous Windows donnait « H�tel »');
  assert.strictEqual(C.lireFichierTexte(Buffer.from('﻿Nom;Prix', 'utf8'), 'a.csv').texte, 'Nom;Prix', 'le BOM d\'un CSV UTF-8 se retire');
  const u16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Café;1', 'utf16le')]);
  assert.strictEqual(C.lireFichierTexte(u16, 'a.txt').texte, 'Café;1', 'l\'export « Texte Unicode » d\'Excel est de l\'UTF-16');
  const xlsx = C.lireFichierTexte(Buffer.from('PK\u0003\u0004reste'), 'Clients.xlsx');
  assert.strictEqual(xlsx.ok, false);
  assert.ok(/« Clients\.xlsx » est un classeur/.test(xlsx.motif) && /copie-les et colle-les ici/.test(xlsx.motif), 'le refus dit quoi faire : ' + xlsx.motif);
  // Le processus principal passe par cette fonction, et rend un refus plutôt qu'une exception.
  const main = lireSource('src', 'main.js');
  const h = main.slice(main.indexOf("ipcMain.handle('file:openText'"), main.indexOf("ipcMain.handle('shell:open'"));
  assert.ok(h.length > 200 && h.length < 2500, 'la tranche du handler est introuvable');
  assert.ok(/lireFichierTexte\(fs\.readFileSync\(p\), nom\)/.test(h), 'le fichier ouvert ne passe plus par le décodeur');
  assert.ok(!/throw /.test(h), 'un mauvais fichier n\'est pas une panne : il se refuse avec sa phrase');
  assert.ok(/openText: \(opts\) => ipcRenderer\.invoke\('file:openText'/.test(lireSource('src', 'preload.js')), 'le pont n\'expose pas l\'ouverture du fichier');
});

t('10.14.0 : l\'import MONTRE avant d\'écrire, replanifie au clic, passe le stock par la licence et se défait', () => {
  const f = corps('async function importerTableau(');
  assert.ok(f.length > 2000 && f.length < 16000, 'la tranche de la fenêtre d\'import est introuvable');
  const clic = f.slice(f.indexOf('ok.onclick = () => {'));
  assert.ok(clic.length > 300, 'le geste d\'import est introuvable');
  // Le plan se recalcule AU CLIC : celui de l'aperçu a pu être dessiné avant le dernier choix de colonne.
  assert.ok(clic.indexOf('C.planImport(') >= 0 && clic.indexOf('C.planImport(') < clic.indexOf('C.appliquerImport('), 'l\'import applique un plan qu\'il n\'a pas recalculé');
  // Un stock de départ est un mouvement de stock : le garde-fou de l'offre passe AVANT l'écriture.
  assert.ok(clic.indexOf('licenceBlock(\'Créer un stock de départ\', \'stock\')') >= 0 && clic.indexOf('licenceBlock(') < clic.indexOf('C.appliquerImport('), 'le stock importé contourne la licence');
  // « Annuler » rend la liste d'avant ET dit la suppression à l'autre poste.
  const annul = clic.slice(clic.indexOf('toastUndo('));
  assert.ok(/data\[cle\] = avant\.liste;/.test(annul) && /data\.deleted = avant\.deleted;/.test(annul) && /forget\(cle, id, ''\)/.test(annul), '« Annuler » ne défait pas tout l\'import');
  // Rien n'est écrit tant qu'on regarde : l'aperçu ne touche pas aux données.
  const apercu = f.slice(f.indexOf('const dessiner = () => {'), f.indexOf('ok.onclick = () => {'));
  assert.ok(!/appliquerImport|save\(/.test(apercu), 'l\'aperçu écrit dans les données');
  // Importer dans l'EXEMPLE, c'est importer dans des données qui partiront avec lui : on en sort d'abord.
  assert.ok(f.indexOf('C.estDemo(data)') >= 0 && f.indexOf('demoSortie()') > f.indexOf('C.estDemo(data)') && f.indexOf('demoSortie()') < f.indexOf('modal('), 'l\'import se range dans l\'exemple');
  // Les entrées : la page Clients (en-tête et état vide), le Catalogue, les premiers pas, la palette.
  ['id="imp-clients"', '\'vide-import\'', 'id="imp-catalogue"', 'data-pas-import=', '\'Importer mes clients depuis un tableur\'', '\'Importer mon catalogue depuis un tableur\'']
    .forEach(x => assert.ok(code.includes(x), 'une entrée de l\'import manque : ' + x));
  // Chaque bulle posée existe dans le guide, et chaque contrôle neuf a son explication pour la visite.
  const G = require('../../src/renderer/guide.js');
  ['imp.coller', 'imp.entete', 'imp.colonnes'].forEach(k => assert.ok(G.INFO[k] && G.INFO[k].a, 'la bulle ' + k + ' manque ou ne mène à aucun article'));
  const vis = lireSource('src', 'renderer', 'visites.js');
  ['#imp-clients', '#imp-catalogue', '#vide-import', '[data-pas-import]', '#imp-texte', '#imp-fichier', '#imp-entete', '[data-col]', '#imp-exemples', '#imp-ok', '#imp-autre']
    .forEach(x => assert.ok(vis.includes(`b('${x}'`), 'la visite n\'explique pas ' + x));
});

t('10.14.0 : un stock de départ sans coût d\'achat se DIT — il vaudrait zéro, et la marge de ses ventes paraîtrait trop belle', () => {
  const d = entreprise();
  const p = C.planImport('catalogue', 'Désignation\tPrix HT\tCoût\tStock\nCâble\t1,000\t0,600\t250\nÉcran\t500\t\t8\nPose\t30\t\t\n', d, d.company);
  const l = n => p.lignes.find(x => x.n === n);
  assert.strictEqual(l(2).avert.length, 0, 'un stock AVEC son coût n\'a rien à dire');
  assert.strictEqual(l(3).statut, 'nouveau', 'le stock sans coût entre quand même : on ne l\'invente pas, on le signale');
  assert.ok(l(3).avert.some(a => /stock de départ de 8 sans coût d'achat/.test(a) && /trop belle/.test(a)), 'le stock sans coût entre sans un mot : ' + JSON.stringify(l(3).avert));
  assert.strictEqual(l(4).avert.length, 0, 'une prestation sans stock n\'a pas de coût de stock à réclamer');
});

t('10.14.0 : ce que l\'import a montré à la souris — colonnes lisibles en entier, doublons dans leur encadré, statuts normaux en bleu, téléphone d\'un bloc', () => {
  const css = lireSource('src', 'renderer', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // « Personne à co… » : la liste d'une colonne prend la largeur de sa plus longue réponse.
  assert.ok(/\.imp-table th select \{ min-inline-size: max-content; \}/.test(css), 'la liste d\'une colonne coupe son libellé');
  const f = corps('async function importerTableau(');
  const apercu = f.slice(f.indexOf('const dessiner = () => {'), f.indexOf('ok.onclick = () => {'));
  // La ligne en double a son encadré titré ; la liste « À relire » ne porte plus que des avertissements.
  assert.ok(/class="info-box imp-doublons"/.test(apercu), 'la ligne en double flotte seule sous l\'encadré des refus');
  const notes = apercu.slice(apercu.indexOf('const notes = [];'), apercu.indexOf('const refus ='));
  assert.ok(notes.length > 20 && !/doublon/.test(notes), 'la liste des notes mêle encore les doublons aux avertissements');
  // `.info-box` et `.ok-box` vivent dans la feuille PARTAGÉE : l'app entreprise les pose désormais.
  assert.ok(/^\.info-box \{/m.test(css) && /^\.ok-box \{/m.test(css), '`.info-box` n\'existe que dans la feuille du Cabinet');
  // Compléter une fiche ou reprendre un exemple est une information : jamais le orange d'une alerte.
  const m = /const STATUTS_IMPORT = (\{[^;]*\});/.exec(app);
  assert.ok(m, 'la table des statuts d\'import est introuvable');
  const S = require('vm').runInNewContext('(' + m[1] + ')');
  ['nouveau', 'complete', 'existe', 'remplace', 'doublon'].forEach(k => assert.ok(!/b-part|b-late/.test(S[k][0]), `le statut « ${S[k][1]} » est peint comme une alerte`));
  assert.strictEqual(S.refus[0], 'b-late', 'un refus reste rouge');
  // Un numéro de téléphone ne se coupe pas en son milieu dans la liste des clients.
  assert.ok(/label: 'Contact', get: r => `<span class="small">\$\{telLisible\(r\.c\.phone\)\}/.test(code), 'la liste des clients coupe les numéros de téléphone');
  assert.ok(/const telLisible = tel => [^\n]*class="nw"/.test(code), 'un numéro n\'est plus tenu d\'un bloc');
});

t('10.14.0 : une liste collée dans la MAUVAISE fenêtre se reconnaît — un tarif chez les clients, des clients dans le catalogue', () => {
  const d = entreprise();
  const tarif = 'Désignation\tUnité\tPrix TTC\tTVA\tStock\nMain-d\'œuvre\theure\t29,750 DT\t19%\t\nCâble\tm\t1,190\t0,19\t250\n';
  const clients = 'Raison sociale\tContact\tMF\tAdresse\tVille\tTél\tEmail\nHôtel du Lac\tLeïla\t1234567/A/M/000\tavenue\tTunis\t71 000 000\ta@b.tn\n';
  // Le défaut vu à la souris : « 7 nouveaux clients », dont un nommé « Désignation ».
  const a = C.planImport('clients', tarif, d, d.company);
  assert.strictEqual(a.autreListe, 'catalogue', 'un tarif collé chez les clients passe pour une liste de clients');
  assert.ok(a.titresAutre.includes('Désignation') && a.titresAutre.includes('Prix TTC'), 'l\'avertissement ne nomme pas les titres reconnus');
  const b = C.planImport('catalogue', clients, d, d.company);
  assert.strictEqual(b.autreListe, 'clients', 'une liste de clients collée dans le catalogue passe pour un tarif');
  // Les bons cas ne sont jamais accusés : la bonne fenêtre, une liste sans titres, un choix coché.
  assert.strictEqual(C.planImport('clients', clients, d, d.company).autreListe, '', 'une liste de clients dans la bonne fenêtre est accusée');
  assert.strictEqual(C.planImport('catalogue', tarif, d, d.company).autreListe, '', 'un tarif dans la bonne fenêtre est accusé');
  assert.strictEqual(C.planImport('clients', 'Hôtel\t71 234 567\ta@b.tn\n', d, d.company).autreListe, '', 'une liste sans titres est accusée');
  assert.strictEqual(C.planImport('clients', tarif, d, d.company, { entete: true }).autreListe, '', 'cocher « la première ligne donne les titres » ne passe pas outre');
  // L'écran : l'avertissement remplace le bilan, l'import s'éteint, et le vert emmène le TEXTE dans l'autre fenêtre.
  const f = corps('async function importerTableau(');
  assert.ok(/ok\.disabled = !!A \|\|/.test(f), 'l\'import d\'une liste collée dans la mauvaise fenêtre reste armé');
  assert.ok(/importerTableau\(p\.autreListe, done, t\)/.test(f), 'le geste ne passe pas la liste à l\'autre import');
  assert.ok(/if \(prerempli\) \{ champ\.value = prerempli;/.test(f), 'l\'autre import ne reprend pas le texte collé');
});

// ------------------------------------------------------------------ « Ta facture à ton image » (213f)
// Le logo, le cachet et les couleurs se réglaient dans les Paramètres, et la page disait « pour les
// voir, ouvre un document » : on choisissait à l'aveugle. La fenêtre montre chaque choix sur la
// prochaine facture, et une couleur trop claire se dit AVANT d'enregistrer (9.4.2).

t('10.14.0 (213f) : le contraste d\'une couleur sur la page blanche — les pastilles proposées se lisent toutes, une couleur claire se signale', () => {
  // Les valeurs de référence du WCAG, calculées à la main : noir 21, blanc 1, gris #777 4,48.
  assert.strictEqual(C.contrasteSurBlanc('#000000'), 21, 'le contraste du noir n\'est pas 21');
  assert.strictEqual(C.contrasteSurBlanc('#ffffff'), 1, 'le contraste du blanc n\'est pas 1');
  assert.strictEqual(C.contrasteSurBlanc('#777777'), 4.48, 'le contraste d\'un gris moyen est faux : la luminance n\'est pas linéarisée');
  assert.strictEqual(C.contrasteSurBlanc('pas une couleur'), null, 'une valeur illisible n\'est pas « 1 »');
  // Chaque pastille proposée se lit sur le blanc (seuil du texte en gras ou en capitales) : sinon la
  // proposition ferait le défaut qu'elle évite.
  assert.ok(C.ACCENTS_PROPOSES.length >= 6, 'le nuancier est trop court pour choisir');
  C.ACCENTS_PROPOSES.forEach(a => {
    assert.ok(/^#[0-9a-f]{6}$/.test(a.hex) && a.nom.length > 2, 'une pastille sans nom ou sans couleur : ' + JSON.stringify(a));
    assert.ok(C.contrasteSurBlanc(a.hex) >= 3, `la pastille « ${a.nom} » (${a.hex}) se lit mal sur le blanc : ${C.contrasteSurBlanc(a.hex)}`);
  });
  assert.ok(C.ACCENTS_PROPOSES.some(a => a.hex.toLowerCase() === C.DEFAULT_COMPANY.accentColor.toLowerCase()), 'la couleur d\'origine n\'est pas dans le nuancier : on ne pourrait pas y revenir d\'un clic');
  // Les couleurs d'origine passent ; une fiche sans couleur retombe sur elles.
  assert.deepStrictEqual(C.lisibiliteMarque(C.DEFAULT_COMPANY), []);
  assert.deepStrictEqual(C.lisibiliteMarque({}), []);
  // Un jaune d'accent et un gris clair de texte se signalent, chacun avec SA raison.
  const clair = C.lisibiliteMarque({ accentColor: '#facc15', primaryColor: '#9ca3af' });
  assert.deepStrictEqual(clair.map(x => x.champ), ['primaryColor', 'accentColor']);
  assert.ok(/tout le texte/.test(clair[0].texte) && /Net à payer/.test(clair[1].texte), 'la phrase ne dit pas ce que la couleur colore');
  // Le mot court tient dans la ligne du titre (il ne pousse rien) : trois ou quatre mots.
  clair.forEach(x => assert.ok(x.court && x.court.length <= 28, 'la remarque courte ne tient pas dans la ligne du titre : ' + x.court));
  // Le seuil du texte courant (4,5) est plus strict que celui de l'accent (3) : #777 passe en accent, pas en texte.
  assert.deepStrictEqual(C.lisibiliteMarque({ accentColor: '#777777', primaryColor: '#777777' }).map(x => x.champ), ['primaryColor'], 'le texte courant se juge au seuil de l\'accent (#777 passe pour du texte)');
});

t('10.14.0 (213f) : « Ta facture à ton image » est une étape FACULTATIVE des premiers pas, cochée par la fiche — jamais par un clic', () => {
  const vide = C.firstSteps({ documents: [], clients: [], catalog: [] }, C.DEFAULT_COMPANY, {});
  const m = vide.etapes.find(e => e.id === 'marque');
  assert.ok(m && m.facultatif === true && m.fait === false, 'l\'étape manque ou n\'est pas facultative');
  assert.strictEqual(vide.etapes.findIndex(e => e.id === 'marque'), vide.etapes.findIndex(e => e.id === 'societe') + 1, 'elle suit la fiche société : c\'est la même question, ce qui s\'imprime en haut');
  const fait = co => C.marquePersonnalisee(co);
  assert.strictEqual(fait(C.DEFAULT_COMPANY), false, 'les couleurs d\'origine ne sont pas une image de marque');
  assert.strictEqual(fait({ ...C.DEFAULT_COMPANY, accentColor: C.DEFAULT_COMPANY.accentColor.toUpperCase() }), false, 'la casse d\'une couleur change le verdict');
  assert.strictEqual(fait({ ...C.DEFAULT_COMPANY, logo: 'data:image/png;base64,AA' }), true);
  assert.strictEqual(fait({ ...C.DEFAULT_COMPANY, stampImage: 'data:image/png;base64,AA' }), true);
  assert.strictEqual(fait({ ...C.DEFAULT_COMPANY, accentColor: '#2563eb' }), true);
  assert.strictEqual(fait({ ...C.DEFAULT_COMPANY, primaryColor: '#334155' }), true);
  assert.strictEqual(fait({ ...C.DEFAULT_COMPANY, logo: '   ' }), false, 'un logo vide compte');
  // Facultative : elle ne devient jamais « la suivante », même quand tout le reste est fait.
  assert.notStrictEqual(vide.suivante && vide.suivante.id, 'marque');
  // L'accueil a son bouton ET sa visite, et la palette la trouve.
  assert.ok(/marque: \['Personnaliser ma facture', \(\) => imageDeMarque\(/.test(code), 'l\'étape n\'a pas de bouton dans l\'accueil');
  assert.ok(/const PAS_VISITES = \{[^}]*marque: 'marque'/.test(code), 'l\'étape n\'a pas de visite guidée');
  assert.ok(/\['Ta facture à ton image[^']*', \(\) => imageDeMarque\(/.test(code), 'la palette ne propose pas la fenêtre');
});

t('10.14.0 (213f) : la fenêtre montre la PROCHAINE facture sans prendre de numéro, et n\'enregistre que le logo, le cachet et les couleurs', () => {
  const f = corps('function factureDApercu(co) {') + corps('function imageDeMarque(done) {');
  // La tranche finit sur l'appel de `modal()` qui ferme la fenêtre : c'est ce qui prouve qu'elle est entière.
  assert.ok(f.length > 2500 && f.length < 12000 && /\}, null, \{[^\n]*\}\);\s*\}$/.test(f), 'tranche de la fenêtre inattendue : ' + f.length);
  // Aucun numéro consommé : `etatNumerotation` lit, `nextNumber` écrirait les compteurs (6.0.0).
  assert.ok(!/nextNumber\(/.test(f), 'l\'aperçu consomme un numéro de facture');
  assert.ok(/C\.etatNumerotation\(data, 'facture'/.test(f), 'l\'aperçu n\'annonce pas le numéro que la facture prendra');
  // Émise pour l'aperçu : aucun tampon « BROUILLON » ne couvre ce qu'on regarde.
  assert.ok(/doc\.status = 'envoyée';/.test(f), 'l\'aperçu porte le tampon BROUILLON');
  // Rien n'est écrit avant le clic, et seuls les quatre champs de l'image de marque le sont.
  const ok = f.slice(f.indexOf('ok.onclick = () => {'), f.indexOf('dessiner();', f.indexOf('ok.onclick = () => {')));
  assert.ok(/MARQUE_CHAMPS\.forEach\(k => \{ data\.company\[k\] = b\[k\]; \}\);/.test(ok), 'l\'enregistrement n\'écrit pas le logo, le cachet et les couleurs');
  // Toute écriture de la fiche — par un point, par des crochets ou par `Object.assign` : compter les
  // seuls crochets laissait passer `data.company.name = …` (vu en le réintroduisant).
  const ecritures = f.match(/data\.company(?:\.\w+|\[[^\]]+\])\s*=(?!=)|Object\.assign\(data\.company/g) || [];
  assert.deepStrictEqual(ecritures, ['data.company[k] ='], 'la fenêtre écrit la fiche société ailleurs que dans « Enregistrer » : ' + ecritures.join(' · '));
  assert.ok(!/data\.(documents|counters)/.test(f), 'la fenêtre touche aux pièces ou aux compteurs');
  const champs = /const MARQUE_CHAMPS = (\[[^\]]*\]);/.exec(code);
  // Un tableau d'un AUTRE contexte n'a pas le même prototype : on le recopie avant de comparer.
  assert.deepStrictEqual([...require('vm').runInNewContext(champs[1])], ['logo', 'stampImage', 'accentColor', 'primaryColor']);
  // Le bouton s'allume au premier changement, et Échap ou « Annuler » demandent avant de jeter un choix.
  assert.ok(/ok\.disabled = !change\(\);/.test(f), '« Enregistrer » est armé sans rien avoir changé');
  assert.ok(/\{ garde: \(\) => change\(\)\s*[,}]/.test(f), 'fermer la fenêtre jette un logo choisi sans demander');
  // Une couleur trop claire se DIT dans la fenêtre, avant d'enregistrer — dans la ligne de SON titre,
  // jamais dans un bloc posé sous les choix : il poussait « Enregistrer » de 41 px au moment où on le
  // visait (vu à la souris). Rien ne s'ajoute sous les choix pendant qu'on les fait.
  assert.ok(/C\.lisibiliteMarque\(/.test(f), 'la fenêtre ne prévient pas d\'une couleur illisible');
  assert.ok(/<div class="mq-t">Couleur d'accent \$\{info\('mq\.accent'\)\}<span class="mq-note" id="mq-note-accentColor"/.test(f)
    && /<div class="mq-t">Couleur du texte \$\{info\('mq\.principale'\)\}<span class="mq-note" id="mq-note-primaryColor"/.test(f), 'la remarque de lisibilité ne vit pas dans la ligne du titre de sa couleur');
  assert.ok(!/warn-box/.test(f), 'un encadré apparaît sous les choix et pousse les boutons');
  // La question d'abandon dit ce qui se perd : ici on n'a rien tapé.
  assert.ok(/perte: 'Le logo, le cachet et les couleurs/.test(f), 'la question d\'abandon parle de ce qu\'on a « tapé »');
  // La page entière dans l'aperçu : le logo est en haut, le cachet en bas (7.13.0).
  assert.ok(/Math\.min\(\(f\.clientWidth - 2\) \/ 794, \(f\.clientHeight - 2\) \/ 1190\)/.test(f), 'l\'aperçu cale la largeur et coupe le cachet');
});

t('10.14.0 (213f) : `modal()` accepte une garde FONCTION — une saisie qui ne vit pas dans des champs (un logo, une pastille) se protège aussi', () => {
  const m = code.slice(code.indexOf('function modal(html, onMount, onDismiss, opts) {'), code.indexOf('function suivreSaisie(layer) {'));
  assert.ok(m.length > 2000, 'modal() introuvable');
  // La garde fournie passe AVANT la garde des champs : sinon un `form` dans la fenêtre l'écraserait.
  const i = m.indexOf("typeof opts.garde === 'function'"), j = m.indexOf('garde = suivreSaisie(layer)');
  assert.ok(i > 0 && j > i, 'une garde fonction est ignorée, ou passe après celle des champs');
  assert.ok(/if \(opts && typeof opts\.garde === 'function'\) garde = opts\.garde;\s*else if/.test(m), 'une garde fonction s\'AJOUTE à celle des champs au lieu de la remplacer');
});

t('10.14.0 (213f) : les Paramètres montrent l\'image de marque et n\'ont qu\'UNE porte pour la changer — la fenêtre qui la montre sur une facture', () => {
  assert.ok(!/Pour les voir, ouvre un document/.test(code), 'le panneau renvoie encore à un document pour voir ses couleurs');
  // Plus aucun champ du logo, du cachet ni des couleurs dans le formulaire : deux façons de modifier
  // la même chose divergent, et « Voir sur une facture… » enregistrait d'abord une couleur pas encore vue.
  const page = code.slice(code.indexOf("${panneau('p-marque')}"), code.indexOf("${panneau('p-textes')}"));
  assert.ok(page.length > 20 && page.length < 400, 'panneau de l\'image de marque introuvable : ' + page.length);
  assert.ok(/\$\{marqueResume\(c\)\}/.test(page), 'le panneau ne montre pas ce qui est posé');
  assert.ok(!/name="(primaryColor|accentColor)"|id="pick-(logo|stamp)"/.test(code), 'les Paramètres gardent une seconde façon de changer le logo ou les couleurs');
  assert.ok(!/const setImage = /.test(code), 'le geste qui écrivait une image sans aperçu est resté');
  const r = corps('function marqueResume(c) {');
  assert.ok(/id="marque-apercu">Changer le logo, le cachet ou les couleurs…</.test(r), 'le résumé n\'a pas son unique bouton');
  // Une couleur déjà trop claire le dit dans le résumé aussi — JOUÉ, pas lu : une remarque définie
  // dans la fonction et jamais posée dans son gabarit passerait un test qui cherche sa classe.
  const resume = require('vm').runInNewContext('(' + r.replace(/^function marqueResume/, 'function') + ')',
    { C, info: () => '', h: s => String(s) });
  assert.ok(!/mq-note/.test(resume(C.DEFAULT_COMPANY)), 'le résumé signale une couleur d\'origine');
  const pale = { ...C.DEFAULT_COMPANY, accentColor: '#facc15' };
  assert.ok(resume(pale).includes('>' + C.lisibiliteMarque(pale)[0].court + '</span>'), 'le résumé tait une couleur illisible');
  // Ouvrir la fenêtre enregistre d'abord ce qui est tapé AILLEURS dans la page (5.2.1).
  assert.ok(/\$\('#marque-apercu'\)\.onclick = \(\) => \{ if \(applySettings\(\) === false\) return; imageDeMarque\(/.test(code), 'ouvrir la fenêtre jette ce qui est tapé dans les Paramètres (5.2.1)');
  // La bulle « Couleurs » ne conseille plus les couleurs claires — ce sont celles qui ne se lisent pas.
  const g = lireSource('src', 'renderer', 'guide.js');
  const bulle = /'co\.colors': \{ t: 'Couleurs', d: '((?:[^'\\]|\\.)*)'/.exec(g);
  assert.ok(bulle && !/couleurs claires/.test(bulle[1]) && /TOUT le texte/.test(bulle[1]), 'la bulle « Couleurs » conseille encore une couleur claire');
  // Et les explications ne nomment plus un bouton qui n'existe plus.
  assert.ok(!/Voir sur une facture/.test(g) && !/Voir sur une facture/.test(lireSource('src', 'renderer', 'visites.js')), 'une explication nomme encore « Voir sur une facture… »');
});

t('10.14.0 : chaque champ des formulaires du premier jour porte sa bulle — la fiche société, l\'assistant, un client, un fournisseur', () => {
  // Vu au test humain de 213f : « Téléphone », « Email » et « Site web » n'avaient pas de « i » dans
  // la fiche société, et la fiche client en avait quatre sur onze. Ce sont les quatre formulaires qu'on
  // remplit le premier jour — la règle du projet veut que chaque champ explique ce qu'il devient.
  const tranche = (debut, fin) => { const i = code.indexOf(debut); const j = i < 0 ? -1 : code.indexOf(fin, i); return i < 0 || j < 0 ? '' : code.slice(i, j); };
  const formulaires = {
    'fiche société': tranche("${panneau('p-identite')}", "${panneau('p-regime')}"),
    'assistant': tranche("if (s.id === 'entreprise') return `<form id=\"sf-form\"", '</form>'),
    'client': tranche('function clientForm(client, done, preset) {', '<div class="modal-actions">'),
    'fournisseur': tranche('function supplierForm(supplier, done, preset) {', '<div class="modal-actions">')
  };
  Object.entries(formulaires).forEach(([nom, f]) => {
    assert.ok(f.length > 400 && f.length < 5000, `formulaire « ${nom} » introuvable : ${f.length}`);
    const nus = [
      ...(f.match(/field\('[^']*'/g) || []),                                        // un libellé passé en texte à field()
      ...(f.match(/<label class="field[^"]*"[^>]*>(?!\$\{lbl\()[^<$]+</g) || []),      // un libellé écrit en texte dans la balise
      ...(f.match(/<label class="field[^"]*"[^>]*><span>[^<]*<\/span>/g) || [])        // un libellé dans un <span> sans bulle
    ];
    assert.deepStrictEqual(nus, [], `« ${nom} » : ${nus.length} champ(s) sans bulle — ${nus.join(' · ')}`);
  });
  // Qu'une bulle posée existe dans guide.js, c'est le test général des bulles qui le tient.
});

t('10.14.0 : chaque champ de TOUTE l\'application porte sa bulle — libellés, dates et listes de choix', () => {
  // Le test du premier jour ne lisait que quatre formulaires : 113 champs des autres fenêtres (le
  // paiement, un salarié, une absence, un mouvement de stock, une écriture…) n'expliquaient rien. La
  // règle vaut pour tout le fichier ; les seules exceptions sont NOMMÉES, et chacune dit pourquoi.
  const EXCEPTIONS = [
    /^<label class="field">\$\{label/,          // field() lui-même : son libellé lui est passé
    /^<div class="field\$\{o && o\.obligatoire[^}]*\}">\$\{label/, // dateFieldHtml() lui-même (son étoile suit `o.obligatoire`)
    /^<label class="field mb">\$\{h\(label\)/,  // une clause de contrat : le panneau « Clauses » porte la bulle
    /^<label class="field span-2">\$\{\/\*/,    // promptDialog : la bulle est `o.info`, quand l'appelant la donne
    /^<div class="field"><span>La prochaine portera/ // une lecture, pas un champ : le numéro que prendra la facture
  ];
  const nus = [
    ...(code.match(/\bfield\((?!lbl\()(?!`<span class="fl")(?!label,)[^,\n]{0,70}/g) || []), // field() dont le libellé n'est pas lbl( : texte, gabarit ou expression
    ...(code.match(/dateFieldHtml\('[^']+'/g) || []),                                  // une date au libellé nu
    // 10.14.1 — la balise peut porter d'autres attributs APRÈS sa classe (`id`, `style`, `hidden`) : la
    // sonde les ignorait, et le « Pourcentage » de la facture d'acompte, le solde du relevé et le compte
    // du grand livre passaient nus sous elle. Un test trop étroit laisse passer le défaut (9.9.0).
    ...(code.match(/<(?:label|div) class="field[^"]*"[^>]*>(?!\$\{lbl\()(?!' \+ lbl\()[^<]{1,60}/g) || []), // texte ou ${…} sans lbl
    ...(code.match(/<(?:label|div) class="field[^"]*"[^>]*><span>[^<]*<\/span>/g) || [])  // un <span> sans bulle
  ].filter(x => !/^<(label|div) class="field[^"]*"[^>]*>\s*$/.test(x))
    .filter(x => !EXCEPTIONS.some(r => r.test(x)));
  assert.deepStrictEqual(nus, [], `${nus.length} champ(s) sans bulle — ${nus.join(' · ')}`);
  // Chaque exception désigne encore quelque chose : une exception qui ne sert plus finit par couvrir autre chose.
  // Et une bulle mène à l'article qui PARLE du champ : « Montant » d'un paiement menait à la numérotation.
  const G = require('../../src/renderer/guide.js');
  [['ed.payAmount', 'paiements'], ['ed.payDate', 'paiements'], ['ed.depositMode', 'acompte'], ['ed.pieceDepart', 'pieces']]
    .forEach(([k, art]) => assert.strictEqual(G.articleDe(k), art, k + ' mène à « ' + G.articleDe(k) + ' »'));
  EXCEPTIONS.forEach(r => assert.ok((code.match(/<(?:label|div) class="field[^"]*">[^\n]{0,60}/g) || []).some(x => r.test(x)), 'exception sans objet : ' + r));
});

t('10.14.0 : un client et un article naissent d\'UN modèle — la fiche, la création à la volée et l\'import', () => {
  assert.ok(/const c = client \|\| C\.clientVierge\(preset\);/.test(code), 'la fiche client recopie son propre modèle');
  assert.ok(/function articleNeuf\(extra\) \{\s*return C\.articleVierge\(company\(\), extra\);/.test(code), 'la fiche article recopie son propre modèle');
  const a = C.articleVierge({ taxRegime: 'reel', defaultVatRate: 7 }, { label: 'X' }, '2026-09-24');
  assert.deepStrictEqual([a.label, a.vatRate, a.initialDate, a.tracked], ['X', 7, '2026-09-24', false]);
});
};
