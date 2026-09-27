'use strict';
// ============================================================================================
// La facture électronique : le fichier TEIF pour El Fatoora (10.15.0)
//
// Ce que ces tests tiennent :
//   • chaque facture et chaque avoir ÉMIS des cinq ans de l'exemple donne un fichier que le SCHÉMA
//     OFFICIEL de la TTN accepte (xmllint, sur la version 1.0 du XSD 1.8.8 — voir
//     test/fixtures/teif/LISEZMOI.md) ; sans lui, l'ordre d'un élément ou un code de référentiel
//     faux ne se verraient qu'au dépôt, c'est-à-dire le jour de l'échéance ;
//   • les rapports entre montants que le Guide TEIF sous-entend : total HT = somme des lignes,
//     TTC = HT + taxes, TVA d'un taux = base × taux — et le TTC est celui du PDF (un seul calcul) ;
//   • les deux formes XSD 1.1 que le schéma 1.0 ne peut pas vérifier (le matricule fiscal de
//     l'émetteur et celui du fournisseur I-62), relues ici sur chaque fichier ;
//   • qu'aucun fichier ne sort tant qu'une identité est incomplète, et que chaque refus nomme la
//     case qui le règle.
// Les montants attendus sont calculés à la main (7.0.1), jamais recopiés de la sortie.
module.exports = ({ t, assert, lireSource }) => {
const fs = require('fs'), os = require('os'), path = require('path');
const cp = require('child_process');
const C = require('../../src/renderer/core.js');
const T = require('../../src/renderer/teif.js');
const D = require('../../src/renderer/demo.js');

const XSD = path.join(__dirname, '..', 'fixtures', 'teif', 'teif-1.8.8-withoutSig.xsd');
const societe = extra => Object.assign({}, C.DEFAULT_COMPANY, {
  name: 'Menuiserie Essai SARL', matricule: '1234567A/A/M/000', address: '12 rue de Marseille, 1000 Tunis',
  phone: '71 000 000', email: 'contact@essai.tn', rib: '08 006 0110001234567 89', bank: 'BIAT', rc: 'B12345', currency: 'DT', stampFee: 1
}, extra || {});
const client = extra => Object.assign({ id: 'c1', name: 'Clinique Les Jasmins', matricule: '1871165H/A/M/000', address: 'Avenue Habib Bourguiba, 2080 Ariana' }, extra || {});
const facture = extra => Object.assign({
  id: 'd1', type: 'facture', status: 'envoyée', number: 'FAC-2026-014', date: '2026-03-04', dueDate: '2026-04-03',
  clientId: 'c1', currency: 'DT', applyStamp: true, discountRate: 0, withholdingRate: 0,
  lines: [{ label: 'Pose de parquet', qty: 12.5, unitPrice: 38.5, vatRate: 19, unit: 'm²' }]
}, extra || {});
// Lire les montants d'un code dans une portion du XML.
const montants = (xml, code) => [...xml.matchAll(new RegExp(`amountTypeCode="${code}"[^>]*>\\s*<Amount[^>]*>(-?[0-9.]+)<`, 'g'))].map(m => Number(m[1]));
const somme = a => Math.round(a.reduce((s, x) => s + x, 0) * 1000) / 1000;

// Le contrôle des rapports entre montants, sur un fichier.
function coherence(xml, attendu) {
  const invoiceMoa = xml.slice(xml.indexOf('<InvoiceMoa>'), xml.indexOf('</InvoiceMoa>'));
  const lin = xml.slice(xml.indexOf('<LinSection>'), xml.indexOf('</LinSection>'));
  const tax = xml.slice(xml.indexOf('<InvoiceTax>'), xml.indexOf('</InvoiceTax>'));
  const ht = montants(invoiceMoa, 'I-176')[0], ttc = montants(invoiceMoa, 'I-180')[0];
  assert.strictEqual(somme(montants(lin, 'I-171')), ht, 'le total HT (I-176) n\'est pas la somme des lignes (I-171)');
  assert.strictEqual(somme([ht, ...montants(tax, 'I-178')]), ttc, 'le TTC (I-180) n\'est pas le HT plus les taxes (I-178)');
  // TVA d'un taux = base × taux, au millime près (le Guide ne fixe aucune méthode d'arrondi).
  for (const bloc of tax.split('<InvoiceTaxDetails>').slice(1)) {
    if (!/code="I-1602"/.test(bloc)) continue;
    const taux = Number(/<TaxRate>([^<]+)</.exec(bloc)[1]);
    const base = montants(bloc, 'I-177')[0], tva = montants(bloc, 'I-178')[0];
    assert.ok(Math.abs(base * taux / 100 - tva) <= 0.0015, `TVA ${taux} % : ${tva} pour une base de ${base}`);
  }
  if (attendu != null) assert.strictEqual(ttc, attendu, 'le TTC du fichier n\'est pas celui du PDF');
}
// Les deux assertions XSD 1.1 que le schéma 1.0 a perdues : le matricule de l'émetteur et du I-62.
const MF_XSD = /^[0-9]{7}[ABCDEFGHJKLMNPQRSTVWXYZ][ABDNP][CMNP][0]{3}$/;
function matriculesXsd11(xml) {
  const emetteur = /<MessageSenderIdentifier type="I-01">([^<]*)</.exec(xml);
  assert.ok(emetteur && MF_XSD.test(emetteur[1]), 'le matricule de l\'émetteur n\'a pas la forme exigée par le schéma');
  const i62 = /functionCode="I-62">\s*<Nad>\s*<PartnerIdentifier type="I-01">([^<]*)</.exec(xml);
  assert.ok(i62 && MF_XSD.test(i62[1]), 'le matricule du fournisseur (I-62) n\'a pas la forme exigée par le schéma');
}
// xmllint : présent sur les postes Linux et dans la CI Linux. Sous Windows, le schéma n'est pas
// relu (et c'est DIT) ; les rapports entre montants le sont partout.
function xmllint() {
  const r = cp.spawnSync('xmllint', ['--version'], { encoding: 'utf8' });
  return !r.error;
}

t('TEIF : chaque facture et chaque avoir émis des cinq ans de l\'exemple passent le schéma officiel 1.8.8', () => {
  const data = D.buildDemoData(societe(), '2026-09-20');
  const co = Object.assign({}, data.company, { matricule: '1234567A/A/M/000' });
  const pieces = data.documents.filter(d => ['facture', 'avoir'].includes(d.type) && d.status !== 'brouillon');
  assert.ok(pieces.length > 150, 'l\'exemple n\'a presque aucune pièce émise : ' + pieces.length);
  assert.ok(pieces.some(d => d.type === 'avoir') && pieces.some(d => Number(d.discountRate) > 0) && pieces.some(d => d.currency && d.currency !== 'DT'),
    'l\'exemple ne porte plus d\'avoir, de remise ou de devise : le test ne discriminerait plus rien');
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'teif-'));
  const fichiers = [];
  for (const d of pieces) {
    const cl = data.clients.find(c => c.id === d.clientId);
    const r = T.teifXml(d, cl, co, { facture: data.documents.find(x => x.id === d.creditOf) });
    assert.ok(r.ok, `${d.number} : ${r.bloquants.map(b => b.message).join(' ')}`);
    coherence(r.xml, Number(T.montantTeif(C.computeTotals(d, co).totalTTC, d.currency || 'DT')));
    matriculesXsd11(r.xml);
    const f = path.join(dossier, r.nom); fs.writeFileSync(f, r.xml); fichiers.push(f);
  }
  if (!xmllint()) {
    assert.ok(process.platform !== 'linux', 'xmllint est introuvable sur un poste Linux : le schéma ne serait pas relu');
    console.log('  (xmllint absent sur ' + process.platform + ' : schéma TEIF non relu, montants vérifiés)');
    return;
  }
  const r = cp.spawnSync('xmllint', ['--noout', '--schema', XSD, ...fichiers], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const valides = (r.stderr.match(/ validates$/gm) || []).length;
  assert.strictEqual(valides, fichiers.length, 'fichiers refusés par le schéma :\n' + r.stderr.split('\n').filter(l => !/validates$/.test(l)).slice(0, 12).join('\n'));
});

