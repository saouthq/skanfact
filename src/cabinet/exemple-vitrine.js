'use strict';
// ============================================================================================
// L'exemple qui MONTRE ce que le Cabinet sait faire (10.12.0, U-10)
//
// Un comptable qui ouvre l'exemple regarde d'abord ce qui lui prend ses journées : la banque, les
// immobilisations, la paie, la révision. Jusqu'à la 10.12.0, ces quatre écrans étaient VIDES dans
// l'exemple. Il ne montrait donc que ce qu'un tableur fait déjà, et tout ce qu'un logiciel de
// comptabilité fait de plus restait à imaginer — c'est-à-dire à ne pas acheter.
//
// Deux dossiers servent de vitrine, déclarés dans le scénario lui-même (`vitrine` dans
// `demoDossiers`, une seule source) :
//   · un client SUR SkanFact, dont les écritures arrivent par paquet : un relevé bancaire rapproché
//     — avec une ambiguïté que l'automatique refuse de trancher, un mouvement que le livre n'a pas
//     et un que la banque n'a pas encore —, une révision entamée et une question posée sur une
//     pièce ;
//   · un client HORS SkanFact, dont le cabinet tient tout : une balance d'ouverture, deux biens,
//     deux salariés et leurs bulletins, une paie passée en écriture et une qui attend.
//
// Tout passe par les VRAIS moteurs de `compta.js` (`balanceOuverture`, `ajouterReleve`,
// `rapprocherAuto`, `ajouterImmobilisation`, `ajouterBulletin`, `ecritureDePaie`…), et main.js
// écrit le livre par sa porte unique. Un exemple qui fabriquerait ses objets à la main montrerait
// des écrans que le produit ne sait pas produire — la leçon de la 9.2.2 : « rien de ce que
// l'exemple montrait n'avait traversé la vraie porte ».
//
// Pur : ni Electron ni disque. Chaque date se déduit de `aujourdhui` (l'exemple est relatif au mois
// courant, 9.2.2), et rien ne s'écrit dans le futur.
// ============================================================================================
const KC = require('../renderer/compta.js');

const r3 = KC.round3;
const pad = n => String(n).padStart(2, '0');
const finDuMois = m => {
  const [a, mo] = String(m).split('-').map(Number);
  return new Date(Date.UTC(a, mo, 0)).toISOString().slice(0, 10);
};
const moisAvant = (ym, n) => {
  const [a, m] = String(ym).split('-').map(Number);
  const t = a * 12 + (m - 1) - n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
};

// Le tiers d'une écriture, tel que l'app entreprise l'écrit dans son libellé : « Règlement
// FAC-2026-010 — Restaurant Dar El Jeld (CHQ 0045871) » → « Restaurant Dar El Jeld ».
const tiersDuLibelle = t => (String(t || '').split(' — ')[1] || '').replace(/\s*\(.*$/, '').trim();

// Le libellé tel qu'une BANQUE l'écrit : en capitales, sans accent, avec ses mots à elle. C'est ce
// qui rend le rapprochement démontrable — un relevé qui recopierait mot pour mot le libellé du livre
// ne montrerait rien de ce que le moteur sait lire.
function libelleDeBanque(texte, montant) {
  const t = KC.sansAccents(String(texte || '')).toUpperCase();
  const tiers = tiersDuLibelle(t);
  const chq = /\(CHQ\s*([0-9]+)\)/.exec(t);
  if (chq) return `REMISE CHEQUE ${chq[1]}${tiers ? ' ' + tiers : ''}`;
  if (/\(VIR\b/.test(t)) return `VIR RECU ${tiers}`.trim();
  if (/FRAIS/.test(t)) return 'FRAIS TENUE DE COMPTE';
  if (/TVA|ACOMPTE|IMPOT|TAXE/.test(t)) return 'VIR EMIS RECETTE DES FINANCES';
  const net = t.replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (montant < 0 ? 'VIR EMIS ' : 'VERSEMENT ') + (tiers || net);
}
const referenceDe = texte => {
  const m = /\((?:CHQ|VIR)\s*([^)]+)\)/i.exec(String(texte || ''));
  return m ? m[1].trim() : '';
};

// Le compte bancaire le plus mouvementé du livre. Le relevé porte sur UN compte, et c'est celui où
// il se passe quelque chose qu'un comptable veut voir rapproché.
function compteBancaire(livre) {
  const n = {};
  (livre.ecritures || []).forEach(e => (e.lignes || []).forEach(l => {
    if (/^53/.test(String(l.compte))) n[l.compte] = (n[l.compte] || 0) + 1;
  }));
  return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b))[0] || '';
}

