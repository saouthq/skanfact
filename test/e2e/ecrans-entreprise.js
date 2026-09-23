// Les ÉCRANS de l'application entreprise, TOUS — et le chemin qui mène à chacun (10.12.0).
//
// Pourquoi ce module existe : la règle de la 9.4.3 (« un instrument qui ne couvre qu'une des deux
// applications ne protège qu'une des deux ») avait été appliquée au Cabinet — `cabinet-rendu`
// ouvre chaque page, chaque onglet, chaque fiche — et JAMAIS à l'application entreprise, la plus
// grosse des deux. Ses instruments, relus le 23/09/2026 :
//   · `e2e:contraste` visitait `#/recurrentes`, une adresse qui n'existe pas : le routeur retombe
//     sur l'accueil, donc la Facturation récurrente n'avait jamais été mesurée — et l'accueil
//     l'était deux fois ;
//   · aucun des trois (`contraste`, `entetes`, `colonnes`) n'ouvrait une FICHE (client,
//     fournisseur, affaire, salarié, article, bien, contrat) ni une pièce par statut, et le premier
//     n'ouvrait aucun ONGLET : Comptabilité en a dix, Paie sept, Paramètres cinq ;
//   · le photographe (`e2e:captures`) prenait `fullPage` sur un cadre fixe — une page de quatre
//     écrans de haut se photographiait au quart (9.4.3) — et sa table d'onglets était PÉRIMÉE :
//     `journal`, `cloture`, `comptes`, `rappro`, `clients`, `liste`, `plan`… n'existent plus, et
//     l'instrument les sautait sans un mot (le défaut de `#stk-tabs`, 7.23.0).
// C'est T-55 (9.8.8) sur la troisième surface qu'on croyait couverte : un instrument qui n'atteint
// pas l'écran annonce « tout va bien ».
//
// Ce module ne MESURE rien et ne PHOTOGRAPHIE rien : il MÈNE. Il appelle `visiter(nom, contexte)`
// sur chaque écran atteint, et c'est l'appelant qui décide quoi en faire — `entreprise-rendu.js`
// mesure, `captures.js` photographie. Deux couvertures qui ne peuvent pas diverger, parce qu'elles
// sont le même parcours (10.6.0 : la couverture des captures se DÉDUIT de celle des mesures).
//
// Et rien n'y est écrit à la main qui puisse se périmer en silence :
//   · les PAGES se lisent dans le code (`routes.x = `) ; une route qu'on ne sait ni ouvrir comme une
//     page ni atteindre comme une fiche fait TOMBER le parcours — une page ajoutée demain sera
//     mesurée, ou le parcours dira pourquoi il ne peut pas ;
//   · les ONGLETS se lisent dans l'écran, barre par barre, y compris ceux qu'un onglet fait
//     apparaître (la balance et ses quatre vues) ;
//   · les FICHES se choisissent dans les données : une pièce par type ET par statut, un achat par
//     nature ET par statut, le premier de chaque objet ;
//   · les FENÊTRES s'ouvrent par leur vrai bouton : chaque « + … » de la page, chaque menu de
//     ligne (le menu lui-même, puis ses entrées qui ouvrent un formulaire), chaque menu déroulant
//     d'en-tête, et les boutons d'édition des listes.
// Un geste qui accepte le clic et ne produit RIEN — ni fenêtre, ni page, ni changement à l'écran —
// est rendu comme une faute (7.0.0 : un bouton qui ne répond pas est pire qu'un bouton absent).
'use strict';
const fs = require('fs');
const path = require('path');
const { RACINE, FENETRE } = require('./harnais');

// Les routes qui désignent UN objet : on n'y va pas par l'adresse nue, on y va avec un identifiant
// tiré des données (voir `CIBLES`).
const FICHES = ['doc', 'client', 'contrat', 'fournisseur', 'achat', 'affaire', 'salarie', 'article', 'immo'];

