// La console de l'éditeur, ouverte pour de vrai dans un navigateur.
//
// Pourquoi ce parcours existe : le projet a appris huit fois qu'un écran ne se juge pas à la
// lecture. Un bouton parfaitement visible peut être inerte (5.2.2, 7.0.0), une classe CSS peut
// perdre en silence (7.23.0, 7.27.0, 7.30.0), et une fonction jamais appelée ne se voit nulle part
// avant l'exécution (6.8.0). Les tests de `npm test` lisent la source ; celui-ci CLIQUE.
//
// Il n'a besoin ni de Cloudflare ni de D1 : un petit serveur Node sert la page du worker et imite
// ses réponses. Ce qu'on teste, c'est la page — pas le nuage.
//
//   npm run e2e:console

const http = require('http');
const path = require('path');
const { playwright, ouvrirChromium } = require('./harnais');

const MODULE = path.join(__dirname, '..', '..', 'plateforme', 'skanfact-api.mjs');
const SECRET = 'un-secret-d-administration-bien-assez-long';

// Ce que la fausse base répond. Trois situations qui doivent se distinguer à l'œil : une licence
// active, une révoquée, et une installation en essai qui n'a aucune licence.
const DONNEES = {
  stats: { clients: 2, licencesActives: 1, licencesExpirees: 0, licencesRevoquees: 1, essaisEnCours: 3, postes: 4, incertain: false },
  licences: { lignes: [
    { id: 'lic_1', client: 'Menuiserie Trabelsi', matricule: '1234567A', offre: 'entreprise', kid: 'master',
      empreinte: 'abcdef0123456789abcdef0123456789', postes: 3, debut: '2026-09-01', fin: '2027-09-01',
      emise_le: '2026-09-01T09:00:00Z', revoquee_le: null, revoquee_motif: null },
    { id: 'lic_2', client: 'Café des Oliviers', matricule: '7654321B', offre: 'independant', kid: 'srv-1',
      empreinte: '99887766554433221100aabbccddeeff', postes: null, debut: '2026-08-01', fin: null,
      emise_le: '2026-08-01T09:00:00Z', revoquee_le: '2026-09-10', revoquee_motif: 'rétractation' }
  ] },
  activations: { lignes: [
    { client: 'Menuiserie Trabelsi', empreinte: 'abcdef0123456789abcdef0123456789', device_id: 'aaaa-bbbb-cccc-dddd',
      device_nom: 'Le PC de l\'atelier', plateforme: 'win32', version: '8.4.0',
      premiere_fois: '2026-09-01T09:00:00Z', derniere_fois: new Date().toISOString() },
    { client: null, empreinte: 'ESSAI', device_id: 'eeee-ffff-0000-1111', device_nom: 'MacBook de Sami',
      plateforme: 'darwin', version: '8.4.0',
      premiere_fois: '2026-09-05T09:00:00Z', derniere_fois: new Date(Date.now() - 2 * 86400000).toISOString() }
  ] },
  clients: { lignes: [
    { id: 'cli_1', nom: 'Menuiserie Trabelsi', matricule: '1234567A', email: 'contact@trabelsi.tn', tel: '+216 20 000 000', cree_le: '2026-09-01T09:00:00Z' }
  ] },
  ventes: { lignes: [] }
};

async function servir() {
  const mod = await import('file://' + MODULE);
  // On sert EXACTEMENT la page que le worker sert : on la lui demande, on ne la recopie pas.
  // Recopier le gabarit ferait un test qui rejoue le code qu'il teste (règle 6.8.1).
  const rep = await mod.default.fetch(new Request('https://exemple/'), {});
  const page = await rep.text();

  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/' || u.pathname === '/console') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    // Le worker répond 204 à l'icône ; on fait pareil, sinon le navigateur poserait une erreur
    // rouge que ce parcours compterait comme une faute (et il a raison de les compter toutes).
    if (u.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    const m = u.pathname.match(/^\/v1\/admin\/(\w+)$/);
    const envoyer = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj));
    };
    if (!m) return envoyer(404, { erreur: 'Introuvable.' });
    if (req.headers['x-skanfact-admin'] !== SECRET) return envoyer(403, { erreur: 'Accès refusé.' });
    if (!DONNEES[m[1]]) return envoyer(404, { erreur: 'Introuvable.' });
    envoyer(200, DONNEES[m[1]]);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, base: 'http://127.0.0.1:' + srv.address().port };
}

