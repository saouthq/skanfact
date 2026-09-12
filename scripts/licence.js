#!/usr/bin/env node
// Fabrique les licences SkanFact. Cet outil tourne sur le Mac de Skander, jamais dans l'application.
//
//   node scripts/licence.js --keygen
//       Crée une paire de clés. La clé PRIVÉE est écrite dans ~/.skanfact/licence-privee.pem
//       (hors du dépôt, et elle doit y rester : qui l'a peut émettre des licences).
//       La clé PUBLIQUE est écrite dans build/licence-public.json — celle-là se commite,
//       c'est elle que l'application embarque pour vérifier.
//
//   node scripts/licence.js --nom "Menuiserie Trabelsi SUARL" --matricule 1234567A/M/P/000 \
//                           --mois 12 [--cabinet AB12-CD34-...] [--note "parrainé"]
//       Émet une licence valable 12 mois et l'affiche. Il n'y a plus qu'à la coller dans le mail.
//
//   node scripts/licence.js --verifier "SKAN1...."
//       Relit une licence déjà émise.
//
// Rien n'est enregistré nulle part : aucune base de licences. Si tu veux garder une trace de ce que
// tu as émis, colle la sortie dans un tableur — c'est volontairement à toi de décider.
const fs = require('fs');
const path = require('path');
const os = require('os');
const L = require('../src/licence.js');

const PRIV = path.join(os.homedir(), '.skanfact', 'licence-privee.pem');
const PUB = path.join(__dirname, '..', 'build', 'licence-public.json');

const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const has = name => args.includes('--' + name);

function keygen() {
  if (fs.existsSync(PRIV)) {
    console.error(`\nIl existe déjà une clé privée ici :\n  ${PRIV}\n\n`
      + `En créer une nouvelle rendrait INVALIDES toutes les licences déjà émises.\n`
      + `Si c'est vraiment ce que tu veux, déplace ce fichier ailleurs d'abord.\n`);
    process.exit(1);
  }
  const { publicKey, privateKey } = L.generateKeys();
  fs.mkdirSync(path.dirname(PRIV), { recursive: true });
  fs.writeFileSync(PRIV, privateKey, { mode: 0o600 });
  fs.writeFileSync(PUB, JSON.stringify({ format: L.FORMAT, publicKey, createdAt: L.today() }, null, 2) + '\n', 'utf8');
  console.log(`\nClé privée  : ${PRIV}   (mode 600 — ne la commite jamais, ne l'envoie à personne)`);
  console.log(`Clé publique : ${PUB}   (à commiter : c'est elle qui arme la licence dans l'app)`);
  console.log(`\nSauvegarde la clé privée ailleurs que sur ce Mac (gestionnaire de mots de passe, disque\n`
    + `chiffré). Si tu la perds, tu ne peux plus émettre de licence pour les clients existants.\n`);
}

function emettre() {
  if (!fs.existsSync(PRIV)) { console.error(`Aucune clé privée. Lance d'abord :\n  node scripts/licence.js --keygen`); process.exit(1); }
  const nom = arg('nom');
  if (!nom) { console.error('Il manque --nom "Raison sociale"'); process.exit(1); }
  const mois = Number(arg('mois') || 12);
  const exp = arg('expire') || L.addDays(L.today(), Math.round(mois * 30.44));
  const payload = {
    nom, matricule: arg('matricule') || '', exp,
    cabinet: arg('cabinet') || '', note: arg('note') || '',
    emisLe: L.today()
  };
  const key = L.signLicence(payload, fs.readFileSync(PRIV, 'utf8'));
  console.log(`\nLicence pour ${nom}`);
  console.log(`Matricule : ${payload.matricule || '—'}`);
  console.log(`Valable jusqu'au ${exp}${payload.cabinet ? ` · cabinet parrain ${payload.cabinet}` : ''}`);
  console.log(`\n${key}\n`);
  console.log(`À coller dans SkanFact : Paramètres → Licence.\n`);
}

function verifier() {
  const key = arg('verifier') || args[args.indexOf('--verifier') + 1];
  if (!fs.existsSync(PUB)) { console.error('Aucune clé publique dans build/licence-public.json'); process.exit(1); }
  const pub = JSON.parse(fs.readFileSync(PUB, 'utf8')).publicKey;
  const p = L.verifyKey(key, pub);
  if (!p) { console.log('\nLicence INVALIDE (signature fausse, clé tronquée, ou émise par une autre clé privée).\n'); process.exit(1); }
  console.log('\nLicence valide :');
  console.log(JSON.stringify(p, null, 2));
  const st = L.licenceState({ key, publicKey: pub });
  console.log(`\nÉtat aujourd'hui : ${st.label}\n`);
}

if (has('keygen')) keygen();
else if (has('verifier')) verifier();
else if (has('nom')) emettre();
else {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 22).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
}
