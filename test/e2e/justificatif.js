// Le justificatif se joint AVANT toute saisie (8.5.1).
//
// Le bug tel que le père de Skander l'a vécu, rejoué dans l'application réelle : sur une facture
// d'achat NEUVE, joindre une photo ne doit demander ni fournisseur, ni ligne, ni « joindre quand
// même ? » ; le fichier doit se voir tout de suite, partir avec l'enregistrement, se retrouver sur
// le disque et dans la liste ; une pièce abandonnée ne doit pas laisser de copie ; et la lecture
// d'une photo doit redessiner la page SANS perdre la pièce en cours.
//
// Le sélecteur de fichier est natif : on le remplace dans le PROCESSUS PRINCIPAL (comme
// e2e:boucle avec le fichier d'appairage), et c'est le vrai chemin — copie, liste, enregistrement —
// qui s'exécute.
//
//   xvfb-run -a node test/e2e/justificatif.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

(async () => {
  const j = journal(); const bac = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-justif-'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-justif-fichiers-'));
  const photo = path.join(tmp, 'facture-fournisseur.jpg');
  fs.writeFileSync(photo, Buffer.from('ffd8ffe000104a464946' + '00'.repeat(2000), 'hex'));
  const pdf = path.join(tmp, 'devis-signe.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n% un faux PDF suffit : on ne le lit pas, on le copie\n');

  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);
  const aller = async hash => { await win.evaluate(x => { location.hash = x; }, hash); await win.waitForTimeout(350); };
  const doit = (c, quoi) => { if (!c) throw new Error('ÉCHEC — ' + quoi); };
  // Le prochain sélecteur de fichier rendra ce chemin, sans rien afficher.
  const prochainFichier = async f => app.evaluate(({ dialog }, p) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] }); }, f);
  // Où l'application a copié un fichier de ce nom, s'il y est. La copie porte un préfixe
  // (horodatage + hasard, `safeName` dans storage.js) : on reconnaît la fin du nom.
  const copies = nom => {
    const out = [];
    const marche = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) marche(p); else if (e.name.endsWith('-' + nom)) out.push(p); } };
    marche(userData); return out;
  };

  j.etape('Une entreprise, et un fournisseur');
  await win.waitForSelector('#setup');
  for (let g = 0; g < 15 && await win.$('#setup'); g++) {
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Justificatif SUARL');
      await win.fill('#sf-form input[name=matricule]', '3344556Z/A/P/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next'); await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  // 10.12.0 — une liste VIDE ne montre ni recherche ni filtres : elle dit à quoi elle sert et donne
  // le geste qui la remplit. Quatre y échappaient encore (test humain) : Clients, Fournisseurs,
  // Achats, et les autres pièces. On le regarde sur une installation neuve, là où ça se voit.
  const videUtile = () => win.evaluate(() => {
    const v = document.querySelector('#view .vide-utile');
    return { filtres: !!document.querySelector('#view .filters'), titre: v ? v.querySelector('h2').textContent.trim() : null,
      boutons: v ? [...v.querySelectorAll('button:not(.i)')].map(b => b.id) : [] };
  });
  for (const [hash, bouton] of [['#/clients', 'vide-client'], ['#/fournisseurs', 'vide-fournisseur'], ['#/achats', 'vide-achat'], ['#/autres/proforma', 'vide-new']]) {
    await aller(hash);
    const v = await videUtile();
    doit(!v.filtres, `${hash} vide affiche encore une recherche et des filtres au-dessus de rien`);
    doit(v.titre && v.boutons.includes(bouton), `${hash} vide n'offre pas son geste (${bouton}) : ${JSON.stringify(v)}`);
  }
  j.ok('quatre listes vides : une phrase qui dit à quoi elles servent, et leur bouton');
  await aller('#/fournisseurs');
  await win.waitForSelector('#new'); await win.click('#new');
  await win.waitForSelector('#modal-root input[name=name]');
  await win.fill('#modal-root input[name=name]', 'Fournitures Test SARL');
  await win.fill('#modal-root input[name=matricule]', '1122334A');
  await win.click('#modal-root .modal-actions .btn-primary');
  await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
  const fournisseur = await win.evaluate(() => window.__data.suppliers[0]);
  doit(fournisseur && fournisseur.name === 'Fournitures Test SARL', 'fournisseur créé');
  // Le premier fournisseur fait apparaître la liste ET sa barre de recherche.
  await win.waitForSelector('#list-wrap table.list');
  doit(await win.$('#view .filters #q'), 'le premier fournisseur créé, la barre de recherche ne revient pas');
  j.ok('fournisseur créé : ' + fournisseur.name + ', et la liste prend sa barre de recherche');

  try {
    // ------------------------------------------------ 1. le bouton est là, seul, sans question
    j.etape('Sur un achat neuf, « Joindre un justificatif » est là avant toute saisie');
    await aller('#/achat/new');
    await win.waitForSelector('#attach-top');
    await win.waitForTimeout(300);
    doit(await win.isHidden('#photo'), 'sans clé de lecture, « Lire une photo » doit rester caché');
    doit(!(await win.$('#att-save-first')), 'plus de « enregistre d\'abord »');
    await win.waitForSelector('#attachments #add-att');
    j.ok('le bouton de la barre et celui du panneau sont là ; « Lire une photo » est caché sans clé');

    // ------------------------------------------------ 2. joindre sans rien avoir saisi
    j.etape('Joindre une photo sur la pièce vide : elle se voit, et rien n\'est enregistré');
    await prochainFichier(photo);
    await win.click('#attach-top');
    await win.waitForFunction(() => /facture-fournisseur\.jpg/.test((document.querySelector('#attachments') || {}).textContent || ''));
    doit(!(await win.$('#modal-root .modal')), 'aucune question posée');
    doit(await win.evaluate(() => window.__data.purchases.length) === 0, 'rien n\'a été enregistré : la pièce reste en cours de saisie');
    doit((await win.evaluate(() => location.hash)) === '#/achat/new', 'on est toujours sur la pièce neuve');
    doit(!(await win.isHidden('#dirty-dot')), 'la pièce se dit « non enregistrée »');
    doit(copies('facture-fournisseur.jpg').length === 1, 'le fichier a été copié à côté des données');
    j.ok('la photo est listée, copiée, la pièce n\'est pas enregistrée, aucune question');

    // ------------------------------------------------ 3. puis on saisit, on enregistre : le fichier suit
    j.etape('On saisit ensuite, on enregistre : le justificatif part avec la pièce');
    await win.evaluate(id => {
      const hid = document.querySelector('[data-combo=supplierId] input[type=hidden]');
      hid.value = id; hid.dispatchEvent(new Event('change', { bubbles: true }));
    }, fournisseur.id);
    await win.fill('#b-lines input[data-k=label]', 'Disques durs');
    await win.fill('#b-lines input[data-k=unitPrice]', '300');
    await win.waitForTimeout(200);
    await win.click('#save');
    await win.waitForFunction(() => /^#\/achat\/[^n]/.test(location.hash));
    await win.waitForSelector('#attachments');
    const range = await win.evaluate(() => window.__data.purchases[0]);
    doit(range && (range.attachments || []).length === 1 && range.attachments[0].name === 'facture-fournisseur.jpg',
      'la pièce enregistrée porte le justificatif : ' + JSON.stringify(range && range.attachments));
    doit(/facture-fournisseur\.jpg/.test(await win.textContent('#attachments')), 'et la fiche l\'affiche après enregistrement');
    j.ok('la pièce enregistrée porte le justificatif, sur le disque et à l\'écran');

    // 10.12.0 (H-E21) — un achat qu'on vient d'enregistrer a UN bouton principal, le règlement.
    // « Enregistrer » y restait vert sur une pièce inchangée, et le panneau des règlements posait un
    // second vert : deux principaux, dont aucun n'était l'étape suivante (vu au test humain).
    j.etape('Un achat enregistré : un seul vert, le règlement ; modifié, « Enregistrer » le reprend');
    const vertsAchat = () => win.evaluate(() => [...document.querySelectorAll('#view .btn-primary')].filter(b => b.offsetParent).map(b => b.id || b.textContent.trim()));
    const v1 = await vertsAchat();
    doit(v1.join() === 'pay', 'achat enregistré, boutons principaux : ' + JSON.stringify(v1) + ' — le règlement doit être le seul');
    await win.fill('#b-head input[name=subject]', 'Disques de sauvegarde');
    await win.waitForFunction(() => !document.querySelector('#dirty-dot').hidden);
    const v2 = await vertsAchat();
    doit(v2.join() === 'save', 'achat modifié, boutons principaux : ' + JSON.stringify(v2) + ' — « Enregistrer » doit redevenir le seul');
    await win.click('#save');
    await win.waitForFunction(() => { const d = document.querySelector('#dirty-dot'); return d && d.hidden; });
    const v3 = await vertsAchat();
    doit(v3.join() === 'pay', 'réenregistré, boutons principaux : ' + JSON.stringify(v3));
    j.ok('enregistré : le règlement seul en vert ; modifié : « Enregistrer » seul ; réenregistré : le règlement');

    // ------------------------------------------------ 4. la liste le dit
    j.etape('La liste des achats montre le trombone');
    await aller('#/achats');
    await win.waitForSelector('#list-wrap tbody tr');
    doit(/📎/.test(await win.textContent('#list-wrap tbody tr')), 'la ligne de la liste porte 📎');
    j.ok('📎 sur la ligne');

    // ------------------------------------------------ 5. joindre un second fichier sur la pièce rangée
    j.etape('Sur la pièce enregistrée, joindre un PDF : l\'écran ET les données le portent');
    await aller('#/achat/' + range.id);
    await win.waitForSelector('#attach-top');
    await prochainFichier(pdf);
    await win.click('#attach-top');
    await win.waitForFunction(() => /devis-signe\.pdf/.test((document.querySelector('#attachments') || {}).textContent || ''));
    const deux = await win.evaluate(() => (window.__data.purchases[0].attachments || []).map(a => a.name));
    doit(deux.length === 2 && deux.includes('devis-signe.pdf'), 'les données portent les deux fichiers : ' + deux.join(', '));
    j.ok('deux justificatifs, à l\'écran et dans les données');

    // ------------------------------------------------ 6. une pièce abandonnée ne laisse pas de copie
    j.etape('Une pièce neuve abandonnée après avoir joint : la copie est retirée, l\'original reste');
    await aller('#/achat/new');
    await win.waitForSelector('#attach-top');
    const orphelin = path.join(tmp, 'ticket-orphelin.jpg');
    fs.writeFileSync(orphelin, 'x');
    await prochainFichier(orphelin);
    await win.click('#attach-top');
    await win.waitForFunction(() => /ticket-orphelin\.jpg/.test((document.querySelector('#attachments') || {}).textContent || ''));
    doit(copies('ticket-orphelin.jpg').length === 1, 'copié pour la pièce neuve');
    await win.evaluate(() => { location.hash = '#/achats'; });
    await win.waitForSelector('#modal-root #b');   // « Quitter sans enregistrer »
    doit(/Quitter sans enregistrer/.test(await win.textContent('#modal-root .modal')), 'le garde-fou pose la question');
    await win.click('#modal-root #b');
    await win.waitForSelector('#list-wrap');
    await win.waitForTimeout(400);
    doit(copies('ticket-orphelin.jpg').length === 0, 'la copie a été retirée');
    doit(fs.existsSync(orphelin), 'l\'original n\'a pas bougé');
    doit(await win.evaluate(() => window.__data.purchases.length) === 1, 'et aucune pièce n\'a été créée');
    j.ok('copie retirée, original intact, rien d\'enregistré');

    // ------------------------------------------------ 7. la lecture d'une photo ne perd pas la pièce
    j.etape('La lecture d\'une photo redessine la page SANS perdre la pièce en cours');
    await aller('#/achat/new');
    await win.waitForSelector('#attach-top');
    await win.evaluate(() => {
      window.__ocrDemo = { supplier: 'Fournitures Test SARL', matricule: '1122334A', number: 'F-2026-77', date: '2026-09-10',
        lines: [{ label: 'Écrans 24 pouces', qty: 2, unitPrice: 450, vatRate: 19 }], totalHT: 900 };
      document.dispatchEvent(new Event('skanfact:ocr-demo'));
    });
    await win.waitForSelector('#modal-root #ok');
    doit((await win.evaluate(() => document.querySelector('#modal-root input[name=supplierId]').value)) === fournisseur.id, 'le fournisseur est reconnu par son matricule');
    await win.click('#modal-root #ok');
    await win.waitForFunction(() => !document.querySelector('#modal-root .modal'));
    await win.waitForTimeout(700);
    doit((await win.evaluate(() => location.hash)) === '#/achat/new', 'toujours sur la pièce neuve, pas sur une pièce enregistrée ni une autre page');
    doit((await win.inputValue('#b-head input[name=number]')) === 'F-2026-77', 'le numéro lu est dans le formulaire');
    doit((await win.inputValue('#b-lines input[data-k=label]')) === 'Écrans 24 pouces', 'la ligne lue est dans le tableau');
    doit((await win.evaluate(() => document.querySelector('[data-combo=supplierId] input[type=hidden]').value)) === fournisseur.id, 'le fournisseur lu est posé');
    doit(!(await win.isHidden('#dirty-dot')), 'la pièce se dit « non enregistrée »');
    doit(await win.evaluate(() => window.__data.purchases.length) === 1, 'rien n\'a été enregistré à la place de l\'utilisateur');
    j.ok('numéro, ligne et fournisseur lus sont à l\'écran ; la pièce n\'est pas enregistrée, la page n\'a pas changé');
    // On quitte proprement : la pièce lue est modifiée, le garde-fou demande, on renonce.
    await win.evaluate(() => { location.hash = '#/achats'; });
    await win.waitForSelector('#modal-root #b'); await win.click('#modal-root #b');
    await win.waitForSelector('#list-wrap');

    // ------------------------------------------------ 8. le même geste sur un document de vente
    j.etape('Un devis neuf : « Joindre un fichier » avant d\'enregistrer, et le fichier suit');
    await aller('#/doc/new/devis');
    await win.waitForSelector('#attachments #add-att');
    doit(!(await win.$('#att-save-first')), 'plus de « enregistre d\'abord » sur un document');
    const bon = path.join(tmp, 'bon-de-commande.pdf');
    fs.writeFileSync(bon, '%PDF-1.4\n');
    await prochainFichier(bon);
    await win.click('#attachments #add-att');
    await win.waitForFunction(() => /bon-de-commande\.pdf/.test((document.querySelector('#attachments') || {}).textContent || ''));
    doit(await win.evaluate(() => window.__data.documents.length) === 0, 'rien n\'est enregistré');
    j.ok('le fichier est listé sur le devis neuf, rien n\'est enregistré');
    await win.evaluate(() => { location.hash = '#/devis'; });
    await win.waitForSelector('#modal-root #b'); await win.click('#modal-root #b');
    // Sans aucun devis, la page n'a pas de tableau : on attend la page elle-même, pas sa liste.
    await win.waitForFunction(() => location.hash === '#/devis' && !document.querySelector('#modal-root .modal') && document.querySelector('#view h1'));
    await win.waitForTimeout(400);
    doit(copies('bon-de-commande.pdf').length === 0, 'abandonné : la copie est retirée');
    j.ok('abandonné : copie retirée');

    if (bac.length) throw new Error('erreurs dans le renderer :\n' + bac.join('\n'));
    console.log(`\n${j.total()} étapes — le justificatif se joint avant tout, se voit, suit la pièce, et ne survit pas à un abandon.`);
  } finally {
    // Une pièce restée « modifiée » fait poser la question à la fermeture, dans une fenêtre native
    // que personne ne peut cliquer ici : on répond « Fermer sans enregistrer » d'avance.
    try { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); } catch (_) {}
    try { await Promise.race([app.close(), new Promise((_, r) => setTimeout(() => r(new Error('fermeture bloquée')), 15000))]); } catch (e) { console.error(e.message); }
  }
})().catch(e => { console.error('\nÉCHEC :', e && e.message || e); process.exit(1); });
