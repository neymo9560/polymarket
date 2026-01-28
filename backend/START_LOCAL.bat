@echo off
echo ================================================
echo    POLYBOT BACKEND - MODE LOCAL
echo ================================================
echo.
echo IMPORTANT: Active ton VPN (ProtonVPN USA) avant!
echo.
pause
echo.
echo Demarrage du backend...
set PRIVATE_KEY=METS_TA_CLE_PRIVEE_ICI
node server.js
pause
