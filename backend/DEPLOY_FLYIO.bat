@echo off
echo ================================================
echo    DEPLOIEMENT FLY.IO - POLYBOT BACKEND
echo ================================================
echo.
echo Etape 1: Connexion a Fly.io...
flyctl auth login
echo.
echo Etape 2: Creation de l'app...
flyctl launch --no-deploy --copy-config --name polybot-backend-live --region fra --yes
echo.
echo Etape 3: Configuration de la cle privee...
flyctl secrets set PRIVATE_KEY=57627bfb8a2e50416d5e451db467e00ededb45414ccb4d3686a3b3bfa8764b31
echo.
echo Etape 4: Deploiement...
flyctl deploy
echo.
echo ================================================
echo    DEPLOIEMENT TERMINE!
echo    URL: https://polybot-backend-live.fly.dev
echo ================================================
pause
