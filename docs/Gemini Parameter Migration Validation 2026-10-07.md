# Gemini-Parameterbereinigung: Implementierung und Nachweise

07.10.2026. Basis `23aa0d4f6e766544b1a57c96fa7401115b6a6187` (Alpha nach
Bush-Web-Hotfix und EFB-Feldtestfreigabe). Separater beschreibbarer Worktree:
`/tmp/ga-gemini-parameter-migration`. Keine produktive Veroeffentlichung.

## Eingriff

Entfernt wurden ausschliesslich Sampling-Felder aus Scene Planner, V3 Mission
Planner, Wetterbriefing und Passenger-Textgenerierung, einschliesslich des
gemeinsamen Browser-/Tracker-Voice-Cores und des Browser-Inline-Fallbacks.
Die EFB-Version von checklists.js wurde mit dem offiziellen Asset-Sync erzeugt.
Der differentielle Test belegt fuer diese generierte Datei exakt die entfernte
Temperaturzeile. Unabhaengige, vom vollen Sync ebenfalls neu erzeugte Profile- und
CSS-Differenzen wurden nicht in den Patch uebernommen.

Kein neuer Modellname, kein geaenderter Prompt, keine Thinking-Neueinstellung,
kein kleineres Tokenlimit, keine neue API, keine geaenderte Missionsemantik.
Bestehendes thinkingLevel low bleibt erhalten. Ein zu migrierendes
thinkingBudget wurde in den Runtime-Quellen nicht gefunden.

## Offline

241 Tests im gemeinsamen Abschlusslauf bestanden; 0 fehlgeschlagen.
16 neue differentielle Payloadtests verwenden den gepinnten Vorher-SHA.
Sie pruefen Wetter inklusive Abbruchsignal/Fallback, Tool-Folgeturns und
Thought Signatures, normalen/Reporter-Scene-Planner, Browser-Voice mit und
ohne Core, 3.x-/2.5-Fallbacks, Tracker-Voice automatisch/manuell, unveraenderte
OpenAI-Textanfragen sowie unveraenderte neue/alte TTS-Payloads und Audio-Bytes.

Bestehende Tests decken Quota-/Dispatch-Fehler, Voice-Service und Boarding/
Farewell, POI/Infra/SAR, Shared-Briefing/Wetter, Reporter-Szenen und Bush ab.
Boarding-/Farewell-App-Differenzselftests ebenfalls erfolgreich.
Syntaxchecks aller vier geaenderten Quell-JS-Dateien und des Live-Skripts,
sowie git diff --check erfolgreich. Kein Sampling-Feld in den geprueften
Runtime-Anfragequellen mehr gefunden.

Die Bush-Suite benoetigt zwei historische JSON-Fixtures, die in origin/main
fehlen: bush-live-20261007-refined.json und bush-live-20261007-sage.json.
Diese wurden unveraendert aus dem passenden lokalen Bush-Release-Worktree in
den Test-Worktree kopiert. Nach Bereitstellung bestanden alle 26 Bush-Tests.
Diese Referenzdateien werden nicht als neue produktive Aenderung committed.
Ein frischer CI-Checkout benoetigt weiterhin diese bestehenden Fixtures;
die Luecke nicht durch Tests-Skipping oder erfundene Ersatzdaten kaschieren.

## Live nach den einzelnen Eingriffen

Alle Aufrufe nutzten den vorhandenen lokalen API-Key. Der Key wurde weder
kopiert noch im Bericht gespeichert. Reale Gemini-API, aus produktiven
Quellen extrahierte Funktionen, synthetische kontrollierte Testdaten.
Keine Nutzer-Mission wurde geladen, gestartet oder veraendert.

