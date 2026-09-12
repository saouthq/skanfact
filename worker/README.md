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
