@echo off
setlocal
cd /d "%~dp0"

set "APP_URL=https://inherjer.github.io/GA-Dispatcher-Alpha/?swBypass=1^&fireDebug=1^&fireTruth=fire^&fireExtent=major_fire^&fireSpawnMode=target^&fireTest=fire_only_ladder^&fireAltOffset=0^&fireCount=1^&fireRadius=0^&testBuild=fire-only-v2"
set "TRACKER_EXE=%~dp0VFR-Multitool-Tracker.exe"

title GA Dispatcher Fire Only Test
echo ============================================
echo GA Dispatcher - Fire Only Test
echo ============================================
echo.
echo Dieser Test sendet KEINEN Rauch an den Tracker.
echo Er spawnt nur VO_Fire_R1_40 in einer kleinen Linie
echo mit Hoehen-Offsets:
echo +80, +40, 0, -40, -80, -120 ft.
echo.
echo Ziel: pruefen, ob das Fire-Asset ueber SimConnect
echo ueberhaupt sichtbar gerendert wird.
echo.

if not exist "%TRACKER_EXE%" (
    echo FEHLER: VFR-Multitool-Tracker.exe wurde nicht in diesem Ordner gefunden.
    echo Ordner: %~dp0
    echo.
    pause
    exit /b 1
)

echo Starte Tracker...
start "GA Tracker Fire Only Debug" "%TRACKER_EXE%"

echo Oeffne App-Testmodus...
timeout /t 2 /nobreak >nul
start "" "%APP_URL%"

echo.
echo Testablauf:
echo 1. In der App eine Fire-/Rauch-Mission generieren oder vorhandene Mission nutzen.
echo 2. Mission starten.
echo 3. PAX-Menue oeffnen und "Test: Rauch erzwingen" druecken, falls nicht automatisch gespawnt wird.
echo.
echo Erwartung im Debug:
echo fireTest=fire_only_ladder ^| fireOnly=1 ^| req=fire:6 ^| kind=fire:6
echo.
echo Wenn fire:6 drinsteht und trotzdem kein Feuer sichtbar ist,
echo rendert MSFS dieses Fire-Asset ueber SimConnect vermutlich nicht brauchbar.
echo.
pause
