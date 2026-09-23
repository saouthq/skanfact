#!/bin/bash
# Ouvre une des deux applications sur un ÉCRAN VIRTUEL, comme un humain l'ouvrirait sur son poste —
# pour la tester avec la souris et le clavier (scripts/humain/ecran.sh, les actions de Computer Use),
# avec Browser Use ou avec Playwright branchés sur elle par son port de débogage (CDP).
#
#   scripts/humain/lancer.sh cabinet            # SkanFact Cabinet, profil neuf
#   scripts/humain/lancer.sh entreprise         # SkanFact, profil neuf
#   scripts/humain/lancer.sh cabinet --garder   # rouvre le profil de la fois précédente
#
# Pourquoi (23/09/2026, demandé par Skander) : les parcours `npm run e2e:*` cliquent sur des
# SÉLECTEURS. Un humain clique sur des PIXELS : il ne voit ni un bouton collé à un autre, ni un
# bouton masqué par une couche, ni un texte blanc sur blanc — il les subit. Tester « comme un
# humain », c'est regarder l'écran, cliquer où l'on voit le bouton, et regarder ce qui a changé.
set -euo pipefail
RACINE=$(cd "$(dirname "$0")/../.." && pwd)
APP=${1:-cabinet}
# L'app entreprise se lance par la RACINE du dépôt, comme `npm start` (« electron . ») et comme les
# parcours e2e : lancée par `src/main.js`, Electron ne trouve pas le package.json, `app.getVersion()`
# rend SA version (« v44.4.1 » en bas de la barre latérale) et l'écran des mises à jour compare
# une version qui n'existe pas — le test humain aurait regardé une application qu'aucun client
# n'a. Le Cabinet se lance par son `main.js`, comme `npm run start:cabinet` : il lit sa version
# dans package.json.
case "$APP" in
  entreprise) MAIN=.;                   PORT=9222 ;;
  cabinet)    MAIN=src/cabinet/main.js; PORT=9223 ;;
  *) echo "Usage : $0 entreprise|cabinet [--garder]" >&2; exit 2 ;;
esac
TRAVAIL=/tmp/skanfact-humain
PROFIL="$TRAVAIL/profil-$APP"
mkdir -p "$TRAVAIL"
export DISPLAY=${SKANFACT_ECRAN:-:99}

# L'écran virtuel : 1440×900, la taille sur laquelle toutes les mesures du projet sont faites, et
# un gestionnaire de fenêtres — sans lui, une fenêtre n'a ni focus ni position, et le clavier tombe
# dans le vide.
if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  Xvfb "$DISPLAY" -screen 0 1440x900x24 -nolisten tcp >"$TRAVAIL/xvfb.log" 2>&1 &
  for _ in $(seq 1 50); do xdpyinfo -display "$DISPLAY" >/dev/null 2>&1 && break; sleep 0.1; done
  (openbox >"$TRAVAIL/openbox.log" 2>&1 &) || true
fi

# Une seule instance par application : on ferme celle d'avant (verrou d'instance unique).
if [ -f "$TRAVAIL/$APP.pid" ] && kill -0 "$(cat "$TRAVAIL/$APP.pid")" 2>/dev/null; then
  kill "$(cat "$TRAVAIL/$APP.pid")" 2>/dev/null || true; sleep 1
fi
[ "${2:-}" = "--garder" ] || rm -rf "$PROFIL"

nohup "$RACINE/node_modules/.bin/electron" --no-sandbox --remote-debugging-port=$PORT \
  --user-data-dir="$PROFIL" "$RACINE/$MAIN" >"$TRAVAIL/$APP.log" 2>&1 &
echo $! > "$TRAVAIL/$APP.pid"

for _ in $(seq 1 100); do curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && break; sleep 0.2; done
if ! curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
  echo "L'application ne répond pas sur le port $PORT. Journal : $TRAVAIL/$APP.log" >&2; exit 1
fi
# La fenêtre occupe tout l'écran virtuel, comme sur un portable : c'est là que les défauts de
# place se voient (7.13.0).
sleep 1.5
W=$(xdotool search --onlyvisible --name "SkanFact" 2>/dev/null | tail -1 || true)
[ -n "$W" ] && xdotool windowmove "$W" 0 0 windowsize "$W" 1440 900 windowactivate "$W" 2>/dev/null || true

cat <<INFO
$APP ouverte sur l'écran $DISPLAY (1440×900), profil $PROFIL
  regarder / agir   : scripts/humain/ecran.sh capture | clic X Y | taper "texte" | touche ctrl+k …
  Browser Use       : BU_CDP_URL=http://127.0.0.1:$PORT browser-use <<'PY' … PY
  Playwright        : chromium.connectOverCDP('http://127.0.0.1:$PORT')
  fermer            : scripts/humain/fermer.sh $APP
INFO
