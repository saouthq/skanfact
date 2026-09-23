'use strict';
// ============================================================================================
// Les mises à jour, retournées le 23/09/2026 (10.11.0)
//
// Trois défauts vus par Skander sur ses deux applications, et la refonte « comme Apple » qu'il a
// demandée :
//  1. la 10.10.0 était publiée et « Vérifier » répondait « Tu as la dernière version » — la liste des
//     releases de l'API GitHub rendait la 10.10.0 SANS aucun fichier, et le relais la sautait ;
//  2. une version téléchargée (10.9.3, prête) empêchait de voir la suivante (10.10.0) ;
//  3. la ligne des versions d'essai citait « 9.2.0-beta.1 », un exemple figé depuis des mois.
// Chaque test se prouve en réintroduisant son défaut (7.2.0).
module.exports = async ({ ta, t, assert, lireSource }) => {
const M = require('../../src/renderer/majui.js');
const C = require('../../src/canaux.js');
const K = require('../../src/cabinet/cabcore.js');
const sansComm = src => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

// La liste telle que GitHub l'a rendue le 23/09/2026 : la 10.10.0 est là, mais vide.
const LISTE_PERIMEE = () => [
  { id: 3, tag_name: 'v10.10.0', prerelease: false, draft: false, assets: [] },
  { id: 2, tag_name: 'v10.10.0-beta.1', prerelease: true, draft: false, assets: [{ name: 'beta-mac.yml' }, { name: 'cabinet-beta-mac.yml' }] },
  { id: 1, tag_name: 'v10.9.3', prerelease: false, draft: false, assets: [{ name: 'latest-mac.yml' }, { name: 'cabinet-mac.yml' }, { name: 'SkanFact-10.9.3-mac-universal.zip' }] }
];
// Ce que l'endpoint d'UNE release rend pour la 10.10.0 : ses fichiers, justes.
const FICHIERS_1010 = [{ name: 'latest-mac.yml' }, { name: 'cabinet-mac.yml' }, { name: 'SkanFact-10.10.0-mac-universal.zip' }];

await ta('relais : une release que la LISTE rend vide est relue avant d\'être sautée', async () => {
  const W = await import('../../worker/skanfact-maj.mjs');
  const relues = [];
  const relire = async rel => { relues.push(rel.tag_name); return rel.id === 3 ? FICHIERS_1010 : rel.assets; };
  const f = await W.trouveDans(LISTE_PERIMEE(), 'latest-mac.yml', relire);
  assert.strictEqual(f.tag, 'v10.10.0', 'le relais sert encore l\'index de la 10.9.3 : « tu as la dernière version » sur une 10.10.0 publiée');
  // Le fichier qui porte un numéro de version, sinon le téléchargement lui-même échoue.
  const z = await W.trouveDans(LISTE_PERIMEE(), 'SkanFact-10.10.0-mac-universal.zip', relire);
  assert.ok(z && z.tag === 'v10.10.0', 'l\'installateur de la 10.10.0 serait introuvable');
  // Le cas normal ne coûte AUCUN appel de plus : le fichier est dans la première release admissible.
  relues.length = 0;
  const bon = LISTE_PERIMEE(); bon[0].assets = FICHIERS_1010;
  await W.trouveDans(bon, 'latest-mac.yml', relire);
  assert.deepStrictEqual(relues, [], 'une relecture pour rien sur le cas normal : le quota GitHub part en fumée');
  // Et une préversion ne sert jamais un index stable, même relue (9.8.8).
  const pre = await W.trouveDans([{ id: 9, tag_name: 'v11.0.0-beta.1', prerelease: true, assets: [{ name: 'latest-mac.yml' }] }], 'latest-mac.yml', async () => [{ name: 'latest-mac.yml' }]);
  assert.strictEqual(pre, null, 'un index stable servi depuis une préversion');
  // Au plus trois relectures : vingt releases vides ne font pas vingt appels.
  let n = 0;
  const vides = Array.from({ length: 10 }, (_, i) => ({ id: i, tag_name: 'v1.' + i, assets: [] }));
  await W.trouveDans(vides, 'latest.yml', async () => { n++; return []; });
  assert.strictEqual(n, W.RELECTURES_MAX, 'le nombre de relectures n\'est pas borné');
});

await ta('relais : l\'état des canaux (/sante) relit les releases récentes', async () => {
  const W = await import('../../worker/skanfact-maj.mjs');
  const rels = await W.rafraichirRecentes(LISTE_PERIMEE(), async rel => rel.id === 3 ? FICHIERS_1010 : rel.assets);
  const c = W.resumeCanaux(rels).find(l => l.fichier === 'latest-mac.yml');
  assert.strictEqual(c.tag, 'v10.10.0', 'la console annoncerait la 10.9.3 sur le canal stable');
});

await ta('Cabinet : la bêta relue aussi quand la liste la rend vide', async () => {
  const liste = [
    { id: 5, tag_name: 'v10.11.0-beta.1', prerelease: true, assets: [] },
    { id: 2, tag_name: 'v10.10.0-beta.1', prerelease: true, assets: [{ name: 'cabinet-beta-mac.yml' }] }
  ];
  const r = await K.releasePourIndexRelue(liste, 'cabinet-beta-mac.yml', async rel => rel.id === 5 ? [{ name: 'cabinet-beta-mac.yml' }] : rel.assets);
  assert.strictEqual(r.tag, 'v10.11.0-beta.1', 'le Cabinet retomberait sur la bêta précédente');
  const src = sansComm(lireSource('src', 'cabinet', 'main.js'));
  assert.ok(/K\.releasePourIndexRelue\(await releasesGithub\(/.test(src), 'le repli du Cabinet n\'utilise pas la règle qui relit');
});

t('une version téléchargée n\'empêche plus de chercher la suivante — dans les deux applications', () => {
  [['src/main.js', lireSource('src', 'main.js')], ['src/cabinet/main.js', lireSource('src', 'cabinet', 'main.js')]].forEach(([nom, brut]) => {
    const src = sansComm(brut);
    const i = src.indexOf('async function checkForUpdates');
    const f = src.slice(i, src.indexOf('\n}', i));
    assert.ok(i > 0 && f.length > 400, nom + ' : découpage de checkForUpdates raté');
    assert.ok(!/if \(downloaded\)/.test(f), nom + ' : checkForUpdates rend « prête » sans rien demander dès qu\'une version attend — la suivante reste invisible');
    // Et la même version annoncée de nouveau reste prête, sans repasser par « téléchargement ».
    assert.ok(/if \(memePrete\(info\)\)/.test(src), nom + ' : une nouvelle annonce de la version déjà prête la remet à zéro');
  });
  // Côté écran de l'app entreprise : « Rechercher » n'est plus refusé sur une version prête.
  const app = sansComm(lireSource('src', 'renderer', 'app.js'));
  const rc = app.slice(app.indexOf('async function runCheck()'), app.indexOf('async function showChangelog'));
  assert.ok(rc.length > 200 && !/upd\.state === 'downloaded'\) return/.test(rc), 'app.js : runCheck refuse encore de chercher quand une version est prête');
  // Et l'écran « prête » propose de chercher plus récent.
  const pret = M.etat({ p: 'u', nom: 'X', a: { packaged: true }, u: { state: 'downloaded', version: '10.9.3' } });
  assert.ok(/id="u-install"/.test(pret) && /id="u-check"/.test(pret), 'l\'écran « prête » n\'offre pas de chercher une version plus récente');
});

t('la ligne « Versions d\'essai » dit la VRAIE dernière bêta, ou ne dit aucun numéro', () => {
  // Plus aucun numéro écrit à la main dans les deux écrans, ni dans le module.
  [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js'], ['src', 'renderer', 'majui.js']].forEach(parts => {
    const src = sansComm(lireSource(...parts));
    assert.ok(!/\d+\.\d+\.\d+-beta\.\d+/.test(src), parts.join('/') + ' : un numéro de bêta écrit à la main — il sera faux à la prochaine bêta');
  });
  assert.ok(!/\d-beta/.test(M.phraseEssai(null)), 'sans information, la phrase invente un numéro');
  const enCours = M.phraseEssai({ stable: { version: '10.10.0' }, essai: { version: '10.11.0-beta.2', publie: '2026-09-24T08:00:00Z' } });
  assert.ok(enCours.includes('10.11.0-beta.2') && enCours.includes('24/09/2026'), 'la bêta en cours n\'est pas nommée avec sa date');
  const confirmee = M.phraseEssai({ stable: { version: '10.10.0' }, essai: { version: '10.10.0-beta.1' } });
  assert.ok(/Aucun essai en cours/.test(confirmee) && confirmee.includes('10.10.0'), 'une bêta déjà devenue stable est présentée comme « en cours »');
});

t('canaux : la dernière stable et la dernière bêta, lues comme le relais les sert', () => {
  assert.ok(C.comparerVersions('10.10.0', '9.8.8') > 0, '10.10.0 doit passer après 9.8.8 (tri de chaînes)');
  assert.ok(C.comparerVersions('10.10.0-beta.1', '10.10.0') < 0, 'une préversion passe AVANT sa version');
  assert.ok(C.comparerVersions('10.10.0-beta.10', '10.10.0-beta.9') > 0, 'beta.10 après beta.9');
  const rels = [
    { tag_name: 'v10.11.0-beta.1', prerelease: true, published_at: '2026-09-24', assets: [{ name: 'cabinet-beta-mac.yml' }, { name: 'latest-mac.yml' }] },
    { tag_name: 'v10.10.0', prerelease: false, published_at: '2026-09-23', assets: [{ name: 'cabinet-mac.yml' }, { name: 'latest-mac.yml' }] }
  ];
  const r = C.depuisReleases(rels, 'cabinet', 'darwin');
  assert.strictEqual(r.essai.version, '10.11.0-beta.1');
  assert.strictEqual(r.stable.version, '10.10.0');
  // Un index stable ne vient jamais d'une préversion, même s'il y traîne.
  assert.strictEqual(C.depuisReleases(rels, 'app', 'darwin').stable.version, '10.10.0', 'un index stable lu sur une préversion');
  const s = C.depuisSante({ canaux: [{ canal: 'app', fichier: 'beta.yml', servi: true, tag: 'v10.11.0-beta.1', publie: 'x' }] }, 'app', 'win32');
  assert.strictEqual(s.essai.version, '10.11.0-beta.1', 'Windows lit beta.yml, sans suffixe');
});

t('la fenêtre « prête à installer » : une fois par version et par jour, au plus', () => {
  const st = {};
  const lire = k => st[k], ecrire = (k, v) => { st[k] = v; };
  const t0 = 1e12;
  assert.ok(M.doitProposer('10.10.0', lire, t0), 'la première fois, elle doit s\'ouvrir');
  M.noterProposee('10.10.0', ecrire, t0);
  assert.ok(!M.doitProposer('10.10.0', lire, t0 + 3600e3), 'elle revient une heure après « Plus tard »');
  assert.ok(M.doitProposer('10.10.0', lire, t0 + M.JOUR_MS + 1), '« Plus tard » l\'enterre pour toujours : elle doit revenir le lendemain');
  assert.ok(M.doitProposer('10.11.0', lire, t0 + 60e3), 'une version plus récente doit se proposer tout de suite');
  // Ce qu'elle affiche vient du CHANGELOG : échappé d'abord, mis en forme ensuite.
  const f = M.fenetrePrete({ nom: 'SkanFact', version: '10.10.0', installee: '10.9.3', notes: M.notesHtml('- un <script>alert(1)</script> **point**') });
  assert.ok(!/<script>/.test(f) && /<strong>point<\/strong>/.test(f), 'les notes laissent passer du HTML ou perdent leur mise en forme');
  assert.ok(/data-close/.test(f) && /id="maj-go"/.test(f), '« Plus tard » doit fermer (data-close, T-09) et « Redémarrer » exister');
});

t('le même écran dans les deux applications : un module, trois branchements', () => {
  assert.ok(/<script src="majui\.js"><\/script>/.test(lireSource('src', 'renderer', 'index.html')), 'l\'app entreprise ne charge pas majui.js');
  assert.ok(/<script src="\.\.\/\.\.\/renderer\/majui\.js"><\/script>/.test(lireSource('src', 'cabinet', 'renderer', 'index.html')), 'le Cabinet ne charge pas majui.js');
  const conf = lireSource('build', 'cabinet.config.js');
  assert.ok(/'src\/renderer\/majui\.js'/.test(conf) && /'src\/canaux\.js'/.test(conf), 'majui.js ou canaux.js ne sont pas livrés avec le Cabinet : il plante une fois construit');
  [['src', 'renderer', 'app.js'], ['src', 'cabinet', 'renderer', 'app.js']].forEach(parts => {
    assert.ok(/MajUI\.panneau\(/.test(sansComm(lireSource(...parts))), parts.join('/') + ' : le panneau ne passe pas par le module partagé');
  });
});

t('écran de verrouillage : deux boutons pleine largeur ne se touchent pas', () => {
  const css = lireSource('src', 'renderer', 'style.css');
  assert.ok(/\.lock-card \.btn \+ \.btn \{ margin-top: \d+px; \}/.test(css), '« Ouvrir » et « J\'ai déjà un cabinet… » se touchent à zéro pixel');
});
};