function routesDuCode() {
  const src = fs.readFileSync(path.join(RACINE, 'src', 'renderer', 'app.js'), 'utf8');
  return [...new Set([...src.matchAll(/^\s*routes\.([a-zA-Z]+) = /gm)].map(m => m[1]))];
}
function pagesDuCode() { return routesDuCode().filter(r => !FICHES.includes(r)); }

// Les « + … » qui ne créent PAS un objet : ils ajoutent une ligne au formulaire qu'on regarde (le
// cliquer rendrait la page « modifiée » et le garde-fou poserait sa question à chaque navigation),
// ouvrent le sélecteur de fichiers du système, créent un DOSSIER d'entreprise, ou exigent la clé de
// l'éditeur. Nommés, jamais devinés : une exception anonyme est un trou (9.4.10).
const PLUS_EXCLUS = ['add-line', 'hf-add', 'od-add', 'rl-add', 'tf-add', 'orf-add', 'add-bon', 'add-ded',
  'add-br', 'add-att', 'dos-add', 'lic-new'];

// Les entrées de menu qui ouvrent un FORMULAIRE sans rien changer : on les ouvre pour mesurer la
// fenêtre, on la referme sans rien enregistrer. Tout ce qui écrit, envoie, exporte, duplique,
// supprime ou marque un état est laissé de côté — un parcours qui change les données au fil de sa
// route mesurerait un autre objet à chaque passe.
const MENU_SUR = /^(Modifier|Noter un appel|Ne pas relancer|Changer la date de report|Relevé de compte|Enregistrer un (paiement|règlement))/;

// Les boutons d'édition des listes (un par nature, le premier venu) et les ouvreurs de fenêtres qui
// ne commencent pas par « + ». Chacun n'est tenté que s'il est À L'ÉCRAN.
const OUVREURS = ['#pay', '#dispose', '#hr-doc', '#edit-emp', '#edit-imm', '#ecr-od', '#ecr-plan', '#gl-plan',
  '#bal-plan', '#et-plan', '#rec-depuis', '#vide-depuis', '#aide-support', '#aide-idee', '#set-support',
  '#set-idee', '[data-ee]', '[data-lv]', '[data-av]', '[data-ed]', '[data-hr]', '[data-fix]', '[data-ser]',
  '[data-eacc]', 'tr[data-mv]', '[data-payx]'];

// Les menus déroulants d'en-tête : on les ouvre, on les mesure, on les referme.
const DEROULANTS = ['#bill-btn', '#conv-btn', '#more-btn', '#c-more-btn'];

