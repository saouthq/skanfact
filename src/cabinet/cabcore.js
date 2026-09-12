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

  const DEFAULT_STATE = { format: FORMAT, cabinet: { name: '', email: '', publicKey: '', privateKey: '' }, dossiers: [], settings: { relanceDay: 10 } };

  function migrate(state) {
    const s = { ...DEFAULT_STATE, ...(state && typeof state === 'object' ? state : {}) };
    s.cabinet = { ...DEFAULT_STATE.cabinet, ...(s.cabinet || {}) };
    s.settings = { ...DEFAULT_STATE.settings, ...(s.settings || {}) };
    s.dossiers = Array.isArray(s.dossiers) ? s.dossiers.map(d => ({
      id: d.id || '', name: d.name || '', matricule: d.matricule || '', email: d.email || '',
      note: d.note || '', archived: !!d.archived, demo: !!d.demo,
      packs: Array.isArray(d.packs) ? d.packs : []
    })) : [];
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

  // Ranger un paquet dans le bon dossier. Renvoie ce qui s'est passé, pour que l'interface puisse le
  // DIRE : un mois reçu deux fois n'est pas une erreur, c'est une information — le client a rouvert
  // sa période, et les chiffres qu'on avait ne sont plus les bons.
  function filePack(state, manifest, extra) {
    const key = dossierKey(manifest);
    const e = (manifest && manifest.entreprise) || {};
    let dossier = state.dossiers.find(d => d.id === key);
    let created = false;
    if (!dossier) {
      dossier = { id: key, name: e.nom || '(sans nom)', matricule: e.matricule || '', email: '', note: '', archived: false, packs: [] };
      state.dossiers.push(dossier);
      created = true;
    } else if (e.nom && e.nom !== dossier.name) {
      dossier.name = e.nom;                     // l'entreprise a changé de raison sociale : on suit
    }
    const sum = packSummary(manifest, extra);
    const before = dossier.packs.filter(p => p.month === sum.month);
    dossier.packs = dossier.packs.filter(p => p.month !== sum.month).concat([sum])
      .sort((a, b) => a.month < b.month ? 1 : a.month > b.month ? -1 : 0);
    return {
      dossier, created, replaced: before.length > 0,
      wasDefinitive: before.some(p => p.definitive),
      nowDefinitive: sum.definitive,
      month: sum.month, summary: sum
    };
  }

  // L'état d'un dossier, mois par mois. `from` = le premier mois qu'on attend de ce client ;
  // par défaut le premier reçu, parce qu'avant ça on ne sait rien et qu'on ne réclame pas le néant.
  function dossierMonths(dossier, todayIso) {
    const t = todayIso || today();
    const curMonth = t.slice(0, 7);
    const got = (dossier.packs || []).slice().sort((a, b) => a.month < b.month ? -1 : 1);
    if (!got.length) return [];
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
    const level = missing.length ? 'danger' : provisional.length ? 'warn' : 'ok';
    return {
      id: dossier.id, name: dossier.name, matricule: dossier.matricule, email: dossier.email,
      archived: !!dossier.archived,
      lastMonth: last ? last.month : '', lastLabel: last ? last.label : '',
      lastAt: last ? last.receivedAt : null, lastDefinitive: last ? last.definitive : false,
      lastFigures: last ? (last.figures || null) : null,
      months: months.length, missingMonths: missing.map(m => m.month), missingCount: missing.length,
      provisionalCount: provisional.length, issues, level,
      // ce qui décide du tri : un dossier en retard de trois mois passe devant un dossier à jour
      score: missing.length * 1000 + provisional.length * 10 + (issues ? 1 : 0)
    };
  }

  function dossierList(state, todayIso, opts) {
    opts = opts || {};
    const rows = (state.dossiers || [])
      .filter(d => opts.withArchived ? true : !d.archived)
      .map(d => dossierRow(d, todayIso));
    const q = String(opts.q || '').trim().toLowerCase();
    const kept = q ? rows.filter(r => (r.name + ' ' + r.matricule + ' ' + r.email).toLowerCase().includes(q)) : rows;
    return kept.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));
  }

  // Ce que le cabinet a sur le feu, tous dossiers confondus. C'est ce qu'il regarde en arrivant.
  function cabinetTodo(state, todayIso) {
    const rows = dossierList(state, todayIso);
    const out = [];
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
    FORMAT, MONTHS_FR, DEFAULT_STATE,
    monthLabel, monthListLabel, missingLabel, addMonth, monthsBetween, today,
    migrate, dossierKey, packSummary, filePack, demoDossiers,
    dossierMonths, dossierRow, dossierList, cabinetTodo, relanceMail, pairingFile
  };
}));
