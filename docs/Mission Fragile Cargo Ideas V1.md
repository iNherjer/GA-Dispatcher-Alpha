# Fragile APT-Fracht: Ideen und Briefings V1

Stand: 28.09.2026, Branch `codex/fragile-cargo-ideas-v1`, Basis Alpha `f7ac10917` / Cache v1867. Für Alpha-Release v1868 vorbereitet. Der ursprüngliche Projekt-Worktree bleibt unberührt; Arbeitsverzeichnis `/tmp/ga-cargo-ideas-20260928`.

## Erzählvertrag

Die KI entwickelt Bedarf, Absender, Empfänger, Sendung und genau einen mitreisenden Frachtbegleiter zusammen. Konkrete Waren, Berufe und Nutzerbeispiele stehen nicht im Prompt. Gewerbliche und institutionelle Versorgung bilden den Schwerpunkt; persönliche, fröhliche und kuriose Anlässe bleiben möglich. Keine Themenrotation oder Quote.

Der Lufttransport ist bereits beauftragt. Seine Wahl gegenüber anderen Verkehrswegen wird nicht erklärt. Die physische Empfindlichkeit wird konkret beschrieben und muss zur vorhandenen Simulation von Erschütterungen und Flugbewegungen passen. Sie verlangt weder außergewöhnlichen Wert noch Zeitdruck oder einen ängstlichen Begleiter. Verpackung und besondere Handhabung erklären die Sendung, ohne neue Kontrollverfahren zu erfinden.

Das Briefing bleibt ein Vorflugtext eines außenstehenden Erzählers. Die Begrüßung ist direkte Alltagssprache des am Start einsteigenden Begleiters. Zielkontakte bleiben am Ziel. Route und Wetter stehen separat; besondere Hinweise nennen Handhabung statt einer zweiten Gewichts-/PAX-Liste. Keine nachträgliche Umschreibung auf feste Cargo-Pools oder Personen.

## Geltung und ursprüngliche Logik

Nur explizites Profil `cargo_fragile`, APT, aktive KI, keine Folge-, Bush-, POI- oder reine Planungsmission. Normale Cargo-Ideen, Offline-Missionen und alte gespeicherte Aufträge bleiben auf ihrem bisherigen Pfad.

- Genau ein Begleiter benötigt einen Passagierplatz. Seine Identität, Rolle und Begrüßung stammen aus derselben Idee.
- Unveränderte Parameter: `cargo_fragile_highcare_v1`, `cargo_fragile`, g mittel, bank niedrig, cargo hoch, Magen mittel, Komfort hoch, Dringlichkeit niedrig.
- Ein Versandposten vom Start zum Ziel. Das originale Manifest enthält den erforderlichen Passagier und unabhängig davon die erforderliche `primary-cargo`-Lieferung. Kein passagiereigenes Gepäck, kein automatisches Erledigen durch Passenger-Handoff.
- Der Narrative-Code setzt nur Label und exaktes Gewicht der primären Sendung. Frachtpapiere, Ausrüstung, Laden, Entladen, Schadensbewertung und Abschluss bleiben unverändert.
- Ein technischer Plan mit `taskDomain: cargo_fragile` erhält den ursprünglichen `cargo_handoff`-Zielkontakt.
- Bestehende Boarding-, Komfort-, Lande- und Abschiedsansagen verwenden die neue Person und Geschichte. **Keine neuen optionalen Route-Events in diesem Vertrag.** Dafür wäre eine gesonderte vollständige Einbindung in App- und Tracker-Eventplanung nötig; keine versteckte Triggerlogik im Writer.
- Keine Änderungen am Tracker-Code oder dessen Authority. Ein neuer Tracker-Build ist für diese Narrative nicht erforderlich. Ein echter Sim-/Tracker-Flug und Hörtest bleibt zusätzlich nötig.

## Daten und Erzeugung

`mission-fragile-cargo-ideas-core.js`: Schema `fragile-cargo-idea.v1`, Feld `fragileCargoIdea`. Pflichtfelder purpose/background/sender/recipient/arrival/character/memory; shipment mit label, weightLbs, packaging, handling, fragility; passenger mit name, role, gender, personality, connection. Mechanische Parameter werden vom Programm festgelegt, nicht von der KI.

`mission-fragile-cargo-browser.js`: Ein Ideenaufruf für drei Pickerangebote oder eine Direktmission. Ausgewählte Idee bleibt erhalten; Route, Passagierplatz und Gewichtsgrenze werden bei Annahme erneut geprüft. Je ein begrenzter Struktur-/Prosa-Reparaturversuch, kein stiller Ersatz durch lokale Schablonen. Die alten Profil-Pools gelangen nicht in den Ideenprompt.

Die Entwurfsgrenze übernimmt maximal 319 lbs aus der normalen Cargo-Erzeugung und begrenzt zusätzlich durch das eingestellte Maximalpayload. Sie ist keine freie Restzuladung: Begleiter, Pilot, Kraftstoff, Ausrüstung, Volumen und Schwerpunkt werden dadurch nicht bilanziert. Die bestehende Payload-Prüfung bleibt zuständig.

Wetter stammt aus dem App-Snapshot und nutzt die Private-V6-Referenzauflösung. Unbekannte Werte werden nicht erfunden. Ein Wetter-Reparaturaufruf kann weder Geschichte noch Begrüßung verändern. Ohne verwertbare Beobachtungen erscheint ein ausdrücklicher Hinweis.

