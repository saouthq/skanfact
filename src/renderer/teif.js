// La facture électronique tunisienne (TTN « El Fatoora », format TEIF 1.8.8) — 10.15.0.
//
// Depuis le 1er janvier 2026, une facture émise entre professionnels part aussi en XML signé vers
// Tunisie TradeNet (loi de finances 2026, art. 53 — À VÉRIFIER avec le comptable pour chaque
// entreprise). Ce module fait la partie qui ne dépend que de nous : il lit une facture ou un avoir
// ÉMIS et rend le fichier TEIF que le schéma officiel accepte, prêt à être signé (certificat
// TunTrust / DigiGo) et déposé sur la plateforme El Fatoora.
//
// Ce qu'il ne fait PAS, exprès : il ne signe rien (la signature demande le certificat de
// l'entreprise, qui ne passe jamais par nous) et il ne dépose rien (le dépôt demande l'abonnement de
// l'entreprise à la TTN). Il ne CALCULE rien non plus : chaque montant vient de `computeTotals`, le
// même calcul que le PDF — deux calculs de la même facture finiraient par dire deux montants.
//
// La structure suit le schéma publié par la TTN (facture_INVOIC_V1.8.8_withoutSig.xsd) et le Guide
// d'implémentation TEIF V2.0 : ordre des éléments, codes des référentiels (I-01, I-11, I-1602…),
// formats (dates ddMMyy, montants à point décimal sans séparateur). Les rapports entre montants
// que le Guide sous-entend sans les écrire tiennent aussi : le total HT (I-176) est la somme des
// lignes (I-171), le TTC (I-180) est le HT plus les taxes (I-178), la TVA d'un taux est sa base
// fois son taux.
//
// Tout ce qui n'est pas écrit dans le schéma est un choix, et il est dit ici « À VÉRIFIER » :
// l'unité de mesure, le code d'article, la note d'honoraires (I-13), le code des conditions de
// paiement. Aucun n'empêche le schéma de valider ; chacun peut être refusé par un contrôle métier
// de la TTN qu'aucun document public ne décrit.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core'));
  else root.SkanTeif = factory(root.SkanCore);
})(typeof self !== 'undefined' ? self : this, function (C) {

  const VERSION = '1.8.8';

  // ---------- les identifiants ----------
  // Le matricule fiscal que TEIF exige est la forme COMPLÈTE, sans séparateur, en 13 caractères :
  // sept chiffres, la lettre-clé (jamais I, O ni U), le code TVA (A, B, D, N, P), la catégorie
  // (C, M, N, P) et le numéro d'établissement 000. « 1234567A/A/M/000 » s'écrit 1234567AAM000.
  // C'est la règle du schéma lui-même (xs:assert du type PartnerIdentifierTestType) ; le Guide admet
  // aussi le code TVA F (forfaitaire), la catégorie E et un établissement secondaire, que la TTN
  // REFUSE : on le dit plutôt que de fabriquer un fichier voué au rejet.
  const MF_TEIF = /^[0-9]{7}[ABCDEFGHJKLMNPQRSTVWXYZ][ABDNP][CMNP]000$/;
  function compacterMF(s) { return String(s == null ? '' : s).toUpperCase().replace(/[\s/.\-_]/g, ''); }

  // Ce qu'on peut dire d'un matricule saisi : la forme TEIF, ou ce qui lui manque, en français.
  function lireMatricule(s) {
    const v = compacterMF(s);
    if (!v) return { ok: false, vide: true, motif: 'aucun matricule fiscal' };
    if (MF_TEIF.test(v)) return { ok: true, valeur: v };
    if (/^[0-9]{7}[A-Z]$/.test(v)) {
      return { ok: false, motif: `le matricule « ${String(s).trim()} » s'arrête à la lettre-clé : il manque le code TVA, la catégorie et l'établissement (par exemple ${v}/A/M/000, tels qu'ils figurent sur la carte d'identification fiscale)` };
    }
    if (/^[0-9]{7}[A-Z][A-Z][A-Z][0-9]{3}$/.test(v)) {
      const cle = v[7], tva = v[8], cat = v[9], etab = v.slice(10);
      if ('IOU'.includes(cle)) return { ok: false, motif: `la lettre-clé « ${cle} » n'existe pas dans un matricule tunisien (jamais I, O ni U) : vérifie la carte d'identification fiscale` };
      if (tva === 'F') return { ok: false, motif: 'le code TVA F (forfaitaire) n\'est pas accepté par El Fatoora : la facture électronique vise les entreprises soumises à la TVA — À VÉRIFIER avec ton comptable' };
      if (!'ABDNP'.includes(tva)) return { ok: false, motif: `le code TVA « ${tva} » n'est pas reconnu (A, B, D, N ou P)` };
      if (!'CMNP'.includes(cat)) return { ok: false, motif: `la catégorie « ${cat} » n'est pas acceptée par El Fatoora (C, M, N ou P)` };
      if (etab !== '000') return { ok: false, motif: `l'établissement « ${etab} » : El Fatoora n'accepte aujourd'hui que l'établissement principal 000 — À VÉRIFIER avec ton comptable` };
    }
    return { ok: false, motif: `« ${String(s).trim()} » n'a pas la forme d'un matricule fiscal (sept chiffres, une lettre, puis code TVA, catégorie et établissement : 1234567A/A/M/000)` };
  }

  // L'identifiant d'un CLIENT : son matricule fiscal (I-01), ou pour une personne sa carte
  // d'identité (I-02, huit chiffres) ou sa carte de séjour (I-03, neuf chiffres). Le champ de la
  // fiche client s'appelle « Matricule fiscal / CIN » : les deux s'y écrivent.
  function lireIdentifiantClient(s) {
    // « CIN 09876543 », « C.I.N : 09876543 » : le mot est une étiquette, pas une partie du numéro.
    const brut = String(s == null ? '' : s).replace(/^\s*(c\.?\s*i\.?\s*n\.?|carte\s+d'?identit[ée](\s+nationale)?)\s*(n[°o]?\.?)?\s*:?\s*/i, '');
    const v = compacterMF(brut);
    if (/^[0-9]{8}$/.test(v)) return { ok: true, type: 'I-02', valeur: v, personne: true };
    if (/^[0-9]{9}$/.test(v)) return { ok: true, type: 'I-03', valeur: v, personne: true };
    const mf = lireMatricule(brut);
    if (mf.ok) return { ok: true, type: 'I-01', valeur: mf.valeur, personne: false };
    // Un identifiant étranger commence par le code de son pays (« GB 123 4567 89 », « FR… ») : c'est
    // le matricule fiscal non tunisien (I-04), que le schéma prend tel quel. Un numéro qui commence
    // par sept chiffres est un matricule TUNISIEN incomplet, et on dit ce qui lui manque.
    if (/^[A-Z]{2}[A-Z0-9]{2,33}$/.test(v) && !/^[0-9]{7}/.test(v)) return { ok: true, type: 'I-04', valeur: v, personne: false, etranger: true };
    return { ok: false, vide: mf.vide, motif: mf.motif };
  }

  // ---------- les formats ----------
  const ISO_DEVISE = { DT: 'TND', TND: 'TND', EUR: 'EUR', USD: 'USD', GBP: 'GBP', CHF: 'CHF', MAD: 'MAD', DZD: 'DZD' };
  function deviseIso(cur) { return ISO_DEVISE[String(cur || 'DT').toUpperCase()] || ''; }
  // ddMMyy — le seul format de date que le schéma connaît pour une date simple. Jour de calendrier,
  // lu dans la chaîne ISO : jamais un Date, donc jamais un fuseau (règle 5.2.3).
  function dateTeif(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? m[3] + m[2] + m[1].slice(2) : '';
  }
  // Un montant : point décimal, sans séparateur de milliers, aux décimales de la devise
  // (trois pour le dinar). Le schéma : -?[0-9]{1,15}([.][0-9]{1,5})? — une virgule est refusée.
  function montantTeif(n, cur) {
    const dec = C.decimalsFor(cur);
    const v = C.arrondiDevise(cur)(Number(n) || 0);
    const s = Math.abs(v).toFixed(dec);
    return (v < 0 && Number(s) !== 0 ? '-' : '') + s;
  }
  function tauxTeif(r) { const n = Number(r) || 0; return String(Math.round(n * 1000) / 1000); }
  // Une quantité : un nombre à point décimal, jusqu'à trois décimales, sans zéros inutiles.
  function quantiteTeif(q) { const n = Number(q) || 0; return String(Math.round(n * 1000) / 1000); }
  // L'unité de mesure : huit caractères au plus. Le schéma ne l'énumère pas ; les exemples de la TTN
  // écrivent UNIT. Nos unités se traduisent en un mot court — À VÉRIFIER.
  const UNITES = { '': 'UNIT', u: 'UNIT', unite: 'UNIT', piece: 'UNIT', h: 'HEURE', heure: 'HEURE', j: 'JOUR', jour: 'JOUR',
    'demi-journee': 'DEMIJOUR', mois: 'MOIS', an: 'AN', annee: 'AN', forfait: 'FORFAIT', intervention: 'INTERV', licence: 'LICENCE',
    abonnement: 'ABONNEM', poste: 'POSTE', lot: 'LOT', ml: 'ML', 'm²': 'M2', m2: 'M2', 'm³': 'M3', m3: 'M3', kg: 'KG', l: 'L', km: 'KM', page: 'PAGE' };
  function uniteTeif(u) {
    const k = String(u || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (Object.prototype.hasOwnProperty.call(UNITES, k)) return UNITES[k];
    const brut = k.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return brut || 'UNIT';
  }
  function couper(s, max) { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; }

  // ---------- l'écriture XML ----------
  function echapper(s) {
    return String(s == null ? '' : s)
      // Un caractère de contrôle n'a pas le droit d'exister dans un XML 1.0 : il rendrait le fichier illisible.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  // Un nœud : [nom, attributs, enfants | texte]. L'ordre des enfants EST l'ordre du schéma.
  function el(nom, attrs, contenu) { return { nom, attrs: attrs || {}, contenu: contenu == null ? '' : contenu }; }
  function ecrire(n, retrait) {
    const pad = '  '.repeat(retrait);
    const a = Object.keys(n.attrs).filter(k => n.attrs[k] != null && n.attrs[k] !== '').map(k => ` ${k}="${echapper(n.attrs[k])}"`).join('');
    if (Array.isArray(n.contenu)) {
      const enfants = n.contenu.filter(Boolean);
      if (!enfants.length) return `${pad}<${n.nom}${a}/>`;
      return `${pad}<${n.nom}${a}>\n${enfants.map(e => ecrire(e, retrait + 1)).join('\n')}\n${pad}</${n.nom}>`;
    }
    return `${pad}<${n.nom}${a}>${echapper(n.contenu)}</${n.nom}>`;
  }

  // ---------- le contrôle ----------
  // Ce qui EMPÊCHE de fabriquer le fichier (bloquants), et ce qui mérite d'être relu sans bloquer
  // (remarques). Chaque bloquant nomme la case qui le règle (`cible`), pour que l'écran y mène.
  function controleTeif(doc, client, company) {
    const d = doc || {}, co = company || {}, cl = client || null;
    const bloquants = [], remarques = [];
    const bloque = (cible, message) => bloquants.push({ cible, message });
    if (!['facture', 'avoir'].includes(d.type)) bloque('piece', 'Seules une facture et un avoir partent vers El Fatoora : un devis ou un bon ne sont pas des factures.');
    else if (d.status === 'brouillon' || !d.number) bloque('piece', 'La pièce n\'est pas encore émise : c\'est l\'émission qui lui donne son numéro, et une facture électronique ne part qu\'avec son numéro.');
    if (!String(co.name || '').trim()) bloque('societe:name', 'La raison sociale de ton entreprise est vide.');
    const mf = lireMatricule(co.matricule);
    if (!mf.ok) bloque('societe:matricule', mf.vide ? 'Ton matricule fiscal est vide : El Fatoora identifie l\'émetteur par lui.' : 'Ton matricule fiscal ne va pas : ' + mf.motif + '.');
    if (!cl) bloque('client', 'La pièce n\'a pas de client.');
    else {
      if (!String(cl.name || '').trim()) bloque('client:name', 'Le client n\'a pas de nom.');
      const id = lireIdentifiantClient(cl.matricule);
      if (!id.ok) bloque('client:matricule', id.vide
        ? `${cl.name || 'Le client'} n'a ni matricule fiscal ni carte d'identité : El Fatoora identifie aussi le destinataire.`
        : `L'identifiant de ${cl.name || 'ce client'} ne va pas : ${id.motif}.`);
      if (!String(cl.address || '').trim()) remarques.push({ cible: 'client:address', message: `${cl.name || 'Le client'} n'a pas d'adresse : le fichier part sans, ce que le schéma accepte.` });
    }
    const cur = d.currency || co.currency || 'DT';
    if (!deviseIso(cur)) bloque('piece', `La devise « ${cur} » n'a pas de code ISO connu de SkanFact.`);
    if (!(d.lines || []).length) bloque('piece', 'La pièce n\'a aucune ligne.');
    if (d.type === 'avoir' && !d.creditOfNumber) remarques.push({ cible: 'piece', message: 'Cet avoir n\'est rattaché à aucune facture : il part sans référence à une facture (I-89).' });
    if (String(d.number || '').length > 70) bloque('piece', 'Le numéro de la pièce dépasse 70 caractères.');
    return { ok: !bloquants.length, bloquants, remarques };
  }

  // Le type de document TEIF : facture (I-11), avoir (I-12), note d'honoraires (I-13) pour une
  // profession libérale — c'est le nom sous lequel elle facture (7.22.0). À VÉRIFIER.
  function typeDocument(d, co) {
    if (d.type === 'avoir') return { code: 'I-12', libelle: 'Facture d\'avoir' };
    if (C.estLiberal(co)) return { code: 'I-13', libelle: 'Note d\'honoraire' };
    return { code: 'I-11', libelle: 'Facture' };
  }

  // ---------- le fichier ----------
  // Rend { ok, xml, nom, bloquants, remarques }. Sans `ok`, il n'y a PAS de fichier : un XML à moitié
  // juste serait refusé par la TTN, et c'est le jour de l'échéance qu'on le découvrirait.
  function teifXml(doc, client, company, opts) {
    const o = opts || {};
    const ctl = controleTeif(doc, client, company);
    if (!ctl.ok) return { ok: false, xml: '', nom: '', bloquants: ctl.bloquants, remarques: ctl.remarques };
    const d = doc, co = company, cl = client;
    const cur = d.currency || co.currency || 'DT';
    const iso = deviseIso(cur);
    const t = C.computeTotals(d, co);
    const rd = C.arrondiDevise(cur);
    const moa = (code, montant, extra) => el('Moa', { currencyCodeList: 'ISO_4217', amountTypeCode: code }, [
      el('Amount', { currencyIdentifier: iso }, montantTeif(montant, cur)), extra || null]);
    const emetteur = lireMatricule(co.matricule).valeur;
    const dest = lireIdentifiantClient(cl.matricule);
    const tp = typeDocument(d, co);

    // Les dates : émission (I-31), échéance (I-32) quand elle existe.
    const dates = [el('DateText', { format: 'ddMMyy', functionCode: 'I-31' }, dateTeif(d.date))];
    if (d.type === 'facture' && d.dueDate && dateTeif(d.dueDate)) dates.push(el('DateText', { format: 'ddMMyy', functionCode: 'I-32' }, dateTeif(d.dueDate)));

    // L'avoir renvoie à la facture qu'il corrige (I-89), avec sa date quand on la connaît.
    let references = null;
    if (d.type === 'avoir' && d.creditOfNumber) {
      const orig = (o.facture && o.facture.date) ? [el('ReferenceDate', {}, [el('DateText', { format: 'ddMMyy', functionCode: 'I-31' }, dateTeif(o.facture.date))])] : [];
      references = el('DocumentReferences', {}, [el('DocumentReference', {}, [el('Reference', { refID: 'I-89' }, couper(d.creditOfNumber, 200)), ...orig])]);
    }

    const adresse = (texte) => el('PartnerAdresses', { lang: 'fr' }, [
      el('AdressDescription', {}, couper(texte, 500)),
      el('Country', { codeList: 'ISO_3166-1' }, 'TN')]);
    const contacts = [];
    const contact = (moyen, valeur) => el('CtaSection', {}, [
      el('Contact', { functionCode: 'I-94' }, [el('ContactIdentifier', {}, 'CONTACT'), el('ContactName', {}, couper(co.name, 200))]),
      el('Communication', {}, [el('ComMeansType', {}, moyen), el('ComAdress', {}, couper(valeur, 500))])]);
    if (String(co.phone || '').trim()) contacts.push(contact('I-101', co.phone));
    if (String(co.email || '').trim()) contacts.push(contact('I-103', co.email));

    const fournisseur = el('PartnerDetails', { functionCode: 'I-62' }, [
      el('Nad', {}, [
        el('PartnerIdentifier', { type: 'I-01' }, emetteur),
        el('PartnerName', { nameType: 'Qualification' }, couper(co.name, 200)),
        adresse(co.address)]),
      String(co.rc || '').trim() ? el('RffSection', {}, [el('Reference', { refID: 'I-815' }, couper(co.rc, 200))]) : null,
      ...contacts]);
    const acheteur = el('PartnerDetails', { functionCode: 'I-64' }, [
      el('Nad', {}, [
        el('PartnerIdentifier', { type: dest.type }, dest.valeur),
        el('PartnerName', { nameType: dest.personne ? 'Physical' : 'Qualification' }, couper(cl.name, 200)),
        adresse(cl.address)])]);

    // Le paiement : par virement quand l'entreprise a un RIB (I-114, le RIB dans la description),
    // sinon la condition générale (I-111). Les conditions de la pièce en description. À VÉRIFIER.
    const rib = String(co.rib || '').replace(/\s+/g, '');
    const termes = [d.terms || (d.type === 'facture' ? co.paymentTerms : '') || '', rib ? `RIB : ${co.rib}${co.bank ? ' (' + co.bank + ')' : ''}` : '']
      .map(s => String(s).trim()).filter(Boolean).join(' ');
    const paiement = d.type === 'facture' ? el('PytSection', {}, [el('PytSectionDetails', {}, [
      el('Pyt', {}, [el('PaymentTearmsTypeCode', {}, rib ? 'I-114' : 'I-111'),
        termes ? el('PaymentTearmsDescription', {}, couper(termes, 500)) : null])])]) : null;

    // Un texte libre : l'objet (I-41), la mention légale d'une entreprise hors TVA ou le motif d'un
    // avoir (I-48). Chacun tient en 500 caractères.
    const textes = [];
    if (String(d.subject || '').trim()) textes.push(el('FreeTextDetail', { subjectCode: 'I-41' }, [el('FreeTexts', {}, couper(d.subject, 500))]));
    const coTva = C.regimePourPiece(d, co);
    if (!C.assujettiTVA(coTva) && t.totalVAT === 0 && C.mentionTVA(coTva, 'fr')) textes.push(el('FreeTextDetail', { subjectCode: 'I-48' }, [el('FreeTexts', {}, couper(C.mentionTVA(coTva, 'fr'), 500))]));
    if (d.type === 'avoir' && String(d.creditReason || '').trim()) textes.push(el('FreeTextDetail', { subjectCode: 'I-48' }, [el('FreeTexts', {}, couper('Motif : ' + d.creditReason, 500))]));

    // Les lignes. Le montant de chaque ligne (I-171) est son HT APRÈS la remise globale, pour que
    // leur somme refasse exactement le total HT (I-176) : la remise se répartit comme `computeTotals`
    // la répartit pour la TVA, et le millime d'arrondi va à la dernière ligne remisable.
    const disc = Number(t.discountRate) || 0;
    const discountable = rd(t.lines.filter(l => !l.noDiscount).reduce((s, l) => s + l.ht, 0));
    const facteur = discountable > 0 ? (discountable - t.discount) / discountable : 1;
    const nets = t.lines.map(l => rd(l.noDiscount ? l.ht : l.ht * facteur));
    const ecart = rd(t.netHT - nets.reduce((s, x) => s + x, 0));
    if (Math.abs(ecart) > 0) {
      let i = -1;
      t.lines.forEach((l, k) => { if (!l.noDiscount) i = k; });
      if (i < 0) i = nets.length - 1;
      if (i >= 0) nets[i] = rd(nets[i] + ecart);
    }
    const lignes = t.lines.map((l, k) => {
      const libelle = [l.label, l.description].map(s => String(s || '').trim()).filter(Boolean).join(' — ') || `Ligne ${k + 1}`;
      return el('Lin', {}, [
        el('ItemIdentifier', {}, String(k + 1)),
        el('LinImd', { lang: 'fr' }, [el('ItemCode', {}, couper(l.itemCode || l.itemId || String(k + 1), 35)), el('ItemDescription', {}, couper(libelle, 500))]),
        el('LinQty', {}, [el('Quantity', { measurementUnit: uniteTeif(l.unit) }, quantiteTeif(l.qty))]),
        el('LinTax', {}, [el('TaxTypeName', { code: 'I-1602' }, 'TVA'), el('TaxDetails', {}, [el('TaxRate', {}, tauxTeif(l.vatRate))])]),
        disc > 0 && !l.noDiscount ? el('LinAlc', {}, [
          el('Alc', { allowanceCode: 'I-151' }, [el('SpecialServices', { lang: 'fr' }, 'Remise')]),
          el('Pcd', {}, [el('Percentage', {}, tauxTeif(disc)), el('PercentageBasis', {}, montantTeif(l.ht, cur))])]) : null,
        el('LinMoa', {}, [
          el('MoaDetails', {}, [moa('I-183', l.unitPrice)]),
          el('MoaDetails', {}, [moa('I-171', nets[k])])])]);
    });

    // Les totaux de la facture. Le TTC porte le montant en toutes lettres, comme le PDF.
    const totaux = [
      el('AmountDetails', {}, [moa('I-176', t.netHT)]),
      el('AmountDetails', {}, [moa('I-182', t.netHT)]),
      el('AmountDetails', {}, [moa('I-181', t.totalVAT)]),
      el('AmountDetails', {}, [moa('I-180', t.totalTTC, el('AmountDescription', { lang: 'fr' }, couper(C.amountToWords(t.totalTTC, cur, 'fr'), 500)))])
    ];
    if (t.discount > 0) totaux.splice(0, 0, el('AmountDetails', {}, [moa('I-172', t.totalHT)]));

    // Les taxes : le droit de timbre (I-1601) quand la pièce le porte, puis la TVA taux par taux —
    // base (I-177) et montant (I-178), dans cet ordre (les deux codes s'échangent facilement, et un
    // échange que le schéma accepte serait une facture fausse).
    const taxes = [];
    if (t.stamp > 0) taxes.push(el('InvoiceTaxDetails', {}, [
      el('Tax', {}, [el('TaxTypeName', { code: 'I-1601' }, 'Droit de timbre'), el('TaxDetails', {}, [el('TaxRate', {}, '0')])]),
      el('AmountDetails', {}, [moa('I-178', t.stamp)])]));
    Object.keys(t.vatByRate).sort((a, b) => Number(b) - Number(a)).forEach(r => {
      const v = t.vatByRate[r];
      taxes.push(el('InvoiceTaxDetails', {}, [
        el('Tax', {}, [el('TaxTypeName', { code: 'I-1602' }, 'TVA'), el('TaxDetails', {}, [el('TaxRate', {}, tauxTeif(r))])]),
        el('AmountDetails', {}, [moa('I-177', v.base)]),
        el('AmountDetails', {}, [moa('I-178', v.vat)])]));
    });

    const racine = el('TEIF', { version: VERSION, controlingAgency: 'TTN' }, [
      el('InvoiceHeader', {}, [
        el('MessageSenderIdentifier', { type: 'I-01' }, emetteur),
        el('MessageRecieverIdentifier', { type: dest.type }, dest.valeur)]),
      el('InvoiceBody', {}, [
        el('Bgm', {}, [el('DocumentIdentifier', {}, d.number), el('DocumentType', { code: tp.code }, tp.libelle), references]),
        el('Dtm', {}, dates),
        el('PartnerSection', {}, [fournisseur, acheteur]),
        paiement,
        textes.length ? el('Ftx', {}, textes) : null,
        el('LinSection', {}, lignes),
        el('InvoiceMoa', {}, totaux),
        el('InvoiceTax', {}, taxes)])]);
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + ecrire(racine, 0) + '\n';
    return { ok: true, xml, nom: nomFichierTeif(d, co), bloquants: [], remarques: ctl.remarques };
  }

  // Le nom du fichier : le numéro de la pièce, lisible, sans caractère qu'un système refuserait.
  function nomFichierTeif(doc, company) {
    const mf = lireMatricule((company || {}).matricule);
    const num = String((doc || {}).number || 'piece').replace(/[^A-Za-z0-9\-_]/g, '_');
    return `TEIF_${mf.ok ? mf.valeur + '_' : ''}${num}.xml`;
  }

  return { VERSION, MF_TEIF, compacterMF, lireMatricule, lireIdentifiantClient, deviseIso, dateTeif, montantTeif, uniteTeif,
    controleTeif, teifXml, nomFichierTeif, echapper };
});
