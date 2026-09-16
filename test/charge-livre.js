// Le test de charge du livre comptable (9.1.0, SPEC-OUT-006).
//
//   npm run charge
//
// POURQUOI IL PASSE AVANT LA 9.2.0, ET PAS APRÈS.
//
// La 9.2.0 écrit `livre.json` : un fichier par dossier et par exercice, chiffré, réécrit en entier
// à chaque validation d'écriture. Le format une fois livré chez un cabinet pilote ne se change plus
// sans migration. Or personne n'a jamais mesuré ce que ce format coûte — et « on mesure avant
// d'écrire un format, jamais après » est la seule raison d'être de ce script. S'il échoue, c'est la
// 9.2.0 qui change, avant d'exister : découpage par mois, index séparé, corps binaire au lieu de
// base64, journal d'ajouts plutôt que réécriture totale. Chacune de ces décisions coûte une heure
// aujourd'hui et un chantier dans deux ans.
//
// CE QU'IL MESURE VRAIMENT. Le livre du cabinet est chiffré avec la même clé dérivée que
// `cabinet-data.json` (scrypt N=2^15, AES-256-GCM, corps en base64). Mesurer un JSON en clair
// donnerait un chiffre qui n'existe nulle part : l'ouverture, c'est lire + déchiffrer + analyser +
// valider, et l'écriture, c'est sérialiser + chiffrer + écrire atomiquement. On passe donc par les
// primitives RÉELLES de `cabstore.js`, pas par une imitation.
//
// LES QUATRE SEUILS (QUESTIONS.md § 5, écrits AVANT la mesure — c'est ce qui les rend honnêtes) :
//   ouverture d'un livre         <  1 000 ms   on ouvre un dossier, on attend une seconde au pire
//   ajout + écriture atomique    <    100 ms   à chaque écriture validée : au-delà, la saisie rame
//   balance de 60 dossiers       <  5 000 ms   le tableau de production du cabinet, en entier
//   recherche globale            <  3 000 ms   « où est cette facture ? » sur tout le portefeuille
//
// Le script ÉCHOUE (exit 1) au premier seuil dépassé, mais il imprime les quatre : savoir lequel
// passe et de combien vaut autant que savoir lequel tombe.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const K = require('../src/renderer/compta.js');

// ---------------------------------------------------------------- les mêmes primitives que cabstore
// Recopiées ici, à l'identique, plutôt qu'importées : `cabstore.js` ne les exporte pas, et les
// exporter pour un test de charge élargirait sa surface publique pour rien. Un écart entre les deux
// fausserait la mesure, donc un contrôle le refuse plus bas.
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MARK = 'skanfact-cabinet';
const deriveKey = (password, salt) => crypto.scryptSync(String(password), salt, 32, SCRYPT);

function sealWithKey(obj, salt, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(obj), 'utf8')), cipher.final()]);
  return {
    [MARK]: 1, kdf: 'scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), data: body.toString('base64')
  };
}
function openWithKey(env, key) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  d.setAuthTag(Buffer.from(env.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(env.data, 'base64')), d.final()]).toString('utf8'));
}

// Le contrôle annoncé : si `cabstore.js` change ses paramètres, la mesure ne veut plus rien dire.
(function verifierLesPrimitives() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'cabinet', 'cabstore.js'), 'utf8');
  const memes = [
    ['SCRYPT', 'const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };'],
    ['aes-256-gcm', "crypto.createCipheriv('aes-256-gcm', key, iv)"],
    ['base64', "data: body.toString('base64')"]
  ];
  const ecarts = memes.filter(([, ligne]) => !src.includes(ligne)).map(([nom]) => nom);
  if (ecarts.length) {
    console.error(`\n  cabstore.js a changé (${ecarts.join(', ')}) : cette mesure ne vaut plus rien.`);
    console.error('  Reporte le changement ici avant de relancer.\n');
    process.exit(1);
  }
})();

