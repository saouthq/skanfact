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

  const DEFAULT_SETTINGS = { relanceDay: 10 };
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
    s.dossiers = Array.isArray(s.dossiers) ? s.dossiers.map(migrateDossier) : [];
    s.format = FORMAT;
    return s;
  }

  // L'identité d'un dossier vient du MATRICULE FISCAL quand il existe : c'est le seul identifiant
  // stable d'une entreprise. Un nom se corrige, se raccourcit, change de forme juridique — et deux
  // clients peuvent s'appeler « Ben Ali ». Sans matricule, on retombe sur le nom normalisé.
  function dossierKey(manifest) {
    const e = (manifest && manifest.entreprise) || {};
    const mf = String(e.matricule || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (mf) return 'MF:' + mf;
    return 'NOM:' + String(e.nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
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
      figures: (manifest && manifest.chiffres) || null
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
    const before = dossier.packs.filter(p => p.month === sum.month);
    dossier.packs = dossier.packs.filter(p => p.month !== sum.month).concat([sum])
      .sort((a, b) => a.month < b.month ? 1 : a.month > b.month ? -1 : 0);
    return {
      dossier, created, adopted, replaced: before.length > 0,
      wasDefinitive: before.some(p => p.definitive),
      nowDefinitive: sum.definitive,
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
      const f = { name: cols[0] || '', matricule: cols[1] || '', email: cols[2] || '', phone: cols[3] || '' };
      // Les colonnes arrivent parfois dans le désordre : on reconnaît un email et un téléphone.
      cols.slice(1).forEach(c => {
        if (/@/.test(c) && !f.email.includes('@')) f.email = c;
        else if (/^\+?[\d\s().-]{6,}$/.test(c) && !f.phone) f.phone = c;
      });
      if (f.email === f.matricule) f.matricule = '';
      if (f.phone === f.matricule) f.matricule = '';
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
  function dossierMonths(dossier, todayIso) {
    const t = todayIso || today();
    const curMonth = t.slice(0, 7);
    // Un dossier créé à la main suit un client qui n'utilise pas encore SkanFact : on ne lui réclame
    // rien tant qu'il n'a pas commencé. Le réclamer afficherait vingt mois manquants le jour de sa
    // création, et noierait les vrais retards.
    if (dossier.manual) return [];
    const got = (dossier.packs || []).slice().sort((a, b) => a.month < b.month ? -1 : 1);
    // `from` est la date de début de mission, saisie par le comptable. C'est le seul moyen de dire
    // « je reprends ce client à partir de janvier » : sans elle, l'attente démarre au premier paquet
    // reçu et les mois d'avant ne sont jamais réclamés — un client repris en cours d'année passait
    // à travers sans que rien ne l'annonce.
    if (!got.length && !dossier.from) return [];
    const first = dossier.from || got[0].month;
    const last = addMonth(curMonth, -1);                    // le mois en cours n'est jamais attendu
    if (last < first) return [];
    return monthsBetween(first, last).map(m => {
      const p = (dossier.packs || []).find(x => x.month === m);
      return {
        month: m, label: monthLabel(m), pack: p || null,
        state: !p ? 'manquant' : p.definitive ? 'complet' : 'provisoire',
        missing: p ? (p.missing || []).reduce((s, x) => s + (x.count || 0), 0) : 0
      };
    });
  }

  // La ligne d'un dossier dans l'écran principal. Trois faits, dans l'ordre où ils comptent :
  // combien de mois manquent, où en est le dernier reçu, et quand il est arrivé.
  function dossierRow(dossier, todayIso) {
    const months = dossierMonths(dossier, todayIso);
    const missing = months.filter(m => m.state === 'manquant');
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
    const rows = (state.dossiers || [])
      .filter(d => opts.withArchived ? true : !d.archived)
      .filter(d => opts.onlySkanfact ? !d.manual : true)
      .map(d => dossierRow(d, todayIso));
    const q = String(opts.q || '').trim().toLowerCase();
    const kept = q
      ? rows.filter(r => (r.name + ' ' + r.matricule + ' ' + r.email + ' ' + r.phone + ' ' + r.contact).toLowerCase().includes(q))
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
  function relanceDue(state, todayIso) {
    const t = todayIso || today();
    const day = Number((state.settings || {}).relanceDay) || 10;
    const jour = Number(t.slice(8, 10));
    const rows = dossierList(state, t).filter(r => r.missingCount > 0);
    return { day, due: jour >= day, jour, count: rows.length, rows };
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
    if (rel.due && rel.count) out.push({
      id: 'jour-de-relance', level: 'danger',
      label: `On est le ${rel.jour} : ${pl(rel.count, 'dossier')} à relancer`,
      detail: `Tu as fixé le ${rel.day} du mois comme jour de relance (Réglages). ${rel.count > 1 ? 'Ces dossiers n\'ont' : 'Ce dossier n\'a'} pas envoyé tous ${rel.count > 1 ? 'leurs' : 'ses'} mois clôturés.`,
      count: rel.count, rows: rel.rows
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

  // Un jeu d'exemple. Un comptable qui ouvre l'application pour la première fois tombe sinon sur un
  // écran vide, et ne voit pas ce qu'elle lui apporterait. Cinq dossiers suffisent à montrer les
  // quatre situations : à jour, en retard, provisoire, pièces manquantes. Les données sont
  // ouvertement fictives et l'écran le dit.
  function demoDossiers(todayIso) {
    const cur = (todayIso || today()).slice(0, 7);
    const M = n => addMonth(cur, n);
    const pack = (m, definitif, manques, ca) => ({
      month: m, label: monthLabel(m), definitive: definitif,
      receivedAt: Date.parse(m + '-08T09:30:00Z'), generatedAt: m + '-08T08:15:00.000Z',
      files: 14, missing: manques || [], absent: 0, digest: '', bytes: 180000, path: '', sealed: true, appVersion: '',
      figures: { ca: ca || 0, tvaCollectee: round3((ca || 0) * 0.19), tvaDeductible: round3((ca || 0) * 0.07),
        tvaADecaisser: round3((ca || 0) * 0.12), creditTva: 0, encaisse: round3((ca || 0) * 0.8), devise: 'DT' }
    });
    const d = (name, matricule, email, packs) => ({ id: 'MF:' + matricule.replace(/[^A-Z0-9]/gi, '').toUpperCase(), name, matricule, email, note: '', archived: false, packs, demo: true });
    return [
      d('Menuiserie Trabelsi SUARL', '1122334A/M/P/000', 'contact@trabelsi.tn',
        [pack(M(-1), true, null, 28450), pack(M(-2), true, null, 31200), pack(M(-3), true, null, 26980)]),
      d('Pharmacie El Menzah', '2233445B/A/M/000', 'pharmacie.menzah@example.tn',
        [pack(M(-4), true, null, 84300), pack(M(-5), true, null, 79150)]),    // deux mois de retard
      d('Studio Sfax Design', '3344556C/N/M/000', 'hello@sfaxdesign.tn',
        [pack(M(-1), false, null, 12400), pack(M(-2), true, null, 15750)]),   // dernier mois provisoire
      d('Transports Béji & Fils', '4455667D/P/M/000', '',
        [pack(M(-1), true, [{ id: 'justif', level: 'warn', label: 'achats sans justificatif joint', count: 6 }], 46800),
         pack(M(-2), true, [{ id: 'brouillon', level: 'warn', label: 'factures restées en brouillon', count: 2 }], 44120)]),
      d('Café des Jasmins', '5566778E/C/M/000', 'jasmins@example.tn',
        [pack(M(-6), true, null, 9870)])                                      // parti ou endormi
    ];
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
    newDossier, parseDossierLines, noteRelance, portfolio, relanceDue, relanceRows,
    parseCsv, toCsvLine, mergeEcritures, ecrituresPlan,
    dossierMonths, dossierRow, dossierList, cabinetTodo, relanceMail, pairingFile
  };
}));
