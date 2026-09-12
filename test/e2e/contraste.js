// Aucun bouton n'est invisible (7.11.1).
//
// Pourquoi ce test existe : Skander a ouvert une facture émise et a vu « un bouton tout blanc ».
// C'était « Corriger par un avoir… », la SEULE sortie que le bandeau de verrouillage propose — un
// rectangle de 155 × 32 px, blanc sur blanc. La cause est une règle CSS de portée trop large :
// `.banner .btn { background: #fff }` existe pour que le bouton NEUTRE ne paraisse pas sale sur un
// bandeau teinté, et elle repeignait aussi le bouton primaire, qui garde son texte blanc.
//
// Le point important : ça ne plante pas, ça n'apparaît dans aucune console, aucun test de calcul ne
// le voit, et relire le CSS ne suffit pas — c'est une question de spécificité entre deux règles
// éloignées de 250 lignes. La seule façon fiable de le savoir est de MESURER dans l'application.
//
// Alors on ne mesure pas ce bouton-là, on les mesure tous : ce test parcourt les écrans, calcule
// pour chaque bouton visible le contraste entre son texte et le fond réellement peint derrière lui,
// et refuse tout ce qui est illisible. Le seuil est très bas (2,0) exprès : il ne juge pas
// l'esthétique, il attrape ce qu'on ne peut pas lire du tout.
//
//   xvfb-run -a node test/e2e/contraste.js
const { playwright, RACINE, ELECTRON, journal, surveiller } = require('./harnais');
const { _electron: electron } = playwright();
const path = require('path'); const fs = require('fs'); const os = require('os');

// Le calcul du contraste, injecté dans la page : on remonte les ancêtres jusqu'à un fond opaque,
// parce qu'un bouton dont le fond est `transparent` est peint par ce qu'il y a derrière.
const SONDE = () => {
  const lum = ([r, g, b]) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const opaque = s => { const v = rgb(s); return v.length >= 3 && (v.length < 4 || v[3] >= 0.95) ? v.slice(0, 3) : null; };
  const fondDe = el => {
    for (let n = el; n; n = n.parentElement) {
      const v = opaque(getComputedStyle(n).backgroundColor);
      if (v) return v;
    }
    return [255, 255, 255];
  };
  const out = [];
  document.querySelectorAll('button, .btn').forEach(b => {
    const r = b.getBoundingClientRect();
    const s = getComputedStyle(b);
    if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none') return;
    if (!b.textContent.trim()) return;            // un bouton sans texte (pictogramme seul) n'est pas jugé ici
    if (b.disabled || s.opacity < 0.3) return;    // un bouton désactivé a le droit d'être pâle
    const t = rgb(s.color); if (t.length < 3) return;
    const f = fondDe(b);
    const a = lum(t), c = lum(f);
    const ratio = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
    out.push({ texte: b.textContent.trim().slice(0, 40), id: b.id, cls: b.className, ratio: Math.round(ratio * 100) / 100, color: s.color, bg: s.backgroundColor });
  });
  return out;
};

const SEUIL = 2.0;

