@echo off
setlocal
cd /d "%~dp0"

set "SCANNER_EXE=%~dp0MSFS2024-Asset-Scanner.exe"

title MSFS 2024 Asset Scan
echo ============================================
echo GA Dispatcher - MSFS 2024 Asset Scanner
echo ============================================
echo.
echo Das Tool sucht MSFS 2024 SimObjects in Official2024,
echo StreamedPackages, Community2024 und Community.
echo.
echo Ausgabe neben dieser BAT/EXE:
echo - msfs2024-simobjects.json
echo - msfs2024-simobjects.csv
echo - msfs2024-simobjects-debug.txt
echo - msfs2024-simobjects-scene-candidates.txt
echo.

if not exist "%SCANNER_EXE%" (
    echo FEHLER: MSFS2024-Asset-Scanner.exe wurde nicht in diesem Ordner gefunden.
    echo.
    echo Alternativ kann das Node-Script direkt laufen:
    echo node msfs-asset-scanner.js --packages="D:\Pfad\zu\MSFS\Packages"
    echo.
    pause
    exit /b 1
)

echo Starte Scan...
"%SCANNER_EXE%"

echo.
echo Scan beendet. Falls keine Packages gefunden wurden:
echo MSFS2024-Asset-Scanner.exe --packages="D:\Pfad\zu\MSFS\Packages"
echo.
pause
