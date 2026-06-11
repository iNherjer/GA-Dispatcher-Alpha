@echo off
cd /d "%~dp0"

echo =====================================
echo  GA SimConnect Jitter Test
echo =====================================
echo.
echo Standardlauf: VISUAL_FRAME, minimaler SimVar, 120 Sekunden
echo.

SimConnect-Jitter-Test.exe --period=visual --duration=120 --csv=jitter-visual-minimal.csv --pause=off

echo.
echo Alternative Tests:
echo   SimConnect-Jitter-Test.exe --period=sim --duration=120 --csv=jitter-sim-minimal.csv
echo   SimConnect-Jitter-Test.exe --period=visual --mode=motion --duration=120 --csv=jitter-visual-motion.csv
echo.
pause