| Eingriff | Nachweis |
| --- | --- |
| Wetterbriefing | gemini-2.5-flash-lite: HTTP 200, STOP, verwendbarer deutscher Wettertext, fehlendes Zielwetter benannt. 1 Request. |
| Mission Planner | gemini-3-flash-preview: 3 Tool-Turns mit HTTP 200, anschliessend parsebares ready/plan-JSON; Zieltyp Bush und vorgegebene Rolle/TaskDomain erhalten. |
| Scene Planner | Separater abgeschlossener Lauf mit 3 HTTP-200-Requests, parsebares Bush-JSON; targetScene none mit leeren features/requirements/roles, Handoff in aptArrivalPlan. |
| Browser-Voice | gemini-3.8-flash mit unveraendertem low: HTTP 200, deutscher Text; anschliessend gemini-3.8-flash-tts: HTTP 200, WAV-Audio. |
| Tracker-Voice | Echter createTrackerVoiceService, automatisches gemini-3-flash-preview: HTTP 200 und ready-Text; keine erneute Audioerzeugung. |

Audio technisch geprueft: PCM-WAV, mono, 24 kHz, 16 Bit, 9,92 Sekunden;
482274 Dateibytes, 476160 Audio-Datenbytes. Keine akustische Qualitaets- oder
In-Sim-Wiedergabebestaetigung aus dieser technischen Pruefung ableiten.

Insgesamt 12 API-Aufrufe: 11 HTTP 200, ein HTTP 403 im ersten Testskriptlauf
wegen fehlender Key-Uebergabe im synthetischen Mission-Planner-Kontext.
Dieser Harness-Fehler wurde korrigiert; kein produktiver Auth-Code geaendert.
Ein erster kombinierter Plannerlauf wurde nach erfolgreichem Mission-JSON
und erstem Scene-Tool-Call von der Vier-Request-Testobergrenze gestoppt.
Danach nur die noch offene Scene-Pruefung separat ausgefuehrt.
Alle Fehl-/Teilberichte bleiben als solche erhalten, keine positiven Ergebnisse
daraus abgeleitet. 18301 dokumentierte totalTokenCount inklusive Audio-Token;
daraus ohne Modellpreise keinen einheitlichen Geldbetrag ableiten.

Rohberichte: `analysis/gemini-parameter-migration/` im Test-Worktree.
Das Live-Skript verweigert automatisches Wiederholen eines bereits vorhandenen
Reports und stoppt weitere Netzaufrufe bei Auth-, Config- oder Quota-Fehlern.

## Grenzen und naechster Schritt

Die Live-Laeufe bestaetigen API-Kompatibilitaet, Tool-Roundtrips und technische
Text-/Audio-Ausgabe. Planner-Geokontext ist eine Testfixture; der Scene-Sanitizer
ist im Live-Harness zur Rohantwortpruefung ersetzt. Dies bestaetigt weder reale
Geoplatzierung noch eine vollstaendige, akzeptierte Missionsgenerierung.
Rohantworten enthalten zusaetzliche fliegerische/Standortannahmen. Die
Untersuchung belegt nicht, dass diese durch die Parameterentfernung entstanden
sind; keine Prompt-/Parser-Nachbesserung in diesen Patch aufgenommen.
Vor breiter Freigabe bleibt der geplante fachliche Vergleich mit realistischen
eingefrorenen Contracts/Geo-Daten und produktiven Validatoren erforderlich.

Offen: Browser-/In-Sim-Gesamttest von Bush Pickup/Return und autoritativer
APT-/POI-Voice, Hoerprobe, neuer Tracker-Build und Release mit erhoehter
Service-Worker-Version. Shared Voice-Core ist in der Tracker-EXE enthalten:
ein Web-Reload aktualisiert alte Tracker nicht.
Kein Beta-/Stable-Promotion, kein automatischer Modell-/API-Wechsel.

Der bekannte Cache-Testfehler wurde hier vermieden, indem der neue Worktree
innerhalb der beschreibbaren /tmp-Wurzel liegt. Die produktive Cachelogik
wurde nicht veraendert.

## Zweite Stufe: integrierter Release-Kandidat