`fragileCargoIdea` bleibt in Missionsdaten und Vertrag sowie bei Quota-Kompaktierung und Cloud-Sync erhalten. Der Picker bewahrt `fragileCargoProposal`. Schema-spezifische Guards verhindern die alte Auswahl aus Cargo- und Persona-Pools, ohne allgemeine Parser oder fremde Missionsprofile zu verändern.

## History und Prüfung

`ga_fragile_cargo_idea_history_v1`: eigene lokale History, maximal zwölf Einträge / 12.000 JSON-Zeichen. Enthält Zweck, Hintergrund, Beteiligte, Sendung, Empfindlichkeit, Beziehung des Begleiters, Motiv und Texteinstieg. Sie erinnert an erzeugte Entwürfe, nicht an tatsächlich geflogene Ereignisse. Aktive Missionen werden synchronisiert; diese Variationshistory bleibt wie die anderen Ideenhistories lokal.

62 Tests bestanden: neue Fragile-Cargo-Suite plus normale Cargo-, Charter-, Charter-Folge-, Club- und Tracker-Cargo-Suites. Getestet sind Auswahl/Annahme, Kapazität, feste Identität, Legacy-Guards, Wetterreparatur, lokale/Cloud-Speicherung, originales Manifest, unabhängige Frachtpflicht und Ankunftsrolle. Dazu die bestehenden sieben Cargo-Selbsttests für Persistenz, UI, Audio, Szenen, Manifest und Objektlebenszyklus/-identität.

`tools/fragile-cargo-ideas-live-probe.mjs --run --key-dir=<lokales Verzeichnis> --count=3 --out=<neuer Bericht>` ist vorbereitet. Nutzt den App-JSON-Parser und eine isolierte History aus ausschließlich diesen Testentwürfen; keine Benutzerhistory, keine Live-Wetterdaten. Die zunächst blockierte Live-Probe wurde nach ausdrücklichem Nutzerwunsch ausgeführt: drei gültige Missionen, sechs API-Aufrufe ohne Reparatur, History-Längen 0/1/2. Ergebnisse: `analysis/fragile-cargo-20260928.json` und `.md`. Alle drei begründen den Lufttransport erneut mit Straßenvibrationen, trotz gegenteiliger Promptgrundlage. Außerdem dominieren aufwendige Spezialobjekte und technische Erklärungen; Humor bleibt gering. Reale Einrichtungen werden mit fiktiven Aufträgen verknüpft, ohne Grounding. Die dritte Überschrift bezeichnet einen Transport irreführend als Forschungsflug. Schema-Erfolg ist daher noch keine erzählerische Qualitätsfreigabe. Die unveränderten Texte werden mit dem Nutzer bewertet.

Vor Release: Live-Textprobe nach Freigabe bewerten, Änderungen gezielt integrieren, Cache-Version erhöhen und Push-Workflow anwenden. Bestehende gespeicherte Briefings werden nicht neu geschrieben.

## Präzisierung nach der ersten Live-Serie

Nutzerfeedback: Die Aufträge und die klare Empfindlichkeit passen; die wiederkehrende Straßenverkehrs-Rechtfertigung entfällt. Die Ideenfelder haben deshalb ausdrücklich eigene Aufgaben: purpose = Verwendungszweck, background = Bedarfsgeschichte/Beteiligte, arrival = Übergabe/Anschluss, connection = Beziehung des Begleiters. Fragilität, Verpackung und Handhabung bleiben in den zugehörigen Sendungsfeldern. Der Writer erhält den bereits gebuchten Lieferauftrag und übernimmt aus älteren Entwürfen dessen konkrete Daten, nicht deren Verkehrsmittelvergleich. Das gilt auch für Hinweise und Begrüßung. Keine Themenbeispiele, Textfilter oder Änderungen am Flugprofil.

Die erste Live-Serie bleibt als unverändertes Vorher-Ergebnis erhalten. Diese Präzisierung wurde lokal geprüft, noch nicht erneut live generiert. Die Präzisierung ist Teil des Alpha-Releases v1868.

## Picker-Korrektur V1.1 / Alpha v1869

Der Nutzer zeigte drei v1868-Angebote mit erneuten Landwegvergleichen. Der Picker zeigt `background` direkt an, vor jedem Briefing-Writer. Die gemeinsame KI-Anfrage fügt keine alte Frachtanweisung hinzu. Die vorherige Prompt-Nachschärfung allein war daher nicht ausreichend. Der Ideenprompt wurde kompakter neu gefasst: bestehender Luftfrachtdienst, bereits gebuchte Lieferangebote, explizite kurze Feldaufgaben. Empfindlichkeit bleibt Transportanforderung; Angebotstext beschreibt Bestellung, Bedarf oder Beteiligte. Keine Beispielwaren, Textfilter oder globalen Heuristiken.

Der Live-Probe unterstützt jetzt `--picker` und ruft den produktiven `choices`-Adapter mit echter App-Normalisierung auf. Die lokale Stichprobe `analysis/fragile-picker-20260928-v2.md` enthält drei Angebote ohne Verkehrswegvergleich (ein API-Aufruf, keine Reparatur). Der Schwerpunkt bleibt technisch/institutionell; keine Aussage über langfristige Verteilung oder garantierte Befolgung. Anders als die erste Probe wurde tatsächlich die Dreierauswahl geprüft.

Promptkennung `fragile-cargo-v1.1` steht im Ideenvertrag und Writer-Debug; Schema bleibt kompatibel. Versionsparameter der beiden Skripte werden erhöht. Bereits sichtbare Angebote ändern sich nicht; nach dem Update neue Auswahl erzeugen.
