# SkanFact — la page unique

*Brouillon du 16/09/2026, écrit par Claude parce que `PLAN-DEVELOPPEMENT.md` Phase 0 le lui confie.
**À relire et à réécrire par Skander avec ses mots** : c'est lui qui va la dire au téléphone, et une
phrase qu'on n'a pas écrite soi-même ne se dit pas bien. Elle tient sur une page A4, exprès. Les prix
viennent de `DIRECTION.md` ; ils ne sont pas encore confrontés au marché (§ « Ce qui reste à faire »).*

---

## Le problème

Une petite entreprise tunisienne facture sur Excel ou sur Word, et son comptable reçoit chaque mois
un sac de papiers. Personne ne ment, personne n'est négligent : les deux font ce qu'ils peuvent avec
ce qu'ils ont. Le résultat est le même chaque mois — le comptable **ressaisit tout**, l'entreprise ne
sait pas où elle en est avant trois mois, et les deux perdent du temps sur une chose qu'aucun des
deux ne voulait faire.

## La solution

**SkanFact est deux applications qui se parlent.** L'entreprise facture, encaisse, suit ses achats,
sa trésorerie et sa paie. À la fin du mois, elle envoie à son comptable **un seul fichier chiffré** :
les pièces, les journaux et **les écritures comptables déjà écrites**. Le comptable l'ouvre dans
**SkanFact Cabinet** et retrouve ses livres, sans ressaisir une ligne.

Ce qui le prouve, et qui est vérifié à chaque version : **la balance du comptable est identique à
celle de l'entreprise, au millime près.** Ce n'est pas une promesse commerciale, c'est un test qui
doit passer avant chaque publication.

## Pour qui

- **L'entreprise** : de une à vingt personnes, régime réel ou forfaitaire, en Tunisie. Quelqu'un qui
  fait ses devis et ses factures lui-même, et qui n'a pas appris la comptabilité.
- **Le cabinet comptable** : qui reçoit du papier de la plupart de ses clients, et qui voudrait que
  ceux qui peuvent lui envoyer des écritures le fassent.

## Ce qui n'est pas négociable

- **Tout fonctionne hors ligne.** Les données restent sur l'ordinateur, jamais sur un serveur. Une
  coupure de connexion n'empêche pas d'émettre une facture.
- **L'application survit à son éditeur.** La licence se vérifie sur le poste, sans appeler personne.
  Si SkanFact disparaît demain, les factures continuent de sortir.
- **Jamais de données en otage.** Une licence expirée bloque la création de pièces nouvelles. Lire,
  imprimer, exporter, sauvegarder, envoyer le dossier au comptable : toujours possible.
- **Le fichier du mois est un ZIP ordinaire.** Le comptable peut l'ouvrir sans SkanFact.

## Combien

| | Prix | Ce que ça donne |
|---|---|---|
| **Essai** | 0 DT | 30 jours, tout ouvert, sans carte bancaire |
| **Indépendant** | 390 DT HT / an | ventes, clients, catalogue, documents, relances |
| **Entreprise** | 690 DT HT / an | tout : achats, stock, immobilisations, paie, trésorerie, marges |
| **Remise parrainage** | −20 % la première année | si le cabinet comptable a présenté SkanFact |
| **SkanFact Cabinet** | gratuit | pour tous les dossiers dont le client a une licence, **plus trois** dossiers hors SkanFact |

Au-delà de trois dossiers hors SkanFact, le cabinet paie **par dossier**, jamais par poste : un
cabinet installe SkanFact sur autant d'ordinateurs qu'il veut.

## Pourquoi nous plutôt qu'un autre

- **Le trait d'union est le produit.** Un logiciel de facturation, il en existe ; un logiciel de
  comptabilité, aussi. Ce qui n'existe pas, c'est le chemin sans ressaisie entre les deux, écrit pour
  la fiscalité tunisienne — TVA, timbre fiscal, retenue à la source, CNSS, plan SCE.
- **Écrit ici, pour ici.** Les taux se règlent, aucun n'est figé dans le code : une loi de finances
  ne rend pas le logiciel faux du jour au lendemain.
- **On n'affirme que ce qu'on peut prouver.** Quand l'application ne peut pas garantir une chose,
  elle l'écrit au lieu d'afficher un vert rassurant.

## Le premier pas

Une démonstration de vingt minutes, chez vous, sur vos vraies pièces. Si ça ne vous fait pas gagner
de temps le premier mois, ça ne vous en fera jamais gagner.

**contact@skanfact.tn**

---

## Ce qui reste à faire sur cette page (à toi)

1. **La réécrire avec tes mots.** Ce brouillon est une charpente, pas ta voix.
2. **Confronter les prix.** Appelle trois cabinets et cinq entreprises : demande ce qu'ils paient
   aujourd'hui, pas ce qu'ils pensent de nos prix. Deux heures, et ça peut changer tout ce tableau.
3. **Une capture d'écran**, une seule : les livres du cabinet lus dans un paquet reçu. C'est la
   preuve visuelle du « sans ressaisie », et elle existera avec la 9.1.0.
4. **La poser sur le site** (`skanfact-site`), et réparer le bouton de téléchargement du Cabinet qui
   renvoie un 404 — sinon la page envoie les gens dans le mur.
