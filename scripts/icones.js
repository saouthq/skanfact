#!/usr/bin/env node
/**
 * Fabrique les icônes des fichiers SkanFact : .skanpack (le paquet mensuel)
 * et .skanrecover (la clé de secours du cabinet).
 *
 * Pourquoi ce script existe : electron-builder ne convertit PAS un PNG déclaré
 * dans `fileAssociations`. Il se contente d'échanger `.ico` et `.icns` selon la
 * plateforme ; un chemin en `.png` ressort inchangé et se retrouve installé tel
 * quel là où macOS attend un `.icns` et Windows un `.ico`. Rien n'échoue, rien
 * n'est signalé — et le comptable voit un fichier blanc générique parmi vingt
 * autres. Il faut donc de vrais `.icns` / `.ico`, et les référencer SANS
 * extension (`icon: 'skanpack'`) pour qu'electron-builder complète lui-même.
 *
 *   node scripts/icones.js
 *
 * Produit dans build/ : skanpack.png/.icns/.ico et skanrecover.png/.icns/.ico.
 * Les fichiers produits sont commités : le workflow de publication ne lance pas
 * ce script, et electron-builder REFUSE de construire si la ressource déclarée
 * n'existe pas.
 *
 * Deux outils, tous deux déjà dans le projet :
 *   - Electron, pour transformer le dessin (SVG) en PNG 1024×1024 ;
 *   - app-builder (livré avec electron-builder), pour en tirer .icns et .ico.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const SORTIE = path.join(RACINE, 'build');
const TMP_PNG = path.join(require('os').tmpdir(), 'skanfact-icones-tailles');
const TAILLE = 1024;

// La palette de l'application du cabinet : ardoise et vert d'eau.
const ARDOISE = '#2f3b45';
const ACCENT = '#0f9d8f';
const ACCENT_CLAIR = '#3fbfb2';

/**
 * La feuille de papier, coin plié en haut à droite. Elle porte un liseré :
 * blanche sur blanche, l'icône serait invisible dans une fenêtre du Finder,
 * qui est justement l'endroit où elle doit se remarquer.
 */
const FEUILLE = `
  <path d="M248 96 H612 L836 320 V902 a70 70 0 0 1 -70 70 H248 a70 70 0 0 1 -70 -70 V166 a70 70 0 0 1 70 -70 z"
        fill="#ffffff" stroke="#c2ccd4" stroke-width="14" stroke-linejoin="round"/>
  <path d="M612 96 L836 320 H682 a70 70 0 0 1 -70 -70 z"
        fill="#dde4ea" stroke="#c2ccd4" stroke-width="14" stroke-linejoin="round"/>`;

/** Les lignes de texte d'un document. */
const lignes = tailles => tailles
  .map((w, i) => `<rect x="266" y="${418 + i * 78}" width="${w}" height="28" rx="14" fill="#c8d2da"/>`)
  .join('\n    ');

/** La pastille ronde posée en bas à droite, qui dit de quel fichier il s'agit. */
const pastille = (fond, dedans) => `
    <circle cx="700" cy="736" r="212" fill="#ffffff"/>
    <circle cx="700" cy="736" r="188" fill="${fond}"/>
    ${dedans}`;

