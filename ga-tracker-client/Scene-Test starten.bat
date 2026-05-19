@echo off
setlocal
cd /d "%~dp0"

set "SCENE_VEHICLE=Car Bush Firefighting"
set "SCENE_PERSON=Tarmac_Female_Summer_Asian"
set "APP_URL=https://inherjer.github.io/GA-Dispatcher-Alpha/?swBypass=1^&fireDebug=1^&sceneDebug=1^&sceneAuto=1^&testBuild=scene-v3"
set "TRACKER_EXE=%~dp0VFR-Multitool-Tracker.exe"

title GA Dispatcher Scene Test
echo ============================================
echo GA Dispatcher - Scene Test
echo ============================================
echo.
echo Dieser Test spawnt beim Missionsstart vorne links am Flugzeug:
echo - %SCENE_VEHICLE%
echo - %SCENE_PERSON%
echo.
echo Falls CREATE_OBJECT_FAILED kommt:
echo Der Tracker probiert automatisch auch die alten Test-Namensvarianten.
echo.
echo Position:
echo Feuerwehrfahrzeug ca. 22 m vor und 12 m links vom Flugzeug.
echo Person ca. 14 m vor und 5 m links vom Flugzeug.
echo Beide schauen zum Flugzeug.
echo.

if not exist "%TRACKER_EXE%" (
    echo FEHLER: VFR-Multitool-Tracker.exe wurde nicht in diesem Ordner gefunden.
    echo Ordner: %~dp0
    echo.
    pause
    exit /b 1
)

echo Starte Tracker...
start "GA Tracker Scene Debug" "%TRACKER_EXE%"

echo Oeffne App-Testmodus...
timeout /t 2 /nobreak >nul
start "" "%APP_URL%"

echo.
echo Testablauf:
echo 1. Im Sim am Boden bleiben.
echo 2. App verbinden und Mission manuell starten.
echo 3. Szene sollte automatisch spawnen.
echo 4. Im PAX-Debug gibt es zusaetzlich:
echo    "Test: Feuerwehr Szene" und "Test: Szene entfernen".
echo.
echo Erwartung im Tracker:
echo COMMAND mission_scene_spawn
echo SCENE_SPAWN_START ... byKind={"vehicle":1,"person":1}
echo.
echo Debugdatei neben der EXE:
echo ga-tracker-debug.txt
echo.
pause
