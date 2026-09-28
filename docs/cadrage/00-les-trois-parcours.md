# 00 — Les trois parcours : l'entreprise, le comptable, Skander

*Proposé le 28/09/2026, à la question de Skander : « Je suis comptable, comment j'accède à l'app ?
Je suis une entreprise, comment j'y accède ? Je suis Skander, comment je gère tout ? » **Validé par
Skander le 28/09/2026.** C'est la vue d'ensemble que les autres documents du cadrage détaillent.*

## Les adresses

| Adresse | Pour qui | Ce qu'on y fait |
|---|---|---|
| `skanfact.tn` | Tout le monde | Le site : présentation, tarifs, inscription, aide, page d'état |
| `app.skanfact.tn` | Entreprises **et** comptables | **La même application pour tous.** Ce qu'on voit dépend de qui on est |
| `console.skanfact.tn` | Skander et son équipe, **personne d'autre** | Gérer les clients, les abonnements, le support, le service |

Il n'y a **qu'un seul compte par personne** (une adresse e-mail). Une même personne peut gérer sa
société **et** travailler dans un cabinet : elle passe de l'une à l'autre par le menu en haut, sans
se reconnecter.

**Trois façons d'ouvrir l'application, pour les mêmes données** :
1. dans un **navigateur**, depuis n'importe quel ordinateur ;
2. **installée** depuis le navigateur (une icône sur le bureau ou sur le téléphone), et elle
   continue de marcher pendant une coupure (liste exacte : vision § 4.5) ;
3. l'**application de bureau**, pour qui a une caisse (imprimante de tickets, tiroir, douchette) ou
   signe avec une clé USB.

---

## 1. Je suis une entreprise

**Le premier jour**
1. Sur `skanfact.tn`, je clique « Essayer SkanFact ». Je donne mon e-mail, un mot de passe et mon
   téléphone (le code de connexion peut y arriver).
2. J'arrive sur la **porte** : « Découvrir avec un exemple » ou « Commencer avec mon entreprise ».
   Pour commencer, trois questions seulement : raison sociale, matricule fiscal, activité.
3. « Tes premiers pas » me guide ensuite, au moment où chaque chose sert : mon logo, mon RIB, mon
   premier client, mon premier devis, mon comptable. Chaque écran a sa visite guidée (« Guide-moi »).
4. Si je viens de l'application actuelle, d'Excel ou d'un autre logiciel : « Reprendre mes données »
   (document 08).

**Tous les jours**
- J'ouvre `app.skanfact.tn` (ou l'icône installée) : mes devis, factures, achats, stock, caisse,
  paie, banque, selon les modules que j'ai.
- Une facture émise est signée (DigiGo : un code sur mon téléphone) et envoyée à la TTN par le
  serveur. Je vois la référence et le QR code sur la facture.
- Pendant une coupure, la caisse et les devis continuent. Tout repart au retour du réseau.

**Mon équipe**
- J'invite mes employés par leur e-mail, avec un rôle (vendeur, caisse, comptabilité interne,
  gérant). Chacun ne voit que ce que son rôle permet (document 03). Par exemple, le vendeur ne voit
  pas les salaires.
- Si j'ai **plusieurs sociétés** (un groupe), elles sont toutes sous mon compte et je passe de l'une
  à l'autre en haut de l'écran.

**Mon comptable**
- Menu « Mon comptable » : je tape le **code cabinet** que mon comptable m'a donné, ou son e-mail.
- Le cabinet accepte, et il voit mes pièces **au moment où je les crée**. Il n'y a plus de paquet
  à envoyer chaque mois.
- Ses questions s'affichent **en face de la pièce** qu'elles visent ; je réponds au même endroit.
- Je peux arrêter le mandat à tout moment. Son travail reste, signé de son nom (document 01 § 4).

**Payer mon abonnement**
- Par carte ou portefeuille électronique (Konnect), ou par virement. Je reçois une **facture
  électronique** de SkanFact.
- Il n'y a pas de prélèvement automatique en Tunisie : je suis prévenu avant l'échéance. Si je ne
  paie pas, je passe en **lecture seule** : je vois et j'exporte tout, je ne crée plus. Mes données
  ne sont jamais prises en otage.

---

## 2. Je suis comptable

**Le premier jour**
1. Sur `skanfact.tn`, je clique « Je suis comptable ». Je crée mon compte et mon **cabinet** (nom,
   matricule, adresse). Mon cabinet reçoit son **code cabinet** (par exemple `CAB-7F3K`), que je
   donne à mes clients.
