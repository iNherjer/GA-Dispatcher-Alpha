# Tracker v438 Alpha

POI-Ketten fuer Infrastruktur-Erstbefunde koennen jetzt aus der Cloud geladen und
im Tracker gestartet werden. Punkt- und Korridortrigger verwenden die originale
Standalone-Logik im separaten Mission-Worker; Telemetrie-Empfang bleibt im Parent.

- Gemeinsamer Start mit Verladen/Signatur, Rueckflug und Missionsabschluss.
- Originale PAX-Meldungen, Status/Orientierung und Fotobursts vor/nach der Sprache.
- Ketten-/Korridorfortschritt und progressiver Overlay in EFB und App.
- Kurze plausible Telemetrieluecken werden lokal ueberbrueckt; unterbrochene
  Korridorabschnitte muessen neu angesetzt werden, erledigte Arbeit bleibt.
- Vorbereitete Folgeangebote verwenden nach Abschluss weiterhin die Originalregeln.

Vergleichstests gegen eingefrorene Standalone-Funktionen sowie automatisierte
Authority-, Cloud-, Audio-, EFB- und Prozesspruefungen. MSFS-Feldtest ausstehend.
Andere noch nicht migrierte Spezialmissionen bleiben gesperrt.