Mit origin/main fccb0ea09 zusammengefuehrt (EFB 0.4.23 Alpha-Feldtest).
SW-Kandidat v1961, Tracker-Kandidat v491. Kein Push, Tag oder Release;
Alpha-/Stable-Kanaldateien wurden nicht umgeschaltet.

Die 241 Tests nach dem Merge erneut bestanden. Der neue begrenzte Test
`tools/gemini-mission-release-live.mjs` nutzt die komplette App im bestehenden
Dry-run-VM sowie reale Produktionsfunktionen und Validatoren fuer V4-Planner,
Contract, V5-Writer, Bush-Kapitel und Scene Planner. Navigation-Geometrie und
Airport-/Environment-Cores sind geladen. Eingaben: KMYL nach U60, Bush Charter,
1 PAX, Karten/Markierungsband, fest vorgegebene Bahn-/Hoehenangaben. Keine
aktuelle Wettermessung, keine Ortsrecherche und keine Geo-Anekdoten-Tiles.
Dies ist kein UI-, Windows- oder Simulatorflugtest.

Erster Versuch: Planner HTTP 200, Writer-Abbruch nach dem unveraenderten
produktiven 16-Sekunden-Limit, lokaler Fallback; kein bestandenes Ergebnis.
Zweiter Versuch: Planner/Writer HTTP 200, Writer vom Produktionsvalidator
akzeptiert. Fehlende Navigation-Abhaengigkeit im neuen Testaufbau anschliessend
korrigiert; gespeicherte validierte Planner-/Writer-Ausgaben fuer den weiteren
Test wiederverwendet, keine doppelte Generierung. Bush-Kapitel ready mit vier
Events; Scene Planner mit echten Tool-Folgeturns/Validator: targetScene none,
keine Features. Insgesamt zehn API-Aufrufe in dieser Stufe, neun HTTP 200,
ein Writer-Timeout. Vorhandene Voice-/TTS-Live-Nachweise bleiben gueltig,
da danach keine Voice-Quellen geaendert wurden.

### Fachlicher Befund: keine Release-Freigabe

Die Strukturvalidatoren bestanden, aber die manuelle Quellenpruefung nicht:

- Writer behauptet heutiges diffuses Licht ohne aktuelle Wettermessung;
  die Bush-Voice-Kapitel uebernehmen den Zustand.
- Flugplatzbeschreibung nennt Payette National Forest und fehlende Infrastruktur
  ohne einen dazu gelieferten Ortsbeleg.
- Flugbriefing spricht von dieser Dichtehoehe, obwohl nur die Platzhoehe
  bekannt ist; Temperatur/QNH und berechnete Dichtehoehe fehlen.

Vermutete Ursache: Prosa-Validierung und Referenz-IDs sichern die Bindung jeder
Sachbehauptung an vorhandene Daten nicht ausreichend. Der Befund betrifft hier
Bush Charter, Flugplatzredaktion und die nachfolgenden Voice-Kapitel; vor einem
Fix ist zu pruefen, welche anderen Bush-Profile dieselben Bausteine verwenden.
Der V4-Planner/Writer-Code, seine Prompts und die Bush-Narrative-/Airport-
Information-Cores sind gegenueber 23aa0d4f6e766544b1a57c96fa7401115b6a6187
unveraendert. app.js unterscheidet sich nur durch die zwei entfernten
Temperaturfelder in V3 Mission-/Scene-Planner. Eine neu verursachte V4-Regression
ist damit nicht belegt; der Live-Befund darf trotzdem nicht als fachlich
bestandener Test veroeffentlicht werden.

Vorgeschlagener naechster Eingriff: belegte Airport-/Wetterfakten und erfundene
persoenliche Erzaehlung im Bush-Datenvertrag eindeutig auseinanderhalten und
vor Weitergabe an Writer/Voice pruefen. Keine neue allgemeine Regex-Verbotsliste.
Freigabe fuer diese zusaetzliche Contract-/Writer-Aenderung wurde gemaess
AGENTS.md, Drift- und Datenbasis-Regeln, angefragt. Bis dahin kein Ausrollen.

