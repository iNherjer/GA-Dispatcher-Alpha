@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "SCANNER_EXE=%~dp0MSFS2024-Asset-Scanner.exe"

title MSFS 2024 Asset Scan
echo ============================================
echo GA Dispatcher - MSFS 2024 Asset Scanner
echo ============================================
echo.
echo Das Tool sucht MSFS 2024 SimObjects in Official2024,
echo StreamedPackages, Community2024, Community sowie losen
echo SimObjects/VFSProjection-Ordnern.
echo.
echo Ausgabe neben dieser BAT/EXE:
echo - msfs2024-simobjects.json
echo - msfs2024-simobjects-catalog.json
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

if not "%~1"=="" (
    echo Starte Scan mit manuellem Pfad:
    echo %~1
    echo.
    "%SCANNER_EXE%" --packages="%~1"
) else (
    echo Starte Auto-Scan...
    "%SCANNER_EXE%"
)

if errorlevel 2 (
    echo.
    echo Auto-Scan hat keinen Packages-Ordner gefunden.
    echo Du kannst den MSFS Packages-Ordner hier einfuegen.
    echo Beispiele:
    echo   D:\MSFS2024\Packages
    echo   C:\Users\DEINNAME\AppData\Roaming\Microsoft Flight Simulator 2024
    echo   C:\Users\DEINNAME\AppData\Local\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\Packages
    echo.
    set /p "PACKAGES_PATH=Packages-Pfad oder leer lassen zum Abbrechen: "
    if not "%PACKAGES_PATH%"=="" (
        echo.
        echo Starte Scan mit:
        echo %PACKAGES_PATH%
        echo.
        "%SCANNER_EXE%" --packages="%PACKAGES_PATH%"
    )
)

echo.
echo Scan beendet. Falls keine Packages gefunden wurden:
echo MSFS2024-Asset-Scanner.exe --packages="D:\Pfad\zu\MSFS\Packages"
echo.
pause
