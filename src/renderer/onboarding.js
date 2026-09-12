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
  function needsSetup(data) {
    if (!data || !data.company) return false;
    if (data.company.setupDone) return false;
    return !data.company.name && !(data.documents || []).length && !(data.clients || []).length;
  }

  // Applique les réponses de l'assistant à un jeu de données (utilisé aussi par les tests).
  // answers : { name, matricule, rc, capital, address, phone, email, activity, currency,
  //             stampFee, quoteValidityDays, paymentTermsDays, defaultWithholdingRate,
  //             bank, rib, fillCatalog }
  function applySetup(data, answers) {
    const a = answers || {};
    const co = data.company;
    ['name', 'matricule', 'rc', 'capital', 'address', 'phone', 'email', 'website', 'bank', 'rib', 'activity'].forEach(k => {
      if (a[k] != null) co[k] = String(a[k]).trim();
    });
    ['stampFee', 'quoteValidityDays', 'paymentTermsDays', 'defaultWithholdingRate'].forEach(k => {
      if (a[k] !== undefined && a[k] !== '') co[k] = Number(a[k]) || 0;
    });
    if (a.currency) co.currency = a.currency;
    const act = C.ACTIVITIES.find(x => x.id === a.activity);
    if (act && act.tagline && !co.tagline) co.tagline = act.tagline;
    // Le taux de TVA du métier ne servait qu'à préremplir le catalogue : dès qu'on tapait une ligne
    // à la main, elle naissait à 19 %. Un kinésithérapeute qui déclare « Santé et paramédical »
    // (exonéré) obtenait donc un catalogue à 0 % et des lignes à 19 % — sur la même facture.
    // On ne l'écrase pas s'il a déjà été réglé à la main (0 est une valeur légitime : exonération).
    if (act && (co.defaultVatRate === '' || co.defaultVatRate == null)) co.defaultVatRate = act.vat;
    if (act && a.fillCatalog && !(data.catalog || []).length) {
      data.catalog = act.catalog.map(([label, description, unitPrice, unit]) => ({
        id: C.uid(), label, description: description || '', unitPrice, vatRate: act.vat, unit: unit || 'u'
      }));
    }
    co.setupDone = true;
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
    { id: 'facturation', title: 'Tes règles de facturation', sub: 'Délais, taxes, devise' },
    { id: 'paiement', title: 'Comment tes clients te paient', sub: 'Ce bloc s\'affiche sur tes factures' },
    { id: 'sauvegarde', title: 'Protéger tes données', sub: 'L\'étape que tout le monde saute, et qu\'il ne faut pas sauter' }
  ];

  return { needsSetup, applySetup, STEPS };
});
