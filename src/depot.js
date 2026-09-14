// Le dépôt GitHub d'où viennent les mises à jour — et surtout : est-il public ou privé ?
//
// **C'est LA ligne à changer le jour où le dépôt bascule, et il n'y en a qu'une.**
//
// Le dépôt de SkanFact était privé ; il est passé public le 13/09/2026 parce que GitHub Actions y
// est gratuit, et il redeviendra peut-être privé. Ça change beaucoup de choses dans les deux
// applications : sur un dépôt privé, GitHub répond 404 à tout sans jeton d'accès, donc il faut un
// champ où le coller et des phrases qui l'expliquent ; sur un dépôt public, ce champ ne sert à
// personne et réclamer un jeton fait douter de tout le reste.
//
// Pourquoi un fichier à part plutôt qu'une constante dans chaque `main.js` : il y a DEUX
// applications dans ce dépôt (entreprise et cabinet), et elles avaient chacune la leur. Elles ont
// divergé — l'app entreprise disait « public », l'app du comptable continuait d'afficher « SkanFact
// est distribué depuis un dépôt privé : un jeton est nécessaire » et le faisait chercher un jeton
// que personne n'avait à lui donner. Deux vérités pour un seul fait, c'est une de trop.
//
// Ce que ce drapeau NE décide PAS : le relais de mise à jour (worker Cloudflare) détient le jeton
// côté serveur et fonctionne à l'identique dans les deux cas. Quand il est configuré, personne n'a
// jamais rien à saisir — privé ou public.
module.exports = { owner: 'saouthq', repo: 'skanfact', private: false };