// Les fiches à ouvrir, lues dans les données de la page. Une pièce par type ET par statut : le
// bandeau d'une facture payée, les boutons d'un brouillon et le verrou d'un avoir émis sont trois
// écrans différents, et un parcours qui n'ouvre que « la première facture » en voit un sur trois.
const CIBLES = () => {
  const d = window.__data, C = window.SkanCore;
  if (!d || !C) return [];
  const co = d.company || {}, auj = C.today();
  const out = [];
  const vu = new Set();
  const une = (cle, hash, nom) => { if (vu.has(cle)) return; vu.add(cle); out.push({ hash, nom }); };
  (d.documents || []).forEach(doc => {
    let st = '';
    try { st = C.effectiveStatus(doc, d, co, auj) || doc.status || ''; } catch (_) { st = doc.status || ''; }
    une('doc:' + doc.type + ':' + st, '#/doc/' + doc.id, `pièce ${doc.type} ${st}`.trim());
  });
  ['devis', 'facture', 'avoir', ...(C.EXTRA_TYPES || [])].forEach(t => une('docnew:' + t, '#/doc/new/' + t, 'nouvelle pièce ' + t));
  (d.purchases || []).forEach(p => {
    let st = '';
    try { st = C.purchaseStatus(p, co, auj, d) || ''; } catch (_) { st = ''; }
    une('achat:' + (p.kind || 'facture') + ':' + st, '#/achat/' + p.id, `achat ${p.kind || 'facture'} ${st}`.trim());
  });
  (C.PURCHASE_KINDS || [['facture'], ['depense']]).forEach(([k]) => une('achatnew:' + k, '#/achat/new/-/' + k, 'nouvel achat ' + k));
  // Le client le plus fourni : c'est sa fiche qui porte le plus de panneaux.
  const parClient = {};
  (d.documents || []).forEach(x => { if (x.clientId) parClient[x.clientId] = (parClient[x.clientId] || 0) + 1; });
  const clients = (d.clients || []).slice().sort((a, b) => (parClient[b.id] || 0) - (parClient[a.id] || 0));
  if (clients[0]) une('client', '#/client/' + clients[0].id, 'fiche client');
  if ((d.recurring || [])[0]) une('contrat', '#/contrat/' + d.recurring[0].id, 'fiche contrat');
  if ((d.suppliers || [])[0]) une('fournisseur', '#/fournisseur/' + d.suppliers[0].id, 'fiche fournisseur');
  if ((d.projects || [])[0]) une('affaire', '#/affaire/' + d.projects[0].id, 'fiche affaire');
  if ((d.employees || [])[0]) une('salarie', '#/salarie/' + d.employees[0].id, 'fiche salarié');
  const suivis = (d.catalog || []).filter(i => i.tracked);
  if (suivis[0]) une('article', '#/article/' + suivis[0].id, 'fiche article');
  const serie = suivis.find(i => i.serialized);
  if (serie) une('article-serie', '#/article/' + serie.id, 'fiche article suivi par numéro');
  if ((d.assets || [])[0]) une('immo', '#/immo/' + d.assets[0].id, 'fiche bien');
  const cede = (d.assets || []).find(a => a.disposal || a.disposedAt || a.sortie);
  if (cede) une('immo-sorti', '#/immo/' + cede.id, 'fiche bien sorti');
  return out;
};

// Le nom d'un écran, utilisable comme nom de fichier : un seul endroit, pour que deux écrans ne
// puissent pas se retrouver sous le même nom sans que le parcours le dise.
const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);

