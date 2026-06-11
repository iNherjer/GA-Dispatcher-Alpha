@echo off
cd /d "%~dp0"

echo =====================================
echo  03 Flug Aktiv - Visual Motion
echo =====================================
echo.
echo In der Luft aktiv fliegen: kraeftig rollen, pitchen, abfangen.
echo Dieser Lauf fragt motion-aehnliche SimVars ab.
echo Dauer: 120 Sekunden
echo Ausgabe: 03-flug-aktiv-visual-motion.csv
echo.

SimConnect-Jitter-Test.exe --period=visual --mode=motion --duration=120 --csv=03-flug-aktiv-visual-motion.csv --pause=off

echo.
echo Fertig: 03-flug-aktiv-visual-motion.csv
pause
