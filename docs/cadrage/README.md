# Le cadrage de la nouvelle plateforme

*Ouvert le 27/09/2026. Rien ne se code tant que le cadrage n'est pas validé par Skander.*

La référence est `VISION-ARCHITECTURE.md` (à la racine). Ce dossier reçoit un document par sujet,
chacun validé à son tour. Un document validé porte en tête : `Validé par Skander le JJ/MM/AAAA`.

## Les documents à produire, dans l'ordre

| # | Document | Sujet | État |
|---|---|---|---|
| 1 | `01-modele-de-donnees.md` | Organisations, entreprises, utilisateurs ; pièces, lignes, écritures, tiers, articles, stock, paie ; argent en entiers ; identifiants ; partitionnement | À faire (commence le 28/09/2026) |
| 2 | `02-modules.md` | Le socle et les modules, leurs points d'extension, les champs personnalisés, les offres | À faire |
| 3 | `03-droits.md` | Rôles, droits geste par geste, par entreprise ; piste d'audit ; double authentification | À faire |
| 4 | `04-hors-ligne-et-synchro.md` | Ce qui marche hors ligne, file d'envoi, numérotation, choix du moteur de synchro (prototype mesuré) | À faire |
| 5 | `05-obligations-legales.md` | TTN/TEIF, DigiGo/ANCE, TEJ, e-jibaya, CNSS, caisse certifiée, INPDP, conservation 10 ans — chaque point À VÉRIFIER | À faire |
| 6 | `06-securite-et-hebergement.md` | Hébergement tunisien, sauvegardes, restauration, surveillance, audit | À faire |
| 7 | `07-offres-et-prix.md` | Grille par entreprise et par module (on en parle avant de l'écrire) | À faire |
| 8 | `08-reprise-de-l-existant.md` | Ce qu'on garde du moteur et des tests ; reprise des données des utilisateurs actuels et des concurrents | À faire |
| 9 | `09-feuille-de-route.md` | Étapes, jalons, budget détaillé | À faire |

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
| 27/09/2026 | Dépôt rangé : ancienne vision archivée, `CLAUDE.md` réécrit | ce dossier, `CLAUDE.md` |
