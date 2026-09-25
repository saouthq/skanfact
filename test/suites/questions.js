'use strict';
// ============================================================================================
// Une question dit ce qu'elle demande (10.14.0)
//
// Les quatre-vingt-sept questions de l'app entreprise s'intitulaient toutes « Confirmation » : on
// lisait le corps pour savoir si l'on supprimait un paiement ou si l'on quittait l'exemple. Le
// Cabinet titre chacune des siennes depuis toujours (le jumeau, 7.3.0). Le titre se déduit — une
// règle écrite appel par appel se serait perdue au quatre-vingt-huitième — et l'appelant qui sait
// mieux le donne.
module.exports = ({ t, assert }) => {
  const fs = require('fs');
  const path = require('path');
  const core = require('../../src/renderer/core.js');
  const app = fs.readFileSync(path.join(__dirname, '../../src/renderer/app.js'), 'utf8');

  t('10.14.0 : la question par laquelle le message commence devient le titre, et quitte le corps', () => {
    const r = core.titreQuestion('Supprimer le paiement de 50,000 DT du 01/03/2026 ? FAC-2026-001 redeviendra due.', 'Supprimer le paiement');
    assert.strictEqual(r.titre, 'Supprimer le paiement de 50,000 DT du 01/03/2026 ?');
    assert.strictEqual(r.corps, 'FAC-2026-001 redeviendra due.');
    const r2 = core.titreQuestion('Abandonner cette saisie ?\nCe que tu viens de taper ne sera pas enregistré.', 'Abandonner la saisie');
    assert.strictEqual(r2.titre, 'Abandonner cette saisie ?');
    assert.strictEqual(r2.corps, 'Ce que tu viens de taper ne sera pas enregistré.');
  });

  t('10.14.0 : un avertissement qui FINIT par une question n\'est pas un titre', () => {
    // La première phrase seulement : sinon tout le message monte dans le titre et le corps est vide.
    const r = core.titreQuestion('La date est dans le futur. Enregistrer quand même ?', 'Enregistrer quand même');
    assert.strictEqual(r.titre, 'Avant de continuer');
    assert.strictEqual(r.corps, 'La date est dans le futur. Enregistrer quand même ?');
  });

  t('10.14.0 : sinon le geste du bouton, sauf un geste qui ne dit rien (« Confirmer », « … quand même »)', () => {
    assert.strictEqual(core.titreQuestion('Ce devis a déjà donné FAC-2026-001.', 'Refacturer la totalité').titre, 'Refacturer la totalité ?');
    assert.strictEqual(core.titreQuestion('Importer remplacera tout.', 'Choisir le fichier à importer…').titre, 'Choisir le fichier à importer ?');
    for (const vide of ['', 'Confirmer', 'Continuer quand même', 'Créer quand même']) {
      assert.strictEqual(core.titreQuestion('Des mois sont clôturés.', vide).titre, 'Avant de continuer', vide);
    }
    // Une question trop longue pour un titre reste dans le corps.
    const longue = 'Marquer ' + 'x'.repeat(100) + ' ?';
    assert.strictEqual(core.titreQuestion(longue, 'Marquer').corps, longue);
  });

  t('10.14.0 : la boîte de question ne s\'intitule plus « Confirmation » — elle lit son titre', () => {
    const i = app.indexOf('function confirmDialog(');
    const f = app.slice(i, app.indexOf('\n  }\n', i));
    assert.ok(f.length > 300 && f.length < 3000, 'tranche confirmDialog : ' + f.length);
    assert.ok(!/<h2>Confirmation<\/h2>/.test(app), 'un titre « Confirmation » écrit en dur est revenu');
    assert.ok(/C\.titreQuestion\(msg, okLabel\)/.test(f), 'le titre se déduit du message et du geste');
    assert.ok(/opts && opts\.titre/.test(f), 'l\'appelant qui sait mieux peut donner le sien');
    assert.ok(/<h2>\$\{numerosInsecables\(h\(enTete\(q\.titre\)\)\)\}<\/h2>/.test(f), 'le titre est affiché, échappé, et un numéro de pièce ne s\'y coupe pas');
  });

  // « Émise » au lieu de « envoyée » : le LIBELLÉ change, jamais la valeur rangée dans les données.
  t('10.14.0 : une facture émise se dit « émise », une proforma envoyée reste « envoyée »', () => {
    assert.strictEqual(core.statusLabel('envoyée'), 'émise', 'sans type : une facture');
    assert.strictEqual(core.statusLabel('envoyée', 'facture'), 'émise');
    assert.strictEqual(core.statusLabel('envoyée', 'proforma'), 'envoyée', 'une proforma, c\'est l\'envoi qui la pose');
    assert.strictEqual(core.statusLabel('envoyé', 'devis'), 'envoyé', 'le devis garde son geste d\'envoi');
    assert.strictEqual(core.statusLabel('retard', 'facture'), 'en retard');
    // La donnée ne bouge pas : c'est toujours « envoyée » que l'émission range.
    assert.ok(core.STATUSES.facture.includes('envoyée'));
  });

  t('10.14.0 : les badges et les listes passent le TYPE de la pièce, et « Émis » ne double pas « Émise »', () => {
    assert.ok(/function statusBadge\(doc\) \{ return badge\(effStatus\(doc\), doc && doc\.type\); \}/.test(app), 'le badge d\'une pièce connaît son type');
    assert.ok(/optionStatut\(x, type\)/.test(app), 'la liste des autres pièces passe son type');
    assert.ok(/optionStatut\(st, doc\.type\)/.test(app), 'l\'éditeur passe le type');
    const i = app.indexOf('const FILTRES_REGROUPES');
    const zone = app.slice(i, i + 200);
    assert.ok(i > 0 && /'émis': 'Toutes les pièces émises'/.test(zone), 'le regroupement a son libellé');
    assert.ok(/FILTRES_REGROUPES\[x\] \|\| optionStatut\(x\)/.test(app), 'la liste des factures l\'utilise');
  });
};
