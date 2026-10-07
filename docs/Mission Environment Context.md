# Gemeinsamer Umgebungskontext

Stand: 07.10.2026. Lokaler Pilot, nur Bush mit eingeschalteter KI; kein Release.

`mission-environment-core.js` fasst Modelldaten zusammen und liefert denselben
Erzählvertrag. `mission-environment-browser.js` übernimmt optionale Abfragen,
RAM-Cache und Zeitlimit. Weitere Missionsfamilien können später dieselben Daten
verwenden; keine eigene Wetterlogik pro Prompt. Keine Relevanzwertung, Quoten,
Wetter-Motiv-Zuordnung oder Änderung an Profil, History oder Erfolgskriterien.

Die lokale Gerätezeit ist Erstellungszeit, nicht bestätigte Abflugzeit. Open-Meteo
best_match liefert regionale Modelldaten inklusive archivierter Vorhersagen;
UTC, Quelle, Abrufzeit und Gültigkeitszeit bleiben getrennt. 72 Stunden Rückblick
und der aktuelle plus 72 zukünftige Stundenwerte werden abgefragt. Der Prompt
enthält Rückblickstatistiken, aktuellen Stundenwert, sechs separat datierte
kurzfristige Prognosepunkte und drei rollende 24-Stunden-Zusammenfassungen. Die KI kann erwartete Entwicklungen selbst einordnen; kein
vorberechnetes Label „Verschlechterung“ und keine Motivvorgabe. Keine Vorhersage wird als Vergangenheit
summiert. Niederschlag und Regen in mm, Schneefall in cm, Schneehöhe in m;
Wind/Böen in kn. Fehlende Werte bleiben null; Summen nur bei vollständigen 72
Stunden. Ein Sturm über drei Tage oder sichtbarer Schnee wird nicht aus einzelnen
Werten als erwiesen abgeleitet. Die KI entscheidet frei über erzählerische Nutzung.

Start und Ziel parallel, 4,5 Sekunden Zeitlimit auch bei fehlender Abort-Reaktion,
maximal zwölf RAM-Einträge, 30 Minuten Cache. Fehlerdaten werden nicht gecacht.
Keine dauerhafte neue Wetter-History, keine Umstellung der Flugwetterquelle.
Der kompakte Kontext wird mit der Mission gespeichert; Folgeaufträge holen neuen
Kontext und behalten die bestehende Geschichte. Der Datenbaustein selbst erzeugt keine neue Runtime-State-Machine. Die separat
integrierten Bush-Kapitel und Wetter-/Zeitreaktionen benötigen den neuen Tracker.

Bush-Anbindungen: V4 Planner-Bundle einschließlich kompakter Projektion, Contract,
V4/V5 Writer, Legacy-Bush-Writer und vorbereitete feste/Geo-Erzähltexte. Die bereits
bestehenden Bush-Ideen-/Variety-Briefs bleiben im Planner-Bundle; dieser erhält den
Kontext vor seiner Ideenfindung. Keine zusätzliche KI-Abfrage nur für Wetter.
Andere Missionsfamilien sind noch nicht freigeschaltet. Vorbereitete Texte sind
keine Live-Wetteransagen. Die neue Bush-Kapitel-Runtime ist lokal im Tracker-Teststand v488 integriert;
Veröffentlichung und echte In-Sim-Abnahme bleiben offen, siehe Bush Narrative Voices.md.

Prüfung: `node --test tools/mission-environment.test.cjs tools/bush-narrative.test.cjs`.
Öffentliche API-Probe und Node-Browseradapter belegen noch keinen Safari-/Firefox-
CORS-Test oder vollständigen Simulator-/Audio-/Tracker-Durchlauf.

## Lokale Probe

24 Tests einschließlich tatsächlicher V4/V5-Requestadapter; Ground-Flow und
JavaScript-Syntaxprüfung erfolgreich. Echter Adapteraufruf für Big Creek und
Idaho-Zielgebiet am 07.10.2026: beide available, je 72 Rückblickstunden,
209 ms Gesamtdauer, 2.796 Zeichen Kontext. Keine Gemini-Generierung, kein
Browser-CORS- oder Simulatornachweis in dieser Probe.

## Prognose und Geo-Anker

27 Tests bestanden. Echte Abfrage am 07.10.2026 für Östersund und Hedlanda:
174 ms, je 72 Rückblickstunden und sechs zukünftige Stundenpunkte; Kontext
5.501 Zeichen. Keine erneute Gemini- oder Browser-CORS-Probe. Die zusätzlichen
Prognosedaten verändern weder Flugwetterquelle noch Missions-Erfolgskriterien.
Geo-Anker verwenden derzeit die direkte Start-Ziel-Verbindung des jeweiligen
Erzählabschnitts; fünf Tile-Stichproben sind keine Vollabdeckung.

