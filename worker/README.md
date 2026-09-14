# Le relais de mise à jour

Un tout petit service qui se met entre les applications installées et le dépôt privé. Il détient le
jeton GitHub ; les applications ne l'ont jamais. Résultat : **personne ne peut télécharger SkanFact
sans le secret de l'application**, et le code source n'est jamais exposé.

Il ne stocke rien : ni compte, ni base de données, ni donnée d'entreprise. Il ne voit passer que des
noms de fichiers et, quand une licence est présentée, le nom qui y est inscrit.

## Ce que ça coûte

Rien. Le forfait gratuit de Cloudflare couvre 100 000 requêtes par jour ; une mise à jour, c'est
deux ou trois requêtes par poste et par version.

## L'installer — 10 minutes, sans terminal

1. **Crée un compte** sur [cloudflare.com](https://dash.cloudflare.com/sign-up) (gratuit, pas de
   carte bancaire).
2. Dans le tableau de bord : **Workers & Pages** → **Create** → **Start with Hello World!** →
   **Deploy**. Donne-lui un nom, par exemple `skanfact-maj`.
3. Clique sur **Edit code**. Efface tout ce qu'il y a, et colle le contenu du fichier
   [`skanfact-maj.mjs`](./skanfact-maj.mjs). **Deploy**.
4. **Fabrique d'abord le jeton GitHub** (recette juste en dessous), puis reviens ici : onglet
   **Settings** → **Variables and Secrets**. Il faut **quatre** entrées. Attention, la colonne de
   droite décrit **ce qu'il faut aller chercher**, ce n'est pas un texte à recopier :

   | Nom | Type | Ce qu'on met dedans |
   |---|---|---|
   | `GITHUB_TOKEN` | Secret | le jeton fabriqué ci-dessous — il commence par `github_pat_` |
   | `APP_SECRET` | Secret | une longue suite de caractères au hasard (40 environ), à garder de côté |
   | `GITHUB_OWNER` | Texte | `saouthq` |
   | `GITHUB_REPO` | Texte | `skanfact` |

5. Note l'adresse du service, du genre `https://skanfact-maj.ton-compte.workers.dev`.

> **Le jour où le dépôt redevient privé.** Le relais continue de fonctionner **à l'identique** :
> c'est justement à ça qu'il sert, il détient le jeton et les applications ne présentent rien.
> Une seule chose à vérifier ce jour-là — que le `GITHUB_TOKEN` ci-dessus ait bien accès au dépôt
> privé (droit **Contents : Read-only** sur `saouthq/skanfact`). Sur un dépôt public, un jeton même
> sans droits suffit à lire les releases : la panne ne se verrait donc qu'au moment de la bascule,
> et elle couperait les mises à jour de tout le monde d'un coup.
>
> Dans l'application, la bascule est **une seule ligne** : `private` dans `src/depot.js`. Les deux
> applications la lisent, le champ « jeton d'accès » revient tout seul dans leurs Paramètres, et les
> phrases affichées redeviennent vraies.

### Les deux variables facultatives (pas tout de suite)

| Nom | Type | Ce qu'on met dedans |
|---|---|---|
| `LICENCE_PUBLIC_KEY` | Texte | le champ `publicKey` de `build/licence-public.json` |
| `LICENCE_REQUISE` | Texte | `1` pour refuser les mises à jour à qui n'a pas de licence valide |

Elles n'ont de sens qu'une fois la licence **armée** : `build/licence-public.json` n'existe pas tant
que `node scripts/licence.js --keygen` n'a pas été lancé, et l'application est livrée désarmée
exprès. Tant qu'il n'y a pas de clé publique ici, une licence présentée est **refusée** (« aucune
clé publique configurée ») : mieux vaut donc ne rien mettre que mettre une des deux à moitié.

Et `LICENCE_REQUISE = 1` ne concerne **que** l'application entreprise. L'application du cabinet est
gratuite, elle n'a pas de licence et n'en aura jamais : son canal est exempté dans le code, sinon
le jour où tu armes la licence tous les comptables perdraient leurs mises à jour d'un coup.

### Le jeton GitHub

Sur GitHub : **Settings** (ton profil, pas le dépôt) → **Developer settings** → **Personal access
tokens** → **Fine-grained tokens** → **Generate new token**.