t('TEIF : les montants d\'une facture calculés à la main — lignes, TVA, timbre, TTC en lettres', () => {
  // 12,5 m² × 38,500 = 481,250 HT ; TVA 19 % = 91,43750 → 91,438 ; timbre 1,000 ; TTC 573,688.
  const r = T.teifXml(facture(), client(), societe());
  assert.ok(r.ok, JSON.stringify(r.bloquants));
  assert.deepStrictEqual(montants(r.xml, 'I-176'), [481.25]);
  assert.deepStrictEqual(montants(r.xml, 'I-180'), [573.688]);
  assert.match(r.xml, /amountTypeCode="I-180"[^>]*>\s*<Amount currencyIdentifier="TND">573\.688<\/Amount>\s*<AmountDescription lang="fr">Cinq cent soixante-treize dinars et six cent quatre-vingt-huit millimes<\/AmountDescription>/);
  assert.match(r.xml, /code="I-1601">Droit de timbre<\/TaxTypeName>[\s\S]*?amountTypeCode="I-178"[^>]*>\s*<Amount currencyIdentifier="TND">1\.000</);
  assert.match(r.xml, /<Quantity measurementUnit="M2">12\.5<\/Quantity>/, 'une quantité à point décimal, l\'unité en huit caractères');
  assert.match(r.xml, /<DateText format="ddMMyy" functionCode="I-31">040326<\/DateText>/);
  assert.match(r.xml, /<DateText format="ddMMyy" functionCode="I-32">030426<\/DateText>/);
  assert.match(r.xml, /<PaymentTearmsTypeCode>I-114<\/PaymentTearmsTypeCode>/, 'un RIB : le paiement par virement');
  coherence(r.xml, 573.688);
});

