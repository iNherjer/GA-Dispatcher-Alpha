# Tracker v649 Alpha – Rückblick und Abschied: weniger Last, keine doppelten Kosten

Zusammen ausgeliefert mit Web v2463 (19.11.2026). Liefert außerdem die offenen Einträge der
Release-Warteschlange aus (EFB-Trainingsbanner auf Englisch, Infrastruktur-Ergebnis nach Zielkategorie).

## Änderungen

- **Vorprüfung im 5-s-Takt** (`tracker-mission-followup.js` `recapCandidateId`, `mission-authority-core.js`):
  Nur Charter-/Reporter-Hinflüge mit Rückreiseplan werden betrachtet; andere Missionen und schon
  vorgemerkte Aufträge kosten weder Snapshot noch Kopie der Missionsdaten.
- **Aufgegebener Rückblick beim Aussteigen** bleibt als Merker (`gaveUp`) stehen und wird nicht
  erneut eingereiht. Das Angebot geht ohne Aufenthalt hinaus; die App schreibt ihn einmal bei Fälligkeit.
- **SAR und Brandwache:** Abschied wird beim Aufsetzen nicht vorbereitet (`summaryAtDeboarding`,
  Log `MISSION_FAREWELL_VOICE_PREWARM_SKIPPED`), weil die Abschluss-Zusammenfassung erst beim
  Aussteigen entsteht. Spart je Mission einen KI-Text und eine Sprachausgabe. Rückblick-Start beim
  Aufsetzen unverändert.
- **Kürzen auf ganze Sätze** (`mission-charter-continuation-core.js`, auch Web): „Dr.“, „z. B.“,
  Einzelbuchstaben und Ordnungszahlen gelten nicht als Satzende.
- Aus der Warteschlange: EFB-Trainingsbanner englisch (Phase 3, 2.14); Infrastruktur-Ergebnis:
  Zielkategorie vor Missionstext, englische Wörter in den Mustern (2.15).
- `EFB_WEB_ASSET_REVISION` 64901.

## Build

- Tag `v649` auf `21dc07a66`, EXE 175176214 Bytes, SHA-256
  `fba6e43698fae67ef29629c45be9c7cacd9595dbb98e8da11bcbc33e8e6ec233`, öffentlicher Download geprüft.

## Tests

- Neue Tests: `tracker-mission-charter-recap.test.js` (aufgegebener Auftrag, Vorprüfung),
  `tracker-mission-farewell-voice.test.js` (SAR/Brand ohne Vorbereitung),
  `tracker-mission-sar-integration.test.js` (Hinweis kommt beim Aufsetzen an),
  `tools/mission-charter-continuation.test.cjs` (Abkürzungen).

## Prüfen im Feld

- Charter-/Reporter-Landung: `MISSION_FOLLOWUP_RECAP_TOUCHDOWN` und `MISSION_FOLLOWUP_RECAP_WRITTEN` wie bisher.
- SAR-/Brandwache-Landung: `MISSION_FAREWELL_VOICE_PREWARM_SKIPPED reason=summary_at_deboarding`,
  Abschied beim Aussteigen mit Suchergebnis.
- Fracht-/Schulungslandung: keine spürbare Last beim Aussteigen.
