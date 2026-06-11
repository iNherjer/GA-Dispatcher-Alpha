@echo off
cd /d "%~dp0"

echo =====================================
echo  04 Flug Aktiv - SIM_FRAME Motion
echo =====================================
echo.
echo In der Luft aktiv fliegen: kraeftig rollen, pitchen, abfangen.
echo Dieser Lauf misst SIM_FRAME statt VISUAL_FRAME.
echo Dauer: 120 Sekunden
echo Ausgabe: 04-flug-aktiv-sim-motion.csv
echo.

SimConnect-Jitter-Test.exe --period=sim --mode=motion --duration=120 --csv=04-flug-aktiv-sim-motion.csv --pause=off

echo.
echo Fertig: 04-flug-aktiv-sim-motion.csv
pause
