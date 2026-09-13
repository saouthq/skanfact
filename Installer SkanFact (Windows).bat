@echo off
setlocal EnableDelayedExpansion
title SkanFact - Installation
cd /d "%~dp0"

rem ---------------------------------------------------------------------------
rem  Ce fichier DOIT etre enregistre avec des fins de ligne Windows (CRLF).
rem  Avec des fins de ligne Unix (LF), cmd.exe se desynchronise sur le premier
rem  bloc "if ( ... )" : erreur de syntaxe, et la fenetre se ferme sans un mot.
rem  C'est exactement ce qui arrivait avant la 7.21.1. Un fichier .gitattributes
rem  et un test de npm test empechent la recidive.
rem ---------------------------------------------------------------------------

set "LOG=%~dp0installation-windows.log"
set "BLOG=%~dp0construction.log"
echo ===== SkanFact - installation du %DATE% a %TIME% =====> "%LOG%"
echo Dossier : %~dp0>> "%LOG%"
rem  Le chemin, la version de Node et celle de npm sont ce qui change d'un poste
rem  a l'autre : sans eux, un echec de construction est impossible a expliquer.

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
echo   Si quelque chose se passe mal, tout est note dans :
echo   %LOG%
echo   et le detail de la construction dans construction.log
echo.
set "go="
set /p go="  On commence ? [O/n] "
if /i "%go%"=="n" goto :fin

echo.
echo   [1/4] Verification de Node.js
echo [1/4] node>> "%LOG%"
where node >nul 2>&1
if not %errorlevel%==0 goto :sansnode
for /f "tokens=*" %%v in ('node -v') do echo   OK  Node.js %%v detecte
for /f "tokens=*" %%v in ('node -v') do echo node %%v>> "%LOG%"
goto :deps

:sansnode
echo   Node.js n'est pas installe.
echo node absent>> "%LOG%"
set "inst="
set /p inst="  L'installer automatiquement avec winget ? [O/n] "
if /i "!inst!"=="n" goto :sitenode
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto :sitenode
echo.
echo   Node.js est installe.
echo   FERME cette fenetre et relance cet installeur : Windows doit d'abord
echo   prendre en compte le nouveau programme.
goto :fin

:sitenode
echo   J'ouvre nodejs.org : installe la version LTS, puis relance cet installeur.
start https://nodejs.org/fr/download
goto :fin

:deps
echo.
echo   [2/4] Dependances de l'application
echo [2/4] dependances>> "%LOG%"
if exist "node_modules\electron" goto :construire
set "dl="
set /p dl="  Telecharger Electron et electron-builder (~150 Mo) ? [O/n] "
if /i "!dl!"=="n" goto :fin
echo   Patiente, 1 a 3 minutes. Les lignes qui defilent sont normales.
echo.
call npm install --no-fund --no-audit
if errorlevel 1 goto :echec_npm
echo   OK  Dependances installees
echo dependances ok>> "%LOG%"
for /f "tokens=*" %%v in ('npm -v') do echo npm %%v>> "%LOG%"
goto :construire

:echec_npm
echo npm install : echec>> "%LOG%"
echo.
echo   Le telechargement des dependances a echoue.
echo   Verifie ta connexion internet, puis relance cet installeur.
goto :fin

:construire
echo.
echo   [3/4] Construction de l'installateur
set "build="
set /p build="  Construire l'installateur SkanFact (.exe) ? [O/n] "
if /i "%build%"=="n" goto :dev
echo   Patiente, 2 a 5 minutes. Rien ne s'affiche pendant ce temps :
echo   tout est ecrit au fur et a mesure dans construction.log.
echo.
call npm run build:win > "%BLOG%" 2>&1
set "RC=%errorlevel%"
rem  La sortie d electron-builder est versee dans le journal principal : un seul
rem  fichier a envoyer, et il porte la cause au lieu du seul mot "echec".
echo ----- sortie de npm run build:win ----->> "%LOG%"
type "%BLOG%" >> "%LOG%"
echo ----- fin de la sortie ----->> "%LOG%"
if not "%RC%"=="0" goto :echec_build
set "EXE="
for %%f in ("dist\*.exe") do set "EXE=%%~ff"
if not defined EXE goto :sans_exe
echo   OK  Installateur cree :
echo   %EXE%
echo exe : %EXE%>> "%LOG%"

echo.
echo   [4/4] Lancement
set "run="
set /p run="  Lancer l'installateur maintenant ? [O/n] "
if /i "%run%"=="n" goto :apres
start "" "%EXE%"

:apres
echo.
echo   Termine. SkanFact sera dans le menu Demarrer.
echo   Tes donnees : %%APPDATA%%\SkanFact\
goto :fin

:sans_exe
echo construction : aucun .exe dans dist\>> "%LOG%"
echo.
echo   La construction s'est terminee mais aucun .exe n'a ete trouve dans dist\.
echo   Ouvre le dossier dist\ pour voir ce qui s'y trouve.
goto :fin

:echec_build
echo construction : echec>> "%LOG%"
echo.
echo   --- Ce que la construction a repondu ---
echo.
type "%BLOG%"
echo.
echo   --- Fin du message ---
echo.
echo   La construction a echoue, et la raison est juste au-dessus.
echo   Envoie-moi le fichier :
echo   %LOG%
echo   Il porte tout : ton systeme, tes versions et ce message.
goto :fin

:dev
echo.
echo   [4/4] Lancement en mode developpement
echo   (l'application s'ouvre sans etre installee ; ferme la fenetre pour quitter)
echo.
call npm start
goto :fin

:fin
echo.
echo   --- Appuie sur une touche pour fermer cette fenetre ---
pause >nul
endlocal
exit /b 0