t('TEIF : une remise globale se répartit sur les lignes sans perdre un millime', () => {
  // Trois lignes de 33,333 HT, remise 10 % : 99,999 − 10,000 (9,9999 arrondi) = 89,999 HT.
  // Chaque ligne nette vaut 29,9997 → 30,000 ; trois fois = 90,000 : le millime de trop va à la dernière.
  const d = facture({ discountRate: 10, lines: [1, 2, 3].map(i => ({ label: 'Poste ' + i, qty: 1, unitPrice: 33.333, vatRate: 19 })) });
  const r = T.teifXml(d, client(), societe());
  assert.ok(r.ok);
  assert.deepStrictEqual(montants(r.xml, 'I-172'), [99.999], 'le HT avant remise');
  assert.deepStrictEqual(montants(r.xml, 'I-176'), [89.999], 'le HT après remise');
  assert.deepStrictEqual(montants(r.xml, 'I-171'), [30, 30, 29.999]);
  assert.strictEqual((r.xml.match(/<Alc allowanceCode="I-151">/g) || []).length, 3, 'la remise se dit sur chaque ligne remisée');
  coherence(r.xml, Number(T.montantTeif(C.computeTotals(d, societe()).totalTTC, 'DT')));
});

t('TEIF : une facture en euros garde sa devise et ses deux décimales', () => {
  const d = facture({ currency: 'EUR', exchangeRate: 3.4, lines: [{ label: 'Audit', qty: 3, unitPrice: 333.333, vatRate: 0 }] });
  const r = T.teifXml(d, client({ matricule: 'FR 12 345678901' }), societe());
  assert.ok(r.ok, JSON.stringify(r.bloquants));
  assert.match(r.xml, /<Amount currencyIdentifier="EUR">1000\.00<\/Amount>/, '3 × 333,33 € = 999,99… arrondi par ligne au centime');
  assert.ok(!/currencyIdentifier="TND"/.test(r.xml), 'un montant en dinars sur une facture en euros');
  assert.match(r.xml, /<MessageRecieverIdentifier type="I-04">FR12345678901<\/MessageRecieverIdentifier>/, 'un client étranger : matricule non tunisien');
});

