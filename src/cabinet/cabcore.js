// SkanFact Cabinet — la logique du comptable, sans Electron et sans DOM.
//
// Ce que le cabinet fait, et ce qu'il ne fait PAS. Il LIT les paquets que ses clients lui envoient :
// il ne modifie jamais leurs données, il n'en renvoie aucune. Un cabinet qui corrigerait la
// comptabilité de son client dans son dos créerait deux vérités — c'est exactement le problème que la
// 3.2.0 a passé du temps à éliminer côté entreprise.
//
// L'écran qui compte n'est pas un tableau de bord : c'est « lequel de mes soixante clients ne m'a pas
// envoyé mars ». Tout ce fichier existe pour répondre à cette question.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CabCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMAT = 1;
  const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const pad2 = n => String(n).padStart(2, '0');
  // « 1 dossier(s) » : un logiciel qui parle mal paraît bâclé, et c'est le premier contact d'un
  // comptable avec SkanFact.
  const pl = (n, un, plur) => `${Math.abs(n) >= 1000 ? Number(n).toLocaleString('fr-FR') : n} ${Math.abs(n) > 1 ? (plur || un + 's') : un}`;
  // Un compte de milliers se lit groupé : « 3 526 », jamais « 3526 » (10.14.0, saturation).
  const nbFr = n => (Math.abs(Number(n)) >= 1000 ? Number(n).toLocaleString('fr-FR') : String(n));
  function round3(n) { const x = Number(n) || 0, r = Math.round(Math.abs(x) * 1000 * (1 + 4 * Number.EPSILON)) / 1000; return x < 0 && r ? -r : r; }
  // Un nom se trie comme on le lit : « Café 3 » avant « Café 13 », accents et casse ignorés.
  // Un seul comparateur, créé une fois : localeCompare(…, 'fr') le recrée à chaque comparaison.
  const TRI_NOM = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
  const parNom = (a, b) => TRI_NOM.compare(String(a || ''), String(b || ''));
  function monthLabel(m) {
    const [y, mm] = String(m || '').split('-').map(Number);
    return (MONTHS_FR[mm - 1] || '?') + ' ' + (y || '?');
  }
  // Un MOIS tapé comme un comptable l'écrit (10.14.1) : « 01/2026 », « 1/2026 », « 01-2026 » — et
  // l'ancienne forme « 2026-01 », pour ce qui a été tapé avant. Le champ « Début de mission »
  // réclamait l'écriture machine (« s'écrit comme 2026-01 ») et effaçait EN SILENCE toute autre
  // forme à la création d'un dossier. Rend { ok: true, mois: 'AAAA-MM' | '' } ou { ok: false, motif }.
  function moisTape(texte) {
    const t = String(texte == null ? '' : texte).trim();
    if (!t) return { ok: true, mois: '' };
    let m = /^(\d{4})-(\d{1,2})$/.exec(t), an, mo;
    if (m) { an = +m[1]; mo = +m[2]; } else {
      m = /^(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(t);
      if (!m) return { ok: false, motif: `« ${t} » n'est pas un mois : écris-le comme 01/2026.` };
      mo = +m[1]; an = +m[2];
    }
    if (mo < 1 || mo > 12 || an < 1990 || an > 2999) return { ok: false, motif: `« ${t} » n'est pas un mois : écris-le comme 01/2026.` };
    return { ok: true, mois: `${an}-${String(mo).padStart(2, '0')}` };
  }
  // Le mois rangé (« 2026-01 ») s'affiche comme il se tape : « 01/2026 ».
  const moisAffiche = m => /^\d{4}-\d{2}$/.test(String(m || '')) ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : '';
  // Arithmétique de mois en UTC pur : même règle que côté entreprise (voir CLAUDE.md, 5.2.3).
  function addMonth(m, n) {
    const [y, mm] = String(m).split('-').map(Number);
    const t = y * 12 + (mm - 1) + n;
    return `${Math.floor(t / 12)}-${pad2((t % 12) + 1)}`;
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  // 10.12.0 (U-12) — le mois sur lequel un écran de travail s'ouvre, et la MÊME règle partout : le
  // DERNIER mois qui a des données, sinon le mois courant. La Paie s'ouvrait sur décembre et sur le
  // quatrième trimestre en septembre — deux périodes futures, donc deux écrans vides qui avaient
  // l'air d'un dossier vide —, pendant que la Déclaration s'ouvrait sur janvier faute d'écriture.
  // Un exercice PASSÉ sans données s'ouvre sur son dernier mois, un exercice futur sur son premier :
  // jamais un mois qui n'existe pas encore.
  function moisDeTravail(moisAvecDonnees, annee, aujourdhui) {
    const faits = (moisAvecDonnees || []).map(Number).filter(m => m >= 1 && m <= 12);
    if (faits.length) return Math.max(...faits);
    const a = Number(annee), y = Number(String(aujourdhui || '').slice(0, 4)), m = Number(String(aujourdhui || '').slice(5, 7));
    if (y === a && m >= 1 && m <= 12) return m;
    return y > a ? 12 : 1;
  }
  function monthsBetween(from, to) {
    const out = [];
    let m = from;
    while (m <= to && out.length < 240) { out.push(m); m = addMonth(m, 1); }
    return out;
  }

  // Les régimes de TVA qu'on rencontre en Tunisie. Ils ne changent pas ce qu'on ATTEND (un client
  // tient sa comptabilité tous les mois quoi qu'il arrive) mais ce qu'on DÉCLARE pour lui.
  // À VÉRIFIER avec le comptable : les périodicités et les échéances dépendent du régime réel.
  const TVA_PERIODS = [
    { id: 'mensuelle', label: 'TVA mensuelle' },
    { id: 'trimestrielle', label: 'TVA trimestrielle' },
    { id: 'non-assujetti', label: 'Non assujetti à la TVA' }
  ];
  const REGIMES = [
    { id: 'reel', label: 'Régime réel' },
    { id: 'forfaitaire', label: 'Régime forfaitaire' },
    { id: 'autre', label: 'Autre / à préciser' }
  ];
  const RELANCE_WAYS = [
    { id: 'email', label: 'Email' },
    { id: 'tel', label: 'Téléphone' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'autre', label: 'Autre' }
  ];

  // Cinq ans : au-delà, ce n'est plus un retard, c'est une reprise d'archives — et réclamer soixante
  // mois par mail ne fait bouger personne.
  const MAX_MOIS_ATTENDUS = 60;
  // Les réglages de la SAISIE (9.3.0). Ils sont tous réglables, et c'est voulu : les touches d'une
  // grille de saisie ne s'inventent pas, elles se reprennent de celles que le comptable a déjà dans
  // les doigts. Tant que personne n'a regardé le pilote travailler, ce qui est ici n'est qu'une
  // proposition — et une proposition qu'on change dans un écran, pas dans une version.
  const DEFAULT_SAISIE = {
    journalParDefaut: '',        // vide = le dernier journal utilisé sur ce dossier
    dateComplete: true,          // false = on ne tape que le jour, dans le mois en cours
    validerParLot: true,         // proposer « valider tout le journal du mois » en plus du geste pièce par pièce
    touches: {
      ligneSuivante: 'Enter',
      solder: 'Tab',             // sur la dernière ligne : le reste se pose tout seul
      recopier: 'F2',            // recopier la ligne du dessus
      dupliquer: 'F4',           // dupliquer la pièce entière
      valider: 'Control+Enter'
    }
  };
  // `theme` (9.4.3) : « light », « dark » ou « auto » (le réglage du système). L'app entreprise a le
  // sien depuis la 1.6.0 ; le Cabinet n'en avait AUCUN — pas une ligne — donc une fenêtre blanche
  // éblouissante à côté de tout le reste sur un poste réglé en sombre. Défaut `auto` : on suit le
  // système plutôt que d'imposer un choix que personne n'a fait.
  // `depots` (9.4.6) : les échéances qu'on a POINTÉES, une par une. SkanFact ne dépose rien et ne se
  // connecte à aucune administration — c'est un pense-bête, pas un accusé de réception (règle
  // 5.2.0). On pointe une OCCURRENCE (`tva-m@2026-05-15`), jamais une règle : faire taire « TVA »
  // ferait taire tous les mois suivants, et c'est le défaut que la 7.21.0 a corrigé côté entreprise.
  const DEFAULT_SETTINGS = { relanceDay: 10, deadlines: null, saisie: null, theme: 'auto', depots: [] };
  const DEFAULT_STATE = {
    format: FORMAT,
    cabinet: { name: '', email: '', phone: '', publicKey: '', privateKey: '' },
    dossiers: [],
    licence: null,
    // Ce que l'exemple chargé sait de lui-même : la version qui l'a fabriqué et le mois sur lequel
    // il a été recalé. Les deux servent à le REFAIRE tout seul (9.4.2) — `null` tant qu'aucun
    // exemple n'est chargé.
    exemple: null,
    // Les guides d'écritures vivent au niveau du CABINET : un comptable écrit « achat avec TVA »
    // une fois, pas soixante fois. Un dossier peut en ajouter (`dossiers[].guides`), jamais en
    // retirer — surcharger n'est pas censurer.
    guides: [],
    // La correspondance des comptes, côté cabinet. Un dossier porte ses exceptions.
    correspondance: [],
    // Les collaborateurs (9.9.0). Vide = cabinet d'une personne : tout est permis, et rien ne
    // change à l'écran tant que personne n'est déclaré.
    collaborateurs: [],
    // Le questionnaire de fin d'exercice et les cycles de révision (9.10.0). Vides tous les deux :
    // la méthode de révision appartient au comptable, pas à nous. Cycles vides = ceux que le
    // moteur PROPOSE (`CYCLES_REVISION`).
    questionnaire: [], cycles: [],
    // Le modèle de liasse (10.0.0). Vide = celui que le moteur propose. Aucune rubrique n'est une
    // vérité : la présentation exacte du SCE n'est validée par personne, et « À VÉRIFIER » est
    // écrit sur chaque écran qui l'affiche.
    liasse: [],
    settings: { ...DEFAULT_SETTINGS }
  };

  // Une fiche de dossier complète. Tout ce qui est ajouté ici doit être FACULTATIF à la lecture :
  // un cabinet qui ouvre une base d'avant cette version ne doit rien perdre et rien voir casser.
  function migrateDossier(d) {
    d = d || {};
    return {
      id: d.id || '', name: d.name || '', matricule: d.matricule || '',
      email: d.email || '', phone: d.phone || '', contact: d.contact || '',
      note: d.note || '', archived: !!d.archived, demo: !!d.demo,
      // Créé à la main : le client n'utilise pas (encore) SkanFact. On ne lui réclame rien, mais il
      // compte dans le portefeuille — c'est ce qui permet au cabinet de voir ses 60 clients ici.
      manual: !!d.manual,
      // Premier mois attendu de ce client. Vide = le premier mois reçu. C'est ce qui permet de dire
      // « je reprends ce dossier à partir de janvier » et d'être alerté sur les mois d'avant.
      from: /^\d{4}-\d{2}$/.test(String(d.from || '')) ? d.from : '',
      regime: d.regime || '', tvaPeriod: d.tvaPeriod || '', fees: Number(d.fees) || 0,
      createdAt: d.createdAt || null,
      // L'historique des relances. Sans lui, le lundi suivant on ne sait plus qui a été relancé.
      relances: Array.isArray(d.relances) ? d.relances.map(r => ({
        at: r.at || null, months: Array.isArray(r.months) ? r.months : [],
        via: r.via || 'email', note: r.note || ''
      })) : [],
      // La clé publique ÉPINGLÉE de ce client (9.2.0) et la trace de son épinglage. Ces quatre
      // champs DOIVENT figurer ici : un champ absent de cette liste est un champ que `migrate`
      // jette au prochain chargement, en silence — c'est le défaut de `matricule` trouvé en 6.8.0,
      // et ici il désarmerait la vérification d'origine sans que rien ne le dise.
      clePublique: d.clePublique || '',
      cleEmpreinte: d.cleEmpreinte || '',
      cleEpingleeLe: d.cleEpingleeLe || null,
      // 9.3.0 — même règle que les quatre champs ci-dessus : absents d'ici, ils seraient jetés au
      // prochain chargement, en silence. Un abonnement perdu, c'est un loyer qui cesse d'être
      // écrit sans que personne ne le remarque avant le bilan.
      abonnements: Array.isArray(d.abonnements) ? d.abonnements : [],
      // 9.4.0 — ce qui décide si ce dossier se compte dans la licence du cabinet. Même règle que
      // les champs ci-dessus : absents d'ici, ils seraient jetés au prochain chargement, et le
      // comptage se mettrait à facturer des dossiers qui ne le devaient pas.
      clientLicence: (d.clientLicence && typeof d.clientLicence === 'object') ? d.clientLicence : null,
      derniereValidation: d.derniereValidation || '',
      guides: Array.isArray(d.guides) ? d.guides : [],
      correspondance: Array.isArray(d.correspondance) ? d.correspondance : [],
      // Le dernier journal utilisé sur CE dossier : c'est lui qu'on propose à l'ouverture de la
      // grille. Un journal d'un autre client n'apprend rien.
      dernierJournal: d.dernierJournal || '',
      // 9.5.0 — le compte bancaire proposé à l'import d'un relevé, et le « ± n jours » de CE
      // dossier : une petite affaire encaisse le jour même, un gros client a trois jours de
      // décalage. Réglable, donc enregistré — sinon le réglage repartirait à zéro à chaque
      // ouverture, ce qui est la façon la plus sûre de faire croire qu'il ne sert à rien.
      banque: (d.banque && typeof d.banque === 'object') ? d.banque : null,
      // 9.9.0 — les droits SUR CE DOSSIER, collaborateur par collaborateur. Absent d'ici, le
      // droit posé sur un dossier serait jeté au prochain chargement et chacun retomberait sur son
      // rôle général : le seul cas où ça se verrait est celui où ça compte — quelqu'un qui n'avait
      // pas le droit de valider ici l'aurait à nouveau, sans un mot.
      droits: (d.droits && typeof d.droits === 'object' && !Array.isArray(d.droits)) ? d.droits : {},
      audit: Array.isArray(d.audit) ? d.audit : [],
      packs: Array.isArray(d.packs) ? d.packs.map(sansSignatureIntruse) : []
    };
  }
  // 10.13.0 — le verdict d'intégrité est RANGÉ avec le paquet (6.8.1) : ceux reçus entre la 9.2.0 et
  // la 10.13.0 portent `signature.json` parmi leurs « intrus », et le tableau des paquets continuerait
  // d'afficher « ⚠ +1 » sur des paquets honnêtes. La signature a été vérifiée à part, à l'import
  // (`verdictOrigine`) : la retirer du verdict ne blanchit rien d'autre, un vrai intrus reste.
  function sansSignatureIntruse(p) {
    const ig = p && p.integrity;
    if (!ig || !Array.isArray(ig.intrus) || !ig.intrus.some(c => HORS_MANIFESTE.includes(c))) return p;
    const intrus = ig.intrus.filter(c => !HORS_MANIFESTE.includes(c));
    return Object.assign({}, p, { integrity: Object.assign({}, ig, { intrus, ok: !(ig.bad || []).length && !intrus.length }) });
  }

  // ================================================================ L'EXEMPLE PÉRIMÉ (9.4.2)
  //
  // Un jeu d'exemple est RELATIF à aujourd'hui, et il est enrichi de version en version. Personne ne
  // pense à l'effacer puis à le recharger : la décision se prend donc toute seule, et elle vit ici,
  // pure et testable, plutôt que dans le processus principal où rien ne peut la vérifier.
  //
  // Rend le MOTIF ('version' ou 'mois') ou une chaîne vide s'il n'y a rien à refaire. Ce n'est pas
  // elle qui sait s'il existe un exemple : l'appelant le sait, et lui seul.
  //
  // Le corps est identique à `exemplePerime` de src/renderer/core.js — les deux applications doivent
  // décider pareil, et aucune ne peut charger le module de l'autre. Un test compare les deux corps
  // caractère par caractère, comme pour `round3` et `pastille`.
  function exemplePerime(repere, version, mois) {
    if (!version) return '';
    const r = (repere && typeof repere === 'object') ? repere : {};
    if (!r.version || r.version !== version) return 'version';
    if (r.mois !== mois) return 'mois';
    return '';
  }

  // 10.14.0 — un mot de passe à confirmer : le verdict, ET la case qu'il faut montrer. Vu à la souris
  // sur le premier écran de cette application : Tab pose le curseur sur « Afficher », la
  // confirmation part dans le vide, et le refus disait « les deux mots de passe ne sont pas les
  // mêmes » sans montrer aucune case. Une confirmation vide se NOMME, une confirmation fausse aussi.
  //
  // Le corps est identique à `verdictMotDePasse` de src/renderer/core.js : les deux applications
  // refusent avec les mêmes mots, et un test compare les deux corps (comme `exemplePerime`).
  function verdictMotDePasse(motDePasse, confirmation, min) {
    const a = String(motDePasse || ''), b = String(confirmation || '');
    if (a.length < min) return { ok: false, champ: 'motDePasse', message: `Mot de passe : ${min} caractères au minimum.` };
    if (!b) return { ok: false, champ: 'confirmation', message: 'Retape le mot de passe dans la case de confirmation.' };
    if (a !== b) return { ok: false, champ: 'confirmation', message: 'La confirmation ne correspond pas au mot de passe : retape-la.' };
    return { ok: true, champ: '', message: '' };
  }

  // ================================================================ LES COLLABORATEURS (9.9.0)
  //
  // Un cabinet de plus d'une personne. Trois rôles, et ils se contiennent l'un l'autre :
  // `supervision` ⊃ `validation` ⊃ `saisie`.
  //
  // **Ce qui est décidé, et pourquoi** : une identité DÉCLARÉE, pas un mot de passe par
  // collaborateur. Le mot de passe du cabinet ouvre déjà toute la base — celle de soixante
  // entreprises — donc un second mot de passe par personne ne protégerait rien de plus : qui
  // connaît le premier lit tout. Ce que l'identité apporte, ce n'est pas le secret, c'est
  // l'ATTRIBUTION (qui a validé cette écriture) et les DROITS (qui a le droit de la valider).
  // Prétendre le contraire serait exactement le genre d'affirmation que cette application
  // s'interdit depuis « 7 pièces vérifiées, intactes » (Cabinet 1.0.0), et l'écran le dit.
  // **À VÉRIFIER avec le cabinet pilote** : un mot de passe par collaborateur devient utile le jour
  // où un cabinet le demande — c'est alors une décision, pas un effet de bord.
  //
  // **La valeur par défaut est celle qui ne fait rien** (9.1.1) : tant qu'AUCUN collaborateur n'est
  // déclaré, tout est permis et rien ne change à l'écran. Un cabinet d'une personne — c'est-à-dire
  // tous ceux d'aujourd'hui — ne doit pas se retrouver enfermé dehors par une mise à jour.
  const ROLES_COLLAB = ['saisie', 'validation', 'supervision'];
  const RANG_ROLE = { saisie: 1, validation: 2, supervision: 3 };
  const LIBELLE_ROLE = {
    saisie: 'Saisie', validation: 'Saisie et validation', supervision: 'Supervision'
  };
  const DETAIL_ROLE = {
    saisie: 'Écrit au brouillard, importe, rapproche. Ne valide pas.',
    validation: 'Tout ce que fait la saisie, plus la validation, le lettrage et les déclarations.',
    supervision: 'Tout, plus la clôture d\'un exercice et la gestion des collaborateurs.'
  };

  function migrateCollaborateur(c) {
    c = c || {};
    return {
      id: String(c.id || ''),
      nom: String(c.nom || '').trim(),
      role: ROLES_COLLAB.includes(c.role) ? c.role : 'saisie',
      actif: c.actif !== false,
      creeLe: c.creeLe || null,
      // Le poste sur lequel cette personne travaille d'habitude. Indicatif : il sert à proposer la
      // bonne identité à l'ouverture, jamais à interdire quoi que ce soit — quelqu'un qui dépanne
      // sur le poste d'un autre reste lui-même.
      poste: String(c.poste || '')
    };
  }

  const collaborateurs = state => (state && Array.isArray(state.collaborateurs) ? state.collaborateurs : []).filter(c => c.actif);
  const collaborateurDe = (state, id) => collaborateurs(state).find(c => c.id === String(id || '')) || null;

  // Le rôle de quelqu'un SUR UN DOSSIER. Un droit posé sur le dossier l'emporte sur le rôle général
  // — c'est le sens de « droits par dossier » : quelqu'un qui valide partout peut n'être que
  // saisisseur sur le dossier d'un proche, et l'inverse est vrai aussi.
  //
  // Rend `'libre'` quand aucun collaborateur n'est déclaré : il n'y a alors personne à qui refuser
  // quoi que ce soit.
  function roleSurDossier(state, dossierId, collabId) {
    if (!collaborateurs(state).length) return 'libre';
    const c = collaborateurDe(state, collabId);
    if (!c) return '';
    const d = (state.dossiers || []).find(x => x.id === dossierId);
    const pose = d && d.droits && ROLES_COLLAB.includes(d.droits[c.id]) ? d.droits[c.id] : '';
    return pose || c.role;
  }

  // La porte unique des droits. Elle rend un objet, jamais un booléen nu : un refus dit TROIS
  // choses — ce qui est refusé, pourquoi, et qui peut le faire (7.0.0).
  function peut(state, dossierId, collabId, geste) {
    const exige = RANG_ROLE[geste] || RANG_ROLE.saisie;
    const role = roleSurDossier(state, dossierId, collabId);
    if (role === 'libre') return { ok: true, role: 'libre' };
    if (!role) {
      return { ok: false, role: '', motif: 'Ce poste ne dit pas qui travaille dessus.',
        geste: 'Choisis ton nom dans les Réglages, panneau « Collaborateurs ».' };
    }
    if ((RANG_ROLE[role] || 0) >= exige) return { ok: true, role };
    const c = collaborateurDe(state, collabId);
    const qui = collaborateurs(state).filter(x => (RANG_ROLE[roleSurDossier(state, dossierId, x.id)] || 0) >= exige);
    return {
      ok: false, role, exige: geste,
      motif: `${c ? c.nom : 'Ce collaborateur'} a le rôle « ${LIBELLE_ROLE[role]} » sur ce dossier : ce geste demande « ${LIBELLE_ROLE[geste] || geste} ».`,
      geste: qui.length
        ? `${qui.map(x => x.nom).join(', ')} ${qui.length > 1 ? 'peuvent' : 'peut'} le faire.`
        // 10.14.0 — sans superviseur, personne ne peut « donner » ce rôle : la gestion de l'équipe
        // est alors ouverte à tous (`peutGererCollaborateurs`), et c'est là qu'il se change. Le refus
        // envoyait chercher un superviseur qui n'existe pas — un refus qui promet une sortie qui
        // n'existe pas (10.12.0). Vu au test humain : un cabinet qui s'était déclaré « Saisie ».
        : !collaborateurs(state).some(x => x.role === 'supervision')
          ? `Aucun superviseur n'est déclaré : ce rôle se change dans ${CHEMIN_EQUIPE}.`
          : 'Personne n\'a encore ce rôle sur ce dossier : un superviseur peut le donner dans la fiche du dossier.'
    };
  }

  // Où l'équipe se règle — une phrase qui dit où cliquer est une promesse (10.9.2) : un test la
  // confronte aux onglets et aux panneaux réels des Réglages.
  const CHEMIN_EQUIPE = 'Réglages → Mon cabinet → L\'équipe';

  // Le rôle proposé à un collaborateur NEUF (10.14.0). Le premier déclaré devient l'identité de ce
  // poste (9.9.0) — c'est presque toujours le comptable qui ouvre l'application. « Saisie », la
  // première option de la liste, lui retirait la validation de ses propres écritures au moment
  // précis où « Tes premiers pas » l'envoyaient déclarer son équipe. Le premier est proposé
  // « Supervision » (tout, gestion de l'équipe comprise) ; les suivants « Saisie », le rôle le plus
  // étroit — on élargit un droit en le décidant, jamais par défaut.
  const roleProposeCollab = state => collaborateurs(state).length ? 'saisie' : 'supervision';

  // Qui a le droit de créer ou de retirer un collaborateur. Tant qu'AUCUN superviseur n'existe, la
  // porte est ouverte — sinon le premier cabinet qui déclare deux saisisseurs et ferme l'écran ne
  // pourrait plus jamais y revenir. Dès qu'un superviseur existe, lui seul.
  function peutGererCollaborateurs(state, collabId) {
    const sup = collaborateurs(state).filter(c => c.role === 'supervision');
    if (!sup.length) return { ok: true, amorce: true };
    const c = collaborateurDe(state, collabId);
    if (c && c.role === 'supervision') return { ok: true };
    return {
      ok: false,
      motif: 'Seul un superviseur ajoute ou retire un collaborateur.',
      geste: `${sup.map(x => x.nom).join(', ')} ${sup.length > 1 ? 'peuvent' : 'peut'} le faire.`
    };
  }

  function collaborateurValide(state, c, idExistant) {
    const nom = String((c && c.nom) || '').trim();
    if (nom.length < 2) return { ok: false, motif: 'Un collaborateur a besoin d\'un nom d\'au moins deux caractères.' };
    if (!ROLES_COLLAB.includes(c && c.role)) return { ok: false, motif: 'Choisis un rôle.' };
    const pris = (state.collaborateurs || []).some(x => x.id !== idExistant && x.actif !== false
      && x.nom.toLowerCase() === nom.toLowerCase());
    if (pris) return { ok: false, motif: `« ${nom} » existe déjà : deux personnes du même nom ne se distingueraient pas dans la piste d'audit.` };
    return { ok: true, nom };
  }

  // Les dossiers CONFIÉS à quelqu'un : ceux où un droit est posé explicitement pour lui. C'est une
  // question différente de « a-t-il le droit d'y toucher ? » — tout le monde a un rôle général, donc
  // tout le monde peut travailler partout tant qu'on ne restreint rien. Ce qui fait un « À faire »
  // personnel, c'est l'ATTRIBUTION : ce dossier est à moi. Personne n'a rien de confié → la liste
  // est vide, et l'écran le DIT avec le geste (ouvrir la fiche, poser un droit), plutôt que de
  // montrer tout le cabinet sous le nom d'une personne.
  function dossiersConfies(state, collabId) {
    const id = String(collabId || '');
    return (state.dossiers || []).filter(d => d.droits && ROLES_COLLAB.includes(d.droits[id]));
  }

  // ================================================================ LA PRODUCTION (9.9.0)
  //
  // Par dossier et par mois : reçu → saisi → révisé → déclaré, qui et depuis quand. Tout est LU —
  // les paquets pour « reçu », l'index des livres pour le reste — jamais tenu à la main : une liste
  // d'états qu'on coche est fausse le jour où quelqu'un oublie de cocher.
  //
  // « Révisé » n'a pas encore d'écrivain : c'est la 9.10.0 qui le remplira. En attendant il vaut
  // `null`, et l'écran écrit « — », jamais « non » — on ne dit pas d'un dossier qu'il n'est pas
  // révisé quand on n'a simplement aucun moyen de le savoir (règle des cases fiscales, 9.6.0).
  const ETAPES_PRODUCTION = [
    { id: 'recu', label: 'Reçu', detail: 'Le paquet du mois est arrivé.' },
    { id: 'saisi', label: 'Saisi', detail: 'Des écritures existent sur ce mois dans le livre.' },
    { id: 'revise', label: 'Révisé', detail: 'Le dossier de révision de la 9.10.0 le remplira.' },
    { id: 'declare', label: 'Déclaré', detail: 'La déclaration du mois est marquée déposée.' }
  ];

  // `index` est l'index des livres de CE dossier (`livre-index.json`), pas le livre lui-même : le
  // tableau de production d'un portefeuille de soixante dossiers ne peut pas ouvrir et déchiffrer
  // cent quatre-vingts livres pour dessiner une grille (c'est la mesure de la 9.1.0 qui l'interdit).
  function productionDuDossier(dossier, index, todayIso, graceDay) {
    const parMois = {};
    const exercices = (index && index.exercices) || [];
    exercices.forEach(ex => {
      const p = (ex && ex.production) || {};
      Object.keys(p).forEach(m => { parMois[m] = p[m]; });
    });
    // Un dossier TENU AU CABINET (10.12.0, vu au test humain) n'envoie aucun paquet : ses mois sont
    // ceux de ses LIVRES, du premier mois de l'exercice à celui qui vient de finir. Sans eux, le
    // garage de l'exemple — sept déclarations déposées et payées — paraissait « hors mission » sur
    // toute sa ligne, pendant que sa Déclaration disait juillet « payé » : deux écrans qui se
    // contredisent (6.8.1). Et sa chaîne commence à la SAISIE : « pas encore reçu » ne se dit pas
    // d'un client à qui l'on ne réclame jamais de paquet (`recu` vaut null — ne pas savoir n'est
    // pas « non », 9.6.0). Un dossier SUR SkanFact, lui, ne prend pas ses mois dans son livre : on
    // ne lui attribue pas un retard sur des mois qu'on ne lui a jamais réclamés.
    const tenu = !!(dossier && dossier.manual);
    const liste = dossierMonths(dossier, todayIso, graceDay).map(m => ({ month: m.month, label: m.label, pack: m.pack, state: m.state }));
    if (tenu) {
      const dernier = addMonth(String(todayIso || today()).slice(0, 7), -1);   // le mois en cours n'est jamais dû
      const vus = new Set(liste.map(m => m.month));
      exercices.forEach(ex => {
        const du = String((ex && ex.du) || '').slice(0, 7);
        const au = String((ex && ex.au) || '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(du) || !/^\d{4}-\d{2}$/.test(au)) return;
        monthsBetween(du, au < dernier ? au : dernier).forEach(m => {
          if (!vus.has(m)) { vus.add(m); liste.push({ month: m, label: monthLabel(m), pack: null, state: 'tenu' }); }
        });
      });
      liste.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
    }
    return liste.map(m => {
      const p = parMois[m.month] || {};
      const recu = tenu ? null : !!m.pack;
      const saisi = Number(p.ecritures) || 0;
      return {
        mois: m.month, label: m.label, recu, etat: tenu ? 'tenu' : m.state, pack: m.pack || null,
        saisi, validees: Number(p.validees) || 0, brouillards: Number(p.brouillards) || 0,
        // `null` et non `false` : sans livre sur cet exercice, on ne SAIT pas — et ne pas savoir
        // n'est pas « non ». L'écran écrit « — » (règle des cases fiscales, 9.6.0).
        revise: p.revise === undefined ? null : !!p.revise,
        declare: p.declare === undefined ? null : !!p.declare,
        qui: p.qui || '', depuis: p.depuis || null,
        // L'étape où ce mois EST BLOQUÉ, c'est-à-dire la première qui n'est pas franchie.
        //
        // « Révisé » ne BLOQUE rien, et c'est une décision : il n'a pas encore d'écrivain — la
        // 9.10.0 le remplira — donc le faire barrer la route mettrait TOUS les mois de TOUS les
        // dossiers à « bloqué à la révision » le jour de la livraison, et une grille entièrement
        // rouge n'apprend rien à personne. Un mois déclaré est au bout de la chaîne, révisé ou
        // non ; la révision ne distingue que les deux états intermédiaires. C'est la règle « la
        // valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien » (9.1.1),
        // appliquée à une étape dont personne ne tient encore le stylo.
        etape: recu === false ? 'recu' : !saisi ? 'saisi' : p.declare ? 'fini' : p.revise ? 'declare' : 'revise'
      };
    });
  }

  // Le tableau entier : une ligne par dossier, ses mois, et combien sont bloqués où.
  function production(state, index, opts) {
    const o = opts || {};
    const jour = (state.settings || {}).relanceDay;
    return (state.dossiers || [])
      .filter(d => !d.archived && (o.avecExemple !== false || !d.demo))
      .map(d => {
        const mois = productionDuDossier(d, (index && index[d.id]) || null, o.today, jour);
        return {
          id: d.id, name: d.name, matricule: d.matricule || '', demo: !!d.demo, manual: !!d.manual,
          mois, recus: mois.filter(m => m.recu).length, saisis: mois.filter(m => m.saisi).length,
          declares: mois.filter(m => m.declare).length,
          aSaisir: mois.filter(m => m.etape === 'saisi').length,
          dernier: mois.filter(m => m.recu).slice(-1)[0] || null
        };
      })
      .sort((a, b) => (b.aSaisir - a.aSaisir) || parNom(a.name, b.name));
  }

  function migrate(state) {
    const s = { ...DEFAULT_STATE, ...(state && typeof state === 'object' ? state : {}) };
    s.cabinet = { ...DEFAULT_STATE.cabinet, ...(s.cabinet || {}) };
    s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    const day = Number(s.settings.relanceDay);
    s.settings.relanceDay = day >= 1 && day <= 28 ? Math.round(day) : 10;
    // Les jours d'échéance : aucun n'est une vérité, tous sont réglables, et un réglage aberrant
    // retombe sur l'usage plutôt que de faire disparaître l'échéance du calendrier.
    const dl = { ...DEFAULT_DEADLINES, ...(s.settings.deadlines || {}) };
    ['tvaDay', 'cnssDay'].forEach(k => {
      const v = Number(dl[k]);
      dl[k] = v >= 1 && v <= 31 ? Math.round(v) : DEFAULT_DEADLINES[k];
    });
    s.settings.deadlines = dl;
    // Les réglages de saisie (9.3.0). `touches` se fusionne touche par touche : quelqu'un qui n'en
    // a redéfini qu'une ne doit pas perdre les autres, et une version qui en ajoute une nouvelle
    // doit la donner à ceux qui ont déjà réglé les leurs.
    const sa = { ...DEFAULT_SAISIE, ...(s.settings.saisie || {}) };
    sa.touches = { ...DEFAULT_SAISIE.touches, ...((s.settings.saisie || {}).touches || {}) };
    sa.journalParDefaut = String(sa.journalParDefaut || '').toUpperCase().slice(0, 5);
    sa.dateComplete = sa.dateComplete !== false;
    sa.validerParLot = sa.validerParLot !== false;
    s.settings.saisie = sa;
    // Un thème inconnu retombe sur « auto » : une valeur inventée ne doit pas laisser l'application
    // dans un état qu'aucun écran ne propose.
    if (!['light', 'dark', 'auto'].includes(s.settings.theme)) s.settings.theme = 'auto';
    // Absent de cette liste, le pointage serait jeté au prochain démarrage et chaque échéance
    // déposée se remettrait à crier — en silence (défaut `matricule`, 6.8.0).
    // Les régimes déclarés par le cabinet (F-9.6.0-12). Absents d'ici, ils seraient jetés au
    // prochain chargement et le calendrier redeviendrait le même pour tous — sans un mot.
    s.settings.regimes = (Array.isArray(s.settings.regimes) ? s.settings.regimes : [])
      .map(migrateRegime).filter(r => r.id && r.label);
    s.settings.depots = (Array.isArray(s.settings.depots) ? s.settings.depots : [])
      // Le mois et le jour sont bornés, pas seulement comptés : « tva-m@2026-13-99 » ne pourra
      // jamais désigner une échéance réelle, donc il n'a rien à faire dans les données — il y
      // traînerait pour toujours à faire taire on ne sait quoi.
      .map(x => String(x || ''))
      .filter(x => /^[a-z-]+@\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(x));
    s.guides = Array.isArray(s.guides) ? s.guides : [];
    // La licence du cabinet (9.4.0). Elle vit dans l'état CHIFFRÉ, donc elle voyage avec la clé de
    // secours : un cabinet qui change d'ordinateur retrouve sa licence en même temps que ses
    // paquets. Et elle est attachée à son EMPREINTE, qui ne change pas non plus.
    s.licence = (s.licence && typeof s.licence === 'object') ? s.licence : null;
    // Le repère de l'exemple (9.4.2). Absent de cette liste, il serait jeté au prochain chargement
    // — et l'exemple se referait à CHAQUE ouverture, silencieusement (défaut `matricule`, 6.8.0).
    s.exemple = (s.exemple && typeof s.exemple === 'object') ? s.exemple : null;
    s.correspondance = Array.isArray(s.correspondance) ? s.correspondance : [];
    // 9.9.0 — les collaborateurs. Même règle que tout ce qui précède : absents d'ici, ils seraient
    // jetés au prochain chargement, et un cabinet de trois personnes redeviendrait anonyme sans un
    // mot — la piste d'audit cesserait de dire QUI, ce qui est le seul point de cette version.
    s.collaborateurs = (Array.isArray(s.collaborateurs) ? s.collaborateurs : [])
      .map(migrateCollaborateur).filter(c => c.id && c.nom);
    // 9.10.0 — le questionnaire de fin d'exercice et les cycles de révision, au niveau du CABINET
    // comme les guides : on les écrit une fois pour soixante clients. Les deux partent VIDES — les
    // cinq questions les plus fréquentes du pilote ne sont pas connues, et les inventer serait
    // écrire sa méthode à sa place. Absents d'ici, ils seraient jetés au prochain chargement.
    // 10.0.0 — le modèle de liasse, au niveau du cabinet lui aussi : on l'ajuste une fois pour
    // soixante clients. Vide = celui que le moteur PROPOSE. Absent d'ici, il serait jeté au
    // prochain chargement et le cabinet devrait le refaire chaque matin (défaut `matricule`, 6.8.0).
    s.liasse = (Array.isArray(s.liasse) ? s.liasse : []).map(r => ({
      id: String((r && r.id) || '').trim(), etat: String((r && r.etat) || '').trim(),
      label: String((r && r.label) || '').trim(),
      comptes: (Array.isArray(r && r.comptes) ? r.comptes : []).map(c => String(c).trim()).filter(Boolean),
      signe: Number(r && r.signe) === -1 ? -1 : 1,
      deduit: !!(r && r.deduit), charge: !!(r && r.charge), resultat: !!(r && r.resultat),
      // 10.10.0 (C-08) : une rubrique qui prend les DEUX sens de solde (un résultat reporté peut
      // être une perte). Absent d'ici, le drapeau serait jeté au chargement et la perte ressortirait.
      deuxSens: !!(r && r.deuxSens)
    })).filter(r => r.id && r.label && r.etat);
    s.questionnaire = (Array.isArray(s.questionnaire) ? s.questionnaire : [])
      .map(q => ({ question: String((q && q.question != null ? q.question : q) || '').trim() }))
      .filter(q => q.question);
    s.cycles = (Array.isArray(s.cycles) ? s.cycles : []).map(c => ({
      id: String((c && c.id) || '').trim(), label: String((c && c.label) || '').trim(),
      prefixes: (Array.isArray(c && c.prefixes) ? c.prefixes : []).map(p => String(p).trim()).filter(Boolean)
    })).filter(c => c.id && c.label);
    // 9.5.0 — les deux tables de la banque, au niveau du CABINET : un comptable associe les
    // colonnes d'une banque une fois pour ses soixante clients, et reconnaît « STEG » une fois.
    // Absentes d'ici, elles seraient jetées au prochain chargement et il faudrait tout réassocier
    // à chaque import, sans un mot (défaut `matricule`, 6.8.0).
    s.banques = (s.banques && typeof s.banques === 'object' && !Array.isArray(s.banques)) ? s.banques : {};
    s.libelles = Array.isArray(s.libelles) ? s.libelles : [];
    s.dossiers = Array.isArray(s.dossiers) ? s.dossiers.map(migrateDossier) : [];
    s.format = FORMAT;
    return s;
  }

  // ================================================================ CE QUI SE COMPTE (9.4.0)
  //
  // On vend des DOSSIERS, jamais des postes. Ce qui se compte, ce sont les dossiers **hors
  // SkanFact** : ceux dont le client n'a pas l'application. Un cabinet dont les soixante clients
  // sont sur SkanFact ne paie jamais rien — c'est le cœur du modèle, et c'est ce qui donne au
  // comptable une raison d'y amener ses clients.
  //
  // Cette fonction est PURE et dit POURQUOI chaque dossier compte ou ne compte pas. Un écran qui
  // annoncerait « 7 dossiers comptés » sans pouvoir les nommer serait exactement le genre de
  // chiffre qu'on ne croit pas — et ici c'est un chiffre qui décide d'une facture.
  const GRACE_MOIS = 12;
  const DORMANT_MOIS = 12;

  function dossierFacturable(d, aujourdhui) {
    const t = aujourdhui || today();
    const ilYA = n => {
      const j = new Date(String(t) + 'T00:00:00Z');
      return isoJour(new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth() - n, j.getUTCDate())));
    };
    if (!d) return { compte: false, raison: 'dossier introuvable' };
    if (d.archived) return { compte: false, raison: 'archivé' };
    if (d.demo) return { compte: false, raison: 'jeu d\'exemple' };

    // Un dossier qu'on ne travaille plus ne se facture pas. « Sans écriture validée depuis douze
    // mois » : c'est le client parti dont on garde les archives, et le faire payer serait une
    // facture pour du vide.
    const derniere = String(d.derniereValidation || '');
    if (derniere && derniere < ilYA(DORMANT_MOIS)) {
      return { compte: false, raison: `aucune écriture validée depuis ${DORMANT_MOIS} mois` };
    }

    const recu = Array.isArray(d.packs) && d.packs.length;
    if (!recu) return { compte: true, raison: 'hors SkanFact' };

    // Le client utilise SkanFact. Reste à savoir si sa licence à lui couvre le dossier — et c'est
    // là que **le doute profite au cabinet** : un paquet d'avant la 9.4.0 ne porte pas cette
    // information, et on ne fait pas payer un cabinet pour ce qu'on n'a pas su lire. L'écran le
    // dit, plutôt que de compter en silence dans un sens ou dans l'autre.
    const lic = d.clientLicence || null;
    if (!lic || !lic.etat) return { compte: false, raison: 'sur SkanFact (paquet d\'avant la 9.4.0 : licence non renseignée)' };
    if (lic.etat === 'active' || lic.etat === 'libre' || lic.etat === 'editeur') return { compte: false, raison: 'sur SkanFact' };
    if (lic.etat === 'essai') return { compte: false, raison: 'sur SkanFact (essai en cours)' };
    // Expirée : douze mois de grâce, mais SEULEMENT après une licence payée. Sans ce garde-fou,
    // « avoir essayé » coûterait moins cher au cabinet que « n'avoir jamais essayé », et on
    // fabriquerait la catégorie qu'on veut éviter.
    if (lic.etat === 'expiree' && lic.payee && String(lic.exp || '') >= ilYA(GRACE_MOIS)) {
      return { compte: false, raison: `licence du client expirée le ${String(lic.exp).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')} — ${GRACE_MOIS} mois de grâce` };
    }
    if (lic.etat === 'expiree' && lic.payee) return { compte: true, raison: `licence du client expirée depuis plus de ${GRACE_MOIS} mois` };
    return { compte: true, raison: 'sur SkanFact, mais sans licence payée' };
  }

  const isoJour = d => d.toISOString().slice(0, 10);

  function comptageDossiers(state, aujourdhui) {
    const t = aujourdhui || today();
    const tous = (state && Array.isArray(state.dossiers) ? state.dossiers : [])
      .map(d => ({ id: d.id, name: d.name || '', ...dossierFacturable(d, t) }));
    const comptes = tous.filter(x => x.compte);
    return {
      total: tous.length,
      comptes: comptes.length,
      liste: comptes,
      libres: tous.filter(x => !x.compte),
      // Les raisons, groupées : c'est ce que l'écran affiche pour que le chiffre s'explique tout seul.
      raisons: tous.filter(x => !x.compte).reduce((a, x) => { a[x.raison] = (a[x.raison] || 0) + 1; return a; }, {})
    };
  }

  // Ce que le manifeste d'un paquet dit de la licence du CLIENT (9.4.0). Facultatif à la lecture :
  // un paquet plus ancien n'en a pas, et on ne devine pas — `null`, et le doute profite au cabinet.
  function licenceDuPaquet(manifest) {
    const l = manifest && manifest.licence;
    if (!l || typeof l !== 'object' || !l.etat) return null;
    return { etat: String(l.etat), exp: String(l.exp || ''), payee: !!l.payee, vuLe: String((manifest && manifest.genereLe) || '').slice(0, 10) };
  }

  // Une date TAPÉE, dans la grille de saisie (9.3.0). Le comptable tape « 4 », « 4/3 », « 04/03/26 »,
  // « 2026-03-04 » ou « 040326 » au pavé numérique — et il tape vite. N'accepter qu'une seule forme,
  // c'est lui faire lever les mains du clavier pour aller chercher un calendrier à la souris : très
  // exactement ce que cette grille existe pour éviter.
  //
  // Tout est ramené à un JOUR DU CALENDRIER (AAAA-MM-JJ), jamais à un instant (règle 5.2.3), et une
  // date qui n'existe pas (le 30 février) rend la chaîne vide plutôt qu'un jour voisin inventé.
  function dateTapee(texte, annee, moisDefaut) {
    const t = String(texte || '').trim().replace(/[.\s-]/g, '/').replace(/\/+/g, '/');
    const iso = String(texte || '').trim();
    const an = Number(annee) || Number(String(moisDefaut || '').slice(0, 4)) || 0;
    const moisD = Number(String(moisDefaut || '').slice(5, 7)) || 0;
    const fini = (y, m, d) => {
      if (!y || !(m >= 1 && m <= 12) || !(d >= 1)) return '';
      const dernier = new Date(Date.UTC(y, m, 0)).getUTCDate();
      if (d > dernier) return '';
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };
    let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso))) return fini(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) return fini(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(t))) return fini(2000 + +m[3], +m[2], +m[1]);
    if ((m = /^(\d{1,2})\/(\d{1,2})$/.exec(t))) return fini(an, +m[2], +m[1]);
    if ((m = /^(\d{1,2})$/.exec(t))) return fini(an, moisD, +m[1]);
    if ((m = /^(\d{2})(\d{2})(\d{4})$/.exec(t))) return fini(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{2})(\d{2})(\d{2})$/.exec(t))) return fini(2000 + +m[3], +m[2], +m[1]);
    return '';
  }

  // Les guides utilisables sur un dossier : ceux du cabinet, plus les siens. Un guide du dossier qui
  // porte le même `id` qu'un guide du cabinet le REMPLACE — c'est la surcharge, et elle vaut mieux
  // qu'un doublon dans la liste, où l'on ne saurait pas lequel est le bon.
  function guidesDuDossier(state, dossier) {
    const cab = Array.isArray(state && state.guides) ? state.guides : [];
    const loc = Array.isArray(dossier && dossier.guides) ? dossier.guides : [];
    const par = new Map();
    cab.forEach(g => par.set(g.id, { ...g, portee: 'cabinet' }));
    loc.forEach(g => par.set(g.id, { ...g, portee: 'dossier' }));
    return Array.from(par.values()).sort((a, b) => parNom(a.nom, b.nom));
  }

  // La correspondance qui s'applique à un dossier : celle du cabinet, puis ses exceptions. Une
  // exception du dossier sur le MÊME compte de départ l'emporte — sinon « exception » ne voudrait
  // rien dire. L'ordre compte : la fonction qui l'applique (`compta.compteCorrespondant`) choisit
  // déjà la plus précise, mais deux règles sur le même `de` ne peuvent pas coexister.
  function correspondanceDuDossier(state, dossier) {
    const cab = Array.isArray(state && state.correspondance) ? state.correspondance : [];
    const loc = Array.isArray(dossier && dossier.correspondance) ? dossier.correspondance : [];
    const par = new Map();
    cab.forEach(r => par.set(String(r.de), { ...r, portee: 'cabinet' }));
    loc.forEach(r => par.set(String(r.de), { ...r, portee: 'dossier' }));
    return Array.from(par.values());
  }

  // L'identité d'un dossier vient du MATRICULE FISCAL quand il existe : c'est le seul identifiant
  // stable d'une entreprise. Un nom se corrige, se raccourcit, change de forme juridique — et deux
  // clients peuvent s'appeler « Ben Ali ». Sans matricule, on retombe sur le nom normalisé.
  // Garder TOUTES les lettres, pas seulement l'alphabet latin. « شركة الأمان » et « مخبزة الياسمين »
  // donnaient tous deux la clé vide « NOM: » : dans un portefeuille tunisien, tous les clients dont
  // la raison sociale est en arabe tombaient dans un SEUL dossier, et leurs paquets s'écrasaient les
  // uns les autres. Un cabinet de Sfax qui colle ses soixante clients en aurait perdu la moitié.
  const sansAccents = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\u0153/g, 'oe').replace(/\u00e6/g, 'ae');
  function normNom(s) {
    return String(s || '').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toUpperCase();
  }
  function dossierKey(manifest) {
    const e = (manifest && manifest.entreprise) || {};
    const mf = String(e.matricule || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (mf) return 'MF:' + mf;
    const nom = normNom(e.nom);
    // Jamais de clé vide : elle ferait tomber tous les sans-nom dans le même dossier.
    return nom ? 'NOM:' + nom : '';
  }

  // Ce qu'on retient d'un paquet reçu. On ne garde pas les fichiers ici : ils restent dans le paquet,
  // sur le disque. Ce qu'on garde, c'est de quoi répondre sans l'ouvrir.
  function packSummary(manifest, extra) {
    extra = extra || {};
    const per = (manifest && manifest.periode) || {};
    return {
      month: per.mois || '',
      label: per.libelle || monthLabel(per.mois),
      definitive: !!(manifest && manifest.definitif),
      receivedAt: extra.receivedAt || null,
      generatedAt: (manifest && manifest.genereLe) || null,
      files: ((manifest && manifest.fichiers) || []).length,
      missing: ((manifest && manifest.manques) || []).map(m => ({ id: m.id, level: m.niveau, label: m.quoi, count: m.combien })),
      absent: ((manifest && manifest.absents) || []).length,
      digest: extra.digest || '',
      bytes: extra.bytes || 0,
      path: extra.path || '',
      sealed: !!extra.sealed,
      appVersion: (manifest && manifest.versionApp) || '',
      // Les chiffres du mois, quand le paquet les porte (paquets fabriqués à partir de la 6.2.1).
      // Un paquet plus ancien n'en a pas : l'interface doit afficher « — », pas zéro.
      figures: (manifest && manifest.chiffres) || null,
      // Le verdict de la vérification des empreintes — la SEULE affirmation rigoureuse de cette
      // application. Il vivait deux secondes dans une fenêtre puis disparaissait : un paquet dont un
      // fichier ne correspondait pas redevenait un mois vert « définitif » dès la fenêtre fermée.
      integrity: extra.integrity || null,
      // Les réceptions précédentes de CE mois, quand il en a eu (voir filePack).
      precedents: extra.precedents || undefined
    };
  }

  // ---------- les justificatifs du client (10.14.1, S-04) ----------
  //
  // Le paquet emporte les fichiers que le client a joints à ses pièces (la facture d'un fournisseur,
  // le bon de commande d'un client, la quittance d'un loyer), et `justificatifs.json` dit à quelle
  // pièce du fichier des écritures chacun appartient : journal, pièce, date. C'est ce qui permet de
  // poser le 📎 sur la LIGNE d'écriture qu'il prouve, et de l'ouvrir d'un clic — le comptable n'a
  // plus à chercher la facture de l'achat F-99 dans une liste de soixante fichiers.
  //
  // Le fichier vient de l'EXTÉRIEUR (6.8.1) : on n'en garde que ce qu'on sait lire, borné, et un
  // chemin qui remonte (« .. ») ou qui part de la racine ne désigne rien — il ne sert qu'à retrouver
  // une entrée DANS le paquet, jamais un fichier du disque.
  function justificatifsDuPaquet(obj) {
    if (!obj || Number(obj.format) !== 1 || !Array.isArray(obj.justificatifs)) return [];
    const txt = (v, max) => String(v == null ? '' : v).slice(0, max);
    return obj.justificatifs.slice(0, 5000).map(j => {
      if (!j || typeof j !== 'object') return null;
      const chemin = txt(j.chemin, 400);
      if (!chemin || chemin.startsWith('/') || chemin.split('/').includes('..')) return null;
      return {
        chemin, nom: txt(j.nom, 200) || chemin.split('/').pop(),
        journal: txt(j.journal, 20), piece: txt(j.piece, 120),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(j.date || '')) ? String(j.date) : ''
      };
    }).filter(Boolean);
  }
  // Les justificatifs d'une LIGNE : ceux du paquet de SON mois qui désignent SA pièce (même clé que
  // `cleDePiece` : journal, pièce, date). Une ligne saisie au cabinet qui porte la même pièce les
  // montre aussi — c'est la même pièce. Rend aussi le paquet, pour savoir où ouvrir.
  function justificatifsDeLigne(paquets, l) {
    if (!l || !l.piece || !l.mois) return [];
    const p = (paquets || []).find(z => z && z.month === l.mois && z.path);
    if (!p || !Array.isArray(p.justificatifs)) return [];
    return p.justificatifs.filter(j => j.piece === l.piece && j.journal === l.journal && (!j.date || j.date === l.date))
      .map(j => ({ ...j, path: p.path, month: p.month }));
  }

  // Vérifier ce qu'annonce le manifeste contre ce qu'on a réellement reçu. `hashes` est un objet
  // { chemin: empreinte } calculé par le processus principal (le calcul, lui, a besoin de Node).
  // C'est la seule affirmation rigoureuse de cette application : « ce que j'ai reçu est exactement
  // ce qui a été envoyé ». Elle doit donc compter juste — le manifeste ne se liste pas lui-même,
  // et un fichier absent n'est pas un fichier vérifié.
  //
  // Le compte va dans les DEUX sens. Ne parcourir que le manifeste laissait entrer sans un mot les
  // fichiers qu'il n'annonce pas : un paquet de trente pièces dont douze annoncées affichait
  // « 12 pièces vérifiées, intactes », et les dix-huit autres, comparées à rien, se listaient et
  // s'ouvraient d'un clic. Un intrus n'est pas une pièce vérifiée : il a son propre compteur.
  // Les deux fichiers du paquet que le manifeste ne PEUT pas annoncer : lui-même (il ne porte pas sa
  // propre empreinte), et la signature du client (9.2.0), qui signe les octets du manifeste et vient
  // donc après lui. `signature.json` est vérifiée à part (`verdictOrigine`) : la compter ici comme un
  // « fichier glissé après coup » levait une fausse alerte sur CHAQUE paquet signé — c'est-à-dire sur
  // tous, depuis la 9.2.0 — au cœur de la seule affirmation rigoureuse de cette application
  // (10.13.0, trouvé en envoyant un vrai paquet d'une application à l'autre).
  const HORS_MANIFESTE = ['manifeste.json', 'signature.json'];

  function checkIntegrity(manifest, hashes) {
    const bad = [];
    const intrus = [];
    const annonces = new Set();
    let checked = 0;
    ((manifest && manifest.fichiers) || []).forEach(f => {
      annonces.add(f.chemin);
      if (f.chemin === 'manifeste.json') return;
      const h = hashes && Object.prototype.hasOwnProperty.call(hashes, f.chemin) ? hashes[f.chemin] : null;
      if (h == null) return bad.push(f.chemin + ' (absent)');
      checked++;
      if (h !== f.empreinte) bad.push(f.chemin + ' (modifié)');
    });
    // Le manifeste ne peut pas porter sa propre empreinte : il est attendu, jamais intrus.
    Object.keys(hashes || {}).forEach(chemin => {
      if (HORS_MANIFESTE.includes(chemin) || annonces.has(chemin)) return;
      intrus.push(chemin);
    });
    intrus.sort();
    return { checked, bad, intrus, ok: bad.length === 0 && intrus.length === 0 };
  }

  // Ranger un paquet dans le bon dossier. Renvoie ce qui s'est passé, pour que l'interface puisse le
  // DIRE : un mois reçu deux fois n'est pas une erreur, c'est une information — le client a rouvert
  // sa période, et les chiffres qu'on avait ne sont plus les bons.
  function filePack(state, manifest, extra) {
    const key = dossierKey(manifest);
    const e = (manifest && manifest.entreprise) || {};
    let dossier = state.dossiers.find(d => d.id === key);
    let created = false;
    let adopted = false;
    if (!dossier) {
      dossier = migrateDossier({ id: key, name: e.nom || '(sans nom)', matricule: e.matricule || '' });
      state.dossiers.push(dossier);
      created = true;
    } else if (e.nom && e.nom !== dossier.name) {
      dossier.name = e.nom;                     // l'entreprise a changé de raison sociale : on suit
    }
    // Un dossier créé à la main qui reçoit son premier paquet cesse d'être « hors SkanFact ». C'est
    // le moment que le cabinet attendait : son client s'y est mis. On le dit à l'interface.
    if (dossier.manual) { dossier.manual = false; adopted = true; }
    const sum = packSummary(manifest, extra);
    const avant = dossier.packs.find(p => p.month === sum.month) || null;

    // Un paquet ANTÉRIEUR ne détrône pas un plus récent. En rattrapant une boîte mail en retard, un
    // vieux provisoire remontait : le chiffre d'affaires tombait, le mois repassait « provisoire »,
    // et le cabinet réclamait à son client un mois qu'il avait déjà reçu définitif. C'est la relance
    // qui fait perdre la confiance d'un client.
    const quand = x => Date.parse((x && x.generatedAt) || 0) || (x && x.receivedAt) || 0;
    const plusAncien = !!avant && quand(sum) > 0 && quand(avant) > 0 && quand(sum) < quand(avant);
    if (plusAncien) {
      return {
        dossier, created, adopted, replaced: false, ignored: true,
        wasDefinitive: !!avant.definitive, nowDefinitive: avant.definitive,
        month: sum.month, summary: avant, refuse: sum
      };
    }

    // On garde la trace de ce qu'on remplace. Le comptable a déclaré sur des chiffres : il doit
    // pouvoir dire lesquels, et de combien ils ont bougé — c'est exactement une rectificative.
    if (avant) {
      sum.precedents = (avant.precedents || []).concat([{
        digest: avant.digest, receivedAt: avant.receivedAt, generatedAt: avant.generatedAt,
        definitive: avant.definitive, figures: avant.figures || null, path: avant.path || '', files: avant.files || 0
      }]).slice(-10);
    }
    dossier.packs = dossier.packs.filter(p => p.month !== sum.month).concat([sum])
      .sort((a, b) => a.month < b.month ? 1 : a.month > b.month ? -1 : 0);
    return {
      dossier, created, adopted, replaced: !!avant,
      wasDefinitive: !!(avant && avant.definitive),
      nowDefinitive: sum.definitive,
      // De combien les chiffres ont bougé : ce que « les chiffres ont pu changer » ne disait pas.
      ecart: avant && avant.figures && sum.figures ? {
        ca: round3((Number(sum.figures.ca) || 0) - (Number(avant.figures.ca) || 0)),
        tvaADecaisser: round3((Number(sum.figures.tvaADecaisser) || 0) - (Number(avant.figures.tvaADecaisser) || 0)),
        devise: sum.figures.devise || avant.figures.devise || 'DT'
      } : null,
      month: sum.month, summary: sum
    };
  }

  // Créer un dossier à la main : le cabinet a soixante clients, deux sous SkanFact. Sans ça,
  // l'application ne montre que la portion congrue de son portefeuille et ne sert à rien tant que
  // tout le monde n'a pas migré. L'identifiant suit la MÊME règle que celle des paquets : le jour où
  // ce client enverra son premier paquet, il tombera dans ce dossier-ci au lieu d'en créer un second.
  function newDossier(fields) {
    const f = fields || {};
    const id = dossierKey({ entreprise: { matricule: f.matricule || '', nom: f.name || '' } });
    return migrateDossier({ ...f, id, manual: true, packs: [] });
  }

  // Lire une liste de clients collée depuis un tableur ou un carnet d'adresses. Un cabinet a
  // soixante clients : les saisir un par un dans un formulaire, personne ne le fera, et
  // l'application resterait vide le jour de la démonstration.
  // Une ligne = un client. Les colonnes, quand il y en a : nom ; matricule ; email ; téléphone.
  // On accepte le point-virgule et la tabulation (ce que produisent Excel et Numbers en français).
  function parseDossierLines(text, existants) {
    const vus = new Set((existants || []).map(d => d.id));
    const out = [], ignorés = [];
    String(text || '').split(/\r?\n/).forEach((ligne, i) => {
      const l = ligne.trim();
      if (!l) return;
      const cols = l.split(/\s*[;\t]\s*/);
      // Une ligne d'entête copiée avec le tableau ne doit pas devenir un client nommé « Nom ».
      if (i === 0 && /^(nom|client|raison sociale|société)$/i.test(cols[0])) return;
      // Les colonnes arrivent parfois dans le désordre. Mais la DEUXIÈME reste le matricule tant
      // qu'elle n'est pas manifestement une adresse : un matricule tunisien écrit en chiffres seuls
      // (« 1234567 ») ressemble à un numéro de téléphone, et l'ancienne heuristique le déplaçait
      // dans le téléphone puis effaçait le matricule — c'est-à-dire l'identifiant du dossier.
      const f = { name: cols[0] || '', matricule: '', email: '', phone: '' };
      const reste = [];
      cols.slice(1).forEach((c, i) => {
        const v = String(c || '').trim();
        if (!v) return;
        if (i === 0 && !v.includes('@')) { f.matricule = v; return; }
        reste.push(v);
      });
      reste.forEach(v => {
        if (v.includes('@')) { if (!f.email) f.email = v; return; }
        if (/^\+?[\d\s().-]{6,}$/.test(v)) { if (!f.phone) f.phone = v; return; }
        if (!f.matricule) f.matricule = v;
      });
      if (!f.name) return;
      const d = newDossier(f);
      if (vus.has(d.id)) return ignorés.push(f.name);
      vus.add(d.id);
      out.push(d);
    });
    return { dossiers: out, ignorés };
  }

  // Enregistrer qu'on a relancé. Le geste existait, la trace non : on cliquait « Écrire », le mail
  // partait, et le lundi suivant plus personne ne savait qui avait été relancé.
  function noteRelance(dossier, months, via, at, note) {
    dossier.relances = (dossier.relances || []).concat([{
      at: at || Date.now(), months: (months || []).slice(), via: via || 'email', note: note || ''
    }]).slice(-50);
    return dossier;
  }

  // Le premier mois qu'on attend de ce client, et s'il a fallu le borner. 10.12.0 (U-05) — UNE
  // fonction pour les deux onglets de la fiche : le calendrier du Suivi en déduisait ses mois
  // « hors mission », pendant que la Comptabilité comptait les manques depuis le 1er janvier, et
  // annonçait « Il manque 6 mois » sur six mois que l'onglet voisin disait hors mission — encore
  // après la création du livre. Un compteur et la liste qu'il annonce se calculent avec la même
  // fonction (6.8.1). '' quand on n'attend rien de lui.
  function premierMoisAttendu(dossier, todayIso) {
    // Un client hors SkanFact n'a rien à envoyer — SAUF si le comptable a posé une date de début
    // de mission (voir `dossierMonths`).
    if (!dossier || (dossier.manual && !dossier.from)) return { mois: '', tronque: false };
    // `from` est la date de début de mission, saisie par le comptable. C'est le seul moyen de dire
    // « je reprends ce client à partir de janvier » : sans elle, l'attente démarre au premier paquet
    // reçu et les mois d'avant ne sont jamais réclamés — un client repris en cours d'année passait
    // à travers sans que rien ne l'annonce.
    const recus = (dossier.packs || []).map(p => String(p.month || '')).filter(m => /^\d{4}-\d{2}$/.test(m)).sort();
    const brut = dossier.from || recus[0] || '';
    if (!brut) return { mois: '', tronque: false };
    // Une date de début de mission sans plancher fait réclamer vingt ans périmés — et le rabot de
    // `monthsBetween` coupe par la FIN, donc les mois réellement en retard disparaissent de la liste
    // pendant que des mois de 2006 s'affichent. On borne à cinq ans, et on le dit.
    const plancher = addMonth(String(todayIso || today()).slice(0, 7), -MAX_MOIS_ATTENDUS);
    return brut < plancher ? { mois: plancher, tronque: true } : { mois: brut, tronque: false };
  }
  function debutDeMission(dossier, todayIso) { return premierMoisAttendu(dossier, todayIso).mois; }

  // L'état d'un dossier, mois par mois. `from` = le premier mois qu'on attend de ce client ;
  // par défaut le premier reçu, parce qu'avant ça on ne sait rien et qu'on ne réclame pas le néant.
  // `graceDay` : le jour du mois avant lequel on ne réclame pas encore le mois qui vient de finir.
  // Le 1er septembre, personne n'a encore envoyé août — et pourtant tout le portefeuille basculait
  // en rouge d'un coup. Le compteur d'alerte était maximal le jour où personne n'était fautif.
  function dossierMonths(dossier, todayIso, graceDay) {
    const t = todayIso || today();
    const curMonth = t.slice(0, 7);
    const grace = Number(graceDay) > 0 ? Number(graceDay) : 0;
    const jour = Number(t.slice(8, 10)) || 1;
    const moisDeGrace = grace && jour < grace ? addMonth(curMonth, -1) : null;
    // Un dossier créé à la main suit un client qui n'utilise pas encore SkanFact : on ne lui réclame
    // rien tant qu'il n'a pas commencé. Le réclamer afficherait vingt mois manquants le jour de sa
    // création, et noierait les vrais retards.
    // Un client hors SkanFact n'a rien à envoyer — SAUF si le comptable a posé une date de début de
    // mission : c'est précisément ce que la fiche lui propose de faire. Sans cette exception, l'écran
    // réclamait un geste qui ne faisait rien.
    // 10.14.1 (MC-14) — mais ces mois ne sont jamais des paquets MANQUANTS. Depuis la 10.12.0, un
    // dossier créé à la main est TENU AU CABINET : sa fiche dit « aucun paquet attendu », son Suivi
    // « Rien n'est réclamé au client ». Sa date de début de mission dit d'où partent les mois À SAISIR
    // (la Production, les Échéances), jamais qu'on attend un envoi : marqués « manquant », ces mois
    // le mettaient en tête des Relances, en rouge dans « À faire » (« n'a pas envoyé son mois »), et
    // sa fiche proposait « Relancer » en vert — à un client qui n'utilise pas SkanFact.
    const tenu = !!dossier.manual;
    const { mois: first, tronque } = premierMoisAttendu(dossier, t);
    if (!first) return [];
    const last = addMonth(curMonth, -1);                    // le mois en cours n'est jamais attendu
    if (first > last) return [];
    const out = monthsBetween(first, last).map(m => {
      const p = (dossier.packs || []).find(x => x.month === m);
      return {
        month: m, label: monthLabel(m), pack: p || null,
        state: tenu ? 'tenu' : !p ? (m === moisDeGrace ? 'attendu' : 'manquant') : p.definitive ? 'complet' : 'provisoire',
        missing: p ? (p.missing || []).reduce((s, x) => s + (x.count || 0), 0) : 0
      };
    });
    if (tronque && out.length) out[0].tronque = true;       // l'interface peut le dire
    return out;
  }

  // La ligne d'un dossier dans l'écran principal. Trois faits, dans l'ordre où ils comptent :
  // combien de mois manquent, où en est le dernier reçu, et quand il est arrivé.
  function dossierRow(dossier, todayIso, graceDay) {
    const months = dossierMonths(dossier, todayIso, graceDay);
    const missing = months.filter(m => m.state === 'manquant');
    const attendus = months.filter(m => m.state === 'attendu');
    const provisional = months.filter(m => m.state === 'provisoire');
    const last = (dossier.packs || []).slice().sort((a, b) => a.month < b.month ? 1 : -1)[0] || null;
    const issues = (dossier.packs || []).reduce((s, p) => s + (p.missing || []).reduce((a, x) => a + (x.count || 0), 0), 0);
    // « hors » n'est pas « à jour » : un client qui n'utilise pas SkanFact n'a rien envoyé, mais il
    // n'est pas en retard non plus. Les confondre ferait afficher « tout est à jour » à un cabinet
    // dont cinquante-huit clients sur soixante n'envoient rien.
    const level = dossier.manual ? 'hors' : missing.length ? 'danger' : provisional.length ? 'warn' : 'ok';
    const relances = dossier.relances || [];
    const lastRel = relances.length ? relances[relances.length - 1] : null;
    return {
      id: dossier.id, name: dossier.name, matricule: dossier.matricule,
      email: dossier.email, phone: dossier.phone || '', contact: dossier.contact || '',
      archived: !!dossier.archived, manual: !!dossier.manual,
      regime: dossier.regime || '', tvaPeriod: dossier.tvaPeriod || '', fees: Number(dossier.fees) || 0,
      from: dossier.from || '',
      relanceCount: relances.length,
      lastRelanceAt: lastRel ? lastRel.at : null,
      lastRelanceVia: lastRel ? lastRel.via : '',
      lastRelanceMonths: lastRel ? (lastRel.months || []) : [],
      lastMonth: last ? last.month : '', lastLabel: last ? last.label : '',
      lastAt: last ? last.receivedAt : null, lastDefinitive: last ? last.definitive : false,
      lastFigures: last ? (last.figures || null) : null,
      months: months.length, missingMonths: missing.map(m => m.month), missingCount: missing.length,
      // Le mois qui vient de finir et qu'on ne réclame pas encore : il se montre, il ne crie pas.
      awaited: attendus.map(m => m.month),
      provisionalCount: provisional.length, issues, level,
      packCount: (dossier.packs || []).length,
      // ce qui décide du tri : un dossier en retard de trois mois passe devant un dossier à jour
      score: missing.length * 1000 + provisional.length * 10 + (issues ? 1 : 0)
    };
  }

  // Le tri des listes. On garde le classement par urgence comme tri PAR DÉFAUT (c'est la question
  // que l'application existe pour répondre), mais un cabinet à soixante lignes a besoin de ranger
  // par nom, par dernier mois reçu, par chiffre d'affaires.
  const SORTS = {
    urgence: (a, b) => b.score - a.score || parNom(a.name, b.name),
    nom: (a, b) => parNom(a.name, b.name),
    dernier: (a, b) => String(b.lastMonth || '').localeCompare(String(a.lastMonth || '')) || parNom(a.name, b.name),
    recu: (a, b) => (b.lastAt || 0) - (a.lastAt || 0) || parNom(a.name, b.name),
    ca: (a, b) => ((b.lastFigures && b.lastFigures.ca) || 0) - ((a.lastFigures && a.lastFigures.ca) || 0) || parNom(a.name, b.name),
    manquants: (a, b) => b.missingCount - a.missingCount || parNom(a.name, b.name),
    relance: (a, b) => (a.lastRelanceAt || 0) - (b.lastRelanceAt || 0) || parNom(a.name, b.name)
  };

  function dossierList(state, todayIso, opts) {
    opts = opts || {};
    const grace = Number((state.settings || {}).relanceDay) || 0;
    const rows = (state.dossiers || [])
      .filter(d => opts.withArchived ? true : !d.archived)
      .filter(d => opts.onlySkanfact ? !d.manual : true)
      .map(d => dossierRow(d, todayIso, grace));
    // « epicerie » doit trouver « Épicerie », « patisserie » « Pâtisserie » : personne ne tape les
    // accents dans un champ de recherche, surtout pas sur un clavier arabe-français.
    const q = sansAccents(opts.q).trim();
    const kept = q
      ? rows.filter(r => sansAccents(r.name + ' ' + r.matricule + ' ' + r.email + ' ' + r.phone + ' ' + r.contact).includes(q))
      : rows;
    const cmp = SORTS[opts.sort] || SORTS.urgence;
    const out = kept.slice().sort(cmp);
    if (opts.desc && opts.sort && opts.sort !== 'urgence') out.reverse();
    return out;
  }

  // Le portefeuille d'un coup d'œil. C'est ce qui manquait pour qu'un comptable voie autre chose
  // qu'une liste : combien de clients, combien sont à jour, combien de chiffre d'affaires suivi.
  // 10.12.0 (U-04) — le chiffre d'affaires d'un portefeuille, sur UN mois NOMMÉ. La carte « de CA
  // suivi » additionnait le DERNIER mois reçu de chaque client : le mars d'un retardataire et
  // l'août d'un client à jour, dans un seul chiffre qui ne voulait rien dire. Un agrégat porte une
  // devise ET une période nommée (3.1.0, 7.16.0) : on prend le mois le plus récent qu'au moins un
  // client a envoyé — jamais le mois en cours s'il en existe un clos —, on dit combien de clients
  // il couvre, et on refuse d'additionner deux devises. `montant` vaut null quand ce n'est pas
  // additionnable, jamais 0 (9.6.0). La carte et le pied du tableau lisent CETTE fonction (6.8.1).
  function caDuPortefeuille(dossiers, todayIso) {
    const dernierClos = addMonth(String(todayIso || today()).slice(0, 7), -1);
    const parMois = new Map();
    let sur = 0;
    (dossiers || []).forEach(d => {
      if (!d || d.manual) return;
      sur++;
      (d.packs || []).forEach(p => {
        const brut = p && p.figures ? p.figures.ca : null;
        const ca = Number(brut);
        const m = String((p && p.month) || '');
        // Un champ venu d'un paquet peut être une chaîne : additionnée telle quelle, elle se
        // CONCATÈNE, et 42 500 DT devenaient « 0,000 DT » (défaut du pied de liste, 6.8.1).
        if (brut == null || brut === '' || !isFinite(ca) || !/^\d{4}-\d{2}$/.test(m)) return;
        const x = parMois.get(m) || { montant: 0, clients: new Set(), devises: new Set() };
        x.montant += ca; x.clients.add(d.id); x.devises.add(p.figures.devise || 'DT');
        parMois.set(m, x);
      });
    });
    const mois = [...parMois.keys()].sort();
    const clos = mois.filter(m => m <= dernierClos);
    const choisi = (clos.length ? clos : mois).pop() || '';
    if (!choisi) return { mois: '', montant: null, devise: '', clients: 0, sur, devises: 0 };
    const x = parMois.get(choisi);
    const devises = [...x.devises];
    return {
      mois: choisi,
      montant: devises.length > 1 ? null : round3(x.montant),
      devise: devises.length > 1 ? '' : devises[0],
      clients: x.clients.size, sur, devises: devises.length
    };
  }

  function portfolio(state, todayIso) {
    const rows = dossierList(state, todayIso, { withArchived: false });
    const suivis = rows.filter(r => !r.manual);
    const ids = new Set(rows.map(r => r.id));
    const ca = caDuPortefeuille((state.dossiers || []).filter(d => ids.has(d.id)), todayIso);
    const fees = rows.reduce((s, r) => s + (r.fees || 0), 0);
    return {
      total: rows.length,
      surSkanfact: suivis.length,
      horsSkanfact: rows.filter(r => r.manual).length,
      aJour: suivis.filter(r => r.level === 'ok').length,
      enRetard: suivis.filter(r => r.missingCount > 0).length,
      provisoires: suivis.filter(r => r.provisionalCount > 0 && !r.missingCount).length,
      moisManquants: suivis.reduce((s, r) => s + r.missingCount, 0),
      ca,
      honoraires: round3(fees),
      paquets: rows.reduce((s, r) => s + r.packCount, 0)
    };
  }

  // « Le 10 : la page Dossiers te dit qui n'a rien envoyé » — l'aide le promettait depuis la 1.0.0
  // et rien ne l'implémentait. Voilà le jour venu.
  // RÈGLE : un compteur et la liste qu'il annonce se calculent avec la MÊME fonction. Le bandeau de
  // la page Relances comptait les seuls mois manquants pendant que le tableau, dix pixels plus bas,
  // listait aussi les provisoires — « 2 dossiers » au-dessus de trois lignes. Une fois la question
  // posée à voix haute, plus aucun chiffre n'est cru sur parole, et l'app n'est faite que de
  // chiffres. Tout part donc de `relanceRows`, et on distingue les deux motifs à l'intérieur.
  function relanceDue(state, todayIso) {
    const t = todayIso || today();
    const day = Number((state.settings || {}).relanceDay) || 10;
    const jour = Number(t.slice(8, 10));
    const toutes = relanceRows(state, t);
    const rows = toutes.filter(r => r.missingCount > 0);
    return {
      day, due: jour >= day, jour,
      count: rows.length, rows,                                   // il manque des mois
      provisoires: toutes.length - rows.length,                   // reçus, mais non clôturés
      total: toutes.length, toutes                                // ce que la page affiche
    };
  }

  // Qui figure sur la page Relances. La pastille de la barre latérale compte EXACTEMENT ces
  // lignes-là : avant, elle comptait les seuls retardataires pendant que la page en listait trois
  // (elle y ajoutait les provisoires). Deux chiffres pour la même chose, et aucun des deux faux —
  // c'est le genre d'incohérence qui fait douter de tout le reste.
  function relanceRows(state, todayIso) {
    return dossierList(state, todayIso).filter(r => r.missingCount > 0 || r.provisionalCount > 0);
  }

  // Ce que le cabinet a sur le feu, tous dossiers confondus. C'est ce qu'il regarde en arrivant.
  // `opts.cleSecours` : true si une clé de secours a déjà été enregistrée, false si on sait qu'il n'y
  // en a aucune, absent si on ne sait pas encore (la date vit dans app-config.json, pas dans l'état
  // chiffré, et elle arrive par une promesse). On ne réclame QUE sur un false franc : afficher
  // l'alerte sur un « je ne sais pas encore » la ferait clignoter à chaque démarrage, et une alerte
  // qui clignote ne se lit plus.
  // ---------- Tes premiers pas (10.14.0) ----------
  //
  // Skander : « quelqu'un qui découvre n'a pas envie de lire l'Aide » ; puis « si on tombe sur un
  // formulaire au début, on a tendance à passer ». L'assistant du Cabinet posait CINQ écrans avant de
  // montrer quoi que ce soit — nom, clients, copie externe, clé de secours, fichier d'appairage — et
  // les trois derniers se passaient : ils protégeaient un portefeuille vide et remettaient un fichier
  // à des clients qu'on n'avait pas encore. Ils vivent ici, au moment où ils servent, et chaque étape
  // se DÉDUIT de l'état (jamais une case qu'on coche : elle mentirait le jour d'une fausse manœuvre).
  //
  // `ctx` : ce que l'état chiffré ne porte pas — la clé de secours (`true` enregistrée, `false` jamais,
  // `null` on ne sait pas encore), la copie externe, les dossiers tenus au cabinet, la découverte.
  // « Ne pas savoir » n'est pas « non » (9.9.0) : une clé dont la réponse n'est pas revenue ne se
  // réclame pas, elle ne se coche pas non plus.
  function premiersPas(state, ctx) {
    const s = state || {};
    const c = ctx || {};
    const reels = (s.dossiers || []).filter(d => !d.demo);
    const tenus = c.tenus || {};
    const cab = s.cabinet || {};
    const unPaquet = reels.some(d => (d.packs || []).length);
    const unLivre = reels.some(d => tenus[d.id]);
    const etapes = [
      // La découverte : facultative, comme dans l'application entreprise. Faite, elle compte ; pas
      // faite, elle attend sans jamais passer devant une étape du métier.
      { id: 'decouverte', titre: 'Découvrir le Cabinet avec l\'exemple', fait: !!c.decouverte, facultatif: true,
        quoi: c.decouverte ? 'Tu as fait le tour sur les six dossiers de l\'exemple : tu sais où est chaque chose.'
          : 'Le grand tour sur six dossiers fictifs : un client à jour, un en retard, un que tu tiens de bout en bout. Rien de ce que tu y fais ne compte.',
        action: 'decouverte' },
      { id: 'cabinet', titre: 'Nommer ton cabinet', fait: !!String(cab.name || '').trim(),
        quoi: 'Ce nom signe tes relances et le fichier que tes clients importent.', action: 'cabinet' },
      // 10.14.0 (l'assistant, jusqu'au bout) — ce qui se règle UNE fois pour tout le cabinet et qui ne
      // se demande pas au premier écran (un formulaire au premier écran se saute) : l'équipe, puis la
      // grille de saisie, plus bas. Facultatifs : seul, on n'a personne à déclarer, et la grille marche
      // telle quelle. Chacun se coche sur un GESTE du comptable, jamais sur une valeur posée par le
      // logiciel (10.12.0) : `migrate` remplit les réglages de saisie d'office, donc leur présence ne
      // prouve rien — c'est l'enregistrement du panneau qui laisse `regleLe`.
      { id: 'equipe', titre: 'Déclarer ton équipe', fait: collaborateurs(state).length > 0, facultatif: true,
        quoi: collaborateurs(state).length ? 'Ton équipe est déclarée : la piste d\'audit porte le nom de chacun, et chacun ne fait que ce que son rôle permet.'
          : 'Si tu n\'es pas seul : chaque collaborateur, son rôle (saisie, validation, supervision) et les dossiers qu\'on lui confie. Seul, il n\'y a rien à faire : rien n\'est restreint tant que personne n\'est déclaré.',
        action: 'equipe' },
      { id: 'clients', titre: 'Ajouter tes clients', fait: reels.length > 0,
        quoi: 'Tous, même ceux qui n\'utilisent pas SkanFact : l\'application devient le tableau de bord de ton portefeuille, et rien n\'est réclamé à ceux qui n\'ont pas commencé.',
        action: 'clients' },
      { id: 'appairage', titre: 'Remettre le fichier d\'appairage à tes clients', fait: !!cab.pairingExportedAt,
        quoi: 'Un fichier sans rien de secret : le Cabinet prépare le message qui l\'envoie à tes clients. Chacun l\'importe une fois, et ses paquets sont ensuite chiffrés pour toi seul.',
        action: 'appairage' },
      { id: 'cle', titre: 'Enregistrer ta clé de secours', fait: c.cleSecours === true,
        quoi: 'Sans elle, si cet ordinateur disparaît, aucun paquet déjà reçu ne pourra plus être ouvert — ni par nous, ni par personne.',
        action: 'cle' },
      { id: 'copie', titre: 'Mettre ton cabinet à l\'abri', fait: !!c.copieExterne,
        quoi: 'Une copie automatique hors de cet ordinateur : clé USB, disque, iCloud ou OneDrive. La base, les livres et les paquets y sont recopiés à chaque enregistrement.',
        action: 'copie' },
      { id: 'saisie', titre: 'Régler ta grille de saisie', fait: !!(((s.settings || {}).saisie || {}).regleLe), facultatif: true,
        quoi: (((s.settings || {}).saisie || {}).regleLe) ? 'Ta grille est réglée : ses touches et le journal proposé valent pour tous tes dossiers.'
          : 'Les touches (solder la pièce, recopier la ligne, valider), le journal proposé, la date : reprends celles de ton logiciel actuel, pour saisir sans y penser. Telle quelle, la grille marche déjà.',
        action: 'saisie' },
      { id: 'travail', titre: 'Recevoir un premier paquet, ou tenir un premier livre', fait: unPaquet || unLivre,
        quoi: unPaquet || unLivre ? 'Ton portefeuille vit : les mois reçus et saisis s\'y comptent tout seuls.'
          : 'Un client sur SkanFact t\'envoie son paquet du mois (tu le glisses sur la fenêtre) ; pour un client hors SkanFact, tu crées son livre et tu saisis.',
        action: 'travail' }
    ];
    const faits = etapes.filter(x => x.fait).length;
    // Le panneau ne vaut que pendant le DÉMARRAGE : les facultatives ne le retiennent pas (un panneau
    // qui ne disparaîtrait jamais parce qu'on n'a pas fait la découverte est celui qu'on apprend à ne
    // plus lire), et il disparaît tout seul quand le métier est en place.
    const demarrage = etapes.some(x => !x.fait && !x.facultatif);
    const suivante = etapes.find(x => !x.fait && !x.facultatif) || null;
    return { etapes, faits, total: etapes.length, demarrage, suivante };
  }

  function cabinetTodo(state, todayIso, opts) {
    // « À faire » par collaborateur (9.9.0). On restreint le PORTEFEUILLE, pas la liste d'arrivée :
    // filtrer les lignes après coup laisserait chaque libellé annoncer le compte du cabinet entier
    // au-dessus d'une liste réduite — un compteur et la liste qu'il annonce se calculent avec la
    // même fonction (6.8.1). Ici, la même fonction sur un portefeuille plus petit.
    if (opts && opts.collabId) state = { ...state, dossiers: dossiersConfies(state, opts.collabId) };
    const rows = dossierList(state, todayIso);
    const out = [];
    // La clé de secours passe AVANT tout le reste. C'est le seul manque irréparable de cette
    // application : une relance oubliée se rattrape le lendemain, un poste perdu sans clé rend
    // illisibles POUR TOUJOURS tous les paquets déjà reçus, et oblige chaque client à refaire son
    // appairage. Jusqu'ici l'avertissement ne vivait qu'au milieu de la page Réglages.
    if (opts && opts.cleSecours === false) out.push({
      id: 'cle-secours', level: 'danger',
      label: 'Ta clé de secours n\'est enregistrée nulle part',
      detail: 'Sans elle, si cet ordinateur est perdu ou volé, aucun paquet déjà reçu ne pourra plus être ouvert, '
        + 'et tous tes clients devront refaire leur appairage. Trois minutes, une fois.',
      count: 0, rows: []
    });
    // La licence (9.4.0), juste après la clé de secours : c'est le second manque qui BLOQUE un
    // geste. On ne le dit qu'une fois le quota dépassé — un cabinet dans les trois dossiers
    // gratuits n'a rien à faire, et lui poser une ligne « À faire » reviendrait à lui vendre
    // quelque chose dont il n'a pas besoin.
    if (opts && opts.licence && opts.licence.locked) out.push({
      id: 'licence', level: 'danger',
      label: `${pl(opts.licence.comptes, 'dossier')} hors SkanFact ${opts.licence.comptes > 1 ? 'sont comptés' : 'est compté'}, ${opts.licence.autorises} ${opts.licence.autorises > 1 ? 'sont couverts' : 'est couvert'}`,
      detail: 'La validation d\'une écriture demande une licence. Tout le reste — lire, importer un paquet, '
        + 'exporter tes écritures, relancer tes clients — reste ouvert. La page te dit quels dossiers sont comptés, et pourquoi.',
      count: opts.licence.depasse || 0, rows: []
    });
    // Le jour de relance : c'est une échéance, pas un état.
    const rel = relanceDue(state, todayIso);
    if (rel.due && rel.total) out.push({
      id: 'jour-de-relance', level: 'danger',
      label: `On est le ${rel.jour} : ${pl(rel.total, 'dossier')} à relancer`,
      detail: `Tu as fixé le ${rel.day} du mois comme jour de relance (Réglages). `
        + [
          rel.count ? `${pl(rel.count, 'dossier')} ${rel.count > 1 ? 'ont' : 'a'} des mois manquants` : '',
          rel.provisoires ? `${pl(rel.provisoires, rel.count ? 'autre' : 'dossier')} ${rel.provisoires > 1 ? 'ont' : 'a'} envoyé un mois qui n'est pas clôturé` : ''
        ].filter(Boolean).join(', et ') + '.',
      count: rel.total, rows: rel.toutes
    });
    // Une échéance qui approche avec des pièces qui manquent : c'est le seul cas où une date compte
    // plus qu'un état. Une échéance proche mais complète n'a pas à crier.
    // La MÊME connaissance des employeurs que la page Échéances : un compteur et la liste qu'il
    // annonce se calculent avec la même fonction ET les mêmes données (règle 6.8.1).
    const urgente = echeances(state, todayIso, { avant: 1, apres: 1, employeurs: (opts || {}).employeurs, tenus: (opts || {}).tenus })
      // Un mois qu'un dossier TENU AU CABINET attend encore de saisir bloque la déclaration autant
      // qu'un paquet qui n'est pas arrivé (10.12.0) — mais il ne se dit pas pareil : on ne l'a pas
      // « envoyé », on ne l'a pas saisi.
      .filter(e => !e.passee && e.jours <= 12 && (e.manquants.length || e.aSaisir.length))
      .sort((a, b) => a.jours - b.jours)[0];
    if (urgente) {
      const m = urgente.manquants.length, a = urgente.aSaisir.length;
      const plusieursMois = urgente.mois.length > 1;
      const morceaux = [
        // « 2 clients n'ont pas envoyé son mois » : l'accord suit les clients, pas l'échéance.
        m ? `${pl(m, 'client')} ${m > 1 ? `n'ont pas envoyé ${plusieursMois ? 'leurs mois' : 'leur mois'}` : `n'a pas envoyé ${plusieursMois ? 'ses mois' : 'son mois'}`}` : '',
        a ? `${pl(a, m ? 'autre' : 'client')} tenu${a > 1 ? 's' : ''} au cabinet ${a > 1 ? 'sont' : 'est'} encore à saisir` : ''
      ].filter(Boolean);
      const noms = urgente.manquants.concat(urgente.aSaisir);
      // La date en lettres : « (2026-09-28) » est le format de la machine, pas celui d'un comptable
      // (U-28, porté ici).
      const leJour = `${Number(urgente.date.slice(8, 10))} ${monthLabel(urgente.date.slice(0, 7))}`;
      out.push({
        id: 'echeance', level: urgente.jours <= 5 ? 'danger' : 'warn',
        label: `${urgente.label} : ${morceaux.join(', ')}`,
        detail: `À déposer dans ${urgente.jours} jour${urgente.jours > 1 ? 's' : ''} (le ${leJour}). ${noms.slice(0, 5).join(', ')}${noms.length > 5 ? '…' : ''}`,
        count: m + a, rows: []
      });
    }
    const late = rows.filter(r => r.missingCount > 0);
    if (late.length) out.push({
      id: 'manquants', level: 'danger',
      label: `${pl(late.length, 'dossier')} n'${late.length > 1 ? 'ont' : 'a'} pas tout envoyé`,
      detail: late.slice(0, 6).map(r => `${r.name} (${pl(r.missingCount, 'mois', 'mois')})`).join(' · '),
      count: late.length, rows: late
    });
    const prov = rows.filter(r => r.provisionalCount > 0 && !r.missingCount);
    if (prov.length) out.push({
      id: 'provisoires', level: 'warn',
      label: `${pl(prov.length, 'dossier')} n'${prov.length > 1 ? 'ont' : 'a'} envoyé que du provisoire`,
      // L'accord suit le nombre de dossiers (10.12.0) : « 1 dossier… Leur mois » se lisait dans « À faire ».
      detail: `${prov.length > 1 ? 'Leur' : 'Son'} mois n'est pas clôturé : les chiffres peuvent encore bouger. À relancer avant de déclarer.`,
      count: prov.length, rows: prov
    });
    // Les questions posées au client et restées sans réponse au bout de DEUX paquets (9.10.0).
    // Elle remonte des deux côtés — le client la voit aussi dans son « À faire » — parce qu'une
    // question qui reste sans réponse n'est pas un oubli du client : c'est un point qui bloque la
    // révision, et le comptable doit décrocher son téléphone.
    const qs = (opts && Array.isArray(opts.questions) ? opts.questions : []).filter(q => q.aRelancer > 0);
    if (qs.length) out.push({
      id: 'questions', level: 'warn',
      label: `${pl(qs.length, 'client n\'a pas répondu', 'clients n\'ont pas répondu')} à tes questions`,
      detail: `Parties dans deux paquets sans réponse. ${qs.slice(0, 6).map(q => `${q.name} (${pl(q.aRelancer, 'question')})`).join(' · ')}`,
      count: qs.reduce((s, q) => s + q.aRelancer, 0),
      rows: qs.map(q => rows.find(r => r.id === q.dossierId)).filter(Boolean)
    });
    const holes = rows.filter(r => r.issues > 0);
    if (holes.length) out.push({
      id: 'pieces', level: 'warn',
      label: `${pl(holes.length, 'dossier')} ${holes.length > 1 ? 'ont' : 'a'} des pièces manquantes`,
      detail: `Justificatifs d'achat absents, factures en brouillon, attestations non remises — la page de garde de ${holes.length > 1 ? 'leur' : 'son'} paquet en donne le détail.`,
      count: holes.length, rows: holes
    });
    return out;
  }

  // « juin 2026, juillet 2026 et août 2026 » : personne n'écrit ça. Tant qu'on reste dans la même
  // année, elle ne se dit qu'une fois, à la fin.
  function monthListLabel(months) {
    const list = (months || []).slice();
    if (!list.length) return '';
    const sameYear = list.every(m => m.slice(0, 4) === list[0].slice(0, 4));
    const parts = list.map((m, i) => (sameYear && i < list.length - 1) ? monthLabel(m).split(' ')[0] : monthLabel(m));
    return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1] : parts[0];
  }

  // « de octobre » ne s'écrit pas. Quatre des douze mois commencent par une voyelle.
  function de(label) { return (/^[aeiouéèê]/i.test(label) ? 'd\'' : 'de ') + label; }

  // Le libellé d'un bouton de lot de la grille de saisie (T-53) : « Valider la seule pièce d'AC »,
  // « Valider les 3 pièces de VT », « Valider la seule pièce d'août ». L'écran écrivait « Valider la
  // seule de AC » — sans le nom, et sans l'élision que la branche des mois faisait pourtant trois
  // caractères plus loin. Un code de journal commence par une voyelle une fois sur trois (AC, OD).
  function libelleLot(lot) {
    const n = Number(lot && lot.n) || 0;
    const quoi = n > 1 ? `les ${nbFr(n)} pièces` : 'la seule pièce';
    return `Valider ${quoi} ${de(String((lot && lot.label) || ''))}`;
  }

  // Ce qui manque, dit en une ligne. Au-delà de trois mois on donne l'intervalle : une énumération de
  // onze mois n'est plus lue, elle est vue comme un pavé — que ce soit dans un tableau ou dans un mail.
  function missingLabel(months) {
    const m = months || [];
    if (!m.length) return '';
    return m.length > 3
      ? `${pl(m.length, 'mois', 'mois')}, ${de(monthLabel(m[0]))} à ${monthLabel(m[m.length - 1])}`
      : monthListLabel(m);
  }

  // Le mail de relance. Il nomme les mois manquants : « envoie-moi tes documents » ne fait bouger
  // personne, « il me manque mars et avril » si. Au-delà de trois mois on donne l'intervalle :
  // un objet de mail qui énumère onze mois n'est plus lu, il est vu comme un pavé.
  function relanceMail(cabinet, row, todayIso) {
    const miss = row.missingMonths || [];
    const mois = miss.map(monthLabel);
    const longue = miss.length > 3;
    const intervalle = longue ? `${de(monthLabel(miss[0]))} à ${monthLabel(miss[miss.length - 1])}` : '';
    const sujet = mois.length
      ? (longue
        ? `Il me manque ${miss.length} mois de dossiers (${intervalle})`
        : `Il me manque ${mois.length > 1 ? 'vos dossiers' : 'votre dossier'} ${de(monthListLabel(miss))}`)
      : `Votre dossier ${de(row.lastLabel)} n'est pas définitif`;
    const corps = mois.length
      ? `Bonjour,\n\nPour tenir votre comptabilité à jour, il me manque ${mois.length > 1 ? 'les dossiers' : 'le dossier'} `
        + (longue ? `des ${miss.length} mois suivants :\n${mois.map(m => '  · ' + m).join('\n')}\n` : `${de(monthListLabel(miss))}.\n`)
        + `\n`
        + `Dans SkanFact : Comptabilité → Clôtures pour clôturer le mois, puis Comptabilité → Cabinet pour fabriquer et m'envoyer le paquet.\n\n`
        + `Bien à vous,\n${(cabinet && cabinet.name) || ''}`
      : `Bonjour,\n\nJ'ai bien reçu votre dossier ${de(row.lastLabel)}, mais il est marqué « provisoire » : le mois n'a pas été clôturé dans SkanFact, donc les chiffres peuvent encore changer.\n\n`
        + `Quand tout est saisi, clôturez le mois (Comptabilité → Clôtures) et renvoyez-moi le paquet : je pourrai alors déclarer sans risque.\n\n`
        + `Bien à vous,\n${(cabinet && cabinet.name) || ''}`;
    return { to: row.email || '', subject: sujet, body: corps };
  }

  // L'accusé de réception. Le client envoie son mois et n'entend plus parler de rien : il ne sait pas
  // si c'est arrivé, si c'était lisible, s'il manquait quelque chose. Trois lignes du comptable
  // valent mieux que trois relances du client — et c'est ce qui l'entretient dans l'habitude
  // d'envoyer chaque mois.
  function accuseMail(cabinet, dossier, pack) {
    const p = pack || {};
    const label = p.label || monthLabel(p.month);
    const manques = (p.missing || []).reduce((s, m) => s + (m.count || 0), 0);
    const detail = (p.missing || []).filter(m => m.count)
      .map(m => `  · ${m.count} ${m.label}`).join('\n');
    const corps = `Bonjour,\n\n`
      + `J'ai bien reçu votre dossier ${de(label)}`
      + (p.files ? `, ${pl(p.files, 'pièce')} en tout` : '')
      + (p.definitive ? ' (mois clôturé).' : ' — il est marqué « provisoire » : le mois n\'a pas été clôturé dans SkanFact, donc les chiffres peuvent encore changer.')
      + '\n\n'
      + (manques
        ? `Il me manque encore ${pl(manques, 'élément')} que SkanFact a signalé${manques > 1 ? 's' : ''} :\n${detail}\n\nQuand ce sera complété, clôturez le mois et renvoyez-moi le paquet.\n\n`
        : (p.definitive ? 'Rien ne manque : je peux travailler dessus.\n\n' : 'Quand tout est saisi, clôturez le mois et renvoyez-moi le paquet : je pourrai alors déclarer sans risque.\n\n'))
      + `Bien à vous,\n${(cabinet && cabinet.name) || ''}`;
    return {
      to: (dossier && dossier.email) || '',
      subject: `Bien reçu : votre dossier ${de(label)}`,
      body: corps
    };
  }

  // Un jeu d'exemple. Un comptable qui ouvre l'application pour la première fois tombe sinon sur un
  // écran vide, et ne voit pas ce qu'elle lui apporterait. Six dossiers montrent ce qu'un cabinet
  // rencontre : à jour, en retard, provisoire, pièces manquantes, endormi — et hors SkanFact, tenu
  // au cabinet de bout en bout. Les données sont ouvertement fictives et l'écran le dit.
  function demoDossiers(todayIso) {
    const cur = (todayIso || today()).slice(0, 7);
    const M = n => addMonth(cur, n);
    // Un paquet se fabrique APRÈS la fin du mois qu'il couvre — jamais pendant. L'exemple datait
    // chaque envoi du 8 du mois lui-même : « août, définitif, reçu le 08/08 ». Le premier
    // comptable à qui on le montre pose la question (« il a clôturé août le 8 août ? ») et toute
    // la promesse du produit s'écroule sur son premier exemple. Le jour change d'un client à
    // l'autre : cinq dossiers reçus à la même minute, ça ne ressemble à rien non plus.
    const JOURS_ENVOI = [6, 9, 11, 14, 19];
    const cePourJour = Date.parse((todayIso || today()) + 'T09:30:00Z');
    // Le jour d'envoi tombe dans le mois SUIVANT celui que le paquet couvre. Pour le mois qui
    // vient tout juste de finir, ce jour peut ne pas être encore arrivé : on ramène alors la
    // réception à aujourd'hui, plutôt que d'afficher une date future.
    const recu = (m, rang) => {
      const jour = JOURS_ENVOI[(rang || 0) % JOURS_ENVOI.length];
      return Math.min(cePourJour, Date.parse(`${addMonth(m, 1)}-${String(jour).padStart(2, '0')}T09:30:00Z`));
    };
    const pack = (m, definitif, manques, ca, rang) => ({
      month: m, label: monthLabel(m), definitive: definitif,
      receivedAt: recu(m, rang), generatedAt: new Date(recu(m, rang) - 75 * 60 * 1000).toISOString(),
      files: 14, missing: manques || [], absent: 0, digest: '', bytes: 180000, path: '', sealed: true, appVersion: '',
      figures: { ca: ca || 0, tvaCollectee: round3((ca || 0) * 0.19), tvaDeductible: round3((ca || 0) * 0.07),
        tvaADecaisser: round3((ca || 0) * 0.12), creditTva: 0, encaisse: round3((ca || 0) * 0.8), devise: 'DT' }
    });
    const d = (name, matricule, email, packs) => ({ id: 'MF:' + matricule.replace(/[^A-Z0-9]/gi, '').toUpperCase(), name, matricule, email, note: '', archived: false, packs, demo: true });
    // Trabelsi porte DOUZE mois depuis la 10.0.0 : la liasse porte sur un exercice, et un exemple
    // à trois mois montre un onglet Liasse tronqué — c'est-à-dire l'inverse de ce que cette
    // version doit démontrer. Les quatre autres dossiers gardent leur scénario : ce qu'ils
    // enseignent, c'est le RETARD, le provisoire et le client endormi, pas la production annuelle.
    const CA_ANNEE = [28450, 31200, 26980, 24310, 29740, 22860, 25120, 30480, 27310, 23990, 26640, 28120];
    return [
      d('Menuiserie Trabelsi SUARL', '1122334A/M/P/000', 'contact@trabelsi.tn',
        CA_ANNEE.map((ca, i) => pack(M(-(i + 1)), true, null, ca, 0))),
      d('Pharmacie El Menzah', '2233445B/A/M/000', 'pharmacie.menzah@example.tn',
        [pack(M(-4), true, null, 84300, 1), pack(M(-5), true, null, 79150, 1)]),    // deux mois de retard
      d('Studio Sfax Design', '3344556C/N/M/000', 'hello@sfaxdesign.tn',
        [pack(M(-1), false, null, 12400, 2), pack(M(-2), true, null, 15750, 2)]),   // dernier mois provisoire
      // Les deux VITRINES de la 10.12.0 (U-10) : un client sur SkanFact dont le cabinet rapproche la
      // banque et révise l'exercice, et le client hors SkanFact dont il tient les biens et la paie.
      // Le scénario les NOMME ; `exemple-vitrine.js` les remplit, par les vrais moteurs.
      { ...d('Transports Béji & Fils', '4455667D/P/M/000', '',
        [pack(M(-1), true, [{ id: 'justif', level: 'warn', label: 'achats sans justificatif joint', count: 6 }], 46800, 3),
         pack(M(-2), true, [{ id: 'brouillon', level: 'warn', label: 'factures restées en brouillon', count: 2 }], 44120, 3)]), vitrine: 'skanfact' },
      d('Café des Jasmins', '5566778E/C/M/000', 'jasmins@example.tn',
        [pack(M(-6), true, null, 9870, 4)]),                                        // parti ou endormi
      // Un client HORS SkanFact (10.0.0). Un cabinet a soixante clients dont deux sur SkanFact
      // (6.8.0) : un exemple qui ne montrerait que ceux qui envoient leurs paquets donnerait une
      // image fausse du portefeuille — et surtout, ce dossier-là est celui qui COMPTE dans la
      // licence. On ne lui réclame rien : il n'a rien promis d'envoyer.
      { ...d('Garage Ben Salem', '6677889F/G/M/000', '', []), manual: true, vitrine: 'hors',
        note: 'Client hors SkanFact : ses pièces arrivent sur papier. Le cabinet tient sa comptabilité à la main, dans la Saisie.' }
    ];
  }

  // ---------- l'exemple : recaler un paquet pré-calculé sur le mois courant (9.2.2) ----------
  //
  // Les journaux de l'exemple sont calculés une fois pour toutes par `scripts/exemple-cabinet.js`
  // (avec le moteur de l'app entreprise, que le Cabinet n'embarque pas) pour une date de référence
  // FIXE. Ici on les recale sur le mois demandé : chaque date glisse du même nombre de mois, le jour
  // est borné au mois d'arrivée (le 31 août ne devient pas un 31 février), et l'année des numéros
  // de pièce suit (« FAC-2026-022 » devient « FAC-2027-022 » quand le mois passe l'an). Les montants
  // ne bougent pas : les chiffres du manifeste restent ceux des écritures, au millime.
  //
  // Pure : les empreintes des fichiers, qui ont besoin de Node, sont posées par main.js.
  function rebaserPaquet(gabarit, cible) {
    const [ys, ms] = String(gabarit.mois).split('-').map(Number);
    const [yc, mc] = String(cible.mois).split('-').map(Number);
    const delta = (yc * 12 + mc) - (ys * 12 + ms);
    const dernierJour = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
    const glisser = (y, m) => { const t = y * 12 + (m - 1) + delta; return [Math.floor(t / 12), (t % 12) + 1]; };
    const jourBorne = (j, y2, m2) => pad2(Math.min(Number(j), dernierJour(y2, m2)));
    const recaler = texte => String(texte)
      // AAAA-MM-JJ (les JSON) : la date glisse, le jour se borne.
      .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y, m, j) => {
        const [y2, m2] = glisser(Number(y), Number(m));
        return `${y2}-${pad2(m2)}-${jourBorne(j, y2, m2)}`;
      })
      // JJ/MM/AAAA (les CSV, tels que l'app entreprise les écrit) : même règle.
      .replace(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g, (_, j, m, y) => {
        const [y2, m2] = glisser(Number(y), Number(m));
        return `${jourBorne(j, y2, m2)}/${pad2(m2)}/${y2}`;
      })
      // « juillet 2026 » dans un libellé (salaire, TVA du mois) : le nom du mois suit, sinon un
      // paquet de juin dirait « salaire juillet ».
      .replace(/\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) (\d{4})\b/gi, (_, nom, y) => {
        const i = MONTHS_FR.findIndex(x => x.toLowerCase() === nom.toLowerCase());
        if (i < 0) return `${nom} ${y}`;
        const [y2, m2] = glisser(Number(y), i + 1);
        const nom2 = MONTHS_FR[m2 - 1];
        return `${nom === nom.toLowerCase() ? nom2.toLowerCase() : nom2} ${y2}`;
      })
      // AAAA-MM seul (le mois d'un loyer, la période de la TVA) : le mois glisse.
      .replace(/\b(\d{4})-(\d{2})\b(?!-\d)/g, (_, y, m) => { const [y2, m2] = glisser(Number(y), Number(m)); return `${y2}-${pad2(m2)}`; })
      // Les numéros de pièce : l'année suit celle du mois d'arrivée.
      .replace(/\b([A-Z]{2,5})-(\d{4})-(\d{3,4})\b/g, (_, p, y, n) => `${p}-${Number(y) + (yc - ys)}-${n}`);
    const au = `${cible.mois}-${pad2(dernierJour(yc, mc))}`;
    const manifest = {
      ...gabarit.manifest,
      entreprise: { ...(cible.entreprise || {}) },
      periode: { mois: cible.mois, du: `${cible.mois}-01`, au, libelle: monthLabel(cible.mois) },
      definitif: !!cible.definitif,
      cloturéJusquAu: cible.definitif ? au : null,
      genereLe: cible.genereLe || null,
      versionApp: cible.versionApp || '',
      poste: 'poste-exemple',
      manques: (cible.manques || []).map(m => ({ id: m.id, niveau: m.niveau, quoi: m.quoi, combien: m.combien })),
      absents: [],
      fichiers: []
    };
    return { manifest, fichiers: (gabarit.fichiers || []).map(f => ({ chemin: f.chemin, texte: recaler(f.texte) })) };
  }

  // ---------- le calendrier des échéances ----------
  //
  // La vie d'un comptable, ce sont des dates. Mais une liste de dates, il en a déjà une. Ce que
  // SkanFact peut faire et que personne d'autre ne fait : rattacher chaque échéance aux paquets
  // qu'il n'a PAS reçus. « TVA d'août, à déposer le 28 septembre : douze clients concernés, trois
  // ne t'ont rien envoyé. » C'est ça qui vaut le détour.
  //
  // AUCUNE de ces dates n'est une vérité. Elles suivent l'usage tunisien, elles sont modifiables,
  // et l'écran écrit « À VÉRIFIER » — les délais dépendent de la forme juridique, du régime et de
  // la loi de finances de l'année.
  const DEFAULT_DEADLINES = { tvaDay: 28, cnssDay: 15 };

  // ---------- le calendrier par RÉGIME (F-9.6.0-12, livré en 10.0.0) ----------
  //
  // Le champ `regime` existe sur une fiche de dossier depuis la 6.8.0 et n'avait aucun lecteur :
  // le calendrier traitait tous les clients pareil, et un forfaitaire se voyait réclamer une TVA
  // qu'il ne dépose pas. La 9.6.0 avait laissé cette ligne de côté pour une bonne raison, écrite
  // alors : « les régimes à distinguer et les échéances de chacun sont une question au comptable
  // pilote ; les inventer serait écrire du droit que personne n'a confirmé ».
  //
  // Ce qui est livré ici n'écrit toujours AUCUN droit : la table part **vide**, et tant qu'elle
  // l'est, rien ne change à l'écran — exactement comme les collaborateurs (9.9.0) ou le
  // questionnaire (9.10.0). C'est le cabinet qui déclare SES régimes et ce que chacun dépose ;
  // SkanFact ne fait que l'appliquer. La valeur par défaut d'une règle qu'on ne connaît pas est
  // celle qui ne fait rien (9.1.1).
  const TVA_PERIODES = [
    { id: '', label: 'Comme le dossier le dit' },
    { id: 'mensuelle', label: 'TVA mensuelle' },
    { id: 'trimestrielle', label: 'TVA trimestrielle' },
    { id: 'aucune', label: 'Pas de TVA' }
  ];

  function migrateRegime(r) {
    return {
      id: String((r && r.id) || '').trim(),
      label: String((r && r.label) || '').trim(),
      tva: TVA_PERIODES.some(p => p.id && p.id === String(r && r.tva)) ? String(r.tva) : '',
      cnss: !(r && r.cnss === false),
      // Les échéances ANNUELLES propres à un régime : le cabinet les écrit lui-même, une par
      // ligne, avec son mois et son jour. Rien n'est proposé — ni date, ni nom.
      annuelles: (Array.isArray(r && r.annuelles) ? r.annuelles : []).map(a => ({
        id: String((a && a.id) || '').trim(),
        label: String((a && a.label) || '').trim(),
        // Un mois ABSENT (0, vide, illisible) reste 0 et la ligne est jetée : le ramener à janvier
        // inventerait une date que personne n'a donnée. Un mois hors bornes, lui, se BORNE — c'est
        // une faute de frappe sur une intention claire, pas une intention manquante.
        mois: Number(a && a.mois) >= 1 ? Math.min(12, Math.round(Number(a.mois))) : 0,
        jour: Number(a && a.jour) >= 1 ? Math.min(31, Math.round(Number(a.jour))) : 0
      })).filter(a => a.id && a.label && a.mois && a.jour)
    };
  }

  const regimes = state => ((state && state.settings && state.settings.regimes) || []).filter(r => r.id && r.label);
  const regimeDe = (state, dossier) => regimes(state).find(r => r.id === String((dossier && dossier.regime) || '')) || null;
  // Les régimes qu'une fiche de client peut PORTER : les trois de départ — sous le nom que le cabinet
  // leur a donné s'il les a déclarés —, puis chaque régime qu'il a écrit lui-même. Jusqu'à la 10.14.1,
  // la fiche ne proposait que les trois de départ : un régime ajouté par « Ajouter un régime » ne
  // pouvait être porté par AUCUN client, et ses règles ne servaient jamais (vu en déroulant la visite
  // des Réglages). Un régime que le dossier porte encore mais que les réglages ont retiré reste dans
  // la liste, nommé comme tel : une liste dont aucune option ne correspond retient la première, en
  // silence, et rouvrir la fiche changerait le régime du client (8.3.0).
  function choixRegimes(state, actuel) {
    const decl = regimes(state);
    const out = REGIMES.map(r => { const d = decl.find(x => x.id === r.id); return { id: r.id, label: d ? d.label : r.label }; });
    decl.forEach(d => { if (!out.some(x => x.id === d.id)) out.push({ id: d.id, label: d.label }); });
    const a = String(actuel || '');
    if (a && !out.some(x => x.id === a)) out.push({ id: a, label: a + ' (retiré des réglages)' });
    return out;
  }
  // Le régime dans une PHRASE (l'en-tête de la fiche) : « régime réel », jamais « régime Régime réel »
  // — le libellé d'une liste porte déjà le mot, parce qu'il s'y lit seul. La majuscule tombe au milieu
  // d'une phrase, sauf sur un sigle (« BNC » reste « BNC »).
  function regimeEnPhrase(label) {
    const l = String(label || '').trim();
    if (!l) return '';
    const bas = /^\p{Lu}\p{Ll}/u.test(l) ? l.charAt(0).toLowerCase() + l.slice(1) : l;
    return /^régime(\s|$)/i.test(l) ? bas : 'régime ' + bas;
  }

  // La périodicité de TVA qui s'applique VRAIMENT à un dossier : celle de son régime quand le
  // cabinet en a déclaré une, sinon celle posée sur sa fiche, sinon mensuelle. Le régime prime sur
  // un réglage oublié — même règle que `defaultVat` côté entreprise (7.22.0).
  function periodeTva(state, dossier) {
    const r = regimeDe(state, dossier);
    if (r && r.tva) return r.tva;
    return String((dossier && dossier.tvaPeriod) || '') || 'mensuelle';
  }
  const deposeCnss = (state, dossier) => { const r = regimeDe(state, dossier); return !r || r.cnss !== false; };

  const QUARTER_END = { 3: 1, 6: 2, 9: 3, 12: 4 };

  function deadlineSettings(state) {
    return { ...DEFAULT_DEADLINES, ...((state && state.settings && state.settings.deadlines) || {}) };
  }

  // Le jour J d'un mois, en date calendaire. Un mois plus court que le jour demandé ramène au
  // dernier jour : « le 31 » n'existe pas en février, et une échéance qui disparaît est pire
  // qu'une échéance approximative.
  function dayOf(month, day) {
    const [y, m] = String(month).split('-').map(Number);
    const dernier = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${month}-${pad2(Math.min(day, dernier))}`;
  }

  function echeances(state, todayIso, opts) {
    opts = opts || {};
    const t = todayIso || today();
    const cfg = deadlineSettings(state);
    const curMonth = t.slice(0, 7);
    const grace = Number((state.settings || {}).relanceDay) || 0;
    const avant = Number(opts.avant || 3);
    // On ne fabrique d'échéance que pour des mois TERMINÉS. Un calendrier qui réclame le mois en
    // cours et les trois suivants montre quatre cartes rouges sur cinq à un cabinet parfaitement à
    // jour — et c'est l'inverse de ce que dit `dossierMonths` dix lignes plus haut.
    const dernierMoisFini = addMonth(curMonth, -1);

    // Ce que chaque dossier doit VRAIMENT : `dossierMonths` connaît le début de mission, les clients
    // hors SkanFact et le mois de grâce. Les recalculer ici séparément, c'était se contredire d'un
    // écran à l'autre.
    const actifs = (state.dossiers || []).filter(d => !d.archived);
    const attendus = new Map();
    actifs.forEach(d => {
      const parMois = new Map(dossierMonths(d, t, grace).map(m => [m.month, m.state]));
      // Un dossier TENU AU CABINET (10.12.0, vu au test humain) : ses mois sont ceux de son LIVRE —
      // la MÊME fonction que la Production et le Suivi —, et ce qui lui manque n'est pas un paquet
      // à réclamer, c'est une saisie que le cabinet doit faire lui-même avant la date. Sans lui, le
      // calendrier comptait « sur 5 clients » un portefeuille de six : le garage de l'exemple, dont
      // le cabinet dépose lui-même la TVA, n'y figurait jamais — alors qu'un cabinet a soixante
      // clients dont deux sur SkanFact (6.8.0), et que ce sont ceux-là qu'il déclare.
      // 10.14.1 (MC-14) — TOUT dossier tenu, pas seulement celui dont on connaît déjà le livre : un
      // dossier créé ce matin avec un début de mission n'a encore aucun livre, et ses mois sont
      // précisément « à saisir ». Sans ça il retombait sur `dossierMonths` et se lisait « n'a pas
      // envoyé son mois » — la phrase d'un paquet qu'on ne lui a jamais demandé.
      if (d.manual) productionDuDossier(d, (opts.tenus || {})[d.id] || null, t, grace).forEach(m => parMois.set(m.mois, m.etape === 'saisi' ? 'a-saisir' : 'tenu'));
      attendus.set(d, parMois);
    });
    const concerne = (d, mois) => mois.some(m => attendus.get(d).has(m));

    const out = [];
    for (let k = avant; k >= 0; k--) {
      const mois = addMonth(dernierMoisFini, -k);
      const depot = addMonth(mois, 1);

      const mensuels = actifs.filter(d => periodeTva(state, d) === 'mensuelle' && concerne(d, [mois]));
      // « TVA de octobre » ne s'écrit pas : quatre mois sur douze commencent par une voyelle.
      if (mensuels.length) out.push(ligneEcheance('tva-m', `TVA ${de(monthLabel(mois))}`, dayOf(depot, cfg.tvaDay), mois, mensuels, t, attendus,
        'Déclaration mensuelle de TVA. Les clients dont tu n\'as pas le mois ne peuvent pas être déclarés.'));

      const [, mm] = mois.split('-').map(Number);
      if (QUARTER_END[mm]) {
        const trim = QUARTER_END[mm];
        const moisTrim = [addMonth(mois, -2), addMonth(mois, -1), mois];
        const trimestriels = actifs.filter(d => periodeTva(state, d) === 'trimestrielle' && concerne(d, moisTrim));
        if (trimestriels.length) out.push(ligneEcheance('tva-t', `TVA du ${trim}ᵉ trimestre`, dayOf(depot, cfg.tvaDay), moisTrim, trimestriels, t, attendus,
          'Déclaration trimestrielle de TVA. Il te faut les trois mois du trimestre.'));
        // 10.12.0 (U-21) — la CNSS ne vise que les EMPLOYEURS, d'après ce que leur livre sait
        // (`moisEmployeur`, lu dans les index). « SkanFact ne sait pas lesquels : à toi de filtrer »
        // se lisait pendant que la Paie connaissait les salariés. Un client ne sort de la liste que
        // sur un trimestre ENTIÈREMENT saisi sans une ligne de personnel ; sans livre ou sur un
        // trimestre incomplet il reste compté, par prudence, et la carte le DIT — ne pas savoir
        // n'est pas « non » (règle 9.6.0), et une CNSS oubliée coûte plus qu'un rappel de trop.
        const employeurDe = d => {
          const m = ((opts.employeurs || {})[d.id]) || {};
          const vus = moisTrim.map(x => m[x]).filter(x => typeof x === 'boolean');
          return vus.some(Boolean) ? true : vus.length === moisTrim.length ? false : null;
        };
        const employeurs = actifs.filter(d => deposeCnss(state, d) && concerne(d, moisTrim) && employeurDe(d) !== false);
        const inconnus = employeurs.filter(d => employeurDe(d) === null).length;
        // La phrase suit ce qui est SU : « leur Paie le dit » ne s'écrit pas au-dessus de clients
        // qui sont tous comptés faute de savoir (trouvé en testant comme un humain).
        const connus = employeurs.length - inconnus;
        const prudence = `${pl(inconnus, 'client')} dont le trimestre n'est pas encore saisi ici ${inconnus > 1 ? 'sont comptés' : 'est compté'} par prudence`;
        if (employeurs.length) out.push(ligneEcheance('cnss', `CNSS du ${trim}ᵉ trimestre`, dayOf(depot, cfg.cnssDay), moisTrim, employeurs, t, attendus,
          !inconnus ? 'Déclaration sociale trimestrielle des clients employeurs : leur Paie ou leurs comptes de rémunération le disent.'
            : !connus ? `Déclaration sociale trimestrielle des clients employeurs. ${inconnus > 1 ? `Le trimestre de ces ${inconnus} clients n'est pas encore saisi ici : ils sont comptés` : 'Le trimestre de ce client n\'est pas encore saisi ici : il est compté'} par prudence.`
              : `Déclaration sociale trimestrielle des clients employeurs : ${pl(connus, 'client')} d'après ${connus > 1 ? 'leur Paie ou leurs comptes' : 'sa Paie ou ses comptes'} de rémunération, et ${prudence}.`));
      }
    }
    // Les échéances ANNUELLES déclarées par le cabinet, régime par régime. Elles portent sur
    // l'exercice écoulé : ce qui se dépose en 2027 concerne 2026. Aucune n'existe tant que le
    // cabinet n'en a pas écrit une — la table part vide, exprès.
    regimes(state).forEach(r => {
      const concernes = actifs.filter(d => String(d.regime || '') === r.id);
      if (!concernes.length) return;
      (r.annuelles || []).forEach(a => {
        // Deux occurrences : celle de cette année et celle de l'an prochain. La borne qui suit
        // ne garde que ce qui est utile — l'échéance qu'on vient de passer (jusqu'à deux mois) et
        // celle qui vient. Sans les DEUX années, une échéance d'avril disparaîtrait du calendrier
        // dès le mois de juin pour n'y revenir qu'au 1er janvier.
        [0, 1].forEach(decal => {
          const an = Number(t.slice(0, 4)) + decal;
          const date = dayOf(`${an}-${pad2(a.mois)}`, a.jour);
          const exercice = an - 1;
          const moisEx = Array.from({ length: 12 }, (_, i) => `${exercice}-${pad2(i + 1)}`);
          const jours = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(t + 'T00:00:00Z')) / 86400000);
          if (jours < -60 || jours > 366) return;
          out.push(ligneEcheance(`an-${r.id}-${a.id}`, `${a.label} ${exercice}`, date, moisEx, concernes, t, attendus,
            `Échéance annuelle que tu as déclarée pour le régime « ${r.label} ». Elle porte sur l'exercice ${exercice}.`));
        });
      });
    });
    return out
      .filter(e => e.clients > 0)
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : parNom(a.label, b.label));
  }

  // La clé d'une occurrence : la RÈGLE et sa DATE. Elle vit ici, pas dans l'écran, parce que le
  // pointage et la lecture du pointage doivent la fabriquer pareil — deux versions divergeraient au
  // premier changement de format, et un dépôt pointé cesserait d'être reconnu sans rien dire.
  const cleEcheance = e => `${(e || {}).id || ''}@${(e || {}).date || ''}`;
  const echeanceDeposee = (state, e) =>
    ((((state || {}).settings || {}).depots) || []).includes(cleEcheance(e));

  function ligneEcheance(id, label, date, mois, dossiers, todayIso, attendus, detail) {
    const liste = Array.isArray(mois) ? mois : [mois];
    // `aSaisir` : les dossiers tenus au cabinet dont un mois n'a encore aucune écriture (10.12.0).
    // Jamais mêlés aux `manquants` : un manquant se RELANCE, un mois à saisir se saisit — relancer
    // un client qui n'envoie rien serait la faute que la 10.12.0 a retirée du livre.
    const manquants = [], provisoires = [], aSaisir = [], aSaisirIds = [];
    dossiers.forEach(d => {
      // Un mois qui n'est pas attendu de ce client (avant son début de mission) n'est pas un manque.
      const etats = liste.map(m => attendus.get(d).get(m)).filter(Boolean);
      if (!etats.length) return;
      if (etats.some(e => e === 'manquant')) manquants.push(d.name);
      else if (etats.some(e => e === 'a-saisir')) { aSaisir.push(d.name); aSaisirIds.push(d.id); }
      else if (etats.some(e => e === 'provisoire')) provisoires.push(d.name);
    });
    const jours = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(todayIso + 'T00:00:00Z')) / 86400000);
    const clients = dossiers.length;
    const bloques = manquants.length + aSaisir.length;
    return {
      id, label, date, detail, mois: liste,
      clients, manquants, provisoires, aSaisir, aSaisirIds,
      prets: clients - manquants.length - provisoires.length - aSaisir.length,
      jours, passee: jours < 0,
      // Ce qui décide de la couleur : une échéance proche avec des pièces qui manquent est le seul
      // cas vraiment urgent. Une échéance proche mais complète n'a pas à crier. Un mois qu'on doit
      // encore saisir soi-même bloque la déclaration autant qu'un paquet qui n'est pas arrivé.
      level: bloques && jours <= 10 ? 'danger' : bloques ? 'warn' : jours <= 3 && jours >= 0 ? 'warn' : 'ok'
    };
  }

  // ---------- regrouper les écritures ----------
  //
  // Chaque paquet porte son `journaux/ecritures.csv`, déjà en partie double. Mais rien ne les
  // rassemblait : pour importer un mois dans son logiciel de production, le comptable devait ouvrir
  // soixante paquets un par un — exactement le travail qu'on prétend lui épargner.
  //
  // Un lecteur de CSV honnête : point-virgule, guillemets doublés, retours à la ligne dans les
  // champs. Écrire le sien plutôt que découper sur « ; » n'est pas un luxe : un libellé de facture
  // contient un point-virgule un jour sur dix, et la ligne partirait en morceaux sans rien signaler.
  function parseCsv(text) {
    const s = String(text || '').replace(/^﻿/, '');
    const rows = [];
    let ligne = [], champ = '', i = 0, guill = false;
    while (i < s.length) {
      const c = s[i];
      if (guill) {
        if (c === '"') {
          if (s[i + 1] === '"') { champ += '"'; i += 2; continue; }
          guill = false; i++; continue;
        }
        champ += c; i++; continue;
      }
      if (c === '"') { guill = true; i++; continue; }
      if (c === ';') { ligne.push(champ); champ = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { ligne.push(champ); rows.push(ligne); ligne = []; champ = ''; i++; continue; }
      champ += c; i++;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); rows.push(ligne); }
    return rows.filter(r => r.length > 1 || (r[0] || '').trim() !== '');
  }

  // La parade à l'injection de formule CSV (9.1.1). Corps IDENTIQUE à celui de
  // `src/renderer/compta.js` — un test l'exige, comme pour `round3` : ce fichier ne charge pas
  // compta.js (il est requis par `main.js`, par le renderer et par les tests, sans dépendance), et
  // deux parades qui divergent, c'est celle qu'on a oubliée qui laisse passer.
  //
  // Ici c'est plus grave qu'ailleurs : les cellules viennent des paquets de SOIXANTE clients
  // différents, recollées dans un seul fichier que le comptable ouvre dans son tableur.
  function csvDangereux(cellule) {
    return /^[=+\-@\t\r]/.test(cellule);
  }

  // Ici, et ici seulement, l'exception numérique. Le cabinet n'a pas de types de colonnes : ses
  // cellules arrivent DÉJÀ MISES EN FORME, lues dans les CSV des paquets de ses clients. Un
  // `-12,500` y est un montant et il n'existe aucun autre moyen de le savoir ; sans cette ligne,
  // chaque montant négatif du fichier fusionné partirait préfixé d'une apostrophe et le comptable
  // ne pourrait plus additionner une seule colonne.
  //
  // Elle n'a pas sa place dans `csvDangereux` : là où les types existent (`core.toCsv`), c'est la
  // colonne qui décide, et un texte qui ressemble à un nombre — un téléphone — doit être protégé.
  const estNombreCsv = cellule => /^[-+]?[\d\s]*[.,]?\d+$/.test(cellule);

  // ---------------------------------------------------------------- l'origine d'un paquet (9.2.0)
  //
  // La DÉCISION, pure et testable : que fait-on d'un paquet selon ce que sa signature vaut et ce
  // que le dossier sait déjà ? `main.js` se contente de vérifier la signature (crypto) et
  // d'appliquer ce verdict — la règle, elle, vit ici, où elle se prouve sans Electron.
  //
  // Les quatre cas, et pourquoi chacun est ce qu'il est :
  //
  //   1. **Pas de signature, dossier sans clé épinglée** → accepté, « origine non prouvée ». C'est
  //      le paquet d'un client encore en 9.1.x : le refuser couperait tous les clients d'un coup le
  //      jour de la mise à jour du cabinet. On le dit en gris, on ne crie pas.
  //   2. **Pas de signature, dossier AVEC clé épinglée** → REFUSÉ. Confiance au premier usage : une
  //      fois qu'un client a signé, ne plus signer est soit une régression, soit quelqu'un d'autre.
  //      La tolérance du cas 1 s'éteint donc d'elle-même, client par client, sans date butoir.
  //   3. **Signature valable, dossier sans clé** → on ÉPINGLE. C'est le premier paquet signé : sa
  //      clé devient celle de ce client, et tout ce qui suivra sera comparé à elle.
  //   4. **Signature valable, mais une AUTRE clé** → refusé en nommant les deux empreintes. Un
  //      client qui réinstalle sans son dossier change de clé : c'est légitime, et c'est justement
  //      pour ça que la reprise passe par un geste humain (l'empreinte dictée au téléphone), jamais
  //      par une acceptation automatique — sinon la vérification ne vérifierait plus rien.
  function verdictOrigine(dossier, signature) {
    const epinglee = (dossier && dossier.cleEmpreinte) || '';
    const s = signature || null;
    if (!s) {
      return epinglee
        ? { ok: false, etat: 'signature-manquante', code: 'ERR-CAB-031',
            texte: 'Ce paquet n\'est pas signé, alors que les précédents de ce client l\'étaient. Demande-lui de mettre SkanFact à jour — ou, s\'il a réinstallé l\'application, accepte sa nouvelle clé après l\'avoir vérifiée avec lui.' }
        : { ok: true, etat: 'non-prouvee', epingler: null,
            texte: 'Origine non prouvée : ce paquet vient d\'une version de SkanFact antérieure à la 9.2.0.' };
    }
    if (!s.ok) {
      return { ok: false, etat: s.motif || 'signature-fausse',
        code: s.motif === 'manifeste-modifie' ? 'ERR-CAB-032' : 'ERR-CAB-032',
        texte: s.texte || 'La signature de ce paquet n\'est pas valable.' };
    }
    if (!epinglee) {
      return { ok: true, etat: 'epinglee', epingler: s.cle, empreinte: s.empreinte,
        texte: `Signature enregistrée pour ce client : ${s.empreinte}. Les prochains paquets seront comparés à elle.` };
    }
    if (epinglee !== s.empreinte) {
      return { ok: false, etat: 'autre-cle', code: 'ERR-CAB-030',
        attendue: epinglee, recue: s.empreinte,
        texte: `Ce paquet est signé par une autre clé que celle de ce dossier.\nAttendue : ${epinglee}\nReçue : ${s.empreinte}\nSi ton client a réinstallé SkanFact, vérifie cette empreinte avec lui de vive voix avant d'accepter sa nouvelle clé.` };
    }
    return { ok: true, etat: 'signe', empreinte: s.empreinte, epingler: null, texte: `Signé par le client (${s.empreinte}).` };
  }

  function toCsvLine(cells) {
    return cells.map(v => {
      let t = String(v == null ? '' : v);
      if (csvDangereux(t) && !estNombreCsv(t)) t = '\'' + t;
      return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    }).join(';');
  }

  // Fusionner les écritures de plusieurs paquets en un seul fichier, avec le client en tête de
  // chaque ligne. Les colonnes sont associées PAR NOM, pas par position : un paquet fabriqué par une
  // version plus ancienne ou plus récente de SkanFact n'a pas forcément les mêmes, et aligner à
  // l'aveugle mettrait des montants dans la colonne « Tiers » sans que rien ne plante.
  function mergeEcritures(sources) {
    const colonnes = [];
    const lues = [];
    (sources || []).forEach(src => {
      const rows = parseCsv(src.csv);
      if (rows.length < 2) return lues.push({ ...src, lignes: [], vide: true });
      const entete = rows[0].map(x => String(x).trim());
      entete.forEach(c => { if (c && !colonnes.includes(c)) colonnes.push(c); });
      const lignes = rows.slice(1).map(r => {
        const o = {};
        entete.forEach((c, i) => { if (c) o[c] = r[i] == null ? '' : r[i]; });
        return o;
      });
      lues.push({ ...src, lignes });
    });
    const tete = ['Client', 'Matricule', 'Mois'].concat(colonnes);
    const corps = [];
    lues.forEach(src => {
      (src.lignes || []).forEach(o => {
        corps.push(toCsvLine([src.name || '', src.matricule || '', src.month || ''].concat(colonnes.map(c => o[c] == null ? '' : o[c]))));
      });
    });
    return {
      // Le BOM : sans lui, Excel en français lit « Société » comme « SociÃ©tÃ© ».
      csv: '﻿' + [toCsvLine(tete)].concat(corps).join('\r\n') + '\r\n',
      lignes: corps.length,
      dossiers: lues.filter(s => (s.lignes || []).length).length,
      vides: lues.filter(s => !(s.lignes || []).length).map(s => `${s.name} (${monthLabel(s.month)})`)
    };
  }

  // Quels paquets lire pour une période donnée. Pur : l'interface montre ce qui partira AVANT de
  // fabriquer quoi que ce soit, et le processus principal se contente d'exécuter.
  function ecrituresPlan(state, opts) {
    opts = opts || {};
    const du = opts.from || opts.month || '';
    const au = opts.to || opts.month || du;
    const ids = opts.ids && opts.ids.length ? new Set(opts.ids) : null;
    const pris = [], sansPaquet = [];
    (state.dossiers || []).forEach(d => {
      // Il n'y a plus de garde « d.demo » ici, et c'est un correctif, pas un oubli. Elle datait de
      // la 6.8.0, où l'exemple n'avait aucun fichier sur le disque : l'exclure était juste. Depuis
      // la 9.2.2 il livre de VRAIS `.skanpack`, et la garde a fabriqué une contradiction que
      // personne n'a vue — `moisDisponibles()` proposait les mois de l'exemple, `ecrituresPlan` les
      // sautait, et la page Écritures s'ouvrait sur quatre zéros et un bouton éteint en annonçant
      // « Aucun paquet sur cette période » pour une période qu'elle venait elle-même de proposer.
      // Ce qui décide reste `p.path` : ce qui a un fichier s'exporte, ce qui n'en a pas ne s'exporte
      // pas — un seul critère, le même pour tout le monde.
      if (ids && !ids.has(d.id)) return;
      const dans = (d.packs || []).filter(p => p.path && (!du || (p.month >= du && p.month <= au)))
        .sort((a, b) => a.month < b.month ? -1 : 1);
      // `sansPaquet` nomme les clients à qui il manque quelque chose : un dossier d'exemple n'y entre
      // jamais, même sans fichier. On ne reproche rien à un client qui n'existe pas — c'est la règle
      // « on ne réclame pas le néant » (Cabinet 1.0.0), et c'est la SEULE chose que l'étiquette
      // `demo` décide ici ; ce qui entre dans l'export, lui, se décide sur le fichier.
      if (!dans.length) { if (!d.manual && !d.archived && !d.demo) sansPaquet.push(d.name); return; }
      dans.forEach(p => pris.push({
        id: d.id, name: d.name, matricule: d.matricule, month: p.month,
        path: p.path, definitive: !!p.definitive, sealed: !!p.sealed
      }));
    });
    pris.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : parNom(a.name, b.name)));
    return {
      packs: pris, sansPaquet,
      mois: [...new Set(pris.map(p => p.month))],
      provisoires: pris.filter(p => !p.definitive).map(p => `${p.name} (${monthLabel(p.month)})`)
    };
  }

  // Les mois d'une période sans la moindre pièce — jamais le mois en cours, jamais l'avenir
  // (Cabinet 1.0.0 : « le mois en cours n'est jamais réclamé »). UNE fonction pour les deux états
  // d'un dossier (T-47) : lu dans ses paquets, il annonçait « 9 mois manquants » sur un exercice
  // dont quatre mois n'étaient pas encore arrivés, et « 5 » une minute plus tard, avec un livre.
  // Un compteur et la liste qu'il annonce se calculent avec la même fonction (6.8.1).
  function moisManquants(vus, du, au, aujourdhui) {
    const d = String(du || '').slice(0, 7), a = String(au || '').slice(0, 7);
    const out = [];
    if (d.length !== 7 || a.length !== 7) return out;
    const dernier = addMonth(String(aujourdhui || today()).slice(0, 7), -1);
    const fin = a < dernier ? a : dernier;
    const v = new Set([...(vus || [])].map(m => String(m || '').slice(0, 7)));
    let m = d;
    for (let garde = 0; garde < 120 && m <= fin; garde++) {
      if (!v.has(m)) out.push(m);
      m = addMonth(m, 1);
    }
    return out;
  }

  // ---------- le canal d'essai, sans le fournisseur GitHub d'electron-updater (9.8.8-beta.2) ----------
  //
  // Le fournisseur GitHub d'electron-updater ne connaît que DEUX canaux de préversion, « alpha » et
  // « beta » : un tag `v9.8.8-beta.1` porte le canal « beta », et une application dont le canal est
  // `cabinet-beta` ne trouve donc jamais rien (« No published versions on GitHub »). Et si elle
  // trouvait, elle irait chercher `beta-mac.yml` — l'index de l'app ENTREPRISE. Le Cabinet choisit
  // donc lui-même la release qui porte son index, puis laisse le fournisseur GÉNÉRIQUE lire cette
  // page. La règle est la même que celle du relais (`releaseAdmissible`) : un brouillon ne sert
  // rien, et un index STABLE ne vient jamais d'une préversion — c'est l'accident de la 9.8.8-beta.1.
  const INDEX_STABLES = ['cabinet.yml', 'cabinet-mac.yml', 'cabinet-linux.yml', 'latest.yml', 'latest-mac.yml', 'latest-linux.yml'];

  // Le nom de l'index qu'electron-updater demandera pour ce canal sur cette plateforme
  // (`getChannelFilename` : `-mac` sur macOS, `-linux` sur Linux, rien sur Windows).
  function nomIndex(canal, plateforme) {
    const suffixe = plateforme === 'darwin' ? '-mac' : plateforme === 'linux' ? '-linux' : '';
    return `${canal}${suffixe}.yml`;
  }

  // La première release (l'API les rend de la plus récente à la plus ancienne) qui porte ce fichier
  // et a le droit de le servir. `null` si aucune : c'est « pas encore de version d'essai », pas une panne.
  function releasePourIndex(releases, fichier) {
    const stable = INDEX_STABLES.includes(String(fichier || ''));
    for (const rel of Array.isArray(releases) ? releases : []) {
      if (!rel || rel.draft) continue;
      if (rel.prerelease && stable) continue;
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      if (assets.some(a => a && a.name === fichier)) return { tag: String(rel.tag_name || ''), prerelease: !!rel.prerelease };
    }
    return null;
  }

  // La même règle, sans croire la LISTE (23/09/2026, jumelle de `trouveDans` dans le relais) : la
  // liste des releases de l'API GitHub a rendu la 10.10.0 SANS aucun fichier, selon le serveur qui
  // répondait, une heure après sa publication. On relit une release qui paraît vide de ce fichier
  // avant de passer à la suivante — trois au plus. `relire(rel)` rend ses fichiers, ou `null`.
  async function releasePourIndexRelue(releases, fichier, relire, max = 3) {
    const stable = INDEX_STABLES.includes(String(fichier || ''));
    let relues = 0;
    for (const rel of Array.isArray(releases) ? releases : []) {
      if (!rel || rel.draft) continue;
      if (rel.prerelease && stable) continue;
      let assets = Array.isArray(rel.assets) ? rel.assets : [];
      if (!assets.some(a => a && a.name === fichier) && relire && relues < max) {
        relues++;
        const frais = await relire(rel);
        if (Array.isArray(frais)) assets = frais;
      }
      if (assets.some(a => a && a.name === fichier)) return { tag: String(rel.tag_name || ''), prerelease: !!rel.prerelease };
    }
    return null;
  }

  // 10.14.0 (l'assistant, jusqu'au bout) — le fichier d'appairage PART. Il s'enregistrait sur le disque
  // et l'écran disait « envoie-le à tes clients » : il fallait écrire soi-même le mail, retrouver les
  // soixante adresses, et expliquer où cliquer dans une application qu'on n'utilise pas. Le message se
  // prépare ici — pur et testé — et le comptable n'a plus qu'à joindre le fichier et envoyer.
  // Les destinataires : les VRAIS dossiers (jamais l'exemple), non archivés, qui ont une adresse — en
  // copie cachée, parce qu'un client n'a pas à lire la liste des autres. Le message dit quoi faire à
  // celui qui n'utilise pas SkanFact : rien.
  // Vouvoiement : c'est le comptable qui écrit à ses clients (comme `relanceMail`).
  // Deux comptes, qui ne disent pas la même chose : les CLIENTS qui ont une adresse (ce que l'écran
  // annonce avant l'envoi) et les ADRESSES distinctes (ce qui part en copie cachée) — deux dossiers
  // d'un même groupe partagent souvent la même boîte, et un seul message y suffit.
  function mailAppairage(cabinet, dossiers, empreinte, nomFichier) {
    const cab = cabinet || {};
    const reels = (dossiers || []).filter(d => !d.demo && !d.archived);
    const adresse = d => String(d.email || '').trim().toLowerCase();
    const valide = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const bcc = [...new Set(reels.map(adresse).filter(valide))];
    const nom = String(cab.name || '').trim();
    const fichier = nomFichier || 'le fichier joint';
    const subject = `Vos envois ${nom ? 'à ' + nom : 'à votre cabinet'} : un fichier à importer une fois dans SkanFact`;
    const body = 'Bonjour,\n\n'
      + `Pour m'envoyer votre comptabilité chaque mois depuis SkanFact, importez une seule fois le fichier joint (« ${fichier} ») : `
      + 'dans SkanFact, « Paramètres → Envois → Ton cabinet comptable », puis « Importer le fichier du cabinet… ».\n\n'
      + `SkanFact vous montre alors une empreinte. Elle doit être exactement celle-ci : ${empreinte || '—'}\n`
      + 'Si elle est différente, n\'allez pas plus loin et appelez-moi.\n\n'
      + 'Ensuite, vos paquets mensuels me parviennent chiffrés pour moi seul : plus aucun mot de passe à échanger.\n\n'
      + 'Vous n\'utilisez pas SkanFact ? Ne tenez pas compte de ce message : rien ne change pour vous.\n\n'
      + `Bien à vous,\n${nom}`;
    const avecAdresse = reels.filter(d => valide(adresse(d))).length;
    return { subject, body, bcc, avecAdresse, sansAdresse: reels.length - avecAdresse };
  }

  // Un lien `mailto:` a une LONGUEUR qui ne se voit pas : au-delà d'environ deux mille caractères,
  // Windows (et Outlook) le coupent ou ne l'ouvrent pas du tout — sans une erreur. Soixante adresses
  // en copie cachée et un message accentué (chaque « é » devient « %C3%A9 ») dépassent vite. Les
  // adresses entrent dans le lien seulement s'il tient ; sinon le lien part sans elles, et l'appelant
  // les met dans le presse-papiers en le DISANT. Le message, lui, part toujours.
  const LIMITE_MAILTO = 2000;
  function mailtoUrl(m, limite) {
    const o = m || {};
    const max = limite || LIMITE_MAILTO;
    const params = t => ['subject=' + encodeURIComponent(o.subject || ''), 'body=' + encodeURIComponent(o.body || '')]
      .concat(t && (o.bcc || []).length ? ['bcc=' + (o.bcc || []).map(encodeURIComponent).join(',')] : []).join('&');
    const avec = `mailto:${encodeURIComponent(o.to || '')}?${params(true)}`;
    if (!(o.bcc || []).length || avec.length <= max) return { url: avec, bccInclus: (o.bcc || []).length > 0 };
    return { url: `mailto:${encodeURIComponent(o.to || '')}?${params(false)}`, bccInclus: false };
  }

  // Le fichier d'appairage remis aux clients. Il ne contient QUE la clé publique : rien de secret,
  // mais tout ce qu'il faut pour que leurs paquets n'appartiennent qu'à ce cabinet.
  function pairingFile(cabinet, fingerprint) {
    return {
      format: FORMAT, kind: 'cabinet',
      name: cabinet.name || '', email: cabinet.email || '',
      publicKey: cabinet.publicKey || '', fingerprint: fingerprint || ''
    };
  }

  // 10.12.0 (U-07) — la palette connaît la comptabilité. « balance » rendait « Rien ne correspond. » :
  // elle ne cherchait que des clients, six pages et les panneaux des Réglages, alors que le comptable
  // passe ses journées dans les quatorze écrans d'un dossier. Chaque mot de la recherche désigne soit
  // un ÉCRAN (un mot de trois lettres au moins qui commence un mot de son libellé ou de ses
  // synonymes : « rappro » → Banque, « tva » → Déclaration), soit un CLIENT (tout le reste :
  // « béji balance »). Rend des couples { dossierId, dossierNom, ecran }, le dossier OUVERT d'abord,
  // puis les clients nommés — ou tout le portefeuille quand aucun client n'est nommé et qu'aucun
  // dossier n'est ouvert. Pure : l'écran ne fait qu'afficher et naviguer.
  //   ecrans   : { cle: { label, mots } } — la table de l'écran, jamais recopiée ici
  //   dossiers : [{ id, name, matricule, archived }]
  function paletteCompta(q, ecrans, dossiers, courantId, max) {
    const plafond = max || 8;
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    const cles = Object.keys(ecrans || {});
    const jetons = c => sansAccents(`${ecrans[c].label} ${ecrans[c].mots || ''}`).split(/[\s'’-]+/).filter(Boolean);
    const designe = (m, c) => m.length >= 3 && jetons(c).some(t => t.startsWith(m));
    const motsEcran = mots.filter(m => cles.some(c => designe(m, c)));
    if (!motsEcran.length) return [];
    const vues = cles.filter(c => motsEcran.every(m => designe(m, c)));
    if (!vues.length) return [];
    const motsClient = mots.filter(m => !motsEcran.includes(m));
    const actifs = (dossiers || []).filter(d => d && d.id && !d.archived);
    const nomme = d => motsClient.every(m => sansAccents(`${d.name || ''} ${d.matricule || ''}`).includes(m));
    const courant = actifs.find(d => d.id === courantId);
    let clients = motsClient.length ? actifs.filter(nomme) : (courant ? [courant] : actifs);
    // Le dossier ouvert passe devant : c'est de lui qu'on parle quand on tape « balance » sur sa fiche.
    clients = clients.slice().sort((a, b) => (b.id === courantId) - (a.id === courantId)
      || parNom(a.name, b.name));
    const out = [];
    for (const d of clients) {
      for (const c of vues) {
        if (out.length >= plafond) return out;
        out.push({ dossierId: d.id, dossierNom: d.name || '', ecran: c, courant: d.id === courantId });
      }
    }
    return out;
  }

  return {
    nbFr,
    parNom,
    mailAppairage, mailtoUrl, LIMITE_MAILTO,
    FORMAT, MONTHS_FR, DEFAULT_STATE, DEFAULT_SETTINGS, DEFAULT_SAISIE, TVA_PERIODS, REGIMES, RELANCE_WAYS, SORTS,
    sansAccents, paletteCompta,
    guidesDuDossier, correspondanceDuDossier, dateTapee,
    GRACE_MOIS, DORMANT_MOIS, dossierFacturable, comptageDossiers, licenceDuPaquet,
    monthLabel, moisTape, moisAffiche, monthListLabel, missingLabel, addMonth, monthsBetween, moisDeTravail, today, de, libelleLot,
    cleEcheance, echeanceDeposee,
    migrate, migrateDossier, dossierKey, packSummary, filePack, demoDossiers, rebaserPaquet, checkIntegrity, HORS_MANIFESTE,
    justificatifsDuPaquet, justificatifsDeLigne,
    exemplePerime, verdictMotDePasse,
    newDossier, parseDossierLines, noteRelance, portfolio, caDuPortefeuille, relanceDue, relanceRows, accuseMail,
    parseCsv, verdictOrigine, csvDangereux, toCsvLine, mergeEcritures, ecrituresPlan,
    DEFAULT_DEADLINES, deadlineSettings, echeances, dayOf,
    TVA_PERIODES, migrateRegime, regimes, regimeDe, choixRegimes, regimeEnPhrase, periodeTva, deposeCnss,
    dossierMonths, debutDeMission, dossierRow, dossierList, cabinetTodo, premiersPas, relanceMail, pairingFile,
    INDEX_STABLES, nomIndex, releasePourIndex, releasePourIndexRelue, moisManquants,
    // Le cabinet à plusieurs (9.9.0)
    ROLES_COLLAB, RANG_ROLE, LIBELLE_ROLE, DETAIL_ROLE, ETAPES_PRODUCTION,
    migrateCollaborateur, collaborateurs, collaborateurDe, collaborateurValide,
    roleSurDossier, peut, peutGererCollaborateurs, dossiersConfies, CHEMIN_EQUIPE, roleProposeCollab,
    productionDuDossier, production
  };
}));
