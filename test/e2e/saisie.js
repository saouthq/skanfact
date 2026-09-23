// SkanFact Cabinet 9.3.0 — la grille de saisie, dans l'application RÉELLE, AU CLAVIER.
//
// Ce parcours existe parce qu'aucun test pur ne peut prouver ce qui compte ici : que la souris n'est
// jamais obligatoire, qu'un champ ne se détruit pas sous le curseur, et que Tab solde vraiment. Il
// tape donc une pièce entière comme un comptable la tape — `keyboard.type`, `keyboard.press`, et
// AUCUN clic dans la grille.
//
// Il vérifie aussi les trois refus qui font une comptabilité : une validée ne se modifie pas, ne se
// supprime pas, et un lot qui contient une pièce fausse ne troue pas la numérotation.
const { playwright, RACINE, ELECTRON, ongletCompta, ongletComptaPresent } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');
const OUT = process.argv[2] || path.join(RACINE, 'dist-e2e', 'saisie');
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-saisie-'));
const userData = path.join(dir, 'cab');
const errors = [];
let pas = 0;
const ok = m => console.log('  ✓ ' + m);
const étape = m => { pas++; console.log('\n' + pas + '. ' + m); };

(async () => {
  const app = await electron.launch({
    args: ['--no-sandbox', `--user-data-dir=${userData}`, path.join(RACINE, 'src', 'cabinet', 'main.js')],
    executablePath: ELECTRON, env: { ...process.env }
  });
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const attendre = (ms = 350) => win.waitForTimeout(ms);
  const shot = async nom => { await attendre(250); await win.screenshot({ path: path.join(OUT, nom + '.png') }); };
  await win.setViewportSize({ width: 1440, height: 900 });

  // Le livre relu depuis le processus principal : c'est la VÉRITÉ du disque, pas ce que l'écran
  // affiche. Les deux doivent dire la même chose, et c'est ce qu'on vérifie.
  const livre = () => win.evaluate(async () => {
    const id = decodeURIComponent((location.hash.split('/')[2] || ''));
    const a = document.querySelector('#lv-annee');
    const r = await window.cabinet.livre(id, a ? a.value : String(new Date().getFullYear()));
    return r.livre;
  });

  // ---------------------------------------------------------------- 1. ouvrir, charger l'exemple
  étape('Ouvrir le cabinet et charger l\'exemple');
  await win.waitForSelector('#lock-form');
  await win.fill('#lock-pw', 'mot-de-passe-cabinet');
  await win.fill('#lock-pw2', 'mot-de-passe-cabinet');
  await win.click('#lock-go');
  await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  // L'assistant peut revenir tant que le cabinet n'est pas renseigné — y compris après un
  // rechargement. On le traverse par une fonction, pas à la main : le recopier deux fois, c'est la
  // garantie que l'un des deux se périmera au prochain écran ajouté (règle 7.29.0).
  const passerAssistant = async () => {
    for (let g = 0; g < 14 && await win.$('#setup'); g++) {
      if (await win.$('#w-name')) await win.fill('#w-name', 'Cabinet Saisie');
      if (await win.$('#w-skip')) await win.click('#w-skip'); else if (await win.$('#w-next')) await win.click('#w-next');
      await attendre(300);
    }
    await win.waitForFunction(() => !document.querySelector('#setup'), { timeout: 15000 });
  };
  await win.waitForSelector('#setup', { timeout: 10000 });
  await passerAssistant();
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('#demo-on', { timeout: 8000 });
  await win.click('#demo-on');
  await win.waitForSelector('tr[data-id]', { timeout: 20000 });
  ok('cabinet ouvert, exemple chargé');

  // Le dossier sur lequel on va saisir : celui qui a le plus de paquets, donc un vrai livre.
  const cible = await win.evaluate(() => {
    const l = [...document.querySelectorAll('tr[data-id]')].map(tr => tr.dataset.id);
    return l[0];
  });
  await win.evaluate(id => { location.hash = '#/dossier/' + encodeURIComponent(id) + '/comptabilite'; }, cible);
  await win.waitForSelector('#c-livres', { timeout: 15000 });
  await win.waitForFunction(() => {
    const e = document.querySelector('#c-livres');
    return e && !e.textContent.includes('Lecture des paquets');
  }, { timeout: 30000 });

  // Un dossier neuf n'a PAS de livre, et l'application ne doit surtout pas en créer un en silence :
  // elle propose deux gestes nommés. On prend celui du client déjà sur SkanFact — le cas courant.
  // C'est aussi ce qui prouve que la Saisie n'apparaît qu'une fois le livre ouvert : elle n'aurait
  // aucun sens avant, et un onglet qui mène à « il n'y a rien » est un onglet mort.
  if (await win.$('#lv-relire')) {
    if (await ongletComptaPresent(win, 'saisie')) {
      throw new Error('l\'onglet Saisie s\'affiche alors que le dossier n\'a pas encore de livre');
    }
    await win.click('#lv-relire');
    await win.waitForSelector('.modal-bg', { timeout: 30000 });
    await win.click('.modal-bg .btn-primary');
    await attendre(600);
    ok('livre créé à partir des paquets reçus');
  }
  // 10.12.0 (U-06) — les écrans du livre sont rangés en groupes : on attend que le livre soit là
  // (le sélecteur de groupes n'existe qu'avec un livre), puis on trouve l'écran par ses groupes.
  await win.waitForSelector('#c-groupes', { timeout: 25000 });
  if (!(await ongletComptaPresent(win, 'saisie'))) throw new Error('le livre est ouvert et l\'écran « Saisie » reste introuvable');
  ok('la fiche du dossier ouvre sur sa comptabilité, et l\'onglet Saisie est là');

  // 10.12.0 (H-4, vu au test humain) — les pièces du livre-journal gardent leur menu d'actions, y
  // compris quand le livre est DÉJÀ en mémoire : la table de la fiche, liée APRÈS le journal sur
  // toute la vue, retirait leurs boutons. Rejoué comme un comptable : l'onglet Suivi, puis retour à
  // la comptabilité — c'est ce retour qui trouve le livre en mémoire.
  await ongletCompta(win, 'journal');
  await win.waitForSelector('#c-livres tbody [data-rowmenu]', { timeout: 15000 });
  const menusDuJournal = () => win.evaluate(() => document.querySelectorAll('#c-livres tbody [data-rowmenu]').length);
  const menusAvant = await menusDuJournal();
  await win.click('#d-tabs button[data-tab="suivi"]');
  await win.waitForSelector('section[data-onglet="suivi"]:not([hidden])', { timeout: 8000 });
  await win.click('#d-tabs button[data-tab="comptabilite"]');
  await win.waitForSelector('#c-livres .c-nav', { timeout: 15000 });
  await attendre(500);
  const menusApres = await menusDuJournal();
  if (!menusAvant) throw new Error('le livre-journal n\'a aucun menu d\'actions à sa première ouverture');
  if (menusApres !== menusAvant) throw new Error(`le livre-journal a perdu ses menus d'actions au retour sur la comptabilité (${menusAvant} → ${menusApres})`);
  ok(`le livre-journal garde ses ${menusAvant} menus d'actions, livre en mémoire compris`);

  // 10.12.0 (H-6) — la barre des groupes ne saute pas d'un groupe à l'autre. L'alerte « ces livres
  // sont incomplets », qui se tait sur la Saisie (U-01), était posée AU-DESSUS de la barre : la
  // barre descendait dans « Consulter » et remontait dans « Saisir », sous le pointeur.
  const hautDeLaBarre = () => win.evaluate(() => {
    const v = document.querySelector('#view'); if (v) v.scrollTop = 0;
    return Math.round(document.querySelector('#c-livres .c-nav').getBoundingClientRect().top);
  });
  if (!(await win.$('#c-livres .c-alerte'))) throw new Error('le dossier choisi n\'a pas d\'alerte de complétude : cette étape ne prouverait rien');
  const hautConsulter = await hautDeLaBarre();
  await win.click('#c-groupes button[data-groupe="saisir"]');
  await win.waitForSelector('#c-groupes button[data-groupe="saisir"].active', { timeout: 8000 });
  const hautSaisir = await hautDeLaBarre();
  if (hautConsulter !== hautSaisir) throw new Error(`la barre des groupes saute de ${hautConsulter - hautSaisir} px en passant de Consulter à Saisir`);
  ok(`la barre des groupes reste à sa place d'un groupe à l'autre (${hautSaisir} px), alerte comprise`);

  // ---------------------------------------------------------------- 2. une pièce entière au clavier
  étape('Taper une pièce ENTIÈRE au clavier, sans toucher la souris dans la grille');
  await ongletCompta(win, 'saisie');
  await win.waitForSelector('#sa-lignes', { timeout: 10000 });
  await shot('01-grille-vide');

  const annee = await win.evaluate(() => (document.querySelector('#lv-annee') || {}).value || String(new Date().getFullYear()));

  // Le journal et la date : le seul clic autorisé est celui qui place le curseur au départ.
  await win.selectOption('#sa-journal', 'VT');
  await win.click('#sa-date');
  await win.keyboard.type('4/3');                    // saisie tolérante : jour/mois
  await win.keyboard.press('Tab');
  await attendre(200);
  // L'assertion porte sur la RÈGLE — « 4/3 » désigne le 4 mars — et non sur la forme affichée :
  // jusqu'à la 9.4.5 elle exigeait l'ISO à l'écran, c'est-à-dire qu'elle décrivait le format
  // interne qui fuyait dans un champ de saisie. L'écran montre le jour en français ; c'est la
  // PIÈCE qui porte l'ISO, et le parcours vérifie les deux.
  const dateLue = await win.evaluate(() => document.querySelector('#sa-date').value);
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateLue)) throw new Error('la date doit s\'afficher en français : ' + dateLue);
  if (!dateLue.startsWith('04/03/')) throw new Error('« 4/3 » devrait donner le 4 mars, pas ' + dateLue);
  ok('« 4/3 » devient ' + dateLue + ' à l\'écran — l\'ISO est vérifié sur la pièce enregistrée, plus bas');

  // L'en-tête se descend à ENTRÉE, la même touche que la grille. Tab ne peut pas le faire : chaque
  // libellé porte sa bulle « i », qui est un vrai bouton et prend le focus au passage — c'est le
  // défaut que ce parcours a trouvé, et il n'apparaissait dans aucune console.
  // 10.12.0 (H-2) — le point « non enregistrée » apparaît à la frappe qui commence la pièce, et il
  // ne pousse RIEN : posé dans le flux, il décalait les trois rangées d'onglets sous la souris.
  const bordsDesOnglets = () => win.evaluate(() => [...document.querySelectorAll('#d-tabs button, #c-groupes button, #c-tabs button')]
    .map(b => { const r = b.getBoundingClientRect(); return Math.round(r.left) + ':' + Math.round(r.width); }).join(' '));
  const ongletsAvant = await bordsDesOnglets();
  await win.click('#sa-piece');
  await win.keyboard.type('FAC-E2E-1');
  await attendre(150);
  if (!(await win.evaluate(() => [...document.querySelectorAll('[data-sale]')].some(x => !x.hidden)))) {
    throw new Error('la pièce commencée n\'est signalée par aucun point');
  }
  const ongletsApres = await bordsDesOnglets();
  if (ongletsApres !== ongletsAvant) throw new Error('le point « non enregistrée » a décalé les onglets à la première frappe :\n  ' + ongletsAvant + '\n  ' + ongletsApres);
  ok('le point de la pièce commencée apparaît sans décaler un seul onglet');
  await win.keyboard.press('Enter');
  const apresPiece = await win.evaluate(() => (document.activeElement || {}).id);
  if (apresPiece !== 'sa-libelle') throw new Error('Entrée depuis la pièce n\'amène pas au libellé (focus : ' + apresPiece + ')');
  await win.keyboard.type('Vente de test');
  await win.keyboard.press('Enter');
  const apresLibelle = await win.evaluate(() => {
    const a = document.activeElement;
    return a && a.dataset ? (a.closest('tr') || {}).dataset.i + ':' + a.dataset.k : 'aucun';
  });
  if (apresLibelle !== '0:compte') throw new Error('Entrée depuis le libellé n\'amène pas à la première ligne (focus : ' + apresLibelle + ')');
  ok('l\'en-tête se descend à Entrée, de la date jusqu\'à la première ligne');

  // Les lignes. À partir d'ici : QUE du clavier.
  await win.keyboard.type('411');
  await win.keyboard.press('Escape');                // refermer la liste de suggestions
  await win.keyboard.press('Tab');                   // → intitulé (cellule morte) puis libellé
  await attendre(120);
  // On vise le champ par le clavier : Tab descend la ligne champ par champ.
  await win.keyboard.type('Client de test');
  await win.keyboard.press('Tab');
  await win.keyboard.type('1191');                   // débit
  await win.keyboard.press('Enter');                 // ligne suivante

  const focusApres = await win.evaluate(() => {
    const a = document.activeElement;
    return a && a.dataset ? (a.closest('tr') || {}).dataset.i + ':' + a.dataset.k : 'aucun';
  });
  if (focusApres !== '1:compte') throw new Error('Entrée n\'a pas descendu le curseur sur la ligne suivante (focus : ' + focusApres + ')');
  ok('Entrée descend le curseur sur la ligne suivante');

  await win.keyboard.type('706');
  await win.keyboard.press('Escape');
  await win.keyboard.press('Tab');
  await win.keyboard.type('Prestation');
  await win.keyboard.press('Tab');                   // débit
  await win.keyboard.press('Tab');                   // crédit
  await win.keyboard.type('1000');
  await win.keyboard.press('Enter');

  await win.keyboard.type('4367');
  await win.keyboard.press('Escape');
  await win.keyboard.press('Tab');
  await win.keyboard.type('TVA collectée');
  await win.keyboard.press('Tab');
  await win.keyboard.press('Tab');
  // Ici on NE tape pas le montant : Tab doit le poser.
  const avantSolde = await win.evaluate(() => document.querySelector('#sa-solde').textContent);
  if (!/Écart/.test(avantSolde)) throw new Error('le contrôle d\'équilibre ne signale pas l\'écart : ' + avantSolde);
  ok('l\'écart est annoncé pendant la frappe : ' + avantSolde.replace(/\s+/g, ' ').slice(0, 70));

  await win.keyboard.press('Tab');                   // ← le geste qui solde
  await attendre(250);
  const pose = await win.evaluate(() => {
    const tr = document.querySelector('#sa-lignes tr[data-i="2"]');
    return { d: tr.querySelector('input[data-k=debit]').value, c: tr.querySelector('input[data-k=credit]').value };
  });
  // 10.12.0 (H-3) — l'assertion exigeait « 191.000 » : elle gravait le défaut. En français, un point
  // entre des chiffres sépare les MILLIERS — « 250.000 » se lit deux cent cinquante mille. Tab écrit
  // le montant comme le reste de l'écran l'écrit (une assertion de plus retournée vers la règle).
  if (pose.c !== '191,000') throw new Error('Tab n\'a pas soldé la pièce en français (crédit posé : « ' + pose.c + ' », attendu 191,000)');
  if (pose.d) throw new Error('le solde s\'est posé au débit alors qu\'il manquait du crédit');
  ok('Tab pose « 191,000 » au crédit — en français, et dans la bonne COLONNE, pas avec un signe');

  const soldeTexte = await win.evaluate(() => document.querySelector('#sa-solde').textContent);
  if (!/Équilibrée/.test(soldeTexte)) throw new Error('la pièce n\'est pas annoncée équilibrée : ' + soldeTexte);
  ok('la pièce est annoncée équilibrée : ' + soldeTexte.replace(/\s+/g, ' ').slice(0, 60));
  await shot('02-piece-tapee');

  // ---------------------------------------------------------------- 3. brouillard, puis validation
  étape('Enregistrer en brouillard : pas de numéro tant qu\'on n\'a pas validé');
  await win.click('#sa-ok');
  await win.waitForSelector('tr[data-br]', { timeout: 10000 });
  let L = await livre();
  const mienne = L.ecritures.find(e => e.piece === 'FAC-E2E-1');
  if (!mienne) throw new Error('la pièce saisie n\'est pas dans le livre sur le disque');
  if (mienne.statut !== 'brouillard') throw new Error('la pièce est arrivée en ' + mienne.statut + ' au lieu de brouillard');
  if (mienne.numero !== null) throw new Error('un brouillard porte déjà le numéro ' + mienne.numero);
  if (mienne.lignes.length !== 3) throw new Error('la pièce a ' + mienne.lignes.length + ' lignes au lieu de 3');
  // L'autre moitié de la règle des dates : l'écran montre « 04/03/2026 », la PIÈCE porte l'ISO.
  if (!/^\d{4}-03-04$/.test(mienne.date)) throw new Error('la pièce devrait porter le 4 mars en ISO, elle porte ' + mienne.date);
  if (Math.abs(mienne.lignes[2].credit - 191) > 0.001) throw new Error('le montant soldé n\'a pas été enregistré');
  ok('enregistrée en brouillard, sans numéro, avec ses trois lignes');

  // Et la grille s'est VIDÉE en gardant journal et date : c'est la saisie au kilomètre.
  const suite = await win.evaluate(() => ({
    j: document.querySelector('#sa-journal').value,
    d: document.querySelector('#sa-date').value,
    p: document.querySelector('#sa-piece').value
  }));
  if (suite.j !== 'VT' || !suite.d) throw new Error('la grille a perdu le journal ou la date entre deux pièces');
  if (suite.p) throw new Error('la grille a gardé le numéro de pièce : on en refabriquerait un doublon');
  ok('la grille enchaîne : même journal, même date, pièce vide');

  // ---------------------------------------------------------------- 3 bis. ce que le test humain a vu
  // 10.12.0 (H-3, H-3 bis, H-8) — trouvés en tapant comme un comptable, jamais par un test :
  // « 12a » passait pour une ligne « sans montant », « 1 250,500 » valait zéro, la case refusée
  // perdait son rouge dès que la souris passait sur sa ligne, une date impossible n'était JAMAIS
  // rouge, et la fenêtre du refus prenait le curseur sans le rendre.
  étape('Un montant illisible se NOMME, reste rouge, et le refus rend le curseur à sa case');
  const cellule = (i, k) => `#sa-lignes tr[data-i="${i}"] input[data-k=${k}]`;
  // La couleur d'erreur telle que le navigateur la RÉSOUT à cet endroit (thème compris) : une sonde
  // posée à côté de la case, jamais une valeur écrite dans le test.
  const bordEtAttendu = sel => win.evaluate(s => {
    const d = document.querySelector(s);
    const sonde = document.createElement('span');
    sonde.style.borderTop = '1px solid var(--danger)';
    d.parentElement.appendChild(sonde);
    const attendu = getComputedStyle(sonde).borderTopColor;
    sonde.remove();
    return { bord: getComputedStyle(d).borderTopColor, attendu, ko: d.classList.contains('sa-ko'), aria: d.getAttribute('aria-invalid'),
      survol: !!d.closest('tr') && d.closest('tr').matches(':hover') };
  }, sel);
  await win.click(cellule(0, 'compte'));
  await win.keyboard.type('606');
  await win.keyboard.press('Escape');
  await win.click(cellule(0, 'debit'));
  await win.keyboard.type('12a');
  await win.click(cellule(1, 'compte'));
  await win.keyboard.type('532');
  await win.keyboard.press('Escape');
  await win.click(cellule(1, 'credit'));
  await win.keyboard.type('1 250,500');                // l'espace des milliers, comme on le tape
  await attendre(200);
  // Le motif vit sous les totaux (`#sa-refus`), et c'est le MÊME que celui des deux boutons éteints.
  const verdict = await win.evaluate(() => ({
    motif: (document.querySelector('#sa-refus') || {}).textContent || '',
    brouillard: document.querySelector('#sa-ok').disabled, titre: document.querySelector('#sa-ok').title
  }));
  if (!/Ligne 1 : « 12a » n'est pas un montant \(débit\)/.test(verdict.motif)) throw new Error('le montant illisible n\'est pas nommé : ' + verdict.motif);
  if (/aucun montant/.test(verdict.motif)) throw new Error('la ligne où l\'on a tapé « 12a » est dite « sans montant »');
  if (!verdict.brouillard || verdict.titre !== verdict.motif) throw new Error('le bouton du brouillard ne s\'éteint pas sur le même motif : ' + verdict.titre);
  const totalCredit = await win.evaluate(() => (document.querySelector('#sa-tc') || {}).textContent || '');
  if (!/^1[\s  ]250,500$/.test(totalCredit.trim())) throw new Error('« 1 250,500 » n\'est pas lu au crédit : ' + totalCredit);
  await win.hover(cellule(0, 'libelle'));
  await attendre(150);
  const survole = await bordEtAttendu(cellule(0, 'debit'));
  if (!survole.survol) throw new Error('la ligne de « 12a » n\'est pas survolée : l\'étape ne prouverait rien');
  if (!survole.ko || survole.aria !== 'true') throw new Error('la case « 12a » n\'est pas marquée fautive');
  if (survole.bord !== survole.attendu) throw new Error(`la case « 12a » perd son rouge au survol de sa ligne (${survole.bord} au lieu de ${survole.attendu})`);
  ok('« 12a » est nommé et reste rouge sous la souris ; « 1 250,500 » est lu au millime');

  await win.click(cellule(1, 'credit'));
  await win.keyboard.press('Control+Enter');
  await win.waitForSelector('.modal-bg', { timeout: 8000 });
  const refusDit = await win.evaluate(() => document.querySelector('.modal-bg .modal').innerText.replace(/\s+/g, ' '));
  if (!/« 12a » n'est pas un montant/.test(refusDit)) throw new Error('le refus ne nomme pas le montant illisible : ' + refusDit);
  await win.keyboard.press('Enter');
  await win.waitForFunction(() => !document.querySelector('.modal-bg'), { timeout: 8000 });
  // Lu sans présumer qu'il est dans une ligne : quand le défaut revient, le curseur est sur la PAGE,
  // et le parcours doit le dire dans sa phrase, pas tomber sur une erreur de lecture.
  const curseur = await win.evaluate(() => {
    const a = document.activeElement;
    const tr = a && a.closest ? a.closest('#sa-lignes tr') : null;
    return tr ? tr.dataset.i + ':' + a.dataset.k : (a ? a.tagName + (a.id ? '#' + a.id : '') : 'aucun');
  });
  if (curseur !== '0:debit') throw new Error('après le refus, le curseur n\'est pas dans la case « 12a » (focus : ' + curseur + ')');
  ok('le refus nomme « 12a », et le curseur revient dans sa case une fois la fenêtre fermée');

  await win.click('#sa-date');
  await win.keyboard.type('31/02/' + annee);
  await win.keyboard.press('Tab');
  await attendre(150);
  const dateRefusee = await bordEtAttendu('#sa-date');
  if (!dateRefusee.ko || dateRefusee.aria !== 'true') throw new Error('« 31/02 » n\'est pas marqué comme une date impossible');
  if (dateRefusee.bord !== dateRefusee.attendu) throw new Error(`une date impossible n'est pas rouge : la règle générale des champs l'écrase (${dateRefusee.bord})`);
  ok('« 31/02 » est refusé, et la case Date devient rouge — elle ne l\'avait jamais été');
  await win.click('#sa-date');
  await win.keyboard.type('4/3');
  await win.keyboard.press('Tab');
  await win.click('#sa-vider');
  await win.waitForFunction(() => ![...document.querySelectorAll('#sa-lignes input')].some(i => i.value), { timeout: 8000 });

  // 10.12.0 (H-5) — chaque dossier rouvre sur l'écran où on l'a laissé. Béji rouvrait sur le
  // livre-journal pendant que sa pièce attendait dans la Saisie ; un AUTRE dossier, lui, n'hérite
  // pas de la Saisie du premier.
  étape('Chaque dossier rouvre sur l\'écran de comptabilité où on l\'a laissé');
  const ouvrirComptaDe = async id => {
    await win.evaluate(() => { location.hash = '#/dossiers'; });
    await win.waitForSelector(`tr[data-id="${id}"]`, { timeout: 10000 });
    await win.click(`tr[data-id="${id}"] td.dl-client`);
    await win.waitForSelector('#d-tabs button[data-tab="comptabilite"]', { timeout: 10000 });
    if (!(await win.$('#d-tabs button[data-tab="comptabilite"].active'))) await win.click('#d-tabs button[data-tab="comptabilite"]');
    await win.waitForSelector('#c-livres', { timeout: 15000 });
    await win.waitForFunction(() => !document.querySelector('#c-livres').textContent.includes('Lecture des paquets'), { timeout: 30000 });
    await attendre(300);
    return win.evaluate(() => { const b = document.querySelector('#c-tabs button.active'); return b ? b.dataset.tab : '(aucun écran)'; });
  };
  await win.evaluate(() => { location.hash = '#/dossiers'; });
  await win.waitForSelector('tr[data-id]', { timeout: 10000 });
  const autre = await win.evaluate(c => [...document.querySelectorAll('tr[data-id]')].map(t => t.dataset.id).find(id => id !== c), cible);
  if (!autre) throw new Error('l\'exemple n\'a qu\'un dossier : l\'étape ne prouverait rien');
  const chezLAutre = await ouvrirComptaDe(autre);
  if (chezLAutre === 'saisie') throw new Error('un autre dossier s\'ouvre sur la Saisie du premier');
  const auRetour = await ouvrirComptaDe(cible);
  if (auRetour !== 'saisie') throw new Error('le dossier ne rouvre pas sur la Saisie où on l\'avait laissé (écran : ' + auRetour + ')');
  ok(`l'autre dossier s'ouvre sur « ${chezLAutre} », et le premier retrouve sa Saisie`);

  étape('Valider : le numéro naît ici, et l\'écriture ne se modifie plus');
  const avantNums = L.ecritures.filter(e => e.statut === 'validee').length;
  await win.evaluate(async id => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    const a = document.querySelector('#lv-annee');
    await window.cabinet.valider(d, a ? a.value : '', id);
  }, mienne.id);
  await attendre(400);
  L = await livre();
  const validee = L.ecritures.find(e => e.id === mienne.id);
  if (validee.statut !== 'validee') throw new Error('la validation n\'a pas pris');
  if (!validee.numero) throw new Error('la validation n\'a pas attribué de numéro');
  ok('validée sous le n° ' + validee.numero + ' (il y avait ' + avantNums + ' validées avant)');

  // Les deux refus, par le PONT — c'est-à-dire par le vrai chemin, pas par une imitation.
  const refusMod = await win.evaluate(async id => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    const a = document.querySelector('#lv-annee');
    try { await window.cabinet.modifierEcriture(d, a ? a.value : '', id, { libelle: 'trafiquée' }); return 'PASSÉ'; }
    catch (e) { return String(e.message || e); }
  }, mienne.id);
  if (refusMod === 'PASSÉ') throw new Error('une écriture VALIDÉE s\'est laissée modifier');
  if (!/contre-passe/.test(refusMod)) throw new Error('le refus ne dit pas quoi faire à la place : ' + refusMod);
  ok('modifier une validée est refusé, et le refus nomme la sortie');

  const refusSup = await win.evaluate(async id => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    const a = document.querySelector('#lv-annee');
    try { await window.cabinet.supprimerEcriture(d, a ? a.value : '', id); return 'PASSÉ'; }
    catch (e) { return String(e.message || e); }
  }, mienne.id);
  if (refusSup === 'PASSÉ') throw new Error('une écriture VALIDÉE s\'est laissée supprimer');
  ok('supprimer une validée est refusé aussi');

  L = await livre();
  if (L.ecritures.find(e => e.id === mienne.id).libelle !== 'Vente de test') {
    throw new Error('la validée a quand même bougé');
  }

  // ---------------------------------------------------------------- 4. le lot ne troue rien
  étape('Valider un lot qui contient une pièce fausse');
  // Deux bonnes et une fausse, posées par le pont (c'est le geste de saisie, déjà prouvé au clavier).
  const poser = (piece, credit) => win.evaluate(async o => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    const a = document.querySelector('#lv-annee');
    const r = await window.cabinet.saisir(d, a ? a.value : '', {
      date: o.date, journal: 'CA', piece: o.piece, libelle: 'lot',
      lignes: [{ compte: '54', debit: 100 }, { compte: '706', credit: o.credit }]
    });
    return r.id;
  }, { piece, credit, date: annee + '-06-10' });
  await poser('LOT-1', 100);
  const idFaux = await poser('LOT-2', 90);           // déséquilibrée exprès, AU MILIEU
  await poser('LOT-3', 100);

  const avant = (await livre()).ecritures.filter(e => e.statut === 'validee').map(e => e.numero);
  const res = await win.evaluate(async () => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    const a = document.querySelector('#lv-annee');
    return window.cabinet.validerLot({ dossierId: d, annee: a ? a.value : '', journal: 'CA' });
  });
  if (res.validees.length !== 2) throw new Error('le lot a validé ' + res.validees.length + ' pièces au lieu de 2');
  if (res.refusees.length !== 1) throw new Error('le lot n\'a pas refusé la pièce fausse');
  if (!res.refusees[0].motif) throw new Error('la pièce refusée n\'est pas nommée avec son motif');
  ok('2 validées, 1 refusée nommée : « ' + res.refusees[0].motif.slice(0, 60) + '… »');

  L = await livre();
  const nums = L.ecritures.filter(e => e.statut === 'validee').map(e => e.numero).sort((a, b) => a - b);
  const attendus = [];
  for (let i = 1; i <= nums.length; i++) attendus.push(i);
  if (JSON.stringify(nums) !== JSON.stringify(attendus)) {
    throw new Error('la numérotation a un trou : ' + nums.join(',') + ' au lieu de 1..' + nums.length);
  }
  // Et les numéros d'AVANT n'ont pas bougé (10.0.1). « 1..n sans trou » ne dit rien de ça : une
  // renumérotation complète donnerait 1..n tout autant. Un numéro naît à la validation et ne bouge
  // plus (règle 9.2.0), donc les anciens doivent être exactement le début de la nouvelle suite.
  // Le tableau d'avant était mesuré depuis la 9.3.0 et n'était comparé à rien.
  const debut = nums.slice(0, avant.length).sort((a, b) => a - b);
  if (JSON.stringify(debut) !== JSON.stringify([...avant].sort((a, b) => a - b))) {
    throw new Error('des numéros déjà attribués ont bougé : ' + avant.join(',') + ' → ' + debut.join(','));
  }
  if (L.ecritures.find(e => e.id === idFaux).numero !== null) throw new Error('la pièce refusée a consommé un numéro');
  ok('la suite des numéros est 1..' + nums.length + ' sans trou — le contrôle passe bien AVANT l\'attribution');

  // ---------------------------------------------------------------- 5. l'extourne
  étape('Extourner : le miroir au 1er du mois suivant, l\'origine intacte');
  const ext = await win.evaluate(async id => {
    const d = decodeURIComponent(location.hash.split('/')[2]);
    const a = document.querySelector('#lv-annee');
    return window.cabinet.extourner(d, a ? a.value : '', id);
  }, mienne.id);
  if (!ext.ok) throw new Error('l\'extourne a échoué');
  L = await livre();
  const miroir = L.ecritures.find(e => e.extourneDe === mienne.id);
  const origine = L.ecritures.find(e => e.id === mienne.id);
  if (!miroir) throw new Error('aucun miroir d\'extourne dans le livre');
  if (!/-04-01$/.test(miroir.date)) throw new Error('l\'extourne ne tombe pas au 1er du mois suivant : ' + miroir.date);
  if (origine.statut !== 'validee') throw new Error('l\'extourne a marqué son origine « ' + origine.statut + ' » : ce serait une contre-passation');
  if (Math.abs(miroir.lignes[0].credit - 1191) > 0.001) throw new Error('le miroir n\'inverse pas les colonnes');
  ok('miroir au ' + miroir.date + ', n° ' + miroir.numero + ' — et l\'origine garde son n° ' + origine.numero);

  // ---------------------------------------------------------------- 6. la recherche
  étape('Chercher une écriture par son MONTANT');
  // On ROUVRE l'application avant de chercher. Les gestes ci-dessus sont passés par le pont, donc
  // l'écran ne les a pas vus — mais surtout, rouvrir prouve ce qui compte vraiment : que tout est
  // sur le DISQUE, et pas seulement dans la mémoire d'un écran.
  await win.reload();
  // `#app` existe toujours dans le document, simplement masqué : on attend qu'un des deux écrans
  // soit VISIBLE, jamais qu'un sélecteur existe (piège 7.14.0, dans l'autre sens).
  await win.waitForFunction(() => {
    const a = document.querySelector('#app'), l = document.querySelector('#lock-form');
    return (a && !a.hidden) || (l && l.offsetParent !== null);
  }, { timeout: 25000 });
  if (await win.$('#lock-form')) {
    await win.fill('#lock-pw', 'mot-de-passe-cabinet');
    await win.click('#lock-go');
    await win.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  }
  await attendre(600);
  if (await win.$('#setup')) await passerAssistant();
  ok('application rouverte : ce qui suit est relu sur le disque');
  await win.evaluate(id => { location.hash = '#/dossier/' + encodeURIComponent(id) + '/comptabilite'; }, cible);
  await win.waitForSelector('#c-tabs', { timeout: 15000 });
  // 10.12.0 (U-06) — les écrans du livre sont rangés en groupes : on attend que le livre soit là
  // (le sélecteur de groupes n'existe qu'avec un livre), puis on trouve l'écran par ses groupes.
  await win.waitForSelector('#c-groupes', { timeout: 25000 });
  if (!(await ongletComptaPresent(win, 'recherche'))) throw new Error('le livre est ouvert et l\'écran « Recherche » reste introuvable');
  await ongletCompta(win, 'recherche');
  await win.waitForSelector('#re-q', { timeout: 8000 });
  await win.click('#re-q');
  await win.keyboard.type('1191');
  await attendre(500);
  const trouve = await win.evaluate(() => document.querySelectorAll('tr[data-re]').length);
  if (!trouve) throw new Error('chercher « 1191 » ne rend rien : un montant doit se chercher');
  // La pièce ET son extourne portent 1191 : les deux doivent sortir. Se contenter de « au moins
  // une » laisserait passer un écran qui n'a pas relu le livre — c'est très exactement le défaut
  // que cette étape vient de contourner.
  if (trouve < 2) {
    const surDisque = (await livre()).ecritures
      .filter(e => (e.lignes || []).some(l => Math.abs(l.debit - 1191) < 0.001 || Math.abs(l.credit - 1191) < 0.001)).length;
    throw new Error(`chercher « 1191 » rend ${trouve} ligne(s) alors que le livre sur le disque en porte ${surDisque}`
      + (surDisque > trouve ? ' — l\'écran n\'a pas relu le livre' : ' — le moteur de recherche ne les voit pas'));
  }
  // Et le champ n'a pas perdu ce qu'on a tapé en se redessinant (le défaut 7.17.0).
  const q = await win.evaluate(() => document.querySelector('#re-q').value);
  if (q !== '1191') throw new Error('le champ de recherche a perdu la frappe : « ' + q + ' »');
  ok(trouve + ' écriture(s) trouvée(s) par le montant, et le champ garde « ' + q + ' »');
  await shot('03-recherche');

  // ---------------------------------------------------------------- 6 bis. le numéro à l'ÉCRAN
  étape('Le livre-journal montre le numéro écrit à la validation, pas un rang recompté par date (T-52)');
  // FAC-E2E-1 est datée du 4 mars et validée APRÈS des pièces de mois postérieurs : le moteur
  // recomptait 1..n par date et l'affichait « n° 1 », en poussant toutes les validées d'avant d'un
  // cran. On lit la colonne N° de l'écran et on la confronte au livre sur le disque, pièce par pièce.
  await ongletCompta(win, 'journal');
  await win.waitForSelector('#lv-journal', { timeout: 8000 });
  await win.selectOption('#lv-journal', 'VT');
  await attendre(400);
  L = await livre();
  // L'extourne porte le MÊME numéro de pièce que son origine (à une autre date) : la clé est
  // (pièce, date), et la date de l'écran est celle du calendrier français, JJ/MM/AAAA.
  const cle = (piece, iso) => piece + '|' + iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  const numeroSurDisque = new Map(L.ecritures.filter(e => e.statut === 'validee' && e.journal === 'VT').map(e => [cle(e.piece, e.date), e.numero]));
  const ecran = await win.evaluate(() => [...document.querySelectorAll('#view table.list tbody tr')]
    .map(tr => [...tr.children].map(td => td.textContent.trim()))
    .filter(c => c[0] && c[3]).map(c => ({ n: c[0], piece: c[3].replace(/\s+(contre-passation|extourne).*$/, ''), date: c[1] })));
  const mienneCle = cle('FAC-E2E-1', mienne.date);
  const vue = ecran.find(r => r.piece + '|' + r.date === mienneCle);
  if (!vue) throw new Error('FAC-E2E-1 du ' + mienne.date + ' n\'apparaît pas dans le livre-journal filtré sur VT : ' + JSON.stringify(ecran.slice(0, 4)));
  if (String(numeroSurDisque.get(mienneCle)) !== vue.n) {
    throw new Error('l\'écran affiche « n° ' + vue.n + ' » pour FAC-E2E-1, le livre dit n° ' + numeroSurDisque.get(mienneCle));
  }
  const faux = ecran.filter(r => numeroSurDisque.has(r.piece + '|' + r.date) && String(numeroSurDisque.get(r.piece + '|' + r.date)) !== r.n);
  if (faux.length) throw new Error('des validées changent de numéro à l\'écran : ' + faux.map(f => f.piece + ' → ' + f.n).join(', '));
  if (numeroSurDisque.size < 2) throw new Error('le journal VT devrait porter plusieurs validées pour que la preuve compte');
  ok('FAC-E2E-1 porte le n° ' + vue.n + ' à l\'écran comme sur le disque, et aucune des ' + numeroSurDisque.size + ' validées de VT n\'a bougé');
  await win.selectOption('#lv-journal', '');

  // ---------------------------------------------------------------- 7. un guide
  étape('Écrire un guide, puis s\'en servir dans la grille');
  await win.evaluate(() => { location.hash = '#/reglages'; });
  await win.waitForSelector('#set-tabs', { timeout: 8000 });
  const ongletGuides = await win.evaluate(() => {
    const p = document.getElementById('pan-guides');
    const sec = p && p.closest('[data-pane]');
    return sec ? sec.dataset.pane : null;
  });
  if (!ongletGuides) throw new Error('le panneau des guides n\'est dans aucun onglet des Réglages');
  await win.click(`#set-tabs button[data-tab="${ongletGuides}"]`);
  await win.waitForSelector('#pan-guides', { state: 'visible', timeout: 8000 });
  await win.click('#sr-guide-new');
  await win.waitForSelector('#g-nom', { timeout: 8000 });
  await win.fill('#g-nom', 'Achat avec TVA 19 %');
  await win.fill('#g-journal', 'AC');
  // Trois lignes : base, taux, solde.
  await win.evaluate(() => {
    const l = document.querySelectorAll('#g-lignes tr');
    const set = (tr, k, v) => { const f = tr.querySelector(`[data-k=${k}]`); if (f.type === 'checkbox') f.checked = v; else f.value = v; f.dispatchEvent(new Event('change')); };
    set(l[0], 'compte', '607'); set(l[0], 'libelle', 'Achat'); set(l[0], 'sens', 'debit'); set(l[0], 'base', true);
    set(l[1], 'compte', '401'); set(l[1], 'libelle', 'Fournisseur'); set(l[1], 'sens', 'credit'); set(l[1], 'solde', true);
  });
  await win.click('#g-add');
  await attendre(200);
  await win.evaluate(() => {
    const l = document.querySelectorAll('#g-lignes tr');
    const tr = l[l.length - 1];
    const set = (k, v) => { const f = tr.querySelector(`[data-k=${k}]`); if (f.type === 'checkbox') f.checked = v; else f.value = v; f.dispatchEvent(new Event('change')); };
    set('compte', '4366'); set('libelle', 'TVA déductible'); set('sens', 'debit'); set('taux', '19');
  });
  await win.click('#ok');
  await win.waitForSelector('tr[data-g]', { timeout: 8000 });
  ok('guide enregistré et visible dans les Réglages');
  await shot('04-guide');

  await win.evaluate(id => { location.hash = '#/dossier/' + encodeURIComponent(id) + '/comptabilite'; }, cible);
  await win.waitForSelector('#c-tabs', { timeout: 15000 });
  await ongletCompta(win, 'saisie');
  await win.waitForSelector('#sa-guide', { timeout: 10000 });
  await win.fill('#sa-guide-montant', '1000');
  await win.selectOption('#sa-guide', { label: 'Achat avec TVA 19 %' });
  await win.waitForFunction(() => {
    const v = document.querySelector('#sa-lignes tr[data-i="0"] input[data-k=compte]');
    return v && v.value === '607';
  }, { timeout: 8000 });
  const rempli = await win.evaluate(() => [...document.querySelectorAll('#sa-lignes tr')].slice(0, 3).map(tr => ({
    c: tr.querySelector('input[data-k=compte]').value,
    d: tr.querySelector('input[data-k=debit]').value,
    cr: tr.querySelector('input[data-k=credit]').value
  })));
  // Les trois montants se calculent à la MAIN : 1000 de base, 19 % de TVA, 1190 au fournisseur.
  // Et ils s'ÉCRIVENT comme l'écran les écrit (H-3) : « 1 000,000 », jamais « 1000.000 » — en
  // français, le point sépare les milliers. L'assertion d'avant exigeait le point : elle gravait le
  // défaut. L'espace des milliers est insécable ; on la ramène à une espace pour comparer.
  const fr = v => String(v || '').replace(/[\s  ]/g, ' ');
  if (fr(rempli[0].d) !== '1 000,000') throw new Error('la ligne de base n\'a pas reçu le montant en français : ' + JSON.stringify(rempli[0]));
  const tva = rempli.find(r => r.c === '4366');
  if (!tva || fr(tva.d) !== '190,000') throw new Error('la TVA à 19 % de 1000 devrait être 190,000 : ' + JSON.stringify(tva));
  const four = rempli.find(r => r.c === '401');
  if (!four || fr(four.cr) !== '1 190,000') throw new Error('le fournisseur devrait recevoir le solde 1 190,000 : ' + JSON.stringify(four));
  const soldeGuide = await win.evaluate(() => document.querySelector('#sa-solde').textContent);
  if (!/Équilibrée/.test(soldeGuide)) throw new Error('la pièce du guide ne tombe pas juste : ' + soldeGuide);
  ok('le guide préremplit 1000 / 190 / 1190 et la pièce tombe juste');
  await shot('05-guide-applique');

  // Et il n'a RIEN écrit : préremplir n'est pas enregistrer.
  const apresGuide = await livre();
  if (apresGuide.ecritures.some(e => e.piece === '' && e.lignes.some(l => l.compte === '4366'))) {
    throw new Error('le guide a écrit dans le livre : il doit préremplir, pas enregistrer');
  }
  ok('le guide n\'a rien enregistré — il préremplit, on décide');

  // ---------------------------------------------------------------- 9 bis. la pièce commencée (U-09)
  étape('Une pièce commencée se VOIT, et la fermeture la nomme avant de la perdre (U-09)');
  // Le guide vient de remplir la grille SANS enregistrer : c'est une pièce commencée. Elle vivait en
  // mémoire, sans trace — fermer la fenêtre l'effaçait sans une question.
  const points = await win.evaluate(() => [...document.querySelectorAll('[data-sale]')]
    .filter(x => !x.hidden && x.getBoundingClientRect().width > 0).length);
  if (points < 2) throw new Error(`la pièce commencée ne se voit pas : ${points} point visible sur l'onglet de la fiche, le groupe et la Saisie`);
  const nomDossier = (await win.textContent('#view h1')).trim();
  // La boîte de la fermeture est NATIVE : elle ne se clique pas depuis la page. On la remplace dans
  // le processus principal par une réponse écrite d'avance (« Annuler »), et on retient ce qu'elle
  // a demandé.
  await app.evaluate(({ dialog }) => {
    global.__questions = [];
    dialog.showMessageBoxSync = (_w, o) => { global.__questions.push({ message: o.message, boutons: o.buttons }); return 0; };
  });
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close(); });
  await attendre(500);
  const questions = await app.evaluate(() => global.__questions);
  const fenetres = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  if (!questions.length) throw new Error('fermer avec une pièce commencée ne pose aucune question');
  if (!fenetres) throw new Error('« Annuler » a quand même fermé la fenêtre');
  if (!questions[0].message.includes(nomDossier)) throw new Error('la question ne nomme pas le dossier : ' + questions[0].message);
  if (!questions[0].boutons.includes('Fermer sans enregistrer')) throw new Error('la question n\'offre pas de fermer quand même : ' + questions[0].boutons.join(' / '));
  ok(`la fermeture demande, nomme « ${nomDossier} », et « Annuler » garde la fenêtre`);

  // « Vider » jetait la pièce sans un mot : il laisse maintenant un « Annuler » sous la main.
  await win.click('#sa-vider');
  await win.waitForSelector('#toast .toast-undo', { timeout: 5000 });
  await win.click('#toast .toast-undo');
  await win.waitForFunction(() => {
    const v = document.querySelector('#sa-lignes tr[data-i="0"] input[data-k=compte]');
    return v && v.value === '607';
  }, { timeout: 5000 });
  ok('« Vider » se défait : la pièce revient, lignes comprises');
  await win.click('#sa-vider');
  await win.waitForFunction(() => [...document.querySelectorAll('[data-sale]')].every(x => x.hidden), { timeout: 5000 });
  await app.evaluate(() => { global.__questions = []; });
  ok('vidée pour de bon, le point disparaît — et la fermeture ne demandera plus rien');

  // ---------------------------------------------------------------- 8. rien de cassé
  étape('Aucune erreur JavaScript pendant tout le parcours');
  if (errors.length) {
    console.log(errors.slice(0, 10).map(e => '    ' + e).join('\n'));
    throw new Error(errors.length + ' erreur(s) JS pendant le parcours');
  }
  ok('zéro erreur');

  console.log('\nTOUT EST VERT — captures dans ' + OUT);
  await Promise.race([app.close(), new Promise(r => setTimeout(r, 15000))
    .then(() => { throw new Error('l\'application ne se ferme pas : une fenêtre attend une réponse'); })]);
  // Aucune pièce en cours : la fermeture n'a rien eu à demander (sinon la boîte remplacée aurait
  // répondu « Annuler », et la fermeture aurait échoué au-dessus).
  fs.rmSync(dir, { recursive: true, force: true });
})().catch(async e => {
  console.error('\n✗ ' + e.message);
  if (errors.length) console.error(errors.slice(0, 10).join('\n'));
  process.exit(1);
});
