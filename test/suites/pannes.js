'use strict';
// ============================================================================================
// Les pannes système, nommées en français (10.0.1)
//
// La règle « aucun message brut ne remonte à l'écran » date de la 7.26.0 et n'a jamais couvert la
// seule famille où l'utilisateur perd son travail : la panne DISQUE. Node lève « ENOSPC: no space
// left on device, write /Users/…/skanfact-data.json », Electron la sérialise telle quelle, et le
// bandeau affichait l'anglais et le chemin du fichier — sur le geste le plus fréquent des deux
// applications.
//
// Ces tests ne lisent pas le code pour y chercher un mot : ils EXTRAIENT la table et sa fonction
// des deux `main.js` et les font tourner. Un test qui cherche « ENOSPC » dans la source resterait
// vert le jour où la table existe et où plus personne ne l'appelle (règle 7.3.0 : un moteur sans
// écran n'existe pas).
module.exports = ({ t, assert, lireSource }) => {

// Les deux `main.js` ne se chargent pas sans Electron : on en découpe le morceau qui nous intéresse
// et on l'évalue. La tranche se prouve par sa taille avant d'être jugée (règle 7.21.0) — sans quoi
// un `indexOf` à −1 donnerait une tranche vide et des tests verts pour rien.
function extraire(chemin) {
  const src = lireSource(...chemin);
  const debut = src.indexOf('const PANNES_DISQUE = {');
  const fin = src.indexOf('\n}', src.indexOf('function panneDisque(e) {'));
  assert.ok(debut > 0, chemin.join('/') + ' : PANNES_DISQUE a disparu');
  assert.ok(fin > debut, chemin.join('/') + ' : panneDisque a disparu');
  const bloc = src.slice(debut, fin + 2);
  assert.ok(bloc.length > 800 && bloc.length < 4000,
    chemin.join('/') + ' : tranche invraisemblable (' + bloc.length + ' caractères)');
  assert.ok(!bloc.includes('ipcMain'), chemin.join('/') + ' : la tranche a débordé sur l\'enveloppe');
  // eslint-disable-next-line no-new-func
  return { bloc, api: new Function(bloc + '\nreturn { PANNES_DISQUE, panneDisque };')() };
}

const ENT = extraire(['src', 'main.js']);
const CAB = extraire(['src', 'cabinet', 'main.js']);

t('10.0.1 : un disque plein se dit en français, et dit quoi faire', () => {
  for (const [nom, { api }] of [['entreprise', ENT], ['cabinet', CAB]]) {
    const p = api.panneDisque(Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' }));
    assert.ok(p, nom + ' : un disque plein ne reçoit aucune phrase');
    assert.ok(!/ENOSPC|no space left/.test(p), nom + ' : la phrase recopie l\'anglais de Node');
    // Les trois choses d'un refus (7.0.0) : ce qui est refusé, pourquoi, et ce qui débloque.
    assert.ok(/rien n'a été enregistré/i.test(p), nom + ' : la phrase ne dit pas ce qui est refusé');
    assert.ok(/plein/i.test(p), nom + ' : la phrase ne dit pas pourquoi');
    assert.ok(/réessaie|libère/i.test(p), nom + ' : la phrase ne dit pas ce qui débloque');
  }
});

t('10.0.1 : le code se lit sur l\'erreur ET dans son message', () => {
  // `e.code` ne traverse pas le pont IPC (9.4.10) : une erreur qui a déjà franchi une frontière
  // n'a plus que son préfixe. Lire l'un sans l'autre, c'est rater la moitié des cas.
  const parCode = ENT.api.panneDisque({ code: 'EROFS', message: 'quelque chose' });
  const parTexte = ENT.api.panneDisque({ message: 'EROFS: read-only file system, open \'/x\'' });
  assert.ok(parCode && parCode === parTexte, 'les deux chemins de lecture ne donnent pas la même phrase');
});

t('10.0.1 : ce qui n\'est pas une panne disque n\'est pas traduit', () => {
  // Élargir se prouve dans les DEUX sens (9.8.8) : la table doit voir le disque plein, et ne rien
  // voir ailleurs. Sinon elle avalerait un refus écrit et l'utilisateur lirait une phrase fausse.
  assert.strictEqual(ENT.api.panneDisque(new Error('Mot de passe incorrect.')), '');
  assert.strictEqual(ENT.api.panneDisque(new Error('HTTP 403')), '');
  assert.strictEqual(ENT.api.panneDisque({ code: 'ECONNREFUSED' }), '');
  assert.strictEqual(ENT.api.panneDisque(null), '');
  assert.strictEqual(ENT.api.panneDisque(undefined), '');
});

t('10.0.1 : les deux applications disent exactement la même chose', () => {
  // Deux tables qui divergent, c'est deux logiciels qui décrivent le même disque autrement. Même
  // garde que `round3` (9.1.0), `pastille` (9.4.0) et `plFr` (9.8.8) : on compare les CORPS.
  assert.deepStrictEqual(Object.keys(ENT.api.PANNES_DISQUE), Object.keys(CAB.api.PANNES_DISQUE),
    'les deux tables ne couvrent pas les mêmes codes');
  Object.keys(ENT.api.PANNES_DISQUE).forEach(c => {
    assert.strictEqual(ENT.api.PANNES_DISQUE[c], CAB.api.PANNES_DISQUE[c],
      'la phrase de ' + c + ' diffère entre les deux applications');
  });
  assert.strictEqual(ENT.api.panneDisque.toString(), CAB.api.panneDisque.toString(),
    'les deux `panneDisque` ont divergé');
  // Les codes qui comptent vraiment pour un fichier JSON posé sur un disque, une clé USB ou iCloud.
  ['ENOSPC', 'EACCES', 'EPERM', 'EROFS', 'ENOENT', 'EIO'].forEach(c => {
    assert.ok(ENT.api.PANNES_DISQUE[c], c + ' n\'a plus de phrase : ce cas arrive vraiment');
  });
});

t('10.0.1 : l\'enveloppe IPC traduit, et ne traduit pas un refus écrit', () => {
  // La traduction vit dans l'enveloppe posée UNE fois (9.4.10), pas dans quatre-vingts handlers.
  // Et elle laisse passer un refus qu'on a ÉCRIT : sinon « Mot de passe incorrect » deviendrait
  // « Le disque est plein » le jour où les deux se croisent.
  for (const [nom, chemin, code] of [['entreprise', ['src', 'main.js'], 'ERR-ENT-085'],
                                     ['cabinet', ['src', 'cabinet', 'main.js'], 'ERR-CAB-076']]) {
    const src = lireSource(...chemin);
    const net = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const i = net.indexOf('ipcMain.handle = (canal, fn)');
    const zone = net.slice(i, net.indexOf('\n});', i));
    assert.ok(zone.length > 100 && zone.length < 900, nom + ' : tranche de l\'enveloppe invraisemblable');
    assert.ok(/const phrase = \(e && e\.refus\) \? '' : panneDisque\(e\)/.test(zone),
      nom + ' : l\'enveloppe ne traduit plus les pannes système, ou traduit aussi les refus écrits');
    assert.ok(zone.includes(`erreur('${code}'`), nom + ' : la panne système ne porte plus son code');
    assert.ok(/if \(!\(e && e\.refus\)\) logToFile\('panne '/.test(zone),
      nom + ' : une panne ne laisse plus de trace au journal');
  }
});

t('10.0.1 : aucun message brut ne reste dans les deux renderers', () => {
  // Le défaut d'origine : `toast('Erreur de sauvegarde : ' + e.message)` — le SEUL des trente
  // endroits d'app.js qui ne passait pas par `plainError`, et celui où l'on perd son travail.
  const BRUT = /(?:toast|modal|textContent\s*=|innerHTML\s*=)[^\n]*(?:\+\s*(?:e|err|ex)\.message|\$\{(?:e|err|ex)\.message\})/;
  for (const [nom, chemin] of [['app entreprise', ['src', 'renderer', 'app.js']],
                               ['app cabinet', ['src', 'cabinet', 'renderer', 'app.js']]]) {
    const src = lireSource(...chemin);
    const fautes = src.split('\n')
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => !/^\s*\/\//.test(l) && BRUT.test(l))
      .map(({ l, i }) => nom + ':' + (i + 1) + ' ' + l.trim().slice(0, 70));
    assert.deepStrictEqual(fautes, [], 'message(s) brut(s) à l\'écran — passer par plainError()');
  }
});

t('10.0.1 : le Cabinet refuse un second import pendant qu\'un premier tourne', () => {
  // La fenêtre a DEUX portes — le bouton et le glisser-déposer — et rien n'empêchait de lâcher
  // vingt paquets pendant que vingt autres s'ingéraient. Ce qui casse alors n'est pas l'import,
  // c'est le FILET : le second `backupNow('avant-import')` écrase le premier par un état qui
  // contient déjà la moitié du premier import.
  const src = lireSource('src', 'cabinet', 'main.js');
  const net = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const i = net.indexOf("ipcMain.handle('cab:importPack'");
  const zone = net.slice(i, net.indexOf('\n});', i));
  assert.ok(zone.length > 1000 && zone.length < 5000, 'tranche invraisemblable (' + zone.length + ')');
  assert.ok(/if \(importEnCours\)/.test(zone), 'aucun garde-fou : deux imports peuvent se chevaucher');
  assert.ok(zone.includes("erreur('ERR-CAB-077'"), 'le refus ne porte pas son code');
  // Le refus passe AVANT le sélecteur de fichiers : demander vingt paquets pour les refuser
  // ensuite serait la pire des deux façons de dire non.
  assert.ok(zone.indexOf('if (importEnCours)') < zone.indexOf('showOpenDialog'),
    'le refus arrive après avoir demandé les fichiers');
  // Et le drapeau retombe QUOI QU'IL ARRIVE : sans `finally`, un import qui échoue au milieu
  // fermerait la porte pour le reste de la session (le défaut qu'on vient de corriger, à l'envers).
  assert.ok(/\} finally \{ importEnCours = false; \}/.test(zone),
    'le drapeau ne retombe pas : un import raté bloquerait tous les suivants');
  assert.ok(zone.indexOf('importEnCours = true') < zone.indexOf("backupNow('avant-import')"),
    'le drapeau se lève après la sauvegarde : la fenêtre du chevauchement reste ouverte');
});

t('10.0.1 : un enregistrement refusé ne tient pas dans un bandeau', () => {
  // Un message qui s'efface en 2,6 secondes annonce une perte de travail à quelqu'un qui regarde
  // son clavier, et la frappe suivante le fait disparaître. On teste la RÈGLE — l'échec ouvre une
  // fenêtre et offre le geste qui débloque — pas la forme exacte du gabarit (7.16.0).
  const app = lireSource('src', 'renderer', 'app.js');
  const net = app.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(/\.catch\(echecEnregistrement\)/.test(net),
    'le chemin d\'enregistrement ne passe plus par echecEnregistrement');
  const i = net.indexOf('function echecEnregistrement');
  const zone = net.slice(i, net.indexOf('\n  }', i));
  assert.ok(zone.length > 200 && zone.length < 1500, 'tranche invraisemblable (' + zone.length + ')');
  assert.ok(!/\btoast\(/.test(zone), 'la perte de travail est annoncée par un bandeau passager');
  assert.ok(/modal\(/.test(zone), 'la perte de travail n\'ouvre plus de fenêtre');
  assert.ok(/plainError\(e\)/.test(zone), 'la fenêtre affiche autre chose que la phrase écrite');
  assert.ok(/id="reessayer"/.test(zone), 'le refus n\'offre plus le geste qui débloque (règle 7.0.0)');
  // Un enregistrement automatique toutes les 300 ms ne doit pas empiler dix fenêtres.
  assert.ok(/if \(echecOuvert\) return/.test(zone), 'rien n\'empêche d\'empiler les fenêtres');
});

};
