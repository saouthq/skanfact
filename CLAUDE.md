# SkanFact — consignes pour Claude

Application desktop Electron (JS pur, sans bundler) de devis et factures pour une petite entreprise, dans le contexte fiscal tunisien. Propriétaire : Skander Ben Amor (saouthq), qui l'utilise pour SKANCYBER SECURITY SUARL. Il communique en français, tutoiement, débutant Git/terminal : il ne veut pas taper de commandes, Claude fait le travail en autonomie (commits, releases, vérification des builds). Quand quelque chose est incertain (fiscalité), le signaler par « À VÉRIFIER ».

**Depuis la 2.0.0, aucune entreprise n'est écrite en dur** : `DEFAULT_COMPANY` est vide et un assistant de première utilisation (`src/renderer/onboarding.js`) renseigne la société. Skander compte partager l'app avec sa famille, chacun gérant sa propre entreprise sur son ordinateur. Ne jamais réintroduire « SKANCYBER » ni le matricule 1998268D dans le code, les valeurs par défaut, le pied de page ou le jeu de démo. Exception : `build.appId` (`tn.skancyber.skanfact`) reste inchangé, c'est l'identifiant technique du paquet — le modifier casserait la mise à jour des apps déjà installées.

L'utilisateur est débutant en gestion (première entreprise) : chaque champ porte une bulle « i » (`src/renderer/guide.js`) et la rubrique Aide explique la facturation, la fiscalité et la routine comptable. Toute nouveauté doit venir avec sa bulle et, si elle change une habitude, un paragraphe dans l'article concerné. Un test vérifie que chaque clé posée dans l'interface existe dans `guide.js`.

> **⚠ RÈGLE IMPORTANTE — décidée par Skander le 24/09/2026, sans exception.** À la fin de CHAQUE
> lot, de CHAQUE correction et de CHAQUE développement, **tester comme un humain avec les outils**
> AVANT de commiter ou d'annoncer quoi que ce soit : `scripts/humain/lancer.sh entreprise|cabinet`,
> puis `scripts/humain/ecran.sh capture` (et LIRE l'image), `clic`, `taper`, `touche`, `defiler` ;
> Browser Use et Playwright branché par CDP pour vérifier une valeur après le geste. Le lot testé
> est celui qu'on vient d'écrire, pas un autre : on refait à la souris et au clavier le parcours
> exact qu'il change (l'écran neuf, le bouton neuf, la question neuve). Des tests unitaires verts et
> des e2e verts ne remplacent pas ce regard — les e2e cliquent des SÉLECTEURS, ce test clique des
> PIXELS. Motif : la 10.14.0 a livré la porte et la visite du Cabinet, tests verts, sans les avoir
> ouvertes une seule fois à la souris (« tu n'as pas testé ce que tu viens de faire »). Et **les lots
> restants se finissent sans s'arrêter** : on ne rend pas la main au milieu d'une liste.

## Index thématique

*Ce fichier est rangé par VERSION, dans l'ordre où les choses sont arrivées : c'est ce qui permet de
comprendre pourquoi une règle existe. Mais quand on cherche « la règle sur les dates » ou « celle
sur les tests qui lisent du code », l'ordre chronologique n'aide pas. Voici l'entrée par thème.
Chaque ligne renvoie à la section qui l'explique en entier — avec le défaut réel qui l'a fait
écrire, parce qu'une règle sans son défaut ne se retient pas.*

**Ce qui se casse en silence, et qu'aucune console ne montre**

| Symptôme | Où c'est expliqué |
|---|---|
| Un bouton visible et **inerte** (les clics atterrissent ailleurs) | 5.2.2 — l'ordre des couches ; 7.28.0 — le garde-fou global qui vole le clic |
| Un bouton qui **accepte le clic et ne fait rien** | 7.0.0 — les treize « Voir » sans action ; 7.17.0 — les écrans qui ne répondent pas ; 10.12.0 — « + Créer mon premier contrat », mort depuis la 7.8.0 : un formulaire ouvert avec `null` |
| L'application **gèle** sans erreur (Cmd+Q sans effet, défilement qui marche encore) | 5.2.3 — boucle infinie de date ; 6.5.0 — le chien de garde ; 8.1.0 — la veille n'est pas un gel |
| Un **écran blanc**, une fenêtre qui ne s'ouvre pas, rien en console | 7.20.0, 7.22.0, 7.23.0 — une fonction ou une variable d'un autre module ; 9.1.0 — le garde-fou d'erreur et le lint |
| Un **`var` local qui MASQUE une fonction du module** : elle vaut `undefined` dans tout le corps, y compris au-dessus de son affectation — `node --check`, le lint et le garde-fou du backtick passent tous les trois | 10.8.0 — le formulaire d'émission mort à sa troisième ligne |
| Un **texte illisible** (blanc sur blanc), un en-tête mal aligné, un fil vertical | 7.12.0, 7.23.0, 7.27.0, 7.30.0, 9.4.3 — le HTML est juste, c'est la feuille de style qui décide : **mesurer** ; 10.6.0 — un alignement d'en-tête se DÉDUIT de ses cellules |
| Une **exception qui échappe à un handler** : rien à l'écran qu'on ait écrit, rien au journal | 9.4.10 — `err.code` **ne traverse pas** le pont IPC |
| Une **version publiée que les applications ne voient pas** (« tu as la dernière version ») | 10.11.0 — la liste de l'API rend la release SANS ses fichiers ; une version téléchargée cachait la suivante |
| Un bouton **hors de l'écran**, une barre empilée sur trois rangées | 7.13.0, 7.23.0 — `e2e:contraste` et `e2e:entetes` mesurent le bouton, jamais la page |
| Un prix tapé **« 2,5 » qui devient 25** chez un client, juste chez l'auteur : un `type=number` suit la langue du SYSTÈME | 10.12.0 — H-E28, la langue posée par `main.js` avant `ready` ; un test qui POSE la valeur ne passe jamais par ce chemin, il faut TAPER les touches |
| Un **refus qui promet une sortie qui n'existe pas** (« contre-passe d'abord », puis la même phrase) | 10.12.0 — une écriture contre-passée libère ce qu'elle portait ; 10.14.0 — « déjà validés, contre-passe-les », puis la même phrase APRÈS la contre-passation : le miroir comptait comme des à-nouveaux |
| Un **identifiant vide** désarme tout ce qui compare des identifiants : un verrou qui ne reconnaît personne, une clôture « par cabinet » | 10.14.0 — le nom du poste naissait à la première annonce à la plateforme |
| Un **clic qui tombe à côté** : ce qui vient d'apparaître a poussé le formulaire, la frappe part sur la page | 10.12.0 — « Fiche du client » né sous le champ, 45 px ; le repère « non enregistré » qui fait passer l'en-tête sur deux rangées, 40 px (H-E19) |
| Un **clic qui ouvre autre chose que ce qu'il visait** : une proposition que personne n'a demandée s'est posée sous le curseur | 10.12.0 (H-E20) — « + Créer … au catalogue » sur la quantité et le prix |
| Une touche **Entrée qui agit DERRIÈRE la fenêtre** : une question sans champ laissait le curseur sur le bouton de la page, qu'Entrée re-cliquait | 10.13.0 — le choix de fichier rouvert par-dessus la question d'import ; le Cabinet faisait juste depuis la 10.12.0 |
| Une **bulle « i » seule sur sa ligne**, ou visible à côté d'un bouton caché : un bouton DANS un bouton | 10.12.0 — neuf cas, le parseur ferme le premier |
| Un **nombre tapé qui change sous les doigts** (« 28 » devient 82, ou 8) : un champ de nombre recréé rend son curseur au DÉBUT, et une sélection automatique prend le focus rendu par le code pour une entrée | 10.12.0 — l'inventaire ; un parcours qui `fill()` ne le voit jamais |
| Une **origine dite « vérifiée »** sur un fichier que n'importe qui peut signer : la signature ne se comparait à RIEN | 10.13.0 — la clôture d'un faux cabinet, qui verrouille un exercice |
| Un **bouton vert qui envoie un fichier périmé** : le paquet fabriqué AVANT la réponse | 10.13.0 — la réponse au comptable qui ne partait jamais |
| Une **liste coupée AVANT d'être classée** : la bonne réponse existe, et n'apparaît jamais | 10.14.0 — « audit » ne trouvait plus la prestation du même nom, derrière deux cents factures |
| Une **saisie perdue au premier « Enregistrer »** : la pièce était close, et rien ne le disait avant | 10.14.0 — un devis de 2022 sur l'exemple de cinq ans |
| Une **visite qui avance sur un geste annulé ou refusé**, et décrit ce qui n'existe pas | 10.14.0 — un clic n'est pas un geste fait : « Où il est rangé » sur « Aucun justificatif » |
| Une **ligne cachée sous l'en-tête collant** d'un tableau qu'on vient d'amener à l'écran | 10.14.0 — le 📎 de « Le trombone » ; un défilement s'arrête à la marge du haut |
| Un **lien vers un panneau** qui atterrit sur celui d'au-dessus : les panneaux du dessous se remplissent APRÈS le défilement | 10.14.0 — la pastille de licence du Cabinet ; 10.13.0 — « Lire la réponse » |
| Une **balance d'un mois qui compte l'ouverture deux fois** (le capital à 40 000 pour 20 000) : la contre-passation datée du jour, la nouvelle ouverture du 1er janvier — l'exercice entier, lui, tombe juste | 10.14.0 — l'écart se pose en à-nouveaux complémentaires ; un test qui regarde l'année ne le voit pas |
| L'application **ne répond plus** sur des données pleines, et le chien de garde la recharge en boucle | 10.14.0 (saturation) — un calcul qui LIT tout se fait dans un lot ; un index se construit une fois, jamais par pièce |

**Les chiffres**

| Règle | Où |
|---|---|
| Une date est un **jour de calendrier**, jamais un instant : arithmétique en UTC pur | 5.2.3 (et le lint l'interdit depuis la 9.1.0) |
| **Aucun taux n'est écrit en dur** dans un calcul | 5.0.0 — la paie ; 8.3.0 — la liste propose, elle n'enferme pas |
| Tout ce qui **additionne** plusieurs pièces se convertit dans la devise de base | 7.0.1 — le timbre en euros ; 7.16.0 — les cartes de l'accueil |
| Une pièce émise garde une **copie** de ce qui a servi à la calculer | 7.1.x — le timbre ; 5.0.0 — `slip.computed` ; 9.0.0 — les charges patronales |
| Un compteur et la liste qu'il annonce se calculent avec la **même fonction** | 6.8.1 — le bandeau des relances ; 7.15.0 — « Reste à encaisser » |
| Une **annonce** se calcule par les MÊMES constructeurs que ce qu'elle annonce | 10.12.0 — E-02, le solde d'acompte faux de deux timbres |
| Une fonction qui rend un montant **NATIF** piège chaque appelant qui additionne : la couverture se fait par appelant, jamais par fonction | 10.12.0 — E-08, la prévision en euros ; 10.1.0 |
| Un **argument facultatif** qui change un montant piège chaque appelant qui l'oublie : il se tient appel par appel | 10.14.0 — `purchaseBalance` sans `data`, un trop-payé prérempli |
| Un **fait fiscal naît à son fait générateur**, pas à la pièce qui l'annonce : la retenue à la source se déclare au mois du RÈGLEMENT — l'opérée comme la subie | 10.14.0 — 32,130 DT « à reverser » sur une facture jamais payée ; `retenueDesReglements`, `retenueSubie` |
| Un fait fiscal **se régularise à la date de la pièce qui le change**, jamais en réécrivant un mois déclaré | 10.14.0 — l'avoir de mai qui baissait la retenue de mars ; `retenueChrono`, `ajustements` |
| Un **règlement de tiers n'est pas un reversement** : ce qui touche la banque ET un 40x/41x compte dans la retenue | 10.14.0 — le remboursement au client qui disparaissait de la déclaration du Cabinet |
| Un **pense-bête qui ne regarde que devant** oublie ce qui est passé sans être fait ; une **date réglable** ne s'écrit pas en dur à côté | 10.14.0 — la CNSS du 2e trimestre sortie du calendrier ; `calendrierFiscal`, `dateLimiteSociale` |
| Un **régime qui ne récupère pas la TVA** en fait un coût, figé sur chaque achat ; sa réparation ne touche que les mois non clôturés, et s'annonce par la fonction qui déclare | 10.14.0 — `tvaRecuperable`, `achatsHorsRegime` |
| Un **taux affiché grisé** n'est pas un taux choisi : un formulaire qui lit les champs désactivés le range quand même | 10.14.0 — le 0 % du forfait rangé, des factures sans TVA au passage au réel ; un geste se teste aller ET retour |
| Une pièce qui en **diminue une autre** le fait dans la devise de celle qu'elle diminue ; à un **autre taux**, l'écart part au change (655/755) | 10.14.0 — l'avoir de 300 DT qui retranchait 300 € ; les 15 DT restés au 411 |
| Un **rangement d'états** écrit deux fois a la même faute deux fois : un emprunt dans les capitaux propres, en tombant juste | 10.14.0 — `groupesDesEtats` ; une rubrique ne contredit pas le nom que le plan donne à ses comptes |
| Une règle posée d'un côté du moteur (l'écriture) se cherche de l'autre (la déclaration) : la TVA d'un **acompte** se déduit une fois | 10.14.0 — septembre annonçait un crédit au lieu de 92 DT à reverser |
| Un mouvement d'argent enregistré existe dans les **deux livres** (Trésorerie et écritures) et se pointe | 10.14.0 — l'avance sur salaire qui ne sortait jamais de la banque |
| Des **cartes qui forment une équation** (valeur − cumul = VNC) la tiennent, l'année d'une cession aussi | 10.14.0 — le bien sorti compté à moitié, dans les deux applications |
| Un **coût moyen pondéré** dépend de l'ordre des gestes : un tri par identifiant est un ordre arbitraire | 10.12.0 — E-10, la vente sortie au coût de l'achat qui la suit |
| Deux écrans qui montrent la **même pièce** ne disent qu'un montant, et deux recherches sur le même corpus qu'une réponse | 10.12.0 — H-E25, la palette et la liste ; la palette et la page Aide |
| Un montant **négatif change de colonne**, il ne garde pas son signe | 6.3.0 — les écritures comptables |
| Un **agrégat** porte une devise, une unité, et une période nommée | 7.0.1, 7.16.0, 3.1.0 ; 9.4.9 — une courbe d'une barre cède la place au chiffre |
| Une donnée qui n'a pas de **case** se réinvente — et ce qu'on réinvente est faux | 9.8.5 — le tiers déduit du libellé, le compte nommé par la première écriture ; 10.9.1 — ou elle se perd en silence |
| Une facture se libelle à la **SOCIÉTÉ** ; deux champs d'un formulaire ne disent jamais la même chose | 10.9.1 — la pièce légale au nom d'un salarié |
| Une **pièce légale ne se contredit pas** (deux délais, deux montants) : un défaut qui la fait se contredire se corrige, la phrase de l'utilisateur se MONTRE — elle ne se réécrit jamais | 10.12.0 (H-E23) — « à réception » sur une facture à trente jours |
| Un compte porte un **nom de compte** ; un compte nommé par le cabinet ne se réécrit jamais | 9.8.5, 6.3.0 |
| Un **rapprochement faux** ferme la question : une ambiguïté n'est JAMAIS « certain » | 9.5.0 |
| Un **prix ne vient jamais du navigateur** ; ce qui prouve un paiement est la question qu'on REPOSE au prestataire | 10.9.0 |
| Ce qu'on **encaisse** est exactement ce que la facture dira — **timbre compris**, sinon la pièce reste due d'un dinar | 10.9.0 |
| Une écriture qui SOLDE un compte ne compte pas dans ce qu'elle déclare | 9.6.0 |
| Un taux qui dépend du **droit** se saisit ; un taux qui dépend d'un **calcul** se déduit | 9.7.0 — le coefficient dégressif |
| Le **prix d'une cession** ne s'invente pas ; la sortie d'actif, oui | 9.0.0, 9.7.0 |
| Un **lettrage généreux** affirme qu'une facture est payée : somme nulle, ou rien | 9.5.0 |
| Un **pied de totaux** porte la sélection entière, jamais la page affichée ; on pagine ce qu'on NOMME | 2.2.0, 7.16.0, 9.4.5 |
| Un **total sous une colonne** est lu comme sa somme : ce qui n'y entre pas le DIT, sur la ligne | 9.8.8 — l'IRPP hors du total à décaisser |
| Une **balance auxiliaire** ne somme que les comptes COLLECTIFS, et son total se confronte à la générale | 9.8.8 — douze clients « soldés » contre un 411 débiteur |
| Un **écart** se calcule avec ses DEUX termes, sinon il ne peut jamais atteindre zéro | 9.8.8 — l'écart de suspens sans le solde de départ |
| Une **liste de colonnes** et les lignes qui la remplissent se confrontent clé par clé | 9.8.8 — quatre colonnes vides dans chaque paquet depuis la 6.1.0 |
| La valeur par défaut d'une **règle qu'on ne connaît pas** est celle qui ne fait rien | 9.1.1 — le seuil de retenue à 0, la TFP qu'aucun métier ne porte ; 9.6.0 — une case fiscale vaut `null`, jamais 0 ; 10.8.0 — un droit illimité vaut `null`, jamais 99 999 |
| Une **réserve d'offre** se juge sur ce qu'elle fait au PAQUET, pas sur ce qu'elle retire de l'écran | 10.7.0 — on ouvre ce qui fausse, pas tout |
| Une écriture **validée** ne se modifie jamais : elle se contre-passe, à la date du jour | 9.2.0 |
| Une **extourne** n'est pas une contre-passation : l'originale reste dans son exercice, avec son numéro | 9.3.0, 9.8.0 |
| Les **à-nouveaux** se calculent sur les écritures réelles, jamais sur les à-nouveaux précédents | 9.0.0, 9.8.0 |
| Un **numéro** naît à la validation, et le contrôle passe AVANT l'attribution ; l'écran l'AFFICHE, il ne le recompte pas | 9.2.0 ; 6.0.0 — `nextNumber` ; 9.8.8 — T-52, le livre-journal qui renumérotait par date ; 10.14.0 — le Cabinet recomptait le numéro du client, et la recherche le changeait |
| Un **numéro qu'on n'a pas encore pris se LIT** (`etatNumerotation`), il ne se réserve pas (`nextNumber`) | 10.14.0 — l'aperçu de la prochaine facture ; 6.0.0 |
| On pointe une **occurrence**, jamais une règle ; et le pense-bête dit qu'il n'est qu'un pense-bête | 7.21.0, 5.2.0, 9.4.6 |
| Un **rôle** désigne le compte ; un préfixe écrit à part se trompe de compte | 10.12.0 — la déclaration d'employeur lisait le 65, la paie écrit au 645 |
| Une **dotation** se réclame à l'inventaire, au dernier mois ; une sortie d'actif, tout de suite | 10.12.0 |
| Un **écart d'ouverture** se pose en à-nouveaux COMPLÉMENTAIRES au 1er janvier, jamais par contre-passation puis nouvelle ouverture ; un **miroir** reste dans l'exercice de son livre | 10.14.0 — `poserComplementAnouveaux`, `dateDuMiroir` |
| Un **geste quotidien sans nature** se fait par la mauvaise : alimenter la caisse passait au compte courant de l'associé ; une promesse de fenêtre se vérifie dans les DEUX chemins | 10.14.0 — « Virement entre mes comptes », `compteDe` |
| Une **facture annulée** ne doit plus rien DANS la fonction qui calcule le reste, pas seulement dans les lecteurs qui pensent à la filtrer | 10.14.0 — `invoiceBalance().annulee` ; quatre filtres sur cinq lecteurs |
| Un **règlement en devise** bouge la banque au TAUX DU JOUR, solde le tiers au taux de SA pièce, et l'écart est un gain (755) ou une perte (655) | 10.14.0 — `montantRegle`, `ecartDuReglement` ; la règle des avoirs à un autre taux |
| Une **chaîne qui reporte** de mois en mois reporte aussi d'une année à l'autre : un crédit de décembre perdu au 1er janvier, c'est de la TVA payée en trop | 10.14.0 — `reportTvaDebut` ; 3.1.0 |
| Ce qui **manque à une écriture passée** se pose en COMPLÉMENT, compte par rôle ; et un **dépôt se pointe sur les chiffres qu'on recopie**, jamais sur une préparation périmée | 10.14.0 — `ecritureComplementDeclaration`, `ecartDeclaration` ; 215g |
| Un chiffre qu'une **page** montre existe dans les **écritures**, sinon le bilan ment | 10.14.0 — le stock valorisé depuis la 4.0.0, et le 37 dans aucune écriture |
| Une **TVA non récupérable** est un coût, et elle va où va la dépense (bien, stock, charge) | 10.14.0 — `coutAchat` |
| Un **mois** finit à son vrai dernier jour, et **février** compte en base 360 ; les douze mois font l'année | 10.14.0 — « arrêtés au 31/09 », `fin360` |
| Un **paquet envoyé** garde son sceau : un mois dont les écritures ont changé depuis le DIT, et propose de le refaire | 10.14.0 — `sceauEcritures`, `ecartsSceau` |
| Un **compte de passage** (425, 471, 409) se demande ce qui le solde : un salaire sans bulletin est une charge, pas une créance sur le personnel | 10.14.0 — `compteDuMouvement` |
| Une **échéance d'emprunt n'est pas une charge**, ses intérêts si ; deux résultats pour la même année, c'est un de trop — **le seuil de rentabilité compris** | 10.14.0 — `breakEven` bâti sur `simpleResult` |
| Une **liste qu'on peut prendre entière** (un classement, un « top ») refait le total qu'elle détaille, remise et acomptes compris | 10.14.0 — `topItems` |
| Une **prévision projette tout ce qui est engagé** (salaires dus, saisies datées après aujourd'hui), et chaque chose **une fois** | 10.14.0 — `cashForecast` |

**Les tests**

| Règle | Où |
|---|---|
| **Tout test se prouve en réintroduisant son défaut.** Sinon on ne sait pas ce qu'on a écrit | 7.2.0, 7.22.0, 7.25.0, 7.27.0 — six tests qui ne pouvaient pas échouer |
| Un test qui lit du code doit lire du **CODE** : commentaires et chaînes retirés d'abord | 6.8.0, 7.25.0, 9.4.10 — un commentaire satisfaisait l'assertion |
| Une **suite découpée** que le lanceur ne charge pas n'existe pas : le dossier fait foi | 9.4.10 |
| Un montant qui se **divise sans reste** ne prouve rien d'un arrondi : les DONNÉES du test comptent autant que sa forme | 9.6.1 |
| Une **réexportation** se prouve par l'identité d'objet, jamais par le résultat | 9.6.1 |
| Une preuve par réintroduction ne vaut que sur un lot **VERT** : sinon on mesure le vide | 9.7.0 ; 10.14.0 — re-rencontrée |
| Quand une **mesure fait changer le code**, c'est l'INSTRUMENT qui se relit en premier : sinon il annonce un défaut qui n'existe plus | 9.9.1 — `npm run charge` mesurait le base64 d'un livre devenu binaire par sa faute |
| Un **instrument qui n'ATTEINT pas l'écran** annonce « tout va bien » : l'état par défaut de l'objet qu'on ouvre cache la page autant que l'onglet par défaut | 9.8.8 — T-55, quatre écrans sur onze ; 9.4.3 ; 10.6.0 — cinq captures sur dix, et huit surfaces qu'aucune adresse ne mène ; 10.8.0 — un formulaire à DEUX visages, mesuré dans un seul |
| Un test **trop LARGE** laisse passer le défaut, aussi sûrement qu'un test trop étroit accuse du code juste | 9.9.0 — la seconde piste d'audit qui satisfaisait l'assertion, la tranche qui avalait la porte ; 9.4.7 |
| Un test dont les **DONNÉES ne discriminent pas** ne prouve rien : le modèle livré n'avait aucun préfixe imbriqué | 10.0.0 ; 9.6.1 ; 10.14.0 — un sceau qui ne bougeait que des débits |
| **Élargir** une sonde se prouve dans les DEUX sens : qu'elle voie le défaut, et qu'elle ne voie rien ailleurs | 9.8.8 — T-49 bis, 28 accusations sur du code juste ; 10.8.0 — le garde-fou qui ne lisait qu'une famille de déclarations sur deux |
| Un **refus qu'on avale** en silence est pire que le refus : l'écran affirme alors le contraire du vrai | 9.8.0 |
| Un parcours qui compare du texte **aplatit les espaces** : `textContent` garde les retours de la source — et COLLE deux cellules voisines | 9.8.0 ; 10.12.0 — « Facture corrigéeFAC- » |
| Un **adaptateur** vaut mieux qu'une seconde implémentation ; deux moteurs divergent | 9.7.0 |
| Une assertion sur un montant se **calcule à la main**, jamais en recopiant la sortie | 7.0.1 — l'assertion qui gravait le bug depuis la 1.6.0 |
| Un test écrit contre l'état du jour **décrit cet état**, pas la règle | 7.12.0, 7.26.0, 8.0.1, 8.2.0, 9.1.0, 9.2.2, 9.4.3, 9.4.5 — neuf assertions retournées |
| Une **tranche** de source se prouve par sa taille et par ce qu'elle ne contient PAS | 7.20.0, 7.21.0, 8.2.0 ; 9.4.6 — jamais sur un décalage en dur ; 10.4.0 — ni sur un VOISIN, qui déménage |
| Un e2e **se périme** : reconnaître un écran à ce qu'il CONTIENT, jamais à son rang | 7.3.0, 7.28.0, 7.29.0, 7.30.0, 9.2.2, 9.4.5 — six parcours pourris sans un mot |
| Un parcours qui prend **« le premier venu »** change de cible quand les données grandissent : il choisit par ce qui DISCRIMINE | 10.14.0 — le devis de 2022, le contrat déjà signé, le 30 mars clôturé |
| Jamais une **preuve qui modifie la source** pendant qu'un e2e tourne | 10.14.0 |
| Un parcours reconnaît un bouton à ce qu'il **FAIT**, jamais à sa couleur | 10.12.0 — cinq parcours cassés par U-11 |
| Une règle appliquée **à la main** parcours par parcours l'est sur 11 sur 49 : elle vit dans le harnais | 10.12.0 — E-01, `fermer()` ; 7.28.0 |
| Une preuve qui tombe sur un **AUTRE** test que le sien ne prouve pas le sien | 10.12.0 — E-09 (l'ancien neutralisé), E-07 (le gabarit régénéré) ; 10.14.0 — les jumeaux de la porte |
| Un test qui reconnaît un défaut par **UNE forme** manque son jumeau écrit à la main | 10.12.0 — U-11 et le panneau « Aucun salarié » |
| Un e2e qui reste **bloqué** est pire qu'un e2e qui échoue | 7.28.0 — `Promise.race` sur toute fermeture |
| `ta()` sans `await`, `t()` avec une fonction asynchrone : « ok » sans rien vérifier | 6.7.0, 8.4.0 |
| Un test **trop étroit** accuse du code juste — aussi grave qu'un test trop large | 9.1.0, 9.2.0 — le jumeau du contrôle du pont, sans son nettoyage ; 9.4.7 — une sous-chaîne ambiguë |
| Une assertion ancrée sur une **forme** tombe sur du code juste : on la retourne vers la RÈGLE | 7.16.0, 8.2.0, 9.4.1 — trois en une version |
| `npm test \| tail` **masque le code de sortie** : un commit part avec un test rouge | 9.2.0 |
| Un test qui **appelle une fonction autrement que son unique appelant** ne prouve rien de l'application | 9.8.7 |
| Un **commentaire de gabarit** `${/* */''}` survit au nettoyage ligne à ligne : un test tombe sur une phrase citée | 9.8.8 |
| `\'` dans un gabarit rend une **apostrophe nue** : le fichier reste analysable, la PAGE meurt | 10.5.0 — écran vide, rien dans aucune console |
| Un **garde-fou écrit et jamais prouvé** couvre ce qu'on a pensé, pas ce qui casse : il se prouve sur le défaut RÉEL qui l'a fait écrire | 10.8.0 — 47 noms lus sur 103, et le défaut vivait dans les 56 autres |
| Un **compte de fichiers** n'est pas un compte de livres : l'index et la génération précédente font « 2 » | 9.8.8 |
| Une assertion « **rien n'a changé** » passe toujours quand le geste n'a pas eu lieu : l'ancrer sur sa réussite | 10.9.1 ; 9.4.7 |
| Un **contrat entre deux moitiés** se relit champ par champ contre le FORMULAIRE, jamais contre le commentaire qui le décrit | 10.9.1 — six champs annoncés, huit envoyés |
| Un **exemple complet** est un test : il porte ce qu'aucun jeu minimal ne porte | 10.12.0 — quatre défauts du moteur trouvés en remplissant l'exemple |
| Un **garde-fou neuf change le geste des parcours** : l'e2e répond à la question, comme un humain | 10.12.0 |
| Un **instrument de test humain** doit ouvrir le produit qu'ont les clients — sinon on juge un autre objet | 10.12.0 — « v44.4.1 » : Electron lancé par `src/main.js` |
| Un **rappel qui sert à deux choses** reçoit les arguments des deux : seule une chaîne est une colonne | 10.12.0 — onze listes perdaient leur tri à chaque fiche enregistrée ; 7.17.0 |
| Un test qui **COMPTE des usages** (« au moins trois ») laisse passer tous ceux qu'il ne compte pas : il exige la règle sur CHAQUE usage | 10.12.0 — quatre listes hors de `filtersBar` ; 7.33.0 |
| Un test qui ne lit que **quatre formulaires** laisse nus tous les autres, et une sonde qui ne reconnaît que `field('texte'` manque `field(expr ? 'a' : 'b'` | 10.14.0 — 118 champs sans bulle |
| Une assertion sur une **pile** lit son SOMMET : c'est là que « ← » va | 10.12.0 — le devis vierge n'était jamais la dernière entrée |
| Un test qui cherche une **CLASSE** laisse passer une remarque jamais posée : on JOUE la fonction | 10.14.0 — le résumé de l'image de marque, et `data.company.name` que les crochets ne comptaient pas |
| Une erreur qui se **compense sur l'année** ne se voit que dans un MOIS : le test regarde janvier | 10.14.0 — l'ouverture comptée deux fois de janvier à septembre |
| **Deux chemins, un chiffre** : un invariant compare ce que deux calculs indépendants rendent, et rend la LISTE des écarts | 10.14.0 — `verite-comptable.js`, deux défauts d'argent que les tests « à un chemin » laissaient passer |

**Les deux applications**

| Règle | Où |
|---|---|
| Une règle apprise d'un côté **se vérifie de l'autre**, à la main | 7.3.0 (purge des sauvegardes), 7.18.0 (`pl`), 7.32.0 (« À faire »), 8.1.0 (le saut d'horloge), 10.12.0 (E-14, « le Finder » sous Windows) |
| Un **INSTRUMENT qui ne couvre qu'une des deux applications** ne protège qu'une des deux | 9.4.3 ; 10.6.0 — la capture pleine, jamais portée à la console ; 10.7.0 — la vraie base, jamais portée à `e2e:plateforme` |
| Une **TÉLÉMÉTRIE non plus** : la console ne voyait qu'une des deux applications | 10.4.0 |
| Ce qui protège du **travail perdu** entre deux postes, c'est la RÉVISION relue avant d'écrire — le verrou ne couvre que deux écritures simultanées | 9.9.0 ; 3.2.0 |
| Une **écriture validée** ne se fusionne jamais : elle existe ou pas, et celle de l'autre poste n'est jamais perdue ni renumérotée | 9.9.0 |
| Une **étape qui n'a pas d'écrivain** ne bloque rien, et vaut « — », jamais « non » | 9.9.0 — « révisé » avant la 9.10.0 ; 9.6.0 |
| Une **BÊTA qui ne construit qu'une des deux** ne se fait tester qu'à moitié ; la cloison, c'est le canal | 9.8.4 |
| electron-builder **ne déduit pas le canal du numéro** : on le NOMME, et la page de la release se relit | 9.8.8 — `latest.yml` sur une bêta, servi aux stables |
| Le fournisseur GitHub d'electron-updater **ne connaît que « alpha » et « beta »** : `cabinet-beta` n'y passe jamais ; un repli se teste sur le canal qu'il doit servir | 9.8.8 — la bêta que le comptable ne voyait pas |
| Une commande ne porte jamais `-c <fichier>` **et** `-c.<clé>=` : les deux visent la même option | 9.8.6 — et l'ambiguïté ne tombe que sous PowerShell |
| Une **capture qui s'arrête au bas de l'écran** fait juger une page sur son premier écran | 9.4.3 ; 10.6.0 — la même faute sur la troisième surface, jamais portée |
| Un fichier partagé a **trois** branchements : les deux `index.html`, dans l'ordre, et les `files` du Cabinet | 7.26.0 (`depot.js`), 7.29.0 (`rowmenu.js`), 9.1.0 (`compta.js`) |
| Le Cabinet **n'écrit jamais** chez un client et ne lui renvoie rien | Cabinet 1.0.0 |
| Une classe du Cabinet ne peut pas porter un nom déjà pris dans la feuille partagée | 6.8.0 — `.setup-card` |
| Un drapeau qui vit **en double** diverge, toujours | 7.26.0 — `src/depot.js` |
| Une **fenêtre de formulaire** demande avant de jeter la saisie, avec le MÊME instantané des deux côtés — et **choisir n'est pas taper** : une fenêtre de listes seules se referme sans question | 10.12.0 ; 10.14.0 — « Clôturer jusqu'à… » |
| Une **clé qu'on épingle** est la même sur tous les postes de son propriétaire, sinon l'épinglage fabrique des refus | 10.13.0 — la signature du cabinet, dérivée de sa clé |
| Deux applications qui lisent le **même client** se confrontent sur TOUT l'historique, par le vrai paquet, chaque case de chaque mois | 10.14.0 — le crédit de TVA perdu en janvier, vu par le Cabinet ; 9.1.0 (la parité des balances) |
| Reconnaître une écriture de l'autre application à sa **FORME**, c'est connaître TOUTES ses formes : la parité se braque sur chaque scénario qu'on sait fabriquer | 10.14.0 — le mois en crédit, le timbre seul, les avoirs plus forts que les ventes |

**L'interface**

| Règle | Où |
|---|---|
| Un **bouton sans bordure ni couleur n'est pas un bouton** : il se reconnaît AU REPOS, pas au survol | Cabinet 1.0.0, 9.4.2 |
| Un **titre gris de 11 px ne hiérarchise rien** : il décore. Trois niveaux, un rôle chacun | 9.4.3 |
| Un **total vit sous sa colonne** ; un raccourci s'affiche comme une **touche**, pas comme du texte | 9.4.5 |
| Ce qui prend la place n'est pas le **nombre** d'objets mais leur **taille** : replier avant de paginer | 9.4.5 |
| Un champ **pré-rempli** se sélectionne au clic, sinon la valeur proposée est imposée ; et il se RECALCULE quand ce dont il dépend change | 9.4.5 ; 10.6.0 — un Indépendant vendu 690 DT |
| Une **classe posée par le code et inconnue de la feuille** ne se voit nulle part | 6.8.0, 7.23.0, 7.27.0, 8.1.0, 9.4.3 |
| Un CSS **physique** décrit un écran, un CSS **logique** décrit une lecture ; l'exception est NOMMÉE | 9.4.10 |
| Une **règle générale qui vise un élément** avale l'exception qu'on vient d'y poser (`:not()`) | 7.23.0, 7.27.0, 7.30.0, 9.4.8 |
| Une **phrase rassurante** se vérifie d'abord sur un univers non vide | 7.0.0, 7.3.0, 9.4.2 ; 10.4.0 — une alerte aussi |
| Une **égalité affichée** se vérifie avant d'être affichée : l'équation ne paraît que si le calcul tombe | 10.14.0 — les états d'un mois en cours |
| Une **phrase d'état vide** dit SA raison, et le jour où ça changera | 10.12.0 — E-06, « aucune pièce datée » sur cinq pièces |
| Une **garde neuve** ferme la porte ; ce qui est passé AVANT se signale | 10.12.0 — E-04, les bulletins négatifs enregistrés avant la 10.10.0 |
| Un champ jugé sur sa seule **présence** laisse passer une valeur fausse | 7.6.0 — le matricule inventé ; 10.12.0 — le RIB de dix chiffres |
| Un **réglage qu'on ne peut pas changer à l'écran** est une constante ; ce qui n'est PAS réglable se dit | 10.5.0 — les prix, la signature, les seuils |
| Le **plafond de largeur** suit le RÔLE, pas le conteneur ; on **pagine ce qu'on NOMME** | 10.5.0 — 700 px vides à droite d'un tableau serré ; 9.4.5 |
| Une **réponse en retard** ne repeint pas l'écran qu'on a quitté | 10.5.0 — le Parc remplacé par les alertes, sous le titre du Parc |
| Un **avertissement** se lit AVANT le geste, jamais sous le bouton ; un geste IRRÉVERSIBLE a son récapitulatif, désarmé à la moindre frappe | 9.4.2 ; 10.6.0 — « Émettre » signait au premier clic ; 10.14.0 — la pièce d'un mois clôturé |
| Un **formulaire au premier écran** se saute : une porte d'abord, les questions au moment où elles servent | 10.14.0 — la porte, trois questions, le reste dans « Tes premiers pas » |
| Une **explication fausse** est pire qu'une explication absente : un même attribut s'explique par SA page | 10.14.0 — `data-open`, « Ouvre cette entreprise » sur un fichier joint |
| Une étape **facultative** ne passe jamais devant une étape du métier, et ne retient pas le panneau | 10.14.0 — la découverte et le comptable |
| Une **bulle d'aide** ne couvre ni ce qu'elle montre, ni la fenêtre où l'on relit ce qu'on vient de taper | 10.14.0 — `placerPres`, `hautPourBulle` et son jeu d'un demi-pixel |
| Ce qu'une **visite cite « entre guillemets »** existe dans l'application — et un « bouton vert » ne se promet pas | 10.14.0 — « Chapitre suivant », « Faire mon premier devis » |
| Une **catégorie** tient en un mot, sur une ligne, dans sa colonne | 10.14.0 — « Contrat de prestation » sur trois lignes dans la palette |
| Un **fichier qui doit partir** part avec son message ; un lien `mailto` a une longueur, et Windows le coupe sans une erreur | 10.14.0 — le fichier d'appairage du Cabinet |
| Le **rôle proposé par défaut** au premier déclaré est celui qui ne ferme rien | 10.14.0 — « Saisie » retirait la validation au comptable qui se déclarait |
| Une ligne garde **au plus UN** bouton visible ; le reste passe par `rowmenu.js` | 7.29.0 ; 9.4.8 — un en-tête de fiche aussi |
| **UNE seule table d'actions par racine** : `bindRowMenus` écrase la précédente, en silence | 9.4.8 |
| Un **champ qui compte dans une unité** le dit à côté de lui, pas en légende dessous | 9.4.8 |
| Un refus dit **trois** choses : ce qui est refusé, pourquoi, et le bouton qui débloque | 7.0.0, 9.2.1 |
| Un refus qu'on a **écrit** est une réponse ; seule une **panne** va au journal | 9.4.10 |
| Un **bouton éteint dit pourquoi**, et par la MÊME fonction que celle qui refusera — son LIBELLÉ aussi dit ce que le clic fera | 9.4.5 ; 10.14.0 — « Ouvrir N+1 » joué sur une copie : ouvrir, refaire, compléter, voir |
| Une saisie refusée se **MONTRE** : on amène le champ à l'écran (`refus()`) — dans TOUTES les fenêtres, la règle se lit sur la condition | 7.0.0, 7.20.0 ; 10.12.0 — vingt-cinq refus qui ne faisaient qu'un message |
| Ce qui **détruit** demande ; ce qui **se répare** laisse un « Annuler » (`toastUndo`) | 7.12.0 ; 9.4.6 — porté au Cabinet |
| Un écran qui **NOMME** un ensemble doit pouvoir l'ouvrir | 7.15.0, 7.17.0, 7.21.0, 10.4.0 |
| Un **lecteur ne dépend jamais d'un filtre qu'il ne voit pas** : la colonne testée se SÉLECTIONNE | 10.9.0 — la ligne écartée en silence |
| Chaque écran **finit par le geste suivant** : le métier est une boucle, pas quatre pages | 7.27.0, 9.4.9 |
| Une **prose sous un tableau** remplace la découvrabilité : l'explication va dans la bulle du titre | 9.4.9 |
| L'endroit qui **affiche** un état est celui où on s'attend à le changer | 7.14.0 |
| Un **moteur sans écran n'existe pas** ; une fonction jamais appelée est invisible | 7.2.0, 7.3.0, 7.19.0 |
| Un **extrait sans son cadre** fait douter de l'outil : montrer l'ensemble, griser ce qui ne compte pas | 9.4.7 |
| Un **état vide secondaire** s'annonce ; celui qui EST le corps d'un écran garde sa présence | 9.4.7 ; 10.6.0 — cent pixels pour dire « — » |
| Une **phrase affichée** que rien ne tient est un bug, pas une imprécision | 7.3.0, 7.6.0, 8.0.0 ; 9.4.5 — un COMMENTAIRE aussi ; 9.8.1 et 9.8.4 — dans un fichier de CI aussi ; 10.9.2 — dire OÙ trouver une valeur qu'aucun écran n'affiche ; 10.12.0 — `closedToast`, « supprimé » en 7.17.0, encore appelé |
| Quand quelqu'un **n'arrive pas à fournir** ce qu'on lui demande, chercher d'abord si on le lui a rendu possible | 10.9.2 |
| Deux objets qui portent le **même mot** finissent confondus, y compris par leur auteur | 10.9.2 — l'empreinte d'un cabinet et celle d'une licence |
| `navigate()` vers la page courante ne redessine **rien** : `vers()` | 7.15.0, 7.29.0 |
| Une mise en page qui dépend de sa **propre barre de défilement** a deux états stables : décider SANS elle | 10.12.0 — la barre latérale, un pixel, une ligne de plus |
| Un **prix posé par le logiciel** n'est pas un prix décidé : l'étape se coche sur un geste de l'utilisateur | 10.12.0 ; 7.18.0 |
| Un état lu une fois au démarrage **se périme** — et un écran lu au processus principal se relit quand le livre bouge ; une lecture ratée se DIT, elle ne se redemande pas en boucle | 7.1.x, 8.0.0 ; 10.14.0 — le résumé des livres, lu avant l'exemple, faisait sauter un chapitre de la découverte ; la déclaration du Cabinet, lue avant la validation de sa propre écriture |
| **Un seul bouton principal** par écran, et c'est l'étape suivante — calculée, jamais posée à la main ; UNE fonction pour les deux éditeurs | 10.12.0 (U-11, H-E5, H-E19, H-E21 — l'éditeur d'achat ne l'avait jamais reçue) |
| Une **colonne collante** réserve sa largeur : elle ne recouvre jamais une donnée | 10.12.0 (U-02) |
| Une **page de création** n'entre pas dans la pile : après l'enregistrement, « ← » ne mène jamais à une pièce VIERGE | 10.12.0 — `remplacerPage` ; 2.4.0 |
| Ce qui **apparaît selon une valeur** vit dans une place qui existe déjà : sinon tout ce qui suit descend sous le curseur | 10.12.0 |
| Une **grille se décide sur la place du CADRE** ; chaque rangée étant sa propre grille, aucune colonne automatique | 10.12.0 — la désignation à 84 px à côté de l'aperçu |
| Une **liste vide** dit à quoi elle sert et donne le geste qui la remplit — ni recherche, ni filtres au-dessus du vide | 7.0.0 ; 10.12.0 — quatre listes de plus |
| Un écran de travail s'ouvre sur le **dernier mois qui a des données**, jamais un mois futur | 10.12.0 (U-12) |
| Une **recherche** garde des pièces entières ; un champ qui redessine son écran garde la frappe | 10.12.0 |
| Un dossier **tenu au cabinet** prend ses mois dans son livre : jamais « hors mission » ni « pas reçu » | 10.12.0 |
| Le **dernier écran avant un geste irréversible** récapitule à qui, quand, combien — et ce que le geste laisse à rendre | 10.6.0 ; 10.12.0 — l'émission d'une facture, et l'avoir sur une facture payée |
| Un **chiffre juste dans la mauvaise couleur** dit le contraire du vrai : un trop-perçu n'est pas un reste à payer à zéro | 10.12.0 |
| Un **écran à moitié gris** dit que certains champs sont encore modifiables : la règle des champs fermés porte la chaîne de `:not()` | 10.12.0 — la septième fois que la règle générale gagne |
| L'**étiquette d'une case à cocher** est UN élément : dans un conteneur flex, chaque morceau de texte en devient un | 10.12.0 — « Timbre fiscal ( » seul sur sa ligne |
| Une **porte de refus reçoit un NOM**, pas une phrase : `closedBlock(dates, 'Ce paiement')` | 10.12.0 — « … ne peut pas être supprimé porte la date du… » |
| Le **bouton retour nomme** la pièce, le client, le fournisseur où il mène — jamais « le document » | 2.4.0 ; 10.12.0 |
| Un **état vide qui porte son bouton principal** éteint celui de l'en-tête — y compris quand seule la liste se redessine | 10.12.0 (U-11) — huit pages, dont les Licences |
| Un **état actif ne change pas la géométrie** : le gras qui fait passer à la ligne décale tout ce qui suit, au moment du clic | 10.12.0 — la barre latérale, 14 px |
| Une **couleur de texte foncée écrite en dur a sa jumelle sombre**, dans les deux feuilles | 10.12.0 — le pied de la barre à 2,1 de contraste |
| Un **instrument qui compare deux états** se place là où ils peuvent différer, et EXIGE cette condition — sinon il mesure l'égalité de deux défauts | 10.12.0 — la barre qui défilait : l'entrée était déjà sur deux lignes au repos |
| Une **remarque qui dépend d'une valeur** vit dans la ligne de son titre : posée dessous, elle pousse le bouton qu'on vise | 10.14.0 — « trop claire » et « Enregistrer », 41 px |
| Un **réglage a UNE porte** : le panneau le montre, la fenêtre qui le montre sur la pièce le change | 10.14.0 — l'image de marque ; une couleur enregistrée avant d'avoir été vue |
| Le **mois regardé appartient à l'exercice regardé** : UNE garde au dessin, jamais une par porte | 10.14.0 — « décembre 2025 » au-dessus d'août 2026 |
| **Toute liste qu'on nomme se pagine** — les tableaux secondaires aussi ; un objet trop grand se REPLIE sur sa ligne avant de se paginer | 10.14.0 (saturation) ; 9.4.5 |
| Un **refus se dit AVANT la question** : on ne confirme pas « Valider 3 526 écritures ? » pour lire ensuite que c'est impossible | 10.14.0 (saturation) ; 7.6.0 |
| Une **question dit ce qu'elle confirme** dans son titre — dérivé de sa phrase (`titreQuestion`), nommé par l'appelant pour un avertissement ; jamais « Confirmation » | 10.14.0 (P2) |

**Ce qu'on ne fait jamais**

| | Où |
|---|---|
| Jamais de **données en otage** : une licence expirée ne bloque que la création | 6.4.0 |
| Une **offre** peut fermer un confort, jamais une case de DÉCLARATION | 10.7.0 — Achats fermé, et le paquet déclarait 4 191 DT de TVA en trop |
| Jamais de **message brut** à l'écran : `updateProblem(err)` | 7.26.0 |
| Jamais **prétendre** ce qu'on ne peut pas prouver (« 7 pièces vérifiées, intactes ») | Cabinet 1.0.0, 8.1.0, 8.2.0 |
| Jamais de **retour en arrière** de version, sauf sortie du canal d'essai | 6.7.3, 7.25.0, 9.1.0 |
| Jamais **toucher à la clé publique** de `build/licences-publiques.json` | Règles de travail, 8.0.0 |
| Jamais **embarquer une clé publique dont la privée a été VUE** : elle est brûlée, on la recrée | 9.4.1 |
| Jamais de **token** commité | Règles de travail, 6.7.0 |
| Jamais une **donnée de plus** dans ce qui part vers le serveur : la liste se compte | 8.4.0, 10.4.0 |
| Jamais une **base de ventes sans copie** : D1 est le seul endroit où vit qui a acheté quelle clé | 10.4.0 ; 10.5.0 — une copie qui demande un clic ne se fait pas |
| Jamais **croire un webhook non signé** : il notifie, il ne prouve pas | 10.9.0 |
| Jamais **abandonner une commande payée** : ce serait garder l'argent en fermant la porte | 10.9.0 |
| Jamais une **clé rendue sur ce qui est public** (le matricule) : seulement sur le jeton que la commande a rendu une fois | 10.14.0 — l'achat dans l'application |
| Jamais **vendre en ligne par-dessus une licence qui court** : elle repartirait d'aujourd'hui et perdrait les jours payés | 10.14.0 ; 7.33.0 |
| Jamais un **secret qu'on ne peut pas remplacer** sans se fermer la porte | 10.5.0 — le second secret de rotation |
| Ce qui **protège une réponse publique** est la REQUÊTE, jamais la forme de la réponse | 10.5.0 — la vérification d'une empreinte |
| Jamais **chiffrer en croyant signer** : seule une signature dit d'où ça vient | 9.2.0 |
| Jamais une **cellule CSV** exécutée par un tableur (`=` `+` `-` `@`) | 9.1.1 |
| Jamais **écraser le travail du cabinet** avec un mois que le client renvoie | 9.2.0 |
| Jamais une **sauvegarde qui laisse le livre derrière elle** ; changer une clé rechiffre TOUT ce qu'elle protège | 9.8.8 — T-35, T-43, T-44 |
| Jamais un **attribut posé par le code et lu par personne** : `data-close` posé, `dismiss` attendu, neuf « Annuler » inertes | 9.8.8 — T-09 |

**L'outillage (9.1.0)**

`npm test` (les tests purs) · `npm run lint` (ESLint, **zéro erreur ET zéro avertissement** depuis la
10.0.1) · `npm run charge` (le livre du Cabinet) · `npm run charge:entreprise` (le fichier de l'app
entreprise, dix ans d'activité — 10.0.1) · `npm run e2e:<nom>` (59 parcours, tableau au § « Les tests
qui ouvrent vraiment l'application ») · `scripts/humain/` (tester comme un humain : écran virtuel, souris, clavier, Browser Use — depuis le 23/09/2026) · CI GitHub sur Linux et Windows à chaque poussée ·
« Construire un essai » pour faire tester une version sans la publier.

**Les documents du dépôt**, et lequel fait foi :
`DIRECTION.md` (prime sur tous) → `CAHIER-DES-CHARGES.md` (les spécifications citables) →
`VERSIONS-A-VENIR.md` (tout ce qui reste à faire, 9.1.0 → 10.0.0) → `PLAN-DEVELOPPEMENT.md` (le
calendrier et les jalons). `QUESTIONS.md` répond à tout le reste — c'est le document à ouvrir quand
on est perdu. **`A-FAIRE.md`** est le carnet des constats isolés et des décisions en attente, sur
les TROIS surfaces (applications, site, plateforme) — il se relit quand on cherche quoi faire
ensuite, et ce qui y bloque une vente passe avant ce qui y bloque du code. **`TARIFS-REFERENCE.md`** dit ce que le code tient en matière d'offres et de prix : c'est le
contrat avec la session qui écrit `skanfact.tn`, et il se relit à chaque changement d'offre ou de prix. `PLAN-CABINET.md`, `PLAN-COMPTABLE.md`, `PLAN-PLATEFORME.md`, `PLAN-UX.md` pour un
chantier précis ; `ROADMAP.md` est une **archive**.

---

## Règles de travail

- **Chaque amélioration livrée = une nouvelle version** (semver) : correctif 1.0.x, fonctionnalité 1.x.0, gros changement x.0.0. Mettre à jour `package.json` (`version`) **et** ajouter une entrée datée dans `CHANGELOG.md` (c'est elle qui devient les notes de version dans l'app et sur GitHub). Toujours annoncer le numéro de version dans la réponse.
- Lancer `npm test` avant tout commit (calculs, numérotation, montant en lettres, échappement HTML, stockage/sauvegardes). Pour un changement d'interface, lancer aussi l'app réelle (`xvfb-run` + Playwright `_electron`, voir README « Tests ») : elle attrape les erreurs JS du renderer.
- **À la fin de chaque changement, le tester COMME UN HUMAIN — OBLIGATOIRE, AVANT le commit**
  (décidé par Skander le 23/09/2026 : « afin d'éviter les bugs et problèmes » ; rendu IMPORTANT le
  24/09/2026, voir l'encadré en tête de ce fichier : un lot non testé à la souris n'est pas fini). `scripts/humain/lancer.sh cabinet|entreprise` ouvre
  l'application sur un écran virtuel de 1440×900 ; `scripts/humain/ecran.sh capture` puis lire
  l'image, `clic X Y`, `taper "…"`, `touche ctrl+k`, `defiler X Y bas 3` — de VRAIS événements souris
  et clavier du système (xdotool), c'est-à-dire les actions de Computer Use jouées par Claude
  lui-même. Ils subissent ce qu'un humain subit : un bouton recouvert par une couche ne reçoit pas le
  clic, un bouton collé se voit collé, un texte blanc sur blanc ne se lit pas. **Browser Use**
  (`BU_CDP_URL=http://127.0.0.1:9223 browser-use <<'PY' … PY`) et **Playwright**
  (`chromium.connectOverCDP('http://127.0.0.1:9223')`) se branchent sur la MÊME fenêtre, pour lire
  l'arbre d'accessibilité ou vérifier une valeur après un geste. Ports : 9222 l'entreprise, 9223 le
  Cabinet. Les parcours `npm run e2e:*` restent les garde-fous (ils cliquent des SÉLECTEURS) ; ce
  test-là est le regard (il clique des PIXELS). Le hook `.claude/hooks/session-start.sh` installe tout
  au démarrage d'une session web ; `scripts/humain/fermer.sh` ferme l'application. Aucun de ces
  outils ne demande de clé d'API : c'est Claude qui regarde et qui décide du clic suivant.
  **Rien ne s'annonce « réglé » avant d'avoir été refait à la souris et VU à l'écran** (rappelé par
  Skander le 26/09/2026 : « toujours vérifier comme un humain avant de confirmer que c'est réglé, faut
  le prouver avec la souris ») — un test vert ou une valeur lue par CDP ne sont pas la preuve.
- **Les workflows lancent leurs agents en `sonnet`** (décidé par Skander le 26/09/2026 : « ça consomme
  moins mon quota hebdomadaire ») : `agent(prompt, { model: 'sonnet', … })` sur chaque appel, et
  `model: 'sonnet'` pour un agent lancé par l'outil Agent. Ce que les agents trouvent se REVÉRIFIE à
  la main avant d'être retenu (« chercher avec des agents, vérifier soi-même ») : un constat d'agent
  n'est qu'une piste.
- Ne jamais commiter de token. Le jeton GitHub que l'utilisateur colle (quand le dépôt est privé) est stocké dans `userData/update-config.json`, jamais dans le code.
- **La licence est ARMÉE depuis la 8.0.0** : la clé publique de Skander (créée dans SkanFact le 14/09/2026) vit dans `build/licences-publiques.json` sous le `kid` **`master`**, et `build/licence-public.json` la porte encore à l'identique (repli des versions d'avant la 8.4.0). Ne jamais la supprimer, la régénérer ni la remplacer — une autre clé invaliderait toutes les licences déjà vendues, et son absence désarmerait tous les clients. **Une licence sans `kid` se vérifie avec `master`** : toutes celles vendues depuis la 8.0.0 sont dans ce cas. La clé privée vit dans `~/.skanfact/` sur son Mac, jamais dans le dépôt. Des tests exigent la présence du fichier, que ce soit une vraie clé Ed25519, que `master` soit identique au caractère près à celle de la 8.0.0, et que le glob d'electron-builder embarque bien les deux fichiers. **Depuis la 8.6.0 le même fichier porte `srv-1`** (créée dans SkanFact le 15/09/2026), la clé de second rang avec laquelle la console signe les ventes : sa privée vit dans le réglage Cloudflare `SRV_PRIVATE_KEY`, jamais dans le dépôt. La retirer un jour (compromission) est une décision qui exige de réémettre les licences qu'elle a signées ; la « retirer » se fait par `retiree: true`, pas en effaçant l'entrée. **Depuis la 9.4.1 le champ `reponse` porte la clé publique de RÉPONSE** (créée dans SkanFact le 17/09/2026 — celle du 15/09 était brûlée, sa privée ayant transité par une conversation) : sa privée vit dans le réglage Cloudflare `REPONSE_PRIVATE_KEY`, jamais dans le dépôt, et c'est elle qui fait qu'une révocation prononcée depuis la console s'applique chez un client à jour. Un test exige qu'elle soit une Ed25519 distincte de `master` et de `srv-1`. Ne jamais la remplacer par une clé dont la privée a été vue (`plateforme/README.md` § 4).
- **Partager un dossier à deux se fait en DEUX gestes**, et ils vivent dans `src/main.js` :
  `dossiers:share` copie le dossier OUVERT vers un emplacement commun (l'original reste, la bascule
  n'a lieu qu'une fois la copie constatée), `dossiers:join` ouvre un dossier déjà posé sans rien
  créer. Ne jamais revenir à « créer un dossier partagé vide » : c'est le défaut que la 7.28.0 a
  corrigé.
- **Les actions d'une ligne vivent dans un menu** — `src/renderer/rowmenu.js`, chargé par LES DEUX
  applications (`RowMenu.cellule` / `RowMenu.brancherMenus`) — pas dans une rangée de boutons. Une
  ligne garde au plus UN bouton visible, celui du geste pour lequel la page existe. Toute nouvelle
  liste passe par là, chaque action porte une phrase et une icône, et toute action qui change
  l'état d'une pièce demande d'abord — puis propose la suite.
- **Les réglages passent par `src/renderer/reglages.js`**, chargé par LES DEUX applications :
  sommaire de l'onglet, recherche, et UNE porte pour amener un panneau à l'écran. Un panneau de
  Paramètres se déclare dans `SETTINGS_PANNEAUX` (onglet, titre, synonymes) et se pose par
  `panneau(id)` : la table sert au titre, au `data-mots` de la recherche ET à l'entrée de palette
  Cmd+K, donc les trois ne peuvent pas diverger. Un test vérifie que chaque panneau déclaré est posé
  une fois et une seule, et qu'aucun n'échappe à la table.
- **Le dépôt est PUBLIC depuis le 13/09/2026** (GitHub Actions y est gratuit) et redeviendra peut-être privé. La bascule est **une seule ligne** : `private` dans **`src/depot.js`**, que les deux applications lisent — le champ « jeton d'accès » revient alors tout seul dans leurs Paramètres. Ne jamais redéclarer ce drapeau ailleurs : il avait été écrit dans les deux `main.js`, et ils ont divergé. `npm run e2e:depot` bascule vraiment et vérifie l'écran.
- **Aucun message d'erreur brut ne remonte à l'écran** : `updateProblem(err)` (dans les deux `main.js`) rend une phrase en français, range le texte d'origine dans `detail` (replié sous « Détails techniques »), et marque `soft` ce qui n'est pas une panne.
- macOS : app non signée → `MAC_SIGNED = false` dans `src/main.js`. electron-updater télécharge le `.zip` (sha512 vérifié) et `src/mac-update.sh` remplace l'app dans Applications puis la relance. Ne pas prétendre que Squirrel.Mac fonctionne sans signature Apple.

## Publier une version

**Le chemin normal passe par la bêta** (décidé le 18/09/2026 par Skander : « au lieu de faire sur ta
branche et publier, pourquoi pas faire le bon workflow, c'est-à-dire sur la bêta ? »). `main` est la
branche stable, `beta` la branche de travail, et **c'est le numéro de version qui décide de tout le
reste** — il n'existe aucune case ni aucun drapeau à poser au lancement.

1. **La bêta.** Travailler sur `beta`, numéroter `X.Y.Z-beta.N` (`npm run release preminor` puis
   `prerelease` ; le `--preid beta` est posé par le script, un `-0` sans nom de canal donnerait un
   canal « 0 »). Publier : le workflow marque la release **préversion** (donc `/releases/latest`
   continue de pointer sur la dernière stable) et **NOMME le canal** à electron-builder
   (`-c.publish.channel=beta` pour l'entreprise, `channel: 'cabinet-beta'` dans
   `build/cabinet.config.js`) — il ne le déduit PAS du numéro (voir § 9.8.8) — qui écrit alors
   `beta.yml` / `beta-mac.yml` et `cabinet-beta.yml` / `cabinet-beta-mac.yml`. **Les deux
   applications sont construites**, chacune sur son canal d'essai (corrigé en 9.8.4 — voir cette
   section), et le job `verifier` relit la page : un index du mauvais canal est retiré, un index
   attendu qui manque fait tomber le run.
2. **L'essai.** Skander coche « Recevoir les versions bêta » (Paramètres → Mises à jour) ; le cabinet
   pilote coche « Recevoir les versions d'essai » (Réglages → Mises à jour). Une sauvegarde
   `avant-beta` est prise **avant** d'armer le canal. Personne d'autre ne voit rien.
3. **La confirmation.** Quand Skander valide, `npm run release minor` transforme `X.Y.Z-beta.N` en
   `X.Y.Z`, `main` avance, et on publie la stable. Décocher la case ramène à la stable (c'est le seul
   retour en arrière autorisé, voir 6.7.3 et 7.25.0).

**Le chemin direct en stable** reste légitime pour ce qui ne peut pas casser de chiffre : correctif
d'interface, entretien, documentation, correctif de la publication elle-même. Il ne l'est pas pour ce
qui touche **à l'argent, à une clé, au moteur comptable ou au format d'un fichier** — là, la bêta est
la règle. Le motif du choix s'écrit dans l'entrée du `CHANGELOG.md`.

Dans les deux cas :

1. Bump `package.json` + entrée `CHANGELOG.md`, `npm test`, `npm run lint`, commit, push sur la
   branche visée (`beta` pour un essai, `main` pour une stable).
2. Déclencher le workflow **Release** (`.github/workflows/release.yml`) : soit un tag `vX.Y.Z`
   (`npm run release` sur le Mac de Skander), soit **workflow_dispatch** en choisissant la branche
   (onglet Actions → Release → Run workflow, ou l'outil GitHub `actions_run_trigger`). Depuis une
   session Claude Code, le push de tag est bloqué par le proxy git : utiliser workflow_dispatch.
3. Le job `preparer` crée la page de la release **une seule fois** (9.8.1), puis les deux postes y
   déposent : `.dmg` + `.zip` (mac universal), `.exe` (win x64) pour chaque application, plus les
   quatre fichiers d'index du canal. **16 fichiers** pour une stable.
4. Vérifier que le run est vert **et** que la release contient bien ces fichiers avant de dire que
   c'est publié ; s'il est rouge, lire les logs et corriger. Un job vert ne suffit pas : c'est très
   exactement le défaut que la 9.8.1 a corrigé.
5. Remettre `main` (et `beta`) à niveau après une stable, pour qu'aucune branche n'annonce une
   version qui n'est plus la bonne.

## Structure

- `src/main.js` : fenêtre (état mémorisé), instance unique, menu français, IPC, export PDF via `printToPDF` (fichier temporaire), mises à jour (vérification silencieuse au démarrage, téléchargement auto, install Windows par electron-updater / Mac par `mac-update.sh`).
- `src/storage.js` : fichier `skanfact-data.json` (écriture atomique), fichier illisible mis de côté jamais écrasé, sauvegarde quotidienne = état de début de journée (30 jours), sauvegardes nommées (avant import, manuelle), chiffrement optionnel (enveloppe `skanfact-encrypted`, AES-256-GCM + scrypt, clé en mémoire pour la session, sauvegardes converties au changement de mot de passe), copie miroir vers un dossier externe (`userData/app-config.json` → `externalBackupDir`). Testé sans Electron.
- `src/preload.js` : pont contextBridge (`window.skanfact`).
- `src/renderer/core.js` : logique métier partagée navigateur/Node — calculs (TVA 0/7/13/19 %, remise, timbre fiscal 1 DT sur factures, retenue à la source sur TTC hors timbre, lignes `noDiscount` pour les déductions d'acompte), numérotation `DEV/FAC/AVO-AAAA-NNN` (facture et avoir numérotés à l'émission seulement), statut de facture **déduit** des paiements et avoirs (`effectiveStatus`, `invoiceBalance`), acompte/solde (`depositLines`, `settlementLines`), journal des ventes / TVA / encaissements / CSV, `migrateData` (version 2 : « payée » → paiement), montant en lettres, **template HTML du document** (`documentHtml`, tampon via `opts.stampText`).
- `src/renderer/app.js` : interface (routeur hash, pages accueil/devis/factures/relances/contrats/clients/catalogue/comptabilité/paramètres, éditeur avec aperçu live et menu « Plus », verrouillage des documents émis, paiements, avoirs, envoi email, palette Cmd+K, modèles/textes, panneau mises à jour, actions du menu).
- `src/renderer/demo.js` : jeu de démonstration (`buildDemoData(companyActuelle, today)`), dates relatives à aujourd'hui, testé par `npm test` (numérotation continue, aucun paiement futur, tous les statuts et niveaux de relance présents quelle que soit la date). Le chargement conserve la société et prend une sauvegarde `avant-demo`.
- `core.fitToPage(document)` puis `core.paginate(document)` : exécutés dans l'aperçu (iframe) et dans la fenêtre PDF (main.js), **dans cet ordre et toujours les deux** (`mettreEnPage` dans app.js, `renderPdf` dans main.js). `fitToPage` repère le débordement ; `paginate` choisit le resserrement utile (`compact`, `dense`) et découpe le document en **une `.page` par feuille A4**, pied numéroté compris. Les deux sont **autonomes** : `main.js` les sérialise, elles ne peuvent appeler aucune autre fonction de core.js. Après toute modification du template, lancer `npm run e2e:pages` (161 documents imprimés et mesurés).
- CSS : `[hidden] { display: none !important; }` est global — un `display:flex` de classe écrasait l'attribut `hidden` (menu « Plus », champ taux, bouton Retirer).
- Données v6 : `recurring` (contrats : lignes, every, day, nextDate, lastIssued, active), `templates`, `snippets`, `suppliers`, `purchases`, `expenseCategories` ; par document : `payments`, `reminders`, `emails`, `withholdingCertificate`, `recurringId`, `attachments`, `fromDocId`/`fromDocType`/`fromDocNumber`, `clauses` (contrat), `hidePrices` (bon de livraison) ; par achat : `kind` (facture/depense), `supplierId`, `number` (celui du fournisseur), `date`, `dueDate`, `category`, `lines` (avec `destination` et `deductible`), `fees`, `withholdingRate`, `payments`, `attachments`.
- Documents bilingues : `doc.lang` (fr/en) → dictionnaire `I18N` dans core.js, `amountToWords(amount, currency, lang)` ; `doc.currency` + `doc.exchangeRate` (1 devise = x DT), `toBase()` pour le journal et le tableau de bord ; `money(n, cur, decimals, lang)` (3 décimales pour le dinar, 2 sinon ; point décimal en anglais).
- Thème : `company.theme` (light/dark/auto) → classe `dark` sur `body` ; les documents PDF restent clairs.
- Email : `mail:compose` dans main.js — AppleScript vers Mail sur macOS (PDF joint), sinon `mailto:` + PDF montré dans le Finder ; le PDF joint est écrit dans `userData/envois/`. Gabarits dans `core.DEFAULT_EMAIL_TEMPLATES`, surchargés par `company.emailTemplates`.
- Règles métier à respecter : une facture/avoir émis est verrouillé (pas de modification ni suppression ; correction par avoir) ; les statuts « payée / partielle / retard / annulée » ne se saisissent jamais à la main ; les brouillons de facture n'ont pas de numéro.
- `src/renderer/style.css` : design clair (fond #f5f7fa, accent vert d'eau #0f9d8f, cartes arrondies).
- `build/icon.png` : icône 1024×1024 convertie par electron-builder en `.icns`/`.ico`.
- `scripts/release.js` (bump + tag + push), `scripts/release-notes.js` (CHANGELOG → `build/release-notes.md`).
- `Installer SkanFact.command` / `Installer SkanFact (Windows).bat` : construction locale depuis les sources (secours ; l'installation normale passe par les fichiers de la release).
- `test/run-tests.js` : `npm test`.

## Design du document PDF

Le propriétaire veut un rendu « beau et épuré, couleurs claires ». Palette dérivée de `company.accentColor` (teintes via rgba). Le document doit tenir sur **une page A4** pour un devis classique (vérifier le nombre de pages après toute modification du template : un débordement de quelques px crée une page blanche). Pas de bandeau sombre, pas de blocs lourds. Skander a rejeté deux versions plus « lourdes ».

## Décisions prises (ne pas rediscuter)

- Electron + JS pur, pas de React/Vite ; stockage JSON, pas SQLite.
- La lecture de photo de facture (4.2.0) est **éteinte par défaut** et le restera : aucune requête réseau sans clé saisie par l'utilisateur, et l'app ne remplit jamais les données toute seule.
- Pas d'e-facture TTN/El Fatoora tant que Skander ne le demande pas. À VÉRIFIER avec son comptable : la Tunisie généralise la facture électronique pour les assujettis TVA.
- Dépôt **public** depuis le 13/09/2026, pour que les publications soient gratuites ; il pourra redevenir privé (`src/depot.js`). Le relais de mise à jour fonctionne à l'identique dans les deux cas.

## Contexte fiscal (À VÉRIFIER avec le comptable)

Celui de Skander : régime réel, assujetti TVA (son matricule est saisi dans l'app, pas dans le code). Timbre fiscal 1 DT par facture. Retenue à la source : onze taux **proposés** depuis la 8.3.0 (0,5 / 1 / 1,5 / 2,5 / 3 / 5 / 10 / 15 / 20 / 25 %), plus « Autre taux… » qui accepte n'importe quel autre — la liste ne doit **jamais** redevenir fermée. Assiette = TTC hors timbre — À VÉRIFIER. Avoir sans timbre par défaut — À VÉRIFIER.

## Idées non demandées formellement

Feuille de route acceptée par Skander (11/09/2026) : 1.5.0 récurrentes + relances + email + Cmd+K + modèles ; 1.6.0 tableau de bord graphique + cachet/signature + documents EN/devise + mode sombre ; 1.7.0 sauvegarde externe + chiffrement. Non demandés : acceptation du devis en ligne, signature Apple/Windows (certificats payants), export TEIF si l'e-facture devient obligatoire.

## Audit UX du 11/09/2026 — livré en 1.8.0 → 2.0.0

L'audit (captures 1440×900 et 1280×800 avec la démo) a été entièrement traité :

- **1.8.0** : bulles « i » partout + rubrique Aide ; Paramètres en onglets + barre Enregistrer flottante ; garde-fou modifications non enregistrées ; Échap/Entrée ; barre d'actions de l'éditeur simplifiée ; aperçu masquable + indicateur de pages ; lignes déplaçables/duplicables ; titre de fenêtre ; zone sensible.
- **1.9.0** : listes triables, filtre par année, totaux en pied, actions au survol ; devis « expiré » ; fiche client + champ Contact ; catalogue en onglets.
- **1.10.0** : panneau « À faire » ; historique par document ; relance téléphonique et report ; relance de devis ; envoi au comptable ; barre latérale groupée.
- **2.0.0** : assistant de première utilisation, secteurs d'activité, fin des valeurs société en dur.
- **2.1.0** (second audit, sur 2.0.0 installée, captures des états vides et de toutes les modales) : « À faire » complété (devis acceptés non facturés, fiche société incomplète via `core.companyGaps`) ; avertissements à l'émission (`issueWarnings` dans app.js : société incomplète, RIB absent, date antérieure à la dernière pièce émise) ; paiement futur ou trop-perçu confirmé ; historique devis ↔ factures ; reprise de contrat via `core.catchUpRecurrence` ; corrections visuelles (nowrap `.nw` dans les listes, axe du graphique vide, libellé « Tout effacer », placeholders).

- **2.2.0** (signalé par Skander : pas de page suivante sur les listes longues, filtres et tri difficiles à trouver, « À faire » impossible à replier) : pagination de toutes les listes (`core.pageInfo` + `paginate`/`pagerBar`/`bindPager` dans app.js, taille de page dans `localStorage` via `prefs`) ; tri partagé (`sortHead`/`applySort`/`toggleSort`, `core.compareValues`) avec repère « ⇅ » sur chaque colonne triable ; recherche ajoutée au catalogue et aux contrats, filtres ajoutés aux contrats et aux clients ; bandeau « n sur N » + « Réinitialiser les filtres » ; en-tête de tableau collant (`table.list` passe à `overflow: clip`, sinon `position: sticky` ne fonctionne pas) ; panneau « À faire » repliable ; débordement horizontal des listes à huit colonnes corrigé sous 1340 px.

- **2.3.0** (finitions demandées par Skander) : unité de ligne choisie dans une liste (`core.LINE_UNITS` + `core.usedUnits` + « Autre… » via `promptDialog`) ; composant `combo()`/`bindCombo()` — liste déroulante avec recherche, clavier, valeur dans un `<input type="hidden">` portant le nom de l'ancien `<select>` (client, facture d'un avoir, catalogue, modèles, textes, client d'un contrat) ; composant `dateInput()`/`bindDateFields()` — saisie tolérante (`core.parseDateInput`) et calendrier (`core.monthMatrix`), raccourcis +7/+15/+30 j sur les échéances.

- **3.3.0** (la trésorerie) : `data.accounts` et `data.movements` ; `cashMovements` **déduit** les mouvements des paiements clients et des règlements fournisseurs (aucune ressaisie), `accountBalance`, `cashPosition`, `cashForecast` (projection des seules échéances engagées, `shortfall` = date du passage sous zéro), `reconciliation`. `routes.tresorerie` à quatre onglets, `forecastChart` (aire + ligne + zéro pointillé). Le trou de trésorerie passe **en tête** de `todoList`.
  Règles apprises : une facture déjà échue est ramenée à aujourd'hui dans la prévision — la laisser à sa date passée donnerait un solde faux et rassurant. Le solde peut être positif au début et à la fin et négatif au milieu : c'est pour ça que la courbe vaut mieux qu'un total. Le drapeau « pointé » vit sur le paiement d'origine, jamais sur une copie du mouvement. Piège Playwright : `check()` revérifie l'élément après le clic ; quand le panneau se redessine, l'élément est détaché et Playwright recommence sur la ligne suivante — utiliser `click()` et attendre une décroissance, pas une valeur exacte. `nextRecurrenceDate(fromIso, every, day)` prend trois arguments, pas l'objet contrat.

- **3.2.0** (travailler à deux — question de Skander : son père gère Darium *et* sa société, et ils partagent la seconde) : **dossiers** dans `main.js` (`userData/dossiers/<id>/`, reprise automatique de l'ancien emplacement **par copie**, l'original reste intact), identité de poste (`deviceId`/`deviceName` dans `app-config.json`). Dans storage.js : `syncRevision`/`syncDevice`/`syncWrittenAt` estampillés à chaque écriture, `write()` relit le disque et renvoie `{conflict, disk}` **sans rien écrire** si la révision a bougé. Dans core.js : `mergeData` (fusion par identifiant, le fichier écrit en dernier tranche les désaccords, version écartée archivée dans `conflictArchive`, compteurs au maximum, doublons de numéro signalés) et `trackDeletion` (`data.deleted`, sans quoi une pièce supprimée reviendrait de l'autre poste). Côté renderer, `save()` gère le conflit, fusionne, réécrit en force et explique ce qui s'est passé.
  Règles apprises : le danger du partage n'est pas la panne, c'est le **silence** — avant la 3.2.0, deux postes sur le même dossier iCloud s'écrasaient sans que personne ne le sache. On ne fusionne jamais deux versions d'une même pièce en une troisième : on en garde une, on le dit, on archive l'autre. Le seul cas insoluble est deux factures émises hors ligne sous le même numéro : la parade est organisationnelle (« une seule personne émet »), pas technique, et c'est écrit dans l'aide. Les tests de fusion sont purs et tournent sans Electron ; celui de conflit d'écriture utilise deux `createStorage` sur le même dossier.

- **5.2.0** (ce qu'il faut déposer) : `data.socialFilings`. Dans core.js : `QUARTERS`, `cnssDeclaration` (un salarié par ligne, assiette, part salarié, part employeur, accident, échéance au 15 du mois suivant le trimestre), `employerAnnual` (salaires **et** retenues à la source sur fournisseurs — les deux moitiés du même formulaire), `socialDue` (ce qui est dû, ce qui est en retard, ce qui a été marqué déposé). `fiscalDeadlines` allume l'échéance `cnss` d'elle-même dès qu'un salarié existe ; `todoList` gagne « déclarations sociales à déposer ». Dans app.js : onglet **Déclarations** de la page Paie, export CSV, envoi au comptable avec pièce jointe.
  Règles apprises : la déclaration annuelle d'employeur porte sur **deux choses distinctes** qu'on confond — les salaires versés, et les retenues à la source pratiquées sur des fournisseurs (honoraires, loyers). Les deux figurent sur le même formulaire, et les attestations de retenue non remises se comptent ici comme dans « À faire ». SkanFact **ne dépose rien** et ne se connecte à aucune administration : « Marquer déposée » n'est qu'un pense-bête, pas un accusé de réception — une application qui déposerait à la place de l'utilisateur se tromperait un jour sans qu'il le sache. Un trimestre sans bulletin n'est jamais réclamé.

- **5.1.0** (la vie d'un salarié entre deux bulletins) : `data.leaves`, `data.advances`, plus `leaveDaysPerYear`, `workedDays` et `offDays` dans les barèmes. Dans core.js : `LEAVE_KINDS` (chaque nature porte son effet habituel sur le salaire), `workingDays` (dimanche chômé par défaut), `leaveDaysInMonth`, `leavesOf`, `leaveBalance`, `advancesOf`, `advanceBalance`, **`payslipInputFor`** (le bulletin se remplit à partir des absences et des avances), `HR_DOCS` + `hrDocumentHtml` (attestation, certificat, solde de tout compte), `staffRegister`. Dans app.js : trois onglets de plus dans Paie (Congés, Avances, Registre), `leaveForm`, `advanceForm`, `hrDocForm`, panneaux congés/avances sur la fiche du salarié.
  Règles apprises : une absence à cheval sur deux mois se **répartit** entre les deux bulletins (`leaveDaysInMonth`), sinon le salarié est retenu deux fois ou pas du tout. Ce qu'une avance a remboursé se lit **sur les bulletins** (`deductions[].advanceId`), jamais sur un compteur à part : supprimer une avance ne défait donc pas les retenues déjà passées, et c'est voulu — un bulletin remis ne se réécrit pas. Le salaire ne figure sur une attestation que si on le demande : c'est une information personnelle du salarié. Un certificat de travail ne porte que les dates et l'emploi, jamais le motif du départ ni une appréciation.

- **5.0.0** (payer quelqu'un — *données v6*) : `data.employees`, `data.payslips`, `data.payrollSettings`, plus `company.cnss`. Dans core.js : `CONTRACT_TYPES`, `DEFAULT_PAYROLL` (CNSS 9,18 / 16,57, accident, solidarité, frais professionnels plafonnés, déductions familiales, barème progressif), `payrollSettings`, `irppAnnual`, `computePayslip`, `activeEmployees`, `payslipsOf`, `payslipDate`, `payrollCost`, `payrollSummary`, `missingPayslips`, `payslipHtml` (PDF une page, même langage visuel que les factures). `simpleResult` et `breakEven` gagnent `payroll` (charge **fixe**) ; `cashMovements` produit la sortie d'un bulletin réglé ; `todoList` gagne « bulletins à établir » et « mouvements Salaires comptés deux fois ». Dans app.js : `routes.paie` (trois onglets) et `routes.salarie`, `employeeForm`, `payslipForm`, `exportPayslip`.
  Règles apprises : **aucun taux n'est écrit en dur dans un calcul** — tout passe par `payrollSettings`, sinon l'application devient fausse en silence à la loi de finances suivante. Un bulletin garde une **copie** de son calcul (`slip.computed`) : modifier un barème ne doit jamais réécrire un bulletin déjà remis à un salarié, et un test e2e le vérifie. Le barème progressif se calcule tranche par tranche sur la part du revenu qui la traverse — la première version taxait la tranche entière dès qu'on y entrait, et surestimait l'impôt de 6 % ; c'est le genre d'erreur qu'aucun écran ne montre. Ce qui entre dans le résultat et dans le seuil, c'est le **coût employeur**, jamais le net ni le brut. Un bulletin réglé sort l'argent tout seul : saisir en plus un mouvement libre « Salaires » compte deux fois, d'où la ligne de contrôle dans « À faire » et la disparition de ces mouvements du jeu de démonstration.

- **4.2.0** (photographier au lieu de saisir — **éteint par défaut**) : la seule fonction qui sort de l'ordinateur, et elle ne sort rien tant qu'aucune clé n'est saisie. Dans main.js : `OCR_CFG` (`userData/lecture-config.json`, mode 0600, jamais dans les données ni les sauvegardes), `ocrRequest` (https natif vers api.anthropic.com), `OCR_PROMPT` (JSON strict, « n'invente rien, mets null »), IPC `ocr:status` / `ocr:setKey` / `ocr:pick` / `ocr:read`, plus `attach:addPath`. Dans core.js (testable sans Electron) : `ocrNumber` (1 234,56 · 1.234,56 · 1,234.56) et `ocrToPurchase` (reconnaissance du fournisseur par matricule puis par nom, lignes normalisées, **liste d'avertissements**). Dans app.js : `drawOcrPanel` et `ocrKeyForm` (consentement explicite listant ce qui part), bouton « Depuis une photo… » de l'éditeur d'achat, `ocrReviewForm`.
  Règles apprises : le chemin **sans clé est le chemin par défaut** — la photo est jointe comme justificatif et la saisie se fait à la main, hors ligne, pour toujours. `ocr:read` refuse explicitement quand il n'y a pas de clé : c'est la garantie, et un test e2e la vérifie. L'application **ne remplit jamais toute seule** : `ocrReviewForm` montre ce qui a été lu, signale le fournisseur inconnu, l'écart entre le total des lignes et le total imprimé, le numéro manquant et une date future. Les lignes lues arrivent toutes en `destination: 'charge'` — jamais « stock » sans décision humaine, parce qu'une quantité mal lue pourrirait tout l'inventaire. Un fournisseur inconnu n'est jamais créé d'office (doublons).

- **4.1.0** (savoir qui a quoi) : `data.serials`, plus `serialized` et `warrantyMonths` par article. Dans core.js : `SERIAL_STATUSES`, `WARRANTY_CHOICES`, `serializedItems`, `warrantyEnd` (la garantie court de la **sortie**, pas de l'achat), `serialView`/`serialList`, `availableSerials`, `clientFleet`, `warrantiesEnding`, `serialGap`/`serialGaps`. Dans app.js : `serialIntakeForm` (collage d'une liste, doublons refusés), `serialAssignForm` (depuis « Plus ▾ » d'une facture ou d'un bon de livraison ; décocher remet l'unité en stock), `serialForm`, onglet **Numéros de série** dans Stock, `routes.garanties`, panneau « Matériel installé » sur la fiche client. `todoList` gagne les fins de garantie et les écarts de numéros.
  Règles apprises : une fin de garantie est une **occasion commerciale**, pas une mauvaise nouvelle — le bouton « Proposer un contrat » ouvre un devis au nom du client, et l'aide le dit ainsi. Le suivi par numéro **double** le stock en quantité sans le remplacer : quand les deux comptes divergent, on le signale (`serialGap`) sans rien corriger d'office, parce que la comptabilité s'appuie sur les quantités et pas sur les numéros. Une unité encore en stock n'a pas de garantie en cours : elle n'est chez personne, donc `warrantyEnd` renvoie une chaîne vide plutôt qu'une date trompeuse.

- **4.0.0** (ce qui dort sur l'étagère — *données v5*) : `data.stockAdjustments` et quatre champs par article (`tracked`, `minStock`, `initialQty`, `initialCost`, plus `location`). Dans core.js : `MOVE_SOURCES`, `trackedItems`, `itemOfLine` (par `itemId` si la ligne en porte un, sinon par libellé — même règle que `lineCost`), `stockMovements` (entrées = lignes d'achat `destination: 'stock'`, sorties = factures et bons de livraison, retours = avoirs), `runningStock` (coût moyen pondéré tenu au fil des mouvements), `stockOf`, `stockList`/`stockTotals`, `stockJournal`, `inventoryDiff`, `stockAlerts`, `stockImpact`, **`costOfGoodsSold`**. Dans app.js : `routes.stock` (quatre onglets) et `routes.article`, `adjustForm`, bloc stock dans `catalogForm`, colonne Stock au catalogue, avertissement d'émission dans `issueWarnings`, rappel des lignes « stock » orphelines dans l'éditeur d'achat. `todoList` gagne « stock négatif » et « à recommander ».
  Règles apprises : **acheter de la marchandise n'est pas une charge** — c'est de l'argent transformé en stock. La charge, c'est le `costOfGoodsSold` : les sorties valorisées au coût moyen. Il entre dans `simpleResult` et dans les charges **variables** de `breakEven` ; sans lui, le résultat du mois d'un gros réassort plongeait puis remontait sans raison. Une facture tirée d'un bon de livraison ne doit pas sortir le stock une seconde fois (`fromDocType === 'livraison'` → on saute). Un stock négatif n'est jamais « à ajuster » : c'est une pièce manquante, et l'ajuster ferait perdre en plus la TVA déductible de l'achat oublié — c'est écrit dans l'app et dans l'aide. Dans `demo.js`, les articles se réfèrent par indice (`k[0]`…`k[10]`) : **tout nouvel article s'ajoute à la fin**, sinon toutes les pièces du jeu changent.

- **3.5.0** (ce que tu gardes) : `data.assets`. Dans core.js : `DEFAULT_ASSET_CLASSES` (neuf familles avec leur durée usuelle), `days360` (prorata temporis base 360), `assetSchedule` (plan annuel — la **dernière annuité absorbe les arrondis**, sinon la VNC finit à trois millimes de zéro), `assetYear`, `assetCumulated`, `assetNBV`, `disposalResult` (plus/moins-value contre la VNC du jour), `assetsList`/`assetTotals`, `assetsToCreate` (pont avec les lignes d'achat `destination: 'immobilisation'`), `cappedCumulated`, `depreciationFor`. `simpleResult` gagne `depreciation` et la retire du résultat ; `breakEven` la range dans les charges fixes ; `todoList` gagne « n achats à immobiliser ». Dans app.js : `routes.immos` (trois onglets) et `routes.immo`, `assetForm` (plan en direct pendant la saisie, la famille propose sa durée sans l'imposer une fois le champ touché), `disposalForm` (plus-value annoncée avant d'enregistrer, sortie annulable), `vatWarning`.
  Règles apprises : **une dotation se calcule sur la période demandée, jamais sur l'année entière**. La page Comptabilité peut porter sur un seul mois ; la première version retranchait douze mois d'amortissement d'un mois de ventes et affichait « −1 612 % du chiffre d'affaires ». C'est une capture d'écran qui l'a montré, pas un test — d'où le test « sur un mois on amortit un mois ». `depreciationFor` fait une différence de cumuls, sauf pour une année civile complète où il reprend le chiffre du tableau au millime près, pour que les deux pages ne se contredisent jamais. La fiche du bien montre le plan **d'origine** : l'année d'une cession y figure entière alors que le tableau de l'exercice la montre réduite au jour de la sortie — il faut l'écrire, sinon les deux chiffres paraissent contradictoires. On ne crée jamais la fiche d'une immobilisation tout seul : la durée est une décision. Mais tant qu'une ligne reste en attente, elle n'est déduite **nulle part** — d'où le compteur dans la barre latérale et la ligne dans « À faire ».

- **3.4.0** (la question qu'on ne se posait pas : gagnes-tu de l'argent ?) : `data.projects` (affaires) et `data.fixedCategories`. Dans core.js : `lineCost` (coût de la ligne, sinon celui du catalogue par correspondance de libellé), `documentMargin` (la remise globale ampute le prix, **jamais** le coût — d'où le `factor = netHT / totalHT` ; les lignes `noDiscount` d'acompte sont ignorées), `marginBy` (par client / par prestation), `projectMargin`/`projectList` (marge **exacte** : factures réelles contre achats réels, plus `cash` = encaissé − payé), `recurringProfitability`, `DEFAULT_FIXED_CATEGORIES`/`isFixedCategory`/`breakEven`. Dans app.js : `routes.marges` (quatre onglets) et `routes.affaire`, `projectForm`/`projectItems`, champ **Affaire** dans l'éditeur de document et dans l'éditeur d'achat, `unitCost` au catalogue avec aperçu de marge en direct, marge estimée sous les totaux de l'éditeur.
  Règles apprises : `breakEven` ne compte que `byDestination.charge + fees` — le stock et les immobilisations ne sont pas des charges de la période, sinon un gros achat de marchandises ferait exploser le seuil l'année de l'achat et le ferait disparaître l'année de la vente. Une affaire et un document ne se fusionnent pas : la marge d'un document est une **estimation** (catalogue), celle d'une affaire est **exacte** (achats rattachés) ; le repère « ≈ » dit laquelle on regarde, et l'app ne prétend jamais que l'estimation est exacte. Le champ Affaire suit le client : quand le client change dans l'éditeur, `projectCombo.setItems(projectItems(doc.clientId))` — sans quoi on proposerait les affaires d'un autre client. Deux panneaux `.split` côte à côte ne supportent pas deux tableaux à huit colonnes : sur la fiche d'affaire ils sont empilés, chacun dans son `.scroll-x`.

- **3.1.0** (la soustraction qui manquait) : `vatReturn` (collectée − déductible − crédit repris), `vatChain` (l'enchaînement mensuel des crédits — une déclaration isolée ignore le report et donne un chiffre faux), `DEFAULT_FISCAL_DEADLINES`/`fiscalDeadlines`/`nextDeadline`/`upcomingFiscal`, `simpleResult` (stock et immobilisations exclus des charges), `supplierPayments`. `data.vatCarryIn` (crédit venu de l'année précédente, saisi à la main) et `data.fiscalDeadlines` (règles activées/modifiées). `routes.compta` passe en quatre onglets ; `mail:compose` accepte désormais `attachments` (tableau) pour joindre plusieurs journaux.
  Règles apprises : le bloc de déclaration porte sur **un mois**, jamais sur « toute l'année » — additionner les mois donnerait un chiffre faux à cause des reports ; sans mois choisi on prend le mois en cours et **on l'écrit**. Les échéances fiscales sont un pense-bête réglé par l'utilisateur, avec un « À VÉRIFIER » visible sur la page : les dates réelles dépendent de la forme juridique et du régime.

- **3.0.0** (l'argent qui sort — *données v4*) : `data.suppliers`, `data.purchases`, `data.expenseCategories` ; `migrateData` crée les trois listes vides et normalise chaque achat (version 4, rien à convertir dans l'existant). Dans core.js : `purchaseTotals` (TVA déductible ligne par ligne, `byDestination`), `purchaseBalance`, `purchaseStatus` (déduit des règlements, jamais saisi), `payablesList`, `purchaseJournal`, `purchaseSummary`, `supplierSummary`, `withholdingsToIssue`, `expenseCategories` ; `LINE_DESTINATIONS` (charge / stock / immobilisation) est posé **dès maintenant** pour que 3.4.0 et 4.0.0 n'obligent pas à ressaisir l'historique. Dans app.js : `routes.fournisseurs` / `routes.fournisseur` / `routes.achats` / `routes.achat`, `supplierForm`, `supplierPaymentForm`, `purchaseColumns`, `payablesPanel`/`bindPayables`, `buyBadge`. `todoList` gagne trois lignes fournisseurs. Barre latérale : Ventes / **Achats** / Fichiers / Gestion.
  Règles apprises : un statut d'achat contient une espace (« à payer ») — `class="badge ${status}"` en ferait deux classes, d'où `buyBadge` et les classes `b-due`/`b-part`/`b-late`/`b-paid`. Un champ date est un couple `<input type=hidden>` + `.d-txt` visible dans un `.datefield` : pour le mettre à jour depuis du code il faut toucher les deux (il n'existe pas d'attribut `data-date`, on passe par `hidden.closest('.datefield')`). Les pièces jointes se rattachent à n'importe quel identifiant : le mécanisme de 2.6.0 a servi tel quel pour les justificatifs d'achat.

- **2.6.0** (les pièces qui entourent la facture) : quatre types de documents en plus — `proforma`, `commande`, `livraison`, `contrat` (`C.EXTRA_TYPES`), préfixes `PRO`/`BC`/`BL`/`CTR`, statuts propres, aucun n'entre dans le journal des ventes, la TVA, le CA ni les statistiques. Numérotés au premier enregistrement et **modifiables ensuite** (seuls facture et avoir restent verrouillés). `core.CONVERSIONS` + `convertDoc` + `derivedDocs` alimentent le menu « Transformer ▾ » ; `DEFAULT_CLAUSES`/`CLAUSE_LABELS` pour le contrat à signer. Page `routes.autres` à quatre onglets. Pièces jointes : `storage.addAttachment/removeAttachment/attachmentPath`, dossier `userData/pieces-jointes/<doc>/`, emportées par `mirrorExternal` mais **pas** par les sauvegardes quotidiennes (qui sont un seul JSON) — c'est écrit dans l'app et dans l'aide.
  Règles apprises : `derivedDocs` doit refuser un document sans `id`, sinon `undefined === undefined` fait « descendre » toute la base d'un brouillon (un test l'a attrapé). Le template porte désormais `class="page t-<type>"` : c'est ce qui permet de ne relâcher la hauteur des cases de signature (`height` → `min-height`) que sur le contrat — la faire partout ajoutait 6 px au devis et le faisait passer à deux pages. Vérifier le nombre de pages **avant et après** avec `git stash` : `facture-8` était déjà sur deux pages en 2.5.0, ce n'était pas une régression. Un contrat tient sur une page jusqu'à trois ou quatre lignes ; au-delà il en fait légitimement deux.

- **2.5.0** (page Statistiques, première version du plan des modules) : `core.js` gagne un bloc statistiques testable sans Electron — `periodBounds` (année/trimestre/mois + la même période l'an dernier), `issuedIn`, `salesTotals`, `revenueByMonth`, `topItems`, `clientMovement`, `agedReceivables` (+ `AGING_BUCKETS`), `payerRanking`, `quoteFunnel`, `objectiveProgress` ; `routes.stats` dans app.js avec `statCard` (comparaison N-1), `compareChart` (année entière, période choisie en couleur, N-1 en gris derrière), `askGoal` et `statsCsvRows` ; deux réglages de société (`revenueTarget`, `dormantDays`) dans Paramètres → Documents ; article d'aide « Lire tes statistiques ».
  Règles apprises : `.dash-grid` vaut `2fr 1fr` et ses colonnes se laissent élargir par leur contenu — d'où `.split` en `repeat(2, minmax(0, 1fr))` pour deux panneaux de poids égal (sans le `minmax(0, …)`, un tableau large impose sa largeur et fait déborder la page sous 1340 px). Un graphique mensuel réduit à une seule barre n'apprend rien : on dessine toujours les douze mois de l'année et on estompe ceux qui sont hors période (`.bar-off`). La largeur des barres est plafonnée, sinon un mois seul produit un pavé plein écran.

- **2.4.0** (deux manques signalés par Skander + audit parallèle sur quatre angles) : pile de navigation interne (`navStack`, `backButton`/`bindBack`/`goBack` dans app.js) et « Précédent » dans le menu Affichage ; fiche de contrat `#/contrat/<id>` avec aperçu de la prochaine facture, lignes résolues et factures générées (`recurringId` enfin lu par l'interface) ; événement `contrat` dans `core.documentHistory` ; fenêtres modales empilées ; garde-fou de fermeture de fenêtre (`window:dirty` → `dialog.showMessageBoxSync` dans main.js).

Règles apprises sur la navigation : on tient notre propre pile plutôt que `history.back()`, parce que le garde-fou « modifications non enregistrées » remet la page précédente dans la barre d'adresse pour poser sa question et fausserait l'historique du navigateur. `goBack` traite le cas « on y est déjà » (aucun `hashchange`, donc le drapeau resterait armé et casserait la navigation suivante). Le bouton retour dit toujours où il mène. Piège des fenêtres modales : `#modal-root.innerHTML = …` détruisait la fenêtre du dessous et la saisie en cours ; chaque fenêtre est maintenant une couche, et `onMount` reçoit sa couche, pas tout le conteneur.

Règles apprises sur les composants : un `<select>` reste le bon choix tant que la liste est courte et fermée (statuts, TVA, devise, période) ; `combo()` sert dès que la liste grandit avec les données. Les deux composants gardent leur valeur dans un `<input type="hidden">` nommé, pour que `formValues()` et les gestionnaires `form.onchange` existants continuent de fonctionner sans être réécrits. `closeOverlay` (module app.js) ne garde qu'un seul calendrier ou une seule liste ouverte à la fois. Piège rencontré : `const today = todayIso || today()` dans core.js crée une zone morte temporelle et casse la fonction ; les tests passaient parce qu'ils fournissaient toujours la date de référence — depuis, un test appelle aussi la fonction sans argument.

Règles apprises sur les listes : les totaux du pied de tableau et les exports CSV portent sur la **sélection entière**, jamais sur la page affichée ; toute nouvelle liste doit passer par `paginate` + `sortHead` + `pagerBar` pour rester cohérente ; `bindSort`/`bindPager` prennent un élément racine parce qu'une page peut afficher deux tableaux (Comptabilité, Relances).

Méthode d'audit qui a fonctionné : `test/e2e/entreprise.js` (captures 1440×900 + 1280×800, démo puis états vides juste après l'assistant, chaque modale ouverte), lecture de chaque capture, puis relecture des chemins de code correspondants (validations, confirmations, cas limites).

Non retenu volontairement : synchronisation cloud en temps réel (la 3.2.0 fait du partage de fichier à tour de rôle, pas du multi-utilisateur simultané), e-facture (voir plus haut), barre latérale réductible en icônes (les groupes ont suffi).

## Modules demandés par Skander (11/09/2026), pas encore commencés

Il veut étendre l'app au-delà des ventes. Ordre recommandé et accepté en principe : **achats / fournisseurs / dépenses + TVA déductible** d'abord (c'est la brique dont dépendent les deux suivantes), puis **stock** (entrées par achat, sorties par bon de livraison ou facture, valorisation, numéros de série, rattachement à une affaire), puis **immobilisations** (amortissement linéaire, tableau, VNC, cession), puis **lecture d'une photo de facture** pour préremplir une saisie (jamais d'insertion automatique : formulaire à valider ; suppose une clé d'API payante et l'envoi de l'image hors de l'ordinateur — accord de Skander requis), puis **trésorerie et calendrier fiscal**, et enfin la **paie** (barèmes CNSS/IRPP paramétrables, jamais en dur, et mention invitant le comptable à valider les premiers bulletins). Tous les taux et durées relèvent du « À VÉRIFIER avec ton comptable ».

Ces modules feront passer les données en v4 (migration à écrire) et imposeront de regrouper la barre latérale en Ventes / Achats / Gestion.
**Fait depuis :** 3.0.0 (achats/fournisseurs/dépenses, v4), 3.1.0 (TVA déductible et calendrier fiscal), 3.2.0 (travailler à deux), 3.3.0 (trésorerie), 3.4.0 (marges), 3.5.0 (immobilisations), 4.0.0 (stock, v5), 4.1.0 (séries et garanties), 4.2.0 (photo de facture, éteinte par défaut), 5.0.0 (paie, v6), 5.1.0 (congés, avances et documents du personnel), 5.2.0 (déclarations sociales). **Le plan accepté le 11/09/2026 est intégralement livré.**

## Repéré par l'audit du 11/09/2026 — les huit constats, corrigés en 5.2.1

Constats laissés de côté en 2.4.0 et repris en bloc en **5.2.1**. Tous corrigés, gardés ici parce qu'ils décrivent des règles à ne pas casser :

- Choisir un logo ou un cachet dans Paramètres écrasait les modifications non encore enregistrées du formulaire → `setImage()` appelle `applySettings()` **avant** de redessiner. Toute action de Paramètres qui provoque un `render()` doit faire pareil.
- Relances et Comptabilité étaient les deux seules pages de liste sans recherche → `relState.q` / `comptaState.q` ; quand un filtre est actif, la page **écrit** que les totaux ne portent que sur la sélection.
- Un modèle de document ne se modifiait pas → `templateForm(tpl, done)` (nom, type, remise, objet, notes, lignes avec sélecteur de catalogue).
- La suppression était incohérente (fiche pour les clients, ligne pour le reste) → elle vit désormais **dans la fenêtre de modification**, partout (`clientForm`, `catalogForm`, `snippetForm`, `templateForm`, `recurrenceForm`) ; plus aucun « Supprimer » en bout de ligne. La confirmation nomme ce qui est rattaché (documents portant la prestation, factures issues du contrat, stock restant).
- Les notes internes d'un client s'enregistraient en silence → la fiche le dit et affiche un « ✓ enregistré » passager (`#cl-notes-saved`).
- Clients et Catalogue n'avaient pas de pied totalisé → `drawList` accepte `opts.foot(kept, all)` ; comme pour les autres listes, le pied porte sur la **sélection entière**, pas sur la page affichée.
- « Documents récents » vide n'offrait rien → propositions concrètes (`#start-client`, `#start-devis`, `#start-cat`, `#start-demo`).
- Les boutons de ligne étaient invisibles hors survol sur Clients et les documents → `td.row-actions > span` passe de `opacity: 0` à `.45` (et `1` au survol).

## 6.0.0 — La clôture de période

`data.closedUntil` (dernier jour clôturé) + `data.closureLog` (chaque clôture et réouverture, avec motif). Dans core.js : `isClosedDate`, `closedPeriodLabel`, `closableMonths`, `closureChecks`, `closePeriod`, `reopenPeriod`, `closureLog`. Dans app.js : **`closedBlock(dates, quoi)`** — une seule porte pour toute l'application, qui affiche la fenêtre d'explication et renvoie `true` si c'est refusé ; `closedToast` pour les actions de liste ; `closedWipeOk` pour les remplacements en masse. Onglet **Comptabilité → Clôtures**, ligne « À faire » à dix jours.

Règles apprises :
- **Tester l'ANCIENNE date autant que la nouvelle** quand on modifie une pièce. Sans ça, il suffirait de changer la date d'une facture de mars pour la sortir d'un mois déjà déclaré, et la TVA de mars changerait en silence.
- **Le garde-fou se pose AVANT `nextNumber`.** `nextNumber` écrit `data.counters` même si l'enregistrement échoue ensuite : posé après, chaque refus aurait troué la numérotation. C'est ce qui a révélé que `issue()` consommait le numéro avant d'enregistrer (corrigé), et que l'export PDF d'un brouillon ignorait l'échec de `persist()` et exportait une pièce non écrite (corrigé).
- **Les contrôles avant clôture ne bloquent jamais.** Un mois clôturé avec deux manques signalés vaut mieux qu'un mois jamais clôturé parce que l'app faisait la difficile.
- **Une réouverture exige un motif** : c'est la seule trace qui explique au comptable pourquoi un chiffre a changé après son envoi.
- Un remplacement en masse (démo, import, effacement) **prévient** au lieu de refuser : c'est un geste volontaire.
- Méthode qui a payé : un workflow de 18 agents a recensé **347 points d'écriture datés** famille par famille, puis proposé le garde-fou de chacun. Il a trouvé cinq écritures manquées à la main, dont les deux fautes ci-dessus. À refaire avant toute règle transversale de ce genre.

## 6.1.0 — Le paquet mensuel (`.skanpack`)

Nouveau module **`src/zip.js`** (Node pur, testé sans Electron) : `zipBuffer`/`zipRead` écrivent et relisent un vrai ZIP sans aucune dépendance, `sealBuffer`/`openBuffer`/`sealHeader` scellent en AES-256-GCM + scrypt. Dans core.js : `packPeriod`, **`packPlan`** (la liste exacte de ce qui partira, pure et testable), `packChecklist`, `packCoverHtml`, `packFileName`, plus les colonnes de journaux (`salesCsvColumns`…) que app.js réutilise. Dans main.js : `pack:build` exécute le plan (PDF, empreintes, zip, scellement, écriture atomique). Onglet **Comptabilité → Cabinet**, `data.packs` pour l'historique.

Règles apprises :
- **Le paquet est un ZIP ordinaire**, pas un format maison. Le comptable doit pouvoir l'ouvrir avec le Finder même si SkanFact disparaît : on ne devient jamais le seul lecteur possible des pièces comptables de quelqu'un d'autre.
- **Le renderer décide du contenu, main.js ne fait qu'exécuter.** `packPlan` est pur : tout le contenu du paquet se teste sans lancer Electron, et l'utilisateur voit ce qui partira **avant** la fabrication.
- **Un fichier introuvable ne fait pas échouer l'envoi** : le paquet part sans lui et le manifeste le dit (`absents`). Mieux vaut 99 % avec le trou signalé qu'un envoi qui échoue.
- **L'entête d'un paquet scellé reste en clair** (nom, mois) : sans elle, un paquet mal rangé serait impossible à identifier avant d'avoir la clé. Le corps est binaire, pas base64 — sur 50 Mo de photos, base64 ajouterait 17 Mo pour rien.
- **Le manifeste s'écrit en dernier** : il porte l'empreinte des fichiers réellement produits, et ne peut pas contenir la sienne (un test le vérifie).
- Piège JavaScript : `0o100644 << 16` devient **négatif** (décalage sur 32 bits signés) et `writeUInt32LE` le refuse — d'où le `>>> 0` sur les droits Unix du répertoire central.
- Un JPEG ou un PDF ne se recompresse pas : deflate les rallonge. `ALREADY_COMPRESSED` les passe en mode « stocké ».
- Le workflow de conception à trois approches a **échoué** (schéma de sortie à neuf champs obligatoires : les agents n'ont jamais produit de sortie valide en cinq essais). Leçon : un schéma structuré doit rester court, ou la conception se fait à la main.

## 6.2.0 — L'appairage du cabinet

`company.cabinet = { name, email, publicKey, fingerprint, pairedAt }`. Dans zip.js : `generateCabinetKeys` (X25519), `keyFingerprint` (SHA-256 de la clé, cinq groupes de quatre — assez court pour être dicté au téléphone), `sealForCabinet` / `openWithCabinetKey` / `cabinetHeader`. Dans main.js : `cabinet:import` lit un `.skanpair` et **recalcule l'empreinte** au lieu de croire celle du fichier. Onglet **Paramètres → Cabinet comptable**.

Règles apprises :
- **Une clé publique ne se protège pas, elle se vérifie.** Le fichier d'appairage ne contient rien de secret ; le seul risque est qu'il vienne d'un imposteur, d'où l'empreinte à lire de vive voix. `cabinet:import` refuse un fichier dont l'empreinte annoncée ne correspond pas à la clé qu'il contient.
- **Une clé éphémère par paquet** : deux envois du même mois ne donnent jamais deux fichiers identiques, et compromettre un paquet ne compromet pas les autres.
- L'entête reste en clair (entreprise, mois, empreinte du destinataire) : un paquet mal rangé doit rester identifiable sans clé.
- Trois niveaux dans `pack:build`, dans cet ordre : cabinet appairé → mot de passe → rien. Quand un cabinet est appairé, le champ mot de passe **disparaît** de l'écran plutôt que de rester là à ne servir à rien.

## Règle apprise en 5.2.3 : les dates et le fuseau horaire

**La machine de test est en UTC ; l'utilisateur est à Tunis (UTC+1).** `addDays` construisait la date en heure locale (`new Date(iso + 'T00:00:00')`) et la relisait en UTC (`toISOString()`) : à minuit à Tunis il est 23 h la veille en UTC, donc `addDays(d, 1)` renvoyait `d`. Depuis toujours, une échéance à 30 jours tombait un jour trop tôt chez lui ; depuis la 5.1.0, la boucle jour par jour de `workingDays` ne finissait jamais et l'app entière gelait au chargement de la démo (qui contient des congés). Sur la machine en UTC, **rien ne se voyait** : quatre reproductions différentes, tous les chronométrages, la vraie 5.1.0 dans Electron — tout passait. C'est le bisect fait à la main par Skander (3.4 → 4.2 → 5.0 ok, 5.1 gèle) qui a désigné `workingDays`, et la question « qu'est-ce qui diffère entre sa machine et la mienne ? » qui a donné le fuseau.

Règles :
- Une date de l'app est un **jour du calendrier** (`AAAA-MM-JJ`), jamais un instant. Toute arithmétique se fait en **UTC pur** : `new Date(iso + 'T00:00:00Z')`, `setUTCDate`, `getUTCDay`, `Date.UTC(...)`. Jamais `new Date(y, m, d)` ni `T00:00:00` sans `Z` ni `getDay()`.
- `today()` est l'exception : c'est le jour **local** (composantes `getFullYear/getMonth/getDate`), parce que c'est le calendrier de l'utilisateur. Un instant enregistré (`createdAt`, `at` d'un paiement) se convertit en jour local de la même façon, jamais par `toISOString().slice(0, 10)`.
- Jamais de boucle qui avance une chaîne de date « jusqu'à » une autre : compter des jours sur des instants UTC, avec une borne.
- Le test « dates : le même résultat à Tunis… » change `process.env.TZ` à chaud sur cinq fuseaux. Toute nouvelle fonction de date s'y ajoute.
- Symptôme à reconnaître : un bug **que la machine de test ne reproduit jamais** malgré des données identiques → chercher ce qui diffère dans l'environnement (fuseau, locale, plateforme, heure) avant de chercher dans le code. Un gel sans aucune erreur, Cmd+Q sans effet, défilement qui marche encore = boucle infinie JavaScript (le défilement est composé hors du fil principal).

Idée gardée pour plus tard, non livrée : un chien de garde dans `main.js` qui interroge l'interface toutes les 3 s et, sans réponse, branche `webContents.debugger` pour lire la pile (le domaine Debugger doit être activé **avant** le gel, sinon `Debugger.enable` attend le fil bloqué) puis `Runtime.terminateExecution`. Utile pour un produit vendu : un gel deviendrait un rapport dans `main.log`.

## Règle apprise en 5.2.2 : l'ordre des couches

Un bouton parfaitement visible peut être inerte. Une fenêtre modale (`.modal-bg`, z-index 400 et au-dessus, empilée par `modal()` depuis la même base) doit couvrir **tout** écran qui occupe la fenêtre entière — l'assistant `#setup` (250), `#lock-screen` (200), `#palette-root` (60) — et rester sous `#info-pop` (900) et `#toast` (950), qui doivent se lire par-dessus elle. Avant la 5.2.2, une confirmation ouverte depuis l'assistant s'affichait derrière lui : les clics atterrissaient sur l'écran du dessus.

Ce bug n'était visible dans **aucune** console : rien ne plante, le clic n'existe simplement pas. Les deux signes à reconnaître, parce qu'aucune trace n'en sera jamais laissée : un bouton qui finit par répondre **après plusieurs essais** (on tombe sur un pixel où il passe devant), et un **curseur qui change de forme d'un pixel à l'autre** (`elementFromPoint` renvoie tantôt le bouton, tantôt l'écran du dessus). Devant ce symptôme, la première chose à faire est `document.elementFromPoint(x, y)` au centre du bouton, pas la lecture des erreurs.

Une promesse posée par une boîte de dialogue doit **toujours** se résoudre : `modal()` prend un `onDismiss`, et Échap comme le clic à côté valent « Annuler ». Une promesse en suspens bloque son appelant pour toujours, sans erreur.

Le test `couches : une question passe au-dessus de tout` lit `style.css` et `app.js` et vérifie cet ordre sans Electron.

## Le plan Cabinet (12/09/2026) — `PLAN-CABINET.md`

*(Direction du 15/09/2026, `DIRECTION.md` : le Cabinet n'est plus gratuit sans condition — gratuit pour les dossiers sur SkanFact et trois dossiers hors SkanFact, payant au-delà — et il devient le logiciel de comptabilité du cabinet. Ce qui suit reste vrai pour le reste.)* Skander veut vendre SkanFact aux entreprises **en passant par les cabinets comptables** : cabinet gratuit (app **SkanFact Cabinet**, même dépôt, second installeur), entreprise payante, remise pour le client parrainé, jamais de commission au comptable (déontologie À VÉRIFIER). Pas de serveur en v1 : les deux apps s'échangent un **paquet mensuel chiffré** (`.skanpack`). Le plan complet, les versions dans l'ordre (6.0.0 clôture → 6.1.0 paquet → 6.2.0 appairage → Cabinet 1.0.0 → Cabinet 1.1.0 export d'écritures → 6.3.0 licence/mises à jour publiques → 6.4.0 signature → 6.5.0 filets → 7.0.0 serveur seulement si un cabinet dit oui) et l'inventaire (achats, décisions, questions au comptable, vérifications légales) sont dans **`PLAN-CABINET.md`**. Le lire avant de commencer une version 6.x. Règles fixées : l'app cabinet **ne modifie jamais** les données du client ; un paquet n'est **définitif** que si le mois est clôturé ; l'empreinte du cabinet est **à la fois** la clé de chiffrement et la preuve du parrainage ; à l'expiration d'une licence, **jamais de données en otage**.

## Cabinet 1.0.0 — la seconde application

`src/cabinet/` : une **autre application Electron dans le même dépôt**, construite par `build/cabinet.config.js` (`appId` `tn.skancyber.skanfact.cabinet`, `extraMetadata.main` → `src/cabinet/main.js`, sortie `dist-cabinet/`, `publish: null`). *(Vrai en 1.0.0 : sa version vivait dans `cabinetVersion` de package.json, sans mise à jour automatique. **Depuis la 6.6.0 les deux applications portent le MÊME numéro** — `build/cabinet.config.js` lit `pkg.version`, `cabinetVersion` n'existe plus — et le Cabinet se met à jour par son canal `cabinet`.)* Le workflow Release la construit après l'app principale et attache ses installeurs à la même release (`gh release upload`).

- `src/cabinet/cabcore.js` : logique pure, testée sans Electron — `migrate`, `dossierKey` (**matricule d'abord**, nom en repli), `packSummary`, `filePack`, `dossierMonths`/`dossierRow`/`dossierList`, `cabinetTodo`, `monthListLabel`/`missingLabel`/`relanceMail`, `pairingFile`, `demoDossiers`.
- `src/cabinet/main.js` : état chiffré (`cabinet-data.json`, scrypt + AES-256-GCM, mot de passe **obligatoire**), `safeState()` (la clé privée ne traverse jamais le pont), IPC `cab:status|unlock|state|saveCabinet|saveDossier|demo|exportPairing|importPack|listPack|openInPack|mail|reveal`, `ingest()` qui **recalcule chaque empreinte du manifeste**.
- `src/cabinet/renderer/` : `index.html`, `app.js`, `cabinet.css` — le reste vient de `../../renderer/style.css`, partagé.
- `build/icon-cabinet.png` : même langage visuel, fond ardoise, dossier au lieu de la feuille.

Règles apprises :
- **L'application cabinet ne modifie jamais les données d'un client et ne lui renvoie rien.** Le préchargement ne l'expose même pas : un test vérifie qu'il ne contient ni `data:save` ni `pack:build`, et qu'aucun handler ne renvoie `state` brut au lieu de `safeState()`.
- Un dossier s'identifie par le **matricule fiscal**, jamais par le nom : un nom change de forme juridique, se corrige, et deux clients peuvent s'appeler pareil. Sans matricule seulement, on retombe sur le nom normalisé.
- Un mois **reçu deux fois** n'est pas une erreur, c'est une information : le client a rouvert sa période. `filePack` renvoie `replaced`/`wasDefinitive`/`nowDefinitive` et l'interface le **dit**, surtout quand le remplacé était définitif.
- Le **mois en cours n'est jamais réclamé**, et rien n'est réclamé avant le premier paquet reçu : on ne réclame pas le néant.
- Un logiciel qui écrit « 1 dossier(s) » ou « de octobre » paraît bâclé — et c'est le premier contact d'un comptable avec SkanFact. D'où `pl()` des deux côtés, `de()` pour l'élision, et `missingLabel` qui donne l'intervalle au-delà de trois mois (un objet de mail qui énumère onze mois n'est plus lu).
- **Un bouton sans bordure ni couleur n'est pas un bouton.** En 1.0.0 l'exemple se chargeait par un `btn-ghost` centré au milieu d'un cadre pointillé : Skander a ouvert l'application et a dit « elle est vide, il manque le jeu de données ». Une proposition faite au premier lancement doit ressembler à ce qu'elle est — deux vrais boutons côte à côte, et la même action répétée dans les Réglages, là où on va la chercher quand on ne l'a pas trouvée (corrigé en 1.2.0). Au passage : un écran sans aucune donnée ne montre ni recherche, ni filtre, ni « 0 sur 0 », et surtout pas un « tout est à jour » qui parle de dossiers qui n'existent pas.
- Le **jeu d'exemple** (`demoDossiers`) montre les quatre situations et s'efface tout seul au premier vrai paquet : des retards imaginaires à côté des vrais seraient pires que rien. *(Jusqu'à la 9.2.1 ses paquets n'avaient pas de `path` ; depuis la 9.2.2 ce sont de vrais `.skanpack`, voir § 9.2.2.)*
- Depuis la 6.2.1 le manifeste porte `chiffres` (CA, TVA collectée/déductible, à décaisser, encaissé) et `compte` : le cabinet affiche le chiffre d'affaires du dossier sans ouvrir un CSV. Champ **facultatif à la lecture** — un paquet plus ancien n'en a pas, et on écrit « — », jamais zéro.
- « 7 pièces vérifiées, intactes » est la **seule affirmation rigoureuse** de l'app cabinet : elle doit compter juste. Le manifeste ne se liste pas lui-même (il ne peut pas porter sa propre empreinte), et un fichier **absent** n'est pas un fichier vérifié. La règle vit dans `cabcore.checkIntegrity(manifest, hashes)` — pure et testée — pendant que main.js se contente de calculer les empreintes. Corrigé en 6.5.2 : le code retranchait un de trop.
- Les quatre cas tordus à retester après toute modification de `ingest` (`test/e2e/cabinet-refus.js`) : un fichier qui n'est pas un paquet, le même mois reçu deux fois, un paquet adressé à un autre cabinet, un paquet protégé par mot de passe. Chacun doit donner une phrase en français que le comptable comprend sans appeler personne.
- Le test qui compte est `test/e2e/boucle-complete.js` : **deux vraies applications Electron** à la suite — le cabinet exporte son appairage, l'entreprise l'importe et fabrique un paquet, le cabinet le reçoit, l'ouvre et prépare la relance. C'est le seul qui prouve que le plan tient debout ; le relancer avant toute release touchant au paquet ou à l'appairage.

## 6.3.0 — Les écritures comptables (aussi Cabinet 1.1.0)

Dans core.js : `DEFAULT_ACCOUNTS` + `ACCOUNT_LABELS` + `ENTRY_JOURNALS`, `chartAccounts(data)` (surcharge par `data.chartAccounts`), `journalEntries(data, company, period, opts)`, `entriesBalance`, `entriesByAccount`, `entryCsvColumns`. `packPlan` ajoute `journaux/ecritures.csv` et renvoie `balance` ; la page de garde l'annonce. Dans app.js : onglet **Comptabilité → Écritures** (`ecrState`, tri, pagination, export CSV, envoi au comptable) et `chartForm`.

Règles apprises :
- **Aucun numéro de compte n'est une vérité.** Ceux proposés suivent l'usage tunisien ; chaque cabinet a les siens. Tout est modifiable, et la page, la bulle et l'aide écrivent « À VÉRIFIER ». Ce qui est garanti, c'est l'**équilibre** : débit = crédit sur chaque pièce, vérifié sur les 24 mois du jeu de démonstration.
- **Un montant négatif change de colonne, il ne garde pas son signe.** Un avoir s'écrit D ventes / D TVA / C client. Aucun logiciel comptable n'accepte un débit négatif — c'est ce qui aurait fait refuser le fichier à l'import, sans que personne comprenne pourquoi.
- Les arrondis de TVA ligne par ligne peuvent laisser quelques millimes d'écart : `entrySet.done()` les absorbe sur la dernière ligne plutôt que de livrer une pièce déséquilibrée.
- Une facture **annulée** ne produit aucune écriture : comptablement, elle n'a jamais existé.
- Piège : `toCsv` attend des colonnes `{key, label, type}`. Une liste de paires `['date','Date']` produit un fichier **sans entête**, et rien ne plante — d'où le test qui vérifie la première ligne au caractère près.

## 6.4.0 — La licence hors ligne

`src/licence.js` (Node pur, testé) : `generateKeys`, `signLicence`, `parseKey`, `verifyKey`, `licenceState`, `requestMail`. `scripts/licence.js` fabrique les clés (privée en mode 600 dans `~/.skanfact/`, **jamais** dans le dépôt ; publique à côté — depuis la 7.33.0 le keygen n'écrit plus dans `build/`, et depuis la 8.0.0 ce fichier est la clé de Skander, voir § 8.0.0). Dans main.js : `licence:status` / `licence:set` (refuse une clé invalide au lieu de la stocker) / `licence:requestMail`, `installedAt` dans `app-config.json`. Dans app.js : `licenceBlock(quoi)` — une seule porte, comme `closedBlock` — et l'onglet **Paramètres → Licence**.

Règles apprises :
- **Jamais de données en otage.** Une licence expirée ne bloque QUE la création de nouvelles pièces. Lire, imprimer, exporter, sauvegarder, envoyer le paquet au comptable : toujours. Un test relit `app.js` et vérifie qu'aucun `licenceBlock` n'est posé ailleurs que sur une création.
- **Modifier une pièce existante reste possible** même bloqué : sinon une licence expirée empêcherait de corriger une faute de frappe.
- **L'application est livrée désarmée** *(vrai de la 6.4.0 à la 7.33.0 — retourné en 8.0.0, voir § 8.0.0 : le test exige désormais la PRÉSENCE du fichier)*. Sans `build/licence-public.json`, l'état est `libre` et rien ne se verrouille. Armer la licence est une décision du propriétaire, pas l'effet de bord d'une mise à jour.
- Aucun appel réseau : la clé est vérifiée sur le poste. Une entreprise sans connexion ne doit pas perdre sa facturation, et l'app doit survivre à la disparition de son éditeur.
- `plainError(e)` : une erreur venue du processus principal arrive habillée en « Error invoking remote method '…': Error: … ». On ne montre que la phrase écrite pour l'utilisateur.

## 6.5.0 — Le chien de garde (les filets)

`startWatchdog(win)` dans main.js, `alive:ping`/`alive:pong`, `freeze:notice`, `support:info`, `support:openLog` ; « Signaler un problème » dans l'Aide.

Règles apprises — les quatre, tenues par un test qui relit la source :
1. **`Debugger.enable` s'active AVANT le gel.** Demandé pendant, il attend le fil bloqué et n'arrive jamais.
2. **`Debugger.resume` AVANT `Runtime.terminateExecution`.** Interrompre une machine virtuelle en pause ne rend jamais la main — le chien de garde gèle à son tour, et c'est ce qui est arrivé à la première version.
3. **Aucune fenêtre synchrone.** `showMessageBoxSync` bloque le processus principal tant que personne ne répond ; devant une application figée, personne ne peut répondre. On recharge sans rien demander, puis on **dit** ce qui s'est passé — un redémarrage silencieux ferait douter de ce qui a été enregistré.
4. **Chaque commande au débogueur est bornée** (`Promise.race`) : le surveillant ne doit jamais pouvoir geler.

Autre règle : les abonnements aux messages du processus principal (`onAlivePing`, `onFreezeNotice`) se posent **avant** la séquence de démarrage. L'assistant de première utilisation la met en attente, et tout message reçu pendant ce temps était perdu.

Et une cinquième, trouvée en 6.5.1 : **un seul programme peut inspecter la page à la fois.** Le chien de garde se détache quand les outils de développement s'ouvrent et se rattache quand ils se ferment — sinon ouvrir les outils le débranchait en silence, et on se croyait surveillé sans l'être.

Le test qui compte est `test/e2e/chien-de-garde.js` : il **gèle vraiment** l'application avec une boucle infinie et vérifie que le journal nomme la fonction coupable. C'est le test qu'on aurait voulu avoir en 5.1.0.

## 6.7.0 — Le relais de mise à jour

`worker/skanfact-maj.mjs` (module ES, déployé sur Cloudflare Workers, gratuit) + `worker/README.md`. Il détient le jeton GitHub ; les applications présentent le **secret de l'application** (`PKG.updateSecret`) et, si elles en ont une, leur **licence**. `route`, `fichierAutorise`, `memeSecret`, `licenceValide` et `autorise` sont purs et testés dans `npm test` (le module ES s'importe avec `await import`).

Côté applications : `relayBase()` dans `src/main.js` et `src/cabinet/main.js`. `updateBase` et `updateSecret` arrivent par `extraMetadata` **à la construction** (secrets `UPDATE_BASE`/`UPDATE_SECRET` du dépôt) — jamais dans Git, conformément à la règle « ne jamais commiter de token ».

Règles apprises :
- **Tout ce qu'une application peut télécharger sans secret, un inconnu le peut aussi.** Il n'y a pas de mise à jour automatique « privée » sans déplacer le secret côté serveur. Un jeton embarqué dans l'app arrête les curieux, pas quelqu'un qui ouvre le paquet.
- **Le repli doit exister** : sans réglages de relais, les deux applications retombent sur GitHub + jeton saisi à la main. Une version livrée ne doit jamais dépendre d'un service que personne n'a encore déployé. Un test le vérifie.
- **Une licence expirée reçoit quand même les mises à jour.** Elle limite la création de pièces dans l'app, pas le droit de recevoir une correction de bug. `LICENCE_REQUISE=1` existe pour le jour où tous les clients auront une licence.
- **Un canal ne doit jamais pouvoir réclamer les fichiers de l'autre** : sinon l'app du comptable proposerait d'installer l'app entreprise, sans que rien ne plante.
- Piège du harnais de test : `t('…', async () => …)` affichait **« ok » sans rien vérifier** — la promesse n'était pas attendue, et le test ne pouvait plus jamais échouer. `t()` refuse maintenant une fonction asynchrone, et `ta()` existe pour ce cas. Vérifié en cassant volontairement une assertion.

## 6.7.2 — Une panne de mise à jour se nomme

Relais branché pour de vrai chez Skander : « Vérifier les mises à jour » répondait **« Module de mise à jour indisponible. »**, et ni lui ni moi ne pouvions rien en faire — `getUpdater()` attrapait l'erreur dans un `catch` muet. Le test `mises à jour : une panne se nomme, et laisse un recours` relit les quatre fichiers concernés et interdit les deux fautes.

Règles apprises :
- **Un `catch` qui jette la cause condamne l'utilisateur ET le dépannage à distance.** `updaterError` garde la phrase, le message la montre, `logToFile` l'écrit. Un diagnostic vaut une version à lui seul quand la boucle de correction coûte une réinstallation manuelle.
- **Un chemin de secours ne sert que s'il se déclenche tout seul.** Le repli GitHub existait depuis la 6.7.0, mais seulement quand le relais n'était **pas configuré** — pas quand il était configuré et cassé, le seul cas qui arrive vraiment. Désormais `configureFeed` valide l'adresse (`new URL`) et retombe sur GitHub en cas d'échec.
- **Un relais en panne n'est pas un relais** : `update:version` renvoie `relay: false` dans ce cas, sinon l'écran continue d'afficher « rien à configurer » pendant que plus rien ne peut se mettre à jour, et le champ jeton — la seule issue — reste caché.
- **Tout ce qui arrive d'un copier-coller se `trim()`** avant usage. C'était **la cause exacte** : le secret `UPDATE_BASE` contenait une espace en fin (un copier-coller d'adresse en attrape une sans qu'on la voie). `new URL('https://…workers.dev /app')` **lève** — une espace n'a pas le droit d'exister dans un nom de domaine — alors qu'un retour à la ligne, lui, est silencieusement supprimé par l'analyseur d'URL. Vérifié à l'identique : 6.7.1 (sans `trim`) échoue, 6.7.2 (avec) fonctionne, avec les mêmes valeurs.

Méthode qui a payé, à refaire : **séparer les deux moitiés avant de chercher**. Le testeur HTTP de Cloudflare, avec l'en-tête `X-SkanFact-App` posé à la main, a renvoyé `200` et le vrai `latest-mac.yml` — le relais et le jeton GitHub étaient donc hors de cause, et il restait l'application. Sans cette manipulation, on cherchait dans deux systèmes à la fois.

**Le quota GitHub Actions est une ressource limitée.** Six versions publiées en une matinée ont consommé le quota gratuit d'un mois entier (~0,65 $ la publication : quatre applications, et les machines macOS sont facturées dix fois les autres). Skander a refusé de payer, et il a raison : c'est le rythme qui était fautif, pas le tarif. **Regrouper les corrections et publier une fois.** Quand le quota manque, `Installer SkanFact.command` construit les deux applications sur son Mac, avec le relais, gratuitement — c'est ce qui a permis de diagnostiquer cette panne-là.

## 6.7.3 — Jamais de retour en arrière

`autoUpdater.channel = 'cabinet'` met **`allowDowngrade` à `true`** : c'est écrit dans la documentation d'electron-updater (changer de canal peut légitimement vouloir dire reculer), et l'app du cabinet est la seule à déclarer un canal. Résultat : en 6.7.2 elle téléchargeait la 6.7.1, c'est-à-dire qu'elle proposait de réinstaller le défaut qu'on venait de corriger — et précisément celui qui cassait la mise à jour, donc sans retour possible.

Règles :
- **`allowDowngrade = false` se repose APRÈS l'affectation du canal**, jamais avant. Le test `mises à jour : une panne se nomme, et laisse un recours` vérifie l'ordre des deux lignes dans la source, et a été prouvé en retirant le correctif.
- **Un réglage qui s'active en effet de bord d'un autre est un piège à relire dans la source du module**, pas dans son README. C'est la deuxième fois de la journée qu'une ligne d'electron-updater se comporte autrement qu'attendu.
- Ce bug ne se voyait que parce que la version installée (construite localement) était **plus récente** que celle publiée. Un écart de ce genre est un révélateur à exploiter, pas une anomalie à ignorer.

Autre règle posée au même moment : **le mode développement écrit dans un dossier séparé** (`SkanFact (essais)` / `SkanFact Cabinet (essais)`), et `--user-data-dir` reste prioritaire pour que les tests s'isolent. `package.json.name` vaut `skanfact` et `productName` vaut `SkanFact` : sur macOS, dont le système de fichiers ignore la casse, c'était **le même dossier**. `npm start` travaillait donc sur les vraies factures de l'utilisateur — un accident qu'on ne découvre qu'après.

## 6.8.0 — Cabinet 2.0 : ne rien perdre, voir tout le portefeuille, travailler

Audit de l'app cabinet (24 constats dans `PLAN-CABINET.md`) traité en bloc. Nouveau module **`src/cabinet/cabstore.js`** (Node pur, testé) : sauvegarde quotidienne (l'état du matin, 30 jours), sauvegardes nommées avant import et avant suppression, `peek`/`restore`, copie externe qui emporte **aussi les paquets**, `makeRecovery`/`readRecovery` (clé de secours), `setPassword` qui rechiffre les sauvegardes, fichier illisible mis de côté, `reorganize` (paquets rangés par client/année), `removeDossierFiles`, `packStats`. Dans cabcore : `newDossier`, `parseDossierLines`, `noteRelance`, `portfolio`, `relanceDue`, `relanceRows`, `echeances`/`dayOf`, `parseCsv`/`mergeEcritures`/`ecrituresPlan`. Nouvelles pages **Échéances** et **Écritures**, assistant de première utilisation, `cabguide.js` (30 bulles + 7 articles).

Règles apprises :

- **La sauvegarde est le seul point où un incident coûte vraiment cher.** L'app cabinet détient la comptabilité de dizaines d'entreprises ET la clé qui ouvre leurs paquets, et elle n'avait rien. La clé de secours exportable est le filet qui manquait le plus : sans elle, perdre le poste rend illisible **pour toujours** tout ce qui a été reçu. L'écran le dit en rouge tant qu'elle n'a pas été enregistrée.
- **Perdre le fichier principal ne doit pas ressembler au premier jour.** Sauvegardes présentes + base absente : l'écran le dit et emmène aux sauvegardes, il n'ouvre pas un assistant de bienvenue. Et le piège qui n'apparaît qu'à ce moment-là : chaque création tire un **nouveau sel**, donc le même mot de passe ne donne pas la même clé et les sauvegardes paraissent verrouillées. `peek` réessaie avec le sel de la sauvegarde ; le mot de passe est gardé en mémoire pour la session à ce seul usage (la clé dérivée y est déjà, ce n'est pas un affaiblissement). Trouvé par `npm run e2e:perte`, invisible autrement.
- **Une restauration dit d'abord ce qu'on va perdre** (dossiers et paquets de la sauvegarde contre ceux d'aujourd'hui) et met l'état actuel de côté avant d'écraser. Sinon c'est un pari, pas une restauration.
- **Changer le mot de passe rechiffre les sauvegardes.** Une sauvegarde restée sur l'ancien mot de passe n'est pas une sauvegarde. Et l'ancien mot de passe est **revérifié en relisant le fichier** : sans ça, quelqu'un qui passe devant un poste déverrouillé le changerait sans le connaître.
- **Une fonction appelée mais jamais définie ne se voit nulle part avant l'exécution** — ni à la lecture, ni au `node --check`, ni dans les tests qui ne touchent pas cette ligne. C'est ainsi que `h(a.relayFailure)` (copié de l'app entreprise, où la fonction d'échappement s'appelle `h` et non `esc`) a atterri dans le renderer du cabinet : le panneau des mises à jour plantait **au moment précis où il devait annoncer une panne**. Le test `l'interface n'appelle aucune fonction qui n'existe pas` lit le code sans les commentaires ni le texte des chaînes, **mais en gardant les `${…}` des gabarits** — c'est là qu'il était. Son analyseur est un automate (pile gabarit/interpolation, détection des expressions régulières) : une version à coups d'expressions régulières se désynchronise sur `/'/g` et sur les gabarits imbriqués. Il se prouve lui-même sur un cas fabriqué avant de juger le vrai code.
- **L'app cabinet charge `style.css` (partagée) PUIS `cabinet.css`.** Une classe portant le même nom des deux côtés prend en silence les règles de l'autre application. L'assistant du cabinet utilisait `.setup-card` / `.setup-step`, que style.css réserve au « étape 3 sur 5 » de l'app entreprise — avec `white-space: nowrap`. Le texte ne revenait pas à la ligne, les boutons sortaient de la fenêtre, et **rien n'apparaissait en console**. Classes renommées `wiz-*`, et un test interdit qu'une classe propre au cabinet porte un nom déjà pris dans la feuille partagée. Méthode qui a tranché : **mesurer dans l'application réelle** (`scrollWidth` contre `clientWidth`, `getComputedStyle`) plutôt que relire le CSS.
- **`.modal-actions` n'est stylé que dans `.modal`.** Utilisé dans un panneau, il ne produit aucune mise en page : les boutons restaient collés au texte.
- **Un test qui lit du code doit lire du CODE.** Le garde-fou « l'app cabinet ne doit rien pouvoir écrire chez un client » échouait sur un commentaire qui citait les deux appels interdits pour expliquer la règle. Les commentaires sont retirés avant de juger — et le test vérifie ensuite que le nettoyage n'a pas mangé le code.
- **Un cabinet a soixante clients, dont deux sur SkanFact.** Tant qu'on ne pouvait pas créer un dossier à la main, l'application ne montrait que ces deux-là. Un dossier « hors SkanFact » compte dans le portefeuille, ne se voit **rien réclamer**, et devient un dossier ordinaire tout seul au premier paquet (même clé : `dossierKey`, matricule d'abord). Et l'ajout se fait **en collant une liste** depuis un tableur : un par un dans un formulaire, personne ne le ferait, et l'app serait vide le jour de la démonstration.
- **`hors` n'est pas `ok`.** Un client qui n'utilise pas SkanFact n'a rien envoyé, mais il n'est pas en retard. Les confondre afficherait « tout est à jour » à un cabinet dont cinquante-huit clients sur soixante n'envoient rien.
- **Le matricule fait l'identifiant : le corriger doit corriger l'identifiant**, tant qu'aucun paquet n'est arrivé. Sinon le premier envoi du client crée un **second** dossier à côté du premier. Le défaut réel était plus bête : `matricule` ne figurait dans aucune liste de champs enregistrables. Trouvé par le parcours réel, invisible à la relecture.
- **Une échéance vaut par ce qui lui manque.** Un calendrier de dates, un comptable en a déjà un ; ce que personne ne fait pour lui, c'est nommer les clients dont il n'a pas les pièces avant la date. « À faire » ne remonte l'échéance que si des pièces manquent : une échéance proche mais complète n'a pas à crier. Aucune date ne fait foi (« À VÉRIFIER » sur la page), toutes sont réglables, et un réglage aberrant retombe sur l'usage plutôt que de faire **disparaître** l'échéance.
- **Le jeu d'exemple compte dans les échéances** (elles n'ont besoin que des mois reçus, pas des fichiers) mais **jamais dans l'export d'écritures** (qui lit de vrais paquets sur le disque). Le contraire montrerait un calendrier vide à qui découvre l'application.
- **Associer les colonnes d'un CSV par NOM, jamais par position.** Un client sous une autre version de SkanFact n'a pas les mêmes colonnes ; aligner à l'aveugle met des montants dans « Tiers » sans que rien ne plante. Et le lecteur de CSV est un vrai lecteur : un libellé de facture contient un point-virgule un jour sur dix.
- **Un paquet illisible ne fait pas échouer un export** : le fichier part avec le reste et le manque est nommé — même règle que `absents` dans le manifeste du paquet mensuel.
- **Les fautes de français se voient sur capture, pas dans les tests** : « 2 en retards », « 3 sans le moiss », « TVA de octobre ». Le helper `de()` existait depuis la 1.0.0 et n'était pas utilisé au bon endroit. Relire les captures reste indispensable.
- Le test qui compte est `test/e2e/cabinet.js` (16 étapes dans l'app réelle) ; `test/e2e/boucle-complete.js` prouve toujours la boucle entreprise → paquet → cabinet, et vérifie désormais l'export d'écritures **sur un vrai paquet**. Les deux doivent être relancés après toute modification du cabinet.

### Les tests qui ouvrent vraiment l'application

Ils vivent dans **`test/e2e/`** et se lancent par `npm run e2e:<nom>` (sous `xvfb-run -a` sur une machine sans écran) :

| Commande | Ce qu'elle prouve |
|---|---|
| `npm run e2e:entreprise` | l'app entreprise, écran par écran |
| `npm run e2e:cabinet` | l'app cabinet : verrou, assistant, portefeuille, relances, sauvegardes, suppression **et récupération**, échéances, écritures |
| `npm run e2e:boucle` | les DEUX applications à la suite : cabinet → appairage → entreprise → paquet → cabinet → écritures regroupées |
| `npm run e2e:refus` | les cinq cas tordus de l'import (fichier tronqué, mois reçu deux fois, paquet d'un autre cabinet, paquet protégé, **fichier glissé dans le paquet après coup**) |
| `npm run e2e:perte` | le scénario catastrophe : le fichier principal disparaît, l'application le dit, et tout revient — clé du cabinet comprise |
| `npm run e2e:demenagement` | **changer d'ordinateur** : deux postes à la suite, une clé USB entre les deux, et la MÊME empreinte à l'arrivée |
| `npm run e2e:couches` | **les couches et le clavier** : deux fenêtres empilées, Échap, Entrée, Cmd+K dans les deux sens |
| `npm run e2e:barre` | **la barre latérale mesurée** : Aide et Paramètres atteignables sur quatre tailles d'écran, et rien de masqué n'est perdu |
| `npm run e2e:exemple` | **charger le jeu d'exemple et en revenir** : le bandeau, la restauration, et la fausse identité qui ne survit pas à l'effacement |
| `npm run e2e:argent` | **où tombe l'argent** : deux comptes, un règlement en espèces qui va dans la caisse et pas à la banque, un paiement qu'on corrige, et le mois vide que le Cabinet ne déclare plus complet |
| `npm run e2e:captures` | photographie les 20 pages, leurs onglets et quatre gestes, en vierge et en démo, à 1440 et 1280 |
| `npm run e2e:captures-site` | **les images destinées au site** : dix écrans et onze recadrages, sur le jeu d'exemple, marqueurs du test masqués (bandeau « exemple », tampon EXEMPLE, message passager, numéro de version, pastille d'essai) — ils n'existent que parce que la machine est une installation neuve, et les montrer donnerait une image fausse du produit. Son jumeau `node test/e2e/sequence-site.js` (sans entrée npm) filme le parcours devis → facture → PDF en dix images légendées |
| `npm run e2e:parametres` | **les réglages, mesurés** : par onglet et pour les deux applications — combien de champs, combien de bulles, combien d'écrans de haut, quels panneaux, quels boutons (`dist-e2e/parametres/mesures.json`), plus une capture par onglet, en clair, en sombre et à 1280. Un instrument, pas un test : c'est lui qui dit qu'un onglet fait 0,2 écran et un autre 2,5 |
| `npm run e2e:gel` | le chien de garde : l'interface est VRAIMENT gelée, et le journal nomme la fonction coupable |
| `npm run e2e:contraste` | **aucun bouton illisible ni hors de l'écran** : contraste texte/fond et débordement de chaque bouton visible des 21 pages et de tous les éditeurs, en clair, en sombre, à 1440 et à 1280 |
| `npm run e2e:apercu` | **voir ce qu'on fabrique** : le grand aperçu, son zoom, « Ajuster », Échap, et l'interrupteur qui reste en haut |
| `npm run e2e:erreur` | **le droit à l'erreur** : une case de module se décoche ET se recoche, un module masqué revient quand on y écrit, et « Marquer déposée » se défait |
| `npm run e2e:entreprises` | **changer d'entreprise depuis le haut du menu** : deux dossiers créés et ouverts tour à tour sans passer par les Paramètres |
| `npm run e2e:listes` | **les listes déroulantes de SkanFact, dans les deux applications** (10.13.0) : un clic à la souris ouvre la liste de l'application et non celle du système, choisir filtre vraiment, Espace/↓/Entrée au clavier posent le thème sombre, chaque liste de sept pages porte le chevron en clair ET en sombre, une longue liste cherche, Entrée et Échap ne touchent que la liste dans une fenêtre, et le Cabinet ouvre la même |
| `npm run e2e:chiffres` | **les chiffres qui mentent** : la conversion des devises sur l'accueil, les cartes de Marges, l'affaire qui suit le devis, le devis déjà facturé, le doublon de facture fournisseur |
| `npm run e2e:cliquable` | **tout ce qui se lit se clique** : le filtre « Émis », la concordance carte/liste, les quatre chiffres de l'accueil et chaque ligne de « Ce qui manque » |
| `npm run e2e:repondre` | **les écrans qui ne répondent pas** : le pointage qui se défait, le curseur qui ne saute plus, le sélecteur d'année inerte, le tri qui ne triait pas, l'année figée, l'export qui suit l'onglet |
| `npm run e2e:accueil` | **l'accueil tient ses promesses** : le filtre qui ne se rearme pas, le raccourci qui vise un panneau, l'extrait sans total, le contrat suspendu qui demande, la recherche des Relances, la réponse à un devis |
| `npm run e2e:editeur` | **l'éditeur de document** : le timbre dans la devise de la pièce, l'échéance qui suit la date, la quantité effacée, la fiche du client, l'acompte en dinars, la suppression qui nomme les liens, le bouton d'une facture soldée |
| `npm run e2e:fiches` | **les fiches et les formulaires** : l'étoile des champs obligatoires et le refus qui montre, la fiche article depuis le Catalogue, le catalogue dans un achat, la ligne en immobilisation, les affaires et contrats du client |
| `npm run e2e:compta` | **la comptabilité mène aux pièces** : les contrôles de clôture armés, les douze mois de TVA cliquables, l'échéance fiscale qu'on pointe et qu'on dépointe, le mouvement qui ouvre sa facture, la carte « Reste à encaisser » |
| `npm run e2e:retenue` | **la retenue à la source** : les six écrans qui proposent un taux, « Autre taux… » branché partout, un taux libre qui recalcule vraiment, l'annulation qui ne laisse pas « __autre__ », et la fiche client qui garde un taux hors liste |
| `npm run e2e:metier` | **le métier** : quinze activités sans taux deviné, le régime fiscal posé puis conservé au redessin, les Paramètres qui grisent la TVA et annoncent la mention, le RIB non réclamé à qui encaisse sur place |
| `npm run e2e:partage` | **partager une entreprise déjà saisie** : deux applications, deux profils, un emplacement commun — on partage, le second poste rejoint sans assistant, et ce que l'un enregistre l'autre le voit |
| `npm run e2e:actions` | **une seule porte par ligne** : un menu d'actions écrites en toutes lettres et illustrées sur huit listes, un bouton qui ouvre ET referme, qui ne vole pas le clic de la ligne, la question posée avant d'agir, et « Accepter et facturer » qui ouvre le brouillon |
| `npm run e2e:aide` | **l'Aide, mesurée** : le plan (sept sections, trente-deux articles, sept couleurs), la pastille qui descend à sa section sans dupliquer le plan, le fil d'Ariane sur UNE ligne, « suivant » dans la colonne de l'article, le geste qui mène à sa page, la recherche classée et surlignée, et le sommaire d'un article long (absent d'un article court) |
| `npm run e2e:colonnes` | **les colonnes alignées** : l'en-tête de chaque colonne de chaque tableau comparé à ses valeurs, sur 19 pages et tous leurs onglets (**405 colonnes**, mesuré le 21/09/2026) |
| `npm run e2e:entetes` | **les barres d'actions mesurées** : aucun contrôle d'en-tête étiré sur toute la largeur, aucune barre empilée sur trois rangées (21 pages) |
| `npm run e2e:beta` | **le canal bêta** : la case décochée à l'installation, la question avant de cocher, le refus qui décoche vraiment, la sauvegarde « avant-beta » écrite sur le disque, et le retour en arrière sans question |
| `npm run e2e:depot` | **public ou privé** : `src/depot.js` est VRAIMENT basculé en privé, l'application ouverte, le champ jeton doit revenir — puis repartir au retour au public (le fichier est restauré quoi qu'il arrive) |
| `npm run e2e:pages` | **les pages d'un document imprimé** : 161 documents (7 types × 6 variantes × 1 à 40 lignes) rendus dans chromium et imprimés en PDF — aucune ligne perdue, aucune page qui déborde, aucun pied par-dessus le contenu, une feuille par page et chacune numérotée. **Pas besoin de `xvfb`** : il n'ouvre pas Electron |
| `npm run e2e:pont` | **le pont comptable** : le vrai worker sur SQLite et l'application en état éditeur — un secret faux refusé, le bon gardé en 0600 hors des données, deux ventes de la console tirées en deux brouillons (client retrouvé par matricule ou créé), le menu d'une licence de la console sans « Renouveler », le numéro rendu à l'émission et lu dans la base, la console éteinte dite en français |
| `npm run e2e:livres` | **les livres comptables** : chaque compte du grand livre avec son solde progressif qui finit sur le total, le sélecteur de compte, la balance dont les six totaux tombent juste, l'auxiliaire clients, la case « un sous-compte par tiers » qui donne 411001… et les fige sur les fiches, le livre-journal numéroté et son centralisateur, une OD refusée puis enregistrée, le lettrage qui ouvre sa pièce, les états financiers équilibrés, l'à-nouveau de janvier, l'état de rapprochement à écart nul, la TFP dans les barèmes |
| `npm run e2e:justificatif` | **le justificatif se joint avant toute saisie** : sélecteur de fichier remplacé dans le processus principal, une photo jointe sur un achat VIDE, enregistrée avec la pièce, retrouvée sur le disque et dans la liste (📎), un second fichier sur la pièce rangée, une pièce abandonnée qui ne laisse pas de copie, la lecture d'une photo qui redessine sans perdre la pièce, et le même geste sur un devis neuf |
| `npm run e2e:cabinet-jour1` | **le premier jour d'un comptable** : l'instrument qui MESURE ce qu'il voit, dans l'ordre où il le voit — 35 écrans photographiés du mot de passe à l'Aide, et six règles qui tombent (un bouton hors de l'écran, un bouton qui ressemble à du texte, un état vide sans geste, un champ de saisie sans bulle « i », une boîte sans étiquette, un débordement horizontal). `dist-e2e/cabinet-premier-jour/mesures.json` |
| `npm run e2e:cabinet-rendu` | **le rendu du Cabinet, mesuré** : les trois sondes de l'app entreprise (contraste et débordement des boutons, alignement des colonnes, barres d'en-tête) et la quatrième (l'écart d'ENCRE entre un bouton et ce qui le touche, 9.8.3) braquées sur TOUS ses écrans et TOUS leurs onglets, en clair et en sombre, à 1440 et à 1280 — **2 107 boutons, 883 colonnes, 1 087 écarts** (mesuré le 21/09/2026). Elles vivent en un seul exemplaire dans `harnais.js` : c'est leur absence côté Cabinet qui l'avait laissé dériver |
| `npm run e2e:entreprise-rendu` | **l'app entreprise ENTIÈRE, mesurée** : les pages lues dans `routes.x = ` (jamais une liste écrite à la main), tous leurs onglets, chaque fiche et chaque pièce par type × statut, chaque fenêtre qu'un bouton ouvre (le parcours clique les gestes et constate qu'ils produisent quelque chose — un bouton qui accepte le clic et ne fait rien tombe), en vierge puis sur l'exemple, en clair et en sombre, à 1440 et à 1280 — toutes les sondes du harnais, et des captures PLEINES (`dist-e2e/entreprise-rendu/`). **296 écrans par passe, 34 954 boutons, 9 859 champs, 10 938 colonnes, 16 436 écarts** (mesuré le 23/09/2026). `--rapide` : vierge et clair à 1440, sans captures |
| `npm run e2e:couverture` | **chaque contrôle de chaque écran dit ce qu'il fait** (10.14.0) : le parcours de `e2e:entreprise-rendu`, vierge puis sur l'exemple, et pour chaque bouton, champ ou entrée de menu visible — dans la page, la fenêtre du dessus et le menu ouvert — l'explication que la visite guidée lira (`SkanVisites.expliquer`). Un contrôle sans explication disparaîtrait de la bulle sans un mot ; il fait TOMBER le parcours, et un plancher de contrôles lus prouve que l'instrument a atteint ses écrans (`dist-e2e/couverture/manquants.json`) |
| `npm run e2e:cabinet-couverture` | **chaque contrôle de chaque écran du CABINET dit ce qu'il fait** (10.14.0) : le parcours de `e2e:cabinet-rendu` — pages, « Me guider », fiche, les quatorze écrans de comptabilité des vitrines, les fenêtres ouvertes par leur vrai bouton, un menu de ligne de chaque sorte — une passe, et pour chaque contrôle visible l'explication que la visite lira (`CabVisites.expliquer`). Un contrôle sans explication fait TOMBER le parcours, et un plancher de contrôles lus prouve que l'instrument a atteint ses écrans (`dist-e2e/cabinet-couverture/manquants.json`) |
| `npm run e2e:visites` | **chaque étape de chaque visite de SkanFact, JOUÉE** (10.14.0) : le jumeau de `e2e:cabinet-visites` pour l'app entreprise — l'assistant, l'exemple avec tous ses modules, puis chaque visite de « Me guider » jouée étape par étape (bulle dans l'écran, jamais perdue, le geste JOUÉ) ; les visites de la vraie entreprise (« Quitter l'exemple et… ») sont jouées dans une seconde passe, où une visite qui attend un préalable est comptée sans être une faute |
| `npm run e2e:cabinet-visites` | **chaque étape de chaque visite du Cabinet, JOUÉE** (10.14.0) : sur l'exemple, chaque visite de « Me guider » lancée par son vrai bouton, puis étape par étape — la bulle dans l'écran, jamais « On s'est perdus de vue », le geste JOUÉ (un clic réel sur la cible, ou la frappe de son essai ; un sélecteur du système répond « annulé » et l'étape se passe), et une visite qui reste trois tours sur la même étape est bloquée. Une visite qui ne se lance pas sur l'exemple est comptée comme une faute |
| `npm run e2e:console-rendu` | **le rendu de la CONSOLE, mesuré** : les mêmes quatre sondes braquées sur la troisième surface du produit, que pas un des quatre instruments ne regardait — les huit onglets, les deux formulaires et le panneau de la clé émise, en clair et en sombre, à 1440 et à 1280 (**735 boutons, 256 colonnes, 333 écarts**, mesuré le 22/09/2026). Le vrai worker sur une vraie base (`console-serveur.js`, partagé avec `e2e:console`), une base garnie par les VRAIES routes d'administration, et un onglet vide qui fait TOMBER le parcours. Il rend en plus deux constats que les sondes ne portent pas : la ligne de flottaison à 1280 (9.4.4) et la phrase d'explication redite (9.4.6) |
| `npm run e2e:paie` | **la paie d'un client du cabinet** : un dossier sans salarié qui DIT par où commencer et dont les deux boutons éteints disent pourquoi, un salarié déclaré sans numéro CNSS (signalé, jamais bloquant), un bulletin dont le net se recalcule pendant la frappe, l'écriture de paie en brouillard au dernier jour du mois — équilibrée, sans numéro —, le bouton qui s'éteint en nommant le « deux fois », un bulletin écrit qui ne propose plus ni « Modifier » ni « Supprimer » mais dont le calcul s'ouvre ligne par ligne, et la CNSS du trimestre qui dit ce qu'elle ne fera jamais |
| `npm run e2e:declaration` | **la déclaration du mois** : quatre cases « — » avec leur raison (jamais un zéro), un chiffre ouvert sur ses pièces, un mois DÉJÀ déclaré par le client qui montre quand même sa collectée et dont le bouton s'éteint en disant pourquoi, l'écriture passée en brouillard au dernier jour d'un mois libre, les deux pointages dans l'ordre puis défaits, et le refus de refaire une déposée |
| `npm run e2e:cloture` | **la clôture et le FLUX RETOUR, dans les DEUX applications** : les six contrôles qui nomment sans bloquer, une clôture définitive et tracée, une réouverture refusée sans motif, l'exercice suivant qui s'ouvre sans doubler ses à-nouveaux, le `.skanclose` écrit sur le disque (cloture.json, états HTML et PDF, manifeste, signature), puis le client qui l'importe — origine vérifiée, verrou posé ou son attente EXPLIQUÉE, et **le même résultat des deux côtés au millime** |
| `npm run e2e:immobilisations` | **les biens et le stock** : une acquisition venue d'un paquet qui remonte SANS fiche et propose de la créer (jamais d'office), le plan visible pendant la saisie, un dégressif sans taux refusé en nommant le taux, les dotations passées en brouillard au 31/12 et le bouton qui s'éteint, la modification d'un bien dont la dotation est écrite refusée en nommant le geste, un inventaire collé depuis un tableur et sa variation dans le bon sens |
| `npm run e2e:banque` | **la banque, de bout en bout** : trois banques aux trois formats (montant signé, Débit/Crédit séparés, en-têtes inconnus et associés à la main), un solde de fin faux refusé avec son écart, le même fichier refusé deux fois, l'automatique qui ne pose RIEN sur une ambiguïté, l'écriture manquante écrite depuis une ligne puis retrouvée « certain », le libellé retenu, le relevé retiré sans que le journal bouge |
| `npm run e2e:cabinet-licence` | **la licence du Cabinet** : trois dossiers hors SkanFact gratuits, l'exemple qui ne compte pas, cinq clients qui dépassent le quota, la validation refusée pendant que lire, importer, exporter et SAISIR restent ouverts, deux dossiers archivés qui rendent la main, la clé d'un autre cabinet refusée en nommant les deux empreintes, celle d'un client parrainé refusée aussi, et le panneau qui nomme chaque dossier compté |
| `npm run e2e:cabinet-equipe` | **le cabinet à plusieurs** : deux postes du même cabinet, deux collaborateurs — rien n'est restreint tant que personne n'est déclaré, le premier déclaré devient l'identité du poste, la piste d'audit porte son NOM, un saisisseur saisit et ne valide pas (le refus nomme qui peut), aucune lecture n'est fermée, le second poste reprend le cabinet par la copie externe, et la fusion des deux livres ne perd aucune validée sans toucher au fichier de l'autre |
| `npm run e2e:saisie` | **la grille de saisie, AU CLAVIER** : une pièce entière tapée sans souris (Entrée descend, Tab solde), le brouillard sans numéro, la validation qui referme, les deux refus sur une validée, un lot dont la pièce fausse est au MILIEU et la numérotation qui reste 1..n, l'extourne au 1er du mois suivant, la recherche par montant après réouverture de l'application, et un guide écrit puis appliqué |
| `npm run e2e:licence` | **l'éditeur et les offres, puis le client** : une première application DÉSARMÉE (`SKANFACT_CLE_EMBARQUEE` vers un chemin inexistant, développement seulement) — sans clé rien n'apparaît ; « Créer mes clés » écrit la privée dans un dossier isolé (`SKANFACT_DOSSIER_CLES`) et met le poste en état « éditeur » (ni essai ni verrou) ; « Émettre » signe une clé vérifiable, crée un BROUILLON de facture et l'historique ; la clé Indépendant collée refuse un nouveau fournisseur, pose un cadenas sur Achats et laisse les Statistiques ; la clé d'un autre matricule est refusée en nommant les deux ; « Renouveler » ; rien de ce qui traverse le pont ne contient la clé privée — PUIS une seconde application telle qu'un client l'installe (vraie clé embarquée, pas de clé privée) : essai de 30 jours, aucune trace de l'éditeur, plus de porte « Créer mes clés », et la clé signée par la clé d'essai du test REFUSÉE |

Ils ont longtemps vécu dans un dossier de travail temporaire, effacé à chaque session : il fallait les réécrire de mémoire, et ils dérivaient (une assertion restée sur une version périmée, un écran neuf jamais parcouru). **Un test qu'on doit réécrire pour s'en servir n'est pas un test.** Le harnais (`test/e2e/harnais.js`) trouve Playwright où il est, lit la version dans `package.json` au lieu de l'écrire en dur, et range les captures dans `dist-e2e/` (ignoré par Git).

Playwright n'est pas une dépendance du projet : `npm i -D playwright` avant de lancer ces tests.

## 6.8.1 et 6.8.2 — le second audit, mené sur la 6.8.0 elle-même

Skander : « creuse encore plus profond, il manque encore, je suis sûr ». Il avait raison. Audit à treize angles, chaque constat relu par un contradicteur chargé de le réfuter, deux critiques de complétude, un second tour sur les angles manqués : **131 constats confirmés, 87 retenus**, et tous ceux de la liste « avant publication » sont corrigés (6.8.1 puis 6.8.2). Le détail est dans `PLAN-CABINET.md`.

**Le premier audit avait regardé ce qui MANQUAIT ; celui-ci a regardé ce qui était FAUX.** Les seconds sont plus graves : une fonction absente se voit, une fonction qui ment ne se voit pas.

Règles apprises, à ne pas recasser :

- **Un compteur et la liste qu'il annonce se calculent avec la même fonction.** Le bandeau de la page Relances comptait les seuls mois manquants pendant que le tableau, dix pixels plus bas, listait aussi les provisoires. Une fois la question posée à voix haute, plus aucun chiffre n'est cru sur parole — et l'app n'est faite que de chiffres.
- **Une purge se fait par DATE, jamais par nom.** Les sauvegardes se purgeaient par ordre alphabétique : « avant-suppression » passait toujours en premier, donc le filet disparaissait à la seconde où il était pris, pendant que la fenêtre affichait « Une sauvegarde est prise juste avant ».
- **Une identité ne se fabrique jamais à partir de `[A-Za-z]`.** `شركة الأمان` et `مخبزة الياسمين` donnaient la même clé vide : dans un portefeuille tunisien, tous les clients en raison sociale arabe tombaient dans un seul dossier et leurs paquets s'écrasaient. `\p{L}\p{N}` avec le drapeau `u`, partout.
- **Ce qui vient de l'extérieur se valide AVANT de toucher au disque.** Un mois de la forme `../../..` servait à fabriquer un chemin de fichier. Et un fichier reçu ne s'ouvre pas avec le programme du système sous un nom choisi par l'expéditeur (« facture.pdf.command »).
- **Un compte se fait dans les DEUX sens.** « 7 pièces vérifiées, intactes » ne regardait que ce que le manifeste annonce : un fichier présent sans y figurer n'était ni compté, ni vérifié, ni signalé, et s'ouvrait d'un clic.
- **Un verdict qui vit deux secondes n'est pas un verdict** : le résultat du contrôle d'intégrité est rangé avec le paquet, et se relit un mois plus tard.
- **Un exemple qui dément la promesse du produit vaut mieux pas d'exemple.** Le jeu de démonstration datait chaque paquet du 8 du mois qu'il couvrait : « août, définitif, reçu le 08/08 ». Le premier comptable à qui on le montre demande s'il a clôturé août le 8 août.
- **Le pire défaut est celui qui punit quelqu'un qui a tout bien fait.** Changer d'ordinateur n'avait aucun chemin : le comptable avait sa clé USB et sa clé de secours, et le poste neuf lui fabriquait une clé neuve, donc une autre empreinte, donc des clients refusés. Toute donnée qu'on demande à quelqu'un de conserver doit avoir un bouton pour la reprendre.
- **Après une reprise, un chemin enregistré désigne l'autre poste.** On le recolle sur le nôtre — et s'il désigne encore le support d'origine (la clé encore branchée), on se recolle quand même sur la copie locale : on ne lit pas les pièces de ses clients sur une clé qu'on va débrancher.
- **Un travail long dans le processus principal rend l'application muette.** Vingt paquets, c'était vingt-deux secondes sans un mot ni recours. `await new Promise(res => setImmediate(res))` entre deux unités, un avancement, et un arrêt qui agit ENTRE deux unités — jamais au milieu d'une écriture.
- **Le chien de garde du cabinet a une règle de plus que celui de l'entreprise** : ici c'est le processus principal qui travaille longtemps, et **son** silence ne doit pas passer pour un gel de l'interface, sinon il recharge une page innocente.
- **Un test qui ne peut pas échouer est pire que pas de test.** Trois l'étaient : `assert.ok(x.length >= 0)` ; un test « sous tous les fuseaux » qui n'appelait que de l'arithmétique de chaînes ; et les deux `main.js` absents du seul contrôle statique, alors que ce sont les seuls fichiers qu'aucun test n'exécute. **Tout correctif de test se prouve en réintroduisant le défaut d'origine.**
- **Un e2e ne doit jamais rejouer le code qu'il teste.** Écrire `modal()` à l'intérieur d'un `evaluate()` produit un test vert qui ne teste rien : on passe par les vrais écrans et les vrais boutons.
- **Piège des remplacements de texte en masse** : un `replace(..., count=1)` a armé la mauvaise fenêtre (`accuseReception` au lieu de `writeRelance`). En mode strict, l'affectation à une variable non déclarée lève une ReferenceError — la fenêtre s'ouvrait avec **aucun bouton branché**, sans rien en console, et le détecteur d'appels inexistants ne pouvait pas le voir (ce n'est pas un appel). Vérifier l'ancrage, pas seulement le nombre d'occurrences. Un test relit désormais chaque fenêtre et exige le garde-fou de saisie en ENTIER (déclaré, armé, passé) ou pas du tout.
- **Un message d'avancement en retard peut ressusciter sa fenêtre.** Le dernier `import:progress` arrivait après la fermeture et rouvrait la fenêtre pour toujours, par-dessus le compte rendu : le bouton « Fermer » restait visible et parfaitement inerte. Un drapeau « en cours » ferme la porte.
- **electron-builder ne convertit pas une icône** : il échange `.ico` et `.icns` selon la plateforme, donc un `.png` déclaré ressort inchangé et s'installe là où un `.icns` est attendu. Rien n'échoue. Déclarer l'icône **sans extension** et fabriquer les vrais fichiers (`node scripts/icones.js`, Electron pour le dessin + app-builder pour l'assemblage ; le `.ico` porte ses sept tailles, parce que c'est à 16 px qu'on regarde une liste de fichiers).

**Méthode qui a payé, à refaire :** un workflow de spécification en lecture seule (un agent par constat, qui lit le vrai code et rend des ancrages exacts), puis application à la main avec vérification d'unicité de chaque ancrage. Deux agents ont trouvé des défauts que je venais moi-même d'introduire, et un troisième a montré qu'un constat déjà « corrigé » l'était dans un seul sens (Cmd+K par-dessus une fenêtre, mais pas une fenêtre par-dessus la palette).

## 7.0.0 — « Soit t'es pro soit tu te prends la tête »

Skander, propriétaire de l'application : « je suis débutant et j'ai essayé de bidouiller en testant
tout seul et **je me suis perdu** ». En six semaines, SkanFact est passé de « devis et factures » à
quinze modules. Chacun est arrivé avec son aide, ses bulles et ses états vides ; **aucun n'a été livré
avec une révision de l'ensemble**. Le plan complet et l'audit à douze angles sont dans `PLAN-UX.md`.

**Ce n'était pas une application mal faite, c'était une application faite pour quelqu'un qui sait
déjà.** Les défauts de ce genre ne se voient dans aucune console et aucun test de calcul ne les
attrape : il faut mesurer dans l'application réelle, et regarder les captures.

Règles apprises, à ne pas recasser :

- **Le bouton qu'on cherche quand on est perdu doit être le seul qui ne bouge jamais.** `nav` demandait
  866 px et en avait 705 à 1440×900 : « Aide » était hors champ sur **toutes** les tailles d'écran
  courantes, y compris un écran de 1050 px de haut — derrière une barre de défilement que macOS masque
  tant qu'on ne fait pas défiler. Pendant ce temps, « Exporter les données » et « Importer », dont un
  débutant n'a aucun besoin, occupaient le pied toujours visible. Paramètres et Aide y vivent
  désormais ; `npm run e2e:barre` le mesure sur quatre tailles.
- **On ne masque jamais ce que quelqu'un a saisi** — mais un filet ne doit pas devenir un piège
  (corrigé en 7.12.0, voir plus bas). Le filtrage du menu n'est acceptable que parce que la palette
  liste tout, que l'adresse fonctionne, et qu'une page « Tous les modules » existe : un test vérifie
  les trois. Sans réglage enregistré (`company.modules` absent), **tout s'affiche** : une mise à jour
  ne fait disparaître aucune page.
- **Un bouton qui ne répond pas est pire qu'un bouton absent.** `todoList` produisait 22 sortes de
  lignes, `TODO_ACTIONS` en armait 9, et `bindTodo` faisait `if (a) a.run()` : treize boutons « Voir »
  avalaient le clic en silence. On croit avoir mal cliqué, on recommence, on doute de soi, puis du
  logiciel. **Toute liste dont les lignes portent un bouton a besoin d'un test de couverture** entre ce
  que la source peut produire et ce que l'interface sait faire.
- **Un refus dit trois choses : ce qui est refusé, pourquoi, et le bouton qui débloque.** Une pièce
  émise montrait vingt champs gris et une explication de 12 px, avec la seule sortie cachée dans
  « Plus ▾ ». Et le même refus ne se dit pas de deux façons : `closedToast` (bandeau de 2,6 s, sans
  issue) doublait `closedBlock` (fenêtre avec « Aller aux clôtures ») — il a disparu.
- **Une saisie refusée se MONTRE** : on amène le champ à l'écran, on y met le curseur, on le marque
  (`refus()`). Un message seul oblige à relire tout le formulaire — et la barre d'actions est en haut
  pendant que la ligne fautive est en bas.
- **Un état vide qui explique le geste en prose n'est pas une interface, c'est une notice de montage.**
  52 sur 58 n'avaient aucun bouton : « Ouvre le Catalogue, modifie un article suivi en stock et coche… »
  demande de retenir une phrase, de naviguer ailleurs, et de retrouver la bonne case.
- **Une liste qui se dit triée par urgence doit l'être.** Le commentaire de `todoList` le promettait
  depuis la 1.10.0 ; l'ordre réel était celui dans lequel les modules ont été écrits. Un test qui fixe
  l'ordre attendu **en dur** ne l'aurait jamais attrapé : il décrivait le défaut. On teste la RÈGLE.
- **Une explication qui s'arrête là où la question devient précise est un cul-de-sac.** Les bulles
  portent un `a` vers l'article qui développe ; un en-tête de colonne peut porter une bulle (c'était le
  seul endroit où c'était impossible, et c'est là que vivent les abréviations) ; l'aide a une recherche
  qui lit le CORPS des articles, parce qu'un mot comme « assiette » n'est dans aucun des 32 titres.
- **Un glossaire qui s'arrête à une version ancienne ne ment pas, il déçoit** — et on n'y revient
  jamais. Il est passé de 17 à 59 entrées, et un test exige que chaque mot affiché dans l'interface y
  soit défini.
- **Le jeu d'exemple ne doit jamais pouvoir signer une vraie facture.** Chargé avant que la fiche
  société soit remplie — ce que fait un débutant — il donnait à l'entreprise le nom « DÉMO — Société de
  services SUARL », un matricule et un RIB inventés, et « Tout effacer » **gardait cette fiche**. Les
  données d'exemple se déclarent (`data.demo`), un bandeau permanent le dit, et l'identité empruntée
  part avec l'effacement.
- **Une liste de choses à effacer écrite à la main dérive à chaque module ajouté.** « Tout effacer »
  vidait 7 listes sur 30 : après l'exemple, il restait de faux fournisseurs, salariés, bulletins,
  immobilisations et comptes bancaires. `core.wipeData` la **déduit** de `DEFAULT_DATA`.
- **Le premier message d'un logiciel ne peut pas être un toast.** Il durait 2,6 secondes, n'était pas
  cliquable, et nommait un onglet de Paramètres que l'utilisateur ne voyait pas dans sa barre latérale.
  Ce qu'il faut dire au premier lancement vit dans « Tes premiers pas », dont l'état de chaque étape est
  **déduit des données** — une case qu'on coche soi-même ment le jour où on l'a cochée par erreur.
- **Avant d'écrire une phrase rassurante, vérifier que l'univers concerné est non vide.** « Rien à faire
  aujourd'hui : aucun retard » félicitait quelqu'un qui n'avait jamais rien facturé.
- **Piège Playwright, revu :** un panneau qui se redessine à chaque clic détache les poignées obtenues
  d'une seule requête. On reprend le premier élément encore dans l'état voulu à chaque tour. Au passage,
  le redessin faisait perdre le focus — c'est un défaut d'interface autant qu'un piège de test.
- **Piège des tests qui lisent du HTML :** un lien mis en commentaire satisfaisait `includes(...)`. Les
  commentaires se retirent avant de juger, et on vérifie que le nettoyage n'a pas mangé le code. Trouvé
  en essayant de faire échouer le test exprès — ce qui est la seule façon de savoir qu'il sert.

**L'instrument qui manquait :** `npm run e2e:captures` photographie les 20 pages, leurs onglets et
quatre gestes (éditeur, choix de client, palette, nouvelle fiche), dans deux états — **vierge** (juste
après l'assistant) et **démo** — aux deux largeurs qui comptent. CLAUDE.md décrivait cette méthode
comme si `e2e:entreprise` la fournissait : ce n'était plus vrai, et il fallait donc réécrire le
photographe à chaque audit. Les défauts « je ne sais pas par où commencer » vivent tous dans l'état
vierge, ceux de densité et de vocabulaire dans l'état démo.

## 7.0.1 — Deux erreurs de montant que l'ergonomie a fait tomber

L'audit d'ergonomie cherchait des écrans ; il a trouvé des chiffres faux. Les deux règles :

- **Un montant réglementaire porte une unité.** Le timbre fiscal est fixé *en dinars* : ajouté tel
  quel sur une facture en euros, il valait 1 € au lieu de 1 DT — 3,4 fois trop cher, sur une pièce
  officielle. Tout montant venu des réglages de la société (`stampFee` et ce qui suivra) se convertit
  dans la devise du document.
- **Un champ dont l'oubli fausse des chiffres AILLEURS est obligatoire, pas conseillé.** Le taux de
  change pouvait rester vide ; `toBase` repliait alors sur 1 et toute la comptabilité comptait
  1 EUR = 1 DT — journal des ventes, TVA à déclarer, chiffre d'affaires, tableau de bord, paquet du
  comptable. Rien à l'écran où on le saisit ne le montrait, parce que la facture, elle, était juste.
  `core.missingRate` existe pour que l'application le dise : la saisie refuse, et les pièces déjà
  enregistrées remontent en rouge dans « À faire ».

**Et la leçon sur les tests, la plus coûteuse :** l'assertion qui couvrait la facture en devise
depuis la 1.6.0 **affirmait le défaut**. Elle attendait 1 191,00 € là où le total correct est
1 190,29 €, parce qu'elle avait été écrite en recopiant ce que le code produisait. Un test écrit
ainsi ne prouve rien — il grave le bug et empêche de le corriger. Une assertion sur un montant se
calcule à la main, à partir de la règle, avant de regarder ce que le code renvoie.

## 7.1.x — Ce qui se réécrit tout seul, et ce qui ne se rejoue jamais

- **Une pièce émise garde une COPIE de ce qui a servi à la calculer.** `computeTotals` relisait
  `company.stampFee` à chaque affichage : changer le réglage du timbre réécrivait le total de toutes
  les factures déjà émises, envoyées et déclarées. Le PDF chez le client et l'écran ne disaient plus
  la même chose, et le journal des ventes suivait l'écran. La règle existait depuis la 5.0.0 pour les
  bulletins (`slip.computed`) ; elle n'avait jamais été portée aux factures. **Tout réglage de société
  qui entre dans un total doit se figer sur la pièce à l'émission**, en même temps que le numéro — et
  la migration fige l'existant, sinon il reste à la merci du prochain changement.
- **Un réglage global qui a une bonne valeur par défaut par métier doit la prendre.** Le taux de TVA
  était écrit `19` en dur à huit endroits, alors que `ACTIVITIES` sait depuis la 2.0.0 que « Santé et
  paramédical » est exonéré : le catalogue arrivait à 0 % et les lignes tapées à la main à 19 %, sur
  la même facture. Attention au `||` : `0` est une valeur légitime, le test doit être explicite.
- **Un assistant qui ne se rejoue pas est un assistant qu'on n'a qu'une fois.** `needsSetup` exigeait
  « ni société, ni document, ni client » : après le premier lancement il n'existait plus, et
  « Passer » le condamnait définitivement. Il se rejoue depuis les Paramètres, prérempli, et ne
  réécrit que ce qu'on lui redonne.
- **« Passer » ne jette pas ce qui vient d'être tapé.** Quatre écrans remplis, un clic sur « Passer »
  au cinquième, et la fiche société repartait vide — sans un mot.
- **Un état lu une fois au démarrage se périme.** « Tes premiers pas » lisait la copie externe au
  boot : choisir enfin un dossier laissait l'étape décochée jusqu'au lendemain. Tout état affiché
  ailleurs que là où il se règle doit être rafraîchi à l'endroit où il change.

## 7.2.0 et 7.3.0 — le contre-audit : ce qui est écrit, et ce qui est branché

Audit à douze angles sur l'app entreprise, chaque constat relu par un contradicteur chargé de le
**réfuter** et de ré-ancrer chaque ligne dans le code du jour. Les contradicteurs ont rejeté la
moitié des constats (déjà corrigés en 7.0.0–7.1.2, ou appuyés sur des captures qui n'existent pas)
et en ont trouvé d'autres. Le détail est dans `PLAN-UX.md`.

Règles apprises, à ne pas recasser :

- **Une fonction écrite pour l'interface et jamais appelée est invisible.** La 7.0.0 avait construit
  tout le tri des modules — `MODULES`, `moduleOn`, `navPages`, « Tous les modules », le bandeau de
  rattrapage — ET `modulesSuggeres`, la table qui relie le métier aux modules. Cette table n'avait
  **aucun appelant** : le menu faisait ses dix-sept entrées au premier jour, pour quelqu'un qui
  venait de déclarer son métier à l'écran précédent. Rien ne plante, aucun test ne tombe, et le
  commentaire au-dessus décrivait un écran qui n'existait pas — c'est ce commentaire qui a fait
  croire que le travail était fini. Quand un mécanisme est livré, le test doit porter sur l'EFFET
  (« le menu raccourcit »), jamais sur la présence de la fonction.
- **Un champ lu mais jamais écrit donne un chiffre faux tous les jours.** `cashMovements` lisait
  `p.accountId` depuis la 3.3.0 ; aucun formulaire de paiement ne l'écrivait. Un règlement en
  espèces montait sur le compte bancaire. Deux bulles d'aide et une phrase de la page Trésorerie
  décrivaient le champ manquant comme s'il existait — **une phrase d'aide qui décrit une fonction
  absente est un bug**, pas une imprécision.
- **Ce qui se saisit doit pouvoir se corriger.** Un paiement n'avait que « ✕ ». Sans bouton de
  modification, tout ce qui a été saisi avant un correctif reste faux pour toujours : livrer le
  champ sans le moyen de revenir dessus n'aurait réparé que l'avenir.
- **Avant d'écrire une phrase rassurante, vérifier que l'univers concerné est non vide** (déjà notée
  en 7.0.0, re-trouvée ailleurs) : « Rien à signaler : le dossier du mois est complet » s'affichait
  en vert sur un mois sans une seule pièce, avec neuf fichiers annoncés et l'envoi armé. La liste
  des manques ne signale que ce qui existe ; sur le néant elle est vide, et le vide passait pour la
  perfection.
- **Un assistant écrit par étapes doit écrire à chaque étape.** Fermer la fenêtre au cinquième écran
  effaçait les cinq, alors que « Passer » les conservait. Et la reprise a besoin d'un drapeau propre
  (`setupStarted`) : se fier au fait que la société est renseignée ferait réapparaître l'assistant
  chez des installations qui ne l'ont jamais commencé.
- **Un champ de l'assistant doit être au moins aussi guidé que son jumeau dans les Paramètres**,
  jamais moins. La retenue à la source était une liste fermée partout — sauf au premier endroit où
  on la rencontre.
- **Deux tests que j'ai écrits ne pouvaient pas échouer**, et je ne l'ai su qu'en essayant de les
  faire tomber : ils cherchaient une *mention* (`includes('x.lastError')`, `includes('data-edpay')`)
  là où il fallait exiger la *branche* — le mot survivait dans le message d'erreur, ou dans le
  gestionnaire. Un troisième, hérité de la 7.1.1, lisait un `localStorage` où l'application n'écrit
  rien : il affichait « ok » depuis deux versions. **Tout test de source s'ancre sur la structure, et
  se prouve en réintroduisant le défaut — sinon on ne sait pas ce qu'on a écrit.**
- **La capture montre ce que la relecture du code ne montre pas.** L'écran des modules, relu et jugé
  correct, mettait trois lignes verrouillées en tête et poussait les vraies questions — et la phrase
  qui dit qu'on ne perd rien — sous la coupe du panneau. Une photo, dix secondes.
- **Un moteur sans écran n'existe pas.** `backups:peek` et `backups:restore` étaient écrits, testés
  et branchés… uniquement sur la sortie du jeu d'exemple. Pour tout le reste, la seule issue
  proposée restait « Importer et choisis un fichier de ce dossier » : un dossier caché, un nom de
  fichier à reconnaître, et un remplacement total sans savoir ce qu'on perd. **Le jour où on a
  besoin d'une restauration est le pire jour pour apprendre un chemin.** Même famille que la
  fonction morte ci-dessus : ce qui compte n'est pas que le code existe, c'est qu'un écran l'appelle.
- **Un correctif de l'une des deux applications doit être cherché dans l'autre.** Les sauvegardes
  nommées de l'app entreprise étaient purgées par ordre alphabétique — « avant-demo »,
  « avant-effacement », « avant-import » partant toujours en premier — exactement le défaut corrigé
  dans l'app cabinet en 6.8.1, jamais porté. Elles partagent des fichiers (`style.css`) et des idées,
  pas leur code de stockage : une règle apprise d'un côté se vérifie de l'autre, à la main.
- **Une boucle e2e qui compte les écrans d'un assistant se périme à la version suivante.** On
  reconnaît chaque écran à ce qu'il contient (`#sf-mods`, `[data-act]`, `input[name=name]`), jamais
  à son numéro : un septième écran a fait passer trois tests « à côté » sans un mot.

## 7.6.0 — Le jeu d'exemple ne doit jamais toucher au vrai

Trois constats graves sur le terrain même que la 7.0.0 croyait avoir traité. Règles :

- **Une identité ne se juge pas sur un seul champ.** L'exemple ne se disait « emprunté » que si la
  raison sociale était vide — or l'assistant invite explicitement à laisser le matricule fiscal et
  le RIB vides. L'exemple les prêtait alors, et plus rien ne les reprenait : ni la sortie, ni
  « Tout effacer ». Et les trois contrôles de conformité ne regardent que la PRÉSENCE d'une valeur,
  donc l'application annonçait en vert « tes documents sont en règle » sur un matricule inventé.
  On note ce qui a été emprunté, champ par champ (`company.demoFields`), et on le rend.
- **Une phrase affichée qui n'est tenue par aucun code est un bug.** « N'envoie rien à personne
  depuis ici » était sur chaque page, et `estDemo` n'avait qu'UN appelant dans toute l'application :
  le bandeau lui-même. Six gestes sortaient sans contrôle.
- **Prévenir, pas interdire.** `demoBlock` propose « Repartir de mes données » ET « Continuer quand
  même ». Un logiciel ne peut pas empêcher une messagerie d'envoyer ; il peut nommer le danger une
  fois. Deux boutons dont aucun ne laisse passer, ce serait un refus déguisé en choix — l'exact
  travers que tout cet audit combat.
- **Un geste d'apprentissage ne se bloque pas, il se marque.** L'export PDF reste libre depuis
  l'exemple ; le document porte « EXEMPLE ». Et le tampon se décide en UN endroit : trois autres
  recopiaient la règle à la main, donc un tampon posé dans la seule fonction prévue pour ça en
  aurait manqué trois chemins sur quatre.
- **Les contrôles de saisie passent avant les grandes questions.** Poser une question de fond puis
  refuser sur un champ trop court fait répondre pour rien.
- **Un panneau asynchrone redemande son élément APRÈS l'attente.** Entre la question au processus
  principal et sa réponse, l'utilisateur a pu changer de page : la poignée obtenue avant désigne un
  élément détaché, on écrit dedans sans rien afficher, puis on cherche ses boutons dans le document
  vivant et `null.onclick` lève une exception que personne ne voit.
- **Un test peut passer pour une mauvaise raison.** L'e2e du faux matricule posait les champs par
  `evaluate` sans jamais enregistrer : la sauvegarde ne contenait donc pas la société, la sortie la
  rendait vide, et l'assertion « le nom reste » passait sur une chaîne vide. Écrit par le vrai
  formulaire, il prouve enfin ce qu'il annonce.

## 7.12.0 — Le droit à l'erreur

Skander a ouvert l'application et a trouvé trois défauts en une minute : « y'a un bouton tout
blanc », « quand je décoche un module ça disparaît pas du menu et je peux pas le recocher », « quand
on fait une action en se trompant on ne peut pas revenir en arrière, comme marquer déposé ».

Règles apprises, à ne pas recasser :

- **Une règle CSS qui repeint un fond sans toucher à la couleur du texte doit exclure les boutons
  qui portent déjà la leur.** `.banner .btn { background: #fff }` existe pour que le bouton NEUTRE
  ne paraisse pas sale sur un bandeau teinté ; elle repeignait aussi `.btn-primary`, qui garde son
  texte blanc. Résultat : « Corriger par un avoir… », la seule sortie du bandeau d'une facture
  émise, était un rectangle blanc sur blanc. Rien ne plante, rien n'apparaît en console, et relire
  le CSS ne suffit pas — c'est une question de spécificité entre deux règles séparées de 250 lignes.
  D'où `npm run e2e:contraste` : il mesure le contraste texte/fond de **chaque bouton visible** des
  21 pages, en clair et en sombre (536 boutons), et refuse tout ce qui est illisible. Seuil très bas
  (2,0) exprès : il ne juge pas l'esthétique, il attrape ce qu'on ne peut pas lire du tout.
- **Un filet qui se recalcule à chaque affichage devient un piège.** Un module qui CONTENAIT quelque
  chose se rallumait tout seul : décocher sa case la transformait en cadenas sous le doigt, sans
  rien changer au menu. **Le choix enregistré fait foi** ; ce que la règle protégeait vraiment est
  repris par `modulesRevenus(data, comptesAvant)` — un module masqué revient le jour où on y
  ENREGISTRE quelque chose, et l'application le dit. La différence entre un filet et un piège, c'est
  qu'un filet est un **événement** (les compteurs ont bougé), pas un **état** (il est plein).
- **Un réglage qui accepte un clic, ne fait rien de visible, et se retire ensuite la possibilité de
  revenir en arrière est pire que pas de réglage du tout.** C'est le symptôme à reconnaître : « je
  clique, rien ne change, et maintenant le bouton n'est plus là ».
- **La règle du droit à l'erreur n'est pas « tout confirmer »** : dix questions par jour ne se lisent
  plus, on clique « Oui » sans voir. C'est : ce qui **détruit** demande (le plan de comptes remis à
  zéro, une volée de brouillons) ; ce qui **se répare** laisse un « Annuler » sous la main
  (`toastUndo`), parce qu'au moment où on comprend son erreur, la ligne a déjà quitté l'écran d'où
  on l'a cliquée — « Marquer déposée », « Attestation reçue », suspendre/reprendre un contrat.
- **Le bandeau qui porte « Annuler » doit recevoir les clics.** `#toast` vit en
  `pointer-events: none` : sans la levée explicite, le bouton est parfaitement visible et
  parfaitement inerte (le défaut de la 5.2.2, en plus sournois puisqu'il ne concerne qu'un bouton).
  Et il dure trois fois plus longtemps qu'un message ordinaire : comprendre qu'on s'est trompé prend
  quelques secondes. Un test vérifie les deux.
- **Un test e2e écrit contre une règle décrit cette règle, pas la vérité.** `barre-laterale.js`
  affirmait « un module rempli ne doit pas offrir de case à décocher » : il gardait le piège en
  place. Quand une règle change, c'est le test qui se relit en premier.

Le test qui compte est `npm run e2e:erreur` : il refait les trois gestes dans l'application réelle
(décocher/recocher un module vide, masquer un module plein avec sa question, remplir un module masqué
pour le voir revenir, et noter une déclaration déposée puis l'annuler).

## 7.13.0 — Voir ce qu'on fabrique

Skander : « l'aperçu du document est bon mais quand on a un petit écran comme un Mac ou un Windows
on ne voit rien », et « le bouton aperçu est en bas, on ne le voit même pas des fois ».

Règles apprises, à ne pas recasser :

- **Un aperçu de 430 px pour une page de 794 n'est pas un aperçu, c'est une vignette.** À 54 % (44 %
  sur un portable) on distingue une mise en page ; on ne lit ni un prix, ni une mention légale —
  c'est-à-dire rien de ce que le client verra. Le grand aperçu (`#pv-full`, ⌘⇧A) est la vraie
  réponse ; la colonne reste ce qu'elle est, un repère pendant la saisie.
- **« Ajuster » ajuste la PAGE, pas sa largeur.** Caler sur la largeur donnait 177 % à 1440 px :
  le haut de la facture remplissait l'écran et il fallait défiler pour voir le total. Un aperçu
  « ajusté » qu'on doit faire défiler n'est pas ajusté. Mesuré, pas déduit.
- **Un interrupteur reste là où on l'a actionné.** « Masquer l'aperçu » vivait au-dessus de la
  colonne de droite : une fois masqué, il repartait à la fin du formulaire, trois écrans plus bas.
  Il est monté dans la barre d'actions, et la colonne disparaît **entièrement** au lieu de rester
  réduite à son seul bouton.
- **Un bouton coupé par le bord de la fenêtre ne se voit pas dans `scrollWidth`.** À 1280 px,
  « Émettre la facture » dépassait de 25 px et « Plus ▾ » de 125 — mais le document, lui, ne
  débordait pas : un ancêtre le rognait. **On mesure le bouton (`getBoundingClientRect().right`
  contre `clientWidth`), jamais la page.** Une première version du contrôle regardait le document :
  elle restait verte avec le défaut réintroduit.
- **Une exclusion trop large désarme un contrôle en silence.** Pour ne pas signaler les tableaux
  larges, le contrôle ignorait tout bouton sous un ancêtre en `overflow-x: auto` — or le conteneur
  de page en est un, donc il n'examinait plus rien. L'exclusion porte maintenant sur la classe
  `.scroll-x`, le marqueur explicite du projet. Vérifié dans les deux sens.
- **Un test qui pilote un bouton par son identifiant se casse quand le bouton change de rôle.**
  `#pv-hide` masquait l'aperçu, il l'agrandit désormais : trois tests le cliquaient. Quand un
  libellé change, les tests qui le nomment se relisent avant de conclure à une régression.
- Piège du compte en dur : le test « tout document passe par `stampFor` » exigeait **cinq** appels.
  Le grand aperçu en a ajouté un sixième, légitime, et le test tombait — et se « réparait » en
  changeant le chiffre, donc sans rien vérifier. Il teste maintenant la RÈGLE (chaque appel à
  `documentHtml` porte `stampText: stampFor(...)`, sauf l'aperçu d'une facture qui n'existe pas
  encore).

## 7.14.0 — L'endroit qui affiche un état est celui où on le change

Skander : « faut que ça soit le plus facile possible, par exemple choisir son entreprise dans le haut
du menu en sélectionnant dans une liste afin de basculer sans aller dans paramètres ».

Règles apprises :

- **L'endroit qui AFFICHE un état est l'endroit où on s'attend à le changer.** Le nom du dossier
  ouvert est écrit en permanence en haut à gauche ; changer de dossier demandait Paramètres →
  Sécurité et données → Dossiers. C'est la même famille que « un lien qui promet un réglage
  l'amène » (7.11.0), vue de l'autre côté.
- **Un en-tête qui devient cliquable doit le DIRE par trois signes** : un `<button>` (donc le
  clavier), un curseur de clic, un chevron, et un état au survol. Sans eux personne n'essaie — c'est
  la leçon « un bouton sans bordure ni couleur n'est pas un bouton » (Cabinet 1.0.0), appliquée à un
  élément qu'on ne soupçonne pas d'être un bouton.
- **Deux noms pour la même chose est un défaut, même quand les deux sont justes.** L'en-tête
  affichait la raison sociale (`data.company.name`) et la liste des dossiers l'étiquette du dossier
  (« Mon entreprise », posée par `main.js` à l'installation) : rien ne permettait de deviner qu'il
  s'agit du même dossier. `accorderNomDossier()` fait suivre l'étiquette — et **seulement** quand
  elle est restée celle par défaut : un nom choisi à la main ne s'écrase jamais.
- **Un menu ouvert par la barre latérale vit sous les fenêtres modales (400), jamais au-dessus** :
  une question posée par-dessus doit rester devant. Ici, couche 70. Un test le mesure.
- Piège Playwright : `waitForSelector('#x[hidden]')` attend que l'élément devienne **visible** et
  n'aboutit donc jamais. Pour attendre qu'une chose disparaisse, `waitForFunction(() => el.hidden)`.
  Le test échouait alors que le code était juste.

## 7.15.0 — Tout ce qui se lit se clique

Skander : « dans comptabilité section manquant on ne peut pas sélectionner afin de voir directement ».

Règles apprises, à ne pas recasser :

- **Un écran qui NOMME un ensemble doit pouvoir l'ouvrir.** « 3 achats sans justificatif », « Reste
  à encaisser : 6 factures » — ce sont des questions, pas des informations, tant qu'on ne peut pas
  cliquer. Même parade que les treize boutons morts de la 7.0.0 : une table (`CHECK_ACTIONS`,
  `STAT_ACTIONS`) et un **test de couverture** entre ce que la source peut produire
  (`core.packChecklist`, lu dans core.js et jamais recopié) et ce que l'interface sait ouvrir.
- **Un filtre qui regroupe plusieurs statuts est une FONCTION, jamais une chaîne comparée à un
  statut.** La liste des factures proposait « Émis » et filtrait `effectiveStatus(d) === 'émis'` :
  aucune facture ne porte ce statut, mais les **avoirs** si — le filtre rendait donc 2 avoirs au
  lieu des 27 pièces émises. **Une liste vide se remarque ; une liste fausse, non.** Le regroupement
  vit dans `core.DOC_FILTRES` / `core.docFiltre`, pur et testé.
- **Un compteur et la liste qu'il ouvre se calculent avec la même règle.** La carte « Reste à
  encaisser » comptait `envoyée|partielle|retard` et aucun filtre de la liste ne rendait ce
  compte-là. Le test relit les statuts de la carte **dans app.js** et vérifie que le filtre les garde
  tous : une liste en dur se périmerait au premier statut ajouté. (Même règle qu'en 6.8.1 pour le
  bandeau des relances du cabinet — apprise d'un côté, à vérifier de l'autre.)
- **`navigate(hash)` vers la page courante ne redessine rien.** Le routeur réagit au `hashchange` :
  viser la page où l'on est déjà n'en produit aucun, alors que l'onglet et le filtre viennent d'être
  changés juste au-dessus. Plusieurs raccourcis étaient donc inertes *depuis la page concernée* et
  fonctionnaient d'ailleurs — le pire cas à diagnostiquer. `vers()` redessine quand le hash est
  identique ; c'est le même piège que le cas « on y est déjà » de `goBack` (2.4.0).
- **Une carte cliquable le dit par trois signes** (curseur, chevron, relief au survol) et répond au
  clavier (`role="button"`, `tabindex`, Entrée/Espace). Et la bulle « i » posée dessus **explique**,
  elle ne navigue pas : le gestionnaire l'exclut explicitement.
- Piège de test : les listes sont paginées depuis la 2.2.0 — compter les `<tr>` affichés ne dit rien.
  C'est le bandeau « n sur N » qui porte la sélection entière, et c'est lui qu'un test doit lire.

## 7.16.0 — Les chiffres qui mentent

Audit page par page de l'app entreprise (six groupes d'écrans, un relecteur et un **contradicteur**
par groupe, chacun tenu de ré-ancrer chaque ligne dans le code du jour) : **66 constats retenus,
18 réfutés**. Le rapport complet est dans `dist-e2e/audit.json` — 8 graves, 47 moyens, 11 petits.
Les cinq graves corrigés ici, et ce qu'ils apprennent :

- **Un agrégat de montants porte une devise.** Les quatre cartes de l'accueil sommaient les montants
  BRUTS : sur le jeu d'exemple, « CA de l'année » annonçait 41 307 DT contre 43 892 DT réels. Le
  graphique juste en dessous, lui, passe par `toBase` depuis toujours — **deux chiffres du même écran
  ne peuvent pas raconter deux années différentes**. C'est la faute de la 7.0.1 (le timbre en euros),
  au même endroit conceptuel : tout ce qui ADDITIONNE plusieurs pièces se convertit, sans exception.
- **Une carte de total et la liste qu'elle résume se calculent sur le même ensemble.** La page Marges
  tronquait à vingt lignes puis totalisait ces vingt-là. Et le tri étant par marge décroissante, ce
  qui tombait en premier, c'étaient les lignes à marge négative. La règle des listes depuis la 2.2.0
  — « le pied et l'export portent sur la sélection entière, jamais sur la page affichée » — n'avait
  jamais été appliquée ici.
- **`limit || 20` rend le « tout » impossible à demander** : `0` y devient 20. Quand une valeur nulle
  est légitime, le test doit être explicite (`limit === 0`), exactement comme pour le taux de TVA à
  0 % en 7.1.0.
- **Ce qui se recopie d'une pièce à l'autre se recopie EN ENTIER.** `invoiceFromQuote` énumère les
  champs à la main et avait oublié `projectId` : les trois chemins de facturation fabriquaient une
  facture sans affaire, donc une fiche d'affaire à 0 facturé avec ses achats comptés — elle paraissait
  perdre de l'argent. `core.convertDoc` (« Transformer ▾ »), qui copie tout le document, la gardait :
  **deux conversions, deux comportements**, dont une seule juste.
- **Une action qui change l'état lu par sa propre condition d'affichage doit relire cet état.**
  `facturerDevis` marque le devis « accepté », donc `devisFacturable` restait vrai : le bouton coloré
  « Facturer ce devis » se represente à l'identique sur un devis DÉJÀ facturé, et un second clic
  fabrique une seconde facture complète. Le pire cas est l'acompte, qui accepte lui aussi le devis :
  le bouton principal proposait 100 % pendant que « Facture de solde » dormait dans le ▾.
- **Un doublon de bonne foi est plus dangereux qu'un doublon volontaire.** `duplicatePurchase`
  prévenait déjà — c'est le cas où l'utilisateur SAIT qu'il duplique. La ressaisie trois semaines plus
  tard, elle, ne disait rien et comptait deux fois la TVA déductible et la charge. On prévient sans
  refuser : un fournisseur peut recycler ses numéros d'une année sur l'autre.
- Piège de tests : une assertion qui recopie une ligne de gestionnaire mot pour mot
  (`$('#convert').onclick = () => facturerDevis(doc)`) tombe dès que le geste gagne une question, et
  se « répare » en recopiant la nouvelle ligne — donc sans rien prouver. On ancre sur la RÈGLE
  (le gestionnaire appelle `facturerDevis`), pas sur sa forme.
- Piège d'environnement : deux `xvfb-run` simultanés sur la même machine se disputent le serveur X et
  s'enlisent sans message. Un seul e2e à la fois, et `npm … | tail` masque toute progression
  (stdout bufferisé) — rediriger vers un fichier quand un test paraît bloqué.

## 7.17.0 — Les écrans qui ne répondent pas

Suite de l'audit page par page. Huit constats qui partagent la même signature : **l'écran accepte le
geste et n'en fait rien**. Aucune console, aucune erreur, aucun test de calcul ne peut les voir.

Règles apprises, à ne pas recasser :

- **Une action dont la trace quitte l'écran à l'instant du clic a besoin d'un retour en arrière ET
  d'un endroit où se relire.** Pointer un mouvement le faisait disparaître sur-le-champ : au moment
  où on comprend qu'on s'est trompé, il n'y a plus rien sous le doigt, et le drapeau n'était écrit
  nulle part ailleurs. `toastUndo` (7.12.0) répond à la seconde qui suit ; le panneau **« Déjà
  pointés »** répond au mois qui suit. Les deux sont nécessaires — le premier seul serait un filet
  qui ne dure que huit secondes.
- **Le porteur d'un drapeau se RECHERCHE au moment de l'annuler.** Entre le clic et l'annulation,
  `draw()` a reconstruit la liste : la référence gardée en fermeture désigne un objet qui n'est plus
  celui qu'on affiche. C'est la même famille que le piège Playwright des poignées détachées, côté
  application cette fois.
- **Un champ qui se redessine à chaque frappe est un champ dans lequel on ne peut pas écrire.** Le
  solde de tout compte réécrivait tout son bloc à chaque caractère : l'élément était détruit et
  recréé, le curseur repartait dans le vide, et « Prime de départ » était littéralement impossible à
  taper. La parade est la même que sur les bulletins (5.0.0) : on met à jour la donnée, on recalcule
  le seul élément qui en dépend (`#hf-total`), et on ne redessine qu'à l'ajout ou au retrait d'une
  ligne.
- **Un réglage visible sur un écran qui l'ignore ment.** Un sélecteur d'année sur « Salariés »,
  « Avances », « Registre » et « Contrats » : on le change, rien ne bouge. Ce sont des états du jour,
  pas d'un exercice. La liste d'exclusion vit en un seul endroit (`MG_SANS_ANNEE`, `P_SANS_ANNEE`) et
  un test confronte les deux listes au lieu de recopier des noms d'onglets.
- **`bindSort(root, redraw)` passe la colonne cliquée à son rappel : un rappel `() => draw()` la
  jette.** Six en-têtes affichaient leur « ⇅ », acceptaient le clic et ne triaient pas. Un tri qui ne
  trie pas ne se remarque pas — on croit que la liste était déjà dans cet ordre. Le test interdit
  désormais la forme `bindSort(…, () =>` dans toute la source ; c'est un contrôle de FORME assumé,
  parce que la faute est exactement une forme.
- **Une période écrite dans le code se périme au 1er janvier.** Trésorerie et Stock affichaient
  l'année en cours sans aucun moyen d'en sortir : le 3 janvier, les deux pages devenaient vides et
  l'exercice écoulé — celui qu'on vient justement consulter — était inatteignable.
- **Un export suit ce qu'on regarde, et le bouton le NOMME.** « Exporter en CSV » sur les cinq
  onglets du Stock renvoyait l'état du stock sur les cinq. Le libellé variable (« Exporter les
  mouvements ») est la moitié qui manquait : sans lui, la correction serait invisible jusqu'à ce
  qu'on ouvre le fichier.
- **Un compteur rouge qui nomme un ensemble doit l'ouvrir** (règle de la 7.15.0, re-trouvée ailleurs).
  Et la règle est passée au général : un test découpe `app.js` par route et exige que toute page qui
  pose une carte `data-stat` l'arme elle-même.
- Piège de test rencontré : une assertion sur un tri ne présume pas du sens. La colonne « Montant »
  part en décroissant (c'est ce qu'on veut voir en premier) ; le test lit la flèche affichée et
  vérifie la monotonie **dans ce sens-là**, puis qu'un second clic la renverse.
- Piège de test rencontré : on ne remplace pas `window.skanfact.saveText` depuis un `evaluate` — le
  pont `contextBridge` est figé, et le renderer a de toute façon capturé `bridge` au chargement. Ce
  qui se teste, c'est ce que l'application AFFICHE (ici le libellé du bouton), pas ce qu'on espère
  intercepter.

Le test qui compte est `npm run e2e:repondre` : neuf gestes dans l'application réelle, dont la frappe
lettre par lettre avec vérification du focus après chaque caractère.

## 7.18.0 — L'accueil tient ses promesses

Suite de l'audit page par page. Onze constats, même famille : **l'écran annonce une chose et en
montre une autre**.

Règles apprises, à ne pas recasser :

- **Un réglage composite se pose par une fonction, jamais par recopie.** Poser un filtre depuis
  « À faire » demande cinq remises à zéro (`q`, `st`, `kind`, `year`, `yearTouched`, `page`),
  recopiées à la main dans six actions — et une en oubliait une. `yearTouched` manquant, la liste
  d'arrivée se re-filtre d'elle-même sur l'année en cours et **cache précisément les pièces que la
  ligne venait d'annoncer**. `filtre(liste, st)` rend l'oubli impossible, et un test interdit
  d'écrire `listState.x.y =` dans une table d'actions.
- **Un raccourci vise un PANNEAU, pas une page.** `settingsFocus` faisait ça depuis la 7.11.0 pour
  les Paramètres ; `pageFocus` le généralise. Arriver en haut d'une page de six panneaux, c'est
  redescendre à la main en cherchant le bon titre — et on ne sait même pas si on est au bon endroit,
  d'où le marquage d'une seconde et demie.
- **Deux panneaux qui se contredisent à dix centimètres.** « Rien à faire aujourd'hui » s'affichait
  sous « Tes premiers pas 1 / 7 ». La règle de la 7.0.0 (« vérifier que l'univers concerné est non
  vide ») avait un second cas : l'univers n'est pas vide, mais un autre panneau dit déjà quoi faire.
- **Une étape ne se coche pas parce que le logiciel l'a faite.** L'assistant préremplit le catalogue
  avec les prestations du métier, prix à 0 : « Remplir ton catalogue » passait au vert sur des
  exemples. Ce que l'application a posé se marque (`fromSetup`) pour pouvoir être distingué de ce
  que l'utilisateur a décidé.
- **Un extrait n'a pas de total.** Huit pièces sur deux cents, additionnées en HT, devis et bons de
  livraison mélangés aux factures, sous une colonne « Net à payer ». Un chiffre dont on ne sait pas
  sur quoi il porte est pire qu'aucun chiffre.
- **Le pluriel se porte d'une application à l'autre.** `pl()` vivait dans l'app cabinet depuis sa
  1.0.0 (« un logiciel qui écrit "1 dossier(s)" paraît bâclé ») et l'app entreprise écrivait
  « 1 facture(s) » sur son écran d'accueil. Une règle apprise d'un côté se vérifie de l'autre.
- **Un geste qui a DEUX effets doit pouvoir défaire les deux.** « Générer maintenant » fabrique une
  facture et repousse l'échéance du contrat. `generateRecurring` ne renvoyait qu'un compteur : sans
  les identifiants des brouillons créés, il n'y avait rien à annuler. Et le bouton s'affichait sur
  un contrat suspendu, c'est-à-dire sur un contrat dont l'utilisateur vient de dire qu'il ne veut
  plus de factures.
- **Ce qui porte une devise l'affiche et se trie dedans.** Un contrat récurrent porte la sienne
  (`buildRecurringInvoice` la reporte sur chaque facture) : la colonne l'affichait en dinars, et le
  tri comparait des euros à des dinars. Même faute que la 7.16.0, un écran plus loin.
- **Un filtre s'applique à TOUT l'écran ou à rien.** La recherche des Relances ne touchait qu'un
  tableau sur quatre pendant que le bandeau annonçait « n sur N ».
- **Ce qui se saisit à la main se saisit là où on le lit.** Le statut d'un devis n'est pas déduit
  (contrairement à celui d'une facture) : il fallait pourtant ouvrir la pièce pour dire « le client
  a dit oui ».
- **Le budget de boutons d'une ligne est réel.** Ajouter deux réponses en poussait un cinquième hors
  de l'écran à 1280 px — `npm run e2e:contraste` l'a mesuré, et un bouton hors champ n'existe pas.
  Deux réponses : les deux réponses REMPLACENT « Facturer » tant que le devis n'en a pas reçu une,
  et `td.row-actions` laisse passer à la ligne au lieu de déborder.
- Piège de test : le sélecteur d'année d'une liste s'appelle `#yr`, pas `#year`. Mon e2e lisait un
  élément inexistant et passait **avec le défaut réintroduit**. Un test e2e se prouve en
  réintroduisant le défaut, exactement comme un test de source.

## 7.19.0 — L'éditeur de document

L'écran le plus utilisé de l'application. Sept endroits où il laissait faire une erreur sans rien
dire — et où l'information manquante existait déjà, dix lignes plus haut dans le même fichier.

Règles apprises, à ne pas recasser :

- **Un montant annoncé à côté d'une case est le montant que cette case AJOUTE.** L'étiquette du
  timbre montrait `company().stampFee` brut : « 1,00 € » sur une facture en euros, à trois
  centimètres d'un total qui comptait 0,29 €. Deux règles déjà écrites s'y croisaient — la
  conversion (7.0.1) et le figement à l'émission (7.1.0) — et l'étiquette n'en appliquait aucune.
  `timbreAffiche()` les applique toutes les deux, et se recalcule dans `refreshTotals`.
- **Une valeur DÉDUITE d'une autre la suit tant qu'on n'y a pas touché.** L'échéance à 30 jours
  restait sur l'ancienne date quand on corrigeait la date du document. La parade tient en une
  variable (`dueAuto`) : on ne recalcule que tant que la valeur est encore celle qu'on avait posée.
  Le contraire — recalculer toujours — écraserait une échéance négociée avec le client.
- **`Number('')` vaut 0, et un champ numérique vidé n'est pas un champ à zéro.** Effacer « 2 » pour
  taper « 12 » faisait passer la ligne, le total du document et l'aperçu à zéro entre les deux
  frappes. On ne retient rien tant que le champ n'est pas lisible (`value.trim() === ''` ou
  `validity.badInput`), et on le marque : sinon l'écran affiche une valeur que les données n'ont pas.
- **Un champ date est un COUPLE** (règle 3.0.0, re-trouvée) : `poserDateField(root, name, iso)` est
  maintenant partagé, au lieu d'être recopié dans l'éditeur d'achat.
- **Ce qu'on découvre en regardant l'aperçu se corrige depuis l'aperçu.** Une adresse client fausse
  se voit sur le document et se corrigeait aux Clients, trois écrans plus loin, en traversant le
  garde-fou des modifications non enregistrées. Tout existait — le formulaire, la pile de fenêtres,
  le redessin — il manquait un bouton. Même famille que « un moteur sans écran n'existe pas » (7.3.0).
- **Un bouton principal propose le geste SUIVANT, pas le geste passé.** « Enregistrer un paiement »
  restait le bouton coloré d'une facture intégralement payée, alors que le reste dû était calculé
  dix lignes plus haut.
- **Une suppression nomme ce qu'elle casse.** `core.piecesLiees` est pur et testé : il retrouve les
  acomptes, les soldes, les avoirs et les pièces dérivées. On ne refuse pas — la pièce appartient à
  son auteur — mais une facture qui annonce « établie à partir du devis DEV-2026-012 » avec un lien
  mort est un mystère qu'on n'élucide plus six mois après.
- **On saisit dans l'unité où l'on pense.** Un acompte se négocie en dinars, pas en pourcentage :
  il fallait diviser de tête, tomber sur 33,33 %, et découvrir le montant réel une fois le brouillon
  créé. `core.depositLines` ne change pas — c'est l'interface qui convertit, et qui **annonce le
  total obtenu avant** de fabriquer quoi que ce soit, timbre compris.
- Piège de test e2e : quitter un brouillon modifié réveille le garde-fou « modifications non
  enregistrées », qui REMET la page précédente dans la barre d'adresse pour poser sa question
  (2.4.0). Une navigation suivante n'a alors tout simplement pas lieu, et le test cherche un bouton
  sur un écran qu'il n'a jamais quitté — l'erreur arrive trente secondes plus tard, sur un sélecteur
  qui n'a rien à voir.
- Piège de test e2e : un acompte demandé à 300 DT donne 300 DT **de lignes** plus le timbre. Une
  assertion qui compare 300 au `totalTTC` décrit une règle fausse ; c'est `netToPay` qui vaut 301,
  et c'est très exactement ce que la fenêtre annonce désormais avant de créer le brouillon.

## 7.20.0 — Ce qui est obligatoire, et ce qui mène quelque part

Règles apprises, à ne pas recasser :

- **`required` dans une fenêtre modale est INERTE.** Rien ne soumet le formulaire — c'est un bouton
  qui lit les valeurs — donc le navigateur ne validera jamais rien. L'attribut était posé sur deux
  champs depuis des versions, et n'a jamais rien fait. Ce qui est obligatoire se dit à la main :
  une étoile sur le champ, et une légende.
- **Une légende se DÉDUIT, elle ne se recopie pas.** « * obligatoire » est posée par `modal()` dès
  qu'un champ de la couche porte la classe : recopiée fenêtre par fenêtre, elle manquerait à la
  première fenêtre qui gagne un champ obligatoire. Même principe que `wipeData` déduit de
  `DEFAULT_DATA` (7.0.0) et que la couverture des cartes `data-stat` (7.17.0).
- **Un refus MONTRE le champ** (règle 7.0.0, jamais appliquée aux fenêtres) : `refus()` n'était
  appelé que dans les deux éditeurs pleine page. Les cinq fenêtres les plus utilisées se
  contentaient d'un message, sur un formulaire qui peut avoir défilé.
- **Un chiffre affiché s'ouvre, même quand une autre page l'ouvre déjà.** La fiche d'un article
  n'était atteignable que depuis Stock ; le Catalogue, qui affiche pourtant sa quantité, n'y menait
  pas. Le bouton retour de la pile de navigation ramène au Catalogue quand on vient de là.
- **On ne reproche pas ce qu'on n'a pas offert.** L'éditeur d'achat signalait qu'une ligne ne
  correspond à aucun article du catalogue, sans avoir jamais proposé de le choisir dans la liste.
  Et le prix repris est le **coût d'achat**, pas le prix de vente : dans un achat, on achète.
- **Une valeur qui n'est déduite NULLE PART doit le dire là où on la saisit.** Une ligne en
  destination « immobilisation » n'entre ni en charge ni en amortissement tant que la fiche du bien
  n'existe pas. Le compteur de la barre latérale existait depuis la 3.5.0 — personne ne le regarde
  au moment de saisir un achat.
- **Un historique client s'arrête là où on le programme.** Affaires et contrats récurrents portent
  tous deux un `clientId` depuis longtemps ; la fiche ne lisait que les documents.
- **Une variable d'une autre route est une bombe silencieuse.** Écrire `locked` dans l'éditeur
  d'achat (où il n'existe pas) lève une ReferenceError **pendant la construction du gabarit** : la
  page entière reste blanche, sans une ligne dans la console de l'utilisateur. C'est l'e2e qui l'a
  attrapé, pas la relecture — le `node --check` ne voit rien, et aucun test de calcul n'exécute
  cette route.
- **Un commentaire HTML à l'intérieur d'un gabarit ne doit contenir aucun backtick** : il referme le
  `template literal` et casse le fichier. Le commentaire va dans le code, au-dessus.
- Piège de test e2e : un achat neuf commence avec **une ligne vide**. Celle qu'on ajoute depuis le
  catalogue arrive en dessous — lire `querySelector('#b-lines tr')` renvoie donc la ligne vide, et
  le test annonce un défaut qui n'existe pas.
- Piège de test : `app.indexOf('routes.client = ')` … `app.indexOf('function clientForm(')` donnait
  une tranche **vide**, parce que `clientForm` est déclaré AVANT la route dans le fichier. Un
  découpage de source se vérifie par sa longueur avant d'être jugé.

## 7.21.0 — La comptabilité qui mène aux pièces

Règles apprises, à ne pas recasser :

- **Deux écrans qui affichent la MÊME liste doivent offrir les mêmes gestes.** Les contrôles avant
  clôture et la liste « Ce qui manque » du Cabinet sortent toutes deux de `closureChecks` /
  `packChecklist` ; l'une portait ses boutons depuis la 7.15.0, l'autre était du texte. Le test
  relit les identifiants **dans core.js** (`add('brouillons', …)`) et exige une action pour chacun.
- **On pointe une OCCURRENCE, jamais une règle.** `data.fiscalFilings` retient `ruleId@date` : la
  TVA d'octobre cesse de crier, celle de novembre reste réclamée. Faire disparaître la règle aurait
  été plus simple à écrire et faux dès le mois suivant — c'est exactement ce que faisait le seul
  recours existant (désactiver la règle).
- **Un bouton qui change d'onglet doit ALLUMER l'onglet d'arrivée.** Arriver sur le bon contenu avec
  le mauvais onglet en surbrillance est pire que ne pas y aller : on croit s'être trompé. Le
  mécanisme existait sur `#cab-goclose` et n'avait jamais été repris ailleurs.
- **Une phrase qui décrit un geste doit être tenue par un chemin.** « Ils se modifient sur la pièce
  d'origine » était sous un tableau dont aucune ligne ne menait à ladite pièce (même famille que
  « une phrase d'aide qui décrit une fonction absente est un bug », 7.3.0).
- **Une donnée enregistrée et jamais affichée n'existe pas.** Le chemin du paquet était écrit dans
  `data.packs` depuis la 6.1.0 ; l'historique affichait l'empreinte — inutilisable — et pas le
  chemin. Et un paquet d'avant cette version le DIT (bouton désactivé avec son motif) au lieu
  d'offrir un bouton qui ne ferait rien.
- Piège de test, coûteux : ma tranche `drawClosures … drawFiscal` **contenait le bloc du Cabinet**,
  dont les boutons portent le même `data-check`. Le test restait vert avec le défaut réintroduit.
  Une tranche de source se prouve par ce qu'elle NE contient pas (`assert.ok(!zone.includes('cab-'))`)
  autant que par ce qu'elle contient.
- Piège de test : le gabarit et son branchement vivent à cent lignes d'écart. Chercher le
  branchement dans la tranche du gabarit échoue sur du code correct — deux assertions, deux tranches.
- Piège de test e2e : `document.querySelector('#st').value` vaut `undefined` quand l'élément
  n'existe pas encore. On attend le sélecteur avant de le lire, sinon le message accuse un filtre
  qui n'a jamais été posé.

## 7.21.1 → 7.21.3 — Windows, la plateforme que personne ne testait

Skander a voulu installer l'app sur Windows et l'envoyer à ses amis. Trois défauts se sont
enchaînés, tous invisibles depuis un Mac ou depuis Linux. **Le dépôt est passé public au passage**
(GitHub Actions y est gratuit) : la publication normale a repris et la dernière release est enfin à
jour — elle était restée à la 6.7.1 pendant quinze versions.

Règles apprises, à ne pas recasser :

- **Un fichier `.bat` en fins de ligne Unix ne marche pas.** `cmd.exe` lit un fichier batch octet
  par octet : il se désynchronise sur le premier bloc `if ... ( ... )`, tombe en erreur de syntaxe,
  et **la fenêtre se ferme sans un mot**. Symptôme à reconnaître : « j'appuie sur Entrée et ça se
  ferme tout seul ». Le fichier passe par des étiquettes (`goto :label`) plutôt que des blocs
  parenthésés, et aucun chemin ne ferme la fenêtre en silence.
- **`.gitattributes` doit couvrir TOUT le code source, pas seulement les scripts.** La 7.21.1 avait
  posé `eol=crlf` pour les `.bat` et `eol=lf` pour les `.command`/`.sh`, et s'était arrêtée là. Sur
  Windows, git convertit donc les `.js` en CRLF au checkout (`core.autocrlf`, activé par défaut par
  l'installeur Git for Windows) : le code marche toujours, mais **tout test qui relit la source
  cesse de correspondre dès qu'une expression régulière contient un `\n` littéral**. La règle
  générique `* text=auto eol=lf` va **en premier** — dans un `.gitattributes`, c'est le dernier
  motif qui gagne, et les exceptions doivent pouvoir la contredire.
- **Le mtime du système de fichiers n'est pas une date.** Sur Windows l'horloge système n'avance que
  toutes les ~15 ms : des copies successives portent le **même** mtime, et tout tri « la plus
  ancienne d'abord » devient arbitraire. Et une **copie** le réécrit — miroir externe, clé USB,
  changement d'ordinateur. Quand le nom porte déjà la date écrite par l'application
  (`AAAA-MM-JJ_HHhMMmSS`, zéro-rempli), c'est **lui** qui fait foi : son ordre alphabétique est
  l'ordre du temps, sans calcul de date, donc sans question de fuseau horaire. Le mtime ne sert
  qu'en second.
- **Un départage alphabétique ressuscite un bug qu'on croyait mort.** Le tri des sauvegardes de
  l'app entreprise départageait les mtime égaux par `localeCompare` : sur Windows, où ils sont
  presque toujours égaux, « avant-import » repassait en tête et redevenait la première effacée —
  très exactement le défaut de 6.8.1, intact, sur la seule plateforme non testée. Les filets ont
  maintenant leur **propre réserve** des deux côtés.
- **Reproduire la plateforme absente coûte moins cher qu'une publication par défaut.** Une copie du
  dépôt entièrement convertie en CRLF, et `npm test` dessus : les défauts tombent tous d'un coup,
  au lieu d'un par run de CI. Même méthode pour le mtime : on les impose **à l'envers** de l'ordre
  réel, et le test échoue alors sur toutes les machines, pas seulement sur Windows.
- **Deux `backupNow` dans la même seconde écrivent le MÊME fichier** (le nom porte l'heure à la
  seconde près) : le second écrase le premier, le compte ne bouge pas, aucune purge ne se
  déclenche — et le test passait avec le défaut réintroduit. Un test se prouve toujours en
  réintroduisant son défaut ; celui-là a failli passer entre les mailles.
- **Une panne de construction se nomme.** Le journal de l'installeur Windows ne portait qu'un mot :
  `construction : echec`. La sortie de `npm run build:win` est désormais capturée dans
  `construction.log`, versée dans le journal principal et **affichée à l'écran**. Piège : lire
  `errorlevel` **avant** les `type` qui suivent — chacun le remet à zéro, et tout échec passerait
  pour un succès.
- **Le quota GitHub Actions d'un dépôt privé se reconnaît à ceci : les jobs meurent en cinq
  secondes sans jamais démarrer.** Ce n'est pas une erreur de compilation, et les journaux sont
  vides. Sur un dépôt **public**, Actions est gratuit et sans quota.
- Dépannage gardé en mémoire, à ne refaire qu'en dernier recours : on peut construire l'installateur
  Windows **depuis Linux** sans wine, en forçant le chemin `UninstallerReader` d'electron-builder
  (réservé à macOS Catalina, mais purement JS) et en posant l'icône avec `resedit` plutôt que
  `rcedit`. Vérifier alors qu'**aucune ressource PE n'est perdue**, en particulier celle qui porte
  l'empreinte de `app.asar` — sans elle, l'application refuse de démarrer.

## 7.22.0 — Le métier décide de ce qu'on montre, le régime de ce qu'on facture

Quinze activités au lieu de six, un **régime fiscal** demandé en clair, la **note d'honoraires** des
professions libérales, et le **RIB conditionnel**. Travail prévu de longue date, livré en bloc.

Règles apprises, à ne pas recasser :

- **Ce qui décide de la TVA, c'est le RÉGIME de l'entreprise, pas son métier.** Chaque secteur
  portait une colonne `vat` : un taux deviné à partir de l'activité, faux dans les deux sens — un
  kinésithérapeute au réel facture de la TVA, un informaticien au forfaitaire n'en facture pas. La
  colonne a disparu des métiers, et un test vérifie son **ABSENCE** : c'est ce qui empêche de la
  réintroduire.
- **Une facture sans TVA et sans mention n'est pas une facture allégée, c'est une facture
  incomplète.** La mention légale prend la PLACE de la ligne de TVA, là où le lecteur la cherche.
- **Une pièce qui PORTE de la TVA la garde pour toujours**, même après un changement de régime :
  `showVat = assujettiTVA(company) || t.totalVAT > 0`. Sans la seconde moitié, changer de régime
  réécrivait des factures déjà envoyées et déclarées — le PDF chez le client ferait foi contre nous
  (règle 7.1.0, appliquée cette fois à l'affichage et pas seulement aux totaux).
- **Le régime prime sur un réglage oublié.** `defaultVat` tranche sur le régime AVANT de lire
  `defaultVatRate` : quelqu'un qui passe au forfaitaire garde parfois un « TVA des nouvelles
  lignes : 19 % » dans ses réglages, et la première ligne tapée à la main remettrait de la TVA sur
  une facture qui n'a pas le droit d'en porter.
- **Une note d'honoraires n'est pas un type de pièce en plus.** Même préfixe `FAC-`, même
  numérotation, même verrouillage, même valeur comptable : seul le TITRE change. Et il se **déduit**
  du métier à l'affichage plutôt que d'être figé sur la pièce — ce n'est pas un montant, et changer
  de métier ne doit pas laisser derrière soi des pièces à deux noms.
- **On ne réclame pas ce dont l'utilisateur n'a pas besoin.** Le RIB n'est un manque que si on attend
  un virement. Un avertissement qu'on ne peut pas satisfaire, on cesse de le lire — et on cesse de
  lire les autres avec. Les DEUX écrans qui le disaient (`companyGaps` et `issueWarnings`) suivent la
  même fonction : deux écrans qui disent la même chose ne peuvent pas se contredire (règle 6.8.1).
- **Un métier absent de `MODULES_PAR_ACTIVITE` n'allume que le minimum.** Ajouter neuf métiers sans
  leur ligne aurait fait découvrir Achats et Stock par hasard, six mois plus tard, à un garagiste.
- **Une fonction d'un AUTRE module est une bombe silencieuse.** `C.pl(...)` — alors que `pl` est
  locale à app.js — lève une TypeError pendant la construction du gabarit : l'écran reste blanc,
  rien en console, et `node --check` ne voit rien. Seul l'e2e l'a attrapé. Le garde-fou existait
  dans l'app cabinet depuis la 6.8.0 et n'avait jamais été porté : un test exige désormais que
  **chaque `C.<nom>` d'app.js existe dans les exports de core.js**, et il se prouve en réintroduisant
  la faute.
- Piège de test que j'ai failli laisser passer : `assert.strictEqual(cols(forf), … ? cols(forf) : 0)`
  compare une valeur à elle-même. Vert pour toujours. **Un test qui ne peut pas échouer est pire que
  pas de test** — et celui-là était dans le lot que je venais d'écrire.
- Piège de test : vérifier le taux sous UN seul régime laisserait l'ancienne règle intacte. Le test
  prend le **même métier** sous les deux régimes — c'est la seule façon de prouver que le métier ne
  décide plus.

## 7.23.0 — Ce qui se mesure, et l'Aide qu'on peut parcourir

Quatre signalements de Skander sur captures d'écran, et une refonte. Règles apprises :

- **Un `<th class="r">` correct ne garantit pas un en-tête aligné à droite.** `table.list th` (une
  classe, deux éléments) l'emporte sur `th.r` (une classe, un élément) : l'alignement n'était jamais
  appliqué, sur **139 colonnes de 338**, dans les deux applications. Relire le HTML ne pouvait pas le
  montrer. `npm run e2e:colonnes` **mesure** l'alignement calculé de chaque en-tête contre celui de
  ses cellules — c'est la méthode de la 6.8.0 (« mesurer dans l'application réelle »), appliquée aux
  tableaux.
- **`flex-wrap: wrap` dans une cellule en `width: 1%` empile tout.** La largeur minimale d'un
  conteneur qui peut passer à la ligne, c'est celle d'un seul élément : les cinq boutons d'action se
  sont donc empilés verticalement. Corriger un débordement par le passage à la ligne fabrique un
  empilement ; le vrai remède est **un bouton de moins**. Celui qui part est le seul sans libellé.
- **Un `if (x)` muet autour d'un geste transforme une erreur en bouton mort.** Et l'erreur, ici,
  n'était même pas là : `serialForm` appelait `clientItems`, déclarée LOCALEMENT dans deux autres
  formulaires. ReferenceError pendant la construction du gabarit, fenêtre qui ne s'ouvre pas, console
  vide. Le détecteur d'appels inexistants existait depuis la 6.8.0 **pour le cabinet seulement** —
  l'application principale, la plus grosse, n'y était pas. Une règle apprise d'un côté se vérifie de
  l'autre (règle 7.3.0), et celle-ci ne l'avait jamais été.
- **Mon propre test sautait une page en silence.** `colonnes.js` visait `#stk-tabs` là où
  l'application écrit `#st-tabs`, avec un `.catch(() => {})` par-dessus : il annonçait « 338 colonnes
  mesurées » sans avoir ouvert un seul onglet du Stock. Un sélecteur annoncé et introuvable doit faire
  **tomber** le test. Après correction : 392 colonnes.
- **Une aide n'est pas un livre.** Trente-deux titres dans une liste plate et 99 Ko de prose : on
  choisit un TERRITOIRE avant de choisir un titre, et chaque article finit par un **geste** — six
  liens vers l'application dans tout le corpus, c'était un cul-de-sac à chaque fois.
- **Une table en double diverge toujours.** `PAGE_AIDE` vivait dans app.js et `PAR_PAGE` dans
  guide.js. Elle vit désormais à côté des articles qu'elle désigne, et le test lit l'OBJET au lieu
  d'une expression régulière sur du texte.
- **Un état de recherche qui survit à la navigation peut cacher la page d'arrivée.** Arriver sur un
  article alors qu'une recherche traînait relançait le filtrage au dessin : le conteneur qui PORTE
  l'article repartait caché, et la page s'ouvrait blanche. Demander une chose précise efface le
  filtre. Trouvé par l'e2e, invisible à la lecture.
- **Un `select` dans un conteneur flex réclame toute la ligne.** La règle générale des champs
  (`select { width: 100% }`) s'applique aussi dans une barre d'actions : les trois sélecteurs de la
  page Statistiques s'empilaient sur trois rangées, étirés d'un bord à l'autre. `.filters` avait son
  `width: auto` depuis longtemps ; `.page-head .actions` ne l'avait jamais eu. Même famille que le
  `th.r` des colonnes : le HTML est juste, c'est la feuille de style qui décide, et ça ne se voit
  qu'en mesurant. `npm run e2e:entetes` mesure la largeur de chaque contrôle et la hauteur de chaque
  barre — et il a trouvé une page de plus que ma lecture du code (`#/garanties`).

## 7.25.0 — Le canal bêta (garder la stable pendant qu'on travaille)

Demandé par Skander : « garder la main qui est stable et bosser sur la beta, et quand je confirme la
beta alors on la publie, comme les grands logiciels ». Deux canaux, **une seule application**, un
seul dépôt.

**Le fonctionnement, de bout en bout.** `main` reste la branche stable, `beta` est la branche de
travail. Une version d'essai se numérote `7.26.0-beta.1` (`npm run release preminor` puis
`prerelease`), et **c'est le numéro qui décide de tout le reste** : le workflow Release marque la
release « préversion » sur GitHub (donc `/releases/latest` pointe toujours sur la dernière stable),
electron-builder écrit `beta.yml` / `beta-mac.yml` au lieu de `latest.yml` ~~tout seul~~ — **faux
jusqu'à la 9.8.8 : il lit `publishConfig.channel || 'latest'` et ne déduit rien du numéro ; le
workflow lui NOMME le canal depuis le 21/09/2026** —, le relais Cloudflare les laisse passer
(`CANAUX.app.yml`), et `core.canalDe(version)` en déduit le canal côté application.
Quand la bêta est confirmée, `npm run release minor` la transforme en `7.26.0` stable et `main`
avance. Publier se fait depuis l'onglet Actions → Release → Run workflow, en choisissant la branche.

Règles apprises, à ne pas recasser :

- **Une seule source de vérité, et c'est le numéro de version.** Un drapeau posé à la construction,
  une case au lancement du workflow, un réglage du dépôt : tout ça s'oublie et se désaccorde. Un
  numéro de version, non — il est écrit dans le paquet, dans la release, dans l'écran des mises à
  jour et dans le nom du fichier téléchargé. ~~Les deux moitiés du système (electron-builder et
  `canalDe`) lisent la même chose, il n'y a donc aucun moyen de les faire diverger.~~ **Faux, et
  ça a coûté une publication (9.8.8-beta.1)** : electron-builder ne lit PAS le numéro pour nommer
  le canal. Le workflow le lui nomme, déduit du même drapeau que le type de release — c'est ça qui
  rend les deux moitiés indivergeables, pas une propriété du module (§ 9.8.8).
- **`allowPrerelease` est indispensable, et il ne se devine pas.** Sans lui, electron-updater
  interroge `/releases/latest`, qui **ignore les préversions par construction** : la bêta serait
  publiée et jamais proposée à personne, sans une erreur nulle part.
- **`u.channel = …` remet `allowDowngrade` à `true`** (règle 6.7.3, re-rencontrée) : il se repose
  APRÈS, toujours. La seule exception voulue : quelqu'un qui **décoche** la case tourne sur une
  version plus récente que la dernière stable ; lui interdire de reculer, c'est l'enfermer dans la
  bêta qu'il vient de quitter. D'où `allowDowngrade = !beta && canalDe(version) !== 'latest'`.
- **Le test de cette règle lisait un COMMENTAIRE.** Le commentaire qui explique le piège nomme les
  deux lignes côte à côte et satisfaisait l'assertion à lui seul — même faute qu'en 6.8.0 sur le
  garde-fou du cabinet. On retire les commentaires avant de juger, et on vérifie que le nettoyage
  n'a pas mangé le code. Trouvé en réintroduisant le défaut, jamais autrement.
- **Une bêta s'installe par-dessus la vraie comptabilité.** On prévient, on prend la sauvegarde
  `avant-beta` **avant** d'armer le canal (au moment de l'installation, il sera trop tard pour y
  penser), on n'interdit pas. Et le repère « bêta » du menu suit la **version installée**, jamais le
  canal choisi : ce qui compte, c'est ce qui tourne.
- ~~**Une bêta d'entreprise ne construit plus l'app cabinet du tout** : elle n'a aucune case à
  décocher et personne ne lui a rien demandé. Publier une préversion sur `cabinet.yml` proposerait
  une version d'essai à tous les comptables d'un coup.~~ **Vrai jusqu'à la 9.1.0, faux après, et
  corrigé en 9.8.4** : le Cabinet a reçu son canal `cabinet-beta` ET sa case en 9.1.0, donc une
  préversion écrit `cabinet-beta.yml` et ne touche pas `cabinet.yml`. Une bêta construit désormais
  **les deux** applications. Voir § 9.8.4.
- **Le relais ne regarde plus 5 releases mais 20** : plusieurs préversions peuvent s'intercaler
  entre deux stables, et une installation restée sur le canal normal ne trouverait plus `latest.yml`
  dans la fenêtre.
- **Une bêta qui n'existe pas encore n'est pas une panne**, c'est le cas normal entre deux essais :
  le 404 du canal bêta a sa propre phrase, sinon l'écran répond « aucune version trouvée » en rouge
  et fait croire que les mises à jour sont cassées.

Le test qui compte est `npm run e2e:beta` : la case décochée à l'installation, la question, le refus
qui décoche vraiment, la sauvegarde prise sur le disque, et le retour en arrière sans question.

**Et un défaut de la 7.22.0 attrapé par un e2e que je n'avais pas relancé après l'avoir écrit :** en
remplaçant le taux de TVA porté par le métier par un régime fiscal, on a perdu ce que le métier
savait depuis la 2.0.0 — « Santé et paramédical » est exonéré. L'application proposait 19 % à un
kinésithérapeute qui venait de cliquer sur son propre métier. `core.regimeSuggere(activité)` le
**propose** de nouveau, `a.regimeTouche` empêche d'écraser un choix fait à la main (même motif que
`modulesTouche` et que la durée proposée par la famille d'un bien). **Retirer un mécanisme
n'autorise pas à perdre ce qu'il savait** — et un e2e ne sert que si on le relance.

## 7.26.0 — Aucun message brut, et un seul interrupteur public/privé

Skander, sur capture : « je n'aime pas que ça affiche cette ligne, ça ne fait pas pro un message
d'erreur — `Cannot find latest-mac.yml in the release https://github.com/…` ». Et, séparément :
« le dépôt redeviendra privé, est-ce que t'as réglé la ligne avec le token ? »

Les deux tenaient au même endroit du code, et la seconde question a révélé que la réponse était
**non** : la 7.24.0 avait supprimé le champ jeton parce que le dépôt venait de passer public.

Règles apprises, à ne pas recasser :

- **On ne montre jamais à l'utilisateur une phrase qu'on n'a pas écrite.** `friendlyError` finissait
  par `return m.split('\n')[0].slice(0, 200)` : tout cas non prévu recopiait l'anglais
  d'electron-updater, avec son URL. `updateProblem(err)` rend `{ message, detail, soft }` — une
  phrase en français pour chaque cas, le texte d'origine rangé dans `detail` (replié sous « Détails
  techniques », plus un bouton qui ouvre le journal : c'est lui qui sert à dépanner, règle 6.7.2),
  et `soft` pour ce qui **n'est pas une panne**. Du rouge sur une situation normale apprend à
  ignorer le rouge.
- **Le code d'une erreur vit sur l'erreur, pas dans son message.** `ERR_UPDATER_CHANNEL_FILE_NOT_FOUND`
  ne figure nulle part dans « Cannot find latest-mac.yml in the release … ». Le chercher dans le
  texte, c'est ne jamais le trouver — c'est ce que faisait la branche bêta écrite en 7.25.0, qui
  n'aurait donc jamais été atteinte. On lit `err.code` **et** `err.message`.
- **Une release existe AVANT ses fichiers.** GitHub crée le tag et la page, puis les installateurs
  montent pendant deux à quatre minutes — et c'est exactement le moment où l'on va voir si la
  nouvelle version est là. Ce n'est pas une panne, ça a sa phrase et son gris. (Vérifié sur les
  horodatages de la 7.25.0 : page à 08:22:24, `latest-mac.yml` à 08:24:38, message vu à 08:22.)
- **Un test de source qui interdit une forme doit lire l'ARGUMENT, pas la ligne.** Mon assertion
  `!/return\s+(m|brut)\b/` laissait passer `return dit(brut.split(…))` — vert avec le défaut
  réintroduit. Elle scanne maintenant l'argument de chaque `return dit(…)`, parenthèses équilibrées.
- **Un drapeau qui vit en double diverge, toujours.** `GITHUB.private` existait dans les DEUX
  `main.js`. L'app entreprise disait « public » depuis la 7.24.0 pendant que celle du comptable
  affichait encore « SkanFact est distribué depuis un dépôt privé : un jeton de lecture est
  nécessaire » — et le faisait chercher un jeton que personne n'avait à lui donner. La vérité vit
  dans **`src/depot.js`**, que les deux applications lisent (et qui doit figurer dans les `files` de
  `build/cabinet.config.js`, sinon l'app cabinet ne démarre plus une fois construite).
- **Retirer un mécanisme devenu inutile, c'est désarmer l'interrupteur qui le rallume.** La 7.24.0
  avait supprimé le champ jeton « puisque le dépôt est public » : basculer `private` à `true`
  n'aurait plus rien réarmé, et l'écran aurait écrit « colle ton jeton ci-dessous » au-dessus de
  rien du tout. Ce qui dépend d'un drapeau se pose **sous** ce drapeau, jamais en dur ni supprimé.
- **Un test écrit contre l'état du jour décrit cet état, pas la règle.** Celui de la 7.24.0 exigeait
  l'ABSENCE du champ. Il a fallu le réécrire pour livrer la bonne version — même famille que
  `barre-laterale.js` en 7.12.0. On teste l'interrupteur, pas la position dans laquelle il est.
- Sur le relais : il fonctionne **à l'identique** sur un dépôt privé — c'est justement sa raison
  d'être. Une seule chose à vérifier le jour de la bascule, et c'est noté dans `worker/README.md` :
  que le `GITHUB_TOKEN` du worker ait bien **Contents: Read-only** sur le dépôt. Sur un dépôt
  public, un jeton sans droits suffit à lire les releases : la panne ne se verrait qu'au moment de
  la bascule, et couperait les mises à jour de tout le monde d'un coup.

Le test qui compte est `npm run e2e:depot` : il **bascule vraiment** `src/depot.js` en privé, ouvre
l'application, vérifie que le champ est revenu, repasse en public et vérifie qu'il repart — le
fichier étant remis dans son état d'origine quoi qu'il arrive (`finally`).

### 7.26.1 — le repli n'est pas un réglage, c'est un réflexe

L'app du comptable affichait, sur le même écran et à dix lignes d'écart : « Aucune version trouvée :
le jeton d'accès manque ou n'a pas accès au dépôt » **et** « Les mises à jour arrivent toutes seules :
rien à configurer ». Deux phrases qui ne peuvent pas être vraies ensemble.

- **Un chemin de secours ne sert que s'il se déclenche tout seul** — règle de la 6.7.2, re-trouvée
  une couche plus bas. Le repli GitHub existait depuis la 6.7.0 mais ne se déclenchait **que si le
  relais était mal réglé** (`new URL` qui lève), jamais s'il *répondait mal* : le seul cas qui
  arrive vraiment. `checkForUpdates` rebranche maintenant GitHub et **réessaie immédiatement**
  (`relayDown` retient l'échec pour la session, `configureFeed` le respecte).
- **On ne crie pas avant d'avoir essayé le second chemin.** L'événement `error` du premier échec
  affichait un rouge que le repli dément une seconde plus tard : `silencerErreur` le retient tant
  qu'un second essai reste possible — et se relève sur **chaque** sortie, sinon l'écran devient
  muet pour de bon.
- **Une fermeture, c'est un mécanisme qui n'existe qu'au moment où on ne peut pas encore s'en
  servir.** `feedGithub` vivait à l'intérieur de `getUpdater()` dans l'app cabinet : impossible de
  rebrancher le flux après coup. Sorti au niveau du module, comme dans l'app entreprise.
- **Ce que `check` RENVOIE et ce qu'un ÉVÉNEMENT envoie doivent porter la même chose.** `detail` et
  `soft` ne voyageaient qu'avec les événements ; les erreurs renvoyées après un clic sur
  « Vérifier » — c'est-à-dire celles qu'on lit vraiment — les perdaient en route, et « Détails
  techniques » ne s'affichait jamais dans le cas le plus courant.
- Et l'écran **relit l'état de l'application** après une vérification : le repli a pu débrancher le
  relais entre-temps, et sans cette relecture la page continue d'annoncer « rien à configurer ».

## 7.27.0 — L'Aide : ce que la capture montre et que la relecture ne montre pas

Skander : « le ui n'est pas ouf ni le ux donc il faut l'améliorer et le layout est bizarre, fais-moi
quelque chose d'intuitif, coloré aussi ». Il avait raison sur les trois points, et deux des défauts
étaient là depuis la 7.23.0 sans que rien ne les signale.

Règles apprises, à ne pas recasser :

- **Une règle posée sur un ÉLÉMENT bat une classe qui ne déclare pas la même propriété.**
  `nav { display: flex; flex-direction: column }` range la barre latérale ; `.help-fil` déclarait
  `display: flex` et rien d'autre. Le fil d'Ariane — un `<nav>` — s'est donc affiché **à la
  verticale, centré**, sur cinq lignes et cent pixels, en tête de chaque article pendant quatre
  versions. Rien en console, rien dans les tests de calcul, et la relecture du HTML ne peut pas le
  voir : c'est la même famille que le `th.r` des colonnes (7.23.0) et que `.setup-card` du cabinet
  (6.8.0). Le fil est un `<div>`, il déclare `flex-direction: row` noir sur blanc, et
  `npm run e2e:aide` **mesure** le nombre de lignes qu'il occupe.
- **Deux colonnes de largeurs différentes ne se pilotent pas depuis la page.** `.help-suite`
  (« article suivant ») était en `justify-content: space-between` sur toute la largeur du contenu,
  pendant que l'article, lui, était borné à 780 px : le bouton finissait 250 px à droite de la
  colonne qu'il prolonge. Ce qui appartient à une colonne vit DANS la colonne.
- **`scrollIntoView` posé pendant le dessin d'une route est effacé une ligne plus loin.** `render()`
  remet `#view.scrollTop` à zéro APRÈS avoir appelé la route. La pastille s'allumait, la section se
  marquait en couleur, et la page ne bougeait pas d'un pixel — un bouton qui accepte le clic et n'en
  fait rien (défaut de la 7.0.0). Le mécanisme qui marche existait déjà : `pageFocus` (7.18.0), qui
  s'exécute après la remise à zéro et apporte le repère coloré avec lui. **Avant d'écrire un
  deuxième mécanisme, chercher pourquoi le premier n'a pas servi.**
- **Un plan montre le territoire ; il ne le cache pas derrière un clic qui ne promet qu'un nombre.**
  Sept cartes grises annonçant « 7 ARTICLES » obligent à cliquer à l'aveugle pour savoir ce qu'il y
  a dedans — et la 7.23.0 redessinait en plus la liste ENTIÈRE des sept thèmes sous le thème ouvert,
  celui-ci compris. Les trente-deux articles sont désormais visibles d'un coup, rangés par domaine.
- **La couleur d'un thème vit dans la feuille de style, jamais dans le JavaScript** : une couleur
  écrite dans `guide.js` ne sait pas se retourner en mode sombre. Les deux tables (thèmes dans
  guide.js, couleurs dans style.css) sont confrontées par un test — deux tables séparées divergent
  toujours, et un huitième thème naîtrait gris au milieu de sept colorés.
- **Une recherche qui rend la moitié du corpus doit CLASSER.** « tva » rendait dix-sept articles sur
  trente-deux dans l'ordre où ils sont écrits dans le fichier : dix-sept titres non classés ne valent
  pas mieux que les trente-deux qu'ils remplacent. Titre, puis sous-titre, puis corps — et chaque
  résultat montre l'extrait où le mot se trouve, sinon il n'explique pas pourquoi il est là.
- **Surligner, c'est découper puis échapper morceau par morceau.** Échapper après avoir posé les
  `<mark>` les mangerait ; ne pas échapper laisserait passer le corps d'un article en HTML. Un test
  exige que chaque morceau recollé passe par `h(`.
- **La règle générale des champs porte quatre `:not(…)` : aucune classe ne la bat.** `.help-search
  input { padding-left: 41px }` n'a jamais été appliqué, et la loupe se posait SUR la première
  lettre du texte. C'est l'identifiant (`#aide-q`) qui tranche. Encore une fois : le HTML est juste,
  c'est la feuille de style qui décide, et **ça ne se voit qu'en regardant**.
- Piège de test rencontré, et qui a failli passer : `if (apres.scroll <= avant.scroll)` alors que
  `avant` était un NOMBRE. `0 <= undefined` vaut `false` : l'assertion ne pouvait pas échouer. Trouvé
  en réintroduisant le défaut qu'elle est censée attraper — jamais autrement.
- Piège de test rencontré : rejouer l'ancien défaut ne suffit pas quand le correctif est double. Le
  fil redevenu `<nav>` ne faisait plus tomber l'e2e, parce que `flex-direction: row` le protège
  désormais ; il faut retirer LES DEUX pour retrouver le défaut d'origine — et c'est ce qui prouve
  que la ceinture ET les bretelles servent.

Le test qui compte est `npm run e2e:aide` : sept étapes qui **mesurent** le plan (sept sections,
trente-deux articles, sept couleurs distinctes), la descente vers une section, la hauteur du fil
d'Ariane, l'alignement des boutons suivant/précédent sur la colonne de l'article, le classement de
la recherche, et le sommaire d'un article long — qui ne doit pas exister sur un article court.

## 7.28.0 — Le partage qui partage vraiment, et une seule porte par ligne

Trois demandes du propriétaire, et deux d'entre elles ont mis au jour des mécanismes qui ne
servaient à personne.

Règles apprises, à ne pas recasser :

- **Une fonctionnalité qui n'a de sens qu'au premier jour n'a de sens pour personne.** « Dossier
  partagé à deux… » demandait un NOM D'ENTREPRISE et fabriquait un dossier VIDE : quelqu'un qui
  avait déjà saisi sa société, ses clients et ses factures — c'est-à-dire tout le monde, puisque
  c'est ce qu'on fait avant de vouloir partager — tombait sur l'assistant de première utilisation.
  Et il n'existait aucun moyen de REJOINDRE un dossier déjà posé. Le partage à deux, livré en
  3.2.0, était donc inutilisable depuis trois ans. Même famille que « un moteur sans écran n'existe
  pas » (7.3.0), vue de l'autre côté : ici l'écran existait, c'est le geste qui manquait.
- **`currentDossier()` relit la configuration sur le DISQUE et rend un autre objet.** Modifier ce
  qu'il renvoie puis écrire `cfg` réécrit l'ancienne valeur : les fichiers étaient copiés,
  l'application se rechargeait… sur l'ancien emplacement, et rien n'arrivait jamais de l'autre
  poste. Toute fonction qui rend un élément d'une structure relue doit être retrouvée DANS la
  structure qu'on s'apprête à écrire. Trouvé par `npm run e2e:partage`, qui fait vraiment
  l'aller-retour entre deux applications et deux profils.
- **On copie, on ne déplace pas.** L'ancien emplacement reste intact et sert de filet — même règle
  que la reprise de l'ancien format en 3.2.0 — et la bascule n'a lieu qu'une fois la copie
  CONSTATÉE (le fichier de données est là, et de la même taille). Un dossier iCloud plein ou un
  disque réseau qui se déconnecte en cours de route ouvrirait sinon un dossier à moitié écrit.
- **Un garde-fou global qui énumère les surfaces cliquables se périme au prochain overlay.** Le
  `mousedown` global de l'application refermait tout overlay ouvert sauf `.combo` et `.datefield`.
  Le menu d'actions, écrit ce jour-là, n'était ni l'un ni l'autre : ses entrées acceptaient le clic,
  le menu se refermait — donc le bouton quittait le document — et le `click` n'avait plus personne à
  qui parler. Aucune erreur, aucune console, et le menu qui se ferme donne l'impression que quelque
  chose s'est passé. C'est le défaut de la 7.0.0 en plus sournois. La liste vit maintenant dans
  `SURFACES_OVERLAY`, à un seul endroit, et un test la confronte aux overlays existants.
- **Le budget de boutons d'une ligne se règle en supprimant la rangée, pas en la serrant.** Cinq
  boutons par ligne (7.18.0, 7.23.0) tombaient dans des pictogrammes muets — « ⧉ », « ⏱ » — dès
  qu'ils étaient trop nombreux. Un menu occupe la largeur d'un bouton quoi qu'il contienne : chaque
  action y porte une PHRASE et son explication. Un test interdit les libellés de moins de six
  caractères, et exige qu'une ligne sans action perde son bouton (un menu vide est encore un bouton
  mort).
- **Un geste qui change l'état d'une pièce commerciale demande, annonce, et propose la suite.** Les
  trois vont ensemble, et dans UNE seule fenêtre : deux boîtes à la file se cliquent sans être lues.
  « Le client a accepté » rappelle le devis, le client et le montant, puis offre « Accepter et
  facturer » — parce que ce qui vient après un devis accepté, c'est la facture. Le « Annuler » de
  huit secondes (7.12.0) reste par-dessus : la question protège du geste, le retour protège de la
  décision.
- **Un menu ancré sur une ligne hors écran est inatteignable — et c'est voulu.** Il se ferme au
  moindre défilement, comme chez un vrai utilisateur. Un e2e qui ouvre un menu par `evaluate` puis
  demande à Playwright d'y cliquer fait défiler la page pour l'atteindre, referme le menu, et
  accuse l'application. On repère la ligne par ce qu'elle AFFICHE (son badge de statut), puis on
  clique pour de vrai.
- **Un test e2e qu'on ne relance pas se périme sans rien dire.** `e2e:entreprise` visait encore
  `.help-nav`, la colonne de gauche de l'aide supprimée par la refonte de la 7.23.0 : le test était
  cassé depuis, et personne ne s'en était aperçu — il n'avait pas été relancé. Corollaire de la
  règle 7.25.0 (« un e2e ne sert que si on le relance ») : **après une refonte, relancer TOUS les
  parcours, pas seulement celui qu'on vient d'écrire.**
- **Un drapeau envoyé au processus principal se remet à jour quand l'état DISPARAÎT, pas seulement
  quand il se pose.** `leaveOk` et le routeur remettaient `guard` à `null` directement, sans
  repasser par `clearGuard()` : `dirtyReported` restait donc à `true` pour le reste de la session.
  Conséquence, invisible depuis trois versions : dès qu'on avait modifié quoi que ce soit, fermer la
  fenêtre posait pour toujours la question « modifications non enregistrées », sur des données
  pourtant enregistrées. Une application qui annonce une perte qui n'existe pas apprend à cliquer
  sans lire. C'est `e2e:chiffres` qui l'a désigné — il restait bloqué pour toujours à la fermeture.
- **Un test e2e qui reste bloqué est pire qu'un test qui échoue.** Il ne dit rien, on ne le relance
  plus, et il cesse d'exister. Toute fermeture d'application dans un e2e passe désormais sous
  `Promise.race` avec un délai et une phrase qui nomme la cause — même principe que les commandes
  du chien de garde (6.5.0). Et le garde-fou de sortie est une boîte à TROIS choix
  (`choiceDialog` : `#a`, `#b`, Annuler), pas un `confirmDialog` : viser `#ok` ne ferme rien.
- **L'aide du cabinet suit celle du client.** Les classes viennent de la feuille PARTAGÉE
  (`.help-…`, `.th-…`) : c'est le même langage visuel, et surtout pas un second jeu de règles dans
  `cabinet.css` qui dériverait au premier ajustement (règle 6.8.0 sur les collisions de noms). Les
  huit articles portent désormais un sous-titre, un dessin, une couleur et le geste qui suit la
  lecture — `geste: null` sur « Ce que cette application ne fait pas », parce qu'on ne renvoie nulle
  part depuis une liste de limites.

Les tests qui comptent sont `npm run e2e:partage` (deux applications, deux profils, un emplacement
commun : on partage, on rejoint, et ce que l'un enregistre l'autre le voit) et `npm run e2e:actions`
(un seul bouton par ligne sur six listes, le menu qui ne vole pas le clic de la ligne, la question
posée avant d'agir — et « Annuler » qui ne change vraiment rien — puis « Accepter et facturer » qui
ouvre le brouillon).

## 7.29.0 — Un bouton qui ne se referme pas n'est pas un interrupteur

Skander, sur captures : « quand j'appuie sur les 3 points et que je rappuie dessus, ça ne la ferme
pas mais la rouvre » ; « mets des icônes, c'est plus intuitif » ; « au lieu des 3 points renomme le
bouton » ; « dans la capture 2 on voit les boutons qui sont collés » ; « dans immobilisations, voir
la fiche me renvoie dans l'achat à modifier, est-ce le bon workflow ? ».

Règles apprises, à ne pas recasser :

- **Deux garde-fous qui visent la même chose se neutralisent.** Le `mousedown` global refermait le
  menu ; le `click` qui suit, sur le même bouton, le rouvrait. Le menu clignotait et restait
  ouvert. Il faut LES DEUX moitiés : le bouton entre dans `SURFACES_OVERLAY` (le garde-fou global
  ne le touche plus) **et** `ouvrir()` referme quand on rappuie sur le bouton déjà ouvert
  (`ouvertSur`). Le drapeau se remet à zéro **sous condition** (`if (ouvertSur === bouton)`) :
  `close` peut être rappelé alors qu'un AUTRE menu a pris sa place.
- **Un pictogramme n'est pas un libellé, mais une icône À CÔTÉ d'un libellé est un repère.** « ⋮ »
  ne se lit que si on connaît la convention : le bouton porte le mot « Actions » et un chevron.
  Dans le menu, chaque action porte son dessin en plus de sa phrase — jamais à la place.
- **Une action UNIQUE ne se cache pas derrière un menu** : `bindRowMenus` transforme le bouton en
  vrai bouton nommé qui exécute directement. Deux clics et une lecture pour un choix unique, c'est
  ce qu'on reprochait aux rangées.
- **Le menu vit dans `src/renderer/rowmenu.js`, chargé par LES DEUX applications.** L'app du
  cabinet avait exactement le même défaut, en pire : cinq boutons fantômes par ligne d'historique,
  dont un « ✕ » muet qui **efface un paquet reçu** — le geste le plus destructif était le seul sans
  nom. Le recopier aurait garanti la divergence (règle 7.3.0 + « une table en double diverge
  toujours »). Il ne connaît rien du métier : on lui passe des actions toutes faites et on lui
  prête le registre d'overlay de l'hôte (`RowMenu.brancher`).
  **Tout fichier partagé doit entrer dans les `files` de `build/cabinet.config.js`** — sinon l'app
  démarre en développement et plante une fois construite, comme `src/depot.js` en 7.26.0. Un test
  relit les balises de son HTML et l'exige.
- **Une ligne garde AU PLUS UN bouton toujours visible** — le geste pour lequel la page existe
  (« Écrire » sur les relances du cabinet) — et tout le reste passe par le menu. `RowMenu.cellule`
  prend ce bouton en paramètre ; un test compte les boutons de chaque cellule `row-actions` dans
  les deux applications et refuse tout libellé de moins de six caractères.
- **Deux boutons voisins ne doivent pas dépendre d'une espace dans le gabarit.**
  `${cond ? '<button…>' : ''}<button…>` les collait, et ça ne se voit qu'à l'écran (capture du
  Catalogue). `td.actions .btn + .btn { margin-left }` le règle une fois pour toutes.
- **Un libellé décrit l'écran d'ARRIVÉE.** « Voir l'achat » ouvrait l'éditeur : un achat n'a pas de
  fiche en lecture seule, contrairement à une facture émise qui est verrouillée. Le bouton dit
  maintenant « Ouvrir la facture d'achat », et « Créer la fiche » est devenu « Créer la fiche du
  bien » (c'est celle de l'immobilisation, pas celle de l'achat).
- Piège du gabarit, re-rencontré : **un commentaire HTML dans un `template literal` ne doit contenir
  aucun backtick** — j'ai écrit `` `btn-ghost` `` dans un commentaire et fermé la chaîne.
- **Un garde-fou posé chez l'APPELANT ne protège que cet appelant.** La question « ce devis a déjà
  donné FAC-… » était sur le bouton de l'éditeur depuis la 7.16.0 ; le menu de ligne, écrit douze
  versions plus tard, est reparti sans elle et refabriquait une facture ENTIÈRE en silence. Elle
  vit maintenant dans `facturerDevis`, avec le geste. Corollaire : `piecesDuDevis(id)` est la seule
  source (l'éditeur, le menu et le geste l'appellent) — et ses deux moitiés ne se lisent pas au même
  endroit, une facture totale porte `fromQuoteId`, un acompte porte `deposit.quoteId`.
- **Un overlay peut se fermer sur un événement qu'on n'a pas provoqué.** Le menu s'ouvrait et
  disparaissait dans la milliseconde : le `scroll` qui avait amené le bouton à l'écran juste avant
  le clic était livré à la frame SUIVANTE, après l'enregistrement du fermeur. On ne ferme donc que
  si le conteneur a vraiment bougé (`Math.abs(scrollTop - depart) > 4`). Symptôme à reconnaître :
  un menu qui « ne s'ouvre pas » alors que son gestionnaire s'exécute — le tracer avec un
  `MutationObserver` dit s'il a été ajouté puis retiré, ce qu'aucun sélecteur ne montre.
- **Ce qui s'ouvre par-dessus referme ce qui est en dessous.** `openPalette` ferme le menu de ligne
  et le sélecteur d'entreprise (couche 70) avant de se dessiner (couche 60) : sinon ils flottent sur
  son fond flouté et volent son premier Échap. L'app du cabinet avait ce garde-fou depuis la 6.8.0.
- **`vers()` et non `navigate()` dans TOUTE table d'actions** qui pose un état avant de naviguer —
  les entrées d'onglet de la palette étaient inertes depuis la page qu'elles visent (piège 7.15.0).
- **`e2e:boucle` était cassé depuis la 7.22.0** — le parcours le plus important du projet, celui qui
  prouve la chaîne entreprise → paquet → cabinet. Il traversait l'assistant en comptant les
  « Suivant » ; l'écran du régime fiscal s'est inséré au milieu. Personne ne s'en était aperçu : il
  n'avait pas été relancé. C'est le troisième e2e pourri par le même mécanisme (`.help-nav` en
  7.28.0, les écrans numérotés en 7.3.0). **Reconnaître chaque écran à ce qu'il contient, jamais à
  son rang — et relancer TOUS les parcours après une refonte.**

## 7.30.0 — Les Paramètres, et ce qu'on ne peut pas trouver

Audit des pages de réglages des deux applications, mesuré avant d'y toucher (`e2e:parametres`), puis
un audit de code à six angles avec un contradicteur par constat : **huit constats graves retenus,
trois réfutés**. Refonte livrée avec eux.

Règles apprises, à ne pas recasser :

- **Un onglet d'un demi-écran n'est pas un onglet, c'est un clic de plus.** Huit onglets d'un
  déséquilibre de 1 à 12 : « Licence » et « Cabinet comptable » pesaient une phrase, « Sécurité et
  données » deux écrans et dix-huit boutons. Cinq onglets, et le plus léger fait 0,8 écran.
- **Ce qui rend un rangement pardonnable, c'est la recherche.** Quand on ne sait pas dans quelle
  famille un réglage a été classé, on tape son nom. Elle lit les titres, les libellés ET la prose des
  panneaux (« où je règle la copie iCloud ? » n'a pour réponse ni un titre ni un libellé : le mot
  n'est que dans la phrase d'explication), et elle dit toujours DANS QUEL ONGLET c'est rangé.
- **Le sommaire et la recherche se déduisent de l'ÉCRAN**, jamais d'une liste écrite à la main : un
  panneau ajouté demain est trouvable le jour où il est écrit. Corollaire : la table qui porte les
  synonymes porte AUSSI le titre et l'onglet, et pose le panneau elle-même (`panneau(id)`).
- **Une refonte d'onglets périme tout ce qui les NOMME.** Six alias de la palette Cmd+K et onze
  phrases de refus désignaient un onglet disparu — donc Cmd+K ne rendait plus un seul réglage, en
  silence. Deux tests génériques l'interdisent : les entrées de palette sont engendrées panneau par
  panneau, et toute chaîne « Paramètres → X » doit nommer un onglet qui existe.
- **Une application qui vérifie ses mises à jour UNE fois au démarrage ne les vérifie pas.** SkanFact
  est ouvert du lundi au vendredi sans être quitté : une correction publiée le mardi arrivait le
  lundi suivant. Toutes les quatre heures, plus un rattrapage au retour au premier plan (un portable
  refermé suspend les minuteurs). Et la date de la dernière vérification est AFFICHÉE : sans elle,
  « tu as la dernière version » peut dater d'un mois, et rien ne permet de le savoir.
- **Une panne pendant un téléchargement que l'utilisateur VOIT se dit toujours**, même si la
  vérification qui l'a déclenché était silencieuse. Sinon la barre de progression se fige à 40 % pour
  de bon — et les deux états concernés n'offraient aucun bouton, alors que `update:download` savait
  relancer depuis la 1.7.0 (« un moteur sans écran n'existe pas », 7.3.0).
- **Un réglage à liste fermée ne se saisit jamais en texte libre.** La devise de l'entreprise était
  le seul champ libre de l'application ; « TND », « dinar » ou une faute de frappe faisaient passer
  toutes les factures à deux décimales au lieu de trois, sans un mot. Et la migration rattrape ce
  qui a déjà été tapé, au lieu de le remettre d'office à la valeur par défaut.
- **Un drapeau « l'utilisateur y a touché » doit être RÉAMORCÉ partout où l'écran se rejoue.**
  `regimeTouche` n'est pas enregistré : au rejeu de l'assistant — le seul endroit où l'on puisse
  changer de métier — il repartait à `undefined` et le régime fiscal réglé à la main se faisait
  écraser. Son voisin immédiat, `modulesTouche`, le faisait correctement depuis la 7.0.0.
- **Tout geste des Paramètres qui finit par `render()` enregistre d'abord.** La règle datait de la
  5.2.1 et n'avait été posée que sur le choix d'un logo : activer un mot de passe jetait vingt champs
  remplis, sans un mot. `enregistrerEnCours()` passe par le garde-fou actif, donc vaut pour tout
  écran qui en pose un.
- **Un refus d'écriture se remonte, il ne se jette pas.** `setPassword` ignorait le retour de
  `write()` : sur un dossier partagé, l'écran annonçait « Données chiffrées » pendant que le fichier
  n'avait pas bougé — et au redémarrage il réclamait l'ANCIEN mot de passe pendant que les
  sauvegardes réclamaient le nouveau.
- **Rechiffrer les sauvegardes, c'est aussi celles de la clé USB.** `mirrorExternal` ne recopiait un
  fichier que s'il n'existait PAS encore : trente jours de comptabilité restaient en clair sur le
  support qui voyage, à côté d'un fichier chiffré, pendant que l'écran affirmait le contraire. On
  compare taille et mtime, et on convertit sur place les sauvegardes externes sans équivalent local
  — sans jamais les supprimer : c'est un filet, il a juste à ne plus être lisible.
- **Une règle CSS correcte peut PERDRE en silence, et ça ne se voit qu'en mesurant.** Troisième fois
  (après le `th.r` des colonnes en 7.23.0 et `.help-fil` en 7.27.0) : en thème sombre, chaque
  `<input>` gardait son fond clair avec le texte clair du thème — contraste **1,18**, du blanc sur du
  blanc, depuis que le thème existe. La règle commune des champs porte quatre `:not()`, la règle
  sombre n'en portait aucun. `select` et `textarea` n'étaient pas touchés (dans une LISTE de
  sélecteurs, chacun porte sa propre spécificité), donc l'écran paraissait à moitié correct — la
  pire façon d'être faux. `e2e:contraste` mesure désormais les champs autant que les boutons.
- **Un pluriel mal accordé se compte en dizaines.** Quatre-vingt-dix « 1 facture(s) » dans les deux
  applications et leur logique partagée, alors que la règle existait dans l'app du cabinet depuis sa
  1.0.0 et avait été « portée » à UN écran en 7.18.0. `pl`/`sPl` (app.js) et `plFr`/`sAccord`
  (core.js), et un test qui interdit la forme partout.
- **Un test qui lit du code doit lire ce qu'il prétend lire.** Ma première version du test de
  pluriel passait par `codeSeulement`, qui VIDE les chaînes — c'est-à-dire l'endroit exact où vivent
  les pluriels. Il ne pouvait pas échouer. Je ne l'ai su qu'en réintroduisant le défaut.
- Piège d'e2e, la quatrième fois : **trois parcours visaient un onglet par son identifiant** et un
  quatrième un `data-fiche` supprimé douze versions plus tôt (`e2e:fiches` accusait le jeu d'exemple
  d'être vide). On reconnaît un écran à ce qu'il CONTIENT — `ouvrir l'onglet qui contient #p-cabinet`
  — et on relance TOUS les parcours après une refonte, pas seulement celui qu'on vient d'écrire.

## 7.31.0 — Un document long est fait de PAGES

Skander, sur capture : « quand le devis ou facture est longue avec plein de lignes l'affichage n'est
pas très bien ». Mesuré avant d'y toucher (chromium + `page.pdf`, jamais déduit) : le document était
**un seul long bloc** que le navigateur coupait où il pouvait, avec un pied de page posé en absolu à
la fin de ce bloc. Conséquences, sur **toutes** les pièces de plus d'une page depuis la 1.0.0 :

- le pied s'imprimait **par-dessus les cases de signature** (« Date, signature et cachet du client »
  barré du matricule fiscal) ;
- la **première page ne portait aucune mention légale** ;
- aucun numéro de page nulle part ;
- un devis de neuf lignes finissait sur une seconde page **vide aux trois quarts**.

`paginate(d)` (core.js) fabrique désormais une `<div class="page">` par feuille : pied complet et
numéroté sur chacune, bandeau `.cont` de rappel en tête des suivantes, en-tête de colonnes répété,
blocs insécables descendus entiers. `mettreEnPage()` dans app.js et `renderPdf` dans main.js sont les
deux seules portes, et elles font la même chose dans le même ordre.

Règles apprises, à ne pas recasser :

- **Un pied de page posé en absolu se colle à la fin du CONTENU, pas en bas d'une feuille.** C'est
  vrai dès que le contenu dépasse une page — et ça ne se voit ni dans une console, ni dans un test de
  calcul, ni en relisant le CSS. Il a fallu imprimer un vrai PDF et le regarder.
- **Déléguer la découpe au navigateur ne perd jamais rien ; la faire soi-même, si.** `.page` porte
  `overflow: hidden` : une erreur de mesure de trois millimètres masquerait une ligne de facture sans
  un mot. D'où le filet : à la fin de la répartition, on vérifie que **chaque** page tient dans sa
  feuille, et sinon on restaure le document d'origine et on rend la main au navigateur. Mieux vaut le
  défaut d'hier qu'une ligne invisible.
- **Le resserrement ne se justifie que s'il fait gagner une feuille.** `fitToPage` resserrait dès
  qu'il y avait débordement — donc aussi sur un document qui ferait trois pages de toute façon : on
  perdait le confort de lecture pour rien. On essaie les niveaux (rien, `compact`, `compact dense`) et
  on garde le plus léger qui réduit le nombre de pages. Effet de bord heureux : un devis de **huit
  lignes tient maintenant sur une page** au lieu de deux.
- **Une fonction sérialisée par `main.js` ne peut appeler AUCUNE autre fonction de core.js.**
  `renderPdf` envoie `fitToPage.toString()` et `paginate.toString()` dans la fenêtre PDF : un appel à
  `money()` y lèverait une ReferenceError silencieuse et le PDF sortirait sans mise en page. Un test
  compare le corps des deux fonctions à la liste des exports de core.js.
- **Un bloc insécable plus haut qu'une page fait tout échouer.** De longues notes rendaient `.after`
  (conditions + totaux) plus haut qu'une feuille, et plus rien ne tenait nulle part. Deux parades :
  les notes sont découpées **ligne par ligne** (`.n-l`, chacune échappée séparément), et quand le bloc
  de fin dépasse, sa colonne de gauche est **sortie** du bloc pour se répartir, la carte des totaux
  restant à sa place.
- **Une condition de garde porte sur la PAGE, jamais sur le conteneur.** Mon premier `repandre`
  acceptait d'office le premier morceau de chaque conteneur neuf « puisqu'il est seul » — or le
  conteneur était neuf sur une page déjà pleine. Un cas sur 161 débordait de 1 mm ; c'est la mesure
  qui l'a dit, pas la relecture.
- **Piège du gabarit, troisième fois : aucun backtick dans un commentaire d'un `template literal`.**
  Deux commentaires CSS contenant un nom de fonction entre backticks ont cassé core.js.
- **Un nom de fichier de capture écrit à l'avance finit par mentir** : `deux-pages.png` montrait une
  page. Le nom porte maintenant le nombre de pages **mesuré**.

Le test qui compte est `npm run e2e:pages` : il imprime **161 documents** (sept types, six variantes,
de 1 à 40 lignes) et vérifie sur chacun qu'aucune ligne, clause ou note n'a disparu, qu'aucune page ne
déborde, qu'aucun pied ne chevauche le contenu, qu'une page fabriquée fait une feuille et que chacune
est numérotée. Il n'ouvre pas Electron (chromium suffit), donc il tourne sans `xvfb`. Prouvé en
remettant le défaut : 111 cas sur 161 tombent.

## 7.32.0 — Les Réglages du cabinet en onglets, et ce qu'un rangement ne doit jamais ranger

Skander : « pour l'appli cabinet, créer des onglets c'est mieux non ? (dans la page paramètres) ».
Mesuré avant de répondre (`npm run e2e:parametres`, étendu pour mesurer panneau par panneau) : 2,6
écrans, sept panneaux de 0,20 à 0,49 écran chacun — toute la page du cabinet était plus petite qu'un
seul onglet de l'app entreprise. Un découpage en trois donnait 0,74 / 1,05 / **0,46**, et le dernier
tombait sous le demi-écran, c'est-à-dire exactement ce que la 7.30.0 venait de retirer de l'autre
application. Livré quand même, sur décision du propriétaire, mais **rééquilibré** : 0,8 / 1 / 0,7.

Règles apprises, à ne pas recasser :

- **Un rangement range aussi ce qu'il ne faut pas ranger.** Le commentaire qui interdisait les
  onglets dans ce fichier donnait une raison juste : l'avertissement « tu n'as jamais enregistré de
  clé de secours » se serait retrouvé derrière un clic. Mettre des onglets obligeait donc à le
  sortir d'abord — bandeau au-dessus de la barre d'onglets, ligne en tête de « À faire », et sur la
  page Dossiers **y compris quand elle est vide** (cet écran-là sortait avant le panneau « À faire »,
  et c'est le premier jour que l'alerte compte le plus).
- **La question posée révèle souvent un défaut plus grave que la question.** Ici : l'alerte la plus
  importante de l'application — sans clé de secours, un poste perdu rend illisibles POUR TOUJOURS
  tous les paquets reçus — n'existait qu'à un seul endroit, au milieu d'une page de 2,6 écrans.
- **Un onglet trop léger se corrige en déplaçant ce qui est mal rangé ailleurs**, pas en renonçant.
  « Signaler un problème » vivait dans le panneau Sécurité, où il n'avait rien à faire : devenu le
  panneau « Aide et dépannage », il fait passer le troisième onglet de 0,46 à 0,7 écran. Le
  déséquilibre mesuré était le symptôme d'un mauvais rangement, pas d'un mauvais découpage.
- **`reglages.js` savait déjà faire les onglets** : `installer()` accepte `nomOnglet` /
  `ouvrirOnglet` / `ongletCourant`, et `montrer(pid)` ouvre l'onglet du panneau AVANT de le faire
  défiler. L'app cabinet ne lui passait simplement rien. Les trois rappels vont **ensemble** : n'en
  donner que deux laisse la bascule silencieusement inerte, et on atterrit sur le bon panneau dans un
  onglet masqué — c'est-à-dire nulle part. Un test l'exige.
- **Tous les panneaux restent dans le document, masqués — jamais dessinés paresseusement.**
  `drawBackupPanels()` sort en silence si ses trois panneaux manquent : un onglet rendu à la demande
  les laisserait sur « Chargement… » pour toujours, sans une erreur dans aucune console.
- **Ce qui traverse un onglet doit l'ouvrir** : `refus()` sur un champ masqué, la pastille de mise à
  jour, le chemin de récupération après perte du fichier, les gestes des articles d'aide, les entrées
  de palette. Tous passent maintenant par `versReglages(panneau)`, qui pose l'onglet et la cible puis
  redessine si l'on y est déjà (piège 7.15.0).
- **Restaurer une clé de secours compte comme en avoir une.** Sans ça, le poste neuf reprochait sa
  clé à quelqu'un qui venait de la restaurer depuis sa clé USB : « le pire défaut est celui qui punit
  quelqu'un qui a tout bien fait » (6.8.1). La date retenue est celle du fichier (`creeLe`), pas
  celle du geste.
- **Le jumeau manquant, encore.** L'app entreprise a `TODO_ACTIONS` + un test de couverture depuis la
  7.0.0 ; le cabinet n'avait ni l'un ni l'autre, et ses cinq lignes de « À faire » portaient le MÊME
  lien en dur vers les Relances — « une échéance approche » y envoyait aussi, alors que sa page est
  Échéances. Un bouton qui marche mais se trompe de page ne se remarque jamais. Une règle apprise
  d'un côté se vérifie de l'autre, à la main (règle 7.3.0).
- **Le contrôle « Paramètres → X nomme un onglet qui existe » n'avait pas de jumeau « Réglages → ».**
  Une phrase de l'assistant nommait déjà « Réglages → Sécurité », un onglet qui n'a jamais existé.
- Piège d'e2e, la cinquième fois : six endroits du parcours cabinet cliquaient un bouton désormais
  dans un onglet masqué. La parade est toujours la même — `ouvrirReglages(panneau)` reconnaît
  l'onglet à ce qu'il **contient** (`closest('[data-pane]')`), jamais à son rang ni à son
  identifiant. Et l'assertion de `e2e:perte` qui ne testait que le hash exige maintenant que le
  panneau soit **visible** : on peut être sur la bonne page et sur le mauvais onglet.
- Piège de test rencontré : `new RegExp(\`panneauReg\\\\('${id}'\`)` dans `run-tests.js` casse le
  fichier. Une concaténation de chaînes fait le même travail sans le risque.

## 7.33.0 — Les offres, et l'éditeur qui vend depuis sa propre application

Skander : « l'étape d'après c'est de mettre en place la licence… l'essai de 30 jours, générer des
clés, limiter les fonctionnalités quand t'es indépendant », puis « un petit programme qui génère les
clés, fait la facture, avec un historique… protégé dans un repo privé ». Le site (`skanfact-site`,
page Tarifs) annonce : Essai 0 DT · Indépendant 390 DT HT/an · Entreprise 690 DT HT/an, 20 % la
première année si un cabinet parraine.

**Le programme demandé existait déjà : c'est SkanFact.** Une vente de licence est une facture comme
une autre — journal des ventes, TVA collectée, paquet du comptable. Un programme à part aurait refait
la facturation et laissé la comptabilité de l'éditeur fausse. D'où un module **Éditeur** dans l'app
entreprise, visible seulement sur le poste où vit la clé privée (`~/.skanfact/licence-privee.pem`,
ou `SKANFACT_DOSSIER_CLES` pour les tests). Et « repo privé » ne protège rien : **le secret n'est pas
le code, c'est la clé** — le code qui signe tient en une ligne, celui qui vérifie est public depuis
la 6.4.0.

La séquence d'armement, en quatre gestes : (1) 7.33.0 publiée, désarmée ; (2) Skander clique
« Créer mes clés » ; (3) il colle la clé PUBLIQUE dans la conversation ; (4) on la commite dans
`build/licence-public.json`, on retourne le test qui exige son absence, on publie **8.0.0** — ce
jour-là chaque installation a 30 jours. Entre (2) et (4), son propre poste est armé avec sa clé (il
la déduit de la privée) et il voit ce que verront ses clients.

Règles apprises, à ne pas recasser :

- **`build/` n'était pas dans les `files` d'electron-builder** : `build/licence-public.json`
  n'aurait jamais été embarqué, et l'app installée serait restée libre quoi qu'on commite. Le seul
  chemin où la licence ait jamais pu se verrouiller était `npm start`. Le motif est un **glob**
  (`build/licence-public*.json`) : son absence ne fait pas échouer la construction. Un test le tient.
- **L'offre voyage DANS la clé signée**, et une clé sans offre (d'avant) ou avec une offre inconnue
  vaut Entreprise : en cas de doute on ouvre. `reserves` ne porte que sur la CRÉATION : les modules
  fermés gardent leur entrée dans la barre (avec un cadenas), leur page, leur lecture, leur export.
  Ne jamais passer par `moduleOn` : l'offre ne masque rien.
- **Statistiques vit dans le module Pilotage et ne crée rien** : elle reste ouverte. Le blocage se
  décide par module + `p.id !== 'stats'`, jamais par « le module entier ».
- **`licenceBlock(what, module)` est la porte unique**, et elle va DANS le formulaire, sur la branche
  création (`!supplier &&`), parce que `supplierForm`, `projectForm`, `assetForm` s'ouvrent depuis
  plusieurs pages (règle 7.29.0). Le test de 6.4.0 exigeait « au moins quatre » appels et n'a jamais
  vu deux créations sans garde-fou (« Dupliquer » un achat, « Établir n bulletins ») ; il nomme
  maintenant chaque point de création. Et sa regex ne voyait que la forme à un argument : **un appel
  à deux arguments lui échappait en silence** — on compte aussi les appels bruts.
- **L'essai compte depuis l'armement SUR CE POSTE** : `armedAt` (app-config.json) est écrit la
  première fois que l'application y voit une clé publique, et l'essai part du plus tardif de
  `installedAt`, `armedAt` et `createdAt` de la clé. La date de fabrication de la clé ne suffit pas :
  la version qui l'embarque peut arriver des semaines après le keygen. `installedAt` est écrit depuis
  la 6.4.0, donc sans ce garde-fou toute installation de plus de trente jours se serait verrouillée
  à la minute de la mise à jour.
- **La clé de licence vit DANS LE DOSSIER de l'entreprise** (`<dossier>/licence.json`), plus dans
  `userData` : un ordinateur ouvre plusieurs entreprises, et une clé est émise pour UN matricule —
  au niveau de l'ordinateur, la clé du premier dossier verrouillait le second (« autre entreprise »).
  Une clé rangée par la 6.4.0 dans `userData` n'est reprise que pour le dossier dont le matricule
  correspond. Un dossier partagé (iCloud) emporte sa clé : c'est ce qu'on veut pour « trois postes ».
- **Un renouvellement part de la FIN de la licence en cours** quand elle est encore future
  (`depuis` transmis à `licence:emettre`, durées relues à l'ouverture du formulaire avec
  `editeurStatus(depuis)`) : « À faire » réclame le renouvellement trente jours avant, et ces trente
  jours sont payés. La remise de parrainage (« première année ») repart à zéro au renouvellement.
- **Une licence expirée ne barre pas le partage d'un dossier** : partager n'est pas créer une pièce.
  `partagerDossier` ne juge que l'offre (`!licence.locked && licenceBlock(…, 'partage')`). C'est le
  contradicteur qui l'a vu : `licenceBlock` teste `locked` avant l'offre, pour tout module.
- **La clé est attachée au matricule** (cœur : sept chiffres + lettre, ponctuation et suffixes
  ignorés), et un côté vide ne compte pas — on ne punit pas qui n'a pas rempli sa fiche. Le
  matricule vit dans les données du renderer : il VOYAGE avec `licence:status` et `licence:set`, et
  l'état se relit après le chargement du dossier et après chaque fiche société enregistrée (« un
  état lu une fois au démarrage se périme », 7.1.x). `licence:set` refuse la clé d'une autre
  entreprise en nommant les deux matricules, plutôt que de l'enregistrer et d'afficher « autre ».
- **La clé privée ne traverse jamais le pont** : `licence:emettre` reçoit les champs, signe dans
  main.js, rend `SKAN1.…`. `editeur:status` rend la publique, le chemin, `armee` (la clé embarquée
  existe) et `correspond` (c'est la sienne) — sans elle, l'éditeur ne saurait pas si ses licences
  valent chez ses clients ou seulement chez lui. Un test relit chaque `lirePrivee()` de la section.
- **Un mois de licence est un mois du calendrier** (`addMonths`, 31 janvier + 1 mois = 28 février),
  pas 30,44 jours ; les durées arrivent à l'écran avec la date qu'elles donnent AUJOURD'HUI, calculée
  une seule fois dans licence.js. « À vie » = pas d'`exp`. Une date libre doit être future.
- **Émettre fait trois choses dans le même geste** : la clé, un BROUILLON de facture (`newDocument`,
  jamais `nextNumber`), la ligne d'historique (`data.licences`, dans `MERGE_LISTS` sinon le poste
  perdant les perdrait à la fusion, et vidée par « Tout effacer » comme le reste). Le prix vient du
  catalogue ou d'un champ, jamais du code ; la remise de parrainage se pose sur `doc.discountRate`,
  il n'existe pas de remise par ligne.
- **Le mail de licence a son gabarit** (`DEFAULT_EMAIL_TEMPLATES.licence`, FR et EN, avec `{cle}`) :
  sans lui, `emailFor` retombe sur le gabarit de facture. Il ne s'édite dans Paramètres → Envois que
  chez l'éditeur, comme la page Licences, le panneau, l'entrée de palette et la ligne « À faire » :
  chez un client, aucune trace.
- **Renouveler crée une seconde clé et une seconde facture** ; la première porte `remplaceePar` et
  sort de « À faire » sans disparaître. `licenceRows` trie : à renouveler, expirées, actives, à vie.
- **La porte « Tu édites SkanFact ? Créer mes clés » n'existe que sur une application NON armée**
  (`licence.state === 'libre'`) : le jour où la clé publique est embarquée, plus aucun client ne la
  voit. `scripts/licence.js --keygen` n'écrit plus `build/licence-public.json` : armer tout le monde
  est une décision (copier le fichier public, le commiter), jamais l'effet de bord d'un keygen — et
  un test exige l'absence du fichier tant que ce n'est pas décidé.
- **Ce que la relecture adversariale a trouvé après coup** (sept angles, un contradicteur par
  constat, 40 constats bruts) : le renouvellement qui repartait d'aujourd'hui, le partage barré par
  une licence expirée, l'essai compté depuis le keygen, la clé au niveau de l'ordinateur, Cmd+K qui
  proposait le panneau Éditeur à tout le monde (`visible` dans SETTINGS_PANNEAUX, filtré par
  `reglagesDePalette`), « Enregistrer la clé » comparée au matricule ENREGISTRÉ et non à celui du
  formulaire (`enregistrerEnCours()` d'abord), une clé collée effacée par un redessin du panneau, le
  stock de départ du catalogue qui crée un mouvement sans garde-fou, le libellé « Trésorerie,
  marges, statistiques » sur un bandeau qui laisse les Statistiques ouvertes (`LIBELLES_OFFRE`), le
  mail qui annonçait une facture jointe quand rien ne l'était (`{facture}` conditionnel), une
  licence déjà renouvelée qu'on pouvait renouveler encore, `normMatricule` qui prenait le code TVA
  (« /A ») pour la lettre-clé, le 30 février accepté comme date de fin (`dateValide`), et le prix
  saisi « 390 » qui devenait 390 € sur la facture d'un client réglé en euros (le champ nomme la
  devise de la société, et la facture de licence reste dans cette devise). Le test « ce que la
  relecture adversariale a trouvé » tient chacun. Les contradicteurs ont aussi jugé les TESTS :
  un contrôle sur le seul caractère qui suit `lirePrivee()` laissait passer `String(lirePrivee())`
  (le contexte entier est jugé désormais), une assertion e2e à précédence `||`/`&&` qui acceptait
  n'importe quel identifiant, un « pas de cadenas sur Statistiques » vrai faute de lien (le métier
  choisi n'affichait pas le module), et un refus testé par le pont au lieu de l'écran. À refaire sur
  toute version qui touche à de l'argent ou à une clé.
- Piège d'e2e : ce que « Copier la clé publique » met dans le presse-papiers est le fichier JSON
  entier (les retours à la ligne y sont échappés) — comparer les champs après `JSON.parse`, pas le
  texte. Et la clé privée de l'e2e vit dans `SKANFACT_DOSSIER_CLES` : jamais dans le vrai
  `~/.skanfact`, qui appartient à l'éditeur — le harnais pose un dossier vide par défaut pour TOUS
  les parcours, sinon ils tourneraient armés sur le Mac de l'éditeur.

## 8.0.0 — La licence est armée

Skander a créé ses clés dans SkanFact (7.33.0) et collé la clé PUBLIQUE dans la conversation. Elle
vit dans `build/licence-public.json` — **ne jamais la supprimer, la régénérer ni la remplacer** (voir
« Règles de travail »). La clé privée est dans `~/.skanfact/licence-privee.pem` sur son Mac, avec
une copie qu'il a mise à l'abri ; aucune session Claude ne l'a jamais vue et ne doit jamais la voir.

Règles apprises, à ne pas recasser :

- **Celui qui signe n'achète pas.** Armer l'application armait aussi le poste de l'éditeur : au
  trente-et-unième jour, Skander aurait été verrouillé chez lui, avec une clé qu'il ne pouvait
  s'émettre qu'en se déclarant client de lui-même (le formulaire exige un client). L'état `editeur`
  (licence.js) n'a ni essai ni verrou ; il ne vaut que si la clé privée du poste **correspond à la
  clé publique en vigueur** (`editeurDeLaCleEnVigueur()` dans main.js) — une autre clé privée (un
  second éditeur, une clé recréée par erreur) ne donne aucun passe-droit. Une clé COLLÉE est jugée
  avant et reprend le dessus : c'est ainsi qu'il voit exactement ce que voit un client, et « Retirer
  la clé » le ramène à son état. Deux `correspond` existent et ne disent pas la même chose :
  `editeurStatus().correspond` compare à la clé EMBARQUÉE (l'état du panneau : armée avec cette clé /
  avec une autre / en attente), `editeurDeLaCleEnVigueur()` à la clé EN VIGUEUR (le passe-droit).
- **Le test qui exigeait l'absence du fichier est retourné, pas supprimé** : il exige sa présence,
  qu'il soit une vraie clé Ed25519 lisible, sans clé privée dedans, et qu'une licence signée par
  n'importe quelle autre clé privée soit refusée avec lui. « On teste l'interrupteur, pas la
  position dans laquelle il est » (7.26.0) — ici la position a changé, et le test avec elle.
- **Le paquet a été OUVERT avant de dire que la clé est embarquée** : `electron-builder --linux dir`
  puis `asar list` / `asar extract-file` sur `app.asar`. La 7.33.0 avait appris que `build/`
  n'entrait pas dans le paquet ; un glob dans `build.files` ne se vérifie qu'en regardant dedans.
- **Un test qui a besoin de l'application DÉSARMÉE ne déplace pas le fichier du dépôt** : il passe
  par `SKANFACT_CLE_EMBARQUEE` (un chemin qui n'existe pas), honoré **en développement seulement**
  (`!app.isPackaged`) — une application installée lit toujours sa propre clé, quoi que dise
  l'environnement, et un test relit la garde. Tous les autres e2e tournent désormais armés, en essai,
  comme chez un client : c'est l'état qu'il faut tester, pas un état qui n'existe plus.
- **L'armement se prouve dans les DEUX sens** : `e2e:licence` ouvre une application désarmée pour
  fabriquer des clés d'essai, PUIS une seconde telle qu'un client l'installe — essai de 30 jours,
  aucune trace de l'éditeur, plus de porte « Créer mes clés », et la clé signée par la clé d'essai
  REFUSÉE (« pas reconnue »). Sans la seconde moitié, rien ne prouverait que la clé embarquée est
  celle de Skander et pas celle du test.
- **Un test de source ancré sur une tranche se périme quand une fonction déménage.** Sortir la
  déduction de la clé publique dans `clePubliqueEditeur()` (avant `editeurStatus`) a fait tomber
  « la clé privée ne traverse jamais le pont » : la tranche ne voyait plus que deux lectures. Les
  lectures de `lirePrivee()` sont maintenant jugées sur TOUT main.js, et chacune doit vivre dans la
  section éditeur — prouvé en posant une lecture dans `licence:status`.
- **Ce que la relecture adversariale a trouvé avant la publication** (six angles, 22 constats ; les
  contradicteurs ont été coupés pour épargner le quota — chaque constat retenu a été vérifié à la
  main dans le code, corrigé, et prouvé en réintroduisant le défaut) :
  - **Une clé publique ne se lit jamais dans un fichier qu'on ne signe pas.** `clePubliqueEditeur()`
    croyait `licence-publique.json` dès qu'il portait un `publicKey` : recopier la clé de SkanFact
    à côté d'un `.pem` quelconque donnait le passe-droit de l'éditeur. Elle est DÉDUITE de la
    privée, toujours ; le fichier ne porte que la date, et se réécrit s'il ne correspond pas.
    `e2e:licence` rejoue l'imposture (étape 9).
  - **Un relais qui ne peut pas vérifier ne refuse pas.** Sans `LICENCE_PUBLIC_KEY`, le worker
    répondait 403 à toute application qui présente une clé — c'est-à-dire à chaque client qui a
    PAYÉ, dès qu'il collait sa clé. Il laisse passer (le secret suffit), et ne dit « mal réglé »
    (503) que si `LICENCE_REQUISE=1`. Poser la clé publique sur Cloudflare reste à faire par
    Skander, ce n'est plus bloquant.
  - **Changer de flux, c'est aussi retirer les en-têtes de l'ancien** : `feedGithub` remet
    `requestHeaders` à null, sinon le secret de l'application et la clé de licence partaient vers
    GitHub après un repli.
  - **Une phrase rassurante se vérifie contre le code** : « SkanFact n'envoie jamais ta clé nulle
    part » était fausse depuis la 6.7.0 (elle est présentée au relais). La phrase dit maintenant où.
  - **Un état lu une fois au démarrage se périme (7.1.x), encore** : l'essai ne se terminait jamais
    tant que l'application restait ouverte. Relu toutes les heures et au retour au premier plan.
  - **Une licence payante qui finit se dit dans la barre**, pas seulement dans un panneau que
    personne n'ouvre : bandeau à quatorze jours.
  - **« Retirer » doit retirer partout** : la clé héritée de la 6.4.0 (`userData/licence.json`)
    ressuscitait au prochain appel ; et le message annonçait « Licence enregistrée ».
  - **L'essai est compté par ORDINATEUR** (app-config.json) et la clé par DOSSIER : un second
    dossier créé après la fin de l'essai s'ouvre verrouillé — c'est voulu, et le message le dit.
    La date d'armement est doublée dans `<dossier>/licence.json` (la plus ancienne fait foi) :
    effacer app-config.json en gardant ses données ne rejoue plus l'essai. Reculer l'horloge ou
    réinstaller sans ses données le rejoue : accepté, l'application est en source ouverte.
  - Constats laissés de côté sciemment : `todoList` n'a pas de ligne « ta licence se termine »
    (le bandeau suffit) ; la tranche du test de la clé privée a été resserrée en deux morceaux sans
    handler étranger, plutôt qu'élargie.
### 8.0.1 — un essai qu'on ne voit pas est une surprise, pas un essai

Skander, avant d'installer la 8.0.0 sur son PC Windows : « vu que j'avais déjà passé l'assistant,
rien ne me dit qu'il y a un essai de 30 jours ; si je ne vais pas dans les Paramètres, ça devrait se
voir dans le menu à gauche ou quelque part, pour ceux qui sautent l'assistant, non ? » Il avait
raison : `licenceBanner` ne montrait la pastille qu'à **sept jours** de la fin. Pendant vingt-trois
jours, une installation neuve n'annonçait nulle part qu'elle était en essai — ni que le logiciel se
paie. On l'apprenait le trente-et-unième matin, verrouillé.

- **Une échéance qui verrouille se voit depuis le premier jour, pas depuis le dernier.** C'est la
  règle « aucun message brut ne remonte à l'écran » (7.26.0) vue de l'autre côté : ce qui ne se dit
  nulle part est aussi grave que ce qui se dit mal. Et c'est la même famille que « un moteur sans
  écran n'existe pas » (7.3.0) — ici l'essai existait, il n'avait simplement aucun écran.
- **Trois tons, pas deux, parce que l'autre travers serait le nagware.** Un bandeau qui crie
  « 28 jours restants » tous les matins cesse d'être lu, et emmène avec lui ceux qui comptent :
  `calme` (gris, à peine plus marqué que le numéro de version) pendant l'essai, `attire` (orange) la
  dernière semaine ou quatorze jours avant la fin d'une licence payante, `alerte` (orange, avec le
  chemin) quand la création est bloquée. Un essai à cinq jours en vert d'eau ressemblait à une bonne
  nouvelle.
- **Rien ne s'affiche quand il n'y a rien à dire** : `libre`, `editeur`, une licence à vie. Une
  pastille sur un état sans échéance serait un mensonge.
- **La décision vit dans `core.pastilleLicence(licence)`**, pure et testée sur de vraies valeurs ;
  le renderer ne fait que la poser. Un test relit `licenceBanner` et interdit qu'il rejuge
  `daysLeft` lui-même : sans ça, la logique repartirait vivre dans app.js et le test de la règle ne
  prouverait plus rien de ce qui s'affiche.
- **L'assertion e2e qui gravait le défaut a été RETOURNÉE, pas supprimée.** `e2e:licence` exigeait
  « à 30 jours d'essai, aucun bandeau ne doit encore s'afficher » : elle décrivait l'état du jour, pas
  la règle — troisième occurrence du motif après `barre-laterale.js` (7.12.0) et le champ jeton
  (7.26.0). **Quand une règle change, c'est le test qui se relit en premier.**
- Prouvé dans les trois sens : la pastille redevenue muette fait tomber le test unitaire, le renderer
  qui rejuge les jours fait tomber le test de source, et le défaut réintroduit fait tomber l'e2e.

### 8.1.0 — un ordinateur qui dort n'est pas une application qui gèle

Skander, photo d'écran de son PC au réveil : « quand l'ordi ou le Mac se met en veille, ça m'affiche
ça, ce qui n'est pas correct non ? » — **SkanFact s'était bloqué. L'application n'a plus répondu
pendant 464 secondes.** Rien n'avait gelé : la machine dormait.

- **Le chien de garde mesure un silence ; il doit d'abord se demander si le monde tournait.** Pendant
  la veille, le renderer ne répond plus parce que TOUT est suspendu. Au réveil, `Date.now() - lastPong`
  valait 464 s, le gel était déclaré, la page rechargée — et le brouillon en cours perdu, ce que la
  fenêtre annonçait elle-même. Un filet qui punit quelqu'un pour avoir refermé son portable est un
  piège (même famille que le module qui se rallumait tout seul, 7.12.0).
- **Les DEUX parades, jamais une seule.** `powerMonitor` (`suspend`/`resume`) donne le signal franc,
  mais il n'arrive pas partout (hibernation, machine virtuelle, certaines fermetures de capot) ; le
  **saut d'horloge** — le temps réellement écoulé entre deux battements, comparé au pas voulu — est
  celui qui se déclenche tout seul. Règle de la 6.7.2 : « un chemin de secours ne sert que s'il se
  déclenche tout seul ».
- **Le saut d'horloge discrimine proprement**, et c'est ce qui le rend légitime : un gel du RENDERER
  n'empêche pas le minuteur du processus principal de battre toutes les trois secondes. Un battement
  qui en a sauté vingt dit donc la veille, jamais l'interface bloquée.
- **Et le réveil a droit à un délai** (`WATCHDOG.reveil`) : l'interface met un instant à reparler,
  la juger dans la seconde reviendrait à recréer le défaut un cran plus loin.
- **Le jumeau manquant, encore.** L'app Cabinet avait le saut d'horloge **depuis la 6.8.1** — écrit
  pour son processus principal occupé, il attrapait la veille par ricochet. L'app entreprise ne l'a
  jamais reçu. C'est très exactement pourquoi la capture vient du poste client et pas du cabinet.
  *Une règle apprise d'un côté se vérifie de l'autre* (7.3.0) : celle-ci ne l'avait pas été.

Livré en même temps, sur ses demandes :

- **« Proposer une amélioration »**, à côté de « Signaler un problème », dans l'Aide et les Paramètres
  des DEUX applications. L'application savait recevoir ce qui ne marche pas et n'avait aucune porte
  pour ce qui manque, alors qu'elle est écrite par une seule personne. Elle n'emporte **ni journal ni
  état du portefeuille** : une idée n'a pas de pile d'appels, et joindre le journal « au cas où »
  serait prendre des données sans raison — c'est la différence assumée avec le signalement. Deux
  questions, et l'ordre compte : ce qu'on aimerait faire, PUIS comment on s'en sort aujourd'hui. **La
  seconde est celle qui apprend quelque chose** : on propose toujours une solution, et la solution
  imaginée est rarement la meilleure.
- **L'empreinte d'un cabinet se vérifie** (`core.empreinteCabinet`, `core.licencesDuCabinet`, purs et
  testés). Ce qu'on peut prouver : la forme (vingt caractères hexadécimaux) et le fait que ce cabinet
  ait déjà parrainé quelqu'un. Ce qu'on ne peut PAS : qu'il existe — il faudrait sa clé publique.
  **L'écran le dit au lieu d'afficher un vert rassurant** : « 7 pièces vérifiées, intactes » est la
  seule affirmation rigoureuse (Cabinet 1.0.0), et celle-ci suit la même règle. La normalisation
  retire les **séparateurs** et exige vingt caractères hexadécimaux — retirer tout ce qui n'est pas
  hexadécimal aurait avalé un « G » tapé pour un « 6 » en décalant le reste, rendant la faute
  invisible au lieu de la nommer.
- **« + Nouvelle prestation » dans le combo du catalogue** du formulaire d'émission. Le combo des
  clients proposait « + Nouveau client » depuis toujours, celui du catalogue non — et l'éditeur, qui
  n'a aucune prestation de licence au premier jour, retapait son prix de mémoire à chaque émission.
  **Les DEUX moitiés sont nécessaires** : `combo()` dessine l'entrée, `bindCombo` branche le geste ;
  une seule des deux et le bouton n'apparaît pas, ou apparaît sans rien faire. Et `catalogForm`
  rappelle `done(null)` quand on SUPPRIME depuis sa fenêtre : sans la garde, le formulaire planterait.
- **Une classe CSS utilisée et jamais définie ne se voit nulle part.** `class="mono"` était posé sur
  l'empreinte du cabinet depuis la 6.2.0 ; `.mono` n'existait pas dans la feuille de style. Elle
  s'affichait dans la police du texte, à l'endroit précis où la chasse fixe sert à distinguer un `0`
  d'un `O`. Même famille que le `th.r` (7.23.0) et `.help-fil` (7.27.0) : le HTML est juste, c'est la
  feuille de style qui décide.
- Piège rencontré : l'étoile des champs obligatoires est posée par `.field.obligatoire > span:first-child::after`.
  Un libellé écrit en **nœud texte nu** ne la reçoit pas. Et le `modal()` de l'app cabinet ne pose pas
  la légende « * obligatoire » (mécanisme propre à l'app entreprise, 7.20.0) : plutôt qu'une
  convention à moitié appliquée, l'obligation s'y écrit en toutes lettres.
- Piège de test : `indexOf` sur `bindCombo($('[data-combo=itemId]'` attrapait le **premier** des
  trois combos de ce nom et donnait une tranche de 268 000 caractères. Une tranche se prouve par sa
  taille avant d'être jugée (7.21.0). Et une assertion sur du texte source doit tenir compte des
  **apostrophes échappées** : `/n'a encore/` ne correspond pas à `n\'a encore`.

### 8.2.0 — Le cycle de vie d'une licence

Skander, après avoir émis sa première licence de test : « le code doit être écrit quelque part non ?
quand je fais émettre ça me renvoie vers la facture et après je suis obligé de revenir dans licence
pour l'envoyer, c'est pas intuitif » ; « j'aimerais upgrade une licence sans forcément en envoyer une
autre » ; « imagine des gens veulent se rétracter, il faut pouvoir révoquer cette clé et rembourser
la facture, il me faut tout un système de gestion ».

**La limite à connaître avant tout le reste : une clé livrée ne se reprend pas.** La licence est
vérifiée sur le poste du client, hors ligne, contre la clé publique embarquée. Il n'existe aucun
serveur à interroger, donc **rien ne peut faire cesser de fonctionner une clé déjà envoyée**. C'est
le prix de la promesse inverse — celle qui fait la valeur du produit : le client travaille sans
connexion, et l'application lui survit même si son éditeur disparaît. Décision prise avec Skander :
on ne coupe PAS non plus les mises à jour d'une clé révoquée (règle 6.7.0, « une licence expirée
reçoit quand même les corrections de bugs »).

- **« Révoquer » dit donc trois choses vraies, et une quatrième qu'il refuse de cacher** : la licence
  sort des actives avec son motif et sa date ; la facture émise se corrige par un **avoir** (jamais
  une suppression) ; et **la clé continue chez le client jusqu'à sa date de fin**, ce que la fenêtre
  écrit en orange avec le pourquoi. Un bouton qui prétendrait couper serait un mensonge, et c'est
  exactement le genre d'affirmation que cette application s'interdit (« 7 pièces vérifiées,
  intactes », Cabinet 1.0.0). Un test exige ces phrases dans la fenêtre.
- **Un geste finit là où il se termine vraiment.** `montrerCle` remplace `navigate('#/doc/' + inv.id)` :
  la CLÉ est le produit, la facture est une conséquence. Même famille que « un bouton principal
  propose le geste SUIVANT » (7.19.0).
- **Le prorata, parce que refaire payer une année fait refuser la montée en gamme.**
  `core.prorataOffre` : la date de fin ne bouge pas, on facture la différence sur les jours restants.
  Une licence **à vie** n'a pas de fin sur laquelle répartir — `jours`/`total` valent `null` pour que
  l'écran le DISE au lieu d'afficher un ratio inventé. Et une « montée » vers moins cher ne rend
  jamais d'argent toute seule : un remboursement est une décision, il passe par un avoir.
- **Ce qui est dans la charge signée ne se modifie pas à distance** — l'offre ET le matricule. Les
  deux gestes signent donc une clé neuve ; ce qui change, c'est ce qu'ils facturent : la différence
  au prorata pour l'offre, **rien** pour un matricule corrigé (cette licence est déjà payée, et la
  facture reste attachée à la ligne remplacée, sinon « À faire » en réclamerait une seconde).
- **`LICENCE_MOTIFS` : trois gestes, trois libellés.** Renouvellement, changement d'offre et
  correction de matricule produisent tous un `remplaceePar` ; les montrer tous comme « Renouvelée »
  ferait mentir la colonne.
- **Trois manques d'argent que personne ne voyait** (`core.licencesAFaire`) : clé jamais envoyée,
  facture restée en brouillon, licence livrée et impayée. Chaque ligne pose une **vue** de la liste
  (`licState.tri`) au lieu d'ouvrir cent licences — règle 7.15.0 — et « Réinitialiser les filtres »
  doit pouvoir en sortir, sinon la vue est un piège.
- **`invoiceBalance(doc, data, company)` et `effectiveStatus(doc, data, company, today)` prennent la
  société en TROISIÈME argument**, jamais lue dans `data`. L'oublier ne lève rien à l'appel : ça
  plante plus loin dans `computeTotals` sur `company.stampFee`. `licenceSuivi` la prend en option
  avec un repli sur `data.company`.
- **Un compteur rafraîchi par EFFET DE BORD d'une navigation disparaît avec elle.** Le compte de la
  barre latérale se mettait à jour parce qu'on partait sur la facture ; en finissant sur la clé, une
  licence émise à l'instant n'était comptée nulle part jusqu'au prochain changement de page. C'est
  `e2e:licence` qui l'a vu — jamais la relecture. `redessinerBarre()` après chacun des quatre gestes.
- **Deux assertions gravaient le défaut, retournées** (quatrième et cinquième occurrence du motif) :
  le test de source exigeait `navigate('#/doc/' + inv.id)`, et l'e2e attendait `#/doc/…` après
  l'émission. **Quand une règle change, c'est le test qui se relit en premier.**
- Piège de test : **`lireApp()` RETIRE les commentaires de ligne** — une tranche ne peut jamais
  s'ancrer sur un commentaire, seulement sur du code. Mon ancre `// ---------- le cycle de vie…`
  donnait `indexOf` = −1, donc `slice(x, -1)`, donc 56 000 caractères au lieu de 3 000.
- Piège de test, re-rencontré : une assertion qui recopie une ligne de menu mot pour mot
  (`/peut && !r\.remplaceePar \? \{ icon: 'contrat', label: 'Renouveler'/`) tombe dès que l'entrée
  gagne un garde-fou, et se « répare » en recopiant la nouvelle ligne — donc sans rien prouver. On
  extrait la LIGNE et on exige la règle qu'elle doit porter (7.16.0).
- Piège de remplacement en masse : `const filtered = !!(s.q || s.st);` existe dans plusieurs routes.
  Un remplacement global aurait touché la page Clients. On borne la zone à la route visée — et
  `s.index('\n  routes.', d)` rend −1 quand la route est la dernière du fichier.

- **`LICENCE_CONTACT` vaut `contact@skanfact.tn`** : la boîte Zimbra Starter du domaine `skanfact.tn`, commandé chez OVH le 14/09/2026 (une seule adresse personnalisée pour l'instant, d'où « contact » et pas « licences »). C'est l'adresse vers laquelle « Demander une licence » et « Signaler un problème » composent le mail. Elle doit exister avant la fin du premier essai (14/10/2026), sinon un client en fin d'essai écrit dans le vide.

### 8.3.0 — La liste propose, elle n'enferme pas

Le frère de Skander a essayé l'application : « leur retenue est de 1 % alors que sur l'app ça
commence à 1,5 ». C'est le premier retour d'un utilisateur qui n'est ni l'auteur ni le propriétaire,
et il a tenu en une phrase.

- **Une liste fermée finit toujours par enfermer quelqu'un.** Les taux proposés sont passés de six à
  onze, mais l'ajout n'était pas le correctif : la **saisie libre** l'est. Un taux réglementaire
  dépend de la prestation, du régime du client et de la loi de finances de l'année — trois choses
  qu'une liste écrite en 2026 ne peut pas suivre. `« Autre taux… »` reprend le mécanisme des unités
  de ligne (2.3.0) : le taux tapé rejoint la liste et **y reste** (`core.usedWithholdingRates`,
  jumeau exact de `usedUnits`). C'est le pendant de la règle de la 5.0.0 — *aucun taux n'est écrit
  en dur dans un calcul* — appliqué cette fois à ce qu'on PROPOSE, pas à ce qu'on calcule.
- **Un select dont aucune option ne correspond retient la PREMIÈRE, en silence.** Trois écrans sur
  six lisaient `C.WITHHOLDING_RATES` à la main. Un client réglé sur un taux hors liste n'avait donc
  aucune option sélectionnée : rouvrir sa fiche pour corriger un téléphone et enregistrer le
  ramenait à « Par défaut », c'est-à-dire **changeait le montant de ses factures**. Rien ne plante,
  rien n'apparaît en console, et la fiche paraît normale. Les six écrans passent par une porte
  unique (`withholdingSelect` / `bindWithholdingFields`, branchée par `modal()` et `render()` comme
  `bindDateFields`), et un test compte les lectures de la liste : elle ne se lit qu'à un endroit.
- **Une route ASYNCHRONE pose son écran après la fin de `render()`.** Les Paramètres attendent
  `dataPath()` : les deux branchements de fin de dessin travaillaient donc sur la page qu'on venait
  de quitter, et le taux libre y restait inerte — sans une erreur nulle part. `render()` retient ce
  que la route renvoie et rebranche quand la promesse se résout. Les deux fonctions sont
  idempotentes, c'est ce qui rend le rattrapage sûr. Défaut ancien : `bindDateFields` avait le même,
  invisible faute de champ date dans les Paramètres.
- **Une valeur transitoire ne doit jamais atteindre le gestionnaire du dessus.** L'éditeur de
  document relit tout son formulaire à chaque frappe : choisir « Autre taux… » lui faisait écrire la
  chaîne `__autre__` dans la pièce, que `Number(…) || 0` ramenait à **0 %** — une retenue effacée
  pendant qu'une fenêtre demande justement laquelle mettre. On remet l'ancienne valeur **dans le même
  tour d'événement**, avant que le `change` ne remonte ; le taux saisi est ensuite rendu par un
  `change` **relancé**, jamais écrit à la main dans les données (chaque écran a déjà son chemin
  d'enregistrement, le doubler ferait diverger les deux).
- Piège d'e2e, deux fois dans la même heure : **l'éditeur de document travaille sur une `deepCopy`**
  jusqu'à « Enregistrer » — lire la pièce rangée dans `window.__data` juste après un geste ne prouve
  rien, il faut lire ce que l'ÉCRAN affiche (`#totals`) puis enregistrer. Et tout geste qui marque
  l'éditeur « modifié » réveille le garde-fou à la navigation suivante : l'erreur tombe alors trente
  secondes plus tard sur un sélecteur qui n'a rien à voir (7.19.0, re-rencontré).
- Piège de test : `assert` d'un taux hors liste dans `usedWithholdingRates` restait vert avec le
  garde-fou retiré, parce que `Number('') === 0` et que 0 est déjà dans la liste connue. Le seul cas
  que la garde protège vraiment est le taux **négatif** — c'est lui qu'il faut tester.

### 8.4.0 — Le plan de contrôle : plusieurs clés, l'activation, la révocation appliquée

La seule version du chantier qui touche une licence **déjà vendue**. Trois choses, et une règle qui
passe avant les trois : *tout est facultatif*. Sans adresse configurée, sans réseau, sans réponse,
sans clé de réponse embarquée, l'application fonctionne exactement comme avant, **sans un mot à
l'écran**. C'est la règle 1 du § 8 de `PLAN-PLATEFORME.md`.

Règles apprises, à ne pas recasser :

- **Une licence sans `kid` se vérifie avec `master`, et avec elle seule.** C'est le point de
  compatibilité le plus dangereux du projet : toutes les clés vendues depuis la 8.0.0 sont dans ce
  cas, et sans cette ligne la mise à jour les aurait invalidées d'un coup, le même matin. La règle
  vit **des deux côtés** — `choisirCle` dans `src/licence.js` et dans
  `plateforme/skanfact-api.mjs` — parce que le serveur et l'application doivent rendre le même
  verdict. On n'essaie **jamais** toutes les clés à la suite : `kid` en désigne une, et c'est ce qui
  permet de RETIRER une clé compromise au lieu de la laisser valider éternellement.
- **La date qui sert de plancher à l'essai est celle de la PLUS ANCIENNE clé.** Prendre la plus
  récente aurait rouvert trente jours d'essai à tous les clients le jour où la clé du serveur est
  ajoutée — un défaut qui ne coûte rien à écrire et se paie en chiffre d'affaires, sans que rien ne
  le signale.
- **Le serveur ne peut qu'ajouter une restriction déjà prévue, jamais accorder un droit.** Une
  licence expirée le reste quoi que réponde le serveur ; une révocation le ferme. La clé signée
  reste la source de vérité pour fonctionner, et c'est ce qui fait que l'application survit à la
  disparition de son éditeur.
- **Une réponse ne restreint rien tant qu'elle n'est pas signée, datée ET adressée.** Chacun des
  trois répond à une attaque précise : sans la **signature**, n'importe quel intermédiaire (un wifi
  d'hôtel, un pare-feu) répond « révoquée » à un client qui a payé ; sans le **sujet** (l'empreinte
  de la licence), la réponse destinée au client A se rejoue chez B ; sans la **date**, on rejoue une
  vieille réponse pour ressusciter une révocation annulée. `ok: false` est le cas par défaut partout
  dans `verifierReponse` : une réponse qu'on ne peut pas juger est ignorée, jamais transformée en
  refus.
- **Poser et LEVER une révocation exigent la même preuve.** Sans cette symétrie, quelqu'un capable
  de couper le réseau figerait une révocation pour toujours, et l'éditeur n'aurait aucun moyen de la
  reprendre après un remboursement annulé.
- **Le verdict survit à la clé qu'on pose ou retire.** `ecrireLicence` le conserve comme il
  conserve `armedAt` : sinon « Retirer la clé » puis « Enregistrer » lèverait une révocation en deux
  clics. Il ne s'applique qu'à la clé qu'il VISE (`sujet`), donc le garder ne pénalise jamais une
  clé neuve.
- **Ce qui remonte est écrit en toutes lettres, et un test compte les champs.** La clé, le
  `deviceId`, le nom du poste, la plateforme, la version. Rien d'autre — jamais un client, une
  facture, un montant, un chemin de dossier. Un jour quelqu'un voudra « juste ajouter le nom de la
  société pour s'y retrouver » : c'est ce test qui doit l'arrêter.
- **Un essai s'annonce aussi**, sans clé. Sinon aucun essai ne serait visible nulle part, et un
  éditeur qui ne voit pas ses essais ne sait pas s'il a des clients qui arrivent.
- **La clé de réponse se fabrique sur le poste de l'éditeur**, comme les clés de licence en 7.33.0 :
  une clé privée dont l'application dépend n'a rien à faire dans un canal qu'on ne maîtrise pas. Sa
  moitié privée va dans un réglage Cloudflare, sa moitié publique dans
  `build/licences-publiques.json`. Elle ne traverse pas le pont : main.js la met au presse-papiers,
  l'écran n'en reçoit que la confirmation.
- **Créer un CLIENT n'est pas un geste que la licence ferme** — seule une *pièce* l'est. Découvert
  en écrivant l'e2e : sa première version cliquait « Nouveau client » et concluait que la révocation
  ne bloquait rien.
- **Un glob qui a l'air de couvrir ne couvre pas forcément.** `build/licence-public*.json` ne
  correspond PAS à `licences-publiques.json`, et l'application installée serait restée sur l'ancien
  fichier sans que rien ne plante. Le test d'avant comparait le motif à son orthographe du jour ;
  celui d'aujourd'hui l'ÉVALUE contre les deux noms de fichier — c'est ce qui l'a attrapé.
- **`ta()` sans `await` est le même défaut que `t()` avec une fonction asynchrone**, une couche plus
  loin : le test part détaché, son « ok » s'affiche après le total, et une assertion qui tombe ne
  fait plus échouer la commande. J'y suis tombé en écrivant le premier test de ce lot. Le harnais
  compte désormais les `ta` en cours et refuse de conclure s'il en reste.
- Piège de test rencontré : une assertion ancrée sur la PROXIMITÉ de deux lignes tombe dès qu'on
  ajoute un commentaire entre elles. On ancre sur l'ORDRE (`indexOf` successifs).

Le test qui compte est `npm run e2e:plateforme` : il pose **le vrai worker** — le fichier déployé
sur Cloudflare, pas une imitation — derrière un serveur local, et lance l'application réelle en
face. Huit étapes : une clé sans `kid` acceptée, l'activation vue par la plateforme, une révocation
signée qui ferme la création et laisse lecture et export ouverts, la même levée, la même avec un
octet retouché (ignorée), la même rejouée trois mois plus tard (ignorée), le serveur éteint (rien ne
change, aucun message rouge), et une installation neuve qui n'a jamais vu le réseau. Les deux
altérations sont posées dans le **transport** : c'est là qu'un attaquant se place.

### 8.5.0 — P 0.2 : la console vend

Le worker (`plateforme/skanfact-api.mjs`) émet, révoque, renouvelle, change d'offre, marque payée
et envoie la clé par mail (Resend, `send.skanfact.tn`) ; l'application gagne « Créer la clé du
serveur » (`srv-1`) dans le panneau Éditeur. `test/d1-sqlite.js` pose une base D1 sur le SQLite de
Node : les handlers se testent contre le VRAI schéma dans `npm test`, et `e2e:console` fait tourner
le vrai worker dans un vrai navigateur. La 8.5.0 n'embarque PAS encore la publique `srv-1` : elle
viendra avec la clé de réponse, le jour de la mise en production (les deux gestes se font ensemble).

Règles apprises, à ne pas recasser :

- **La clé maître ne va jamais sur le serveur.** `srv-1` est une clé de SECOND rang, fabriquée sur
  le poste de l'éditeur comme les autres (7.33.0, 8.4.0), retirable sans toucher aux licences
  signées par la maître. Le worker VÉRIFIE au premier appel que `SRV_PRIVATE_KEY` et la publique
  `srv-1` de `LICENCE_PUBLIC_KEYS` vont ensemble (`cleServeur`) : une privée collée à côté de la
  mauvaise publique produirait des clés refusées partout, et rien ne le dirait avant le premier
  client. La console affiche « émission impossible » avec la raison, et grise le bouton.
- **On ne range jamais la clé en base, seulement son CONTENU signé** (`licences.charge`). Ed25519
  est déterministe : le même JSON signé par la même privée redonne la même clé à l'octet près.
  « Voir la clé » et « Renvoyer par mail » la refabriquent, et vérifient que l'empreinte obtenue est
  celle que la base suit — sinon une révocation viserait une empreinte que personne ne présente.
- **L'ordre des champs de la charge est celui que l'application écrit** (`chargeLicence`, un test
  fixe la liste) : un champ déplacé change la signature. Format 2 ajoute `kid` et `sub` ;
  l'application ignore ce qu'elle ne connaît pas et n'a pas eu besoin de changer.
- **Une licence remplacée n'est pas une active de plus** : renouveler ou changer d'offre signe une
  clé neuve (`remplace_id`, motif), et la carte « licences actives » les exclut. Trois clés dont deux
  remplacées = une licence active. Le statut se déduit : révoquée, sinon expirée, sinon remplacée,
  sinon active.
- **Marquer payée envoie la clé dans la seconde** (§ 12 du plan), une fois (`envoyee_le`), et
  seulement si le client a une adresse et si Resend est réglé — sinon l'écran dit pourquoi et la
  clé se copie. Le mail porte la MÊME phrase d'activation que le gabarit de l'application, et un
  test la compare. Resend est la SEULE requête sortante du worker ; un test compte les `fetch(`.
- **La révocation dit sa limite en orange** dans le formulaire même : une clé livrée ne se reprend
  pas, l'application ne l'applique qu'à sa prochaine connexion et si sa version embarque la clé de
  réponse. Un motif est obligatoire. Renouveler une révoquée ou une déjà remplacée est refusé (409).
- **Les tests ne rejouent plus le worker, ils le font tourner.** `e2e:console` imitait ses
  réponses avec des lignes écrites à la main : une requête SQL fausse y restait invisible jusqu'à
  Cloudflare. Avec `baseD1()` le SQL s'exécute pour de vrai sur `schema-a-coller.sql` — celui qu'on
  demande à Skander de coller. Le seul faux est Resend, et on vérifie ce qu'on lui aurait envoyé.
- Piège attrapé par l'e2e, invisible autrement : après un formulaire validé avec succès, la page
  réactivait un bouton que `fermerForm()` venait de retirer — TypeError dans une promesse, aucune
  console chez l'utilisateur. On relit l'élément au moment d'y toucher (règle 7.17.0, côté console).
- Piège de test : `contains(@class, "card")` en XPath attrape le conteneur `.cards`, premier dans
  l'ordre du document — et cliquer un conteneur ne fait rien. Trouvé par le délai d'attente.
- Piège de test : une tranche de source bornée sur un voisin NOMMÉ se casse quand on insère un
  handler entre les deux. On borne sur « le `ipcMain.handle(` suivant, quel qu'il soit ».

### 8.5.1 — Le justificatif se joint avant toute saisie

Le père de Skander, première facture d'achat : « Depuis une photo » exigeait un fournisseur et une
ligne, posait « la lecture n'est pas activée, joindre quand même ? », enregistrait, **repartait sur
une page vide**, et la photo n'apparaissait nulle part. Cinq défauts sur un bouton, et aucun ne se
voyait dans un test : ils vivaient dans l'ORDRE des gestes.

- **Une pièce jointe n'a besoin que d'un identifiant, et une pièce neuve en a un.** Exiger
  d'enregistrer (donc de valider) pour accrocher la photo qu'on a sous les yeux, c'est le contraire
  de l'ordre dans lequel on travaille : la photo vient EN PREMIER, la saisie se fait en la
  regardant. La liste vit dans la pièce en cours (`p.attachments`, `doc.attachments`) et part avec
  l'enregistrement ; quitter sans enregistrer retire les copies (`discard` du garde-fou), jamais
  l'original.
- **Deux gestes, deux boutons.** « Joindre un justificatif… » (toujours là, hors ligne, sans
  question) et « Lire une photo… » (caché tant qu'aucune clé n'est activée). Un bouton qui n'a rien
  à proposer que l'autre ne fasse déjà, et qui pose une question pour le dire, est un piège.
- **`render(true)` après avoir rempli `p` jetait `p`.** La route repartait de la pièce rangée, ou
  d'une pièce neuve et vide. `achatReprise` relaie la pièce en cours à la page qui se redessine,
  pour CE hash et une fois. Le défaut existait aussi sur une pièce enregistrée : la lecture d'une
  photo y perdait tout autant.
- **`p.attachments = …` sur une pièce rangée ne suffisait pas** : `p` est une copie, et `save()`
  écrivait les données sans elle. L'écran disait « photo jointe », les données ne la portaient pas.
  On écrit dans les deux, et le panneau lit la même source que `save()`.
- Un correctif d'un éditeur se cherche dans l'autre (7.3.0) : l'éditeur de document avait le même
  « enregistre d'abord », retiré pareil. Et la liste des achats porte un trombone : ce que le
  comptable demande, c'est quelles pièces N'ONT PAS de justificatif.
- Le parcours qui compte est `npm run e2e:justificatif` : le sélecteur de fichier natif est remplacé
  dans le processus principal (`dialog.showOpenDialog`), un vrai fichier est copié, enregistré,
  retrouvé sur le disque et dans la liste ; une pièce abandonnée ne laisse pas de copie ; et la
  lecture d'une photo (via le crochet `skanfact:ocr-demo`) redessine la page SANS perdre la pièce.

### 8.7.0 — Le pont comptable, et la lecture de photo en pause

Skander : « et continue la suite go avec la 8.7 » — puis « enlève la fonction photo ou mets-la en
pause, vu qu'on n'a pas encore l'app sur téléphone ça sert à rien ». Le § 11 de `PLAN-PLATEFORME.md`,
livré : la console vend, SkanFact facture.

- **SkanFact TIRE, jamais la console ne pousse.** Un serveur ne peut pas écrire dans un logiciel de
  bureau éteint. `GET /v1/admin/ventes?non_facturees=1` rend chaque vente AVEC sa clé (refabriquée
  par `cleDeLicence`, jamais rangée en base) ; `POST /v1/admin/ventes/:id/facturee` reçoit le
  numéro à l'émission ; `POST /v1/admin/importer` reçoit UNE fois l'historique de `data.licences`.
- **Le secret d'administration vit à côté des clés** (`~/.skanfact/plateforme-admin.json`, 0600,
  `PONT_ADMIN` dans main.js), jamais dans les données ni dans un dossier partagé — un dossier
  partagé sur iCloud emporterait sinon le droit d'émettre des licences. Il est **essayé au moment où
  on le pose** (`pont:setSecret` appelle `etat`), et **refusé, il rend sa place à l'ancien** : la
  première version le laissait écrit après un refus, et `pont:status` disait « branché » sur un
  secret faux. C'est l'e2e qui l'a vu.
- **`pontRequete` n'accepte que les chemins de l'espace d'administration** (`PONT_CHEMIN`, jamais
  `..`), exige le poste de l'éditeur, envoie le secret en en-tête, et **traduit** : 403 → « refuse ce
  secret », échec réseau → « La console ne répond pas » (le `socket hang up` va dans `main.log`,
  règle 7.26.0).
- **Un brouillon, jamais un numéro** (`creerBrouillonsConsole` : `newDocument('facture')`, jamais
  `nextNumber`), derrière les DEUX garde-fous de création (`demoBlock`, `licenceBlock`). Le client est
  retrouvé par `core.clientPourVente` (les sept chiffres du matricule d'abord, le nom ensuite —
  jamais créé par le cœur, créer est une décision de l'appelant), la TVA par `defaultVat` (le régime,
  pas un 19 en dur), le montant HT est celui de la console tel quel. Une vente déjà tirée
  (`venteConsoleId` présent) ne fait pas deux brouillons.
- **Le numéro est rendu à l'émission** (`issue()` → `annoncerFacturesConsole`) et **réessayé** à
  chaque ouverture de la page Licences (`core.facturesAAnnoncer`) : un échec s'arrête sans crier
  (`catch { break }`), il n'est jamais rouge — la console éteinte n'est pas une panne de SkanFact.
- **Une licence vendue par la console porte `origine: 'console'`** : elle se lit, se copie, sa
  facture s'ouvre ; renouveler, changer l'offre, corriger, révoquer se font DANS la console qui l'a
  signée (le menu de ligne les retire). `licencesAFaire` ne réclame pas son envoi : la console
  l'envoie au paiement, la réclamer ici ferait envoyer deux fois. `envoyeeConsoleLe` compte comme un
  envoi dans `licenceSuivi`.
- **L'historique part UNE fois et nommé champ par champ** : `core.chargeHistorique` est pur, exclut
  ce qui vient de la console, et un test fixe la liste exacte des dix-huit champs — un jour quelqu'un
  voudra « juste ajouter » le client entier. La facture ne part qu'ÉMISE (numéro, net HT remise
  déduite, jour du dernier paiement) ; `data.pontImporte` retient le jour (dans `DEFAULT_DATA`, donc
  remis à zéro par « Tout effacer »). Côté worker, `nettoyerImport` REFUSE avec sa raison au lieu de
  mettre à null : ici on importe des ventes, une vente à moitié importée est pire qu'absente. Le
  client y est retrouvé par matricule puis par nom, les remplacements reliés en second passage
  (l'ordre d'arrivée ne garantit rien), et rejouer l'envoi ne réécrit rien (`dejaLa`).
- **La lecture de photo est en PAUSE, pas supprimée** : `OCR_EN_PAUSE = true` dans app.js. Le panneau
  `p-ocr` n'est plus POSÉ dans les Paramètres (donc ni sommaire, ni recherche — les deux se déduisent
  de l'écran) et sort de Cmd+K (`visible`), `#photo` ne se montre jamais, et l'article d'aide le dit
  en tête. Le code de 4.2.0 reste tel quel pour le jour où une application sur téléphone existera.
  Piège : `visible` dans `SETTINGS_PANNEAUX` ne filtre QUE la palette ; un panneau qu'on veut faire
  disparaître ne se pose pas — c'est `e2e:entreprise` qui l'a montré, le panneau était encore là.
- Piège de test : la tranche du handler `editeur:cleServeurCopier` était bornée sur le
  `ipcMain.handle(` SUIVANT — la section du pont, ouverte par un titre et deux fonctions, s'y est
  glissée. La borne est maintenant la première des deux : handler suivant OU titre de section.
- Piège d'e2e : sans clé Resend, la console n'envoie aucun mail, donc `envoyee_le` reste vide — mon
  assertion « la vente payée a été envoyée » décrivait un service de mail qui n'était pas là. Le
  miroir doit dire ce que la console a FAIT, pas ce qu'elle aurait dû faire.

Le test qui compte est `npm run e2e:pont` : le vrai worker sur SQLite, l'application réelle en état
éditeur (clé privée d'essai dans `SKANFACT_DOSSIER_CLES`, publique embarquée par
`SKANFACT_CLE_EMBARQUEE`), un secret faux refusé et un bon secret gardé en 0600 hors des données,
deux ventes tirées en deux brouillons (Trabelsi retrouvé sous une autre graphie du matricule, El
Amen créée), le menu d'une licence de la console sans « Renouveler », le numéro rendu à l'émission et
lu dans la base, puis la console éteinte qui se dit en français.

### 8.8.0 — Le grand livre et la balance

Le comptable de Skander a regardé l'application : « il manque encore beaucoup de choses
comptables », et deux termes retenus — **mouvement de compte** et **écriture comptable dans le
journal**. Le plan en trois versions : 8.8.0 grand livre + balance, 8.9.0 livre-journal (numérotation
continue, OD à la main, mouvements libres et déclarations en écritures, centralisateur, lettrage),
9.0.0 l'exercice (amortissements, à-nouveaux, résultat, rapprochement par relevé, TFP/FOPROLOS).

- **Tout se DÉDUIT des écritures de `journalEntries`, rien ne se saisit.** `soldesOuverture` calcule
  ce que chaque compte portait la veille de la période : les classes 1 à 5 traversent les années,
  les classes 6 et 7 repartent au 1er janvier et leur passé va au compte `resultat` (13). C'est une
  écriture d'à-nouveau déduite ; la 9.0.0 la rendra explicite (journal AN) SANS la compter deux fois
  — le jour venu, l'implicite doit disparaître au profit de l'explicite, pas s'y ajouter.
- **La balance ne garantit qu'une chose : ses trois paires de totaux tombent juste** (ouverture,
  mouvements, soldes). Un test le vérifie sur les 24 mois du jeu d'exemple et confronte le grand
  livre à la balance compte par compte (même ouverture, même solde, et le solde progressif qui
  finit sur le total). Une balance dont les ventes reportaient 2025 sur 2026 tomberait juste aussi :
  d'où le test séparé « les ventes n'ouvrent pas l'année, la banque si, le résultat porte le net ».
- **Un compte auxiliaire est FIGÉ sur la fiche** (`compteAux`), jamais déduit de la position dans la
  liste au moment de l'affichage : supprimer un client ne renumérote personne. `codesAuxiliaires`
  reste pur (le paquet du cabinet ne modifie rien) et donne le même code que celui qui sera écrit ;
  `numeroterAuxiliaires` l'écrit, à l'activation de la case et à chaque dessin des livres.
- **Les écritures portent `tiersId` et `role`** (`clients` / `fournisseurs`) : c'est ce qui fait la
  balance auxiliaire sans sous-comptes, et ce qui fera le lettrage. `salesJournal`,
  `paymentsJournal` et `supplierPayments` rendent l'identifiant du tiers, pas seulement son nom.
- **Le plan comptable (`PLAN_COMPTABLE`) ne sert qu'à NOMMER** (`accountLabel`, plus long
  préfixe) ; les rôles de `DEFAULT_ACCOUNTS` passent avant, et un sous-compte de tiers porte le nom
  du tiers. Le compte d'immobilisations proposé est passé de 24 à 22 : dans le SCE, 24 est « à
  statut juridique particulier ». Un compte réglé à la main (`data.chartAccounts`) n'est pas touché.
- Piège : le détecteur d'appels inexistants ne voit pas une fonction déclarée par `let a, b;` puis
  affectée dans une branche — `csv()` est passé pour un appel à une fonction absente. On déclare des
  données (`csvRows`, `csvCols`), pas une fonction à trous.
- Piège : `bindCombo` prend `onPick`, pas `onChange` ; `.tabs.sub` et `.scroll-y` n'existent pas
  dans la feuille de style — un nom de classe inventé ne se voit nulle part.

Le test qui compte est `npm run e2e:livres` : le grand livre de l'année (20 comptes, chaque solde
progressif finit sur le total du compte, aucun « Compte hors plan »), le sélecteur qui ne garde que
411, la balance équilibrée avec ses six totaux, l'auxiliaire clients sur le collectif, la case du
plan de comptes qui donne 411001…411008 et les fige sur les fiches, et le grand livre qui suit.

### 8.9.0 — Le livre-journal

Le second terme du comptable. `livreJournal` numérote les pièces de l'exercice (`numerosDuJournal`),
`journalCentralisateur` les totalise mois par journal, `odValide`/`odPiece` tiennent la saisie des
OD (`data.ecrituresOD`), `lettrage` lit ce qui reste ouvert, et `journalEntries` gagne cinq
sources : `ouverture` (soldes de départ, crédit de TVA saisi), `tresorerie` (mouvements libres),
le paiement des bulletins, `declarations` (la TVA du mois au dernier jour) et `od`.

- **Le même argent ne peut pas être à la banque sur une page et en caisse sur l'autre.**
  `journalDeCompte` suit LA règle de `cashMovements` : le compte affecté, sinon le compte par
  défaut, et le mode de paiement seulement s'il n'existe aucun compte. La première version jugeait
  sur le mode (« Espèces » → caisse) : la banque du grand livre et celle de la Trésorerie
  différaient de 361,95 sur l'exemple. Le test exige l'égalité au millime, sur les deux comptes.
- **Une écriture DÉDUITE peut cacher une écriture MANQUANTE.** `journalEntries` sautait les ventes
  dont le statut EFFECTIF est « annulée » — or une facture entièrement couverte par un avoir
  s'affiche ainsi : sa facture sautait, son avoir restait, le client finissait créditeur de 405,6
  sur l'exemple. Personne ne l'avait vu en 6.3.0 : la balance tombait juste (une écriture
  équilibrée en moins reste équilibrée). C'est le **lettrage** qui l'a attrapé — « le reste ouvert
  doit être le solde du 411 » est un contrôle que l'équilibre ne remplace pas.
- **Une OD n'entre qu'équilibrée**, et le refus se fait dans `odValide` (pur, sept motifs testés),
  pas dans la fenêtre : la fenêtre montre l'écart pendant la frappe et appelle la même fonction. Le
  numéro de pièce est pris à l'enregistrement, après `licenceBlock` et `closedBlock` (règle 6.0.0 :
  un refus après `odPiece` trouerait la numérotation).
- **Le numéro dans le journal est déduit, donc mobile sur un mois ouvert** : une pièce datée en
  arrière décale les suivantes. Ce n'est pas un défaut à corriger, c'est la raison d'être de la
  clôture, et la page le dit. Un mois seul reprend les numéros de l'exercice, jamais les siens.
- **La déclaration mensuelle s'écrit avec les chiffres de `vatChain`**, pas avec les soldes du
  grand livre : le crédit imputé vaut `collected − toPay`, donc le 4366 garde exactement le report
  que la chaîne reporte. Le crédit de TVA saisi à la main pour une année entre au 4366 par une
  écriture AN, sinon la première déclaration le créditerait d'un montant qu'il n'a jamais reçu.
- **Un mouvement porte sa contrepartie (`m.compte`) ou la nature décide (`MOVE_ACCOUNTS`)** ; ce
  qu'on ne sait pas ranger va au 471, et c'est écrit dans la bulle : c'est ce que fait un cabinet.
- Le compte 627 est devenu un RÔLE (`fraisBancaires`) : le test du plan qui l'utilisait pour prouver
  le préfixe a basculé sur 626. Un compte qui gagne un rôle porte le nom du rôle.
- L'exemple paie sa TVA chaque mois (`compte: '4365'`) et porte une OD : sans ça, le 4365 grossissait
  pour toujours et le premier comptable demandait pourquoi la société ne paie jamais sa TVA.

`npm run e2e:livres` gagne trois étapes : le livre-journal numéroté et son centralisateur, une OD
refusée à 200 d'écart puis enregistrée OD-2026-002 (le compte 613 nommé « Locations » pendant la
frappe), et le lettrage dont une ligne ouvre sa facture.

### 9.0.0 — L'exercice

Le troisième volet : les à-nouveaux (`anouveaux` dans `journalEntries`), les amortissements et les
cessions en écritures (`amortissements`), les états financiers (`etatsFinanciers`), l'état de
rapprochement (`etatRapprochement`), la TFP et le FOPROLOS dans la paie (`tfpRate`, `foprolosRate`,
`employerChargesOf`). Onglet **Comptabilité → États financiers** ; Trésorerie → Rapprochement gagne
son état ; Paie → Barèmes gagne deux taux.

- **L'à-nouveau se calcule sur les écritures RÉELLES seules**, jamais sur les à-nouveaux
  précédents. Le solde d'un compte de bilan persiste dans les écritures réelles ; le net des
  comptes de gestion de tout le passé va au résultat (13). Recalculer AN(2026) à partir de
  [réelles + AN(2025)] compterait le passé deux fois — d'où `SECTIONS_ECRITURES` sans `anouveaux`
  dans l'appel récursif, et le test qui compare la banque de l'AN au solde réel du 31/12.
- **L'ouverture d'une période se lit depuis le début de son exercice, à-nouveau compris, et jamais
  plus loin.** `soldesOuverture` remontait avant à toute l'histoire (8.8.0, à-nouveau implicite) :
  avec la pièce AN explicite, ce serait le double. Au 1er janvier, l'ouverture est donc 0 et la
  pièce AN apparaît comme mouvement — c'est ainsi qu'un grand livre se présente. Le test de 8.8.0
  qui exigeait « la banque rouvre en ouverture » a été RETOURNÉ (« l'ouverture de janvier est 0, la
  pièce AN porte la banque ») : quand une règle change, c'est le test qui se relit en premier.
- **Une dotation est une écriture d'inventaire : au 31 décembre, jamais avant.** Sur l'exercice en
  cours, le bilan ne la compte pas encore et l'écran le dit (`dotationEnAttente`), pendant que le
  résultat simplifié de l'onglet TVA la compte (`depreciationFor`). Deux chiffres différents sur
  deux onglets doivent s'expliquer l'un l'autre, sinon l'un des deux paraît faux.
- **Un bien saisi à la main entre à sa valeur brute contre le report à nouveau** (comme le solde de
  départ d'un compte, 8.9.0) : sans ça, le 28 s'amortit sur un 22 qui n'existe pas, et l'actif du
  bilan est négatif. Un bien lié à un achat (`purchaseId`) est déjà entré par l'achat.
- **Le prix d'une cession n'est jamais inventé** : la sortie d'actif (28 / 675 / 22) s'écrit, le
  prix arrive par un mouvement avec la contrepartie 775 ou par une facture. Écrire le prix d'office
  au 471 laisserait un compte d'attente que personne ne solde.
- **Les états financiers sont déduits de la balance, pas de la liasse** : rubriques par classe et
  par sens du solde (classe 4 débitrice à l'actif, créditrice au passif ; 28/29 en moins de l'actif).
  Ce qui est garanti et testé : actif = passif, résultat du bilan = résultat de l'état de résultat,
  trésorerie du bilan = `cashPosition`. La page écrit « pas la liasse NCT 01 ».
- **Une charge patronale ajoutée se lit sur la COPIE figée du bulletin** (`employerChargesOf`,
  `c.tfp || 0`) : un bulletin d'avant la 9.0.0 n'en gagne pas après coup, dans le journal non plus.
  L'interface n'additionne plus jamais `cnssEmployer + accident` à la main — un test l'interdit,
  parce que c'est exactement l'addition qui aurait oublié la TFP à trois endroits.
- Piège : `assetYear` rend l'annuité partielle l'année de la cession ; `assetSchedule` rend l'année
  pleine. Le journal prend la première pour cette année-là et la seconde pour les autres, et un test
  vérifie que le 28 du bien cédé est repris en entier.

`npm run e2e:livres` gagne quatre étapes : les états financiers équilibrés avec le même résultat
des deux côtés, l'à-nouveau dans le grand livre de janvier, l'état de rapprochement à écart nul dès
que le relevé égale le solde pointé, et la TFP/FOPROLOS dans les barèmes et le coût d'un brut de 1 000.

## La direction du projet (15/09/2026) — `DIRECTION.md`, puis `PLAN-COMPTABLE.md`

**`DIRECTION.md` prime sur tous les autres plans.** Décisions prises avec Skander : l'objectif est
« zéro ressaisie » entre une PME qui gère dans SkanFact sans connaître la comptabilité et son
comptable qui reçoit ses écritures déjà écrites avec les pièces ; l'app entreprise **s'arrête à la
gestion** (plus aucun écran comptable n'y est ajouté ; ceux de 8.8.0 → 9.0.0 deviennent un module
`compta` désactivé par défaut ET **payant** — option `compta` portée par la clé de licence, porte
unique `optionBlock`, Écritures et le paquet restent libres — masquer, pas supprimer : le moteur
écrit le paquet ; décidé le 15/09/2026) ; le Cabinet devient **le
logiciel de comptabilité du cabinet**, complet, avec ou sans SkanFact chez le client ; le paquet reste
le pont dans les deux sens (licence et signature du client dans le manifeste, questions du cabinet
affichées sur la pièce) ; le Cabinet est **gratuit pour les dossiers sur SkanFact et trois dossiers
hors SkanFact, payant par dossier au-delà** (postes illimités, on vend des dossiers) ; le comptable de
Skander est le cabinet pilote. Les aspects techniques à traiter (licence du cabinet portée par son
empreinte, comptage des dossiers hors SkanFact, `compta.js` partagé avec test de parité des balances,
un fichier par dossier, piste d'audit, multi-poste, questions dans les deux sens, INPDP, Ordre) sont
listés au § 5 de `DIRECTION.md`, l'ordre au § 7, les questions ouvertes au § 8.

Le comptable de Skander a regardé **SkanFact Cabinet**, pas l'app entreprise, et il veut **un vrai
logiciel de comptabilité côté cabinet**, complet, au niveau de Sage/EBP/Pennylane — pas un pont. Le
plan (`PLAN-COMPTABLE.md`) confronte dix domaines (socle, saisie, imports, banque, tiers, éditions,
clôture, fiscal tunisien, cabinet, technique) à ce que le moteur de l'app entreprise sait déjà faire
et à ce que le Cabinet n'a pas, puis découpe en dix versions : **9.1.0** livres lus dans les paquets,
**9.2.0** le livre propre à chaque dossier (plan SCE complet, import du paquet EN écritures, reprise
d'ouverture), **9.3.0** la saisie au kilomètre avec brouillard/validation, **9.5.0** banque et
rapprochement automatique, **9.6.0** déclaration mensuelle tunisienne, **9.7.0** immobilisations
dégressif et stocks, **9.8.0** clôture d'exercice et états SCE, **9.9.0** collaborateurs, multi-poste, piste
d'audit, **9.10.0** révision et questions au client, **10.0.0** liasse et jeu d'exemple complet.
Décisions d'architecture : chaque dossier porte SON livre (les écritures venues d'un paquet portent leur
source et ne se modifient pas ici), le moteur d'écritures sort de `core.js` vers un module pur partagé
`src/renderer/compta.js` que `core.js` réexporte, brouillard puis validation irréversible. Règle qui ne
bouge pas : le Cabinet **n'écrit jamais** chez le client. Les questions à poser au comptable avant
chaque version sont listées dans le plan. Le lire avant de commencer une version 9.x du Cabinet.

### Ce que trois relectures extérieures ont changé au plan (15/09/2026) — `QUESTIONS.md`

`QUESTIONS.md` (~2 100 lignes, 20 sections) répond à tout ce que le projet pose comme questions ;
c'est le document de référence quand on est perdu. Trois IA extérieures l'ont relu. Ce qu'elles ont
fait bouger, et qui ne doit pas se reperdre :

- **Un paquet n'est pas signé, et ça se voit nulle part.** `sealForCabinet` ne demande que la clé
  **publique** du cabinet — celle du fichier d'appairage, que le cabinet donne à TOUS ses clients.
  Quiconque le tient peut fabriquer un paquet au nom d'une autre entreprise. Chiffrer dit « seul le
  cabinet peut lire » ; **seule une signature dit « ça vient bien de lui »**. La signature du
  manifeste par le client remonte de la **9.10.0 à la 9.2.0** : la ranger avec la révision laissait le
  trou ouvert pendant toute la période où le pilote utilise vraiment le Cabinet. Un paquet non signé
  est accepté avec « origine non prouvée », jamais en silence.
- **On mesure avant d'écrire un format, jamais après.** Le test de charge du Cabinet (50 000
  écritures) était annoncé « avant la 9.3.0 » à deux endroits et « avant de décider » à un troisième.
  Il passe **avant la 9.2.0**, qui est la version qui écrit le format. Il mesure aussi les trois
  lectures qui ouvrent **soixante fichiers** (balance consolidée, recherche globale, tableau de
  production) : le découpage par exercice règle l'écriture, pas la lecture d'ensemble.
- **La valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien.** Deux
  relectures ont proposé « seuil de retenue à la source réglable, par défaut 1 000 DT ». Refusé :
  ce serait écrire en dur une règle de droit que personne n'a confirmée, et changer en silence des
  factures justes. Défaut **0** et « À VÉRIFIER » — même principe que « aucun taux en dur » (5.0.0).
- **Un filet se réclame au moment où il protège encore.** La clé de secours du Cabinet est criée en
  rouge, mais rien n'empêche d'importer soixante paquets avant de l'exporter. Elle est demandée
  **au premier import** (9.1.0).
- **Ce qu'un client ne contrôle pas ne lui est jamais facturé.** Un cabinet ne paie pas parce que son
  client a oublié de renouveler : **douze mois** de grâce (c'était 60 jours), affichés sur le dossier.
- **Les démarches passent avant le code quand elles bloquent la vente.** La signature de code est
  requalifiée de « le jour où ça vend » à **« avant la première vente »** : un expert-comptable ne
  clique pas sur « Exécuter quand même ». Avec le dépôt de la marque, l'INPDP, les conditions de
  vente, le 404 du téléchargement Cabinet et la page unique : six choses, zéro ligne de code.
- **Tout CSS neuf s'écrit en propriétés logiques** (`padding-inline-start`, `text-align: end`).
  Mesuré : 93 déclarations physiques dans tout le projet, zéro logique. Deux heures aujourd'hui, un
  chantier dans deux ans — c'est ce qui garde la porte de l'arabe ouverte sans rien promettre.
- **Refusé, avec les raisons, pour ne pas le rediscuter** : remplacer l'impression PDF par une
  bibliothèque (le reproche « le CSS d'impression est instable entre les OS » est faux ici —
  Electron embarque SON Chromium, c'est la raison du choix, et `e2e:pages` imprime 161 documents) ;
  lier l'essai à l'adresse MAC (donnée personnelle, change avec la carte réseau, se falsifie en une
  commande) ; le partage de clé à seuil (Shamir) ; « choisir un seul produit » (le trait d'union
  EST le produit — mais les deux n'avancent jamais en même temps : l'app entreprise est finie et
  passe en entretien).
- **Méthode, la même que pour les deux premières relectures : vérifier avant d'intégrer.** Sur les
  trois audits, chacun portait des affirmations fausses données comme des faits — cinq dans le
  premier (accident du travail, FOPROLOS, TFP en dur, exonération de timbre, anti-rejeu : tous déjà
  dans le code), un « PostgreSQL local » inexistant dans le deuxième, et dans le troisième un
  calendrier que le document ne donne nulle part plus des chiffres de marché sans source. **Un audit
  qui invente une qualité peut inventer un défaut** : chaque constat se relit dans le code avant
  d'être retenu.
- **Quatrième relecture (sur la v4), la meilleure des quatre** — elle a reconnu ce qui était corrigé
  avant de critiquer. Retenu : des **jalons de décision** trimestriels (un jalon est un chiffre —
  démonstrations, essais, licences — et un chiffre qui manque fait du trimestre suivant un
  trimestre de vente, pas de code) ; les **seuils du test de charge** écrits avant la mesure
  (ouverture < 1 s, écriture < 100 ms, balance de 60 dossiers < 5 s, recherche < 3 s) ; **un dossier
  qui a reçu un paquet signé n'accepte plus jamais de paquet non signé** (confiance au premier
  usage, la tolérance s'éteint d'elle-même) ; **la grâce de douze mois ne suit qu'une licence
  PAYÉE** — après un essai non converti le dossier compte dès sa fin, sinon « avoir essayé »
  deviendrait moins cher que « jamais essayé » (trou de ma règle de la veille) ; l'**export de la
  base de la console** avant la première vente (`GET /v1/admin/export`, rangé dans `~/.skanfact/`,
  réclamé par « À faire » à 30 jours) ; le relecteur de chaque version **nommé** (une autre session
  d'IA, limite assumée) ; les versions d'entretien **numérotées** (9.4.3 — 9.4.1 et 9.4.2 ont été prises par deux entretiens non prévus —, 9.6.1, 9.9.1) ; le
  `.skanclose` quand le client n'est pas à jour (**le cabinet clôture quand même**, le fichier
  attend et porte un PDF) ; le **pli scellé** décrit (fichier chez l'un, mot de passe chez l'autre,
  deux supports, rejoué chaque année) et « Libérer tous les clients… » (clés à vie en lot, derrière
  le passe-droit éditeur). Refusé : un tarif réduit à vie après la grâce (créerait une catégorie que
  le cabinet aurait intérêt à fabriquer). Faux dans cet audit : « plus de 3 000 lignes » (2 536),
  « à six mois on vend à dix clients » lu comme une promesse (c'est un scénario conditionnel), « la
  plateforme collecte déjà » (elle n'est pas en production).
- **Chiffres de marché, enfin sourcés** : INS 2024, 836 808 entreprises privées dont 87 % sans
  salarié → ~107 000 avec au moins un salarié, notre sous-ensemble. Le nombre d'inscrits à l'OECT
  n'est pas publié comme total (annuaire alphabétique à compter).
- **Les questions que le document ne posait pas**, et qui sont les plus importantes : combien
  d'utilisateurs aujourd'hui (trois, aucun payant), combien de temps Skander peut tenir sans revenus
  (c'est cette réponse qui décide de l'ordre du travail), ce qui se passe s'il est absent six mois
  (**personne d'autre ne peut émettre une licence** : clé privée et secret d'administration en un
  seul endroit → un pli scellé à poser avant les dix premiers clients), et qui répond d'une erreur
  de calcul chez un client sans comptable.

### Le plan d'exécution — `PLAN-DEVELOPPEMENT.md` (15/09/2026)

Le document qui **orchestre** sans redire : l'état des lieux vérifié dans le dépôt, les **jalons de
décision** (J0 15/10/2026 → J4, un jalon est un chiffre, la règle d'arrêt), les onze phases avec
durées « construction » et « réaliste » (× 2), le chemin critique et ses cinq goulots, les tâches
non-code chiffrées, le tableau de bord des 26 premières semaines (S1 = 14/09/2026, deux colonnes
Skander / Claude), les décisions de la semaine, le hors-périmètre, et « ce que je n'ai pas pu
vérifier ». Il se réécrit en S26 sur les faits. Quand il contredit `DIRECTION.md`, `DIRECTION.md`
fait foi ; le contenu de chaque version reste dans `QUESTIONS.md` § 16.

### L'inventaire des versions — `VERSIONS-A-VENIR.md` (15/09/2026)

La liste de **tout ce qui reste à faire**, version par version, de la 9.1.0 à la 10.0.0 : un tableau
récapitulatif (version → titre → nombre de fonctionnalités → niveau de spec → durée construction et
réaliste), puis une section par version avec ses fonctionnalités numérotées `F-<version>-<nn>`,
citables dans un commit. **171 fonctionnalités** sur les treize versions principales, **179** avec
les trois versions d'entretien, ≈ 104 jours de construction et ≈ 228 jours réalistes. **Trois
niveaux de spec, définis une seule fois dans ce document** et cités par le cahier : *Complète*
(9.1.0, 9.1.1, 9.2.0 — écrites dans le cahier, 58 fonctionnalités, 34 %), *Intention* (un écran
réservé dans la Partie 15 du cahier avec son tableau Décidé / À décider, 102, 60 %), *Esquisse*
(10.0.0 seule, 11, 6 %). Chaque section dit aussi ce qui n'y est **pas**, ce qui la prouve, ce qui
la **bloque**, ce qui reste à décider et **qui** tranche (comptable, Skander, mesure). Une dernière
partie liste ce qui viendra **au-delà de la 10.0.0**, sans numéro, avec le déclencheur de chacun. Ce
document n'est ni une spécification (`CAHIER-DES-CHARGES.md`) ni un calendrier
(`PLAN-DEVELOPPEMENT.md`) : c'est un inventaire, et il se relit à chaque version publiée.

**v2 (16/09/2026) — la renumérotation, appliquée à tout le dépôt.** La règle du projet veut que le
troisième chiffre soit réservé aux correctifs : la licence du Cabinet ajoute des fonctionnalités,
elle est donc **9.4.0** (et non 9.3.x / P 0.3), l'entretien qui la suit **9.4.1** — devenu **9.4.3** le 17/09/2026, deux entretiens non prévus ayant pris les numéros —, et tout ce qui
suivait décale d'un cran — banque **9.5.0**, déclaration **9.6.0**, immobilisations **9.7.0**,
clôture **9.8.0**, collaborateurs **9.9.0**, révision **9.10.0**, entretiens **9.6.1** et
**9.9.1** ; la 10.0.0 ne bouge pas. **281 occurrences dans sept documents**, en une seule passe
simultanée avec un garde-fou sur les versions livrées et stables — renuméroter un seul document
aurait fabriqué la divergence que le projet combat depuis la 6.8.0. Les identifiants
`SPEC-UI-CAB-0nn` n'ont **pas** été renumérotés (un identifiant qu'on renumérote ne sert plus à
rien) : leur dizaine groupe les écrans d'une version, elle ne nomme plus son numéro, et la Partie 15
du cahier le dit.

**v3 (16/09/2026) — l'ordre clôture / immobilisations, tranché.** La clôture calcule ses dotations
depuis `immobilisations[]`, que la version des immobilisations est la première à remplir : sans
elle, un dossier **hors SkanFact** — le dossier payant — ne peut pas être clôturé avec ses
amortissements. Les deux versions sont **échangées** : immobilisations en **9.7.0**, clôture en
**9.8.0**. Aucune dépendance en sens inverse, et la version courte passe avant la longue. 83 numéros
dans sept documents, plus les blocs de sections et les phases 6 et 7 de `PLAN-DEVELOPPEMENT.md`.
Corrigé au passage : « quinze modules » là où la phrase décrit l'application d'aujourd'hui (elle en
porte **neuf**) — mais **pas** dans les phrases historiques de ce fichier, de `PLAN-UX.md` et du
`CHANGELOG.md`, où « quinze » compte les chantiers de la 7.0.0 ; `ROADMAP.md` s'appelle désormais
une archive, parce que son titre était « Plan des versions à venir », le même que l'autre document ;
`QUESTIONS.md` § 16 renvoie à `VERSIONS-A-VENIR.md` pour les durées. **Refusé** : découper
`PLAN-CABINET.md` (deux des quatre phrases reprochées sont déjà barrées, les deux autres sont
vraies — « pas de serveur » parle du transport des paquets, pas des licences) et écrire un plan de
vente avant d'avoir appelé un seul cabinet. **`PAGE-UNIQUE.md` est écrit** : c'est la seule tâche
documentaire que la Phase 0 confie à Claude, et elle ne l'était pas.

### Le cahier des charges — `CAHIER-DES-CHARGES.md` (15/09/2026)

Le complément technique de `PLAN-DEVELOPPEMENT.md`, écrit en lisant le code au commit `d7bfc54` :
identifiants citables (`SPEC-DATA-nnn`, `SPEC-FUNC-nnn`, `SPEC-UI-*`, `SPEC-FMT-nnn`, `ERR-*`,
`TEST-<version>-nnn`, `MIG-<version>-nnn`), les schémas de tous les fichiers de données (dont
**`livre.json`**, cible de la 9.2.0, figé : un fichier par dossier et par exercice, numéro attribué à
la validation, validée jamais modifiée), la forme d'une ligne d'écriture (le contrat entre les deux
applications), les fonctions qui touchent aux chiffres avec leur ordre d'opérations, les formats du
pont (**`signature.json` signe les octets exacts de `manifeste.json`** — aucune canonicalisation),
les routes et le schéma D1, la CI et le lint à créer, le dictionnaire des messages, les tests et
les migrations des trois prochaines versions. Deux choses apprises en l'écrivant : **un module
`compta` existe déjà** (`toujours: true`, c'est la page à dix onglets) — l'option payante porte donc
sur des onglets (`compta.livres`, sous-module), jamais sur un second module du même nom ; et
`moduleOn` prend `(data, id)`, pas la société. Le document se relit à chaque version : ses parties
« par version » ne couvrent que 9.1.0, 9.1.1 et 9.2.0, exprès.

**v1 (15/09/2026, relecture extérieure à vingt points)** : avis donné point par point AVANT de
corriger, puis ajouts sans rien défaire — le catalogue passe à 60 fiches, les contrats IPC des deux
applications, les JSON exacts de chaque route (lus dans les handlers : trois cellules de la v0
étaient fausses, dont `ignorees`/`refusees`), `.skanrecover` complet, et huit parties nouvelles
(intentions 9.3.0 → 10.0.0, cinq séquences, sécurité, limites, cas limites, dix runbooks, table
« À VÉRIFIER », ce qui n'est pas spécifié). Le « Journal des versions » en fin de document dit ce
qui a été refusé et pourquoi. Ce que la relecture n'a **pas** vu, et qui comptait plus : le paquet
mensuel n'est pas signé (chiffrer ≠ signer, 9.2.0), l'**injection de formule CSV** (`toCsv` et
`toCsvLine` n'échappent que `; " \n \r` — parade 9.1.1, cellule texte commençant par `= + - @`
préfixée d'une apostrophe, colonnes montant/date jamais touchées), le double-clic sur « Émettre »
sans garde (`data-busy` + `isIssued`, 9.1.0), le disque plein sans phrase hors des mises à jour, et
deux imports de paquets simultanés dans le Cabinet. Refusés avec raison : `nextNumber` ne fait pas
de doublon après restauration (`max(pièces, compteur) + 1`), et « garder la signature en changeant
le manifeste » est impossible avec Ed25519 (l'empreinte de `signature.json` sert à la bonne phrase
et à la vérification sans clé, pas à ça).

**v1.1 (même jour, trois précisions de Skander)** : les trois listes de `livre.json` sont montrées
dans **un seul** exemple complet, à leur place (à la racine du livre, plates entre elles, chacune
imbrique ses enfants, le lien va vers l'écriture par `ecritureId` et jamais l'inverse) — la v1 les
spécifiait à part pendant que l'exemple les montrait vides et que la table disait « hors de ce
document » ; la Partie 15 est réécrite **écran par écran** (22 écrans réservés `SPEC-UI-CAB-010` →
`081`, chacun avec son tableau Décidé / À décider et qui tranche : comptable, Skander, mesure) ;
la Partie 20 ne garde que les quatre **scénarios de reprise** (SCN-001 → 004) — un runbook dit ce
que l'opérateur fait, un cahier ce que le logiciel doit faire — et les deux runbooks de la
plateforme (mise en production, retrait de `srv-1`) vivent dans `PLAN-PLATEFORME.md` § 18, les
quatre autres là où ils étaient déjà (`CLAUDE.md`, `worker/README.md`, `QUESTIONS.md` § 18).

### 9.1.0 — L'outillage, et `compta.js` partagé par les deux applications

Le socle que la 9.2.0 attend, et l'outillage d'un logiciel qu'on vend. **`src/renderer/compta.js`**
(SPEC-FUNC-100) : douze fonctions pures, aucune dépendance — pas même core.js. La règle qui décide
du découpage et qui ne doit pas bouger : **une fonction qui prend `data` reste dans core.js ; une
fonction qui prend des LIGNES vit dans compta.js.** C'est ce qui rend le module utile au Cabinet,
qui n'a pas de `data` mais des lignes lues dans les paquets. `round3` y est redéfini à l'identique
plutôt qu'importé, et un test compare les deux corps caractère par caractère. Le test qui compte est
celui de **parité** : la balance calculée par le cabinet sur les écritures relues dans le CSV du
paquet est identique, au millime, à celle que l'entreprise calcule sur ses pièces, sur les 24 mois
du jeu d'exemple. Sans lui, le comptable et son client auraient deux balances et aucun moyen de
savoir laquelle croire.

Règles apprises, à ne pas recasser :

- **Le lint attrape en deux secondes ce qui a coûté des sessions entières.** `eslint.config.js`,
  format plat, zéro règle de style — un lint qui crie sur mille lignes de formatage cesse d'être lu,
  et emmène avec lui les dix erreurs qui comptaient. Ce qu'il tient : `no-undef` (la variable d'une
  autre route, 7.20.0 ; la fonction d'un autre module, 7.22.0), `no-dupe-keys`, et surtout les
  **trois fautes de date de la 5.2.3** — `new Date(y, m, d)`, `getDay()`, `setDate()` — en ERREUR,
  avec le renvoi à CLAUDE.md dans le message. Il a trouvé deux choses le jour même : une clé d'aide
  en double qui en écrasait une autre depuis huit versions, et `C.canalDe` appelé dans
  `src/cabinet/main.js`, qui ne charge pas core.js.
- **Deux bulles ne peuvent pas porter la même clé.** `lic.offre` était déclarée deux fois dans
  `guide.js` : un objet littéral ne s'en plaint pas, la seconde écrase la première **en silence**,
  et le test qui exige que chaque clé posée dans l'interface existe passait — la clé existait, seul
  son texte n'était plus le bon. Un client qui cliquait « Offre » dans ses Paramètres lisait depuis
  la 8.2.0 une explication de facturation au prorata écrite pour l'éditeur.
- **Une exception de l'interface laisse une trace.** `error` ET `unhandledrejection` — les deux, car
  une promesse rejetée ne passe pas par `error` et c'est le cas le plus courant ici. Posés **avant**
  la séquence de démarrage, comme le chien de garde (6.5.0) : une exception levée pendant cette
  séquence laisse l'écran blanc, et c'est justement celle qu'un garde-fou installé plus bas ne
  verrait pas. Il n'affiche **rien** et ne recharge **rien** : une erreur d'interface n'est pas
  toujours visible pour l'utilisateur, et une application qui annonce une panne qui n'en est pas une
  apprend à cliquer sans lire.
- **Un journal se borne AVANT d'ouvrir un robinet dessus.** `main.log` grossissait sans limite ; le
  garde-fou ci-dessus change l'échelle. Vingt erreurs par minute au maximum (les tuées sont comptées
  et **dites**, sinon le journal laisse croire que l'application s'est calmée alors qu'elle brûlait)
  et UNE rotation à 2 Mo. Au passage, la sauvegarde du cabinet appendait **directement** dans
  `main.log` : la seule écriture volumineuse de l'application aurait échappé à la borne qu'on venait
  de poser. Un test interdit désormais toute écriture qui contourne `logToFile`.
- **On mesure avant d'écrire un format, jamais après.** `npm run charge` (SPEC-OUT-006) fabrique
  50 000 lignes, un portefeuille de 60 dossiers (345 001 lignes, 97 Mo), et mesure le VRAI chemin —
  chiffré, comme le sera `livre.json`. Verdict : ouverture 159 ms (seuil 1 000), balance 1 291 ms
  (seuil 5 000), recherche 1 040 ms (seuil 3 000), **écriture 147 ms pour un seuil de 100**. Le
  script ne se contente pas de le dire, il **mesure chaque levier** : j'aurais parié sur le découpage
  par mois, c'est le **corps binaire au lieu de base64** qui pèse le plus lourd pour le moins de
  travail (79 ms, 46 % de gagné, et il ne change ni la forme du livre ni aucun appelant). C'est la
  leçon de la 6.1.0 jamais portée à `cabstore`, parce qu'elle ne coûtait rien sur un petit fichier
  d'état. Décision consignée dans SPEC-DATA-005 : la 9.2.0 écrira un corps binaire.
- **Un banc d'essai dont les données mentent fait mentir le verdict**, et c'est le pire cas : il a
  l'air de fonctionner. Mon générateur était un LCG (`g * 1103515245 + 12345`) avec `graine % max` :
  les bits de POIDS FAIBLE d'un LCG ont une période très courte, donc `% 12` ne rendait que **six
  mois sur douze** (l'un d'eux à 18 écritures sur 16 667) et `% 300` que 90 tiers sur 300. Mulberry32
  à la place — et le script **vérifie son propre jeu** avant de mesurer quoi que ce soit.
- **Une CI existe pour la plateforme que personne ne teste.** Linux ET Windows, `fail-fast: false`
  délibérément : quand un test tombe, savoir s'il tombe des deux côtés ou d'un seul est
  l'information qui désigne la cause (règle 5.2.3). C'est la 7.21.x qui la motive. Pas d'e2e
  Electron : quarante-deux parcours sous `xvfb` à chaque poussée videraient le quota en une matinée
  (6.7.2). Seul `e2e:pages` y est, parce qu'il n'ouvre pas Electron.
- **Une application d'essai ne doit ni publier, ni se mettre à jour, ni écraser la vraie.**
  `essai.yml` : `productName` et `appId` suffixés (sinon l'essai EST la vraie application pour le
  système — l'accident de la 6.7.3), `--publish never`, et surtout **`updateBase` vide** : le plus
  facile à oublier, parce qu'il ne se voit qu'après coup — une application d'essai qui se met à jour
  redevient la version publiée au premier redémarrage, et la personne ne teste plus rien.
- **L'index de CLAUDE.md est tenu par un test.** Ce fichier est rangé par version ; l'index le range
  par thème. Un renvoi mort y serait exactement le défaut que le projet combat (« une phrase
  affichée que rien ne tient est un bug », 7.3.0) — en pire, puisque c'est moi qui le lis à chaque
  session. Le test vérifie que chaque version citée nomme une section qui existe, que les commandes
  annoncées existent dans `package.json`, que le nombre de parcours e2e est le bon, et que chaque
  document cité est sur le disque. Il a trouvé cinq renvois morts à sa première passe — dont deux
  étaient une faute du test lui-même, trop étroit : **un test trop étroit accuse du code juste, ce
  qui est pire que pas de test.**
- **Trois assertions retournées** (« quand une règle change, c'est le test qui se relit en
  premier ») : le canal du Cabinet écrit en dur, `allowDowngrade = false` au caractère près — que
  l'app entreprise ne passait que par accident, grâce à une seconde ligne ailleurs — et la borne du
  journal. Et une faiblesse trouvée dans mon propre test : un `||` le rendait incapable de tomber
  sur la sévérité des règles de date, puisque le branchement suffisait à le satisfaire (le piège de
  précédence de la 7.33.0, deux fois).

### 9.1.1 — Les corrections fiscales

Quatre chiffres qui partent chez un tiers, et qui traînaient sans version. La règle qui les tient
tous : **la valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien.**

- **L'injection de formule CSV**, le vrai trou, trouvé en relisant le cahier et pas par un test. Un
  tableur EXÉCUTE une cellule qui commence par `=`, `+`, `-` ou `@`, et le libellé d'une ligne de
  facture partait tel quel dans le journal envoyé au comptable. `compta.csvDangereux` est
  **stricte** et ne devine pas ce qui « ressemble à un nombre » : c'est l'APPELANT qui sait.
  `core.toCsv` a des types (les colonnes `money`/`date` ne la voient jamais, `-12,500` reste un
  montant) ; `cabcore.toCsvLine` n'en a pas, d'où `estNombreCsv` **là et là seulement**. Le
  quatrième export — le portefeuille du cabinet — avait sa propre version sans parade : une seule
  porte désormais. Deux corps identiques dans deux fichiers, un test l'exige (motif `round3`).
- **Le timbre par client** (`client.stampExempt`) se COPIE à la création (`applyClientDefaults`),
  **dans les deux sens** et seulement sur une facture : poser `false` sans jamais reposer `true`
  laisserait un brouillon dont on change le client sans timbre, en silence. Et la case du DOM se
  met à jour avec la donnée — sinon le prochain `formValues` relit la case restée en arrière et
  écrase ce qu'on vient de calculer. `computeTotals` ne relit JAMAIS le client : une pièce émise ne
  bouge plus (règle 7.1.1, un cran plus haut).
- **Le seuil de retenue vaut 0** (= aucun seuil). Réglé, il AVERTIT dans `issueWarnings`, jamais un
  refus, et il ne se lit qu'à **un seul endroit** de l'interface. Le seul cas que la garde protège
  vraiment est le seuil **négatif** : `Number('') === 0` rend l'assertion évidente inutile (8.3.0).
- **La TFP est proposée par métier, et aucun métier n'en porte** : le test TOMBE si quelqu'un écrit
  un `tfp:` dans `ACTIVITIES` sans la réponse du comptable. `tfpTouche` (posé à l'enregistrement des
  barèmes) empêche la proposition d'écraser un taux décidé — motif `regimeTouche` (7.25.0, 7.30.0).
- **`docs/e-facture-controle.md`** : champ par champ, ce que le modèle porte de ce qu'un format
  officiel exigerait. Il ne construit rien ; il répond à la seule question qui compte aujourd'hui —
  les chiffres sont là, les identités sont incomplètes mais rattrapables, la signature et
  l'acheminement sont entièrement à faire.
- Piège de test : `lireApp()` RETIRE les commentaires de ligne, donc une tranche ne peut jamais
  s'ancrer sur un commentaire (8.2.0, re-rencontré). Et une assertion e2e de la 9.1.0 exigeait les
  dix onglets de Comptabilité alors que trois sont masqués depuis : **quand une règle change, c'est
  le test qui se relit en premier** (sixième occurrence).

### 9.2.0 — Le livre du dossier, et le paquet signé

La plus grosse version du chantier Cabinet. `compta.js` gagne le **livre** (pur, testable sans
Electron) ; `cabstore` l'écrit sur le disque ; le paquet mensuel est enfin **signé**.

**Les trois règles du livre, qui ne bougent plus :**

1. **Une écriture VALIDÉE ne se modifie jamais.** On la contre-passe — une écriture miroir, datée du
   jour où l'on corrige, **jamais** de celle de l'écriture d'origine : corriger en avril une
   écriture de janvier dans un janvier déjà déclaré changerait la TVA de janvier en silence (6.0.0).
2. **Le numéro naît à la VALIDATION**, par ordre de validation et pas de date, et le contrôle passe
   AVANT l'attribution — sinon chaque refus trouerait la numérotation (le défaut de `nextNumber`,
   6.0.0). C'est la différence avec la numérotation *déduite* de la 8.9.0 : là-bas un numéro bougeait
   quand on insérait une pièce en arrière ; ici il est écrit, et il ne bouge plus.
3. **Le paquet du client ne gagne jamais contre le cabinet.** Un mois renvoyé remplace les
   brouillards et ne touche AUCUNE validée : on calcule l'écart, on l'affiche, le comptable tranche.
   Écraser son travail parce que le client a rouvert son mois serait la pire chose que ce logiciel
   puisse faire.

**Chiffrer n'est pas signer** — le trou que trois relectures extérieures ont pointé, et le plus
grave du projet. `sealForCabinet` ne demande que la clé PUBLIQUE du cabinet, celle qu'il donne à
TOUS ses clients : quiconque la tenait pouvait fabriquer un paquet chiffré au nom d'une autre
entreprise, et le cabinet l'importait sans un mot.

- On signe les **octets exacts** de `manifeste.json` tels qu'ils partent dans le ZIP. Aucune
  canonicalisation, aucun RFC 8785 : re-sérialiser pour signer, c'est signer autre chose que ce
  qu'on envoie, et c'est l'écart entre les deux qui fait les failles de signature.
- La paire est **Ed25519** (signature), pas X25519 (échange de clés) — deux courbes pour deux
  métiers, et Node refuse la seconde. Elle vit dans `<dossier>/cle-client.json` (0600), créée au
  PREMIER envoi, **hors** de `skanfact-data.json` : une clé privée qui voyagerait dans un export ou
  dans le paquet ne serait plus une clé privée.
- `cabcore.verdictOrigine` porte la RÈGLE, pure et testée. Quatre cas : pas de signature et pas de
  clé épinglée → accepté « origine non prouvée » (refuser couperait tout le portefeuille le jour de
  la mise à jour) ; pas de signature mais clé épinglée → **refusé**, donc la tolérance s'éteint
  d'elle-même **client par client**, sans date butoir ; signature valable et pas de clé → on
  épingle ; autre clé → refusé en nommant les DEUX empreintes, et la reprise passe par l'empreinte
  dictée au téléphone.
- L'ordre sha256-puis-signature est fixé pour la **phrase**, pas pour la sécurité : Ed25519 porte
  sur les octets, donc un manifeste modifié fait échouer `verify` de toute façon — mais « modifié
  après l'envoi » et « signature inconnue » ne demandent pas le même coup de téléphone.
- Les quatre champs épinglés entrent dans `migrateDossier` : absent de cette liste, un champ est
  jeté au prochain démarrage et la vérification se désarme **en silence**. C'est le défaut de
  `matricule` de la 6.8.0, appliqué cette fois à un champ de sécurité.
- Un échec de signature ne fait PAS échouer l'envoi : priver quelqu'un de son paquet mensuel pour
  une clé qu'on n'a pas su écrire serait pire que le paquet non signé.

**Le fichier :** `livres/<dossier>/livre-<AAAA>.json`, **corps binaire** (décidé par `npm run charge`
AVANT d'écrire une ligne : 141 ms en base64 pour un seuil de 100, 57 ms en binaire), **entête en
clair** (client, exercice, nombre d'écritures — rien du contenu). Le verrou **périme à 24 h** : un
poste qui plante laisserait sinon un dossier verrouillé pour toujours, pire que le risque qu'il
évite. La copie externe emporte **toujours** les livres, avec ou sans les paquets — un paquet perdu
se redemande au client, un livre perdu non. Une génération précédente est gardée à chaque écriture ;
trente feraient 2,9 Go sur un portefeuille de soixante dossiers.

**UNE seule porte d'écriture** (`ecrireLeLivre` dans `src/cabinet/main.js`) : verrou, écriture et
trace dans le même mouvement. Deux portes, c'est la garantie qu'un jour l'une oubliera l'audit — et
un livre comptable sans piste d'audit ne vaut rien devant un contrôle.

Autres règles apprises :

- **Le cas qui compte n'est pas le fichier brouillé** (le déchiffrement échoue tout seul) mais celui
  qui se DÉCHIFFRE sans être un livre : c'est `isValidLivre` qui l'attrape, et le test le fabrique
  avec la clé de la session plutôt qu'en imitant le format.
- `lignesDuLivre` rend le contrat d'`entreesDepuisCsv` **au champ près** (`account`, `label`) : les
  quatre lectures de la 9.1.0 servent telles quelles sur le livre. Deux contrats voisins mais
  différents auraient obligé à réécrire la balance pour le cabinet — exactement ce que `compta.js`
  existe pour éviter.
- `entreesDepuisCsv` prend le **TEXTE** du CSV, pas des lignes découpées (c'est elle qui déduit le
  séparateur). Lui passer un tableau donnait « 0 écriture ajoutée » sur un paquet qui en a douze,
  sans erreur nulle part. C'est l'e2e qui l'a vu.
- **Relire un état à CHAQUE affichage d'une page est un excès qui fabrique un défaut** : le redessin
  asynchrone de `#c-livres` détachait le menu de ligne ouvert ailleurs, et le clic suivant tombait
  dans le vide (piège 7.0.0). On relit quand le couple (dossier, exercice) change ; les gestes qui
  modifient le livre reposent l'état eux-mêmes.
- Un bloc écrit dans `el.innerHTML` puis **écrasé** par le rendu final ne s'affiche jamais. Aucune
  erreur, aucune console : il faut ouvrir l'application.
- Le second exemplaire du contrôle « le cabinet n'écrit jamais chez un client » n'avait **pas** reçu
  le nettoyage des commentaires de la 6.8.0 : il échouait sur un commentaire qui cite les deux
  appels interdits pour expliquer la règle. **Un test trop étroit accuse du code juste.**
- Piège de ma propre méthode, deux fois : un `cp` de sauvegarde par **basename** écrase
  `src/cabinet/main.js` avec `src/main.js` (même nom de fichier) ; et `npm test | tail -2 && git
  commit` masque le code de sortie du test — un commit est parti avec un test rouge. **Un test qu'on
  lit au lieu de le laisser décider ne protège de rien.**

### 9.2.1 — La désignation cherche dans le catalogue

Skander, sur un achat en destination « stock » : « au lieu de me dire cette phrase et que je cherche
manuellement comment ça s'écrit exactement, proposer une recherche directement dans le nom, comme
ça on n'a pas à réécrire mais plutôt sélectionner ». L'article existait ; l'éditeur reprochait sans
offrir — le défaut de la 7.20.0, un cran plus loin : le sélecteur de catalogue AJOUTAIT une ligne,
il ne réparait pas celle qu'on venait de taper.

- **`suggererCatalogue(input, o)`** (app.js) : un champ texte qui reste libre, et une liste qui
  n'apparaît que pendant la frappe. Ce n'est pas `combo()` — un combo porte une valeur, ici la
  valeur EST le texte. Choisir pose l'article sur la ligne existante (`poserArticle`) et la rattache
  par `itemId` : c'est lui que lit `itemOfLine`, quelle que soit l'orthographe retouchée ensuite.
- **La recherche ignore les accents ET les espaces** (`sansAccents`, comparaison « serrée ») : sans
  ça, « memoire 16go » ne trouvait pas « Mémoire 16 Go » — le cas exact qui a fait écrire la liste.
- **Les DEUX éditeurs** la branchent : le stock entre par l'achat et sort par la vente, par la même
  règle, et le coût qui fait la marge se lit sur l'article. Un document verrouillé ne propose rien.
- **L'avertissement porte le bouton qui débloque** (`data-orph` → `_ouvrirSuggestions`), et il juge
  la ligne SAISIE (`p.lines[i]`, qui porte `itemId`), pas la ligne calculée : une ligne rattachée
  puis retouchée ne doit pas être accusée.
- **Créer depuis la liste** passe par `catalogForm(articleNeuf({ label, tracked }))` : l'article
  vierge vit en un endroit, sinon un champ ajouté demain manquerait aux créations à la volée.
- `.sugg-host` entre dans `RowMenu.SURFACES` : le champ ET sa liste, sinon replacer le curseur dans
  le champ refermait la liste (piège 7.28.0).
- Piège d'outil : un `̀` écrit dans un fichier peut arriver en **caractère réel** — un intervalle
  `[̀-ͯ]` que personne ne peut relire, et qu'un éditeur qui normalise mangerait. Vérifier les octets
  après coup, et garder l'échappement.

`e2e:fiches` gagne l'étape : tapé sans accent, l'article se propose et se choisit ; une désignation
inconnue en stock porte le bouton, qui ouvre la liste, qui crée la fiche préremplie et suivie.

### 9.2.2 — La fiche d'un dossier en trois onglets, et l'exemple qui livre de vrais paquets

Skander, capture à l'appui : « le dossier est mal fait et pas pratique, tout est mis dans la même
page », puis « ton jeu d'exemple ne montre pas le vrai écran avec l'exercice ouvert ». Les deux
tenaient ensemble : l'exemple **cachait** le défaut.

- **Mesurer avant, sur le bon instrument.** Sur l'exemple, la fiche faisait 1 741 px et six
  panneaux. Sur le vrai dossier de Skander, le seul bloc Comptabilité (15 pièces, 56 lignes) était
  une page entière posée entre les mois et les paquets. L'exemple n'avait **aucun fichier de
  paquet** — un manque connu depuis la 8.7.0 — donc « aucun paquet ne contient d'écritures » sur
  l'écran qui doit montrer un exercice ouvert. Un instrument qui sous-estime rend le diagnostic
  faux : il fallait d'abord réparer l'exemple.
- **Le Cabinet n'embarque pas `core.js`, et ne le doit pas** (l'app gratuite n'emporte pas le
  produit payant ; un test le tient). Les journaux de l'exemple sont donc **pré-calculés** par
  `scripts/exemple-cabinet.js` avec le moteur de l'app entreprise, pour une date de référence
  FIXE, et rangés dans `src/cabinet/exemple-paquets.json` (8 mois, 90 Ko). Un test exige que le
  fichier commité soit ce que le script produit : le seul aléa (les identifiants des salariés dans
  la CNSS) est remplacé par des noms stables — un identifiant interne n'a aucun sens hors de
  l'application qui l'a tiré.
- **`cabcore.rebaserPaquet` recale un gabarit sur le mois courant, pur** : dates ISO et `JJ/MM`
  glissées du même nombre de mois, jour borné au mois d'arrivée (31 août → 28 février), année des
  numéros de pièce et mois en lettres qui suivent, montants intacts. Les CSV de l'app entreprise
  écrivent `JJ/MM/AAAA` : une première version ne visait que l'ISO, et aurait laissé passer toutes
  les dates des journaux. Prouvé par son défaut. Et mon assertion « 30/09 → 31/03 » était fausse :
  le jour se GARDE, il ne recule que s'il n'existe pas.
- **L'exemple passe par la VRAIE porte** : `chargerExemple()` fabrique de vrais `.skanpack`
  (manifeste avec empreintes, scellés pour la clé de CE cabinet) et les donne à `ingest()`, comme
  un paquet reçu par mail. `demoDossiers()` ne porte plus que le scénario ; les chiffres viennent
  des écritures. Retirer l'exemple — ou recevoir un premier vrai paquet — **retire ses fichiers**.
  La page Écritures regroupe donc l'exemple, et l'assertion « Rien à regrouper » de `e2e:cabinet`
  est retournée (quand une règle change, c'est le test qui se relit en premier).
- **Trois onglets, pas quatre.** L'identité (151 px) aurait fait un onglet d'un demi-écran — ce
  que la 7.30.0 a retiré des Paramètres. Elle vit dans l'en-tête, avec l'état en une phrase
  (`d-etat`) ; ce qui n'est pas renseigné ne prend pas de place, sauf l'email et le téléphone,
  qui servent à relancer. *Suivi* (mois, relances, note), *Comptabilité* (une page à elle seule),
  *Paquets* (le tableau et le graphique de CA, qui en tire ses chiffres).
- **Les alertes restent au-dessus des onglets** (7.32.0) et portent « Voir les paquets ».
- **L'onglet vit dans l'ADRESSE** (`#/dossier/<id>/<onglet>`) : « précédent » revient dessus,
  une autre page peut y emmener, et `e2e:boucle` le prouve avec `/comptabilite`. Sans onglet dans
  l'adresse : celui où l'on était sur CE dossier, sinon Suivi — jamais celui d'un autre client (le
  garde-fou de `ficheYear`).
- **Imprimer imprime tout** : `section[data-onglet][hidden] { display: block }` sous
  `@media print`, plus spécifique que le `[hidden]` global.
- Piège d'e2e, sixième fois : trois passages de `e2e:boucle` cliquaient dans ce qui devient un
  onglet masqué (`#c-compta`, le menu d'un paquet, `#c-livres`). On clique l'onglet comme un
  comptable, ou on passe par l'adresse profonde.

### 9.3.0 — La saisie

L'écran où un comptable passe ses journées. Dans `compta.js` : `modifierEcriture`, `supprimerEcriture`,
`validerLot`, `extourner`, `chercherEcritures`, `soldeDeLignes`, `comptesQuiCorrespondent`,
`guideValide`/`ecritureDepuisGuide`, `occurrencesAGenerer`, `correspondanceValide`/`compteCorrespondant`/
`appliquerCorrespondance`, plus `premierDuMoisSuivant` et `ajouterMoisIso` (UTC pur). Dans cabcore :
`dateTapee`, `guidesDuDossier`, `correspondanceDuDossier`, `DEFAULT_SAISIE`. Onglets **Saisie** et
**Recherche** dans la comptabilité d'un dossier, onglet **Comptabilité** dans les Réglages.

La dépendance que le plan pose sur cette version — **regarder le pilote saisir une heure dans son
logiciel actuel** — n'est pas levée. C'est pour ça que tout ce qui s'apprend par les doigts est
**réglable** : les touches, le journal proposé à l'ouverture, la date complète ou le jour seul. On
change un réglage, pas une version.

Règles apprises, à ne pas recasser :

- **Le contrôle passe AVANT l'attribution du numéro, et valider un lot ne refuse jamais en bloc.**
  Les deux vont ensemble : chaque pièce d'un lot passe par `validerEcriture` une par une, donc une
  refusée au milieu de cinquante ne consomme aucun numéro. Un lot tout-ou-rien obligerait à sortir la
  pièce fautive d'un mois de saisie avant de pouvoir valider les quarante-neuf autres — et le
  comptable finirait par ne plus valider du tout. Les refusées sont NOMMÉES : « 12 validées » en
  avalant trois refus serait pire qu'un refus global.
- **Une extourne n'est pas une contre-passation**, et la différence est comptable, pas cosmétique :
  l'écriture d'origine reste `validee`, dans son mois, avec son numéro. La marquer `contrepassee` la
  ferait disparaître du mois où elle a été passée, et le résultat de ce mois-là serait faux. Une
  extourne de décembre tombe au 1er janvier, donc dans l'exercice SUIVANT : on REFUSE en le disant,
  plutôt que de la ranger dans le livre de décembre — ça fausserait les deux.
- **L'écran ne calcule jamais le solde lui-même.** `soldeDeLignes` vit dans `compta.js`, et c'est lui
  que `Tab` appelle : deux façons d'arrondir finiraient par diverger, et une pièce « soldée » à
  l'écran serait refusée à l'enregistrement. Le solde posé **change de colonne**, il ne garde pas un
  signe (règle 6.3.0).
- **Une grille ne se redessine pas à la frappe** (défaut 7.17.0) : on met à jour la donnée, puis le
  SEUL élément qui en dépend (`#sa-solde`). Un test relit le gestionnaire `oninput` et interdit qu'il
  contienne `drawLivres`. Le redessin n'a lieu qu'à l'ajout ou au retrait d'une ligne, et il replace
  le curseur.
- **Tab ne peut pas servir de chaîne dans l'en-tête** : chaque libellé porte sa bulle « i », qui est
  un vrai `<button>` et prend donc le focus au passage. Les sortir de l'ordre de tabulation rendrait
  l'explication inatteignable au clavier — ce que ce projet s'interdit depuis la 7.0.0. On AJOUTE un
  chemin au lieu d'en couper un : Entrée descend de champ en champ jusqu'à la première ligne. Trouvé
  par `e2e:saisie`, invisible autrement — le libellé n'était simplement jamais tapé.
- **Un guide préremplit, il n'écrit pas.** Un abonnement génère **en brouillard**, jamais une validée
  d'office : une écriture que personne n'a regardée ne doit pas engager la signature du comptable.
  Rejouer la génération ne double rien (`faites` porte les mois déjà générés — même règle que
  `importerPaquet`). Et le taux d'un guide vient du guide, jamais du code (règle 5.0.0).
- **Ni les guides ni les abonnements ne vivent dans `livre.json`** : son format est FIGÉ
  (SPEC-DATA-005). Les guides au niveau du cabinet (on les écrit une fois pour soixante clients), les
  abonnements sur le dossier (un loyer appartient à un client). Un guide du dossier qui porte le même
  `id` REMPLACE celui du cabinet — surcharger n'est pas doubler.
- **La correspondance la plus PRÉCISE gagne** (411001 avant 411), et un compte n'a jamais deux
  réponses. Sans cette règle, une ligne « 4 → 5 » écraserait tout selon l'ordre du tableau et
  personne ne saurait laquelle a servi. Elle traduit à l'import et à l'export, **jamais** en
  réécrivant une validée : celle-ci porte le compte sous lequel elle a été validée.
- **Un justificatif est COPIÉ, et son chemin est RELATIF.** Le fichier du comptable est sur son
  Bureau ou dans un mail téléchargé — deux endroits qui auront disparu bien avant l'écriture qu'ils
  justifient. Un chemin relatif suit le dossier quand on change d'ordinateur, et part avec lui quand
  on l'efface. Une validée peut recevoir son justificatif (joindre un scan ne change aucun chiffre) :
  c'est le seul de ses champs qui bouge, et l'audit le nomme.
- **Le moteur ne trace pas ces gestes, l'appelant si.** `compta.js` laisse `ecrireLeLivre` (la porte
  unique, 9.2.0) écrire la piste d'audit. Deux endroits qui tracent le même geste écrivent la piste
  en double, et une piste d'audit en double ne se lit plus. Un test relit les six handlers neufs et
  exige qu'aucun n'appelle `getStore().ecrireLivre` directement.
- **Les quatre champs neufs du dossier entrent dans `migrateDossier`** (`abonnements`, `guides`,
  `correspondance`, `dernierJournal`) : absent de cette liste, un champ est jeté au prochain
  chargement, en silence. C'est le défaut de `matricule` de la 6.8.0 — ici, un abonnement perdu,
  c'est un loyer qui cesse d'être écrit sans que personne ne le remarque avant le bilan.
- **Une cellule de grille d'édition n'est pas une `row-actions`.** Le « ✕ » qui retire une ligne
  qu'on est en train de taper est juste ; le test de la 7.29.0, qui interdit un pictogramme en fin de
  ligne de LISTE, visait autre chose. D'où `.sa-sup`, et la distinction écrite dans la feuille.
- **Un test écrit contre l'état du jour décrit cet état** (septième occurrence) : `e2e:boucle`
  exigeait qu'« une écriture ne se supprime JAMAIS depuis une liste ». C'était vrai en 9.2.0, où rien
  ne se supprimait. La RÈGLE est qu'une **validée** ne se supprime jamais ; un brouillard, si — c'est
  toute sa raison d'être. L'assertion a été **retournée**, pas retirée, et doublée de son autre
  moitié : le pont lui-même refuse de modifier ou supprimer une validée.
- Piège d'e2e rencontré : un parcours qui agit par le PONT laisse l'écran en retard, parce que les
  gestes du renderer reposent `s.livre` eux-mêmes. Rouvrir l'application (`win.reload()`) est la
  parade honnête — et elle prouve en plus que tout est sur le DISQUE, pas seulement dans la mémoire
  d'un écran. Au passage : `#app` existe toujours dans le document, simplement masqué ; on attend
  qu'un écran soit VISIBLE, jamais qu'un sélecteur existe.
- Piège de test rencontré : ma preuve de la remontée de chemin (`../..`) ne tombait pas, parce que le
  fichier visé n'existait pas et que c'est la garde « fichier absent » qui répondait. On vise un
  fichier qui existe VRAIMENT — et il faut retirer LES DEUX gardes pour retrouver le défaut, comme
  pour le fil d'Ariane de la 7.27.0.

Le test qui compte est `npm run e2e:saisie` : il tape une pièce entière **au clavier**, vérifie que
Tab solde, enregistre en brouillard sans numéro, valide, se voit refuser la modification ET la
suppression, valide un lot dont la pièce fautive est au MILIEU et vérifie que la suite des numéros
reste 1..n, extourne, rouvre l'application, cherche par montant, écrit un guide et s'en sert.

### 9.4.0 — La licence du Cabinet

On vend des **dossiers**, jamais des postes. Dans `src/licence.js` : `CABINET_GRATUITS` (3),
`licenceCabinet`, `pastille`, `requestMailCabinet`, et le refus croisé dans `licenceState`. Dans
cabcore : `dossierFacturable`, `comptageDossiers`, `licenceDuPaquet`, `GRACE_MOIS`, `DORMANT_MOIS`.
Dans `src/cabinet/main.js` : `licenceCabinetStatus`, `licenceBlockCab` (la porte unique),
`noterValidation`. Panneau **Réglages → Mon cabinet → Licence**, bandeau à trois tons, ligne
« À faire ». `src/licence.js` et les clés publiques entrent dans `build/cabinet.config.js`.

La question qui bloque la VENTE — l'avis de l'Ordre, et les prix — n'est pas levée. Le code, lui,
n'attendait pas : c'est écrit ainsi dans le plan.

Règles apprises, à ne pas recasser :

- **Deux règles justes se combinaient en un trou.** Une licence de cabinet n'a pas de matricule (son
  sujet est l'empreinte) ; et `memeMatricule` laisse passer un côté vide, parce qu'« on ne punit pas
  qui n'a pas rempli sa fiche » (7.33.0). Ensemble : une clé Cabinet déverrouillait TOUT chez
  n'importe quelle entreprise. Le garde-fou est le `type`, et il est **symétrique** — une clé
  d'entreprise ne vaut rien dans le Cabinet non plus. Le cas qui le prouve n'est pas la clé sans
  empreinte (la comparaison d'empreinte la refuse déjà, correctif double, 7.27.0) mais la clé d'un
  client **parrainé par ce cabinet** : elle porte légitimement son empreinte, et seul le type la
  distingue.
- **Le verrou ferme la VALIDATION, et rien d'autre.** Lire, importer, saisir, exporter, relancer :
  toujours ouverts. Un test relit `main.js` et vérifie les deux sens — la porte sur les quatre
  gestes qui valident, et son ABSENCE sur sept handlers qui lisent. Sans la seconde moitié, le test
  laisserait passer une porte posée partout, c'est-à-dire des données en otage (6.4.0) — et ici ce
  sont les pièces de soixante entreprises.
- **Le doute profite au cabinet.** Un paquet d'avant la 9.4.0 ne dit pas si son client a une
  licence : le dossier **ne compte pas**, et l'écran dit pourquoi. On ne fait pas payer quelqu'un
  pour ce qu'on n'a pas su lire.
- **La grâce de douze mois ne suit qu'une licence PAYÉE.** Sans ce garde-fou, « avoir essayé »
  coûterait moins cher au cabinet que « n'avoir jamais essayé », et on fabriquerait exactement la
  catégorie qu'on veut éviter. D'où `payee` dans le manifeste — la PRÉSENCE d'une clé, jamais la clé.
- **Un chiffre qui décide d'une facture doit pouvoir s'expliquer.** `comptageDossiers` nomme chaque
  dossier avec sa raison, et groupe les raisons de ceux qui ne comptent pas. « 7 dossiers comptés »
  sans la liste, c'est le genre de chiffre qu'on ne croit pas — et on aurait raison.
- **L'empreinte du cabinet n'est PAS rangée dans l'état : elle se calcule.** `safeState()` l'ajoute
  pour l'écran, donc `state.cabinet.fingerprint` vaut `undefined` côté processus principal. Une
  empreinte vide désarme la comparaison, et la licence d'un AUTRE cabinet passait. **Aucun test pur
  ne pouvait le voir** : le moteur, lui, rendait le bon verdict — c'est le parcours réel qui l'a
  montré. Même famille que « un champ lu mais jamais écrit » (7.3.0), vue de l'autre côté.
- **Un état lu une fois au démarrage se périme** (7.1.x, re-trouvé) : le panneau de licence relit à
  chaque affichage, parce que le compte change à chaque dossier créé, archivé ou reçu.
- **`pastille` est le jumeau EXACT de `core.pastilleLicence`**, corps comparé par un test — comme
  `round3`. Les deux applications doivent dire la même chose de la même échéance, et aucune ne peut
  charger le module de l'autre (core.js est un UMD de navigateur, licence.js a besoin de `crypto`).
- **Les deux champs de la charge signée sont en QUEUE** (`type`, `dossiersHors`). Au milieu, ils
  changeraient l'ordre des champs déjà signés, et une clé refabriquée depuis sa charge rangée en
  base ne serait plus identique à celle qu'on a envoyée — or c'est exactement ce qui permet de ne
  jamais ranger la clé elle-même (8.5.0).
- **Un test qui interdit un MOT accuse du code juste.** Ma première version exigeait que le mot
  `key` n'apparaisse pas dans ce qui part au manifeste : elle refusait `payee: !!st.key`, qui ne
  transporte pas la clé mais sa présence. On vise le danger (une sortie non booléenne), pas le mot.
- **Un test écrit contre l'état du jour, huitième occurrence** : « `src/licence.js` n'a rien à faire
  dans l'app du comptable » était vrai tant que le Cabinet n'avait pas de licence. La RÈGLE est
  « l'app gratuite n'embarque pas le PRODUIT payant » — et le code qui vérifie une signature n'est
  pas un produit : le secret n'est pas le code, c'est la clé privée (7.33.0). Le besoin se DÉDUIT
  désormais du `require`, comme les autres, et le test évalue les globs des clés publiques contre
  les deux vrais noms de fichier (le défaut de la 8.4.0).

Le test qui compte est `npm run e2e:cabinet-licence` : application ARMÉE pour de vrai (clé d'essai
embarquée par `SKANFACT_CLE_EMBARQUEE`, privée jamais sortie du dossier temporaire), trois dossiers
gratuits, cinq clients qui dépassent, la validation refusée pendant que lire / importer / saisir /
exporter restent ouverts, deux archivés qui rendent la main, trois clés refusées (autre cabinet,
client parrainé, charabia) et la bonne qui ouvre.

### 9.4.1 — La clé de réponse embarquée, et la console qui vend un cabinet

Deux moitiés d'une même chose : ce qui manquait pour que la révocation morde, et ce qui manquait à
la console pour vendre ce que la 9.4.0 avait rendu vendable.

**La clé de réponse.** `build/licences-publiques.json` porte enfin `reponse` (créée dans SkanFact
sur le Mac de Skander le 17/09/2026). Sa privée vit dans le réglage Cloudflare
`REPONSE_PRIVATE_KEY`. Sans elle, l'application ignorait TOUTE réponse du serveur — c'était le bon
défaut (8.4.0 : une réponse qu'on ne peut pas juger ne restreint rien), mais cela voulait dire
qu'aucune révocation ne s'appliquait chez personne.

- **Une clé privée qui a été VUE est brûlée**, et la règle n'a pas d'exception : celle du
  15/09/2026 avait transité par une conversation, elle a été jetée (les deux fichiers de
  `~/.skanfact/` supprimés), une paire neuve créée, le secret Cloudflare remplacé. Poser la publique
  dans le dépôt sans ce geste aurait armé une clé que quelqu'un d'autre peut imiter.
- **Une clé de réponse n'est jamais une clé de licence.** Un test exige qu'elle soit une Ed25519
  lisible, **distincte de toutes les `cles[]`** : une seule clé pour deux usages, et compromettre
  l'une emporte l'autre. Il exige aussi qu'aucun `PRIVATE KEY` ne traîne dans le fichier, et que
  `main.js` la lise bien dans `reponse.publicKey` — un champ renommé désarmerait la vérification en
  silence, exactement comme `licence-public*.json` ne couvrait pas `licences-publiques.json` (8.4.0).

**La console vend un cabinet.** La 9.4.0 avait livré deux tiers d'une vente : SkanFact Cabinet lit
une clé de cabinet, l'Éditeur de SkanFact en signe une — et la console, elle, ne connaissait que
deux offres. Trois moitiés d'une même vente, dont une seule vendait.

- **Le type est en QUEUE de charge et le reste** (`type`, `dossiersHors`) : au milieu, il changerait
  l'ordre des champs déjà signés, et une clé refabriquée depuis sa charge rangée en base ne serait
  plus identique à celle qu'on a envoyée — or c'est exactement ce qui permet de ne jamais ranger la
  clé (8.5.0). Deux colonnes de plus dans `licences` (`type`, `dossiers_hors`), NULL = entreprise.
- **Une empreinte se compare sans ses SÉPARATEURS.** La console range la forme nue
  (`3f9a2c1e…`), le cabinet lit la forme à tirets (`3F9A-2C1E-…`), et la 9.4.0 comparait
  caractère à caractère : une clé vendue par la console aurait été refusée par le cabinet qui l'a
  achetée. La clé porte donc la forme CANONIQUE (`canonEmpreinte`) et `licenceCabinet` normalise
  les deux côtés — mais retire seulement les séparateurs, jamais « tout ce qui n'est pas
  hexadécimal » : un G tapé pour un 6 doit rester une faute visible (8.1.0).
- **Aucun prix par défaut pour un dossier de cabinet** (`PRIX_CABINET_DOSSIER`, défaut 0 = le
  formulaire ne propose rien). Les tarifs du Cabinet ne sont pas fixés — l'avis de l'Ordre n'est pas
  revenu — et un chiffre écrit « pour l'exemple » devient un tarif par simple préremplissage. C'est
  la règle 9.1.1 (« la valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait
  rien ») appliquée à un prix.
- **`OFFRES['cabinet']` n'existe pas**, et c'est voulu : « cabinet » est un TYPE, rangé dans `offre`
  pour que la colonne reste renseignée. Tout `OFFRES[x].label` sur une licence de cabinet plante —
  d'où `libelleLicence`, une seule fonction pour le journal, le mail et la console. Le journal a été
  le premier à tomber.
- **Ce qui change de nature change de MAIL** : `licenceCabinet` (FR et EN) mène à *Réglages → Mon
  cabinet → Licence*, jamais aux Paramètres de SkanFact. Un test compare la phrase d'activation du
  worker à celle du gabarit de l'application : un client qui reçoit sa clé de la console ou de
  SkanFact lit le même chemin.
- **La licence du cabinet LUI-MÊME porte son empreinte comme SUJET**, pas comme parrainage :
  `licencesDuCabinet` l'exclut, sinon « ce cabinet a déjà parrainé quelqu'un » se corroborerait avec
  sa propre licence. Et la remise de parrainage ne se pose jamais sur une licence de cabinet.

Pièges rencontrés, tous déjà écrits ici :
- **Aucun backtick dans un commentaire d'un `template literal`** (quatrième fois, 7.20.0 / 7.29.0 /
  7.31.0) : deux commentaires de la console citaient `libelleLicence` et une règle CSS entre
  backticks — le fichier entier cessait d'être analysable, et l'erreur était signalée 1 000 lignes
  plus loin. Le bisect ligne par ligne l'a désigné en dix secondes ; la relecture, non.
- **Trois assertions ancrées sur une FORME sont tombées sur du code juste** : `discountRate: v.parrain ? `
  (recopiée mot pour mot, elle tombe dès que le geste gagne un garde-fou légitime — piège 7.16.0),
  et deux tranches bornées sur un voisin qui a déménagé. Les trois ont été **retournées vers la
  règle**, pas rafistolées : la remise dépend du parrainage et vit sur la facture ; le contrôle
  d'empreinte passe par core.js et sert ses DEUX champs.
- **Un champ caché par `hidden` reste visible dans la console** : `label.f{display:block}` bat
  l'attribut du navigateur. On cache par le style (`montrerChamp`).
- Piège de test : une ligne lue par SQLite arrive **sans prototype**, et `deepStrictEqual` compare
  aussi les prototypes.

Prouvé : **27 défauts réintroduits un par un** font tomber leur test — dont trois qui ne pouvaient
tomber qu'en les remettant (la clé de réponse redevenue `null`, la clé de réponse confondue avec la
maître, l'empreinte nue dans la clé signée). `npm run e2e:console` gagne une étape (le type, le
quota, l'empreinte, et la clé que SkanFact Cabinet reconnaît pendant que SkanFact la refuse).

### 9.4.2 — L'exemple qui ne périme plus, et le premier jour d'un comptable

Skander : « quand je fais la mise à jour des 2 app, recharger les nouveaux jeux de données
automatiquement, car on part du principe que mon comptable qui est en train d'essayer l'app cabinet
ne va pas appuyer sur effacer l'exemple et ensuite charger l'exemple à chaque nouvelle mise à jour »,
puis « faut que le ui/ux de l'app cabinet soit niquel car c'est le comptable qui teste ».

**L'exemple se refait tout seul.** `core.exemplePerime(repere, version, mois)` et son jumeau dans
`cabcore` (corps identiques, comparés par un test, comme `round3` et `pastille`) rendent le MOTIF —
`'version'`, `'mois'`, ou rien. Le repère `{ version, mois }` vit dans `data.exemple` et
`state.exemple`, et il entre dans les deux migrations : absent de la liste, il serait jeté au
prochain chargement et l'exemple se referait à CHAQUE ouverture, en silence (défaut `matricule`,
6.8.0).

- **Le mois compte autant que la version** : le jeu d'exemple est relatif à aujourd'hui. Chargé en
  septembre et rouvert en décembre, il montre trois mois de retard chez des clients censés être à
  jour. Un exemple périmé apprend des choses fausses sur le produit.
- **On ne remplace que ce qui EST déjà l'exemple** (`estDemo` / `dossiers.some(d => d.demo)`), et
  l'application le DIT dans le bandeau — un jeu de données qui change sans un mot ferait douter du
  reste. `retirerExemple` remet le repère à zéro, sinon un exemple rechargé à la main se referait au
  démarrage suivant.
- **Côté Cabinet, une sauvegarde avant ; côté entreprise, surtout pas.** `demoSortie` reprend la
  sauvegarde « avant-demo » la PLUS RÉCENTE : c'est le seul chemin de retour vers les vraies données.
  En écrire une ici rangerait l'exemple par-dessus, et « Repartir de mes données » rendrait l'exemple.

**`npm run e2e:cabinet-jour1` — l'instrument qui manquait.** `e2e:cabinet` vérifie que les GESTES
marchent ; celui-ci regarde ce qu'un comptable VOIT, dans l'ordre où il le voit, et le mesure : 35
écrans photographiés du mot de passe à l'Aide, à 1440 et à 1280. Ce qu'il a trouvé du premier coup :

- **Neuf boutons se lisaient comme du texte en gras** — les cinq « Voir » de « À faire », « Exporter
  en CSV », « Exporter le livre-journal », « Noter une relance faite ailleurs… », et « Enregistrer ma
  clé… », c'est-à-dire l'action la plus importante de l'application. `.btn-ghost` n'avait ni fond, ni
  bordure, ni couleur propre. **Un bouton se reconnaît AU REPOS, jamais au survol : personne ne
  survole ce qu'il ne voit pas.** La règle datait de Cabinet 1.0.0 et n'était tenue par aucun test —
  elle l'est maintenant, dans l'application réelle : fond, bordure, soulignement ou couleur, sinon
  c'est du texte. Les deux exceptions (pied de barre latérale, « Passer » d'un assistant) sont
  nommées et portent l'autre signe.
- **La page Relances félicitait un cabinet qui n'a aucun client** : « Personne à relancer : tous tes
  dossiers sont à jour » sur un portefeuille vide, et zéro bouton. C'est la règle de la 7.0.0 —
  vérifier que l'univers concerné est non vide avant de rassurer — et c'était la seule des trois
  pages à ne pas l'appliquer : Échéances et Écritures ont leur état vide avec son geste depuis
  toujours. **Quand deux écrans font le même métier, celui qui diverge est celui qui a tort.**
- **L'avertissement le plus important de l'application se lisait SOUS le bouton** qui crée le
  cabinet — « il n'y a aucun moyen de récupérer ce mot de passe », lu une fois le mot de passe
  choisi. Un avertissement, comme un refus, dit ce qu'il faut savoir AVANT d'agir : il est au-dessus,
  dans un encadré (`warn-box grave`), aligné à gauche — une phrase de trois lignes centrée ne se lit
  pas.
- **Neuf champs de saisie sans bulle « i »**, dont les cinq touches de la grille : « Solder la
  pièce » ne dit pas ce que le geste FAIT, et c'est exactement ce qu'on veut savoir avant de lui
  donner une touche. Trois listes déroulantes nues (« L'exercice », « 2026 », « Tous les journaux »)
  ont reçu leur étiquette et leur `aria-label`.
- **L'assistant annonçait « Quatre écrans » au-dessus de CINQ pastilles qui les montraient.** Une
  phrase affichée que rien ne tient est un bug (7.3.0) ; celle-ci se démentait toute seule, à
  l'écran, depuis le premier jour. Le compte se déduit de `etapes.length`.
- Le champ « Journal proposé » coupait son propre texte d'invite (`field narrow` sur un texte long) ;
  les paragraphes d'introduction couraient sur 1 140 px (`.lead` était borné à 760 px depuis
  toujours, eux non) ; deux cases à cocher voisines n'étaient pas alignées.

**La ponctuation double porte une espace insécable.** En français, `?` `!` `;` `:` et l'intérieur des
guillemets la demandent ; sans elle le navigateur coupe la ligne juste avant, et sur l'écran de
bienvenue le « ? » se retrouvait seul en début de ligne. `typographie(racine)` travaille sur les
NŒUDS DE TEXTE d'une prose déjà posée (`createTreeWalker` + `NodeFilter.SHOW_TEXT`) : aucune balise
n'est touchée, et seule la prose est concernée — les titres, libellés et cellules gardent leurs
espaces ordinaires, donc rien de ce qu'un test compare ne change. Trois portes l'appellent : la page,
l'assistant (hors de `#view`) et les fenêtres. *L'app entreprise ne l'a pas encore : à porter le jour
où sa prose est revue (règle 7.3.0 — une règle apprise d'un côté se vérifie de l'autre).*

**La console horodate son « Vu ».** Skander : « je veux l'heure aussi avec la date, afin de voir
quand le comptable a testé l'app ce jour-là ». Deux questions différentes, deux réponses : la phrase
(« aujourd'hui », « hier ») dit si l'installation vit encore, l'horodatage dit à quelle heure.
Et **un jour est un jour du CALENDRIER, pas une tranche de 24 heures** : une application ouverte hier
à 23 h et regardée ce matin à 8 h se lisait « aujourd'hui ». Les jours se comptent en UTC dans le
worker (les deux horodatages viennent du serveur) et dans le fuseau du navigateur dans la console
(c'est SON « aujourd'hui » qui est en question, règle 5.2.3). Le journal des événements affichait
l'heure UTC à côté d'une date UTC : tout passe par la même horloge, la locale.

Pièges rencontrés, tous déjà écrits ici :
- **Aucun backtick dans un commentaire d'un `template literal`** (cinquième fois) : j'ai écrit
  `` `jour()` `` dans un commentaire de la console, et le fichier entier a cessé d'être analysable.
- **Un test qui lit du code doit lire du CODE** (deuxième fois dans la même version) : le commentaire
  qui explique le défaut de l'assistant CITE la phrase interdite, et faisait tomber le test sur du
  code juste. Les commentaires de bloc se retirent avant de juger, pas seulement ceux de ligne.
- **Une classe du Cabinet n'a rien à faire dans la feuille partagée** : `.wiz-actions .btn-ghost`
  posé dans `style.css` a fait tomber le test de collision de la 6.8.0, immédiatement.
- **Une clé de bulle doit être LITTÉRALE et en dernier argument** : fabriquée par concaténation
  (`'sa.k.' + k`), elle échappe au test qui relit l'interface, et le texte d'aide meurt oublié.
- **Une classe utilisée et jamais définie ne se voit nulle part** (8.1.0) : `.f-lab` a été écrite
  dans le HTML avant d'exister dans la feuille.
- **Et un test qui ne pouvait pas échouer, trouvé par la preuve elle-même** : celui du bouton
  discret cherchait `/\.btn-ghost \{/` sans ancrer en début de ligne, et tombait donc sur
  `.sidebar-foot .btn-ghost {`, deux cents lignes plus haut — la seule règle qui a le DROIT d'être
  sans bordure. Il jugeait la mauvaise, et restait vert avec le défaut remis. Dans un fichier CSS,
  un sélecteur se lit avec `^…$`, sinon on lit celui d'un descendant.

Prouvé : **18 défauts réintroduits un par un** font tomber leur test.

### 9.4.3 — Le socle visuel du Cabinet, et les instruments qui le tiennent

Skander : « faut qu'on se pose et prenne du recul… il faut pas juste que ça soit fonctionnel, mais
faut que ça soit ergonomique, pratique et moderne », et le reproche qui va avec : « tu rajoutes des
choses au fur et à mesure du développement mais tu penses pas au rendu global ui/ux quand tu le
fais ». Il avait raison, et la cause est mesurable.

**L'app entreprise est tenue par quatre instruments qui mesurent ce qui s'AFFICHE** — `e2e:contraste`
(441 boutons), `e2e:colonnes` (405 colonnes), `e2e:entetes` (21 pages), `e2e:barre`. **Aucun des
quatre ne regardait l'app Cabinet.** Pas un. Elle a reçu les fonctionnalités de sa jumelle et aucun
de ses garde-fous visuels, et elle a dérivé très exactement là où personne ne mesurait. C'est la
règle 7.3.0 — « une règle apprise d'un côté se vérifie de l'autre » — appliquée non plus à une règle
mais à un INSTRUMENT : *un garde-fou qui ne couvre qu'une des deux applications ne protège qu'une
des deux applications.*

Règles apprises, à ne pas recasser :

- **Une capture qui ne montre pas la page entière fait juger une page sur son premier écran.** Ce
  n'était pas un `fullPage: true` oublié : les deux applications posent un cadre FIXE
  (`#app { height: 100vh }`) et c'est `main#view` qui défile, donc le DOCUMENT ne dépasse jamais la
  fenêtre et « page entière » rend exactement la même image qu'une capture d'écran. Tous les audits
  faits jusqu'ici ont relu un quart de page en croyant relire la page — le grand livre d'un dossier
  fait **6 462 px**. `capturePleine()` (harnais) relâche le cadre le temps de la photo, y compris
  les couches en `position: fixed`, puis le remet ; les mesures sont prises AVANT le relâchement.
- **Un parcours qui n'ouvre que l'onglet par défaut juge un sixième de la page.** Les six
  sous-onglets de la Comptabilité d'un dossier — dont la **Saisie**, l'écran où un comptable passe
  ses journées — n'avaient jamais été photographiés une seule fois. Les ouvrir a fait tomber six
  défauts en une passe.
- **Un mécanisme de MESURE se partage comme un mécanisme de production.** Les trois sondes
  (contraste et débordement, alignement des colonnes, barres d'en-tête) vivent dans
  `test/e2e/harnais.js`, en un exemplaire, et les quatre parcours les appellent. Recopiée dans un
  quatrième fichier, une sonde aurait divergé (7.29.0) — et c'est précisément la faute qu'on répare.
- **Un titre gris de 11 px ne hiérarchise rien : il décore.** `.panel h2` était le SEUL style de
  titre de section des deux applications — 11 px, gris, capitales, `letter-spacing: 1.2px` — et il
  donnait le même poids à « Comptabilité » qu'à « Abonnements ». Trois niveaux désormais, un rôle
  chacun : `h1` la page, `.panel h2` la section (15,5 px, couleur du texte), `.eyebrow` la
  sur-étiquette en capitales, **au-dessus d'un chiffre et jamais comme titre**.
- **La même déclaration était recopiée HUIT fois**, six dans la feuille partagée, une dans celle du
  Cabinet, et deux avaient déjà dérivé (12 px au lieu de 11, `.5px` au lieu de `1px`). C'est la
  démonstration du motif : un mécanisme recopié ne diverge pas peut-être, il diverge. Il en reste
  un, sous trois sélecteurs qui partagent le rôle, et un test le compte.
- **Une classe posée par le code et inconnue de la feuille ne se voit nulle part.** Les six onglets
  de la Comptabilité posaient `class="on"` ; la feuille ne connaît que `.tabs button.active`, et
  `#d-tabs` comme `#set-tabs` l'utilisent déjà. **Aucun des six ne montrait lequel était ouvert,
  depuis la 9.1.0**, et je l'avais sous les yeux sur une capture sans le voir. Quatrième occurrence
  du motif après `th.r` (7.23.0), `.help-fil` (7.27.0) et `.mono` (8.1.0).
- **Le rapport entre une case et son en-tête de colonne est évident à l'œil et invisible au
  clavier.** Les cinq cases de chaque ligne de la grille de saisie, le sélecteur de compte du grand
  livre et du lettrage, les deux filtres de la Recherche : huit champs sans étiquette, sans
  placeholder et sans `aria-label`. Le numéro de ligne entre dans l'étiquette, sinon cinq cases
  annoncent toutes « Compte ».
- **Une application de bureau s'ouvre le matin et se referme le soir.** Le Cabinet n'avait **aucun**
  thème sombre — pas une ligne, pas un réglage — alors que l'app entreprise en a un depuis la 1.6.0.
  Défaut « auto » : on suit le système plutôt que d'imposer un choix que personne n'a fait, et on
  RÉAGIT quand il bascule (un réglage lu une fois au démarrage se périme, 7.1.x). Le thème
  s'applique avant d'être enregistré — on choisit une apparence en la voyant — et si l'écriture
  échoue on remet ce qui était là.
- **Un réglage se choisit en le VOYANT** : trois cartes avec leur miniature, pas une liste
  déroulante. Les couleurs de ces miniatures sont écrites en dur, et c'est le seul endroit du projet
  où c'est juste : la miniature du thème clair doit rester claire quand on est en sombre.
- **Ce qui décide d'un export est le FICHIER, pas l'étiquette du dossier.** `ecrituresPlan` sautait
  les dossiers d'exemple — juste en 6.8.0, où l'exemple n'avait aucun fichier ; faux depuis la 9.2.2,
  où il livre de vrais `.skanpack`. La page Écritures proposait donc une période construite sur les
  paquets de l'exemple, puis se déclarait vide dessus : quatre zéros et un bouton éteint sur un
  portefeuille plein. La garde `demo` ne décide plus que d'une chose : on ne RÉCLAME rien à un
  client qui n'existe pas.
- **Un test qui lit du CSS doit lire du CSS** (6.8.0, re-rencontrée) : ma première version du test de
  l'échelle de titres tombait sur son propre commentaire, qui cite les sélecteurs qu'il explique.
  Les commentaires de bloc se retirent avant de juger, et on vérifie que le nettoyage n'a pas mangé
  le code.
- Piège de ma propre méthode : une chirurgie `python` sur un fichier de test a emporté la constante
  `SEUIL` qui vivait entre deux blocs déplacés — `contraste.js` est parti en `ReferenceError` au
  premier appel. Une tranche qu'on découpe se relit après découpe, pas seulement avant.

Numérotation : le chantier UI/UX du Cabinet prend **9.4.3 → 9.4.9** (il était prévu jusqu'à 9.4.6 ;
l'audit en a rempli trois de plus) et l'entretien qui portait le numéro 9.4.3 devient **9.4.10**.
23 occurrences dans cinq documents à chaque décalage, contre 281 pour la renumérotation de la v2 :
prendre le numéro suivant plutôt que décaler toute la suite est ce qui rend l'opération tenable.
**Et on ne renumérote JAMAIS une version déjà livrée** — celles du CHANGELOG sont l'histoire, pas
un plan : le script de décalage ne touche que les documents de planification, et le vérifie.

Prouvé : cinq défauts réintroduits un par un font tomber leur test, et le sixième (l'en-tête de
colonne désaligné) a été trouvé par l'instrument lui-même à sa première exécution.

### 9.4.4 — La page Dossiers : le portefeuille au-dessus de la ligne de flottaison

Premier volet du chantier UI/UX, et le défaut qu'il corrige se mesure en un chiffre : sur un
portable de 1280×800, la liste des clients commençait à **800 px** — le bas de l'écran. Elle
commence à **523 px**. Devant elle passaient quatre cartes de 180 px, un panneau « À faire » de six
lignes qui ne se repliait pas, un bandeau, une recherche de 1 220 px et une rangée de filtres.

Règles apprises, à ne pas recasser :

- **Le produit ne se mérite pas au défilement.** La page Dossiers EST le portefeuille, et c'est la
  seule chose qu'aucun autre logiciel ne donne à un comptable. Ce qui passe devant lui doit tenir
  en un coup d'œil. La règle est désormais MESURÉE (`e2e:cabinet-jour1`, étape 12) : le haut du
  tableau, dans la fenêtre, à 1280×800, sous 560 px. Le seuil n'impose pas une maquette, il
  interdit de repousser le produit hors de l'écran — prouvé en remettant les cartes hautes et le
  panneau non plafonné : 756 px, et le parcours tombe.
- **Un panneau d'alertes se replie, et ce qu'il cache se COMPTE.** Six lignes font 400 px.
  « À faire » garde les DEUX plus urgentes (la liste est triée par urgence) et propose « Voir
  4 autres lignes » : un « voir plus » qui ne dit pas combien ne se clique pas. Le choix est
  mémorisé — l'app entreprise a `todo-toggle` + `prefs` depuis la 2.2.0, le Cabinet ne l'avait
  jamais reçu (le jumeau manquant, encore).
- **Cinq libellés identiques ne disent pas où ils mènent.** Les six lignes de « À faire » partaient
  à six endroits et cinq disaient « Voir » : on clique pour savoir, et on revient. Un libellé décrit
  l'écran d'ARRIVÉE (7.29.0). Le test n'écrit pas la liste des libellés — il interdit le DOUBLON,
  donc il ne se périme pas au septième.
- **Une couleur seule n'est pas une information.** Une pastille rouge, orange ou verte devant chaque
  client, et rien nulle part ne disait ce que ça voulait dire : ni apprenable au premier jour, ni
  lisible pour qui distingue mal le rouge du vert, ni visible sur une impression. La légende est
  confrontée par un test aux niveaux que `dossierRow` PEUT produire — lus dans cabcore, jamais
  recopiés : c'est la couverture des treize boutons morts (7.0.0) appliquée à une couleur.
- **`rowmenu.js` est partagé depuis la 7.29.0, et la page principale du Cabinet ne l'utilisait pas.**
  Relancer un client depuis le portefeuille demandait trois écrans. Le menu ne vole pas le clic de
  la ligne et la ligne ne vole pas le sien (piège 7.28.0). `writeRelance` attend une LIGNE de
  `dossierList`, pas la fiche brute : les deux existent au même endroit et se ressemblent — c'est
  exactement ce qui produit un mail vide.
- **Un avertissement juste au mauvais moment apprend à ignorer la couleur.** Le tout premier écran
  d'un comptable, avant qu'il ait un seul client, était un bandeau ROUGE sur la clé de secours.
  Avant le premier paquet, il n'y a rien à perdre : ligne calme avec son bouton au jour 0, rouge dès
  qu'un paquet est sur le disque. C'est « un filet se réclame au moment où il protège encore »
  (QUESTIONS.md), pris par l'autre bout — et le bouton reste dans les deux cas, prévenir sans offrir
  le geste ne sert à rien.
- **Une colonne entièrement vide coûte de la largeur à toutes les autres.** Trois d'entre elles ne
  contenaient que des tirets. On les masque, on le DIT, et « Tout afficher » les rend : masquer sans
  le dire serait un piège (7.12.0).
- **La colonne d'actions d'une table large reste collée à droite.** Neuf colonnes débordent sur un
  portable : le menu de la ligne partait 17 px hors de l'écran, et il fallait défiler de côté pour
  l'atteindre. Un geste qu'on doit chercher n'est pas un geste.
- **La chaîne de `:not()` de la règle générale des champs gagne toujours** (quatrième fois, après
  `.help-search` en 7.27.0 et le thème sombre en 7.30.0) : `.champ-loupe input` perdait, donc la
  loupe se posait SUR la première lettre du texte. Ça ne se voit qu'en regardant l'écran.
- Deux affinages de l'instrument, chacun avec sa raison écrite : un bouton dans un `.scroll-x` n'est
  pas « hors de l'écran », il est à une molette (marqueur explicite du projet depuis la 7.13.0) ; et
  un en-tête de section repliable (`collapse-h`) porte ses trois signes au repos — chevron, curseur,
  compteur — comme l'en-tête cliquable de la 7.14.0. Les exceptions sont NOMMÉES dans une liste :
  une exception anonyme est un trou.

### 9.4.5 — Le livre : on le parcourt au lieu de le subir

La suite du même chantier, sur l'écran où un comptable passe ses journées. Les chiffres, mesurés
avant et après par `e2e:cabinet-jour1` : grand livre **6 554 → 2 170 px**, livre-journal
**5 888 → 3 268 px**, fiche Comptabilité **3 608 → 3 098 px**.

Règles apprises, à ne pas recasser :

- **Paginer ne suffit pas quand le tout tient sur une page.** Le grand livre de l'exemple a vingt
  comptes : `paginate` à 50 ne mordait sur rien, et la page faisait toujours sept écrans. Ce qui la
  faisait longue, ce n'était pas le NOMBRE d'objets, c'était leur TAILLE. Chaque compte est replié
  sur sa ligne de synthèse — un comptable **ouvre** un compte, il ne lit pas les vingt d'affilée —
  et le plan du grand livre se lit enfin d'un coup d'œil. Avant de paginer, demander ce qui prend
  la place.
- **Un objet replié porte son chiffre.** Un compte réduit à son numéro serait une table des
  matières ; avec ses mouvements, son débit, son crédit et son solde, c'est une balance qu'on peut
  déplier. Et les trois chiffres tombent en **colonnes** d'un compte à l'autre (`min-width` +
  `text-align: end`) : sans ça « Solde » change de place à chaque ligne et on le cherche à chaque
  fois au lieu de descendre la colonne.
- **`justify-content: space-between` compte le `::before` comme un troisième élément.** Le chevron,
  le nom, les chiffres : les trois étaient écartés, donc le nom du compte finissait **centré**,
  flottant au milieu d'une ligne dont les deux bouts étaient pris. `margin-inline-end: auto` sur ce
  qui doit rester à gauche. Aucune sonde ne mesure ça ; une capture le montre en une seconde.
- **Un commentaire qui décrit ce que le code ne fait pas est un bug.** Le mien annonçait que
  l'alignement des chiffres « fait qu'on lit la colonne Solde sans la chercher » — et il n'y était
  pas. C'est « une phrase affichée que rien ne tient » (7.3.0), appliquée au code.
- **Une ligne repliée sur trois lignes de texte triple la hauteur de tout le tableau.** Dix-sept
  pièces faisaient 5 888 px : un libellé de facture porte le nom du client, et la colonne passait à
  la ligne. `td.tronq` (feuille PARTAGÉE, les deux applications en profitent) tient la cellule sur
  une ligne, le texte entier au survol, intact à l'export. Un journal se PARCOURT — on y cherche
  une pièce — et ce qu'on y lit d'abord, c'est le compte, le montant et la date.
- **On pagine ce que l'écran MONTRE, et on le NOMME.** Le livre-journal se pagine par **pièce**
  (couper une pièce en deux montrerait un débit sans son crédit, et le lecteur conclurait à un
  déséquilibre qui n'existe pas), le grand livre par compte, la balance et le lettrage par ligne.
  Un pied qui annonce « 25 sur 340 lignes » là où ce sont des pièces raconte autre chose que le
  tableau. Et le pied de totaux porte sur la **sélection entière** — il se calcule sur `gardees`,
  jamais sur la page, comme dans l'app entreprise depuis la 2.2.0.
- **`pagerBar` s'appelle AVANT `paginate`** : c'est lui qui ramène `page` dans les bornes quand un
  filtre vient de réduire la sélection. L'inverse affiche une page vide, puis la bonne au redessin
  suivant — c'est-à-dire un tableau qui paraît vide sans raison.
- **Les trois aides de pagination prennent un ÉTAT** (`st = listState` par défaut, donc la page
  Dossiers n'a pas bougé). Câblées en dur sur `listState`, elles ne pouvaient servir qu'à une seule
  liste de toute l'application : un mécanisme qui ne se paramètre pas se recopie, et une copie
  diverge (7.29.0).
- **Un total vit SOUS sa colonne.** Une somme annoncée dans une phrase à gauche de l'écran ne se
  compare à rien : l'œil descend une colonne de montants et doit trouver son total au bout de
  CETTE colonne. Le pied de la grille de saisie porte débit, crédit et l'écart, en chiffres de même
  chasse — et la ligne d'écart ne s'affiche que s'il y en a un.
- **Un bouton éteint dit POURQUOI**, et par la MÊME fonction que celle qui refusera à
  l'enregistrement (`ecritureValide`). Un contrôle recopié dans l'écran finirait par diverger du
  moteur, et le bouton s'éteindrait sur une pièce que l'enregistrement accepte — ou l'inverse, bien
  pire. Le motif se lit **au-dessus** des boutons (9.4.2), en gris : pendant qu'on tape, « la date
  manque » est l'état NORMAL d'une pièce qu'on commence, pas une alarme.
- **Un raccourci s'AFFICHE comme une touche.** « Control+Enter » au milieu d'une phrase grise se lit
  comme une faute de frappe ; ⌃ + ↵ en relief se reconnaît sans être lu. C'est ce que Skander a vu
  sur une capture : « la section "les touches" sont en texte, alors que personne ne fait ça ». Les
  noms sont ceux d'un clavier **français** (`NOM_TOUCHE`), pas ceux de `KeyboardEvent.key`, et la
  ligne d'aide suit les touches RÉGLÉES — une aide qui annonce F2 quand la touche est F5 est pire
  que pas d'aide.
- **Une touche se règle en APPUYANT dessus.** Personne ne sait que la touche Entrée s'appelle
  « Enter » ni que Ctrl s'appelle « Control » : une faute de frappe donnait un raccourci qui ne se
  déclenchait jamais, sans rien à l'écran pour le dire. Le champ reste un `input` (donc l'étiquette,
  la bulle et le focus), mais en lecture seule — c'est le clavier qui l'écrit. Échap rend la main :
  on sort toujours d'un champ qui avale le clavier. Un modificateur seul n'est pas un raccourci.
- **Le format interne ne fuit pas dans un écran de saisie.** Le champ Date affichait
  « 2026-09-17 » sous une invite qui annonce « 04/03/2026 ». L'écran montre le jour en français, la
  PIÈCE garde l'ISO, et `dateTapee` continue d'accepter 4, 4/3, 04/03/2026 et l'ISO.
- **Un champ PRÉ-REMPLI se sélectionne au clic.** La date proposée (aujourd'hui, ou le dernier jour
  de l'exercice) a fabriqué son propre défaut : cliquer dedans et taper « 4/3 » donnait
  « 17/09/20264/3 ». C'est `e2e:saisie` qui l'a montré — la relecture, jamais. Corollaire : toute
  valeur qu'on propose doit pouvoir être remplacée en une frappe, sinon on l'a imposée.
- **Un bouton « Enregistrer » nu dans une page à plusieurs panneaux ne dit pas ce qu'il enregistre.**
  Trois cohabitaient dans les Réglages. Dans une fenêtre, « Enregistrer » suffit — c'est son titre
  qui le dit ; dans une page, non.
- **Un e2e ancré sur une FORME se périme à la refonte suivante** (sixième fois, après 7.3.0, 7.28.0,
  7.29.0, 7.30.0 et 9.2.2) : `e2e:boucle` attendait `#c-livres .panel h2`, la balise qui titrait un
  compte. On reconnaît un compte à ce qu'il EST (`.gl-compte`), et on en profite pour exiger la
  règle que la refonte a créée — chaque compte replié porte son solde.
- **Une assertion qui exige l'ISO à l'écran décrit le format interne, pas la règle** (neuvième
  occurrence du motif) : `e2e:saisie` a été **retourné** — l'écran affiche « 04/03/2026 », la pièce
  porte `2026-03-04`, et le parcours vérifie les DEUX.

Prouvé : huit défauts réintroduits un par un font tomber leur test, et deux des corrections (le nom
centré, la date pré-remplie qu'on ne peut pas remplacer) n'ont été trouvées que par la capture et
par le parcours réel.

### 9.4.6 — Les Échéances : la répétition, le geste, et le droit à l'erreur

Règles apprises, à ne pas recasser :

- **On pointe une OCCURRENCE, jamais une règle** (7.21.0, jamais portée ici) : `tva-m@2026-05-15`.
  Faire taire « TVA » ferait taire tous les mois suivants. La clé se fabrique en UN endroit
  (`K.cleEcheance`) : deux versions divergeraient au premier changement de format, et un dépôt
  pointé cesserait d'être reconnu sans rien dire. Et le filtre de `migrate` **borne le mois et le
  jour**, il ne les compte pas : « tva-m@2026-13-99 » ne pourra jamais désigner une échéance réelle,
  donc il n'a rien à faire dans les données.
- **Un pense-bête dit qu'il n'est qu'un pense-bête**, sur l'écran, sous le bouton : le Cabinet ne
  dépose rien et ne se connecte à aucune administration (règle 5.2.0). Une application qui laisserait
  croire à un dépôt réel se tromperait un jour sans que personne ne le sache.
- **Une explication se lit une fois.** Le `detail` décrit la RÈGLE, pas l'occurrence : la même phrase
  de 90 caractères s'affichait sous les quatre mois de TVA d'affilée. Et les mêmes clients
  réénumérés d'une carte à l'autre font croire à quatre problèmes différents — quand la liste est
  identique à celle qu'on vient d'écrire, on le DIT. Mais on ne remplace jamais une liste qui
  CHANGE par un compte : c'est l'information, pas le bruit.
- **Un lien souligné au milieu d'une phrase n'est pas un geste**, et « Les relancer » qui ouvre les
  soixante ne tient pas sa promesse (7.15.0). Le bouton POSE la sélection, puis navigue — et le
  filtre porte sur TOUT l'écran : le bandeau, la liste et le « Relancer » de groupe (7.18.0).
- **Un filtre de parcours ne survit pas à la sortie de sa page.** Le retrouver trois jours plus tard
  sans savoir d'où il vient serait le piège du filtre qui cache ce qu'on est venu chercher.
- **Deux mécanismes de l'app entreprise n'avaient JAMAIS été portés** — zéro occurrence des deux
  côtés du fichier (règle 7.3.0, encore) : `toastUndo` (le « Annuler » de huit secondes ; le CSS
  était déjà dans la feuille partagée, seul le JavaScript manquait) et `vers()`, sans quoi poser un
  filtre puis viser la page courante ne redessine rien. Le Cabinet avait exactement les gestes qui
  en ont besoin.
- **Une tranche de test s'ancre sur du code, jamais sur un nombre.** Celle de l'état vide des
  Relances sautait « les 40 premiers caractères » pour ignorer un `view.innerHTML` : elle a basculé
  sur un autre bloc dès qu'une ligne s'est insérée entre le `if` et lui — et le test a accusé du
  code juste. Elle va maintenant du `if` au `return;` que le code PORTE.
- **Un test de source dit qu'un bouton existe, pas qu'il agit.** Les trois gestes (pointer, annuler,
  partir relancer) sont refaits dans l'application réelle par `e2e:cabinet`, qui mesure aussi le
  `pointer-events` du bandeau : c'est le seul moyen d'attraper le défaut de la 5.2.2, où le bouton
  est parfaitement visible et parfaitement inerte.

Prouvé : six défauts réintroduits un par un font tomber leur test pur, et deux de plus font tomber
le parcours réel.

### 9.4.7 — La fiche d'un client : l'année entière, dans le bon sens

Règles apprises, à ne pas recasser :

- **Un calendrier se lit dans le sens du temps.** `.reverse()` affichait « Août, Juillet, Juin, Mai,
  Avril, Mars » sous une étiquette « 2026 » : le moteur (`dossierMonths`) rendait l'ordre juste,
  c'est l'écran qui l'inversait. Ce sont les ANNÉES qui vont de la plus récente à la plus ancienne —
  on arrive pour le mois courant — jamais les mois à l'intérieur d'une année.
- **Un extrait sans son cadre fait douter de l'outil.** Six mois affichés sur douze, sans un mot :
  on ne savait pas si la mission commençait en mars ou si l'application avait perdu les deux
  premiers. Les douze mois sont là ; ceux qui ne comptent pas sont en retrait et DISENT pourquoi.
  C'est le calendrier qui explique l'extrait, jamais l'inverse.
- **Une étiquette approximative sur un calendrier fait douter de tout le tableau** : « à venir » sur
  le mois où l'on EST est faux — il est *en cours*, et c'est précisément pour ça qu'il n'est jamais
  réclamé.
- **Un mois qui NOMME un manque porte le geste qui va avec** (7.15.0) — et la relance part sur CE
  mois-là, pas sur les six. Nommer un mois et en réclamer six est la même promesse non tenue que
  « Les relancer » qui ouvrait les soixante clients (9.4.6).
- **Un `flex-wrap` n'aligne rien d'une ligne à l'autre** : chaque année se recalait sur son propre
  contenu. Une vraie grille de douze colonnes met mars 2025 au-dessus de mars 2026, et c'est ce qui
  permet de comparer deux exercices d'un coup d'œil. Sous 1340 px elle passe à six colonnes,
  deux rangées par année — l'alignement tient toujours.
- **Un état vide SECONDAIRE s'annonce, il ne se contemple pas.** `.empty` fait 48 px de haut avec
  son cadre pointillé : c'est la bonne présence quand la page ENTIÈRE est vide — c'est le premier
  écran, il doit occuper la place. Au milieu d'une fiche déjà pleine, le même bloc consacrait 250 px
  à « aucune relance enregistrée » et repoussait tout le reste. `.empty.mini` pour les seconds, et
  le test vérifie les DEUX sens : un état vide qui est le corps de son écran garde sa présence,
  sinon on aurait juste remplacé un excès par l'autre.
- **Un test trop LARGE accuse du code juste**, exactement comme un test trop étroit (9.1.0) :
  `indexOf('Aucun paquet reçu')` tombait sur « Aucun paquet reçu pour l'instant… », le corps d'un
  onglet qui a raison de garder sa présence. Les phrases se citent entières, ponctuation comprise,
  et le test vérifie qu'elles ne sont pas ambiguës avant de juger.
- **Un e2e qui saute sa moitié ne prouve rien.** Ma première version ouvrait le premier dossier
  venu ; il n'avait aucun mois manquant, donc le geste n'était jamais exercé — et le parcours
  affichait « ok ». Il cherche maintenant un dossier qui en a un, et échoue s'il n'en trouve aucun.

Prouvé : cinq défauts réintroduits un par un font tomber leur test, et le parcours réel exerce les
deux moitiés du geste.

### 9.4.8 — Les finitions du Cabinet

Le reste de l'audit du 17/09/2026 : dix constats « moyens » et cinq « mineurs ». Aucun n'est grave
pris seul ; ensemble, ce sont eux qui font « pas fini ».

Règles apprises, à ne pas recasser :

- **Une case à cocher vient AVANT son libellé.** Dans une grille pleine largeur (`span-2`),
  l'écrire après la posait 500 px à droite du texte qu'elle coche : l'œil la cherche à gauche et ne
  la trouve pas. Cinq des sept cases de l'application le faisaient déjà — celle qui diverge est
  celle qui a tort (règle 9.4.2).
- **Un champ qui compte dans une unité le DIT à côté de lui.** « Jour de relance : 10 » — dix
  jours ? le 10 ? — et c'est cette date qui déclenche les relances de tout un portefeuille. Le mot
  encadre le champ (`le` … `de chaque mois`) au lieu de flotter en légende dessous : une légende
  sous un champ se lit après l'avoir rempli.
- **Une liste fermée ne se saisit jamais en texte libre** (7.30.0, re-trouvée) : « VTE » au lieu de
  « VT » ne correspond à aucun journal, et la grille de saisie s'ouvre alors sur le premier venu
  sans un mot. Corollaire immédiat (8.3.0) : le code DÉJÀ réglé reste dans la liste, sinon rouvrir
  les Réglages pour changer autre chose l'effacerait — un `select` dont aucune option ne correspond
  retient la première, en silence.
- **Un repère visuel sans chiffre ne dit pas combien il reste.** Cinq pastilles disent qu'il y a
  plusieurs écrans ; « Écran 2 sur 5 » dit où l'on en est. Et le compte se DÉDUIT de `etapes.length`
  — écrit à la main, il mentirait au premier écran ajouté, ce qui est exactement le défaut corrigé
  en 9.4.2 sur la phrase du même assistant.
- **La règle générale des pastilles vise TOUS les `span`** : sans `:not(.wiz-compte)`, le compteur
  devenait une barre de 26×4 px sans texte visible. Cinquième fois que ce motif revient (7.23.0,
  7.27.0, 7.30.0, 8.1.0) : le HTML est juste, c'est la feuille qui décide.
- **Un en-tête de fiche a un budget de boutons, comme une ligne de liste** (7.29.0). « Imprimer »
  occupait une place premium à côté des gestes quotidiens ; « Appeler » et « WhatsApp » dépendent
  d'un numéro qu'un dossier sur deux n'a pas, donc la barre changeait de forme d'un client à
  l'autre. Les trois vivent dans un menu, et `RowMenu.bouton` — le bouton seul, sans sa cellule —
  est ce que `RowMenu.cellule` appelle : une seconde version recopiée aurait perdu `aria-expanded`
  ou `data-rowmenu` au premier ajustement.
- **UNE seule table d'actions par racine.** `bindRowMenus` écrase le gestionnaire précédent : une
  seconde table rendrait la première parfaitement inerte, sans une erreur nulle part. J'ai failli
  l'introduire en ajoutant le menu de l'en-tête à côté de celui des paquets.
- **Un manque annoncé porte le bouton qui le comble** (7.20.0) : « email à renseigner » et
  « téléphone à renseigner » étaient du gris inerte, alors que ce sont les deux champs sans lesquels
  aucune relance ne part.
- **Une colonne qui n'apprend rien coûte de la largeur à toutes les autres** : « 6 Ko » sur un
  tableau de dix colonnes. Le poids reste en infobulle, là où il sert — quand on se demande si un
  paquet est anormal.
- **Le geste qui allonge un tableau vit SOUS ce tableau**, pas dans la barre qui clôt le panneau :
  côte à côte, deux boutons de poids voisin laissent croire à deux façons d'enregistrer.
- **Un e2e ancré sur la forme d'hier, septième fois.** `e2e:cabinet` exigeait un `#print` et
  `e2e:boucle` prenait « le premier `[data-rowmenu]` venu » — qui est désormais celui de l'en-tête.
  Les deux ont été retournés vers la règle : la fiche doit pouvoir s'IMPRIMER ; le menu cherché est
  celui d'une LIGNE de paquet, dans l'onglet Paquets, atteint par son adresse.
- **Un test e2e ne déclenche pas un geste qui bloque.** Cliquer le bouton d'impression ouvre la
  boîte du système et fige le parcours pour toujours : on lit ce que le bouton propose. Et le test
  accepte les DEUX formes, parce qu'un menu à une seule action devient un bouton nommé (7.29.0) —
  un test qui n'en connaît qu'une accuserait du code juste au premier client sans téléphone.
- **Un test trop LARGE, deuxième fois en deux versions** : `/<th class="r">Taille<\/th>/` visait la
  table des sauvegardes, où la taille est légitime — c'est elle qui dit qu'une sauvegarde n'est pas
  vide. On borne la tranche au tableau visé avant de juger.
- Piège rencontré : la forme `${/* … */''}` est un commentaire de GABARIT. Écrite dans un tableau
  JavaScript ordinaire, elle casse le fichier — `node --check` le dit tout de suite, la relecture
  non.

Prouvé : cinq défauts réintroduits un par un font tomber leur test, et les deux parcours réels ont
attrapé ce qu'aucun test de source ne pouvait voir.

### 9.4.9 — Le fil du parcours, et la fin de l'audit

Le dernier lot de l'audit du 17/09/2026. Il porte sur ce qui manquait entre les écrans plutôt que
dans les écrans.

Règles apprises, à ne pas recasser :

- **Le métier du Cabinet est une BOUCLE, et chaque écran doit finir par le geste suivant.** Un
  paquet arrive → je vérifie → j'écris les écritures → j'exporte → je relance qui n'a rien envoyé.
  Elle était éclatée sur quatre pages sans lien : depuis Échéances on ne pouvait pas ouvrir la
  comptabilité du client en retard, depuis un paquet reçu rien ne menait à « créer le livre »,
  depuis le livre rien ne menait à l'export groupé. C'est la règle que l'Aide de l'app entreprise
  applique depuis la 7.27.0 (« chaque article finit par un geste ») et qu'aucune page du Cabinet
  n'appliquait — une règle apprise d'un côté se vérifie de l'autre (7.3.0), y compris quand elle
  concerne la NAVIGATION et pas un composant.
- **Un libellé dit l'état d'arrivée** : « Créer le livre de ce client » quand il n'y en a pas,
  « Voir ses écritures » quand il existe. Le même bouton sous deux noms vaut mieux qu'un nom qui
  ment une fois sur deux (7.29.0).
- **« Tout le monde ou personne » n'est pas un choix.** Un comptable relance les cinq clients d'une
  échéance, ou ceux qu'il n'a pas eus au téléphone. La case d'en-tête coche ce que l'écran MONTRE,
  jamais les soixante : cocher ce qu'on ne voit pas est un piège, et sous filtre ce serait le
  chiffre qui ment (7.16.0). Et une coche posée sur un client qui a envoyé son mois entre-temps
  tombe d'elle-même — on ne relance pas quelqu'un qui n'a plus rien à envoyer.
- **Une courbe d'une barre sur douze n'est pas une courbe**, c'est 200 px de haut pour un chiffre et
  onze « pas reçu ». Sous trois mois, l'information réelle EST le chiffre — et le fait qu'il ne
  porte que sur deux mois, ce qu'aucun graphique ne dit aussi clairement qu'une phrase. Mais il DIT
  sur quoi il porte : un total sans sa période est un agrégat qui ment (3.1.0).
- **Une prose grise sous un tableau remplace la découvrabilité** : on la lit une fois et elle reste
  pour toujours, à prendre de la place. L'explication vit dans la bulle du TITRE, là où on la
  cherche quand on ne sait pas. Corollaire immédiat, que le test des bulles a dit tout de suite :
  les deux bulles absorbées n'étaient posées QUE dans cette prose, donc elles seraient devenues des
  entrées mortes — on les retire, on ne les laisse pas sans endroit où s'afficher.
- **Un sous-titre qui se termine sur « si » paraît coupé** : on relit pour vérifier qu'il ne manque
  pas un mot, et c'est tout le plan qui devient suspect. Et on le MESURE plutôt que de le relire —
  `scrollHeight > clientHeight` dit qu'un texte déborde de sa carte, ce qu'aucune lecture du code
  ne montre. Prouvé en bornant la hauteur d'une carte : les neuf tombent.
- **Trois de mes propres assertions ont été retournées** — les neuvième, dixième et onzième fois que
  ce motif revient. La troisième est la plus instructive : `e2e:cabinet` exigeait « douze barres »
  sur un client qui n'a que deux mois reçus. Retournée vers la règle — « le chiffre d'affaires DIT
  sur quoi il porte », quelle que soit la forme — elle est devenue PLUS forte qu'avant : elle vérifie
  les deux formes, et que chacune nomme sa période. Les deux autres : Elles recopiaient une ligne (`groupRelance(rows.slice())`, `route !==
  'relances' && relState.seulement`) au lieu d'exiger la règle qu'elle porte : « le geste de groupe
  ne porte jamais sur la liste entière », « tout état de parcours se vide en quittant la page ».
  Une assertion qui recopie tombe dès que le geste gagne quelque chose de légitime, et se
  « répare » en recopiant la nouvelle ligne — donc sans rien prouver (7.16.0).

Prouvé : cinq défauts réintroduits un par un font tomber leur test pur, et la sonde des sous-titres
se prouve en bornant une carte.

### 9.4.10 — L'entretien : ce qui se rembourse

*Une version sur quatre ne porte aucune fonction nouvelle, par règle (`QUESTIONS.md` § 15, point 14).
Elle est écrite d'avance précisément parce que c'est quand on est pressé qu'on la saute.*

Règles apprises, à ne pas recasser :

- **Un CSS physique décrit un écran ; un CSS logique décrit une lecture.** Les 94 déclarations
  `margin-left` / `text-align: left` / `left:` des deux feuilles sont devenues `margin-inline-start`,
  `text-align: start`, `inset-inline-start`. Ça ne promet pas l'arabe — ça évite qu'un jour la
  question coûte un chantier au lieu de deux heures. **Une seule exception, et elle est NOMMÉE dans
  le test** : `#toast { left: 50% }`, où le centrage par `translateX(-50%)` rend le physique juste
  dans les deux sens de lecture (`inset-inline-start: 50%` collerait le bandeau à droite en arabe).
  Une exception anonyme est un trou.
- **Un code d'erreur n'a de valeur que s'il ARRIVE à l'écran.** `err.code` **ne traverse pas le pont
  IPC** : Electron sérialise l'erreur en une chaîne, et la propriété est perdue. La Partie 10 du
  cahier prévoyait `err.code = 'ERR-CAB-001'` depuis la 9.1.0 ; posée telle quelle, elle n'aurait
  rien montré à personne. Le code voyage donc **dans le message**, entre crochets, et `plainError`
  le détache avant d'afficher la phrase (`codeErreur` le rend à qui a la place de le montrer —
  jamais un bandeau de 2,6 secondes).
- **Un refus qu'on a ÉCRIT est une réponse ; une exception imprévue est une panne.** Seule la
  seconde va au journal. La première version enveloppait `ipcMain.handle` pour journaliser TOUS les
  refus : `e2e:entreprise`, qui exige un `main.log` vide après une exécution propre, est tombé sur
  la clé de lecture de photo absente — un refus parfaitement normal, que le parcours provoque
  exprès. Un journal rempli de mots de passe mal tapés ne se lit plus, et il emmène avec lui la
  ligne qui comptait (même règle que le rouge sur une situation normale, 8.0.1). Ce qui manquait
  était l'autre moitié : **une exception qui échappait à un handler n'écrivait rien, nulle part.**
- **On enveloppe une fois, pas quatre-vingts.** `ipcMain.handle` est enveloppé au niveau du module :
  autant de points d'enregistrement, autant d'occasions d'en oublier un — et la forme
  `ipcMain.handle(` reste celle que les tranches de source des tests reconnaissent.
- **Deux tables séparées divergent, toujours** (6.8.0, 7.23.0, re-trouvée) : un test confronte les
  codes `ERR-*` posés dans les deux `main.js` à la table de la Partie 10 du cahier. Un code écrit
  dans le code et absent du cahier ne se cite nulle part.
- **Un test qui lit du code doit lire du CODE — troisième fois** (6.8.0, 7.25.0). Le garde-fou « le
  cabinet n'écrit jamais chez un client » découpe la source sur `ipcMain.handle(` ; mon commentaire
  expliquant l'enveloppe **citait ce motif entre accents graves**, fabriquait un faux handler sans
  nom, et faisait tomber le test sur du code juste. Les commentaires se retirent avant de juger.
- **Un fichier de tests se découpe PAR OCCASION, et la suite découpée doit être CHARGÉE.** Le
  premier domaine sort dans `test/suites/cabinet-rendu.js` (23 tests, le chantier UI/UX du Cabinet) ;
  il reçoit le harnais en argument plutôt que d'ouvrir son propre compteur — deux compteurs, c'est un
  total faux. Et un contrôle lit le DOSSIER : une suite écrite que le lanceur ne charge pas est pire
  que pas de suite, parce qu'on se croit couvert.
- **`npm audit` juge ce qui est LIVRÉ** (`--omit=dev`). Les douze failles du jour vivent toutes dans
  les dépendances de construction d'electron-builder : elles se corrigent, mais elles ne s'installent
  chez personne. Une CI rouge en permanence cesse d'être lue.
- **Une version minimale s'écrit à UN endroit.** Les deux installeurs lisent `engines.node` dans
  `package.json` au lieu de porter le chiffre ; écrit deux fois, il diverge au premier changement.
- **Electron change de version majeure ici, et nulle part ailleurs.** 43 → 44, et **les 46 parcours
  relancés** — c'est la seule version où on les relance tous, et c'est la raison d'être de cette
  version-là.

### 9.5.0 — La banque

Le relevé importé, rapproché quand c'est certain, proposé quand ça ne l'est pas. La question qui
bloquait cette version — « quelles banques, et quel format chacune exporte-t-elle ? » — n'a toujours
pas de réponse, et n'en aura pas avant que le cabinet pilote ouvre ses fichiers. **C'est la
conception qui répond à sa place** : rien dans le code ne connaît une banque.

Règles apprises, à ne pas recasser :

- **Un rapprochement FAUX est pire qu'un rapprochement absent**, parce qu'il ferme la question.
  D'où la règle qui ne bouge pas : **seul `certain` se pose d'office, et une ambiguïté n'est jamais
  `certain`**. Un candidat unique au bon montant, à ± n jours : certain. Deux candidats : jamais,
  quoi qu'en dise le libellé — au mieux `probable`, et l'écran montre TOUS les candidats.
- **Le libellé se COMPTE, il ne se répond pas par oui ou non.** Ma première version disait « ces deux
  libellés se ressemblent-ils ? » : « REMISE CHEQUE DUPONT » ressemblait autant à « CHEQUE DUPONT »
  qu'à « CHEQUE MARTIN », parce que le mot partagé était « cheque » — celui qui n'apprend rien. On
  compte les mots communs, et on ne départage que si un candidat en a **strictement plus** que tous
  les autres.
- **Le brouillard COMPTE dans le rapprochement**, et c'est un choix. Ma première version l'excluait
  (« un brouillard n'est pas encore un fait »), et le parcours réel a montré ce que ça donne : on
  écrit l'écriture manquante depuis une ligne de relevé, elle arrive en brouillard, et l'automatique
  ne la retrouve plus. Le rapprochement devenait inutile très exactement pendant la demi-journée où
  il sert. **Ce qu'il faut en contrepartie** : une écriture rapprochée ne se modifie ni ne se
  supprime — même garde que le lettrage, avec le geste qui débloque nommé dans le refus.
- **Une écriture déjà rapprochée ne répond pas d'une seconde ligne.** Sans ça, le même mouvement
  tomberait juste deux fois, et le compte serait équilibré sur un mensonge.
- **Le signe est celui de la BANQUE** : ce qui entre est positif, ce qui sort négatif. C'est le seul
  endroit du livre où un montant porte un signe, et c'est voulu — un relevé se relit à côté de son
  original papier, et l'inverser rendrait la comparaison impossible. La conversion en débit/crédit
  se fait au rapprochement.
- **Un relevé qui ne se boucle pas n'entre pas** (`soldeDebut + Σ = soldeFin`), et le refus porte
  l'écart : il manque des lignes, et un rapprochement à moitié ne s'explique plus trois mois après.
- **Les suspens se comptent DANS LES DEUX SENS** (6.8.1, re-trouvée) : ne regarder que le relevé
  laisserait passer le chèque émis jamais encaissé, c'est-à-dire l'écart le plus courant.
- **La table libellé → compte part VIDE.** Écrire « STEG → 606 » dans le code serait poser une règle
  comptable que personne n'a validée (règle 9.1.1). Elle se remplit un libellé à la fois, quand le
  comptable choisit ; et **le motif le plus LONG gagne**, sinon le résultat dépend de l'ordre du
  tableau (même règle que la correspondance de comptes, 9.3.0).
- **Sans règle connue, la contrepartie reste VIDE** — et `ecritureValide` refuse alors
  l'enregistrement. Verser d'office au 471 rangerait le doute dans un compte que personne ne solde,
  et la question disparaîtrait sans avoir été posée.
- **Un lettrage automatique généreux est pire qu'aucun** : il affirme qu'une facture est payée. On ne
  relie que ce qui se solde EXACTEMENT et quand un seul candidat convient — la référence tranche
  entre deux règlements du même montant. Un règlement partiel reste ouvert : c'est très exactement
  ce que « ce client me doit-il encore quelque chose ? » veut savoir.
- **Rapprochement et lettrage sont deux écrans, deux modèles, deux tests.** C'est la confusion de
  vocabulaire la plus courante du métier, et un écran qui les mélange la rend définitive.
- **Les tranches d'âge n'existent qu'à UN endroit.** Elles vivaient dans core.js depuis la 2.5.0 ; le
  Cabinet ne charge pas core.js, donc les recopier aurait donné deux balances âgées qui ne disent pas
  la même chose. Elles ont déménagé dans `compta.js`, et core.js les réexporte — un test compare les
  deux références.
- **Du rouge sur une situation normale apprend à ignorer le rouge** (8.0.1, re-trouvée) : « sans
  réponse » est l'état de DÉPART de toute ligne d'un relevé qu'on vient d'importer. Pas de badge
  d'alarme dessus.
- **Un geste destructeur ne se présente pas comme un bouton nommé.** `rowmenu.js` transforme une
  action unique en bouton direct (7.29.0) : le menu du relevé n'en portait qu'une, « Retirer ce
  relevé », qui s'est donc affichée en clair à côté du bouton d'import. Lui donner sa vraie voisine
  — « Défaire tous les rapprochements », utile et réparable — remet le destructeur derrière un clic.
- **Deux gestes séparés pour importer** : lire le fichier, puis l'ajouter. Entre les deux, le
  comptable choisit le compte bancaire, saisit les deux soldes du relevé papier et corrige
  l'association des colonnes. Les fondre reviendrait à écrire dans un livre comptable à partir d'un
  fichier que personne n'a regardé.

Le test qui compte est `npm run e2e:banque` : trois banques aux trois formats différents (montant
signé, débit/crédit séparés, en-têtes inconnus), le refus d'un solde faux avec son écart, le doublon
refusé, l'automatique qui ne pose rien sur une ambiguïté, l'écriture écrite depuis une ligne puis
retrouvée « certain » par l'automatique, le libellé retenu, et le relevé retiré sans que le journal
bouge.

### 9.6.0 — La déclaration mensuelle

Les chiffres que le comptable RECOPIE sur le portail. L'application ne dépose rien, ne se connecte à
aucune administration, et ne le fera jamais (règle 5.2.0) : « Marquer déposée » est un pense-bête.

Règles apprises, à ne pas recasser :

- **Une case dont la règle n'est pas connue vaut `null`, jamais 0** (règle 9.1.1, appliquée cette
  fois à un formulaire fiscal). Un zéro se recopie ; un « — » avec sa raison se demande au
  comptable. TFP, FOPROLOS, TCL et acomptes provisionnels existent dans l'objet — les taire ferait
  croire qu'elles n'existent pas — et portent leur motif. Le jour où le plan du dossier porte un
  compte pour l'une d'elles, elle se calcule : la règle « null » n'est pas un abandon, c'est une
  attente, et elle se lève toute seule.
- **L'écriture de déclaration ne compte pas dans ce qu'elle déclare.** C'est le défaut que le
  parcours réel a trouvé et qu'aucun de mes tests ne pouvait voir : le jeu d'exemple porte les
  livres d'un CLIENT, et un client à jour a déjà passé son écriture de TVA. Celle-ci débite le 4367
  d'exactement ce que les ventes y ont crédité — donc un « crédit moins débit » sur le mois donne
  **zéro**, et un mois plein paraît vide. On l'exclut, et on la reconnaît à sa **FORME** (elle
  touche le compte à décaisser ET un compte de TVA), jamais à son libellé : le client de l'exemple
  nomme la sienne « TVA-2026-08 », la nôtre s'appelle « DECL-2026-08 », un cabinet la nommera
  autrement.
- **Un état et ses drapeaux se calculent UNE fois.** `etatDuMois` rendait `saisi` d'un côté et
  recalculait `validees.length` de l'autre pour le mot : les deux pouvaient se contredire sur le
  même écran (règle 6.8.1). Le mot se déduit désormais des drapeaux — et c'est en essayant de faire
  tomber le test que la divergence est apparue.
- **On ne crédite du compte de TVA déductible que ce qui est UTILISÉ.** Le solder entièrement ferait
  disparaître le crédit à reporter, et le mois suivant paierait deux fois.
- **Le crédit reporté se LIT sur le compte**, jamais dans un champ — c'est la leçon de `vatChain`
  (3.1.0), portée au Cabinet.
- **Les contrôles nomment, ils ne bloquent pas** (règle 6.0.0) : un mois déclaré avec deux manques
  signalés vaut mieux qu'un mois jamais déclaré parce que l'application faisait la difficile. Et le
  contrôle choisi dit un GESTE : « le compte 4367 porte encore X : l'écriture de déclaration n'a pas
  été passée » se traduit en action, là où un contrôle sur le report de crédit dirait la même chose
  d'une façon que personne ne sait traduire.
- **Une période n'a qu'UNE déclaration**, et une déposée ne se refait pas en silence : deux chiffres
  différents portant le même dépôt, et plus personne ne sait lequel a été envoyé. Le refus nomme le
  geste qui débloque.
- **On ne paie pas ce qu'on n'a pas déposé** : l'ordre des deux pense-bêtes est une information, et
  le bouton éteint dit pourquoi. Les deux se dé-pointent (7.12.0) — un pense-bête qui ne se défait
  pas devient un mensonge le jour où l'on se trompe de mois.
- **Le détail par TAUX ne s'invente pas.** Il demande un sous-compte de TVA collectée par taux ;
  quand le dossier n'en a qu'un, on le DIT au lieu de rendre un tableau à une ligne qui laisserait
  croire que tout est à 19 %.
- **Le RÔLE désigne le compte, jamais le numéro écrit dans le code** (règle 6.3.0 : aucun numéro de
  compte n'est une vérité). Un cabinet qui a ses propres numéros ne doit pas voir une déclaration
  vide. Les comptes fiscaux vivent dans `compta.js` — le Cabinet ne charge pas core.js — et un test
  les confronte à `DEFAULT_ACCOUNTS`.
- **L'écran s'ouvre sur le dernier mois SAISI**, pas sur janvier : un comptable vient déclarer le
  mois qu'il vient de terminer, et onze clics par déclaration se paient en usage.

**Ce qui n'est PAS livré, et pourquoi** : le calendrier fiscal par régime (F-9.6.0-12). Les régimes
à distinguer et les échéances de chacun sont une question au comptable pilote ; les inventer serait
écrire du droit que personne n'a confirmé — exactement ce que la règle du seuil de retenue (9.1.1)
interdit. La page Échéances existante continue de servir.

Le test qui compte est `npm run e2e:declaration` : les quatre cases « — » avec leur raison, un
chiffre ouvert sur ses pièces, un mois DÉJÀ déclaré par le client qui montre quand même sa collectée
et dont le bouton s'éteint en disant pourquoi, un mois libre où l'écriture se passe en brouillard au
dernier jour, les deux pointages dans l'ordre puis défaits, et le refus de refaire une déposée.

### 9.8.0 — La clôture d'exercice, et le flux retour

Règles apprises, à ne pas recasser :

- **Un refus qu'on avale en silence est pire que le refus.** Le verrou d'un exercice reçu du cabinet
  passe par `closePeriod`, qui refuse une période non terminée (règle 6.0.0, juste) — et ma première
  version jetait ce refus. L'écran affichait « exercice verrouillé » sur un exercice qui ne l'était
  pas. La ligne dit maintenant « verrou en attente » avec sa raison. C'est le parcours réel qui l'a
  montré : le jeu d'exemple porte l'exercice EN COURS, donc le cas limite est le cas normal.
- **`zipRead` rend `data` en fonction PARESSEUSE** (elle décompresse et vérifie le CRC à l'appel).
  Ranger `f.data` au lieu de `f.data()` donne un « [object Function] » qui ne ressemble à rien, et
  aucune relecture ne le voit — seul le parcours qui ouvre vraiment le fichier.
- **Une extourne n'est pas une contre-passation** (règle 9.3.0, portée à la clôture) : l'originale
  reste `validee`, dans son exercice, avec son numéro. La marquer « contrepassée » la ferait
  disparaître du mois où elle a été passée, et le résultat de cet exercice-là serait faux.
- **Ce qui est déjà fait ne se refait pas.** Rouvrir l'exercice suivant une seconde fois reposait
  les extournes : la charge était annulée deux fois, et rien à l'écran ne le montrait. Les
  extournes déjà VALIDÉES dans le livre cible sont exclues ; les brouillards, eux, se remplacent —
  un exercice qui bouge encore change son report.
- **Les à-nouveaux se calculent sur les écritures RÉELLES et l'ouverture, jamais sur les à-nouveaux
  précédents** (règle 9.0.0, re-posée) : sinon le passé est compté deux fois.
- **Chaque solde de gestion porte SA FORMULE à côté de lui.** Un chiffre qu'un comptable ne sait pas
  refaire ne se discute pas avec un client. Et un ratio sans dénominateur vaut `null`, jamais 0 % —
  la règle des cases fiscales inconnues (9.6.0), appliquée aux ratios.
- **`ajouterEcriture` normalise et JETTE ce qu'elle ne connaît pas, exprès** : la forme d'une
  écriture est fixée, sinon chaque appelant y glisserait ses champs à lui. Un drapeau neuf
  (`extourne`) doit donc entrer dans cette forme — c'est une décision de format, pas un ajout
  discret côté appelant. Le test l'a montré en rendant zéro extourne sur une écriture qui en portait.
- **Une phrase de l'écran est coupée par les retours à la ligne de la SOURCE** : `textContent` les
  garde, donc « liasse fiscale » y devient « liasse\\n      fiscale ». Un parcours qui compare du
  texte aplatit les espaces avant de juger — sinon il accuse du texte parfaitement juste.
- **Le PDF ne fait jamais échouer la clôture** (règle 6.1.0) : il est produit quand Electron le peut,
  le manifeste dit s'il est là, et l'HTML — lisible par n'importe quel navigateur, aujourd'hui et
  dans dix ans — part de toute façon.
- **Chiffrer n'est pas signer**, dans ce sens aussi : le cabinet signe le manifeste avec une clé
  Ed25519 créée à son premier fichier de clôture, symétrique de celle du client (9.2.0). Le client
  épingle au premier usage. Un dossier non signé est accepté avec « origine non prouvée » écrit en
  toutes lettres, jamais en silence.

### 9.7.0 — Les immobilisations et l'inventaire du cabinet

Règles apprises, à ne pas recasser :

- **Un taux qui dépend du droit se SAISIT ; un taux qui dépend d'un calcul se déduit.** Le
  coefficient dégressif tunisien n'est confirmé par personne : il n'existe donc nulle part dans le
  code, et un dégressif sans taux est **refusé en nommant le taux** plutôt que calculé avec une
  valeur devinée. La bascule au linéaire suit la même règle : elle existe, elle est décochée, et
  c'est une case — pas une version (règle 9.1.1, appliquée à un coefficient).
- **Un adaptateur vaut mieux qu'une seconde implémentation.** Le livre écrit ses champs en français
  (`valeur`, `duree`, `dateMiseEnService`, `cession`), le moteur porte les siens depuis la 3.5.0.
  `bienVersActif` traduit à UN endroit, et un test compare le plan des deux côtés exercice par
  exercice. Recopier le moteur aurait donné deux tableaux d'amortissement pour un seul bien — et le
  comptable et son client n'auraient eu aucun moyen de savoir lequel croire.
- **Un plan se recalcule ; une écriture est un FAIT.** `plan[]` est déduit des champs à chaque
  lecture (invariant SPEC-DATA-005), mais `ecritureId` se reporte : la dotation de 2026 a été passée
  ou elle ne l'a pas été, et aucun recalcul ne peut le défaire. Sans ce report, le bouton se
  rallumait et la dotation était comptée deux fois sans que rien ne le montre.
- **Ce qui rendrait une écriture fausse est refusé ; ce qui ne la touche pas passe.** Changer la
  valeur d'un bien dont la dotation est écrite est refusé (avec « contre-passe d'abord ») ; le
  renommer passe. Un refus qui bloque tout ferait renoncer à corriger une faute de frappe.
- **Le prix d'une cession n'est jamais inventé** (règle 9.0.0, portée ici) : la sortie d'actif
  s'écrit — amortissement repris EN ENTIER, VNC en charge, valeur brute créditée — et le prix arrive
  par la facture ou le relevé. L'écrire d'office au 471 laisserait un compte d'attente que personne
  ne solde. Une **mise au rebut** est la même écriture à prix nul, et la pièce le DIT.
- **Une liste AJOUTÉE à un format figé est compatible ; un champ renommé ne l'est pas.** `livre.json`
  gagne `inventaires[]` ; absente d'un livre ancien, elle vaut `[]`. Le test du format a fait son
  travail en tombant — il dit maintenant les deux : le socle qui ne peut plus bouger, et la liste
  complète d'aujourd'hui, pour qu'un ajout reste une **décision** et jamais un effet de bord.
- **Une variation nulle ne produit aucune écriture**, et l'écran dit pourquoi. Une pièce à zéro dans
  un journal n'apprend rien et se relit dix fois.
- **Un inventaire sans ligne ne dit pas « le stock est vide »**, il dit « rien n'a été compté ».
- Piège d'e2e, **septième fois** : `[data-rowmenu]` attrape le menu de l'en-tête de fiche (9.4.8),
  qui vient avant dans le document. On vise ce que l'élément DÉSIGNE (`[data-rowmenu^="IM:"]`).
- **Un e2e qui saute sa moitié ne prouve rien** (règle 9.4.7, re-rencontrée) : ma première version
  prenait « le premier dossier de la liste », qui n'a qu'un mois reçu et aucune acquisition — le
  parcours passait en sautant très exactement ce qu'il devait prouver. Il choisit maintenant le
  dossier **par ce qu'il contient**, et échoue si aucun ne convient.
- **Une preuve par réintroduction ne vaut que sur un lot VERT.** Mes huit preuves ont d'abord toutes
  rendu « 0 test vert » : le lot s'arrêtait bien avant la suite, sur le test d'index de ce fichier
  (48 parcours annoncés, 49 réels). Je mesurais le vide. **Avant de prouver un test, vérifier que le
  lot passe sans le défaut** — sinon on lit un chiffre qui ne parle pas de ce qu'on croit.

### 9.6.1 — L'entretien : le moteur a fini de déménager

*Une version sur quatre ne porte aucune fonction nouvelle, par règle.*

- **La règle de découpage de la 9.1.0 se relit dans les deux sens.** « Une fonction qui prend `data`
  reste dans core.js ; une fonction qui prend des LIGNES vit dans compta.js » — le constructeur de
  pièce équilibrée (`entrySet`) et tout le moteur d'amortissement prennent une PIÈCE et un BIEN.
  Ils étaient du mauvais côté depuis la 3.5.0 et la 6.3.0, et ça ne s'était jamais vu parce que
  personne d'autre n'en avait besoin. **Le Cabinet en a besoin en 9.7.0** : il ne charge pas core.js
  et ne doit jamais le charger, donc la seule alternative au déménagement était la recopie — et une
  copie diverge, toujours (6.8.0, 7.29.0).
- **Une réexportation se prouve par l'IDENTITÉ, pas par le résultat.** `Core.assetSchedule ===
  Compta.assetSchedule` : « une copie qui fait pareil » passerait un test de valeur et laisserait
  deux moteurs vivre côte à côte. Le test compare les objets ; et pour `entrySet`, qui n'a jamais
  été exporté, il exige la ligne de source qui le fait venir de compta.js.
- **Un montant qui se divise sans reste ne prouve rien d'un arrondi.** Mon test de l'absorbeur
  prenait 3 600 DT sur cinq ans — 720 pile : retirer l'absorbeur ne faisait RIEN tomber, et je ne
  l'ai su qu'en essayant. Refait sur 1 000 DT en trois ans, où la dernière annuité doit porter le
  millime manquant. C'est la règle 7.2.0 appliquée au choix des **données** du test, pas à sa forme.
- **Le découpage de `app.js` par route est REFUSÉ, pas reporté une troisième fois.** Le fichier est
  une seule fermeture de 12 800 lignes : le découper demanderait des variables globales — que le
  lint existe pour interdire — ou un objet de contexte traversant tout le fichier. Le bénéfice
  serait la taille du fichier ; le coût, le risque sur 48 parcours. La dette réellement CONSTATÉE
  n'est pas la taille du fichier, ce sont les tranches de source qui se périment dans les tests
  (7.20.0, 7.21.0, 8.2.0, 9.4.6) — et celle-là se rembourse en découpant le lanceur de tests.
  **Une dette qu'on ne sait pas rattacher à un défaut réel n'est pas une dette, c'est un goût.**

### 9.8.1 — La publication elle-même

La 9.8.0 était complète, verte, poussée — et elle n'est jamais arrivée chez personne. Ce n'est pas
l'application qui a échoué, c'est **le mécanisme qui la publie**, et il n'était tenu par aucun test.

Règles apprises, à ne pas recasser :

- **Deux jobs qui créent la même ressource sont une course, pas une redondance.** Chacun des deux
  postes appelait `createRelease()` ; tous les deux demandaient la liste des releases au même
  instant, ne trouvaient rien, et créaient. Le second recevait `422 already_exists`.
  `electron-publish` rattrape ce refus pour l'envoi d'un **fichier** (`doesErrorMeanAlreadyExists`)
  et **jamais** pour la création de la release — lire la source du module plutôt que son README, la
  troisième fois que ça paie (6.7.3, 7.25.0). La page est désormais créée **une fois**, dans un job
  qui passe avant : quand les postes démarrent, elle existe, et ils ne font plus qu'y déposer.
- **Un commentaire du workflow affirmait le contraire de ce qui arrive.** Il expliquait que la page
  « existe dès que le poste Windows a fini, deux minutes avant le Mac » — le jour où le cache a rendu
  la construction macOS plus rapide, l'ordre s'est inversé et la course s'est ouverte. *Une phrase
  qui décrit un ordre que rien ne garantit est un bug* (7.3.0), y compris dans un fichier de CI.
- **Un échec sur un poste ne doit pas annuler l'autre** (`fail-fast: false`). Deux secondes de panne
  côté Windows ont annulé une construction macOS déjà bien avancée — la plus chère des deux, et la
  seule qu'on aurait gardée. Le quota est une ressource limitée (6.7.2).
- **Un tag qui ne désigne pas le commit construit ne sert à rien.** Sans `--target`, GitHub pose le
  tag sur la branche par défaut : `v9.6.0` et `v9.8.0` désignent **tous les deux** un commit de la
  9.4.1. Les installateurs publiés étaient justes ; c'est `git checkout v9.8.0` qui ne rendait pas la
  source publiée — et personne ne s'en serait aperçu avant d'en avoir besoin.
- **Le pire échec est celui qui se présente comme un succès.** `electron-publish` refuse de déposer
  dans une release publiée il y a plus de deux heures : il écrit « skipped publishing » et sort
  **vert**. Le job réussit, la release reste vide. `EP_GH_IGNORE_TIME` sur **chaque** étape qui
  publie — une seule qui l'oublie, et ce sont ses fichiers à elle qui manquent.
- **Une assertion ancrée sur une FORME est tombée sur du code juste** (douzième occurrence) : le test
  du canal bêta exigeait `steps.canal.outputs.prerelease`, le chemin exact du drapeau. Le calcul a
  déménagé dans un job à part, et le test est tombé. Retourné vers la RÈGLE : le type de release est
  décidé par un drapeau déduit du numéro de version, et **le même** drapeau décide si l'app du
  comptable se construit — quel que soit son chemin.
- **Un test qui lit du code doit lire du CODE** (quatrième fois, après 6.8.0, 7.25.0 et 9.4.10) : le
  commentaire qui explique la course CITE `gh release create`, et faisait compter deux créateurs là
  où il n'y en a qu'un. On retire toute ligne commençant par `#` — commentaire YAML comme commentaire
  de shell — et on vérifie que le nettoyage n'a pas mangé le code.

Prouvé : six défauts réintroduits un par un font tomber leur test.

### 9.8.3 — Les boutons collés, et la sonde qui mesure une RELATION

Skander : « sur l'app cabinet y'a plein de boutons qui sont mal espacés et collés au contenu ».

Règles apprises, à ne pas recasser :

- **Les trois sondes mesuraient un bouton TOUT SEUL.** Sa couleur, son débordement, l'alignement de
  sa colonne — jamais sa distance à ce qui l'entoure. Or un bouton collé au titre du dessus est
  parfaitement lisible, parfaitement dans la fenêtre, et parfaitement moche : c'est une propriété de
  la **relation** entre deux éléments, et aucune mesure d'un objet isolé ne peut la voir. La règle
  avait d'ailleurs déjà été écrite deux fois pour un cas particulier — `td.actions .btn + .btn`
  (7.29.0) et `.modal-actions` (6.8.0). **Deux correctifs ponctuels pour un défaut général, c'est le
  signe qu'il manque la mesure.**
- **Un seuil se tire du code, pas de son goût.** Mon premier jet exigeait 6 px et accusait
  `.pv-cmd { gap: 4px }` — un espacement que le projet avait explicitement choisi. Les mesures
  tracent elles-mêmes la ligne : **au-dessus de 4 px, l'espace vient d'un `gap` décidé en CSS ; en
  dessous, il ne vient de nulle part** — 3,6 px et 3,9 px sont la largeur d'une espace laissée entre
  deux balises du gabarit, et 0 px est l'absence pure. Un test trop large accuse du code juste, ce
  qui est aussi grave qu'un test trop étroit (9.1.0, 9.4.7).
- **On mesure l'ENCRE, pas la boîte.** Un bouton qui porte un fond ou une bordure a les deux
  confondus ; un bouton qui n'a ni l'un ni l'autre (`.link-add`, un lien souligné) n'est visible que
  par son texte, et son `padding` est du vide. « + description » touchait son champ de 0 px de boîte
  alors que l'œil voit ses 4 px de `padding-top` : mesurer la boîte aurait accusé du code juste.
- **Une bulle « i » est une ANNOTATION, pas un bouton voisin.** Elle DOIT toucher le libellé qu'elle
  explique — l'en écarter la ferait flotter entre deux titres. On ne la juge donc que face à un autre
  objet cliquable : deux bulles collées sont deux cibles qui se lisent comme une seule.
- **Un même composant à deux placements n'a d'espacement qu'à un seul.** `.btn-back` vit dans une
  barre `.actions` (qui porte son `gap`) dans l'app entreprise, et **seul au-dessus du titre** dans
  le Cabinet — où il se collait au nom du client, zéro pixel, sur les vingt-huit écrans d'une fiche.
  La règle vise le PLACEMENT (`#view > .btn-back`), jamais le bouton en soi : une marge posée sur la
  classe aurait désaligné l'autre usage.
- **Un correctif qui dépend d'une classe qu'on pense à mettre n'est pas un correctif.**
  `td.actions .btn + .btn` ne protégeait que les cellules portant `actions` : « PDF » et « Modifier »
  de la page Paie, dans un `td.r.nw`, restaient séparés par une espace de gabarit. La règle vise
  maintenant toute cellule et NOMME les deux grappes qui décident de leur densité.
- **Le même instrument sur les DEUX applications, du premier jour** (9.4.3) : la sonde a été écrite
  pour le Cabinet, et elle a trouvé cinq défauts dans l'app entreprise en une passe.
- **Une preuve ne vaut que sur une ligne de base VERTE** (9.7.0, re-rencontrée) : `e2e:cabinet-jour1`
  est tombé après mes corrections, et j'ai failli m'accuser. Il était **déjà rouge avant**, sur un
  défaut de la 9.8.0 que l'instrument n'avait jamais vu : le bilan actif et le bilan passif sont deux
  tableaux côte à côte dans un `.split` **sans leur `.scroll-x`** — exactement le défaut de la 3.4.0.
  Avant d'accuser son propre changement, **remettre l'état d'avant et relancer.**
- Piège de ma propre méthode : `git checkout -- <fichier>` après une preuve par réintroduction emporte
  aussi la correction non commitée. Une preuve se restaure depuis la copie qu'on a prise, jamais
  depuis HEAD quand le correctif n'y est pas encore.

Prouvé : huit défauts réintroduits un par un font tomber leur test — dont deux qui prouvent
l'instrument lui-même (la boîte au lieu de l'encre, et l'exception de la bulle, qui accusent tous
deux du code juste). 1 678 écarts mesurés dans les deux applications.

### 9.8.4 — Le bon workflow : une bêta construit LES DEUX applications

Skander : « au lieu de faire sur ta branche et publier, pourquoi pas faire le bon workflow, c'est-à-dire
sur la bêta ? » Il a raison, et c'était déjà sa décision en 7.25.0 — c'est moi qui avais dérivé, en
publiant quatorze versions d'affilée en stable direct depuis une branche de session. Mais en vérifiant
ce que le code sait faire, une ligne rendait sa proposition **inapplicable au Cabinet**, c'est-à-dire là
où vit tout le travail en cours.

Règles apprises, à ne pas recasser :

- **Un garde-fou dont la raison a disparu n'est plus un garde-fou, c'est un blocage.**
  `release.yml` sautait la construction du Cabinet sur une préversion, et son commentaire donnait deux
  raisons : les comptables « n'ont aucune case à décocher », et une bêta « remplacerait `cabinet.yml` ».
  Les deux sont fausses **depuis la 9.1.0**, qui a donné au Cabinet son canal `cabinet-beta` ET sa case.
  Le garde-fou empêchait donc uniquement de faire tester au cabinet pilote la seule application sur
  laquelle on travaille. C'est « une phrase affichée que rien ne tient est un bug » (7.3.0) appliqué à
  un fichier de CI — la deuxième fois en deux versions, après le commentaire sur l'ordre des postes
  (9.8.1). **Un commentaire qui justifie une ligne se relit quand le monde qu'il décrit a changé.**
- **Ce qui protège n'est pas l'absence de construction, c'est le CANAL.** Le vrai garde-fou vit dans
  `build/cabinet.config.js` : `channel: /-/.test(pkg.version) ? 'cabinet-beta' : 'cabinet'`. Une
  préversion écrit `cabinet-beta.yml` et ne touche jamais `cabinet.yml`. Le test vise donc cette
  ligne-là — la règle — plutôt que l'absence d'un `if:`.
- **Quatre pièces sur cinq étaient déjà en place**, et personne ne pouvait le savoir sans les lire
  ensemble : la config, `UPDATE_CHANNEL()` dans `src/cabinet/main.js`, la case de l'écran, et le relais
  (`worker/skanfact-maj.mjs` laisse passer `cabinet-beta*.yml` depuis la 9.1.0). Seule la cinquième
  bloquait. **Un mécanisme livré à 80 % ne se voit pas : il ressemble à un mécanisme absent.**
- **Deux étapes qui peuvent se contredire finissent toujours par se contredire** (6.8.0, 7.26.0) :
  l'étape Cabinet porte désormais le MÊME drapeau `releaseType` que l'étape entreprise. Il est
  redondant aujourd'hui — `preparer` a déjà créé la release — et c'est exactement pour ça qu'il serait
  oublié le jour où il cesserait de l'être.
- **La cloison des canaux se teste dans les DEUX sens.** Jusqu'ici la même release ne pouvait pas
  porter `beta.yml` et `cabinet-beta.yml` ; maintenant si. Servir la bêta du Cabinet à l'app entreprise
  lui proposerait d'installer le logiciel du comptable — le défaut que la cloison existe pour empêcher
  (7.25.0), dans le sens qui n'avait jamais pu se produire.
- **Un test écrit contre l'état du jour décrit cet état, pas la règle — treizième occurrence**
  (7.12.0, 7.26.0, 8.0.1, 8.2.0, 9.1.0, 9.2.2, 9.4.3, 9.4.5, 9.4.7, 9.4.9, 9.7.0, 9.8.1). Celui-ci
  EXIGEAIT la ligne qui bloque. Quand une règle change, c'est le test qui se relit en premier.
- **Deux des quatre preuves sont tombées sur des tests ANTÉRIEURS** (9.1.0), qui couvraient déjà la
  config et le relais. C'est le diagnostic confirmé par la preuve : le mécanisme était testé, seul le
  workflow ne l'était pas contre la vraie règle.

Le chemin complet — quand une bêta, quand une stable, et les cinq étapes — est au § « Publier une
version ».

### 9.8.5 — Un compte porte un nom de compte, un tiers le nom du tiers

Trouvé en testant le Cabinet écran par écran avec Skander, qui jouait le comptable. Le CSV d'un
paquet porte **deux colonnes distinctes** — `Tiers` (qui) et `Libellé` (quoi) — et depuis la 9.2.0 la
forme d'une ligne de `livre.json` n'avait **pas de case pour la première**.

Règles apprises, à ne pas recasser :

- **Une donnée qui n'a pas de case se réinvente, et une donnée réinventée est fausse.**
  `lignesDuLivre` fabriquait le tiers en découpant le libellé, et `assurerCompte` nommait chaque
  compte d'après **la première écriture qui le touchait** : le 606 s'appelait « Achat LOC-2026-08 —
  Agence Immobilière Le Lac » parce qu'une facture de loyer était passée avant. Six écrans faux — le
  grand livre, la balance, le lettrage, la déclaration, la saisie et l'export.
- **Le pire n'était pas l'affichage, c'était l'ÉCRITURE.** Le sélecteur de compte de la grille de
  saisie recopie le nom du compte dans le libellé de la ligne : ce nom inventé partait donc dans une
  écriture **validée, numérotée et définitive**. Un défaut d'affichage qui atteint un écran de saisie
  cesse d'être un défaut d'affichage.
- **Un compte porte un NOM DE COMPTE.** `assurerCompte` nomme par le plan comptable ; le libellé reçu
  n'est qu'un repli, pour un compte que le plan ne connaît pas. Et un compte **nommé par le cabinet**
  n'est jamais réécrit — c'est son plan, pas le nôtre (règle 6.3.0 : aucun numéro de compte n'est une
  vérité).
- **`PLAN_COMPTABLE` a déménagé de core.js vers compta.js**, réexporté à l'identique — et la
  réexportation se prouve par l'**identité d'objet**, jamais par le résultat (9.6.1). Le Cabinet ne
  charge pas core.js : la seule alternative au déménagement était la recopie, et une copie diverge.
- **Une migration rend un nom, jamais un chiffre.** `migrerLivre` tourne **à la lecture**, pas à
  l'écriture : un livre ancien retrouve ses noms de compte sans qu'aucune écriture validée ne soit
  réécrite sur le disque. Une validée ne se modifie jamais (9.2.0), et « corriger en migrant » serait
  très exactement la modifier.
- **La forme d'une ligne est une DÉCISION de format.** Le test du format couvrait le socle du livre
  et pas la ligne : c'est ce trou qui a laissé passer l'absence de `tiers` en 9.2.0. Il fixe désormais
  les sept clés d'une ligne, donc un champ ajouté demain sera une décision et jamais un effet de bord
  (même leçon qu'en 9.7.0 sur `inventaires[]`).
- **Un livre orphelin se rattache au dossier suivant qui porte le même identifiant.** Les identifiants
  de l'exemple sont stables (`MF:<matricule>`) : on le rechargeait avec des paquets neufs et un livre
  de la version d'avant. Les livres d'un dossier partent donc avec le dossier.

### 9.8.6 — L'app du comptable ne se construisait plus

La 9.8.5 est complète et verte ; c'est sa **publication** qui a échoué, du côté du Cabinet seulement,
deux secondes après le début de l'étape. Aucune ligne des deux applications ne change ici.

- **`-c <fichier>` et `-c.<clé>=<valeur>` visent la MÊME option courte.** Posés sur la même commande,
  le second gagne, et electron-builder part chercher un fichier de configuration nommé
  « `.publish.releaseType=release` ». L'étape de l'app entreprise n'a pas ce problème parce qu'elle ne
  passe aucun fichier de configuration. **Rien dans le nom des deux drapeaux ne laisse deviner qu'ils
  se disputent quoi que ce soit** — c'est la troisième fois qu'une ligne d'electron-builder se
  comporte autrement qu'attendu (6.7.3, 7.25.0), et la troisième fois que la réponse est de lire la
  source du module plutôt que son README.
- **Le même défaut n'a pas le même effet selon le SHELL** : l'étape a réussi sur macOS (bash) et
  échoué sur Windows (PowerShell). Une commande ambiguë qui « marche » sur un poste n'est pas
  correcte, elle est chanceuse — et le poste où elle échoue est, comme toujours depuis la 7.21.x,
  celui que personne ne teste.
- **Ce qui doit varier va DANS le fichier de configuration**, où c'est une donnée et non une collision
  d'arguments. Le type de release du Cabinet se déduit donc du numéro de version, à côté de son canal
  et pour la même raison (7.25.0 : une seule source de vérité). Il y était écrit `'release'` en dur :
  sur une bêta, l'étape aurait demandé une release pleine.
- **Un drapeau ajouté et jamais publié n'est pas un drapeau testé.** La 9.8.4 l'avait posé avec une
  bonne raison (« deux étapes qui peuvent se contredire finissent toujours par se contredire ») et
  n'a jamais été construite : le défaut a attendu la publication suivante, celle qui pressait.
- **Le garde-fou qui manquait** : aucune commande `electron-builder` ne peut porter à la fois
  `-c <fichier>` et `-c.<clé>=<valeur>`. C'est lui qui aurait arrêté la 9.8.5 avant de brûler une
  publication.
- **Un test écrit contre l'état du jour décrit cet état, pas la règle — quatorzième occurrence**
  (7.12.0, 7.26.0, 8.0.1, 8.2.0, 9.1.0, 9.2.2, 9.4.3, 9.4.5, 9.4.7, 9.4.9, 9.7.0, 9.8.1, 9.8.4).
  Celui de la 9.8.4 exigeait **deux** occurrences du drapeau dans le workflow : il décrivait le geste.
  La règle est que le type de release de **chacune** des deux applications se déduit du numéro de
  version ; par quel chemin ne regarde que le chemin.
- **`fail-fast: false` (9.8.1) a fait son travail** : le poste macOS, le plus cher des deux, n'a pas
  été annulé par l'échec de l'autre, et l'app entreprise est partie complète sur les deux plateformes.

### 9.8.7 — L'Intitulé porte le nom du compte, et le livre part enfin avec son dossier

Deux défauts trouvés en testant le Cabinet écran par écran avec Skander, et les deux sont des trous
de la 9.8.5 elle-même.

- **Corriger la donnée ne corrige pas l'écran qui ne l'a jamais lue.** Le grand livre, la balance et
  l'export passaient `(c, t) => t || ''` au moteur : ils affichaient le TIERS dans la colonne
  « Intitulé ». Tant que T-13 fabriquait un tiers en découpant le libellé, quelque chose s'affichait,
  faux mais visible ; la 9.8.5 a rendu au tiers son honnêteté et la colonne s'est vidée. Un résolveur
  unique (`nomDeCompte`) lit le plan du livre, puis le plan de référence, puis le tiers. La balance
  auxiliaire est l'exception NOMMÉE dans le test : là, le tiers EST l'intitulé.
- **Un test qui appelle une fonction autrement que son unique appelant ne prouve rien de
  l'application.** `removeDossierFiles` mélangeait deux conventions (un TABLEAU de dossiers pour les
  paquets, un INDEX pour les livres) ; `folderName` faisait `collisions.has(...)` sur le tableau, ça
  levait, le `catch` l'avalait, et le livre n'était jamais effacé. Mon test passait un index — j'avais
  rencontré `collisions.has is not a function` en l'écrivant, et je l'avais « corrigé » en changeant
  LE TEST. Il passe désormais ce que le seul appelant passe ; l'index se construit une fois, en tête ;
  et un échec d'effacement est RENDU au lieu de disparaître dans le journal.

### 9.8.8 — Le carnet de terrain, corrigé d'un bloc

Quarante-deux constats de `TESTS-TERRAIN.md` — deux jours de Skander jouant le comptable — corrigés
en une version, un test par constat, prouvé en réintroduisant le défaut (32 preuves), plus deux
trouvés en corrigeant. Publiée en **bêta** : c'est la règle pour ce qui change des chiffres (9.8.4).

Règles apprises, à ne pas recasser :

- **Une liste de colonnes et les lignes qui la remplissent se confrontent clé par clé.**
  `cashCsvColumns` réclamait `kindLabel`, `accountName`, `inAmount`, `outAmount` que `cashMovements`
  n'écrivait pas : quatre colonnes vides dans le journal de trésorerie de CHAQUE paquet depuis la
  6.1.0, sans un message. C'est le jumeau du `toCsv` sans entête (6.3.0) : `cashCsvRows` produit les
  lignes, et le test parcourt les colonnes.
- **Un écart se calcule avec ses deux termes.** L'écart de suspens comparait des suspens entre eux
  et ignorait le solde de départ du relevé : il ne pouvait jamais atteindre zéro, sur un relevé
  parfaitement rapproché. `suspens()` rend `soldeFin − soldeComptable(≤ au)`, et la carte affiche les
  deux termes — un chiffre dont on ne voit pas les termes ne se corrige pas.
- **Une balance auxiliaire ne somme que les comptes COLLECTIFS.** Toutes les lignes d'une pièce
  portent le tiers (411, 4358 et 706 d'une même facture) ; les sommer donnait douze clients
  exactement soldés pendant que la générale disait 411 débiteur de 2 711 DT. Le moteur
  (`balanceAuxiliaireDepuisLignes`, `COMPTES_TIERS` par RÔLE, jamais un numéro en dur) filtre sur
  les collectifs, et le verdict de l'écran confronte le total de l'auxiliaire au solde du collectif
  de la générale. **Décidé** : le tiers reste sur chaque ligne — c'est une information sur la ligne
  de TVA aussi ; ce qui était faux, c'est l'addition.
- **Un total sous une colonne est lu comme la somme de cette colonne.** « Total à décaisser »
  sautait l'IRPP imprimé juste au-dessus. Chaque case porte `composantes` ou `horsTotal`, et
  l'écran l'écrit sur la ligne ; l'IRPP reste hors total avec son « À VÉRIFIER » — on ne tranche pas
  une règle de droit en la faisant entrer dans une somme (9.1.1).
- **Un pense-bête qui s'annule annule ce qui dépendait de lui.** Annuler « déposée » en laissant
  « payée » enfermait dans un état sans issue (le bouton s'éteignait). `pointerDeclaration` rend
  `aussiPayee`, et l'écran le dit.
- **Le doublon se vérifie AVANT les soldes** : refuser dans l'ordre où l'utilisateur peut agir.
  Reprocher un solde de fin faux sur un fichier déjà importé fait corriger un chiffre pour rien.
- **Un contrôle lu une fois ne se rafraîchit jamais** (7.1.x, encore) : les contrôles de clôture
  étaient calculés au premier dessin et gardés ; `clotureRev` les recalcule quand le livre bouge.
- **Un geste qui laisse une trace se relit** : le motif de réouverture disparaissait à la seconde
  où il était donné (bandeau `#cl-rouvert`, historique) ; le dossier de clôture n'était écrit nulle
  part (`noterDossierCloture` → `exercice.dossiersProduits`, une LISTE ajoutée au format figé —
  compatible, comme `inventaires[]` en 9.7.0 — et un bouton qui l'ouvre depuis l'onglet Exercice).
- **Une sauvegarde qui n'emporte pas le fichier le plus cher n'est pas une sauvegarde.** `backupNow`
  ne copiait que `cabinet-data.json` ; les livres vivaient ailleurs. Supprimer un dossier puis
  restaurer rendait ses mois, jamais ses écritures — et un commentaire affirmait le contraire. Une
  sauvegarde NOMMÉE écrit `<nom>.livres.zip` à côté (un ZIP ordinaire, 6.1.0) ; la quotidienne non
  (trente ZIP d'un portefeuille rempliraient le disque), et `livresDansSauvegarde` rend `null`,
  jamais 0, pour que l'écran le DISE avant de restaurer. La purge emporte le ZIP avec son JSON.
- **Changer une clé rechiffre TOUT ce qu'elle protège.** Trouvé en corrigeant le point précédent :
  `setPassword` rechiffrait le fichier et ses sauvegardes, pas les livres — chiffrés avec la même
  clé dérivée. Au démarrage suivant, chaque livre du portefeuille répondait « illisible » pendant
  que l'écran annonçait « Les sauvegardes ont été rechiffrées ». Les livres du disque, puis ceux de
  chaque ZIP. Et la reprise sur un poste neuf (`adoptSource`) ne rapportait jamais `livres/` que la
  copie externe emportait depuis la 9.2.0 : le comptable avait tout bien fait (6.8.1).
- **On compte des LIVRES, pas des fichiers** : l'index du dossier et la génération précédente
  faisaient annoncer « 2 livres » à qui n'en a qu'un, dans l'inspection comme dans la reprise.
- **Un attribut posé par le code et lu par personne est le jumeau de la classe inconnue de la
  feuille** (6.8.0, 8.1.0) : les neuf « Annuler » du Cabinet posaient `data-close` quand `modal()`
  lit `dismiss`. Parfaitement visibles, parfaitement inertes (5.2.2). Un test lit les deux
  applications et exige que chaque bouton d'annulation porte l'attribut que le gestionnaire lit.
- **Ce qu'un écran nomme, il l'ouvre** (7.15.0, re-trouvée trois fois) : le lettrage nommait des
  pièces sans en ouvrir aucune ; « En face » nommait une écriture sans dire quelle ligne ; « D'où ça
  vient » ouvrait un panneau qu'il fallait aller chercher (`pageFocus`).
- **Le moteur écrit, l'écran affiche — les deux moitiés** : « Contre-passation — » vivait dans le
  libellé de PIÈCE que `lignesDuLivre` ne rendait pas ; le journal et le grand livre marquent
  maintenant l'originale et son miroir (`contrepasseDe`, `extourneDe`, `origineNumero`).
- **Un montant s'affiche par `montant()`, jamais par `toFixed(3)`** : la grille de saisie changeait
  de séparateur décimal dès qu'on tapait.
- **Un bouton de lot se déduit de ce qui est AFFICHÉ** : « Valider par lot » proposait des lots que
  le brouillard n'avait pas (`lotsDuBrouillard`).
- **Une liste déroulante dans un tableau à défilement se pose sur `body`** (`.sugg-pop.sugg-fixe`,
  `position: fixed`) : coupée par le cadre, elle n'offrait que ses deux premières entrées.
- **UNE table d'actions par racine** (9.4.8, re-trouvée) : le panneau Abonnements posait son
  `bindRowMenus` sous celui de la saisie ; il vit dans la vue Saisie et ses actions `A:` sont routées.
- **Un état vide dit sa cause** : « Équilibrée » en vert sur une balance auxiliaire VIDE (7.0.0 :
  vérifier l'univers avant de rassurer) ; « Rien à rapprocher d'office » et « Tout est déjà
  rapproché : N lignes sur N » ne sont pas la même nouvelle.
- **Le pluriel s'accorde sur chaque mot** (Cabinet 1.0.0, 7.30.0) : `pl(n, 'ligne ouverte')` ne
  savait accorder qu'un mot ; `plFr` vit aussi dans `compta.js` (corps comparé), et la garde de
  forme couvre les trois fichiers.
- Piège de test : **un commentaire de gabarit `${/* … */''}` n'est pas une ligne de commentaire**,
  le nettoyage ligne à ligne le garde, et un test est tombé sur « Regrouper tous les clients » cité
  dans le commentaire. Et `[^}]*` dans une expression régulière s'arrête à la première accolade
  d'un gabarit — `[\s\S]{0,220}` borne sans mentir.
- Piège d'outil : `$TMPDIR` vide fait de `cp "$TMPDIR/x"` une copie depuis `/x`. Une sauvegarde de
  preuve se restaure depuis un chemin ÉCRIT EN ENTIER.

**Et la publication elle-même, une quatrième fois** (6.7.3, 7.25.0, 9.8.6 : lire la source du
module, pas son README). La première bêta publiée par le « bon workflow » est partie avec
`latest.yml` et `latest-mac.yml` pour l'app entreprise — pas `beta.yml`. **electron-builder ne
déduit PAS le canal du numéro de version** : `computeChannelNames` lit `publishConfig.channel ||
'latest'`, et rien d'autre. La 7.25.0 l'affirmait, le commentaire du workflow le répétait, et le
Cabinet n'a jamais eu le trou parce que `build/cabinet.config.js` NOMME son canal depuis la 9.1.0.
Conséquence, mesurée sur la page de la release avant qu'elle ne soit corrigée : le relais sert la
première release qui porte le fichier demandé — donc `latest.yml` posé sur une préversion propose
la bêta à TOUTES les installations stables, et `isUpdateAvailable` d'electron-updater ne filtre pas
les préversions (`allowPrerelease` ne concerne que le fournisseur GitHub). Trois parades, prouvées
chacune par réintroduction : le workflow nomme `-c.publish.channel=beta|latest` d'après le MÊME
drapeau que le type de release ; le relais refuse un index stable venu d'une préversion
(`releaseAdmissible`, exporté et testé) ; et un job `verifier` relit la page après les deux
constructions — il retire tout index du mauvais canal (erreur s'il vient de ce run, avertissement
s'il restait d'avant), exige les quatre index du bon canal et compte seize fichiers. C'est la
vérification que je faisais à la main depuis la 9.8.1 ; une vérification qu'on fait à la main
finit par ne plus se faire.

**Et la bêta que le comptable ne voyait pas (9.8.8-beta.2).** Case cochée, « Vérifier maintenant »,
et l'écran répondait « Aucune version publiée pour l'instant » pendant que la bêta était en ligne
avec ses seize fichiers. Cette phrase ne peut venir que du fournisseur GitHub d'electron-updater
(`ERR_UPDATER_NO_PUBLISHED_VERSIONS`), donc du chemin de REPLI — et lu dans sa source, ce fournisseur
ne connaît que **deux** canaux de préversion, « alpha » et « beta », pris dans le tag de la release :
`cabinet-beta` n'y trouve jamais rien, et s'il trouvait, il irait chercher `beta-mac.yml`, l'index de
l'app ENTREPRISE. Le Cabinet choisit donc lui-même la release qui porte son index
(`cabcore.releasePourIndex`, pur, la règle du relais) et laisse le fournisseur GÉNÉRIQUE lire cette
page ; le canal stable ne change pas. Règles : **un mécanisme de repli se teste sur le canal qu'il
doit servir, pas seulement sur le canal par défaut** — le repli GitHub du Cabinet n'avait jamais été
essayé en bêta ; **un clic réessaie le relais** (les deux applications), parce que la cause la plus
fréquente de son échec est un index qui finissait de monter, et c'est le moment où l'on clique — les
vérifications silencieuses gardent le chemin qui a répondu ; et deux jumeaux manquants de plus
(7.3.0) : les en-têtes du relais retirés avant le repli (8.0.0) et la phrase grise de la bêta absente
(7.25.0). Le fichier `.yml` se télécharge bien depuis la page de la release en GET (un HEAD répond
401 : electron-updater n'en fait pas, mais un test à la main pourrait s'y tromper).

**Et le numéro qui bougeait à l'écran (9.8.8-beta.3, T-52).** TEST-1, datée du 4 mars et validée le
21 septembre, s'affichait « n° 1 » dans le livre-journal, et les six validées d'avant passaient 2..7.
`journalDepuisLignes` recomptait 1..n par date sur toutes les lignes qu'on lui donne — juste pour un
paquet (le client déduit ses numéros, 8.9.0), faux pour le livre, dont chaque ligne portait pourtant
le numéro écrit à la validation. **Le moteur écrit, l'écran affiche** (7.21.0) : les lignes du livre
(elles portent `ecritureId`) montrent leur numéro tel quel, un brouillard n'en a pas, et filtrer sur
un journal ne fait plus repartir le compte à 1 ; un paquet se recompte 1..n comme avant, parce que
deux paquets de deux mois peuvent donner le même « N° » à deux pièces différentes. Un journal se lit
toujours par DATE : la pièce de mars reste en tête avec son n° 12 — c'est l'ordre de validation que
le numéro raconte, pas celui du calendrier. Le parcours `e2e:saisie` lit désormais la colonne N° de
l'écran pièce par pièce contre le livre sur le disque : la règle 9.2.0 était tenue dans le fichier
et dans aucun écran.

**Et ce que la validation exige de plus que le brouillard (9.8.8-beta.3, T-48 à T-54).** La fenêtre
disait « Valider cette écriture ? AC — » sur une pièce sans référence ni libellé, la numérotait, la
figeait. Règles posées :

- **Le brouillard et la validation n'exigent pas la même chose, et c'est la MÊME fonction qui le
  dit.** `ecritureValide(e, plan, { valider: true })` ajoute ce que la validation seule réclame : un
  libellé, sur la pièce OU sur chaque ligne (`lignesDuLivre` affiche `l.libelle || e.libelle`, donc
  ce qu'on refuse est une ligne que RIEN ne nomme). Le brouillard continue d'accepter tout — c'est
  sa raison d'être. Les deux boutons de la grille s'éteignent donc sur DEUX verdicts, et
  l'enregistrement juge selon le geste DEMANDÉ : sans ce drapeau, le pont refusait après coup et
  l'écran annonçait « Enregistrement impossible » sur une pièce pourtant bien rangée.
- **Ce qu'un écran valide se NOMME.** « (sans référence) » plutôt qu'un vide ; et la référence n'est
  pas exigée pour autant — savoir si un cabinet l'impose est une règle d'organisation que personne
  n'a confirmée (9.1.1). On la montre, on laisse passer.
- **Un test trop LARGE laisse passer le défaut**, aussi sûrement qu'un test trop étroit accuse du
  code juste (9.4.7). Mon assertion « l'annonce nomme la colonne » cherchait « au débit » dans la
  fonction — or la phrase du solde, quatre lignes plus haut, écrit déjà « Il manque 191,000 au
  débit ». Elle restait verte avec l'annonce remplacée par une chaîne vide, et je ne l'ai su qu'en
  essayant de la faire tomber. On ancre sur ce qui CONSTRUIT l'annonce, pas sur un mot qu'elle
  contient.
- **Un bouton SEUL dans son conteneur n'a pas de frère** : son voisin réel est celui du conteneur,
  et c'est souvent un titre de section. La sonde d'espacement de la 9.8.3 ne regardait que les
  frères du bouton, donc elle ne pouvait pas voir « + Ajouter une ligne » collé au titre suivant.
  Elle remonte d'un cran quand le bouton est seul. **Mais « seul » veut dire SEUL** (T-49 bis) : ma
  première version comptait les ÉLÉMENTS du conteneur et ignorait son texte, donc « téléphone à
  renseigner », posé au milieu de la ligne d'identité d'une fiche, s'est retrouvé jugé contre le nom
  du client — 28 accusations portées sur du code juste, sur un écart de 3 px écrit noir sur blanc
  dans la feuille. Un conteneur qui porte du TEXTE n'est pas un emballage, c'est une phrase, et les
  voisins d'un bouton posé dedans sont des MOTS : l'espacement de la prose n'est pas le sujet de
  cette sonde. **Élargir un instrument se prouve dans les deux sens** — qu'il voie le défaut, ET
  qu'il ne voie rien ailleurs : ici la seconde moitié manquait, et c'est le parcours qui l'a dit.
- **Et en prouvant CE correctif, le trou qui explique tous les autres** (T-55) : le défaut de T-49
  remis en place, `e2e:cabinet-rendu` est resté **vert**. Il ne pouvait pas le voir — il n'ouvre
  jamais la Saisie. Sept onglets sur onze (Saisie, Déclaration, Banque, Immobilisations, Inventaire,
  Exercice, Recherche) n'existent QUE si le dossier a un livre, et le parcours cliquait le premier
  dossier venu, qui n'en a pas : il mesurait **quatre écrans sur onze** et déclarait le Cabinet
  propre. L'écran où un comptable passe ses journées n'avait jamais été mesuré une seule fois, et
  c'est pourquoi T-13, T-29, T-48, T-49, T-50 et T-53 ont tous été trouvés sur des captures. Le
  parcours crée maintenant le livre par le geste réel et **exige onze onglets**, sinon il tombe en
  nommant le compte. C'est la règle de la 9.4.3 une couche plus bas : ce n'est pas l'onglet par
  défaut qui cachait la page, c'est l'ÉTAT par défaut de l'objet qu'on ouvre. Corollaire :
  **prouver un correctif d'instrument, c'est d'abord prouver que l'instrument atteint l'écran** —
  sans quoi on mesure le vide (9.7.0, re-trouvée sur un parcours au lieu d'un lot de tests). Et le
  **jumeau manquant, encore** (7.3.0) : `cabinet-premier-jour.js` créait le livre et refaisait le
  tour depuis la 9.4.3, commentaire à l'appui (« on jugeait la page sur un sixième d'elle-même ») ;
  la leçon n'avait jamais été portée à la sonde de rendu. Une règle apprise sur un INSTRUMENT se
  vérifie sur les autres instruments, exactement comme une règle apprise sur une application.
- **Ce que l'instrument a vu dès qu'il a pu voir** (T-56, T-57), et les deux sont des écarts que
  personne n'a décidés. Un **bandeau qui porte des GESTES n'est pas de la prose** : écrit avec deux
  `margin-inline-start` posés à la main, il ne décidait que l'écart horizontal, et au premier
  passage à la ligne « Relire les paquets reçus » se collait sous « Voir le brouillard », à zéro
  pixel — un `gap` de rangée flex décide des deux à la fois. Et une **bulle « i » qui suit un
  BOUTON est une seconde cible** : les 2 px de l'annotation valent face à un LIBELLÉ, qui ne se
  clique pas ; face à un bouton, le bord de l'un est le bord de l'autre. C'est
  `button.i + button.i` (7.29.0) un cran plus large, dans la feuille PARTAGÉE. De 1 167 boutons et
  728 écarts, le parcours est passé à **2 083 boutons et 1 059 écarts**.
- Piège de lancement, et il m'a fait accuser l'environnement à tort : **un seul des cinquante
  parcours porte `xvfb-run` dans son script npm.** `e2e:cabinet-rendu` se lance seul ;
  `e2e:pages` n'ouvre pas Electron et n'en a pas besoin ; **les quarante-huit autres attendent
  d'être enveloppés** (`xvfb-run -a npm run e2e:<nom>`, comme le dit le § « Les tests qui ouvrent
  vraiment l'application »). Sans l'enveloppe, Electron répond **« Missing X server or $DISPLAY »** — cinq
  parcours rouges d'affilée sans qu'une ligne de code ait bougé. Le symptôme le dit : l'erreur tombe
  AVANT que la moindre ligne de l'application s'exécute, la première ligne du journal montre
  `> node test/e2e/…` sans `xvfb-run`, et le même code venait de passer. J'ai cherché un serveur X
  orphelin et failli écrire la règle correspondante : **une cause d'environnement se prouve avant
  d'être écrite**, sinon on grave une phrase que rien ne tient (7.3.0). Ce qui a tranché en une
  minute : un lancement d'Electron minimal sous `xvfb-run`, qui a marché du premier coup.
- **Le geste qui ALLONGE un tableau vit sous ce tableau**, avant la barre qui CLÔT la pièce — sinon
  on le cherche au-dessus d'un bouton qui enregistre, et on ne l'y trouve pas (9.4.8).
- **Un refus de validation à l'import ne s'avale pas** (9.8.0, re-trouvée) : une pièce d'un mois
  définitif qui ne passe pas reste en brouillard, et elle est NOMMÉE avec son motif. Sans ça le mois
  paraît classé pendant que deux pièces attendent.
- Piège re-rencontré, **sixième fois** : un commentaire de gabarit `${/* … */''}` écrit dans une
  expression JavaScript ordinaire casse le fichier (9.4.8). Je l'ai refait dans un ternaire.
- Et **deux assertions de plus retournées vers la règle** (quinzième et seizième fois) : celle qui
  recopiait `b.disabled = !v.ok` est tombée le jour où les deux boutons ont cessé d'exiger la même
  chose, et celle qui recopiait le libellé « Solder la dernière ligne » le jour où il a dit d'où
  l'on solde. Les deux portaient sur du code juste.

### 9.9.0 — Le cabinet à plusieurs

Règles apprises, à ne pas recasser :

- **Une identité DÉCLARÉE, pas un mot de passe par personne** — et l'écran le dit. Le mot de passe
  du cabinet ouvre déjà toute la base, celle de soixante entreprises : un second par collaborateur
  ne protégerait rien de plus, puisque qui connaît le premier lit tout. Ce que les rôles apportent,
  ce n'est pas le secret, c'est l'**attribution** (qui a validé) et les **droits** (qui a le droit
  de valider). Prétendre le contraire serait exactement le genre d'affirmation que ce projet
  s'interdit depuis « 7 pièces vérifiées, intactes » (Cabinet 1.0.0). **À VÉRIFIER** : un mot de
  passe par collaborateur devient utile le jour où un cabinet le demande — c'est alors une
  décision, pas un effet de bord.
- **La valeur par défaut est celle qui ne fait rien** (9.1.1) : aucun collaborateur déclaré → tout
  est permis, et aucun écran ne change. Tous les cabinets d'aujourd'hui sont à une personne ; une
  mise à jour ne doit enfermer personne dehors, ni lui poser une grille de droits vide — ce serait
  lui vendre un problème qu'il n'a pas.
- **Le premier collaborateur déclaré devient l'identité du poste.** Sans ça, quelqu'un qui se
  déclare « Supervision » en premier **ferme la porte derrière lui** : le poste n'est plus personne,
  un superviseur existe désormais, et plus aucun bouton ne permet d'ajouter le second. C'est « un
  réglage qui accepte un clic et se retire ensuite la possibilité de revenir en arrière » (7.12.0),
  et c'est le parcours à deux postes qui l'a trouvé — aucune relecture ne le voyait. Le PREMIER
  seulement : déclarer un collègue ne doit pas vous faire changer de nom au milieu d'une saisie.
- **Une porte UNIQUE pour les droits** (`droitBlock`), jumelle de `licenceBlockCab`. Un test relit
  la source et exige les DEUX sens : la porte sur les trente-quatre gestes qui écrivent dans le
  livre, et son **absence** sur tout ce qui lit. Sans la seconde moitié, le test laisserait passer
  une porte posée partout — c'est-à-dire des données en otage (6.4.0), et ici ce sont les pièces de
  soixante entreprises.
- **Ce qui protège du travail perdu, c'est la RÉVISION, pas le verrou.** Le verrou ne couvre que
  deux écritures simultanées ; le vrai danger du partage par fichier est silencieux — A ouvre, B
  ouvre, A enregistre, B enregistre, et la demi-journée de A a disparu sans un mot. On relit le
  disque avant d'écrire, et si la révision a bougé on n'écrit RIEN : on rend ce qu'on a trouvé, et
  l'appelant fusionne. C'est la parade de la 3.2.0, portée au livre.
- **`leverVerrou` n'avait AUCUN appelant.** Posé à chaque écriture et jamais levé, le verrou
  interdisait à l'autre poste d'écrire pendant vingt-quatre heures après un seul enregistrement.
  Une fonction écrite, exportée, testée et jamais appelée est invisible (7.3.0) — ici elle l'était
  depuis la 9.2.0.
- **Les trois règles de la fusion**, et aucune ne se négocie : (1) une écriture **validée** ne se
  fusionne jamais — elle existe ou pas, et celle de l'autre poste n'est **jamais perdue** ; (2) un
  numéro déjà pris est **signalé**, jamais réattribué (un numéro naît à la validation et ne bouge
  plus, 9.2.0) et jamais jeté — c'est le seul cas insoluble du partage, exactement comme deux
  factures émises hors ligne sous le même numéro en 3.2.0, et la parade est organisationnelle ;
  (3) un **brouillard** présent des deux côtés est gardé **deux fois**, jamais tranché : c'est un
  travail en cours, et en choisir un pour quelqu'un, c'est jeter sa demi-journée.
- **Une étape qui n'a pas d'écrivain ne BLOQUE rien.** « Révisé » sera rempli par la 9.10.0 : le
  faire barrer la route mettrait tous les mois de tous les dossiers à « bloqué à la révision » le
  jour de la livraison, et une grille entièrement rouge n'apprend rien. Il vaut `null` quand on ne
  sait pas (l'écran écrit « — », règle 9.6.0) et ne distingue que les deux états intermédiaires.
- **Un tableau de portefeuille se lit dans les INDEX, jamais dans les livres.** Soixante dossiers
  font cent quatre-vingts fichiers chiffrés ; l'état de production se calcule au moment où le livre
  est en main (`productionDuLivre`) et se range dans `livre-index.json`. C'est la mesure de la
  9.1.0 qui l'impose.
- **« Confié » et « autorisé » ne sont pas la même question.** Tout le monde a un rôle général,
  donc tout le monde peut travailler partout ; ce qui fait un « À faire » personnel, c'est
  l'attribution. Et le filtre porte sur le **PORTEFEUILLE**, pas sur les lignes d'arrivée : filtrer
  après coup laisserait chaque libellé annoncer le compte du cabinet entier au-dessus d'une liste
  réduite (6.8.1).
- **Retirer un collaborateur ne l'EFFACE pas** (`actif: false`) : son nom vit sur des écritures
  validées, et c'est la seule chose qu'un contrôle vient lire. Même règle que `retiree: true` sur
  une clé de signature (8.6.0). Et le **seul superviseur** ne se retire pas : ce serait fermer la
  porte de l'intérieur.
- **Une liste ajoutée au format du livre est une DÉCISION** (9.7.0, re-rencontrée) : `revisions[]`
  est posée maintenant et remplie en 9.10.0, pour la même raison que les trois listes vides de la
  9.2.0 — le tableau de production la lit dès aujourd'hui, et une liste dont la forme change après
  avoir été écrite chez soixante clients ne se rattrape plus. Le test du format tombe pour le dire.
- **Un test trop LARGE laisse passer le défaut**, aussi sûrement qu'un test trop étroit accuse du
  code juste (9.4.7). Deux fois dans cette version : une assertion sur le CORPS d'`ecrireLeLivre`
  était satisfaite par sa SECONDE piste d'audit (celle de la fusion), et une tranche de source
  bornée sur le seul handler suivant avalait la définition de `droitBlock` cent lignes plus bas —
  elle accusait alors un handler de lecture parfaitement innocent (7.21.0). Les deux n'ont été vues
  qu'en essayant de les faire tomber.
- Piège de parcours : `#w-skip` sur l'écran du nom laisse le cabinet **sans nom**, et un poste qui
  reprend un cabinet sans nom rouvre l'assistant. Légitime — mais un e2e qui traverse l'assistant
  en cliquant « Passer » partout ne met pas l'application dans l'état qu'il prétend tester.

Le test qui compte est `npm run e2e:cabinet-equipe` : deux postes du MÊME cabinet (le second reprend
par la copie externe — deux cabinets créés séparément ont deux sels, donc deux clés, et ne peuvent
pas lire les livres l'un de l'autre), deux collaborateurs, les droits tenus dans les deux sens, et la
fusion qui ne perd aucune validée sans toucher au fichier de l'autre poste.

### 9.9.1 — L'entretien : ce que la mesure rembourse

*Une version sur quatre ne porte aucune fonction nouvelle, par règle (`QUESTIONS.md` § 15, point 14).*

- **Un garde-fou se MESURE avant d'être gardé.** Celui de la 9.9.0 relisait le livre entier avant
  chaque enregistrement : 90 à 160 ms sur 50 000 lignes, pour un geste dont le seuil est de 100 ms.
  Il aurait coûté plus cher que ce qu'il protège. La révision vit donc dans l'**entête en clair** —
  mille vingt-quatre octets, aucune clé, 0,1 ms — et le livre ne se déchiffre que lorsqu'il y a
  vraiment conflit. Le code écrit la veille est passé de « juste » à « juste et tenable » en une
  exécution de `npm run charge` ; sans elle, personne ne l'aurait su avant le premier cabinet à
  50 000 lignes.
- **Un instrument qui mesure ce que le code n'utilise plus annonce un défaut qui n'existe pas.**
  `npm run charge` mesurait le corps **base64** alors que le livre est **binaire** depuis la 9.2.0
  — décidé par cette mesure même. Il criait donc « le format doit changer AVANT d'être écrit » sur
  un format déjà changé pour cette raison, et il était rouge depuis. C'est le jumeau de « un test
  écrit contre l'état du jour décrit cet état, pas la règle », vu du côté des mesures : **quand une
  mesure fait changer le code, c'est l'instrument qui se relit en premier.**
- **Un cinquième seuil, écrit AVANT la mesure** comme les quatre autres : « enregistrer à trois
  postes » (contrôle de révision + écriture) < 100 ms. Le geste ENTIER, pas ses moitiés — c'est lui
  qui décide du confort de saisie, pas le coût du contrôle pris à part.
- **Un champ pratique n'entre pas dans une entête en clair.** `ecritPar` y aurait permis d'afficher
  « dernier enregistrement par Amine » sans déchiffrer ; le nom d'un collaborateur n'est pas
  l'identité du fichier, et un livre égaré sur une clé USB n'a pas à nommer qui travaille dans le
  cabinet. C'est le test de l'entête — qui juge la LISTE EXACTE de ses clés, pas l'absence d'une
  chaîne — qui a posé la question, et c'est sa raison d'être.
- **Ce que la relecture des documents a retiré** : la fusion n'est plus « à venir en 9.9.0 » (cahier
  § 5.2 et § « ce qu'on ne fait pas »), le verrou n'est plus présenté comme la protection principale
  (`cabstore.js`), le Cabinet ne « ne tient pas encore de comptabilité » (`VERSIONS-A-VENIR.md`), et
  les chiffres des instruments sont ceux d'aujourd'hui. Les chiffres cités **à l'intérieur** d'une
  section de version, eux, ne bougent pas : ce sont des mesures datées, c'est-à-dire de l'histoire —
  même règle que « on ne renumérote jamais une version déjà livrée » (9.4.3).

### 9.10.0 — La révision et les questions

Le dossier de travail du comptable, et le **seul mécanisme du projet qui remonte du cabinet vers le
client**. Il ne remonte pas une écriture : il remonte une QUESTION.

Règles apprises, à ne pas recasser :

- **Le cabinet n'écrit jamais chez un client** (Cabinet 1.0.0), et ce pont-là ne fait pas exception.
  Une question est une **demande** : elle s'affiche en face de la pièce, elle attend, et rien de ce
  qui arrive par là ne touche à un chiffre. Un test de source relit toute la tranche de la 9.10.0 et
  interdit `ajouterEcriture` / `validerEcriture` : le jour où quelqu'un écrira « et si on proposait
  la correction ? », c'est là qu'il faudra s'arrêter et rouvrir la question du format avec le pilote.
- **Une question naît d'une LIGNE**, jamais d'une liste. Elle porte le compte, l'écriture et la pièce
  sur lesquels elle est née — et c'est très exactement ce qui lui permet de s'afficher chez le client
  EN FACE de cette pièce. Une question rangée dans une liste que personne n'ouvre est une question
  perdue, et le comptable finit par téléphoner : c'est tout l'intérêt du mécanisme.
- **La méthode de révision appartient au comptable.** Les sept cycles PROPOSENT un rattachement par
  préfixe (le plus long gagne, comme partout depuis `libelleDuPlan`) ; la table du cabinet les
  REMPLACE entièrement — jamais un mélange, qui donnerait un rattachement que personne n'a décidé.
  Le questionnaire de fin d'exercice part **VIDE** : les cinq questions les plus fréquentes du pilote
  ne sont pas connues, et les inventer serait écrire sa méthode à sa place (règle 9.1.1). Un test
  tombe si quelqu'un y écrit une question « d'exemple ».
- **Une feuille maîtresse ne lit que les VALIDÉES** : on ne révise pas un brouillard, qui par
  définition n'est pas encore un fait. Les contrôles le NOMMENT avant d'arrêter une révision, sans
  jamais bloquer (règle 6.0.0).
- **Les réponses voyagent DANS le paquet**, jamais dans un envoi à part : c'est déjà le geste mensuel
  du client, et une réponse qu'il faut penser à envoyer séparément n'est jamais envoyée. Et le
  fichier n'existe que s'il y a quelque chose à dire — un `reponses.json` vide dans chaque paquet
  apprendrait au cabinet à ne plus l'ouvrir.
- **Une question DÉJÀ PARTIE se ferme, elle ne s'efface pas.** Le client l'a sous les yeux : la faire
  disparaître de notre côté le laisserait répondre à une question qui n'existe plus.
- **La règle des DEUX paquets vaut des deux côtés**, et le seuil est le MÊME objet lu par les deux
  applications (`QUESTION_RELANCE`, réexporté à l'identité). Deux chiffres écrits à deux endroits
  divergent, et les deux applications ne diraient plus la même chose de la même question.
- **L'envoi se note APRÈS l'écriture du fichier.** Une question comptée comme partie sur un fichier
  qu'on n'a pas su écrire ferait croire au client qu'il l'a déjà vue — et c'est précisément ce
  compteur qui décide de la relance.
- **Une réponse plus ANCIENNE ne remplace pas une plus récente** : le client peut renvoyer un vieux
  paquet, et la réponse d'hier écraserait celle d'aujourd'hui.
- **La révision se fusionne par PÉRIODE, jamais par identifiant** (9.9.0) : un compte signé sur un
  poste l'est pour le dossier, et une période arrêtée d'un côté reste arrêtée — on ne défait pas la
  révision d'un collègue parce que notre copie ne l'avait pas vue.
- Piège de test, **quatrième fois** (6.8.0, 7.25.0, 9.4.10) : mon assertion « le paquet emporte les
  réponses » cherchait `reponses.json` dans la source BRUTE, et le commentaire qui explique la règle
  porte ce mot. Elle restait verte avec le fichier renommé. Trouvé en réintroduisant le défaut,
  jamais autrement.

Prouvé : 16 défauts réintroduits un par un font tomber leur test.

### 10.0.0 — La liasse et l'annuel

La dernière version du plan accepté le 11/09/2026, et le document où une erreur coûte le plus cher.

Règles apprises, à ne pas recasser :

- **Aucune rubrique de liasse n'est une vérité**, exactement comme aucun numéro de compte n'en est
  une (6.3.0). Le modèle livré suit l'usage ; la présentation exacte du système comptable des
  entreprises n'est validée par personne, et la liasse réelle du pilote n'a pas encore été produite.
  Chaque rubrique est une ligne de table modifiable, chaque écran porte « À VÉRIFIER », et la table
  du cabinet REMPLACE la nôtre.
- **Le SENS du solde départage deux rubriques de même préfixe.** Le 44 débiteur est une créance sur
  l'État, le même 44 créditeur est une dette envers lui : les deux rubriques existent et portent le
  même préfixe. Sans ce départage, la TVA à décaisser se retrouve à l'actif — et le bilan tombe
  quand même juste, ce qui est le pire des cas.
- **Ce qu'aucune rubrique ne capte est MONTRÉ.** Une liasse qui perd un compte en silence est une
  liasse fausse, et personne ne s'en aperçoit avant le contrôle.
- **Une rubrique qu'aucun compte n'a remplie vaut « — » avec sa raison, jamais 0** (règle 9.6.0) :
  un zéro se recopie sur un formulaire, un « — » se demande au comptable.
- **Un montant de rubrique est toujours POSITIF ; c'est le SENS de la rubrique qui le retranche.**
  Ma première version stockait l'amortissement négatif ET le retranchait : il s'AJOUTAIT, et l'actif
  dépassait le passif de deux fois l'amortissement. Une seule règle pour les trois états — `deduit`
  ou `charge` se retranche, le reste s'ajoute — parce que deux règles distinctes divergeraient au
  premier état ajouté.
- **Aucun taux d'impôt n'existe dans le code**, et un test relit la source pour l'interdire : le taux
  dépend de la forme juridique, du secteur et de la loi de finances de l'année — trois choses qu'un
  logiciel écrit en 2026 ne peut pas suivre (règle 5.0.0). Tant qu'il n'est pas saisi, l'impôt vaut
  `null` et la RAISON s'affiche à sa place. Le **minimum d'impôt** n'est pas calculé non plus : il
  dépend d'une règle de droit que personne n'a confirmée, et un chiffre inventé sur une déclaration
  coûte plus cher qu'une case vide.
- **Le montant d'un retraitement est positif ; c'est sa NATURE qui dit dans quel sens il joue.** Un
  montant signé laisserait saisir « −200 » en réintégration, c'est-à-dire une déduction déguisée que
  personne ne relirait comme telle. Et une base imposable **négative n'existe pas** : elle est nulle
  et le déficit se reporte — un impôt négatif serait un crédit d'impôt inventé.
- **La déclaration d'employeur dit ce qu'elle ne peut PAS donner** : le détail par bénéficiaire
  demande les bulletins, que le cabinet ne reçoit pas. Elle ne livre que les masses, et la phrase le
  dit — même exigence que « 7 pièces vérifiées, intactes » (Cabinet 1.0.0).
- **Une phrase qui niait une fonction absente ment le jour où la fonction existe.** « Ce n'est pas la
  liasse NCT 01 » était juste tant que la liasse n'existait pas ; la garder maintenant dirait faux.
  C'est « une phrase affichée que rien ne tient est un bug » (7.3.0), vu de l'autre côté.
- **Des états financiers qui n'engagent personne ne valent rien** : le PDF envoyé au client porte son
  cadre de signature, laissé vide pour le cachet — c'est ce qu'un portail et un contrôleur attendent.
- **F-9.6.0-12, la ligne que la 9.6.0 n'avait pas livrée.** Le champ « Régime fiscal » existait sur
  une fiche depuis la 6.8.0 et **personne ne le lisait** : le calendrier réclamait une TVA mensuelle
  à tout le monde, y compris à un forfaitaire qui n'en dépose pas. Ce qui est livré n'écrit toujours
  AUCUN droit : la table part vide, et tant qu'elle l'est rien ne change à l'écran. C'est le cabinet
  qui déclare SES régimes. Un champ lu mais jamais écrit donne un chiffre faux tous les jours
  (7.3.0) ; celui-ci était écrit et jamais lu, ce qui revient au même.
- **Un mois ABSENT ne se borne pas à janvier.** Une échéance annuelle saisie sans mois vaut 0 et la
  ligne est jetée ; un mois hors bornes (99) se borne à 12. Borner une valeur manquante invente une
  date que personne n'a donnée ; borner une valeur aberrante corrige une faute de frappe sur une
  intention claire. C'est le test qui a fait la distinction.
- **Un handler qui remplace une identité doit vérifier qu'elle est FOURNIE.** `cab:saveCabinet`
  écrasait le nom du cabinet par une chaîne vide dès qu'un écran n'envoyait que des réglages — et un
  cabinet sans nom rouvre l'assistant de bienvenue au démarrage suivant. Tous les appelants pensaient
  à recopier `...S.cabinet` ; le premier qui l'oublierait aurait effacé l'identité sans un mot. Le
  piège vivait dans le handler, il se répare dans le handler.
- **Un exemple à huit mois ne peut pas démontrer une liasse.** Elle porte sur un EXERCICE : le jeu
  d'exemple passe à douze paquets ouvrables sur un dossier, et gagne un **client hors SkanFact** —
  un cabinet a soixante clients dont deux sur SkanFact (6.8.0), et c'est ce dossier-là qui compte
  dans sa licence. Un dossier sans paquet n'a aucun `ingest` pour le créer : il se pose à la main,
  sinon il n'existe tout simplement pas.
- **Un seuil de test qui obligerait à gonfler l'exemple rend l'exemple faux.** Les premiers mois du
  jeu de démonstration sont sincèrement légers — une entreprise qui démarre ne fait pas soixante
  pièces en septembre. Le seuil vaut désormais par mois ET sur l'ensemble : aucun mois n'est un
  jeton, et l'exercice entier est dense.
- **Un test dont le jeu de données ne peut pas discriminer ne prouve rien** (9.6.1, re-rencontrée).
  Ma preuve du « préfixe le plus long » passait avec le départage retiré : le modèle livré ne contient
  aucun préfixe imbriqué du même sens, donc il ne POUVAIT pas l'attraper. La table d'un cabinet, elle,
  en aura — « 4 » pour tout, « 411 » pour les clients, c'est la première chose qu'on écrit. Le test
  s'appuie maintenant sur une table imbriquée, et vérifie en plus que retourner le tableau ne change
  rien.

**Ce qui n'y est pas, et pourquoi** : la page Tarifs et le téléchargement du Cabinet vivent dans le
dépôt du site, pas ici. Et la liasse **n'a pas encore été confrontée à un document réel** — c'est ce
que cette version demande au cabinet pilote, et tant que ce n'est pas fait, chaque écran porte son
« À VÉRIFIER ».

Prouvé : 17 défauts réintroduits un par un font tomber leur test.

### 10.0.1 — Les pannes se disent en français, et l'outillage cesse de crier pour rien

Le premier lot de l'audit de mise en production. Correctif : rien ici ne touche à un chiffre, à une
clé, au moteur comptable ni au format d'un fichier — c'est le cas que la règle de publication
autorise en stable direct.

Règles apprises, à ne pas recasser :

- **Une panne du SYSTÈME se traduit au pont, pas au point d'appel** — « on enveloppe une fois, pas
  quatre-vingts » (9.4.10), appliqué cette fois aux codes d'erreur de Node. Dix codes
  (`ENOSPC`, `EDQUOT`, `EACCES`, `EPERM`, `EROFS`, `EBUSY`, `ENOENT`, `EIO`, `EMFILE`, `ENFILE`)
  rendent une phrase française ; les tables des deux applications sont **identiques au caractère
  près** et un test compare les corps (motif `round3`). Et `err.code` **ne traverse pas le pont
  IPC** (9.4.10) : la traduction lit `e.code` ET le préfixe du message, parce que l'un des deux
  seulement finit par arriver.
- **Un refus qu'on a ÉCRIT n'est pas une panne** (9.4.10, re-trouvée en écrivant ce lot) : seul ce
  qu'on n'a pas prévu se traduit et va au journal. Traduire un refus métier le déguiserait en
  incident, et un journal plein de mots de passe mal tapés ne se lit plus.
- **Ce qui dit qu'un travail est PERDU ne peut pas s'effacer tout seul.** Un enregistrement qui
  échoue ouvrait un bandeau de 2,6 secondes ; il ouvre une fenêtre, qui dit ce qui s'est passé,
  rappelle que **ce qui est à l'écran est intact**, et propose « Réessayer ». C'est le pendant de
  « le premier message d'un logiciel ne peut pas être un toast » (7.0.0), pour le dernier.
- **Deux gestes qui écrivent le même état ne peuvent pas courir ensemble.** Deux imports de paquets
  simultanés dans le Cabinet : le second effaçait le travail du premier, sans un mot. Le garde-fou
  se pose **avant** le sélecteur de fichier — après, on a déjà fait choisir pour rien.
- **Un fichier qui part dans le paquet du comptable doit avoir son écran.** Le journal des
  règlements fournisseurs y allait depuis la 6.1.0 et n'était visible NULLE PART : ni lisible, ni
  triable, ni exportable. C'est « un moteur sans écran n'existe pas » (7.3.0), vu par l'autre bout —
  ici le moteur tournait, ses résultats sortaient, et personne ne pouvait les regarder.
- **La RAISON d'un refus change le geste, donc elle se lit.** « Dossier introuvable (support
  débranché ?) » sur un dossier que le système refuse d'ouvrir envoie chercher une clé USB qui est
  là. Quand `e.code` donne la cause, on ne la devine pas. Même chose pour un fichier de données
  illisible : l'écran garde sa phrase, le JOURNAL reçoit la raison — c'était le seul endroit du
  stockage où une erreur disparaissait sans trace.
- **Un garde-fou que rien n'arme est pire qu'un garde-fou absent : il rassure.** `emissionEnCours`
  était `false` pour toujours, et le test de la 9.1.0 le cherchait par son NOM. Ce qui protège
  réellement du double numéro, c'est le bouton qui se désactive pendant l'attente **et** le fait
  que `issue()` ne rende jamais la main entre le contrôle et `nextNumber`. Le test exige désormais
  cette règle-là : **aucun `await` dans le corps d'`issue()`** — un `await` posé là un jour
  rouvrirait le trou sans qu'aucun écran ne le montre. C'est la quinzième fois que le motif
  « un test cherche une mention là où il faut exiger la branche » (7.2.0) revient.
- **Un avertissement de lint qui ne peut pas être corrigé finit par cacher ceux qui comptent.**
  Quatre-vingt-dix avertissements dont quatre-vingt-cinq décrivaient une convention volontaire
  (`catch (_)`), et au milieu : onze variables mortes, dont **deux dont le commentaire décrivait un
  mécanisme inexistant** (un cache jamais relu, une clé publique sans appelant) et **une qui
  désignait un vrai défaut** — `EXPLORATEUR()` existait pour ne pas parler du « Finder » à un
  comptable sous Windows, et n'était appelé nulle part pendant que l'écran disait « le Finder ».
  Zéro avertissement désormais, et c'est ce qui rend le prochain lisible.
- **Une valeur mesurée AVANT un geste et jamais comparée APRÈS est une moitié de test.** Trois
  parcours le faisaient depuis des versions : la restauration vérifiait que le client ajouté avait
  disparu sans jamais vérifier que les autres étaient revenus (une restauration qui vide tout
  passait) ; la validation par lot vérifiait « 1..n sans trou » sans vérifier que les numéros
  **déjà attribués n'avaient pas bougé** (une renumérotation complète donne 1..n tout autant) ; et
  le libellé du bouton de clôture était lu sans qu'on exige qu'il NOMME la période. Le lint les a
  désignés : c'est exactement ce à quoi sert un lint qu'on peut encore lire.
- **Un seuil de charge se pose là où la base passe, et l'écart se DIT.** `npm run charge:entreprise`
  mesure dix ans d'activité sur les vraies primitives (chiffrement, écriture atomique). Cinq seuils
  passent largement ; le sixième — la préparation du paquet mensuel — a d'abord été posé à 1 000 ms
  et rendait 0,9 à 1,4 s selon la pression mémoire, c'est-à-dire un instrument qui tombe au hasard
  sur le même code. Mesuré morceau par morceau, le coût vient de `balanceGenerale` (641 ms) et de
  `journalEntries` (129 ms en juin, **526 ms en janvier**, à cause des à-nouveaux) : par
  construction ces deux-là lisent depuis le début de l'exercice, pas du mois. Ce n'est pas un défaut,
  c'est ce que ces chiffres coûtent quand ils sont justes. Seuil posé à 2 000 ms **avec la raison
  écrite dans le script** — « un instrument rouge est un instrument qu'on désactive » (9.1.0) — et
  la marge la plus étroite des six est nommée comme telle.
- **Le meilleur de trois passages, et on le dit.** Le calcul est déterministe : ce qui varie vient
  de la machine. Le minimum est l'estimation la plus proche du coût réel, et surtout un instrument
  qui passe ou tombe au hasard cesse d'être lu. Ce n'est honnête que parce que la sortie l'écrit.
- Piège : `pagerBar` **borne `st.page`** en plus de rendre son HTML. Un appel dont on jette le
  retour n'est donc pas mort — il se commente, sinon il se supprime.

### 10.1.0 — La devise d'un achat

Trouvé en répondant à « est-ce que ce qu'on a développé répond vraiment au métier ? » : **un achat
n'avait aucune devise**. Une facture fournisseur de 1 000 € comptait 1 000 dinars dans la TVA
déductible, les charges, le résultat, le seuil de rentabilité, le stock, la trésorerie, les
écritures et le paquet du comptable. C'est la faute de la 7.0.1 et de la 7.16.0, **jamais portée du
côté des achats** — le jumeau manquant (7.3.0), sur des chiffres qui partent chez un tiers.

Règles apprises, à ne pas recasser :

- **Les montants NATIFS et les montants de BASE portent des noms différents**, et c'est ce qui rend
  l'oubli lisible. `purchaseTotals` rend les montants tels que le fournisseur les a écrits — c'est
  ce que l'écran de la pièce affiche — et `t.base` les mêmes convertis. Un agrégateur qui lirait
  `t.totalHT` au lieu de `t.base.totalHT` se voit à la relecture, au lieu de se fondre dans le
  paysage. C'est l'inverse de la convention des ventes (où l'appelant convertit), et l'asymétrie est
  assumée : côté achats il y a UN écran natif contre treize agrégateurs.
- **Un test de couverture se prend par le comportement, pas par la source.** Un test statique
  (« chaque agrégateur mentionne `.base` ») aurait été une FORME, fragile et satisfaisable par
  accident. À la place : un achat de 1 000 € à 3,4 et chaque agrégateur interrogé pour de vrai —
  3 400 est un chiffre qu'aucun arrondi ne produit depuis 1 000. Treize lignes, treize preuves par
  réintroduction, et un agrégateur oublié demain tombe nommément.
- **L'absorbeur d'arrondis avalait n'importe quoi.** `entrySet.done()` existe depuis la 6.3.0 pour
  les quelques millimes d'une TVA calculée ligne par ligne ; il absorbait en réalité TOUT écart, et
  rendait une pièce équilibrée, plausible et fausse. La preuve par réintroduction l'a dit : le
  défaut remis (le fournisseur crédité du montant natif) laissait **2 856 DT** de trou et la pièce
  sortait juste — donc mon test ne pouvait pas le voir, et un vrai défaut du même genre passerait
  de même. On continue d'équilibrer, mais au-delà d'un millime par ligne — le maximum que `round3`
  peut laisser, pas un seuil choisi au jugé — l'écart est MARQUÉ (`ecartAbsorbe`). Et un test exige
  qu'aucune écriture des 24 mois du jeu d'exemple n'en porte : un marqueur qui parlerait tout le
  temps cesserait d'être lu.
- **Une assertion sur des TOTAUX ne prouve rien d'une LIGNE** quand un mécanisme rééquilibre. La
  bonne assertion vise la ligne fournisseur, plus la somme. Sans la preuve par réintroduction, je
  n'aurais jamais su que cette assertion-là ne pouvait pas échouer — c'est la seule méthode qui le
  dise (7.2.0).
- **Le test d'un AUTRE module a trouvé le treizième agrégateur.** `cashMovements` sortait le montant
  natif du compte ; c'est l'assertion « la trésorerie du bilan est celle de la page Trésorerie »
  (9.0.0) qui est tombée, sur un écart valant exactement la conversion. Deux écrans qui disent la
  même chose ne peuvent pas se contredire (6.8.1) — et c'est ce contrôle-là qui a fait le travail,
  pas ma relecture.
- **Un signalement se dédouble quand le GESTE qui le règle est ailleurs.** Les pièces de vente sans
  taux et les achats sans taux ont deux lignes dans « À faire », parce qu'elles mènent à deux listes
  différentes. Une seule ligne enverrait la moitié des gens sur un écran où ce qu'on vient de leur
  annoncer n'existe pas (7.15.0). Le test de couverture de `TODO_ACTIONS` (7.0.0) a réclamé son
  bouton dans la seconde.
- Piège de test : `employerAnnual(data, year, company)` — pas `(data, company, year)`. Et
  `stockOf` rend `cmp` (coût moyen pondéré) et `value`, pas `unitCost`. Un test qui invente une
  signature échoue sur du code juste.
- Piège de données : l'application écrit le dinar **`DT`**, pas `TND` ; `normCurrency('TND')` rend
  `DT`. Un jeu d'essai qui pose `TND` à la main se fait corriger par la migration et fait échouer
  l'assertion sur autre chose que ce qu'elle teste.

### 10.2.0 — L'avoir fournisseur, l'acompte versé et le relevé de compte

Règles apprises, à ne pas recasser :

- **Le SENS d'une pièce se porte dans `base`, jamais dans la mémoire de chaque agrégateur.** Côté
  ventes, `type === 'avoir' ? -1 : 1` est recopié dans une quinzaine d'endroits depuis la 1.4.0, et
  le premier qui l'oublie fabrique un chiffre faux que rien ne montre. Côté achats, `purchaseTotals`
  rend `sens` et signe `base` : les treize agrégateurs passés à `.base` en 10.1.0 sont devenus justes
  **sans une ligne de plus**, et celui qu'on écrira demain le sera aussi. C'est la même leçon que la
  devise, une couche plus haut — et c'est ce qui rend une règle structurelle meilleure qu'une règle
  qu'on répète.
- **Un avoir se saisit en POSITIF.** C'est ce que le fournisseur a écrit sur sa pièce, et aucune
  comptabilité n'accepte un débit négatif (règle 6.3.0) : `entrySet` change la colonne tout seul.
- **Un acompte versé n'est pas une charge**, et le dire à chaque agrégateur aurait été le défaut
  qu'on venait de corriger : ses `byDestination` sont VIDES et le montant vit dans `base.avance`.
  Le résultat, le seuil de rentabilité, la marge d'une affaire et le stock deviennent justes sans
  rien savoir de lui ; seul `journalEntries` connaît `avance`, parce que lui seul doit décider du
  compte.
- **L'imputation d'un acompte REPREND ce que l'acompte avait posé, TVA comprise.** La TVA de la
  facture porte sur le montant entier, acompte compris : garder celle de l'acompte la déduirait deux
  fois. Trouvé par le test qui vérifie que le 409 revient à zéro — une imputation qui ne rendait que
  le TTC laissait le compte d'avances débiteur de la TVA, pour toujours.
- **Un avoir IMPUTÉ ne vaut plus rien tout seul.** Le compter en plus comme un crédit ferait payer
  deux fois moins ; et un règlement porté dessus — le fournisseur qui rembourse EN PLUS d'avoir
  avoisé — ne doit pas le transformer en dette. C'est ce cas-là qui a fait retirer un garde-fou
  REDONDANT de `payablesList` : un filtre qu'aucun test ne peut faire tomber est le miroir exact
  d'un test qui ne peut pas échouer (7.2.0). La décision se prend à UN endroit, `purchaseBalance`.
- **Le lettrage compte dans les DEUX sens.** Un avoir non imputé laisse le fournisseur DÉBITEUR :
  ne regarder que les restes positifs faisait dire au lettrage un chiffre différent du solde du 401,
  sur la même donnée. `Math.abs(remaining)`, et les deux écrans se rejoignent (règle 6.8.1).
- **Un avoir et la facture qu'il vise sont dans la MÊME devise.** Un fournisseur avoise dans la
  monnaie où il a facturé ; déduire 300 € de 1 000 DT donnerait un reste dû faux que personne ne
  verrait. L'éditeur le refuse en nommant les deux devises.
- **Un avoir peut porter le même numéro qu'une facture** : ce sont deux séries. `achatDoublon` ne
  compare que des pièces de même nature, sinon il accuse une pièce parfaitement juste.
- **Un relevé de compte se DÉDUIT à l'instant où on l'imprime**, comme un statut. Un relevé
  enregistré se périmerait au premier encaissement, et on l'enverrait faux.
- **Un avoir de vente RATTACHÉ est déjà dans le reste dû de sa facture** : le remontrer sur le relevé
  le compterait deux fois et donnerait un relevé deux fois trop favorable. Seul un avoir LIBRE fait
  une ligne.
- **Un en-tête de fiche a un budget de boutons**, comme une ligne de liste (7.29.0, porté du Cabinet
  en 9.4.8). « Écrire » dépend d'une adresse qu'un client sur deux n'a pas : la barre changeait de
  forme d'une fiche à l'autre. Les trois gestes rares vivent dans un menu « Actions ».
- **Un filtre qui n'est pas un statut vit quand même dans le sélecteur de statuts** : « à rattacher »
  est une QUESTION, pas un état, mais c'est là qu'on la cherche — et elle se réinitialise comme les
  autres, parce qu'un filtre actif qu'on ne voit pas est un piège (9.4.6).
- **UNE table d'actions par racine (9.4.8), et deux tables sur la même racine SE MANGENT.**
  `bindDocTable` posait la sienne sur `document` : elle retirait donc tout bouton de menu qu'elle ne
  reconnaît pas — c'est sa règle (7.29.0, une ligne sans action perd son bouton) — et le bouton
  « Actions » de l'en-tête de la fiche client disparaissait à chaque dessin du tableau des
  documents, sans une erreur nulle part. Elle vit maintenant sur l'ancre du TABLEAU, que
  `bindDocTable` recevait déjà pour sa pagination. Seul le parcours réel pouvait le voir : le
  gabarit était juste, et la relecture ne montre rien.
- Piège de données, re-rencontré : une pièce de la démo se retrouve par son NUMÉRO, jamais par son
  indice (10.1.0). Les trois pièces ajoutées auraient sinon décalé les fiches d'immobilisation.

Prouvé : **quinze défauts réintroduits un par un** font tomber leur test — dont celui de l'avoir
imputé et remboursé, qui n'existait qu'en cherchant ce que le garde-fou redondant protégeait vraiment.

### 10.3.0 — La paie des clients, dans le Cabinet

Le travail mensuel le plus réclamé après la TVA, et le Cabinet ne savait pas le faire. Un cabinet a
soixante clients dont deux utilisent SkanFact : pour les cinquante-huit autres — ceux qui PAIENT —
le comptable établissait les bulletins ailleurs et RETAPAIT l'écriture à la main.

Règles apprises, à ne pas recasser :

- **La règle de découpage de la 9.1.0 se relit dans les deux sens** (9.6.1, re-rencontrée). Le
  moteur de paie prend un SALARIÉ et une SAISIE, jamais `data` : il était du mauvais côté depuis la
  5.0.0, et ça ne s'était jamais vu parce que personne d'autre n'en avait besoin. Le Cabinet, lui,
  en a besoin et ne charge pas core.js ; la seule alternative au déménagement était la recopie, et
  deux moteurs de paie divergent au premier ajustement. La réexportation se prouve par l'**identité
  d'objet**, jamais par le résultat.
- **Deux applications, un seul bulletin.** Un test pose la même saisie des deux côtés et compare le
  calcul ENTIER : sans lui, le client et son comptable auraient deux bulletins pour le même mois
  sans moyen de savoir lequel croire — la même exigence que la parité des balances (9.1.0).
- **Une liste AJOUTÉE à un format figé est compatible ; un champ renommé ne l'est pas** (9.7.0,
  re-rencontrée). `livre.json` gagne `salaries[]` et `bulletins[]`, et c'est le test du format qui
  l'a demandé en tombant : un ajout reste une DÉCISION, jamais un effet de bord. `migrerLivre` les
  rend à la LECTURE, sans réécrire le fichier.
- **Un bulletin garde une COPIE de son calcul** (5.0.0, portée au Cabinet), taux compris : changer
  un barème plus tard ne réécrit jamais un bulletin déjà remis à un salarié. Et un bulletin dont
  l'écriture est PASSÉE ne se modifie plus — on contre-passe, puis on refait (même règle qu'une
  dotation, 9.7.0).
- **Chaque bulletin retient l'écriture qui le porte.** Sans ce report, le bouton se rallumerait et
  la paie du mois serait comptée deux fois — le défaut de la dotation, à l'identique.
- **Un salarié qui part ne s'EFFACE pas** : son nom vit sur des bulletins déjà établis, et un
  bulletin remis ne se réécrit pas. Il devient inactif — même règle que `retiree: true` sur une clé
  de signature (8.6.0).
- **Un contrôle NOMME les gens.** « 3 salariés sans bulletin » ne se traduit en aucun geste ;
  « Sonia Khelifi, Karim Ben Ali » si. Et rien ne bloque : un mois traité avec deux manques
  signalés vaut mieux qu'un mois jamais traité (règle 6.0.0).
- **Le numéro CNSS n'empêche pas de calculer, il empêche de déclarer** : on le signale, on ne refuse
  pas. La valeur par défaut d'une règle qu'on ne connaît pas est celle qui ne fait rien (9.1.1).
- **Un trimestre qui bascule sur l'année suivante** : l'échéance du 4e trimestre est au 15 janvier
  de l'année d'après, pas au « 2026-13-15 ». C'est le genre de date qu'un test attrape et qu'aucune
  relecture ne voit.
- **UNE table d'actions par racine** (9.4.8, re-rencontrée le même jour que la 10.2.0) : celle de la
  Paie vit sur SON panneau, jamais sur `document`.
- **L'instrument suit la fonctionnalité** : `e2e:cabinet-rendu` exigeait douze onglets de
  comptabilité, il en exige treize. Un seuil qui ne bouge pas quand un écran s'ajoute laisse
  l'écran neuf hors de toute mesure — c'est très exactement T-55 (9.8.8), un onglet plus loin.

Prouvé : **quatorze défauts réintroduits un par un** font tomber leur test.

### 10.4.0 — L'espace de gestion des deux plateformes

Skander : « et après on passera à la gestion des deux plateformes… afin d'avoir le contrôle dessus
autant que auditeur ». En regardant ce que la console savait faire, deux trous se sont ouverts.

Règles apprises, à ne pas recasser :

- **Un instrument qui ne couvre qu'une des deux applications ne protège qu'une des deux** (9.4.3,
  re-trouvée un cran plus haut) : la console ne voyait QUE SkanFact. Le Cabinet porte sa licence
  depuis la 9.4.0 et son canal d'essai depuis la 9.1.0, et n'existait nulle part — ni son nombre de
  postes, ni ses versions, ni ses installations disparues. Un éditeur qui ne voit qu'une moitié de
  son parc ne la contrôle pas, il la découvre. C'est le **jumeau manquant** (7.3.0) appliqué non
  plus à une règle ni à un instrument, mais à une TÉLÉMÉTRIE.
- **Ce qui part est écrit en toutes lettres, et un test compte les champs.** La clé, l'identité du
  poste, le système, la version, le nom de l'application — rien d'autre. L'app du comptable détient
  la comptabilité de dizaines d'entreprises : un jour quelqu'un voudra « juste ajouter » un compteur
  de dossiers pour s'y retrouver, et c'est ce test qui doit l'arrêter. Le test de l'app entreprise
  (8.4.0) a d'ailleurs TOMBÉ à l'ajout de `app` — c'est exactement pour ça qu'il liste les champs :
  un champ ajouté est une **décision**, jamais un effet de bord.
- **Une colonne s'AJOUTE, aucune ne se renomme** (9.4.1, 9.7.0, re-rencontrée) : `activations.app`,
  `NULL` = tout ce qui précède, c'est-à-dire l'app entreprise, seule à s'annoncer alors. Le fichier
  `schema-a-coller.sql` est **engendré** : le modifier à la main fait tomber le test de parité, et
  c'est lui qui a rappelé que la source est `schema.sql`.
- **« Endormi » n'est pas « perdu ».** Une installation qu'on n'a pas vue depuis trente jours peut
  être un portable refermé pour les vacances : elle se compte À PART, elle ne se retranche pas.
  Sans cette nuance, un mois d'août passe pour un parc qui rétrécit — et la somme des deux doit
  faire le total, sinon quelque chose a disparu en route.
- **Une version se compare en NOMBRES.** `10.3.0` est plus récent que `9.8.8`, ce qu'un tri de
  chaînes dit exactement à l'envers ; et une préversion passe AVANT la version qu'elle prépare.
- **Avant de crier, vérifier que l'univers concerné est non vide** (7.0.0, trouvée ici par le
  parcours réel) : la console d'un éditeur qui n'a rien vendu n'a rien à perdre, et réclamer la copie
  du néant sur son tout premier écran apprend à ignorer les alertes. C'est l'e2e qui l'a montré —
  l'onglet d'entrée est devenu « À décider », et sur une base vide il affichait une alerte.
- **Une alerte qu'on ne peut pas ouvrir est une inquiétude, pas une tâche** (7.15.0) : chaque ligne
  nomme l'onglet qui la règle, et un test confronte ces noms à la table des onglets de la console —
  deux tables séparées divergent, toujours.
- **L'export porte un COMPTE par table**, et son empreinte ne porte pas sur elle-même : un manifeste
  ne peut pas contenir sa propre empreinte (6.1.0). Un export tronqué ressemble à un export complet,
  et c'est le jour où l'on en a besoin qu'on s'en aperçoit.
- **Le fichier va à côté des CLÉS, jamais dans les données** : il porte la liste des clients et des
  ventes de l'éditeur. `~/.skanfact/`, mode 0600, écriture atomique — un export à moitié écrit
  ressemble à un export.
- **Un agrégat de montants porte une DEVISE et une PÉRIODE** (7.0.1, 7.16.0, 3.1.0, re-posées côté
  console) : « encaissé » sans son année ne veut rien dire, et additionner des dinars avec des euros
  ne se voit sur aucun écran. « En attente » ne porte PAS d'année, elle — une vente de l'an dernier
  qui n'est pas payée attend toujours, et c'est justement celle-là qu'on veut voir.
- **Une vérification qu'on fait à la main finit par ne plus se faire** (9.8.8, re-posée) : le relais
  gagne `/sante`, qui dit ce que chaque canal sert AUJOURD'HUI. Le relais est un autre worker : non
  branché, la console le DIT au lieu d'afficher un vert rassurant (Cabinet 1.0.0).
- **Ajouter une sortie réseau à un worker est une décision** : le test « une seule requête sortante »
  est passé à DEUX, chacune nommée — le mail qui porte la clé, et le relais dont l'adresse vient d'un
  réglage et jamais d'une adresse écrite dans le code.
- **Une date impossible se REFUSE, elle ne fait pas tomber le serveur.** `dateValide` testait la
  forme puis appelait `toISOString`, qui **lève** sur « 2026-13-99 » : un jour tapé de travers dans
  le champ de date libre de la console rendait un 500 au lieu d'un refus. Aucun écran ne montre une
  exception de worker — c'est en écrivant le test du filtre de journal qu'elle est tombée.
- Piège de tranche, **troisième fois** (7.21.0, 9.8.1, 9.9.0) : le test de `trouveFichier` était
  borné sur son VOISIN (`const typeDe =`), et `resumeCanaux` s'est glissé entre les deux. Une
  tranche se borne sur la FIN de ce qu'elle juge — l'accolade en colonne 0 — jamais sur un voisin,
  qui déménage.
- Piège du harnais, re-rencontré : une suite qui utilise `ta` doit être **asynchrone et attendue**,
  des deux côtés. `ta()` sans `await` part détaché, son « ok » s'affiche après le total, et une
  assertion qui tombe ne fait plus échouer la commande (8.4.0). Le lanceur les compte et refuse de
  conclure s'il en reste — c'est lui qui l'a dit.

Les parcours qui comptent sont `npm run e2e:console` (les trois onglets ouverts pour de vrai, les
deux applications qui s'annoncent, l'export qui descend un VRAI fichier, la trace dans le journal,
l'alerte qui disparaît) et `npm run e2e:pont` (le bouton de SkanFact, le fichier sur le disque en
0600, son compte par table, et l'état qui suit).

**Et le premier chiffre de cette version était faux (10.4.0-beta.3).** Skander a ouvert le Parc sur
son Mac, où tournent LES DEUX applications : trois lignes, toutes « SkanFact », dont une à
« 2 postes ». Quatre règles, et la première ne se voyait nulle part :

- **Un identifiant DÉRIVÉ doit porter les mêmes termes que la clé d'unicité.** L'identifiant d'une
  activation valait `empreinte_deviceId` : deux applications sur un poste se battaient pour la même
  clé **PRIMAIRE**, la seconde écriture était refusée par la base, et `sansCasser` avalait le refus.
  Le Cabinet n'apparaissait donc **jamais** dans le parc, sans une ligne nulle part. Ça tenait par
  accident — chaque application a son propre `userData`, donc son propre `deviceId` — et un accident
  n'est pas un garde-fou. L'index seul ne le voyait pas : il faut corriger LES DEUX, et un test qui
  ne prouvait que l'index restait vert.
- **Dans un index UNIQUE de SQLite, deux NULL sont DISTINCTS.** Sur `app` nu, une annonce arrivant
  sur une ligne d'avant la 10.4.0 (app NULL) ne trouverait aucun conflit et créerait un **doublon** :
  le poste compterait deux fois, sur l'écran fait pour le compter. `COALESCE(app, 'entreprise')`
  range l'ancienne ligne là où elle appartient — l'app entreprise était seule à s'annoncer avant.
- **Le serveur NOMME, la page AFFICHE.** Ma colonne « Application » appelait `APPS` et `appDe`, deux
  fonctions du MODULE, depuis le gabarit de la console : ReferenceError pendant la construction,
  écran bloqué sur « Chargement… », rien en console (7.22.0). La colonne qu'on venait d'ajouter n'a
  jamais été dessinée une seule fois. C'est `e2e:console` qui l'a attrapé, jamais la relecture — et
  une seconde table de noms dans la page aurait de toute façon divergé de celle du Parc.
- **Un écran qui répond à une question doit porter la donnée qui y répond.** Le champ `app` était
  écrit en base depuis la 10.4.0 et affiché NULLE PART : on ne pouvait pas répondre à « lequel de ces
  deux postes est le Cabinet ? » depuis l'écran des Activations. Les **trois** moitiés se tiennent et
  un test les confronte — la colonne déclarée, la route qui rend le champ, le nom calculé côté
  serveur : retirer n'importe laquelle laisse l'écran mentir.
- **Un taux de conversion se compte par ORDINATEUR**, jamais par ligne (un poste qui convertit garde
  sa ligne d'essai et en gagne une autre), il est borné à 100 %, et il vaut `null` sans dénominateur :
  « 0 % » sur zéro essai annonce un échec là où il n'y a pas encore de question (9.6.0).
- **Une date qu'on APPROCHE le dit.** L'alerte « essai qui se termine » se calcule sur la première
  fois que la plateforme a VU le poste — jamais sur le jour où l'essai a commencé, qui se compte sur
  la machine. Elle écrit donc « vers le », et c'est la même exigence que « 7 pièces vérifiées,
  intactes » (Cabinet 1.0.0) : une estimation à quelques jours reste parfaitement actionnable — on
  appelle un client, on ne lui facture pas une échéance.
- **La console COMPOSE une relance, elle ne l'envoie pas.** Le texte s'ouvre dans la messagerie de
  l'éditeur, qui le relit et l'envoie lui-même : un mail parti sans être relu n'est pas une relance,
  c'est un automate — et son ton dépend du client. Resend ne sert qu'à la clé, qui suit un paiement
  et ne se discute pas. Rien ne s'y invente : ce qui manque **disparaît de la phrase** au lieu d'être
  remplacé par un vide, et la date est française, jamais ISO — une date ISO dans un mail commercial
  donne l'impression d'un envoi automatique.
- **Masquer un chiffre VRAI est pire que l'afficher sous une autre unité.** « Postes » reste affiché
  pour la ligne Cabinet — un poste installé est un poste installé — mais ce qu'on lui VEND est un
  quota de dossiers (9.4.0), et cette unité-là vit sur l'écran Cabinets. La phrase de l'écran le dit,
  plutôt qu'une colonne que seule une ligne sur trois remplirait (9.4.4).
- **Deux assertions retournées vers la règle** (dix-septième et dix-huitième fois) : « six cartes à
  zéro » décrivait l'état du jour et serait tombée sur le correctif — la règle est que les compteurs
  sont à zéro et qu'un taux sans dénominateur dit « — ». Et une preuve par réintroduction qui laisse
  le lot VERT ne prouve pas que le code est juste : elle prouve que le **test** ne peut pas voir ce
  défaut-là. Deux fois dans cette version, et les deux ont donné un test qui manquait.
- Piège re-rencontré, la **neuvième fois** : aucun backtick dans un commentaire à l'intérieur du
  gabarit de la console. Le garde-fou posé en 10.4.0 a nommé la ligne exacte en deux secondes — c'est
  la première fois que cette faute ne coûte pas un bisect.

### 10.5.0 — Les réglages, le suivi commercial, et ce qui garde la boutique

La console savait ce qui EXISTE, et ne retenait **rien de ce qu'on en faisait**. Un essai se
terminait, l'alerte se levait, on appelait — et le lendemain la même alerte se relevait à
l'identique. Aucune mémoire commerciale, et quinze valeurs — dont les prix — qui demandaient un
déploiement pour bouger.

Règles apprises, à ne pas recasser :

- **Un réglage qu'on ne peut pas changer depuis l'écran n'est pas un réglage, c'est une constante
  avec un nom trompeur.** Trois rangs décident, dans cet ordre : la base, la variable du worker, le
  défaut — l'ordre compte, poser une valeur depuis l'écran doit pouvoir CORRIGER une variable mal
  réglée sans toucher à Cloudflare, jamais l'inverse.
- **Ce qui n'est PAS réglable se dit, avec sa raison.** La durée de l'essai est la règle de
  l'application (8.0.0), pas une politique de la console : réglée ici, elle laisserait la console
  annoncer des fins d'essai fausses. Un test tombe si quelqu'un l'ajoute à la table.
- **Vider un champ NUMÉRIQUE le rend à son rang suivant ; vider un champ de TEXTE le laisse vide.**
  C'est le seul moyen de défaire une valeur sans deviner ce qu'elle valait avant — et « aucune
  version minimale » reste une décision, jamais un oubli.
- **Un refus nomme le champ ET la forme attendue, et ce qui était bon passe quand même.** Un
  formulaire tout-ou-rien fait recommencer quinze champs pour une virgule ; « valeur invalide »
  oblige à relire les quinze pour trouver lequel (7.0.0).
- **On suit une OCCURRENCE, jamais une règle** (7.21.0, re-trouvée) : le sujet d'un suivi est
  l'identifiant du prospect ou du client, et c'est le MÊME que celui de l'alerte. Deux façons de
  nommer le même prospect donneraient un suivi qui ne referme jamais rien.
- **Ce qui n'est pas une conversation ne se fait pas taire par un coup de téléphone.** Une clé
  signée et jamais partie reste à FAIRE : c'est un geste de l'éditeur, pas une négociation.
- **Rien ne s'écrase : chaque contact est une ligne de plus**, et c'est la plus récente qui décide.
  « Je l'ai déjà appelé deux fois » est précisément ce qu'on vient chercher avant la troisième.
- **Un « perdu » sans motif n'apprend rien**, et c'est la seule chose que cet écran peut apprendre :
  pourquoi on ne vend pas. Même refus que la révocation sans motif (8.2.0).
- **Un départ de client payant ne fait aucun bruit.** « Endormi » se comptait déjà, et rien ne
  criait : un poste sous licence muet depuis N jours est une désinstallation, une réinstallation
  ratée ou un réseau coupé — dans les trois cas on appelle.
- **Une alerte qui réclame une mise à jour sans dire ce qu'elle corrige ne se fait pas** : le seuil
  de version et son MOTIF se règlent ensemble, et c'est ce motif qu'on répète au client.
- **Un jalon calme ne double jamais une alerte pressante.** À soixante jours on prépare, à trente on
  presse ; deux lignes pour la même licence, c'est du bruit — et une occasion criée en rouge apprend
  à ignorer le rouge (8.0.1).
- **Ce qui PROTÈGE une réponse publique, c'est la REQUÊTE, pas la forme de la réponse.** Mon
  assertion « le nom du client n'apparaît pas » restait verte quand on étalait la ligne entière dans
  le JSON — parce qu'il n'y avait rien à étaler. Le garde-fou vit sur le SELECT : la vérification
  publique ne lit jamais la table des clients.
- **La signature d'un mail et les prix sont des RÉGLAGES, pas du code.** « Skander Ben Amor » était
  écrit en dur dans `mailRelance` : changer de nom demandait un commit.
- **Une copie qui demande un clic est une copie qu'on ne fait pas.** L'alerte à trente jours
  existait précisément parce que le geste ne se faisait pas. Le déclencheur programmé l'écrit dans
  R2 ; non branché, l'écran le DIT (10.4.0) au lieu d'un vert rassurant.
- **Un secret qu'on ne peut pas remplacer sans se fermer la porte ne se remplace jamais** — y
  compris le jour où il faudrait. Un second secret vaut le temps d'une rotation, aux MÊMES
  exigences : un secret de rotation court serait une porte de service.
- **Le plafond de largeur suit le RÔLE, pas le conteneur.** Un seul plafond pour la prose et pour
  les tableaux : juste pour du texte, faux pour dix colonnes qui se serrent pendant que 700 px
  restent vides. Les quatre sondes mesuraient des OBJETS ; aucune ne voyait la place perdue —
  d'où la cinquième (`SONDE_LARGEUR`).
- **On pagine ce qu'on NOMME** (9.4.5, re-trouvée) : le pied disait « 4 lignes ». Une ligne n'est le
  nom de rien, et c'est le mot qu'on emploie quand on n'a pas regardé l'écran.
- **Une bulle « i » n'est pas un geste** : c'est une annotation collée au titre qu'elle explique, et
  elle suit forcément sa colonne. L'exception à la sonde est NOMMÉE, et ne porte que sur
  l'atteignabilité — le contraste d'une bulle reste jugé, une explication illisible n'explique rien.
- **Un message de succès ne suit pas d'écran en écran.** « Base exportée — activations : 4 » restait
  affiché pendant que le Parc en montrait cinq : un compte figé à côté d'un compte vivant, sur le
  même écran (7.1.x).
- **Une réponse en retard ne repeint pas l'écran qu'on a quitté.** Deux dessins qui se chevauchent,
  et c'est la réponse la plus LENTE qui gagne : le tableau du Parc se faisait remplacer par les
  alertes, sous le titre du Parc. Le défaut n'apparaît que lorsqu'un écran devient plus lent qu'un
  autre — donc il serait arrivé un jour, en production, sans qu'on sache pourquoi. C'est le message
  d'avancement en retard de la 6.8.1, côté lecture.
- **Un correctif qui dépend d'une classe qu'on pense à mettre n'est pas un correctif** (9.8.3,
  re-trouvée) : la rangée de boutons n'avait d'écart que dans un panneau, et « Enregistrer »
  touchait « Annuler » à zéro pixel partout ailleurs.
- **`\'` dans un gabarit est le jumeau du backtick, en plus sournois.** Le template le rend en
  apostrophe NUE : le fichier reste analysable — `node --check` passe, le lint passe, le garde-fou
  du backtick passe — et c'est le NAVIGATEUR qui reçoit une chaîne cassée et n'exécute plus une
  ligne de la page. Écran vide, curseur nulle part, rien dans aucune console qu'on regarde. Une
  apostrophe s'écrit `\u2019` dans ces gabarits ; un test le tient depuis la 10.5.0, pour les DEUX
  pages. (Le backtick, lui, en est à sa **onzième** occurrence, dont deux dans cette version.)
- **Un test qui ne peut pas échouer ne se garde pas**, même écrit de bonne foi : mon « la tranche ne
  déborde pas du gabarit » visait `export default`, qui est AVANT le gabarit. Retiré, avec la raison
  écrite à sa place ; la borne reste, et son seul effet — protéger le jour où quelque chose
  s'ajoutera après — est écrit plutôt que prétendu.
- Piège rencontré : `pl(n, mot)` accorde, donc l'étiquette s'écrit au SINGULIER. Une table nommée
  « clients » donnait « 0 clientss » au premier export vide.

Les parcours qui comptent sont `npm run e2e:console` (dix étapes de plus : les réglages refusés puis
posés, le lien de paiement qui entre dans la relance et en disparaît, la fiche d'un client, le
contact noté qui fait taire ses alertes, le tri renversé, la bulle, la palette, les essais nommés, le
pli scellé, et la page publique) et `npm run e2e:console-rendu` (**1 277 boutons, 364 colonnes,
1 413 écarts, 57 largeurs**, sur les dix écrans — l'onglet Réglages compris, parce qu'un écran neuf
qu'aucune sonde ne regarde est un écran qui dérive, T-55).

### 10.6.0 — L'audit de la console, et l'instrument qui n'atteignait pas ses écrans

Skander : « Ne modifie rien. Analyse cette plateforme comme un Product Designer SaaS senior »,
puis « corrige tout ça ». Vingt-neuf constats — trois critiques, cinq majeurs, douze moyens, neuf
finitions — et **le trou d'instrument qui explique pourquoi personne ne les avait vus.**

Règles apprises, à ne pas recasser :

- **Un champ pré-rempli une fois au dessin ment dès que la valeur dont il dépend change.** Le prix
  proposé à l'émission était celui de l'offre *Entreprise* quelle que soit l'offre choisie : vendre
  un Indépendant à 690 DT au lieu de 390 ne demandait aucune faute de frappe, et rien à l'écran ne
  le montrait. Le prix suit l'offre, et il DIT d'où il vient — « proposé d'après l'offre » ou
  « saisi à la main ». Un chiffre pré-rempli qu'on ne distingue pas d'un chiffre décidé est un
  chiffre qu'on ne relit pas ; c'est le pendant de la règle 9.4.5 (« un champ pré-rempli se
  sélectionne au clic »), du côté de ce que la valeur SIGNIFIE.
- **Le format interne ne sort jamais sur un écran de saisie** (9.4.5, portée à la console) : les
  dates s'écrivent et se lisent en `JJ/MM/AAAA`, la pièce garde l'ISO, et le 31 février est refusé
  en le NOMMANT plutôt que borné en silence.
- **Le dernier écran avant un geste irréversible doit exister.** Une clé livrée ne se reprend pas
  (8.2.0) et « Émettre » signait au premier clic. Le premier clic rend le récapitulatif — à qui,
  quelle offre, jusqu'à quand, combien — et le second signe. Le récapitulatif se DÉSARME à la
  moindre frappe : un formulaire modifié après coup ferait signer autre chose que ce qu'on a relu.
- **Une ligne garde au plus UN bouton visible** (7.29.0, jamais portée ici) : la console en portait
  cinq, et à 1440 px les colonnes FIN, ENVOYÉE et ÉTAT des Licences étaient **entièrement hors de
  l'écran** — 524 px de débordement mesurés, zéro après. La hauteur d'une ligne est passée de
  210 px à 54.
- **Une colonne vide se masque en le DISANT**, avec le bouton qui la rend : masquer sans le dire
  serait un piège (7.12.0), et une colonne de tirets coûte de la largeur à toutes les autres (9.4.8).
- **Arriver sur un titre replié, c'est arriver nulle part** (7.32.0) : les Réglages se replient par
  section ET portent leur sommaire, qui OUVRE la section avant d'y descendre.
- **Une valeur interne ne s'affiche pas** : `darwin` se dit « macOS », `licence.emise` se dit en
  français. Le tableau est là pour être lu par une personne, pas relu par le serveur qui l'a écrit.
- **L'alignement d'un en-tête SUIT ses cellules, il ne se recopie pas colonne par colonne.** La
  faute de la 7.23.0, retrouvée sur la fiche d'un client : « Montant HT » aligné à gauche au-dessus
  de valeurs alignées à droite. Il se DÉDUIT désormais de la première ligne du corps, donc une
  colonne qui devient un nombre demain s'aligne toute seule.
- **Un état vide SECONDAIRE s'annonce, il ne se contemple pas** (9.4.7, portée à la console) : un
  cadre de cent pixels pour dire « — » au milieu d'une fiche pleine repousse tout le reste, et « — »
  ne dit pas si la liste est vide ou si la plateforme n'a pas su la lire.
- **La page publique écrit ses apostrophes en `’`.** C'est la seule surface du produit que des
  INCONNUS ouvrent, et un paragraphe qui mélange « l'empreinte » et « n’est » se lit comme un
  brouillon. Le garde-fou ne juge que la PROSE — le script de la page est du JavaScript et garde
  les siennes.

**Le trou qui explique les vingt-neuf, et c'est le même que T-55 (9.8.8) une surface plus loin.**
`e2e:console-rendu` mesurait dix écrans en quatre passes et n'en **photographiait que cinq**,
chacun coupé au bas de la fenêtre. Deux causes, deux règles :

- **Une capture qui s'arrête au bas de l'écran fait juger une page sur son premier écran** (9.4.3) :
  la console pose un cadre fixe (`height:100vh`) et fait défiler un élément interne, donc
  `fullPage: true` rend exactement une capture d'écran. Le correctif existait pour les DEUX
  applications depuis la 9.4.3 et n'avait jamais été porté à la troisième surface — le jumeau
  manquant (7.3.0), appliqué à un INSTRUMENT.
- **La couverture des captures se DÉDUIT de celle des mesures**, elle ne se recopie pas dans une
  liste écrite à la main : c'est `mesurer` qui photographie, et deux écrans qui tomberaient sur le
  même nom de fichier font TOMBER le parcours — une capture qui en écrase une autre est un écran
  mesuré que personne ne peut plus regarder.

Et **huit surfaces n'étaient atteintes par personne** : le récapitulatif avant signature, la clé
émise (résumée puis entière), le menu d'une ligne, la relance composée, la fiche d'un client, le
devis et son aperçu, la palette, le pli scellé et la page publique de vérification. Aucune
n'a d'adresse : on les atteint par un GESTE, donc un instrument qui parcourt les onglets ne les
voit pas. De 5 captures à **93**, de 1 277 boutons à **1 925**, 592 colonnes, 2 445 écarts — et
l'instrument a trouvé deux défauts dans l'heure qui a suivi (l'en-tête désaligné, les apostrophes
de la page publique), tous deux sur des écrans qu'aucune sonde n'avait jamais regardés.

Prouvé : vingt-neuf défauts réintroduits un par un font tomber leur test.

### 10.7.0 — Une offre peut fermer un confort, jamais une case de déclaration

Signalé par la session qui développe `skanfact.tn` : « tu ne peux pas vendre 390 DT une version
qui oblige le cabinet à ressaisir, alors que le cabinet est ton canal de distribution ». Vérifié
avant d'agir, et le motif réel s'est révélé plus grave que l'argument commercial.

Règles apprises, à ne pas recasser :

- **Une offre peut fermer un confort, jamais une case de déclaration.** Mesuré sur le jeu de
  démonstration, exercice entier, en vidant simplement `purchases` et `suppliers` — l'état exact
  des données d'un client qui n'a jamais pu en créer : le paquet qu'il envoie à son comptable
  déclare **7 441,33 DT de TVA au lieu de 3 250,16**. La collectée y est entière, la déductible
  vaut zéro, et **4 191 DT** partent à l'administration sur un logiciel vendu 390. Ce n'est pas
  une limite commerciale, c'est un chiffre faux en silence dans le fichier qui sert à déclarer
  (7.0.1, 7.16.0) — et le module s'appelle « Achats et fournisseurs : ce que tu dépenses, et **la
  TVA que tu récupères dessus** ».
- **Une réserve se juge sur ce qu'elle fait au PAQUET, pas sur ce qu'elle retire de l'écran.** Les
  six modules ont été mesurés un par un. Seul `achats` change un chiffre que le client dépose et
  paie ; `stock`, `immos`, `paie`, `pilotage` et `partage` retirent des écritures de gestion sans
  toucher ni la TVA ni une case déposée — et ce qu'ils portent est ce que le cabinet fait à sa
  place depuis les 9.7.0 et 10.3.0. **Ce n'est pas « ouvrir tout » : c'est ouvrir ce qui fausse.**
- **Le garde-fou MESURE, il ne lit pas une liste.** Pour chaque module qu'une offre réserve, on
  vide ce qu'il permet de créer et on recalcule la TVA de l'exercice. S'il bouge, le test tombe
  avec le chiffre dans le message. Une liste de modules interdits se périmerait au premier module
  ajouté ; celui-ci tombera aussi le jour où quelqu'un réservera un module neuf qui touche à la
  déclaration. Il porte sa propre contre-preuve : fermer Achats DOIT changer la TVA — si ce n'est
  plus vrai, c'est le moteur qui a cessé de lire les achats, et le garde-fou ne prouve plus rien.
- **La liste exacte reste, à côté, et c'est un contrat.** Ce qu'une offre ferme voyage dans une
  clé SIGNÉE : le changer est une décision, jamais un effet de bord (même règle que les dix-huit
  champs de `chargeHistorique` en 8.7.0 et que les clés de l'entête d'un livre en 9.9.1).
- **On ne reproche pas ce qu'on n'a pas offert** (7.20.0), et **une phrase affichée que rien ne
  tient est un bug** (7.3.0) : les deux se croisent sur la même ligne. « Tant que la fiche manque,
  rien n'est déduit » est vrai quand on PEUT créer la fiche ; quand l'offre ferme le module, c'est
  faux — la ligne part au cabinet dans les écritures, au compte 22, et c'est lui qui établit le
  plan depuis la 9.7.0. Avec Achats ouvert, ce cas devient le cas courant : la ligne d'« À faire »
  et l'avertissement de l'éditeur d'achat disent désormais que le comptable s'en charge.
- **Une pastille rouge à côté d'un cadenas dit deux choses contraires** — « tu as deux choses à
  faire » et « tu ne peux pas ». Quand l'offre ferme le module, le compteur disparaît : ce n'est
  plus la tâche du client.
- **Une assertion qui recopie une ligne d'appel tombe sur du code juste** (7.16.0, re-rencontrée) :
  celle qui exigeait `C.todoList(data, company(), null, { copieExterne, editeur: !!licence.editeur })`
  mot pour mot est tombée dès que l'appel a gagné `reserves`, un argument parfaitement légitime.
  Retournée vers ce que l'appel PORTE, elle exige maintenant les deux.
- **Un test écrit contre l'état du jour décrit cet état, pas la règle — dix-neuvième occurrence.**
  `e2e:licence` exigeait « la clé Indépendant pose un cadenas sur Achats et refuse un nouveau
  fournisseur ». Retourné : Achats est ouvert (le fournisseur se crée VRAIMENT, ni cadenas ni
  bandeau) et c'est un module ENCORE réservé qui porte le refus. Sans cette seconde moitié, le
  parcours ne prouverait plus qu'une offre ferme quoi que ce soit — un test qui n'exerce plus son
  refus ne protège de rien.
- Piège rencontré : le garde-fou d'une création ouverte depuis plusieurs pages vit **dans le
  formulaire, sur la branche création** (7.33.0). Le refus arrive donc à l'enregistrement, pas à
  l'ouverture — un parcours qui attend une fenêtre de refus au clic sur « + Nouveau bien » trouve
  le formulaire et accuse du code juste.
- Piège de méthode : **une preuve par réintroduction doit viser le garde-fou qu'elle teste.**
  Remettre « achats » dans les réserves fait tomber la liste exacte AVANT le garde-fou général, et
  `npm test` s'arrête là : on croit avoir prouvé le second alors qu'on n'a vu que le premier. Il
  faut remettre le défaut **comme le ferait quelqu'un qui décide vraiment** — liste exacte mise à
  jour comprise — pour que seul le garde-fou général puisse encore le voir.

**Et un instrument rouge depuis la 10.5.0, réparé au passage** : `e2e:plateforme` portait une base
de données écrite À LA MAIN, un objet qui n'implémentait que `first()` et `run()`. C'est ce que la
8.5.0 avait condamné et corrigé pour `e2e:console` — « les tests ne rejouent plus le worker, ils le
font tourner » — et la leçon n'avait jamais été portée ici : **le jumeau manquant (7.3.0), appliqué
à un INSTRUMENT** (comme la capture pleine en 10.6.0, comme les quatre sondes en 9.4.3). Le prix
s'est payé en 10.5.0, quand `lireReglages` a commencé à appeler `.all()` : le parcours est mort sur
`env.DB.prepare(...).all is not a function`, et personne ne l'a vu — **un parcours rouge qu'on ne
relance pas cesse d'exister** (7.25.0, 7.28.0). Il tourne maintenant sur la vraie base SQLite, sur
le vrai schéma, avec de vraies révocations écrites en SQL. Et la fidélité a livré son premier
constat aussitôt : la vraie base **met à jour** l'annonce d'un poste déjà connu au lieu d'en
empiler une — c'est tout l'intérêt, on compte des ordinateurs, pas des démarrages — là où la fausse
en ajoutait une à chaque fois, et où le parcours comptait donc les lignes.

Les prix ne changent pas : ils se règlent dans la console depuis la 10.5.0, et c'est une décision
du propriétaire, pas de cette version.

Prouvé : trois défauts réintroduits un par un font tomber leur test, et le parcours réel exerce
les deux moitiés — ce que l'offre ouvre et ce qu'elle ferme.

### 10.8.0 — « Sans limite » est un état, pas un très grand nombre

Une licence de cabinet peut porter « sans limite de dossiers ». Décidé pour les premiers cabinets,
dont le pilote : leur vendre un quota le jour où on leur demande de tester le produit n'a pas de
sens, et le calibrer au jugé encore moins.

Règles apprises, à ne pas recasser :

- **Un droit illimité s'écrit comme un ÉTAT, jamais comme un très grand nombre.** Une clé à 99 999
  dossiers aurait fonctionné sans une ligne de code — et c'est précisément ce qu'il ne fallait pas
  faire : le cabinet aurait lu « 100 002 dossiers autorisés » sur l'écran qui doit le rassurer, et
  une barre de progression aurait avancé vers une limite imaginaire. `autorises` vaut `null`,
  l'écran écrit « sans limite », et le verrou ne peut plus tomber. C'est la règle du « — » plutôt
  que du zéro (9.6.0), vue par l'autre bout : **un nombre que personne n'a décidé ne s'affiche
  pas**, qu'il soit trop petit ou trop grand.
- **Ce qui ne sert plus se cache, et ce qui en dépendait s'efface.** La case cache le quota —
  réclamer un chiffre dont on vient de dire qu'il ne compte pas est un piège, et le champ porte une
  étoile d'obligation qu'on ne pourrait plus satisfaire — et elle vide le prix proposé, qui se
  calculait sur ce quota : un montant déduit d'un nombre de dossiers qui ne compte plus serait un
  chiffre faux (7.16.0). Le prix se saisit à la main, et l'écran dit pourquoi.
- **Un champ de la charge signée entre en QUEUE** (8.5.0, 9.4.1, re-rencontrée) : au milieu, il
  changerait l'ordre des champs déjà signés, et une clé refabriquée depuis sa charge rangée en base
  ne serait plus identique à celle qu'on a envoyée. Une clé d'avant se comporte exactement comme
  avant, et un test fixe la liste exacte — l'ajout est une **décision**, jamais un effet de bord.
- **Le statut de fondateur se POSE, il ne se déduit jamais du rang d'émission.** Skander : « vu que
  je vais tester l'application je vais créer des licences, est-ce que ça va pas me cramer mes 20
  licences sans limite ? » Non, parce que **rien ne compte** — vérifié avant de répondre plutôt
  qu'affirmé de mémoire : le mot « fondateur » n'apparaît nulle part dans le code. La séparation qui
  rend ça propre, et qui vaudra pour tout ce qu'on voudra compter un jour : **la clé porte ce que
  l'application doit faire respecter** (le quota) ; **la console porte ce que l'éditeur doit
  compter** (le statut commercial). L'application n'a pas à savoir qu'on compte jusqu'à vingt.
- **Un garde-fou qui couvre la moitié des noms rassure sans protéger.** Celui de la veille interdit
  qu'une déclaration locale masque une fonction du module de la console — la faute qui avait tué le
  formulaire d'émission sans une ligne dans aucune console. Il ne lisait que `function nom(` : la
  page en a 47 sous cette forme et **22 sous la forme `var nom = function`**, qui est très
  exactement la famille où vivait le défaut. Réintroduit, il restait **vert**. Je ne l'ai su qu'en
  essayant de le faire tomber — et c'est la seule façon de le savoir (7.2.0). Élargi, il se prouve
  dans les deux sens : il nomme le défaut, et il ne dit rien sur les 69 fonctions du code juste
  (9.8.8).
- **Un instrument peut ATTEINDRE l'écran et le mesurer dans le seul état où le contrôle neuf
  n'existe pas.** Le formulaire d'émission a deux visages — une licence d'entreprise montre l'offre
  et le parrainage, une licence de cabinet montre l'empreinte, le quota et « sans limite » — et le
  parcours ne basculait jamais le type. La case est donc passée sous 2 445 écarts sans en faire
  bouger un seul. C'est **T-55 d'un cran plus bas** (9.8.8) : là-bas c'était l'objet ouvert qui
  cachait sept onglets, ici c'est l'état par défaut d'un formulaire qui cache la moitié de ses
  champs. De 93 à 101 écrans, 2 125 boutons, 648 colonnes, 2 669 écarts. **Un formulaire à
  plusieurs visages se mesure dans chacun.**
- **Une phrase du formulaire promettait le quota sans condition** : « une licence de cabinet porte
  l'empreinte du cabinet et un quota de dossiers hors SkanFact ». Vraie jusqu'à cette version, fausse
  après — et c'est la capture du nouvel état qui l'a montrée. Une phrase affichée que rien ne tient
  est un bug (7.3.0), y compris celle qu'on a écrite soi-même deux versions plus tôt.

Prouvé : trois défauts réintroduits un par un font tomber leur test, plus les deux directions du
garde-fou élargi.

### 10.8.0-beta.4 — le worker se déploie depuis le dépôt

Le worker de la console se déployait en **collant son code dans l'éditeur du tableau de bord** : un
geste manuel par version, sur le seul service qui signe les licences. Skander a donné un accès
Cloudflare en MCP puis demandé la corvée qui va avec — un jeton, deux secrets, et une action GitHub.

- **`workflow_dispatch` n'existe, chez GitHub, que pour un workflow présent sur la branche par
  DÉFAUT.** Un workflow qui ne vit que sur `beta` n'existe pour personne : le lancement répond 404,
  et rien d'autre ne se lit. Le fichier doit donc être posé sur `main` avant de pouvoir être lancé
  sur quoi que ce soit — y compris sur la branche qui le porte.
- **Un déploiement se déclenche sur ce qui est DÉPLOYÉ, jamais sur la recette qui déploie.** Le
  filtre de chemins nomme le code du worker et sa configuration, jamais le fichier du workflow :
  une production qui se redéploie parce qu'on a corrigé un commentaire est une production qu'on
  finit par ne plus regarder. Effet immédiat, et c'est ce qui a permis la transition : poser le
  fichier sur `main` devient **inerte**, puisque aucun chemin surveillé n'y existe encore.
- **Une branche qui n'a pas suivi est un champ de mines.** `main` était restée à la 10.0.0 : son
  worker faisait 1 842 lignes contre 4 898, il n'avait pas bougé depuis un mois, et la base D1
  portait déjà les colonnes qu'il ne connaît pas. Le déployer aurait effacé huit versions de
  console. **Avant de poser un déclencheur sur une branche, regarder ce que cette branche
  déploierait.**
- **`wrangler deploy` REMPLACE les liaisons par celles du fichier de configuration** (piège n° 1,
  écrit en tête du `wrangler.toml`) : une liaison posée dans le tableau de bord et absente du
  fichier est SUPPRIMÉE. On ne le devine pas — on **compte ce que le code lit sur `env`** et on
  vérifie que le fichier les déclare toutes. Les variables en clair subissent le même sort, d'où
  `--keep-vars` ; les secrets survivent de toute façon, c'est leur définition. Et aucune `route`
  n'est déclarée : en déclarer une remplacerait le domaine personnalisé.
- **Un job vert ne suffit pas** (9.8.1, re-posée) : l'étape de contrôle redemande au worker la page
  qu'il SERT. Elle a duré zéro seconde, ce qui aurait pu vouloir dire « rien n'a pu être mesuré » —
  c'est le journal qui tranche (`HTTP 200`, la page reconnue à son titre), jamais la pastille verte.
  Et une étape qui n'a rien pu mesurer le DIT au lieu d'annoncer que tout va bien.
- **Une version écrite dans l'entête d'un fichier se périme au bump suivant.** Les deux fichiers
  neufs la portaient ; elle a été retirée le jour même.
- **Un contrôle automatique prouve que la PORTE s'ouvre, jamais que la lettre arrive.** Le relais
  de mise à jour a reçu le même traitement (`worker/wrangler.toml`, workflow `Relais`), et son
  formulaire de contact a en plus un envoi RÉEL, à la demande : un déploiement qui enverrait un
  mail à chaque fois remplirait la boîte qu'il teste. Chacune des trois réponses possibles porte sa
  phrase — la chaîne tient, un réglage manque, ou Resend refuse l'expéditeur — parce qu'un échec
  qui ne dit pas lequel des trois se cherche dans les trois.

### 10.8.0-beta.6 — le site vérifie une licence chez lui

`skanfact.tn/verifier` ne savait que RENVOYER vers `api.skanfact.tn/verifier` : le visiteur
quittait le site pour une page nue sur une autre adresse, au moment précis où il vérifie une
licence qu'on vient de lui vendre.

- **CORS ne protège rien, et ne doit jamais être présenté comme une protection.** `curl` l'ignore,
  et cette route est publique par construction. Ce qui PROTÈGE une réponse publique, c'est la
  REQUÊTE (10.5.0) : le SELECT ne lit jamais la table des clients. CORS ne décide que d'une chose
  — quelle PAGE a le droit de lire la réponse dans un navigateur. Écrire le contraire dans un
  commentaire aurait fabriqué exactement la fausse assurance que le projet combat.
- **Une origine inconnue reçoit quand même sa réponse, sans l'en-tête.** Refuser (ce que fait
  `/contact` sur le relais, parce que c'est une ÉCRITURE) fabriquerait une panne là où il n'y en a
  pas : la page servie par le worker lui-même n'envoie AUCUNE origine, et c'est elle qui sert
  aujourd'hui. Le geste décide du refus, pas le mécanisme.
- **Le droit s'arrête à l'espace public, et le test le prouve dans les DEUX sens** (9.4.0) : les
  en-têtes sont posés par `repondreVerif` et par lui seul, jamais par le helper `json` global.
  Sans la seconde moitié, le test laisserait passer une autorisation posée partout — la console et
  l'état des licences ouverts au navigateur de n'importe quel visiteur du site.
- **La liste des origines est la JUMELLE de celle du relais** (7.3.0) : les deux workers servent le
  même site, et deux listes qui divergent donneraient un site dont une moitié fonctionne — la
  moitié qu'on n'ouvre pas. Corps comparés par un test, motif `round3`.
- **Un garde-fou qui compte des adresses ne sait pas distinguer ce qu'on APPELLE de ce qu'on
  RECONNAÎT.** « Une seule requête sortante » (8.5.0) collecte les `https://` de la source : les
  trois origines l'ont fait tomber alors que rien ne part jamais vers elles. Elles sont nommées
  par RÉFÉRENCE (`P.ORIGINES_SITE`), jamais par motif — sinon `https://skanfact.tn/collecte`, une
  vraie sortie, passerait sous le même nez. **Élargir un garde-fou se fait en nommant l'exception,
  pas en assouplissant la règle.**

Prouvé : cinq défauts réintroduits un par un font tomber leur test — l'en-tête jamais posé, l'en-tête
posé pour tout le monde, l'en-tête qui déborde sur `admin`, les deux listes qui divergent, et la
demande de permission du navigateur laissée sans réponse.

### 10.8.0-beta.7 — un instrument qui a perdu la moitié de ce qu'il mesurait

La session qui développe le site a demandé si `e2e:contraste` mesure les champs de saisie ou
seulement les boutons. Vérifié dans le code plutôt que répondu de mémoire : **seulement les
boutons** — alors que ce fichier l'affirme depuis la 7.30.0. La moitié « champs » existait, écrite
pour le défaut du thème sombre (contraste 1,18, du blanc sur du blanc) ; elle a été **perdue dans la
refonte de la 9.4.3**, quand la sonde a déménagé dans `harnais.js` pour être partagée — seuls les
boutons ont fait le voyage.

- **Une règle écrite dans CLAUDE.md que plus rien ne tient est un bug**, exactement comme une phrase
  affichée à l'écran (7.3.0) — en pire, puisque c'est moi qui la relis à chaque session et que je
  m'en sers pour conclure qu'un sujet est couvert. Ici elle a couvert TROIS surfaces pendant onze
  versions.
- **Une refonte qui PARTAGE un instrument doit emporter tout ce qu'il mesurait.** C'est le miroir de
  la règle 9.4.3 : là-bas, une sonde qui ne couvrait qu'une application n'en protégeait qu'une ;
  ici, une sonde partagée a couvert trois surfaces en perdant la moitié de son objet. Le gain de la
  mutualisation ne se constate qu'en vérifiant ce qui a survécu au déménagement.
- **Une sonde, DEUX listes nommées** (`{ boutons, champs }`) : une seule sonde parce que ses
  fonctions de mesure seraient sinon recopiées (7.29.0), deux listes parce qu'un compte mélangé
  cesse d'être comparable d'une version à l'autre — et un instrument doit dire combien il a mesuré
  de quoi.
- **Un instrument qui ne mesure rien annonce « tout va bien »** (9.7.0, re-trouvée) : les trois
  parcours tombent désormais si le compte de champs est nul. Sans ce garde-fou, la disparition de la
  9.4.3 se reproduirait à l'identique et sans un mot — c'est très exactement ce qui est arrivé.
- **Un défaut « à moitié » est celui qui se voit le moins.** La preuve par réintroduction ne fait
  tomber que TROIS champs, parce que `input[type=text]` couvrait encore le reste : `select` et
  `textarea` échappaient à la règle sombre (dans une liste de sélecteurs, chacun porte sa propre
  spécificité), donc l'écran paraissait à demi correct.

Verdict du jour, qu'on ne pouvait pas connaître : **722 champs** (146 app entreprise, 319 Cabinet,
257 console), aucun illisible. Prouvé en remettant le défaut d'origine dans la feuille de style — la
sonde le nomme à 1,18 exactement.

### 10.9.0 — Le paiement en ligne

Le premier endroit du projet où de l'argent change de mains sans que personne ne regarde. Ce que
`PLAN-PLATEFORME.md` § 12 promettait depuis le premier jour — « le jour où un encaissement en ligne
est branché, il déclenche **le même bouton** » — a été tenu littéralement : `emettre`,
`cleDeLicence` et `envoyerSiPossible` sont sortis de `repondreAdmin` pour vivre au niveau du module
(`atelierLicences`), et le webhook les appelle tels quels.

Règles apprises, à ne pas recasser :

- **Le navigateur envoie une DEMANDE, jamais une décision.** `nettoyerCommande` rend exactement six
  champs — offre, nom, email, matricule, téléphone, code du parrain — et un test fixe cette liste :
  un champ de plus, et c'est le navigateur qui décide de quelque chose. Le prix, la remise et la
  durée viennent des réglages ; un prix envoyé par la page ne sert à rien, et le test le prouve en
  en envoyant un ridicule.
- **Un webhook non signé ne vaut que comme notification.** Celui de Konnect n'est pas signé :
  n'importe qui peut l'appeler avec n'importe quelle référence. Ce qui PROUVE est la question qu'on
  repose au prestataire avec notre clé — c'est la règle 10.5.0 (« ce qui protège une réponse
  publique est la REQUÊTE ») appliquée dans l'autre sens. Trois conditions, et chacune ferme une
  porte : l'état est `completed` ; le paiement porte la référence de NOTRE commande (sinon la preuve
  d'un achat à 390 ferait livrer celui à 690) ; le montant encaissé est celui qu'on a demandé.
- **Et on ne cherche jamais la commande autrement que par la référence qu'on a soi-même rangée** en
  la créant : c'est ce qui fait qu'un appel inventé ne désigne rien.
- **Ce qu'on encaisse est exactement ce que la facture dira, timbre compris.** SkanFact ajoute le
  timbre fiscal tout seul à la pièce : ne pas l'encaisser laisserait chaque vente en ligne due d'un
  dinar, pour toujours — un impayé permanent que personne ne comprendrait six mois plus tard. La TVA
  et le timbre sont des **réglages** avec leur « À VÉRIFIER » (règle 5.0.0 : aucun taux en dur).
- **L'ordre des trois compte** : la remise s'applique au HT, la TVA au HT remisé, le timbre APRÈS la
  TVA — c'est un droit fixe par facture, pas une base imposable.
- **Trois chemins vers la même livraison, et c'est voulu** (6.7.2) : le webhook, la page de retour
  du client, et un bouton dans la console. Le jour où le webhook n'arrive pas, c'est la page que le
  client regarde qui finit le travail. `finaliserCommande` est donc IDEMPOTENT — un webhook se livre
  deux fois, une page s'actualise — et un test le vérifie en rejouant les trois.
- **Une commande n'est pas une vente, et `paiement_le` n'est pas `etat`.** Les deux séparés donnent
  le seul état qui compte vraiment : encaissé, et clé pas partie. Le client a payé et n'a rien.
  L'alerte est rouge, elle porte la raison, et sans elle personne ne le saurait — la commande
  n'apparaît nulle part ailleurs, la licence n'existe pas, et le site ne peut que dire « nous en
  sommes prévenus ». Corollaire : **on n'abandonne pas une commande payée** — ce serait garder
  l'argent en fermant la porte.
- **Le client n'est créé qu'au paiement** : une commande abandonnée ne laisse aucune fiche derrière
  elle, et la table des clients reste ce qu'elle dit être.
- **Une remise ne se pose que sur un parrain que la BASE connaît.** Vingt caractères hexadécimaux se
  tapent au hasard ; ce qui ne se fabrique pas, c'est une licence de cabinet vivante portant cette
  empreinte. L'empreinte annoncée est gardée dans les deux cas — un parrainage qu'on n'a pas su
  reconnaître reste une information.
- **Une référence PUBLIQUE ne s'énumère pas** : `idLong` (seize octets) et non `idCourt` (quatre).
  Une licence ne s'atteint qu'avec le secret d'administration ; une commande se relit sans secret.
- **Et elle ne rend jamais la clé** : une référence voyage dans une adresse, qui se copie, se
  partage et se retrouve dans un historique. La clé part par mail, l'adresse est masquée.
- **Une offre dont le prix n'est pas fixé ne se vend pas en ligne.** Le Cabinet en est absent, et ce
  n'est pas un oubli : vendre à zéro ou à un prix inventé pour l'occasion sont aussi faux l'un que
  l'autre (règle 9.1.1).
- **Le prestataire compte en MILLIMES, en entier**, et `Math.round` est indispensable :
  `301.29 * 1000` vaut `301289.99999999994`. Un centième de millime en moins ferait refuser le
  paiement pour cause de montant qui ne correspond pas. Corollaire : l'achat en ligne **refuse** une
  devise autre que le dinar, parce que `millimes()` serait dix fois trop grand sur deux décimales.
- **Un lecteur ne doit jamais dépendre d'un filtre qu'il ne voit pas.** La requête de l'alerte
  filtrait sur `etat` sans le SÉLECTIONNER : la ligne arrivait au constructeur sans le champ qu'il
  teste, et elle était écartée **en silence**. C'est le jumeau du « champ lu mais jamais écrit »
  (7.3.0), du côté de la lecture — et c'est un test neuf qui l'a trouvé, pas la relecture.
- **Un réglage réglable et ignoré est pire qu'un réglage absent** : « Signature des mails » vivait
  dans la console depuis la 10.5.0 et les mails lisaient la variable du worker. Trouvé en sortant
  `envoyerSiPossible` de sa fermeture — un déménagement force à regarder d'où chaque valeur vient.
- Piège de méthode : `String.replace` avec un motif TEXTE ne remplace que la PREMIÈRE occurrence.
  Trois appels à réécrire, un seul réécrit, et le test tombé était à mille lignes de là.

Prouvé : treize défauts réintroduits un par un font tomber leur test.

### 10.9.1 — Deux champs sur un formulaire ne sont jamais deux façons de dire la même chose

Trouvé en reprenant la session du site : elle demandait « confirmer que le serveur conserve `raison`
et `adresse`, sinon je les retire ». Il ne les conservait pas — et la réponse honnête n'était pas de
les retirer.

- **Un formulaire qui distingue deux champs le fait pour une raison, et le serveur doit la
  connaître.** Le site sépare la RAISON SOCIALE (`autocomplete="organization"`) de la personne qui
  suit le dossier (« Qui suit le dossier »). Le worker n'avait qu'un `nom` et le documentait comme
  « le nom de ton entreprise » : il recevait donc un salarié et l'inscrivait comme client. Aucune
  console ne le montre, aucun test ne tombe, et la première chose qui l'aurait dit est une facture —
  une pièce légale — libellée au nom d'une personne, sans adresse, sous le matricule de sa société.
  **Le contrat entre deux moitiés écrites séparément se relit CHAMP PAR CHAMP contre le formulaire
  réel, pas contre le commentaire qui le décrit** : celui de `site.js` annonçait six champs pendant
  que le `fetch`, vingt lignes plus bas, en envoyait huit.
- **Une donnée qui n'a pas de case se perd en silence** (9.8.5, vue de l'autre bout) : là-bas elle
  se réinventait, ici elle disparaissait. Les deux viennent du même manque.
- **Un champ dont l'absence se paie AILLEURS se demande là où c'est gratuit.** L'adresse figure sur
  la facture ; l'acheteur est devant son écran au moment de la commande, et c'est le seul instant où
  elle ne coûte rien. La réclamer trois jours plus tard, c'est un mail et une facture en retard.
- **Le repli garde l'ancien contrat vivant** : sans `raison`, `nom` reprend son rôle d'avant. C'est
  la règle de la licence sans `kid` (8.4.0) — un contrat qui s'élargit ne casse jamais celui qui
  l'appelait hier — et le test l'exige dans les deux sens.
- **Un contact identique à la société est du BRUIT, pas une information** : sans `raison`, on ne
  fabrique pas un contact qui répète le nom du client. Une case remplie pour être remplie se lit
  comme une donnée, et fait croire qu'on connaît quelqu'un.
- **Une fiche qui existe appartient à son auteur** : une deuxième commande ne réécrit rien, elle
  COMBLE ce qui est vide. Écraser une adresse corrigée à la main serait perdre une correction que
  personne ne se rappellerait avoir faite (même règle qu'un compte nommé par le cabinet, 9.8.5).
- **Une assertion « rien n'a changé » passe toujours quand le geste n'a pas eu lieu.** Ma preuve du
  point précédent — une seconde vente qui ne doit pas réécrire la fiche — passait aussi si la
  seconde vente échouait. Elle exige maintenant que la seconde licence existe AVANT de juger
  (9.4.7 : un e2e qui saute sa moitié ne prouve rien).
- **La moitié SkanFact n'est visible que du parcours réel** : `creerBrouillonsConsole` écrivait
  `address: ''` en dur, et aucun test pur ne l'atteint. C'est `e2e:pont` qui le prouve, et il a
  fallu l'y ajouter — un pont qui promet « zéro ressaisie » et livre une fiche vide ne tient pas sa
  promesse, mais rien ne plante.

Prouvé : six défauts réintroduits un par un font tomber leur test, dont celui d'origine.

### 10.9.2 — Une valeur qu'aucun écran n'affiche n'existe pas, même si on dit où la trouver

Skander a collé sa clé sur `skanfact.tn/verifier` et s'est fait répondre « empreinte illisible ». Il
est l'auteur du produit ; un client se serait trompé dix fois sur dix.

- **Une phrase qui dit OÙ trouver une valeur est une promesse, et elle se vérifie comme telle**
  (7.3.0, dans sa forme la plus coûteuse). La page envoyait vers « Paramètres › L'application ›
  Licence » — l'écran existait, la valeur n'y était nulle part, dans AUCUNE des deux applications.
  On demandait donc quelque chose qu'il était impossible d'obtenir, et les deux autres défauts n'en
  sont que les conséquences. **Quand un utilisateur n'arrive pas à fournir ce qu'on lui demande,
  chercher d'abord si on le lui a rendu possible.**
- **Deux objets qui portent le même mot finissent par être confondus** — y compris par ceux qui les
  ont écrits. L'empreinte d'un CABINET fait vingt caractères en cinq groupes et se dicte au
  téléphone ; celle d'une LICENCE en fait trente-deux d'un bloc. Le gabarit du site montrait la
  première là où il fallait la seconde. Ce qui les sépare s'écrit maintenant sur la page et dans
  les deux bulles, parce qu'une distinction qu'on garde en tête ne tient pas.
- **Le geste naturel se comprend, il ne se refuse pas.** Ce qu'on a sous la main est la CLÉ : elle
  arrive par mail, elle est dans le presse-papiers. Le site l'accepte et calcule l'empreinte
  **dans le navigateur** — la clé ne part pas sur le réseau, parce qu'envoyer un titre de licence à
  une route publique pour une question à laquelle son condensé répond serait donner plus que
  nécessaire (10.5.0 : ce qui protège une réponse publique est la REQUÊTE).
- **Une valeur dérivée se dérive ; elle ne se range pas.** L'empreinte se pose à la sortie UNIQUE de
  chaque `licence:status`, pas dans les dix retours de `licenceState` — un seul oublié la rendrait
  invisible dans l'état exact où l'on en a besoin. Rangée, elle finirait par désigner une clé
  remplacée.
- **Une longueur imposée par la cryptographie n'est pas un défaut de conception, et se démontre
  plutôt que s'affirmer.** Une clé SkanFact ne peut pas descendre sous **92 caractères** : la
  signature Ed25519 seule fait 64 octets, soit 86 en base64url. Un code court à la Microsoft
  suppose un serveur d'activation — donc plus d'hors-ligne, et un logiciel qui meurt avec son
  éditeur (6.4.0). Le découpage de la clé en ses trois morceaux (préfixe / charge / signature) est
  ce qui a rendu la réponse vérifiable au lieu de péremptoire.

### 10.10.0 — Un expert-comptable a tenu le Cabinet

Seize constats d'une session QA qui a joué un expert-comptable tunisien pendant « plusieurs mois » :
onze dossiers, cent quatre écritures, la paie, la clôture, la liasse. Publiée en bêta.

Règles apprises, à ne pas recasser :

- **Un modèle de rubriques se confronte aux comptes que le MOTEUR écrit, pas au plan idéal.** La
  liasse cherchait 281/282/283 ; les deux applications écrivent leurs dotations sur le 28 nu
  (`DEFAULT_ACCOUNTS.amortissements`). Sur un dossier alimenté par SkanFact, elle ne pouvait donc
  JAMAIS tomber juste — et le test de la 10.0.0 passait, parce que son jeu de données utilisait 282.
  Un test dont les données ne ressemblent pas à ce que le produit écrit ne prouve rien (10.0.0,
  9.6.1). Il tourne maintenant sur le livre bâti depuis les paquets de l'exemple.
- **Un solde peut changer de sens sans changer de nature.** Une perte reportée (13 débiteur), des
  avoirs qui dépassent les ventes d'un compte, un stock qui baisse : `deuxSens` garde le compte dans
  sa rubrique, en négatif. Les exclure les faisait sortir de la liasse ; et la raison d'une rubrique
  vide dit désormais le SENS qu'elle attend, sinon elle contredit le bandeau des orphelins.
- **Un correctif d'un modèle que le client a COPIÉ doit atteindre la copie.** `migrerModeleLiasse`
  relit à la lecture une rubrique restée identique à celle de la 10.0.0, et ne touche jamais une
  rubrique réécrite par le cabinet (même règle que `migrerLivre`, 9.8.5).
- **Deux portes pour deux contenus** : `infoDialog` échappe (une phrase), `infoHtml` reçoit du HTML
  déjà échappé morceau par morceau. Passer un tableau à la première affichait « <table class=… » —
  sur la liasse ET sur le rapport de fusion, que personne n'avait signalé.
- **Le moteur comptable irréprochable rend un défaut de saisie dangereux.** Un bulletin à brut
  négatif donnait une pièce équilibrée, colonnes inversées, plausible dans un journal de cent pièces.
  Ce qui manquait était un REFUS : `saisiePaieValide`, dans le moteur partagé, appelée par le
  Cabinet et par l'app entreprise (le jumeau, 7.3.0), et par le bouton pendant la frappe (9.4.5).
- **Un sélecteur construit sur une source ignore ce que l'autre crée.** Les exercices se lisaient
  dans les paquets reçus ; « Ouvrir 2027 » écrivait un livre qu'aucun écran n'ouvrait, et un dossier
  hors SkanFact — sans paquet par construction — n'avait pas de comptabilité du tout. Les exercices
  se lisent aussi dans l'index des livres, et le geste qui crée un exercice l'ajoute lui-même.
- **Le dossier qu'on FACTURE ne peut pas être celui qu'on sert le moins.** L'Aide promettait la
  saisie d'un client hors SkanFact, l'écran promettait « dès son premier paquet ». Deux phrases
  contraires, dont l'une était fausse pour toujours (7.3.0).
- **Un montant qui sort du moteur dans une phrase s'écrit comme l'écran** (`fmtMontant`,
  `fmtJour`) : « 100.000 » se lit cent mille. Un test interdit tout `toFixed(` hors du formateur.
  Le document remis au client (les états de clôture) passe par le même formateur, devise comprise.
- **On ne propose pas un geste qui sera refusé** : l'extourne de décembre devient « Extourner à
  l'ouverture de N+1 », qui pose un drapeau (aucun chiffre) qu'« Ouvrir N+1 » consomme.
- **Un contrôle rapproche un tableau de son compte** (tableau d'amortissement ↔ 28), comme la
  balance auxiliaire se confronte à son collectif (9.8.8) — seulement quand le cabinet tient le parc.
- **Une cellule collée illisible se refuse en nommant la ligne**, jamais un zéro en silence.
- **Le test de T-09 ne regardait que `modal()`** : sept « Annuler » écrits APRÈS le correctif
  portaient `dismiss` nu, que rien ne lit. On regarde maintenant chaque bouton, dans les deux
  applications. Un garde-fou qui teste le mécanisme sans tester ses usages laisse repasser le défaut
  à la première fenêtre neuve.
- **Deux tests gravaient le défaut, retournés** (vingtième et vingt et unième fois) : « sept
  onglets » écrit à la main, et « dès son premier envoi » exigé d'un dossier sans paquet.
- Piège re-rencontré, **septième fois** : un commentaire de gabarit `${/* */''}` posé dans un
  ternaire casse le fichier. Et un commentaire qui cite la phrase fautive fait tomber le test qui
  l'interdit — on lit le code sans ses commentaires.

Prouvé : treize défauts réintroduits un par un font tomber leur test ; `e2e:paie`, `e2e:cloture`
et `e2e:cabinet` refont la paie négative, la liasse et le dossier hors SkanFact dans l'application.

### 10.11.0 — Les mises à jour, retournées

Skander, trois captures : la 10.10.0 était publiée et ses deux applications répondaient « Tu as la
dernière version » ; une 10.9.3 téléchargée empêchait de voir la 10.10.0 ; la ligne des bêtas citait
« 9.2.0-beta.1 ». Et : « au niveau UI/UX je veux le même workflow que Apple pour la mise à jour ».

- **Une liste d'API peut mentir sur ce qu'elle contient.** `/releases?per_page=20` rendait la
  10.10.0 avec 16 fichiers ou AUCUN, selon le serveur, encore une heure après sa publication — un
  instantané pris à la création de la page, quand elle était vide. L'endpoint d'UNE release
  (`/releases/{id}/assets`) était juste. Le relais prend la première release qui porte le fichier :
  sur la réponse vide, il sautait la 10.10.0 et servait la 10.9.3 — et les fichiers qui portent un
  numéro de version (`…-10.10.0-mac-universal.zip`) auraient été introuvables. `trouveDans` relit
  une release qui paraît vide avant de passer à la suivante : trois au plus, et ZÉRO appel de plus
  dans le cas normal (le fichier est dans la première release admissible). Même règle au Cabinet
  (`cabcore.releasePourIndexRelue`), dans `/sante` et dans `src/canaux.js`. **Le relais se
  redéploie pour que les installations existantes en profitent** — c'est lui, pas l'application,
  qui choisit la version servie.
- **Diagnostiquer avant de corriger, et diagnostiquer le SERVICE, pas le client.** Le code déployé
  du relais (lu par le MCP Cloudflare) était celui du dépôt ; la même requête à l'API rendait deux
  réponses différentes à deux secondes d'écart. Sans cette mesure, on aurait cherché dans
  electron-updater.
- **Un raccourci « déjà prêt » dans une fonction de recherche cache tout ce qui vient après.**
  `if (downloaded) { sendUpdate('downloaded'); return }` en tête de `checkForUpdates`, dans les
  DEUX `main.js`, et `runCheck` qui refusait de chercher dans l'écran : une version téléchargée
  rendait la suivante invisible, pour la recherche automatique comme pour le bouton. On cherche
  toujours ; `memePrete(info)` garde prête la version déjà sur le disque sans repasser par
  « téléchargement ».
- **Un numéro affiché vient de ce qui est publié, ou ne s'affiche pas.** « Numérotées
  9.2.0-beta.1 » et « 7.26.0-beta.1 » étaient des exemples écrits à la main, faux depuis des mois.
  `src/canaux.js` (chargé par les DEUX `main.js`, entré dans les `files` du Cabinet) lit la dernière
  stable et la dernière bêta via `/sante` du relais, sinon l'API ; la ligne « Versions d'essai » la
  nomme avec sa date, dit « aucun essai en cours » quand la dernière bêta est devenue stable, et
  ne dit AUCUN numéro quand elle ne sait pas. Un test interdit tout `X.Y.Z-beta.N` écrit dans les
  écrans.
- **Le même écran dans les deux applications : un module, trois branchements** (`src/renderer/
  majui.js`, les deux `index.html`, les `files` du Cabinet). Les deux panneaux avaient déjà divergé
  (identifiants, phrases, boutons). Ce qu'on reprend de macOS et de Sparkle : l'application et sa
  version en tête ; UN bloc d'état (coche verte / disponible avec barre et Mo / prête avec
  « Redémarrer maintenant » ET « Rechercher une version plus récente » / erreur grise ou rouge) ; des
  LIGNES de réglage avec leur valeur ou leur interrupteur ; la recherche lancée à l'ouverture du
  panneau ; et la fenêtre « prête à installer » (notes, « Plus tard », « Redémarrer maintenant »),
  **une fois par version et par jour au plus**, jamais par-dessus une autre question ni quand le
  panneau est déjà sous les yeux. Le module rend du HTML et des décisions ; chaque application
  garde son pont, son jeton d'accès et sa panne de relais.
- **Un interrupteur est la case elle-même, redessinée** (`input.switch`, `appearance: none`), pas une
  case cachée sous un décor : il garde son clavier, son étiquette, et ce que `e2e:beta` clique.
- **Quatre assertions retournées vers la règle** (vingt-deuxième à vingt-cinquième fois) : la bêta
  « choisie par `K.releasePourIndex` » (elle l'est par sa variante qui relit), `trouveFichier` qui
  « appelle releaseAdmissible » (elle passe par `trouveDans`, qui l'appelle), le bloc jeton borné sur
  l'ancien gabarit, et le bloc d'erreur lu dans la source — il est jugé désormais sur ce que le
  module REND, pour les deux gravités.
- **Une assertion sur une MENTION laisse passer le défaut** (7.2.0, re-rencontrée) : « `memePrete(info)`
  figure dans la source » restait vert avec `if (false && memePrete(info))`. Elle exige la branche.
- Écran de verrouillage du Cabinet : deux boutons pleine largeur l'un sous l'autre se lisent comme
  un seul bloc à deux étages — `.lock-card .btn + .btn` dans la feuille partagée, pour les deux
  applications, jamais sur un identifiant.

### 10.12.0 — Le Cabinet parcouru comme un comptable le vivrait

Skander : « parcourir l'app cabinet en ui ux designer senior », puis « corriger tout », puis
« utilise tes 3 outils afin de vérifier et prouver que ton lot est bien corrigé, comme ça tu vois ce
qu'un comptable voit réellement ». Trente constats (U-01 → U-30, `A-FAIRE.md` avant cette version),
corrigés en quatre lots — les chiffres, la saisie et le livre, la hiérarchie, trouver —, et chaque
lot revérifié à la souris et au clavier. Publiée en **bêta** : elle touche au moteur comptable.

**La méthode, qui est la leçon principale.** Le test « comme un humain » (`scripts/humain/`) a trouvé,
APRÈS chaque lot corrigé et vert, des défauts qu'aucun test ni aucun parcours ne voyait : neuf après
le lot B (H-1 à H-9 — un montant « 250.000 » lu deux cent cinquante mille, une case refusée qui ne
restait pas rouge au survol, des noms tombés à quatre lettres), et en lot D une recherche qui perdait
les lettres tapées, une contre-passation qui menait à une impasse, un dossier tenu au cabinet
« hors mission » sur toute sa ligne, une palette qui ignorait l'Aide. **Les `e2e` cliquent des
sélecteurs ; ce test clique des pixels et lit l'écran — les deux sont nécessaires**, et c'est le
second qui dit si le premier vérifie la bonne chose.

Règles apprises, à ne pas recasser :

- **Un rôle désigne le compte, jamais un préfixe écrit à part** (U-03). La déclaration d'employeur
  lisait `masse('65')` pendant que la paie écrit ses charges patronales au **645** : « aucun
  mouvement » sur un dossier qui en portait 627 890 DT. C'est la faute de la 10.10.0 (« un modèle se
  confronte aux comptes que le MOTEUR écrit ») un écran plus loin. Et une copie du modèle livrée par
  la 10.11.0 se renomme à la lecture — jamais une rubrique que le cabinet a écrite.
- **Deux écrans qui parlent de la même mission lisent le même début de mission** (U-05,
  `debutDeMission`) : la Comptabilité criait « il manque 6 mois » sur des mois que le Suivi disait
  hors mission.
- **Un agrégat de plusieurs clients nomme SON mois** (U-04) : la carte additionnait le mars d'un
  client et l'août d'un autre. `caDuPortefeuille` sert la carte ET le pied du tableau (6.8.1).
- **La ligne de flottaison se mesure sur le portable** (U-01) : à 1280×800 la grille de saisie
  montrait UNE ligne sous 480 px d'en-têtes et de bandeaux ; elle en montre dix. Un écran de travail
  qui commence sous le bas de l'écran n'est pas un écran de travail.
- **Une colonne collante réserve sa largeur** (U-02) : elle recouvrait Débit et Crédit du journal,
  « Signalés » des Dossiers, juillet et août de la Production — une donnée cachée par un bouton.
- **Treize onglets ne se lisent plus : trois groupes, dans l'ordre du mois** (U-06) — Saisir,
  Consulter, Déclarer et clôturer ; l'écran vit dans l'adresse, et chaque dossier rouvre sur l'écran
  où on l'a laissé (H-5).
- **Une saisie qui vit en mémoire se protège à la fermeture** (U-09), et **une fenêtre de formulaire
  demande avant de jeter ce qu'on vient de taper — dans les DEUX applications**. La règle vit dans
  `modal()` : l'instantané se prend APRÈS le montage (ce que la fenêtre préremplit n'est pas une
  saisie), `garde: false` dit qu'une fenêtre n'en veut pas, et `suivreSaisie` a le MÊME corps des deux
  côtés, comparé par un test. L'app entreprise n'avait AUCUN garde-fou de fenêtre (7.3.0).
- **Un montant s'écrit et se relit en français dans un champ** (H-3), et une case refusée reste
  rouge au repos, au survol et sous le curseur (H-3 bis : la règle du survol battait celle de l'erreur).
- **Un seul bouton principal par écran, et c'est l'étape suivante** (U-11) — calculée par une
  fonction (`const suivante = …`) que le test ÉVALUE, jamais un vert posé à la main. Un bouton
  principal éteint perd sa couleur ; les Réglages n'en ont aucun au repos (« Enregistrer » s'allume à
  la première modification). Mesuré : aucun des écrans de l'exemple n'en a deux.
- **L'orange est gardé pour un geste ; l'état normal se dit en gris** (U-13). « 1 bulletin non réglé »
  est l'état de départ d'un bulletin, pas une alarme (8.0.1).
- **Un écran de travail s'ouvre sur le dernier mois qui a des données, sinon le mois courant — jamais
  un mois futur** (U-12) : la Paie s'ouvrait sur décembre.
- **Ne pas savoir n'est pas « non », aussi pour une échéance** (U-21) : la CNSS ne vise que les
  employeurs que les livres connaissent. Et un index écrit avant la version se RELIT une fois — sinon
  la CNSS aurait été réclamée à tout le portefeuille le matin de la mise à jour.
- **La palette de chaque application propose l'Aide** (jumeau manquant, 7.3.0) : Cmd+K du Cabinet ne
  connaissait ni les treize écrans de comptabilité ni les articles ; « béji balance » ouvre la balance
  de Béji, et une question propose l'article qui l'explique — cherché dans son corps, classé, borné.
- **Un article d'Aide par écran, qui finit par son geste** (U-08), et la bulle du titre de l'écran y
  mène : sept écrans de comptabilité n'avaient aucune explication.
- **Un exemple COMPLET est un test que les jeux minimaux ne sont pas** (U-10). Remplir la banque, la
  paie, les biens et la révision de l'exemple — par les VRAIES portes (`exemple-vitrine.js`,
  `ecrireLeLivre`), jamais par des écritures posées à la main — a fait tomber quatre défauts du moteur
  qu'aucun test n'avait les données pour voir : l'IRPP de juillet diminué du reversement de juin, la
  balance d'ouverture comptée deux fois, l'à-nouveau pris pour un suspens de banque et pour un mois à
  déclarer, et l'à-nouveau proposé en face d'un versement du même montant.
- **Un refus qui promet une sortie doit l'avoir** : « contre-passe d'abord » menait, une fois la
  contre-passation faite, à la MÊME phrase. Une écriture contre-passée LIBÈRE ce qu'elle portait
  (paie, dotation, déclaration, inventaire), `ceQuePorte` le dit dans la question AVANT le geste, et
  un refus sur un brouillard dit « supprime-la » — pas une contre-passation impossible.
- **Un dossier tenu au cabinet prend ses mois dans son LIVRE**, pas dans ses paquets : jamais
  « hors mission », jamais « pas reçu » (`recu: null`, 9.6.0), dans les échéances comme « à saisir »
  et jamais relancé (6.8.0). La Production, le Suivi et les Échéances lisent `productionDuDossier`.
- **Une recherche garde des PIÈCES, jamais des lignes** : une pièce dont une ligne correspondait
  sortait coupée, et l'écran annonçait « 24 pièces déséquilibrées » sur un livre juste. Et un champ
  qui redessine son écran à la frappe passe par `sansPerdreLaFrappe` — une seule fonction pour les
  trois champs, dont le troisième avait oublié la parade (« P » au lieu de « PAIE-2026-08 »).
- **Un badge ne vit pas dans une cellule `nowrap` à côté d'une référence**, et **une action seule dans
  un tableau dense porte son mot court** (`court` dans `rowmenu.js`, la phrase entière restant lue et
  survolée) : une pièce contre-passée élargissait le journal jusqu'à cacher le Crédit.
- **Une dotation est une écriture d'inventaire : elle se RÉCLAME au dernier mois de l'exercice** ;
  une sortie d'actif, tout de suite. La pastille et le bouton vert lisent la même fonction
  (`aReclamerImmobilisations`) ; le bouton reste utilisable plus tôt, et dit pourquoi il n'est pas vert.
- **Un écart se montre avec ses deux termes** (9.8.8, porté aux suspens) : total côté banque, total
  côté livre, et une phrase qui dit si leur différence refait tout l'écart — ou ce qui vient d'avant
  les relevés importés.
- **Un autre écran commence en haut** (le jumeau de la 7.27.0) et **le geste qui détruit vit en bas de
  son menu, après un trait, dans les deux applications** (7.29.0 — la règle n'était tenue par aucun
  test, et « Supprimer ce brouillard » était la ligne au-dessus de « Joindre un justificatif »).
- **Un message écrit ses dates comme l'écran et s'accorde à ce qu'il compte** : « du 2026-08-31 » et
  « elles restent en brouillard » pour une seule pièce, dans le compte rendu d'un lot et de la fusion ;
  « 1 paquet n'est pas définitif… Leur mois… Ils sont quand même exportés » sur la page Écritures de
  l'exemple, qui en a UN. Le verbe du compte s'accordait, pas la phrase suivante.
- **Un contrôle qui porte son geste le pose dans une rangée flex, pas dans la phrase** (T-56, re-trouvée) :
  à 1280 px « Renseigner le n° de … » passait à la ligne collé sous sa phrase, à 3 px (`.ctrl-geste`).

**Les instruments ont grandi avec le lot**, et chacun a trouvé quelque chose dans l'heure : la sonde
d'espacement entre dans la FENÊTRE ouverte (elle s'arrêtait à `#view`) dans les deux applications ;
`SONDE_TRONQUE` mesure le texte coupé à côté d'une colonne vide ; `e2e:cabinet-rendu` ouvre les deux
dossiers pleins de l'exemple (les vitrines, lues dans le scénario, jamais nommées à la main), les
sections repliées rouvertes, la fenêtre du modèle de liasse, et le livre-journal d'une pièce
contre-passée — et tombe s'il en mesure moins que prévu (T-55, un écran de plus).

Pièges de test, tous déjà écrits ici et re-rencontrés :
- **Un garde-fou neuf change le geste des parcours** : `e2e:immobilisations`, `entreprise`, `fiches`,
  `repondre`, `reglages` et `licence` fermaient une fenêtre remplie par « Annuler » ou Échap, et
  restaient bloqués sous la question que la fenêtre pose désormais. Chaque parcours répond à la question — c'est ce
  qu'un humain fait.
- **Et relire ces parcours pour les adapter a trouvé la règle qui manquait au garde-fou** : un mot de CONFIRMATION
  n'est pas un travail à protéger. Renoncer à « Tout effacer » après avoir tapé EFFACER demandait
  « Abandonner cette saisie ? » — `garde: false`, et son jumeau du Cabinet (`confirmTyped`) n'a pas de
  formulaire. Une règle générale se relit sur ses cas particuliers avant d'être déclarée finie.
- **`e2e:retenue` était tombé depuis la 10.2.0**, qui a rangé « Modifier la fiche » du client dans le
  menu « Actions » : le parcours cherchait encore `#edit`. Un parcours qu'on ne relance pas se périme
  sans rien dire (7.28.0) — et c'est le relancement de TOUS les parcours qui l'a montré.
- **`e2e:console-rendu` aussi, depuis la 10.9.0** — mais là, c'est son garde-fou qui a parlé : « la
  console offre 11 onglets et le parcours en connaît 10 ». L'onglet « Commandes » entre dans la
  mesure avec une vraie commande, créée par la route d'achat PUBLIQUE ; le prestataire de paiement
  est remplacé dans le serveur de test comme Resend l'est — pour ce seul parcours (`servir({ konnect:
  true })`) : `e2e:console` garde le décor qu'il a toujours eu, achat en ligne fermé.
- **Des données qui ne discriminent pas ne prouvent rien** (10.0.0) : la preuve du classement des
  articles d'Aide restait verte, parce que l'article attendu était déjà premier dans l'ordre du
  fichier. Le test vérifie que l'ordre naturel NE donne PAS la réponse avant de juger le classement.
- **Trois assertions recopiaient une forme** et sont tombées sur du code juste — la branche « action
  seule » de `rowmenu.js` (une fenêtre de 400 caractères), T-34 et T-10 : retournées vers la règle
  qu'elles portaient, comme deux autres au lot A qui décrivaient l'état du jour.

**Puis l'app entreprise, parcourue de la même façon** (demandé par Skander : « continue tes tests
directement sur l'app entreprise comme tu as fait avec l'app cabinet »). Ce que ça a appris :

- **Le lanceur du test humain ouvrait une application qu'aucun client n'a.** `lancer.sh` démarrait
  `src/main.js` : Electron ne trouvait pas le package.json, `app.getVersion()` rendait SA version
  (« v44.4.1 » en bas de la barre latérale), et les mises à jour comparaient une version inexistante.
  Il lance la RACINE, comme `npm start` et les e2e. **Avant de juger ce qu'on voit, vérifier que c'est
  bien le produit qu'on regarde** — un instrument de test qui déforme l'objet est pire qu'aucun. Au
  passage, les deux `app.getVersion()` du Cabinet (demande de licence, annonce à la plateforme)
  contredisaient son propre en-tête : `VERSION`, partout.
- **Un prix posé par le logiciel n'est pas un prix décidé.** « Remplir ton catalogue » se cochait
  tout seul pour TOUS les métiers : la règle de la 7.18.0 (« un prix non nul suffit ») supposait des
  exemples à 0, or les quinze métiers en portent. Le test de la 7.18.0 prenait `fromSetup` à 120 DT
  pour « un prix ajusté » — les deux étaient indiscernables dans ses données (10.0.0). La DÉCISION est
  l'enregistrement de la fiche (`catalogForm` retire `fromSetup`), le test tourne sur les vrais
  catalogues des métiers, et la liste montre « exemple » tant que rien n'est décidé.
- **Un rappel qui sert à deux choses reçoit les arguments des deux.** Onze listes redessinent par
  `draw(sortKey)`, et ce même `draw` est le `done` des fenêtres : `catalogForm(c, draw)` le rappelait
  avec la prestation enregistrée, prise pour une colonne — le tri disparaissait, la liste revenait
  page 1. C'est le jumeau inverse de la 7.17.0 (`bindSort(…, () => draw())` qui JETAIT la colonne) :
  seule une chaîne est une colonne, et le test compte les onze gardes.
- **Une mise en page qui dépend de sa propre barre de défilement a deux états stables.** La barre
  latérale débordait d'un pixel ; la barre de défilement (10 px sous Linux, 17 sous Windows) faisait
  passer « Facturation récurrente » à la ligne, ce qui entretenait le débordement. On décide sur la
  mise en page SANS barre (`ajusterNav` retire la classe avant de mesurer), et on remesure au
  redimensionnement — sans quoi une fenêtre rétrécie cacherait le bas de la liste.
- **Une légende qui renvoie à une marque absente est une phrase que rien ne tient** (7.3.0). La
  légende « * obligatoire » se DÉDUIT de la classe (7.20.0) ; l'étoile, elle, exige un libellé qui
  soit un ÉLÉMENT (`span:first-child::after`) — le piège noté en 8.1.0, jamais tenu par un test.
  Quinze libellés nus dans les deux applications, dont la fiche client, la plus ouverte de toutes ;
  `lbl(texte)` sans clé de bulle rend lui aussi un texte nu, et le test le refuse.

**Puis l'éditeur de devis, tapé comme un artisan le tape** (H-E1 → H-E8, un devis de carrelage de
six lignes, à la souris et au clavier, à côté de l'aperçu puis sans) :

- **Une page de CRÉATION n'a rien à faire dans la pile de navigation** (H-E3). Enregistrer un devis
  neuf laissait « ← le document » : il menait à `#/doc/new/devis`, c'est-à-dire à un devis VIERGE —
  le même défaut après une émission, un export PDF et un achat neuf. `remplacerPage(hash)` dit à
  `pushHistory` que la page qu'on quitte est remplacée, pas visitée. C'est le « on y est déjà » de
  `goBack` (2.4.0), vu de l'autre bout.
- **Ce qui apparaît selon une valeur vit dans une place qui existe déjà** (H-E1). Choisir un client
  faisait naître « Fiche du client » SOUS le champ : tout descendait de 45 px, et le clic suivant, visé
  sur « Objet », tombait dans le vide — la frappe partait sur la page, les espaces la faisaient défiler.
  Aucun test ne voit un clic qui tombe à côté ; le lien vit dans la ligne du libellé, où il ne pousse rien.
- **Une grille se décide sur la place du CADRE, pas de la fenêtre** (H-E2) : à côté de l'aperçu, la
  désignation — la colonne qu'on lit — avait 84 px, et le prix 45. Chaque `<tr>` y est SA grille, donc
  **aucune colonne automatique** : une largeur qui dépend du contenu n'est pas la même d'une rangée à
  l'autre, et l'en-tête se décalait d'une colonne. Le seuil de la requête de conteneur est décidé sur
  ce qui RESTE à la désignation (960 px, pas 880), et c'est `e2e:editeur` qui l'a dit.
- **Un bouton dans un bouton n'existe pas** (H-E4) : `info()` rend un `<button class="i">`, et posé à
  l'intérieur d'un autre bouton le parseur ferme le premier. Chaque bulle du menu « Facturer ▾ » tombait
  seule sur sa ligne, et `#photo` caché laissait sa bulle visible (`.btn[hidden] + button.i`). Neuf cas,
  dont un dans le Cabinet ; le test compte toute bulle posée dans un bouton.
- **Un seul bouton principal par écran, et c'est l'étape suivante** (U-11, porté à l'app entreprise,
  H-E5) : un devis enregistré et inchangé gardait « Enregistrer » en vert. L'étape suivante est de
  l'envoyer ; « Enregistrer » redevient principal à la première frappe.
- **Une liste vide dit à quoi elle sert et donne le geste qui la remplit** (7.0.0, re-trouvée sur
  quatre pages) : Clients, Fournisseurs, Achats et Autres pièces posaient une recherche et des filtres
  au-dessus de zéro ligne. **Et le test de la règle exigeait « au moins trois » `filtersBar`** : un
  compte laisse passer tout ce qu'il ne compte pas, ici quatre listes. Il exige désormais que CHAQUE
  recherche de liste (`#q`) soit posée par `filtersBar`, qu'aucune barre ne soit nue, et que les
  boutons des états vides soient branchés.
- **La règle générale des champs gagne encore** (sixième fois : 7.27.0, 7.30.0, 9.4.4…) : la recherche
  des listes devait faire 300 px **depuis la 2.2.0** et prenait toute la ligne — `input:not(…)` à quatre
  `:not()` bat une classe. Filtres, bulle et compteur passaient sur une seconde rangée au-dessus de
  chaque liste. `e2e:entetes` mesure maintenant aussi les barres de filtres, et tombe s'il n'en voit
  aucune. La règle neuve ne pose PAS de fond : la règle sombre (0,4,2) la perdrait, et le blanc sur
  blanc de la 7.30.0 reviendrait.
- **La fenêtre porte le titre de la page** (H-E7) : « Nouveau document » au-dessus de « Nouveau devis ».
  Sans titre propre, il se lit dans le `h1` de l'écran — une seule source, celle qu'on voit.
- Piège de test : mon assertion e2e « le retour ne mène plus au devis vierge » lisait les trois
  dernières entrées de la pile — elle restait verte avec le défaut remis, parce que le devis vierge
  n'était jamais la dernière. **Une assertion sur une pile lit son SOMMET** : c'est là que « ← » va.

**Puis la facture, de l'émission à l'avoir** (H-E9 → H-E18 : une facture émise, payée en deux fois,
puis corrigée par un avoir alors qu'elle était déjà payée) :

- **Le geste le plus irréversible passait par la question la plus générique** (H-E11). « Émettre
  FAC-2026-001 ? » dans une boîte qui floutait le document : on confirmait sans pouvoir relire à qui ni
  combien. `confirmerEmission` pose un récapitulatif (client, date, échéance, net à payer ; la facture
  corrigée pour un avoir) et **dit AVANT d'émettre ce qu'un avoir laisse à rendre** quand la facture
  est déjà payée — une somme due au client, qui ne se découvrait qu'après, sur une carte. C'est le
  « dernier écran avant un geste irréversible » de la console (10.6.0), porté à l'app entreprise.
  Et la phrase dépend de ce que le client a PAYÉ : ma première version écrivait « est déjà payée »
  d'une facture qu'un autre avoir couvrait — sans paiement, un avoir de trop n'est pas une somme à
  rendre, c'est un montant qui dépasse la facture, donc presque toujours une faute de saisie.
- **Une facture que ses avoirs annulent en entier n'a plus rien à corriger** : le bandeau proposait
  encore « Corriger par un avoir… » en vert, c'est-à-dire un avoir de trop. `motifVerrou` rend
  `annulee`, et le bandeau, sa bulle et son bouton lisent la même réponse. Piège de données : un avoir
  tiré de la facture ne porte pas le timbre (« avoir sans timbre par défaut — À VÉRIFIER »), donc il
  laisse la facture due d'un dinar et ne l'annule PAS — le test le dit dans les deux sens.
- **Un état vide qui porte son bouton principal éteint celui de l'en-tête** (U-11, huit pages) :
  « + Nouveau client » en vert au-dessus de « + Ajouter mon premier client » en vert, deux verts pour
  le même geste. Quand seule une partie de la page se redessine (Contrats, Licences), l'en-tête bascule
  DANS le dessin de la liste — pas au dessin de la page, qui n'a lieu qu'une fois. Le test lit chaque
  route à état vide et chacun de ses en-têtes (Licences en a deux) ; `e2e:entreprise` compte les verts
  à l'écran juste après l'assistant.
- **Un état actif ne change pas la géométrie** : l'entrée allumée de la barre latérale passait en
  gras, « Facturation récurrente » passait à la ligne (34 → 48 px), et tout le menu descendait de
  14 px sous le curseur au moment du clic. Le fond teinté et la couleur disent l'état ; le gras disait
  en plus « bouge ». `e2e:barre` allume chaque entrée à son tour et compare sa hauteur au repos — une
  mesure qu'aucune capture ne donne, puisqu'une capture ne montre jamais les deux états. Je l'avais
  d'abord rangé dans `A-FAIRE.md` sans l'avoir mesuré : **une note qu'on n'a pas mesurée se vérifie
  avant d'être écrite**, dans un sens comme dans l'autre.
  Et la preuve par réintroduction est restée VERTE deux fois : la mesure tournait d'abord sur une
  entreprise vide, donc sans les compteurs qui font passer l'entrée à la ligne ; puis, avec l'exemple,
  sur seize entrées qui débordent d'un écran de 900 px — la barre de défilement rétrécit la barre, et
  l'entrée était déjà sur deux lignes AU REPOS, donc le gras ne changeait plus rien. **Un instrument
  qui compare deux états se place là où ils peuvent différer, et il EXIGE cette condition** (ici : une
  fenêtre haute, « rien ne défile », et l'entrée qui sautait SANS son compteur — avec l'exemple, son
  « 1 » la replie déjà au repos) ; sinon il mesure l'égalité de deux défauts. Troisième fois verte,
  la preuve n'a parlé qu'une fois l'instrument instrumenté : `console.log` des hauteurs, dans
  l'environnement du test, plutôt qu'une hypothèse de plus. Et le pied de la barre (Paramètres,
  Aide) passait encore en gras : la règle ne visait que le menu, le test lit maintenant les deux.
- **Un trop-perçu n'est pas un reste à payer à zéro** (H-E18) : « 0,000 DT » en VERT sur la
  situation la plus inconfortable d'une facture, la dette envers le client en petit gris dessous. Le
  chiffre juste, dans la mauvaise couleur, dit le contraire du vrai. La bulle dit la limite :
  SkanFact n'enregistre pas encore un remboursement rattaché à la facture (`A-FAIRE.md`).
- **« Un paiement existe » n'est pas « soldée »** (H-E13) : le bandeau d'une facture payée en ENTIER
  disait « déjà payée en partie », sa bulle disait « soldée » d'une facture payée à moitié.
  `core.motifVerrou` rend la phrase ET sa bulle, et le test lit une facture de 120 DT (100 HT + 19 % +
  timbre) payée en 50 puis 70 — un montant rond ne prouverait rien du « payée en entier » (9.6.1).
- **`closedBlock` reçoit un NOM, pas une phrase** : son gabarit est « X porte la date du… », et
  « Ce paiement ne peut pas être supprimé » y donnait « Ce paiement ne peut pas être supprimé porte la
  date du… ». Au même endroit, `closedToast` — que la 7.17.0 disait supprimé — vivait encore, appelé
  une fois : **un mécanisme déclaré retiré se cherche dans le code**, pas dans le CHANGELOG. La clôture
  passe avant la question (7.6.0), et le test l'exige par l'ORDRE des deux appels.
- **Les pictogrammes muets d'une ligne de paiement** (H-E14, la 7.29.0 jamais portée ici) : « ✎ » et
  « ✕ », le second supprimait un paiement sans dire lequel. Et le règlement fournisseur n'avait QUE le
  « ✕ » (H-E15, le jumeau manquant de la 7.3.0 : un paiement client se corrige depuis la 7.3.0) — sa
  fenêtre annonçait en plus en DINARS le reste d'un achat en euros, la 10.1.0 un écran plus loin.
- **La règle générale des champs gagne encore, septième fois** (H-E17) : sur une facture émise,
  `input:disabled` (0,1,1) perdait contre `input:not(…)×4` (0,4,1) — les champs texte gardaient fond
  blanc et encre foncée pendant que les listes voisines se grisaient. **Un écran à moitié gris est pire
  qu'un écran tout blanc** : il dit que certains champs sont encore modifiables. La règle porte la
  chaîne de `:not()`, comme la règle sombre le faisait déjà.
- **Une classe posée par le code et inconnue de la feuille, cinq d'un coup** (H-E16 ; 6.8.0, 7.23.0,
  7.27.0, 8.1.0, 9.4.3) : `.warn-box` et `.code-box` vivaient dans la feuille du CABINET — l'app
  entreprise les posait sur la question du comptable et la clé d'une licence, sans encadré ; `.span-3`
  et `.mod-sub` n'existaient nulle part. Le test lit TOUTES les classes des gabarits contre la feuille,
  avec une liste NOMMÉE de crochets — une classe qui existe pour être TROUVÉE, pas stylée — et **un
  crochet qui gagne une règle doit sortir de la liste**, sinon la liste ment à son tour.
- **L'étiquette d'une case à cocher est UN élément** (H-E9) : `.check` est un conteneur flex, et
  « Timbre fiscal (», le montant et « ) » devenaient trois éléments à 8 px d'écart, repliés sur deux
  lignes. Même famille que « deux boutons voisins ne dépendent pas d'une espace du gabarit » (7.29.0) :
  le HTML est juste, c'est la mise en page qui décide. Le test lit les deux applications.
- **Le bouton retour nomme la pièce** (H-E10) : « ← le document », sur une facture tirée d'un devis —
  lequel, quand on est soi-même sur un document ? `pageLabel` nomme la pièce, le client, le
  fournisseur ; le nom ENTIER dans la bulle, abrégé à 26 caractères sur le bouton, pour qu'une raison
  sociale longue ne change pas la taille de la barre d'actions.
- **Une liste déroulante n'est pas un badge** (H-E12) : « brouillon » en minuscule entre « Tous les
  statuts » et « Français » se lit comme une valeur oubliée. `optionStatut` met la majuscule au
  LIBELLÉ ; le test exige une `value` explicite, sinon c'est le libellé qui partirait dans les données.
- Piège de test e2e : le récapitulatif est une grille à deux cellules, et `textContent` colle le
  libellé à la valeur (« Facture corrigéeFAC- ») — mon assertion accusait du code juste. **Un parcours
  qui compare le texte d'une grille ne suppose pas l'espace que l'écran dessine** (le cousin de 9.8.0,
  où `textContent` GARDAIT les retours de la source).

**Et en finissant la facture et l'achat à la souris** (H-E19 → H-E24) :

- **Ce qui apparaît ne pousse rien, deuxième fois sur la même page** (H-E19 ; H-E1) : le repère « non
  enregistré » naissait À CÔTÉ du titre. À 1440 px l'en-tête, élargi, passait sur deux rangées au
  premier geste, et tout le formulaire descendait de 40 px — le clic suivant, visé sur l'Objet, tombait
  à côté, la frappe partait sur la page. Le point de la grille du Cabinet avait appris la leçon en
  H-2 : le jumeau manquant, encore (7.3.0). Le repère vit hors du flux, dans la marge SOUS l'en-tête,
  ancré sur l'en-tête entier : sous le TITRE, quand l'en-tête passe sur deux rangées, c'est la rangée
  des actions. Et le défaut n'existe qu'entre deux largeurs — l'en-tête tient juste sans le repère,
  pas avec ; à 1280 px il est déjà sur deux rangées —, d'où `e2e:entreprise` qui mesure à 1440.
- **« Émettre » enregistre aussi** : la règle H-E5 (« Enregistrer redevient principal dès qu'on
  modifie ») allumait « Enregistrer le brouillon » à côté d'« Émettre la facture ». Elle vit dans UNE
  fonction, `enregistrerDevientPrincipal`, qui éteint les autres verts de l'en-tête, et que les deux
  éditeurs appellent — sauf la facture et l'avoir, dont l'étape suivante reste d'émettre.
- **Le jumeau manquant dans la même application** (H-E21) : un achat qu'on venait d'enregistrer
  gardait « Enregistrer » en vert, et son panneau des règlements posait un second vert. La règle H-E5
  n'avait jamais été portée à l'éditeur d'achat ; le règlement est l'étape suivante, et
  `e2e:justificatif` compte les verts enregistré, modifié, puis réenregistré.
- **Une proposition que personne n'a demandée ne se pose pas sous le prochain clic** (H-E20) : la liste
  du catalogue (9.2.1) s'ouvrait sur un libellé libre avec une seule ligne, « + Créer … au catalogue »,
  posée EXACTEMENT sur la quantité et le prix — le clic visé sur le prix ouvrait une fiche de
  prestation. « Créer » seul n'apparaît que si la liste est DEMANDÉE (flèche du bas, « Choisir
  l'article… ») ; la décision est une fonction pure, `propositionsCatalogue`, que le test joue.
  **Aucun parcours ne l'aurait trouvé** : ils cliquent des SÉLECTEURS, et un sélecteur n'est jamais
  recouvert. C'est le test à la souris, qui clique des PIXELS, qui l'a vu — et le parcours qui le
  tient maintenant clique le prix APRÈS avoir tapé, puis vérifie que le curseur y est.
- **Une liste vide n'est pas une recherche qui échoue** (H-E22) : « Aucun résultat » sous un champ où
  rien n'est tapé fait chercher ce qu'on a mal écrit. Même règle que « un état vide dit sa cause »
  (9.8.8), un composant plus bas.
- **Deux délais sur une pièce légale, et c'était NOTRE défaut** (H-E23) : la phrase des conditions de
  paiement disait « à réception de la facture » pendant que la même facture imprime « À régler avant
  le … » à trente jours. En cas de retard, c'est le client qui choisit lequel il lit. Le défaut ne dit
  plus que le moyen. Et une phrase restée ainsi n'est **jamais réécrite** : elle est lue sur la
  société à chaque impression, donc la migrer changerait le texte d'une facture DÉJÀ ENVOYÉE qu'on
  réexporte (la règle 7.1.x, pour un texte cette fois). Elle se MONTRE dans le récapitulatif
  d'émission (`delaisContradictoires`, pure) ; une échéance le jour même ne contredit rien. Vu dans
  l'aperçu, jamais dans un test : un parcours vérifie qu'une phrase est LÀ, pas qu'elle dit le
  contraire d'une autre.
- **Un total n'additionne que des pièces de même nature** (H-E24 ; règle 7.18.0, jamais portée à la
  fiche client) : son tableau de documents additionnait le devis DÉJÀ facturé avec sa facture et
  l'avoir — 1 520,440 DT « net à payer », le devis compté deux fois. Quand une liste mêle les factures
  à d'autres pièces, `docTable` ne totalise que les factures et les avoirs, et le pied le DIT
  (« factures et avoirs : … »). `e2e:entreprise` le vérifie sur des montants calculés à la main.

**Et en tapant au clavier ce que tape un chef d'entreprise** (H-E25 → H-E30) :

- **Un champ `type=number` se lit dans la langue du SYSTÈME, pas dans celle de l'application**
  (H-E28, le plus grave de ce lot) : sur un poste réglé en anglais, « 2,5 » tapé dans un prix devenait
  **25** — la virgule avalée comme séparateur de milliers, sans un mot, une facture dix fois trop chère.
  Le carnet `A-FAIRE.md` le rangeait en « affichage » (« 507.94 ») ; c'était une SAISIE fausse. Le
  remède tient en une ligne de `main.js`, `app.commandLine.appendSwitch('lang', 'fr-FR')`, posée
  AVANT `ready` : la virgule devient la décimale, le point reste accepté, et la trentaine de champs
  sont couverts d'un coup — au lieu du portage champ par champ que le Cabinet a fait en H-3 (ses champs
  sont du texte). **Aucun test ne pouvait le voir** : un parcours pose la valeur par le code (« 2.5 »),
  jamais par les touches, et le code ne passe pas par la conversion localisée. `e2e:fiches` TAPE
  maintenant « 2,5 » touche par touche, et tombe sans le commutateur. Symptôme à reconnaître : un
  montant juste chez l'auteur (Mac en français) et faux chez un client — le fuseau de la 5.2.3, en
  version langue.
- **Deux écrans qui montrent la même pièce ne disent qu'un montant** (H-E25 ; règle 6.8.1) : la
  palette Ctrl K recalculait le sien — un avoir en POSITIF quand toutes les listes le montrent en
  négatif, et dans la devise de la société quand la pièce porte la sienne. Une fonction,
  `montantDeListe`, pour la liste et la palette. Et **deux recherches sur le même corpus ne disent pas
  deux choses** : la palette ne lisait que le titre des articles d'Aide, la page Aide lit leur corps —
  « assiette », l'exemple que la page Aide donne dans son propre champ, rendait « Aucun résultat »
  d'un côté et trois articles de l'autre. La palette appelle `aideFiltre`, le moteur de la page ; c'est
  le jumeau inversé de la 10.12.0 (le Cabinet avait appris à lire le corps, l'entreprise non).
- **Un état vide qui dit le geste en prose, encore** (H-E27 ; règle 7.0.0) : la page Stock sans article
  suivi disait « ouvre le Catalogue, modifie la prestation et coche… », et son seul vert était
  « + Mouvement » — un mouvement de rien. Le geste est dans la page (« + Nouvel article suivi », la
  fiche arrive déjà suivie) et l'en-tête ne propose rien qu'on ne puisse pas encore faire. Au même
  endroit, **un bouton qui promet ce que son formulaire ne pose pas** : « + Nouvelle prestation
  suivie » ouvrait une fiche aux cases décochées.
- **Un agrégat porte son unité, et un total vit sous SA colonne** (H-E26 ; 7.0.1, 9.4.5) : le pied du
  Catalogue faisait la moyenne de 25 DT de l'heure, d'un lot à 0 et d'une pièce à 150 — et posait la
  valeur du stock sous la colonne TVA, deux colonnes avant « Stock » (un colspan faux, invisible tant
  que l'entreprise n'a aucun article suivi). La moyenne ne paraît plus que dans une seule unité, qu'elle
  nomme ; `e2e:fiches` mesure la cellule sous son en-tête.
- **Un bouton qui change de page mène au GESTE, pas à un endroit d'où le chercher** (H-E29 ; 7.21.0) :
  « Partir d'une facture existante » ouvrait la liste des factures, et le geste (« Rendre récurrente »)
  vivait dans l'éditeur, deux écrans plus loin — rien ne le disait. On choisit la facture sur place ;
  le contrat s'ouvre prérempli (`recurrenceFromInvoice`, déjà écrit pour l'éditeur). Même famille
  sur « Proforma, bons et contrats » (H-E30) : l'onglet vide renvoyait au menu « Transformer » d'un
  devis ; il propose la pièce de départ, lue dans `CONVERSIONS` à l'envers, et appelle `convertDoc`.
- **Un parcours ancré sur une COULEUR se périme au premier arbitrage du bouton principal** :
  `e2e:argent` cliquait `.page-head .btn-primary` pour créer un client ; depuis U-11, le vert d'une
  liste vide est celui de l'état vide, et le parcours attendait trente secondes un bouton qui n'était
  plus vert. Il vise `#new`, ce que le bouton FAIT (septième occurrence de « un e2e se périme »).

**Et la console, par le parcours qui la mesure** : garnir l'onglet Commandes (10.9.0) a fait parler
la sonde du texte coupé et les captures. Trois tables de mots de la page (`NOM_LIGNE`, `ARTICLE`,
`ACTIONS`) avaient oublié l'écran neuf — « 1 ligne », « Ouvrir commandes » —, `NOM_EVT` ne nommait
aucun des cinq événements de la vente en ligne (« commande.creee » en chasse fixe), et les phrases
des alertes et du journal écrivaient « 2026-10-14 » et « 1822.1 TND » (`fmtJour`, `fmtMontant` côté
module). **Un écran ajouté se confronte à TOUTES les tables qui le nomment** — le test de la 10.9.0
en tenait deux sur cinq. Et le plafond fixe de 260 px d'une colonne de texte est remplacé par des
PARTS proportionnelles à son plus long texte : des parts qui font 100 % laissent aux dates et aux
montants exactement leur contenu, et un texte n'est coupé que si tous le sont.

**Puis l'application entreprise mesurée en ENTIER** (`e2e:entreprise-rendu`, et son guide
`test/e2e/ecrans-entreprise.js`). Ses instruments ne regardaient qu'une partie de l'application :
`e2e:contraste` visitait `#/recurrentes`, une adresse qui n'existe pas — le routeur retombait sur
l'accueil, donc la Facturation récurrente n'avait jamais été mesurée et l'accueil l'était deux fois ;
aucun n'ouvrait une fiche, ni une pièce par statut ; le photographe prenait `fullPage` sur un cadre
fixe (9.4.3) et sa table d'onglets nommait sept onglets disparus, sautés sans un mot. C'est T-55
(9.8.8) sur la surface qu'on croyait couverte. Les règles du guide :
- **Les pages se lisent dans le code** (`routes.x = `) ; une route qu'on ne sait ni ouvrir comme page
  ni atteindre comme fiche fait TOMBER le parcours. Les onglets se lisent dans l'écran, les fiches
  dans les données (une pièce par type ET par statut), et les fenêtres s'ouvrent par leur vrai
  bouton : un geste qui accepte le clic et ne produit RIEN est une faute (7.0.0). C'est ainsi qu'il a
  trouvé « + Créer mon premier contrat » mort depuis la 7.8.0 : l'état vide passait `null` au
  formulaire, l'en-tête un contrat fabriqué à la main. **Un contrat neuf naît en UN endroit**
  (`contratNeuf`), et le formulaire sait recevoir `null`.
- **Une cellule qui porte un CHAMP s'aligne par son champ.** La sonde des colonnes ne lisait que le
  texte des cellules : toutes les grilles de saisie lui échappaient, et « Qté » et « P.U. HT » étaient
  alignés à gauche au-dessus de chiffres alignés à droite, dans les cinq éditeurs de lignes. Elle lit
  maintenant l'alignement du champ unique et visible d'une cellule sans texte — et a trouvé aussitôt
  deux colonnes de plus (« Jusqu'à » des Barèmes, « Jour limite » du calendrier fiscal).
- **Un champ de nombre sélectionne ce qu'il contient quand on y entre** (9.4.5, jamais portée à
  l'app entreprise). Un prix proposé à 0, aligné à droite : le clic à gauche posait le curseur
  devant, et « 850 » devenait 8 500 DT. Aucun parcours ne pouvait le voir — ils font Ctrl+A avant de
  taper, ou posent la valeur par le code. `e2e:fiches` clique maintenant à gauche du champ, sans
  Ctrl+A, comme un humain ; sans la règle, il retrouve exactement « 8500 ». Le `mouseup` qui suit le
  clic désélectionne : on l'annule une fois, pour ce clic-là.
- **Une liste dont la ligne ne s'ouvre pas au clic est la seule à le faire** : le Catalogue exigeait
  « Actions ▾ → Modifier » pendant que les premiers pas disaient « Ouvre-en une ». `drawList` reçoit
  `ouvrir`, et un test exige chacune des trois listes qu'il construit.
- **Deux panneaux qui proposent chacun « la suite » se contredisent** (7.18.0, re-trouvée sur
  l'accueil) : « Et maintenant » ne parle que quand les premiers pas se taisent, et le vert de
  l'en-tête s'éteint tant qu'ils proposent l'étape suivante. Au dernier écran de l'assistant, le
  vert passe de « Choisir un dossier… » à « Terminer » une fois la copie en place — deux verts
  faisaient cliquer « Terminer » en croyant avoir fini l'étape qu'on sautait.
- **Le jumeau du Finder** (E-14) vivait encore dans la phrase qui décide de la sécurité des données :
  « iCloud Drive » proposé sous Windows. `NUAGE` suit la plateforme comme `EXPLORATEUR`, et un test
  refuse « iCloud » sans OneDrive dans les quatre fichiers qui parlent à l'utilisateur.
- **Un montant se lit d'un bloc : ses espaces sont insécables.** `money()` séparait les milliers et
  la devise par une espace ordinaire : le navigateur coupait « 4 530,188 DT » en fin de ligne,
  « 4 » d'un côté. Le correctif est UNE ligne ; ses effets, une vingtaine d'assertions de tests et
  onze comparaisons de `e2e:entreprise` qui recopiaient l'ancienne espace. Deux pièges en les
  réécrivant : une assertion sur du texte APLATI (`\s+` → espace, qui couvre l'insécable) garde
  l'espace ordinaire, et « 1 EUR = 3,400 DT » n'est pas un montant de `money()`. Les CSV ont leur
  propre format et n'en reçoivent aucune — un test le tient.
- **Une information donnée une fois se réutilise là où elle sert** : l'assistant demande la banque et
  le RIB, le paiement répondait « aucun compte » avec un lien qui QUITTAIT la fenêtre. Le compte se
  crée par-dessus (`accountForm(null, done, modele)`), prérempli. Et un test qui découpait
  `paymentForm` sur 2 600 caractères fixes est tombé sur le code juste : une tranche se borne sur la
  fonction suivante (10.4.0).
- **Une promesse sur ce qui part se vérifie contre le CODE** (8.0.0, re-trouvée quatre fois) :
  l'assistant, l'article « Démarrer », le panneau et l'article de la licence écrivaient « rien n'est
  envoyé sur Internet » ou « présentée qu'au service de mise à jour », alors que la licence se
  vérifie aussi (8.4.0). Une phrase rassurante sur la confidentialité est la plus grave à laisser
  fausse : c'est celle qu'on répète à un client. Le test lit les trois fichiers sans leurs
  commentaires, interdit les formes absolues, et exige que l'accueil nomme les mises à jour ET la
  licence.
- **Un lien qui sert à deux choses ne décide pas seul d'une troisième.** L'acompte porte
  `fromQuoteId` comme une facture entière (7.29.0), et « À faire » jugeait « ce devis est facturé »
  sur ce seul lien : dès l'acompte émis, le devis disparaissait, et les 70 % restants n'étaient
  réclamés NULLE PART — sur la page d'un chantier, 4 598 DT. Ce qui ferme un devis est une facture
  totale ou de solde ; les acomptes se retranchent, sans leur timbre (le devis ne le portait pas).
  C'est la même faute que E-03 (le brouillon d'acompte que `piecesDuDevis` ne voyait pas), vue par
  l'autre bout : un devis a TROIS sortes de pièces filles, et chaque lecteur doit les distinguer.
- **Le geste suivant d'une ligne n'est pas le geste destructeur** (7.16.0, 7.29.0) : le menu d'un
  devis acompté ne proposait que « Refacturer la totalité… » en rouge. `facturerSolde` sert
  l'éditeur ET la liste, et porte sa propre question (le garde-fou vit avec le geste). Au passage,
  le vert « Facture de solde » ne regardait que les acomptes émis, jamais un solde existant :
  `soldable` exige les deux. Une assertion de la 7.16.0 exigeait `issuedDeposits.length` — elle
  décrivait le défaut, retournée.
- **Ce qui dépend de la page d'où l'on VIENT change la géométrie de celle où l'on est** — troisième
  occurrence de « ce qui apparaît ne pousse rien » sur le même en-tête (H-E1, H-E19). Le bouton
  retour nomme sa destination (H-E10), donc sa largeur suit l'origine : « ← Factures » tenait,
  « ← Hôtel Dar El Marsa SARL » faisait passer la barre sur deux rangées, et le clic visé sur
  « Émettre » tombait sur « Enregistrer le brouillon ». Deux moitiés, prouvées chacune seule : le
  retour s'abrège à dix-huit caractères, et « Agrandir », présent aussi en tête de la colonne
  d'aperçu, ne revient dans la barre que quand la colonne est masquée. `e2e:entreprise` ouvre la
  facture depuis la fiche d'un client au nom long et exige une seule rangée — la mesure H-E19
  partait toujours de la liste, donc du label le plus court.
- **Chercher n'est pas modifier, et ce qu'on a cherché est le nom de ce qu'on crée.** La recherche
  d'une liste (`combo`) vivait dans le formulaire de la pièce : sa frappe remontait jusqu'à
  `head.oninput`, qui marquait la pièce modifiée et rallumait « Enregistrer » (U-11) sur une facture
  où rien n'avait changé. Et « + Nouveau fournisseur » après « Bois du Sahel » introuvable ouvrait
  une fiche VIDE. Le combo arrête ses propres événements et passe sa recherche à `onAdd(saisi)` ; le
  test lit CHAQUE appel et exige que la recherche y serve, pas seulement qu'elle y entre — un
  paramètre reçu et ignoré est le jumeau d'un champ lu et jamais écrit (7.3.0).
- **Une invite écrite par l'auteur porte son métier** (le jumeau de l'Objet du devis, deux fois de
  plus) : « disques durs pour la Clinique » sur un achat, « Maintenance et supervision » sur un
  contrat. Le test lit maintenant TOUS les champs Objet, pas celui qu'on venait de corriger.
- **Un bouton qui promet un choix se décide par la fonction qui fait la liste** : « Choisir
  l'article… » ouvrait une liste où `propositionsCatalogue` ne rendait que « Créer ». Le libellé
  appelle la même fonction. Et **un zéro saisi par défaut n'est pas un chiffre décidé** (le jumeau de
  « un prix posé par le logiciel n'est pas un prix décidé ») : un prix de vente à 0 faisait calculer
  une marge négative et crier « à perte » en orange — du rouge sur une situation normale (8.0.1).
- **Une charge se définit par ce qui N'EN EST PAS, pas par la liste de ce qui en est.**
  `costOfGoodsSold` retenait `['vente', 'livraison']` : chaque nature de mouvement ajoutée depuis la
  4.0.0 (casse, inventaire, ajustement) sortait de la valeur du stock sans jamais entrer dans le
  résultat, et une menuiserie qui transforme ses planches n'avait AUCUN coût de matière. La liste est
  retournée : tout ce qui n'est ni un achat ni le stock de départ, dans les deux sens (un retour sur
  avoir, un surplus d'inventaire rendent leur coût). Le motif est celui de la 10.7.0 — une liste qui
  énumère ce qui compte se périme au premier ajout, une liste de ce qui ne compte pas tient.
  Le test pose les six mouvements d'un mois et attend 14 × 38,5, calculé à la main (7.0.1).
- **Un geste qui ne peut aller que dans un sens ne demande pas de signe.** La quantité d'un
  mouvement se tapait signée (« -2 pour une sortie ») : les 10 planches posées sur un chantier,
  tapées « 10 », faisaient GAGNER dix planches au stock, valorisées, et la fenêtre annonçait
  « Après ce mouvement : 50 . ». Une casse ou de la matière utilisée ne peut que sortir :
  « Quantité sortie », sans signe, et `C.qteMouvement` signe — la même fonction pour l'annonce et
  l'enregistrement. L'inventaire et l'ajustement, qui vont dans les deux sens, restent signés.
  Trouvé en tapant ce que tape le menuisier ; aucun parcours ne le pouvait, ils posent `-2`.
- **Une annonce qui se récrit à la frappe réserve sa hauteur** (`.annonce-stable`) : passant d'une
  ligne à trois, elle recentrait la fenêtre et « Enregistrer » bougeait de 7 px sous le curseur à
  chaque chiffre — le jumeau de H-E1, dans une fenêtre. Et **une option se lit entière dans sa
  liste** : « Utilisé sur un chantier ou en fal… » ; le libellé est court, la bulle dit le reste.
- **Une entrée ou une sortie en cours de mois se proratise** (`payslipInputFor`) : le brut de la
  fiche était repris en entier, donc un ouvrier embauché le 24 recevait un mois plein pour six jours.
  Le moteur partagé avec le Cabinet ne bouge pas — c'est le brut PROPOSÉ qui change, il reste
  modifiable, `prorata` dit d'où il vient, et un brut retouché à la main cesse de se dire proratisé.
  Montants du test calculés à la main sur le calendrier (20 jours hors contrat, 6 payés).
- **Un écran de travail s'ouvre sur le mois où il y a quelque chose à faire** (U-12, portée à la
  Paie de l'app entreprise) : `moisDePaie`. Et **« versé » ne se dit que de ce qui l'est** — un
  agrégat porte sa période ET son état (7.16.0) : « Net versé » additionnait les bulletins impayés.
- **La ligne garde le geste suivant** (7.29.0, portée à la Paie) : « Marquer payé » à la place de
  « PDF » et « Modifier ». Le parcours `e2e:entreprise` cliquait `[data-ed]` : retourné vers le menu.
- **Une règle posée sur UNE fenêtre se vérifie sur toutes** : l'annonce du mouvement de stock avait
  reçu sa hauteur réservée le matin ; six autres fenêtres avaient la même annonce vivante (net d'un
  salarié, plan d'un bien, marge, séries, cession, congé). Le test lit chaque `id="…-hint"`.
- **Une entrée de palette écrite à la main double l'onglet engendré** (7.30.0) : neuf entrées, dont
  « Seuil de rentabilité » qui ouvrait l'onglet Affaires. Leurs mots vivent dans `ALIAS`.
- **Un lien posé une fois par le routeur disparaît au premier redessin de l'en-tête** : Paie, Stock
  et Catalogue perdaient « Comprendre cette page ». Chaque redessin le repose, et le test lit chacun.
- **Un état vide dit sa raison ET le jour où ça changera** (E-06, porté au paquet du Cabinet) :
  « commence par émettre une facture » à une entreprise qui en a émis en septembre, sur le paquet
  d'août. `premierePieceApres` donne la date, et l'écran ne propose plus de clôturer ni ne marque
  « provisoire » un mois sans une pièce (vérifier que l'univers n'est pas vide, 7.0.0).
- **Une période se déclare une fois TERMINÉE** (`socialDue`) : le rappel CNSS partait 45 jours avant
  l'échéance, donc au milieu du trimestre, et « Marquer déposée » figeait une déclaration à laquelle
  manqueraient les derniers bulletins. Le dernier jour du trimestre n'est pas un trimestre terminé.
- **`refus()` reçoit un sélecteur OU un élément** : un champ de fenêtre se désigne par lui-même, et
  `document.querySelector(element)` LÈVE — la réponse vide au comptable plantait au lieu d'être
  refusée, depuis qu'elle existe.

**Puis le rapport d'une entreprise qui a tenu SkanFact** (E-01 → E-14, une session QA qui a joué une
vraie SUARL au régime réel, du premier écran au paquet du comptable). Ce qu'il a appris :

- **Une fonction qui rend un montant NATIF est un piège pour chacun de ses appelants qui additionne**
  (E-08). La 10.1.0 avait passé treize agrégateurs à `.base` et prouvé chacun par comportement ; la
  prévision de trésorerie et le lettrage lisaient `purchaseBalance(...).remaining` — natif, sous un nom
  qui ne le dit pas — et sortaient une facture de 1 190 € pour 1 190 DT : le trou annoncé était
  sous-estimé de 2 856 dinars. La couverture se fait **par appelant**, jamais par fonction : le test
  de la 10.1.0 (`devise-achat.js`) interroge maintenant la prévision et le lettrage aussi.
- **Un coût moyen pondéré dépend de l'ORDRE des gestes, et un tri par identifiant est un ordre
  arbitraire** (E-10). Les mouvements d'une journée se triaient `buy-` < `doc-` < `init-` : Achat →
  Vente → Stock de départ, et la vente sortait au coût de l'achat qui la SUIT. Le stock de départ
  ouvre sa journée, puis chaque mouvement à l'instant où il a eu lieu — une facture à son ÉMISSION
  (`issuedTs`), pas à la création de son brouillon ; sans instant connu, les entrées avant les
  sorties. Et l'instant d'émission appartient à la pièce émise : il ne se copie ni par `convertDoc`
  (`NOT_COPIED`) ni par « Dupliquer ».
- **Une garde neuve ferme la porte ; ce qui est passé AVANT se signale** (E-04). La 10.10.0 refusait
  un bulletin au net négatif, et ceux enregistrés avant restaient sans un mot — écriture inversée, et
  la CNSS du trimestre les additionnait sous « Marquer déposée ». `bulletinsImpossibles` les lit sur
  la COPIE figée du calcul (5.0.0 : c'est elle qui a été remise), « À faire » les nomme en rouge et
  mène au mois, et la déclaration ne se marque plus déposée tant qu'ils existent.
- **Une annonce se calcule par les MÊMES constructeurs que ce qu'elle annonce** (E-02). La fenêtre
  d'acompte faisait « total du devis − acompte » à la main : deux timbres d'écart avec la vraie
  facture de solde — le chiffre qu'on donne au client au téléphone. Elle appelle `invoiceFromQuote` +
  `settlementLines`, comme « Facture de solde ». C'est la règle du compteur et de sa liste (6.8.1),
  pour une phrase. Et en la corrigeant : `invoiceFromQuote` ne reprenait pas l'exonération de timbre
  du client (9.1.1), posée seulement en choisissant le client dans l'éditeur — le jumeau manquant,
  dans le même fichier.
- **Un brouillon compte** (E-03). `piecesDuDevis` ne voyait que les pièces émises : un acompte en
  brouillon laissait « Facturer ce devis » en vert et fabriquer une facture complète à côté — 150 %.
  Il rend `brouillons`, le bouton vert ouvre l'acompte, la question le nomme, et l'émission d'une
  facture qui reprend tout un devis prévient (on peut y arriver par « Transformer » aussi).
- **Deux chemins vers le même fichier divergent** (E-07) : l'écran numérotait par `livreJournal`, le
  paquet écrivait par `journalEntries` — la colonne « N° » qui regroupe les lignes à l'import partait
  vide, sous une phrase qui promettait des numéros qui ne bougent plus. Le paquet passe par
  `livreJournal`, et le test compare le fichier à l'écran pièce par pièce. (Le gabarit de l'exemple
  du Cabinet en dérive : `node scripts/exemple-cabinet.js`, et c'est pourquoi la preuve de ce défaut
  régénère le gabarit avant de lancer `npm test` — sans ça, c'est le test de cohérence du gabarit qui
  tombe, et on ne sait pas si le test d'E-07 voit quelque chose.)
- **Une phrase d'état vide dit SA raison, et le jour où ça changera** (E-06) : « Aucune pièce datée »
  sur cinq pièces du mois en cours. `rienACloturer` distingue « aucune pièce », « tout est clôturé »
  et « pas encore terminé », avec la date du premier mois clôturable.
- **Le jumeau manquant, une fois de plus** (E-14) : le Cabinet avait `EXPLORATEUR()` depuis la 6.8.0,
  l'application entreprise écrivait « le Finder » en clair — sur Windows, la plateforme où SkanFact est
  distribué. `EXPLORATEUR`, `clavierLocal` (⌘ → Ctrl dans l'Aide et les bulles), le réglage « Mail
  (Apple) » posé seulement sur Mac, et `messageOuvert(r, joint)` qui dit ce qui s'est VRAIMENT passé
  (`r.state` : Mail peut refuser l'automatisation et retomber sur `mailto`). Un test exige que chaque
  envoi porte la messagerie choisie, et que chaque envoi avec fichier dise où le trouver.
- **`pagerBar` reçoit la PAGE, jamais ce que rend `paginate`** (E-09, « undefined » cinq fois). Et le
  test de la 7.16.0 qui gardait cette page **recopiait la forme du défaut** (`const pg = paginate…`
  puis `pagerBar(pg,`) : retourné vers la règle — dix-septième fois. Une preuve qui tombe sur un
  AUTRE test que le sien ne prouve pas le sien : celle-ci neutralise l'ancien le temps de voir
  tomber le nouveau.
- **Un champ jugé sur sa seule PRÉSENCE laisse passer une valeur fausse** : le matricule inventé de la
  7.6.0, puis le RIB de dix chiffres ici — « tes documents sont en règle ». `verifRib` (vingt chiffres
  et leur clé modulo 97, ou un IBAN ISO 13616) avertit en orange pendant la frappe, sans jamais
  refuser : un compte à l'étranger peut avoir une forme qu'on ne connaît pas.
- **Le pluriel s'écrit en ENTIER** (E-13) : « 2 bulletin de paie », « Acompte versés » — ajouter un
  « s » n'accorde que le dernier mot, et ne rien ajouter n'en accorde aucun. `LIST_PLURIELS` porte
  les mêmes clés que `LIST_LABELS` (un test les confronte), `PURCHASE_KINDS` porte son pluriel.
- **Un délai constaté ne descend pas sous zéro** (« délai moyen : −3 jours ») ; **un nombre nu
  s'écrit comme un montant** (« Capital 10000 ») ; **le seul secret qui part se nomme** (la clé de
  signature, dans la fenêtre de partage).
- **Une règle appliquée à la main parcours par parcours l'est sur 11 sur 49** (E-01) : la 7.28.0
  avait écrit « toute fermeture passe sous `Promise.race` », et `e2e:entreprise` — le parcours qu'on
  lance avant de publier — restait bloqué pour toujours après ses 83 étapes. `fermer()` vit dans le
  harnais (délai, `SIGKILL`, phrase qui nomme la cause), les 52 fichiers qui ouvrent Electron l'appellent, et un test
  interdit `app.close()` partout ailleurs.
- **Un parcours reconnaît un bouton à ce qu'il FAIT, jamais à sa couleur** — cinq parcours cliquaient
  `.page-head .btn-primary` (`argent`, `exemple`, `erreur`, `barre`, `reglages`), et U-11 a changé
  les couleurs. Et le test d'U-11 lui-même ne reconnaissait qu'une FORME d'état vide (`etatVide(…,
  true)`) : le panneau « Aucun salarié » de la Paie, écrit à la main, gardait deux verts. Il lit
  maintenant aussi les boutons « premier… » écrits à la main et les en-têtes fabriqués par une
  fonction — et il borne un en-tête en COMPTANT ses `<div>`, parce qu'une tranche de longueur fixe
  débordait sur le panneau d'en dessous et accusait la Trésorerie (prouvé dans les deux sens).

**Puis la menuiserie, continuée page par page** (relances, contrats, autres pièces, affaires,
marges). Ce que ça a appris :

- **Une étiquette de GESTION se pose sur une pièce émise.** L'affaire ne s'imprime pas, n'entre dans
  aucune écriture et ne change aucun montant : la griser sur une facture émise, c'était condamner la
  marge d'un chantier créé après coup à rester fausse pour toujours. Le verrou d'une pièce émise
  protège ce qui fait foi (le numéro, les montants) — pas ce qui ne sert qu'à se retrouver. Elle
  s'enregistre tout de suite (`poserAffaire`), sans marquer la pièce modifiée.
- **Ce qui se crée depuis une fiche naît rattaché à cette fiche** : « + Devis » et « + Achat » de
  l'affaire ouvraient des pièces vierges, qu'on croyait comptées. Le rattachement voyage dans
  l'adresse (`…/affaire/<id>`), et le retour la nomme.
- **Un lien retiré en amont se retire en aval** : changer le client d'une pièce laissait l'affaire de
  l'ancien client, invisible dans la liste filtrée — le devis du client B comptait dans le chantier
  du client A. Et ce qui se choisit doit pouvoir se DÉCHOISIR : « — Aucune affaire — » en tête de la
  liste (7.3.0 : ce qui se saisit doit pouvoir se corriger).
- **Une chaîne de pièces se lit en entier** (`core.chaineDePieces`) : `derivedDocs` ne voit que les
  enfants directs, donc un bon de livraison tiré d'une proforma DÉJÀ facturée proposait « Facturer ».
  On remonte à l'origine par les TROIS liens qu'une pièce peut porter (`fromDocId`, `fromQuoteId`,
  `deposit.quoteId`), on redescend, et c'est borné. C'est E-03 (les trois sortes de pièces filles
  d'un devis) un étage plus haut : chaque lecteur d'une vente doit voir toute la vente.
- **U-11 sur TOUTES les pièces, pas seulement celles qu'on a regardées** : la règle connaissait le
  devis (« Email ») et la facture (« Émettre »), et un bon de livraison tiré d'une proforma s'ouvrait
  sans aucun vert. `suiteExtra` la calcule — et une pièce tirée d'une autre n'a pas encore de
  NUMÉRO, donc son étape suivante est « Enregistrer », pas « Envoyer ». Un geste qui n'existait que
  dans l'éditeur (« Transformer ▾ ») vit aussi dans le menu de la ligne, par UNE fonction
  (`transformerPiece`), qui porte le garde-fou de licence que l'éditeur n'avait pas.
- **Un compteur à côté d'un total ne compte que ce que le total n'a pas encore compté** : « en devis »
  additionnait un devis entièrement facturé à ses propres factures. Et une marge sans aucun achat
  n'est pas « 100 % » en vert — c'est une marge qui n'a pas encore son coût, et elle le dit sur les
  trois écrans qui la montrent, par la même règle (`margeSansAchat`).
- **Ce qui répond à un clic ne se déplace pas sous le curseur** — trois fois : « Fixe ou variable ? »
  rangeait les charges en deux colonnes selon leur état (cocher faisait monter la suivante à sa
  place : un second clic reclassait une autre charge) ; la liste d'années qui paraît sur un onglet
  faisait grandir l'en-tête de 3 px (les onglets descendaient au moment du clic — l'en-tête a
  désormais la hauteur d'un champ) ; le bouton qui passe de « Enregistrer » à « Rattacher 1 pièce »
  poussait « Annuler » de 39 px (sa largeur est réservée).
- **Une porte qui disparaît avec la dernière pièce libre ferme aussi la sortie** : « Rattacher
  d'autres achats… » n'existait que s'il en restait à rattacher — donc plus aucune façon de DÉTACHER
  depuis la fiche. Sous une liste pleine, le geste reste, et son libellé dit ce qu'il fera.
- **Une ligne de liste dit ce qu'elle contient, pas seulement qui l'a émise** : un achat sans objet
  s'affichait « BS-2026-0412, Bois du Sahel » — ce qu'on décide en le rattachant, c'est s'il a servi
  au chantier. Ses lignes le disent (`contenuAchat`), et la recherche les lit.
- **Zéro est une valeur** (7.1.0, 7.16.0, re-trouvée) : un délai de paiement réglé à 0 — « à
  réception » — repassait à trente jours par `Number(x) || 30`. `core.delaiJours` ; et une facture
  due le jour même dit « À réception ».
- **Une recherche tapée plie les accents, dans TOUTES les recherches** (`core.correspondRecherche`) :
  le Cabinet le faisait depuis la 6.8.0, l'app entreprise nulle part — « hotel » ne trouvait pas
  l'Hôtel, sur le geste qu'on fait le plus (le jumeau manquant, 7.3.0).
- **Une espace insécable ne colle pas un élément en ligne atomique** : la bulle « i » (inline-grid)
  passait seule à la ligne derrière une insécable. Le dernier mot et la bulle vont dans un `<span>`
  qui ne se coupe pas — la première version tenait sur les écrans vérifiés, et c'est la sonde des
  bulles, braquée sur tous les écrans à 1280, qui l'a démentie.
- **Un état observé sur la mise en page doit observer la mise en page**, pas les gestes qui la
  changent : l'entrée allumée de la barre latérale revenait 12 px sous le bord après un rechargement
  (la pastille de l'essai arrive dans le pied APRÈS le rendu). Un `ResizeObserver` sur la liste couvre
  ce geste-là et le prochain qu'on ajoutera.
- **Une règle de largeur générale ne bat pas une largeur demandée** : `.modal:has(table…)` (0,2,1)
  écrasait `.modal.cab-large` du Cabinet et coupait 25 px de la fenêtre du modèle de liasse. Posée
  sous `:where()`, elle ne pèse plus rien (le motif de la règle générale qui avale l'exception, 7.23.0,
  cette fois dans la feuille partagée entre les deux applications).
- **Le garde-fou des pluriels a arrêté un défaut que j'écrivais** : `pl(n, 'autre ligne')` aurait
  donné « 2 autre lignes ». Un mot composé passe son pluriel entier.
- Piège de parcours : une liste qui gagne une entrée en tête (« — Aucune affaire — ») change ce que
  « la première ligne » désigne ; `e2e:entreprise` choisit maintenant une ligne qui n'est pas la
  valeur ACTUELLE (`.combo-it:not(.cur)`) — il reconnaît l'entrée à ce qu'elle fait, pas à son rang.
- Piège de test, **vingt-sixième fois** : l'assertion H-E5 recopiait la condition du vert de
  « Enregistrer » et est tombée sur du code juste. Retournée : la condition s'ÉVALUE sur chaque cas
  (neuve, enregistrée, sans numéro).

**Puis la menuiserie, ses biens et son personnel** (immobilisations, congés, avances, documents,
déclarations sociales, registre, barèmes — à la souris et au clavier) :

- **Un formulaire qui redessine ses lignes à chaque frappe est un formulaire où l'on ne tape pas**
  (7.17.0, re-trouvée dans les Barèmes). `#rf.oninput` redessinait le barème ENTIER alors que la
  valeur tapée n'était lue qu'au `change` : le premier chiffre détruisait le champ, le curseur tombait
  dans la page, la tranche revenait à son ancienne valeur. Depuis des versions, aucune tranche ne se
  modifiait au clavier, et le parcours e2e ne pouvait pas le voir — il `fill()` la valeur, jamais
  touche par touche. La frappe met à jour la DONNÉE et les cellules qui en dépendent ; les lignes ne
  se redessinent qu'à l'ajout ou au retrait. `e2e:entreprise` tape maintenant une tranche et son taux.
- **Une page de réglages longue a la barre « Enregistrer » des Paramètres** (le jumeau dans la même
  application, 7.3.0) : elle n'apparaît qu'après une modification, colle au bas de l'écran, et
  quitter la page OU l'onglet pose la question — un onglet interne n'est pas un changement de page
  pour le routeur, il appelle `leaveOk()` lui-même.
- **Une période se déclare une fois TERMINÉE**, pour le bouton comme pour le rappel : « Marquer
  déposée » était vert sur le trimestre en cours. Le dernier jour du trimestre n'est pas un trimestre
  terminé (`<=`, et le test le fixe).
- **Un avertissement se lit avant le geste** (9.4.2), y compris un solde : la fenêtre d'une absence
  dit le solde de congés avant ET après, et le négatif AVANT d'enregistrer. Quand on MODIFIE une
  absence déjà comptée, le moteur l'a déjà retranchée : l'annonce la lui rend, sinon elle compte
  deux fois.
- **Une fenêtre s'ancre en haut** : centrée, elle se recentre en grandissant, et ce qu'on venait de
  manipuler remonte sous le curseur (H-E1, dans une fenêtre). Feuille partagée : les deux apps.
- **`pl()` accorde un nombre négatif comme son contraire** (« −3 jours »), dans les quatre jumeaux —
  `Math.abs`, corps comparés par un test.
- **Une colonne nomme ce qu'elle additionne** : « IRPP » sur une somme IRPP + solidarité.
- **Une ligne s'ouvre au clic, partout** — absences, avances (de la page ET de la fiche), bulletins de
  la fiche, registre : un « Modifier » au bout d'une ligne est un second bouton (7.29.0), et une liste
  qui NOMME des personnes mène à leur fiche (7.15.0).
- **Un confirm REMPLACE-t-il une décision ? Son bouton dit le geste**, pas « Confirmer ».
- Piège de lint : `new Function` est interdit (`no-new-func`) — un test évalue un corps extrait par
  `vm.runInNewContext`.
- Piège d'e2e : un parcours qui prend « le premier trimestre qui porte des bulletins » tombe le jour
  où ce trimestre est en cours ; il prend un trimestre TERMINÉ, et remonte d'une année en janvier.

**Et la fin du tour** (clôture, paquet, Paramètres, statistiques, séries, devise, avoir fournisseur,
inventaire, rapprochement, thème sombre — à la souris et au clavier) :

- **Une règle GLOBALE neuve se relit contre tous les champs qu'elle touche** — y compris ceux qu'un
  redessin re-crée. La sélection au focus d'un champ de nombre (plus haut, la menuiserie) prenait le
  focus rendu PAR LE CODE pour une entrée : l'inventaire se redessinait à chaque chiffre, re-posait le
  curseur, la règle sélectionnait le « 2 » de « 28 », et le « 8 » le remplaçait. Et sous elle, un
  défaut plus ancien : un champ de nombre recréé rend son curseur au DÉBUT (`setSelectionRange`
  échoue sur `type=number`), donc « 28 » donnait 82 depuis la 4.0.0. Deux remèdes, chacun à son
  niveau : la règle ne sélectionne que si la PERSONNE entre (pointeur ou Tab, `entreeVoulue`), et
  l'inventaire met sa ligne à jour sur place (`majInventaire`) — la règle 7.17.0, jamais appliquée à
  ce tableau. Le parcours `e2e:entreprise` posait le comptage par `fill('1')` : il TAPE maintenant un
  nombre à deux chiffres, touche par touche. Un chiffre juste chez `fill` et faux au clavier, c'est
  H-E28 une fois de plus.
- **Deux pense-bêtes pour une même déclaration, c'est deux vérités** (6.8.1) : la CNSS du trimestre
  avait celui de la Paie (`cnss-2026-T3`) et celui du calendrier fiscal (`cnss@2026-10-15`). Une
  occurrence du calendrier DÉSIGNE maintenant la déclaration sociale qu'elle rappelle
  (`echeanceSociale`), la Paie fait foi, et une mention posée dans le calendrier avant la version
  compte encore (`socialesDeposees` la relit) — une garde neuve ne jette pas ce qui existe (E-04).
- **Un renvoi vers un réglage peut viser un CHAMP** (`panneau:champ`) : « Le renseigner » ouvre la
  fiche société le curseur dans la case du matricule CNSS. Un test lit chaque renvoi et exige que le
  champ visé existe dans les Paramètres — un renvoi vers un nom inventé ne fait rien, sans erreur.
- **Un zéro qui veut dire « aucun » s'affiche vide, avec son invite** (« aucun seuil », « aucun
  objectif ») : « 0 » dans la case se lit « un seuil de zéro dinar », c'est-à-dire le contraire.
- **Un seul vert par onglet de Paramètres, et c'est l'étape suivante** (U-11) : « Activer un mot de
  passe » ne s'allume qu'une fois la copie externe posée, « Enregistrer la clé » quand une clé NEUVE
  est collée, « Signaler un problème » jamais au repos.
- **Une phrase désigne un bouton par son NOM, jamais par son rang** : « le premier… le second »
  décrivait deux boutons dans une rangée qui en porte trois.
- **Ce qui dépend d'une valeur la suit, titre compris** : un avoir fournisseur gardait « Nouvelle
  facture d'achat » en titre et « récupérer la TVA » dans ses lignes (`motsDePiece`, une table pour le
  dessin ET le changement de nature).
- **Un verdict qui répond à une saisie répond pendant la frappe** : le rapprochement ne disait « Ça
  tombe juste » qu'en quittant la case. Seul le verdict se met à jour (`verdictReleve`, UNE phrase
  pour le dessin et la frappe) ; le panneau suit au `change`, sinon la case serait détruite.
- **Une couleur foncée écrite en dur a sa jumelle sombre** : le pied de la barre recopiait `#4b5563`
  des liens du menu sans leur règle `body.dark` — 2,1 de contraste. La sonde `e2e:contraste` ne
  pouvait pas le voir (elle mesure les boutons, et son seuil de 2,0 n'attrape que l'illisible) ; un
  test lit maintenant les deux feuilles et exige la jumelle pour chaque couleur foncée
  (`.print-only`, l'exception nommée : une page imprimée reste claire).
- **Une règle écrite dans CLAUDE.md et contredite par un bouton de l'application est un bug** (7.3.0) :
  la 4.0.0 dit « un stock négatif n'est jamais à ajuster », et l'alerte d'un stock négatif proposait…
  « Ajuster », à côté d'un « Voir » (deux boutons, 7.29.0). Le geste d'une alerte est l'ACHAT, qui naît
  avec la ligne de l'article (`#/achat/new/…/article/<id>/<qté>`) ; la ligne ouvre la fiche.
- **Une quantité signée prend le même signe moins que les montants** (`qteSignee`) : « -1 » en tiret
  à côté de « − 38,500 DT ».
- **Le jumeau manquant, dans le sens inverse** (7.3.0) : le Cabinet avait `sansPerdreLaFrappe` (rendre
  le champ ET la place du curseur après un redessin) ; l'app entreprise replaçait le curseur au bout
  du texte dans six recherches. Même corps des deux côtés, comparé par un test — et la règle interdit
  `setSelectionRange(x.value.length, x.value.length)`, la forme exacte du défaut.
- Pièges de preuve : deux preuves sont d'abord tombées sur l'ANCIEN test de la même règle
  (`run-tests.js`, qui passe avant la suite) — elles ne prouvaient pas le nouveau. Elles le
  neutralisent maintenant le temps de la preuve (9.8.8, « une preuve qui tombe sur un AUTRE test »).
  Et une ancre de preuve recopiée de mémoire (dix espaces au lieu de huit) ne trouve rien : on la lit
  dans le fichier.

**Puis les données et la sécurité** (sauvegardes, restauration, mot de passe, verrouillage, « Tout
effacer », seconde entreprise — à la souris) :

- **Une règle posée sur cinq fenêtres ne vaut pas pour les autres** (7.20.0) : `refus()` montrait la
  case refusée dans les éditeurs et cinq fenêtres ; vingt-cinq refus (mot de passe, paiement,
  relance, mouvement, compte, mail, assistant…) ne faisaient qu'un message rouge. La règle se lit
  maintenant sur la CONDITION — un refus jugé sur `v.<champ>` passe par `refus`, jamais par `toast`
  (`v.ok`/`v.motifs` sont des verdicts, pas des cases) — et un test la tient sur tout le fichier. Un
  refus venu du processus principal nomme sa case (`champ: 'current'`) pour que l'écran la montre.
- **Une règle qui attend un nom l'attend tel qu'on le FABRIQUE** : `NOM_SAUVEGARDE` attendait la date
  en début de nom (`^\d{4}-…`), storage.js écrit `skanfact-AAAA-MM-JJ.json` — la sauvegarde la plus
  fréquente n'a jamais eu son libellé. Le test lit le motif de storage.js et chaque étiquette passée à
  `createBackup`/`backupNow`, et exige un libellé propre pour chacune ; `avant-beta` n'en avait pas.
- **Un chemin remplacé se remplace dans TOUS ses textes** : la 7.3.0 a donné un « Restaurer… » à
  chaque sauvegarde, et trois textes (la fenêtre « Tout effacer », la bulle, l'article) envoyaient
  encore vers « Importer ».
- **Un geste qui recharge la fenêtre passe par le garde-fou**, comme une navigation : créer une
  entreprise jetait une saisie en cours, alors que basculer d'entreprise, dans le même menu, la
  protégeait. Et deux copies du même geste (menu, Paramètres) avaient déjà divergé : UNE porte,
  `nouvelleEntreprise`, et un test compte les `addDossier`.
- **Deux chiffres justes qui se contredisent à l'écran sont un défaut** (6.8.1) : « 3 factures en
  retard » (À faire, sans les relances reportées) sous « 4 en retard » (la carte). Le moteur ne
  change pas ; la ligne dit ce qu'elle compte (« à relancer ») et nomme ce qu'elle laisse de côté.
- **Un menu n'hérite pas de la largeur de son ancre** : le menu des entreprises tenait aux deux bords
  de l'en-tête (195 px) et coupait ses gestes. `width: max-content`, au moins l'en-tête ;
  `e2e:entreprises` mesure chaque libellé.
- **Deux boutons au même effet font relire la fenêtre pour une nuance qui n'existe pas** :
  `choiceDialog` posait toujours « Annuler » à côté de son second choix, même quand le code ne
  distinguait pas l'un de l'autre (« Plus tard », « Le garder en brouillon »). `labelB` à null donne
  un choix et une sortie nommée ; un test lit ce que chaque appel FAIT de la réponse.
- **Un réglage de l'ORDINATEUR qui écrit des données d'ENTREPRISE doit savoir laquelle.** Le
  dossier de copie externe vit dans `app-config.json`, pour tous les dossiers ; `mirrorExternal`
  écrivait `<copie>/SkanFact/skanfact-data.json` pour chacun. Deux entreprises, une clé : la
  seconde effaçait la copie de la première, et un changement de mot de passe rechiffrait les
  sauvegardes de l'autre avec la mauvaise clé. `nomCopieExterne` donne à chaque dossier son
  sous-dossier (le premier garde `SkanFact`, là où les copies existantes sont), retenu sur le
  dossier (`copieExterne`) pour qu'un renommage ne le déplace pas. Le cas n'avait rien d'exotique :
  c'est la famille de Skander (2.0.0, 3.2.0).
- **Un filet dont on ne sait pas reprendre le contenu n'est qu'à moitié un filet** (6.8.1, côté
  entreprise) : la copie externe emporte les pièces jointes « parce que c'est le seul filet qui
  les emporte », et l'import — le seul chemin sur un nouvel ordinateur — les laissait sur la clé.
  `reprendrePiecesJointes` les ramène (celles que les données importées désignent, sans jamais
  écraser), et l'Aide dit le chemin. Et un état lu au démarrage se lit sur la chose elle-même
  (7.1.x) : « Copie à la prochaine sauvegarde » s'affichait devant une copie de la veille.
- **Une promesse de retour se tient par un bouton** (6.8.1 : « toute donnée qu'on demande de
  conserver doit avoir un bouton pour la reprendre ») : « Retirer » disait « tu pourras le rouvrir
  plus tard », et le seul chemin passait par un geste fait pour autre chose — « Rejoindre un dossier
  partagé » — qui marquait le dossier `shared` et lui retirait sa copie externe sans un mot. Un
  dossier retiré vit dans `dossiersRetires`, « Remettre dans la liste » le rend tel qu'il était, et
  `estDossierLocal` empêche qu'un dossier de `userData/dossiers/` passe pour partagé. Un geste
  détourné de son rôle emporte ses effets de bord avec lui.
- **Le jumeau du Finder vivait aussi dans le processus principal** (E-14) : le titre du sélecteur
  de copie externe, la phrase de panne ENOENT des deux applications, et six textes du Cabinet
  proposaient « iCloud » seul. Le test qui le tenait ne lisait que les fichiers du renderer ; il
  lit maintenant les deux `main.js` et le Cabinet.
- Piège du lanceur humain : `lancer.sh` repart d'un profil NEUF sauf `--garder`. Relancer l'app
  pour un changement du processus principal efface les données de test — c'est voulu, mais il faut le
  savoir avant de chercher l'écran de verrouillage d'un mot de passe posé dans l'autre profil.
- Piège de test, re-rencontré (8.1.0) : une assertion sur du texte source doit porter l'apostrophe
  ÉCHAPPÉE (`l\\'entreprise`), sinon elle accuse du code juste.

### 10.13.0 — Avant la mise en production : le pont, envoyé pour de vrai

Skander : « il faut tester toute l'application (entreprise et cabinet et le pont entre les deux) en
entier, avec tous les parcours ». Les quatre demandes précises (listes modernes, bulles → article,
une position pour les confirmations, barre latérale repliable) sont livrées ; puis un paquet est
parti de l'app entreprise vers le Cabinet, des questions sont revenues, une réponse est repartie —
aux trois outils, à la souris. Publiée en **bêta** : elle touche à la signature des envois.

Règles apprises, à ne pas recasser :

- **Une signature qui ne se compare à rien ne prouve rien.** « Origine vérifiée » s'affichait sur une
  clôture ou des questions dès que la signature correspondait à la clé que le fichier PRÉSENTE — or
  n'importe qui fabrique une paire de clés, et le matricule d'un client est public. Une clôture
  importée VERROUILLE un exercice. Le commentaire du handler promettait même la confiance au premier
  usage (« une fois une clé épinglée… REFUSÉ ») : rien ne l'implémentait. `core.verdictEnvoiCabinet`
  porte les six cas (jumeau de `cabcore.verdictOrigine`, 9.2.0, vu de l'autre côté) ; la signature
  se retient à la première clôture ou aux premières questions — et c'est dit, jamais « vérifiée » —,
  un envoi d'une autre clé est refusé en nommant les deux empreintes, et ne plus signer après avoir
  signé est refusé. La reprise d'une nouvelle clé est un geste humain (« J'ai vérifié avec mon
  comptable »), et la signature retenue se voit et s'oublie dans les Paramètres. Un nouveau cabinet
  (autre empreinte d'appairage) ou un cabinet retiré efface la signature retenue. `e2e:cloture`
  fabrique un faux cabinet (même dossier, re-signé par une autre clé) et exige le refus.
- **Épingler une clé tirée par POSTE fabrique des refus.** La clé de signature du Cabinet était tirée
  au hasard sur chaque ordinateur (`cle-cabinet-signature.json`) : sans épinglage ça ne se voyait pas,
  avec lui deux collaborateurs (9.9.0) ou un changement d'ordinateur (clé de secours) auraient été
  refusés. Elle est DÉRIVÉE de la clé du cabinet (`Z.cleSignatureDerivee`, HKDF → graine Ed25519) :
  elle suit la clé partout où elle va, et son empreinte s'affiche dans Réglages → Mon cabinet.
  **Corriger la règle sans corriger ce qu'elle compare aurait remplacé un défaut silencieux par des
  refus à tort** — c'est en cherchant d'où venait la clé qu'on l'a vu, pas en écrivant la règle.
- **Chaque paquet signé arrivait avec « ⚠ 1 fichier présent mais non annoncé »** : la signature
  elle-même, qui ne peut pas figurer dans le manifeste qu'elle signe (`cabcore.HORS_MANIFESTE`). Les
  verdicts RANGÉS avec les paquets (6.8.1) se nettoient à la lecture (`migrateDossier`), sinon
  l'alerte survivait sur tous les paquets déjà reçus.
- **Un paquet fabriqué ne se réécrit pas, et le vert doit le savoir** (U-11). Répondre au comptable
  puis cliquer le vert « Envoyer au comptable » joignait le fichier fabriqué AVANT la réponse ; la
  phrase promettait « il n'y a rien d'autre à envoyer ». L'étape suivante se calcule (`suivante` :
  répondre, fabriquer, refaire, envoyer, avec `C.reponsesApres`) et le bouton dit « Refaire le
  paquet avec ta réponse ». Les questions passent AVANT « Fabriquer et envoyer » : les réponses
  partent dedans.
- **Une réponse déjà rangée qui revient n'est pas une réponse sans question.** Le client renvoie
  toutes ses réponses dans chaque paquet ; le Cabinet ne les retirait des « restantes » que si une
  NOUVELLE avait été posée dans le livre, et comptait les autres « à une question que ce dossier ne
  porte plus », à chaque paquet, pour toujours. `compta.posterReponsesDansLivres` est pure et testée ;
  une réponse est connue dès que sa question est dans le livre.
- **Ce que l'import écrit dans un livre périme le livre gardé en mémoire.** La Révision annonçait
  « 1 question attend sa réponse » sur une question répondue : le rapport ne le disait pas, et
  l'écran relisait l'ancien livre. L'import dit les réponses (« Lire la réponse » ouvre la
  Révision) et oublie le livre du dossier ouvert (`livreCle`). C'est la règle 9.2.0 (« les gestes
  qui modifient le livre reposent l'état eux-mêmes ») — l'import en était un sans le savoir.
- **Écrire un fichier n'est pas l'envoyer** : « 1 question envoyée, signée » sur un fichier qu'il
  reste à transmettre. Le compte rendu dit où il est et le montre.
- Et deux jumeaux de règles anciennes : « * obligatoire » écrit à la main dans une fenêtre dont
  `modal()` pose déjà la légende (7.20.0 — un test interdit désormais la forme), et un second vert
  « Répondre » dans le bandeau d'une pièce qui avait déjà « Enregistrer un paiement » (U-11).
- Piège de test : un marqueur nommé `danger: true` hors d'un menu a fait tomber le test « le geste qui
  détruit vit en bas de son menu » — il lit la forme. Le drapeau d'un verdict s'appelle `alerte`.
- **Le curseur entre dans la fenêtre, et une question de sécurité le met sur « Annuler ».** Mesuré à
  la souris, pas déduit : `modal()` de l'app entreprise ne donnait le curseur qu'à un CHAMP, donc une
  question sans champ le laissait sur le bouton de la PAGE qui l'avait ouverte, derrière la fenêtre —
  et Entrée re-cliquait ce bouton (le sélecteur de fichier se rouvrait par-dessus la question
  d'import). Le Cabinet faisait juste depuis la 10.12.0 (premier champ, sinon bouton principal) :
  le jumeau manquant (7.3.0), porté. Mais donner le curseur au bouton principal fait qu'Entrée
  ACCEPTE — y compris « J'ai vérifié avec mon comptable : accepter », la clé d'un imposteur acceptée
  par réflexe. `confirmDialog(…, { prudent: true })` pose le curseur sur « Annuler » dans son
  montage, et `modal()` ne reprend pas un curseur qu'un appelant a déjà posé dans la fenêtre.
- **Une preuve qui reste verte dit que le TEST ne voit pas, pas que le code est juste.** Ma première
  version du parcours `e2e:cloture` tapait Entrée puis vérifiait « rien n'a changé » : elle passait
  avec le défaut remis, parce qu'accepter la clé n'importe rien tout de suite (une seconde question
  suit) et qu'un Entrée qui rouvre l'import ne change rien non plus. C'est la règle 10.9.1, re-trouvée :
  le parcours exige maintenant qu'aucune fenêtre ne reste ouverte. Et c'est en cherchant POURQUOI la
  preuve restait verte qu'on a trouvé le vrai défaut, plus large que celui qu'on corrigeait.
- **Une page de release restée VIDE porte le tag du run qui l'a créée.** Le premier run de cette
  bêta a été annulé pour y ajouter le correctif du curseur ; il avait déjà créé la page, tag posé
  sur son commit. Le suivant la reprenait par `gh release edit` (la règle 9.8.1 : une reprise ne
  détruit rien) — donc les installateurs du nouveau commit sous le tag de l'ancien. Une page sans
  AUCUN fichier n'a rien à perdre : le job `preparer` la supprime avec son tag (`--cleanup-tag`) et
  la recrée sur `$GITHUB_SHA`. Une page qui porte des fichiers reste reprise telle quelle.
- **Un raccourci vise un PANNEAU (7.18.0), et une cible asynchrone se pose après le chargement.**
  « Lire la réponse » ouvrait la Révision en haut, la réponse trois panneaux plus bas. Poser
  `pageFocus` avant la navigation ne suffisait pas : `focaliser` le consomme au premier dessin, qui
  est l'écran « Lecture du dossier de révision… » — la cible n'existe pas encore. Le raccourci pose
  `livresState.revViser`, et `brancherRevision` le convertit en `pageFocus` une fois la révision LUE.
- **Le jeu d'exemple se refait à la montée de version (9.4.2)** : relancer l'app entreprise après le
  numéro 10.13.0-beta.1 a effacé les paquets et les questions posés à la main dans l'exemple. Ce
  n'est pas un défaut — c'est la règle —, mais un test humain sur l'exemple se prépare APRÈS le
  changement de version, pas avant.

### 10.14.0 — La visite guidée, et un premier jour qui commence par découvrir

Skander : « quelqu'un qui découvre l'application n'a pas envie de lire la page Aide : il faut
pouvoir toujours le guider, pour chaque étape, et couvrir toute l'app », puis « si on tombe sur un
formulaire au début, on a tendance à passer et revenir plus tard ». Deux modules neufs, chargés par
l'app entreprise : **`src/renderer/visite.js`** (le MOTEUR : projecteur, bulle, étapes « regarder »,
« faire » et « liste », chapitres, attente d'un geste, clavier, couches, fin célébrée — global
`Visite`) et **`src/renderer/visites.js`** (le CONTENU : trente-deux visites de page, la découverte
en douze chapitres, les parcours « faire », les visites techniques, et le dictionnaire qui explique
chaque bouton — `SkanVisites.expliquer`). Le Cabinet n'a pas encore les siennes (`A-FAIRE.md` § 4 bis).
Publiée en **bêta** : l'exemple de cinq ans a fait tomber une règle du moteur comptable.

Règles apprises, à ne pas recasser :

- **Un formulaire au premier écran se saute ; une porte s'ouvre.** Six écrans de questions avant
  d'avoir vu le produit, c'était six écrans qu'on passait pour « revenir plus tard » — et on ne
  revenait pas. Le premier écran est une PORTE à deux battants (« Découvrir avec un exemple », le
  seul vert ; « Commencer avec mon entreprise »), vue une fois (`porteVue`, que « Passer » pose
  aussi, et qu'une reprise ne rouvre jamais) ; l'assistant garde trois questions ; le RIB et la
  copie de sécurité se demandent dans « Tes premiers pas », au moment où ils protègent quelque
  chose — la copie juste APRÈS le premier devis : avant, elle protégeait un fichier vide.
- **Après la découverte, l'assistant reprend là où la porte l'a laissé** (`reprendreAssistant`, au
  démarrage ET à la sortie de l'exemple), posé à quelqu'un qui sait maintenant à quoi servent les
  questions. Et une entreprise encore vide ne se voit plus promettre « tes données sont revenues »
  (`demoSortie` lit la sauvegarde `vide`) — une phrase rassurante se vérifie sur un univers non
  vide (7.0.0).
- **Une étape FACULTATIVE ne passe jamais devant une étape du métier.** La découverte et « Relier ton
  comptable » sont marquées `facultatif` : elles comptent (« 1 sur n » dès la découverte faite),
  mais `suivante` les saute et elles ne retiennent pas le panneau — un panneau qui ne disparaîtrait
  jamais parce qu'on n'a pas de comptable est celui qu'on apprend à ne plus lire.
- **Entrée ne choisit pas sur une porte** : c'est un choix, pas un formulaire, et Entrée cliquait
  « Continuer ».
- **La découverte se fait sur l'EXEMPLE, « Démarrer » dans la VRAIE entreprise**, et UNE porte
  décide qu'une visite ne peut pas se lancer (`manque`). Une visite qui attend un préalable propose
  la PREMIÈRE qu'on peut vraiment faire (« D'abord : faire un devis »), jamais un bouton éteint qui
  renvoie à un autre bouton éteint.
- **Une explication FAUSSE est pire qu'une explication absente.** `data-open` porte trois gestes (une
  entreprise, un module, un fichier joint) : sans la page, la bulle d'un fichier joint disait
  « Ouvre cette entreprise ». `expliquer` reçoit la route, et un attribut ambigu ne s'explique que
  sur une page connue. L'instrument de couverture compte les explications ABSENTES ; aucun ne voit
  les fausses — c'est un test qui les tient.
- **Le compte des chapitres n'est écrit nulle part** : il se lit sur les étapes. Écrit à la main, il
  mentirait au premier chapitre ajouté (le « quatre écrans » au-dessus de cinq pastilles, 9.4.2).
- **La bulle ne couvre jamais sa cible quand un côté a la place, et ne sort jamais de l'écran**
  (`placerBulle`, pure, jouée sur deux cents cibles) ; une zone plus haute que l'écran montre son
  HAUT au lieu de reléguer la bulle dans un coin ; et le curseur va au bouton qui AVANCE — un
  sélecteur de focus désigne UN élément : « Terminer » et la croix portaient le même geste, et le
  premier trouvé était la croix.
- **Chaque classe que pose le moteur existe dans la feuille** (6.8.0, appliquée à un moteur entier :
  la bulle en est faite), et **chaque visite porte une couleur que la feuille connaît en clair ET en
  sombre**. Le bandeau de l'exemple, lilas, était repeint en orange par `.banner` — une classe
  contre une classe, écrite 650 lignes plus bas : la règle générale qui avale l'exception (7.23.0)
  sous sa forme la plus simple, à spécificité égale la plus BASSE gagne ; seule une capture l'a
  montré, et la règle du bandeau porte désormais deux classes.
- **« Tes réussites » et la carte de l'essai se lisent sur les DONNÉES**, jamais sur l'exemple, ne
  comptent que ce qui existe, et ne promettent que ce que le code tient : licence ou pas, tes données
  restent à toi (6.4.0). Une page qui veut faire acheter une licence est celle où un chiffre inventé
  coûte le plus cher.
- **Un exemple plein trouve ce qu'un exemple d'un an ne peut pas voir.** Cinq ans d'activité ont fait
  tomber trois défauts : une facture de décembre réglée en janvier gardait son règlement sans sa
  facture dans les à-nouveaux (les deux applications) ; la balance auxiliaire comptait chaque client
  une fois par exercice traversé ; et la palette coupait ses douze résultats AVANT de les classer.
- **On classe AVANT de couper** (`C.classerRecherche`) : « audit » rendait deux cents factures et
  jamais la prestation du même nom. Le rang se juge sur le NOM de ce qu'on ouvre (commence par, mots
  qui commencent, contient — accents et écritures compris, `\p{L}\p{N}`), le tri est stable, les
  pièces sont plafonnées à six en tête (les autres passent derrière, jamais retirées), et la palette
  DIT quand elle ne montre qu'un extrait (« 12 résultats sur 214 », 9.4.7).
- **Un avertissement se lit AVANT le geste, y compris celui de la clôture** (9.4.2). Sur cinq ans,
  la plupart des pièces sont dans un mois clôturé : on modifiait un devis de 2022, « Enregistrer »
  répondait par la fenêtre de clôture, et la saisie était perdue. `const figee = locked || clos` :
  une pièce d'un mois clôturé s'ouvre fermée comme une émise, avec son bandeau (`#clos-banner`) et
  ses deux sorties — « Refaire à la date d'aujourd'hui » (`duplicateDoc`) et « Voir les clôtures ».
  La règle de clôture ne change PAS (6.0.0 : un devis daté d'un mois clos y est aussi) : c'est
  l'écran qui la disait trop tard. L'affaire se pose toujours (10.12.0) : elle ne change aucun
  chiffre.
- **Un parcours qui prend « le premier venu » change de cible quand les données grandissent.** Sur
  l'exemple de cinq ans, `e2e:entreprise` ouvrait un devis de 2022 (clôturé), un contrat déjà signé
  (l'étape passait sur n'importe quel message, sans rien vérifier), comptait les lignes d'une liste
  paginée (7.15.0 : c'est le bandeau « n sur N » qui porte la sélection), et posait une absence au
  30 mars, clôturé. Il choisit désormais par ce qui DISCRIMINE (un mois ouvert, un contrat en
  attente), lit le bandeau, vérifie ce que le geste a ENREGISTRÉ — et dit, quand il tombe, l'écran
  et la fenêtre ouverts, avec une capture (`dist-e2e/entreprise/echec.png`) : Node n'imprimait que
  `e.stack`.
- **Jamais une preuve qui modifie la source pendant qu'un e2e tourne** : le parcours relit les
  fichiers à chaque lancement de l'application, et une preuve qui restaure un fichier au milieu lui
  fait juger un défaut qui n'existe pas — ou pas celui qu'on croit.
- **Une preuve qui tombe sur le JUMEAU de son test ne prouve pas le sien** (10.12.0, re-rencontrée
  deux fois) : la règle de la porte est tenue dans `qa-entreprise.js` ET dans `visites.js`, celle de
  l'étape suivante deux fois dans `visites.js` — chaque preuve neutralise l'autre le temps de voir
  tomber la sienne.
- **Sept assertions de plus retournées vers la règle** : elles recopiaient `plie(x).includes(w)`,
  `...aidesPour(words)` et `!locked` ; la règle élargie (`figee`, le classement) les a fait tomber
  sur du code juste.

L'instrument neuf est `npm run e2e:couverture` : il refait le parcours de `e2e:entreprise-rendu` et,
pour chaque contrôle visible, demande l'explication que la bulle lira. Un contrôle sans explication
disparaîtrait de la visite sans un mot ; il fait TOMBER le parcours.

**Puis les visites jouées à la souris** (le comptable, le justificatif, la découverte), et ce qu'aucun
test de contenu ne pouvait voir :

- **Une visite de la vraie entreprise ne se lance pas sur l'exemple** (`reel: true`) : elle rend
  d'abord les données (`demoSortie`), et son bouton le DIT (`libelleVisite` : « Quitter l'exemple et
  commencer », « Charger l'exemple et commencer ») — un bouton qui cache un changement de données
  surprend, et une surprise dans une visite fait arrêter la visite.
- **Un clic n'est pas un geste fait.** Le moteur passait à l'étape suivante dès le clic ; un choix de
  fichier annulé, un « Enregistrer » refusé (un champ manque, la fenêtre reste ouverte) avançaient
  quand même, et l'étape d'après décrivait une liste vide. Quand l'étape dit ce qui prouve le geste
  (`fait`), CETTE preuve décide ; le clic ne suffit que là où rien d'autre ne prouve. Un geste qui
  peut s'annuler porte sa preuve (un test le compte) — et la preuve d'un geste qui AJOUTE se mesure
  contre l'état d'entrée (`paquetsAvant`), sinon un paquet d'hier la rend vraie d'avance.
- **Une fenêtre est l'endroit où l'on relit** : la bulle d'une cible dans une fenêtre se pose À CÔTÉ
  de la fenêtre, à la hauteur de la cible (`placerPres`) ; « Enregistrer ta réponse », posée au-dessus
  du bouton, couvrait la réponse qu'on venait de taper. Sans place à côté, la règle ordinaire.
- **Une zone large et haute se fait défiler pour laisser sa place à la bulle** (`hautPourBulle`)
  plutôt que de la rabattre dans un coin — sur le bouton même dont elle parlait. Et **avec du JEU** :
  la page défile au pixel entier, les rectangles tombent au quart de pixel ; viser la limite exacte
  laissait la bulle à 0,28 px de sa place, et elle retournait dans le coin. Le test prend des mesures
  RÉELLES et rejoue l'arrondi du défilement : un nombre rond ne l'aurait jamais montré (9.6.1).
- **Un onglet ne se clique pas avant que sa page existe** : `vers()` dessine au `hashchange`,
  asynchrone ; `ouvrirOnglet` attend la barre d'onglets au lieu de cliquer dans le vide.
- **Un défilement s'arrête sous la marge où collent les en-têtes** : `table.list thead th` colle à
  `top: 0`, c'est-à-dire sous la marge haute de `main` (32 px) ; un tableau posé au ras du bord avait
  sa première ligne sous l'en-tête. `scroll-padding-block-start: var(--main-haut)` — et c'est la
  règle de TOUS les défilements des deux applications, raccourcis vers un panneau compris.
- **Une étape qui parle de LA liste éclaire la liste** : sur la page des achats, `#view table.list`
  désignait le tableau « À payer », le premier de la page ; « Le trombone » parlait du 📎 au-dessus
  d'un tableau qui n'en a aucun. On vise `#list-wrap`.
- **Ce qu'une visite cite « entre guillemets » existe dans l'application** — un test le lit dans
  tous les textes des visites et des tables d'explications : « Chapitre suivant » quand le moteur
  écrit « Passer au chapitre suivant », « Faire mon premier devis », une visite qui n'existe pas, et
  « le bouton vert te dit lequel » là où le vert était ailleurs (U-11 : le vert suit l'étape
  suivante, une phrase ne peut pas le promettre). Les libellés FABRIQUÉS (« Refaire le paquet avec ta
  réponse ») figurent dans une liste d'exceptions avec la ligne de code qui les fabrique — une liste
  d'exceptions qui ne se vérifie pas finit par mentir à son tour.
- **La typographie vaut dans la bulle** : `typographier` pose l'espace fine insécable des
  guillemets et de la ponctuation double sur les nœuds de texte (règle `typographie()` du Cabinet,
  9.4.2) ; « « » restait seul en fin de ligne, « Dossier » sur la suivante.
- **Une catégorie de la palette tient en un mot** : « Me guider » passait sur deux lignes et
  « Contrat de prestation » sur trois dans une colonne de 64 px — que « Prestation » dépassait déjà
  de 9 px sans que rien ne le dise. `KIND_PIECE` nomme les pièces d'un mot, la colonne fait 78 px
  (mesuré), sans retour à la ligne.
- **Le piège de l'environnement, à ne pas prendre pour un défaut** : dans le sélecteur de fichier GTK
  sous Xvfb, taper un chemin puis Entrée ANNULE ; il faut cliquer « Open ». Constaté avant d'accuser
  l'application : la copie n'existait pas sur le disque, et la même manœuvre avec « Open » joint le
  fichier.

- **Un texte tapé AILLEURS se typographie à l'AFFICHAGE, jamais dans la donnée.** La question du
  comptable, tapée dans le Cabinet avec une espace ordinaire, laissait son « ? » seul en début de
  ligne dans le bandeau d'une pièce. `C.typoFr` (jumeau de `typo` dans `visite.js`, corps comparés
  par un test) s'applique aux quatre endroits qui la MONTRENT, pas à la zone de texte où l'on répond —
  sinon elle réécrirait ce qu'on tape. Le portage complet de `typographie()` à la prose de l'app
  entreprise est venu ensuite (P4, plus bas).
- Piège d'outil, **deuxième fois** (9.2.1) : l'outil d'édition écrit `\u202f` en caractère RÉEL. Le
  fichier reste juste, mais une ancre de preuve écrite avec l'échappement ne trouve plus rien. On
  vérifie les octets après chaque édition, et on garde l'échappement.
- Piège de méthode : un redémarrage du poste de travail a tué une preuve en cours et laissé le
  DÉFAUT dans `app.js`, avec sa copie `.preuve-bak` à côté. Après toute interruption, chercher les
  `.preuve-bak` et comparer avant de conclure quoi que ce soit.

**Puis le Cabinet, sur le même moteur** (Skander : « fais ce qu'on vient de faire sur l'app cabinet, et
le même système : la démo avant l'écran de démarrage »). Contenu : `src/cabinet/renderer/cabvisites.js`
(global `CabVisites`), branché dans `app.js` (`installerVisites`, `lancerVisite`, `drawGuide`, la porte
de `runSetup`) ; `K.premiersPas(state, ctx)` dans cabcore ; tests `test/suites/cabvisites.js` ;
instrument `npm run e2e:cabinet-couverture` (le parcours de `e2e:cabinet-rendu` en mode `--couverture`).

- **Un algorithme partagé vit dans le MOTEUR, les applications n'apportent que leurs tables.** Ce qui
  dit ce que fait un bouton (phrase d'une ligne de menu, dictionnaire, onglets, bulle du champ,
  familles de champs) était écrit dans `visites.js` : le Cabinet l'aurait recopié, et deux copies
  divergent (7.29.0). Il est sorti dans `Visite.expliqueur(tables)` / `Visite.zoneur(ZONES)` ; un test
  interdit un second `function expliquer(` dans l'un ou l'autre contenu.
- **La porte se pose APRÈS le mot de passe, jamais avant** : l'état du Cabinet est chiffré, il n'existe
  pas de cabinet sans lui. Elle remplace l'écran « Bienvenue », ne se voit qu'une fois (les DEUX
  battants la marquent vue), et la reprise (`runSetup({ sansPorte: true })`) passe à la sortie de
  l'exemple et au démarrage d'un cabinet encore sans nom.
- **« Tes premiers pas » ne repoussent pas le portefeuille** (9.4.4) : le panneau complet n'occupe que
  la page Dossiers VIDE, où il est le corps de l'écran ; dès qu'il y a des dossiers, il devient UNE
  ligne de « À faire » dont le bouton lance la visite de l'étape suivante. L'exemple ne compte ni
  comme un client ni comme un premier paquet ; « ne pas savoir » la clé de secours n'est pas « non ».
- **Un geste qu'on veut cocher doit laisser une trace** : l'export du fichier d'appairage n'était
  écrit nulle part — l'étape n'aurait jamais pu se cocher. `cab:exportPairing` retient
  `pairingExportedAt` et rend l'état, que l'écran reprend (7.1.x).
- **Un test neuf trouve d'abord ce que le contenu a laissé derrière lui** : le dictionnaire expliquait
  `#pp-decouvrir` et `#pp-plus-tard`, deux boutons d'un premier jet abandonné — le test « chaque entrée
  désigne un contrôle qui existe » les a nommés à sa première exécution.
- **Un instrument de couverture ne recopie pas son parcours** : `e2e:cabinet-couverture` est
  `cabinet-rendu.js --couverture` (une passe, la sonde des explications sur la page, la fenêtre du
  dessus et un menu de ligne de chaque sorte, les fenêtres ouvertes par leurs vrais boutons) — un
  second parcours des mêmes écrans aurait dérivé du premier. Et `cabinet-rendu` mesure désormais
  « Me guider » comme les autres pages.
- **Cinq parcours e2e nommaient l'ancien assistant écran par écran** (`#w-rec`, `#w-pair`) :
  retournés vers la règle (la porte, le nom, les clients, puis « Tes premiers pas ») ; ceux qui
  traversaient l'assistant par « Passer sinon Suivant » ont tenu seuls — un parcours reconnaît un
  écran à ce qu'il CONTIENT (7.28.0).

**Puis la découverte du Cabinet jouée à la souris** — sept constats qu'aucun test ne voyait :

- **Un filet se réclame quand il protège quelque chose de RÉEL** : la clé de secours criait en rouge
  dès le chargement de l'exemple, pour des paquets fictifs (`paquetsReelsRecus`). Une alerte fausse le
  premier jour apprend à ignorer la seule qui compte.
- **Un raccourci clavier se lit au niveau du DOCUMENT, et une seule fois** : les flèches de la bulle
  mouraient dès qu'on cliquait dans la page ; écoutées aussi sur le document, elles avançaient de deux
  étapes (la bulle ET le document). `defaultPrevented` départage — c'est le motif du Cmd+K qui
  traversait deux couches (6.8.1).
- **Ce qu'on amène à l'écran s'arrête sous ce qui colle** (le jumeau de la marge de `main`) : la
  barre des onglets de la comptabilité est collante ; sa hauteur est MESURÉE (`--c-nav-h`, un
  `ResizeObserver`) et devient le `scroll-padding` — une valeur écrite à la main aurait menti dès que
  la barre passe sur deux rangées.
- **Un bouton vert se décide sur le calendrier** (U-11) : « Clôturer l'exercice » était l'étape
  suivante au milieu de l'année. `exerciceTermine` ; et la question avertit quand on clôture un
  exercice en cours.
- **Une bulle qui ne peut pas longer un grand panneau le découpe** (`hautPourCouper`,
  `decouperHaut`) au lieu de le couvrir : on éclaire le haut de la zone, et la bulle se pose dessous.
- Une bulle citait une colonne que l'écran masquait (colonnes vides masquées, 9.4.4) : un texte de
  visite parle de ce que l'écran MONTRE.

**Puis la parité des parcours** (Skander : « il manque encore beaucoup de parcours, et beaucoup de guides
— ce que j'ai dit pour l'app entreprise, fais pareil pour le Cabinet ; même l'alerte du jeu d'exemple
doit devenir comme celle de l'app entreprise ») :

- **Une couverture se prend par ÉCRAN, pas par nombre de visites.** 21 → 49 gestes guidés ; le test
  qui compte n'est pas le total mais « chaque écran de travail a au moins un parcours où l'on FAIT »
  (l'Aide, « Me guider » et l'aiguillage de la comptabilité nommés en exception). C'est lui qui a dit
  qu'il manquait le grand livre, la balance, la production et les paquets d'un client — un compte
  « au moins N » les aurait laissés passer (7.33.0, 10.12.0).
- **Un parcours « faire » qui ne fait rien jouer est une page qui se déguise.** Dix-sept parcours de
  ce type n'avaient AUCUN geste. Ceux dont le geste est sûr sur l'exemple en ont reçu un (ouvrir un
  menu, une fenêtre qu'on referme, une carte de thème) ; les autres portent `sansGeste` avec leur
  raison (clôturer, valider, composer un mail ne se jouent pas « pour voir ») — une exception
  anonyme est un trou, et une exception sur un parcours qui a son geste est un mensonge : le test
  refuse les deux.
- **Le clic d'un geste vise la cible, pas son premier exemplaire** (`viseLaCible`, moteur partagé) :
  « Clique sur la ligne d'un client » éclaire la première ligne, et un clic sur la sixième était
  ignoré ; la page changeait, la cible disparaissait, et la bulle annonçait « On s'est perdus de vue »
  sur un geste parfaitement fait. Et un clic qui vient d'avoir lieu n'est jamais « perdu » : la page
  qu'il ouvre fait disparaître la cible. Aucun test ne pouvait le voir — un parcours clique la
  première ligne ; un humain clique celle qui l'intéresse.
- **Le dernier geste qui OUVRE quelque chose a son étape** : un menu ouvert en dernier était recouvert
  par la carte de fin. On montre ce qu'on vient d'ouvrir, puis on termine. Et une bulle ne promet pas
  « Échap referme le menu » — Échap met la VISITE en pause.
- **Un libellé qui dit l'état d'un AUTRE objet se trompe de sujet** : le menu d'un paquet choisissait
  « Voir ses écritures » / « Créer le livre » sur le livre gardé en mémoire — absent après un
  redémarrage, ou celui d'un autre client. Il lit l'index de CE dossier (`aUnLivre`), sans déchiffrer.
- **Le jumeau manquant, encore** (7.3.0) : l'écran du mot de passe du Cabinet ne posait pas le
  curseur dans le champ ; l'app entreprise le faisait depuis toujours. La frappe partait dans le vide.
- **Le bandeau de l'exemple est UN composant** (`.demo-banner` de la feuille partagée), posé par le
  routeur après CHAQUE page et reposé par un `MutationObserver` quand une page asynchrone réécrit
  `#view` — sinon une fiche qui lit son livre le perdait. Un test confronte sa forme à celle de l'app
  entreprise : deux bandeaux pour un même exemple divergeraient.
- **Piège de l'outil humain** : `ecran.sh` lit `SKANFACT_ECRAN`, pas `DISPLAY` ; l'état du shell ne
  survit pas d'un appel à l'autre, donc un `export` fait une fois envoyait les clics sur un AUTRE
  écran (capture noire). Un petit enveloppant qui pose la variable à chaque appel l'évite.

**Puis chaque étape de chaque visite, jouée par un robot** (`e2e:cabinet-visites`, `e2e:visites`, le
harnais commun `test/e2e/jouer-visites.js`) — et ce qu'il a trouvé que la souris n'avait pas vu :

- **Une cible réduite à `[data-rowmenu]` désigne le premier menu de la page, pas celui de la ligne.**
  « Ouvre le menu d'une pièce » tombait sur le menu de l'en-tête de la fiche (9.4.8), qui n'a qu'une
  action — « Imprimer » —, donc un bouton nommé (7.29.0) : la visite de la contre-passation ouvrait la
  boîte d'impression du système, et le parcours restait bloqué pour toujours sous elle. La même
  faute vivait dans deux visites de l'app entreprise. Une étape vise `#view table.list [data-rowmenu]`,
  et un test interdit la forme nue dans les deux fichiers de visites.
- **Un instrument qui joue des gestes remplace ce qui bloque, puis le NOMME** : `window.print` devient
  un compteur, et un geste qui imprime sans que son étape parle d'imprimer est une faute — c'est ainsi
  que le défaut ci-dessus s'est dit, au lieu d'un parcours figé sans un mot.
- **Un handler dont l'écran fait `S = await api.x()` rend l'ÉTAT, jamais `{ ok, state }`.** Après
  « Enregistrer ma méthode » (révision), plus aucune page du Cabinet ne s'ouvrait : l'écran faisait de
  `{ ok, state }` tout son état, sans `cabinet`, et le rendu suivant tombait sur `S.cabinet.name` —
  la barre latérale s'allumait sur la page demandée pendant que la vue restait sur les Réglages. Le
  modèle de liasse avait le même défaut depuis la 10.0.0. Deux conventions de retour dans le même
  fichier finissent par se croiser ; un test lit chaque `S = await api.x(` de l'écran, retrouve son
  handler par le préchargement, et exige `save()` ou `safeState()`.
- **Un parcours qui tombe sur « délai dépassé » sans dire où il était ne se répare pas.**
  `amenerGuide` ramène « Me guider » quoi que la visite précédente ait laissé (une fenêtre, une
  question de sortie, l'écran de verrouillage), trois essais, puis part en erreur avec l'adresse, la
  fenêtre du dessus, la vue et une capture — et le nom de la visite qui a précédé. C'est ce message
  (« hash #/guide, h1 Réglages ») qui a désigné le défaut du handler en une minute, là où « Timeout
  8000ms » ne disait rien. Et `VISITES_DEPUIS=<id>` reprend à une visite, pour réparer sans rejouer
  les soixante autres.
- **Les deux instruments sont REPORTÉS** (Skander, 24/09 : « on laissera le E2E des deux app pour plus
  tard ») : ce qui reste à faire tourner est écrit dans `A-FAIRE.md` § 4 bis.

**Et ce que le test à la souris du correctif a trouvé, dans un cabinet tout neuf** (la règle du
24/09 : le lot qu'on vient d'écrire se refait à la main — et il trouve toujours autre chose) :

- **Dans un dictionnaire d'explications, l'entrée écrite pour CE bouton passe avant une famille.** Le
  moteur prenait la première entrée qui répond, dans l'ordre du fichier : `.modal-actions .btn-primary`
  (« Valide ce que tu viens de saisir dans la fenêtre »), écrit plus haut, masquait `#imp` — et
  « Importer un paquet… », posé dans l'état vide d'une PAGE, se disait « valide la fenêtre ». Dans
  l'app entreprise, trois entrées précises de la comptabilité étaient masquées par leurs anciennes
  sœurs groupées. `expliqueur` essaie désormais les identifiants d'abord ; et une famille qui parle
  de « la fenêtre » ne vise que `.modal` — une barre `.modal-actions` sert aussi aux états vides des
  pages. **L'ordre d'un fichier n'est pas une priorité** : une règle de préséance se pose dans le
  moteur, pas dans l'ordre où l'on a écrit les lignes.
- **Un libellé séparé de son nombre ne passe pas par `pl()`, et s'oublie** : la carte « 1 clients
  suivis » — le chiffre dans un `<b>`, le mot à côté. Le test ÉVALUE la carte (vm) avec un, zéro et
  plusieurs.
- **« Aucun client » n'est pas « aucune échéance »** : un client hors SkanFact sans livre n'a rien à
  déclarer ici, et la page le disait inexistant. Un état vide dit SA raison (E-06), au singulier comme
  au pluriel, avec le geste qui le remplit. Et l'état vide vit dans sa propre fonction : le test 9.4.6
  borne la taille de `drawEcheances`, et c'est la fonction qu'on sort, pas la borne qu'on relève.

**Puis l'assistant de démarrage, jusqu'au bout** (Skander : « on va passer à l'assistant de démarrage
complet » — sept lots, 213a → 213g, `test/suites/assistant.js`) : la numérotation qui continue, la porte
qui prend une clé ou un dossier partagé, le compte depuis le RIB, le mot de passe avec la copie, la
messagerie au premier envoi, l'import depuis un tableur, et « Ta facture à ton image ».

- **Un numéro qu'on n'a pas encore pris se LIT, il ne se réserve pas.** L'aperçu de la prochaine
  facture et la question « Je facturais déjà » lisent `etatNumerotation` (qui passe par la même règle
  que `nextNumber`) ; `nextNumber` écrit les compteurs, et l'appeler pour MONTRER un numéro en
  consommerait un (6.0.0). Et une série de factures déjà numérotée ici ne se règle plus : une série
  légale reste continue.
- **Un second chemin vers un geste irréversible porte la même garde** : « Exporter en PDF » un
  brouillon de facture l'ÉMET — il passait sans le récapitulatif, donc sans les avertissements (RIB,
  société incomplète, date antérieure). Le jumeau manquant (7.3.0), dans le même écran.
- **Un refus écrit n'est pas une panne** (9.4.10, re-trouvé) : quinze refus de clé de licence
  s'inscrivaient au journal comme des pannes, à chaque clé mal collée. Ils passent par `erreur()`.
- **Une copie en clair sur une clé USB est la comptabilité entière** : choisir une copie externe
  propose aussitôt le mot de passe. Et **une sauvegarde rechiffrée garde sa date** (elle prenait l'heure
  du rechiffrement) — mais alors sa copie externe, de même taille et de même date, est jugée à jour
  (7.30.0) et garde l'ANCIENNE clé : après un rechiffrement, elle se recopie de force.
- **Une clause d'un modèle se décide sur le MODÈLE, jamais sur le texte rempli** : « concernant : . »
  partait dans un mail quand l'objet était vide.
- **Un import montre ce qui entre AVANT d'écrire, complète sans écraser, et nomme chaque refus** — la
  ligne et ce qui y est écrit. Un fichier se lit dans SON encodage (Windows-1252 d'Excel, UTF-8,
  UTF-16), et **une erreur de fenêtre se rattrape au lieu de se refuser** : un tarif collé chez les
  clients (« 7 nouveaux clients », dont un nommé « Désignation ») se reconnaît et s'emmène dans le bon
  import. Un client et un article naissent d'UN modèle (`clientVierge`, `articleVierge`) — la fiche,
  la création à la volée et l'import.
- **Un contraste se CALCULE (WCAG), il ne se juge pas à l'œil, et son seuil suit le RÔLE** :
  `primaryColor` colore TOUT le texte d'une pièce (4,5), `accentColor` le numéro, les titres et « Net à
  payer » (3). On prévient, on n'interdit pas ; et les pastilles proposées passent toutes — sinon la
  proposition ferait le défaut qu'elle évite. Le test tient les valeurs de référence calculées à la
  main (noir 21, blanc 1, gris #777 4,48 : c'est lui qui attrape une luminance non linéarisée).
- **Une remarque qui dépend d'une valeur vit dans la ligne de son TITRE** (H-E1, dans une fenêtre) :
  posée sous les choix, « trop claire » poussait « Enregistrer » de 41 px au moment où on le visait. Le
  mot court tient en une ligne (`court`, borné par le test), la phrase entière est dans son `title`. Et
  **une zone qui reçoit une image a une hauteur fixe** : elle grandissait de 6 px au premier logo.
  Même famille, un écran plus tôt : la légende « * obligatoire » ajoutée SOUS le formulaire de « Ton
  entreprise » faisait défiler son corps pour 7 px à 1440×900 — elle vit dans le pied, comme dans une
  fenêtre (`modal()` la pose dans `.modal-actions`). Une légende suit le mécanisme qu'elle imite jusqu'à
  sa PLACE, pas seulement jusqu'à son texte.
- **Un réglage a UNE porte** : les Paramètres MONTRENT l'image de marque (logo, cachet, deux pastilles)
  et la changent par un seul bouton, la fenêtre qui la montre sur la prochaine facture. Deux façons de
  modifier la même chose divergent : « Voir sur une facture… » enregistrait d'abord une couleur qu'on
  n'avait pas encore vue. Le test exige l'ABSENCE des anciens champs, pas seulement la présence du neuf.
- **Un aperçu ne prend pas de numéro et ne porte pas le tampon BROUILLON** : il montre la pièce telle
  qu'elle partira (`status: 'envoyée'` sur une COPIE, `etatNumerotation(…).prochaine`), et il passe par
  `stampFor` comme tout document (7.13.0) — sinon le tampon de l'exemple lui échapperait.
- **Une saisie qui ne vit pas dans des champs se garde par une FONCTION** : `modal(…, { garde: () =>
  change() })` remplace la garde des champs (un logo choisi, une pastille cliquée n'ont pas de
  `value`) ; et **la question d'abandon dit ce qui se perd** (`perte`) — « ce que tu viens de taper »
  était faux pour un logo.
- **Une pastille sans contour disparaît sur un fond de sa couleur** : l'Ardoise était invisible en
  thème sombre. Les pastilles ont leur anneau sombre ; les images restent sur papier blanc, parce que
  c'est ainsi qu'elles s'impriment.
- **Chaque champ qu'on remplit le premier jour porte sa bulle** : la fiche client en avait quatre sur
  onze, la fiche société n'en avait pas pour le téléphone, l'email et le site. Chaque bulle dit ce que
  le CODE fait du champ (le téléphone de la société s'imprime sur les pièces et le relevé, pas sur le
  bulletin ; l'email d'un fournisseur ne s'imprime nulle part ; SkanFact n'envoie rien depuis l'adresse
  de la société) — une bulle fausse est pire qu'une bulle absente (10.14.0). Un test lit les quatre
  formulaires du premier jour ; les autres champs nus de l'application sont notés dans `A-FAIRE.md`.
- **Trois tests que la preuve a rendus plus forts** : « le résumé signale une couleur illisible »
  cherchait la classe `mq-note`, qui vivait aussi dans une fonction jamais appelée par le gabarit — le
  résumé est désormais JOUÉ (vm) avec une couleur pâle et une couleur d'origine ; « la fenêtre n'écrit
  la fiche société qu'à l'enregistrement » ne comptait que les crochets et laissait passer
  `data.company.name = …` ; et la fin de la tranche de la fenêtre était ancrée sur la garde — retirer la
  garde faisait tomber « tranche inattendue » au lieu de « jette sans demander ».

**Puis l'assistant du Cabinet, jusqu'au bout** (le jumeau de celui de l'entreprise, 213a → 213g) : le
fichier d'appairage qui part chez les clients, l'équipe et la grille de saisie dans « Tes premiers
pas ». Ce que le lot et son test à la souris ont appris :

- **Enregistrer un fichier n'est pas l'envoyer** (10.13.0, vu de l'autre côté) : un fichier qui doit
  partir chez quelqu'un part avec son MESSAGE. « Remettre le fichier à mes clients… » l'enregistre
  puis compose le mail (`K.mailAppairage`, pur) : qui le reçoit, ce qu'il faut faire, où cliquer dans
  l'autre application — un chemin confronté aux onglets et panneaux RÉELS de SkanFact (10.9.2) —,
  l'empreinte à vérifier. Et la fenêtre dit ce qui est VRAIMENT parti : un lien de messagerie ne joint
  pas de fichier.
- **Un lien `mailto` a une longueur, et Windows le coupe sans une erreur** (~2 000 caractères). Le
  pont compose le lien par le moteur (`K.mailtoUrl`), jamais à la main ; au-delà, les adresses vont
  au presse-papiers et l'écran dit de les coller dans « Cci ». Soixante clients en copie cachée ne
  sont pas un cas limite, c'est le cas normal d'un cabinet.
- **Deux comptes qui se ressemblent ne disent pas la même chose** : les CLIENTS joignables (ce qu'on
  annonce avant) et les ADRESSES (ce qui part) — deux dossiers d'un même groupe partagent une boîte.
  Le jeu du test discrimine (une boîte partagée, une adresse en majuscules avec une espace, une
  fausse, l'exemple, un archivé), sinon il ne prouverait rien des comptes (10.0.0).
- **Une étape facultative se coche sur un GESTE** : les réglages de la grille existent dès le premier
  jour (`migrate` les remplit), leur présence ne prouve rien — l'enregistrement pose `regleLe`. Et
  l'équipe compte les collaborateurs ACTIFS : un retiré n'a pas « déclaré l'équipe ».
- **Une phrase partagée prend le chemin de l'application qui l'affiche.** La pastille de licence vit
  dans `licence.js` (jumelle de `core.pastilleLicence`, corps comparés) : elle disait au comptable
  « Paramètres → L'application → Licence », le chemin de SkanFact. Elle reçoit le sien, et un test
  confronte chacun aux onglets et panneaux de SON application.
- **Une cible asynchrone se vise après le chargement — dans les Réglages aussi** (10.13.0) : « L'équipe »
  et « Licence » s'affichent « Chargement… » puis grandissent, et la pastille ouvrait le panneau d'au-
  dessus, Licence sous le bas de l'écran. `reg.montrer(vise)` attend `Promise.allSettled` des panneaux
  de l'onglet.
- **Le rôle proposé au premier déclaré est celui qui ne ferme rien.** Le premier collaborateur devient
  l'identité de ce poste (9.9.0) — le comptable, envoyé là par « Tes premiers pas » — et la liste lui
  proposait « Saisie » : il se retirait la validation de ses propres écritures. `roleProposeCollab`
  propose « Supervision » au premier, « Saisie » aux suivants ; la fenêtre le dit AVANT d'enregistrer
  (le toast le disait après) ; et un refus sans aucun superviseur dit où changer le rôle au lieu
  d'envoyer chercher « un superviseur » qui n'existe pas (un refus qui promet une sortie qui n'existe
  pas, 10.12.0).
- **Un identifiant expliqué sans page n'a qu'un sens** : `#pa-ecrire` était déjà un bouton de la Paie.
  Un test lit les deux applications et exige qu'un identifiant du dictionnaire (hors route) ne soit
  posé que par une seule fonction.
- **Une explication vraie de deux boutons, ou pas d'explication** : `[data-close]` porte « Annuler »
  ET le « Fermer » d'une fenêtre dont le geste est fait. « Ferme sans rien garder », nommé « Annuler »,
  était faux du second (le fichier est enregistré). La phrase dit ce qui est vrai des deux, et le
  bouton garde SON nom.
- **Le format interne ne fuit pas, même dans un champ en lecture seule** (9.4.5) : les champs de
  touches affichaient « Control+Enter » à côté de « Ctrl + ↵ Entrée ». Le code vit dans `data-code`,
  la touche se lit dessinée, et le champ n'est que la zone où l'on appuie.
- **La règle générale des champs gagne, huitième fois** — et elle n'était pas seule : la largeur du
  champ de capture ne s'était JAMAIS appliquée (`width: 100%` à quatre `:not()`, puis
  `.field.narrow input { max-width: 120px }`). `regles.js` (scratch : les règles d'un élément qui
  touchent une propriété, par CDP) l'a dit en une ligne.
- **Ce qui répond à un geste ne se déplace pas sous lui, même d'un cran** : la touche dessinée est à
  gauche du champ, et une touche plus large le poussait ; elle réserve sa largeur. Et la phrase qui
  change après « Écrire à mes clients… » garde la hauteur de celle d'avant (`.ap-etat`).
- **Une phrase dans un conteneur flex est UN élément** (10.12.0, re-trouvée ailleurs que dans une
  case) : « c'est   Karim Ben Salah   qui travaille ».

**Puis l'exemple du Cabinet sur deux exercices** (Skander : « ensuite le jeu d'exemple du cabinet ») :
le garage tient l'an dernier — clos, rouvert une fois avec son motif, reclos — et l'exercice en cours,
ouvert par ses à-nouveaux et son registre, tous deux fabriqués par les VRAIES portes du moteur
(`ouvrirExerciceSuivant`, `cloturerExercice`, `rouvrirExercice`). Ce que le second exercice a fait
tomber, et ce que la souris a trouvé ensuite :

- **Un exemple d'UN exercice ne peut rien montrer de ce qui se passe au 1er janvier.** « Ouvrir N+1 »
  posait les à-nouveaux et laissait le registre derrière lui (aucun bien, aucun salarié : les dotations
  n'étaient réclamées nulle part, le pont élévateur se proposait comme un achat du 1er janvier) ;
  l'à-nouveau, daté du 1er janvier, comptait dans les cases de janvier (l'IRPP de décembre deux fois,
  le crédit reporté lu comme de la TVA déductible) ; un exercice clos bougeait par la paie, les biens,
  la banque — seule la grille de saisie tenait la promesse. Aucun test ne pouvait le voir : les jeux
  n'avaient qu'une année (10.12.0, « un exemple complet est un test »).
- **La promesse d'une clôture vit à la porte d'écriture**, pas dans chaque écran : `empreinteFigee`
  prise à la lecture d'un exercice clos, comparée AVANT de poser le verrou (sinon un refus le laisse
  posé). La liste de ce qui est figé (`FIGE_A_LA_CLOTURE`) est un contrat, et ce qui ne change aucun
  chiffre (révision, questions, lettrage, trace) reste mobile.
- **Un refus qui promet une sortie doit l'avoir — y compris APRÈS le geste qu'il conseille** (10.12.0,
  re-trouvée) : « déjà validés, contre-passe-les » revenait mot pour mot après la contre-passation, parce
  que le MIROIR d'une contre-passation garde `source: 'an'` et se valide. `anEnVigueur` exclut le miroir
  (`contrepasseDe`) ; l'original, lui, passe `contrepassee`. Un test joue la sortie jusqu'au bout.
- **Un bouton dit ce qu'il FERA, décidé par le même geste joué sur une copie** (`etatExerciceSuivant`,
  la règle 9.4.5 d'un cran plus haut) : ouvrir, refaire, compléter, voir, ou éteint avec la raison que
  le geste donnerait. « Voir » ne rappelle jamais le geste : il emmène. Et « contre-passe-les si le
  report a changé » se VÉRIFIE (`ecartAnouveaux`, compte par compte) au lieu de se deviner.
- **Une promesse faite par un geste engage les autres** : « Prévoir l'extourne » annonçait qu'« Ouvrir
  N+1 » la poserait, et ce geste refusait dès que les à-nouveaux étaient validés — l'extourne ne partait
  jamais. Une extourne n'est pas un à-nouveau : elle part dans les deux branches, une seule fois.
- **Un état lu une fois se périme, même celui d'une visite** (7.1.x) : le résumé des livres, pris au
  démarrage AVANT l'exemple, faisait sauter tout le chapitre « D'un exercice à l'autre ». Il se relit
  quand l'exemple change et quand une visite part. Un test pur ne pouvait pas le voir : il donne ses
  exercices à la visite au lieu de les lire là où l'écran les lit.
- **Dans une cellule tronquée, le NOM se coupe et ses marques jamais** (`marquesDuNom`) : la marque
  « repris de 2025 », que la découverte éclairait, partait la première.
- **Un identifiant qui naît plus tard qu'on ne s'en sert est un identifiant vide.** Le nom du poste
  naissait à la première annonce à la plateforme : la clôture disait « par cabinet », et le VERROU d'un
  livre portait un identifiant vide — `poserVerrou` ne reconnaît un autre poste qu'à un identifiant
  non vide, donc deux postes ne se voyaient pas. `identitePoste()` le crée au premier besoin.
- **Quitter un état fictif ramène à un écran qui existe** : quitter l'exemple depuis un de ses dossiers
  laissait « Ce dossier n'existe plus », la barre latérale pour seule sortie.
- **Un mot de passe à confirmer se joue au clavier** (les deux applications, `verdictMotDePasse` et
  `enchainerConfirmation` jumeaux) : Tab tombait sur « Afficher » — resté sur le chemin, il montre
  maintenant qu'il a le curseur (couper un chemin pour en ouvrir un autre, 9.3.0) —, Entrée descend vers
  une confirmation vide, une confirmation VIDE se nomme au lieu de se dire « différente », et le refus
  montre sa case. La ligne de solidité réserve sa place : née pendant la frappe, elle poussait la
  confirmation sous le curseur (H-E1, sur un écran de mot de passe).
**Et la suite du même parcours, à la souris** — le conseil de l'écran suivi à la lettre, et ce qu'il a
fait tomber :

- **Ce qui entre au plan PAR l'écriture ne peut pas être refusé parce qu'il n'est pas au plan.** Un
  compte que le dossier n'avait jamais servi éteignait « Enregistrer » et « Valider » — c'est-à-dire
  toute première écriture sur un compte : un refus circulaire, que rien ne débloquait. `ecritureValide`
  range le compte hors plan dans `avertissements`, jamais dans `motifs` : il se SIGNALE (le nom qu'il
  prendra, lu dans le plan de référence, ou « faute de frappe possible ») et les boutons restent vivants.
- **Choisir un compte n'écrit pas son nom dans le libellé** (T-51 : un compte porte un nom de compte,
  une ligne dit l'opération) ; le champ vide montre en attente le libellé de la pièce. Et changer de
  journal, de date ou de libellé relit le verdict des boutons : ils répondaient à l'état d'avant.
- **Un solde dans une phrase dit son sens en mots** (6.3.0, portée aux phrases) : « 411 (−1 200,000
  repris…) » demandait de savoir qu'un solde négatif est créditeur. `soldeEnClair` écrit « créditeur »,
  « débiteur » ou « soldé » ; un compte au même solde mais réparti autrement entre ses tiers le dit
  (`ecartEnClair`).
- **Suivre le conseil de l'écran, c'est le tester.** « Contre-passe les à-nouveaux, puis reviens les
  reposer » menait à ceci : la contre-passation tombait le 25 septembre, la nouvelle ouverture le 1er
  janvier, et de janvier à septembre chaque balance d'un mois comptait l'ouverture DEUX fois — le
  capital à 40 000 pour 20 000. Aucun test ne le voyait : ils regardaient l'exercice entier, où les deux
  pièces se compensent. **Un écart d'ouverture se pose en À-NOUVEAUX COMPLÉMENTAIRES**
  (`poserComplementAnouveaux`) : une pièce de plus, au 1er janvier, en brouillard, qui porte la
  différence — par compte et, sur un collectif, par tiers (un règlement réaffecté d'un client à l'autre
  ne change pas le 411, il change ce que chacun doit) — et rien d'autre. La validée ne bouge pas, rien
  n'est contre-passé ; un complément identique ne se repose pas, un écart disparu retire le brouillard.
  **Le test qui le tient regarde JANVIER**, pas l'exercice : une erreur qui se compense sur l'année ne
  se voit que dans un mois.
- **Un miroir reste dans son exercice** (`dateDuMiroir`, la règle 9.2.0 bornée) : « à la date du
  jour » posait le miroir d'une écriture de 2025, corrigée en février 2026, dans le livre de 2025 à une
  date de 2026 — hors de toutes ses lectures, et la balance gardait l'écriture « contre-passée ». Le
  jour du geste, borné au dernier jour d'un exercice passé ; jamais avant l'écriture corrigée ; le 1er
  janvier pour des à-nouveaux (une ouverture se corrige au jour où elle s'ouvre). La question, le menu,
  la saisie et l'Aide disent CE jour-là avant le geste, par la fonction qui le posera.
- **Un miroir garde tout ce qui situe une ligne** : le NOM du tiers se perdait depuis la 9.8.5 (la
  forme d'une ligne l'avait gagné, les miroirs non) — un seul `ligneMiroir` pour la contre-passation et
  l'extourne. Et **des à-nouveaux ou un miroir ne s'extournent pas** : ils n'ont rien à défaire au 1er
  du mois suivant ; le menu ne le propose plus, le moteur refuse pour tout autre chemin.
- **Le mois regardé appartient à l'exercice regardé, et la garde vit au DESSIN**, pas à chaque porte :
  l'adresse, le sélecteur d'exercice et « Ouvrir N+1 » changeaient d'exercice en gardant août 2026 dans
  le livre de 2025 — la liste affichait « décembre 2025 » (8.3.0), le contenu « aucune écriture sur
  août 2026 ». Chaque porte l'oubliait ; une garde unique, avant la liste des mois, ne peut pas
  l'être. Et un geste qui repasse à l'exercice entier cache les champs des autres modes : trois listes
  côte à côte disaient deux périodes.
- **Une phrase vraie de la mauvaise chose ment quand même** : « les soldes repris (aucun) » — vrai de
  la balance de reprise, faux pour un comptable devant une colonne d'ouverture qui porte le capital (les
  à-nouveaux de la clôture). La phrase nomme les pièces qui portent l'ouverture, et **s'accorde sur leur
  NOMBRE**, jamais sur les morceaux de phrase (« les à-nouveaux AN-2026, AN-2026-C1 est une pièce »).
- **Une colonne de montants prend la largeur de ses MONTANTS, pas celle de son titre** : huit colonnes
  aux titres tenus sur une ligne (« MOUVEMENTS CRÉDIT », 164 px pour des montants de 100) coupaient
  « Solde créditeur » au bord de l'écran pendant que l'intitulé passait sur trois lignes. Les titres
  passent sur deux lignes quand la balance porte l'ouverture.
- **Un compte rendu ne redit que ce que le geste a CHANGÉ** : « 1 bien et 1 salarié suivent » sous
  « Ajuster les à-nouveaux », pour un registre intact, faisait chercher ce qui avait bougé
  (`registreBouge`, la somme que le moteur lit déjà pour dire « rien à faire »). Et « la pièce validée
  n'a pas bougé », vrai d'une pièce, devient faux à la deuxième : ce qui est validé se dit sans compter.
- Piège de test : la tranche `vueBalance` avait une borne haute de 6 000 caractères, et la fonction l'a
  dépassée d'un commentaire légitime. La borne attrape une tranche qui déborde sur la fonction suivante :
  elle se relève (7 000) ; on ne raccourcit pas une explication pour plaire à un test.
- **Trois preuves sont d'abord restées VERTES, et chacune a dit ce que son test ne pouvait pas voir** :
  un écart posé compte par compte, sur un jeu d'un seul client (des données qui ne discriminent pas,
  10.0.0 — un second test réaffecte un règlement entre DEUX clients : le 411 ne bouge pas, le partage
  si) ; une condition neutralisée (`false && …`) dans le gestionnaire du mois, qu'une expression
  régulière lisait encore (le gestionnaire est désormais JOUÉ, avec ses appels comptés) ; et une
  assertion à deux valeurs sans message, sur laquelle deux défauts différents tombaient au même
  endroit. Et une quatrième tombait sur le test d'À CÔTÉ : la borne du miroir se prouve en
  neutralisant le test du complément le temps de la preuve (10.12.0).
- **Une porte ne dépend pas de chaque appelant** : `cab:contrepasser` sans date laissait `dateDuMiroir`
  retomber sur le jour de l'écriture corrigée — l'écran passe toujours le jour, le pont joué à la main
  non. Sans date valable, la porte prend le jour du geste ; vu en préparant le test à la souris.


**Puis les deux applications sur des données saturées** (Skander : « tester comme un humain
développeur et senior UI/UX designer les deux apps avec une saturation de données ») — huit mille
pièces et mille cinq cents clients aux noms longs et arabes (`saturer-entreprise.js`, scratch), un
livre de douze mille écritures et trois cents dossiers collés d'un coup (`saturer-cabinet.js`, par
`cabstore` et le moteur). Rien n'y était faux ; tout y était lent ou interminable :

- **Un calcul qui LIT tout se fait dans un lot** (`C.enLot`, `C.duLot`). L'app entreprise gelait à
  l'ouverture — « L'interface n'a pas répondu depuis 12 s », pile dans `overdueInvoices` et
  `stockAlerts` — parce que chaque pièce relisait toutes les autres (`creditsFor`, `itemOfLine`,
  `stockMovements`, `facturesDuDevis`…). Dans un lot, chaque index se construit une fois ; hors lot,
  rien ne change, et un test le prouve sur l'exemple (avec un avoir en BROUILLON : sans lui, le test
  passait avec l'index faux — des données qui ne discriminent pas, 10.0.0). Le lot ne vit que le
  temps d'un calcul en LECTURE (`render()`, chaque `draw` de liste, les agrégats exportés) et rend
  des COPIES : un appelant qui trie ou annote ne fausse pas le suivant.
- **Un index par livre, jamais un parcours par ligne** (`indexDuLivre`, WeakMap) : chaque menu de
  ligne du Cabinet cherchait son écriture dans tout le livre — vingt millions de comparaisons pour
  un lettrage. Et `validerLot` passait `find` + `reduce` par pièce : 2,2 s pour douze mille, 50 ms.
- **Toute liste qu'on nomme se pagine, les secondaires aussi** : onze tableaux s'affichaient d'un
  bloc (Rapprochement : 453 640 px). Un objet trop grand se replie sur sa ligne AVANT de se paginer
  (le lettrage, comme le grand livre en 9.4.5).
- **Un refus se dit avant la question** (7.6.0, porté à la licence du Cabinet) : `licence:verifier`
  passe par la MÊME porte (`licenceBlockCab`) — une seconde phrase aurait divergé.
- **Un nom se trie comme on le lit** (`Intl.Collator` numérique, créé UNE fois — `localeCompare(…,
  'fr')` le recréait à chaque comparaison) et **un compte de milliers se groupe** (« 3 526 », dans
  les cinq jumeaux de `pl()`).
- **« À jour » ne se dit pas de clients qui n'envoient rien** (`hors` n'est pas `ok`, 6.8.0) : trois
  cents dossiers hors SkanFact, et les Relances les félicitaient.
- **Un identifiant fait d'un seul « mot » impose sa largeur à sa colonne** : le matricule fiscal
  (« 1472411D/A/M/000 ») faisait déborder la liste des clients de trente pixels à 1280 dès que les
  montants dépassaient cent millions — et la colonne Actions sortait de l'écran. Il se coupe après
  ses « / » (`mfCoupable`, échappé AVANT de poser les `<wbr>`), là où un comptable le coupe aussi.
  Les listes principales ne passent pas par `.scroll-x` : son `overflow` casserait l'en-tête
  collant (2.2.0) — on fait tenir la table, on ne la fait pas défiler.
- **Deux vues qui montrent la même chose portent les mêmes gestes, par la même fonction** (la console,
  audit du 22/09) : la vue Cabinets listait des licences sans aucune action. `actesLicence` sert les
  deux tableaux ; et la route rend ce que ces gestes LISENT (`resignable`, `remplacee_par`, `type`),
  sinon « Renouveler » s'offrirait sur une licence déjà remplacée — prouvé sur la vraie base.
- **Un titre de chiffres se plie avant qu'une colonne sorte du cadre** (`th.num{white-space:normal}`) :
  en disposition automatique, il ne se plie que si la table ne tient pas. Et une unité colle à son
  nombre (« 30\u00a0j »). Coller le dernier mot à ses icônes a été essayé et retiré : l'essai a regagné
  la largeur qu'on venait de libérer — la capture l'a dit.
- **Des champs de largeurs différentes partent du même bord** : c'est la LARGEUR du champ, dans une
  colonne commune, qui dit ce qu'on attend — pas une colonne par gabarit.
- Trois des dix-sept preuves ont d'abord été discutées : deux défauts remis sont tombés sur un test
  PLUS ANCIEN que le neuf (la numérotation, le tri) — la règle était déjà tenue ; le troisième est
  resté vert, et c'est lui qui a montré que le test ne pouvait pas le voir.

**Puis l'achat de la licence depuis l'application** (Skander : « fais ce que tu peux faire seul, par
ordre de priorité » — le paiement dans l'application venait en tête). Paramètres → Licence propose
les offres, ouvre la page de paiement préremplie, et la clé revient toute seule :

- **Une clé ne se récupère jamais par ce qui est public.** Le matricule se lit sur chaque facture :
  une route « donne-moi la clé de ce matricule » donnerait la licence à qui la demande. La commande
  rend UNE fois un jeton (`jetonCommande`, HMAC de l'identifiant par un secret du serveur — aucune
  colonne D1 de plus), l'application le garde à côté de la licence (`LIC_FILE`), et il ne traverse
  jamais le pont (`commandePublique`). `POST /v1/achat/cle` répond la même chose à un jeton faux et
  à une commande inconnue : la différence apprendrait quelles commandes existent.
- **Ce qui arrive du réseau passe la même porte que ce qu'on colle** : la clé reçue repasse par
  `verifyKey` puis le refus « autre entreprise » avant `ecrireLicence` — un serveur qui se trompe de
  commande ne pose pas la licence d'un autre.
- **On ne vend pas en ligne par-dessus une licence qui court** (`achatPossible`) : la clé achetée
  partirait d'aujourd'hui et perdrait les jours payés (7.33.0, « un renouvellement part de la fin de
  la licence en cours »). Le renouvellement en ligne demande un départ prouvé côté serveur ; il reste
  au mail (`A-FAIRE.md` § 4).
- **Un refus se dit avant la question** (7.6.0) : sans raison sociale ou sans email, la fenêtre le
  nomme avant le récapitulatif, et son bouton ouvre la fiche le curseur dans la case qui manque.
- **`allerParametres` depuis les Paramètres eux-mêmes ne faisait rien** : `navigate()` vers la page
  courante ne redessine rien (7.15.0), et « Compléter ma fiche » était inerte précisément quand on
  achetait depuis le panneau Licence. Les Paramètres exposent `amenerDansParametres` ; et la cible
  se revise après le chargement des panneaux asynchrones (`Promise.allSettled([majLue,
  achatDessine])`), sinon la palette arrivait en haut de l'onglet (10.13.0 : une cible asynchrone se
  pose après le chargement). Un amenage se fait par `reg.montrer`, jamais par un `scrollIntoView` de
  page — un test l'interdit.
- **Une zone morte temporelle dans une route ASYNCHRONE ne dit rien** : `amenerChamp` lisait une
  `const` déclarée plus bas ; l'exception était avalée par la promesse de `render()`, et les
  panneaux restaient vides sans une ligne en console. La variable est déclarée avant tout lecteur, et
  un test lit l'ordre des deux.
- **Une phrase d'offre se déduit de l'offre** : le panneau citait « Achats » parmi ce qu'Indépendant
  réserve, deux versions après la 10.7.0 qui l'a ouvert — il lit maintenant `st.reserves`.

**Puis le trop-perçu, qui avait une carte et pas de geste** (P1 bis) :

- **Un remboursement est un règlement NÉGATIF sur la facture.** Le signe fait tout le reste sans
  qu'aucun agrégateur ait à s'en souvenir (la leçon de la 10.2.0) : le reste remonte à zéro, la
  trésorerie voit une sortie, l'écriture change de colonne toute seule (`entrySet`, 6.3.0). Seuls
  les lecteurs de DATES doivent le connaître — rendre de l'argent n'est pas « le jour où le client a
  fini de payer » (`dateDernierReglement`, dans les trois délais et la date envoyée à la console).
  Le montant se TAPE en positif, comme sur le chèque ; c'est la fenêtre qui pose le signe.
- **Un net se lit comme ce qu'on a versé** : « Payé 1,000 DT » sur une facture réglée 405,600 puis
  remboursée de 404,600 — vu à la souris, jamais par un test. La carte dit ce qui est reçu, et ce
  qui a été rendu dessous.
- **Deux écrans, un chiffre** (6.8.1) : le reste NET de la fiche client (`clientSummary.net`) suit la
  règle du relevé — un avoir rattaché est déjà dans le reste de sa facture, un avoir libre et un
  trop-perçu sont des crédits — et un test les compare. Le relevé, lui, SAUTAIT le trop-perçu comme
  une facture soldée : le total disait au client qu'il devait plus qu'en réalité.
- **Un total en faveur du client le dit en mots** : « Total dû : −404,600 » se lit comme une faute
  de frappe, et c'est le client qui la lit.
- Deux assertions retournées vers la règle (vingt-septième et vingt-huitième) : l'une recopiait le
  libellé « Modifier ce paiement » mot pour mot, l'autre bornait sa tranche à 700 caractères — une
  question qui gagne une phrase en sortait. Bornée sur la fin de l'action.

**Puis les questions, qui s'intitulaient toutes « Confirmation »** (P2) :

- **Une question dit ce qu'elle confirme, dans son titre.** Soixante-dix-huit fenêtres portaient le
  même mot, et la phrase utile était en dessous — on lisait « Confirmation », puis on cherchait de
  quoi. Le titre se DÉDUIT (`C.titreQuestion`, pur et testé) : la première phrase du message quand
  c'est une question courte (« Supprimer ce paiement ? ») ; sinon le geste du bouton suivi de « ? »
  — sauf un geste générique (« Confirmer », « Continuer », « … quand même »), qui donnerait
  « Continuer ? » ; sinon « Avant de continuer ». Et quand la règle ne peut pas trouver le vrai
  sujet — un AVERTISSEMENT (« Un paiement daté dans le futur ») —, l'appelant le nomme
  (`opts.titre`, dix-sept appels). Le tri de l'A-FAIRE disait « à écrire appel par appel, pas à
  fabriquer » : c'était vrai du geste seul (« Passer ? »), faux de la phrase, qui porte presque
  toujours la question. **Dériver ce qui se dérive, nommer le reste** — jamais soixante-dix-huit
  titres écrits à la main, qui divergeraient du message au premier ajustement.
- **Un titre est un morceau de prose comme un autre** : il reçoit `numerosInsecables`, sinon
  « FAC-2026-015 » se coupe en fin de ligne dans le titre alors que le corps le protégeait déjà.
- **Un mot d'état se change à l'AFFICHAGE, jamais dans la donnée** : « envoyée » est la valeur rangée
  depuis la 1.4.0 (filtres, relances, fusion, CSV la lisent) ; c'est `statusLabel(s, type)` qui dit
  « émise » — et le TYPE décide, parce qu'une proforma, elle, est vraiment envoyée. Le badge et les
  listes passent le type de la pièce. Et un libellé neuf se relit contre ses VOISINS : « Émise » à
  côté du regroupement « Émis » se lisait comme le même choix deux fois ; le regroupement a son nom.
  Le test des listes de statuts (10.12.0) recopiait la forme `optionStatut(x)` : retourné vers la
  règle (la valeur passe par `optionStatut`, avec ou sans type).
- **Une barre d'actions n'a de bouton que pour l'étape suivante ; le reste va dans « Plus ▾ »**
  (U-11, étendu de la COULEUR à la PLACE). « Transformer ▾ » et « Email » passaient la barre d'un
  bon de commande sur deux rangées (1 216 px pour 1 129) : ils y restent quand ils sont le vert, et
  vont sinon en tête de « Plus ▾ » sous un titre de section (`convDansPlus`, `emailDansPlus`). La
  facture garde « Email » — l'envoi y est le geste de la pièce, émise ou pas. Un geste qui change de
  menu garde son IDENTIFIANT (`#email`, `data-conv`) : le gestionnaire, la visite et le parcours le
  retrouvent — et ce sont eux qui ont dû apprendre à ouvrir le menu d'abord (la visite « Envoyer »
  a gagné une étape, `e2e:exemple` et `e2e:entreprise` passent par ce que le geste FAIT).
- **Une phrase qui envoie ailleurs quand le geste est sous le doigt fait chercher ce qu'on a déjà**
  (H-E30) : l'onglet vide renvoyait au menu « Transformer » d'une autre pièce, au-dessus de
  « Partir d'un devis existant ». La phrase et le bouton lisent la MÊME condition (`aPartir`). Le
  « non enregistrée » de H-E30 n'existait plus (la liste arrête ses propres événements depuis la
  10.12.0) : vérifié à la souris par les deux chemins, avant d'écrire une ligne.
- **Un objet qui se REPLIE doit encore se paginer une fois déplié** (saturation, suite) : le grand
  livre replie ses comptes depuis la 9.4.5, et un compte déplié construisait toutes ses rangées —
  7 175 pour le 411 d'un livre saturé. `lignesAffichees` en montre 300, la suite se demande
  (« Montrer 300 lignes de plus », « Tout montrer »), le PIED garde le compte entier (2.2.0), et la
  phrase dit où est le reste, y compris avant d'imprimer : une rangée absente de l'écran ne
  s'imprime pas. Un compte ouvert à la main le reste au redessin (`glOuverts`, remis à zéro quand on
  change de client) — sinon « montrer la suite » refermait ce qu'on lisait.

**Puis le ménage des bulles, et la fenêtre qui clôturait à l'aveugle** (P4, « fais ce que tu peux
faire seul, par ordre de priorité ») :

- **Un test qui ne tient que le premier jour laisse nu tout le reste.** Celui de 213g ne lisait que
  quatre formulaires ; étendu à tout `app.js`, il a trouvé des dizaines de champs sans bulle, puis la
  sonde a appris trois formes qu'elle ne lisait pas — un `dateFieldHtml('Date', …)`, un `<span>` nu
  dans un `<div class="field">`, et un libellé passé en EXPRESSION (`field(rend ? 'Montant rendu' :
  'Montant', …)`), celui-là trouvé à la souris sur la fenêtre de paiement. 118 en tout. La
  sonde lit désormais tout premier argument qui n'est pas `lbl(`, et ses exceptions sont NOMMÉES
  (field() et dateFieldHtml() eux-mêmes, les clauses d'un contrat, promptDialog, une lecture) — avec
  un contrôle que chacune désigne encore quelque chose.
- **Une bulle mène à l'article qui PARLE du champ** : le préfixe `ed.` envoyait « Montant » d'un
  paiement à la numérotation. `ARTICLE_PAR_CLE` range les paiements, les acomptes et la pièce de
  départ à leur article, et le test l'exige.
- **Un geste en masse montre ce que montre son geste unitaire** : « Clôturer jusqu'à… » clôturait trois
  mois sans un seul des contrôles que « Clôturer juin » affiche. Les points à régler se calculent sur
  toute la période choisie, suivent la liste, et se lisent AVANT (9.4.2) ; on peut clôturer quand même
  (6.0.0). Et l'annonce qui devient un encadré **réserve la hauteur de l'encadré** (`annonce-stable
  encadre`) : `3lh` ne comptait que le texte, et « Clôturer » descendait de 13 px au choix du mois.
- **Choisir n'est pas taper.** `suivreSaisie` comptait un `<select>` comme une frappe : changer le
  mois puis « Annuler » demandait « Abandonner cette saisie ? Ce que tu viens de taper… ». Une fenêtre
  sans champ où l'on tape se referme sans question, et la recherche d'une liste (`.combo-q`) ne compte
  pas (chercher n'est pas modifier, 10.12.0) — dans les deux applications, même corps. Le test JOUE la
  fonction sur une fausse fenêtre qui LIT le sélecteur : ma première version l'ignorait, et retirer
  l'exclusion ne faisait rien tomber. Et la preuve se fait sur la règle entière : l'exclusion vit dans
  la détection ET dans la lecture, en retirer une seule ne change rien.
- **La typographie de l'app entreprise vient d'UN observateur**, pas d'un appel par écran : cent
  `draw()` posent de la prose, un appel oublié laisserait l'écran à moitié typographié. Il agit sur les
  NŒUDS DE TEXTE de la prose au moment où elle est posée (pages, fenêtres, bulles, annonces réécrites
  pendant la frappe), par `C.typoFr` — la règle du moteur, jamais une seconde expression. Il saute
  ce qui se SAISIT ou se copie tel quel : le texte d'un `<textarea>` est un nœud enfant (sa valeur de
  départ), une `<option>` est une valeur, un code se recopie au caractère. Mesuré par CDP sur cinq
  écrans : zéro espace ordinaire restant, aucune erreur.
- **Chrome coupe à un `<wbr>` MÊME sous `white-space: nowrap`.** Le matricule coupable de P3 (fait pour
  1280) passait sur deux lignes à 1440, doublant la hauteur de chaque ligne de la liste. La règle qui
  le garde sur une ligne au-dessus de 1340 px retire le `<wbr>` du rendu (`display: none`) ; `nowrap`,
  essayé d'abord, n'y faisait rien — c'est la mesure (rectangles de ligne par CDP) qui l'a dit, la
  capture qui l'a montré, et un correctif pensé pour UNE largeur se vérifie à l'autre.

**Puis les achats, repris à la souris** (P5) :

- **Un argument FACULTATIF qui change un montant piège chaque appelant qui l'oublie.**
  `purchaseBalance(purchase, company, data)` ne compte les avoirs et acomptes imputés que si on
  lui donne `data` ; trois appels de l'app entreprise ne le donnaient pas — la fenêtre « Régler »,
  la grille des règlements et la condition de son bouton. La fenêtre annonçait 1 309 DT de reste
  et les PRÉREMPLISSAIT sur un loyer que la liste « À payer », juste au-dessus, disait dû de
  1 071 : un trop-payé proposé. C'est E-08 (un montant NATIF, 10.12.0) sous une autre forme : la
  couverture se fait par appelant, et le test lit chaque `C.purchaseBalance(` et exige `data`.
  Et ce qui a été imputé se DIT là où on lit le reste — sinon « net 1 309, réglé 0, reste 1 071 »
  ne s'additionne pas, et le chiffre juste passe pour faux. Trouvé en cliquant « Régler » sur la
  première ligne de la liste ; aucun parcours ne compare la fenêtre à la liste.
- **Un total d'une année porte ce qui est au bilan à la fin de l'année** — les deux applications
  comptaient le bien cédé dans la valeur et le cumul, pas dans la VNC : « 5 biens à l'actif » sous
  la valeur des six, et valeur − cumul ≠ VNC. La dotation, elle, reste : c'est une charge de
  l'exercice. Le jumeau du Cabinet (`etatImmobilisations`) promettait en commentaire « des totaux
  qui tombent juste » — vrai sauf l'année d'une cession, le seul cas qu'aucun exemple ne portait.
  Trouvé en lisant les quatre cartes comme une addition ; vérifié au Cabinet en saisissant une
  cession à la souris (18 000 − 5 400 = 12 600). Quand trois cartes forment une équation, la page
  doit la tenir.
- **« À reverser » est un ÉTAT, pas une nature** : la carte CNSS de la Paie additionnait l'année
  entière sous ce mot, trimestres déposés compris. Un agrégat porte sa période (3.1.0) ET ne se
  nomme d'un état que s'il ne compte que ce qui est dans cet état (« versé », 10.12.0).
  `core.cnssNonDeclaree` lit les dépôts par la même porte que « À faire » (`socialesDeposees`).
- **Un minimum de visibilité ne s'applique qu'à ce qui est positif** : `Math.max(4, …)` garantissait
  un trait aux petites valeurs, et faisait d'un avoir de − 300 DT une barre de 4 % dans « Où part ton
  argent ». `largeurRang`, pour les quatre classements.
- **Un signe se compose comme son contraire** : `money()` pose « −\u00a0 », un « + » écrit à la main
  était collé. `moneySigne`, et un test interdit la forme `? '+' : ''}${C.money(`.
- **Le geste d'un journal vit sur l'onglet du journal** : « + Mouvement » disparaissait de l'onglet
  Mouvements du Stock — `ST_ACTION` ne connaissait que « État du stock ».
- **Une invite se mesure dans SA case** : « Rechercher : n°, fournisseur, objet, catégo… » était
  coupée dans la case de 300 px des listes (291 px de texte pour 262 de place) ; la même longueur
  tient dans la case de 416 px de la Comptabilité. Le test borne donc les invites de `#q` seules,
  et le dit.

**Puis la vérité comptable** (Skander : « on ne doit pas se permettre d'avoir de l'argent faux ou
des données de comptabilité fausses ») — un audit qui confronte, sur les cinq ans de l'exemple,
chaque chiffre calculé par DEUX chemins, devenu une suite permanente (`test/suites/verite-comptable.js`) :

- **Deux chemins, un chiffre — et c'est la seule forme de test qui trouve ces défauts.** La TVA
  d'un acompte fournisseur déduite deux fois, l'avance sur salaire qui ne sortait jamais de la
  banque : chacun avait ses tests « à un chemin », tous verts. Le journal disait une chose, la
  déclaration une autre, et aucun test ne les posait côte à côte. Les invariants : chaque pièce
  équilibrée ; 532 et 54 = Trésorerie ; TVA collectée, déductible (et par taux) et CA du journal =
  déclaration, **mois par mois** ; résultat des états = balance ; 22/28 = tableau des biens ;
  à-nouveaux = soldes de clôture ; 411 et 401 = lettrage ; 425 = salaires dus − avances à
  rembourser. Un invariant neuf s'ajoute à la fonction `ecarts`, qui rend la LISTE des écarts —
  jamais un booléen : quand il tombe, il dit où.
- **Une règle posée d'un côté du moteur se cherche de l'autre** (le jumeau manquant, 7.3.0, à
  l'intérieur d'un seul fichier). L'imputation de l'acompte recréditait le 4366 dans les écritures
  depuis la 10.2.0 ; `purchaseJournal` et `vatReturn` ne l'ont jamais su. `acomptesDeduits` est la
  définition unique, que la déclaration lit — le journal de l'écriture reste celui qui l'a posée.
- **Un test ancien gravait le défaut** (vingt-neuvième fois) : « 380 − 190 + 95 = 285 » comptait
  la TVA de l'acompte dans l'acompte ET dans la facture. Retourné à 190, avec le cas qui trompait
  l'exemple : l'acompte et sa facture dans deux mois différents.
- **Un mouvement d'argent que l'écran enregistre doit exister dans les deux livres** : l'avance
  vivait dans `data.advances`, lue par la paie pour ses retenues, et par personne pour sa sortie.
  `cashMovements` et `journalEntries` la lisent ; un identifiant déduit (« av-… », « pay-… ») doit
  aussi être connu de celui qui le POINTE (`porteur`), sinon la case accepte le clic et ne fait
  rien — le test lit les préfixes que `cashMovements` fabrique et exige chacun dans `porteur`.
- **Un exemple qui ne paie pas ses dettes ment sur le produit** : cinq ans de CNSS jamais versée,
  c'est un bilan qu'aucun comptable ne croirait, et un utilisateur qui ne sait pas où enregistrer
  le paiement. `socialDue` ne regarde que deux ans : l'exemple paie TOUS les trimestres échus.
- **Un chiffre qui part chez un tiers se calcule par la MÊME chaîne que l'écran qui le montre.**
  Le paquet recalculait la TVA de son mois en isolant le mois avec le crédit de DÉBUT D'ANNÉE : la
  règle de la 3.1.0 (« une déclaration isolée ignore le report ») écrite dans un commentaire à trois
  lignes du défaut. `vatChain(...)[mois − 1]`, et l'invariant compare le manifeste à la chaîne pour
  chaque mois des cinq ans. Il ne tombe que sur UN mois de l'exemple (mars) : un seul mois laissait
  un crédit — des données qui discriminent à peine suffisent, si le test regarde tous les mois.
- Piège de l'outil humain : `getBoundingClientRect` donne des coordonnées dans la PAGE, le clic
  système des coordonnées ÉCRAN (barre de titre et menu : 46 px de plus). Mesuré pendant un
  défilement animé, le clic tombe une ligne plus haut — j'ai pointé deux mauvaises lignes avant
  de le voir. `clicsel.sh` (scratch) ajoute le décalage.

**Et la vérité comptable, élargie** (Skander : « je ne veux plus aucun calcul ou données ou chiffres
faux », et « la compta est partagée avec l'app cabinet : quand tu trouves quelque chose, vérifie
aussi l'app cabinet ») — les invariants ont gagné le stock, le résultat, les mois et le paquet :

- **Un chiffre qu'une page montre existe dans les écritures, ou le bilan ment.** La page Stock
  valorisait l'étagère depuis la 4.0.0 ; le 37 n'apparaissait dans AUCUNE écriture. Le stock de
  départ entre au 37 contre le report à nouveau (jamais au résultat, qu'il n'a pas traversé), et
  l'inventaire du 31 décembre écrit la variation au 603 (`inventaireComptable`) — après elle, le 37
  vaut `stockTotals` au millime, et 607 + 603 = le coût des sorties de la page Stock. La valeur est
  UNE : celle de la page Stock, pour la page, le bilan et le résultat.
- **Une TVA non récupérable est un coût, et elle va où va la dépense** (`coutAchat`) : au 22 pour un
  bien — il s'amortit TTC —, au 37 pour une marchandise, en charge pour le reste. Les écritures la
  versaient en charge à part pendant que le résultat, la marge, la fiche du bien et le stock
  l'ignoraient : deux chemins, deux chiffres.
- **Deux résultats pour le même exercice, c'est un de trop.** Le résultat simplifié de l'onglet TVA
  oubliait la TVA non récupérable, les achats d'un article non suivi, les frais bancaires, les OD et
  les cessions ; sur un exercice terminé il est maintenant celui des états, et un invariant exige
  aussi que **les douze mois fassent l'année** — une erreur qui se compense sur l'année ne se voit
  que mois par mois (215g), et celle-ci ne se voyait qu'en additionnant les mois.
- **Un mois finit à son vrai dernier jour, et février compte en base 360.** `period()` arrêtait
  chaque mois au 31 (« arrêtés au 31/09/2025 ») ; et `days360` borne le jour à 30 (`min(d, 30)`) :
  le 28 février n'est pas un mois entier, donc février comptait deux jours de trop que mars
  reprenait. `packPeriod` donne le vrai dernier jour, `fin360` fait du dernier jour de février un
  30 : chaque mois entier vaut un douzième de l'annuité. Le test l'exige sur un bien à 720 (60 par
  mois) ET sur la somme des douze mois — un montant qui se divise sans reste ne prouve rien
  d'un arrondi (9.6.1), un mois de février, si.
- **Une égalité affichée se vérifie avant d'être affichée.** Les états d'un mois en cours attendent
  deux écritures d'inventaire (la dotation, la variation du stock) : la phrase les nomme, et refait
  le calcul jusqu'au résultat simplifié — `A − dotation ± variation = résultat` n'apparaît que si le
  calcul TOMBE (`tombe`). Une équation écrite à l'écran est une promesse ; une équation fausse est
  pire qu'une phrase.
- **Une facture de solde remisée ne se remise pas deux fois** (`facteurRemise`) : le facteur se
  calcule sur les lignes que la remise TOUCHE, jamais sur un total qui porte la déduction d'acompte
  (`noDiscount`). Et l'acompte facturé est du chiffre d'affaires : Marges et Statistiques disent le
  même, mois par mois.
- **Corriger un calcul change des mois déjà envoyés : le paquet garde son sceau, et un mois qui
  change le DIT** (`sceauEcritures`, `ecartsSceau`). Le journal est DÉDUIT : chaque correction de
  cette version réécrit silencieusement des mois qu'un comptable a déjà reçus. Le paquet fabriqué
  garde le débit et le crédit de chaque compte ; si l'écran ne les retrouve plus, le vert passe sur
  « Refaire le paquet » et nomme les comptes (le côté qui a bougé seulement). Un paquet d'avant
  n'a pas de sceau : on ne peut rien en dire, et le CHANGELOG demande de refaire ceux qui portaient
  ce que la version corrige — c'est la seule honnêteté possible sur le passé.
- **Deux écrans qui montrent la même pièce disent le même NUMÉRO.** Le paquet porte le numéro du
  client depuis E-07 (10.12.0) ; le Cabinet le recomptait 1..n (la règle de la 9.8.8, écrite quand
  le paquet n'en portait pas) — INVENTAIRE-2025, n° 272 chez le client, était « 41 » au Cabinet, et
  « 1 » dès qu'on le cherchait. `journalDepuisLignes` reprend les numéros reçus quand ils TIENNENT
  (un par pièce, aucun doublon), rend `numeros: 'livre' | 'client' | 'recomptes'`, et l'écran
  numérote sur la PÉRIODE avant de filtrer : **un numéro qui change avec la recherche n'est plus un
  numéro**. Le test de la 9.8.8 qui exigeait le recompte est retourné (trentième fois).
- **Un nombre annoncé se compte sur ce que le code écrit** : « 16 fichiers » pour un paquet qui en
  a 17 — la signature, ajoutée par le processus principal, n'entrait pas dans le compte. Le test lit
  les `files.push` de `pack:build` et exige que l'annonce les ajoute (trente et unième assertion
  retournée : celle de la 10.13.0 exigeait `+ 2`).
- **Une preuve sur un lot rouge ne prouve rien — re-rencontrée** (9.7.0) : le premier lot de preuves
  a rendu « TOMBE » partout, parce que la suite tombait déjà (un pluriel `pl(n, 'autre compte')`
  sans son pluriel, deux tests de la 10.13.0). On vérifie le code de sortie AVANT la première
  preuve.
- **Des données qui ne bougent qu'un côté ne prouvent que ce côté** : le test du sceau ne changeait
  que des débits, et retirer la comparaison des crédits le laissait vert. Il change aussi un crédit
  seul, et fait disparaître un compte.
- **Vérifier le Cabinet, c'est relancer le Cabinet** : son processus principal `require` le gabarit
  d'exemple UNE fois ; régénéré après son démarrage, il gardait l'ancien, et la recherche
  « INVENTAIRE » rendait zéro pièce. Avant de conclure qu'une écriture manque, vérifier que l'objet
  regardé est celui qu'on vient de fabriquer (10.12.0, « v44.4.1 »).
- **Un compte de passage sans rien pour le créer devient une créance qui n'existe pas.** Un
  mouvement « Salaires » s'écrivait au 425 quoi qu'il arrive : sans bulletin pour y créditer le net,
  le 425 devenait débiteur (« les salariés te doivent ») et le salaire ne comptait dans AUCUNE
  charge. `compteDuMouvement` : 640 quand ni le mois ni le précédent n'a de bulletin (un salaire se
  paie le mois suivant — le test l'exige en février sur un bulletin de janvier), 425 sinon, la
  contrepartie choisie à la main toujours. Le jumeau à surveiller : **toute contrepartie « de
  passage » (425, 471, 409) se demande ce qui la solde, et ce qui arrive quand rien ne la solde.**
- **Une échéance d'emprunt n'est pas une charge** : le seuil de rentabilité retranchait le capital
  remboursé en charge fixe et oubliait les intérêts. Il est bâti sur les composants de
  `simpleResult` (même CA, mêmes charges, même paie, même dotation), la cession à part
  (`exceptionnel`, lue sur 675/775 dans les écritures) — et un invariant exige, chaque année, que
  `breakEven.result` soit `simpleResult.resultat`. **Deux résultats pour la même année, c'est un de
  trop — le seuil compris** : un écran qui calcule un résultat par son propre chemin finit par en
  dire un autre.
- **Un invariant qui compare un compte à sa source vaut pour CHAQUE compte que la source écrit** :
  la paie (640 = brut, 645 = CNSS patronale + accident, 661 = TFP + FOPROLOS, 4321 = IRPP + CSS,
  4531 = CNSS totale), les quatre trimestres CNSS contre l'année, le timbre des factures émises
  contre le 4368 (avoirs compris, qui le reprennent ; la déclaration mensuelle, qui le solde,
  exclue), les retenues opérées contre le 4352, la dotation d'un exercice terminé contre le tableau
  des biens. Le premier jet du timbre tombait sur l'avoir qui reprend son timbre, puis sur la
  déclaration qui solde le compte : **un invariant se lit sur ce que le moteur ÉCRIT, avec ses deux
  sens** — comme la liasse (10.10.0).
- **Une preuve qui déséquilibre une pièce tombe sur l'absorbeur, pas sur le test neuf** : retirer le
  timbre d'un avoir laisse une pièce boiteuse, que le test de la 10.1.0 (`ecartAbsorbe`) attrape
  d'abord. On prouve avec un défaut ÉQUILIBRÉ (le timbre crédité au 706 au lieu du 4368), et en
  neutralisant l'ancien test de la même règle — sinon on ne sait pas si le neuf voit quelque chose
  (9.8.8).
- **Une liste qu'on peut prendre ENTIÈRE doit refaire le total qu'elle détaille.** Le « top » des
  prestations additionnait les lignes AVANT remise et sautait les acomptes : pris en entier, il ne
  refaisait pas le chiffre d'affaires de la carte d'à côté. `topItems` applique `facteurRemise` à
  chaque ligne et range les acomptes (et leur déduction au solde) sur une ligne à part, comme
  `marginBy` ; l'invariant prend le classement avec une limite qui ne coupe rien (`1e9` : `0`
  donnait 8, le piège de la 7.16.0) et exige le CA de chaque mois — clients compris.
- **Une prévision projette TOUT ce qui est engagé, et chaque chose une fois.** Elle projetait les
  factures, les achats et les contrats ; un bulletin établi et impayé (la sortie la plus certaine
  qui soit) et tout ce qui est saisi APRÈS aujourd'hui (un règlement daté du 3, un loyer
  programmé) n'étaient nulle part — ni dans le disponible, qui s'arrête aujourd'hui, ni dans ce qui
  arrive. La branche des saisies relit `cashMovements` sur `]aujourd'hui, horizon]` ; la branche
  des salaires saute tout bulletin qui porte une date de paiement, parce que celui-là est déjà un
  mouvement (passé : dans le disponible ; futur : dans les saisies). Le test le prouve en posant les
  deux cas — et la preuve du double compte (`paidDate <= t`) tombe dessus. L'invariant : la somme
  des salaires projetés égale les nets dus.
- **Le bouton d'une question dit son verbe** (`gesteQuestion`) : sans bouton nommé, la fenêtre
  prend l'infinitif par lequel la question commence (« Supprimer ce mouvement ? » → « Supprimer »),
  jamais « Annuler » (le bouton d'à côté), ni un mot qui n'en a que la terminaison (« Votre »,
  « Autre »). Le test relit CHAQUE `confirmDialog` à un seul argument et exige un verbe pour tous.
- **Un avoir diminue sa facture dans la devise de la FACTURE** (`montantDansDeviseDe`) : « Nouvel
  avoir » part en dinars, et un avoir de 300 DT rattaché à une facture de 1 000 € en retranchait
  300 €. Le reste dû, le 411, le lettrage et `purchaseBalance` convertissent la pièce qui diminue
  vers la devise de celle qu'elle diminue ; et l'éditeur ne laisse plus un avoir rattaché changer de
  devise, de taux ni de langue (`roDevise`) — un avoir d'avant se réaligne à l'enregistrement, et
  **n'est pas enregistré du même geste** : ses montants changent de devise, ils se relisent d'abord.
- **Même devise, autre taux : le tiers se solde au taux de sa pièce, l'écart part au change**
  (`ecartDeTauxEntre`, 655 / 755). Un avoir de 300 € à 3,40 sur une facture à 3,35 laissait 15 DT au
  411 pour toujours — un client qui ne doit plus rien en euros et dont le compte dit le contraire.
  La règle vit en UN endroit et trois lecteurs la lisent : les écritures, le résultat simplifié et
  le seuil (`ecartsDeChange`) — sinon l'invariant « seuil = résultat simplifié » tombe, et c'est lui
  qui a dit que le seuil l'oubliait. Ce que ça ne règle PAS : l'écart de change d'un RÈGLEMENT (un
  paiement se convertit au taux de la facture) — c'est une limite du modèle, écrite dans A-FAIRE.
- **Une ligne de tableau qui ne s'additionne pas fait douter de toutes les autres.** Le lettrage
  affichait « 3 685 − 3 685 = − 1 005 » : l'avoir faisait la différence sans colonne. Montant −
  Avoirs − Réglé = Reste sur chaque ligne, et un test l'exige sur les cinq ans ET sur un trop-perçu
  fabriqué — l'exemple n'en portait pas au premier jet, donc le test ne pouvait rien prouver
  (des données qui ne discriminent pas, 10.0.0).
- **Un nom de rubrique ne contredit pas le nom que le plan donne à ses comptes**, et un test le lit
  compte par compte : pour chaque compte à deux chiffres des classes 6 et 7, « financier » et
  « extraordinaire » sont dans les deux noms ou dans aucun. « Produits financiers » lisait le prix
  d'un bien cédé (775) et les reprises (78) pendant que le 75 était dans l'exploitation. Et **chaque
  compte du plan de l'application trouve sa rubrique dans son sens naturel** : 24, 29, 48, 49, 59 et
  72 sortaient de la liasse, 14 (« Autres capitaux propres ») était rangé en « Provisions ». Le seul
  compte exclu est NOMMÉ (18, liaison : un solde y est une anomalie à montrer).
- **Un rangement écrit deux fois a la même faute deux fois.** `etatsFinanciers` (core) et
  `etatsDepuisLignes` (compta) rangeaient toute la classe 1 en « Capitaux propres » — un emprunt
  gonflait les fonds propres, sur le PDF de clôture envoyé au client — et une provision 49 passait
  au passif comme une dette. Les totaux tombaient juste : aucun contrôle ne pouvait le voir. Le
  rangement vit dans `groupesDesEtats` (compta.js), core l'appelle, et un test interdit une seconde
  liste de rubriques dans core.
- **Une rubrique neuve dans une copie du cabinet se pose à SA place, et un préfixe plus court du
  modèle ne la bloque pas** : `migrerModeleLiasse` n'ajoute une rubrique que si aucune ligne ne lit
  déjà ses comptes — mais « 5 » (liquidités, resté celui du modèle) « lisait » le 59 et empêchait la
  rubrique des provisions de naître. Un préfixe plus court que le CABINET a écrit bloque (c'est son
  choix) ; celui du modèle non (la rubrique neuve existe pour lui reprendre ce compte). C'est la
  preuve du test « la copie de la 10.13.0 rejoint le modèle » qui l'a dit, pas la relecture.
- **L'EBE ne compte pas les charges financières** : le SIG lisait « personnel » sur 64 et 65.
- Piège de ma propre méthode : `mini-suite.js` (scratch) ne passait pas `lireSource` — toutes les
  preuves d'une suite qui en a besoin rendaient « TOMBE » sur des tests étrangers, ce qui ne prouve
  rien. L'outil de preuve se répare avant de conclure (9.9.1 : quand une mesure fait changer le
  code, c'est l'instrument qui se relit en premier).
- Et une preuve restée VERTE a donné un test qui manquait : l'avoir fournisseur en dinars sur un
  achat en euros n'était porté par aucun test (le jumeau des ventes l'était).
- **Une chaîne qui repart de zéro chaque année perd ce qu'elle reporte.** `vatChain` enchaînait les
  crédits de mois en mois (3.1.0) et repartait, chaque 1er janvier, du seul crédit « saisi à la
  main » : le crédit de décembre était PERDU, janvier réclamait la TVA entière, et le 4366 gardait
  le crédit pour toujours — 316,160 DT sur l'exemple, cinq ans de suite, **de l'argent payé en
  trop**. Aucun test ne pouvait le voir : ils regardaient un exercice, et la chaîne est juste DANS un
  exercice. `reportTvaDebut` calcule le report depuis décembre de l'année d'avant dès que SkanFact la
  connaît (`premiereAnneeTva`, qui ignore les brouillons — un brouillon oublié ferait de son année la
  première, et le crédit saisi pour la suivante serait remplacé par zéro), et le saisi ne vaut que
  pour la première année ; l'écriture d'ouverture du crédit saisi ne s'écrit que dans ce cas, sinon
  elle doublerait les à-nouveaux. L'invariant qui le tient compare, chaque mois, le 4366 de la
  balance au crédit que la déclaration reporte.
- **Deux applications qui lisent le même client se confrontent sur tout l'historique, par le VRAI
  paquet** : les cinq ans de l'exemple partent au Cabinet comme un client les envoie
  (`packPlan` → `entreesDepuisCsv` → `importerPaquet`), et chaque case de la déclaration du Cabinet,
  chaque compte, chaque groupe des états et la liasse sont comparés à l'app entreprise, mois par mois.
  C'est la parité de la 9.1.0 (une balance), étendue à TOUT ce que les deux affichent — et c'est elle
  qui a trouvé le crédit perdu : le Cabinet lit le 4366, l'app entreprise enchaîne ses mois, et le
  même mars 2026 disait 52,079 DT à payer d'un côté, un crédit de 264,081 DT de l'autre.
- **Vérifier le Cabinet, c'est le relancer — deuxième fois** : après `node scripts/exemple-cabinet.js`,
  le Cabinet ouvert montrait encore l'ancien crédit (son processus principal `require` le gabarit une
  fois). Et l'exemple de l'app entreprise, bâti par le moteur d'AVANT le correctif, payait encore sa
  TVA en trop : il se refait en le marquant périmé (`data.exemple.version`), jamais en regardant un
  jeu fabriqué par l'ancien code.
- **Un crédit nul ne « vient en déduction » de rien** : la phrase de l'onglet TVA, écrite pour un
  crédit, s'affichait avec 0,000 DT. Une phrase qui porte un montant se relit avec ZÉRO — c'est la
  valeur que prend l'exercice en cours de la plupart des entreprises.
- **Reconnaître une écriture à sa FORME, c'est connaître TOUTES ses formes.** Le Cabinet reconnaissait
  l'écriture de déclaration du client (pour ne pas la compter dans ce qu'elle solde) à la seule forme
  du mois qui paie : sur un mois en crédit, de timbre seul, ou d'avoirs plus forts que les ventes,
  elle comptait dans ses propres cases, et « Écrire l'écriture du mois » en proposait une seconde —
  vérifié sur le code d'avant : deux clics, deux DECL-2026-09. C'est la parité étendue aux
  **scénarios synthétiques** (l'exemple ne portait aucun mois en crédit) qui l'a montrée : un
  instrument de parité se braque sur chaque jeu qu'on sait fabriquer, pas sur le seul exemple.
- **Un écran qui LIT au processus principal se relit quand le livre bouge** — la parade de T-24, que la
  clôture, la liasse et la révision portaient et que la déclaration, les biens et l'inventaire
  n'avaient jamais reçue (le jumeau manquant, dans la même application). Une vente validée dans la
  grille n'entrait dans la TVA collectée qu'au changement de dossier. Et une lecture ratée qui remet
  l'écran à « vide » se redemande à chaque dessin : en boucle, un message d'erreur par tour — elle
  se range comme une ERREUR, et l'écran la dit avec son « Réessayer ».
- **Suivre l'écran après la correction trouve le défaut suivant.** Validée à la souris, la déclaration
  de septembre était juste ; une vente de plus saisie ensuite a montré « Écriture du mois passée ✓ »
  au-dessus de « l'écriture de déclaration n'a pas été passée », et plus aucun bouton pour l'écrire.
  **Ce qui manque à une écriture passée se pose en COMPLÉMENT** (`ecritureComplementDeclaration`,
  la règle des à-nouveaux complémentaires de 215g, une deuxième fois) : compte par RÔLE — un
  sous-compte 43671 compte pour 4367 —, en brouillard, et proposé seulement s'il tombe juste ET s'il
  sera reconnu comme une écriture de déclaration (sinon il compterait dans la TVA qu'il solde).
- **Un dépôt se pointe sur les chiffres qu'on recopie.** La déclaration préparée garde ses cases
  (`posee.cases`) ; une pièce saisie après les rend périmées, et « Marquer déposée » aurait figé 190
  quand l'écran montre 285. `ecartDeclaration` les compare, `pointerDeclaration` refuse en nommant
  ce qui a bougé, et le bouton s'éteint par la MÊME fonction (9.4.5). Après le dépôt, rien ne se
  bloque (6.0.0) — le contrôle dit « déposée avec d'autres chiffres » et renvoie à une rectificative.
- **Un contrôle qui ne regarde qu'un compte manque ce qui ne le touche pas** : un achat saisi après
  l'écriture d'un mois qui paie laisse le 4367 soldé et le 4365 faux. Le contrôle `decl-complete`
  regarde ce qui MANQUE, pas un solde. Et la raison d'un solde se dit TELLE QU'ELLE EST : « au
  brouillard » quand c'est le complément qui attend, jamais « un mois précédent n'est pas soldé » —
  trouvé à la souris sur ce geste exact, et prouvé.
- **Un scénario qui pose ce que l'exemple ne porte pas** (`scenarioComplet`) : timbre exonéré, les
  neuf natures de mouvement, casse, consommation, inventaire et ajustement de stock, une cession et une
  mise au rebut, un trop-perçu remboursé, une avance retenue sur les bulletins, une caisse, une OD, un
  achat et une vente en devise — sur deux exercices, confronté aux deux chemins ET au Cabinet. Il est
  passé du premier coup, et ses chiffres ont été refaits À LA MAIN compte par compte (le 12, le 13, le
  4365, le 4366, le 411, le 425…) : un invariant qui passe peut être juste des deux côtés et faux dans
  les deux ; seule la main le dit.
- **Un geste quotidien sans nature se fait par la mauvaise.** Alimenter la caisse depuis la banque
  n'avait aucun geste : « Retrait » passe au compte courant de l'associé (le gérant devait l'argent,
  la caisse ne recevait rien). « Virement entre mes comptes » (`virementVers`) : UN mouvement, deux
  lignes de trésorerie, chacune pointée sur SON relevé (`reconciled` au départ, `reconciledVers` à
  l'arrivée), une écriture compte d'arrivée / compte de départ, aucun effet sur le résultat, et un
  virement dont l'arrivée a disparu n'est qu'une sortie au 471 — le comptable la verra.
- **Une promesse d'une fenêtre se vérifie dans les DEUX chemins.** Supprimer un compte disait « ses
  mouvements basculeront sur le compte par défaut » ; les écritures le faisaient (`journalDeCompte`),
  la Trésorerie gardait l'identifiant disparu et ces lignes ne tombaient plus dans aucun compte.
  `compteDe` résout chaque ligne comme les écritures la résolvent.
- **Un règlement en devise se passe au taux du jour, pas au taux de sa pièce.** Une facture de
  1 100 € émise à 3,35 et encaissée à 3,40 : la banque reçoit 3 740 DT, pas 3 685. SkanFact
  convertissait le règlement au taux de la FACTURE depuis la 1.6.0 — le solde de la Trésorerie ne
  retombait jamais sur le relevé, et l'écart de change n'existait nulle part, ni au résultat ni chez le
  comptable. Un règlement porte `exchangeRate` (proposé : celui de la pièce, donc rien ne bouge pour ce
  qui existe) ; `montantRegle` dit ce que la banque a bougé, `toBase` ce que le tiers voit soldé, et
  `ecartDuReglement` leur différence, passée au 755 ou au 655 dans l'écriture ET dans
  `ecartsDeChange` (donc au résultat simplifié). Ce qui lit la BANQUE lit `montantRegle` (trésorerie,
  encaissé du mois, affaire, journal des encaissements) ; ce qui lit le TIERS garde le taux de la pièce
  (reste dû, lettrage, relevé). La fenêtre annonce en dinars, pendant la frappe, ce qui passe à la
  banque et l'écart ; la ligne du règlement le redit une fois la fenêtre fermée. Le test est calculé à
  la main — 1 000 € à 3,30 réglés à 3,40, un achat à 3,35 réglé à 3,30, un remboursement rendu à 3,40 —
  et la parité avec le Cabinet passe par le paquet (le 755 y part comme n'importe quelle ligne).
- **Un instrument qui lit la bonne fonction trouve le défaut que les écrans cachent.** Le troisième
  scénario (TVA à 13 %, facture annulée, avoir libre…) a d'abord accusé l'instrument : « restes des
  factures − avoirs libres » ne filtrait pas les annulées. Faux diagnostic : il lisait
  `invoiceBalance`, et c'est ELLE qui mentait — 834 DT « dus » sur une facture annulée, pendant que le
  relevé, l'âge des impayés, le lettrage et les écritures l'écartaient chacun par un filtre. Cinq
  lecteurs, quatre filtres, et le cinquième (la page de la facture) affichait la dette en orange. La
  règle vit maintenant dans la fonction (`annulee` → reste 0) ; les filtres restent, ils ne suffisaient
  pas. **Avant de corriger un instrument, vérifier qu'il n'a pas raison.**
- **Un régime qui ne récupère pas la TVA en fait un COÛT, et la règle se fige sur la pièce.** Au
  forfait, SkanFact déduisait quand même la TVA de chaque achat (4366, résultat hors taxes, 401 court
  de la TVA). `tvaRecuperable(p, company)` est rangé sur chaque achat à sa création (et figé par la
  migration pour l'existant, 7.1.x) : changer de régime ne réécrit pas un mois déclaré.
  `tvaNonDeductible` réunit la case de la ligne ET la règle de la pièce — les quatre lecteurs (coût,
  stock, bien proposé, écritures) passent par elle. Un avoir ou un acompte suit la règle de la pièce
  qu'il vise, sinon il retire une TVA que la pièce n'a jamais déduite.
- **Une règle figée doit pouvoir se RÉPARER, et seulement là où rien n'est déclaré.** Quelqu'un qui
  avait laissé « réel » par erreur doit pouvoir corriger — `achatsHorsRegime` ne propose que les mois
  non clôturés, et le bandeau d'une pièce fait la même chose pour elle seule. **L'annonce se calcule
  par la fonction qui déclare** (`vatReturn` avant/après) : la somme des TVA des pièces disait
  2 955,640 DT pour une déclaration qui bougeait de 2 720,040 — elle ignorait ce que l'acompte avait
  déjà déduit.
- **Un taux AFFICHÉ grisé n'est pas un taux choisi — et le formulaire le range quand même.**
  `formValues` lit les champs désactivés : enregistrer les Paramètres au forfait écrasait le taux des
  nouvelles lignes par le 0 % forcé qu'il affichait, et l'assistant faisait pareil. Le jour du passage
  au réel, chaque ligne naissait à 0 % : de la TVA collectée manquante, sur la déclaration, sans un
  mot. `applySettings` jette `defaultVatRate` quand le régime ne facture pas de TVA, l'assistant ne le
  range qu'au réel. Trouvé en REVENANT au réel à la souris après un test au forfait — un aller seul ne
  montrait rien. **Un geste se teste aller ET retour.** Et ce que l'ancien défaut a laissé (un 0 %
  rangé, des articles nés à 0 %) ne se devine pas : les Paramètres le DISENT, au régime et au taux
  CHOISIS (`regimeChoisi`), et proposent le geste — un article vraiment exonéré garde son 0 %.
- **Une valeur forcée pour les ventes n'est pas celle des achats.** Au forfait, le catalogue porte
  0 % (le taux de ses ventes) ; recopié sur un achat, il faisait entrer l'article hors taxes alors
  que le fournisseur facture la TVA. `tauxAchatArticle` propose le taux ordinaire aux trois chemins
  d'un achat tiré du catalogue.
- **Un fait fiscal naît le jour de son FAIT GÉNÉRATEUR, pas le jour de la pièce qui l'annonce.** La
  retenue à la source se retient en PAYANT : SkanFact la déclarait au mois de la facture, y compris
  sur une facture jamais payée (32,130 DT « à reverser » sur l'exemple), et l'annuelle la rangeait à
  l'année de la facture pendant que l'attestation, datée du paiement, disait l'autre. Elle naît au
  règlement (`retenueDesReglements` : au prorata de ce qu'il verse, le règlement qui solde prend le
  reste, un trop-payé ne retient jamais plus que la retenue) ; le 401 porte le BRUT jusque-là, et
  `retenueAOperer` dit l'écart entre le compte et le net qu'on versera. **La règle vit dans
  l'écriture, pas dans l'écran** : c'est le seul contrat entre les deux applications, et le Cabinet,
  qui lit le 4352 là où il naît, a suivi sans une ligne de code — la parité mois par mois le prouve.
  Déplacer la retenue a déplacé ses lecteurs : lettrage fournisseurs en brut, fiche, attestations,
  déclaration annuelle, colonnes des CSV. Un invariant « compte / pièces » écrit en NET est tombé le
  premier — c'est lui qui a dit que le 401 et la fiche ne parlaient plus du même montant.
- **Un plafond ne se prouve que par des données qui l'atteignent** (9.6.1, re-trouvée) : un
  règlement complet tombe exactement sur le net, donc le « règlement qui solde prend le reste » ne
  se voyait pas — c'est un trop-payé (1 200 versés sur 1 172,150 dus) qui fait tomber la preuve.
  Et une preuve restée verte sur un garde-fou DOUBLE dit qu'il faut retirer les deux gardes pour
  retrouver le défaut (7.27.0) : l'attestation d'une facture impayée était protégée deux fois.
- **Un écran dit le chiffre qui s'imprimera** : au forfait, la colonne TVA du catalogue affichait
  19 % pour des articles qui sortent à 0 %. Elle affiche 0 %, le taux de l'article au survol.
- **La règle d'un côté se porte de l'autre, même quand elle est fiscale** (7.3.0) : la retenue
  OPÉRÉE (achats) était passée au règlement, la retenue SUBIE (ventes) restait au mois de la facture —
  les attestations réclamées portaient sur des factures jamais payées, et le 4358 naissait un mois
  trop tôt. `retenueSubie` est le jumeau de `retenueDesReglements`, par le même moteur
  (`retenueChrono`) ; le 411 porte le brut jusqu'au paiement, chaque encaissement le solde de ce
  qu'il verse PLUS la retenue gardée. Et ce qui dépend de la retenue suit, par invariant : compte
  411 = relevé net + `retenueASubir`, lettrage clients idem — c'est l'invariant qui est tombé le
  premier, avant tout écran.
- **Un fait fiscal se régularise à la date de la pièce qui le change, jamais en réécrivant un mois
  déclaré.** Calculée au prorata du net DU, la retenue d'un règlement de mars baissait le jour où un
  avoir de mai diminuait ce net : la déclaration de mars, déposée, ne tombait plus. `retenueChrono`
  rejoue les événements dans l'ordre du temps (avoirs à leur date, acomptes d'origine en tête) : un
  paiement fige sa part, un avoir postérieur porte l'écart dans `ajustements`, à SA date — écriture
  de l'avoir (D 4358 / C 411 ; C 4352 / D 401), déclaration du mois de l'avoir, annuelle comprise.
  Le test regarde MARS après un avoir de mai : une erreur qui se compense sur l'année ne se voit que
  dans le mois (10.14.0, les à-nouveaux).
- **Un règlement de tiers n'est pas un reversement** (Cabinet) : `retenuDuMois` écartait toute
  écriture qui touche la banque, pour ne pas compter le paiement de la retenue à l'État comme une
  retenue. Or un remboursement au client — qui défait une part de sa retenue — touche aussi la
  banque. Ce qui distingue les deux est le TIERS : une écriture de trésorerie qui touche un 40x/41x
  est un règlement, et compte ; sans tiers, c'est l'État. Trouvé par l'instrument de parité, sur un
  scénario de remboursement que l'exemple ne portait pas.
- **Une part au millime se compare arrondie comme l'écriture la pose** : le lettrage sommait des
  parts non arrondies pendant que le journal posait chaque composante arrondie — un millime d'écart
  sur cinq ans. On arrondit composante par composante, comme `entrySet`.
- **Une page de pense-bête qui ne regarde que DEVANT oublie ce qui est passé sans être fait.**
  `upcomingFiscal` prend la prochaine occurrence à partir d'aujourd'hui : la CNSS d'un trimestre
  jamais déposée disparaissait du calendrier le lendemain de sa date limite, alors que `socialDue`
  la savait en retard. `calendrierFiscal` met les retards CONNUS en tête — seulement ceux qu'on sait
  (les bulletins disent qu'une CNSS est due) ; une TVA non pointée a pu être déposée sans être
  pointée, la crier chaque mois serait du bruit (8.0.1).
- **Une date réglable ne s'écrit pas en dur à côté** : la Paie posait le 15 et le 30 avril pendant que
  le calendrier laisse régler le jour — deux écrans, deux dates pour une déclaration.
  `dateLimiteSociale` lit la règle du calendrier ; `cnssDeclaration`, `employerAnnual`, `socialDue`
  et le calendrier passent par elle. Et une valeur qu'on sait calculer ne s'affiche pas « — » : une
  déclaration déposée a son échéance (`dateLimiteDeclarationSociale`).
- **« Rien à signaler » se dit d'une liste VIDE, pas d'une liste filtrée.** La fenêtre « Clôturer
  jusqu'à… » ne gardait que les points bloquants, puis affirmait « Rien à signaler » sur une période qui
  en portait vingt-neuf. Filtrer décide de la COULEUR (l'orange pour ce qui bloque), jamais de ce
  qu'on tait. Et le test de la P4 recopiait le filtre — il gravait la phrase fausse (7.0.1).
- **Une grille de saisie a des colonnes de largeur FIXE** (H-E1, dans une fenêtre comptable) : la
  grille d'une OD en disposition automatique redistribuait ses largeurs dès qu'un intitulé de compte
  paraissait, et Débit/Crédit glissaient de 40 px entre deux frappes. `table-layout: fixed` et une
  largeur par colonne ; ce qui paraît selon une valeur tient dans la place qui existe déjà.

### 10.14.1 — La deuxième vérification (en cours, bêta)

Skander, après la 10.14.0 stable : « tu vas reparcourir toutes les deux applications comme un humain
et revérifier que toutes les données et l'argent sont justes — tu ne t'arrêtes pas tant que les deux
applications contiennent des défauts ». Puis, le 26/09 : la visite qui passe toute seule, « Guide-moi »,
les pièces jointes introuvables, la page blanche des calculs longs. Ce qui suit est écrit au fil des
lots ; le détail de ce qui reste vit dans `A-FAIRE.md` § 0.

- **La règle générale des champs perdait pour la huitième fois : on l'a rendue sans poids** (NUM-01).
  `input:not(…)×4` battait toute règle de conteneur (0,4,1 contre 0,2,1) ; chaque version posait une
  exception de plus, et vingt-six règles écrites depuis la 7.9.0 ne s'étaient jamais appliquées (le
  P.U. d'un achat coupé dès 1 000 DT, les quantités, le mot de passe sous « Afficher », les grilles du
  Cabinet). Elle vit sous `:where()` : n'importe quelle classe la bat. **Quand un défaut revient pour la
  même cause, on corrige la cause, pas l'occurrence** — le correctif structurel coûte un sélecteur, les
  huit correctifs ponctuels coûtaient chacun une capture pour être vus.
- **Un canal d'essai sert la plus récente des deux, bêta ou stable** (S-01). Sur une 13.0.0-beta.1,
  une 14.0.0 stable n'était pas proposée tant que la case « bêta » restait cochée : le relais ne
  cherchait que `beta*.yml`. `indexAServir` compare les deux, `/sante` le dit (`sertStable`). **Une
  case qui ENFERME dans un canal est un piège** (7.25.0 : décocher ramène à la stable ; cocher ne doit
  pas en priver).
- **Un repli sert ce que sert le chemin normal, et il se prouve sur le canal qu'il doit servir**
  (9.8.8, re-trouvée). Corriger le relais laissait deux replis sur l'ancienne règle : le Cabinet
  choisit lui-même sa page GitHub (`releasePourIndexRelue` ne cherchait que l'index d'essai), et la
  console annonçait la bêta qu'un canal ne sert plus. Le Cabinet décide par la JUMELLE de la fonction
  du relais (`src/canaux.js`, corps comparés) ; l'app entreprise, qui laisse electron-updater choisir,
  est prouvée sur le VRAI module avec le canal que pose NOTRE `appliquerCanal` — un test qui imite le
  module aurait prouvé l'imitation.
- **Le canal se pose après le flux dans TOUS les chemins** : `u.channel` prime sur le `channel` passé
  à `setFeedURL`, et le repli qui sert la stable pose `cabinet` — sans `poserCanal` dans le chemin du
  relais, le relais interrogé ensuite demandait l'index STABLE et ne voyait plus la bêta suivante.
  Un état posé par un chemin se repose dans les autres (6.7.3 : et `allowDowngrade` juste après).
- **Des données réelles valent mieux qu'un décor quand elles portent le cas** : les releases
  publiées (10.14.0 stable après 10.13.0-beta.1) étaient EXACTEMENT le scénario de Skander. Le vrai
  relais lancé en local sur elles, et la vraie console branchée dessus, ont montré à l'écran « la
  stable, plus récente que la bêta v10.13.0-beta.1 » — une preuve que le jeu fabriqué ne donnait pas.
  (Piège d'outil : le `fetch` de Node n'emprunte le proxy de la session qu'avec
  `NODE_USE_ENV_PROXY=1`.)
- **Un montant demandé se tient au millime** (ACP-01) : un acompte de 500 DT faisait 501,002 DT, parce
  que le montant devenait un pourcentage puis une ligne, et que le timbre s'y ajoutait. Le montant
  demandé est TTC, cherché base par base ; la facture le dit en toutes lettres. Une conversion
  intermédiaire (montant → pourcentage → montant) est un arrondi de plus, et il se voit sur la pièce.
- **Un bien peut être au bilan sans être au tableau des immobilisations** (C1) : une ligne d'achat
  sans fiche, un bien pas encore en service, un bien en service avant sa facture. La page le montre,
  la clôture le signale, et l'invariant de janvier compare le 22 au tableau.
- **Un achat sans numéro de fournisseur n'a pas d'identifiant interne à montrer** (LET-01). Le
  lettrage, les règlements et le paquet affichaient l'identifiant de la base (« mfq3w2… ») — et au
  Cabinet, deux achats sans numéro du même jour portaient le même « N° » vide : ils ne faisaient
  qu'UNE pièce dans le journal. La référence se DÉDUIT (`SN-AAAAMMJJ[-n]`, comme un statut), passe dans
  la colonne « Pièce » des CSV, et chaque achat redevient une pièce. Sa limite est écrite : supprimer
  un achat sans numéro plus ancien du même jour décale les suivants.
- **Redessiner une page, c'est passer par le routeur** (RESET-01) : « Réinitialiser les filtres »
  appelait `routes.x()` directement — la page revenait sans le bandeau de l'exemple, sans son lien
  d'aide ni ses bandeaux, que le routeur pose APRÈS la route. `vers()` (7.15.0) est la seule porte.
- **Une preuve de ce qui part chez le comptable se retrouve** (S-04) : le nom d'un fichier joint est
  cherché par Ctrl K et par les listes, et chaque ligne qui porte un justificatif montre 📎 — jusqu'au
  Cabinet, où l'écriture reçue ouvre le fichier du paquet.
- **`shell.openPath` ne lève rien : il REND un message** quand aucun programme n'ouvre le fichier
  (OPEN-01). Les deux applications ignoraient ce retour : un clic accepté, rien ne s'ouvre, rien ne se
  dit (7.0.0). Une porte par application (`ouvrirOuMontrer`, jumelles comparées par un test) : le
  fichier est MONTRÉ dans son dossier, et l'écran le dit avec ses mots, jamais le message du système
  (7.26.0). **Deux causes, deux phrases** : une copie disparue du disque ne se règle pas comme un type
  de fichier sans programme.
- **Quand l'environnement ne sait pas produire un cas, on simule le SYSTÈME dans une copie lancée,
  jamais la page.** Ce poste Linux fait croire que tout s'ouvre (`openPath` rend « succès » sans
  aucune visionneuse) : la branche « aucun programme » y était invisible. Une copie de l'application
  lancée par Playwright `_electron` sur un troisième écran (`:97`), avec `shell.openPath` remplacé
  dans le processus principal, a montré le vrai message à l'écran — à la souris, comme les autres.
  Remplacer la fonction dans la page n'aurait rien prouvé : le pont est figé (8.3.0), et c'est le
  processus principal qui décide.
- **Le jumeau manquant, une fois de plus** (7.3.0) : le Cabinet élidait « de » devant un mois depuis sa
  1.0.0 (`de()`), l'app entreprise écrivait « le brouillon de octobre ». `deLibelle` (core.js) a le
  même corps, comparé par un test.
- **Un refus qui renvoie aux Réglages montre la case, une fois le panneau chargé** (REF-01, le
  10.13.0 d'un cran plus loin) : le panneau s'affiche « Chargement… » avant de grandir ; viser la
  case avant la fin de la lecture amène à la case d'au-dessus.
- **La visite guidée ne passe plus toute seule** (S-02, « le guide passe tout seul sans que j'aie
  appuyé sur Suivant ») : seul un GESTE de la personne fait avancer. Un redessin de la page, une zone
  vue puis vidée, un geste déjà fait en entrant n'avancent plus rien — « Déjà fait » attend
  « Suivant ». Et **ce que la bulle nomme se clique** : le voile est un masque PERCÉ (la zone, chaque
  bouton cité « entre guillemets » avec son anneau, chaque contrôle que la liste décrit) ; un bouton
  montré assombri derrière le voile est un bouton qu'on ne peut pas découvrir.
- **Une fin qui AFFIRME un fait le prouve par les données** — un `but` (relevé à chaque tour, il
  termine la visite dès qu'il est atteint) ou une `preuve` (jugée à la fin, pour une visite qui
  explique encore après le geste). « Ta fiche est à jour » d'une fiche jamais enregistrée, « Ta
  facture est émise » d'une facture restée en brouillon : la fin disait ce qu'elle espérait. Une
  visite qui ne fait que montrer dit « Tu sais… ». `finsHonnetes` tient la règle dans les DEUX
  applications, et elle refuse aussi un `but` suivi d'étapes à regarder (elles seraient coupées).
- **Un geste PASSÉ ne se félicite pas, et ce qu'il aurait ouvert se saute avec lui.** « Passer cette
  étape » sur « Émettre la facture » laissait la visite décrire, au milieu de l'écran, un
  récapitulatif qui ne s'était jamais ouvert, puis viser son bouton. Le geste passé se retient (la
  fin le NOMME : « Tu as passé « Émettre » ») et l'étape qui en dépendait (sa cible absente, rien ne
  l'y amènera — ni sa page, ni une préparation) se saute, dans le sens où l'on va
  (`consequenceDuGeste`). Vu à la souris, jamais par un test : un parcours ne passe pas une étape.
- **Ce qu'un geste avait ouvert peut se refermer PENDANT qu'on le regarde** (« Annuler » dans le
  récapitulatif) : l'étape se dit perdue tout de suite — « Ça s'est refermé » — et propose
  « Revenir à « X » », le geste qui l'ouvre (`gesteQuiOuvre`, jamais un facultatif ; on remonte tant
  que la source est elle-même défaite). Le PROPRE geste de l'étape n'est pas une défaite : « Émettre »
  ferme le récapitulatif, et c'est le geste attendu. D'où l'ordre dans `decider` : l'exception avant
  la règle, et `defait` calculé APRÈS la décision « avance » — calculé avant, il disait « perdu » un
  tour trop tôt et la bulle montrait le texte général.
- **Une fin ratée dit l'ÉTAT et le geste qui le fait — jamais une cause qu'elle n'a pas vue.** « La
  fenêtre s'est fermée sans « Émettre » » était faux quand on avait passé le geste qui l'ouvre ;
  « La facture n'est pas émise — c'est « Émettre », dans le récapitulatif, qui la numérote » est vrai
  dans tous les cas. La règle se lit sur le contenu des deux applications (`finsHonnetes().causes`) :
  « peut-être » laisse une cause possible, l'affirmer non. Et la phrase générale se tait quand un geste
  a été passé : la cause vient d'être dite.
- **Ce qu'une visite demande à son contexte, l'application le prête — clé par clé.** Trois visites
  neuves demandaient `ctx.premier('factureRetard')`, `'achatDu'`, `'moisACloturer'` : une clé que
  `premierObjet` ne connaît pas rend `null`, et la visite ne se lance JAMAIS, sans une erreur ni un
  test qui tombe. Un test lit chaque `ctx.X` des deux fichiers de visites contre ce que chaque
  application passe à `parcours`, chaque clé de `premier` contre les `case` de `premierObjet`, chaque
  sorte de dossier du Cabinet contre ce que `dossierPour` JUGE (pas contre son repli sur la vitrine,
  qui répond à tout), et chaque entrée de menu visée par sa clé (`[data-act="…"]`, posée par
  `rowmenu.js` depuis `cle`) contre un menu qui la pose. Une visite qui dit « Clique sur « Relancer
  par email » » éclaire CETTE entrée, pas la troisième du menu.
- **Une question que la visite traverse s'éclaire sur le bouton qu'elle demande de cliquer**
  (« Continuer quand même », `#b`), pas sur son titre : l'anneau sur un titre fait chercher où cliquer.
- **Deux champs empilés dans une fenêtre sans grille se touchaient** (0 px entre « Nom » et « Rôle ») :
  `.modal > * + .field` ; et **un TEXTE long se lit mal en gras** — une zone de texte d'un formulaire
  reprend la graisse de la lecture (le message d'une relance, dix lignes en 600).
- Piège de preuve, **la troisième fois** (10.0.0, 9.6.1) : la preuve de la règle « un `but` ne coupe
  pas d'étapes » est restée VERTE — la visite choisie n'avait aucune étape après son geste, donc le
  défaut ne pouvait rien y couper. Refaite sur une visite qui en a une, elle tombe. **Une preuve se
  pose sur des données où le défaut a quelque chose à abîmer.**
- Pièges de méthode re-rencontrés : un bandeau « Première fois sur cet écran ? » qu'on ferme fait
  REMONTER tout ce qui suit — on remesure avant le clic suivant (q-rect), sinon le clic tombe une
  ligne plus haut ; un objet créé dans un `vm` a un autre prototype, on compare par aller-retour JSON ;
  et une assertion de `cabassistant.js` qui recopiait la forme d'un appel est tombée sur du code juste
  — retournée vers la règle (le renvoi montre la case du nom AVANT d'enregistrer).
- **« Guide-moi » remplace « Comprendre cette page → »** (S-03, « un bouton avec la liste de toutes
  les actions qu'on peut faire sur cette page, afin que l'assistant soit toujours à portée de main »).
  Le lien n'ouvrait qu'un article à LIRE ; le bouton ouvre ce qu'on peut FAIRE ici. Un seul moteur
  pour les deux applications (`Visite.guideDeLaPage`, `Visite.menuDuGuide`, `Visite.dansLeGuide`,
  purs) : chacune ne prête que ses visites, la clé de ses pages et l'onglet ouvert. **Ce qui parle de
  LA page vient d'abord** (sa visite, puis son article) : l'article en bas d'une liste de sept gestes
  finissait hors de l'écran.
- **Un geste ne se propose que là où il se fera, par la MÊME règle que celle qui choisit sa cible**
  (`surLaPage`) : sur un brouillon de facture, « Émettre », pas « Facturer ce devis » ; sur le dossier
  de Béji, jamais une visite qui partirait dans le garage. La cible (`ctx.premier`, `ctx.dossier`)
  prend la pièce ou le dossier ouverts quand ils conviennent — deux règles séparées auraient proposé
  un geste qui part ailleurs. Une règle qui LÈVE ne cache rien : un geste proposé en trop vaut mieux
  qu'un geste perdu.
- **Un bouton d'en-tête qui n'existe que sur un onglet s'atteint en ouvrant cet onglet** : « Déclarer
  un salarié » était proposé sur l'onglet Congés, où « + Salarié » n'existe pas — la bulle attendait
  un bouton absent. Le geste déclare son onglet (`avant: onglet(…)`), et un test lit les boutons de
  chaque onglet dans l'application (`P_ACTION`, `ST_ACTION`), jamais dans une table recopiée.
- **L'article suit l'onglet ouvert** (`PAR_ONGLET`, `articleDeLaPage` — les deux applications) :
  « Tes données : sauvegarder et protéger » était proposé sur l'onglet « Mon entreprise ». Un onglet
  absent de la table garde l'article de la page ; chaque onglet nommé est confronté à sa barre.
- **Une visite en pause se reprend depuis « Guide-moi », à son étape** (`pointDeReprise`, le calcul de
  « Me guider ») : le menu la recommençait au début pendant que « Me guider » proposait de la
  reprendre. Et la pause ne nomme « Guide-moi » que si « Guide-moi » la propose (`dansLeGuide`) : la
  découverte n'y est pas. **Deux portes vers la même chose disent la même chose** (6.8.1).
- **Un menu s'ouvre vers la page** (`RowMenu.placerMenu`, pur) : « Guide-moi » de la fiche d'un
  dossier s'ouvrait par-dessus la barre latérale. Un bouton de la moitié gauche ancre le menu sur son
  bord gauche, un bouton de la moitié droite sur son bord droit ; dessous s'il tient, sinon dessus.
- **« Première fois sur cette page ? » ne pousse plus l'écran de travail** : c'était une bande sous
  l'en-tête (la grille de saisie commençait 90 px plus bas pendant les trois premières ouvertures) ;
  elle s'accroche à « Guide-moi », par-dessus la page, et dit où la visite se retrouve.
- **`npm test` s'arrête au premier test rouge — le suivant attend derrière.** Quatre tests qui
  recopiaient une forme sont tombés l'un après l'autre, chaque correction révélant le suivant : on
  relance jusqu'au vert, jamais « c'était le seul ». Trois retournés vers la règle (39e à 41e : la
  table d'articles lue par `articleDeLaPage`, `bouton` qui fait PARTIE de l'export, une tranche bornée
  sur la ligne qu'elle juge au lieu de 2 500 caractères en dur — 9.4.6) ; le quatrième se répare dans
  le code (le thème reposé en tête de `render()`, avant ce qui s'y est ajouté). Et le test des
  variables CSS apprend `style.setProperty('--x')` : la flèche de l'invitation est posée par le code.
- **Une explication se lit une fois ; ensuite, un RAPPEL** (`e2e:cabinet-jour1`, la grille de saisie
  à 573 px sur un portable pour un seuil de 480). La 10.14.0 avait posé le bandeau de l'exemple sur
  CHAQUE page — à raison — mais avec sa phrase entière : trois lignes, 87 px, en tête de chaque écran
  de travail. Il s'explique sur la page d'accueil de chaque application (Accueil, Dossiers) et se
  rappelle ailleurs sur une ligne, ses deux portes gardées, la phrase entière au survol
  (`htmlBandeauDemo`, la même décision des deux côtés). **Un composant posé partout se dessine pour
  l'écran où il coûte le plus, pas pour celui où on l'a écrit.**
- **Le nom d'une fiche et ses gestes partagent UNE rangée ; ce qui DÉCRIT le dossier va dessous, sur
  toute la largeur** (`.fiche-dossier`, `.d-meta`). Empilés sous le nom, l'identité et l'état
  élargissaient le bloc du titre à la largeur de leur ligne la plus longue : à 1280 px les gestes
  passaient sur une seconde rangée (126 px d'en-tête), selon le client ouvert — le Café le faisait, le
  garage non. Le titre part d'une largeur nulle (`flex: 1 1 0`), donc les gestes ne bougent jamais ;
  c'est le nom qui passe à la ligne. Mesuré sur les huit dossiers de l'exemple : 61 à 103 px.
- **Une action seule dans un tableau dense porte son mot court, partout où elle naît** (10.12.0,
  re-trouvée) : « Voir dans le paquet » (170 px, colonne collante) recouvrait le Crédit du
  livre-journal lu dans les paquets, 23 px à 1280. « Paquet », la phrase entière au survol — et le
  tableau tient sans défiler de côté. Vu sur la capture prise pour autre chose.
- **Une phrase qui envoie chercher un fichier le trouve d'abord** : « Commence par la page de garde »
  au-dessus d'une liste de neuf fichiers sans page de garde (les paquets de l'exemple sont fabriqués
  sans imprimante). La phrase se conditionne à la présence de `00-page-de-garde.pdf` (7.3.0).
- **Le vert d'un panneau secondaire s'allume au premier changement, jamais au repos** (U-11) : sur le
  Suivi d'un dossier, « Relancer » en haut et « Enregistrer les droits » en bas étaient verts ensemble.
  Le mécanisme existait déjà pour les Réglages (`data-enreg`, `sale`, `flash`) — il n'avait pas été
  porté au panneau des droits, qui n'apparaît qu'une fois des collaborateurs déclarés : aucun des
  instruments, qui tournent sans équipe, ne pouvait le voir. Et le « ✓ enregistré » se pose APRÈS le
  redessin : posé avant, il partait avec l'ancien panneau, et on ne l'avait jamais vu.
- **Ce qu'on pose AVANT un calcul synchrone ne se voit pas** (S-06) : le navigateur ne peint qu'une
  fois le fil principal rendu. « Chargement… » se pose, une image se peint (`requestAnimationFrame`
  puis `setTimeout`), et seulement alors on dessine ; le voile apparaît par une animation RETARDÉE
  d'opacité, que le compositeur joue même pendant que le calcul bloque — une page rapide ne le montre
  jamais. Deux filets : une fenêtre cachée n'appelle pas `requestAnimationFrame` (on dessine tout de
  suite), et un minuteur dessine si l'image ne vient pas. Vu à la souris en rendant un dessin lent
  (`SkanCore.enLot` enveloppé par CDP pour trois secondes) — la seule façon honnête de le voir.
- **Une animation d'entrée est `backwards`, jamais `both`** : une transformation laissée en place
  fait du contenu le bloc de référence de tout ce qui y est en `position: fixed`. Et la classe qui
  l'arme se RETIRE après coup, sinon chaque redessin complet de la même page rejoue l'entrée.
- **Une valeur retenue « dernière vue » ne recule jamais** : la carte des nouveautés retenait la
  version qui tourne, et la sortie de la bêta (une version plus ancienne) lui faisait oublier ce
  qu'on avait lu — la carte se remontrait à la mise à jour suivante. Trouvé à la souris, au
  redémarrage ; on retient la plus récente des deux.
- **Une tranche de test bornée sur un VOISIN tombe quand on insère du code entre les deux** (10.4.0,
  re-rencontrée deux fois ici) : `demoSortie` jusqu'à `render(keepScroll)` a avalé le chargement posé
  entre elles. Bornée sur la fin de la fonction ; et l'assertion « remise en haut avant `render()` »
  retournée vers la règle, quel que soit le nom de la porte (42e).
- **Une cible de visite qui n'existe pas se SAUTE en silence** : « Son salaire brut » visait `gross`
  (le champ du bulletin) dans la fiche du salarié, qui porte `grossSalary` — l'étape n'avait jamais
  été montrée à personne, et « L'aperçu » visait un `#pv-col` qui n'a jamais existé. Aucun parcours ne
  le voit : un moteur qui saute une cible absente est fait pour ne rien dire. Le test lit chaque
  identifiant de chaque cible contre les sources de SON application, et chaque champ de fenêtre contre
  le formulaire que la visite OUVRE (`FORMULAIRE`) — un nom qui existe ailleurs dans le fichier ne
  prouve rien. Une cible est une liste d'ALTERNATIVES : on juge le groupe, pas chaque chaîne.
- **Un champ que l'enregistrement refuse vide porte son étoile** (7.20.0, portée à quatorze fenêtres) :
  la règle se lit sur la condition (`if (!v.x) return refus`), le test reconnaît les quatre formes qui
  posent la classe, et une date passe `obligatoire` à `dateFieldHtml` — dont le libellé reste un
  élément (`lbl`), sinon l'étoile ne s'affiche pas (8.1.0).
- **Le client décide de la langue et de la devise, même quand il n'a pas de réglage propre** : un
  client sans réglage prend ceux de la SOCIÉTÉ, jamais ceux du client d'avant. Choisir un client en
  euros puis un client ordinaire laissait la pièce en anglais et en euros — vu à la souris dans la
  visite du devis, invisible à un parcours qui choisit un seul client. Et le taux se VIDE quand la
  devise change : un taux d'une autre devise est un chiffre faux.
- **Une visite qui choisit un client guide ce que ce choix fait apparaître** (`etapeTaux`, avec `si`) :
  le champ du taux paraît avec un client en devise, et la visite passait à côté — l'enregistrement
  refusait ensuite une case que personne n'avait montrée.
- **Déposer sans ressaisir commence par copier juste** (DECL D1, question de Skander du 26/09 : « le
  comptable transfère à l'État ? »). SkanFact ne dépose rien (5.2.0) ; il rend chaque montant de la
  déclaration mensuelle COPIABLE, dans la forme que le portail attend — et **cette forme est un
  réglage** (point, virgule, millimes) : le guide DGI dit « point décimal », mais un format officiel
  change, et une forme écrite en dur ferait rejeter une déclaration le jour de l'échéance.
  `montantPortail` compte en millimes entiers (jamais `toFixed` sur un flottant), et un test le joue
  sur les négatifs et les arrondis. **La date limite d'une déclaration se lit par la règle des
  Échéances** (`dateLimiteDeclaration`, confrontée item par item à `echeances()` — mensuelle,
  trimestrielle et CNSS) : deux écrans, deux dates pour la même déclaration, c'est le défaut de la
  Paie de la 10.14.0 (`dateLimiteSociale`) qui revenait. Les formulaires officiels reçus (mensuelle
  2026, déclaration d'employeur 2025, IS 2025, cahiers CNSS) ne se commitent pas : ils vivent chez
  Skander, et `A-FAIRE.md` § 0.3 dit ce qu'on en a tiré et ce qui manque encore.

- **Une case copiée tombe sur une case du formulaire, dans son ordre** (D1bis) : l'écran de
  déclaration du Cabinet range les cases du moteur dans les rubriques de l'imprimé 2026
  (`formulaireMensuel`, rangé au processus principal — l'écran ne recalcule rien). **Un document
  officiel tranche un « À VÉRIFIER »** : la retenue sur salaires (lignes 1 et 3), la TFP et le
  FOPROLOS figurent sur la même déclaration que la TVA, donc dans son total ; ce que l'écriture du
  mois porte au 4365 ne change pas. **Une répartition ne se fait que si elle refait le compte** :
  IRPP et contribution sociale se séparent sur les bulletins seulement quand leur somme égale le
  4321. Et une preuve est restée verte parce que le montant de la TFP était lui-même inconnu dans le
  jeu du test — une base inventée n'avait aucun montant sur lequel se poser (des données qui ne
  discriminent pas, 10.0.0). Piège d'écran : mettre en minuscule la première lettre d'un libellé
  casse un sigle (« fOPROLOS ») — seulement si la deuxième lettre est déjà minuscule.

- **Un fichier officiel se fabrique par UN moteur, et il ne sort pas faux** (D2, le fichier CNSS du
  trimestre, format DS 2012 : 122 caractères, 12 lignes par page, millimes, CRLF). `compta.fichierCnss`
  sert le Cabinet (depuis le livre) et l'app entreprise (depuis ses bulletins) : deux fabricants
  auraient deux formats. **Aucun fichier tant qu'une ligne est fausse**, chaque refus nomme le
  salarié, la case et le geste ; un trimestre EN COURS ne se déclare pas (règle de « Marquer
  déposée »). **Une invite qui souffle une forme doit l'accepter** : « Prénom, prénom du père, nom »
  invitait à taper des virgules, que le fichier refusait ensuite comme « pas en lettres latines » —
  vu en tapant, jamais par un test qui pose une valeur propre. La virgule SÉPARE (elle devient une
  espace), et **un refus nomme ce qui ne passe pas** (« contient « 2 » »), par la MÊME phrase dans la
  fiche et dans le fichier (`motifIdentiteCnss`). **Ce que le fichier refuserait se refuse à la
  saisie**, où on peut le corriger : le découvrir le jour de déclarer, c'est rouvrir la fiche sous
  l'échéance. Et **un lien ouvre ce qu'il annonce** : « 1 déclaration sociale à déposer : CNSS 2e
  trimestre » ouvrait le 3e, éteint.

## Pistes pour la suite (non demandées)

- Séparation des installateurs arm64 / x64 pour diviser par deux les 222 Mo du dmg universel.
- Signature Apple et Windows (certificats payants) : supprimerait les avertissements au premier lancement et permettrait d'utiliser Squirrel sur Mac.
- Export TEIF si l'e-facture devient obligatoire.
