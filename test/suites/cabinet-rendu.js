'use strict';
// ============================================================================================
// Le rendu du Cabinet — ce que voit le comptable (9.4.2 → 9.4.9)
//
// Premier découpage du fichier de tests par domaine (F-9.4.10-04). La règle du § 15 de
// QUESTIONS.md : on découpe PAR OCCASION, un domaine à la fois, et aucun fichier ne dépasse
// plus sa taille du jour. Le lot déplacé ici est celui du chantier UI/UX du Cabinet : il ne
// dépend que du harnais (« t », « assert ») et de la lecture des sources.
//
// Le harnais arrive en argument plutôt que par un « require » croisé : c'est lui qui compte les
// tests et qui refuse un test asynchrone lancé sans « await » (6.7.0, 8.4.0). Deux compteurs,
// c'est un total faux.
module.exports = ({ t, assert, lireSource }) => {
// ================================================================ 9.4.2 — CE QUE VOIT LE COMPTABLE
//
// Six défauts trouvés en ouvrant vraiment l'application, écran par écran (`e2e:cabinet-jour1`).
// Ces assertions-ci sont les mêmes règles, tenues sans lancer Electron : `npm test` tourne à
// chaque poussée, les parcours non.
t('9.4.2 : un bouton se reconnaît au repos, jamais au survol', () => {
  const css = lireSource('src', 'renderer', 'style.css');
  // `btn-ghost` n'avait ni fond ni bordure, et son texte était celui du corps : « Voir » sur
  // chaque ligne de « À faire », « Exporter en CSV », « Enregistrer ma clé… » se lisaient comme du
  // gras. Neuf boutons dans ce cas, mesurés dans l'application réelle.
  // ANCRÉ EN DÉBUT DE LIGNE : sans le `^`, la première correspondance est
  // `.sidebar-foot .btn-ghost {` — qui vit 200 lignes plus haut et qui a le droit, elle, d'être
  // sans bordure. Le test lisait donc la mauvaise règle et ne pouvait pas échouer ; il est resté
  // vert avec le défaut réintroduit, et c'est la preuve par le défaut qui l'a dit.
  const regle = (css.match(/^\.btn-ghost \{[^}]*\}/m) || [''])[0];
  assert.ok(regle, 'la règle .btn-ghost est introuvable');
  assert.ok(!/border-color:\s*transparent/.test(regle),
    'un bouton sans bordure ni couleur n\'est pas un bouton (Cabinet 1.0.0)');
  // Les exceptions sont NOMMÉES et portent l'autre signe : une couleur qui n'est pas celle du
  // texte. Sans elles, une entrée de menu se retrouverait encadrée au milieu d'une liste.
  assert.ok(/\.sidebar-foot \.btn-ghost[^{]*\{[^}]*border-color:\s*transparent/.test(css),
    'le pied de la barre latérale garde ses entrées sans cadre');
  const cab = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/\.wiz-actions \.btn-ghost \{[^}]*border-color:\s*transparent[^}]*color:/.test(cab),
    'le « Passer » de l\'assistant garde sa couleur à défaut de bordure');
  // Et cette règle-là vit chez le cabinet : `wiz-actions` est une de SES classes (règle 6.8.0).
  assert.ok(!/\.wiz-actions/.test(css), 'une classe du cabinet n\'a rien à faire dans la feuille partagée');
});

t('9.4.2 : la page Relances ne félicite pas un cabinet qui n\'a aucun client', () => {
  const src = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = src.indexOf('function drawRelances(');
  assert.ok(i > 0, 'la page Relances est introuvable');
  const zone = src.slice(i, i + 1600);
  // « Personne à relancer : tous tes dossiers sont à jour » s'affichait sur un portefeuille VIDE.
  // C'est la règle de la 7.0.0 — vérifier que l'univers concerné est non vide avant de rassurer —
  // et c'était la seule des trois pages à ne pas l'appliquer.
  assert.ok(/if \(!K\.dossierList\(S\)\.length\)/.test(zone),
    'la page doit distinguer « aucun client » de « tous à jour »');
  // La tranche va du `if` au `return;` qui referme la branche — une borne que le code PORTE.
  // Jusqu'à la 9.4.6 elle sautait « les 40 premiers caractères » pour ignorer le `view.innerHTML`
  // de l'état vide : un décalage arbitraire, qui a basculé sur un autre bloc dès qu'une ligne s'est
  // insérée entre le `if` et lui. Une tranche s'ancre sur du code, jamais sur un nombre.
  const dVide = src.indexOf('if (!K.dossierList(S).length)', i);
  const vide = src.slice(dVide, src.indexOf('\n      return;', dVide));
  assert.ok(vide.length > 400 && vide.length < 1600, 'tranche de l\'état vide inattendue : ' + vide.length);
  // Un état vide porte son geste, comme ses deux voisines (Échéances, Écritures).
  assert.ok(/id="rl-nd"/.test(vide) && /id="rl-imp"/.test(vide), 'l\'état vide doit offrir un geste');
  assert.ok(/\$\('#rl-nd'\)\.onclick/.test(src) && /\$\('#rl-imp'\)\.onclick/.test(src),
    'et les deux boutons doivent être branchés : un bouton mort est pire qu\'un bouton absent');
});

