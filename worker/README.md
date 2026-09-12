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
4. Onglet **Settings** → **Variables and Secrets**. Ajoute **quatre** entrées :

   | Nom | Type | Valeur |
   |---|---|---|
   | `GITHUB_TOKEN` | Secret | un jeton GitHub en **lecture seule** sur le dépôt `skanfact` (voir plus bas) |
   | `APP_SECRET` | Secret | une longue phrase au hasard, que tu inventes — 40 caractères, à garder |
   | `GITHUB_OWNER` | Texte | `saouthq` |
   | `GITHUB_REPO` | Texte | `skanfact` |

   Facultatif, pour plus tard :

   | Nom | Type | Valeur |
   |---|---|---|
   | `LICENCE_PUBLIC_KEY` | Texte | le contenu de `build/licence-public.json` (le champ `publicKey`) |
   | `LICENCE_REQUISE` | Texte | `1` pour refuser les mises à jour sans licence valide |

5. Note l'adresse du service, du genre `https://skanfact-maj.ton-compte.workers.dev`.

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
  vraiment, il faut mettre `LICENCE_REQUISE = 1` : là, seule une licence signée par toi ouvre la
  porte. À faire le jour où tous tes clients en ont une.
- ⚠️ Si le relais tombe, les mises à jour s'arrêtent — mais les applications continuent de
  fonctionner, et on peut toujours télécharger les fichiers à la main depuis GitHub.
