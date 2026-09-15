# `skanfact.tn` — la zone DNS, et son déménagement vers Cloudflare

Relevé fait le **15/09/2026**, depuis le panneau OVH (Web Cloud → Noms de domaine → skanfact.tn →
Zone DNS), **avant** tout changement. 31 enregistrements.

**Pourquoi ce fichier existe :** un déménagement de DNS ne casse rien de visible. Le site tombe et on
le voit tout de suite ; le **mail**, lui, cesse d'arriver *sans erreur et sans rebond* — on ne
l'apprend que le jour où un client dit « je t'ai écrit ». Le seul filet possible est un inventaire
pris avant, auquel on compare après. Il vit ici plutôt que dans une conversation, parce qu'une
conversation s'efface.

Rien de secret là-dedans : le DNS est public par construction, une clé DKIM est une clé **publique**,
et un jeton de vérification Google ne donne aucun droit. Aucun secret ne doit jamais entrer ici.

---

## L'inventaire d'avant (OVH, 15/09/2026)

### Le site — GitHub Pages (9)

| Sous-domaine | Type | Cible |
|---|---|---|
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `@` | AAAA | `2606:50c0:8000::153` |
| `@` | AAAA | `2606:50c0:8001::153` |
| `@` | AAAA | `2606:50c0:8002::153` |
| `@` | AAAA | `2606:50c0:8003::153` |
| `www` | CNAME | `saouthq.github.io.` |

### Le mail OVH / Zimbra (13) — **la famille à ne pas perdre**

| Sous-domaine | Type | Cible |
|---|---|---|
| `@` | MX | `1 mx1.mail.ovh.net.` |
| `@` | MX | `5 mx2.mail.ovh.net.` |
| `@` | MX | `100 mx3.mail.ovh.net.` |
| `@` | SPF | `v=spf1 include:mx.ovh.com -all` |
| `_dmarc` | TXT | `v=DMARC1; p=none;` |
| `_autodiscover._tcp` | SRV | `0 0 443 mailconfig.ovh.net.` |
| `_imaps._tcp` | SRV | `0 0 993 ssl0.ovh.net.` |
| `_submission._tcp` | SRV | `0 0 465 ssl0.ovh.net.` |
| `autoconfig` | CNAME | `mailconfig.ovh.net.` |
| `autodiscover` | CNAME | `mailconfig.ovh.net.` |
| `imap` | CNAME | `ssl0.ovh.net.` |
| `mail` | CNAME | `ssl0.ovh.net.` |
| `pop3` | CNAME | `ssl0.ovh.net.` |
| `smtp` | CNAME | `ssl0.ovh.net.` |

> Le type **SPF** (RR type 99) est propre à OVH et **déprécié** (RFC 7208). Chez Cloudflare il se
> recrée en **TXT**, avec exactement la même valeur. Un SPF perdu ne casse pas la réception — il fait
> tomber les mails **envoyés** dans les indésirables, ce qui est encore plus difficile à diagnostiquer.

### Resend — l'envoi depuis `send.skanfact.tn` (3)

