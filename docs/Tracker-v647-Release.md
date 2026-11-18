# Tracker v647 Alpha – Tolerante Rückblick-Prüfung, Folgemission immer baubar

Zusammen ausgeliefert mit Web v2446 (18.11.2026).

## Anlass

Die Lahr-Rückflug-Anfrage bekam zweimal eine Antwort von Gemini, beide wurden als
`invalid_draft` verworfen. Die Prüfung lehnte den ganzen Entwurf ab, sobald ein Textfeld zu lang
oder ein einzelner Gesprächsmoment fehlerhaft war; beim Annehmen hätte dieselbe Prüfung die
Folgemission mit „Der Charter-Rückblick ist unvollständig“ abgebrochen.

## Änderungen

- `repairDraft`: Zu lange Felder auf ganze Sätze kürzen (Aufenthalt 1200, übrige 600,
  Kartentext 350), ungültige Gesprächsmomente einzeln weglassen, Ortsmomente über `anchorId`
  bzw. Nähe an den belegten Ortsbezug binden. Verworfen nur bei leerem Pflichtfeld.
- `correctionPrompt`: Korrekturrunde nennt der KI die konkreten Gründe (App beim Annehmen,
  App-Rückfall, Tracker-Schreiber).
- Annehmen in der App (Charter, Reporter): sonst schlichter Aufenthalt aus den festen Daten
  (`fallbackDraft`), nicht gespeichert. Die Folgemission scheitert nicht mehr am Rückblick.
- App-Rückfall: `recapError` nennt fehlende Felder; Fehlschläge nach der alten Prüfung
  (`recapRule` < 2) bekommen einen neuen Versuch.
- Tracker-Log: `MISSION_FOLLOWUP_RECAP_WRITTEN … repaired=<n>`,
  `MISSION_FOLLOWUP_RECAP_FAILED … issues=[…]`.
- EFB-Web-Dateien neu erzeugt (enthält die englischen Texte aus `e4b0e9d7c`).
- `EFB_WEB_ASSET_REVISION` 64701.

## Tests

- Neu: tolerante Prüfung (Kürzen, Momente weglassen, Ortsbezug), Annehmen mit unbrauchbarem
  Entwurf → gezielte Korrektur → schlichter, nicht gespeicherter Aufenthalt; alter Fehlschlag
  bekommt einen Versuch.
- MSFS noch nicht geprüft.

## Feldtest

- Lahr-Karte: nach dem App-Neuladen einmaliger Versuch; Debug-Zeile `Rückblick: vorhanden …`.
- Rückflug annehmen: Mission entsteht auch bei schlechter KI-Antwort.

## Artefakt

- Tag `v647`, Asset `VFR-Multitool-Tracker.exe`
- Größe: 175202422 Bytes
- SHA-256: 13132177d0aeb29b3520064728393634e3bafc8e2a3e4ac504111bb5894cb00e (öffentlicher Download geprüft)
