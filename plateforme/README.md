# Le plan de contrôle — mode d'emploi

Tout se fait depuis le site de Cloudflare, **sans terminal**. Même principe que `worker/README.md`,
qui porte déjà le relais de mise à jour : c'est le même compte, tu n'as rien de nouveau à créer.

> **Rien de ce qui suit n'est urgent.** Tant que ce worker n'est pas déployé, les applications
> fonctionnent exactement comme aujourd'hui. Elles ne lui parlent qu'à partir de la 8.4.0, et même
> alors, son absence ne bloque rien (voir « Ce qui se passe si tu ne fais rien » plus bas).

---

## Ce que ce worker fait

Une application cliente lui présente sa clé de licence et son ordinateur. Il enregistre
l'activation et répond ce qu'il sait de cette licence : **active**, **révoquée** ou **expirée**.

Il ne voit passer aucune donnée d'entreprise — pas un client, pas une facture, pas un montant.
Seulement la clé (qui porte le nom et le matricule de l'acheteur, c'est le contrat de vente),
l'identifiant de l'ordinateur, son nom, la plateforme et le numéro de version.

---

## 1. Créer la base

Dans le tableau de bord Cloudflare : **Storage & Databases → D1 → Create database**.

- Nom : `skanfact`

Une fois créée, onglet **Console**.

> ⚠️ **Colle le TEXTE des instructions, pas le nom d'un fichier.** Taper `plateforme/schema.sql`
> dans ce champ donne `near "plateforme": syntax error` — la console attend du SQL, elle ne sait
> pas ouvrir un fichier de ton dépôt.

Le fichier à utiliser est **`plateforme/schema-a-coller.sql`**, et pas `schema.sql` : il porte les
mêmes instructions **sans aucun commentaire, une par ligne**. La raison est un piège réel — le champ
de la console D1 est sur **une seule ligne**. Un texte multiligne collé dedans voit ses retours à la
ligne écrasés, et le premier `--` met alors en commentaire **tout le reste** : tu croirais avoir
créé six tables, tu en aurais créé une, et **aucune erreur ne s'afficherait**.

Essaie d'abord de tout coller d'un coup. Si la console refuse, colle les **12 lignes une par une** :
chacune est une instruction complète et se termine par `;`.

Pour vérifier, tape `/tables` : tu dois voir `clients`, `licences`, `activations`, `ventes`,
`jetons`, `evenements`.

C'est gratuit jusqu'à 5 Go et 5 millions de lectures par jour — très loin devant ce dont tu as
besoin.

