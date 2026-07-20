@echo off
setlocal
title VFR Multitool Homebase Asset Publisher stoppen

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$listeners = @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8797 -State Listen -ErrorAction SilentlyContinue);" ^
  "if ($listeners.Count -eq 0) { Write-Host 'Der Homebase Asset Publisher ist nicht aktiv.'; exit 0 };" ^
  "$listener = $listeners[0];" ^
  "try { $health = Invoke-RestMethod 'http://127.0.0.1:8797/api/health' -TimeoutSec 2 } catch { Write-Host 'Port 8797 ist belegt, antwortet aber nicht als Publisher. Der Prozess wird aus Sicherheitsgruenden nicht beendet.' -ForegroundColor Red; exit 9 };" ^
  "if ($health.app -ne 'homebase-asset-publisher') { Write-Host 'Port 8797 wird von einem fremden Dienst verwendet. Der Prozess wird nicht beendet.' -ForegroundColor Red; exit 9 };" ^
  "Write-Host ('Beende Homebase Asset Publisher v' + $health.version + ' (PID ' + $listener.OwningProcess + ') ...');" ^
  "Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop;" ^
  "for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 150; if (@(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8797 -State Listen -ErrorAction SilentlyContinue).Count -eq 0) { Write-Host 'Publisher wurde beendet.' -ForegroundColor Green; exit 0 } };" ^
  "Write-Host 'Der Publisher konnte nicht vollstaendig beendet werden.' -ForegroundColor Red; exit 10"

if errorlevel 1 pause
exit /b %ERRORLEVEL%