2. J'invite mes collaborateurs, chacun avec son rôle (saisie, révision, supervision).
3. J'arrive sur mon **portefeuille** : la liste de mes dossiers, ce qui manque, ce qui est en retard,
   les échéances fiscales de tous mes clients.

**Deux façons d'avoir un dossier**
- **Mon client est déjà sur SkanFact** : il m'invite ou j'accepte sa demande. Son dossier apparaît
  dans mon portefeuille, avec ses pièces en direct. Ses écritures arrivent en brouillard : je les
  vérifie, je corrige un compte si besoin, je valide.
- **Mon client n'est pas sur SkanFact** : je crée son dossier moi-même et je tiens sa comptabilité
  (saisie, relevés bancaires, paie, déclarations). Plus tard, je peux l'**inviter à rejoindre** son
  dossier : il y trouvera tout ce que j'ai fait, et je garde mon mandat.

**Dans un dossier**
- Saisie au clavier, banque et rapprochement, lettrage, déclarations (TVA, retenues, CNSS, employeur)
  avec les montants à copier sur le portail, paie, immobilisations, révision, clôture, liasse.
- Mes questions au client se posent sur la pièce. Il les voit, il répond, je suis prévenu.
- J'affecte chaque dossier à un collaborateur ; chacun voit les siens, le superviseur voit tout.

**Ce que je paie** : rien pour les dossiers de mes clients abonnés ni pour trois dossiers que je
tiens moi-même ; au-delà, 60 DT par dossier et par an, jamais plus de 1 990 DT par an
(`07-offres-et-prix.md`).

---

## 3. Je suis Skander : comment je gère tout

**Où** : `console.skanfact.tn`. Une adresse à part, une connexion à part, et le **code de
connexion sur le téléphone obligatoire**. Ton père et, plus tard, une personne du support y ont
chacun leur compte et leur rôle. Chaque geste y est enregistré.

**Chaque matin, le tableau de bord te dit :**
- les nouvelles inscriptions et les essais qui se terminent ;
- les paiements reçus, les abonnements à renouveler, les impayés ;
- les demandes de support en attente ;
- l'état du service : serveurs, sauvegardes, factures refusées par la TTN, envois CNSS en échec,
  incidents.

**Les clients**
- Une fiche par client : ses entreprises, son abonnement, ses modules, ses factures, ses paiements,
  ses échanges avec le support, son cabinet parrain.
- Tes gestes : prolonger un essai, offrir un mois, ajouter un module, passer en lecture seule,
  réactiver, résilier, rembourser. Chacun demande une confirmation et laisse une trace.

**La facturation se fait toute seule**
- À chaque renouvellement, la plateforme émet la facture **au nom de ta société SkanFact**, la signe,
  l'envoie à la TTN et l'envoie au client.
- Le paiement Konnect est reconnu automatiquement ; un virement se pointe en un clic ; les relances
  partent à la bonne date.
- **Ta société SkanFact est elle-même une entreprise de la plateforme.** Tu tiens sa gestion dans
  `app.skanfact.tn`, comme n'importe quel client, et ton comptable la voit par son mandat. Ce que tu
  vends est facturé et comptabilisé par le même moteur que tes clients.

**Le support**
- Une demande arrive par e-mail ou WhatsApp et se range sur la fiche du client.
- Pour regarder le dossier d'un client, tu lui **demandes l'accès**. Il accepte depuis son
  application. Tu vois son dossier **en lecture seule**, pendant une durée limitée, et chaque page
  lue est enregistrée. Sans son accord, tu ne vois rien. C'est ce qui rend la plateforme digne de
  confiance, et c'est ce que tu pourras écrire dans les conditions de vente.

**Les réglages de la plateforme**
- Les **offres, modules et prix** (datés : un changement de prix ne touche jamais un abonnement déjà
  payé).
- Les **règles fiscales** de chaque loi de finances : on les ajoute avec leur date d'effet et leur
  texte de loi, idéalement vérifiées par un comptable (document 01 § 3).
- Les **messages** aux clients : nouveautés, maintenance prévue, incident.

**Ce que tu n'as jamais à faire**
- Installer quoi que ce soit chez un client : une mise à jour du serveur arrive chez tout le monde
  en même temps, et l'écran présente les nouveautés.
