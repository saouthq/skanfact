// Les PAGES d'un document : ce qui sort vraiment de l'imprimante.
//
// Pourquoi ce test existe : `npm test` ne peut rien dire d'une mise en page — il n'y a ni DOM ni
// moteur d'impression. Or c'est là que vivaient les défauts que Skander a vus sur sa capture du
// 14/09/2026 : sur un devis un peu long, le pied de page s'imprimait PAR-DESSUS les cases de
// signature, la première page ne portait aucune mention légale, et la seconde était vide aux trois
// quarts. Rien de tout cela n'apparaît dans une console.
//
// Il n'ouvre PAS Electron : il fabrique le HTML avec core.js, le rend dans chromium, exécute
// `fitToPage` puis `paginate` exactement comme la fenêtre PDF de main.js, imprime un vrai PDF et
// mesure. Sept types de documents, six variantes, de 1 à 40 lignes.
//
//   npm run e2e:pages          (pas besoin de xvfb : chromium tourne sans écran)
const path = require('path');
const fs = require('fs');
const { playwright, RACINE, journal, dossierCaptures } = require('./harnais');
const C = require(path.join(RACINE, 'src', 'renderer', 'core.js'));

// Playwright installé dans le projet peut ne pas avoir SON chromium (image préchargée, version
// décalée). On essaie le chemin normal, puis les navigateurs déjà présents sur la machine.
async function ouvrirChromium(pw) {
  try { return await pw.chromium.launch({ args: ['--no-sandbox'] }); } catch (e) {
    const racines = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
    for (const r of racines) {
      let noms = [];
      try { noms = fs.readdirSync(r); } catch { continue; }
      for (const n of noms.filter(x => /^chromium(-\d+)?$/.test(x)).sort().reverse()) {
        for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
          const p = path.join(r, n, rel);
          if (fs.existsSync(p)) {
            try { return await pw.chromium.launch({ executablePath: p, args: ['--no-sandbox'] }); } catch { /* suivant */ }
          }
        }
      }
    }
    console.error('\nChromium est introuvable pour Playwright :\n  npx playwright install chromium\n');
    throw e;
  }
}

const COMPANY = {
  name: 'Atelier des Mesures SUARL', matricule: '1234567X/A/M/000',
  address: '12 rue des Essais\n1000 Tunis', phone: '+216 20 000 000',
  email: 'contact@exemple.tn', website: 'exemple.tn',
  currency: 'DT', accentColor: '#0f9d8f', stampFee: 1, taxRegime: 'reel',
  rib: 'TN59 1234 5678 9012 3456 7890', bank: 'Banque de Test',
  paymentTerms: 'Paiement à 30 jours par virement bancaire.',
  quoteTerms: 'Les prix sont fermes pendant la durée de validité du devis.'
};
const CLIENT = {
  name: 'Cabinet Ben Salah Avocats', address: '45 avenue Habib Bourguiba\n1001 Tunis',
  matricule: '7654321Y/A/M/000', contact: 'Me Ben Salah', phone: '+216 71 111 111', email: 'contact@bensalah.tn'
};
const MODELES = [
  { label: 'Formation sensibilisation', description: 'Session de 6 heures pour l\'ensemble du personnel, supports fournis.', qty: 6, unit: 'h', unitPrice: 150, vatRate: 7 },
  { label: 'Audit de sécurité réseau', description: 'Cartographie, tests d\'intrusion internes, rapport détaillé.', qty: 2, unit: 'j', unitPrice: 900, vatRate: 19 },
  { label: 'Installation de pare-feu', description: 'Matériel, paramétrage, règles de filtrage et documentation.', qty: 3, unit: 'u', unitPrice: 750, vatRate: 19 },
  { label: 'Maintenance et supervision', description: 'Supervision 24/7 avec rapport mensuel.', qty: 3, unit: 'mois', unitPrice: 400, vatRate: 19 }
];
const NOTES_LONGUES = Array.from({ length: 40 }, (_, i) =>
  'Condition particulière ' + (i + 1) + " : ce paragraphe existe pour rendre le bloc de fin de document plus haut qu'une page entière.").join('\n');
const LOGO = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><rect width="200" height="60" fill="#0f9d8f"/></svg>').toString('base64');

const TYPES = ['devis', 'facture', 'avoir', 'proforma', 'commande', 'livraison', 'contrat'];
const VARIANTES = [
  { nom: 'fr', co: {}, doc: {}, ns: [1, 2, 5, 8, 9, 12, 20, 40] },
  { nom: 'en', co: {}, doc: { lang: 'en', currency: 'EUR', exchangeRate: 3.4 }, ns: [2, 9, 20] },
  { nom: 'forfaitaire', co: { taxRegime: 'forfaitaire' }, doc: {}, sansTva: true, ns: [2, 9, 20] },
  { nom: 'remise+retenue', co: {}, doc: { discountRate: 10, withholdingRate: 1.5 }, ns: [2, 9, 20] },
  { nom: 'logo', co: { logo: LOGO, tagline: 'Sécurité des systèmes d\'information' }, doc: {}, ns: [2, 9, 20] },
  { nom: 'notes interminables', co: {}, doc: { notes: NOTES_LONGUES }, ns: [2, 9, 20] }
];

