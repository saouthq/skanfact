#!/usr/bin/env node
// Fabrique les licences SkanFact. Cet outil tourne sur le Mac de Skander, jamais dans l'application.
//
//   node scripts/licence.js --keygen
//       Crée une paire de clés. La clé PRIVÉE est écrite dans ~/.skanfact/licence-privee.pem
//       (hors du dépôt, et elle doit y rester : qui l'a peut émettre des licences).
//       La clé PUBLIQUE est écrite À CÔTÉ (~/.skanfact/licence-publique.json). Celle que
//       l'application embarque pour vérifier est build/licence-public.json — depuis la 8.0.0 c'est
//       la clé de Skander, et elle ne se remplace pas : un nouveau keygen ne sert qu'à un essai.
//
//   node scripts/licence.js --nom "Menuiserie Trabelsi SUARL" --matricule 1234567A/M/P/000 \
//                           --offre independant --duree 1a [--cabinet AB12-CD34-...] [--note "parrainé"]
//       Émet une licence et l'affiche. Offres : independant | entreprise (défaut). Durées : 1m, 3m,
//       6m, 1a (défaut), 2a, vie, ou --expire AAAA-MM-JJ. Il n'y a plus qu'à la coller dans le mail.
//
//   node scripts/licence.js --verifier "SKAN1...."
//       Relit une licence déjà émise.
//
// Depuis la 7.33.0, tout ceci se fait aussi DEPUIS L'APPLICATION (Paramètres → L'application →
// Licence → « Créer mes clés », puis la page Licences) — avec la facture et l'historique en plus.
// Cet outil reste pour les cas où l'on préfère le terminal ; il écrit aux mêmes emplacements.
// Rien n'est enregistré nulle part : aucune base de licences ici. L'historique, c'est l'application.
const fs = require('fs');
const path = require('path');
const os = require('os');
const L = require('../src/licence.js');

const CLES_DIR = process.env.SKANFACT_DOSSIER_CLES || path.join(os.homedir(), '.skanfact');
const PRIV = path.join(CLES_DIR, 'licence-privee.pem');
const PUB_EDITEUR = path.join(CLES_DIR, 'licence-publique.json');
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
  const pub = JSON.stringify({ format: L.FORMAT, publicKey, createdAt: L.today() }, null, 2) + '\n';
  // La publique à côté de la privée : c'est elle que l'application lit sur le poste de l'éditeur.
  // Elle n'est PAS écrite dans le dépôt : armer l'application de tout le monde est une décision
  // (copier ce fichier dans build/licence-public.json et le commiter), jamais l'effet de bord d'un
  // keygen — décision prise le 14/09/2026 (8.0.0) : le fichier du dépôt est la clé de Skander, et
  // un test exige qu'il reste là. Une clé créée ici après cette date n'arme que ce poste.
  fs.writeFileSync(PUB_EDITEUR, pub, 'utf8');
  console.log(`\nClé privée  : ${PRIV}   (mode 600 — ne la commite jamais, ne l'envoie à personne)`);
  console.log(`Clé publique : ${PUB_EDITEUR}`);
  console.log(`\nATTENTION : l'application de tout le monde est déjà armée avec la clé de\n  ${PUB}\n(8.0.0). Les licences signées par CETTE nouvelle clé n'y seront reconnues nulle part : elle ne sert\nqu'à des essais sur ce poste. Ne remplace jamais le fichier du dépôt.`);
  console.log(`\nSauvegarde la clé privée ailleurs que sur ce Mac (gestionnaire de mots de passe, disque\n`
    + `chiffré). Si tu la perds, tu ne peux plus émettre de licence pour les clients existants.\n`);
}

function emettre() {
  if (!fs.existsSync(PRIV)) { console.error(`Aucune clé privée. Lance d'abord :\n  node scripts/licence.js --keygen`); process.exit(1); }
  const nom = arg('nom');
  if (!nom) { console.error('Il manque --nom "Raison sociale"'); process.exit(1); }
  const offre = arg('offre') || L.OFFRE_DEFAUT;
  if (!L.OFFRES[offre]) { console.error(`Offre inconnue : ${offre}. Choisis parmi : ${Object.keys(L.OFFRES).join(', ')}`); process.exit(1); }
  // `--mois N` reste accepté (l'ancienne forme) ; `--duree` et `--expire` sont les nouvelles.
  const exp = arg('expire') ? L.expirationPour(L.today(), 'date', arg('expire'))
    : arg('duree') ? L.expirationPour(L.today(), arg('duree'))
    : arg('mois') ? L.addMonths(L.today(), Number(arg('mois')))
    : L.expirationPour(L.today(), '1a');
  if (exp === null) { console.error('Durée ou date de fin invalide (1m, 3m, 6m, 1a, 2a, vie, ou --expire AAAA-MM-JJ dans le futur).'); process.exit(1); }
  const payload = {
    id: L.licenceId(), nom, matricule: arg('matricule') || '', offre, exp,
    cabinet: arg('cabinet') || '', note: arg('note') || '',
    emisLe: L.today()
  };
  const key = L.signLicence(payload, fs.readFileSync(PRIV, 'utf8'));
  console.log(`\nLicence pour ${nom} — offre ${L.OFFRES[offre].label}`);
  console.log(`Matricule : ${payload.matricule || '—'}`);
  console.log(`${exp ? `Valable jusqu'au ${exp}` : 'Sans limite de durée'}${payload.cabinet ? ` · cabinet parrain ${payload.cabinet}` : ''}`);
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