const DESSINS = {
  // Le paquet mensuel : un document scellé. Le cadenas dit « chiffré », les
  // lignes disent « des pièces comptables », pas une image quelconque.
  skanpack: `
    ${FEUILLE}
    ${lignes([300, 380, 220])}
    ${pastille(ACCENT, `
    <path d="M700 618 a66 66 0 0 1 66 66 v40 h-46 v-40 a20 20 0 0 0 -40 0 v40 h-46 v-40 a66 66 0 0 1 66 -66 z" fill="#ffffff"/>
    <rect x="604" y="716" width="192" height="148" rx="30" fill="#ffffff"/>
    <circle cx="700" cy="778" r="22" fill="${ACCENT}"/>
    <rect x="689" y="786" width="22" height="44" rx="11" fill="${ACCENT}"/>`)}`,

  // La clé de secours : une clé, franchement. C'est le fichier le plus
  // important que le cabinet produira — il doit se reconnaître d'un coup d'œil
  // au milieu d'une clé USB pleine d'autres fichiers.
  skanrecover: `
    ${FEUILLE}
    ${lignes([300, 200])}
    ${pastille(ARDOISE, `
    <circle cx="648" cy="690" r="74" fill="none" stroke="${ACCENT_CLAIR}" stroke-width="36"/>
    <path d="M694 736 L806 848" stroke="${ACCENT_CLAIR}" stroke-width="36" stroke-linecap="round"/>
    <path d="M762 804 L722 844" stroke="${ACCENT_CLAIR}" stroke-width="36" stroke-linecap="round"/>`)}`,
};

