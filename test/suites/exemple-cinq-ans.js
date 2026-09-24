'use strict';
// ============================================================================================
// L'exemple sur cinq ans (10.14.0), et ce qu'il a fait tomber
//
// Un jeu de treize mois ne fait traverser le 31 décembre à presque aucune facture : les
// à-nouveaux des tiers n'y étaient jamais mis à l'épreuve. Sur cinq ans, une facture de décembre
// réglée en janvier arrivait dans l'exercice suivant par son seul règlement — le lettrage la
// comptait réglée pendant que le compte la comptait due, et la balance auxiliaire relisait le
// passé deux fois. Ces tests tiennent la règle avec des données écrites à la main, puis l'exemple
// lui-même.
module.exports = ({ t, assert }) => {
const core = require('../../src/renderer/core.js');
const demo = require('../../src/renderer/demo.js');

const CO = { ...core.DEFAULT_COMPANY, name: 'Test SUARL', matricule: '1234567A', stampFee: 1 };
const facture = over => ({
  type: 'facture', status: 'envoyée', dueDate: '', clientId: 'c1',
  lines: [{ label: 'Audit', qty: 1, unitPrice: 1000, vatRate: 19 }],
  discountRate: 0, applyStamp: true, payments: [], withholdingRate: 0, ...over
});
// 1 000 HT + 190 de TVA + 1 de timbre : 1 191, calculé à la main (règle 7.0.1).
const TTC = 1191;
function donnees() {
  return core.migrateData({
    company: CO,
    clients: [{ id: 'c1', name: 'Hôtel du Lac' }, { id: 'c2', name: 'Café de Sfax' }],
    documents: [
      // Réglée dans l'exercice : elle ne doit pas rouvrir.
      facture({ id: 'd0', number: 'FAC-2025-008', date: '2025-11-02', clientId: 'c2', payments: [{ id: 'p0', date: '2025-11-20', amount: TTC }] }),
      // Émise en décembre, réglée en janvier.
      facture({ id: 'd1', number: 'FAC-2025-010', date: '2025-12-15', payments: [{ id: 'p1', date: '2026-01-10', amount: TTC }] }),
      // Émise en décembre, réglée en mars : elle traverse janvier ET février.
      facture({ id: 'd2', number: 'FAC-2025-011', date: '2025-12-20', clientId: 'c2', payments: [{ id: 'p2', date: '2026-03-05', amount: TTC }] })
    ]
  });
}

t('10.14.0 : une facture ouverte au 31 décembre rouvre avec son client, son rôle et sa lettre', () => {
  const data = donnees();
  const acc = core.chartAccounts(data);
  const an = core.journalEntries(data, data.company, { from: '2026-01-01', to: '2026-01-01' }, {}).filter(e => e.journal === 'AN');
  const clients = an.filter(e => e.account === acc.clients);
  assert.strictEqual(clients.length, 2, 'une ligne par facture ouverte, rien pour celle réglée dans l\'exercice');
  const hotel = clients.find(e => e.tiersId === 'c1');
  assert.ok(hotel, 'la facture de l\'Hôtel du Lac rouvre sous son client');
  assert.strictEqual(hotel.role, 'clients', 'et avec son rôle : c\'est lui que lisent l\'auxiliaire et le lettrage');
  assert.strictEqual(hotel.lettre, 'FAC-2025-010', 'et avec sa lettre : c\'est elle qui retrouve le règlement de janvier');
  assert.strictEqual(hotel.debit, TTC);
  assert.ok(!an.some(e => e.account === acc.clients && !e.role), 'plus de ligne globale du 411 sans tiers');
  // Le total du compte ne change pas d'un millime.
  const total = core.round3(clients.reduce((s, e) => s + e.debit - e.credit, 0));
  assert.strictEqual(total, 2 * TTC);
});

t('10.14.0 : la balance auxiliaire ouvre au début de l\'EXERCICE — le passé n\'est pas compté deux fois', () => {
  const data = donnees();
  const acc = core.chartAccounts(data);
  // Février : le Café de Sfax ouvre sur sa facture de décembre (une fois), l'Hôtel est soldé.
  const p = core.packPeriod(2026, 2);
  const aux = core.balanceAuxiliaire(data, data.company, p, 'clients', {});
  const cafe = aux.rows.find(r => r.tiersId === 'c2');
  assert.strictEqual(cafe.ouverture, TTC, 'l\'à-nouveau et les écritures de 2025 comptaient la facture deux fois');
  const hotel = aux.rows.find(r => r.tiersId === 'c1');
  assert.ok(!hotel || hotel.solde === 0, 'réglé en janvier, l\'Hôtel du Lac n\'ouvre plus rien en février');
  // Et le contrôle qui fait foi : le total de l'auxiliaire est le collectif de la générale.
  const gen = core.balanceGenerale(data, data.company, p, {}).rows.find(r => r.account === acc.clients);
  assert.strictEqual(core.round3(aux.totals.soldeD - aux.totals.soldeC), gen.solde);
  assert.ok(!aux.rows.some(r => r.tiers === '(sans tiers)'));
  // Janvier : l'à-nouveau est un MOUVEMENT de la période, comme dans la générale.
  const jan = core.balanceAuxiliaire(data, data.company, core.packPeriod(2026, 1), 'clients', {});
  const genJan = core.balanceGenerale(data, data.company, core.packPeriod(2026, 1), {}).rows.find(r => r.account === acc.clients);
  assert.strictEqual(jan.totals.debit, genJan.debit);
  assert.strictEqual(jan.rows.find(r => r.tiersId === 'c1').solde, 0, 'le règlement de janvier solde la facture de décembre');
});

t('10.14.0 : l\'exemple raconte cinq ans, sans date future ni trou de numérotation', () => {
  const T = '2026-09-24';
  const debut = Date.now();
  const data = core.migrateData(demo.buildDemoData(CO, T));
  // Une borne large : ce qui compte, c'est qu'aucune boucle ne s'emballe (règle 5.2.3).
  assert.ok(Date.now() - debut < 5000, 'fabriquer l\'exemple ne doit pas prendre plusieurs secondes');
  const factures = data.documents.filter(d => d.type === 'facture' && d.number);
  const annees = [...new Set(factures.map(d => d.date.slice(0, 4)))].sort();
  assert.ok(annees.length >= 5, `cinq exercices au moins portent des factures (${annees.join(', ')})`);
  const premiere = factures.map(d => d.date).sort()[0];
  const mois = (Number(T.slice(0, 4)) - Number(premiere.slice(0, 4))) * 12 + Number(T.slice(5, 7)) - Number(premiere.slice(5, 7));
  assert.ok(mois >= 58, `la première facture date de ${mois} mois : l'exemple doit remonter à cinq ans`);
  // Chaque année se numérote de 001, sans trou : c'est ce qu'un contrôleur regarde en premier.
  annees.forEach(y => {
    const n = factures.filter(d => d.number.startsWith(`FAC-${y}-`)).map(d => Number(d.number.slice(-3))).sort((a, b) => a - b);
    n.forEach((x, i) => assert.strictEqual(x, i + 1, `FAC-${y} saute du n° ${i} au n° ${x}`));
  });
  // Rien n'est daté après aujourd'hui : ni une pièce, ni un paiement, ni un bulletin.
  data.documents.forEach(d => {
    assert.ok(!d.date || d.date <= T, `${d.number || d.id} est daté du ${d.date}`);
    (d.payments || []).forEach(p => assert.ok(p.date <= T, `un paiement de ${d.number} est daté du ${p.date}`));
  });
  (data.purchases || []).forEach(p => assert.ok(!p.date || p.date <= T, `l'achat ${p.number || p.id} est daté du ${p.date}`));
});

// La palette Ctrl K coupait à douze AVANT de classer : sur cinq ans, « audit » rendait douze
// factures dont l'objet parle d'audit, et plus jamais la prestation « Audit de sécurité réseau ».
// C'est `e2e:entreprise` qui l'a vu, sur l'exemple : un corpus de treize mois n'a jamais douze
// pièces qui répondent au même mot.
t('10.14.0 : le rang d\'un résultat se juge sur son NOM, accents et écritures compris', () => {
  assert.strictEqual(core.rangRecherche('Audit de sécurité réseau', 'audit'), 3, 'le nom commence par la recherche');
  assert.strictEqual(core.rangRecherche('Audit de sécurité réseau', 'securite'), 2, 'un mot du nom commence par la recherche, accents pliés');
  assert.strictEqual(core.rangRecherche('Audit de sécurité réseau', 'reseau audit'), 2, 'chaque mot commence un mot du nom, dans n\'importe quel ordre');
  assert.strictEqual(core.rangRecherche('Assurance multirisque', 'surance'), 1, 'le nom contient la recherche, au milieu d\'un mot');
  assert.strictEqual(core.rangRecherche('FAC-2026-014', 'audit'), 0, 'trouvé ailleurs que dans le nom');
  assert.strictEqual(core.rangRecherche('FAC-2026-014', '2026'), 2, 'un numéro se découpe sur ses tirets');
  // Une raison sociale en arabe a des mots, elle aussi (règle 6.8.1) : un découpage sur [a-z] les
  // perdait tous, et le client ne pouvait jamais passer devant une pièce qui le cite.
  assert.strictEqual(core.rangRecherche('مخبزة الياسمين', 'الياسمين'), 2);
  assert.strictEqual(core.rangRecherche('Audit', ''), 0, 'une recherche vide ne classe rien');
});

t('10.14.0 : la palette classe AVANT de couper, et deux cents pièces ne cachent plus une page', () => {
  // Le corpus tel que la palette le construit : ce qu'on ouvre, puis les pièces (les plus récentes
  // d'abord), puis les clients, puis les prestations — dans cet ordre d'arrivée.
  const pieces = Array.from({ length: 200 }, (_, i) => ({
    kind: 'Facture', main: `FAC-2026-${String(200 - i).padStart(3, '0')}`, text: `fac-2026-${200 - i} hôtel du lac audit annuel facture`, piece: true
  }));
  const corpus = [
    { kind: 'Action', main: 'Nouvelle facture', text: 'nouvelle facture' },
    { kind: 'Action', main: 'Factures', text: 'factures' },
    ...pieces,
    { kind: 'Client', main: 'Hôtel du Lac', text: 'hôtel du lac' },
    { kind: 'Prestation', main: 'Audit de sécurité réseau', text: 'audit de sécurité réseau' }
  ];
  const douze = q => core.classerRecherche(corpus, q).slice(0, 12).map(x => x.main);
  // « audit » : la prestation dont c'est le NOM passe devant les deux cents pièces dont c'est l'objet.
  assert.strictEqual(douze('audit')[0], 'Audit de sécurité réseau', 'la prestation n\'est plus dans les douze premières : on coupe avant de classer');
  // « fac » : les numéros commencent comme la page, mais six pièces au plus passent devant le reste.
  const fac = douze('fac');
  assert.strictEqual(fac[0], 'Factures', 'à rang égal, ce qu\'on ouvre passe avant les pièces');
  assert.ok(fac.includes('Nouvelle facture'), '« Nouvelle facture » est poussée hors des douze par les numéros de pièce : ' + fac.join(', '));
  const avant = fac.slice(0, fac.indexOf('Nouvelle facture'));
  assert.strictEqual(avant.filter(m => m.startsWith('FAC-')).length, 6, 'six pièces au plus devancent le reste : ' + fac.join(', '));
  assert.strictEqual(fac.length, 12, 'après le reste, les pièces remplissent la liste : le plafond range, il ne retire rien');
  // « hotel » : le client passe devant ses deux cents factures.
  assert.strictEqual(douze('hotel')[0], 'Hôtel du Lac');
  // « 2026 » : seules des pièces répondent, et la liste se remplit quand même — le plafond range,
  // il ne retire rien.
  assert.strictEqual(core.classerRecherche(corpus, '2026').length, 200);
  assert.strictEqual(douze('2026').length, 12);
  // À rang égal, l'ordre d'arrivée : les pièces restent de la plus récente à la plus ancienne.
  const l = core.classerRecherche(corpus, '2026').map(x => x.main);
  assert.deepStrictEqual(l.slice(0, 3), ['FAC-2026-200', 'FAC-2026-199', 'FAC-2026-198']);
  assert.deepStrictEqual(core.classerRecherche(corpus, '   '), [], 'une recherche vide ne rend rien');
});

t('10.14.0 : sur l\'exemple de cinq ans, « audit » trouve la prestation du même nom', () => {
  const data = core.migrateData(demo.buildDemoData(CO, '2026-09-24'));
  const nomClient = id => (data.clients.find(c => c.id === id) || {}).name || '';
  // Les champs que la palette lit (`openPalette`) : numéro, client, objet, type.
  const docs = data.documents.map(d => ({ kind: d.type, main: d.number || 'Brouillon', text: `${d.number} ${nomClient(d.clientId)} ${d.subject || ''} ${d.type}`, piece: true }));
  const items = data.catalog.map(c => ({ kind: 'Prestation', main: c.label, text: `${c.label} ${c.description || ''}` }));
  const audit = data.catalog.find(c => /^audit/i.test(c.label));
  assert.ok(audit, 'l\'exemple doit porter une prestation « Audit… » : c\'est elle que le parcours cherche');
  const touchees = docs.filter(x => core.correspondRecherche(x.text, 'audit')).length;
  assert.ok(touchees > 12, `les données doivent pouvoir faire tomber la prestation hors des douze (${touchees} pièces seulement)`);
  const douze = core.classerRecherche([...docs, ...items], 'audit').slice(0, 12).map(x => x.main);
  assert.ok(douze.includes(audit.label), '« audit » ne montre que des pièces : ' + douze.join(', '));
});

t('10.14.0 : la palette appelle le classement, et dit quand elle ne montre qu\'un extrait', () => {
  const app = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'renderer', 'app.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const debut = app.indexOf('function openPalette() {');
  const pal = app.slice(debut, app.indexOf('const closeMenus = () =>', debut));
  assert.ok(pal.length > 2000 && pal.length < 20000, 'tranche de la palette : ' + pal.length);
  assert.ok(/const trouves = q \? C\.classerRecherche\(all, q/.test(pal), 'la palette ne classe plus avant de couper');
  assert.ok(!/shown\.sort\(/.test(pal), 'un tri APRÈS la coupe à douze est revenu : il ne peut que réordonner ce qui a déjà été choisi au hasard de l\'arrivée');
  const docs = (/const docs = data\.documents\.map\([\s\S]*?\}\);/.exec(pal) || [''])[0];
  assert.ok(/piece: true/.test(docs), 'les pièces ne se disent plus pièces : le plafond ne les reconnaît pas');
  assert.ok(/résultats sur \$\{total\}/.test(pal), 'un extrait de douze lignes ne dit plus qu\'il en existe d\'autres (9.4.7)');
});

// Sur cinq ans, la plupart des pièces tombent dans un mois clôturé : on modifiait un devis de 2022,
// « Enregistrer » ouvrait la fenêtre de clôture, et le travail était perdu. Un avertissement se lit
// AVANT le geste (9.4.2) : l'éditeur ferme la pièce et le dit en l'ouvrant.
t('10.14.0 : une pièce d\'un mois clôturé le dit en s\'ouvrant — ses champs sont fermés, et « Refaire aujourd\'hui » est là', () => {
  const data = core.migrateData(demo.buildDemoData(CO, '2026-09-24'));
  const closes = data.documents.filter(d => d.date && core.isClosedDate(data, d.date));
  assert.ok(closes.length > data.documents.length / 2, `les données doivent discriminer : ${closes.length} pièces clôturées sur ${data.documents.length}`);
  assert.ok(closes.some(d => d.type === 'devis'), 'l\'exemple doit porter des devis clôturés : ce sont eux qu\'on ouvrait pour rien');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'renderer', 'app.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const debut = src.indexOf('const locked = C.isLocked(doc) && !unlockedIds.has(doc.id);');
  const ed = src.slice(debut, src.indexOf('\n  routes.', debut + 10));
  assert.ok(debut > 0 && ed.length > 20000, 'tranche de l\'éditeur : ' + ed.length);
  assert.ok(/const clos = !locked && !!stored && !!stored\.date && C\.isClosedDate\(data, stored\.date\);/.test(ed), 'l\'éditeur ne reconnaît plus une pièce d\'un mois clôturé');
  assert.ok(/const figee = locked \|\| clos;/.test(ed) && /const ro = figee \? 'disabled' : '';/.test(ed), 'les champs d\'une pièce clôturée restent ouverts');
  // Ce qui ÉCRIT se ferme : enregistrer, émettre, supprimer, le garde-fou de sortie.
  [/\$\{!figee \? `<button class="btn [^`]*id="save">/, /\$\{!figee && \(isInv \|\| isAv\) \? `<button class="btn btn-primary" id="issue">/,
    /\$\{!figee \? `<button id="del" class="danger">/, /if \(!figee\) setGuard\(/, /if \(dirty \|\| figee\) return;/]
    .forEach(re => assert.ok(re.test(ed), 'un geste qui écrit reste ouvert sur une pièce clôturée : ' + re));
  // Le bandeau le dit, et porte les deux sorties que la fenêtre de clôture ne donnait qu'après le refus.
  assert.ok(/\$\{!clos \? '' : `<div class="banner info lock-banner" id="clos-banner">/.test(ed), 'le bandeau d\'une pièce clôturée a disparu');
  assert.ok(/id="clos-dup">Refaire à la date d\\'aujourd\\'hui/.test(ed) && /\$\('#clos-dup'\)\.onclick = \(\) => duplicateDoc\(stored\)/.test(ed), '« Refaire à la date d\'aujourd\'hui » n\'est plus branché');
  assert.ok(/\$\('#clos-go'\)\.onclick = \(\) => \{ comptaState\.tab = 'clotures'; navigate\('#\/compta'\); \}/.test(ed), '« Voir les clôtures » n\'est plus branché');
  // Et la copie prend la date du JOUR : c'est ce qui la rend modifiable.
  assert.ok(/const copy = \{ \.\.\.deepCopy\(doc\), id: C\.uid\(\), number: '', status: 'brouillon', date: C\.today\(\)/.test(src), 'la copie ne part plus d\'aujourd\'hui');
});

t('10.14.0 : sur cinq ans, chaque exercice de l\'exemple tombe juste — balance et auxiliaire', () => {
  const T = '2026-09-24';
  const data = core.migrateData(demo.buildDemoData(CO, T));
  const acc = core.chartAccounts(data);
  for (let y = 2022; y <= 2026; y++) {
    const p = { from: `${y}-01-01`, to: `${y}-12-31` };
    const b = core.balanceGenerale(data, data.company, p, {});
    assert.ok(b.equilibree, `la balance ${y} doit tomber juste`);
    ['clients', 'fournisseurs'].forEach(role => {
      const aux = core.balanceAuxiliaire(data, data.company, { from: `${y}-06-01`, to: `${y}-06-30` }, role, {});
      const gen = core.balanceGenerale(data, data.company, { from: `${y}-06-01`, to: `${y}-06-30` }, {}).rows
        .find(r => r.account === (role === 'clients' ? acc.clients : acc.fournisseurs));
      assert.strictEqual(core.round3(aux.totals.soldeD - aux.totals.soldeC), gen ? gen.solde : 0, `l'auxiliaire ${role} de juin ${y} doit retrouver son collectif`);
    });
  }
});
};
