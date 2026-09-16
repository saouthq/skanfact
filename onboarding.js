// Assistant de première utilisation : les cinq écrans qui suivent la toute première ouverture.
// Il ne s'affiche que si aucune entreprise n'est encore renseignée (company.setupDone à false et
// pas de documents). Il n'impose rien : tout se remodifie ensuite dans Paramètres.
//
// Rendu à part de app.js pour que les textes d'accueil se relisent facilement. L'assistant
// travaille sur une copie et ne touche aux données qu'à la dernière étape.
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
  const STEPS = [
    {
      id: 'bienvenue', title: 'Bienvenue dans SkanFact', sub: 'Deux minutes pour préparer ton entreprise',
      intro: `<p>SkanFact fabrique tes devis et tes factures, suit ce qu'on te doit et prépare ce que ton comptable te demandera.</p>
        <p>Tout reste <b>sur cet ordinateur</b> : rien n'est envoyé sur Internet, personne d'autre n'y a accès. En contrepartie, c'est toi qui es responsable de tes sauvegardes — on s'en occupe à la dernière étape.</p>
        <p class="small muted">Tu peux passer cet assistant et tout régler plus tard dans Paramètres. Rien n'est définitif : chaque réponse se modifie ensuite.</p>`
    },
    { id: 'entreprise', title: 'Ton entreprise', sub: 'Ce qui s\'imprimera en haut de chaque document' },
    { id: 'activite', title: 'Ton activité', sub: 'Pour te proposer un catalogue de départ' },
    { id: 'modules', title: 'De quoi as-tu besoin ?', sub: 'On range le menu — on ne retire aucune fonction' },
    { id: 'facturation', title: 'Tes règles de facturation', sub: 'Délais, taxes, devise' },
    { id: 'paiement', title: 'Comment tes clients te paient', sub: 'Ce bloc s\'affiche sur tes factures' },
    { id: 'sauvegarde', title: 'Protéger tes données', sub: 'L\'étape que tout le monde saute, et qu\'il ne faut pas sauter' }
  ];

  return { needsSetup, applySetup, STEPS };
});