- Envoyer une clé de licence : l'abonnement est sur le serveur.
- Restaurer une sauvegarde à la main : la restauration est vérifiée **chaque mois**, et une alerte
  te prévient sur ton téléphone si quelque chose tombe.

---

## Les décisions du 28/09/2026

*Prises par Claude, **par délégation de Skander** (« je te laisse me donner ton avis et décider à ma
place »). Révisables après les entretiens terrain.*

**1. Essai, prix, cabinet** : voir `07-offres-et-prix.md`. En une ligne : essai de 30 jours tout
ouvert ; Essentiel 390 DT/an, Complet 690 DT/an ; le cabinet est gratuit pour ses clients abonnés et
pour trois dossiers qu'il tient lui-même, puis 60 DT par dossier, plafonné à 1 990 DT par an.

**2. Le code de connexion sur le téléphone**
- **Obligatoire** pour : l'équipe SkanFact (console), **tous les comptables** (ils ouvrent les
  dossiers de plusieurs entreprises), le **propriétaire** et les **administrateurs** d'une entreprise,
  et quiconque a accès à la **paie**.
- **Proposé, pas imposé** pour les autres (vendeur, caissier, magasinier).
- **Comment** : un code par **SMS** par défaut (c'est ce que les banques tunisiennes ont habitué tout
  le monde à faire), ou une application d'authentification pour qui préfère. Le code n'est demandé
  **qu'à la première connexion d'un appareil**, puis tous les 30 jours : un appareil reconnu ne
  redemande rien.
- **À la caisse** : un caissier change de session avec un **code à 4 chiffres** sur un poste déjà
  reconnu. Taper un mot de passe entre deux clients ne se ferait pas.

**3. Les rôles (le détail geste par geste ira dans le document 03)**

| Dans une entreprise | Ce qu'il fait |
|---|---|
| Propriétaire | Tout, y compris l'abonnement et le choix du comptable. Un seul, transférable |
| Administrateur | Tout, sauf l'abonnement |
| Commercial | Devis, factures, clients, relances. Ni achats, ni paie, ni banque |
| Caissier | La caisse de son établissement, et rien d'autre |
| Magasinier | Le stock, les réceptions, les inventaires |
| Comptabilité interne | Achats, banque, déclarations, écritures. Pas la paie |
| Paie | Salariés, bulletins, déclarations sociales |
| Lecture | Tout voir, rien changer (un associé, un banquier) |

Chaque rôle peut être **limité à un ou plusieurs établissements**.

| Dans un cabinet | Ce qu'il fait |
|---|---|
| Associé (superviseur) | Tous les dossiers, l'équipe, l'abonnement du cabinet ; valide et clôture |
| Collaborateur | Ses dossiers : saisie, révision, validation, déclarations |
| Assistant de saisie | Ses dossiers : saisit, ne valide pas |
| Paie | Ses dossiers : la paie et les déclarations sociales |

Ce sont les trois rôles du Cabinet actuel (saisie, révision, supervision, 9.9.0), plus la paie.

**4. Comment une entreprise trouve son comptable** : **pas d'annuaire public au lancement.** Chaque
cabinet a un **code cabinet** court (par exemple `CAB-7F3K`) qu'il donne à ses clients ; l'entreprise
le tape, ou tape l'e-mail du cabinet. C'est plus simple que le fichier d'appairage d'aujourd'hui, et
ça ne fait pas de publicité pour un cabinet. **À VÉRIFIER** avec l'Ordre des experts-comptables : ce
qu'un annuaire aurait le droit de montrer. S'il est permis, il viendra plus tard, et seuls les
cabinets qui le demandent y paraîtront.

**5. Les utilisateurs de l'application actuelle (v10)**
- **Rien n'est forcé.** L'application actuelle continue de marcher, hors ligne, jusqu'à la fin de sa
  licence.
- Un bouton « **Passer à la plateforme** » envoie, avec l'accord de l'utilisateur, son fichier de
  données vers le serveur, qui crée son entreprise **avec tout son historique** (le détail : document 08).
- **Le temps de licence qui reste devient du temps d'abonnement.** Personne ne paie deux fois.
  (Au 28/09/2026, personne ne paie encore l'application actuelle : `08` § 4.)
- Même chose pour SkanFact Cabinet : dossiers, livres et paquets reçus sont repris.

**6. Les écrans de la console** : ils suivent le parcours du § 3 ci-dessus, et seront dessinés dans
le document 10.
