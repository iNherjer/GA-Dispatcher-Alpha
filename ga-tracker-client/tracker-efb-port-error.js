'use strict';
const { spawn } = require('node:child_process');

function portErrorMessage(error, port) {
  if (!['EADDRINUSE', 'EACCES'].includes(error && error.code)) return null;
  const number = Number.isInteger(Number(port)) ? Number(port) : 49880;
  return error.code === 'EADDRINUSE'
    ? `Die EFB-Verbindung konnte nicht gestartet werden: Port ${number} ist bereits belegt.\n\nBitte prüfen, ob eine zweite Tracker-Instanz oder ein anderes Programm diesen Port verwendet.`
    : `Die EFB-Verbindung konnte nicht gestartet werden: Windows verweigert den Zugriff auf Port ${number}.\n\nDer Port kann reserviert, exklusiv belegt oder gesperrt sein. Bitte die Windows-Portdiagnose prüfen. Der Tracker läuft weiter, aber EFB und Toolbar können sich nicht verbinden.`;
}

function notifyEfbPortError(error, port, options = {}) {
  const message = portErrorMessage(error, port);
  if (!message) return false;
  const log = options.log || (() => {});
  log(`EFB_PORT_NOTICE code=${error.code} port=${Number(port)} message=${message.replace(/\n/g, ' ')}`);
  if ((options.platform || process.platform) !== 'win32') return true;
  const quoted = message.replace(/'/g, "''");
  const script = `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${quoted}', 'VFR Multitool – EFB-Verbindung', 'OK', 'Warning') | Out-Null`;
  try {
    const child = (options.spawn || spawn)('powershell.exe', ['-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: 'ignore' });
    child.on('error', failure => log(`EFB_PORT_NOTICE_FAILED error=${failure.message}`));
    child.unref();
  } catch (failure) { log(`EFB_PORT_NOTICE_FAILED error=${failure.message}`); }
  return true;
}
module.exports = { portErrorMessage, notifyEfbPortError };
