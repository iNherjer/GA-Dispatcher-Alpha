# Tracker v411 Alpha

- Verlade-Signatur nutzt die echte Pilot-ID des Trackers. Alte technische
  `Tracker`-Signaturen werden im EFB mit der Pilot-ID angezeigt.
- Wieder aufklappbarer PAX-Button fuer den letzten bestaetigten Text und Sprecher.
  Missionsstatus und Orientierung fuer POI sind dort erreichbar; bestehende
  Authority-/Phasengates bleiben erhalten. APT-Texte sind ebenfalls lesbar.
- POI-Routen erscheinen wieder: undefinierten Popup-Helper entfernt, sichere
  Textanzeige, Routenaufbau mit Wiederholung nach Fehlern.
- Unveraenderte POI-Lifecycle-Flags erzeugen keine dauernden Schreibvorgaenge mehr.
  Vollstaendige Minutenprobe: 15 statt 134 semantischer Commits, davon 2 statt
  120 Lifecycle-Events; Task-Checkpoints und kritische Uebergaenge unveraendert.
- Kurze Snapshot-Verzoegerungen loeschen nicht sofort die Fluganzeige.
  Renderfehler werden separat gemeldet; echte Ausfaelle und deren Ursachen
  bleiben sichtbar. Weitere Diagnose fuer Nebenabfragen.

Validierung: 314 Tracker-/EFB-Tests bestanden, lokale Electron-Browserprobe
fuer Route/Retry/PAX bestanden. Original-App-Vergleiche: 4320 Lifecycle-,
192 Farewell-, 864 Cargo-, 2304 manuelle POI- und 1344 Voice-Vergleiche;
Payload-App-Differentialtest mit 5 Szenarien bestanden.

Der Lifecycle-Fehler bestand bereits vor v410. Die Korrektur reduziert die
Schreiblast, aber ein echter Windows-/MSFS-Test muss bestaetigen, ob auch die
langen Aussetzer verschwinden. Auf diesem Host kein realer MSFS-Test.

Desktop 1.6.11 bleibt kompatibel. Kein neues Community-Package erforderlich.
Stable bleibt unveraendert. Migrationslehren sind im Tracker Mission Migration
Guide und EFB-Development-Plan dokumentiert.
