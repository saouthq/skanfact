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

  // ================================================================ LE LIVRE (9.2.0)
  //
  // `livre.json` : un fichier par dossier ET par exercice, côté cabinet. Tout ce qui suit est PUR —
  // la forme du livre, ses invariants et les six gestes qui l'écrivent se testent sans Electron,
  // sans disque et sans clé. `cabstore` ne fait que poser le résultat sur le disque, chiffré.
  //
  // Les trois règles qui décident de tout le reste, et qui ne bougent plus :
  //
  //   1. **Une écriture VALIDÉE ne se modifie jamais.** Ni ses lignes, ni sa date, ni son journal.
  //      On la contre-passe : une écriture miroir, datée du jour où l'on corrige. C'est ce qui fait
  //      qu'un livre se relit deux ans plus tard et dit la vérité de ce qui a été fait — une
  //      comptabilité qu'on peut réécrire n'est pas une comptabilité.
  //   2. **Le numéro s'attribue à la VALIDATION, jamais au brouillard**, et par ordre de
  //      validation, pas par date. C'est la différence avec la numérotation déduite de la 8.9.0 :
  //      là-bas un numéro bougeait quand on insérait une pièce en arrière (et la page le disait) ;
  //      ici il est écrit, et il ne bouge plus jamais.
  //   3. **Le paquet du client ne gagne jamais contre le cabinet.** Un mois renvoyé remplace les
  //      brouillards et ne touche AUCUNE validée : on calcule l'écart, on l'affiche, et c'est le
  //      comptable qui tranche. L'inverse — écraser son travail parce que le client a rouvert son
  //      mois — serait la pire chose que ce logiciel puisse faire.

  const LIVRE_FORMAT = 1;
  const STATUTS_ECRITURE = ['brouillard', 'validee', 'contrepassee'];
  const NATURES_COMPTE = ['bilan', 'gestion', 'tiers', 'tresorerie'];
  const SOURCES_ECRITURE = ['skanfact', 'saisie', 'banque', 'inventaire', 'an', 'import', 'od'];

  // Les journaux d'un dossier neuf. Le comptable les modifie ; ce ne sont que des propositions.
  const JOURNAUX_PAR_DEFAUT = [
    { code: 'VT', libelle: 'Ventes', type: 'ventes' },
    { code: 'AC', libelle: 'Achats', type: 'achats' },
    { code: 'BQ', libelle: 'Banque', type: 'tresorerie', compte: '532' },
    { code: 'CA', libelle: 'Caisse', type: 'tresorerie', compte: '54' },
    { code: 'PAIE', libelle: 'Paie', type: 'paie' },
    { code: 'OD', libelle: 'Opérations diverses', type: 'od' },
    { code: 'AN', libelle: 'À-nouveaux', type: 'an' }
  ];

  // ---------------------------------------------------------------- le plan comptable (9.8.5)
  //
  // Déplacé de core.js : le Cabinet ne charge pas core.js, et il a besoin de NOMMER un compte. La
  // règle de découpage de la 9.1.0 le veut ici — cette table ne prend pas `data`, elle prend un
  // numéro. core.js la réexporte, et un test compare les deux par identité d'objet (9.6.1).
  //
  // Aucun de ces numéros n'est une vérité (règle 6.3.0) : ils suivent l'usage tunisien, chaque
  // cabinet a les siens, et le plan d'un dossier les écrase. Ce qui compte, c'est qu'un compte ait
  // un NOM de compte — et pas, comme jusqu'à la 9.8.4, le libellé de la première écriture qui l'a
  // touché.
  const PLAN_COMPTABLE = [
    ['1', 'Capitaux propres et passifs non courants'],
    ['10', 'Capital'], ['101', 'Capital social'], ['11', 'Réserves'], ['12', 'Résultats reportés'],
    ['13', 'Résultat de l\'exercice'], ['131', 'Résultat bénéficiaire'], ['135', 'Résultat déficitaire'],
    ['14', 'Autres capitaux propres'], ['15', 'Provisions pour risques et charges'],
    ['16', 'Emprunts et dettes assimilées'], ['17', 'Dettes rattachées à des participations'], ['18', 'Comptes de liaison'],
    ['2', 'Actifs non courants'],
    ['21', 'Immobilisations incorporelles'], ['213', 'Logiciels'], ['22', 'Immobilisations corporelles'],
    ['221', 'Terrains'], ['222', 'Constructions'], ['223', 'Installations techniques et matériel'],
    ['224', 'Matériel de transport'], ['228', 'Autres immobilisations corporelles'], ['2282', 'Matériel de bureau'],
    ['2283', 'Matériel informatique'], ['2284', 'Mobilier'], ['23', 'Immobilisations en cours'],
    ['24', 'Immobilisations à statut juridique particulier'], ['25', 'Participations'],
    ['26', 'Autres immobilisations financières'], ['27', 'Autres actifs non courants'],
    ['28', 'Amortissements des immobilisations'], ['281', 'Amortissements des immobilisations incorporelles'],
    ['282', 'Amortissements des immobilisations corporelles'], ['29', 'Provisions pour dépréciation des immobilisations'],
    ['3', 'Stocks'],
    ['31', 'Matières premières'], ['32', 'Autres approvisionnements'], ['33', 'En-cours de production'],
    ['34', 'Produits intermédiaires'], ['35', 'Produits finis'], ['37', 'Marchandises'], ['39', 'Provisions pour dépréciation des stocks'],
    ['4', 'Tiers'],
    ['40', 'Fournisseurs et comptes rattachés'], ['401', 'Fournisseurs d\'exploitation'], ['403', 'Fournisseurs — effets à payer'],
    ['404', 'Fournisseurs d\'immobilisations'], ['408', 'Fournisseurs — factures non parvenues'], ['409', 'Fournisseurs débiteurs (avances)'],
    ['41', 'Clients et comptes rattachés'], ['411', 'Clients'], ['413', 'Clients — effets à recevoir'], ['416', 'Clients douteux'],
    ['418', 'Clients — produits à recevoir'], ['419', 'Clients créditeurs (avances reçues)'],
    ['42', 'Personnel et comptes rattachés'], ['421', 'Personnel — rémunérations dues'], ['425', 'Personnel — rémunérations dues'],
    ['4251', 'Personnel — avances et acomptes'], ['427', 'Personnel — oppositions'], ['428', 'Personnel — charges à payer'],
    ['43', 'État et collectivités publiques'], ['431', 'État — impôt sur les bénéfices'], ['432', 'État — impôts et taxes retenus à la source'],
    ['4321', 'Retenues à la source sur salaires (IRPP)'], ['433', 'État — autres impôts et taxes'], ['4331', 'Taxe sur les établissements (TCL)'],
    ['4335', 'TFP et FOPROLOS'], ['434', 'État — acomptes provisionnels'], ['435', 'État — retenues à la source'],
    ['4352', 'Retenue à la source opérée (à reverser)'], ['4358', 'Retenue à la source subie (à imputer)'],
    ['436', 'État — taxes sur le chiffre d\'affaires'], ['4364', 'Crédit de TVA à reporter'], ['4365', 'TVA à payer'],
    ['4366', 'TVA déductible'], ['4367', 'TVA collectée'], ['4368', 'Timbre fiscal'], ['437', 'État — obligations cautionnées'],
    ['44', 'Sociétés du groupe et associés'], ['442', 'Associés — comptes courants'], ['4421', 'Apports en compte courant'],
    ['446', 'Associés — dividendes à payer'],
    ['45', 'Organismes sociaux'], ['453', 'CNSS'], ['4531', 'CNSS — cotisations à payer'],
    ['46', 'Débiteurs et créditeurs divers'], ['47', 'Comptes transitoires ou d\'attente'], ['471', 'Compte d\'attente'],
    ['48', 'Comptes de régularisation'], ['49', 'Provisions pour dépréciation des comptes de tiers'],
    ['5', 'Comptes financiers'],
    ['50', 'Placements courants'], ['53', 'Banques et établissements financiers'], ['532', 'Banques'],
    ['54', 'Caisse'], ['58', 'Virements internes'], ['59', 'Provisions pour dépréciation des comptes financiers'],
    ['6', 'Charges'],
    ['60', 'Achats'], ['601', 'Achats de matières premières'], ['602', 'Achats d\'approvisionnements'],
    ['603', 'Variation des stocks'], ['606', 'Achats non stockés (fournitures, services)'], ['607', 'Achats de marchandises'],
    ['608', 'Frais accessoires d\'achat'],
    ['61', 'Services extérieurs'], ['611', 'Sous-traitance'], ['613', 'Locations'], ['615', 'Entretien et réparations'],
    ['616', 'Assurances'], ['618', 'Divers services extérieurs'],
    ['62', 'Autres services extérieurs'], ['621', 'Personnel extérieur'], ['622', 'Honoraires'], ['623', 'Publicité'],
    ['624', 'Transports'], ['625', 'Déplacements et réceptions'], ['626', 'Frais postaux et télécommunications'],
    ['627', 'Services bancaires'], ['628', 'Divers'],
    ['63', 'Charges diverses ordinaires'], ['64', 'Charges de personnel'], ['640', 'Salaires et traitements'],
    ['641', 'Rémunérations du personnel'], ['645', 'Charges sociales'], ['647', 'Charges sociales légales'],
    ['65', 'Charges financières'], ['651', 'Intérêts des emprunts'], ['66', 'Impôts, taxes et versements assimilés'],
    ['661', 'Impôts et taxes sur rémunérations (TFP, FOPROLOS)'], ['665', 'Autres impôts et taxes (TCL…)'],
    ['67', 'Pertes extraordinaires'], ['675', 'Valeur comptable des immobilisations cédées'],
    ['68', 'Dotations aux amortissements et provisions'], ['681', 'Dotations aux amortissements'], ['69', 'Impôt sur les bénéfices'],
    ['7', 'Produits'],
    ['70', 'Ventes'], ['701', 'Ventes de produits finis'], ['706', 'Prestations de services'], ['707', 'Ventes de marchandises'],
    ['708', 'Produits des activités annexes'], ['71', 'Production stockée'], ['72', 'Production immobilisée'],
    ['73', 'Produits divers ordinaires'], ['74', 'Subventions d\'exploitation'], ['75', 'Produits financiers'],
    ['77', 'Gains extraordinaires'], ['775', 'Produits des cessions d\'immobilisations'], ['78', 'Reprises sur amortissements et provisions'],
    ['79', 'Transferts de charges']
  ];

  // Le nom d'un compte d'après le plan, par le plus LONG préfixe : `4366` donne « TVA déductible »
  // et pas « Tiers ». Rend `''` quand le plan ne connaît pas le numéro — c'est à l'appelant de
  // décider quoi mettre, et surtout pas à cette fonction d'inventer.
  function libelleDuPlan(compte) {
    const n = String(compte || '').trim();
    if (!n) return '';
    let best = null;
    PLAN_COMPTABLE.forEach(([p, l]) => { if (n.startsWith(p) && (!best || p.length > best[0].length)) best = [p, l]; });
    return best ? best[1] : '';
  }

  // La nature d'un compte DÉDUITE de son numéro, quand le CSV importé ne la donne pas. Aucun de ces
  // rangements n'est une vérité — chaque cabinet a les siens — mais deviner vaut mieux que laisser
  // vide : une nature vide casserait la balance par classe, et personne ne saurait pourquoi.
  function natureDeCompte(compte) {
    const n = String(compte || '').trim();
    if (!/^\d/.test(n)) return '';
    if (/^(411|401|40|41|42|43|44|45|46)/.test(n)) return 'tiers';
    if (/^(53|54|58|50)/.test(n)) return 'tresorerie';
    if (/^[67]/.test(n)) return 'gestion';
    if (/^[1-5]/.test(n)) return 'bilan';
    return '';
  }

  // Un identifiant d'écriture. Pas de `Date.now()` ni de `Math.random()` imposés : l'appelant donne
  // la graine, parce que ce module doit rester reproductible (règle des workflows, et surtout :
  // un test qui dépend de l'horloge ne prouve rien).
  let compteurId = 0;
  function idEcriture(graine) {
    compteurId = (compteurId + 1) % 1000000;
    return 'e_' + String(graine || 0).toString(36) + '_' + compteurId.toString(36);
  }

  function livreVide(dossierId, annee, opts) {
    const o = opts || {};
    const a = Number(annee) || 0;
    return {
      format: LIVRE_FORMAT,
      dossier: String(dossierId || ''),
      exercice: {
        annee: a,
        du: o.du || `${a}-01-01`,
        au: o.au || `${a}-12-31`,
        clos: false, closLe: null, closPar: null, reouvertures: []
      },
      plan: Array.isArray(o.plan) ? o.plan.slice() : [],
      journaux: Array.isArray(o.journaux) ? o.journaux.slice() : JOURNAUX_PAR_DEFAUT.map(j => ({ ...j })),
      ecritures: [],
      lettrages: [],
      // Trois listes VIDES dont la forme est figée dès maintenant (SPEC-DATA-005). Elles ne se
      // remplissent qu'en 9.5.0, 9.6.0 et 9.7.0 — mais un relevé « par ligne » ne se transforme pas
      // en relevé « par compte » une fois écrit chez soixante clients.
      releves: [], immobilisations: [], declarations: [],
      // La quatrième liste, ajoutée en 9.7.0 : l'inventaire de stock de fin d'exercice. Elle ne
      // pouvait pas être une écriture — une écriture porte UN montant, un inventaire porte ce qui a
      // été compté, ligne par ligne, et un chiffre qu'on ne peut pas ouvrir se croit ou ne se croit
      // pas. Absente d'un livre écrit avant, elle vaut `[]` : aucun lecteur ancien ne s'en plaint.
      inventaires: [],
      ouverture: { date: null, source: null, lignes: [] },
      audit: []
    };
  }

  // Ce qu'on relit du disque avant d'y toucher. Un `false` ici veut dire « ce fichier n'est pas un
  // livre » : on le met de côté sans jamais l'écraser (même règle que `skanfact-data.json`).
  //
  // Une version SUPÉRIEURE est refusée à part (`versionInconnue`) : ouvrir un livre écrit par une
  // version plus récente et le réécrire avec nos règles à nous perdrait ce qu'elle y avait mis.
  function isValidLivre(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.format !== LIVRE_FORMAT) return false;
    if (typeof obj.dossier !== 'string') return false;
    if (!obj.exercice || typeof obj.exercice !== 'object') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(obj.exercice.du))) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(obj.exercice.au))) return false;
    if (String(obj.exercice.du) > String(obj.exercice.au)) return false;
    const listes = ['plan', 'journaux', 'ecritures', 'lettrages', 'releves', 'immobilisations', 'declarations', 'audit'];
    if (listes.some(k => !Array.isArray(obj[k]))) return false;
    return obj.ecritures.every(e => e && typeof e === 'object'
      && STATUTS_ECRITURE.includes(e.statut) && Array.isArray(e.lignes));
  }
  const livreVersionInconnue = obj => !!(obj && typeof obj === 'object'
    && typeof obj.format === 'number' && obj.format > LIVRE_FORMAT);

  // Ce qu'un livre écrit AVANT la 9.8.5 doit recevoir en le relisant. Deux choses, et aucune ne
  // touche à un chiffre :
  //
  //  1. La case `tiers` sur chaque ligne. Absente, elle vaut `''` — et non le libellé, qui est
  //     précisément la confusion qu'on répare. Les lignes déjà écrites restent donc sans tiers
  //     jusqu'à ce que leurs paquets soient relus : « (sans tiers) » est honnête, un nom de tiers
  //     inventé ne l'est pas.
  //  2. Le nom des comptes créés à l'import. Ils portaient le libellé de la première écriture qui
  //     les touchait ; on leur rend leur nom de compte. Un compte que le cabinet a nommé lui-même
  //     (`source` autre qu'`import`) n'est JAMAIS renommé — c'est son choix, pas notre table.
  //
  // Pure et idempotente : la relancer sur un livre déjà migré ne change rien.
  function migrerLivre(livre) {
    if (!livre || typeof livre !== 'object') return livre;
    (livre.ecritures || []).forEach(e => {
      (e.lignes || []).forEach(l => { if (typeof l.tiers !== 'string') l.tiers = ''; });
    });
    (livre.plan || []).forEach(c => {
      if (c.source !== 'import') return;
      const nom = libelleDuPlan(c.compte);
      if (nom) c.libelle = nom;
    });
    return livre;
  }

  const trace = (livre, qui, quoi, detail, quand) =>
    livre.audit.push({ quand: Number(quand) || 0, qui: String(qui || ''), quoi, detail: detail || '' });

  // Le plan reçoit un compte qu'il n'a pas. JAMAIS un refus silencieux : une ligne qui référence un
  // compte absent doit entrer, avec son compte marqué `import`, sinon l'écriture disparaîtrait et
  // la balance serait fausse sans que rien ne le dise (invariant 2 de SPEC-DATA-005).
  // **Un compte porte un NOM DE COMPTE, jamais le libellé d'une écriture** (9.8.5). Jusqu'à la
  // 9.8.4, `libelle` était le libellé de la ligne qui créait le compte : le 401 s'appelait
  // « Achat LOC-2026-08 — Agence Immobilière Le Lac » et le 706 « Facture FAC-2026-014 — Clinique
  // Les Jasmins ». Ça ressortait au grand livre, à la balance, au bilan, dans la colonne INTITULÉ
  // de la saisie — et le sélecteur de compte RECOPIAIT ce nom dans la ligne saisie, donc dans une
  // écriture validée, définitive. Le plan tranche d'abord ; le libellé reçu n'est qu'un repli, pour
  // un compte que le plan ne connaît pas.
  function assurerCompte(livre, compte, libelle) {
    const n = String(compte || '').trim();
    if (!n) return null;
    let c = livre.plan.find(x => x.compte === n);
    if (c) return c;
    c = { compte: n, libelle: libelleDuPlan(n) || libelle || 'Compte hors plan', nature: natureDeCompte(n), source: 'import' };
    livre.plan.push(c);
    return c;
  }

  // Ajouter une écriture : TOUJOURS en brouillard, TOUJOURS sans numéro. Il n'existe aucun chemin
  // qui écrive directement une validée — c'est ce qui garantit que tout ce qui porte un numéro est
  // passé par `validerEcriture`, donc par `ecritureValide`.
  function ajouterEcriture(livre, ecriture, qui, quand) {
    const e = {
      id: (ecriture && ecriture.id) || idEcriture(quand),
      numero: null,
      date: String((ecriture && ecriture.date) || ''),
      journal: String((ecriture && ecriture.journal) || ''),
      piece: String((ecriture && ecriture.piece) || ''),
      libelle: String((ecriture && ecriture.libelle) || ''),
      source: SOURCES_ECRITURE.includes(ecriture && ecriture.source) ? ecriture.source : 'saisie',
      mois: (ecriture && ecriture.mois) || String((ecriture && ecriture.date) || '').slice(0, 7),
      docId: (ecriture && ecriture.docId) || null,
      pieceJointe: (ecriture && ecriture.pieceJointe) || null,
      statut: 'brouillard',
      auteur: String(qui || ''),
      creeLe: Number(quand) || 0,
      valideeLe: null,
      contrepasseDe: (ecriture && ecriture.contrepasseDe) || null,
      extourneDe: (ecriture && ecriture.extourneDe) || null,
      // 9.8.0 — « cette écriture d'inventaire se défait au 1er janvier ». Le drapeau doit vivre
      // ICI : `ajouterEcriture` normalise et jette ce qu'elle ne connaît pas, exprès — la forme
      // d'une écriture est fixée, sinon chaque appelant y glisserait ses champs à lui.
      // `extourneeLe` retient que l'extourne a été posée : sans lui, elle repartirait chaque fois
      // qu'on rouvre l'exercice suivant, et la charge serait annulée deux fois.
      extourne: !!(ecriture && ecriture.extourne),
      extourneeLe: (ecriture && ecriture.extourneeLe) || null,
      lignes: (Array.isArray(ecriture && ecriture.lignes) ? ecriture.lignes : []).map(l => ({
        compte: String((l && l.compte) || '').trim(),
        tiersId: (l && l.tiersId) || null,
        // 9.8.5 — le NOM DU TIERS de la ligne. Il existait dans le CSV du paquet et se perdait ici :
        // la forme d'une ligne ne le portait pas, donc `lignesDuLivre` en inventait un à partir du
        // libellé. Conséquence, sur six écrans : le lettrage groupait par FACTURE, la balance âgée
        // rendait une ligne par pièce, le bilan étiquetait chaque rubrique du nom d'une opération.
        // C'est une décision de FORMAT (règle 9.7.0) : le test du format tombe pour le dire.
        tiers: String((l && l.tiers) || ''),
        libelle: String((l && l.libelle) || ''),
        debit: round3(Math.max(0, Number(l && l.debit) || 0)),
        credit: round3(Math.max(0, Number(l && l.credit) || 0)),
        lettre: String((l && l.lettre) || '')
      }))
    };
    e.lignes.forEach(l => assurerCompte(livre, l.compte, l.libelle));
    livre.ecritures.push(e);
    return e;
  }

  // Valider : le seul endroit où un numéro naît. Le contrôle passe AVANT l'attribution — sinon un
  // refus trouerait la numérotation, exactement le défaut que la 6.0.0 a trouvé sur `nextNumber`.
  function validerEcriture(livre, id, qui, quand) {
    const e = livre.ecritures.find(x => x.id === id);
    if (!e) return { ok: false, motif: 'Cette écriture n\'existe pas.' };
    if (e.statut !== 'brouillard') return { ok: false, motif: 'Cette écriture est déjà validée : elle se contre-passe, elle ne se revalide pas.' };
    const v = ecritureValide(e, livre.plan.map(c => c.compte));
    if (!v.ok) return { ok: false, motif: v.motif, motifs: v.motifs };
    e.numero = livre.ecritures.reduce((m, x) => Math.max(m, Number(x.numero) || 0), 0) + 1;
    e.statut = 'validee';
    e.valideeLe = Number(quand) || 0;
    trace(livre, qui, 'validation', `${e.journal} ${e.piece} n° ${e.numero}`, quand);
    return { ok: true, ecriture: e };
  }

  // Contre-passer : le MIROIR, jamais une modification ni une suppression. La date est celle du jour
  // où l'on corrige, pas celle de l'écriture d'origine — corriger en mars une écriture de janvier
  // dans un janvier déjà déclaré changerait la TVA de janvier en silence (règle 6.0.0).
  function contrepasser(livre, id, qui, dateIso, quand) {
    const e = livre.ecritures.find(x => x.id === id);
    if (!e) return { ok: false, motif: 'Cette écriture n\'existe pas.' };
    if (e.statut !== 'validee') return { ok: false, motif: 'Une écriture en brouillard se modifie : elle n\'a pas besoin d\'être contre-passée.' };
    if (livre.ecritures.some(x => x.contrepasseDe === id)) return { ok: false, motif: 'Cette écriture a déjà été contre-passée.' };
    const miroir = ajouterEcriture(livre, {
      date: dateIso, journal: e.journal, piece: e.piece,
      libelle: 'Contre-passation — ' + e.libelle,
      source: e.source, mois: String(dateIso).slice(0, 7), contrepasseDe: id,
      lignes: e.lignes.map(l => ({ compte: l.compte, tiersId: l.tiersId, libelle: l.libelle, debit: l.credit, credit: l.debit }))
    }, qui, quand);
    const r = validerEcriture(livre, miroir.id, qui, quand);
    if (!r.ok) { livre.ecritures = livre.ecritures.filter(x => x.id !== miroir.id); return r; }
    e.statut = 'contrepassee';
    trace(livre, qui, 'contre-passation', `${e.journal} ${e.piece} n° ${e.numero} → n° ${miroir.numero}`, quand);
    return { ok: true, ecriture: miroir };
  }

  // La clé d'une écriture venue d'un paquet : c'est elle qui dit « c'est la même pièce, renvoyée ».
  // Le `docId` d'abord quand il existe (il ne change jamais), la pièce ensuite.
  const cleDuPaquet = e => e.docId ? 'D:' + e.docId : 'P:' + (e.journal || '') + '|' + (e.piece || '');
  // La somme d'une écriture, pour dire en UN chiffre que deux versions diffèrent.
  const totalEcriture = e => round3((e.lignes || []).reduce((s, l) => s + (Number(l.debit) || 0), 0));

  // Importer un mois reçu. Les trois cas, et leur raison :
  //   — le mois n'était pas là → on ajoute (brouillard, ou validé si le mois est définitif) ;
  //   — il était là en brouillard → on REMPLACE : le client a rouvert son mois, sa version fait foi
  //     tant que le comptable n'a rien validé ;
  //   — il était là VALIDÉ → on ne touche à rien et on calcule l'écart. C'est la règle 3.
  function importerPaquet(livre, mois, ecritures, definitif, qui, quand) {
    const m = String(mois || '');
    const avant = livre.ecritures.filter(e => e.source === 'skanfact' && e.mois === m);
    const parCle = {};
    avant.forEach(e => { parCle[cleDuPaquet(e)] = e; });
    const res = { ajoutees: 0, remplacees: 0, ecarts: [], validees: 0 };

    // Les brouillards du mois s'en vont : ils seront réécrits depuis ce que le paquet dit.
    const aJeter = avant.filter(e => e.statut === 'brouillard').map(e => e.id);
    livre.ecritures = livre.ecritures.filter(e => !aJeter.includes(e.id));

    (Array.isArray(ecritures) ? ecritures : []).forEach(src => {
      const e = { ...src, source: 'skanfact', mois: m };
      const ancienne = parCle[cleDuPaquet(e)];
      if (ancienne && ancienne.statut !== 'brouillard') {
        // Une validée ne bouge pas. On DIT l'écart, et c'est tout : l'appliquer serait écraser le
        // travail du comptable au nom de ce que le client a refait de son côté.
        const apres = totalEcriture(e);
        if (round3(apres - totalEcriture(ancienne)) !== 0) {
          res.ecarts.push({ id: ancienne.id, piece: ancienne.piece, avant: totalEcriture(ancienne), apres });
        }
        return;
      }
      const nouvelle = ajouterEcriture(livre, e, qui || 'import', quand);
      if (ancienne) res.remplacees++; else res.ajoutees++;
      // Un mois DÉFINITIF (clôturé chez le client) entre validé : il ne bougera plus chez lui non
      // plus. Un mois provisoire reste en brouillard — le valider reviendrait à s'engager sur des
      // chiffres que le client peut encore changer.
      if (definitif && validerEcriture(livre, nouvelle.id, qui || 'import', quand).ok) res.validees++;
    });
    trace(livre, qui || 'import', 'import-paquet',
      `${m}${definitif ? ' (définitif)' : ''} — ${res.ajoutees} ajoutée(s), ${res.remplacees} remplacée(s), ${res.ecarts.length} écart(s)`, quand);
    return res;
  }

  // Lettrer : relier des écritures d'un même compte dont la somme débit − crédit fait zéro. C'est le
  // geste qui dit « cette facture est payée par ce règlement », et la somme nulle EST la preuve.
  const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function prochaineLettre(livre) {
    const prises = new Set((livre.lettrages || []).map(l => l.lettre));
    for (let n = 1; n < 5; n++) {
      const gen = (i) => {
        let s = '', k = i;
        for (let j = 0; j < n; j++) { s = LETTRES[k % 26] + s; k = Math.floor(k / 26); }
        return s;
      };
      for (let i = 0; i < Math.pow(26, n); i++) { const s = gen(i); if (!prises.has(s)) return s; }
    }
    return 'ZZZZ';
  }
  function lettrer(livre, compte, ids, lettre, qui, dateIso) {
    const n = String(compte || '').trim();
    const ecr = (ids || []).map(id => livre.ecritures.find(e => e.id === id)).filter(Boolean);
    if (ecr.length !== (ids || []).length) return { ok: false, motif: 'Une des écritures à lettrer n\'existe pas.' };
    if (ecr.length < 2) return { ok: false, motif: 'Le lettrage relie au moins deux écritures : une facture et son règlement.' };
    const lignes = [];
    ecr.forEach(e => e.lignes.forEach((l, i) => { if (l.compte === n) lignes.push({ e, i, l }); }));
    if (!lignes.length) return { ok: false, motif: `Aucune de ces écritures ne touche le compte ${n}.` };
    const solde = round3(lignes.reduce((s, x) => s + x.l.debit - x.l.credit, 0));
    // La somme nulle n'est pas une formalité : un lettrage qui ne solde pas affirme qu'une facture
    // est payée alors qu'il reste quelque chose. C'est un mensonge que le grand livre propagerait.
    if (solde !== 0) return { ok: false, motif: `Ces écritures ne se soldent pas : il reste ${solde.toFixed(3)}.`, ecart: solde };
    const L = String(lettre || '').trim().toUpperCase() || prochaineLettre(livre);
    lignes.forEach(x => { x.l.lettre = L; });
    livre.lettrages.push({ lettre: L, compte: n, ecritures: ecr.map(e => e.id), le: String(dateIso || ''), par: String(qui || '') });
    return { ok: true, lettre: L };
  }
  function delettrer(livre, lettre, qui, quand) {
    const L = String(lettre || '').trim().toUpperCase();
    const avant = livre.lettrages.length;
    livre.lettrages = livre.lettrages.filter(x => x.lettre !== L);
    if (livre.lettrages.length === avant) return { ok: false, motif: 'Ce lettrage n\'existe pas.' };
    livre.ecritures.forEach(e => e.lignes.forEach(l => { if (l.lettre === L) l.lettre = ''; }));
    trace(livre, qui, 'délettrage', L, quand);
    return { ok: true };
  }

  // La balance d'ouverture d'un dossier repris ailleurs : une SEULE écriture AN, pièce OUVERTURE.
  // Refusée déséquilibrée, avec l'écart — une reprise fausse fausse tout l'exercice, et on ne la
  // découvrirait qu'au bilan.
  function balanceOuverture(livre, lignes, dateIso, source, qui, quand) {
    const L = (Array.isArray(lignes) ? lignes : [])
      .map(l => ({
        compte: String((l && l.compte) || '').trim(),
        libelle: String((l && l.libelle) || ''),
        debit: round3(Math.max(0, Number(l && l.debit) || 0)),
        credit: round3(Math.max(0, Number(l && l.credit) || 0))
      }))
      .filter(l => l.compte && (l.debit || l.credit));
    if (!L.length) return { ok: false, motif: 'La balance d\'ouverture est vide.' };
    const d = round3(L.reduce((s, l) => s + l.debit, 0));
    const c = round3(L.reduce((s, l) => s + l.credit, 0));
    if (round3(d - c) !== 0) return { ok: false, motif: `La balance ne s'équilibre pas : ${d.toFixed(3)} au débit contre ${c.toFixed(3)} au crédit.`, ecart: round3(d - c) };
    // Une seule ouverture par livre : la refaire remplace la précédente, elle ne s'y ajoute pas.
    const ancienne = livre.ecritures.filter(e => e.journal === 'AN' && e.piece === 'OUVERTURE');
    if (ancienne.some(e => e.statut === 'validee' && livre.ecritures.length > ancienne.length)) {
      // On ne retire une ouverture validée que si elle est seule : sinon tout ce qui suit s'appuie
      // dessus, et la remplacer en silence changerait chaque solde du livre.
      return { ok: false, motif: 'Ce livre porte déjà une ouverture validée et des écritures : reprendre le dossier à zéro effacerait leur point de départ.' };
    }
    livre.ecritures = livre.ecritures.filter(e => !(e.journal === 'AN' && e.piece === 'OUVERTURE'));
    const e = ajouterEcriture(livre, {
      date: dateIso, journal: 'AN', piece: 'OUVERTURE', libelle: 'Balance d\'ouverture',
      source: 'an', mois: String(dateIso).slice(0, 7), lignes: L
    }, qui, quand);
    const v = validerEcriture(livre, e.id, qui, quand);
    if (!v.ok) { livre.ecritures = livre.ecritures.filter(x => x.id !== e.id); return v; }
    livre.ouverture = { date: String(dateIso || ''), source: source || 'balance', lignes: L.map(l => ({ compte: l.compte, debit: l.debit, credit: l.credit })) };
    trace(livre, qui, 'reprise', `${L.length} compte(s), ${d.toFixed(3)}`, quand);
    return { ok: true, ecriture: e, total: d };
  }

  // Les écritures du livre, aplaties en LIGNES — la matière des quatre lectures de la 9.1.0. Un
  // brouillard n'entre pas dans une balance : ce n'est pas encore de la comptabilité.
  function lignesDuLivre(livre, opts) {
    const o = opts || {};
    return (livre.ecritures || [])
      .filter(e => o.brouillard ? true : e.statut !== 'brouillard')
      .filter(e => !o.du || (e.date >= o.du && e.date <= (o.au || '9999-12-31')))
      // Le contrat est celui d'`entreesDepuisCsv`, au champ près : `account` et `label`, pas
      // `compte` et `libelle`. C'est ce qui permet aux QUATRE lectures de la 9.1.0 de servir telles
      // quelles sur le livre — deux contrats voisins mais différents auraient obligé à réécrire la
      // balance pour le cabinet, et c'est exactement ce que ce module existe pour éviter.
      .flatMap(e => e.lignes.map(l => ({
        numero: e.numero || 0, date: e.date, journal: e.journal, piece: e.piece,
        // `tiers` est le NOM DU TIERS, pas le libellé (9.8.5). Écrire `tiers: l.libelle` — ce que
        // faisait la 9.2.0 — revenait à dire que le client d'une facture s'appelle « Facture
        // FAC-2026-014 ». Vide quand la ligne n'en porte pas : « (sans tiers) » est honnête, un
        // libellé recopié ne l'est pas.
        account: l.compte, tiers: l.tiers || '', label: l.libelle || e.libelle,
        debit: l.debit, credit: l.credit, lettre: l.lettre || '',
        tiersId: l.tiersId || '', ecritureId: e.id, statut: e.statut
      })));
  }

  // Regrouper des LIGNES plates (celles du CSV d'un paquet) en ÉCRITURES. Le CSV du paquet est une
  // liste de lignes ; le livre, lui, raisonne en pièces — c'est la pièce qui s'équilibre, qui porte
  // un numéro et qui se contre-passe. La clé est celle de `cleDePiece` : journal, pièce, date.
  //
  // Ce que cette fonction NE fait pas : juger. Une pièce déséquilibrée passe telle quelle et se
  // fera refuser à la validation, avec son motif. La rejeter ici la ferait disparaître du livre
  // sans que personne sache qu'elle existait — le contraire de ce qu'un comptable veut.
  function piecesDepuisLignes(lignes) {
    const par = new Map();
    (lignes || []).forEach(l => {
      const cle = cleDePiece(l);
      if (!par.has(cle)) {
        par.set(cle, {
          date: l.date || '', journal: l.journal || '', piece: l.piece || '',
          libelle: l.label || '', lignes: []
        });
      }
      const e = par.get(cle);
      if (!e.libelle && l.label) e.libelle = l.label;
      e.lignes.push({
        compte: txt(l.account), tiersId: l.tiersId || null,
        // Le tiers a désormais SA case (9.8.5). Avant, il servait de repli au libellé et
        // disparaissait dès que le libellé existait — c'est-à-dire toujours.
        tiers: txt(l.tiers),
        libelle: l.label || l.tiers || '',
        debit: round3(num(l.debit)), credit: round3(num(l.credit)),
        lettre: l.lettre || ''
      });
    });
    return Array.from(par.values());
  }

  // ================================================================ LA SAISIE (9.3.0)
  //
  // L'écran où un comptable passe ses journées. Tout ce qui suit est PUR : les règles de la saisie
  // se prouvent sans Electron, sans disque et sans clavier.
  //
  // Ce que la 9.2.0 avait posé et qui ne bouge pas : une validée ne se modifie jamais, le numéro
  // naît à la validation, le contrôle passe AVANT l'attribution. Ce que la 9.3.0 ajoute, c'est ce
  // qu'on fait AUTOUR : modifier et supprimer un brouillard (les deux gestes qui n'existaient pas,
  // donc une saisie qu'on ne pouvait pas corriger), valider un lot, extourner, chercher, et les
  // deux mécanismes qui font gagner du temps sans jamais écrire à la place de quelqu'un — les
  // guides et les abonnements.
  //
  // Aucune de ces fonctions ne trace : c'est l'appelant qui trace, en passant `quoi` à la porte
  // d'écriture unique (`ecrireLeLivre`, 9.2.0). Deux endroits qui tracent le même geste écrivent la
  // piste d'audit en double, et une piste d'audit en double ne se lit plus.

  // Les dates, en UTC PUR (règle 5.2.3). Un jour de calendrier n'est jamais un instant : à minuit à
  // Tunis il est 23 h la veille en UTC, et toute l'arithmétique se décalerait d'un jour.
  const jourUTC = iso => new Date(String(iso) + 'T00:00:00Z');
  const isoUTC = d => d.toISOString().slice(0, 10);
  const estUnJour = iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''));

  function premierDuMoisSuivant(iso) {
    if (!estUnJour(iso)) return '';
    const d = jourUTC(iso);
    return isoUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
  }

  // Ajouter des mois à un jour du calendrier. Le jour se GARDE et ne recule que s'il n'existe pas
  // dans le mois d'arrivée : 31 janvier + 1 mois = 28 février, pas le 3 mars.
  function ajouterMoisIso(iso, n) {
    if (!estUnJour(iso)) return '';
    const d = jourUTC(iso);
    const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (Number(n) || 0), 1));
    const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
    return isoUTC(new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), Math.min(d.getUTCDate(), dernier))));
  }

  // Comparer sans accent : « interets » trouve « Intérêts ». `\p{M}` après une décomposition NFD,
  // parce qu'un intervalle de caractères combinants écrit en dur dans la source est illisible et
  // se fait manger par le premier éditeur qui normalise le fichier.
  const sansAccents = s => String(s == null ? '' : s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  // Ce qui manque pour que la pièce tombe juste. C'est le moteur du « Tab solde automatiquement » :
  // l'écran ne calcule rien lui-même, sinon sa façon d'arrondir finirait par différer de celle de
  // la validation, et une pièce soldée à l'écran serait refusée à l'enregistrement.
  function soldeDeLignes(lignes) {
    const L = Array.isArray(lignes) ? lignes : [];
    const debit = round3(L.reduce((s, l) => s + Math.max(0, num(l && l.debit)), 0));
    const credit = round3(L.reduce((s, l) => s + Math.max(0, num(l && l.credit)), 0));
    const ecart = round3(debit - credit);
    return {
      debit, credit, ecart,
      equilibre: ecart === 0,
      // Ce qu'il faut poser sur une ligne neuve. Un montant négatif CHANGE DE COLONNE (règle
      // 6.3.0) : il ne garde jamais son signe.
      solde: ecart > 0 ? { debit: 0, credit: ecart } : ecart < 0 ? { debit: round3(-ecart), credit: 0 } : { debit: 0, credit: 0 }
    };
  }

  // Chercher un compte par NUMÉRO ou par NOM pendant la frappe. L'ordre n'est pas décoratif : celui
  // qui tape « 411 » veut le compte 411, pas « Achats 411xx » ; celui qui tape « client » veut les
  // comptes dont le nom commence par là. Un classement au hasard rend la liste inutilisable, et on
  // retourne taper le numéro de mémoire — ce que cette liste existe précisément pour éviter.
  function comptesQuiCorrespondent(plan, q, max) {
    const terme = sansAccents(q).trim();
    const n = Math.max(1, Number(max) || 12);
    const tous = (Array.isArray(plan) ? plan : []).filter(c => c && c.compte && !c.desactive);
    if (!terme) return tous.slice().sort((a, b) => (a.compte < b.compte ? -1 : 1)).slice(0, n);
    const mots = terme.split(/\s+/).filter(Boolean);
    const rang = c => {
      const numero = String(c.compte);
      const lib = sansAccents(c.libelle);
      if (numero === terme) return 0;
      if (numero.startsWith(terme)) return 1;
      if (lib.startsWith(terme)) return 2;
      if (mots.every(m => numero.includes(m) || lib.includes(m))) return 3;
      return -1;
    };
    return tous.map(c => ({ c, r: rang(c) })).filter(x => x.r >= 0)
      .sort((a, b) => a.r - b.r || (a.c.compte < b.c.compte ? -1 : 1))
      .slice(0, n).map(x => x.c);
  }

  // Modifier un brouillard. Le garde-fou est ici, pas dans l'écran : `modifierEcriture` est le seul
  // chemin qui touche aux lignes d'une écriture existante, et il refuse une validée. Un test relit
  // la source et exige qu'aucune autre fonction n'écrive dans `ecriture.lignes`.
  // Une écriture qu'un relevé désigne ne se modifie ni ne se supprime en douce : le rapprochement
  // pointerait un montant qui a changé, ou une écriture disparue, et il continuerait d'afficher
  // « rapproché ». Même parade que pour le lettrage — on nomme, et on dit le geste qui débloque.
  function rapprochementDe(livre, id) {
    for (const r of (livre.releves || [])) {
      for (const l of r.lignes) if (l.rapprochement && l.rapprochement.ecritureId === id) return { releve: r, ligne: l };
    }
    return null;
  }

  function modifierEcriture(livre, id, patch) {
    const e = (livre.ecritures || []).find(x => x.id === id);
    if (!e) return { ok: false, motif: 'Cette écriture n\'existe pas.' };
    if (e.statut !== 'brouillard') {
      return { ok: false, motif: 'Cette écriture est validée : elle ne se modifie pas, elle se contre-passe.' };
    }
    if (rapprochementDe(livre, id)) {
      return { ok: false, motif: 'Cette écriture est rapprochée d\'une ligne de relevé : défais le rapprochement d\'abord, sinon il désignerait un montant qui a changé.' };
    }
    const p = patch || {};
    ['journal', 'piece', 'libelle'].forEach(k => { if (p[k] !== undefined) e[k] = String(p[k] == null ? '' : p[k]); });
    if (p.pieceJointe !== undefined) e.pieceJointe = p.pieceJointe || null;
    if (p.date !== undefined) { e.date = String(p.date || ''); e.mois = e.date.slice(0, 7); }
    if (p.source !== undefined && SOURCES_ECRITURE.includes(p.source)) e.source = p.source;
    if (Array.isArray(p.lignes)) {
      e.lignes = p.lignes.map(l => ({
        compte: String((l && l.compte) || '').trim(),
        tiersId: (l && l.tiersId) || null,
        libelle: String((l && l.libelle) || ''),
        debit: round3(Math.max(0, Number(l && l.debit) || 0)),
        credit: round3(Math.max(0, Number(l && l.credit) || 0)),
        lettre: String((l && l.lettre) || '')
      }));
      e.lignes.forEach(l => assurerCompte(livre, l.compte, l.libelle));
    }
    return { ok: true, ecriture: e };
  }

  function supprimerEcriture(livre, id) {
    const e = (livre.ecritures || []).find(x => x.id === id);
    if (!e) return { ok: false, motif: 'Cette écriture n\'existe pas.' };
    if (e.statut !== 'brouillard') {
      return { ok: false, motif: 'Une écriture validée ne se supprime pas : elle se contre-passe. C\'est ce qui fait qu\'un livre dit la vérité de ce qui a été fait.' };
    }
    if ((e.lignes || []).some(l => l.lettre)) {
      return { ok: false, motif: 'Cette écriture est lettrée : délettre d\'abord, sinon le lettrage désignerait une écriture disparue.' };
    }
    if (rapprochementDe(livre, id)) {
      return { ok: false, motif: 'Cette écriture est rapprochée d\'une ligne de relevé : défais le rapprochement d\'abord, sinon il désignerait une écriture disparue.' };
    }
    livre.ecritures = livre.ecritures.filter(x => x.id !== id);
    return { ok: true, ecriture: e };
  }

  // Valider un LOT — un journal, un mois, ou une sélection. Chaque pièce passe par `validerEcriture`
  // une par une : c'est ce qui garantit que le contrôle reste avant l'attribution, donc qu'une pièce
  // refusée au milieu du lot ne troue pas la numérotation. Les refusées sont NOMMÉES : un lot qui
  // dirait « 12 validées » en avalant 3 refus en silence serait pire qu'un refus global.
  //
  // L'ordre est celui de la DATE puis de la saisie. Le numéro suit toujours l'ordre de validation
  // (règle 2) ; valider un lot étant UN geste, autant que ses numéros se lisent dans l'ordre du
  // journal plutôt que dans celui, invisible, où les pièces ont été tapées.
  function validerLot(livre, filtre, qui, quand) {
    const f = filtre || {};
    const cibles = (livre.ecritures || [])
      .filter(e => e.statut === 'brouillard')
      .filter(e => !f.journal || e.journal === f.journal)
      .filter(e => !f.mois || String(e.date || '').slice(0, 7) === f.mois)
      .filter(e => !Array.isArray(f.ids) || f.ids.includes(e.id))
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (Number(a.creeLe) || 0) - (Number(b.creeLe) || 0)));
    const validees = [], refusees = [];
    cibles.forEach(e => {
      const r = validerEcriture(livre, e.id, qui, quand);
      if (r.ok) validees.push({ id: e.id, numero: e.numero, piece: e.piece, journal: e.journal, date: e.date });
      else refusees.push({ id: e.id, piece: e.piece, journal: e.journal, date: e.date, motif: r.motif, motifs: r.motifs || [] });
    });
    return { ok: true, candidates: cibles.length, validees, refusees };
  }

  // Extourner : le miroir au 1er du mois suivant. Ce n'est PAS une contre-passation — l'écriture
  // d'origine reste `validee` et garde sa place dans son mois. C'est le geste des charges à payer
  // et des produits à recevoir : on provisionne en fin de mois, on annule au début du suivant, et
  // les deux écritures existent vraiment.
  function extourner(livre, id, qui, quand) {
    const e = (livre.ecritures || []).find(x => x.id === id);
    if (!e) return { ok: false, motif: 'Cette écriture n\'existe pas.' };
    if (e.statut !== 'validee') return { ok: false, motif: 'On extourne une écriture validée. Un brouillard se modifie ou se supprime.' };
    if (livre.ecritures.some(x => x.extourneDe === id)) return { ok: false, motif: 'Cette écriture a déjà été extournée.' };
    const date = premierDuMoisSuivant(e.date);
    if (!date) return { ok: false, motif: 'Cette écriture n\'a pas de date lisible : impossible de savoir quel est le mois suivant.' };
    // Une extourne de décembre tombe au 1er janvier, c'est-à-dire dans l'exercice SUIVANT — et un
    // livre porte un seul exercice. On le dit au lieu de la poser silencieusement au mauvais
    // endroit : une écriture de janvier rangée dans le livre de décembre fausserait les deux.
    if (date > String(livre.exercice.au)) {
      return { ok: false, motif: `L'extourne tomberait le ${date}, après la fin de cet exercice (${livre.exercice.au}). Elle se saisit dans le livre de l'exercice suivant — c'est là qu'elle doit vivre.` };
    }
    const miroir = ajouterEcriture(livre, {
      date, journal: e.journal, piece: e.piece,
      libelle: 'Extourne — ' + e.libelle,
      source: e.source, mois: date.slice(0, 7), extourneDe: id,
      lignes: e.lignes.map(l => ({ compte: l.compte, tiersId: l.tiersId, libelle: l.libelle, debit: l.credit, credit: l.debit }))
    }, qui, quand);
    const r = validerEcriture(livre, miroir.id, qui, quand);
    if (!r.ok) { livre.ecritures = livre.ecritures.filter(x => x.id !== miroir.id); return r; }
    trace(livre, qui, 'extourne', `${e.journal} ${e.piece} n° ${e.numero} → n° ${miroir.numero} au ${date}`, quand);
    return { ok: true, ecriture: miroir };
  }

  // Chercher dans tout le journal de l'exercice : pièce, tiers, libellé, compte, numéro, montant.
  // Un comptable cherche « le virement de 1 191 » aussi souvent que « la facture Trabelsi » — un
  // moteur qui ne saurait pas lire un montant enverrait à la liste complète, qu'on relit à la main.
  function chercherEcritures(livre, q, opts) {
    const o = opts || {};
    const terme = sansAccents(q).trim();
    const mots = terme.split(/\s+/).filter(Boolean);
    const brut = terme.replace(',', '.');
    const montant = /^\d+(\.\d{1,3})?$/.test(brut) ? round3(Number(brut)) : null;
    return (livre.ecritures || [])
      .filter(e => !o.journal || e.journal === o.journal)
      .filter(e => !o.statut || e.statut === o.statut)
      .filter(e => !o.du || (e.date >= o.du && e.date <= (o.au || '9999-12-31')))
      .filter(e => {
        if (!mots.length) return true;
        const foin = sansAccents([
          e.piece, e.libelle, e.journal, e.date, e.numero == null ? '' : e.numero,
          (e.lignes || []).map(l => `${l.compte} ${l.libelle}`).join(' ')
        ].join(' '));
        if (mots.every(m => foin.includes(m))) return true;
        return montant != null && (e.lignes || []).some(l => round3(l.debit) === montant || round3(l.credit) === montant);
      })
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (Number(b.creeLe) || 0) - (Number(a.creeLe) || 0)))
      .slice(0, Math.max(1, Number(o.max) || 200));
  }

  // ---------------------------------------------------------------- guides et abonnements
  //
  // Un GUIDE préremplit, il n'écrit pas. Un ABONNEMENT est un guide plus une périodicité, et il
  // génère EN BROUILLARD, jamais une validée d'office : un logiciel qui validerait tout seul une
  // écriture que personne n'a regardée engagerait le comptable sur des chiffres qu'il n'a pas vus.
  //
  // Ni l'un ni l'autre ne vit dans `livre.json` (format figé, SPEC-DATA-005) : les guides au niveau
  // du cabinet, les abonnements sur le dossier.

  function guideValide(guide) {
    const g = guide || {};
    const motifs = [];
    if (!txt(g.nom)) motifs.push('Le guide a besoin d\'un nom : c\'est lui qu\'on tape pour le retrouver.');
    if (!txt(g.journal)) motifs.push('Le journal manque : c\'est lui qui range les écritures que ce guide produira.');
    const lignes = (Array.isArray(g.lignes) ? g.lignes : []).filter(l => l && (txt(l.compte) || txt(l.libelle)));
    if (lignes.length < 2) motifs.push('Un guide a au moins deux lignes : un compte au débit, un compte au crédit.');
    lignes.forEach((l, i) => {
      if (!/^\d{1,12}$/.test(txt(l.compte))) motifs.push(`Ligne ${i + 1} : le compte doit être un numéro.`);
      if (l.sens !== 'debit' && l.sens !== 'credit') motifs.push(`Ligne ${i + 1} : il faut dire si la ligne va au débit ou au crédit.`);
      if (txt(l.montant) && num(l.montant) < 0) motifs.push(`Ligne ${i + 1} : un montant négatif change de colonne, il ne garde pas son signe.`);
      if (txt(l.taux) && num(l.taux) < 0) motifs.push(`Ligne ${i + 1} : un taux négatif n'existe pas.`);
    });
    const soldes = lignes.filter(l => l.solde).length;
    if (soldes > 1) motifs.push('Une seule ligne peut porter le solde : deux lignes qui réclament « le reste » n\'ont pas de réponse.');
    return { ok: !motifs.length, motif: motifs[0] || '', motifs };
  }

  // Le guide appliqué. Trois façons de poser un montant sur une ligne, dans cet ordre :
  //   — `montant` fixe (un abonnement de loyer),
  //   — `taux` en pourcentage du montant de base (la TVA),
  //   — `base` : le montant de base lui-même.
  // Et `solde: true` pour la ligne qui reçoit ce qui manque. Une ligne sans rien reste à zéro : on
  // la tape. Le guide PROPOSE, il ne devine pas — c'est la règle « aucun taux écrit en dur dans un
  // calcul » (5.0.0) appliquée à la saisie : le taux vient du guide, que le comptable a réglé.
  function ecritureDepuisGuide(guide, champs) {
    const g = guide || {}, c = champs || {};
    const base = num(c.montant);
    const lignes = (Array.isArray(g.lignes) ? g.lignes : []).filter(l => l && txt(l.compte)).map(l => {
      let m = 0;
      if (txt(l.montant)) m = round3(num(l.montant));
      else if (txt(l.taux)) m = round3(base * num(l.taux) / 100);
      else if (l.base) m = round3(base);
      return {
        compte: txt(l.compte), tiersId: l.tiersId || null,
        libelle: txt(l.libelle) || txt(c.libelle) || txt(g.nom),
        debit: l.sens === 'debit' ? m : 0,
        credit: l.sens === 'credit' ? m : 0,
        lettre: '',
        _solde: !!l.solde, _sens: l.sens
      };
    });
    const s = soldeDeLignes(lignes.filter(l => !l._solde));
    lignes.forEach(l => {
      if (!l._solde) return;
      // La ligne de solde reçoit ce qui manque, DANS SA COLONNE si elle en a une : un guide qui
      // dit « le crédit va en 401 » ne doit pas voir sa ligne basculer au débit sur un cas limite.
      const v = l._sens === 'debit' ? Math.max(0, s.ecart < 0 ? round3(-s.ecart) : 0) : Math.max(0, s.ecart > 0 ? s.ecart : 0);
      l.debit = l._sens === 'debit' ? (v || s.solde.debit) : 0;
      l.credit = l._sens === 'credit' ? (v || s.solde.credit) : 0;
    });
    lignes.forEach(l => { delete l._solde; delete l._sens; });
    return {
      date: txt(c.date), journal: txt(c.journal) || txt(g.journal), piece: txt(c.piece),
      libelle: txt(c.libelle) || txt(g.nom), source: 'saisie', lignes
    };
  }

  // Les occurrences d'un abonnement qui restent à générer. `faites` porte les mois DÉJÀ générés :
  // rejouer ne double donc rien, et c'est ce qui rend le geste sûr à répéter — la même règle que
  // l'import d'un paquet (9.2.0).
  function occurrencesAGenerer(abonnement, jusquA, faites) {
    const a = abonnement || {};
    const out = [];
    if (!a.actif) return out;
    if (!estUnJour(a.depuis)) return out;
    const deja = new Set(Array.isArray(faites) ? faites : (Array.isArray(a.faites) ? a.faites : []));
    const fin = estUnJour(jusquA) ? String(jusquA) : String(a.depuis);
    const pas = Math.max(1, Number(a.tousLesMois) || 1);
    let d = String(a.depuis);
    for (let garde = 0; garde < 600 && d && d <= fin; garde++) {
      if (!txt(a.jusqua) || d <= String(a.jusqua)) {
        if (!deja.has(d.slice(0, 7))) out.push(d);
      }
      d = ajouterMoisIso(d, pas);
    }
    return out;
  }

  // ---------------------------------------------------------------- la correspondance des comptes
  //
  // Le plan du client n'est pas celui du cabinet. La table traduit À L'IMPORT et À L'EXPORT, jamais
  // en réécrivant une validée (invariant 4 de SPEC-DATA-005) : une écriture validée porte le compte
  // sous lequel elle a été validée, et c'est ce compte-là qui fait foi.
  function correspondanceValide(table) {
    const motifs = [];
    const vus = new Set();
    (Array.isArray(table) ? table : []).forEach((r, i) => {
      const de = txt(r && r.de), vers = txt(r && r.vers);
      if (!de && !vers) return;                                  // une ligne vide n'est pas une faute
      if (!de || !vers) { motifs.push(`Ligne ${i + 1} : il faut les deux comptes — celui du client et celui du cabinet.`); return; }
      if (!/^\d{1,12}$/.test(de) || !/^\d{1,12}$/.test(vers)) { motifs.push(`Ligne ${i + 1} : un compte est un numéro.`); return; }
      if (de === vers) motifs.push(`Ligne ${i + 1} : ${de} se traduirait par lui-même — cette ligne ne sert à rien.`);
      if (vus.has(de)) motifs.push(`Ligne ${i + 1} : le compte ${de} est déjà traduit plus haut. Une correspondance ne peut pas avoir deux réponses.`);
      vus.add(de);
    });
    return { ok: !motifs.length, motif: motifs[0] || '', motifs };
  }

  // La correspondance la PLUS PRÉCISE gagne : 411001 avant 411. Sans cette règle, une ligne
  // « 4 → 5 » écraserait tout le reste selon l'ordre du tableau, et personne ne saurait laquelle a
  // servi. Un préfixe traduit la TÊTE et garde la queue : 411001 par « 411 → 3411 » donne 3411001.
  function compteCorrespondant(table, compte) {
    const n = txt(compte);
    if (!n) return n;
    let choix = null;
    (Array.isArray(table) ? table : []).forEach(r => {
      const de = txt(r && r.de);
      if (!de || !txt(r && r.vers)) return;
      if (n !== de && !(r.prefixe && n.startsWith(de))) return;
      if (!choix || de.length > txt(choix.de).length) choix = r;
    });
    if (!choix) return n;
    const de = txt(choix.de), vers = txt(choix.vers);
    return n === de ? vers : vers + n.slice(de.length);
  }

  // Les lignes traduites. Le contrat des lignes plates (`account`, 9.1.0) et celui du livre
  // (`compte`) coexistent : on traduit celui que la ligne porte, sans jamais inventer l'autre.
  function appliquerCorrespondance(lignes, table) {
    const t = (Array.isArray(table) ? table : []).filter(r => txt(r && r.de) && txt(r && r.vers));
    const L = Array.isArray(lignes) ? lignes : [];
    if (!t.length) return { lignes: L.slice(), traduites: 0 };
    let traduites = 0;
    const out = L.map(l => {
      const cle = l && l.compte !== undefined ? 'compte' : 'account';
      const avant = txt(l && l[cle]);
      const apres = compteCorrespondant(t, avant);
      if (!avant || apres === avant) return l;
      traduites++;
      return { ...l, [cle]: apres };
    });
    return { lignes: out, traduites };
  }

  // ---------------------------------------------------------------- les deux imports CSV
  //
  // Par NOM de colonne, jamais par position (règle 6.8.0) : un plan exporté d'un autre logiciel n'a
  // pas les mêmes colonnes ni le même ordre, et aligner à l'aveugle met des libellés dans « Débit »
  // sans que rien ne plante.
  const normEntete = s => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  function colonnesPar(tete, alias) {
    const out = {};
    tete.forEach((t, i) => {
      const n = normEntete(t);
      Object.keys(alias).forEach(k => { if (out[k] === undefined && alias[k].includes(n)) out[k] = i; });
    });
    return out;
  }

  function planDepuisCsv(rows) {
    const r = Array.isArray(rows) ? rows : [];
    if (!r.length) return { comptes: [], ignorees: [], motif: 'Le fichier est vide.' };
    const col = colonnesPar(r[0], {
      compte: ['compte', 'numero', 'numerodecompte', 'ncompte', 'code'],
      libelle: ['libelle', 'intitule', 'nom', 'designation'],
      nature: ['nature', 'type', 'classe'],
      parent: ['parent', 'rattachea', 'collectif']
    });
    if (col.compte === undefined || col.libelle === undefined) {
      return { comptes: [], ignorees: [], motif: 'Il faut au moins une colonne « Compte » et une colonne « Libellé ».' };
    }
    const comptes = [], ignorees = [], vus = new Set();
    r.slice(1).forEach((ligne, i) => {
      const n = String(ligne[col.compte] || '').trim();
      const lib = String(ligne[col.libelle] || '').trim();
      if (!n && !lib) return;                                  // ligne vide : on n'en parle pas
      if (!/^\d{1,12}$/.test(n)) { ignorees.push({ ligne: i + 2, motif: `« ${n || '(vide)'} » n'est pas un numéro de compte`, valeur: n }); return; }
      if (!lib) { ignorees.push({ ligne: i + 2, motif: `le compte ${n} n'a pas de libellé`, valeur: n }); return; }
      if (vus.has(n)) { ignorees.push({ ligne: i + 2, motif: `le compte ${n} figure deux fois`, valeur: n }); return; }
      vus.add(n);
      const nat = col.nature !== undefined ? normEntete(ligne[col.nature]) : '';
      comptes.push({
        compte: n, libelle: lib,
        nature: NATURES_COMPTE.includes(nat) ? nat : natureDeCompte(n),
        parent: col.parent !== undefined ? String(ligne[col.parent] || '').trim() || undefined : undefined,
        source: 'import'
      });
    });
    return { comptes, ignorees, motif: '' };
  }

  function balanceDepuisCsv(rows) {
    const r = Array.isArray(rows) ? rows : [];
    if (!r.length) return { lignes: [], ignorees: [], motif: 'Le fichier est vide.' };
    const col = colonnesPar(r[0], {
      compte: ['compte', 'numero', 'numerodecompte', 'ncompte', 'code'],
      libelle: ['libelle', 'intitule', 'nom', 'designation'],
      debit: ['debit', 'soldedebit', 'debiteur', 'soldedebiteur'],
      credit: ['credit', 'soldecredit', 'crediteur', 'soldecrediteur']
    });
    if (col.compte === undefined || col.debit === undefined || col.credit === undefined) {
      return { lignes: [], ignorees: [], motif: 'Il faut les colonnes « Compte », « Débit » et « Crédit ».' };
    }
    const lignes = [], ignorees = [];
    r.slice(1).forEach((ligne, i) => {
      const n = String(ligne[col.compte] || '').trim();
      if (!n) return;
      if (!/^\d{1,12}$/.test(n)) { ignorees.push({ ligne: i + 2, motif: `« ${n} » n'est pas un numéro de compte`, valeur: n }); return; }
      const d = nombreDepuisCsv(ligne[col.debit]), c = nombreDepuisCsv(ligne[col.credit]);
      if (!d && !c) return;                                    // un compte à zéro n'ouvre rien
      lignes.push({ compte: n, libelle: col.libelle !== undefined ? String(ligne[col.libelle] || '').trim() : '', debit: round3(d), credit: round3(c) });
    });
    return { lignes, ignorees, motif: '' };
  }

  // ============================================================================ LA BANQUE (9.5.0)
  //
  // Deux choses qu'on confond tout le temps, et qui n'ont ni le même modèle ni le même écran :
  // le RAPPROCHEMENT confronte le relevé de la banque au compte 532 (« la banque et mon livre
  // disent-ils la même chose ? ») ; le LETTRAGE relie une facture et son règlement sur le compte
  // d'un tiers (« ce client me doit-il encore quelque chose ? »). Deux modèles, deux tests.
  //
  // La question qui bloquait cette version — « quelles banques, et quel format chacune exporte ? »
  // — n'a pas de réponse, et n'en aura pas avant que le cabinet pilote ouvre ses fichiers. C'est
  // pour ça que rien ici ne connaît une banque : on associe les colonnes PAR NOM, et l'association
  // qu'un comptable corrige une fois se retient. Écrire un lecteur par banque aurait fait de chaque
  // nouvelle banque une nouvelle version du logiciel.
  const RELEVE_NIVEAUX = ['certain', 'probable', 'a-confirmer', 'aucun'];
  const RELEVE_JOURS = 3;          // ± n jours pour apparier une date — réglable, À VÉRIFIER

  const ALIAS_RELEVE = {
    date: ['date', 'dateoperation', 'dateopration', 'dateop', 'datevaleur', 'jour', 'dateecriture', 'datecriture'],
    libelle: ['libelle', 'libell', 'libelleoperation', 'intitule', 'intitul', 'description', 'motif', 'operation', 'oprtion', 'nature', 'detail'],
    montant: ['montant', 'mouvement', 'somme', 'amount'],
    debit: ['debit', 'dbit', 'retrait', 'sortie', 'depense', 'dpense'],
    credit: ['credit', 'crdit', 'versement', 'entree', 'entre', 'recette'],
    reference: ['reference', 'rfrence', 'ref', 'numero', 'numro', 'piece', 'pice', 'numoperation']
  };

  // L'association devinée : ce que l'écran propose avant que le comptable la corrige. Elle rend
  // AUSSI ce qu'elle n'a pas trouvé — un assistant qui ne dit pas ce qui lui manque ne sert à rien.
  function colonnesReleve(tete) {
    const col = colonnesPar(Array.isArray(tete) ? tete : [], ALIAS_RELEVE);
    const manque = [];
    if (col.date === undefined) manque.push('date');
    if (col.libelle === undefined) manque.push('libelle');
    if (col.montant === undefined && (col.debit === undefined || col.credit === undefined)) manque.push('montant');
    return { colonnes: col, manque, entetes: (tete || []).map(t => txt(t)) };
  }

  // Le signe est celui de la BANQUE : un crédit bancaire (l'argent entre) est positif, un débit
  // négatif. C'est le seul endroit du livre où un montant porte un signe, et c'est voulu : un
  // relevé se relit à côté de son original papier, et l'inverser rendrait la comparaison
  // impossible. La conversion en débit/crédit comptable se fait au rapprochement, pas ici.
  function releveDepuisCsv(rows, assoc) {
    const r = (Array.isArray(rows) ? rows : []).filter(l => Array.isArray(l) && l.some(c => txt(c)));
    if (!r.length) return { lignes: [], ignorees: [], colonnes: {}, motif: 'Le fichier est vide.' };
    const devine = colonnesReleve(r[0]);
    const col = (assoc && Object.keys(assoc).length) ? assoc : devine.colonnes;
    const aDate = col.date !== undefined, aLib = col.libelle !== undefined;
    const aMontant = col.montant !== undefined;
    const aDC = col.debit !== undefined && col.credit !== undefined;
    if (!aDate || !aLib || (!aMontant && !aDC)) {
      return {
        lignes: [], ignorees: [], colonnes: col, entetes: devine.entetes, manque: devine.manque,
        motif: 'Ce fichier n\'a pas les colonnes attendues : il faut une date, un libellé, et un montant (ou un débit et un crédit). Associe-les à la main, je retiendrai l\'association pour cette banque.'
      };
    }
    const lignes = [], ignorees = [];
    r.slice(1).forEach((l, i) => {
      const date = dateDepuisCsv(l[col.date]);
      const libelle = txt(l[col.libelle]);
      const montant = aMontant
        ? round3(nombreDepuisCsv(l[col.montant]))
        : round3(nombreDepuisCsv(l[col.credit]) - nombreDepuisCsv(l[col.debit]));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { ignorees.push({ ligne: i + 2, motif: `date illisible (« ${txt(l[col.date]).slice(0, 20)} »)` }); return; }
      if (!montant) { ignorees.push({ ligne: i + 2, motif: 'montant nul ou illisible' }); return; }
      lignes.push({
        id: '', date, libelle, montant,
        reference: col.reference !== undefined ? txt(l[col.reference]) : '',
        rapprochement: { niveau: 'aucun', ecritureId: '', ligne: -1, le: '', par: '' },
        ecritureId: ''
      });
    });
    return { lignes, ignorees, colonnes: col, entetes: devine.entetes, motif: '' };
  }

  // Le contrôle qui décide si un relevé entre : `soldeDebut + Σ montants = soldeFin`. Un relevé
  // dont la somme ne tombe pas juste a perdu des lignes — au découpage, au copier-coller, ou parce
  // qu'une page manque. L'importer quand même ferait un rapprochement faux que personne ne
  // saurait expliquer trois mois plus tard, d'où le refus AVEC l'écart (ERR-CAB-040).
  function releveValide(releve) {
    const R = releve || {};
    const L = Array.isArray(R.lignes) ? R.lignes : [];
    if (!txt(R.compte)) return { ok: false, motif: 'Choisis le compte bancaire de ce relevé avant de l\'importer : il ne se devine pas.' };
    if (!L.length) return { ok: false, motif: 'Ce relevé ne porte aucune ligne lisible.' };
    const somme = round3(L.reduce((s, l) => s + num(l.montant), 0));
    const attendu = round3(num(R.soldeDebut) + somme);
    const ecart = round3(attendu - num(R.soldeFin));
    if (ecart !== 0) {
      return {
        ok: false, ecart,
        motif: `Ce relevé ne se boucle pas : ${num(R.soldeDebut).toFixed(3)} au départ, ${somme.toFixed(3)} de mouvements, cela fait ${attendu.toFixed(3)} — et le relevé annonce ${num(R.soldeFin).toFixed(3)}. Il manque ${Math.abs(ecart).toFixed(3)} : il manque des lignes, ou le solde de fin n'est pas le bon.`
      };
    }
    return { ok: true, motif: '', somme };
  }

  function ajouterReleve(livre, releve, qui, quand) {
    const v = releveValide(releve);
    if (!v.ok) return { ok: false, motif: v.motif, ecart: v.ecart };
    livre.releves = Array.isArray(livre.releves) ? livre.releves : [];
    const emp = txt(releve.empreinte);
    // Deux fois le même fichier, c'est deux fois les mêmes mouvements : le rapprochement
    // trouverait deux lignes pour chaque écriture et n'en rapprocherait plus aucune avec certitude.
    if (emp && livre.releves.some(x => txt(x.empreinte) === emp)) {
      const deja = livre.releves.find(x => txt(x.empreinte) === emp);
      return { ok: false, motif: `Ce fichier a déjà été importé le ${txt(deja.importeLe).slice(0, 10) || '(date inconnue)'} (${txt(deja.du)} → ${txt(deja.au)}).` };
    }
    const id = 'REL-' + (livre.releves.length + 1) + '-' + String(quand || 0);
    const R = {
      id,
      compte: txt(releve.compte),
      banque: txt(releve.banque),
      du: txt(releve.du) || (releve.lignes[0] || {}).date || '',
      au: txt(releve.au) || (releve.lignes[releve.lignes.length - 1] || {}).date || '',
      soldeDebut: round3(num(releve.soldeDebut)),
      soldeFin: round3(num(releve.soldeFin)),
      fichier: txt(releve.fichier),
      empreinte: emp,
      importeLe: txt(quand ? new Date(quand).toISOString() : ''),
      par: txt(qui),
      lignes: releve.lignes.map((l, i) => ({
        ...l, id: `${id}-L${i + 1}`,
        rapprochement: { niveau: 'aucun', ecritureId: '', ligne: -1, le: '', par: '' },
        ecritureId: txt(l.ecritureId)
      }))
    };
    livre.releves.push(R);
    trace(livre, qui, 'relevé importé', `${R.compte} ${R.du} → ${R.au} (${R.lignes.length} ligne(s))`, quand);
    return { ok: true, releve: R };
  }

  // Un relevé mal importé se retire SANS toucher au journal : le lien va de la ligne vers
  // l'écriture, jamais l'inverse (SPEC-DATA-005). Les écritures nées d'une ligne, elles, restent —
  // elles ont été décidées par un clic, et ce clic ne se défait pas en effaçant un fichier.
  function supprimerReleve(livre, id) {
    const L = Array.isArray(livre.releves) ? livre.releves : [];
    const i = L.findIndex(r => r.id === id);
    if (i < 0) return { ok: false, motif: 'Ce relevé n\'existe pas.' };
    const nees = L[i].lignes.filter(l => txt(l.ecritureId)).length;
    livre.releves = L.filter((_, k) => k !== i);
    return { ok: true, ecrituresGardees: nees };
  }

  // Les lignes du livre qui touchent le compte bancaire, du point de vue de la BANQUE : un débit
  // comptable sur le 532 (l'argent entre) est un crédit bancaire, donc un montant positif.
  function lignesBancaires(livre, compte) {
    const n = txt(compte);
    const out = [];
    (livre.ecritures || []).forEach(e => {
      // Le brouillard COMPTE ici, et c'est un choix : le comptable saisit depuis le relevé et ne
      // valide qu'ensuite. L'exclure rendrait le rapprochement inutile très exactement pendant la
      // demi-journée où il sert. Ce qu'il fallait en contrepartie, c'est qu'un brouillard rapproché
      // ne puisse plus être modifié ni supprimé en douce : la garde vit dans les deux fonctions qui
      // le feraient, comme celle du lettrage.
      (e.lignes || []).forEach((l, i) => {
        if (txt(l.compte) !== n) return;
        out.push({ ecritureId: e.id, ligne: i, date: e.date, libelle: l.libelle || e.libelle, piece: e.piece, statut: e.statut, montant: round3(num(l.debit) - num(l.credit)) });
      });
    });
    return out;
  }

  const motsDe = s => sansAccents(String(s || '').toLowerCase()).split(/[^a-z0-9]+/).filter(m => m.length >= 4);
  // On COMPTE les mots communs au lieu de répondre oui/non. « REMISE CHEQUE DUPONT » ressemble aux
  // deux écritures « CHEQUE DUPONT » et « CHEQUE MARTIN » si l'on se contente d'un mot partagé —
  // et le mot partagé est « cheque », celui qui n'apprend rien. C'est le nombre de mots communs qui
  // départage, et seulement quand un candidat en a STRICTEMENT plus que tous les autres.
  function motsCommuns(a, b) {
    const A = motsDe(a), B = motsDe(b);
    return A.filter(m => B.includes(m)).length;
  }
  const ecartJours = (a, b) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return 99999;
    return Math.abs(Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000));
  };

  // Le rapprochement automatique, à quatre niveaux. La règle qui ne bouge pas : **seul `certain` se
  // pose d'office, et une ambiguïté n'est JAMAIS certaine**. Deux écritures du même montant à deux
  // jours d'écart, c'est exactement le cas où un logiciel qui tranche tout seul se trompe sans que
  // personne ne le voie — et un rapprochement faux est pire qu'un rapprochement absent, parce qu'il
  // ferme la question.
  function rapprocherAuto(livre, releveId, opts) {
    const o = opts || {};
    const jours = o.jours == null ? RELEVE_JOURS : Math.max(0, Number(o.jours) || 0);
    const R = (livre.releves || []).find(x => x.id === releveId);
    if (!R) return { ok: false, motif: 'Ce relevé n\'existe pas.' };
    const dispo = lignesBancaires(livre, R.compte);
    // Ce qui est déjà rapproché ailleurs ne se propose plus : sinon la même écriture répondrait de
    // deux lignes du relevé, et le compte tomberait juste deux fois pour un seul mouvement.
    const prises = new Set();
    (livre.releves || []).forEach(x => x.lignes.forEach(l => {
      if (l.rapprochement && l.rapprochement.ecritureId) prises.add(l.rapprochement.ecritureId + '#' + l.rapprochement.ligne);
    }));
    const compte = { certain: 0, probable: 0, 'a-confirmer': 0, aucun: 0 };
    const detail = [];
    R.lignes.forEach(l => {
      if (l.rapprochement && l.rapprochement.niveau !== 'aucun') { compte[l.rapprochement.niveau]++; return; }
      const candidats = dispo
        .filter(c => !prises.has(c.ecritureId + '#' + c.ligne))
        .filter(c => round3(c.montant - num(l.montant)) === 0)
        .filter(c => ecartJours(c.date, l.date) <= jours);
      let niveau = 'aucun';
      if (candidats.length === 1) niveau = 'certain';
      else if (candidats.length > 1) {
        const scores = candidats.map(c => motsCommuns(c.libelle, l.libelle));
        const meilleur = Math.max(...scores);
        niveau = meilleur > 0 && scores.filter(s => s === meilleur).length === 1 ? 'probable' : 'a-confirmer';
      }
      if (niveau === 'certain') {
        const c = candidats[0];
        l.rapprochement = { niveau: 'certain', ecritureId: c.ecritureId, ligne: c.ligne, le: txt(o.date), par: 'auto' };
        prises.add(c.ecritureId + '#' + c.ligne);
      }
      compte[niveau]++;
      detail.push({ ligneId: l.id, niveau, candidats: niveau === 'certain' ? [] : candidats });
    });
    return { ok: true, compte, detail, jours };
  }

  // Poser ou défaire un rapprochement à la main. Même `certain` reste défaisable : l'automatique
  // propose, le comptable décide, et un logiciel qui ne se laisse pas contredire est un logiciel
  // qu'on finit par contourner ailleurs.
  function rapprocherLigne(livre, releveId, ligneId, choix, qui, quand) {
    const R = (livre.releves || []).find(x => x.id === releveId);
    if (!R) return { ok: false, motif: 'Ce relevé n\'existe pas.' };
    const l = R.lignes.find(x => x.id === ligneId);
    if (!l) return { ok: false, motif: 'Cette ligne de relevé n\'existe pas.' };
    const c = choix || {};
    if (!c.ecritureId) {
      l.rapprochement = { niveau: 'aucun', ecritureId: '', ligne: -1, le: '', par: '' };
      trace(livre, qui, 'rapprochement défait', `${R.compte} ${l.date} ${num(l.montant).toFixed(3)}`, quand);
      return { ok: true, niveau: 'aucun' };
    }
    const e = (livre.ecritures || []).find(x => x.id === c.ecritureId);
    if (!e) return { ok: false, motif: 'Cette écriture n\'existe pas.' };
    const i = Number(c.ligne);
    if (!(e.lignes || [])[i] || txt(e.lignes[i].compte) !== txt(R.compte)) {
      return { ok: false, motif: `Cette ligne d'écriture ne touche pas le compte ${R.compte}.` };
    }
    const niveau = RELEVE_NIVEAUX.includes(c.niveau) ? c.niveau : 'certain';
    if (niveau === 'aucun') return { ok: false, motif: 'Un rapprochement posé ne peut pas être « aucun » : c\'est ce que veut dire le défaire.' };
    l.rapprochement = { niveau, ecritureId: e.id, ligne: i, le: txt(c.date), par: txt(qui) };
    trace(livre, qui, 'rapprochement', `${R.compte} ${l.date} ${num(l.montant).toFixed(3)} → ${e.journal} ${e.piece || ''}`, quand);
    return { ok: true, niveau };
  }

  // Tout défaire d'un coup. Après un rapprochement automatique qui s'est trompé de relevé ou de
  // compte, défaire ligne par ligne serait trente clics — et trente occasions d'en oublier une.
  function derapprocherReleve(livre, releveId, qui, quand) {
    const R = (livre.releves || []).find(x => x.id === releveId);
    if (!R) return { ok: false, motif: 'Ce relevé n\'existe pas.' };
    let n = 0;
    R.lignes.forEach(l => {
      if (!(l.rapprochement && l.rapprochement.ecritureId)) return;
      l.rapprochement = { niveau: 'aucun', ecritureId: '', ligne: -1, le: '', par: '' };
      n++;
    });
    if (n) trace(livre, qui, 'rapprochements défaits', `${R.compte} ${R.du} → ${R.au} — ${n}`, quand);
    return { ok: true, defaits: n };
  }

  // Les suspens, DANS LES DEUX SENS (règle 6.8.1) : ce que la banque porte et que le livre n'a pas,
  // et ce que le livre porte et que la banque n'a pas. Ne regarder qu'un seul côté laisserait
  // passer un chèque émis jamais encaissé — c'est-à-dire l'écart le plus courant.
  function suspens(livre, releveId) {
    const R = (livre.releves || []).find(x => x.id === releveId);
    if (!R) return { banque: [], livre: [], ecart: 0 };
    const rapprochees = new Set();
    (livre.releves || []).filter(x => x.compte === R.compte).forEach(x => x.lignes.forEach(l => {
      if (l.rapprochement && l.rapprochement.ecritureId) rapprochees.add(l.rapprochement.ecritureId + '#' + l.rapprochement.ligne);
    }));
    const cote = R.lignes.filter(l => !(l.rapprochement && l.rapprochement.ecritureId));
    const cotL = lignesBancaires(livre, R.compte)
      .filter(c => c.date <= (R.au || '9999-12-31'))
      .filter(c => !rapprochees.has(c.ecritureId + '#' + c.ligne));
    const sB = round3(cote.reduce((s, l) => s + num(l.montant), 0));
    const sL = round3(cotL.reduce((s, c) => s + c.montant, 0));
    return { banque: cote, livre: cotL, ecart: round3(sB - sL) };
  }

  // L'écriture PROPOSÉE depuis une ligne non rapprochée. Elle n'est jamais enregistrée ici : cette
  // fonction rend un brouillon, et il faut un clic pour qu'il devienne une écriture — la banque ne
  // fait pas foi contre la pièce. La table libellé → compte part VIDE : écrire « STEG → 606 » dans
  // le code serait poser une règle comptable que personne n'a validée (règle de la 9.1.1 : la
  // valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien). Elle se
  // remplit toute seule, un libellé à la fois, quand le comptable choisit un compte.
  function compteDuLibelle(table, libelle) {
    const L = sansAccents(String(libelle || '').toLowerCase());
    const T = (Array.isArray(table) ? table : []).filter(x => x && txt(x.motif) && txt(x.compte));
    // Le motif le plus LONG gagne : « STEG PRELEVEMENT » est plus précis que « STEG », et sans
    // cette règle le résultat dépendrait de l'ordre du tableau (règle de la correspondance, 9.3.0).
    let choisi = null;
    T.forEach(x => {
      if (!L.includes(sansAccents(txt(x.motif).toLowerCase()))) return;
      if (!choisi || txt(x.motif).length > txt(choisi.motif).length) choisi = x;
    });
    return choisi ? { compte: txt(choisi.compte), libelle: txt(choisi.libelle), motif: txt(choisi.motif) } : null;
  }

  function ecritureProposee(ligne, table, opts) {
    const o = opts || {};
    const l = ligne || {};
    const m = round3(num(l.montant));
    const trouve = compteDuLibelle(table, l.libelle);
    const banque = txt(o.compte);
    const contre = trouve ? trouve.compte : '';
    const lib = txt(l.libelle) || 'Mouvement bancaire';
    return {
      journal: txt(o.journal) || 'BQ',
      date: txt(l.date),
      piece: txt(l.reference),
      libelle: lib,
      source: 'banque',
      // L'argent entre (montant > 0) : la banque est débitée. Il sort : elle est créditée.
      lignes: [
        { compte: banque, libelle: lib, debit: m > 0 ? Math.abs(m) : 0, credit: m < 0 ? Math.abs(m) : 0 },
        { compte: contre, libelle: trouve && trouve.libelle ? trouve.libelle : lib, debit: m < 0 ? Math.abs(m) : 0, credit: m > 0 ? Math.abs(m) : 0 }
      ],
      // Sans règle connue, la contrepartie reste VIDE et `ecritureValide` refusera l'enregistrement.
      // C'est voulu : verser d'office au 471 rangerait le doute dans un compte que personne ne
      // solde, et la question disparaîtrait sans avoir été posée.
      aChoisir: !contre,
      regle: trouve ? trouve.motif : ''
    };
  }

  // Le lettrage AUTOMATIQUE : on ne relie que ce qui se solde exactement (règle de `lettrer`), et
  // on ne relie jamais deux pièces que la référence ou le montant ne désignent pas ensemble.
  // Un lettrage automatique trop généreux est pire qu'aucun : il affirme qu'une facture est payée.
  function lettrageAuto(livre, compte, opts) {
    const o = opts || {};
    const jours = o.jours == null ? 90 : Math.max(0, Number(o.jours) || 0);
    const n = txt(compte);
    const ouvertes = [];
    (livre.ecritures || []).forEach(e => {
      if (e.statut === 'brouillard') return;
      (e.lignes || []).forEach(l => {
        if (txt(l.compte) !== n || txt(l.lettre)) return;
        ouvertes.push({ id: e.id, date: e.date, piece: txt(e.piece), tiersId: txt(l.tiersId), montant: round3(num(l.debit) - num(l.credit)) });
      });
    });
    const debits = ouvertes.filter(x => x.montant > 0);
    const credits = ouvertes.filter(x => x.montant < 0);
    const utilises = new Set();
    const poses = [];
    debits.forEach(d => {
      if (utilises.has(d.id)) return;
      const cands = credits.filter(c => !utilises.has(c.id) && round3(c.montant + d.montant) === 0)
        .filter(c => !d.tiersId || !c.tiersId || c.tiersId === d.tiersId)
        .filter(c => ecartJours(c.date, d.date) <= jours);
      // La référence tranche quand plusieurs règlements du même montant existent ; sans elle, deux
      // candidats veulent dire qu'on ne sait pas, et on ne lettre pas.
      const parRef = cands.filter(c => d.piece && c.piece && (c.piece.includes(d.piece) || d.piece.includes(c.piece)));
      const choisi = parRef.length === 1 ? parRef[0] : (cands.length === 1 ? cands[0] : null);
      if (!choisi) return;
      const r = lettrer(livre, n, [d.id, choisi.id], '', o.par || 'auto', o.date || '');
      if (!r.ok) return;
      utilises.add(d.id); utilises.add(choisi.id);
      poses.push({ lettre: r.lettre, ecritures: [d.id, choisi.id], montant: d.montant });
    });
    return { ok: true, poses, restent: ouvertes.length - utilises.size };
  }

  // Les tranches d'âge, en UN seul endroit. Elles vivaient dans core.js depuis la 2.5.0 ; le
  // Cabinet ne charge pas core.js (l'application gratuite n'embarque pas le produit payant), donc
  // les recopier aurait garanti deux définitions divergentes — et deux balances âgées qui ne disent
  // pas la même chose. core.js les réexporte depuis ici. À VÉRIFIER avec le comptable : 30/60/90
  // est l'usage, ce n'est pas une règle.
  const AGING_BUCKETS = [[0, 0, 'Pas encore échu'], [1, 30, '1 à 30 jours'], [31, 60, '31 à 60 jours'], [61, 90, '61 à 90 jours'], [91, 99999, 'Plus de 90 jours']];

  // L'échéancier et la balance âgée lisent les lignes de tiers NON LETTRÉES — jamais une liste à
  // part (SPEC-UI-CAB-022). Une seconde liste se désynchroniserait au premier lettrage.
  function echeancierDepuisLignes(entries, compteOuRole, todayIso, opts) {
    const o = opts || {};
    const l = lettrageDepuisLignes(entries, compteOuRole, todayIso);
    const aujourdhui = txt(todayIso);
    const lignes = [];
    (l.rows || []).forEach(t => (t.ouverts || []).forEach(p => {
      // L'échéance quand la pièce en porte une, sa date sinon : une pièce sans échéance est due
      // le jour où elle est émise, et la ranger « pas encore échue » pour toujours la ferait
      // disparaître de ce que le cabinet doit réclamer.
      const echeance = txt(p.echeance) || txt(p.date);
      lignes.push({
        tiersId: t.tiersId, tiers: t.tiers, account: t.account,
        piece: p.piece, date: p.date, echeance, montant: round3(num(p.reste)),
        retard: aujourdhui && echeance && echeance < aujourdhui ? ecartJours(aujourdhui, echeance) : 0
      });
    }));
    lignes.sort((a, b) => (a.echeance || '').localeCompare(b.echeance || '') || (a.tiers || '').localeCompare(b.tiers || ''));
    return { lignes, total: round3(lignes.reduce((s, x) => s + x.montant, 0)), concorde: l.concorde, reste: l.reste };
  }

  function balanceAgeeDepuisLignes(entries, compteOuRole, todayIso, tranches) {
    const T = (Array.isArray(tranches) && tranches.length ? tranches : AGING_BUCKETS)
      .map(([min, max, label]) => ({ label, min, max, montant: 0, nombre: 0 }));
    const e = echeancierDepuisLignes(entries, compteOuRole, todayIso);
    const parTiers = {};
    e.lignes.forEach(l => {
      const t = T.find(x => l.retard >= x.min && l.retard <= x.max) || T[T.length - 1];
      t.montant = round3(t.montant + l.montant); t.nombre++;
      const k = l.tiersId || ('~' + l.tiers);
      const r = parTiers[k] = parTiers[k] || { tiersId: l.tiersId, tiers: l.tiers, total: 0, parTranche: T.map(x => ({ label: x.label, montant: 0 })) };
      r.total = round3(r.total + l.montant);
      const i = T.indexOf(t);
      r.parTranche[i].montant = round3(r.parTranche[i].montant + l.montant);
    });
    return {
      tranches: T, tiers: Object.values(parTiers).sort((a, b) => b.total - a.total),
      total: round3(T.reduce((s, x) => s + x.montant, 0))
    };
  }

  // ================================================== LA DÉCLARATION MENSUELLE (9.6.0)
  //
  // Ce que cette version fait : elle prépare les chiffres que le comptable RECOPIE sur le portail.
  // Ce qu'elle ne fera jamais : déposer à sa place. « Marquer déposée » est un pense-bête, pas un
  // accusé de réception — une application qui déposerait se tromperait un jour sans que personne ne
  // le sache (règle de la 5.2.0).
  //
  // La règle qui tient tout le reste : **une case dont on ne connaît pas la règle vaut `null`,
  // jamais 0.** Un zéro se recopie sur un formulaire ; un « — » avec sa raison se demande au
  // comptable. C'est la même règle que le seuil de retenue de la 9.1.1, appliquée à un formulaire
  // fiscal — et c'est la seule façon honnête de livrer cette version avant que le pilote ait montré
  // sa déclaration.
  //
  // Les comptes fiscaux vivent ICI parce que le Cabinet en a besoin et ne charge pas core.js. Un
  // test confronte cette table à `DEFAULT_ACCOUNTS` : deux tables séparées divergent, toujours
  // (6.8.0, 7.23.0), et deux déclarations qui ne lisent pas les mêmes comptes ne se comparent pas.
  const COMPTES_FISCAUX = {
    tvaCollectee: '4367',      // TVA collectée
    tvaDeductible: '4366',     // TVA déductible (porte aussi le crédit reporté)
    tvaAPayer: '4365',         // TVA à décaisser : le net du mois, timbre et retenues compris
    timbre: '4368',            // Timbre fiscal encaissé pour le compte de l'État
    rsSubie: '4358',           // Retenue à la source SUBIE — une créance, jamais une dette
    rsOperee: '4352',          // Retenue à la source OPÉRÉE sur un fournisseur — une dette
    irpp: '4321',              // IRPP retenu sur les salaires
    cnss: '4531'               // CNSS — trimestrielle, rappelée ici pour mémoire
  };

  // Les cases dont la RÈGLE n'est pas connue, et ce qu'on répond à leur place. Elles existent dans
  // l'objet — les taire ferait croire qu'elles n'existent pas — mais elles valent `null` et portent
  // la raison. Le jour où le comptable tranche, on remplace le motif par un calcul.
  const CASES_A_VERIFIER = {
    tfp: 'La taxe de formation professionnelle se calcule sur la masse salariale ; aucun compte du plan de ce dossier ne la porte, et le taux dépend du secteur. À VÉRIFIER avec le comptable.',
    foprolos: 'Le FOPROLOS se calcule sur la masse salariale ; aucun compte du plan ne le porte. À VÉRIFIER avec le comptable.',
    tcl: 'La taxe sur les établissements : ni l\'assiette ni le taux ne sont établis ici. À VÉRIFIER avec le comptable.',
    acomptes: 'Les acomptes provisionnels dépendent de l\'impôt de l\'exercice précédent, que ce livre ne porte pas. À VÉRIFIER avec le comptable.'
  };

  // Reconnaître l'écriture de DÉCLARATION à sa forme, jamais à son libellé : elle touche le compte
  // « à décaisser » ET un compte de TVA dans la même pièce. C'est la seule signature qui tienne —
  // le client de l'exemple nomme la sienne « TVA-2026-08 », la nôtre s'appelle « DECL-2026-08 »,
  // et un cabinet la nommera autrement. Sans elle, la TVA collectée d'un mois déjà déclaré tombe
  // à zéro : l'écriture de déclaration DÉBITE le 4367 d'exactement ce que les ventes y ont crédité,
  // et le mois paraît vide. C'est le parcours réel qui l'a montré, sur le jeu d'exemple.
  function estEcritureDeclaration(e, comptes) {
    const c = comptes || {};
    const a = txt(c.aPayer), coll = txt(c.collectee), ded = txt(c.deductible);
    if (!a) return false;
    const lignes = (e && e.lignes) || [];
    const touche = p => !!p && lignes.some(l => txt(l.compte).startsWith(p));
    return touche(a) && (touche(coll) || touche(ded));
  }

  const compteDuRole = (livre, role) => {
    const p = (livre.plan || []).find(c => c.role === role);
    return txt(p && p.compte) || COMPTES_FISCAUX[role] || '';
  };

  // Le mouvement d'un compte (et de ses sous-comptes) sur une période, avec les écritures qui le
  // font : c'est ce qui rend une case TRAÇABLE. Un chiffre qu'on ne peut pas ouvrir se croit ou ne
  // se croit pas ; un chiffre qui montre ses pièces se vérifie.
  function mouvementCompte(livre, prefixe, du, au, exclure) {
    const n = txt(prefixe);
    let debit = 0, credit = 0;
    const ecritures = [], sous = {};
    if (!n) return { debit: 0, credit: 0, ecritures: [], sous };
    (livre.ecritures || []).forEach(e => {
      if (e.statut === 'brouillard') return;
      if (du && e.date < du) return;
      if (au && e.date > au) return;
      if (exclure && exclure(e)) return;
      let touche = false;
      (e.lignes || []).forEach(l => {
        if (!txt(l.compte).startsWith(n)) return;
        touche = true;
        debit = round3(debit + num(l.debit));
        credit = round3(credit + num(l.credit));
        const k = txt(l.compte);
        sous[k] = sous[k] || { compte: k, debit: 0, credit: 0 };
        sous[k].debit = round3(sous[k].debit + num(l.debit));
        sous[k].credit = round3(sous[k].credit + num(l.credit));
      });
      if (touche) ecritures.push(e.id);
    });
    return { debit, credit, ecritures, sous };
  }

  const caseDe = (montant, ecritures) => ({ montant: round3(montant), ecritures: ecritures || [] });
  const caseInconnue = motif => ({ montant: null, ecritures: [], motif });

  // La déclaration d'une période, DÉDUITE des écritures validées. Rien ne se saisit : un chiffre
  // saisi à côté d'un livre est un chiffre qui finira par le contredire.
  function declarationMensuelle(livre, periode, opts) {
    const o = opts || {};
    const p = txt(periode);
    if (!/^\d{4}-\d{2}$/.test(p)) return { ok: false, motif: 'La période d\'une déclaration mensuelle s\'écrit AAAA-MM.' };
    const du = p + '-01';
    const au = p + '-' + String(new Date(Date.UTC(Number(p.slice(0, 4)), Number(p.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0');
    const cColl = compteDuRole(livre, 'tvaCollectee');
    const cDed = compteDuRole(livre, 'tvaDeductible');
    const comptes = { collectee: cColl, deductible: cDed, aPayer: compteDuRole(livre, 'tvaAPayer') };
    // L'écriture de déclaration du mois — la nôtre ou celle que le client a déjà passée dans ses
    // propres livres — ne compte PAS dans ce qu'elle déclare : elle solde ce qu'on est en train de
    // lire. L'inclure ferait afficher zéro sur un mois plein.
    const horsDeclaration = e => estEcritureDeclaration(e, comptes);
    const mColl = mouvementCompte(livre, cColl, du, au, horsDeclaration);
    const mDed = mouvementCompte(livre, cDed, du, au, horsDeclaration);
    const collectee = round3(mColl.credit - mColl.debit);
    const deductible = round3(mDed.debit - mDed.credit);
    // Le crédit REPORTÉ, c'est ce que le 4366 portait encore la veille — jamais un chiffre saisi.
    // Une déclaration isolée qui l'ignore donne un net faux, et c'est le défaut que `vatChain`
    // corrigeait déjà côté entreprise en 3.1.0.
    const avant = mouvementCompte(livre, cDed, livre.exercice.du, veille(du));
    const reporte = Math.max(0, round3(avant.debit - avant.credit));
    const net = round3(collectee - deductible - reporte);
    const timbre = (() => { const m = mouvementCompte(livre, compteDuRole(livre, 'timbre'), du, au, horsDeclaration); return { v: round3(m.credit - m.debit), e: m.ecritures }; })();
    const rsOp = (() => { const m = mouvementCompte(livre, compteDuRole(livre, 'rsOperee'), du, au, horsDeclaration); return { v: round3(m.credit - m.debit), e: m.ecritures }; })();
    const rsSub = (() => { const m = mouvementCompte(livre, compteDuRole(livre, 'rsSubie'), du, au, horsDeclaration); return { v: round3(m.debit - m.credit), e: m.ecritures }; })();
    const irpp = (() => { const m = mouvementCompte(livre, compteDuRole(livre, 'irpp'), du, au, horsDeclaration); return { v: round3(m.credit - m.debit), e: m.ecritures }; })();

    // Le détail par TAUX ne s'invente pas : il demande un sous-compte de TVA collectée par taux.
    // Quand le plan n'en a qu'un, on le DIT au lieu de rendre un tableau à une ligne qui laisserait
    // croire que tout est à 19 %.
    const sousColl = Object.values(mColl.sous).filter(x => x.compte !== cColl);
    const parTaux = sousColl.length >= 2
      ? sousColl.map(x => ({ compte: x.compte, montant: round3(x.credit - x.debit) })).sort((a, b) => a.compte.localeCompare(b.compte))
      : null;

    const cases = {
      tvaCollectee: caseDe(collectee, mColl.ecritures),
      tvaDeductible: caseDe(deductible, mDed.ecritures),
      creditReporte: caseDe(reporte, []),
      netAPayer: caseDe(Math.max(0, net), []),
      creditAReporter: caseDe(Math.max(0, -net), []),
      timbre: caseDe(timbre.v, timbre.e),
      retenuesOperees: caseDe(rsOp.v, rsOp.e),
      retenuesSubies: caseDe(rsSub.v, rsSub.e),
      irpp: caseDe(irpp.v, irpp.e),
      aDecaisser: caseDe(round3(Math.max(0, net) + timbre.v + rsOp.v), [])
    };
    Object.keys(CASES_A_VERIFIER).forEach(k => {
      const c = compteDuRole(livre, k);
      // Si le plan du dossier porte un compte pour cette taxe, on la calcule ; sinon on le dit.
      const declare = (livre.plan || []).some(x => x.role === k);
      if (!declare) { cases[k] = caseInconnue(CASES_A_VERIFIER[k]); return; }
      const m = mouvementCompte(livre, c, du, au);
      cases[k] = caseDe(round3(m.credit - m.debit), m.ecritures);
    });

    return {
      ok: true, type: 'mensuelle', periode: p, du, au,
      cases, parTaux, comptes,
      // L'écriture de déclaration DÉJÀ passée sur ce mois, quelle que soit sa pièce : c'est elle qui
      // éteint le bouton « Écrire l'écriture du mois ». La repasser compterait la TVA deux fois.
      ecritureExistante: ((livre.ecritures || []).find(e => e.date >= du && e.date <= au && e.statut !== 'brouillard' && estEcritureDeclaration(e, comptes)) || {}).id || '',
      controles: controlesDeclaration(livre, p, { ...cases, au, comptes }, o)
    };
  }

  const veille = iso => {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  // Les contrôles AVANT dépôt. Ils ne bloquent jamais — un mois déclaré avec deux manques signalés
  // vaut mieux qu'un mois jamais déclaré parce que l'application faisait la difficile (règle 6.0.0).
  function controlesDeclaration(livre, periode, cases, opts) {
    const o = opts || {};
    const du = periode + '-01', au = cases && cases.au ? cases.au : periode + '-31';
    const out = [];
    const brouillards = (livre.ecritures || []).filter(e => e.statut === 'brouillard' && e.date >= du && e.date <= au);
    out.push({
      id: 'brouillard', ok: !brouillards.length,
      detail: brouillards.length ? `${brouillards.length} pièce(s) encore en brouillard sur ce mois : elles n'entrent dans aucun chiffre de cette déclaration.` : ''
    });
    const attente = mouvementCompte(livre, txt(o.compteAttente) || '471', livre.exercice.du, au);
    const solde471 = round3(attente.debit - attente.credit);
    out.push({
      id: 'attente', ok: solde471 === 0,
      detail: solde471 ? `Le compte d'attente porte encore ${solde471.toFixed(3)} : tant qu'il n'est pas soldé, une pièce est rangée nulle part.` : ''
    });
    // Le 4367 doit être SOLDÉ à la fin du mois : c'est l'écriture de déclaration qui le solde, et
    // tant qu'elle n'est pas passée, la TVA du mois n'est écrite nulle part. Ce contrôle-là dit
    // exactement ce qu'il reste à faire, alors qu'un contrôle sur le report de crédit dirait la
    // même chose d'une façon que personne ne sait traduire en geste.
    const cColl = (cases.comptes && cases.comptes.collectee) || compteDuRole(livre, 'tvaCollectee');
    const cDed = (cases.comptes && cases.comptes.deductible) || compteDuRole(livre, 'tvaDeductible');
    const soldeColl = (() => { const m = mouvementCompte(livre, cColl, livre.exercice.du, au); return round3(m.credit - m.debit); })();
    out.push({
      id: 'tva-soldee', ok: soldeColl === 0,
      detail: soldeColl === 0 ? ''
        : `Le compte ${cColl} porte encore ${soldeColl.toFixed(3)} à la fin du mois : l'écriture de déclaration n'a pas été passée.`
    });
    // Et le 4366 ne peut pas être CRÉDITEUR : une TVA déductible négative n'existe pas. Quand elle
    // apparaît, c'est qu'une déclaration a imputé plus de crédit qu'il n'y en avait.
    const soldeDed = (() => { const m = mouvementCompte(livre, cDed, livre.exercice.du, au); return round3(m.debit - m.credit); })();
    out.push({
      id: 'tva-credit', ok: soldeDed >= 0,
      detail: soldeDed >= 0 ? ''
        : `Le compte ${cDed} est créditeur de ${Math.abs(soldeDed).toFixed(3)} : une déclaration a imputé plus de crédit de TVA qu'il n'y en avait.`
    });
    return out;
  }

  // L'écriture de déclaration, au DERNIER jour du mois. Elle solde la TVA du mois et porte le net
  // au 4365, timbre et retenues opérées compris — c'est ce qui fait que le compte « à décaisser »
  // dit vraiment ce qu'il faut payer.
  function ecritureDeclaration(livre, decl) {
    const c = decl.cases;
    const collectee = c.tvaCollectee.montant || 0;
    const deductible = c.tvaDeductible.montant || 0;
    const reporte = c.creditReporte.montant || 0;
    const net = Math.max(0, round3(collectee - deductible - reporte));
    // On ne crédite du 4366 que ce qui est UTILISÉ : le reste est le crédit à reporter, et il doit
    // rester sur le compte. Le solder entièrement ferait disparaître le report.
    const utilisee = round3(Math.min(round3(deductible + reporte), collectee));
    const timbre = c.timbre.montant || 0;
    const rs = c.retenuesOperees.montant || 0;
    const lignes = [];
    if (collectee) lignes.push({ compte: decl.comptes.collectee, libelle: 'TVA collectée du mois', debit: collectee, credit: 0 });
    if (utilisee) lignes.push({ compte: decl.comptes.deductible, libelle: 'TVA déductible imputée', debit: 0, credit: utilisee });
    if (timbre) lignes.push({ compte: compteDuRole(livre, 'timbre'), libelle: 'Timbre fiscal du mois', debit: timbre, credit: 0 });
    if (rs) lignes.push({ compte: compteDuRole(livre, 'rsOperee'), libelle: 'Retenues opérées du mois', debit: rs, credit: 0 });
    const aPayer = round3(net + timbre + rs);
    if (aPayer) lignes.push({ compte: decl.comptes.aPayer, libelle: 'À décaisser', debit: 0, credit: aPayer });
    return {
      journal: 'OD', date: decl.au, piece: 'DECL-' + decl.periode,
      libelle: `Déclaration de ${decl.periode}`, source: 'declaration', lignes
    };
  }

  // Enregistrer la déclaration dans le livre. Une même période ne s'y trouve qu'UNE fois : la
  // refaire remplace la précédente plutôt que de s'y ajouter — deux déclarations du même mois, et
  // plus personne ne sait laquelle a été déposée.
  function poserDeclaration(livre, decl, qui, quand) {
    if (!decl || !decl.ok) return { ok: false, motif: (decl && decl.motif) || 'Déclaration illisible.' };
    livre.declarations = Array.isArray(livre.declarations) ? livre.declarations : [];
    const avant = livre.declarations.find(d => d.periode === decl.periode && d.type === decl.type);
    if (avant && avant.deposee && avant.deposee.le) {
      return { ok: false, motif: `La déclaration de ${decl.periode} est marquée déposée le ${avant.deposee.le}. Dé-pointe-la d'abord si tu veux la refaire — sinon deux chiffres différents auraient porté le même dépôt.` };
    }
    const obj = {
      id: avant ? avant.id : 'DECL-' + decl.periode + '-' + String(quand || 0),
      type: decl.type, periode: decl.periode, prepareeLe: Number(quand) || 0, par: txt(qui),
      cases: decl.cases, controles: decl.controles,
      deposee: (avant && avant.deposee) || { le: '', par: '', reference: '' },
      payee: (avant && avant.payee) || { le: '', par: '' },
      ecritureId: (avant && avant.ecritureId) || ''
    };
    livre.declarations = livre.declarations.filter(d => d !== avant).concat([obj]);
    trace(livre, qui, avant ? 'déclaration refaite' : 'déclaration préparée', decl.periode, quand);
    return { ok: true, declaration: obj };
  }

  // Pointer et dé-pointer. Les deux, toujours : ce qui se pointe par erreur se dé-pointe (7.12.0),
  // et un pense-bête qui ne se défait pas devient un mensonge le jour où on se trompe de mois.
  function pointerDeclaration(livre, periode, quoi, valeur, qui, quand) {
    const d = (livre.declarations || []).find(x => x.periode === periode);
    if (!d) return { ok: false, motif: 'Aucune déclaration préparée pour cette période.' };
    if (quoi !== 'deposee' && quoi !== 'payee') return { ok: false, motif: 'On ne pointe qu\'un dépôt ou un paiement.' };
    if (quoi === 'payee' && valeur && !(d.deposee && d.deposee.le)) {
      return { ok: false, motif: 'Cette déclaration n\'est pas marquée déposée : on ne paie pas ce qu\'on n\'a pas déposé.' };
    }
    d[quoi] = valeur
      ? { le: txt((valeur && valeur.le) || ''), par: txt(qui), reference: txt((valeur && valeur.reference) || '') }
      : { le: '', par: '', reference: '' };
    trace(livre, qui, (valeur ? '' : 'dé-') + (quoi === 'deposee' ? 'pointage dépôt' : 'pointage paiement'), periode, quand);
    return { ok: true, declaration: d };
  }

  // L'état d'un mois, côté cabinet : reçu → saisi → déclaré → payé. Chaque étape se DÉDUIT de ce
  // qui existe, jamais d'une case qu'on coche — sauf les deux dernières, qui sont des pense-bêtes
  // et qui le disent.
  function etatDuMois(livre, periode, opts) {
    const o = opts || {};
    const du = periode + '-01', au = periode + '-31';
    const ecritures = (livre.ecritures || []).filter(e => e.date >= du && e.date <= au);
    const validees = ecritures.filter(e => e.statut === 'validee');
    const d = (livre.declarations || []).find(x => x.periode === periode) || null;
    // Les quatre drapeaux d'abord, le mot ensuite — et le mot se DÉDUIT des drapeaux. Les calculer
    // deux fois, c'est se retrouver avec un état qui dit « reçu » à côté d'un drapeau « saisi »,
    // c'est-à-dire deux chiffres du même écran qui se contredisent (règle 6.8.1).
    const etat = {
      periode,
      recu: !!o.recu,
      saisi: validees.length > 0,
      brouillard: ecritures.length - validees.length,
      declare: !!(d && d.deposee && d.deposee.le),
      paye: !!(d && d.payee && d.payee.le),
      declaration: d
    };
    etat.etat = etat.paye ? 'payé' : etat.declare ? 'déclaré' : etat.saisi ? 'saisi' : etat.recu ? 'reçu' : 'rien';
    return etat;
  }

  // ---------- les immobilisations et l'inventaire du cabinet (9.7.0) ----------
  //
  // Le cabinet tient les fiches de biens de ses dossiers HORS SkanFact : ceux-là n'ont aucune
  // application qui les leur calcule. Le modèle est celui de l'app entreprise (`data.assets`,
  // 3.5.0), avec les noms de champs du livre — et le calcul est le MÊME, celui qui vient de
  // déménager en 9.6.1. Recopier le moteur aurait donné deux plans d'amortissement pour un seul
  // bien, et c'est exactement le risque que cette version devait éviter.
  //
  // Ce qui n'y est PAS, et pourquoi :
  //  — l'amortissement DÉROGATOIRE. Le format de `livre.json` est figé et ne lui réserve rien, et
  //    la règle du plan est explicite : s'il n'est pas demandé, il n'existe pas. Le jour où un
  //    cabinet le demande, c'est une décision de format, pas une ligne de code en plus.
  //  — l'inventaire PERMANENT. Il attend qu'un cabinet le demande ; l'intermittent est ce que fait
  //    un cabinet pour un dossier qui n'a pas de logiciel de stock.

  const IMMO_METHODES = ['lineaire', 'degressif'];

  // Les comptes par défaut. Aucun numéro de compte n'est une vérité (règle 6.3.0) : c'est le RÔLE
  // qui désigne, le plan du dossier qui tranche, et ces valeurs ne servent que si le plan est muet.
  const COMPTES_IMMO = {
    immobilisations: '22', amortissements: '28', dotations: '681',
    vncCedee: '675', produitsCession: '775',
    stocks: '37', variationStocks: '603',
    subventions: '14', repriseSubventions: '739'
  };

  // Ce dont personne n'a confirmé la règle. Comme pour les cases fiscales de la 9.6.0 : on ne
  // remplit pas à la place du comptable, on DIT ce qui manque.
  const IMMO_A_VERIFIER = {
    tauxDegressif: 'Le coefficient dégressif tunisien dépend de la durée et du régime : personne ne l\'a confirmé. Le taux se saisit sur la fiche, il n\'est jamais deviné. À VÉRIFIER.',
    bascule: 'Basculer au linéaire quand il devient plus favorable est l\'usage dans plusieurs pays ; nul n\'a dit que c\'est celui d\'ici. Décoché par défaut. À VÉRIFIER.',
    subvention: 'La reprise d\'une subvention d\'investissement suit ici le rythme de l\'amortissement. Les comptes et la règle sont À VÉRIFIER.'
  };

  const compteImmo = (livre, role) => {
    const p = (livre.plan || []).find(c => c.role === role);
    return txt(p && p.compte) || COMPTES_IMMO[role] || '';
  };

  // La fiche du livre → la forme que connaît le moteur partagé. Deux jeux de noms pour un seul
  // modèle : le livre écrit en français (`valeur`, `duree`, `cession`), le moteur porte les noms
  // qu'il a depuis la 3.5.0. L'adaptateur vit à UN endroit, sinon les deux côtés divergent.
  function bienVersActif(fiche) {
    const f = fiche || {};
    return {
      amount: num(f.valeur),
      residual: num(f.residuelle),
      years: num(f.duree),
      date: txt(f.dateMiseEnService) || txt(f.dateAcquisition),
      disposal: f.cession && f.cession.date
        ? { date: txt(f.cession.date), amount: num(f.cession.prix), reason: txt(f.cession.motif) }
        : null
    };
  }

  // Le plan DÉGRESSIF. Le taux se saisit — jamais un coefficient écrit dans le code : il dépend de
  // la durée et du régime, et écrire en dur une règle de droit que personne n'a confirmée est très
  // exactement ce que ce projet s'interdit (règle 9.1.1).
  //
  // Chaque exercice : dotation = valeur nette de début × taux, au prorata des jours (base 360) sur
  // le premier et le dernier. La dernière annuité solde le reste, comme en linéaire — sans quoi un
  // dégressif pur ne finit jamais, et le bien resterait au bilan pour l'éternité.
  function planDegressif(fiche) {
    const a = bienVersActif(fiche);
    const taux = num(fiche.tauxDegressif) / 100;
    const base = round3(Math.max(0, a.amount - a.residual));
    if (!a.date || a.years <= 0 || base <= 0 || taux <= 0) return [];
    const fin = ajouterJoursIso(ajouterMoisIso(a.date, a.years * 12), -1);
    const premier = Number(a.date.slice(0, 4));
    const dernier = Number(fin.slice(0, 4));
    const rows = [];
    let cumul = 0;
    for (let y = premier; y <= dernier; y++) {
      const du = y === premier ? a.date : `${y}-01-01`;
      const au = y === dernier ? fin : `${y}-12-31`;
      const jours = Math.max(0, days360(du, au) + 1);
      const reste = round3(base - cumul);
      let dotation = round3(reste * taux * jours / 360);
      // La bascule au linéaire : DÉCOCHÉE par défaut. Elle change le plan, donc le résultat
      // imposable : la poser d'office reviendrait à décider à la place du comptable.
      if (fiche.bascule) {
        const joursRestants = Math.max(1, days360(du, fin) + 1);
        const lineaire = round3(reste * jours / joursRestants);
        if (lineaire > dotation) dotation = lineaire;
      }
      if (y === dernier) dotation = reste;
      if (round3(cumul + dotation) > base) dotation = round3(base - cumul);
      cumul = round3(cumul + dotation);
      rows.push({ year: y, from: du, to: au, days: jours, annuity: dotation, cumulated: cumul, nbv: round3(a.amount - cumul) });
    }
    return rows;
  }

  // Le plan d'un bien, quelle que soit sa méthode, dans les noms du livre.
  //
  // Il est RECALCULÉ depuis les champs, jamais saisi (invariant SPEC-DATA-005). Mais `ecritureId`
  // est un FAIT, pas un calcul : la dotation de 2026 a été passée en écriture ou elle ne l'a pas
  // été, et aucun recalcul ne peut le défaire. On le reporte donc depuis le plan rangé.
  function planDuBien(fiche) {
    const f = fiche || {};
    const rows = txt(f.methode) === 'degressif' ? planDegressif(f) : assetSchedule(bienVersActif(f));
    const ancien = {};
    (f.plan || []).forEach(p => { if (p && p.ecritureId) ancien[p.annee] = p.ecritureId; });
    const ced = f.cession && f.cession.date ? Number(String(f.cession.date).slice(0, 4)) : 0;
    return rows.filter(r => !ced || r.year <= ced).map(r => {
      // L'année de la cession, on n'amortit que jusqu'au jour de la sortie.
      const coupe = ced === r.year;
      const dot = coupe ? round3(cumulDuBien(f, f.cession.date) - cumulDuBien(f, `${r.year - 1}-12-31`)) : r.annuity;
      const cum = coupe ? cumulDuBien(f, f.cession.date) : r.cumulated;
      return {
        annee: r.year, dotation: dot, cumul: cum,
        vnc: round3(num(f.valeur) - cum),
        ecritureId: ancien[r.year] || ''
      };
    });
  }

  // Cumul à une date quelconque — en dégressif comme en linéaire. En linéaire c'est le moteur
  // partagé ; en dégressif on interpole dans l'année du plan, parce qu'un dégressif ne s'écoule pas
  // linéairement dans le temps et qu'une règle de trois sur la durée totale donnerait un faux.
  function cumulDuBien(fiche, dateIso) {
    const f = fiche || {};
    if (txt(f.methode) !== 'degressif') return cappedCumulated(bienVersActif(f), dateIso);
    const rows = planDegressif(f);
    if (!rows.length || !estUnJour(dateIso)) return 0;
    let cumul = 0;
    for (const r of rows) {
      if (dateIso >= r.to) { cumul = r.cumulated; continue; }
      if (dateIso < r.from) break;
      const jours = Math.max(0, days360(r.from, dateIso) + 1);
      cumul = round3(cumul + r.annuity * Math.min(1, jours / Math.max(1, r.days)));
      break;
    }
    return cumul;
  }

  const vncDuBien = (fiche, dateIso) => round3(num((fiche || {}).valeur) - cumulDuBien(fiche, dateIso));

  // Le résultat d'une cession — ou d'une mise au rebut, qui est une cession à prix nul. Les deux
  // s'écrivent pareil ; ce qui change, c'est le motif, et il figure sur la pièce.
  function resultatCession(fiche) {
    const c = (fiche || {}).cession;
    if (!c || !c.date) return null;
    const vnc = vncDuBien(fiche, c.date);
    const prix = num(c.prix);
    return { date: txt(c.date), prix, vnc, resultat: round3(prix - vnc), motif: txt(c.motif) || 'cession' };
  }

  // La quote-part de subvention reprise sur l'exercice : elle suit le rythme de l'amortissement du
  // bien qu'elle a financé. Les comptes et la règle sont À VÉRIFIER — le calcul, lui, est une règle
  // de trois sur le plan, pas une règle de droit.
  function repriseSubvention(fiche, annee) {
    const sub = (fiche || {}).subvention;
    if (!sub || !num(sub.montant)) return 0;
    const base = round3(Math.max(0, num(fiche.valeur) - num(fiche.residuelle)));
    if (base <= 0) return 0;
    const ligne = planDuBien(fiche).find(p => p.annee === Number(annee));
    if (!ligne) return 0;
    return round3(num(sub.montant) * ligne.dotation / base);
  }

  function immoValide(fiche) {
    const f = fiche || {};
    const motifs = [];
    if (!txt(f.libelle)) motifs.push('Le bien n\'a pas de libellé : une ligne sans nom ne se retrouve jamais.');
    if (!estUnJour(txt(f.dateMiseEnService) || txt(f.dateAcquisition))) motifs.push('La date de mise en service manque : c\'est elle qui fait partir l\'amortissement.');
    if (num(f.valeur) <= 0) motifs.push('La valeur d\'acquisition doit être positive.');
    if (num(f.residuelle) < 0) motifs.push('Une valeur résiduelle négative n\'existe pas.');
    if (num(f.residuelle) >= num(f.valeur) && num(f.valeur) > 0) motifs.push('La valeur résiduelle ne peut pas atteindre la valeur d\'acquisition : il n\'y aurait rien à amortir.');
    if (num(f.duree) <= 0) motifs.push('La durée d\'amortissement doit être d\'au moins un an.');
    if (IMMO_METHODES.indexOf(txt(f.methode) || 'lineaire') < 0) motifs.push('La méthode d\'amortissement doit être linéaire ou dégressive.');
    if (txt(f.methode) === 'degressif' && num(f.tauxDegressif) <= 0) {
      motifs.push('Un amortissement dégressif demande son TAUX : il dépend de la durée et du régime, et l\'application ne le devine pas.');
    }
    if (!txt(f.compte)) motifs.push('Le compte d\'immobilisation manque.');
    const c = f.cession;
    if (c && c.date && !estUnJour(txt(c.date))) motifs.push('La date de cession n\'est pas un jour du calendrier.');
    if (c && c.date && txt(c.date) < (txt(f.dateMiseEnService) || txt(f.dateAcquisition))) {
      motifs.push('Un bien ne se cède pas avant d\'être mis en service.');
    }
    return { ok: !motifs.length, motifs };
  }

  // Même fabrique d'identifiant que les écritures : un compteur, jamais un tirage au sort — deux
  // fiches créées dans la même milliseconde doivent porter deux identifiants différents, et un
  // hasard non semé rend les tests impossibles à rejouer.
  let compteurImmo = 0;
  const idImmo = graine => {
    compteurImmo = (compteurImmo + 1) % 1000000;
    return 'i_' + String(graine || 0).toString(36) + '_' + compteurImmo.toString(36);
  };

  function ajouterImmobilisation(livre, fiche, qui, quand) {
    const v = immoValide(fiche);
    if (!v.ok) return { ok: false, motif: v.motifs[0], motifs: v.motifs };
    livre.immobilisations = Array.isArray(livre.immobilisations) ? livre.immobilisations : [];
    const f = {
      id: txt(fiche.id) || idImmo(quand),
      libelle: txt(fiche.libelle),
      compte: txt(fiche.compte) || compteImmo(livre, 'immobilisations'),
      compteAmort: txt(fiche.compteAmort) || compteImmo(livre, 'amortissements'),
      compteDotation: txt(fiche.compteDotation) || compteImmo(livre, 'dotations'),
      dateAcquisition: txt(fiche.dateAcquisition) || txt(fiche.dateMiseEnService),
      dateMiseEnService: txt(fiche.dateMiseEnService) || txt(fiche.dateAcquisition),
      valeur: round3(num(fiche.valeur)),
      residuelle: round3(num(fiche.residuelle)),
      tva: round3(num(fiche.tva)),
      methode: txt(fiche.methode) || 'lineaire',
      duree: num(fiche.duree),
      tauxDegressif: fiche.tauxDegressif == null || fiche.tauxDegressif === '' ? null : num(fiche.tauxDegressif),
      bascule: !!fiche.bascule,
      prorata: 'jours360',
      subvention: fiche.subvention && num(fiche.subvention.montant)
        ? {
          montant: round3(num(fiche.subvention.montant)),
          compte: txt(fiche.subvention.compte) || compteImmo(livre, 'subventions'),
          compteReprise: txt(fiche.subvention.compteReprise) || compteImmo(livre, 'repriseSubventions')
        }
        : null,
      origine: fiche.origine || { source: 'saisie', docId: '', mois: '' },
      plan: [],
      cession: fiche.cession && fiche.cession.date ? { ...fiche.cession, date: txt(fiche.cession.date), prix: round3(num(fiche.cession.prix)) } : null,
      creeLe: Number(quand) || 0,
      par: txt(qui)
    };
    f.plan = planDuBien(f);
    livre.immobilisations.push(f);
    trace(livre, qui, 'immobilisation créée', f.libelle, quand);
    return { ok: true, fiche: f };
  }

  // Modifier une fiche recalcule son plan. Mais une dotation DÉJÀ passée en écriture est un fait
  // écrit dans le livre : la changer en silence ferait diverger le plan et la comptabilité, et
  // personne ne verrait lequel des deux a raison. On refuse en nommant le geste qui débloque.
  function modifierImmobilisation(livre, id, patch, qui, quand) {
    const f = (livre.immobilisations || []).find(x => x.id === id);
    if (!f) return { ok: false, motif: 'Cette immobilisation n\'existe pas.' };
    const essai = { ...f, ...(patch || {}) };
    const v = immoValide(essai);
    if (!v.ok) return { ok: false, motif: v.motifs[0], motifs: v.motifs };
    essai.plan = f.plan;
    const neuf = planDuBien(essai);
    const change = (f.plan || []).filter(p => p.ecritureId
      && round3(p.dotation) !== round3(((neuf.find(n => n.annee === p.annee)) || {}).dotation || 0));
    if (change.length) {
      return {
        ok: false,
        motif: `La dotation de ${change[0].annee} est déjà passée en écriture : ce changement la rendrait fausse. Contre-passe l'écriture de dotation de ${change[0].annee}, puis recommence.`
      };
    }
    Object.assign(f, patch || {});
    f.valeur = round3(num(f.valeur));
    f.residuelle = round3(num(f.residuelle));
    f.plan = neuf;
    trace(livre, qui, 'immobilisation modifiée', f.libelle, quand);
    return { ok: true, fiche: f };
  }

  function supprimerImmobilisation(livre, id, qui, quand) {
    const f = (livre.immobilisations || []).find(x => x.id === id);
    if (!f) return { ok: false, motif: 'Cette immobilisation n\'existe pas.' };
    const ecrite = (f.plan || []).find(p => p.ecritureId);
    if (ecrite) {
      return { ok: false, motif: `La dotation de ${ecrite.annee} est passée en écriture : supprimer la fiche laisserait une dotation sans bien. Contre-passe l'écriture d'abord.` };
    }
    livre.immobilisations = (livre.immobilisations || []).filter(x => x.id !== id);
    trace(livre, qui, 'immobilisation supprimée', f.libelle, quand);
    return { ok: true };
  }

  // L'état des immobilisations d'un exercice : une ligne par bien, et des totaux qui tombent juste.
  function etatImmobilisations(livre, annee) {
    const y = Number(annee) || 0;
    const rows = (livre.immobilisations || []).map(f => {
      const ligne = planDuBien(f).find(p => p.annee === y);
      const ouverture = cumulDuBien(f, `${y - 1}-12-31`);
      const ced = resultatCession(f);
      const sorti = !!(ced && Number(ced.date.slice(0, 4)) <= y);
      return {
        id: f.id, libelle: f.libelle, compte: f.compte, methode: f.methode,
        date: txt(f.dateMiseEnService) || txt(f.dateAcquisition),
        valeur: round3(num(f.valeur)),
        ouverture: round3(ouverture),
        dotation: ligne ? ligne.dotation : 0,
        cumul: ligne ? ligne.cumul : round3(cumulDuBien(f, `${y}-12-31`)),
        vnc: sorti ? 0 : round3(num(f.valeur) - (ligne ? ligne.cumul : cumulDuBien(f, `${y}-12-31`))),
        reprise: repriseSubvention(f, y),
        cession: ced && Number(ced.date.slice(0, 4)) === y ? ced : null,
        ecrite: !!(ligne && ligne.ecritureId),
        actif: (txt(f.dateMiseEnService) || txt(f.dateAcquisition)) <= `${y}-12-31`
          && !(ced && Number(ced.date.slice(0, 4)) < y)
      };
    }).filter(r => r.actif).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const somme = f => round3(rows.reduce((s, r) => s + (Number(f(r)) || 0), 0));
    return {
      rows,
      valeur: somme(r => r.valeur), ouverture: somme(r => r.ouverture),
      dotation: somme(r => r.dotation), cumul: somme(r => r.cumul), vnc: somme(r => r.vnc),
      reprise: somme(r => r.reprise),
      cessions: rows.filter(r => r.cession),
      // Ce qui reste à passer en écriture : c'est ce chiffre qui fait le bouton.
      aEcrire: rows.filter(r => !r.ecrite && (r.dotation || r.cession)).length
    };
  }

  // Les lignes d'un compte d'immobilisation qui n'ont AUCUNE fiche : le pont avec ce que le client
  // a envoyé dans son paquet. On ne crée jamais la fiche tout seul — la durée d'amortissement est
  // une décision, pas une donnée (règle 3.5.0, portée ici).
  function immobilisationsACreer(livre, annee) {
    const prefixe = compteImmo(livre, 'immobilisations');
    if (!prefixe) return [];
    const connus = new Set();
    (livre.immobilisations || []).forEach(f => { if (f.origine && f.origine.docId) connus.add(f.origine.docId); });
    const y = Number(annee) || 0;
    const out = [];
    (livre.ecritures || []).forEach(e => {
      if (e.statut === 'contrepassee') return;
      if (y && Number(String(e.date).slice(0, 4)) !== y) return;
      (e.lignes || []).forEach((l, i) => {
        if (!txt(l.compte).startsWith(prefixe)) return;
        if (!num(l.debit)) return;                       // une acquisition DÉBITE le compte
        const cle = e.id + '#' + i;
        if (connus.has(cle)) return;
        out.push({ docId: cle, ecritureId: e.id, date: e.date, libelle: txt(l.libelle) || txt(e.libelle), compte: txt(l.compte), montant: round3(num(l.debit)) });
      });
    });
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  // Les écritures d'inventaire des immobilisations, au dernier jour de l'exercice. Une pièce par
  // bien : « 14 biens » sur une seule pièce serait équilibré et illisible, et la première question
  // du comptable devant un cumul est toujours « lequel ? ».
  function ecrituresImmobilisations(livre, annee, opts) {
    const o = opts || {};
    const y = Number(annee) || 0;
    const au = txt(o.au) || `${y}-12-31`;
    const etat = etatImmobilisations(livre, y);
    const out = [];
    etat.rows.forEach(r => {
      const f = (livre.immobilisations || []).find(x => x.id === r.id);
      if (!f) return;
      if (r.dotation && !r.ecrite) {
        out.push({
          immoId: f.id, genre: 'dotation',
          journal: 'OD', date: au, piece: 'DOT-' + y + '-' + f.id.slice(-4),
          libelle: `Dotation ${y} — ${f.libelle}`, source: 'inventaire',
          lignes: [
            { compte: txt(f.compteDotation) || compteImmo(livre, 'dotations'), libelle: `Dotation ${y}`, debit: r.dotation, credit: 0 },
            { compte: txt(f.compteAmort) || compteImmo(livre, 'amortissements'), libelle: `Amortissement ${f.libelle}`, debit: 0, credit: r.dotation }
          ]
        });
      }
      if (r.reprise) {
        out.push({
          immoId: f.id, genre: 'subvention',
          journal: 'OD', date: au, piece: 'SUB-' + y + '-' + f.id.slice(-4),
          libelle: `Reprise de subvention ${y} — ${f.libelle}`, source: 'inventaire',
          lignes: [
            { compte: f.subvention.compte, libelle: 'Quote-part reprise', debit: r.reprise, credit: 0 },
            { compte: f.subvention.compteReprise, libelle: 'Reprise de subvention', debit: 0, credit: r.reprise }
          ]
        });
      }
      if (r.cession && !r.ecrite) {
        // La SORTIE d'actif seulement. Le prix de vente n'est jamais inventé : il arrive par une
        // facture ou un mouvement de banque (règle 9.0.0). L'écrire d'office au 471 laisserait un
        // compte d'attente que personne ne solde.
        const lignes = [];
        const cum = r.cumul;
        const vnc = round3(num(f.valeur) - cum);
        if (cum) lignes.push({ compte: txt(f.compteAmort) || compteImmo(livre, 'amortissements'), libelle: 'Amortissements repris', debit: cum, credit: 0 });
        if (vnc) lignes.push({ compte: compteImmo(livre, 'vncCedee'), libelle: r.cession.motif === 'rebut' ? 'Mise au rebut' : 'Valeur comptable cédée', debit: vnc, credit: 0 });
        lignes.push({ compte: txt(f.compte), libelle: f.libelle, debit: 0, credit: round3(num(f.valeur)) });
        out.push({
          immoId: f.id, genre: 'cession',
          journal: 'OD', date: r.cession.date, piece: 'SOR-' + y + '-' + f.id.slice(-4),
          libelle: `${r.cession.motif === 'rebut' ? 'Mise au rebut' : 'Sortie'} — ${f.libelle}`, source: 'inventaire', lignes
        });
      }
    });
    return out;
  }

  // Rattacher une écriture passée à la ligne de plan qu'elle porte : c'est ce qui éteint le bouton
  // et ce qui empêche de passer deux fois la même dotation.
  function noterEcritureImmo(livre, immoId, annee, ecritureId) {
    const f = (livre.immobilisations || []).find(x => x.id === immoId);
    if (!f) return { ok: false, motif: 'Cette immobilisation n\'existe pas.' };
    f.plan = planDuBien(f);
    const ligne = f.plan.find(p => p.annee === Number(annee));
    if (!ligne) return { ok: false, motif: `Le plan de ${f.libelle} ne porte rien en ${annee}.` };
    ligne.ecritureId = txt(ecritureId);
    return { ok: true, fiche: f };
  }

  // ---------- l'inventaire de stock (9.7.0) ----------
  //
  // Inventaire INTERMITTENT : on compte ce qui reste au dernier jour, et la variation devient une
  // écriture. C'est ce que fait un cabinet pour un dossier qui n'a aucun logiciel de stock — et
  // c'est le seul cas qui existe ici, puisqu'un dossier SkanFact tient déjà son stock (4.0.0).

  function inventaireValide(inv) {
    const i = inv || {};
    const motifs = [];
    if (!estUnJour(txt(i.date))) motifs.push('La date de l\'inventaire manque : c\'est le dernier jour de l\'exercice.');
    const lignes = Array.isArray(i.lignes) ? i.lignes : [];
    if (!lignes.length) motifs.push('Un inventaire sans une seule ligne ne dit pas « le stock est vide », il dit « rien n\'a été compté ».');
    lignes.forEach((l, k) => {
      if (!txt(l.libelle)) motifs.push(`Ligne ${k + 1} : la désignation manque.`);
      if (num(l.quantite) < 0) motifs.push(`Ligne ${k + 1} : une quantité négative ne s\'inventorie pas.`);
      if (num(l.cout) < 0) motifs.push(`Ligne ${k + 1} : un coût unitaire négatif n\'existe pas.`);
    });
    return { ok: !motifs.length, motifs };
  }

  const totalInventaire = inv => round3(((inv && inv.lignes) || [])
    .reduce((s, l) => s + round3(num(l.quantite) * num(l.cout)), 0));

  function poserInventaire(livre, inv, qui, quand) {
    const v = inventaireValide(inv);
    if (!v.ok) return { ok: false, motif: v.motifs[0], motifs: v.motifs };
    livre.inventaires = Array.isArray(livre.inventaires) ? livre.inventaires : [];
    const annee = Number(String(inv.date).slice(0, 4));
    const avant = livre.inventaires.find(x => Number(String(x.date).slice(0, 4)) === annee);
    if (avant && avant.ecritureId) {
      return { ok: false, motif: `L'inventaire de ${annee} est déjà passé en écriture. Contre-passe l'écriture de variation de stock avant de le refaire.` };
    }
    const obj = {
      id: avant ? avant.id : 'inv_' + annee + '_' + String(quand || 0).toString(36),
      date: txt(inv.date),
      lignes: (inv.lignes || []).map(l => ({
        ref: txt(l.ref), libelle: txt(l.libelle),
        quantite: num(l.quantite), cout: round3(num(l.cout)),
        valeur: round3(num(l.quantite) * num(l.cout))
      })),
      total: totalInventaire(inv),
      compte: txt(inv.compte) || compteImmo(livre, 'stocks'),
      saisiLe: Number(quand) || 0, par: txt(qui),
      ecritureId: (avant && avant.ecritureId) || ''
    };
    livre.inventaires = livre.inventaires.filter(x => x !== avant).concat([obj]);
    trace(livre, qui, avant ? 'inventaire refait' : 'inventaire saisi', String(annee), quand);
    return { ok: true, inventaire: obj };
  }

  // La variation de stock : ce que le compte de stock portait à l'ouverture contre ce qu'on vient
  // de compter. Le stock AUGMENTE → on débite le stock et on crédite la variation (c'est une charge
  // en moins) ; il DIMINUE → l'inverse. Une variation nulle ne produit aucune écriture : une pièce
  // à zéro dans un journal n'apprend rien et se relit dix fois.
  function variationDeStock(livre, annee) {
    const y = Number(annee) || 0;
    const inv = (livre.inventaires || []).find(x => Number(String(x.date).slice(0, 4)) === y);
    if (!inv) return { ok: false, motif: `Aucun inventaire saisi pour ${y}.` };
    const cStock = txt(inv.compte) || compteImmo(livre, 'stocks');
    const cVar = compteImmo(livre, 'variationStocks');
    const m = mouvementCompte(livre, cStock, livre.exercice.du, inv.date, e => e.id === inv.ecritureId);
    const initial = round3(m.debit - m.credit);
    const final = round3(inv.total);
    const ecart = round3(final - initial);
    if (!ecart) {
      return { ok: true, ecart: 0, initial, final, ecriture: null, motif: 'Le stock compté est exactement celui des comptes : aucune écriture à passer.' };
    }
    const lignes = ecart > 0
      ? [{ compte: cStock, libelle: `Stock au ${inv.date}`, debit: ecart, credit: 0 },
        { compte: cVar, libelle: 'Variation de stock', debit: 0, credit: ecart }]
      : [{ compte: cVar, libelle: 'Variation de stock', debit: -ecart, credit: 0 },
        { compte: cStock, libelle: `Stock au ${inv.date}`, debit: 0, credit: -ecart }];
    return {
      ok: true, ecart, initial, final,
      ecriture: {
        journal: 'OD', date: inv.date, piece: 'STK-' + y,
        libelle: `Variation de stock ${y}`, source: 'inventaire', lignes
      }
    };
  }

  // ---------- la clôture d'exercice (9.8.0) ----------
  //
  // Ce que cette section fait : les écritures d'inventaire guidées, les contrôles avant clôture,
  // la clôture elle-même (définitive, tracée, réouvrable contre un motif), les à-nouveaux
  // EXPLICITES de l'exercice suivant, et les états financiers.
  //
  // Ce qu'elle ne fait PAS, et l'écran le dit : la liasse fiscale. Les états sont DÉDUITS de la
  // balance, rubrique par rubrique. Confondre les deux ferait promettre ce que la 10.0.0 seule
  // livrera, et une liasse est le document où une erreur coûte le plus cher.

  // Les guides d'inventaire LIVRÉS. Ils désignent des RÔLES quand le rôle existe, et laissent le
  // compte à choisir quand il n'existe pas : la liste exacte et les comptes de provisions par
  // nature sont une question au comptable (SPEC-UI-CAB-040). Chacun dit s'il s'EXTOURNE.
  const GUIDES_INVENTAIRE = [
    { id: 'cca', nom: 'Charge constatée d\'avance', extourne: true,
      aide: 'La part de charge qui appartient à l\'exercice suivant. Elle s\'extourne au 1er janvier.',
      debit: { compte: '', libelle: 'Charges constatées d\'avance (47…)' }, credit: { role: '', libelle: 'Le compte de charge d\'origine' } },
    { id: 'pca', nom: 'Produit constaté d\'avance', extourne: true,
      aide: 'La part de produit qui appartient à l\'exercice suivant.',
      debit: { role: '', libelle: 'Le compte de produit d\'origine' }, credit: { compte: '', libelle: 'Produits constatés d\'avance (47…)' } },
    { id: 'fnp', nom: 'Facture non parvenue', extourne: true,
      aide: 'Une charge engagée dont la facture n\'est pas arrivée.',
      debit: { role: '', libelle: 'Le compte de charge' }, credit: { compte: '', libelle: 'Fournisseurs — factures non parvenues (408)' } },
    { id: 'fae', nom: 'Facture à établir', extourne: true,
      aide: 'Un produit acquis dont la facture n\'est pas encore émise.',
      debit: { compte: '', libelle: 'Clients — factures à établir (418)' }, credit: { role: '', libelle: 'Le compte de produit' } },
    { id: 'provision', nom: 'Provision', extourne: false,
      aide: 'Une charge probable. Elle ne s\'extourne pas : elle se reprend quand le risque disparaît. Les comptes par nature sont À VÉRIFIER.',
      debit: { role: '', libelle: 'La dotation aux provisions (68…)' }, credit: { compte: '', libelle: 'La provision (15… ou 49…)' } }
  ];

  // Les contrôles AVANT clôture. Ils ne bloquent JAMAIS (règle 6.0.0) : un exercice clôturé avec
  // trois manques signalés vaut mieux qu'un exercice jamais clôturé parce que l'application faisait
  // la difficile. Chacun dit un GESTE, pas un constat.
  function controlesCloture(livre, opts) {
    const o = opts || {};
    const du = livre.exercice.du, au = livre.exercice.au;
    const out = [];
    const dedans = e => e.date >= du && e.date <= au && e.statut !== 'contrepassee';

    const brouillards = (livre.ecritures || []).filter(e => e.statut === 'brouillard' && dedans(e));
    out.push({
      id: 'brouillard', ok: !brouillards.length,
      detail: brouillards.length
        ? `${brouillards.length} pièce(s) encore en brouillard : elles n'entrent dans aucun état. Valide-les ou supprime-les avant de clôturer.`
        : ''
    });

    const attente = mouvementCompte(livre, txt(o.compteAttente) || '471', du, au);
    const solde471 = round3(attente.debit - attente.credit);
    out.push({
      id: 'attente', ok: solde471 === 0,
      detail: solde471 ? `Le compte d'attente porte encore ${solde471.toFixed(3)} : une pièce est rangée nulle part. Ventile-la avant la clôture.` : ''
    });

    // La TVA de chaque mois de l'exercice a-t-elle sa déclaration préparée ? On ne réclame pas le
    // mois en cours ni un mois sans la moindre écriture : on ne réclame pas le néant (6.8.0).
    const moisAvecEcritures = [...new Set((livre.ecritures || []).filter(dedans).map(e => String(e.date).slice(0, 7)))].sort();
    const declarees = new Set((livre.declarations || []).map(d => d.periode));
    const sansDecl = moisAvecEcritures.filter(m => !declarees.has(m));
    out.push({
      id: 'tva', ok: !sansDecl.length,
      detail: sansDecl.length
        ? `${sansDecl.length} mois sans déclaration préparée (${sansDecl.slice(0, 4).join(', ')}${sansDecl.length > 4 ? '…' : ''}). Prépare-les dans l'onglet Déclaration.`
        : ''
    });

    // La balance des tiers : un compte client CRÉDITEUR ou un fournisseur DÉBITEUR n'est pas une
    // faute en soi (acompte, avoir), mais c'est ce qu'un réviseur regarde en premier.
    const lignes = lignesDuLivre(livre, { du, au });
    const bal = balanceDepuisLignes(lignes, soldesDepuisOuverture(livre));
    const anormaux = bal.rows.filter(r =>
      (String(r.account).startsWith(txt(o.compteClients) || '411') && r.solde < -0.001)
      || (String(r.account).startsWith(txt(o.compteFournisseurs) || '401') && r.solde > 0.001));
    out.push({
      id: 'tiers', ok: !anormaux.length,
      detail: anormaux.length
        ? `${anormaux.length} compte(s) de tiers au solde inversé (${anormaux.slice(0, 3).map(r => r.account).join(', ')}). Un acompte l'explique ; une pièce oubliée aussi.`
        : ''
    });

    // Les dotations de l'exercice sont-elles passées ? C'est le contrôle qui relie la 9.7.0 à la
    // clôture : sans dotation, le résultat est faux de tout l'amortissement de l'année.
    const etatImmo = etatImmobilisations(livre, Number(String(au).slice(0, 4)));
    out.push({
      id: 'dotations', ok: !etatImmo.aEcrire,
      detail: etatImmo.aEcrire
        ? `${etatImmo.aEcrire} bien(s) dont la dotation n'est pas passée : le résultat est faux de ce montant. Onglet Immobilisations.`
        : ''
    });

    out.push({
      id: 'equilibre', ok: bal.ok,
      detail: bal.ok ? '' : 'La balance de l\'exercice ne tombe pas juste. Une pièce a été écrite hors de la porte d\'écriture : c\'est à regarder avant tout le reste.'
    });
    return out;
  }

  // Les soldes d'ouverture rangés sur le livre (pièce d'à-nouveau ou reprise de balance).
  function soldesDepuisOuverture(livre) {
    const o = {};
    ((livre.ouverture && livre.ouverture.lignes) || []).forEach(l => {
      o[txt(l.compte)] = round3((o[txt(l.compte)] || 0) + num(l.debit) - num(l.credit));
    });
    return o;
  }

  function cloturerExercice(livre, qui, quand) {
    if (livre.exercice.clos) {
      return { ok: false, motif: `L'exercice ${livre.exercice.annee} est déjà clos depuis le ${String(livre.exercice.closLe || '').slice(0, 10)}.` };
    }
    const brouillards = (livre.ecritures || []).filter(e => e.statut === 'brouillard');
    livre.exercice.clos = true;
    livre.exercice.closLe = Number(quand) || 0;
    livre.exercice.closPar = txt(qui);
    trace(livre, qui, 'exercice clos', String(livre.exercice.annee), quand);
    // On DIT ce qui a été laissé de côté. Clôturer en avalant douze brouillards en silence, c'est
    // exactement le genre de chiffre qu'on découvre six mois après.
    return { ok: true, brouillards: brouillards.length };
  }

  // Une réouverture exige un MOTIF : c'est la seule trace qui explique pourquoi un chiffre a changé
  // après que le client l'a reçu (règle 6.0.0).
  function rouvrirExercice(livre, motif, qui, quand) {
    if (!livre.exercice.clos) return { ok: false, motif: 'Cet exercice n\'est pas clos.' };
    const m = txt(motif);
    if (m.length < 5) return { ok: false, motif: 'Une réouverture demande un motif : c\'est la seule trace qui expliquera pourquoi un chiffre a changé après coup.' };
    livre.exercice.clos = false;
    livre.exercice.reouvertures = Array.isArray(livre.exercice.reouvertures) ? livre.exercice.reouvertures : [];
    livre.exercice.reouvertures.push({ le: Number(quand) || 0, par: txt(qui), motif: m, closLe: livre.exercice.closLe });
    livre.exercice.closLe = null; livre.exercice.closPar = null;
    trace(livre, qui, 'exercice rouvert', m, quand);
    return { ok: true };
  }

  // Les à-nouveaux de l'exercice SUIVANT, calculés sur les écritures RÉELLES de celui-ci plus son
  // ouverture. Les classes 1 à 5 se reportent ; le net des classes 6 et 7 va au compte de résultat.
  // C'est l'écriture qu'on posera dans le livre suivant — explicite, jamais déduite deux fois
  // (règle 9.0.0 : l'implicite disparaît au profit de l'explicite, il ne s'y ajoute pas).
  function anouveauxDe(livre, opts) {
    const o = opts || {};
    const compteResultat = txt(o.compteResultat) || '13';
    const lignes = lignesDuLivre(livre, { du: livre.exercice.du, au: livre.exercice.au });
    const bal = balanceDepuisLignes(lignes, soldesDepuisOuverture(livre));
    const out = [];
    let gestion = 0;
    bal.rows.forEach(r => {
      if (!r.solde) return;
      const c = String(r.account).slice(0, 1);
      if (c === '6' || c === '7') { gestion = round3(gestion + r.solde); return; }
      out.push({ compte: r.account, libelle: r.label || '', debit: r.soldeD, credit: r.soldeC });
    });
    // `gestion` est le solde net des comptes de gestion, signe débiteur : positif = charges >
    // produits = PERTE. Une perte est un débit au compte de résultat, un bénéfice un crédit.
    if (gestion) out.push({ compte: compteResultat, libelle: 'Résultat de l\'exercice ' + livre.exercice.annee, debit: gestion > 0 ? gestion : 0, credit: gestion < 0 ? round3(-gestion) : 0 });
    const d = round3(out.reduce((s, l) => s + l.debit, 0));
    const c = round3(out.reduce((s, l) => s + l.credit, 0));
    return { lignes: out, debit: d, credit: c, equilibre: round3(d - c) === 0, resultat: round3(-gestion) };
  }

  function ecritureAnouveaux(livre, anneeSuivante, opts) {
    const an = anouveauxDe(livre, opts);
    const y = Number(anneeSuivante) || (Number(livre.exercice.annee) + 1);
    return {
      journal: 'AN', date: `${y}-01-01`, piece: 'AN-' + y,
      libelle: `À-nouveaux ${y} — repris de ${livre.exercice.annee}`, source: 'an',
      lignes: an.lignes, an
    };
  }

  // Les EXTOURNES : ce qui a été provisionné à la clôture et qui se défait au premier jour de
  // l'exercice suivant. Une écriture d'inventaire porte `extourne: true` ; l'extourne est une
  // écriture miroir, datée du 1er janvier — jamais une modification de l'originale, qui reste dans
  // son exercice avec son numéro (règle 9.3.0 : une extourne n'est pas une contre-passation).
  //
  // `dejaFaites` est l'ensemble des écritures d'origine dont l'extourne est DÉJÀ validée dans le
  // livre suivant. Sans lui, rouvrir l'exercice suivant une seconde fois reposerait les extournes,
  // et la charge serait annulée deux fois — sans que rien ne le montre.
  function extournesDe(livre, anneeSuivante, dejaFaites) {
    const y = Number(anneeSuivante) || (Number(livre.exercice.annee) + 1);
    const au = `${y}-01-01`;
    const faites = dejaFaites instanceof Set ? dejaFaites : new Set(Array.isArray(dejaFaites) ? dejaFaites : []);
    return (livre.ecritures || [])
      .filter(e => e.extourne && e.statut === 'validee' && !e.extourneeLe && !faites.has(e.id))
      .map(e => ({
        origineId: e.id, extourneDe: e.id,
        journal: 'OD', date: au, piece: 'EXT-' + (e.piece || e.numero || ''),
        libelle: 'Extourne — ' + (e.libelle || ''), source: 'inventaire',
        lignes: (e.lignes || []).map(l => ({ compte: l.compte, libelle: l.libelle, debit: round3(num(l.credit)), credit: round3(num(l.debit)) }))
      }));
  }

  // ---------------------------------------------------------------- les états financiers

  // Déduits de la BALANCE, rubrique par rubrique. Ce qui est garanti et testé : actif = passif, et
  // le résultat du bilan égale celui de l'état de résultat. Ce qui n'est PAS garanti : la
  // présentation exacte NCT 01, que personne n'a encore validée — et l'écran l'écrit.
  function etatsDepuisLignes(lignes, ouverture, opts) {
    const o = opts || {};
    const libelle = o.libelle || (() => '');
    const bal = balanceDepuisLignes(lignes, ouverture || {}, libelle);
    const rows = bal.rows.filter(r => r.solde);
    const amorti = r => /^(28|29|39|49|59)/.test(String(r.account));
    const groupe = (titre, pred, signe) => {
      const l = rows.filter(pred).map(r => ({ compte: r.account, libelle: r.label || '', montant: round3(signe * r.solde) }));
      return { titre, lignes: l, total: round3(l.reduce((s, x) => s + x.montant, 0)) };
    };
    const actif = [
      groupe('Actifs non courants (valeur brute)', r => r.classe === '2' && !amorti(r), 1),
      groupe('Amortissements et provisions', r => r.classe === '2' && amorti(r), 1),
      groupe('Stocks', r => r.classe === '3', 1),
      groupe('Clients et autres créances', r => r.classe === '4' && r.solde > 0, 1),
      groupe('Trésorerie', r => r.classe === '5' && r.solde > 0, 1)
    ];
    const passif = [
      groupe('Capitaux propres et résultats reportés', r => r.classe === '1', -1),
      groupe('Fournisseurs et autres dettes', r => r.classe === '4' && r.solde < 0, -1),
      groupe('Concours bancaires', r => r.classe === '5' && r.solde < 0, -1)
    ];
    const produits = groupe('Produits', r => r.classe === '7', -1);
    const charges = groupe('Charges', r => r.classe === '6', 1);
    const resultat = round3(produits.total - charges.total);
    const totalActif = round3(actif.reduce((s, g) => s + g.total, 0));
    const totalPassif = round3(passif.reduce((s, g) => s + g.total, 0) + resultat);
    return {
      actif, passif, produits, charges, resultat, totalActif, totalPassif,
      equilibre: round3(totalActif - totalPassif) === 0,
      balance: bal
    };
  }

  // Les soldes intermédiaires de gestion et quelques ratios. Les rubriques retenues sont celles de
  // l'usage — À VÉRIFIER : la présentation SCE exacte n'est validée par personne, et un ratio
  // affiché sans sa formule ne vaut rien. Chacun porte donc la sienne.
  function sigDepuisLignes(lignes, ouverture, opts) {
    const e = etatsDepuisLignes(lignes, ouverture, opts);
    const somme = (g, pref) => round3(g.lignes.filter(l => String(l.compte).startsWith(pref)).reduce((s, l) => s + l.montant, 0));
    const ventes = round3(somme(e.produits, '70') + somme(e.produits, '71'));
    const achats = round3(somme(e.charges, '60') + somme(e.charges, '61') + somme(e.charges, '62'));
    const valeurAjoutee = round3(ventes - achats);
    const personnel = round3(somme(e.charges, '64') + somme(e.charges, '65'));
    const impots = somme(e.charges, '66');
    const ebe = round3(valeurAjoutee - personnel - impots);
    const dotations = somme(e.charges, '68');
    const resultatExploitation = round3(ebe - dotations);
    const pct = (a, b) => (b ? round3(100 * a / b) : null);
    return {
      lignes: [
        { id: 'ca', label: 'Chiffre d\'affaires', montant: ventes, formule: 'comptes 70 et 71' },
        { id: 'achats', label: 'Achats et charges externes', montant: achats, formule: 'comptes 60, 61 et 62' },
        { id: 'va', label: 'Valeur ajoutée', montant: valeurAjoutee, formule: 'chiffre d\'affaires − achats et charges externes' },
        { id: 'personnel', label: 'Charges de personnel', montant: personnel, formule: 'comptes 64 et 65' },
        { id: 'ebe', label: 'Excédent brut d\'exploitation', montant: ebe, formule: 'valeur ajoutée − personnel − impôts et taxes' },
        { id: 'dotations', label: 'Dotations aux amortissements', montant: dotations, formule: 'compte 68' },
        { id: 'rex', label: 'Résultat d\'exploitation', montant: resultatExploitation, formule: 'EBE − dotations' },
        { id: 'net', label: 'Résultat de l\'exercice', montant: e.resultat, formule: 'produits − charges' }
      ],
      ratios: [
        { id: 'marge', label: 'Taux de marge (VA / CA)', valeur: pct(valeurAjoutee, ventes), unite: '%' },
        { id: 'personnel', label: 'Poids du personnel (charges de personnel / VA)', valeur: pct(personnel, valeurAjoutee), unite: '%' },
        { id: 'rentabilite', label: 'Rentabilité nette (résultat / CA)', valeur: pct(e.resultat, ventes), unite: '%' }
      ],
      // Un ratio sans dénominateur ne vaut RIEN, et `null` le dit mieux que 0 % (règle 9.6.0).
      etats: e
    };
  }

  // Le contenu du fichier de clôture (`.skanclose`) : ce que le client doit recevoir pour que son
  // bilan et celui du cabinet ne divergent jamais. Pur — le fichier lui-même est fabriqué par
  // l'appelant, qui seul sait chiffrer et écrire sur le disque.
  function dossierDeCloture(livre, opts) {
    const o = opts || {};
    const an = anouveauxDe(livre, o);
    const inventaire = (livre.ecritures || [])
      .filter(e => e.source === 'inventaire' && e.statut === 'validee' && e.date >= livre.exercice.du && e.date <= livre.exercice.au)
      .map(e => ({ id: e.id, numero: e.numero, date: e.date, journal: e.journal, piece: e.piece, libelle: e.libelle, extourne: !!e.extourne, lignes: e.lignes }));
    const lignes = lignesDuLivre(livre, { du: livre.exercice.du, au: livre.exercice.au });
    const etats = etatsDepuisLignes(lignes, soldesDepuisOuverture(livre), o);
    return {
      format: 1,
      dossier: livre.dossier,
      exercice: { annee: livre.exercice.annee, du: livre.exercice.du, au: livre.exercice.au },
      closLe: livre.exercice.closLe || null,
      closPar: livre.exercice.closPar || null,
      anouveaux: an.lignes,
      resultat: an.resultat,
      inventaire,
      etats: { totalActif: etats.totalActif, totalPassif: etats.totalPassif, resultat: etats.resultat, equilibre: etats.equilibre }
    };
  }

  // Ce que le CLIENT en fait. Pur, et il refuse plus qu'il n'accepte : un fichier de clôture pose
  // les à-nouveaux officiels de son comptable, c'est-à-dire qu'il écrase ce que le client croyait.
  function clotureValide(obj, attendu) {
    const motifs = [];
    if (!obj || typeof obj !== 'object') return { ok: false, motifs: ['Ce fichier n\'est pas un dossier de clôture.'] };
    if (obj.format !== 1) {
      return { ok: false, tropRecent: Number(obj.format) > 1, motifs: [Number(obj.format) > 1
        ? 'Ce dossier de clôture vient d\'une version plus récente de SkanFact. Mets l\'application à jour : l\'ouvrir avec les règles d\'aujourd\'hui perdrait ce qu\'elle y a mis.'
        : 'Ce dossier de clôture n\'est pas d\'un format connu.'] };
    }
    if (!obj.exercice || !obj.exercice.annee) motifs.push('Ce dossier de clôture ne dit pas sur quel exercice il porte.');
    const an = Array.isArray(obj.anouveaux) ? obj.anouveaux : [];
    if (!an.length) motifs.push('Ce dossier de clôture ne porte aucun à-nouveau : il n\'y aurait rien à reprendre.');
    const d = round3(an.reduce((s, l) => s + num(l.debit), 0));
    const c = round3(an.reduce((s, l) => s + num(l.credit), 0));
    if (round3(d - c) !== 0) motifs.push(`Les à-nouveaux ne s'équilibrent pas : ${d.toFixed(3)} au débit contre ${c.toFixed(3)} au crédit.`);
    if (attendu && txt(attendu.matricule) && txt(obj.matricule) && txt(attendu.matricule) !== txt(obj.matricule)) {
      motifs.push('Ce dossier de clôture porte le matricule d\'une autre entreprise.');
    }
    return { ok: !motifs.length, motifs, debit: d, credit: c };
  }

  // ---------- la pièce équilibrée et l'amortissement (9.6.1) ----------
  //
  // Ces deux moteurs vivaient dans core.js depuis la 3.5.0 et la 6.3.0. Ils n'y avaient plus leur
  // place : aucun ne prend `data`, tous prennent un OBJET (une pièce, un bien) — c'est très
  // exactement la règle de découpage posée en 9.1.0. Et le Cabinet, qui ne charge pas core.js, en a
  // besoin dès la 9.7.0 pour les dossiers hors SkanFact. core.js les réexporte à l'identique.

  function ajouterJoursIso(iso, n) {
    if (!estUnJour(iso)) return '';
    const d = jourUTC(iso);
    d.setUTCDate(d.getUTCDate() + (Number(n) || 0));
    return isoUTC(d);
  }

  // Une pièce = un ensemble d'écritures qui s'équilibrent. On la construit avec ce petit aide :
  // il arrondit, ignore les montants nuls, et refuse de rendre un déséquilibre sans le signaler.
  function entrySet(base) {
    const lines = [];
    const push = (account, label, debit, credit, extra) => {
      let d = round3(debit || 0), c = round3(credit || 0);
      // Un avoir produit des montants négatifs. Aucun logiciel comptable n'accepte un débit négatif :
      // un montant négatif change de colonne, il ne garde pas son signe. C'est ce qui fait qu'un
      // avoir s'écrit D ventes / D TVA / C client, exactement à l'envers d'une facture.
      if (d < 0) { c = round3(c - d); d = 0; }
      if (c < 0) { d = round3(d - c); c = 0; }
      if (!d && !c) return;
      lines.push({ ...base, account: String(account || ''), label: label || base.label || '', debit: d, credit: c, ...(extra || {}) });
    };
    return {
      debit: (a, l, n, e) => push(a, l, n, 0, e),
      credit: (a, l, n, e) => push(a, l, 0, n, e),
      done() {
        const d = round3(lines.reduce((s, x) => s + x.debit, 0));
        const c = round3(lines.reduce((s, x) => s + x.credit, 0));
        // Un écart de quelques millimes vient des arrondis de TVA ligne par ligne. On l'absorbe sur
        // la dernière ligne plutôt que de livrer une pièce qui ne passera pas à l'import.
        const gap = round3(d - c);
        if (gap && lines.length) {
          const last = lines[lines.length - 1];
          if (gap > 0) last.credit = round3(last.credit + gap); else last.debit = round3(last.debit - gap);
          if (last.credit < 0) { last.debit = round3(last.debit - last.credit); last.credit = 0; }
          if (last.debit < 0) { last.credit = round3(last.credit - last.debit); last.debit = 0; }
        }
        return lines;
      }
    };
  }

  const DEFAULT_ASSET_CLASSES = [
    ['informatique', 'Matériel informatique', 3],
    ['logiciel', 'Logiciels et licences', 3],
    ['bureau', 'Matériel de bureau', 5],
    ['mobilier', 'Mobilier', 10],
    ['outillage', 'Outillage et matériel technique', 5],
    ['transport', 'Matériel de transport', 5],
    ['agencement', 'Agencements et installations', 10],
    ['construction', 'Constructions', 20],
    ['autre', 'Autre immobilisation', 5]
  ];
  const assetClassLabel = k => (DEFAULT_ASSET_CLASSES.find(c => c[0] === k) || [, 'Autre immobilisation'])[1];
  const assetClassYears = k => (DEFAULT_ASSET_CLASSES.find(c => c[0] === k) || [, , 5])[2];

  // Nombre de jours entre deux dates en base 360 (mois de 30 jours), comme le veut le prorata temporis.
  function days360(fromIso, toIso) {
    if (!fromIso || !toIso || toIso < fromIso) return 0;
    const [y1, m1, d1] = fromIso.split('-').map(Number);
    const [y2, m2, d2] = toIso.split('-').map(Number);
    return (y2 - y1) * 360 + (m2 - m1) * 30 + (Math.min(d2, 30) - Math.min(d1, 30));
  }

  // Le tableau d'amortissement d'un bien : une ligne par exercice, de la mise en service à la fin.
  // `base` = valeur amortissable (acquisition − valeur résiduelle). La dernière annuité absorbe les
  // arrondis, sinon la VNC finirait à 0,001 DT au lieu de zéro.
  function assetSchedule(asset) {
    const value = Number(asset.amount) || 0;
    const residual = Number(asset.residual) || 0;
    const years = Number(asset.years) || 0;
    const start = asset.date || '';
    const base = round3(Math.max(0, value - residual));
    if (!start || years <= 0 || base <= 0) return [];
    const end = ajouterJoursIso(ajouterMoisIso(start, years * 12), -1);   // dernier jour amorti
    const perYear = base / years;
    const rows = [];
    let cumulated = 0;
    const firstYear = Number(start.slice(0, 4));
    const lastYear = Number(end.slice(0, 4));
    for (let y = firstYear; y <= lastYear; y++) {
      const from = y === firstYear ? start : `${y}-01-01`;
      const to = y === lastYear ? end : `${y}-12-31`;
      // +1 jour : le jour de mise en service compte, et le 31/12 aussi.
      const d = Math.max(0, days360(from, to) + 1);
      let annuity = round3(perYear * d / 360);
      if (y === lastYear) annuity = round3(base - cumulated);         // la dernière solde le reste
      if (round3(cumulated + annuity) > base) annuity = round3(base - cumulated);
      cumulated = round3(cumulated + annuity);
      rows.push({ year: y, from, to, days: d, annuity, cumulated, nbv: round3(value - cumulated) });
    }
    return rows;
  }

  // Amortissement cumulé à une date quelconque (utile pour la VNC au jour d'une cession).
  function assetCumulated(asset, dateIso) {
    const value = Number(asset.amount) || 0;
    const residual = Number(asset.residual) || 0;
    const years = Number(asset.years) || 0;
    const start = asset.date || '';
    const base = round3(Math.max(0, value - residual));
    if (!start || years <= 0 || base <= 0 || dateIso < start) return 0;
    // `d` est un nombre de jours base 360 ; la durée totale vaut `years * 360` jours.
    const d = Math.min(years * 360, days360(start, dateIso) + 1);
    return round3(Math.min(base, base * d / (years * 360)));
  }

  // Dotation de l'exercice `year` — zéro hors période d'amortissement, et zéro après une cession
  // (l'année de la cession, on amortit jusqu'au jour de la sortie).
  function assetYear(asset, year) {
    const rows = assetSchedule(asset);
    const row = rows.find(r => r.year === year);
    const disposal = asset.disposal && asset.disposal.date ? asset.disposal.date : '';
    // Sorti d'un exercice antérieur : plus rien ne bouge, le cumul reste figé au jour de la cession.
    if (disposal && Number(disposal.slice(0, 4)) < year) return { annuity: 0, cumulated: assetCumulated(asset, disposal), nbv: 0, out: true };
    if (!row) return { annuity: 0, cumulated: assetCumulated(asset, `${year}-12-31`), nbv: round3((Number(asset.amount) || 0) - assetCumulated(asset, `${year}-12-31`)), out: !!disposal };
    if (disposal && Number(disposal.slice(0, 4)) === year) {
      const partial = assetCumulated(asset, disposal);
      const before = assetCumulated(asset, `${year - 1}-12-31`);
      return { annuity: round3(partial - before), cumulated: partial, nbv: round3((Number(asset.amount) || 0) - partial), out: true };
    }
    return { annuity: row.annuity, cumulated: row.cumulated, nbv: row.nbv, out: false };
  }

  // Valeur nette comptable : ce que le bien « vaut » encore dans les comptes.
  function assetNBV(asset, dateIso) {
    return round3((Number(asset.amount) || 0) - assetCumulated(asset, dateIso));
  }

  // Résultat d'une cession : prix de vente moins la VNC au jour de la sortie.
  // Positif = plus-value (imposable), négatif = moins-value. À VÉRIFIER avec le comptable.
  function disposalResult(asset) {
    const dis = asset.disposal;
    if (!dis || !dis.date) return null;
    const nbv = assetNBV(asset, dis.date);
    const price = Number(dis.amount) || 0;
    return { date: dis.date, price, nbv, result: round3(price - nbv), reason: dis.reason || '' };
  }

  // Amortissement cumulé, figé au jour de la sortie : après une cession, plus rien ne se déduit.
  function cappedCumulated(asset, dateIso) {
    const out = asset.disposal && asset.disposal.date ? asset.disposal.date : '';
    return assetCumulated(asset, out && dateIso > out ? out : dateIso);
  }

  return {
    round3, cleDePiece, csvDangereux, nombreDepuisCsv, dateDepuisCsv,
    ecritureValide, entreesDepuisCsv,
    entriesBalance, entriesByAccount,
    balanceDepuisLignes, grandLivreDepuisLignes,
    journalDepuisLignes, centralisateurDepuisLignes,
    lettrageDepuisLignes,
    // Le livre (9.2.0)
    LIVRE_FORMAT, STATUTS_ECRITURE, NATURES_COMPTE, SOURCES_ECRITURE, JOURNAUX_PAR_DEFAUT,
    PLAN_COMPTABLE, libelleDuPlan, migrerLivre,
    natureDeCompte, livreVide, isValidLivre, livreVersionInconnue, assurerCompte,
    ajouterEcriture, validerEcriture, contrepasser, importerPaquet, piecesDepuisLignes,
    lettrer, delettrer, prochaineLettre, balanceOuverture, lignesDuLivre,
    planDepuisCsv, balanceDepuisCsv,
    // La saisie (9.3.0)
    premierDuMoisSuivant, ajouterMoisIso, sansAccents, soldeDeLignes, comptesQuiCorrespondent,
    modifierEcriture, supprimerEcriture, validerLot, extourner, chercherEcritures,
    guideValide, ecritureDepuisGuide, occurrencesAGenerer,
    correspondanceValide, compteCorrespondant, appliquerCorrespondance,
    // La banque (9.5.0)
    RELEVE_NIVEAUX, RELEVE_JOURS, AGING_BUCKETS,
    colonnesReleve, releveDepuisCsv, releveValide, ajouterReleve, supprimerReleve,
    lignesBancaires, rapprocherAuto, rapprocherLigne, derapprocherReleve, suspens,
    compteDuLibelle, ecritureProposee, lettrageAuto,
    echeancierDepuisLignes, balanceAgeeDepuisLignes,
    // La déclaration mensuelle (9.6.0)
    COMPTES_FISCAUX, CASES_A_VERIFIER, mouvementCompte, declarationMensuelle, controlesDeclaration,
    ecritureDeclaration, poserDeclaration, pointerDeclaration, etatDuMois,
    // Les immobilisations et l'inventaire (9.7.0)
    IMMO_METHODES, COMPTES_IMMO, IMMO_A_VERIFIER,
    bienVersActif, planDegressif, planDuBien, cumulDuBien, vncDuBien,
    resultatCession, repriseSubvention, immoValide,
    ajouterImmobilisation, modifierImmobilisation, supprimerImmobilisation,
    etatImmobilisations, immobilisationsACreer, ecrituresImmobilisations, noterEcritureImmo,
    inventaireValide, totalInventaire, poserInventaire, variationDeStock,
    // La clôture d'exercice (9.8.0)
    GUIDES_INVENTAIRE, controlesCloture, soldesDepuisOuverture,
    cloturerExercice, rouvrirExercice, anouveauxDe, ecritureAnouveaux, extournesDe,
    etatsDepuisLignes, sigDepuisLignes, dossierDeCloture, clotureValide,
    // La pièce équilibrée et l'amortissement (9.6.1)
    ajouterJoursIso, entrySet,
    DEFAULT_ASSET_CLASSES, assetClassLabel, assetClassYears, days360,
    assetSchedule, assetCumulated, assetYear, assetNBV, disposalResult, cappedCumulated
  };
});
