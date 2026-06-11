@echo off
cd /d "%~dp0"

echo =====================================
echo  05 Mit DRSM - Visual Motion
echo =====================================
echo.
echo DRSM oeffnen, MSFS Source aktivieren, unser Tracker bleibt aus.
echo In der Luft aktiv fliegen: kraeftig rollen, pitchen, abfangen.
echo Dauer: 120 Sekunden
echo Ausgabe: 05-mit-drsm-visual-motion.csv
echo.

SimConnect-Jitter-Test.exe --period=visual --mode=motion --duration=120 --csv=05-mit-drsm-visual-motion.csv --pause=off

echo.
echo Fertig: 05-mit-drsm-visual-motion.csv
pause
