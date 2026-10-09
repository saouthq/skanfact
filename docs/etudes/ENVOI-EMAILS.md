# Envoyer les e-mails de SkanFact : quel service ?

*Étude du 09/10/2026, demandée par Skander : « compare les [services hébergés en Tunisie] avec Resend ».
Les prix et les offres ont été relevés le 09/10/2026, souvent sur des sites tiers : ils se revérifient
avant de signer. Ce qui touche à la loi est **À VÉRIFIER** avec un juriste.*

## En bref (pour Skander)

**Décidé par Skander le 09/10/2026 : Resend pour le serveur d'essai** (« je suis d'accord pour resend oui »). Le
branchement se fait d'une ligne, dans la console du serveur : `exploitation/courriel.sh` du dépôt
`skanfact-plateforme` (son `docs/mise-en-ligne.md`, H). Le relais du lancement reste à faire en Tunisie.

- **Pour le serveur d'essai, tout de suite : Resend.** Gratuit, dix minutes de réglage, aucune
  ligne de code : notre serveur parle déjà la langue des relais d'e-mails (SMTP). Cela débloque
  le mot de passe oublié, le code de la création du compte et celui d'un nouvel appareil. Une seule
  condition : seulement des adresses de testeurs d'accord, jamais celle d'un vrai client.
- **Pour le lancement : notre propre relais, sur notre serveur en Tunisie.** Rien ne sort de chez
  nous, il n'y a rien à demander à l'INPDP pour ce flux, et il est gratuit. Mais une adresse neuve
  arrive parfois dans les « indésirables » : on la règle et on la mesure des semaines avant
  l'ouverture.
- **Si notre relais arrive trop souvent dans les indésirables : Brevo (en Europe)**, avec
  l'autorisation de l'INPDP. Resend reste possible, mais ses données sont aux États-Unis, ce qui
  rend l'autorisation plus difficile (À VÉRIFIER).
- **Je n'ai trouvé aucun service « tout prêt » comme Resend dont les serveurs sont annoncés en
  Tunisie.** Les plateformes tunisiennes d'e-mailing visent les campagnes publicitaires et ne disent
  pas où sont leurs serveurs.

## 1. Ce qu'on envoie

- **Les e-mails du compte** :
  - le code de la création du compte ;
  - le code d'un appareil inconnu ;
  - le lien du mot de passe oublié ;
  - « le code du téléphone a été désactivé » ;
  - plus tard, l'alerte « tu as un nouveau message » de la messagerie avec le comptable.
- **Ce qui part chez le service** (compté et décidé : `docs/cadrage/03-droits.md` § 6) :
  - l'adresse de la personne ;
  - l'objet ;
  - un texte qui ne porte que le code ou le lien.

  Ni son nom, ni son entreprise, ni rien de ses données.
