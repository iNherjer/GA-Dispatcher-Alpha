# Tracker v418 Alpha

## Autonome Folgeangebote

Der Tracker verwendet dieselben Funktionen aus `mission-followup.js`,
`mission-infra-outcome-core.js` und `mission-private-return-core.js` wie die App.
Die ersten beiden Module besitzen lediglich einen injizierbaren Host fuer Speicher,
Zeit und UI. Fachliche Erzeugung, Fristen, IDs, Merge und Tombstones bleiben original.
Private Rueckfluege verlangen gemessene Flug- und Zielevidenz; Charter-Abholung und
Infrastruktur-Folgeangebote behalten ihre bisherigen Regeln und den gespeicherten Befund.

Erst nach bestaetigtem Missionsabschluss und abgeschlossenen Effekten werden
Abschluss und Folgeangebot zusammen atomar im Authority-Speicher gesichert.
Ein pilotgebundener Postausgang ueberlebt Neustarts, Netzfehler und fehlgeschlagene
lokale Bestaetigungen. Angenommene/abgelehnte Angebote werden beim Merge nicht
wieder zu offenen Angeboten. Ein voller Postausgang (64 Abschluesse) blockiert
weitere betroffene Finalisierungen, statt Daten zu verwerfen.

Ein lokaler 5-Sekunden-Timer verursacht bei leerem Postausgang keine Requests.
Bei offenen Angeboten: V2-Profil lesen, Original-Merge, unveraenderte Pakete
wiederverwenden, nur Aenderungen committen. Konflikte werden neu eingelesen;
kein Force-Overwrite. Fehler erhalten einen Backoff bis fuenf Minuten.
Das erstmalige Lesen kann das gesamte Profil benoetigen; danach hilft der
Chunk-Cache. Neue Worker-Writes fallen nur fuer neue Paketdaten und Commit an,
nicht pro Telemetrie oder Timer. Keine neue Worker-Version erforderlich.

Voraussetzung ist ein bereits mit der App nach Cloud-Sync V2 gespeichertes Profil.
Legacy-Profile werden nicht blind ersetzt: der Auftrag bleibt lokal vorgemerkt
(`MISSION_FOLLOWUP_PENDING error=followup_requires_profile_v2`). Nach einem
V2-Speichern der App erfolgt der naechste Versuch automatisch. Angebote erscheinen
nach Cloud-Synchronisierung in der vorhandenen App-Follow-up-Oberflaeche; diese
Aenderung fuehrt kein neues EFB-Angebotsmenue ein.

## Sightseeing

`sightseeing_tour` ist im App-Builder und Tracker-Gate verfuegbar, sofern ein
akzeptierter Wissenskontext mit Fakten und der vollstaendige POI-Vertrag vorliegen.
Originale Wissensauswahl, Stufenpriorisierung und Wiederholungsvermeidung sind
in den generierten Voice-Core uebernommen. Gesprochener Kontext (max. 4000 Zeichen)
bleibt im Missionszustand und im Replay erhalten, bereits vor dem Audio-ACK.
Boarding und weitere passende Sprachbeitraege speisen dieselbe Erinnerung.
Start, Pflichtladung, Zielpruefung, Rueckkehr, Entladen und Abschluss verwenden
die vorhandene originale POI-Lifecycle-Integration.

Korrektur zur Planung in v417: Manuelles „Erzaehl mal“ gehoert in der Standalone-App
nur zu `poi_learning_guide`, nicht zu Sightseeing. Diese Unterscheidung bleibt.
Historiker, Lern-Guide, Mapping, Ketten, SAR und Fire-Watch bleiben separat zu
migrieren. Ein erzeugtes Folgeangebot oeffnet deren Ausfuehrungsgate nicht.

## Validierung

- Originalvergleich: 1568 Voice-, 2688 Aktions-, 5040 Lifecycle-, 224 Farewell-
  und 864 Cargo-Stress-Vergleiche erfolgreich.
- Vollstaendiger Sightseeing-Ablauf inklusive Neustart, Entladen und Abschluss.
- Wissenserinnerung: Persistenz und identischer Browser-/Tracker-Replay-Hash.
- Folgeangebote: Original-App-Paritaet, private Abschlussbedingungen,
  Infrastruktur-Befunde, atomarer Abschluss, Neustart und Pilotentrennung.
- Cloud: Netzfehler, CAS-Konflikt, fehlgeschlagenes lokales ACK, keine doppelten
  Commits nach Retry und Erhalt fremder Profilfelder.
- Bestehende Missions-, Private-Return- und EFB-Regressionstests.

In-Sim-Flug und echte Audioausgabe bleiben als Praxistest offen.
Runtime v418; Desktop 1.6.11 und EFB-Package 0.4.14 bleiben kompatibel.