function creerParcours(win, visiter, opts = {}) {
  const attendre = (ms = 260) => win.waitForTimeout(ms);
  const fautes = [];
  const vus = new Set();          // les écrans déjà visités dans CETTE passe
  const gestesVus = new Set();    // les gestes déjà tentés dans CETTE passe
  let ecrans = 0;

  const hash = () => win.evaluate(() => location.hash);
  const fenetres = () => win.evaluate(() => document.querySelectorAll('#modal-root .modal-bg').length);

  // Toute question posée par le garde-fou (« Modifications non enregistrées », « Abandonner cette
  // saisie ? ») reçoit la réponse qui ne GARDE rien : le parcours n'a rien saisi qui compte.
  const repondreGardeFou = async () => {
    for (let i = 0; i < 4; i++) {
      const q = await win.evaluate(() => {
        const bg = document.querySelector('#modal-root > .modal-bg:last-child');
        if (!bg) return null;
        const t = bg.textContent || '';
        if (/Abandonner cette saisie/.test(t)) return '#ok';
        if (/non enregistrées/.test(t)) {
          const b = [...bg.querySelectorAll('button')].find(x => /sans enregistrer|Ne pas enregistrer|Abandonner|Quitter/i.test(x.textContent));
          return b ? (b.id ? '#' + b.id : null) : null;
        }
        return null;
      });
      if (!q) return;
      await win.click(`#modal-root > .modal-bg:last-child ${q}`).catch(() => {});
      await attendre(200);
    }
  };

  const fermerTout = async () => {
    for (let i = 0; i < 8; i++) {
      const n = await fenetres();
      const menu = await win.$('.row-menu');
      const ouvert = await win.evaluate(() => [...document.querySelectorAll('[aria-expanded="true"]')].length);
      if (!n && !menu && !ouvert) return;
      await win.keyboard.press('Escape');
      await attendre(160);
      await repondreGardeFou();
    }
    if (await fenetres()) fautes.push(`${await hash()} — une fenêtre ne se referme ni à Échap ni par « Abandonner »`);
  };

  const aller = async h => {
    await fermerTout();
    await win.evaluate(x => { location.hash = x; }, h);
    await attendre(320);
    await repondreGardeFou();
    if (await hash() !== h) {
      // Le garde-fou a remis la page précédente pour poser sa question : on a répondu, on repart.
      await win.evaluate(x => { location.hash = x; }, h);
      await attendre(320);
    }
    const ici = await hash();
    return ici === h;
  };

  const visite = async (nom, contexte = {}) => {
    const cle = slug(nom);
    if (vus.has(cle)) return false;
    vus.add(cle);
    ecrans++;
    await visiter(nom, { ...contexte, cle, hash: await hash() });
    return true;
  };

  // Les barres d'onglets VISIBLES de la page, lues dans l'écran.
  const barres = () => win.evaluate(() => [...document.querySelectorAll('#view .tabs[id]')]
    .filter(t => t.getBoundingClientRect().height > 0)
    .map(t => ({ sel: '#' + t.id, tabs: [...t.querySelectorAll('button[data-tab]')]
      .filter(b => b.getBoundingClientRect().height > 0 && !b.disabled).map(b => ({ tab: b.dataset.tab, label: b.textContent.trim() })) })));

  // Un compteur de ce qui change à l'écran : il dit si un geste a produit QUELQUE CHOSE.
  const armerTemoin = () => win.evaluate(() => {
    window.__temoin = 0;
    if (window.__temoinObs) window.__temoinObs.disconnect();
    const o = new MutationObserver(m => { window.__temoin += m.length; });
    // Un message passager (`#toast`) est une réponse : il se compte, mais il ne suffit pas à rendre un
    // bouton honnête — c'est au bouton de ne pas se proposer quand il n'a rien à faire.
    ['#view', '#modal-root', 'body', '#toast'].forEach(s => { const el = document.querySelector(s); if (el) o.observe(el, { childList: true, subtree: s !== 'body', attributes: s === '#view' || s === '#toast', characterData: s === '#toast' }); });
    window.__temoinObs = o;
  });
  const lireTemoin = () => win.evaluate(() => window.__temoin || 0);

  // Un geste : on clique, puis on regarde ce qui s'est passé. Une fenêtre → on la mesure ; une
  // autre page → on la mesure ; RIEN → c'est une faute.
  const geste = async (nomPage, selecteur, libelle, { cliquer } = {}) => {
    const depart = await hash();
    const cle = depart + '|' + libelle;
    if (gestesVus.has(cle)) return;
    gestesVus.add(cle);
    const avant = await fenetres();
    if (opts.surGeste) opts.surGeste(`${nomPage} → geste « ${libelle} »`);
    await armerTemoin();
    const ok = cliquer ? await cliquer().then(() => true).catch(() => false)
      : await win.click(selecteur, { timeout: 2500 }).then(() => true).catch(() => false);
    if (!ok) return;
    await attendre(420);
    const apres = await fenetres();
    const ici = await hash();
    if (apres > avant) {
      const titre = await win.evaluate(sel => {
        const m = document.querySelector(sel);
        const t = m && (m.querySelector('h2, h3, .modal-title') || {}).textContent;
        return (t || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      }, FENETRE);
      await visite(`${nomPage} · fenêtre « ${titre || libelle} »`, { fenetre: true });
      await fermerTout();
    } else if (ici !== depart) {
      await visite(`${nomPage} → ${libelle}`, {});
      await fermerTout();
      await aller(depart);
    } else if (await win.$('.row-menu')) {
      await visite(`${nomPage} · menu « ${libelle} »`, { menu: true });
      await fermerTout();
    } else if (!(await lireTemoin())) {
      fautes.push(`${nomPage} — « ${libelle} » accepte le clic et ne produit rien : ni fenêtre, ni page, ni changement à l'écran`);
    }
  };

  // Les gestes de l'écran courant. `nomPage` nomme l'écran d'où ils partent.
  const gestes = async nomPage => {
    if (opts.gestes === false) return;
    // 1. Chaque « + … » visible de la page : une création.
    const plus = await win.evaluate(exclus => [...document.querySelectorAll('#view button')]
      .filter(b => /^\+\s/.test(b.textContent.trim()) && b.getBoundingClientRect().height > 0 && !b.disabled
        && !exclus.includes(b.id) && !b.classList.contains('link-add') && !b.classList.contains('sugg-add')
        && !b.closest('.modal'))
      .map((b, i) => ({ sel: b.id ? '#' + b.id : null, i, label: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) })), PLUS_EXCLUS);
    for (const p of plus) {
      if (p.sel) await geste(nomPage, `#view ${p.sel}`, p.label);
      else {
        await geste(nomPage, null, p.label, { cliquer: () => win.evaluate(l => {
          const b = [...document.querySelectorAll('#view button')].find(x => x.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) === l);
          if (!b) throw new Error('disparu'); b.click();
        }, p.label) });
      }
    }
    // 2. Les ouvreurs nommés (édition, paiement, cession…), le premier de chaque sorte.
    for (const s of OUVREURS) {
      const el = await win.$(`#view ${s}`);
      if (!el || !(await el.isVisible().catch(() => false))) continue;
      const label = ((await el.textContent().catch(() => '')) || s).trim().replace(/\s+/g, ' ').slice(0, 40) || s;
      await geste(nomPage, `#view ${s}`, `${label} (${s})`, { cliquer: () => el.click({ timeout: 2500 }) });
    }
    // 3. Les menus déroulants d'en-tête.
    for (const s of DEROULANTS) {
      const el = await win.$(`#view ${s}`);
      if (!el || !(await el.isVisible().catch(() => false))) continue;
      const depart = await hash();
      await armerTemoin();
      await el.click({ timeout: 2500 }).catch(() => {});
      await attendre(260);
      if (await lireTemoin()) await visite(`${nomPage} · menu ${s}`, { menu: true });
      else fautes.push(`${nomPage} — le menu ${s} ne s'ouvre pas`);
      // Numéros de série : un formulaire qui ne vit QUE dans le menu « Plus ▾ ».
      const series = await win.$('#view #serials');
      if (series && await series.isVisible().catch(() => false)) {
        await geste(nomPage, '#view #serials', 'Numéros de série…');
      } else {
        await el.click({ timeout: 1500 }).catch(() => {});
        await attendre(160);
      }
      await fermerTout();
      if (await hash() !== depart) await aller(depart);
    }
    // 4. Les menus de ligne : le premier de chaque tableau, et celui de l'en-tête.
    const menus = await win.evaluate(() => {
      const seen = new Set(); const out = [];
      document.querySelectorAll('#view [data-rowmenu]').forEach(b => {
        if (!b.getBoundingClientRect().height) return;
        const groupe = b.closest('table') || b.closest('.page-head') || b.parentElement;
        if (seen.has(groupe)) return;
        seen.add(groupe);
        out.push({ id: b.dataset.rowmenu, solo: b.classList.contains('row-menu-solo'), label: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) });
      });
      return out.slice(0, 8);
    });
    for (const m of menus) {
      const sel = `#view [data-rowmenu="${m.id.replace(/"/g, '\\"')}"]`;
      if (m.solo) {
        // Une action seule devient un bouton nommé (7.29.0) : on ne la clique que si elle ouvre un
        // formulaire sans rien changer.
        if (MENU_SUR.test(m.label)) await geste(nomPage, sel, m.label);
        continue;
      }
      const depart = await hash();
      await win.click(sel, { timeout: 2500 }).catch(() => {});
      await attendre(220);
      if (!(await win.$('.row-menu'))) { fautes.push(`${nomPage} — le menu « ${m.label} » ne s'ouvre pas`); continue; }
      await visite(`${nomPage} · menu de ligne`, { menu: true });
      const entrees = await win.$$eval('.row-menu button[data-i]', bs => bs.map(b => ({ i: b.dataset.i, label: (b.querySelector('.rm-l') || b).textContent.trim() })));
      await fermerTout();
      for (const e of entrees.filter(x => MENU_SUR.test(x.label))) {
        await geste(nomPage, null, e.label, { cliquer: async () => {
          await win.click(sel, { timeout: 2500 });
          await win.waitForSelector('.row-menu', { timeout: 2500 });
          await win.click(`.row-menu button[data-i="${e.i}"]`, { timeout: 2500 });
        } });
        if (await hash() !== depart) await aller(depart);
      }
    }
  };

  // Un écran, ses onglets, et les onglets que ses onglets font apparaître.
  const explorer = async (nomPage, profondeur = 0) => {
    await visite(nomPage);
    await gestes(nomPage);
    const lues = await barres();
    const connues = new Set(lues.map(b => b.sel));
    for (const b of lues) {
      for (const t of b.tabs) {
        const bouton = await win.$(`${b.sel} button[data-tab="${t.tab}"]`);
        if (!bouton) { fautes.push(`${nomPage} : l'onglet « ${t.label} » de ${b.sel} a disparu entre sa lecture et son clic`); continue; }
        await fermerTout();
        await bouton.click().catch(() => {});
        await attendre(340);
        const nom = `${nomPage} · ${t.label || t.tab}`;
        await visite(nom);
        await gestes(nom);
        if (profondeur < 2) {
          for (const sous of (await barres()).filter(x => !connues.has(x.sel))) {
            connues.add(sous.sel);
            for (const st of sous.tabs) {
              const sb = await win.$(`${sous.sel} button[data-tab="${st.tab}"]`);
              if (!sb) continue;
              await sb.click().catch(() => {});
              await attendre(320);
              const snom = `${nom} · ${st.label || st.tab}`;
              await visite(snom);
              await gestes(snom);
            }
          }
        }
      }
    }
  };

  const toutesLesPages = async () => {
    const pages = pagesDuCode();
    for (const r of pages) {
      const h = '#/' + r;
      if (!await aller(h)) {
        // Une page peut légitimement renvoyer ailleurs (une fiche inexistante) : jamais une page.
        fautes.push(`${h} ne s'ouvre pas : le parcours la sauterait en silence (arrivée sur ${await hash()})`);
        continue;
      }
      if (!(await win.$('#view h1'))) { fautes.push(`${h} : aucun titre dessiné — la page est blanche`); continue; }
      await explorer(`page ${r}`);
    }
    return pages.length;
  };

  const toutesLesFiches = async () => {
    const cibles = await win.evaluate(CIBLES);
    for (const c of cibles) {
      if (!await aller(c.hash)) { fautes.push(`${c.hash} (${c.nom}) ne s'ouvre pas`); continue; }
      await explorer(c.nom);
    }
    return cibles.length;
  };

  const articlesAide = async () => {
    const ids = await win.evaluate(() => ((window.SkanGuide || {}).ARTICLES || []).map(a => ({ id: a.id, titre: a.titre || a.title || a.id })));
    for (const a of ids) {
      if (!await aller('#/aide/' + a.id)) { fautes.push(`l'article d'aide « ${a.id} » ne s'ouvre pas`); continue; }
      await visite(`aide · ${a.titre}`);
    }
    return ids.length;
  };

  const palette = async () => {
    await aller('#/dashboard');
    await win.keyboard.press('Control+k');
    await win.waitForSelector('#palette-root input', { timeout: 4000 })
      .catch(() => fautes.push('la palette Ctrl K ne s\'ouvre pas'));
    await attendre(200);
    await visite('palette');
    await win.keyboard.type('fac');
    await attendre(260);
    await visite('palette · « fac »');
    await win.keyboard.press('Escape');
    await attendre(200);
  };

  return {
    fautes, attendre, aller, fermerTout, visite, explorer, toutesLesPages, toutesLesFiches, articlesAide, palette,
    get ecrans() { return ecrans; },
    oublier: () => { vus.clear(); gestesVus.clear(); ecrans = 0; }
  };
}