*(`schema.sql` reste la source commentée, celle qui explique pourquoi chaque table est faite ainsi.
`schema-a-coller.sql` en est engendré par `node scripts/plateforme-sql.js`, qui l'exécute dans un
vrai SQLite avant de l'écrire ; un test vérifie que les deux ne divergent pas.)*

## 2. Créer le worker

**Workers & Pages → Create → Worker**.

- Nom : `skanfact-api`

Colle le contenu de `plateforme/skanfact-api.mjs`, puis **Deploy**.

Tu obtiens une adresse en `https://skanfact-api.<ton-compte>.workers.dev`. **Elle suffit** — le
domaine `skanfact.tn` viendra se poser dessus plus tard, sans rien changer d'autre.

## 3. Brancher la base sur le worker

Dans le worker : **Settings → Bindings → Add → D1 database**.

| Variable | Base |
|---|---|
| `DB` | `skanfact` |

Le nom `DB` compte : c'est celui que le code attend.

## 4. Poser les réglages

Toujours dans **Settings → Variables and Secrets**. Les trois se posent en **Secret**, pas en
variable de texte : un secret ne se relit plus une fois écrit, même par toi.

| Nom | Ce que c'est |
|---|---|
| `APP_SECRET` | **le même** que celui du relais de mise à jour. C'est ce que l'application présente pour prouver qu'elle est bien SkanFact. |
| `LICENCE_PUBLIC_KEYS` | les clés publiques qui vérifient les licences (voir plus bas) |
| `REPONSE_PRIVATE_KEY` | la clé privée qui **signe les réponses** du serveur |
| `ADMIN_SECRET` | **ton** mot de passe pour ouvrir la console |

### `ADMIN_SECRET`

Au moins **24 caractères**, tirés au hasard — pas une phrase que tu inventes. Un secret plus court
est refusé à la configuration : la console affiche « mal réglée » au lieu de s'ouvrir. C'est
volontaire, parce qu'une console qu'on croit fermée et qui s'ouvre en devinant « skanfact » est pire
qu'une console sans mot de passe : on ne s'en méfie pas.

Range-le dans ton gestionnaire de mots de passe. Il n'y a aucun moyen de le retrouver — Cloudflare
ne le montre plus une fois posé ; en cas de perte, tu en poses un nouveau, c'est tout.

### `LICENCE_PUBLIC_KEYS`

Un tableau JSON. Au début, une seule entrée — ta clé maître, celle de la 8.0.0 :

```json
[{"kid":"master","publicKey":"-----BEGIN PUBLIC KEY-----\nMCowBQYDK2Vw...\n-----END PUBLIC KEY-----\n"}]
```

C'est exactement le contenu de `build/licence-public.json` du dépôt, mis dans ce format.

> ⚠️ **`\n` et pas de vrais retours à la ligne.** Un JSON sur plusieurs lignes est refusé, et le
> worker répondra « mal réglé » (503) au lieu de tomber en panne — mais il ne vérifiera rien.

### `REPONSE_PRIVATE_KEY`

Une clé Ed25519 **différente de celle des licences**. Elle ne signe que les réponses du serveur, et
sa compromission ne permettrait jamais de fabriquer une licence.

Tant qu'elle n'est pas posée, le worker répond quand même — **sans signature**. L'application
ignore alors toute réponse qui RESTREINT (c'est sa garantie) et continue de fonctionner
normalement. Rien ne casse : simplement, une révocation ne s'applique pas encore.

**Où la fabriquer :** dans SkanFact, sur ton Mac — jamais ailleurs, et surtout pas dans une
conversation. Paramètres → L'application → Éditeur → **« Créer la clé de réponse »**. Elle est
écrite à côté de ta clé de signature, dans `~/.skanfact/`, et deux boutons apparaissent :

- **« Copier la clé privée (pour le service) »** → c'est elle qui se colle ici, dans
  `REPONSE_PRIVATE_KEY`. Vide ton presse-papiers ensuite.
- **« Copier la clé publique (pour la version) »** → celle-là se colle dans la conversation qui
  prépare la version suivante : elle va dans `build/licences-publiques.json`, champ `reponse`.

Les deux gestes peuvent se faire dans n'importe quel ordre, et tant que la publique n'est pas
publiée avec une version, **aucune révocation ne mord**. Le panneau de l'éditeur l'écrit noir sur
blanc plutôt que de laisser croire que ça marche déjà.

## 5. Vérifier que ça répond

Onglet **Logs** du worker, puis dans un navigateur (ou avec le testeur HTTP de Cloudflare) :

```
POST https://skanfact-api.<ton-compte>.workers.dev/v1/licence/etat
En-tête : X-SkanFact-App: <ton APP_SECRET>
Corps   : {"cle":"SKAN1.…une vraie clé…","deviceId":"essai-0001-0002-0003"}
```

Ce que tu dois voir :

| Réponse | Ce que ça veut dire |
|---|---|
| `{"etat":"active",…}` | ✅ tout marche |
| `403 Accès refusé` | le `APP_SECRET` ne correspond pas (attention aux espaces en fin de copier-coller — c'était la panne de la 6.7.2) |
| `503 Plateforme mal réglée` | `LICENCE_PUBLIC_KEYS` est absent ou illisible |
| `{"etat":"inconnue"}` | la clé ne se vérifie avec aucune clé publique configurée |

Et dans la table `activations` de la base, une ligne doit être apparue.

## 6. Ouvrir la console

Va simplement sur `https://skanfact-api.<ton-compte>.workers.dev/` dans un navigateur.

**Elle est servie par le worker lui-même** : rien d'autre à déployer, aucune seconde adresse à
retenir, aucun réglage de domaine croisé. Colle ton `ADMIN_SECRET` et tu es dedans.

Ce que tu y vois : les essais en cours, les licences actives, expirées et révoquées, les
ordinateurs qui se sont annoncés, les clients et les ventes. Quatre onglets, et des chiffres qui
viennent tous de la base — aucun n'est estimé.

Le secret reste dans **cet onglet de navigateur** et disparaît quand tu le fermes. Sur un poste
partagé, c'est la différence entre « il faut le retaper » et « la console de l'éditeur est restée
ouverte toute la nuit ».

> **Elle est en lecture seule pour l'instant**, et elle le dit en haut de l'écran. Émettre une
> licence, révoquer et facturer arrivent à l'étape suivante. Aucun bouton n'est affiché pour ces
> gestes : un bouton qui ne fait rien est pire qu'un bouton absent — la règle vient de la 7.0.0, où
> treize boutons « Voir » avalaient le clic en silence.

---

## Côté application : les deux secrets du dépôt (8.4.0)

L'application ne parle au plan de contrôle que si la version publiée porte son adresse et son
secret. Même mécanisme que le relais de mise à jour : deux **secrets du dépôt GitHub**, posés dans
le paquet à la construction, jamais dans le code.

| Secret du dépôt | Valeur |
|---|---|
| `PLATEFORME_BASE` | `https://api.skanfact.tn` — le domaine personnalisé du worker, jamais l'adresse `workers.dev` : elle est gravée dans chaque paquet installé (voir `DNS-skanfact-tn.md`) |
| `PLATEFORME_SECRET` | le même `APP_SECRET` que ci-dessus |

Settings → Secrets and variables → Actions → New repository secret, exactement comme `UPDATE_BASE`.
Non définis, l'application ne contacte aucun serveur et **rien** n'en dépend — c'est l'état par
défaut, et c'est un état parfaitement valable.

---

## Ce qui se passe si tu ne fais rien

Rien ne casse, jamais. C'est écrit dans le code et tenu par des tests :

- **Secrets du dépôt absents** → l'application ne contacte personne, aucune activation n'est
  visible, et tout fonctionne.
- **Worker pas déployé** → l'application n'a personne à qui parler, elle fonctionne.
- **Base pas branchée** → le worker répond « active » à toute licence bien signée.
- **Réglages absents** → il le DIT (503) au lieu de refuser (403). Refuser couperait chaque client
  qui a payé, et c'est précisément ce qui est arrivé au relais en 8.0.0.
- **Tu arrêtes de payer Cloudflare, ou tu disparais** → les applications installées continuent de
  fonctionner, indéfiniment. La clé signée se suffit à elle-même.

---

## Les deux choses à ne jamais faire

1. **Ne jamais mettre la clé privée des LICENCES sur ce serveur.** Elle vit hors ligne, sur ta clé
   USB. C'est `REPONSE_PRIVATE_KEY` qui va ici, et elle ne sait rien faire d'autre que signer des
   réponses. Voir `PLAN-PLATEFORME.md` § 4.
2. **Ne jamais retirer `master` de `LICENCE_PUBLIC_KEYS`.** Toutes les licences vendues depuis la
   8.0.0 ont été signées par elle et ne portent aucun `kid` : la retirer les invaliderait toutes,
   d'un coup, le même matin.

---

## Les tests

Les décisions du worker sont pures et testées par `npm test`, sans réseau et sans base — même
méthode que le relais. Les six règles qu'elles tiennent :

| Ce qui est prouvé | Pourquoi ça compte |
|---|---|
| une clé sans `kid` reste vérifiée par la maître | sinon la mise en service coupe toutes les licences déjà vendues |
| une clé retirée cesse de valoir | c'est ainsi qu'on sort une clé compromise du jeu |
| ce que la base ignore reste **actif** | la signature est la source de vérité, la base ne fait qu'ajouter une révocation |
| un champ douteux est mis de côté, jamais refusé | un nom d'ordinateur bizarre ne doit pas empêcher quelqu'un d'apprendre que sa licence est active |
| la réponse est signée, datée et liée à SA licence | sinon on répond « révoquée » à la place du serveur, ou on rejoue une vieille réponse |
| le schéma ne porte aucun statut écrit à la main | un statut se déduit ; écrit à la main, il finit par mentir |
| la console refuse un secret trop court, et le dit | une console qu'on croit fermée est pire qu'une console sans mot de passe |
| la console n'a ni bouton mort ni requête vers l'extérieur | le défaut de la 7.0.0, et le secret ne doit sortir nulle part |
| les chiffres s'accordent (« 1 licence », jamais « 1 licence(s) ») | c'est le premier écran que l'éditeur regarde tous les matins |

Chacune a été prouvée en réintroduisant son défaut et en vérifiant que le test tombe.

Et la console s'ouvre **pour de vrai** dans un navigateur : `npm run e2e:console` (neuf étapes, un
faux serveur imite le worker — aucun Cloudflare nécessaire). C'est lui qui attrape ce qu'aucune
lecture de code ne montre : un bouton inerte, une exception dans un gabarit, un écran blanc.

Depuis la 8.4.0, `npm run e2e:plateforme` fait mieux : il pose **ce worker-ci**, tel quel, derrière
un serveur local et lance **l'application réelle** en face. Huit étapes — une clé sans `kid`, une
révocation signée qui ferme la création et laisse la lecture ouverte, la même avec un octet
retouché, la même rejouée trois mois plus tard, le serveur éteint, une installation qui n'a jamais
vu le réseau. Une imitation écrite à côté du vrai finirait par en diverger, et c'est très exactement
la divergence qu'on cherche à attraper.
