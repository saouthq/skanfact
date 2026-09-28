# Le cadrage de la nouvelle plateforme

*Ouvert le 27/09/2026. Rien ne se code tant que le cadrage n'est pas validé par Skander.*

La référence est `VISION-ARCHITECTURE.md` (à la racine). Ce dossier reçoit un document par sujet,
chacun validé à son tour. Un document validé porte en tête : `Validé par Skander le JJ/MM/AAAA`.

## Les documents à produire, dans l'ordre

| # | Document | Sujet | État |
|---|---|---|---|
| 0 | `00-les-trois-parcours.md` | Comment l'entreprise, le comptable et Skander accèdent à la plateforme et s'en servent (la vue d'ensemble) | **Validé par Skander le 28/09/2026** |
| 1 | `01-modele-de-donnees.md` | Organisations, entreprises, établissements, utilisateurs ; pièces, lignes, écritures, tiers, articles, stock, paie ; argent en entiers ; identifiants ; **règles fiscales datées** (taux et barèmes par date d'effet, pour les lois de finances) ; tables de la console ; partitionnement | **Validé par Skander le 28/09/2026** |
| 2 | `02-modules.md` | Le socle et les modules, leurs points d'extension, les champs personnalisés, les offres | **Validé le 28/09/2026** (après relecture de tout le dépôt) |
| 3 | `03-droits.md` | Rôles, droits geste par geste, par entreprise ; piste d'audit ; double authentification | **Validé le 28/09/2026** (après relecture de tout le dépôt) |
| 4 | `04-hors-ligne-et-synchro.md` | Ce qui marche hors ligne, file d'envoi, numérotation, choix du moteur de synchro (prototype mesuré) | **Proposé le 28/09/2026, à valider** |
| 5 | `05-obligations-legales.md` | TTN/TEIF, DigiGo/ANCE, TEJ, e-jibaya, CNSS, caisse certifiée, INPDP, conservation 10 ans — chaque point À VÉRIFIER | À faire |
| 6 | `06-securite-et-hebergement.md` | Hébergement tunisien, sauvegardes, restauration, surveillance, audit | À faire |
| 7 | `07-offres-et-prix.md` | Grille par entreprise et par module, cabinets, essai, impayés, fondateurs | **Décidé le 28/09/2026 par délégation** (révisable après les entretiens) |
| 8 | `08-reprise-de-l-existant.md` | Ce qu'on garde du moteur et des tests ; reprise des données des utilisateurs actuels et des concurrents | À faire |
| 9 | `09-feuille-de-route.md` | Étapes, jalons, budget détaillé | À faire |
| 10 | `10-console.md` | La console d'administration : clients, abonnements, nos factures TEIF, paiement, support avec accord tracé, santé du service, mesure, équipe (`VISION-ARCHITECTURE.md` § 12). Ses tables entrent dans le 01 | À faire |
| 11 | `11-site.md` | Le site : pages, inscription, centre d'aide, page d'état, pages légales, reprise des données (§ 12) | À faire |
| 12 | `12-pile-technique.md` | Les outils précis (serveur, bibliothèque d'interface, migrations de base, file de travaux, moteur de synchro, PDF, mails et WhatsApp, recherche, surveillance), où vit le code (ce dépôt ou un dépôt neuf), les environnements (test, production), l'intégration continue et la stratégie de tests. À décider **avant** la première ligne de code | À faire |

## En parallèle (Skander et son père)

- Les entretiens terrain : questionnaire en annexe de `docs/etudes/ETUDE-MARCHE.md`.
- Préparer les deux démarches qui serviront pendant le développement : accès test El Fatoora (TTN)
  et adhésion « entité d'intégration » DigiGo auprès de l'ANCE.

## Journal des décisions

| Date | Décision | Où |
|---|---|---|
| 27/09/2026 | Serveur qui fait foi, web installable + bureau hybride, modules, PostgreSQL RLS, argent en entiers, journal inaltérable, API d'abord | `VISION-ARCHITECTURE.md` § 4 |
| 27/09/2026 | TypeScript et bibliothèque d'interface | § 9 |
| 27/09/2026 | Hébergement en Tunisie (secours compris), budget accepté, démarches par le père de Skander | § 9 |
| 27/09/2026 | Une seule session écrit le produit, la console et le site ; la console devient un module du serveur, sans passe-droit sur la RLS ; le site reste statique | `VISION-ARCHITECTURE.md` § 12 |
| 28/09/2026 | Tiers et articles propres à chaque société (partage possible dans un groupe) ; plusieurs établissements dès le départ ; fin de mandat d'un cabinet : accès retiré, travail gardé et signé | `01-modele-de-donnees.md` § 22 |
| 28/09/2026 | Par délégation de Skander : essai 30 jours ; Essentiel 390 DT/an, Complet 690 DT/an ; cabinet gratuit pour ses clients abonnés + 3 dossiers, puis 60 DT/dossier plafonné à 1 990 DT ; code sur le téléphone obligatoire pour comptables, propriétaires, administrateurs, paie ; rôles ; code cabinet au lieu d'un annuaire ; passage de la v10 sans rien forcer | `00-les-trois-parcours.md`, `07-offres-et-prix.md` |
| 28/09/2026 | Skander valide le cadrage proposé : les trois parcours (00), le modèle de données (01) et les décisions prises par délégation | `00-les-trois-parcours.md`, `01-modele-de-donnees.md` |
| 28/09/2026 | Modules (02), validé après relecture : socle et douze modules, points de branchement déclarés, validation du mois dans le socle, salaires saisis en total sans le module Paie | `02-modules.md` |
| 28/09/2026 | Droits (03), validé après relecture : une seule porte sur le serveur, tableau des gestes par rôle, le cabinet n'émet ni n'encaisse, support en lecture 48 h, dossier tenu, qui compte comme utilisateur | `03-droits.md` |
| 27/09/2026 | Les dépôts de l'application et du site restent publics (GitHub Actions gratuit) | `CLAUDE.md` |
| 27/09/2026 | Dépôt rangé : ancienne vision archivée, `CLAUDE.md` réécrit | ce dossier, `CLAUDE.md` |