### Paketierung

Windows-EXE v491 erfolgreich gebaut (PE32+ x86-64). Auf dem ARM-Mac war der
normale x64-Bytecode-Fabricator nicht ausfuehrbar; Build mit vorhandenen
Abhaengigkeiten und pkg 6.18.1, Node18-Windows-Target, --no-bytecode --public
--public-packages '*'. Keine fehlenden Abhaengigkeiten in diesem Build.
Der vollstaendige EFB-Sync wurde ausgefuehrt; unabhaengige Profile-/CSS-
Neugenerierungen vor dem Paketieren wieder auf den bestehenden Stand gesetzt.

Groesse: 173636963 Bytes.
SHA-256: 0df3c99faf671c4ac3228a59ea1f12dfc5b324a8b1129d8f5a723651a5838938.
Publisher-Trockenlauf bestaetigt dieselben Daten. Zusaetzliches ausfuehrbares
macOS-ARM64-Paket mit derselben pkg-/Node-Version: echter Tracker-Bootstrap,
Missionsprozess und IPC/Authority erfolgreich, MISSION_PACKAGED_PROCESS_SMOKE_OK,
Worker-Exit 0. Kein Windows-/SimConnect-Feldtest, keine EXE veroeffentlicht.

## Genehmigte Bush-Nachschaerfung, 08.10.2026

Separater zusaetzlicher Eingriff nach Nutzerfreigabe: gemeinsame Bush-Quellenregel
und Datenbasis in Planner/Writer/Voice; eigene technische Basisdaten werden bei
fehlendem oertlichem Quellenmaterial direkt als Platzinformation ausgegeben.
Details und verbliebene fachliche Grenzen in Bush Narrative Voices.md,
Abschnitt Bush-Quellenbindung, lokaler Kandidat 08.10.2026.

275 Tests bestanden; vier API-Proben (23/23 HTTP 200). Technische Ketten ready,
sachliche Basisdatenredaktion erfolgreich, freie Story/Voice noch mit unbelegten
Orts-/Lichtaussagen. Keine fachliche Freigabe, kein Push oder Release.
Keine neuen KI-Aufrufe im normalen Missionsablauf; neue Prompts/Datenbasis
benoetigen mehr Eingabetokens. Weiterhin unveraenderte Modelle, Sampling-
Bereinigung und Thinking-Einstellungen.

Neu gebauter lokaler v491-Kandidat ersetzt den vorherigen lokalen Build:
173641892 Bytes, SHA-256
b66021e72f008e9b3440debc4af57b4ee4059eb5af54bdcebcd9bea33b504605.
Alpha-/Stable-Kanaldateien weiter unveraendert. Kein Windows-/MSFS-Feldtest.


## Rollout-Freigabe des Nutzers, 08.10.2026

Der Nutzer hat die verbleibenden atmosphaerischen/erzaehlerischen
Ausschmueckungen akzeptiert und den Alpha-Rollout ausdruecklich freigegeben.
Die oben dokumentierten offenen Befunde beschreiben den vorherigen
Pruef-/Freigabestand; sie bleiben als Nachweis erhalten. Sachliche
Flugplatzangaben, Bahneignung, Verfahren und konkrete Dichtehoehe benoetigen
weiterhin passende Daten. Kein vollstaendiger Faktenvalidator fuer freie Prosa.

Release: Tracker v491 Alpha, Web-Cache v1961. Stable-/Beta-Kanaele unveraendert.
275 Regressionstests, vorhandene Live-API-Proben und gepackter
Tracker-Missionsprozess-Smoke-Test als technische Nachweise; kein
Windows-/MSFS-Flugtest. Asset vor Aktivierung des Alpha-Kanals verifizieren.