t('9.4.2 : l\'assistant du Cabinet compte ses écrans au lieu de les annoncer', () => {
  const src = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = src.indexOf('function runSetup(');
  const brut = src.slice(i, src.indexOf('function draw()', i));
  assert.ok(brut.length > 3000, 'tranche de l\'assistant inattendue : ' + brut.length);
  // Un test qui lit du code doit lire du CODE (6.8.0) : le commentaire qui explique ce défaut cite
  // justement la phrase interdite, et il suffisait à faire tomber ce test sur du code juste.
  const zone = brut.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(zone.includes('Bienvenue dans SkanFact Cabinet'), 'le nettoyage des commentaires a mangé le code');
  // La phrase annonçait un nombre au-dessus de pastilles qui en montraient un autre. Une phrase
  // affichée que rien ne tient est un bug (7.3.0) — celle-ci se démentait toute seule à l'écran.
  assert.ok(!/(Trois|Quatre|Cinq|Six) écrans/.test(zone),
    'le nombre d\'écrans de l\'assistant ne s\'écrit pas à la main');
  // 10.14.0 — la porte n'est pas une question : le compte annoncé est celui des QUESTIONS, déduit du
  // tableau des étapes (assertion retournée vers la règle : elle recopiait `[etapes.length]`).
  assert.ok(/const QUESTIONS = etapes\.filter\(/.test(zone) && /\[QUESTIONS\]/.test(zone), 'il se déduit du tableau des étapes');
});

t('9.4.2 : l\'avertissement du mot de passe se lit AVANT le bouton', () => {
  const html = lireSource('src', 'cabinet', 'renderer', 'index.html');
  const note = html.indexOf('id="lock-note"');
  const bouton = html.indexOf('id="lock-go"');
  assert.ok(note > 0 && bouton > 0, 'l\'écran de mot de passe a changé de forme');
  // « Il n'y a aucun moyen de récupérer ce mot de passe » se lisait SOUS « Créer mon cabinet ».
  // Un avertissement posé après le geste est un avertissement lu après coup.
  assert.ok(note < bouton, 'l\'avertissement doit précéder le bouton qui crée le cabinet');
  const src = lireSource('src', 'cabinet', 'renderer', 'app.js');
  assert.ok(/note\.className = 'lock-note warn-box grave'/.test(src),
    'et il se lit comme un avertissement, pas comme une ligne de plus');
});

t('9.4.3 : un titre de section est un titre, et la sur-étiquette n\'est déclarée qu\'une fois', () => {
  // Un test qui lit du code doit lire du CODE (6.8.0) : les commentaires de cette feuille citent
  // les sélecteurs qu'ils expliquent, et ma première version de ce test tombait sur son propre
  // commentaire. On les retire — puis on vérifie que le nettoyage n'a pas mangé le code.
  const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const css = sansCommentaires(lireSource('src', 'renderer', 'style.css'));
  const cab = sansCommentaires(lireSource('src', 'cabinet', 'renderer', 'cabinet.css'));
  assert.ok(css.length > 20000 && cab.length > 3000, 'le retrait des commentaires a mangé le code');

  // 1. `.panel h2` est le SEUL titre de section des deux applications. Il valait 11 px, gris, en
  //    capitales : il donnait le même poids à « Comptabilité » qu'à « Abonnements », et un titre
  //    gris de 11 px ne hiérarchise rien — il décore. On teste la RÈGLE (c'est un titre, il porte
  //    la couleur du texte et une taille de titre), pas une valeur au pixel près.
  const bloc = css.match(/^\.panel h2 \{[^}]*\}/m);
  assert.ok(bloc, 'la règle `.panel h2` a disparu de la feuille partagée');
  const regle = bloc[0];
  assert.ok(/text-transform:\s*none/.test(regle), 'un titre de section ne se lit pas en capitales');
  assert.ok(/color:\s*var\(--text\)/.test(regle), 'un titre de section porte la couleur du texte, pas celle du gris secondaire');
  const taille = Number((regle.match(/font-size:\s*([\d.]+)px/) || [])[1]);
  assert.ok(taille >= 14, `un titre de section fait au moins 14 px (il en fait ${taille})`);

  // 2. La sur-étiquette en capitales garde son rôle — au-dessus d'un CHIFFRE — mais elle n'est
  //    plus recopiée. Elle l'était sept fois, six dans la feuille partagée et une dans celle du
  //    Cabinet : un mécanisme recopié diverge toujours (7.29.0), et celui-là avait déjà commencé
  //    (l'un des sept portait un `margin-bottom` que les autres n'avaient pas).
  // On compte les RÈGLES qui habillent ce rôle — la catégorie posée au-dessus d'un chiffre. Le
  // motif compté n'est pas une chaîne au hasard : c'est la déclaration qui était recopiée mot
  // pour mot. Elle ne doit plus exister qu'à un seul endroit, et porter les trois sélecteurs qui
  // partagent ce rôle. Un en-tête de tableau en capitales n'en fait pas partie : ce n'est pas le
  // même rôle, et le lui donner ferait bouger toutes les colonnes de l'application.
  const roles = (s) => (s.match(/[^{}]*\.(k-label|stat \.lbl)[^{}]*\{[^}]*font-size[^}]*\}/g) || []);
  const n = roles(css).length + roles(cab).length;
  assert.strictEqual(n, 1, `la sur-étiquette doit être déclarée une seule fois, elle l'est ${n} fois`);
  assert.ok(/^\.eyebrow, \.k-label, \.stat \.lbl \{/m.test(css),
    'et elle porte un nom qui dit son rôle (`.eyebrow`), partagé par les trois sélecteurs qui l\'ont');

  // 3. Le garde-fou de la 6.8.0 dans l'autre sens : la feuille du Cabinet ne redéclare pas un
  //    titre de section pour son compte, sinon les deux applications divergeraient à la première
  //    retouche.
  assert.ok(!/\.panel h2 \{/.test(cab), 'le Cabinet ne redéclare pas le titre de section');
});

