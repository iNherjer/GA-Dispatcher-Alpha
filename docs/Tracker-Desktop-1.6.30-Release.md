# Desktop 1.6.30 – Funk-Pause erkennt Programme automatisch

Basis: Desktop 1.6.29 (`origin/main`). Tracker-Runtime unverändert.

## Änderungen

- Neu in der Funk-Pause: „Programme automatisch erkennen“. Bis zu 8 Programme
  (z. B. SayIntentions, Discord) wirken wie ein gedrückter Funk-Button, solange sie
  Ton ausgeben; 1,5 s Ruhe zählt als Loslassen, danach läuft der gemeinsame Timer.
- Pro Programm: *Wie PTT* (gemeinsame Regeln) oder *Nur leiser* (Stimmen, Warnungen
  und Musik nur absenken), Empfindlichkeit niedrig/mittel/hoch (Pegel 0,10/0,03/0,01,
  Mindestdauer 600/300/100 ms). Pausieren gewinnt gegen Leiser.
- Kurzer PTT-Druck setzt auch über ein sprechendes Programm fort; dieses löst erst
  nach dem nächsten Stillwerden wieder aus.
- „+ Programm hinzufügen“ zeigt eine Minute lang alle Programme mit Ton und Live-Pegel;
  jede Zeile hat Pegelbalken mit Schwellenmarke und ✕.
- Nativ: `lib/windows-audio-meter.cs` liest die Spitzenpegel der Windows-
  Audiositzungen (IAudioMeterInformation, 50 ms) im Eingabe-Helfer. Nur Pegel, keine
  Aufnahme; eigene App-Prozesse ausgenommen.
- Log: `DETECTION …`, `INPUT audio start/end name=… peak=… ms=…`, `INPUT meter mode=…`,
  `HOLD audio-start/-join/-end … programs=…`.

## Prüfung

- 132 Desktop-Tests (129 bestanden, 3 Windows-only übersprungen), neu: Regeln und
  Empfindlichkeit, Wie PTT/Nur leiser, PTT plus Programme, kurzer Druck über
  sprechendes Programm, Entfernen, Helferausfall, Meter-Protokoll.
- Oberfläche im Browser mit simulierten Pegeln geprüft (Picker, Hinzufügen,
  Moduswechsel, aktive Zeile, Status).
- Nicht auf Windows vorgeprüft: Kompilierung der Pegelmessung und reale Pegel.
  Abnahme im Feldtest über `funk-pause-log.txt`.
