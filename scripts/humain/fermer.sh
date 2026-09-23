#!/bin/bash
# Ferme l'application ouverte par scripts/humain/lancer.sh (ou les deux, sans argument). L'écran
# virtuel reste : la prochaine ouverture ne le recrée pas.
TRAVAIL=/tmp/skanfact-humain
for app in ${1:-entreprise cabinet}; do
  f="$TRAVAIL/$app.pid"
  [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null && echo "$app fermée"
  rm -f "$f"
done
exit 0