t('9.4.3 : le Cabinet a un thème, et il le RETIENT', () => {
  const core = lireSource('src', 'cabinet', 'cabcore.js');
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const main = lireSource('src', 'cabinet', 'main.js');

  // Le réglage existe, il a une valeur par défaut, et une valeur inventée retombe dessus.
  assert.ok(/theme:\s*'auto'/.test(core), '`theme` manque aux réglages par défaut du Cabinet');
  assert.ok(/\['light', 'dark', 'auto'\]\.includes\(s\.settings\.theme\)/.test(core),
    'un thème inconnu doit retomber sur « auto » : une valeur inventée ne doit pas laisser l\'application dans un état qu\'aucun écran ne propose');

  // Il SURVIT à l'enregistrement d'un autre panneau. `cab:saveCabinet` remplaçait autrefois des
  // réglages en bloc : un écran qui n'envoie que le jour de relance ne doit pas effacer le thème.
  const h = main.slice(main.indexOf("ipcMain.handle('cab:saveCabinet'"));
  const fin = h.indexOf('ipcMain.handle(', 10);
  const zone = h.slice(0, fin > 0 ? fin : 2000);
  // 2 900 depuis la 10.0.0 : le handler a gagné les régimes (F-9.6.0-12) et le garde-fou qui
  // empêche un écran n'envoyant que des réglages d'effacer le NOM du cabinet. La borne ne protège
  // pas d'une taille, elle protège d'une tranche qui déborderait sur le handler suivant et
  // prouverait alors n'importe quoi (7.21.0) : le contrôle qui compte est celui du `fin` ci-dessus.
  assert.ok(zone.length < 2900, 'la tranche du handler est trop large pour prouver quoi que ce soit');
  assert.ok(!zone.slice(10).includes('ipcMain.handle('), 'la tranche déborde sur le handler suivant');
  assert.ok(/state\.settings = \{ \.\.\.state\.settings, theme:/.test(zone),
    'le thème doit être FUSIONNÉ dans les réglages, pas les remplacer');

  // Et il est posé par le renderer à chaque dessin — un état lu une fois au démarrage se périme
  // (7.1.x), et « auto » doit suivre le système quand il bascule à la tombée de la nuit.
  assert.ok(/mqSombre\.addEventListener\('change'/.test(app),
    '« auto » doit réagir au changement de thème du système');
  const r = app.slice(app.indexOf('function render() {'));
  assert.ok(r.slice(0, 400).includes('appliquerTheme();'), 'le thème se pose à chaque dessin');
});

t('9.4.4 : la page Dossiers laisse le portefeuille se voir, et chaque ligne agir', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');

  // 1. « À faire » se replie, le choix est MÉMORISÉ, et la liste est plafonnée. Six lignes font
  //    400 px : avec les chiffres au-dessus, la liste des clients partait sous l'écran. L'app
  //    entreprise a `todo-toggle` + `prefs` depuis la 2.2.0 ; le Cabinet ne l'avait jamais reçu.
  assert.ok(/id="todo-toggle"/.test(app), 'le panneau « À faire » n\'est pas repliable');
  assert.ok(/prefs\.set\('todoOpen'/.test(app), 'le choix de replier doit survivre au redessin');
  assert.ok(/const VISIBLES = \d+;/.test(app), 'la liste doit être plafonnée');
  // Et ce qui est caché se COMPTE : un « voir plus » qui ne dit pas combien ne se clique pas.
  assert.ok(/Voir \$\{pl\(caches/.test(app), 'le lien qui déplie doit compter ce qu\'il cache');

  // 2. Les six lignes de « À faire » mènent à six endroits différents ; cinq portaient le même
  //    libellé « Voir ». Un libellé décrit l'écran d'ARRIVÉE (7.29.0) : on teste qu'il n'y a plus
  //    de doublon, pas une liste de libellés écrite à la main qui se périmerait.
  const tbl = app.slice(app.indexOf('const TODO_ACTIONS = {'));
  const zone = tbl.slice(0, tbl.indexOf('\n  };'));
  assert.ok(zone.length > 300 && zone.length < 2500, `tranche de ${zone.length} caractères : trop large pour prouver quoi que ce soit`);
  assert.ok(!zone.includes('function '), 'la tranche a débordé sur autre chose que la table');
  const libelles = [...zone.matchAll(/texte: '((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
  assert.ok(libelles.length >= 6, `seulement ${libelles.length} libellés lus dans la table`);
  assert.strictEqual(new Set(libelles).size, libelles.length,
    'deux lignes de « À faire » portent le même libellé : on ne sait pas où elles mènent');

  // 3. La légende du code couleur couvre EXACTEMENT les niveaux que `dossierRow` peut produire.
  //    Une légende écrite à la main se périme au premier niveau ajouté — c'est le test de
  //    couverture des treize boutons morts (7.0.0), appliqué à une couleur.
  const cab = lireSource('src', 'cabinet', 'cabcore.js');
  const ligne = (cab.match(/const level = [^;]+;/) || [])[0] || '';
  assert.ok(ligne, 'la ligne qui calcule le niveau d\'un dossier est introuvable');
  const produits = [...new Set([...ligne.matchAll(/'([a-z]+)'/g)].map(m => m[1]))];
  assert.ok(produits.length >= 3, `seulement ${produits.length} niveaux lus`);
  const legendes = Object.keys(JSON.parse('{' + (app.match(/const NIVEAUX = \{([\s\S]*?)\n  \};/) || [, ''])[1]
    .split('\n').filter(l => l.includes(':')).map(l => {
      const m = l.match(/^\s*([a-z]+):/); return m ? `"${m[1]}":1` : '';
    }).filter(Boolean).join(',') + '}'));
  produits.forEach(n => assert.ok(legendes.includes(n),
    `le niveau « ${n} » est posé par le code et n'est pas dans la légende : une pastille sans son mot n'est pas une information`));

  // 4. Chaque ligne de la liste porte son menu d'actions — `rowmenu.js` est partagé par les deux
  //    applications depuis la 7.29.0, et la page principale du Cabinet ne l'utilisait pas.
  assert.ok(/RowMenu\.cellule\('D:' \+ r\.id/.test(app), 'les lignes de la liste des dossiers n\'ont pas de menu');
  // Et le menu ne vole pas le clic de la ligne, ni l'inverse (piège 7.28.0).
  assert.ok(/e\.target\.closest\('\.row-actions'\)\) return;/.test(app),
    'ouvrir le menu d\'une ligne ouvrirait aussi sa fiche');
});

t('9.4.4 : le rouge de la clé de secours arrive quand il y a quelque chose à perdre', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('function recoveryBanner()');
  assert.ok(i > 0, 'le bandeau de la clé de secours est introuvable');
  const zone = app.slice(i, app.indexOf('\n  }', i));
  assert.ok(zone.length > 400 && zone.length < 2200, `tranche de ${zone.length} caractères`);
  // Le premier écran d'un comptable, avant qu'il ait un seul client, était un bandeau ROUGE. Un
  // avertissement juste au mauvais moment apprend à ignorer la couleur. Le rouge est CONDITIONNÉ
  // à ce qu'il y ait quelque chose sur le disque ; il ne disparaît pas pour autant — la ligne
  // calme reste, parce que la clé s'enregistre mieux avant le premier paquet qu'après.
  // 10.14.0 — un paquet RÉEL : ceux de l'exemple sont fictifs, et la découverte criait la clé en rouge
  // dès son premier écran. La même fonction décide du bandeau et de la ligne rouge de « À faire ».
  const j = app.indexOf('function paquetsReelsRecus()');
  const reels = app.slice(j, app.indexOf('\n  }', j));
  assert.ok(j > 0 && /!d\.demo/.test(reels) && /d\.packs \|\| \[\]\)\.length/.test(reels), 'un paquet de l\'exemple compte comme un paquet reçu');
  assert.ok(/if \(!paquetsReelsRecus\(\)\)/.test(zone), 'le rouge doit être conditionné à un paquet réel déjà reçu');
  assert.ok(/paquetsReelsRecus\(\) \? false : null/.test(app), 'la ligne rouge de « À faire » ne regarde pas s\'il y a quelque chose à perdre');
  const calme = zone.slice(zone.indexOf('if (!paquetsReelsRecus())'), zone.indexOf('return `<div class="banner danger"'));
  assert.ok(!calme.includes('banner danger'), 'le jour 0 ne s\'ouvre pas sur un bandeau rouge');
  assert.ok(calme.includes('rec-go'), 'et il garde le bouton : prévenir sans offrir le geste ne sert à rien');
});

t('9.4.5 : les quatre vues du livre sont paginées, et le pied porte la sélection entière', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  // Les trois aides prennent un ÉTAT. Câblées sur `listState` en dur (jusqu'à la 9.4.5), elles ne
  // pouvaient servir qu'à la liste des dossiers — et le grand livre d'un client faisait 6 462 px.
  assert.ok(/function pagerBar\(total, st = listState/.test(app), 'pagerBar doit accepter un état');
  assert.ok(/function bindPager\(root, redraw, st = listState\)/.test(app), 'bindPager doit accepter un état');
  assert.ok(/const paginate = \(rows, st = listState\)/.test(app), 'paginate doit accepter un état');

  // Chacune des quatre vues pagine, et sur l'unité qu'elle MONTRE : le livre-journal par pièce
  // (couper une pièce en deux montrerait un débit sans son crédit), le grand livre par compte
  // (le solde progressif se calcule sur le compte entier).
  const vue = nom => {
    const i = app.indexOf('function ' + nom + '(');
    assert.ok(i > 0, nom + ' est introuvable');
    const fin = app.indexOf('\n  }', i);
    const z = app.slice(i, fin);
    // La borne haute attrape une tranche qui déborderait sur la fonction suivante ; relevée de 6 000
    // à 7 000 en 10.14.0, quand la balance a gagné ses en-têtes sur deux lignes et leur raison.
    assert.ok(z.length > 500 && z.length < 7000, nom + ' : tranche de ' + z.length + ' caractères');
    return z;
  };
  const j = vue('vueJournal');
  assert.ok(/paginate\(lj\.pieces, s\)/.test(j), 'le livre-journal doit paginer les PIÈCES, pas les lignes');
  assert.ok(/pagerBar\(lj\.pieces\.length, s, 'pièce'\)/.test(j), 'et annoncer des pièces');
  // Le pied porte sur la sélection entière : `lj` est construit sur `gardees`, jamais sur la page.
  assert.ok(/const lj = KC\.journalDepuisLignes\(gardees\)/.test(j), 'le total doit se calculer sur la sélection entière');

  const g = vue('vueGrandLivre');
  assert.ok(/pagerBar\(gl\.comptes\.length, s, 'compte'\)/.test(g) && /paginate\(gl\.comptes, s\)/.test(g),
    'le grand livre doit paginer les COMPTES');
  // Et paginer ne suffisait pas : vingt comptes tiennent sur une page, et la page faisait sept
  // écrans. Chaque compte est REPLIÉ sur sa ligne de synthèse — sauf celui qu'on a demandé.
  assert.ok(/<details class="panel mt gl-compte"/.test(g), 'chaque compte doit être repliable');
  assert.ok(/s\.compte \|\| gl\.comptes\.length === 1 \? 'open' : ''/.test(g),
    'le compte choisi dans la liste doit s\'ouvrir tout seul');
  assert.ok(/<summary class="gl-tete">/.test(g) && /Solde \$\{esc\(money\(c\.solde\)\)\}/.test(g),
    'la ligne repliée doit porter le solde : un compte replié sans son chiffre n\'apprend rien');
  const cssGl = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  assert.ok(/details\.gl-compte > \*:not\(summary\) \{ display: block !important/.test(cssGl),
    'un grand livre imprimé plié serait une feuille de soldes : l\'impression ouvre tout');
  const b = vue('vueBalance');
  assert.ok(/paginate\(b\.rows, s\)/.test(b), 'la balance doit paginer ses lignes');
  assert.ok(/money\(b\.totaux\.debit\)/.test(b), 'et totaliser `b.totaux`, calculé sur toutes les lignes');
  const l = vue('vueLettrage');
  // Depuis la 9.8.8 (T-14), ce sont les tiers OUVERTS qui se paginent : les soldés tiennent sur une
  // ligne dépliable, et un panneau entier par client soldé noyait la seule question de l'écran.
  assert.ok(/const ouverts = l\.rows\.filter\(r => r\.ouverts\.length\)/.test(l), 'le lettrage doit séparer les tiers ouverts des soldés');
  assert.ok(/paginate\(ouverts, s\)/.test(l), 'le lettrage doit paginer ses tiers ouverts');
  assert.ok(/id="lv-soldes"/.test(l), 'les tiers soldés doivent rester visibles, repliés');

  // Le pager est BRANCHÉ sur l'état des livres — un pager dessiné et non branché est un bouton
  // mort (7.0.0), et personne ne le verrait : il a l'air normal.
  const iv = app.indexOf('function brancherVue(');
  const zv = app.slice(iv, app.indexOf('\n  }', iv));
  assert.ok(/bindPager\(el, redraw, s\)/.test(zv), 'brancherVue doit brancher le pager sur `s`');
  // Et tout ce qui change la sélection remet la page à 1 : sans ça, filtrer depuis la page 7 rend
  // un tableau vide sans que rien à l'écran ne l'explique.
  ['s.journal = j.value', 's.q = q.value', 's.compte = c.value', 's.aux = !s.aux'].forEach(geste => {
    const k = zv.indexOf(geste);
    assert.ok(k > 0, 'geste introuvable : ' + geste);
    assert.ok(zv.slice(k, k + 60).includes('s.page = 1'), geste + ' doit remettre la page à 1');
  });
});

t('9.4.5 : les totaux de la grille vivent SOUS leurs colonnes, et le bouton éteint dit pourquoi', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('function vueSaisie(');
  const z = app.slice(i, app.indexOf('\n  }\n', i));
  // Une somme annoncée dans une phrase à gauche de l'écran ne se compare à rien : l'œil descend
  // une colonne de montants et doit trouver son total au bout de CETTE colonne.
  assert.ok(/<tfoot>/.test(z), 'la grille de saisie doit porter un pied de totaux');
  assert.ok(/id="sa-td"/.test(z) && /id="sa-tc"/.test(z), 'un total par colonne (débit, crédit)');
  assert.ok(/id="sa-te"/.test(z), 'et la ligne d\'écart');
  // Le refus se lit AVANT le bouton, pas dessous (9.4.2).
  const iR = z.indexOf('id="sa-refus"'), iB = z.indexOf('id="sa-okvalider"');
  assert.ok(iR > 0 && iB > 0 && iR < iB, 'le motif du refus doit précéder le bouton qu\'il explique');

  const im = app.indexOf('const majSolde = () => {');
  const m = app.slice(im, app.indexOf('\n    };', im));
  assert.ok(m.length > 600 && m.length < 4200, 'majSolde : tranche de ' + m.length + ' caractères');
  // **La même fonction que celle qui refusera à l'enregistrement.** Un contrôle recopié à la main
  // dans l'écran finirait par diverger de celui du moteur, et le bouton s'éteindrait sur une
  // pièce que l'enregistrement accepte — ou l'inverse, bien pire.
  //
  // Les trois assertions qui suivaient recopiaient la LIGNE du jour (`KC.ecritureValide(
  // ecritureSaisie(p)`, `b.disabled = !v.ok`, `motif.textContent = v.ok ? …`) : elles sont tombées
  // le jour où les deux boutons ont cessé d'exiger la même chose (T-51), sur du code juste — la
  // quinzième fois que ce motif revient. On exige la RÈGLE, pas sa forme.
  //
  // Et la RÈGLE, pas sa forme, une fois encore : le contrôle en direct et le refus à
  // l'enregistrement passent par la MÊME porte, et cette porte finit sur `ecritureValide`. Depuis la
  // 10.12.0 (H-3) elle s'appelle `verdictSaisie` — elle nomme d'abord un montant illisible —, et
  // l'assertion qui exigeait `KC.ecritureValide(` dans `majSolde` est tombée sur du code juste.
  const porte = /\b(verdictSaisie|KC\.ecritureValide)\(/.exec(m);
  assert.ok(porte, 'le contrôle en direct doit passer par `ecritureValide` (ou la porte qui y mène), jamais par une règle recopiée');
  const ie = app.indexOf('const enregistrer = async (puisValider) => {');
  const enr = app.slice(ie, app.indexOf('\n    };', ie));
  assert.ok(ie > 0 && enr.length > 300, 'la tranche de l\'enregistrement est introuvable');
  assert.ok(enr.includes(porte[1] + '('), 'l\'enregistrement doit juger par la MÊME porte que le contrôle en direct');
  if (porte[1] === 'verdictSaisie') {
    const iv = app.indexOf('const verdictSaisie = ');
    const v = app.slice(iv, app.indexOf('\n  };', iv));
    assert.ok(iv > 0 && /KC\.ecritureValide\(/.test(v), 'la porte doit finir sur `ecritureValide`');
  }
  // Le brouillard accepte une pièce à moitié tapée, la validation exige un libellé : DEUX verdicts,
  // et chaque bouton suit le sien. Un seul verdict éteindrait le brouillard sur le motif de la
  // validation, et enfermerait la saisie en cours.
  assert.ok(/\{ valider: true \}/.test(m), 'le bouton « valider » doit juger avec les exigences de la validation');
  ['sa-ok', 'sa-okvalider'].forEach(id => {
    const zone = m.slice(m.indexOf(id));
    assert.ok(/disabled = !\w+\.ok/.test(zone), `le bouton ${id} doit s'éteindre sur son propre verdict`);
  });
  assert.ok(/motif\.textContent = /.test(m) && !/motif\.textContent = ''/.test(m),
    'le motif s\'AFFICHE, pas seulement en title');
  // Toujours pas de redessin à la frappe (règle 9.3.0) : on met à jour la donnée, puis les seuls
  // éléments qui en dépendent.
  assert.ok(!/drawLivres/.test(m), 'le solde ne redessine pas la grille : le curseur y repartirait dans le vide');
});

t('9.4.5 : un raccourci s\'affiche comme une touche, et se règle en appuyant dessus', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  // « Control+Enter » au milieu d'une phrase grise se lit comme une faute de frappe. Chaque touche
  // sort dans un `<kbd>`, et sous un nom de clavier français.
  assert.ok(/const kbd = combo =>/.test(app), 'le rendu d\'une touche doit vivre en UN endroit');
  assert.ok(/<kbd>\$\{esc\(NOM_TOUCHE\[t\] \|\| t\)\}<\/kbd>/.test(app), 'et passer par la table des noms');
  assert.ok(/Enter: '↵ Entrée'/.test(app), 'Enter s\'écrit « Entrée » sur un clavier français');
  // La ligne d'aide de la grille suit les touches RÉGLÉES : une aide qui annonce F2 quand la
  // touche est F5 est pire que pas d'aide.
  const ia = app.indexOf('function aideTouches()');
  assert.ok(ia > 0, 'la ligne d\'aide est introuvable');
  const za = app.slice(ia, app.indexOf('\n  }', ia));
  assert.ok(/const t = touchesSaisie\(\)/.test(za), 'elle doit lire les touches réglées');
  ['ligneSuivante', 'solder', 'recopier', 'dupliquer', 'valider'].forEach(k => {
    assert.ok(za.includes('t.' + k), 'la touche « ' + k + ' » n\'est pas montrée');
  });
  assert.ok(app.includes('${aideTouches()}'), 'et la grille doit la poser');
  // Le champ se règle en APPUYANT : personne ne sait que la touche Entrée s'appelle « Enter », et
  // une faute de frappe donnait un raccourci qui ne se déclenchait jamais, sans rien à l'écran.
  assert.ok(/readonly data-touche=/.test(app), 'le champ « touche » ne se tape pas, il se capture');
  const ib = app.indexOf('function brancherReglagesCompta(');
  const zb = app.slice(ib, ib + 1800);
  assert.ok(/inp\.onkeydown = ev =>/.test(zb), 'la capture au clavier manque');
  assert.ok(/poser\(toucheDe\(ev\)\)/.test(zb), 'et elle doit passer par `toucheDe`, la même que la grille');
  assert.ok(/ev\.key === 'Escape'/.test(zb), 'Échap doit rendre la main : on sort toujours d\'un champ qui avale le clavier');
  assert.ok(/\['Control', 'Alt', 'Shift', 'Meta'\]\.includes\(ev\.key\)/.test(zb),
    'un modificateur seul n\'est pas un raccourci');
  assert.ok(/data-touche-reset=/.test(app), 'et on doit pouvoir remettre la touche d\'origine');
  // Les classes posées existent dans une feuille : une classe inconnue ne se voit nulle part (8.1.0).
  ['.kbd-aide', '.kbd-paire', '.kbd-plus', '.touche-ligne', '.touche-in', '.touche-vue', '.sa-refus']
    .forEach(c => assert.ok(css.includes(c + ' ') || css.includes(c + ','), 'classe sans style : ' + c));
});

t('9.4.6 : on pointe une OCCURRENCE, jamais une règle — et ça se défait', () => {
  const K = require('../../src/cabinet/cabcore.js');
  // La clé porte la RÈGLE et sa DATE. Faire taire « tva-m » ferait taire tous les mois suivants :
  // c'est le défaut que la 7.21.0 a corrigé côté entreprise, jamais porté ici jusqu'à la 9.4.6.
  const avril = { id: 'tva-m', date: '2026-05-15' }, mai = { id: 'tva-m', date: '2026-06-15' };
  assert.strictEqual(K.cleEcheance(avril), 'tva-m@2026-05-15');
  const st = K.migrate({ settings: { depots: [K.cleEcheance(avril)] } });
  assert.ok(K.echeanceDeposee(st, avril), 'la TVA d\'avril doit être pointée');
  assert.ok(!K.echeanceDeposee(st, mai), 'celle de mai reste due : on pointe une occurrence, pas une règle');

  // Absent de `migrate`, le pointage serait jeté au prochain démarrage et chaque échéance
  // déposée se remettrait à crier, en silence (défaut `matricule`, 6.8.0).
  assert.deepStrictEqual(K.migrate(st).settings.depots, ['tva-m@2026-05-15'],
    'le pointage doit survivre à migrate');
  // Ce qui ne ressemble pas à une occurrence est écarté : une clé inventée ne doit pas rester
  // dans les données à faire taire on ne sait quoi.
  assert.deepStrictEqual(
    K.migrate({ settings: { depots: ['tva-m', 'x@2026-13-99', 'cnss@2026-04-15', 42] } }).settings.depots,
    ['cnss@2026-04-15']);
  // Par défaut, rien n'est pointé : une application livrée ne fait taire aucune échéance.
  assert.deepStrictEqual(K.migrate({}).settings.depots, []);

  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('function drawEcheances(');
  const z = app.slice(i, app.indexOf('\n  }\n', i));
  assert.ok(/K\.echeanceDeposee\(S, e\)/.test(z) && /K\.cleEcheance\(e\)/.test(z),
    'l\'écran doit lire le verdict du moteur, jamais recalculer la clé lui-même');
  assert.ok(/data-depot=/.test(z), 'chaque carte doit porter son pointage');
  assert.ok(/toastUndo\(/.test(z), 'ce qui se répare laisse un « Annuler » sous la main (7.12.0)');
  // Un pense-bête qui laisserait croire à un dépôt réel serait le pire de tous les mensonges :
  // l'app ne dépose rien et ne se connecte à aucune administration (règle 5.2.0).
  assert.ok(/ne dépose rien à ta place/.test(z), 'l\'écran doit dire que rien n\'est déposé pour de vrai');
  const g = lireSource('src', 'cabinet', 'renderer', 'cabguide.js');
  assert.ok(g.includes("'ec.depot'"), 'le geste doit porter sa bulle');
});

t('9.4.6 : une échéance ne réénumère ni sa phrase ni ses clients', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('function drawEcheances(');
  const z = app.slice(i, app.indexOf('\n  }\n', i));
  assert.ok(z.length > 2000 && z.length < 9000, 'tranche de ' + z.length + ' caractères');
  // Le `detail` explique la RÈGLE : la même phrase de 90 caractères s'affichait sous les quatre
  // mois de TVA d'affilée. Une explication se lit une fois.
  assert.ok(/const vus = new Set\(\)/.test(z) && /nouveauDetail \? /.test(z),
    'le détail d\'une règle ne se répète pas d\'une occurrence à l\'autre');
  // Les mêmes clients réénumérés quatre fois font croire à quatre problèmes différents.
  assert.ok(/derniersManquants/.test(z) && /memeListe/.test(z),
    'une liste de clients identique à la précédente se dit, elle ne se recopie pas');
  // Et la liste reste NOMMÉE quand elle change : on ne remplace pas l'information par un compte.
  assert.ok(/e\.manquants\.slice\(0, 8\)\.join\(', '\)/.test(z),
    'les noms doivent rester affichés quand la liste diffère');
});

t('9.4.6 : « Les relancer » est un bouton, et il emmène sur CES clients', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = app.indexOf('function drawEcheances(');
  const z = app.slice(i, app.indexOf('\n  }\n', i));
  // Un lien souligné au milieu d'une phrase n'est pas un geste.
  assert.ok(!/<a href="#\/relances">Les relancer<\/a>/.test(z), 'le lien doit être devenu un bouton');
  assert.ok(/<button class="btn btn-sm" data-relq=/.test(z), 'et ce bouton doit exister');
  // Il POSE la sélection avant de naviguer : nommer onze clients et en ouvrir soixante, c'est la
  // promesse non tenue de la 7.15.0.
  assert.ok(/relState\.seulement = e \? e\.manquants\.slice\(\) : null/.test(z),
    'le bouton doit poser la sélection');
  assert.ok(/vers\('#\/relances'\)/.test(z), 'et passer par `vers()` : `location.hash` vers la page courante ne redessine rien');

  // `vers()` et `toastUndo()` viennent de l'app entreprise et n'avaient JAMAIS été portés ici.
  assert.ok(/function vers\(hash\) \{[\s\S]{0,200}if \(location\.hash === hash\) render\(\);/.test(app),
    '`vers()` doit redessiner quand on vise la page où l\'on est déjà (7.15.0)');
  const iu = app.indexOf('function toastUndo(');
  const zu = app.slice(iu, app.indexOf('\n  }', iu));
  assert.ok(zu.length > 200 && zu.length < 1200, 'toastUndo : tranche de ' + zu.length + ' caractères');
  // `#toast` vit en `pointer-events: none` : sans la classe qui les relève, le bouton serait
  // parfaitement visible et parfaitement inerte (5.2.2, puis 7.12.0).
  assert.ok(/avec-bouton/.test(zu), 'le bandeau qui porte « Annuler » doit recevoir les clics');
  assert.ok(/8000/.test(zu), 'et durer plus longtemps qu\'un message ordinaire : comprendre son erreur prend du temps');

  const ir = app.indexOf('function drawRelances(');
  const zr = app.slice(ir, app.indexOf('\n  }\n', ir));
  // Le filtre porte sur TOUT l'écran : le bandeau, la liste et le geste de groupe (7.18.0).
  assert.ok(/const rows = filtre \? toutes\.filter/.test(zr), 'la liste doit suivre la sélection');
  assert.ok(/id="rl-tout"/.test(zr), 'et on doit pouvoir en sortir : un filtre sans issue est un piège');
  // La RÈGLE : le geste de groupe porte sur ce que l'écran MONTRE — jamais sur `toutes`. La
  // forme exacte a changé en 9.4.9 (la sélection cochée prime sur la page), et l'assertion
  // recopiait la ligne : elle est retournée vers la règle plutôt que rafistolée (7.16.0).
  const ligneG = (zr.match(/const g = \$\('#group'\);[^\n]*/) || [''])[0];
  assert.ok(/groupRelance\(/.test(ligneG), 'le bouton de groupe doit appeler groupRelance');
  assert.ok(!/\btoutes\b/.test(ligneG),
    '« Relancer » de groupe ne doit jamais porter sur la liste entière quand l\'écran est filtré');
  assert.ok(/\brows\b/.test(ligneG), 'il porte sur ce que l\'écran montre');
  // La sélection ne survit pas à la sortie des Relances.
  const iv = app.indexOf('function render() {');
  const zv = app.slice(iv, iv + 1800);
  // La RÈGLE : tout ce qui est un état de PARCOURS (le filtre venu d'une échéance, les clients
  // cochés) se vide en quittant les Relances. La 9.4.9 a ajouté la sélection ; l'assertion visait
  // la forme d'une seule ligne, elle vise maintenant ce qu'elle protège.
  const kq = zv.indexOf("route !== 'relances'");
  assert.ok(kq > 0, 'rien ne nettoie l\'état de parcours des Relances');
  const zq = zv.slice(kq, kq + 300);
  assert.ok(/relState\.seulement = null/.test(zq), 'le filtre venu d\'une échéance doit se vider');
  assert.ok(/relState\.coches\.clear\(\)/.test(zq), 'et les clients cochés aussi');
});

t('9.4.7 : les douze mois d\'une année, dans le sens du temps, et chacun dit ce qu\'il est', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  // Personne ne lit un calendrier à l'envers. `.reverse()` affichait « Août, Juillet, Juin, Mai,
  // Avril, Mars » sous une étiquette « 2026 » : le moteur rendait l'ordre juste, l'écran
  // l'inversait. Ce sont les ANNÉES qui vont de la plus récente à la plus ancienne.
  assert.ok(/const months = K\.dossierMonths\(dossier\);/.test(app),
    'les mois gardent l\'ordre du temps que leur donne le moteur');
  assert.ok(/const years = \[\.\.\.new Set\(months\.map\(m => m\.month\.slice\(0, 4\)\)\)\]\.sort\(\)\.reverse\(\);/.test(app),
    'les années, elles, vont de la plus récente à la plus ancienne');
  // L'année ENTIÈRE : six mois sous une étiquette « 2026 » ne disaient pas si la mission
  // commençait là ou si l'application avait perdu les autres.
  assert.ok(/const MOIS_COURTS = \[/.test(app) && /MOIS_COURTS\.map\(\(nom, k\) =>/.test(app),
    'la grille doit dessiner les douze mois');
  assert.ok(/'hors mission'/.test(app) && /'en cours'/.test(app) && /'à venir'/.test(app),
    'un mois hors mission doit DIRE pourquoi il ne compte pas — y compris le mois où l\'on est');
  // Un mois qui NOMME un manque porte le geste qui va avec (7.15.0). Cinq cartouches rouges et
  // aucun bouton, c'est un écran qui décrit un problème sans offrir d'y répondre.
  assert.ok(/data-relm="\$\{esc\(m\.month\)\}"/.test(app), 'un mois manquant doit porter sa relance');
  const ib = app.indexOf("$$('[data-relm]', view)");
  assert.ok(ib > 0, 'et elle doit être branchée : un bouton inerte est pire qu\'un bouton absent');
  const zb = app.slice(ib, ib + 400);
  assert.ok(/missingMonths: \[c\.dataset\.relm\]/.test(zb),
    'la relance part sur CE mois-là, pas sur tous : nommer un mois et en réclamer six est une promesse non tenue');
  // Un mois reçu avant que les paquets ne soient rangés n'a rien à ouvrir : le bouton le DIT
  // au lieu d'accepter le clic sans agir (7.21.0).
  assert.ok(/: 'Reçu avant que les paquets ne soient rangés sur le disque : rien à ouvrir\.'/.test(app),
    'un mois sans fichier doit dire pourquoi');
  assert.ok(/\? 'disabled'/.test(app), 'et être désactivé plutôt qu\'inerte');
  // Une classe posée et inconnue de la feuille ne se voit nulle part (8.1.0).
  ['.mcell.hors', '.mcell[disabled]'].forEach(c =>
    assert.ok(css.includes(c), 'classe sans style : ' + c));
  // La grille est une VRAIE grille : c'est elle qui aligne mars 2025 au-dessus de mars 2026.
  assert.ok(/\.mgrid \{ display: grid; grid-template-columns: repeat\(12/.test(css),
    'douze colonnes fixes, sinon rien ne s\'aligne d\'une année à l\'autre');
});

t('9.4.7 : un état vide SECONDAIRE s\'annonce, il ne se contemple pas', () => {
  const css = lireSource('src', 'renderer', 'style.css');
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  // 48 px et un cadre pointillé, c'est la bonne présence quand la page ENTIÈRE est vide — c'est
  // le premier écran. Au milieu d'une fiche pleine, le même bloc consacrait 250 px à « aucune
  // relance enregistrée » et repoussait tout le reste.
  assert.ok(/\.empty\.mini \{ padding: 14px 16px;/.test(css), 'l\'état vide secondaire doit exister');
  assert.ok(/\.empty \{ padding: 48px 24px;/.test(css), 'et le plein doit rester plein : une page vide a besoin de présence');
  // Ceux qui vivent DANS un panneau d'une page déjà pleine.
  // Les phrases sont citées ENTIÈRES, ponctuation comprise : « Aucun paquet reçu » tout court
  // tombait d'abord sur « Aucun paquet reçu pour l'instant… », qui est le corps d'un onglet et a
  // raison de garder sa présence. Un test trop large accuse du code juste, exactement comme un
  // test trop étroit (9.1.0).
  ['Aucune relance enregistrée pour ce client.', 'Aucun paquet reçu.</div>', 'Aucune écriture sur cette période.',
    'Rien en brouillard.', 'Rien dans les trois prochains mois.'].forEach(phrase => {
    const k = app.indexOf(phrase);
    assert.ok(k > 0, 'phrase introuvable : ' + phrase);
    assert.strictEqual(app.indexOf(phrase, k + 1), -1, 'phrase ambiguë, le test viserait la mauvaise : ' + phrase);
    assert.ok(app.slice(Math.max(0, k - 120), k).includes('empty mini'),
      `« ${phrase} » vit dans un panneau : il doit porter « empty mini »`);
  });
  // Et ceux qui SONT le corps d'un écran gardent leur présence — un état vide rétréci sur une
  // page vide serait l'excès inverse.
  ['Aucun dossier ne correspond à cette recherche', 'La saisie a besoin d\'un livre'].forEach(phrase => {
    const k = app.indexOf(phrase);
    assert.ok(k > 0, 'phrase introuvable : ' + phrase);
    assert.ok(!app.slice(Math.max(0, k - 120), k).includes('empty mini'),
      `« ${phrase} » est le corps de son écran : il garde sa présence`);
  });
});

t('9.4.8 : les finitions — la case, l\'unité, la liste fermée, le compteur d\'écrans', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  const partage = lireSource('src', 'renderer', 'style.css');

  // Y2 — la case AVANT son libellé. Dans une grille `span-2`, l'écrire après la posait 500 px à
  // droite du texte qu'elle coche : l'œil la cherche à gauche et ne la trouve pas.
  ['sr-datec', 'sr-lot'].forEach(id => {
    const k = app.indexOf('id="' + id + '"');
    assert.ok(k > 0, 'case introuvable : ' + id);
    const avant = app.slice(Math.max(0, k - 220), k);
    assert.ok(avant.includes('<label class="check span-2">'), id + ' : étiquette introuvable');
    assert.ok(!/\$\{lbl\(/.test(avant.slice(avant.indexOf('<label class="check span-2">'))),
      id + ' : la case doit venir AVANT son libellé');
  });

  // Y7 — « Jour de relance : 10 » ne disait pas dix quoi, et c'est la date qui déclenche les
  // relances de tout un portefeuille.
  ['c-day', 'w-day'].forEach(id => {
    const k = app.indexOf('id="' + id + '"');
    assert.ok(k > 0, 'champ introuvable : ' + id);
    const autour = app.slice(Math.max(0, k - 200), k + 200);
    assert.ok(/suffixe-av">le</.test(autour) && /suffixe-ap">de chaque mois</.test(autour),
      id + ' : le champ doit dire dans quelle unité il compte');
  });
  assert.ok(/\.suffixe \{ display: inline-flex/.test(partage), 'le suffixe doit exister dans la feuille');

  // Y10 — une liste fermée ne se saisit jamais en texte libre (7.30.0) : « VTE » au lieu de
  // « VT » ne correspondait à aucun journal, et la grille s'ouvrait sur le premier venu.
  const kj = app.indexOf('id="sr-journal"');
  assert.ok(kj > 0 && app.slice(kj - 40, kj).includes('<select'), 'le journal proposé doit être une liste');
  const ijc = app.indexOf('function journauxConnus()');
  const zjc = app.slice(ijc, app.indexOf('\n  }', ijc));
  assert.ok(/JOURNAUX_PAR_DEFAUT/.test(zjc), 'la liste vient du moteur, pas de codes écrits à la main');
  // Un `select` dont aucune option ne correspond retient la PREMIÈRE, en silence (8.3.0) : le
  // code déjà réglé doit rester dans la liste, sinon rouvrir les Réglages l'efface.
  assert.ok(/if \(regle\) vus\.add\(regle\)/.test(zjc), 'le code déjà réglé ne doit pas disparaître de la liste');

  // Y8 — cinq pastilles muettes disent qu'il y a des écrans, pas combien il en reste. Et le
  // compte se DÉDUIT : écrit à la main il mentirait au premier écran ajouté.
  // 10.14.0 — « Question 1 sur 2 » : la porte n'est pas une question, le compte se déduit toujours.
  assert.ok(/Question \$\{[^}]+\+ 1\} sur \$\{QUESTIONS\}/.test(app), 'l\'assistant doit dire où l\'on en est');
  // La règle générale des pastilles vise TOUS les `span` : sans l'exception, le compteur devient
  // une barre de 26×4 px sans texte visible (famille du `th.r`, 7.23.0).
  assert.ok(/#setup \.wiz-dots span:not\(\.wiz-compte\)/.test(css),
    'le compteur doit échapper à la règle des pastilles');
  assert.ok(/#setup \.wiz-compte \{/.test(css), 'et porter son propre style');
});

t('9.4.8 : un geste rare vit dans le menu, un manque porte le bouton qui le comble', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const rm = lireSource('src', 'renderer', 'rowmenu.js');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');

  // Y5 — un en-tête de fiche a un budget de boutons, comme une ligne de liste (7.29.0).
  assert.ok(!/<button class="btn" id="print">Imprimer<\/button>/.test(app),
    '« Imprimer » ne doit plus occuper une place premium');
  assert.ok(/RowMenu\.bouton\('F:' \+ dossier\.id/.test(app), 'l\'en-tête doit porter un menu d\'actions');
  // Le bouton seul et la cellule sortent de la MÊME fonction : une seconde version recopiée
  // aurait perdu `aria-expanded` ou `data-rowmenu` au premier ajustement (7.29.0).
  assert.ok(/const cellule = \(id, avant\) => `<td class="actions row-actions">\$\{avant \|\| ''\}\$\{bouton\(id, 'Actions'\)\}<\/td>`;/.test(rm),
    'la cellule doit passer par `bouton`, sinon les deux divergent');
  assert.ok(/bouton, brancherMenus \};/.test(rm), 'et `bouton` doit être exporté');

  // UNE seule table d'actions par racine : `bindRowMenus` écrase le gestionnaire précédent, donc
  // une seconde table rendrait la première parfaitement inerte, sans une erreur nulle part.
  const id = app.indexOf('function drawDossier(');
  const zd = app.slice(id, app.indexOf('\n  async function', id) > id ? app.indexOf('\n  async function', id) : id + 30000);
  const n = (zd.match(/bindRowMenus\(view,/g) || []).length;
  assert.strictEqual(n, 1, `la fiche doit avoir UNE table d'actions, elle en a ${n}`);
  assert.ok(/if \(cle === 'F:' \+ dossier\.id\)/.test(zd), 'et cette table doit servir les deux clés');

  // Mineur — un manque annoncé porte le bouton qui le comble (7.20.0).
  assert.ok(/class="lien-manque" data-ident="1">email à renseigner</.test(app)
    && /class="lien-manque" data-ident="1">téléphone à renseigner</.test(app),
  'les deux manques doivent être cliquables');
  assert.ok(/\$\$\('\[data-ident\]', view\)\.forEach/.test(app), 'et branchés');
  assert.ok(/\.lien-manque \{/.test(css), 'et se voir : un bouton se reconnaît AU REPOS');

  // Mineur — la colonne « Taille » n'apprend rien à un comptable ; le poids reste en infobulle.
  // La tranche est celle du tableau des PAQUETS : la taille d'une sauvegarde, elle, est
  // légitime — c'est ce qui dit qu'elle n'est pas vide. Un test qui vise « Taille » partout
  // accuse du code juste (9.4.7, deuxième fois).
  const ip = app.indexOf("<th class=\"r nw\">Chiffre d'affaires</th>");
  assert.ok(ip > 0, 'le tableau des paquets est introuvable');
  const zp = app.slice(ip, app.indexOf('</tfoot>', ip));
  assert.ok(zp.length > 800 && zp.length < 4000, 'tableau des paquets : tranche de ' + zp.length + ' caractères');
  assert.ok(!/>Taille</.test(zp), 'la colonne Taille doit avoir disparu du tableau des paquets');
  assert.ok(/title="\$\{esc\('Poids du fichier : ' \+ fmtBytes\(p\.bytes\)\)\}"/.test(app),
    'mais le poids reste lisible là où il sert');
  // Mineur — le geste qui allonge un tableau vit SOUS ce tableau, pas dans la barre qui clôt.
  assert.ok(/<div class="sous-table"><button class="btn btn-sm" id="sr-corr-add">/.test(app),
    '« Ajouter une ligne » appartient au tableau, pas à la barre d\'enregistrement');
  assert.ok(/\.sous-table \{/.test(css), 'classe sans style : .sous-table');
});

t('9.4.9 : chaque écran finit par le geste suivant', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  // Le métier du Cabinet est une BOUCLE : un paquet arrive → je vérifie → j'écris les écritures →
  // j'exporte → je relance qui n'a rien envoyé. Elle était éclatée sur quatre pages sans lien.
  // C'est la règle que l'Aide de l'app entreprise applique depuis la 7.27.0 (« chaque article
  // finit par un geste ») et qu'aucune page du Cabinet n'appliquait.
  const ir = app.indexOf('function drawRelances(');
  const zr = app.slice(ir, app.indexOf('\n  }\n', ir));
  assert.ok(/label: 'Ouvrir sa comptabilité'/.test(zr) && /\/comptabilite'/.test(zr),
    'depuis une relance, on doit pouvoir voir ce qu\'on a déjà de ce client');

  // Depuis un paquet reçu, rien ne menait à ses écritures — le geste qui suit précisément
  // l'arrivée d'un mois.
  const ip = app.indexOf('label: \'Accuser réception\'');
  assert.ok(ip > 0, 'le menu d\'un paquet est introuvable');
  const zp = app.slice(ip, ip + 900);
  assert.ok(/Créer le livre de ce client/.test(zp) && /Voir ses écritures/.test(zp),
    'un paquet doit mener aux écritures — et le libellé doit dire s\'il y a déjà un livre');

  // Depuis le livre d'UN client, rien ne menait à l'export qui regroupe TOUS les clients.
  const ib = app.indexOf('const barreLivres = ');
  const zb = app.slice(ib, ib + 1400);
  assert.ok(/id="lv-tous"/.test(zb), 'le livre doit mener à l\'export groupé');
  // Et le libellé décrit l'écran d'ARRIVÉE (T-42) : « Regrouper tous les clients… » se lisait comme
  // « un sous-compte par client », deux lecteurs sur deux. Un geste qui change de page l'annonce.
  assert.ok(/id="lv-tous"[^>]*title="Quitte ce dossier/.test(zb), 'le bouton ne dit pas qu\'il quitte le dossier');
  assert.ok(/Exporter les écritures de tous les clients/.test(zb) && !/Regrouper tous les clients/.test(zb), 'le libellé promet un regroupement qu\'il ne fait pas');
  assert.ok(/tt\.onclick = \(\) => vers\('#\/ecritures'\)/.test(app),
    'et par `vers()` : `location.hash` vers la page courante ne redessine rien (7.15.0)');
});

t('9.4.9 : on relance une SÉLECTION, pas tout le monde ou personne', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  const ir = app.indexOf('function drawRelances(');
  const zr = app.slice(ir, app.indexOf('\n  }\n', ir));
  assert.ok(/data-sel="\$\{esc\(r\.id\)\}"/.test(zr), 'chaque ligne doit porter sa case');
  assert.ok(/id="rl-all"/.test(zr), 'et l\'en-tête doit pouvoir tout cocher');
  // La case d'en-tête porte sur ce que l'écran MONTRE : sous filtre, cocher soixante clients
  // pendant que le bandeau en annonce onze serait exactement le chiffre qui ment (7.16.0).
  const ka = app.indexOf("const all = $('#rl-all')");
  const za = app.slice(ka, ka + 500);
  // 10.14.0 — la liste se pagine : ce que l'écran montre est la PAGE (`rowsPage`), jamais la
  // sélection entière (`rows`) ni la liste de tout le monde (`toutes`).
  assert.ok(/rowsPage\.forEach/.test(za) && !/\brows\.forEach/.test(za) && !/toutes\.forEach/.test(za),
    'la case d\'en-tête coche ce que l\'écran montre, jamais la liste entière');
  // Une coche posée sur un client qui a envoyé son mois entre-temps n'a plus de sens.
  assert.ok(/relState\.coches = new Set\(\[\.\.\.relState\.coches\]\.filter/.test(zr),
    'les coches périmées doivent tomber : on ne relance pas quelqu\'un qui n\'a plus rien à envoyer');
  assert.ok(/\.sel-col \{/.test(css), 'classe sans style : .sel-col');
});

t('9.4.9 : une courbe d\'une barre sur douze n\'est pas une courbe', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const css = lireSource('src', 'cabinet', 'renderer', 'cabinet.css');
  const ic = app.indexOf('function caChart(');
  const zc = app.slice(ic, app.indexOf('\n  }', ic));
  assert.ok(zc.length > 800 && zc.length < 3000, 'caChart : tranche de ' + zc.length + ' caractères');
  // 200 px de haut pour une ou deux barres et onze « pas reçu » : l'information réelle EST le
  // chiffre, et le fait qu'il ne porte que sur deux mois — ce qu'aucun graphique ne dit aussi
  // clairement qu'une phrase.
  assert.ok(/if \(recus < 3\)/.test(zc), 'sous trois mois reçus, la courbe doit céder la place au chiffre');
  assert.ok(/ca-maigre/.test(zc) && /\.ca-maigre \{/.test(css), 'et ce chiffre doit avoir son style');
  // Mais il DIT sur quoi il porte : un total sans sa période est un agrégat qui ment (3.1.0).
  assert.ok(/sur \$\{pl\(recus, 'mois', 'mois'\)\} seulement/.test(zc),
    'le chiffre doit dire sur combien de mois il porte');
  assert.ok(/nommes/.test(zc), 'et lesquels');
  // Au-delà, la courbe des douze mois reste — avec les mois non reçus estompés.
  assert.ok(/ca-col\$\{v == null \? ' off' : ''\}/.test(zc), 'les douze mois restent dessinés au-delà de trois');
});

t('9.4.9 : une explication vit dans la bulle du titre, pas en prose sous le tableau', () => {
  const app = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const g = lireSource('src', 'cabinet', 'renderer', 'cabguide.js');
  // Une prose grise sous chaque tableau remplace la découvrabilité : on la lit une fois, et elle
  // reste pour toujours. La bulle du titre est là où on la cherche quand on ne sait pas.
  assert.ok(!/Le bouton « Actions » de chaque ligne ouvre ce qu'on peut faire du mois/.test(app),
    'la prose sous le tableau des paquets doit avoir disparu');
  assert.ok(g.includes("'p.actions'"), 'son contenu doit vivre dans une bulle');
  assert.ok(/<h2>Paquets reçus \$\{info\('p\.actions'\)\}<\/h2>/.test(app),
    'et cette bulle doit être posée sur le TITRE du panneau');
  // 10.12.0 (U-25) — l'assertion d'avant exigeait DEUX bulles collées sur ce titre : elle décrivait
  // l'état du jour. Deux « i » côte à côte se lisent comme un seul, et le second ne s'ouvre qu'en
  // visant au pixel. Celle des pièces vérifiées vit sur SA colonne (7.0.0), et aucun titre de
  // l'une ou l'autre application ne porte deux bulles d'affilée.
  assert.ok(/<th[^>]*>Vérifiées \$\{info\('p\.integrity'\)\}<\/th>/.test(app),
    'la bulle des pièces vérifiées doit vivre sur la colonne « Vérifiées »');
  const ent = lireSource('src', 'renderer', 'app.js');
  [['Cabinet', app], ['entreprise', ent]].forEach(([nom, src]) => {
    const colle = /\$\{info\('[^']+'\)\}\s*\$\{info\(/.exec(src);
    assert.ok(!colle, `${nom} : deux bulles « i » collées : ${colle && colle[0]}`);
  });
  // Et les deux bulles qu'elle absorbe ne doivent pas rester orphelines : une entrée de guide
  // qu'aucun écran ne pose est une entrée morte, et c'est le test des bulles qui le dit.
  assert.ok(!g.includes("'p.extract'") && !g.includes("'p.delete'"),
    'les bulles absorbées doivent être retirées, pas laissées sans endroit où s\'afficher');
});

t('9.4.2 : la ponctuation double porte une espace insécable', () => {
  const src = lireSource('src', 'cabinet', 'renderer', 'app.js');
  const i = src.indexOf('function typographie(');
  assert.ok(i > 0, 'la passe typographique est introuvable');
  const zone = src.slice(i, i + 700);
  // On travaille sur les NŒUDS DE TEXTE : toucher au HTML casserait une balise un jour.
  assert.ok(/createTreeWalker\([^)]*NodeFilter\.SHOW_TEXT\)/.test(zone),
    'seuls les nœuds de texte sont touchés, jamais les balises');
  // 10.14.0 — la règle vit dans `typoTexte`, que la passe APPELLE — et la phrase de la grille aussi,
  // qui se pose par `textContent` à la frappe. Elle s'écrit en échappement : l'outil d'édition pose
  // sinon le caractère réel, que personne ne peut relire (9.2.1).
  assert.ok(/n\.nodeValue = typoTexte\(t\)/.test(zone), 'la passe sur la prose ne passe plus par la règle commune');
  const j = src.indexOf('const typoTexte = ');
  const regle = j > 0 ? src.slice(j, src.indexOf('\n', j)) : '';
  assert.ok(/'\\u202f\$1'/.test(regle) && /'«\\u202f'/.test(regle), 'l\'espace fine insécable (U+202F) est celle de la typographie française');
  // Et elle est APPELÉE — un mécanisme sans appelant est invisible (7.3.0). Trois portes : la page,
  // l'assistant (hors de #view) et les fenêtres.
  const appels = (src.match(/\btypographie\(/g) || []).length;
  assert.ok(appels >= 4, 'la passe doit être appelée sur la page, l\'assistant ET les fenêtres (vu : ' + appels + ')');
});

};
