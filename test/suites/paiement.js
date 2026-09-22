'use strict';
// ============================================================================================
// Le paiement en ligne (10.9.0)
//
// Le premier endroit du projet où de l'argent change de mains sans que personne ne regarde. Deux
// dangers, et ils n'ont rien à voir l'un avec l'autre :
//
//   1. Le navigateur ment. Tout ce qu'il envoie est une DEMANDE, jamais une décision : il dit quelle
//      offre il veut, il ne dit jamais ce qu'elle coûte. Le prix vient des réglages de la console.
//   2. Le webhook n'est pas signé. N'importe qui peut l'appeler avec n'importe quelle référence.
//      Il ne vaut donc que comme notification ; la PREUVE, c'est la question qu'on repose au
//      prestataire avec notre clé, et le verdict qu'on rend sur SA réponse.
//
// Ce que ces tests tiennent : qu'un prix envoyé par la page ne serve à rien, qu'un paiement
// incomplet, d'un autre montant ou d'une autre commande ne livre aucune clé, qu'un webhook livré
// deux fois n'émette qu'une licence, que la page de retour finisse le travail quand le webhook
// n'arrive pas, que la clé ne sorte jamais par une route publique, et que le timbre fiscal soit
// encaissé — sans lui, chaque facture en ligne resterait due d'un dinar, pour toujours.
//
// La suite est ASYNCHRONE et chacun de ses `ta` est attendu (8.4.0).
module.exports = async ({ ta, assert }) => {
  const lic = require('../../src/licence.js');
  const API = () => import('../../plateforme/skanfact-api.mjs');

  // ------------------------------------------------------------------ les décisions, sans réseau

  await ta('10.9.0 : ce que le site envoie décrit un acheteur, jamais un montant', async () => {
    const P = await API();
    const bon = P.nettoyerCommande({ offre: 'entreprise', nom: 'Atelier Ben Salah', email: 'Contact@Atelier.TN  ', matricule: ' 1234567a ', tel: '20 000 000',
      // Ce qui suit est envoyé par la page et ne doit RIEN décider.
      prix: 1, montant: 1, remise: 99, duree: 'vie', type: 'cabinet', dossiersHors: 500 });
    assert.strictEqual(bon.ok, true, bon.erreur);
    assert.deepStrictEqual(Object.keys(bon.c).sort(), ['adresse', 'cabinet', 'contact', 'email', 'matricule', 'nom', 'offre', 'tel'],
      'un champ de plus ici, et c\'est le navigateur qui décide de quelque chose');
    assert.strictEqual(bon.c.email, 'contact@atelier.tn');
    assert.strictEqual(bon.c.matricule, '1234567A');

    assert.strictEqual(P.nettoyerCommande({ offre: 'cabinet', nom: 'X Y', email: 'a@b.tn' }).ok, false,
      'une licence de cabinet ne se vend pas en ligne : son tarif n\'est pas fixé');
    assert.ok(/e-mail/.test(P.nettoyerCommande({ offre: 'entreprise', nom: 'X Y' }).erreur),
      'sans adresse, on vendrait une clé qui n\'arrive nulle part');
    // Une empreinte de parrain annoncée fausse est REFUSÉE, jamais ignorée : quelqu'un qui tape le
    // code de son comptable attend une remise, et le silence est la pire façon de la lui refuser.
    assert.strictEqual(P.nettoyerCommande({ offre: 'entreprise', nom: 'X Y', email: 'a@b.tn', cabinet: 'pas-une-empreinte' }).ok, false);
    assert.strictEqual(P.nettoyerCommande({ offre: 'entreprise', nom: 'X Y', email: 'a@b.tn', cabinet: '3F9A-2C1E-0000-1111-2222' }).c.cabinet,
      '3f9a2c1e000011112222', 'l\'empreinte se range nue, comme partout depuis la 9.4.1');
  });

  // Le défaut réel de la 10.9.0 : le site envoie `raison` (la société) ET `nom` (la personne qui
  // suit le dossier), et le worker ne gardait que `nom`. SkanFact établissait donc une facture —
  // une pièce légale — au nom d'un salarié, sans adresse, sous le matricule de sa société.
  await ta('10.9.1 : ce qui va sur la facture est la SOCIÉTÉ, jamais la personne qui a commandé', async () => {
    const P = await API();
    const r = P.nettoyerCommande({
      offre: 'entreprise', raison: 'Atelier Ben Salah SARL', nom: 'Mohamed Ben Salah',
      adresse: '12 rue de Carthage, 1002 Tunis', email: 'a@b.tn', matricule: '1234567A'
    });
    assert.strictEqual(r.ok, true, r.erreur);
    assert.strictEqual(r.c.nom, 'Atelier Ben Salah SARL', 'c\'est la raison sociale qui nomme le client');
    assert.strictEqual(r.c.contact, 'Mohamed Ben Salah', 'la personne reste, à part : on l\'appelle, on ne la facture pas');
    assert.strictEqual(r.c.adresse, '12 rue de Carthage, 1002 Tunis');

    // Sans `raison`, on retombe sur le contrat à six champs : il reste juste pour qui n'a qu'un
    // seul nom à donner. Mais il ne fabrique PAS un contact qui répéterait la société — une case
    // « contact » qui redit le nom du client n'apprend rien à personne.
    const seul = P.nettoyerCommande({ offre: 'entreprise', nom: 'Atelier Ben Salah SARL', email: 'a@b.tn' });
    assert.strictEqual(seul.c.nom, 'Atelier Ben Salah SARL');
    assert.strictEqual(seul.c.contact, '', 'un contact identique à la société est du bruit, pas une information');

    // Une adresse tapée de travers est refusée en DISANT pourquoi : elle figure sur la facture.
    const court = P.nettoyerCommande({ offre: 'entreprise', raison: 'X Y', nom: 'Z', adresse: 'abc', email: 'a@b.tn' });
    assert.strictEqual(court.ok, false);
    assert.ok(/facture/.test(court.erreur), 'le refus dit à quoi sert le champ');
  });

  await ta('10.9.0 : ce qu\'on encaisse est exactement ce que la facture dira — timbre compris', async () => {
    const P = await API();
    // 690 HT, 19 % de TVA, 1 DT de timbre : 690 + 131,1 + 1 = 822,1.
    const m = P.montantCommande({ prixHT: 690, remise: 0, tvaTaux: 19, timbre: 1 });
    assert.strictEqual(m.montantHT, 690); assert.strictEqual(m.tva, 131.1); assert.strictEqual(m.ttc, 822.1);
    // Le timbre vient APRÈS la TVA : c'est un droit fixe par facture, pas une base imposable.
    // S'il entrait dans l'assiette, la TVA vaudrait 131,29 et le total 822,29.
    assert.notStrictEqual(m.ttc, 822.29);
    // Avec la remise de parrainage : 690 × 0,8 = 552 HT.
    const r = P.montantCommande({ prixHT: 690, remise: 20, tvaTaux: 19, timbre: 1 });
    assert.strictEqual(r.montantHT, 552); assert.strictEqual(r.tva, 104.88); assert.strictEqual(r.ttc, 657.88);
    // Le prestataire compte en millimes, en ENTIER. 657.88 × 1000 vaut 657879.9999999999 en
    // virgule flottante : sans l'arrondi, le paiement partirait à un millième de millime près et
    // le contrôle de montant refuserait la vente.
    assert.strictEqual(P.millimes(657.88), 657880);
    assert.strictEqual(P.millimes(301.29), 301290);
  });

  await ta('10.9.0 : un paiement ne vaut que « completed », pour CETTE commande, au BON montant', async () => {
    const P = await API();
    const cmd = { id: 'cmd_abc', montant_ttc: 822.1 };
    const bon = { status: 'completed', orderId: 'cmd_abc', amount: 822100 };
    assert.strictEqual(P.verdictPaiement({ paiement: bon, commande: cmd }).ok, true);
    // En attente : ce n'est pas un incident, c'est l'état normal d'une commande qu'on vient d'ouvrir.
    assert.strictEqual(P.verdictPaiement({ paiement: { ...bon, status: 'pending' }, commande: cmd }).etat, 'pending');
    // La preuve du paiement d'une AUTRE commande ne vaut rien ici : sans ce contrôle, on présenterait
    // le règlement d'une licence à 390 pour se faire livrer celle à 690.
    assert.strictEqual(P.verdictPaiement({ paiement: { ...bon, orderId: 'cmd_autre' }, commande: cmd }).etat, 'autre');
    // Un paiement partiel n'est pas un paiement.
    assert.strictEqual(P.verdictPaiement({ paiement: { ...bon, amount: 100000 }, commande: cmd }).etat, 'montant');
    // Rien du tout : le doute ne livre jamais.
    assert.strictEqual(P.verdictPaiement({ paiement: null, commande: cmd }).ok, false);
    assert.strictEqual(P.verdictPaiement({}).ok, false);
  });

  await ta('10.9.0 : la page de retour ne rend jamais la clé, et l\'adresse y est masquée', async () => {
    const P = await API();
    const vu = JSON.stringify(P.etatCommandePublic({
      id: 'cmd_1', etat: 'payee', offre: 'entreprise', montant_ttc: 822.1, devise: 'TND',
      email: 'skander@skancyber.tn', cle: 'SKAN1.charge.signature', licence_id: 'abcd1234'
    }));
    assert.ok(!/SKAN1/.test(vu), 'la clé part par mail : une référence de commande voyage dans une adresse, qui se partage');
    assert.ok(!/skander@skancyber\.tn/.test(vu), 'l\'adresse entière n\'a pas à s\'apprendre à qui a récupéré le lien');
    assert.ok(/^s\*+r$/.test(JSON.parse(vu).phrase.match(/à (\S+)@skancyber/)[1]), 'assez pour qu\'on reconnaisse SON adresse : ' + vu);
    assert.ok(!/abcd1234/.test(vu), 'l\'identifiant de la licence n\'a rien à faire sur une page publique');
    // Payé et pas livré : on le DIT. Le client a donné son argent, il a le droit de savoir que
    // quelque chose cloche — et de savoir que nous le savons.
    const coince = P.etatCommandePublic({ etat: 'ouverte', paiement_le: '2026-09-22T10:00:00Z', email: 'a@b.tn' });
    assert.strictEqual(coince.etat, 'en_cours');
    assert.ok(/prévenus/.test(coince.phrase), coince.phrase);
  });

  await ta('10.9.0 : l\'adresse de retour porte la commande et d\'où l\'on revient', async () => {
    const P = await API();
    const u = new URL(P.retourAchat('https://skanfact.tn/merci', 'cmd_9', true));
    assert.strictEqual(u.searchParams.get('commande'), 'cmd_9');
    assert.strictEqual(u.searchParams.get('r'), 'ok');
    assert.strictEqual(new URL(P.retourAchat('https://skanfact.tn/merci', 'cmd_9', false)).searchParams.get('r'), 'echec');
    // Une page qui ne sait pas d'où l'on revient afficherait « merci » à quelqu'un qui vient
    // d'annuler. Et une adresse qui ne s'analyse pas n'est pas une adresse (6.7.2).
    assert.strictEqual(P.retourAchat('pas une adresse', 'cmd_9', true), '');
    assert.strictEqual(P.retourAchat('', 'cmd_9', true), '');
  });

  await ta('10.9.0 : un écran neuf porte son icône et son état vide — trois tables séparées divergent', async () => {
    const fs = require('fs'); const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'plateforme', 'skanfact-api.mjs'), 'utf8');
    const bloc = (nom) => {
      const i = src.indexOf('var ' + nom + ' = {');
      assert.ok(i > 0, nom + ' introuvable dans la page');
      return src.slice(i, src.indexOf('\n  };', i));
    };
    // Les clés d'un objet littéral de la page, lues à plat : `alertes: {` ou `alertes: '…'`.
    const cles = (nom) => [...bloc(nom).matchAll(/^\s{4}([a-z]+):/gm)].map(m => m[1]).sort();
    const ecrans = cles('ECRANS');
    assert.ok(ecrans.includes('commandes'), 'l\'écran des commandes doit exister : ' + ecrans.join(', '));
    // Le défaut que le parcours réel a attrapé et qu'aucun test pur ne voyait : un écran ajouté à
    // ECRANS sans son entrée dans ICONES sort un `<path d="undefined">`. Rien ne plante, rien
    // n'apparaît, et le rail perd simplement un dessin. C'est « deux tables séparées divergent,
    // toujours » (6.8.0) — et c'est le genre de trou qui se rouvre au prochain écran.
    assert.deepStrictEqual(cles('ICONES'), ecrans, 'chaque écran du rail doit porter son icône');
    // Et son état vide : un tableau nu n'apprend rien (7.0.0).
    assert.deepStrictEqual(cles('VIDES'), ecrans, 'chaque écran doit dire quoi faire quand il est vide');
  });

  // ------------------------------------------------- la vente entière, vrai worker et vraie base

  // Konnect n'est pas joignable d'ici, et ce n'est pas ce qu'on veut tester : ce qui compte est ce
  // que le worker FAIT de ses réponses. Le faux prestataire rend donc exactement ce que l'API rend,
  // et compte ses appels — c'est ce compte qui prouve qu'on repose bien la question.
  const fauxKonnect = (etat) => {
    const appels = { init: 0, lecture: 0 };
    const etatCourant = { valeur: etat || 'pending', montant: null, orderId: null };
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = async (url, o) => {
      const u = String(url);
      if (u.includes('/payments/init-payment')) {
        appels.init++;
        const corps = JSON.parse(o.body);
        etatCourant.montant = corps.amount;
        etatCourant.orderId = corps.orderId;
        appels.dernierInit = corps;
        return new Response(JSON.stringify({ payUrl: 'https://pay.example/abc', paymentRef: 'ref_' + corps.orderId }), { status: 200 });
      }
      if (/\/payments\/ref_/.test(u)) {
        appels.lecture++;
        return new Response(JSON.stringify({ payment: {
          status: etatCourant.valeur, amount: etatCourant.montant, orderId: etatCourant.orderId
        } }), { status: 200 });
      }
      // Le mail de Resend.
      appels.mail = (appels.mail || 0) + 1;
      appels.dernierMail = JSON.parse(o.body);
      return new Response(JSON.stringify({ id: 'm_1' }), { status: 200 });
    };
    return { appels, etatCourant, fin: () => { globalThis.fetch = vraiFetch; } };
  };

  await ta('10.9.0 : le prix vient des réglages, jamais du navigateur — et la clé part quand le paiement est PROUVÉ', async () => {
    const P = await API();
    const { baseD1 } = require('../d1-sqlite');
    const srv = lic.generateKeys();
    const db = baseD1();
    const env = {
      DB: db, ADMIN_SECRET: 'A'.repeat(30), SRV_PRIVATE_KEY: srv.privateKey, RESEND_API_KEY: 're_test',
      KONNECT_API_KEY: 'k_test', LICENCE_PUBLIC_KEYS: JSON.stringify([{ kid: 'srv-1', publicKey: srv.publicKey }])
    };
    const k = fauxKonnect('pending');
    const appeler = async (m, p, corps, entetes) => {
      const r = await P.default.fetch(new Request('https://api.skanfact.tn' + p, {
        method: m, headers: entetes || {}, body: corps ? JSON.stringify(corps) : undefined
      }), env);
      return { status: r.status, j: await r.json().catch(() => null), entetes: r.headers };
    };
    try {
      // Les réglages : le portefeuille et l'adresse de retour. Sans eux, l'achat est FERMÉ et le
      // site l'annonce — il n'échoue pas en silence au moment où quelqu'un voulait payer.
      const ferme = await appeler('GET', '/v1/achat/tarifs');
      assert.strictEqual(ferme.j.ouvert, false);
      assert.ok(/portefeuille/.test(ferme.j.raison), ferme.j.raison);
      assert.strictEqual((await appeler('POST', '/v1/achat/commander', { offre: 'entreprise', nom: 'Atelier', email: 'a@b.tn' })).status, 503);

      await appeler('POST', '/v1/admin/reglages', { valeurs: { konnect_wallet: 'w_123', achat_retour: 'https://skanfact.tn/merci' } },
        { 'x-skanfact-admin': 'A'.repeat(30) });

      // Les tarifs : ce que le SITE affiche vient d'ici, plus de son propre HTML.
      const tarifs = await appeler('GET', '/v1/achat/tarifs');
      assert.strictEqual(tarifs.j.ouvert, true, tarifs.j.raison);
      const ent = tarifs.j.offres.find(o => o.id === 'entreprise');
      assert.strictEqual(ent.ht, 690); assert.strictEqual(ent.ttc, 822.1);
      assert.ok(!tarifs.j.offres.some(o => o.id === 'cabinet'), 'le cabinet ne se vend pas en ligne');

      // La commande. La page envoie un prix ridicule : il ne sert à rien.
      const c = await appeler('POST', '/v1/achat/commander',
        { offre: 'entreprise', raison: 'Atelier Ben Salah SARL', nom: 'Mohamed Ben Salah',
          adresse: '12 rue de Carthage, 1002 Tunis', tel: '20 000 000',
          email: 'atelier@exemple.tn', matricule: '1234567A', prix: 1, remise: 90 });
      assert.strictEqual(c.status, 201, JSON.stringify(c.j));
      assert.strictEqual(c.j.montant, 822.1, 'le prix envoyé par la page ne doit rien changer');
      assert.strictEqual(c.j.payUrl, 'https://pay.example/abc');
      assert.strictEqual(k.appels.dernierInit.amount, 822100, 'le prestataire est chargé en millimes');
      assert.strictEqual(k.appels.dernierInit.orderId, c.j.commande);
      assert.ok(String(k.appels.dernierInit.webhook).endsWith('/v1/achat/webhook'));
      assert.ok(String(k.appels.dernierInit.successUrl).includes('commande=' + c.j.commande));

      // Tant que le paiement n'est pas encaissé, rien ne se livre — et on ne CRIE pas : une
      // commande qui attend son paiement est l'état normal, pas un incident.
      const attente = await appeler('GET', '/v1/achat/etat/' + c.j.commande);
      assert.strictEqual(attente.j.etat, 'ouverte');
      assert.strictEqual((await appeler('GET', '/v1/admin/licences', null, { 'x-skanfact-admin': 'A'.repeat(30) })).j.lignes.length, 0,
        'aucune licence tant que rien n\'est payé');

      // Un webhook avec une référence inventée ne désigne rien — et répond quand même 200, pour ne
      // pas apprendre à un curieux quelles références existent.
      const bidon = await appeler('POST', '/v1/achat/webhook?payment_ref=ref_inventee');
      assert.strictEqual(bidon.status, 200);
      assert.strictEqual((await appeler('GET', '/v1/admin/licences', null, { 'x-skanfact-admin': 'A'.repeat(30) })).j.lignes.length, 0);

      // Le paiement passe. Le webhook n'est qu'une notification : c'est la question reposée au
      // prestataire qui fait foi, et le compte des lectures le prouve.
      const avant = k.appels.lecture;
      k.etatCourant.valeur = 'completed';
      const w = await appeler('POST', '/v1/achat/webhook?payment_ref=ref_' + c.j.commande);
      assert.strictEqual(w.status, 200);
      assert.ok(k.appels.lecture > avant, 'le webhook doit REDEMANDER au prestataire, jamais le croire');

      const licences = (await appeler('GET', '/v1/admin/licences', null, { 'x-skanfact-admin': 'A'.repeat(30) })).j.lignes;
      assert.strictEqual(licences.length, 1, 'une licence, et une seule');
      assert.strictEqual(licences[0].offre, 'entreprise');
      assert.strictEqual(Number(licences[0].prix), 690);
      assert.ok(licences[0].envoyee_le, 'la clé part par mail dans la seconde (§ 12)');
      assert.ok(k.appels.dernierMail.text.includes('SKAN1.'), 'le mail porte la clé');
      assert.strictEqual(k.appels.dernierMail.to[0], 'atelier@exemple.tn');

      // La vente est là, payée, et elle attend sa facture : c'est le pont comptable qui la tirera.
      const ventes = (await appeler('GET', '/v1/admin/ventes?non_facturees=1', null, { 'x-skanfact-admin': 'A'.repeat(30) })).j.lignes;
      assert.strictEqual(ventes.length, 1);
      assert.strictEqual(Number(ventes[0].montant_ht), 690);
      assert.ok(ventes[0].payee_le, 'une vente en ligne est payée par construction');
      // 10.9.1 — la vente porte tout ce qu'une facture tunisienne réclame. Sans ça, SkanFact
      // ouvrait une fiche client vide et il fallait la ressaisir, dans un pont fait pour ne rien
      // ressaisir. Et le NOM du client est la société, jamais la personne qui a commandé.
      assert.strictEqual(ventes[0].client, 'Atelier Ben Salah SARL', 'une facture se libelle à la société');
      assert.strictEqual(ventes[0].adresse, '12 rue de Carthage, 1002 Tunis');
      assert.strictEqual(ventes[0].contact, 'Mohamed Ben Salah');
      assert.strictEqual(ventes[0].tel, '20 000 000');

      // Le client n'existait pas avant le paiement : une commande abandonnée ne laisse aucune fiche.
      const clients = (await appeler('GET', '/v1/admin/clients', null, { 'x-skanfact-admin': 'A'.repeat(30) })).j.lignes;
      assert.strictEqual(clients.length, 1);
      assert.strictEqual(clients[0].email, 'atelier@exemple.tn');
      assert.strictEqual(clients[0].nom, 'Atelier Ben Salah SARL');
      assert.strictEqual(clients[0].adresse, '12 rue de Carthage, 1002 Tunis');

      // IDEMPOTENCE : un webhook se livre deux fois, une page de retour s'actualise. Ni l'un ni
      // l'autre ne doit émettre une seconde licence ni facturer une seconde fois.
      await appeler('POST', '/v1/achat/webhook?payment_ref=ref_' + c.j.commande);
      await appeler('GET', '/v1/achat/etat/' + c.j.commande);
      await appeler('GET', '/v1/achat/etat/' + c.j.commande);
      assert.strictEqual((await appeler('GET', '/v1/admin/licences', null, { 'x-skanfact-admin': 'A'.repeat(30) })).j.lignes.length, 1,
        'deux livraisons du même webhook ne font pas deux licences');
      assert.strictEqual((await appeler('GET', '/v1/admin/ventes?non_facturees=1', null, { 'x-skanfact-admin': 'A'.repeat(30) })).j.lignes.length, 1);

      const fini = await appeler('GET', '/v1/achat/etat/' + c.j.commande);
      assert.strictEqual(fini.j.etat, 'payee');
      assert.ok(/a\*+r@exemple\.tn/.test(fini.j.phrase), fini.j.phrase);

      // 10.9.1 — un client qui REVIENT. Sa fiche lui appartient : l'éditeur a pu la corriger à la
      // main, et une deuxième commande ne la réécrit pas. Elle ne COMBLE que ce qui est vide.
      const c2 = await appeler('POST', '/v1/achat/commander',
        { offre: 'independant', raison: 'RAISON RETAPÉE DE TRAVERS', nom: 'Quelqu\'un d\'autre',
          adresse: 'une autre adresse entierement', email: 'atelier@exemple.tn' });
      assert.strictEqual(c2.status, 201, JSON.stringify(c2.j));
      await appeler('POST', '/v1/achat/webhook?payment_ref=ref_' + c2.j.commande);
      // Sans cette ligne, l'assertion qui suit passerait pour une mauvaise raison : une seconde
      // vente qui échoue laisse évidemment la fiche intacte, et ne prouve rien du garde-fou.
      assert.strictEqual((await appeler('GET', '/v1/admin/licences', null, { 'x-skanfact-admin': 'A'.repeat(30) })).j.lignes.length, 2,
        'la seconde vente doit VRAIMENT aboutir, sinon on ne teste rien');
      const apres = (await appeler('GET', '/v1/admin/clients', null, { 'x-skanfact-admin': 'A'.repeat(30) })).j.lignes;
      assert.strictEqual(apres.length, 1, 'un client qui revient ne fabrique pas une seconde fiche');
      assert.strictEqual(apres[0].nom, 'Atelier Ben Salah SARL', 'une fiche existante ne se fait pas réécrire par une commande');
      assert.strictEqual(apres[0].adresse, '12 rue de Carthage, 1002 Tunis');
    } finally { k.fin(); db.fermer(); }
  });

  await ta('10.9.0 : quand le webhook n\'arrive jamais, c\'est la page du client qui finit le travail', async () => {
    const P = await API();
    const { baseD1 } = require('../d1-sqlite');
    const srv = lic.generateKeys();
    const db = baseD1();
    const env = {
      DB: db, ADMIN_SECRET: 'B'.repeat(30), SRV_PRIVATE_KEY: srv.privateKey, RESEND_API_KEY: 're_test',
      KONNECT_API_KEY: 'k_test', LICENCE_PUBLIC_KEYS: JSON.stringify([{ kid: 'srv-1', publicKey: srv.publicKey }])
    };
    const k = fauxKonnect('pending');
    const appeler = async (m, p, corps, entetes) => {
      const r = await P.default.fetch(new Request('https://api.skanfact.tn' + p, {
        method: m, headers: entetes || {}, body: corps ? JSON.stringify(corps) : undefined
      }), env);
      return { status: r.status, j: await r.json().catch(() => null) };
    };
    try {
      await appeler('POST', '/v1/admin/reglages', { valeurs: { konnect_wallet: 'w_1', achat_retour: 'https://skanfact.tn/merci' } }, { 'x-skanfact-admin': 'B'.repeat(30) });
      const c = await appeler('POST', '/v1/achat/commander', { offre: 'independant', nom: 'Sonia Khelifi', email: 'sonia@exemple.tn' });
      assert.strictEqual(c.status, 201, JSON.stringify(c.j));
      // 390 HT + 19 % + 1 DT de timbre.
      assert.strictEqual(c.j.montant, 465.1);

      // Le paiement passe ; le prestataire ne nous prévient pas (panne, déploiement en cours…).
      k.etatCourant.valeur = 'completed';
      const vu = await appeler('GET', '/v1/achat/etat/' + c.j.commande);
      assert.strictEqual(vu.j.etat, 'payee', 'un chemin de secours ne sert que s\'il se déclenche tout seul (6.7.2)');
      assert.strictEqual((await appeler('GET', '/v1/admin/licences', null, { 'x-skanfact-admin': 'B'.repeat(30) })).j.lignes.length, 1);
    } finally { k.fin(); db.fermer(); }
  });

  await ta('10.9.0 : la remise de parrainage ne se pose que sur un cabinet que la base CONNAÎT', async () => {
    const P = await API();
    const { baseD1 } = require('../d1-sqlite');
    const srv = lic.generateKeys();
    const db = baseD1();
    const ADMIN = 'C'.repeat(30);
    const env = {
      DB: db, ADMIN_SECRET: ADMIN, SRV_PRIVATE_KEY: srv.privateKey, RESEND_API_KEY: 're_test',
      KONNECT_API_KEY: 'k_test', LICENCE_PUBLIC_KEYS: JSON.stringify([{ kid: 'srv-1', publicKey: srv.publicKey }])
    };
    const k = fauxKonnect('pending');
    const appeler = async (m, p, corps, entetes) => {
      const r = await P.default.fetch(new Request('https://api.skanfact.tn' + p, {
        method: m, headers: entetes || {}, body: corps ? JSON.stringify(corps) : undefined
      }), env);
      return { status: r.status, j: await r.json().catch(() => null) };
    };
    const adm = { 'x-skanfact-admin': ADMIN };
    try {
      await appeler('POST', '/v1/admin/reglages', { valeurs: { konnect_wallet: 'w_1', achat_retour: 'https://skanfact.tn/merci' } }, adm);

      // Vingt caractères hexadécimaux se tapent au hasard : sans ce contrôle, n'importe qui s'offre
      // 20 % de remise en inventant le code d'un comptable.
      const inventee = await appeler('POST', '/v1/achat/commander',
        { offre: 'entreprise', nom: 'Malin', email: 'malin@exemple.tn', cabinet: '00000000000000000000' });
      assert.strictEqual(inventee.j.parraine, false);
      assert.strictEqual(inventee.j.montant, 822.1, 'aucune remise sur un parrain que la base ne connaît pas');

      // Le vrai cabinet, vendu par la console. Sa licence porte son empreinte comme SUJET.
      const cab = await appeler('POST', '/v1/admin/clients', { nom: 'Cabinet Ben Salah', email: 'cab@exemple.tn' }, adm);
      const lc = await appeler('POST', '/v1/admin/licences',
        { clientId: cab.j.client.id, type: 'cabinet', duree: '1a', prix: 0, dossiersHors: 10, cabinet: '3f9a-2c1e-0000-1111-2222' }, adm);
      assert.strictEqual(lc.status, 201, JSON.stringify(lc.j));

      const parraine = await appeler('POST', '/v1/achat/commander',
        { offre: 'entreprise', nom: 'Client du cabinet', email: 'client@exemple.tn', cabinet: '3F9A-2C1E-0000-1111-2222' }, adm);
      assert.strictEqual(parraine.j.parraine, true);
      assert.strictEqual(parraine.j.montant, 657.88, '690 − 20 %, plus TVA et timbre');

      // Et le parrainage voyage jusque DANS la clé signée, sous sa forme canonique (9.4.1) : c'est
      // lui qui prouvera, un jour, que ce cabinet amène du monde.
      k.etatCourant.valeur = 'completed';
      await appeler('POST', '/v1/achat/webhook?payment_ref=ref_' + parraine.j.commande);
      const lignes = (await appeler('GET', '/v1/admin/licences', null, adm)).j.lignes;
      const vendue = lignes.find(x => x.client === 'Client du cabinet');
      assert.ok(vendue, JSON.stringify(lignes.map(x => x.client)));
      assert.strictEqual(vendue.cabinet_empreinte, '3f9a2c1e000011112222');
      assert.strictEqual(Number(vendue.remise), 20);
      assert.strictEqual(Number(vendue.prix), 690, 'le prix reste le tarif ; c\'est la remise qui dit ce qui a été payé');
    } finally { k.fin(); db.fermer(); }
  });

  await ta('10.9.0 : un paiement d\'une autre commande, ou d\'un autre montant, ne livre aucune clé', async () => {
    const P = await API();
    const { baseD1 } = require('../d1-sqlite');
    const srv = lic.generateKeys();
    const db = baseD1();
    const ADMIN = 'D'.repeat(30);
    const env = {
      DB: db, ADMIN_SECRET: ADMIN, SRV_PRIVATE_KEY: srv.privateKey, RESEND_API_KEY: 're_test',
      KONNECT_API_KEY: 'k_test', LICENCE_PUBLIC_KEYS: JSON.stringify([{ kid: 'srv-1', publicKey: srv.publicKey }])
    };
    const k = fauxKonnect('completed');
    const appeler = async (m, p, corps, entetes) => {
      const r = await P.default.fetch(new Request('https://api.skanfact.tn' + p, {
        method: m, headers: entetes || {}, body: corps ? JSON.stringify(corps) : undefined
      }), env);
      return { status: r.status, j: await r.json().catch(() => null) };
    };
    const adm = { 'x-skanfact-admin': ADMIN };
    try {
      await appeler('POST', '/v1/admin/reglages', { valeurs: { konnect_wallet: 'w_1', achat_retour: 'https://skanfact.tn/merci' } }, adm);
      const c = await appeler('POST', '/v1/achat/commander', { offre: 'entreprise', nom: 'Atelier', email: 'a@exemple.tn' });

      // Le prestataire confirme un paiement… de 100 millimes. C'est exactement ce qu'un montant
      // bricolé côté navigateur produirait si on l'avait écouté.
      k.etatCourant.montant = 100;
      await appeler('POST', '/v1/achat/webhook?payment_ref=ref_' + c.j.commande);
      assert.strictEqual((await appeler('GET', '/v1/admin/licences', null, adm)).j.lignes.length, 0, 'un paiement partiel n\'est pas un paiement');

      // Et le refus se LIT : la console doit pouvoir dire pourquoi un client qui a payé n'a rien.
      const cmds = (await appeler('GET', '/v1/admin/commandes', null, adm)).j.lignes;
      assert.strictEqual(cmds.length, 1);
      assert.ok(/montant/i.test(cmds[0].echec || ''), cmds[0].echec);

      // Le bon montant : la même commande se livre.
      k.etatCourant.montant = P.millimes(c.j.montant);
      await appeler('POST', '/v1/achat/webhook?payment_ref=ref_' + c.j.commande);
      assert.strictEqual((await appeler('GET', '/v1/admin/licences', null, adm)).j.lignes.length, 1);
      const apres = (await appeler('GET', '/v1/admin/commandes', null, adm)).j.lignes[0];
      assert.strictEqual(apres.etat, 'payee');
      assert.strictEqual(apres.echec, null, 'un échec réparé ne reste pas affiché');
    } finally { k.fin(); db.fermer(); }
  });

  await ta('10.9.0 : un paiement encaissé dont la clé n\'est pas partie CRIE, et le geste qui le répare existe', async () => {
    const P = await API();
    const { baseD1 } = require('../d1-sqlite');
    const db = baseD1();
    const ADMIN = 'F'.repeat(30);
    // Sans clé de serveur, l'émission est impossible : c'est exactement la panne qu'on veut voir —
    // le prestataire a encaissé, et la clé ne peut pas être signée.
    const env = { DB: db, ADMIN_SECRET: ADMIN, KONNECT_API_KEY: 'k_test' };
    const k = fauxKonnect('completed');
    const appeler = async (m, p, corps, entetes) => {
      const r = await P.default.fetch(new Request('https://api.skanfact.tn' + p, {
        method: m, headers: entetes || {}, body: corps ? JSON.stringify(corps) : undefined
      }), env);
      return { status: r.status, j: await r.json().catch(() => null) };
    };
    const adm = { 'x-skanfact-admin': ADMIN };
    try {
      await appeler('POST', '/v1/admin/reglages', { valeurs: { konnect_wallet: 'w_1', achat_retour: 'https://skanfact.tn/merci' } }, adm);
      const c = await appeler('POST', '/v1/achat/commander', { offre: 'entreprise', nom: 'Atelier', email: 'a@exemple.tn' });
      k.etatCourant.montant = P.millimes(c.j.montant);
      await appeler('POST', '/v1/achat/webhook?payment_ref=ref_' + c.j.commande);

      const cmd = (await appeler('GET', '/v1/admin/commandes', null, adm)).j.lignes[0];
      assert.ok(cmd.paiement_le, 'le paiement est confirmé…');
      assert.strictEqual(cmd.etat, 'ouverte', '…et la clé n\'est pas partie');
      assert.ok(/mission impossible/.test(cmd.echec || ''), cmd.echec);

      // C'est la SEULE façon d'apprendre qu'un client a payé pour rien : la commande n'est pas une
      // vente, la licence n'existe pas, et la page du site ne peut que dire « on est prévenus ».
      const alertes = (await appeler('GET', '/v1/admin/alertes', null, adm)).j.lignes;
      const a = alertes.find(x => /clé non partie/i.test(x.quoi));
      assert.ok(a, JSON.stringify(alertes.map(x => x.quoi)));
      assert.strictEqual(a.niveau, 'alerte');
      assert.strictEqual(a.onglet, 'commandes', 'une alerte nomme l\'écran qui la règle (7.15.0)');

      // Et ce qui NE se fait pas : abandonner une commande payée. Ce serait garder l'argent en
      // fermant la porte — la ligne rouge doit rester rouge jusqu'à la livraison ou au remboursement.
      const refus = await appeler('POST', '/v1/admin/commandes/' + c.j.commande + '/abandonner', {}, adm);
      assert.strictEqual(refus.status, 409);
      assert.ok(/PAYÉE/.test(refus.j.erreur), refus.j.erreur);
    } finally { k.fin(); db.fermer(); }
  });

  await ta('10.9.0 : « Redemander au prestataire » est le TROISIÈME chemin vers la même livraison', async () => {
    const P = await API();
    const { baseD1 } = require('../d1-sqlite');
    const srv = lic.generateKeys();
    const db = baseD1();
    const ADMIN = 'G'.repeat(30);
    const env = { DB: db, ADMIN_SECRET: ADMIN, SRV_PRIVATE_KEY: srv.privateKey, RESEND_API_KEY: 're_test',
      KONNECT_API_KEY: 'k_test', LICENCE_PUBLIC_KEYS: JSON.stringify([{ kid: 'srv-1', publicKey: srv.publicKey }]) };
    const k = fauxKonnect('pending');
    const appeler = async (m, p, corps, entetes) => {
      const r = await P.default.fetch(new Request('https://api.skanfact.tn' + p, {
        method: m, headers: entetes || {}, body: corps ? JSON.stringify(corps) : undefined
      }), env);
      return { status: r.status, j: await r.json().catch(() => null) };
    };
    const adm = { 'x-skanfact-admin': ADMIN };
    try {
      await appeler('POST', '/v1/admin/reglages', { valeurs: { konnect_wallet: 'w_1', achat_retour: 'https://skanfact.tn/merci' } }, adm);
      const c = await appeler('POST', '/v1/achat/commander', { offre: 'independant', nom: 'Sonia', email: 'sonia@exemple.tn' });

      // Ni webhook ni visite du client : c'est l'éditeur qui redemande depuis sa console.
      const rien = await appeler('POST', '/v1/admin/commandes/' + c.j.commande + '/verifier', {}, adm);
      assert.strictEqual(rien.j.livree, false);
      assert.ok(/pas encaiss/.test(rien.j.raison), rien.j.raison);

      k.etatCourant.valeur = 'completed';
      const fait = await appeler('POST', '/v1/admin/commandes/' + c.j.commande + '/verifier', {}, adm);
      assert.strictEqual(fait.j.livree, true, JSON.stringify(fait.j));
      assert.strictEqual(fait.j.mail.envoye, true);
      assert.strictEqual((await appeler('GET', '/v1/admin/licences', null, adm)).j.lignes.length, 1);
      // Et un panier qu'on abandonne cesse d'être livrable, même si le prestataire dit « payé ».
      const c2 = await appeler('POST', '/v1/achat/commander', { offre: 'independant', nom: 'Autre', email: 'autre@exemple.tn' });
      assert.strictEqual((await appeler('POST', '/v1/admin/commandes/' + c2.j.commande + '/abandonner', {}, adm)).status, 200);
      k.etatCourant.montant = P.millimes(c2.j.montant);
      await appeler('POST', '/v1/achat/webhook?payment_ref=ref_' + c2.j.commande);
      assert.strictEqual((await appeler('GET', '/v1/admin/licences', null, adm)).j.lignes.length, 1,
        'une commande abandonnée ne se livre plus');
    } finally { k.fin(); db.fermer(); }
  });

  await ta('10.9.0 : le droit du navigateur s\'arrête aux routes publiques — le webhook n\'en a aucun', async () => {
    const P = await API();
    const { baseD1 } = require('../d1-sqlite');
    const db = baseD1();
    const env = { DB: db, ADMIN_SECRET: 'E'.repeat(30) };
    const ORIGINE = 'https://skanfact.tn';
    const depuis = async (p, m) => {
      const r = await P.default.fetch(new Request('https://api.skanfact.tn' + p, { method: m || 'GET', headers: { Origin: ORIGINE } }), env);
      return r.headers.get('Access-Control-Allow-Origin');
    };
    try {
      assert.strictEqual(await depuis('/v1/achat/tarifs'), ORIGINE, 'le site affiche les tarifs depuis sa propre page');
      assert.strictEqual(await depuis('/v1/achat/commander', 'OPTIONS'), ORIGINE);
      assert.strictEqual(await depuis('/v1/achat/etat/cmd_x'), ORIGINE);
      // Le webhook est appelé de serveur à serveur. L'ouvrir au navigateur donnerait à n'importe
      // quelle page du monde une route qui écrit dans la base.
      assert.strictEqual(await depuis('/v1/achat/webhook', 'POST'), null);
      // Et l'espace d'administration n'est pas un espace public : l'autorisation ne déborde pas.
      assert.strictEqual(await depuis('/v1/admin/clients'), null);
    } finally { db.fermer(); }
  });
};
