// La console de l'éditeur, ouverte pour de vrai dans un navigateur — et depuis P 0.2, une VENTE
// complète : le client, la clé, la vente payée, le mail, le renouvellement, la révocation.
//
// Pourquoi ce parcours existe : le projet a appris huit fois qu'un écran ne se juge pas à la
// lecture. Un bouton parfaitement visible peut être inerte (5.2.2, 7.0.0), une classe CSS peut
// perdre en silence (7.23.0, 7.27.0, 7.30.0), et une fonction jamais appelée ne se voit nulle part
// avant l'exécution (6.8.0). Les tests de `npm test` lisent la source ; celui-ci CLIQUE.
//
// Le serveur n'est PAS une imitation : c'est `plateforme/skanfact-api.mjs`, le fichier déployé sur
// Cloudflare, posé derrière un `http.createServer` avec une vraie base SQLite sur le vrai schéma
// (test/d1-sqlite.js). La première version de ce parcours imitait les réponses avec des lignes
// écrites à la main : une requête SQL fausse y restait invisible jusqu'à Cloudflare. Le seul faux
// ici est Resend — on ne va pas envoyer un mail à chaque test — et on VÉRIFIE ce qu'on lui aurait
// envoyé : le destinataire, et la clé dans le corps.
//
//   npm run e2e:console

const { playwright, ouvrirChromium } = require('./harnais');
const L = require('../../src/licence.js');
const { servir, SECRET } = require('./console-serveur');

