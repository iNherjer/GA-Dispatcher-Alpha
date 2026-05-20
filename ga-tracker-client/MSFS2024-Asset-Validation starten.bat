@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "VALIDATOR_EXE=%~dp0MSFS2024-Asset-Validator.exe"
set "CATALOG_DEFAULT=%~dp0msfs2024-simobjects-catalog.json"

title MSFS 2024 Asset Spawn Validation
echo ============================================
echo GA Dispatcher - MSFS 2024 Spawn Validator
echo ============================================
echo.
echo Voraussetzung:
echo - MSFS 2024 ist im Flug geladen
echo - Flugzeug steht an einer echten Position, nicht im Hauptmenue
echo - Der Asset-Katalog liegt neben dieser BAT/EXE oder wird gleich angegeben
echo.
echo Ausgabe neben dieser BAT/EXE:
echo - msfs2024-spawn-validation.json
echo - msfs2024-spawn-validation.csv
echo - msfs2024-spawn-validation-debug.txt
echo - msfs2024-simobjects-validated-catalog.json
echo.

if not exist "%VALIDATOR_EXE%" (
    echo FEHLER: MSFS2024-Asset-Validator.exe wurde nicht in diesem Ordner gefunden.
    echo.
    echo Alternativ kann das Node-Script direkt laufen:
    echo node msfs-asset-validator.js --catalog="C:\Pfad\msfs2024-simobjects-catalog.json"
    echo.
    pause
    exit /b 1
)

if not "%~1"=="" (
    set "CATALOG_PATH=%~1"
) else (
    set "CATALOG_PATH=%CATALOG_DEFAULT%"
)

if not exist "%CATALOG_PATH%" (
    echo Katalog nicht gefunden:
    echo %CATALOG_PATH%
    echo.
    set /p "CATALOG_PATH=Pfad zu msfs2024-simobjects-catalog.json einfuegen oder leer lassen zum Abbrechen: "
)

if "%CATALOG_PATH%"=="" (
    echo Abgebrochen.
    pause
    exit /b 1
)

echo.
echo Katalog:
echo %CATALOG_PATH%
echo.
echo Modus waehlen:
echo   1 = schneller SimConnect-ACK Scan
echo       Prueft nur, ob der Titel per SimConnect angenommen wird.
echo   2 = manueller Sichttest einzeln
echo       Objekt bleibt stehen, du bestaetigst sichtbar/nicht sichtbar per Taste.
echo       Ein Cone_Medium wird daneben gespawnt, damit du den Ort findest.
echo   3 = Dry-Run Kandidatenliste ohne SimConnect
echo.
set /p "VALIDATION_MODE=Modus [1]: "
if "%VALIDATION_MODE%"=="" set "VALIDATION_MODE=1"

if "%VALIDATION_MODE%"=="2" (
    echo.
    echo Optional Rollenfilter, z.B. cargo.container,vehicle.car,person.ground_crew
    set /p "ROLE_FILTER=Rollenfilter oder leer fuer Standard: "
    if "%ROLE_FILTER%"=="" (
        "%VALIDATOR_EXE%" --catalog="%CATALOG_PATH%" --per-role=12 --max=160 --timeout-ms=2200 --manual-review --hold-ms=0 --pause-ms=120 --offset-m=35 --spacing-m=12 --review-marker-title="Cone_Medium" --vfx-review-delay-ms=3500
    ) else (
        "%VALIDATOR_EXE%" --catalog="%CATALOG_PATH%" --roles="%ROLE_FILTER%" --per-role=24 --max=160 --timeout-ms=2200 --manual-review --hold-ms=0 --pause-ms=120 --offset-m=35 --spacing-m=12 --review-marker-title="Cone_Medium" --vfx-review-delay-ms=3500
    )
) else if "%VALIDATION_MODE%"=="3" (
    "%VALIDATOR_EXE%" --catalog="%CATALOG_PATH%" --per-role=12 --max=160 --dry-run
) else (
    "%VALIDATOR_EXE%" --catalog="%CATALOG_PATH%" --per-role=12 --max=160 --timeout-ms=2200 --hold-ms=450 --pause-ms=180 --offset-m=35 --spacing-m=12
)

echo.
echo Validation beendet.
echo.
pause