function svg(nom) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TAILLE}" height="${TAILLE}" viewBox="0 0 ${TAILLE} ${TAILLE}">
    ${DESSINS[nom]}
  </svg>`;
}

/** Le chemin de l'exécutable app-builder correspondant à cette machine. */
function appBuilder() {
  const base = path.join(RACINE, 'node_modules', 'app-builder-bin');
  const dossier = process.platform === 'darwin' ? 'mac'
    : process.platform === 'win32' ? 'win'
      : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? 'ia32' : 'x64';
  // macOS : un seul binaire universel ; Windows : un dossier par architecture.
  const essais = [
    path.join(base, dossier, arch, 'app-builder' + (dossier === 'win' ? '.exe' : '')),
    path.join(base, dossier, 'app-builder_amd64'),
    path.join(base, dossier, 'app-builder_arm64'),
  ];
  const trouve = essais.find(p => fs.existsSync(p));
  if (!trouve) {
    throw new Error(
      'app-builder introuvable. Lance « npm install » : il arrive avec electron-builder.'
    );
  }
  return trouve;
}

// Les tailles d'un fichier .ico. Windows pioche celle qui lui va : 16 et 32 pour
// une liste de fichiers, 48 pour les grandes icônes, 256 pour l'aperçu. Chacune
// est dessinée à sa taille depuis le SVG — réduire une image de 1024 px donne
// une bouillie à 16 px, et c'est justement la taille qu'on voit le plus.
const TAILLES_ICO = [16, 24, 32, 48, 64, 128, 256];

/** Dessin SVG → PNG, par Electron (aucune dépendance de plus). */
function rasterise(noms) {
  const script = path.join(require('os').tmpdir(), `skanfact-icones-${process.pid}.js`);
  const travail = [];
  for (const n of noms) {
    travail.push({ svg: svg(n), taille: TAILLE, png: path.join(SORTIE, n + '.png') });
    for (const t of TAILLES_ICO) {
      travail.push({ svg: svg(n), taille: t, png: path.join(TMP_PNG, `${n}-${t}.png`) });
    }
  }
  fs.mkdirSync(TMP_PNG, { recursive: true });
  fs.writeFileSync(script, `
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const travail = ${JSON.stringify(travail)};
app.disableHardwareAcceleration();
// Sans ça, détruire la première fenêtre ferme l'application avant la suivante :
// « toutes les fenêtres fermées » quitte, et le dessin suivant n'est jamais fait.
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  for (const t of travail) {
    const w = new BrowserWindow({
      width: t.taille, height: t.taille, show: false, frame: false,
      transparent: true, backgroundColor: '#00000000',
      webPreferences: { offscreen: true, sandbox: false },
    });
    // Le SVG porte sa taille en dur : on la remplace par celle qu'on veut, et
    // le viewBox fait le reste — c'est le dessin qui est redimensionné, pas
    // l'image, donc les traits restent nets même à 16 px.
    const dessin = t.svg.replace(/width="\\d+" height="\\d+"/, 'width="' + t.taille + '" height="' + t.taille + '"');
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>' + dessin));
    await new Promise(r => setTimeout(r, 260));
    const img = await w.webContents.capturePage();
    fs.writeFileSync(t.png, img.toPNG());
    w.destroy();
  }
  app.exit(0);
});
`);
  const electron = require('electron'); // le chemin de l'exécutable
  try {
    execFileSync(electron, ['--no-sandbox', script], { stdio: 'inherit' });
  } finally {
    fs.rmSync(script, { force: true });
  }
}

/**
 * Assemble un .ico à plusieurs tailles. Un ICO n'est qu'un entête suivi d'une
 * table d'entrées : depuis Windows Vista, chaque entrée peut être un PNG tel
 * quel, ce qui évite d'avoir à écrire un encodeur BMP. app-builder, lui, ne sait
 * produire qu'une seule taille (256) — et c'est à 16 px qu'on voit l'icône.
 */
function ecrireIco(cible, fichiers) {
  const images = fichiers.map(f => ({ taille: f.taille, data: fs.readFileSync(f.png) }));
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0);              // réservé
  entete.writeUInt16LE(1, 2);              // 1 = icône
  entete.writeUInt16LE(images.length, 4);
  const table = Buffer.alloc(16 * images.length);
  let decalage = entete.length + table.length;
  images.forEach((img, i) => {
    const o = i * 16;
    table[o] = img.taille >= 256 ? 0 : img.taille;      // 0 veut dire 256
    table[o + 1] = img.taille >= 256 ? 0 : img.taille;
    table[o + 2] = 0;                                   // couleurs de la palette
    table[o + 3] = 0;                                   // réservé
    table.writeUInt16LE(1, o + 4);                      // plans
    table.writeUInt16LE(32, o + 6);                     // bits par pixel
    table.writeUInt32LE(img.data.length, o + 8);
    table.writeUInt32LE(decalage, o + 12);
    decalage += img.data.length;
  });
  fs.writeFileSync(cible, Buffer.concat([entete, table, ...images.map(i => i.data)]));
  return cible;
}

function convertir(nom, format) {
  const bin = appBuilder();
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'skanfact-ico-'));
  try {
    const brut = execFileSync(bin, [
      'icon', '--format', format, '--out', tmp, '--root', RACINE,
      '-i', path.join('build', nom + '.png'),
    ], { encoding: 'utf8' });
    const rep = JSON.parse(brut.trim().split('\n').pop());
    if (!rep.icons || !rep.icons.length) {
      throw new Error(`conversion en ${format} refusée pour ${nom} : ${brut}`);
    }
    const cible = path.join(SORTIE, `${nom}.${format}`);
    fs.copyFileSync(rep.icons[0].file, cible);
    return cible;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const noms = Object.keys(DESSINS);
  console.log('Dessin → PNG…');
  rasterise(noms);
  for (const nom of noms) {
    const png = path.join(SORTIE, nom + '.png');
    if (!fs.existsSync(png)) throw new Error(`${nom}.png n'a pas été produit.`);
    const produits = [
      convertir(nom, 'icns'),
      ecrireIco(path.join(SORTIE, nom + '.ico'),
        TAILLES_ICO.map(taille => ({ taille, png: path.join(TMP_PNG, `${nom}-${taille}.png`) }))),
    ];
    for (const f of produits) {
      console.log('  ✓', path.relative(RACINE, f), (fs.statSync(f).size / 1024).toFixed(0) + ' Ko');
    }
  }
  fs.rmSync(TMP_PNG, { recursive: true, force: true });
  console.log('\nPense à commiter build/skanpack.* et build/skanrecover.* :');
  console.log('le workflow de publication ne relance pas ce script, et');
  console.log('electron-builder refuse de construire si la ressource manque.');
}

if (require.main === module) main();

module.exports = { DESSINS, svg, appBuilder };