function document1(type, n, v) {
  const lines = [];
  for (let i = 0; i < n; i++) {
    const m = MODELES[i % MODELES.length];
    lines.push({ ...m, label: m.label + (i >= MODELES.length ? ' (' + (Math.floor(i / MODELES.length) + 1) + ')' : ''),
      vatRate: v.sansTva ? 0 : m.vatRate });
  }
  const d = {
    id: 'd', type, number: 'DOC-2026-011', status: 'émis', date: '2026-09-10', dueDate: '2026-10-10',
    clientId: 'c1', subject: 'Mise en conformité et sécurisation du système d\'information',
    lines, currency: 'DT', ...v.doc
  };
  if (type === 'avoir') d.creditOfNumber = 'FAC-2026-003';
  if (type === 'contrat') d.clauses = C.DEFAULT_CLAUSES;
  if (type === 'livraison') d.hidePrices = true;
  return d;
}

(async () => {
  const j = journal();
  const pw = playwright();
  const nav = await ouvrirChromium(pw);
  const pg = await nav.newPage();
  const dossier = dossierCaptures('pages');
  const soucis = [];
  let cas = 0, maxPages = 0;

  j.etape('Sept types de documents, six variantes, de 1 à 40 lignes');
  for (const v of VARIANTES) {
    for (const type of TYPES) {
      for (const n of v.ns) {
        const doc = document1(type, n, v);
        const co = { ...COMPANY, ...v.co };
        await pg.setContent(C.documentHtml(doc, CLIENT, co, {}), { waitUntil: 'load' });
        const avant = await pg.evaluate(() => ({
          tr: document.querySelectorAll('table.lines tbody tr').length,
          cl: document.querySelectorAll('.clauses .cl').length,
          nl: document.querySelectorAll('.notes .n-l').length,
          txt: document.querySelector('.page').innerText.replace(/\s+/g, ' ').length
        }));
        await pg.evaluate('(' + C.fitToPage.toString() + ')(document)');
        const annonce = await pg.evaluate('(' + C.paginate.toString() + ')(document)');
        const m = await pg.evaluate(() => {
          const P = document.querySelector('.page');
          const H = 296 * (P.offsetWidth / 210);
          const ps = [...document.querySelectorAll('.page')];
          return {
            nb: ps.length,
            tr: document.querySelectorAll('table.lines tbody tr').length,
            cl: document.querySelectorAll('.clauses .cl').length,
            nl: document.querySelectorAll('.notes .n-l').length,
            txt: ps.map(p => p.innerText).join(' ').replace(/\s+/g, ' ').length,
            pieds: document.querySelectorAll('.footer').length,
            bandeaux: document.querySelectorAll('.cont').length,
            // Un en-tête de colonnes par page QUI PORTE DES LIGNES : quand le tableau tient sur la
            // première et que la seconde ne porte que les totaux, il n'y a rien à répéter.
            pagesAvecLignes: ps.filter(p => p.querySelector('table.lines tbody tr')).length,
            entetes: document.querySelectorAll('table.lines thead').length,
            // ce qui dépasse de la feuille : overflow:hidden le MASQUERAIT
            debord: Math.max(0, ...ps.map(p => { const z = p.querySelector('.inner'); return Math.round(z.offsetTop + z.offsetHeight - H); })),
            // le pied imprimé par-dessus le contenu : le défaut d'origine
            chevauche: ps.filter(p => {
              const f = p.querySelector('.footer'), z = p.querySelector('.inner');
              return f && z && z.getBoundingClientRect().bottom > f.getBoundingClientRect().top + 1;
            }).length,
            numeros: ps.map(p => (p.querySelector('.footer .f-right') || {}).textContent || '')
          };
        });
        const pdf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true,
          margin: { top: 0, bottom: 0, left: 0, right: 0 } });
        const feuilles = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
        const cle = `${v.nom}/${type}/${n} lignes`;
        const pb = [];
        // Ce qui ne se négocie pas : rien ne disparaît.
        if (m.tr !== avant.tr) pb.push(`${avant.tr - m.tr} ligne(s) perdue(s)`);
        if (m.cl !== avant.cl) pb.push(`${avant.cl - m.cl} clause(s) perdue(s)`);
        if (m.nl !== avant.nl) pb.push(`${avant.nl - m.nl} ligne(s) de notes perdue(s)`);
        if (m.txt < avant.txt - 5) pb.push(`du texte a disparu (${avant.txt} → ${m.txt})`);
        if (m.debord > 1) pb.push(`une page déborde de ${Math.round(m.debord / (96 / 25.4))} mm`);
        if (m.chevauche) pb.push(`${m.chevauche} pied(s) imprimé(s) sur le contenu`);
        // Ce qu'on promet : une page fabriquée = une feuille, chacune avec son pied numéroté.
        if (m.nb !== feuilles) pb.push(`${m.nb} pages fabriquées pour ${feuilles} feuilles`);
        if (annonce !== feuilles) pb.push(`l'aperçu annoncerait ${annonce} page(s) pour ${feuilles}`);
        if (m.pieds !== feuilles) pb.push(`${m.pieds} pied(s) pour ${feuilles} feuille(s)`);
        if (m.bandeaux !== feuilles - 1) pb.push(`${m.bandeaux} bandeau(x) de continuation pour ${feuilles} feuille(s)`);
        if (feuilles > 1 && !/page 1 sur /.test(m.numeros[0] || '')) pb.push('les feuilles ne sont pas numérotées');
        if (m.entetes !== m.pagesAvecLignes) pb.push(`${m.entetes} en-tête(s) de colonnes pour ${m.pagesAvecLignes} page(s) de lignes`);
        cas++;
        maxPages = Math.max(maxPages, feuilles);
        if (pb.length) soucis.push(cle + ' → ' + pb.join(' ; '));
      }
    }
  }
  j.ok(cas + ' documents mesurés, jusqu\'à ' + maxPages + ' feuilles');

  j.etape('Un devis court tient toujours sur UNE page');
  for (const n of [1, 2, 3, 4, 5]) {
    await pg.setContent(C.documentHtml(document1('devis', n, VARIANTES[0]), CLIENT, COMPANY, {}), { waitUntil: 'load' });
    await pg.evaluate('(' + C.fitToPage.toString() + ')(document)');
    const p = await pg.evaluate('(' + C.paginate.toString() + ')(document)');
    if (p !== 1) soucis.push(`un devis de ${n} ligne(s) fait ${p} pages`);
  }
  j.ok('de une à cinq lignes : une seule page');

  j.etape('Le resserrement ne sert QUE s\'il fait gagner une page');
  // Un document qui fera deux pages de toute façon doit garder son interligne : le resserrer ne
  // gagne rien et se lit moins bien (c'était le défaut de fitToPage employée seule).
  await pg.setContent(C.documentHtml(document1('devis', 12, VARIANTES[0]), CLIENT, COMPANY, {}), { waitUntil: 'load' });
  await pg.evaluate('(' + C.fitToPage.toString() + ')(document)');
  await pg.evaluate('(' + C.paginate.toString() + ')(document)');
  const serre = await pg.evaluate(() => document.querySelector('.page').className);
  if (/compact|dense/.test(serre)) soucis.push('un devis de 12 lignes est resserré pour rien (' + serre + ')');
  j.ok('douze lignes : deux pages, sans resserrement inutile');

  j.etape('Captures');
  // Le nom du fichier porte le nombre de pages MESURÉ, jamais celui qu'on espérait : un nom écrit à
  // l'avance finit par mentir dès que le gabarit bouge d'un millimètre.
  const faits = [];
  for (const n of [8, 14, 30]) {
    await pg.setContent(C.documentHtml(document1('facture', n, VARIANTES[0]), CLIENT, COMPANY, {}), { waitUntil: 'load' });
    await pg.evaluate('(' + C.fitToPage.toString() + ')(document)');
    const p = await pg.evaluate('(' + C.paginate.toString() + ')(document)');
    const nom = `facture-${String(n).padStart(2, '0')}-lignes-${p}-page${p > 1 ? 's' : ''}`;
    const pdf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    fs.writeFileSync(path.join(dossier, nom + '.pdf'), pdf);
    await pg.setViewportSize({ width: 820, height: 1180 });
    await pg.screenshot({ path: path.join(dossier, nom + '.png'), fullPage: true });
    faits.push(nom);
  }
  j.ok(faits.join(', ') + ' — dans ' + dossier);

  await nav.close();
  if (soucis.length) {
    console.log('\n❌ ' + soucis.length + ' cas sur ' + cas + ' :');
    soucis.forEach(s => console.log('   ' + s));
    process.exit(1);
  }
  console.log('\n✅ ' + j.total() + ' étapes, ' + cas + ' documents : aucune ligne perdue, aucun débordement,\n' +
    '   aucun pied sur le contenu, une feuille par page fabriquée.');
})().catch(e => { console.error(e); process.exit(1); });
