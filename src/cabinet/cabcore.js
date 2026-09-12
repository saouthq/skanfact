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
  const pl = (n, un, plur) => `${n} ${n > 1 ? (plur || un + 's') : un}`;
  const round3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
  function monthLabel(m) {
    const [y, mm] = String(m || '').split('-').map(Number);
    return (MONTHS_FR[mm - 1] || '?') + ' ' + (y || '?');
  }
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
  const DEFAULT_SETTINGS = { relanceDay: 10, deadlines: null };
  const DEFAULT_STATE = { format: FORMAT, cabinet: { name: '', email: '', phone: '', publicKey: '', privateKey: '' }, dossiers: [], settings: { ...DEFAULT_SETTINGS } };

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
      packs: Array.isArray(d.packs) ? d.packs : []
    };
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
    s.dossiers = Array.isArray(s.dossiers) ? s.dossiers.map(migrateDossier) : [];
    s.format = FORMAT;
    return s;
  }

  // L'identité d'un dossier vient du MATRICULE FISCAL quand il existe : c'est le seul identifiant
  // stable d'une entreprise. Un nom se corrige, se raccourcit, change de forme juridique — et deux
  // clients peuvent s'appeler « Ben Ali ». Sans matricule, on retombe sur le nom normalisé.
  // Garder TOUTES les lettres, pas seulement l'alphabet latin. « شركة الأمان » et « مخبزة الياسمين »
  // donnaient tous deux la clé vide « NOM: » : dans un portefeuille tunisien, tous les clients dont
  // la raison sociale est en arabe tombaient dans un SEUL dossier, et leurs paquets s'écrasaient les
  // uns les autres. Un cabinet de Sfax qui colle ses soixante clients en aurait perdu la moitié.
  const sansAccents = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function normNom(s) {
    return String(s || '').normalize('NFKC').normalize('NFD').replace(/[̀-ͯ]/g, '')
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

  // Vérifier ce qu'annonce le manifeste contre ce qu'on a réellement reçu. `hashes` est un objet
  // { chemin: empreinte } calculé par le processus principal (le calcul, lui, a besoin de Node).
  // C'est la seule affirmation rigoureuse de cette application : « ce que j'ai reçu est exactement
  // ce qui a été envoyé ». Elle doit donc compter juste — le manifeste ne se liste pas lui-même,
  // et un fichier absent n'est pas un fichier vérifié.
  function checkIntegrity(manifest, hashes) {
    const bad = [];
    let checked = 0;
    ((manifest && manifest.fichiers) || []).forEach(f => {
      if (f.chemin === 'manifeste.json') return;
      const h = hashes && Object.prototype.hasOwnProperty.call(hashes, f.chemin) ? hashes[f.chemin] : null;
      if (h == null) return bad.push(f.chemin + ' (absent)');
      checked++;
      if (h !== f.empreinte) bad.push(f.chemin + ' (modifié)');
    });
    return { checked, bad, ok: bad.length === 0 };
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
    if (dossier.manual && !dossier.from) return [];
    const got = (dossier.packs || []).slice().sort((a, b) => a.month < b.month ? -1 : 1);
    // `from` est la date de début de mission, saisie par le comptable. C'est le seul moyen de dire
    // « je reprends ce client à partir de janvier » : sans elle, l'attente démarre au premier paquet
    // reçu et les mois d'avant ne sont jamais réclamés — un client repris en cours d'année passait
    // à travers sans que rien ne l'annonce.
    if (!got.length && !dossier.from) return [];
    const last = addMonth(curMonth, -1);                    // le mois en cours n'est jamais attendu
    // Une date de début de mission sans plancher fait réclamer vingt ans périmés — et le rabot de
    // `monthsBetween` coupe par la FIN, donc les mois réellement en retard disparaissent de la liste
    // pendant que des mois de 2006 s'affichent. On borne à cinq ans, et on le dit.
    const plancher = addMonth(curMonth, -MAX_MOIS_ATTENDUS);
    let first = dossier.from || got[0].month;
    let tronque = false;
    if (first < plancher) { first = plancher; tronque = true; }
    if (first > last) return [];
    const out = monthsBetween(first, last).map(m => {
      const p = (dossier.packs || []).find(x => x.month === m);
      return {
        month: m, label: monthLabel(m), pack: p || null,
        state: !p ? (m === moisDeGrace ? 'attendu' : 'manquant') : p.definitive ? 'complet' : 'provisoire',
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
    urgence: (a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'),
    nom: (a, b) => a.name.localeCompare(b.name, 'fr'),
    dernier: (a, b) => String(b.lastMonth || '').localeCompare(String(a.lastMonth || '')) || a.name.localeCompare(b.name, 'fr'),
    recu: (a, b) => (b.lastAt || 0) - (a.lastAt || 0) || a.name.localeCompare(b.name, 'fr'),
    ca: (a, b) => ((b.lastFigures && b.lastFigures.ca) || 0) - ((a.lastFigures && a.lastFigures.ca) || 0) || a.name.localeCompare(b.name, 'fr'),
    manquants: (a, b) => b.missingCount - a.missingCount || a.name.localeCompare(b.name, 'fr'),
    relance: (a, b) => (a.lastRelanceAt || 0) - (b.lastRelanceAt || 0) || a.name.localeCompare(b.name, 'fr')
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
  function portfolio(state, todayIso) {
    const rows = dossierList(state, todayIso, { withArchived: false });
    const suivis = rows.filter(r => !r.manual);
    const ca = suivis.reduce((s, r) => s + ((r.lastFigures && r.lastFigures.ca) || 0), 0);
    const fees = rows.reduce((s, r) => s + (r.fees || 0), 0);
    return {
      total: rows.length,
      surSkanfact: suivis.length,
      horsSkanfact: rows.filter(r => r.manual).length,
      aJour: suivis.filter(r => r.level === 'ok').length,
      enRetard: suivis.filter(r => r.missingCount > 0).length,
      provisoires: suivis.filter(r => r.provisionalCount > 0 && !r.missingCount).length,
      moisManquants: suivis.reduce((s, r) => s + r.missingCount, 0),
      dernierCA: round3(ca),
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
  function cabinetTodo(state, todayIso) {
    const rows = dossierList(state, todayIso);
    const out = [];
    // Le jour de relance, en tête : c'est une échéance, pas un état.
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
    const urgente = echeances(state, todayIso, { avant: 1, apres: 1 })
      .filter(e => !e.passee && e.jours <= 12 && e.manquants.length)
      .sort((a, b) => a.jours - b.jours)[0];
    if (urgente) out.push({
      id: 'echeance', level: urgente.jours <= 5 ? 'danger' : 'warn',
      label: `${urgente.label} : ${pl(urgente.manquants.length, 'client')} ${urgente.manquants.length > 1 ? 'n\'ont' : 'n\'a'} pas envoyé ${urgente.mois.length > 1 ? 'ses mois' : 'son mois'}`,
      detail: `À déposer dans ${urgente.jours} jour${urgente.jours > 1 ? 's' : ''} (${urgente.date}). ${urgente.manquants.slice(0, 5).join(', ')}${urgente.manquants.length > 5 ? '…' : ''}`,
      count: urgente.manquants.length, rows: []
    });
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
      detail: 'Leur mois n\'est pas clôturé : les chiffres peuvent encore bouger. À relancer avant de déclarer.',
      count: prov.length, rows: prov
    });
    const holes = rows.filter(r => r.issues > 0);
    if (holes.length) out.push({
      id: 'pieces', level: 'warn',
      label: `${pl(holes.length, 'dossier')} ${holes.length > 1 ? 'ont' : 'a'} des pièces manquantes`,
      detail: 'Justificatifs d\'achat absents, factures en brouillon, attestations non remises — la page de garde de leur paquet en donne le détail.',
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
  // écran vide, et ne voit pas ce qu'elle lui apporterait. Cinq dossiers suffisent à montrer les
  // quatre situations : à jour, en retard, provisoire, pièces manquantes. Les données sont
  // ouvertement fictives et l'écran le dit.
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
    return [
      d('Menuiserie Trabelsi SUARL', '1122334A/M/P/000', 'contact@trabelsi.tn',
        [pack(M(-1), true, null, 28450, 0), pack(M(-2), true, null, 31200, 0), pack(M(-3), true, null, 26980, 0)]),
      d('Pharmacie El Menzah', '2233445B/A/M/000', 'pharmacie.menzah@example.tn',
        [pack(M(-4), true, null, 84300, 1), pack(M(-5), true, null, 79150, 1)]),    // deux mois de retard
      d('Studio Sfax Design', '3344556C/N/M/000', 'hello@sfaxdesign.tn',
        [pack(M(-1), false, null, 12400, 2), pack(M(-2), true, null, 15750, 2)]),   // dernier mois provisoire
      d('Transports Béji & Fils', '4455667D/P/M/000', '',
        [pack(M(-1), true, [{ id: 'justif', level: 'warn', label: 'achats sans justificatif joint', count: 6 }], 46800, 3),
         pack(M(-2), true, [{ id: 'brouillon', level: 'warn', label: 'factures restées en brouillon', count: 2 }], 44120, 3)]),
      d('Café des Jasmins', '5566778E/C/M/000', 'jasmins@example.tn',
        [pack(M(-6), true, null, 9870, 4)])                                         // parti ou endormi
    ];
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

  // Est-ce que ce dossier a envoyé ce mois-là, et de façon définitive ?
  function moisRecu(dossier, month) {
    const p = (dossier.packs || []).find(x => x.month === month);
    return !p ? 'manquant' : p.definitive ? 'complet' : 'provisoire';
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
    actifs.forEach(d => attendus.set(d, new Map(dossierMonths(d, t, grace).map(m => [m.month, m.state]))));
    const concerne = (d, mois) => mois.some(m => attendus.get(d).has(m));

    const out = [];
    for (let k = avant; k >= 0; k--) {
      const mois = addMonth(dernierMoisFini, -k);
      const depot = addMonth(mois, 1);

      const mensuels = actifs.filter(d => (!d.tvaPeriod || d.tvaPeriod === 'mensuelle') && concerne(d, [mois]));
      // « TVA de octobre » ne s'écrit pas : quatre mois sur douze commencent par une voyelle.
      if (mensuels.length) out.push(ligneEcheance('tva-m', `TVA ${de(monthLabel(mois))}`, dayOf(depot, cfg.tvaDay), mois, mensuels, t, attendus,
        'Déclaration mensuelle de TVA. Les clients dont tu n\'as pas le mois ne peuvent pas être déclarés.'));

      const [, mm] = mois.split('-').map(Number);
      if (QUARTER_END[mm]) {
        const trim = QUARTER_END[mm];
        const moisTrim = [addMonth(mois, -2), addMonth(mois, -1), mois];
        const trimestriels = actifs.filter(d => d.tvaPeriod === 'trimestrielle' && concerne(d, moisTrim));
        if (trimestriels.length) out.push(ligneEcheance('tva-t', `TVA du ${trim}ᵉ trimestre`, dayOf(depot, cfg.tvaDay), moisTrim, trimestriels, t, attendus,
          'Déclaration trimestrielle de TVA. Il te faut les trois mois du trimestre.'));
        const employeurs = actifs.filter(d => concerne(d, moisTrim));
        if (employeurs.length) out.push(ligneEcheance('cnss', `CNSS du ${trim}ᵉ trimestre`, dayOf(depot, cfg.cnssDay), moisTrim, employeurs, t, attendus,
          'Déclaration sociale trimestrielle, pour les clients qui ont des salariés. SkanFact ne sait pas lesquels : à toi de filtrer.'));
      }
    }
    return out
      .filter(e => e.clients > 0)
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.label.localeCompare(b.label, 'fr'));
  }

  function ligneEcheance(id, label, date, mois, dossiers, todayIso, attendus, detail) {
    const liste = Array.isArray(mois) ? mois : [mois];
    const manquants = [], provisoires = [];
    dossiers.forEach(d => {
      // Un mois qui n'est pas attendu de ce client (avant son début de mission) n'est pas un manque.
      const etats = liste.map(m => attendus.get(d).get(m)).filter(Boolean);
      if (!etats.length) return;
      if (etats.some(e => e === 'manquant')) manquants.push(d.name);
      else if (etats.some(e => e === 'provisoire')) provisoires.push(d.name);
    });
    const jours = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(todayIso + 'T00:00:00Z')) / 86400000);
    const clients = dossiers.length;
    return {
      id, label, date, detail, mois: liste,
      clients, manquants, provisoires,
      prets: clients - manquants.length - provisoires.length,
      jours, passee: jours < 0,
      // Ce qui décide de la couleur : une échéance proche avec des pièces qui manquent est le seul
      // cas vraiment urgent. Une échéance proche mais complète n'a pas à crier.
      level: manquants.length && jours <= 10 ? 'danger' : manquants.length ? 'warn' : jours <= 3 && jours >= 0 ? 'warn' : 'ok'
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

  function toCsvLine(cells) {
    return cells.map(v => {
      const t = String(v == null ? '' : v);
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
      if (d.demo) return;                                   // les dossiers d'exemple n'ont pas de fichier
      if (ids && !ids.has(d.id)) return;
      const dans = (d.packs || []).filter(p => p.path && (!du || (p.month >= du && p.month <= au)))
        .sort((a, b) => a.month < b.month ? -1 : 1);
      if (!dans.length) { if (!d.manual && !d.archived) sansPaquet.push(d.name); return; }
      dans.forEach(p => pris.push({
        id: d.id, name: d.name, matricule: d.matricule, month: p.month,
        path: p.path, definitive: !!p.definitive, sealed: !!p.sealed
      }));
    });
    pris.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : a.name.localeCompare(b.name, 'fr')));
    return {
      packs: pris, sansPaquet,
      mois: [...new Set(pris.map(p => p.month))],
      provisoires: pris.filter(p => !p.definitive).map(p => `${p.name} (${monthLabel(p.month)})`)
    };
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

  return {
    FORMAT, MONTHS_FR, DEFAULT_STATE, DEFAULT_SETTINGS, TVA_PERIODS, REGIMES, RELANCE_WAYS, SORTS,
    monthLabel, monthListLabel, missingLabel, addMonth, monthsBetween, today, de,
    migrate, migrateDossier, dossierKey, packSummary, filePack, demoDossiers, checkIntegrity,
    newDossier, parseDossierLines, noteRelance, portfolio, relanceDue, relanceRows, accuseMail,
    parseCsv, toCsvLine, mergeEcritures, ecrituresPlan,
    DEFAULT_DEADLINES, deadlineSettings, echeances, dayOf,
    dossierMonths, dossierRow, dossierList, cabinetTodo, relanceMail, pairingFile
  };
}));
