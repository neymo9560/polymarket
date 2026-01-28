@echo off
echo ================================================
echo    POLYBOT BACKEND - MODE LOCAL
echo ================================================
echo.
echo IMPORTANT: Active ton VPN (ProtonVPN ALLEMAGNE) avant!
echo.
pause
echo.
echo Demarrage du backend...
set PRIVATE_KEY=57627bfb8a2e50416d5e451db467e00ededb45414ccb4d3686a3b3bfa8764b31
node server.js
pause
