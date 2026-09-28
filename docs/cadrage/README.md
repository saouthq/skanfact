# Le cadrage de la nouvelle plateforme

*Ouvert le 27/09/2026. Rien ne se code tant que le cadrage n'est pas validé par Skander. **Tous les documents sont validés depuis le 28/09/2026** (10 à 15 par délégation) ; le prototype de synchronisation est fait (28/09/2026, `04` § 9.4) ; l'arabe est abandonné (Skander, 28/09/2026) ; J0 attend les premières démarches et le dépôt de la plateforme (`09` § 1).*

La référence est `VISION-ARCHITECTURE.md` (à la racine). Ce dossier reçoit un document par sujet,
chacun validé à son tour. Un document validé porte en tête : `Validé par Skander le JJ/MM/AAAA`.

## Les documents à produire, dans l'ordre

| # | Document | Sujet | État |
|---|---|---|---|
| 0 | `00-les-trois-parcours.md` | Comment l'entreprise, le comptable et Skander accèdent à la plateforme et s'en servent (la vue d'ensemble) | **Validé par Skander le 28/09/2026** |
| 1 | `01-modele-de-donnees.md` | Organisations, entreprises, établissements, utilisateurs ; pièces, lignes, écritures, tiers, articles, stock, paie ; argent en entiers ; identifiants ; **règles fiscales datées** (taux et barèmes par date d'effet, pour les lois de finances) ; tables de la console ; partitionnement | **Validé par Skander le 28/09/2026** |
| 2 | `02-modules.md` | Le socle et les modules, leurs points d'extension, les champs personnalisés, les offres | **Validé le 28/09/2026** (après relecture de tout le dépôt) |
| 3 | `03-droits.md` | Rôles, droits geste par geste, par entreprise ; piste d'audit ; double authentification | **Validé le 28/09/2026** (après relecture de tout le dépôt) |
| 4 | `04-hors-ligne-et-synchro.md` | Ce qui marche hors ligne, file d'envoi, numérotation, choix du moteur de synchro (prototype mesuré) | **Validé le 28/09/2026** (après relecture de tout le dépôt) |
| 5 | `05-obligations-legales.md` | TTN/TEIF, DigiGo/ANCE, TEJ, e-jibaya, CNSS, caisse certifiée, INPDP, conservation 10 ans — chaque point À VÉRIFIER | **Validé par Skander le 28/09/2026** |
| 6 | `06-securite-et-hebergement.md` | Hébergement tunisien, sauvegardes, restauration, surveillance, audit | **Validé par Skander le 28/09/2026** |
| 7 | `07-offres-et-prix.md` | Grille par entreprise et par module, cabinets, essai, impayés, fondateurs | **Décidé le 28/09/2026 par délégation** (révisable après les entretiens) |
| 8 | `08-reprise-de-l-existant.md` | Ce qu'on garde du moteur et des tests ; reprise des données des utilisateurs actuels et des concurrents | **Validé par Skander le 28/09/2026** |
| 9 | `09-feuille-de-route.md` | Étapes, jalons, budget détaillé | **Validé par Skander le 28/09/2026** |
| 10 | `10-console.md` | La console d'administration : clients, abonnements, nos factures TEIF, paiement, support avec accord tracé, santé du service, mesure, équipe (`VISION-ARCHITECTURE.md` § 12). Ses tables entrent dans le 01 | **Validé par délégation de Skander le 28/09/2026** |
| 11 | `11-site.md` | Le site : pages, inscription, centre d'aide, page d'état, pages légales, reprise des données (§ 12) | **Validé par délégation de Skander le 28/09/2026** |
| 12 | `12-pile-technique.md` | Les outils précis (serveur, bibliothèque d'interface, migrations de base, file de travaux, moteur de synchro, PDF, mails et WhatsApp, recherche, surveillance), où vit le code (ce dépôt ou un dépôt neuf), les environnements (test, production), l'intégration continue et la stratégie de tests. À décider **avant** la première ligne de code | **Validé par délégation de Skander le 28/09/2026** |
| 13 | `13-mise-sur-le-marche.md` | Cibles par ordre de priorité (à notre lancement, elles auront déjà un logiciel), canaux (cabinets, revendeurs de caisse, contenu, WhatsApp, parrainage), transformer un essai en client, lancement en trois temps, objectifs de la première année | **Validé par délégation de Skander le 28/09/2026** |
| 14 | `14-fonctions-et-integrations.md` | Tout ce que fait SkanFact : Hesabi fonction par fonction, les six manques ajoutés au lancement (espace client et paiement en ligne, lecture de documents, cabinet complet, API, téléphone, catalogue de textes), les métiers (restauration, commerces, bâtiment, fabrication, rendez-vous, location ; hôtellerie à la fin), les intégrations et leur ordre, les langues, ce que ça coûte | **Validé par délégation de Skander le 28/09/2026** |
| 15 | `15-reprise-de-slate.md` | Slate, l'application pour restaurateurs de Skander, devient la partie restaurant de SkanFact : inventaire écran par écran, ce qui change (hébergement, argent, droits), outils d'interface, rebranding | **Validé par délégation de Skander le 28/09/2026** |

**Le 28/09/2026, après validation**, le `14` et le `15` ont complété les documents 00, 01 (§ 24), 02,
03, 04, 05, 06 et 08 (une ligne), déjà validés : chacun le dit en tête, et ces ajouts sont **revalidés par délégation de
Skander le 28/09/2026**. Ils ont aussi revu le 07 (prix), le 09 (calendrier), le 10, le 11, le 12 et le 13.

**Relu en entier le 28/09/2026** (demande de Skander : « relire tout ce qu'on a mis dans le dépôt
pour voir si tout concorde et que tout y est ») : les vagues passent de trois à quatre (`09` § 1), le
budget, les démarches et les flux de données sont remis d'accord partout, et ce qui manquait est
ajouté (les tables des campagnes, avis et messages de Slate ; les compteurs de la console ; les
lettres de mission dans le parcours du comptable).

## En parallèle (Skander et son père)

- Les entretiens terrain : questionnaire en annexe de `docs/etudes/ETUDE-MARCHE.md`.
- Lancer les trois démarches qui serviront pendant le développement : accès test El Fatoora (TTN),
  adhésion « entité d'intégration » DigiGo auprès de l'ANCE, et inscription fournisseur sur la
  plateforme d'homologation des caisses (`05` § 5). Les questions à poser à chacun : `05` § 6.
- Et, dès que la société qui portera SkanFact est choisie : la demande du **label Startup**
  (`05` § 4.8).

## Journal des décisions

| Date | Décision | Où |
|---|---|---|
| 27/09/2026 | Serveur qui fait foi, web installable + bureau hybride, modules, PostgreSQL RLS, argent en entiers, journal inaltérable, API d'abord | `VISION-ARCHITECTURE.md` § 4 |
| 27/09/2026 | TypeScript et bibliothèque d'interface | § 9 |
| 27/09/2026 | Hébergement en Tunisie (secours compris), budget accepté, démarches par le père de Skander | § 9 |
| 27/09/2026 | Une seule session écrit le produit, la console et le site ; la console devient un module du serveur, sans passe-droit sur la RLS ; le site reste statique | `VISION-ARCHITECTURE.md` § 12 |
| 27/09/2026 | Les dépôts de l'application et du site restent publics (GitHub Actions gratuit) | `CLAUDE.md` |
| 27/09/2026 | Dépôt rangé : ancienne vision archivée, `CLAUDE.md` réécrit | ce dossier, `CLAUDE.md` |
| 28/09/2026 | Tiers et articles propres à chaque société (partage possible dans un groupe) ; plusieurs établissements dès le départ ; fin de mandat d'un cabinet : accès retiré, travail gardé et signé | `01-modele-de-donnees.md` § 22 |
| 28/09/2026 | Par délégation de Skander : essai 30 jours ; Essentiel 390 DT/an, Complet 690 DT/an ; cabinet gratuit pour ses clients abonnés + 3 dossiers, puis 60 DT/dossier plafonné à 1 990 DT ; code sur le téléphone obligatoire pour comptables, propriétaires, administrateurs, paie ; rôles ; code cabinet au lieu d'un annuaire ; passage de la v10 sans rien forcer | `00-les-trois-parcours.md`, `07-offres-et-prix.md` |
| 28/09/2026 | Skander valide le cadrage proposé : les trois parcours (00), le modèle de données (01) et les décisions prises par délégation | `00-les-trois-parcours.md`, `01-modele-de-donnees.md` |
| 28/09/2026 | Modules (02), validé après relecture : socle et douze modules, points de branchement déclarés, validation du mois dans le socle, salaires saisis en total sans le module Paie | `02-modules.md` |
| 28/09/2026 | Droits (03), validé après relecture : une seule porte sur le serveur, tableau des gestes par rôle, le cabinet n'émet ni n'encaisse, support en lecture 48 h, dossier tenu, qui compte comme utilisateur | `03-droits.md` |
| 28/09/2026 | Hors-ligne (04), validé après relecture : la liste de ce qui marche fait foi, factures jamais hors ligne, un fait n'est jamais refusé, caisse 7 jours et autres postes 72 h, outil de synchro départagé par un prototype | `04-hors-ligne-et-synchro.md` |
| 28/09/2026 | Obligations légales (05), validé : carte des obligations et de ce qu'on en sait, questions par interlocuteur ; **inscription fournisseur à la plateforme d'homologation des caisses dès maintenant** | `05-obligations-legales.md`, vision § 9 |
| 28/09/2026 | Sécurité et hébergement (06), validé : deux centres en Tunisie chez deux opérateurs (EO Data Center proposé en principal, sur devis), objectifs de perte et de reprise, copie intouchable, restauration mesurée chaque mois, aucun accès à la base hors urgence tracée | `06-securite-et-hebergement.md` |
| 28/09/2026 | Reprise de l'existant (08), validé : moteur et tests portés au millime, reprise acceptée seulement à chiffres identiques, dossier v10 en lecture seule au passage ; personne ne paie la v10 aujourd'hui | `08-reprise-de-l-existant.md` |
| 28/09/2026 | Par délégation, à la demande de Skander (« tout ce que Hesabi a, il nous le faut ») : tout Hesabi au lancement, plus l'espace client et le paiement en ligne, la lecture de documents en Tunisie, le cabinet complet, l'API, le téléphone ; restauration et commerces au lancement ; trois vagues après, puis l'hôtellerie (**décision de Skander**) ; l'arabe plus tard, l'infrastructure maintenant (**décision de Skander**) ; lancement à 27 mois (30 avec la marge) ; Essentiel avec le stock et une caisse | `14-fonctions-et-integrations.md` |
| 28/09/2026 | **Skander** : Slate entre dans SkanFact comme sa partie restaurant (rebranding à faire), **en vague 1**, après une base stable (entreprise, cabinet, console) ; lancement à 25 mois au plan (28 avec la marge) ; la plateforme prend les outils d'interface de Slate, sous réserve de l'arabe | `15-reprise-de-slate.md` |
| 28/09/2026 | Les dépôts restent publics (Skander, confirmé le 28/09 : « personne ne nous connaît, on publie gratuitement ») | `CLAUDE.md`, `12` § 1 |
| 28/09/2026 | Relecture complète du dépôt (demande de Skander) : **quatre vagues** au lieu de trois (la vague 1 garde la restauration, l'arabe, les rendez-vous et les messages) ; budget, démarches et flux remis d'accord dans la vision, `CLAUDE.md` et les documents ; les manques ajoutés | `09` § 1, `14`, ce dossier |
| 28/09/2026 | **Skander** : la partie restaurant reste en français seulement. Seconde relecture complète : la mise sur le marché revue (au lancement fin 2028, les obligations de 2026 à 2028 seront passées : on vend un changement, avec la reprise des données des concurrents à l'étape 3) ; marque déposée dès que la société est choisie ; frais uniques corrigés (26 000 DT au plus) ; audit annuel compté ; manques comblés (geste des recettes, dépendances des intégrations, tests du site, point mort dans la console) | `09`, `13`, `05`, `14` § 5, `15` |
| 28/09/2026 | **Skander valide la feuille de route (09)** : cinq étapes, lancement au mois 25 (28 avec la marge), quatre vagues, budget en estimations | `09-feuille-de-route.md` |
| 28/09/2026 | **Skander** : SkanFact est porté par sa société actuelle (objet social et label Startup à vérifier) ; il délègue la validation des documents restants : **10 à 15 validés et les ajouts aux 00 à 08 revalidés par délégation**, après deux relectures complètes. **Le cadrage est complet** ; restent les démarches et le prototype de synchronisation (J0) | `05` § 4.8, ce dossier |
| 28/09/2026 | **Prototype de synchronisation fait** (« vasy go ») : notre chemin tient 12 seuils sur 12 sous Node et 6 sur 6 dans Chromium, PowerSync 7 sur 7 avec un jeton de 30 s ; **on garde notre propre chemin** (une seule règle de droits, six fois moins de place sur le poste, pas de service en plus), avec réponses compressées et un canal qui prévient le poste ; PowerSync en plan B. Restent pour J0 : l'arabe avec les outils d'interface, et les démarches | `04` § 9.4, `12` § 4, `prototypes/synchro/` |
| 28/09/2026 | **Skander : l'arabe est abandonné** (« j'ai dit abandonner arabe ») pour toute la plateforme : ni interface, ni site, ni relecture, ni essai de droite à gauche ; les outils de Slate sont pris sans réserve. Restent le catalogue de textes (pour l'anglais en vague 4), les champs arabes facultatifs, et les mentions en arabe **si la loi les impose** (À VÉRIFIER). Les démarches sont entre les mains de son père, qui dira quand elles sont prêtes | `14` § 5, `09`, `11`, `12`, `15`, vision |