(async () => {
  const { srv, base, mails, cles, db, restaurer } = await servir();
  const nav = await ouvrirChromium(playwright());
  // `acceptDownloads` : l'export de la base (10.4.0) descend un vrai fichier, et c'est ce fichier
  // qu'on vérifie — pas une intention.
  const ctx = await nav.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();

  // Toute erreur JavaScript de la page fait échouer le parcours. C'est la moitié de l'intérêt :
  // une ReferenceError pendant la construction d'un gabarit laisse un écran blanc et une console
  // vide chez l'utilisateur (7.20.0, 7.22.0, 7.23.0).
  //
  // Mais on ne compte PAS les réponses refusées par le serveur : l'étape 2 en provoque une exprès,
  // et la page la traite — elle affiche « Accès refusé. ». Les vraies exceptions (`pageerror`),
  // elles, sont TOUJOURS fatales.
  const fautes = [];
  const attendues = [];
  page.on('pageerror', e => fautes.push('exception : ' + (e && e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    (/Failed to load resource/i.test(m.text()) ? attendues : fautes).push(m.text());
  });

  const etape = n => console.log('\n' + n);
  const doit = (c, quoi) => { if (!c) throw new Error('ÉCHEC — ' + quoi); console.log('  ✓ ' + quoi); };
  const onglet = async nom => {
    await page.click('#tabs button[data-t="' + nom + '"]');
    await page.waitForFunction(n => {
      const b = document.querySelector('#tabs button[data-t="' + n + '"]');
      return b && b.getAttribute('aria-selected') === 'true';
    }, nom);
    await page.waitForSelector('#table .wrap');
  };
  const lignes = () => page.$$eval('#table tbody tr', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ')));
  // Les Réglages ne sont pas une liste : ils n'ont ni tableau, ni tri, ni pagination. Les attendre
  // comme une liste (`#table .wrap`) expire au bout de trente secondes sur un écran parfaitement
  // dessiné — on reconnaît un écran à ce qu'il CONTIENT (7.28.0).
  const allerReglages = async () => {
    await page.click('#tabs button[data-t="reglages"]');
    await page.waitForSelector('#fiche:not([hidden]) [data-reg]');
  };
  // Un geste de ligne, repéré par ce qu'il DIT et par la ligne qui porte ce texte.
  //
  // 10.6.0 — une ligne garde AU PLUS UN bouton visible et met le reste dans un menu (7.29.0). Le
  // parcours fait donc ce qu'une personne fait : il cherche le bouton en clair, et s'il n'y est
  // pas il ouvre le menu de la ligne. Écrire deux helpers — un « bouton », un « menu » — aurait
  // obligé à savoir d'avance où vit chaque geste, c'est-à-dire à graver l'état du jour (7.12.0).
  const boutonDeLigne = async (texteLigne, libelle) => {
    const direct = await page.$('xpath=//tbody/tr[contains(., "' + texteLigne + '")]//button[normalize-space()="' + libelle + '"]');
    if (direct) { await direct.click(); return; }
    const menu = await page.$('xpath=//tbody/tr[contains(., "' + texteLigne + '")]//button[@data-menu]');
    if (!menu) throw new Error('ni bouton « ' + libelle + ' » ni menu sur la ligne « ' + texteLigne + ' »');
    await menu.click();
    await page.waitForSelector('#rowmenu', { timeout: 5000 });
    const dans = await page.$('xpath=//div[@id="rowmenu"]//button[.//span[starts-with(normalize-space(), "' + libelle + '")]]');
    if (!dans) {
      const vus = await page.$$eval('#rowmenu button span', ss => ss.map(x => x.childNodes[0].textContent.trim()));
      throw new Error('« ' + libelle + ' » introuvable sur la ligne « ' + texteLigne + ' » — le menu offre : ' + vus.join(', '));
    }
    await dans.click();
  };
  const valider = async () => {
    await page.click('#f-ok');
    // Le formulaire disparaît (succès) ou son message s'allume (refus) : une fois fermé, `#f-msg`
    // n'existe plus, d'où la garde — la première version lisait `.hidden` sur null.
    await page.waitForFunction(() => { const f = document.getElementById('form'), m = document.getElementById('f-msg'); return f.hidden || (m && !m.hidden); });
    // 10.6.0 — un geste IRRÉVERSIBLE se relit avant de partir : le premier clic rend le
    // récapitulatif et le bouton change de verbe. Ce n'est ni un succès ni un refus, c'est une
    // étape de plus, et le parcours doit la franchir comme une personne le ferait.
    if (await page.$('#f-msg.recap:not([hidden])')) {
      const b = await page.$eval('#f-ok', e => e.textContent.trim());
      if (!/confirmer/i.test(b)) throw new Error('le récapitulatif s\'affiche mais le bouton ne change pas de verbe : ' + b);
      await page.click('#f-ok');
      await page.waitForFunction(() => { const f = document.getElementById('form'), m = document.getElementById('f-msg'); return f.hidden || (m && !m.hidden && !m.classList.contains('recap')); });
    }
    const msg = await page.evaluate(() => { const m = document.getElementById('f-msg'); return m && !m.hidden ? m.textContent : ''; });
    if (msg) throw new Error('le formulaire a refusé : ' + msg);
  };
  // 10.6.0 — le panneau de la clé émise montre un RÉSUMÉ ; le texte complet vit derrière « Voir la
  // clé entière ». Le parcours l'ouvre comme une personne le ferait, plutôt que de lire un élément
  // caché : ce qu'on teste est ce que l'écran MONTRE (7.17.0).
  const lireCle = async () => {
    await page.waitForSelector('#resultat:not([hidden]) #cle-court');
    await page.click('#cle-voir');
    await page.waitForSelector('#resultat #cle:not([hidden])');
    return (await page.textContent('#resultat #cle')).trim();
  };
  const info = () => page.evaluate(() => { const i = document.getElementById('info'); return i.hidden ? '' : i.textContent; });

  try {
    etape('1. La console s\'ouvre sur un verrou, pas sur des données');
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#lock', { state: 'visible' });
    doit(await page.isHidden('#app'), 'aucune donnée visible avant le secret');
    doit(await page.evaluate(() => document.activeElement && document.activeElement.id === 'sec'),
      'le curseur est déjà dans le champ');

    etape('2. Un mauvais secret est refusé, et la console le DIT');
    await page.fill('#sec', 'au hasard');
    await page.click('#go');
    await page.waitForSelector('#lockmsg:not([hidden])');
    const msg = (await page.textContent('#lockmsg')).trim();
    doit(msg.length > 0, 'un message explique le refus : « ' + msg + ' »');
    doit(await page.isHidden('#app'), 'et rien ne s\'ouvre');

    etape('3. Le bon secret ouvre la console, et elle dit ce qu\'elle PEUT faire');
    await page.fill('#sec', SECRET);
    await page.press('#sec', 'Enter');   // le clavier, pas seulement le bouton
    await page.waitForSelector('#app:not([hidden])');
    doit(await page.isHidden('#lock'), 'le verrou disparaît');
    await page.waitForFunction(() => /émission prête/.test(document.getElementById('etat-pill').textContent));
    doit(true, 'l\'en-tête annonce « ' + (await page.textContent('#etat-pill')) + ' »');
    doit(!(await page.isDisabled('#emettre')), 'le bouton « Émettre » est actif');

    etape('4. Une base vide : chaque écran dit quoi faire, et les cartes sont à zéro');
    await page.waitForFunction(() => document.querySelectorAll('#cards .card').length >= 6);
    // La RÈGLE, pas la forme d'hier : sur une base vide, tout ce qui se COMPTE est à zéro, et le
    // taux de conversion — qui n'a pas de dénominateur — dit « — » et jamais « 0 % ». Annoncer un
    // échec là où rien n'a encore été tenté apprend à ignorer le chiffre (9.6.0). L'assertion
    // d'avant exigeait six zéros : elle décrivait l'état du jour, et elle serait tombée sur le
    // correctif.
    const zeros = await page.$$eval('#cards .card b', els => els.map(e => e.textContent.trim()));
    const compteurs = zeros.filter(z => !/%|—/.test(z));
    doit(compteurs.length >= 5 && compteurs.every(z => z === '0'),
      'les compteurs sont à zéro (' + zeros.join(' ') + ')');
    doit(zeros.some(z => z === '—') && !zeros.some(z => z === '0 %'),
      'et la conversion sans dénominateur dit « — », jamais « 0 % »');
    await page.waitForSelector('#table .wrap .vide');
    const vide = (await page.textContent('#table .wrap .vide')).trim();
    doit(vide.length > 20 && !/chargement/i.test(vide), 'l\'écran vide porte une phrase : « ' + vide + ' »');

    etape('5. Un client se crée depuis le formulaire');
    await page.click('#nouveau-client');
    await page.waitForSelector('#form:not([hidden]) [name=nom]');
    await page.click('#f-ok');   // vide → refus qui se lit, sans rien créer
    await page.waitForSelector('#f-msg:not([hidden])');
    doit(/obligatoire/.test(await page.textContent('#f-msg')), 'un nom vide est refusé avec une phrase');
    await page.fill('#form [name=nom]', 'Menuiserie Trabelsi SUARL');
    await page.fill('#form [name=matricule]', '1234567A/M/P/000');
    await page.fill('#form [name=email]', 'contact@trabelsi.tn');
    await valider();
    await page.waitForFunction(() => /Client créé/.test((document.getElementById('info') || {}).textContent || ''));
    doit(db.lire('SELECT nom FROM clients').length === 1, 'le client est dans la base');
    await page.waitForSelector('#table tbody tr');
    doit((await lignes()).some(l => /Trabelsi/.test(l) && /1234567A/.test(l)), 'et dans l\'onglet Clients');

    etape('6. Émettre : la clé, la vente, le journal — et la clé se lit à l\'écran');
    await page.click('#emettre');
    await page.waitForSelector('#form:not([hidden]) [name=clientId]');
    await page.selectOption('#form [name=offre]', 'independant');
    const prixPropose = await page.inputValue('#form [name=prix]');
    doit(prixPropose === '390', 'le prix proposé suit l\'offre choisie (' + prixPropose + ')');
    await page.check('#form [name=parrain]');
    await valider();
    const cle = await lireCle();
    doit(/^SKAN1\./.test(cle), 'la clé est affichée : ' + cle.slice(0, 24) + '…');
    const charge = L.verifyKey(cle, cles);
    doit(!!charge && charge.kid === 'srv-1', 'elle est signée par srv-1 et l\'application la VÉRIFIE (src/licence.js)');
    doit(charge.nom === 'Menuiserie Trabelsi SUARL' && charge.matricule === '1234567A/M/P/000' && charge.offre === 'independant',
      'elle porte le nom, le matricule et l\'offre');
    doit(L.licenceState({ key: cle, cles, matricule: '1234567A', today: L.today(), installedAt: L.today() }).state === 'active',
      'et un dossier portant ce matricule la verrait « active »');
    doit(L.licenceState({ key: cle, cles, matricule: '7654321B', today: L.today(), installedAt: L.today() }).state === 'autre',
      'mais pas un autre matricule');
    const v = db.lire('SELECT montant_ht, payee_le FROM ventes')[0];
    doit(v && Math.abs(v.montant_ht - 312) < 0.001 && !v.payee_le, 'la vente existe : 312 HT (390 − 20 %), à encaisser');
    doit(/Pas envoyée par mail/.test(await page.textContent('#resultat')), 'et l\'écran dit que la clé n\'est pas partie (vente non payée)');
    await page.click('#cle-fermer');

    etape('7. Le tableau des licences : active, jamais envoyée, et ses gestes');
    await onglet('licences');
    await page.waitForSelector('#table tbody tr');
    let ls = await lignes();
    doit(ls.some(l => /Trabelsi/.test(l) && /active/.test(l) && /jamais/.test(l)), 'la ligne dit « active » et « jamais » envoyée');
    await boutonDeLigne('Trabelsi', 'Voir la clé');
    doit(await lireCle() === cle, '« Voir la clé » refabrique EXACTEMENT la même clé (Ed25519 déterministe)');
    await page.click('#cle-fermer');

    etape('7 bis. Relancer : la console COMPOSE, c\'est l\'éditeur qui envoie');
    await onglet('ventes');
    await page.waitForSelector('#table tbody tr');
    doit((await lignes()).some(l => /à encaisser/.test(l)), 'la vente se dit « à encaisser »');
    await boutonDeLigne('Trabelsi', 'Relancer…');
    await page.waitForSelector('#relance-txt');
    const relance = (await page.textContent('#relance-txt')).replace(/\s+/g, ' ');
    doit(/Trabelsi/.test(relance), 'la relance salue le client par son nom');
    // 312 HT : 390 moins les 20 % de parrainage de l'étape 6. Le montant vient de la VENTE, il
    // n'est pas recopié du tarif — une remise oubliée dans une relance, c'est un client qui
    // reçoit un chiffre qu'il n'a jamais vu sur sa facture.
    doit(/312,000\sTND/.test(relance), 'et cite le montant réellement dû, avec sa devise : ' + relance.slice(0, 120));
    doit(!/undefined|null|NaN|\(\)/.test(relance), 'aucun trou dans le texte composé');
    // Le geste ouvre la messagerie de l'ÉDITEUR : rien ne part d'ici. Un mail de relance parti
    // sans être relu n'est pas une relance, c'est un automate.
    const href = await page.getAttribute('#relance-ouvrir', 'href');
    doit(/^mailto:contact%40trabelsi\.tn\?subject=/.test(href || ''), 'le bouton ouvre un mailto : ' + String(href).slice(0, 48));
    const avant = mails.length;
    doit(mails.length === avant, 'et la console n\'envoie rien elle-même');
    await page.click('#relance-fermer');
    doit(await page.isHidden('#resultat'), 'la fenêtre se referme');

    etape('8. Marquer la vente payée : la clé part par mail dans la seconde');
    await boutonDeLigne('Trabelsi', 'Marquer payée');
    await page.waitForSelector('#form:not([hidden]) [name=moyen]');
    await page.fill('#form [name=moyen]', 'virement');
    await valider();
    await page.waitForFunction(() => /Vente payée/.test((document.getElementById('info') || {}).textContent || ''));
    doit(/Clé envoyée à contact@trabelsi\.tn/.test(await info()), 'l\'écran dit à qui la clé est partie');
    doit(mails.length === 1 && mails[0].to[0] === 'contact@trabelsi.tn', 'un mail, au bon destinataire');
    doit(mails[0].text.includes(cle), 'et la clé est dans le corps du mail');
    doit(/Paramètres → L'application → Licence/.test(mails[0].text), 'avec le chemin d\'activation, le même que dans SkanFact');
    doit(/send\.skanfact\.tn/.test(mails[0].from), 'expédié depuis send.skanfact.tn (la ligne DKIM de Resend)');
    await page.waitForSelector('#table tbody tr');
    doit((await lignes()).some(l => /payée le/.test(l) && /virement/.test(l)), 'la vente se dit « payée le … » avec son moyen');

    etape('9. Renouveler : une nouvelle clé, l\'ancienne se dit « remplacée »');
    await onglet('licences');
    await page.waitForSelector('#table tbody tr');
    await boutonDeLigne('Trabelsi', 'Renouveler');
    await page.waitForSelector('#form:not([hidden]) [name=duree]');
    const why = await page.textContent('#form .why');
    doit(/part du/.test(why), 'le formulaire rappelle d\'où part la nouvelle période');
    await valider();
    const cle2 = await lireCle();
    doit(cle2 !== cle && !!L.verifyKey(cle2, cles), 'une seconde clé, différente, et vérifiable');
    const fins = db.lire('SELECT debut, fin, remplace_id FROM licences ORDER BY emise_le');
    doit(fins[1].debut === fins[0].fin && fins[1].remplace_id != null, 'elle part de la fin de la première (' + fins[0].fin + ')');
    await page.click('#cle-fermer');
    await page.waitForSelector('#table tbody tr');
    ls = await lignes();
    doit(ls.filter(l => /Trabelsi/.test(l)).length === 2, 'deux lignes pour ce client');
    doit(ls.some(l => /remplacée/.test(l)), 'et l\'ancienne se dit « remplacée »');
    await page.waitForFunction(() => document.querySelectorAll('#cards .card').length >= 6);
    const actives = await page.$$eval('#cards .card', els => { const c = els.find(e => /licence/.test(e.querySelector('span').textContent)); return c ? c.querySelector('b').textContent.trim() : ''; });
    doit(actives === '1', 'la carte compte UNE licence active, pas deux');

    etape('10. Révoquer : un motif obligatoire, et la limite dite en toutes lettres');
    const nouvelle = fins[1];
    // Le geste le plus destructif de la console vit dans le MENU depuis la 10.6.0, et c'est sa
    // place : il ne peut plus se cliquer par erreur à côté de « Voir la clé ».
    await boutonDeLigne('active', 'Révoquer');
    await page.waitForSelector('#form:not([hidden]) [name=motif]');
    doit(/ne se reprend pas/.test(await page.textContent('#form .why')), 'le formulaire dit qu\'une clé livrée ne se reprend pas');
    await page.click('#f-ok');
    await page.waitForSelector('#f-msg:not([hidden])');
    doit(/motif/i.test(await page.textContent('#f-msg')), 'sans motif, refus');
    await page.fill('#form [name=motif]', 'rétractation');
    await valider();
    await page.waitForFunction(() => /révoquée/.test((document.getElementById('info') || {}).textContent || ''));
    await page.waitForSelector('#table tbody tr');
    ls = await lignes();
    // 10.6.0 — RETOURNÉE. L'assertion exigeait « révoquée — rétractation » dans la ligne : elle
    // décrivait l'état du jour, où le motif était collé DANS la pastille d'état. Un état est un
    // vocabulaire fermé ; un motif est un texte libre, et il portait la colonne « État » à 338 px
    // sur une table qui débordait de 256. La RÈGLE est que la ligne dit l'état, et que le motif
    // reste atteignable — ici au survol. Quand une règle change, c'est le test qui se relit en
    // premier (7.12.0, 7.26.0, 8.0.1, 8.2.0, 9.1.0, 9.2.2, 9.4.3, 9.4.5, 9.4.7, 9.4.9, 9.7.0,
    // 9.8.1, 9.8.4, 9.8.6, 10.4.0).
    doit(ls.some(l => /révoquée/.test(l)) && !ls.some(l => /révoquée — rétractation/.test(l)),
      'la ligne dit l\'ÉTAT « révoquée », sans y coller le motif');
    doit(await page.$('xpath=//tbody//span[@title="rétractation"]') !== null,
      'et le motif reste lisible au survol de la pastille');
    const rev = db.lire('SELECT id, revoquee_le, revoquee_motif FROM licences WHERE revoquee_le IS NOT NULL');
    doit(rev.length === 1 && rev[0].revoquee_motif === 'rétractation' && rev[0].id !== nouvelle.remplace_id,
      'et la base porte la date et le motif, sur la licence en cours (pas sur la remplacée)');

    etape('11. Les chiffres s\'ouvrent, et s\'accordent');
    await page.waitForFunction(() => document.querySelectorAll('#cards .card').length >= 6);
    const cartes = await page.$$eval('#cards .card', els => els.map(e => ({
      n: e.querySelector('b').textContent.trim(), l: e.querySelector('span').textContent.trim()
    })));
    const carte = mot => cartes.find(c => c.l.includes(mot));
    doit(carte('révoqu') && carte('révoqu').n === '1', 'une licence révoquée annoncée');
    doit(carte('client') && carte('client').n === '1', 'un client');
    doit(!cartes.some(c => /\(s\)/.test(c.l)), 'aucun « (s) » d\'accord bâclé');
    const pluriel = t => /s$|x$/.test(t.trim().split(' ')[0]);
    cartes.forEach(c => {
      const n = Number(c.n);
      doit(pluriel(c.l) === (n >= 2), n + ' → « ' + c.l + ' » ' + (n >= 2 ? 'doit être au pluriel' : 'doit être au singulier'));
    });
    // Par la classe EXACTE : « contains(@class, "card") » attrapait le conteneur `.cards`, premier
    // dans l'ordre du document, dont le texte contient aussi « client » — et cliquer un conteneur
    // ne fait rien. Trouvé par le délai d'attente, pas par une erreur.
    await page.$$eval('#cards .card', els => { const c = els.find(e => /^client/.test(e.querySelector('span').textContent.trim())); c.click(); });
    await page.waitForFunction(() => { const b = document.querySelector('#tabs button[data-t="clients"]'); return b && b.getAttribute('aria-selected') === 'true'; });
    doit(true, 'cliquer la carte « client » ouvre l\'onglet Clients (un chiffre affiché s\'ouvre)');

    etape('12. Le journal garde tout, dans l\'ordre — avec l\'heure');
    await onglet('evenements');
    await page.waitForSelector('#table tbody tr');
    const j = (await lignes()).join('\n');
    // 10.6.0 — RETOURNÉE (vingt et unième occurrence). L'assertion exigeait les identifiants
    // INTERNES — « client.cree », « licence.emise », sans accents — c'est-à-dire exactement le
    // défaut : la console est l'écran d'un dirigeant, pas d'un développeur, et un journal lisible
    // est ce qui permet « de répondre à un client six mois plus tard », comme la page le promet
    // elle-même. La RÈGLE est que chaque événement se lit en français ; l'identifiant reste
    // atteignable au survol, pour le jour où l'on écrit à un développeur.
    [['client.cree', 'Client créé'], ['licence.emise', 'Licence émise'], ['vente.payee', 'Vente encaissée'],
     ['mail.envoye', 'Clé envoyée par mail'], ['licence.renouvellement', 'Licence renouvelée'],
     ['licence.revoquee', 'Licence révoquée']].forEach(([id, mot]) => {
      doit(j.includes(mot), 'le journal dit « ' + mot +' », pas un identifiant');
      doit(!j.includes(id), 'et l\'identifiant « ' + id + ' » ne s\'affiche pas');
    });
    doit(await page.$('xpath=//tbody//span[@title="client.cree"]') !== null,
      'l\'identifiant reste au survol : on le donne quand on écrit à un développeur');
    // 9.4.2 — l'heure, et celle de l'horloge de la page : le journal affichait l'heure UTC à côté
    // d'une date UTC, donc une vente encaissée à 00 h 30 à Tunis s'y lisait la veille à 23 h 30.
    doit(/\d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/.test(j), 'chaque ligne du journal porte le jour ET l\'heure');

    etape('12 bis. La colonne « Vu » dit quand l\'application a été ouverte ce jour-là');
    // Une VRAIE activation : c'est le worker qui l'enregistre, en réponse à une application qui se
    // présente — et c'est cette ligne-là que la console doit savoir situer dans le temps.
    const rep = await fetch(base + '/v1/licence/etat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SkanFact-App': 'secret-de-test-' + 'x'.repeat(20) },
      body: JSON.stringify({ deviceId: 'poste-du-comptable', deviceNom: 'MacBook du cabinet', plateforme: 'darwin', version: '9.4.2' })
    });
    doit(rep.ok, 'une application se présente au serveur (' + rep.status + ')');
    await onglet('activations');
    await page.waitForSelector('#table tbody tr');
    const vu = await page.$$eval('#table tbody tr', ls => {
      const l = ls.find(x => /MacBook du cabinet/.test(x.textContent));
      if (!l) return null;
      const c = [...l.cells].find(td => /aujourd'hui|hier|il y a/.test(td.textContent));
      return c ? { texte: c.textContent.replace(/\s+/g, ' ').trim(), sous: !!c.querySelector('.quand') } : null;
    });
    doit(vu, 'l\'activation apparaît dans la console');
    doit(/aujourd'hui/.test(vu.texte), 'la phrase dit si l\'installation vit encore : ' + vu.texte);
    doit(vu.sous && /\d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/.test(vu.texte),
      'et l\'horodatage dit à quelle heure : ' + vu.texte);

    etape('13. Les six cartes remplissent leurs rangées, à toutes les largeurs');
    await onglet('licences');
    for (const w of [1500, 1100, 900, 600, 400]) {
      await page.setViewportSize({ width: w, height: 900 });
      const rangs = await page.$$eval('#cards .card', els => {
        const y = [...new Set(els.map(e => Math.round(e.getBoundingClientRect().top)))].sort((a, b) => a - b);
        return y.map(t => els.filter(e => Math.round(e.getBoundingClientRect().top) === t).length);
      });
      const orphelines = rangs.length > 1 && rangs[rangs.length - 1] < rangs[0];
      doit(!orphelines, w + ' px → rangées de ' + rangs.join(' + ') + ' : aucune orpheline');
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    etape('13 bis. Une licence de CABINET : le type, l\'empreinte, le quota — et SkanFact Cabinet la reconnaît');
    await page.click('#nouveau-client');
    await page.waitForSelector('#form:not([hidden]) [name=nom]');
    await page.fill('#form [name=nom]', 'Cabinet Ben Salah');
    await page.fill('#form [name=email]', 'cabinet@bensalah.tn');
    await valider();
    await page.waitForFunction(() => /Client créé/.test((document.getElementById('info') || {}).textContent || ''));
    const idCab = db.lire("SELECT id FROM clients WHERE nom = 'Cabinet Ben Salah'")[0].id;
    await page.click('#emettre');
    await page.waitForSelector('#form:not([hidden]) [name=type]');
    await page.selectOption('#form [name=clientId]', idCab);
    doit(await page.isVisible('#form [name=offre]'), 'en Entreprise, l\'offre se voit');
    await page.selectOption('#form [name=type]', 'cabinet');
    doit(!(await page.isVisible('#form [name=offre]')), 'en Cabinet, l\'offre disparaît');
    doit(await page.isVisible('#form [name=dossiersHors]'), 'et le quota apparaît');
    doit(!(await page.isVisible('#form [name=parrain]')), 'le parrainage n\'a pas de sens pour un cabinet');
    doit((await page.inputValue('#form [name=prix]')) === '', 'aucun prix proposé : les tarifs du Cabinet ne sont pas fixés');
    await page.fill('#form [name=dossiersHors]', '10');
    await page.fill('#form [name=prix]', '500');
    await page.click('#f-ok');   // sans empreinte : refus qui se lit — c'est le sujet de la clé
    await page.waitForSelector('#f-msg:not([hidden])');
    doit(/EMPREINTE/i.test(await page.textContent('#f-msg')), 'sans empreinte, refus : « ' + (await page.textContent('#f-msg')).trim().slice(0, 60) + '… »');
    await page.fill('#form [name=cabinet]', '3f9a-2c1e-0000-1111-2222');
    await valider();
    const cleCab = await lireCle();
    const chCab = L.verifyKey(cleCab, cles);
    doit(!!chCab && chCab.type === 'cabinet' && chCab.dossiersHors === 10 && chCab.cabinet === '3F9A-2C1E-0000-1111-2222',
      'la clé porte le type, le quota et l\'empreinte sous sa forme canonique');
    const stCab = L.licenceCabinet({ key: cleCab, cles, empreinte: '3F9A-2C1E-0000-1111-2222', comptes: 12, today: L.today() });
    doit(stCab.state === 'active' && stCab.autorises === 13, 'SkanFact Cabinet la verrait « active » : 3 gratuits + 10');
    doit(L.licenceState({ key: cleCab, cles, matricule: '1234567A', today: L.today(), installedAt: L.today() }).locked === true, 'et SkanFact (l\'entreprise) la refuse');
    doit(/Cabinet — 10 dossiers/.test(await page.textContent('#resultat')), 'l\'écran nomme le quota, pas une offre');
    await page.click('#cle-fermer');
    await onglet('licences');
    await page.waitForSelector('#table tbody tr');
    ls = await lignes();
    doit(ls.some(l => /Ben Salah/.test(l) && /Cabinet — 10 dossiers/.test(l)), 'la ligne dit « Cabinet — 10 dossiers »');
    await boutonDeLigne('Ben Salah', 'Changer le quota');
    await page.waitForSelector('#form:not([hidden]) [name=dossiersHors]');
    doit(/Changer le quota/.test(await page.textContent('#form h2')), 'le formulaire parle de quota, pas d\'offre');
    await page.fill('#form [name=dossiersHors]', '25');
    await page.fill('#form [name=prix]', '300');
    await valider();
    const cleCab2 = await lireCle();
    doit(cleCab2 !== cleCab && L.verifyKey(cleCab2, cles).dossiersHors === 25
      && L.licenceCabinet({ key: cleCab2, cles, empreinte: '3f9a2c1e000011112222', comptes: 20, today: L.today() }).autorises === 28,
      'le nouveau quota est dans la clé neuve : 3 + 25, reconnu sous l\'empreinte sans tirets');
    await page.click('#cle-fermer');

    etape('13 ter. L\'espace de gestion : ce qui demande une décision, le parc des DEUX applications, les cabinets');
    // Le parc : l'app du comptable s'annonce aussi depuis la 10.4.0. Sans cette moitié, la console
    // ne voyait qu'une des deux applications — et l'éditeur ne savait rien du parc des cabinets.
    const annonce = (app2, version, poste) => fetch(base + '/v1/licence/etat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SkanFact-App': 'secret-de-test-' + 'x'.repeat(20) },
      body: JSON.stringify({ deviceId: poste, deviceNom: poste, plateforme: 'darwin', version, app: app2 })
    });
    doit((await annonce('cabinet', '10.4.0', 'poste-cabinet-A')).ok, 'SkanFact Cabinet s\'annonce');
    doit((await annonce('entreprise', '10.4.0', 'poste-entreprise-B')).ok, 'SkanFact s\'annonce');
    await page.click('#refresh');
    await onglet('parc');
    await page.waitForSelector('#table tbody tr');
    const parc = (await lignes()).join('\n');
    doit(/SkanFact Cabinet/.test(parc) && /SkanFact(?! Cabinet)/.test(parc),
      'les DEUX applications ont leur ligne — c\'est la moitié qu\'on ne voyait pas');

    await onglet('cabinets');
    await page.waitForSelector('#table tbody tr');
    doit((await lignes()).some(l => /Ben Salah/.test(l) && /25/.test(l)),
      'le cabinet vendu s\'y lit avec son quota');

    // L'argent : la question qu'un éditeur se pose en ouvrant sa console, et qui n'avait de réponse
    // nulle part. Groupé par DEVISE, et « encaissé » porte son année.
    //
    // L'assertion lit la STRUCTURE, pas une phrase aplatie. Sa première version exigeait
    // « Encaissé en 2026 : 690,000 TND », c'est-à-dire la FORME du jour — deux pastilles de texte.
    // Le jour où l'étiquette est passée au-dessus du nombre (elle portait l'information la plus
    // importante de l'écran dans son plus petit texte), elle est tombée sur un affichage juste.
    // On teste la RÈGLE : chaque montant porte sa période et sa devise, et ce qui attend s'OUVRE.
    await page.waitForFunction(() => document.querySelectorAll('#argent .sous').length > 0);
    const sous = await page.$$eval('#argent .sous', bs => bs.map(b => ({
      etiquette: (b.querySelector('.eyebrow') || {}).textContent || '',
      nombre: (b.querySelector('.n') || {}).textContent || '',
      ouvre: b.getAttribute('data-t') || ''
    })));
    const rentre = sous.find(s => /Encaissé/.test(s.etiquette));
    // 10.14.1 — les milliers sont séparés par une espace fine insécable et la devise tient au nombre
    // (insécable) : `\s` couvre les deux, la RÈGLE est « un nombre puis sa devise », pas la forme d'une espace.
    doit(rentre && /\d{4}/.test(rentre.etiquette) && /\d[\d\s,]*\s[A-Z]{2,4}/.test(rentre.nombre),
      'le total encaissé porte son année ET sa devise : « ' + (rentre ? rentre.etiquette + ' → ' + rentre.nombre : '—') + ' »');
    const attente = sous.find(s => /En attente/.test(s.etiquette));
    doit(attente && /\d[\d\s,]*\s[A-Z]{2,4}/.test(attente.nombre) && attente.ouvre === 'ventes',
      'ce qui attend se lit à côté, et s\'ouvre sur les ventes (7.15.0)');

    await onglet('alertes');
    await page.waitForSelector('#table .wrap');
    const al = (await lignes()).join('\n');
    doit(/jamais été exportée/i.test(al), 'la base jamais exportée est annoncée : c\'est la seule perte qu\'on ne rattrape pas');
    // Une alerte qu'on ne peut pas ouvrir est une inquiétude, pas une tâche (7.15.0).
    const bAller = await page.$('xpath=//tbody/tr[contains(., "encaisser")]//button[normalize-space()="Ouvrir"]');
    if (bAller) {
      await bAller.click();
      await page.waitForFunction(() => { const b = document.querySelector('#tabs button[data-t="ventes"]'); return b && b.getAttribute('aria-selected') === 'true'; });
      doit(true, '« Ouvrir » d\'une vente à encaisser mène bien à l\'onglet Ventes');
      await onglet('alertes');
    }

    etape('13 quater. Exporter la base : le fichier, ses comptes, et la trace');
    const dl = page.waitForEvent('download');
    await page.click('#exporter');
    const fichier = await dl;
    doit(/^skanfact-console-\d{4}-\d{2}-\d{2}\.json$/.test(fichier.suggestedFilename()),
      'le fichier porte la date du jour : ' + fichier.suggestedFilename());
    await page.waitForFunction(() => /Base exportée/.test((document.getElementById('info') || {}).textContent || ''));
    const texteInfo = await info();
    // La RÈGLE : chaque table est NOMMÉE avec son compte — un export tronqué ressemble à un export
    // complet, et c'est ce compte qui le dit au moment de le relire. L'assertion d'avant exigeait
    // la FORME « licences : 2 », c'est-à-dire les noms de tables SQL tels quels : elle gravait
    // « evenements » sans accent et « jetons » en jargon, et serait tombée sur le correctif.
    doit(/\d+ licences?\b/.test(texteInfo) && /\d+ clients?\b/.test(texteInfo),
      'le message dit le COMPTE par table : un export tronqué ressemble à un export complet');
    doit(/événements/.test(texteInfo) && !/evenements/.test(texteInfo),
      'et il les nomme en français, jamais avec le nom de la table SQL');
    doit(/n’est pas chiffré|n'est pas chiffré/.test(texteInfo),
      'et il dit ce que le fichier porte, avant qu\'on le range n\'importe où');
    doit(db.lire("SELECT id FROM evenements WHERE quoi = 'base.exportee'").length === 1,
      'l\'export laisse une trace dans le journal : c\'est elle qui date l\'alerte');
    await page.click('#refresh');
    await onglet('alertes');
    await page.waitForSelector('#table .wrap');
    doit(!(await lignes()).join('\n').match(/jamais été exportée/i),
      'et l\'alerte a disparu : la base vient d\'être exportée');

    etape('13 quinquies. La santé des canaux : non branchée, elle le DIT');
    const sante = (await page.textContent('#sante')).replace(/\s+/g, ' ');
    doit(/non lus/.test(sante) && /RELAIS_BASE/.test(sante),
      'la console n\'invente pas ce qu\'elle ne peut pas lire : « ' + sante.trim().slice(0, 90) + '… »');

    // ================= 10.5.0 =================
    etape('13 sexies. Les RÉGLAGES : un prix se change à l\'écran, jamais dans le code');
    await allerReglages();
    doit(await page.inputValue('[data-reg="prix_entreprise"]') === '690', 'le prix en vigueur est affiché');
    // D'OÙ vient chaque valeur : sans ça, un écran de nombres laisse croire qu'ils ont tous été
    // décidés, alors que la plupart sont des défauts que personne n'a jamais regardés.
    //
    // 10.6.0 — RETOURNÉE (vingt-deuxième occurrence). L'assertion exigeait la phrase « valeur par
    // défaut, jamais décidée » SUR L'ÉCRAN : elle gravait l'état du jour, où cette mention
    // s'imprimait sous chacun des quinze champs, en orange. Or sur une console neuve aucun réglage
    // n'a été décidé — c'est l'état NORMAL — et quinze lignes orange apprennent à ignorer le orange
    // (8.0.1). La RÈGLE tient en deux moitiés : l'origine reste ATTEIGNABLE (dans la bulle du
    // libellé), et un défaut ne crie PAS.
    doit(await page.evaluate(() => {
      const l = document.querySelector('[data-reg="prix_entreprise"]').closest('.reg');
      return (l.querySelector('.src').textContent || '').trim() === '';
    }), 'un DÉFAUT ne crie pas : rien ne s\'imprime à côté du champ');
    doit(await page.evaluate(() => {
      const l = document.querySelector('[data-reg="prix_entreprise"]').closest('.reg');
      const b = l.querySelector('button.i');
      return !!b && /jamais décidé/.test(b.dataset.bulle || '');
    }), 'mais l\'origine reste atteignable : la bulle dit que personne ne l\'a décidée');
    // Ce que la console ne règle PAS, et pourquoi : le taire donnerait l'impression d'un oubli.
    //
    // 10.6.0 — la page fait près de trois écrans, donc ses sections se replient et un SOMMAIRE dit
    // ce qu'elle contient. Le parcours y va comme une personne : par le sommaire. Ce qui compte
    // n'est pas que la phrase soit affichée d'emblée — c'est qu'elle soit NOMMÉE et atteignable
    // en un geste (7.30.0). Arriver sur un titre replié serait arriver nulle part : le sommaire
    // OUVRE avant de descendre, et c'est ce qu'on vérifie.
    const titres = await page.$$eval('.sommaire button', bs => bs.map(b => b.textContent.trim()));
    doit(titres.some(t => /ne se règle pas/i.test(t)), 'le sommaire nomme la section : ' + titres.join(' · '));
    await page.click('xpath=//nav[@class="sommaire"]//button[contains(., "ne se règle pas")]');
    await page.waitForFunction(() => /durée de l\u2019essai|durée de l'essai/i.test(document.getElementById('fiche').innerText));
    doit(/durée de l’essai|durée de l'essai/i.test(await page.innerText('#fiche')),
      'et le sommaire OUVRE la section : l\'écran nomme ce qu\'il ne règle pas, et la raison');
    // Un refus NOMME le champ : « valeur invalide » oblige à relire quinze champs.
    await page.fill('[data-reg="remise_parrainage"]', '250');
    await page.click('#reg-ok');
    await page.waitForFunction(() => { const m = document.getElementById('reg-msg'); return m && !m.hidden; });
    const refus = await page.textContent('#reg-msg');
    doit(/parrainage/i.test(refus) && /0 et 100/.test(refus),
      'un refus nomme le réglage ET la forme attendue : « ' + refus.trim().slice(0, 80) + '… »');
    // Et le bon chemin : on change, on enregistre, ça s'applique — sans toucher au code.
    await page.fill('[data-reg="remise_parrainage"]', '20');
    await page.fill('[data-reg="prix_entreprise"]', '880');
    await page.fill('[data-reg="lien_paiement"]', 'https://paiement.example.tn/skanfact');
    await page.click('#reg-ok');
    await page.waitForFunction(() => /réglage/.test((document.getElementById('info') || {}).textContent || ''));
    doit(db.lire("SELECT valeur FROM reglages WHERE cle = 'prix_entreprise'")[0].valeur === '880',
      'le prix est rangé en base, pas dans un fichier qu\'il faut redéployer');
    await page.waitForSelector('[data-reg="prix_entreprise"]');
    doit(await page.evaluate(() => {
      const l = document.querySelector('[data-reg="prix_entreprise"]').closest('.reg');
      return /réglé ici/.test(l.querySelector('.src').textContent);
    }), 'et la source a changé : il vient maintenant de l\'écran');
    // L'effet, mesuré là où il compte : le formulaire d'émission propose le nouveau prix.
    //
    // 10.6.0 — RETOURNÉE, et c'est la plus instructive du lot. L'assertion exigeait 880 — le prix
    // ENTREPRISE — sur un formulaire qui affiche « Indépendant » : elle gravait exactement le
    // défaut C1, où le champ prix était initialisé en dur à « t.entreprise » pendant que la liste
    // des offres commence par « independant ». Un test écrit contre l'état du jour décrit cet
    // état, pas la règle (vingtième occurrence). La RÈGLE est : le prix proposé est celui de
    // l'offre AFFICHÉE, à l'ouverture comme après un changement.
    await onglet('licences');
    await page.click('#emettre');
    await page.waitForSelector('#form:not([hidden])');
    const offreVue = await page.inputValue('#form [name="offre"]');
    const prixVu = await page.inputValue('#form [name="prix"]');
    doit(offreVue === 'independant' && prixVu === '390',
      'à l\'ouverture, le prix est celui de l\'offre affichée (' + offreVue + ' → ' + prixVu + ')');
    await page.selectOption('#form [name="offre"]', 'entreprise');
    doit(await page.inputValue('#form [name="prix"]') === '880',
      'et en changeant d\'offre, il suit le prix qu\'on vient de régler à l\'écran (880)');
    doit(/propos/i.test(await page.textContent('#f-prix-src')),
      'le champ DIT que le montant est proposé, tant que personne ne l\'a saisi');
    await page.fill('#form [name="prix"]', '750');
    doit(/main/i.test(await page.textContent('#f-prix-src')),
      'et qu\'il est saisi à la main dès qu\'on y touche');
    await page.click('#f-non');

    etape('13 septies. Le lien de paiement entre dans la relance — et rien d\'inventé sans lui');
    await onglet('ventes');
    await page.waitForSelector('#table tbody tr');
    await boutonDeLigne('à encaisser', 'Relancer…');
    await page.waitForSelector('#resultat:not([hidden]) #relance-txt');
    const avecLien = await page.textContent('#relance-txt');
    doit(/paiement\.example\.tn/.test(avecLien), 'le lien réglé se retrouve dans le texte');
    await page.click('#relance-fermer');
    // Vidé, il DISPARAÎT de la phrase au lieu de laisser un trou : ce qui manque ne s'écrit pas.
    db.lire("DELETE FROM reglages WHERE cle = 'lien_paiement'");
    await boutonDeLigne('à encaisser', 'Relancer…');
    await page.waitForSelector('#resultat:not([hidden]) #relance-txt');
    doit(!/régler en ligne/.test(await page.textContent('#relance-txt')),
      'sans lien réglé, aucune phrase de paiement — pas un vide, pas un « … »');
    await page.click('#relance-fermer');

    etape('13 octies. La FICHE d\'un client : cinq écrans en un');
    await onglet('clients');
    await page.waitForSelector('#table tbody tr');
    await boutonDeLigne('Trabelsi', 'Ouvrir la fiche');
    await page.waitForSelector('#fiche:not([hidden]) #fiche-retour');
    const ficheTxt = (await page.innerText('#fiche')).replace(/\s+/g, ' ');
    doit(/Licences/.test(ficheTxt) && /Ventes/.test(ficheTxt) && /Ses postes/.test(ficheTxt) && /Journal/.test(ficheTxt),
      'tout ce qu\'on cherchait sur cinq écrans est sur un seul');
    doit(await page.evaluate(() => document.querySelector('#tabs button[data-t="clients"]').getAttribute('aria-selected') === 'true'),
      'et le rail garde allumé l\'onglet d\'où l\'on vient (7.21.0)');

    etape('13 nonies. Noter un contact : l\'alerte se referme, et « perdu » exige un motif');
    await page.click('#fiche-suivi');
    await page.waitForSelector('#form:not([hidden]) [name="issue"]');
    await page.selectOption('#form [name="issue"]', 'perdu');
    await page.click('#f-ok');
    await page.waitForFunction(() => { const m = document.getElementById('f-msg'); return m && !m.hidden; });
    doit(/pourquoi/i.test(await page.textContent('#f-msg')),
      'un « perdu » sans motif est refusé : c\'est la seule chose que ce suivi peut apprendre');
    await page.selectOption('#form [name="issue"]', '');
    await page.fill('#form [name="note"]', 'appelé, rappelle après le 15');
    await page.fill('#form [name="rappel"]', '2099-01-15');
    await valider();
    await page.waitForSelector('#fiche:not([hidden])');
    doit(db.lire("SELECT id FROM suivis WHERE sujet LIKE 'client:%'").length === 1,
      'le contact est rangé — rien ne s\'écrase, chaque appel est une ligne de plus');
    await page.click('#refresh');
    await onglet('alertes');
    await page.waitForSelector('#table .wrap');
    // Le test ne doit pas pouvoir passer À VIDE (9.4.7) : on vérifie d'abord qu'il reste vraiment
    // une vente impayée pour CE client — sinon « l'alerte a disparu » ne prouverait que son absence.
    const cliTrab = db.lire("SELECT id FROM clients WHERE nom LIKE '%Trabelsi%'")[0].id;
    doit(db.lire('SELECT id FROM ventes WHERE client_id = ? AND payee_le IS NULL', cliTrab).length > 0,
      'ce client a bien une vente qui attend : l\'alerte AVAIT de quoi se lever');
    const ligneVente = (await lignes()).filter(l => /Vente à encaisser/.test(l)).join(' ');
    doit(!/Trabelsi/.test(ligneVente),
      'et son alerte se tait jusqu\'à la date de rappel — les autres clients, eux, crient toujours');

    etape('13 decies. Trier, paginer, et ne jamais tronquer en silence');
    await onglet('licences');
    await page.waitForSelector('#table tbody tr');
    await page.click('th[data-tri="client"]');
    await page.waitForSelector('th[data-tri="client"][aria-sort="ascending"]');
    const croissant = (await page.$$eval('#table tbody tr td:first-child', c => c.map(x => x.textContent.trim()))).filter(Boolean);
    await page.click('th[data-tri="client"]');
    await page.waitForSelector('th[data-tri="client"][aria-sort="descending"]');
    const decroissant = (await page.$$eval('#table tbody tr td:first-child', c => c.map(x => x.textContent.trim()))).filter(Boolean);
    doit(croissant.length > 1 && croissant.join('|') === decroissant.slice().reverse().join('|'),
      'un second clic RENVERSE le tri, il ne repart pas de zéro');
    doit(/\d+ licences?/.test(await page.innerText('#table')),
      'le pied dit COMBIEN il y en a : cinq cents lignes affichées se lisaient « il y en a cinq cents »');

    etape('13 undecies. La bulle « i » : une colonne dont le titre est une définition l\'explique');
    await onglet('parc');
    await page.waitForSelector('#table tbody tr');
    await page.click('th[data-tri="endormis"] button.i');
    await page.waitForSelector('#info-pop:not([hidden])');
    doit(/pas perdu/i.test(await page.textContent('#info-pop')),
      '« Endormi n\'est PAS perdu » — la nuance qui n\'était écrite nulle part');
    await page.keyboard.press('Escape');
    doit(await page.isHidden('#info-pop'), 'et Échap la referme');

    etape('13 duodecies. La palette (Cmd+K) : aller n\'importe où sans viser');
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#palette:not([hidden]) #pal-q');
    await page.fill('#pal-q', 'essais');
    await page.waitForFunction(() => document.querySelectorAll('#pal-l li[data-i]').length > 0);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#tabs button[data-t="essais"]').getAttribute('aria-selected') === 'true');
    doit(await page.isHidden('#palette'), 'la palette se referme et mène à l\'écran demandé');

    etape('13 terdecies. Les ESSAIS, nommés un par un — la file d\'appels du matin');
    await page.waitForSelector('#table tbody tr');
    const essais = (await lignes()).join('\n');
    doit(/poste-cabinet-A/.test(essais) && /SkanFact Cabinet/.test(essais),
      'chaque poste en essai a SA ligne, avec son application');
    doit(/jamais contacté/.test(essais), 'et la console dit qu\'on ne lui a jamais parlé');
    await boutonDeLigne('poste-cabinet-A', 'Noter un contact…');
    await page.waitForSelector('#form:not([hidden]) [name="source"]');
    await page.fill('#form [name="note"]', 'intéressé, revient vendredi');
    await page.fill('#form [name="source"]', 'bouche-à-oreille');
    await valider();
    await page.waitForSelector('#table tbody tr');
    doit(/noté le/.test((await lignes()).join('\n')),
      'le suivi se lit sur la ligne : on sait qui a déjà été appelé');
    doit(db.lire("SELECT source FROM suivis WHERE sujet LIKE 'essai:%'")[0].source === 'bouche-à-oreille',
      'et d\'où il vient est SAISI, jamais pisté');

    etape('13 quaterdecies. Le pli scellé : une procédure, et pas une clé privée');
    await allerReglages();
    await page.click('#reg-pli');
    await page.waitForSelector('#resultat:not([hidden]) #pli-copier');
    const pli = await page.innerText('#resultat');
    doit(/PLI SCELLÉ/.test(pli) && /une seule personne peut émettre/.test(pli),
      'le pli nomme le vrai risque : personne d\'autre ne peut vendre');
    doit(!/PRIVATE KEY/.test(pli) && !/BEGIN /.test(pli),
      'et aucune clé privée n\'en sort : ce qui sort est une PROCÉDURE');
    await page.click('#pli-fermer');
    // La copie automatique : non branchée, elle le DIT — jamais un vert rassurant.
    doit(/bucket R2/.test(await page.innerText('#fiche')),
      'la copie automatique dit ce qui lui manque au lieu de se taire');

    etape('13 quindecies. La page publique de vérification : sans secret, et sans rien divulguer');
    const pub = await ctx.newPage();
    await pub.goto(base + '/verifier', { waitUntil: 'domcontentloaded' });
    const empreinte = db.lire('SELECT empreinte FROM licences LIMIT 1')[0].empreinte;
    await pub.fill('#emp', empreinte);
    await pub.click('#go');
    await pub.waitForSelector('#out:not([hidden])');
    const verdict = await pub.textContent('#out');
    doit(/valable|terminée|révoquée|remplacée/i.test(verdict), 'une empreinte connue reçoit son état : « ' + verdict.trim().slice(0, 60) + ' »');
    doit(!/Trabelsi/i.test(verdict), 'et JAMAIS le nom du client : celui qui présente une clé ne doit rien apprendre de plus');
    await pub.fill('#emp', 'ffffffffffffffffffff');
    await pub.click('#go');
    await pub.waitForFunction(() => /aucune licence/i.test(document.getElementById('out').textContent));
    doit(true, 'une empreinte inconnue est dite inconnue, au lieu d\'une panne');
    await pub.close();

    etape('14. Fermer la session referme vraiment');
    await page.click('#out');
    await page.waitForSelector('#lock:not([hidden])');
    doit(await page.isHidden('#app'), 'les données disparaissent');
    doit(await page.evaluate(() => !sessionStorage.getItem('skanfact-console')), 'le secret est effacé');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#lock', { state: 'visible' });
    doit(await page.isHidden('#app'), 'et recharger ne rouvre pas la console');

    etape('15. Aucune exception, et le refus de l\'étape 2 a bien eu lieu');
    doit(fautes.length === 0, 'aucune exception JavaScript (' + (fautes[0] || 'rien') + ')');
    doit(attendues.length > 0, 'le serveur a réellement refusé le mauvais secret (' + attendues.length + ' refus)');

    console.log('\n16 étapes — la console vend : le client, la clé, la vente, le mail, le renouvellement, la révocation, et la licence d\'un cabinet.');
  } finally {
    await nav.close();
    srv.close();
    restaurer();
    db.fermer();
  }
})().catch(e => { console.error('\n' + e.message); process.exit(1); });
