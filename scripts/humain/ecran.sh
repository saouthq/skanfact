#!/bin/bash
# Les actions de Computer Use, jouées sur l'écran virtuel ouvert par scripts/humain/lancer.sh : de
# VRAIS événements souris et clavier du système (xdotool), et de vraies captures de l'écran (scrot).
# Rien ne passe par le DOM : un bouton recouvert par une couche ne reçoit pas le clic, exactement
# comme chez l'utilisateur — c'est tout l'intérêt (le défaut de la 5.2.2 ne se voit que comme ça).
#
#   ecran.sh capture [fichier.png]   capture de tout l'écran (les coordonnées sont celles des clics)
#   ecran.sh clic X Y                clic gauche          (left_click)
#   ecran.sh double X Y              double clic          (double_click)
#   ecran.sh droit X Y               clic droit           (right_click)
#   ecran.sh taper "texte"           frappe au clavier    (type)
#   ecran.sh touche ctrl+k           raccourci / touche   (key) — Return, Escape, Tab, ctrl+s…
#   ecran.sh deplacer X Y            survol               (mouse_move)
#   ecran.sh defiler X Y bas|haut N  molette             (scroll)
#   ecran.sh glisser X1 Y1 X2 Y2     glisser-déposer      (left_click_drag)
#   ecran.sh position                position du pointeur (cursor_position)
set -euo pipefail
export DISPLAY=${SKANFACT_ECRAN:-:99}
# Sans une locale UTF-8, xdotool refuse les accents (« Invalid multi-byte sequence ») : un
# comptable tape « Associés », « Médenine », « Sfax — Siège ».
export LC_ALL=C.UTF-8 LANG=C.UTF-8
TRAVAIL=/tmp/skanfact-humain
mkdir -p "$TRAVAIL"
a=${1:-}; shift || true
case "$a" in
  capture|screenshot)
    f=${1:-$TRAVAIL/ecran-$(date +%H%M%S).png}
    scrot -o "$f" >/dev/null 2>&1
    echo "$f" ;;
  clic|left_click)            xdotool mousemove "$1" "$2" click 1 ;;
  double|double_click)        xdotool mousemove "$1" "$2" click --repeat 2 --delay 80 1 ;;
  droit|right_click)          xdotool mousemove "$1" "$2" click 3 ;;
  taper|type)                 xdotool type --delay 25 -- "$*" ;;
  touche|key)                 xdotool key -- "$@" ;;
  deplacer|mouse_move)        xdotool mousemove "$1" "$2" ;;
  defiler|scroll)
    b=5; [ "${3:-bas}" = "haut" ] && b=4
    xdotool mousemove "$1" "$2" click --repeat "${4:-3}" --delay 40 "$b" ;;
  glisser|left_click_drag)    xdotool mousemove "$1" "$2" mousedown 1 mousemove --sync "$3" "$4" mouseup 1 ;;
  position|cursor_position)   xdotool getmouselocation ;;
  *) sed -n '8,20p' "$0" >&2; exit 2 ;;
esac