t('TEIF : l\'avoir renvoie à la facture qu\'il corrige, avec sa date', () => {
  const orig = facture();
  const av = facture({ id: 'a1', type: 'avoir', number: 'AVO-2026-002', date: '2026-03-20', creditOf: 'd1', creditOfNumber: 'FAC-2026-014', creditReason: 'Geste commercial', applyStamp: false });
  const r = T.teifXml(av, client(), societe(), { facture: orig });
  assert.ok(r.ok);
  assert.match(r.xml, /<DocumentType code="I-12">Facture d&apos;avoir<\/DocumentType>\s*<DocumentReferences>\s*<DocumentReference>\s*<Reference refID="I-89">FAC-2026-014<\/Reference>\s*<ReferenceDate>\s*<DateText format="ddMMyy" functionCode="I-31">040326</);
  assert.match(r.xml, /subjectCode="I-48">\s*<FreeTexts>Motif : Geste commercial</);
  assert.ok(!/I-1601/.test(r.xml), 'un avoir sans timbre ne porte pas de droit de timbre');
  // Un avoir libre part sans référence, et le DIT sans bloquer.
  const libre = T.teifXml(Object.assign({}, av, { creditOf: '', creditOfNumber: '' }), client(), societe());
  assert.ok(libre.ok && !/DocumentReferences/.test(libre.xml));
  assert.ok(libre.remarques.some(x => /I-89/.test(x.message)));
});

t('TEIF : une profession libérale émet une note d\'honoraires (I-13) ; une entreprise hors TVA garde sa mention', () => {
  const lib = T.teifXml(facture(), client(), societe({ activity: 'sante' }));
  const liberale = C.estLiberal(societe({ activity: 'sante' }));
  if (liberale) assert.match(lib.xml, /<DocumentType code="I-13">/); else assert.match(lib.xml, /<DocumentType code="I-11">/);
  const autre = C.ACTIVITIES.find(a => a.honoraires);
  assert.ok(autre, 'plus aucun métier ne porte de note d\'honoraires : le test ne discrimine plus');
  assert.match(T.teifXml(facture(), client(), societe({ activity: autre.id })).xml, /<DocumentType code="I-13">Note d&apos;honoraire<\/DocumentType>/);
  assert.match(T.teifXml(facture(), client(), societe()).xml, /<DocumentType code="I-11">Facture<\/DocumentType>/);
  const forfait = societe({ taxRegime: 'forfaitaire' });
  const d = facture({ lines: [{ label: 'Réparation', qty: 1, unitPrice: 100, vatRate: 0 }] });
  const mention = C.mentionTVA(forfait, 'fr');
  if (mention) assert.ok(T.teifXml(d, client(), Object.assign(forfait, { matricule: '1234567A/A/M/000' })).xml.includes(T.echapper(mention).slice(0, 20)), 'la mention hors TVA ne part pas');
});

