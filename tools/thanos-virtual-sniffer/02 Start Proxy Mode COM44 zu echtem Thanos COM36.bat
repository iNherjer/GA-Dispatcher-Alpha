@echo off
cd /d "%~dp0"

set LISTEN_COM=COM44
set REAL_THANOS_COM=COM36
set BAUD=921600
set DURATION=120

echo =====================================
echo  Thanos Virtual Sniffer - Proxy Mode
echo =====================================
echo.
echo WARNUNG: Proxy Mode leitet die DRSM-Daten an den echten Thanos weiter.
echo Das Rig kann sich also bewegen. Nur mit niedriger Intensitaet testen.
echo.
echo Beispiel: com0com Paar COM43 ^<--^> COM44
echo   DRSM Output Port : COM43
echo   Dieses Tool     : COM44
echo   Echter Thanos   : %REAL_THANOS_COM%
echo.
echo Aktuelle Einstellung:
echo   Listen       : %LISTEN_COM%
echo   Forward real : %REAL_THANOS_COM%
echo   Baud         : %BAUD%
echo   Dauer        : %DURATION%s
echo.
echo Falls deine Ports anders heissen, diese BAT im Editor anpassen.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ThanosVirtualSniffer.ps1" -Listen %LISTEN_COM% -Baud %BAUD% -Forward %REAL_THANOS_COM% -DurationSec %DURATION%
