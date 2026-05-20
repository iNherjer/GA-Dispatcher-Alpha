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
echo Starte Validation mit:
echo %CATALOG_PATH%
echo.
echo Tipp: Erst mit --dry-run testen:
echo MSFS2024-Asset-Validator.exe --catalog="%CATALOG_PATH%" --dry-run
echo.

"%VALIDATOR_EXE%" --catalog="%CATALOG_PATH%" --per-role=12 --max=160 --timeout-ms=2200 --hold-ms=450 --pause-ms=180

echo.
echo Validation beendet.
echo.
pause