// ---------------------------------------------------------------- un livre plausible
//
// Plausible, pas aléatoire : six journaux, quatre cents comptes, trois cents tiers, douze mois, et
// des pièces qui s'équilibrent vraiment. Un jeu de données qui ne s'équilibre pas mesurerait un
// `isValidLivre` qui sort à la première ligne — c'est-à-dire rien.
const JOURNAUX = [
  { code: 'VT', libelle: 'Ventes', type: 'ventes' },
  { code: 'AC', libelle: 'Achats', type: 'achats' },
  { code: 'BQ', libelle: 'Banque', type: 'tresorerie', compte: '532' },
  { code: 'CA', libelle: 'Caisse', type: 'tresorerie', compte: '54' },
  { code: 'PAIE', libelle: 'Paie', type: 'paie' },
  { code: 'OD', libelle: 'Opérations diverses', type: 'od' }
];
const pad = (n, l) => String(n).padStart(l, '0');

function fabriquerLivre(dossier, annee, lignesVoulues) {
  // Un générateur déterministe plutôt que Math.random : deux exécutions doivent être comparables,
  // sinon une mesure qui bouge de 15 % ne dit pas si c'est le code ou le jeu de données.
  //
  // Mulberry32, et surtout PAS un générateur congruentiel linéaire (`g * 1103515245 + 12345`). Ma
  // première version en utilisait un, avec `graine % max` : les bits de POIDS FAIBLE d'un LCG ont
  // une période très courte, donc `% 12` ne rendait que six mois sur douze, et l'un d'eux n'avait
  // que 18 écritures sur 16 667. Le jeu de données était donc faux — douze mois annoncés, six
  // fabriqués — et tout ce qui se mesure par mois (centralisateur, découpage) mesurait autre chose
  // que ce qu'il annonçait. Un banc d'essai dont les données mentent fait mentir le verdict, et
  // c'est le pire cas : il a l'air de fonctionner.
  let graine = 0x9e3779b9;
  const suivant = (max) => {
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296 * max) | 0;
  };

  const plan = [
    { compte: '411', libelle: 'Clients', nature: 'tiers', collectif: true, source: 'sce' },
    { compte: '401', libelle: 'Fournisseurs', nature: 'tiers', collectif: true, source: 'sce' },
    { compte: '532', libelle: 'Banque', nature: 'tresorerie', source: 'sce' },
    { compte: '4367', libelle: 'TVA collectée', nature: 'bilan', source: 'sce' },
    { compte: '4366', libelle: 'TVA déductible', nature: 'bilan', source: 'sce' }
  ];
  for (let i = 0; i < 300; i++) plan.push({ compte: '411' + pad(i + 1, 3), libelle: 'Client ' + (i + 1), nature: 'tiers', parent: '411', tiersId: 'c_' + pad(i, 4), source: 'import' });
  for (let i = 0; i < 95; i++) plan.push({ compte: '60' + pad(i, 2), libelle: 'Charge ' + (i + 1), nature: 'gestion', source: 'sce' });

  const ecritures = [];
  let lignes = 0, numero = 0;
  while (lignes < lignesVoulues) {
    const j = JOURNAUX[suivant(JOURNAUX.length)];
    const mois = 1 + suivant(12);
    const jour = 1 + suivant(28);
    const date = `${annee}-${pad(mois, 2)}-${pad(jour, 2)}`;
    const tiers = suivant(300);
    const ht = 100 + suivant(9900);
    const tva = Math.round(ht * 190) / 1000;      // 19 % au millime
    const ttc = Math.round((ht + tva) * 1000) / 1000;
    const piece = `${j.code === 'VT' ? 'FAC' : j.code}-${annee}-${pad(ecritures.length + 1, 5)}`;
    numero++;
    ecritures.push({
      id: 'e_' + pad(numero, 8),
      numero, date, journal: j.code, piece,
      libelle: `${j.libelle} ${piece} Client ${tiers + 1}`,
      source: 'skanfact', mois: `${annee}-${pad(mois, 2)}`, docId: 'd_' + pad(numero, 8),
      pieceJointe: `ventes/${piece}.pdf`,
      statut: 'validee', auteur: 'import', creeLe: 1789800000000 + numero, valideeLe: 1789800000000 + numero,
      contrepasseDe: null, extourneDe: null,
      lignes: [
        { compte: '411' + pad(tiers + 1, 3), tiersId: 'c_' + pad(tiers, 4), libelle: 'Client ' + (tiers + 1), debit: ttc, credit: 0, lettre: numero % 3 === 0 ? 'L' + pad(numero % 900, 3) : '' },
        { compte: '60' + pad(suivant(95), 2), libelle: 'Prestation', debit: 0, credit: ht, lettre: '' },
        { compte: '4367', libelle: 'TVA collectée 19 %', debit: 0, credit: tva, lettre: '' }
      ]
    });
    lignes += 3;
  }
  return {
    format: 1, dossier, plan, journaux: JOURNAUX, ecritures,
    exercice: { annee, du: `${annee}-01-01`, au: `${annee}-12-31`, clos: false, closLe: null, closPar: null, reouvertures: [] },
    lettrages: [], releves: [], immobilisations: [], declarations: [],
    ouverture: { date: null, source: null, lignes: [] },
    audit: [{ quand: 1789800000000, qui: 'charge', quoi: 'fabrication', detail: lignes + ' lignes' }]
  };
}

