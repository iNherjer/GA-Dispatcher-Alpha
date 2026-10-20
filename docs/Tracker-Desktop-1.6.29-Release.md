# Desktop 1.6.29 – Aufgeräumtes Audio-Panel

Basis: Desktop 1.6.28 (`origin/main`). Tracker-Runtime unverändert.

## Änderungen

- Reihenfolge: Ausgabe (Audioausgabe, PC-Ausgang, Lautstärke, Audio aktiviert) →
  Voice-Key (Provider, API-Key) → Klappmenü „Stimmen, Effekte und Warnungen“ →
  Musik / Windows-Player → Funk-Pause.
- Musik / Windows-Player zeigt nur noch Player-Auswahl, „Bei Stimmen und Warnungen
  leiser“ und Restlautstärke; Titel, Wiedergabetasten und Musiklautstärke entfallen
  im Desktop-Fenster (EFB-/Web-Player unverändert).

## Prüfung

- 123 Desktop-Tests (120 bestanden, 3 Windows-only übersprungen).
- Reihenfolge in der statischen Vorschau geprüft.

## Aktivierung (20.10.2026)

Öffentlicher Download geprüft (100280954 Bytes, SHA-512 wie `latest.yml`, Blockmap identisch).
`latest.yml` und `alpha.yml` aktiviert.
