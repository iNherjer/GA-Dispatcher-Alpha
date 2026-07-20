@echo off
setlocal
title VFR Multitool Homebase Asset Publisher
cd /d "%~dp0"
set "HOMEBASE_ASSET_PUBLISHER_DATA=C:\RohDaten\VFR-Multitool-Homebase-Asset-Publisher\Homebase-Asset-Publisher-Data"
echo VFR Multitool Homebase Asset Publisher 0.4.0
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo FEHLER: Node.js wurde nicht gefunden.
  echo Bitte Node.js 18 oder neuer installieren und den Publisher danach erneut starten.
  pause
  exit /b 2
)
if not exist "seed\catalog.json" (
  echo FEHLER: Der Seed-Katalog fehlt.
  echo Bitte nicht direkt aus dem ZIP starten. Das gesamte ZIP zuerst entpacken.
  pause
  exit /b 3
)
if not exist "web\index.html" (
  echo FEHLER: Die Weboberflaeche fehlt.
  echo Bitte das gesamte ZIP erneut entpacken.
  pause
  exit /b 4
)
if not exist "publisher-server.mjs" (
  echo FEHLER: Der Publisher-Server fehlt.
  echo Bitte das gesamte ZIP erneut entpacken.
  pause
  exit /b 5
)
powershell -NoProfile -Command "$listeners = @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8797 -State Listen -ErrorAction SilentlyContinue); $listener = $listeners[0]; if ($null -eq $listener) { exit 0 }; try { $health = Invoke-RestMethod 'http://127.0.0.1:8797/api/health' -TimeoutSec 2 } catch { Write-Host 'FEHLER: Port 8797 ist belegt, aber der Dienst antwortet nicht als Publisher.' -ForegroundColor Red; exit 9 }; if ($health.app -ne 'homebase-asset-publisher') { Write-Host 'FEHLER: Port 8797 wird von einem fremden Dienst verwendet. Er wird nicht beendet.' -ForegroundColor Red; exit 9 }; Write-Host ('Beende vorhandenen Homebase Asset Publisher v' + $health.version + ' (PID ' + $listener.OwningProcess + ') ...'); Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop; for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 150; $remaining = @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8797 -State Listen -ErrorAction SilentlyContinue); if ($remaining.Count -eq 0) { exit 0 } }; Write-Host 'FEHLER: Der alte Publisher hat Port 8797 nicht freigegeben.' -ForegroundColor Red; exit 10"
if errorlevel 1 (
  echo.
  echo Der aktuelle Publisher wurde aus Sicherheitsgruenden nicht gestartet.
  pause
  exit /b 6
)
echo Der Publisher wird gestartet. Dieses Fenster bitte geoeffnet lassen.
echo.
node "%~dp0publisher-server.mjs"
set "PUBLISHER_EXIT=%ERRORLEVEL%"
echo.
echo Der Publisher wurde mit Code %PUBLISHER_EXIT% beendet.
if exist "Homebase-Asset-Publisher-startup.log" (
  echo.
  echo Letzte Diagnosemeldungen:
  type "Homebase-Asset-Publisher-startup.log"
)
echo.
pause
exit /b %PUBLISHER_EXIT%
