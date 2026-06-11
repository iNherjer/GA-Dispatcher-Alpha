@echo off
setlocal

REM ================================================================
REM  GA Smoke Test - Titel hier eintragen
REM ================================================================
REM Den exakten Titel aus DevMode -> Tools -> SimObject Spawner
REM zwischen die Anfuehrungszeichen schreiben.
REM Beispiel:
REM   set "MARKER_TITLE=Asobo_Wildfire_Smoke_Large"
REM   set "MARKER_TITLE=EDTW Smoke Marker"

set "MARKER_TITLE=Chimney_Smoke_V1"

REM Testposition. Standard ist EDTW/Winzeln-Schramberg.
set "LAT=48.2792245"
set "LON=8.4283415"
set "ALT_FT=2310"
set "HDG=140"

REM --keep laesst das gespawnte Objekt im Sim, wenn das Tool beendet wird.
REM Fuer automatisches Entfernen stattdessen KEEP leer lassen und AUTO_REMOVE setzen.
set "KEEP=--keep"
set "AUTO_REMOVE="
REM Beispiel:
REM set "KEEP="
REM set "AUTO_REMOVE=--auto-remove-sec=120"

cd /d "%~dp0"

echo ================================================================
echo  GA Smoke Marker Test
echo ================================================================
echo EXE       : %~dp0edtw-smoke-test.exe
echo Titel     : "%MARKER_TITLE%"
echo Position  : %LAT%, %LON% / %ALT_FT% ft / HDG %HDG%
echo Debug TXT : %~dp0edtw-smoke-test-debug.txt
echo.

if not exist "edtw-smoke-test.exe" (
    echo FEHLER: edtw-smoke-test.exe liegt nicht neben dieser BAT.
    echo Kopiere BAT und EXE in denselben Ordner.
    echo.
    pause
    exit /b 1
)

"%~dp0edtw-smoke-test.exe" --marker-title="%MARKER_TITLE%" --lat=%LAT% --lon=%LON% --alt-ft=%ALT_FT% --hdg=%HDG% %KEEP% %AUTO_REMOVE%

echo.
echo Test beendet. Debug-Datei:
echo %~dp0edtw-smoke-test-debug.txt
echo.
pause
