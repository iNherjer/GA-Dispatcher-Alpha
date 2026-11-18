# Tracker v648 Alpha – Englische Missionsoberfläche im EFB (Phase 3)

Zusammen ausgeliefert mit Web v2451 (18.11.2026). Kein Code in `tracker.js` außer der Version;
der Release liefert die EFB-Dateien der englischen Übersetzung, Phase 3 (`docs/English Translation Plan.md` 2.10–2.13).

## Anlass

Mit englischer Oberfläche (Desktop-Schalter → Tracker `ui.language`) waren im EFB die
Missionstexte noch deutsch. Die Web-App hat die Teile seit v2447–v2450 schon live.

## Änderungen

- **Passagierfenster:** Titel, „Passagier“ und „Noch keine Nachricht.“ englisch (`_hT`).
- **Missionskarte** (`mission-control-ui-core.js`): übersetzt nur beim Zeichnen
  (`displayText`): feste Sätze über `i18n/en-phrases.js`, Sätze mit Zahlen über
  `DISPLAY_PATTERNS` (Fortschritt, Bedingungen, Lagebericht, Unterbrechung, POI-Statuszeilen).
  Zahlen und Uhrzeit nach `GAI18n.locale()`. Tracker-Ansicht und Modelle bleiben deutsch.
- **Verlade-Manager und Missionsbanner** (EFB-Host): `translateDom()` übersetzt das fertig
  gezeichnete Fenster bzw. die Bannerknöpfe; jeder Textknoten merkt sich den deutschen
  Ursprung, Zurückschalten stellt ihn exakt wieder her. Bannertexte und Entlade-Rückfrage über `_mT()`.
- Sprachwechsel zeichnet Verlade-Manager und Banner neu.
- EFB-Web-Dateien neu erzeugt (`efb-web-assets/i18n/en-phrases.js`).
- `EFB_WEB_ASSET_REVISION` 64801.

Deutsch bleibt zeichengleich (geprüft gegen den Vorstand). Noch deutsch: generierte Inhalte
(Missionstitel, Story, Ladungsnamen, Abschiedssatz → Phase 4), Trainingsbanner (nächster Schritt
in Phase 3), Behördenkontroll-Sätze mit Namen und Fristen.

## Tests

- `node --test *.test.js`: 1591/1598, 2 übersprungen. Die 5 Fehler (`tracker-free-flight-recorder`,
  `tracker-free-flight-runtime`, `tracker-mission-fire-integration`, `tracker-mission-sar-integration`
  ×2) sind zeitabhängig, laden keine geänderte Datei und schwanken auf dem v647-Stand genauso
  (SAR dort 2/1/0 Fehler bei drei Läufen); einzeln wiederholt grün.
- Alle 17 Electron-EFB-Oberflächentests (`tools/efb-*-ui-selftest.cjs` u. a.) grün, wie auf v647.
- Echte EFB-Seite in Electron auf Englisch: Missionskarte, Verlade-Fenster, Tooltip, Rückkehr zu
  Deutsch, keine Konsolenfehler.
- MSFS noch nicht geprüft.

## Feldtest

- EFB auf Englisch: Passagierfenster vor der ersten Nachricht, Missionskarte (Abschnittstitel,
  aktueller Auftrag, Fortschritt), Verlade-Manager beim Boarding und Entladen, Missionsbanner
  (Start, Taxi-Countdown, Ankunft), Mission abbrechen (Rückfrage), POI-Mission (Nächster Schritt).
- Sprachwechsel bei offenem Verlade-Manager.
- Deutsch unverändert.

## Artefakt

- Tag `v648`, Asset `VFR-Multitool-Tracker.exe`
- Größe: 175257958 Bytes
- SHA-256: 6447c9637da154bfc4ae4c49e175c746d4329fbec9081ede16b4ad9b640efaea (öffentlicher Download geprüft)
