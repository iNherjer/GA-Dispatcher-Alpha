@echo off
cd /d "%~dp0"

echo =====================================
echo  01 Boden Still - Visual Minimal
echo =====================================
echo.
echo MSFS-Flug geladen, Flugzeug am Boden stehen lassen.
echo Dauer: 120 Sekunden
echo Ausgabe: 01-boden-still-visual-minimal.csv
echo.

SimConnect-Jitter-Test.exe --period=visual --mode=minimal --duration=120 --csv=01-boden-still-visual-minimal.csv --pause=off

echo.
echo Fertig: 01-boden-still-visual-minimal.csv
pause
