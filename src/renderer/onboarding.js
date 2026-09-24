// Assistant de première utilisation : la porte (découvrir sur l'exemple, ou commencer), puis les
// trois questions qui préparent l'entreprise. Il ne s'affiche que si aucune entreprise n'est encore
// renseignée (company.setupDone à false et pas de documents). Il n'impose rien : tout se remodifie
// ensuite dans Paramètres.
//
// Rendu à part de app.js pour que les textes d'accueil se relisent facilement. L'assistant écrit à
// chaque étape (7.2.0) : fermer la fenêtre en route reprend là où l'on s'était arrêté.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.SkanOnboarding = factory(root.SkanCore);
})(typeof self !== 'undefined' ? self : this, function (C) {

  // Un assistant est nécessaire quand rien n'a encore été saisi.
  //
  // `setupStarted` : depuis la 7.2.0 l'assistant écrit à chaque étape. Sans le drapeau, écrire la
  // raison sociale au deuxième écran suffisait à rendre `needsSetup` faux — donc fermer la fenêtre
  // au cinquième écran ne reprenait rien du tout. On ne relance QUE l'assistant réellement
  // interrompu : une installation ancienne sans `setupDone` mais avec une société renseignée ne
  // doit pas se voir soudain proposer un assistant qu'elle n'a jamais commencé.
  function needsSetup(data) {
    if (!data || !data.company) return false;
    if (data.company.setupDone) return false;
    const vierge = !(data.documents || []).length && !(data.clients || []).length;
    if (data.company.setupStarted) return vierge;
    return !data.company.name && vierge;
  }

  // Applique les réponses de l'assistant à un jeu de données (utilisé aussi par les tests).
  // answers : { name, matricule, rc, capital, address, phone, email, activity, currency,
  //             stampFee, quoteValidityDays, paymentTermsDays, defaultWithholdingRate,
  //             bank, rib, fillCatalog, modules }
  // opts    : { done: false, step: n } — écriture intermédiaire entre deux étapes ; sans opts,
  //           l'assistant est déclaré terminé.
  function applySetup(data, answers, opts) {
    const a = answers || {};
    const o = opts || {};
    const co = data.company;
    ['name', 'matricule', 'rc', 'capital', 'address', 'phone', 'email', 'website', 'bank', 'rib', 'activity', 'taxRegime'].forEach(k => {
      if (a[k] != null) co[k] = String(a[k]).trim();
    });
    ['stampFee', 'quoteValidityDays', 'paymentTermsDays', 'defaultWithholdingRate'].forEach(k => {
      if (a[k] !== undefined && a[k] !== '') co[k] = Number(a[k]) || 0;
    });
    if (a.currency) co.currency = a.currency;
    const act = C.ACTIVITIES.find(x => x.id === a.activity);
    if (act && act.tagline && !co.tagline) co.tagline = act.tagline;
    // Le taux de TVA ne se devine plus à partir du MÉTIER (7.22.0) : c'est le RÉGIME FISCAL qui le
    // décide, et il est désormais demandé en clair. Deviner à partir du métier se trompait dans les
    // deux sens — un kinésithérapeute au réel facture de la TVA, un informaticien au forfaitaire
    // n'en facture pas — et l'erreur s'imprimait sur une pièce officielle.
    // `C.defaultVat` applique le régime : non assujetti = 0, quoi qu'il y ait dans les réglages.
    const tauxTva = C.defaultVat(co);
    if (co.defaultVatRate === '' || co.defaultVatRate == null) co.defaultVatRate = tauxTva;
    if (act && a.fillCatalog && !(data.catalog || []).length) {
      // `fromSetup` marque ce que l'assistant a posé. Sans lui, « Remplir ton catalogue » se cochait
      // tout seul dans « Tes premiers pas » : l'étape était réputée faite parce que l'assistant
      // l'avait faite, avec des prix à 0 que personne n'a encore ajustés.
      data.catalog = act.catalog.map(([label, description, unitPrice, unit]) => ({
        id: C.uid(), label, description: description || '', unitPrice, vatRate: tauxTva, unit: unit || 'u',
        fromSetup: true
      }));
    }
    // Les modules que l'utilisateur a demandés. Tout le mécanisme existait depuis la 7.0.0 —
    // MODULES, moduleOn, navPages, la page « Tous les modules », le bandeau de rattrapage — et
    // `modulesSuggeres`, la table qui relie le métier aux modules, n'avait AUCUN appelant. Le menu
    // faisait donc vingt et une lignes au premier jour, pour quelqu'un qui venait de déclarer à
    // l'écran précédent qu'il fait du conseil. Les trois modules `toujours` sont ajoutés d'office :
    // sans eux, un réglage enregistré ne contiendrait pas le cœur du métier.
    if (Array.isArray(a.modules)) {
      const coeur = C.MODULES.filter(m => m.toujours).map(m => m.id);
      const demandes = a.modules.filter(x => C.moduleById(x) && !C.moduleById(x).toujours);
      co.modules = coeur.concat(demandes);
    }
    if (o.done === false) {
      // Reprise après fermeture : on garde la trace de l'étape atteinte sans déclarer terminé.
      co.setupStarted = true;
      if (o.step != null) co.setupStep = Number(o.step) || 0;
    } else {
      co.setupDone = true;
      delete co.setupStarted;
      delete co.setupStep;
    }
    return data;
  }

  // ---------- contenu des écrans ----------
  //
  // 10.14.0 — la PORTE d'abord, le formulaire après la découverte. Skander : « si on tombe sur un
  // formulaire au début, on a tendance à passer et revenir plus tard ». Le premier écran propose deux
  // chemins — découvrir sur l'exemple (recommandé), ou commencer tout de suite — et le formulaire ne
  // garde que les TROIS questions que personne d'autre ne peut répondre à ta place : qui tu es, ton
  // métier, ce dont tu as besoin. Le reste ne se demande plus ici :
  //   — les règles de facturation ont leurs usages tunisiens par défaut (timbre de 1 dinar, trente
  //     jours de validité et de paiement, pas de retenue) et se règlent dans Paramètres → Documents ;
  //   — le RIB se demande avec la fiche société, la première étape des premiers pas, et chaque
  //     émission le réclame tant qu'il manque à qui encaisse par virement ;
  //   — la copie de sécurité est devenue l'étape qui suit le premier devis : posée au premier écran,
  //     elle protégeait un fichier vide, et tout le monde la sautait.
  // `quoi` : ce que la porte annonce de chaque question (« ton entreprise, ton métier… »). Une
  // question ajoutée ici se compte et se nomme toute seule sur la porte.
  const STEPS = [
    {
      id: 'bienvenue', porte: true, title: 'Bienvenue dans SkanFact', sub: 'Tes devis, tes factures et ta gestion, en main dès aujourd\'hui',
      intro: `<p>Tes documents, tes clients et tes chiffres restent <b>sur cet ordinateur</b> : aucun ne part sur Internet, et personne d'autre n'y a accès. SkanFact ne s'y connecte que pour chercher ses mises à jour et vérifier ta licence. C'est toi qui gardes tes sauvegardes : je te proposerai une copie automatique juste après ton premier devis.</p>`
    },
    { id: 'entreprise', title: 'Ton entreprise', sub: 'Ce qui s\'imprimera en haut de chaque document', quoi: 'ton entreprise' },
    { id: 'activite', title: 'Ton activité', sub: 'Pour te proposer un catalogue de départ', quoi: 'ton métier' },
    { id: 'modules', title: 'De quoi as-tu besoin ?', sub: 'On range le menu — on ne retire aucune fonction', quoi: 'ce dont tu as besoin' }
  ];

  return { needsSetup, applySetup, STEPS };
});
