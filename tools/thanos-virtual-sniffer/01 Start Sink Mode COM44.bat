@echo off
cd /d "%~dp0"

set LISTEN_COM=COM44
set BAUD=921600
set DURATION=120

echo =====================================
echo  Thanos Virtual Sniffer - Sink Mode
echo =====================================
echo.
echo DRSM muss auf die andere Seite des virtuellen COM-Paares senden.
echo Beispiel: com0com Paar COM43 ^<--^> COM44
echo   DRSM Output Port : COM43
echo   Dieses Tool     : COM44
echo.
echo Aktuelle Einstellung:
echo   Listen : %LISTEN_COM%
echo   Baud   : %BAUD%
echo   Dauer  : %DURATION%s
echo.
echo Falls deine Ports anders heissen, diese BAT im Editor anpassen.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ThanosVirtualSniffer.ps1" -Listen %LISTEN_COM% -Baud %BAUD% -DurationSec %DURATION%
