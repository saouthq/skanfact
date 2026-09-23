#!/bin/bash
# Démarrage d'une session Claude Code sur le web : ce qu'il faut pour TESTER COMME UN HUMAIN à la fin
# de chaque changement (demandé par Skander le 23/09/2026). Le conteneur repart de zéro à chaque
# session : sans ce fichier, il faudrait tout réinstaller à la main, et on finirait par ne plus le
# faire. Idempotent (rien n'est refait si c'est déjà là), sans question.
#
#  - les dépendances du projet (npm test, npm run lint, les parcours e2e, Playwright) ;
#  - les outils de Computer Use sur l'écran virtuel : xdotool (souris, clavier), scrot (captures),
#    openbox (gestionnaire de fenêtres) — voir scripts/humain/ ;
#  - Browser Use (`browser-use`), qui se branche sur une application ouverte par son port CDP.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# 1. Dépendances du projet. `npm install` et non `npm ci` : l'état du conteneur est gardé après ce
#    hook, et un `ci` effacerait node_modules à chaque fois.
if [ ! -x node_modules/.bin/electron ] || [ ! -d node_modules/playwright ]; then
  npm install --no-audit --no-fund
fi

# 2. Computer Use : souris, clavier et captures d'un vrai écran (virtuel).
manque=""
for b in xdotool scrot xdpyinfo openbox; do command -v "$b" >/dev/null 2>&1 || manque=1; done
if [ -n "$manque" ] && command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null 2>&1 || true   # des dépôts tiers bloqués par le proxy ne gênent pas
  apt-get install -y -qq --no-install-recommends xdotool scrot x11-utils openbox >/dev/null 2>&1
fi

# 3. Browser Use, en outil isolé (uv), hors des dépendances du projet : la CI n'en a pas besoin.
export PATH="$HOME/.local/bin:$PATH"
if ! command -v browser-use >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then uv tool install -q browser-use
  else python3 -m pip install -q --user browser-use; fi
fi
[ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"

echo "Prêt pour tester comme un humain : scripts/humain/lancer.sh cabinet|entreprise" >&2
