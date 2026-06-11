@echo off
setlocal

REM ================================================================
REM  GA Fire Mission Smoke Target Test
REM ================================================================
REM Dieser Test simuliert den spaeteren Missions-Flow:
REM   1. Rauch am Missionsziel spawnen
REM   2. mehrere Quellen im Umkreis setzen, damit man es aus der Luft sieht
REM   3. nach AUTO_REMOVE_SEC wieder despawnen
REM
REM Wichtig:
REM ALT_FT ist Terrainhoehe / Objekt-Hoehe in ft MSL.
REM Fuer den echten Tool-Einbau muss diese Hoehe aus der Mission/Map kommen.

set "MARKER_TITLE=Chimney_Smoke_V1"

REM Zielkoordinate eintragen.
set "LAT=48.2792245"
set "LON=8.4283415"
set "ALT_FT=2310"
set "HDG=140"

REM Sichtbarkeits-Test: 1 Zentrum + weitere Quellen im Radius.
set "COUNT=5"
set "RADIUS_M=120"

REM Mission-Ende simulieren: nach X Sekunden despawnt das Tool alle Objekte.
set "AUTO_REMOVE_SEC=300"

cd /d "%~dp0"

echo ================================================================
echo  GA Fire Mission Smoke Target Test
echo ================================================================
echo EXE       : %~dp0edtw-smoke-test.exe
echo Objekt    : "%MARKER_TITLE%"
echo Ziel      : %LAT%, %LON% / Terrain %ALT_FT% ft MSL / HDG %HDG%
echo Feld      : %COUNT% Objekte / Radius %RADIUS_M% m
echo Despawn   : nach %AUTO_REMOVE_SEC% Sekunden
echo Debug TXT : %~dp0edtw-smoke-test-debug.txt
echo.

if not exist "edtw-smoke-test.exe" (
    echo FEHLER: edtw-smoke-test.exe liegt nicht neben dieser BAT.
    echo Kopiere BAT und EXE in denselben Ordner.
    echo.
    pause
    exit /b 1
)

"%~dp0edtw-smoke-test.exe" --marker-title="%MARKER_TITLE%" --lat=%LAT% --lon=%LON% --alt-ft=%ALT_FT% --hdg=%HDG% --count=%COUNT% --radius-m=%RADIUS_M% --auto-remove-sec=%AUTO_REMOVE_SEC%

echo.
echo Test beendet. Debug-Datei:
echo %~dp0edtw-smoke-test-debug.txt
echo.
pause
