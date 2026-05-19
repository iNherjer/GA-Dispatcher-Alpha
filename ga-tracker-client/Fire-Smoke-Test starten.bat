@echo off
setlocal
cd /d "%~dp0"

set "APP_URL=https://inherjer.github.io/GA-Dispatcher-Alpha/?swBypass=1^&fireDebug=1^&fireTruth=fire^&fireExtent=major_fire^&fireSpawnMode=prewarm^&fireAltOffset=0^&fireCount=2^&fireRadius=8^&fireTest=off^&testBuild=fire-smoke-v2"
set "TRACKER_EXE=%~dp0VFR-Multitool-Tracker.exe"

title GA Dispatcher Fire Smoke Test
echo ============================================
echo GA Dispatcher - Fire Smoke Test
echo ============================================
echo.
echo Die Tracker-EXE braucht keine extra Argumente.
echo Diese BAT startet den Tracker und oeffnet die App
echo mit fireDebug=1, fireTruth=fire, fireExtent=major_fire,
echo fireSpawnMode=prewarm und Fire-Offset 0 ft.
echo.

if not exist "%TRACKER_EXE%" (
    echo FEHLER: VFR-Multitool-Tracker.exe wurde nicht in diesem Ordner gefunden.
    echo Ordner: %~dp0
    echo.
    pause
    exit /b 1
)

echo Starte Tracker...
start "GA Tracker Smoke Debug" "%TRACKER_EXE%"

echo Oeffne App-Testmodus...
timeout /t 2 /nobreak >nul
start "" "%APP_URL%"

echo.
echo Testablauf:
echo 1. In der App eine Fire-/Rauch-Mission generieren.
echo 2. Mission starten.
echo 3. PAX-Menue oeffnen.
echo 4. Debugbereich unten pruefen oder "Test: Rauch erzwingen" druecken.
echo.
echo Erwartung im Debug:
echo truth=fire ^| requested=... ^| spawned=ja (...) ^| lastAck=mission_smoke_spawn_ack:ok
echo.
echo Die Tracker-Debugdatei liegt danach neben der EXE:
echo ga-tracker-debug.txt
echo.
pause