// Les dialogues NATIFS (enregistrer, ouvrir, message) bloqueraient le parcours pour toujours, et
// `shell.openExternal` ouvrirait une messagerie : on les neutralise dans le processus principal,
// comme `e2e:justificatif` le fait pour le sélecteur de fichier. Rien de ce que l'application
// DESSINE n'est touché.
async function neutraliserSysteme(app) {
  await app.evaluate(({ dialog, shell }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: undefined });
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
    shell.openExternal = async () => {};
    shell.openPath = async () => '';
    shell.showItemInFolder = () => {};
  });
}

// L'assistant de première utilisation, traversé comme le ferait quelqu'un de pressé ; chaque écran
// est rendu à `visiter` — c'est le premier contact avec l'application.
async function traverserAssistant(win, visiter, { nom = 'Atelier Rendu SUARL', matricule = '7654321R/A/M/000', metier = 'batiment' } = {}) {
  await win.waitForSelector('#setup');
  for (let garde = 0, n = 1; garde < 16 && await win.$('#setup'); garde++, n++) {
    if (visiter) await visiter(`assistant · écran ${n}`, { cle: slug('assistant ecran ' + n) });
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', nom);
      await win.fill('#sf-form input[name=matricule]', matricule);
      const adr = await win.$('#sf-form textarea[name=address]');
      if (adr) await adr.fill('Rue de Carthage\n2080 Ariana');
    }
    if (await win.$(`[data-act="${metier}"]`)) { await win.click(`[data-act="${metier}"]`); await win.waitForSelector(`[data-act="${metier}"].sel`); }
    await win.click('#sf-next');
    await win.waitForTimeout(140);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'), null, { timeout: 8000 });
}

