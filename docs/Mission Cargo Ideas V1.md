# Normale APT-Fracht: Ideen und Briefings V1

Stand: 28.09.2026. Implementierung auf `codex/cargo-ideas-v1`, Basis `origin/main` 2d0b99e11. Noch nicht veröffentlicht.

## Ziel und Spielraum

Normale Fracht dient vorrangig alltäglicher gewerblicher und institutioneller Versorgung. Die KI entwickelt den Bedarf am Ziel, den Zusammenhang zwischen Absender und Empfänger und daraus Sendung und Verpackung. Private Gefälligkeiten, Humor und kuriose Sendungen bleiben gelegentlich möglich. Es gibt weder Themenkatalog noch Häufigkeitsquote. Die konkreten Beispiele aus der Produktdiskussion stehen nicht in Produktionsprompts oder Seeds.

Kleine Luftfracht gehört in der Spielwelt zum regulären Transportangebot. Ein normaler Versandbedarf ist bereits plausibel; die KI muss den Luftweg nicht mit Eile, fragiler Spezialtechnik oder einem außergewöhnlichen Einzelwunsch rechtfertigen. Spezielle technische Problemlösung bleibt möglich, bildet aber nicht die Vorgabe für jeden Auftrag. Das Briefing erzählt den Vorgang und erklärt nicht, wie gewöhnlich oder bodenständig es selbst ist.

## Bestehender Ablauf bleibt maßgeblich

Geltung: explizite APT-Kategorie `cargo`, Profil `auto`/leer, aktive KI, keine Folge-, Bush-, POI- oder reine Planungsmission. `cargo_fragile`, Tiertransport und Offline-Erzeugung behalten ihren bisherigen Pfad.

- A nach B, **0 PAX**, kein fiktiver Bordbegleiter.
- Ein zusammengehöriger Versandposten am Start; Laden, Transport und Entladen am Ziel bleiben die ursprünglichen Aktionen.
- `primary-cargo` bleibt erforderlich und am Ziel abzuliefern. Kein passagiereigenes Gepäck und kein Passenger-Handoff. Die neue Datenanbindung setzt nur Label und exaktes Gesamtgewicht.
- Die vorhandenen Frachtpapiere, Ausrüstung, Bodenaktionen, Schäden, Erfolgsbedingungen und Authority-Regeln bleiben bestehen.
- Ein fester technischer Plan mit `taskDomain: cargo` erhält die bestehende `cargo_handoff`-Ankunftsrolle auch ohne alten KI-Planer. Dieser Plan ist keine frei erfundene Zusatzaufgabe. Der Empfänger bleibt Bodenpersonal am Ziel.
- Bestehende Lademeister-/Empfängeransagen nutzen weiterhin den Missionskontext. Es entstehen weder PAX-Greeting noch zusätzliche Bord-Events. Keine Änderungen an Voice-State-Machine oder Tracker-Code.
- Keine neuen Pickup-, Rückflug-, Lager-, Wartungs- oder Prüfmechaniken. Was nach der Übergabe geschieht, bleibt Erzählkontext.

## Datenfluss

`mission-cargo-ideas-core.js` definiert `cargo-idea.v1`: purpose, background, sender, recipient, arrival, character, memory sowie shipment mit label, weightLbs, packaging und optional leerem handling. Datum, Flugzeug und Route kommen von der App. Ein Ideenaufruf liefert einen Direktauftrag oder drei Pickerangebote. Ein gezielter Struktur-Reparaturversuch ist zulässig; kein stiller Austausch gegen eine lokale Geschichte.

`mission-cargo-browser.js` übernimmt die ausgewählte Idee unverändert, prüft Route und Entwurfsgewicht erneut und schreibt anschließend den Text. Bei geänderter Route oder unpassender Gewichtsgrenze wird die Auswahl sichtbar abgelehnt. Der Ideenprompt bekommt keine alten Cargo-Pools, zufälligen Sendungsgewichte oder Anlassbeispiele.

Die historische Entwurfsgrößenordnung normaler Cargo-Missionen bleibt mit maximal 319 lbs erhalten, zusätzlich begrenzt durch das eingestellte Maximalpayload. Diese Grenze ist **keine freie Restzuladung**: Pilot, Kraftstoff, Bordausrüstung, Volumen, Türmaße und Schwerpunkt werden dadurch nicht bilanziert. Die vorhandene Payload-Prüfung bleibt zuständig. Es wird keine reale Transport- oder Beladbarkeitsfreigabe behauptet.

Der Writer bleibt außenstehender Erzähler vor dem Abflug. Vorgeschichte darf geschehen sein, Flug und Übergabe stehen bevor. Kurze Anlässe dürfen kurze Texte haben. Besondere Handhabung erscheint nur, wenn die Idee sie enthält; keine zweite PAX-/Fracht-Datenliste. Bestehende Profilschablonen verändern markierte Cargo-Geschichten nicht nachträglich.