(async () => {
  const { srv, base } = await servir();
  const nav = await ouvrirChromium(playwright());
  const ctx = await nav.newContext();
  const page = await ctx.newPage();

  // Toute erreur JavaScript de la page fait échouer le parcours. C'est la moitié de l'intérêt :
  // une ReferenceError pendant la construction d'un gabarit laisse un écran blanc et une console
  // vide chez l'utilisateur (7.20.0, 7.22.0, 7.23.0).
  //
  // Mais on ne compte PAS les réponses refusées par le serveur : l'étape 2 en provoque une exprès,
  // et la page la traite — elle affiche « Accès refusé. ». Les confondre rendrait ce filet
  // inutilisable, et un filet qu'on désarme pour qu'il se taise ne protège plus de rien. Les vraies
  // exceptions (`pageerror`), elles, sont TOUJOURS fatales.
  const fautes = [];
  const attendues = [];
  page.on('pageerror', e => fautes.push('exception : ' + (e && e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    (/Failed to load resource/i.test(m.text()) ? attendues : fautes).push(m.text());
  });

  const etape = n => console.log('\n' + n);
  const doit = (c, quoi) => { if (!c) throw new Error('ÉCHEC — ' + quoi); console.log('  ✓ ' + quoi); };

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

    etape('3. Le bon secret ouvre la console');
    await page.fill('#sec', SECRET);
    await page.press('#sec', 'Enter');   // le clavier, pas seulement le bouton
    await page.waitForSelector('#app:not([hidden])');
    doit(await page.isHidden('#lock'), 'le verrou disparaît');

    etape('4. Les chiffres sont là, et ils sont ceux de la base');
    await page.waitForFunction(() => document.querySelectorAll('#cards .card').length >= 6);
    const cartes = await page.$$eval('#cards .card', els => els.map(e => ({
      n: e.querySelector('b').textContent.trim(), l: e.querySelector('span').textContent.trim()
    })));
    const essais = cartes.find(c => c.l.includes('essais'));
    doit(essais && essais.n === '3', 'trois essais en cours annoncés');
    doit(cartes.find(c => c.l.includes('révoquées')).n === '1', 'une licence révoquée annoncée');
    doit(!cartes.some(c => /\(s\)/.test(c.l)), 'aucun « (s) » d\'accord bâclé');

    etape('5. Le tableau des licences distingue active et révoquée');
    await page.waitForSelector('#table table tbody tr');
    const etats = await page.$$eval('#table tbody tr', ls => ls.map(l => l.textContent));
    doit(etats.some(x => x.includes('Menuiserie Trabelsi') && x.includes('active')), 'la licence active se lit');
    doit(etats.some(x => x.includes('révoquée') && x.includes('rétractation')), 'la révoquée porte son motif');
    doit(etats.some(x => x.includes('à vie')), 'une licence sans fin se dit « à vie », pas « — »');
    doit(etats.some(x => x.includes('illimité')), 'des postes non limités se disent « illimité »');

    etape('6. Chaque onglet répond, et l\'essai se reconnaît');
    for (const nom of ['Activations', 'Clients', 'Ventes', 'Licences']) {
      await page.click('#tabs button[data-t="' + nom.toLowerCase() + '"]');
      await page.waitForFunction(n => {
        const b = document.querySelector('#tabs button[data-t="' + n + '"]');
        return b && b.getAttribute('aria-selected') === 'true';
      }, nom.toLowerCase());
      await page.waitForSelector('#table .wrap');
      doit(true, 'l\'onglet ' + nom + ' s\'affiche');
    }
    await page.click('#tabs button[data-t="activations"]');
    await page.waitForSelector('#table tbody tr');
    const act = await page.$$eval('#table tbody tr', ls => ls.map(l => l.textContent));
    doit(act.some(x => x.includes('en essai')), 'une installation sans licence se dit « en essai »');
    doit(act.some(x => /aujourd’hui|aujourd'hui/.test(x)), 'une activation du jour se dit « aujourd\'hui »');
    doit(act.some(x => x.includes('il y a 2 jours')), 'et une plus ancienne se date en clair');

    etape('7. Un écran vide explique, au lieu de ne rien dire');
    await page.click('#tabs button[data-t="ventes"]');
    // `.wrap .vide` et non `.vide` : « Chargement… » porte sa propre classe, sinon le test
    // l'attraperait au vol et passerait sans jamais voir l'écran vide.
    await page.waitForSelector('#table .wrap .vide');
    const vide = (await page.textContent('#table .wrap .vide')).trim();
    doit(vide.length > 20 && !/chargement/i.test(vide), 'l\'écran vide porte une phrase : « ' + vide + ' »');

    etape('8. Fermer la session referme vraiment');
    await page.click('#out');
    await page.waitForSelector('#lock:not([hidden])');
    doit(await page.isHidden('#app'), 'les données disparaissent');
    doit(await page.evaluate(() => !sessionStorage.getItem('skanfact-console')), 'le secret est effacé');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#lock', { state: 'visible' });
    doit(await page.isHidden('#app'), 'et recharger ne rouvre pas la console');

    etape('9. Aucune exception, et le refus de l\'étape 2 a bien eu lieu');
    doit(fautes.length === 0, 'aucune exception JavaScript (' + (fautes[0] || 'rien') + ')');
    // L'inverse compte autant : si le serveur n'avait rien refusé, l'étape 2 aurait passé pour une
    // mauvaise raison — le message d'erreur peut venir de la page sans que le secret soit vérifié.
    doit(attendues.length > 0, 'le serveur a réellement refusé le mauvais secret (' + attendues.length + ' refus)');

    console.log('\n9 étapes — la console tient.');
  } finally {
    await nav.close();
    srv.close();
  }
})().catch(e => { console.error('\n' + e.message); process.exit(1); });
