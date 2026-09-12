# Historique des versions

Format : `MAJEUR.MINEUR.CORRECTIF`
- correctif (1.0.x) : bug corrigé, petit ajustement visuel
- mineur (1.x.0) : nouvelle fonctionnalité
- majeur (x.0.0) : gros changement (nouvelle structure de données, refonte)

Le numéro affiché en bas de la barre latérale de l'app est celui de `package.json`.

## 6.8.2 — 12/09/2026

**Le reste de ce que le second audit a trouvé : ce qui bloque un cabinet réel, ce qui se voit en démonstration, et trois tests qui ne pouvaient pas échouer.**

### Changer d'ordinateur

Le pire des défauts est celui qui punit quelqu'un qui a tout bien fait. Le comptable avait sa copie sur clé USB et sa clé de secours, comme l'application le lui répétait en rouge. Sur le Mac neuf, elle répondait « Bienvenue », lui fabriquait une clé **neuve** — donc une autre empreinte — et les paquets que ses clients enverraient ensuite étaient refusés : « adressé à un autre cabinet ». Huit cents paquets lisibles sur la table, et aucun bouton pour les reprendre.

- **« J'ai déjà un cabinet sur un autre ordinateur… »** sur l'écran de mot de passe, **avant** toute création de clé. Trois chemins : le dossier de copie (le bon — il porte aussi les paquets), le fichier du cabinet seul, ou la clé de secours.
- L'application **dit ce qu'elle a trouvé avant de demander le mot de passe** : « le fichier du cabinet · 2 sauvegardes · 812 paquets (4,2 Go) ». On ne fait pas taper un mot de passe pour apprendre ensuite qu'on s'est trompé de dossier.
- Tout est vérifié — enveloppe, mot de passe, structure — **avant** que quoi que ce soit ne touche au disque. Un essai raté ne laisse rien derrière lui, et la source n'est jamais modifiée : une clé USB ne se vide pas sur un essai.
- Le bilan finit par **l'empreinte**, la seule vérification qui compte : si elle a changé, c'est le mauvais fichier qui a été repris.
- Les chemins des paquets **se recollent** sur ce poste-ci. Ils désignaient l'autre ordinateur : sans ça, des pièces bien présentes passaient pour perdues. Et s'ils désignent encore le support d'origine — la clé encore branchée — on se recolle sur la copie locale : le cabinet ne doit pas lire les pièces de ses clients sur une clé qu'on va débrancher.
- Un article d'aide **« Changer d'ordinateur »**, qui dit surtout ce qu'il ne faut *pas* faire, parce que c'est le geste naturel et que c'est lui qui coûte cher.

### Importer vingt paquets

À soixante clients, le geste quotidien n'est pas d'importer *un* paquet. Vingt paquets de cinquante mégaoctets, c'était **vingt-deux secondes de fenêtre figée, sans un mot** : lecture, déchiffrement, vérification pièce par pièce, copie — et pendant tout ce temps l'application ne lisait aucun message. Beaucoup l'auraient tuée au bout de dix secondes, en plein rangement.

- **Une fenêtre d'avancement** : « paquet 7 sur 20 — Pharmacie El Menzah », avec un bouton **Arrêter**. L'arrêt prend effet **entre** deux paquets, jamais pendant : ce qui est rangé l'est pour de bon, rien n'est laissé à moitié écrit.
- Le manifeste n'est plus **décompressé trois fois ni haché deux fois** par paquet. Il ne peut pas porter sa propre empreinte : le hacher était du travail que personne ne lit.
- **L'application du cabinet a enfin son chien de garde**, celui de la 6.5.0. C'est celle qui travaille le plus longtemps, et c'était la seule sans filet. Avec une règle de plus, propre à elle : ici c'est le processus principal qui peut être occupé longtemps (ranger vingt paquets, relire soixante paquets pour un export), et **son** silence ne doit pas passer pour un gel de l'interface — sinon il rechargerait une page innocente sous les doigts du comptable.

### « 7 pièces vérifiées, intactes » doit compter dans les deux sens

C'est la seule affirmation rigoureuse de cette application. Elle ne regardait que ce que le manifeste annonce : un fichier présent dans le paquet **sans y figurer** n'était ni compté, ni vérifié, ni signalé — et il s'affichait comme les autres, cliquable. Un paquet de trente pièces dont douze annoncées affichait « 12 pièces vérifiées, intactes », et les dix-huit autres, comparées à rien, s'ouvraient d'un clic.