| Sous-domaine | Type | Cible |
|---|---|---|
| `resend._domainkey.send` | TXT | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDAg7b7le/JOtMvRRXBzbT…` **(valeur longue, tronquée à l'affichage OVH — à reprendre depuis le tableau de bord Resend, jamais recopiée à l'œil)** |
| `rsend.send` | CNAME | `rsend-euw1.forge.rmta.net.` |
| `send.send` | CNAME | `send.forge.rmta.net.` |

> C'est le chemin par lequel P 0.2 enverra les clés de licence. Après la bascule, **rouvrir Resend et
> vérifier que le domaine est toujours « verified »** : une clé DKIM mal recopiée ne fait rien
> échouer, elle fait juste finir les mails en indésirables.

### Divers (2, plus 2 à ne pas reprendre)

| Sous-domaine | Type | Cible | À reprendre ? |
|---|---|---|---|
| `@` | TXT | `google-site-verification=m_PTWq3x7E3G84wlXo3o7uNbTsseSEOaqK7mPL4MoG8` | **oui** — la perdre déverifie la Search Console |
| `@` | TXT | `1\|www.skanfact.tn` | non — marqueur interne d'OVH, sans effet ailleurs |
| `ftp` | CNAME | `skanfact.tn.` | non — hérité d'un hébergement OVH inutilisé |
| `@` | NS | `dns1.tn.ovh.net.` · `ns1.tn.ovh.net.` | **non** — ce sont eux qu'on remplace |

---

## La bascule, dans l'ordre

1. **Ajouter `skanfact.tn` dans Cloudflare** (plan *Free*). Cloudflare scanne la zone OVH et importe
   ce qu'il trouve — c'est le chemin le plus sûr, il interroge les serveurs qui font autorité.
2. **Comparer ligne à ligne avec l'inventaire ci-dessus.** Le scan de Cloudflare ne peut pas deviner
   un sélecteur DKIM arbitraire : `resend._domainkey.send` est le candidat le plus probable à
   l'oubli. Ce qui manque s'ajoute à la main.
3. **Tout en « DNS only » (nuage GRIS).** Voir ci-dessous.
4. **Changer les serveurs de noms chez OVH** (onglet « Serveurs DNS ») pour les deux que Cloudflare
   donne. C'est le seul geste irréversible en apparence — il ne l'est pas : remettre
   `dns1.tn.ovh.net` et `ns1.tn.ovh.net` rétablit tout, **la zone OVH n'étant jamais supprimée**.
5. **`api.skanfact.tn`** : Workers & Pages → `skanfact-api` → Settings → Domains & Routes → Add →
   Custom domain. Cloudflare crée l'enregistrement et le certificat tout seul.
6. **Vérifier les trois**, dans cet ordre de gravité : un mail envoyé à `contact@skanfact.tn` arrive ·
   `https://skanfact.tn` s'ouvre · `https://api.skanfact.tn/` affiche la console.

### Le nuage gris, et pourquoi

Le site reste en **DNS only**. GitHub Pages délivre son propre certificat Let's Encrypt et a besoin
de voir les vraies requêtes pour le valider et le renouveler ; derrière le proxy de Cloudflare, la
validation devient capricieuse et le mode SSL « Flexible » fabrique une boucle de redirection. Le
gain (cache, statistiques) ne vaut pas le risque sur un site qui s'affiche déjà en une seconde.

`api.skanfact.tn` est la seule exception, et elle est automatique : un domaine de Worker est proxifié
par construction — c'est ce qui permet à Cloudflare de savoir quel worker répondre.

### Pourquoi un domaine à nous plutôt que `…workers.dev`

**L'adresse est gravée dans le paquet installé.** Elle part avec chaque `.dmg` et chaque `.exe`, et
une application installée ne la met jamais à jour. Trois conséquences :

- `skanfact-api.skanbenamor10.workers.dev` porte le **nom du compte Cloudflare** de l'éditeur, dans
  chaque installation, à vie.
- Changer de compte, de nom de worker ou d'hébergeur deviendrait impossible sans abandonner tout le
  parc. Avec `api.skanfact.tn`, c'est une ligne de DNS.
- Certains pare-feux d'entreprise bloquent `*.workers.dev` en bloc.

Un CNAME `api.skanfact.tn → …workers.dev` depuis OVH **ne marcherait pas** : `workers.dev` ne route
pas sur le nom d'hôte demandé. D'où le déménagement, qui n'est pas un confort.

> Le relais de mise à jour (6.7.0) vit encore sur `workers.dev` et y restera pour les versions déjà
> publiées : elles ne peuvent plus changer d'adresse. Le jour où il déménagera, ce sera pour les
> versions à venir seulement, et les deux adresses devront répondre pendant longtemps.
