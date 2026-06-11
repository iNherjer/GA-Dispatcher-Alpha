@echo off
cd /d "%~dp0"

echo =====================================
echo  02 Flug Aktiv - Visual Minimal
echo =====================================
echo.
echo In der Luft aktiv fliegen: kraeftig rollen, pitchen, abfangen.
echo Dauer: 120 Sekunden
echo Ausgabe: 02-flug-aktiv-visual-minimal.csv
echo.

SimConnect-Jitter-Test.exe --period=visual --mode=minimal --duration=120 --csv=02-flug-aktiv-visual-minimal.csv --pause=off

echo.
echo Fertig: 02-flug-aktiv-visual-minimal.csv
pause
