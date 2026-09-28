#!/bin/bash
# Les preuves par réintroduction (règle du projet) : chaque épreuve du banc doit TOMBER quand on
# réintroduit le défaut qu'elle surveille. Un banc qui reste vert sur un défaut ne mesure rien.
# Chaque défaut est posé dans une COPIE du prototype : le code du dépôt n'est jamais touché.
#
#   bash mesures/preuves.sh
set -u
ICI="$(cd "$(dirname "$0")/.." && pwd)"
ok=0; ko=0

prouver() { # nom du défaut, fichier, avant, après, épreuve qui doit tomber [, banc]
  local nom="$1" fichier="$2" avant="$3" apres="$4" attendue="$5" banc="${6:-notre-chemin}"
  if [ -n "${SEULEMENT:-}" ] && [ "$banc" != "$SEULEMENT" ]; then return; fi
  local copie; copie="$(mktemp -d)"
  cp -r "$ICI/base" "$ICI/serveur" "$ICI/poste" "$ICI/outils" "$ICI/mesures" "$ICI/navigateur" "$ICI/package.json" "$copie/"
  ln -s "$ICI/node_modules" "$copie/node_modules"
  python3 - "$copie/$fichier" "$avant" "$apres" <<'EOF'
import sys
p, avants, apres = sys.argv[1:4]
s = open(p, encoding='utf-8').read()
for a, b in zip(avants.split('|||'), apres.split('|||')):
    assert s.count(a) == 1, f"motif introuvable ou multiple dans {p} : {a!r}"
    s = s.replace(a, b)
open(p, 'w', encoding='utf-8').write(s)
EOF
  local sortie; sortie="$(cd "$copie" && timeout 600 node --experimental-strip-types --experimental-sqlite --no-warnings mesures/$banc.ts 2>&1)"
  if grep -q "^MANQUÉ  $attendue" <<<"$sortie"; then
    echo "PROUVÉE   $nom → « $attendue » tombe"; ok=$((ok+1))
  else
    echo "NON PROUVÉE  $nom → « $attendue » reste verte"; ko=$((ko+1))
    grep -E "^(TENU|MANQUÉ)" <<<"$sortie" | sed 's/^/      /' | cut -c1-160
  fi
  rm -rf "$copie"
}

prouver "la paie sans filtre de rôle" base/schema.sql \
  "alter table bulletin enable row level security;" "" \
  "Poste d'un commercial"
prouver "la base sans filtre d'entreprise" base/schema.sql \
  "execute format('alter table %I enable row level security', t);" "null;" \
  "Aucune ligne d'une autre entreprise"
prouver "un geste reçu deux fois compte deux fois" serveur/serveur.ts \
  "if (deja.rowCount) { resultats.push({ id: op.id, statut: 'deja' }); continue; }" "" \
  "Un même geste envoyé trois fois"
prouver "la version précédente refusée" serveur/serveur.ts \
  "const FORMATS_ACCEPTES = [FORMAT_ACTUEL, FORMAT_ACTUEL - 1];" "const FORMATS_ACCEPTES = [FORMAT_ACTUEL];" \
  "Une file écrite par la version précédente"
prouver "un brouillon écrasé par le dernier arrivé" serveur/serveur.ts \
  "|| Number(r.rows[0].revision) !== Number(d.revision_vue)" "" \
  "Deux postes modifient le même brouillon"
prouver "une fiche fusionnée en bloc, pas champ par champ" serveur/serveur.ts \
  "if (Number(revs[champ] ?? 0) > vue) {" "if (Object.keys(revs).length > 0) {" \
  "Une fiche modifiée sur deux postes"
prouver "un appareil révoqué qui continue" serveur/serveur.ts \
  "if (id.revoque) {" "if (false) {" \
  "Appareil révoqué"
prouver "des écritures simultanées sans ordre" serveur/serveur.ts \
  "await c.query('select pg_advisory_xact_lock(hashtext(\$1))', [id.entreprise]);|||      return { resultats };" "|||      await c.query('select pg_sleep(random() * 0.05)'); return { resultats };" \
  "Écritures simultanées"
# Le poste dans le navigateur.
prouver "le navigateur ignore l'ordre d'effacer" navigateur/poste.js \
  "  await pool?.wipeFiles();" "" \
  "Appareil révoqué : la copie du navigateur" navigateur
prouver "une copie qui ne survit pas à la fermeture" navigateur/poste.js \
  "installOpfsSAHPoolVfs({ name: 'skanfact-proto' })" "installOpfsSAHPoolVfs({ name: 'skanfact-proto', clearOnInit: true })" \
  "La copie survit à la fermeture" navigateur

echo; echo "$ok preuves faites, $ko non prouvées."
[ "$ko" -eq 0 ]