## Ausblick für vorbeugende Aufträge

Die Abfrage liefert zusätzlich 72 Stunden Prognose, einmalig im selben Request.
Im Prompt stehen drei rollende 24-Stunden-Fenster mit expliziten UTC-Grenzen:
Temperaturspanne, Niederschlags-/Regen-/Neuschneesummen, Schneehöhenspanne,
maximaler Wind und Böen sowie Bewölkungsspanne. Fehlende Stunden bleiben
ausgewiesen; Summen werden dann nicht als vollständige Mengen ausgegeben.
Keine Vermischung mit Rückblick, lokalen Kalendertagen oder amtlichen Warnungen.
Die KI entscheidet selbst, ob sich daraus ein vorbeugender Anlass ergibt. Profil
und TaskDomain bleiben bindend; keine Wetterquote, kein Sturm-Klassifikator,
keine behauptete Durchführung zu einem späteren Datum. Sechs-Stunden-Prognose
bleibt zusätzlich für den kurzfristigen Verlauf bestehen.

29 Tests bestanden. Live-Abfragen am 07.10.2026 für Big Creek, Östersund und
Fairbanks: alle drei jeweils 72 verfügbare Prognosestunden, zusammen 293 ms.
Nachweis: analysis/bush-live-20261007/forecast-72h-live.json. Keine erneute
Gemini-, Audio-, Browser-CORS- oder Simulator-Probe mit dem Drei-Tage-Kontext.

## Textproben mit Drei-Tage-Ausblick

Drei Gemini-Proben am 07.10.2026: Bush-Ausflug Idaho (real), Pickup Schweden
(real), Supply Idaho (künstliche Winterprognose). Briefing nutzt Wetter als
Ergänzung und als vorbeugenden Anlass. Zwei Voice-Pläne ready (6 und 8 Events);
Supply erhält keine Bord-Erzählung. Semantische Schwächen bleiben, insbesondere
erfundene Windrichtung, perfektes VFR ohne Sicht-/Ceiling-Daten, überhöhte
Wetterdringlichkeit, wiederholte Anekdote und Ankunftsvorwegnahme.
Nachweis: analysis/bush-live-20261007/outlook-text-probes.md.
V4-Promptbuilder mit handgefertigter Contract-Brücke; kein vollständiger
App-Dispatch/V5-, Simulator-, Audio- oder Tracker-Nachweis. Kein Release.


## Optionaler Erzählbezug und frühe Wetterreaktion (07.10.2026)

Wetter ist kein Pflichtabsatz. Der Bush-Pickup-Writer verlangt keinen
Wetter-/Pistenanker mehr; der gemeinsame Kontext verweist auf abwechslungsreiche,
auch wetterunabhängige Anlässe anhand der vorhandenen History. Keine Quote,
keine nachträgliche Textkorrektur und kein zusätzlicher History-Speicher.

Eine frühe Boarding-Reaktion vergleicht aktuelle Bodentelemetrie im Umkreis
von einer NM um den Einstiegsort mit der örtlichen Briefing-Basis. Bei Bush
werden nur aktuelle Modellwerte bis zwei Stunden Alter verwendet, keine
Zukunftsprognose. Bei reinen METAR-Briefings dienen die tatsächlich gebrieften
Werte als Referenz (deren bestehendes Snapshot-Format enthält keinen Messzeitpunkt).
Ein Temperaturunterschied ab 15 °C oder zwei deutliche Wind-/Sichtunterschiede
lösen einen kurzen humorvollen Hinweis aus. Windrichtungen bei schwachem Wind
werden nicht gewertet. Ohne geeignete Positions-/Bodentelemetrie bleibt der
frühe Kommentar aus; die bestehende spätere Reaktion bleibt verfügbar.

Web: Kommentar unmittelbar nach Boarding-Text; Preload verbraucht ihn nicht.
Tracker: Live-Auswertung erst beim Boarding-Dispatch, gegebenenfalls Ersetzen
eines nicht mehr passenden Preload-Jobs. Das Voice-Outcome trägt den Verbrauch
auch über Snapshot/Resume; Anflug und Abschied wiederholen ihn nicht.
Text und Audio gehen durch den bestehenden zentralen Voice-Service zum EFB.
Die neue Bush-Kapitel-Runtime ist jetzt auch in Tracker-Authority implementiert.
Tracker v487 ist lokal gebaut. Kein Release und kein Live-Simulator-Test.


## Integration und erneute Proben – 07.10.2026

