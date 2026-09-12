#!/bin/bash
# Installeur SkanFact pour macOS — double-clique sur ce fichier.
# Vérifie Node.js, installe les dépendances, construit l'application et la place dans Applications.

cd "$(dirname "$0")" || exit 1

BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
TOTAL=5

title() { clear; echo "${CYAN}${BOLD}"; echo "  ███ SkanFact — Installation"; echo "${RESET}${DIM}  Devis & factures · SKANCYBER SECURITY${RESET}"; echo; }
step()  { echo; echo "${BOLD}[$1/$TOTAL] $2${RESET}"; echo "${DIM}──────────────────────────────────────────────${RESET}"; }
ok()    { echo "  ${GREEN}✔${RESET} $1"; }
warn()  { echo "  ${YELLOW}▲${RESET} $1"; }
fail()  { echo; echo "  ${RED}✖ $1${RESET}"; echo; echo "  Copie le message ci-dessus et envoie-le moi."; echo; read -r -p "  Appuie sur Entrée pour fermer." _; exit 1; }
ask()   { # ask "question" -> 0 si oui
  local a; echo; read -r -p "  ${BOLD}$1${RESET} [O/n] " a; [[ -z "$a" || "$a" =~ ^[OoYy] ]]; }

title
echo "  Cet assistant va :"
echo "   1. vérifier Node.js (et l'installer si besoin)"
echo "   2. télécharger les dépendances de l'application (~150 Mo)"
echo "   3. construire l'application SkanFact.app"
echo "   4. la copier dans le dossier Applications"
echo "   5. la lancer"
echo
echo "  Dossier : $(pwd)"
ask "On commence ?" || { echo "  Installation annulée."; exit 0; }

# ---------------------------------------------------------------- 1. Node.js
step 1 "Vérification de Node.js"
# Homebrew n'est pas toujours dans le PATH des scripts double-cliqués
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if command -v node >/dev/null 2>&1; then
  ok "Node.js $(node -v) détecté"
else
  warn "Node.js n'est pas installé. C'est indispensable pour faire tourner SkanFact."
  echo
  echo "  Deux façons de l'installer :"
  echo "   ${BOLD}1${RESET}) Automatiquement via Homebrew (recommandé, peut demander ton mot de passe Mac)"
  echo "   ${BOLD}2${RESET}) Manuellement depuis nodejs.org (j'ouvre la page, tu relances cet installeur après)"
  echo
  read -r -p "  Ton choix [1/2] : " choice
  if [[ "$choice" == "2" ]]; then
    open "https://nodejs.org/fr/download"
    echo; echo "  Installe Node.js (bouton LTS), puis relance « Installer SkanFact.command »."
    read -r -p "  Appuie sur Entrée pour fermer." _; exit 0
  fi
  if ! command -v brew >/dev/null 2>&1; then
    ask "Homebrew n'est pas installé. L'installer maintenant ? (quelques minutes)" || fail "Installation annulée : Node.js est requis."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || fail "L'installation de Homebrew a échoué."
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    command -v brew >/dev/null 2>&1 || fail "Homebrew installé mais introuvable. Ferme le Terminal et relance l'installeur."
    ok "Homebrew installé"
  fi
  ask "Installer Node.js avec Homebrew ?" || fail "Installation annulée : Node.js est requis."
  brew install node || fail "L'installation de Node.js a échoué."
  command -v node >/dev/null 2>&1 || fail "Node.js installé mais introuvable. Ferme le Terminal et relance l'installeur."
  ok "Node.js $(node -v) installé"
fi
ok "npm $(npm -v)"

# ---------------------------------------------------------------- 2. dépendances
step 2 "Dépendances de l'application"
if [[ -d node_modules/electron ]]; then
  ok "Déjà téléchargées"
  if ask "Les retélécharger quand même ?"; then rm -rf node_modules; fi
fi
if [[ ! -d node_modules/electron ]]; then
  ask "Télécharger Electron et electron-builder (~150 Mo) ?" || fail "Installation annulée."
  echo "  ${DIM}Patiente, 1 à 3 minutes selon ta connexion…${RESET}"
  npm install --no-fund --no-audit || fail "npm install a échoué."
  ok "Dépendances installées"
fi

