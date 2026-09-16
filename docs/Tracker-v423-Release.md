# Tracker v423 Alpha

Missionsreset bleibt auch bei Payload-Problemen bedienbar: Baseline-Restore
versuchen, Payload-Lesen und Readback jeweils auf 1200 ms begrenzen; bei Fehlern
einmal Standardstationen auf 0 setzen. Auch ein fehlgeschlagener Nullsetzversuch
oder fehlende Simulatorverbindung blockiert den Reset nicht. Warnungen bleiben
im Ergebnis und Log sichtbar, unbestaetigte Schreibversuche gelten nicht als
verifizierte Wiederherstellung. Szenenbereinigung und Authority-Persistenz
bleiben geprueft. Alte Payload-Auftraege duerfen nach Abbruch nicht neu schreiben.

Bereits angenommene Resets desselben Runs scheitern nicht mehr an waehrend der
Bereinigung fortgeschrittenen Revisionen. Lokale Revisionskonflikte liefern den
Snapshot fuer den einmaligen Retry direkt. Die App wiederholt nach Tracker-
Abbruch keine Payload-Bereinigung; Clear-all sendet nicht noch bis zu 64 einzelne
Szenenloeschbefehle. Payload-Diagnose protokolliert Request-ID und Antwortdauer.

152 Tests bestanden (zwei Testfixtures beim Versionswechsel korrigiert und
betroffene 42 HTTP-/Web-Tests erneut erfolgreich ausgefuehrt). Der zusaetzliche alte Handoff-Selftest scheitert bereits unveraendert auf v422
an einem Test-Stub (`JSON.parse(undefined)`); kein neuer Fehler dieser Aenderung.
Windows-x64-PE mit pkg 6.18.1 und Node-18-Zielruntime, ohne V8-Bytecode gebaut. Kein nativer
Windows-/MSFS-Test auf diesem Mac. Die allgemeinen EFB-Verzoegerungen sind noch
nicht als behoben nachgewiesen.

Runtime v423, EFB-Assets 42301. Nur Alpha; Stable und EFB-Package unveraendert.
Feldtest: Tracker aktualisieren, App/EFB neu laden, laufende Mission zuruecksetzen.
Bei weiterem Haengen beide Logs sichern.

Asset: `VFR-Multitool-Tracker.exe`  
Groesse: 57747201 Bytes  
SHA-256: `ecb28401dad3bf5aa037fc6899955e007781fd7b9582f7ccc6948a96eab9649d`