Auf Alpha 5ab9d3197 integriert. Umgebungskontext bleibt nur für Bush aktiviert;
APT/POI bekommen noch keinen Open-Meteo-Zusatz. Planner und Writer erhalten den
Kontext einmal getrennt, mit optionalen weatherHooks und ohne Pflicht-Wetterabsatz.
Der neue Bush-Pickup-Pfad hängt keine Wetter-/Pistenbeschreibung nachträglich an.
Bestehende Missionsrezepte und Pflichtfracht bleiben bindend.

Fünf weitere Gemini-Proben mit Produktions-V4-Promptbuildern, Produktions-Variety
und History: eine Geschichte ohne Wetter, drei mit beiläufigem/ergänzendem Wetter,
eine Abholung mit angekündigtem Wintereinbruch als Hintergrund. Vier Bordpläne
ready (6, 6, 10 und 6 Kapitel); Supply korrekt ohne neuen Bordsprecher. Mildes
und Winterwetter sind ausdrücklich synthetische Testdaten, Schweden nutzt eine
reale Modellabfrage. Handgefertigte Draft-/Contract-Brücke: kein vollständiger
App-Dispatch, keine tatsächliche TTS-/Simulatorprüfung. Kleine Stichprobe,
keine Garantie gegen Halluzinationen oder künftige Wiederholungen. Texte unter
`analysis/bush-live-20261007/bush-weather-production.md`.

Wetter- und Zeitsprünge nutzen dieselbe zweiminütige Sperre. Ohne EFB funktionieren
Messwertreaktion und Zeitsprünge über Tracker-Telemetrie; ohne frischen Preset-
Nachweis wird kein künstlicher Wechsel behauptet. Der optionale native Preset-
Listener bleibt experimentell und wurde nur mit SDK-Mocks geprüft. Das offizielle
MSFS-EFB-SDK fehlt hier; kein vollständiger nativer EFB-Paketbuild/In-Sim-Nachweis.


### V5-Nachprobe und Validierung

Vier zusätzliche V5-Live-Briefings mit den gespeicherten V4-Plänen: Fotografen-
Ausflug mit Wetter, Angler-Ausflug ohne Wetter, Vermessungsnachschub mit einem
beiläufigen Sicht-Hinweis, Ranger-Abholung mit Winterprognose. Die ersten V5-
Proben erwähnten Wetter noch durchgängig; der V5-Zweck-Anker wurde nachgeschärft:
Wetter nicht automatisch als whyNow einsetzen, wenn EnvironmentContext vorliegt,
und nicht als erwünschte Briefing-Pflicht behandeln. Keine Quote, keine
nachträgliche Prosa-Korrektur. Texte: `analysis/bush-live-20261007/bush-v5-weather.md`.
Einzelne nicht belegte Sicht-/Turbulenzbehauptungen und erfundene weiche Details
können weiterhin auftreten; die Probe ist keine vollständige Faktenabnahme.

Die V5-Probe zeigte außerdem Vereins-Zutaten im Supply-Writer. Ausschließlich
`bush_supply_strip` besitzt nun eine eigene positive V5-Erzählfamilie, verwendet
den geplanten Story-Kern und die vorgegebene Fracht statt des Club-Seeds. Andere
Club-Profile behalten ihre Zutaten. Die Wiederholungsprobe lieferte 0 PAX und
80 lbs Vermessungsnachschub; keine Clubheim-Mappe/Techniktermin-Umwidmung.

278 relevante Node-Regressionsprüfungen plus zwei native EFB-Mockprüfungen
bestanden. Enthalten: Wetter/Zeitsprung, Timeouts/fehlende Daten, Pause/Slew,
Geo-Cancel nach verspäteter TTS, Voice-Serialisierung/gerätübergreifende Lease,
Cache-Restore und persistente Bush-Kontinuität. Gepackter Prozess-Smoke-Test
bestanden. Windows-Build v487 erzeugt; kein Windows-/In-Sim-Nachweis und
kein Release. Build-/Probebericht: `analysis/bush-live-20261007/build-candidate.md`.


## Integrationsstand nach SDK-Rückgabe

Die frühere Angabe offener Tracker-Integration ist durch den lokalen v488-
Teststand überholt. Bush-Kapitel laufen jetzt im Tracker; Telemetrie-Wetter und
Zeitbeobachtung arbeiten auch ohne EFB. Das native Paket 0.4.22 ist SDK-gebaut
und geprüft, aber noch nicht im Simulator abgenommen oder veröffentlicht.
Sim-Niederschlag wird qualitativ aus STATE ausgewertet; RATE hat keine belegte
Stundenbasis. Die belegten Open-Meteo-Mengen/Einheiten werden nicht verändert.
Details: analysis/bush-live-20261007/integration-result.md.