- Les fichiers **non annoncés** sont comptés à part (ils n'entrent jamais dans les pièces vérifiées), dits dans le rapport d'import, gardés avec le paquet, marqués d'un « ? » dans la liste, et leur ouverture passe par une question. Un paquet fabriqué par SkanFact n'en contient jamais.
- Sans manifeste lisible, on n'accuse personne : tout passe pour annoncé.

### Les fenêtres et le clavier

La règle des couches de la 5.2.2 n'avait jamais été portée à l'application du comptable. Trois défauts qui ne laissent **aucune trace** : rien ne plante, rien n'apparaît en console.

- **Échap fermait toutes les fenêtres empilées d'un coup.** Le comptable remplissait la fiche d'un client, cliquait « Supprimer… » par erreur, faisait Échap pour annuler la question — et perdait aussi les huit champs qu'il venait de taper. Échap n'agit plus que sur la fenêtre du dessus.
- **Entrée ne validait rien**, et le focus se posait sur « Annuler » : sur « Fichier créé · Le montrer dans le dossier », le réflexe « Entrée = oui » répondait « Annuler ».
- **Cmd+K ouvrait la palette derrière la fenêtre** et lui volait le clavier : la frappe suivante partait dans un champ invisible, sans que rien ne bouge à l'écran. Et dans l'autre sens, une fenêtre ouverte par le menu ou par un paquet double-cliqué s'affichait **par-dessus une palette restée ouverte**, qui continuait d'intercepter Échap, Entrée et les flèches. Les deux sens sont fermés.
- Et **Échap sur un formulaire rempli prévient** au lieu de jeter la saisie en silence.

### Les fichiers, dans le Finder et l'Explorateur

Les icônes déclarées pour `.skanpack` et `.skanrecover` étaient des **PNG**. electron-builder ne convertit rien — il échange `.ico` et `.icns` selon la plateforme, donc un `.png` ressortait inchangé et s'installait là où macOS attend un `.icns`. Rien n'échouait, rien n'était signalé, et le comptable voyait un fichier blanc générique parmi vingt autres — alors que c'est précisément le repère qui devait dire « c'est un paquet SkanFact, double-clique ». Les deux types ont maintenant leur vraie icône, à sept tailles pour Windows : c'est à 16 pixels qu'on regarde une liste de fichiers.

### Les chiffres de l'écran

- **Le bandeau de la page Relances contredisait le tableau dix pixels plus bas** : il comptait les seuls mois manquants pendant que la liste montrait aussi les provisoires. Tout part maintenant de la même fonction, et le bandeau — comme la pastille et « À faire » — annonce les deux motifs. Règle générale posée : un compteur et la liste qu'il annonce se calculent avec la même fonction.
- **Dans le jeu d'exemple, chaque paquet était reçu le 8 du mois qu'il couvrait** : « août, définitif, reçu le 08/08 ». Le premier comptable à qui on le montre demande s'il a clôturé son mois d'août le 8 août — et toute la promesse du produit (définitif = mois clôturé) s'écroule sur son premier exemple. Les réceptions passent au mois suivant, à des jours différents d'un client à l'autre, et jamais dans le futur.

### Trois tests qui ne pouvaient pas échouer

Un test qui ne peut pas échouer est pire que pas de test : il fait croire que le sujet est couvert.

- Les deux `main.js` étaient **hors du seul contrôle statique**, alors que ce sont les seuls fichiers qu'aucun test n'exécute. C'est exactement là qu'un appel à une fonction inexistante ne se voit que le jour où un comptable clique.
- Le test « sous tous les fuseaux » **n'appelait aucune fonction qui regarde l'horloge** : il était vrai par construction. C'était la configuration exacte de la panne de la 5.2.3.
- `assert.ok(handlers.length >= 0)` — toujours vrai. Et la fonction qui retire la clé privée avant de parler à l'interface n'était jamais **exécutée**, seulement cherchée par une expression régulière tolérante.

Chacun des trois a été vérifié en réintroduisant le défaut d'origine.

### Et un défaut introduit, puis attrapé

En posant le garde-fou « ne jette pas la saisie », un remplacement de texte trop gourmand a armé la mauvaise fenêtre : **l'accusé de réception s'ouvrait avec aucun bouton branché**. Rien en console, rien qui plante — juste des boutons morts. Cette fenêtre n'était parcourue par aucun test ; elle l'est maintenant, dans le test qui suit la boucle complète (l'entreprise envoie, le cabinet reçoit, puis **répond**), et un second test vérifie que ce garde-fou est toujours posé en entier — déclaré, armé, et donné à la fenêtre — ou pas du tout.

*Deux nouvelles suites qui ouvrent vraiment les applications : `npm run e2e:demenagement` (deux postes à la suite, la même empreinte à l'arrivée) et `npm run e2e:couches` (deux fenêtres empilées, Échap, Entrée, Cmd+K). Chaque correctif de cette version a été prouvé en le retirant.*

## 6.8.1 — 12/09/2026

**Un second audit, mené sur la 6.8.0 elle-même : 131 constats confirmés par un relecteur adverse, dont plusieurs défauts que le premier audit n'avait pas vus.** Les plus graves sont corrigés ici.

### Ce qui détruisait des pièces

- **Un mois renvoyé écrasait le paquet sur lequel le comptable avait déclaré.** Le 15 avril il dépose la TVA de mars sur le paquet définitif ; le 3 juin le client rouvre mars et renvoie — l'ancien fichier n'existait plus nulle part, ni les chiffres. Désormais chaque réception garde son fichier (`-r2`, `-r3`), les précédentes restent dans la fiche, et l'application **dit de combien les chiffres ont bougé** : c'est exactement une rectificative.
- **Un paquet plus ancien détrônait un plus récent.** En rattrapant une boîte mail en retard, un vieux provisoire remontait : le chiffre d'affaires tombait, le mois repassait « provisoire », et le cabinet réclamait à son client un mois déjà reçu définitif. Un paquet fabriqué avant celui qu'on a est maintenant écarté, et l'application le dit.
- **La sauvegarde « avant suppression » était effacée à la seconde où elle naissait.** Les sauvegardes se purgeaient par **ordre alphabétique** : « avant-changement-mot-de-passe » passait toujours en premier, et vingt sauvegardes manuelles suffisaient à chasser le filet pris juste avant d'effacer trois ans de pièces — pendant que la fenêtre affichait « Une sauvegarde est prise juste avant ». Purge par **date**, réserves séparées pour les filets et les sauvegardes volontaires, et `backupNow` échoue bruyamment si sa copie a disparu.
- **Un paquet dont le fichier a disparu restait vert et « définitif ».** Il est maintenant repéré et marqué.

### Ce qui mélangeait les clients

- **Un nom de société en arabe n'avait pas d'identité.** `شركة الأمان` et `مخبزة الياسمين` donnaient tous deux la clé vide `NOM:` : dans un portefeuille tunisien, **tous** les clients dont la raison sociale est en arabe tombaient dans un seul dossier, et leurs paquets s'écrasaient. Un cabinet de Sfax qui colle ses soixante clients en perdait la moitié en « doublons ». Toutes les lettres sont désormais conservées, sur le disque comme dans l'identifiant.
- **La recherche était sensible aux accents** : « epicerie » ne trouvait pas « Épicerie ».

### Ce que le calendrier racontait

- **Il réclamait des mois qui n'étaient pas finis.** Un cabinet parfaitement à jour voyait quatre cartes sur cinq en rouge, parce qu'on fabriquait des échéances pour le mois en cours et les trois suivants. Seuls les mois terminés en produisent.
- **Il comptait les clients hors SkanFact comme des retardataires**, alors que la page Relances affirmait le contraire un clic plus loin. Il s'appuie maintenant sur exactement la même logique que la fiche client — début de mission compris.
- **Le 1er du mois, tout le portefeuille basculait en retard.** Personne n'a encore envoyé le mois qui vient de finir : le compteur rouge était maximal le jour où personne n'était fautif. Le mois qui vient de s'achever se montre, il ne crie pas, jusqu'au jour de relance.

### Ce que l'application affirmait sans le faire

- **Ouvrir une pièce lançait le fichier avec le programme du système, sous un nom choisi par l'expéditeur.** Un paquet contenant « facture.pdf.command » aurait fait exécuter du code d'un simple clic. Seuls les documents (PDF, CSV, images, texte) sont ouverts ; le reste est montré dans le dossier, et l'application dit pourquoi.
- **Rien ne validait le manifeste d'un paquet**, et ce manifeste servait à fabriquer un chemin de fichier : un mois de la forme `../../..` écrivait hors du dossier de l'application. Tout est contrôlé avant que quoi que ce soit ne touche au disque, et un paquet d'une version plus récente est refusé avec une phrase claire au lieu d'être rangé à moitié.
- **Exporter la clé de secours ne demandait pas le mot de passe du cabinet** : n'importe qui devant un poste déverrouillé repartait avec la clé de toutes les comptabilités.

### Ce qui affichait des chiffres faux

- **`money()` prenait la valeur absolue** : un mois d'avoirs s'affichait comme un bon mois, et les lignes ne faisaient plus le total.
- **Le total « Chiffre d'affaires »** additionnait un champ sans le convertir (une chaîne se concaténait, et 42 500 DT s'affichaient « 0,000 DT ») et mélangeait les devises sans le dire.
- **Une date de début de mission n'avait ni plancher ni plafond**, et le rabot interne coupait par la **fin** : l'application réclamait des mois de 2006 et ne réclamait plus ceux réellement en retard. Bornée à cinq ans, en gardant la fin.
- **« Renseigne un début de mission »** : l'écran réclamait un geste qui ne faisait rien pour un client hors SkanFact. Il fonctionne.

### Finitions

- Les en-têtes de colonnes triables portaient une classe que la feuille de style ne connaît pas : ni curseur, ni survol, ni flèche. Et le classement par urgence, qui est le tri par défaut, était irrécupérable après un clic — un bouton le rend.
- Une relance n'est plus enregistrée quand il n'y a pas d'adresse : le journal de relance se mettait à mentir.
- « il y a 3 jours » comptait des tranches de 24 h : la cellule affichait « 11/09/2026 (aujourd'hui) » le 12 au matin.
- Les tailles de fichiers s'écrivent avec une virgule, comme les montants à côté.
- Les accords : « tes 1 dossier … ont envoyé ».
- Modifier une fiche et se voir refuser la modification ne laisse plus le changement en mémoire : il partait au disque à l'enregistrement suivant, sans que rien ne le dise.

## 6.8.0 — 12/09/2026

**SkanFact Cabinet ne peut plus rien perdre — et devient le tableau de bord du portefeuille, pas la liste des deux clients déjà passés à SkanFact.**

C'est l'application qui détient la comptabilité de dizaines d'entreprises **et** la clé qui ouvre leurs paquets. Elle n'avait **aucune sauvegarde**. C'était le seul point où un incident coûtait vraiment cher.

### Ne rien perdre

- **Sauvegarde quotidienne automatique** : avant la première modification de la journée, le fichier est mis de côté tel qu'il était ce matin-là. On peut donc revenir à « hier » après une fausse manœuvre. Trente jours conservés, plus une sauvegarde avant chaque import et avant chaque suppression.
- **Copie vers un autre support** (clé USB, disque externe, iCloud Drive) : la base, les sauvegardes **et les paquets**. Une copie qui ne prendrait pas les paquets laisserait le comptable avec l'index de ce qu'il a perdu.
- **Clé de secours** : le fichier le plus important que ce cabinet produira. Il contient la clé qui ouvre les paquets de ses clients. Sans elle et sans l'ordinateur, **aucun paquet déjà reçu ne se rouvre, jamais**. L'application le dit, en rouge, tant qu'elle n'a pas été enregistrée.
- **Le mot de passe se change enfin.** Il n'existait aucun moyen de le faire : s'il fuitait, ou si un collaborateur partait, il n'y avait aucun recours. Les sauvegardes sont rechiffrées avec lui — une sauvegarde restée sur l'ancien mot de passe n'est pas une sauvegarde.
- **Restaurer dit d'abord ce qu'on va perdre** : combien de dossiers et de paquets dans la sauvegarde, combien maintenant. Et l'état actuel est mis de côté avant : une restauration n'est jamais un aller simple.
- **Un fichier illisible n'est plus jamais écrasé** : il est mis de côté et l'écran d'ouverture explique quoi faire.
- **Perdre le fichier principal ne ressemble plus au premier jour.** Si les sauvegardes sont là et que la base a disparu, l'écran le dit, conseille de reprendre l'ancien mot de passe, et emmène directement aux sauvegardes au lieu d'ouvrir un assistant de bienvenue. Et le **même** mot de passe rouvre bien ces sauvegardes : un nouveau sel est tiré à chaque création, donc la clé dérivée change — l'application répondait « cette sauvegarde a été faite avec un autre mot de passe » à quelqu'un qui venait de taper le bon, au pire moment possible.
- **Les paquets sont rangés par client, puis par année** (`paquets/Menuiserie-Trabelsi/2026/2026-08.skanpack`). Ils étaient tous à plat, nommés par matricule : à soixante clients sur trois ans, deux mille fichiers illisibles dans un seul dossier. Le rangement se fait tout seul à la première ouverture, et suit un changement de nom de client. On peut maintenant rendre ses pièces à un client en copiant un dossier.
- **Supprimer existe** : un dossier (avec ses paquets) ou un paquet arrivé par erreur. Il n'y avait que l'archivage.
- **Verrouiller sans quitter**, pour quitter son bureau sans laisser soixante comptabilités ouvertes.

### Le premier quart d'heure

- **Un assistant de première utilisation**, comme l'app entreprise en a un depuis la 2.0.0. Le cabinet atterrissait jusqu'ici sur un formulaire de réglages avec un message passager, et repartait sans savoir quoi faire. Cinq écrans : ce que l'application fait (et ne fait pas), le cabinet, **les clients**, les filets, le fichier d'appairage.
- **Coller la liste de ses clients d'un coup**, une ligne par client, directement depuis Excel ou Numbers. Un cabinet a soixante clients : les saisir un par un dans un formulaire, personne ne le ferait — et l'application serait vide le jour de la démonstration, c'est-à-dire au moment précis où elle doit convaincre. Les colonnes (`nom ; matricule ; email ; téléphone`) sont facultatives et reconnues dans le désordre ; les doublons sont écartés **et nommés**.
- **Double-cliquer un `.skanpack` dans le Finder l'importe.** Le système ne savait pas quoi faire de ces fichiers et proposait une liste d'applications au hasard.

### Le portefeuille, pas seulement SkanFact

- **Créer un dossier à la main.** Un comptable a soixante clients dont deux sous SkanFact : l'application ne montrait que ces deux-là. Un client créé à la main compte dans le portefeuille et **rien ne lui est réclamé** tant qu'il n'a pas commencé ; le jour où son premier paquet arrive, il devient un dossier ordinaire tout seul, sans doublon.
- **Une vraie fiche client** : téléphone, interlocuteur, régime fiscal, périodicité de TVA, honoraires mensuels, et **date de début de mission**. Cette dernière manquait cruellement : sans elle, l'attente démarrait au premier paquet reçu, donc un client repris en cours d'année n'était **jamais** réclamé sur ses mois antérieurs — et on s'en apercevait au bilan.
- **Appeler ou écrire sur WhatsApp** depuis la fiche. En Tunisie, un comptable qui court après des pièces appelle.
- **Tableau de bord du portefeuille** : clients suivis, à jour, mois manquants, chiffre d'affaires suivi.
- **Listes tenables à soixante lignes** : tri sur chaque colonne, pagination, totaux en pied, export CSV. Les totaux et l'export portent sur la sélection entière, jamais sur la page affichée.
- **Glisser-déposer** un `.skanpack` sur la fenêtre, ou le **double-cliquer dans le Finder**. **Cmd+K** cherche un client ou lance une action.

### Le calendrier des échéances

Nouvelle page **Échéances**. Une liste de dates, un comptable en a déjà une ; ce que personne ne fait pour lui, c'est **rattacher chaque échéance aux paquets qu'il n'a pas reçus** : « TVA d'août, à déposer le 28 septembre — douze clients concernés, trois ne t'ont rien envoyé, voilà lesquels. »

- Calculé à partir de la **périodicité de TVA** de chaque client (mensuelle, trimestrielle, non assujetti), sur trois mois en arrière et trois en avant.
- Chaque échéance compte les clients **prêts**, ceux dont le mois est encore **provisoire**, et ceux dont il **manque**, avec leurs noms et un lien vers les relances.
- La ligne remonte dans « À faire » quand l'échéance approche **et** que des pièces manquent. Une échéance proche mais complète n'a pas à crier.
- **Aucune de ces dates ne fait foi** : elles suivent l'usage tunisien (TVA le 28, CNSS le 15 du mois suivant), elles sont réglables, et l'écran écrit « À VÉRIFIER » — les délais dépendent de la forme juridique, du régime et de la loi de finances. Un réglage aberrant retombe sur l'usage plutôt que de faire disparaître l'échéance.
- SkanFact ne sait pas ce qui a réellement été déposé, et ne déposera jamais rien : les échéances passées servent à repérer un mois qu'on n'a jamais pu déclarer faute de pièces.

### Les écritures de tous les clients, en un fichier

Nouvelle page **Écritures**. Chaque paquet portait déjà ses écritures en partie double, mais rien ne les rassemblait : pour importer un mois dans son logiciel de production, le comptable devait ouvrir soixante paquets un par un — exactement le travail qu'on prétend lui épargner.

- Un mois, ou un intervalle (« toute l'année »), tous clients confondus, dans **un seul CSV** avec le client, son matricule et le mois devant chaque ligne.
- Les colonnes sont associées **par nom, pas par position** : un client sous une version plus ancienne ou plus récente de SkanFact n'a pas forcément les mêmes, et aligner à l'aveugle mettrait des montants dans la colonne « Tiers » sans que rien ne plante.
- L'écran dit **avant** l'export ce qui sera lu, ce qui est encore provisoire, et quels clients n'ont rien envoyé — plutôt que de le découvrir en rapprochant les comptes.
- Un paquet illisible (scellé par mot de passe, ou trop ancien pour contenir des écritures) **n'échoue pas l'export** : le fichier est écrit avec le reste et le manque est nommé.
- Le lecteur de CSV est un vrai lecteur : point-virgules dans les libellés, guillemets doublés, retours à la ligne dans un champ. Découper sur « ; » aurait été plus court et faux.

### La boîte de réception

À soixante clients, le geste quotidien n'est pas d'importer *un* paquet : c'est d'en importer douze. Enregistrer chaque pièce jointe puis cliquer douze fois sur « Importer », c'est le genre de corvée qui fait abandonner un logiciel.

- Le comptable désigne **un dossier** — celui où sa messagerie range les pièces jointes, un dossier partagé, une clé USB. L'application regarde ce qui est arrivé et le lui dit, en haut de la page Dossiers.
- **Elle n'importe jamais toute seule** : elle propose, il clique. Même règle que la lecture de photo de facture côté entreprise.
- **Elle n'efface jamais rien** : ce sont les pièces de ses clients. « Ignorer » cesse simplement de les proposer.

### Prévenir le client que c'est arrivé

- **Accuser réception** d'un paquet, depuis la fiche du client. Le client envoie son mois et n'entend plus parler de rien : il ne sait ni si c'est arrivé, ni si c'était lisible, ni s'il manquait quelque chose. Le message dit le nombre de pièces reçues, si le mois était clôturé, et **énumère ce qui manque** quand SkanFact l'a signalé. Trois lignes du comptable valent mieux que trois relances du client — et c'est ce qui entretient l'habitude d'envoyer chaque mois.

### Le suivi des relances

- **Chaque relance est enregistrée** : date, moyen (email, téléphone, WhatsApp), mois réclamés, note. Avant, on cliquait « Écrire », le mail partait, et le lundi suivant plus personne ne savait qui avait été relancé.
- **Relance groupée** : douze retardataires, douze messages préparés à la suite, sans revenir à la liste.
- **Le jour de relance existe enfin.** L'aide promettait « Le 10 : la page Dossiers te dit qui n'a rien envoyé » depuis la première version, et rien ne l'implémentait ni ne permettait de le régler.
- **La pastille et la page Relances comptent enfin la même chose.** Elles donnaient deux chiffres différents pour la même question.

### Finitions

- **Le panneau des mises à jour plantait** au moment précis où il devait annoncer qu'une mise à jour était impossible : il appelait une fonction qui n'existe pas dans ce fichier (`h`, copiée de l'app entreprise où elle s'appelle ainsi). Corrigé — et **un test relit désormais tout le code du cabinet pour y traquer les appels à des fonctions inexistantes**, y compris à l'intérieur des gabarits, là où rien ne se voit avant l'exécution.
- **L'application du cabinet a sa propre marque** : ardoise et dossier, comme son icône. Les deux applications portaient la même pastille vert d'eau et, une fois ouvertes, plus rien ne les distinguait.
- **L'écran de mot de passe** a des étiquettes, un bouton « Afficher », un indicateur de solidité — et l'avertissement le plus important de toute l'application (« aucun moyen de le récupérer ») n'est plus la ligne la plus petite et la plus grise de l'écran. Le minimum passe de six à huit caractères.
- **Des bulles « i » partout** (trente champs) et une rubrique Aide réécrite, avec un article « Ne rien perdre ». Un test vérifie que chaque bulle posée a son texte, et qu'aucun texte ne dort sans être affiché.
- Le « ✓ enregistré » s'affiche **à côté** du bouton des Réglages, que le message passager recouvrait.
- **L'assistant du cabinet réutilisait des noms de classes de la feuille de style partagée** (`.setup-step`, réservée au « étape 3 sur 5 » de l'app entreprise, qui interdit le retour à la ligne) : le texte ne revenait pas à la ligne et les boutons sortaient de la fenêtre. Aucune erreur, rien dans la console — le genre de défaut qu'il faut voir pour y croire. Un test interdit désormais qu'une classe propre au cabinet porte un nom déjà pris dans la feuille partagée.
- Les fichiers extraits d'un paquet pour être lus sont **effacés à la fermeture** : ce sont les pièces comptables d'un client, elles n'ont rien à faire dans le dossier temporaire pour toujours.
- La taille et la position de la fenêtre sont mémorisées ; un menu Aide donne accès au journal technique et au dossier de l'application.

## 6.7.3 — 12/09/2026

**SkanFact Cabinet proposait d'installer une version plus ancienne que la sienne.**

Repéré par Skander dès la première vérification réussie : l'application du comptable, en 6.7.2, téléchargeait la **6.7.1**. C'est-à-dire qu'elle proposait de réinstaller un défaut déjà corrigé — et en l'occurrence celui qui cassait justement la mise à jour.

La cause est une ligne du module de mise à jour : **déclarer un canal remet l'autorisation de revenir en arrière**, et l'app du cabinet est la seule à déclarer un canal (le sien, pour ne pas se voir proposer l'application entreprise). C'est écrit dans la documentation d'electron-updater, et c'est voulu chez eux ; chez nous, non. L'interdiction est désormais reposée **après** le canal, dans les deux applications, et un test vérifie l'ordre.

**Essayer une version depuis les sources ne touche plus tes vraies données.** Lancée par `npm start`, l'application s'appelle `skanfact` ; installée, elle s'appelle `SkanFact` — et macOS ne fait aucune différence entre les deux dans un nom de dossier. C'était donc **le même dossier de données** : tester du code non publié se serait fait sur les vraies factures. Le mode développement écrit maintenant dans « SkanFact (essais) », à part.

## 6.7.2 — 12/09/2026

**« Module de mise à jour indisponible. » ne veut rien dire. Maintenant l'application dit pourquoi.**

Signalé par Skander juste après avoir branché le relais : la vérification échouait avec cette phrase, et il n'y avait **rien à faire de cette information** — ni pour lui, ni pour moi à distance. La cause était attrapée par un `catch` qui la jetait à la poubelle.

- **La cause est nommée** dans le message et écrite dans le journal (`main.log`). Une panne qu'on ne peut pas nommer, on ne peut pas la réparer.
- **Un relais mal réglé ne laisse plus l'application sans issue** : elle repasse automatiquement par GitHub avec le jeton, **le dit à l'écran**, et le champ jeton réapparaît. Avant, l'écran continuait d'affirmer « rien à configurer » alors que plus aucune mise à jour n'était possible.
- **L'adresse et le secret du relais sont nettoyés** avant usage : ils se collent à la main dans des formulaires web, où une espace ou un retour à la ligne invisible se glisse sans qu'on le voie. L'adresse est aussi **vérifiée** au démarrage plutôt qu'au premier téléchargement.
- Les deux applications, entreprise et cabinet, sont corrigées pareil.

**Et publier coûte moins cher.** Le quota GitHub d'un mois entier est parti en une matinée : chaque publication construit quatre applications, et les machines macOS sont facturées **dix fois** le tarif des autres.

- **Electron est mis en cache** d'une publication à l'autre (250 Mo par architecture, deux architectures, deux applications — c'était retéléchargé à chaque fois).
- **L'étape de recompilation native est supprimée** : SkanFact n'a aucune dépendance native, elle ne produisait rien.
- **Deux publications lancées coup sur coup ne se paient plus deux fois** : la première est annulée.
- **`Installer SkanFact.command` connaît le relais** : il demande son adresse une fois, la garde dans `relais.local.json` (jamais commité) et construit une application identique à celle de GitHub — sans consommer une minute de quota. Il propose aussi de construire **SkanFact Cabinet** au passage.

**La cause de la panne, confirmée.** Le secret `UPDATE_BASE` du dépôt contenait une **espace en fin** — invisible, et attrapée par un copier-coller d'adresse. L'adresse devenait `https://…workers.dev /app`, que `new URL()` refuse : une espace n'a pas le droit d'exister dans un nom de domaine. L'erreur partait dans le `catch` muet, et il ne restait que « Module de mise à jour indisponible. ». Le `trim()` de cette version l'efface avant usage.

## 6.7.1 — 12/09/2026

**Le jour où tu armes la licence, les comptables ne perdent pas leurs mises à jour.**

Trouvé en installant le relais pour de vrai : le réglage `LICENCE_REQUISE` s'appliquait aux **deux** applications. Or l'application du cabinet est gratuite — elle n'a pas de licence et n'en aura jamais. Le jour où le réglage aurait été activé, tous les comptables auraient cessé de recevoir les mises à jour d'un coup, sans message et sans que personne fasse le lien. Le canal du cabinet est désormais exempté, et un test l'exige.

- Le mode d'emploi du relais est corrigé : la colonne de droite décrivait **ce qu'il faut aller chercher** et se lisait comme un texte à recopier — on a collé la description à la place du jeton.
- Les deux réglages facultatifs de licence sont expliqués : ils n'ont de sens qu'une fois la licence armée, et en mettre un seul des deux fait **refuser** toutes les licences.

## 6.7.0 — 12/09/2026

**Les mises à jour passent par un relais : personne ne peut plus télécharger SkanFact sans y avoir droit.**

Demande de Skander : pouvoir mettre à jour les deux applications sans que le logiciel soit téléchargeable par n'importe qui. Le nœud du problème : une application qui se met à jour toute seule doit atteindre ses fichiers **sans qu'on tape un mot de passe** — donc tout ce qu'elle peut atteindre, un inconnu le peut aussi. La solution est de déplacer le secret.

- **Un petit relais** (`worker/`, une trentaine de lignes, hébergement gratuit) se met entre les applications et le dépôt privé. **C'est lui** qui détient le jeton GitHub ; les applications ne l'ont jamais.
- **Un inconnu est refusé** : sans le secret de l'application, le relais répond « Accès refusé » avant même de regarder ce qui est demandé. Le code source, lui, n'est jamais servi — le relais ne connaît que les fichiers d'installation.
- **Une licence inventée est refusée** : sa signature est vérifiée par le relais aussi. En revanche une licence **expirée** reçoit quand même les corrections : on ne prend pas les gens en otage.
- **Chaque application a son canal**, et ne peut pas réclamer les fichiers de l'autre.
- **Plus aucun jeton à saisir** : le champ disparaît des réglages des deux applications quand le relais est en place.
- **Rien ne casse si le relais n'est pas déployé** : sans ses réglages, les applications fonctionnent exactement comme avant, avec le jeton collé à la main.

*Ce qu'il reste à faire, côté Skander : créer le compte Cloudflare et coller le relais — dix minutes, sans terminal, tout est écrit dans `worker/README.md`.*

*Au passage : un test asynchrone dont on n'attendait pas le résultat affichait « ok » sans rien vérifier. Le harnais de test refuse désormais de laisser passer ce cas.*

## 6.6.0 — 12/09/2026

**SkanFact Cabinet se met à jour tout seul.**

Demandé par Skander : « il faut faciliter la mise à jour de l'app cabinet, comme sur SkanFact, que je ne sois pas obligé de la retélécharger ». C'est fait — **Réglages → Mises à jour** dans l'application du comptable : vérification au démarrage, téléchargement automatique, un bouton « Installer et redémarrer », et une pastille dans la barre de gauche quand une version est prête.

- **Les deux applications portent désormais le même numéro de version.** SkanFact 6.6.0 et SkanFact Cabinet 6.6.0 sortent ensemble, dans la même release. C'est ce qui rend la mise à jour automatique possible, et ça permet à un comptable et à son client de comparer leurs versions d'un coup d'œil.
- **Chacune a son propre canal.** Le fichier de mise à jour porte un nom fixe (`latest.yml`) : deux applications dans une même release se le seraient écrasé, et chacune aurait proposé à ses utilisateurs la version de l'autre. Le cabinet a donc `cabinet.yml`.
- **macOS** : comme SkanFact, l'application se ferme, se remplace dans le dossier Applications et se relance toute seule (le certificat Apple n'est toujours pas acheté).

**Une dernière fois à la main.** La version que tu as déjà installée (Cabinet 1.1.x) ne sait pas encore se mettre à jour : télécharge **SkanFact Cabinet 6.6.0** depuis la page des versions. À partir de celle-là, tu ne retéléchargeras plus rien.

*À VÉRIFIER côté distribution : le dépôt étant privé, l'app cabinet demande un jeton d'accès, exactement comme SkanFact. Le jour où les installeurs seront publiés dans un dépôt public, ce champ disparaîtra pour les cabinets.*

## 6.5.4 — 12/09/2026

**SkanFact Cabinet 1.2.0 : l'exemple était introuvable.**

Signalé par Skander dès la première ouverture : « l'appli est vide, il me manque le jeu de données ». Les cinq dossiers d'exemple existaient depuis la 1.0.0 — mais le bouton pour les charger était une phrase en gras au milieu d'un cadre pointillé, sans bordure ni couleur. Personne ne pouvait deviner que c'était un bouton.

- **L'écran d'ouverture est refait** : deux vrais boutons côte à côte, « Importer un paquet… » et « Voir un exemple (5 clients fictifs) », avec ce que l'exemple contient et les trois étapes par lesquelles un paquet arrive jusque-là.
- **L'exemple se charge aussi depuis Réglages**, à l'endroit où on va le chercher quand on ne l'a pas trouvé ailleurs — comme « Charger la démo » dans SkanFact.
- Au passage : un cabinet sans aucun dossier n'affiche plus « Tout est à jour : tous tes dossiers ont envoyé leurs mois clôturés », ni une recherche, ni un filtre, ni « 0 sur 0 ». Il n'y a rien à chercher dans rien.

## 6.5.3 — 12/09/2026

**SkanFact Cabinet 1.1.2** : à la taille minimale de la fenêtre (960 px), un nom de client comme « Café des Jasmins » se coupait en trois lignes dans la liste des dossiers et dans les relances. Les noms, les emails et les en-têtes ne se coupent plus ; le tableau défile horizontalement, ce qui est fait pour ça.

## 6.5.2 — 12/09/2026

**Deux petites choses qui disaient faux.**

- **Écritures, sur un mois sans pièce** : la page annonçait « débit = crédit, le fichier passera à l'import » alors qu'il n'y avait rien à exporter. Elle dit maintenant qu'il n'y a aucune pièce sur la période, et les deux boutons d'export sont éteints.
- **SkanFact Cabinet 1.1.1** : le compte des pièces vérifiées était inférieur d'une unité à la réalité (« 7 pièces vérifiées » pour 8). C'est la seule affirmation rigoureuse de l'application cabinet — « ce que j'ai reçu est exactement ce qui a été envoyé » — donc elle doit compter juste. La règle du comptage vit désormais dans la partie testable, avec son test : un fichier absent n'est pas un fichier vérifié, et le manifeste ne se compte pas lui-même.

## 6.5.1 — 12/09/2026

**Le chien de garde laisse la place aux outils de développement.**

Un seul programme peut inspecter la page à la fois. Le chien de garde (6.5.0) occupait cette place en permanence : ouvrir les outils de développement (menu Affichage) aurait échoué, ou l'aurait débranché en silence — ce qui est pire, puisqu'on aurait cru être surveillé sans l'être. Il s'efface maintenant tant que les outils sont ouverts, et reprend son poste dès qu'ils se referment.

## 6.5.0 — 12/09/2026

**Un gel devient un rapport. Et SkanFact redémarre tout seul.**

Le pire défaut d'un logiciel n'est pas celui qui plante : c'est celui qui **fige**. Rien ne s'affiche, aucune erreur n'est écrite, les journaux restent vides — et devant l'écran, personne n'a rien à envoyer pour se faire aider. C'est exactement ce qui s'est passé avec la 5.1.0, et ce qui a coûté une soirée entière à retrouver.

- **SkanFact se surveille lui-même.** Toutes les trois secondes, il vérifie que son interface répond. Après une douzaine de secondes de silence, il note **où le programme s'est arrêté** — le nom de la fonction fautive, ligne comprise — interrompt ce qui tourne en boucle, et recharge.
- **Il le dit après coup.** Un redémarrage silencieux ferait douter de ce qui a été enregistré : l'application explique ce qui s'est passé et rappelle que les données enregistrées sont intactes.
- **Aide → Signaler un problème** prépare le message : ta description, la version, ton système, et le journal technique. **Aucune donnée de ton entreprise** — ni client, ni montant, ni document — et un bouton pour lire le journal avant d'envoyer.
- Nouvel article d'aide « Si quelque chose ne va pas ».

*Vérifié pour de vrai : un test gèle volontairement l'application avec une boucle infinie ; le chien de garde réagit en 13 secondes, nomme la fonction coupable dans le journal, et l'application repart.*

## 6.4.0 — 12/09/2026

**La licence — écrite pour ne pas te gêner.**

SkanFact est un logiciel payant, et sa licence a été conçue en partant d'une question : qu'est-ce qui serait insupportable à la place de l'utilisateur ?

- **Aucune connexion.** La clé est vérifiée sur ton ordinateur par signature électronique (Ed25519). Elle n'est envoyée nulle part, il n'y a aucun compte à créer, et l'application fonctionne sans internet. Si demain SkanFact n'existait plus, ton application continuerait de tourner.
- **Jamais tes données en otage.** Une licence expirée ne ferme rien de ce que tu as déjà : lire, imprimer, exporter, sauvegarder, envoyer le paquet au comptable — tout reste ouvert. Seule la **création de nouvelles pièces** attend le renouvellement.
- **30 jours d'essai complets**, et un rappel une semaine avant la fin.
- **La remise de parrainage automatique** : si ton comptable t'a remis son fichier d'appairage, l'empreinte de son cabinet part avec ta demande de licence.
- Nouvel onglet **Paramètres → Licence** et article d'aide « La licence ».

*Cette version est livrée **sans licence exigée** : la machinerie est là, elle ne verrouille rien tant que le propriétaire ne l'a pas armée. Un logiciel qui se verrouillerait tout seul à l'installation serait un défaut, pas une licence.*

## 6.3.0 — 12/09/2026

**Les écritures comptables : ton comptable n'a plus rien à retaper.**

Nouvel onglet **Comptabilité → Écritures**. Chaque facture, chaque avoir, chaque achat, chaque règlement et chaque bulletin de paie y devient un jeu d'écritures en **partie double** — autant au débit qu'au crédit — prêt à importer dans le logiciel de ton cabinet. C'est le travail qu'un comptable fait aujourd'hui pièce par pièce, à la main.

- **Un contrôle avant d'envoyer** : l'application vérifie que chaque pièce tombe juste. Un fichier déséquilibré serait refusé à l'import ; tu le sais avant lui.
- **Un plan de comptes modifiable.** Les numéros proposés suivent l'usage du plan comptable tunisien, mais chaque cabinet a les siens : demande-lui les bons une fois, saisis-les, et tous tes envois suivants sont à son format. *À VÉRIFIER avec ton comptable — aucun numéro de compte n'est une vérité.*
- **Le fichier part avec le paquet mensuel** (`journaux/ecritures.csv`), et la page de garde annonce le nombre de lignes et l'équilibre.
- Export CSV et envoi direct au comptable depuis la page.
- Les avoirs s'écrivent à l'envers d'une facture, **en changeant de colonne** : aucun logiciel comptable n'accepte un montant négatif.

**SkanFact Cabinet 1.1.0** : les écritures reçues apparaissent dans le contenu du paquet, à ouvrir d'un clic.

## 6.2.1 — 12/09/2026

**SkanFact Cabinet 1.0.0 : l'application de ton comptable.**

Elle est jointe à cette version, sous le même lien de téléchargement, et elle est **gratuite**. Ton comptable l'installe, te remet son fichier d'appairage, et reçoit tes paquets sans rien avoir à retenir.

Ce qu'elle lui donne :

- **Un écran qui répond à sa vraie question** : lequel de ses clients ne lui a pas envoyé son mois. Les dossiers en retard passent devant, mois par mois, en rouge, orange ou vert.
- **L'import d'un paquet en un clic** : chaque empreinte du manifeste est recalculée, donc il peut affirmer que ce qu'il a reçu est exactement ce que tu as envoyé. Un mois renvoyé n'est pas une erreur : l'application le lui dit, et le prévient si celui qu'il remplace était définitif.
- **Les relances écrites pour lui**, qui nomment les mois manquants — un message qui dit « il me manque juin, juillet et août » fait bouger, « envoie-moi tes documents » non.
- **Ses dossiers chiffrés sur son poste** : son fichier contient la clé qui ouvre tes paquets, donc il est protégé par un mot de passe obligatoire, AES-256. Ni nous ni personne ne peut le reconstituer.
- **Un exemple fictif** au premier lancement, pour voir à quoi ressemble l'application pleine ; il s'efface au premier vrai paquet.

**Et ce qu'elle ne fait pas, volontairement** : elle ne modifie jamais tes données, ne t'envoie rien, et ne dépose aucune déclaration. Une correction se demande, elle ne s'impose pas — sinon deux versions de tes comptes coexistent et plus personne ne sait laquelle fait foi.

*Côté SkanFact : Paramètres → Cabinet comptable dit maintenant où trouver l'application quand ton comptable ne l'a pas encore.*

## 6.2.0 — 12/09/2026

**Appairer ton cabinet : plus de mot de passe à transmettre.**

Un mot de passe partagé a deux défauts : il se transmet, donc il finit par fuiter ; et c'est le même pour tous les clients d'un cabinet. Désormais, ton comptable te remet **un fichier d'appairage** contenant sa clé publique. Tu l'importes une fois dans **Paramètres → Cabinet comptable**, et chaque paquet mensuel est chiffré **pour lui seul**.

- **Rien à retenir, rien à échanger.** Le fichier d'appairage ne contient rien de secret : une clé publique ne permet que de chiffrer à destination de quelqu'un, jamais de lire ce qu'il reçoit. Même volé, il ne donne accès à aucun paquet.
- **Une empreinte de vingt caractères** à vérifier de vive voix la première fois. C'est la seule façon d'être sûr que la clé reçue est bien celle de ton comptable, et pas celle de quelqu'un qui se serait glissé entre vous.
- **Une clé de chiffrement différente à chaque paquet** : deux envois du même mois ne produisent jamais deux fichiers identiques.
- **L'entête reste lisible sans déchiffrer** — ton nom, le mois, le cabinet destinataire — pour qu'un paquet mal rangé reste identifiable.
- Le mot de passe reste disponible pour les comptables qui n'utilisent pas encore SkanFact Cabinet.

*Technique : X25519 pour l'échange de clés, HKDF-SHA256 pour la dérivation, AES-256-GCM pour le contenu. Aucune bibliothèque ajoutée.*

## 6.1.0 — 12/09/2026

**Le mois de ton comptable, en un fichier.**

Nouvel onglet **Comptabilité → Cabinet**. Tu choisis un mois, tu vois exactement ce qui partira, tu fabriques le paquet, tu l'envoies.

Ce que contient un paquet :

- **Une page de garde** en PDF : le mois en chiffres, l'inventaire du paquet, et **la liste de ce qui manque** — un brouillon oublié, un achat sans justificatif, un mouvement non pointé, une attestation de retenue non remise.
- **Les journaux en CSV** : ventes, achats, encaissements, règlements fournisseurs, trésorerie. Les mêmes colonnes que l'export manuel — une seule définition, pour que deux exports du même mois ne se contredisent jamais.
- **La TVA du mois**, crédit reporté compris.
- **Le PDF de chaque facture et avoir émis**, les **justificatifs d'achat** joints, les **bulletins de paie**, et la **déclaration CNSS** quand le trimestre se termine.
- **Un manifeste** qui liste chaque fichier avec son empreinte SHA-256.

Les choix qui comptent :

- **C'est une archive ZIP ordinaire.** Ton comptable la renomme en `.zip` et l'ouvre avec le Finder ou l'Explorateur, sans rien installer, même si SkanFact disparaît. Écrite sans aucune bibliothèque ajoutée : le paquet comptable de quelqu'un d'autre ne doit jamais dépendre de nous.
- **Provisoire tant que le mois n'est pas clôturé**, et c'est écrit en toutes lettres sur la page de garde. Un paquet définitif suit la clôture (6.0.0).
- **Mot de passe optionnel** (AES-256) : le paquet contient tes factures et les salaires de tes employés. L'entête reste lisible sans le mot de passe — ton nom et le mois — pour qu'un paquet mal rangé reste identifiable. Le mot de passe se transmet **par un autre canal que le fichier**.
- **Un justificatif disparu du disque ne fait pas échouer l'envoi** : le paquet part sans lui et le manifeste dit lequel manque. Mieux vaut un dossier à 99 % avec le trou signalé qu'un envoi qui échoue.
- **L'empreinte prouve que rien n'a bougé** entre l'envoi et la réception. Elle figure dans l'historique des envois et dans le mail préparé.

Nouvel article d'aide « Envoyer le mois à ton comptable ».

*Données : `packs` (l'historique des envois). Rien à convertir.*

## 6.0.0 — 12/09/2026

**Clôturer un mois : lui promettre qu'il ne bougera plus.**

Voici ce qui se passait sans ça. Tu déclares la TVA de mars. Trois semaines plus tard, tu retrouves une facture d'achat de mars au fond d'un tiroir et tu la saisis à sa vraie date. La TVA de mars vient de changer. Ton comptable a déclaré l'ancien chiffre, personne ne le sait, et vous le découvrirez peut-être des années plus tard, pendant un contrôle.

Nouvel onglet **Comptabilité → Clôtures**.

- **Clôturer un mois le fige.** Après ça, aucune pièce datée de ce mois ne peut plus être créée, modifiée ou supprimée : ni facture, ni devis, ni achat, ni paiement client ou fournisseur, ni mouvement de trésorerie, ni bulletin de paie, ni congé, ni avance, ni mouvement de stock, ni immobilisation, ni cession. Déplacer une pièce *hors* d'un mois clos est refusé aussi — sinon il suffirait de changer une date pour contourner la clôture.
- **Avant de clôturer, l'application montre ce qui mérite d'être réglé** : une facture restée en brouillon, un achat sans justificatif, un mouvement non pointé, un bulletin manquant, un stock négatif, un écart de numéros de série. **Rien de tout cela ne bloque** : ces points sont là pour que tu les voies. Un mois clôturé avec deux manques signalés vaut mieux qu'un mois jamais clôturé.
- **Rouvrir reste possible**, avec un motif obligatoire, et c'est inscrit dans un journal qui garde qui, quand et pourquoi. C'est la ligne qu'on relit le jour où un chiffre a bougé après un envoi.
- **« À faire » réclame les mois terminés depuis dix jours** et jamais clôturés — dix jours, parce qu'avant ça il manque toujours une facture d'achat qui arrive par la poste.
- Les contrats récurrents **sautent** les échéances tombées dans un mois clos plutôt que d'y créer une facture, et le disent.
- Charger la démonstration, importer un fichier ou tout effacer **prévient** quand des périodes sont clôturées : ce que ton comptable a reçu ne correspondra plus.
- Nouvel article d'aide « Clôturer un mois ».

**Deux fautes trouvées en chemin, corrigées :**

- **Émettre une facture consommait le numéro avant d'enregistrer.** Si l'enregistrement échouait ensuite, le numéro était perdu et la série trouée. Le contrôle passe désormais avant.
- **Exporter en PDF un brouillon ignorait l'échec de l'enregistrement** et exportait un document qui n'avait pas été écrit.

*Données : `closedUntil` et `closureLog`. Rien à convertir — un dossier existant n'a simplement rien de clôturé, et tu clôtures quand tu veux.*

## 5.2.3 — 12/09/2026

**Le gel au chargement de la démo est corrigé — et il cachait un défaut plus ancien sur toutes les dates.**

Sur un ordinateur réglé sur l'heure de Tunis (ou tout fuseau à l'est de Greenwich), la fonction qui ajoute des jours à une date construisait la date en heure locale et la relisait en heure universelle. À minuit à Tunis, il est encore 23 h la veille en temps universel : le jour retombait. Conséquences, silencieuses depuis toujours :

- **Les échéances calculées par l'app tombaient un jour trop tôt** (délai de paiement, validité d'un devis, rappels). Une facture à 30 jours affichait 29. Les documents déjà émis gardent la date qui y est imprimée ; les prochains seront justes.
- **Depuis la 5.1.0, l'app gelait complètement** dès qu'un calcul de jours ouvrables entrait en jeu — par exemple en chargeant le jeu de démonstration, qui contient des congés. La fonction avançait jour par jour vers une date qu'elle n'atteignait jamais : boucle infinie, plus aucun clic, Cmd+Q sans effet, et rien dans aucun journal puisque rien ne « plantait ».

Ce défaut ne se voyait pas sur la machine de test, réglée en temps universel, où le décalage est nul. Il a fallu quatre versions rétrogradées à la main par Skander pour le cerner — merci à lui.

- Toute l'arithmétique de dates travaille désormais en temps universel pur, sur le jour du calendrier, sans jamais passer par l'heure locale. « Aujourd'hui » reste le jour du calendrier de l'utilisateur.
- Le calcul des jours ouvrables ne peut plus boucler, quelle que soit la saisie.
- Un test rejoue désormais ces calculs sous cinq fuseaux horaires (Tunis, Greenwich, Los Angeles, Kiritimati, Calcutta) à chaque vérification.

## 5.2.2 — 11/09/2026

**Le bouton qui ne répondait pas est corrigé.**

Une fenêtre de confirmation ouverte depuis l'assistant de première utilisation s'affichait *derrière* lui. Ses boutons étaient parfaitement visibles, mais les clics atterrissaient sur l'écran du dessus : « Passer » et « Annuler » semblaient morts, et en insistant très fort on finissait par tomber sur un endroit où le bouton passait devant. Le curseur qui change de forme d'un pixel à l'autre venait de là aussi. Aucune erreur n'apparaissait dans la console, puisque techniquement rien ne plantait.

- **Les fenêtres de confirmation passent maintenant au-dessus de tout** : assistant de première utilisation, écran de verrouillage, recherche rapide. Les bulles d'aide et les messages restent lisibles par-dessus elles. Un test vérifie cet ordre à chaque version.
- Ce défaut existait depuis longtemps — il fallait passer l'assistant ou créer un second dossier pour le rencontrer.

Corrigés en même temps, trouvés en cherchant celui-là :

- **Une question fermée par Échap ou par un clic à côté ne répondait jamais.** La promesse restait en suspens indéfiniment et bloquait tout ce qui l'attendait, sans la moindre erreur visible. Elle vaut « Annuler » désormais.
- **Le routeur pouvait empiler plusieurs questions** « Modifications non enregistrées » l'une sur l'autre. Une seule à la fois.
- **Le drapeau interne du routeur pouvait rester armé à vide** et avaler la navigation suivante, quand l'adresse à restaurer était déjà l'adresse courante. Même piège que sur le bouton « Précédent », qui s'en gardait déjà.
- **Importer un fichier n'enregistrait pas** : quitter l'application juste après un import reperdait le fichier importé. Charger la démo, importer ou tout effacer désarment maintenant le garde-fou, qui réclamait sinon d'enregistrer des modifications volontairement remplacées.

## 5.2.1 — 11/09/2026

Les huit défauts relevés par l'audit du 11/09/2026 et laissés de côté depuis, corrigés d'un coup.

- **Choisir un logo ou un cachet n'efface plus ce que tu venais de taper** dans Paramètres. Les autres champs sont enregistrés avant que la page ne se redessine.
- **Recherche ajoutée aux deux dernières pages de liste qui n'en avaient pas** : Relances (n°, client, objet) et Comptabilité (journal des ventes et journal des achats). Quand une recherche est active, on te dit clairement que les totaux ne portent que sur la sélection.
- **Un modèle de document se modifie enfin** : objet, notes, remise, et surtout ses lignes, ajoutables depuis le catalogue. Jusqu'ici seul son nom était changeable, alors que les deux autres onglets du Catalogue avaient « Modifier ».
- **La suppression est au même endroit partout** : dans la fenêtre de modification, jamais sur la ligne de la liste. C'est là qu'on voit ce qu'on supprime — et la confirmation dit désormais ce qui est rattaché (documents portant une prestation, factures issues d'un contrat, stock restant).
- **Les notes internes d'un client** disent qu'elles s'enregistrent toutes seules, et le montrent (« ✓ enregistré »). Elles le faisaient déjà en silence, alors que la fenêtre de modification, elle, attend « Enregistrer ».
- **Clients et Catalogue ont leur pied de tableau totalisé**, comme les listes de documents : nombre, facturé, reste à payer d'un côté ; prix moyen et valeur du stock de l'autre. Les totaux portent sur toute la sélection, jamais sur la page affichée.
- **Sur une installation neuve, « Documents récents » propose par où commencer** au lieu d'afficher « Aucun document. » : créer un client, créer un devis, remplir le catalogue, ou charger l'exemple.
- **Les boutons de ligne restent visibles** sur Clients et sur les listes de documents, en retrait, et reprennent leur pleine opacité au survol. Cachés jusqu'au survol, ils étaient introuvables alors qu'ils étaient toujours affichés partout ailleurs.

## 5.2.0 — 11/09/2026

La CNSS ne relance pas : elle pénalise. Nouvel onglet **Déclarations** dans la page Paie.

**Déclaration CNSS trimestrielle**
- Un salarié par ligne : assiette du trimestre, part salarié déjà retenue, part employeur, accident du travail
- Le total est ce que tu verses à la CNSS, les deux parts confondues
- Un matricule CNSS manquant est signalé : la déclaration ne peut pas partir sans lui
- Export CSV et envoi au comptable en un clic, pièce jointe comprise
- Échéance usuelle : le 15 du mois suivant la fin du trimestre — *à VÉRIFIER*

**Déclaration annuelle d'employeur**
- Les **salaires versés** : brut annuel, CNSS retenue, IRPP retenu, solidarité, net versé, par salarié
- Les **retenues à la source pratiquées sur des fournisseurs** (honoraires, loyers) — l'autre moitié du formulaire, celle qu'on oublie
- Les **attestations de retenue non remises** sont comptées : sans elles, ton fournisseur ne peut pas déduire ce que tu lui as retenu
- Export CSV

**Les rappels**
- Dès qu'un salarié existe, l'échéance CNSS s'allume d'elle-même dans le calendrier fiscal
- Les déclarations dues remontent dans « À faire », en rouge si l'échéance est passée
- « Marquer déposée » fait taire le rappel — c'est un pense-bête, pas un accusé de réception

**SkanFact ne dépose rien** et ne se connecte à aucune administration. Il prépare le tableau, rappelle la date, et te laisse recopier ou envoyer. Une application qui déposerait à ta place se tromperait un jour sans que tu le saches.

Nouvel article d'aide « Les déclarations sociales ». *À VÉRIFIER avec ton comptable : la forme des formulaires, les dates, les modalités de dépôt et les exonérations liées aux contrats SIVP et Karama.*

## 5.1.0 — 11/09/2026

La paie savait calculer un bulletin. Elle sait maintenant d'où viennent les absences et les retenues.

**Congés et absences** (nouvel onglet de la page Paie)
- Compteur par salarié : **acquis au prorata des mois travaillés**, reporté, pris, solde
- Six natures : congé payé, arrêt maladie, maternité, autorisation, sans solde, injustifiée — chacune avec son effet habituel sur le salaire, forçable au cas par cas
- Une absence **à cheval sur deux mois se répartit toute seule** entre les deux bulletins
- Un solde négatif est signalé sans être interdit : avancer des congés arrive, mais il faut le savoir
- Le droit annuel (18 jours ouvrables par défaut) se règle dans les Barèmes — *à VÉRIFIER : la convention collective de ton secteur peut prévoir davantage*

**Avances sur salaire** (nouvel onglet)
- Somme prêtée, retenue mensuelle, durée de remboursement annoncée avant d'enregistrer
- Avertissement si la retenue dépasse le tiers du net — *à VÉRIFIER : la loi encadre la part saisissable*
- La retenue se pose toute seule sur chaque bulletin jusqu'à extinction, la dernière échéance ne prenant que ce qui reste
- Ce qui est remboursé se lit **sur les bulletins eux-mêmes**, pas sur un compteur à part : supprimer une avance ne défait pas les retenues déjà passées

**Les bulletins se remplissent tout seuls** — établir les bulletins du mois reprend désormais les absences non payées et les échéances d'avance, sans ressaisie.

**Documents du personnel** — attestation de travail (avec ou sans le salaire, qui n'y figure que si tu le demandes), certificat de travail, solde de tout compte avec l'indemnité de congés non pris pré-calculée. PDF au même format que tes factures, prêts à signer.

**Registre du personnel** — la liste que l'inspection du travail peut demander, salariés partis compris, exportable en CSV.

Sur la fiche d'un salarié : ses compteurs de congés, ses avances, ses absences de l'année et un bouton pour établir un document.

Données : `leaves` et `advances`. Aucune conversion. Nouvel article d'aide « Congés, absences et papiers du personnel ».

## 5.0.0 — 11/09/2026

Embaucher, c'est le moment où la gestion cesse d'être un confort. Nouvelle page **Paie** (barre latérale, groupe Gestion), en trois onglets.

**Aucun taux n'est écrit en dur.** C'est le point le plus important. CNSS, impôt sur le revenu, contribution de solidarité, frais professionnels, déductions familiales, tranches du barème : tout se lit dans l'onglet **Barèmes**, et rien ne se calcule ailleurs. Les valeurs livrées sont celles couramment appliquées en Tunisie au moment de cette version — *elles changent à chaque loi de finances.* Quand un taux bouge, tu le corriges, et **les bulletins déjà établis gardent leur propre calcul** : un barème modifié ne réécrit jamais un bulletin déjà remis.

**Salariés** — fiche par personne : identité, CIN, matricule CNSS, contrat (CDI, CDD, SIVP, Karama, stage), date d'embauche et de sortie, brut mensuel, situation familiale. Le net estimé et le coût employeur s'affichent pendant la saisie. On ne supprime jamais un salarié qui a été payé : on renseigne sa date de sortie.

**Bulletins**
- Un bouton établit **tous les bulletins manquants du mois** d'un coup, au brut de chaque fiche
- Primes imposables ou non, retenues, jours d'absence au prorata
- **PDF au même standard que tes factures**, tenant sur une page : identité, période, détail des cotisations part salarié et part employeur, net à payer, cumuls de l'année, coût employeur
- Une mention imprimée invite le comptable à valider les premiers bulletins
- Un salarié actif sans bulletin remonte dans « À faire »

**Barèmes** — les cotisations, l'impôt et le barème progressif, avec un tableau qui montre en direct ce que ça donne sur quatre salaires courants. Le barème est **progressif par tranches** : gagner un dinar de plus ne fait jamais perdre d'argent.

**Ce qu'un salarié coûte vraiment** — ni son net, ni son brut, mais le **coût employeur** : brut plus charges patronales. C'est lui qui entre désormais dans **Comptabilité → Résultat simplifié** et dans les **charges fixes** du seuil de rentabilité. Les salaires tombent le mois où tu ne vends rien.

**Le piège du double compte** — un bulletin marqué payé sort l'argent tout seul dans la trésorerie. Ne saisis pas en plus un mouvement libre « Salaires » : il compterait deux fois. Si les deux existent, SkanFact le signale dans « À faire ».

**Données v6** : `employees`, `payslips`, `payrollSettings`, plus le matricule CNSS employeur dans la fiche société. Aucune conversion.

Nouvel article d'aide « Payer quelqu'un » et une bulle « i » sur chaque notion. *À VÉRIFIER avec ton comptable : tous les taux, toutes les durées, et le traitement des contrats SIVP et Karama, qui peuvent être exonérés de certaines charges.*

## 4.2.0 — 11/09/2026

Photographier une facture fournisseur au lieu de la saisir. **Éteint par défaut**, et pour de bonnes raisons.

**Sans clé, rien ne quitte ton ordinateur**
- Le bouton « Depuis une photo… » de l'écran d'achat marche quand même : il joint la photo comme justificatif, et tu saisis à la main
- C'est le fonctionnement normal, hors ligne, et il n'expire jamais

**Avec une clé, que tu actives toi-même** (Paramètres → Mises à jour → Lecture de factures)
- Seule l'**image** de la facture est envoyée, au moment où tu cliques. Ni tes clients, ni tes chiffres, ni ta comptabilité
- Confirmation demandée à chaque facture, avec le nom du fichier et sa taille
- La clé est stockée sur cet ordinateur, dans un fichier à part : jamais dans tes données, jamais dans une sauvegarde, jamais dans un dossier partagé
- Désactivation et effacement de la clé d'un clic
- Quelques centimes par facture, facturés par le fournisseur de la clé

**L'application ne remplit jamais toute seule.** Ce qui a été lu passe par une fenêtre de vérification qui signale :
- le **fournisseur inconnu** (reconnu par matricule fiscal, à défaut par nom — jamais créé automatiquement, sinon la liste se remplit de doublons) ;
- l'**écart** entre le total des lignes et le total imprimé sur la pièce ;
- le **numéro de facture manquant**, sans lequel la TVA n'est pas déductible ;
- une **date dans le futur**.

Les lignes arrivent toutes en destination « charge » : c'est à toi de dire ce qui est de la marchandise ou du matériel. Une erreur de lecture sur une quantité fausserait tout le stock.

Nombres reconnus dans tous les formats (1 234,56 · 1.234,56 · 1,234.56), dates tunisiennes JJ/MM/AAAA converties, taux de TVA farfelu ramené à 19 %. Photo ou PDF, jusqu'à 10 Mo.

Quand ça échoue — pas d'internet, clé épuisée, photo floue — SkanFact le dit en clair et propose de joindre la photo et de saisir à la main. L'achat n'est jamais enregistré à moitié.

Nouvel article d'aide « Photographier une facture au lieu de la saisir ».

## 4.1.0 — 11/09/2026

Le stock dit combien il t'en reste. Les numéros de série disent **où ils sont**.

**Suivi unité par unité** — Catalogue → Modifier un article suivi en stock → « Suivre chaque unité par son numéro de série », avec la durée de garantie accordée. Pour du matériel identifiable : serveur, ordinateur, pare-feu. Pas pour des consommables.

**Le cycle d'une unité**
- **Entrée** : Stock → onglet *Numéros de série* → « + Entrée de numéros ». Un numéro par ligne, collage accepté, doublons refusés, rattachement facultatif à la facture d'achat
- **Sortie** : depuis la facture ou le bon de livraison, menu « Plus ▾ » → « Numéros de série livrés ». Tu coches ce qui part vraiment
- Décocher une unité la remet en stock : rien n'est irréversible

**La garantie court de la livraison, pas de ton achat.** C'est la date qui compte pour le client. Une unité encore en stock n'a donc pas de garantie en cours.

**Parc client** — la fiche d'un client montre le matériel qu'il a chez lui, depuis quand, et l'état de sa garantie. C'est la réponse à la question qu'on te posera au téléphone.

**Nouvelle page Garanties** (bouton depuis Stock)
- Ce qui arrive à échéance dans 30, 60, 90, 180 ou 365 jours, et ce qui est déjà hors garantie
- Un bouton « Proposer un contrat » qui ouvre un devis au nom du client
- Une fin de garantie n'est pas une mauvaise nouvelle : c'est le moment naturel de proposer un contrat de maintenance, et le client n'y pense jamais tout seul
- Les échéances remontent aussi dans « À faire » sur l'accueil

**Contrôle de cohérence** — le stock compté en quantité et le stock compté en numéros doivent dire la même chose. Quand ils divergent (trois en stock, un seul numéro disponible), SkanFact le signale : un numéro manque à l'entrée ou à la sortie.

Données : `serials`, plus `serialized` et `warrantyMonths` par article. Aucune conversion. Les numéros entrent dans la fusion d'un dossier partagé.

Nouvel article d'aide « Savoir qui a quoi : numéros de série et garanties » et une bulle « i » sur chaque notion.

## 4.0.0 — 11/09/2026

Tu sais ce que tu vends. Tu sais maintenant ce qu'il te reste sur l'étagère — et ce que ça vaut.

Nouvelle page **Stock** (barre latérale, groupe Gestion), en quatre onglets

**Tu ne saisis rien.** Comme pour la trésorerie, les mouvements sont **déduits** de ce que tu enregistres déjà :
- une ligne de facture d'achat en destination « stock » fait une **entrée** ;
- une facture ou un bon de livraison fait une **sortie** ; un avoir remet la marchandise en stock ;
- devis, proformas, bons de commande et brouillons ne bougent rien — rien n'a quitté l'entrepôt ;
- une facture tirée d'un bon de livraison ne sort pas une seconde fois.

**État du stock** — quantité, emplacement, coût moyen pondéré, valeur, prix de vente, avec recherche et export CSV
**Mouvements** — tout ce qui est entré et sorti, avec le stock restant après chaque ligne, cliquable jusqu'à la pièce d'origine
**Inventaire** — tu tapes ce que tu as compté, SkanFact affiche l'écart et sa valeur. Rien n'est modifié tant que tu ne valides pas, et chaque correction devient un mouvement daté
**Alertes** — d'abord les stocks **négatifs** (tu as vendu ce que tu n'avais pas : un achat manque), puis les ruptures et les articles sous leur seuil

**Mettre un article sous suivi** : Catalogue → Modifier → « Suivi en stock », puis le stock de départ, le seuil d'alerte et l'emplacement. Les prestations ne sont pas concernées — du conseil n'a pas de stock. L'éditeur d'achat prévient quand une ligne « stock » ne correspond à aucun article suivi.

**Un avertissement à l'émission** : émettre une facture ou un bon de livraison qui ferait passer le stock sous zéro affiche lequel, combien il en reste et combien la pièce en sort. La pièce reste émissible — mais tu sais.

**Ce que ça corrige dans tes chiffres** (le plus important, et le moins visible)
- Acheter de la marchandise **n'est plus une charge** : c'est de l'argent transformé en stock, pas dépensé
- La charge apparaît à la **vente**, au coût moyen de ce qui est sorti : le **coût des marchandises vendues**
- Il est affiché dans **Comptabilité → Résultat simplifié** et rangé dans les **charges variables** du seuil de rentabilité
- Le résultat simplifié ne dit donc plus « il manque la variation de stock » : elle y est

**Données v5** : `stockAdjustments`, et quatre champs par article du catalogue (`tracked`, `minStock`, `initialQty`, `initialCost`). Aucune conversion : un article existant n'est pas suivi tant que la case n'est pas cochée. Les mouvements saisis entrent dans la fusion d'un dossier partagé.

Nouvel article d'aide « Tenir son stock sans y passer ses soirées » et une bulle « i » sur chaque notion. *À VÉRIFIER avec ton comptable : la méthode de valorisation retenue pour tes comptes annuels.*

## 3.5.0 — 11/09/2026

Ce que tu achètes et que tu gardes ne se déduit pas d'un coup. Il se déduit un peu chaque année.

Nouvelle page **Immobilisations** (barre latérale, groupe Gestion), en trois onglets

**Tableau des amortissements** — celui que ton comptable te demande à chaque clôture
- Un bien par ligne : valeur, durée, cumul au 1er janvier, dotation de l'année, cumul au 31 décembre, valeur nette comptable
- Amortissement **linéaire au prorata des jours** la première année (base 360) : un bien mis en service le 1er juillet n'est amorti que de moitié cette année-là
- La dernière annuité absorbe les arrondis : la valeur nette comptable tombe exactement à zéro
- Export CSV de l'exercice, prêt à envoyer au comptable
- Fiche par bien : le plan année par année, l'exercice en cours surligné, le lien vers l'achat d'origine

**À immobiliser** — le pont avec les achats
- Toute ligne d'achat marquée « immobilisation » atterrit ici, avec un compteur dans la barre latérale et une ligne dans « À faire »
- SkanFact **ne crée jamais la fiche tout seul** : la durée d'amortissement est une décision, pas une donnée
- Tant qu'une ligne reste en attente, elle n'est déduite **nulle part** — ni en charge, ni en amortissement. C'est dit clairement

**Sorties et cessions**
- Un bien vendu, mis au rebut ou volé sort de l'actif : on l'amortit jusqu'au jour de la sortie
- Plus-value ou moins-value calculée contre la valeur nette comptable de ce jour-là, annoncée avant d'enregistrer
- Une sortie s'annule : l'amortissement reprend comme s'il ne s'était rien passé

**Ce que ça corrige ailleurs**
- **Comptabilité → Résultat simplifié** compte enfin la **dotation aux amortissements**. Sans elle, l'année d'un gros investissement paraissait excellente
- **Marges → Seuil de rentabilité** range la dotation dans les charges fixes : elle tombe que tu vendes ou non
- **Trésorerie** : rien ne change, et c'est normal — un amortissement ne sort aucun argent

Neuf familles proposées avec leur durée usuelle (informatique 3 ans, transport 5, mobilier 10…), toutes modifiables bien par bien. *À VÉRIFIER avec ton comptable : les durées et la règle de prorata dépendent de la nature du bien et du régime.*

Nouvel article d'aide « Ce que tu gardes : les immobilisations » et une bulle « i » sur chaque notion. Données : `assets` (v4, aucune conversion à faire) ; les immobilisations entrent dans la fusion d'un dossier partagé.

## 3.4.0 — 11/09/2026

Tu savais combien tu vends. Tu sais maintenant combien tu gagnes.

Nouvelle page **Marges** (barre latérale, groupe Gestion — Cmd+9), en quatre onglets

**Affaires** — le seul chiffre exact de l'application
- Une **affaire** = un chantier, un projet, un client suivi : tu y rattaches les devis, les factures **et** les factures d'achat
- Vendu, acheté, marge, taux, et « en caisse » (encaissé moins payé) pour chaque affaire
- Fiche d'affaire complète : les ventes et les achats rattachés, cliquables
- Une affaire qui perd de l'argent est signalée en rouge, avec la raison
- Le champ **Affaire** est proposé dans l'éditeur de document et dans l'éditeur d'achat, avec « + Nouvelle affaire » sur place

**Où est la marge** — une année de ventes, par client ou par prestation
- Le plus gros client n'est pas toujours le plus rentable : ça se voit en dix secondes
- Le repère **≈** signale les lignes dont le coût n'est pas connu : leur marge est optimiste, et c'est dit

**Contrats** — ce que chaque contrat récurrent rapporte, au total et par mois
- Un petit contrat qui tourne depuis deux ans vaut souvent mieux qu'une grosse affaire ponctuelle

**Seuil de rentabilité** — le chiffre d'affaires minimum pour couvrir tes charges fixes
- Charges fixes / variables séparées, avec le classement des catégories **que tu choisis toi-même**
- Le montant à l'année, au mois et **au jour ouvré** — c'est celui-là qui parle
- Stock et immobilisations exclus des charges de la période : ils ne sont pas consommés
- *À VÉRIFIER avec ton comptable : le classement fixe/variable dépend de ton activité*

**Ailleurs dans l'app**
- **Coût de revient HT** au catalogue, avec un aperçu de marge en direct pendant la saisie et un avertissement si tu vends à perte
- **Marge estimée** sous les totaux de l'éditeur, dès qu'au moins une ligne a un coût connu
- Nouvel article d'aide « Gagnes-tu vraiment de l'argent ? » et une bulle « i » sur chaque notion
- Données : `projects` et `fixedCategories` (v4, aucune conversion à faire) ; les affaires entrent dans la fusion d'un dossier partagé

## 3.3.0 — 11/09/2026

Tu voyais ce qu'on te doit. Tu vois maintenant ce que tu as.

Nouvelle page **Trésorerie** (barre latérale, groupe Gestion), en quatre onglets

**Où j'en suis**
- **Comptes** : banque, caisse espèces, autant que nécessaire. Tu saisis leur solde de départ, une fois
- **Aucune ressaisie** : les paiements clients et les règlements fournisseurs déjà enregistrés remontent tout seuls
- Disponible aujourd'hui, à encaisser et à décaisser sous 30 jours, solde projeté

**Ce qui arrive** — la prévision à 30, 60, 90 ou 180 jours
- Courbe du solde, échéance par échéance, avec le zéro tracé en rouge
- Seul ce qui est **déjà engagé** est projeté : factures ouvertes, achats à régler, contrats récurrents. Aucune estimation, aucune moyenne
- Une facture **déjà échue** est ramenée à aujourd'hui, pas laissée à sa date passée
- Les échéances fiscales sont listées mais pas chiffrées : SkanFact connaît la date, pas le montant

**Le trou de trésorerie**
- Si la courbe passe sous zéro, la date est affichée en rouge et l'alerte remonte **en tête du panneau « À faire »** de l'accueil
- Il arrive souvent que le solde soit positif au début, positif à la fin, et négatif au milieu. En ne regardant que le total, tu ne le vois pas
- Un trou anticipé se négocie ; un trou constaté se subit

**Mouvements**
- Tout ce qui est entré et sorti cette année, toutes origines confondues, avec entrées, sorties et variation
- **Mouvements libres** pour ce qui n'a ni facture ni achat : salaires, impôts, frais bancaires, échéance d'emprunt, apport, retrait. Tu tapes toujours un montant positif, la nature donne le sens
- Export CSV

**Rapprochement**
- Coche ce que tu retrouves sur ton relevé, recopie son solde final, SkanFact te dit l'écart
- Ce qui reste décoché est soit en cours de traitement, soit oublié, soit une erreur de saisie
- Sans rapprochement, ta trésorerie n'est qu'une opinion

Détails
- Le compteur de la barre latérale ne s'allume **que** pour un trou prévu : une alerte permanente n'alerte plus personne
- Aucune connexion bancaire, aucun identifiant demandé. SkanFact n'a rien à faire avec tes accès bancaires
- Aide : nouvel article « **La trésorerie** », et une bulle « i » sur chaque notion

## 3.2.0 — 11/09/2026

Travailler à deux, et gérer deux entreprises sur le même ordinateur.

**Dossiers** (Paramètres → Sécurité et données)
- Un **dossier = une entreprise** : ses clients, ses documents, ses achats, sa numérotation, ses sauvegardes. Ils ne se mélangent jamais
- On passe de l'un à l'autre en un clic, l'application se recharge sur le bon dossier
- Tes données actuelles sont reprises automatiquement dans un premier dossier. **L'ancien fichier reste en place, intact** : si quelque chose te déplaît, rien n'est perdu
- Retirer un dossier de la liste ne supprime jamais ses fichiers

**Dossier partagé** — deux personnes, une entreprise
- Un dossier posé dans iCloud Drive, OneDrive, un disque réseau, que deux ordinateurs ouvrent tour à tour
- **SkanFact ne laisse plus jamais un poste écraser le travail de l'autre.** Avant d'écrire, il relit le fichier ; si l'autre a enregistré entre-temps, il refuse et fusionne
- **Pièces différentes** (le cas normal) : les deux travaux sont réunis, personne ne perd rien
- **Même pièce des deux côtés** : la version du fichier enregistré en dernier est gardée, on te dit laquelle, et **l'autre est conservée** au lieu d'être jetée
- **Pièce supprimée** : elle ne ressuscite pas, la suppression est mémorisée exprès
- **Compteurs de numérotation** : toujours le plus haut des deux, jamais de numéro réutilisé
- **Numéros en double** : si vous avez émis chacun de votre côté hors ligne, aucun logiciel ne peut deviner lequel garder. SkanFact t'alerte en nommant les pièces. La règle à tenir entre vous : **une seule personne émet les factures** — les brouillons n'ont pas de numéro et ne peuvent pas entrer en conflit
- **Nom du poste** (Paramètres → Ce poste) : les messages disent « les modifications du PC du bureau ont été reprises » plutôt qu'un identifiant technique

Aide
- Nouvel article « **Travailler à deux sur la même entreprise** » : les deux cas, ce qui se répare tout seul, ce qui ne se répare pas, et la bonne façon de s'organiser
- Ce que SkanFact ne fait pas y est dit franchement : pas de serveur, pas de temps réel. Les deux postes se passent un fichier, ils ne se voient pas travailler

## 3.1.0 — 11/09/2026

La soustraction qui manquait : ce que tu collectes moins ce que tu déduis.

La page **Comptabilité** passe en quatre onglets

**Ventes** — le journal des ventes, la TVA par taux et les attestations de retenue, comme avant.

**Achats** — le journal symétrique
- Toutes tes factures fournisseurs et dépenses de la période, avec la part de TVA récupérable
- **« Où part ton argent »** : tes charges regroupées par catégorie, de la plus grosse à la plus petite. C'est souvent une surprise
- Export CSV du journal des achats

**TVA à payer** — le calcul complet
- **TVA collectée sur tes ventes − TVA déductible sur tes achats = ce que tu reverses.** C'est le gain le plus concret de tout le plan
- **Crédit de TVA** : quand tu achètes plus que tu ne vends, la différence n'est pas perdue — elle se reporte automatiquement sur le mois suivant
- **Mois par mois** sur l'année, avec le crédit repris et celui reporté. Le total n'est pas la somme des lignes : un crédit ne se compte qu'une fois
- Le crédit venu de l'année précédente se saisit à la main (SkanFact ne peut pas le deviner sans les données d'avant)
- **Résultat simplifié** : produits moins charges. Les achats partis en stock ou en immobilisation n'y sont pas comptés, parce qu'ils ne sont pas consommés
- *Ces chiffres sont l'arithmétique exacte de tes données, pas une déclaration officielle : à faire valider par ton comptable avant tout dépôt*

**Calendrier fiscal** — un pense-bête
- Six échéances proposées (TVA mensuelle, acomptes provisionnels, TCL, déclaration employeur, déclaration de résultat, CNSS trimestrielle). Tu actives celles qui te concernent et tu ajustes le jour limite
- Les échéances à moins de quinze jours remontent dans **« À faire »** sur l'accueil
- *À VÉRIFIER avec ton comptable : les dates, la périodicité et les déclarations applicables dépendent de ta forme juridique, de ton régime et de la présence de salariés*

Envoi au comptable
- L'email prépare maintenant **plusieurs journaux en pièces jointes** : ventes, achats, encaissements et règlements fournisseurs, un fichier CSV par journal, à cocher

## 3.0.0 — 11/09/2026

L'argent qui sort. Jusqu'ici SkanFact ne connaissait que tes ventes ; il connaît maintenant tes achats.

**Cette version change la structure du fichier de données (version 4).** La migration est automatique
au premier démarrage : rien à faire, rien ne se perd. Une sauvegarde du jour est prise avant, comme
d'habitude. Si tu partages tes données avec une ancienne version de l'app, mets-la à jour aussi.

Fournisseurs (barre latérale, nouveau groupe **Achats**)
- **Fiche fournisseur** comme une fiche client : raison sociale, matricule, contact, RIB, délai de paiement accordé
- Le délai et le taux de retenue se **reportent automatiquement** sur chaque achat que tu saisis chez lui
- Fiche détaillée : acheté HT, reste à payer, part en retard, tous les achats, notes internes

Achats et dépenses
- **Facture d'achat** : le numéro et la date sont ceux du fournisseur, pas les tiens — recopie-les tels quels
- **Dépense** pour tout ce qui n'a pas de facture détaillée : carburant, restaurant, frais bancaires, abonnement
- **Destination de chaque ligne** : charge, stock ou immobilisation. Ce choix ne sert encore à rien aujourd'hui, mais c'est lui qui alimentera le stock et les immobilisations — il est demandé dès maintenant pour t'éviter de tout ressaisir plus tard
- **TVA déductible ligne par ligne** : décochable pour les cas où la loi l'interdit (véhicule de tourisme, cadeaux, réception). *À VÉRIFIER avec ton comptable*
- **Retenue à la source que tu opères** sur un prestataire, et l'attestation que tu lui dois. *À VÉRIFIER avec ton comptable : qui doit retenir, à quel taux*
- **Catégories de charges** : seize proposées, et tu peux en ajouter
- **Règlements fournisseurs** : partiels, par mode, avec référence. Le statut (« à payer », « partiel », « payée », « retard ») en découle et ne se saisit jamais à la main
- **Justificatif joint** à chaque achat : sans lui, ni la charge ni la TVA ne sont récupérables

Panneau **« À payer »** en haut de la page Achats
- Ce que tu dois, à qui, pour quand. Les retards en tête, en orange. Repliable, comme « À faire »

Accueil
- Le panneau « À faire » gagne trois lignes : factures fournisseurs en retard, règlements de la semaine, attestations de retenue à remettre
- Le compteur de la barre latérale signale les achats en retard

Corrigé au passage
- **Changer le client d'un devis ou d'une facture en brouillon** ne reprenait ni son taux de retenue à la source, ni sa langue, ni sa devise : la liste déroulante émettait deux événements et le second annulait le premier. Le même piège aurait touché les fournisseurs

Détails
- Barre latérale regroupée : **Ventes / Achats / Fichiers / Gestion**
- Le jeu de démonstration contient quatre fournisseurs et huit achats couvrant tous les cas
- Aide : nouvel article « **Tes achats et ta TVA déductible** », une bulle « i » sur chaque champ

## 2.6.0 — 11/09/2026

Les quatre pièces qui manquaient autour de la facture, et les pièces jointes.

Nouvelle page **Autres documents** (barre latérale, groupe Ventes), en quatre onglets
- **Facture proforma** (`PRO-`) : annonce un prix ferme sans être une facture. C'est ce que réclament les administrations et les banques pour un dossier de financement. Mention « document sans valeur comptable », pas de timbre par défaut (*À VÉRIFIER avec ton comptable*)
- **Bon de commande** (`BC-`) : ce que le client a commandé, par écrit, avant la livraison et la facture
- **Bon de livraison** (`BL-`) : la pièce qui accompagne la marchandise et se fait signer à la réception. **Les prix y sont masqués par défaut** — le livreur n'a pas à connaître tes tarifs. Une case les rétablit
- **Contrat de prestation** (`CTR-`) : le vrai document que ton client signe, avec sept clauses préremplies (objet, durée, reconduction, préavis, paiement, confidentialité, litiges), toutes modifiables, et deux cases de signature. À ne pas confondre avec les contrats récurrents, qui fabriquent des factures : les deux vont ensemble

Transformer une pièce en une autre
- Nouveau menu **Transformer ▾** en haut de chaque document. Le chemin complet d'une vente : devis → bon de commande → bon de livraison → facture, et proforma → facture
- La pièce créée est toujours un **brouillon** : rien n'est émis sans que tu le relises
- Chaque pièce garde le lien vers celle dont elle vient. L'historique le montre **dans les deux sens** et chaque ligne est cliquable

Pièces jointes
- Sur n'importe quel document : le devis signé scanné, le bon de commande du client, un contrat rendu signé, une photo
- Les fichiers sont **copiés** à côté de tes données : si tu déplaces ou supprimes l'original, la pièce reste attachée
- Elles ne sont pas dans les sauvegardes quotidiennes (un seul fichier texte) mais bien dans la **copie externe** — une raison de plus de la configurer

Détails
- Numérotation propre à chaque type, qui repart à 001 en janvier. Ces pièces restent modifiables après coup : elles n'engagent rien fiscalement, contrairement à une facture émise
- Aucune n'entre dans le chiffre d'affaires, la TVA, le journal des ventes ni les statistiques
- Un gabarit d'email par type, modifiable dans Paramètres → Emails
- Le jeu de démonstration contient un exemple de chaque, dont une chaîne proforma → commande → livraison
- Aide : nouvel article « **Proforma, bons et contrat** », et une bulle « i » sur chaque nouveauté

## 2.5.0 — 11/09/2026

Une page Statistiques, pour décider au lieu de deviner.

Nouvelle page **Statistiques** (barre latérale, groupe Gestion)
- **Période au choix** : année entière, trimestre ou mois. Tout ce qui est affiché suit ce choix
- **Comparaison avec l'an dernier** sur chaque chiffre : la même période l'année précédente, jamais le mois d'avant (comparer janvier à décembre ne veut rien dire)
- **Chiffre d'affaires mois par mois**, avec l'année précédente en gris derrière : les creux qui reviennent chaque année sautent aux yeux
- **Objectif annuel** : donne-toi un chiffre d'affaires à atteindre, la jauge montre où tu en es et où tu devrais en être aujourd'hui, et SkanFact calcule ce qu'il reste à facturer par mois
- **Issue des devis** : acceptés, refusés, expirés sans réponse, en attente — en nombre et en montant, avec le taux d'acceptation et le délai moyen entre le devis et la première facture
- **Âge des impayés** : ce qui reste dû, rangé par ancienneté du retard (pas encore échu, 1-30, 31-60, 61-90, plus de 90 jours). Au-delà de 90 jours, la ligne est signalée
- **Prestations les plus vendues** et **meilleurs clients**, avec un avertissement quand un seul client pèse plus de la moitié du chiffre d'affaires
- **Mouvement des clients** : les nouveaux de la période, et ceux qui se sont endormis (plus rien depuis six mois par défaut) — le fichier le plus rentable à rappeler
- **Qui paie vite, qui paie tard** : le délai moyen constaté client par client, à comparer à ton délai annoncé
- **Export CSV** de toute la page, pour ton comptable ou ton tableur

Réglages
- Paramètres → Documents : **objectif de chiffre d'affaires annuel** et **seuil du client endormi**. Ils ne servent qu'aux statistiques et ne s'impriment nulle part

Aide
- Nouvel article « **Lire tes statistiques** » : ce que chaque chiffre dit, et surtout ce qu'il ne dit pas (ces chiffres portent sur ce que tu as facturé, pas sur ce que tu as gagné : les achats viendront dans une prochaine version)
- Une bulle « i » sur chaque bloc de la page

## 2.4.0 — 11/09/2026

Revenir en arrière, et voir enfin ce que fait un contrat.

Retour en arrière
- **Bouton retour sur chaque sous-page** : l'éditeur de devis et de factures, la fiche client, l'aide. Il dit où il mène (« ← Factures », « ← la fiche client ») au lieu d'une flèche muette
- **Précédent** dans le menu Affichage, raccourci **Cmd+[**
- Le retour depuis l'aide ramène à ce que tu faisais, sans repasser par les articles déjà lus

Contrats
- **Fiche de contrat** : clique sur une ligne de la liste. Tu y trouves ce qu'il facture, à qui, depuis quand, le montant par facture, le total facturé depuis le début et ce qui reste à encaisser
- **Aperçu de la prochaine facture**, exactement comme l'aperçu d'un devis dans l'éditeur : tu vois ce que ton client recevra, mois résolu compris, avant que la facture existe
- **Liste des factures déjà générées** par le contrat, triable et cliquable
- Depuis une facture issue d'un contrat, **un lien vers ce contrat**, dans l'en-tête et dans l'historique. Le rattachement existait dans les données depuis la 1.5.0 et n'était affiché nulle part
- Les lignes d'un contrat ont maintenant une **unité** et une **description**, comme celles d'un document
- « + Nouveau client » dans le formulaire de contrat : plus besoin de sortir pour créer le client

Corrigé
- **Une confirmation ouverte depuis un formulaire détruisait ce formulaire et la saisie en cours.** Un trop-perçu confirmé depuis « Enregistrer un paiement » faisait tout perdre. Les fenêtres s'empilent désormais
- **Fermer la fenêtre avec un document non enregistré le perdait sans un mot.** L'app demande maintenant confirmation
- La pastille « Version prête » ouvrait les Paramètres sur l'onglet Société au lieu des Mises à jour
- Les noms du « Top clients » de l'accueil ne menaient pas à la fiche client
- « Devis expirés » et « devis sans réponse » ouvraient la liste complète au lieu de la liste filtrée
- Les attestations de retenue à réclamer n'ouvraient pas la facture concernée
- « + Avoir » était proposé même sans aucune facture émise, alors que le formulaire ne pouvait pas être rempli
- Le menu « Plus ▾ » s'ouvrait vide sur un avoir émis
- La recherche des contrats ramenait le curseur à la fin à chaque frappe
- Cinq explications « i » déjà écrites n'étaient affichées nulle part (acompte, solde, conversion, contrat, filtre par année)

## 2.3.0 — 11/09/2026

Trois champs qu'on utilise vingt fois par jour, refaits.

Unité
- L'unité d'une ligne se **choisit dans une liste** au lieu de s'écrire : unité, heure, jour, demi-journée, mois, année, forfait, intervention, licence, abonnement, poste, lot, mètre linéaire, mètre carré, mètre cube, kilogramme, litre, kilomètre, page
- **Autre…** pour une unité propre à ton métier. Une fois écrite, elle reste proposée dans toutes tes lignes suivantes
- Même liste dans la fiche d'une prestation du catalogue
- Fini les « j », « J », « jour » et « jours » mélangés dans un même document

Choix du client, de la facture, d'une prestation
- Le client se choisit dans une **liste moderne avec recherche** : tape les premières lettres, la liste se filtre sur le nom, la personne à contacter, l'email, le téléphone et le matricule fiscal. Flèches et Entrée pour choisir au clavier
- Chaque ligne montre le nom, la personne à contacter et le matricule : on ne confond plus deux clients qui se ressemblent
- **« + Nouveau client »** est dans la liste elle-même
- Même liste pour la facture concernée par un avoir (avec son montant), pour le catalogue, les modèles de documents et les textes prédéfinis
- Et aussi dans le formulaire de contrat récurrent

Dates
- **Nouveau sélecteur de date** à la place de celui du système : un champ où tu écris librement et un calendrier clair
- La saisie est tolérante : `12/03/2026`, `12-3-26`, `12032026`, `12/03` pour l'année en cours, ou juste `12` pour le mois en cours. Les barres obliques s'écrivent toutes seules
- Les flèches **↑** et **↓** avancent ou reculent d'un jour
- Une date impossible, comme le 31 février, est refusée et l'ancienne valeur revient
- Calendrier : navigation par mois, choix direct du mois et de l'année, aujourd'hui entouré, jour choisi en vert
- Sur une échéance ou une validité : **Aujourd'hui, +7 j, +15 j, +30 j**

## 2.2.0 — 11/09/2026

Les listes, quand elles deviennent longues.

Pagination
- Toutes les listes longues sont **découpées en pages** : devis, factures, clients, prestations, modèles, textes prédéfinis, contrats, factures à relancer, journal des ventes, encaissements, documents d'une fiche client
- Barre de pagination sous chaque tableau : « 1–25 sur 137 », page précédente / suivante, et un choix **25, 50, 100 ou Tout** conservé d'une session à l'autre sur cet ordinateur
- Les totaux en pied de tableau et les exports CSV portent toujours sur la sélection entière, jamais sur la seule page affichée
- L'en-tête du tableau reste visible quand on fait défiler une longue liste

Filtres et tri visibles partout
- Les colonnes triables portent un repère **« ⇅ »** : jusqu'ici rien n'indiquait qu'un titre de colonne se cliquait
- **Recherche ajoutée** là où il n'y en avait aucune : prestations, modèles de documents, textes prédéfinis, contrats récurrents
- **Nouveaux filtres** : contrats (actifs, suspendus, à générer) et clients (avec un impayé, sans aucun document)
- Tri ajouté sur le catalogue, les contrats, les factures à relancer, le journal des ventes, les encaissements et les documents d'une fiche client
- Dès qu'un filtre est actif, le nombre de lignes retenues s'affiche avec un bouton **« Réinitialiser les filtres »**
- Sur une grande liste, l'année en cours était présélectionnée sans le dire : c'est maintenant indiqué et annulable d'un clic

Accueil
- Le panneau **« À faire » se replie** d'un clic sur son titre. Replié, il garde son compteur et une ligne de résumé. Le choix est conservé au prochain démarrage

Correction
- En fenêtre de 1280 px de large, les listes à huit colonnes (factures, clients, contrats, documents récents) dépassaient et obligeaient à faire défiler la page horizontalement. Elles tiennent maintenant dans la largeur

## 2.1.0 — 11/09/2026

Deuxième audit, sur la version 2.0.0 installée : ce qui manquait et ce qui accrochait.

À faire (accueil)
- **Devis acceptés pas encore facturés** : un devis passé en « accepté » sans qu'aucune facture n'en soit tirée remonte sur l'accueil avec le montant vendu. Le bouton ouvre la liste des devis filtrée sur les acceptés
- **Fiche société incomplète** : si la raison sociale, le matricule fiscal ou le RIB manquent, l'accueil le dit et mène directement à Paramètres → Société. Utile quand l'assistant de démarrage a été passé

Garde-fous avant d'émettre
- À l'émission d'une facture ou d'un avoir, la confirmation prévient si la fiche société est incomplète, si le RIB manque, ou si la date est **antérieure à la dernière facture émise** (la numérotation ne serait plus chronologique). On peut émettre quand même, en connaissance de cause
- Une échéance ou une validité antérieure à la date du document est refusée
- Un paiement daté dans le futur, ou supérieur au reste à payer, demande confirmation au lieu de passer en silence

Devis et factures
- **L'historique du devis** montre les factures qui en sont tirées (conversion, acompte, solde), même en brouillon, et l'historique de la facture renvoie vers son devis d'origine : chaque ligne est cliquable
- Liste des factures : les montants et les numéros ne passent plus à la ligne

Contrats
- L'objet des contrats s'affiche avec le mois de la prochaine facture (« Maintenance — octobre 2026 ») au lieu du gabarit brut
- **Reprendre un contrat suspendu** repart de la prochaine échéance à venir : les mois passés pendant la suspension ne sont pas facturés (la date reste modifiable)

Corrections
- Accueil vide : l'axe du graphique affichait « 1, 1, 0 »
- « Tout effacer » : le libellé de confirmation s'affichait sur trois lignes
- Les champs de recherche des listes ne tronquent plus leur texte d'aide
- Le guide « Démarrer » citait des onglets qui n'existent pas (Paiement, Données) ; il pointe maintenant vers Société → Coordonnées bancaires et Sécurité et données
- Le jeu de démonstration contient un devis accepté non facturé pour montrer la nouvelle ligne « À faire »

## 2.0.0 — 11/09/2026

SkanFact devient le logiciel de n'importe quelle petite entreprise, pas seulement de la mienne.

- **Assistant de première utilisation** : à la toute première ouverture, six écrans demandent la raison sociale, le matricule fiscal, l'adresse, l'activité, les règles de facturation (timbre, retenue à la source, délais, devise), le RIB, et proposent de mettre en place tout de suite la copie de sauvegarde externe. Chaque réponse se modifie ensuite dans Paramètres ; l'assistant se passe si on préfère
- **Secteurs d'activité** : informatique et cybersécurité, bâtiment, conseil et formation, commerce, santé, artisanat, autre. Le secteur choisi propose un catalogue de prestations de départ (libellés, prix indicatifs, unités, taux de TVA courant) et un slogan. Tout se modifie ou se supprime
- **Plus aucune entreprise écrite en dur** : les réglages par défaut sont vides, le pied de page des documents se compose du nom et du matricule saisis, et le jeu de démonstration s'annonce comme une démonstration
- Nouvel article d'aide : **« Installer SkanFact pour quelqu'un d'autre »** — une installation, une entreprise, des données et une numérotation indépendantes, et ce qu'il faut expliquer en trois points à celui qui démarre
- Corrigé : un document dont le contenu touchait le pied de page d'un ou deux pixels ne passait pas en marges resserrées et pouvait chevaucher les mentions légales
- Tes données et tes réglages existants ne changent pas : cette version ne touche qu'aux valeurs proposées à une installation neuve

## 1.10.0 — 11/09/2026

Piloter : savoir quoi faire aujourd'hui.

- **Panneau « À faire » sur l'accueil**, à la place des deux bannières. Il regroupe, du plus urgent au moins urgent : factures en retard, contrats à générer, devis expirés, devis sans réponse depuis plus de 15 jours, attestations de retenue à réclamer, factures à échéance cette semaine, brouillons de plus de 7 jours. Chaque ligne a son bouton d'action. Quand il n'y a rien, il le dit
- **Historique par document** : création, émission, envois par email, relances (email et téléphone), paiements, avoirs, attestation reçue. Rien à saisir, tout est reconstitué à partir de ce qui est déjà enregistré

Relances
- **Relance par téléphone** notée à la main, avec ce qui a été dit. Elle compte comme une relance et apparaît dans l'historique
- **Report** : quand un client annonce une date de paiement, la facture descend en bas de la liste jusque-là. Elle reste comptée dans le reste à encaisser — un impayé ne se cache pas
- **Devis sans réponse** : nouvelle section avec un bouton « Relancer par email » et son propre modèle de message
- Le client de chaque ligne renvoie vers sa fiche

Comptabilité
- **Envoyer au comptable** : prépare l'email avec le journal des ventes de la période en pièce jointe (CSV). L'adresse du comptable se retient (Paramètres → Emails)

Navigation
- Barre latérale groupée : **Ventes** (devis, factures, relances, contrats), **Fichiers** (clients, catalogue), **Gestion** (comptabilité, paramètres, aide)
- Compteur sur Contrats quand des factures récurrentes attendent d'être générées

## 1.9.0 — 11/09/2026

Retrouver et suivre : les listes et les clients.

Listes de devis et de factures
- **Tri par colonne** : un clic sur un titre trie, un deuxième inverse
- **Filtre par année**, proposé dès que la liste s'allonge, et ouvert sur l'année en cours
- **Pied de tableau** : nombre de documents, total HT et reste à payer de ce qui est affiché. Avec les filtres, tu obtiens en deux clics le total facturé à un client sur une année
- **Actions au survol d'une ligne** : PDF, Email, Enregistrer un paiement, Dupliquer — sans ouvrir le document
- Les filtres et le tri sont conservés quand tu ouvres un document et que tu reviens
- La recherche porte aussi sur la référence (bon de commande)

Devis
- Nouvel état **« expiré »** : un devis envoyé dont la date de validité est passée sans réponse le montre, dans la liste comme sur l'accueil. Le statut enregistré, lui, ne bouge pas
- La colonne « Type », inutile sur la page Devis, laisse la place à **« Valable jusqu'au »**

Clients
- **Fiche client** (clic sur une ligne) : facturé hors taxes, reste à payer, délai moyen de paiement de ce client, taux d'acceptation de ses devis, bannière s'il a des factures en retard, ses coordonnées, ses notes internes modifiables sur place et la liste de tous ses documents. Boutons « + Devis » et « + Facture » qui partent avec le client, sa langue, sa devise et son taux de retenue déjà réglés
- **Personne à contacter** : le nom de ton interlocuteur, affiché dans la liste et imprimé sur les documents sous la raison sociale
- Liste des clients : triable, avec facturé HT, reste à payer et date du dernier document
- La suppression d'un client est passée dans sa fiche (elle reste impossible s'il a des documents)

Catalogue
- **Trois onglets** : Prestations, Modèles de documents, Textes prédéfinis

## 1.8.0 — 11/09/2026

Comprendre ce qu'on fait, et ne plus rien perdre.

Expliquer
- **Bulles « i » dans toute l'application** : à côté de chaque champ et de chaque tableau, un petit bouton rond ouvre une explication écrite pour quelqu'un qui démarre son entreprise. Plus de 70 explications : matricule fiscal, retenue à la source, timbre fiscal, échéance, taux de change, statut d'une facture, délai moyen de paiement, attestations à réclamer… Les points de fiscalité incertains portent la mention « À VÉRIFIER avec ton comptable »
- **Rubrique Aide** (nouvelle page, menu Aide ou Cmd+K) : quatorze articles qui vont du premier réglage à la routine mensuelle — démarrer, le devis, la facture et la règle de numérotation, l'avoir, se faire payer, TVA / timbre / retenue à la source, acompte et solde, les contrats, facturer à l'étranger, la comptabilité mois par mois, les sauvegardes, bien gérer sa première entreprise, le vocabulaire, les raccourcis clavier. Le menu Aide de l'application renvoie directement aux articles clés

Ne plus perdre son travail
- **Garde-fou « modifications non enregistrées »** : quitter un document ou les paramètres sans enregistrer propose d'enregistrer, de quitter quand même ou de rester. Un marqueur « non enregistré » apparaît à côté du titre dès la première modification
- **Échap ferme** les fenêtres, les menus et les bulles ; **Entrée valide** les formulaires (client, prestation, paiement, mot de passe…)
- Après un enregistrement, la page ne remonte plus en haut

Confort
- **Paramètres en onglets** : Société, Documents, Emails, Apparence, Sécurité et données, Mises à jour. La barre « Enregistrer » n'apparaît qu'en bas, et seulement s'il y a quelque chose à enregistrer
- **Barre d'actions de l'éditeur simplifiée** : Email, PDF, un menu « Facturer ▾ » (convertir, acompte, solde) et « Plus ▾ » pour le reste
- **Aperçu du document** : bouton « Masquer » (choix mémorisé) et indicateur « 1 page / 2 pages » qui prévient quand le document déborde
- **Lignes** : monter, descendre, dupliquer ; la description ne s'affiche que si elle sert (« + description »)
- Le titre de la fenêtre indique le document ouvert
- « Tout effacer » et « Charger la démo » sont dans une zone sensible ; l'effacement demande d'écrire le mot EFFACER
- Fenêtre étroite (13 pouces, pas en plein écran) : l'aperçu et les tableaux de bord se réorganisent au lieu d'écraser les champs

## 1.7.1 — 11/09/2026

- **Nouveau jeu de démonstration** (Paramètres → Données) : treize mois d'activité d'une petite société de cybersécurité — contrat mensuel avec retenue à la source et attestations reçues ou non, contrat trimestriel, contrat suspendu, projet en acompte + solde, facture annulée par un avoir, avoir partiel, paiement partiel, factures en retard aux trois niveaux de relance (relances déjà envoyées), client étranger facturé en anglais et en euros, devis acceptés / refusés / en attente / expiré / brouillon, modèles et textes prédéfinis. Toutes les dates suivent la date du jour : accueil, relances et contrats restent vivants
- Charger la démo **conserve tes paramètres société** (nom, logo, cachet, couleurs, thème) et prend une sauvegarde nommée avant de remplacer les données
- « Tout effacer » vide aussi les contrats, modèles et textes prédéfinis (ils restaient), après une sauvegarde nommée
- **Documents PDF** : quand le contenu déborde d'un peu (quatre ou cinq lignes avec descriptions, remise, retenue à la source, notes), les marges se resserrent automatiquement pour tenir sur une page au lieu de créer une deuxième page presque vide — même règle dans l'aperçu et dans le PDF
- Corrigé : le menu « Plus ▾ » de l'éditeur, le champ « Taux de change » et le bouton « Retirer » de la copie externe restaient affichés alors qu'ils devaient être masqués
- Corrigé : dans Contrats, l'état affichait « envoyée » / « brouillon » au lieu de « actif » / « suspendu »
- Graphique de l'accueil : « juin » et « juillet » étaient tous deux abrégés « jui »

## 1.7.0 — 11/09/2026

Sécurité des données.

- **Copie externe automatique** (Paramètres → Données) : choisis un dossier (iCloud Drive, clé USB, disque réseau) ; à chaque enregistrement le fichier de données et toutes les sauvegardes y sont copiés. Si le Mac meurt, tout est ailleurs. Support débranché : signalé, sans bloquer
- **Mot de passe** (Paramètres → Sécurité) : le fichier de données et ses sauvegardes sont chiffrés sur le disque (AES-256-GCM, clé dérivée par scrypt). Demandé à chaque ouverture ; verrouillage à la demande (menu Fichier ou Cmd/Ctrl+L). Changer ou retirer le mot de passe reconvertit les sauvegardes. Import d'un fichier chiffré possible avec son mot de passe ; l'export JSON reste en clair (avertissement)
- Aucune récupération possible sans le mot de passe : il protège contre un ordinateur perdu ou volé, pas contre l'oubli

## 1.6.0 — 11/09/2026

- **Tableau de bord** : histogramme des 12 derniers mois (facturé HT avoirs déduits, encaissé), top 5 clients de l'année, taux de conversion devis → facture, délai moyen de paiement
- **Documents en anglais** : langue par document (ou par client, ou par défaut) — Quote / Invoice / Credit note, tous les libellés, montant en toutes lettres en anglais, modèles d'email en anglais (Paramètres → Emails), conditions de paiement et de devis en anglais
- **Devise par document** (DT, EUR, USD, GBP, CHF, MAD, DZD) avec taux de change vers le dinar : 2 décimales pour les devises étrangères, taux affiché sur le document, journal des ventes et tableau de bord convertis en dinars
- **Cachet / signature** : une image (Paramètres → Société) apparaît dans la case « Cachet et signature » des factures et devis
- **Thème sombre** (Paramètres → Apparence : clair, sombre, comme le système) — les documents restent clairs

## 1.5.0 — 11/09/2026

Gagner du temps chaque mois.

- **Contrats récurrents** (nouvelle page) : un contrat (client, lignes, mensuel / trimestriel / annuel, jour du mois) génère un brouillon de facture à chaque échéance — bannière « n factures à générer » sur l'accueil, un clic pour les créer, puis « Émettre ». Depuis une facture existante : Plus ▾ → « Rendre récurrent ». Objet avec {mois} (« Maintenance — septembre 2026 »)
- **Relances** (nouvelle page, compteur dans la barre latérale) : factures en retard avec jours de retard, reste à payer, dernière relance ; niveau automatique (rappel ≤ 15 j, relance ≤ 45 j, dernière relance au-delà) ; bouton « Relancer par email » avec le texte prêt ; échéances des 7 prochains jours
- **Envoi par email** : bouton « Envoyer par email » sur les devis, factures et avoirs émis. Sur Mac, le message s'ouvre dans Mail avec destinataire, objet, texte et **le PDF joint** ; ailleurs, la messagerie s'ouvre et le PDF est montré à côté. Six modèles d'email modifiables (Paramètres → Emails), historique des envois par document, un devis envoyé passe automatiquement « envoyé »
- **Recherche Cmd/Ctrl+K** : documents, clients, prestations et actions depuis n'importe où, au clavier
- **Modèles de documents** : Plus ▾ → « Enregistrer comme modèle » sur un devis ou une facture, puis « Depuis un modèle… » dans l'éditeur ou Catalogue → Modèles ; **textes prédéfinis** (garantie, conditions…) insérables dans les notes en un clic
- L'éditeur regroupe les actions secondaires (dupliquer, modèle, récurrent, modifier, supprimer) dans un menu « Plus ▾ »

## 1.4.0 — 11/09/2026

Socle comptable : SkanFact devient une vraie facturation, plus seulement un générateur de PDF.

Factures
- Numérotation à l'émission : un brouillon de facture n'a pas de numéro ; le numéro définitif (FAC-AAAA-NNN) est attribué au clic « Émettre », donc plus aucun trou dans la numérotation si tu supprimes un brouillon
- Une facture émise est verrouillée (plus modifiable, plus supprimable) — c'est la règle de la numérotation continue. Pour corriger : un avoir. Un bouton « Modifier… » reste possible tant qu'aucun paiement ni avoir n'existe, avec avertissement
- Export PDF d'un brouillon : au choix « Émettre et exporter » ou « Exporter le brouillon » (filigrane Brouillon, sans numéro)
- Tampon « Payée » / « Annulée » sur le PDF selon la situation réelle

Paiements
- Enregistrement des encaissements (date, montant, mode virement/chèque/espèces/traite/carte, référence), paiements partiels
- Statut déduit automatiquement : envoyée → partiellement payée → payée, « en retard » après l'échéance ; reste à payer visible dans la liste, sur la fiche et par client
- Les anciennes factures « payée » sont converties en paiement (historique conservé)

Avoirs
- Nouveau type de document AVO-AAAA-NNN, rattaché à une facture (total ou partiel, motif), émis et verrouillé comme une facture ; il vient en déduction du reste à payer et du chiffre d'affaires ; une facture entièrement avoirée passe « annulée »

Retenue à la source (À VÉRIFIER avec le comptable)
- Taux par facture, par défaut par client (1,5 %, 3 %, 5 %, 10 %, 15 %…), calculée sur le TTC hors timbre, affichée sur le document avec le net à payer ; suivi des attestations reçues

Acompte et solde
- Depuis un devis : « Facture d'acompte… » (x % du devis, par taux de TVA) puis « Facture de solde » qui déduit automatiquement les acomptes émis

Comptabilité (nouvelle page, Cmd/Ctrl+6)
- Par mois ou par année : CA HT, TVA collectée par taux, encaissements, reste à encaisser, retenues subies
- Journal des ventes et encaissements exportables en CSV (Excel, format français) ; export de tous les PDF de la période dans un dossier — le pack pour le comptable

Mentions légales
- Registre de commerce et capital dans le pied de page, conditions de paiement sur les factures, conditions des devis modifiables (Paramètres)

## 1.3.3 — 11/09/2026

- Mises à jour : tant qu'aucun token n'est enregistré, l'app n'interroge plus GitHub pour rien et affiche simplement quoi faire (fini le message rouge « Aucune version trouvée » avant même d'avoir collé le token)
- Le format du token est vérifié à l'enregistrement (`github_pat_…` ou `ghp_…`)

## 1.3.2 — 11/09/2026

- Correction du bug qui empêchait la 1.3.0 d'afficher sa fenêtre (et affichait « Cannot read properties of undefined (reading 'publish') » en 1.3.1) : l'app lisait la section `build` de `package.json`, qu'electron-builder retire de l'app installée. Le menu français et la vérification des mises à jour fonctionnent maintenant dans l'app installée, Mac et Windows
- Les tests automatiques tournent désormais sur l'app empaquetée, pas seulement en mode développement

## 1.3.1 — 11/09/2026

- Mac : sur certaines machines la 1.3.0 se lançait (icône dans le Dock) sans jamais afficher sa fenêtre. La fenêtre s'affiche désormais au plus tard 1,5 s après le lancement, même si l'interface tarde à charger
- Plus aucune erreur silencieuse au démarrage : un problème (menu, fenêtre, chargement de l'interface) est affiché à l'écran et noté dans `main.log` dans le dossier des données

## 1.3.0 — 11/09/2026

Mises à jour
- Mac : vraie mise à jour automatique sans certificat Apple — l'app télécharge la nouvelle version, se ferme, se remplace dans Applications et se relance (plus de page web à ouvrir)
- Téléchargement automatique en arrière-plan dès qu'une version est détectée ; pastille « Version X prête » puis un clic « Installer et redémarrer »
- Windows : installation silencieuse et redémarrage automatique
- Vérification au démarrage vraiment silencieuse (plus d'erreur affichée tant que le token n'est pas saisi) ; vérification lancée dès que le token est enregistré
- Notes de version affichées dans l'app (Paramètres → Mises à jour → Nouveautés, menu Aide)

Comme un vrai logiciel
- Menu de l'application en français : Fichier (nouveau devis Ctrl/Cmd+N, nouvelle facture, enregistrer Ctrl/Cmd+S, PDF Ctrl/Cmd+P, export/import), Édition (copier/coller), Affichage (Ctrl/Cmd+1…5, zoom), Aide (nouveautés, à propos)
- Une seule instance de l'app à la fois (deux fenêtres ouvertes pouvaient corrompre le fichier de données)
- Taille et position de la fenêtre mémorisées
- Installateur Windows en français, raccourcis Bureau et menu Démarrer, désinstallation propre
- Image disque Mac avec le raccourci Applications
- Electron 43 (moteur mis à jour, correctifs de sécurité)

Sécurité des données
- Un fichier de données illisible n'est plus écrasé : il est mis de côté et l'app propose de restaurer une sauvegarde
- La sauvegarde quotidienne est désormais l'état du **début de journée** (avant, chaque enregistrement l'écrasait, on ne pouvait pas annuler une bêtise)
- Sauvegarde automatique avant tout import ; import refusé si le fichier n'est pas un export SkanFact
- Paramètres → Données : « Sauvegarder maintenant », « Ouvrir le dossier des sauvegardes »
- Export PDF plus robuste (fichier temporaire au lieu d'une URL limitée en taille — les logos lourds faisaient échouer l'export) ; logo limité à 1 Mo
- Documents longs : pas de ligne coupée entre deux pages, en-tête du tableau répété

## 1.2.1 — 11/09/2026

- Première mise en ligne du code sur GitHub (`saouthq/skanfact`) et première release construite par GitHub Actions
- Les releases sont publiées directement (plus de brouillon) : sans ça, l'app installée ne voyait jamais la nouvelle version
- Icône d'application SkanFact (`build/icon.png`, convertie automatiquement en `.icns` / `.ico` au build)
- `package-lock.json` ajouté pour des builds identiques sur Mac, Windows et GitHub Actions

## 1.2.0 — 11/09/2026

- Mises à jour depuis un dépôt GitHub **privé** : champ « Token GitHub » dans Paramètres → Mises à jour (stocké localement, hors du code)
- Messages d'erreur plus précis (token manquant / refusé)

## 1.1.1 — 11/09/2026

- Message clair dans Paramètres → Mises à jour tant que GitHub n'est pas configuré (plus de pavé d'erreur technique)
- Erreurs réseau/404 résumées en une phrase

## 1.1.0 — 11/09/2026

- Jeu de données de démonstration (Paramètres → Données) : 6 clients, 8 prestations, 14 devis/factures sur 3 mois avec tous les statuts, dont une facture en retard
- Bouton « Tout effacer » pour repartir de zéro en gardant les paramètres société

## 1.0.1 — 11/09/2026

- L'installeur Mac construit maintenant le `.dmg` complet dans `dist/` (en plus de `SkanFact.app`)

## 1.0.0 — 11/09/2026

Première version.

- Société, clients, catalogue de prestations
- Devis et factures : lignes, remise, TVA 0/7/13/19 %, timbre fiscal, montant en lettres
- Numérotation automatique par année, conversion devis → facture, statuts, retards
- Aperçu en direct, export PDF A4 (design clair, couleur d'accent réglable)
- Tableau de bord : CA mois/année, impayés, devis en attente
- Sauvegarde quotidienne automatique, export/import JSON
- Installeur double-clic Mac (`.command`) et Windows (`.bat`)
- Mises à jour intégrées (electron-updater + GitHub Releases), workflow de publication `npm run release`
