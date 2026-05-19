@echo off
setlocal
cd /d "%~dp0"

set "APP_URL=https://inherjer.github.io/GA-Dispatcher-Alpha/?fireDebug=1^&fireTruth=fire^&fireExtent=major_fire^&fireSpawnMode=target^&fireTest=offset_ladder^&fireCount=1^&fireRadius=0"
set "TRACKER_EXE=%~dp0VFR-Multitool-Tracker.exe"

title GA Dispatcher Fire Offset Test
echo ============================================
echo GA Dispatcher - Fire Offset Test
echo ============================================
echo.
echo Dieser Test spawnt VO_Fire_R1_40 in einer kleinen Linie
echo um das Zielgebiet mit Hoehen-Offsets:
echo +80, +40, 0, -40, -80, -120 ft.
echo.
echo Ziel: herausfinden, ob das Fire-Asset ueber, auf oder unter
echo dem Terrain sichtbar wird.
echo.

if not exist "%TRACKER_EXE%" (
    echo FEHLER: VFR-Multitool-Tracker.exe wurde nicht in diesem Ordner gefunden.
    echo Ordner: %~dp0
    echo.
    pause
    exit /b 1
)

echo Starte Tracker...
start "GA Tracker Fire Offset Debug" "%TRACKER_EXE%"

echo Oeffne App-Testmodus...
timeout /t 2 /nobreak >nul
start "" "%APP_URL%"

echo.
echo Testablauf:
echo 1. In der App eine Fire-/Rauch-Mission generieren.
echo 2. Mission starten.
echo 3. PAX-Menue oeffnen und Debugbereich pruefen.
echo.
echo Erwartung im Debug:
echo extent=major_fire ^| fireSites=6 ^| fireTest=offset_ladder ^| kind=smoke:... ,fire:6
echo.
echo Die Tracker-Debugdatei liegt danach neben der EXE:
echo ga-tracker-debug.txt
echo.
pause