# ---------------------------------------------------------------- 3. build
# Le relais de mise à jour : sur GitHub, son adresse et son secret viennent des « secrets » du
# dépôt. Ici il n'y en a pas, donc on les demande une fois et on les garde dans relais.local.json
# — jamais commité (.gitignore), lisible par toi seul (mode 600). Sans eux l'application se
# construit quand même : elle retombe sur GitHub + jeton, comme avant la 6.7.0.
RELAIS_FILE="relais.local.json"
if [[ -z "$UPDATE_BASE" && -f "$RELAIS_FILE" ]]; then
  UPDATE_BASE=$(node -p "require('./$RELAIS_FILE').updateBase || ''" 2>/dev/null)
  UPDATE_SECRET=$(node -p "require('./$RELAIS_FILE').updateSecret || ''" 2>/dev/null)
  [[ -n "$UPDATE_BASE" ]] && ok "Relais de mise à jour repris de $RELAIS_FILE"
fi
if [[ -z "$UPDATE_BASE" ]]; then
  echo
  echo "  ${DIM}Relais de mise à jour (laisse vide si tu ne sais pas : l'app utilisera GitHub).${RESET}"
  read -r -p "  Adresse du relais : " UPDATE_BASE
  if [[ -n "$UPDATE_BASE" ]]; then
    read -r -p "  Secret de l'application : " UPDATE_SECRET
    node -e "require('fs').writeFileSync('$RELAIS_FILE', JSON.stringify({updateBase:process.argv[1].trim(),updateSecret:process.argv[2].trim()},null,2)+'\n',{mode:0o600})" "$UPDATE_BASE" "$UPDATE_SECRET" \
      && ok "Gardé dans $RELAIS_FILE — tu ne le retaperas plus"
  fi
fi

step 3 "Construction de SkanFact.app et de l'installateur .dmg"
if ask "Construire l'application et le .dmg ? (sinon tu la lanceras avec « npm start »)"; then
  echo "  ${DIM}Deux à trois minutes…${RESET}"
  npx electron-builder --mac \
    -c.extraMetadata.updateBase="${UPDATE_BASE//[[:space:]]/}" \
    -c.extraMetadata.updateSecret="${UPDATE_SECRET//[[:space:]]/}" 2>&1 | grep -vE "^\s*$|• " || true
  APP=$(find dist -maxdepth 3 -name "SkanFact.app" -print -quit 2>/dev/null)
  [[ -n "$APP" ]] || fail "L'application n'a pas été générée (regarde les messages ci-dessus)."
  ok "Application construite : $APP"
  DMG=$(find dist -maxdepth 1 -name "*.dmg" -print -quit 2>/dev/null)
  if [[ -n "$DMG" ]]; then ok "Installateur créé : $DMG"; else warn "Pas de .dmg généré (l'app fonctionne quand même)."; fi

  # ---------------------------------------------------------------- 4. copie
  step 4 "Installation dans Applications"
  if ask "Copier SkanFact.app dans le dossier Applications ?"; then
    if [[ -w /Applications ]]; then DEST=/Applications; else DEST="$HOME/Applications"; mkdir -p "$DEST"; fi
    rm -rf "$DEST/SkanFact.app"
    cp -R "$APP" "$DEST/" || fail "Copie impossible."
    xattr -dr com.apple.quarantine "$DEST/SkanFact.app" 2>/dev/null
    ok "Installée dans $DEST"
    INSTALLED="$DEST/SkanFact.app"
  else
    INSTALLED="$APP"
  fi

  # ---------------------------------------------------------------- 5. lancement
  step 5 "Lancement"
  if ask "Lancer SkanFact maintenant ?"; then
    open "$INSTALLED"
    ok "SkanFact est lancée. Si macOS bloque l'ouverture : clic droit sur l'app → Ouvrir."
  fi
else
  step 4 "Installation dans Applications"; echo "  ${DIM}Ignorée (pas d'application construite).${RESET}"
  step 5 "Lancement"
  if ask "Lancer SkanFact en mode développement (npm start) ?"; then
    npm start
  fi
fi

echo
echo "${GREEN}${BOLD}  Installation terminée.${RESET}"
echo "  Pour relancer plus tard : SkanFact dans Applications, ou « npm start » dans ce dossier."
[[ -n "$DMG" ]] && echo "  Le fichier $DMG peut être copié sur un autre Mac pour y installer SkanFact."
echo "  Tes données : ~/Library/Application Support/SkanFact/"
echo
read -r -p "  Appuie sur Entrée pour fermer." _
