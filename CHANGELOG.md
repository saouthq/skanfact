# Historique des versions

Format : `MAJEUR.MINEUR.CORRECTIF`
- correctif (1.0.x) : bug corrigé, petit ajustement visuel
- mineur (1.x.0) : nouvelle fonctionnalité
- majeur (x.0.0) : gros changement (nouvelle structure de données, refonte)

Le numéro affiché en bas de la barre latérale de l'app est celui de `package.json`.

## 10.13.0-beta.1 — 24/09/2026

**Avant la mise en production : les deux applications et le pont entre elles, testés en entier.**
Skander : « il faut tester toute l'application, entreprise, cabinet et le pont, tous les parcours,
tous les boutons » — et quatre demandes précises : des listes déroulantes toutes modernes, des
bulles d'aide qui mènent à leur article, une seule position pour les confirmations, une barre
latérale moins chargée. Tout a été fait, puis refait à la souris, dans les deux applications, et un
paquet est parti de l'une vers l'autre pour de vrai, aller et retour.

**Le pont entre SkanFact et SkanFact Cabinet — ce qui était faux**
- **« Origine vérifiée » ne prouvait rien.** Une clôture ou des questions reçues du cabinet se
  disaient vérifiées dès que leur signature correspondait à la clé que le fichier présente — or
  n'importe qui peut fabriquer une clé et signer, et le matricule d'un client est public. Une clôture
  importée VERROUILLE un exercice. SkanFact retient désormais la signature de son cabinet la première
  fois (et le dit), puis refuse un envoi signé par une autre clé — en nommant les deux empreintes —
  ou qui n'est plus signé. Si le comptable change vraiment de clé, on l'accepte après lui avoir lu
  l'empreinte au téléphone — d'un clic voulu : sur cette question-là, la touche Entrée annule au lieu
  d'accepter, parce qu'un « oui » par réflexe est exactement ce qu'un imposteur espère. La signature
  retenue se voit et s'oublie dans Paramètres → Envois.
- **Tous les postes d'un cabinet signent pareil.** La clé de signature était tirée au hasard sur
  chaque ordinateur : deux collaborateurs signaient différemment, et changer d'ordinateur changeait la
  signature. Elle suit maintenant la clé du cabinet (clé de secours comprise), et son empreinte
  s'affiche dans Réglages → Mon cabinet, pour être lue au client qui la vérifie.
- **Chaque paquet signé arrivait avec une fausse alerte** : « ⚠ 1 fichier présent mais non annoncé
  par ton client » — c'était la signature elle-même. Elle n'est plus comptée comme un intrus, et les
  paquets déjà reçus sont relus sans l'alerte.
- **Une réponse au comptable pouvait ne jamais partir.** Répondre à sa question puis cliquer le
  bouton vert « Envoyer au comptable » joignait le paquet fabriqué AVANT la réponse. Le bouton vert
  est maintenant « Refaire le paquet avec ta réponse », et l'écran dit pourquoi. Les questions passent
  avant « Fabriquer et envoyer », la première question en attente porte le bouton principal, et la
  pièce qu'une question nomme s'ouvre d'un clic.
- **Le Cabinet recevait les réponses sans le dire.** Le compte rendu d'import annonce maintenant
  « 1 réponse du client à tes questions » avec « Lire la réponse », qui amène directement au panneau
  des questions de la Révision (il était trois panneaux plus bas) — et la Révision ne montre plus
  « 1 question attend sa réponse » sur une question répondue. Le champ « Ta réponse » a sa bulle, les
  cinq champs de « Poser une question au client » ont les leurs, et une question vide montre sa case.
- **Une réponse déjà reçue revenait comme « réponse à une question inconnue »** à chaque paquet
  suivant (le client renvoie toutes ses réponses à chaque fois).
- **Écrire le fichier de questions ne se dit plus « 1 question envoyée »** : il reste à le
  transmettre, et la fenêtre dit où il est et le montre.
- **Une question qui attend son envoi ne « attend » pas une réponse** : la révision dit ce qui reste à
  faire (« Envoyer les questions au client… »), dans le bon ordre.
- **L'appairage** redessine seulement son panneau (la page ne remonte plus), et un fichier refusé dit
  quoi demander au comptable, plus « Error invoking remote method ».

**Ce que Skander a demandé**
- **Toutes les listes déroulantes sont modernes**, dans les deux applications : la même liste que
  celle des clients, avec recherche au-delà de dix lignes, au clavier comme à la souris.
- **Chaque bulle « i » mène à son article** (338 dans SkanFact, 118 dans le Cabinet), du même style
  partout ; cliquer un libellé pose le curseur dans SON champ, au lieu d'ouvrir la bulle voisine.
- **Les confirmations ont une seule position** : une question courte s'ouvre au centre du regard, par
  dessus ce qu'elle concerne ; une fenêtre longue en haut ; aucune ne bouge une fois ouverte.
- **La barre latérale se replie par famille** (Vendre, Acheter, Piloter) : dix-huit entrées ramenées à
  ce qui sert, la famille de la page ouverte s'ouvre toute seule, et une famille repliée porte le
  compte de ce qui attend dedans.

**Et le reste, trouvé en testant**
- « + Nouveau client » vide dans la liste des clients d'une pièce ; « Revoir l'assistant » qui
  remettait le thème à Clair ; les listes « libellé : valeur » décalées d'une ligne à l'autre ; le
  compteur de la Paie qui oubliait les déclarations en retard ; un faux « Fichiers en tout » sous le
  contenu du paquet ; « * obligatoire » écrit deux fois ; « Elles s'afficheront » pour une seule
  question ; une question de fenêtre qui commençait par une minuscule ; « Tu viens de ranger ton
  premier paquet » au deuxième ; les fenêtres de fin (« Fermer », « Plus tard ») qui proposaient
  aussi « Annuler ».
- **Dans SkanFact, une question sans champ laissait le curseur sur le bouton de la page** qui l'avait
  ouverte, derrière elle : la touche Entrée re-cliquait ce bouton (le choix de fichier se rouvrait
  par-dessus la question d'import). Le curseur entre maintenant dans la fenêtre — le premier champ,
  sinon le bouton principal —, comme dans SkanFact Cabinet.

**Publiée en bêta** : elle touche à la signature des envois entre les deux applications.

## 10.12.0 — 24/09/2026

**Les deux applications, parcourues comme on les vit.** La dernière stable en ligne était la
**10.10.0** ; la 10.11.0 et la 10.12.0-beta.1 n'ont été publiées nulle part, et cette version
les rattrape toutes les deux. Chaque écran du Cabinet puis de l'app entreprise a été tenu à la
souris et au clavier, comme un comptable et comme un chef d'entreprise le feraient. Chaque défaut
trouvé a été corrigé, puis revérifié de la même façon.

Publiée en stable directe **à la demande de Skander**. La règle du projet voulait la bêta, parce
que cette version touche au moteur comptable : déclaration d'employeur, IRPP du mois,
contre-passation, rapprochement, valorisation du stock. C'est sa décision, notée ici.

**Ce qui était faux dans les chiffres**
- **Un prix tapé « 2,5 » devenait 25** sur un ordinateur réglé en anglais : la virgule était lue
  comme un séparateur de milliers. Désormais, les champs de nombre suivent le français sur tous les
  postes.
- **Un prix tapé dans un champ à 0 devenait dix fois trop cher** : « 850 » donnait 8 500. Un champ
  de nombre sélectionne maintenant sa valeur quand on y entre.
- **Un comptage d'inventaire se retournait** : « 28 » devenait 82.
- **La trésorerie comptait un achat en euros comme des dinars** : le trou à trente jours était
  sous-estimé de 2 856 DT.
- **Le stock se valorisait dans le désordre**, et une vente sortait au coût de l'achat qui la suit.
  **Une matière utilisée sur un chantier** n'entrait jamais dans le résultat.
- **Un devis déjà acompté ne réclamait plus ses 70 % restants.** Une facture complète pouvait même
  s'ajouter à côté de l'acompte.
- Dans le Cabinet :
  - **la déclaration d'employeur ne voyait aucune charge patronale** ;
  - **l'IRPP du mois tombait presque à zéro** ;
  - **« il manque 6 mois »** s'affichait sur des mois hors mission ;
  - **le chiffre d'affaires du portefeuille** additionnait des mois différents.
- **Deux entreprises sur la même clé USB gardent chacune leur copie.** Avant, la seconde effaçait
  celle de la première.

**Ce qui empêchait de recevoir les mises à jour** (10.11.0)
- **« Tu as la dernière version » s'affichait alors qu'une version plus récente était en ligne.**
  Le service de mise à jour relit maintenant une version qui paraît vide avant de passer à la
  précédente.
- **Une version téléchargée cachait la suivante.**
- **L'écran des mises à jour est refait « comme sur un Mac », dans les deux applications.** Il
  affiche un seul état, « Redémarrer maintenant », une fenêtre qui dit ce que la version apporte, et
  la vraie dernière bêta avec sa date.

**Ce qui se voit tous les jours**
- **Un seul bouton vert par écran, et c'est l'étape suivante**, dans les deux applications.
- **Émettre une facture passe par un récapitulatif** qui rappelle le client, l'échéance et le net à
  payer. Pour un avoir, il dit aussi ce qu'il laisse à rendre au client.
- **Les formulaires ne sautent plus sous le curseur** : « Fiche du client », le repère « non
  enregistré », les propositions du catalogue ou un retour au nom long n'y poussent plus rien.
- **Une fenêtre remplie demande avant de jeter ce qu'on a tapé.** Un refus montre sa case, dans
  toutes les fenêtres.
- **La grille de saisie du Cabinet montre dix lignes au lieu d'une** sur un portable. Les treize
  écrans de comptabilité sont rangés en trois groupes.
- **Cmd+K connaît la comptabilité et l'Aide.** Sept articles d'Aide ont été ajoutés.
- **Le jeu d'exemple du Cabinet montre une année tenue entièrement.**
- **Les sauvegardes se nomment.** Un dossier retiré se remet dans la liste. Changer d'ordinateur
  ramène aussi les pièces jointes. OneDrive est nommé à côté d'iCloud Drive.
- La console de l'éditeur nomme les événements de la vente en ligne, et écrit ses dates et ses
  montants comme l'écran.

Le détail est dans les deux entrées qui suivent : 10.12.0-beta.1 et 10.11.0.

## 10.12.0-beta.1 — 23/09/2026

**Le Cabinet, parcouru comme un comptable le vivrait.** Un audit d'interface en trente constats,
fait à la souris et au clavier sur l'application ouverte — puis chaque correction revérifiée de la
même façon, ce qui en a fait trouver une trentaine d'autres. Tout est ici.

**Les chiffres qui se contredisaient**
- **La déclaration d'employeur ne voyait aucune charge patronale** (« aucun mouvement sur 65 »)
  pendant que la paie en écrivait 627 890 DT au 645. Elle lit maintenant les comptes de la paie, et
  ne les compte plus deux fois. La liasse nomme ses rubriques comme le plan (65 = charges
  financières).
- **La case IRPP de la déclaration du mois tombait à presque rien** : l'IRPP de juin, reversé en
  juillet, se retranchait de celui retenu en juillet. Elle compte ce qui est RETENU dans le mois.
- **« Il manque 6 mois »** s'affichait sur des mois hors mission : le Suivi et la Comptabilité lisent
  le même début de mission.
- **Le chiffre d'affaires du portefeuille** additionnait le mars d'un client et l'août d'un autre. Il
  porte sur un mois nommé, et la carte et le pied du tableau disent le même chiffre.
- **L'écart de rapprochement** s'affichait en rouge sans rien pour dire s'il était expliqué. Les
  suspens se totalisent de chaque côté, et une phrase dit si « banque − livre » redonne tout l'écart.
- L'intitulé des à-nouveaux porte le nom du compte ; plus aucun mois écrit « 2026-07 » dans une phrase.

**La saisie et le livre**
- La grille de saisie passe au-dessus de la ligne de flottaison : sur un portable de 1280×800, elle
  montrait UNE ligne, elle en montre dix. Ses colonnes ne sautent plus pendant la frappe, et une
  pièce commencée se signale et se demande à la fermeture de l'application.
- **Les treize écrans de la comptabilité sont rangés en trois groupes** — Saisir, Consulter, Déclarer
  et clôturer —, l'écran vit dans l'adresse, et chaque dossier rouvre là où on l'a laissé.
- Aucune colonne collante ne recouvre plus une donnée (Débit et Crédit du livre-journal, « Signalés »
  des Dossiers, juillet et août de la Production).
- Un montant s'écrit et se relit en français dans chaque champ (« 250.000 » se lisait deux cent
  cinquante mille) ; un montant illisible reste rouge et se nomme.
- **La recherche du livre-journal** perdait les lettres tapées (« P » au lieu de « PAIE-2026-08 ») et
  coupait les pièces (« 24 pièces déséquilibrées » sur un livre juste). Elle garde la frappe, le
  curseur, et des pièces entières.
- **Une écriture contre-passée libère ce qu'elle portait** : la paie, la dotation, la déclaration ou
  l'inventaire redeviennent « à passer ». Le refus disait « contre-passe-la d'abord » et, une fois fait,
  répétait la même phrase. La fenêtre nomme ce qui sera libéré avant qu'on confirme ; sur un brouillard,
  le refus dit « supprime-la ».
- Une pièce contre-passée n'élargit plus le livre-journal au point de cacher le Crédit.

**Un seul bouton principal par écran, et c'est l'étape suivante**
- Révision, Relances, Déclaration, Paie, Immobilisations, Inventaire, assistant, Réglages : un seul
  vert, sur ce qui est à faire maintenant. Les Réglages n'en ont aucun au repos.
- L'orange est gardé pour ce qui demande un geste ; les états normaux se disent en gris.
- Un bouton éteint dit pourquoi, à côté de lui. Une dotation n'est plus réclamée en septembre : elle
  se passe à l'inventaire, au dernier mois de l'exercice (le bouton la prépare si on le veut).
- La liasse masque ses rubriques vides en le disant ; l'Exercice et les Réglages de la comptabilité se
  replient en sections avec un sommaire ; le modèle de liasse se modifie dans une fenêtre.

**Trouver**
- **Cmd+K connaît la comptabilité** : « balance », « béji balance », « rapprochement »… ouvrent le bon
  écran du bon client, et proposent aussi l'article d'Aide qui l'explique.
- **Sept articles d'Aide de plus** : Banque, Déclaration, Immobilisations, Paie, Révision, Exercice,
  Liasse — chacun finit par son geste, et la bulle du titre de l'écran y mène.
- **Le jeu d'exemple montre ce qui impressionne un comptable** : un client sur SkanFact avec son relevé
  rapproché (une ambiguïté à trancher, un suspens de chaque côté) et une révision entamée ; un client
  hors SkanFact dont le cabinet tient l'année entière — recettes, achats, paie de deux salariés, TVA,
  CNSS, biens. Ses mois se lisent dans son livre (« à saisir », « déclaré »), jamais « hors mission ».

**Et**
- Un autre écran s'ouvre en haut ; un geste qui détruit vit en bas de son menu, après un trait.
- Dans l'app entreprise aussi : une fenêtre de formulaire ne jette plus ce qu'on vient de taper sur
  Échap ou « Annuler » — elle demande (sauf un simple mot de confirmation, comme « EFFACER ») ; une
  pastille ne se coupe plus sur deux lignes.
- Les phrases s'accordent à ce qu'elles comptent : « 1 paquet n'est pas définitif… Son mois… Il est
  quand même exporté », « elle reste en brouillard », et plus aucune date « 2026-08-31 » dans un message.
- Les instruments de mesure du rendu voient désormais les fenêtres, le texte coupé à côté d'une colonne
  vide, les deux dossiers pleins de l'exemple, et le livre-journal d'une pièce contre-passée — et ils
  ont trouvé tout de suite, dans la Paie d'un portable, « Renseigner le n° de … » collé sous sa phrase.

**L'app entreprise, parcourue à son tour comme un chef d'entreprise la vivrait**
- **« Remplir ton catalogue » se cochait tout seul**, pour tout le monde, à la seconde où l'assistant
  se refermait : les quinze métiers proposent des prix d'exemple, et un prix posé par le logiciel
  passait pour un prix décidé. L'étape se coche quand TU as enregistré une prestation ; celles que
  l'assistant a posées portent un repère « exemple » dans le Catalogue jusqu'à ce que tu les
  enregistres.
- **Modifier une prestation faisait perdre le tri de la liste** et la ramenait page 1 : la fenêtre
  rappelait la liste avec la prestation enregistrée, prise pour une colonne. Vrai sur les onze listes
  qui trient de cette façon — seule une colonne trie désormais.
- **La barre latérale défilait pour un pixel** sur Windows et Linux : la barre de défilement faisait
  passer « Facturation récurrente » sur deux lignes, ce qui entretenait le débordement. Elle ne défile
  plus que quand elle déborde vraiment, et se remesure quand la fenêtre change de taille.
- **« * obligatoire » s'affichait sous neuf fenêtres sans aucune étoile au-dessus** — client,
  fournisseur, salarié, affaire, modèle, texte, compte, opération ; et six de plus dans le Cabinet. Le
  champ obligatoire porte son étoile.
- **Enregistrer un devis neuf laissait « ← le document » en bouton retour**, et il ouvrait un devis
  VIERGE. Même chose après l'émission d'une facture, l'export d'un brouillon et l'enregistrement d'un
  achat neuf. Le retour mène désormais à la liste d'où l'on vient.
- **La désignation d'une ligne n'avait que 84 à 98 px** à côté de l'aperçu, et le prix unitaire 45 px
  sur un portable : on lisait « ence murale » de « Dépose et évacuation de l'ancienne faïence murale ».
  À côté de l'aperçu, la désignation prend toute la largeur et les chiffres passent dessous (409 à
  489 px pour elle, 96 pour le prix) ; sans l'aperçu, tout tient sur une rangée.
- **Choisir un client faisait sauter tout le formulaire de 45 px** : « Fiche du client » apparaissait
  sous le champ, et le clic suivant, visé sur « Objet », tombait dans le vide. Le lien « Modifier la
  fiche » vit dans la ligne du libellé, où il ne déplace rien.
- **Dans le menu « Facturer ▾ », chaque bulle « i » tombait seule sur sa ligne**, et celle de « Lire une
  photo… » restait affichée à côté de « Joindre un justificatif… » alors que la lecture est en pause :
  une bulle posée À L'INTÉRIEUR d'un bouton, que le navigateur coupait en deux. Neuf cas, dont un dans
  le Cabinet.
- **Un devis enregistré gardait « Enregistrer » en vert** : il disait qu'il restait quelque chose à
  enregistrer. L'étape suivante — l'envoyer — est le bouton principal ; « Enregistrer » le redevient
  dès qu'on modifie.
- **Clients, Fournisseurs, Achats et les autres pièces affichaient une recherche et des filtres
  au-dessus de zéro ligne**, et une phrase sans bouton : ils disent maintenant à quoi ils servent et
  donnent le geste qui les remplit, comme les Devis et les Factures.
- **La recherche des listes prenait toute la ligne** et renvoyait filtres et bulle sur une seconde
  rangée — sur le Catalogue, une bulle « i » restait seule sous la recherche. Les filtres tiennent sur
  une rangée, et la liste remonte d'autant.
- La fenêtre porte le titre de la page : « Nouveau devis », « Nouvelle facture d'achat », la fiche
  d'un fournisseur — plus « Nouveau document » ni « SkanFact » tout court.
- **Émettre une facture passait par une question générique** (« Émettre FAC-2026-001 ? ») dans une
  fenêtre qui cachait le document : on confirmait le geste le plus définitif de l'application sans
  pouvoir relire à qui, ni combien. La fenêtre récapitule le client, la date, l'échéance et le net à
  payer ; pour un avoir, la facture qu'il corrige — et, si elle est déjà payée, **ce que l'avoir laisse
  à rendre au client**, avant de l'émettre plutôt qu'après. Si personne ne l'a payée, un avoir plus
  gros que ce qu'il reste à corriger ne se dit pas « à rendre » : la fenêtre dit de combien il la
  dépasse, parce que c'est presque toujours une faute de montant.
- **Une facture que ses avoirs annulent en entier proposait encore « Corriger par un avoir… »** en
  bouton principal — c'est-à-dire un avoir de trop. Le bandeau dit qu'il n'y a plus rien à corriger.
- **Un trop-perçu s'affichait « Reste à payer 0,000 DT » en vert** : un avoir émis après le paiement
  laisse de l'argent au client, et c'était écrit en petit gris sous un zéro rassurant. La carte dit
  « Trop-perçu », en couleur d'alerte, et ce qu'on en fait : le rendre, ou le déduire de sa prochaine
  facture.
- **Une facture payée en entier se disait « déjà payée en partie »**, et une facture payée à moitié
  « soldée » dans la bulle du même bandeau. Trois raisons, trois phrases : payée en partie, payée en
  entier, corrigée par un avoir.
- **Un paiement se corrige et se supprime par un menu nommé**, plus par « ✎ » et « ✕ » : la suppression
  nomme le montant et la date. Sur un mois clôturé, le refus arrive avant la question — et il se lisait
  « Ce paiement ne peut pas être supprimé porte la date du… ».
- **Un règlement fournisseur se corrige** (il n'avait que « ✕ » : un compte mal choisi se rattrapait en
  supprimant pour ressaisir), et sa fenêtre annonçait en dinars le reste d'un achat en euros.
- **Sur une facture émise, les champs de texte gardaient l'air modifiables** — fond blanc, texte foncé —
  pendant que les listes voisines se grisaient. Tous les champs fermés se grisent.
- La question du comptable et la clé d'une licence s'affichaient sans leur encadré, les notes d'un
  contrat récurrent tenaient dans un tiers de la fenêtre, et l'option « Grand livre, balance, états
  financiers » se lisait comme un module de plus : cinq présentations que l'application demandait et
  que sa feuille de style ne connaissait pas. La fenêtre d'un contrat s'élargit pour ses lignes (la
  désignation avait 135 px).
- « Timbre fiscal (1,000 DT) » s'écrivait en quatre morceaux sur deux lignes, la parenthèse seule sous
  le mot ; les statuts d'une liste déroulante commencent par une majuscule ; et le bouton retour d'une
  facture tirée d'un devis dit « ← Devis DEV-2026-006 », plus « ← le document ».
- **Une liste vide montrait deux boutons verts pour le même geste** — « + Nouveau client » en haut,
  « + Ajouter mon premier client » juste en dessous — sur huit pages, dont les Licences de l'éditeur.
  Tant que la liste est vide, seul le bouton de l'état vide est vert.
- **Cliquer « Facturation récurrente » faisait sauter la barre latérale** : l'entrée active passait en
  gras, donc à la ligne, et tout le menu en dessous descendait de 14 px sous le curseur. L'entrée
  active se reconnaît à son fond et à sa couleur, et ne change plus de place — dans les deux
  applications.
- **Choisir le client d'une facture neuve faisait descendre tout le formulaire de 40 px** : le repère
  « non enregistré » apparaissait à côté du titre, l'en-tête s'élargissait et passait sur deux
  rangées — le clic suivant, visé sur « Objet », tombait à côté. Et « Enregistrer le brouillon »
  passait au vert à côté d'« Émettre la facture ». Le repère se lit désormais sous l'en-tête, sans
  rien pousser (« Modifications non enregistrées »), et « Émettre » reste le seul vert : émettre
  enregistre aussi.
- **Taper une désignation que le catalogue ne connaît pas posait « + Créer … au catalogue » exactement
  sur la quantité et le prix** : le clic suivant ouvrait une fiche de prestation au lieu du prix. La
  proposition de créer n'apparaît plus seule que si on la demande — flèche du bas, ou « Choisir
  l'article… » d'un avertissement ; elle reste en bout de liste quand des articles correspondent.
- **Un achat qu'on venait d'enregistrer gardait « Enregistrer » en vert**, et son panneau des règlements
  en posait un second : deux verts, dont aucun n'était l'étape suivante. Le règlement l'est ;
  « Enregistrer » redevient le seul vert dès qu'on modifie la pièce — la règle des devis et des
  factures, qui n'avait jamais été portée aux achats.
- La liste des fournisseurs (ou des clients) d'une entreprise neuve disait « Aucun résultat » sous un
  champ où l'on n'avait rien tapé : elle dit « Aucun fournisseur pour l'instant ».
- **Une facture neuve imprimait deux délais qui se contredisent** : « À régler avant le 23/10/2026 »
  en tête, et « Paiement par virement bancaire à réception de la facture » dans son bloc de
  règlement. C'était la phrase par défaut de SkanFact, sur une facture à trente jours. Le défaut ne
  dit plus que le moyen de paiement ; une phrase restée ainsi n'est jamais réécrite — elle se règle
  dans Paramètres → Mon entreprise — mais l'émission la montre dans son récapitulatif, avant de
  signer.
- **Sur la fiche d'un client, le pied du tableau des documents additionnait le devis avec sa
  facture** : « 1 520,440 DT » en net à payer, le devis déjà facturé compté deux fois. Quand la liste
  mêle des devis aux factures, le pied ne totalise que les factures et les avoirs, et le dit.
- « Paramètres » et « Aide », allumés dans le pied de la barre latérale, passaient encore en gras :
  ils suivent la règle du menu.
- **Sur un ordinateur réglé en anglais, un prix tapé « 2,5 » devenait 25** : les champs de montant
  suivaient la langue du système, qui prend la virgule pour un séparateur de milliers — une facture dix
  fois trop chère, sans un mot. SkanFact impose désormais le français à ses champs sur tous les postes :
  la virgule est la décimale, le point reste accepté.
- **La recherche (Ctrl K) montrait un avoir en positif**, et dans la devise de l'entreprise, quand la
  liste des factures, juste derrière, le disait en négatif et dans sa devise : elle prend maintenant le
  montant de la liste. Et un mot que seul le texte d'un article d'Aide contient (« assiette », l'exemple
  que l'Aide donne elle-même) y rendait « Aucun résultat » : elle cherche l'Aide comme la page Aide.
- **La page Stock, sans article suivi, n'avait qu'un bouton vert : « + Mouvement »** — un mouvement de
  rien — et expliquait en toutes lettres où aller cocher une case. Elle propose « + Nouvel article
  suivi » (la fiche arrive déjà suivie) et « Choisir dans le Catalogue ». Même correction sur l'onglet
  des numéros de série, dont « + Nouvelle prestation suivie » ouvrait une fiche non suivie.
- **Le pied du Catalogue faisait la moyenne d'un prix à l'heure, d'un lot et d'une pièce**, et posait la
  valeur du stock sous la colonne TVA : la moyenne ne paraît plus que dans une seule unité (qu'elle
  nomme), et la valeur du stock vit sous « Stock ».
- **« Partir d'une facture existante » (Facturation récurrente) emmenait à la liste des factures**, où
  rien ne disait quoi faire ensuite. On choisit la facture sur place, et le contrat s'ouvre prérempli
  de son client, de ses lignes et de sa devise. Même chose sur « Proforma, bons et contrats » : un
  onglet vide propose « Partir d'un devis existant » au lieu de renvoyer au menu « Transformer ».

**Une entreprise a tenu SkanFact, et son rapport** — une session a joué une vraie entreprise
tunisienne (régime réel, assujettie à la TVA), du premier écran au paquet du comptable, par de vrais
clics et de vraies frappes. Ce qu'elle a trouvé, corrigé :
- **La trésorerie comptait un achat en devise à sa valeur faciale** : une facture de 1 190 €
  (1 € = 3,4 DT) sortait de la prévision pour 1 190 DT au lieu de 4 046. Le trou annoncé à trente
  jours était sous-estimé de 2 856 dinars, jusque sur l'accueil — sur la page faite pour savoir si
  l'on pourra payer le mois prochain. Le lettrage des fournisseurs avait le même défaut. Les deux
  convertissent, comme la page Achats.
- **Le stock se valorisait dans le désordre** : trois gestes le même jour (stock de départ de 5 à
  700, vente de 2, achat de 3 à 800) donnaient 4 300 DT au lieu de 4 500 — la vente sortait au coût
  de l'achat qui la SUIT, et « Stock après » affichait 6, 1, 3 au lieu de 5, 3, 6. Dans une journée,
  le stock de départ passe en tête, puis chaque mouvement à l'instant où il a eu lieu : une facture à
  son émission, pas à la création de son brouillon.
- **« + Créer mon premier contrat » ne faisait rien** — une erreur invisible à l'écran, sur le
  bouton de la page vide, celui qu'on trouve à son premier contrat. Il ouvre le formulaire. Et
  « Partir d'une facture existante » ne se propose plus à une entreprise qui n'en a aucune.
- **Un bulletin au net négatif enregistré avant la 10.10.0 restait sans alerte**, et la déclaration
  CNSS de son trimestre l'additionnait sous « Marquer déposée ». « À faire » le signale en rouge en
  nommant le salarié et le mois (le bouton mène à ce mois-là), et la déclaration ne se marque plus
  déposée tant qu'il n'est pas corrigé — le bouton dit pourquoi.
- **La fenêtre d'acompte annonçait un solde faux de deux dinars** : elle retranchait le timbre de
  l'acompte du total du devis et oubliait celui du solde. C'est le chiffre qu'on donne au client au
  téléphone. Elle annonce maintenant les deux factures telles qu'elles seront fabriquées. Au passage :
  une facture tirée d'un devis reprend l'exonération de timbre du client — elle portait un timbre à
  un client qui en est exonéré.
- **Un devis dont l'acompte attendait en brouillon se laissait facturer en entier**, sans une
  question : deux brouillons qui se recouvrent, 150 % du devis. Le bouton vert devient « Ouvrir
  l'acompte en brouillon », « Facturer ce devis » demande en nommant l'acompte, et l'émission d'une
  facture qui reprend tout un devis prévient quand ce devis a déjà donné une autre pièce.
- **La colonne « N° » du fichier d'écritures envoyé au comptable était vide** — celle qui regroupe
  les lignes en pièces à l'import. Elle porte le numéro que l'écran affiche.
- **« Aucune pièce datée pour l'instant »** s'affichait sur un dossier qui en portait cinq, toutes du
  mois en cours. La page Clôtures dit la vraie raison, et le jour où ça changera : « Tes 5 pièces
  sont toutes datées de septembre 2026, le mois en cours : un mois se clôture une fois terminé, donc
  à partir du 1er octobre 2026. »
- **SkanFact parlait du « Finder » sous Windows**, la plateforme sur laquelle il est distribué. Après
  un envoi, il dit « l'Explorateur » ; les raccourcis de l'Aide et des bulles s'écrivent avec Ctrl ;
  le choix « Mail (Apple) » n'est plus proposé hors d'un Mac ; et les envois au comptable (CNSS,
  écritures, journal des ventes, paquet) suivent la messagerie choisie et disent où trouver le
  fichier à glisser.
- **La page Marges affichait « undefined » cinq fois** sous son tableau : sa pagination est réparée.
- **Le RIB est vérifié** : vingt chiffres et leur clé, ou un IBAN. Une faute de frappe se voit
  pendant qu'on tape (en orange, jamais un refus), l'émission d'une facture prévient, et la fiche
  société ne se dit plus complète sur un RIB de dix chiffres — l'assistant prévient lui-même qu'une
  erreur ici, c'est un paiement qui n'arrive jamais.
- Le capital s'écrit comme les autres montants des documents : « Capital 10 000 DT », plus
  « Capital 10000 ».
- La fenêtre de partage d'un dossier nomme la clé qui signe les paquets pour le comptable : c'est le
  seul secret qui part avec le dossier, et elle ne le disait pas.
- Les petites fautes : « Établir les 1 bulletin manquant » ; « le traitement fiscal de cette
  plus-value » sous une moins-value ; « 5 prestation, 12 document, 2 bulletin de paie » dans la
  confirmation de l'exemple et de « Tout effacer » ; « Acompte versés » dans le filtre des achats ;
  un numéro de version interne, « (9.0.0) », dans une phrase des Barèmes ; « Tous les bulletins du
  mois sont établis » au-dessus de « Aucun bulletin » d'un mois sans salarié en poste ; et un délai
  moyen de « −3 jours » dans les Statistiques.
- Trouvé en corrigeant : la page Paie d'une entreprise sans salarié montrait deux boutons verts pour
  le même geste (« + Salarié » en haut, « + Créer mon premier salarié » dessous). Seul le second
  reste vert.
- **Quatre phrases promettaient que rien ne part sur Internet** — le premier écran de l'assistant,
  l'article « Démarrer », le panneau de la licence (« n'est présentée qu'au service de mise à jour »)
  et l'article de la licence. SkanFact se connecte pour chercher ses mises à jour et pour vérifier que
  la licence n'a pas été révoquée ; il envoie alors la clé, le nom et le système de l'ordinateur et
  sa version. Les phrases le disent, et redisent ce qui ne part jamais : tes documents, tes clients,
  tes chiffres.

**Une menuiserie tenue à la souris et au clavier** — une vraie entreprise (Menuiserie Kmar SARL),
du premier écran à son catalogue, pour voir ce qu'un chef d'entreprise subit :
- **Un prix tapé dans un champ à 0 devenait dix fois trop cher.** Le prix d'une prestation neuve
  vaut 0, aligné à droite : un clic à gauche du champ posait le curseur DEVANT le 0, et « 850 » tapé
  donnait 8 500 DT. Tout champ de nombre sélectionne maintenant ce qu'il contient quand on y entre,
  comme une cellule de tableur : la frappe remplace la valeur proposée.
- **Une ligne du Catalogue s'ouvre au clic**, comme celles des Clients, des Factures et des Achats.
  « Tes premiers pas » disait « Ouvre-en une, mets ton prix » : le clic ne faisait rien, il fallait
  trouver « Actions ▾ → Modifier ». Vrai aussi pour les modèles et les textes prédéfinis.
- **Un seul bouton vert à la fois**, trois fois : à la dernière étape de l'assistant, « Choisir un
  dossier… » et « Terminer » étaient verts côte à côte (le vert passe à « Terminer » une fois la
  copie en place) ; sur l'accueil, « + Nouvelle facture » était vert au-dessus de « + Créer un
  client », l'étape suivante ; et le panneau « Et maintenant » proposait « + Créer ton premier
  devis » en vert juste sous « Remplir le catalogue » en vert — il ne s'affiche plus tant que « Tes
  premiers pas » parle.
- **« OneDrive » sous Windows** : la copie de sauvegarde proposait « iCloud Drive » à tout le monde,
  y compris sur la plateforme où SkanFact est distribué. Et « Si le Mac meurt » est devenu « Si cet
  ordinateur meurt ».
- La fiche d'une prestation range la phrase de marge sous les deux prix qu'elle compare (elle
  tombait sous la TVA), met TVA et Unité sur la même rangée, et dit la devise des deux prix.
- **Un montant ne se coupe plus en fin de ligne** : « 4 530,188 DT » s'affichait « 4 » d'un côté,
  « 530,188 DT » de l'autre, dans la fenêtre qui annonce le solde d'un acompte. Les espaces d'un
  montant sont désormais insécables, partout — à l'écran, dans les PDF et dans les mails. Les
  fichiers CSV envoyés au comptable ne changent pas.
- **Un paiement sans compte de trésorerie propose de le créer, par-dessus** : l'assistant avait
  demandé la banque et le RIB, et le paiement répondait « aucun compte » avec un lien vers la
  Trésorerie qui quittait la fenêtre et jetait la saisie. Le compte s'ouvre prérempli avec la
  banque et le RIB de la société.
- **La marge estimée se pose sous les totaux** : en apparaissant au premier coût connu, elle faisait
  sauter la carte des totaux de 250 px vers la gauche pendant la frappe.
- L'Objet d'un devis ne propose plus « Ex : Audit de sécurité du réseau » à tous les métiers ; le
  relevé de compte d'un client ne défile plus de côté quand une pièce porte un long libellé.
- « Timbre fiscal par facture » dit son unité, dans les Paramètres et dans l'assistant — où elle
  suit la devise choisie juste au-dessus.
- **Le solde d'un devis n'était réclamé nulle part.** Un acompte porte le lien vers son devis comme
  une facture entière : dès l'acompte facturé, le devis quittait « À faire » — et les 70 % restants
  (4 598 DT sur ce chantier) n'apparaissaient plus sur aucun écran. Le devis y reste tant qu'aucune
  facture de solde n'existe, pour le montant qui reste, acomptes déduits.
- **« Facturer le solde » depuis la liste des devis.** Le menu de la ligne ne proposait que
  « Refacturer la totalité… », c'est-à-dire de facturer une seconde fois l'acompte. Et sur un devis
  déjà soldé, l'éditeur gardait « Facture de solde » en vert : un clic en fabriquait une seconde. Les
  deux passent par la même fonction, qui demande avant un second solde.
- **L'émission d'un solde nomme son devis et l'acompte qu'il déduit**, celle d'un acompte sa part du
  devis : c'est ce qu'on vérifie avant d'envoyer.
- **La barre d'une facture ne change plus de forme selon la page d'où l'on vient.** À 1440 px,
  « ← Factures » tenait sur une rangée et « ← Hôtel Dar El Marsa SARL » la faisait passer sur deux :
  « Plus ▾ » seul en dessous, tout le formulaire 43 px plus bas, et le clic visé sur « Émettre »
  tombait sur « Enregistrer le brouillon ». Le retour s'abrège à dix-huit caractères, et
  « Agrandir » — en double avec celui de la colonne d'aperçu — ne revient dans la barre que quand
  cette colonne est masquée.
- **« + Nouveau fournisseur » reprend ce qu'on vient de chercher.** « Bois du Sahel » introuvable,
  la fiche s'ouvrait vide et il fallait retaper le nom — et la frappe dans la recherche avait déjà
  marqué la pièce « modifiée », « Enregistrer » rallumé en vert sur une facture d'achat où rien
  n'avait changé. Toutes les listes à « + Nouveau… » (clients, fournisseurs, affaires, catégories,
  prestations) préremplissent le nom ; chercher ne modifie plus rien.
- **Les invites ne supposent plus le métier de l'auteur** : l'Objet d'un achat proposait « disques
  durs pour la Clinique », celui d'un contrat « Maintenance et supervision » — à une menuiserie.
- La colonne « Déduct. » d'une facture d'achat garde sa bulle sur la même ligne.
- **Une ligne de stock sans article propose de le créer** quand rien du catalogue ne lui ressemble :
  le bouton disait « Choisir l'article… » et la liste n'offrait que la création, sous un trait qui
  séparait du vide.
- **Un prix de vente à 0 n'est plus « une vente à perte »** : l'article créé depuis un achat arrive
  avec son coût et sans prix, et la fiche criait « Marge : − 38,500 DT — tu vends à perte » en orange
  sur une planche qu'on ne revend pas telle quelle. Elle dit que la marge viendra avec le prix.
- **La matière utilisée et la casse sont enfin des charges.** Le résultat simplifié et le seuil de
  rentabilité ne comptaient comme charge que les articles VENDUS : une menuiserie qui achète des
  planches et les transforme en portes ne voyait jamais son bois en charge, et une casse faisait
  disparaître de la valeur du stock sans rien coûter au résultat. Toute sortie de stock qui n'est pas
  un achat ni le stock de départ compte désormais, à son coût moyen — et un retour sur avoir rend son
  coût. Nouvelle nature de mouvement : « Matière utilisée ». La comptabilité
  ne change pas (les achats au 607, l'inventaire au 603). La carte s'appelle « Coût des sorties de
  stock ».
- **Noter les 10 planches posées sur un chantier les RETIRAIT enfin du stock.** La quantité d'un
  mouvement se tapait signée (« -2 pour une sortie ») : un menuisier qui tapait « 10 » faisait
  GAGNER dix planches à son stock, valorisées, et la fenêtre annonçait « Après ce mouvement : 50 . »
  sans rien dire. Pour la matière utilisée et la casse, le champ s'appelle « Quantité sortie » et
  prend un nombre sans signe ; l'annonce dit « Sortent 10 : il en restera 30 ». L'inventaire et
  l'ajustement restent signés, parce qu'ils vont dans les deux sens. Au passage : l'annonce ne fait
  plus remonter toute la fenêtre à chaque chiffre tapé (sa hauteur est réservée), la nature ne se
  coupe plus dans sa liste, et un refus posé sur un champ d'une fenêtre (la réponse vide au
  comptable) ne plante plus.
- **Le premier bulletin d'un ouvrier embauché le 24 lui comptait un mois entier.** Le brut de la
  fiche était repris tel quel, quel que soit le jour d'entrée ou de sortie : 1 200 DT pour six jours
  de travail. Une entrée ou une sortie en cours de mois proratise maintenant le brut proposé, en
  jours ouvrables (276,923 DT pour six jours sur vingt-six), et le bulletin le dit — la méthode est
  à faire valider par ton comptable, et le brut reste modifiable.
- **La Paie s'ouvre sur le mois où il y a un bulletin à établir.** Elle s'ouvrait toujours sur le
  mois précédent : « aucun salarié en poste en août » pour une entreprise qui venait d'embaucher en
  septembre, et rien ne menait à septembre. Un mois vide propose désormais d'aller au bon.
- **« Net versé » ne compte plus que ce qui est payé**, et dit ce qui reste à verser. Il annonçait
  249 DT « versés » au-dessus d'un bulletin « pas encore » payé.
- **« Marquer payé » sur la ligne d'un bulletin**, avec « Annuler ». La ligne portait « PDF » et
  « Modifier », et il fallait ouvrir le bulletin pour trouver « Payé le » ; les deux autres gestes
  vivent dans le menu Actions.
- **Les annonces qui se récrivent pendant la frappe ne font plus bouger les fenêtres** : le net
  d'un salarié, le plan d'un bien, la marge d'un article, le stock obtenu. Passant d'une ligne à
  deux, elles faisaient remonter la fenêtre et « Enregistrer » glissait sous le curseur.
- **La palette ne propose plus deux fois la même destination** (« Paie → Bulletins » et « Bulletins
  de paie ») ; « Seuil de rentabilité » y ouvrait l'onglet Affaires. Les mots qu'on tape mènent
  toujours au bon onglet.
- **« Comprendre cette page → » ne disparaît plus** de la Paie, du Stock et du Catalogue au premier
  clic ; le type de contrat se lit en entier (« CDI », la définition en infobulle).
- **Un trimestre CNSS ne se réclame qu'une fois terminé.** Le 24 septembre, « À faire » annonçait
  « 1 déclaration sociale à déposer : CNSS 3e trimestre » — et on pouvait la marquer déposée sans
  les bulletins de la fin du mois. Le rappel arrive le 1er octobre, quinze jours avant l'échéance.
- **Le paquet d'un mois vide dit quand viendra le premier.** Une menuiserie qui a commencé en
  septembre ouvrait l'envoi au comptable sur août, lisait « commence par émettre une facture »
  (elle en avait émis deux) et se voyait proposer « Clôturer août 2026 » sur un mois sans rien.
  L'écran dit maintenant que ses pièces commencent en septembre, et que le paquet de septembre se
  prépare à partir du 1er octobre.
- **Le stock sans prix de vente dit « — »**, plus « 0,000 DT, ce qu'il rapporterait vendu » sur
  1 540 DT de planches ; la note d'un mouvement de stock n'invite plus « Deux disques tombés à la
  livraison ».

**La menuiserie, suite : relances, contrats, autres pièces, affaires et marges** — le même chantier,
continué page par page :
- **Une affaire se crée après coup, et ses factures déjà émises y entrent.** On découvre la page
  Marges quand le chantier a déjà ses factures ; le champ Affaire d'une facture émise était grisé,
  donc la marge du chantier restait fausse pour toujours. L'affaire n'est qu'une étiquette de gestion
  (elle ne s'imprime pas et ne change aucun chiffre) : elle se pose ou se retire sur une pièce émise,
  enregistrée tout de suite. Et la fiche d'une affaire gagne **« Rattacher des ventes… / des
  achats… »** : une fenêtre coche ce qui appartient au chantier — l'avoir suit sa facture, la
  recherche lit le contenu d'un achat (« chene » trouve les planches), décocher détache, et
  « Annuler » remet tout.
- **« + Devis » et « + Achat » depuis une affaire créent des pièces RATTACHÉES** ; ils ouvraient des
  pièces vierges qu'on croyait comptées dans la marge du chantier. La fiche montre aussi les
  brouillons (le devis qu'on venait d'y créer disparaissait), et son bouton vert est l'étape suivante :
  rattacher les ventes du client, sinon créer le devis, puis les achats.
- **Un devis facturé ne compte plus « en devis ».** La fiche d'une affaire annonçait 5 520 DT
  facturés PLUS 5 520 DT en devis pour un seul chantier ; seule la part pas encore facturée compte
  (un acompte émis se retranche).
- **Une marge sans aucun achat rattaché n'est plus « 100 % » en vert** : la fiche, la liste des
  affaires et la fiche du client disent « aucun achat rattaché : le coût n'est pas encore compté ».
- **« — Aucune affaire — » en tête de chaque liste d'affaires** : une affaire choisie par erreur ne se
  retirait plus jamais d'une pièce. Et changer le client d'une pièce retire l'affaire de l'ancien
  client — elle y restait, invisible, et comptait le devis du client B dans le chantier du client A.
- **La page Marges vide propose « + Créer ma première affaire »** (elle expliquait en prose sous un
  vert qui doublait) ; « + Nouvelle affaire » n'est vert que sur l'onglet Affaires ; l'onglet Contrats
  vide dit si un contrat existe et n'a produit que des brouillons, et mène à la facturation
  récurrente ; la légende du « ≈ » ne s'affiche que si une ligne le porte.
- **« Fixe ou variable ? » ne déplace plus une charge sous le curseur.** Cocher « Assurances »
  l'envoyait dans l'autre colonne et « Honoraires » montait à sa place : un second clic reclassait
  une charge qu'on n'avait pas visée. Chaque catégorie garde sa ligne et porte son choix Fixe /
  Variable.
- **Une proforma, un bon de commande ou de livraison propose sa suite dans son menu de ligne** :
  « Facturer », « Établir le bon de livraison »… — ou « Voir » la pièce quand elle existe déjà **pour
  cette vente**, même tirée d'une autre pièce de la chaîne (un bon de livraison tiré d'une proforma
  déjà facturée proposait de facturer une seconde fois). L'éditeur de ces pièces a enfin un bouton
  vert : « Enregistrer » tant qu'une pièce tirée d'une autre n'a pas de numéro, « PDF » pour un bon
  de livraison à faire signer, « Transformer ▾ » pour ce qui n'a encore rien donné.
- **Une proforma envoyée par email passe à « envoyée »** et part sans le tampon « BROUILLON » : seul
  le devis le faisait. Même chose pour un bon de livraison, un bon de commande et un contrat.
- **Un délai de 0 jour est « à réception »** : réglé à 0, le délai de paiement repassait à trente
  jours. Et une facture due le jour même dit « À réception » plutôt que « À régler avant le » sa propre
  date.
- **Une recherche tapée ignore les accents et les majuscules, mot par mot**, dans les quinze
  recherches de l'application, la palette Ctrl K et l'Aide comprises : « hotel » trouve l'Hôtel Dar
  El Marsa, « delai » le délai de paiement.
- **Un contrat récurrent ne pose plus de timbre sur les factures d'un client exonéré** ; son total
  dit ce qui manque au lieu d'annoncer un dinar sur un contrat vide ; chaque champ a sa bulle.
- **La page Relances vide dit quand elle se remplira** : la facture qui arrive à échéance, et quand.
- **Le retour nomme la fiche d'où l'on vient** — affaire, salarié, bien, article, contrat, achat — et
  une page de création quittée sans l'enregistrer n'entre plus dans la pile (le retour rouvrait un
  achat vierge).
- **L'entrée allumée de la barre latérale reste visible** : après un rechargement, la pastille de
  l'essai rétrécissait la liste et « Marges » finissait 12 px sous le bord.
- **Une bulle « i » ne passe plus seule à la ligne** : le dernier mot part avec elle. Une espace
  insécable ne suffisait pas — la sonde des bulles l'a vu à 1280 px.
- Dans une rangée de cartes, les chiffres sont à la même hauteur ; un classement (Top clients) se lit
  en colonnes ; les liens au fil du texte ont une couleur ; l'aperçu d'un document de deux pages ne
  fait plus naître de barre de défilement horizontale ; l'en-tête d'une page ne grandit plus quand
  une liste d'années paraît sur un onglet.

**La menuiserie, suite : ses biens et son personnel** — immobilisations, congés, avances, documents
du personnel, déclarations sociales, registre et barèmes, tenus à la souris et au clavier :
- **Une tranche du barème de l'impôt se tape enfin.** Le formulaire redessinait les lignes du barème
  à chaque frappe : le premier chiffre détruisait le champ, le curseur tombait dans la page et la
  tranche revenait à son ancienne valeur. On ne pouvait la changer qu'en passant par les flèches — ou
  pas du tout. Et **« Enregistrer les barèmes » vit dans une barre qui n'apparaît qu'après une
  modification**, collée au bas de l'écran, comme celle des Paramètres : il était vert au repos, trois
  écrans sous le premier taux, et changer d'onglet jetait ce qu'on venait de régler sans rien
  demander. Les montants disent leur unité (« Plafond annuel des frais (DT) »), et revenir aux valeurs
  livrées se confirme par son nom, plus par « Confirmer ».
- **Une déclaration sociale se marque déposée une fois la période terminée.** « Marquer déposée »
  était vert sur le trimestre en cours et sur l'année en cours : la mention aurait figé une
  déclaration sans ses derniers bulletins. Le bouton s'éteint en disant jusqu'à quand.
- **Une absence annonce le solde de congés avant ET après** (« 1 jour avant, −3 jours après »), avec
  l'avertissement AVANT d'enregistrer ; on découvrait le rouge dans les compteurs, une fois
  l'absence posée. Modifier une absence ne la retranche plus deux fois de l'annonce.
- **Une avance ne propose plus « 0 »** : le montant et la retenue sont vides, dits obligatoires, et
  un refus montre le champ. L'annonce du remboursement ne s'affiche plus en gras.
- **Les absences, les avances, les bulletins de la fiche d'un salarié et le registre du personnel
  s'ouvrent en cliquant la ligne** ; les « Modifier » en bout de ligne sont partis, le PDF d'un
  bulletin reste. Une avance en cours n'est plus peinte en orange : c'est son état normal.
- **« Établir un document… » vit dans l'identité du salarié**, plus dans le panneau des avances — une
  attestation de travail n'est pas une avance. Le solde de tout compte dit un solde de congés
  négatif, et une panne du PDF se dit en français.
- **« −3 jours », plus « −3 jour »** : un nombre négatif s'accordait au singulier, dans les deux
  applications.
- **Une fenêtre s'ancre en haut de l'écran** : elle se recentrait en grandissant, et choisir « Solde
  de tout compte » faisait remonter de 196 px la liste qu'on venait de manipuler.
- **« Impôt retenu »** remplace « IRPP » sur la colonne qui additionne l'IRPP et la solidarité, avec
  sa bulle.
- **Immobilisations** : une fiche neuve ne part plus sur « Matériel informatique, 3 ans » (la famille
  se choisit, et propose la durée) ; un bien sorti sans prix n'est plus « vendu 0,000 DT » et sa
  sortie ne crie pas avant qu'on ait tapé un prix ; la carte dit combien de biens restent à l'actif
  et combien en sont sortis ; un bien entièrement amorti n'est « sorti » que l'année de sa sortie.
  « Créer la fiche du bien… » depuis un achat l'enregistre d'abord puis ouvre la fiche préremplie,
  et une ligne qui a sa fiche le dit et mène à elle ; l'onglet « À immobiliser » n'a plus qu'un vert.
- Le bouton « + Nouveau fournisseur » d'une liste reprend ce qu'on vient d'y taper, et la colonne
  « Total HT » d'une grille de lignes ne s'élargit plus pendant la frappe.

**L'application entreprise mesurée en entier.** Ses instruments ne regardaient qu'une partie de
l'application : aucun n'ouvrait une fiche ni une pièce par statut, et l'un visitait une adresse qui
n'existe pas. `npm run e2e:entreprise-rendu` ouvre toutes les pages, tous leurs onglets, chaque
fiche, chaque pièce par type et par statut, et chaque fenêtre qu'un bouton ouvre, en clair et en
sombre, à deux largeurs — 296 écrans par passe. Il a trouvé « + Créer mon premier contrat » (plus
haut), le relevé de compte d'un client qui cachait « Reste dû » et son total derrière un défilement
de côté (la fenêtre s'élargit), et les titres « Qté » et « P.U. HT » des grilles de lignes, alignés à
gauche au-dessus de chiffres alignés à droite, dans les cinq éditeurs qui en ont — et, dans les
Barèmes et le calendrier fiscal, « De », « Jusqu'à » et « Jour limite ». Il mesure depuis deux choses
de plus, dans les deux applications : aucun chiffre plus bas que ses voisins dans une rangée de
cartes, et aucune bulle « i » seule sur sa ligne ; les liens y sont jugés comme les boutons (lisibles,
jamais au bleu du navigateur).

**La console de l'éditeur**
- **Le Journal écrivait « commande.creee »** en chasse fixe : les cinq événements de la vente en ligne
  n'avaient pas de nom. L'écran des commandes disait « 1 ligne » au lieu de « 1 commande », et
  l'alerte la plus grave de la console proposait « Ouvrir commandes ».
- Les alertes et le journal écrivent leurs dates et leurs montants comme l'écran : « Fin le
  14/10/2026 », « 1 822,100 TND » — plus « 2026-10-14 » ni « 1822.1 ».
- Les colonnes de texte se partagent la place que les autres laissent : le détail d'un événement
  n'est plus coupé à 260 px à côté de deux colonnes à moitié vides.

**La menuiserie, fin du tour : stock, trésorerie, déclarations, réglages** — la clôture, le paquet,
les Paramètres, les statistiques, les séries, la devise, l'avoir fournisseur, l'inventaire, le
rapprochement et le thème sombre, tenus à la souris et au clavier :
- **Un comptage d'inventaire se tape enfin.** Le tableau se redessinait à chaque chiffre et le champ
  recréé rendait son curseur au début : « 28 » planches comptées devenaient **82**, un écart de +52
  prêt à être enregistré en mouvements. Pire, la sélection automatique des champs de nombre (plus
  haut) prenait ce focus rendu par le code pour une entrée, sélectionnait le « 2 », et le « 8 » le
  remplaçait. La ligne se met à jour sur place, et un champ ne sélectionne son contenu que quand on y
  entre soi-même (clic ou Tab). Le bouton dit « Enregistrer les écarts » tant qu'il n'y en a pas, et
  un écart s'écrit « −2 » avec le même signe moins que les montants.
- **Une alerte de stock mène à l'achat.** Chaque alerte portait deux boutons, « Ajuster » et « Voir » —
  et « Ajuster » pour un stock négatif, qui ne s'ajuste jamais : c'est un achat oublié, et l'ajuster
  perdrait sa TVA déductible. Un seul bouton, « Commander… » ou « Saisir l'achat oublié… », ouvre une
  facture d'achat qui porte déjà l'article, la quantité à commander et son coût, en stock ; la ligne
  ouvre la fiche de l'article.
- **Une CNSS déposée n'est plus réclamée deux fois.** La déclaration trimestrielle avait deux
  pense-bêtes — celui de la Paie et celui du calendrier fiscal — qui ne se voyaient pas : la marquer
  déposée dans la Paie laissait le calendrier la réclamer, « À faire » la nommait deux fois, et le
  calendrier acceptait « déposée » sur un trimestre pas terminé. Une échéance du calendrier désigne
  maintenant la déclaration qu'elle rappelle, et c'est la Paie qui fait foi ; une mention posée avant
  cette version compte encore.
- **Le matricule CNSS de l'entreprise manquait sans un mot** sur la déclaration trimestrielle : elle le
  dit, AVANT les boutons, avec « Le renseigner » qui ouvre la fiche société le curseur dans la case.
  Un renvoi vers les Paramètres peut maintenant désigner un champ, et un test vérifie que chaque champ
  visé existe.
- **Le rapprochement répond pendant qu'on recopie son relevé** : « Ça tombe juste » ou « Écart de … »
  s'affiche à la frappe, plus seulement en quittant la case.
- **Une recherche de liste garde la place du curseur** : corriger une lettre au milieu de « Trabelsi »
  envoyait la suivante au bout du texte, dans six recherches (Clients, Relances, Stock, séries,
  journaux). La fonction du Cabinet sert maintenant les deux applications. Le choix du compte, dans
  la Trésorerie, porte son nom pour le clavier et les lecteurs d'écran.
- **Un avoir fournisseur se présente comme un avoir** : titre, « Numéro de l'avoir », invite et phrase
  des lignes (« l'avoir retire cette TVA ») suivent la nature quand on la change — il s'ouvrait sous
  « Nouvelle facture d'achat » et promettait de « récupérer la TVA ».
- **Le taux de change naît en fin de formulaire** : choisir « EUR » faisait sauter Statut et Remise
  d'une colonne. Son libellé est le même dans les deux éditeurs (« 1 EUR = ? DT »), son invite écrit
  « 3,4 », et une pièce anglaise l'écrit à l'anglaise (« 3.350 ») comme ses autres montants.
- **Un seul vert par onglet de Paramètres** : « Activer un mot de passe », « Enregistrer la clé » (sur
  une case vide) et « Signaler un problème » étaient verts au repos. Les deux premiers s'allument
  quand ils sont l'étape suivante (la copie externe posée, une clé neuve collée), le troisième plus
  jamais. « Il n'existe aucune récupération » se lit avant le bouton qui l'engage.
- Un seuil de retenue ou un objectif à zéro s'affiche vide (« aucun seuil », « aucun objectif ») avec
  son unité ; une phrase ne désigne plus les boutons « le premier… le second » mais par leur nom ; une
  phrase posée dans un champ n'a plus le gras de l'étiquette ; hors Mac, le choix « Mail (Apple) »
  n'est plus proposé.
- **Garanties et numéros de série** : une entreprise qui ne suit rien par numéro lisait « aucune
  garantie ne se termine » sous un sélecteur de durée. La page dit à quoi elle sert, et « Choisir une
  prestation à suivre… » ouvre sa fiche déjà cochée au lieu de renvoyer au Catalogue.
- **Clôtures et paquet** : le panneau « Rouvrir » ne s'affiche plus quand rien n'est clôturé ; un mois
  sans pièce ne montre plus un tableau de sept zéros ; un sélecteur ne s'étire plus sur toute la ligne.
- **Statistiques** : une entreprise créée cette année ne voit plus « 2025 » en légende au-dessus de
  barres à zéro, et un client n'est jamais à la fois parmi les plus rapides et les plus lents payeurs.
- Une question à un mot (« Autre taux… ») dit son geste au lieu de « OK », et une valeur refusée ne
  ferme plus la fenêtre avant de le dire — le taux tapé était perdu.
- L'objet d'un contrat ne finit plus sur un tiret (« Entretien des portes — »), le pied d'un relevé ne
  dit plus « dont 0,000 DT échu », l'Aide ne promet plus un « ? » qui n'existe pas (« Comprendre cette
  page »), et l'absence d'opération diverse ne prend plus un cadre d'écran.
- **Thème sombre** : « Tous les modules » et « Aide », au pied de la barre, restaient gris foncé sur
  fond foncé (contraste 2,1). Un test vérifie maintenant, dans les deux applications, que toute couleur
  de texte foncée écrite en dur a sa jumelle sombre.

**Données, sécurité et deuxième entreprise** — les sauvegardes, la restauration, le mot de passe,
le verrouillage, « Tout effacer » et la création d'une seconde société, refaits à la souris :
- **Un refus de saisie montre sa case, dans toutes les fenêtres.** Vingt-cinq refus (mot de passe,
  paiement, relance, report, règlement, affaire, mouvement de stock, commande, numéros de série,
  compte, mail, paquet, assistant…) se contentaient d'un message rouge de trois secondes : il fallait
  relire la fenêtre pour trouver quoi corriger. La case refusée est maintenant amenée à l'écran, le
  curseur dedans, bordée de rouge ; le métier refusé dans l'assistant marque sa grille. Un test
  l'exige pour tout refus jugé sur un champ.
- **Le mot de passe** : un ancien mot de passe faux marque sa case ; l'ancien est sur sa propre rangée
  (« Confirmation » tombait sous lui, loin du nouveau qu'elle confirme) ; après le geste, l'écran revient
  sur le panneau du mot de passe au lieu du haut de l'onglet ; et « Retirer le mot de passe » dit,
  avant le geste, que le fichier et ses sauvegardes repassent en clair.
- **Les sauvegardes se nomment.** La sauvegarde quotidienne s'appelait « Sauvegarde » dans la liste,
  comme celle prise avant la bêta : la règle qui devait la reconnaître ne la reconnaissait pas. Elle
  dit « Début de journée, avant la première modification », la question de restauration nomme aussi
  ce qu'était la sauvegarde, et le message après « Sauvegarder maintenant » ne montre plus un nom de
  fichier.
- **« Tout effacer » mène au bon bouton.** La fenêtre, la bulle et l'article de l'Aide envoyaient vers
  « Importer » pour revenir en arrière — chercher un fichier dans un dossier caché — alors que chaque
  sauvegarde a son bouton « Restaurer… ». Sur un dossier vide, la fenêtre faisait taper EFFACER pour
  ne rien effacer : elle dit maintenant « Rien à effacer ». Et « les factures émises partent aussi »
  n'est plus annoncé quand il n'y en a aucune.
- **Créer une deuxième entreprise passe par une seule porte.** Le menu du haut et les Paramètres en
  avaient chacun une copie, déjà différentes, et aucune ne demandait avant de jeter une saisie en
  cours — alors que créer recharge la fenêtre. La fenêtre dit qu'elle ouvre un dossier neuf, que
  l'entreprise actuelle reste intacte, et son bouton dit « Créer et ouvrir ». Un échec de création
  s'écrit en français, plus en message brut du système.
- **Le menu des entreprises ne coupe plus ses gestes** : « Partager cette entre… », « Rejoindre un
  dossie… » et le nom de l'entreprise ouverte se lisent en entier.
- **L'accueil ne se contredit plus sur les retards** : « 3 factures en retard » dans « À faire » et
  « 4 en retard » sur la carte « Reste à encaisser », dix centimètres plus bas — la quatrième avait sa
  relance reportée. La ligne dit « à relancer » et nomme l'autre.
- **Trois fenêtres avaient deux boutons qui font la même chose** : « Annuler » à côté de « Plus tard »
  (verrouiller sans mot de passe, message au comptable sans adresse) ou de « Le garder en brouillon »
  (PDF d'un devis). Il n'en reste qu'un, nommé.
- **Deux entreprises sur la même clé USB gardent chacune leur copie.** Le dossier de copie externe se
  règle pour tout l'ordinateur, et chaque entreprise y écrivait le même fichier : la copie de la
  première était effacée dès que la seconde enregistrait, et changer le mot de passe de l'une
  rechiffrait les sauvegardes de l'autre. Chaque entreprise a maintenant son sous-dossier (« SkanFact »
  pour la première, comme avant, « SkanFact — nom de l'entreprise » pour les suivantes), et le panneau
  dit lequel.
- **Changer d'ordinateur ramène aussi les pièces jointes.** Importer le fichier de la copie externe
  rendait les données et laissait sur la clé les photos et PDF joints, que la copie est pourtant le
  seul filet à emporter. Ils reviennent avec l'import, et l'article « Tes données » dit enfin comment
  reprendre sa copie sur un nouvel ordinateur.
- **Un dossier retiré se remet dans la liste.** « Retirer » promettait « tu pourras le rouvrir plus
  tard » sans dire comment, et le seul chemin — « Rejoindre un dossier déjà partagé » vers un dossier
  caché de l'application — le marquait partagé, ce qui coupait sa copie externe. Les dossiers retirés
  restent nommés sous « Retirés de la liste », avec un bouton « Remettre dans la liste » ; un dossier
  rangé sur l'ordinateur n'est plus jamais pris pour un dossier partagé ; et chaque ligne n'a plus
  qu'« Ouvrir » et un menu « Actions », au lieu de trois boutons côte à côte.
- Le panneau Licence ne dit plus « sans aucune connexion » une ligne avant d'expliquer que la clé est
  présentée pour savoir si elle a été révoquée ; « Tous les modules » compte les entrées du menu au
  lieu d'écrire « dix-neuf » à la main, et dit « tu n'as encore rien retiré du menu » plutôt
  qu'« aucun choix enregistré ».
- La copie externe affiche sa vraie date dès l'ouverture, au lieu de « Copie à la prochaine
  sauvegarde » devant une copie faite la veille ; le sélecteur de dossier, la panne de disque et les
  textes du Cabinet nomment OneDrive à côté d'iCloud Drive ; et « Passer » l'assistant ne reproche plus
  l'absence d'une raison sociale qu'on vient de taper.

**Publiée en bêta** : elle touche au moteur comptable (déclaration d'employeur, IRPP du mois,
contre-passation, rapprochement).

## 10.11.0 — 23/09/2026

**Les mises à jour, retournées.** Trois défauts vus par Skander sur ses deux applications, et l'écran
refait « comme Apple », à sa demande.

**Ce qui empêchait de recevoir la 10.10.0**
- **« Tu as la dernière version » alors que la 10.10.0 était en ligne.** La liste des versions que
  GitHub rend au relais annonçait la 10.10.0 **sans aucun fichier**, selon le serveur qui répondait,
  encore une heure après sa publication. Le relais sautait donc la 10.10.0 et servait la 10.9.3. Il
  relit maintenant une version qui paraît vide avant de passer à la précédente (trois au plus, et
  aucun appel de plus dans le cas normal) ; le Cabinet fait de même sur son canal d'essai. *Le relais
  doit être redéployé pour que les applications déjà installées en profitent.*
- **Une version téléchargée cachait la suivante.** La 10.9.3 prête à installer, la 10.10.0 publiée
  entre-temps restait invisible : ni la recherche automatique ni le bouton ne la voyaient, et il
  fallait installer l'une pour découvrir l'autre. La recherche a lieu à chaque fois ; si c'est la
  même version, elle reste prête sans repasser par le téléchargement.

**L'écran des mises à jour, comme sur un Mac** — le même dans les deux applications
- En tête, l'application et sa version ; dessous, un seul bloc qui répond à « suis-je à jour ? » :
  une coche verte, ou la mise à jour disponible avec sa barre et « 39,1 Mo sur 93,5 Mo », ou « prête
  à être installée » avec **Redémarrer maintenant** et **Rechercher une version plus récente**.
- La recherche se lance d'elle-même à l'ouverture du panneau, comme dans les Réglages de macOS.
- Quand une version finit de se télécharger, une fenêtre dit ce qu'elle apporte et propose **Plus
  tard** ou **Redémarrer maintenant** — une fois par jour au plus, jamais par-dessus une autre question.
- Les réglages deviennent des lignes : « Mises à jour automatiques — Activées », et « Versions
  d'essai » avec un interrupteur.
- **La ligne des versions d'essai dit la vraie dernière bêta publiée**, avec sa date — ou aucun
  numéro. Elle écrivait « Numérotées 9.2.0-beta.1 » dans le Cabinet et « 7.26.0-beta.1 » dans
  SkanFact, deux exemples figés depuis des mois.

**Et**
- Écran de verrouillage du Cabinet : « Ouvrir » et « J'ai déjà un cabinet sur un autre ordinateur… »
  se touchaient, et la phrase au-dessus touchait « Ouvrir ».

Publiée en stable directe si elle l'est : elle ne touche ni à l'argent, ni à une clé, ni au moteur
comptable, ni au format d'un fichier — c'est le chemin de publication et un écran.

## 10.10.0 — 23/09/2026

**Un expert-comptable a tenu le Cabinet comme s'il l'utilisait depuis des mois.** Onze dossiers, un
livre de cent quatre écritures, la paie, la clôture, la liasse. Seize constats, tous corrigés ici.

**Les plus graves**
- **La liasse ne tombait jamais juste** sur un dossier alimenté par SkanFact : deux comptes en
  sortaient, et faisaient l'écart au millime. Les amortissements (compte 28, celui qu'écrivent les
  deux applications) n'entraient dans aucune rubrique, et une perte reportée (13 débiteur) non plus.
  Le modèle de rubriques les range désormais — une rubrique peut prendre les deux sens de solde — et
  un modèle déjà enregistré par un cabinet est repris à la lecture, sans toucher aux rubriques qu'il a
  réécrites. Un nouveau contrôle compare aussi la liasse aux états financiers de l'onglet Exercice.
- **« Voir les comptes » d'une rubrique affichait du code HTML** au lieu du tableau. Même défaut, jamais
  signalé, sur la fenêtre « Les deux livres sont réunis ».
- **Un bulletin à salaire négatif devenait une écriture validée** (quarante jours d'absence sur
  vingt-six). Il est refusé pendant la frappe, bouton éteint, les deux chiffres nommés — dans le
  Cabinet ET dans l'app entreprise, qui partagent le moteur de paie. Un bulletin négatif enregistré
  avant cette version ne devient jamais une écriture, et le contrôle de paie le nomme.
- **« Ouvrir 2027 » créait un exercice qu'aucun écran ne permettait d'ouvrir** : le sélecteur ne
  connaissait que les années des paquets reçus. Il lit maintenant aussi les livres du cabinet, et le
  geste propose d'aller sur le nouvel exercice.
- **Un dossier hors SkanFact ne pouvait tenir aucune comptabilité** — c'est pourtant celui qu'on
  facture. L'onglet Comptabilité propose « Commencer le livre » (exercice et balance d'ouverture,
  vide pour un client qui démarre), et tous les onglets du livre s'ouvrent.
- **Les états remis au client sortaient au format anglo-saxon, sans devise.** Ils s'écrivent comme
  l'écran : « 76 493,448 DT », dates JJ/MM/AAAA.

**Les autres**
- Les montants et les dates des messages du moteur (refus d'une pièce, compte d'attente, relevé,
  extourne) s'écrivent à la française : « Débit 100.000 » se lisait cent mille.
- Reprendre un parc déjà amorti : la fiche du bien affiche ce qui est déjà amorti au 1er janvier,
  prévient quand la ligne est un à-nouveau, accepte les dates en JJ/MM/AAAA ; et la clôture rapproche
  le tableau d'amortissement du compte 28.
- Une quantité d'inventaire illisible (« douze ») est refusée en nommant la ligne, au lieu de compter zéro.
- L'extourne d'une écriture de décembre se prévoit : elle est posée au 1er janvier par « Ouvrir N+1 ».
- « Rouvrir » sans motif et « Continuer » sans nom de cabinet montrent le champ refusé.
- Sept boutons « Annuler » (retraitement, questions, bulletin…) n'étaient reliés à rien : ils ferment.
- L'écran d'accueil décrit le Cabinet tel qu'il est ; le nombre d'onglets et de dossiers d'exemple
  se déduit au lieu d'être écrit à la main ; un accord (« 1 question envoyée, signées ») et une
  mention de numéro de version dans une fenêtre corrigés.

**Publiée en stable à la demande de Skander**, après la 10.10.0-beta.1 du même jour (construite et
publiée sur le canal d'essai, seize fichiers). Elle touche au moteur comptable (liasse) et à
l'argent (paie) : la règle veut la bêta pour ces cas, et la bêta a eu lieu ; la décision de
confirmer revient au propriétaire, elle est notée ici. La liasse reste « À VÉRIFIER » tant qu'elle
n'a pas été confrontée à une liasse réellement déposée.

## 10.10.0-beta.1 — 23/09/2026

**Un expert-comptable a tenu le Cabinet comme s'il l'utilisait depuis des mois.** Onze dossiers, un
livre de cent quatre écritures, la paie, la clôture, la liasse. Seize constats, tous corrigés ici.

**Les plus graves**
- **La liasse ne tombait jamais juste** sur un dossier alimenté par SkanFact : deux comptes en
  sortaient, et faisaient l'écart au millime. Les amortissements (compte 28, celui qu'écrivent les
  deux applications) n'entraient dans aucune rubrique, et une perte reportée (13 débiteur) non plus.
  Le modèle de rubriques les range désormais — une rubrique peut prendre les deux sens de solde — et
  un modèle déjà enregistré par un cabinet est repris à la lecture, sans toucher aux rubriques qu'il a
  réécrites. Un nouveau contrôle compare aussi la liasse aux états financiers de l'onglet Exercice.
- **« Voir les comptes » d'une rubrique affichait du code HTML** au lieu du tableau. Même défaut, jamais
  signalé, sur la fenêtre « Les deux livres sont réunis ».
- **Un bulletin à salaire négatif devenait une écriture validée** (quarante jours d'absence sur
  vingt-six). Il est refusé pendant la frappe, bouton éteint, les deux chiffres nommés — dans le
  Cabinet ET dans l'app entreprise, qui partagent le moteur de paie. Un bulletin négatif enregistré
  avant cette version ne devient jamais une écriture, et le contrôle de paie le nomme.
- **« Ouvrir 2027 » créait un exercice qu'aucun écran ne permettait d'ouvrir** : le sélecteur ne
  connaissait que les années des paquets reçus. Il lit maintenant aussi les livres du cabinet, et le
  geste propose d'aller sur le nouvel exercice.
- **Un dossier hors SkanFact ne pouvait tenir aucune comptabilité** — c'est pourtant celui qu'on
  facture. L'onglet Comptabilité propose « Commencer le livre » (exercice et balance d'ouverture,
  vide pour un client qui démarre), et tous les onglets du livre s'ouvrent.
- **Les états remis au client sortaient au format anglo-saxon, sans devise.** Ils s'écrivent comme
  l'écran : « 76 493,448 DT », dates JJ/MM/AAAA.

**Les autres**
- Les montants et les dates des messages du moteur (refus d'une pièce, compte d'attente, relevé,
  extourne) s'écrivent à la française : « Débit 100.000 » se lisait cent mille.
- Reprendre un parc déjà amorti : la fiche du bien affiche ce qui est déjà amorti au 1er janvier,
  prévient quand la ligne est un à-nouveau, accepte les dates en JJ/MM/AAAA ; et la clôture rapproche
  le tableau d'amortissement du compte 28.
- Une quantité d'inventaire illisible (« douze ») est refusée en nommant la ligne, au lieu de compter zéro.
- L'extourne d'une écriture de décembre se prévoit : elle est posée au 1er janvier par « Ouvrir N+1 ».
- « Rouvrir » sans motif et « Continuer » sans nom de cabinet montrent le champ refusé.
- Sept boutons « Annuler » (retraitement, questions, bulletin…) n'étaient reliés à rien : ils ferment.
- L'écran d'accueil décrit le Cabinet tel qu'il est ; le nombre d'onglets et de dossiers d'exemple
  se déduit au lieu d'être écrit à la main ; un accord (« 1 question envoyée, signées ») et une
  mention de numéro de version dans une fenêtre corrigés.

**Publiée en bêta** : elle touche au moteur comptable (liasse) et à l'argent (paie).

## 10.9.3 — 23/09/2026

**Le nom de l'ordinateur ne sert pas « qu'à » ce que l'écran disait.** Trois lectures du site
dans la peau d'un expert-comptable, d'un gérant de PME et d'un commercial ont trouvé, chacune de
son côté, que la politique de confidentialité et la page « Vos données » affirmaient que rien ne
part pendant l'essai et que « rien ne nous dit si vous ouvrez le logiciel ». C'est faux depuis la
8.4.0 : les deux applications signalent leur présence à SkanFact vingt secondes après
l'ouverture, puis toutes les quatre heures, essai compris — la clé s'il y en a une, un
identifiant tiré au hasard, **le nom de l'ordinateur**, le système et la version. Jamais une
pièce, un client ni un montant.

Le site dit désormais la vérité, champ par champ. L'application la disait aussi mal : sous
« Le nom de cet ordinateur », Paramètres affirmait qu'il « ne sert qu'à dire qui a enregistré en
dernier », et sa bulle qu'il « ne quitte jamais tes données ». Les deux disent maintenant qu'il
part dans ce signal, et conseillent un nom qui ne gêne pas, comme « PC du bureau ».

**Publiée en stable directe** : un correctif de texte, qui ne touche ni un chiffre, ni une clé, ni
le moteur comptable, ni le format d'un fichier.

## 10.9.2 — 22/09/2026

**L'empreinte d'une licence existe enfin quelque part.** Skander a voulu vérifier une licence sur
`skanfact.tn/verifier`, a collé sa clé, et s'est fait répondre « empreinte illisible ». Il est
l'auteur du produit : un client se serait trompé dix fois sur dix. Trois défauts, tous de notre
côté, et le premier explique les deux autres.

**La page demandait une valeur qu'il était impossible d'obtenir.** Elle disait « vous trouvez
l'empreinte dans SkanFact, sous Paramètres › L'application › Licence » — et **rien ne l'affichait**,
ni dans l'application entreprise, ni dans le Cabinet. C'est « une phrase affichée que rien ne tient
est un bug » (7.3.0), sur une phrase qui envoyait chercher un objet inexistant. Les deux
applications l'affichent désormais dans leur panneau Licence, avec sa bulle et un bouton
« Copier » : trente-deux caractères montrés sans bouton pour les prendre se recopient à la main,
donc se recopient faux.

**Le gabarit du site montrait le mauvais format** : `3F9A-2C1E-7B04-D158-6A2F`, c'est l'empreinte
d'un **cabinet comptable** (vingt caractères, cinq groupes de quatre, dictée au téléphone pour le
parrainage). L'empreinte d'une licence en fait trente-deux, d'un bloc. La page distingue enfin les
deux au lieu d'en confondre une pour l'autre.

**Et coller la CLÉ est maintenant compris**, au lieu d'être refusé. C'est le geste naturel : la clé
arrive par mail, elle est dans le presse-papiers, c'est elle qu'on appelle « ma licence ». Le site
la reconnaît à son préfixe et **calcule son empreinte dans le navigateur** (`crypto.subtle`, le même
SHA-256 tronqué à 32 que `empreinteCle` côté application et côté serveur) : la clé ne part jamais
sur le réseau — ce serait envoyer un titre de licence à une route publique pour poser une question
à laquelle son condensé répond aussi bien.

L'empreinte se **dérive** de la clé à la sortie unique de chaque `licence:status`, jamais rangée :
une empreinte stockée finirait par désigner une clé qu'on a remplacée.

## 10.9.1 — 22/09/2026

**La facture porte la raison sociale et l'adresse.** Correctif de la 10.9.0, trouvé en confrontant
le contrat du worker au formulaire réel du site. Le site distingue deux champs que la page appelle
par leur nom : la **raison sociale** (« Atelier Ben Salah SARL ») et la **personne qui suit le
dossier** (« Mohamed Ben Salah »). Le worker ne gardait que le second, et jetait l'adresse. Une
vente en ligne créait donc une fiche client au nom d'un salarié, sans adresse, sous le matricule
fiscal de sa société — et c'est ce nom-là qui serait parti sur la facture, qui est une pièce légale.

Ce qui change, de bout en bout : `raison` nomme le client, `nom` devient le contact, `adresse` est
gardée, et les trois voyagent avec la vente jusqu'à SkanFact, qui ouvre enfin une fiche complète au
lieu d'une fiche à ressaisir — dans un pont dont le but est « zéro ressaisie ». Une fiche qui existe
déjà n'est jamais réécrite : on ne comble que ce qui est vide, parce qu'une adresse corrigée à la
main vaut mieux que celle d'une commande. Sans `raison`, le contrat à six champs de la 10.9.0
continue de fonctionner à l'identique.

Publié en **stable directe avec la 10.9.0, à la demande de Skander** (« publie toutes les
plateformes, faut que tout soit à jour sur main partout »). La règle du projet veut la bêta pour ce
qui touche à l'argent ou au format d'un fichier, et ces deux versions font les deux. Ce qui rend la
décision tenable, et qui est noté ici parce qu'il cessera d'être vrai : **le paiement en ligne est
FERMÉ tant que le portefeuille Konnect n'est pas réglé** — les routes d'achat répondent « paiement
non configuré », le site le lit et le dit, et aucun client ne peut rien encaisser ni rien acheter.
Le jour où ce réglage est posé, la règle de la bêta redevient la règle.

Deux colonnes s'ajoutent (`commandes.contact`, `commandes.adresse`, `clients.contact`) —
`plateforme/migration-a-coller.sql` les porte. Six défauts prouvés par réintroduction, dont celui
d'origine ; `npm run e2e:pont` vérifie la moitié SkanFact, que nul test pur ne peut voir.

## 10.9.0 — 22/09/2026

**Le paiement en ligne.** Le site `skanfact.tn` peut vendre tout seul : le visiteur choisit son
offre, paie par carte chez Konnect, et sa clé de licence part par mail dans la seconde. C'est ce que
`PLAN-PLATEFORME.md` § 12 annonçait depuis le premier jour — « le jour où un encaissement en ligne
est branché, il déclenche **le même bouton**, rien à réécrire » — et la phrase a été tenue au pied
de la lettre : le webhook appelle la MÊME émission que la console, donc la même clé, la même vente
et le même mail. Une seconde émission « pour le web » aurait donné deux façons de vendre, donc deux
façons de se tromper.

**Tant que la clé Konnect et le portefeuille ne sont pas posés, l'achat en ligne est FERMÉ**, le
site le lit et le dit, et le formulaire de demande d'avant continue de servir. Rien ne casse et rien
ne ment (`plateforme/README.md` § 4 sexies).

Les deux dangers du jour, et ce qui les ferme :

- **Le navigateur ment.** Il envoie une demande — une offre, un nom, une adresse — jamais un prix.
  Un prix qu'il enverrait quand même ne sert à rien : tout ce qui chiffre vient des réglages de la
  console, TVA et timbre fiscal compris. Le **timbre** est encaissé, et ce n'est pas un détail :
  SkanFact l'ajoute tout seul à la facture, donc ne pas le prendre en ligne laisserait chaque vente
  due d'un dinar, pour toujours.
- **Le webhook de Konnect n'est pas signé** : n'importe qui peut l'appeler. Il ne vaut donc que
  comme notification, et la preuve est la question qu'on repose à Konnect avec notre clé. Trois
  conditions, et les trois : l'état est « encaissé », le paiement porte la référence de NOTRE
  commande, et le montant est celui qu'on a demandé. Un paiement partiel n'est pas un paiement.

Le reste :

- **Trois chemins vers la même livraison**, et c'est voulu (6.7.2) : le webhook, la page de retour
  que le client consulte, et un bouton dans la console. Le jour où le webhook n'arrive pas, c'est la
  page que le client regarde qui finit le travail, sans que personne ait rien à faire.
- **Le pire état a son écran** : Konnect a encaissé et la clé n'est pas partie. La commande reste
  rouge dans **Console → Commandes** avec sa raison, et « À décider » la crie. Sans cette ligne,
  personne ne saurait qu'un client a payé pour rien.
- **La remise de parrainage ne se pose que sur un cabinet que la base CONNAÎT.** Vingt caractères
  hexadécimaux se tapent au hasard ; ce qui ne se fabrique pas, c'est une licence de cabinet vivante
  portant cette empreinte.
- **Une licence de cabinet ne se vend pas en ligne** : son tarif n'est pas fixé, et vendre à zéro ou
  à un prix inventé sont aussi faux l'un que l'autre.
- La page publique **ne rend jamais la clé** : une référence de commande voyage dans une adresse,
  qui se copie. La clé part par mail, et l'adresse est masquée dans la phrase de retour.
- Le client n'est créé qu'**au paiement** : une commande abandonnée ne laisse aucune fiche derrière
  elle, et la table des clients reste ce qu'elle dit être.
- Au passage, un défaut de la 10.5.0 : le réglage « Signature des mails » de la console était
  réglable **et ignoré** par les mails qu'il nomme — ils lisaient la variable du worker.

Treize défauts remis un par un font tomber leur test, et le quatorzième a été trouvé par un test
neuf : la requête de l'alerte ne sélectionnait pas la colonne que le constructeur d'alertes teste,
et la ligne était écartée en silence.

## 10.8.1 — 22/09/2026

**Les finitions de la console.** Cinq défauts trouvés en relisant ses captures écran par écran.
Aucune ligne des deux applications ne change : la console se déploie par son propre workflow, il
n'y a donc pas d'installeur à reprendre.

- **Le journal d'un client affichait des codes bruts** (`licence.emise`, `suivi.note`) pendant que
  la page Journal, deux clics plus loin, les traduit. Les deux écrans lisent désormais la même
  table (`nomEvt`), et le code d'origine reste en infobulle — c'est lui qu'on cite dans un
  dépannage.
- **« Ouvrir licences » se lit comme une commande de terminal.** Un libellé décrit l'écran
  d'arrivée dans la langue où on le nommerait à voix haute : « Ouvrir les licences ».
- **« 2 révoquées » ne dit pas révoquées de quoi.** Le libellé de la carte porte le mot
  « licence », comme les cinq autres.
- **La colonne « Clé » de la fiche d'un client ne portait pas de clé**, mais l'identifiant de la
  clé qui l'a signée : elle s'appelle « Signée par ».
- **Un état vide de cent pixels au milieu d'une fiche pleine** repoussait tout le reste : celui
  des contacts passe en `mini`, comme les autres états vides secondaires (9.4.7).

## 10.8.0 — 22/09/2026

**La stable qui rattrape neuf versions.** La dernière stable en ligne était la **10.0.0** du
21/09/2026 ; tout ce qui a été écrit depuis — 10.0.1, 10.1.0, 10.2.0, 10.3.0, 10.4.0, 10.5.0,
10.6.0, 10.7.0 et 10.8.0 — n'était sorti que sur le canal d'essai, et les quatre dernières nulle
part. Publiée en stable directe **à la demande de Skander** : la règle du projet veut la bêta pour
ce qui touche à un chiffre, à une clé, au moteur comptable ou au format d'un fichier, et plusieurs
de ces versions le font. C'est sa décision, elle est notée ici, et elle se prend sur un parc où
aucun client payant n'est encore installé.

Ce que cette stable apporte, dans l'ordre de ce qui casserait le plus cher :

- **La devise d'un achat** (10.1.0). Une facture fournisseur en euros comptait 1 000 **dinars** dans
  la TVA déductible, les charges, le résultat, le seuil de rentabilité, le stock, la trésorerie, les
  écritures et le paquet du comptable. Treize agrégateurs corrigés, et un garde-fou qui MESURE :
  pour chacun, un achat de 1 000 € à 3,4 doit rendre 3 400.
- **L'avoir fournisseur, l'acompte versé et le relevé de compte client** (10.2.0). Le SENS d'une
  pièce se porte désormais dans ses totaux convertis, au lieu d'être recopié de mémoire dans chaque
  agrégateur — la faute que les ventes traînent depuis la 1.4.0.
- **Achats sort des réserves de l'Indépendant** (10.7.0), et ce n'est pas une décision commerciale :
  mesuré sur un exercice entier, un client qui ne peut pas saisir ses achats envoie à son comptable
  un paquet qui déclare **7 441 DT de TVA au lieu de 3 250** — 4 191 DT payés en trop sur un
  logiciel vendu 390. Une offre peut fermer un confort, jamais une case de déclaration, et un
  garde-fou le mesure désormais module par module.
- **La paie des clients dans le Cabinet** (10.3.0) : le comptable établit les bulletins de ses
  cinquante-huit clients hors SkanFact au lieu de les retaper. Le même salarié et la même saisie
  donnent le même bulletin des deux côtés, au millime, et un test le prouve.
- **L'espace de gestion des deux plateformes** (10.4.0, 10.5.0, 10.6.0) : la console voit enfin le
  parc des DEUX applications, se souvient de ce qu'on fait d'un prospect, garde ses prix et ses
  seuils en base au lieu d'un déploiement, exporte sa propre base toutes les nuits, et a passé un
  audit de design de vingt-neuf constats.
- **Les licences sans limite de dossiers** (10.8.0) pour les premiers cabinets : « sans limite » est
  un ÉTAT, jamais un très grand nombre — une clé à 99 999 dossiers aurait affiché une barre de
  progression vers une limite imaginaire.
- **Le site vérifie une licence chez lui** (10.8.0-beta.6) : le visiteur ne quitte plus
  `skanfact.tn` au moment précis où il se rassure sur une clé qu'on vient de lui vendre.
- **Les pannes se disent en français** (10.0.1) : disque plein, dossier absent, support débranché,
  droits refusés. Et zéro avertissement de lint, pour que le prochain soit lisible.
- **La sonde de contraste mesure de nouveau les champs de saisie** (10.8.0-beta.7), perdue pendant
  onze versions dans une refonte d'instrument. Verdict des trois surfaces : 722 champs, aucun
  illisible.

Le détail de chaque version est dans les entrées qui suivent.

## 10.8.0-beta.7 — 22/09/2026

**La sonde de contraste avait perdu les champs de saisie, et personne ne pouvait le savoir.** La
session qui développe le site nous a posé une question simple — « est-ce que votre instrument mesure
les champs, ou seulement les boutons ? ». Réponse du jour : **seulement les boutons**. Or CLAUDE.md
affirmait depuis la 7.30.0 que « e2e:contraste mesure désormais les champs autant que les boutons ».
C'était vrai : la moitié « champs » existait, écrite pour un défaut que la relecture du CSS ne peut
pas voir — en thème sombre, chaque `<input>` gardait son fond CLAIR avec le texte clair du thème,
contraste **1,18**, c'est-à-dire du blanc sur du blanc, depuis que le thème existait. Elle a été
**perdue dans la refonte de la 9.4.3**, quand la sonde a déménagé dans `harnais.js` pour être
partagée : seuls les boutons ont fait le voyage. Onze versions pendant lesquelles le garde-fou écrit
pour attraper ce défaut-là ne pouvait plus l'attraper, sur **aucune** des trois surfaces.

- **Une sonde, deux listes nommées.** `SONDE_CONTRASTE` rend `{ boutons, champs }` : une seule
  sonde parce que ses quatre fonctions de mesure (luminance, fond opaque, débordement) seraient
  sinon recopiées dans une seconde — et une copie diverge, toujours (7.29.0). Deux listes séparées
  parce que les comptes ne se mélangent pas : « 2 125 boutons » doit rester comparable d'une version
  à l'autre, et un instrument doit dire combien il a mesuré de quoi.
- **Les trois surfaces, pas une.** L'app entreprise, le Cabinet et la console la partagent — c'est
  la règle 9.4.3, dont l'oubli est très exactement ce qui a laissé l'app du comptable dériver.
- **Un instrument qui ne mesure rien annonce « tout va bien ».** Les trois parcours TOMBENT
  désormais si le compte de champs est nul, comme ils le font déjà pour les écarts d'espacement.
  Sans ce garde-fou, la disparition de 9.4.3 se reproduirait à l'identique et sans un mot.
- **`select` et `textarea` comptent autant qu'`input`** : c'est précisément parce qu'ils n'étaient
  PAS touchés par le défaut d'origine (dans une liste de sélecteurs, chacun porte sa propre
  spécificité) que l'écran paraissait à moitié correct. Un champ désactivé a le droit d'être pâle,
  comme un bouton ; un champ en lecture seule, non — il se lit, donc il doit être lisible.

Verdict des trois surfaces, aujourd'hui : **722 champs mesurés** (146 dans l'app entreprise, 319
dans le Cabinet, 257 dans la console), en clair, en sombre, à 1440 et à 1280 — **aucun illisible**.
Le défaut n'est donc pas revenu pendant les onze versions où plus personne ne regardait, et c'est
une chose qu'on ne pouvait pas savoir.

Prouvé en réintroduisant le défaut d'origine dans la feuille de style : la sonde le nomme sur trois
champs, à 1,18 exactement. Trois seulement, parce que `input[type=text]` couvrait encore le reste —
la démonstration qu'un défaut « à moitié » est celui qui se voit le moins.

Correctif d'outillage : il ne touche ni un chiffre, ni une clé, ni le moteur comptable, ni le format
d'un fichier. Aucune des deux applications ne change d'une ligne.

## 10.8.0-beta.6 — 22/09/2026

**Le site peut vérifier une licence sans envoyer le visiteur ailleurs.** La page
`skanfact.tn/verifier` ne pouvait que renvoyer vers `api.skanfact.tn/verifier` : le visiteur
quittait le site, atterrissait sur une autre adresse, une page nue, sans en-tête ni retour — au
moment précis où il cherche à se rassurer sur une licence qu'on vient de lui vendre. La route
publique `POST /v1/verif/licence` accepte désormais d'être interrogée depuis les trois adresses du
site, donc la vérification se fait DANS la page du site.

Ce que ça ne change pas, et il faut le dire : cette autorisation ne protège rien et n'en a pas la
charge. La route est publique par construction — `curl` l'a toujours interrogée et l'interroge
toujours. Ce qui protège la réponse, c'est la REQUÊTE : elle ne lit jamais la table des clients,
donc elle ne peut rien dire de plus que l'état d'une empreinte que le demandeur connaît déjà. Ce
qui change est seulement ceci : quelle PAGE a le droit de lire la réponse dans un navigateur.

- La liste des trois adresses est la **même** que celle du relais (formulaire de contact), et un
  test compare les deux : les deux workers servent le même site, et deux listes qui divergent
  donneraient un site dont une moitié fonctionne.
- Une origine inconnue reçoit quand même sa réponse, sans l'en-tête. Refuser fabriquerait une
  panne là où il n'y en a pas : la page servie par le worker lui-même n'envoie aucune origine, et
  c'est elle qui sert aujourd'hui.
- L'autorisation s'arrête à l'espace public. Un test vérifie qu'aucune page web ne peut lire
  `/v1/admin/…` ni `/v1/licence/etat` — sans cette moitié, il laisserait passer une autorisation
  posée partout, c'est-à-dire la console ouverte au navigateur de n'importe quel visiteur.

Correctif de plateforme : rien ici ne touche à un chiffre, à une clé, au moteur comptable ni au
format d'un fichier. Les deux applications ne changent pas d'une ligne.

## 10.8.0-beta.5 — 22/09/2026

**Le relais de mise à jour se déploie aussi depuis le dépôt.** C'était le dernier worker qu'il
fallait coller à la main — celui qui sert les mises à jour de toutes les installations, et qui porte
depuis la 10.4.0 le formulaire de contact du site. Il a son `worker/wrangler.toml` et son workflow
`Relais`, jumeau de celui de la console.

**`--keep-vars` compte encore plus ici.** Le relais n'a aucune liaison — ni base, ni bucket — mais
il porte **sept variables en clair** : `GITHUB_OWNER`, `GITHUB_REPO`, `CONTACT_TO`, `CONTACT_FROM`,
`CONTACT_ORIGINES`, `LICENCE_REQUISE`, `LICENCE_PUBLIC_KEY`. Effacées, il répondrait toujours, mais
il chercherait les releases d'un dépôt vide et n'enverrait plus un seul message de contact. Une
panne qui ne se voit pas.

**Deux fichiers de workflow plutôt qu'un qui déploierait les deux.** Les deux workers changent à des
moments différents ; un relais qui se redéploie parce qu'on a corrigé la console rendrait illisible
la seule question qu'on se pose devant un incident — qu'est-ce qui a bougé, et quand.

**Et l'essai qui prouve que la lettre ARRIVE.** Les contrôles automatiques vérifient que la porte
s'ouvre — `/sante` répond 403, `OPTIONS /contact` répond 204 — et ne disent rien de Resend, du
domaine vérifié ni de la boîte qui reçoit. Un envoi réel est le seul à le prouver, et c'est aussi le
seul qui coûte un message : il ne part donc **que si on le demande** (une case au lancement du
workflow). Un déploiement qui enverrait un mail à chaque fois finirait par remplir la boîte qu'il
teste. Les trois réponses possibles disent chacune autre chose, et l'étape les distingue au lieu de
rendre un échec muet : la chaîne tient, `RESEND_KEY`/`CONTACT_TO` manquent, ou Resend refuse
l'expéditeur — presque toujours un `CONTACT_FROM` hors du domaine vérifié.

**Les garde-fous sont jugés par UNE boucle, pas recopiés** (9.4.3 : un instrument qui ne couvre
qu'un des deux ne protège qu'un des deux). Elle exige, pour chacun : wrangler épinglé,
`--keep-vars`, jamais `beta` en déclenchement, un filtre qui nomme le code et sa configuration sans
se nommer lui-même, un `name` qui désigne le worker **en ligne** (un nom qui diverge n'en met pas un
à jour, il en crée un second pendant que l'ancien continue de servir l'ancien code), et **aucune
route déclarée** — en déclarer une remplacerait le domaine personnalisé.

## 10.8.0-beta.4 — 22/09/2026

**Le worker est déployé depuis le dépôt, pour de vrai.** La bêta précédente avait écrit la recette ;
elle ne pouvait pas être lancée. `workflow_dispatch` n'existe, chez GitHub, que pour un workflow
présent sur la **branche par défaut** : tant que `worker.yml` n'était que sur `beta`, il n'existait
pour personne — un lancement répondait 404, sans rien d'autre à lire.

**Et `main` était un champ de mines.** Elle est restée à la 10.0.0 : son worker fait 1 842 lignes
contre 4 898 sur `beta`, il n'a pas bougé depuis le 17/09, et la base D1 porte déjà les colonnes
qu'il ne connaît pas. Le déployer aurait effacé le parc des deux applications, les réglages en base,
le suivi de prospect, la fiche client et la vérification publique.

**D'où la règle, qui vaut indépendamment de cette transition : un déploiement se déclenche sur ce
qui est DÉPLOYÉ — le code du worker et sa configuration — jamais sur la recette qui déploie.** Une
production qui se redéploie parce qu'on a corrigé un commentaire est une production qu'on finit par
ne plus regarder. Le filtre de chemins ne se nomme donc plus lui-même — ce qui rend, par
construction, le dépôt du fichier sur `main` **inerte** : aucun chemin surveillé n'y existe encore.
Vérifié après la poussée : zéro run déclenché. Le premier déploiement par poussée aura lieu quand
`plateforme/` arrivera sur `main`, c'est-à-dire quand il y aura vraiment quelque chose à déployer.

Le garde-fou se prouve dans les **deux** sens : le filtre vidé, le déclenchement cesserait en
silence ; le filtre se nommant lui-même, la production se redéploierait pour une recette modifiée.

**Vérifié avant de déployer quoi que ce soit** : le worker ne lit que `DB` et `SAUVEGARDES` sur
`env`, les deux déclarés dans le `wrangler.toml`. Tout le reste — `ADMIN_SECRET`, `SRV_PRIVATE_KEY`,
`REPONSE_PRIVATE_KEY`, `RESEND_API_KEY`, `RELAIS_*`, les prix, la signature de mail — sont des
secrets ou des variables en clair, que `--keep-vars` et la définition même d'un secret préservent.
Aucune route n'est déclarée, donc `api.skanfact.tn` n'est pas touché.

**Le premier run a mesuré, il n'a pas seulement réussi** (la leçon de la 9.8.1) : `HTTP 200` sur
`/verifier` et la page reconnue à son titre. Les huit versions jamais déployées sont arrivées d'un
coup, et la copie de nuit vers R2 est armée (`0 2 * * *`).

## 10.8.0-beta.3 — 22/09/2026

**Le worker de la console se déploie depuis le dépôt.** Il se déployait en COLLANT son code dans
l'éditeur du tableau de bord : un geste manuel par version, sur le seul service qui signe les
licences. Skander : « plus me demander de faire la commande SQL ni d'éditer le code dans les
workers ». La base D1 est réglée autrement — j'y accède directement ; le code, lui, ne pouvait
l'être que par une action GitHub.

**Ce que la configuration devait dire, et que personne n'écrivait.** `wrangler deploy` REMPLACE les
liaisons du worker par celles de son fichier de configuration : une liaison absente en est
SUPPRIMÉE. Sans `plateforme/wrangler.toml`, le premier déploiement aurait laissé `env.DB`
indéfini — la console aurait répondu « Service momentanément indisponible » sur chaque écran, sans
qu'une ligne de code soit en cause. Les deux liaisons (la base, le bucket de copie) et le
déclencheur de nuit y sont donc déclarés, avec leurs identifiants réels. Ce ne sont pas des
secrets : sans jeton ils n'ouvrent rien, et les cacher aurait rendu les pannes illisibles.

**Les variables en clair survivent, par `--keep-vars`.** Les secrets, eux, survivent de toute
façon — c'est leur définition. Mais `MAIL_FROM`, `RELAIS_BASE` et leurs voisines auraient été
effacées à chaque déploiement, et rien ne l'aurait dit.

**Jamais depuis `beta`.** La branche de travail porte du code non confirmé ; le pousser au service
qui signe les licences de vrais clients serait publier sans le dire. Le workflow se déclenche sur
`main`, et `workflow_dispatch` reste là pour déployer une bêta délibérément — même porte que le
workflow Release.

**Un job vert ne suffit pas** (9.8.1, re-appliquée) : après le déploiement, le workflow redemande au
worker la page publique `/verifier` et exige d'y lire son titre. Elle n'existe qu'à partir de la
10.5.0, donc elle prouve que c'est bien ce code-là qui tourne. Et l'adresse se lit dans la sortie de
wrangler plutôt que dans un troisième secret — un secret qu'on oublie de poser rendrait le contrôle
rouge pour une raison qui n'est pas une panne. Quand rien ne peut être mesuré, l'étape le DIT au
lieu d'annoncer que tout va bien.

**Deux garde-fous, quatre preuves.** Les noms de liaison du toml sont confrontés à ceux que le code
LIT — `R2_BINDING` est lu dans la source, jamais recopié — et le workflow est relu pour `--keep-vars`
et pour la branche. Réintroduits un par un : liaison D1 retirée, binding R2 renommé du seul côté du
code, `--keep-vars` retiré, déclenchement ajouté sur `beta`. Les quatre tombent en nommant leur
conséquence.

**Fait au passage, sur le compte :** le bucket `skanfact-sauvegardes` est créé (R2 impose des
minuscules ; la liaison reste `SAUVEGARDES`, c'est elle que le code lit). La copie de la base partira
chaque nuit à 3 h de Tunis dès que le worker sera déployé avec cette configuration.

## 10.8.0-beta.2 — 22/09/2026

**La migration de la base D1, écrite, prouvée, et appliquée.** `schema-a-coller.sql` crée une base
NEUVE : tout y est en `CREATE TABLE IF NOT EXISTS`, donc il ne fait rien sur la base de production,
qui a été collée une fois et n'a plus bougé. Chaque colonne ajoutée depuis lui manquait — et le
worker d'aujourd'hui les LIT. `plateforme/migration-a-coller.sql` est l'autre moitié.

**Ce que la base portait vraiment**, relevé plutôt que supposé : elle était déjà à jour **jusqu'à la
10.5.0** — `app`, l'index du parc avec `COALESCE`, `reglages`, `suivis`. Il ne manquait **qu'une
colonne**, `licences.illimite`, ajoutée le jour même après copie complète de la base. Les deux
licences existantes sont intactes, `illimite` à `NULL` : le quota ordinaire, exactement le bon
défaut.

**Le piège que la migration désamorce, et qui ne dit rien.** `CREATE UNIQUE INDEX IF NOT EXISTS` sur
un nom **déjà pris ne remplace rien** — il ne fait rien, sans un mot. L'ancien `idx_activ_unique`
portait sur `(empreinte, device_id)` : sans un `DROP INDEX` avant, le correctif du parc de la
10.4.0-beta.3 ne se serait **jamais** appliqué, et les deux applications d'un même poste auraient
continué à s'écraser. Prouvé en retirant le DROP : les deux bases divergent, sur cette ligne
exactement.

**Et un garde-fou qui rassurait sans protéger, élargi.** Ma première version du test ne vérifiait que
l'idempotence — rejouée sur une base à jour, la migration ne casse rien. Elle restait **verte** quand
je retirais `illimite` de la migration : c'est-à-dire qu'elle ne voyait pas l'oubli qui coûte cher,
une colonne ajoutée au schéma et jamais reportée. Le test compare désormais une base **d'origine**
plus la migration au schéma du jour, et NOMME ce qui manque. Trois preuves par réintroduction :
colonne oubliée, `DROP` retiré, table en trop — les trois tombent.

Au passage, une faute de la même famille dans le test lui-même : son filtre cherchait `licences`
dans l'instruction ENTIÈRE, donc il sautait `CREATE TABLE ventes`, dont la clé étrangère nomme
licences. Un motif trop large attrape du code juste (9.4.7) — ici, dans un test.

## 10.8.0-beta.1 — 22/09/2026

**Une licence de cabinet peut porter « sans limite de dossiers ».** Décidé avec Skander pour les
premiers cabinets, dont le cabinet pilote : leur vendre un quota le jour où on leur demande de
tester le produit n'a pas de sens, et le calibrer au jugé encore moins. La case existe désormais
dans la console, et l'application s'y conforme — la grille ordinaire ne change pas d'un chiffre.

**C'est un ÉTAT, pas un très grand nombre.** Une clé à 99 999 dossiers aurait fonctionné sans une
ligne de code : c'est précisément ce qu'il ne fallait pas faire. Le cabinet aurait lu « 100 002
dossiers autorisés » sur l'écran qui doit le rassurer — un chiffre que personne n'a décidé, et une
barre de progression qui avance vers une limite imaginaire. `licenceCabinet` rend donc
`autorises: null`, l'écran écrit « sans limite », et le verrou ne peut plus tomber.

**Ce que la case change, et ce qu'elle ne change pas.** Elle cache le quota — réclamer un chiffre
dont on vient de dire qu'il ne sert pas est un piège, et le champ porte une étoile d'obligation
qu'on ne pourrait plus satisfaire — et elle efface le prix proposé, qui se calculait sur ce
quota : un montant déduit d'un nombre de dossiers qui ne compte plus serait un chiffre faux
(7.16.0). Le prix se saisit à la main, et l'écran le dit. Elle ne touche ni à l'essai, ni à la
date de fin, ni à la révocation, ni au comptage : un cabinet sans limite voit toujours combien de
dossiers il a.

**Elle ne concerne QUE les dossiers d'un cabinet**, et la console refuse en le disant sur une
licence d'entreprise — qui n'en compte aucun. Le champ entre en **queue** de la charge signée,
après `type` et `dossiersHors` : au milieu, il changerait l'ordre des champs déjà signés, et une
clé refabriquée depuis sa charge rangée en base ne serait plus identique à celle qu'on a envoyée
(8.5.0). Une clé d'avant se comporte donc exactement comme avant.

**Le statut de fondateur se POSE, il ne se déduit jamais du rang d'émission.** Skander : « vu que
je vais tester l'application je vais créer des licences, est-ce que ça va pas me cramer mes 20
licences sans limite ? » Non — parce que **rien ne compte**. Vérifié avant de répondre : le mot
« fondateur » n'apparaît nulle part dans le code, et aucun compteur n'existe. La séparation qui
rend ça propre, et qui vaut pour tout ce qu'on voudra compter un jour : **la clé porte ce que
l'application doit faire respecter** (le quota) ; **la console porte ce que l'éditeur doit
compter** (le statut commercial). L'application n'a pas à savoir qu'on compte jusqu'à vingt. Une
clé de test n'est simplement pas marquée.

**Et deux instruments réparés, chacun par sa preuve :**

- **Le garde-fou que j'ai écrit ne pouvait pas voir son propre défaut.** Il interdit qu'une
  déclaration locale masque une fonction du module de la console — la faute qui a tué le
  formulaire d'émission la veille, sans une ligne dans aucune console (`node --check`, le lint et
  le garde-fou du backtick passent tous les trois). Il ne lisait que `function nom(` : la page en
  a 47 sous cette forme et **22 sous la forme `var nom = function`**, qui est très exactement
  celle où vivait le défaut. Réintroduit, il restait vert. Il lit maintenant les deux familles —
  et il ne dit rien sur les 69 fonctions du code juste.
- **L'instrument de rendu ouvrait le formulaire d'émission dans le seul état où la case neuve
  n'existe pas.** Le formulaire a deux visages — une licence d'entreprise montre l'offre et le
  parrainage, une licence de cabinet montre l'empreinte, le quota et « sans limite » — et le
  parcours ne mesurait que le premier. C'est T-55 d'un cran plus bas : l'instrument atteint
  l'écran, mais dans l'état où le contrôle neuf n'est pas rendu. Il bascule désormais le type et
  coche la case : **de 93 à 101 écrans, 2 125 boutons, 648 colonnes, 2 669 écarts**, et rien
  d'illisible, de désaligné ni de collé sur les deux états qu'il n'avait jamais vus.

Trois preuves par réintroduction, plus les deux directions du garde-fou élargi. `npm test` :
763 tests. `e2e:console` et `e2e:cabinet-licence` verts.

## 10.7.0-beta.1 — 22/09/2026

**Achats sort des réserves de l'offre Indépendant.** Signalé par la session qui développe
`skanfact.tn` : « tu ne peux pas vendre 390 DT une version qui oblige le cabinet à ressaisir,
alors que le cabinet est ton canal de distribution ». L'argument est juste, et le vrai motif est
plus grave que celui-là.

**Le chiffre.** Mesuré sur le jeu de démonstration, exercice 2026 entier, en vidant simplement
les achats et les fournisseurs — c'est-à-dire l'état exact des données d'un client qui n'a jamais
pu en créer : le paquet qu'il envoie à son comptable déclare **7 441,33 DT de TVA au lieu de
3 250,16**. La collectée y est entière, la déductible vaut **zéro**, et l'écart de **4 191 DT**
part à l'administration sur un logiciel vendu 390. Sur le seul mois d'août : 313,50 DT annoncés
alors que rien n'est dû. Le journal des achats est vide (13 lignes → 0), celui des règlements
fournisseurs aussi (8 → 0), et les écritures tombent de 382 à 314.

Ce n'est donc pas « le cabinet doit ressaisir » : **c'est l'offre qui vend une déclaration
fausse**, en silence, dans le fichier même qui sert à déclarer. Le module s'appelle d'ailleurs
« Achats et fournisseurs — ce que tu dépenses, et *la TVA que tu récupères dessus* ».

**Les cinq autres réserves ne bougent pas, et c'est mesuré aussi.** Les six modules ont été
testés un par un : stock, immobilisations, paie, pilotage et partage ne changent **ni la TVA ni
aucune case déposée** — ils retirent des écritures de gestion (la paie 68, les immobilisations 7,
la trésorerie 38), pas un chiffre que le client dépose et paie. Et ce qu'ils portent est très
exactement ce que le cabinet fait à sa place depuis les 9.7.0 (amortissements) et 10.3.0 (paie).
La ligne reste donc nette : **Indépendant = tout ce qu'il faut pour facturer ET déclarer juste ;
Entreprise = gérer** (stock, immobilisations, salariés, trésorerie et marges, deux postes).

**La règle qui en sort, et le garde-fou qui la tient : une offre peut fermer un confort, jamais
une case de déclaration.** Le test ne lit pas une liste de modules interdits — il MESURE : pour
chaque module qu'une offre réserve, il vide ce que ce module permet de créer et recalcule la TVA
de l'exercice. Si elle bouge, il tombe, avec le chiffre dans le message. Il est général exprès :
il tombera aussi le jour où quelqu'un réservera un module neuf qui touche à la déclaration.

**La contrepartie, livrée avec.** Avec Achats ouvert, un Indépendant peut désormais saisir un
achat en « immobilisation » sans pouvoir créer la fiche du bien. C'est voulu — le cabinet la crée
depuis les écritures du paquet, au compte 22, depuis la 9.7.0 — mais l'application ne doit pas le
lui **reprocher** : « Tant que la fiche manque, rien n'est déduit » devient faux. La ligne d'« À
faire » dit maintenant que le comptable s'en charge, l'avertissement de l'éditeur d'achat aussi,
et la pastille rouge de la barre latérale disparaît — un compteur de tâches à côté d'un cadenas
dit deux choses contraires.

**Et un instrument rouge depuis la 10.5.0, réparé au passage.** `e2e:plateforme` — le parcours qui
prouve qu'une révocation signée ferme vraiment la création chez un client — portait une base de
données écrite **à la main**, un objet qui n'implémentait que `first()` et `run()`. C'est
exactement ce que la 8.5.0 avait condamné et corrigé pour `e2e:console` (« les tests ne rejouent
plus le worker, ils le font tourner ») : la leçon n'avait jamais été portée ici. Le prix s'est payé
en 10.5.0, quand une route a commencé à appeler `.all()` : le parcours est mort sur
`env.DB.prepare(...).all is not a function`, et personne ne l'a vu — un parcours rouge qu'on ne
relance pas cesse d'exister. Il tourne désormais sur la VRAIE base SQLite, sur le schéma qu'on
demande à Skander de coller, avec de vraies révocations écrites en SQL. La fidélité a livré son
premier constat dans la foulée : la vraie base **met à jour** l'annonce d'un poste déjà connu au
lieu d'en empiler une — c'est tout l'intérêt, on compte des ordinateurs, pas des démarrages — là
où la fausse en ajoutait une à chaque fois.

Les prix ne changent pas : ils se règlent dans la console depuis la 10.5.0, et c'est une décision
du propriétaire, pas de cette version.

## 10.6.0-beta.1 — 22/09/2026

**L'audit de la console, en Product Designer, et les vingt-neuf constats corrigés d'un bloc.**
Skander : « Ne modifie rien. Analyse cette plateforme comme un Product Designer SaaS senior »,
puis « corrige tout ça ». Trois critiques, cinq majeurs, douze moyens, neuf finitions — et le
trou d'instrument qui explique pourquoi personne ne les avait vus.

Publiée en **bêta** : le premier des trois critiques change un PRIX sur une facture.

**Les trois critiques.** Le formulaire d'émission proposait le prix de l'offre *Entreprise* quel
que soit l'offre choisie, parce que le champ était pré-rempli une fois au dessin et que rien ne
le recalculait : vendre un Indépendant à 690 DT au lieu de 390 ne demandait aucune faute de
frappe. Le prix suit désormais l'offre, et il DIT d'où il vient (« proposé d'après l'offre » ou
« saisi à la main ») — un chiffre pré-rempli qu'on ne distingue pas d'un chiffre décidé est un
chiffre qu'on ne relit pas. Les dates se saisissaient au format interne (`2026-09-17`) sous une
invite française ; elles s'écrivent et se lisent en `JJ/MM/AAAA`, le 31 février est refusé en le
nommant. Et **émettre demande une confirmation** : le premier clic rend le récapitulatif — à qui,
quelle offre, jusqu'à quand, combien — et le second signe. Une clé livrée ne se reprend pas
(8.2.0) : c'est le dernier écran avant un geste irréversible, il n'existait pas.

**Les cinq majeurs.** Une ligne garde au plus UN bouton visible et le reste passe par un menu
(7.29.0) — la console en portait jusqu'à cinq, et à 1440 px les colonnes FIN, ENVOYÉE et ÉTAT
des Licences étaient **entièrement hors de l'écran** (524 px de débordement, mesurés ; zéro
après). Les colonnes entièrement vides se masquent en le DISANT, avec « Tout afficher » pour les
rendre — masquer sans le dire serait un piège (7.12.0). Chaque écran finit par le geste suivant.
Et la hauteur d'une ligne est passée de 210 px à 54.

**Les douze moyens et les neuf finitions.** Les Réglages se replient par section avec leur
sommaire (arriver sur un titre replié, c'est arriver nulle part — 7.32.0) ; les valeurs internes
(`darwin`, `licence.emise`) se disent en français ; la clé émise s'affiche résumée avec « Voir la
clé entière » derrière ; les champs conditionnels n'apparaissent que quand ils servent ; la barre
d'enregistrement flotte ; les libellés nomment l'écran d'arrivée.

**Le trou qui explique les vingt-neuf.** `e2e:console-rendu` mesurait dix écrans en quatre passes
et n'en **photographiait que cinq**, chacun coupé au bas de la fenêtre — la console pose un cadre
fixe (`height:100vh`) et fait défiler un élément interne, donc « page entière » rendait exactement
une capture d'écran (le défaut résolu pour les deux applications en 9.4.3, jamais porté ici). Et
huit surfaces n'étaient atteintes par personne : le récapitulatif avant signature, la clé émise,
le menu d'une ligne, la relance composée, **la fiche d'un client**, le devis et son aperçu, **la
palette**, **le pli scellé** et **la page publique de vérification** — la seule surface du produit
que des inconnus ouvrent. L'instrument les atteint toutes : de 5 captures à **93**, de 1 277
boutons à 1 925, 592 colonnes, 2 445 écarts.

Il a trouvé deux défauts dans l'heure qui a suivi. Sur la fiche d'un client, l'en-tête « Montant
HT » était aligné à gauche au-dessus de valeurs alignées à droite — la faute de la 7.23.0, sur un
écran qu'aucune sonde n'avait jamais regardé ; l'alignement se DÉDUIT désormais des cellules, donc
une colonne qui devient un nombre demain s'aligne toute seule. Et la page publique mélangeait
apostrophes droites et typographiques dans le même paragraphe.

## 10.5.0-beta.1 — 22/09/2026

**La console retenait ce qui EXISTE, et rien de ce qu'on en faisait.** Un essai se terminait,
l'alerte se levait, Skander appelait le prospect — et le lendemain la même alerte se relevait à
l'identique. Une alerte qui ne se referme pas cesse d'être lue au cinquième prospect, et emmène
avec elle celles qui comptaient. Et un prix qui se change en modifiant le code n'est pas un prix,
c'est une constante : il faut un déploiement pour l'ajuster, donc on ne l'ajuste jamais.

**Les deux applications ne changent pas d'un octet** : `src/` et `build/` ne portent aucune
différence. Tout ce qui suit vit dans le worker de la console — il se déploie sur Cloudflare, pas
par une release — et dans une **migration D1** à coller (en fin d'entrée).

### Régler, depuis l'écran

- **Un onglet Réglages**, et quinze valeurs qui vivaient dans le code ou dans les variables du
  worker : les trois prix, la remise de parrainage, la devise, le lien de paiement, la signature
  des mails, et sept seuils d'alerte. **Trois rangs** décident, dans cet ordre : ce qui est réglé à
  l'écran, sinon la variable du worker, sinon le défaut — poser une valeur ici doit pouvoir
  CORRIGER une variable mal réglée sans toucher à Cloudflare, jamais l'inverse.
- **Chaque valeur dit d'OÙ elle vient.** Sans ça, un écran de nombres laisse croire qu'ils ont tous
  été décidés, alors que la plupart sont des défauts que personne n'a jamais regardés.
- **Un refus nomme le champ ET la forme attendue**, et ce qui était bon est enregistré quand même :
  un formulaire tout-ou-rien ferait recommencer quinze champs pour une virgule.
- **Vider un champ numérique le rend à son rang suivant** ; vider un champ de texte le laisse vide
  pour de bon. « Aucune version minimale » est une décision, pas un oubli.
- **Ce que la console NE règle pas est écrit, avec la raison** : la durée de l'essai est la règle de
  l'application, pas une politique de la console — réglée ici, elle annoncerait des fins d'essai
  fausses. Le taire donnerait l'impression d'un oubli.

### Vendre

- **Un écran Essais**, nommés un par un : quel poste, quelle application, quel système, ce qu'il
  reste, et ce qu'on en a fait. Le Parc les agrège par version — utile pour compter, inutile pour
  décrocher son téléphone. C'est la file d'appels du matin, et elle n'existait pas.
- **« Noter un contact »**, sur un prospect comme sur un client : comment, ce qui s'est dit, quand
  rappeler, et l'issue. Tant qu'un rappel est posé dans le futur, ce sujet ne redemande rien — et
  le jour venu, il revient de lui-même. **Rien ne s'écrase** : chaque contact est une ligne de plus,
  parce que « je l'ai déjà appelé deux fois » est ce qu'on vient chercher avant la troisième.
- **Un « perdu » sans motif est refusé** : c'est la seule chose que ce suivi peut apprendre.
- **Le lien de paiement** entre dans les relances quand il est réglé, et **disparaît de la phrase**
  sinon — pas un vide, pas un « … ». C'est ce qui transforme une relance en encaissement.
- **Un devis**, composé depuis la fiche d'un client : la console ne parlait qu'à ceux qui avaient
  déjà acheté. Le prix vient des Réglages, jamais du code.
- **Le parrainage est chiffré** : clients amenés, **dont payants**, et CA encaissé. Vendre en
  passant par les cabinets est le modèle du produit — « amené » et « payé » ne sont pas la même
  nouvelle, et les confondre féliciterait un cabinet qui n'a rien rapporté.

### Garder, et supporter

- **La fiche d'un client** : licences, ventes, postes, ce qu'on lui a dit, journal. Répondre à
  « raconte-moi tout sur ce client » demandait cinq écrans. C'est celui qu'on ouvre à chaque appel.
- **Un client sous licence devenu muet.** Un poste qui a payé et ne s'annonce plus, c'est une
  désinstallation, une réinstallation ratée ou un réseau coupé : dans les trois cas on appelle, et
  dans les trois cas on ne l'apprenait nulle part. Un départ de client payant ne faisait aucun bruit.
- **Un poste resté sur une version ancienne**, avec le MOTIF de la version minimale. Pour un
  logiciel comptable ce n'est pas un confort : une version ancienne tourne sur du code dont on a
  corrigé des chiffres depuis. Rien tant que le seuil n'est pas réglé : la console n'écrit aucune
  règle à la place de personne.
- **Un jalon de renouvellement à soixante jours**, calme : une licence annuelle se négocie en
  amont, et une occasion criée en rouge apprend à ignorer le rouge. Il ne double jamais l'alerte
  pressante de trente jours.
- **Une page publique de vérification** (`/verifier`) : un client colle l'empreinte de sa licence et
  lit son état. Sans secret — celui qui présente une empreinte la connaît déjà — et **jamais** le
  nom du client : la requête ne va pas chercher la table des clients, et c'est elle qui protège,
  pas la forme de la réponse.

### Ne pas perdre la boutique

- **La copie de la base part toute seule**, par déclencheur programmé, dans un bucket R2. Une copie
  qui demande un clic est une copie qu'on ne fait pas — l'alerte à trente jours existait
  précisément parce que le geste ne se faisait pas. Tant que le bucket n'existe pas, l'écran **DIT**
  ce qui manque au lieu d'afficher un vert rassurant.
- **Un second secret d'administration** le temps d'une rotation. Sans lui, remplacer le secret ferme
  la console à la seconde où on le remplace — et c'est ce qui fait qu'on ne le remplace jamais, y
  compris le jour où il faudrait. Il est tenu aux mêmes exigences : un secret de rotation court
  serait une porte de service.
- **Le pli scellé**, préparé par la console : ce qu'il doit contenir, comment le sceller, et ce qui
  reste vrai sans lui. Aucune clé privée n'en sort — ce qui sort est une PROCÉDURE. C'est le point
  le plus grave du projet : une seule personne peut émettre une licence.

### L'ergonomie, et trois défauts vus sur capture

- **Le plafond de largeur suit le RÔLE.** Un seul plafond de 1180 px s'appliquait à tout : juste
  pour de la prose, faux pour un tableau de dix colonnes qui se serrait pendant que 700 px restaient
  vides à droite. Une **cinquième sonde** le mesure désormais — les quatre autres regardaient des
  objets, aucune ne voyait la place perdue.
- **Tri par colonne et pagination**, que les deux applications ont depuis la 1.9.0 et la 2.2.0. Le
  pied **nomme** ce qu'il compte (« 4 licences », jamais « 4 lignes ») et dit quand la borne de cinq
  cents lignes est atteinte : une troncature muette se lit comme « tout est là ».
- **Les bulles « i »** sur les colonnes qui sont des définitions — « Endormi n'est PAS perdu » était
  écrit nulle part. Et **Cmd+K**, qui mène à un écran, un geste ou un client par son nom.
- « Les **4** canaux stables servent une version » s'affichait au-dessus de **huit** lignes : le
  verdict ne compte que les stables, le détail listait tout. Un compteur et la liste qu'il annonce
  se calculent avec la même fonction (6.8.1) — ici on ne retire rien, on SÉPARE.
- L'export écrivait « **evenements** : 3 · **jetons** : 0 » — les noms de tables SQL tels quels,
  accent manquant compris.
- Le bandeau d'export **suivait d'écran en écran** : « activations : 4 » restait affiché pendant que
  le Parc, juste en dessous, en montrait cinq.

### Deux défauts trouvés par les parcours, invisibles autrement

- **Une réponse en retard repeignait l'écran qu'on avait quitté.** Deux dessins qui se chevauchent —
  « Actualiser » puis un clic sur un onglet — et c'est la réponse la plus LENTE qui gagnait : le
  tableau du Parc se faisait remplacer par les alertes, sous le titre du Parc. Il n'apparaît que
  lorsqu'un écran devient plus lent qu'un autre, donc il serait arrivé un jour, en production.
- **La rangée de boutons qui clôt un bloc** n'avait d'écart que DANS un panneau : posée ailleurs,
  « Enregistrer » touchait « Annuler » à zéro pixel. Un correctif qui dépend d'une classe qu'on
  pense à mettre n'est pas un correctif (9.8.3).

Treize défauts réintroduits un par un font tomber leur test. Deux sont restés VERTS et ont appris
quelque chose : une assertion sur la seule réponse de la page publique ne prouvait rien — c'est la
REQUÊTE qui protège, et elle n'était gardée par rien ; et une assertion « la tranche ne déborde pas »
ne pouvait pas échouer, parce que le gabarit est la dernière chose du fichier.

**La migration à coller dans la console D1 de Cloudflare**, une fois le worker redéployé :

```sql
CREATE TABLE IF NOT EXISTS reglages ( cle TEXT PRIMARY KEY, valeur TEXT NOT NULL, change_le TEXT NOT NULL );
CREATE TABLE IF NOT EXISTS suivis ( id TEXT PRIMARY KEY, sujet TEXT NOT NULL, quand TEXT NOT NULL, moyen TEXT, note TEXT, rappel TEXT, issue TEXT, motif TEXT, source TEXT );
CREATE INDEX IF NOT EXISTS idx_suivis_sujet ON suivis(sujet);
```

## 10.4.0-beta.3 — 22/09/2026

**Deux applications, deux parcs — et le premier chiffre de cette version était faux.** Skander a
ouvert le Parc : trois lignes, toutes « SkanFact », et « 10.4.0-beta.1 · 2 postes » sur un Mac où
tournent SkanFact ET SkanFact Cabinet. *« Je veux savoir combien de postes cabinet et combien de
postes entreprise. »* Correctif des **deux workers seulement** : les deux applications sont
identiques à celles de la 10.4.0-beta.1, à l'octet près — `src/` et `build/` ne portent pas un
fichier de différence. Ce qui change vit dans le worker de la console, déjà déployé, et dans une
**migration D1** collée le 22/09/2026 (elle est en fin d'entrée, pour mémoire).

**Pourquoi cette release existe quand même**, alors que la beta.2 et celle-ci n'avaient rien à
livrer : Skander l'a demandée pour **éprouver le canal de mise à jour de bout en bout** — la
publication, les quatre index de canal, la vérification depuis les deux applications,
le téléchargement et l'installation. Une chaîne qu'on ne vérifie que sur les versions qui pressent
finit par ne se vérifier jamais. Cette bêta ne change donc rien à ce que tu vois : si les deux
applications passent en 10.4.0-beta.3 toutes seules, c'est la chaîne entière qui vient de répondre.
Elle emporte au passage la **beta.2** (la ligne de santé des canaux qui accusait du code juste),
jamais publiée pour la même raison.

Quatre défauts, et le plus grave était invisible :

- **L'identifiant d'une activation n'a jamais porté l'application.** `empreinte_deviceId` :
  deux applications sur un poste se battaient pour la **même clé primaire**, la seconde écriture
  était refusée par la base, et `sansCasser` avalait le refus. Le Cabinet n'apparaissait donc
  jamais dans le parc, **sans une ligne nulle part**. Ça tenait par accident jusqu'ici — chaque
  application a son propre `userData`, donc son propre `deviceId` — mais un accident n'est pas un
  garde-fou.
- **`app` entre dans la clé d'unicité**, avec `COALESCE(app, 'entreprise')` et jamais `app` nu :
  dans un index UNIQUE de SQLite, deux NULL sont **distincts**. Sur la clé nue, une annonce
  arrivant sur une ligne d'avant la 10.4.0 (app NULL) ne trouverait aucun conflit et créerait un
  **doublon** — le poste compterait deux fois, sur l'écran fait pour le compter.
- **La colonne « Application » manquait à l'écran des Activations** — celui qui répond à « lequel
  de ces deux postes est le Cabinet ? ». Le champ était écrit en base depuis la 10.4.0 et affiché
  nulle part : une donnée enregistrée et jamais affichée n'existe pas (7.21.0). Les **trois**
  moitiés se tiennent maintenant, et un test les confronte : la colonne déclarée, la route qui rend
  le champ, et le NOM calculé côté serveur.
- **Ma première version de cette colonne appelait `APPS` et `appDe` depuis la page** — deux
  fonctions du module, absentes du gabarit. ReferenceError pendant la construction, écran bloqué
  sur « Chargement… », rien en console (7.22.0). C'est `e2e:console` qui l'a attrapé, jamais la
  relecture : le serveur NOMME, la page AFFICHE.

Ce que la console sait faire en plus :

- **Les compteurs se dédoublent** : essais entreprise / essais cabinet, postes entreprise / postes
  cabinet. Additionner SkanFact et SkanFact Cabinet dans « 2 essais en cours », c'est mélanger deux
  produits, deux marchés et deux tarifs dans un seul chiffre — la faute de la 7.16.0 portée au parc.
- **Le taux de conversion**, le chiffre d'un produit qu'on vend, et il n'existait nulle part :
  combien d'ordinateurs ont essayé, combien ont fini sous licence. Compté par **ordinateur** et
  jamais par ligne (un poste qui convertit garde sa ligne d'essai et en gagne une autre), borné à
  100 %, et **`null` sans dénominateur** : « 0 % de conversion » sur zéro essai annonce un échec là
  où il n'y a pas encore de question (9.6.0). L'écran affiche « — ».
- **Un essai qui se termine est une alerte** — le seul signal commercial de cette console, et il
  manquait. Elle nomme l'application, et elle dit que la date est **approchée** (« vers le ») : la
  plateforme sait quand elle a VU un poste, jamais quand son essai a commencé sur la machine.
  Prétendre une précision qu'on n'a pas est ce que ce projet s'interdit depuis Cabinet 1.0.0.
- **Relancer un client** : c'était le seul geste commercial que la console ne savait pas faire.
  « Écrire… » sur une licence qui se termine, « Relancer… » sur une vente livrée et non encaissée.
  La console **compose**, elle n'envoie pas : le texte s'ouvre dans la messagerie de l'éditeur, qui
  le relit et l'envoie lui-même. Resend ne sert qu'à la clé, qui suit un paiement et ne se discute
  pas ; une relance se relit toujours avant de partir. Rien ne s'y invente : ce qui manque disparaît
  de la phrase au lieu d'être remplacé par un vide, et la date est française, pas ISO.
- **Le Parc dit où se lit l'unité commerciale.** « Postes » reste un fait vrai pour la ligne Cabinet
  — masquer un chiffre juste derrière un « — » serait pire — mais ce qu'on **vend** à un cabinet est
  un quota de dossiers (9.4.0), et cette unité-là vit sur l'écran Cabinets. La phrase de l'écran le
  dit, plutôt qu'une colonne que seule une ligne sur trois remplirait (9.4.4).

Quatorze défauts réintroduits un par un font tomber leur test, et deux tests d'hier ont été
**retournés vers la règle** : « six cartes à zéro » décrivait l'état du jour et serait tombé sur le
correctif — la règle est que les compteurs sont à zéro et qu'un taux sans dénominateur dit « — ».

**La migration à coller dans la console D1 de Cloudflare**, une fois le worker redéployé :

```sql
DROP INDEX IF EXISTS idx_activ_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_activ_unique
  ON activations(empreinte, device_id, COALESCE(app, 'entreprise'));
```

## 10.4.0-beta.2 — 22/09/2026

**L'instrument de surveillance accusait du code juste, dix minutes après avoir été branché.**
Correctif des deux workers uniquement : aucune application ne change, et **aucune publication
n'est nécessaire** — il suffit de redéployer `skanfact-maj` et `skanfact-api`.

La ligne de santé des canaux (10.4.0), branchée pour la première fois, a annoncé « 2 canaux
stables muets : `latest-linux.yml`, `cabinet-linux.yml` ». Vrai au pied de la lettre, et faux comme
signal : ni `package.json` ni `build/cabinet.config.js` ne déclarent de cible Linux, ces fichiers
n'existeront jamais. Un orange qui ne peut **jamais** s'éteindre apprend à ignorer la barre entière
(8.0.1), et c'est un test trop large : il accuse du code juste (9.4.7).

- **`CANAUX[].attendus`** sépare ce que le relais a le DROIT de servir (`yml`, volontairement
  permissif — le jour où une cible Linux existe, il la sert sans qu'on y retouche) de ce que le
  projet PUBLIE. `resumeCanaux` marque chaque ligne, la console ne juge que celles-là. Les autres
  restent dans la réponse : un index servi alors qu'on ne l'attend pas est une information.
- **La liste est confrontée aux deux `ATTENDUS` du workflow de publication** par un test : deux
  tables séparées divergent, toujours (6.8.0). Le workflow savait depuis la 9.8.8 que quatre index
  seulement sont publiés ; le relais ne partageait pas cette connaissance.
- **`c.attendu !== false` et non `=== true`** : un relais d'avant cette version n'envoie pas le
  champ, et on préfère qu'il juge trop plutôt qu'il se taise — un instrument muet annonce que tout
  va bien (9.8.8, T-55).

Trois défauts réintroduits un par un font tomber leur test. Et la preuve elle-même a appris quelque
chose : mes trois premières injections ont rendu « 0 rouge » parce que je comptais des lignes
« not ok » que ce harnais ne produit pas — une assertion qui tombe **lève**, et le lot s'arrête.
C'est la mesure qui était fausse, pas le code (9.9.1).

## 10.4.0-beta.1 — 22/09/2026

**La bêta qui rattrape cinq versions.** Aucune ligne de code nouvelle : cette préversion porte
telles quelles la **10.0.1, la 10.1.0, la 10.2.0, la 10.3.0 et la 10.4.0**, écrites, testées et
commitées mais **jamais publiées** — la dernière stable en ligne est la 10.0.0 du 21/09/2026.

Une seule publication pour les cinq, parce qu'une publication coûte le quota d'Actions et que la
règle du projet est de regrouper (§ 6.7.2). Et par la **bêta**, parce que quatre des cinq touchent
ce que la règle protège : la devise d'un achat et le sens d'une pièce (10.1.0, 10.2.0) changent des
**chiffres** qui partent chez un comptable ; la paie du Cabinet (10.3.0) ajoute deux listes au
**format** de `livre.json` ; l'espace de gestion (10.4.0) ajoute une colonne à la base D1 et un
champ à ce qui part d'une application vers un serveur. Seule la 10.0.1 aurait pu passer en stable
direct — la sortir seule aurait coûté une publication de plus pour rien.

Ce qu'il y a à tester, dans l'ordre où ça casserait le plus cher :

- **Une facture d'achat en euros** (10.1.0) : son total à l'écran reste en euros, mais la TVA
  déductible, les charges, le résultat, le stock, la trésorerie et les écritures la comptent
  convertie. Treize agrégateurs sont concernés.
- **Un avoir fournisseur et un acompte versé** (10.2.0) : l'avoir se saisit en positif, l'acompte
  n'est pas une charge, et le compte d'avances revient à zéro une fois la facture imputée.
- **Un bulletin de paie dans le Cabinet** (10.3.0) : le même salarié et la même saisie doivent
  donner le même bulletin des deux côtés, au millime.
- **La console** (10.4.0) : onglets « À décider », « Parc », « Cabinets », l'export de la base, et
  la ligne d'argent groupée par devise.

Rappel du chemin de retour : décocher « Recevoir les versions bêta » ramène à la stable, et une
sauvegarde `avant-beta` est prise avant d'armer le canal.

## 10.4.0 — 21/09/2026

**L'espace de gestion des deux plateformes.** Skander voulait « le contrôle dessus autant que
auditeur ». En regardant ce que la console savait faire, deux trous se sont ouverts, et le second
n'avait jamais été nommé.

Le premier : **la console ne voyait qu'une des deux applications**. Seule SkanFact s'annonçait.
SkanFact Cabinet, qui porte pourtant sa licence depuis la 9.4.0 et son canal d'essai depuis la
9.1.0, n'existait nulle part — ni combien de postes tournent, ni sur quelle version, ni depuis
quand une installation ne s'est plus montrée. Un éditeur qui ne voit qu'une moitié de son parc ne
la contrôle pas : il la découvre.

Le second : **rien ne rangeait la base**. D1 est le seul endroit où vit « qui a acheté quelle clé »,
le contenu signé compris — celui qui permet de refabriquer une clé à l'identique et de la renvoyer
à un client qui a perdu la sienne. La perdre emporte toutes les ventes, et plus aucune clé vendue
ne peut être renvoyée, renouvelée ni révoquée. C'était décidé avant la première vente
(`QUESTIONS.md`, 4e relecture) et ça n'avait jamais été écrit.

**À publier par la bêta** : ça touche une clé, le format de la base et ce qui part d'une
application vers un serveur.

- **SkanFact Cabinet s'annonce**, exactement comme SkanFact : la clé, l'identité du poste, le
  système, la version, et le nom de l'application. **Rien d'autre** — jamais un dossier, jamais un
  client, jamais un chiffre. L'app du comptable détient la comptabilité de dizaines d'entreprises,
  et c'est un test qui compte les champs qui doit arrêter quiconque voudra « juste ajouter » un
  compteur de dossiers. Tout reste facultatif : sans adresse et sans secret, rien ne part.
- **La colonne `app`** sur les activations. `NULL` = tout ce qui a été noté avant, c'est-à-dire
  l'app entreprise : elle était seule à s'annoncer. Une colonne s'AJOUTE, aucune ne se renomme.
- **L'onglet « Parc »** : les deux applications, groupées par version. Cinq cents lignes brutes ne
  répondaient pas à la seule question qu'on se pose avant de publier un correctif — combien de
  postes sont restés sur une version d'il y a six mois ? Et « endormi » se compte **à part**, il ne
  se retranche pas : un portable refermé pour les vacances n'est pas un poste perdu.
- **L'onglet « À décider »**, l'écran d'entrée de la console : clés jamais envoyées, ventes à
  encaisser, licences qui se terminent, base jamais exportée. Trié par urgence, jamais par ordre
  d'écriture, et chaque ligne OUVRE l'onglet qui la règle. Sur une console où rien n'a été vendu,
  rien n'est réclamé : on vérifie que l'univers est non vide avant de crier (7.0.0).
- **L'onglet « Cabinets »** : un cabinet par ligne, son quota, ses clients parrainés, ses postes.
  La moitié de l'activité que la console ne montrait nulle part.
- **« Exporter la base… »**, des deux côtés : un bouton dans la console (le fichier descend dans le
  navigateur) et un dans SkanFact → Paramètres → L'application → Éditeur, qui le range dans
  `~/.skanfact/`, en 0600, à côté des clés — jamais dans les données, jamais dans une sauvegarde,
  jamais dans un dossier partagé. L'enveloppe porte un **compte par table** : un export tronqué
  ressemble à un export complet, et c'est le jour où l'on en a besoin qu'on s'en aperçoit. Une
  ligne « À faire » le réclame à trente jours — et tout de suite s'il n'a jamais eu lieu.
- **La santé des canaux de mise à jour.** La 9.8.8 a coûté une publication : un `latest.yml` posé
  par erreur sur une préversion s'est retrouvé servi à toutes les installations stables. Le
  workflow le vérifie au moment de publier — mais rien, ensuite, ne disait ce que chaque canal sert.
  Le relais gagne `/sante`, la console l'affiche, et **non branchée, elle le DIT** au lieu d'un vert
  rassurant.
- **Combien j'ai encaissé, combien m'attend.** La question qu'un éditeur se pose en ouvrant sa
  console, et qui n'avait de réponse nulle part — les ventes se lisaient ligne par ligne, aucun
  total ne les résumait. Groupé par **devise** (additionner des dinars et des euros est la faute de
  la 7.16.0, et elle ne se voit pas) et « encaissé » porte son **année** ; « en attente » n'en porte
  pas, parce qu'une vente de l'an dernier qui n'est pas payée attend toujours.
- **Le journal se filtre** (par client, par licence, par geste, par période) : cinq cents dernières
  lignes sans filtre, ce n'est pas une piste d'audit, c'est un flux.
- **Un défaut trouvé en chemin** : `dateValide` **levait** sur une date impossible (« 2026-13-99 »
  passe la forme et ne fait pas une date, et `toISOString` lève dessus). Un jour tapé de travers
  dans le champ de date libre de la console ne rendait pas un refus — il rendait un 500.

*Si la base D1 a été créée avant la 10.4.0, une ligne à coller dans la console D1 :
`ALTER TABLE activations ADD COLUMN app TEXT;` (voir `plateforme/README.md`).*

## 10.3.0 — 21/09/2026

**La paie des clients, dans SkanFact Cabinet.** Le travail mensuel le plus réclamé après la TVA, et
le Cabinet ne savait pas le faire. Un cabinet a soixante clients dont deux utilisent SkanFact :
pour les cinquante-huit autres — ceux qui PAIENT — il n'existait aucun moyen de tenir la paie. Le
comptable établissait les bulletins ailleurs et **retapait l'écriture à la main**.

Concrètement, une boulangerie de l'Ariana, six salariés, pas sur SkanFact : chaque mois son patron
envoie « Mohamed a pris trois jours sans solde, Sonia a fait une prime, on a embauché Karim le 10 ».
Il fallait six bulletins, l'écriture de paie, la déclaration CNSS du trimestre — et rien de tout ça
n'existait côté cabinet.

**À publier par la bêta** : ça touche des chiffres, des écritures et le format d'un fichier.

- **Le moteur de paie a déménagé** de `core.js` vers `compta.js`, partagé par les deux applications.
  La règle de découpage de la 9.1.0, relue dans les deux sens (9.6.1) : ces fonctions prennent un
  SALARIÉ et une SAISIE, jamais `data`. Elles étaient du mauvais côté depuis la 5.0.0. `core.js`
  les réexporte à l'identique — un test compare les OBJETS, jamais leurs résultats.
- **Les salariés et les bulletins vivent dans le livre de l'exercice.** Un bulletin garde une COPIE
  de son calcul : changer un barème plus tard ne réécrit jamais un bulletin déjà remis. Un salarié
  qui part ne s'efface pas — on note sa sortie, et son nom reste sur les bulletins existants.
- **L'écriture de paie du mois** arrive en brouillard, au dernier jour du mois, avec exactement les
  comptes de l'app entreprise. Chaque bulletin retient l'écriture qui le porte : la repasser
  compterait la paie deux fois, et le bouton s'éteint en disant pourquoi.
- **La déclaration CNSS du trimestre** : un salarié par ligne, son assiette et les deux parts, à
  recopier sur le portail. SkanFact Cabinet ne dépose rien et ne se connecte à aucune administration.
- **Les contrôles NOMMENT et ne bloquent pas** : les salariés sans bulletin sont cités par leur nom,
  ceux dont le numéro CNSS manque aussi. L'écriture passe quand même — un mois traité avec deux
  manques signalés vaut mieux qu'un mois jamais traité.
- Un aperçu du net se recalcule pendant la frappe, avec le moteur qui enregistrera ; le détail d'un
  bulletin s'ouvre ligne par ligne, avec les taux qui ont servi ce jour-là.

Douze tests de comportement, chacun prouvé en réintroduisant son défaut.

## 10.2.0 — 21/09/2026

**L'avoir fournisseur, l'acompte versé et le relevé de compte client.** Trois gestes du métier que
l'application ne savait pas faire, trouvés en répondant à « est-ce que ce qu'on a développé répond
vraiment au métier ? ». Un avoir de fournisseur se saisissait en tapant des montants négatifs — ce
qu'aucune comptabilité n'accepte (règle 6.3.0) — ou ne se saisissait pas du tout. Un acompte versé
à la commande n'existait nulle part tant que la facture n'était pas arrivée. Et un client qui avait
six factures ouvertes recevait six relances, à charge pour lui d'en faire le total.

**À publier par la bêta** : ça touche des chiffres et des écritures.

- **Avoir fournisseur** : les montants se saisissent en POSITIF, comme le fournisseur les a écrits,
  et c'est le sens de la pièce qui décide de la colonne. Il se rattache à la facture qu'il diminue
  (le reste à payer baisse d'autant), ou reste libre — un crédit qu'on détient chez ce fournisseur,
  que la fiche du fournisseur compte et que « À faire » rappelle. La marchandise rendue RESSORT du
  stock, la TVA déductible baisse, la charge baisse, et un remboursement reçu entre en trésorerie
  au lieu d'en sortir.
- **Acompte versé** : ce n'est pas une charge, c'est une avance sur un fournisseur qui n'a pas
  encore livré. Elle va au compte d'avances (409 — À VÉRIFIER), n'entre ni dans le résultat, ni
  dans le seuil de rentabilité, ni dans le stock, et se solde toute seule le jour de la facture par
  une écriture d'imputation qui rend aussi la TVA déjà déduite — sans elle, la TVA de l'acompte
  était déduite deux fois.
- **Les deux se créent depuis la pièce concernée** : le menu d'une facture d'achat propose « Saisir
  un avoir sur cette pièce » et « Saisir un acompte versé », qui arrivent déjà rattachés et dans la
  bonne devise. Un avoir dans une autre devise que la facture qu'il vise est refusé, en le disant.
- **Relevé de compte client** : toutes les pièces encore ouvertes à une date, leur total, ce qui est
  échu et ce qui ne l'est pas. Il s'ouvre depuis la fiche du client, depuis la liste des clients et
  depuis chaque ligne des relances, s'exporte en PDF et s'envoie par email avec le PDF joint. Il se
  déduit à l'instant où on l'imprime — un relevé enregistré se périmerait au prochain encaissement.
- **Un en-tête de fiche a un budget de boutons**, comme une ligne de liste : « Modifier »,
  « Écrire » et le relevé vivent désormais dans un menu « Actions », et les deux gestes quotidiens
  (« + Facture », « + Devis ») gardent leur place.

**Corrigé au passage**, trouvé par le parcours réel : le bouton « Actions » d'un en-tête de fiche
disparaissait dès qu'un tableau de documents se dessinait sur la même page. Deux menus d'actions
posés sur la même racine se mangent — celui du tableau retire les boutons qu'il ne reconnaît pas.

Quinze tests de comportement, chacun prouvé en réintroduisant son défaut, plus deux étapes de bout
en bout dans l'application réelle (`npm run e2e:fiches`).

## 10.1.0 — 21/09/2026

**La devise d'un achat.** Trouvé en répondant à la question « est-ce que les deux applications
répondent vraiment au métier ? » : **un achat n'avait aucune devise**. Une facture fournisseur de
1 000 € saisie telle quelle comptait 1 000 dinars — dans la TVA déductible, dans les charges, dans
le résultat, dans le seuil de rentabilité, dans le stock, dans la trésorerie, dans les écritures et
dans le paquet envoyé au comptable. Trois fois et demie trop peu, partout, et **rien à l'écran ne
le montrait**. C'est la faute de la 7.0.1 (le timbre compté en euros) et de la 7.16.0 (les cartes de
l'accueil), jamais portée du côté des achats.

**À publier par la bêta** : ça touche des chiffres, et c'est très exactement le cas que la règle
réserve au canal d'essai.

- **Un achat porte sa devise et son taux**, comme une facture de vente depuis la 1.6.0. On saisit ce
  qui est imprimé sur la pièce du fournisseur, sans rien convertir de tête ; l'écran annonce sous
  les totaux le montant qui entrera en comptabilité, avec le taux appliqué.
- **Le taux est OBLIGATOIRE dès que la devise diffère**, et l'enregistrement le refuse en amenant le
  champ à l'écran. Les achats déjà saisis qui en manqueraient remontent en rouge dans « À faire »,
  avec leur propre ligne et leur propre bouton — la ligne des ventes mène aux factures, celle-ci aux
  achats.
- **Treize endroits convertissent désormais** : la TVA déductible de la déclaration, le journal des
  achats, le résultat, le seuil de rentabilité, les écritures comptables, le coût moyen pondéré du
  stock, la marge d'une affaire, la rentabilité d'un contrat, ce qu'on doit aux fournisseurs, la
  fiche d'un fournisseur, la retenue à la source à reverser, la déclaration d'employeur, et la
  sortie d'argent en trésorerie. Chacun a son test, et chacun a été prouvé en remettant le défaut.
- **Rien ne bouge pour ceux qui n'achètent qu'en dinars** : la migration pose la devise de la
  société avec un taux de 1, donc aucun chiffre déjà déclaré ne change d'un millime.
- **La devise d'origine est NOMMÉE partout où le montant est converti** — le journal des achats, la
  liste, ce qu'on doit. Un chiffre converti dont on ne sait plus d'où il vient ne se vérifie plus
  contre la facture papier.
- **Et l'absorbeur d'arrondis dit enfin ce qu'il avale.** Il existe depuis la 6.3.0 pour les
  quelques millimes que laisse une TVA calculée ligne par ligne ; il avalait en réalité n'importe
  quel écart et rendait une pièce équilibrée, plausible et fausse. Trouvé en prouvant la conversion :
  le défaut remis laissait **2 856 DT** de trou et la pièce sortait juste. La pièce reste équilibrée
  (une pièce déséquilibrée ne s'importe nulle part), mais au-delà d'un millime par ligne l'écart est
  marqué — et un test vérifie qu'aucune écriture des 24 mois du jeu d'exemple n'en porte.
- **Le jeu d'exemple montre le cas** : une licence antivirus achetée en euros, avec son taux.

## 10.0.1 — 21/09/2026

**Les pannes se disent en français, et l'outillage cesse de crier pour rien.** Correctif
d'entretien, publié **en stable direct** : rien ici ne touche à un chiffre, à une clé, au moteur
comptable ni au format d'un fichier — c'est très exactement le cas que la règle de publication
autorise sans passer par la bêta.

- **Un disque plein ne dit plus « ENOSPC ».** Dix pannes du système (disque plein, quota atteint,
  accès refusé, dossier en lecture seule, support débranché, trop de fichiers ouverts…) sont
  traduites en une phrase française, **au niveau du pont IPC des deux applications** — on enveloppe
  une fois, pas quatre-vingts fois. Les tables des deux applications sont identiques au caractère
  près, et un test les compare.
- **Un enregistrement qui échoue ouvre une fenêtre, plus un bandeau de 2,6 secondes.** Elle dit ce
  qui s'est passé, rappelle que **ce qui est à l'écran est intact**, et propose « Réessayer ».
  Perdre l'information la plus importante de la journée dans un message qui s'efface était le
  contraire de ce que cette application promet.
- **Deux imports de paquets à la fois sont refusés** dans l'app du comptable, en nommant celui qui
  est déjà en cours : les deux écrivaient dans le même état, et le second effaçait le travail du
  premier sans un mot.
- **Le journal des règlements fournisseurs a enfin son écran.** Il partait dans le paquet du
  comptable depuis la 6.1.0 et n'était visible nulle part : on ne pouvait ni le lire, ni le trier,
  ni l'exporter. Comptabilité → Achats, avec sa bulle qui dit en quoi il diffère du journal des
  achats (celui-ci porte les dates de facture, celui-là les dates de paiement).
- **Le dossier de réception dit pourquoi il ne s'ouvre pas** : « accès refusé » et « support
  débranché » n'appellent pas le même geste, et l'application devinait la seconde dans les deux cas.
- **Un fichier de données illisible écrit sa raison au journal.** L'écran continue de dire « un
  fichier a été mis de côté » — c'est ce qu'il faut à l'utilisateur —, mais « JSON mal formé » et
  « structure inattendue » ne se dépannent pas pareil, et c'était le seul endroit du stockage où
  l'erreur disparaissait sans trace.
- **Le garde-fou de double-numéro dit enfin la vérité.** Un drapeau que rien n'armait était censé
  refuser pendant le geste, et le test de la 9.1.0 le cherchait par son NOM. Ce qui protège
  vraiment, c'est le bouton qui se désactive pendant l'attente et le fait que l'émission ne rende
  jamais la main entre le contrôle et l'attribution du numéro — c'est cette règle-là que le test
  exige maintenant.
- **`npm run charge:entreprise`** : dix ans d'activité (4 800 factures, 1 440 achats, 300 clients,
  3,8 Mo), et six gestes mesurés sur les vraies primitives, chiffrement et écriture atomique
  compris. Tout passe ; la marge la plus étroite est la préparation du paquet mensuel.
- **Le lint passe de 90 avertissements à zéro.** Onze variables mortes retirées — dont deux dont le
  commentaire décrivait un mécanisme inexistant —, `catch (_)` reconnu comme la façon d'écrire « je
  jette délibérément cette erreur », et trois parcours de test qui mesuraient une valeur sans jamais
  la comparer à rien s'en servent enfin.
- **Le README dit vrai** : le dépôt est public, l'app du comptable a sa section d'installation, et
  la publication décrit le chemin réel (bêta, stable, seize fichiers, job de vérification).

## 10.0.0 — 21/09/2026

**La liasse et l'annuel.** La dernière version du plan accepté, et le document où une erreur coûte
le plus cher. **Publiée en stable direct sur `main`, à la demande de Skander** — la règle du projet
veut la bêta pour tout ce qui touche au moteur comptable ; c'est sa décision, elle est notée ici.

- **La liasse, déduite de la balance.** Bilan actif, bilan passif, état de résultat, en rubriques
  codées. Trois choses garanties et testées : **actif = passif**, le résultat du bilan est celui de
  l'état de résultat, et **aucun compte n'est perdu** — ce qu'aucune rubrique ne capte est montré en
  rouge, parce qu'une liasse qui perd un compte en silence est une liasse fausse et qu'on s'en
  aperçoit au contrôle. Chaque rubrique s'ouvre sur les comptes qui l'ont remplie.
- **Aucune rubrique n'est une vérité.** Le modèle livré suit l'usage ; la présentation exacte du
  système comptable des entreprises n'est validée par personne ici, et l'écran l'écrit. La table
  entière se modifie dans les Réglages, et celle du cabinet **remplace** la nôtre — jamais un
  mélange des deux, qui donnerait un rattachement que personne n'a décidé. Le compte va dans la
  rubrique du préfixe le plus LONG, parmi celles du bon **sens de solde** : le 44 débiteur est une
  créance sur l'État, le même 44 créditeur est une dette envers lui.
- **Une rubrique vide vaut « — » avec sa raison, jamais 0** : un zéro se recopie sur un formulaire.
- **Le résultat fiscal, et aucun taux d'impôt dans le code.** Résultat comptable + réintégrations −
  déductions et reports. Ce qui se réintègre dépend du droit : rien n'est proposé, chaque ligne se
  saisit et s'explique, et son montant est toujours positif — c'est la NATURE qui dit dans quel sens
  elle joue. Le taux se saisit ; tant qu'il ne l'est pas, l'impôt vaut « — ». Le **minimum d'impôt**
  n'est pas calculé : un chiffre inventé sur une déclaration coûte plus cher qu'une case vide.
- **La déclaration annuelle d'employeur**, lue dans le livre. Elle porte deux choses distinctes
  qu'on confond — les salaires versés et les retenues sur fournisseurs — et dit ce qu'elle ne peut
  PAS donner : le détail par bénéficiaire demande les bulletins, que le cabinet ne reçoit pas.
- **Les états envoyés au client portent un cadre de signature** : des états financiers qui n'engagent
  personne ne valent rien. Et « ce n'est pas la liasse » a disparu de l'écran des états — la phrase
  existait parce que la liasse n'existait pas ; la garder maintenant dirait faux.
- **Le calendrier fiscal par régime** (F-9.6.0-12, la seule ligne de la 9.6.0 jamais livrée). Le
  champ « Régime fiscal » existait sur une fiche depuis la 6.8.0 et **personne ne le lisait** : un
  forfaitaire se voyait réclamer une TVA qu'il ne dépose pas. La table part **vide** — tant qu'elle
  l'est, rien ne change à l'écran — et c'est le cabinet qui déclare SES régimes : périodicité de
  TVA, CNSS ou non, et les échéances annuelles qu'il écrit lui-même. SkanFact n'écrit aucune règle
  de droit.
- **Le jeu d'exemple porte enfin un exercice entier** : douze paquets ouvrables sur un dossier (une
  liasse sur huit mois n'est pas une liasse), et un **client hors SkanFact** — un cabinet a soixante
  clients dont deux sur SkanFact, et c'est ce dossier-là qui compte dans sa licence.
- **Le manuel de tenue** dans l'aide du Cabinet : la boucle du mois, celle de l'exercice, et les
  trois choses que SkanFact ne fera jamais — écrire chez un client, déposer à sa place, inventer une
  règle de droit.
- Correctif au passage : `cab:saveCabinet` **effaçait le nom du cabinet** dès qu'un écran n'envoyait
  que des réglages. Tous les appelants pensaient à recopier l'identité ; le premier qui l'oublierait
  aurait rouvert l'assistant de bienvenue au démarrage suivant. Le piège vivait dans le handler.

**Ce qui n'y est pas, et pourquoi.** La page Tarifs et le téléchargement du Cabinet (F-10.0.0-09 et
10) vivent dans le dépôt du site, pas ici. Et la liasse **n'a pas encore été confrontée à un document
réel** : c'est ce que la version demande au cabinet pilote, et tant que ce n'est pas fait, chaque
écran porte son « À VÉRIFIER ».

17 défauts réintroduits un par un font tomber leur test — dont un que le modèle livré ne pouvait pas
prouver (aucun de ses préfixes n'est imbriqué), et qu'il a fallu tester contre la table d'un cabinet.

## 9.10.0 — 21/09/2026

**La révision et les questions.** Le dossier de travail du comptable, et le seul mécanisme du projet
qui remonte du cabinet vers le client. Il ne remonte pas une écriture : il remonte une **question**.

- **Le dossier de révision par période** — un mois pour arrêter une TVA, l'exercice pour arrêter un
  bilan : sept **feuilles maîtresses** par cycle (trésorerie, ventes, achats, immobilisations,
  personnel, fiscal, capitaux), chaque compte **signé** par qui et quand, les **notes de revue** du
  superviseur, et le **questionnaire de fin d'exercice**.
- **La méthode appartient au comptable.** Les cycles PROPOSENT un rattachement par préfixe,
  entièrement surchargeable ; le questionnaire part **vide** — les cinq questions les plus
  fréquentes du pilote ne sont pas connues, et les inventer serait écrire sa méthode à sa place.
- **Une feuille maîtresse ne lit que les validées** : on ne révise pas un brouillard, qui par
  définition n'est pas encore un fait. Les contrôles le nomment avant d'arrêter, sans bloquer.
- **Une question naît d'une LIGNE** — elle porte le compte, l'écriture et la pièce sur lesquels elle
  est née — part dans un `.skanask` signé et scellé comme le dossier de clôture, et **s'affiche chez
  le client en face de la pièce qu'elle vise**. C'est tout l'intérêt : une question rangée dans une
  liste que personne n'ouvre est une question perdue.
- **Les réponses reviennent dans le paquet suivant**, jamais dans un envoi à part qu'on oublierait.
  Elles ne touchent **aucun chiffre** : une question est une demande, pas une écriture.
- **Deux paquets sans réponse** et la question remonte dans « À faire » **des deux côtés**, avec le
  même seuil lu par les deux applications.
- Une question déjà partie se **ferme**, elle ne s'efface pas : le client l'a sous les yeux.
- `livre.json` gagne `questions[]` (liste ajoutée, donc compatible) et `revisions[]` reçoit enfin
  l'écrivain que la 9.9.0 lui avait réservé. La fusion de deux postes garde les deux.

16 défauts réintroduits un par un font tomber leur test — dont un qui a montré que mon assertion
lisait son propre commentaire (quatrième fois que ce piège revient).

## 9.9.1 — 21/09/2026

**Entretien.** Aucune fonction nouvelle — c'est la règle : une version sur quatre rembourse au lieu
d'ajouter, et elle est écrite d'avance précisément parce que c'est quand on est pressé qu'on la saute.

- **Le contrôle anti-écrasement de la 9.9.0 se paie sur l'ENTÊTE, pas sur le livre entier.** Mesuré :
  relire le livre coûte 90 à 160 ms sur 50 000 lignes, pour un geste dont le seuil est de 100 ms — le
  garde-fou aurait coûté plus cher que ce qu'il protège. L'entête est en clair : **0,1 ms**. Le livre
  ne se déchiffre que lorsqu'il y a vraiment conflit, c'est-à-dire presque jamais.
- **`npm run charge` mesurait un format que le livre n'utilise plus.** Il avait été écrit avant le
  format, sa mesure avait fait choisir le corps binaire, la 9.2.0 l'avait écrit — et personne n'était
  revenu mettre l'instrument à jour. Il annonçait donc « 174 ms pour un seuil de 100, le format doit
  changer avant d'être écrit » sur un format déjà changé, et pour cette raison même. Corrigé, avec un
  **cinquième seuil** : « enregistrer à trois postes » (contrôle de révision + écriture), écrit avant
  la mesure comme les quatre autres. Les cinq sont tenus : 166 / 85 / 822 / 707 / 65 ms.
- **`ecritPar` a été refusé dans l'entête en clair.** Techniquement pratique, mais le nom d'un
  collaborateur n'est pas l'identité du fichier : un livre égaré sur une clé USB n'a pas à nommer qui
  travaille dans le cabinet. Il reste dans le corps chiffré.
- **`CLAUDE.md` et le cahier relus** : la fusion n'est plus « à venir en 9.9.0 », le verrou n'est plus
  la protection principale, le Cabinet ne « ne tient pas encore de comptabilité », et les chiffres des
  instruments sont ceux d'aujourd'hui (2 107 boutons, 883 colonnes, 405 colonnes côté entreprise).
- `npm audit --omit=dev` : **0 faille** dans ce qui est livré. Electron 44, à jour.

## 9.9.0 — 21/09/2026

**Le cabinet à plusieurs.** Plusieurs collaborateurs sur un cabinet, sans que l'un efface le travail
de l'autre en silence. **À publier en bêta** : elle touche le moteur comptable et le format du livre.

- **Des collaborateurs, avec trois rôles qui se contiennent** — Saisie ⊂ Validation ⊂ Supervision.
  Une identité **déclarée**, pas un mot de passe par personne : celui du cabinet ouvre déjà toute la
  base, donc un second ne protégerait rien de plus, et l'écran le dit au lieu de faire croire le
  contraire. Ce que les rôles apportent, c'est de savoir **qui** a validé une écriture, et d'éviter
  qu'elle le soit par quelqu'un dont ce n'est pas le travail. Tant que personne n'est déclaré —
  c'est-à-dire chez tous les cabinets d'aujourd'hui — **rien n'est restreint et rien ne change à
  l'écran**.
- **Des droits par dossier**, qui l'emportent sur le rôle général dans les deux sens : quelqu'un qui
  valide partout peut n'être que saisisseur sur un client, et l'inverse. C'est aussi ce qui
  **confie** un dossier : le « À faire » d'une personne ne montre que les siens.
- **La piste d'audit porte QUI**, sur chaque geste, en plus du poste.
- **Deux postes ne s'écrasent plus.** Le livre porte une **révision** : on relit le disque avant
  d'écrire, et si elle a bougé on ne écrit rien — on **fusionne**. Trois règles qui ne bougent pas :
  une écriture validée ne se fusionne jamais et n'est jamais perdue ; un numéro déjà pris est
  signalé, jamais réattribué (un numéro naît à la validation, 9.2.0) ; un brouillard présent des
  deux côtés est gardé **deux fois** plutôt que tranché à la place de quelqu'un. Et « Réunir le
  livre d'un autre poste… » pour le cas où les deux ne se sont jamais vus (clé USB, réseau coupé).
- **Le verrou se lève.** `leverVerrou` n'avait aucun appelant : posé à chaque écriture et jamais
  levé, il interdisait à l'autre poste d'écrire pendant vingt-quatre heures après un seul
  enregistrement. Et un verrou orphelin se **reprend**, en nommant le poste et depuis quand.
- **Un tableau de production** : par client et par mois, reçu → saisi → révisé → déclaré, qui et
  depuis quand. Tout est **lu** (paquets, écritures, déclarations), jamais coché à la main. « Révisé »
  affiche « — » tant que le dossier de révision n'existe pas — ne pas savoir n'est pas « non » — et
  il ne bloque rien, sinon la grille entière s'afficherait rouge le jour de la livraison.
- Le parcours qui compte est **`npm run e2e:cabinet-equipe`** : deux postes du même cabinet, deux
  collaborateurs, et rien de perdu. C'est lui qui a trouvé que le premier superviseur déclaré
  fermait la porte derrière lui — le poste qui venait de le créer n'était personne, donc il ne
  pouvait plus ajouter le second.

Vingt-six défauts réintroduits un par un font tomber leur test.

## 9.8.8-beta.4 — 21/09/2026

**L'instrument ne regardait que quatre écrans sur onze.** Version d'essai, dans la continuité de la
9.8.8. Publiée en bêta parce qu'elle touche l'app du comptable, pas parce qu'elle touche un chiffre.

- **`e2e:cabinet-rendu` mesurait 4 des 11 écrans de comptabilité** (T-55), et c'est le défaut qui
  explique tous les autres. Trouvé en prouvant un correctif : le défaut de T-49 remis en place, le
  parcours est resté **vert**. Sept onglets sur onze — Saisie, Déclaration, Banque, Immobilisations,
  Inventaire, Exercice, Recherche — n'existent que si le dossier a un livre, et le parcours cliquait
  le premier dossier venu, qui n'en a pas. L'écran où un comptable passe ses journées n'avait jamais
  été mesuré une seule fois, et c'est pour ça que six constats terrain d'affilée ont été trouvés sur
  des captures. Le parcours crée maintenant le livre par le geste réel et **exige onze onglets**. De
  1 167 boutons et 728 écarts, il passe à **2 083 boutons et 1 059 écarts**.
- **La sonde d'espacement accusait du code juste** (T-49 bis) : la remontée d'un cran écrite pour
  T-49 comptait les ÉLÉMENTS d'un conteneur et ignorait son texte, donc « téléphone à renseigner »,
  posé au milieu de la ligne d'identité d'une fiche, s'est retrouvé jugé contre le nom du client —
  28 accusations sur un écart de 3 px écrit dans la feuille. Un conteneur qui porte du texte n'est
  pas un emballage, c'est une phrase, et les voisins d'un bouton posé dedans sont des mots.
- **Le bandeau du livre ouvert collait son bouton sous la case à cocher** (T-56), à zéro pixel :
  deux marges posées à la main décidaient l'écart horizontal et rien du vertical. C'est une rangée
  flex avec son `gap`, qui décide des deux.
- **Une bulle « i » collée à un bouton** (T-57), et une mention séparée du sien par une simple espace
  de gabarit (3,6 px). Les 2 px de l'annotation valent face à un libellé, qui ne se clique pas ; face
  à un bouton, ce sont deux cibles bord à bord.

Six défauts réintroduits un par un font tomber leur test, et le parcours attrape enfin le défaut de
T-49 qu'il ne pouvait pas voir.

## 9.8.8-beta.3 — 21/09/2026

**Les tests terrain reprennent sur la beta.2, et le premier constat tombe sur l'écran qu'on venait de
corriger.** Version d'essai, dans la continuité de la 9.8.8.

- **« Balance auxiliaire » ne faisait rien sur un dossier sans livre** (T-46) — c'est-à-dire sur tous
  les dossiers de l'exemple et la majorité d'un vrai portefeuille. Le redessin lisait l'ouverture
  d'un livre qui n'existe pas, plantait en silence, et l'écran restait celui d'avant le clic. Le
  moteur rend désormais une ouverture vide sans livre ; le test pur et le parcours réel cliquent le
  bouton sur un dossier lu dans ses paquets, exigent le tableau par tiers et le verdict de
  concordance avec la générale.
- **« Il manque 9 mois » sans livre, « 5 mois » avec, sur le même dossier** (T-47) : le compte sans
  livre réclamait le mois en cours et l'avenir. Une seule fonction (`moisManquants`) pour les deux
  états, qui s'arrête au mois dernier.
- **Le livre-journal renumérotait les écritures validées par date** (T-52) : une pièce de mars
  validée en septembre s'affichait « n° 1 » et poussait toutes les validées d'avant d'un cran — sur
  l'écran d'un comptable, le numéro vu la veille avait changé. Le moteur recomptait 1..n sur des
  lignes qui portaient pourtant chacune le numéro écrit à la validation (9.2.0). Les lignes du livre
  affichent désormais ce numéro-là, tel quel, et filtrer sur un journal ne fait plus repartir le
  compte à 1 ; un brouillard n'en a pas ; un paquet, lui, se recompte 1..n comme avant, parce que
  chez le client le numéro est déduit. Test pur prouvé par réintroduction, et le parcours
  `e2e:saisie` lit la colonne N° de l'écran pièce par pièce contre le livre sur le disque.
- **« Valider la seule de AC »** (T-53) : le bouton de lot de la grille de saisie nomme désormais ce
  qu'il valide et élide devant une voyelle — « Valider la seule pièce d'AC », « Valider les 3 pièces
  de VT ». Une seule fonction dans cabcore, testée, au lieu d'une phrase fabriquée dans le gabarit.
- **Une écriture sans libellé ne devient plus définitive** (T-51). La fenêtre disait « AC — » sur une
  pièce sans référence ni libellé, la validait, lui donnait un numéro : dans deux ans, rien n'aurait
  dit ce qu'elle enregistre. La validation exige un libellé — sur la pièce ou sur chaque ligne — et
  le brouillard continue d'accepter tout, puisque c'est sa raison d'être. Les deux boutons de la
  grille s'éteignent donc chacun sur son propre verdict, par la même fonction que celle qui
  refusera. La référence de pièce, elle, n'est pas exigée : la fenêtre écrit « sans référence » pour
  qu'on le voie, et laisse passer. Trouvé en corrigeant : un import définitif dont une pièce ne
  passait pas la validation la laissait en brouillard **en silence** — elle est maintenant nommée
  avec son motif dans le compte rendu.
- **Le raccourci de solde s'annonce dans la case d'où il part** (T-48) : « ⇥ 191,000 » apparaît dans
  la case Crédit de la dernière ligne dès que le geste est possible, et nomme la colonne quand le
  montant ira dans l'autre. La légende dit « Solder depuis la case Crédit ». Une seule fonction
  décide de la condition, et c'est elle que la touche appelle.
- **« + Ajouter une ligne » est remonté sous la grille** (T-49), avant la barre qui clôt la pièce :
  le geste qui allonge un tableau vit sous ce tableau. La sonde d'espacement a appris au passage
  qu'un bouton seul dans son conteneur n'a pas de frère, et que son voisin réel est celui du
  conteneur — un titre de section, le plus souvent.
- **Le brouillard et la recherche datent en français** (T-50) : ils affichaient « 2026-03-04 » sous
  une grille qui écrit « 04/03/2026 ». Un test interdit désormais toute cellule de tableau du
  Cabinet qui affiche une date au format interne.
- **« 1 écriture trouvée sur 49 »** (T-54) : le compteur de la recherche répétait le mot des deux
  côtés du « sur ».

## 9.8.8-beta.2 — 21/09/2026

**La bêta que le comptable ne voyait pas.** Skander, case « Recevoir les versions d'essai » cochée sur
SkanFact Cabinet 9.8.7, lisait « Aucune version publiée pour l'instant » pendant que la 9.8.8-beta.1
était en ligne avec ses seize fichiers. Cause, lue dans la source d'electron-updater et pas dans son
README (la cinquième fois) : son fournisseur GitHub ne connaît que **deux** canaux de préversion,
« alpha » et « beta », lus dans le tag de la release. Le canal `cabinet-beta` n'y trouve donc jamais
rien — et s'il trouvait, il irait chercher `beta-mac.yml`, l'index de l'app **entreprise**. Le chemin
GitHub, c'est celui que l'application prend dès que le relais a échoué une fois dans la session ; et
il avait échoué, soit pendant que l'index montait en ligne, soit parce que le relais déployé sur
Cloudflare est antérieur à la 9.1.0 et ne connaît pas encore le canal d'essai du Cabinet.

- **Le canal d'essai du Cabinet ne passe plus jamais par le fournisseur GitHub.** Le Cabinet lit la
  liste des releases, choisit lui-même celle qui porte son index (`releasePourIndex`, pur, la règle du
  relais : jamais un brouillon, jamais un index stable venu d'une préversion) et laisse le fournisseur
  générique lire cette page. Le canal stable ne change pas. Vérifié sur la vraie liste : la bêta
  pour `cabinet-beta-mac.yml`, la 9.8.7 pour `cabinet-mac.yml`.
- **Un clic sur « Vérifier maintenant » réessaie le relais**, dans les deux applications, même s'il a
  échoué plus tôt dans la session : la cause la plus fréquente d'un échec est un index qui finissait
  de monter, et c'est le moment où l'on clique. Les vérifications silencieuses gardent le chemin qui
  a répondu.
- Sur le canal d'essai, un index absent se dit « Aucune version d'essai publiée pour l'instant » en
  gris, comme dans l'app entreprise depuis la 7.25.0 — plus « une version vient d'être publiée ».
- Les en-têtes du relais ne partent plus vers GitHub après un repli (règle 8.0.0, jamais portée au
  Cabinet), et changer de canal ne double plus les écouteurs du module de mise à jour.
- **À faire sur Cloudflare** : redéployer `worker/skanfact-maj.mjs` (canal `cabinet-beta` depuis la
  9.1.0, `releaseAdmissible` depuis la 9.8.8-beta.1). Sans ça, le Cabinet reçoit sa bêta par GitHub en
  direct — ce qui marche désormais — mais pas par le relais.

Chemin direct en bêta : c'est une correction du mécanisme de mise à jour lui-même, et elle ne touche
aucun chiffre. 587 tests, 8 défauts réintroduits un par un font tomber leur test.

## 9.8.8-beta.1 — 21/09/2026

**Les quarante-deux constats du carnet de terrain (`TESTS-TERRAIN.md`), corrigés en une version — et
deux de plus, trouvés en les corrigeant.** Skander a joué le comptable pendant deux jours, écran par
écran, sur SkanFact Cabinet ; ce qu'il a vu est corrigé ici, avec un test par constat, prouvé en
réintroduisant le défaut. **Version d'essai** : plusieurs de ces corrections changent des chiffres
(l'écart de rapprochement, la balance auxiliaire, le total à décaisser, l'annulation d'un dépôt), et
la règle du projet veut que ce qui touche au moteur passe par la bêta (9.8.4). Elle devient la 9.8.8
stable quand les tests terrain reprennent et la confirment.

**Ce qui était FAUX** (et qu'aucune console ne montrait) :

- **Le journal de trésorerie partait vide dans chaque paquet** depuis la 6.1.0 : quatre colonnes
  réclamées par `cashCsvColumns` que `cashMovements` n'écrivait pas. Le contrat se vérifie clé par clé.
- **L'écart de suspens ne pouvait jamais atteindre zéro** : il ignorait le solde de départ du
  relevé. C'est maintenant un écart de rapprochement, avec ses deux termes affichés (solde du relevé,
  solde comptable à la date).
- **La balance auxiliaire était structurellement à zéro**, et contredisait la générale : elle
  sommait toutes les lignes d'une pièce qui portent un tiers, TVA et produit compris. Elle vit dans
  le moteur (`balanceAuxiliaireDepuisLignes`), ne compte que les lignes des comptes collectifs, et
  son total est confronté au solde du 411 de la générale.
- **« Total à décaisser » sautait l'IRPP** imprimé juste au-dessus, sans le dire. Chaque case dit
  maintenant si elle entre dans le total ; l'IRPP est hors total **et l'écran l'écrit**, avec un
  « À VÉRIFIER » — la règle n'est pas confirmée, on ne l'invente pas.
- **Le bilan nommait chaque rubrique par une écriture au hasard** ; il lit le plan.
- **Annuler « déposée » avant « payée » enfermait** dans un état sans issue ; annuler l'un annule
  l'autre.
- **Réimporter le même relevé reprochait les soldes** avant de dire qu'il était déjà là.
- **La balance générale annonçait trois paires de totaux et en montrait deux** ; les colonnes
  d'ouverture apparaissent dès qu'elles ne sont pas nulles.
- **Une sauvegarde du Cabinet n'emportait pas les livres** (T-35) — supprimer un dossier par erreur
  puis restaurer rendait ses mois, jamais ses écritures. Une sauvegarde nommée écrit un ZIP des livres
  à côté du JSON, la restauration les remet, la liste et la fenêtre de restauration disent lesquelles
  les portent (la quotidienne, non, et c'est écrit). **Trouvé en corrigeant** : changer le mot de passe
  ne rechiffrait pas les livres — tout le portefeuille devenait « illisible » au démarrage suivant
  (T-43) ; et la reprise sur un poste neuf ne rapportait jamais les livres de la copie externe (T-44).
- **Les neuf boutons « Annuler » du Cabinet étaient inertes** : posés avec `data-close`, lus sous
  `dismiss`.

**Ce qui ne RÉPONDAIT pas ou ne se comprenait pas** : le lettrage nomme des pièces sans en ouvrir
aucune (chaque ligne ouvre la sienne ; « En face » dit la ligne et l'ouvre) ; les contrôles de
clôture étaient lus une fois et ne se rafraîchissaient jamais ; le motif de réouverture disparaissait
à la seconde où il était donné ; le dossier de clôture ne laissait aucune trace (il est tracé dans
le livre, `exercice.dossiersProduits`, et s'ouvre depuis l'onglet Exercice) ; la grille de saisie
changeait de séparateur décimal dès qu'on tapait ; « Valider par lot » ne pouvait rien valider de ce
qui était affiché (les lots se déduisent du brouillard) ; aucun bouton « Ajouter une ligne » ; la
liste des comptes coupée par le cadre du tableau ; « Contre-passation — » écrite par le moteur et
jamais affichée (le miroir est marqué dans le journal et le grand livre) ; « Regrouper tous les
clients… » quittait le dossier sans rien regrouper ; « Abonnements » affiché sous les onze onglets ;
le solde de départ d'un relevé proposé à 0 quand le livre connaît la réponse ; les pastilles d'onglet
qui voulaient dire trois choses ; les avertissements de clôture noyés dans un pavé ; « D'où ça
vient » qui ouvrait un panneau à aller chercher ; le rafraîchissement de l'exemple qui détruisait le
livre sans le dire ; « Équilibrée » sur une balance auxiliaire vide ; les pluriels « 5 ligne
ouvertes » et « 1 pièce(s) » ; l'avertissement « livre incomplet » qui disparaissait quand le livre
était créé.

**Décidé, et écrit dans le carnet** : le tiers reste posé sur chaque ligne d'une pièce (c'est une
information sur la ligne de TVA aussi) — ce qui était faux, c'est de le sommer hors des comptes
collectifs. `livre.json` gagne la LISTE `exercice.dossiersProduits` : une liste ajoutée est
compatible, un champ renommé ne l'est pas (9.7.0).

**La publication, corrigée le jour même.** La première construction de cette bêta est partie avec
`latest.yml` pour l'app entreprise au lieu de `beta.yml` : electron-builder ne déduit pas le canal du
numéro de version, il faut le lui nommer — et le relais servait donc la bêta aux installations
stables. Le workflow nomme le canal, retire tout index du mauvais canal et vérifie la page (job
`verifier`) ; le relais refuse un index stable venu d'une préversion (`releaseAdmissible`, à
redéployer sur Cloudflare). Une installation stable qui aurait pris la bêta entre-temps revient
d'elle-même sur la 9.8.7 (le seul retour en arrière autorisé, 7.25.0).

586 tests, 0 erreur de lint, 36 défauts réintroduits un par un font tomber leur test.

## 9.8.7 — 18/09/2026

**Deux défauts trouvés en testant le Cabinet écran par écran, et les deux sont des trous de la
9.8.5 elle-même.**

**La colonne « Intitulé » n'a jamais porté le nom du compte.** Le grand livre, la balance générale
et l'export CSV passaient `(c, t) => t || ''` au moteur : ils affichaient le **tiers**. Tant que
T-13 fabriquait un tiers en découpant le libellé, quelque chose s'affichait — « Agence Immobilière
Le Lac » en face du 606, faux mais visible. La 9.8.5 a rendu au tiers son honnêteté, et la colonne
s'est vidée : **corriger la donnée ne corrige pas l'écran qui ne l'a jamais lue.** Sur une balance
générale, « Intitulé » désigne le nom du compte — c'est la définition du document ; le tiers a son
écran à lui, la balance auxiliaire, qui le montre en première colonne. Un résolveur unique
(`nomDeCompte`) lit le plan du livre, retombe sur le plan comptable de référence, puis sur le tiers.
La balance auxiliaire garde le sien, et c'est l'exception **nommée** dans le test : elle échange
`account` et `tiers` avant d'appeler.

**Le livre survivait à la suppression de son dossier : le correctif de la 9.8.5 n'a jamais tourné.**
`removeDossierFiles` mélangeait deux conventions d'argument — la moitié des paquets construit son
index elle-même et attend un **tableau**, la ligne ajoutée pour les livres passait ce tableau à
`livreDir`, qui attend l'**index**. `folderName` y fait `collisions.has(...)` : sur un tableau ça
lève, le `catch` l'avalait, et le dossier des livres n'était jamais effacé. Aucun écran, aucun
message — une ligne dans `main.log`. Le défaut du « livre orphelin » que la 9.8.5 annonce corriger
était donc intact : l'exemple se rechargeait avec des paquets neufs et le livre de la version
d'avant. L'index se construit maintenant **une fois**, en tête, et sert aux deux moitiés ; un échec
d'effacement ne fait toujours pas échouer l'appelant, mais il est **rendu** au lieu de disparaître.

**Et la leçon de méthode, la plus chère.** Mon test appelait `removeDossierFiles(dossier, idx)` —
avec un index. Le seul appelant, lui, passe `state.dossiers`, un tableau. J'avais rencontré
`collisions.has is not a function` en écrivant ce test, et je l'ai « corrigé » en changeant **le
test**. Il prouvait donc que ma ligne marche quand on l'appelle comme elle veut être appelée :
**un test qui appelle une fonction autrement que son unique appelant ne prouve rien de
l'application.** Il passe désormais le tableau.

559 tests, 0 erreur de lint, cinq défauts réintroduits un par un font tomber leur test.

## 9.8.6 — 18/09/2026

**L'app du comptable ne se construisait plus.** La 9.8.5 est complète et verte ; c'est sa
publication qui a échoué, du côté du Cabinet seulement, deux secondes après le début de l'étape.

La 9.8.4 avait ajouté à cette étape le même drapeau de type de release que l'étape de l'app
entreprise, « parce que deux étapes qui peuvent se contredire finissent toujours par se
contredire ». La raison était bonne, le geste non : l'étape du Cabinet passe un fichier de
configuration (`-c build/cabinet.config.js`), et `-c.publish.releaseType=…` vise **la même option**.
Le second gagne, et electron-builder est parti chercher un fichier de configuration nommé
`.publish.releaseType=release` — qui n'existe pas. L'étape de l'app entreprise n'a pas ce problème
parce qu'elle ne passe aucun fichier. Rien dans le nom des deux drapeaux ne laisse deviner qu'ils se
disputent quoi que ce soit, et **la 9.8.4 n'a jamais été publiée** : personne ne l'avait exercé.

Ce qui change :

- Le type de release du Cabinet se déduit du **numéro de version**, dans `build/cabinet.config.js`,
  à côté de son canal et pour la même raison (7.25.0 : une seule source de vérité). Il y était écrit
  `'release'` en dur : sur une bêta, l'étape aurait demandé une release pleine — sans conséquence
  tant que le job `preparer` crée la page (9.8.1), et faux le jour où ce ne serait plus lui.
- L'étape ne porte plus aucun `-c.…`.
- **Le garde-fou qui manquait** : aucune commande `electron-builder` ne peut porter à la fois
  `-c <fichier>` et `-c.<clé>=<valeur>`. C'est lui qui aurait arrêté la 9.8.5 avant de brûler une
  publication.

Et une assertion retournée, quatorzième occurrence du motif : celle de la 9.8.4 exigeait **deux**
occurrences du drapeau dans le workflow. Elle décrivait le geste, pas la règle — la règle est que le
type de release de **chacune** des deux applications se déduit du numéro de version ; par quel
chemin ne regarde que le chemin.

Aucune ligne des deux applications ne change. 558 tests, 0 erreur de lint, trois défauts
réintroduits un par un font tomber leur test.

## 9.8.5 — 18/09/2026

**Un compte porte un nom de compte, et un tiers porte le nom du tiers.**

Trouvé sur le terrain, en testant l'app Cabinet écran par écran avec Skander dans le rôle d'un
comptable. Le CSV d'un paquet porte **deux colonnes distinctes** — « Tiers » (qui) et « Libellé »
(quoi). Depuis la 9.2.0, le livre du dossier ne gardait que la seconde : la forme d'une ligne
n'avait pas de case pour le tiers. `lignesDuLivre` en inventait donc un à partir du libellé, et
`assurerCompte` nommait chaque compte d'après la première écriture qui le touchait.

Une seule ligne de code, **six écrans faux** :

- le **lettrage** groupait par FACTURE et non par client — une facture et son règlement, qui n'ont
  jamais le même libellé, devenaient deux « tiers » différents, et leur lettrage parfaitement juste
  était dénoncé comme faux. Seize alertes orange sur du travail correct ;
- la **balance âgée** rendait une ligne par facture sous une colonne « Tiers », et son pied comptait
  « 5 tiers » là où il y avait 5 factures ;
- la **balance auxiliaire** prenait le libellé comme numéro de compte ;
- le **bilan** et l'**état de résultat** étiquetaient chaque rubrique du nom d'une opération :
  le chiffre d'affaires de l'exercice s'appelait « Facture FAC-2026-014 — Clinique Les Jasmins » ;
- le **grand livre** montrait le plan comptable entier ainsi nommé — 401 « Achat LOC-2026-08 »,
  532 « Paiement salaire Ahmed Ben Salah mai 2026 » ;
- et la **saisie**, où c'était le pire : le sélecteur de compte **recopiait** ce nom dans le libellé
  de la ligne. Une facture de papeterie partait avec trois lignes « Achat LOC-2026-08 — Agence
  Immobilière Le Lac », validées, numérotées, définitives.

Ce qui change :

- **`tiers` entre dans la forme d'une ligne de `livre.json`.** C'est une décision de format, et le
  test du format tombe pour le dire (règle 9.7.0). Le test couvre désormais la forme d'une LIGNE,
  pas seulement le socle du livre : c'est par ce trou-là que le défaut est passé.
- **`PLAN_COMPTABLE` déménage de core.js vers compta.js**, et core.js le réexporte (un test compare
  les deux par identité d'objet). Le Cabinet ne charge pas core.js et avait besoin de NOMMER un
  compte — la règle de découpage de la 9.1.0 le veut là.
- **`assurerCompte` nomme par le plan** ; le libellé reçu n'est plus qu'un repli pour un numéro que
  le plan ne connaît pas.
- **`migrerLivre`** rend leurs noms aux comptes d'un livre écrit avant, pose la case `tiers` à vide,
  et ne touche à aucun chiffre. Posée à la LECTURE : un livre qu'on n'ouvre jamais n'est jamais
  réécrit pour rien. Elle ne renomme **jamais** un compte que le cabinet a nommé lui-même.
- **Les livres d'un dossier partent avec le dossier.** Un livre orphelin restait sur le disque et se
  rattachait au dossier suivant portant le même identifiant — ce qui arrivait au jeu d'exemple, dont
  les identifiants sont stables.

**Limite à connaître** : les lignes déjà écrites gardent une case `tiers` vide jusqu'à ce que leurs
paquets soient relus (« Relire les paquets reçus »). « (sans tiers) » est honnête ; un nom de tiers
recopié du libellé ne l'était pas. Et les écritures **validées** déjà parties avec un libellé faux ne
sont pas réécrites : une validée ne se modifie jamais, elle se contre-passe.

**Pourquoi en stable et pas en bêta** : la règle veut la bêta pour ce qui touche au moteur comptable
ou au format d'un fichier, et c'est le cas ici. Skander teste l'application en ce moment même et a
demandé la stable pour pouvoir continuer sur une version corrigée. L'ajout d'un champ à un format
est compatible (règle 9.7.0), la migration est pure et idempotente, et sept défauts réintroduits un
par un font tomber leur test.

## 9.8.4 — 18/09/2026

**Une version d'essai construit désormais les DEUX applications.**

Skander : « au lieu de faire sur ta branche et publier, pourquoi pas faire le bon workflow, c'est-à-dire
sur la bêta ? » C'était déjà sa décision en 7.25.0 : `main` reste la stable, `beta` est la branche de
travail, et rien ne part chez personne avant qu'il ait confirmé. Mais une ligne du workflow rendait ce
chemin **inapplicable à SkanFact Cabinet** — c'est-à-dire à la seule application sur laquelle on
travaille, et celle que le cabinet pilote est en train d'essayer.

Cette ligne sautait la construction du Cabinet sur une préversion. Sa raison, écrite juste au-dessus :
les comptables « n'ont aucune case à décocher », et une bêta « remplacerait `cabinet.yml` ». **Les deux
moitiés sont fausses depuis la 9.1.0**, qui a donné au Cabinet son canal d'essai `cabinet-beta` ET sa
case « Recevoir les versions d'essai ». Le garde-fou ne protégeait donc plus rien ; il empêchait
seulement de faire tester quoi que ce soit au comptable.

Quatre pièces sur cinq étaient déjà là — la config, le canal lu par l'application, la case de l'écran,
et le relais qui laisse passer `cabinet-beta*.yml`. Seule la cinquième bloquait.

Ce qui change, et rien d'autre :

- Une préversion construit et publie **les deux applications**, chacune sur son canal d'essai. Ce qui
  protège les cabinets n'est pas de sauter l'étape, c'est le canal : `9.9.0-beta.1` écrit
  `cabinet-beta.yml` et ne touche jamais `cabinet.yml`.
- Les deux étapes de publication portent le **même** drapeau de préversion. Deux étapes qui peuvent se
  contredire finissent toujours par se contredire.
- La cloison entre canaux est vérifiée dans les **deux** sens : jusqu'ici une même release ne pouvait
  pas porter `beta.yml` et `cabinet-beta.yml`, maintenant si — et servir l'un à l'autre proposerait
  d'installer le mauvais logiciel.

Aucune ligne des deux applications ne change. 553 tests, lint 0 erreur ; quatre défauts réintroduits un
par un font tomber leur test, dont deux sur des assertions écrites en 9.1.0 qui couvraient déjà le
mécanisme — seul le workflow n'était pas tenu contre la vraie règle.

## 9.8.3 — 18/09/2026

**Les boutons collés au contenu, et la sonde qui les voit.**

Signalé par Skander : « sur l'app cabinet y'a plein de boutons qui sont mal espacés et collés au
contenu ». Il avait raison, et la cause est mesurable : les trois sondes de rendu du projet mesurent
un bouton **tout seul** — sa couleur, son débordement, l'alignement de sa colonne — et **aucune** ne
mesure sa distance à ce qui l'entoure. Or un bouton collé au titre du dessus est parfaitement
lisible, parfaitement dans la fenêtre, et parfaitement moche. C'est une propriété de la RELATION
entre deux éléments ; il fallait la mesurer comme telle.

**Une quatrième sonde**, dans `harnais.js` avec les trois autres et partagée par les deux
applications : pour chaque bouton visible, l'écart réel avec son voisin de gauche et de droite,
horizontal s'ils sont sur la même rangée, vertical s'ils sont empilés. **1 678 écarts mesurés**, en
clair et en sombre, à 1440 et à 1280.

Ce qu'elle a trouvé, et qui est corrigé :

- **Le retour « ← Dossiers » collé au nom du client** — zéro pixel, sur les vingt-huit écrans d'une
  fiche. Le bouton a deux placements et un seul avait son espacement : dans l'app entreprise il vit
  dans une barre `.actions` qui porte son `gap`, dans le Cabinet il est posé seul au-dessus du
  titre. La règle vise donc le placement autonome, jamais le bouton en soi.
- **« Voir 4 autres lignes » collé à la liste** qu'il prolonge : un geste collé à ce qu'il prolonge
  se lit comme une ligne de plus, pas comme un bouton.
- **Deux bulles « i » collées** sur un même titre — deux explications, deux cibles, qui se lisaient
  comme un seul objet.
- **« PDF » et « Modifier »** dans la page Paie : 3,6 px, c'est-à-dire la largeur d'une espace entre
  deux balises du gabarit. La parade de la 7.29.0 existait mais ne visait que `td.actions` ; un
  correctif qui dépend d'une classe qu'on pense à mettre n'est pas un correctif. Il vise maintenant
  toute cellule, et nomme les deux grappes qui décident de leur propre densité.
- **Les pictogrammes ↑ ↓ ⧉ ✕ de l'éditeur** : leur densité venait elle aussi d'une espace du
  gabarit, c'est-à-dire de rien. Elle est désormais décidée.

Et un défaut que l'instrument a trouvé au passage, sans rapport avec l'espacement : sur l'onglet
**Exercice** livré la veille, le bilan actif et le bilan passif sont deux tableaux côte à côte dans
un `.split`, **sans leur `.scroll-x`** — exactement le défaut corrigé en 3.4.0 sur la fiche
d'affaire. Les trois tableaux des états financiers l'ont maintenant.

Aucune fonction nouvelle : uniquement de l'espacement, et l'instrument qui empêche qu'il se reperde.

## 9.8.2 — 17/09/2026

**Soixante secondes de silence tuaient l'envoi d'un fichier de 220 Mo.**

La 9.8.1 a réglé la course qui faisait échouer la publication, et la suivante a échoué autrement : le
poste macOS a envoyé son `.dmg` sans problème, puis son `.zip` — de taille identique — a **expiré**.
Avec lui sont tombés les quatre fichiers du Cabinet macOS qui devaient suivre, dont `cabinet-mac.yml`.
Résultat visible chez l'utilisateur : le Cabinet sur Mac ne trouvait plus son fichier d'index et ne
pouvait plus se mettre à jour.

La cause est dans `electron-publish` : son délai d'attente par défaut est de **soixante secondes**, et
c'est un délai d'**inactivité du socket** (`socket.setTimeout`), pas une durée totale de transfert.
Une minute sans un seul octet suffit donc à tuer l'envoi — et un fichier de 220 Mo vers GitHub
s'arrête régulièrement plus longtemps que ça pendant que le serveur digère ce qu'il vient de recevoir.

Le délai passe à **dix minutes**, dans les deux configurations de construction (`package.json` pour
l'application entreprise, `build/cabinet.config.js` pour le Cabinet). Comme le compteur ne court que
sur un **silence**, un transfert qui avance n'est jamais interrompu ; seule une connexion vraiment
morte est rendue, et elle l'est toujours.

Ce qu'on retient : **une valeur par défaut qu'on n'a pas lue est une décision qu'on n'a pas prise.**
Soixante secondes est un réglage raisonnable pour une requête d'API ; appliqué au téléversement d'un
installateur, c'est une panne qui attend son jour. Et le jour où elle arrive, ce n'est pas le gros
fichier qui échoue — c'est le suivant.

Aucune ligne de l'application n'a changé.

## 9.8.1 — 17/09/2026

**La publication elle-même : la course qui a fait échouer la 9.8.0.**

La 9.8.0 est complète et verte ; c'est sa **publication** qui a échoué, et l'application n'y est
pour rien. Le workflow construisait Mac et Windows en parallèle, et **chacun des deux postes créait
la page de la release**. Les deux ont demandé la liste des releases au même instant, n'ont rien
trouvé tous les deux, ont créé tous les deux — et le second a reçu `422 already_exists`.
electron-builder rattrape ce refus quand il envoie un *fichier*, mais pas quand il crée la
*release* : le poste Windows est tombé, et comme rien ne disait le contraire, le poste macOS — déjà
bien avancé, et le plus cher des deux — a été annulé avec lui. La release `v9.8.0` est restée avec
un seul fichier sur huit.

Ce que la 9.8.1 change, dans `.github/workflows/release.yml` :

- **La page de la release est créée une seule fois**, dans un job qui passe avant les constructions.
  Quand les deux postes démarrent, elle existe : ils ne font plus qu'y déposer leurs fichiers. La
  course n'existe plus, et une reprise après échec ne détruit rien (la release existante est
  reconnue, son titre et ses notes remis, ses fichiers conservés).
- **Un échec sur un poste n'annule plus l'autre** (`fail-fast: false`). Savoir si une panne touche un
  seul poste ou les deux est en plus ce qui désigne la cause.
- **Le tag pointe enfin sur le commit construit** (`--target`). Sans ce drapeau, GitHub posait le tag
  sur la branche par défaut du dépôt : `v9.6.0` et `v9.8.0` désignent tous les deux un commit de la
  9.4.1. Les installateurs publiés étaient justes — c'est `git checkout v9.8.0` qui ne rendait pas
  la source publiée.
- **Le titre et les notes sont posés dès la première seconde**, au lieu d'apparaître après le premier
  fichier envoyé. Entre les deux, la page n'affichait que le numéro de version.
- **`EP_GH_IGNORE_TIME`** : electron-builder refuse de déposer dans une release publiée il y a plus
  de deux heures — et il le fait en écrivant « skipped publishing » puis **en sortant vert**. Le job
  réussit, la release reste vide, et personne ne le voit. C'est le pire des échecs : celui qui se
  présente comme un succès.

Aucune ligne de l'application n'a changé. Le numéro passe quand même, parce que le numéro est ce qui
dit lequel des deux paquets est celui qu'on a pu installer.

## 9.8.0 — 17/09/2026

**La clôture d'exercice, et le flux retour vers le client.**

Sans ce flux, le bilan du cabinet et celui du client divergent pour toujours — et personne ne s'en
aperçoit avant le contrôle. C'est le jumeau du test de parité, dans l'autre sens.

Côté **Cabinet** :

- **Six contrôles avant clôture**, qui **nomment sans jamais bloquer** : brouillard restant, compte
  d'attente, déclarations de TVA manquantes, tiers au solde inversé, dotations non passées,
  équilibre de la balance. Chacun dit un **geste**, pas un constat.
- **La clôture est définitive et tracée** ; elle dit combien de pièces sont restées en brouillard
  plutôt que de les avaler. **Une réouverture exige un motif** d'au moins cinq caractères — c'est la
  seule trace qui expliquera, dans six mois, pourquoi un chiffre a changé après l'envoi.
- **Les à-nouveaux**, calculés sur les écritures **réelles** de l'exercice et son ouverture — jamais
  sur les à-nouveaux précédents, ce qui compterait le passé deux fois. Les comptes de bilan se
  reportent, le net des comptes de gestion va au résultat : une perte au débit, un bénéfice au crédit.
- **L'exercice suivant s'ouvre pendant que celui-ci se termine** : les à-nouveaux s'y posent en
  brouillard et se **refont** tant qu'ils ne sont pas validés. Les refaire ne double rien, et les
  extournes déjà validées ne repartent pas.
- **Les extournes** : une écriture d'inventaire marquée « s'extourne » repart en miroir au 1er
  janvier. L'originale, elle, **reste dans son exercice avec son numéro** — une extourne n'est pas
  une contre-passation. Une provision, elle, ne s'extourne pas : elle se reprend.
- **Les états financiers** déduits de la balance, les **soldes intermédiaires** (chacun avec **sa
  formule** à côté de lui) et trois **ratios** — dont un dénominateur nul affiche « — », jamais 0 %.
  L'écran écrit en toutes lettres que **ce n'est pas la liasse NCT 01**.
- **Le fichier `.skanclose`** pour le client : à-nouveaux officiels, écritures d'inventaire, états en
  **HTML et PDF** (lisibles par n'importe qui, même par un client qui ne met jamais son application
  à jour), manifeste et **signature du cabinet**. Scellé par un mot de passe si on veut.

Côté **entreprise** :

- **Importer le dossier de clôture** : l'application montre ce qui va changer **avant** d'écrire,
  vérifie la **signature** du cabinet et le **dit** quand elle manque, refuse un fichier
  déséquilibré en nommant les deux totaux, refuse le matricule d'une autre entreprise, et dit
  « mets l'application à jour » quand le format vient d'une version plus récente.
- L'exercice est **verrouillé** — sauf s'il n'est pas encore terminé sur ce poste, auquel cas la
  ligne le dit et explique pourquoi le verrou attend.

**Ce que le parcours réel a trouvé, et qu'aucun test pur ne pouvait voir** : `zipRead` rend le
contenu d'un fichier en **fonction paresseuse**, et mon handler d'import rangeait la fonction au
lieu des octets. Et le verrou : le jeu d'exemple porte l'exercice **en cours**, donc sa fin est dans
le futur — or on ne verrouille pas une période qui n'est pas terminée. Avaler ce refus en silence
aurait laissé croire que l'exercice était verrouillé alors qu'il ne l'était pas.

**Ce qui n'y est pas** : la liasse fiscale. Ces états sont déduits de la balance, et la page l'écrit.

## 9.7.0 — 17/09/2026

**Les immobilisations et l'inventaire, côté cabinet.**

Pour un client qui n'a pas SkanFact — c'est-à-dire le dossier payant — personne ne calcule son plan
d'amortissement. C'est ce que cette version livre, avec le **même moteur** que l'app entreprise :
recopier le calcul aurait donné deux tableaux d'amortissement pour un seul bien, et aucun moyen de
savoir lequel croire.

- **Les fiches de biens du dossier**, au modèle de l'app entreprise. Un test compare les deux :
  le même bien doit donner la même dotation et la même VNC, exercice par exercice.
- **Amortissement dégressif**, au taux **saisi sur la fiche**. Aucun coefficient n'est écrit dans le
  code : il dépend de la durée et du régime, personne ne l'a confirmé, et une table de coefficients
  serait une règle de droit offerte sans validation. Un dégressif sans taux est **refusé**, en
  nommant le taux.
- **La bascule au linéaire** existe, et elle est **décochée par défaut** — l'usage d'ici n'est pas
  établi. C'est une case, pas une version.
- **Cessions et mises au rebut** : la sortie d'actif reprend l'amortissement **en entier** et ne
  laisse aucune VNC derrière elle. Le **prix n'est jamais inventé** : il arrive par la facture de
  vente ou par le relevé bancaire.
- **Subventions d'investissement** : la reprise suit le rythme de l'amortissement du bien financé.
  Calcul, pas règle fiscale — et l'écran le dit.
- **Une acquisition venue d'un paquet remonte sans fiche**, avec le bouton qui la crée préremplie.
  Jamais d'office : une durée d'amortissement est une décision, pas une donnée lue dans un fichier.
- **Les dotations passent en écritures d'inventaire**, une pièce par bien, au dernier jour de
  l'exercice, **en brouillard**. Chaque ligne de plan retient l'écriture qui la porte : le bouton
  s'éteint, et la dotation ne peut pas être comptée deux fois.
- **Une dotation déjà écrite ne se recalcule jamais en silence** : modifier la valeur ou la durée
  d'un bien dont la dotation est passée est refusé, en nommant le geste (contre-passer d'abord).
  Renommer le bien, lui, passe : ça n'a jamais rendu une écriture fausse.
- **L'inventaire de stock de fin d'exercice** se colle depuis un tableur (référence, désignation,
  quantité, coût). La **variation** devient une écriture dans le bon sens, et une variation **nulle**
  ne produit rien du tout — une pièce à zéro dans un journal n'apprend rien.
- `livre.json` gagne une quatrième liste, `inventaires[]`. Absente d'un livre écrit avant, elle vaut
  `[]` : aucun lecteur ancien ne s'en plaint.

**Ce qui n'est PAS livré, et pourquoi** : l'amortissement **dérogatoire**. Le format du livre ne lui
réserve rien et personne ne l'a demandé — une case posée « au cas où » serait une règle fiscale
offerte sans validation. Et l'**inventaire permanent** côté cabinet : il attend qu'un cabinet le
demande ; un dossier SkanFact tient déjà son stock depuis la 4.0.0.

## 9.6.1 — 17/09/2026

**Entretien. Aucune fonction nouvelle, par règle.**

- **Le moteur d'écritures a fini de déménager.** Le constructeur de pièce équilibrée (`entrySet`)
  et tout le moteur d'amortissement — familles de biens, base 360, plan, cumul, VNC, cession —
  vivaient encore dans `core.js`. Aucun ne prend `data` : ils prennent une pièce ou un bien, donc
  ils relèvent de `compta.js` selon la règle de découpage posée en 9.1.0. `core.js` les réexporte à
  l'identique, et un test vérifie que ce sont les **mêmes fonctions**, pas des copies.
- **Conséquence directe, et c'est la raison de ce déménagement** : le Cabinet, qui ne charge pas
  `core.js` et ne doit jamais le charger, sait désormais amortir. C'est ce dont la 9.7.0 a besoin
  pour les dossiers hors SkanFact.
- **Une cinquième suite de tests** sort du lanceur (`test/suites/moteur.js`).
- **Electron reste en 44.4.1** : c'est la dernière version publiée, rien à faire.

**Ce qui a été trouvé en écrivant les tests** : mon test de l'absorbeur d'arrondis prenait un bien
de 3 600 DT sur cinq ans — 720 DT pile. Retirer l'absorbeur ne faisait donc rien tomber : le test
ne pouvait pas échouer, et je ne l'ai su qu'en essayant. Un montant qui se divise sans reste ne
prouve rien d'un arrondi. Refait sur 1 000 DT en trois ans, où la dernière annuité doit porter le
millime manquant.

**Ce qui n'est PAS livré, et pourquoi** : le découpage de `src/renderer/app.js` par route
(F-9.4.10-03), reporté une première fois. Il est **refusé**, avec sa raison, plutôt que reporté une
troisième : ce fichier est une seule fermeture de 12 800 lignes, et le découper demanderait soit des
variables globales — que le lint existe précisément pour interdire — soit un objet de contexte
passé à travers tout le fichier. Le bénéfice serait la taille du fichier ; le risque, les 48
parcours. La dette réellement constatée n'est pas la taille du fichier mais les **tranches de
source qui se périment** dans les tests, et celle-là se rembourse en découpant le lanceur de tests,
ce que cette version continue de faire.

## 9.6.0 — 17/09/2026

**La déclaration du mois : les chiffres à recopier, et rien de plus.**

SkanFact **ne dépose rien** et ne se connecte à aucune administration. Ce que fait cette version,
c'est préparer les chiffres que le comptable recopie sur le portail — et les rendre vérifiables.

- **Chaque case se déduit des écritures validées**, jamais saisie : un chiffre saisi à côté d'un
  livre finit toujours par le contredire. TVA collectée, déductible, crédit reporté, net à payer,
  crédit à reporter, droit de timbre, retenues opérées et subies, IRPP, total à décaisser.
- **Chaque chiffre s'ouvre sur les pièces qui le font.** Un chiffre qu'on ne peut pas ouvrir se
  croit ou ne se croit pas ; un chiffre qui montre ses écritures se vérifie.
- **Une case dont la règle n'est pas connue vaut « — », jamais « 0,000 ».** TFP, FOPROLOS, TCL et
  acomptes provisionnels : leur assiette et leur taux ne sont pas établis, et un zéro se recopierait
  sur un formulaire fiscal. Chacune dit pourquoi elle est vide, avec son **À VÉRIFIER**. Le jour où
  le plan du dossier porte un compte pour l'une d'elles, elle se calcule.
- **Le crédit reporté se lit sur le compte**, jamais dans un champ : une déclaration isolée qui
  l'ignore donne un net faux.
- **Trois contrôles avant dépôt**, qui nomment sans jamais bloquer : les pièces encore en brouillard
  (elles n'entrent dans aucun chiffre), le compte d'attente non soldé, et la TVA du mois pas encore
  soldée par son écriture.
- **L'écriture du mois** (TVA collectée / déductible → à décaisser, timbre et retenues compris)
  arrive au dernier jour du mois et **en brouillard** : c'est le comptable qui la valide. Elle ne
  crédite du compte de TVA déductible que ce qui est **utilisé** — le reste est le crédit à
  reporter, et il doit rester.
- **L'état d'un mois** : reçu → saisi → déclaré → payé. Les deux derniers sont des pense-bêtes, et
  ils se **dé-pointent** ; on ne peut pas payer ce qu'on n'a pas déposé, et l'écran le dit.
- **Le détail par taux ne s'invente pas** : il demande un sous-compte de TVA collectée par taux.
  Quand le dossier n'en a qu'un, le total reste juste et l'écran explique pourquoi il n'y a pas de
  répartition, au lieu d'un tableau à une ligne qui laisserait croire que tout est à 19 %.

Ce qui **n'y est pas** : le calendrier fiscal par régime. Les régimes à distinguer et les échéances
de chacun dépendent de réponses que le cabinet pilote n'a pas encore données, et les inventer
reviendrait à écrire du droit que personne n'a confirmé.

## 9.5.0 — 17/09/2026

**La banque : le relevé entre, et le rapprochement propose sans jamais trancher tout seul.**

Le comptable importe le relevé tel que sa banque l'exporte, et l'application confronte chaque ligne
au compte 532. Ce qu'elle pose d'elle-même, elle en est sûre ; tout le reste, elle le montre.

- **Un relevé s'importe par le NOM de ses colonnes**, jamais par leur position. Montant signé ou
  colonnes Débit/Crédit séparées, dates françaises ou ISO, espaces des milliers : les trois formes
  passent. Et quand une banque écrit des en-têtes qu'on ne reconnaît pas, l'écran le **dit**, montre
  ses colonnes, et tu les associes une fois — l'association est retenue pour cette banque-là. Sans
  ça, chaque nouvelle banque aurait été une nouvelle version du logiciel.
- **Un relevé qui ne se boucle pas est refusé, avec l'écart en toutes lettres.** Solde de début, plus
  les mouvements, égale solde de fin : sinon il manque des lignes, et un rapprochement à moitié ne
  s'explique plus trois mois après.
- **Le même fichier ne s'importe jamais deux fois** — l'empreinte des octets le dit, et la date du
  premier import avec.
- **Quatre états, et un seul se pose d'office.** *Rapproché* quand une écriture, et une seule,
  convient. *Probable* quand plusieurs conviennent mais que le libellé en désigne une. *À confirmer*
  quand rien ne les départage. *Sans réponse* quand le livre ne porte rien en face. **Une ambiguïté
  n'est jamais « rapproché »** : un rapprochement faux est pire qu'un rapprochement absent, parce
  qu'il ferme la question. Et même « rapproché » se défait d'un clic.
- **Les suspens, des deux côtés** : ce que la banque porte et que le livre n'a pas, et l'inverse. Un
  chèque émis fin mars encaissé en avril vit là — ce n'est pas une erreur, c'est ce qui explique
  l'écart.
- **L'écriture qui manque s'écrit depuis la ligne**, préremplie, en brouillard, jamais enregistrée
  sans un clic. Quand aucune règle ne reconnaît le libellé, **la contrepartie reste vide** : verser
  d'office au 471 rangerait le doute dans un compte que personne ne solde. Le compte choisi est
  retenu, et le relevé suivant le proposera tout seul.
- **Le lettrage reste un AUTRE écran** — le relevé contre la banque d'un côté, la facture contre son
  règlement de l'autre. Il gagne le lettrage automatique (seulement ce qui se solde exactement et
  sans ambiguïté ; un règlement partiel reste ouvert, c'est le but) et **la balance âgée** : ce qui
  reste dû, rangé par ancienneté, la liste d'appels du lundi matin.

Ce qui **n'y est pas**, et pourquoi : aucun format propriétaire (OFX, MT940). Ils n'arriveront que
si une banque d'un client du cabinet pilote en exporte vraiment. Les tranches d'âge et le « ± 3
jours » sont des réglages, avec un **À VÉRIFIER** : ce sont des usages, pas des règles.

## 9.4.10 — 17/09/2026

**Entretien : rien de neuf à l'écran, et c'est le but.**

Une version sur quatre ne sert qu'à rembourser. Aucune fonction nouvelle ; ce qui change est
dessous, et c'est ce qui rend les suivantes possibles.

- **Electron passe de la 43 à la 44** — le moteur de rendu des deux applications. Les
  **46 parcours** ont été relancés dessus, sans exception : c'est la seule version où on les relance
  tous, et c'est exactement pour ça qu'elle existe.
- **Les 94 déclarations CSS physiques sont devenues logiques.** `margin-left` dit « le bord gauche
  de l'écran » ; `margin-inline-start` dit « le bord d'où commence la lecture ». En français les deux
  donnent la même image — ça ne promet pas l'arabe, ça garde la porte ouverte pour deux heures de
  travail aujourd'hui au lieu d'un chantier dans deux ans. Une seule règle reste physique, et elle
  est nommée dans le test : le bandeau passager, dont le `left: 50 %` centre dans les deux sens.
- **Chaque refus porte son code.** « Le paquet est illisible » ne désigne aucune ligne de code ;
  `ERR-CAB-010` si. Soixante-huit refus des deux processus principaux passent par une fabrique
  unique, le code voyage jusqu'à l'écran, et un test confronte les codes posés dans le code à la
  table du cahier des charges — deux tables qui vivent séparément divergent, toujours.
- **Et une exception imprévue laisse enfin une trace.** Jusqu'ici, une erreur qui échappait à un
  handler repartait vers l'écran habillée en anglais et n'écrivait rien dans le journal. Elle y est
  désormais. Les refus qu'on a ÉCRITS, eux, restent hors du journal : le remplir de mots de passe
  mal tapés reviendrait à ne plus le lire.
- **Le fichier de tests commence à se découper.** 13 900 lignes, c'est trop pour tenir en tête. Le
  premier domaine sort dans `test/suites/` (le rendu du Cabinet, 23 tests) et un contrôle refuse
  qu'une suite soit écrite sans être chargée — des tests présents qui n'affichent « ok » nulle part
  seraient pires que pas de tests.
- **`npm audit` entre dans l'intégration continue**, sur ce qui est LIVRÉ (`--omit=dev`) : une
  faille dans un outil de construction se corrige aussi, mais elle ne s'installe chez personne, et
  une CI rouge en permanence cesse d'être lue.
- **Les deux installeurs vérifient la version de Node**, lue dans `package.json` et pas écrite à
  côté.

Corrigé au passage, trouvé par le défaut lui-même : le test qui garantit que l'application du
comptable n'écrit jamais chez un client lisait un commentaire comme du code — troisième fois que ce
motif revient dans ce dépôt.

## 9.4.9 — 17/09/2026

**Le fil du parcours, et la fin de l'audit.**

Le métier du Cabinet est une boucle : un paquet arrive → je vérifie → j'écris les écritures →
j'exporte → je relance qui n'a rien envoyé. Elle était éclatée sur quatre pages sans lien entre
elles.

- **Depuis une relance**, on peut ouvrir la comptabilité du client — pour voir ce qu'on a déjà de
  lui avant d'écrire.
- **Depuis un paquet reçu**, on passe à ses écritures : « Créer le livre de ce client » s'il n'en a
  pas, « Voir ses écritures » sinon.
- **Depuis le livre d'un client**, on rejoint l'export qui regroupe tous les clients d'un mois.
- **On relance une sélection.** Une case par ligne, une case d'en-tête qui coche ce que l'écran
  montre (jamais les soixante), et le bouton de groupe qui suit : « Relancer 3 clients cochés ».
  Une coche posée sur un client qui a envoyé son mois entre-temps tombe d'elle-même.
- **Une courbe d'une barre sur douze n'est pas une courbe** : sous trois mois reçus, le chiffre
  d'affaires s'affiche seul, avec les mois sur lesquels il porte. La courbe des douze mois revient
  dès le troisième.
- **L'explication des actions d'un paquet passe dans la bulle du titre** : une prose grise sous un
  tableau se lit une fois et reste pour toujours.
- Un sous-titre de l'Aide qui finissait sur « si » paraissait coupé — et `e2e:cabinet-jour1`
  **mesure** désormais qu'aucun ne déborde de sa carte.

## 9.4.8 — 17/09/2026

**Les finitions du Cabinet.**

- **La case à cocher vient avant son libellé.** Dans une grille pleine largeur, l'écrire après la
  posait 500 px à droite du texte qu'elle coche.
- **« Jour de relance » dit dans quelle unité il compte** : « le **10** de chaque mois ». Dix quoi ?
  C'est cette date qui déclenche les relances de tout un portefeuille.
- **« Journal proposé » est une liste, plus un champ libre** : « VTE » au lieu de « VT » ne
  correspondait à aucun journal, et la grille de saisie s'ouvrait sur le premier venu sans un mot.
  Un code déjà réglé reste dans la liste, sinon rouvrir les Réglages l'effaçait.
- **L'assistant dit où l'on en est** : « Écran 2 sur 5 » à côté des pastilles, et le compte se
  déduit du nombre d'écrans.
- **« Imprimer » passe dans le menu d'actions de la fiche**, avec « Appeler » et « WhatsApp » : un
  en-tête a un budget de boutons, et les deux gestes de contact faisaient changer la barre de forme
  d'un client à l'autre.
- **« email à renseigner » et « téléphone à renseigner » sont cliquables** et ouvrent la fiche : un
  manque annoncé porte le bouton qui le comble.
- La colonne « Taille » quitte le tableau des paquets (le poids reste en infobulle) ; « Ajouter une
  ligne » descend sous le tableau qu'il allonge, au lieu de voisiner avec « Enregistrer ».

## 9.4.7 — 17/09/2026

**La fiche d'un client : l'année entière, dans le bon sens, et chaque mois agit.**

- **Les douze mois de l'année**, et non les six attendus : on ne savait pas si la mission
  commençait en mars ou si l'application avait perdu les deux premiers. Les mois hors mission sont
  là, en retrait, et ils disent pourquoi — « hors mission », « en cours », « à venir ».
- **Dans le sens du temps.** L'écran affichait « Août, Juillet, Juin, Mai, Avril, Mars » sous une
  étiquette « 2026 » : personne ne lit un calendrier à l'envers. Et c'est une vraie grille de douze
  colonnes, donc mars 2025 tombe au-dessus de mars 2026.
- **Chaque mois porte son geste** : ouvrir le paquet quand il est là, **relancer sur ce mois-là**
  quand il manque. Cinq cartouches rouges et aucun bouton, c'était un écran qui décrit un problème
  sans offrir d'y répondre. Un mois reçu avant que les paquets ne soient rangés sur le disque le
  dit, au lieu d'accepter le clic sans rien faire.
- **Un état vide secondaire s'annonce, il ne se contemple pas.** « Aucune relance enregistrée »
  occupait 250 px au milieu d'une fiche pleine. Les états vides qui vivent dans un panneau sont
  désormais discrets ; ceux qui SONT le corps d'un écran gardent leur présence.

## 9.4.6 — 17/09/2026

**Les Échéances : moins de répétition, un geste au bout, et le droit à l'erreur.**

- **Marquer une échéance déposée** — un pense-bête, et l'écran le dit : SkanFact ne dépose rien à ta
  place et ne se connecte à aucune administration. Le pointage porte sur **cette échéance-là** : la
  TVA d'avril cesse de réclamer, celle de mai reste due. Il se défait sur la carte, ou par le
  « Annuler » qui s'affiche juste après le clic.
- **« Les relancer » est un vrai bouton**, et il emmène aux Relances **filtrées sur ces clients-là**.
  Un lien qui nomme onze clients et en ouvre soixante ne tient pas sa promesse. La page annonce
  « n sur N », « Relancer » de groupe ne porte que sur ce qui est montré, et « Voir tout le monde »
  en sort.
- **Une échéance ne se répète plus.** L'explication d'une règle se lit une fois, pas sous les quatre
  mois de TVA d'affilée ; et quand les clients qui manquent sont les mêmes que l'échéance du dessus,
  on le dit au lieu de recopier la liste — quatre fois les mêmes noms font croire à quatre problèmes
  différents.
- Deux mécanismes de l'app entreprise enfin portés au Cabinet : le **« Annuler » de huit secondes**
  (`toastUndo`, qui reçoit vraiment les clics) et **`vers()`**, sans quoi un filtre posé avant de
  naviguer vers la page courante ne redessinait rien.

## 9.4.5 — 17/09/2026

**Le livre du Cabinet : on le parcourt au lieu de le subir.**

- **Le grand livre se lit d'un coup d'œil.** Chaque compte est replié sur sa ligne de synthèse —
  numéro, intitulé, mouvements, débit, crédit, solde, en colonnes alignées d'un compte à l'autre —
  et s'ouvre d'un clic. Le compte choisi dans la liste s'ouvre tout seul, et l'impression les ouvre
  tous. La page passe de **6 554 px à 2 170 px** : on voit enfin quels comptes existent sans
  défiler, c'est-à-dire la seule question qu'on se pose en arrivant.
- **Les quatre vues de la comptabilité sont paginées** — le livre-journal par pièce (jamais par
  ligne : couper une pièce en deux montrerait un débit sans son crédit), le grand livre par compte,
  la balance et le lettrage par ligne. Le pied de totaux et l'export portent sur la **sélection
  entière**, jamais sur la page affichée, et chaque changement de filtre ramène à la page 1.
- **Un libellé tient sur une ligne**, avec son texte entier au survol et intact à l'export. Le
  livre-journal faisait 5 888 px pour dix-sept pièces : ce n'était pas le nombre de lignes, c'était
  chaque ligne repliée sur trois parce qu'un libellé de facture porte le nom du client. **3 268 px**
  désormais.
- **Les totaux de la grille de saisie vivent sous leurs colonnes**, débit et crédit, en chiffres de
  même chasse, avec la ligne d'écart quand la pièce ne tombe pas juste.
- **Un bouton éteint dit pourquoi.** Les deux boutons d'enregistrement s'éteignent tant que la pièce
  ne passerait pas, et le motif — celui exact qu'on aurait lu après le clic — s'affiche à côté du
  solde, au-dessus des boutons.
- **La date est proposée** (aujourd'hui, ou le dernier jour de l'exercice) et **s'affiche en
  français** : l'écran montrait « 2026-09-17 » sous une invite qui annonce « 04/03/2026 ». La pièce,
  elle, garde l'ISO. Le champ se sélectionne au clic, pour qu'une date tapée remplace celle qu'on
  propose au lieu de s'y ajouter.
- **Les raccourcis s'affichent comme des touches** (⌃ + ↵, ⇥ Tab, F2…) au lieu d'être écrits en
  toutes lettres au milieu d'une phrase grise — et chaque touche **se règle en appuyant dessus**,
  plus en tapant « Control+Enter » de mémoire. Un bouton remet celle d'origine.
- Les trois boutons « Enregistrer » des Réglages disent ce qu'ils enregistrent.

## 9.4.4 — 17/09/2026

**La page Dossiers : le portefeuille au-dessus de la ligne de flottaison.** Sur un portable de
1280×800 — l'écran d'un comptable, pas un 27 pouces — la liste des clients commençait à **800 px**,
c'est-à-dire exactement au bas de l'écran. Elle commence maintenant à **523 px**, en-tête et
premières lignes visibles à l'ouverture. Le portefeuille est le produit ; il ne se mérite pas au
défilement.

- Les quatre chiffres du haut tiennent sur **une rangée de 72 px** au lieu de quatre cartes de 180,
  et deux d'entre eux — « à jour » et « mois manquants » — s'ouvrent : un écran qui NOMME un
  ensemble doit pouvoir le montrer.
- **« À faire » se replie**, garde les deux lignes les plus urgentes sous les yeux et compte ce
  qu'il cache (« Voir 4 autres lignes »). Le choix est mémorisé.
- **Chaque ligne de la liste porte son menu d'actions** : relancer le client, ouvrir sa
  comptabilité, voir ses paquets, modifier sa fiche. Relancer demandait avant trois écrans.
- **Les six lignes de « À faire » disent où elles mènent** — cinq portaient le même libellé « Voir ».
- **Les pastilles de couleur ont leur légende.** Rouge, orange, vert devant chaque client, et rien
  nulle part ne disait ce que ça voulait dire.
- **Les colonnes entièrement vides sont masquées**, le nombre est dit, et « Tout afficher » les rend.
- **La recherche a sa loupe** et cesse de faire 1 220 px de large pour chercher parmi cinq clients.
- **La colonne d'actions reste collée à droite** quand la table défile : le geste ne se cherche pas.
- **Le premier écran d'un comptable n'est plus un bandeau rouge.** L'avertissement de la clé de
  secours était juste, le moment ne l'était pas : avant le premier paquet, il n'y a rien à perdre.
  Une ligne calme avec son bouton au jour 0, le rouge dès qu'un paquet est sur le disque.

## 9.4.3 — 17/09/2026

**Le socle visuel du Cabinet, et les instruments qui le tiennent.** L'application entreprise est
tenue par quatre parcours qui mesurent ce qui s'affiche vraiment : le contraste et le débordement de
chaque bouton, l'alignement de chaque colonne, la largeur de chaque contrôle d'en-tête, la barre
latérale sur quatre tailles d'écran. **Aucun des quatre ne regardait l'app Cabinet.** Elle a donc
hérité des fonctionnalités de sa jumelle et d'aucun de ses garde-fous visuels, et elle a dérivé
exactement là où personne ne mesurait.

- **`npm run e2e:cabinet-rendu`** braque les trois sondes sur TOUS les écrans du Cabinet et TOUS
  leurs onglets, en clair et en sombre, à 1440 et à 1280 : **1 024 boutons, 777 colonnes,
  20 contrôles** mesurés. Les sondes vivent désormais en un seul exemplaire dans `test/e2e/harnais.js`,
  partagées par les quatre parcours — recopiées, elles auraient divergé.
- **Le Cabinet a un thème sombre.** Il n'en avait aucun : pas une ligne, pas un réglage. Trois
  cartes dans Réglages → L'application (« Comme le système », « Clair », « Sombre »), chacune avec
  sa miniature ; « Comme le système » suit le réglage du poste et bascule avec lui.
- **Une vraie échelle de titres.** Un seul style de titre de section existait dans les deux
  applications — 11 px, gris, en capitales — et il donnait le même poids à « Comptabilité » qu'à
  « Abonnements ». Un titre de section se lit maintenant comme un titre ; la capitale grise garde
  son seul bon rôle, la catégorie posée au-dessus d'un chiffre. La même déclaration était recopiée
  **huit fois** dans les deux feuilles, et deux exemplaires avaient déjà dérivé : il en reste un.
- **Les six onglets de la Comptabilité montrent enfin lequel est ouvert.** Ils posaient une classe
  que la feuille de style ne connaît pas, depuis la 9.1.0.
- **Huit champs sans étiquette** en ont une : le sélecteur de compte du grand livre et du lettrage,
  les deux filtres de la Recherche, le choix d'un guide, et les cinq cases de chaque ligne de la
  grille de saisie.
- **La page Écritures ne s'ouvre plus sur quatre zéros** alors que les données existent. Elle
  proposait une période construite sur les paquets de l'exemple, puis se déclarait vide dessus :
  ce qui décide est le fichier sur le disque, plus l'étiquette du dossier.
- **« Mois manquants » s'aligne sur ses chiffres.** L'en-tête se lisait à gauche au-dessus de
  valeurs alignées à droite.

Et les captures de tous les parcours montrent enfin la page **entière** : le cadre est fixe et c'est
le contenu qui défile, donc `fullPage` rendait la même image qu'une capture d'écran. Le grand livre
d'un dossier fait 6 462 px ; on n'en voyait que 900.

Numérotation : l'entretien qui portait le numéro 9.4.3 (Electron, découpage, codes d'erreur) devient
**9.4.7**.

## 9.4.2 — 17/09/2026

**Le jeu d'exemple se remet à jour tout seul.** Personne ne pense à l'effacer puis à le recharger à
chaque mise à jour — et il ne faut pas : il est **relatif au mois courant**. Chargé en septembre et
rouvert en décembre, il montre trois mois de retard chez des clients censés être à jour, et une
échéance de TVA passée depuis longtemps. Il se refait maintenant quand l'application change de
version, ou quand on change de mois, **dans les deux applications**.

- Il ne touche **que l'exemple** : un vrai dossier créé à la main pendant l'essai, une vraie facture,
  ne passent jamais par là. L'application **le dit** dans le bandeau de l'exemple, et rappelle que
  le reste n'a pas bougé — un jeu de données qui change sans un mot ferait douter de tout.
- Côté Cabinet, une sauvegarde est prise avant ; côté SkanFact, non, et c'est voulu : « avant-demo »
  est le seul chemin de retour vers les vraies données, en écrire une ici rangerait l'exemple
  par-dessus.

**Le premier jour d'un comptable, mesuré écran par écran.** Trente-cinq écrans photographiés du mot
de passe à l'Aide, dans l'ordre où on les rencontre. Ce que la mesure a trouvé :

- **Neuf boutons se lisaient comme du texte en gras** — dont les cinq « Voir » de « À faire » et
  « Enregistrer ma clé… », l'action la plus importante de l'application. Un bouton se reconnaît au
  repos, jamais au survol : personne ne survole ce qu'il ne voit pas.
- **La page Relances félicitait un cabinet qui n'a aucun client** (« tous tes dossiers sont à jour »)
  et n'offrait aucun geste. Elle a maintenant son état vide, comme Échéances et Écritures.
- **« Il n'y a aucun moyen de récupérer ce mot de passe » se lisait SOUS le bouton** qui crée le
  cabinet. Il est au-dessus, dans un encadré, aligné à gauche.
- **Neuf champs sans explication** ont reçu leur bulle « i » — dont les cinq touches de la grille de
  saisie, où « Solder la pièce » ne disait pas ce que le geste fait. Trois listes déroulantes nues
  ont reçu leur étiquette.
- L'assistant annonçait « Quatre écrans » au-dessus de **cinq** pastilles qui les montraient. Il les
  compte.
- Le champ « Journal proposé » coupait son propre texte d'invite ; les paragraphes d'introduction
  couraient sur 1 140 px ; la ponctuation double (`?` `!` `;` `:` `«` `»`) porte enfin son espace
  insécable — sans elle, un « ? » se retrouvait seul en début de ligne.

**Et dans la console (`api.skanfact.tn`), la colonne « Vu » donne l'heure.** « Aujourd'hui » dit si
l'installation vit encore ; l'horodatage dit à quelle heure elle a été ouverte. Au passage : un jour
est un jour du calendrier, pas une tranche de 24 heures — une application ouverte hier à 23 h et
regardée ce matin à 8 h se lisait « aujourd'hui ». Le journal des événements affiche lui aussi
l'heure locale, et non plus l'heure du serveur.

## 9.4.1 — 17/09/2026

**La révocation s'applique enfin.** La clé qui permet au serveur de **prouver** que ses réponses
viennent bien de lui est embarquée dans cette version. Jusqu'ici elle valait `null` : une licence
révoquée depuis la console continuait de fonctionner chez le client, parce que l'application ignorait
— par construction, et c'était le bon défaut — toute réponse qu'elle ne pouvait pas vérifier.

- **Ce qui change pour toi (client) : rien**, sauf si ta licence est révoquée. Aucun message, aucune
  connexion obligatoire, aucun réglage. Une réponse du serveur n'est crue que si elle est **signée,
  datée et adressée à ta licence** ; sinon elle est ignorée, comme avant.
- La clé a été **recréée le 17/09/2026** sur l'ordinateur de l'éditeur. Celle du 15/09 avait été vue
  hors de son poste : une clé privée qui a été vue est brûlée, on la jette et on recommence.

**Et la console (`api.skanfact.tn`) sait vendre une licence de cabinet.** La 9.4.0 avait appris à
SkanFact Cabinet à lire une clé de cabinet et à l'Éditeur de SkanFact à en signer une ; la console,
elle, ne connaissait que deux offres. Les trois moitiés d'une même vente sont maintenant d'accord.

- **Un type à l'émission** : « Entreprise » (une offre, un matricule, s'installe dans SkanFact) ou
  « Cabinet comptable » (l'empreinte du cabinet, un quota de dossiers hors SkanFact, s'installe dans
  SkanFact Cabinet). Chaque application refuse la clé de l'autre.
- **Aucun prix n'est proposé pour un dossier de cabinet** tant qu'il n'est pas réglé : les tarifs du
  Cabinet ne sont pas fixés, et un chiffre écrit « pour l'exemple » deviendrait un tarif.
- **« Changer le quota »** remplace « Changer d'offre » sur un cabinet : la date de fin ne bouge pas,
  seule la différence est facturée au prorata. **Renouveler** garde le quota.
- Le mail d'une clé de cabinet mène à **Réglages → Mon cabinet → Licence**, jamais aux Paramètres de
  SkanFact. La facture dit « SkanFact Cabinet — N dossiers ». La colonne de la console affiche le
  quota et combien de clients ce cabinet a parrainés.
- Une empreinte se compare désormais **sans ses séparateurs** : `3F9A-2C1E-…` recopiée d'un message
  et `3f9a2c1e…` rangée par la console sont le même cabinet. Un « G » tapé pour un « 6 » reste, lui,
  une faute qui se voit.

Prouvé : 27 défauts réintroduits un par un font tomber leur test. 458 tests, lint 0 erreur,
`e2e:console` (16 étapes), `e2e:pont` et `e2e:licence` verts.

## 9.4.0 — 17/09/2026

**SkanFact Cabinet devient payant — au-delà de trois dossiers, et seulement pour ceux qui ne sont pas
sur SkanFact.** On vend des **dossiers**, jamais des postes : installe-le sur autant d'ordinateurs
que tu veux, c'est le même cabinet.

- **Gratuit pour toujours** pour tous les dossiers dont le client utilise SkanFact, quel qu'en soit
  le nombre — plus **trois dossiers hors SkanFact**. Un cabinet dont les soixante clients sont sur
  SkanFact ne paie jamais rien.
- **Ce qui peut attendre une licence, c'est la validation d'une écriture. Rien d'autre.** Lire un
  livre, importer un paquet, saisir, exporter tes écritures, relancer un client : toujours ouvert.
  Jamais de données en otage — ce sont les pièces de tes clients qui dorment ici.
- **L'écran nomme chaque dossier compté, avec sa raison.** Ne comptent pas : un dossier archivé, un
  dossier sans écriture validée depuis douze mois, un client sur SkanFact, et un client dont la
  licence **payée** a expiré il y a moins de douze mois — on ne te fait pas payer un retard qui
  n'est pas le tien.
- **Le doute profite au cabinet** : un paquet fabriqué avant cette version ne dit pas si son client
  a une licence. Dans ce cas, le dossier **ne compte pas**, et l'écran explique pourquoi.
- **La clé est attachée à l'empreinte de ton cabinet** — celle que tu dictes à tes clients. Elle te
  suit quand tu changes d'ordinateur, à condition d'avoir **repris** ton cabinet par ta clé de
  secours. Un cabinet recréé à neuf a une autre empreinte.
- Bandeau à trois tons dans la barre latérale, ligne « À faire » quand le quota est dépassé, et
  « Demander une licence » qui prépare le message. Ce qui part : ton empreinte, le nombre de
  dossiers comptés, la version. **Jamais un nom de client.**

**Côté SkanFact (l'application des entreprises)** : le paquet mensuel porte désormais l'**état** de
ta licence — l'état, sa date de fin et si elle a été payée, rien d'autre, jamais la clé. C'est ce qui
permet à ton comptable de ne pas payer pour toi. Et une clé de cabinet ne peut plus déverrouiller une
application d'entreprise, ni l'inverse.

## 9.3.0 — 17/09/2026

**Le Cabinet sait enfin SAISIR.** Jusqu'ici il lisait la comptabilité que le client lui envoyait ; il
tenait son livre, mais rien ne permettait d'y écrire une pièce à la main. C'est l'écran où un
comptable passe ses journées, et il est fait pour le clavier : **la souris n'est jamais obligatoire**.

- **La grille**, dans la fiche d'un client → Comptabilité → **Saisie**. Journal, date, pièce, puis les
  lignes. **Entrée** descend et ajoute une ligne quand tu es sur la dernière. **Tab** sur le crédit de
  la dernière ligne **solde la pièce** : ce qui manque se pose tout seul, dans la bonne colonne.
  **F2** recopie la cellule du dessus, **F4** duplique la pièce, **Ctrl+Entrée** enregistre et valide.
- **La date se tape vite** : « 4 », « 4/3 », « 04/03/26 », « 2026-03-04 » ou « 040326 » au pavé
  numérique. Une date qui n'existe pas laisse le champ en rouge plutôt que de choisir un jour voisin.
- **Le compte se cherche par numéro OU par nom** pendant la frappe, sans accent : « interets » trouve
  « Intérêts ». Et l'**équilibre s'affiche en direct**, pendant que tu tapes.
- **Brouillard, puis validation.** Ce que tu saisis arrive sans numéro, modifiable, supprimable — et
  n'entre ni dans la balance ni dans le grand livre. Valider attribue le numéro et referme la pièce :
  après, elle se **contre-passe** (miroir à la date du jour) ou s'**extourne** (miroir au 1er du mois
  suivant, pour une charge à payer). Une validée ne se modifie ni ne se supprime, jamais.
- **Valider un lot** — tout un journal, tout un mois — sans jamais refuser en bloc : ce qui tombe
  juste est validé, ce qui ne tombe pas juste t'est **nommé** et reste en brouillard. La numérotation
  ne se troue pas.
- **Les guides d'écritures** (Réglages → Comptabilité) : un modèle de pièce, avec d'où vient chaque
  montant — un montant fixe, un pourcentage, ou le solde. « Achat avec TVA 19 % » sur 1 000 pose
  1 000 / 190 / 1 190 et la pièce tombe juste. Un guide **préremplit, il n'écrit pas**.
- **Les abonnements** (sur la fiche du client) : un guide plus une périodicité, pour le loyer de
  chaque mois. Ils génèrent **en brouillard**, jamais une écriture validée que personne n'a regardée,
  et relancer la génération ne double rien.
- **La correspondance des comptes** : le plan de ton client traduit vers le tien, à l'import et à
  l'export — jamais en réécrivant une écriture déjà validée.
- **Chercher** dans tout le journal de l'exercice : pièce, tiers, libellé, compte, numéro — et
  **montant** (« 1191 » ou « 1191,000 »).
- **Un justificatif** se glisse sur une écriture : le fichier est **copié** dans le dossier du client,
  jamais simplement pointé.
- **Les touches sont réglables** (Réglages → Comptabilité). C'est délibéré : une grille de saisie ne
  s'invente pas, elle se reprend de celle que le comptable a déjà dans les doigts.

## 9.2.2 — 16/09/2026

**La fiche d'un dossier, dans le Cabinet, tient enfin sur un écran.** Tout était sur la même
page : l'identité, le graphique, les mois, la comptabilité entière, les paquets, les relances —
sur un vrai dossier, le seul bloc Comptabilité faisait une page à lui seul, posé au milieu.

- **Un en-tête** avec le nom, l'identité sur une ligne, et l'état du dossier en une phrase :
  « 3 mois reçus · 2 manquants · dernier paquet le 06/09 · CA 2026 : 86 630 DT ». Le bouton
  **Relancer** passe en premier quand il manque quelque chose.
- **Trois onglets** : *Suivi* (les mois, les relances, la note — l'écran du quotidien),
  *Comptabilité* (livre-journal, grand livre, balance, lettrage, reprise), *Paquets* (les paquets
  reçus avec leurs actions, et le graphique de chiffre d'affaires qui en vient).
- **Les alertes restent au-dessus** des onglets, quel que soit celui qu'on regarde, et mènent
  aux paquets concernés.
- **L'onglet est dans l'adresse** : « précédent » y revient, et une autre page peut ouvrir un
  dossier directement sur sa comptabilité.
- **Imprimer** imprime la fiche entière, comme avant.

**Et le jeu d'exemple du Cabinet livre de vrais paquets.** Ses cinq dossiers n'avaient que des
chiffres : aucun fichier, donc « aucun paquet ne contient d'écritures » sur la page qui doit
montrer un exercice ouvert. Ils reçoivent maintenant de vrais `.skanpack` — journaux, écritures
en partie double, balance, TVA — tirés du jeu de démonstration de SkanFact, recalés sur le mois
courant, scellés pour ta clé, et importés par la même porte qu'un paquet reçu par mail. Ce que
l'exemple montre est ce que l'application fait : livre-journal, grand livre, balance, lettrage,
pièces vérifiées. Effacer l'exemple efface aussi ses fichiers.

## 9.2.1 — 16/09/2026

**La désignation cherche dans le catalogue.** Sur un achat en destination « stock », SkanFact
te disait qu'une ligne « memoire 16go » ne correspond à aucun article suivi — et te laissait
chercher à la main comment l'article s'écrit exactement. L'article existait ; il n'y avait rien
à retaper, il y avait à choisir.

- **Tape le début du nom, le catalogue se propose.** Dans l'éditeur d'achat comme dans celui
  des devis et factures. La recherche ignore les accents et les espaces : « memoire 16go »
  trouve « Mémoire 16 Go ». Choisir remplit le prix, la TVA, l'unité, et rattache la ligne à
  l'article — même si tu retouches le libellé ensuite, le stock suit.
- **L'article qui n'existe pas se crée depuis la liste**, prérempli avec ce que tu as tapé, et
  déjà coché « suivi en stock » quand la ligne est en destination stock.
- **L'avertissement débloque au lieu de reprocher** : chaque ligne fautive porte « Choisir
  l'article… », qui te ramène au champ et ouvre les propositions.

Un article suivi choisi dans un achat passe la ligne en « stock » tout seul. Rien ne change
sur tes pièces déjà enregistrées.

## 9.2.0 — 16/09/2026

**Le livre du dossier, et le paquet signé.** Côté cabinet, chaque dossier a
désormais SON livre comptable : les écritures qu'on y valide, celles qu'on y
saisit, les lettrages. Et le paquet mensuel est enfin **signé** par le client qui
l'envoie.

### Le paquet est signé — le trou que trois relectures extérieures ont pointé

Jusqu'ici, un paquet était **chiffré** mais pas **signé**, et ce n'est pas la même
chose. Le chiffrement dit « seul mon comptable peut lire ceci ». Il ne dit pas
« ça vient bien de moi » — et comme il n'utilise que la clé *publique* du cabinet,
celle que ton comptable donne à tous ses clients, n'importe qui la tenant pouvait
lui envoyer un paquet à ton nom. Il l'aurait importé sans un mot.

- SkanFact crée maintenant une paire de clés **au premier envoi**, dans le dossier
  de ton entreprise (jamais dans tes données, donc jamais dans un export ni dans
  le paquet), et signe le manifeste de chaque paquet avec elle.
- Le cabinet vérifie, puis **épingle** ta clé au premier paquet signé. Tout ce qui
  suivra lui sera comparé : un paquet signé par une autre clé est refusé en
  nommant les deux empreintes, et la reprise passe par l'empreinte dite de vive
  voix — jamais par une acceptation automatique.
- Un paquet d'une version antérieure reste accepté, marqué « origine non
  prouvée ». La tolérance s'éteint d'elle-même client par client, dès qu'un
  premier paquet signé arrive.

### Le livre du cabinet

- **Un fichier par dossier et par exercice**, chiffré, avec son entête lisible :
  un livre retrouvé sur une clé USB dit de quel client et de quelle année il parle
  avant qu'on cherche son mot de passe. Il part **toujours** avec la copie externe
  — un paquet perdu se redemande au client, un livre perdu non.
- **Créer le livre à partir des paquets reçus**, en un bouton. Rejouer ne double
  rien : un mois renvoyé remplace ses brouillards et **ne touche jamais une
  écriture validée** — l'écart est calculé et affiché, et c'est le comptable qui
  tranche.
- **Reprendre un dossier** venu d'un autre cabinet : exercice, plan de comptes,
  balance d'ouverture (saisie ou importée d'un CSV), avec l'écart d'équilibre en
  direct pendant la saisie et un refus net si elle ne tombe pas juste.
- **Valider** une écriture lui donne son numéro, définitivement. Une écriture
  validée ne se modifie plus : on la **contre-passe**, à la date du jour où l'on
  corrige. C'est ce qui fait qu'un livre relu dans deux ans dit la vérité de ce
  qui a été fait.
- **Le brouillard se voit** (italique, fond estompé, pastille à la place du
  numéro) et n'entre dans aucune balance tant qu'on ne le demande pas.
- **Le lettrage** relie une facture et son règlement, et refuse de solder ce qui
  ne se solde pas : un lettrage qui laisse un reste affirme qu'une facture est
  payée alors qu'il reste quelque chose.
- Chaque geste laisse une trace dans la piste d'audit du livre, qui n'est jamais
  purgée, et un livre ouvert sur un autre ordinateur ne s'écrase pas.

Le format du livre suit la mesure du test de charge de la 9.1.0 : corps binaire,
pas base64. Rien de tout cela ne change quoi que ce soit dans SkanFact côté
entreprise, sauf la signature du paquet — qui se fait toute seule.

### Aussi dans cette mise à jour : la 9.1.0 et la 9.1.1

Elles n'ont jamais été publiées séparément. Si tu viens de la 9.0.0, tu reçois
donc aussi :

- **Une formule cachée dans un export CSV ne s'exécute plus** (9.1.1). Un tableur
  exécute une cellule qui commence par `=`, `+`, `-` ou `@` : le libellé d'une
  ligne de facture partait tel quel dans le journal envoyé au comptable. Les
  quatre exports des deux applications sont protégés, et aucun montant ne bouge.
- **« Émettre » ne peut plus donner deux numéros** (9.1.0) : deux clics rapides
  en consommaient deux et trouaient la numérotation de tes factures.
- **Les trois onglets de comptable de la page Comptabilité** (grand livre,
  balance, états financiers) deviennent une option, décochée par défaut — SkanFact
  s'arrête à ta gestion. Rien n'est supprimé : Écritures, TVA, clôtures et l'envoi
  au comptable restent là, et la case se recoche dans « Tous les modules ».
- **« Exonéré de timbre fiscal » sur la fiche client**, et un **seuil de retenue à
  la source** réglable, à 0 (donc muet) tant que ton comptable ne t'a pas donné le
  chiffre (9.1.1). Tes factures déjà émises ne bougent pas.
- **Une bulle d'aide en écrasait une autre depuis huit versions** : en cliquant
  « Offre » dans tes Paramètres, tu lisais une explication écrite pour autre chose.
- **Un journal technique borné**, qui ne grossit plus sans fin, et une erreur de
  l'interface qui y laisse enfin une trace.

## 9.1.1 — 16/09/2026

**Les corrections fiscales.** Quatre chiffres qui partent chez un tiers — l'administration, un
client, ton comptable — et qui traînaient sans version. La règle qui les tient tous : **la valeur
par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien.** Rien ici n'invente un
chiffre à ta place, et chaque nouveauté porte son « À VÉRIFIER ».

- **Une formule cachée dans un export CSV ne s'exécute plus.** Un tableur ne lit pas un CSV comme
  un fichier de données : une cellule qui commence par `=`, `+`, `-` ou `@` est une **formule**,
  qu'il exécute à l'ouverture. Le libellé d'une ligne de facture partait tel quel dans le journal
  que tu envoies à ton comptable — il suffisait d'y écrire la bonne chose pour faire partir le
  contenu de sa balance vers une adresse choisie par celui qui a tapé le libellé, sans que rien ne
  plante. Les **quatre** exports des deux applications passent maintenant par la même parade, et
  aucun montant ne bouge : `-12,500` reste un montant.
- **« Exonéré de timbre fiscal » sur la fiche client.** Le timbre est décoché d'office sur ses
  nouvelles factures, et se remet pièce par pièce. Les factures **déjà émises ne bougent pas** :
  leur timbre est gelé à l'émission, et le calcul ne relit jamais la fiche du client.
- **Un seuil de retenue à la source**, dans Paramètres → Documents, **à 0 par défaut** — donc
  aucun seuil, et aucun message, tant que ton comptable ne t'a pas donné le chiffre. Réglé, il
  **prévient** quand une facture sous le seuil porte quand même une retenue : il ne refuse jamais
  et ne retire jamais la retenue tout seul.
- **La TFP proposée par métier** dans Paie → Barèmes, quand le métier en porte une. Aucun n'en
  porte aujourd'hui : c'est une règle de droit, et elle attend la réponse du comptable plutôt
  qu'un chiffre écrit dans le code. Une fois tes barèmes enregistrés, la proposition ne revient
  jamais écraser ton taux.
- **Le contrôle e-facture** (`docs/e-facture-controle.md`) : champ par champ, ce que notre modèle
  porte déjà de ce qu'un format officiel exigerait. Il ne construit rien — il répond à la seule
  question qui compte aujourd'hui : *le jour où l'obligation tombe, est-ce une semaine ou trois
  mois ?* Réponse : les chiffres sont là, les identités sont incomplètes mais rattrapables, la
  signature et l'acheminement sont entièrement à faire.

## 9.1.0 — 16/09/2026

**L'outillage, et le moteur comptable partagé par les deux applications.** Une version sans nouvel
écran pour toi : c'est le socle sur lequel la comptabilité du cabinet va s'écrire, plus les filets
qui manquaient à un logiciel qu'on vend.

- **Le moteur comptable est sorti dans son propre fichier** (`src/renderer/compta.js`), chargé par
  SkanFact **et** par SkanFact Cabinet. La règle qui décide de ce qui y va : une fonction qui prend
  tes données reste dans le cœur, une fonction qui prend des **lignes d'écriture** vit là. C'est ce
  qui permet au cabinet de calculer ta balance à partir de ce que ton paquet contient. Un test
  vérifie que les deux balances — la tienne et la sienne — sont identiques **au millime**, sur les
  24 mois du jeu d'exemple. Sans lui, ton comptable et toi auriez deux chiffres et aucun moyen de
  savoir lequel croire.
- **Le cabinet lit tes livres** : grand livre, balance, livre-journal, centralisateur et lettrage,
  calculés sur les paquets déjà reçus, sans rien te demander. Un mois illisible ou un paquet d'avant
  la 6.3.0 est **nommé** au lieu d'être compté à zéro, et la clé de secours est réclamée au premier
  import — pas après soixante.
- **Les trois onglets de comptable de la page Comptabilité** (grand livre, balance, états financiers)
  sont désormais une **option**, décochée par défaut : SkanFact s'arrête à ta gestion, ces écrans-là
  sont ceux de ton comptable. Rien n'est supprimé — le moteur écrit toujours ton paquet — et
  Écritures, TVA, clôtures et l'envoi au comptable restent là pour tout le monde. La case se coche
  et se décoche, toujours, depuis « Tous les modules ».
- **« Émettre » ne peut plus donner deux numéros.** Deux clics rapides consommaient deux numéros et
  trouaient la numérotation de tes factures.
- **Un journal technique borné** : il ne grossit plus sans fin, et une erreur de l'interface y laisse
  enfin une trace (au maximum vingt par minute, et le journal dit combien il a tues).
- **Une bulle d'aide en écrasait une autre depuis huit versions** : en cliquant « Offre » dans tes
  Paramètres, tu lisais depuis la 8.2.0 une explication écrite pour autre chose.
- Pour le développement : un **lint** qui refuse les trois fautes de date qui ont fait geler
  l'application en 5.1.0, une **vérification automatique** à chaque poussée sur Linux et Windows, et
  un bouton « construire un essai » pour te faire tester une version sans la publier.

**Test de charge du livre comptable** (`npm run charge`, Node 22 · x64 · 4 cœurs), la mesure qui
décide du format que la 9.2.0 écrira — mesurer avant d'écrire un format, jamais après :

| Ce qu'on mesure | Mesuré | Seuil |
|---|---|---|
| Ouvrir un livre de 50 000 lignes | **119 ms** | 1 000 ms |
| Valider une écriture (médiane sur 20) | **141 ms** | 100 ms |
| Balance de 60 dossiers (345 001 lignes, 97 Mo) | **906 ms** | 5 000 ms |
| Recherche d'une pièce dans tout le portefeuille | **737 ms** | 3 000 ms |

Une seule mesure dépasse son seuil : l'écriture. Trois leviers ont été mesurés plutôt que devinés —
corps binaire au lieu de base64 (**57 ms**, 59 % de gagné), découpage par mois (9,8 ms), les deux
(5,0 ms). Le moins cher qui suffit est le premier, et il ne change ni la forme du livre ni aucun
appelant : la 9.2.0 écrira un corps binaire. Décision consignée dans le cahier des charges.

## 9.0.0 — 15/09/2026

**L'exercice.** Après le grand livre (8.8.0) et le livre-journal (8.9.0), la comptabilité se lit
en entier, du 1er janvier au 31 décembre : c'est ce qui manquait pour qu'un cabinet retrouve dans
SkanFact ce qu'il attend d'une comptabilité tenue.

- **Les à-nouveaux** : au 1er janvier de chaque exercice, une pièce AN rouvre chaque compte de
  bilan avec son solde de la veille et porte le net des charges et produits de tout ce qui précède
  au compte de résultat des exercices antérieurs. Déduite des écritures, jamais saisie ; c'est elle
  qui remet les charges et les produits à zéro. Le grand livre de janvier ouvre par elle.
- **Les amortissements passent en écriture** : la dotation de chaque bien s'écrit au 31 décembre
  (681 / 28) — jamais avant, c'est une écriture d'inventaire ; un bien saisi à la main (acheté avant
  SkanFact) entre à sa valeur brute ; une **cession** sort le bien de l'actif (amortissements repris,
  valeur nette comptable en charge, valeur brute soldée). Le prix de cession arrive par un mouvement
  « autre entrée » avec la contrepartie **775**, ou par une facture.
- **Les états financiers** (Comptabilité → États financiers) : un **bilan** (actifs non courants
  bruts et amortissements, stocks, créances, trésorerie face aux capitaux, dettes, résultat) et un
  **état de résultat** (produits − charges), déduits de la balance de l'exercice, arrêtés à
  aujourd'hui ou à la fin du mois choisi. Actif = passif par construction, le résultat des deux
  états est le même, et la dotation de l'exercice en cours encore en attente est annoncée. Une
  présentation d'ensemble, pas la liasse NCT 01 : le cabinet l'établit à partir de ces chiffres.
- **L'état de rapprochement bancaire** (Trésorerie → Rapprochement) : la présentation classique —
  solde du relevé, plus les encaissements que la banque n'a pas encore crédités, moins les
  paiements qu'elle n'a pas encore débités, égale le solde de SkanFact, et l'écart s'il en reste.
  Exportable, c'est l'état que le comptable joint au dossier.
- **TFP et FOPROLOS dans la paie** : deux taxes patronales sur la masse salariale (2 % et 1 %,
  réglables dans Paie → Barèmes, comme tout taux), sur le bulletin, dans le coût employeur et dans
  le journal (661 / 4335). Un bulletin établi avant cette version n'en gagne pas après coup : il
  garde la copie de son calcul.

*À VÉRIFIER avec le comptable :* le taux de TFP applicable (1 % pour les industries
manufacturières), le compte d'imputation des immobilisations (22 par défaut, à détailler par
famille chez certains cabinets), et la présentation des états, qui suit ici la balance et non la
liasse.

## 8.9.0 — 15/09/2026

**Le livre-journal.** Le second terme du comptable : « l'écriture comptable dans le journal ».
L'onglet Écritures devient un vrai livre-journal, et tout ce qui touche l'argent y est.

- **Un numéro continu par pièce** dans l'exercice (1, 2, 3… sans trou), le même sur chaque ligne
  de la pièce, dans l'export CSV et dans le paquet du cabinet. Les numéros suivent les dates ; un
  mois clôturé ne bouge plus, ses numéros non plus — la page le dit.
- **Les opérations diverses se saisissent à la main** : « Saisir une opération diverse… » ouvre une
  fenêtre à deux lignes ou plus (compte, libellé, débit ou crédit), qui nomme chaque compte pendant
  la frappe, annonce l'écart, et **refuse tant que débit ≠ crédit**. Le numéro OD-2026-001 est pris à
  l'enregistrement, jamais réutilisé. Elles se modifient et se suppriment depuis leur liste, comptent
  pour la clôture, et voyagent entre deux postes.
- **Les mouvements libres de la Trésorerie produisent leurs écritures** : frais bancaires (627),
  apport ou retrait (compte courant d'associé), échéance d'emprunt (16), salaires (personnel), impôts
  (434), et ce que personne ne sait ranger au **compte d'attente 471**, pour que le comptable
  ventile. Chaque mouvement peut porter sa **contrepartie** précise (la TVA du mois réglée en
  « impôt » va au 4365 TVA à payer). Le journal est celui du compte : une sortie de caisse va au
  journal de caisse, quel que soit son mode.
- **Le paiement des bulletins** (personnel → banque), **les soldes de départ** des comptes de
  trésorerie (journal AN, contrepartie « report à nouveau ») et **le crédit de TVA saisi à la main**
  entrent dans le journal : la banque du grand livre dit désormais le même chiffre que la page
  Trésorerie, au millime.
- **La déclaration mensuelle passe en écriture** à la fin de chaque mois écoulé : la TVA collectée
  est soldée contre la déductible (report compris), le net à payer — timbres et retenues opérées
  avec lui, c'est le même formulaire — va au **4365 TVA à payer**, qu'un mouvement « impôt » solde le
  mois suivant. Un crédit reste au débit du 4366, comme dans le tableau mois par mois.
- **Le journal centralisateur** : mois par mois, journal par journal, les totaux au débit et au
  crédit et le nombre de pièces, pour l'exercice. Exportable.
- **Le lettrage** (onglet Balance → Lettrage) : une facture soldée et ses règlements portent la
  même lettre — son numéro — dans le livre-journal et le grand livre ; ce qui reste ouvert est listé
  tiers par tiers, avec son reste, en rouge quand c'est en retard, et chaque ligne ouvre sa pièce.
  Le total des restes clients est le solde du compte Clients.
- **Corrigé au passage** : une facture entièrement couverte par un avoir ne produisait plus
  d'écriture, alors que son avoir en produisait — le client finissait créditeur d'un montant jamais
  facturé. Trouvé par le lettrage, invisible avant.
- Le jeu d'exemple paie sa TVA chaque mois et porte une opération diverse.

*À VÉRIFIER avec le comptable :* les comptes de contrepartie proposés (434, 4421, 16, 471, 12) et
le fait de passer la déclaration mensuelle en une écriture au dernier jour du mois.

## 8.8.0 — 15/09/2026

**Le grand livre et la balance.** Le comptable de Skander a regardé l'application et nommé ce qui
manquait : le « mouvement de compte » et les écritures dans le journal. Cette version apporte les
deux documents qu'un cabinet tire en premier pour contrôler un dossier ; la 8.9.0 apportera le
livre-journal.

- **Comptabilité → Grand livre** : chaque compte (Clients, Banque, Ventes, TVA collectée…), ses
  mouvements un par un dans l'ordre, et le **solde qui avance** ligne après ligne. En tête, le
  **solde d'ouverture** reprend tout ce qui précède la période — depuis toujours pour les comptes de
  bilan, depuis le 1er janvier pour les charges et les produits, dont le passé est reporté au compte
  de résultat, comme le ferait une écriture d'à-nouveau. Un sélecteur choisit un compte ou un début
  de numéro (« 4 » donne tous les tiers) ; l'export CSV suit ce qui est affiché.
- **Comptabilité → Balance** : tous les comptes sur une page — ouverture, mouvements, soldes,
  chaque montant dans sa colonne (débiteur ou créditeur, jamais un signe) — et **des totaux qui
  tombent juste**, vérifiés sur les vingt-quatre mois du jeu d'exemple. Deux autres vues :
  la **balance auxiliaire clients** et la **balance auxiliaire fournisseurs**, un tiers par ligne,
  avec ce qu'il devait à l'ouverture, ce qui a été facturé et réglé, et ce qui reste.
- **Un sous-compte par tiers** (411001, 411002…, 401001…), activé d'une case dans « Plan de
  comptes… ». Le code est **figé sur la fiche** du client ou du fournisseur la première fois qu'il
  est calculé : supprimer un tiers ne renumérote jamais les autres. Décocher revient au compte
  collectif sans rien perdre.
- **Le plan comptable tunisien** (Système comptable des entreprises, 1996, plus de cent
  intitulés) nomme désormais tout compte à l'écran et dans les exports, par son plus long préfixe :
  un 627 s'appelle « Services bancaires » sans qu'on ait à le déclarer. Consultable dans « Plan de
  comptes… ». Le compte d'immobilisations proposé passe de 24 à **22** (corporelles) : le 24 du SCE
  est « à statut juridique particulier ». Un compte réglé à la main ne change pas.
- **La balance du mois part dans le paquet du cabinet** (`journaux/balance.csv`).
- Les écritures portent désormais le tiers et son rôle (client, fournisseur) : c'est ce qui rend
  possibles les balances auxiliaires, et demain le lettrage.

*À VÉRIFIER avec le comptable :* les numéros de compte restent une proposition, et le compte de
résultat qui reçoit les exercices passés (13) peut être le 12 chez certains cabinets.

## 8.7.0 — 15/09/2026

**Le pont comptable : la console vend, SkanFact facture.** Depuis la 8.5.0, une vente se fait
entière sur `api.skanfact.tn` — la clé, la vente, le mail — mais la comptabilité, elle, est dans
SkanFact. Le pont relie les deux, dans un seul sens : SkanFact **tire** les ventes de la console (un
serveur ne peut pas écrire dans un logiciel de bureau éteint), jamais l'inverse.

- **Brancher la console** : Paramètres → L'application → Éditeur → « Pont comptable ». On colle le
  secret d'administration de la console ; il est essayé tout de suite, refusé s'il est faux, et
  gardé à côté des clés de signature — jamais dans les données, jamais dans une sauvegarde, jamais
  dans un dossier partagé.
- **La page Licences** montre les ventes de la console qui n'ont pas encore de facture. Un clic crée
  un **brouillon** de facture par vente : le client est retrouvé par son matricule (quelle que soit
  la graphie) ou par son nom, créé sinon ; la ligne porte le montant HT vendu, la TVA du régime de
  la société, la remise de parrainage. Pas de numéro avant l'émission, comme pour toute facture — et
  une vente déjà tirée ne fait jamais deux brouillons.
- **À l'émission, le numéro est rendu à la console**, qui le note dans son journal ; la vente sort
  de la liste. Si la console ne répond pas à ce moment-là, la prochaine ouverture de la page
  Licences réessaie, sans un mot rouge.
- **Une licence vendue par la console** entre dans l'historique local (elle se lit, se copie, sa
  facture s'ouvre), mais ne se renouvelle ni ne se révoque ici : c'est la console qui l'a signée,
  c'est elle qui la reprend. « À faire » ne réclame pas non plus son envoi — la console l'envoie au
  paiement.
- **L'historique part une fois** : « Envoyer l'historique à la console… » transmet les licences
  émises dans SkanFact avant que la console sache vendre (clé, client, offre, dates, prix, numéro de
  facture — rien d'autre), après avoir dit ce qui partira. La console dit ce qu'elle a pris, ce
  qu'elle avait déjà, ce qu'elle a refusé et pourquoi.
- Côté service : `POST /v1/admin/importer`, `GET /v1/admin/ventes?non_facturees=1` (chaque vente
  arrive avec sa clé), et le journal note `vente.facturee`. À déployer avec cette version.

**La lecture de photo de facture est en pause.** Sans application SkanFact sur téléphone pour
prendre la photo, elle n'avait pas de vrai usage. Le réglage disparaît des Paramètres, le bouton
« Lire une photo » ne s'affiche plus, et aucune image ne part de l'ordinateur. Joindre une photo ou
un PDF comme justificatif d'un achat (8.5.1) reste là, hors ligne. Le code reste prêt pour le jour
où elle reviendra.

## 8.6.0 — 15/09/2026

**L'application reconnaît la clé du serveur.** `build/licences-publiques.json` porte désormais deux
clés de signature : la clé maître de Skander (8.0.0, inchangée au caractère près) et `srv-1`, la clé
de second rang créée dans SkanFact le 15/09/2026, avec laquelle la console (`api.skanfact.tn`)
signe les ventes courantes. Une clé émise depuis la console est donc reconnue par cette version et
les suivantes ; une version plus ancienne la refuse (« pas reconnue ») jusqu'à sa mise à jour.

Rien ne change pour une licence déjà collée : elle continue d'être vérifiée par la clé que son
contenu nomme, et une licence sans nom de clé par la maître. L'essai de 30 jours ne se rejoue pas :
la date de départ reste celle de la clé la plus ancienne.

La clé de réponse du serveur, elle, n'est toujours pas embarquée (voir 8.4.1) : une révocation
prononcée depuis la console ne s'applique pas encore chez le client.

**Un bouton de plus dans le panneau Éditeur : « Copier LICENCE_PUBLIC_KEYS (pour le service) ».**
Il donne la liste complète des clés, prête à coller dans le réglage du service. Coller la clé
`srv-1` seule — ce que l'ancien libellé laissait croire — laissait le service sans aucune clé.

## 8.5.1 — 15/09/2026

**Le justificatif se joint AVANT toute saisie.** Signalé par le père de Skander, sur sa première
facture d'achat : « Depuis une photo » exigeait un fournisseur et une ligne avant d'accepter la
photo, posait chaque fois la question « la lecture n'est pas activée, joindre quand même ? », puis
enregistrait la pièce et **repartait sur une page d'achat vide** — et la photo n'apparaissait nulle
part ensuite. Cinq défauts sur un seul bouton.

- **« Joindre un justificatif… »** est le bouton de la barre d'un achat, dès la première seconde,
  sans fournisseur ni ligne ni question. Le fichier (photo, PDF, scan) est copié tout de suite et
  se lit dans le panneau « Pièces jointes » ; il part avec l'enregistrement. Quitter la pièce sans
  l'enregistrer retire les copies — jamais l'original.
- **« Lire une photo… »** (la lecture automatique, 4.2.0) n'apparaît que si tu l'as activée dans
  les Paramètres. Sans clé, il n'avait rien à proposer que l'autre bouton ne fasse déjà.
- **Ce qu'on vient de lire ou de joindre n'est plus perdu** : l'écran se redessine avec la pièce en
  cours, au lieu de repartir d'une pièce vide.
- **Même règle sur un devis, une facture, un bon** : « + Joindre un fichier… » est là sur une pièce
  neuve, plus de « enregistre d'abord ».
- **Un trombone 📎** dans la liste des achats dit quelles pièces ont leur justificatif — et lesquelles
  n'en ont pas, ce qui est la question du comptable.

## 8.5.0 — 15/09/2026

**La console vend (P 0.2).** Sur `api.skanfact.tn`, l'éditeur crée un client, émet une licence,
la renouvelle, change son offre, la révoque, marque la vente payée et envoie la clé par mail — une
vente complète sans ouvrir SkanFact. Chaque geste est écrit dans un journal qui ne s'efface jamais.

**Une clé de second rang signe les ventes.** La console ne voit jamais la clé maître : elle signe
avec `srv-1`, une clé fabriquée sur l'ordinateur de l'éditeur (Paramètres → L'application →
Éditeur → « Créer la clé du serveur »), dont la moitié privée va dans un réglage du service et la
moitié publique dans la version suivante de SkanFact. Si le service est compromis un jour, on retire
`srv-1` sans toucher à la maître ni aux licences qu'elle a signées. Le panneau Éditeur dit à chaque
instant si la version publiée embarque cette clé — tant que non, une clé émise par la console est
refusée par les clients, et il le dit plutôt que de laisser croire qu'on peut vendre.

**Côté application, rien ne change pour un client** : une clé signée par `srv-1` se vérifie comme
les autres, par la clé que son contenu nomme, jamais par la maître en repli. Cette version
n'embarque pas encore la clé publique `srv-1` : elle viendra avec la clé de réponse, le jour de la
mise en production.

**Ce que « Révoquer » fait vraiment**, écrit en orange dans la console : la licence sort des actives
avec son motif, et l'application du client ferme la création à sa prochaine connexion. Hors ligne,
la clé continue jusqu'à sa date de fin. Une clé livrée ne se reprend pas.

Deux parcours le prouvent : `npm run e2e:console` fait tourner le vrai worker sur une vraie base
SQLite dans un vrai navigateur (le client, la clé vérifiée par `src/licence.js`, la vente payée, le
mail avec la clé dedans, le renouvellement, la révocation), et `npm run e2e:plateforme` colle une
clé émise par la console dans l'application réelle.

## 8.4.1 — 15/09/2026

**L'application connaît enfin l'adresse de la plateforme.** La 8.4.0 savait s'annoncer, mais elle a
été construite avant que l'adresse `https://api.skanfact.tn` et le secret de l'application soient
posés dans le dépôt : elle ne parlait donc à personne. Cette version est la même, reconstruite avec
les deux — l'essai et l'activation d'une installation deviennent visibles dans la console de
l'éditeur.

**Ce qui ne change pas :** la clé de réponse du serveur n'est **pas** embarquée. La paire créée le
15/09 a été écartée avant d'avoir servi (sa moitié privée a transité par un canal qui n'est pas le
sien) et sera recréée le jour de la mise en production. Tant qu'aucune clé de réponse n'est publiée,
aucune réponse du serveur ne restreint quoi que ce soit — l'application le dit dans le panneau
Éditeur, et une révocation reste inapplicable. Rien à faire côté client.

## 8.4.0 — 15/09/2026

**L'application parle au plan de contrôle — et continue de fonctionner sans lui.** C'est l'étape la
plus délicate du chantier, parce que c'est la seule qui touche une licence déjà vendue. Trois
nouveautés, et une règle qui passe avant les trois : *tout ce qui suit est facultatif*. Pas de
réseau, pas de serveur, un compte fermé, un éditeur disparu — SkanFact fonctionne exactement comme
avant, sans un mot à l'écran.

**Plusieurs clés de signature.** `build/licences-publiques.json` remplace `build/licence-public.json`
et porte une liste : la clé maître de l'éditeur (celle de la 8.0.0, au caractère près) et, demain,
celle du serveur qui signera les ventes courantes. Chacune a un identifiant, et la licence dit
laquelle l'a signée. Le jour où une clé doit être retirée, on la retire — sans invalider les
licences des autres.
**La règle qui protège tout ce qui est déjà vendu :** une licence qui ne nomme aucune clé est
vérifiée par la clé maître. Toutes celles émises depuis la 8.0.0 sont dans ce cas ; sans cette
ligne, la mise à jour les aurait invalidées d'un coup, le même matin.

**L'installation s'annonce.** Une fois par démarrage puis toutes les quatre heures, l'application
dit à la plateforme : cette clé, cet ordinateur (un identifiant tiré au hasard, déjà présent depuis
la 3.2.0), ce système, cette version. **Rien d'autre, jamais** : aucun client, aucune facture,
aucun montant, aucun chemin de dossier. Un essai s'annonce aussi, sans clé — sinon un essai ne
serait visible nulle part.

**Une révocation devient applicable**, et elle ne l'est que sur preuve. La réponse du serveur doit
être **signée** par lui, **datée** et **adressée à cette licence-là** : sans la signature, n'importe
quel intermédiaire répondrait « révoquée » à un client qui a payé ; sans le destinataire, la réponse
d'un client se rejouerait chez un autre ; sans la date, on rejouerait une vieille réponse pour
ressusciter une révocation annulée. Une réponse qu'on ne peut pas vérifier est simplement ignorée.
Et une révocation ne ferme, comme toujours, que la **création** de nouvelles pièces : lire,
imprimer, exporter, envoyer le paquet au comptable restent libres, aujourd'hui comme dans dix ans.
Le serveur ne peut jamais accorder un droit que la clé ne porte pas — il ne peut qu'ajouter une
restriction déjà prévue.

**Pour l'éditeur :** un bouton « Créer la clé de réponse » dans Paramètres → L'application →
Éditeur, qui fabrique cette paire de clés sur son ordinateur. Tant que sa moitié publique n'est pas
publiée avec une version, aucune réponse du serveur ne restreint quoi que ce soit : la mise en place
est sans danger, et le panneau le dit en toutes lettres plutôt que de laisser croire que la
révocation fonctionne déjà.

Le parcours `npm run e2e:plateforme` fait tourner **le vrai worker** — le fichier déployé sur
Cloudflare, pas une imitation — face à l'application réelle : une clé sans identifiant de clé, une
révocation signée qui ferme la création, la même avec un octet retouché, la même rejouée trois mois
plus tard, le serveur éteint, et une installation neuve qui n'a jamais vu le réseau.

## 8.3.0 — 14/09/2026

**La retenue à la source : la liste propose, elle n'enferme pas.** Signalé par le frère de Skander,
qui a essayé l'application : son client lui retient **1 %**, et la liste commençait à 1,5 %. Il n'y
avait aucun moyen de saisir le bon taux — ni dans la liste, ni à côté.

**Onze taux proposés** au lieu de six : 0,5 · 1 · 1,5 · 2,5 · 3 · 5 · 10 · 15 · 20 · 25 %, plus
« Aucune ». Ce sont ceux qu'on rencontre le plus souvent en Tunisie ; le taux qui s'applique dépend
de la nature de la prestation, du régime du client et de la loi de finances de l'année.
*À VÉRIFIER avec ton comptable : SkanFact ne devine aucun taux, il applique celui que tu poses.*

**Et surtout « Autre taux… »**, sur les six écrans qui proposent une retenue : le taux se tape à la
main, il est vérifié (un nombre entre 0 et 100, la virgule acceptée), il rejoint la liste et **il y
reste** — comme les unités de ligne depuis la 2.3.0. Une liste fermée finit toujours par enfermer
quelqu'un ; la loi de finances ajoute et retire des taux, l'application non.

**Un défaut silencieux corrigé au passage.** Trois écrans sur six — fiche client, fiche fournisseur,
éditeur d'achat — lisaient la liste à la main. Un client réglé sur un taux qui n'y figurait pas
n'avait donc **aucune option sélectionnée** : le navigateur retenait la première, « Par défaut », et
le simple fait de rouvrir sa fiche pour corriger un numéro de téléphone **changeait le montant de
ses factures**, sans un mot. Les six écrans passent désormais par la même porte.

**Une page qui se dessine en deux temps ne perdait plus ses champs.** Les Paramètres attendent le
chemin du fichier de données avant d'écrire leur écran : les branchements de fin de dessin
travaillaient donc sur la page qu'on venait de quitter. Champs date et taux libres y restaient
inertes, sans une erreur nulle part.

Aucun calcul ne change : un taux hors liste donne exactement le même résultat qu'un taux listé, et
les pièces déjà émises gardent le leur.

## 8.2.0 — 14/09/2026

**Le cycle de vie d'une licence** — ce qui se passe après l'émission, et qui ne se voyait nulle part.

**La clé est montrée dès qu'elle est signée.** « Émettre » filait droit sur la facture : le produit
que le client attend n'était sous les yeux à aucun moment, et il fallait revenir à la page Licences
pour l'envoyer. Le geste finit maintenant sur une fenêtre qui porte la clé, son offre, sa date de
fin — et les trois boutons qui suivent : **Copier**, **Envoyer par email**, **Ouvrir la facture**.
Elle rappelle aussi, en orange, qu'une facture restée en brouillon n'entre ni dans le journal ni
dans la TVA. Le menu de chaque ligne gagne « Voir la clé ».

**Changer d'offre sans repartir d'une année.** Indépendant → Entreprise en cours de route : la date
de fin **ne bouge pas**, et seule la différence de prix est facturée, **au prorata des jours
restants** — 300 DT de différence à mi-parcours d'une année donnent 149,589 DT, pas 690. Une clé
neuve est signée (l'offre est inscrite dedans, elle ne peut pas se modifier à distance) et l'ancienne
continue de fonctionner jusqu'à ce que le client colle la nouvelle.

**Corriger un matricule sans refacturer.** Le matricule voyage dans la clé signée : un client qui
corrige sa fiche société voit sa clé refusée du jour au lendemain, alors qu'il a bien fait. « Corriger
le matricule » signe une clé neuve — même offre, même date de fin, **aucune facture** : cette licence
est déjà payée.

**Révoquer, et dire la vérité.** Pour une rétractation ou un remboursement : la licence sort des
actives avec son motif et sa date, et l'application propose l'**avoir** sur la facture émise — une
facture ne se supprime pas. ⚠️ **La clé, elle, continue de fonctionner chez le client** jusqu'à sa
date de fin : SkanFact vérifie les licences *hors ligne*, sans aucun serveur, et c'est précisément
ce qui permet à tes clients de travailler sans connexion. Rien ne peut désactiver une clé à
distance, la fenêtre l'écrit noir sur blanc, et elle te dit de demander au client de la retirer.

**Trois manques d'argent remontent dans « À faire »**, chacun avec le bouton qui ouvre la bonne vue :

- *n clés de licence jamais envoyées* — le client attend, et il a peut-être déjà payé.
- *n licences dont la facture est restée en brouillon* — la vente n'existe ni pour la TVA, ni pour le
  journal, ni pour le comptable.
- *n licences livrées et pas encore payées* — le cas qui coûte, puisqu'une licence hors ligne ne se
  reprend pas.

La liste des licences gagne une colonne **Clé envoyée** (« jamais » en orange), le filtre
**Révoquées**, et l'état distingue enfin une licence *renouvelée*, dont l'*offre a changé* et dont le
*matricule a été corrigé* — trois gestes que la colonne montrait tous comme « Renouvelée ».

## 8.1.0 — 14/09/2026

**Endormir son ordinateur ne coûte plus rien.** Quand le Mac ou le PC se met en veille, l'interface
cesse de répondre — non parce qu'elle est bloquée, mais parce que **tout** est suspendu. Au réveil,
le chien de garde voyait « l'application n'a plus répondu pendant 464 secondes », concluait au gel,
et **rechargeait la page** : refermer son portable perdait le brouillon en cours, et affichait une
fenêtre d'excuses pour une panne qui n'avait jamais eu lieu.

Deux parades, et il faut les deux : l'application écoute maintenant la mise en veille du système, et
elle mesure le temps **réellement** écoulé entre deux battements — un battement qui en a sauté vingt
dit que l'ordinateur dormait, jamais que l'interface était bloquée. Corrigé dans les deux
applications. *(La parade existait à moitié dans SkanFact Cabinet depuis la 6.8.1 et n'avait jamais
été portée ici.)*

**Proposer une amélioration.** À côté de « Signaler un problème », dans l'Aide et dans les
Paramètres des deux applications. L'application savait recevoir ce qui ne marche pas et n'avait
aucune porte pour ce qui manque. Deux questions : ce que tu aimerais faire, et comment tu fais
aujourd'hui — c'est la seconde qui apprend le plus, parce qu'on propose toujours une solution et
que la solution imaginée est rarement la meilleure. **Ni journal technique, ni donnée d'entreprise**
ne partent avec : seule la version, pour pouvoir répondre que la chose existe déjà.

**L'empreinte d'un cabinet se vérifie** (module Éditeur). Un bouton **Vérifier** à côté du champ :
il contrôle la forme — vingt caractères, chiffres et lettres A à F — et dit si ce cabinet a déjà
parrainé quelqu'un. Il ne prétend rien de plus : SkanFact ne peut pas prouver d'ici qu'un cabinet
existe, il faudrait sa clé publique, et l'écran l'écrit au lieu d'afficher un vert rassurant. La
saisie est tolérante (minuscules, espaces, tirets oubliés) ; ce qui est enregistré est toujours la
même forme, donc deux saisies du même cabinet ne peuvent plus donner deux empreintes différentes.

**Une prestation de licence se crée sans quitter la fenêtre.** Le formulaire d'émission proposait de
choisir une prestation du catalogue mais pas d'en créer une : au premier jour, l'éditeur retapait
donc son prix de mémoire, à chaque licence, dans un champ vide. L'entrée **« + Nouvelle prestation »**
rejoint le « + Nouveau client » qui existait juste au-dessus ; une fois la prestation créée, le prix
et la TVA viennent d'elle.

Au passage : `mono` était posé sur l'empreinte du cabinet depuis la 6.2.0 et n'a **jamais** été
défini dans la feuille de style. Elle s'affichait dans la police du texte, à l'endroit précis où une
chasse fixe sert à distinguer un `0` d'un `O`.

## 8.0.1 — 14/09/2026

**L'essai se voit sans ouvrir les Paramètres.** Jusqu'ici, la pastille de la barre de gauche
n'apparaissait qu'à sept jours de la fin : pendant vingt-trois jours, une installation neuve
n'affichait **nulle part** qu'elle était en période d'essai — ni même que SkanFact se paie. Quelqu'un
qui passe l'assistant de première utilisation et n'ouvre jamais Paramètres → L'application → Licence
l'apprenait le trente-et-unième matin, en se retrouvant bloqué. Un essai dont personne ne sait qu'il
court n'est pas un essai, c'est une surprise.

La pastille est donc là **dès le premier jour**, sous le menu, cliquable — et elle change de ton
plutôt que de crier tous les matins :

- **Essai — 27 jours** : gris discret, à peine plus marqué que le numéro de version.
- **Essai — 5 jours avant la fin** : orange, parce qu'il faut agir. (C'était jusqu'ici la couleur
  d'une bonne nouvelle.)
- **Licence active jusqu'au … — pense à la renouveler** : orange, deux semaines avant l'échéance.
- **Période d'essai terminée — voir Paramètres → L'application → Licence** : orange, avec la sortie.

Rien ne s'affiche quand il n'y a rien à dire : une licence à vie, une application non armée, le poste
de l'éditeur.

Sous le capot, la décision (afficher ou non, quel ton, quelle phrase) est passée dans `core.js` :
elle se teste sur de vraies valeurs, sans lancer l'application. L'assertion de `e2e:licence` qui
exigeait l'ABSENCE de la pastille à trente jours a été **retournée**, pas supprimée — elle décrivait
l'état du jour au lieu de la règle.

## 8.0.0 — 14/09/2026

**La licence est armée.** À partir de cette version, SkanFact embarque la clé publique de son
éditeur : chaque installation dispose de **30 jours d'essai complets**, comptés à partir du jour où
elle ouvre la 8.0.0 — pas du premier lancement, donc une installation ancienne repart pour trente
jours entiers — puis attend une clé de licence.

### Ce que ça change pour toi

- **Pendant l'essai, rien ne change** : tout est ouvert, exactement comme avant. Une semaine avant la
  fin, un bandeau te prévient dans la barre de gauche.
- **Après l'essai, tes données restent à toi.** Tout ce qui existe reste lisible, imprimable et
  exportable, le paquet du comptable part toujours, les sauvegardes continuent. Seule la **création
  de nouvelles pièces** attend ta clé.
- **Demander une clé** : Paramètres → L'application → Licence → « Demander une licence » prépare le
  message avec ta raison sociale et ton matricule (et l'empreinte de ton cabinet s'il utilise
  SkanFact Cabinet : elle donne droit à la remise de parrainage). Tu reçois une clé `SKAN1.…`, tu la
  colles au même endroit, c'est tout — aucune connexion, aucun compte à créer.
- **Deux offres**, portées par la clé : *Indépendant* (devis, factures, relances, contrats, TVA,
  dossier du comptable) et *Entreprise* (tout, plus Achats, Stock, Immobilisations, Trésorerie et
  marges, Paie, dossier partagé à deux). En Indépendant, les modules Entreprise restent lisibles ;
  seule la création y attend l'offre du dessus.

### Pour l'éditeur

- **Celui qui signe n'achète pas.** Le poste qui détient la clé privée de signature — et seulement
  si elle correspond à la clé embarquée — est en état « éditeur » : ni essai, ni verrou. Sans cette
  règle, l'éditeur se serait retrouvé verrouillé chez lui le trente-et-unième jour, avec une clé
  qu'il ne peut s'émettre qu'en se déclarant client de lui-même. Une clé collée sur ce poste
  reprend le dessus : c'est ainsi qu'il voit exactement ce que voit un client, et « Retirer la clé »
  le ramène à son état.
- La porte « Tu édites SkanFact ? Créer mes clés » a disparu : elle n'existait que sur une
  application non armée.
- Les demandes de licence et les signalements de problème partent vers **contact@skanfact.tn**,
  l'adresse du domaine SkanFact.
- Une licence payante qui se termine est annoncée dans la barre de gauche deux semaines avant, et
  l'état de la licence se relit toutes les heures et au retour au premier plan : un essai qui finit
  pendant que l'application est ouverte se voit sans la relancer.

### Ce que la relecture adversariale a trouvé avant la publication

- Le passe-droit de l'éditeur pouvait s'obtenir sans la clé privée, en copiant la clé publique de
  SkanFact dans le fichier public à côté d'un `.pem` quelconque : la clé publique de l'éditeur est
  désormais **déduite de la privée**, jamais lue dans un fichier.
- Le relais de mise à jour refusait (403) toute application qui présente une vraie clé de licence
  tant qu'il n'a pas la clé publique configurée — c'est-à-dire chaque client qui a **payé**, dès
  la 8.0.0. Sans clé publique, le relais laisse passer ; avec, il vérifie.
- Le repli vers GitHub gardait les en-têtes du relais (secret de l'application, clé de licence) :
  ils sont retirés avant de changer de flux.
- « SkanFact n'envoie jamais ta clé nulle part » était faux : elle est présentée au service de mise
  à jour. La phrase le dit maintenant.
- « Retirer la clé » ressuscitait une clé héritée de la 6.4.0 ; le message après le retrait
  annonçait « Licence enregistrée ».
- La date de début d'essai est doublée dans le dossier de l'entreprise : effacer le fichier de
  réglages de l'ordinateur en gardant ses données ne rejoue plus l'essai.

### Sous le capot

- Le paquet a été **ouvert et vérifié** : `build/licence-public.json` est bien dans `app.asar`
  (avant la 7.33.0, `build/` n'entrait pas dans le paquet et l'application installée serait restée
  libre quoi qu'on commite).
- Le test qui exigeait l'ABSENCE de la clé publique est retourné : il exige désormais sa présence,
  qu'elle soit une vraie clé Ed25519, et qu'une licence signée par n'importe quelle autre clé
  privée soit refusée avec elle.
- `npm run e2e:licence` ouvre désormais **deux** applications : la première désarmée
  (`SKANFACT_CLE_EMBARQUEE`, honoré en développement seulement) pour créer ses propres clés
  d'essai ; la seconde telle qu'un client l'installe — essai de 30 jours, aucune trace de
  l'éditeur, et la clé signée par la clé d'essai du test **refusée**.

## 7.33.0 — 14/09/2026

**SkanFact sait maintenant se vendre : deux offres portées par la clé de licence, et un module
Éditeur qui émet la clé, fait la facture et tient l'historique — depuis SkanFact lui-même.**

Rien n'est armé dans cette version : la licence reste libre pour tout le monde tant que la clé
publique de l'éditeur n'est pas embarquée. Ce qui change, c'est que tout est prêt pour le jour où
elle le sera.

### Les offres

La clé de licence porte désormais l'**offre** — *Indépendant* ou *Entreprise* — et un client ne peut
pas se la changer : elle est dans la signature. En Indépendant, les modules **Achats, Stock,
Immobilisations, Trésorerie et marges, Paie** et le **dossier partagé à deux** portent un cadenas
dans le menu et un bandeau en tête de page : **tout ce qui y existe reste lisible, imprimable et
exportable**, seule la création de nouvelles pièces y attend l'offre Entreprise. Les Statistiques
restent ouvertes (elles ne créent rien). Pendant l'essai, tout est ouvert.

La clé est aussi **attachée au matricule fiscal** : émise pour Trabelsi, elle ne s'active pas sur le
dossier d'une autre société, et le refus nomme les deux matricules. Un dossier sans matricule saisi
n'est pas puni.

La durée est libre à l'émission — 1, 3, 6 mois, 1 ou 2 ans, **à vie**, ou une date précise — et un
mois de licence est un mois du calendrier (« 1 an » finit le même jour l'an prochain).

**L'essai de 30 jours compte à partir du jour où la licence est armée**, pas du premier lancement.
Sans ça, toute installation de plus de trente jours se serait verrouillée à la minute même de la mise
à jour qui l'arme — chez toute ta famille.

### Le module Éditeur

Il n'apparaît que sur l'ordinateur où vit ta clé privée de signature — jamais chez un client.

- **Créer mes clés** (Paramètres → L'application → Licence) : la clé privée est écrite dans un
  fichier protégé, hors de tes données, de tes sauvegardes et du paquet du comptable ; la clé
  publique se copie d'un clic pour être embarquée dans la prochaine version. Une copie de la clé
  privée s'enregistre où tu veux (clé USB, gestionnaire de mots de passe) — et on te le demande
  tout de suite, parce que sans elle aucun renouvellement n'est plus possible.
- **Émettre une licence** (page **Licences**, ou Cmd+K) : le client, l'offre, la durée, la
  prestation de ton catalogue (c'est là que vit le prix, jamais dans le code), le parrainage d'un
  cabinet avec sa remise. Un clic : la clé est signée dans le processus principal (elle ne traverse
  jamais l'écran), un **brouillon de facture** est créé dans tes ventes avec la bonne ligne, et
  l'historique garde tout. Tu relis la facture, tu l'émets, comme d'habitude.
- **Envoyer la clé par email** : la clé, la marche à suivre, et la facture en PDF une fois émise.
  Nouveau modèle de message « Envoi d'une clé de licence », modifiable dans Paramètres → Envois.
- **Renouveler** : une nouvelle clé et une nouvelle facture en un clic, préremplies ; l'ancienne
  reste valable jusqu'à sa date et sort du compte des choses à faire.
- **« À faire »** te dit « n licences expirent dans les 30 jours » — comme il te dit tes relances.

Pourquoi pas un programme à part ? Parce qu'une vente de licence est une facture comme une autre :
elle doit entrer dans ton journal des ventes, ta TVA collectée et le dossier de ton comptable. Un
programme séparé aurait refait la facturation et laissé ta comptabilité fausse.

### Ce qui a été trouvé en chemin

- **`build/licence-public.json` n'était pas embarqué dans l'application construite** : `build/` ne
  faisait pas partie des fichiers du paquet. La licence n'aurait jamais pu se verrouiller ailleurs
  qu'en développement. Corrigé.
- **Deux créations échappaient au garde-fou de la licence** depuis la 6.4.0 : « Dupliquer » un achat
  et « Établir n bulletins ». Le test de l'époque exigeait « au moins quatre » garde-fous et n'a
  jamais pu voir le trou ; il exige maintenant chaque point de création, un par un.
- **La clé de licence vit maintenant dans le dossier de l'entreprise**, plus au niveau de
  l'ordinateur : un même Mac ouvre plusieurs entreprises (la tienne et Darium), et une clé émise
  pour l'une aurait verrouillé l'autre. Un dossier partagé emporte sa clé avec lui.
- Une phrase de l'assistant de licence nommait un onglet qui n'existe plus.

Une relecture adversariale (sept angles, chaque constat contredit) a ensuite trouvé quatorze défauts
dans ce qui venait d'être écrit, tous corrigés avant publication — les trois qui comptent : un
**renouvellement repartait d'aujourd'hui** et reprenait au client les trente jours de préavis déjà
payés (il part maintenant de la fin de la licence en cours) ; une **licence expirée barrait le
partage d'un dossier**, qui n'est pas une création ; et l'essai comptait depuis la fabrication de
la clé plutôt que depuis le jour où la version armée arrive **sur ce poste**.

Tests : 329, chaque nouvelle assertion prouvée en réintroduisant son défaut. Nouveau parcours
`npm run e2e:licence` : les clés, l'émission, la facture, l'offre Indépendant qui refuse un
fournisseur mais pas les Statistiques, la clé d'un autre matricule refusée, le renouvellement, et
rien de ce qui traverse le pont ne contient la clé privée.

## 7.32.0 — 14/09/2026

**L'application du comptable range ses Réglages en trois onglets, comme la tienne — et l'alerte la
plus importante de toute l'application sort enfin de sa cachette.**

### Les onglets

Mêmes noms que dans ton SkanFact, pour qu'un comptable qui ouvre l'application d'un client
retrouve le même rangement : **Mon cabinet**, **Données et sécurité**, **L'application**.

Mesuré avant et après (`npm run e2e:parametres`) : la page faisait 2,6 écrans d'un seul tenant ;
les trois onglets font **0,8 · 1 · 0,7 écran**. Au passage, « Signaler un problème » a quitté le
panneau Sécurité — il n'y avait rien à faire — pour un panneau **Aide et dépannage** à lui.

Le sommaire et la recherche, qui existaient déjà, se limitent maintenant à l'onglet ouvert et disent
dans quel onglet se trouve ce qu'on cherche. Cmd+K mène au **panneau** visé, pas en haut d'une page :
taper « clé de secours » ouvre le bon onglet et amène le bon panneau.

### Et la vraie trouvaille

En regardant où mettre quoi, un défaut est apparu : **« ⚠ Tu n'as jamais enregistré de clé de
secours » n'existait qu'à un seul endroit**, au milieu du panneau Sécurité, à un écran et demi de
défilement. Ce n'était pas dans « À faire ». Or c'est le seul manque irréparable de cette
application : sans cette clé, si le poste du comptable lâche, **aucun paquet déjà reçu ne peut plus
jamais être ouvert**, et tous ses clients doivent refaire leur appairage.

Des onglets l'auraient enterré encore plus profond. Donc :

- un **bandeau rouge au-dessus des onglets**, qui ne peut se cacher derrière aucun clic, avec son
  bouton — et il disparaît le jour où la clé est enregistrée ;
- le même bandeau sur la page **Dossiers**, y compris quand il n'y a encore aucun client : c'est
  justement le premier jour que l'alerte compte le plus, et cet écran-là n'affichait rien ;
- une ligne **en tête de « À faire »**, avant tout le reste.

### Trois autres défauts corrigés en chemin

- **Chaque ligne de « À faire » mène maintenant à sa page.** Les cinq portaient le même lien en dur
  vers les Relances : « une échéance approche » y envoyait aussi, alors que sa page est Échéances.
- **Restaurer une clé de secours compte comme en avoir une.** Après un changement d'ordinateur,
  l'application reprochait sa clé à quelqu'un qui venait très exactement de la restaurer depuis sa
  clé USB.
- Une phrase de l'assistant renvoyait à « Réglages → Sécurité », un onglet qui n'avait jamais
  existé. Un test générique vérifie désormais que **chaque chemin « Réglages → … » nomme un onglet
  réel**, dans les trois fichiers de l'application cabinet.

## 7.31.0 — 14/09/2026

**Un devis long tient enfin la route : de vraies pages A4, chacune avec son pied de page numéroté,
son bandeau de rappel et ses en-têtes de colonnes — et un document de huit lignes qui ne part plus
sur une deuxième page pour rien.**

### Ce qui n'allait pas

Sur ta capture, un devis de neuf lignes faisait deux pages : la première sans aucune mention légale,
la seconde vide aux trois quarts. Et sur **toutes** les pièces de plus d'une page, le pied de page
s'imprimait **par-dessus les cases de signature** — « Date, signature et cachet du client » barré
d'un trait et du matricule fiscal.

La cause : le document était **un seul long bloc** que le navigateur coupait où il pouvait. Le pied
de page, posé à la fin de ce bloc, atterrissait donc à la fin du contenu — pas en bas d'une feuille.
Mesuré pour de vrai (chromium + impression PDF) avant d'y toucher : le défaut était là depuis la
première version, sur les sept types de documents, en français comme en anglais.

### Ce qui change

- **Une vraie page par feuille.** Le document est découpé en pages A4 avant l'impression. Chaque
  feuille porte son pied de page complet — mentions légales, numéro du document, et **« page 2
  sur 3 »**.
- **Un bandeau de rappel** en tête des pages suivantes : le document et le client, pour qu'une
  feuille lue seule reste identifiable.
- **L'en-tête des colonnes revient** sur chaque page qui porte des lignes.
- **Plus rien ne se coupe au mauvais endroit** : une ligne, un bloc de totaux, une case de
  signature, une clause de contrat descendent entiers plutôt que d'être tranchés.
- **Le resserrement ne sert plus à rien pour rien.** Jusqu'ici, dès qu'un document dépassait, les
  marges se resserraient — même quand ça ne faisait gagner aucune page. Désormais on essaie deux
  crans de resserrement et on ne garde que celui qui fait **vraiment** gagner une feuille. Effet
  visible : un devis de **huit lignes tient maintenant sur une seule page** (il en prenait deux), et
  un devis de douze lignes garde son interligne confortable au lieu d'être tassé pour rien.
- **De longues notes ne cassent plus rien** : elles se répartissent sur plusieurs pages au lieu de
  passer sous le pied de page.
- **L'aperçu montre exactement ce que montrera le PDF** — même découpage, mêmes pages numérotées.

### Le filet

Si un document sort du cadre prévu, la mise en page est abandonnée et on rend la main au navigateur :
mieux vaut l'ancien découpage qu'une ligne invisible sur une facture. Un nouveau test,
`npm run e2e:pages`, imprime **161 documents** (sept types, six variantes, de 1 à 40 lignes) et
vérifie sur chacun qu'aucune ligne n'a disparu, qu'aucune page ne déborde, qu'aucun pied ne
chevauche le contenu et que chaque page fabriquée fait bien une feuille.

## 7.30.0 — 14/09/2026

**Les Paramètres, refaits dans les deux applications : cinq onglets au lieu de huit, un sommaire, une
recherche — et des mises à jour qui vérifient toutes seules et disent depuis quand.**

### Ce qui n'allait pas, mesuré

`npm run e2e:parametres` a mesuré la page avant d'y toucher : huit onglets d'un déséquilibre de 1 à
12. « Licence » et « Cabinet comptable » pesaient un cinquième d'écran chacun — une phrase, parfois
une phrase disant qu'il n'y a rien à faire — pendant que « Sécurité et données » en faisait deux,
avec huit panneaux et dix-huit boutons. Ce dernier était devenu le fourre-tout : il portait aussi
« Choisir les modules affichés » et « Revoir l'assistant de démarrage », qui ne sont ni de la
sécurité ni des données. La lecture de photo de facture, elle, vivait sous « Mises à jour ». Et
soixante réglages, sans aucun moyen d'en chercher un.

### Cinq onglets, un sommaire, une recherche

- **Mon entreprise** : identité · régime fiscal et TVA · coordonnées bancaires.
- **Documents** : règles de facturation · image de marque · textes imprimés · objectifs.
- **Envois** : messagerie · ton comptable · modèles de messages · ton cabinet comptable.
- **Données et sécurité** : dossiers · sauvegardes · copie externe · mot de passe · lecture de
  factures · exemple · zone sensible.
- **L'application** : apparence · modules affichés · mises à jour · licence · aide et dépannage.

Le **sommaire** montre d'un coup ce que l'onglet ouvert contient et emmène au panneau. La
**recherche** répond quand on ne sait même pas dans quel onglet regarder : elle lit les titres, les
libellés de champs et jusqu'aux phrases d'explication, et dit toujours dans quel onglet le réglage
se trouve. Les deux se déduisent de l'écran : un panneau ajouté demain est trouvable le jour où il
est écrit. La mécanique vit dans `src/renderer/reglages.js`, chargée par **les deux applications**.

L'app du cabinet garde sa page unique — deux écrans et demi, qu'un comptable ouvre deux fois — mais
reçoit le même sommaire et la même recherche, et sa **boîte de réception** sort du panneau des
sauvegardes : c'est la porte par laquelle les paquets arrivent, pas un filet.

### Les mises à jour vérifient toutes seules, et disent depuis quand

Jusqu'ici, SkanFact vérifiait **une fois**, cinq secondes après l'ouverture, et plus jamais : une
correction publiée le mardi n'arrivait pas avant le lundi suivant chez quelqu'un qui ne quitte pas
l'application. Elle regarde désormais **toutes les quatre heures** et au retour sur l'application,
et l'écran affiche **quand la dernière vérification a eu lieu** — sans quoi « tu as la dernière
version » pouvait dater d'un mois. L'état au repos ne montre plus un bouton nu : il répond avec ce
que la dernière vérification a constaté.

Et un téléchargement qui échoue ne fige plus l'écran : la panne était **avalée** (la vérification
du démarrage est silencieuse), la barre de progression restait bloquée à 40 %, et aucun bouton
n'était proposé. La panne se dit, et « Relancer le téléchargement » existe. Dans les deux
applications.

### Les huit défauts que l'audit a trouvés, corrigés

- **Rejouer l'assistant écrasait le régime fiscal.** C'est le seul endroit où l'on puisse changer de
  métier ; le drapeau qui protège un choix fait à la main n'était pas réamorçé au rejeu. Un
  forfaitaire qui re-cliquait son propre métier repartait au réel et se remettait à facturer 19 %.
- **La devise était un champ de texte libre** alors que toute l'application n'accepte que sept
  codes. « TND », « dinar » ou une faute de frappe faisaient passer toutes les factures à deux
  décimales au lieu de trois. Liste fermée, et ce qui a déjà été tapé se rattrape.
- **Activer un mot de passe jetait la saisie en cours** des Paramètres, sans un mot.
- **Activer un mot de passe laissait les sauvegardes en clair sur la clé USB**, pour toujours,
  pendant que l'écran annonçait qu'elles étaient chiffrées. La copie externe se rechiffre.
- **Un refus d'écriture était ignoré** : sur un dossier partagé, l'écran annonçait « Données
  chiffrées » alors que rien n'avait été écrit, et le fichier réclamait ensuite l'ancien mot de
  passe pendant que les sauvegardes réclamaient le nouveau.
- **Cabinet : un jour de dépôt hors bornes était refusé en silence**, avec un « ✓ enregistré » vert
  et la valeur refusée sous les yeux.
- **Cmd+K ne trouvait plus un seul réglage** — régression de cette refonte, attrapée par l'audit :
  les six alias nommaient les anciens onglets. Les entrées sont maintenant engendrées **panneau par
  panneau** : « mot de passe » mène au panneau du mot de passe, pas en haut d'un onglet.
- **Onze phrases envoyaient vers un onglet disparu.** Un test générique l'interdit désormais.

### Trois écrans qui n'écoutaient pas

- La fiche d'affaire affichait huit en-têtes triables sur « Ventes rattachées » : le clic était
  accepté, et rien ne se triait.
- Une échéance fiscale marquée déposée par erreur n'était plus **nulle part** passé les huit
  secondes du bandeau « Annuler ». Un panneau « Déjà déposées » la rend.
- La page Stock gardait ses alertes en mémoire : après un inventaire, l'onglet continuait
  d'annoncer les articles qu'on venait de réapprovisionner.

### Le thème sombre : tous les champs de saisie étaient illisibles

Trouvé en regardant une capture de cette version, puis **mesuré** : en thème sombre, chaque
`<input>` de l'application gardait son fond clair avec le texte clair du thème. Contraste **1,18** —
du blanc sur du blanc. Les zones de texte et les listes déroulantes, elles, étaient correctes, ce
qui rendait l'écran à moitié juste et donc difficile à mettre en cause. La cause : une règle de
thème sombre qui PERDAIT en spécificité contre la règle commune des champs, sans que rien ne le
signale. Le défaut existait depuis que le thème sombre existe (1.6.0).

`npm run e2e:contraste` mesure désormais les champs autant que les boutons — 455 éléments par
écran au lieu de 421.

### Et le français

Quatre-vingt-dix « 1 facture(s) » ont disparu des deux applications et de leur logique partagée —
dans « À faire », dans le paquet du comptable, dans les Paramètres (« 51 document(s) »). La règle
existait dans l'app du cabinet depuis sa 1.0.0 et n'avait été portée qu'à un seul écran. Un test
interdit la forme.

## 7.29.0 — 14/09/2026

**Le bouton s'appelle « Actions », il se referme quand on rappuie dessus, et chaque geste a son
dessin. Dans les deux applications.**

### Le bouton qui ne se refermait pas

« Quand j'appuie sur les trois points et que je rappuie dessus, ça ne la ferme pas, ça la rouvre. »

C'était exact, et invisible autrement qu'en essayant : deux garde-fous se marchaient dessus. Celui
de l'application refermait le menu au moment où le doigt touche le bouton, puis le clic — qui arrive
juste après — le rouvrait. Le menu clignotait et restait ouvert. **Un bouton qui ne fait pas le
contraire de ce qu'il vient de faire n'est pas un interrupteur.**

Il ouvre, il referme, il rouvre. Et il se parcourt au clavier : les flèches passent d'une action à
l'autre, Échap referme.

### « ⋮ » devient « Actions »

Trois points ne se lisent que si on connaît déjà la convention. Le bouton porte maintenant le mot,
et le chevron qui annonce qu'il ouvre sur un choix.

Chaque action du menu porte son **dessin** — le même trait que les icônes de la barre latérale.
Elles accompagnent le libellé, elles ne le remplacent jamais : c'est le pictogramme SEUL qui avait
rendu les anciennes rangées de boutons illisibles.

Et **une action unique ne se cache plus derrière un menu** : le bouton la nomme et l'exécute.
Ouvrir une liste pour un choix unique, c'est un clic et une lecture de plus pour rien.

### Les listes qui étaient restées en arrière

Le **Catalogue** alignait « Fiche stock » et « Modifier » collés l'un à l'autre — deux boutons que
rien ne séparait, parce que le gabarit comptait sur une espace qui n'y était pas. La **Facturation
récurrente** en alignait trois. Les deux passent au menu, avec les **Modèles de documents** et les
**Textes prédéfinis**. Au passage, une prestation se **duplique** : une variante (« Audit 1 jour »,
« Audit 2 jours ») se saisissait en recopiant sept champs à la main.

### L'application du comptable avait le même défaut, en pire

Chaque ligne de l'historique des paquets portait **cinq boutons fantômes**, dont un « ✕ » muet qui
**efface un paquet reçu**. Le geste le plus destructif de l'application était le seul sans nom.

Les deux applications partagent désormais le même menu (`src/renderer/rowmenu.js`), comme elles
partagent déjà leur feuille de style. Le recopier aurait garanti la divergence : la table d'icônes
de l'une aurait un jour un dessin que l'autre n'a pas. Sur la page Relances, « Écrire » reste le
seul bouton visible — c'est le geste pour lequel cette page existe.

### Deux libellés qui ne disaient pas la vérité

Dans **Immobilisations → À immobiliser**, « Voir l'achat » promettait une consultation et ouvrait
l'éditeur. Un achat n'a pas de fiche en lecture seule — contrairement à une facture émise, qui est
verrouillée — donc le bouton doit le dire : « Ouvrir la facture d'achat ». Et « Créer la fiche »
est devenu « Créer la fiche du bien », parce que c'est la fiche de l'immobilisation, pas celle de
l'achat.

### Ce qu'un audit a trouvé autour du menu

**Une seconde facture entière, sans un mot.** Le menu d'une ligne proposait « Facturer ce devis » sur
un devis **déjà facturé** — parce que facturer le fait passer en « accepté », donc la condition
d'affichage restait vraie — et un second clic fabriquait une facture complète de plus. L'éditeur,
lui, se gardait de ça depuis la 7.16.0 : la question était posée sur **son** bouton, pas dans le
geste. Un garde-fou chez l'appelant ne protège que cet appelant. Il vit désormais dans le geste
lui-même, et le menu propose ce qui vient ensuite : **« Voir FAC-… »**, avec « Refacturer la
totalité… » en rouge, derrière la question qui nomme la facture qui existe déjà.

**Une prévision de trésorerie qui inventait un creux.** Les factures clients étaient converties, les
contrats récurrents non : un abonnement de 800 € entrait dans la courbe pour 800 DT. Sur la page
faite pour savoir si l'on tiendra le mois, un creux inventé vaut un vrai creux manqué.

**« Attestation reçue » cochait la case et quittait la page** : le clic sur le bouton traversait
jusqu'à la ligne, qui ouvre la facture. On ne voyait jamais que c'était noté.

**⌘K laissait les menus ouverts derrière elle.** La palette vit sous eux : un menu d'actions ou le
sélecteur d'entreprise restait dessiné par-dessus son fond flouté, puis volait le premier Échap — on
croyait fermer la palette, on fermait le menu, et le champ de recherche perdait le focus au passage.

**Les entrées « Page → Onglet » de la palette étaient inertes depuis la page visée.** Choisir
« Comptabilité → Clôtures » depuis la Comptabilité posait l'onglet et ne redessinait rien.

### Un test qui dormait depuis sept versions

`e2e:boucle` — le parcours qui prouve la chaîne entreprise → paquet → cabinet, le plus important du
projet — était **cassé depuis la 7.22.0**. Il traversait l'assistant de première utilisation en
comptant les « Suivant » ; l'écran du régime fiscal s'est inséré au milieu, et il attendait depuis
un champ qui n'arrivait jamais. Personne ne s'en était aperçu : il n'avait pas été relancé. Il
reconnaît maintenant chaque écran à ce qu'il contient. Et il restait un second blocage, celui-là
depuis la **7.6.0** : fabriquer un paquet depuis le jeu d'exemple pose une question à trois sorties,
et le test n'en connaissait qu'une. Il tourne de nouveau de bout en bout — **0 erreur**.

Un défaut trouvé en le réparant : le menu d'une ligne s'ouvrait puis **disparaissait dans la
milliseconde**, sur un événement de défilement en retard — celui qui avait amené le bouton à l'écran
juste avant le clic. On croyait avoir mal cliqué. Le menu ne se ferme plus que si la page a
vraiment bougé.

## 7.28.0 — 14/09/2026

**Partager l'entreprise qu'on a déjà saisie. Une seule porte par ligne. Et l'aide du cabinet.**

### Partager un dossier à deux — pour de vrai

« Je viens de faire mon vrai dossier entreprise, je veux le partager avec mon père. Quand je fais
*dossier partagé à deux*, ça me recrée une autre entreprise. »

C'était exact, et pire que ça : le bouton fabriquait un dossier **vide**. On venait de saisir sa
société, ses clients et ses factures, on cliquait pour les partager, et on tombait sur l'assistant
de première utilisation. De l'autre côté, aucun moyen de **rejoindre** le dossier déjà posé : il
fallait retomber par hasard sur le même chemin en retapant exactement le même nom. Le travail à deux
n'était donc utilisable que par quelqu'un qui n'avait encore rien saisi — c'est-à-dire personne.

Deux gestes, dans Paramètres → Sécurité et données et dans le menu du haut de la barre de gauche :

- **Partager ce dossier à deux…** prend l'entreprise ouverte, avec ses documents, ses achats, ses
  sauvegardes et ses pièces jointes, et la **copie** dans iCloud Drive, OneDrive, un disque réseau
  ou une clé USB. La copie d'origine reste sur l'ordinateur, au cas où, et la bascule n'a lieu
  qu'une fois la copie constatée.
- **Rejoindre un dossier déjà partagé…** sert sur le second ordinateur : il ouvre ce dossier-là,
  sans rien créer ni renommer. Pas d'assistant, pas de nom d'entreprise à retaper. Et si on désigne
  le dossier parent par erreur — ce qu'on fait la première fois — l'application retrouve le bon
  toute seule tant qu'il n'y a pas d'ambiguïté.

L'article d'aide « Travailler à deux » décrit maintenant la marche à suivre, dans l'ordre.

### Les listes : un menu, et une question avant d'agir

« Dans les listes je n'aime pas les boutons en fin de ligne, faut faire une liste où on choisit
dedans, un truc plus pro. Et il manque la confirmation : quand j'appuie sur un devis accepté ou
refusé, ça ne me demande pas de confirmer, ça ne me redirige pas, et ça ne m'indique pas. »

Chaque ligne de Devis, Factures, Clients, Fournisseurs, Achats et Relances finit désormais par
**un seul bouton**, qui ouvre un menu d'actions **écrites en toutes lettres**, chacune avec son
explication. Fini les rangées de cinq boutons qui se disputaient la place et tombaient dans des
pictogrammes muets (« ⧉ », « ⏱ ») dès qu'ils étaient trop nombreux.

Et répondre à un devis **demande, annonce, et propose la suite** :

- *Le client a accepté* ouvre une fenêtre qui rappelle le devis, le client et le montant, avec deux
  sorties : **Accepter et facturer** — qui crée le brouillon de facture et l'ouvre — ou *Accepter
  seulement*. C'est la redirection qui manquait : ce qui vient après un devis accepté, c'est la
  facture.
- *Le client a refusé* demande confirmation, et dit ce que ça change.
- Dans les deux cas, un « Annuler » reste sous la main pendant huit secondes.

### Un défaut trouvé en chemin : la fenêtre qui réclamait toujours

Une fois qu'on avait modifié quoi que ce soit dans la session, fermer la fenêtre posait **pour
toujours** la question « des modifications ne sont pas enregistrées » — même après avoir tout
enregistré, et même depuis l'accueil. L'écran avait bien lâché son garde-fou, mais il oubliait de le
redire au processus principal, qui est celui qui pose la question. Une application qui annonce une
perte qui n'existe pas apprend à cliquer sans lire.

### L'aide de l'application du comptable

Elle était restée une seule page où les huit articles se suivaient, dépliés, sur cinq écrans de
prose grise — sans sous-titres, sans recherche, et sans un seul lien vers l'application. C'est
pourtant le premier contact d'un comptable avec SkanFact. Elle a le même plan coloré que celle de
l'app entreprise : huit cartes qui annoncent ce qu'elles contiennent, une recherche qui traverse le
corps des articles, et un article qui dit d'où il vient et où il mène.

## 7.27.0 — 14/09/2026

**L'Aide : un plan coloré, un fil qui tient sur une ligne, et un sommaire.**

La 7.23.0 avait remplacé la liste plate de trente-deux titres par sept cartes : on choisit un
territoire avant de choisir un titre. Les captures ont montré ce que la relecture du code ne
montrait pas.

**Le fil d'Ariane s'affichait à la verticale, centré au milieu de l'écran**, en tête de chaque
article, depuis la 7.23.0. `Aide` puis `Vendre et facturer` puis le titre, l'un sous l'autre, sur
cinq lignes et cent pixels de haut. La cause : le fil était un `<nav>`, et la règle qui range la
barre latérale en colonne — posée sur l'élément, pas sur une classe — l'emportait sur la sienne.
Rien en console, aucun test de calcul ne pouvait le voir. Corrigé, et le test le **mesure**
désormais dans l'application réelle.

**« Article suivant » vivait à l'extrémité droite de la page**, deux cent cinquante pixels à côté de
la colonne de l'article qu'il prolonge. Il est rentré dedans.

**Ouvrir un thème redessinait la liste des sept thèmes juste en dessous**, celui qu'on venait
d'ouvrir compris, sans état actif ni moyen de refermer. Il n'y a plus de duplication : l'accueil est
un **plan**, avec une pastille colorée par domaine et **les trente-deux articles visibles d'un
coup**, rangés par territoire. Une pastille descend à sa section et la marque. Un plan montre le
territoire ; il ne le cache pas derrière un clic qui ne promet qu'un nombre.

**Chaque domaine a sa couleur et son dessin** — en clair comme en sombre. Sept cartes grises
identiques ne distinguaient pas « Ton équipe » d'« Encaisser ».

**Les articles longs ont un sommaire.** Onze intertitres dans « Ta comptabilité mois par mois »,
sept dans le glossaire et ses cinquante-neuf entrées : on faisait défiler à l'aveugle, sans même
savoir ce que l'article contenait. Le sommaire se tient à côté du texte, et chaque entrée y mène.
En dessous de quatre intertitres il n'y en a pas : un sommaire de deux lignes est du bruit.

**La recherche classe ses résultats, et dit pourquoi ils sont là.** Taper « tva » rendait dix-sept
articles sur trente-deux dans l'ordre où ils sont écrits : « Démarrer : tes premiers pas » arrivait
premier, et l'article qui porte le mot dans son titre quatrième. Maintenant le titre d'abord, et
chaque résultat montre son domaine et **l'extrait où le mot se trouve**, surligné.

Et l'écran des mises à jour ne mentionne plus l'ancien jeton d'accès quand il ne sert plus à rien :
ce n'était ni un réglage à faire ni une information utile.

## 7.26.1 — 14/09/2026

**Le repli n'est pas un réglage, c'est un réflexe.**

L'application du comptable affichait, sur le même écran et à dix lignes d'écart :

> Aucune version trouvée : le jeton d'accès manque ou n'a pas accès au dépôt.
> Les mises à jour arrivent toutes seules : rien à configurer.

Les deux ne peuvent pas être vraies. Et aucune des deux ne l'était vraiment : il y a **deux chemins**
pour se mettre à jour — le service de relais, et GitHub en direct — et le second existait depuis la
6.7.0 sans jamais servir. Il ne se déclenchait que lorsque le relais était **mal réglé** (adresse
invalide), jamais quand il **répondait mal** — c'est-à-dire le seul cas qui arrive vraiment. C'est
exactement le défaut corrigé en 6.7.2, une couche plus bas : *un chemin de secours ne sert que s'il
se déclenche tout seul.*

Désormais : si le relais échoue pendant une vérification, SkanFact rebranche **tout seul** le
téléchargement direct depuis GitHub et réessaie immédiatement. Sur un dépôt public, ce chemin-là
fonctionne sans rien présenter. Personne n'a rien à faire, rien à choisir, et rien ne s'affiche en
rouge tant qu'un second essai reste possible — un message d'erreur qu'on va démentir une seconde
plus tard vaut moins que pas de message du tout. Les deux applications sont corrigées.

Au passage : le détail technique et la gravité d'une erreur ne voyageaient qu'avec les messages
venus d'un événement, pas avec ceux renvoyés directement après un clic sur « Vérifier » —
c'est-à-dire précisément ceux qu'on lit. « Détails techniques » et l'affichage en gris marchent
maintenant dans les deux cas.

## 7.26.0 — 14/09/2026

**« Cannot find latest-mac.yml in the release https://github.com/… »**

C'est ce que l'écran des mises à jour a affiché, en toutes lettres, à quelqu'un qui venait
simplement de cliquer sur « Vérifier les mises à jour ». Techniquement exact — et parfaitement
inutilisable : celui qui le lit ne peut rien en faire, et une application qui montre ça a l'air
cassée. Elle ne l'était pas : la version venait d'être publiée, sa page existait déjà, et ses
fichiers d'installation finissaient de monter en ligne. Deux minutes d'écart.

**Désormais, SkanFact ne montre jamais une phrase qu'il n'a pas écrite.** Chaque cas connu a la
sienne, en français, qui dit ce qui se passe et quoi faire — publication en cours, pas de connexion,
fichier abîmé, disque plein, droits manquants, jeton refusé. Ce qui n'est pas une panne s'affiche en
gris et non en rouge : du rouge sur une situation normale apprend à ignorer le rouge. Et le texte
d'origine n'est pas jeté pour autant : il est replié sous **« Détails techniques »**, avec un bouton
qui ouvre le journal — c'est lui qui sert à dépanner à distance.

**Public ou privé : une seule ligne, pour les deux applications.** Le dépôt a été rendu public pour
que les publications soient gratuites, et il redeviendra peut-être privé. Sur un dépôt privé, GitHub
refuse tout sans jeton d'accès : il faut donc un champ où le coller et des phrases qui l'expliquent.
Trois choses ont été remises d'aplomb :

- la 7.24.0 avait **supprimé** le champ « jeton » puisqu'il ne servait plus. Remettre le dépôt en
  privé aurait alors donné un cul-de-sac : l'écran aurait écrit « colle ton jeton ci-dessous »
  au-dessus de rien du tout. Le champ existe de nouveau, mais **sous condition** ;
- l'application du comptable, elle, n'avait jamais été mise à jour : elle affirmait encore « SkanFact
  est distribué depuis un dépôt privé : un jeton de lecture est nécessaire » et faisait chercher un
  jeton que personne n'avait à lui donner ;
- les deux applications avaient chacune **leur** drapeau, et elles avaient donc divergé. La vérité
  vit maintenant dans un seul fichier, `src/depot.js`, que les deux lisent. Basculer le dépôt, c'est
  changer `private: false` en `private: true` — et tout suit.

À noter pour le jour venu : quand le **relais de mise à jour** est branché, il n'y a jamais rien à
saisir, privé ou public. C'est lui qui détient le jeton, côté serveur.

## 7.25.0 — 14/09/2026

**Le canal bêta : garder la version stable intacte pendant qu'on travaille sur la suivante.**

Jusqu'ici, SkanFact n'avait qu'une seule version : celle qu'on publiait. Une nouveauté partait
directement chez tout le monde, et le seul moyen de la vérifier d'abord était de construire
l'application à la main. Il y a maintenant **deux canaux**, comme dans les grands logiciels.

**Le canal normal** est celui de tout le monde, et personne n'en sort sans l'avoir demandé : la case
arrive décochée et une mise à jour n'y touche pas. **Le canal bêta**, à cocher dans Paramètres →
Mises à jour, ajoute les versions d'essai — numérotées `7.26.0-beta.1` — qui servent à vérifier une
nouveauté avant de la livrer aux autres.

Ce qui décide de tout, c'est le **numéro de version**, et rien d'autre : un numéro à suffixe est une
préversion, un numéro sans suffixe n'en est pas une. Le workflow de publication marque la release
« préversion » sur GitHub (donc `/releases/latest` continue de pointer sur la dernière stable),
electron-builder écrit `beta.yml` au lieu de `latest.yml`, et le relais de mise à jour laisse passer
ce fichier — pour l'application entreprise seulement. Aucune case à cocher au lancement du workflow,
donc aucun moyen de les désaccorder.

**Une bêta s'installe par-dessus l'application qui tient la vraie comptabilité.** Cocher la case pose
donc une question, et prend une sauvegarde `avant-beta` **avant** d'armer le canal — au moment où la
bêta s'installera, il sera trop tard pour y penser. Le mot **bêta** reste affiché en haut à gauche
tant qu'on tourne sur une version d'essai : c'est la seule protection contre « je croyais être sur la
stable ». Décocher ramène au canal normal ; si la version installée est une bêta, SkanFact la
remplace par la prochaine stable — c'est la seule exception voulue à la règle « jamais de retour en
arrière » de la 6.7.3.

**L'app du comptable ne bouge pas.** Elle n'a aucune case à décocher et personne ne lui a rien
demandé : une bêta de l'application entreprise ne construit plus SkanFact Cabinet du tout.

**Et un défaut attrapé au passage : le métier avait cessé de proposer son régime.** En remplaçant le
taux de TVA porté par chaque métier (7.22.0) par un régime fiscal choisi à l'écran suivant,
l'application avait perdu ce que le métier savait depuis la 2.0.0 : « Santé et paramédical » est
exonéré. Elle proposait donc 19 % de TVA à un kinésithérapeute qui venait de cliquer sur son propre
métier. Le métier **propose** de nouveau son régime — et un régime choisi à la main ne se fait plus
écraser en changeant de métier, comme la durée d'amortissement proposée par la famille d'un bien.
*À VÉRIFIER avec ton comptable*, comme toute la fiscalité de l'application.

Au passage, deux phrases périmées : l'aide affirmait encore qu'il faut « coller un token d'accès
parce que le dépôt est privé ». Elle explique maintenant les deux canaux.

## 7.24.0 — 14/09/2026

**L'écran des mises à jour disait trois choses fausses.**

**Les notes de version s'affichaient en Markdown brut.** Le rendu ne traitait que les titres et les
listes : tout le reste sortait tel quel, astérisques et accents graves compris — sur l'écran qu'on
regarde au moment précis où l'on décide d'installer. Le gras, le `code` et l'italique sont désormais
mis en forme, ainsi que les citations. On **échappe d'abord**, on remet la mise en forme ensuite :
l'inverse laisserait passer du HTML venu d'un fichier qu'on ne contrôle pas entièrement. Un lien
devient son seul texte — il n'y a rien à ouvrir depuis ce panneau.

**« Le dépôt GitHub de SkanFact est privé : un token de lecture est nécessaire. »** C'était vrai
jusqu'au 13 septembre. Le dépôt est **public** : les mises à jour arrivent sans rien présenter. Le
champ de saisie disparaît, et il ne reste qu'un bouton **Retirer ce jeton** pour ceux qui en ont un
d'avant — on ne laisse pas une valeur morte sur le poste de quelqu'un sans moyen de l'enlever.

**« Relais injoignable (Invalid URL) », en rouge.** Sur un dépôt privé, une panne du relais était un
vrai problème : sans lui, plus aucune mise à jour, d'où l'alerte (règle 6.7.2). Sur un dépôt public,
le repli GitHub suffit tout seul : la panne n'empêche plus rien. Elle reste dans le journal, elle ne
s'affiche plus.

*À savoir : le « Cannot find latest-mac.yml » aperçu au même moment n'était pas un défaut — la
publication était encore en cours d'envoi (13 fichiers sur 16) au moment de la vérification.*

## 7.23.1 — 14/09/2026

**Les sélecteurs de période étirés sur toute la largeur.**

Signalé sur la page Statistiques : les trois sélecteurs — période, année, mois — s'empilaient sur
**trois rangées**, étirés d'un bord à l'autre. L'en-tête occupait un tiers de l'écran.

Rien de faux dans le HTML. C'est la règle générale des champs de formulaire, `select { width: 100% }`.
Dans une barre d'actions — un conteneur **flex** — chaque `select` réclame donc la ligne entière, et
le voisin passe en dessous. Les barres de filtres avaient leur `width: auto` depuis longtemps ; les
barres d'actions ne l'avaient jamais eu.

`npm run e2e:entetes` **mesure** désormais, sur les 21 pages, la largeur de chaque contrôle d'en-tête
et la hauteur de chaque barre d'actions. Prouvé en retirant le correctif : neuf défauts reviennent, et
la mesure trouve une **cinquième** page que la lecture du code avait manquée — `#/garanties`, dont le
sélecteur faisait 356 px. C'est exactement la raison de mesurer plutôt que de relire.

## 7.23.0 — 14/09/2026

**Les colonnes qui ne s'alignaient pas, les boutons empilés, un bouton mort — et l'Aide refondue.**

### Les colonnes désalignées

Signalé sur la page Stock : « En stock », « Seuil » et « À commander » étaient écrits **à gauche**
au-dessus de chiffres écrits **à droite**. L'en-tête finissait quatre-vingts pixels à gauche de sa
propre valeur, et on lisait la ligne de travers.

La cause n'était pas dans le HTML — `<th class="r">` est écrit correctement, **153 fois**. Elle était
dans la **spécificité CSS** : `table.list th` (une classe, deux éléments) l'emporte sur `th.r` (une
classe, un élément), donc l'alignement à droite de l'en-tête n'était jamais appliqué. Les deux
applications partagent cette feuille : **139 colonnes sur 338** étaient concernées.

`npm run e2e:colonnes` **mesure** désormais, dans l'application réelle, l'alignement de chaque
colonne de chaque tableau sur dix-neuf pages et tous leurs onglets — **392 colonnes**. Relire le HTML
ne pouvait pas montrer ce défaut ; comparer deux règles CSS séparées de deux cents lignes, difficilement.

### Les boutons empilés

`flex-wrap: wrap`, posé en 7.18.0 pour éviter un débordement à 1280 px, a fabriqué pire : la cellule
d'actions vaut `width: 1%`, donc le navigateur lui donne sa largeur **minimale** — et la largeur
minimale d'un conteneur qui peut passer à la ligne, c'est celle d'**un seul bouton**. Les cinq boutons
s'empilaient verticalement sur chaque ligne.

Retour à une seule ligne, et le vrai fond du problème traité : **un bouton de moins**. L'icône
« ⧉ » (dupliquer) quitte les lignes de documents — c'était le seul sans libellé, celui qui débordait,
et celui qui était collé à « Refusé ✕ ». Dupliquer reste disponible depuis la pièce elle-même.
`npm run e2e:contraste` : 499 boutons mesurés, aucun hors de l'écran.

### Le bouton « Modifier » qui ne faisait rien

Stock → Numéros de série : `serialForm` appelait `clientItems`, une fonction déclarée **localement**
dans deux autres formulaires et absente ici. Le clic levait une `ReferenceError` pendant la
construction de la fenêtre : la fenêtre ne s'ouvrait pas, le bouton paraissait simplement mort, et
rien n'apparaissait dans la console. Une seule définition, au niveau du module.

Et le contrôle qui manquait : le détecteur d'appels à des fonctions inexistantes existait depuis la
6.8.0 — **pour l'app cabinet seulement**. L'application principale, celle qui a le plus de code, n'y
était pas. Elle y est.

### L'Aide, refondue

Trente-deux articles, 99 Ko de texte, **six liens** vers l'application dans tout ça : ce n'était pas
une aide, c'était un livre. Une liste plate de trente-deux titres, et un pavé de prose à droite.

- **Un accueil par thèmes** : sept territoires — Commencer, Vendre et facturer, Encaisser, Acheter et
  stocker, Déclarer et clôturer, Ton équipe, Piloter et protéger. On choisit un domaine avant de
  choisir un titre. Un test vérifie que chaque article appartient à un thème **et un seul**.
- **Chaque article finit par un geste**, pas par un point : « Voir mes devis », « Aller aux clôtures ».
  Vingt-neuf articles sur trente-deux en ont un, et un test vérifie que chacun mène à une vraie page.
  Les trois exceptions sont volontaires : on ne renvoie nulle part depuis un glossaire.
- **Un fil d'Ariane** (Aide › Thème › Article) et l'**article suivant de son thème** sous la main :
  on lit un domaine, on ne saute pas de la paie au stock.
- La **recherche** traverse tout et court-circuite les thèmes — c'est son rôle.
- La table page → article vivait **en double**, dans app.js et dans guide.js. Elle vit à côté des
  articles qu'elle désigne : deux tables divergent toujours.

Défaut trouvé par le parcours réel et corrigé : arriver sur un article alors qu'une recherche
traînait en mémoire relançait le filtrage au dessin, et la page s'ouvrait **blanche** — le conteneur
qui porte l'article repartait caché.

292 tests, `npm run e2e:aide` et `npm run e2e:colonnes` en plus.

## 7.22.0 — 14/09/2026

**Le métier : quinze activités, un régime fiscal, et la facture qui porte le bon nom.**

Six métiers proposés au premier démarrage, ça ne couvrait ni la restauration, ni le transport, ni les
professions libérales — c'est-à-dire l'essentiel du tissu de petites entreprises. Ils sont **quinze**,
plus « Autre activité » :

> Informatique · Bâtiment · Conseil et formation · Commerce · Santé · Artisanat · **Restauration** ·
> **Transport** · **Immobilier** · **Professions juridiques** · **Comptabilité** · **Architecture** ·
> **Communication** · **Beauté** · **Automobile**

Chacun arrive avec son catalogue de départ, et chacun allume les modules de son quotidien : un
garagiste voit Achats et Stock, un architecte voit Affaires, un restaurateur voit la Paie. Un métier
sans ligne dans cette table n'allumait que le strict minimum — les neuf nouveaux ont la leur.

**Le régime fiscal remplace la colonne TVA des métiers.** Chaque secteur portait un taux de TVA
deviné à partir de l'activité. C'était faux dans les deux sens — un kinésithérapeute au réel facture
de la TVA, un informaticien au forfaitaire n'en facture pas — et l'erreur s'imprimait sur une pièce
officielle, pas dans une console. La question est maintenant posée une fois, en clair : **Réel**,
**Forfaitaire** ou **Exonéré**.

Quand tu n'es pas assujetti :

- la **colonne TVA disparaît** du document, en-tête et lignes ;
- la **mention légale prend sa place** (« TVA non applicable — régime forfaitaire »). Une facture
  sans TVA et sans mention n'est pas une facture allégée, c'est une facture incomplète ;
- le taux des nouvelles lignes est **forcé à 0 %** et grisé dans les Paramètres — le régime prime sur
  un réglage oublié.

Et la garantie qui compte : **une facture qui porte de la TVA la garde pour toujours**, même si tu
changes de régime ensuite. Une pièce émise ne se réécrit pas — le PDF chez le client ferait foi
contre nous.

**La note d'honoraires.** Pour une profession libérale — santé, juridique, comptabilité,
architecture — une facture s'appelle une **note d'honoraires**, et c'est ce nom qui s'imprime. Même
pièce, même préfixe `FAC-`, même numérotation, même valeur comptable : seul le titre change, parce
que c'est celui que le client attend et sous lequel le comptable la classe. Le devis reste un devis,
l'avoir un avoir.

**Le RIB n'est plus réclamé à tout le monde.** Un restaurant, un salon ou un commerce encaissent sur
place. Leur répéter à chaque facture qu'il manque un RIB, c'est un avertissement qu'ils ne peuvent
pas satisfaire — et on cesse de lire les avertissements qu'on ne peut pas satisfaire. La fiche société
et l'avertissement à l'émission suivent désormais la **même** règle : deux écrans qui disent la même
chose ne peuvent pas se contredire.

*Tout ce qui touche au régime, aux taux et aux mentions est **À VÉRIFIER avec ton comptable** : le
régime dépend du chiffre d'affaires et de la forme juridique, et la mention exacte de l'article
invoqué. L'application le dit à l'écran.*

Nouveau garde-fou, né d'une faute commise en écrivant cette version : **l'interface n'appelle plus
aucune fonction que `core.js` n'exporte pas.** Écrire `C.pl(...)` alors que `pl` est une fonction
locale lève une erreur pendant la construction du gabarit — l'écran reste blanc, sans une ligne en
console, et `node --check` ne voit rien. L'app cabinet avait ce contrôle depuis la 6.8.0 ; il n'avait
jamais été porté ici. `npm run e2e:metier` refait les quatre gestes dans l'application réelle.

## 7.21.3 — 14/09/2026

**La purge des sauvegardes se fiait à l'horloge du disque, qui ment sur Windows.**

Trouvé par la première publication depuis que le dépôt est public : `npm test` échouait sur la
machine **Windows** et passait sur Linux. Le test n'était pas en cause — la purge l'était.

Une purge se fait par date (règle de 6.8.1), et cette date était lue dans le **mtime du système de
fichiers**. Il ment dans deux cas bien réels :

- Sur **Windows**, l'horloge système n'avance que toutes les ~15 ms. Vingt-six sauvegardes copiées
  d'affilée portent donc le **même** mtime : l'ordre « la plus ancienne d'abord » devient
  arbitraire, et la purge efface n'importe laquelle.
- Une **copie** réécrit les mtime — miroir externe, clé USB, changement d'ordinateur. Après un
  déménagement, le scénario que 6.8.2 a précisément ouvert, ils ne disent plus rien du tout.

Le nom d'une sauvegarde porte déjà la date que **l'application** a écrite, au format
`AAAA-MM-JJ_HHhMMmSS`. Il est zéro-rempli : son ordre alphabétique **est** l'ordre du temps, sans
aucun calcul de date, donc sans la moindre question de fuseau horaire. C'est lui qui fait foi
désormais ; le mtime ne sert plus qu'en second, pour un fichier dont le nom ne porte pas de date.
La liste des sauvegardes suit le même ordre : sur Windows elle s'affichait dans un ordre arbitraire,
et le jour où l'on restaure est le pire jour pour choisir au hasard.

**Et le bug de 6.8.1 était toujours vivant dans l'app entreprise, sur la seule plateforme que
personne ne testait.** Le tri y départageait les mtime égaux par ordre **alphabétique** : sur
Windows, où ils sont presque toujours égaux, « avant-import » repassait donc en tête et redevenait
la première effacée — exactement le défaut que la correction était censée avoir supprimé. Les filets
que l'application prend avant un geste risqué ont maintenant leur **propre réserve**, comme dans
l'app cabinet depuis 6.8.1 : vingt sauvegardes volontaires ne peuvent plus les chasser.

Les deux tests sont prouvés en réintroduisant leur défaut, et le cas Windows est reproduit sur
toutes les machines (mtime imposés à l'envers de l'ordre réel). L'un d'eux ne prouvait d'ailleurs
rien : ses deux `backupNow` tombaient dans la même seconde, écrivaient donc le même fichier, et
aucune purge ne se déclenchait.

**Et derrière, un second défaut propre à Windows, de la même famille que celui de la 7.21.1.**
Sur Windows, git convertit les fichiers texte en **CRLF** au checkout — `core.autocrlf`, activé par
défaut par l'installeur Git for Windows. Le code marche toujours, mais les tests qui **relisent la
source** cessent de correspondre dès qu'une expression régulière contient un `\n` littéral. La
publication échouait donc sur un test qui n'avait rien à se reprocher, et seulement là.

- `.gitattributes` impose maintenant le **LF à tout le code source**, sur toutes les plateformes.
  La 7.21.1 avait posé la règle pour les `.bat`, les `.command` et les `.sh` ; elle manquait pour
  les fichiers que l'application et les tests lisent vraiment.
- Les tests lisent la source en fins de ligne Unix quoi qu'il arrive, pour une copie de travail
  clonée avant cette règle.
- Le cas est **reproduit ici** avant d'être corrigé : une copie du dépôt entièrement convertie en
  CRLF, et `npm test` dessus. Il échouait au 262ᵉ test comme sur la machine de publication ; il
  passe les 286 maintenant. C'est ce qui a évité de découvrir les défauts un par un, une
  publication à la fois.

## 7.21.2 — 13/09/2026

**L'installateur Windows tout prêt, et un échec de construction qui se nomme.**

La construction locale a échoué sur un poste Windows, et le journal ne portait qu'un mot :
`construction : echec`. Une panne qui ne se nomme pas condamne l'utilisateur **et** le dépannage à
distance — c'est la règle apprise en 6.7.2, jamais appliquée à l'installeur.

- La sortie de `npm run build:win` est capturée dans `construction.log`, versée dans
  `installation-windows.log`, et **affichée à l'écran** en cas d'échec. Un seul fichier à envoyer,
  et il porte la cause.
- Le journal note aussi la version de npm, à côté de celle de Node et du chemin : c'est ce qui
  change d'un poste à l'autre, et donc ce qui explique qu'une construction passe ici et pas là.
- Le test des fichiers batch descend désormais dans les **sous-dossiers** : un `.bat` en fins de
  ligne Unix ferme la fenêtre où qu'il soit, pas seulement à la racine.

Le dépôt est passé **public**. GitHub Actions y est gratuit : la publication normale reprend, et
l'installateur Windows se télécharge à nouveau depuis la page **Releases**, avec le `.dmg` et le
`.zip` macOS, les installateurs du Cabinet, et les fichiers de mise à jour automatique.

## 7.21.1 — 13/09/2026

**L'installeur Windows se fermait tout seul.**

`Installer SkanFact (Windows).bat` avait des **fins de ligne Unix**. `cmd.exe` lit un fichier batch
octet par octet : il se désynchronise sur le premier bloc `if ... ( ... )`, tombe en erreur de
syntaxe, et la fenêtre se ferme sans un mot — exactement ce qui arrivait après avoir appuyé sur
Entrée.

- Le fichier est en **CRLF**, et un `.gitattributes` le garantit à chaque copie du dépôt, quel que
  soit le réglage du poste. L'inverse est posé pour `.command` et `.sh`, qu'un CRLF casserait.
- Le script passe par des **étiquettes** (`goto :label`) au lieu de blocs parenthésés, plus robustes.
- La fenêtre **ne se ferme jamais sans un mot** : chaque chemin finit par une pause, et tout est noté
  dans `installation-windows.log`, à côté du fichier.
- Il écrit ce qu'il faut faire quand ça échoue (connexion, Node.js à installer, journal à envoyer),
  au lieu de disparaître.
- Deux contrôles dans `npm test` : aucune fin de ligne Unix ni caractère accentué dans un `.bat`,
  et chaque `goto` comme chaque `npm run` du script existe vraiment.

## 7.21.0 — 13/09/2026

**La comptabilité qui mène aux pièces.**

Six endroits où la page Comptabilité et la Trésorerie nommaient quelque chose sans pouvoir l'ouvrir,
ou affirmaient un état qu'on ne pouvait pas corriger.

- **Les contrôles avant clôture étaient du texte mort.** « 3 achats sans justificatif » sans rien
  pour les ouvrir — alors que la **même liste porte ses boutons** dans l'onglet Cabinet, à un onglet
  de distance. Un manque qu'on ne peut pas ouvrir n'est pas un manque, c'est un reproche.
- **Une échéance fiscale restait rouge après le dépôt, pour toujours.** Le seul recours était de
  désactiver la règle — donc de perdre aussi l'échéance suivante. « Marquer déposée » pointe
  désormais **une occurrence** (la TVA d'octobre, pas la règle TVA), avec un « Annuler » sous la
  main. SkanFact ne dépose toujours rien : c'est un pense-bête, pas un accusé de réception.
- **Aucun des cinq chiffres de la TVA ne menait à sa pièce.** Les douze lignes « Mois par mois » se
  cliquent, et deux boutons mènent aux ventes et aux achats du mois affiché — sur le bon onglet,
  **allumé** (arriver sur le bon contenu avec le mauvais onglet en surbrillance était le piège).
- **Un encaissement de la Trésorerie ne menait pas à sa facture**, pendant que la phrase juste en
  dessous disait d'aller la corriger là-bas. Chaque mouvement ouvre maintenant sa pièce — facture,
  achat ou bulletin.
- **Un paquet fabriqué ne se retrouvait plus sur le disque.** L'historique donnait son empreinte et
  jamais son emplacement ; six semaines plus tard, le comptable réclame « le fichier de mars ». Le
  chemin était pourtant enregistré depuis la 6.1.0 — il n'était affiché nulle part.
- **« Reste à encaisser » de la Comptabilité n'ouvrait rien**, alors que sa jumelle de l'accueil le
  fait depuis la 7.15.0.

`npm run e2e:compta` refait les sept gestes dans l'application réelle ; `npm test` passe à 283.

## 7.20.0 — 13/09/2026

**Ce qui est obligatoire, et ce qui mène quelque part.**

Six endroits où l'application savait quelque chose et ne le montrait pas.

- **Rien ne disait ce qui est obligatoire.** L'attribut `required` posé sur un champ d'une fenêtre
  est **inerte** : rien ne soumet le formulaire, c'est un bouton qui lit les valeurs. Une étoile
  rouge marque les champs obligatoires, et la légende « * obligatoire » se pose **toute seule** dès
  qu'une fenêtre en contient un — une légende recopiée fenêtre par fenêtre s'oublie à la première
  qui gagne un champ.
- **Le refus ne montrait pas le champ fautif.** Client, Fournisseur, Prestation, Texte prédéfini,
  Salarié : un message et rien d'autre, alors qu'il fallait relire tout le formulaire. Le champ est
  maintenant amené à l'écran, reçoit le curseur et se marque.
- **Le Catalogue affichait une quantité en stock sans pouvoir l'ouvrir.** La fiche de l'article —
  mouvements, coût moyen, historique — n'était atteignable que depuis la page Stock.
- **L'éditeur d'achat n'offrait aucun sélecteur de catalogue** et reprochait ensuite le libellé qui
  ne correspond à rien (« cette ligne n'entrera dans aucun stock »). Le sélecteur est là, et il
  reprend le **coût d'achat** (pas le prix de vente : ici on achète), l'identifiant de l'article et
  sa destination.
- **Choisir « Immobilisation » ne disait rien** — alors que la ligne n'est déduite **nulle part**
  tant que la fiche du bien n'existe pas : ni en charge (ce n'en est pas une), ni en amortissement
  (il n'y a pas encore de durée). Elle dormait dans un compteur de barre latérale que personne ne
  regarde en saisissant un achat.
- **La fiche client s'arrêtait aux documents.** Ni ses affaires (où l'on sait exactement ce qu'il a
  rapporté, achats déduits), ni ses contrats récurrents. Les deux panneaux sont là, cliquables, et
  disparaissent quand il n'y a rien à montrer.

Et un défaut trouvé par le test lui-même : une garde `locked` écrite dans l'éditeur d'achat, où
cette variable n'existe pas — la page entière restait blanche, sans rien dans la console.

`npm run e2e:fiches` refait les sept gestes dans l'application réelle ; `npm test` passe à 277.

## 7.19.0 — 13/09/2026

**L'éditeur de document.**

L'écran le plus utilisé de l'application, et sept endroits où il laissait faire une erreur sans rien
dire.

- **Le timbre annoncé n'était pas celui qui serait compté.** Le timbre fiscal est fixé en dinars :
  sur une facture en euros au taux 3,4 il vaut 0,29 €. L'étiquette à côté de la case affichait le
  réglage brut — « 1,00 € » — juste au-dessus d'un total qui, lui, comptait 0,29 €. Et une pièce
  émise garde son propre timbre figé : c'est celui-là qu'on montre, pas le réglage du jour.
- **Changer la date ne recalculait jamais l'échéance.** On corrigeait la date d'une facture et elle
  restait due au 30ᵉ jour de l'ANCIENNE. Elle suit maintenant — sauf si l'échéance a été saisie à
  la main, auquel cas elle n'est jamais écrasée — et une ligne discrète dit qu'elle vient de bouger.
- **Effacer une quantité la mettait à zéro.** `Number('')` vaut 0 : effacer « 2 » pour taper « 12 »
  faisait tomber la ligne, le total et l'aperçu à zéro entre les deux frappes. Rien n'est retenu
  tant que le champ n'est pas lisible, et il est marqué en attendant.
- **Rien ne refusait d'émettre une ligne à zéro.** On ne l'interdit pas (une prestation offerte
  existe), on la nomme avant d'émettre — après, la pièce est verrouillée et il faut un avoir.
- **Le client choisi ne se corrigeait pas depuis le document.** Une adresse fausse se découvre EN
  REGARDANT l'aperçu : il fallait quitter le document, aller aux Clients, chercher, corriger,
  revenir. Un bouton « ✎ Fiche du client » ouvre la fiche par-dessus.
- **Sur une facture soldée, le bouton principal invitait encore à enregistrer un paiement.** Le
  calcul du reste dû était fait dix lignes plus haut ; la barre d'actions ne le lisait pas.
- **Supprimer une pièce ne disait pas ce qui en dépend.** Une facture continuait d'annoncer
  « établie à partir du devis DEV-2026-012 » avec un lien qui mène au tableau de bord. La question
  les nomme maintenant : « FAC-2026-018 (acompte 30 %) en est issue — elle restera, mais son lien
  vers cette pièce sera rompu. »
- **Un acompte ne se demandait qu'en pourcentage.** Il se négocie au téléphone en dinars (« 5 000 à
  la commande ») : il fallait diviser de tête, tomber sur 33,33 %, et découvrir le montant réel une
  fois le brouillon créé. Les deux modes vivent dans la même fenêtre, et le total obtenu — timbre
  compris — s'affiche en direct, avant de fabriquer quoi que ce soit.

`npm run e2e:editeur` refait les huit gestes dans l'application réelle ; `npm test` passe à 272.

## 7.18.0 — 13/09/2026

**L'accueil tient ses promesses.**

Suite de l'audit. Un écran qui annonce un ensemble et n'ouvre pas le bon, une étape qui se coche
parce qu'un assistant l'a remplie, un total calculé sur un extrait : rien de tout ça ne plante.

- **« n devis acceptés à facturer » cachait une partie des devis annoncés.** Cinq réglages sont à
  remettre quand on pose un filtre depuis « À faire », recopiés à la main dans chaque action — et
  « Facturer » en oubliait un. La liste d'arrivée se re-filtrait alors toute seule sur l'année en
  cours. Un helper unique remplace les six recopies.
- **« n attestations de retenue à réclamer » déposait en haut de Comptabilité → Ventes**, trois
  écrans au-dessus du panneau qui les liste. Le mécanisme qui amène au bon panneau existait depuis
  la 7.11.0 pour les Paramètres ; il vaut maintenant pour n'importe quelle page.
- **« Rien à faire aujourd'hui » s'affichait juste sous « Tes premiers pas 1 / 7 ».** Tant que les
  premiers pas sont à l'écran, ils SONT la liste des choses à faire.
- **« Remplir ton catalogue » se cochait tout seul.** L'assistant propose les prestations du métier
  avec des prix à 0 ; l'étape était réputée faite. Elle devient « Ajuster les prix de ton catalogue »
  et dit combien de prestations n'ont pas encore de prix.
- **« Documents récents » totalisait huit pièces sur deux cents**, en mélangeant devis, factures et
  bons de livraison sous « Net à payer ». Un extrait n'a pas de total : le titre dit maintenant
  « les 8 dernières pièces sur 81 » et deux boutons mènent aux listes complètes.
- **« 1 facture(s), 0 en retard ».** La règle du pluriel existait dans l'app du cabinet depuis sa
  première version et n'avait jamais été portée ici — sur l'écran qu'on regarde le plus souvent.
- **« Générer maintenant » fabriquait une facture et repoussait l'échéance sans un mot**, y compris
  sur un contrat suspendu. Il demande d'abord quand le contrat est suspendu ou que l'échéance n'est
  pas encore arrivée, et laisse un « Annuler » qui supprime le brouillon ET remet les deux dates.
- **Un contrat en euros s'affichait en dinars** dans la colonne « HT / facture », et le tri comparait
  des euros à des dinars. La page dit aussi, enfin, ce que les contrats rapportent par mois et par an.
- **La recherche des Relances ne filtrait qu'un tableau sur quatre.** On tapait un nom de client, le
  premier tableau se réduisait, les trois autres continuaient d'afficher tout le monde.
- **Répondre à un devis depuis la liste.** « Accepté ✓ » et « Refusé ✕ » sur les devis en attente,
  avec retour en arrière : le statut d'un devis se saisit à la main, et il fallait ouvrir la pièce.

`npm run e2e:accueil` refait les sept gestes dans l'application réelle ; `npm test` passe à 265.

## 7.17.0 — 13/09/2026

**Les écrans qui ne répondent pas.**

Un bouton absent se voit tout de suite. Un bouton qui accepte le clic et n'en fait rien ne se voit
nulle part : aucune erreur, aucune trace, aucun test de calcul. On croit avoir mal cliqué, on
recommence, on doute de soi — puis du logiciel. Voici les huit, trouvés par la suite de l'audit.

- **Pointer un mouvement par erreur était définitif.** La ligne quittait l'écran à l'instant du clic,
  le drapeau n'était écrit nulle part ailleurs, et rien ne montrait ce qui avait déjà été pointé.
  Or un pointage de trop fausse l'écart avec le relevé — le seul chiffre pour lequel on vient sur
  cette page. Il y a maintenant un **« Annuler »** sous la main, et un panneau **« Déjà pointés »**
  qui se déplie et se décoche des semaines plus tard.
- **Le solde de tout compte perdait le curseur à chaque caractère.** Chaque frappe redessinait tout
  le bloc : le champ qu'on remplissait était détruit et recréé, donc le curseur repartait dans le
  vide. Écrire « Prime de départ » y était littéralement impossible. Seul le total se recalcule
  désormais ; le tableau ne bouge qu'à l'ajout ou au retrait d'une ligne.
- **Un sélecteur d'année visible et parfaitement inerte sur quatre onglets.** Paie → Salariés,
  Avances et Registre, et Marges → Contrats : on change l'année, rien ne bouge. Ce sont des états du
  jour, pas d'un exercice — le sélecteur y disparaît au lieu d'y mentir.
- **Six colonnes qui annoncent un tri et n'en font aucun.** Trésorerie → Mouvements et la fiche
  fournisseur affichaient leur « ⇅ » sur chaque en-tête, acceptaient le clic, et ne triaient pas :
  la colonne cliquée était jetée en chemin. Un tri qui ne trie pas ne se remarque pas — on croit que
  la liste était déjà dans cet ordre.
- **Les mouvements figés sur l'année en cours.** Trésorerie et Stock écrivaient l'année dans le
  code : le 3 janvier, les deux pages devenaient vides et l'exercice écoulé inatteignable — le
  moment précis où on vient le consulter. L'année se choisit, et le panneau dit laquelle il montre.
- **« Exporter en CSV » du Stock exportait l'état, quel que soit l'onglet.** Depuis « Mouvements »,
  on demandait le journal et on recevait l'inventaire, sans un mot. Chaque onglet a son export — et
  le bouton NOMME ce qu'il exporte (« Exporter les mouvements », « Exporter les numéros de série »…).
- **Les deux compteurs rouges du Stock ne menaient nulle part.** « 3 sous le seuil », « 1 stock
  négatif » : des questions, pas des informations, tant qu'on ne peut pas les ouvrir. Ils mènent
  maintenant à la liste des articles concernés, à la souris comme au clavier.

Deux tests nouveaux : `npm run e2e:repondre` refait les neuf gestes dans l'application réelle, et
`npm test` passe à 254 contrôles — dont une règle qui vaut désormais pour toutes les pages : celle
qui pose une carte cliquable doit l'armer.

## 7.16.0 — 12/09/2026

**Les chiffres qui mentent.**

Un audit page par page de toute l'application, chaque constat relu par un contradicteur chargé de le
réfuter : 66 retenus, 18 rejetés. Voici les cinq graves — ceux qui ne plantent pas, ne s'affichent
pas en rouge, et donnent un chiffre faux tous les jours.

- **L'accueil additionnait des euros à des dinars.** Sur le jeu d'exemple, « CA de l'année »
  annonçait **41 307 DT là où le total vaut 43 892 DT** — 2 585 DT manquants — pendant que le
  graphique dix centimètres plus bas, lui, convertit depuis toujours. Deux chiffres du même écran,
  deux années différentes, et rien pour l'expliquer. Les quatre cartes convertissent maintenant, et
  celle de la Comptabilité aussi.
- **La page Marges calculait ses trois cartes sur vingt lignes.** Le tableau est tronqué à vingt, et
  « Chiffre d'affaires », « Marge totale » et « Coût des ventes » additionnaient ces vingt-là. Pire :
  le tri est par marge **décroissante**, donc ce qui tombait en premier, c'étaient les lignes à marge
  négative — exactement celles qu'on vient chercher. Les cartes portent sur tout, et la table est
  paginée comme toutes les autres listes.
- **Facturer un devis perdait son affaire.** Les trois chemins (facturer, acompte, solde) fabriquaient
  une facture sans `projectId` : la fiche d'affaire affichait 0 facturé pendant que les achats
  rattachés, eux, étaient comptés — l'affaire paraissait perdre de l'argent. L'avoir la garde aussi.
- **Saisir deux fois la même facture fournisseur ne disait rien.** Sa TVA déductible et sa charge
  comptaient alors deux fois, jusque dans le paquet du comptable. On ne refuse pas — un fournisseur
  peut recycler ses numéros d'une année sur l'autre — on nomme la pièce déjà saisie, avec sa date et
  son montant.
- **« Facturer ce devis » restait proposé sur un devis déjà facturé**, en bouton coloré : un second
  clic fabriquait une seconde facture complète. Pire avec un acompte émis, qui fait passer le devis à
  « accepté » : le bouton principal proposait 100 % du devis pendant que « Facture de solde » dormait
  dans le menu ▾. Le bouton mène désormais à la facture établie, ou propose le solde ; refacturer la
  totalité reste possible, derrière une question qui nomme les pièces existantes.

`npm run e2e:chiffres` refait les cinq dans l'application réelle, avec les montants du jeu d'exemple.

## 7.15.0 — 12/09/2026

**Tout ce qui se lit se clique.**

- **« Ce qui manque » mène aux pièces.** Le panneau de Comptabilité → Cabinet dit exactement ce qu'il
  faut aller regarder — « 3 achats sans justificatif », « 2 mouvements non pointés » — et c'étaient
  des lignes de texte inerte : un libellé, un compteur, rien à cliquer. On lisait le reproche, on
  retrouvait la page à la main, puis on cherchait lesquels. Chaque ligne porte son bouton, et un
  test de couverture vérifie qu'aucune sorte de manque ne peut être produite sans qu'un écran sache
  l'ouvrir.
- **Les quatre chiffres du tableau de bord ouvrent la liste qu'ils résument.** « Reste à
  encaisser : 8 400 DT, 6 factures » est une question — lesquelles ? Chaque carte a un chevron, un
  curseur de clic, un relief au survol, et répond au clavier.
- **Le filtre « Émis » de la liste des factures était faux.** Il comparait un statut qui n'existe
  pas sur une facture — mais qui existe sur un **avoir**. Sur le jeu d'exemple, « Émis » rendait
  2 avoirs au lieu des 27 pièces émises. Une liste vide se remarque tout de suite ; une liste fausse,
  non. Un filtre qui regroupe plusieurs statuts est désormais une fonction (`core.docFiltre`), pas
  une chaîne comparée à un statut.
- **Nouveau filtre « À encaisser »** : exactement les factures que compte la carte du tableau de
  bord. Les deux se calculent maintenant avec la même règle, et un test refuse qu'elles divergent —
  une carte qui annonce six factures et une liste qui en montre quatre, c'est le genre d'écart qui
  fait perdre confiance dans tous les autres chiffres.
- **Un raccourci qui vise la page où l'on est déjà redessine au lieu de ne rien faire.** `navigate`
  pose l'adresse et le routeur réagit au changement : viser la page courante ne changeait rien,
  alors que l'onglet et le filtre venaient d'être modifiés. Plusieurs boutons étaient donc
  parfaitement inertes depuis la page concernée.
- `npm run e2e:cliquable` refait tout le parcours dans l'application réelle : le filtre, la
  concordance carte/liste, les quatre cartes et chaque ligne de « Ce qui manque ».

## 7.14.0 — 12/09/2026

**Changer d'entreprise depuis le haut du menu.**

L'application gère plusieurs dossiers depuis la 3.2.0 — ta société, celle de ton père, un dossier
partagé à deux — et le seul chemin pour en changer était Paramètres → Sécurité et données →
Dossiers : cinq clics et un onglet qu'il faut connaître. Pendant ce temps, le nom du dossier ouvert
est écrit en permanence en haut à gauche de la fenêtre. **L'endroit qui affiche un état est celui où
on s'attend à le changer.**

- **L'en-tête de la barre est devenu un vrai bouton** — chevron, curseur de clic, état au survol,
  atteignable au clavier. Il ouvre la liste des entreprises : celle qui est ouverte en tête, les
  autres en dessous, et trois gestes qu'on ne pouvait faire nulle part en moins de cinq clics —
  « Nouvelle entreprise… », « Dossier partagé… », « Gérer les dossiers… ». Échap ou un clic à côté
  le referme, et il reste **sous** les fenêtres de confirmation : une question posée par-dessus
  passe devant.
- **Changer de dossier respecte le garde-fou des modifications non enregistrées.** Basculer recharge
  l'application : sans ça, un devis à moitié tapé partait sans un mot.
- **Le dossier porte le nom de ta société, plus « Mon entreprise ».** C'était le nom générique posé
  à l'installation : l'en-tête affichait « Atelier Ben Salah SUARL » pendant que la liste des
  dossiers, dix pixels plus bas, disait « Mon entreprise ». Deux noms pour la même chose, et rien
  pour deviner qu'il s'agit du même dossier. Le nom suit désormais celui de la fiche société — sauf
  si tu l'as renommé toi-même, auquel cas ton nom est gardé.
- `npm run e2e:entreprises` fait le parcours en entier dans l'application réelle : créer une seconde
  entreprise depuis le menu, remplir son assistant, revenir à la première, et vérifier la couche du
  menu.

## 7.13.0 — 12/09/2026

**Voir ce qu'on fabrique.**

La colonne d'aperçu fait 430 pixels de large — 350 sur un portable — pour une page A4 qui en fait
794. Le document y était donc affiché à 54 %, puis à 44 % : on distinguait une mise en page, on ne
lisait ni un prix, ni une désignation, ni une mention légale. C'est pourtant la seule chose que ton
client, lui, verra.

- **« Agrandir » ouvre le document sur toute la fenêtre**, avec un zoom (⌘⇧A, ou Affichage → « Voir
  le document en grand »). « Ajuster » montre la **page entière** — pas seulement sa largeur : caler
  sur la largeur donnait 177 % et il fallait défiler pour voir le total, ce qui n'est pas un aperçu
  ajusté. Il se met à jour pendant que tu tapes, comme la colonne, et Échap le referme.
- **L'interrupteur de l'aperçu est monté dans la barre d'actions, en haut.** Une fois l'aperçu
  masqué, son bouton repartait à la **fin du formulaire**, trois écrans plus bas : on ne le
  retrouvait pas, et on croyait l'aperçu perdu pour de bon. Il ne bouge plus, et la colonne
  disparaît maintenant entièrement au lieu de rester là réduite à un bouton.
- **La barre d'actions revient à la ligne au lieu de sortir de l'écran.** Sur un brouillon de
  facture à 1280 px, « Émettre la facture » — le bouton principal — dépassait de 25 pixels,
  « Plus ▾ » de 125, et rien ne permettait de les atteindre : la page ne défilait pas, elle les
  coupait. Mesuré dans l'application.
- **Un contrôle de plus, permanent** : `npm run e2e:contraste` vérifiait déjà que chaque bouton est
  lisible ; il vérifie maintenant qu'aucun ne **sort de la fenêtre**, sur les 21 pages et sur tous
  les éditeurs, à 1440 comme à 1280. Et `npm run e2e:apercu` mesure le grand aperçu aux deux
  largeurs.

## 7.12.0 — 12/09/2026

**Le droit à l'erreur.**

Trois défauts trouvés en une minute en ouvrant l'application, et la règle qui manquait derrière :
un geste fait par erreur doit pouvoir se défaire **depuis l'écran où on l'a fait**.

- **Un bouton entièrement blanc sur une facture émise.** C'était « Corriger par un avoir… », la
  seule sortie que propose le bandeau d'une pièce verrouillée : 155 × 32 pixels de blanc sur blanc.
  Une règle CSS repeignait en blanc le fond de **tous** les boutons d'un bandeau — y compris celui
  qui garde son texte blanc. Rien ne plante, rien n'apparaît en console. Un nouveau test
  (`npm run e2e:contraste`) mesure désormais le contraste texte/fond de **chaque bouton visible**
  des 21 pages, en clair et en sombre : 536 boutons, et aucun illisible.
- **Décocher un module ne le retirait pas du menu, et sa case disparaissait.** Sur « Tous les
  modules », un module qui contenait ne serait-ce qu'une ligne se rallumait tout seul après le clic,
  et la case se changeait en cadenas — donc le module restait affiché **et** ne pouvait plus être
  recoché. L'intention (« on ne cache pas ton travail ») était bonne, la mécanique était un piège.
  Désormais **ton choix fait foi** : tout ce qui n'est pas le cœur du métier se décoche et se
  recoche, toujours. Le filet devient un **événement** : un module que tu as masqué revient tout
  seul le jour où tu y enregistres quelque chose, et l'application le dit.
- **Masquer un module qui contient quelque chose demande d'abord**, en nommant ce qu'il contient,
  le fait que rien n'est supprimé, et par où la page reste atteignable (la recherche et son adresse).
- **« Marquer déposée » n'avait pas de retour en arrière.** Un clic, et la ligne quittait le panneau
  « À déposer » : le bouton qui retire la mention existe, mais sur un autre panneau, et seulement si
  on retrouve le bon trimestre. Le bandeau de confirmation porte maintenant un **« Annuler »** qui
  défait vraiment — et qui dure trois fois plus longtemps qu'un message ordinaire, parce que
  comprendre qu'on s'est trompé prend quelques secondes. Même chose pour **« Attestation reçue »**,
  et pour **suspendre ou reprendre un contrat** (la reprise déplace la prochaine échéance, et
  l'ancienne date était perdue).
- **Deux gestes qui détruisent demandent maintenant** : remettre le plan de comptes à la proposition
  de départ (les numéros dictés par ton comptable étaient jetés sans un mot) et générer d'un coup
  tous les brouillons de contrats dus (il annonce désormais combien).

La règle n'est pas « tout confirmer » : dix questions par jour ne se lisent plus. Ce qui **détruit**
demande ; ce qui **se répare** laisse un « Annuler » sous la main. Un test tient les deux moitiés,
et vérifie aussi que le bouton « Annuler » reçoit bien les clics — un bouton visible et inerte
serait exactement le défaut qu'on vient de corriger ailleurs.

## 7.11.0 — 12/09/2026

**Les réglages qu'on trouve, qu'on voit, et qui ne se jettent pas sans un mot.**

Sept panneaux dans sept onglets, et rien pour s'y repérer : les liens de l'application y menaient
sans désigner le réglage promis, les couleurs vivaient entre le matricule fiscal et le RIB, et le
bouton collé à « Enregistrer » jetait tout sans une question.

- **Un lien qui promet un réglage précis l'amène sous les yeux.** « Choisir un dossier » depuis
  « À faire », « voir Paramètres » depuis le bandeau des mises à jour, « Compléter ma fiche » :
  tous atterrissaient en haut d'une pile de panneaux identiques, et il fallait redescendre à la
  main en cherchant le titre. Le panneau visé est désormais amené à l'écran et encadré une
  seconde. Un test vérifie que chaque lien désigne un panneau **qui existe**, dans un onglet qui
  existe.
- **Les couleurs, le logo et le cachet sont passés dans l'onglet Apparence.** Ce sont des réglages
  d'apparence ; les chercher dans l'onglet qui parle d'identité juridique n'avait rien d'évident.
  Au passage, la phrase dit ce qu'ils habillent : les documents, pas l'application.
- **Le thème sombre se voit tout de suite.** Il fallait le choisir, puis trouver « Enregistrer »
  tout en bas de la page, pour savoir à quoi il ressemble — donc on ne l'essayait pas.
  L'enregistrement reste explicite, et si on renonce, l'aperçu se défait : l'application ne reste
  pas habillée d'un réglage qu'on vient de refuser.
- **« Annuler » s'appelle maintenant « Abandonner les modifications », et il demande.** Collé à
  « Enregistrer », il jetait sans un mot ce qui venait d'être tapé — y compris dix minutes de
  modèles d'email.
- **« Retirer » la copie externe demande aussi.** Le panneau écrit noir sur blanc que c'est le
  réglage le plus important de la page, et le bouton qui l'éteint s'exécutait sans une question.
- **Trois refus disent enfin le bouton qui débloque.** Verrouiller sans mot de passe renvoyait vers
  « Paramètres → Sécurité », un onglet qui n'existe pas. Une photo de facture sans clé de lecture
  demandait de retenir « Paramètres → Mises à jour → Lecture de factures ». Un envoi au comptable
  sans adresse nommait « Paramètres » sans dire où. Chacun propose maintenant le bouton qui y mène.
- **Trois réglages numériques n'étaient pas bornés.** Un champ vidé rend la chaîne vide, pas zéro :
  vider le timbre fiscal le mettait silencieusement à 0 sur toutes les factures à venir, et vider
  un délai donnait 0 jour sur un écran et 30 sur l'autre. Les six sont bornés, et le test les
  déduit du formulaire — un septième réglage ajouté demain ne pourra pas y échapper.
- **Un sélecteur de couleur ressemble à un bouton, pas à un trait de séparation.** Il s'étirait sur
  toute la largeur du champ. Mesuré dans l'application, pas déduit du fichier : la règle commune
  portait quatre `:not()` et gagnait en silence.

## 7.10.0 — 12/09/2026

**L'aide décrit l'application d'aujourd'hui.**

Une aide qui a six versions de retard ne se contente pas d'être incomplète : elle fait douter de
tout le reste, et on n'y revient plus.

- **L'article « Démarrer » contredisait le panneau qui y mène.** L'accueil affiche sept étapes —
  « Compléter ta fiche société », « Enregistrer ton premier client »… — et son lien menait à
  « les cinq premières minutes », qui en donnait cinq autres, dans un autre ordre. Quelqu'un qui
  suit la notice ne faisait pas ce que l'application lui demandait. L'article reprend les sept
  étapes, mot pour mot et dans le même ordre, et un test empêche les deux de diverger à nouveau.
- **L'article Comptabilité annonçait « quatre onglets » ; la page en a sept**, et les trois
  nouveaux — Écritures, Clôtures, Cabinet — n'y figuraient nulle part. Plus largement, **vingt
  libellés d'onglets sur quarante-cinq n'étaient nommés dans aucun article** : on ne peut pas
  chercher un mot qu'on n'a jamais lu. Chaque page à onglets les nomme maintenant en une phrase.
- **Trois textes parlaient au futur de modules livrés depuis un an** : « à partir de la version
  4.0, ce bon sortira les articles du stock », « pour que les modules stock et immobilisations
  n'aient pas à te faire tout ressaisir », « quand ils arriveront ». Ils disent désormais ce que
  le champ fait aujourd'hui.
- **L'article « Raccourcis clavier » en oubliait six**, dont celui qui ouvre l'aide (⌘ ?) et celui
  qui revient en arrière (⌘ [). Le menu de l'application est maintenant la source de vérité, et un
  test le vérifie raccourci par raccourci.
- **« Retenue à la source opérée » et « subie » s'affichaient l'une sous l'autre**, avec des
  numéros de compte voisins, et rien dans toute l'application ne les distinguait — deux mots de la
  même famille pour deux choses opposées. La différence est écrite là où on les voit côte à côte.
- **Un en-tête de colonne peut porter une bulle « i » depuis la 7.0.0, et pas une seule ne s'en
  servait** — alors que c'est exactement là que vivent les abréviations. VNC, Dotation, Coût moyen,
  Débit et Crédit ont la leur.

## 7.9.0 — 12/09/2026

**Un même geste porte partout le même nom et le même habit.**

Rien de neuf ici : que des divergences accumulées au fil des quinze modules. Chacune est minuscule,
et ensemble elles obligent à **relire** chaque bouton au lieu de le reconnaître.

- **« Exporter en CSV » avait quatre libellés** — « Exporter (CSV) », « Exporter en CSV (Excel) »,
  « Exporter le registre (CSV) », « Exporter en CSV » — sur onze boutons. Un seul, désormais. Et
  aucun n'est plus le bouton coloré : exporter n'est l'action principale d'aucun écran, et il ne
  peut pas y avoir deux boutons colorés sur un écran.
- **Le bouton qui annule les filtres portait trois libellés, deux styles et deux identifiants**
  selon la page. Les cinq écrans qui s'en écartaient passent par la même fonction que les six
  autres : le prochain écran de liste l'héritera sans qu'on y pense.
- **« Modifier » était une action bordée sur quatre listes et du texte nu sur huit autres.** Les
  pictogrammes (✕, ⧉) gardent leur forme légère — elle porte déjà le sens ; le texte reprend sa
  bordure partout. Et les boutons de ligne passent de 45 % à 70 % d'opacité : sur fond blanc, une
  pastille grise à 45 % passe pour désactivée.
- **Le champ « Rechercher » n'était pas stylé sur cinq pages** : une petite boîte native, non
  dimensionnée, dont le texte était coupé au milieu d'un mot — à côté de six listes correctes. La
  règle CSS énumérait les types à styler et avait oublié `search` ; elle exclut maintenant ceux qui
  doivent rester natifs, donc le prochain type sera juste d'office.
- **Deux bulles « i » identiques se touchaient** dans la barre de filtres des Devis, même glyphe,
  même infobulle : impossible de savoir laquelle explique quoi — et les deux textes se recouvraient
  déjà presque mot pour mot. Une seule, désormais.

## 7.8.0 — 12/09/2026

**Un écran vide doit apprendre quelque chose.**

- **Les états vides décrivaient un itinéraire au lieu d'offrir un bouton.** « Aucun devis. Crée le
  premier avec le bouton en haut à droite » demande de retenir une phrase, de lever les yeux et de
  retrouver le bon bouton. Devis, Factures, Relances, Facturation récurrente et « À immobiliser »
  disent maintenant **à quoi sert la page** — ce qu'est un devis, pourquoi une facture n'est plus
  modifiable, que la page Relances se remplit toute seule et qu'il n'y a rien à y saisir — et
  portent les vrais boutons.
- **Une barre de recherche et des filtres s'affichaient au-dessus de zéro ligne.** Ils occupaient
  exactement la place où devrait vivre l'explication, et laissaient croire que quelque chose était
  filtré. Ils se taisent désormais sur une liste vide — mais restent, évidemment, quand la liste est
  vide **à cause** d'un filtre : sinon on ne pourrait plus le retirer.
- **Deux écrans te félicitaient pour un travail que tu n'as pas commencé** : « Rien en attente de
  paiement. Tout est encaissé. » à quelqu'un qui n'a jamais émis de facture, et « Toutes les lignes
  d'achat marquées immobilisation ont leur fiche » à quelqu'un qui n'a jamais saisi d'achat. La
  règle existait depuis la 7.0.0 pour l'accueil ; elle s'applique partout.
- **La page TVA affichait en vert « Crédit de TVA reportable sur la période suivante »** sur un mois
  sans une seule vente ni un seul achat — parce que le montant à reverser vaut alors zéro. Elle
  nomme maintenant le cas, explique ce qu'elle calculera, et le tableau des douze mois ne s'affiche
  plus tant qu'aucun mois ne porte de montant. Au passage, sa branche « Rien à déclarer » était du
  **code mort** : elle ne pouvait jamais s'afficher, et faisait croire à la relecture que le cas
  était traité.

## 7.7.0 — 12/09/2026

**Les trois derniers constats graves : le geste qui rapporte, le devis oublié, le bouton qui ment.**

- **Facturer un devis était la seule porte de toute l'application.** Un bouton gris « Facturer ▾ »,
  dont le contenu est invisible avant le clic, à l'intérieur du devis — sans aucun double dans la
  liste, ni dans la recherche, ni sur la fiche client. Le panneau « À faire » en était réduit à
  écrire l'itinéraire : « Ouvre le devis puis « Facturer ▾ » ». Une application qui doit décrire son
  propre chemin décrit surtout un bouton mal placé. Dès que le client a dit oui, **« Facturer ce
  devis » est le bouton coloré** de l'éditeur (les deux autres chemins — acompte, solde — restent
  dans un ▾ accolé), et **chaque ligne de la liste porte son bouton « Facturer »**.
- **Un devis envoyé autrement que par le bouton Email restait « brouillon » à vie.** C'était le seul
  endroit du code qui faisait avancer son statut. Envoyé par WhatsApp, imprimé, remis en main
  propre : il n'était ni relancé, ni compté dans ton taux de transformation, ni jamais déclaré
  expiré — alors que son PDF, qui porte déjà son numéro, est indiscernable d'un devis envoyé. Après
  l'export, l'application pose la question une fois : « Ce devis part chez ton client ? ». Et le
  rappel des vieux brouillons, qui comptait devis et factures ensemble mais renvoyait toujours vers
  la liste des **factures** — où un devis ne peut pas figurer —, s'est scindé en deux lignes qui
  mènent chacune à leur propre liste.
- **Sur Paie et Stock, le gros bouton vert de l'en-tête ne suivait pas l'onglet ouvert.** Sur
  « Congés », il disait « + Salarié » pendant que « + Congé ou absence », le vrai geste, était un
  bouton vert **plus petit**, plus bas, dans le panneau : deux boutons verts sur l'écran, et le
  mauvais à la place canonique. L'en-tête se redessine maintenant avec le corps, comme le Catalogue
  le fait depuis la 1.9.0 — un seul bouton vert par écran, et c'est celui de l'onglet.

## 7.6.0 — 12/09/2026

**Le jeu d'exemple ne doit jamais toucher au vrai.**

Trois constats graves du contre-audit, sur le terrain même que la 7.0.0 croyait avoir traité.

- **L'exemple posait un faux matricule fiscal et un faux RIB dans ta fiche société, et plus rien ne
  les enlevait.** La 7.0.0 jugeait l'identité « empruntée » sur la seule raison sociale — or
  l'assistant t'invite explicitement à laisser le matricule et le RIB vides (« si tu ne l'as pas
  encore, laisse vide »). L'exemple les remplissait alors avec les siens, ton nom étant là,
  l'identité n'était pas considérée comme empruntée, et ni la sortie de l'exemple ni « Tout effacer »
  ne les reprenaient. Les trois contrôles de conformité ne regardent que la **présence** d'une
  valeur : l'application affirmait donc en vert « tes documents sont en règle » sur un matricule
  inventé. L'exemple note maintenant ce qu'il a emprunté, champ par champ, et le rend — tu retrouves
  ta fiche telle que tu l'avais laissée : incomplète, mais vraie, et l'application te le redit.
- **« N'envoie rien à personne depuis ici » était affiché sur chaque page, et rien ne le tenait.**
  Six gestes sortaient de l'ordinateur sans contrôle : l'email au client, la déclaration CNSS, le
  journal, les écritures, la fabrication et l'envoi du paquet mensuel. Ils demandent maintenant si
  tu veux repartir de tes vraies données. Le PDF, lui, ne se bloque pas — le regarder est
  l'apprentissage même : il porte la mention **EXEMPLE**. Les quatre chemins qui produisent un PDF
  passent désormais par la même fonction ; trois recopiaient cette décision à la main, donc un
  tampon posé à un seul endroit en aurait manqué trois sur quatre.
- **Charger l'exemple détruisait le travail de l'assistant sans question et sans sauvegarde.** Le
  contrôle ne regardait que deux listes sur vingt (documents et clients) ; l'assistant en remplit une
  troisième, le catalogue de ton métier. Qui finissait l'assistant puis cliquait « Voir un exemple
  rempli » perdait ses prestations en silence — pendant que l'aide promet « tes données sont mises
  de côté avant ». La question nomme maintenant tout ce qui sera remplacé, et la sauvegarde est
  prise **sans condition** : elle coûte un fichier, et c'est le seul chemin de retour.
- Au passage, un vrai bug trouvé par le parcours : le panneau de lecture de factures écrivait dans
  un écran déjà remplacé quand on quittait les Paramètres pendant son chargement, puis cherchait ses
  boutons dans la page vivante — exception silencieuse. Deux panneaux redemandent désormais leur
  élément après l'attente.

## 7.5.0 — 12/09/2026

**Revenir en arrière.**

- **Restaurer une sauvegarde existait dans le moteur depuis la 7.0.0, et aucun écran ne l'appelait.**
  Seule la sortie du jeu d'exemple s'en servait. À quelqu'un qui venait de perdre quelque chose,
  l'application proposait une seule issue : « Importer et choisis un fichier de ce dossier » —
  c'est-à-dire naviguer dans un dossier caché, y reconnaître un nom de fichier, et remplacer **tout**
  sans savoir ce qu'on perd. Le jour où on en a besoin est le pire jour pour apprendre un chemin.
  Paramètres → Sécurité et données liste maintenant les sauvegardes avec leur date et ce qu'elles
  étaient (« Juste avant « Tout effacer » », « État du matin »…), et « Restaurer… » dit d'abord ce
  que contient la sauvegarde et ce que tu as aujourd'hui. L'état actuel est mis de côté juste avant :
  **le geste se défait**, y compris un « Tout effacer » cliqué trop vite.
- **Les sauvegardes nommées étaient purgées par ordre alphabétique.** « avant-demo »,
  « avant-effacement » et « avant-import » passent toujours avant « manuelle-… » : les trois filets
  partaient donc les premiers, et celui qu'on venait de prendre disparaissait à la seconde où il
  servait — pendant que l'écran annonçait qu'une sauvegarde est faite avant. Une purge se fait par
  **date**, jamais par nom. Le même défaut avait été corrigé dans l'app du cabinet en 6.8.1 ; il
  n'avait jamais été porté ici.

## 7.4.0 — 12/09/2026

**Trouver sans savoir où c'est.**

- **La recherche générale existait depuis la 1.5.0 et n'était écrite nulle part dans la fenêtre.**
  Ni champ, ni bouton : seulement un raccourci clavier, mentionné dans le menu natif « Affichage » et
  dans l'avant-dernier des trente-deux articles d'aide. Beaucoup de débutants n'emploient aucun
  raccourci — pour eux, le meilleur outil de l'application n'existait pas. Un champ **Rechercher…**
  est posé en haut de la barre de gauche, au-dessus du menu : il ne défile jamais, il se clique, et
  il écrit la touche (⌘K ou Ctrl K) pour qu'on l'apprenne en le lisant.
- **La recherche ne connaissait aucun onglet.** « TVA » ne rendait que des articles à lire, et
  « cabinet », « mise à jour », « écritures », « calendrier fiscal », « apparence » ne rendaient
  **rien du tout** — deux réponses vides d'affilée, et on en conclut que la chose n'existe pas.
  Elle existait : sept onglets de Comptabilité, huit de Paramètres, et un onglet n'a de nom qu'une
  fois la page ouverte. Les quarante-six onglets de l'application sont maintenant engendrés à partir
  des tableaux qui les dessinent — un onglet ajouté demain sera trouvable le jour même — et les mots
  qu'on tape vraiment y mènent : « maj », « backup », « mot de passe », « logo », « démo »,
  « assistant », « pointer », « clôturer ».
- **La barre repartait en haut à chaque navigation** : sur Comptabilité, Paie et Statistiques,
  l'entrée allumée était cent pixels sous le bord et **aucune entrée en vert n'était visible**. On
  arrivait au bon écran sans apprendre où il vit dans le menu.
- **« Tous les modules » était la dernière entrée du menu** — donc la première à passer sous la
  coupe, mesurée hors champ dès 1366×768. Une porte de sortie hors champ n'est pas une porte de
  sortie : elle est dans le pied de la barre, avec Paramètres et Aide.
- **« Contrats » menait aux contrats récurrents**, et le contrat que ton client signe était un onglet
  d'« Autres documents ». Qui voulait rédiger un contrat cliquait « Contrats », tombait sur des jours
  de facturation et concluait que SkanFact n'en fait pas. Les deux pages s'appellent maintenant
  **Facturation récurrente** et **Proforma, bons et contrats** — dans le menu, en haut de la page et
  dans la recherche.
- **Douze pages partageaient l'infobulle de leur module** : Trésorerie, Marges et Statistiques
  affichaient au survol exactement la même phrase, l'infobulle affirmait donc trois fois que les
  trois font la même chose. Chaque page a la sienne.
- **L'article « Démarrer » envoyait encore dans la Zone sensible** pour voir l'exemple, et conseillait
  « Tout effacer » pour en sortir — c'est-à-dire le chemin le plus long, puis le plus effrayant, puis
  le mauvais : « Tout effacer » efface pour de bon, il ne rend rien. Réécrit, et « Charger l'exemple »
  a quitté l'encadré rouge pour son propre panneau : une sauvegarde est prise, la société est
  conservée, un bandeau permanent offre le retour — ce n'est pas un geste dangereux.

## 7.3.0 — 12/09/2026

**Où tombe l'argent — et le mois vide qu'on félicitait.**

Deux constats graves du contre-audit, tous deux vérifiés à la main avant d'y toucher. Ce ne sont pas
des défauts d'ergonomie : ce sont des chiffres faux et une phrase fausse.

- **Aucun écran ne permettait de dire sur quel compte tombe un encaissement ou un règlement.**
  Depuis la 3.3.0, le calcul de trésorerie lit ce compte sur chaque paiement — et **rien ne
  l'écrivait** : ni le formulaire de paiement client, ni celui de règlement fournisseur n'avaient le
  champ. Un client qui te règle 300 DT en espèces faisait donc monter ton compte **bancaire**, et ta
  caisse ne bougeait pas. Ton rapprochement ne pouvait pas tomber juste. Pendant ce temps, la bulle
  « Compte par défaut » parlait des paiements « pour lesquels tu n'as rien précisé » — sans qu'il
  existe nulle part un endroit où le préciser — et la page Trésorerie renvoyait sur la facture en
  disant « ils se modifient là-bas », c'est-à-dire là où le champ n'existait pas.
  Le champ est posé des deux côtés, il n'apparaît qu'à partir de deux comptes (avec un seul, il n'y
  a pas de choix à faire), et la liste des paiements affiche la colonne Compte.
- **Un paiement ne se modifiait pas.** La seule action de sa ligne était « ✕ » : une erreur de
  compte, de date ou de mode obligeait à supprimer et resaisir. Sans ce bouton, tout ce qui a été
  saisi jusqu'ici resterait sur le mauvais compte pour toujours. Un bouton ✎ ouvre le paiement, et
  changer sa date repasse par le contrôle de clôture — dans les deux sens, l'ancienne comme la
  nouvelle.
- **Comptabilité → Cabinet écrivait en vert « Rien à signaler : le dossier du mois est complet »
  sur un mois où il n'y a rien**, annonçait neuf fichiers et armait le bouton d'envoi. La liste des
  manques ne signale que ce qui existe : sur un mois sans une seule pièce elle est vide, et c'était
  la seule alternative à la félicitation. L'écran nomme maintenant ce qui se passe — « ce mois ne
  contient aucune pièce » — compte zéro fichier et refuse de fabriquer le paquet.

Nouveau test de bout en bout : `npm run e2e:argent` fait le geste en entier dans l'application
réelle — deux comptes, une facture émise, un règlement en espèces, la caisse qui monte et la banque
qui ne bouge pas, la correction du paiement, puis le mois vide.

## 7.2.0 — 12/09/2026

**L'assistant ne demandait jamais de quoi tu as besoin.**

La 7.0.0 avait construit tout le tri des modules : la liste, la règle qui empêche de masquer ce qui
contient quelque chose, la page « Tous les modules », le bandeau de rattrapage — et la table qui
relie ton métier aux modules dont tu as besoin. **Cette table n'avait aucun appelant.** Tu déclarais
« Conseil » à un écran, et l'écran suivant t'ouvrait les dix-sept entrées du menu, Paie et
Immobilisations comprises, le jour où tu n'avais pas encore un seul client.

- **Un septième écran : « De quoi as-tu besoin ? »** Six cases, déjà posées d'après le métier que tu
  viens de déclarer, chacune avec la phrase qui dit à quoi elle sert. Devis, clients et comptabilité
  sont toujours là. Résultat mesuré dans l'application : **dix entrées au menu au lieu de dix-sept**.
  Rien n'est supprimé ni désactivé : une page retirée reste atteignable par la recherche, et un
  module qui contient quelque chose revient tout seul. Qui passe l'assistant garde tout affiché.
- **L'écran « Ton activité » se traversait sans rien cliquer**, la case « Préremplir mon catalogue »
  cochée d'office. Le catalogue n'arrivait pas, le taux de TVA du métier n'était pas réglé, et une
  bulle d'aide affirmait ailleurs que l'assistant l'avait fait. Le choix est maintenant demandé —
  « Autre activité » existe pour ceux qui ne se reconnaissent nulle part.
- **Rien n'était écrit entre deux écrans.** Fermer la fenêtre au cinquième effaçait les cinq, alors
  que « Passer » — geste bien plus radical — les conservait depuis la 7.1.1. L'assistant reprend
  maintenant là où il s'est arrêté.
- **L'écran de sauvegarde annonçait « Copie activée » quand la copie venait d'échouer.** Un dossier
  iCloud pas encore synchronisé ou une clé en lecture seule donnaient le même message rassurant que
  le succès — sur le seul écran dont le sous-titre dit qu'il ne faut pas le sauter. Il montre
  désormais l'état réel, à l'ouverture comme après le choix.
- **La retenue à la source était le seul champ libre de l'application** : partout ailleurs c'est une
  liste fermée (Aucune / 1,5 / 3 / 5 / 10 / 15 %). C'était aussi le premier endroit où on la
  rencontre, et un nombre tapé au hasard amputait toutes les factures à venir.
- **Créer un second dossier demandait le nom de l'entreprise deux fois**, sous deux libellés
  différents, le second champ vide. Il arrive prérempli, avec la phrase qui relie les deux.
- **« Revoir l'assistant » était introuvable** : rangé dans un panneau qui parle du menu, cinquième
  de sept, dans le sixième des huit onglets de Paramètres, et absent de la recherche. Il est
  maintenant en tête de **Paramètres → Société**, dans la palette, et l'article « Démarrer » le nomme.
- **Un devis s'exportait sans aucun contrôle de fiche société.** L'avertissement « il manque ton
  matricule fiscal » n'existait que pour les factures — or la première pièce qu'on fabrique est un
  devis, et il partait chez le premier client avec un nom et rien d'autre. Une question, une seule
  fois, avec le bouton qui mène à la fiche.

## 7.1.2 — 12/09/2026

**Quatre gestes qu'on ne pouvait pas faire, et dont rien ne disait pourquoi.**

- **La case « numéro de série » n'existait pas à l'écran.** Elle vivait *à l'intérieur* du bloc que « Suivi en stock » masque : quelqu'un qui venait de lire « coche l'option sur une prestation du catalogue » ouvrait la fiche et ne la trouvait pas. Elle est maintenant à côté de « Suivi en stock », toujours visible — et la cocher coche le suivi en stock, dont elle dépend, au lieu de se faire annuler en silence à l'enregistrement.
- **Le panneau « Pièces jointes » n'apparaissait qu'après l'enregistrement.** Quelqu'un qui saisissait sa première facture d'achat avec la photo du ticket ouverte à côté ne trouvait aucun endroit où l'accrocher. Le panneau est là dès le départ : il explique qu'une pièce jointe a besoin d'un document enregistré, et propose de l'enregistrer tout de suite.
- **Une facture en brouillon ne pouvait être envoyée nulle part.** Sa ligne était la seule de la liste sans bouton Email, et aucun écran ne disait pourquoi. Le bouton existe désormais partout : sur un brouillon, il explique qu'une facture part chez un client avec son numéro, annonce lequel elle prendra, et propose « Émettre puis envoyer ».
- **Les deux messages qui envoyaient chercher les numéros de série** décrivaient un geste au lieu de le proposer. Ils portent leurs boutons.

## 7.1.1 — 12/09/2026

**Une facture émise ne change plus de total quand on change un réglage.**

C'est la faute la plus grave trouvée aujourd'hui. `computeTotals` relisait le timbre fiscal **dans les Paramètres, à chaque affichage**. Le jour où l'État change le timbre — et où l'utilisateur met son réglage à jour — le total de **toutes les factures déjà émises, envoyées et déclarées** changeait avec lui : le PDF chez le client disait 1 191, l'application disait 1 192, et le journal des ventes suivait l'application.

La règle existe pourtant depuis la 5.0.0 pour les bulletins de paie (« un bulletin garde une copie de son calcul ») ; elle n'avait jamais été appliquée aux factures. Le timbre se **fige maintenant à l'émission**, en même temps que le numéro : les deux deviennent définitifs au même instant. Les pièces déjà émises sont figées par la migration sur la valeur en vigueur aujourd'hui — sans ça elles resteraient à la merci du prochain changement. Un brouillon, lui, suit le réglage courant : il n'est encore rien.

### Ce qui manquait dans les Paramètres

- **« Choisir les modules affichés… »** : la page existait depuis la 7.0.0 et n'était atteignable que par la barre latérale et la recherche.
- **« Revoir l'assistant de démarrage… »** : l'assistant ne s'affichait qu'**une seule fois dans la vie de l'installation** (`needsSetup` exige qu'il n'y ait ni société, ni document, ni client), et « Passer » le condamnait pour de bon. Il se rejoue, prérempli avec les réglages actuels, et ne réécrit que ce qu'on lui redonne.
- **« Passer » conserve ce qui vient d'être tapé.** Quelqu'un qui avait rempli quatre écrans et cliquait « Passer » au cinquième repartait avec une fiche société vide, sans que rien ne le prévienne.
- **Choisir un dossier de copie coche l'étape tout de suite** — l'état n'était lu qu'au démarrage, donc « Mettre tes données à l'abri » restait décoché jusqu'au lendemain.

`npm run e2e:reglages` parcourt les quatre dans l'application réelle.

## 7.1.0 — 12/09/2026

**Suite de l'audit : le taux de TVA qui ignorait le métier, et l'aide que rien n'atteignait.**

### Une ligne neuve suit ton métier

L'assistant sait depuis la 2.0.0 que « Santé et paramédical » est exonéré : il préremplissait donc le catalogue à 0 %. Mais **toute ligne tapée à la main naissait à 19 %**, parce que le taux était écrit en dur à huit endroits. Le même document portait les deux taux, et celui de trop était celui qu'il ne faut pas facturer.

- `company.defaultVatRate`, posé par l'assistant d'après le métier déclaré et modifiable dans **Paramètres → Documents**. `0 %` est une valeur légitime : le code la distingue d'un réglage absent.
- Côté **achat**, le taux reste celui du fournisseur : une entreprise exonérée paie quand même la TVA de ses fournisseurs. C'est écrit dans le code, à l'endroit où on se poserait la question.

### « Comprendre cette page → »

Trente-deux articles d'aide existaient et **aucune page n'y menait**. Le lien est maintenant posé une seule fois, dans le routeur — dix-huit en-têtes à modifier à la main, c'est dix-huit endroits qu'on oublie au prochain module. Un test vérifie que chaque page du menu a son article, et qu'aucune ne renvoie à un article disparu.

### « Tes premiers pas » sait s'arrêter

Le panneau ne s'affiche plus que pendant le **démarrage**. Une fois une facture partie, il proposait « crée ton premier client » à quelqu'un qui a deux ans d'activité — et reprenait tout l'écran, exactement le défaut qu'il corrige. Quand la copie de sauvegarde est la seule étape qui manque, elle devient une ligne de « À faire » : c'est l'étape que tout le monde saute, et la seule dont l'absence coûte tout.

*Au passage : le garde-fou « aucun bouton ne mène nulle part », posé le matin même, a attrapé cette nouvelle ligne avant qu'elle ne parte avec un bouton muet.*

## 7.0.1 — 12/09/2026

**Deux erreurs de montant, trouvées par l'audit et vérifiées avant d'y toucher.** Ce ne sont pas des défauts d'ergonomie : ce sont des chiffres faux sur des pièces officielles, et rien à l'écran ne les montrait.

### Le timbre fiscal valait « 1 », pas « 1 dinar »

Le timbre est une taxe **fixée en dinars** par l'État. Sur une facture en euros, l'application l'ajoutait tel quel : **1 euro au lieu de 1 dinar, soit 3,4 fois trop cher**. Il se convertit désormais dans la devise du document. Un devis n'a toujours pas de timbre, dans aucune devise.

*Le test qui couvrait ce cas depuis la 1.6.0 affirmait le défaut : il attendait un total de 1 191,00 € sur une facture dont le total correct est 1 190,29 €. Une assertion écrite en recopiant ce que le code produisait ne prouve rien — elle grave le bug.*

### Un taux de change vide faisait compter 1 EUR = 1 DT

Le champ « Taux » pouvait rester vide sans que rien ne bloque. Toute la comptabilité comptait alors les euros comme des dinars : le journal des ventes, la **TVA à déclarer**, le chiffre d'affaires, le tableau de bord, et le paquet envoyé au comptable — faux d'un facteur trois, **en silence**.

- Le taux devient **obligatoire** dès qu'une devise étrangère est choisie. C'est le seul champ dont l'oubli change des chiffres ailleurs sans rien afficher là où on le saisit.
- Les pièces déjà enregistrées sans taux remontent **en rouge** dans « À faire » : elles faussent déjà la déclaration.

## 7.0.0 — 12/09/2026

**« Soit t'es pro soit tu te prends la tête. »** Skander, propriétaire de SkanFact, ne savait pas s'en servir. En six semaines l'application est passée de « devis et factures » à quinze modules ; chacun est arrivé avec son aide et ses bulles, aucun n'a été livré avec une révision de l'ensemble. Le résultat n'était pas une application mal faite, c'était une application **faite pour quelqu'un qui sait déjà**.

Quatre chiffres, mesurés dans l'application réelle :

| | |
|---|---|
| Le bouton **Aide** était hors de l'écran sur **toutes** les tailles d'écran courantes | `nav` demandait 866 px ; il en avait 705 à 1440×900, 563 à 1366×768 |
| **52 états vides sur 58** n'avaient aucun bouton | ils écrivaient le geste en prose, à retenir puis à refaire ailleurs |
| **13 boutons de « À faire »** ne faisaient rien du tout | ni message, ni erreur, ni navigation |
| **« Tout effacer » vidait 7 listes sur 30** | et pouvait laisser une fausse identité sur de vraies factures |

### Le bouton qu'on cherche quand on est perdu

- **« Paramètres » et « Aide » descendent dans le pied de la barre latérale**, qui ne défile jamais. Ils étaient en bout de `nav` : à 1440×900, cinq entrées sur dix-neuf étaient hors champ, et « Aide » l'était même sur un écran de 1050 px de haut — derrière une barre de défilement que macOS masque tant qu'on ne fait pas défiler. L'article « Démarrer » y renvoie onze fois.
- **La navigation devient une donnée** (`core.PAGES`, `core.MODULES`) au lieu de dix-neuf liens écrits à la main dans `index.html`. Le titre de la fenêtre se lisait dans le *texte* du lien ; il vient maintenant de la même source.
- **Les modules qu'on n'utilise pas sortent du menu, jamais de l'application.** Une page **« Tous les modules »** les recense, la palette les trouve toujours, leur adresse fonctionne, et un bandeau explique et propose de les remettre. **Un module qui contient quelque chose revient tout seul et ne se laisse plus décocher** — on ne cache jamais le travail de quelqu'un. Sans réglage enregistré, tout s'affiche : une installation existante ne perd rien.
- Les intertitres deviennent des verbes — **Vendre, Acheter, Piloter**. « Fichiers » a disparu : personne ne cherche un client dans « Fichiers ».
- Quand la barre déborde vraiment, **elle a l'air de déborder** (barre de défilement forcée).

### Le premier jour

- **« Tes premiers pas »** : sept étapes dont l'état est **déduit des données**, jamais coché à la main, chacune avec son bouton. Le panneau remplace les quatre compteurs à « 0,000 DT », le graphique de douze mois vides et le « Top clients » vide — 548 px avant la première phrase utile — et disparaît tout seul quand tout est fait.
- Le premier message de l'application n'est plus **un toast de 2,6 secondes** qui nommait un onglet de Paramètres invisible dans la barre latérale.
- **« Voir un exemple rempli » charge enfin l'exemple.** Il déposait l'utilisateur dans Paramètres, devant un encadré rouge « Zone sensible », avec un toast qui nommait l'onglet où chercher le vrai bouton.
- **« Rien à faire aujourd'hui »** ne félicite plus quelqu'un qui n'a jamais rien facturé.

### « Y'a des choses qu'on arrive pas à faire et on ne comprend pas pourquoi »

- **Treize boutons morts.** `todoList` produit 22 sortes de lignes ; `TODO_ACTIONS` en armait 9, et `bindTodo` faisait `if (a) a.run()` — le clic était avalé en silence. Sur le tableau de bord du jeu d'exemple, **7 boutons sur 13** ne faisaient rien. Tous branchés ; un test interdit d'en refabriquer un ; et si jamais il en revenait un, l'application le **dit** au lieu de se taire.
- **Une pièce émise** montrait vingt champs gris, une explication de 12 px sous le titre, et cachait sa seule sortie dans « Plus ▾ ». C'est un **bandeau** qui dit la règle et porte « Corriger par un avoir… » et « Modifier quand même… » — ou, quand ce n'est plus possible, pourquoi.
- **Un refus se dit d'une seule façon.** `closedToast` disparaît : c'était le même refus que `closedBlock`, dit une fois avec un bouton « Aller aux clôtures » et une fois en bandeau de deux secondes et demie qui nommait l'endroit sans y mener.
- **Une saisie refusée amène le champ à l'écran**, y met le curseur et le marque en rouge, au lieu d'annoncer « ajoute une désignation » pendant qu'on regarde le haut d'un devis de huit lignes.
- Le **« ✕ » de la dernière ligne d'un achat**, éteint et muet alors que le même bouton marche côté vente.
- **« À faire » se hiérarchise enfin.** Le commentaire promettait « du plus urgent au moins urgent » depuis la 1.10.0 ; l'ordre réel était celui dans lequel les modules ont été écrits — deux déclarations sociales **en retard** arrivaient neuvièmes, sous cinq lignes orange. Tri stable par urgence, cinq lignes visibles, « voir les N autres » : en démonstration, le panneau affichait treize corvées et mangeait l'écran entier.

### Les mots

- **Le glossaire passe de 17 à 59 entrées.** Il s'était arrêté à la 2.0 : seize mots de vente, et pas un seul des quinze modules ajoutés depuis. VNC, assiette, prorata temporis, partie double, coût employeur, marge sur coûts variables, empreinte, provisoire/définitif… Un test vérifie que chaque mot affiché dans l'interface y est défini.
- **Une bulle mène à l'article qui développe.** Les 275 explications étaient des culs-de-sac : elles laissaient avec une question plus précise et nulle part où aller.
- **Un en-tête de colonne peut porter une bulle** — c'était le seul endroit de l'application où c'était impossible, et c'est là que vivent presque toutes les abréviations.
- **Une recherche dans l'aide**, qui lit aussi le corps des articles : buter sur « assiette » et devoir deviner lequel des trente-deux articles en parle, ce n'est pas de l'aide.
- La barre latérale dit à quoi sert chaque page au survol.

### Le jeu d'exemple ne peut plus signer une vraie facture

Charger l'exemple avant d'avoir rempli sa fiche — ce que fait un débutant — donnait à l'entreprise le nom **« DÉMO — Société de services SUARL »**, un matricule et un RIB inventés. « Tout effacer » **gardait cette fiche** et laissait de faux fournisseurs, salariés, bulletins, immobilisations et comptes bancaires : elle ne vidait que 7 listes sur 30. La première vraie facture partait donc au nom d'une société qui n'existe pas, vers un compte où l'argent n'arrive jamais.

- La liste des choses à effacer **se déduit de la structure des données** : un module ajouté demain est vidé sans que personne y pense.
- Les données d'exemple **se déclarent**, et un bandeau permanent le dit sur chaque page.
- L'application entreprise gagne enfin la **restauration** que le cabinet a depuis la 6.8.0 : elle annonce ce qu'on va retrouver **avant** d'écraser quoi que ce soit. Revenir de l'exemple était jusqu'ici : Paramètres → Sécurité et données → Importer → retrouver le bon fichier dans le dossier des sauvegardes.

### Les instruments

- `npm run e2e:captures` — le photographe qui manquait : 20 pages, leurs onglets et quatre gestes, en vierge et en démonstration, aux deux largeurs qui comptent. CLAUDE.md décrivait cette méthode comme si `e2e:entreprise` la fournissait ; ce n'était plus vrai, et il fallait donc la réécrire à chaque audit.
- `npm run e2e:barre` — la barre latérale **mesurée** dans l'application réelle, sur quatre tailles d'écran.
- `npm run e2e:exemple` — charger l'exemple et en revenir, jusqu'au cas qui fait mal.

**217 tests**, neuf suites e2e. Chaque correctif de test prouvé en réintroduisant son défaut d'origine.

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