(async () => {
  const j = journal(); const bac = []; const fautes = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skanfact-contraste-'));
  const app = await electron.launch({ args: ['--no-sandbox', `--user-data-dir=${userData}`, RACINE], executablePath: ELECTRON });
  const win = await app.firstWindow(); surveiller(win, '', bac);

  const sonder = async (ou) => {
    const boutons = await win.evaluate(SONDE);
    boutons.filter(b => b.ratio < SEUIL).forEach(b => fautes.push(`${ou} → « ${b.texte} » (${b.id || b.cls}) : contraste ${b.ratio} — ${b.color} sur ${b.bg}`));
    return boutons.length;
  };

  j.etape('L\'assistant de première utilisation');
  await win.waitForSelector('#setup');
  for (let garde = 0; garde < 15 && await win.$('#setup'); garde++) {
    await sonder('assistant');
    if (await win.$('#sf-form input[name=name]')) {
      await win.fill('#sf-form input[name=name]', 'Atelier Contraste SUARL');
      await win.fill('#sf-form input[name=matricule]', '9876543Z/A/P/000');
    }
    if (await win.$('[data-act="informatique"]')) { await win.click('[data-act="informatique"]'); await win.waitForSelector('[data-act="informatique"].sel'); }
    await win.click('#sf-next');
    await win.waitForTimeout(120);
  }
  await win.waitForFunction(() => !document.querySelector('#setup'));
  j.ok('traversé');

  j.etape('Le jeu d\'exemple, pour que les écrans aient du contenu');
  await win.evaluate(() => { location.hash = '#/parametres'; });
  await win.waitForSelector('#set-tabs');
  await win.click('#set-tabs button[data-tab="donnees"]');
  await win.waitForFunction(() => { const p = document.querySelector('[data-pane="donnees"]'); return p && !p.hidden; });
  await win.click('#load-demo');
  const ok = await win.waitForSelector('#modal-root #ok', { timeout: 3000 }).catch(() => null);
  if (ok) await ok.click();
  await win.waitForSelector('.demo-banner');
  j.ok('chargé');

  const PAGES = ['accueil', 'devis', 'factures', 'relances', 'clients', 'catalogue', 'autres', 'recurrentes',
    'achats', 'fournisseurs', 'stock', 'immos', 'tresorerie', 'marges', 'stats', 'compta', 'paie',
    'garanties', 'modules', 'parametres', 'aide'];

  j.etape(`Les ${PAGES.length} pages, en clair`);
  let n = 0;
  for (const p of PAGES) {
    await win.evaluate(x => { location.hash = '#/' + x; }, p);
    await win.waitForTimeout(160);
    n += await sonder('#/' + p);
  }
  j.ok(`${n} boutons mesurés`);

  // Le cas exact de la capture : une facture émise, dont le bandeau porte le seul bouton de sortie.
  j.etape('Le bandeau d\'une pièce émise');
  await win.evaluate(() => { location.hash = '#/factures'; });
  await win.waitForSelector('#view table.list');
  const ids = await win.$$eval('#view table.list tbody tr[data-id]', trs => trs.map(t => t.dataset.id));
  let vu = false;
  for (const id of ids) {
    await win.evaluate(i => { location.hash = '#/doc/' + i; }, id);
    await win.waitForTimeout(200);
    if (await win.$('.lock-banner')) { await sonder('facture émise'); vu = true; break; }
  }
  if (!vu) throw new Error('aucune facture émise trouvée : le bandeau de verrouillage n\'a pas été mesuré');
  j.ok('mesuré');

  j.etape('Les mêmes écrans en thème sombre');
  await win.evaluate(() => document.body.classList.add('dark'));
  let m = 0;
  for (const p of PAGES) {
    await win.evaluate(x => { location.hash = '#/' + x; }, p);
    await win.waitForTimeout(140);
    await win.evaluate(() => document.body.classList.add('dark'));
    m += await sonder('sombre #/' + p);
  }
  for (const id of ids) {
    await win.evaluate(i => { location.hash = '#/doc/' + i; }, id);
    await win.waitForTimeout(200);
    await win.evaluate(() => document.body.classList.add('dark'));
    if (await win.$('.lock-banner')) { await sonder('sombre facture émise'); break; }
  }
  j.ok(`${m} boutons mesurés`);

  await app.close();

  if (bac.length) { console.error('\nErreurs du renderer :\n' + bac.join('\n')); process.exit(2); }
  if (fautes.length) {
    console.error(`\n${fautes.length} bouton(s) illisible(s) — contraste texte/fond sous ${SEUIL} :\n` + fautes.join('\n'));
    process.exit(1);
  }
  console.log(`\n${j.total()} étapes — aucun bouton illisible.`);
})().catch(e => { console.error(e); process.exit(1); });