- Repository access : **Only select repositories** → `saouthq/skanfact`
- Permissions → Repository permissions → **Contents : Read-only**
- Expiration : la plus longue possible (note la date : le jour où il expire, les mises à jour
  s'arrêtent, et il faudra le remplacer dans Cloudflare)

C'est le seul jeton qui existe, et il ne quitte jamais Cloudflare.

## Le brancher aux applications

Sur GitHub, dans le dépôt `skanfact` : **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Deux secrets :

| Nom | Valeur |
|---|---|
| `UPDATE_BASE` | l'adresse du relais, sans barre oblique finale |
| `UPDATE_SECRET` | **exactement** la même phrase que `APP_SECRET` dans Cloudflare |

À la prochaine publication, les deux applications sont construites avec ces réglages et passent par
le relais. **Tant que ces secrets n'existent pas, rien ne change** : les applications continuent de
fonctionner comme aujourd'hui, avec le jeton saisi à la main dans les réglages.

## Le piège de la bascule

Les applications **déjà installées** cherchent leurs mises à jour directement sur GitHub. Elles ne
passeront par le relais qu'**après** avoir installé une version construite avec ces réglages. Donc :

1. publie une version **avec** les secrets en place ;
2. installe-la à la main sur les postes existants (une dernière fois) ;
3. à partir de là, tout passe par le relais.

## Vérifier que ça marche

Ouvre l'adresse du relais dans un navigateur, par exemple
`https://skanfact-maj.…/app/latest-mac.yml`. Tu dois voir **« Accès refusé. »** — c'est le bon
résultat : sans le secret de l'application, personne n'entre. C'est exactement ce que tu voulais.

Dans Cloudflare, **Workers → ton service → Logs** montre en direct qui met à jour et vers quelle
version.

## Ce qu'il protège, et ce qu'il ne protège pas

- ✅ Un inconnu ne peut rien télécharger : il n'a ni l'adresse ni le secret.
- ✅ Ton code source n'est jamais servi : le relais ne connaît que les fichiers d'installation.
- ✅ Une licence inventée est refusée — la signature est vérifiée ici aussi.
- ⚠️ Quelqu'un qui a déjà l'application peut l'ouvrir et y trouver le secret. Pour l'en empêcher
  vraiment, il faut armer la licence puis mettre `LICENCE_REQUISE = 1` : là, seule une licence
  signée par toi ouvre la porte (côté entreprise ; le cabinet reste gratuit et continue de se
  mettre à jour). À faire le jour où tous tes clients en ont une.
- ⚠️ Si le relais tombe, les mises à jour s'arrêtent — mais les applications continuent de
  fonctionner, et on peut toujours télécharger les fichiers à la main depuis GitHub.

---

# Le formulaire de contact du site (route `/contact`)

Le même worker sert aussi le formulaire de **skanfact-site**. Rien de nouveau à héberger : une
route de plus sur le service déjà déployé.

## Pourquoi ici, et pas chez un service de formulaires

Le site promet, sur chaque page, que rien ne part chez un tiers. Un formulaire hébergé ailleurs
ferait exactement le contraire, sur la page même où l'on demande à quelqu'un de nous faire
confiance. Ce relais ne stocke rien : il reçoit le message, le remet, et l'oublie.

## Ce qu'il faut ajouter

Trois variables dans **Workers → ton service → Settings → Variables** :

| Nom | Type | Valeur |
|---|---|---|
| `RESEND_KEY` | **Secret** | la clé d'API [Resend](https://resend.com) (gratuit jusqu'à 3 000 messages par mois) |
| `CONTACT_TO` | Variable | l'adresse qui reçoit, par exemple `contact@skanfact.tn` |
| `CONTACT_FROM` | Variable | l'expéditeur, par exemple `SkanFact <site@skanfact.tn>` — le domaine doit être vérifié chez Resend |

Une quatrième, facultative : `CONTACT_ORIGINES`, pour autoriser une adresse de plus (séparées par
des virgules). `saouthq.github.io` et `skanfact.tn` sont déjà dans le code.

## Et la ligne à remplir dans le site

Dans **`assets/site.js`** du dépôt du site :

```js
var RELAIS_CONTACT = '';     // ← l'adresse du relais, suivie de /contact
```

Par exemple `https://skanfact-maj.toncompte.workers.dev/contact`.

**Tant que cette ligne est vide, le formulaire fonctionne quand même** : il repasse par le logiciel
de messagerie du visiteur, et le dit. Même chose si le relais répond mal ou trop lentement (douze
secondes). **On ne perd jamais un message parce qu'un service est en panne** — c'est la règle du
repli, apprise en 6.7.2 : un chemin de secours ne sert que s'il se déclenche tout seul.

## Ce qui le protège

Ce chemin **n'a pas de secret, et ne peut pas en avoir** : un formulaire public ne peut pas porter
un secret, puisqu'il faudrait l'écrire dans une page publique. Ce qui le protège :

- **l'origine** : seules `saouthq.github.io` et `skanfact.tn` peuvent poster. Sans cette porte,
  n'importe quelle page du web posterait dans la boîte depuis le navigateur de ses visiteurs ;
- **un piège à robots** : un champ que la feuille de style range hors de l'écran et qu'aucun humain
  ne voit. Rempli, on répond « reçu » et **on n'envoie rien** — lui dire qu'il a été repéré lui
  apprendrait à contourner ;
- **des tailles bornées** : tout ce qui vient du dehors est sans limite jusqu'à ce qu'on en pose une.

Ce qui décide (`origineAutorisee`, `contactValide`, `contactCourriel`) est pur et vérifié par
`npm test`, sans réseau.

## Vérifier

```bash
curl -i -X POST https://ton-relais.workers.dev/contact \
  -H 'Origin: https://skanfact.tn' -H 'Content-Type: application/json' \
  -d '{"nom":"Essai","email":"toi@exemple.tn","message":"Ceci est un essai du formulaire."}'
```

`{"ok":true}` et le message arrive. Sans l'en-tête `Origin`, tu dois recevoir **404** : c'est le
bon résultat.