async function chargerExemple(win) {
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner', { timeout: 15000 });
  await win.waitForTimeout(400);
}

// Tous les modules dans le menu, et l'option Comptabilité complète : un écran caché par un réglage
// est un écran qu'aucune sonde ne mesure (les trois onglets du grand livre, de la balance et des
// états financiers n'existent QU'avec l'option).
async function toutAfficher(win) {
  await win.evaluate(() => { location.hash = '#/modules'; });
  await win.waitForSelector('#view [data-mod], #view [data-sousmod]', { timeout: 8000 });
  for (let i = 0; i < 30; i++) {
    const reste = await win.$('#view input[data-mod]:not(:checked)');
    if (!reste) break;
    await reste.click();
    await win.waitForTimeout(220);
    // Une question peut suivre (un module masqué qui contient quelque chose) : on confirme.
    const ok = await win.$('#modal-root > .modal-bg:last-child #ok');
    if (ok) { await ok.click(); await win.waitForTimeout(200); }
  }
  const option = await win.$('#view [data-sousmod="compta.livres"]:not(:checked)');
  if (option) { await option.click(); await win.waitForTimeout(300); }
  const ok = await win.$('#modal-root > .modal-bg:last-child #ok');
  if (ok) { await ok.click(); await win.waitForTimeout(200); }
}

// Le thème, par le VRAI réglage (Paramètres → L'application) : un test qui ajoute la classe à la
// main prouverait la feuille de style, pas l'application.
async function poserTheme(win, valeur) {
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="app"]');
  await win.waitForSelector('#pf select[name=theme]');
  await win.selectOption('#pf select[name=theme]', valeur);
  await win.waitForSelector('#save-bar:not([hidden])', { timeout: 4000 }).catch(() => {});
  if (await win.$('#save-bar:not([hidden]) #save')) await win.click('#save');
  await win.waitForTimeout(300);
  const sombre = await win.evaluate(() => document.body.classList.contains('dark'));
  if (sombre !== (valeur === 'dark')) throw new Error(`le réglage « ${valeur} » ne pose pas le thème`);
}

module.exports = { FICHES, routesDuCode, pagesDuCode, creerParcours, neutraliserSysteme, traverserAssistant,
  chargerExemple, toutAfficher, poserTheme, slug };
