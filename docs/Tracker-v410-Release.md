# Tracker v410 Alpha

## Feldtest-Fixes vom 15.09.2026 (Tracker v410)

- Cloud-Seeds enthalten absichtlich keine Live-Telemetrie. Auch vor `MISSION_STARTED`
  muss der Tracker Boden-/Stillstandsdaten verarbeiten. `PREFLIGHT_GROUND_OBSERVED`
  aktualisiert nur `onGround`/`groundStill`; keine Flugphasen, Landung, Recorder-
  oder Voice-Effekte. Wiederholte unveraenderte Samples schreiben nichts; alte
  Samples werden verworfen. Rollen, Offground, Pause/Menu und ungueltige
  Geschwindigkeit sperren die Bodenaktionen. Gilt gemeinsam fuer APT und POI.
- Projektionen muessen Manifest-Metadaten erhalten: `pilotId` und `aircraftLabel`
  werden ins EFB uebertragen; die Signatur verwendet vorrangig die Pilot-ID des
  autoritativen Manifests. Ein Display-Fallback darf keine echte Identitaet ersetzen.
- Freigegebene Tracker-Payload-Policy: bei Vorbereitung erzeugt `syncInitialPayload`
  einen dauerhaften `payload.sync_manifest_state`-Effekt. Der Simulatorhandler
  verwendet `replaceNonPilotPayload`: Pilotstation 1 und Fuel bleiben erhalten,
  alle Nicht-Pilot-Gewichte ergeben sich aus den geladenen Manifestpositionen,
  einschliesslich geerbter persistenter Ausruestung. Pending Cargo bleibt bei 0.
  Weitere Ladeaenderungen verwenden denselben Sollstand, keine Addition zur
  versehentlichen Sim-Beladung. Die originale Baseline bleibt fuer Recovery erhalten;
  bestehende Wiederherstellung bei Abort/Reset bleibt bestehen. Standalone-Aufrufer
  ohne diese Optionen behalten ihre bisherige additive Payload-Policy.
- PA24: bei Ersatzpolicy volle Sitz-/Charakter-/Gepaeckwerte schreiben. Die originale
  Recovery-Baseline ist kein gueltiger Vergleich fuer spaetere Schreiboptimierungen.
  Bestehende Readback-/Stabilisierungspruefungen bleiben aktiv; reale Ueberladung
  und zu viele Manifestpassagiere bleiben Fehler.
- EFB/Toolbar: direkter Button `Audio auf PC ausgeben` zusaetzlich zur vorhandenen
  Auswahl. Er benutzt `settings_update` mit zentraler Revision und `target.mode=pc`;
  keine zweite Playback-Autoritaet. Die bestehende zentrale Lease beendet die
  bisherige Ausgabe. Ein laufender Clip kann beim Wechsel neu beginnen.

Regressionen: Cloud-Start ohne Live-Seed, Bewegungs-/Pause-Gegenfaelle,
Manifestprojektion und Signatur, voller PA24/Standard-Sim, wiederholtes Laden/
Entladen mit unveraenderter Recovery, initialer Payload-Effekt genau einmal,
PC-Button. Payload-Standalone-Differentialtest weiterhin unveraendert bestanden.
Realer MSFS-Feldtest der neuen Version bleibt erforderlich.

Desktop 1.6.11 bleibt kompatibel; kein neuer Desktop-Installer erforderlich.
Stable bleibt unveraendert.

Validierung: 289 Node-Tests bestanden; Payload-App-Differentialtest (5 Szenarien) bestanden. Windows-EXE mit pkg node18-win-x64 gebaut. Kein realer MSFS-Test auf diesem Host.

Veroeffentlicht aus `af4a3873d`. Oeffentlicher EXE-Download verifiziert:
57.736.065 Bytes, SHA-256 `59b8b293fa3c1a2651c25b6496782d77e09887bc47dad7557f0d0ee9d74b435d`.
Alpha verweist auf v410; SW v1777.