t('TEIF : un matricule se lit sous toutes ses écritures, et ce qui lui manque se nomme', () => {
  assert.strictEqual(T.lireMatricule('1234567A/A/M/000').valeur, '1234567AAM000');
  assert.strictEqual(T.lireMatricule('1234567 A / A / M / 000').valeur, '1234567AAM000');
  assert.strictEqual(T.lireMatricule('1234567aam000').valeur, '1234567AAM000');
  assert.ok(T.lireMatricule('').vide);
  assert.match(T.lireMatricule('1234567A').motif, /s'arrête à la lettre-clé/);
  assert.match(T.lireMatricule('1234567I/A/M/000').motif, /lettre-clé « I »/);
  assert.match(T.lireMatricule('1234567A/F/M/000').motif, /forfaitaire/);
  assert.match(T.lireMatricule('1234567A/A/E/001').motif, /catégorie « E »/);
  assert.match(T.lireMatricule('1234567A/A/M/001').motif, /établissement « 001 »/);
  assert.match(T.lireMatricule('2345678B/A/000').motif, /n'a pas la forme/);
  // Un client : la carte d'identité (étiquette comprise), la carte de séjour, un identifiant étranger.
  assert.deepStrictEqual(T.lireIdentifiantClient('CIN 09876543'), { ok: true, type: 'I-02', valeur: '09876543', personne: true });
  assert.deepStrictEqual(T.lireIdentifiantClient('C.I.N. n° 09876543'), { ok: true, type: 'I-02', valeur: '09876543', personne: true });
  assert.strictEqual(T.lireIdentifiantClient('123456789').type, 'I-03');
  assert.strictEqual(T.lireIdentifiantClient('GB 123 4567 89').type, 'I-04');
  assert.ok(!T.lireIdentifiantClient('2345678B/A/000').ok, 'un matricule tunisien incomplet n\'est pas un identifiant étranger');
});

t('TEIF : aucun fichier tant qu\'une identité manque, et chaque refus nomme sa case', () => {
  const pas = (r, cible) => { assert.ok(!r.ok && !r.xml, 'un fichier est sorti malgré le refus'); assert.ok(r.bloquants.some(b => b.cible === cible), 'refus sans la case ' + cible + ' : ' + JSON.stringify(r.bloquants)); };
  pas(T.teifXml(facture({ status: 'brouillon', number: '' }), client(), societe()), 'piece');
  pas(T.teifXml(facture({ type: 'devis' }), client(), societe()), 'piece');
  pas(T.teifXml(facture(), client(), societe({ matricule: '1234567A' })), 'societe:matricule');
  pas(T.teifXml(facture(), client({ matricule: '' }), societe()), 'client:matricule');
  pas(T.teifXml(facture(), null, societe()), 'client');
  pas(T.teifXml(facture(), client(), societe({ name: '' })), 'societe:name');
});

t('TEIF : un caractère réservé s\'échappe, un caractère de contrôle disparaît', () => {
  const r = T.teifXml(facture({ lines: [{ label: 'Pièces <moteur> & joints "neufs"\u0007', qty: 1, unitPrice: 10, vatRate: 19 }] }), client({ name: 'Ben Salah & Fils' }), societe());
  assert.ok(r.ok);
  assert.match(r.xml, /Pièces &lt;moteur&gt; &amp; joints &quot;neufs&quot;<\/ItemDescription>/);
  assert.ok(!/\u0007/.test(r.xml));
  assert.match(r.xml, /Ben Salah &amp; Fils/);
});

t('TEIF : une date est un jour de calendrier, sous tous les fuseaux', () => {
  const avant = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Africa/Tunis', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      assert.strictEqual(T.dateTeif('2026-01-01'), '010126', tz);
      assert.strictEqual(T.dateTeif('2026-12-31'), '311226', tz);
    }
  } finally { if (avant === undefined) delete process.env.TZ; else process.env.TZ = avant; }
});