// ---------------------------------------------------------------- le validateur
//
// Ce que `isValidLivre` fera en 9.2.0 (SPEC-FUNC-103), écrit ici pour que la mesure d'ouverture
// porte sur le VRAI travail — une traversée complète de toutes les lignes. Un contrôle qui ne
// regarderait que l'entête mesurerait une ouverture qui n'existe pas.
//
// Les invariants sont ceux de SPEC-DATA-005 : Σdébit = Σcrédit par écriture, jamais débit ET crédit
// sur une ligne, jamais de montant négatif.
function isValidLivre(l) {
  if (!l || typeof l !== 'object' || l.format !== 1) return false;
  if (!Array.isArray(l.ecritures) || !Array.isArray(l.plan) || !Array.isArray(l.journaux)) return false;
  const codes = Object.create(null);
  l.journaux.forEach(j => { codes[j.code] = true; });
  for (let i = 0; i < l.ecritures.length; i++) {
    const e = l.ecritures[i];
    if (!e || !Array.isArray(e.lignes) || e.lignes.length < 2) return false;
    if (!codes[e.journal]) return false;
    let d = 0, c = 0;
    for (let k = 0; k < e.lignes.length; k++) {
      const li = e.lignes[k];
      if (!li.compte) return false;
      if (li.debit < 0 || li.credit < 0) return false;
      if (li.debit && li.credit) return false;
      d += li.debit; c += li.credit;
    }
    if (Math.round((d - c) * 1000) !== 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------- mesurer
const ms = n => (n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('fr-FR')) + ' ms';
const mo = o => (o / 1024 / 1024).toFixed(1) + ' Mo';
const chrono = (fn) => { const t = performance.now(); const r = fn(); return { ms: performance.now() - t, r }; };
const mediane = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const SEUILS = { ouverture: 1000, ecriture: 100, balance: 5000, recherche: 3000 };
const mesures = {};
const echecs = [];

function juger(cle, titre, valeur, detail) {
  mesures[cle] = valeur;
  const seuil = SEUILS[cle];
  const ok = valeur < seuil;
  if (!ok) echecs.push(`${titre} : ${ms(valeur)} — le seuil est ${ms(seuil)}`);
  console.log(`  ${ok ? '✓' : '✗'} ${titre.padEnd(34)} ${ms(valeur).padStart(11)}   (seuil ${ms(seuil)})${detail ? '\n      ' + detail : ''}`);
}

(function principal() {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-charge-'));
  console.log('\nTest de charge du livre comptable (SPEC-OUT-006)');
  console.log(`  Node ${process.version} · ${os.cpus()[0].type ? os.cpus()[0].model.trim() : process.arch} · ${os.cpus().length} cœurs`);
  console.log(`  Dossier d'essai : ${dossier}\n`);

  // La clé est dérivée UNE fois, comme au déverrouillage de l'application. C'est le piège de cette
  // mesure : scrypt N=2^15 coûte ~100 ms, et le refaire par fichier ferait six secondes sur le
  // portefeuille. On mesure donc aussi ce que coûterait l'erreur, pour que 9.2.0 ne la commette pas.
  const salt = crypto.randomBytes(16);
  const scr = chrono(() => deriveKey('mot-de-passe-du-cabinet', salt));
  const key = scr.r;
  console.log(`  Dérivation de la clé (scrypt, une fois au déverrouillage) : ${ms(scr.ms)}`);
  console.log(`  ⚠ la refaire par fichier coûterait ${ms(scr.ms * 60)} sur 60 dossiers — la clé se garde en mémoire.\n`);

  // ---- 1. fabrication + écriture du gros livre
  console.log('Fabrication');
  const gros = chrono(() => fabriquerLivre('MAT:1234567A', 2026, 50000));
  const livre = gros.r;
  const nbLignes = livre.ecritures.reduce((s, e) => s + e.lignes.length, 0);
  console.log(`  ${nbLignes.toLocaleString('fr-FR')} lignes · ${livre.ecritures.length.toLocaleString('fr-FR')} écritures · ${livre.plan.length} comptes · 6 journaux   (${ms(gros.ms)})`);

  // Le jeu de données se VÉRIFIE avant de servir de banc d'essai. Ma première version annonçait
  // douze mois et n'en fabriquait que six, dont un à 18 écritures : la mesure avait l'air correcte
  // et ne portait pas sur ce qu'elle disait. Douze mois, six journaux, et aucun mois famélique.
  const parMois = {};
  livre.ecritures.forEach(e => { const m = e.date.slice(0, 7); parMois[m] = (parMois[m] || 0) + 1; });
  const mois = Object.keys(parMois).sort();
  const jx = new Set(livre.ecritures.map(e => e.journal));
  const maigre = mois.filter(m => parMois[m] < livre.ecritures.length / 24);
  if (mois.length !== 12 || jx.size !== 6 || maigre.length) {
    console.error(`\n  Le jeu de données n'est pas celui annoncé : ${mois.length} mois, ${jx.size} journaux` +
      (maigre.length ? `, mois famélique(s) : ${maigre.join(', ')}` : ''));
    console.error('  La mesure ne porterait pas sur ce qu\'elle dit. Corrige le générateur.\n');
    process.exit(1);
  }
  console.log(`  Réparti sur ${mois.length} mois (${Math.min(...Object.values(parMois))} à ${Math.max(...Object.values(parMois))} écritures) et ${jx.size} journaux`);

  const fichier = path.join(dossier, 'livre-2026.json');
  const scelle = chrono(() => { fs.writeFileSync(fichier, JSON.stringify(sealWithKey(livre, salt, key)), 'utf8'); });
  const taille = fs.statSync(fichier).size;
  const clair = Buffer.byteLength(JSON.stringify(livre), 'utf8');
  console.log(`  Sur le disque : ${mo(taille)} chiffré · ${mo(clair)} en clair · base64 ajoute ${((taille / clair - 1) * 100).toFixed(0)} %   (${ms(scelle.ms)})\n`);

  // ---- 2. ouverture
  console.log('Les quatre seuils');
  const ouv = chrono(() => {
    const env = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    const l = openWithKey(env, key);
    if (!isValidLivre(l)) throw new Error('le livre fabriqué ne passe pas son propre validateur');
    return l;
  });
  juger('ouverture', 'Ouvrir un livre de 50 000 lignes', ouv.ms, 'lire + déchiffrer + analyser + valider chaque ligne');
  const relu = ouv.r;

  // ---- 3. ajouter une écriture et réécrire (× 20, médiane)
  // C'est le geste le plus fréquent du cabinet : une écriture validée réécrit le fichier ENTIER.
  // La médiane plutôt que la moyenne, pour qu'une pause du ramasse-miettes ne décide pas du verdict.
  const tmps = [];
  for (let i = 0; i < 20; i++) {
    const t = chrono(() => {
      relu.ecritures.push({
        id: 'e_ajout' + i, numero: relu.ecritures.length + 1, date: '2026-12-31', journal: 'OD',
        piece: 'OD-2026-' + pad(i, 3), libelle: 'Écriture ajoutée', source: 'saisie',
        statut: 'validee', auteur: 'charge', creeLe: 1789800000000, valideeLe: 1789800000000,
        contrepasseDe: null, extourneDe: null,
        lignes: [{ compte: '532', libelle: 'Banque', debit: 100, credit: 0, lettre: '' },
                 { compte: '6001', libelle: 'Charge', debit: 0, credit: 100, lettre: '' }]
      });
      const tmp = fichier + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(sealWithKey(relu, salt, key)), 'utf8');
      fs.renameSync(tmp, fichier);
    });
    tmps.push(t.ms);
  }
  juger('ecriture', 'Valider une écriture (× 20, médiane)', mediane(tmps),
    `le fichier entier est réécrit · min ${ms(Math.min(...tmps))} · max ${ms(Math.max(...tmps))}`);

  // ---- 4. la balance du portefeuille : 60 dossiers
  // Soixante clients, c'est la taille du cabinet pilote. Ils n'ont pas tous 50 000 lignes : un gros
  // (celui du dessus) et cinquante-neuf ordinaires. Donner 50 000 lignes à chacun mesurerait un
  // cabinet qui n'existe pas et ferait refuser un format qui convient.
  const LIGNES_ORDINAIRE = 5000;
  process.stdout.write('  … fabrication du portefeuille (60 dossiers)');
  const fichiers = [fichier];
  for (let i = 1; i < 60; i++) {
    const l = fabriquerLivre('MAT:' + pad(1000000 + i, 7) + 'A', 2026, LIGNES_ORDINAIRE);
    const f = path.join(dossier, `livre-2026-${pad(i, 2)}.json`);
    fs.writeFileSync(f, JSON.stringify(sealWithKey(l, salt, key)), 'utf8');
    fichiers.push(f);
  }
  const totalLignes = nbLignes + 59 * LIGNES_ORDINAIRE;
  const totalTaille = fichiers.reduce((s, f) => s + fs.statSync(f).size, 0);
  process.stdout.write('\r' + ' '.repeat(50) + '\r');

  const bal = chrono(() => {
    let comptes = 0;
    fichiers.forEach(f => {
      const l = openWithKey(JSON.parse(fs.readFileSync(f, 'utf8')), key);
      const plates = [];
      l.ecritures.forEach(e => e.lignes.forEach(li => plates.push({
        account: li.compte, tiers: li.libelle, debit: li.debit, credit: li.credit,
        date: e.date, journal: e.journal, piece: e.piece, lettre: li.lettre
      })));
      comptes += K.balanceDepuisLignes(plates).rows.length;
    });
    return comptes;
  });
  juger('balance', 'Balance des 60 dossiers', bal.ms,
    `${totalLignes.toLocaleString('fr-FR')} lignes · ${mo(totalTaille)} sur le disque · ${bal.r.toLocaleString('fr-FR')} comptes`);

  // ---- 5. la recherche globale : « où est cette facture ? »
  // Le geste qui n'a aucune autre réponse que d'ouvrir tous les fichiers : il n'existe pas d'index.
  // C'est lui qui dira si un index séparé est nécessaire en 9.2.0.
  // La pièce cherchée est prise DANS le livre, pas écrite en dur : un numéro inventé ne serait
  // trouvé nulle part, et le rapport dirait « 0 occurrence » sur une mesure pourtant juste — de
  // quoi faire croire que la recherche est cassée. (Elle l'a dit une fois, à cause du générateur.)
  const cherche = relu.ecritures[30].piece;
  const rech = chrono(() => {
    const trouves = [];
    fichiers.forEach(f => {
      const l = openWithKey(JSON.parse(fs.readFileSync(f, 'utf8')), key);
      l.ecritures.forEach(e => { if (e.piece === cherche) trouves.push({ dossier: l.dossier, id: e.id }); });
    });
    return trouves;
  });
  juger('recherche', `Chercher « ${cherche} » partout`, rech.ms,
    `${rech.r.length} occurrence(s) dans 60 fichiers, sans index`);

  // ---- 6. hors seuil, mais bon à savoir : le livre-journal du gros dossier
  const plates = [];
  relu.ecritures.forEach(e => e.lignes.forEach(li => plates.push({
    account: li.compte, tiers: li.libelle, debit: li.debit, credit: li.credit,
    date: e.date, journal: e.journal, piece: e.piece, lettre: li.lettre
  })));
  const lj = chrono(() => K.journalDepuisLignes(plates));
  const lt = chrono(() => K.lettrageDepuisLignes(plates, '411', '2026-12-31'));
  console.log('\nHors seuil (pour situer)');
  console.log(`    Livre-journal de 50 000 lignes    ${ms(lj.ms).padStart(11)}   ${lj.r.pieces.length.toLocaleString('fr-FR')} pièces`);
  console.log(`    Lettrage du compte 411            ${ms(lt.ms).padStart(11)}   ${lt.r.rows.length} tiers · ${lt.r.ouverts.toLocaleString('fr-FR')} pièces ouvertes`);


  // ---- 7. si l'écriture a échoué : QUEL levier suffit ?
  //
  // Un rapport qui dit « ça n'a pas tenu, voici quatre idées » laisse le choix à l'intuition, et
  // l'intuition classe mal : j'aurais parié sur le découpage par mois, c'est le corps binaire qui
  // pèse le plus lourd pour le moins de travail. On mesure chaque levier au lieu de les ranger.
  if (mesures.ecriture >= SEUILS.ecriture) {
    console.log('\nLeviers mesurés (le seuil d\'écriture est ' + ms(SEUILS.ecriture) + ')');
    const bancs = [
      ['A. corps binaire au lieu de base64', relu, true],
      ['B. découpage par mois (base64)', { ...relu, ecritures: relu.ecritures.filter(e => e.date.slice(0, 7) === '2026-06') }, false],
      ['C. les deux', { ...relu, ecritures: relu.ecritures.filter(e => e.date.slice(0, 7) === '2026-06') }, true]
    ];
    const gagnants = [];
    bancs.forEach(([nom, obj, binaire]) => {
      const f = path.join(dossier, 'levier.bin');
      const ts = [];
      for (let i = 0; i < 15; i++) {
        ts.push(chrono(() => {
          const iv = crypto.randomBytes(12);
          const c = crypto.createCipheriv('aes-256-gcm', key, iv);
          const body = Buffer.concat([c.update(Buffer.from(JSON.stringify(obj), 'utf8')), c.final()]);
          const tete = { [MARK]: 1, kdf: 'scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') };
          // Corps binaire : l'entête reste en CLAIR sur une ligne, comme pour le paquet mensuel
          // (6.1.0) — sans elle, un fichier mal rangé serait impossible à identifier sans la clé.
          if (binaire) fs.writeFileSync(f + '.tmp', Buffer.concat([Buffer.from(JSON.stringify(tete) + '\n', 'utf8'), body]));
          else fs.writeFileSync(f + '.tmp', JSON.stringify({ ...tete, data: body.toString('base64') }), 'utf8');
          fs.renameSync(f + '.tmp', f);
        }).ms);
      }
      const m = mediane(ts);
      const ok = m < SEUILS.ecriture;
      if (ok) gagnants.push(nom);
      console.log(`  ${ok ? '✓' : '✗'} ${nom.padEnd(34)} ${ms(m).padStart(11)}   ${mo(fs.statSync(f).size)} · ${((1 - m / mesures.ecriture) * 100).toFixed(0)} % de gagné`);
    });
    if (gagnants.length) {
      console.log(`\n  Le moins cher qui suffit : ${gagnants[0]}.`);
      console.log('  Il ne change ni la forme du livre ni aucun appelant — seulement la façon de le poser sur le disque.');
    } else {
      console.log('\n  Aucun levier simple ne suffit : il faut un journal d\'ajouts plutôt qu\'une réécriture totale.');
    }
  }

  try { fs.rmSync(dossier, { recursive: true, force: true }); } catch { /* le dossier temporaire partira avec le système */ }

  console.log('');
  if (echecs.length) {
    console.log('VERDICT — le format de la 9.2.0 doit changer AVANT d\'être écrit :');
    echecs.forEach(e => console.log('  · ' + e));
    console.log('');
    process.exit(1);
  }
  console.log('Les quatre seuils sont tenus : le format de SPEC-DATA-005 peut être écrit tel quel.\n');
})();
