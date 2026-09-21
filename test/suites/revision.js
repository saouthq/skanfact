'use strict';
// ============================================================================================
// La révision et les questions (9.10.0)
//
// Ce que ces tests tiennent, et c'est UNE règle déclinée : **le cabinet n'écrit jamais chez un
// client** (Cabinet 1.0.0). Ce qui remonte du cabinet vers le client n'est pas une écriture,
// c'est une QUESTION — une demande qui s'affiche en face de la pièce et attend. Autour de ça :
// la méthode de révision appartient au comptable (les cycles proposent, le questionnaire part
// vide), un pointage se défait, un compteur et la liste qu'il annonce se calculent pareil, et
// une question partie deux fois sans réponse remonte des DEUX côtés.
module.exports = ({ t, assert, lireSource }) => {
const K = require('../../src/renderer/compta.js');
const C = require('../../src/cabinet/cabcore.js');
const Core = require('../../src/renderer/core.js');

function livre(annee) {
  const l = K.livreVide('D1', annee || 2026, {
    plan: [
      { compte: '411', libelle: 'Clients', role: 'clients' },
      { compte: '706', libelle: 'Prestations', role: 'ventes' },
      { compte: '532', libelle: 'Caisse', role: 'caisse' },
      { compte: '471', libelle: 'Compte d\'attente' }
    ]
  });
  const piece = (date, piece2, c1, c2, montant) => {
    const e = K.ajouterEcriture(l, {
      date, journal: 'VT', piece: piece2, libelle: 'Vente',
      lignes: [{ compte: c1, debit: montant }, { compte: c2, credit: montant }]
    }, 'Amine', 1000);
    K.validerEcriture(l, e.id, 'Amine', 2000);
    return e;
  };
  piece(`${annee || 2026}-03-04`, 'FAC-1', '411', '706', 1200);
  piece(`${annee || 2026}-04-10`, 'ENC-1', '532', '411', 1200);
  return l;
}

// ---------------------------------------------------------------- les cycles

t('9.10.0 : le cycle d\'un compte se décide par le préfixe le PLUS LONG, jamais par l\'ordre', () => {
  // Même règle que `libelleDuPlan`, `compteCorrespondant` et `compteDuLibelle`. Sans elle, 436
  // irait en « personnel » ou en « fiscal » selon l'ordre dans lequel les cycles ont été écrits —
  // et le résultat changerait au premier réarrangement de la table.
  assert.strictEqual(K.cycleDuCompte('4366'), 'fiscal');
  assert.strictEqual(K.cycleDuCompte('4311'), 'personnel', '43 est personnel, 436 est fiscal : le plus long gagne');
  assert.strictEqual(K.cycleDuCompte('411001'), 'ventes');
  assert.strictEqual(K.cycleDuCompte('532'), 'tresorerie');
  assert.strictEqual(K.cycleDuCompte(''), '');
  // Et la table du cabinet REMPLACE celle du moteur — jamais une fusion des deux, qui donnerait un
  // rattachement que personne n'a décidé.
  const miens = [{ id: 'tout', label: 'Tout', prefixes: ['4'] }];
  assert.strictEqual(K.cycleDuCompte('4366', miens), 'tout');
  assert.strictEqual(K.cycleDuCompte('706', miens), '', 'un compte hors de MA table n\'a pas de cycle');
});

t('9.10.0 : une feuille maîtresse ne lit que les VALIDÉES, et porte la variation', () => {
  const l = livre(2026);
  K.ajouterEcriture(l, { date: '2026-05-01', journal: 'OD', piece: 'BR-1', libelle: 'Brouillard',
    lignes: [{ compte: '471', debit: 900 }, { compte: '532', credit: 900 }] }, 'Amine', 3000);
  const f = K.feuilleMaitresse(l, 'ventes', {});
  const c411 = f.rows.find(r => r.compte === '411');
  assert.ok(c411, 'le 411 doit être dans le cycle ventes');
  assert.strictEqual(c411.debit, 1200);
  assert.strictEqual(c411.credit, 1200);
  assert.strictEqual(c411.solde, 0);
  assert.strictEqual(c411.variation, 0, 'sans ouverture, la variation est le solde');
  // Le brouillard n'entre pas : on ne révise pas ce qui n'est pas encore un fait.
  const tr = K.feuilleMaitresse(l, 'tresorerie', {});
  assert.strictEqual(tr.rows.find(r => r.compte === '532').solde, 1200,
    'le brouillard de 900 ne doit PAS entrer dans la feuille maîtresse');
  // Mais il se voit quand on le demande — et les contrôles le NOMMENT avant d'arrêter.
  const avecBr = K.feuilleMaitresse(l, 'tresorerie', { brouillard: true });
  assert.strictEqual(avecBr.rows.find(r => r.compte === '532').solde, 300);
  const ctrl = K.controlesRevision(l, '2026');
  assert.ok(ctrl.some(c => c.id === 'brouillard'), 'le brouillard restant doit être signalé');
});

t('9.10.0 : un compte signé se DÉSIGNE, et le compte hors cycle est montré', () => {
  const l = livre(2026);
  // Le 471 n'appartient à aucun des sept cycles : on le MONTRE plutôt que de le perdre — un compte
  // hors cycle est très exactement celui qu'une révision doit voir.
  K.ajouterEcriture(l, { date: '2026-06-01', journal: 'OD', piece: 'OD-1', libelle: 'Attente',
    lignes: [{ compte: '471', debit: 50 }, { compte: '532', credit: 50 }] }, 'Amine', 4000);
  K.validerEcriture(l, l.ecritures[l.ecritures.length - 1].id, 'Amine', 4100);
  const d = K.dossierDeRevision(l, {});
  assert.ok(d.hors.some(r => r.compte === '471'), 'le 471 n\'appartient à aucun cycle : il doit être montré');
  assert.strictEqual(d.revus, 0);
  K.signerCompte(l, '2026', '411', 'Amine', 5000, { note: 'lettré' });
  assert.strictEqual(K.dossierDeRevision(l, {}).revus, 1);
  // Un pointage se DÉFAIT (7.12.0) : un dossier de révision qu'on ne peut pas corriger ne se remplit pas.
  K.signerCompte(l, '2026', '411', 'Amine', 6000, { revu: false });
  assert.strictEqual(K.dossierDeRevision(l, {}).revus, 0, 'retirer sa signature doit vraiment la retirer');
});

t('9.10.0 : les contrôles de révision NOMMENT sans bloquer, et la révision se rouvre', () => {
  const l = livre(2026);
  K.ajouterNoteRevue(l, '2026', { texte: 'Rapprocher le 471' }, 'Sonia', 7000);
  const avant = K.controlesRevision(l, '2026');
  assert.ok(avant.some(c => c.id === 'notes'), 'une note non levée doit être signalée');
  // Ils ne bloquent pas : une révision arrêtée avec des manques signalés vaut mieux qu'une révision
  // jamais arrêtée parce que l'application faisait la difficile (règle 6.0.0).
  const r = K.arreterRevision(l, '2026', 'Sonia', 8000, {});
  assert.strictEqual(r.faite, true, 'les contrôles ne bloquent JAMAIS l\'arrêt d\'une révision');
  assert.ok(r.controles.length, 'mais ils sont rendus avec le résultat');
  assert.strictEqual(K.arreterRevision(l, '2026', 'Sonia', 9000, { faite: false }).faite, false);
});

t('9.10.0 : le questionnaire part VIDE, et se pose sans doubler', () => {
  // Les cinq questions les plus fréquentes du pilote ne sont pas connues : les inventer serait
  // écrire sa méthode à sa place. La valeur par défaut d'une règle qu'on ne connaît pas est celle
  // qui ne fait rien (9.1.1). Le test TOMBE si quelqu'un écrit une question « d'exemple ».
  assert.deepStrictEqual(C.DEFAULT_STATE.questionnaire, [],
    'le questionnaire de fin d\'exercice part vide : il appartient au comptable');
  assert.deepStrictEqual(C.DEFAULT_STATE.cycles, [],
    'les cycles du cabinet partent vides : ceux du moteur ne font que PROPOSER');
  const l = livre(2026);
  const un = K.poserQuestionnaire(l, '2026', [{ question: 'Des litiges en cours ?' }, 'Des engagements hors bilan ?'], 'Sonia', 1);
  assert.strictEqual(un.poses, 2);
  const deux = K.poserQuestionnaire(l, '2026', [{ question: 'Des litiges en cours ?' }], 'Sonia', 2);
  assert.strictEqual(deux.poses, 0, 'reposer le questionnaire ne double aucune question');
  assert.strictEqual(deux.total, 2);
});

t('9.10.0 : les deux listes du cabinet entrent dans migrate — absentes, elles seraient jetées', () => {
  // C'est le défaut `matricule` de la 6.8.0 : un champ hors de `migrate` est jeté au prochain
  // chargement, sans un mot. Ici, la méthode de révision du cabinet entière.
  const s = C.migrate({ questionnaire: [{ question: 'A ?' }, { question: '  ' }, 'B ?'],
    cycles: [{ id: 'x', label: 'X', prefixes: ['4', ' '] }, { id: '', label: 'sans id', prefixes: ['5'] }] });
  assert.deepStrictEqual(s.questionnaire, [{ question: 'A ?' }, { question: 'B ?' }],
    'une question vide ne se garde pas, une chaîne nue se normalise');
  assert.deepStrictEqual(s.cycles, [{ id: 'x', label: 'X', prefixes: ['4'] }],
    'un cycle sans identifiant ni nom ne se garde pas : sa feuille maîtresse s\'appellerait « »');
});

// ---------------------------------------------------------------- les questions

t('9.10.0 : une question naît d\'une LIGNE et porte sa pièce', () => {
  const l = livre(2026);
  const e = l.ecritures[0];
  const r = K.ajouterQuestion(l, { texte: 'Où est la facture ?', ecritureId: e.id, compte: '411', attendu: 'piece' }, 'Sonia', 1);
  assert.ok(r.ok);
  assert.strictEqual(r.question.piece, 'FAC-1', 'la pièce se DÉDUIT de l\'écriture visée');
  assert.strictEqual(r.question.periode, '2026-03');
  assert.strictEqual(r.question.cycle, 'ventes');
  assert.strictEqual(r.question.statut, 'ouverte');
  assert.ok(!K.ajouterQuestion(l, { texte: '' }, 'Sonia', 2).ok, 'une question sans texte n\'apprend rien');
  assert.ok(!K.ajouterQuestion(l, { texte: 'x', attendu: 'correction' }, 'Sonia', 3).ok,
    'une attente inconnue est refusée : une case qu\'on ne sait pas traiter est pire qu\'une case absente');
});

t('9.10.0 : une question DÉJÀ PARTIE se ferme, elle ne s\'efface pas', () => {
  const l = livre(2026);
  const q = K.ajouterQuestion(l, { texte: 'Où est la facture ?', piece: 'FAC-1' }, 'Sonia', 1).question;
  assert.ok(K.supprimerQuestion(l, q.id, 'Sonia', 2).ok, 'jamais partie : elle s\'efface');
  const q2 = K.ajouterQuestion(l, { texte: 'Et celle-ci ?', piece: 'FAC-1' }, 'Sonia', 3).question;
  K.noterEnvoiQuestions(l, [q2.id], 4);
  // Le client l'a sous les yeux : la faire disparaître de notre côté le laisserait répondre à une
  // question qui n'existe plus.
  const s = K.supprimerQuestion(l, q2.id, 'Sonia', 5);
  assert.ok(!s.ok && /se ferme/.test(s.motifs[0]), 'une question partie chez le client ne s\'efface pas');
  assert.ok(K.fermerQuestion(l, q2.id, 'Sonia', 6).ok);
  assert.strictEqual(l.questions[0].statut, 'close');
});

t('9.10.0 : ce qui part chez le client ne porte QUE de quoi répondre', () => {
  // Un jour quelqu'un voudra « juste ajouter le solde du compte pour qu'il comprenne ». Un fichier
  // qui part chez un client ne porte rien qu'il n'ait besoin de lire : c'est ce test qui l'arrête
  // (même garde que `chargeHistorique`, 8.7.0).
  const l = livre(2026);
  K.ajouterQuestion(l, { texte: 'Où est la facture ?', ecritureId: l.ecritures[0].id, compte: '411' }, 'Sonia', 1);
  const dos = K.dossierDeQuestions(l, { cabinet: 'Cab', matricule: '1234567A', quand: 9 });
  assert.deepStrictEqual(Object.keys(dos).sort(),
    ['cabinet', 'dossier', 'exercice', 'format', 'matricule', 'produitLe', 'questions'].sort());
  assert.deepStrictEqual(Object.keys(dos.questions[0]).sort(),
    ['attendu', 'compte', 'creeLe', 'libelleCompte', 'montant', 'objet', 'periode', 'piece', 'texte', 'id'].sort(),
    'la charge d\'une question est FIXE : rien du livre du cabinet ne doit s\'y glisser');
  // Et une question close ou déjà répondue ne repart pas : la renvoyer ferait chercher au client
  // quelque chose qui n'existe plus.
  K.fermerQuestion(l, l.questions[0].id, 'Sonia', 10);
  assert.strictEqual(K.dossierDeQuestions(l, {}).questions.length, 0);
});

t('9.10.0 : la règle des DEUX paquets, et elle vaut des deux côtés', () => {
  const l = livre(2026);
  const q = K.ajouterQuestion(l, { texte: 'Où est la facture ?', piece: 'FAC-1' }, 'Sonia', 1).question;
  K.noterEnvoiQuestions(l, [q.id], 2);
  assert.strictEqual(K.questionsARelancer(l, {}).length, 0, 'un seul envoi : le client a pu la manquer');
  K.noterEnvoiQuestions(l, [q.id], 3);
  assert.strictEqual(K.questionsARelancer(l, {}).length, 1, 'deux envois sans réponse : ce n\'est plus un oubli');
  // Côté CLIENT : le même seuil, lu par la même constante — deux chiffres écrits à deux endroits
  // divergeraient, et les deux applications ne diraient plus la même chose de la même question.
  const envoi = K.dossierDeQuestions(l, { quand: 4 });
  let liste = K.fusionnerQuestionsRecues([], envoi, 5).liste;
  assert.strictEqual(K.questionsSansReponse(liste).length, 0, 'reçue une fois : rien à crier');
  liste = K.fusionnerQuestionsRecues(liste, envoi, 6).liste;
  assert.strictEqual(liste[0].recues, 2, 'une seconde réception se COMPTE, elle ne double pas la ligne');
  assert.strictEqual(K.questionsSansReponse(liste).length, 1);
  assert.strictEqual(Core.QUESTION_RELANCE, K.QUESTION_RELANCE, 'le seuil est le MÊME objet des deux côtés');
});

t('9.10.0 : la réponse revient, ne touche aucun chiffre, et ne se réécrit pas en arrière', () => {
  const l = livre(2026);
  const q = K.ajouterQuestion(l, { texte: 'Où est la facture ?', piece: 'FAC-1' }, 'Sonia', 1).question;
  const soldeAvant = K.feuilleMaitresse(l, 'ventes', {}).totaux.solde;
  const envoi = K.dossierDeQuestions(l, { quand: 2 });
  K.noterEnvoiQuestions(l, [q.id], 2);
  let liste = K.fusionnerQuestionsRecues([], envoi, 3).liste;
  assert.ok(!K.repondreQuestion(liste, q.id, { texte: '   ' }, 4).ok, 'une réponse vide n\'apprend rien');
  liste = K.repondreQuestion(liste, q.id, { texte: 'La voici' }, 5).liste;
  assert.strictEqual(K.reponsesAEnvoyer(liste).length, 1);
  const r = K.noterReponsesQuestions(l, K.reponsesAEnvoyer(liste), 6);
  assert.strictEqual(r.posees, 1);
  assert.strictEqual(l.questions[0].statut, 'repondue');
  assert.strictEqual(K.feuilleMaitresse(l, 'ventes', {}).totaux.solde, soldeAvant,
    'une réponse ne touche AUCUN chiffre du livre : le cabinet n\'écrit jamais chez un client');
  // Une réponse PLUS ANCIENNE ne remplace pas une plus récente : le client peut renvoyer un vieux
  // paquet, et la réponse d'hier écraserait celle d'aujourd'hui.
  K.noterReponsesQuestions(l, [{ id: q.id, texte: 'ancienne', le: 1 }], 7);
  assert.strictEqual(l.questions[0].reponse.texte, 'La voici');
  assert.strictEqual(K.noterReponsesQuestions(l, [{ id: 'inconnue' }], 8).inconnues.length, 1);
});

t('9.10.0 : la question s\'affiche en face de SA pièce, et disparaît une fois répondue', () => {
  const l = livre(2026);
  K.ajouterQuestion(l, { texte: 'Où est la facture ?', piece: 'FAC-1' }, 'Sonia', 1);
  K.ajouterQuestion(l, { texte: 'Et ce virement ?', piece: 'ENC-1' }, 'Sonia', 2);
  const liste = K.fusionnerQuestionsRecues([], K.dossierDeQuestions(l, {}), 3).liste;
  assert.strictEqual(K.questionsDeLaPiece(liste, 'FAC-1').length, 1);
  assert.strictEqual(K.questionsDeLaPiece(liste, 'ENC-1').length, 1);
  assert.strictEqual(K.questionsDeLaPiece(liste, '').length, 0, 'un brouillon sans numéro ne porte aucune question');
  const apres = K.repondreQuestion(liste, liste[0].id, { texte: 'La voici' }, 4).liste;
  assert.strictEqual(K.questionsDeLaPiece(apres, 'FAC-1').length, 0,
    'une question répondue quitte le bandeau : sinon il reste sur la pièce pour toujours');
});

t('9.10.0 : la fusion de deux postes garde les questions ET le travail de révision', () => {
  const a = livre(2026);
  const b = K.livreVide('D1', 2026, { plan: a.plan.map(p => ({ ...p })) });
  K.ajouterQuestion(a, { texte: 'Chez moi', piece: 'FAC-1' }, 'Amine', 1);
  K.ajouterQuestion(b, { texte: 'Chez lui', piece: 'ENC-1' }, 'Sonia', 2);
  K.signerCompte(a, '2026', '411', 'Amine', 3, {});
  K.signerCompte(b, '2026', '706', 'Sonia', 4, {});
  K.arreterRevision(b, '2026', 'Sonia', 5, {});
  const r = K.fusionnerLivres(a, b, 9);
  assert.ok(r.ok);
  assert.strictEqual(r.livre.questions.length, 2, 'aucune question d\'un poste n\'est perdue');
  const rev = K.revisionDe(r.livre, '2026');
  assert.strictEqual(rev.comptes.length, 2, 'un compte signé sur un poste l\'est pour le dossier');
  assert.strictEqual(rev.faite, true,
    'une période arrêtée d\'un côté reste arrêtée : on ne défait pas la révision d\'un collègue');
});

// ---------------------------------------------------------------- les deux applications

t('9.10.0 : le cabinet n\'écrit jamais une écriture depuis une question', () => {
  // La règle fondatrice (Cabinet 1.0.0), vue par ce chemin-ci : ce qui remonte vers le client est
  // une DEMANDE. Aucune des fonctions de ce lot ne touche à `ecritures` — un test de source, parce
  // que le jour où quelqu'un écrira « et si on proposait la correction ? », c'est là qu'il faudra
  // s'arrêter et rouvrir la question du format avec le pilote.
  const src = lireSource('src', 'renderer', 'compta.js');
  const i = src.indexOf('la révision et les questions (9.10.0)');
  const j = src.indexOf('la fusion de deux livres (9.9.0)');
  assert.ok(i > 0 && j > i && j - i > 6000, 'la tranche de la 9.10.0 est vide ou mal bornée');
  const zone = src.slice(i, j);
  assert.ok(!zone.includes('la fusion de deux livres'), 'la tranche déborde sur la 9.9.0');
  assert.ok(!/ajouterEcriture\(|validerEcriture\(|livre\.ecritures\.push/.test(zone),
    'aucune fonction de la révision ne doit écrire une écriture : le cabinet n\'écrit jamais chez un client');
});

t('9.10.0 : les deux portes du Cabinet sont posées, et l\'envoi note l\'envoi APRÈS l\'écriture', () => {
  const src = lireSource('src', 'cabinet', 'main.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  // Les six handlers qui ÉCRIVENT passent par `droitBlock` (9.9.0) : un stagiaire ne valide pas une
  // révision. Celui qui LIT, non — sinon ce serait des données en otage (6.4.0).
  ['cab:signerCompte', 'cab:noteRevue', 'cab:questionnaire', 'cab:arreterRevision', 'cab:question', 'cab:ecrireQuestions']
    .forEach(h => {
      const i = src.indexOf(`ipcMain.handle('${h}'`);
      assert.ok(i > 0, `le handler ${h} est absent`);
      const fin = Math.min(...[src.indexOf('ipcMain.handle(', i + 10), src.indexOf('\nfunction ', i)].filter(x => x > 0));
      assert.ok(src.slice(i, fin).includes('droitBlock('), `${h} écrit dans le livre sans passer par droitBlock`);
    });
  const iLire = src.indexOf('ipcMain.handle(\'cab:revision\'');
  const finLire = Math.min(...[src.indexOf('ipcMain.handle(', iLire + 10), src.indexOf('\nfunction ', iLire)].filter(x => x > 0));
  assert.ok(!src.slice(iLire, finLire).includes('droitBlock('),
    'LIRE un dossier de révision n\'est fermé à personne : jamais de données en otage');
  // L'envoi se note APRÈS l'écriture du fichier : une question comptée comme partie sur un fichier
  // qu'on n'a pas su écrire ferait croire au client qu'il l'a déjà vue (règle des deux paquets).
  const iEnv = src.indexOf('ipcMain.handle(\'cab:ecrireQuestions\'');
  const zone = src.slice(iEnv, src.indexOf('ipcMain.handle(', iEnv + 10));
  assert.ok(zone.indexOf('fs.writeFileSync') < zone.indexOf('noterEnvoiQuestions'),
    'l\'envoi se note APRÈS l\'écriture du fichier, jamais avant');
  // Et aucun handler n'écrit le livre en contournant la porte unique (9.2.0).
  assert.ok(!/getStore\(\)\.ecrireLivre/.test(zone), 'la porte unique est `ecrireLeLivre`, jamais le store');
});

t('9.10.0 : côté client, la réponse voyage dans le PAQUET et le bandeau est branché', () => {
  // Un test qui lit du code doit lire du CODE (6.8.0, 7.25.0, 9.4.10) : ma première version
  // cherchait « reponses.json » dans la source brute, et le commentaire qui explique la règle
  // porte ce mot — l'assertion restait donc verte avec le fichier renommé. Trouvé en
  // réintroduisant le défaut, jamais autrement.
  const core = lireSource('src', 'renderer', 'core.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(core.includes('function packPlan'), 'le nettoyage des commentaires a mangé le code');
  // Dans le paquet plutôt que dans un envoi à part : c'est déjà le geste mensuel, et une réponse
  // qu'il faut penser à envoyer séparément n'est jamais envoyée.
  const i = core.indexOf('function packPlan');
  const zone = core.slice(i, core.indexOf('function packCoverHtml'));
  assert.ok(zone.length > 1000 && zone.includes('reponses.json'), 'le paquet n\'emporte pas les réponses');
  assert.ok(/if \(reponses\.length\)/.test(zone),
    'un fichier de réponses VIDE dans chaque paquet apprendrait au cabinet à ne plus l\'ouvrir');
  // Et la liste entre dans `migrateData` : absente, elle serait jetée au prochain chargement et le
  // comptable n'aurait jamais de réponse — sans un mot (défaut `matricule`, 6.8.0).
  assert.ok(/Array\.isArray\(data\.questionsCabinet\)/.test(core), 'questionsCabinet n\'entre pas dans migrateData');

  const app = lireSource('src', 'renderer', 'app.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  // Les DEUX moitiés : le gabarit pose le bouton, le branchement l'arme. Le gabarit seul donnerait
  // un bouton qui accepte le clic et n'en fait rien (7.0.0).
  assert.ok(/function bandeauQuestions/.test(app) && /data-qrep=/.test(app), 'le bandeau de la pièce n\'est pas posé');
  assert.ok((app.match(/brancherQuestions\(\)/g) || []).length >= 2,
    'le bandeau est posé sur deux éditeurs : il doit être armé sur les deux');
  assert.ok((app.match(/\$\{bandeauQuestions\(/g) || []).length >= 2,
    'le bandeau doit être posé sur la facture ET sur l\'achat');
  // La règle des deux paquets remonte aussi dans « À faire » du client (F-9.10.0-10).
  assert.ok(/questionsSansReponse\(/.test(core), '« À faire » du client n\'applique pas la règle des deux paquets');
});
};
