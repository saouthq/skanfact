#!/bin/bash
# Mise à jour SkanFact sur macOS sans certificat Apple.
# Lancé par l'app juste avant qu'elle se ferme ; remplace l'app par la version téléchargée, puis la relance.
#
#   $1 PID de l'app en cours     $2 archive .zip téléchargée     $3 chemin de l'app
#   $4 fichier résultat (JSON)   $5 numéro de la nouvelle version
#   $6 nom du binaire (défaut SkanFact) — « SkanFact Cabinet » pour l'app du comptable
#
# Le même script sert aux deux applications : seul le nom du binaire change.

PID="$1"; ZIP="$2"; APP="$3"; RESULT="$4"; VERSION="$5"; BIN="${6:-SkanFact}"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
result() { printf '{"ok":%s,"version":"%s","message":"%s"}\n' "$1" "$VERSION" "$2" > "$RESULT"; }
fail() { log "ERREUR : $1"; result false "$1"; open "$APP"; exit 1; }

log "mise à jour vers $VERSION : zip=$ZIP app=$APP"

# 1. Attendre que l'app se ferme (60 s max).
for _ in $(seq 1 120); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
kill -0 "$PID" 2>/dev/null && fail "l'application ne s'est pas fermée"

# 2. Extraire l'archive dans un dossier temporaire.
TMP=$(mktemp -d "${TMPDIR:-/tmp}/skanfact-update.XXXXXX") || fail "impossible de créer un dossier temporaire"
ditto -x -k "$ZIP" "$TMP" || fail "extraction de l'archive impossible"
NEW=$(find "$TMP" -maxdepth 2 -name '*.app' -print -quit)
[ -n "$NEW" ] && [ -x "$NEW/Contents/MacOS/$BIN" ] || fail "archive invalide (pas d'application dedans)"
xattr -cr "$NEW" 2>/dev/null

# 3. Remplacer l'ancienne app (on la garde de côté le temps de la copie).
OLD="$TMP/ancienne-version.app"
mv "$APP" "$OLD" || fail "impossible de remplacer l'application (droits insuffisants sur le dossier Applications ?)"
if mv "$NEW" "$APP"; then
  rm -rf "$TMP"
  result true "installée"
  log "OK"
else
  mv "$OLD" "$APP"
  fail "copie impossible, ancienne version restaurée"
fi

# 4. Relancer.
open "$APP"
