# Desktop 1.6.23 – Funk-Pause (PTT)

Basis: Desktop 1.6.22 (`origin/main`). Tracker-Runtime unverändert (`tracker.js` nicht geändert).

## Änderungen

- Neuer Bereich „Funk-Pause (PTT)“ im Audio-Panel: Joystick-Button (1–32) oder Taste
  per „Button lernen“ belegen. Der Button wird nur mitgelesen und bleibt PTT für
  MSFS, SayIntentions und Discord.
- Jeder Druck hält Stimmen und Warnungen an (Pausieren oder Leiser) und senkt die
  Musik ab (Leiser = Standard, Pausieren oder Unverändert).
- Loslassen startet den Auto-Resume-Timer (10/20/30/40/60/90 s oder aus, Standard
  30 s); jeder weitere Funkspruch startet ihn neu. Optional setzt ein kurzer Druck
  (< 0,6 s) während einer Pause sofort fort. „Jetzt fortsetzen“ in der App.
- Pausierte Ansagen gehen mit Position an die Tracker-Queue zurück und laufen ab
  1,5 s vor der Unterbrechung weiter; Warnsegmente starten neu.
- Musik wird nur neu gestartet, wenn die Funk-Pause sie selbst angehalten hat.
- Gilt für die Audioausgabe „PC“ (Desktop-App).

## Diagnose

`funk-pause-log.txt` im Tracker-Datenordner (Einstellungen → Datenordner öffnen),
ab 512 KB neu begonnen:

- `START`/`SETTINGS`: Version, Windows-Build, aktuelle Einstellungen.
- `INPUT helper …`: Start, Ende mit Exit-Code, PowerShell-Fehlerausgabe (Kompilierfehler
  von `windows-input.cs` erscheinen hier), gefundene Joysticks mit VID/PID/Buttonanzahl.
- `INPUT button down` / `button up heldMs=…`, `device connected=…`, `learn result …`.
- `HOLD hold|transmit|released|timer|short-press|manual …` mit Restzeit und Modus.
- `MUSIC …` jeder Musikbefehl mit Ergebnis.
- `VOICE hold … active=<effectId> stage=… offset=…` und `VOICE claim … resume …`.

Tastendrücke werden nur während „Button lernen“ ausgewertet; danach nur die belegte Eingabe.

## Prüfung

- 116 Desktop-Tests (113 bestanden, 3 Windows-only übersprungen), 20 Player-/Asset-Tests.
- Nicht auf Windows vorgeprüft: Kompilierung des C#-Helfers und reale Joystick-Erkennung.
  Abnahme erfolgt im Live-Test über `funk-pause-log.txt`.

## Aktivierung (19.10.2026)

Öffentlicher Download geprüft (100279140 Bytes, SHA-512 wie `latest.yml`, Blockmap identisch).
`latest.yml` und `alpha.yml` aktiviert.
