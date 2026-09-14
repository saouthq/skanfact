# Signaler une faille de sécurité

SkanFact manipule des données comptables et fiscales — factures, matricules, coordonnées bancaires,
bulletins de paie. Une faille compte, et elle se signale **en privé**, jamais dans une issue
publique.

## Comment signaler

Ouvre un signalement privé depuis l'onglet **Security** du dépôt :
[Report a vulnerability](https://github.com/saouthq/skanfact/security/advisories/new). Le contenu
n'est visible que du propriétaire du dépôt et de toi, et GitHub permet d'y discuter d'un correctif
avant toute publication.

N'ouvre pas d'issue publique tant que le problème n'est pas corrigé et publié.

Dans ton signalement, dis : ce que tu as trouvé, **comment le reproduire**, la version de SkanFact
(elle est en bas de la barre latérale) et le système. Un scénario reproductible vaut plus qu'une
description.

SkanFact est développé par **une seule personne**. Compte quelques jours pour une première réponse,
pas quelques heures. Il n'y a pas de programme de récompense.

## Versions suivies

| Version | Suivie |
|---|---|
| La dernière publiée sur [Releases](https://github.com/saouthq/skanfact/releases) | ✅ |
| Toutes les précédentes | ❌ |

Il n'y a pas de rétroportage : un correctif de sécurité sort dans une nouvelle version. Les deux
applications — SkanFact et SkanFact Cabinet — partagent le même numéro de version et la même
release.

## Ce qui est déjà connu, et assumé

Inutile de les signaler : ce sont des choix documentés, pas des découvertes.

- **Les applications ne sont pas signées** (pas de certificat Apple ni Windows — ils sont payants).
  D'où l'avertissement au premier lancement. Une conséquence réelle : un installateur téléchargé
  ailleurs que depuis la page Releases de ce dépôt ne peut pas être authentifié. **Ne les prends que
  là.**
- **La vérification de licence est côté client** (Ed25519, hors ligne). Elle est contournable par
  quelqu'un qui modifie l'application sur sa propre machine, et c'est un compromis accepté :
  l'application ne doit dépendre d'aucun serveur, et doit continuer à fonctionner si son éditeur
  disparaît. Une licence expirée ne bloque de toute façon que la **création** de nouvelles pièces —
  jamais la lecture, l'export ou les sauvegardes.
- **Le secret du relais de mise à jour est embarqué dans les paquets construits.** Tout ce qu'une
  application peut télécharger sans intervention humaine, quelqu'un qui ouvre le paquet le peut
  aussi. Il arrête les curieux, il ne prétend pas à davantage.
- **Aucune analyse statique ni formatage automatique** n'est configuré sur ce dépôt (ni ESLint, ni
  Prettier). Un rapport d'outil automatique sans scénario d'exploitation ne sera pas traité.

## Ce qui nous intéresse vraiment

- Lecture ou écriture **hors du dossier de données** de l'application à partir d'un fichier reçu de
  l'extérieur : un paquet `.skanpack`, un fichier importé, une pièce jointe, une photo de facture.
  Le cas « un mois de la forme `../../..` » a déjà été corrigé en 6.8.1 ; s'il en reste un, il compte.
- Défaut du **chiffrement** des données ou des sauvegardes (AES-256-GCM + scrypt), ou de la
  dérivation de clé.
- Défaut de l'**appairage avec un cabinet comptable** : une empreinte qui accepterait une clé qui
  n'est pas la sienne, un paquet qui s'ouvrirait chez le mauvais destinataire, une vérification
  d'intégrité qui affirmerait « pièces intactes » à tort.
- **Exécution de code** déclenchée par un fichier ouvert dans l'application.
- **Fuite réseau** : toute requête sortante qui n'a pas été explicitement demandée par
  l'utilisateur. L'application est conçue pour ne rien envoyer d'elle-même ; la lecture de photo de
  facture (4.2.0) est **éteinte par défaut** et n'émet rien tant qu'aucune clé d'API n'a été saisie.
- **Secret trouvé dans le dépôt ou dans un paquet publié** : il ne devrait y en avoir aucun.

## Où vivent les données

Tout reste sur l'ordinateur de l'utilisateur, dans le dossier de données de l'application
(`%APPDATA%\SkanFact\` sur Windows, `~/Library/Application Support/SkanFact/` sur macOS). Il n'y a
ni compte, ni serveur, ni télémétrie. Les seules sorties réseau possibles sont la **vérification des
mises à jour** et, si l'utilisateur a saisi une clé d'API, la **lecture d'une photo de facture**.

Le chiffrement des données et le mot de passe sont **facultatifs** dans l'application entreprise —
donc par défaut, quiconque a accès à la session de l'utilisateur a accès aux factures. C'est le
comportement attendu d'un fichier local ; le chiffrement se règle dans Paramètres → Sécurité et
données. Dans SkanFact Cabinet, le mot de passe est **obligatoire**.