- **Le volume est faible** :
  - quelques centaines d'e-mails par mois pendant les essais ;
  - quelques milliers par mois au lancement (estimation, à reprendre avec le nombre d'entreprises).
- **Rien à programmer pour changer de service.** Le serveur envoie déjà par SMTP
  (`skanfact-plateforme/serveur/courriel.ts`). Tout service qui offre le SMTP se branche avec deux
  lignes dans les réglages du serveur (`/etc/skanfact/serveur.env`), et on peut en changer plus
  tard de la même façon.

## 2. Ce que dit la loi (Rapporté, À VÉRIFIER avec un juriste)

- **Une adresse e-mail est une donnée personnelle** (loi organique 2004-63).
- **L'envoyer à un service à l'étranger, c'est un transfert.** Il faut l'**autorisation de
  l'INPDP** (art. 52), et un pays qui protège assez les données (art. 51). Un cabinet tunisien
  (Boussayen Knani & Associés) estime qu'un transfert vers l'Union européenne ne devrait pas poser de
  difficulté majeure. Il cite aussi la sanction de l'art. 90 : un an de prison et 5 000 DT
  d'amende.
- **Le cadrage l'a déjà retenu** (`05` § 4.3) : chaque flux qui sort est **en Tunisie, ou déclaré
  et autorisé**. La décision d'hébergement du 27/09/2026 veut le fournisseur d'e-mails en Tunisie
  (`03` § 6).
- **À poser au juriste** : l'e-mail arrive ensuite dans la boîte du destinataire, souvent Gmail ou
  Outlook, donc à l'étranger. C'est la boîte qu'il a choisie. Ce qui nous engage est le service que
  **nous** choisissons pour envoyer. Est-ce bien ainsi que l'INPDP le voit ?
- **Le serveur d'essai** est déjà en France (VPS OVH), avec des données inventées. Un relais hors de
  Tunisie pendant les essais ne change pas sa situation, tant que seuls des testeurs d'accord y
  mettent leur adresse.

## 3. Les candidats

| Service | Où vont les adresses | Prix | Mise en place | Arrivée en boîte de réception | La loi |
|---|---|---|---|---|---|
| **Resend** (États-Unis) | **États-Unis**. On peut faire partir les e-mails d'Irlande, mais les données du compte (adresses, journaux, traces des envois) restent aux États-Unis : leur propre documentation le dit | Gratuit jusqu'à 3 000 e-mails par mois (100 par jour) ; 20 $ par mois pour 50 000 | Dix minutes ; SMTP prêt (`smtp.resend.com`, ports 465 ou 587) | Très bonne : c'est leur métier | Autorisation de l'INPDP pour les États-Unis : la plus difficile à obtenir (À VÉRIFIER) |
| **Brevo** (France) | **Union européenne** : France, Allemagne, Belgique, selon leur aide. Un tiers signale au moins un sous-traitant américain | Gratuit jusqu'à 300 e-mails par jour ; environ 9 $ par mois ensuite | Trente minutes ; SMTP prêt | Très bonne | Autorisation de l'INPDP, plus simple vers l'Europe |
| **Notre propre relais**, sur notre serveur en Tunisie (EO Data Center au lancement) | **Tunisie, chez nous** | Gratuit (compris dans le serveur) | Une demi-journée de mon côté. Chez l'hébergeur : ouvrir l'envoi d'e-mails (port 25) et poser le nom inverse de l'adresse (« reverse DNS ») | **Incertaine au début** : une adresse neuve n'a pas de réputation, il faut la « réchauffer ». Gmail demande depuis 2024 une signature (DKIM ou SPF) et un nom inverse valide | Rien à demander pour ce flux : rien ne sort |
| **Le relais d'un hébergeur tunisien** (Hodi annonce un « relais SMTP sortant inclus » avec ses serveurs, à Ben Arous et Mannouba) | Tunisie (à confirmer par écrit) | Compris avec le serveur | Une heure | Inconnue : l'adresse d'envoi est partagée avec ses autres clients | Rien à demander, si c'est bien en Tunisie |
| **Une boîte professionnelle chez un hébergeur tunisien** (Oxahost, « serveurs dans notre datacenter de Tunis » ; Tunisie Telecom, Hosted Exchange ; ATLAX) | Tunisie (annoncé) | Par boîte, à demander | Trente minutes | Moyenne. Le nombre d'envois permis par heure n'est pas publié, et ces boîtes ne sont pas faites pour une application | Rien à demander, si c'est bien en Tunisie |
| **Les plateformes tunisiennes d'e-mailing** (Mailveo, Express Mailing, emarketing.tn, WinSMS) | Pas dit sur leurs pages | Sur devis | ? | ? | Faites pour les campagnes. À interroger si on veut les comparer |

**Un piège à éviter** : un hébergeur en « .tn » n'héberge pas forcément en Tunisie. NovaHoster, par
exemple, annonce ses sites en France et ses serveurs en Allemagne.

## 4. La recommandation, pas à pas

1. **Maintenant, pour le serveur d'essai : Resend.** Ce que fait Skander, guidé écran par écran :
   - créer le compte ;
   - ajouter le domaine `skanfact.tn` ;
   - recopier dans Cloudflare les lignes que Resend affiche (SPF, DKIM) ;
   - créer une clé « envoi seulement » ;
   - coller une ligne dans la console OVH. Elle demande la clé sans l'afficher, l'écrit dans les
     réglages du serveur, redémarre SkanFact et envoie un e-mail d'essai.

   **Claude ne voit jamais la clé** (règle du projet) : elle va directement de Resend au serveur.
2. **Pour le lancement : notre relais en Tunisie**, sur notre serveur. Il signe chaque e-mail
   (DKIM), avec SPF et DMARC dans la zone `skanfact.tn` et le nom inverse posé par l'hébergeur. Il
   s'essaie **des semaines avant l'ouverture** sur des boîtes Gmail, Outlook, Yahoo et Topnet : on
   compte combien arrivent en boîte de réception, avec un seuil écrit d'avance.
3. **En secours : Brevo**, si le seuil n'est pas atteint. L'autorisation de l'INPDP se demande avec
   la déclaration (démarche du père de Skander).

## 5. Questions à poser

- **À EO Data Center** (notre site principal) :
  - l'envoi d'e-mails (port 25 sortant) est-il ouvert ?
  - posent-ils le nom inverse de notre adresse ?
  - proposent-ils un relais à eux, et où est-il ?
- **À Hodi et Oxahost** (si on veut un relais tunisien déjà fait) :
  - où est le serveur d'envoi, exactement ?
  - combien d'e-mails par heure et par jour ?
  - l'adresse d'envoi est-elle partagée ?
  - peut-on signer avec notre domaine (DKIM) ?
- **Au juriste** :
  - le transfert d'une adresse et d'un code vers l'Europe ou les États-Unis ;
  - la question de la boîte du destinataire (§ 2).

## Sources

- Resend, régions d'envoi et lieu des données : https://www.resend.com/docs/dashboard/domains/regions.md
- Resend, réglages SMTP : https://resend.com/docs/send-with-smtp
- Resend, prix (sites tiers) : https://costbench.com/software/email-api/resend/ ;
  https://www.usecarly.com/blog/resend-pricing/
- Brevo, lieu des données : https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location
- Brevo, prix (site tiers) : https://dreamlit.ai/blog/brevo-review
- Sous-traitants de Brevo (avis d'un tiers) : https://scan.meetergo.com/en/vendors/brevo-sending
- Loi 2004-63, art. 51, 52 et 90 (Boussayen Knani & Associés) :
  https://bkassocies.tn/en/practical-guide-application-of-tunisian-legislation-on-personal-data-protection/
- EO Data Center : https://www.eodatacenter.com/
- Hodi (serveurs en Tunisie, relais sortant) : https://hodi.host/tn/serveur-dedie/
- Oxahost, e-mail professionnel : https://www.oxahost.tn/email/email-professionnel-pro
- Tunisie Telecom, Hosted Exchange (2018) :
  https://www.kapitalis.com/archive/186-kapital/7480-tunisie-telecom-lance-la-solution-de-messagerie-hosted-exchange
- NovaHoster (hébergement en France et en Allemagne) : https://www.novahoster.tn/
- Plateformes tunisiennes d'e-mailing : https://mailveo.tn/ ; https://expressmailing.tn/ ;
  https://emarketing.tn/plateforme-emailing/