t('TEIF : le geste vit sur une facture ou un avoir émis, et le refus passe AVANT l\'enregistrement du fichier', () => {
  const brut = lireSource('src', 'renderer', 'app.js');
  const app = brut.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.match(app, /locked && \(isInv \|\| isAv\) && doc\.status !== 'annulée' \? `<div class="ml-ligne"><button id="teif">/, 'l\'entrée de menu');
  assert.match(app, /\$\('#teif'\)\.onclick = \(\) => exporterTeif\(/, 'l\'entrée n\'est branchée à rien');
  const f = app.slice(app.indexOf('async function exporterTeif('), app.indexOf('function clientForm('));
  assert.ok(f.length > 500 && f.length < 8000, 'tranche inattendue : ' + f.length);
  assert.ok(f.indexOf('if (!r.ok)') > 0 && f.indexOf('if (!r.ok)') < f.indexOf('bridge.saveText('), 'le fichier s\'enregistre avant le contrôle');
  const bloc = f.slice(f.indexOf('if (!r.ok)'), f.indexOf('bridge.saveText('));
  assert.match(bloc, /\n {6}return;\n {4}\}/, 'un refus qui n\'arrête pas l\'enregistrement');
  // Depuis l'exemple, un fichier officiel ne part pas sans la question — et le refus se dit avant elle.
  const q = f.indexOf('demoBlock(');
  assert.ok(q > f.indexOf('if (!r.ok)') && q < f.indexOf('bridge.saveText('), 'le fichier part de l\'exemple sans la question');
  assert.match(f, /if \(await demoBlock\([^)]*\)\) return;/, 'la réponse à la question n\'arrête rien');
  // Un avoir émis garde son « Plus ▾ » : c'est là que vit le fichier.
  assert.match(app, /const avecPlus = !isNew && \(!isAv \|\| !figee \|\| \(locked && doc\.status !== 'annulée'\)\);/);
  // Le module se charge après core.js, dont il se sert.
  const html = lireSource('src', 'renderer', 'index.html');
  assert.ok(html.indexOf('src="core.js"') > 0 && html.indexOf('src="core.js"') < html.indexOf('src="teif.js"'), 'teif.js chargé avant core.js');
});

// ---------- lire la facture électronique d'un fournisseur (H1, étude Hesabi) ----------
const nous = { matricule: '1871165H/A/M/000' };   // l'acheteur des factures ci-dessous
t('TEIF lu : chaque facture et chaque avoir de l\'exemple, écrits puis RELUS, redonnent leurs montants au millime', () => {
  const data = D.buildDemoData(societe(), '2026-09-20');
  let n = 0;
  for (const d of data.documents.filter(x => ['facture', 'avoir'].includes(x.type) && x.number && x.status !== 'brouillon' && x.status !== 'annulée')) {
    const cl = data.clients.find(c => c.id === d.clientId);
    const orig = d.creditOf ? data.documents.find(x => x.id === d.creditOf) : null;
    const r = T.teifXml(d, cl, data.company, { facture: orig });
    if (!r.ok) continue;
    n++;
    const l = T.lireTeif(r.xml, { matricule: cl.matricule });
    assert.ok(l.ok, d.number + ' : ' + l.motif);
    const t0 = C.computeTotals(d, data.company), lu = l.lecture;
    assert.strictEqual(lu.number, d.number);
    assert.strictEqual(lu.date, d.date, d.number + ' : date');
    assert.strictEqual(lu.kind, d.type === 'avoir' ? 'avoir' : 'facture');
    if (d.type === 'avoir' && d.creditOfNumber) assert.strictEqual(lu.refFacture, d.creditOfNumber);
    assert.strictEqual(lu.totalHT, t0.netHT, d.number + ' : HT');
    assert.strictEqual(lu.totalTTC, t0.totalTTC, d.number + ' : TTC');
    assert.strictEqual(lu.fees, t0.stamp, d.number + ' : timbre');
    // Les lignes proposées refont le HT : c'est ce que l'achat comptera.
    const refait = C.round3(lu.lines.reduce((s, x) => s + C.round3(x.qty * x.unitPrice), 0));
    assert.ok(Math.abs(refait - t0.netHT) <= 0.0015, `${d.number} : les lignes refont ${refait} pour ${t0.netHT}`);
    // Une facture juste ne déclenche aucune remarque de recomptage.
    assert.deepStrictEqual(l.remarques.filter(x => !/signé|en EUR|en USD|AVOIR|taux de change/.test(x)), [], d.number);
  }
  assert.ok(n > 250, 'l\'exemple ne donne que ' + n + ' fichiers');
});

t('TEIF lu : une facture calculée à la main — remise, deux taux, timbre, reconnue comme adressée à nous', () => {
  const d = facture({ discountRate: 10, lines: [
    { label: 'Pose de parquet', qty: 12.5, unitPrice: 38.5, vatRate: 19, unit: 'm²' },
    { label: 'Plinthes', qty: 3, unitPrice: 20, vatRate: 7 }] });
  const r = T.teifXml(d, client(), societe());
  const l = T.lireTeif(r.xml, nous);
  assert.ok(l.ok);
  // 481,250 + 60 = 541,250 HT brut ; remise 10 % : 487,125 HT. TVA : 433,125 × 19 % = 82,294 ; 54 × 7 % = 3,78.
  assert.strictEqual(l.lecture.totalHT, 487.125);
  assert.strictEqual(l.lecture.vatByRate[19].base, 433.125);
  assert.strictEqual(l.lecture.vatByRate[7].vat, 3.78);
  assert.strictEqual(l.lecture.totalTTC, 487.125 + 82.294 + 3.78 + 1);
  assert.strictEqual(l.lecture.fees, 1);
  assert.strictEqual(l.lecture.supplier, 'Menuiserie Essai SARL');
  // Le fichier l'écrit compacté ; la fiche du fournisseur le reçoit tel qu'on le lit sur une facture.
  assert.strictEqual(l.lecture.matricule, '1234567A/A/M/000', 'le matricule lu garde sa forme compactée, que personne ne reconnaît');
  assert.strictEqual(T.mfLisible('1234567AAM000'), '1234567A/A/M/000');
  assert.strictEqual(T.mfLisible('FR12345678901'), 'FR12345678901', 'ce qui n\'est pas un matricule tunisien reste tel quel');
  assert.strictEqual(T.mfLisible('09876543'), '09876543', 'une carte d\'identité reste telle quelle');
  assert.strictEqual(l.lecture.fournisseur.rc, 'B12345');
  assert.strictEqual(l.lecture.fournisseur.email, 'contact@essai.tn');
  assert.deepStrictEqual(l.remarques.filter(x => !/signé/.test(x)), [], 'la facture est adressée à nous : ' + l.remarques.join(' | '));
  // Adressée à un autre matricule : on le dit, en nommant l'acheteur.
  const autre = T.lireTeif(r.xml, { matricule: '7654321B/A/M/000' });
  assert.ok(autre.remarques.some(x => /pas à ta société/.test(x) && /Clinique Les Jasmins/.test(x)));
});

t('TEIF lu : un montant faux sur la facture se DIT (recomptage), il ne passe pas en silence', () => {
  const r = T.teifXml(facture(), client(), societe());
  // 481,25 HT à 19 % = 91,438 de TVA ; on écrit 91,500 dans le bloc de taxes.
  const fausse = r.xml.replace(/(<AmountDetails>\s*<Moa [^>]*amountTypeCode="I-178">\s*<Amount [^>]*>)91\.438(<)/, '$191.500$2');
  assert.notStrictEqual(fausse, r.xml, 'le montant de TVA n\'a pas été trouvé dans le fichier');
  const l = T.lireTeif(fausse, nous);
  assert.ok(l.remarques.some(x => /La TVA à 19 %/.test(x)), l.remarques.join(' | '));
  assert.ok(l.remarques.some(x => /annonce .* TTC/.test(x)), 'le TTC ne se recompte pas');
});

t('TEIF lu : un fichier qui n\'est pas une facture électronique est refusé avec sa raison, jamais lu à moitié', () => {
  assert.match(T.lireTeif('<?xml version="1.0"?><Facture><x/></Facture>').motif, /pas une facture électronique TEIF/);
  assert.match(T.lireTeif('<TEIF><InvoiceBody><Bgm>').motif, /tronqué/);
  assert.match(T.lireTeif('<!DOCTYPE x [<!ENTITY a "b">]><TEIF/>').motif, /DOCTYPE/);
  assert.match(T.lireTeif('ceci n\'est pas du xml < du tout').motif, /bien formé/);
  assert.match(T.lireTeif('<TEIF></TEIF>').motif, /corps/);
  // Les entités du XML et un bloc CDATA se lisent ; les préfixes de nom (ds:) sont ignorés.
  const a = T.analyserXml('<a x="1 &amp; 2"><b>L&apos;&#233;t&#xE9;</b><![CDATA[<brut>]]><ds:c/></a>');
  assert.ok(a.ok);
  assert.strictEqual(a.racine.attrs.x, '1 & 2');
  assert.strictEqual(a.racine.enfants[0].texte, 'L\'été');
  assert.strictEqual(a.racine.texte, '<brut>');
  assert.strictEqual(a.racine.enfants[1].nom, 'c');
});

t('TEIF lu : la facture validée par la TTN (signée, avec sa référence) ne réclame plus rien', () => {
  const r = T.teifXml(facture(), client(), societe());
  const nonSigne = T.lireTeif(r.xml, nous);
  assert.ok(nonSigne.remarques.some(x => /pas signé/.test(x)));
  const valide = r.xml.replace('</TEIF>', '<RefTtnVal>TTN-2026-000123</RefTtnVal><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignatureValue>abc</ds:SignatureValue></ds:Signature></TEIF>');
  const l = T.lireTeif(valide, nous);
  assert.ok(l.lecture.signe);
  assert.strictEqual(l.lecture.refTtn, 'TTN-2026-000123');
  assert.ok(!l.remarques.some(x => /pas signé/.test(x)));
});

t('TEIF lu : le fournisseur se reconnaît à son matricule écrit avec ou sans séparateurs, puis devient un achat', () => {
  const r = T.teifXml(facture(), client(), societe());
  const l = T.lireTeif(r.xml, nous);
  const data = { suppliers: [{ id: 's9', name: 'Autre nom commercial', matricule: '1234567 A/A/M/000' }], company: { currency: 'DT' } };
  const p = C.ocrToPurchase(l.lecture, data, '2026-09-27');
  assert.strictEqual(p.head.supplierId, 's9', 'le matricule compacté n\'a pas reconnu le fournisseur');
  assert.strictEqual(p.head.number, 'FAC-2026-014');
  assert.strictEqual(p.head.date, '2026-03-04');
  assert.strictEqual(p.head.dueDate, '2026-04-03');
  assert.strictEqual(p.head.fees, 1);
  assert.strictEqual(p.head.kind, 'facture');
  assert.strictEqual(p.computedHT, 481.25);
  assert.deepStrictEqual(p.warnings, []);
  // Un avoir reste un avoir.
  const av = T.teifXml(Object.assign(facture(), { type: 'avoir', number: 'AVO-2026-002', creditOfNumber: 'FAC-2026-014', applyStamp: false }), client(), societe());
  const pa = C.ocrToPurchase(T.lireTeif(av.xml, nous).lecture, data, '2026-09-27');
  assert.strictEqual(pa.head.kind, 'avoir');
  assert.strictEqual(pa.head.refFacture, 'FAC-2026-014');
});

t('TEIF lu : le geste vit dans l\'éditeur d\'achat, lit sur le poste, et passe par la relecture', () => {
  const brut = lireSource('src', 'renderer', 'app.js');
  const app = brut.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.match(app, /id="teif-lire">Lire une e-facture…<\/button>\$\{info\('buy\.teif'\)\}/);
  // Seulement sur une pièce NEUVE : relue par-dessus une pièce saisie, la lecture la remplacerait.
  assert.match(app, /\$\{clos \|\| !isNew \? '' : `<button class="btn" id="teif-lire">/, 'la lecture est proposée sur une pièce déjà saisie');
  const h = app.slice(app.indexOf("$('#teif-lire').onclick"), app.indexOf("$('#photo').onclick"));
  assert.ok(h.length > 200 && h.length < 2000, 'tranche inattendue : ' + h.length);
  assert.match(h, /filtre: 'xml'/, 'le sélecteur ne propose pas les fichiers XML');
  assert.match(h, /SkanTeif\.lireTeif\(r\.texte, company\(\)\)/);
  assert.match(h, /ocrReviewForm\(l\.lecture, fichier, [\s\S]{0,120}source: 'teif'/, 'la lecture ne passe pas par la relecture');
  assert.ok(!/bridge\.ocrRead|fetch\(/.test(h), 'la lecture d\'un XML ne doit rien envoyer');
  // Le processus principal rend le chemin, pour joindre le fichier à l'achat comme justificatif.
  const main = lireSource('src', 'main.js');
  const m = main.slice(main.indexOf("ipcMain.handle('file:openText'"), main.indexOf("ipcMain.handle('shell:open'"));
  assert.match(m, /o\.filtre === 'xml'\) return Object\.assign\(\{ nom, chemin: p \}/);
});
};