// La balance d'ouverture d'un client repris en cours d'année. Sans elle, son compte en banque
// partirait de zéro au 1er janvier et le relevé d'août afficherait un découvert imaginaire : le
// premier chiffre que le comptable regarde serait faux. Trois comptes, équilibrés.
function ouvrirClientSkanfact(livre, o) {
  // Un livre qui porte DÉJÀ un à-nouveau (celui que le client envoie dans son paquet de janvier) n'en
  // reçoit pas un second : l'ouverture compterait deux fois — le défaut même que la vitrine a révélé.
  if ((livre.ecritures || []).some(e => e.journal === 'AN')) return { ok: true, deja: true };
  const a = livre.exercice.annee;
  return KC.balanceOuverture(livre, [
    { compte: '532', libelle: 'Banque — solde reporté', debit: 18500, credit: 0 },
    { compte: '101', libelle: 'Capital social', debit: 0, credit: 10000 },
    { compte: '12', libelle: 'Résultats reportés', debit: 0, credit: 8500 }
  ], `${a}-01-01`, 'balance', o.qui, o.quand);
}

// ------------------------------------------------------------------ la banque (client SkanFact)
//
// Le relevé du dernier mois qui a de la matière (trois mouvements au moins), bâti depuis les
// mouvements RÉELS du livre, avec trois écarts que la vie produit tous les mois :
//   1. une commission que la banque a prélevée et que personne n'a encore écrite → suspens BANQUE,
//      et « écrire l'écriture manquante » depuis la ligne ;
//   2. le dernier encaissement du mois, crédité par la banque le mois suivant → suspens LIVRE ;
//   3. un règlement annoncé par téléphone et saisi au brouillard, du MÊME montant qu'une remise de
//      chèque deux jours plus tôt → deux candidats pour une ligne : l'automatique ne pose rien, il
//      désigne le plus probable, et le comptable tranche. C'est LA règle de la 9.5.0 (« une
//      ambiguïté n'est jamais certaine »), et c'est elle qu'un comptable veut voir tenue.
function garnirBanque(livre, o) {
  const compte = compteBancaire(livre);
  if (!compte) return { ok: false, motif: 'aucun compte bancaire dans ce livre' };
  const parId = new Map((livre.ecritures || []).map(e => [e.id, e]));
  const mouv = KC.lignesBancaires(livre, compte)
    .filter(l => l.statut !== 'contrepassee' && (parId.get(l.ecritureId) || {}).journal !== 'AN');
  const courant = String(o.aujourdhui || '9999-12').slice(0, 7);
  const lesMois = [...new Set(mouv.map(l => l.date.slice(0, 7)))].filter(m => m < courant).sort();
  const mois = lesMois.slice().reverse().find(m => mouv.filter(l => l.date.slice(0, 7) === m).length >= 3);
  if (!mois) return { ok: false, motif: 'aucun mois terminé ne porte trois mouvements bancaires' };
  // Le solde que le livre porte la veille d'un jour : un relevé continue le livre, et tout l'écart
  // d'un mois s'explique alors par ses propres mouvements — rien « d'avant les relevés ».
  const soldeAvant = du => r3(KC.lignesBancaires(livre, compte)
    .filter(l => l.statut !== 'contrepassee' && l.date < du).reduce((s, l) => s + l.montant, 0));
  const ligneDeBanque = l => ({ date: l.date, libelle: libelleDeBanque(l.libelle, l.montant), montant: l.montant, reference: referenceDe(l.libelle) });
  const duMois = m => mouv.filter(l => l.date.slice(0, 7) === m).sort((a, b) => a.date.localeCompare(b.date));

  // Le mois montré : les trois écarts de la vie réelle.
  const du = `${mois}-01`, au = finDuMois(mois);
  const leMois = duMois(mois);
  const recettes = leMois.filter(l => l.montant > 0);
  const source = recettes.find(l => /\(CHQ\b/i.test(l.libelle) && KC.ajouterJoursIso(l.date, 2) <= au)
    || recettes.find(l => KC.ajouterJoursIso(l.date, 2) <= au) || null;
  const tardive = recettes.filter(l => l !== source).slice(-1)[0] || null;
  const soldeDebut = soldeAvant(du);
  const lignes = leMois.filter(l => l !== tardive).map(ligneDeBanque);
  const vire = leMois.find(l => l.montant < 0 && !/frais/i.test(l.libelle));
  // Trois dinars cinq cents : une commission de virement, telle qu'une banque la prélève.
  lignes.push({ date: vire ? vire.date : au, libelle: 'COMMISSION SUR VIREMENT EMIS', montant: -3.5, reference: '' });
  lignes.sort((a, b) => a.date.localeCompare(b.date));
  const soldeFin = r3(soldeDebut + lignes.reduce((s, l) => s + l.montant, 0));

  // L'ambiguïté : le règlement annoncé, au brouillard, AVANT l'import — c'est l'ordre dans lequel
  // un cabinet travaille, et c'est ce qui en fait un second candidat.
  let ambigu = null;
  if (source) {
    const e0 = parId.get(source.ecritureId) || { lignes: [] };
    const contre = (e0.lignes || []).find((x, i) => i !== source.ligne && String(x.compte) !== compte) || { compte: '411' };
    const tiers = tiersDuLibelle(source.libelle);
    const date = KC.ajouterJoursIso(source.date, 2);
    const libelle = `Règlement annoncé par téléphone${tiers ? ' — ' + tiers : ''}`;
    const e = KC.ajouterEcriture(livre, {
      date, journal: e0.journal || 'BQ', piece: '', libelle, source: 'saisie',
      lignes: [
        { compte, libelle, debit: source.montant, credit: 0 },
        { compte: contre.compte, libelle, debit: 0, credit: source.montant, tiers: contre.tiers || '', tiersId: contre.tiersId || null }
      ]
    }, o.qui, o.quand);
    ambigu = { ecritureId: e.id, montant: source.montant, date, remise: source.date };
  }

  // Le mois montré s'importe EN PREMIER : c'est lui que l'écran ouvre. Les mois d'avant suivent,
  // entiers et sans histoire — une banque rapprochée depuis le début de l'exercice, sans quoi leurs
  // mouvements resteraient en suspens et l'écart du mois montré mentirait sur son origine.
  const r = KC.ajouterReleve(livre, {
    compte, banque: 'Banque de l\'exemple', du, au, soldeDebut, soldeFin,
    fichier: `releve-${mois}.csv`, empreinte: `exemple-${compte}-${mois}`, lignes
  }, o.qui, o.quand);
  if (!r.ok) return { ok: false, motif: r.motif };
  const auto = KC.rapprocherAuto(livre, r.releve.id, { date: o.aujourdhui || '' });
  const precedents = [];
  lesMois.filter(m => m < mois).reverse().forEach(m => {
    const L = duMois(m).map(ligneDeBanque);
    const debut = soldeAvant(`${m}-01`);
    const p = KC.ajouterReleve(livre, {
      compte, banque: 'Banque de l\'exemple', du: `${m}-01`, au: finDuMois(m), soldeDebut: debut,
      soldeFin: r3(debut + L.reduce((s, l) => s + l.montant, 0)),
      fichier: `releve-${m}.csv`, empreinte: `exemple-${compte}-${m}`, lignes: L
    }, o.qui, o.quand);
    if (p.ok) { KC.rapprocherAuto(livre, p.releve.id, { date: o.aujourdhui || '' }); precedents.push(m); }
  });
  return { ok: true, compte, mois, releve: r.releve, auto, ambigu, precedents,
    tardive: tardive ? { date: tardive.date, montant: tardive.montant } : null };
}

// ------------------------------------------------------------------ la révision (client SkanFact)
//
// Une révision ENTAMÉE : deux comptes signés, une note de revue sur la banque, et une question
// posée au client sur la plus grosse charge de l'exercice — celle dont un comptable demande la
// pièce en premier. La question porte l'écriture : c'est ce qui la fait apparaître chez le client
// EN FACE de sa pièce (9.10.0), et c'est tout l'intérêt de la montrer.
function garnirRevision(livre, o) {
  const periode = String(o.periode || livre.exercice.annee);
  const soldes = {};
  (livre.ecritures || []).filter(e => e.statut === 'validee').forEach(e => (e.lignes || []).forEach(l => {
    soldes[l.compte] = r3((soldes[l.compte] || 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0));
  }));
  // Les comptes signés : le chiffre d'affaires et la TVA collectée, les deux qu'on rapproche en
  // premier des factures du paquet. Seulement s'ils existent — on ne signe pas un compte vide.
  const signes = ['706', '4367'].filter(c => soldes[c] !== undefined);
  signes.forEach(c => KC.signerCompte(livre, periode, c, o.qui, o.quand,
    { note: c === '706' ? 'Rapproché des factures reçues dans les paquets.' : 'Conforme aux déclarations mensuelles du client.' }));
  const note = o.banque && o.banque.ambigu
    ? KC.ajouterNoteRevue(livre, periode, {
      cycle: 'tresorerie', compte: o.banque.compte,
      texte: `Relevé ${KC.deMois(KC.fmtMois(o.banque.mois))} : le règlement annoncé de ${KC.fmtMontant(o.banque.ambigu.montant, 'DT')} `
        + `(brouillard du ${KC.fmtJour(o.banque.ambigu.date)}) double la remise du ${KC.fmtJour(o.banque.ambigu.remise)}, déjà `
        + 'au relevé. À retirer une fois confirmé avec le client.'
    }, o.qui, o.quand)
    : null;
  // La plus grosse charge VALIDÉE hors paie : la paie a ses propres pièces (les bulletins), une
  // facture d'achat non.
  let cible = null;
  (livre.ecritures || []).filter(e => e.statut === 'validee').forEach(e => (e.lignes || []).forEach(l => {
    if (!/^6/.test(String(l.compte)) || /^64/.test(String(l.compte)) || !(Number(l.debit) > 0)) return;
    if (!cible || Number(l.debit) > cible.montant) cible = { e, compte: String(l.compte), montant: r3(Number(l.debit)) };
  }));
  const question = cible
    ? KC.ajouterQuestion(livre, {
      ecritureId: cible.e.id, compte: cible.compte, montant: cible.montant, attendu: 'piece', cycles: KC.CYCLES_REVISION,
      objet: 'Justificatif manquant',
      texte: `La pièce ${cible.e.piece || ''} du ${KC.fmtJour(cible.e.date)} (${KC.fmtMontant(cible.montant, 'DT')}) est passée sans `
        + 'justificatif. Peux-tu nous l\'envoyer avec ton prochain paquet ?'
    }, o.qui, o.quand)
    : null;
  return { ok: true, periode, signes, note: note && note.note, question: question && question.question };
}

// ------------------------------------------------------------------ le client hors SkanFact
//
// Le dossier que le cabinet FACTURE (9.4.0) : ses pièces arrivent sur papier, le cabinet tient
// tout. L'exercice est celui du dernier mois terminé — en janvier, c'est l'année qui vient de
// finir, jamais un exercice vide.
//
// 10.12.0 — une ANNÉE TENUE, pas deux mois posés sur du vide. La première vitrine n'écrivait rien de
// février à mai et ne payait son mécanicien — embauché depuis trois ans — qu'à partir de juillet :
// un comptable le voit dans la seconde, et le bandeau « aucune écriture sur quatre mois » décrivait
// un dossier laissé à l'abandon, sur le dossier même qui doit montrer ce qu'est un dossier tenu.
// Chaque mois TERMINÉ porte maintenant ses recettes, ses achats de pièces réglés, sa paie écrite et
// réglée, sa déclaration déposée et payée, et la CNSS de chaque trimestre échu est versée. Seul le
// DERNIER mois reste à faire : sa paie attend son écriture, sa déclaration attend d'être préparée —
// c'est l'état d'un dossier tenu le jour où on l'ouvre, et l'étape suivante que l'écran met en vert.
// Les montants sont ceux d'un petit atelier et ne varient pas d'un chargement à l'autre.
const RECETTES_HT = [5960, 6240, 6580, 6310, 6920, 7150, 6850, 7420, 6990, 7260, 6640, 7780];
const PIECES_HT = [2180, 2310, 2460, 2240, 2590, 2720, 2530, 2860, 2400, 2650, 2380, 2900];
// Le taux de l'exemple, pas une règle : l'atelier de la vitrine facture ses réparations à 19 %, et
// ses pièces lui sont facturées au même taux. Le moteur, lui, ne connaît aucun taux (règle 5.0.0).
const TVA_EXEMPLE = 19;
const tvaDe = ht => r3(ht * TVA_EXEMPLE / 100);

function livreHorsSkanfact(dossierId, o) {
  const dernier = moisAvant(String(o.aujourdhui).slice(0, 7), 1);
  const annee = Number(dernier.slice(0, 4));
  const m = Number(dernier.slice(5, 7));
  const livre = KC.livreVide(dossierId, annee);
  const out = { livre, annee, biens: [], salaries: [], bulletins: [], paie: null, declarations: [], cnss: [], motifs: [] };
  const garde = (r, quoi) => { if (!r || r.ok === false) out.motifs.push(`${quoi} : ${(r && (r.motif || (r.motifs || [])[0])) || 'refusé'}`); return r; };
  // Une pièce écrite puis VALIDÉE, comme un comptable le fait pour un mois qu'il a terminé.
  const ecrire = (ecriture, quoi) => {
    const e = KC.ajouterEcriture(livre, ecriture, o.qui, o.quand);
    garde(KC.validerEcriture(livre, e.id, o.qui, o.quand), quoi);
    return e;
  };
  const moisIso = mm => `${annee}-${pad(mm)}`;
  // Le 20 du mois suivant : dépôt et paiement de la déclaration, avant l'échéance que l'écran
  // propose (le 28, À VÉRIFIER) — jamais dans le futur, puisque ce mois suivant est au plus le
  // dernier mois terminé.
  const vingtDuSuivant = mm => `${annee}-${pad(mm + 1)}-20`;

  // L'ouverture reprend un parc DÉJÀ amorti : le pont élévateur a deux ans. Son cumul au 1er
  // janvier (3 600) est exactement ce que porte le 28 — c'est le contrôle de la 10.10.0 (C-10) qui
  // tombe juste, et la fiche porte sa VRAIE date de mise en service.
  const ouv = garde(KC.balanceOuverture(livre, [
    { compte: '223', libelle: 'Pont élévateur', debit: 18000, credit: 0 },
    { compte: '28', libelle: 'Amortissements cumulés', debit: 0, credit: 3600 },
    { compte: '532', libelle: 'Banque — solde reporté', debit: 15600, credit: 0 },
    { compte: '101', libelle: 'Capital', debit: 0, credit: 20000 },
    { compte: '12', libelle: 'Résultats reportés', debit: 0, credit: 10000 }
  ], `${annee}-01-01`, 'balance', o.qui, o.quand), 'ouverture');
  const an = ouv && ouv.ecriture;
  const pont = garde(KC.ajouterImmobilisation(livre, {
    libelle: 'Pont élévateur deux colonnes', compte: '223', valeur: 18000,
    dateAcquisition: `${annee - 2}-01-01`, dateMiseEnService: `${annee - 2}-01-01`, duree: 10, methode: 'lineaire',
    origine: { source: 'ouverture', docId: an ? `${an.id}#${an.lignes.findIndex(l => l.compte === '223')}` : '', mois: `${annee}-01` }
  }, o.qui, o.quand), 'pont élévateur');
  if (pont && pont.ok) out.biens.push(pont.fiche);

  // Les gestes de l'année s'exécutent dans l'ORDRE DES DATES (10.12.0). Le numéro d'une écriture
  // naît à sa validation (9.2.0) : il raconte l'ordre du travail. Validés en vrac — l'achat
  // d'équipement d'abord, toutes les déclarations à la fin —, les numéros du livre-journal sautaient
  // (1, 4, 5…) et la déclaration de janvier portait le n° 57. Un exemple se valide comme un cabinet
  // travaille : jour après jour, et la déclaration d'un mois une fois ses pièces passées.
  const gestes = [];
  const geste = (date, rang, run) => gestes.push({ date, rang, ordre: gestes.length, run });

  // Un achat de l'année, facture puis règlement, et sa fiche rattachée à la ligne qui l'a porté :
  // sans ce rattachement, l'écran proposerait de créer une fiche qui existe déjà.
  const mAcq = Math.max(1, m - 2);
  const jAcq = `${annee}-${pad(mAcq)}-10`;
  geste(jAcq, 1, () => {
    const fac = ecrire({
      date: jAcq, journal: 'AC', piece: 'F-2291', libelle: 'Facture Auto Équipement Tunis — valise de diagnostic et ordinateur',
      lignes: [
        { compte: '228', libelle: 'Valise de diagnostic et ordinateur d\'atelier', debit: 2400, credit: 0 },
        { compte: '4366', libelle: 'TVA déductible', debit: 456, credit: 0 },
        { compte: '404', libelle: 'Auto Équipement Tunis', tiers: 'Auto Équipement Tunis', debit: 0, credit: 2856 }
      ]
    }, 'facture d\'équipement');
    const valise = garde(KC.ajouterImmobilisation(livre, {
      libelle: 'Valise de diagnostic et ordinateur d\'atelier', compte: '228', valeur: 2400, tva: 456,
      dateAcquisition: jAcq, dateMiseEnService: jAcq, duree: 3, methode: 'lineaire',
      origine: { source: 'saisie', docId: `${fac.id}#0`, mois: jAcq.slice(0, 7) }
    }, o.qui, o.quand), 'valise de diagnostic');
    if (valise && valise.ok) out.biens.push(valise.fiche);
  });
  geste(`${annee}-${pad(mAcq)}-15`, 1, () => ecrire({
    date: `${annee}-${pad(mAcq)}-15`, journal: 'BQ', piece: 'F-2291', libelle: 'Règlement Auto Équipement Tunis (VIR)',
    lignes: [
      { compte: '404', libelle: 'Auto Équipement Tunis', tiers: 'Auto Équipement Tunis', debit: 2856, credit: 0 },
      { compte: '532', libelle: 'Règlement Auto Équipement Tunis', debit: 0, credit: 2856 }
    ]
  }, 'règlement de l\'équipement'));

  // Deux salariés. Le mécanicien est là depuis trois ans : il a un bulletin CHAQUE mois. L'aide,
  // embauché le mois dernier, n'a pas encore son numéro CNSS : la paie se calcule quand même, et le
  // contrôle le NOMME — on ne bloque pas un bulletin pour un numéro qui manque (10.3.0).
  const embaucheAide = m >= 2 ? m - 1 : m;
  [
    { id: 'sal-exemple-1', nom: 'Mounir Jaziri', poste: 'Mécanicien', contrat: 'cdi', embauche: `${annee - 3}-02-01`,
      brut: 1150, cnss: '1234567-01', chefDeFamille: true, enfants: 2 },
    { id: 'sal-exemple-2', nom: 'Yassine Gharbi', poste: 'Aide-mécanicien', contrat: 'cdd',
      embauche: `${annee}-${pad(embaucheAide)}-01`, brut: 650, cnss: '' }
  ].forEach(s => { const r = garde(KC.ajouterSalarie(livre, s, o.qui, o.quand), s.nom); if (r && r.ok) out.salaries.push(r.salarie); });

  const fournisseur = 'Pièces Auto Ben Arous';
  const passees = [];
  const decls = {};
  for (let mm = 1; mm <= m; mm++) {
    const iso = moisIso(mm), fin = finDuMois(iso), duMois = KC.deMois(KC.fmtMois(iso));
    // Les pièces du mois : la facture du fournisseur le 12, réglée le 25.
    const ht = PIECES_HT[mm - 1], tva = tvaDe(ht);
    geste(`${iso}-12`, 1, () => ecrire({
      date: `${iso}-12`, journal: 'AC', piece: `PA-${annee}-${pad(mm)}`, libelle: `Facture ${fournisseur} — pièces ${duMois}`,
      lignes: [
        { compte: '607', libelle: 'Pièces détachées', debit: ht, credit: 0 },
        { compte: '4366', libelle: 'TVA déductible', debit: tva, credit: 0 },
        { compte: '401', libelle: fournisseur, tiers: fournisseur, debit: 0, credit: r3(ht + tva) }
      ]
    }, 'pièces du mois'));
    geste(`${iso}-25`, 1, () => ecrire({
      date: `${iso}-25`, journal: 'BQ', piece: `PA-${annee}-${pad(mm)}`, libelle: `Règlement ${fournisseur} (VIR)`,
      lignes: [
        { compte: '401', libelle: fournisseur, tiers: fournisseur, debit: r3(ht + tva), credit: 0 },
        { compte: '532', libelle: `Règlement ${fournisseur}`, debit: 0, credit: r3(ht + tva) }
      ]
    }, 'règlement des pièces'));

    // Les recettes de l'atelier, déposées en banque en fin de mois.
    const rec = RECETTES_HT[mm - 1], tvaRec = tvaDe(rec);
    geste(fin, 1, () => ecrire({
      date: fin, journal: 'VT', piece: `REC-${annee}-${pad(mm)}`, libelle: `Recettes de l'atelier — ${KC.fmtMois(iso)}`,
      lignes: [
        { compte: '532', libelle: 'Recettes déposées en banque', debit: r3(rec + tvaRec), credit: 0 },
        { compte: '706', libelle: 'Réparations et entretien', debit: 0, credit: rec },
        { compte: '4367', libelle: 'TVA collectée', debit: 0, credit: tvaRec }
      ]
    }, 'recettes'));

    // Les bulletins du mois (ce ne sont pas des écritures : ils se posent tout de suite) — une prime
    // de rendement sur le dernier, pour qu'un bulletin ne ressemble pas à tous les autres.
    out.salaries.filter(s => mm >= Number(String(s.embauche).slice(5, 7)) || Number(String(s.embauche).slice(0, 4)) < annee).forEach(s => {
      const r = garde(KC.ajouterBulletin(livre, {
        salarieId: s.id, annee, mois: mm, brut: s.brut, joursTravailles: 26, joursAbsence: 0,
        primes: s.id === 'sal-exemple-1' && mm === m ? [{ label: 'Prime de rendement', amount: 80, taxable: true }] : [],
        retenues: []
      }, {}, o.qui, o.quand), `bulletin de ${s.nom}`);
      if (r && r.ok) out.bulletins.push(r.bulletin);
    });

    if (mm < m) {
      // Un mois TERMINÉ : sa paie est écrite, validée et réglée le dernier jour. Le dernier mois,
      // lui, attend son écriture — c'est le geste que l'écran de la Paie propose en vert.
      geste(fin, 2, () => {
        const prop = KC.ecritureDePaie(livre, annee, mm, {});
        if (!prop.ok) { out.motifs.push(`paie ${duMois} : ${prop.motif}`); return; }
        const e = ecrire(prop.ecriture, `paie ${duMois}`);
        KC.noterEcriturePaie(livre, prop.lot, e.id, o.qui, o.quand);
        const net = r3(prop.ecriture.lignes.filter(l => l.compte === '425').reduce((x, l) => x + (Number(l.credit) || 0), 0));
        ecrire({
          date: fin, journal: 'BQ', piece: `SAL-${annee}-${pad(mm)}`, libelle: `Virement des salaires ${duMois}`,
          lignes: [
            { compte: '425', libelle: `Salaires ${duMois}`, debit: net, credit: 0 },
            { compte: '532', libelle: 'Virement des salaires', debit: 0, credit: net }
          ]
        }, 'virement des salaires');
        passees.push(mm);
      });

      // La déclaration du mois : préparée, écrite et validée une fois ses pièces passées (au dernier
      // jour, APRÈS la paie), puis déposée et payée le 20 du mois suivant — les gestes de l'écran,
      // dans leur ordre (9.6.0). Le reversement des retenues sur salaires (IRPP, TFP et FOPROLOS)
      // part le même jour, à part : le « total à décaisser » reste exactement ce que le virement de
      // TVA paie.
      const periode = iso;
      geste(fin, 9, () => {
        const d = KC.declarationMensuelle(livre, periode);
        if (!d.ok) { out.motifs.push(`déclaration ${duMois} : ${d.motif}`); return; }
        const posee = garde(KC.poserDeclaration(livre, d, o.qui, o.quand), `déclaration ${duMois}`);
        const brouillon = KC.ecritureDeclaration(livre, d);
        if (brouillon.lignes.length) {
          const e = ecrire(brouillon, `écriture de déclaration ${duMois}`);
          if (posee && posee.declaration) posee.declaration.ecritureId = e.id;
        }
        decls[mm] = d;
      });
      const le = vingtDuSuivant(mm);
      geste(le, 1, () => {
        const d = decls[mm];
        if (!d) return;
        const aPayer = d.cases.aDecaisser.montant || 0;
        if (aPayer > 0) {
          ecrire({
            date: le, journal: 'BQ', piece: `DECL-${periode}`, libelle: `Paiement de la déclaration ${duMois} (VIR)`,
            lignes: [
              { compte: d.comptes.aPayer, libelle: 'TVA à décaisser', debit: aPayer, credit: 0 },
              { compte: '532', libelle: 'Recette des finances', debit: 0, credit: aPayer }
            ]
          }, `paiement de la déclaration ${duMois}`);
        }
        const irpp = d.cases.irpp.montant || 0;
        const taxes = r3((d.cases.tfp.montant || 0) + (d.cases.foprolos.montant || 0));
        if (irpp || taxes) {
          ecrire({
            date: le, journal: 'BQ', piece: `RSAL-${periode}`, libelle: `Retenues sur salaires ${duMois} (VIR)`,
            lignes: [
              ...(irpp ? [{ compte: '4321', libelle: 'IRPP et contribution sociale retenus', debit: irpp, credit: 0 }] : []),
              ...(taxes ? [{ compte: '4335', libelle: 'TFP et FOPROLOS', debit: taxes, credit: 0 }] : []),
              { compte: '532', libelle: 'Recette des finances', debit: 0, credit: r3(irpp + taxes) }
            ]
          }, `retenues sur salaires ${duMois}`);
        }
        garde(KC.pointerDeclaration(livre, periode, 'deposee', { le }, o.qui, o.quand), `dépôt ${duMois}`);
        garde(KC.pointerDeclaration(livre, periode, 'payee', { le }, o.qui, o.quand), `paiement ${duMois}`);
        out.declarations.push(periode);
      });
    }
  }

  // La CNSS de chaque trimestre ÉCHU, versée le 10 du mois qui le suit (l'échéance proposée est le
  // 15, À VÉRIFIER). Le montant est le « Total à verser » de la déclaration CNSS du trimestre — celui
  // que l'écran de la Paie affiche. Pas le mouvement net du compte : le versement du trimestre
  // précédent, payé dans le premier mois de celui-ci, le réduirait d'autant.
  [1, 2, 3, 4].filter(t => t * 3 < m).forEach(t => {
    const le = `${moisIso(t * 3 + 1)}-10`, nom = `${t === 1 ? '1er' : t + 'e'} trimestre`;
    geste(le, 1, () => {
      const montant = KC.cnssDuTrimestre(livre, annee, t).total;
      if (!(montant > 0)) return;
      ecrire({
        date: le, journal: 'BQ', piece: `CNSS-${annee}-T${t}`, libelle: `Versement CNSS du ${nom} ${annee} (VIR)`,
        lignes: [
          { compte: '4531', libelle: `CNSS du ${nom}`, debit: montant, credit: 0 },
          { compte: '532', libelle: 'Versement CNSS', debit: 0, credit: montant }
        ]
      }, `CNSS du ${nom}`);
      out.cnss.push(t);
    });
  });

  gestes.sort((a, b) => a.date.localeCompare(b.date) || a.rang - b.rang || a.ordre - b.ordre).forEach(g => g.run());
  out.paie = { passees, attend: m };
  return out;
}

module.exports = { garnirBanque, garnirRevision, livreHorsSkanfact, ouvrirClientSkanfact, libelleDeBanque, compteBancaire };
