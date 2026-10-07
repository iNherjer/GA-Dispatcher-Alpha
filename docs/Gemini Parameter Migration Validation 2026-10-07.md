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
