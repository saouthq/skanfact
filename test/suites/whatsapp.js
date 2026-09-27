'use strict';
// ============================================================================================
// Envoyer par WhatsApp (10.15.0, H2 de l'étude Hesabi)
//
// Ce que ces tests tiennent :
//   • le numéro que WhatsApp reconnaît : huit chiffres tunisiens → 216 devant, un numéro étranger
//     avec son indicatif, jamais deviné ; un fixe se signale sans être refusé ;
//   • le lien porte le message tel qu'il a été écrit (accents, retours à la ligne, « & ») ;
//   • le processus principal fabrique le lien LUI-MÊME à partir d'un numéro qu'il revérifie — il
//     n'ouvre jamais une adresse venue de la page ;
//   • l'historique d'une pièce dit par quel canal elle est partie ;
//   • l'envoi passe par la même porte que l'email : exemple, brouillon sans numéro, statut « envoyé ».
module.exports = ({ t, assert, lireSource }) => {
const C = require('../../src/renderer/core.js');
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

t('WhatsApp : le numéro se met au format international, et ce qu\'on ne peut pas deviner se dit', () => {
  const n = x => C.numeroWhatsApp(x);
  assert.deepStrictEqual(n('98 123 456'), { ok: true, numero: '21698123456', fixe: false });
  assert.strictEqual(n('98-123-456').numero, '21698123456', 'les tirets ne comptent pas');
  assert.strictEqual(n('(+216) 98.123.456').numero, '21698123456');
  assert.strictEqual(n('0021698123456').numero, '21698123456', '00 vaut +');
  assert.strictEqual(n('21698123456').numero, '21698123456', 'déjà international');
  assert.strictEqual(n('+33 6 12 34 56 78').numero, '33612345678', 'un numéro étranger garde son indicatif');
  assert.strictEqual(n('71 234 567').fixe, true, 'un fixe tunisien (7…) se signale');
  assert.strictEqual(n('71 234 567').ok, true, 'un fixe n\'est pas refusé : un standard peut avoir WhatsApp Business');
  assert.strictEqual(n('').vide, true);
  assert.strictEqual(n(null).vide, true);
  assert.strictEqual(n('123').ok, false, 'trois chiffres ne sont pas un numéro');
  assert.strictEqual(n('216 98 123 45').ok, false, 'un numéro tunisien a huit chiffres après 216');
  assert.match(n('216 98 123 45').motif, /huit chiffres/);
  assert.strictEqual(n('06 12 34 56 78').ok, false, 'un numéro français sans indicatif ne se devine pas');
  assert.match(n('abc').motif, /indicatif/, 'le refus dit comment écrire un numéro étranger');
});

t('WhatsApp : le lien porte le message tel qu\'il a été écrit', () => {
  const texte = 'Bonjour,\n\nVeuillez trouver ci-joint notre facture FAC-2026-012 — 1 190,000 DT & merci.';
  const lien = C.lienWhatsApp('21698123456', texte);
  assert.ok(lien.startsWith('https://wa.me/21698123456?text='));
  assert.strictEqual(decodeURIComponent(lien.split('?text=')[1]), texte, 'le message revient intact');
  assert.ok(!/[\s&]/.test(lien.split('?text=')[1]), 'aucune espace ni « & » nu dans le lien : il se couperait');
  assert.strictEqual(C.lienWhatsApp('21698123456', ''), 'https://wa.me/21698123456', 'sans message, pas de « ?text= » vide');
});

t('WhatsApp : le processus principal fabrique le lien et revérifie le numéro avant de l\'ouvrir', () => {
  const m = sansCommentaires(lireSource('src', 'main.js'));
  const d = m.indexOf("ipcMain.handle('whatsapp:ouvrir'");
  assert.ok(d > 0, 'le pont WhatsApp manque');
  const f = m.slice(d, m.indexOf('\n});', d));
  const verif = f.search(/\\d\{8,15\}/), ouvre = f.indexOf('shell.openExternal(');
  assert.ok(verif > 0 && ouvre > verif, 'le numéro doit être revérifié AVANT d\'ouvrir quoi que ce soit');
  assert.match(f, /shell\.openExternal\(lienWhatsApp\(numero/, 'le lien vient du moteur, jamais de la page');
  assert.ok(!/openExternal\((url|o\.url|lien)\b/.test(f), 'une adresse venue de la page ne s\'ouvre jamais');
  assert.match(f, /showItemInFolder\(fichier\)/, 'le PDF préparé se montre dans son dossier');
  assert.match(lireSource('src', 'preload.js'), /ouvrirWhatsApp: \(opts\) => ipcRenderer\.invoke\('whatsapp:ouvrir', opts\)/);
});

t('WhatsApp : l\'historique d\'une pièce dit par quel canal elle est partie', () => {
  const company = Object.assign({}, C.DEFAULT_COMPANY, { name: 'Essai', currency: 'DT' });
  const doc = { id: 'd1', type: 'facture', number: 'FAC-2026-001', date: '2026-09-01', clientId: 'c1', status: 'envoyée', lines: [],
    emails: [
      { date: '2026-09-02', to: 'a@b.tn', kind: 'facture' },
      { date: '2026-09-03', to: '+21698123456', kind: 'facture', canal: 'whatsapp' },
      { date: '2026-09-20', to: '+21698123456', kind: 'relance1', canal: 'whatsapp' }
    ] };
  const data = { documents: [doc], clients: [{ id: 'c1', name: 'Client' }] };
  const labels = C.documentHistory(doc, data, company).filter(e => e.kind === 'email' || e.kind === 'relance').map(e => e.label);
  assert.ok(labels.includes('Envoyé par email'), 'un envoi par email reste « par email »');
  assert.ok(labels.includes('Envoyé par WhatsApp'), 'un envoi par WhatsApp le dit : ' + labels.join(' | '));
  assert.ok(labels.some(l => /par WhatsApp$/.test(l) && l !== 'Envoyé par WhatsApp'), 'une relance par WhatsApp le dit aussi');
  assert.ok(!labels.some(l => /WhatsApp/.test(l) && /email/.test(l)));
});

t('WhatsApp : l\'envoi passe par la même porte que l\'email, et se note avec son canal', () => {
  const app = sansCommentaires(lireSource('src', 'renderer', 'app.js'));
  // L'éditeur : un seul chemin pour les deux canaux (exemple, brouillon sans numéro, émettre puis envoyer).
  assert.match(app, /\$\('#email'\)\.onclick = envoyerPar\(sendByEmail, /);
  assert.match(app, /\$\('#wa'\)\.onclick = envoyerPar\(sendByWhatsApp, /);
  const e = app.indexOf('const envoyerPar = '), fin = app.indexOf("if ($('#email')).onclick", e) > 0 ? app.indexOf("if ($('#email')).onclick", e) : app.indexOf("if ($('#email')) $('#email').onclick", e);
  const porte = app.slice(e, fin);
  assert.ok(porte.length > 300 && porte.length < 4000, 'tranche inattendue : ' + porte.length);
  assert.match(porte, /demoBlock\(geste\)/, 'l\'exemple d\'abord');
  assert.match(porte, /!d\.number/, 'un brouillon sans numéro ne part par aucun des deux canaux');
  assert.match(porte, /envoi\(docById\(doc\.id\) \|\| doc, null, null, null, \{ exempleAccepte: true \}\)/, '« Émettre puis envoyer » envoie par le canal choisi');
  // La question de l'exemple, posée par la porte, n'est pas reposée par la fonction d'envoi : deux
  // « Continuer quand même » pour un envoi (l'email l'avait depuis la porte de l'éditeur).
  assert.match(porte, /envoi\(d, null, null, null, \{ exempleAccepte: true \}\)/, 'la réponse à l\'exemple ne suit pas l\'envoi');
  for (const f of ['sendByEmail', 'sendByWhatsApp']) {
    const corps = app.slice(app.indexOf(`async function ${f}(`), app.indexOf(`async function ${f}(`) + 300);
    assert.match(corps, /if \(!\(o && o\.exempleAccepte\) && await demoBlock\(/, f + ' repose la question de l\'exemple déjà posée');
  }
  // La fenêtre.
  const w = app.slice(app.indexOf('async function sendByWhatsApp('), app.indexOf('// ---------- contrats récurrents'));
  assert.ok(w.length > 1500, 'sendByWhatsApp introuvable');
  assert.ok(w.indexOf("demoBlock('Envoyer par WhatsApp')") > 0 && w.indexOf("demoBlock('Envoyer par WhatsApp')") < w.indexOf('modal('), 'l\'exemple avant la fenêtre');
  assert.match(w, /C\.emailFor\(kind, doc, client, company\(\), extra, data\)/, 'le message vient du MÊME modèle que l\'email');
  assert.match(w, /if \(!n\.ok\) return refus\(tel,/, 'un numéro faux montre la case');
  assert.match(w, /bridge\.ouvrirWhatsApp\(\{ numero: n\.numero, texte: v\.body, fichier \}\)/);
  assert.match(w, /canal: 'whatsapp'/, 'l\'envoi se note avec son canal');
  assert.match(w, /stored\.status = envoi/, 'envoyer fait passer la pièce en « envoyée »');
  assert.match(w, /Un lien ne peut pas y joindre de fichier/, 'la fenêtre dit AVANT le geste que le PDF se glisse à la main');
  // Les listes et les relances.
  assert.match(app, /label: 'Envoyer par WhatsApp'[^\n]*run: \(\) => sendByWhatsApp\(d\)/);
  assert.match(app, /cle: 'relancer-whatsapp'[^\n]*run: \(\) => sendReminder\(x, 'whatsapp'\)/);
  assert.match(app, /\(canal === 'whatsapp' \? sendByWhatsApp : sendByEmail\)\(item\.doc, 'relance' \+ level/);
});
};