Route und Wetter werden getrennt behandelt. Die App liefert ihren aktuellen Wetter-Snapshot; Zahlen werden über die vorhandene Private-V6-Referenzauflösung gebunden. Ein gesonderter Wetter-Reparaturaufruf kann die akzeptierte Geschichte nicht verändern. Ohne verwertbare Beobachtungen steht das ausdrücklich im Briefing. Keine Google-Wettersuche und keine erfundenen Messwerte.

## Persistenz und History

`cargoIdea` steht sowohl in den Missionsdaten als auch im Vertrag und überlebt die lokale Quota-Kompaktierung sowie den Cloud-Core-Roundtrip. Die kompakte Picker-Auswahl enthält `cargoProposal`. Label, Gesamtgewicht, Bedarf, Empfänger und geplanter Anschluss werden deshalb nicht bei jeder Sitzung neu gezogen.

`ga_cargo_idea_history_v1` ist eine lokale Variationshistory mit höchstens zwölf Einträgen und 12.000 JSON-Zeichen. Sie speichert Zweck, Hintergrund, Auftragscharakter, Beteiligte, Sendung, Motiv, Texteinstieg und Writer-Memory. Sie dient als Erinnerung an eigene Entwürfe, nicht als Liste geflogener Missionen. Sie wird wie die vorhandenen Ideenhistories nicht geräteübergreifend synchronisiert; die aktive Mission dagegen schon.

## Prüfen und weiterarbeiten

- `node --test tools/mission-cargo-ideas.test.cjs`: Struktur/0 PAX, Picker-Erhaltung, aktuelle Wetterbindung, Reparatur, Legacy-Schutz, Quota/Cloud, begrenzte History, originales Liefermanifest, Zielkontakt und Ausschluss anderer Missionsfamilien.
- Bestehende Charter-/Club-Tests und Cargo-Persistenz-, Szenen-, UI-, Manifest-, Objekt- und Audio-Differentialtests.
- Tracker-Original-Parity, Cargo-Audio und Checkpoint-Recovery prüfen den bestehenden Ablauf; kein Ersatz für einen tatsächlichen Sim-Flug/Hörtest.
- `tools/cargo-ideas-live-probe.mjs --run --key-dir=<lokales Key-Verzeichnis> --out=<neue JSON-Datei>`: vier sequenzielle Ideen-/Writer-Durchgänge mit wachsender isolierter History. Der App-JSON-Parser wird verwendet, Provider ist Gemini Flash mit Default-Generationskonfiguration. Keine Keys werden in Berichte geschrieben. Die Probe enthält bewusst keine Live-Wetterdaten; die Referenzbindung wird separat getestet.

Kleine Serien sind Qualitätsstichproben und kein Beleg einer langfristigen Themenverteilung. Generische Formulierungen, erfundene Spezifikationen, saisonale Behauptungen und ein erneuter Schwerpunkt auf dringenden Einzelteilen bleiben bei späteren Ergebnissen zu beobachten. Erst Grundlage, Pflichtfelder und History untersuchen; keine nachträglichen Verbotslisten oder Textschablonen als Reparatur.

Vor Veröffentlichung: Änderungen gezielt integrieren, App-Cache-Version erhöhen und normalen Push-Workflow anwenden. Kein neuer Tracker-Build allein für diese Narrative nötig, da dessen Ablauf und Code unverändert sind.

## Ergebnis der Implementierungsprüfung

45 Tests in Cargo-/Charter-/Club-Narrativsuites und sieben Tracker-Cargo-Tests bestanden. Zusätzlich bestanden die sieben vorhandenen Skripte für Cargo-Persistenz, Legacy-UI, Szenen, Audio, Manifest-Differential, Objektlebenszyklus und Objektidentitäten. Zwei ältere Charter-Test-Sandboxes benötigten lediglich ein leeres `window`, das der aktuelle Cloud-Compactor voraussetzt; keine Änderung der getesteten Produktlogik dafür.

Die erste Live-Serie zeigte künstliche Transportrechtfertigungen und einen ungültigen Zahlenreferenzschlüssel. Der Cargo-Rahmen erhielt daher das tatsächliche Datum, klarere Schlüsselregeln und die positive Grundlage eines regulären Luftfrachtangebots. Ein zunächst zu einfacher Probeparser wurde durch den unveränderten App-Parser ersetzt; dessen Behandlung einer Antwort mit Nachlauftext wurde nicht als Produktfehler gewertet.

Die abschließende Serie steht in `analysis/cargo-routine-20260928.json` und lesbar in `analysis/cargo-routine-20260928.md`: vier gültige Direktaufträge, acht API-Aufrufe ohne Reparatur, History-Längen 0/1/2/3, keine PAX oder Bordevents. Sie umfasst gewerblichen und institutionellen Nachschub, bleibt aber deutlich technisch geprägt. Humor oder private Gefälligkeiten kamen in dieser kleinen Serie nicht vor. Teilweise erklärt die Prosa den Luftweg weiter über weniger Umschlag und verwendet allgemeine Logistikformulierungen. Das bleibt ein beobachteter Qualitätsrand, kein Grund, die Texte durch Schablonen zu ersetzen. Keine Live-Wetterdaten und kein realer Sim-/Tracker-Flug in dieser Probe.
