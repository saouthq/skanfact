@echo off
setlocal EnableDelayedExpansion
title SkanFact - Installation
cd /d "%~dp0"
chcp 65001 >nul

echo.
echo   === SkanFact - Installation ===
echo   Devis ^& factures pour une petite entreprise
echo.
echo   Cet assistant va :
echo    1. verifier Node.js (et l'installer si besoin)
echo    2. telecharger les dependances (~150 Mo)
echo    3. construire l'installateur SkanFact
echo    4. le lancer
echo.
set /p go="  On commence ? [O/n] "
if /i "%go%"=="n" exit /b 0

echo.
echo   [1/4] Verification de Node.js
where node >nul 2>&1
if %errorlevel%==0 (
  for /f "tokens=*" %%v in ('node -v') do echo   OK  Node.js %%v detecte
) else (
  echo   !!  Node.js n'est pas installe.
  set /p inst="  L'installer automatiquement avec winget ? [O/n] "
  if /i "!inst!"=="n" (
    start https://nodejs.org/fr/download
    echo   Installe Node.js (bouton LTS) puis relance cet installeur.
    pause & exit /b 0
  )
  winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo   L'installation automatique a echoue. J'ouvre nodejs.org : installe-le puis relance cet installeur.
    start https://nodejs.org/fr/download
    pause & exit /b 1
  )
  echo   Node.js installe. Ferme cette fenetre et relance l'installeur pour continuer.
  pause & exit /b 0
)

echo.
echo   [2/4] Dependances de l'application
if exist node_modules\electron (
  echo   OK  Deja telechargees
) else (
  set /p dl="  Telecharger Electron et electron-builder (~150 Mo) ? [O/n] "
  if /i "!dl!"=="n" exit /b 0
  echo   Patiente, 1 a 3 minutes...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo   npm install a echoue. Copie les messages ci-dessus.
    pause & exit /b 1
  )
  echo   OK  Dependances installees
)

echo.
echo   [3/4] Construction de l'installateur
set /p build="  Construire l'installateur SkanFact (.exe) ? [O/n] "
if /i "%build%"=="n" (
  echo.
  echo   [4/4] Lancement en mode developpement
  call npm start
  exit /b 0
)
call npx electron-builder --win
if errorlevel 1 (
  echo   La construction a echoue. Copie les messages ci-dessus.
  pause & exit /b 1
)
for %%f in (dist\*.exe) do set EXE=%%f
echo   OK  Installateur cree : %EXE%

echo.
echo   [4/4] Lancement
set /p run="  Lancer l'installateur maintenant ? [O/n] "
if /i not "%run%"=="n" start "" "%EXE%"

echo.
echo   Installation terminee. SkanFact sera dans le menu Demarrer.
echo   Tes donnees : %%APPDATA%%\SkanFact\
pause
